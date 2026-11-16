/**
 * Das Protokoll in der Datenbank (FR-46, FR-48 bis FR-50).
 *
 * Zwei Dinge, die hier und nirgends sonst geprüft werden können:
 *
 *   - **Der Entwurf rechnet dasselbe wie die Auswertung.** Ein Protokoll mit
 *     anderen Zahlen als die Auswertung wäre schlimmer als keines — im
 *     Streitfall stünde Aussage gegen Aussage.
 *   - **Eine festgehaltene Fassung bleibt unverändert.** Genau das verlangt
 *     FR-50, und es ist die Frage, die im Streitfall gestellt wird: Welchen
 *     Text haben die Eigentümer bekommen?
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	loescheTraktandum
} from '$lib/server/traktanden';
import { erklaereAusstand } from '$lib/server/ausstand';
import { bestaetigeVollmacht, erfasseVollmacht, holeParteien, vermerkeVorlage } from '$lib/server/vollmacht';
import { erfasseVerlassenDerVersammlung } from '$lib/server/anwesenheit';
import { holeVorgaengeFuerProtokoll, leseVerlauf } from '$lib/server/verlaufsabfrage';
import { gibStimmenAb, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { Schreibkonflikt } from '$lib/domain/schreibstand';
import {
	erzeugeProtokollentwurf,
	halteFassungFest,
	holeFassungsabdruck,
	holeFassungen,
	holeNotizen,
	holeProtokoll,
	setzeProtokollnotiz,
	speichereProtokoll
} from '$lib/server/protokoll';
import { halteFassungAmAbendFest } from '$lib/server/gemeinsamesprotokoll';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { versiegle } from '$lib/server/siegel';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

/** Das einfache Mehr der Anwesenden — die Grundlage jeder gewöhnlichen Abstimmung. */
const ERFORDERNIS: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-gewoehnliche-verwaltung',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

let betreiber: string;
let benutzer: string;

// Mit benanntem Benutzer: Eine von der Sitzungsleitung erfasste Stimme trägt
// den Vermerk «so erfasst», und die Datenbank verlangt dafür einen Namen.
function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Eine geführte Versammlung mit zwei Parteien und einem abgestimmten Antrag. */
async function aufbau(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Aebi', 'Bucher'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 500 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});

	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, ERFORDERNIS);

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	await bestaetigeAnwesenheit(handelnder(betreiber), v.id, parteien[0], 'von_hand');
	await bestaetigeAnwesenheit(handelnder(betreiber), v.id, parteien[1], 'von_hand');

	await stelleAufTraktandum(handelnder(betreiber), v.id, t.id);
	await oeffneAbstimmung(handelnder(betreiber), v.id, t.id);
	await gibStimmenAb(
		handelnder(betreiber),
		v.id,
		[
			{ parteiId: parteien[0], wahl: 'yes' },
			{ parteiId: parteien[1], wahl: 'no' }
		],
		true,
		'Prüflauf: von der Sitzungsleitung erfasst'
);
	await schliesseAbstimmung(handelnder(betreiber), v.id);

	return { versammlung: v.id, traktandum: t.id, parteien, gemeinschaft: g.id };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Protokoll');
	benutzer = await pruefbenutzer(betreiber, 'protokollleitung');
});

afterAll(verbindungenSchliessen);

describe('Notizen je Traktandum', () => {
	it('hält den Text am Traktandum fest', async () => {
		const { versammlung, traktandum } = await aufbau('Protokollweg 1', '2026-11-01');
		const e = await setzeProtokollnotiz(
			handelnder(betreiber),
			versammlung,
			traktandum,
			'Herr Aebi wies auf die Kosten hin.'
		);
		expect(e.titel).toBe('Fassadensanierung');
		expect(e.laenge).toBe(34);
	});

	it('nimmt Notizen auch nach dem Schliessen entgegen', async () => {
		// FR-46 ausdrücklich: möglich, solange nicht versiegelt ist. Das Protokoll
		// entsteht nun einmal nach der Sitzung.
		const { versammlung, traktandum } = await aufbau('Protokollweg 2', '2026-11-02');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		const e = await setzeProtokollnotiz(
			handelnder(betreiber),
			versammlung,
			traktandum,
			'Nachtrag aus dem Auto.'
		);
		expect(e.laenge).toBeGreaterThan(0);
	});

	it('weist ein fremdes Traktandum ab', async () => {
		const a = await aufbau('Protokollweg 3a', '2026-11-03');
		const b = await aufbau('Protokollweg 3b', '2026-11-04');
		await expect(
			setzeProtokollnotiz(handelnder(betreiber), a.versammlung, b.traktandum, 'Falsch.')
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/i);
	});

	it('hält jede Änderung im Verlauf fest', async () => {
		const { versammlung, traktandum } = await aufbau('Protokollweg 4', '2026-11-05');
		await setzeProtokollnotiz(handelnder(betreiber), versammlung, traktandum, 'Erst so.');
		await setzeProtokollnotiz(handelnder(betreiber), versammlung, traktandum, 'Dann anders.');
		// Derselbe Text ein zweites Mal erzeugt keinen Eintrag — sonst füllte ein
		// Formular, das beim Blättern mitgeschickt wird, den Verlauf.
		await setzeProtokollnotiz(handelnder(betreiber), versammlung, traktandum, 'Dann anders.');

		const anzahl = await imKontext(betreiber, async (tx) => {
			const [z] = await tx<{ n: number }[]>`
				SELECT count(*)::int AS n FROM audit_entry
				WHERE event_type = 'minutes.note.recorded' AND subject_id = ${traktandum}
			`;
			return z.n;
		});
		expect(anzahl).toBe(2);
	});
});

