/**
 * Der Rückkommensantrag (Welle 3, FR-44).
 *
 * **Die Grenze, um die es geht:** Über das Rückkommen entscheidet die
 * **Versammlung**, nicht die Sitzungsleitung. Wer ein einwandfreies Ergebnis
 * als «fehlerhaft» überholt, nimmt ihr eine Abstimmung ab, die ihr zusteht —
 * deshalb sind es zwei getrennte Wege und nicht einer mit zwei Begründungen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleReglementsregel } from '$lib/server/reglement';
import type { ReglementsregelEingabe } from '$lib/domain/reglement';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	nimmTraktandumAuf,
	stelleRueckkommensantrag,
	ziehAntragZurueck
} from '$lib/server/traktanden';
import {
	brecheAbstimmungAb,
	gibStimmenAb,
	holeDurchgaenge,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung,
	setzeNeuabstimmungAn
} from '$lib/server/abstimmung';
import { erzeugeProtokollentwurf } from '$lib/server/protokoll';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

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

/**
 * Eine laufende Versammlung mit drei Parteien und einem behandelten Antrag.
 *
 * Mit `gleichstand` vier Parteien, und den Stichentscheid trifft nach Reglement
 * der Verwalter: 2 zu 2 lässt ihn offen, das Ergebnis ist nicht verkündet. Nur
 * ein solcher Durchgang lässt sich seit H6 mit einer Neuabstimmung überholen.
 */
async function behandelt(name: string, datum: string, gleichstand = false) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		...(gleichstand ? { tieBreak: 'verwalter' as const, tieBreakRuleSource: 'Art. 7 Ziff. 5' } : {})
	});
	const parteien: string[] = [];
	const namen = ['Aebi', 'Bucher', 'Christen', ...(gleichstand ? ['Dubi'] : [])];
	for (const [i, wer] of namen.entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 900 / namen.length },
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
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}

	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

/** Stimmt über ein Traktandum ab und schliesst den Durchgang. */
async function abstimmen(
	versammlung: string,
	traktandum: string,
	wahlen: { parteiId: string; wahl: 'yes' | 'no' }[]
) {
	await stelleAufTraktandum(handelnder(betreiber), versammlung, traktandum);
	await oeffneAbstimmung(handelnder(betreiber), versammlung, traktandum);
	await gibStimmenAb(handelnder(betreiber), versammlung, wahlen, true, 'Prüflauf: von der Sitzungsleitung erfasst');
	const d = await schliesseAbstimmung(handelnder(betreiber), versammlung);
	return holeErgebnis(betreiber, versammlung, d.id);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Rückkommen');
	benutzer = await pruefbenutzer(betreiber, 'rueckkommensleitung');
});

afterAll(verbindungenSchliessen);

describe('Ohne Rückkommensbeschluss', () => {
	it('lässt sich kein zweiter Durchgang eröffnen', async () => {
		/*
		 * **Die Lücke, die FR-44 schliesst.** Bisher prüfte die Anwendung nur, ob
		 * gerade eine andere Abstimmung offen ist — eine zweite Runde zum selben
		 * Traktandum war jederzeit möglich. Damit hätte die Sitzungsleitung ein
		 * unliebsames Ergebnis wiederholen lassen können, bis es passt.
		 */
		const s = await behandelt('Rückkommensweg 1', '2027-07-01');
		await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'no' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);

		await expect(
			oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toThrow(/angenommenen Rückkommensantrag/i);
	});

	it('führt auch den fehlerhaften Durchgang über das Rückkommen, sobald er verkündet ist', async () => {
		// Der andere Fall: Der Wille war nie richtig erfasst. Bis H6 überholte
		// die Sitzungsleitung ihn mit Begründung. Seither nur bis zur Verkündung,
		// und die geschieht beim Schliessen: Ein verkündeter Beschluss wirkt, auch
		// ein fehlerhafter, und ändern kann ihn nur die Versammlung.
		const s = await behandelt('Rückkommensweg 2', '2027-07-02');
		const e = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' }
		]);
		expect(e.durchgang.verkuendetAm).not.toBeNull();

		const ueberholen = setzeNeuabstimmungAn(
			handelnder(betreiber),
			s.versammlung,
			e.durchgang.id,
			'Die Frage war auf der Leinwand nicht lesbar'
		);
		await expect(ueberholen).rejects.toMatchObject({ kennung: 'schon_verkuendet' });
		await expect(ueberholen).rejects.toThrow(/Beantragen Sie das Rückkommen/);
		expect((await holeErgebnis(betreiber, s.versammlung, e.durchgang.id)).durchgang.ueberholtAm).toBeNull();

		// Und die Absage am Eröffnen nennt keinen Weg über die Überholung mehr.
		const eroeffnen = oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await expect(eroeffnen).rejects.toThrow(
			/angenommenen Rückkommensantrag[\s\S]*Ein verkündetes Ergebnis ändert auch dann nur die Versammlung, wenn der Durchgang fehlerhaft war\./
		);
		await expect(eroeffnen).rejects.not.toThrow(/überholen Sie ihn/);
	});
});

