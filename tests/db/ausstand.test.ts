/**
 * Der Ausstand je Traktandum (PRD §13; ZGB Art. 68 i.V.m. Art. 712m Abs. 2).
 *
 * **Die Kette, auf die es ankommt:** erklärt in der Oberfläche → gespeichert →
 * beim Auszählen aus der Bezugsgrösse genommen → in der Auswertung genannt.
 * Reisst sie irgendwo, stimmt eine Zahl nicht, und zwar unauffällig: Das
 * Ergebnis sähe richtig aus.
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
import {
	bestaetigeAnwesenheit,
	erfasseVerlassenDerVersammlung,
	holeUebersicht,
	lasseDurchDritteEin
} from '$lib/server/anwesenheit';
import { halteBeschlussfaehigkeitFest } from '$lib/server/beschlussfaehigkeit';
import {
	bestaetigeVollmacht,
	erfasseVollmacht,
	holeParteien,
	holeVollmachten,
	vermerkeVorlage,
	widerrufeVollmacht
} from '$lib/server/vollmacht';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import {
	erfasseSummen,
	gibStimmenAb,
	holeErgebnis,
	holeStimmsperren,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import {
	erklaereAusstand,
	holeAusstand,
	holeVertreterOhnePartei,
	holeVollmachtenImAusstand,
	nimmAusstandZurueck
} from '$lib/server/ausstand';
import { versiegle } from '$lib/server/siegel';
import { gibAb } from '$lib/server/abgabe';
import { erzeugeZugaenge } from '$lib/server/zugaenge';
import { registriereGeraet } from '$lib/server/geraete';
import { alsGeraetecode, erzeugeGeraeteschluessel } from '$lib/server/saalgeraet';
import { vertreterkennung } from '$lib/domain/vollmacht';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/**
 * Entfernt die Festschreibung eines verkündeten Durchgangs.
 *
 * **Warum diese Proben das brauchen** (Code-Review 25.09.2026 zur
 * Festschreibung, Befund 1). Seit dem 25.09.2026 liest `ergebnisIn` ein
 * verkündetes Ergebnis aus `result_json` und rechnet nicht mehr. Die Proben
 * zum eingefrorenen Ausstand und zu den eingefrorenen Vollmachten blieben
 * damit grün, auch wenn das Einfrieren in `attendance_json` kaputtginge: Sie
 * liefen nur noch durch den Lesezweig. Das Einfrieren zählt aber weiter, bis
 * zum Entscheid über einen offenen Stichentscheid und für Durchgänge ohne
 * Festschreibung. Diese Lage stellt die Funktion her.
 *
 * Der Trigger aus Migration 123 sperrt das Entfernen; deshalb für diese eine
 * Zeile in einer Transaktion mit abgeschalteten Triggern.
 */
async function ohneFestschreibung(durchgang: string) {
	await admin.begin(async (tx) => {
		await tx`SET LOCAL session_replication_role = replica`;
		await tx`UPDATE voting_round SET result_json = NULL WHERE id = ${durchgang}`;
	});
}

const EINFACHES_MEHR: Erfordernis = {
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
	pfad: [],
	quelle: 'hergeleitet'
};

/** Die Ermächtigung zur Ausschlussklage (ZGB Art. 649b Abs. 2). */
const AUSSCHLUSSKLAGE: Erfordernis = {
	...EINFACHES_MEHR,
	knotenId: 'k-ausschlussklage',
	titel: 'Ermächtigung zur Ausschlussklage',
	rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
	kopfbasis: 'alle_ausser_betroffene'
};

/**
 * Eine Reglementsklausel mit derselben Kopfbasis wie die Ausschlussklage, an
 * einem anderen Knoten. Wen sie ausnimmt, der vertritt weiter
 * (Produktentscheid 27.09.2026).
 */
const REGLEMENTSKLAUSEL: Erfordernis = {
	...EINFACHES_MEHR,
	typ: 'reglementsmehr',
	titel: 'Mehrheit aller ohne die Betroffenen',
	rechtsgrundlage: 'Reglement der Gemeinschaft, Art. 9',
	kopfbasis: 'alle_ausser_betroffene',
	quelle: 'reglement',
	fundstelle: 'Art. 9'
};

/**
 * Vier Eigentümer zu je 250, alle anwesend, ein Traktandum aufgerufen.
 *
 * Mit `beklagt` ist das erste Traktandum die Ermächtigung zur
 * Ausschlussklage gegen die Partei mit diesem Index, unter
 * `alle_ausser_betroffene`. Betroffene lassen sich nur im Entwurf zuordnen,
 * darum gehört das hierher und nicht in den einzelnen Prüffall.
 */
async function laufend(
	name: string,
	datum: string,
	beklagt?: number,
	erfordernis: Erfordernis = AUSSCHLUSSKLAGE,
	/**
	 * Wie eine Einladung, die kein Mehr nannte: ohne Untergrenze aus Migration
	 * 144. Für Proben, die im Saal bei offener Runde auf ein anderes Mehr
	 * umstellen; mit Untergrenze ginge das nur strenger.
	 */
	ohneUntergrenze = false
) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
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
		antragswortlaut: 'Der Hauswartauftrag wird an die Firma Duss vergeben.',
		antragstellerart: 'bewirtschaftung',
		...(beklagt === undefined ? {} : { betroffeneParteiIds: [parteien[beklagt]] })
	},
	// Entscheid 0050, Antwort 3: Betroffene nimmt das Formular nur mit einem Mehr an,
	// das sie kennt, wie die Route mit dem Feld «erfordernis».
	beklagt === undefined ? null : 'k-ausschlussklage');
	await haltErfordernisAmTraktandumFest(
		handelnder(betreiber),
		v.id,
		t.id,
		beklagt === undefined ? EINFACHES_MEHR : erfordernis
	);

	// Ein zweites, unbefangenes Traktandum. Gebraucht für den Nachweis, dass der
	// Ausstand je Traktandum gilt — und Traktanden lassen sich nur im Entwurf
	// anlegen, also gehört es hierhin und nicht in den einzelnen Prüffall.
	const t2 = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Budget',
		art: 'abstimmung',
		antragswortlaut: 'Das Budget wird genehmigt.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t2.id, EINFACHES_MEHR);

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	if (ohneUntergrenze) {
		await admin`UPDATE agenda_item SET released_requirement = NULL WHERE meeting_id = ${v.id}`;
	}
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}
	await stelleAufTraktandum(handelnder(betreiber), v.id, t.id);

	return {
		gemeinschaft: g.id,
		versammlung: v.id,
		traktandum: t.id,
		zweitesTraktandum: t2.id,
		parteien
	};
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Ausstand');
	benutzer = await pruefbenutzer(betreiber, 'ausstandsleitung');
});

