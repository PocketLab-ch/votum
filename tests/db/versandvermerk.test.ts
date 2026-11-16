/**
 * Der Vermerk «Die Einladung ist hinausgegangen» (Migration 102, Auftraggeber
 * 02.09.2026).
 * Vom 06.10.2026 bis 07.10.2026 hiess der Haken «Die Einladung ist bei allen
 * angekommen» (Produktentscheid 06.10.2026), seit dem Produktentscheid
 * 07.10.2026 «Die Einladung ist verschickt».
 *
 * Was der Kern nicht prüfen kann und hier gemessen wird:
 *
 * - dass die Marke aus der Mail **ohne angemeldeten Betreiber** eingelöst wird
 *   und dabei den richtigen Mandanten trifft;
 * - dass sie danach **verbraucht** ist — ein zweiter Klick setzt nichts mehr;
 * - dass der Erinnerungslauf **schweigt**, sobald der Vermerk steht, und wieder
 *   spricht, wenn er entfernt wird;
 * - dass die Erinnerungsmail den **Link mitträgt** und die Marke dazu passt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { speichereEinberufungsfrist } from '$lib/server/reglement';
import { setzeErinnerungsadresse } from '$lib/server/betreiber';
import { erinnerungslauf } from '$lib/server/einladungserinnerung';
import {
	holeVersandvermerk,
	legeMarkeAb,
	loeseMarkeEin,
	markenPruefwert,
	neueMarke,
	schauMarkeAn,
	vermerkeVersand,
	WEG_UEBER_LINK
} from '$lib/server/versandvermerk';
import { tageSpaeter } from '$lib/domain/versammlung';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { festeHerkunft } from '$lib/server/herkunft';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

const HEUTE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

function briefkasten() {
	const gesammelt: { an: string; betreff: string; text: string }[] = [];
	return {
		gesammelt,
		versende: async (an: string, betreff: string, text: string) => {
			gesammelt.push({ an, betreff, text });
		}
	};
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Vermerk-Prüflauf');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
	await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

/** Eine Versammlung, deren Versandfrist heute abläuft — dann ist die Erinnerung fällig. */
async function faelligeVersammlung(name: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	await speichereEinberufungsfrist(handelnder(betreiber), g.id, 20, 'Reglement Ziff. 12');
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum: tageSpaeter(HEUTE, 20),
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	return { g, v };
}

/** Eine Marke erzeugen und ablegen — im Betrieb zwei Schritte, hier einer. */
async function marke_legen(meetingId: string): Promise<string> {
	const klartext = neueMarke();
	await legeMarkeAb(betreiber, meetingId, klartext);
	return klartext;
}

async function marke(meetingId: string): Promise<string | null> {
	return imKontext(betreiber, async (tx) => {
		const [z] = await tx<{ h: string | null }[]>`
			SELECT invitation_reminder_token_hash AS h FROM meeting WHERE id = ${meetingId}
		`;
		return z?.h ?? null;
	});
}

/** Der Zeitpunkt des Vermerks auf die Millisekunde — für die Frage, ob er stehenblieb. */
async function zeitpunkt(meetingId: string): Promise<number | null> {
	return imKontext(betreiber, async (tx) => {
		const [z] = await tx<{ at: Date | null }[]>`
			SELECT invitation_sent_marked_at AS at FROM meeting WHERE id = ${meetingId}
		`;
		return z?.at ? z.at.getTime() : null;
	});
}

/** Ob der Erinnerungsmerker unangetastet ist. */
async function merkerFrei(meetingId: string): Promise<boolean> {
	return imKontext(betreiber, async (tx) => {
		const [z] = await tx<{ sent: Date | null }[]>`
			SELECT invitation_reminder_sent_at AS sent FROM meeting WHERE id = ${meetingId}
		`;
		return z?.sent === null;
	});
}

async function ereignisse(meetingId: string) {
	return imKontext(betreiber, async (tx) => {
		return tx<{ detail: { gesetzt: boolean; weg: string }; actor_label: string }[]>`
			SELECT detail, actor_label FROM audit_entry
			 WHERE subject_type = 'meeting' AND subject_id = ${meetingId}
			   AND event_type = ${EREIGNISARTEN.einladungVersandVermerkt}
			 ORDER BY occurred_at
		`;
	});
}