describe('Der Entwurf', () => {
	it('rechnet dasselbe wie die Auszählung und übernimmt die Notiz', async () => {
		const { versammlung, traktandum } = await aufbau('Protokollweg 5', '2026-11-06');
		await setzeProtokollnotiz(
			handelnder(betreiber),
			versammlung,
			traktandum,
			'Zur Ausführung wurde nichts beschlossen.'
		);
		await schliesseVersammlung(handelnder(betreiber), versammlung);

		const p = await erzeugeProtokollentwurf(
			handelnder(betreiber),
			versammlung,
			'6. November 2026, 21:30'
		);

		expect(p.body).toContain('Fassadensanierung');
		expect(p.body).toContain('Die Fassade wird saniert.');
		expect(p.body).toContain('Zur Ausführung wurde nichts beschlossen.');
		expect(p.body).toContain('Kopfstimmen: 1 Ja, 1 Nein');
		// Eine von zwei Stimmen ist kein einfaches Mehr.
		expect(p.body).toContain('Abgelehnt');

		/*
		 * **Die Wertung kommt aus `protokollsatz`, nicht aus `satz`** (28.08.2026,
		 * aus dem Code-Review). Der Kerntest kann das nicht sehen: Er baut die
		 * Protokollzeile selbst und liest zurück, was er hineingelegt hat. Erst
		 * hier läuft die Kette Auswertung → Protokoll, und nur hier fällt auf,
		 * wenn wieder der Leinwandsatz mit seinen Zahlen übernommen wird.
		 */
		const wertungen = p.body
			.split('\n')
			.filter((zeile) => /^(Angenommen|Abgelehnt|Stimmengleichheit)/.test(zeile));
		expect(wertungen.length).toBeGreaterThan(0);
		for (const zeile of wertungen) expect(zeile).not.toMatch(/\d/);
		// Und die Schwelle ist mit in den Spiegel gewandert.
		expect(p.body).toMatch(/\(von \d+\), nötig \d+/);
		expect(p.body).toContain('Anwesend oder vertreten (2)');
		expect(p.body).toContain('Die Versammlung ist beschlussfähig');
		/*
		 * Ä-09 über die ganze Kette: Fassung aus dem eingefrorenen Erfordernis,
		 * Einheit aus dem Nenner der Momentaufnahme. Der Kerntest legt beides
		 * selbst hinein und sähe eine fehlende Verdrahtung nicht.
		 */
		expect(p.body).toContain('Berechnungsregeln der Software Votum, Stand 30. Juli 2026.');
		expect(p.body).toContain('- Wertquoten (Tausendstel): ');
	});

	it('trägt die ruhende Vertretung als Feststellung in den Entwurf', async () => {
		/*
		 * Die Kette Auszählung → Schale → Entwurf (Fachprüfung 08.10.2026, H4):
		 * Aebi ist nur über Bucher vertreten, Bucher tritt in den Ausstand, damit
		 * ruht die Vollmacht. Der Entwurf trägt die Feststellung ohne Fundstelle.
		 */
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Protokollweg Ruhend',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const parteien: string[] = [];
		for (const [i, wer] of ['Aebi', 'Bucher', 'Christen', 'Duss'].entries()) {
			const e = await erstelleEinheit(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'unit',
				label: `Whg ${i + 1}`,
				quotas: { stamm: 250 },
				countsAsHead: true
			});
			const p = await erstelleEigentuemer(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'natural',
				displayName: wer,
				isCommunity: false,
				representativeName: null
			});
			await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
			parteien.push(p.id);
		}

		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2026-11-22',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			titel: 'Fassadensanierung',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird saniert.',
			antragstellerart: 'bewirtschaftung'
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, ERFORDERNIS);

		await gibVersammlungFrei(handelnder(betreiber), v.id);
		await eroeffneVersammlung(handelnder(betreiber), v.id);
		for (const p of parteien) await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');

		// Beide zuerst hinaus: Solange Bucher selbst im Saal steht, lässt sich
		// über Aebi keine Vollmacht erfassen (sie übt ja selbst aus).
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), v.id, parteien[0]);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), v.id, parteien[1]);
		const momentparteien = await holeParteien(betreiber, v.id);
		const nach = (wer: string) => momentparteien.find((p) => p.name === wer)!;
		const vollmacht = await erfasseVollmacht(handelnder(betreiber), v.id, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), v.id, vollmacht.id);
		await bestaetigeVollmacht(handelnder(betreiber), v.id, vollmacht.id);

		// Bucher trifft wieder ein und bringt Aebi mit (Weg `vertretung`).
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, parteien[1], 'von_hand');
		await erklaereAusstand(handelnder(betreiber), v.id, t.id, parteien[1], 'Eigene Firma.');
		await stelleAufTraktandum(handelnder(betreiber), v.id, t.id);
		await oeffneAbstimmung(handelnder(betreiber), v.id, t.id);
		await gibStimmenAb(
			handelnder(betreiber),
			v.id,
			[
				{ parteiId: parteien[2], wahl: 'yes' },
				{ parteiId: parteien[3], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		await schliesseAbstimmung(handelnder(betreiber), v.id);
		/*
		 * Ä-09: Aebi erscheint nach der Abstimmung selbst, die Vollmacht endet.
		 * Die Anwesenheitsliste zeigt den Stand am Schluss und muss deshalb
		 * sagen, dass Bucher bis dahin vertrat.
		 */
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, parteien[0], 'von_hand');
		await schliesseVersammlung(handelnder(betreiber), v.id);

		const p = await erzeugeProtokollentwurf(handelnder(betreiber), v.id, 'x');
		// Die Nummer ist die des abgestimmten Traktandums, wie sie die Überschrift führt.
		const nummer = /^#+ (\S+) Fassadensanierung$/m.exec(p.body)?.[1];
		expect(nummer).toBeTruthy();
		expect(p.body).toContain(
			`- Aebi (Whg 1) — vertreten durch Bucher bei Traktandum ${nummer} (bis `
		);
		expect(p.body).toMatch(/— vertreten durch Bucher bei Traktandum \S+ \(bis \d\d:\d\d Uhr, danach selbst anwesend\)$/m);
		expect(p.body).toContain('«Aebi» war nur über Bucher vertreten');
		expect(p.body).toContain('Bucher durfte bei diesem Traktandum niemanden vertreten');
		expect(p.body).toContain('Die Partei konnte hier keine Stimme abgeben');
		// Keine Fundstelle in der Urkunde (Fachprüfung 08.10.2026).
		expect(p.body).not.toContain('BGE 134 III 481');
	});

	it('überschreibt eine bestehende Arbeitsfassung nicht', async () => {
		// Sonst ginge die Überarbeitung lautlos verloren.
		const { versammlung } = await aufbau('Protokollweg 6', '2026-11-07');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');
		await expect(
			erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'y')
		).rejects.toThrow(/besteht bereits/i);
	});

	it('lässt sich bearbeiten und speichern', async () => {
		const { versammlung } = await aufbau('Protokollweg 7', '2026-11-08');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');

		await speichereProtokoll(handelnder(betreiber), versammlung, '# Ganz anders\n\nVon Hand.');
		const p = await holeProtokoll(betreiber, versammlung);
		expect(p?.body).toBe('# Ganz anders\n\nVon Hand.');
		expect(p?.geaendertDurch).toBe('Prüflauf');
	});

	it('speichert keinen leeren Text', async () => {
		// Ein versehentlich geleertes Feld wäre der teuerste Klick des Abends.
		const { versammlung } = await aufbau('Protokollweg 8', '2026-11-09');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');
		await expect(
			speichereProtokoll(handelnder(betreiber), versammlung, '   ')
		).rejects.toThrow(/leer/i);
	});

	it('verlangt einen Entwurf, bevor gespeichert wird', async () => {
		const { versammlung } = await aufbau('Protokollweg 9', '2026-11-10');
		await expect(
			speichereProtokoll(handelnder(betreiber), versammlung, 'Text ohne Entwurf.')
		).rejects.toThrow(/noch kein Protokoll/i);
	});
});