afterAll(verbindungenSchliessen);

describe('Ein erklärter Ausstand', () => {
	it('steht mit Grund und Person da', async () => {
		const s = await laufend('Ausstand 1', '2027-05-01');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Der Auftrag geht an seine eigene Firma.'
		);

		const liste = await holeAusstand(betreiber, s.traktandum);
		expect(liste).toHaveLength(1);
		expect(liste[0].name).toBe('Duss');
		expect(liste[0].grund).toMatch(/eigene Firma/);
		expect(liste[0].erklaertDurch).toBe('Prüflauf');
	});

	it('verlangt einen Grund', async () => {
		// Ohne ihn liesse sich später nicht von einem Erfassungsfehler
		// unterscheiden — und er verändert die Zahl, gegen die gemessen wird.
		const s = await laufend('Ausstand 2', '2027-05-02');
		await expect(
			erklaereAusstand(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], '  ')
		).rejects.toThrow(/Grund des Ausstands/);
	});

	it('nimmt den Ausgetretenen aus der Bezugsgrösse', async () => {
		/*
		 * **Der Prüfstein der ganzen Kette.** Vier Eigentümer, zwei stimmen ja,
		 * einer nein, einer im Ausstand. Bliebe er in der Basis, wäre die Schwelle
		 * 3 und der Antrag abgelehnt; fällt er heraus, ist sie 2 und der Antrag
		 * angenommen.
		 */
		const s = await laufend('Ausstand 3', '2027-05-03');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Der Auftrag geht an seine eigene Firma.'
		);

		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.parteien[0], wahl: 'yes' },
				{ parteiId: s.parteien[1], wahl: 'yes' },
				{ parteiId: s.parteien[2], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);

		const a = auszaehlung!;
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.schwelle).toBe(2);
		expect(a.koepfe.ja).toBe(2);
		expect(a.angenommen).toBe(true);
		// Und die Wertquoten des Ausgetretenen liegen in keinem Eimer.
		expect(a.quoten.ja + a.quoten.nein + a.quoten.enthaltung + a.quoten.ohneAbgabe).toBe(750);
	});

	it('erscheint namentlich im Ergebnis', async () => {
		// Ohne diese Zeile im Protokoll ginge die Rechnung für einen Leser nicht
		// auf: Vier Eigentümer, drei Stimmen, und keine Erklärung.
		const s = await laufend('Ausstand 4', '2027-05-04');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Der Auftrag geht an seine eigene Firma.'
		);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[{ parteiId: s.parteien[0], wahl: 'yes' }],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);

		const ergebnis = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);
		expect(ergebnis.auszaehlung?.hinweise.join(' ')).toMatch(/«Duss» ist bei diesem Traktandum/);
		expect(ergebnis.auszaehlung?.hinweise.join(' ')).toMatch(/Art\. 68/);
	});

	it('lässt sich zurücknehmen, und die Zahl kehrt zurück', async () => {
		const s = await laufend('Ausstand 5', '2027-05-05');
		const erklaert = await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Vermutung, noch zu klären.'
		);
		// Die Aktionen sagen bei `false` ab; eine echte Rücknahme muss `true` melden.
		expect(await nimmAusstandZurueck(handelnder(betreiber), s.versammlung, erklaert.id)).toBe(true);
		// Der zweite Klick findet nichts mehr.
		expect(await nimmAusstandZurueck(handelnder(betreiber), s.versammlung, erklaert.id)).toBe(false);

		expect(await holeAusstand(betreiber, s.traktandum)).toHaveLength(0);

		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.parteien[0], wahl: 'yes' },
				{ parteiId: s.parteien[1], wahl: 'yes' },
				{ parteiId: s.parteien[2], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);
		// Zurück bei vier Köpfen: zwei Ja reichen nicht mehr.
		expect(auszaehlung!.koepfe.basis).toBe(4);
		expect(auszaehlung!.angenommen).toBe(false);
	});

	/*
	 * **Das Ergebnis eines geschlossenen Durchgangs hält seinen Ausstand fest**
	 * (seit 25.09.2026; Code-Review 24.09.2026 zu `ausstandswirkung`, Befund 3).
	 * Erklären und Zurücknehmen sind nur bei offenem Durchgang gesperrt, und das
	 * Ergebnis las den Ausstand, wie er jetzt ist. Beide Richtungen, weil beide
	 * das Ergebnis drehten: Die Rücknahme liess die Basis nachträglich wachsen,
	 * die späte Erklärung schrumpfen.
	 */
	it('ändert das Ergebnis nicht, wenn er nach dem Schliessen zurückgenommen wird', async () => {
		const s = await laufend('Ausstand 7', '2027-05-07');
		const erklaert = await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Der Auftrag geht an seine eigene Firma.'
		);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.parteien[0], wahl: 'yes' },
				{ parteiId: s.parteien[1], wahl: 'yes' },
				{ parteiId: s.parteien[2], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		await ohneFestschreibung(geschlossen.id);
		const vorher = (await holeErgebnis(betreiber, s.versammlung, geschlossen.id)).auszaehlung!;
		expect(vorher.koepfe.basis).toBe(3);
		expect(vorher.angenommen).toBe(true);
		expect(vorher.ausstandswirkung).not.toBeNull();

		await nimmAusstandZurueck(handelnder(betreiber), s.versammlung, erklaert.id);

		const nachher = (await holeErgebnis(betreiber, s.versammlung, geschlossen.id)).auszaehlung!;
		expect(nachher.koepfe.basis).toBe(3);
		expect(nachher.angenommen).toBe(true);
		expect(nachher.ausstandswirkung).toBe(vorher.ausstandswirkung);
	});

	it('ändert das Ergebnis nicht, wenn er erst nach dem Schliessen erklärt wird', async () => {
		const s = await laufend('Ausstand 8', '2027-05-08');
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.parteien[0], wahl: 'yes' },
				{ parteiId: s.parteien[1], wahl: 'yes' },
				{ parteiId: s.parteien[2], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		await ohneFestschreibung(geschlossen.id);
		expect(
			(await holeErgebnis(betreiber, s.versammlung, geschlossen.id)).auszaehlung!.angenommen
		).toBe(false);

		// Der Weg aus der Absage in `server/ausstand.ts`: schliessen, erklären,
		// Neuabstimmung ansetzen. Bis dahin gilt das verkündete Ergebnis.
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Der Auftrag geht an seine eigene Firma.'
		);
		const nachher = (await holeErgebnis(betreiber, s.versammlung, geschlossen.id)).auszaehlung!;
		expect(nachher.koepfe.basis).toBe(4);
		expect(nachher.angenommen).toBe(false);
		expect(nachher.ausstandswirkung ?? null).toBeNull();
	});

	it('liest bei Durchgängen ohne festgeschriebenen Ausstand weiter, wie er jetzt ist', async () => {
		/*
		 * **Die Unterscheidung null gegen leer** (Code-Review 25.09.2026 zum
		 * eingefrorenen Ausstand, Befund 2). Durchgänge von vor dem 25.09.2026
		 * tragen den Schlüssel `ausstand` nicht; für sie gilt der Ausstand aus
		 * `recusal`. Würde ein fehlender Schlüssel als «kein Ausstand» gelesen,
		 * verlören sie ihn still, ihre Basis wüchse, und ein Ergebnis könnte
		 * kippen. Der Schlüssel wird hier entfernt, um diesen Altbestand
		 * nachzustellen.
		 */
		const s = await laufend('Ausstand 9', '2027-05-09');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Der Auftrag geht an seine eigene Firma.'
		);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.parteien[0], wahl: 'yes' },
				{ parteiId: s.parteien[1], wahl: 'yes' },
				{ parteiId: s.parteien[2], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		await ohneFestschreibung(geschlossen.id);
		await admin`
			UPDATE voting_round SET attendance_json = attendance_json - 'ausstand'
			WHERE id = ${geschlossen.id}
		`;
		const a = (await holeErgebnis(betreiber, s.versammlung, geschlossen.id)).auszaehlung!;
		expect(a.koepfe.basis).toBe(3);
		expect(a.angenommen).toBe(true);
	});

	it('steht im Verlauf, mit Grund — auch die Rücknahme', async () => {
		const s = await laufend('Ausstand 6', '2027-05-06');
		const erklaert = await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Der Auftrag geht an seine eigene Firma.'
		);
		await nimmAusstandZurueck(handelnder(betreiber), s.versammlung, erklaert.id);

		const eintraege = await admin<{ event_type: string; detail: Record<string, unknown> }[]>`
			SELECT event_type, detail FROM audit_entry
			WHERE subject_id = ${s.traktandum}
			  AND event_type IN ('agenda.item.recusal.declared', 'agenda.item.recusal.withdrawn')
			ORDER BY id
		`;
		expect(eintraege.map((e) => e.event_type)).toEqual([
			'agenda.item.recusal.declared',
			'agenda.item.recusal.withdrawn'
		]);
		expect(eintraege[0].detail.grund).toMatch(/eigene Firma/);
		expect(eintraege[0].detail.partei).toBe('Duss');
	});
});

