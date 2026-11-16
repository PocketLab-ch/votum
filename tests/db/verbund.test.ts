/**
 * Der Verbund: eine Gemeinschaft als Eigentümerin, und wer für sie stimmt
 * (Stories 7.1 und 7.2).
 *
 * MEG Umgebung Art. 7 Ziff. 3: «Die Eigentümer jedes dominierenden Grundstücks
 * haben eine Stimme (je 1/5). Ist ein dominierendes Grundstück in
 * Stockwerkeigentum aufgeteilt, so haben die beteiligten Stockwerkeigentümer nur
 * eine Stimme, die sie durch einen durch sie bezeichneten Vertreter auszuüben
 * haben.»
 *
 * Der Prüfstein von 7.1: **Es braucht keine neue Zählweise.** Die Umgebungs-MEG
 * ist eine gewöhnliche Gemeinschaft mit fünf Einheiten zu je 1/5, gezählt je
 * Einheit; neu ist allein die Natur des Trägers. Wenn das stimmt, muss die
 * Stimmkraftprüfung ohne jede Sonderbehandlung fünf Kopfstimmen und 5/5
 * Wertquoten zeigen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu, stimmkraftAnsicht } from '$lib/server/eigentuemer';
import {
	beendeVertretung,
	bezeichneVertreter,
	holeVertreterAm,
	holeVertretungen
} from '$lib/server/vertretung';
import {
	erstelleVersammlung,
	eroeffneVersammlung,
	holeVersammlung
} from '$lib/server/versammlungen';
import {
	eroeffneAmAbend,
	erstelleVersammlungstag,
	hausbefundssatz,
	holeTafel,
	lasseEin,
	schliesseAmAbendGanz,
	nimmAusTag,
	nimmInTagAuf,
	holeVersammlungstag,
	setzeAbendleitung
} from '$lib/server/versammlungstag';
import {
	einheitenDerPerson,
	einheitenMitEigentuemerAm,
	erstellePerson,
	holePersonen,
	ordneEinheitZuPerson,
	verknuepfePartei
} from '$lib/server/personen';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden
} from '$lib/server/traktanden';
import { erstelleGeschaeft } from '$lib/server/geschaeft';
import { oeffneAmAbend } from '$lib/server/abendsteuerung';
import { Schreibkonflikt } from '$lib/domain/schreibstand';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { halteSperre, warteAufWartende } from './rennen';
import { erzeugeZugaenge } from '$lib/server/zugaenge';
import { gibAb } from '$lib/server/abgabe';
import { registriereGeraet } from '$lib/server/geraete';
import { alsGeraetecode, erzeugeGeraeteschluessel } from '$lib/server/saalgeraet';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	gibStimmenAb,
	holeOffenen as holeOffenenDurchgang,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import {
	halteWeisungFest,
	holeWeisungen,
	holeWeisungsstand,
	holeWeisungsverlauf,
	leiteWeisungAusBeschlussAb,
	leiteWeisungenAbSammel,
	setzeWeisungsbindung,
	trageOhneBeschlussEin
} from '$lib/server/weisung';
import {
	holeOderErzeugeAbendmerkmal,
	loeseAbendeinstiegAuf,
	loeseSaaleinstiegAuf,
	saalmerkmalDesHauses
} from '$lib/server/saaleinstieg';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

let betreiber: string;

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

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/** Die Häuser des Prüfbestands, die zusammen die Umgebungs-MEG bilden. */
const HAEUSER = [
	'Nirgendweg 3',
	'Nirgendweg 5/5a',
	'Nirgendweg 7/7a',
	'Nirgendweg 11/11a',
	'Nirgendweg 13/13a'
];

/**
 * Baut die MEG Umgebung nach: fünf Anteile zu je 1/5, gehalten von den Häusern.
 */
async function umgebung(name: string) {
	const haeuser: { id: string; name: string }[] = [];
	for (const h of HAEUSER) {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: `${name} — ${h}`,
			quotaDenominator: 1000,
			headCountMode: 'per_unit',
			headCountRuleSource: 'Art. 28 Abs. 1',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		haeuser.push({ id: g.id, name: h });
	}

	const meg = await erstelleGemeinschaft(handelnder(betreiber), {
		name: `${name} — MEG Umgebung`,
		// Fünf Anteile zu je 1/5: Nenner 5, jede Einheit trägt 1.
		quotaDenominator: 5,
		headCountMode: 'per_unit',
		headCountRuleSource: 'Art. 7 Ziff. 3',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: 'verwalter',
		tieBreakRuleSource: 'Art. 7 Ziff. 5'
	});

	const parteien: string[] = [];
	for (const h of haeuser) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: meg.id,
			kind: 'unit',
			label: `Anteil ${h.name}`,
			quotas: { stamm: 1 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: meg.id,
			kind: 'gemeinschaft',
			displayName: h.name,
			memberStwegId: h.id,
			isCommunity: false,
			representativeName: `Vertretung ${h.name}`
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-02-19');
		parteien.push(p.id);
	}

	return { meg: meg.id, haeuser, parteien };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Verbund A');
});

afterAll(verbindungenSchliessen);