describe('Fassungen', () => {
	it('bleibt unverändert, wenn danach weitergearbeitet wird', async () => {
		const { versammlung } = await aufbau('Protokollweg 10', '2026-11-11');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');
		await speichereProtokoll(handelnder(betreiber), versammlung, '# Fassung eins');

		const f1 = await halteFassungFest(handelnder(betreiber), versammlung, 'festgehalten', 'per Post');
		expect(f1.nummer).toBe(1);

		await speichereProtokoll(handelnder(betreiber), versammlung, '# Fassung zwei');

		const fassungen = await holeFassungen(betreiber, versammlung);
		expect(fassungen).toHaveLength(1);
		expect(fassungen[0].body).toBe('# Fassung eins');
		expect(fassungen[0].art).toBe('festgehalten');
		expect(fassungen[0].bemerkung).toBe('per Post');
		// Die Arbeitsfassung ist weitergezogen.
		expect((await holeProtokoll(betreiber, versammlung))?.body).toBe('# Fassung zwei');
	});

	it('liefert den Abdruck der versandten Fassung, nicht des lebenden Textes', async () => {
		/*
		 * **Der Anker für das Genehmigungstraktandum** (22.08.2026). Die nächste
		 * Versammlung genehmigt eine bestimmte Fassung und nennt deren Prüfsumme im
		 * Antrag. Wäre der Abdruck über den lebenden Text gebildet, wäre er schon
		 * falsch, bevor die Einladung gedruckt ist — jede weitere Überarbeitung
		 * änderte ihn.
		 */
		const { versammlung } = await aufbau('Protokollweg 10a', '2026-11-21');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');
		await speichereProtokoll(handelnder(betreiber), versammlung, '# Das versandte Protokoll');
		await versiegle(handelnder(betreiber), versammlung, '2026-11-21 21:30:00');
		await halteFassungFest(handelnder(betreiber), versammlung, 'versandt');

		const vorher = await holeFassungsabdruck(betreiber, versammlung);
		expect(vorher?.art).toBe('versandt');
		expect(vorher?.abdruck).toMatch(/^[0-9a-f]{64}$/);

		// Weiterarbeiten ändert den Abdruck NICHT.
		await speichereProtokoll(handelnder(betreiber), versammlung, '# Danach umgeschrieben');
		expect((await holeFassungsabdruck(betreiber, versammlung))?.abdruck).toBe(vorher?.abdruck);
	});

	it('nimmt die versandte Fassung auch dann, wenn danach festgehalten wurde', async () => {
		// Versandt ist, was die Eigentümer in Händen halten — nur darauf kann sich
		// ein Beschluss der nächsten Versammlung beziehen.
		const { versammlung } = await aufbau('Protokollweg 10b', '2026-11-22');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');
		await speichereProtokoll(handelnder(betreiber), versammlung, '# Versandt');
		await versiegle(handelnder(betreiber), versammlung, '2026-11-22 21:30:00');
		await halteFassungFest(handelnder(betreiber), versammlung, 'versandt');
		const versandt = await holeFassungsabdruck(betreiber, versammlung);

		await speichereProtokoll(handelnder(betreiber), versammlung, '# Nur intern');
		await halteFassungFest(handelnder(betreiber), versammlung, 'festgehalten');

		expect((await holeFassungsabdruck(betreiber, versammlung))?.abdruck).toBe(versandt?.abdruck);
	});

	it('liefert nichts, solange keine Fassung festgehalten ist', async () => {
		const { versammlung } = await aufbau('Protokollweg 10c', '2026-11-23');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');
		expect(await holeFassungsabdruck(betreiber, versammlung)).toBeNull();
	});

	it('zählt die Fassungen aufwärts', async () => {
		const { versammlung } = await aufbau('Protokollweg 11', '2026-11-12');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');
		await halteFassungFest(handelnder(betreiber), versammlung, 'festgehalten');
		const zweite = await halteFassungFest(handelnder(betreiber), versammlung, 'genehmigt');
		expect(zweite.nummer).toBe(2);
		expect((await holeFassungen(betreiber, versammlung)).map((f) => f.nummer)).toEqual([2, 1]);
	});

	it('lässt eine festgehaltene Fassung nicht ändern und nicht löschen', async () => {
		const { versammlung } = await aufbau('Protokollweg 12', '2026-11-13');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');
		const f = await halteFassungFest(handelnder(betreiber), versammlung, 'festgehalten');

		/*
		 * **Zwei Schranken, beide belegt** (Audit B-03, 08.08.2026). Seit
		 * Migration 055 fehlen der Anwendungsrolle Änderungs- und Löschrecht und
		 * greifen **vor** dem Auslöser. Damit ein gefallener Auslöser nicht
		 * unbemerkt bliebe, wird er unter der privilegierten Rolle geprüft — sie
		 * umgeht den Rechteentzug, nicht aber einen Auslöser.
		 */
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE minutes_version SET body = 'gefälscht' WHERE id = ${f.id}`)
		).rejects.toThrow(/denied|verweigert/i);
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM minutes_version WHERE id = ${f.id}`)
		).rejects.toThrow(/denied|verweigert/i);

		await expect(
			admin`UPDATE minutes_version SET body = 'gefälscht' WHERE id = ${f.id}`
		).rejects.toThrow(/nicht geändert/i);
		await expect(admin`DELETE FROM minutes_version WHERE id = ${f.id}`).rejects.toThrow(
			/nicht gelöscht/i
		);
	});

	it('hält ohne Protokoll gar nichts fest', async () => {
		// Die Prüfung auf das Protokoll steht vor der auf das Siegel: Ohne
		// Entwurf ist «es besteht noch kein Protokoll» die genauere Auskunft.
		const { versammlung } = await aufbau('Protokollweg 13', '2026-11-14');
		await expect(
			halteFassungFest(handelnder(betreiber), versammlung, 'versandt')
		).rejects.toThrow(/noch kein Protokoll/i);
	});
});

