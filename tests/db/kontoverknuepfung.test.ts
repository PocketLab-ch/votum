/**
 * Die Erstverknüpfung mit Authentik am echten Riegel.
 *
 * **Warum das in die Datenbank gehört.** Die Entscheidung selbst ist eine reine
 * Funktion und dort mit einer Wertetabelle belegt
 * (`tests/domain/kontoverknuepfung.test.ts`). Was sie nicht zeigen kann: ob das
 * `UPDATE`, das die Verknüpfung wirklich schreibt, dieselben Bedingungen trägt.
 * Genau dort lag die Fehlerklasse, die in diesem Haus mehrfach aufgetreten ist —
 * die Oberfläche prüfte, der Server nicht.
 *
 * **Was ein grüner Lauf hier beweist, und was nicht** (gemessen am 15.09.2026
 * mit beschädigten Ständen). Jede Schranke steht zweimal: als Entscheidung in
 * `darfErstverknuepfen` und als Bedingung im `UPDATE`. Hebelt man **eine** von
 * beiden aus, bleiben diese Tests grün — die andere fängt es auf. Das ist die
 * Absicht hinter der Doppelung, aber es heisst auch: Ein grüner Lauf hier sagt
 * «niemand kommt durch», nicht «beide Riegel sind heil».
 *
 * Wer eine der beiden Schichten umbaut, prüft sie deshalb dort, wo sie allein
 * steht: die Entscheidung in `tests/domain/kontoverknuepfung.test.ts`, den
 * `UPDATE`-Riegel durch eine Gegenprobe mit ausgehebelter Entscheidung.
 *
 * **Und eine Frage vom Auftraggeber** (15.09.2026): «Was ist, wenn jemand heiratet und
 * den Namen ändert?» Die Antwort steht unten als Prüfung, nicht als Behauptung.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findeBenutzer } from '$lib/server/authentik';
import {
	aendereRolle,
	holeKonten,
	legeKontoAn,
	setzeAngaben,
	setzeAusserDienst,
	setzeVerknuepfungsfenster,
	loeseVerknuepfung,
	holeEigenesKonto
} from '$lib/server/benutzer';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fensterEnde } from '$lib/domain/kontoverknuepfung';
import { admin, pruefbetreiber, pruefbenutzer, verbindungenSchliessen } from './helfer';

let betreiber: string;
let verwalter: string;

function wer() {
	return { operatorId: betreiber, userId: verwalter, label: 'Prüflauf Verwaltung' };
}

/** Eine Authentik-Person, wie sie vom Dienst zurückkäme. */
function person(u: { sub: string; name?: string; email?: string | null }) {
	return {
		subject: u.sub,
		benutzername: u.sub,
		anzeigename: u.name ?? 'Prüflauf Person',
		email: u.email === undefined ? 'prueflauf@example.ch' : u.email
	};
}

/**
 * Legt ein Konto unmittelbar an, mit frei wählbarem Fenster.
 *
 * Über die privilegierte Verbindung und nicht über `legeKontoAn`: Hier sollen
 * gerade die Stände herstellbar sein, die der reguläre Weg nicht erzeugt — ein
 * abgelaufenes Fenster etwa.
 */
async function konto(u: {
	username: string;
	email: string | null;
	offenBis: Date | null;
	kennung?: string | null;
	name?: string;
}): Promise<string> {
	const [z] = await admin<{ id: string }[]>`
		INSERT INTO app_user (operator_id, username, display_name, password_hash, role,
		                      email, oidc_link_until, oidc_subject)
		VALUES (${betreiber}, ${u.username}, ${u.name ?? 'Prüflauf ' + u.username}, 'x', 'chair',
		        ${u.email}, ${u.offenBis}, ${u.kennung ?? null})
		RETURNING id
	`;
	return z.id;
}

async function standVon(kontoId: string) {
	const [z] = await admin<
		{ oidc_subject: string | null; oidc_link_until: Date | null; display_name: string }[]
	>`SELECT oidc_subject, oidc_link_until, display_name FROM app_user WHERE id = ${kontoId}`;
	return z;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Prüflauf Verknüpfung');
	verwalter = await pruefbenutzer(betreiber, 'prueflauf-verwaltung');
	await admin`UPDATE app_user SET role = 'admin' WHERE id = ${verwalter}`;
});

afterAll(verbindungenSchliessen);