describe('Der Vermerk in der Anwendung', () => {
	it('wird gesetzt, mit Zeitpunkt und Namen, und ist wieder zu entfernen', async () => {
		const { v } = await faelligeVersammlung('Vermerk setzen');

		expect(await holeVersandvermerk(betreiber, v.id)).toMatchObject({ gesetzt: false, wer: null });

		await vermerkeVersand(handelnder(betreiber), v.id, true);
		const gesetzt = await holeVersandvermerk(betreiber, v.id);
		expect(gesetzt.gesetzt).toBe(true);
		expect(gesetzt.wer).toBe('Prüflauf');
		expect(gesetzt.wann).toBe(HEUTE);

		await vermerkeVersand(handelnder(betreiber), v.id, false);
		expect(await holeVersandvermerk(betreiber, v.id)).toMatchObject({ gesetzt: false, wer: null });
	});

	it('schreibt beide Richtungen in den Verlauf', async () => {
		const { v } = await faelligeVersammlung('Vermerk im Verlauf');
		await vermerkeVersand(handelnder(betreiber), v.id, true);
		await vermerkeVersand(handelnder(betreiber), v.id, false);

		const e = await ereignisse(v.id);
		expect(e).toHaveLength(2);
		expect(e[0].detail).toMatchObject({ gesetzt: true, weg: 'anwendung' });
		expect(e[1].detail).toMatchObject({ gesetzt: false, weg: 'anwendung' });
		expect(e[0].actor_label).toBe('Prüflauf');
	});

	/*
	 * **Ein zweiter Klick schreibt den ersten Vermerk nicht um** (Code-Review
	 * 02.09.2026). Er kommt aus einem alten Reiter oder von jemand anderem; wer
	 * dann Tag und Person überschreibt, verliert die Angabe, auf die es ankommt:
	 * wann jemand gesagt hat, die Einladung sei hinaus. Der Weg aus der Mail
	 * macht es seit Migration 102 richtig, der Weg in der Anwendung tat es nicht.
	 */
	it('behält Zeitpunkt und Person des ersten Vermerks', async () => {
		const { v } = await faelligeVersammlung('Vermerk zweimal gesetzt');
		await vermerkeVersand(handelnder(betreiber), v.id, true);
		const erst = await holeVersandvermerk(betreiber, v.id);
		const vorher = await zeitpunkt(v.id);

		await vermerkeVersand(
			{ operatorId: betreiber, userId: benutzer, label: 'Jemand anderes' },
			v.id,
			true
		);
		const zweit = await holeVersandvermerk(betreiber, v.id);

		expect(zweit.wer).toBe(erst.wer);
		/*
		 * **Gegen den Zeitstempel, nicht gegen den Kalendertag** (Code-Review
		 * 02.09.2026). `holeVersandvermerk` gibt `wann` als Tag zurück; zwei
		 * Aufrufe im selben Test fallen immer auf denselben Tag, und die
		 * Zusicherung wäre grün, auch wenn der Zeitpunkt überschrieben würde.
		 */
		expect(await zeitpunkt(v.id)).toBe(vorher);
	});

	it('nimmt nach dem Entfernen wieder den neuen Urheber', async () => {
		const { v } = await faelligeVersammlung('Vermerk neu nach Ruecknahme');
		await vermerkeVersand(handelnder(betreiber), v.id, true);
		await vermerkeVersand(handelnder(betreiber), v.id, false);
		await vermerkeVersand(
			{ operatorId: betreiber, userId: benutzer, label: 'Jemand anderes' },
			v.id,
			true
		);

		expect((await holeVersandvermerk(betreiber, v.id)).wer).toBe('Jemand anderes');
	});

	/*
	 * **Die Bedingung der Datenbank ist die letzte Sperre.** Wer beide Spalten
	 * einzeln setzen könnte, hinterliesse einen Vermerk ohne Urheber — und die
	 * Anzeige «Vermerkt am …» stünde ohne den Namen da, der sie beantwortbar
	 * macht.
	 */
	it('lässt keinen Vermerk ohne Urheber zu', async () => {
		const { v } = await faelligeVersammlung('Vermerk ohne Urheber');
		await expect(
			imKontext(betreiber, async (tx) => {
				await tx`UPDATE meeting SET invitation_sent_marked_at = now() WHERE id = ${v.id}`;
			})
		).rejects.toThrow(/meeting_versandvermerk/);
	});
});