describe('Der Rückkommensantrag', () => {
	it('entsteht als eigenes Traktandum mit Wortlaut und Erfordernis', async () => {
		const s = await behandelt('Rückkommensweg 3', '2027-07-03');
		// Zwei von drei Anwesenden dafür: Damit ist der Antrag **angenommen** —
		// eine einzelne Ja-Stimme reichte nicht, die Bezugsgrösse sind die
		// Anwesenden und Vertretenen.
		await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' }
		]);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);

		expect(r.art).toBe('abstimmung');
		expect(r.spontanart).toBe('rueckkommen');
		expect(r.rueckkommenZielId).toBe(s.traktandum);
		// **Der Wortlaut kommt von der Anwendung** — und er sagt, was mit dem
		// früheren Beschluss geschieht. Ohne das liesse sich hinterher nicht sagen,
		// ob überhaupt etwas abgeändert wurde (Rz. 202a ad Art. 712g).
		expect(r.antragswortlaut).toMatch(/Fassadensanierung/);
		/*
		 * **Und das Erfordernis ist dasselbe wie beim Zielbeschluss** (Einwand
		 * des Auftraggebers vom 05.08.2026, belegt im Beobachter S. 105 und 109).
		 *
		 * Nicht «einfaches Mehr, es ist ja nur ein Ordnungsantrag»: Wird
		 * zurückgekommen und die Sache scheitert danach, ist der frühere Beschluss
		 * beseitigt. Über diesen Umweg liesse sich ein qualifizierter Beschluss
		 * mit einfacher Mehrheit aufheben.
		 */
		// Der Zielantrag wurde **angenommen** (eine Ja-Stimme, sonst niemand):
		// Also zielt das Rückkommen auf seine Aufhebung, und es gilt dasselbe Mehr.
		expect(r.erfordernis?.titel).toMatch(/Wie der Beschluss, der aufgehoben werden soll/);
		expect(r.erfordernis?.kopfSchwelle).toEqual(ERFORDERNIS.kopfSchwelle);
		// «Abgelehnt» und «kein Beschluss» getrennt (Produktentscheid 30.09.2026,
		// «Nein heisst Nein»).
		expect(r.antragswortlaut).toMatch(
			/Mit dem neuen Beschluss zur Sache wird der bisherige aufgehoben, auch mit einer Ablehnung und auch wenn über einen geänderten Antrag abgestimmt wird; kommt dabei gar kein Beschluss zustande, auch keine Ablehnung, bleibt er in Kraft/
		);
	});

	it('verlangt einen behandelten Antrag', async () => {
		const s = await behandelt('Rückkommensweg 4', '2027-07-04');
		await expect(
			stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toThrow(/noch nicht abgestimmt/i);
	});

	it('gibt es zu einem zurückgezogenen Antrag nicht', async () => {
		// Es gibt keinen Beschluss, auf den zurückzukommen wäre.
		const s = await behandelt('Rückkommensweg 5', '2027-07-05');
		await ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.traktandum, 'Offerte fehlt');
		await expect(
			stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toThrow(/zurückgezogen/i);
	});

	it('hängt als Untertraktandum unter seinem Ziel', async () => {
		/*
		 * **Der Befund vom 21.08.2026.** Der Antrag entstand auf oberster Ebene und
		 * bekam damit eine eigene Traktandennummer — eine, die auf keiner Einladung
		 * stand. Wer ihn dorthin zog, wo er hingehört, schob die Nummern aller
		 * nachfolgenden Punkte um eins: In einer Versammlung rutschte die «Décharge
		 * an die Bewirtschaftung» so von 8 auf 9.
		 *
		 * Produktentscheid: «Ergo sind Folgeanträge, Wiedereintretungsanträge etc.
		 * Subtraktanden X.1 X.1.1 oder so.»
		 */
		const s = await behandelt('Rückkommensweg 6a', '2027-07-16');
		await abstimmen(s.versammlung, s.traktandum, [{ parteiId: s.parteien[0], wahl: 'yes' }]);
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);

		expect(r.parentId).toBe(s.traktandum);

		const liste = await holeTraktanden(betreiber, s.versammlung);
		const ziel = liste.find((t) => t.knoten.id === s.traktandum);
		const antrag = liste.find((t) => t.knoten.id === r.id);
		expect(antrag?.nummer).toBe(`${ziel?.nummer}.1`);
		expect(antrag?.tiefe).toBe((ziel?.tiefe ?? 0) + 1);
	});

	it('lässt die Nummern der übrigen Traktanden unberührt', async () => {
		// Die eigentliche Klage: Nicht der Antrag selbst störte, sondern was er mit
		// den anderen machte.
		const s = await behandelt('Rückkommensweg 6b', '2027-07-17');
		const vorher = (await holeTraktanden(betreiber, s.versammlung)).map(
			(t) => `${t.nummer} ${t.knoten.titel}`
		);
		await abstimmen(s.versammlung, s.traktandum, [{ parteiId: s.parteien[0], wahl: 'yes' }]);
		await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);

		const nachher = await holeTraktanden(betreiber, s.versammlung);
		for (const zeile of vorher) {
			expect(nachher.map((t) => `${t.nummer} ${t.knoten.titel}`)).toContain(zeile);
		}
	});

	it('steht nur einmal', async () => {
		const s = await behandelt('Rückkommensweg 6', '2027-07-06');
		await abstimmen(s.versammlung, s.traktandum, [{ parteiId: s.parteien[0], wahl: 'yes' }]);
		await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await expect(
			stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toThrow(/bereits ein Rückkommensantrag/i);
	});
});

describe('Das Erfordernis des Rückkommens', () => {
	it('übernimmt auch die Wertquotenschwelle eines qualifizierten Mehrs', async () => {
		/*
		 * **Der Fall, an dem es hängt.** Ein qualifiziertes Mehr verlangt Köpfe
		 * **und** Wertquoten. Übernähme das Rückkommen nur die Kopfschwelle, käme
		 * es mit einer blossen Kopfmehrheit durch — und damit liesse sich der
		 * qualifizierte Beschluss über den Umweg beseitigen. Genau der Teil, der
		 * ihn qualifiziert macht, darf nicht verlorengehen.
		 */
		const s = await behandelt('Rückkommensweg 11', '2027-07-11');
		const qualifiziert: Erfordernis = {
			...ERFORDERNIS,
			typ: 'qualifiziertes_mehr',
			titel: 'Qualifiziertes Mehr',
			rechtsgrundlage: 'ZGB Art. 647d',
			quotenbasis: 'alle_quoten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		};
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), s.versammlung, s.traktandum, qualifiziert);
		await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' }
		]);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);

		expect(r.erfordernis?.typ).toBe('qualifiziertes_mehr');
		expect(r.erfordernis?.quotenSchwelle).toEqual(qualifiziert.quotenSchwelle);
		expect(r.erfordernis?.quotenbasis).toBe('alle_quoten');
		// Und die Herleitung steht im Pfad — nachlesbar, warum dieses Mehr gilt.
		expect(r.erfordernis?.pfad[0].antwortText).toMatch(/dasselbe Mehr wie für den Beschluss/);
	});
});