describe('Erstverknüpfung über die Adresse', () => {
	it('verbindet im offenen Fenster und schliesst es dabei', async () => {
		const id = await konto({
			username: 'prueflauf-offen',
			email: 'offen@example.ch',
			offenBis: fensterEnde(new Date())
		});

		const gefunden = await findeBenutzer(person({ sub: 'kennung-offen', email: 'offen@example.ch' }));
		expect(gefunden?.id).toBe(id);

		const nachher = await standVon(id);
		expect(nachher.oidc_subject).toBe('kennung-offen');
		// **Das Fenster ist danach zu.** Sonst könnte eine zweite Kennung
		// nachrücken, und das Konto gehörte dem, der zuletzt kam.
		expect(nachher.oidc_link_until).toBeNull();
	});

	it('schreibt die Verknüpfung in den Verlauf', async () => {
		const id = await konto({
			username: 'prueflauf-verlauf',
			email: 'verlauf@example.ch',
			offenBis: fensterEnde(new Date())
		});
		await findeBenutzer(person({ sub: 'kennung-verlauf', email: 'verlauf@example.ch' }));

		const eintraege = await admin<{ event_type: string }[]>`
			SELECT event_type FROM audit_entry
			WHERE subject_type = 'app_user' AND subject_id = ${id}
		`;
		expect(eintraege.map((e) => e.event_type)).toContain('user.link.established');
	});

	it('weist ein abgelaufenes Fenster ab', async () => {
		const id = await konto({
			username: 'prueflauf-abgelaufen',
			email: 'abgelaufen@example.ch',
			offenBis: new Date(Date.now() - 60_000)
		});

		expect(
			await findeBenutzer(person({ sub: 'kennung-ab', email: 'abgelaufen@example.ch' }))
		).toBeNull();
		expect((await standVon(id)).oidc_subject).toBeNull();
	});

	it('weist ab, wo nie ein Fenster geöffnet wurde', async () => {
		const id = await konto({
			username: 'prueflauf-zu',
			email: 'zu@example.ch',
			offenBis: null
		});

		expect(await findeBenutzer(person({ sub: 'kennung-zu', email: 'zu@example.ch' }))).toBeNull();
		expect((await standVon(id)).oidc_subject).toBeNull();
	});

	it('weist ein Konto ausser Dienst ab, obwohl sein Fenster offensteht', async () => {
		const id = await konto({
			username: 'prueflauf-ausserdienst',
			email: 'ausserdienst@example.ch',
			offenBis: fensterEnde(new Date())
		});
		await admin`UPDATE app_user SET disabled_at = now() WHERE id = ${id}`;

		expect(
			await findeBenutzer(person({ sub: 'kennung-ad', email: 'ausserdienst@example.ch' }))
		).toBeNull();
		expect((await standVon(id)).oidc_subject).toBeNull();
	});

	/**
	 * **Die Gegenprobe zum Umbau vom 15.09.2026.**
	 *
	 * Vorher fand die Erstverknüpfung über den Benutzernamen. Bliebe dieser Weg
	 * versehentlich stehen, wäre die ganze Fensterschranke wirkungslos: Der
	 * Benutzername steht dauerhaft und kennt kein Fenster.
	 */
	it('findet NICHT mehr über den Benutzernamen', async () => {
		const id = await konto({
			username: 'prueflauf-namensweg',
			email: 'namensweg@example.ch',
			offenBis: fensterEnde(new Date())
		});

		// Derselbe Benutzername, aber eine andere Adresse: Über den Namen wäre das
		// ein Treffer, über die Adresse ist es keiner.
		const gefunden = await findeBenutzer({
			subject: 'kennung-namensweg',
			benutzername: 'prueflauf-namensweg',
			anzeigename: 'Prüflauf Namensweg',
			email: 'jemand.anders@example.ch'
		});
		expect(gefunden).toBeNull();
		expect((await standVon(id)).oidc_subject).toBeNull();
	});

	/**
	 * **Der Riegel im `UPDATE`, nicht der in der Prüfung darüber.**
	 *
	 * Die reine Funktion entscheidet über einen Stand, den sie gelesen hat. Zwei
	 * Anläufe zugleich lesen beide denselben offenen Stand, und beide dürften
	 * danach. Nur die Bedingung im `UPDATE` selbst entscheidet dann, wer wirklich
	 * schreibt — und ohne sie gehörte das Konto dem, der zuletzt kam.
	 */
	it('lässt bei zwei gleichzeitigen Anläufen nur einen durch', async () => {
		const id = await konto({
			username: 'prueflauf-wettlauf',
			email: 'wettlauf@example.ch',
			offenBis: fensterEnde(new Date())
		});

		const [a, b] = await Promise.all([
			findeBenutzer(person({ sub: 'kennung-wett-a', email: 'wettlauf@example.ch' })),
			findeBenutzer(person({ sub: 'kennung-wett-b', email: 'wettlauf@example.ch' }))
		]);

		expect([a, b].filter(Boolean)).toHaveLength(1);
		const nachher = await standVon(id);
		expect(['kennung-wett-a', 'kennung-wett-b']).toContain(nachher.oidc_subject);
		expect(nachher.oidc_link_until).toBeNull();
	});

	it('weist einen zweiten Anlauf ab, nachdem die Verknüpfung steht', async () => {
		await konto({
			username: 'prueflauf-zweitanlauf',
			email: 'zweitanlauf@example.ch',
			offenBis: fensterEnde(new Date())
		});
		expect(
			await findeBenutzer(person({ sub: 'kennung-erst', email: 'zweitanlauf@example.ch' }))
		).not.toBeNull();
		// Dieselbe Adresse, andere Kennung: Das Fenster ist zu, die Adresse gehört
		// jetzt einer Kennung.
		expect(
			await findeBenutzer(person({ sub: 'kennung-zweit', email: 'zweitanlauf@example.ch' }))
		).toBeNull();
	});

	/**
	 * **Die Kennung klebt an genau einem Konto, über alle Betreiber hinweg.**
	 *
	 * Aus dem Code-Review vom 15.09.2026: Solange die Suche nach der Kennung
	 * Konten ausser Dienst wegfilterte, fiel die Anmeldung auf den Adressweg
	 * zurück und hängte dieselbe Kennung an ein zweites Konto. Der Index
	 * `app_user_oidc_subject_idx` ist aber global eindeutig — was ankam, war
	 * nicht «kein Zutritt», sondern «Authentik ist nicht erreichbar».
	 */
	it('weist ab, wenn die Kennung an einem Konto ausser Dienst hängt', async () => {
		const alt = await konto({
			username: 'prueflauf-altkonto',
			email: 'wiedereintritt-alt@example.ch',
			offenBis: null,
			kennung: 'kennung-wiedereintritt'
		});
		await admin`UPDATE app_user SET disabled_at = now() WHERE id = ${alt}`;

		const neu = await konto({
			username: 'prueflauf-neukonto',
			email: 'wiedereintritt-neu@example.ch',
			offenBis: fensterEnde(new Date())
		});

		const gefunden = await findeBenutzer(
			person({ sub: 'kennung-wiedereintritt', email: 'wiedereintritt-neu@example.ch' })
		);
		expect(gefunden).toBeNull();
		// Entscheidend: Das neue Konto hat die Kennung NICHT bekommen. Sonst
		// schlüge der globale Index zu, und zwar als roher Fehler.
		expect((await standVon(neu)).oidc_subject).toBeNull();
	});

	/**
	 * **Dieselbe Adresse bei zwei Betreibern führt nirgendwohin.**
	 *
	 * Aus dem Code-Review vom 15.09.2026: `app_user_email_eindeutig` gilt je
	 * Betreiber, die Suche beim Anmelden läuft ohne Betreiber. Mit `LIMIT 1`
	 * entschiede die Reihenfolge in der Tabelle, in welchen Mandanten ein Mensch
	 * gerät — und seine Kennung bliebe danach dort.
	 */
	it('weist ab, wenn dieselbe Adresse zu zwei Betreibern führt', async () => {
		const zweiter = await pruefbetreiber('Prüflauf Zweiter Betreiber');
		const [a] = await admin<{ id: string }[]>`
			INSERT INTO app_user (operator_id, username, display_name, password_hash, role,
			                      email, oidc_link_until)
			VALUES (${betreiber}, 'prueflauf-doppel-a', 'Prüflauf Doppel A', 'x', 'chair',
			        'doppelt@example.ch', ${fensterEnde(new Date())})
			RETURNING id`;
		const [b] = await admin<{ id: string }[]>`
			INSERT INTO app_user (operator_id, username, display_name, password_hash, role,
			                      email, oidc_link_until)
			VALUES (${zweiter}, 'prueflauf-doppel-b', 'Prüflauf Doppel B', 'x', 'chair',
			        'doppelt@example.ch', ${fensterEnde(new Date())})
			RETURNING id`;

		expect(
			await findeBenutzer(person({ sub: 'kennung-doppelt', email: 'doppelt@example.ch' }))
		).toBeNull();
		expect((await standVon(a.id)).oidc_subject).toBeNull();
		expect((await standVon(b.id)).oidc_subject).toBeNull();
	});

	it('lässt einen leeren Namen aus Authentik den erfassten nicht überschreiben', async () => {
		const id = await konto({
			username: 'prueflauf-namenlos',
			email: 'namenlos@example.ch',
			offenBis: null,
			kennung: 'kennung-namenlos',
			name: 'Von der Verwaltung erfasst'
		});

		await findeBenutzer({
			subject: 'kennung-namenlos',
			benutzername: 'prueflauf-namenlos',
			anzeigename: '   ',
			email: 'namenlos@example.ch'
		});
		expect((await standVon(id)).display_name).toBe('Von der Verwaltung erfasst');
	});

	/**
	 * **Ein vergeblicher Versuch darf nicht spurlos sein** (Sicherheitsprüfung
	 * 15.09.2026). Sonst kostet er nichts: Wer seine Adresse in Authentik auf die
	 * einer Verwaltung setzt, meldet sich täglich an und nimmt die nächste
	 * Öffnung des Fensters mit. Die Wette geht auf, weil niemand die
	 * Fehlversuche sieht.
	 */
	it('vermerkt einen abgewiesenen Versuch am betroffenen Konto', async () => {
		const id = await konto({
			username: 'prueflauf-spur',
			email: 'spur@example.ch',
			offenBis: null
		});
		expect(await findeBenutzer(person({ sub: 'kennung-spur', email: 'spur@example.ch' }))).toBeNull();

		const eintraege = await admin<{ event_type: string; detail: { grund?: string } }[]>`
			SELECT event_type, detail FROM audit_entry
			WHERE subject_type = 'app_user' AND subject_id = ${id}
		`;
		const abweisung = eintraege.find((e) => e.event_type === 'user.link.rejected');
		expect(abweisung).toBeDefined();
		expect(abweisung?.detail.grund).toBe('kein_fenster');
	});

	it('lässt einen leeren Namen auch bei der Erstverknüpfung stehen', async () => {
		const id = await konto({
			username: 'prueflauf-leernameneu',
			email: 'leernameneu@example.ch',
			offenBis: fensterEnde(new Date()),
			name: 'Von der Verwaltung erfasst'
		});
		const gefunden = await findeBenutzer({
			subject: 'kennung-leernameneu',
			benutzername: 'prueflauf-leernameneu',
			anzeigename: '',
			email: 'leernameneu@example.ch'
		});
		expect(gefunden?.displayName).toBe('Von der Verwaltung erfasst');
		expect((await standVon(id)).display_name).toBe('Von der Verwaltung erfasst');
	});

	it('weist ab, wenn Authentik keine Adresse liefert', async () => {
		await konto({
			username: 'prueflauf-ohnemail',
			email: 'ohnemail@example.ch',
			offenBis: fensterEnde(new Date())
		});
		expect(await findeBenutzer(person({ sub: 'kennung-ohne', email: null }))).toBeNull();
	});

	it('findet über die Kennung und zieht den Namen aus Authentik nach', async () => {
		const id = await konto({
			username: 'prueflauf-kennung',
			email: 'kennung@example.ch',
			offenBis: null,
			kennung: 'kennung-fest',
			name: 'Alter Name'
		});

		const gefunden = await findeBenutzer(
			person({ sub: 'kennung-fest', name: 'Neuer Name', email: 'kennung@example.ch' })
		);
		expect(gefunden?.id).toBe(id);
		// Der zurückgegebene Name ist der neue — sonst trüge ausgerechnet diese
		// Anmeldung ihre Verlaufseinträge noch unter dem alten.
		expect(gefunden?.displayName).toBe('Neuer Name');
		expect((await standVon(id)).display_name).toBe('Neuer Name');
	});
});