describe('Die Marke aus der Erinnerungsmail', () => {
	it('wird als Prüfwert abgelegt, nie im Klartext', async () => {
		const { v } = await faelligeVersammlung('Marke als Pruefwert');
		const klartext = await marke_legen(v.id);

		const abgelegt = await marke(v.id);
		expect(abgelegt).not.toBe(klartext);
		expect(abgelegt).toBe(markenPruefwert(klartext));
	});

	it('setzt beim Einlösen den Vermerk — ohne angemeldeten Betreiber', async () => {
		const { g, v } = await faelligeVersammlung('Marke einloesen');
		const klartext = await marke_legen(v.id);

		const ergebnis = await loeseMarkeEin(klartext);
		expect(ergebnis.ausgang).toBe('gesetzt');
		expect(ergebnis.gemeinschaft).toBe(g.name);

		const stand = await holeVersandvermerk(betreiber, v.id);
		expect(stand.gesetzt).toBe(true);
		// Der Weg steht im Klartext da: Hier war kein Konto beteiligt.
		expect(stand.wer).toBe(WEG_UEBER_LINK);

		const e = await ereignisse(v.id);
		expect(e).toHaveLength(1);
		expect(e[0].detail).toMatchObject({ gesetzt: true, weg: 'link' });
	});

	/*
	 * **Verbraucht heisst verbraucht.** Ein Link, der beliebig oft wirkt, liegt
	 * unbegrenzt lange in einem Postfach — und in dessen Sicherungen.
	 */
	it('gilt nur einmal', async () => {
		const { v } = await faelligeVersammlung('Marke nur einmal');
		const klartext = await marke_legen(v.id);

		expect((await loeseMarkeEin(klartext)).ausgang).toBe('gesetzt');
		expect((await loeseMarkeEin(klartext)).ausgang).toBe('unbekannt');
		expect(await marke(v.id)).toBeNull();
	});

	it('meldet «schon vermerkt», wenn jemand schneller war — und verbraucht sich dabei', async () => {
		const { v } = await faelligeVersammlung('Marke nach Vermerk');
		const klartext = await marke_legen(v.id);
		/*
		 * Der Vermerk in der Anwendung räumt die Marke selbst weg. Für diesen Fall
		 * wird sie danach neu gelegt: gemeint ist der Link aus einer Erinnerung,
		 * die vor dem Vermerk hinausging.
		 */
		await vermerkeVersand(handelnder(betreiber), v.id, true);
		await legeMarkeAb(betreiber, v.id, klartext);

		expect((await loeseMarkeEin(klartext)).ausgang).toBe('schon_vermerkt');
		expect(await marke(v.id)).toBeNull();
		// Kein zweites Ereignis: Es hat sich nichts geändert.
		expect(await ereignisse(v.id)).toHaveLength(1);
	});

	/*
	 * **Der Vorabruf eines Mailservers darf nichts anrichten.** Outlook Safe
	 * Links und Virenprüfer öffnen Links vor der Zustellung; täte das Öffnen
	 * schon den Vermerk, verstummte die Erinnerung, bevor sie jemand liest
	 * (Code-Review 02.09.2026).
	 */
	it('lässt sich ansehen, ohne verbraucht zu werden', async () => {
		const { g, v } = await faelligeVersammlung('Marke ansehen');
		const klartext = await marke_legen(v.id);

		const vorschau = await schauMarkeAn(klartext);
		expect(vorschau?.gemeinschaft).toBe(g.name);
		expect(vorschau?.schonVermerkt).toBe(false);

		// Nichts verändert: weder Vermerk noch Marke.
		expect((await holeVersandvermerk(betreiber, v.id)).gesetzt).toBe(false);
		expect(await marke(v.id)).toBe(markenPruefwert(klartext));
		// Und der Link wirkt danach noch.
		expect((await loeseMarkeEin(klartext)).ausgang).toBe('gesetzt');
	});

	it('zeigt beim Ansehen, wenn schon vermerkt ist', async () => {
		const { v } = await faelligeVersammlung('Marke ansehen nach Vermerk');
		await vermerkeVersand(handelnder(betreiber), v.id, true);
		const klartext = await marke_legen(v.id);

		expect((await schauMarkeAn(klartext))?.schonVermerkt).toBe(true);
	});

	it('gibt beim Ansehen einer erfundenen Marke nichts heraus', async () => {
		expect(await schauMarkeAn('DieseMarkeGabEsNie_0123456789abcdef')).toBeNull();
	});

	it('weist eine erfundene Marke ab, ohne etwas zu ändern', async () => {
		const ergebnis = await loeseMarkeEin('DieseMarkeGabEsNie_0123456789abcdef');
		expect(ergebnis.ausgang).toBe('unbekannt');
		expect(ergebnis.gemeinschaft).toBeNull();
	});

	/*
	 * **Ein Vermerk in der Anwendung entwertet den alten Link.** Sonst hielte
	 * eine Wochen alte Mail dagegen: Wer den Vermerk bewusst entfernt hat, sieht
	 * ihn nach einem Klick im Postfach wieder stehen.
	 */
	it('wird durch einen Vermerk in der Anwendung entwertet', async () => {
		const { v } = await faelligeVersammlung('Marke entwertet');
		const klartext = await marke_legen(v.id);

		await vermerkeVersand(handelnder(betreiber), v.id, true);
		await vermerkeVersand(handelnder(betreiber), v.id, false);

		expect((await loeseMarkeEin(klartext)).ausgang).toBe('unbekannt');
		expect((await holeVersandvermerk(betreiber, v.id)).gesetzt).toBe(false);
	});

	/*
	 * **Ein folgenloses Speichern entwertet sie nicht** (02.09.2026, zweite Runde
	 * des Code-Reviews zu Block 5).
	 *
	 * Seit das Kästchen auf der Vorbereitungsseite selbst sendet, lässt sich der
	 * Knopf drücken, ohne etwas zu ändern — vorher schickte ein verstecktes Feld
	 * immer das Gegenteil des Bestandes, und der Fall gab es nicht. Er lief
	 * durch: Der Einmallink der schon verschickten Erinnerung war danach wertlos,
	 * und im Verlauf stand ein Eintrag über einen Vorgang, der nichts vermerkt
	 * hat.
	 *
	 * Der Absatz über `vermerkeVersand` begründet das Verbrauchen der Marke mit
	 * «nach einer Aussage in der Anwendung». Kein Zustandswechsel, keine Aussage.
	 */
	it('bleibt gültig, wenn ein Speichern nichts ändert', async () => {
		const { v } = await faelligeVersammlung('Marke bleibt');
		const klartext = await marke_legen(v.id);

		// Der Vermerk steht nicht — «nicht vermerkt» noch einmal zu speichern
		// ändert nichts und darf deshalb auch nichts verbrauchen.
		await vermerkeVersand(handelnder(betreiber), v.id, false);

		expect(await marke(v.id)).not.toBeNull();
		expect((await ereignisse(v.id)).length).toBe(0);
		expect((await loeseMarkeEin(klartext)).ausgang).toBe('gesetzt');
	});

	/*
	 * **Und dieselbe Grenze in der anderen Richtung.** Ein zweiter Klick auf
	 * einen schon gesetzten Vermerk ändert nichts: kein neuer Verlaufseintrag
	 * über eine Aussage, die schon steht.
	 */
	it('schreibt keinen Verlauf, wenn der Vermerk schon steht', async () => {
		const { v } = await faelligeVersammlung('Zweiter Klick');

		await vermerkeVersand(handelnder(betreiber), v.id, true);
		expect((await ereignisse(v.id)).length).toBe(1);

		await vermerkeVersand(handelnder(betreiber), v.id, true);
		expect((await ereignisse(v.id)).length).toBe(1);
	});
});