describe('Abgewiesen wird', () => {
	it('ein Ausstand mitten in einer laufenden Abstimmung', async () => {
		// Er verschöbe die Bezugsgrösse unter den Stimmen weg, die schon abgegeben
		// sind — dann stünde ein Ergebnis da, das mit anderen Zahlen zustande kam
		// als denen an der Wand.
		const s = await laufend('Ausstand 7', '2027-05-07');
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);

		await expect(
			erklaereAusstand(
				handelnder(betreiber),
				s.versammlung,
				s.traktandum,
				s.parteien[3],
				'Zu spät gemerkt.'
			)
		).rejects.toThrow(/gerade abgestimmt/);
	});

	it('derselbe Ausstand ein zweites Mal', async () => {
		const s = await laufend('Ausstand 8', '2027-05-08');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Der Auftrag geht an seine eigene Firma.'
		);
		await expect(
			erklaereAusstand(
				handelnder(betreiber),
				s.versammlung,
				s.traktandum,
				s.parteien[3],
				'Nochmals dasselbe.'
			)
		).rejects.toThrow(FachlicherFehler);
	});

	/**
	 * **Die Spiegelprobe zum Traktandum** (Kernbindungswächter, 08.09.2026).
	 *
	 * Das Traktandum war gebunden, die Partei nicht: `erklaereAusstand` fragte
	 * nur `SELECT display_name FROM party WHERE id = ${parteiId}`, und `party`
	 * trennt der Zeilenschutz nach **Betreiber**, nicht nach Gemeinschaft. Die
	 * Kennung kommt aus dem Formular, also liess sich eine Partei aus einer
	 * anderen Gemeinschaft desselben Betreibers hier in den Ausstand setzen —
	 * die Zeile in `recusal` entstand, und die Stimmsperre rechnete mit ihr.
	 */
	it('eine Partei aus einer anderen Gemeinschaft', async () => {
		const eine = await laufend('Ausstand 11', '2027-05-11');
		const andere = await laufend('Ausstand 12', '2027-05-12');
		await expect(
			erklaereAusstand(
				handelnder(betreiber),
				eine.versammlung,
				eine.traktandum,
				andere.parteien[0],
				'Gehört nicht hierher.'
			)
			// **Der Wortlaut muss die beiden Absagen trennen** (Code-Review
			// 08.09.2026). `/gehört nicht zu dieser Versammlung/` trifft auch den
			// Satz zum Traktandum, den dieselbe Funktion zwanzig Zeilen früher
			// wirft — dann bliebe die Probe grün, wenn die Parteiprüfung
			// verschwindet und stattdessen die Traktandumsprüfung anschlägt.
		).rejects.toThrow(/Diese Partei gehört nicht/);
	});

	it('ein Traktandum aus einer anderen Versammlung', async () => {
		const eine = await laufend('Ausstand 9', '2027-05-09');
		const andere = await laufend('Ausstand 10', '2027-05-10');
		await expect(
			erklaereAusstand(
				handelnder(betreiber),
				eine.versammlung,
				andere.traktandum,
				eine.parteien[0],
				'Gehört nicht hierher.'
			)
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
	});
});

/**
 * **Wer im Ausstand ist, kann auch niemanden vertreten** (BGE 134 III 481
 * E. 3.8).
 *
 * Die Kette ist länger als beim Ausstand allein: erklärt → die Vollmacht ruht →
 * die Stimme wird gar nicht erst entgegengenommen → beim Schliessen eingefroren
 * → in der Auswertung erklärt. Reisst sie in der Mitte, gibt der Ausstand die
 * Stimme nur weiter, statt sie zu entziehen.
 */