describe('War der Antrag abgelehnt worden', () => {
	/*
	 * **Der Hauptfall in der Praxis** (Auftraggeber, 05.08.2026): Ein umstrittener oder
	 * knapper Antrag wird abgelehnt, danach kommen neue Erkenntnisse. Dann muss
	 * man darauf zurückkommen können.
	 *
	 * Hier gibt es **keinen Beschluss aufzuheben**. Das Rückkommen ist ein
	 * Ordnungsantrag mit einfachem Mehr; das strengere Erfordernis zu verlangen
	 * hiesse, genau diesen Fall zu blockieren.
	 */
	it('genügt einfaches Mehr — es gibt keinen Beschluss aufzuheben', async () => {
		const s = await behandelt('Rückkommensweg 12', '2027-07-12');
		const qualifiziert: Erfordernis = {
			...ERFORDERNIS,
			typ: 'qualifiziertes_mehr',
			titel: 'Qualifiziertes Mehr',
			quotenbasis: 'alle_quoten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		};
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), s.versammlung, s.traktandum, qualifiziert);

		// Knapp abgelehnt: eine Ja-Stimme, zwei Nein.
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'no' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);
		expect(erst.auszaehlung?.angenommen).toBe(false);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);

		expect(r.erfordernis?.typ).toBe('einfaches_mehr');
		expect(r.erfordernis?.titel).toMatch(/Ordnungsantrag/);
		expect(r.antragswortlaut).toMatch(/Der Antrag wurde abgelehnt/);
		expect(r.antragswortlaut).not.toMatch(/aufgehoben/);
	});

	/*
	 * **Der Rückfall trägt die Einstellung zu den Enthaltungen** (Codeprüfung
	 * 07.10.2026, Befund 3): Das einfache Mehr des Ordnungsantrags ist ein
	 * einfaches Mehr der Anwesenden wie jedes andere. Bis dahin zählte es die
	 * Enthaltungen mit, auch wo die Gemeinschaft sie ausnimmt.
	 */
	it('nimmt beim einfachen Mehr des Ordnungsantrags die Einstellung zu den Enthaltungen mit', async () => {
		const s = await behandelt('Rückkommensweg 14', '2027-07-14');
		await imKontext(betreiber, (tx) =>
			tx`UPDATE stweg SET abstention_excluded = true, abstention_excluded_source = 'Art. 33 Reglement'
			    WHERE id = (SELECT stweg_id FROM meeting WHERE id = ${s.versammlung})`
		);
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'no' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);
		expect(erst.auszaehlung?.angenommen).toBe(false);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		expect(r.erfordernis?.titel).toMatch(/Ordnungsantrag/);
		expect(r.erfordernis?.enthaltungZaehltMit).toBe(false);
		expect(r.erfordernis?.rechtsgrundlage).toContain('Art. 33 Reglement');
	});

	it('lässt die Sache danach mit ihrem eigenen Erfordernis entscheiden', async () => {
		// Das Rückkommen ist einfach; der neue Beschluss trägt das volle
		// Erfordernis der Sache — sonst käme ein qualifizierter Beschluss über
		// den Umweg mit einfachem Mehr zustande.
		const s = await behandelt('Rückkommensweg 13', '2027-07-13');
		const qualifiziert: Erfordernis = {
			...ERFORDERNIS,
			typ: 'qualifiziertes_mehr',
			titel: 'Qualifiziertes Mehr',
			quotenbasis: 'alle_quoten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		};
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), s.versammlung, s.traktandum, qualifiziert);
		await abstimmen(s.versammlung, s.traktandum, [{ parteiId: s.parteien[0], wahl: 'no' }]);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' }
		]);

		const zweiter = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' }
		]);
		expect(zweiter.durchgang.erfordernis?.typ).toBe('qualifiziertes_mehr');
		expect(zweiter.auszaehlung?.angenommen).toBe(true);
	});
});