/**
 * «Versandt» nur mit Siegel (Block 8, Produktentscheid 30.09.2026).
 *
 * **Die Sperre sitzt im Server, nicht nur auf der Seite.** Ein Protokoll gilt
 * erst versiegelt als versandt: Mit dem Siegel entsteht das Abschlusspaket, auf
 * das sich der Versand bezieht. `genehmigt` und `festgehalten` beziehen sich
 * dagegen auf die Versammlung und bleiben ohne Siegel möglich.
 */
describe('«versandt» nur mit Siegel', () => {
	it('weist eine versandte Fassung ohne Siegel ab und nennt den Weg', async () => {
		const { versammlung } = await aufbau('Versandweg 1', '2026-11-24');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');

		await expect(
			halteFassungFest(handelnder(betreiber), versammlung, 'versandt')
		).rejects.toThrow(/Versiegeln Sie dann/);
		// Und nichts ist entstanden — die abgewiesene Fassung wäre sonst ein
		// Versandnachweis ohne Versand.
		expect(await holeFassungen(betreiber, versammlung)).toHaveLength(0);
	});

	it('nimmt «genehmigt» und «festgehalten» auch ohne Siegel an', async () => {
		const { versammlung } = await aufbau('Versandweg 2', '2026-11-25');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');

		expect(
			(await halteFassungFest(handelnder(betreiber), versammlung, 'genehmigt')).art
		).toBe('genehmigt');
		expect(
			(await halteFassungFest(handelnder(betreiber), versammlung, 'festgehalten')).art
		).toBe('festgehalten');
	});

	it('nimmt «versandt» nach dem Siegel an', async () => {
		const { versammlung } = await aufbau('Versandweg 3', '2026-11-26');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');
		await versiegle(handelnder(betreiber), versammlung, '2026-11-26 21:30:00');

		expect(
			(await halteFassungFest(handelnder(betreiber), versammlung, 'versandt')).art
		).toBe('versandt');
	});

	/*
	 * **Die Sperre auch in der Datenbank** (Produktentscheid 03.10.2026:
	 * «Ja, auch in der Datenbank», Migration 138). Die Prüfung in
	 * `halteFassungFest` ist die Führung; wer an ihr vorbei schreibt — eine
	 * spätere Fassung, ein Skript, ein direkter Zugriff —, kommt am Auslöser
	 * nicht vorbei. Geprüft wird der rohe INSERT, weil genau das der Weg ist,
	 * den die Anwendung nicht nimmt.
	 */
	it('weist den rohen INSERT ohne Siegel ab (Migration 138)', async () => {
		const { versammlung } = await aufbau('Versandweg 4', '2026-11-27');
		await schliesseVersammlung(handelnder(betreiber), versammlung);

		await expect(
			admin`
				INSERT INTO minutes_version (operator_id, meeting_id, number, body, kind)
				VALUES (${betreiber}, ${versammlung}, 1, 'Protokoll der Prüfung', 'versandt')
			`
		).rejects.toThrow(/Siegel|versiegelt/);
		expect(await holeFassungen(betreiber, versammlung)).toHaveLength(0);
	});

	/*
	 * **Seit Migration 161 nicht mehr ohne Nachtragssiegel** (H8, Teil B). Bis
	 * dahin nahm diese Probe den rohen INSERT nach dem Siegel an; dass
	 * «versandt» nach dem Siegel zulässig ist, belegt der Weg über
	 * `halteFassungFest` weiter oben. Jetzt verlangt der Auslöser zusätzlich
	 * das Nachtragssiegel, auch an der Anwendung vorbei.
	 */
	it('weist den rohen INSERT an einer versiegelten Versammlung ohne Nachtragssiegel ab', async () => {
		const { versammlung } = await aufbau('Versandweg 5', '2026-11-28');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await versiegle(handelnder(betreiber), versammlung, '2026-11-28 21:30:00');

		await expect(
			admin`
				INSERT INTO minutes_version (operator_id, meeting_id, number, body, kind)
				VALUES (${betreiber}, ${versammlung}, 1, 'Protokoll der Prüfung', 'versandt')
			`
		).rejects.toThrow(/braucht ein Nachtragssiegel/);
		expect(await holeFassungen(betreiber, versammlung)).toHaveLength(0);
	});
});