describe('Ausstand und Vollmacht', () => {
	/**
	 * Wie `laufend`, aber Aebi vertritt Bucher: drei Personen im Saal, vier
	 * Parteien anwesend.
	 */
	async function mitVollmacht(
		name: string,
		datum: string,
		beklagt?: number,
		erfordernis: Erfordernis = AUSSCHLUSSKLAGE,
		ohneUntergrenze = false
	) {
		const s = await laufend(name, datum, beklagt, erfordernis, ohneUntergrenze);

		// Beide zuerst wieder hinaus: Solange Bucher selbst im Saal steht, lässt
		// sich über sie gar keine Vollmacht erfassen — sie übt ja selbst aus. Und
		// die Vertretung entsteht erst, wenn der Bevollmächtigte eintrifft.
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[0]);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[1]);

		const momentparteien = await holeParteien(betreiber, s.versammlung);
		const nach = (wer: string) => momentparteien.find((p) => p.name === wer)!;

		const v = await erfasseVollmacht(handelnder(betreiber), s.versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtId: nach('Aebi').id
		});
		await vermerkeVorlage(handelnder(betreiber), s.versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), s.versammlung, v.id);

		// Aebi trifft ein und bringt Bucher mit — Weg `vertretung`.
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.parteien[0], 'von_hand');

		return { ...s, aebi: s.parteien[0], bucher: s.parteien[1] };
	}

	it('lässt die Vollmacht des Beklagten ruhen, ohne dass jemand einen Ausstand erklärt', async () => {
		/*
		 * **Fachprüfung 25.09.2026** (`quellen/themen/stockwerkeigentum/fragen.md`,
		 * Frage 45). Bei der Ermächtigung zur Ausschlussklage ist der Beklagte von
		 * Gesetzes wegen ausgeschlossen (ZGB Art. 649b Abs. 2), und wer
		 * ausgeschlossen ist, kann niemanden vertreten (BGE 134 III 481 E. 3.8).
		 * Bis zu diesem Tag nahm der Server Aebis Stimme für Bucher an, und die
		 * Auszählung zählte sie, solange niemand Aebi in den Ausstand setzte.
		 */
		const s = await mitVollmacht('Beklagter Vollmacht 1', '2027-06-09', 0);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);

		const sperren = await holeStimmsperren(betreiber, s.versammlung, s.traktandum);
		expect(sperren.find((x) => x.parteiId === s.aebi)?.art).toBe('betroffen');
		const bucher = sperren.find((x) => x.parteiId === s.bucher);
		expect(bucher?.art).toBe('vertretung_ruht');
		expect(bucher?.wegen).toBe('betroffen');

		await expect(
			gibStimmenAb(handelnder(betreiber), s.versammlung, [{ parteiId: s.aebi, wahl: 'no' }], true, 'Prüflauf: von der Sitzungsleitung erfasst')
		).rejects.toThrow(/unmittelbar betroffen und von der Abstimmung ausgenommen/);
		await expect(
			gibStimmenAb(handelnder(betreiber), s.versammlung, [{ parteiId: s.bucher, wahl: 'yes' }], true, 'Prüflauf: von der Sitzungsleitung erfasst')
		).rejects.toThrow(/kann auch niemanden vertreten/);

		// Christen ja, Duss nein. Basis: alle ausser dem Beklagten, auch die
		// Abwesenden, also drei; nötig sind zwei Ja.
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.parteien[2], wahl: 'yes' },
				{ parteiId: s.parteien[3], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);
		const a = auszaehlung!;
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.ja).toBe(1);
		expect(a.angenommen).toBe(false);
		expect(a.ohneZustimmung.find((f) => f.name === 'Bucher')?.grund).toBe('vertretung_ruht');
		expect(a.hinweise.join(' ')).toMatch(/wer als unmittelbar betroffen/);
	});

	it('sperrt nach der Kopfbasis der offenen Runde, nicht nach dem Traktandum', async () => {
		/*
		 * **Code-Review 25.09.2026, Befund 1.** Das Erfordernis am Traktandum
		 * lässt sich während einer offenen Runde ändern, ausgezählt wird mit dem
		 * beim Öffnen eingefrorenen. Läse die Sperre das Traktandum, nähme der
		 * Server nach dem Umstellen die Stimme des Beklagten wieder an, die die
		 * Auszählung dann doch fallen liesse.
		 *
		 * **Ohne Untergrenze** (06.10.2026): Seit Migration 144 geht das
		 * Umstellen im Saal nur strenger als die Einladung, und der Wechsel von
		 * «alle ausser den Betroffenen» auf die Anwesenden gilt als gemischt.
		 * Der Weg bleibt an Traktanden, deren Einladung kein Mehr nannte, und bei
		 * einem strengeren Wechsel offen; hier bewacht die Probe den ersten.
		 */
		const s = await mitVollmacht('Beklagter Vollmacht 2', '2027-06-10', 0, AUSSCHLUSSKLAGE, true);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), s.versammlung, s.traktandum, EINFACHES_MEHR);

		const sperren = await holeStimmsperren(betreiber, s.versammlung, s.traktandum);
		expect(sperren.find((x) => x.parteiId === s.aebi)?.art).toBe('betroffen');
		await expect(
			gibStimmenAb(handelnder(betreiber), s.versammlung, [{ parteiId: s.bucher, wahl: 'yes' }], true, 'Prüflauf: von der Sitzungsleitung erfasst')
		).rejects.toThrow(/kann auch niemanden vertreten/);
	});

	it('lässt die Vollmacht wirken, wo nur eine Reglementsklausel den Betroffenen ausnimmt', async () => {
		/*
		 * **Produktentscheid 27.09.2026** (`quellen/themen/stockwerkeigentum/
		 * fragen.md`, «Offen»): Wen nur ein Reglement aus der Kopfbasis nimmt,
		 * der darf andere vertreten. Dieselbe Lage wie beim Beklagten oben, nur
		 * am Knoten einer Reglementsklausel: Aebi stimmt nicht selbst, Bucher
		 * über ihn schon. Bis zu diesem Tag wies der Server Buchers Stimme ab.
		 */
		const s = await mitVollmacht('Reglementsklausel Vollmacht 1', '2027-06-11', 0, REGLEMENTSKLAUSEL);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);

		const sperren = await holeStimmsperren(betreiber, s.versammlung, s.traktandum);
		expect(sperren.find((x) => x.parteiId === s.aebi)?.art).toBe('betroffen');
		expect(sperren.find((x) => x.parteiId === s.bucher)).toBeUndefined();

		await expect(
			gibStimmenAb(handelnder(betreiber), s.versammlung, [{ parteiId: s.aebi, wahl: 'no' }], true, 'Prüflauf: von der Sitzungsleitung erfasst')
		).rejects.toThrow(/unmittelbar betroffen und von der Abstimmung ausgenommen/);

		// Bucher über Aebi ja, Christen ja, Duss nein. Basis drei, nötig zwei.
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.bucher, wahl: 'yes' },
				{ parteiId: s.parteien[2], wahl: 'yes' },
				{ parteiId: s.parteien[3], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);
		const a = auszaehlung!;
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.ja).toBe(2);
		expect(a.angenommen).toBe(true);
		expect(a.hinweise.join(' ')).not.toMatch(/war nur über/);
	});

	it('lässt bei der Handzählung unter der Reglementsklausel die Hand der Vertretenen zu', async () => {
		/*
		 * Derselbe Weg über `erfasseSummen`: Die Vorabprüfung am Server und die
		 * Rechnung lesen dieselbe Stelle. Drei Hände (Bucher über Aebi,
		 * Christen, Duss); beim Beklagten wären es höchstens zwei.
		 */
		const s = await mitVollmacht('Reglementsklausel Vollmacht 2', '2027-06-12', 0, REGLEMENTSKLAUSEL);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await erfasseSummen(handelnder(betreiber), s.versammlung, { ja: 3, nein: 0, enthaltung: 0 });
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);
		expect(auszaehlung!.koepfe.basis).toBe(3);
		expect(auszaehlung!.angenommen).toBe(true);
	});

	it('nimmt die Stimme der ruhend vertretenen Partei gar nicht erst entgegen', async () => {
		/*
		 * **Hier abzuweisen ist der einzige Ort, an dem es sich erklären lässt.**
		 * Die Auszählung liesse die Stimme ohnehin fallen — aber stillschweigend:
		 * Auf dem Telefon stünde «Ihre Stimme ist erfasst», im Ergebnis käme sie
		 * nicht vor.
		 */
		const s = await mitVollmacht('Ausstand Vollmacht 1', '2027-06-01');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.aebi,
			'Der Auftrag geht an seine eigene Firma.'
		);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);

		// Für sich selbst darf der Ausgetretene ebenfalls nicht stimmen.
		await expect(
			gibStimmenAb(handelnder(betreiber), s.versammlung, [{ parteiId: s.aebi, wahl: 'yes' }], true, 'Prüflauf: von der Sitzungsleitung erfasst')
		).rejects.toThrow(/im Ausstand/);

		await expect(
			gibStimmenAb(handelnder(betreiber), s.versammlung, [{ parteiId: s.bucher, wahl: 'yes' }], true, 'Prüflauf: von der Sitzungsleitung erfasst')
		).rejects.toThrow(/kann auch niemanden vertreten/);
	});

	it('weist bei der Handzählung schon beim Erfassen eine Hand zu viel ab', async () => {
		/*
		 * **Die Vorabprüfung kennt die ruhende Vollmacht** (seit 25.09.2026;
		 * Code-Review zur Handzählung, Befund 1). Vier Parteien anwesend, Aebi im
		 * Ausstand, Bucher nur über ihn vertreten: Zählen dürfen Christen und
		 * Duss, zwei Hände. Vorher liess die Vorabprüfung drei durch, weil sie
		 * die Vollmachten nicht kannte, und das Schliessen scheiterte danach an
		 * derselben Rechnung, im Saal.
		 */
		const s = await mitVollmacht('Ausstand Vollmacht 5', '2027-06-05');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.aebi,
			'Der Auftrag geht an seine eigene Firma.'
		);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await expect(
			erfasseSummen(handelnder(betreiber), s.versammlung, { ja: 2, nein: 1, enthaltung: 0 })
		).rejects.toThrow(/Mehr Stimmen als Stimmberechtigte/);

		await erfasseSummen(handelnder(betreiber), s.versammlung, { ja: 1, nein: 1, enthaltung: 0 });
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);
		expect(auszaehlung!.koepfe.basis).toBe(2);
	});

	it('die ruhend Vertretene gibt keine Stimme ab — und sagt warum', async () => {
		/*
		 * Vier Parteien: Aebi im Ausstand, Bucher nur über ihn vertreten, Christen
		 * ja, Duss nein. Ohne die Regel wären es drei in der Basis und Bucher
		 * könnte den Ausschlag geben; mit ihr sind es zwei, und es steht 1:1.
		 */
		const s = await mitVollmacht('Ausstand Vollmacht 2', '2027-06-02');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.aebi,
			'Der Auftrag geht an seine eigene Firma.'
		);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.parteien[2], wahl: 'yes' },
				{ parteiId: s.parteien[3], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);

		const a = auszaehlung!;
		expect(a.koepfe.basis).toBe(2);
		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.nein).toBe(1);
		expect(a.koepfe.nichtAnwesend).toBe(1);
		expect(a.angenommen).toBe(false);
		expect(a.ohneZustimmung.find((f) => f.name === 'Bucher')?.grund).toBe('vertretung_ruht');
		expect(a.hinweise.join(' ')).toMatch(/«Bucher» war nur über Aebi vertreten/);
		expect(a.hinweise.join(' ')).toMatch(/BGE 134 III 481 E\. 3\.8/);
	});

	it('friert die Vollmachtslage beim Schliessen ein', async () => {
		/*
		 * **AD-16, derselbe Grund wie bei der Anwesenheit.** Wird die Vollmacht nach
		 * dem Schliessen widerrufen, darf das Ergebnis von 20:00 Uhr sich nicht
		 * nachträglich verschieben — sonst stünde im Protokoll eine andere Zahl als
		 * die, die im Saal verkündet wurde.
		 */
		const s = await mitVollmacht('Ausstand Vollmacht 3', '2027-06-03');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.aebi,
			'Der Auftrag geht an seine eigene Firma.'
		);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[{ parteiId: s.parteien[2], wahl: 'yes' }],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		await ohneFestschreibung(geschlossen.id);
		const vorher = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);

		const [vollmacht] = await holeVollmachten(betreiber, s.versammlung);
		await widerrufeVollmacht(
			handelnder(betreiber),
			s.versammlung,
			vollmacht.id,
			'Nach der Abstimmung zurückgezogen.'
		);

		const nachher = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);
		expect(nachher.auszaehlung).toEqual(vorher.auszaehlung);
		expect(nachher.auszaehlung?.hinweise.join(' ')).toMatch(/«Bucher» war nur über Aebi vertreten/);
	});

	it('lässt die Vollmacht beim nächsten Traktandum wieder ausüben', async () => {
		// Der Ausstand gilt je Traktandum. Wäre die Vollmacht danach hin, bestrafte
		// ein einziges befangenes Geschäft die vertretene Partei für den ganzen
		// Abend.
		const s = await mitVollmacht('Ausstand Vollmacht 4', '2027-06-04');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.aebi,
			'Der Auftrag geht an seine eigene Firma.'
		);

		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.zweitesTraktandum);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.zweitesTraktandum);

		// Beide dürfen wieder: der frühere Ausgetretene und die von ihm Vertretene.
		const { zeilen } = await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.aebi, wahl: 'yes' },
				{ parteiId: s.bucher, wahl: 'yes' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		expect(zeilen).toBe(2);

		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);
		expect(auszaehlung!.koepfe.ja).toBe(2);
		expect(auszaehlung!.koepfe.basis).toBe(4);
	});

	it('lässt die eigene Stimme, wo die vertretene Person selbst erschienen ist', async () => {
		/*
		 * Erscheint Bucher doch noch, endet die Vertretung — und der Ausstand ihres
		 * früheren Vertreters geht sie nichts mehr an. Ohne diese Unterscheidung
		 * nähme die Regel jemandem die eigene Stimme wegen einer Vollmacht, die
		 * niemand mehr ausübt.
		 */
		const s = await mitVollmacht('Ausstand Vollmacht 5', '2027-06-05');
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.bucher, 'von_hand');
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.aebi,
			'Der Auftrag geht an seine eigene Firma.'
		);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);

		const { zeilen } = await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[{ parteiId: s.bucher, wahl: 'yes' }],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		expect(zeilen).toBe(1);

		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);
		expect(auszaehlung!.koepfe.ja).toBe(1);
		expect(auszaehlung!.hinweise.join(' ')).not.toMatch(/war nur über/);
	});
	/**
	 * **Ein offener Durchgang sperrt beide Richtungen** (Code-Review
	 * 07.09.2026).
	 *
	 * Das Erklären war seit je gesperrt, die Rücknahme nicht. Beide verschieben
	 * die Bezugsgrösse, und `schliesseAbstimmung` liest die Ausstände beim
	 * Zählen frisch aus `recusal`: Eine Rücknahme mitten im Durchgang lässt die
	 * Basis unter den bereits abgegebenen Stimmen wachsen.
	 *
	 * Aufgefallen ist die Lücke erst, als der Knopf «Zurücknehmen» am
	 * 07.09.2026 aus der linken Ablaufspalte in die rechte zog. Die linke
	 * blendet der Saal-Modus bei offener Abstimmung aus — das sah wie eine
	 * Sperre aus und war eine Anzeige.
	 */
	it('lässt sich bei offenem Durchgang weder erklären noch zurücknehmen', async () => {
		const s = await laufend('Ausstand 7', '2027-05-07');
		const erklaert = await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Rechtzeitig vor der Abstimmung erklärt.'
		);

		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[{ parteiId: s.parteien[0], wahl: 'yes' }],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);

		// Beide Absagen nennen denselben Ausweg, und zwar den, den es gibt: das
		// Rückkommen. Seit H6 nicht mehr «Neuabstimmung ansetzen», denn das
		// Schliessen verkündet, und ein verkündetes Ergebnis überholt die
		// Leitung nicht.
		await expect(
			erklaereAusstand(
				handelnder(betreiber),
				s.versammlung,
				s.traktandum,
				s.parteien[2],
				'Zu spät, der Durchgang läuft.'
			)
		).rejects.toThrow(/verschöbe die Bezugsgrösse[\s\S]*Brechen Sie die Abstimmung ohne Ergebnis ab, ordnen Sie den Ausstand und geben Sie sie neu frei\./);

		await expect(
			nimmAusstandZurueck(handelnder(betreiber), s.versammlung, erklaert.id)
		).rejects.toThrow(/liesse die Bezugsgrösse[\s\S]*Brechen Sie die Abstimmung ohne Ergebnis ab, ordnen Sie den Ausstand und geben Sie sie neu frei\./);

		// Die Absage darf nicht halb gewirkt haben: Der Ausstand steht noch.
		expect(await holeAusstand(betreiber, s.traktandum)).toHaveLength(1);

		// Nach dem Schliessen ist der Weg wieder offen.
		await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		await nimmAusstandZurueck(handelnder(betreiber), s.versammlung, erklaert.id);
		expect(await holeAusstand(betreiber, s.traktandum)).toHaveLength(0);
	});

	/*
	 * **Ausstand und ruhende Vollmacht ändern die Beschlussfähigkeit nicht**
	 * (Ä-19 und Ä-25 der Zweitprüfung vom 17.09.2026; Erhebung zur Freigabe vom
	 * 16.10.2026: gebaut, aber ohne Probe). Die Beschlussfähigkeit verlangt, dass
	 * Eigentümer «anwesend oder vertreten» sind; wer sich enthält oder «wegen
	 * eines Interessenkonflikts nicht daran teilnimmt», ändert sie nicht
	 * (Wermelinger Rz. 17 ad Art. 712p). Für die ruhende Vollmacht sagt die
	 * Fundstelle nichts ausdrücklich; dass die Vertretene vertreten bleibt, ist
	 * eine Ableitung: Die Vollmacht ruht für die Stimme (BGE 134 III 481 E. 3.8),
	 * der Vertreter ist im Saal.
	 *
	 * Beide Lagen sind so gebaut, dass die Versammlung genau dann nicht mehr
	 * beschlussfähig wäre, wenn die Feststellung den Ausstand oder die ruhende
	 * Vollmacht abzöge. Die Zahlen allein reichten nicht: Sie bleiben auch
	 * gleich, wenn jemand die Feststellung aus einer anderen Quelle speist.
	 */
	it('Ausstand senkt die Beschlussfähigkeit nicht (Ä-19, Ä-25)', async () => {
		// Drei von vier im Ausstand. Zöge die Feststellung sie ab, blieben ein
		// Eigentümer und 250 von 1000, nötig sind zwei und 500.
		const s = await laufend('Ausstand Beschlussfähigkeit', '2027-06-20');
		const vorher = await holeUebersicht(betreiber, s.versammlung);
		for (const i of [1, 2, 3]) {
			await erklaereAusstand(
				handelnder(betreiber),
				s.versammlung,
				s.traktandum,
				s.parteien[i],
				'Der Auftrag geht an eine Firma, an der sie beteiligt sind.'
			);
		}

		const nachher = await holeUebersicht(betreiber, s.versammlung);
		expect(nachher!.eigentuemerAnwesend).toBe(4);
		expect(nachher!.quotenAnwesend).toBe(vorher!.quotenAnwesend);
		expect(nachher!.kopfstimmenAnwesend).toBe(vorher!.kopfstimmenAnwesend);

		const f = await halteBeschlussfaehigkeitFest(handelnder(betreiber), s.versammlung, s.traktandum);
		expect(f.beschlussfaehig).toBe(true);
		expect(f.eigentuemerAnwesend).toBe(4);

		// Und das Eröffnen, das dieselbe Feststellung verlangt, lässt verbindlich zu.
		const d = await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		expect(d.konsultativ).toBe(false);
	});

	it('eine ruhende Vollmacht senkt die Beschlussfähigkeit nicht (Ä-19)', async () => {
		/*
		 * Aebi ist bei der Ausschlussklage der Beklagte und vertritt Bucher; die
		 * Vollmacht ruht, ohne dass jemand einen Ausstand erklärt. Christen und
		 * Duss gehen. Im Saal: Aebi selbst und Bucher über ihn, zwei von vier
		 * und 500 von 1000, genau an der Schwelle. Zöge die Feststellung Bucher
		 * ab, fehlte beides.
		 */
		const s = await mitVollmacht('Ruhende Vollmacht Beschlussfähigkeit', '2027-06-21', 0);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[2]);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[3]);

		// Die Lage, um die es geht: Buchers Vertretung ruht wirklich.
		const sperren = await holeStimmsperren(betreiber, s.versammlung, s.traktandum);
		expect(sperren.find((x) => x.parteiId === s.bucher)?.art).toBe('vertretung_ruht');

		const u = await holeUebersicht(betreiber, s.versammlung);
		expect(u!.eigentuemerAnwesend).toBe(2);
		expect(u!.quotenAnwesend).toBe(500);

		const f = await halteBeschlussfaehigkeitFest(handelnder(betreiber), s.versammlung, s.traktandum);
		expect(f.beschlussfaehig).toBe(true);
		expect(f.eigentuemerAnwesend).toBe(2);
	});
});

