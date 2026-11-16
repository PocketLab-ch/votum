/**
 * Was eine Reglementsregel an dem ändert, was schon dasteht (23.08.2026).
 *
 * **Der Befund** (Prüflauf II, B-01): Ein Erfordernis wird beim Anlegen eines
 * Traktandums hergeleitet und in die Zeile geschrieben — eine Momentaufnahme,
 * keine Ableitung. Wer die Reglementsregel danach erfasst, ändert daran nichts.
 * In derselben Traktandenliste standen deshalb zwei verschiedene Erfordernisse
 * für denselben Fall, und die Liste dient als Einladung: angekündigt war das
 * falsche Mehr.
 *
 * Hier steht beides: dass die Abweichung gefunden wird, und dass sie nur dort
 * gefunden wird, wo sie hingehört.
 */
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	stelleRueckkommensantrag
} from '$lib/server/traktanden';
import {
	erstelleReglementsregel,
	erfordernisseNachziehen,
	holeReglementsregeln,
	loescheReglementsregel,
	veralteteErfordernisse
} from '$lib/server/reglement';
import { schreibeErfordernisIn } from '$lib/server/erfordernisse';
import {
	erfordernisAus,
	laufe,
	setzeErfordernis,
	waehleErfordernis,
	type Erfordernis
} from '$lib/domain/entscheidbaum';
import { wendeReglementAn } from '$lib/domain/reglement';
import { holeRegelwerk } from '$lib/rules';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { gibStimmenAb, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { uebernimmTraktanden } from '$lib/server/vorlagen';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let stweg: string;
let versammlung: string;

/** Der Fall, auf den sich die Regel bezieht: notwendige bauliche Massnahme. */
/*
 * **Nicht mehr die notwendige bauliche Massnahme** (23.09.2026). Diese Proben
 * brauchen einen Knoten, an dem eine hinterlegte Reglementsregel tatsächlich
 * greift; sonst messen sie nur, dass die Sperre wirkt. Seit der Fassung
 * 2026-09-23 sind die baulichen Massnahmen gesperrt, weil ihr Quorum aus
 * Art. 647a bis 647e stammt und damit unter Art. 712g Abs. 2 fällt (Befund
 * B-02 der Rechtsprüfung vom 22.09.2026).
 *
 * `k-nutzungsrecht-zuteilung` ist einer der acht Knoten, die frei bleiben,
 * weil sie nicht auf Art. 647 ff. beruhen.
 */
const KNOTEN = 'k-nutzungsrecht-zuteilung';

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/** Ein Abstimmungstraktandum mit dem gesetzlichen Erfordernis dieses Falls. */
async function traktandumMitGesetz(titel: string, meetingId = versammlung): Promise<string> {
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId,
		titel,
		art: 'abstimmung',
		antragswortlaut: `${titel} wird beschlossen.`,
		antragstellerart: 'bewirtschaftung'
	});
	const gesetz = waehleErfordernis(holeRegelwerk(), KNOTEN).ergebnis!;
	await imKontext(betreiber, (tx) => schreibeErfordernisIn(tx, handelnder(betreiber), t.id, gesetz));
	return t.id;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Erfordernisse nachziehen');
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name: 'STWEG Nachzugsweg',
		quotaDenominator: 1000,
		headCountMode: 'per_unit',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: stweg,
		datum: '2027-03-04',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	versammlung = v.id;
});

afterAll(verbindungenSchliessen);