describe('Zwei Fenster auf demselben Text', () => {
	it('überschreibt eine fremde Änderung nicht stillschweigend', async () => {
		// Dasselbe Feld steht an zwei Stellen — in der Sitzungsleitung und auf der
		// Protokollseite. Wer beide offen hat, überschriebe sonst die frische
		// Fassung mit einer alten, und niemand sähe es.
		const { versammlung, traktandum } = await aufbau('Protokollweg 14', '2026-11-15');
		await setzeProtokollnotiz(handelnder(betreiber), versammlung, traktandum, 'Erster Stand.');

		// Das zweite Fenster kennt noch den leeren Anfangsstand.
		await expect(
			setzeProtokollnotiz(handelnder(betreiber), versammlung, traktandum, 'Aus dem alten Fenster.', '')
		).rejects.toThrow(Schreibkonflikt);

		const notizen = await holeNotizen(betreiber, versammlung);
		expect(notizen.get(traktandum)).toBe('Erster Stand.');
	});

	it('lässt durch, wer den geltenden Stand kennt', async () => {
		const { versammlung, traktandum } = await aufbau('Protokollweg 15', '2026-11-16');
		await setzeProtokollnotiz(handelnder(betreiber), versammlung, traktandum, 'Erster Stand.');
		await setzeProtokollnotiz(
			handelnder(betreiber),
			versammlung,
			traktandum,
			'Zweiter Stand.',
			'Erster Stand.'
		);
		expect((await holeNotizen(betreiber, versammlung)).get(traktandum)).toBe('Zweiter Stand.');
	});

	it('lässt das Erzwingen ohne Angabe des Standes zu', async () => {
		// So setzt der Knopf «Meinen Text durchsetzen» den Konflikt auf: Er schickt
		// gar keinen Stand mit. (Bis zum 26.08.2026 hiess das `null`; seither ist
		// `null` ein gültiger Stand — nämlich «das Feld war leer».)
		const { versammlung, traktandum } = await aufbau('Protokollweg 16', '2026-11-17');
		await setzeProtokollnotiz(handelnder(betreiber), versammlung, traktandum, 'Fremd.');
		await setzeProtokollnotiz(handelnder(betreiber), versammlung, traktandum, 'Meiner.', undefined);
		expect((await holeNotizen(betreiber, versammlung)).get(traktandum)).toBe('Meiner.');
	});

	it('schützt den Protokolltext genauso', async () => {
		const { versammlung } = await aufbau('Protokollweg 17', '2026-11-18');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), versammlung, 'x');
		await speichereProtokoll(handelnder(betreiber), versammlung, '# Erster Stand');

		await expect(
			speichereProtokoll(handelnder(betreiber), versammlung, '# Aus dem alten Fenster', '# Entwurf')
		).rejects.toThrow(Schreibkonflikt);
		expect((await holeProtokoll(betreiber, versammlung))?.body).toBe('# Erster Stand');
	});

	it('nimmt denselben Text zweimal widerspruchslos an', async () => {
		// Zwei Auslöser können dasselbe schicken — Innehalten und Verlassen des
		// Feldes. Das darf keinen Konflikt erzeugen.
		const { versammlung, traktandum } = await aufbau('Protokollweg 18', '2026-11-19');
		await setzeProtokollnotiz(handelnder(betreiber), versammlung, traktandum, 'Gleich.', '');
		await setzeProtokollnotiz(handelnder(betreiber), versammlung, traktandum, 'Gleich.', '');
		expect((await holeNotizen(betreiber, versammlung)).get(traktandum)).toBe('Gleich.');
	});
});

/**
 * Die Kette über zwei Versammlungen (22.08.2026).
 *
 * **Der Gedanke** (Auftraggeber): «Das Protokoll wird doch in den ersten 30 Tagen
 * relevant sein, wegen der Anfechtung. Im nächsten Jahr wird das Protokoll in
 * der Folgeversammlung freigegeben. Dann muss man doch nur noch belegen, dass
 * das Protokoll von damals stammt.»
 *
 * Genau dafür nennt das Genehmigungstraktandum die Prüfsumme: Der Beschluss der
 * Folgeversammlung bezeugt, welche Fassung gilt — gefasst von den Menschen, die
 * im Streitfall Gegenpartei wären. Keine Bezeugung durch die Bewirtschaftung,
 * sondern durch die Versammlung selbst.
 */