describe('Eine Gemeinschaft als Eigentümerin (Story 7.1)', () => {
	it('trägt fünf Kopfstimmen und 5/5 Wertquoten — ohne neue Zählweise', async () => {
		const v = await umgebung('Nirgendwerk 1');
		const k = await stimmkraftAnsicht(betreiber, v.meg, '2026-05-19');

		expect(k.zeilen).toHaveLength(5);
		expect(k.summeKopfstimmen).toBe(5);
		expect(k.summeWertquote).toBe(5);
		expect(k.einheitenOhneEigentuemer).toHaveLength(0);
		// Jedes Haus genau eine Stimme — nicht so viele, wie es Wohnungen hat.
		expect(k.zeilen.map((z) => z.kopfstimmen)).toEqual([1, 1, 1, 1, 1]);
	});

	it('verlangt einen bezeichneten Vertreter', async () => {
		// Art. 7 Ziff. 3 verlangt ihn, und ohne ihn stünde die Sitzungsleitung im
		// Moment der Abstimmung vor der Frage, wen sie zählen darf.
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Nirgendwerk 2 — Haus',
			quotaDenominator: 100,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const meg = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Nirgendwerk 2 — MEG',
			quotaDenominator: 5,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});

		await expect(
			erstelleEigentuemer(handelnder(betreiber), {
				stwegId: meg.id,
				kind: 'gemeinschaft',
				displayName: 'Haus ohne Vertreter',
				memberStwegId: g.id,
				isCommunity: false,
				representativeName: null
			})
		).rejects.toThrow(/Vertreter/);
	});

	it('weist eine Gemeinschaftspartei ohne Mitgliedsgemeinschaft ab', async () => {
		const meg = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Nirgendwerk 3 — MEG',
			quotaDenominator: 5,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		await expect(
			erstelleEigentuemer(handelnder(betreiber), {
				stwegId: meg.id,
				kind: 'gemeinschaft',
				displayName: 'Zeigt auf nichts',
				isCommunity: false,
				representativeName: 'Anna Muster'
			})
		).rejects.toThrow(/zeigen/);
	});

	it('weist eine Mitgliedsgemeinschaft an einer natürlichen Person ab', async () => {
		// Sonst entstünde eine Person mit einer Gemeinschaft im Rücken, und keine
		// Abfrage wüsste, was daraus folgt.
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Nirgendwerk 4 — Haus',
			quotaDenominator: 100,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		await expect(
			erstelleEigentuemer(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'natural',
				displayName: 'Anna Muster',
				memberStwegId: g.id,
				isCommunity: false,
				representativeName: null
			})
		).rejects.toThrow(/Gemeinschaft/);
	});

	it('weist den Selbstbezug ab', async () => {
		const meg = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Nirgendwerk 5 — MEG',
			quotaDenominator: 5,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		await expect(
			erstelleEigentuemer(handelnder(betreiber), {
				stwegId: meg.id,
				kind: 'gemeinschaft',
				displayName: 'Ich selbst',
				memberStwegId: meg.id,
				isCommunity: false,
				representativeName: 'Anna Muster'
			})
		).rejects.toThrow(/selbst/);
	});

	it('weist den Ring über zwei Gemeinschaften ab', async () => {
		// Haus hält Anteil an der MEG, MEG hält Anteil am Haus: eine
		// Endlosschleife, sobald jemand die Weisungskette verfolgt.
		const a = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Ringweg A',
			quotaDenominator: 10,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const b = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Ringweg B',
			quotaDenominator: 10,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});

		await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: a.id,
			kind: 'gemeinschaft',
			displayName: 'B hält an A',
			memberStwegId: b.id,
			isCommunity: false,
			representativeName: 'Anna Muster'
		});

		await expect(
			erstelleEigentuemer(handelnder(betreiber), {
				stwegId: b.id,
				kind: 'gemeinschaft',
				displayName: 'A hält an B',
				memberStwegId: a.id,
				isCommunity: false,
				representativeName: 'Peter Kunz'
			})
		).rejects.toThrow(/Ring/);
	});

	it('hält die Mitgliedschaft im Verlauf fest', async () => {
		const v = await umgebung('Nirgendwerk 6');
		const eintraege = await imKontext(
			betreiber,
			(tx) => tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				WHERE event_type = 'party.created' AND subject_id = ${v.parteien[0]}
			`
		);
		expect(eintraege[0]?.detail).toMatchObject({ art: 'gemeinschaft' });
		expect(eintraege[0]?.detail.mitgliedsgemeinschaft).toBe(v.haeuser[0].id);
	});
});

describe('Der bezeichnete Vertreter (Story 7.2)', () => {
	it('nennt den Vertreter zum Stichtag', async () => {
		const v = await umgebung('Vertretung 1');
		await bezeichneVertreter(handelnder(betreiber), {
			parteiId: v.parteien[0],
			personName: 'Anna Muster',
			ab: '2020-02-19',
			grundlage: 'Art. 7 Ziff. 3'
		});

		const am = await holeVertreterAm(betreiber, v.meg, '2026-05-19');
		expect(am.get(v.parteien[0])?.personName).toBe('Anna Muster');
		expect(am.get(v.parteien[0])?.grundlage).toBe('Art. 7 Ziff. 3');
	});

	it('lässt eine Versammlung vor dem Wechsel unverändert', async () => {
		// Der Kern der Zeitraumführung: Wer im März wechselt, ändert nichts an der
		// Versammlung vom Februar.
		const v = await umgebung('Vertretung 2');
		const erste = await bezeichneVertreter(handelnder(betreiber), {
			parteiId: v.parteien[0],
			personName: 'Anna Muster',
			ab: '2020-02-19'
		});
		await beendeVertretung(handelnder(betreiber), erste.id, '2026-03-01');
		await bezeichneVertreter(handelnder(betreiber), {
			parteiId: v.parteien[0],
			personName: 'Peter Kunz',
			ab: '2026-03-01'
		});

		const februar = await holeVertreterAm(betreiber, v.meg, '2026-02-10');
		const mai = await holeVertreterAm(betreiber, v.meg, '2026-05-19');
		expect(februar.get(v.parteien[0])?.personName).toBe('Anna Muster');
		expect(mai.get(v.parteien[0])?.personName).toBe('Peter Kunz');
	});

	it('weist zwei Vertreter zur selben Zeit ab', async () => {
		// Im Moment der Abstimmung liesse sich sonst nicht sagen, wer die eine
		// Stimme abgibt.
		const v = await umgebung('Vertretung 3');
		await bezeichneVertreter(handelnder(betreiber), {
			parteiId: v.parteien[0],
			personName: 'Anna Muster',
			ab: '2020-02-19'
		});
		await expect(
			bezeichneVertreter(handelnder(betreiber), {
				parteiId: v.parteien[0],
				personName: 'Peter Kunz',
				ab: '2024-01-01'
			})
		).rejects.toThrow(/bereits ein Vertreter/);
	});

	it('lässt zwei Häuser gleichzeitig je einen Vertreter haben', async () => {
		const v = await umgebung('Vertretung 4');
		await bezeichneVertreter(handelnder(betreiber), {
			parteiId: v.parteien[0],
			personName: 'Anna Muster',
			ab: '2020-02-19'
		});
		await bezeichneVertreter(handelnder(betreiber), {
			parteiId: v.parteien[1],
			personName: 'Peter Kunz',
			ab: '2020-02-19'
		});
		const alle = await holeVertretungen(betreiber, v.meg);
		expect(alle).toHaveLength(2);
	});

	it('weist einen leeren Namen ab', async () => {
		const v = await umgebung('Vertretung 5');
		await expect(
			bezeichneVertreter(handelnder(betreiber), {
				parteiId: v.parteien[0],
				personName: ' ',
				ab: '2020-02-19'
			})
		).rejects.toThrow(/Name/);
	});

	it('weist ein Ende vor dem Beginn ab', async () => {
		const v = await umgebung('Vertretung 6');
		await expect(
			bezeichneVertreter(handelnder(betreiber), {
				parteiId: v.parteien[0],
				personName: 'Anna Muster',
				ab: '2026-05-19',
				bis: '2026-01-01'
			})
		).rejects.toThrow(/nach dem Beginn/);
	});
});

/**
 * Die Weisung (Stories 7.3 und 7.4).
 *
 * Hier geht es um die Schranken, die nur die Schale durchsetzen kann: die
 * Sperre vor dem Eröffnen, die Ableitung aus einem echten Hausbeschluss, und
 * die Unveränderbarkeit einer einmal erfassten Weisung (AD-5).
 */
describe('Die Weisung (Stories 7.3 und 7.4)', () => {
	/** Die MEG mit einer freigegebenen, laufenden Versammlung und einem Traktandum. */
	async function megMitVersammlung(name: string, gebunden = true) {
		const v = await umgebung(name);
		for (const p of v.parteien) {
			await bezeichneVertreter(handelnder(betreiber), {
				parteiId: p,
				personName: `Vertretung ${p.slice(0, 4)}`,
				ab: '2020-02-19',
				grundlage: 'Art. 7 Ziff. 3'
			});
		}

		const m = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: v.meg,
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: m.id,
			parentId: null,
			titel: 'Rampe beim Hintereingang',
			art: 'abstimmung',
			antragswortlaut: 'Es wird eine Rampe gebaut.',
			antragstellerart: 'gemeinschaft',
			betroffeneParteiIds: []
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), m.id, t.id, EINFACHES_MEHR);
		if (gebunden) await setzeWeisungsbindung(handelnder(betreiber), m.id, t.id, true);

		await gibVersammlungFrei(handelnder(betreiber), m.id);
		await eroeffneVersammlung(handelnder(betreiber), m.id);
		for (const p of v.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), m.id, p, 'von_hand');
		}
		return { ...v, versammlung: m.id, traktandum: t.id };
	}

	/*
	 * **Eine Weisung gehört zu einem Traktandum DIESER Versammlung** (07.09.2026).
	 *
	 * Die Weisungsseite bekommt die Versammlung aus der Adresse und das
	 * Traktandum aus dem Formular; keine der vier Handlungen verglich die
	 * beiden. Die Zeilensicherheit trennt hier nichts — beide Versammlungen
	 * gehören demselben Betreiber, und die Grenze zwischen ihnen ist
	 * Anwendungscode. Dieselbe Bauart wie bei den Vollmachten (`69f107c`) und
	 * den Traktanden (`ec57517`); der Prüfbericht
	 * `docs/audit/2026-09-07-traktandumsbindung.md` hat sie hier offen gelassen.
	 *
	 * **Jede Probe holt sich ihr eigenes Gegenstück.** Eine geteilte
	 * Versammlung machte die Behauptungen voneinander abhängig, und unter der
	 * Mutantenprobe bekämen die späteren ihr «nicht gefunden» geschenkt
	 * (`fb_geteiltes_pruefobjekt_verschenkt_das_gruen`).
	 */
	it('weist eine Weisung zu einem Traktandum einer anderen Versammlung ab', async () => {
		const hier = await megMitVersammlung('Bindung 1');
		const dort = await megMitVersammlung('Bindung 2');
		await expect(
			halteWeisungFest(handelnder(betreiber), hier.versammlung, {
				traktandumId: dort.traktandum,
				parteiId: hier.parteien[0],
				haltung: 'ja',
				herkunft: 'erklaerung',
				bemerkung: 'Zirkularbeschluss vom 3. Mai'
			})
		).rejects.toThrow(/Dieses Traktandum gehört nicht/);
	});

	it('weist die Weisungsbindung an einem fremden Traktandum ab', async () => {
		const hier = await megMitVersammlung('Bindung 3');
		const dort = await megMitVersammlung('Bindung 4');
		await expect(
			setzeWeisungsbindung(handelnder(betreiber), hier.versammlung, dort.traktandum, true)
		).rejects.toThrow(/Dieses Traktandum gehört nicht/);
	});

	it('kennt den Weisungsstand eines fremden Traktandums nicht', async () => {
		const hier = await megMitVersammlung('Bindung 5');
		const dort = await megMitVersammlung('Bindung 6');
		expect(await holeWeisungsstand(betreiber, hier.versammlung, dort.traktandum)).toBeNull();
		// Die Gegenprobe: Mit dem richtigen Rahmen steht der Stand da.
		expect(await holeWeisungsstand(betreiber, dort.versammlung, dort.traktandum)).not.toBeNull();
	});

	it('trägt nach Reglement nichts an einem fremden Traktandum ein', async () => {
		const hier = await megMitVersammlung('Bindung 7');
		const dort = await megMitVersammlung('Bindung 8');
		await expect(
			trageOhneBeschlussEin(handelnder(betreiber), hier.versammlung, dort.traktandum)
			// Seit dem 08.09.2026 derselbe Satz wie an den zwölf Geschwistern;
			// die Begründung steht in `tests/db/traktanden.test.ts`.
		).rejects.toThrow(/Dieses Traktandum gehört nicht/);
	});

	/*
	 * **Und die Partei gehört ebenfalls geprüft.** Sie kam aus demselben
	 * Formular wie das Traktandum. Eine Weisung eines fremden Hauses zu einem
	 * eigenen Traktandum wäre eine Zeile, die niemand erteilt hat — und sie
	 * zählte bei der Abstimmung mit.
	 */
	it('weist eine Weisung eines Hauses aus einer fremden Gemeinschaft ab', async () => {
		const hier = await megMitVersammlung('Bindung 9');
		const dort = await megMitVersammlung('Bindung 10');
		await expect(
			halteWeisungFest(handelnder(betreiber), hier.versammlung, {
				traktandumId: hier.traktandum,
				parteiId: dort.parteien[0],
				haltung: 'ja',
				herkunft: 'erklaerung',
				bemerkung: 'Zirkularbeschluss vom 3. Mai'
			})
		).rejects.toThrow(/gehört nicht zur Gemeinschaft dieser Versammlung/);
	});

	/*
	 * **Und der Beleg gehört zum Haus** (Code-Review 07.09.2026). Die
	 * Auswahlliste stellt nur Versammlungen des eigenen Hauses zur Wahl;
	 * serverseitig geprüft wurde nur, dass der Durchgang zur genannten
	 * Quellversammlung gehört. Damit liess sich die Weisung von Haus A auf einen
	 * Beschluss von Haus B stützen — und sie stimmt danach für A mit.
	 */
	it('weist einen Beschluss aus der Versammlung eines anderen Hauses als Quelle ab', async () => {
		/*
		 * **Der Beschluss von Haus B, die Weisung für Haus A.** Beide Häuser
		 * gehören derselben MEG, beide Kennungen kommen aus demselben Formular —
		 * ohne die Bindung geht das durch, und Haus A stimmt danach nach einem
		 * Beschluss mit, den es nie gefasst hat.
		 */
		const a = await megMitVersammlung('Bindung 12');
		const hausB = a.haeuser[1];
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: hausB.id,
			kind: 'unit',
			label: 'Whg 1',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: hausB.id,
			kind: 'natural',
			displayName: 'Beat Bucher',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-02-19');

		const hv = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: hausB.id,
			datum: '2026-05-05',
			uhrzeit: '19:00',
			ort: 'Waschküche B',
			art: 'ausserordentlich',
			anlass: 'Weisung an den Vertreter',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		const ht = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: hv.id,
			parentId: null,
			titel: 'Rampe beim Hintereingang — Weisung an den Vertreter',
			art: 'abstimmung',
			antragswortlaut: 'Der Vertreter wird angewiesen, Ja zu stimmen.',
			antragstellerart: 'gemeinschaft',
			betroffeneParteiIds: []
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), hv.id, ht.id, EINFACHES_MEHR);
		await gibVersammlungFrei(handelnder(betreiber), hv.id);
		await eroeffneVersammlung(handelnder(betreiber), hv.id);
		await bestaetigeAnwesenheit(handelnder(betreiber), hv.id, p.id, 'von_hand');
		await oeffneAbstimmung(handelnder(betreiber), hv.id, ht.id);
		await gibStimmenAb(handelnder(betreiber), hv.id, [{ parteiId: p.id, wahl: 'yes' }], false);
		const d = await schliesseAbstimmung(handelnder(betreiber), hv.id);

		// Die Partei von Haus A — der Beschluss stammt aus Haus B.
		const parteiA = a.parteien[0];
		await expect(
			leiteWeisungAusBeschlussAb(handelnder(betreiber), a.versammlung, {
				traktandumId: a.traktandum,
				parteiId: parteiA,
				quelleVersammlungId: hv.id,
				quelleDurchgangId: d.id
			})
		).rejects.toThrow(/nicht aus einer Versammlung dieses Hauses/);

		// Gegenprobe: Für die Partei von Haus B geht derselbe Beschluss durch.
		const parteiB = a.parteien[1];
		const w = await leiteWeisungAusBeschlussAb(handelnder(betreiber), a.versammlung, {
			traktandumId: a.traktandum,
			parteiId: parteiB,
			quelleVersammlungId: hv.id,
			quelleDurchgangId: d.id
		});
		expect(w.haltung).toBe('ja');
	});

	it('nimmt die richtige Paarung an', async () => {
		// Ohne diese Probe belegten die fünf oben auch eine Schranke, die alles
		// abwiese. Sie muss aus einem anderen Grund scheitern oder durchgehen.
		const hier = await megMitVersammlung('Bindung 11');
		const w = await halteWeisungFest(handelnder(betreiber), hier.versammlung, {
			traktandumId: hier.traktandum,
			parteiId: hier.parteien[0],
			haltung: 'ja',
			herkunft: 'erklaerung',
			bemerkung: 'Zirkularbeschluss vom 3. Mai'
		});
		expect(w.haltung).toBe('ja');
	});

	it('lässt ein weisungsgebundenes Traktandum ohne Weisungen nicht eröffnen', async () => {
		const a = await megMitVersammlung('Weisung 1');
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum)
		).rejects.toThrow(/weisungsgebunden|fehlt die Weisung/);
	});

	it('nennt die fehlenden Häuser beim Namen', async () => {
		// «Es fehlen Weisungen» hilft im Saal nicht weiter, wenn fünf Häuser
		// beteiligt sind und man wissen muss, wen man anrufen soll.
		const a = await megMitVersammlung('Weisung 2');
		for (const p of a.parteien.slice(0, 3)) {
			await halteWeisungFest(handelnder(betreiber), a.versammlung, {
				traktandumId: a.traktandum,
				parteiId: p,
				haltung: 'ja',
				herkunft: 'erklaerung',
				bemerkung: 'Zirkularbeschluss vom 3. Mai'
			});
		}
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum)
		).rejects.toThrow(/Nirgendweg 11\/11a/);
	});

	it('öffnet, sobald alle fünf Weisungen vorliegen', async () => {
		const a = await megMitVersammlung('Weisung 3');
		for (const p of a.parteien) {
			await halteWeisungFest(handelnder(betreiber), a.versammlung, {
				traktandumId: a.traktandum,
				parteiId: p,
				haltung: 'ja',
				herkunft: 'erklaerung',
				bemerkung: 'Beschluss der Hausversammlung'
			});
		}
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(d.zustand).toBe('offen');
	});

	it('lässt ein nicht gebundenes Traktandum ohne Weisungen zu', async () => {
		// Die Sperre darf nur greifen, wo sie hingehört.
		const a = await megMitVersammlung('Weisung 4', false);
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(d.zustand).toBe('offen');
	});

	it('berichtigt eine Weisung durch eine neue Zeile und behält die alte', async () => {
		// AD-5: Die alte verschwindet nicht, sie wird als überholt gekennzeichnet.
		const a = await megMitVersammlung('Weisung 5');
		await halteWeisungFest(handelnder(betreiber), a.versammlung, {
			traktandumId: a.traktandum,
			parteiId: a.parteien[0],
			haltung: 'ja',
			herkunft: 'erklaerung',
			bemerkung: 'Erste Auskunft'
		});
		await halteWeisungFest(handelnder(betreiber), a.versammlung, {
			traktandumId: a.traktandum,
			parteiId: a.parteien[0],
			haltung: 'nein',
			herkunft: 'erklaerung',
			bemerkung: 'Berichtigt nach Rückfrage'
		});

		const geltende = await holeWeisungen(betreiber, a.traktandum);
		const alle = await holeWeisungsverlauf(betreiber, a.traktandum);
		expect(geltende).toHaveLength(1);
		expect(geltende[0].haltung).toBe('nein');
		expect(alle).toHaveLength(2);
	});

	it('weist eine Weisung ohne Richtung ab, die nicht «frei» ist', async () => {
		const a = await megMitVersammlung('Weisung 6');
		await expect(
			halteWeisungFest(handelnder(betreiber), a.versammlung, {
				traktandumId: a.traktandum,
				parteiId: a.parteien[0],
				haltung: 'frei',
				herkunft: 'erklaerung',
				bemerkung: 'Irgendwas'
			})
		).rejects.toThrow(/freiem Ermessen|Richtung/);
	});

	it('verlangt bei einer Erklärung eine Bemerkung', async () => {
		// Ohne sie liesse sich nicht sagen, was erklärt wurde und von wem.
		const a = await megMitVersammlung('Weisung 7');
		await expect(
			halteWeisungFest(handelnder(betreiber), a.versammlung, {
				traktandumId: a.traktandum,
				parteiId: a.parteien[0],
				haltung: 'ja',
				herkunft: 'erklaerung'
			})
		).rejects.toThrow(/erklärt wurde/);
	});

	it('lässt die freie Weisung zu und kennzeichnet sie', async () => {
		const a = await megMitVersammlung('Weisung 8');
		const w = await halteWeisungFest(handelnder(betreiber), a.versammlung, {
			traktandumId: a.traktandum,
			parteiId: a.parteien[0],
			haltung: 'frei',
			herkunft: 'frei'
		});
		expect(w.haltung).toBe('frei');
		expect(w.herkunft).toBe('frei');
	});

	it('nimmt nach dem Eröffnen keine Weisung mehr entgegen', async () => {
		// Danach entstünde der Eindruck, das Haus habe nachträglich angewiesen,
		// was der Vertreter längst abgegeben hat.
		const a = await megMitVersammlung('Weisung 9', false);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await expect(
			halteWeisungFest(handelnder(betreiber), a.versammlung, {
				traktandumId: a.traktandum,
				parteiId: a.parteien[0],
				haltung: 'ja',
				herkunft: 'erklaerung',
				bemerkung: 'Zu spät'
			})
		).rejects.toThrow(/bereits abgestimmt|nachträglich/);
	});

	it('nimmt keine Weisung von einer Einzelperson entgegen', async () => {
		const a = await megMitVersammlung('Weisung 10', false);
		const person = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: a.meg,
			kind: 'natural',
			displayName: 'Anna Muster',
			isCommunity: false,
			representativeName: null
		});
		await expect(
			halteWeisungFest(handelnder(betreiber), a.versammlung, {
				traktandumId: a.traktandum,
				parteiId: person.id,
				haltung: 'ja',
				herkunft: 'erklaerung',
				bemerkung: 'Geht nicht'
			})
		).rejects.toThrow(/Mitgliedsgemeinschaft/);
	});

	it('leitet die Weisung aus einem echten Hausbeschluss ab', async () => {
		// Der Kern von 7.4: Die Anwendung liest das Ergebnis und rechnet es nicht
		// nach. Hier steht das Haus mit einer eigenen, abgeschlossenen Abstimmung
		// dahinter.
		const a = await megMitVersammlung('Weisung 11');
		const haus = a.haeuser[0];

		// Im Haus: eine Einheit, ein Eigentümer, eine Versammlung, ein Ja.
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: haus.id,
			kind: 'unit',
			label: 'Whg 1',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: haus.id,
			kind: 'natural',
			displayName: 'Anna Muster',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-02-19');

		const hv = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: haus.id,
			datum: '2026-05-03',
			uhrzeit: '19:00',
			ort: 'Waschküche',
			art: 'ausserordentlich',
			anlass: 'Weisung an den Vertreter',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		const ht = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: hv.id,
			parentId: null,
			titel: 'Rampe beim Hintereingang — Weisung an den Vertreter',
			art: 'abstimmung',
			antragswortlaut: 'Der Vertreter wird angewiesen, Ja zu stimmen.',
			antragstellerart: 'gemeinschaft',
			betroffeneParteiIds: []
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), hv.id, ht.id, EINFACHES_MEHR);
		await gibVersammlungFrei(handelnder(betreiber), hv.id);
		await eroeffneVersammlung(handelnder(betreiber), hv.id);
		await bestaetigeAnwesenheit(handelnder(betreiber), hv.id, p.id, 'von_hand');
		await oeffneAbstimmung(handelnder(betreiber), hv.id, ht.id);
		await gibStimmenAb(handelnder(betreiber), hv.id, [{ parteiId: p.id, wahl: 'yes' }], false);
		const d = await schliesseAbstimmung(handelnder(betreiber), hv.id);

		const w = await leiteWeisungAusBeschlussAb(handelnder(betreiber), a.versammlung, {
			traktandumId: a.traktandum,
			parteiId: a.parteien.find((_, i) => a.haeuser[i].id === haus.id)!,
			quelleVersammlungId: hv.id,
			quelleDurchgangId: d.id
		});

		expect(w.haltung).toBe('ja');
		expect(w.herkunft).toBe('beschluss');
		expect(w.quelleDurchgangId).toBe(d.id);
	});

	/*
	 * **Der Grund muss an den richtigen Ort zeigen** (08.09.2026, im Browserlauf
	 * über den Verbund gefunden).
	 *
	 * Die Sammelableitung meldete «übernommen: nichts» und nannte jedes Haus mit
	 * «kein geschlossener Beschluss zu diesem Geschäft» — auch dann, wenn der
	 * Punkt zu gar keinem Geschäft gehört und es deshalb nichts zu verbinden
	 * gibt. Wer das las, suchte den Fehler bei der Abstimmung im Haus und fand
	 * dort alles in Ordnung.
	 *
	 * Gemessen wird deshalb nicht «es wirft», sondern **wovon es spricht**: von
	 * der fehlenden Klammer, nicht vom fehlenden Beschluss.
	 */
	it('sagt beim Punkt ohne gemeinsames Geschäft, dass die Klammer fehlt', async () => {
		const a = await megMitVersammlung('Weisung 11a');
		await expect(
			leiteWeisungenAbSammel(handelnder(betreiber), a.versammlung, a.traktandum)
		).rejects.toThrow(/gehört zu keinem gemeinsamen Geschäft/);
		// **Und der Ausweg, den sie nennt, ist der beste vorhandene**: die Auswahl
		// je Haus, die kein gemeinsames Geschäft braucht — nicht «von Hand».
		await expect(
			leiteWeisungenAbSammel(handelnder(betreiber), a.versammlung, a.traktandum)
		).rejects.toThrow(/Aus einem Beschluss des Hauses/);
	});

	it('leitet aus einem noch offenen Durchgang keine Weisung ab', async () => {
		/*
		 * **Die Quelle ist eine Versammlung DES HAUSES** (07.09.2026). Bis dahin
		 * nahm diese Probe die MEG-Versammlung selbst als Quelle — ein Kürzel,
		 * das seit der Bindung der Quelle ans Haus nicht mehr trägt: Sie
		 * scheiterte dann an der Herkunft statt am offenen Durchgang, und der
		 * Schritt hätte etwas anderes belegt, als sein Name sagt.
		 */
		const a = await megMitVersammlung('Weisung 12', false);
		const haus = a.haeuser[0];
		// Ohne Einheit und Eigentümer lässt sich die Hausversammlung nicht
		// freigeben — die Quoten gingen nicht auf.
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: haus.id,
			kind: 'unit',
			label: 'Whg 1',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: haus.id,
			kind: 'natural',
			displayName: 'Anna Muster',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-02-19');

		const hv = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: haus.id,
			datum: '2026-05-04',
			uhrzeit: '19:00',
			ort: 'Waschküche',
			art: 'ausserordentlich',
			anlass: 'Weisung an den Vertreter',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		const ht = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: hv.id,
			parentId: null,
			titel: 'Rampe beim Hintereingang — Weisung an den Vertreter',
			art: 'abstimmung',
			antragswortlaut: 'Der Vertreter wird angewiesen, Ja zu stimmen.',
			antragstellerart: 'gemeinschaft',
			betroffeneParteiIds: []
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), hv.id, ht.id, EINFACHES_MEHR);
		await gibVersammlungFrei(handelnder(betreiber), hv.id);
		await eroeffneVersammlung(handelnder(betreiber), hv.id);
		await bestaetigeAnwesenheit(handelnder(betreiber), hv.id, p.id, 'von_hand');
		await oeffneAbstimmung(handelnder(betreiber), hv.id, ht.id);
		const offen = await holeOffenenDurchgang(betreiber, hv.id);

		await expect(
			leiteWeisungAusBeschlussAb(handelnder(betreiber), a.versammlung, {
				traktandumId: a.traktandum,
				parteiId: a.parteien[0],
				quelleVersammlungId: hv.id,
				quelleDurchgangId: offen!.id
			})
		).rejects.toThrow(/läuft noch|kein Ergebnis/);
	});

	it('zeigt den Weisungsstand mit Namen und Vertretern', async () => {
		const a = await megMitVersammlung('Weisung 13');
		await halteWeisungFest(handelnder(betreiber), a.versammlung, {
			traktandumId: a.traktandum,
			parteiId: a.parteien[0],
			haltung: 'nein',
			herkunft: 'erklaerung',
			bemerkung: 'Beschluss vom 3. Mai'
		});
		const stand = await holeWeisungsstand(betreiber, a.versammlung, a.traktandum);
		expect(stand?.weisungsgebunden).toBe(true);
		expect(stand?.erwartet).toBe(5);
		expect(stand?.vorliegend).toBe(1);
		expect(stand?.fehlend).toHaveLength(4);
		expect(stand?.stand[0].vertreter).toMatch(/Vertretung/);
	});
});

/**
 * Der Versammlungstag und die Tafel (Stories 7.5 und 7.7).
 *
 * Der Prüfstein: Die Klammer darf die Versammlungen **nicht** verschmelzen.
 * Jede behält ihre Beschlussfähigkeit, und die Tafel rechnet je Gemeinschaft
 * mit ihrer Schwelle — Haus 4 kann beschlussfähig sein und die Einstellhalle
 * nicht.
 */
describe('Der Versammlungstag (Stories 7.5 und 7.7)', () => {
	/** Zwei Gemeinschaften mit je einer Versammlung am selben Abend. */
	async function abend(name: string) {
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: `${name} — Nirgendwerk`,
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben'
		});

		const gemeinschaften: { id: string; versammlung: string; parteien: string[] }[] = [];
		for (const [i, bezeichnung] of ['Haus A', 'Haus B'].entries()) {
			const g = await erstelleGemeinschaft(handelnder(betreiber), {
				name: `${name} — ${bezeichnung}`,
				quotaDenominator: 1000,
				headCountMode: 'per_owner',
				parkingCountsAsHead: false,
				parentStwegId: null
			});
			const parteien: string[] = [];
			for (const [n, quote] of [600, 400].entries()) {
				const e = await erstelleEinheit(handelnder(betreiber), {
					stwegId: g.id,
					kind: 'unit',
					label: `Whg ${n + 1}`,
					quotas: { stamm: quote },
					countsAsHead: true
				});
				const p = await erstelleEigentuemer(handelnder(betreiber), {
					stwegId: g.id,
					kind: 'natural',
					displayName: `Person ${bezeichnung}${n}`,
					isCommunity: false,
					representativeName: null
				});
				await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
				parteien.push(p.id);
			}

			const m = await erstelleVersammlung(handelnder(betreiber), {
				stwegId: g.id,
				datum: '2026-05-19',
				uhrzeit: '17:00',
				ort: 'Halle der Proben',
				art: 'ordentlich',
				stufe: 'erste',
				betriebsart: 'einfach'
			});
			await gibVersammlungFrei(handelnder(betreiber), m.id);
			await eroeffneVersammlung(handelnder(betreiber), m.id);
			await nimmInTagAuf(handelnder(betreiber), tag.id, m.id, i);
			gemeinschaften.push({ id: g.id, versammlung: m.id, parteien });
		}
		return { tag: tag.id, gemeinschaften };
	}

	it('hält mehrere Versammlungen zusammen, ohne sie zu verschmelzen', async () => {
		const a = await abend('Abend 1');
		const tafel = await holeTafel(betreiber, a.tag);
		expect(tafel).toHaveLength(2);
		// Zwei Zeilen, zwei Versammlungen, zwei getrennte Stände.
		expect(new Set(tafel.map((z) => z.meetingId)).size).toBe(2);
		expect(tafel[0].stelle).toBe(0);
		expect(tafel[1].stelle).toBe(1);
	});

	it('rechnet die Beschlussfähigkeit je Gemeinschaft getrennt', async () => {
		// Der eigentliche Punkt von 7.7: In der einen sind beide da, in der
		// anderen niemand. Eine gemeinsame Zahl gäbe es gar nicht.
		const a = await abend('Abend 2');
		for (const p of a.gemeinschaften[0].parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.gemeinschaften[0].versammlung, p, 'von_hand');
		}

		const tafel = await holeTafel(betreiber, a.tag);
		const erste = tafel.find((z) => z.meetingId === a.gemeinschaften[0].versammlung);
		const zweite = tafel.find((z) => z.meetingId === a.gemeinschaften[1].versammlung);

		expect(erste?.beschlussfaehig?.erfuellt).toBe(true);
		expect(erste?.beschlussfaehig?.kopfstimmenAnwesend).toBe(2);
		expect(erste?.beschlussfaehig?.einzigerEigentuemer).toBe(false);
		expect(zweite?.beschlussfaehig?.erfuellt).toBe(false);
		expect(zweite?.beschlussfaehig?.kopfstimmenAnwesend).toBe(0);
		// Und die Begründung steht daneben, nicht bloss ein Nein.
		expect(zweite?.beschlussfaehig?.fehlt.length).toBeGreaterThan(0);
	});

	it('lässt dieselbe Gemeinschaft nicht zweimal am selben Abend tagen', async () => {
		// Das wären zwei Beschlussfähigkeiten und zwei Protokolle für dieselbe Sache.
		const a = await abend('Abend 3');
		const zweite = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: a.gemeinschaften[0].id,
			datum: '2026-05-19',
			uhrzeit: '20:00',
			ort: 'Halle der Proben',
			art: 'ausserordentlich',
			anlass: 'Zweite am selben Abend',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		await expect(
			nimmInTagAuf(handelnder(betreiber), a.tag, zweite.id, 9)
		).rejects.toThrow(/bereits|dieselbe Sache/);
	});

	it('nimmt eine Versammlung wieder heraus, ohne sie anzutasten', async () => {
		const a = await abend('Abend 4');
		await nimmAusTag(handelnder(betreiber), a.gemeinschaften[1].versammlung);
		const tafel = await holeTafel(betreiber, a.tag);
		expect(tafel).toHaveLength(1);

		// Die Versammlung selbst gibt es weiter, unverändert.
		const v = await holeVersammlung(betreiber, a.gemeinschaften[1].versammlung);
		expect(v?.zustand).toBe('laufend');
	});

	it('weist einen Tag ohne Ort ab', async () => {
		await expect(
			erstelleVersammlungstag(handelnder(betreiber), {
				bezeichnung: 'Ohne Ort',
				datum: '2026-05-19',
				uhrzeit: '17:00',
				ort: ''
			})
		).rejects.toThrow(/Ort/);
	});

	it('hält den Tag im Verlauf fest', async () => {
		const a = await abend('Abend 5');
		const [eintrag] = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT detail FROM audit_entry
				WHERE event_type = 'meeting.day.created' AND subject_id = ${a.tag}
			`
		);
		expect(eintrag?.detail).toMatchObject({ ort: 'Halle der Proben' });
	});
});