/*
 * **Der Ausstand eines Vertreters, der nicht Eigentümer ist** (Migration 167,
 * Ä-26, Produktentscheid 17.10.2026). Bis dahin kannte der Ausstand nur
 * Parteien; vertrat die Verwaltung ohne Eigentum andere, liess sich ihr
 * Ausstand nicht erklären, und ihre Vollmachten zählten voll.
 */
describe('Ausstand eines Vertreters ohne Partei (Ä-26)', () => {
	const VERWALTUNG = 'Prüfverwaltung AG';

	/** Wie `laufend`, aber Bucher ist nur über die Verwaltung im Saal. */
	async function mitVerwaltung(name: string, datum: string) {
		const s = await laufend(name, datum);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[1]);
		const momentparteien = await holeParteien(betreiber, s.versammlung);
		const bucher = momentparteien.find((p) => p.name === 'Bucher')!;
		await lasseDurchDritteEin(handelnder(betreiber), s.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [bucher.id],
			nachweisVorgelegt: true
		});
		return { ...s, bucher: s.parteien[1], kennung: vertreterkennung(VERWALTUNG) };
	}

	it('lässt sich bei offenem Durchgang nicht erklären, wie bei einer Partei', async () => {
		// Gegenprobe der Featureprüfung Block 3 (18.10.2026): Die Sperren waren
		// nur mit einer Partei geprüft, nie mit einer Vertreterzeile.
		const s = await mitVerwaltung('Vertreterausstand 0', '2027-06-30');
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await expect(
			erklaereAusstand(handelnder(betreiber), s.versammlung, s.traktandum, s.kennung, 'Zu spät.')
		).rejects.toThrow(/verschöbe die Bezugsgrösse/);
		expect(await holeAusstand(betreiber, s.traktandum)).toHaveLength(0);
	});

	it('steht zur Wahl, mit den Vertretenen', async () => {
		const s = await mitVerwaltung('Vertreterausstand 1', '2027-07-01');
		const v = await holeVertreterOhnePartei(betreiber, s.versammlung);
		expect(v).toEqual([{ kennung: s.kennung, name: VERWALTUNG, vertritt: ['Bucher'] }]);
	});

	it('lässt die Vollmachten ruhen, gegen die Datenbank gezählt', async () => {
		const s = await mitVerwaltung('Vertreterausstand 2', '2027-07-02');
		const a = await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.kennung,
			'Es geht um ihre eigene Entschädigung'
		);
		expect(a).toMatchObject({ parteiId: s.kennung, vertreter: true, name: VERWALTUNG });
		const [zeile] = await admin<{ party_id: string | null; holder_name: string }[]>`
			SELECT party_id, holder_name FROM recusal WHERE id = ${a.id}
		`;
		expect(zeile).toEqual({ party_id: null, holder_name: VERWALTUNG });

		// Vorab gelesen: wessen Vollmacht ruhen wird.
		const vorab = await holeVollmachtenImAusstand(betreiber, s.versammlung, [a]);
		expect(vorab.get(a.id)).toEqual(['Bucher']);

		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		const sperren = await holeStimmsperren(betreiber, s.versammlung, s.traktandum);
		const bucher = sperren.find((x) => x.parteiId === s.bucher);
		expect(bucher?.art).toBe('vertretung_ruht');
		expect(bucher?.ueber).toBe(VERWALTUNG);
		// Der Vertreter selbst hat kein Gerät und keine Stimme: keine Sperre für ihn.
		expect(sperren.some((x) => x.parteiId === s.kennung)).toBe(false);

		await expect(
			gibStimmenAb(handelnder(betreiber), s.versammlung, [{ parteiId: s.bucher, wahl: 'yes' }], true, 'Prüflauf: von der Sitzungsleitung erfasst')
		).rejects.toThrow(/kann auch niemanden vertreten/);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.parteien[0], wahl: 'yes' },
				{ parteiId: s.parteien[2], wahl: 'yes' },
				{ parteiId: s.parteien[3], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const geschlossen = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, geschlossen.id);
		expect(auszaehlung!.ohneZustimmung.find((f) => f.name === 'Bucher')?.grund).toBe('vertretung_ruht');
		expect(auszaehlung!.hinweise.join(' ')).toContain(`nur über ${VERWALTUNG} vertreten`);
		// Festgeschrieben mit der Kennung des Vertreters und seinem Namen.
		const [stand] = await admin<{ attendance_json: { ausstand: string[]; vertretungen: { bevollmaechtigtName?: string }[] } }[]>`
			SELECT attendance_json FROM voting_round WHERE id = ${geschlossen.id}
		`;
		expect(stand.attendance_json.ausstand).toContain(s.kennung);
		expect(stand.attendance_json.vertretungen.map((v) => v.bevollmaechtigtName)).toContain(VERWALTUNG);
	});

	it('gilt je Traktandum und lässt sich zurücknehmen', async () => {
		const s = await mitVerwaltung('Vertreterausstand 3', '2027-07-03');
		const a = await erklaereAusstand(handelnder(betreiber), s.versammlung, s.traktandum, s.kennung, 'Eigene Entschädigung');
		// Der Anker: Am Traktandum selbst ruht Buchers Vollmacht (Codeprüfung, N6).
		const vorher = await holeStimmsperren(betreiber, s.versammlung, s.traktandum);
		expect(vorher.find((x) => x.parteiId === s.bucher)?.art).toBe('vertretung_ruht');
		const imZweiten = await holeStimmsperren(betreiber, s.versammlung, s.zweitesTraktandum);
		expect(imZweiten.some((x) => x.parteiId === s.bucher)).toBe(false);

		await nimmAusstandZurueck(handelnder(betreiber), s.versammlung, a.id);
		const danach = await holeStimmsperren(betreiber, s.versammlung, s.traktandum);
		expect(danach.some((x) => x.parteiId === s.bucher)).toBe(false);
		expect(await holeAusstand(betreiber, s.traktandum)).toEqual([]);
	});

	it('weist einen Namen ab, den in dieser Versammlung niemand als Vertreter trägt', async () => {
		const s = await mitVerwaltung('Vertreterausstand 4', '2027-07-04');
		await expect(
			erklaereAusstand(handelnder(betreiber), s.versammlung, s.traktandum, vertreterkennung('Erfundene GmbH'), 'Grund')
		).rejects.toThrow(/hält niemand unter diesem Namen eine Vollmacht/);
	});

	it('weist denselben Ausstand ein zweites Mal ab, auch in anderer Schreibweise', async () => {
		const s = await mitVerwaltung('Vertreterausstand 5', '2027-07-05');
		await erklaereAusstand(handelnder(betreiber), s.versammlung, s.traktandum, s.kennung, 'Grund');
		await expect(
			erklaereAusstand(
				handelnder(betreiber),
				s.versammlung,
				s.traktandum,
				vertreterkennung('  prüfverwaltung   ag '),
				'Grund'
			)
		).rejects.toThrow(/bereits ein Ausstand erklärt/);
	});

	it('hält die Schranke: Partei oder Vertreter, nie beides, nie keines', async () => {
		const s = await mitVerwaltung('Vertreterausstand 6', '2027-07-06');
		await expect(
			admin`
				INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id, party_id, holder_key, holder_name, grund, erklaert_durch)
				VALUES (uuidv7(), ${betreiber}, ${s.versammlung}, ${s.traktandum}, ${s.bucher}, 'x', 'X', 'Grund', 'Prüfer')
			`
		).rejects.toThrow(/recusal_partei_oder_vertreter/);
		await expect(
			admin`
				INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id, grund, erklaert_durch)
				VALUES (uuidv7(), ${betreiber}, ${s.versammlung}, ${s.traktandum}, 'Grund', 'Prüfer')
			`
		).rejects.toThrow(/recusal_partei_oder_vertreter/);
	});
});