describe('Das Fenster führen', () => {
	it('öffnet und schliesst', async () => {
		const id = await konto({
			username: 'prueflauf-fuehren',
			email: 'fuehren@example.ch',
			offenBis: null
		});

		const auf = await setzeVerknuepfungsfenster(wer(), id, true);
		expect(auf.offenBis).not.toBeNull();
		expect((await standVon(id)).oidc_link_until).not.toBeNull();

		const zu = await setzeVerknuepfungsfenster(wer(), id, false);
		expect(zu.offenBis).toBeNull();
		expect((await standVon(id)).oidc_link_until).toBeNull();
	});

	it('öffnet nicht ohne Adresse', async () => {
		const id = await konto({ username: 'prueflauf-leer', email: null, offenBis: null });
		await expect(setzeVerknuepfungsfenster(wer(), id, true)).rejects.toThrow(FachlicherFehler);
	});

	it('öffnet nicht für ein bereits verknüpftes Konto', async () => {
		const id = await konto({
			username: 'prueflauf-schon',
			email: 'schon@example.ch',
			offenBis: null,
			kennung: 'kennung-schon'
		});
		await expect(setzeVerknuepfungsfenster(wer(), id, true)).rejects.toThrow(FachlicherFehler);
	});
});

describe('Anlegen', () => {
	it('öffnet das Fenster mit, wenn eine Adresse dabei ist', async () => {
		const k = await legeKontoAn(wer(), {
			username: 'prueflauf-neu',
			displayName: 'Prüflauf Neu',
			email: 'Neu@Example.CH',
			rolle: 'chair',
			kennwort: 'wolke turm ziegel morgen',
			wiederholung: 'wolke turm ziegel morgen'
		});
		expect(k.verknuepfungOffenBis).not.toBeNull();
		// Kleingeschrieben abgelegt, sonst fände die Anmeldung sie nicht wieder.
		expect(k.email).toBe('neu@example.ch');
	});

	it('legt ohne Adresse an, aber ohne Fenster', async () => {
		const k = await legeKontoAn(wer(), {
			username: 'prueflauf-lokal',
			displayName: 'Prüflauf Lokal',
			email: '',
			rolle: 'chair',
			kennwort: 'wolke turm ziegel morgen',
			wiederholung: 'wolke turm ziegel morgen'
		});
		expect(k.email).toBeNull();
		expect(k.verknuepfungOffenBis).toBeNull();
	});

	it('weist eine Adresse ab, die schon einem Konto gehört — mit einem Satz statt einer 500', async () => {
		await konto({
			username: 'prueflauf-erster',
			email: 'geteilt@example.ch',
			offenBis: null
		});
		await expect(
			legeKontoAn(wer(), {
				username: 'prueflauf-zweiter',
				displayName: 'Prüflauf Zweiter',
				email: 'geteilt@example.ch',
				rolle: 'chair',
				kennwort: 'wolke turm ziegel morgen',
				wiederholung: 'wolke turm ziegel morgen'
			})
		).rejects.toThrow(FachlicherFehler);
	});

	it('weist etwas ab, das keine Adresse ist', async () => {
		await expect(
			legeKontoAn(wer(), {
				username: 'prueflauf-keinemail',
				displayName: 'Prüflauf Keine',
				email: 'prueflauf-keinemail',
				rolle: 'chair',
				kennwort: 'wolke turm ziegel morgen',
				wiederholung: 'wolke turm ziegel morgen'
			})
		).rejects.toThrow(FachlicherFehler);
	});
});