/**
 * Die Person über den Gemeinschaften und der Einlass für den ganzen Abend
 * (Story 7.6).
 *
 * Der Prüfstein: Wer an zwei Versammlungen desselben Abends stimmberechtigt
 * ist, steht **einmal** am Eingang — und ist danach in beiden anwesend, mit je
 * einem eigenen Ereignis im Verlauf.
 */
describe('Person und Einlass (Story 7.6)', () => {
	/** Zwei Gemeinschaften am selben Abend, dieselbe Person in beiden. */
	async function abendMitPerson(name: string, eroeffnen = true) {
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: `${name} — Abend`,
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben'
		});
		const person = await erstellePerson(handelnder(betreiber), {
			name: 'Markus Probère',
			email: 'm@example.ch'
		});

		const teile: { versammlung: string; partei: string; gemeinschaft: string }[] = [];
		for (const [i, bezeichnung] of ['Haus 4', 'Einstellhalle'].entries()) {
			const g = await erstelleGemeinschaft(handelnder(betreiber), {
				name: `${name} — ${bezeichnung}`,
				quotaDenominator: 1000,
				headCountMode: 'per_unit',
				parkingCountsAsHead: false,
				parentStwegId: null
			});
			const e = await erstelleEinheit(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'unit',
				label: `Objekt ${i + 1}`,
				quotas: { stamm: 1000 },
				countsAsHead: true
			});
			const p = await erstelleEigentuemer(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'natural',
				displayName: 'Markus Probère',
				isCommunity: false,
				representativeName: null
			});
			await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
			await verknuepfePartei(handelnder(betreiber), p.id, person.id);

			const m = await erstelleVersammlung(handelnder(betreiber), {
				stwegId: g.id,
				datum: '2026-05-19',
				uhrzeit: '17:00',
				ort: 'Halle der Proben',
				art: 'ordentlich',
				stufe: 'erste',
				betriebsart: 'einfach'
			});
			await gibVersammlungFrei(handelnder(betreiber), m.id);
			// Nur, wenn der Prüfstein die laufende Versammlung braucht: Das Eröffnen
			// selbst wird weiter unten geprüft, und dafür müssen sie zu sein.
			if (eroeffnen) await eroeffneVersammlung(handelnder(betreiber), m.id);
			await nimmInTagAuf(handelnder(betreiber), tag.id, m.id, i);
			teile.push({ versammlung: m.id, partei: p.id, gemeinschaft: g.id });
		}
		return { tag: tag.id, person: person.id, teile };
	}

	it('meldet mit einem Einlass in beiden Versammlungen an', async () => {
		const a = await abendMitPerson('Einlass 1');
		const befund = await lasseEin(handelnder(betreiber), a.tag, a.person);

		expect(befund.person).toBe('Markus Probère');
		expect(befund.zeilen).toHaveLength(2);
		expect(befund.zeilen.every((z) => z.ergebnis === 'erfasst')).toBe(true);

		// Und beide Tafeln zeigen ihn anwesend.
		const tafel = await holeTafel(betreiber, a.tag);
		expect(tafel.every((z) => z.beschlussfaehig?.kopfstimmenAnwesend === 1)).toBe(true);
		// Ä-17 A: Jedes Haus hat einen einzigen Eigentümer; die Abendleitung
		// nennt den Vorbehalt daraus (Featureprüfung 3b bis 3e).
		expect(tafel).toHaveLength(2);
		expect(tafel.every((z) => z.beschlussfaehig?.einzigerEigentuemer === true)).toBe(true);
	});

	it('erzeugt je Versammlung ein eigenes Ereignis', async () => {
		// Eine gemeinsame Anwesenheit gäbe es rechtlich nicht; der Verlauf jeder
		// Gemeinschaft muss für sich lückenlos bleiben (AD-5).
		const a = await abendMitPerson('Einlass 2');
		await lasseEin(handelnder(betreiber), a.tag, a.person);

		for (const t of a.teile) {
			const ereignisse = await imKontext(
				betreiber,
				(tx) => tx`SELECT kind FROM attendance_event WHERE meeting_id = ${t.versammlung}`
			);
			expect(ereignisse).toHaveLength(1);
			expect(ereignisse[0].kind).toBe('eingetroffen');
		}
	});

	it('meldet einen zweiten Einlass als bereits anwesend', async () => {
		const a = await abendMitPerson('Einlass 3');
		await lasseEin(handelnder(betreiber), a.tag, a.person);
		const nochmal = await lasseEin(handelnder(betreiber), a.tag, a.person);
		expect(nochmal.zeilen.every((z) => z.ergebnis === 'schon_anwesend')).toBe(true);
	});

	/*
	 * **Eröffnen und Schliessen für den ganzen Abend** (Auftraggeber, 24.08.2026).
	 *
	 * Bis dahin gab es beides nur je Haus — wer einen Abend mit fünf
	 * Gemeinschaften führte, wechselte fünfmal die Sicht, bevor er den ersten
	 * Menschen einlassen konnte, und am Schluss noch einmal fünfmal.
	 */
	it('eröffnet alle Versammlungen des Abends auf einmal', async () => {
		const a = await abendMitPerson('Eröffnen 1', false);
		const befund = await eroeffneAmAbend(handelnder(betreiber), a.tag);

		expect(befund).toHaveLength(2);
		expect(befund.every((b) => b.ergebnis === 'getan')).toBe(true);
		const tafel = await holeTafel(betreiber, a.tag);
		expect(tafel.every((z) => z.zustand === 'laufend')).toBe(true);
	});

	it('eröffnet auf Verlangen nur ein Haus und lässt das andere zu', async () => {
		const a = await abendMitPerson('Eröffnen 2', false);
		await eroeffneAmAbend(handelnder(betreiber), a.tag, a.teile[0].versammlung);

		const tafel = await holeTafel(betreiber, a.tag);
		const eines = tafel.find((z) => z.meetingId === a.teile[0].versammlung);
		const anderes = tafel.find((z) => z.meetingId === a.teile[1].versammlung);
		expect(eines?.zustand).toBe('laufend');
		expect(anderes?.zustand).toBe('freigegeben');
	});

	it('benennt eine bereits laufende Versammlung, statt sie stillschweigend zu überspringen', async () => {
		// Stillschweigend zu überspringen hiesse, am Eingang den Eindruck zu
		// erzeugen, es sei alles erledigt.
		const a = await abendMitPerson('Eröffnen 3');
		const befund = await eroeffneAmAbend(handelnder(betreiber), a.tag);
		expect(befund.every((b) => b.ergebnis === 'schon')).toBe(true);
		expect(hausbefundssatz(befund, 'eröffnet')).toMatch(/war schon eröffnet/);
	});

	it('weist eine Versammlung ab, die nicht zu diesem Abend gehört', async () => {
		// Der Zeilenschutz hält fremde Betreiber ab; innerhalb des eigenen wäre
		// eine untergeschobene Kennung sonst ein Weg an der Absicht vorbei.
		const a = await abendMitPerson('Eröffnen 4', false);
		const b = await abendMitPerson('Eröffnen 5', false);
		await expect(
			eroeffneAmAbend(handelnder(betreiber), a.tag, b.teile[0].versammlung)
		).rejects.toThrow(/gehört nicht zu diesem Abend/);
	});

	/*
	 * **Ein Haus, das zwischendurch einzeln eröffnet wird** (Auftrag Abschluss,
	 * C2, aus der Codeprüfung zu F6). Der Abend liest die Zustände ohne Sperre;
	 * bis dahin brach die Absage von `eroeffneVersammlung` den Lauf mitten ab.
	 * Gesteuert: Eine dritte Verbindung eröffnet das Haus «einzeln» und hält
	 * die Zeile, bis der Abend dort wartet.
	 */
	it('benennt ein zwischendurch eröffnetes Haus und eröffnet die übrigen', async () => {
		const a = await abendMitPerson('Eröffnen 6', false);
		const [dazwischen, uebriges] = a.teile.map((t) => t.versammlung);
		const sperre = await halteSperre(async (tx) => {
			await tx`UPDATE meeting SET state = 'laufend', opened_at = now() WHERE id = ${dazwischen}`;
		});
		let fertig = false;
		const lauf = eroeffneAmAbend(handelnder(betreiber), a.tag);
		lauf.then(() => (fertig = true), () => (fertig = true));
		await warteAufWartende(1, () => fertig);
		await sperre.loesen();

		const befund = await lauf;
		expect(befund.find((b) => b.meetingId === dazwischen)?.ergebnis).toBe('schon');
		expect(befund.find((b) => b.meetingId === uebriges)?.ergebnis).toBe('getan');
		const tafel = await holeTafel(betreiber, a.tag);
		expect(tafel.every((z) => z.zustand === 'laufend')).toBe(true);
	});

	/*
	 * **Ein abgegebenes Haus bricht den Lauf nicht ab** (Codeprüfung C2). Die
	 * Sperre aus Migration 117 sagt beim Eröffnen mit `versammlung_abgegeben`
	 * ab, nicht mit `zustand_unpassend`; auch diese Absage gehört in den
	 * Befund, und das übrige Haus kommt dran.
	 */
	it('benennt ein abgegebenes Haus und eröffnet die übrigen', async () => {
		const a = await abendMitPerson('Eröffnen 7', false);
		const [abgegeben, uebriges] = a.teile.map((t) => t.versammlung);
		await erzeugeZugaenge(handelnder(betreiber), abgegeben);
		const paar = erzeugeGeraeteschluessel();
		const geraet = await registriereGeraet(handelnder(betreiber), 'Notebook Abend', alsGeraetecode(paar));
		await gibAb(handelnder(betreiber), abgegeben, { zustand: 'freigegeben' }, {
			geraetId: geraet.id,
			herkunft: null,
			jetzt: '2026-05-18 10:00:00'
		});

		const befund = await eroeffneAmAbend(handelnder(betreiber), a.tag);
		const zeile = befund.find((b) => b.meetingId === abgegeben);
		expect(zeile?.ergebnis).toBe('nicht_moeglich');
		expect(zeile?.grund).toMatch(/Gerät/);
		expect(befund.find((b) => b.meetingId === uebriges)?.ergebnis).toBe('getan');
	});

	it('schliesst alle Versammlungen des Abends auf einmal', async () => {
		const a = await abendMitPerson('Schliessen 1');
		const befund = await schliesseAmAbendGanz(handelnder(betreiber), a.tag);

		expect(befund.every((b) => b.ergebnis === 'getan')).toBe(true);
		const tafel = await holeTafel(betreiber, a.tag);
		expect(tafel.every((z) => z.zustand === 'geschlossen')).toBe(true);
	});

	it('sagt beim Schliessen, wo es nicht ging', async () => {
		const a = await abendMitPerson('Schliessen 2', false);
		const befund = await schliesseAmAbendGanz(handelnder(betreiber), a.tag);
		expect(befund.every((b) => b.ergebnis === 'nicht_moeglich')).toBe(true);
		expect(hausbefundssatz(befund, 'geschlossen')).toMatch(/nicht möglich/);
	});

	/*
	 * **Der Saal-QR des Abends und die Hausauswahl** (Auftraggeber, 24.08.2026, mit
	 * Bildschirmfoto: «Diese Wahl war nicht gültig»).
	 *
	 * Ein Leser ohne Schreiber: Die Weiterleitung liest `meeting.room_entry_token`,
	 * gefüllt wurde die Spalte aber nur auf der Anwesenheitsseite des einzelnen
	 * Hauses — dort, wo an einem gemeinsamen Abend niemand hingeht. Die Auswahl
	 * bot Häuser an, die sie nicht erreichen konnte.
	 */
	it('führt von der Hausauswahl des Abends in jedes Haus', async () => {
		const a = await abendMitPerson('Saaleinstieg 1');
		const abendmerkmal = await holeOderErzeugeAbendmerkmal(betreiber, a.tag);

		const befund = await loeseAbendeinstiegAuf(abendmerkmal);
		expect(befund.gueltig).toBe(true);
		expect(befund.haeuser).toHaveLength(2);

		// **Jedes** angebotene Haus muss erreichbar sein — nicht nur das erste.
		for (const h of befund.haeuser ?? []) {
			const hausmerkmal = await saalmerkmalDesHauses(abendmerkmal, h.meetingId);
			expect(hausmerkmal, `${h.name} ist nicht erreichbar`).toBeTruthy();

			// Und der Weg endet dort, wo er hinführen soll: beim Meldeweg genau
			// dieses Hauses.
			const saal = await loeseSaaleinstiegAuf(hausmerkmal!);
			expect(saal.gueltig).toBe(true);
			expect(saal.meetingId).toBe(h.meetingId);
		}
	});

	it('gibt das Merkmal eines fremden Hauses nicht heraus', async () => {
		// Sonst führte eine untergeschobene Kennung in eine Versammlung, die
		// heute Abend gar nicht mittagt.
		const a = await abendMitPerson('Saaleinstieg 2');
		const b = await abendMitPerson('Saaleinstieg 3');
		const merkmalA = await holeOderErzeugeAbendmerkmal(betreiber, a.tag);
		expect(await saalmerkmalDesHauses(merkmalA, b.teile[0].versammlung)).toBeNull();
	});

	it('holt ein spaeter aufgenommenes Haus nach', async () => {
		const a = await abendMitPerson('Saaleinstieg 4');
		const merkmal = await holeOderErzeugeAbendmerkmal(betreiber, a.tag);

		// Ein drittes Haus kommt dazu, nachdem der Code schon hing.
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Saaleinstieg 4 — Nachzügler',
			quotaDenominator: 1000,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const m = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		await nimmInTagAuf(handelnder(betreiber), a.tag, m.id, 9);

		// Vor dem nächsten Aufruf: noch nicht erreichbar. Danach schon — die
		// Seite ruft bei jedem Aufbau hier vorbei.
		expect(await saalmerkmalDesHauses(merkmal, m.id)).toBeNull();
		await holeOderErzeugeAbendmerkmal(betreiber, a.tag);
		expect(await saalmerkmalDesHauses(merkmal, m.id)).toBeTruthy();
	});

	it('weist eine Person ab, die an keiner Versammlung des Abends stimmberechtigt ist', async () => {
		const a = await abendMitPerson('Einlass 4');
		const fremd = await erstellePerson(handelnder(betreiber), { name: 'Fremde Person' });
		await expect(lasseEin(handelnder(betreiber), a.tag, fremd.id)).rejects.toThrow(
			/nicht stimmberechtigt|keiner Versammlung/
		);
	});

	it('verknüpft keine Gemeinschaft und kein gemeinschaftliches Eigentum', async () => {
		// Hinter beiden steht nicht eine Person; eine Klammer gäbe einem die
		// Stimme aller anderen.
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Personweg 1',
			quotaDenominator: 1000,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const erben = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Erbengemeinschaft Meier',
			isCommunity: true,
			representativeName: 'Anna Meier'
		});
		const person = await erstellePerson(handelnder(betreiber), { name: 'Anna Meier' });
		await expect(
			verknuepfePartei(handelnder(betreiber), erben.id, person.id)
		).rejects.toThrow(/einzelne Person|Stimme aller/);
	});

	it('lässt dieselbe Person in einer Gemeinschaft nicht zweimal Partei sein', async () => {
		// Sie hätte dann zwei Kopfstimmen, wo ihr eine zusteht.
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Personweg 2',
			quotaDenominator: 1000,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const person = await erstellePerson(handelnder(betreiber), { name: 'Peter Kunz' });
		const a = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Peter Kunz',
			isCommunity: false,
			representativeName: null
		});
		const b = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'P. Kunz',
			isCommunity: false,
			representativeName: null
		});
		await verknuepfePartei(handelnder(betreiber), a.id, person.id);
		await expect(verknuepfePartei(handelnder(betreiber), b.id, person.id)).rejects.toThrow(
			/bereits|zwei Kopfstimmen/
		);
	});

	it('führt auf, was die Person in welcher Gemeinschaft hält', async () => {
		const a = await abendMitPerson('Einlass 5');
		const personen = await holePersonen(betreiber, 'aktiv');
		const meine = personen.find((p) => p.id === a.person);
		expect(meine?.parteien).toHaveLength(2);
		expect(meine?.parteien.map((p) => p.gemeinschaft).some((n) => n.includes('Einstellhalle'))).toBe(
			true
		);
	});
});