/*
 * **Siegel- und Abgabesperre für eine Vertreterzeile** (Migration 167;
 * Pendenzen 18.10.2026). Die Auslöser hängen an der Zeile, nicht an der
 * Spalte; geprüft war bisher nur die Sperre bei offenem Durchgang und nur mit
 * einer Partei. Hier steht dieselbe Zeile nach dem Siegel und nach der Abgabe.
 */
describe('Siegel- und Abgabesperre für eine Vertreterzeile (Ä-26)', () => {
	const VERWALTUNG = 'Prüfverwaltung AG';

	/**
	 * Eine freigegebene Versammlung mit einer erfassten Vertretung, aber ohne
	 * Eröffnen: Die Abgabe gibt es nur vor dem Saal.
	 */
	async function freigegebenMitVertreter(name: string, datum: string) {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
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
			titel: 'Vergabe des Hauswartauftrags',
			art: 'abstimmung',
			antragswortlaut: 'Der Hauswartauftrag wird an die Firma Duss vergeben.',
			antragstellerart: 'bewirtschaftung'
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, EINFACHES_MEHR);
		await gibVersammlungFrei(handelnder(betreiber), v.id);
		await erzeugeZugaenge(handelnder(betreiber), v.id);

		const momentparteien = await holeParteien(betreiber, v.id);
		const bucher = momentparteien.find((p) => p.name === 'Bucher')!;
		await erfasseVollmacht(handelnder(betreiber), v.id, {
			vertreteneId: bucher.id,
			bevollmaechtigtName: VERWALTUNG
		});
		return { versammlung: v.id, traktandum: t.id, kennung: vertreterkennung(VERWALTUNG) };
	}

	it('hält eine Vertreterzeile nach dem Siegel auf', async () => {
		const s = await freigegebenMitVertreter('Vertreterausstand Siegel', '2027-07-10');
		await eroeffneVersammlung(handelnder(betreiber), s.versammlung);
		await schliesseVersammlung(handelnder(betreiber), s.versammlung);
		await versiegle(handelnder(betreiber), s.versammlung, '2027-07-10 21:00:00');

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id,
					                     holder_key, holder_name, grund, erklaert_durch)
					VALUES (uuidv7(), ${betreiber}, ${s.versammlung}, ${s.traktandum},
					        'nach-siegel', 'Nach dem Siegel', 'Nachtrag', 'Prüflauf')
				`
			)
		).rejects.toThrow(/versiegelt/i);
	});

	it('hält eine Vertreterzeile bei offener Abgabe auf', async () => {
		const s = await freigegebenMitVertreter('Vertreterausstand Abgabe', '2027-07-11');
		const paar = erzeugeGeraeteschluessel();
		const geraet = await registriereGeraet(
			handelnder(betreiber),
			'Notebook Vertreterausstand',
			alsGeraetecode(paar)
		);
		await gibAb(handelnder(betreiber), s.versammlung, { zustand: 'freigegeben' }, {
			geraetId: geraet.id,
			herkunft: null,
			jetzt: '2027-07-10 10:00:00'
		});

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id,
					                     holder_key, holder_name, grund, erklaert_durch)
					VALUES (uuidv7(), ${betreiber}, ${s.versammlung}, ${s.traktandum},
					        'nach-abgabe', 'Nach der Abgabe', 'Nachtrag', 'Prüflauf')
				`
			)
		).rejects.toMatchObject({ code: 'VO117' });
	});
});