describe('Wenn jemand heiratet', () => {
	/**
	 * **Frage des Auftraggebers vom 15.09.2026, als Messung.**
	 *
	 * Zwei Dinge müssen zugleich gelten, und sie widersprechen einander nur
	 * scheinbar: Künftige Handlungen tragen den neuen Namen, bereits geschriebene
	 * Einträge den alten. Ein Protokoll, das rückwirkend umbenennt, behauptet,
	 * jemand habe im März unter einem Namen gehandelt, den er damals nicht trug.
	 */
	it('ändert den Namen künftig, ohne alte Einträge anzufassen', async () => {
		const id = await konto({
			username: 'prueflauf-heirat',
			email: 'heirat@example.ch',
			offenBis: null,
			name: 'Prüflauf Ledigname'
		});

		// Eine Handlung unter dem alten Namen.
		await aendereRolle(
			{ operatorId: betreiber, userId: id, label: 'Prüflauf Ledigname' },
			id,
			'admin'
		);

		await setzeAngaben(wer(), id, 'Prüflauf Ehename', 'heirat@example.ch');

		expect((await standVon(id)).display_name).toBe('Prüflauf Ehename');

		const alte = await admin<{ actor_label: string }[]>`
			SELECT actor_label FROM audit_entry
			WHERE subject_type = 'app_user' AND subject_id = ${id} AND event_type = 'user.role.changed'
		`;
		expect(alte.map((z) => z.actor_label)).toEqual(['Prüflauf Ledigname']);
	});

	it('nimmt die Adresse nicht zwei Konten gleichzeitig', async () => {
		const a = await konto({ username: 'prueflauf-a', email: 'a@example.ch', offenBis: null });
		await konto({ username: 'prueflauf-b', email: 'b@example.ch', offenBis: null });
		await expect(setzeAngaben(wer(), a, 'Prüflauf A', 'b@example.ch')).rejects.toThrow(
			FachlicherFehler
		);
	});

	/**
	 * **Eine geänderte Adresse schliesst das Fenster** (Sicherheitsprüfung
	 * 15.09.2026). Dieser Test prüfte zuerst das Gegenteil, mit der Begründung,
	 * eine Korrektur solle keine Freigabe sein. Das war verkehrt herum gedacht:
	 * Das Fenster steht für eine **Adresse** offen, nicht für ein Konto. Bliebe
	 * es beim Wechsel stehen, gälte es ab sofort für die neue — und wer die
	 * Korrektur vornimmt, hätte damit unbeabsichtigt jemand anderem die Tür
	 * geöffnet.
	 */
	it('schliesst das Fenster, wenn die Adresse wechselt', async () => {
		const id = await konto({
			username: 'prueflauf-korrektur',
			email: 'tippfehler@example.ch',
			offenBis: fensterEnde(new Date())
		});
		await setzeAngaben(wer(), id, 'Prüflauf Korrektur', 'richtig@example.ch');
		expect((await standVon(id)).oidc_link_until).toBeNull();
	});

	it('lässt das Fenster stehen, wenn nur der Name wechselt', async () => {
		const bis = fensterEnde(new Date());
		const id = await konto({
			username: 'prueflauf-nurname',
			email: 'nurname@example.ch',
			offenBis: bis
		});
		await setzeAngaben(wer(), id, 'Prüflauf Neuer Name', 'nurname@example.ch');
		expect((await standVon(id)).oidc_link_until?.toISOString()).toBe(bis.toISOString());
	});
});