/**
 * Das Geschäft: ein Antrag, mehrere Gemeinschaften (Story 7.5a).
 *
 * Der Prüfstein: Die Klammer spart das Tippen, **nicht** die Beschlüsse. Aus
 * einem Geschäft entstehen so viele Traktanden wie beteiligte Gemeinschaften,
 * und jedes ist ein eigener Beschluss.
 */
describe('Das Geschäft (Story 7.5a)', () => {
	async function tagMitDrei(name: string) {
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: `${name} — Abend`,
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben'
		});
		const versammlungen: { id: string; gemeinschaft: string }[] = [];
		for (const [i, bezeichnung] of ['Haus 4', 'Haus 6', 'MEG Umgebung'].entries()) {
			const g = await erstelleGemeinschaft(handelnder(betreiber), {
				name: `${name} — ${bezeichnung}`,
				quotaDenominator: 1000,
				headCountMode: 'per_unit',
				parkingCountsAsHead: false,
				parentStwegId: null
			});
			// Eine Einheit mit Eigentümer, sonst liesse sich nicht freigeben.
			const e = await erstelleEinheit(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'unit',
				label: 'Objekt 1',
				quotas: { stamm: 1000 },
				countsAsHead: true
			});
			const partei = await erstelleEigentuemer(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'natural',
				displayName: `Eigentümer ${bezeichnung}`,
				isCommunity: false,
				representativeName: null
			});
			await ordneEigentumZu(handelnder(betreiber), e.id, partei.id, '2020-01-01');

			const m = await erstelleVersammlung(handelnder(betreiber), {
				stwegId: g.id,
				datum: '2026-05-19',
				uhrzeit: '17:00',
				ort: 'Halle der Proben',
				art: 'ordentlich',
				stufe: 'erste',
				betriebsart: 'einfach'
			});
			await nimmInTagAuf(handelnder(betreiber), tag.id, m.id, i);
			versammlungen.push({ id: m.id, gemeinschaft: bezeichnung });
		}
		return { tag: tag.id, versammlungen };
	}

	it('erzeugt je beteiligter Gemeinschaft ein eigenes Traktandum', async () => {
		const a = await tagMitDrei('Geschäft 1');
		const g = await erstelleGeschaeft(handelnder(betreiber), a.tag, {
			titel: 'Betriebskostenabrechnung 2025',
			antragswortlaut: 'Die Betriebskostenabrechnungen 2025 seien zu genehmigen.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});

		expect(g.traktanden).toHaveLength(3);
		// Und in jeder Versammlung steht es wirklich auf der Liste.
		for (const v of a.versammlungen) {
			const traktanden = await holeTraktanden(betreiber, v.id);
			expect(traktanden.some((t) => t.knoten.titel === 'Betriebskostenabrechnung 2025')).toBe(true);
		}
	});

	it('lässt Gemeinschaften weg, die nicht beteiligt sind', async () => {
		// Ein Punkt zum Allgemeinstrom läuft in den Häusern, nicht in den
		// Miteigentümerschaften — die haben keinen.
		const a = await tagMitDrei('Geschäft 2');
		const nurHaeuser = a.versammlungen.filter((v) => v.gemeinschaft.startsWith('Haus'));
		const g = await erstelleGeschaeft(handelnder(betreiber), a.tag, {
			titel: 'Allgemeinstrom',
			antragswortlaut: 'Der Allgemeinstromverbrauch sei zu überprüfen.',
			meetingIds: nurHaeuser.map((v) => v.id)
		});

		expect(g.traktanden).toHaveLength(2);
		const meg = a.versammlungen.find((v) => v.gemeinschaft === 'MEG Umgebung')!;
		const traktanden = await holeTraktanden(betreiber, meg.id);
		expect(traktanden.some((t) => t.knoten.titel.includes('Allgemeinstrom'))).toBe(false);
	});

	it('weist ein Geschäft ohne Gemeinschaft ab', async () => {
		const a = await tagMitDrei('Geschäft 3');
		await expect(
			erstelleGeschaeft(handelnder(betreiber), a.tag, {
				titel: 'Ins Leere',
				antragswortlaut: 'Es sei nichts zu beschliessen.',
				meetingIds: []
			})
		).rejects.toThrow(/mindestens eine|nichts zu beschliessen/);
	});

	it('weist eine bereits eröffnete Versammlung ab und nennt sie', async () => {
		// Nachträglich ergänzen ist ein Spontantraktandum; ob es beschlossen
		// werden darf, entscheiden das Reglement oder die Universalversammlung
		// (Story 5.11) — stillschweigend einzufügen wäre ein anfechtbarer
		// Beschluss.
		const a = await tagMitDrei('Geschäft 4');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlungen[0].id);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlungen[0].id);

		await expect(
			erstelleGeschaeft(handelnder(betreiber), a.tag, {
				titel: 'Zu spät',
				antragswortlaut: 'Dies käme zu spät.',
				meetingIds: a.versammlungen.map((v) => v.id)
			})
		).rejects.toThrow(/bereits eröffnet|Genehmigungsbeschluss/);
	});

	it('führt die Beschlüsse getrennt — die Klammer entscheidet nichts', async () => {
		// Der eigentliche Punkt: Aus einem Geschäft werden mehrere Beschlüsse, und
		// jeder hat seine eigene Bezugsgrösse.
		const a = await tagMitDrei('Geschäft 5');
		const g = await erstelleGeschaeft(handelnder(betreiber), a.tag, {
			titel: 'Budget 2026',
			antragswortlaut: 'Die Budgets 2026 seien zu genehmigen.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});
		const kennungen = new Set(g.traktanden.map((t) => t.traktandumId));
		expect(kennungen.size).toBe(3);
		expect(new Set(g.traktanden.map((t) => t.meetingId)).size).toBe(3);
	});

	/*
	 * **Abgestimmt wird je Haus** (Produktentscheid 25.09.2026: kein
	 * Abstimmungsschritt über mehrere Häuser).
	 * Ohne Traktandum eröffnete `oeffneAmAbend` bis dahin in allen Häusern des
	 * Punktes und legte ein abweisendes Haus nur unter «offen» ab.
	 */
	it('eröffnet einen Punkt über mehrere Häuser nicht ohne Traktandum', async () => {
		const a = await tagMitDrei('Geschäft 6');
		const g = await erstelleGeschaeft(handelnder(betreiber), a.tag, {
			titel: 'Feststellung der Beschlussfähigkeit und Wahl des Protokollführers',
			antragswortlaut: 'Zum Protokollführer wird die Verwaltung gewählt.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});
		await expect(oeffneAmAbend(handelnder(betreiber), a.tag, g.id, null)).rejects.toThrow(
			/Abgestimmt wird je Gemeinschaft/
		);
	});

	it('eröffnet ohne Traktandum weiter, wenn der Punkt in einem Haus steht', async () => {
		// Die Gegenprobe zur Sperre: Ein Punkt mit einem einzigen Haus trägt im
		// Dreischritt keine Wahl zwischen Häusern und kommt im Haus an. Dort weist
		// es ab, weil die Versammlung nicht läuft; die Absage aus dem Haus ist der
		// Nachweis, dass die Sperre nicht griff.
		const a = await tagMitDrei('Geschäft 8');
		const g = await erstelleGeschaeft(handelnder(betreiber), a.tag, {
			titel: 'Ersatz der Briefkastenanlage',
			antragswortlaut: 'Die Briefkastenanlage sei zu ersetzen.',
			meetingIds: [a.versammlungen[0].id]
		});
		const e = await oeffneAmAbend(handelnder(betreiber), a.tag, g.id, null);
		expect(e.gelungen).toBe(0);
		expect(e.offen).toHaveLength(1);
		expect(e.offen[0].grund).toMatch(/Versammlung/);
	});

	it('erreicht mit Traktandum weiter das eine Haus', async () => {
		// Die Gegenprobe: Die Sperre trifft nur den Weg über mehrere Häuser. Mit
		// Traktandum kommt der Aufruf im Haus an; dort weist es ab, weil die
		// Versammlung nicht läuft, und genau diese Absage ist der Nachweis.
		const a = await tagMitDrei('Geschäft 7');
		const g = await erstelleGeschaeft(handelnder(betreiber), a.tag, {
			titel: 'Feststellung der Beschlussfähigkeit und Wahl des Protokollführers',
			antragswortlaut: 'Zum Protokollführer wird die Verwaltung gewählt.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});
		const e = await oeffneAmAbend(
			handelnder(betreiber),
			a.tag,
			g.id,
			g.traktanden[0].traktandumId
		);
		expect(e.gelungen).toBe(0);
		expect(e.offen).toHaveLength(1);
		expect(e.offen[0].grund).toMatch(/Versammlung/);
	});
});

describe('Antragswortlaut beim Geschäft', () => {
	it('verlangt bei einer Abstimmung den Wortlaut', async () => {
		// Er wird im Saal vorgelesen und steht später im Protokoll. Die Datenbank
		// weist es ohnehin ab; die Meldung sagt, was zu tun ist.
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: 'Wortlaut — Abend',
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Saal'
		});
		await expect(
			erstelleGeschaeft(handelnder(betreiber), tag.id, {
				titel: 'Ohne Wortlaut',
				meetingIds: ['00000000-0000-0000-0000-000000000000']
			})
		).rejects.toThrow(/Antragswortlaut/);
	});
});

/**
 * Der Eigentümer wird einmal geführt (Vorschlag des Auftraggebers vom 31.07.2026).
 *
 * Die Zuordnung geht von der Person aus; die Zeile in der jeweiligen
 * Gemeinschaft entsteht dabei von selbst. Sie bleibt nötig, weil sie die
 * Stimmkraft **dort** trägt — der Prüfstein ist, dass sie richtig entsteht und
 * nicht zweimal.
 */
describe('Einheiten von der Person aus zuordnen', () => {
	async function zweiGemeinschaften(name: string) {
		const g: { id: string; einheit: string }[] = [];
		for (const [i, bezeichnung] of ['Haus 4', 'Einstellhalle'].entries()) {
			const gemeinschaft = await erstelleGemeinschaft(handelnder(betreiber), {
				name: `${name} — ${bezeichnung}`,
				quotaDenominator: 1000,
				headCountMode: i === 0 ? 'per_owner' : 'per_unit',
				parkingCountsAsHead: false,
				parentStwegId: null
			});
			const e = await erstelleEinheit(handelnder(betreiber), {
				stwegId: gemeinschaft.id,
				kind: i === 0 ? 'unit' : 'parking',
				label: i === 0 ? '9.9.1' : 'PP 99',
				quotas: { stamm: 1000 },
				countsAsHead: true
			});
			g.push({ id: gemeinschaft.id, einheit: e.id });
		}
		return g;
	}

	it('legt die Zeile in der Gemeinschaft von selbst an', async () => {
		const g = await zweiGemeinschaften('Einmal 1');
		const person = await erstellePerson(handelnder(betreiber), { name: 'Markus Probère' });

		const erste = await ordneEinheitZuPerson(
			handelnder(betreiber),
			person.id,
			g[0].einheit,
			'2020-01-01'
		);
		expect(erste.neuAngelegt).toBe(true);

		const k = await stimmkraftAnsicht(betreiber, g[0].id, '2026-05-19');
		expect(k.zeilen).toHaveLength(1);
		expect(k.zeilen[0].displayName).toBe('Markus Probère');
		expect(k.summeKopfstimmen).toBe(1);
	});

	it('führt denselben Eigentümer in zwei Gemeinschaften ohne zweite Erfassung', async () => {
		const g = await zweiGemeinschaften('Einmal 2');
		const person = await erstellePerson(handelnder(betreiber), { name: 'Markus Probère' });

		await ordneEinheitZuPerson(handelnder(betreiber), person.id, g[0].einheit, '2020-01-01');
		await ordneEinheitZuPerson(handelnder(betreiber), person.id, g[1].einheit, '2020-01-01');

		const [stand] = (await holePersonen(betreiber, 'aktiv')).filter((p) => p.id === person.id);
		expect(stand.parteien).toHaveLength(2);

		const einheiten = await einheitenDerPerson(betreiber, person.id, '2026-05-19');
		expect(einheiten.map((e) => e.label).sort()).toEqual(['9.9.1', 'PP 99']);
	});

	it('legt in derselben Gemeinschaft keine zweite Zeile an', async () => {
		// Zwei Zeilen wären zwei Kopfstimmen, wo ihr eine zusteht.
		const g = await zweiGemeinschaften('Einmal 3');
		const zweite = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g[0].id,
			kind: 'unit',
			label: '4.2.3',
			quotas: { stamm: 0 },
			countsAsHead: true
		});
		const person = await erstellePerson(handelnder(betreiber), { name: 'Markus Probère' });

		const erste = await ordneEinheitZuPerson(
			handelnder(betreiber),
			person.id,
			g[0].einheit,
			'2020-01-01'
		);
		const nochmal = await ordneEinheitZuPerson(
			handelnder(betreiber),
			person.id,
			zweite.id,
			'2020-01-01'
		);
		expect(nochmal.neuAngelegt).toBe(false);
		expect(nochmal.parteiId).toBe(erste.parteiId);

		// Und in der Zählung je Eigentümer bleibt es eine Kopfstimme.
		const k = await stimmkraftAnsicht(betreiber, g[0].id, '2026-05-19');
		expect(k.zeilen).toHaveLength(1);
		expect(k.summeKopfstimmen).toBe(1);
	});

	it('beendet eine bestehende Zuordnung, statt sie zu überschreiben', async () => {
		const g = await zweiGemeinschaften('Einmal 4');
		const alt = await erstellePerson(handelnder(betreiber), { name: 'Alte Eigentümerin' });
		const neu = await erstellePerson(handelnder(betreiber), { name: 'Neuer Eigentümer' });

		await ordneEinheitZuPerson(handelnder(betreiber), alt.id, g[0].einheit, '2020-01-01');
		const vorschau = await ordneEinheitZuPerson(
			handelnder(betreiber),
			neu.id,
			g[0].einheit,
			'2026-03-01'
		);
		expect(vorschau.rueckfrage?.bisherigerEigentuemer).toBe('Alte Eigentümerin');
		await ordneEinheitZuPerson(
			handelnder(betreiber),
			neu.id,
			g[0].einheit,
			'2026-03-01',
			undefined,
			true
		);

		// Vor dem Wechsel die alte, danach die neue — eine vergangene Versammlung
		// zeigt weiter, wer damals stimmberechtigt war.
		const vorher = await einheitenDerPerson(betreiber, alt.id, '2026-02-01');
		const nachher = await einheitenDerPerson(betreiber, neu.id, '2026-05-19');
		expect(vorher).toHaveLength(1);
		expect(nachher).toHaveLength(1);
		expect(await einheitenDerPerson(betreiber, alt.id, '2026-05-19')).toHaveLength(0);
	});

	it('zeigt freie und belegte Einheiten am ausdrücklich genannten Datum', async () => {
		const g = await zweiGemeinschaften('Einmal 5');
		const frei = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g[0].id,
			kind: 'unit',
			label: 'Freie Wohnung',
			quotas: { stamm: 0 },
			countsAsHead: true
		});
		const person = await erstellePerson(handelnder(betreiber), { name: 'Anna Datumsprobe' });
		await ordneEinheitZuPerson(handelnder(betreiber), person.id, g[0].einheit, '2025-01-01');

		const vorher = await einheitenMitEigentuemerAm(betreiber, '2024-12-31');
		const nachher = await einheitenMitEigentuemerAm(betreiber, '2025-01-01');
		expect(vorher.find((e) => e.unitId === g[0].einheit)?.eigentuemer).toBeNull();
		expect(nachher.find((e) => e.unitId === g[0].einheit)?.eigentuemer?.name).toBe(
			'Anna Datumsprobe'
		);
		expect(nachher.find((e) => e.unitId === frei.id)?.eigentuemer).toBeNull();
		expect(nachher.find((e) => e.unitId === g[0].einheit)?.eigentuemer?.personId).toBe(person.id);
	});

	it('nennt bei gemeinschaftlichem Eigentum die Hülle als Eigentümer', async () => {
		const g = await zweiGemeinschaften('Einmal 6');
		const huelle = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g[0].id,
			kind: 'natural',
			displayName: 'Erbengemeinschaft Berger',
			isCommunity: true,
			representativeName: 'Anna Berger'
		});
		await ordneEigentumZu(handelnder(betreiber), g[0].einheit, huelle.id, '2020-01-01');

		const stand = await einheitenMitEigentuemerAm(betreiber, '2026-05-19');
		expect(stand.find((e) => e.unitId === g[0].einheit)?.eigentuemer).toMatchObject({
			parteiId: huelle.id,
			name: 'Erbengemeinschaft Berger',
			personId: null
		});
	});

	it('liefert vor einem Wechsel nur die Vorschau und legt keine Partei an', async () => {
		const g = await zweiGemeinschaften('Einmal 7');
		const alt = await erstellePerson(handelnder(betreiber), { name: 'Bisherige Person' });
		const neu = await erstellePerson(handelnder(betreiber), { name: 'Künftige Person' });
		await ordneEinheitZuPerson(handelnder(betreiber), alt.id, g[0].einheit, '2020-01-01');
		const vorher = await imKontext(betreiber, (tx) =>
			tx`SELECT id, party_id, valid_from, valid_to FROM unit_ownership WHERE unit_id = ${g[0].einheit}`
		);

		const ergebnis = await ordneEinheitZuPerson(
			handelnder(betreiber),
			neu.id,
			g[0].einheit,
			'2026-03-01'
		);
		expect(ergebnis.parteiId).toBeNull();
		expect(ergebnis.rueckfrage).toMatchObject({
			einheit: '9.9.1',
			person: 'Künftige Person',
			bisherigerEigentuemer: 'Bisherige Person'
		});
		expect(ergebnis.rueckfrage?.gekappt).toHaveLength(1);

		const parteien = await imKontext(
			betreiber,
			(tx) => tx`SELECT id FROM party WHERE stweg_id = ${g[0].id} AND person_id = ${neu.id}`
		);
		const nachher = await imKontext(betreiber, (tx) =>
			tx`SELECT id, party_id, valid_from, valid_to FROM unit_ownership WHERE unit_id = ${g[0].einheit}`
		);
		expect(parteien).toHaveLength(0);
		expect(nachher).toEqual(vorher);
	});

	it('berechnet bei Bestätigung neu und schreibt zwei nahtlose Zeiträume', async () => {
		const g = await zweiGemeinschaften('Einmal 8');
		const alt = await erstellePerson(handelnder(betreiber), { name: 'Verkäuferin' });
		const neu = await erstellePerson(handelnder(betreiber), { name: 'Käufer' });
		await ordneEinheitZuPerson(handelnder(betreiber), alt.id, g[0].einheit, '2020-01-01');
		await ordneEinheitZuPerson(
			handelnder(betreiber),
			neu.id,
			g[0].einheit,
			'2026-03-01',
			'Kaufvertrag',
			true
		);

		const zeitraeume = await imKontext(
			betreiber,
			(tx) => tx<{ name: string; von: string; bis: string | null }[]>`
				SELECT p.display_name AS name, o.valid_from::text AS von, o.valid_to::text AS bis
				  FROM unit_ownership o JOIN party p ON p.id = o.party_id
				 WHERE o.unit_id = ${g[0].einheit} ORDER BY o.valid_from
			`
		);
		expect(zeitraeume).toEqual([
			{ name: 'Verkäuferin', von: '2020-01-01', bis: '2026-03-01' },
			{ name: 'Käufer', von: '2026-03-01', bis: null }
		]);
	});

	it('nennt bei einer rückwirkenden Korrektur ganz entfernte Zeiträume', async () => {
		const g = await zweiGemeinschaften('Einmal 9');
		const alt = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g[0].id,
			kind: 'natural',
			displayName: 'Erste Eigentümerin',
			isCommunity: false,
			representativeName: null
		});
		const zwischen = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g[0].id,
			kind: 'natural',
			displayName: 'Ganz verdrängter Eigentümer',
			isCommunity: false,
			representativeName: null
		});
		const ziel = await erstellePerson(handelnder(betreiber), { name: 'Berichtigte Eigentümerin' });
		await ordneEigentumZu(handelnder(betreiber), g[0].einheit, alt.id, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiber), g[0].einheit, zwischen.id, '2024-01-01');

		const vorschau = await ordneEinheitZuPerson(
			handelnder(betreiber),
			ziel.id,
			g[0].einheit,
			'2023-01-01'
		);
		expect(vorschau.rueckfrage?.verdraengt).toEqual([
			{
				name: 'Ganz verdrängter Eigentümer',
				von: '2024-01-01',
				bis: null
			}
		]);
		expect(await einheitenDerPerson(betreiber, ziel.id, '2026-05-19')).toHaveLength(0);
	});

	it('rollt eine neue Partei zurück, wenn die Zuordnung fachlich abgelehnt wird', async () => {
		const g = await zweiGemeinschaften('Einmal 10');
		const alt = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g[0].id,
			kind: 'natural',
			displayName: 'Frühere Eigentümerin',
			isCommunity: false,
			representativeName: null
		});
		const neu = await erstellePerson(handelnder(betreiber), { name: 'Abgewiesene Person' });
		await ordneEigentumZu(handelnder(betreiber), g[0].einheit, alt.id, '2020-01-01');
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE unit_ownership SET valid_to = '2021-01-01' WHERE unit_id = ${g[0].einheit}`
		);

		await expect(
			ordneEinheitZuPerson(
				handelnder(betreiber),
				neu.id,
				g[0].einheit,
				'2022-01-01',
				undefined,
				true
			)
		).rejects.toThrow(/keinen Eigentümer/);
		const parteien = await imKontext(
			betreiber,
			(tx) => tx`SELECT id FROM party WHERE stweg_id = ${g[0].id} AND person_id = ${neu.id}`
		);
		expect(parteien).toHaveLength(0);
	});

	it('weist ein fehlendes Datum ab', async () => {
		const g = await zweiGemeinschaften('Einmal 11');
		const person = await erstellePerson(handelnder(betreiber), { name: 'Ohne Datum' });
		await expect(
			ordneEinheitZuPerson(handelnder(betreiber), person.id, g[0].einheit, '')
		).rejects.toThrow(/Datum/);
	});
});

describe('Vorsitz und Protokollführung des Abends (Migration 092)', () => {
	/*
	 * **Warum ein eigener Satz Tests** (26.08.2026, aus dem Code-Review): Der
	 * Schreibweg des Abends war ungedeckt — die beiden CHECK-Schranken der
	 * Migration hatte nie eine Zeile gesehen, der Verlaufseintrag niemand
	 * geprüft. Und die Klasse «JavaScript zählt UTF-16, Postgres zählt Zeichen»
	 * sieht nur ein Test mit echter Datenbank.
	 */
	async function abend(name: string) {
		return erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: name,
			datum: '2026-05-19',
			uhrzeit: '19:00',
			ort: 'Halle der Proben'
		});
	}

	it('hält beide Namen fest und macht leeren Text zu «nicht angegeben»', async () => {
		const t = await abend('Vorsitz 1');

		await setzeAbendleitung(handelnder(betreiber), t.id, {
			sitzungsleitung: '  Rita Berger  ',
			protokollfuehrung: 'Notariat Muster'
		});
		const nachher = await holeVersammlungstag(betreiber, t.id);
		expect(nachher?.sitzungsleitung).toBe('Rita Berger');
		expect(nachher?.protokollfuehrung).toBe('Notariat Muster');

		await setzeAbendleitung(handelnder(betreiber), t.id, {
			sitzungsleitung: '   ',
			protokollfuehrung: ''
		});
		const geleert = await holeVersammlungstag(betreiber, t.id);
		expect(geleert?.sitzungsleitung).toBeNull();
		expect(geleert?.protokollfuehrung).toBeNull();
	});

	it('überschreibt am Abend nicht, was ein anderes Fenster eingetragen hat', async () => {
		/*
		 * Am Verbundabend ist der Fall häufiger als bei der einzelnen Versammlung:
		 * Eine Person führt den Abend, mehrere Bewirtschaftungen sehen dieselbe
		 * Zusammenstellung — und alle können den Vorsitz eintragen.
		 */
		const t = await abend('Vorsitz Konflikt');
		const beimOeffnen = { sitzungsleitung: '', protokollfuehrung: '' };

		await setzeAbendleitung(
			handelnder(betreiber),
			t.id,
			{ sitzungsleitung: 'Rita Berger', protokollfuehrung: null },
			beimOeffnen
		);
		await expect(
			setzeAbendleitung(
				handelnder(betreiber),
				t.id,
				{ sitzungsleitung: 'Peter Muster', protokollfuehrung: null },
				beimOeffnen
			)
		).rejects.toThrow(Schreibkonflikt);
		expect((await holeVersammlungstag(betreiber, t.id))?.sitzungsleitung).toBe('Rita Berger');
	});

	it('weist zu kurze Namen und Steuerzeichen mit einem Satz ab', async () => {
		const t = await abend('Vorsitz 2');

		await expect(
			setzeAbendleitung(handelnder(betreiber), t.id, {
				sitzungsleitung: 'R',
				protokollfuehrung: null
			})
		).rejects.toThrow(/mindestens zwei Zeichen/);

		// Ein Zeichen ausserhalb der Grundebene: `'😀'.length` ist 2, in Postgres
		// zählt es als eines. Ohne Codepunkt-Zählung käme es durch und schlüge als
		// Schrankenverletzung durch.
		await expect(
			setzeAbendleitung(handelnder(betreiber), t.id, {
				sitzungsleitung: '😀',
				protokollfuehrung: null
			})
		).rejects.toThrow(/mindestens zwei Zeichen/);

		await expect(
			setzeAbendleitung(handelnder(betreiber), t.id, {
				sitzungsleitung: 'Rita\u0000Berger',
				protokollfuehrung: null
			})
		).rejects.toThrow(/Steuerzeichen/);

		await expect(
			setzeAbendleitung(handelnder(betreiber), t.id, {
				sitzungsleitung: 'R'.repeat(121),
				protokollfuehrung: null
			})
		).rejects.toThrow(/länger als 120 Zeichen/);

		expect((await holeVersammlungstag(betreiber, t.id))?.sitzungsleitung).toBeNull();
	});

	it('hält den Vorzustand im Verlauf fest', async () => {
		const t = await abend('Vorsitz 3');
		await setzeAbendleitung(handelnder(betreiber), t.id, {
			sitzungsleitung: 'Rita Berger',
			protokollfuehrung: null
		});
		await setzeAbendleitung(handelnder(betreiber), t.id, {
			sitzungsleitung: 'Hans Muster',
			protokollfuehrung: null
		});

		const eintraege = await imKontext(
			betreiber,
			(tx) => tx<{ detail: { felder?: Record<string, { vorher: string | null; nachher: string | null }> } }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_id = ${t.id} AND event_type = 'meeting.day.updated'
				 ORDER BY occurred_at
			`
		);
		expect(eintraege.at(-1)?.detail.felder?.sitzungsleitung).toEqual({
			vorher: 'Rita Berger',
			nachher: 'Hans Muster'
		});
	});
});
