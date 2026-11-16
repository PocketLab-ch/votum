/**
 * Stichentscheid, Freigabe und Siegel im Rennen (Sicherheitsdurchgang
 * 09.10.2026, Befunde S6, D6, D7).
 *
 * Alle drei Wege lasen den Stand, prüften ihn und schrieben danach, ohne dass
 * zwischen Lesen und Schreiben etwas den Stand festhielt. Ein zweiter Lauf im
 * selben Fenster las denselben alten Stand und überschrieb den ersten, schrieb
 * eine eröffnete Versammlung in die Freigabe zurück, oder das Siegel bezeugte
 * einen Inhalt, den die Datenbank danach nicht mehr hergab.
 *
 * Gesteuert wie in `stimmweg-rennen.test.ts`: Eine dritte Verbindung hält die
 * Zeile, an der die Läufe anhalten, bis nachweislich alle warten.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	holeVersammlung,
	schliesseVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei, nimmVersammlungsfreigabeZurueck } from '$lib/server/freigabe';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	stelleRueckkommensantrag
} from '$lib/server/traktanden';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	brecheAbstimmungAb,
	erfasseSummen,
	gibStimmenAb,
	haltBeschlussVonHandFest,
	haltBeschlusstextFest,
	haltStichentscheidFest,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { erhebeSiegellage, holePaket, holeSiegel, versiegle } from '$lib/server/siegel';
import { wiederholteVerklemmungen } from '$lib/server/db';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Stichentscheid } from '$lib/domain/types';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { halteSperre, warteAufWartende } from './rennen';
import { entpacke } from './zip';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-gewoehnlich',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

interface Entwurf {
	versammlung: string;
	traktandum: string;
	parteien: string[];
}

/** Eine Versammlung im Entwurf: zwei Parteien, ein Traktandum mit einfachem Mehr. */
async function entwurf(name: string, tieBreak: Stichentscheid = 'keiner'): Promise<Entwurf> {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak,
		tieBreakRuleSource: tieBreak !== 'keiner' ? 'Art. 7 Ziff. 5' : undefined
	});
	const parteien: string[] = [];
	for (const [i, quote] of [600, 400].entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Prüfpartei ${i + 1}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum: '2026-10-13',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Ersatz der Gegensprechanlage',
		art: 'abstimmung',
		antragswortlaut: 'Die Gegensprechanlage wird ersetzt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, t.id, EINFACHES_MEHR);
	return { versammlung: v.id, traktandum: t.id, parteien };
}

/** Wie `entwurf`, dazu eröffnet, beide da und ein geschlossener Durchgang 1 : 1. */
async function abgestimmt(name: string, tieBreak: Stichentscheid = 'keiner') {
	const h = await entwurf(name, tieBreak);
	await gibVersammlungFrei(handelnder(), h.versammlung);
	await eroeffneVersammlung(handelnder(), h.versammlung);
	for (const p of h.parteien) {
		await bestaetigeAnwesenheit(handelnder(), h.versammlung, p, 'von_hand');
	}
	await stelleAufTraktandum(handelnder(), h.versammlung, h.traktandum);
	await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
	await gibStimmenAb(handelnder(), h.versammlung, [{ parteiId: h.parteien[0], wahl: 'yes' }], false);
	await gibStimmenAb(handelnder(), h.versammlung, [{ parteiId: h.parteien[1], wahl: 'no' }], false);
	const d = await schliesseAbstimmung(handelnder(), h.versammlung);
	return { ...h, durchgang: d.id };
}

function sperreDieVersammlung(meetingId: string) {
	return halteSperre(async (tx) => {
		const zeilen = await tx`SELECT 1 FROM meeting WHERE id = ${meetingId} FOR UPDATE`;
		expect(zeilen).toHaveLength(1);
	});
}

/**
 * Ist einer der Läufe schon erledigt? Für `warteAufWartende(…, genug)`: Wer
 * nicht wartet, wo die Prüfung es annimmt, beendet das Warten, und die
 * Prüfung wird an ihren Erwartungen rot statt an der Uhr.
 */
function erledigt(...laeufe: Promise<unknown>[]): () => boolean {
	let fertig = false;
	for (const l of laeufe) l.then(() => (fertig = true), () => (fertig = true));
	return () => fertig;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Abschluss im Rennen');
	benutzer = await pruefbenutzer(betreiber, 'abschluss-rennen');
});

afterAll(verbindungenSchliessen);