describe('Die Liste', () => {
	it('zeigt Adresse und Fenster je Konto', async () => {
		const id = await konto({
			username: 'prueflauf-liste',
			email: 'liste@example.ch',
			offenBis: fensterEnde(new Date())
		});
		const konten = await holeKonten(betreiber);
		const eintrag = konten.find((k) => k.id === id);
		expect(eintrag?.email).toBe('liste@example.ch');
		expect(eintrag?.verknuepfungOffenBis).not.toBeNull();
		expect(eintrag?.ueberAuthentik).toBe(false);
	});

	it('nennt ein Konto ausser Dienst weiterhin mit seiner Adresse', async () => {
		const id = await konto({
			username: 'prueflauf-ruhend',
			email: 'ruhend@example.ch',
			offenBis: null
		});
		await setzeAusserDienst(wer(), id, true);
		const eintrag = (await holeKonten(betreiber)).find((k) => k.id === id);
		expect(eintrag?.ausserDienstSeit).not.toBeNull();
		expect(eintrag?.email).toBe('ruhend@example.ch');
	});
});

describe('Die Verknüpfung wieder lösen', () => {
	/** Ein Konto mit Kennung und Kennwort, dazu zwei angemeldete Geräte. */
	async function verknuepftesKonto(username: string, mitKennwort = true) {
		const [z] = await admin<{ id: string }[]>`
			INSERT INTO app_user (operator_id, username, display_name, password_hash, role,
			                      email, oidc_subject)
			VALUES (${betreiber}, ${username}, ${'Prüflauf ' + username},
			        ${mitKennwort ? 'x' : null}, 'chair',
			        ${username + '@example.ch'}, ${'kennung-' + username})
			RETURNING id`;
		for (const marke of ['a', 'b']) {
			await admin`
				INSERT INTO user_session (user_id, token_hash, expires_at)
				VALUES (${z.id}, ${username + '-' + marke}, now() + interval '2 hours')`;
		}
		return z.id;
	}

	it('löst die Kennung und beendet die Sitzungen', async () => {
		const id = await verknuepftesKonto('prueflauf-loesen');
		const { entwertet } = await loeseVerknuepfung(wer(), id);
		expect(entwertet).toBe(2);
		expect((await standVon(id)).oidc_subject).toBeNull();
	});

	it('schont die eigene Sitzung, wenn sie genannt ist', async () => {
		const id = await verknuepftesKonto('prueflauf-selbst');
		const { entwertet } = await loeseVerknuepfung(wer(), id, 'prueflauf-selbst-a');
		expect(entwertet).toBe(1);
		const [offen] = await admin<{ n: string }[]>`
			SELECT count(*) AS n FROM user_session
			WHERE user_id = ${id} AND revoked_at IS NULL`;
		expect(Number(offen.n)).toBe(1);
	});

	it('schreibt den Vorgang in den Verlauf', async () => {
		const id = await verknuepftesKonto('prueflauf-loesenverlauf');
		await loeseVerknuepfung(wer(), id);
		const eintraege = await admin<{ event_type: string }[]>`
			SELECT event_type FROM audit_entry
			WHERE subject_type = 'app_user' AND subject_id = ${id}`;
		expect(eintraege.map((e) => e.event_type)).toContain('user.link.released');
	});

	/**
	 * **Die Schranke, die ein Konto am Leben hält.** Ohne Kennwort und ohne
	 * Kennung käme niemand mehr herein — nicht gesperrt, sondern unerreichbar.
	 */
	it('verweigert das Lösen bei einem Konto ohne Kennwort', async () => {
		const id = await verknuepftesKonto('prueflauf-ohnekennwort', false);
		await expect(loeseVerknuepfung(wer(), id)).rejects.toThrow(FachlicherFehler);
		expect((await standVon(id)).oidc_subject).toBe('kennung-prueflauf-ohnekennwort');
	});

	it('weist ab, wo es nichts zu lösen gibt', async () => {
		const id = await konto({
			username: 'prueflauf-unverknuepft',
			email: 'unverknuepft@example.ch',
			offenBis: null
		});
		await expect(loeseVerknuepfung(wer(), id)).rejects.toThrow(FachlicherFehler);
	});

	/**
	 * **Die Sackgasse, die der Code-Review am 16.09.2026 gefunden hat.**
	 *
	 * Die Absage «kein Kennwort hinterlegt» empfahl, das Konto ausser Dienst zu
	 * stellen. Wer dem folgte, konnte die Kennung danach überhaupt nicht mehr
	 * lösen — und weil `app_user_oidc_subject_idx` über alle Betreiber eindeutig
	 * ist, hätte dieser Mensch nie wieder ein verknüpftes Konto bekommen. Eine
	 * Absage, deren Ausweg in die Falle führt, ist schlimmer als keine.
	 */
	it('löst auch ohne Kennwort, sobald das Konto ausser Dienst steht', async () => {
		const id = await verknuepftesKonto('prueflauf-sackgasse', false);
		await expect(loeseVerknuepfung(wer(), id)).rejects.toThrow(FachlicherFehler);

		await setzeAusserDienst(wer(), id, true);
		await loeseVerknuepfung(wer(), id);
		expect((await standVon(id)).oidc_subject).toBeNull();
	});

	/**
	 * **Und zwar nur auf diesem Weg** (16.09.2026, nach beiden Prüfungen). Die
	 * Kennung wird hier wirklich frei, weil das Ausserdienststellen eine bewusste
	 * Verwaltungshandlung an einem toten Konto ist — niemand kann sich selbst
	 * ausser Dienst stellen. Wer dagegen an einem Konto **im Dienst** löst,
	 * hinterlässt eine Spur, und die Kennung kommt an kein fremdes Konto mehr
	 * (siehe der Block ganz unten).
	 */
	it('gibt die Kennung danach für ein anderes Konto frei', async () => {
		const alt = await verknuepftesKonto('prueflauf-freigabe-alt', false);
		await setzeAusserDienst(wer(), alt, true);
		await loeseVerknuepfung(wer(), alt);

		// Dieselbe Person, neues Konto: Der globale Index hält jetzt nichts mehr auf.
		const neu = await konto({
			username: 'prueflauf-freigabe-neu',
			email: 'freigabe-neu@example.ch',
			offenBis: fensterEnde(new Date())
		});
		const gefunden = await findeBenutzer(
			person({ sub: 'kennung-prueflauf-freigabe-alt', email: 'freigabe-neu@example.ch' })
		);
		expect(gefunden?.id).toBe(neu);
	});

	/**
	 * **Das Fenster geht beim Lösen NICHT auf.** Sonst wäre das Lösen unbemerkt
	 * zugleich eine Freigabe für die nächste Person, die diese Adresse trägt.
	 */
	it('öffnet dabei kein Anmeldefenster', async () => {
		const id = await verknuepftesKonto('prueflauf-keinfenster');
		await loeseVerknuepfung(wer(), id);
		expect((await standVon(id)).oidc_link_until).toBeNull();
	});

	it('meldet den Stand auch der eigenen Kontoseite', async () => {
		const id = await verknuepftesKonto('prueflauf-eigenesicht');
		const vorher = await holeEigenesKonto(betreiber, id);
		expect(vorher?.ueberAuthentik).toBe(true);
		expect(vorher?.hatKennwort).toBe(true);
		await loeseVerknuepfung(wer(), id);
		expect((await holeEigenesKonto(betreiber, id))?.ueberAuthentik).toBe(false);
	});

	it('lässt ein gelöstes Konto wieder verknüpfen, sobald das Fenster offensteht', async () => {
		const id = await verknuepftesKonto('prueflauf-erneut');
		await loeseVerknuepfung(wer(), id);
		// Ohne Fenster kommt niemand herein — auch nicht mit derselben Kennung.
		expect(
			await findeBenutzer(person({ sub: 'kennung-neu', email: 'prueflauf-erneut@example.ch' }))
		).toBeNull();

		await setzeVerknuepfungsfenster(wer(), id, true);
		const gefunden = await findeBenutzer(
			person({ sub: 'kennung-neu', email: 'prueflauf-erneut@example.ch' })
		);
		expect(gefunden?.id).toBe(id);
		expect((await standVon(id)).oidc_subject).toBe('kennung-neu');
	});
});