describe('Scheitert der zweite Durchgang', () => {
	it('ersetzt die Ablehnung den ersten Beschluss: Nein heisst Nein', async () => {
		/*
		 * **Produktentscheid 30.09.2026, «Nein heisst Nein»** (`docs/freigabe.md`,
		 * «Offen: Aus der Prüfung zu ‹Rückkommen, dann Neuabstimmung›», Punkt (a)).
		 * Der angenommene Rückkommensantrag hebt den Beschluss auf; eine Ablehnung
		 * ist selbst ein Beschluss und ersetzt ihn. Bis dahin blieb der erste hier
		 * in Kraft (Vorgabe vom 05.08.2026), und weil im Saal nur derselbe Antrag
		 * nochmals zur Abstimmung kommt, führten Ja und Nein zum selben Beschluss
		 * (Laien- und Fachprüfung 30.09.2026, L1, F-1). Dass ohne Beschluss der
		 * erste bleibt, hält `rueckkommen-stichentscheid.test.ts` fest.
		 */
		const s = await behandelt('Rückkommensweg 14', '2027-07-14');
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);
		expect(erst.auszaehlung?.angenommen).toBe(true);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' }
		]);

		// Der zweite Durchgang lehnt ab.
		const zweiter = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'no' },
			{ parteiId: s.parteien[1], wahl: 'no' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);
		expect(zweiter.auszaehlung?.angenommen).toBe(false);

		// **Der erste Beschluss ist ersetzt** …
		const [art] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind, superseded_by_round_id FROM voting_round WHERE id = ${erst.durchgang.id}`
		);
		expect(art).toEqual({ supersede_kind: 'rueckkommen', superseded_by_round_id: zweiter.durchgang.id });

		// … und massgebend ist die Ablehnung.
		const alle = await holeDurchgaenge(betreiber, s.versammlung);
		const massgebend = alle.filter((d) => d.traktandumId === s.traktandum && !d.ueberholtAm);
		expect(massgebend.map((d) => d.id)).toEqual([zweiter.durchgang.id]);

		// Das Protokoll nennt das Rückkommen und den ersetzten Beschluss, statt
		// «2. Durchgang; weitere Durchgänge siehe Verlauf» (Fachprüfung F-11).
		const entwurf = await erzeugeProtokollentwurf(
			handelnder(betreiber),
			s.versammlung,
			'2027-07-14 21:00:00'
		);
		const text = entwurf.body.replace(/\s+/g, ' ');
		expect(text).toContain(
			'- 2. Durchgang. - Auf dieses Traktandum wurde zurückgekommen und erneut abgestimmt. Der ' +
				'Beschluss aus dem 1. Durchgang («angenommen») ist damit ersetzt; seine Zahlen gibt auf ' +
				'Anfrage bekannt, wer das Protokoll aufbewahrt.'
		);
		expect(text).not.toMatch(/weitere Durchgänge siehe Verlauf/);
	});

	it('setzt sich durch, wenn der frühere Antrag abgelehnt worden war', async () => {
		// Dann gibt es keinen Beschluss zu erhalten: Der zweite Durchgang ist der
		// massgebende, auch wenn er wieder ablehnt.
		const s = await behandelt('Rückkommensweg 15', '2027-07-15');
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'no' }
		]);
		expect(erst.auszaehlung?.angenommen).toBe(false);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' }
		]);
		const zweiter = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'no' }
		]);

		const alle = await holeDurchgaenge(betreiber, s.versammlung);
		const massgebend = alle.filter((d) => d.traktandumId === s.traktandum && !d.ueberholtAm);
		expect(massgebend).toHaveLength(1);
		expect(massgebend[0].id).toBe(zweiter.durchgang.id);
	});
});

describe('Wird das Rückkommen abgelehnt', () => {
	it('bleibt der frühere Beschluss stehen — und es wird nicht neu abgestimmt', async () => {
		const s = await behandelt('Rückkommensweg 7', '2027-07-07');
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);
		expect(erst.auszaehlung?.angenommen).toBe(true);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'no' },
			{ parteiId: s.parteien[1], wahl: 'no' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);

		await expect(
			oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toThrow(/nicht angenommen/i);

		// Der frühere Beschluss steht unverändert.
		const nachher = await holeErgebnis(betreiber, s.versammlung, erst.durchgang.id);
		expect(nachher.durchgang.ueberholtAm).toBeNull();
		expect(nachher.auszaehlung?.angenommen).toBe(true);
	});

	it('bleibt ein neuer Anlauf möglich', async () => {
		/*
		 * **Die Sackgasse, behoben am 20.08.2026.** Bis dahin genügte, dass je ein
		 * Rückkommensantrag gestellt worden war — für immer. Nach einer Ablehnung
		 * liess sich nie wieder einer stellen, und die Anwendung widersprach sich
		 * dabei selbst: Die Absage am Geschäft nannte «einen neuen
		 * Rückkommensantrag» als Weg, und genau der war versperrt.
		 *
		 * Beschlüsse der Versammlung sind abänderbar, soweit sie keine
		 * Gestaltungswirkung entfalten und nicht bereits realisiert wurden
		 * (Rz. 202a ad Art. 712g). Die Sperre soll zwei Anträge
		 * nebeneinander verhindern, nicht einen zweiten Anlauf.
		 */
		const s = await behandelt('Rückkommensweg 12', '2027-07-12');
		await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);

		const erster = await stelleRueckkommensantrag(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum
		);
		await abstimmen(s.versammlung, erster.id, [
			{ parteiId: s.parteien[0], wahl: 'no' },
			{ parteiId: s.parteien[1], wahl: 'no' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);

		const zweiter = await stelleRueckkommensantrag(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum
		);
		expect(zweiter.id).not.toBe(erster.id);
		expect(zweiter.rueckkommenZielId).toBe(s.traktandum);

		// Und daneben steht kein dritter, solange über den zweiten nicht
		// entschieden ist.
		await expect(
			stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toThrow(/bereits ein Rückkommensantrag/i);
	});
});

describe('Wird das Rückkommen angenommen', () => {
	it('gilt der frühere Beschluss weiter, bis der neue gefasst ist', async () => {
		/*
		 * **Die Zusage aus FR-44.** Zwischen dem Rückkommensbeschluss und dem
		 * Schluss des neuen Durchgangs darf keine Lücke entstehen, in der die
		 * Gemeinschaft zu derselben Frage gar keinen Beschluss hätte.
		 */
		const s = await behandelt('Rückkommensweg 8', '2027-07-08');
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' }
		]);

		// Der neue Durchgang ist eröffnet — der alte gilt noch.
		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.traktandum);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		const waehrend = await holeErgebnis(betreiber, s.versammlung, erst.durchgang.id);
		expect(waehrend.durchgang.ueberholtAm).toBeNull();

		// **Ein neuer Beschluss kommt zustande** — erst damit wird der frühere
		// ersetzt. (Scheitert er, bleibt der frühere in Kraft; dafür gibt es den
		// eigenen Prüffall weiter oben.)
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.parteien[0], wahl: 'yes' },
				{ parteiId: s.parteien[1], wahl: 'yes' },
				{ parteiId: s.parteien[2], wahl: 'yes' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		await schliesseAbstimmung(handelnder(betreiber), s.versammlung);

		const danach = await holeErgebnis(betreiber, s.versammlung, erst.durchgang.id);
		expect(danach.durchgang.ueberholtAm).not.toBeNull();
		expect(danach.durchgang.ueberholungsgrund).toMatch(/nach Rückkommen/i);

		// **Nie gelöscht:** Beide Durchgänge stehen weiterhin in der Datenbank.
		const [anzahl] = await imKontext(
			betreiber,
			(tx) => tx`SELECT count(*)::int AS n FROM voting_round
			            WHERE agenda_item_id = ${s.traktandum}`
		);
		expect(anzahl.n).toBe(2);

		// Und die Ersetzung ist als Rückkommen gekennzeichnet, nicht als Korrektur.
		const [art] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind FROM voting_round WHERE id = ${erst.durchgang.id}`
		);
		expect(art.supersede_kind).toBe('rueckkommen');
	});

	it('nennt beim Folgeantrag den laufenden Durchgang, nicht den früheren Beschluss', async () => {
		/*
		 * **Der Fall, in dem Auswahl und Absage auseinanderliefen** (Code-Review
		 * 07.09.2026).
		 *
		 * Zwischen dem angenommenen Rückkommen und dem Schluss des zweiten
		 * Durchgangs stehen zwei Durchgänge nebeneinander: der erste geschlossen,
		 * der zweite offen, **keiner überholt** — überholt wird der erste erst
		 * beim Schliessen des zweiten. Die erste Fassung der Folgeantragsschranke
		 * fragte nach «irgendein geschlossener, nicht überholter Durchgang» und
		 * hätte hier «bereits abgestimmt» gesagt, während die Leitungssicht über
		 * den **massgebenden** Durchgang rechnet, das Traktandum also weiter
		 * anbot. Genau der Widerspruch, den die Schranke beseitigen soll.
		 */
		const s = await behandelt('Rückkommensweg 23', '2027-07-23');
		await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' }
		]);
		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.traktandum);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);

		const meldung = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: s.versammlung,
				parentId: s.traktandum,
				titel: 'Statt allem nur die Wetterseite',
				art: 'abstimmung',
				antragswortlaut: 'Saniert wird vorerst nur die Wetterseite.',
				antragstellerart: 'gemeinschaft',
				betroffeneParteiIds: []
			},
			'folgeantrag'
		).then(
			() => 'durchgelassen',
			(fehler: unknown) => (fehler as Error).message
		);

		expect(meldung).toMatch(/gerade abgestimmt/);
		// **Und ausdrücklich nicht die Auskunft des früheren Beschlusses.** Sie
		// wäre im Saal irreführend: Zurückgekommen ist die Versammlung ja bereits.
		expect(meldung).not.toMatch(/bereits abgestimmt/);
	});

	/*
	 * **Abbruch nach dem Rückkommen** (H6, `brecheAbstimmungAb`). Der
	 * abgebrochene Durchgang verbraucht das Rückkommen nicht: Es trägt den
	 * nächsten, und bis dahin bleibt der frühere Beschluss in Kraft. Das
	 * Protokoll sagt das, ohne der Leitung eine Wirkung zuzuschreiben.
	 */
	it('trägt nach einem Abbruch ohne Ergebnis den nächsten Durchgang', async () => {
		const s = await behandelt('Rückkommensweg 41', '2027-07-21');
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' }
		]);
		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.traktandum);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		const ab = await brecheAbstimmungAb(
			handelnder(betreiber),
			s.versammlung,
			'Prüflauf: Ausstand war nicht erfasst'
		);
		expect(ab.verkuendetAm).toBeNull();
		expect((await holeErgebnis(betreiber, s.versammlung, erst.durchgang.id)).durchgang.ueberholtAm).toBeNull();

		const entwurf = (
			await erzeugeProtokollentwurf(handelnder(betreiber), s.versammlung, '2027-07-21 21:00:00')
		).body.replace(/\s+/g, ' ');
		expect(entwurf).toContain(
			'Auf dieses Traktandum wurde zurückgekommen; die Abstimmung im 2. Durchgang hat die ' +
				'Sitzungsleitung ohne Ergebnis abgebrochen (Begründung: Prüflauf: Ausstand war nicht ' +
				'erfasst), und erneut abgestimmt wurde nicht mehr; die abgegebenen Stimmen bewirken ' +
				'nichts, ihre Zahlen gibt auf Anfrage bekannt, wer das Protokoll aufbewahrt. Es bleibt beim Beschluss aus dem 1. Durchgang, wie oben ' +
				'festgehalten.'
		);

		// Derselbe Rückkommensbeschluss trägt den nächsten Durchgang.
		const drei = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'no' },
			{ parteiId: s.parteien[1], wahl: 'no' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);
		expect(drei.durchgang.nummer).toBe(3);
		const [art] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind FROM voting_round WHERE id = ${erst.durchgang.id}`
		);
		expect(art.supersede_kind).toBe('rueckkommen');
	});

	it('trägt genau einen neuen Durchgang', async () => {
		// Sonst liesse sich mit einer einmal erteilten Erlaubnis so oft neu
		// abstimmen, bis das Ergebnis gefällt.
		const s = await behandelt('Rückkommensweg 9', '2027-07-09');
		await abstimmen(s.versammlung, s.traktandum, [{ parteiId: s.parteien[0], wahl: 'yes' }]);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' }
		]);
		await abstimmen(s.versammlung, s.traktandum, [{ parteiId: s.parteien[0], wahl: 'no' }]);

		await expect(
			oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toThrow(/bereits zurückgekommen|neuen Rückkommensantrag/i);
	});

	it('behält das Erfordernis des ursprünglichen Beschlusses', async () => {
		// FR-44: «Der neue Beschluss unterliegt demselben Mehrheitserfordernis wie
		// der ursprüngliche.» Es hängt am Traktandum und wandert beim Eröffnen in
		// den Durchgang (AD-4) — hier wird nachgesehen, dass das auch für den
		// zweiten gilt.
		const s = await behandelt('Rückkommensweg 10', '2027-07-10');
		await abstimmen(s.versammlung, s.traktandum, [{ parteiId: s.parteien[0], wahl: 'yes' }]);
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' }
		]);
		const zweiter = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'no' }
		]);

		expect(zweiter.durchgang.erfordernis?.titel).toBe('Einfaches Mehr');
		expect(zweiter.durchgang.erfordernis?.fassung).toBe('2026-07-30');
	});
});

/*
 * **Was das Reglement zum Rückkommen selbst sagt** (PRD-Annahme 5, gebaut am
 * 13.08.2026). Der Nachsatz «sofern das Reglement nichts anderes sagt» stand
 * seit dem 30.07.2026 in der Annahme und war nicht erfüllbar: Es gab die
 * Geschäftsart gar nicht.
 *
 * Geprüft wird die ganze Kette — Regel in der Datenbank, Antrag im Saal,
 * Erfordernis am neuen Traktandum.
 */
describe('Regelt das Reglement das Rückkommen selbst', () => {
	async function hinterlege(stwegId: string, teil: Partial<ReglementsregelEingabe> = {}) {
		return erstelleReglementsregel(handelnder(betreiber), {
			stwegId,
			geschaeftsart: 'rueckkommen',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 14.2',
			enthaltungZaehltMit: true,
			...teil
		});
	}

	it('gilt die hinterlegte Regel, wenn sie strenger ist', async () => {
		const s = await behandelt('Rückkommensweg 20', '2027-07-20');
		await hinterlege(s.gemeinschaft);
		await abstimmen(s.versammlung, s.traktandum, [{ parteiId: s.parteien[0], wahl: 'yes' }]);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);

		expect(r.erfordernis?.quelle).toBe('reglement');
		expect(r.erfordernis?.fundstelle).toBe('Reglement Ziff. 14.2');
		expect(r.erfordernis?.kopfSchwelle).toEqual({ zaehler: 2, nenner: 3, art: 'mindestens' });
	});

	it('bleibt sie weg, wenn sie hinter dem Beschluss zurückbliebe', async () => {
		/*
		 * Der Beschluss trug ein qualifiziertes Mehr mit Wertquotenbedingung. Eine
		 * Rückkommensregel mit zwei Dritteln der Köpfe **ohne** Wertquoten bliebe
		 * dahinter zurück — und über diesen Umweg liesse sich aufheben, was ohne
		 * ihn nicht aufzuheben wäre.
		 */
		const s = await behandelt('Rückkommensweg 21', '2027-07-21');
		await hinterlege(s.gemeinschaft);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), s.versammlung, s.traktandum, {
			...ERFORDERNIS,
			typ: 'qualifiziertes_mehr',
			titel: 'Qualifiziertes Mehr',
			rechtsgrundlage: 'ZGB Art. 647d',
			quotenbasis: 'alle_quoten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		});
		await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' }
		]);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);

		expect(r.erfordernis?.typ).toBe('qualifiziertes_mehr');
		expect(r.erfordernis?.quotenSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
		// Und die übergangene Regel wird genannt, damit sie niemand für vergessen
		// hält — sie steht wörtlich im Protokoll.
		expect(r.erfordernis?.rechtsgrundlage).toMatch(/Ziff\. 14\.2/);
	});

	it('gilt sie ohne Vorbehalt, wenn der frühere Antrag abgelehnt wurde', async () => {
		const s = await behandelt('Rückkommensweg 22', '2027-07-22');
		await hinterlege(s.gemeinschaft);
		await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'no' },
			{ parteiId: s.parteien[1], wahl: 'no' }
		]);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);

		expect(r.erfordernis?.quelle).toBe('reglement');
	});
});

/**
 * **Rückkommen, dann Neuabstimmung auf den neuen Durchgang** (`docs/freigabe.md`,
 * «Reste zur Universalversammlung», Punkt 9; Migration 131).
 *
 * Beim Schliessen des neuen Durchgangs wurde der frühere als `rueckkommen`
 * überholt; die Neuabstimmung überholte auch den neuen, und bis dahin galt
 * keiner mehr. Rechtlich gilt der frühere weiter: Kein Beschluss hat ihn «mit
 * dem erforderlichen Mehr» abgeändert (Rz. 202a ad Art. 712g).
 *
 * **Seit H6 nur noch nach einem offenen Gleichstand.** Einen verkündeten
 * Durchgang überholt die Leitung nicht mehr, und das Schliessen verkündet.
 * Die Kette führt deshalb über einen zweiten Durchgang, der unentschieden
 * endet: Er ersetzt den früheren nie (`rueckkommen_erfolglos`), und die
 * Neuabstimmung macht daraus eine Korrektur.
 */
describe('Neuabstimmung auf den Durchgang nach dem Rückkommen', () => {
	const alleJa = (s: { parteien: string[] }) =>
		s.parteien.map((parteiId) => ({ parteiId, wahl: 'yes' as const }));
	const alleNein = (s: { parteien: string[] }) =>
		s.parteien.map((parteiId) => ({ parteiId, wahl: 'no' as const }));

	/**
	 * D1 angenommen, Rückkommen angenommen, D2 unentschieden (Stichentscheid
	 * offen), Neuabstimmung auf D2. Bis H6 war D2 ein neuer Beschluss.
	 */
	async function kette(name: string, datum: string) {
		const s = await behandelt(name, datum, true);
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' },
			{ parteiId: s.parteien[3], wahl: 'no' }
		]);
		expect(erst.auszaehlung?.angenommen).toBe(true);
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, alleJa(s));
		const zweiter = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' },
			{ parteiId: s.parteien[3], wahl: 'no' }
		]);
		expect(zweiter.auszaehlung?.stichentscheidOffen).toBe(true);
		expect(zweiter.durchgang.verkuendetAm).toBeNull();
		// Bis hierher: Der unentschiedene Durchgang hat den früheren nicht ersetzt.
		expect((await holeErgebnis(betreiber, s.versammlung, erst.durchgang.id)).durchgang.ueberholtAm).toBeNull();

		await setzeNeuabstimmungAn(
			handelnder(betreiber),
			s.versammlung,
			zweiter.durchgang.id,
			'Prüflauf: Stimmen doppelt erfasst'
		);
		return { ...s, rueckkommen: r.id, erst: erst.durchgang.id, zweiter: zweiter.durchgang.id };
	}

	const massgebendeIds = async (s: { versammlung: string; traktandum: string }) =>
		(await holeDurchgaenge(betreiber, s.versammlung))
			.filter((d) => d.traktandumId === s.traktandum && !d.ueberholtAm)
			.map((d) => d.id);

	it('sagt im Protokoll, dass nach dem beschlossenen Rückkommen nicht erneut abgestimmt wurde', async () => {
		/*
		 * **Rückkommen angenommen, kein neuer Durchgang** (Fachprüfung 30.09.2026,
		 * F-8). Nach der Bedingung im Antrag gilt der frühere Beschluss; ohne Satz
		 * stand unter 4.1 «… wird der bisherige aufgehoben …: angenommen» und beim
		 * Geschäft das frühere Ergebnis ohne Erklärung.
		 */
		const s = await behandelt('Rückkommensweg 34', '2027-08-05');
		await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, alleJa(s));

		const text = (
			await erzeugeProtokollentwurf(handelnder(betreiber), s.versammlung, '2027-08-05 21:00:00')
		).body.replace(/\s+/g, ' ');
		expect(text).toMatch(
			/- Die Versammlung hat beschlossen, auf dieses Traktandum zurückzukommen \(Traktandum [\d.]+\); erneut abgestimmt wurde nicht\. Es bleibt beim Beschluss aus dem 1\. Durchgang, wie oben festgehalten\. Soll neu entschieden werden, muss die Sache an einer nächsten Versammlung traktandiert werden, auch an einer eigens einberufenen; Anträge dazu gehen möglichst bald an die Stelle, die die Versammlung einberuft\./
		);
		// Und unter dem Rückkommensantrag selbst der Verweis (Laienprüfung Reste, L4).
		expect(text).toMatch(/- Erneut abgestimmt wurde nicht; siehe Traktandum \d+\./);
	});

	it('weist die Neuabstimmung auf die verkündete Ablehnung nach dem Rückkommen ab; sie gilt', async () => {
		/*
		 * Seit «Nein heisst Nein» (Produktentscheid 30.09.2026) ersetzt auch eine
		 * Ablehnung nach dem Rückkommen den früheren Beschluss. Bis H6 konnte die
		 * Leitung diese Ablehnung überholen, und der frühere galt wieder
		 * (Codeprüfung 30.09.2026, G5). Seither ist die Ablehnung mit dem
		 * Schliessen verkündet und bleibt; ändern kann sie nur die Versammlung.
		 */
		const s = await behandelt('Rückkommensweg 33', '2027-08-04');
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' }
		]);
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, alleJa(s));
		const zweiter = await abstimmen(s.versammlung, s.traktandum, alleNein(s));
		expect(zweiter.auszaehlung?.angenommen).toBe(false);
		expect(await massgebendeIds(s)).toEqual([zweiter.durchgang.id]);

		const ueberholen = setzeNeuabstimmungAn(
			handelnder(betreiber),
			s.versammlung,
			zweiter.durchgang.id,
			'Prüflauf: Frage falsch gestellt'
		);
		await expect(ueberholen).rejects.toMatchObject({ kennung: 'schon_verkuendet' });
		await expect(ueberholen).rejects.toThrow(/Beantragen Sie das Rückkommen/);
		expect(await massgebendeIds(s)).toEqual([zweiter.durchgang.id]);
		const [zeile] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind, superseded_by_round_id FROM voting_round WHERE id = ${erst.durchgang.id}`
		);
		expect(zeile).toEqual({ supersede_kind: 'rueckkommen', superseded_by_round_id: zweiter.durchgang.id });
		const text = (
			await erzeugeProtokollentwurf(handelnder(betreiber), s.versammlung, '2027-08-04 21:00:00')
		).body.replace(/\s+/g, ' ');
		expect(text).not.toContain('Es bleibt beim Beschluss aus dem 1. Durchgang');
		expect(text).not.toContain('Neuabstimmung angesetzt');
	});

	it('lässt den früheren Beschluss gelten, bis neu entschieden ist', async () => {
		const s = await kette('Rückkommensweg 30', '2027-08-01');

		expect(await massgebendeIds(s)).toEqual([s.erst]);
		const [zeile] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind, superseded_by_round_id FROM voting_round WHERE id = ${s.erst}`
		);
		expect(zeile).toEqual({ supersede_kind: null, superseded_by_round_id: null });
		const [zweiter] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind FROM voting_round WHERE id = ${s.zweiter}`
		);
		expect(zweiter.supersede_kind).toBe('korrektur');

		// Das Protokoll nennt den früheren als geltend, nicht «nicht abgestimmt».
		// Ohne «das Ergebnis des 2. Durchgangs gilt deshalb nicht» (H6): Der
		// unentschiedene Durchgang hatte nichts ersetzt; es bleibt beim früheren,
		// weil kein neuer Beschluss zustande kam, nicht wegen der Anordnung.
		const text = (
			await erzeugeProtokollentwurf(handelnder(betreiber), s.versammlung, '2027-08-01 21:00:00')
		).body.replace(/\s+/g, ' ');
		expect(text).toContain(
			'Auf dieses Traktandum wurde zurückgekommen und im 2. Durchgang erneut abgestimmt; es ' +
				'stand unentschieden, und der Stichentscheid wurde nicht festgestellt. Die ' +
				'Sitzungsleitung hat danach eine Neuabstimmung angesetzt (Begründung: Prüflauf: ' +
				'Stimmen doppelt erfasst); zu ihr kam es nicht mehr. Es bleibt beim Beschluss aus dem ' +
				'1. Durchgang, wie oben festgehalten.'
		);
		expect(text).not.toContain('gilt deshalb nicht');
		expect(text).not.toMatch(/früherer? Durchgang wurde überholt/);
	});

	it('stützt den nächsten Durchgang wieder auf das Rückkommen; auch ein Nein ersetzt den früheren', async () => {
		const s = await kette('Rückkommensweg 31', '2027-08-02');
		const dritter = await abstimmen(s.versammlung, s.traktandum, alleNein(s));
		expect(dritter.auszaehlung?.angenommen).toBe(false);

		const [zeile] = await imKontext(
			betreiber,
			(tx) => tx`SELECT reconsideration_item_id, supersede_kind FROM voting_round
			            WHERE id = ${dritter.durchgang.id}`
		);
		// Nein heisst Nein (Produktentscheid 30.09.2026): Die Ablehnung ersetzt
		// den wieder geltenden ersten Beschluss.
		expect(zeile).toEqual({
			reconsideration_item_id: s.rueckkommen,
			supersede_kind: null
		});
		expect(await massgebendeIds(s)).toEqual([dritter.durchgang.id]);

		const text = (
			await erzeugeProtokollentwurf(handelnder(betreiber), s.versammlung, '2027-08-02 21:00:00')
		).body.replace(/\s+/g, ' ');
		expect(text).toContain(
			'Der Beschluss aus dem 1. Durchgang («angenommen») ist damit ersetzt'
		);
		// Ohne «Er hatte … ergeben» (H6): Der überholte 2. Durchgang endete
		// unentschieden und hat kein lesbares Ergebnis.
		expect(text).toContain(
			'Die Sitzungsleitung hat den 2. Durchgang überholt und eine Neuabstimmung angesetzt ' +
				'(Begründung: Prüflauf: Stimmen doppelt erfasst). Er endete unentschieden, und der Stichentscheid wurde nicht festgestellt; massgebend ist der 3. Durchgang.'
		);
	});

	it('lässt einen neuen Beschluss den früheren ersetzen, und das Rückkommen ist danach verbraucht', async () => {
		const s = await kette('Rückkommensweg 32', '2027-08-03');
		const dritter = await abstimmen(s.versammlung, s.traktandum, alleJa(s));

		expect(await massgebendeIds(s)).toEqual([dritter.durchgang.id]);
		const [zeile] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind, superseded_by_round_id FROM voting_round WHERE id = ${s.erst}`
		);
		expect(zeile).toEqual({ supersede_kind: 'rueckkommen', superseded_by_round_id: dritter.durchgang.id });

		// Genau ein Durchgang je Rückkommensbeschluss, der nicht überholt ist.
		await expect(
			oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toThrow(/bereits zurückgekommen/);
	});

	/*
	 * **Codeprüfung zu Punkt 9, Befund 1.** Setzt die Leitung danach auch auf
	 * den wieder geltenden Durchgang eine Neuabstimmung an, gilt keiner. Der
	 * nächste lief bisher ohne Verweis, und der angenommene Antrag blieb liegen:
	 * Später trug er einen Durchgang über einen Beschluss, auf den er sich nie
	 * bezog. Jetzt hängt er am nächsten Durchgang und ist danach verbraucht.
	 *
	 * Seit H6 lässt sich ein verkündeter D1 nicht mehr überholen. Der Fall
	 * entsteht nur noch, wenn schon D1 unentschieden endete und das Rückkommen
	 * auf ihn gestellt wurde, bevor die Leitung ihn überholt.
	 */
	it('hängt das Rückkommen an den nächsten Durchgang, auch wenn gerade keiner gilt', async () => {
		const s = await behandelt('Rückkommensweg 35', '2027-08-06', true);
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' },
			{ parteiId: s.parteien[3], wahl: 'no' }
		]);
		expect(erst.durchgang.verkuendetAm).toBeNull();
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, alleJa(s));
		await setzeNeuabstimmungAn(
			handelnder(betreiber),
			s.versammlung,
			erst.durchgang.id,
			'Prüflauf: auch der erste war fehlerhaft'
		);
		expect(await massgebendeIds(s)).toEqual([]);

		const dritter = await abstimmen(s.versammlung, s.traktandum, alleJa(s));
		const [zeile] = await imKontext(
			betreiber,
			(tx) => tx`SELECT reconsideration_item_id FROM voting_round WHERE id = ${dritter.durchgang.id}`
		);
		expect(zeile.reconsideration_item_id).toBe(r.id);
		expect(await massgebendeIds(s)).toEqual([dritter.durchgang.id]);

		// Der Antrag trägt keinen weiteren Durchgang mehr.
		await expect(
			oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toThrow(/bereits zurückgekommen/);
	});

	it('lässt nach dem Rückkommen keinen zweiten Rückkommensantrag daneben zu', async () => {
		// Der erste wirkt wieder: angenommen und nicht verbraucht.
		const s = await kette('Rückkommensweg 33', '2027-08-04');
		await expect(
			stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toMatchObject({ kennung: 'schon_beantragt' });
	});
});