describe('Die Prüfsumme im Genehmigungstraktandum', () => {
	async function mitProtokoll(name: string, datum: string, text: string) {
		const s = await aufbau(name, datum);
		await schliesseVersammlung(handelnder(betreiber), s.versammlung);
		await erzeugeProtokollentwurf(handelnder(betreiber), s.versammlung, 'x');
		await speichereProtokoll(handelnder(betreiber), s.versammlung, text);
		await versiegle(handelnder(betreiber), s.versammlung, `${datum} 21:30:00`);
		await halteFassungFest(handelnder(betreiber), s.versammlung, 'versandt');
		return s;
	}

	it('nennt die Fassung der Vorgängerin mit ihrer Prüfsumme', async () => {
		const erste = await mitProtokoll('Kettenweg 1', '2026-05-12', '# Protokoll 2026');
		const abdruck = await holeFassungsabdruck(betreiber, erste.versammlung);

		const zweite = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: erste.gemeinschaft,
			datum: '2027-05-12',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});

		const traktanden = await holeTraktanden(betreiber, zweite.id);
		const genehmigung = traktanden.find((t) =>
			/Genehmigung des Protokolls/.test(t.knoten.titel)
		);
		expect(genehmigung, 'Pflichttraktandum fehlt').toBeTruthy();
		expect(genehmigung?.knoten.antragswortlaut).toContain(abdruck?.abdruck);
		// Und das Datum der Versammlung, die genehmigt wird — «die letzte» wäre
		// ein Jahr später nicht mehr eindeutig.
		expect(genehmigung?.knoten.antragswortlaut).toMatch(/12\. Mai 2026/);
	});

	it('bleibt beim allgemeinen Wortlaut, wenn keine Fassung festgehalten ist', async () => {
		// Ein Antrag mit einer Lücke darin wäre schlimmer als einer ohne Prüfsumme.
		const erste = await aufbau('Kettenweg 2', '2026-05-13');
		await schliesseVersammlung(handelnder(betreiber), erste.versammlung);

		const zweite = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: erste.gemeinschaft,
			datum: '2027-05-13',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});

		const traktanden = await holeTraktanden(betreiber, zweite.id);
		const genehmigung = traktanden.find((t) =>
			/Genehmigung des Protokolls/.test(t.knoten.titel)
		);
		expect(genehmigung?.knoten.antragswortlaut).toBe(
			'Das Protokoll der letzten Versammlung wird genehmigt.'
		);
		expect(genehmigung?.knoten.antragswortlaut).not.toMatch(/[0-9a-f]{64}/);
	});

	it('nennt keine Prüfsumme ohne Vorgängerin', async () => {
		const s = await aufbau('Kettenweg 3', '2026-05-14');
		const traktanden = await holeTraktanden(betreiber, s.versammlung);
		const genehmigung = traktanden.find((t) =>
			/Genehmigung des Protokolls/.test(t.knoten.titel)
		);
		expect(genehmigung?.knoten.antragswortlaut).not.toMatch(/[0-9a-f]{64}/);
	});
});

/**
 * Ein Protokollvorgang an einem Traktandum, das danach entfernt wurde
 * (Auftrag D, Produktentscheid 01.10.2026: «Folgeblock»).
 *
 * **Die Lücke.** `holeVorgaengeFuerProtokoll` ordnete Ereignisse am Traktandum
 * über die **lebenden** Zeilen zu. Ein Ausstand lässt sich im Entwurf erklären,
 * und `loescheTraktandum` lässt im Entwurf entfernen. Danach trug der Vorgang
 * eine Kennung ohne Zeile und fehlte bei den Protokollvorgängen, während der
 * Verlauf ihn seit `f0b1dd9` über das Entfernen-Ereignis behält.
 *
 * **Gemessen wird `holeVorgaengeFuerProtokoll`, nicht der Protokolltext.** Im
 * Protokoll erscheint der Vorgang weiterhin nicht, weil `holeAuswertung` ihn an
 * die Zeile seines Traktandums hängt und ein entferntes keine hat; das bleibt
 * so, weil der Verlauf ihn führt («zeigt den erklärten Ausstand im Verlauf der
 * Versammlung»). «kommt bei einer anderen Versammlung nicht herein» war schon
 * vor dem Bau grün; sie ist die Gegenprobe gegen eine zu weite Zuordnung,
 * nicht der Nachweis der Lücke.
 */