describe('Eine gelöste Kennung kehrt nur zum eigenen Konto zurück', () => {
	/**
	 * **Der Angriff, den die Sicherheitsprüfung am 16.09.2026 beschrieben hat**,
	 * Schritt für Schritt nachgestellt.
	 *
	 * Eine Sitzungsleitung löst ihre eigene Verknüpfung, setzt in Authentik die
	 * Adresse eines frisch angelegten Verwaltungskontos ein und meldet sich an.
	 * Ohne die Spur der gelösten Kennung bekäme sie dieses Konto samt seiner
	 * Rolle.
	 */
	it('lässt eine gelöste Kennung nicht an ein fremdes Konto', async () => {
		const [angreifer] = await admin<{ id: string }[]>`
			INSERT INTO app_user (operator_id, username, display_name, password_hash, role,
			                      email, oidc_subject)
			VALUES (${betreiber}, 'prueflauf-angreifer', 'Prüflauf Angreifer', 'x', 'chair',
			        'angreifer@example.ch', 'kennung-angreifer')
			RETURNING id`;

		// Frisch angelegtes Verwaltungskonto — sein Fenster steht offen.
		const ziel = await legeKontoAn(wer(), {
			username: 'prueflauf-zielkonto',
			displayName: 'Prüflauf Zielkonto',
			email: 'zielkonto@example.ch',
			rolle: 'admin',
			kennwort: 'wolke turm ziegel morgen',
			wiederholung: 'wolke turm ziegel morgen'
		});
		expect(ziel.verknuepfungOffenBis).not.toBeNull();

		// Schritt 1: Die eigene Verknüpfung lösen.
		await loeseVerknuepfung(wer(), angreifer.id);

		// Schritt 2: In Authentik die fremde Adresse eintragen und anmelden.
		const gefunden = await findeBenutzer(
			person({ sub: 'kennung-angreifer', email: 'zielkonto@example.ch' })
		);

		expect(gefunden).toBeNull();
		expect((await standVon(ziel.id)).oidc_subject).toBeNull();
	});

	it('lässt sie aber zum eigenen Konto zurück', async () => {
		const id = await konto({
			username: 'prueflauf-rueckkehr',
			email: 'rueckkehr@example.ch',
			offenBis: null,
			kennung: 'kennung-rueckkehr'
		});
		await admin`UPDATE app_user SET password_hash = 'x' WHERE id = ${id}`;
		await loeseVerknuepfung(wer(), id);
		await setzeVerknuepfungsfenster(wer(), id, true);

		const gefunden = await findeBenutzer(
			person({ sub: 'kennung-rueckkehr', email: 'rueckkehr@example.ch' })
		);
		expect(gefunden?.id).toBe(id);
		expect((await standVon(id)).oidc_subject).toBe('kennung-rueckkehr');
	});

	it('vermerkt den abgewiesenen Versuch am betroffenen Konto', async () => {
		const [fremd] = await admin<{ id: string }[]>`
			INSERT INTO app_user (operator_id, username, display_name, password_hash, role,
			                      email, oidc_subject)
			VALUES (${betreiber}, 'prueflauf-spur2', 'Prüflauf Spur2', 'x', 'chair',
			        'spur2@example.ch', 'kennung-spur2')
			RETURNING id`;
		const ziel = await konto({
			username: 'prueflauf-spurziel',
			email: 'spurziel@example.ch',
			offenBis: fensterEnde(new Date())
		});
		await loeseVerknuepfung(wer(), fremd.id);

		await findeBenutzer(person({ sub: 'kennung-spur2', email: 'spurziel@example.ch' }));

		const eintraege = await admin<{ event_type: string; detail: { grund?: string } }[]>`
			SELECT event_type, detail FROM audit_entry
			WHERE subject_type = 'app_user' AND subject_id = ${ziel}`;
		const abweisung = eintraege.find((e) => e.event_type === 'user.link.rejected');
		expect(abweisung?.detail.grund).toBe('kennung_anderswo');
	});
});