describe('findet, was die Regel ändern würde', () => {
	it('meldet nichts, solange keine Regel besteht', async () => {
		await traktandumMitGesetz('Dachrinne ersetzen');
		expect(await veralteteErfordernisse(betreiber, stweg)).toEqual([]);
	});

	it('meldet das Traktandum, sobald eine Regel dazukommt', async () => {
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: stweg,
			geschaeftsart: 'nutzungsrechte',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'alle_eigentuemer',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 18.3',
			enthaltungZaehltMit: true
		});

		const offen = await veralteteErfordernisse(betreiber, stweg);
		expect(offen.length).toBe(1);
		expect(offen[0].titel).toBe('Dachrinne ersetzen');
		expect(offen[0].bisher).toMatch(/Anwesenden/);
		expect(offen[0].neu).toMatch(/2\/3 aller Eigentümer/);
		expect(offen[0].neu).toMatch(/Ziff\. 18\.3/);
	});

	it('zieht nach und meldet danach nichts mehr', async () => {
		const { nachgezogen } = await erfordernisseNachziehen(handelnder(betreiber), stweg);
		expect(nachgezogen).toBe(1);
		expect(await veralteteErfordernisse(betreiber, stweg)).toEqual([]);
	});

	it('meldet auch die Gegenrichtung, wenn die Regel wieder fällt', async () => {
		// Wer eine Regel aufhebt, hat dasselbe Problem in die andere Richtung:
		// Die Traktanden tragen dann eine Schwelle, für die es keine Grundlage
		// mehr gibt. Im Prüflauf am lebenden System nachgestellt.
		const [regel] = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`SELECT id FROM bylaw_quorum_rule WHERE stweg_id = ${stweg}`
		);
		await loescheReglementsregel(handelnder(betreiber), regel.id);

		const offen = await veralteteErfordernisse(betreiber, stweg);
		expect(offen.length).toBe(1);
		expect(offen[0].bisher).toMatch(/2\/3 aller Eigentümer/);
		expect(offen[0].neu).toMatch(/Anwesenden/);

		await erfordernisseNachziehen(handelnder(betreiber), stweg);
		expect(await veralteteErfordernisse(betreiber, stweg)).toEqual([]);
	});

	it('schreibt die Tilgung samt Vorher-Nachher in den Verlauf', async () => {
		const spuren = await imKontext(betreiber, (tx) =>
			tx<{ detail: { anzahl: number; traktanden: string[] } }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = 'bylaw.requirements.rederived' AND subject_id = ${stweg}::text
				 ORDER BY occurred_at
			`
		);
		expect(spuren.length, 'zweimal nachgezogen, zweimal vermerkt').toBe(2);
		expect(spuren[0].detail.anzahl).toBe(1);
		expect(spuren[0].detail.traktanden[0]).toMatch(/Dachrinne ersetzen/);
	});
});

describe('lässt in Ruhe, was in Ruhe gehört', () => {
	it('rührt ein von Hand gesetztes Erfordernis nicht an', async () => {
		const id = await traktandumMitGesetz('Fassade mit eigener Begründung');
		await imKontext(betreiber, (tx) =>
			tx`UPDATE agenda_item SET requirement_reason = 'Die Leitung hat anders entschieden.'
			    WHERE id = ${id}`
		);
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: stweg,
			geschaeftsart: 'nutzungsrechte',
			kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
			kopfbasis: 'alle_eigentuemer',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 19.1',
			enthaltungZaehltMit: true
		});

		const offen = await veralteteErfordernisse(betreiber, stweg);
		expect(
			offen.map((o) => o.titel),
			'die Zeile mit eigener Begründung bleibt aussen vor'
		).not.toContain('Fassade mit eigener Begründung');
		expect(offen.length, 'die andere wird sehr wohl gemeldet').toBe(1);
	});

	it('rührt eine eröffnete Versammlung nicht an', async () => {
		/*
		 * Nach welchem Mehr ausgezählt wird, muss vor der Abstimmung feststehen —
		 * dieselbe Schranke wie beim Ändern von Hand. Ohne sie könnte eine Regel,
		 * die während der Versammlung erfasst wird, die Schwelle unter einer
		 * laufenden Auszählung verschieben.
		 */
		await erfordernisseNachziehen(handelnder(betreiber), stweg);
		expect(await veralteteErfordernisse(betreiber, stweg)).toEqual([]);

		// Der Zustand hängt an seinen Zeitstempeln (CHECK `meeting_zeitstempel`):
		// «laufend» verlangt released_at UND opened_at. Von Hand gesetzt, weil der
		// Weg über die Freigabe hier nichts zur Sache beiträgt.
		await imKontext(betreiber, (tx) =>
			tx`UPDATE meeting SET state = 'laufend', released_at = now(), opened_at = now()
			    WHERE id = ${versammlung}`
		);
		const [regel] = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`SELECT id FROM bylaw_quorum_rule WHERE stweg_id = ${stweg}`
		);
		await loescheReglementsregel(handelnder(betreiber), regel.id);

		expect(
			await veralteteErfordernisse(betreiber, stweg),
			'die Regel fiel, aber die Versammlung läuft — nichts wird gemeldet'
		).toEqual([]);
		const { nachgezogen } = await erfordernisseNachziehen(handelnder(betreiber), stweg);
		expect(nachgezogen).toBe(0);

		await imKontext(betreiber, (tx) =>
			tx`UPDATE meeting SET state = 'freigegeben', opened_at = NULL WHERE id = ${versammlung}`
		);
		expect(
			(await veralteteErfordernisse(betreiber, stweg)).length,
			'im Entwurf wieder sichtbar — die Sichtprobe zum Test darüber'
		).toBeGreaterThan(0);
	});
});

/*
 * ── Ein Grenzfall am Traktandum (01.10.2026) ────────────────────────────────
 *
 * **Der Befund.** `veralteteErfordernisseIn` rief für jedes offene Traktandum
 * `waehleErfordernis`, und das wirft beim Grenzfall mit `typ_nicht_waehlbar`.
 * Die Reglementseite der Gemeinschaft antwortete mit 500, obwohl am Traktandum
 * ein zulässiger Zustand stand: `?/kifolgen` und `?/uebernehmen` halten den
 * Lauf fest, auch wenn er auf einem Grenzfall endet. Falsch war der Leser,
 * nicht der Schreiber.
 *
 * **Eine Herstellung, zwei Proben.** Die Herstellung geht den Weg der
 * Anwendung: den Baum bis zum Grenzfall-Knoten laufen lassen und den Lauf ans
 * Traktandum halten, nicht mit einem rohen `UPDATE` auf `requirement_node`:
 * Das stellt einen Zustand her, den niemand herstellt. Die beiden Proben
 * danach erben das Traktandum und prüfen zuerst, dass es dasteht: Ohne diesen
 * Anker wären sie auch dann grün, wenn die Herstellung ausfiel.
 *
 * **Was die Proben messen, ist der Wurf.** Ohne die Zeile in
 * `veralteteErfordernisseIn` sind beide rot durch `typ_nicht_waehlbar`
 * (01.10.2026 gemessen: 2 rot, 8 grün), nicht durch eine Erwartung. Einen
 * allgemeinen Fänger an derselben Stelle unterschieden sie nicht vom
 * Auslassen; dass es keiner sein darf, steht dort im Kommentar.
 */
describe('Ein Grenzfall am Traktandum', () => {
	/*
	 * **Eine eigene Gemeinschaft.** Der Bestand der Proben darüber endet in
	 * einer freigegebenen Versammlung; dort lässt sich kein Traktandum mehr
	 * anlegen, und der Grenzfall entsteht nur auf dem Weg der Anwendung. Eine
	 * frische Gemeinschaft hält die zweite Probe zudem frei von den
	 * Erfordernissen der ersten.
	 */
	let eigenerStweg: string;
	let eigeneVersammlung: string;
	let grenzfallId: string;
	let gewoehnlichId: string;

	/** Der Anker: Am Traktandum steht wirklich der Grenzfall-Knoten. */
	async function grenzfallSteht(): Promise<void> {
		expect(grenzfallId, 'die Herstellung darüber ist gelaufen').toBeTruthy();
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ requirement_node: string | null; requirement_type: string | null }[]>`
				SELECT requirement_node, requirement_type FROM agenda_item WHERE id = ${grenzfallId}
			`
		);
		expect(z?.requirement_node).toBe('k-grenzfall-baulich');
		expect(z?.requirement_type).toBe('grenzfall');
	}

	beforeAll(async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'STWEG Grenzfallweg',
			quotaDenominator: 1000,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		eigenerStweg = g.id;
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: eigenerStweg,
			datum: '2027-04-15',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		eigeneVersammlung = v.id;
	});

	it('kommt über den Baum ans Traktandum, wie «übernehmen» ihn setzt', async () => {
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: eigeneVersammlung,
			titel: 'Spielplatz',
			art: 'abstimmung',
			antragswortlaut: 'Der Spielplatz wird erneuert.',
			antragstellerart: 'bewirtschaftung'
		});

		const rw = holeRegelwerk();
		const lauf = laufe(rw, 'a-bauen', ['f1-0-nein', 'f1-1-unsicher']);
		expect(lauf.stand.art, 'der Weg endet auf einem Ergebnis').toBe('ergebnis');
		const erfordernis = erfordernisAus(rw, lauf);
		expect(erfordernis.knotenId).toBe('k-grenzfall-baulich');
		expect(erfordernis.typ).toBe('grenzfall');

		const regeln = await holeReglementsregeln(betreiber, eigenerStweg);
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			eigeneVersammlung,
			t.id,
			wendeReglementAn(erfordernis, regeln, null, LESARTEN_VORGABE).erfordernis
		);
		grenzfallId = t.id;
	});

	it('meldet den Grenzfall nicht, das gewöhnliche Traktandum daneben schon', async () => {
		await grenzfallSteht();
		gewoehnlichId = await traktandumMitGesetz('Spielgerüst ersetzen', eigeneVersammlung);
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: eigenerStweg,
			geschaeftsart: 'nutzungsrechte',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'alle_eigentuemer',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 20.1',
			enthaltungZaehltMit: true
		});

		const offen = await veralteteErfordernisse(betreiber, eigenerStweg);
		const genannt = offen.map((o) => o.traktandumId);
		expect(genannt, 'der Grenzfall steht nicht in der Liste').not.toContain(grenzfallId);
		expect(genannt, 'das gewöhnliche steht weiter in der Liste').toContain(gewoehnlichId);
		expect(offen.length, 'genau das gewöhnliche').toBe(1);
	});

	it('lässt beim Nachziehen das Grenzfall-Traktandum Spalte für Spalte, wie es war', async () => {
		const lies = () =>
			imKontext(betreiber, async (tx) => {
				const [z] = await tx<{ zeile: Record<string, unknown> }[]>`
					SELECT row_to_json(a) AS zeile FROM agenda_item a WHERE a.id = ${grenzfallId}
				`;
				return z.zeile;
			});

		await grenzfallSteht();
		const vorher = await lies();
		const { nachgezogen } = await erfordernisseNachziehen(handelnder(betreiber), eigenerStweg);
		expect(nachgezogen, 'nur das gewöhnliche wird nachgezogen').toBe(1);
		expect(await lies(), 'am Grenzfall ändert sich keine Spalte').toEqual(vorher);
		expect(await veralteteErfordernisse(betreiber, eigenerStweg)).toEqual([]);
	});
});

/*
 * ── Ein Erfordernis aus dem Ordnungsantrag (A2, 01.10.2026) ────────────────
 *
 * **Der Befund.** `erfordernisFuerRueckkommen` schreibt dem Rückkommensantrag
 * beim abgelehnten Zielantrag `EINFACHES_MEHR_ORDNUNGSANTRAG` an die Zeile:
 * `fassung: 'ordnungsantrag-2026-08-05'`, `knotenId: 'k-rueckkommen'`. Beide
 * stehen in keiner Fassung des Regelwerks. `uebernimmTraktanden` kopiert die
 * Erfordernisspalten unverändert, auch in eine Entwurfsversammlung; dort rief
 * `veralteteErfordernisseIn` für es `waehleErfordernis`, und das wirft
 * `knoten_unbekannt`. Die Reglementseite antwortete mit 500.
 *
 * **Falsch war der Leser.** Ein Erfordernis, das nicht aus dem Regelwerk
 * hergeleitet wurde, lässt sich aus ihm nicht neu herleiten: Es gibt daran
 * nichts zu veralten und nichts nachzuziehen. Die Herstellung nimmt den Weg
 * der Anwendung: Rückkommen am abgelehnten Zielantrag (Muster
 * `rueckkommen.test.ts`). **Seit dem 02.10.2026 lässt die Übernahme Spontanes
 * nicht mehr durch** (Produktentscheid «Ja, weglassen», Probe «Ein Rückkommen
 * am angenommenen Ziel»); für diese Probe, die den Leser prüft, wird das
 * Rückkommen vor dem Kopieren entschärft (rohes `UPDATE`, die Fassung
 * ausserhalb des Regelwerks bleibt). Der Zustand der Gegenrichtung entsteht
 * ebenfalls durch ein rohes `UPDATE` (echte Fassung, erfundener Knoten
 * `k-gibt-es-nicht`): Er belegt, dass die neue Zeile kein allgemeiner Fänger
 * ist.
 *
 * **Eine eigene Gemeinschaft.** Die beiden anderen Blöcke enden in eigenen
 * Versammlungen, und die Herstellung braucht eine laufende mit Stimmen; eine
 * frische Gemeinschaft hält die Erfordernisse der anderen Blöcke heraus.
 */
describe('Ein Erfordernis aus dem Ordnungsantrag', () => {
	let eigenerStweg: string;
	let quelleVersammlung: string;
	let entwurfVersammlung: string;
	let benutzer: string;
	let zielId: string;
	let uebernommenId: string;
	let gewoehnlichId: string;
	const parteien: string[] = [];

	/*
	 * **Ein einfaches Erfordernis von Hand** (wie in `rueckkommen.test.ts`).
	 * Ein aus dem Baum gewählter Knoten für Nutzungsrechte verlangt die
	 * Zustimmung der Betroffenen, und ohne eingetragene Betroffene lässt sich
	 * der Durchgang nicht eröffnen; für die Herstellung trägt es hier nichts
	 * bei.
	 */
	const ZIEL_ERFORDERNIS: Erfordernis = {
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

	/** Wie `handelnder`, aber mit der Person, die die Stimmen erfasst. */
	function leitung(operatorId: string) {
		return { operatorId, userId: benutzer, label: 'Prüflauf' };
	}

	/** Der Anker: Die Kopie steht mit der Fassung ausserhalb des Regelwerks da. */
	async function uebernommenSteht(): Promise<void> {
		expect(uebernommenId, 'die Herstellung darüber ist gelaufen').toBeTruthy();
		const [z] = await imKontext(betreiber, (tx) =>
			tx<
				{
					requirement_version: string | null;
					requirement_node: string | null;
					meeting_id: string;
					item_kind: string;
					requirement_reason: string | null;
				}[]
			>`
				SELECT requirement_version, requirement_node, meeting_id,
				       item_kind, requirement_reason
				  FROM agenda_item WHERE id = ${uebernommenId}
			`
		);
		expect(z?.requirement_version).toBe('ordnungsantrag-2026-08-05');
		expect(z?.requirement_node).toBe('k-rueckkommen');
		expect(z?.meeting_id).toBe(entwurfVersammlung);
		// Die beiden Filter der Abfrage in `veralteteErfordernisseIn`: Fiele die
		// Kopie dort heraus, wären die Proben auch ohne die neue Zeile grün.
		expect(z?.item_kind).toBe('abstimmung');
		expect(z?.requirement_reason).toBeNull();
	}

	beforeAll(async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'STWEG Ordnungsantragsweg',
			quotaDenominator: 900,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		eigenerStweg = g.id;
		benutzer = await pruefbenutzer(betreiber, 'ordnungsantragsleitung');
	});

	it('stellt den Rückkommensantrag am abgelehnten Zielantrag her und übernimmt ihn', async () => {
		/*
		 * Drei Häuser mit je einer Stimme: Erst ein richtiger, abgelehnter
		 * Durchgang macht aus dem Rückkommen den Ordnungsantrag mit der festen
		 * Fassung. Ohne Stimmen käme «kein Beschluss» zustande, und dann wäre
		 * das Rückkommen gar nicht zulässig.
		 */
		for (const [i, wer] of ['Prüfpartei A', 'Prüfpartei B', 'Prüfpartei C'].entries()) {
			const e = await erstelleEinheit(leitung(betreiber), {
				stwegId: eigenerStweg,
				kind: 'unit',
				label: `Whg ${i + 1}`,
				quotas: { stamm: 300 },
				countsAsHead: true
			});
			const p = await erstelleEigentuemer(leitung(betreiber), {
				stwegId: eigenerStweg,
				kind: 'natural',
				displayName: wer,
				isCommunity: false,
				representativeName: null
			});
			await ordneEigentumZu(leitung(betreiber), e.id, p.id, '2020-01-01');
			parteien.push(p.id);
		}

		const v = await erstelleVersammlung(leitung(betreiber), {
			stwegId: eigenerStweg,
			datum: '2027-05-01',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		quelleVersammlung = v.id;
		const ziel = await erstelleTraktandum(leitung(betreiber), {
			meetingId: quelleVersammlung,
			titel: 'Fassadensanierung',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird saniert.',
			antragstellerart: 'bewirtschaftung'
		});
		await haltErfordernisAmTraktandumFest(
			leitung(betreiber),
			quelleVersammlung,
			ziel.id,
			ZIEL_ERFORDERNIS
		);
		zielId = ziel.id;
		await gibVersammlungFrei(leitung(betreiber), quelleVersammlung);
		await eroeffneVersammlung(leitung(betreiber), quelleVersammlung);
		for (const p of parteien) {
			await bestaetigeAnwesenheit(leitung(betreiber), quelleVersammlung, p, 'von_hand');
		}

		// Abgelehnt: eine Ja-Stimme, zwei Nein-Stimmen.
		await stelleAufTraktandum(leitung(betreiber), quelleVersammlung, zielId);
		await oeffneAbstimmung(leitung(betreiber), quelleVersammlung, zielId);
		await gibStimmenAb(
			leitung(betreiber),
			quelleVersammlung,
			[
				{ parteiId: parteien[0], wahl: 'yes' },
				{ parteiId: parteien[1], wahl: 'no' },
				{ parteiId: parteien[2], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		await schliesseAbstimmung(leitung(betreiber), quelleVersammlung);

		const r = await stelleRueckkommensantrag(leitung(betreiber), quelleVersammlung, zielId);
		const [antrag] = await imKontext(betreiber, (tx) =>
			tx<{ requirement_version: string | null; requirement_node: string | null }[]>`
				SELECT requirement_version, requirement_node FROM agenda_item WHERE id = ${r.id}
			`
		);
		expect(antrag?.requirement_version, 'die Herstellung trägt die Ordnungsantrags-Fassung').toBe(
			'ordnungsantrag-2026-08-05'
		);
		expect(antrag?.requirement_node).toBe('k-rueckkommen');

		const entwurf = await erstelleVersammlung(leitung(betreiber), {
			stwegId: eigenerStweg,
			datum: '2027-06-01',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		entwurfVersammlung = entwurf.id;
		/*
		 * **Nur der Weg ins Ziel ist von Hand, der Zustand nicht.** Das
		 * Rückkommen ist spontan, und Spontanes weist `uebernimmTraktanden`
		 * seit dem 02.10.2026 ab. Die Fassung ausserhalb des Regelwerks stammt
		 * weiter aus `erfordernisFuerRueckkommen`; hier fallen nur die
		 * Spontanmerkmale, damit die Kopie entsteht, die der Leser sehen soll
		 * (`agenda_rueckkommen_mit_ziel` verlangt beide Spalten zusammen).
		 */
		await imKontext(betreiber, (tx) => tx`
			UPDATE agenda_item
			   SET is_spontaneous = false, spontaneous_kind = NULL,
			       reconsiders_item_id = NULL
			 WHERE id = ${r.id}
		`);
		expect(await uebernimmTraktanden(leitung(betreiber), entwurfVersammlung, [r.id])).toBe(1);

		const [kopie] = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`
				SELECT id FROM agenda_item
				 WHERE meeting_id = ${entwurfVersammlung}
				   AND requirement_version = 'ordnungsantrag-2026-08-05'
			`
		);
		uebernommenId = kopie?.id ?? '';
		await uebernommenSteht();
	});

	it('meldet das übernommene Traktandum nicht, das gewöhnliche daneben schon', async () => {
		await uebernommenSteht();
		gewoehnlichId = await traktandumMitGesetz('Spielgerüst ersetzen', entwurfVersammlung);
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: eigenerStweg,
			geschaeftsart: 'nutzungsrechte',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'alle_eigentuemer',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 21.1',
			enthaltungZaehltMit: true
		});

		const offen = await veralteteErfordernisse(betreiber, eigenerStweg);
		const genannt = offen.map((o) => o.traktandumId);
		expect(genannt, 'das übernommene steht nicht in der Liste').not.toContain(uebernommenId);
		expect(genannt, 'das gewöhnliche steht weiter in der Liste').toContain(gewoehnlichId);
		expect(offen.length, 'genau das gewöhnliche').toBe(1);
	});

	it('lässt beim Nachziehen das übernommene Traktandum Spalte für Spalte, wie es war', async () => {
		const lies = () =>
			imKontext(betreiber, async (tx) => {
				const [z] = await tx<{ zeile: Record<string, unknown> }[]>`
					SELECT row_to_json(a) AS zeile FROM agenda_item a WHERE a.id = ${uebernommenId}
				`;
				return z.zeile;
			});

		await uebernommenSteht();
		const vorher = await lies();
		const { nachgezogen } = await erfordernisseNachziehen(handelnder(betreiber), eigenerStweg);
		expect(nachgezogen, 'nur das gewöhnliche wird nachgezogen').toBe(1);
		expect(await lies(), 'am übernommenen ändert sich keine Spalte').toEqual(vorher);
		expect(await veralteteErfordernisse(betreiber, eigenerStweg)).toEqual([]);
	});

	it('wirft weiter, wenn eine echte Fassung einen unbekannten Knoten trägt', async () => {
		/*
		 * **Rohes `UPDATE` am Erfordernis, und nur hier** (das zweite im Block
		 * nimmt der Quelle nur die Spontanmerkmale, siehe Blockkopf). Eine
		 * Fassung, die es gibt, mit einem
		 * erfundenen Knotennamen schreibt die Anwendung nicht. Die Probe stellt
		 * den Zustand absichtlich her und belegt damit, dass die neue Zeile
		 * kein allgemeiner Fänger ist; der hätte auch diesen Fall still
		 * übersprungen.
		 *
		 * **Was die Probe nicht sagt** (Codeprüfung 01.10.2026): dass jeder
		 * unbekannte Knoten an echter Fassung ein Datenfehler wäre. Den
		 * **leeren** Knoten schreibt die Anwendung selbst (`setzeErfordernis`,
		 * `knotenId: ''`), und er wirft hier genauso. Offen im Plan
		 * `docs/plan-beschluss-von-hand-2026-09-30.md`, «Offen aus Block 2»,
		 * Punkt 8.
		 */
		const id = await traktandumMitGesetz('Gegenrichtung', entwurfVersammlung);
		await imKontext(betreiber, (tx) =>
			tx`UPDATE agenda_item SET requirement_node = 'k-gibt-es-nicht' WHERE id = ${id}`
		);

		await expect(veralteteErfordernisse(betreiber, eigenerStweg)).rejects.toThrow(
			/geltenden Fassung des Regelwerks/
		);
	});
});

/*
 * ── Ein Rückkommen am angenommenen Ziel (02.10.2026) ────────────────────────
 *
 * **Der Befund.** `setzeErfordernis` schreibt an ein Traktandum den Knoten `''`
 * mit der geltenden Fassung. Wird ein solches Traktandum angenommen und danach
 * ein Rückkommen darauf gestellt, erbt der Antrag dieses Erfordernis ohne die
 * Begründung des Ziels (`erfordernisFuerRueckkommen`, Fall «angenommen»: `ziel`
 * wird gespreizt, und die Zeile des Rückkommens schreibt keine Begründung).
 * `veralteteErfordernisseIn` sieht dann `requirement_version` in `FASSUNGEN`,
 * `requirement_reason IS NULL` und `requirement_node = ''`, ruft
 * `waehleErfordernis(rw, '')` und wirft `knoten_unbekannt`; die Reglementseite
 * antwortet mit 500.
 *
 * **Erreichbar wird der Zustand über die Übernahme.** `uebernimmTraktanden`
 * kopiert die Erfordernisspalten unverändert in eine Versammlung im Entwurf,
 * und das Angebot schloss Spontanes bis dahin nicht aus (anders als das
 * Übertragen der offenen Traktanden). Die Herstellung geht den Weg der
 * Anwendung: Erfordernis von Hand setzen, abstimmen lassen (angenommen),
 * Rückkommen stellen, dann übernehmen. An diesem letzten Schritt sagt die
 * Übernahme seit dem 02.10.2026 ab; die Probe hält die Absage fest.
 *
 * **Eine eigene Gemeinschaft.** Die anderen Blöcke enden in eigenen
 * Versammlungen; eine frische Gemeinschaft hält ihre Erfordernisse heraus.
 */
describe('Ein Rückkommen am angenommenen Ziel', () => {
	let eigenerStweg: string;
	let benutzer: string;
	let rueckkommenId: string;
	const parteien: string[] = [];

	/** Wie `handelnder`, aber mit der Person, die die Stimmen erfasst. */
	function leitung(operatorId: string) {
		return { operatorId, userId: benutzer, label: 'Prüflauf' };
	}

	/**
	 * Der Anker: Das Rückkommen steht mit leerem Knoten an geltender Fassung
	 * und ohne Begründung da. Ohne diese Prüfung wären die Proben auch dann
	 * grün, wenn die Herstellung etwas anderes ergäbe.
	 */
	async function rueckkommenSteht(): Promise<void> {
		expect(rueckkommenId, 'die Herstellung darüber ist gelaufen').toBeTruthy();
		const [z] = await imKontext(betreiber, (tx) =>
			tx<
				{
					requirement_version: string | null;
					requirement_node: string | null;
					requirement_reason: string | null;
					is_spontaneous: boolean;
				}[]
			>`
				SELECT requirement_version, requirement_node, requirement_reason, is_spontaneous
				  FROM agenda_item WHERE id = ${rueckkommenId}
			`
		);
		expect(z?.is_spontaneous, 'ein Rückkommen ist spontan').toBe(true);
		expect(z?.requirement_version, 'die geltende Fassung, nicht die des Ordnungsantrags').toBe(
			holeRegelwerk().fassung
		);
		expect(z?.requirement_node, 'der leere Knoten aus `setzeErfordernis`').toBe('');
		expect(z?.requirement_reason, 'ohne Begründung, sonst fällt die Zeile aus der Abfrage').toBeNull();
	}

	beforeAll(async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'STWEG Angenommenweg',
			quotaDenominator: 900,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		eigenerStweg = g.id;
		benutzer = await pruefbenutzer(betreiber, 'angenommenleitung');
	});

	it('stellt den Rückkommensantrag am angenommenen Ziel her', async () => {
		/*
		 * Drei Häuser mit je einer Stimme. Für den angenommenen Durchgang
		 * genügen zwei Ja bei einem Nein; erst ein geschlossener Durchgang macht
		 * das Rückkommen zulässig.
		 */
		for (const [i, wer] of ['Prüfpartei A', 'Prüfpartei B', 'Prüfpartei C'].entries()) {
			const e = await erstelleEinheit(leitung(betreiber), {
				stwegId: eigenerStweg,
				kind: 'unit',
				label: `Whg ${i + 1}`,
				quotas: { stamm: 300 },
				countsAsHead: true
			});
			const p = await erstelleEigentuemer(leitung(betreiber), {
				stwegId: eigenerStweg,
				kind: 'natural',
				displayName: wer,
				isCommunity: false,
				representativeName: null
			});
			await ordneEigentumZu(leitung(betreiber), e.id, p.id, '2020-01-01');
			parteien.push(p.id);
		}

		const v = await erstelleVersammlung(leitung(betreiber), {
			stwegId: eigenerStweg,
			datum: '2027-07-01',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		const ziel = await erstelleTraktandum(leitung(betreiber), {
			meetingId: v.id,
			titel: 'Fassadensanierung',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird saniert.',
			antragstellerart: 'bewirtschaftung'
		});
		/*
		 * **Der kurze Weg der Erfordernisseite**, ohne Baum und ohne
		 * Begründung: Genau er schreibt `knotenId: ''` an der geltenden Fassung.
		 */
		const gesetzt = setzeErfordernis(holeRegelwerk(), 'einfaches_mehr');
		expect(gesetzt.ergebnis?.knotenId, 'die Herstellung nutzt den leeren Knoten').toBe('');
		await haltErfordernisAmTraktandumFest(
			leitung(betreiber),
			v.id,
			ziel.id,
			gesetzt.ergebnis!
		);
		await gibVersammlungFrei(leitung(betreiber), v.id);
		await eroeffneVersammlung(leitung(betreiber), v.id);
		for (const p of parteien) {
			await bestaetigeAnwesenheit(leitung(betreiber), v.id, p, 'von_hand');
		}

		// Angenommen: zwei Ja, ein Nein.
		await stelleAufTraktandum(leitung(betreiber), v.id, ziel.id);
		await oeffneAbstimmung(leitung(betreiber), v.id, ziel.id);
		await gibStimmenAb(
			leitung(betreiber),
			v.id,
			[
				{ parteiId: parteien[0], wahl: 'yes' },
				{ parteiId: parteien[1], wahl: 'yes' },
				{ parteiId: parteien[2], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		await schliesseAbstimmung(leitung(betreiber), v.id);

		const r = await stelleRueckkommensantrag(leitung(betreiber), v.id, ziel.id);
		rueckkommenId = r.id;
		await rueckkommenSteht();
	});

	it('sagt die Übernahme ab, statt die Reglementseite zu Fall zu bringen', async () => {
		await rueckkommenSteht();
		const entwurf = await erstelleVersammlung(leitung(betreiber), {
			stwegId: eigenerStweg,
			datum: '2027-08-01',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});

		/*
		 * **Die Schranke sitzt im Server**, nicht nur im Angebot: Die Kennung
		 * wird hier von Hand gesendet, wie es ein Formular könnte.
		 * Gegenprobe: Am Stand vor dem 02.10.2026 nimmt der Aufruf das
		 * Rückkommen an (Rückgabe 1), und schon diese Erwartung ist rot. Den
		 * Absturz selbst zeigt sie nicht: Wer sie am alten Stand durch den
		 * blossen Aufruf ersetzt, sieht die Kopienzählung rot; erst ohne
		 * auch diese wirft die letzte Zeile mit `knoten_unbekannt` (beides so
		 * gesehen am 02.10.2026, beim Bau und in der Abnahme). Am neuen Stand
		 * trägt die letzte Zeile nichts mehr, sie hält nur fest, dass die
		 * Seite steht.
		 */
		await expect(
			uebernimmTraktanden(leitung(betreiber), entwurf.id, [rueckkommenId])
		).rejects.toThrow(/während der Versammlung entstanden/);

		/*
		 * Gesucht wird über die Herkunft, nicht über `is_spontaneous`: Eine
		 * Kopie trüge das Merkmal nicht (`kopiereTraktandumIn` nimmt es nicht
		 * mit), die Zeile wäre also auch mit Kopie leer.
		 */
		const kopien = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`
				SELECT id FROM agenda_item
				 WHERE meeting_id = ${entwurf.id} AND copied_from_meeting_id IS NOT NULL
			`
		);
		expect(kopien, 'nichts wurde kopiert').toEqual([]);
		await expect(veralteteErfordernisse(betreiber, eigenerStweg)).resolves.toEqual([]);
	});
});