describe('Protokollvorgänge an einem entfernten Traktandum', () => {
	/** Eine Versammlung im Entwurf mit einer Partei und einem Traktandum. */
	async function entwurf(name: string, datum: string) {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: 'Whg 1',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Aebi',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');

		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum,
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			titel: 'Vergabe des Hauswartauftrags',
			art: 'abstimmung',
			antragswortlaut: 'Der Hauswartauftrag wird vergeben.',
			antragstellerart: 'bewirtschaftung'
		});

		return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, partei: p.id };
	}

	it('behält den erklärten Ausstand, wenn das Traktandum entfernt wird', async () => {
		const s = await entwurf('Entferntes Traktandum 1', '2026-11-27');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.partei,
			'Der Auftrag geht an die eigene Firma.'
		);
		await loescheTraktandum(handelnder(betreiber), s.versammlung, s.traktandum);

		const vorgaenge = await holeVorgaengeFuerProtokoll(betreiber, s.versammlung);
		const ausstand = vorgaenge.filter((v) => v.art === 'agenda.item.recusal.declared');
		expect(ausstand).toHaveLength(1);
		expect(ausstand[0].traktandumId).toBe(s.traktandum);
	});

	/**
	 * **Der Verlauf führt ihn** (Produktentscheid 03.10.2026: Ein solcher Vorgang
	 * kommt nicht ins Protokoll, «ok, wenn der Verlauf das festhält»). Der
	 * Entscheid trägt nur, solange diese Probe grün ist.
	 */
	it('zeigt den erklärten Ausstand im Verlauf der Versammlung', async () => {
		const s = await entwurf('Entferntes Traktandum 3', '2026-11-30');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.partei,
			'Der Auftrag geht an die eigene Firma.'
		);
		await loescheTraktandum(handelnder(betreiber), s.versammlung, s.traktandum);

		const { zeilen } = await leseVerlauf(betreiber, { versammlung: s.versammlung });
		const meine = zeilen.filter((z) => z.gegenstandId === s.traktandum).map((z) => z.art);
		expect(meine).toContain('agenda.item.recusal.declared');
		expect(meine).toContain('agenda.item.removed');
	});

	it('kommt bei einer anderen Versammlung nicht herein', async () => {
		const eine = await entwurf('Entferntes Traktandum 2a', '2026-11-28');
		const andere = await entwurf('Entferntes Traktandum 2b', '2026-11-29');
		await erklaereAusstand(
			handelnder(betreiber),
			eine.versammlung,
			eine.traktandum,
			eine.partei,
			'Der Auftrag geht an die eigene Firma.'
		);
		await loescheTraktandum(handelnder(betreiber), eine.versammlung, eine.traktandum);

		expect(await holeVorgaengeFuerProtokoll(betreiber, andere.versammlung)).toEqual([]);
	});
});

/**
 * Fassungen am Haus eines gemeinsamen Abends (A2, Produktentscheid 03.10.2026:
 * «Fassung je Haus»).
 *
 * Dort gibt es keine eigene Arbeitsfassung: `minutes` bleibt leer, und der Text
 * ist die Zusammenstellung des Abends in dem Augenblick, in dem das Haus sie
 * festhält. Geprüft wird der Schreibweg (`halteFassungAmAbendFest`), dass die
 * Sperre «versandt nur versiegelt» auch hier greift, die mögliche Abweichung
 * zwischen den Hausfassungen und die Genehmigung je Haus.
 */