describe('S6: zwei Stichentscheide zugleich', () => {
	it('lässt den ersten gelten und weist den zweiten ab', async () => {
		const h = await abgestimmt('Prüfhaus H5 Stichentscheid', 'verwalter');

		// Beide Läufe lesen den Durchgang (der alte Code ohne Sperre) und halten
		// an der gesperrten Zeile an.
		const sperre = await halteSperre(async (tx) => {
			const zeilen = await tx`
				SELECT 1 FROM voting_round WHERE id = ${h.durchgang} FOR UPDATE
			`;
			expect(zeilen).toHaveLength(1);
		});
		const ja = haltStichentscheidFest(handelnder(), h.versammlung, h.durchgang, {
			wahl: 'yes',
			wer: 'Verwaltung Erstweg'
		});
		await warteAufWartende(1);
		const nein = haltStichentscheidFest(handelnder(), h.versammlung, h.durchgang, {
			wahl: 'no',
			wer: 'Verwaltung Zweitweg'
		});
		await warteAufWartende(2);
		await sperre.loesen();

		const [a, b] = await Promise.allSettled([ja, nein]);
		expect(a.status).toBe('fulfilled');
		expect(b.status).toBe('rejected');
		expect((b as PromiseRejectedResult).reason).toMatchObject({ kennung: 'schon_entschieden' });

		const [z] = await admin<{ tie_break_choice: string; tie_break_by: string }[]>`
			SELECT tie_break_choice, tie_break_by FROM voting_round WHERE id = ${h.durchgang}
		`;
		expect(z).toEqual({ tie_break_choice: 'yes', tie_break_by: 'Verwaltung Erstweg' });
		const eintraege = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT 1 FROM audit_entry
				 WHERE event_type = 'vote.tiebreak.decided' AND subject_id = ${h.versammlung}
			`
		);
		expect(eintraege).toHaveLength(1);
	});
});

describe('D6: Freigabe gegen einen veralteten Stand', () => {
	/*
	 * **Was der Befund als Folge nennt, fangen heute schon Schranken der
	 * Datenbank** (gemessen 13.10.2026 am Stand `1421286`): Die zweite Freigabe
	 * nach dem Eröffnen scheitert an `meeting_zeitstempel`, die Rücknahme nach
	 * dem Eröffnen an der Sperre des Mehrs der Einladung (Migration 144). Beide
	 * kamen als rohe Ausnahme an, «die Anwendung hätte es vorher sagen müssen».
	 * Geprüft wird deshalb der Satz: Die Absage kommt aus der Zustandsprüfung,
	 * die nach dem Sperren den Stand neu liest.
	 */
	it('gibt zweimal zugleich nur einmal frei', async () => {
		const h = await entwurf('Prüfhaus H5 Doppelfreigabe');

		const sperre = await sperreDieVersammlung(h.versammlung);
		const erste = gibVersammlungFrei(handelnder(), h.versammlung);
		await warteAufWartende(1, erledigt(erste));
		const zweite = gibVersammlungFrei(handelnder(), h.versammlung);
		await warteAufWartende(2, erledigt(zweite));
		await sperre.loesen();

		const [a, b] = await Promise.allSettled([erste, zweite]);
		expect(a.status).toBe('fulfilled');
		expect(b.status).toBe('rejected');
		expect((b as PromiseRejectedResult).reason).toMatchObject({ kennung: 'zustand_unpassend' });
		const freigaben = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT 1 FROM audit_entry
				 WHERE event_type = 'meeting.released' AND subject_id = ${h.versammlung}
			`
		);
		expect(freigaben).toHaveLength(1);
	});

	it('schreibt eine inzwischen eröffnete Versammlung nicht in die Freigabe zurück', async () => {
		const h = await entwurf('Prüfhaus H5 Freigabe');

		// Der Reihe nach: erste Freigabe, Eröffnen, zweite Freigabe. Die zweite
		// hat (im alten Code) die Lage gelesen, als noch alles im Entwurf stand.
		const sperre = await sperreDieVersammlung(h.versammlung);
		const erste = gibVersammlungFrei(handelnder(), h.versammlung);
		await warteAufWartende(1, erledigt(erste));
		const eroeffnen = eroeffneVersammlung(handelnder(), h.versammlung);
		await warteAufWartende(2, erledigt(erste, eroeffnen));
		const zweite = gibVersammlungFrei(handelnder(), h.versammlung);
		await warteAufWartende(3, erledigt(erste, eroeffnen, zweite));
		await sperre.loesen();

		const [a, e, b] = await Promise.allSettled([erste, eroeffnen, zweite]);
		expect(a.status).toBe('fulfilled');
		expect(e.status).toBe('fulfilled');
		expect(b.status).toBe('rejected');
		expect((b as PromiseRejectedResult).reason).toMatchObject({ kennung: 'zustand_unpassend' });
		expect((await holeVersammlung(betreiber, h.versammlung))?.zustand).toBe('laufend');
	});

	/*
	 * **Keine Verklemmung mit einem Traktandum, das zugleich bearbeitet wird**
	 * (Codeprüfung H5). Bei `UPDATE` sperrt PostgreSQL die Zeile, bevor der
	 * Auslöser läuft. Sperrte der Schreibschutz (Migration 157) die Versammlung
	 * in jedem Zustand, hielte die Bearbeitung das Traktandum und wartete auf
	 * die Versammlung, die Freigabe hielte die Versammlung und wartete beim
	 * Schreiben der Nummern auf das Traktandum: 40P01.
	 */
	it('verklemmt sich nicht mit einer Bearbeitung des Traktandums', async () => {
		const h = await entwurf('Prüfhaus H5 Freigabe und Traktandum');

		const sperre = await sperreDieVersammlung(h.versammlung);
		const freigabe = gibVersammlungFrei(handelnder(), h.versammlung);
		await warteAufWartende(1, erledigt(freigabe));
		const bearbeiten = imKontext(
			betreiber,
			(tx) => tx`
				UPDATE agenda_item SET title = 'Ersatz der Gegensprechanlage und der Klingel'
				 WHERE id = ${h.traktandum}
			`
		);
		await warteAufWartende(2, erledigt(bearbeiten));
		await sperre.loesen();

		const [f, b] = await Promise.allSettled([freigabe, bearbeiten]);
		expect(b.status).toBe('fulfilled');
		expect(f.status).toBe('fulfilled');
	});

	it('nimmt die Freigabe einer inzwischen eröffneten Versammlung nicht zurück', async () => {
		const h = await entwurf('Prüfhaus H5 Rücknahme');
		await gibVersammlungFrei(handelnder(), h.versammlung);

		const sperre = await sperreDieVersammlung(h.versammlung);
		const eroeffnen = eroeffneVersammlung(handelnder(), h.versammlung);
		await warteAufWartende(1, erledigt(eroeffnen));
		const zurueck = nimmVersammlungsfreigabeZurueck(handelnder(), h.versammlung, 'Prüflauf');
		await warteAufWartende(2, erledigt(eroeffnen, zurueck));
		await sperre.loesen();

		const [e, r] = await Promise.allSettled([eroeffnen, zurueck]);
		expect(e.status).toBe('fulfilled');
		expect(r.status).toBe('rejected');
		expect((r as PromiseRejectedResult).reason).toMatchObject({ kennung: 'zustand_unpassend' });
		expect((await holeVersammlung(betreiber, h.versammlung))?.zustand).toBe('laufend');
		const [{ n }] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM snapshot_party WHERE meeting_id = ${h.versammlung}
		`;
		expect(n).toBe(2);
	});
});

describe('D7: Schreiben, während versiegelt wird', () => {
	it('wartet oder wird abgewiesen, und das Paket stimmt danach mit der Datenbank überein', async () => {
		const h = await abgestimmt('Prüfhaus H5 Siegel');
		await schliesseVersammlung(handelnder(), h.versammlung);

		/*
		 * Das Siegel hält an der gesperrten Versammlung an: der alte Code, nachdem
		 * er das Paket schon zusammengetragen hat, beim Eintragen des Siegels;
		 * der neue vor dem Zusammentragen. Dazwischen kommt der Text zum
		 * Beschluss, der ins Paket gehört (`daten/abstimmungen.json`).
		 */
		const sperre = await sperreDieVersammlung(h.versammlung);
		const siegel = versiegle(handelnder(), h.versammlung, '2026-10-13 22:00:00');
		await warteAufWartende(1, erledigt(siegel));
		const text = haltBeschlusstextFest(
			handelnder(),
			h.versammlung,
			h.durchgang,
			'Zum Kostendach von CHF 4’000.'
		);
		await warteAufWartende(2, erledigt(text));
		await sperre.loesen();

		const [s, t] = await Promise.allSettled([siegel, text]);
		expect(s.status).toBe('fulfilled');
		expect(await holeSiegel(betreiber, h.versammlung)).not.toBeNull();

		const [z] = await admin<{ decision_text: string | null }[]>`
			SELECT decision_text FROM voting_round WHERE id = ${h.durchgang}
		`;
		const dateien = entpacke((await holePaket(betreiber, h.versammlung)) as Uint8Array);
		const abstimmungen = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/abstimmungen.json'))
		) as { durchgaenge: { id: string; beschlusstext: string | null }[] };
		const imPaket = abstimmungen.durchgaenge.find((d) => d.id === h.durchgang);
		expect(imPaket?.beschlusstext ?? null).toBe(z.decision_text);

		// Und der Text ist abgewiesen, mit dem Satz und nicht still verloren. Das
		// Siegel stand zuerst an der Sperre an und kommt zuerst zum Zug; der Text
		// wartet und liest danach «versiegelt».
		expect(t.status).toBe('rejected');
		expect((t as PromiseRejectedResult).reason).toMatchObject({ kennung: 'versiegelt' });
		expect(z.decision_text).toBeNull();
	});

	/*
	 * **Die zweite Hälfte: ein Schreibweg ohne eigene Sperre** (Migration 157).
	 * Der Text zum Beschluss oben liest die Versammlung selbst mit
	 * `FOR KEY SHARE`; ein künftiger Weg tut das vielleicht nicht. Dann muss der
	 * Auslöser warten, sonst schriebe er an der Sperre des Siegels vorbei.
	 */
	it('lässt auch ein rohes Schreiben unter der Anwendungsrolle warten', async () => {
		const h = await abgestimmt('Prüfhaus H5 Siegel roh');
		await schliesseVersammlung(handelnder(), h.versammlung);

		const sperre = await sperreDieVersammlung(h.versammlung);
		const siegel = versiegle(handelnder(), h.versammlung, '2026-10-13 22:00:00');
		await warteAufWartende(1, erledigt(siegel));
		const roh = imKontext(
			betreiber,
			(tx) => tx`
				UPDATE voting_round SET decision_text = 'An der Sperre vorbei'
				 WHERE id = ${h.durchgang}
			`
		);
		await warteAufWartende(2, erledigt(roh));
		await sperre.loesen();

		const [s, r] = await Promise.allSettled([siegel, roh]);
		expect(s.status).toBe('fulfilled');
		expect(r.status).toBe('rejected');
		expect(String((r as PromiseRejectedResult).reason)).toMatch(/versiegelt/);
		const [z] = await admin<{ decision_text: string | null }[]>`
			SELECT decision_text FROM voting_round WHERE id = ${h.durchgang}
		`;
		expect(z.decision_text).toBeNull();
	});

	it('lässt einen Stichentscheid während des Versiegelns warten und sagt danach «versiegelt»', async () => {
		const h = await abgestimmt('Prüfhaus H5 Siegel Stichentscheid', 'verwalter');
		await schliesseVersammlung(handelnder(), h.versammlung);

		const sperre = await sperreDieVersammlung(h.versammlung);
		const siegel = versiegle(handelnder(), h.versammlung, '2026-10-13 22:00:00');
		await warteAufWartende(1, erledigt(siegel));
		const entscheid = haltStichentscheidFest(handelnder(), h.versammlung, h.durchgang, {
			wahl: 'no',
			wer: 'Verwaltung Spätweg'
		});
		await warteAufWartende(2, erledigt(entscheid));
		await sperre.loesen();

		const [s, e] = await Promise.allSettled([siegel, entscheid]);
		expect(s.status).toBe('fulfilled');
		expect(e.status).toBe('rejected');
		expect((e as PromiseRejectedResult).reason).toMatchObject({ kennung: 'versiegelt' });
	});

	it('versiegelt zweimal zugleich nur einmal', async () => {
		const h = await abgestimmt('Prüfhaus H5 Doppelsiegel');
		await schliesseVersammlung(handelnder(), h.versammlung);

		const sperre = await sperreDieVersammlung(h.versammlung);
		const erstes = versiegle(handelnder(), h.versammlung, '2026-10-13 22:00:00');
		await warteAufWartende(1, erledigt(erstes));
		const zweites = versiegle(handelnder(), h.versammlung, '2026-10-13 22:00:01');
		await warteAufWartende(2, erledigt(zweites));
		await sperre.loesen();

		const [a, b] = await Promise.allSettled([erstes, zweites]);
		expect(a.status).toBe('fulfilled');
		expect(b.status).toBe('rejected');
		expect((b as PromiseRejectedResult).reason).toMatchObject({ kennung: 'schon_versiegelt' });
	});
});

/*
 * **Versammlung schliessen im Rennen** (Pentest-Runde M7, Befunde M7-A1,
 * M7-2-01 und P1-01). `schliesseVersammlung` las die Versammlung ohne Sperre,
 * schloss die offenen Durchgänge, die es sah, und schrieb den Zustand ohne
 * Bindung an den alten. Ein Eröffnen, das die Versammlung schon hielt, kam
 * danach durch: geschlossen mit offenem Durchgang. Zwei Schlüsse schrieben
 * zwei Einträge, der zweite überschrieb `closed_at`.
 */
describe('M7-A1: Versammlung schliessen im Rennen', () => {
	/** Eröffnet, beide da, auf dem Traktandum; kein Durchgang. */
	async function imSaal(name: string) {
		const h = await entwurf(name);
		await gibVersammlungFrei(handelnder(), h.versammlung);
		await eroeffneVersammlung(handelnder(), h.versammlung);
		for (const p of h.parteien) {
			await bestaetigeAnwesenheit(handelnder(), h.versammlung, p, 'von_hand');
		}
		await stelleAufTraktandum(handelnder(), h.versammlung, h.traktandum);
		return h;
	}

	async function offeneDurchgaenge(meetingId: string): Promise<number> {
		const [{ n }] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM voting_round
			 WHERE meeting_id = ${meetingId} AND state = 'offen'
		`;
		return n;
	}

	it('schliesst einen Durchgang mit, den ein gleichzeitiges Eröffnen anlegt', async () => {
		const h = await imSaal('Prüfhaus F6 Eröffnen gegen Schluss');

		// Das Eröffnen kommt zuerst an die Versammlung, der Schluss danach. Der
		// alte Schluss sah den Durchgang nicht und wartete erst beim UPDATE.
		const sperre = await sperreDieVersammlung(h.versammlung);
		const oeffnen = oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await warteAufWartende(1, erledigt(oeffnen));
		const schluss = schliesseVersammlung(handelnder(), h.versammlung);
		await warteAufWartende(2, erledigt(oeffnen, schluss));
		await sperre.loesen();

		const [o, s] = await Promise.allSettled([oeffnen, schluss]);
		expect(o.status).toBe('fulfilled');
		expect(s.status).toBe('fulfilled');
		expect((await holeVersammlung(betreiber, h.versammlung))?.zustand).toBe('geschlossen');
		expect(await offeneDurchgaenge(h.versammlung)).toBe(0);
		expect((s as PromiseFulfilledResult<{ geschlosseneAbstimmungen: number }>).value.geschlosseneAbstimmungen).toBe(1);
	});

	it('weist ein Eröffnen ab, das nach dem Schluss an die Versammlung kommt', async () => {
		const h = await imSaal('Prüfhaus F6 Schluss gegen Eröffnen');

		const sperre = await sperreDieVersammlung(h.versammlung);
		const schluss = schliesseVersammlung(handelnder(), h.versammlung);
		await warteAufWartende(1, erledigt(schluss));
		const oeffnen = oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await warteAufWartende(2, erledigt(schluss, oeffnen));
		await sperre.loesen();

		const [s, o] = await Promise.allSettled([schluss, oeffnen]);
		expect(s.status).toBe('fulfilled');
		expect(o.status).toBe('rejected');
		expect((o as PromiseRejectedResult).reason).toMatchObject({ kennung: 'nicht_laufend' });
		expect(await offeneDurchgaenge(h.versammlung)).toBe(0);
	});

	it('schliesst zweimal zugleich nur einmal', async () => {
		const h = await imSaal('Prüfhaus F6 Doppelschluss');

		const sperre = await sperreDieVersammlung(h.versammlung);
		const erster = schliesseVersammlung(handelnder(), h.versammlung);
		await warteAufWartende(1, erledigt(erster));
		const zweiter = schliesseVersammlung(handelnder(), h.versammlung);
		await warteAufWartende(2, erledigt(erster, zweiter));
		await sperre.loesen();

		const [a, b] = await Promise.allSettled([erster, zweiter]);
		expect(a.status).toBe('fulfilled');
		expect(b.status).toBe('rejected');
		expect((b as PromiseRejectedResult).reason).toMatchObject({ kennung: 'zustand_unpassend' });
		const schluesse = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT 1 FROM audit_entry
				 WHERE event_type = 'meeting.closed' AND subject_id = ${h.versammlung}
			`
		);
		expect(schluesse).toHaveLength(1);
	});

	/*
	 * **Die Sperrfolge gegen den Beschluss von Hand.** Er hält das Traktandum
	 * und dessen Durchgänge und schreibt am Ende die Versammlung. Sperrte der
	 * Schluss zuerst die Versammlung und danach die offenen Durchgänge, hielte
	 * jeder, was der andere braucht: 40P01. Die dritte Verbindung hält hier den
	 * offenen Durchgang, damit beide Läufe in diesem Fenster stehen.
	 */
	it('verklemmt sich nicht mit einem Beschluss von Hand zum offenen Traktandum', async () => {
		const h = await imSaal('Prüfhaus F6 Schluss gegen Beschluss von Hand');
		const offen = await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);

		const sperre = await halteSperre(async (tx) => {
			const zeilen = await tx`SELECT 1 FROM voting_round WHERE id = ${offen.id} FOR UPDATE`;
			expect(zeilen).toHaveLength(1);
		});
		const vonHand = haltBeschlussVonHandFest(handelnder(), h.versammlung, h.traktandum, {
			ergebnis: 'angenommen',
			zahlen: {
				erfassung: 'parteien',
				stimmen: h.parteien.map((parteiId) => ({ parteiId, wahl: 'yes' as const }))
			}
		});
		await warteAufWartende(1, erledigt(vonHand));
		const schluss = schliesseVersammlung(handelnder(), h.versammlung);
		await warteAufWartende(2, erledigt(vonHand, schluss));
		await sperre.loesen();

		const [v, s] = await Promise.allSettled([vonHand, schluss]);
		expect(v.status).toBe('fulfilled');
		expect(s.status).toBe('fulfilled');
		expect((await holeVersammlung(betreiber, h.versammlung))?.zustand).toBe('geschlossen');
		expect(await offeneDurchgaenge(h.versammlung)).toBe(0);
	});

	/*
	 * **Drei zugleich: Eröffnen, Schluss und Beschluss von Hand zum selben
	 * Traktandum** (Codeprüfung F6). Der Schluss findet den Durchgang noch
	 * nicht und sperrt dessen Traktandum nicht. Nimmt der Beschluss von Hand
	 * nach dem Eröffnen erst Traktandum und Durchgang und die Versammlung erst
	 * am Ende, hält er, worauf der Schluss wartet, und wartet auf die
	 * Versammlung, die der Schluss hält: 40P01.
	 */
	it('verklemmt sich auch mit Eröffnen und Beschluss von Hand zugleich nicht', async () => {
		const h = await imSaal('Prüfhaus F6 Eröffnen, Schluss und Beschluss von Hand');

		const sperre = await sperreDieVersammlung(h.versammlung);
		const oeffnen = oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await warteAufWartende(1, erledigt(oeffnen));
		const schluss = schliesseVersammlung(handelnder(), h.versammlung);
		await warteAufWartende(2, erledigt(oeffnen, schluss));
		const vonHand = haltBeschlussVonHandFest(handelnder(), h.versammlung, h.traktandum, {
			ergebnis: 'angenommen',
			zahlen: {
				erfassung: 'parteien',
				stimmen: h.parteien.map((parteiId) => ({ parteiId, wahl: 'yes' as const }))
			}
		});
		await warteAufWartende(3, erledigt(oeffnen, schluss, vonHand));
		await sperre.loesen();

		const [o, s, v] = await Promise.allSettled([oeffnen, schluss, vonHand]);
		expect(o.status).toBe('fulfilled');
		expect(s.status).toBe('fulfilled');
		// Wer nach dem Schluss an die Versammlung kommt, bekommt den Satz; wer
		// davor kommt, ist durch. Eine Verklemmung ist keins von beiden.
		if (v.status === 'rejected') {
			expect(v.reason).toMatchObject({ kennung: 'nicht_laufend' });
		}
		expect((await holeVersammlung(betreiber, h.versammlung))?.zustand).toBe('geschlossen');
		expect(await offeneDurchgaenge(h.versammlung)).toBe(0);
	});

	it('nennt bei laufender Versammlung mit offener Abstimmung kein Fehlerhindernis', async () => {
		const h = await imSaal('Prüfhaus F6 Siegellage im Saal');
		await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		const lage = await erhebeSiegellage(betreiber, h.versammlung);
		expect(lage.moeglich).toBe(false);
		expect(lage.hindernisse.join(' ')).not.toMatch(/Betrieb/);
	});

	/*
	 * **Was der alte Schluss hinterlassen konnte** (Folgen b und c des
	 * Befunds): eine geschlossene Versammlung mit offenem Durchgang. Von Hand
	 * hergestellt, weil der neue Schluss sie nicht mehr erzeugt.
	 */
	describe('eine geschlossene Versammlung mit offenem Durchgang', () => {
		async function geschlossenMitOffenem(name: string) {
			const h = await imSaal(name);
			await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
			await admin`
				UPDATE meeting SET state = 'geschlossen', closed_at = now(),
				                   current_agenda_item_id = NULL, current_agenda_item_at = NULL
				 WHERE id = ${h.versammlung}
			`;
			return h;
		}

		it('lässt den Durchgang nicht mehr schliessen und verkünden', async () => {
			const h = await geschlossenMitOffenem('Prüfhaus F6 Schliessen nach Schluss');
			await expect(schliesseAbstimmung(handelnder(), h.versammlung)).rejects.toMatchObject({
				kennung: 'nicht_laufend'
			});
			expect(await offeneDurchgaenge(h.versammlung)).toBe(1);
		});

		/*
		 * **Der Ausweg, den der Satz im Runbook beschreibt:** Abbrechen ohne
		 * Ergebnis bleibt nach dem Schluss möglich, und danach lässt sich
		 * versiegeln (`docs/installation.md`, `brecheAbstimmungAb`).
		 */
		it('lässt den Durchgang ohne Ergebnis abbrechen, danach ist das Hindernis weg', async () => {
			const h = await geschlossenMitOffenem('Prüfhaus F6 Abbruch nach Schluss');
			await brecheAbstimmungAb(handelnder(), h.versammlung, 'Beim Schluss offen geblieben');
			expect(await offeneDurchgaenge(h.versammlung)).toBe(0);
			const lage = await erhebeSiegellage(betreiber, h.versammlung);
			expect(lage.hindernisse.join(' ')).not.toMatch(/noch offen/);
		});

		it('versiegelt sie nicht und sagt, was zu tun ist', async () => {
			const h = await geschlossenMitOffenem('Prüfhaus F6 Siegel mit offenem');
			const lage = await erhebeSiegellage(betreiber, h.versammlung);
			expect(lage.moeglich).toBe(false);
			expect(lage.hindernisse.join(' ')).toMatch(/noch offen.*Betrieb/);
			await expect(
				versiegle(handelnder(), h.versammlung, '2026-10-15 22:00:00')
			).rejects.toMatchObject({ kennung: 'nicht_moeglich' });
			expect(await holeSiegel(betreiber, h.versammlung)).toBeNull();
		});
	});
});

/** «ok» oder die Kennung der Absage; 40P01 ist nie erlaubt. */
async function ausgang(laeufe: Promise<unknown>[]): Promise<string[]> {
	return (await Promise.allSettled(laeufe)).map((e) => {
		if (e.status === 'fulfilled') return 'ok';
		expect((e.reason as { code?: string }).code, String(e.reason)).not.toBe('40P01');
		expect(e.reason, String(e.reason)).toHaveProperty('kennung');
		return (e.reason as { kennung: string }).kennung;
	});
}

/*
 * **Verklemmungen gegen den Beschluss von Hand** (Auftrag Abschluss, C2,
 * 16.10.2026; aus der Codeprüfung zu F6). Der Beschluss von Hand sperrt in
 * der Folge des Hauses: Traktandum (`FOR UPDATE`), Versammlung, Durchgänge.
 * Wer gegenläufig sperrt, verklemmt sich mit ihm: PostgreSQL bricht einen der
 * beiden mit 40P01 ab, nichts ist geschrieben, die Leitung sieht die
 * Fehlerseite.
 *
 * **Woher die gegenläufige Sperre kam, stand in keiner Zeile des Codes.** Ein
 * zweites `UPDATE` auf eine Zeile, die dieselbe Transaktion schon geschrieben
 * hat, fährt die Fremdschlüsselprüfung auch bei unveränderten Schlüsseln, und
 * die nimmt `FOR KEY SHARE` auf das Traktandum. Am alten Stand sperrten
 * Stichentscheid und Schliessen deshalb Durchgang, dann Traktandum.
 *
 * Gesteuert: Eine dritte Verbindung hält die Zeile, an der beide anhalten. Am
 * alten Stand hielt dort jeder schon, was der andere danach brauchte, und das
 * Ergebnis hing nicht am Takt (drei Prüfungen rot mit 40P01). Am neuen Stand
 * wartet der zweite Lauf an der vorweggenommenen Sperre, bevor er den
 * Durchgang hält. Jede Prüfung verlangt, dass beide Läufe wirklich gewartet
 * haben, und hält das Ergebnis beider fest; sonst wäre eine Absage vor der
 * Sperre ebenso grün.
 */
describe('C2: keine Verklemmung mit dem Beschluss von Hand', () => {
	/*
	 * Ohne Wiederholung: Liefe der Beschluss von Hand nach einem 40P01 still ein
	 * zweites Mal (`nochmalsBeiVerklemmung`), blieben diese Fälle auch nach
	 * einem Rückschritt in der Sperrfolge grün (Codeprüfung, 27.10.2026).
	 */
	let vorher = 0;
	beforeEach(() => {
		vorher = wiederholteVerklemmungen();
	});
	afterEach(() => {
		expect(wiederholteVerklemmungen() - vorher, 'eine Verklemmung wurde wiederholt').toBe(0);
	});

	const vonHandEingabe = (parteien: string[]) => ({
		ergebnis: 'angenommen' as const,
		zahlen: {
			erfassung: 'parteien' as const,
			stimmen: parteien.map((parteiId) => ({ parteiId, wahl: 'yes' as const }))
		}
	});

	it('mit einem Stichentscheid am selben Traktandum', async () => {
		const h = await abgestimmt('Prüfhaus C2 Stichentscheid', 'verwalter');
		// Die Versammlung gehalten. Am alten Stand warteten beide dort, der
		// Stichentscheid mit dem Durchgang, der Beschluss von Hand mit dem
		// Traktandum. Am neuen wartet der Stichentscheid dort mit dem
		// Traktandum (`KEY SHARE`), der Beschluss von Hand am Traktandum.
		const sperre = await sperreDieVersammlung(h.versammlung);
		const entscheid = haltStichentscheidFest(handelnder(), h.versammlung, h.durchgang, {
			wahl: 'yes',
			wer: 'Verwaltung Stichweg'
		});
		await warteAufWartende(1, erledigt(entscheid));
		const vonHand = haltBeschlussVonHandFest(
			handelnder(),
			h.versammlung,
			h.traktandum,
			vonHandEingabe(h.parteien)
		);
		const vorzeitig = erledigt(entscheid, vonHand);
		await warteAufWartende(2, vorzeitig);
		expect(vorzeitig(), 'ein Lauf endete, bevor beide warteten').toBe(false);
		await sperre.loesen();

		// Der Stichentscheid kam zuerst an die Zeile und gilt; der Beschluss von
		// Hand überholt danach den entschiedenen Durchgang.
		expect(await ausgang([entscheid, vonHand])).toEqual(['ok', 'ok']);
	});

	it('mit dem Aufrufen desselben Traktandums', async () => {
		const h = await entwurf('Prüfhaus C2 Aufrufen');
		await gibVersammlungFrei(handelnder(), h.versammlung);
		await eroeffneVersammlung(handelnder(), h.versammlung);
		for (const p of h.parteien) {
			await bestaetigeAnwesenheit(handelnder(), h.versammlung, p, 'von_hand');
		}
		/*
		 * **Gemessen ohne Verklemmung, und warum** (C2). Die Pendenz vermutete,
		 * das Aufrufen prüfe nach der Versammlung den Fremdschlüssel aufs
		 * Traktandum. `meeting.current_agenda_item_id` hat aber keinen
		 * Fremdschlüssel; das Aufrufen sperrt das Traktandum gar nicht und läuft
		 * am wartenden Beschluss von Hand vorbei. Die Prüfung bleibt als Wächter
		 * stehen: Bekäme die Spalte einen Fremdschlüssel, würde sie rot.
		 * Eine dritte Verbindung hält das Traktandum, der Beschluss von Hand
		 * wartet dort.
		 */
		const sperre = await halteSperre(async (tx) => {
			const zeilen = await tx`SELECT 1 FROM agenda_item WHERE id = ${h.traktandum} FOR UPDATE`;
			expect(zeilen).toHaveLength(1);
		});
		const vonHand = haltBeschlussVonHandFest(
			handelnder(),
			h.versammlung,
			h.traktandum,
			vonHandEingabe(h.parteien)
		);
		await warteAufWartende(1, erledigt(vonHand));
		const aufrufen = stelleAufTraktandum(handelnder(), h.versammlung, h.traktandum);
		await warteAufWartende(2, erledigt(vonHand, aufrufen));
		await sperre.loesen();

		expect(await ausgang([vonHand, aufrufen])).toEqual(['ok', 'ok']);
	});

	/*
	 * **Das Schliessen einer Abstimmung schreibt den Durchgang ebenfalls
	 * zweimal** (schliessen, dann verkünden in `schliesseInTransaktion`).
	 * Gefunden beim Erheben der Klasse, die Pendenz nannte es nicht.
	 */
	it('mit dem Schliessen der Abstimmung am selben Traktandum', async () => {
		const h = await entwurf('Prüfhaus C2 Schliessen');
		await gibVersammlungFrei(handelnder(), h.versammlung);
		await eroeffneVersammlung(handelnder(), h.versammlung);
		for (const p of h.parteien) {
			await bestaetigeAnwesenheit(handelnder(), h.versammlung, p, 'von_hand');
		}
		await stelleAufTraktandum(handelnder(), h.versammlung, h.traktandum);
		await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await gibStimmenAb(handelnder(), h.versammlung, [{ parteiId: h.parteien[0], wahl: 'yes' }], false);
		// Das Traktandum gehalten: Der Beschluss von Hand reiht sich dort zuerst
		// ein. Am alten Stand hielt das Schliessen dann schon den Durchgang und
		// reihte sich erst mit der Fremdschlüsselprüfung dahinter ein; am neuen
		// wartet es an der vorweggenommenen Sperre.
		const sperre = await halteSperre(async (tx) => {
			const zeilen = await tx`SELECT 1 FROM agenda_item WHERE id = ${h.traktandum} FOR UPDATE`;
			expect(zeilen).toHaveLength(1);
		});
		const vonHand = haltBeschlussVonHandFest(
			handelnder(),
			h.versammlung,
			h.traktandum,
			vonHandEingabe(h.parteien)
		);
		await warteAufWartende(1, erledigt(vonHand));
		const schliessen = schliesseAbstimmung(handelnder(), h.versammlung);
		const vorzeitig = erledigt(vonHand, schliessen);
		await warteAufWartende(2, vorzeitig);
		expect(vorzeitig(), 'ein Lauf endete, bevor beide warteten').toBe(false);
		await sperre.loesen();

		// Der Beschluss von Hand hat den offenen Durchgang mitgeschlossen.
		expect(await ausgang([vonHand, schliessen])).toEqual(['ok', 'keine_offene']);
	});

	/*
	 * **Die Gegenprobe: Die Handzählung schreibt den Durchgang nur einmal.**
	 * Die beiden `UPDATE` in `erfasseSummen` liegen in getrennten Zweigen
	 * (Erfassen oder Zurücknehmen), die Fremdschlüsselprüfung fährt also
	 * nicht, und sie wartet nur am Durchgang. Am alten Stand grün, und so soll
	 * es bleiben.
	 */
	it('mit einer Handzählung am offenen Durchgang', async () => {
		const h = await entwurf('Prüfhaus C2 Handzählung');
		await gibVersammlungFrei(handelnder(), h.versammlung);
		await eroeffneVersammlung(handelnder(), h.versammlung);
		for (const p of h.parteien) {
			await bestaetigeAnwesenheit(handelnder(), h.versammlung, p, 'von_hand');
		}
		await stelleAufTraktandum(handelnder(), h.versammlung, h.traktandum);
		const d = await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		const sperre = await halteSperre(async (tx) => {
			const zeilen = await tx`SELECT 1 FROM voting_round WHERE id = ${d.id} FOR UPDATE`;
			expect(zeilen).toHaveLength(1);
		});
		const summe = erfasseSummen(handelnder(), h.versammlung, {
			ja: 2,
			nein: 0,
			enthaltung: 0,
			vermerk: null
		});
		await warteAufWartende(1, erledigt(summe));
		const vonHand = haltBeschlussVonHandFest(
			handelnder(),
			h.versammlung,
			h.traktandum,
			vonHandEingabe(h.parteien)
		);
		const vorzeitig = erledigt(summe, vonHand);
		await warteAufWartende(2, vorzeitig);
		expect(vorzeitig(), 'ein Lauf endete, bevor beide warteten').toBe(false);
		await sperre.loesen();

		expect(await ausgang([summe, vonHand])).toEqual(['ok', 'ok']);
	});
});

/*
 * **Rückkommensantrag und sein Ziel zugleich** (aus der Codeprüfung zu C2,
 * 16.10.2026; `docs/pendenzen-sicherheit.md`). Das Eröffnen am Ziel sperrt
 * das Ziel, dann die Versammlung, und fügt den Durchgang mit
 * `reconsideration_item_id` ein; die Fremdschlüsselprüfung nimmt dabei
 * `FOR KEY SHARE` auf den Rückkommensantrag. Ein Eröffnen am Antrag selbst
 * hält ihn mit `FOR UPDATE` und wartet an der Versammlung. Ohne Abwehr hält
 * jeder, was der andere braucht: 40P01.
 *
 * Gesteuert wie C2: Eine dritte Verbindung hält die Versammlung, beide Läufe
 * warten dort, das Ziel zuerst. Gelöst bekommt das Ziel die Versammlung und
 * braucht danach den Antrag. Der Antrag selbst ist schon abgestimmt; sein
 * zweites Eröffnen sagt ab, aber erst nach der Sperre, und genau dort
 * entstand die Verklemmung. Abwehr: Eröffnen und Beschluss von Hand laufen
 * nach einem 40P01 noch einmal (`nochmalsBeiVerklemmung` in
 * `src/lib/server/db.ts`); die Sperrfolge bleibt, wie sie ist. Der zweite
 * Versuch liest den Stand, den der andere Lauf hinterlassen hat.
 */
describe('Rückkommensantrag und Ziel zugleich eröffnen', () => {
	/** Ein abgestimmtes Ziel mit angenommenem Rückkommensantrag, das Ziel aufgerufen. */
	async function zurueckgekommen(name: string) {
		const h = await abgestimmt(name);
		const r = await stelleRueckkommensantrag(handelnder(), h.versammlung, h.traktandum);
		await stelleAufTraktandum(handelnder(), h.versammlung, r.id);
		await oeffneAbstimmung(handelnder(), h.versammlung, r.id);
		await gibStimmenAb(
			handelnder(),
			h.versammlung,
			h.parteien.map((parteiId) => ({ parteiId, wahl: 'yes' as const })),
			false
		);
		await schliesseAbstimmung(handelnder(), h.versammlung);
		await stelleAufTraktandum(handelnder(), h.versammlung, h.traktandum);
		return { ...h, antrag: r.id };
	}

	/** Das Ziel wartet zuerst an der gehaltenen Versammlung, dann der Lauf am Antrag. */
	async function imRennen(
		h: { versammlung: string; antrag: string },
		amZiel: () => Promise<unknown>,
		amAntrag: () => Promise<unknown> = () => oeffneAbstimmung(handelnder(), h.versammlung, h.antrag)
	) {
		const sperre = await sperreDieVersammlung(h.versammlung);
		const ziel = amZiel();
		await warteAufWartende(1, erledigt(ziel));
		const antrag = amAntrag();
		const vorzeitig = erledigt(ziel, antrag);
		await warteAufWartende(2, vorzeitig);
		expect(vorzeitig(), 'ein Lauf endete, bevor beide warteten').toBe(false);
		const wiederholtVorher = wiederholteVerklemmungen();
		await sperre.loesen();
		const ergebnis = await ausgang([ziel, antrag]);
		// Die Lage hat die Verklemmung wirklich erzeugt; aufgefangen hat sie die
		// Wiederholung, nicht ein glücklicher Takt.
		expect(wiederholteVerklemmungen() - wiederholtVorher).toBeGreaterThan(0);
		return ergebnis;
	}

	it('verklemmt sich nicht beim Eröffnen am Ziel', async () => {
		const h = await zurueckgekommen('Prüfhaus Rückkommen zugleich');
		const [amZiel, amAntrag] = await imRennen(h, () =>
			oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum)
		);
		// Das Ziel wird nach dem angenommenen Rückkommen neu abgestimmt; der
		// Antrag ist abgestimmt und sagt fachlich ab.
		expect(amZiel).toBe('ok');
		expect(amAntrag).not.toBe('ok');
		const offen = await admin<{ reconsideration_item_id: string | null }[]>`
			SELECT reconsideration_item_id FROM voting_round
			 WHERE agenda_item_id = ${h.traktandum} AND closed_at IS NULL AND superseded_at IS NULL
		`;
		expect(offen.map((z) => z.reconsideration_item_id)).toEqual([h.antrag]);
	});

	it('verklemmt sich nicht beim Beschluss von Hand am Ziel', async () => {
		const h = await zurueckgekommen('Prüfhaus Rückkommen von Hand');
		const [amZiel, amAntrag] = await imRennen(h, () =>
			haltBeschlussVonHandFest(handelnder(), h.versammlung, h.traktandum, {
				ergebnis: 'angenommen',
				zahlen: {
					erfassung: 'parteien',
					stimmen: h.parteien.map((parteiId) => ({ parteiId, wahl: 'yes' as const }))
				}
			})
		);
		expect(amZiel).toBe('ok');
		expect(amAntrag).not.toBe('ok');
	});

	it('verklemmt sich nicht beim Beschluss von Hand am Antrag', async () => {
		const h = await zurueckgekommen('Prüfhaus Rückkommen Antrag von Hand');
		const [amZiel, amAntrag] = await imRennen(
			h,
			() => oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum),
			() =>
				haltBeschlussVonHandFest(handelnder(), h.versammlung, h.antrag, {
					ergebnis: 'angenommen',
					zahlen: {
						erfassung: 'parteien',
						stimmen: h.parteien.map((parteiId) => ({ parteiId, wahl: 'yes' as const }))
					}
				})
		);
		// Mindestens einer kommt durch, nacheinander; verklemmen darf sich keiner.
		expect([amZiel, amAntrag]).toContain('ok');
	});
});