describe('Der Erinnerungslauf mit Vermerk', () => {
	it('schweigt, sobald der Versand vermerkt ist', async () => {
		const { v } = await faelligeVersammlung('Erinnerung mit Vermerk');
		await vermerkeVersand(handelnder(betreiber), v.id, true);

		const post = briefkasten();
		const bericht = await erinnerungslauf({ heute: HEUTE, versende: post.versende });

		expect(post.gesammelt.some((m) => m.text.includes('Erinnerung mit Vermerk'))).toBe(false);
		/*
		 * **Ein Regelfall, kein Befund.** Der Bericht führt unter `uebersprungen`
		 * nur, was jemand ansehen sollte — eine fehlende Adresse etwa. Dass eine
		 * Einladung hinaus ist, ist der erwünschte Ausgang und zählt still.
		 */
		expect(bericht.stillGelassen).toBeGreaterThan(0);
		expect(bericht.uebersprungen.some((u) => u.includes(v.id))).toBe(false);
		// Und der Merker bleibt frei: Es wurde nichts beansprucht.
		expect(await merkerFrei(v.id)).toBe(true);
	});

	it('erinnert wieder, wenn der Vermerk entfernt wird', async () => {
		const { v } = await faelligeVersammlung('Erinnerung nach Ruecknahme');
		await vermerkeVersand(handelnder(betreiber), v.id, true);
		await erinnerungslauf({ heute: HEUTE, versende: briefkasten().versende });

		await vermerkeVersand(handelnder(betreiber), v.id, false);
		const post = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: post.versende });

		expect(post.gesammelt.some((m) => m.text.includes('Erinnerung nach Ruecknahme'))).toBe(true);
	});

	/*
	 * **Der Link in der Mail muss zur abgelegten Marke passen.** Ein Test, der
	 * nur prüft, dass irgendein Link dasteht, wäre grün, während der Klick ins
	 * Leere führt.
	 *
	 * **Geprüft wird gegen `festeHerkunft()`, nicht gegen eine gesetzte
	 * Umgebungsvariable** (02.09.2026): `$env/dynamic/private` liest die Umgebung
	 * beim Laden des Moduls, nicht bei jedem Zugriff. Ein Test, der `process.env`
	 * mitten im Lauf umstellt, misst deshalb etwas anderes als der Betrieb — er
	 * war grün, während die Anwendung eine andere Adresse benutzte. Der Fall
	 * «keine Adresse gesetzt» steht als Kerntest in `tests/domain/mailversand`.
	 */
	it('trägt einen Link, dessen Marke zur abgelegten passt', async () => {
		const basis = festeHerkunft();
		expect(basis, 'ORIGIN muss im Prüflauf gesetzt sein').not.toBeNull();

		const { v } = await faelligeVersammlung('Erinnerung mit Link');
		const post = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: post.versende });

		const mail = post.gesammelt.find((m) => m.text.includes('Erinnerung mit Link'));
		expect(mail).toBeDefined();

		const gefunden = new RegExp(`${basis}/b/([A-Za-z0-9_-]+)`).exec(mail!.text);
		expect(gefunden, `kein Link auf ${basis} im Text`).not.toBeNull();
		// Der Schrägstrich am Ende von ORIGIN darf nicht durchschlagen.
		expect(mail!.text).not.toContain('//b/');
		expect(await marke(v.id)).toBe(markenPruefwert(gefunden![1]));

		// Und er wirkt: Der Klick setzt den Vermerk.
		expect((await loeseMarkeEin(gefunden![1])).ausgang).toBe('gesetzt');
	});

	/*
	 * **Ein misslungener Versand darf den Link der letzten Erinnerung nicht
	 * entwerten** (Code-Review 02.09.2026). Je Versammlung gilt nur eine Marke;
	 * würde sie vor dem Versand abgelegt, stünde der Empfänger nach einem
	 * Fehlschlag mit einem toten Link da und bekäme keine neue Mail.
	 */
	it('legt die neue Marke erst nach gelungenem Versand ab', async () => {
		const { v } = await faelligeVersammlung('Erinnerung mit Fehlschlag');
		const alte = await marke_legen(v.id);

		await erinnerungslauf({
			heute: HEUTE,
			versende: async () => {
				throw new Error('Mailserver nicht erreichbar');
			}
		});

		expect(await marke(v.id)).toBe(markenPruefwert(alte));
		expect((await loeseMarkeEin(alte)).ausgang).toBe('gesetzt');
	});
});