describe('Fassungen am Haus eines gemeinsamen Abends', () => {
	/**
	 * Ein geschlossenes Haus mit zwei Parteien.
	 *
	 * Versiegelt wird **nach** dem Aufnehmen in den Abend: `nimmInTagAuf` zieht
	 * die losen Pflichttraktanden des Hauses in die gemeinsame Liste, und an
	 * einem versiegelten Haus weist die Datenbank jede Änderung am Traktandum ab
	 * (FR-55). Der Weg der Anwendung nimmt ein Haus lange vor dem Siegel auf.
	 */
	async function haus(name: string, datum: string) {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		for (const [i, wer] of ['Aebi', 'Bucher'].entries()) {
			const e = await erstelleEinheit(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'unit',
				label: `Whg ${i + 1}`,
				quotas: { stamm: 500 },
				countsAsHead: true
			});
			const p = await erstelleEigentuemer(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'natural',
				displayName: wer,
				isCommunity: false,
				representativeName: null
			});
			await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		}
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum,
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await gibVersammlungFrei(handelnder(betreiber), v.id);
		await eroeffneVersammlung(handelnder(betreiber), v.id);
		await schliesseVersammlung(handelnder(betreiber), v.id);
		return { gemeinschaft: g.id, versammlung: v.id };
	}

	async function abend(bezeichnung: string, datum: string, haeuser: string[]) {
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung,
			datum,
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich'
		});
		for (const [i, versammlung] of haeuser.entries()) {
			await nimmInTagAuf(handelnder(betreiber), tag.id, versammlung, i + 1);
		}
		return tag;
	}

	/** Eine spätere, geschlossene Versammlung derselben Gemeinschaft. */
	async function folgeversammlung(gemeinschaft: string, datum: string) {
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: gemeinschaft,
			datum,
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await gibVersammlungFrei(handelnder(betreiber), v.id);
		await eroeffneVersammlung(handelnder(betreiber), v.id);
		await schliesseVersammlung(handelnder(betreiber), v.id);
	}

	it('hält die Zusammenstellung als Fassung des Hauses fest, ohne eigene Arbeitsfassung', async () => {
		const a = await haus('Abendfassung A', '2025-03-10');
		const tag = await abend('Abendfassung 1', '2025-03-10', [a.versammlung]);

		// Kein eigenes Protokoll — genau dafür gibt es den zweiten Weg.
		expect(await holeProtokoll(betreiber, a.versammlung)).toBeNull();

		const f = await halteFassungAmAbendFest(
			handelnder(betreiber),
			a.versammlung,
			tag.id,
			'festgehalten',
			'per Post',
			'10. März 2025, 21:30'
		);
		expect(f.art).toBe('festgehalten');
		expect(f.body).toContain('# Protokoll der gemeinsamen Versammlung');
		expect(f.body).toContain('Abendfassung 1');
		expect(f.body).toContain('Erzeugt am 10. März 2025, 21:30');

		const fassungen = await holeFassungen(betreiber, a.versammlung);
		expect(fassungen).toHaveLength(1);
		expect(fassungen[0].body).toBe(f.body);
		expect(fassungen[0].bemerkung).toBe('per Post');
		// Die Fassung ist ein Abzug, keine Arbeitsfassung: Es bleibt bei null.
		expect(await holeProtokoll(betreiber, a.versammlung)).toBeNull();
	});

	it('weist ein Haus ab, das nicht zu diesem Abend gehört', async () => {
		/*
		 * Die Gegenprobe zur Bindung (Codeprüfung 03.10.2026). Der Abend kommt
		 * aus der Adresse der Hausseite; ohne `hausDesAbends` liesse sich mit dem
		 * fremden Abend ein Haus als dessen Teil ausgeben. Der Fall muss rot
		 * sein, sonst ist die Schranke unbeobachtet.
		 */
		const a = await haus('Fremder Abend A', '2025-05-01');
		const b = await haus('Fremder Abend B', '2025-05-01');
		await abend('Fremder Abend 1', '2025-05-01', [a.versammlung]);
		const tagB = await abend('Fremder Abend 2', '2025-05-01', [b.versammlung]);

		await expect(
			halteFassungAmAbendFest(
				handelnder(betreiber),
				a.versammlung,
				tagB.id,
				'festgehalten',
				null,
				'1. Mai 2025, 21:30'
			)
		).rejects.toThrow(/gehört nicht zu diesem Abend/);
		expect(await holeFassungen(betreiber, a.versammlung)).toHaveLength(0);
	});

	it('weist «versandt» ohne das Siegel des Hauses ab und nimmt es danach an', async () => {
		const a = await haus('Abendversand A', '2025-03-11');
		const tag = await abend('Abendversand 1', '2025-03-11', [a.versammlung]);

		await expect(
			halteFassungAmAbendFest(
				handelnder(betreiber),
				a.versammlung,
				tag.id,
				'versandt',
				null,
				'11. März 2025, 21:30'
			)
		).rejects.toThrow(/Versiegeln Sie dann/);
		expect(await holeFassungen(betreiber, a.versammlung)).toHaveLength(0);

		await versiegle(handelnder(betreiber), a.versammlung, '2025-03-11 21:30:00');
		expect(
			(
				await halteFassungAmAbendFest(
					handelnder(betreiber),
					a.versammlung,
					tag.id,
					'versandt',
					null,
					'11. März 2025, 22:00'
				)
			).art
		).toBe('versandt');
	});

	it('zeigt, dass die Fassungen zweier Festhalten abweichen können', async () => {
		/*
		 * **Der Entscheid zum offenen Punkt des Auftrags.** Verhindert wird die
		 * Abweichung nicht: Sie ist die Folge davon, dass jedes Haus nach seinem
		 * eigenen Siegel festhält (Produktentscheid 3) und der Text bei jedem
		 * Aufruf neu entsteht. Gezeigt wird sie — jede Fassung bleibt mit ihrem
		 * eigenen Stand lesbar.
		 */
		const a = await haus('Abweichung A', '2025-03-12');
		const b = await haus('Abweichung B', '2025-03-12');
		const tag = await abend('Abweichung 1', '2025-03-12', [a.versammlung, b.versammlung]);
		await versiegle(handelnder(betreiber), a.versammlung, '2025-03-12 21:00:00');

		// Haus B ist noch nicht versiegelt: Das steht im Abenddokument.
		const frueh = await halteFassungAmAbendFest(
			handelnder(betreiber),
			a.versammlung,
			tag.id,
			'festgehalten',
			null,
			'12. März 2025, 10:00'
		);
		expect(frueh.body).toContain('Noch nicht versiegelt');
		expect(frueh.body).toContain('Abweichung B');

		// B versiegelt, A hält danach erneut fest: derselbe Abend, anderer Stand.
		await versiegle(handelnder(betreiber), b.versammlung, '2025-03-12 21:30:00');
		const spaet = await halteFassungAmAbendFest(
			handelnder(betreiber),
			a.versammlung,
			tag.id,
			'festgehalten',
			null,
			'12. März 2025, 22:00'
		);
		expect(spaet.body).not.toContain('Noch nicht versiegelt');
		expect(spaet.body).not.toBe(frueh.body);

		const fassungen = await holeFassungen(betreiber, a.versammlung);
		expect(fassungen.map((f) => f.nummer)).toEqual([2, 1]);
		expect(fassungen.find((f) => f.nummer === 1)?.body).toContain('Noch nicht versiegelt');
		expect(fassungen.find((f) => f.nummer === 2)?.body).not.toContain('Noch nicht versiegelt');
	});

	it('macht «genehmigt» erfassbar, und die Löschbedingung greift', async () => {
		const a = await haus('Abendgenehmigung A', '2025-03-13');
		const tag = await abend('Abendgenehmigung 1', '2025-03-13', [a.versammlung]);
		await versiegle(handelnder(betreiber), a.versammlung, '2025-03-13 21:00:00');
		await halteFassungAmAbendFest(
			handelnder(betreiber),
			a.versammlung,
			tag.id,
			'versandt',
			null,
			'13. März 2025, 21:30'
		);

		// Die nächste Versammlung desselben Hauses hat stattgefunden.
		await folgeversammlung(a.gemeinschaft, '2025-04-10');
		expect(
			(
				await halteFassungAmAbendFest(
					handelnder(betreiber),
					a.versammlung,
					tag.id,
					'genehmigt',
					null,
					'10. April 2025, 22:00'
				)
			).art
		).toBe('genehmigt');

		const [z] = await imKontext(
			betreiber,
			(tx) =>
				tx<{ stand: string }[]>`SELECT protokoll_genehmigung(${a.versammlung}) AS stand`
		);
		expect(z.stand).toBe('genehmigt');
	});
});
