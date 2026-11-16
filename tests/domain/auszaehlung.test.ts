/**
 * Story 5.1 — das Prüfnetz für die Auszählung.
 *
 * **Warum diese Datei vor dem Kern entsteht.** Der Portierungsplan des
 * Architektur-Spine schreibt die Reihenfolge bindend vor: zuerst die
 * Wertetabellen des Vorgängerprojekts, dann die Auszählung. Der Grund ist der
 * Umbau: Die Kopfstimme wandert von der Einheit auf die Person (AD-2). Ohne ein
 * Netz, das vorher gespannt ist, verschiebt sich dabei still eine Zahl, und
 * niemand merkt es bis zur ersten Anfechtung.
 *
 * **Was übernommen wurde und was nicht.** Die vier Fälle aus
 * `backend/tests/test_majority.py` des Alt-Repos sind einzeln aufgeführt und als
 * solche gekennzeichnet. Zwei davon prüfen im Neubau etwas anderes als früher,
 * und zwar mit Absicht:
 *
 *   - Das Alt-Repo setzte fehlende Stimmen still auf «Enthaltung»
 *     (`_choice_for_holding` gab `VoteChoice.abstain` zurück, wenn keine Stimme
 *     vorlag). Weil eine Enthaltung beim einfachen Mehr wie ein Nein wirkt,
 *     entschied diese Voreinstellung über Annahme oder Ablehnung. AD-15
 *     verbietet das: Die drei Stimmzustände werden nie ineinander überführt,
 *     und «anwesend, aber nicht abgegeben» ist ein vierter Eimer.
 *   - Das Alt-Repo löste den Anwesenheitsstand in der Auszählung selbst auf
 *     (jüngster Check-in gewinnt). Hier ist das die Aufgabe von
 *     `anwesenheit.ts`; die Auszählung bekommt den beim Schliessen
 *     festgeschriebenen Stand (AD-16) und rechnet nur noch.
 *
 * Jeder Fall hält fest, ob er die Zählweise «je Eigentümer» oder «je Einheit»
 * prüft. Beide sind vertreten — das ist der Kern des Umbaus.
 */
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { describe, expect, it } from 'vitest';
import {
	ausstandshinweis,
	angehoerigenhinweis,
	ausstandsmeldung,
	ausstandProtokollInWorten,
	ergebnisInWorten,
	ergebnislage,
	erfordernisInWorten,
	ergebniswertung,
	mehrheitsvorschau,
	erreichbarkeitshinweis,
	NICHT_IM_STAND,
	vomStimmrechtAusgeschlossen,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage
} from '../../src/lib/domain/auszaehlung';
import { WIDERSPRUCH_FESTHALTEN, WIDERSPRUCH_FOLGE_SCHWEIGEN, WIDERSPRUCH_FRAGEN } from '../../src/lib/domain/auszaehlung';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import { erfordernisluecke } from '../../src/lib/domain/abstimmung';
import {
	betroffenenlage,
	betroffenenzustimmungVon,
	mehrheitMitBasis,
	type Erfordernis
} from '../../src/lib/domain/entscheidbaum';
import type { HeadCountMode, Id, Snapshot, Vote, VoteChoice } from '../../src/lib/domain/types';
import { waehleErfordernis } from '../../src/lib/domain/entscheidbaum';
import {
	enthaltungNachWahl,
	karteMitEnthaltung,
	wendeReglementAn,
	type Reglementsregel
} from '../../src/lib/domain/reglement';
import { holeRegelwerk } from '$lib/rules';
import { AUSSTAND_UNGEKLAERT, AUSSTAND_UNGEKLAERT_KURZ } from '../../src/lib/domain/mehrhinweise';

// ── Bauhilfen ───────────────────────────────────────────────────────────────

interface Parteivorgabe {
	name: string;
	/** Stammquoten der Einheiten dieser Partei. Eine Zahl je Einheit. */
	quoten: number[];
	/** Einheiten ohne eigene Kopfstimme, als Rang in `quoten`. */
	ohneKopfstimme?: number[];
	/** Nebenobjekte, als Rang in `quoten`. */
	nebenobjekte?: number[];
}

function momentaufnahme(
	parteien: Parteivorgabe[],
	zaehlweise: HeadCountMode,
	gesamtquote?: number,
	nebenobjekteZaehlen = true
): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-09-15T17:00:00.000Z',
		headCountMode: zaehlweise,
		parkingCountsAsHead: nebenobjekteZaehlen,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: gesamtquote ?? parteien.reduce((s, p) => s + p.quoten.reduce((a, b) => a + b, 0), 0),
		parties: parteien.map((p, i) => ({
			partyId: `p${i + 1}`,
			displayName: p.name,
			representativeName: null,
			isCommunity: false,
			units: p.quoten.map((q, j) => ({
				unitId: `p${i + 1}-u${j + 1}`,
				label: `${p.name} ${j + 1}`,
				kind: p.nebenobjekte?.includes(j) ? ('parking' as const) : ('unit' as const),
				countsAsHead: !p.ohneKopfstimme?.includes(j),
				quota: q
			}))
		}))
	};
}

/** Alle Einheiten einer Partei gleich stimmen lassen — der Regelfall. */
function stimme(m: Snapshot, parteiId: Id, wahl: VoteChoice, zeit = '2026-09-15T19:10:00.000Z'): Vote[] {
	const p = m.parties.find((x) => x.partyId === parteiId);
	if (!p) throw new Error(`Partei ${parteiId} gibt es in dieser Momentaufnahme nicht.`);
	return p.units.map((u) => ({
		partyId: parteiId,
		unitId: u.unitId,
		choice: wahl,
		castAt: zeit,
		recordedByChair: false
	}));
}

/** Eine einzelne Einheit abweichend stimmen lassen. */
function einheitsstimme(
	parteiId: Id,
	unitId: Id,
	wahl: VoteChoice,
	zeit = '2026-09-15T19:10:00.000Z'
): Vote {
	return { partyId: parteiId, unitId, choice: wahl, castAt: zeit, recordedByChair: false };
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

const QUALIFIZIERTES_MEHR: Erfordernis = {
	...EINFACHES_MEHR,
	knotenId: 'k-baulich-nuetzlich',
	typ: 'qualifiziertes_mehr',
	titel: 'Qualifiziertes Mehr',
	rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
	quotenbasis: 'alle_quoten',
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
};

const EINSTIMMIGKEIT: Erfordernis = {
	...EINFACHES_MEHR,
	knotenId: 'k-zweckaenderung',
	typ: 'einstimmigkeit',
	titel: 'Einstimmigkeit',
	rechtsgrundlage: 'ZGB Art. 648 Abs. 2',
	kopfbasis: 'alle_eigentuemer',
	kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' }
};

function lage(u: Partial<Auszaehlungslage> & Pick<Auszaehlungslage, 'momentaufnahme'>): Auszaehlungslage {
	return {
		erfordernis: EINFACHES_MEHR,
		stimmen: [],
		anwesende: u.momentaufnahme.parties.map((p) => p.partyId),
		...u
	};
}

/*
 * **Ä-27: Die Wertquote im Ausstand bleibt unter «alle Wertquoten» in der
 * Basis** (Produktentscheide 27.09.2026 und 18.10.2026, `docs/entscheide/0010`).
 * Der Fall aus der Entscheidvorlage: vier Parteien zu 250, qualifiziertes Mehr,
 * D im Ausstand, A und B Ja, C Nein. Unter «alle» 500 von nötig 501,
 * abgelehnt; unter «anwesend/vertreten» 500 von nötig 376, angenommen.
 * Auszählmappe und Protokoll rechnen denselben Fall in ihren Dateien nach.
 */
function ausstandsfallAe27() {
	const m = momentaufnahme(
		[
			{ name: 'A', quoten: [250] },
			{ name: 'B', quoten: [250] },
			{ name: 'C', quoten: [250] },
			{ name: 'D', quoten: [250] }
		],
		'per_owner'
	);
	const stimmen = [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes'), ...stimme(m, 'p3', 'no')];
	const zaehle = (quotenbasis: 'alle_quoten' | 'anwesend_vertreten') =>
		zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen,
				erfordernis: { ...QUALIFIZIERTES_MEHR, quotenbasis },
				imAusstand: ['p4']
			})
		);
	return { m, zaehle };
}

describe('Ä-27: Ausstand und Wertquotenbasis', () => {
	it('rechnet unter «alle Wertquoten» mit 1000, nötig 501: abgelehnt', () => {
		const a = ausstandsfallAe27().zaehle('alle_quoten');
		expect(a.quoten).toMatchObject({ ja: 500, nein: 250, basis: 1000, schwelle: 501, erreicht: false });
		expect(a.koepfe).toMatchObject({ ja: 2, basis: 3, erreicht: true });
		expect(a.angenommen).toBe(false);
		expect(a.ausstandswirkung).toContain(AUSSTAND_UNGEKLAERT);
	});

	it('rechnet unter «anwesend/vertreten» mit 750, nötig 376: angenommen', () => {
		const a = ausstandsfallAe27().zaehle('anwesend_vertreten');
		expect(a.quoten).toMatchObject({ ja: 500, nein: 250, basis: 750, schwelle: 376, erreicht: true });
		expect(a.angenommen).toBe(true);
		// Dort sinkt die Basis mit, der Satz zur offenen Frage gehört nicht hin.
		expect(a.ausstandswirkung).not.toContain(AUSSTAND_UNGEKLAERT);
	});

	it('nennt die offene Frage in der Vorschau vor der Abstimmung', () => {
		const { m } = ausstandsfallAe27();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende: m.parties.map((p) => p.partyId),
			erfordernis: QUALIFIZIERTES_MEHR,
			imAusstand: ['p4']
		});
		expect(v.ausstandshinweis).toContain(AUSSTAND_UNGEKLAERT_KURZ);
		// Ohne Fundstellen: Der Satz geht auch an Wand und Telefone.
		expect(v.ausstandshinweis).not.toContain('Rz. 191');
	});
});

/*
 * **Der Weg aus der Absage zählt aus** (Ä-10, `docs/entscheide/0008`). Wer
 * 123,5 Tausendstel als 1235 von 10 000 einträgt, muss dasselbe Ergebnis
 * bekommen; die Einheit «Zehntausendstel» im Protokoll prüft
 * `tests/domain/protokoll.test.ts` («nennt die Einheit der Wertquoten»).
 */
describe('Nenner 10 000 (Ä-10)', () => {
	const m = momentaufnahme(
		[
			{ name: 'A', quoten: [1235] },
			{ name: 'B', quoten: [3765] },
			{ name: 'C', quoten: [5000] }
		],
		'per_owner'
	);

	it('zählt 1235 Zehntausendstel ganzzahlig gegen die Schwelle von 10 000', () => {
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p3', 'yes'), ...stimme(m, 'p2', 'no')],
				erfordernis: QUALIFIZIERTES_MEHR
			})
		);
		expect(a.quoten.ja).toBe(6235);
		expect(a.quoten.basis).toBe(10000);
		expect(a.quoten.erreicht).toBe(true);
	});

	it('bleibt bei genau der Hälfte unter «mehr als die Hälfte»', () => {
		// 1235 + 3765 = 5000 von 10 000: Ein Rundungsfehler würde hier kippen.
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes'), ...stimme(m, 'p3', 'no')],
				erfordernis: QUALIFIZIERTES_MEHR
			})
		);
		expect(a.quoten.ja).toBe(5000);
		expect(a.quoten.erreicht).toBe(false);
	});
});

/*
 * **Dieselbe Schwelle, andere Basis — anderes Ergebnis** (Auftraggeber, 11.08.2026): «Es
 * gibt halt Mehrheit aller und Mehrheit der anwesenden Köpfe, als Beispiel.»
 * Ohne diesen Prüfstein wäre die Auswahl der Bezugsgrösse Kosmetik: Sie stünde
 * im Formular und änderte nichts an der Zählung.
 */
/*
 * Die Gegenprobe zur Handzählung: Der gewöhnliche Weg erhebt die Wertquoten,
 * und das muss dranstehen — sonst wäre `quotenErhoben` ein Merkmal, das nie
 * gesetzt wird, und die Anzeige schriebe überall «nicht erhoben».
 */
describe('Wertquoten sind auf dem gewöhnlichen Weg erhoben', () => {
	it('setzt quotenErhoben nicht auf false', () => {
		const m = momentaufnahme([{ name: 'A', quoten: [500] }, { name: 'B', quoten: [500] }], 'per_owner');
		const a = zaehleAus(lage({ momentaufnahme: m, stimmen: stimme(m, 'p1', 'yes') }));
		expect(a.quotenErhoben).not.toBe(false);
		expect(a.quoten.ja).toBe(500);
	});
});

describe('Enthaltungen, die das Reglement aus der Bezugsgrösse nimmt', () => {
	/*
	 * **Der Anlass** (Prüfdurchgang vom 04.09.2026). Eine Gemeinschaft kann
	 * hinterlegen, dass Enthaltungen nicht in die Bezugsgrösse zählen. Das war
	 * seit dem 15.08.2026 erfassbar, gespeichert und auf der Reglementsseite
	 * angezeigt, und wurde nie gerechnet: `Erfordernis` führte das Merkmal nicht,
	 * also konnte `zaehleAus` es nicht sehen.
	 *
	 * Gemessen wurde ein Antrag mit einer Ja-Stimme und einer Enthaltung: Die
	 * Anwendung verkündete «abgelehnt», während die angezeigte Regel ihn annimmt.
	 */

	/** Zwei Eigentümer, einer stimmt ja, einer enthält sich. */
	function jaUndEnthaltung() {
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [500] },
				{ name: 'B', quoten: [500] }
			],
			'per_owner'
		);
		return { m, stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'abstain')] };
	}

	const AUS_DER_BASIS: Erfordernis = {
		...EINFACHES_MEHR,
		typ: 'reglementsmehr',
		quelle: 'reglement',
		fundstelle: 'Reglement Ziff. 9',
		enthaltungZaehltMit: false
	};

	it('lässt die Enthaltung aus der Bezugsgrösse und nimmt den Antrag an', () => {
		const { m, stimmen } = jaUndEnthaltung();
		const a = zaehleAus(lage({ momentaufnahme: m, stimmen, erfordernis: AUS_DER_BASIS }));
		expect(a.koepfe.basis).toBe(1);
		expect(a.koepfe.schwelle).toBe(1);
		expect(a.koepfe.erreicht).toBe(true);
	});

	it('zählt sie mit, wenn die Regel es sagt — derselbe Antrag fällt durch', () => {
		const { m, stimmen } = jaUndEnthaltung();
		const a = zaehleAus(
			lage({ momentaufnahme: m, stimmen, erfordernis: { ...AUS_DER_BASIS, enthaltungZaehltMit: true } })
		);
		expect(a.koepfe.basis).toBe(2);
		expect(a.koepfe.erreicht).toBe(false);
	});

	it('zählt sie mit, wenn das Erfordernis gar nichts dazu sagt', () => {
		/*
		 * **Fassungsgerecht.** Ein Traktandum aus der Zeit vor diesem Merkmal wird
		 * nachgerechnet, wie es damals gerechnet wurde. `undefined` ist deshalb
		 * nicht dasselbe wie `false`.
		 */
		const { m, stimmen } = jaUndEnthaltung();
		const a = zaehleAus(lage({ momentaufnahme: m, stimmen }));
		expect(EINFACHES_MEHR.enthaltungZaehltMit).toBeUndefined();
		expect(a.koepfe.basis).toBe(2);
		expect(a.koepfe.erreicht).toBe(false);
	});

	it('nimmt sie auch aus der Wertquotenbasis der Anwesenden', () => {
		const { m, stimmen } = jaUndEnthaltung();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen,
				erfordernis: {
					...AUS_DER_BASIS,
					quotenbasis: 'anwesend_vertreten',
					quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
				}
			})
		);
		expect(a.quoten.basis).toBe(500);
	});

	it('lässt die Gesamtquote unberührt', () => {
		/*
		 * «Mehr als die Hälfte **aller** Wertquoten» meint 501 von 1000. Die
		 * Gesamtquote ist eine Eigenschaft der Gemeinschaft, nicht des
		 * Abstimmungsverhaltens; wer sich enthält, hört nicht auf, Anteile zu
		 * halten. Dieselbe Lehre wie beim Ausstand.
		 */
		const { m, stimmen } = jaUndEnthaltung();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen,
				erfordernis: { ...AUS_DER_BASIS, quotenbasis: 'alle_quoten', quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } }
			})
		);
		expect(a.quoten.basis).toBe(1000);
	});

	it('gilt auch für die Handzählung, nicht nur für die einzelne Erfassung', () => {
		/*
		 * **Sonst hätte derselbe Antrag zwei Ergebnisse** (04.09.2026, aus dem
		 * Code-Review): einzeln erfasst «angenommen», von Hand gezählt
		 * «abgelehnt». Der Weg zur Handzählung ist ausgerechnet die Auszählmappe
		 * für den Ausfall.
		 */
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [500] },
				{ name: 'B', quoten: [500] }
			],
			'per_owner'
		);
		const a = zaehleSummenAus(
			{
				momentaufnahme: m,
				erfordernis: AUS_DER_BASIS,
				anwesende: m.parties.map((p) => p.partyId)
			},
			{ ja: 1, nein: 0, enthaltung: 1 }
		);
		expect(a.koepfe.basis).toBe(1);
		expect(a.koepfe.erreicht).toBe(true);
	});

	it('lässt eine Kopfbasis aller Eigentümer unberührt', () => {
		/*
		 * Bei «alle Eigentümer» ist die Bezugsgrösse die Gemeinschaft selbst. Wer
		 * sich enthält, ist weiterhin Eigentümer. Das ist zugleich die strengere
		 * Lesart, wie sonst im Haus.
		 */
		const { m, stimmen } = jaUndEnthaltung();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen,
				erfordernis: { ...AUS_DER_BASIS, kopfbasis: 'alle_eigentuemer' }
			})
		);
		expect(a.koepfe.basis).toBe(2);
	});
});

describe('Mehrheit wovon', () => {
	/** Drei Eigentümer zu je einem Drittel, nur zwei erschienen; einer stimmt ja. */
	function zwei() {
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [334] },
				{ name: 'B', quoten: [333] },
				{ name: 'C', quoten: [333] }
			],
			'per_owner'
		);
		return { m, anwesende: ['p1', 'p2'], stimmen: stimme(m, 'p1', 'yes') };
	}

	it('nimmt bei «anwesend» nur die Erschienenen in die Basis', () => {
		// Basis 2, nötig sind 2 — eine Ja-Stimme genügt nicht.
		const { m, anwesende, stimmen } = zwei();
		const a = zaehleAus(lage({ momentaufnahme: m, anwesende, stimmen }));
		expect(a.koepfe.basis).toBe(2);
	});

	it('nimmt bei «aller Eigentümer» auch die Abwesenden', () => {
		// Dieselbe Schwelle, dieselben Stimmen — aber Basis 3 statt 2.
		const { m, anwesende, stimmen } = zwei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				anwesende,
				stimmen,
				erfordernis: { ...EINFACHES_MEHR, kopfbasis: 'alle_eigentuemer' }
			})
		);
		expect(a.koepfe.basis).toBe(3);
	});
});

// ── Die vier Fälle aus dem Vorgängerprojekt ─────────────────────────────────

describe('Übernommen aus tests/test_majority.py', () => {
	it('einfaches Mehr rechnet auf den anwesenden Stimmen — Zählweise je Einheit', () => {
		// Alt: test_simple_majority_uses_represented_default.
		// Zwei Eigentümer zu je 50, nur der erste anwesend, stimmt mit Ja.
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [50] },
				{ name: 'B', quoten: [50] }
			],
			'per_unit'
		);
		const a = zaehleAus(lage({ momentaufnahme: m, anwesende: ['p1'], stimmen: stimme(m, 'p1', 'yes') }));

		expect(a.koepfe.basis).toBe(1);
		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.schwelle).toBe(1);
		expect(a.angenommen).toBe(true);
	});

	it('qualifiziertes Mehr scheitert an den absoluten Wertquoten — je Einheit', () => {
		// Alt: test_qualified_requires_absolute_quota_default.
		// 40/60, nur der Kleinere anwesend und dafür. Die Köpfe genügen, die
		// Quoten nicht: 40 von 100 erreichen die 51 nicht.
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [40] },
				{ name: 'B', quoten: [60] }
			],
			'per_unit'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: QUALIFIZIERTES_MEHR,
				anwesende: ['p1'],
				stimmen: stimme(m, 'p1', 'yes')
			})
		);

		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.basis).toBe(1);
		expect(a.koepfe.erreicht).toBe(true);
		expect(a.quoten.ja).toBe(40);
		expect(a.quoten.basis).toBe(100);
		expect(a.quoten.schwelle).toBe(51);
		expect(a.quoten.erreicht).toBe(false);
		expect(a.angenommen).toBe(false);
	});

	it('Einstimmigkeit scheitert an der fehlenden Stimme — je Einheit', () => {
		// Alt: test_unanimous_fails_with_abstain_or_missing_vote. Beide anwesend,
		// nur A stimmt.
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [50] },
				{ name: 'B', quoten: [50] }
			],
			'per_unit'
		);
		const a = zaehleAus(
			lage({ momentaufnahme: m, erfordernis: EINSTIMMIGKEIT, stimmen: stimme(m, 'p1', 'yes') })
		);

		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.basis).toBe(2);
		expect(a.angenommen).toBe(false);

		// **Die Korrektur gegenüber dem Alt-Repo.** Dort wurde B als Enthaltung
		// gezählt, weil eine fehlende Stimme still zu `abstain` wurde. Hier ist B
		// «anwesend, aber nicht abgegeben» — ein eigener Eimer (AD-15).
		expect(a.koepfe.enthaltung).toBe(0);
		expect(a.koepfe.ohneAbgabe).toBe(1);
	});

	it('rechnet auf dem übergebenen Anwesenheitsstand, ohne ihn selbst aufzulösen', () => {
		// Alt: test_represented_basis_uses_latest_checkin_state. Dort löste die
		// Auszählung die Check-in-Folge selbst auf. Hier ist das die Aufgabe von
		// `anwesenheit.ts` (AD-16): Die Auszählung bekommt den beim Schliessen
		// festgeschriebenen Stand und rechnet nur noch.
		const m = momentaufnahme([{ name: 'A', quoten: [100] }], 'per_unit');
		const a = zaehleAus(
			lage({ momentaufnahme: m, anwesende: [], stimmen: stimme(m, 'p1', 'yes') })
		);

		expect(a.koepfe.basis).toBe(0);
		expect(a.koepfe.ja).toBe(0);
		expect(a.angenommen).toBe(false);
	});
});

// ── Der Umbau: die Kopfstimme wandert auf die Person (AD-2) ─────────────────

describe('Zählweise je Eigentümer', () => {
	it('zählt die Person einmal, unabhängig von der Zahl ihrer Einheiten', () => {
		// Der Kern von AD-2. Im Alt-Repo trug die Einheit das `head_weight`; wer
		// drei Einheiten besass, hatte drei Kopfstimmen. Nach ZGB Art. 712o Abs. 1
		// ist das der Sonderfall, nicht der Grundsatz.
		const m = momentaufnahme(
			[
				{ name: 'Grossbesitzer', quoten: [300, 300, 300] },
				{ name: 'Kleinbesitzer', quoten: [100] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({ momentaufnahme: m, stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no')] })
		);

		expect(a.koepfe.basis).toBe(2);
		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.nein).toBe(1);
		expect(a.koepfe.schwelle).toBe(2);
		expect(a.angenommen).toBe(false);
	});

	it('kehrt bei derselben Lage mit der Zählung je Einheit das Ergebnis um', () => {
		// Dieselben Zahlen, nur die Zählweise anders — und aus abgelehnt wird
		// angenommen. Genau deshalb ist die Zählweise eine Angabe der
		// Gemeinschaft mit Fundstelle im Reglement und keine Voreinstellung.
		const parteien: Parteivorgabe[] = [
			{ name: 'Grossbesitzer', quoten: [300, 300, 300] },
			{ name: 'Kleinbesitzer', quoten: [100] }
		];
		const jeEinheit = momentaufnahme(parteien, 'per_unit');
		const a = zaehleAus(
			lage({
				momentaufnahme: jeEinheit,
				stimmen: [...stimme(jeEinheit, 'p1', 'yes'), ...stimme(jeEinheit, 'p2', 'no')]
			})
		);

		expect(a.koepfe.basis).toBe(4);
		expect(a.koepfe.ja).toBe(3);
		expect(a.koepfe.schwelle).toBe(3);
		expect(a.angenommen).toBe(true);
	});

	it('lässt Nebenobjekte ohne Kopfstimme aus der Kopfzählung, nicht aus den Quoten', () => {
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [400, 100], nebenobjekte: [1] },
				{ name: 'B', quoten: [500] }
			],
			'per_unit',
			1000,
			false
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: QUALIFIZIERTES_MEHR,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no')]
			})
		);

		expect(a.koepfe.basis).toBe(2);
		expect(a.quoten.ja).toBe(500);
		expect(a.quoten.basis).toBe(1000);
	});
});

// ── Die Grenzfälle, die das Alt-Repo nicht kannte ──────────────────────────

describe('Grenzfälle', () => {
	it('lehnt bei Stimmengleichheit ab — je Eigentümer', () => {
		// «Mehrheit» heisst mehr als die Hälfte. Gleichstand ist Ablehnung, und
		// zwar ohne Stichentscheid: Den kennt das Gesetz für die
		// Eigentümerversammlung nicht.
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [250] },
				{ name: 'B', quoten: [250] },
				{ name: 'C', quoten: [250] },
				{ name: 'D', quoten: [250] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'yes'),
					...stimme(m, 'p3', 'no'),
					...stimme(m, 'p4', 'no')
				]
			})
		);

		expect(a.koepfe.ja).toBe(2);
		expect(a.koepfe.nein).toBe(2);
		expect(a.koepfe.schwelle).toBe(3);
		expect(a.angenommen).toBe(false);
	});

	it('lässt den Alleineigentümer allein beschliessen — je Eigentümer', () => {
		// Kommt vor, wenn eine Gemeinschaft im Aufbau ist und noch alle Einheiten
		// beim Ersteller liegen. Auch die Einstimmigkeit ist dann erreichbar.
		const m = momentaufnahme([{ name: 'Alleineigentümer', quoten: [1000] }], 'per_owner');
		const einfach = zaehleAus(lage({ momentaufnahme: m, stimmen: stimme(m, 'p1', 'yes') }));
		expect(einfach.angenommen).toBe(true);

		const einstimmig = zaehleAus(
			lage({ momentaufnahme: m, erfordernis: EINSTIMMIGKEIT, stimmen: stimme(m, 'p1', 'yes') })
		);
		expect(einstimmig.angenommen).toBe(true);
		expect(einstimmig.ohneZustimmung).toHaveLength(0);
	});

	it('lehnt bei vollständiger Enthaltung ab und behält sie in der Bezugsgrösse', () => {
		// Die Enthaltung fällt nicht aus der Basis. Sie wirkt damit faktisch wie
		// ein Nein — das steht so im Regelwerk und muss sich in den Zahlen zeigen.
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [500] },
				{ name: 'B', quoten: [500] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p1', 'abstain'), ...stimme(m, 'p2', 'abstain')]
			})
		);

		expect(a.koepfe.basis).toBe(2);
		expect(a.koepfe.enthaltung).toBe(2);
		expect(a.koepfe.ja).toBe(0);
		expect(a.koepfe.schwelle).toBe(2);
		expect(a.angenommen).toBe(false);
	});

	it('hält Enthaltung und Nichtabgabe auseinander, auch wenn beide gleich wirken', () => {
		// Sie wirken beim einfachen Mehr gleich — deshalb liegt die Versuchung
		// nahe, sie zusammenzufassen. AD-15 verbietet es: Im Protokoll steht ein
		// Unterschied zwischen «hat sich enthalten» und «hat nicht abgestimmt».
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [500] },
				{ name: 'B', quoten: [500] }
			],
			'per_owner'
		);

		const mitEnthaltung = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'abstain')]
			})
		);
		const ohneAbgabe = zaehleAus(
			lage({ momentaufnahme: m, stimmen: stimme(m, 'p1', 'yes') })
		);

		expect(mitEnthaltung.angenommen).toBe(false);
		expect(ohneAbgabe.angenommen).toBe(false);
		expect(mitEnthaltung.koepfe.enthaltung).toBe(1);
		expect(mitEnthaltung.koepfe.ohneAbgabe).toBe(0);
		expect(ohneAbgabe.koepfe.enthaltung).toBe(0);
		expect(ohneAbgabe.koepfe.ohneAbgabe).toBe(1);
	});

	it('weist bei der Einstimmigkeit die fehlenden Zustimmungen namentlich aus', () => {
		const m = momentaufnahme(
			[
				{ name: 'Anna Muster', quoten: [400] },
				{ name: 'Peter Kunz', quoten: [300] },
				{ name: 'Rita Berger', quoten: [300] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINSTIMMIGKEIT,
				anwesende: ['p1', 'p2'],
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'abstain')]
			})
		);

		expect(a.angenommen).toBe(false);
		expect(a.ohneZustimmung.map((f) => [f.name, f.grund])).toEqual([
			['Peter Kunz', 'enthaltung'],
			['Rita Berger', 'nicht_anwesend']
		]);
		// Bei «alle Eigentümer» zählt der Abwesende in der Basis mit und wirkt
		// gegen den Antrag.
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.nichtAnwesend).toBe(1);
	});
});

// ── Bezugsgrössen, die nicht die Anwesenden sind ───────────────────────────

describe('Abweichende Bezugsgrössen', () => {
	it('rechnet bei «alle ausser Betroffene» auf allen Eigentümern ohne die Betroffenen', () => {
		// ZGB Art. 649b Abs. 2: Die Basis nennt das Gesetz selbst. Bei zehn
		// Eigentümern, von denen einer betroffen ist, braucht es fünf Ja-Stimmen —
		// auch wenn nur sechs im Saal sitzen.
		const m = momentaufnahme(
			Array.from({ length: 10 }, (_, i) => ({ name: `E${i + 1}`, quoten: [100] })),
			'per_owner'
		);
		const anwesende = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: {
					...EINFACHES_MEHR,
					knotenId: 'k-ausschluss',
					rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
					kopfbasis: 'alle_ausser_betroffene'
				},
				anwesende,
				betroffeneParteiIds: ['p10'],
				stimmen: ['p1', 'p2', 'p3', 'p4', 'p5'].flatMap((p) => stimme(m, p, 'yes'))
			})
		);

		expect(a.koepfe.basis).toBe(9);
		expect(a.koepfe.schwelle).toBe(5);
		expect(a.koepfe.ja).toBe(5);
		expect(a.angenommen).toBe(true);
	});

	it('lässt die Betroffenen bei «alle ausser Betroffene» aus allen Eimern fallen', () => {
		// Wer nicht in der Basis ist, taucht auch in keinem Eimer auf. Sonst
		// summierten sich die Eimer nicht zur Basis, und die Ergebniskarte zeigte
		// Zahlen, die niemand nachrechnen kann.
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [400] },
				{ name: 'B', quoten: [300] },
				{ name: 'Betroffener', quoten: [300] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: { ...EINFACHES_MEHR, kopfbasis: 'alle_ausser_betroffene' },
				betroffeneParteiIds: ['p3'],
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'yes'),
					...stimme(m, 'p3', 'no')
				]
			})
		);

		expect(a.koepfe.basis).toBe(2);
		expect(a.koepfe.ja).toBe(2);
		expect(a.koepfe.nein).toBe(0);
	});
});

// ── Zustimmung unmittelbar Betroffener ─────────────────────────────────────

describe('Zustimmung Betroffener', () => {
	const BETROFFEN: Erfordernis = {
		...QUALIFIZIERTES_MEHR,
		knotenId: 'k-nutzungsrecht',
		rechtsgrundlage: 'ZGB Art. 712g Abs. 4',
		zustimmungBetroffenerNoetig: true
	};

	it('prüft Mehrheit und Zustimmung in einem Durchgang und weist beides getrennt aus', () => {
		// Zwei Erfordernisse übereinander, nicht eines. Bei einer Ablehnung muss
		// erkennbar sein, ob die Mehrheit fehlte, eine Zustimmung fehlte, oder
		// beides.
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [400] },
				{ name: 'B', quoten: [300] },
				{ name: 'Betroffene', quoten: [300] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: BETROFFEN,
				betroffeneParteiIds: ['p3'],
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'yes'),
					...stimme(m, 'p3', 'abstain')
				]
			})
		);

		expect(a.koepfe.erreicht).toBe(true);
		expect(a.quoten.erreicht).toBe(true);
		expect(a.betroffene.erfuellt).toBe(false);
		expect(a.betroffene.fehlend.map((f) => [f.name, f.grund])).toEqual([['Betroffene', 'enthaltung']]);
		expect(a.angenommen).toBe(false);
	});

	it('nimmt an, wenn Mehrheit und Zustimmung zusammenkommen', () => {
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [400] },
				{ name: 'B', quoten: [300] },
				{ name: 'Betroffene', quoten: [300] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: BETROFFEN,
				betroffeneParteiIds: ['p3'],
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'yes'),
					...stimme(m, 'p3', 'yes')
				]
			})
		);
		expect(a.betroffene.erfuellt).toBe(true);
		expect(a.angenommen).toBe(true);
	});

	it('wertet Nichtabgabe und Abwesenheit einer betroffenen Person nicht als Zustimmung', () => {
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [400] },
				{ name: 'B', quoten: [300] },
				{ name: 'Betroffene', quoten: [300] }
			],
			'per_owner'
		);
		const ohneAbgabe = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: BETROFFEN,
				betroffeneParteiIds: ['p3'],
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')]
			})
		);
		expect(ohneAbgabe.betroffene.fehlend[0].grund).toBe('ohne_abgabe');

		const abwesend = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: BETROFFEN,
				betroffeneParteiIds: ['p3'],
				anwesende: ['p1', 'p2'],
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')]
			})
		);
		expect(abwesend.betroffene.fehlend[0].grund).toBe('nicht_anwesend');
	});
});

/*
 * **Zwei Formen, zwei Rechnungen** (25.09.2026, Fachprüfung
 * `quellen/pruefung/berichte/2026-09-25-fachpruefung-betroffene.md`, B4 und
 * B5). Die Anwendung führte für ZGB Art. 712g Abs. 4 und Art. 712e Abs. 2
 * dieselbe Zählung. Nach den Quellen ist die Zustimmung bei den Nutzungsrechten
 * Teil der Annahme (im Saal mündlich oder vorher schriftlich, Rz. 209) und bei
 * den Wertquoten ein getrenntes Erfordernis, das in der Regel nachher mit der
 * öffentlichen Abänderungsurkunde erfüllt wird (Rz. 75, 88).
 *
 * Geprüft wird je Zeile der Tabelle im Entwurf
 * (`docs/plan-zustimmung-betroffener-2026-09-25.md`), dazu die Ersatzwerte für
 * Erfordernisse ohne das Feld und die Kombination aus Teil C.
 */
describe('Zustimmung Betroffener: die beiden Formen', () => {
	function drei() {
		return momentaufnahme(
			[
				{ name: 'A', quoten: [400] },
				{ name: 'B', quoten: [300] },
				{ name: 'Betroffene', quoten: [300] }
			],
			'per_owner'
		);
	}

	const IM_SAAL: Erfordernis = {
		...QUALIFIZIERTES_MEHR,
		knotenId: 'k-nutzungsrecht-zuteilung',
		rechtsgrundlage: 'ZGB Art. 712g Abs. 4',
		zustimmungBetroffenerNoetig: true,
		betroffenenzustimmung: 'im_saal_oder_vorab'
	};
	const NACHHER: Erfordernis = {
		...EINFACHES_MEHR,
		knotenId: 'k-wertquoten-aendern',
		rechtsgrundlage: 'ZGB Art. 712e Abs. 2',
		zustimmungBetroffenerNoetig: true,
		betroffenenzustimmung: 'nachher'
	};

	it('ordnet Erfordernissen ohne Feld die Form über die Kennung zu', () => {
		// Sie tragen Beschlüsse aus der Zeit vor der Fassung 2026-09-28 und
		// werden nicht neu gerechnet; die Zuordnung steht an einer Stelle.
		expect(betroffenenzustimmungVon({ ...IM_SAAL, betroffenenzustimmung: undefined })).toBe(
			'im_saal_oder_vorab'
		);
		expect(betroffenenzustimmungVon({ ...NACHHER, betroffenenzustimmung: undefined })).toBe(
			'nachher'
		);
		// Auch ein frei gesetztes Erfordernis ohne Kennung fällt nicht durch.
		expect(betroffenenzustimmungVon({ ...EINFACHES_MEHR })).toBe('im_saal_oder_vorab');
	});

	describe('im Saal oder vorab (ZGB Art. 712g Abs. 4)', () => {
		it('nimmt an, wenn der Betroffene im Saal zustimmt', () => {
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: IM_SAAL,
					betroffeneParteiIds: ['p3'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'yes')
					]
				})
			);
			expect(a.betroffene.form).toBe('im_saal_oder_vorab');
			expect(a.betroffene.zugestimmt).toEqual(['p3']);
			expect(a.betroffene.erfuellt).toBe(true);
			expect(a.angenommen).toBe(true);
		});

		it('nimmt die vorab schriftliche Zustimmung an, auch wenn der Betroffene fehlt', () => {
			// Rz. 209: mündlich an der Versammlung ODER im Vorfeld schriftlich.
			// Die Enthaltung ist keine Äusserung und widerruft den Vermerk nicht.
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: IM_SAAL,
					betroffeneParteiIds: ['p3'],
					anwesende: ['p1', 'p2'],
					vorabZustimmungen: ['p3'],
					stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')]
				})
			);
			expect(a.betroffene.zugestimmt).toEqual(['p3']);
			expect(a.betroffene.vorab).toEqual(['p3']);
			expect(a.betroffene.fehlend).toEqual([]);
			expect(a.betroffene.erfuellt).toBe(true);
			expect(a.angenommen).toBe(true);
		});

		it('lässt eine ruhende Vertretung den Vorab-Vermerk nicht widerrufen', () => {
			/*
			 * Widerrufen wird nur durch ein **gezähltes** Nein. Hier hat der
			 * Vertreter für die Betroffene Nein abgegeben, aber seine Vollmacht
			 * ruht (er ist im Ausstand), und die Stimme fällt in der Zählung
			 * weg. Sie darf auch den Vorab-Vermerk nicht widerrufen.
			 */
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: IM_SAAL,
					betroffeneParteiIds: ['p3'],
					vorabZustimmungen: ['p3'],
					imAusstand: ['p1'],
					vertretungen: [{ vertreteneId: 'p3', bevollmaechtigtId: 'p1' }],
					stimmen: [...stimme(m, 'p2', 'yes'), ...stimme(m, 'p3', 'no')]
				})
			);
			expect(a.betroffene.zugestimmt).toEqual(['p3']);
			expect(a.betroffene.vorab).toEqual(['p3']);
			expect(a.betroffene.fehlend).toEqual([]);
			expect(a.betroffene.erfuellt).toBe(true);
			// Die Stimme des ruhenden Vertreters ist in der Zählung verworfen:
			// Gezählt ist nur das Ja der nicht betroffenen B.
			expect(a.koepfe.ja).toBe(1);
			expect(a.koepfe.erreicht).toBe(true);
		});

		it('lässt die Enthaltung den Vorab-Vermerk nicht widerrufen', () => {
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: IM_SAAL,
					betroffeneParteiIds: ['p3'],
					vorabZustimmungen: ['p3'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'abstain')
					]
				})
			);
			expect(a.betroffene.zugestimmt).toEqual(['p3']);
			expect(a.betroffene.erfuellt).toBe(true);
		});

		it('widerruft den Vorab-Vermerk mit einem Nein im Saal', () => {
			// Die jüngste Äusserung gilt. Das Nein des Betroffenen fällt damit
			// auch als eigenes Nein in die Mehrheit.
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: IM_SAAL,
					betroffeneParteiIds: ['p3'],
					vorabZustimmungen: ['p3'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'no')
					]
				})
			);
			expect(a.betroffene.zugestimmt).toEqual([]);
			expect(a.betroffene.vorab).toEqual([]);
			expect(a.betroffene.fehlend.map((f) => [f.name, f.grund])).toEqual([
				['Betroffene', 'widerrufen']
			]);
			expect(a.betroffene.erfuellt).toBe(false);
			expect(a.angenommen).toBe(false);
			// Der Ablehnungsgrund beim Widerruf, wörtlich aus Anhang S4.
			expect(ergebnisInWorten(a, IM_SAAL)).toContain(
				'Betroffene hat im Saal Nein gesagt; die Auswertung zählt die vorab erteilte schriftliche ' +
					'Zustimmung damit nicht mehr'
			);
		});

		it('zählt ohne Vermerk nur das ausdrückliche Ja, nicht Enthaltung und Abwesenheit', () => {
			const m = drei();
			const ohne = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: IM_SAAL,
					betroffeneParteiIds: ['p3'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'abstain')
					]
				})
			);
			expect(ohne.betroffene.fehlend[0].grund).toBe('enthaltung');
			expect(ohne.angenommen).toBe(false);

			const abwesend = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: IM_SAAL,
					betroffeneParteiIds: ['p3'],
					anwesende: ['p1', 'p2'],
					stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')]
				})
			);
			expect(abwesend.betroffene.fehlend[0].grund).toBe('nicht_anwesend');
			expect(abwesend.angenommen).toBe(false);
		});
	});

	describe('Nachher, mit der Abänderungsurkunde (ZGB Art. 712e Abs. 2)', () => {
		it('genehmigt mit der Mehrheit und lässt die Zustimmung ausstehen, auch beim Nein', () => {
			// Rz. 75 und 88: Die Versammlung genehmigt; die Zustimmung der
			// Betroffenen kommt in der Regel nachher. Darum entscheidet die
			// Mehrheit allein, und `fehlend` bleibt leer.
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: NACHHER,
					betroffeneParteiIds: ['p3'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'no')
					]
				})
			);
			expect(a.betroffene.form).toBe('nachher');
			expect(a.betroffene.erfuellt).toBe(true);
			expect(a.betroffene.fehlend).toEqual([]);
			expect(a.betroffene.zugestimmt).toEqual([]);
			expect(a.betroffene.ausstehend.map((x) => x.name)).toEqual(['Betroffene']);
			expect(a.angenommen).toBe(true);
			const satz = ergebnisInWorten(a, NACHHER);
			expect(satz).toMatch(/Angenommen \(Genehmigung\)/);
			expect(satz).toContain(
				'Die Wertquoten können sich erst ändern, wenn die Betroffenen die Abänderungsurkunde ' +
					'unterzeichnet haben (Betroffene); ein Ja im Saal ersetzt diese Unterschrift nicht.'
			);
			expect(a.hinweise.join(' ')).toMatch(/hat im Saal Nein gesagt/);
			// Am gemeinsamen Abend ohne die Klammer mit den Namen (Block A3a).
			const ohne = ergebnisInWorten(a, NACHHER, { namentlich: false });
			expect(ohne).toContain('unterzeichnet haben; ein Ja im Saal ersetzt');
			expect(ohne).not.toContain('Betroffene)');
		});

		it('nennt ein Ja im Saal und hält es trotzdem als ausstehend', () => {
			// «Ein Ja im Saal ersetzt die Unterschrift nicht.» Es steht in
			// `zugestimmt` (erster Schritt zur Urkunde) und in `ausstehend`.
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: NACHHER,
					betroffeneParteiIds: ['p3'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'yes')
					]
				})
			);
			expect(a.betroffene.zugestimmt).toEqual(['p3']);
			expect(a.betroffene.ausstehend.map((x) => x.parteiId)).toEqual(['p3']);
			expect(a.angenommen).toBe(true);
		});

		it('bleibt genehmigt, wenn der Betroffene fehlt', () => {
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: NACHHER,
					betroffeneParteiIds: ['p3'],
					anwesende: ['p1', 'p2'],
					stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')]
				})
			);
			expect(a.angenommen).toBe(true);
			expect(a.betroffene.ausstehend.map((x) => x.name)).toEqual(['Betroffene']);
		});
	});

	describe('Nachbesserung A1: Ausstand, ausser Stand, Sätze', () => {
		function vier() {
			return momentaufnahme(
				[
					{ name: 'A', quoten: [400] },
					{ name: 'B', quoten: [300] },
					{ name: 'Betroffene Eins', quoten: [200] },
					{ name: 'Betroffene Zwei', quoten: [100] }
				],
				'per_owner'
			);
		}

		it('führt einen Betroffenen im Ausstand bei nachher als ausstehend, nicht als fehlend', () => {
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: NACHHER,
					betroffeneParteiIds: ['p3'],
					imAusstand: ['p3'],
					stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')]
				})
			);
			// `fehlend` bleibt bei `nachher` immer leer; sie steht wie alle
			// Betroffenen als ausstehende Unterschrift, und der Hinweis nennt es.
			expect(a.betroffene.fehlend).toEqual([]);
			expect(a.betroffene.ausstehend.map((x) => x.name)).toEqual(['Betroffene']);
			expect(a.angenommen).toBe(true);
			expect(a.hinweise.join(' ')).toMatch(/im Ausstand und als unmittelbar betroffen bezeichnet/);
		});

		it('hält eine Betroffene ausserhalb des Standes bei nachher nur als ausstehend', () => {
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: NACHHER,
					betroffeneParteiIds: ['p3', 'p-fremd'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'yes')
					]
				})
			);
			expect(a.betroffene.fehlend).toEqual([]);
			expect(a.betroffene.ausstehend.map((x) => x.name)).toEqual(['Betroffene', NICHT_IM_STAND]);
			// Die Namensliste des Leinwandsatzes lässt «(nicht im Stand)» weg;
			// den Fall nennt der Hinweis daneben.
			const satz = ergebnisInWorten(a, NACHHER);
			expect(satz).toContain('unterzeichnet haben (Betroffene);');
			expect(satz).not.toContain(NICHT_IM_STAND);
			expect(a.hinweise.join(' ')).toMatch(/nicht im Stimmberechtigtenstand/);
			expect(a.angenommen).toBe(true);
		});

		it('lässt die Klammer weg, wenn nur eine Partei ausser Stand aussteht', () => {
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: NACHHER,
					betroffeneParteiIds: ['p-fremd'],
					stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')]
				})
			);
			expect(a.betroffene.ausstehend.map((x) => x.name)).toEqual([NICHT_IM_STAND]);
			const satz = ergebnisInWorten(a, NACHHER);
			expect(satz).toContain('unterzeichnet haben; ein Ja im Saal');
			expect(satz).not.toContain('()');
		});

		it('sagt bei allen Betroffenen im Ausstand auf Leinwand und im Protokoll dasselbe', () => {
			const m = vier();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: NACHHER,
					betroffeneParteiIds: ['p3', 'p4'],
					imAusstand: ['p3', 'p4'],
					stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')]
				})
			);
			expect(a.betroffene.fehlend).toEqual([]);
			expect(a.betroffene.ausstehend.map((x) => x.name)).toEqual([
				'Betroffene Eins',
				'Betroffene Zwei'
			]);
			expect(a.angenommen).toBe(true);
			const leinwand = ergebnisInWorten(a, NACHHER);
			expect(leinwand).toContain('Angenommen (Genehmigung)');
			// Gebaut wie die Annahme (Codeprüfung B2b, G1).
			expect(leinwand).toMatch(/^Angenommen \(Genehmigung\): \d+ Ja von .*\. Nötig war /);
			expect(leinwand).not.toContain('Angenommen (Genehmigung) mit');
			expect(leinwand).toContain('(Betroffene Eins, Betroffene Zwei)');
			// Anhang S2, wörtlich.
			expect(ergebniswertung(a, NACHHER)).toBe(
				'Angenommen (Genehmigung). Die Wertquoten können sich erst mit der Unterschrift der ' +
					'Betroffenen auf der Abänderungsurkunde ändern.'
			);
			expect(leinwand).not.toContain('Abgelehnt');
		});

		it('nennt das Nein im Saal bei nachher mit dem Wortlaut aus Anhang S3', () => {
			const m = drei();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: NACHHER,
					betroffeneParteiIds: ['p3'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'no')
					]
				})
			);
			expect(a.hinweise).toContain(
				'«Betroffene» ist unmittelbar betroffen und hat im Saal Nein gesagt. Ohne die ' +
					'Unterschrift dieser Partei auf der Abänderungsurkunde ändern sich die Wertquoten ' +
					'nicht, auch wenn die Versammlung die Änderung genehmigt hat ' +
					'(ZGB Art. 712e Abs. 2).'
			);
		});

		it('verschweigt neben dem Widerruf die übrigen Fehlenden nicht', () => {
			const m = vier();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: IM_SAAL,
					betroffeneParteiIds: ['p3', 'p4'],
					vorabZustimmungen: ['p3'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'no'),
						...stimme(m, 'p4', 'abstain')
					]
				})
			);
			expect(a.betroffene.fehlend.map((f) => f.grund)).toEqual(['widerrufen', 'enthaltung']);
			// Anhang S5: der Widerruf als eigener Grund, die weitere Fehlende
			// daneben.
			expect(ergebniswertung(a, IM_SAAL)).toContain(
				'eine betroffene Person hat im Saal Nein gesagt, die Auswertung zählt ihre vorab erteilte ' +
					'Zustimmung damit nicht mehr; die Zustimmung einer weiteren betroffenen Person fehlt'
			);
			/*
			 * Am gemeinsamen Abend ohne Namen (Block A3a): «weiteren» bleibt,
			 * sonst läse man eine Person, wo es zwei sind (Codeprüfung, dritter
			 * Durchgang).
			 */
			const ohne = ergebnisInWorten(a, IM_SAAL, { namentlich: false });
			expect(ohne).toContain('eine betroffene Person hat im Saal Nein gesagt');
			expect(ohne).toContain('die Zustimmung einer weiteren betroffenen Person fehlt');
			for (const f of a.betroffene.fehlend)
			expect(ohne).not.toMatch(new RegExp(`(^|[^\\p{L}])${f.name}($|[^\\p{L}])`, 'u'));
		});

		it('beugt bei zwei Widerrufen die Zahl und lässt «weitere» weg', () => {
			const m = vier();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: IM_SAAL,
					betroffeneParteiIds: ['p3', 'p4'],
					vorabZustimmungen: ['p3', 'p4'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'no'),
						...stimme(m, 'p4', 'no')
					]
				})
			);
			const wertung = ergebniswertung(a, IM_SAAL);
			expect(wertung).toContain(
				'2 betroffene Personen haben im Saal Nein gesagt, die Auswertung zählt ihre vorab erteilten ' +
					'Zustimmungen damit nicht mehr'
			);
			expect(wertung).not.toContain('weitere');
		});

		it('beugt den Widerruf im Leinwandsatz für mehrere', () => {
			const m = vier();
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: IM_SAAL,
					betroffeneParteiIds: ['p3', 'p4'],
					vorabZustimmungen: ['p3', 'p4'],
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'no'),
						...stimme(m, 'p4', 'no')
					]
				})
			);
			// Anhang S4, Mehrzahl.
			expect(ergebnisInWorten(a, IM_SAAL)).toContain(
				'Betroffene Eins, Betroffene Zwei haben im Saal Nein gesagt; die Auswertung zählt die vorab ' +
					'erteilten schriftlichen Zustimmungen damit nicht mehr'
			);
		});

		it('lässt den Zusatz bei nachher weg, wo keine Zustimmung nötig ist', () => {
			const m = drei();
			const ohnePflicht: Erfordernis = {
				...EINFACHES_MEHR,
				knotenId: 'k-wertquoten-aendern',
				betroffenenzustimmung: 'nachher'
			};
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: ohnePflicht,
					stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')]
				})
			);
			expect(a.betroffene.noetig).toBe(false);
			expect(a.betroffene.form).toBe('nachher');
			expect(a.angenommen).toBe(true);
			expect(ergebniswertung(a, ohnePflicht)).toBe('Angenommen.');
			expect(ergebnisInWorten(a, ohnePflicht)).not.toContain('Genehmigung');
		});
	});

	it('behält einen Betroffenen im Blick, den «alle ausser Betroffene» ausnimmt', () => {
		/*
		 * **Die Kombination aus Teil C** (`4a4fc89`). Ein Erfordernis mit
		 * `alle_ausser_betroffene` UND Zustimmungspflicht kann in einer
		 * gespeicherten Fassung stehen; `pruefeRegelwerk` schliesst sie für
		 * Knoten aus, eine Reglementsregel konnte sie herstellen. Der Befund
		 * lief über `imBlick`, und daraus fällt der Betroffene unter dieser
		 * Bezugsgrösse heraus: Er stimmte Nein, und der Befund lautete
		 * «erfüllt».
		 *
		 * Die Zählung nimmt ihn weiterhin aus der Basis (die Zahlen sind Teil
		 * des Beschlusses); der Zustimmungsbefund sieht ihn jetzt.
		 */
		const m = drei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: {
					...EINFACHES_MEHR,
					kopfbasis: 'alle_ausser_betroffene',
					zustimmungBetroffenerNoetig: true
				},
				betroffeneParteiIds: ['p3'],
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'yes'),
					...stimme(m, 'p3', 'no')
				]
			})
		);
		expect(a.koepfe.basis).toBe(2);
		expect(a.betroffene.fehlend.map((f) => [f.name, f.grund])).toEqual([['Betroffene', 'nein']]);
		expect(a.betroffene.erfuellt).toBe(false);
		expect(a.angenommen).toBe(false);
	});
});

// ── Was aus der Stimmabgabe kommt ──────────────────────────────────────────

describe('Aus den Stimmen selbst', () => {
	it('zählt bei mehreren Stimmen derselben Einheit die letzte', () => {
		// AD-5: Eine berichtigte Stimme erzeugt eine neue Zeile, die alte bleibt
		// stehen. Für das Ergebnis zählt die letzte.
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [500] },
				{ name: 'B', quoten: [500] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [
					...stimme(m, 'p1', 'no', '2026-09-15T19:10:00.000Z'),
					...stimme(m, 'p1', 'yes', '2026-09-15T19:12:00.000Z'),
					...stimme(m, 'p2', 'yes', '2026-09-15T19:11:00.000Z')
				]
			})
		);

		expect(a.koepfe.ja).toBe(2);
		expect(a.koepfe.nein).toBe(0);
		expect(a.angenommen).toBe(true);
	});

	it('bildet aus uneinheitlich stimmenden Einheiten keine Kopfstimme', () => {
		// Bei der Zählung je Eigentümer hat die Person **eine** Kopfstimme. Haben
		// ihre Einheiten verschieden gestimmt, lässt sich daraus keine bilden —
		// und eine Richtung zu wählen entschiede über die Abstimmung. Die
		// Wertquoten dagegen folgen der Einheit und teilen sich sauber auf.
		const m = momentaufnahme(
			[
				{ name: 'Zwiegespalten', quoten: [300, 300] },
				{ name: 'B', quoten: [400] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: QUALIFIZIERTES_MEHR,
				stimmen: [
					einheitsstimme('p1', 'p1-u1', 'yes'),
					einheitsstimme('p1', 'p1-u2', 'no'),
					...stimme(m, 'p2', 'yes')
				]
			})
		);

		expect(a.koepfe.ohneAbgabe).toBe(1);
		expect(a.koepfe.ja).toBe(1);
		expect(a.quoten.ja).toBe(700);
		expect(a.quoten.nein).toBe(300);
		expect(a.hinweise.join(' ')).toMatch(/Zwiegespalten/);
	});

	it('lässt eine Stimme einer nicht anwesenden Partei nicht mitzählen', () => {
		// Wer die Versammlung verlassen hat, bevor abgestimmt wurde, ist beim
		// Schliessen nicht mehr im Stand. Eine vorher abgegebene Stimme darf
		// deshalb nicht auftauchen.
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [500] },
				{ name: 'Gegangen', quoten: [500] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				anwesende: ['p1'],
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')]
			})
		);

		expect(a.koepfe.basis).toBe(1);
		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.nichtAnwesend).toBe(1);
	});
});

// ── Was die Auszählung nicht tut ───────────────────────────────────────────

describe('Grenzen der Auszählung', () => {
	it('zählt ein Traktandum ohne Abstimmung nicht aus', () => {
		const m = momentaufnahme([{ name: 'A', quoten: [1000] }], 'per_owner');
		expect(() =>
			zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: { ...EINFACHES_MEHR, typ: 'keine_abstimmung', kopfSchwelle: null }
				})
			)
		).toThrow(FachlicherFehler);
	});

	it('zählt einen Grenzfall nicht aus, weil kein Erfordernis feststeht', () => {
		// Ein erfundener Wert wäre schlimmer als keiner: Er sähe aus wie eine
		// Regel.
		const m = momentaufnahme([{ name: 'A', quoten: [1000] }], 'per_owner');
		expect(() =>
			zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: { ...EINFACHES_MEHR, typ: 'grenzfall', kopfSchwelle: null }
				})
			)
		).toThrow(/Grenzfall/);
	});

	it('verlangt bei nötiger Zustimmung auch benannte Betroffene', () => {
		const m = momentaufnahme([{ name: 'A', quoten: [1000] }], 'per_owner');
		expect(() =>
			zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true },
					betroffeneParteiIds: []
				})
			)
		).toThrow(/betroffen/i);
	});

	it('liest weder Uhr noch Zufall — dieselbe Lage ergibt dasselbe Ergebnis', () => {
		// AD-1. Zwei Aufrufe derselben Lage müssen Byte für Byte dasselbe liefern,
		// sonst liesse sich die Zählung im Streitfall nicht vorlegen.
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [500] },
				{ name: 'B', quoten: [500] }
			],
			'per_owner'
		);
		const l = lage({ momentaufnahme: m, stimmen: stimme(m, 'p1', 'yes') });
		expect(JSON.stringify(zaehleAus(l))).toBe(JSON.stringify(zaehleAus(l)));
	});
});

/**
 * Der Satz bei einer gescheiterten Einstimmigkeit.
 *
 * Aufgefallen beim Nachrechnen eines Protokolls: Beim Türdämpfer in der
 * Waschküche scheiterte der Antrag an der Einstimmigkeit, und die Anwendung
 * schrieb «die Mehrheit der Köpfe fehlt». Der Satz wird auf der Leinwand
 * vorgelesen und steht später im Protokoll — dort klänge er nach dem falschen
 * Erfordernis.
 */
describe('Ergebnis in Worten', () => {
	it('sagt bei der Einstimmigkeit, dass nicht alle zugestimmt haben', () => {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [500] },
				{ name: 'Bucher', quoten: [300] },
				{ name: 'Christen', quoten: [200] }
			],
			'per_unit'
		);
		const l = lage({
			momentaufnahme: m,
			erfordernis: EINSTIMMIGKEIT,
			stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no')]
		});
		const a = zaehleAus(l);
		expect(a.angenommen).toBe(false);
		const satz = ergebnisInWorten(a, l.erfordernis);
		expect(satz).toContain('es haben nicht alle zugestimmt');
		expect(satz).not.toContain('Mehrheit der Köpfe');
	});

	it('spricht bei den übrigen Erfordernissen weiter von der Mehrheit', () => {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [500] },
				{ name: 'Bucher', quoten: [300] },
				{ name: 'Christen', quoten: [200] }
			],
			'per_unit'
		);
		const l = lage({
			momentaufnahme: m,
			erfordernis: EINFACHES_MEHR,
			stimmen: [...stimme(m, 'p1', 'no'), ...stimme(m, 'p2', 'no'), ...stimme(m, 'p3', 'yes')]
		});
		const satz = ergebnisInWorten(zaehleAus(l), l.erfordernis);
		expect(satz).toContain('die Mehrheit der Köpfe fehlt');
	});
});

/**
 * Der Stichentscheid bei Stimmengleichheit (Reglement der STWEG Nirgendheim, Art. 30).
 *
 * Die Regel steht nicht im Gesetz. Sie greift deshalb nur, wo das Reglement sie
 * vorsieht, nur beim **echten** Gleichstand, und nie bei der Einstimmigkeit —
 * dort ginge es nicht um eine Mehrheit, die sich gleich verteilen könnte,
 * sondern um die Zustimmung aller.
 */
describe('Stichentscheid nach Wertquoten', () => {
	/** Vier Einheiten, zwei dafür und zwei dagegen — aber ungleich schwer. */
	function gleichstand(tieBreak: 'keiner' | 'wertquote' | 'verwalter') {
		const m = {
			...momentaufnahme(
				[
					{ name: 'Aebi', quoten: [400] },
					{ name: 'Bucher', quoten: [350] },
					{ name: 'Christen', quoten: [150] },
					{ name: 'Dubois', quoten: [100] }
				],
				'per_unit'
			),
			tieBreak
		};
		return lage({
			momentaufnahme: m,
			erfordernis: EINFACHES_MEHR,
			stimmen: [
				...stimme(m, 'p1', 'yes'),
				...stimme(m, 'p2', 'yes'),
				...stimme(m, 'p3', 'no'),
				...stimme(m, 'p4', 'no')
			]
		});
	}

	it('lässt den Gleichstand ohne Reglementsregel ein Nichterreichen sein', () => {
		const a = zaehleAus(gleichstand('keiner'));
		expect(a.koepfe.ja).toBe(2);
		expect(a.koepfe.nein).toBe(2);
		expect(a.angenommen).toBe(false);
		expect(a.durchStichentscheid).toBe(false);
	});

	it('löst ihn mit Reglementsregel zugunsten der schwereren Seite auf', () => {
		const a = zaehleAus(gleichstand('wertquote'));
		// 750 Wertquoten dafür, 250 dagegen — bei gleicher Kopfzahl.
		expect(a.quoten.ja).toBe(750);
		expect(a.quoten.nein).toBe(250);
		expect(a.angenommen).toBe(true);
		expect(a.durchStichentscheid).toBe(true);
		expect(a.hinweise.join(' ')).toContain('Gleichstand bei den Kopfstimmen');
	});

	it('lehnt ab, wenn auch die Wertquoten nicht führen', () => {
		const m = {
			...momentaufnahme(
				[
					{ name: 'Aebi', quoten: [100] },
					{ name: 'Bucher', quoten: [150] },
					{ name: 'Christen', quoten: [350] },
					{ name: 'Dubois', quoten: [400] }
				],
				'per_unit'
			),
			tieBreak: 'wertquote' as const
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINFACHES_MEHR,
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'yes'),
					...stimme(m, 'p3', 'no'),
					...stimme(m, 'p4', 'no')
				]
			})
		);
		expect(a.angenommen).toBe(false);
		expect(a.durchStichentscheid).toBe(false);
		expect(a.hinweise.join(' ')).toContain('auch dort führt der Antrag nicht');
	});

	it('greift nicht, wenn das Geschäft mehr als die Hälfte der Köpfe verlangt', () => {
		/*
		 * **Codeprüfung 27.09.2026, H-1.** 2 zu 2 unter drei Vierteln ist kein Patt
		 * vor der Schwelle, sondern ein verfehltes Mehr. Gegenprobe: dieselben
		 * Stimmen unter dem einfachen Mehr lösen die Quoten auf (Probe oben).
		 */
		const m = {
			...momentaufnahme(
				[
					{ name: 'Aebi', quoten: [400] },
					{ name: 'Bucher', quoten: [350] },
					{ name: 'Christen', quoten: [150] },
					{ name: 'Dubois', quoten: [100] }
				],
				'per_unit'
			),
			tieBreak: 'wertquote' as const
		};
		const stimmen = [
			...stimme(m, 'p1', 'yes'),
			...stimme(m, 'p2', 'yes'),
			...stimme(m, 'p3', 'no'),
			...stimme(m, 'p4', 'no')
		];
		const dreiviertel = {
			...EINFACHES_MEHR,
			kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' as const }
		};
		const streng = zaehleAus(lage({ momentaufnahme: m, erfordernis: dreiviertel, stimmen }));
		expect(streng.angenommen).toBe(false);
		expect(streng.durchStichentscheid).toBe(false);

		const einfach = zaehleAus(lage({ momentaufnahme: m, erfordernis: EINFACHES_MEHR, stimmen }));
		expect(einfach.angenommen).toBe(true);
		expect(einfach.durchStichentscheid).toBe(true);
	});

	it('greift nicht, wenn gar kein Gleichstand herrscht', () => {
		// Der wichtigste Test: Die Regel darf keine verfehlte Mehrheit heilen, nur
		// weil die Quoten günstig stehen. 1 zu 2 bleibt 1 zu 2.
		const m = {
			...momentaufnahme(
				[
					{ name: 'Aebi', quoten: [800] },
					{ name: 'Bucher', quoten: [100] },
					{ name: 'Christen', quoten: [100] }
				],
				'per_unit'
			),
			tieBreak: 'wertquote' as const
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINFACHES_MEHR,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no'), ...stimme(m, 'p3', 'no')]
			})
		);
		expect(a.quoten.ja).toBe(800);
		expect(a.angenommen).toBe(false);
		expect(a.durchStichentscheid).toBe(false);
	});

	/*
	 * **Der Code-Fehler, behoben am 27.09.2026.** Die Fassung bis dahin kannte
	 * nur «Ja gleich Nein» und hob damit ein verfehltes Mehr auf «angenommen»,
	 * sobald Enthaltungen (oder Nichtabgaben) in der Bezugsgrösse mitzählten
	 * und die Quoten günstig standen. Die Gegenprobe steht im Kommentar: Vor
	 * dem Fix war genau dieser Fall angenommen.
	 */
	it('greift nicht, wenn Enthaltungen mitzählen und beide Seiten unter der Hälfte bleiben', () => {
		const m = {
			...momentaufnahme(
				[
					{ name: 'Aebi', quoten: [400] },
					{ name: 'Bucher', quoten: [300] },
					{ name: 'Christen', quoten: [100] },
					{ name: 'Duss', quoten: [75] },
					{ name: 'Eger', quoten: [50] },
					{ name: 'Furrer', quoten: [25] },
					{ name: 'Gasser', quoten: [25] },
					{ name: 'Hofer', quoten: [25] }
				],
				'per_owner'
			),
			tieBreak: 'wertquote' as const
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINFACHES_MEHR,
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'yes'),
					...stimme(m, 'p3', 'yes'),
					...stimme(m, 'p4', 'no'),
					...stimme(m, 'p5', 'no'),
					...stimme(m, 'p6', 'no'),
					...stimme(m, 'p7', 'abstain'),
					...stimme(m, 'p8', 'abstain')
				]
			})
		);
		// 3 Ja, 3 Nein, 2 mitzählende Enthaltungen: Basis 8, beide Seiten bei 3.
		expect(a.koepfe.basis).toBe(8);
		expect(a.koepfe.ja).toBe(3);
		expect(a.koepfe.nein).toBe(3);
		// Die Quoten führten zugunsten des Antrags (800 zu 200) — der
		// Stichentscheid hätte ihn alt angenommen.
		expect(a.quoten.ja).toBe(800);
		expect(a.angenommen).toBe(false);
		expect(a.durchStichentscheid).toBe(false);
	});

	it('greift beim echten Patt aus drei gegen drei weiter', () => {
		// Das Gegenstück: Ohne Enthaltungen ist die halbe Basis genau die Zahl
		// der Ja-Stimmen. Hier löst der Stichentscheid auf wie bisher.
		const m = {
			...momentaufnahme(
				[
					{ name: 'Aebi', quoten: [400] },
					{ name: 'Bucher', quoten: [300] },
					{ name: 'Christen', quoten: [100] },
					{ name: 'Duss', quoten: [100] },
					{ name: 'Eger', quoten: [60] },
					{ name: 'Furrer', quoten: [40] }
				],
				'per_owner'
			),
			tieBreak: 'wertquote' as const
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINFACHES_MEHR,
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'yes'),
					...stimme(m, 'p3', 'yes'),
					...stimme(m, 'p4', 'no'),
					...stimme(m, 'p5', 'no'),
					...stimme(m, 'p6', 'no')
				]
			})
		);
		expect(a.koepfe.basis).toBe(6);
		expect(a.angenommen).toBe(true);
		expect(a.durchStichentscheid).toBe(true);
	});

	it('greift nicht allein wegen der halben Bezugsgrösse', () => {
		// 4 Ja, 2 Nein, 2 Enthaltungen, Basis 8: Die zweite Bedingung allein
		// (4 = 8/2) genügt nicht — es fehlt das Patt. 4 von 8 sind keine
		// Mehrheit, aber Ja und Nein sind auch nicht gleich; der Antrag ist
		// abgelehnt, ohne Stichentscheid.
		const m = {
			...momentaufnahme(
				[
					{ name: 'Aebi', quoten: [100] },
					{ name: 'Bucher', quoten: [100] },
					{ name: 'Christen', quoten: [100] },
					{ name: 'Duss', quoten: [100] },
					{ name: 'Eger', quoten: [100] },
					{ name: 'Furrer', quoten: [100] },
					{ name: 'Gasser', quoten: [100] },
					{ name: 'Hofer', quoten: [100] }
				],
				'per_owner'
			),
			tieBreak: 'wertquote' as const
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINFACHES_MEHR,
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'yes'),
					...stimme(m, 'p3', 'yes'),
					...stimme(m, 'p4', 'yes'),
					...stimme(m, 'p5', 'no'),
					...stimme(m, 'p6', 'no'),
					...stimme(m, 'p7', 'abstain'),
					...stimme(m, 'p8', 'abstain')
				]
			})
		);
		expect(a.koepfe.basis).toBe(8);
		expect(a.koepfe.ja).toBe(4);
		expect(a.koepfe.nein).toBe(2);
		expect(a.angenommen).toBe(false);
		expect(a.durchStichentscheid).toBe(false);
	});

	it('greift nie bei der Einstimmigkeit', () => {
		const m = {
			...momentaufnahme(
				[
					{ name: 'Aebi', quoten: [900] },
					{ name: 'Bucher', quoten: [100] }
				],
				'per_unit'
			),
			tieBreak: 'wertquote' as const
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINSTIMMIGKEIT,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no')]
			})
		);
		expect(a.angenommen).toBe(false);
		expect(a.durchStichentscheid).toBe(false);
	});

	it('greift nicht, wenn sich alle enthalten haben', () => {
		// 0 zu 0 ist rechnerisch ein Gleichstand, aber niemand hat den Antrag
		// gestellt bekommen — ein Beschluss ohne eine einzige Ja-Stimme wäre keiner.
		const m = {
			...momentaufnahme(
				[
					{ name: 'Aebi', quoten: [600] },
					{ name: 'Bucher', quoten: [400] }
				],
				'per_unit'
			),
			tieBreak: 'wertquote' as const
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINFACHES_MEHR,
				stimmen: [...stimme(m, 'p1', 'abstain'), ...stimme(m, 'p2', 'abstain')]
			})
		);
		expect(a.angenommen).toBe(false);
		expect(a.durchStichentscheid).toBe(false);
	});

	it('nennt den Stichentscheid im Ergebnissatz', () => {
		const l = gleichstand('wertquote');
		const satz = ergebnisInWorten(zaehleAus(l), l.erfordernis);
		expect(satz).toContain('bei Stimmengleichheit hat nach dem Reglement die Anteilsberechtigung');
	});
});

/**
 * Der Stichentscheid durch den Verwalter (MEG Umgebung, Art. 7 Ziff. 5).
 *
 * **Seit dem 28.09.2026 gilt die Klausel wieder** (Produktentscheid: «Wendet
 * es an. Empfohlen wird ablehnen, weil das dem Gesetz entspricht und man nicht
 * Partei ergreifen würde.»). Vom 27.09. bis dahin rechnete das Werkzeug nach
 * dem Gesetz, und der Gleichstand war eine Ablehnung. Jetzt hält es an, bis
 * der Entscheid eingetragen ist; der Hinweis empfiehlt die Ablehnung und nennt
 * Rz. 187 ad Art. 712m, weil eine Annahme anfechtbar ist.
 */
describe('Stichentscheid durch den Verwalter', () => {
	function lageMit(
		stichentscheid?: { wahl: 'yes' | 'no'; wer: string; begruendung?: string }
	) {
		const m = {
			...momentaufnahme(
				[
					{ name: 'Haus 4', quoten: [200] },
					{ name: 'Haus 6', quoten: [200] },
					{ name: 'Haus 8', quoten: [200] },
					{ name: 'Haus 10', quoten: [200] }
				],
				'per_unit'
			),
			tieBreak: 'verwalter' as const
		};
		return {
			...lage({
				momentaufnahme: m,
				erfordernis: EINFACHES_MEHR,
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'yes'),
					...stimme(m, 'p3', 'no'),
					...stimme(m, 'p4', 'no')
				]
			}),
			stichentscheid
		};
	}

	it('hält an, solange kein Entscheid vorliegt — eine Ablehnung ist es nicht', () => {
		const a = zaehleAus(lageMit());
		expect(a.koepfe.ja).toBe(2);
		expect(a.koepfe.nein).toBe(2);
		expect(a.angenommen).toBe(false);
		expect(a.stichentscheidOffen).toBe(true);
		expect(a.durchStichentscheid).toBe(false);
		expect(ergebnislage(a)).toBe('offen');
	});

	it('sagt im Hinweis, dass der Entscheid aussteht, und empfiehlt die Ablehnung', () => {
		const a = zaehleAus(lageMit());
		const hinweis = a.hinweise.join(' ');
		expect(hinweis).toContain('entscheidet der Verwalter');
		expect(hinweis).toContain('Der Entscheid steht noch aus');
		expect(hinweis).toContain('empfiehlt die Ablehnung');
		expect(hinweis).toContain('Rz. 187');
		expect(hinweis).toContain('anfechten');
	});

	it('macht den Antrag mit einem Ja des Verwalters angenommen', () => {
		const a = zaehleAus(
			lageMit({ wahl: 'yes', wer: 'Verwaltung Probehaus', begruendung: 'Die Sanierung eilt.' })
		);
		expect(a.angenommen).toBe(true);
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.durchStichentscheid).toBe(true);
		expect(a.hinweise.join(' ')).toContain('Verwaltung Probehaus');
		expect(a.hinweise.join(' ')).toContain('für Annahme');
	});

	it('macht den Antrag mit einem Nein des Verwalters abgelehnt — als Entscheid, nicht als verfehltes Mehr', () => {
		const a = zaehleAus(lageMit({ wahl: 'no', wer: 'Verwaltung Probehaus' }));
		expect(a.angenommen).toBe(false);
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.durchStichentscheid).toBe(true);
		expect(ergebnislage(a)).toBe('abgelehnt');
		expect(a.hinweise.join(' ')).toContain('gegen den Antrag');
	});

	it('greift nicht bei der Einstimmigkeit', () => {
		// Dort geht es nicht um eine Mehrheit, die sich gleich verteilen könnte,
		// sondern um die Zustimmung aller. Der Hinweis entfällt dort.
		const a = zaehleAus({ ...lageMit(), erfordernis: EINSTIMMIGKEIT });
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.angenommen).toBe(false);
		expect(a.hinweise.join(' ')).not.toContain('entscheidet der Verwalter');
	});

	it('greift nicht ohne echten Gleichstand', () => {
		const m = {
			...momentaufnahme(
				[
					{ name: 'Haus 4', quoten: [250] },
					{ name: 'Haus 6', quoten: [250] },
					{ name: 'Haus 8', quoten: [250] },
					{ name: 'Haus 10', quoten: [250] }
				],
				'per_unit'
			),
			tieBreak: 'verwalter' as const
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINFACHES_MEHR,
				stimmen: [
					...stimme(m, 'p1', 'yes'),
					...stimme(m, 'p2', 'no'),
					...stimme(m, 'p3', 'no'),
					...stimme(m, 'p4', 'no')
				]
			})
		);
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.angenommen).toBe(false);
		expect(a.hinweise.join(' ')).not.toContain('entscheidet der Verwalter');
	});

	/*
	 * **Drei Zustände, nicht zwei** (05.09.2026, im Browserdurchlauf gefunden).
	 *
	 * `angenommen` ist bei offenem Stichentscheid `false`, weil das Mehr nicht
	 * erreicht ist. Wer daraus «abgelehnt» schliesst, verkündet eine Ablehnung,
	 * die niemand beschlossen hat — und genau das taten zwei Stellen: die Marke
	 * in der Traktandenliste der Sitzungsleitung und die Zählung in der
	 * Auswertung. `ergebnislage` gibt dem dritten Zustand einen Namen, damit ihn
	 * niemand mehr stillschweigend als Nein verbucht.
	 *
	 * **Seit dem 28.09.2026 gilt die Verwalterklausel wieder**: Der offene
	 * Zustand entsteht in der Einzelzählung beim Verwalter-Stichentscheid, bis
	 * der Entscheid eingetragen ist, und ausserdem bei der Handzählung mit
	 * Quotenstichentscheid, die ihren eigenen Prüfstand hat
	 * (`summenzaehlung.test.ts`).
	 */
	describe('Die Ergebnislage kennt den dritten Zustand', () => {
		/** Vier gleiche Parteien — nur so lässt sich zwei gegen zwei stellen. */
		const VIER = [
			{ name: 'Aebi', quoten: [250] },
			{ name: 'Bucher', quoten: [250] },
			{ name: 'Christen', quoten: [250] },
			{ name: 'Duss', quoten: [250] }
		];

		function mitVerwalterGleichstand() {
			const m = { ...momentaufnahme(VIER, 'per_owner'), tieBreak: 'verwalter' as const };
			return zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: EINFACHES_MEHR,
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'no'),
						...stimme(m, 'p4', 'no')
					]
				})
			);
		}

		it('nennt den Verwalter-Gleichstand «offen», solange kein Entscheid vorliegt', () => {
			const a = mitVerwalterGleichstand();
			expect(a.stichentscheidOffen, 'die Lage ist vorbereitet').toBe(true);
			expect(a.angenommen, 'das Mehr ist nicht erreicht').toBe(false);
			expect(ergebnislage(a)).toBe('offen');
		});

		it('nennt eine echte Ablehnung «abgelehnt»', () => {
			const m = momentaufnahme(VIER, 'per_owner');
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: EINFACHES_MEHR,
					stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no'), ...stimme(m, 'p3', 'no')]
				})
			);
			expect(a.stichentscheidOffen).toBe(false);
			expect(ergebnislage(a)).toBe('abgelehnt');
		});

		it('nennt eine Annahme «angenommen»', () => {
			const m = momentaufnahme(VIER, 'per_owner');
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: EINFACHES_MEHR,
					stimmen: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'yes'),
						...stimme(m, 'p4', 'no')
					]
				})
			);
			expect(ergebnislage(a)).toBe('angenommen');
		});

		/*
		 * Ohne Auszählung gibt es ebenfalls kein Ergebnis — aus einem anderen
		 * Grund, aber mit derselben Folge: Wer hier «abgelehnt» schriebe, zählte
		 * ein Traktandum als entschieden, über das nie abgestimmt wurde.
		 */
		it('nennt eine fehlende Auszählung «offen»', () => {
			expect(ergebnislage(null)).toBe('offen');
			expect(ergebnislage(undefined)).toBe('offen');
		});
	});
});

/*
 * **Der Ausstand** (ZGB Art. 68 i.V.m. Art. 712m Abs. 2; PRD §13).
 *
 * Wer bei einem Geschäft in eigener Sache in den Ausstand tritt, ist vom
 * Stimmrecht ausgeschlossen — er stimmt nicht, und er zählt nicht mit. Genau
 * darin liegt der Unterschied zur Enthaltung: Die bleibt in der Bezugsgrösse
 * und wirkt dort wie ein Nein.
 */
describe('Der Ausstand', () => {
	/** Drei Eigentümer zu je einem Drittel, alle anwesend. */
	function drei() {
		return momentaufnahme(
			[
				{ name: 'A', quoten: [334] },
				{ name: 'B', quoten: [333] },
				{ name: 'C', quoten: [333] }
			],
			'per_owner'
		);
	}

	it('nimmt den Ausgetretenen aus der Bezugsgrösse — nicht bloss aus den Stimmen', () => {
		/*
		 * **Der Prüfstein.** Zwei stimmen, einer ist im Ausstand. Bliebe er in der
		 * Basis, wären es drei Köpfe und seine Nichtabgabe zählte wie ein Nein —
		 * der Ausstand wäre damit eine Stimme gegen den Antrag statt keine. Er
		 * fällt heraus: zwei Köpfe, und in keinem Eimer liegt seiner.
		 */
		const m = drei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no')],
				imAusstand: ['p3']
			})
		);

		expect(a.koepfe.basis).toBe(2);
		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.nein).toBe(1);
		// Der Ausgetretene liegt in keinem Eimer — auch nicht bei «ohne Abgabe».
		expect(a.koepfe.ohneAbgabe).toBe(0);
		expect(a.koepfe.ja + a.koepfe.nein + a.koepfe.enthaltung + a.koepfe.ohneAbgabe).toBe(2);
	});

	it('dreht das Ergebnis dort, wo eine Enthaltung es nicht täte', () => {
		/*
		 * **Der Unterschied in einer Zahl.** Vier Eigentümer, zwei stimmen ja,
		 * einer nein. Enthält sich der Vierte, ist die Basis 4, die Schwelle 3 —
		 * zwei Ja reichen nicht. Tritt er in den Ausstand, ist die Basis 3, die
		 * Schwelle 2 — und der Antrag ist angenommen.
		 *
		 * Wer beides gleich behandelte, gäbe dem Ausgetretenen eine Stimme gegen
		 * den Antrag, die er gar nicht abgeben darf.
		 */
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [250] },
				{ name: 'B', quoten: [250] },
				{ name: 'C', quoten: [250] },
				{ name: 'D', quoten: [250] }
			],
			'per_owner'
		);
		const stimmen = [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes'), ...stimme(m, 'p3', 'no')];

		const mitEnthaltung = zaehleAus(
			lage({ momentaufnahme: m, stimmen: [...stimmen, ...stimme(m, 'p4', 'abstain')] })
		);
		const mitAusstand = zaehleAus(
			lage({ momentaufnahme: m, stimmen, imAusstand: ['p4'] })
		);

		expect(mitEnthaltung.koepfe.basis).toBe(4);
		expect(mitEnthaltung.koepfe.schwelle).toBe(3);
		expect(mitEnthaltung.angenommen).toBe(false);

		expect(mitAusstand.koepfe.basis).toBe(3);
		expect(mitAusstand.koepfe.schwelle).toBe(2);
		expect(mitAusstand.angenommen).toBe(true);
	});

	it('nimmt auch die Wertquoten des Ausgetretenen heraus', () => {
		const m = drei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
				imAusstand: ['p3']
			})
		);
		// 334 + 333 = 667 liegen in den Eimern, die 333 des Dritten nirgends.
		expect(a.quoten.ja).toBe(667);
		expect(a.quoten.ohneAbgabe).toBe(0);
		expect(a.quoten.nichtAnwesend).toBe(0);
	});

	it('nennt den Ausgetretenen namentlich, mit Rechtsgrundlage', () => {
		// Ohne diese Zeile im Protokoll wäre der Beschluss nicht erklärbar: Die
		// Zahlen gingen nicht auf, und niemand wüsste warum.
		const m = drei();
		const a = zaehleAus(
			lage({ momentaufnahme: m, stimmen: stimme(m, 'p1', 'yes'), imAusstand: ['p3'] })
		);
		expect(a.hinweise.join(' ')).toMatch(/«C» ist bei diesem Traktandum in den Ausstand/);
		expect(a.hinweise.join(' ')).toMatch(/Art. 68/);
	});

	it('wirkt auch, wo die Abwesenden mitzählen', () => {
		// Bei der Einstimmigkeit ist die Bezugsgrösse «alle Eigentümer». Auch dort
		// fällt der Ausgetretene heraus — sonst verhinderte sein Schweigen den
		// Beschluss, obwohl er gar nicht stimmen darf.
		const m = drei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINSTIMMIGKEIT,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
				anwesende: ['p1', 'p2'],
				imAusstand: ['p3']
			})
		);
		expect(a.koepfe.basis).toBe(2);
		expect(a.angenommen).toBe(true);
		// Und die Karte sagt, dass die Quellen hier auseinandergehen.
		expect(a.hinweise.join(' ')).toMatch(/stimmberechtigten Eigentümern/);
		expect(a.hinweise.join(' ')).toMatch(/nicht entschieden/);
	});

	it('senkt die absolute Wertquotenschranke nicht — und sagt das', () => {
		/*
		 * «Mehr als die Hälfte **aller** Wertquoten» meint 501 von 1000, und daran
		 * ändert der Ausstand nach der strengeren Lesart nichts, die Votum im
		 * Zweifel rechnet. Ob die Quote im Ausstand im Nenner bleibt, ist nicht
		 * geklärt (`AUSSTAND_UNGEKLAERT`, Ä-27), und der Hinweis sagt es.
		 */
		const m = momentaufnahme(
			[
				{ name: 'A', quoten: [400] },
				{ name: 'B', quoten: [600] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: QUALIFIZIERTES_MEHR,
				stimmen: stimme(m, 'p1', 'yes'),
				imAusstand: ['p2']
			})
		);

		expect(a.quoten.basis).toBe(1000);
		expect(a.quoten.schwelle).toBe(501);
		expect(a.quoten.ja).toBe(400);
		expect(a.angenommen).toBe(false);
		expect(a.hinweise.join(' ')).toMatch(/Im Ausstand stehen 600 Wertquoten/);
		expect(a.hinweise.join(' ')).toMatch(/nicht mehr zu erfüllen/);
	});

	it('lässt einen betroffenen Ausgetretenen nicht als zustimmend durchgehen', () => {
		/*
		 * **Der teuerste stille Fehler dieser Datei**, gefunden am 13.08.2026 beim
		 * Abgleich mit den Quellen. Wer im Ausstand ist, steht in keinem Eimer —
		 * also fand ihn die Zustimmungsprüfung nicht, und die Bedingung galt als
		 * erfüllt, obwohl niemand zugestimmt hatte. Der Beschluss sähe angenommen
		 * aus.
		 *
		 * Seit dem 26.09.2026 kein Widerspruch mehr (Produktentscheid, Lesart B):
		 * Ohne Vorab-Vermerk fehlt die Zustimmung weiter, mit Vermerk zählt sie
		 * (Probe darunter).
		 */
		const m = drei();
		const mitZustimmung: Erfordernis = {
			...EINFACHES_MEHR,
			zustimmungBetroffenerNoetig: true
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: mitZustimmung,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
				betroffeneParteiIds: ['p3'],
				imAusstand: ['p3']
			})
		);

		expect(a.betroffene.erfuellt).toBe(false);
		expect(a.betroffene.fehlend.map((f) => f.grund)).toContain('im_ausstand');
		expect(a.angenommen).toBe(false);
		expect(a.hinweise.join(' ')).toMatch(/Ihre Zustimmung ist aber keine Stimme/);
	});

	it('zählt bei einer Betroffenen im Ausstand den Vorab-Vermerk als Zustimmung', () => {
		/*
		 * Produktentscheid 26.09.2026 (Lesart B): Die schriftliche Zustimmung
		 * vorher ist keine Stimmabgabe (SVIT-Kommentar 2023, Art. 712g Rz. 207,
		 * 209). Gegenprobe ist die Probe darüber: dieselbe Lage ohne Vermerk ist
		 * abgelehnt.
		 */
		const m = drei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true },
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
				betroffeneParteiIds: ['p3'],
				imAusstand: ['p3'],
				vorabZustimmungen: ['p3']
			})
		);
		expect(a.betroffene.fehlend).toEqual([]);
		expect(a.betroffene.zugestimmt).toEqual(['p3']);
		expect(a.betroffene.vorab).toEqual(['p3']);
		expect(a.angenommen).toBe(true);
		// Und sie zählt bei der Mehrheit nicht mit: zwei von zwei, nicht zwei von drei.
		expect(a.koepfe.basis).toBe(2);
	});

	it('zählt das Veto im Ausstand als Zustimmung, ohne die Mehrheit zu berühren', () => {
		/*
		 * Produktentscheide 26.09.2026: «Ob er es der Sitzungsleitung sagt oder
		 * per Knopf tippt, die Wirkung ist dieselbe.» Das Veto ist die
		 * Zustimmung, nicht die Stimme: Wer im Ausstand ist, bleibt aus der
		 * Bezugsgrösse. Gegenprobe ist die Probe darüber, ohne Entscheid fehlt
		 * die Zustimmung.
		 */
		const m = drei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true },
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
				betroffeneParteiIds: ['p3'],
				imAusstand: ['p3'],
				vetoEntscheide: [
					{ parteiId: 'p3', entscheid: 'ja', weg: 'telefon', durchVertretung: false }
				]
			})
		);

		expect(a.betroffene.fehlend).toEqual([]);
		expect(a.betroffene.zugestimmt).toEqual(['p3']);
		expect(a.betroffene.veto).toEqual([
			{ parteiId: 'p3', name: 'C', entscheid: 'ja', weg: 'telefon', durchVertretung: false }
		]);
		expect(a.angenommen).toBe(true);
		// Und sie zählt bei der Mehrheit nicht mit: zwei von zwei.
		expect(a.koepfe.basis).toBe(2);
	});

	it('lässt ein Veto-Nein die Zustimmung fehlen', () => {
		/*
		 * Der eigene Grund `veto_nein`: Hier liegt ein Entscheid vor, und er
		 * lautet Nein — anders als bei `im_ausstand`, wo kein Entscheid da ist.
		 */
		const m = drei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true },
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
				betroffeneParteiIds: ['p3'],
				imAusstand: ['p3'],
				vetoEntscheide: [
					{ parteiId: 'p3', entscheid: 'nein', weg: 'leitung', durchVertretung: false }
				]
			})
		);

		expect(a.betroffene.fehlend.map((f) => f.grund)).toEqual(['veto_nein']);
		expect(a.betroffene.veto).toEqual([
			{ parteiId: 'p3', name: 'C', entscheid: 'nein', weg: 'leitung', durchVertretung: false }
		]);
		expect(a.angenommen).toBe(false);
	});

	it('widerruft ein Veto-Nein den Vorab-Vermerk', () => {
		// Dieselbe Regel wie beim Nein im Saal: Die jüngste Äusserung gilt.
		const m = drei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true },
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
				betroffeneParteiIds: ['p3'],
				imAusstand: ['p3'],
				vorabZustimmungen: ['p3'],
				vetoEntscheide: [
					{ parteiId: 'p3', entscheid: 'nein', weg: 'telefon', durchVertretung: true }
				]
			})
		);

		expect(a.betroffene.fehlend.map((f) => f.grund)).toEqual(['widerrufen']);
		expect(a.betroffene.vorab).toEqual([]);
		expect(a.angenommen).toBe(false);
		/*
		 * **Leinwand und Protokoll sagen nicht «im Saal Nein gesagt»**
		 * (Code-Review 26.09.2026, M1): Im Ausstand gibt es kein Nein im
		 * Saal, der Widerruf kam über das Veto.
		 */
		const erfordernis = { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true };
		const leinwand = ergebnisInWorten(a, erfordernis);
		const wertung = ergebniswertung(a, erfordernis);
		expect(leinwand).not.toContain('im Saal Nein');
		expect(leinwand).toMatch(
			/hat im Ausstand nicht zugestimmt; die Auswertung zählt die vorab erteilte schriftliche Zustimmung damit nicht mehr/
		);
		expect(wertung).not.toContain('im Saal Nein');
		expect(wertung).toContain(
			'eine betroffene Person hat im Ausstand nicht zugestimmt, die Auswertung zählt ihre vorab ' +
				'erteilte Zustimmung damit nicht mehr'
		);
	});

	it('trennt im Mischfall den Widerruf im Saal vom Widerruf im Ausstand', () => {
		/*
		 * Code-Review 26.09.2026 (zweiter Durchgang, N-f): p2 widerruft im
		 * Saal, p3 im Ausstand über das Veto, beide mit Vermerk. Leinwand und
		 * Protokoll nennen beide Wege getrennt.
		 */
		const m = drei();
		const erfordernis = { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true };
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no')],
				betroffeneParteiIds: ['p2', 'p3'],
				imAusstand: ['p3'],
				vorabZustimmungen: ['p2', 'p3'],
				vetoEntscheide: [
					{ parteiId: 'p3', entscheid: 'nein', weg: 'leitung', durchVertretung: false }
				]
			})
		);
		expect(a.betroffene.fehlend.map((f) => f.grund)).toEqual(['widerrufen', 'widerrufen']);
		const leinwand = ergebnisInWorten(a, erfordernis);
		expect(leinwand).toMatch(/hat im Saal Nein gesagt/);
		expect(leinwand).toMatch(/hat im Ausstand nicht zugestimmt/);
		const wertung = ergebniswertung(a, erfordernis);
		expect(wertung).toContain('eine betroffene Person hat im Saal Nein gesagt');
		expect(wertung).toContain('eine betroffene Person hat im Ausstand nicht zugestimmt');
		// Am gemeinsamen Abend ohne Namen, beide Widerrufszweige (Block A3a).
		const ohne = ergebnisInWorten(a, erfordernis, { namentlich: false });
		expect(ohne).toContain('eine betroffene Person hat im Saal Nein gesagt');
		expect(ohne).toContain('eine betroffene Person hat im Ausstand nicht zugestimmt');
		for (const f of a.betroffene.fehlend)
			expect(ohne).not.toMatch(new RegExp(`(^|[^\\p{L}])${f.name}($|[^\\p{L}])`, 'u'));
	});

	it('zählt den letzten Veto-Entscheid einer Partei', () => {
		/*
		 * `veto` ist anfügend (AD-5): Eine Berichtigung erzeugt eine neue
		 * Zeile. Gezählt wird die jüngste Äusserung, unabhängig davon, in
		 * welcher Reihenfolge die Liste ankommt.
		 */
		const m = drei();
		const mit = (liste: ('ja' | 'nein')[]) =>
			zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true },
					stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
					betroffeneParteiIds: ['p3'],
					imAusstand: ['p3'],
					vetoEntscheide: liste.map((entscheid) => ({
						parteiId: 'p3',
						entscheid,
						weg: 'leitung' as const,
						durchVertretung: false
					}))
				})
			);

		expect(mit(['nein', 'ja']).betroffene.fehlend).toEqual([]);
		expect(mit(['ja', 'nein']).betroffene.fehlend.map((f) => f.grund)).toEqual(['veto_nein']);
	});

	it('lässt ein Veto ausserhalb des Ausstands ohne Wirkung', () => {
		/*
		 * Die Schranke steht im Server (`erfasseVeto`); der Kern muss sie
		 * trotzdem tragen, weil die Lage aus einem festgeschriebenen Stand
		 * kommen kann. Wer nicht im Ausstand ist, stimmt normal ab; ein
		 * Veto-Eintrag zu ihr ändert nichts.
		 */
		const m = drei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true },
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
				betroffeneParteiIds: ['p3'],
				vetoEntscheide: [
					{ parteiId: 'p3', entscheid: 'ja', weg: 'telefon', durchVertretung: false }
				]
			})
		);

		expect(a.betroffene.veto).toEqual([]);
		expect(a.betroffene.fehlend.map((f) => f.grund)).toEqual(['ohne_abgabe']);
		expect(a.angenommen).toBe(false);
	});

	it('lässt bei den Wertquoten kein Veto zu', () => {
		/*
		 * Die Form `nachher` (Art. 712e Abs. 2) kennt den Veto-Entscheid nicht;
		 * die Zustimmung kommt mit der Abänderungsurkunde. Ein Eintrag bleibt
		 * deshalb ohne Wirkung, und die Partei steht wie alle unter
		 * `ausstehend`.
		 */
		const m = drei();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: {
					...EINFACHES_MEHR,
					zustimmungBetroffenerNoetig: true,
					betroffenenzustimmung: 'nachher'
				},
				betroffeneParteiIds: ['p3'],
				imAusstand: ['p3'],
				vetoEntscheide: [
					{ parteiId: 'p3', entscheid: 'ja', weg: 'leitung', durchVertretung: false }
				]
			})
		);

		expect(a.betroffene.veto).toEqual([]);
		expect(a.betroffene.ausstehend.map((x) => x.parteiId)).toEqual(['p3']);
	});

	it('lässt ohne Ausstand alles wie bisher', () => {
		const m = drei();
		const ohne = zaehleAus(lage({ momentaufnahme: m, stimmen: stimme(m, 'p1', 'yes') }));
		const leer = zaehleAus(
			lage({ momentaufnahme: m, stimmen: stimme(m, 'p1', 'yes'), imAusstand: [] })
		);
		expect(leer).toEqual(ohne);
		expect(ohne.koepfe.basis).toBe(3);
	});
});

/*
 * **Was der Ausstand an den Bezugsgrössen ändert, in Zahlen** (Befund D-02 vom
 * 22.08.2026: «die Bezugsgrösse springt von 5 auf 4, ohne ein Wort der
 * Erklärung»; Produktentscheid 24.09.2026). Das Protokoll druckt diesen Satz
 * unter den Zahlen. Jede Probe prüft die beiden Zahlen, nicht bloss, dass ein
 * Satz entsteht: Ein Satz mit der falschen Zahl ist in einer Urkunde schlimmer
 * als keiner.
 */
describe('ausstandswirkung', () => {
	const MEHR_DER_ANWESENDEN_QUOTEN: Erfordernis = {
		...EINFACHES_MEHR,
		quotenbasis: 'anwesend_vertreten',
		quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
	};

	function fuenf() {
		return momentaufnahme(
			[
				{ name: 'A', quoten: [200] },
				{ name: 'B', quoten: [200] },
				{ name: 'C', quoten: [200] },
				{ name: 'D', quoten: [200] },
				{ name: 'E', quoten: [200] }
			],
			'per_owner'
		);
	}

	it('fehlt ohne Ausstand', () => {
		const m = fuenf();
		expect(zaehleAus(lage({ momentaufnahme: m })).ausstandswirkung).toBeNull();
	});

	it('nennt beide Bezugsgrössen mit und ohne Ausstand, auch ohne Quotenschwelle', () => {
		const m = fuenf();
		const a = zaehleAus(lage({ momentaufnahme: m, imAusstand: ['p5'] }));
		expect(a.koepfe.basis).toBe(4);
		expect(a.ausstandswirkung).toBe(
			'Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 4 statt 5 Kopfstimmen. ' +
				'Bei den Wertquoten sind es 800 statt 1000.'
		);
	});

	it('rechnet mit der tatsächlichen Basis, auch wenn Enthaltungen aus ihr fallen', () => {
		/*
		 * Die erste Zahl ist die gedruckte Basis, die zweite um genau das grösser,
		 * was der Ausstand wegnimmt. Fällt zusätzlich eine Enthaltung aus der
		 * Basis, darf sie nicht dem Ausstand zugeschlagen werden.
		 */
		const m = fuenf();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: { ...EINFACHES_MEHR, enthaltungZaehltMit: false },
				stimmen: stimme(m, 'p1', 'abstain'),
				imAusstand: ['p5']
			})
		);
		expect(a.koepfe.basis).toBe(3);
		expect(a.ausstandswirkung).toBe(
			'Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 3 statt 4 Kopfstimmen. ' +
				'Bei den Wertquoten sind es 600 statt 800.'
		);
	});

	it('sagt, dass sich nichts ändert, wenn der Ausgetretene ohnehin nicht da ist', () => {
		// Zählen nur die Anwesenden, nimmt der Ausstand eines Abwesenden nichts weg.
		const m = fuenf();
		const a = zaehleAus(
			lage({ momentaufnahme: m, anwesende: ['p1', 'p2', 'p3', 'p4'], imAusstand: ['p5'] })
		);
		expect(a.koepfe.basis).toBe(4);
		expect(a.ausstandswirkung).toBe(
			'Der Ausstand von 1 Partei ändert die Bezugsgrösse der Kopfstimmen hier nicht. ' +
				'Bei den Wertquoten ändert er sie nicht.'
		);
	});

	it('nennt bei Quoten der Anwesenden beide Zahlen', () => {
		const m = fuenf();
		const a = zaehleAus(
			lage({ momentaufnahme: m, erfordernis: MEHR_DER_ANWESENDEN_QUOTEN, imAusstand: ['p5'] })
		);
		expect(a.quoten.basis).toBe(800);
		expect(a.ausstandswirkung).toBe(
			'Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 4 statt 5 Kopfstimmen. ' +
				'Bei den Wertquoten sind es 800 statt 1000.'
		);
	});

	it('übernimmt bei der absoluten Quotenschranke den Satz aus ausstandshinweis', () => {
		// Dort ändert sich die Quotenbasis nie; die Protokollfassung desselben
		// Satzes (H3, Fachprüfung 08.10.2026), ohne die Frage an die Leitung.
		const m = fuenf();
		const e = QUALIFIZIERTES_MEHR;
		const a = zaehleAus(lage({ momentaufnahme: m, erfordernis: e, imAusstand: ['p5'] }));
		const schranke = ausstandshinweis(e, m, new Set(['p5']));
		expect(schranke).not.toBeNull();
		expect(a.ausstandswirkung).toBe(
			`Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 4 statt 5 Kopfstimmen. ` +
				'Im Ausstand stehen 200 Wertquoten; sie wirken wie ein Nein. Die Schranke bleibt bei 501 ' +
				'von 1000: Sie bemisst ' +
				`sich an allen Wertquoten der Gemeinschaft. ${AUSSTAND_UNGEKLAERT}`
		);
	});

	it('zählt die ruhende Vollmacht mit: Sie fällt wegen des Ausstands weg', () => {
		/*
		 * E ist nur über D vertreten, D tritt in den Ausstand. Damit fehlen in der
		 * Basis zwei Köpfe, nicht einer, und beide wegen des Ausstands. Eine
		 * eigene Rechnung, die nur den Ausgetretenen abzöge, sagte hier «4 statt
		 * 5» zu einer Basis von 3.
		 */
		const m = fuenf();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				imAusstand: ['p4'],
				vertretungen: [{ vertreteneId: 'p5', bevollmaechtigtId: 'p4' }]
			})
		);
		expect(a.koepfe.basis).toBe(3);
		expect(a.ausstandswirkung).toBe(
			'Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 3 statt 5 Kopfstimmen. ' +
				'Bei den Wertquoten sind es 600 statt 1000.'
		);
	});

	it('steht auch bei der Handzählung, dort nur für die Köpfe', () => {
		const m = fuenf();
		const a = zaehleSummenAus(
			{ momentaufnahme: m, erfordernis: EINFACHES_MEHR, anwesende: m.parties.map((p) => p.partyId), imAusstand: ['p5'] },
			{ ja: 3, nein: 1, enthaltung: 0, vermerk: null }
		);
		expect(a.koepfe.basis).toBe(4);
		expect(a.ausstandswirkung).toBe(
			'Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 4 statt 5 Kopfstimmen.'
		);
	});
});

/*
 * **Wer vom Stimmrecht ausgeschlossen ist, kann auch niemanden vertreten**
 * (BGE 134 III 481 E. 3.8; bis zum 25.09.2026 stand hier der Beobachter,
 * der kein Beleg ist).
 *
 * Ohne diese Regel gäbe der Ausstand die Stimme nur weiter, statt sie zu
 * entziehen: Der Befangene hielte zwei Vollmachten und entschiede das Geschäft
 * in eigener Sache mit fremden Stimmen. Die Zahlen unten zeigen es an einem
 * Fall, in dem es kippt.
 */
describe('Ausstand und Vollmacht', () => {
	function vier() {
		return momentaufnahme(
			[
				{ name: 'A', quoten: [250] },
				{ name: 'B', quoten: [250] },
				{ name: 'C', quoten: [250] },
				{ name: 'D', quoten: [250] }
			],
			'per_owner'
		);
	}

	it('die nur über den Ausgetretenen Vertretene kann keine Stimme abgeben', () => {
		/*
		 * A ist im Ausstand und hält die Vollmacht von B. Beide fallen aus der
		 * Bezugsgrösse — A, weil er nicht stimmen darf; B, weil niemand mehr für
		 * sie da ist. Bliebe B drin, hätte A über sie doch eine Stimme.
		 */
		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p3', 'yes'), ...stimme(m, 'p4', 'no')],
				imAusstand: ['p1'],
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);

		// Basis 2 statt 3: A gar nicht, B als abwesend — und beim einfachen Mehr
		// zählen Abwesende nicht mit.
		expect(a.koepfe.basis).toBe(2);
		expect(a.koepfe.nichtAnwesend).toBe(1);
		expect(a.koepfe.ohneAbgabe).toBe(0);
		expect(a.ohneZustimmung.find((f) => f.name === 'B')?.grund).toBe('vertretung_ruht');
	});

	it('verwirft die Stimme, die der Ausgetretene für sie abgegeben hat — und sagt es', () => {
		/*
		 * **Der teure Fall.** A stimmt für sich und für B mit Ja, C mit Nein. Ohne
		 * die Regel stünde es 1:1 bei Basis 2 (A fällt weg, Bs Ja bleibt) — mit ihr
		 * 0:1. Und weil auf dem Bildschirm ein Ja stand, gehört ein Satz dazu.
		 */
		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				anwesende: ['p1', 'p2', 'p3'],
				stimmen: [...stimme(m, 'p2', 'yes'), ...stimme(m, 'p3', 'no')],
				imAusstand: ['p1'],
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);

		expect(a.koepfe.ja).toBe(0);
		expect(a.koepfe.nein).toBe(1);
		expect(a.koepfe.basis).toBe(1);
		expect(a.angenommen).toBe(false);
		expect(a.hinweise.join(' ')).toMatch(/liegt eine Stimme vor, die A abgegeben hat/);
		expect(a.hinweise.join(' ')).toMatch(/nicht gezählt/);
	});

	it('nennt die ruhende Vertretung namentlich, mit Fundstelle', () => {
		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: stimme(m, 'p3', 'yes'),
				imAusstand: ['p1'],
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);
		expect(a.hinweise.join(' ')).toMatch(/«B» war nur über A vertreten/);
		expect(a.hinweise.join(' ')).toMatch(/BGE 134 III 481 E\. 3\.8/);
		expect(a.hinweise.join(' ')).toMatch(/wer im Ausstand ist/);
		// Und die Einschränkung, damit im Saal niemand die Vollmacht neu ausstellt.
		expect(a.hinweise.join(' ')).toMatch(/bei den übrigen übt dieselbe Vollmacht wieder aus/);
	});

	it('lässt die Vollmacht unberührt, wo die bevollmächtigte Person nicht im Ausstand ist', () => {
		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
				imAusstand: ['p4'],
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);
		expect(a.koepfe.ja).toBe(2);
		expect(a.koepfe.basis).toBe(3);
		expect(a.hinweise.join(' ')).not.toMatch(/vertreten/);
	});

	it('trifft nur die vertretene Partei, nicht die anderen Vollmachten desselben Traktandums', () => {
		// A ist im Ausstand und hält die Vollmacht von B; C vertritt D und ist es
		// nicht. Die Vollmacht von C trägt weiter.
		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p3', 'yes'), ...stimme(m, 'p4', 'yes')],
				imAusstand: ['p1'],
				vertretungen: [
					{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' },
					{ vertreteneId: 'p4', bevollmaechtigtId: 'p3' }
				]
			})
		);
		expect(a.koepfe.ja).toBe(2);
		expect(a.koepfe.basis).toBe(2);
		expect(a.angenommen).toBe(true);
	});

	it('lässt die Einstimmigkeit erreichbar, wo die Vertretung ruht', () => {
		/*
		 * Bei der Einstimmigkeit zählen die Abwesenden mit — B bliebe also in der
		 * Basis und verhinderte den Beschluss. Das ist hier richtig: B ist nicht
		 * befangen, sondern schlicht nicht vertreten, und Einstimmigkeit ohne sie
		 * gibt es nicht. Der Ausgetretene A dagegen fällt heraus.
		 */
		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINSTIMMIGKEIT,
				stimmen: [...stimme(m, 'p3', 'yes'), ...stimme(m, 'p4', 'yes')],
				imAusstand: ['p1'],
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.nichtAnwesend).toBe(1);
		expect(a.angenommen).toBe(false);
		expect(a.ohneZustimmung.map((f) => [f.name, f.grund])).toEqual([['B', 'vertretung_ruht']]);
	});

	it('greift nicht, wo die vertretene Partei gar nicht anwesend ist', () => {
		// Ohne Anwesenheit gibt es keine ruhende Vertretung, nur eine Abwesende.
		// Sonst stünde auf der Karte ein Satz über eine Vollmacht, die im Saal
		// niemand ausgeübt hat.
		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				anwesende: ['p1', 'p3', 'p4'],
				stimmen: stimme(m, 'p3', 'yes'),
				imAusstand: ['p1'],
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);
		expect(a.ohneZustimmung.find((f) => f.name === 'B')?.grund).toBe('nicht_anwesend');
		expect(a.hinweise.join(' ')).not.toMatch(/war nur über/);
	});

	it('lässt ohne Vertretungsangabe alles wie bisher', () => {
		const m = vier();
		const ohne = zaehleAus(
			lage({ momentaufnahme: m, stimmen: stimme(m, 'p2', 'yes'), imAusstand: ['p1'] })
		);
		const leer = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: stimme(m, 'p2', 'yes'),
				imAusstand: ['p1'],
				vertretungen: []
			})
		);
		expect(leer).toEqual(ohne);
		expect(ohne.koepfe.ja).toBe(1);
	});
});

/*
 * **Auch der Beklagte kann niemanden vertreten** (Fachprüfung 25.09.2026,
 * `quellen/themen/stockwerkeigentum/fragen.md`, Frage 45). Unter
 * `alle_ausser_betroffene` ist er von Gesetzes wegen ausgeschlossen
 * (ZGB Art. 649b Abs. 2; BGE 134 III 481 E. 3.4), und nach E. 3.8 gilt das
 * auch für die Stimmen, die er für andere abgibt. Bis zu diesem Tag ruhten
 * seine Vollmachten nur, wenn die Sitzungsleitung ihn zusätzlich in den
 * Ausstand setzte.
 */
describe('Beklagter und Vollmacht', () => {
	const AUSSCHLUSSKLAGE: Erfordernis = {
		...EINFACHES_MEHR,
		knotenId: 'k-ausschlussklage',
		titel: 'Ermächtigung zur Ausschlussklage',
		rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
		kopfbasis: 'alle_ausser_betroffene'
	};
	function vier() {
		return momentaufnahme(
			[
				{ name: 'A', quoten: [250] },
				{ name: 'B', quoten: [250] },
				{ name: 'C', quoten: [250] },
				{ name: 'D', quoten: [250] }
			],
			'per_owner'
		);
	}

	it('zählt die Stimme nicht, die der Beklagte für eine andere Partei abgibt', () => {
		/*
		 * **Der Fall, der kippt.** A ist beklagt und stimmt für B mit Ja, C mit
		 * Ja, D mit Nein. Basis sind B, C, D (alle ausser dem Beklagten), die
		 * Schwelle also 2. Mit Bs Ja wäre die Ermächtigung erteilt, ohne nicht.
		 */
		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: AUSSCHLUSSKLAGE,
				betroffeneParteiIds: ['p1'],
				stimmen: [...stimme(m, 'p2', 'yes'), ...stimme(m, 'p3', 'yes'), ...stimme(m, 'p4', 'no')],
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.nichtAnwesend).toBe(1);
		expect(a.angenommen).toBe(false);
		expect(a.ohneZustimmung.find((f) => f.name === 'B')?.grund).toBe('vertretung_ruht');
		expect(a.hinweise.join(' ')).toMatch(/«B» war nur über A vertreten; wer als unmittelbar betroffen/);
		expect(a.hinweise.join(' ')).toMatch(/liegt eine Stimme vor, die A abgegeben hat/);
	});

	it('lässt die Vollmacht wirken, wo die Kopfbasis den Betroffenen nicht ausnimmt', () => {
		// Nur `alle_ausser_betroffene` schliesst den Betroffenen aus. Unter der
		// Kopfbasis der Anwesenden bleibt er stimmberechtigt, und seine
		// Vollmacht trägt.
		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				betroffeneParteiIds: ['p1'],
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes'), ...stimme(m, 'p3', 'no')],
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);
		expect(a.koepfe.ja).toBe(2);
		expect(a.hinweise.join(' ')).not.toMatch(/vertreten/);
	});
});

/*
 * **Der Beklagte stimmt auch unter einer angewandten Klausel nicht mit**
 * (Produktentscheid 29.09.2026, `quellen` `fragen.md` Frage 52). Seit der
 * Fassung 2026-10-07 wendet Votum an der Ausschlussklage eine hinterlegte
 * Klausel an, und die ersetzt die Kopfbasis. Hing der Ausschluss allein an
 * `alle_ausser_betroffene`, zählte der Beklagte unter einer Klausel «der
 * Anwesenden» mit, samt seinen Vollmachten.
 */
describe('Beklagter unter einer angewandten Klausel', () => {
	const KLAUSEL_DER_ANWESENDEN: Erfordernis = {
		...EINFACHES_MEHR,
		typ: 'reglementsmehr',
		knotenId: 'k-ausschlussklage',
		titel: 'Ermächtigung zur Ausschlussklage',
		rechtsgrundlage: 'Reglement der Gemeinschaft, Art. 9',
		kopfbasis: 'anwesend_vertreten',
		quotenbasis: 'anwesend_vertreten',
		quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quelle: 'reglement',
		fundstelle: 'Art. 9'
	};
	function vier() {
		return momentaufnahme(
			[
				{ name: 'A', quoten: [250] },
				{ name: 'B', quoten: [250] },
				{ name: 'C', quoten: [250] },
				{ name: 'D', quoten: [250] }
			],
			'per_owner'
		);
	}

	it('nimmt ihn aus Köpfen und anwesenden Wertquoten, und das Ergebnis kippt', () => {
		/*
		 * A ist beklagt und stimmt Nein, B und C Ja, D Nein. Mit A wären es 2 Ja
		 * von 4, also nicht mehr als die Hälfte; ohne ihn 2 von 3.
		 */
		const m = vier();
		const stimmen = [
			...stimme(m, 'p1', 'no'),
			...stimme(m, 'p2', 'yes'),
			...stimme(m, 'p3', 'yes'),
			...stimme(m, 'p4', 'no')
		];
		const a = zaehleAus(
			lage({ momentaufnahme: m, erfordernis: KLAUSEL_DER_ANWESENDEN, betroffeneParteiIds: ['p1'], stimmen })
		);
		expect(a.koepfe.basis).toBe(3);
		expect(a.quoten.basis).toBe(750);
		expect(a.angenommen).toBe(true);

		// Gegenprobe: derselbe Fall an einem anderen Knoten. Dort bleibt der
		// Betroffene unter den Anwesenden, und der Antrag scheitert.
		const anderswo = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: { ...KLAUSEL_DER_ANWESENDEN, knotenId: 'k-verwaltung-gewoehnlich' },
				betroffeneParteiIds: ['p1'],
				stimmen
			})
		);
		expect(anderswo.koepfe.basis).toBe(4);
		expect(anderswo.angenommen).toBe(false);
	});

	it('lässt seine Vollmachten ruhen und nennt ihn als betroffen', () => {
		expect(vomStimmrechtAusgeschlossen(KLAUSEL_DER_ANWESENDEN, [], ['p1']).get('p1')).toBe(
			'betroffen'
		);
		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: KLAUSEL_DER_ANWESENDEN,
				betroffeneParteiIds: ['p1'],
				stimmen: [...stimme(m, 'p2', 'yes'), ...stimme(m, 'p3', 'no')],
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);
		expect(a.ohneZustimmung.find((f) => f.name === 'B')?.grund).toBe('vertretung_ruht');
	});

	it('zählt ihn auch in der Handzählung nicht zur Basis', () => {
		const m = vier();
		const a = zaehleSummenAus(
			{
				momentaufnahme: m,
				erfordernis: { ...KLAUSEL_DER_ANWESENDEN, quotenbasis: 'keine', quotenSchwelle: null },
				anwesende: m.parties.map((p) => p.partyId),
				betroffeneParteiIds: ['p1']
			},
			{ ja: 2, nein: 1, enthaltung: 0, vermerk: null }
		);
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.erreicht).toBe(true);
	});

	it('sagt in Bezugsgrösse und Hinweisen, dass der Beklagte fehlt (Codeprüfung M-1)', () => {
		expect(erfordernisInWorten(KLAUSEL_DER_ANWESENDEN)).toMatch(
			/der Anwesenden oder Vertretenen ohne den Beklagten/
		);
		expect(
			erfordernisInWorten({ ...KLAUSEL_DER_ANWESENDEN, knotenId: 'k-verwaltung-gewoehnlich' })
		).not.toMatch(/Beklagten/);
		// Von Hand auf «aller Eigentümer» übersteuert (zweiter Durchgang, M-A):
		// gerechnet wird ohne ihn, also sagen es Text und Titel.
		expect(
			erfordernisInWorten({ ...KLAUSEL_DER_ANWESENDEN, kopfbasis: 'alle_eigentuemer' })
		).toMatch(/aller Eigentümer ohne den Beklagten/);
		expect(
			mehrheitMitBasis('Einfaches Mehr', {
				typ: 'einfaches_mehr',
				kopfbasis: 'alle_eigentuemer',
				quotenbasis: 'keine',
				knotenId: 'k-ausschlussklage'
			})
		).toMatch(/ohne den Beklagten/);
		expect(
			mehrheitMitBasis('Einfaches Mehr', {
				typ: 'einfaches_mehr',
				kopfbasis: 'alle_ausser_betroffene',
				quotenbasis: 'keine',
				knotenId: 'k-ausschlussklage'
			})
		).not.toMatch(/ohne den Beklagten/);

		const m = vier();
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: KLAUSEL_DER_ANWESENDEN,
				betroffeneParteiIds: ['p1'],
				stimmen: [...stimme(m, 'p2', 'yes')]
			})
		);
		expect(a.hinweise.join(' ')).toMatch(/«A» ist als Beklagter bezeichnet und zählt hier nicht mit/);
		// Unter der Basis des Gesetzes sagt es die Bezugsgrösse; kein zweiter Satz.
		const gesetz = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: { ...KLAUSEL_DER_ANWESENDEN, kopfbasis: 'alle_ausser_betroffene' },
				betroffeneParteiIds: ['p1'],
				stimmen: [...stimme(m, 'p2', 'yes')]
			})
		);
		expect(gesetz.hinweise.join(' ')).not.toMatch(/als Beklagter bezeichnet/);
	});

	it('sperrt die Abstimmung, solange keine beklagte Partei eingetragen ist', () => {
		expect(erfordernisluecke(KLAUSEL_DER_ANWESENDEN, 0)?.kennung).toBe('ohne_beklagten');
		expect(
			erfordernisluecke({ ...KLAUSEL_DER_ANWESENDEN, kopfbasis: 'alle_ausser_betroffene' }, 0)?.kennung
		).toBe('ohne_beklagten');
		expect(erfordernisluecke(KLAUSEL_DER_ANWESENDEN, 1)).toBeNull();
		expect(
			erfordernisluecke({ ...KLAUSEL_DER_ANWESENDEN, knotenId: 'k-verwaltung-gewoehnlich' }, 0)
		).toBeNull();
	});

	it('lässt die Betroffenen am Traktandum eintragen', () => {
		expect(betroffenenlage(KLAUSEL_DER_ANWESENDEN).kennt).toBe(true);
		expect(betroffenenlage({ ...KLAUSEL_DER_ANWESENDEN, knotenId: 'k-verwaltung-gewoehnlich' }).kennt).toBe(
			false
		);
	});
});

/*
 * **Wen nur eine Reglementsklausel ausnimmt, der vertritt weiter**
 * (Produktentscheid 27.09.2026, `quellen/themen/stockwerkeigentum/fragen.md`,
 * «Offen»). Dieselbe Kopfbasis wie beim Beklagten, aber ein anderer Knoten: Die
 * eigene Stimme fällt weiter aus der Zählung, die Vollmachten ruhen nicht mehr.
 * Der Beklagte bleibt ausgeschlossen; die Proben dazu stehen oben und hier als
 * Gegenstück daneben, über dieselben Zahlen.
 */
describe('Reglementsklausel und Vollmacht', () => {
	const REGLEMENTSKLAUSEL: Erfordernis = {
		...EINFACHES_MEHR,
		typ: 'reglementsmehr',
		titel: 'Mehrheit aller ohne die Betroffenen',
		rechtsgrundlage: 'Reglement der Gemeinschaft, Art. 9',
		kopfbasis: 'alle_ausser_betroffene',
		quelle: 'reglement',
		fundstelle: 'Art. 9'
	};
	const AUSSCHLUSSKLAGE: Erfordernis = {
		...EINFACHES_MEHR,
		knotenId: 'k-ausschlussklage',
		titel: 'Ermächtigung zur Ausschlussklage',
		rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
		kopfbasis: 'alle_ausser_betroffene'
	};
	function vier() {
		return momentaufnahme(
			[
				{ name: 'A', quoten: [250] },
				{ name: 'B', quoten: [250] },
				{ name: 'C', quoten: [250] },
				{ name: 'D', quoten: [250] }
			],
			'per_owner'
		);
	}

	it('unterscheidet am Knoten, nicht an der Kopfbasis', () => {
		expect(vomStimmrechtAusgeschlossen(REGLEMENTSKLAUSEL, [], ['p1']).get('p1')).toBe('ausgenommen');
		expect(vomStimmrechtAusgeschlossen(AUSSCHLUSSKLAGE, [], ['p1']).get('p1')).toBe('betroffen');
		// Der Ausstand führt, auch unter der Reglementsklausel.
		expect(vomStimmrechtAusgeschlossen(REGLEMENTSKLAUSEL, ['p1'], ['p1']).get('p1')).toBe('ausstand');
		// Ohne `alle_ausser_betroffene` ist niemand ausgenommen.
		expect(vomStimmrechtAusgeschlossen(EINFACHES_MEHR, [], ['p1']).size).toBe(0);
	});

	it('zählt die Stimme, die ein ausgenommener Betroffener für eine andere Partei abgibt', () => {
		/*
		 * Dieselben Stimmen wie beim Beklagten oben: A stimmt für sich und für B
		 * mit Ja, C Ja, D Nein. Basis B, C, D, Schwelle 2. As eigene Stimme
		 * zählt nicht, Bs Ja über A zählt: angenommen. Bis zum 27.09.2026 ruhte
		 * die Vollmacht, und das Ergebnis war abgelehnt.
		 */
		const m = vier();
		const stimmen = [
			...stimme(m, 'p1', 'yes'),
			...stimme(m, 'p2', 'yes'),
			...stimme(m, 'p3', 'yes'),
			...stimme(m, 'p4', 'no')
		];
		const vertretungen = [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }];
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: REGLEMENTSKLAUSEL,
				betroffeneParteiIds: ['p1'],
				stimmen,
				vertretungen
			})
		);
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.ja).toBe(2);
		expect(a.koepfe.nichtAnwesend).toBe(0);
		expect(a.angenommen).toBe(true);
		expect(a.ohneZustimmung.find((f) => f.name === 'B')).toBeUndefined();
		expect(a.hinweise.join(' ')).not.toMatch(/war nur über/);

		// Gegenstück: dieselbe Lage am Knoten der Ausschlussklage.
		const b = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: AUSSCHLUSSKLAGE,
				betroffeneParteiIds: ['p1'],
				stimmen,
				vertretungen
			})
		);
		expect(b.koepfe.ja).toBe(1);
		expect(b.angenommen).toBe(false);
		expect(b.ohneZustimmung.find((f) => f.name === 'B')?.grund).toBe('vertretung_ruht');
	});

	it('lässt bei der Handzählung die Hand der Vertretenen zu, beim Beklagten nicht', () => {
		/*
		 * **Derselbe Weg über `zaehleSummenAus`** (A3a, A3c: dort fiel eine Lücke
		 * in der Handzählung still durch). Alle vier anwesend, A vertritt B.
		 * Drei Hände Ja: B über A, C, D. Unter der Reglementsklausel stehen drei
		 * Kopfstimmen zur Verfügung, beim Beklagten nur zwei.
		 */
		const m = vier();
		const vertretungen = [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }];
		const a = zaehleSummenAus(
			lage({
				momentaufnahme: m,
				erfordernis: REGLEMENTSKLAUSEL,
				betroffeneParteiIds: ['p1'],
				vertretungen
			}),
			{ ja: 3, nein: 0, enthaltung: 0 }
		);
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.nichtAnwesend).toBe(0);
		expect(a.angenommen).toBe(true);
		expect(a.hinweise.join(' ')).not.toMatch(/war nur über/);

		expect(() =>
			zaehleSummenAus(
				lage({
					momentaufnahme: m,
					erfordernis: AUSSCHLUSSKLAGE,
					betroffeneParteiIds: ['p1'],
					vertretungen
				}),
				{ ja: 3, nein: 0, enthaltung: 0 }
			)
		).toThrow(/Mehr Stimmen als Stimmberechtigte/);
	});

	it('berührt in der Vorschau die Köpfe nicht, die Wertquoten der Anwesenden schon', () => {
		/*
		 * **Die Frage aus dem Auftrag, nachgemessen statt übernommen.** Unter
		 * `alle_ausser_betroffene` zählen Abwesende bei den Köpfen mit; ob B
		 * über eine ruhende Vollmacht als abwesend gilt oder als vertreten,
		 * ändert die Kopfbasis also nicht. Anders eine Reglementsregel mit
		 * Wertquoten der Anwesenden: Dort stand Bs Quote bis zum 27.09.2026
		 * nicht in der Basis und steht jetzt darin. `nichtBerechenbar` hängt an
		 * `erfordernisluecke` und bleibt unberührt.
		 */
		const m = vier();
		const vertretungen = [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }];
		const mitQuoten: Erfordernis = {
			...REGLEMENTSKLAUSEL,
			quotenbasis: 'anwesend_vertreten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		};
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			erfordernis: mitQuoten,
			anwesende: ['p1', 'p2', 'p3', 'p4'],
			betroffeneParteiIds: ['p1'],
			vertretungen
		});
		expect(v.nichtBerechenbar).toBeUndefined();
		expect(v.kopf).toEqual({ noetig: 2, von: 3 });
		expect(v.quoten?.von).toBe(750);

		const beklagt = mehrheitsvorschau({
			momentaufnahme: m,
			erfordernis: { ...mitQuoten, knotenId: 'k-ausschlussklage' },
			anwesende: ['p1', 'p2', 'p3', 'p4'],
			betroffeneParteiIds: ['p1'],
			vertretungen
		});
		expect(beklagt.kopf).toEqual({ noetig: 2, von: 3 });
		expect(beklagt.quoten?.von).toBe(500);
	});
});

/*
 * **Ehegatte und Verwandte des Beklagten stimmen nicht mit** (Produktentscheid
 * 27.09.2026, `quellen/themen/stockwerkeigentum/fragen.md`, «Offen»; ZGB
 * Art. 68, BGE 134 III 481 E. 3.8). Votum kennt keine Verwandtschaft; die
 * Wirkung trägt der Ausstand, den die Leitung erklärt. Die Proben hier zeigen
 * beides: dass der Hinweis nur an der Ausschlussklage steht, und dass der
 * Ausstand dort in beiden Zählwegen wirkt, auch mit einer Vollmacht.
 */
describe('Ehegatte des Beklagten', () => {
	const AUSSCHLUSSKLAGE: Erfordernis = {
		...EINFACHES_MEHR,
		knotenId: 'k-ausschlussklage',
		titel: 'Ermächtigung zur Ausschlussklage',
		rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
		kopfbasis: 'alle_ausser_betroffene'
	};
	function fuenf() {
		return momentaufnahme(
			[
				{ name: 'A', quoten: [200] },
				{ name: 'B', quoten: [200] },
				{ name: 'C', quoten: [200] },
				{ name: 'D', quoten: [200] },
				{ name: 'E', quoten: [200] }
			],
			'per_owner'
		);
	}

	it('nennt die Leitung nur an der Ausschlussklage', () => {
		const h = angehoerigenhinweis(AUSSCHLUSSKLAGE)!;
		expect(h).toMatch(/^Ehegatte und Verwandte des Beklagten in gerader Linie/);
		expect(h).toMatch(/weder für eine eigene Wohnung noch als Vertretung/);
		// Fragen und protokollieren (Fachprüfung 27.09.2026, A2-1; Rz. 145 ad Art. 712m).
		expect(h).toMatch(/Fragen Sie vor der Abstimmung danach, halten Sie die Antwort im Protokoll fest/);
		// Der Ausstand für die richtige Gruppe, nicht für die zuletzt genannte (Laienprüfung, A2-1).
		expect(h).toMatch(/erklären Sie für diese Angehörigen hier den Ausstand/);
		// Eine Ehefrau, die die Wohnung mit dem Beklagten teilt, ist kein eigener Kopf
		// (ZGB Art. 712o Abs. 1; Fachprüfung Runde 3, A1-R3-2).
		expect(h).toMatch(/auch wenn ihnen nur die Wohnung des Beklagten mitgehört/);
		// Zur Zahl, nicht zu den Ja-Stimmen (Laienprüfung Runde 5, A2-R5-1).
		expect(h).toMatch(/Zählen Sie die Angehörigen mit eigener Wohnung nach der Abstimmung zur Zahl der Eigentümer hinzu, nicht zu den Ja-Stimmen/);
		// Nicht «Ihre Vollmachten»: die Leitung las das als ihre eigenen (Laienprüfung Runde 4, A2-R4-1).
		expect(h).toMatch(/Auch die Vollmachten, die sie halten, ruhen dann/);
		// Grosseltern gehören dazu, die Liste ist nicht abschliessend (Fachprüfung Runde 2, A2-R2-1).
		expect(h).toMatch(/\(etwa Eltern, Kinder, Grosseltern, Enkel\)/);
		// Votum zählt milder als der Wortlaut, und die Leitung rechnet nach (Fachprüfung, A1-1, A2-R2-2).
		expect(h).toMatch(/Art\. 649b Abs\. 2 nimmt aber nur den Beklagten aus der Zahl/);
		expect(h).toMatch(/sonst ist sie angreifbar, und das gehört ins Protokoll/);
		expect(angehoerigenhinweis({ ...AUSSCHLUSSKLAGE, knotenId: 'k-hausordnung' })).toBeNull();
		expect(angehoerigenhinweis(EINFACHES_MEHR)).toBeNull();
		expect(angehoerigenhinweis(null)).toBeNull();
	});

	it('misst «sicher» unter einer Klausel der Anwesenden an allen Eigentümern, nicht an den Anwesenden', () => {
		/*
		 * Codeprüfung 29.09.2026, N-1; Laien- und Fachprüfung 29.09.2026, F9
		 * und G6: Unter einer angewandten Klausel der Anwesenden misst Votum an
		 * den Anwesenden. Sicher ist die Ermächtigung aber erst mit der Mehrheit
		 * aller Eigentümer ohne den Beklagten, die Angehörigen eingeschlossen.
		 * Ein erster Entwurf nannte sie schon «sicher», wenn die Mehrheit der
		 * Anwesenden samt Angehörigen reichte: bei elf Eigentümern vier Ja statt
		 * sechs.
		 */
		const h = angehoerigenhinweis({ ...AUSSCHLUSSKLAGE, kopfbasis: 'anwesend_vertreten' })!;
		expect(h).toMatch(/Hier misst sie an den Anwesenden und Vertretenen/);
		// Keine «Bestimmung»: Die Leitung kann die Basis auch selbst wählen (Codeprüfung N-1).
		expect(h).not.toMatch(/Ihrer Bestimmung/);
		expect(h).toMatch(
			/Zählen Sie nach der Abstimmung alle Eigentümer ausser dem Beklagten, die Angehörigen mit eigener Wohnung eingeschlossen, auch wer nicht erschienen ist; gehört die Wohnung des Beklagten mehreren und richtet sich der Antrag nur gegen ihn, zählt sie dabei als eine Wohnung mit\./
		);
		expect(h).toMatch(/angreifbar, bis die Anfechtungsfrist von einem Monat ungenutzt abgelaufen ist, für Abwesende ohne Vertretung in der Regel ab Zustellung des Protokolls/);
		// Wer klagt und wann, weil der Protokolleintrag hier entsteht (Runde 2, H10 und K6).
		expect(h).toMatch(/stellen Sie es rasch und nachweisbar allen zu, auch dem Beklagten/);
		expect(h).toMatch(/wie viele Ja-Stimmen es waren, wie viele Eigentümer ohne den Beklagten es sind und ob die Ermächtigung damit sicher oder angreifbar ist/);
		expect(h).toMatch(/klagen am sichersten erst einige Wochen nach Ablauf der Frist, wenn die Bewirtschaftung bestätigt, dass keine Vorladung und keine Klage zu einer Anfechtung eingegangen ist: Ein Schlichtungsgesuch am letzten Tag genügt, die Vorladung kommt erst danach\.$/);
		// Die Schwelle als «mehr als die Hälfte», nicht «reichen» (Laien Runde 3, L5).
		expect(h).toMatch(/Hat die Anwendung den Beschluss angenommen und sind die Ja-Stimmen mehr als die Hälfte dieser Zahl, ist die Ermächtigung sicher/);
		expect(h).not.toMatch(/zur Zahl der Eigentümer hinzu/);
		expect(h).not.toMatch(/zur Zahl der anwesenden/);
		// Der Anfang bleibt derselbe Hinweis.
		expect(h).toMatch(/^Ehegatte und Verwandte des Beklagten in gerader Linie/);
		expect(h).toMatch(/Die Anwendung misst die Mehrheit ohne diese Angehörigen\. Hier misst sie/);
		// Gegenprobe: Nach Gesetz und unter «alle Eigentümer» (gelesen als alle
		// ohne den Beklagten) der Schluss über alle; unter einer Fassung vor
		// 2026-10-11 zählt die Leitung die gemeinsame Wohnung des Beklagten hinzu
		// (Laien- und Fachprüfung 30.09.2026, Stelle 6).
		const vor = { ...AUSSCHLUSSKLAGE, fassung: '2026-10-10' };
		expect(angehoerigenhinweis(vor)).toMatch(
			/Die Anwendung misst die Mehrheit ohne diese Angehörigen\. Art\. 649b Abs\. 2 nimmt aber nur den Beklagten aus der Zahl: Zählen Sie die Angehörigen mit eigener Wohnung nach der Abstimmung zur Zahl der Eigentümer hinzu, nicht zu den Ja-Stimmen, und ebenso die Wohnung des Beklagten, wenn sie mehreren gehört und sich der Antrag nur gegen ihn richtet\. Reichen die Ja-Stimmen auch gegen diese grössere Zahl, ist die Ermächtigung in diesem Punkt sicher; sonst ist sie angreifbar, und das gehört ins Protokoll: Wer nicht zugestimmt hat, kann sie beim Gericht anfechten, innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls \(ZGB Art\. 712m Abs\. 2 i\.V\.m\. Art\. 75\)\.$/
		);
		// Ab 2026-10-11 zählt die Anwendung die Wohnung selbst (Codeprüfung M4).
		const ab = angehoerigenhinweis({ ...AUSSCHLUSSKLAGE, fassung: '2026-10-11' })!;
		expect(ab).toMatch(/Die Anwendung misst die Mehrheit ohne die Angehörigen mit eigener Wohnung\. Eine Wohnung, die dem Beklagten mit anderen gehört, zählt sie selbst mit, ausser Sie haben unter «Betroffene» beim Beklagten festgehalten/);
		expect(ab).toMatch(/Dann fragen Sie nach den Angehörigen jedes Beklagten und erklären auch für sie den Ausstand; hat einer der Beklagten daneben eine eigene Wohnung/);
		expect(ab).toMatch(/Reichen die Ja-Stimmen auch gegen diese grössere Zahl, ist die Ermächtigung in diesem Punkt sicher/);
		expect(ab).not.toMatch(/ohne diese Angehörigen/);
	});

	it('nimmt die Ehefrau im Ausstand samt ihrer Vollmacht heraus, in der Handzählung', () => {
		/*
		 * A ist beklagt, B seine Ehefrau im Ausstand und bevollmächtigt von C;
		 * D und E stimmen selbst. Basis: alle ausser A und B, also C, D, E (C
		 * als abwesend, weil ihre Vertretung ruht). Nötig zwei. Zwei Hände
		 * sind das Höchste, eine dritte für C weist die Rechnung ab.
		 */
		const m = fuenf();
		const l = lage({
			momentaufnahme: m,
			erfordernis: AUSSCHLUSSKLAGE,
			betroffeneParteiIds: ['p1'],
			imAusstand: ['p2'],
			vertretungen: [{ vertreteneId: 'p3', bevollmaechtigtId: 'p2' }]
		});
		expect(() => zaehleSummenAus(l, { ja: 3, nein: 0, enthaltung: 0 })).toThrow(
			/Mehr Stimmen als Stimmberechtigte/
		);
		const a = zaehleSummenAus(l, { ja: 2, nein: 0, enthaltung: 0 });
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.nichtAnwesend).toBe(1);
		expect(a.angenommen).toBe(true);
		expect(a.hinweise.join(' ')).toMatch(/«C» war nur über B vertreten; wer im Ausstand ist/);

		// Dieselbe Lage einzeln erfasst, über dieselbe Stelle.
		const b = zaehleAus({
			...l,
			stimmen: [...stimme(m, 'p3', 'yes'), ...stimme(m, 'p4', 'yes'), ...stimme(m, 'p5', 'no')]
		});
		expect(b.koepfe.basis).toBe(3);
		expect(b.koepfe.ja).toBe(1);
		expect(b.angenommen).toBe(false);
	});

	it('lässt die Vorschau berechenbar und misst ohne den Ausgetretenen', () => {
		/*
		 * **Die Frage aus dem Auftrag, nachgemessen.** Der Ausstand nimmt die
		 * Ehefrau aus der Kopfbasis; die Vorschau erbt das aus `zaehleAus`.
		 * `nichtBerechenbar` hängt an `erfordernisluecke` und bleibt unberührt.
		 */
		const m = fuenf();
		const ohne = mehrheitsvorschau({
			momentaufnahme: m,
			erfordernis: AUSSCHLUSSKLAGE,
			anwesende: ['p1', 'p2', 'p3', 'p4', 'p5'],
			betroffeneParteiIds: ['p1']
		});
		const mit = mehrheitsvorschau({
			momentaufnahme: m,
			erfordernis: AUSSCHLUSSKLAGE,
			anwesende: ['p1', 'p2', 'p3', 'p4', 'p5'],
			betroffeneParteiIds: ['p1'],
			imAusstand: ['p2']
		});
		expect(ohne.nichtBerechenbar).toBeUndefined();
		expect(mit.nichtBerechenbar).toBeUndefined();
		expect(ohne.kopf).toEqual({ noetig: 3, von: 4 });
		expect(mit.kopf).toEqual({ noetig: 2, von: 3 });
	});
});

// ── Die Vorschau vor der Abstimmung ─────────────────────────────────────────
//
// **Was hier geprüft wird, ist eine Zusicherung, keine Anzeige.** Die Vorschau
// verspricht dem Saal eine Zahl, gegen die nachher gemessen wird. Weicht sie
// vom Ergebnis ab, ist das schlimmer, als sie gar nicht zu zeigen: Dann hat man
// abgestimmt im Vertrauen auf eine Schwelle, die nie galt.

/** Ein leerer Stimmenspiegel für Proben, die nur den Satz bauen. */
function leer() {
	return { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 0, schwelle: null, erreicht: false };
}

describe('mehrheitsvorschau', () => {
	function drei() {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [300] },
				{ name: 'Berger', quoten: [300] },
				{ name: 'Custer', quoten: [400] }
			],
			'per_owner'
		);
		return { m, anwesende: m.parties.map((p) => p.partyId) };
	}

	it('nennt die Zahl, gegen die nachher gemessen wird — Köpfe', () => {
		const { m, anwesende } = drei();
		const v = mehrheitsvorschau({ momentaufnahme: m, anwesende, erfordernis: EINFACHES_MEHR });
		const a = zaehleAus(lage({ momentaufnahme: m, anwesende, stimmen: [] }));
		expect(v.kopf).toEqual({ noetig: a.koepfe.schwelle, von: a.koepfe.basis });
		expect(v.kopf?.noetig).toBe(2);
	});

	/*
	 * **Warum die eine Zahl fällt und die andere nicht** (Bedienbarkeitsprüfung
	 * 05.09.2026, Befund 15): «Nach einem Ausstand sinkt die Kopfbasis, die
	 * Quotenbasis nicht — ohne ein Wort, warum.»
	 *
	 * Das Wort gab es, es stand nur im Ergebnis. Gefragt wird im Saal vorher,
	 * wenn die Zahlen sich vor aller Augen verschieben. Die Probe misst deshalb
	 * beides: dass die Vorschau den Satz führt, **und** dass er wörtlich
	 * derselbe ist wie im Ergebnis. Ohne die zweite Zusicherung wären es zwei
	 * Texte, die beim nächsten Rechtsstand auseinanderlaufen.
	 */
	it('erklärt in der Vorschau, warum die Wertquotenschranke stehen bleibt', () => {
		const { m, anwesende } = drei();
		const imAusstand = [m.parties[2].partyId];

		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: QUALIFIZIERTES_MEHR,
			imAusstand
		});
		expect(v.ausstandshinweis).toMatch(/Die Schranke bleibt bei/);
		expect(v.ausstandshinweis).toContain(AUSSTAND_UNGEKLAERT_KURZ);

		// Die Kopfbasis sinkt, die Quotenbasis nicht — genau der Widerspruch,
		// den der Satz erklären soll.
		const ohne = mehrheitsvorschau({ momentaufnahme: m, anwesende, erfordernis: QUALIFIZIERTES_MEHR });
		expect(v.kopf!.von).toBeLessThan(ohne.kopf!.von);
		expect(v.quoten!.von).toBe(ohne.quoten!.von);

		// Und derselbe Wortlaut wie im Ergebnis.
		const a = zaehleAus(lage({ momentaufnahme: m, stimmen: [], imAusstand, erfordernis: QUALIFIZIERTES_MEHR }));
		expect(a.hinweise).toContain(v.ausstandshinweis);
	});

	/*
	 * **Der folgenschwerste Zweig, über die Vorschau** (Code-Review 06.09.2026).
	 *
	 * «Das Erfordernis ist damit nicht mehr zu erfüllen» ist der Satz, der eine
	 * Abstimmung verhindert, bevor sie beginnt. Geprüft war er nur über
	 * `zaehleAus` — also über das Ergebnis, wo er zu spät kommt. Bei 300/300/400
	 * und 400 im Ausstand bleiben 600 erreichbar bei 501 nötigen; der Zweig lief
	 * nie. Diese Probe stellt genug Quote in den Ausstand.
	 */
	it('sagt in der Vorschau, wenn das Erfordernis nicht mehr erreichbar ist', () => {
		const { m, anwesende } = drei();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: QUALIFIZIERTES_MEHR,
			// 300 + 400 = 700 im Ausstand, erreichbar bleiben 300 bei 501 nötigen.
			imAusstand: [m.parties[0].partyId, m.parties[2].partyId]
		});
		expect(v.ausstandshinweis).toMatch(/nach dieser Rechnung ist das Erfordernis nicht mehr zu erfüllen/);
		// Seit Ä-27 ohne «gehört vor die Abstimmung»: Im Saal entscheidet niemand
		// die Rechtsfrage, und der Satz nannte keine Handlung (Laien- und
		// Fachprüfung 18.10.2026).
		expect(v.ausstandshinweis).not.toMatch(/gehört vor die Abstimmung/);
	});

	/*
	 * **Kein Name im Satz, der an die Wand geht** (AD-11,
	 * Sicherheitsdurchgang 06.09.2026).
	 *
	 * Der Wächter `check-stromnamen` prüft **Feldnamen**, nicht Inhalte. Ein
	 * `«${p.displayName}»` in `ausstandshinweis` liesse ihn grün, und der Satz
	 * steht auf der Leinwand vor dem ganzen Saal. Die Nachbarhinweise in
	 * `zaehleAus` nennen sehr wohl Namen — sie gehen ins Protokoll, nicht an die
	 * Wand —, die Verwechslung ist also einen Handgriff weit.
	 *
	 * Die Vorrichtung trägt Namen («Aebi», «Berger», «Custer»), die Probe kann
	 * also wirklich rot werden.
	 */
	it('nennt niemanden — der Satz geht an die Wand', () => {
		const { m, anwesende } = drei();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: QUALIFIZIERTES_MEHR,
			imAusstand: [m.parties[2].partyId]
		});
		expect(v.ausstandshinweis).toBeTruthy();
		for (const p of m.parties) {
			expect(v.ausstandshinweis, p.displayName).not.toContain(p.displayName);
			expect(v.ausstandshinweis, p.partyId).not.toContain(p.partyId);
		}
	});

	/*
	 * **Ob die Mehrheit mit denen im Saal erreichbar ist** (Ä-11, Block 3 der
	 * Freigabeliste, 17.10.2026). Gegen dieselbe Rechnung wie das Ergebnis:
	 * Die Zahl im Satz muss die Schranke aus `zaehleAus` sein.
	 */
	describe('Erreichbarkeit mit den Anwesenden (Ä-11)', () => {
		it('meldet unerreichbare Wertquoten aller, mit Zahlen', () => {
			const { m } = drei();
			const anwesende = [m.parties[0].partyId]; // nur Aebi, 300
			const v = mehrheitsvorschau({ momentaufnahme: m, anwesende, erfordernis: QUALIFIZIERTES_MEHR });
			const a = zaehleAus(lage({ momentaufnahme: m, anwesende, stimmen: [], erfordernis: QUALIFIZIERTES_MEHR }));
			expect(v.erreichbarkeitshinweis).toContain(
				`nötig sind ${a.quoten.schwelle} von 1000 Wertquoten, im Saal stimmberechtigt sind 300`
			);
			expect(v.erreichbarkeitshinweis).toMatch(/an allen Wertquoten der Gemeinschaft/);
			// Köpfe der Anwesenden: kein Streit, kein Satz dazu.
			expect(v.erreichbarkeitshinweis).not.toMatch(/umstritten/);
			expect(v.erreichbarkeitshinweis).toMatch(/Lassen Sie abstimmen, ist der Antrag abgelehnt\./);
			// Ob das Reglement ihn ausschliessen kann, sagt seit Fassung 2026-10-29 die Karte
			// (an den Karten mit Vereinbarung greift ein Ausschluss nach Rz. 8a kaum).
			expect(v.erreichbarkeitshinweis).toMatch(/möglich bleibt ein schriftlicher Beschluss \(Zirkulationsbeschluss\).*Ob Ihr Reglement ihn ausschliessen kann/);
			// Und tatsächlich: Selbst mit Ja des einzigen Anwesenden kein Beschluss.
			const ja = zaehleAus(
				lage({
					momentaufnahme: m,
					anwesende,
					stimmen: stimme(m, 'p1', 'yes'),
					erfordernis: QUALIFIZIERTES_MEHR
				})
			);
			expect(ja.angenommen).toBe(false);
		});

		it('meldet unerreichbare Köpfe aller', () => {
			const { m } = drei();
			const anwesende = [m.parties[0].partyId, m.parties[1].partyId];
			const v = mehrheitsvorschau({ momentaufnahme: m, anwesende, erfordernis: EINSTIMMIGKEIT });
			expect(v.erreichbarkeitshinweis).toContain(
				'nötig sind 3 von 3 Kopfstimmen, im Saal stimmen können höchstens 2'
			);
			// An der Zweckänderung ist die Zählung über alle herrschende Lehre, kein Streit
			// (Fachprüfung 22.10.2026, F9-2): keine Anfechtung in Aussicht.
			expect(v.erreichbarkeitshinweis).toMatch(/so verlangt es die herrschende Lehre \(Wermelinger, Rz\. 197 ad Art\. 712m\)/);
			expect(v.erreichbarkeitshinweis).not.toMatch(/umstritten/);
			expect(v.erreichbarkeitshinweis).not.toMatch(/angefochten/);
			expect(v.erreichbarkeitshinweis).toMatch(/Lassen Sie abstimmen, ist der Antrag abgelehnt\./);
			expect(v.erreichbarkeitshinweis).not.toMatch(/Mehrheit aller/);
			expect(v.erreichbarkeitshinweis).not.toMatch(/Ausstand/);
		});

		it('nennt den Streit um die Zählung nur an der luxuriösen Massnahme', () => {
			const { m } = drei();
			const anwesende = [m.parties[0].partyId, m.parties[1].partyId];
			const v = mehrheitsvorschau({
				momentaufnahme: m,
				anwesende,
				erfordernis: { ...EINSTIMMIGKEIT, knotenId: 'k-baulich-luxurioes' }
			});
			expect(v.erreichbarkeitshinweis).toMatch(/umstritten \(Wermelinger, Rz\. 197 ad Art\. 712m\)/);
			expect(v.erreichbarkeitshinweis).toMatch(
				/Stimmen alle Anwesenden und Vertretenen zu, verkündet Votum nach seiner strengen Lesart trotzdem eine Ablehnung/
			);
			expect(v.erreichbarkeitshinweis).toMatch(/hebt sie dann nur auf, angenommen ist der Antrag damit nicht/);
			expect(v.erreichbarkeitshinweis).toMatch(/Wer die Zustimmung aller Eigentümer hat/);
		});

		it('an den Reglementskarten mit strittiger Einstimmigkeit heisst die Bedingung qualifiziertes Mehr', () => {
			const { m } = drei();
			const anwesende = [m.parties[0].partyId, m.parties[1].partyId];
			const v = mehrheitsvorschau({
				momentaufnahme: m,
				anwesende,
				erfordernis: { ...EINSTIMMIGKEIT, knotenId: 'k-reglement-eigene-schranke' }
			});
			expect(v.erreichbarkeitshinweis).toMatch(/Ob statt der Zustimmung aller das qualifizierte Mehr genügt, ist umstritten \(Wermelinger, Rz\. 40 und 125 ad Art\. 712g; BGer 5C\.50\/2004 E\. 4\.2\)/);
			expect(v.erreichbarkeitshinweis).toMatch(/Erreicht der Beschluss das qualifizierte Mehr, verkündet Votum nach seiner strengen Lesart trotzdem eine Ablehnung/);
			// Rz. 234 und 235a: ob das Urteil nur aufhebt oder den Beschluss ersetzt, ist nicht sicher (F10-1).
			expect(v.erreichbarkeitshinweis).toMatch(/Ob das Gericht sie dann nur aufhebt oder den Beschluss an ihre Stelle setzt, ist bei einer Reglementsänderung nicht sicher/);
			expect(v.erreichbarkeitshinweis).not.toMatch(/angenommen ist der Antrag damit nicht/);
			expect(v.erreichbarkeitshinweis).not.toMatch(/Rz\. 197/);
		});

		it('schweigt, wo die Mehrheit erreichbar ist', () => {
			const { m, anwesende } = drei();
			expect(
				mehrheitsvorschau({ momentaufnahme: m, anwesende, erfordernis: QUALIFIZIERTES_MEHR })
					.erreichbarkeitshinweis
			).toBeUndefined();
			expect(
				mehrheitsvorschau({ momentaufnahme: m, anwesende: ['p1'], erfordernis: EINFACHES_MEHR })
					.erreichbarkeitshinweis
			).toBeUndefined();
		});

		/*
		 * Keine zweite, kleinere Zahl neben «erreichbar sind noch …» aus dem
		 * Ausstandssatz: Der rechnet ohne die Abwesenden.
		 */
		it('überlässt die Wertquoten dem Ausstandssatz, wenn der sie schon für unerreichbar erklärt', () => {
			const { m, anwesende } = drei();
			const v = mehrheitsvorschau({
				momentaufnahme: m,
				anwesende,
				erfordernis: QUALIFIZIERTES_MEHR,
				imAusstand: [m.parties[0].partyId, m.parties[2].partyId]
			});
			expect(v.ausstandshinweis).toMatch(/nicht mehr zu erfüllen/);
			expect(v.erreichbarkeitshinweis).toBeUndefined();
		});

		it('nennt den offenen Nenner nur, wo er das Ergebnis ändert', () => {
			const m = momentaufnahme(
				[
					{ name: 'Aebi', quoten: [250] },
					{ name: 'Berger', quoten: [250] },
					{ name: 'Custer', quoten: [100] },
					{ name: 'Dubach', quoten: [400] }
				],
				'per_owner'
			);
			// Dubach im Ausstand, Custer fehlt: 500 von 501 im Saal; ohne die 400 im
			// Nenner wären es 500 von 301.
			const v = mehrheitsvorschau({
				momentaufnahme: m,
				anwesende: ['p1', 'p2', 'p4'],
				erfordernis: QUALIFIZIERTES_MEHR,
				imAusstand: ['p4']
			});
			expect(v.erreichbarkeitshinweis).toContain('im Saal stimmberechtigt sind 500');
			expect(v.erreichbarkeitshinweis).toMatch(/Ohne die Wertquoten im Ausstand wäre das Erfordernis erreichbar\./);
			expect(v.erreichbarkeitshinweis).toMatch(
				/Erreichen die Ja-Stimmen das Mehr ohne die Wertquoten im Ausstand \(hier 301 von 600\) und trifft die andere Lesart zu/
			);
		});

		it('bietet bei der Ausschlussklage keinen Zirkulationsbeschluss an', () => {
			const satz = erreichbarkeitshinweis(
				{ ...EINFACHES_MEHR, kopfbasis: 'alle_ausser_betroffene', knotenId: 'k-ausschlussklage' },
				{
					koepfe: { ...leer(), basis: 12, schwelle: 7, ohneAbgabe: 4 },
					quoten: leer()
				},
				false
			)!;
			expect(satz).toMatch(/Stimmt die Mehrheit der Anwesenden und Vertretenen ausser den Betroffenen zu/);
			expect(satz).toMatch(/Rz\. 214 ad Art\. 712a/);
			expect(satz).not.toMatch(/Zirkulationsbeschluss/);
			expect(satz).not.toMatch(/nach dem Wortlaut/);
		});

		it('ergänzt den Ausstandssatz, wo erst die Abwesenden die Mehrheit verhindern', () => {
			const { m } = drei();
			// Custer (400) im Ausstand, Berger fehlt: Der Ausstandssatz sieht 600
			// von 501, im Saal stimmberechtigt ist nur Aebi mit 300.
			const v = mehrheitsvorschau({
				momentaufnahme: m,
				anwesende: ['p1', 'p3'],
				erfordernis: QUALIFIZIERTES_MEHR,
				imAusstand: ['p3']
			});
			expect(v.ausstandshinweis).not.toMatch(/nicht mehr zu erfüllen/);
			expect(v.erreichbarkeitshinweis).toContain('im Saal stimmberechtigt sind 300');
			expect(v.erreichbarkeitshinweis).toMatch(/Wer im Ausstand ist/);
			// Auch ohne die 400 im Ausstand reichten 300 nicht (301 von 600): die offene
			// Frage zum Nenner ändert hier nichts und bleibt weg.
			expect(v.erreichbarkeitshinweis).not.toMatch(/nicht entschieden/);
		});
	});

	it('schweigt, wo es nichts zu erklären gibt', () => {
		const { m, anwesende } = drei();
		// Kein Ausstand.
		expect(
			mehrheitsvorschau({ momentaufnahme: m, anwesende, erfordernis: QUALIFIZIERTES_MEHR })
				.ausstandshinweis
		).toBeNull();
		// Ausstand, aber keine absolute Quotenschranke.
		expect(
			mehrheitsvorschau({
				momentaufnahme: m,
				anwesende,
				erfordernis: EINFACHES_MEHR,
				imAusstand: [m.parties[2].partyId]
			}).ausstandshinweis
		).toBeNull();
		// Und ein Ausstand ohne Wertquote — der dritte Null-Fall aus der Doku,
		// der beim ersten Anlauf fehlte.
		const ohneQuote = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [500] },
				{ name: 'Berger', quoten: [500] },
				{ name: 'Custer', quoten: [] }
			],
			'per_owner'
		);
		expect(
			mehrheitsvorschau({
				momentaufnahme: ohneQuote,
				anwesende: ohneQuote.parties.map((x) => x.partyId),
				erfordernis: QUALIFIZIERTES_MEHR,
				imAusstand: [ohneQuote.parties[2].partyId]
			}).ausstandshinweis
		).toBeNull();
	});

	it('nennt die Bezugsgrösse im Klartext, nicht nur die Zahl', () => {
		const { m, anwesende } = drei();
		const anwesendeBasis = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: EINFACHES_MEHR
		});
		const alle = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: { ...EINFACHES_MEHR, kopfbasis: 'alle_eigentuemer' }
		});
		expect(anwesendeBasis.satz).toContain('Anwesenden');
		expect(alle.satz).toContain('unabhängig davon, wer erscheint');
	});

	it('rechnet «aller Eigentümer» auf alle, auch wenn nur zwei da sind', () => {
		// Der Fall aus dem Prüflauf: zwei Drittel ALLER — mit drei Anwesenden von
		// drei geht es auf, mit zweien nicht. Die Zahl muss das vorher sagen.
		const { m } = drei();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende: [m.parties[0].partyId, m.parties[1].partyId],
			erfordernis: { ...QUALIFIZIERTES_MEHR, kopfbasis: 'alle_eigentuemer' }
		});
		expect(v.kopf).toEqual({ noetig: 2, von: 3 });
	});

	it('zieht den Ausstand von der Bezugsgrösse ab — wie die Auszählung', () => {
		const { m, anwesende } = drei();
		const imAusstand = [m.parties[2].partyId];
		const v = mehrheitsvorschau({ momentaufnahme: m, anwesende, erfordernis: EINFACHES_MEHR, imAusstand });
		const a = zaehleAus(lage({ momentaufnahme: m, anwesende, stimmen: [], imAusstand }));
		expect(v.kopf?.von).toBe(a.koepfe.basis);
		expect(v.kopf?.von).toBe(2);
	});

	it('nennt beide Schwellen beim doppelten qualifizierten Mehr', () => {
		const { m, anwesende } = drei();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: {
				...QUALIFIZIERTES_MEHR,
				quotenbasis: 'alle_quoten',
				quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
			}
		});
		expect(v.quoten).not.toBeNull();
		expect(v.satz).toContain('und');
		expect(v.satz).toContain('Wertquoten');
	});

	it('bleibt stumm, wo gar nicht abgestimmt wird', () => {
		const { m, anwesende } = drei();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: { ...EINFACHES_MEHR, typ: 'keine_abstimmung', kopfSchwelle: null }
		});
		expect(v.kopf).toBeNull();
		expect(v.satz).toContain('Kenntnis');
	});

	it('markiert die Zahl als anwesenheitsabhängig — oder eben nicht', () => {
		// Der Unterschied entscheidet, ob die Zahl auf ein gedrucktes Blatt darf.
		const { m, anwesende } = drei();
		const anwesend = mehrheitsvorschau({ momentaufnahme: m, anwesende, erfordernis: EINFACHES_MEHR });
		const alle = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: { ...EINFACHES_MEHR, kopfbasis: 'alle_eigentuemer' }
		});
		expect(anwesend.anwesenheitsabhaengig).toBe(true);
		expect(alle.anwesenheitsabhaengig).toBe(false);
	});

	it('nennt die Regel auch in Worten — für alles, was gedruckt wird', () => {
		const { m, anwesende } = drei();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: {
				...QUALIFIZIERTES_MEHR,
				kopfbasis: 'alle_eigentuemer',
				// Zwei Drittel wie im Reglementsfall § 15 des Prüflaufs.
				kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' }
			}
		});
		expect(v.regelInWorten).toContain('zwei Drittel');
		expect(v.regelInWorten).toContain('aller Eigentümer');
		// Die Wortfassung enthält keine Zahl, die der Abend verschieben könnte.
		expect(v.regelInWorten).not.toMatch(/\d/);
	});

	it('wirft am Grenzfall nicht, sondern sagt, dass noch nichts feststeht', () => {
		const { m, anwesende } = drei();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: { ...EINFACHES_MEHR, typ: 'grenzfall' }
		});
		expect(v.kopf).toBeNull();
		expect(v.satz).toContain('Sitzungsleitung');
		// Der Grenzfall ist «noch keine Zahl nötig», nicht «nicht berechenbar».
		expect(v.nichtBerechenbar).toBeUndefined();
	});

	/*
	 * **Nicht berechenbar ist nicht dasselbe wie stumm** (seit 25.09.2026). Bis
	 * dahin warf `zaehleAus` hier, und jede Seite fing das selbst ab oder gar
	 * nicht: still auf `/z` und am Abend, als Fehlerseite in der Leitung eines
	 * Hauses. Beide Lagen sind erreichbar, die Freigabe prüft sie nicht.
	 */
	it('sagt ohne Kopfschwelle, dass sich die Mehrheit nicht berechnen lässt, und warum', () => {
		const { m, anwesende } = drei();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: { ...EINFACHES_MEHR, kopfSchwelle: null }
		});
		expect(v.nichtBerechenbar).toBe(true);
		expect(v.kopf).toBeNull();
		expect(v.sperrgrund).toContain('nennt keine Kopfschwelle');
		expect(v.sperrgrund).toContain('Nötige Mehrheit ändern');
		// Der Satz geht an Wand und Telefone: ohne Fachwort und ohne Anweisung
		// an die Sitzungsleitung (Code-Review 25.09.2026 zur Vorschau, Befund 2).
		expect(v.satz).toBe('Die nötige Mehrheit steht noch nicht fest; die Sitzungsleitung klärt das.');
	});

	it('sagt es auch, wenn die Zustimmung Betroffener nötig ist und niemand eingetragen', () => {
		const { m, anwesende } = drei();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true },
			betroffeneParteiIds: []
		});
		expect(v.nichtBerechenbar).toBe(true);
		expect(v.sperrgrund).toContain('eingetragen ist aber niemand');
		// Kein Rat, ein Erfordernis zu ändern, das stimmt (Code-Review 25.09.2026
		// zur Sperre, Befund 1): Der Satz nennt zuerst den Weg über das Eintragen
		// (seit Block A2), die Mehrheit nur für den Fall, dass sie nicht stimmt.
		expect(v.sperrgrund).toContain('bei «Betroffene» ein');
		expect(v.sperrgrund).toContain('Nur wenn das Erfordernis nicht stimmt');
		expect(v.satz).not.toContain('betroffen');
	});

	it('sagt dasselbe wie die Sperre beim Eröffnen, aus derselben Quelle', () => {
		const { m, anwesende } = drei();
		const e = { ...EINFACHES_MEHR, kopfSchwelle: null };
		const v = mehrheitsvorschau({ momentaufnahme: m, anwesende, erfordernis: e });
		expect(v.sperrgrund).toBe(erfordernisluecke(e, 0)?.satz);
	});

	it('sperrt bei einer Kenntnisnahme als Erfordernis, ohne sie «nicht berechenbar» zu nennen', () => {
		// Befund 2 derselben Prüfung: Ein Antrag kann eine Kenntnisnahme als
		// Erfordernis tragen; eröffnet, entstand ein Durchgang ohne Ergebnis.
		const { m, anwesende } = drei();
		const v = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: { ...EINFACHES_MEHR, typ: 'keine_abstimmung' }
		});
		expect(v.sperrgrund).toContain('Kenntnisnahme gesetzt');
		expect(v.nichtBerechenbar).toBeUndefined();
	});
});

// ── Der Satz, der ins Protokoll wandert ─────────────────────────────────────

describe('ergebnisInWorten', () => {
	function drei() {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [300] },
				{ name: 'Berger', quoten: [300] },
				{ name: 'Custer', quoten: [400] }
			],
			'per_owner'
		);
		return { m, anwesende: m.parties.map((p) => p.partyId) };
	}

	/*
	 * **Dieser Satz war bis zum 22.08.2026 ungeprüft** — und lautete
	 * «Angenommen nach Notwendige bauliche Massnahme». Er steht auf der Leinwand
	 * und zehnmal im erzeugten Protokoll; dass ihn kein Test las, ist der Grund,
	 * warum er es so lange blieb.
	 */
	it('nennt die Regel im Hauptsatz und den Fall in Klammern', () => {
		const { m, anwesende } = drei();
		const stimmen = [
			...stimme(m, m.parties[0].partyId, 'yes'),
			...stimme(m, m.parties[1].partyId, 'yes'),
			...stimme(m, m.parties[2].partyId, 'no')
		];
		const e = EINFACHES_MEHR;
		const satz = ergebnisInWorten(zaehleAus(lage({ momentaufnahme: m, anwesende, stimmen })), e);

		// Gebaut wie die Ablehnung (B2b): «mit mehr als die Hälfte» und «nötig 2. (hergeleitet» lasen sich falsch.
		expect(satz).toMatch(/^Angenommen: 2 Ja von 3 Kopfstimmen, nötig 2\. Nötig war mehr als die Hälfte/);
		expect(satz).not.toContain('Angenommen mit');
		expect(satz).not.toMatch(/\d\. \(hergeleitet/);
		/*
		 * **«2 Ja von 3»**, nicht «2 von 3» (04.09.2026, aus dem Prüfdurchgang der
		 * Eigentümersicht). Der Satz nannte die Zahl der Ja-Stimmen, ohne zu
		 * sagen, dass es die Ja-Stimmen sind, und las sich damit wie eine
		 * Beteiligungsangabe. Wer sich enthalten hatte, konnte nicht erkennen, ob
		 * die anderen dagegen waren oder gar nicht gestimmt haben.
		 */
		expect(satz).toContain('2 Ja von 3 Kopfstimmen');
		expect(satz).toContain(e.rechtsgrundlage);
		// Der alte, grammatikalisch kaputte Bau darf nicht zurückkommen.
		expect(satz).not.toContain(`nach ${e.titel}`);
	});

	it('sagt bei einer Ablehnung, was nötig gewesen wäre', () => {
		const { m, anwesende } = drei();
		const stimmen = [
			...stimme(m, m.parties[0].partyId, 'yes'),
			...stimme(m, m.parties[1].partyId, 'no'),
			...stimme(m, m.parties[2].partyId, 'no')
		];
		const satz = ergebnisInWorten(
			zaehleAus(lage({ momentaufnahme: m, anwesende, stimmen })),
			EINFACHES_MEHR
		);
		expect(satz).toMatch(/^Abgelehnt:/);
		expect(satz).toContain('Nötig war mehr als die Hälfte');
	});
});

/**
 * Die Wertung fürs Protokoll (28.08.2026).
 *
 * Sie sagt dasselbe wie `ergebnisInWorten`, aber ohne die Zahlen: Im Protokoll
 * folgt der Spiegel unmittelbar darunter, und der Leinwandsatz brachte die
 * Kopfzahlen dadurch zweimal, die Wertquoten einmal — Befund des Auftraggebers vom selben
 * Tag. Geprüft wird jeder Zweig, und in jedem, dass keine Ziffer durchkommt:
 * Genau darauf verlassen sich der Kern-, der Datenbank- und der e2e-Wächter.
 */
/**
 * **`fehlend` allein ist keine Aussage über eine gesetzliche Zustimmung**
 * (28.08.2026, aus dem Sicherheitsdurchgang zum Protokollblock).
 *
 * Eine als betroffen bezeichnete Partei, die nicht im Stimmberechtigtenstand
 * steht, landet in `betroffene.fehlend` — auch dann, wenn das angewandte
 * Erfordernis gar keine Zustimmung Betroffener verlangt. `erfuellt` bleibt
 * dabei wahr, der Antrag ist angenommen.
 *
 * Das Protokoll stützt sich deshalb auf `betroffene.noetig` und nicht auf die
 * Länge der Liste (`src/lib/server/protokoll.ts`). Wird diese Eigenschaft hier
 * je geändert, soll der Riegel dort mit auffallen.
 */
describe('Betroffenenbefund ohne Erfordernis', () => {
	it('sammelt Unbekannte auch dann, wenn keine Zustimmung verlangt ist', () => {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [500] },
				{ name: 'Berger', quoten: [500] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				betroffeneParteiIds: ['gibt-es-nicht'],
				stimmen: m.parties.flatMap((p) => stimme(m, p.partyId, 'yes'))
			})
		);
		expect(EINFACHES_MEHR.zustimmungBetroffenerNoetig).toBeFalsy();
		expect(a.betroffene.noetig).toBe(false);
		expect(a.betroffene.fehlend.length).toBe(1);
		// Und trotzdem gilt der Antrag als angenommen — deshalb wäre eine Zeile
		// «Ohne die nach ZGB Art. 712g Abs. 4 nötige Zustimmung» hier falsch.
		expect(a.betroffene.erfuellt).toBe(true);
		expect(a.angenommen).toBe(true);
	});
});

describe('ergebniswertung', () => {
	function drei() {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [300] },
				{ name: 'Berger', quoten: [300] },
				{ name: 'Custer', quoten: [400] }
			],
			'per_owner'
		);
		return { m, anwesende: m.parties.map((p) => p.partyId) };
	}

	function wertung(jaZahl: number): string {
		const { m, anwesende } = drei();
		const stimmen = m.parties.flatMap((p, i) => stimme(m, p.partyId, i < jaZahl ? 'yes' : 'no'));
		return ergebniswertung(zaehleAus(lage({ momentaufnahme: m, anwesende, stimmen })), EINFACHES_MEHR);
	}

	it('sagt bei Annahme nur, dass angenommen wurde', () => {
		expect(wertung(2)).toBe('Angenommen.');
	});

	it('nennt bei Ablehnung den Grund, ohne die Zahlen zu wiederholen', () => {
		const satz = wertung(1);
		expect(satz).toBe('Abgelehnt: die Mehrheit der Kopfstimmen fehlt.');
	});

	it('trägt in keinem Zweig eine Ziffer', () => {
		for (const ja of [0, 1, 2, 3]) expect(wertung(ja)).not.toMatch(/\d/);
	});

	/*
	 * **Die Regel gehört in den Satz, nicht in eine Zeile darunter.** Beim
	 * Verwalter führt das Protokoll eine eigene Zeile mit Person und Begründung;
	 * entscheidet nach dem Reglement die Anteilsberechtigung, gibt es niemanden
	 * einzutragen, und diese Zeile entfällt. Die erste Fassung schrieb dann nur
	 * «Angenommen durch Stichentscheid.» — ein Stichentscheid ohne die Regel, an
	 * der eine Anfechtung ansetzt.
	 */
	it('nennt die Regel, nach der ein Gleichstand aufgelöst wurde', () => {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [700] },
				{ name: 'Berger', quoten: [300] }
			],
			'per_owner'
		);
		const anwesende = m.parties.map((p) => p.partyId);
		const stimmen = [
			...stimme(m, m.parties[0].partyId, 'yes'),
			...stimme(m, m.parties[1].partyId, 'no')
		];
		const a = zaehleAus(
			lage({ momentaufnahme: { ...m, tieBreak: 'wertquote' }, anwesende, stimmen })
		);
		expect(a.durchStichentscheid).toBe(true);
		const satz = ergebniswertung(a, EINFACHES_MEHR);
		expect(satz).toContain('die Anteilsberechtigung');
		expect(satz).not.toMatch(/\d/);
	});

	/**
	 * **Kein Stichentscheid beim qualifizierten Mehr** (A1 Frage 1, Bericht
	 * `.auftraege/2026-10-29-votum-a1-rechtsfragen-bericht.md`; `quellen`
	 * Frage 73). Bis zum 30.10.2026 löste der Kern den Kopfgleichstand auch dort
	 * auf, weil die Kopfschwelle eine Hälfte ist; hier stand die Probe, die das
	 * festhielt («nennt bei einer Ablehnung trotz Stichentscheid beides»). Eine
	 * Klausel «bei Stimmengleichheit» übernimmt die gesetzliche Berechnung
	 * (Rz. 190 ad Art. 712m) und gilt am qualifizierten Mehr nur, wenn sie es
	 * ausdrücklich sagt (Rz. 194 ad Art. 712m); dafür gibt es keine Wahl.
	 */
	describe('kein Stichentscheid beim qualifizierten Mehr', () => {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [700] },
				{ name: 'Berger', quoten: [300] }
			],
			'per_owner'
		);
		const anwesende = m.parties.map((p) => p.partyId);
		const stimmen = [
			...stimme(m, m.parties[0].partyId, 'yes'),
			...stimme(m, m.parties[1].partyId, 'no')
		];

		it('weder nach Wertquoten noch durch eine Person, auch wenn die Wertquoten reichen', () => {
			for (const tieBreak of ['wertquote', 'verwalter', 'vorsitz', 'wertquote_vorsitz'] as const) {
				const a = zaehleAus(
					lage({ momentaufnahme: { ...m, tieBreak }, anwesende, stimmen, erfordernis: QUALIFIZIERTES_MEHR })
				);
				expect(a.quoten.erreicht, tieBreak).toBe(true);
				expect(a.koepfe.erreicht, tieBreak).toBe(false);
				expect(a.durchStichentscheid, tieBreak).toBe(false);
				expect(a.stichentscheidOffen, tieBreak).toBe(false);
				expect(a.angenommen, tieBreak).toBe(false);
				expect(a.hinweise.join(' '), tieBreak).not.toMatch(/Gleichstand bei den Kopfstimmen/);
				expect(ergebniswertung(a, QUALIFIZIERTES_MEHR), tieBreak).toBe(
					'Abgelehnt: die Mehrheit der Kopfstimmen fehlt.'
				);
			}
		});

		// Die Handzählung erreicht das qualifizierte Mehr nicht: `summenhindernis`
		// weist jede Wertquotenschwelle vorher ab (Codeprüfung A2, N3). Hier nur,
		// dass die Einschränkung das einfache Mehr dort nicht trifft.
		it('greift in der Handzählung beim einfachen Mehr weiter', () => {
			for (const tieBreak of ['wertquote', 'verwalter'] as const) {
				const a = zaehleSummenAus(
					lage({ momentaufnahme: { ...m, tieBreak }, anwesende, erfordernis: { ...QUALIFIZIERTES_MEHR, quotenbasis: 'keine', quotenSchwelle: null, kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } } }),
					{ ja: 1, nein: 1, enthaltung: 0 }
				);
				expect(a.stichentscheidOffen, tieBreak).toBe(true);
			}
		});

		it('und weiter beim einfachen Mehr', () => {
			const a = zaehleAus(lage({ momentaufnahme: { ...m, tieBreak: 'wertquote' }, anwesende, stimmen }));
			expect(a.durchStichentscheid).toBe(true);
			expect(a.angenommen).toBe(true);
		});
	});

	/*
	 * **«Der Antrag ist damit angenommen» nur, wenn er es ist** (Fachprüfung
	 * A1, am Code bestätigt). Beim einfachen Mehr mit Zustimmung der
	 * Betroffenen im Saal, etwa an der Zuteilung eines Nutzungsrechts unter
	 * einem milderen Mehr der Leitung, entscheidet nach dem Stichentscheid noch
	 * diese Zustimmung. Der Satz zur fehlenden Zustimmung steht daneben; vom
	 * Stichentscheid bleibt, was er entschieden hat. (`k-wertquoten-aendern`
	 * holt die Zustimmung nachher ein und ist dort zu Recht angenommen.)
	 */
	it('sagt nach dem Stichentscheid nicht «angenommen», wenn eine Zustimmung fehlt', () => {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [500] },
				{ name: 'Berger', quoten: [300] },
				{ name: 'Caduff', quoten: [200] }
			],
			'per_owner'
		);
		const stimmen = [
			...stimme(m, m.parties[0].partyId, 'yes'),
			...stimme(m, m.parties[1].partyId, 'no')
		];
		const e: Erfordernis = { ...EINFACHES_MEHR, knotenId: 'k-nutzungsrecht-zuteilung', zustimmungBetroffenerNoetig: true };
		const a = zaehleAus(
			lage({
				momentaufnahme: { ...m, tieBreak: 'wertquote' },
				anwesende: [m.parties[0].partyId, m.parties[1].partyId],
				stimmen,
				erfordernis: e,
				betroffeneParteiIds: [m.parties[2].partyId]
			})
		);
		expect(a.durchStichentscheid).toBe(true);
		expect(a.angenommen).toBe(false);
		const alle = [...a.hinweise, ...(a.protokollhinweise ?? []).map((h) => h.satz)].join(' ');
		expect(alle).toContain('entscheidet die Anteilsberechtigung');
		expect(alle).not.toMatch(/damit angenommen/);
		// Der Ergebnissatz nennt beides: den Grund und den Stichentscheid.
		const satz = ergebniswertung(a, e);
		expect(satz).toMatch(/^Abgelehnt/);
		expect(satz).toContain('die Anteilsberechtigung');

		// Gegenprobe (Votum 1 vor dem Commit): Stimmt die Betroffene zu, ist der
		// Antrag angenommen, und beide Sätze tragen den Schluss weiter.
		const mit = zaehleAus(
			lage({
				momentaufnahme: { ...m, tieBreak: 'wertquote' },
				anwesende: [m.parties[0].partyId, m.parties[1].partyId],
				stimmen,
				erfordernis: e,
				betroffeneParteiIds: [m.parties[2].partyId],
				vorabZustimmungen: [m.parties[2].partyId]
			})
		);
		expect(mit.durchStichentscheid).toBe(true);
		expect(mit.angenommen).toBe(true);
		expect(mit.hinweise.join(' ')).toMatch(/dagegen — der Antrag ist damit angenommen\./);
		expect((mit.protokollhinweise ?? []).map((h) => h.satz).join(' ')).toMatch(/dagegen\. Der Antrag ist damit angenommen\./);
	});

	it('lässt die Verwalter-Klausel nicht mehr abgelehnt erscheinen, solange der Entscheid fehlt', () => {
		/*
		 * Gegenprobe zum Stand vom 27.09. bis zum 28.09.2026: Damals war die
		 * Klausel nicht anzuwenden, und das verfehlte Mehr war eine Ablehnung.
		 * Seit dem Produktentscheid vom 28.09.2026 hält die Anwendung an, bis
		 * der Entscheid eingetragen ist.
		 */
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [500] },
				{ name: 'Berger', quoten: [500] }
			],
			'per_owner'
		);
		const anwesende = m.parties.map((p) => p.partyId);
		const stimmen = [
			...stimme(m, m.parties[0].partyId, 'yes'),
			...stimme(m, m.parties[1].partyId, 'no')
		];
		const a = zaehleAus(
			lage({ momentaufnahme: { ...m, tieBreak: 'verwalter' }, anwesende, stimmen })
		);
		expect(a.stichentscheidOffen).toBe(true);
		const wertung = ergebniswertung(a, EINFACHES_MEHR);
		expect(wertung).toContain('steht noch nicht fest');
		expect(wertung).not.toContain('Abgelehnt');
	});
});

/*
 * **Der Satz, der an vier Stellen zu unbedingt war** (Zweitprüfung 17.09.2026,
 * Ä-25). «zählt weder bei den Köpfen noch bei den Wertquoten mit» stand in
 * beiden Leitungsmeldungen, in den Hinweisen der Auswertung und im Protokoll.
 *
 * **Die erste Fassung dieser Proben mass die Zeichenkette gegen sich selbst**
 * (Code-Review 24.09.2026, Befund 7): vier Regexe über die Rückgabe derselben
 * Funktion. Ändert sich die Rechnung, bleiben sie grün. Die Probe unten fährt
 * deshalb `zaehleAus` zweimal, mit und ohne Ausstand, und misst die
 * Bezugsgrösse — denn genau das ist die Aussage, die der Satz nicht mehr
 * macht.
 */
describe('ausstandsmeldung', () => {
	it('nennt die Rechtsfolge und überlässt die Bezugsgrösse dem Erfordernis', () => {
		const satz = ausstandsmeldung(['Aebi']);
		expect(satz).toMatch(/gibt dazu keine Stimme ab/);
		expect(satz).toMatch(/ZGB Art\. 68/);
		expect(satz).toMatch(/hängt vom Erfordernis des Traktandums ab/);
	});

	it('nimmt den alten, unbedingten Satz nicht wieder auf', () => {
		const satz = ausstandsmeldung(['Aebi']);
		expect(satz).not.toMatch(/weder bei den Köpfen/);
		expect(satz).not.toMatch(/weder bei den Kopfstimmen/);
	});

	it('beugt Einzahl und Mehrzahl durchgehend', () => {
		expect(ausstandsmeldung(['Aebi'])).toMatch(/«Aebi» ist .* und gibt dazu/);
		expect(ausstandsmeldung(['Aebi', 'Berger'])).toMatch(
			/«Aebi», «Berger» sind .* und geben dazu/
		);
	});

	it('kommt ohne Namen aus, ohne führendes Leerzeichen', () => {
		// Das Protokoll kennt den Namen nicht immer.
		expect(ausstandsmeldung([])).toMatch(/^Eine Partei ist /);
	});

	/*
	 * **Der Grund, warum der Satz nichts Unbedingtes mehr sagt.** Unter
	 * `alle_quoten` kennt die Quotenbasis den Ausstand gar nicht. Ginge das
	 * verloren, wäre die alte Behauptung wieder richtig — und diese Probe rot.
	 */
	it('die Quotenbasis bleibt unter «alle_quoten» unverändert', () => {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [300] },
				{ name: 'Berger', quoten: [300] },
				{ name: 'Custer', quoten: [400] }
			],
			'per_owner'
		);
		const anwesende = m.parties.map((p) => p.partyId);
		const ohne = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: QUALIFIZIERTES_MEHR,
			imAusstand: []
		});
		const mit = mehrheitsvorschau({
			momentaufnahme: m,
			anwesende,
			erfordernis: QUALIFIZIERTES_MEHR,
			imAusstand: [m.parties[0].partyId]
		});
		expect(ohne.quoten?.von).toBe(m.totalQuota);
		expect(mit.quoten?.von).toBe(m.totalQuota);
		// Bei den Köpfen sinkt sie dagegen — auch das eine Aussage, die der Satz
		// nicht mehr pauschal macht.
		expect(mit.kopf!.von).toBeLessThan(ohne.kopf!.von);
	});
});

/*
 * **Die geheime Abstimmung** (Produktentscheide 28.09.2026, Migration 141).
 *
 * Gerechnet wird wie immer; geändert ist nur die Ausgabe. Eine Wertquotensumme
 * lässt sich in kleinen Gemeinschaften auf Einheiten zurückrechnen, deshalb
 * nennen die Sätze nur «erreicht» oder «nicht erreicht», und die Anzeigen
 * lassen den Zahlenspiegel weg.
 */
describe('Geheime Abstimmung', () => {
	const VIER = [
		{ name: 'Aebi', quoten: [250] },
		{ name: 'Bucher', quoten: [250] },
		{ name: 'Christen', quoten: [250] },
		{ name: 'Duss', quoten: [250] }
	];

	function geheimeLage(erfordernis: Erfordernis, alleJa = false) {
		const m = momentaufnahme(VIER, 'per_unit');
		return lage({
			momentaufnahme: m,
			erfordernis,
			geheim: true,
			stimmen: alleJa
				? [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'yes'),
						...stimme(m, 'p4', 'yes')
					]
				: [
						...stimme(m, 'p1', 'yes'),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'no'),
						...stimme(m, 'p4', 'no')
					]
		});
	}

	it('rechnet unverändert und trägt das Merkmal durch', () => {
		const a = zaehleAus(geheimeLage(QUALIFIZIERTES_MEHR, true));
		expect(a.geheim).toBe(true);
		expect(a.koepfe.ja).toBe(4);
		expect(a.quoten.ja).toBe(1000);
		expect(a.angenommen).toBe(true);
	});

	it('nennt auf der Leinwand nur erreicht und nicht erreicht, ohne Zahlen', () => {
		const a = zaehleAus(geheimeLage(QUALIFIZIERTES_MEHR, true));
		const satz = ergebnisInWorten(a, QUALIFIZIERTES_MEHR);
		expect(satz).toContain('Geheim abgestimmt');
		expect(satz).toContain('Kopfstimmen: erreicht');
		expect(satz).toContain('Wertquoten: erreicht');
		// Keine Zahl, aus der sich eine Einheit zurückrechnen liesse.
		expect(satz).not.toMatch(/\d/);
	});

	it('nennt bei verfehltem Mehr die Seite, die nicht erreicht ist', () => {
		const m = momentaufnahme(VIER, 'per_unit');
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: QUALIFIZIERTES_MEHR,
				geheim: true,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no'), ...stimme(m, 'p3', 'no')]
			})
		);
		const satz = ergebnisInWorten(a, QUALIFIZIERTES_MEHR);
		expect(satz).toContain('Kopfstimmen: nicht erreicht');
		expect(satz).toContain('Wertquoten: nicht erreicht');
	});

	it('sagt im Protokoll dasselbe ohne Zahlenspiegel', () => {
		const a = zaehleAus(geheimeLage(EINFACHES_MEHR, true));
		const wertung = ergebniswertung(a, EINFACHES_MEHR);
		expect(wertung).toContain('Geheim abgestimmt');
		expect(wertung).toContain('Kopfstimmen: erreicht');
		expect(wertung).not.toMatch(/\d/);
	});

	/*
	 * **Geheim zählt nur die offene Zustimmung** (Ä-38, 16.10.2026). Bis dahin
	 * hiess diese Probe «…, weil sie offen erfasst wird» und las die Zustimmung
	 * aus dem geheimen Ja; offen erfasst war sie nicht. Jetzt zählt nur der
	 * Vorab-Vermerk, und ein geheimes Nein widerruft ihn nicht.
	 */
	describe('Zustimmung der Betroffenen bei geheimer Abstimmung', () => {
		const ERF = { ...QUALIFIZIERTES_MEHR, zustimmungBetroffenerNoetig: true };
		const mitStimme = (p1: 'yes' | 'no', vorab: string[]) => {
			const m = momentaufnahme(VIER, 'per_unit');
			return zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: ERF,
					geheim: true,
					betroffeneParteiIds: ['p1'],
					vorabZustimmungen: vorab,
					stimmen: [
						...stimme(m, 'p1', p1),
						...stimme(m, 'p2', 'yes'),
						...stimme(m, 'p3', 'yes'),
						...stimme(m, 'p4', 'yes')
					]
				})
			);
		};

		it('liest sie nicht aus dem geheimen Ja', () => {
			const a = mitStimme('yes', []);
			expect(a.betroffene.erfuellt).toBe(false);
			expect(a.betroffene.fehlend).toEqual([
				expect.objectContaining({ parteiId: 'p1', grund: 'nicht_offen' })
			]);
			expect(ergebnisInWorten(a, ERF)).toContain('Zustimmung der Betroffenen: fehlt');
		});

		it('zählt den Vorab-Vermerk, auch gegen ein geheimes Nein', () => {
			const a = mitStimme('no', ['p1']);
			expect(a.betroffene.erfuellt).toBe(true);
			expect(a.betroffene.vorab).toEqual(['p1']);
			expect(ergebnisInWorten(a, ERF)).toContain('Zustimmung der Betroffenen: liegt vor');
		});

		it('behält bei Abwesenden den Grund «nicht anwesend»', () => {
			const m = momentaufnahme(VIER, 'per_unit');
			const a = zaehleAus(
				lage({
					momentaufnahme: m,
					erfordernis: ERF,
					geheim: true,
					anwesende: ['p2', 'p3', 'p4'],
					betroffeneParteiIds: ['p1'],
					stimmen: [...stimme(m, 'p2', 'yes'), ...stimme(m, 'p3', 'yes'), ...stimme(m, 'p4', 'yes')]
				})
			);
			expect(a.betroffene.fehlend).toEqual([
				expect.objectContaining({ parteiId: 'p1', grund: 'nicht_anwesend' })
			]);
		});

		it('bleibt offen beim Bisherigen: Ja zählt, Nein widerruft', () => {
			const m = momentaufnahme(VIER, 'per_unit');
			const offen = (p1: 'yes' | 'no', vorab: string[]) =>
				zaehleAus(
					lage({
						momentaufnahme: m,
						erfordernis: ERF,
						betroffeneParteiIds: ['p1'],
						vorabZustimmungen: vorab,
						stimmen: [...stimme(m, 'p1', p1), ...stimme(m, 'p2', 'yes')]
					})
				);
			expect(offen('yes', []).betroffene.fehlend).toEqual([]);
			expect(offen('no', ['p1']).betroffene.fehlend).toEqual([
				expect.objectContaining({ grund: 'widerrufen' })
			]);
		});
	});
});

/*
 * **Der Stichentscheid als Kaskade** (Auftrag 07.10.2026,
 * «votum-stichentscheid-kaskade»). Ein Reglement mit drei Einheiten zu 34, 33
 * und 33: Bei Stimmengleichheit gilt der Antrag mit dem höheren
 * Wertquotenanteil; kommt auch so keine Mehrheit zustande, entscheidet der
 * Vorsitz. Enthaltungen zählen beim einfachen Mehr nicht mit, und erst das
 * erzeugt bei drei Einheiten den Gleichstand.
 */
describe('Stichentscheid als Kaskade: erst die Wertquoten, dann die Person', () => {
	const OHNE_ENTHALTUNG: Erfordernis = { ...EINFACHES_MEHR, enthaltungZaehltMit: false };

	function lageMit(
		regel: Snapshot['tieBreak'],
		wahlen: [VoteChoice, VoteChoice, VoteChoice],
		u: {
			erfordernis?: Erfordernis;
			stichentscheid?: { wahl: 'yes' | 'no'; wer: string; eigentuemer?: boolean };
		} = {}
	) {
		const m = {
			...momentaufnahme(
				[
					{ name: 'Einheit Ost', quoten: [34] },
					{ name: 'Einheit Mitte', quoten: [33] },
					{ name: 'Einheit West', quoten: [33] }
				],
				'per_unit'
			),
			tieBreak: regel
		};
		return {
			...lage({
				momentaufnahme: m,
				erfordernis: u.erfordernis ?? OHNE_ENTHALTUNG,
				stimmen: [
					...stimme(m, 'p1', wahlen[0]),
					...stimme(m, 'p2', wahlen[1]),
					...stimme(m, 'p3', wahlen[2])
				]
			}),
			stichentscheid: u.stichentscheid
		};
	}

	it('34 Ja, 33 Nein, 33 Enthaltung: angenommen über die Wertquote', () => {
		const a = zaehleAus(lageMit('wertquote_vorsitz', ['yes', 'no', 'abstain']));
		expect(a.koepfe.basis).toBe(2);
		expect(a.angenommen).toBe(true);
		expect(a.durchStichentscheid).toBe(true);
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.stichentscheidArt).toBe('wertquote');
		expect(a.hinweise.join(' ')).toContain('entscheidet die Anteilsberechtigung');
	});

	it('33 Ja, 33 Nein, 34 Enthaltung: offen, bis die Person im Vorsitz entscheidet', () => {
		const a = zaehleAus(lageMit('wertquote_vorsitz', ['abstain', 'yes', 'no']));
		expect(a.angenommen).toBe(false);
		expect(a.stichentscheidOffen).toBe(true);
		expect(a.stichentscheidArt).toBe('vorsitz');
		expect(ergebnislage(a)).toBe('offen');
		const hinweis = a.hinweise.join(' ');
		expect(hinweis).toContain('bei den Wertquoten (33 zu 33)');
		expect(hinweis).toContain('entscheidet dann die Person im Vorsitz');
		expect(ergebnisInWorten(a, OHNE_ENTHALTUNG)).toContain('die Person im Vorsitz');
	});

	it('33 zu 33: nach dem Entscheid der Person gilt ihr Entscheid, in beide Richtungen', () => {
		const ja = zaehleAus(
			lageMit('wertquote_vorsitz', ['abstain', 'yes', 'no'], {
				stichentscheid: { wahl: 'yes', wer: 'Vorsitz Probe' }
			})
		);
		expect(ja.angenommen).toBe(true);
		expect(ja.durchStichentscheid).toBe(true);
		expect(ja.stichentscheidArt).toBe('vorsitz');
		expect(ja.hinweise.join(' ')).toContain('hat Vorsitz Probe im Vorsitz für Annahme entschieden');
		expect(ergebniswertung(ja, OHNE_ENTHALTUNG)).toContain('die Person im Vorsitz');

		const nein = zaehleAus(
			lageMit('wertquote_vorsitz', ['abstain', 'yes', 'no'], {
				stichentscheid: { wahl: 'no', wer: 'Vorsitz Probe' }
			})
		);
		expect(nein.angenommen).toBe(false);
		expect(nein.durchStichentscheid).toBe(true);
		expect(ergebnislage(nein)).toBe('abgelehnt');
	});

	it('dasselbe, Vorsitz ist eine Eigentümerin: zweite Stimme eingetragen, Ergebnis nach ihr', () => {
		// Die zweite Stimme geht nicht in die Zählung ein (Fachprüfung F3): Bei
		// drei Einheiten stünde sonst «2 zu 1» da und sähe aus wie ein Zählfehler.
		const a = zaehleAus(
			lageMit('wertquote_vorsitz', ['abstain', 'yes', 'no'], {
				stichentscheid: { wahl: 'no', wer: 'Vorsitz Probe', eigentuemer: true }
			})
		);
		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.nein).toBe(1);
		expect(a.angenommen).toBe(false);
		expect(a.durchStichentscheid).toBe(true);
		expect(ergebnislage(a)).toBe('abgelehnt');
		const hinweis = a.hinweise.join(' ');
		expect(hinweis).toContain('im Vorsitz, selbst Stockwerkeigentümer, gegen den Antrag');
		expect(hinweis).toContain('der Stichentscheid ist darin nicht enthalten');
		// Die Kaskade nennt im Ergebnissatz auch die gleichen Wertquoten (L9).
		expect(a.wertquotenGleich).toEqual({ ja: 33, nein: 33 });
		expect(ergebniswertung(a, OHNE_ENTHALTUNG)).toContain('und gleichen Wertquoten (33 zu 33)');
	});

	it('offen beim Vorsitz: keine Empfehlung für eine Eigentümerin, Ablehnung für eine Person ohne Eigentum', () => {
		const hinweis = zaehleAus(lageMit('vorsitz', ['yes', 'no', 'abstain'])).hinweise.join(' ');
		expect(hinweis).toContain('Votum gibt ihr keine Richtung vor');
		expect(hinweis).toContain('Ist sie es nicht, empfiehlt Votum die Ablehnung');
		expect(hinweis).toContain('Rz. 76a ad Art. 712n');
		expect(hinweis).toContain('ob jemand widerspricht');
		expect(hinweis).not.toContain('umstritten');
		// S10, F4a (E5; Runde 3, T5): als Rüge mit Uhrzeit, auch am gemeinsamen Abend, nicht im Protokolltext.
		expect(hinweis).toContain(`${WIDERSPRUCH_FRAGEN} ${WIDERSPRUCH_FESTHALTEN} ${WIDERSPRUCH_FOLGE_SCHWEIGEN}`);
		expect(WIDERSPRUCH_FESTHALTEN).toContain('mit Name und Uhrzeit als Rüge fest, am Traktandum unter «Rüge festhalten»');
		expect(WIDERSPRUCH_FESTHALTEN).toContain('Am gemeinsamen Abend tun Sie das auf der Leitungsseite des Hauses, erreichbar unter «Es tagen mit»');
		expect(hinweis).not.toContain('Widersprüche mit Namen im Protokolltext');
	});

	it('mit dem Verwalter als zweiter Stufe: derselbe Weg, ein anderer Name', () => {
		const a = zaehleAus(lageMit('wertquote_verwalter', ['abstain', 'yes', 'no']));
		expect(a.stichentscheidOffen).toBe(true);
		expect(a.stichentscheidArt).toBe('verwalter');
		expect(a.hinweise.join(' ')).toContain('entscheidet dann der Verwalter');
	});

	it('Enthaltungen zählen mit: abgelehnt, kein Gleichstand', () => {
		const a = zaehleAus(
			lageMit('wertquote_vorsitz', ['abstain', 'yes', 'no'], { erfordernis: EINFACHES_MEHR })
		);
		expect(a.koepfe.basis).toBe(3);
		expect(a.angenommen).toBe(false);
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.durchStichentscheid).toBe(false);
		expect(ergebnislage(a)).toBe('abgelehnt');
	});

	it('Regel nur «wertquote», 33 zu 33: abgelehnt wie bisher', () => {
		const a = zaehleAus(lageMit('wertquote', ['abstain', 'yes', 'no']));
		expect(a.angenommen).toBe(false);
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.durchStichentscheid).toBe(false);
		expect(ergebnislage(a)).toBe('abgelehnt');
		expect(a.hinweise.join(' ')).toContain('auch dort führt der Antrag nicht');
	});

	it('die Person allein, ohne Wertquoten davor: entscheidet schon beim Kopfgleichstand', () => {
		const a = zaehleAus(lageMit('vorsitz', ['yes', 'no', 'abstain']));
		expect(a.stichentscheidOffen).toBe(true);
		expect(a.stichentscheidArt).toBe('vorsitz');
		expect(a.hinweise.join(' ')).not.toContain('bei den Wertquoten');
	});

	it('bei einer Handzählung bleibt die Kaskade bei den Wertquoten stehen', () => {
		// Ob die Wertquoten auflösen oder weitergeben, lässt sich aus den Summen
		// nicht ablesen. Die Person darf nicht vor den Quoten entscheiden.
		const m = {
			...momentaufnahme(
				[
					{ name: 'Einheit Ost', quoten: [34] },
					{ name: 'Einheit Mitte', quoten: [33] },
					{ name: 'Einheit West', quoten: [33] }
				],
				'per_unit'
			),
			tieBreak: 'wertquote_vorsitz' as const
		};
		const a = zaehleSummenAus(
			{ ...lage({ momentaufnahme: m, erfordernis: OHNE_ENTHALTUNG }) },
			{ ja: 1, nein: 1, enthaltung: 1 }
		);
		expect(a.stichentscheidOffen).toBe(true);
		expect(a.stichentscheidArt).toBe('wertquote');
	});
});

/*
 * **Enthaltungen beim einfachen Mehr, eine Einstellung der Gemeinschaft**
 * (Auftrag 07.10.2026, «votum-enthaltung-einfaches-mehr»). Dieselben drei
 * Einheiten zu 34, 33 und 33 wie bei der Kaskade, aber das Erfordernis kommt
 * hier über `wendeReglementAn` aus der geltenden Fassung, wie an jedem
 * Traktandum: Geprüft wird der Weg von der Einstellung bis zur Zählung, nicht
 * ein von Hand gesetztes `enthaltungZaehltMit`.
 */
describe('Enthaltungen beim einfachen Mehr als Einstellung der Gemeinschaft', () => {
	const RW = holeRegelwerk();
	const EINSTELLUNG = { fundstelle: 'Art. 33 Abs. 1 Reglement' };
	const herleiten = (knoten: string, regeln: Reglementsregel[] = [], einstellung = EINSTELLUNG) =>
		wendeReglementAn(waehleErfordernis(RW, knoten).ergebnis!, regeln, einstellung, LESARTEN_VORGABE);

	function zaehle(erfordernis: Erfordernis, regel: Snapshot['tieBreak'] = 'keiner') {
		const m = {
			...momentaufnahme(
				[
					{ name: 'Einheit Ost', quoten: [34] },
					{ name: 'Einheit Mitte', quoten: [33] },
					{ name: 'Einheit West', quoten: [33] }
				],
				'per_unit'
			),
			tieBreak: regel
		};
		return zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no'), ...stimme(m, 'p3', 'abstain')]
			})
		);
	}

	it('1 Ja, 1 Nein, 1 Enthaltung beim einfachen Mehr: Gleichstand auf der Basis 2', () => {
		const a = herleiten('k-verwaltung-gewoehnlich');
		expect(a.enthaltung).toMatchObject({ fundstelle: 'Art. 33 Abs. 1 Reglement', angewandt: true });
		expect(a.erfordernis.enthaltungZaehltMit).toBe(false);
		expect(a.erfordernis.rechtsgrundlage).toContain('Art. 33 Abs. 1 Reglement');

		const ohneRegel = zaehle(a.erfordernis);
		expect(ohneRegel.koepfe.basis).toBe(2);
		expect(ohneRegel.koepfe.ja).toBe(1);
		expect(ohneRegel.koepfe.nein).toBe(1);
		expect(ohneRegel.angenommen).toBe(false);

		// Dass es ein Gleichstand ist und kein verfehltes Mehr, zeigt die Regel
		// dafür: Mit ihr entscheidet die grössere Wertquote, hier das Ja mit 34.
		const mitRegel = zaehle(a.erfordernis, 'wertquote');
		expect(mitRegel.durchStichentscheid).toBe(true);
		expect(mitRegel.angenommen).toBe(true);
	});

	it('dasselbe ohne Einstellung: abgelehnt auf der Basis 3, kein Gleichstand', () => {
		const a = wendeReglementAn(waehleErfordernis(RW, 'k-verwaltung-gewoehnlich').ergebnis!, [], null, LESARTEN_VORGABE);
		expect(a.enthaltung).toBeUndefined();
		const z = zaehle(a.erfordernis, 'wertquote');
		expect(z.koepfe.basis).toBe(3);
		expect(z.angenommen).toBe(false);
		expect(z.durchStichentscheid).toBe(false);
	});

	it('beim qualifizierten Mehr zählt die Enthaltung mit', () => {
		const a = herleiten('k-baulich-nuetzlich');
		expect(a.erfordernis.typ).toBe('qualifiziertes_mehr');
		// Nicht angewandt, aber auf der Karte genannt, mit der Ansage im Saal.
		expect(a.enthaltung?.angewandt).toBe(false);
		const text = karteMitEnthaltung({ stimmwirkung: [] } as never, a.enthaltung).stimmwirkung.join(' ');
		expect(text).toContain('nur beim einfachen Mehr der Anwesenden');
		expect(text).toContain('Sagen Sie das vor der Abstimmung an');
		expect(a.erfordernis.enthaltungZaehltMit).not.toBe(false);
		// Der Knoten verlangt die Zustimmung bezeichneter Betroffener; die gehört
		// nicht zur Frage und würde ohne Bezeichnung die Zählung abweisen.
		const z = zaehle({ ...a.erfordernis, zustimmungBetroffenerNoetig: false });
		expect(z.koepfe.basis).toBe(3);
	});

	it('eine Reglementsregel für die Geschäftsart geht vor', () => {
		const regel: Reglementsregel = {
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: 'verwaltung_gewoehnlich',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: '§ 12 Reglement',
			enthaltungZaehltMit: true
		};
		const a = herleiten('k-verwaltung-gewoehnlich', [regel]);
		expect(a.regel?.fundstelle).toBe('§ 12 Reglement');
		expect(a.enthaltung).toMatchObject({ angewandt: false, durchRegel: '§ 12 Reglement' });
		expect(a.erfordernis.enthaltungZaehltMit).toBe(true);
		expect(zaehle(a.erfordernis).koepfe.basis).toBe(3);
	});

	// Codeprüfung 07.10.2026, Befund 4: Wird die Regel der Geschäftsart wegen eines
	// Vorbehalts nicht angewandt, bleibt ihre Angabe zur Enthaltung trotzdem die
	// genauere Aussage des Reglements.
	it('eine nicht angewandte Regel mit «zählt mit» hält die Einstellung auf', () => {
		const regel = (enthaltungZaehltMit: boolean): Reglementsregel => ({
			id: 'r2',
			stwegId: 's1',
			geschaeftsart: 'baulich_notwendig',
			// Seit 2026-10-15 hält die notwendige Massnahme nur noch eine
			// Einstimmigkeitsregel auf; die taugt deshalb als Regel mit Vorbehalt.
			kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' },
			kopfbasis: 'alle_eigentuemer',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: '§ 20 Reglement',
			enthaltungZaehltMit
		});
		const mit = herleiten('k-baulich-notwendig', [regel(true)]);
		expect(mit.vorbehalt).toBe('einstimmigkeit_ausgeschlossen');
		expect(mit.erfordernis.enthaltungZaehltMit).not.toBe(false);
		// Nicht stumm (zweiter Durchgang der Codeprüfung): Die Karte nennt die Regel.
		expect(mit.enthaltung).toMatchObject({ angewandt: false, durchRegel: '§ 20 Reglement' });
		expect(
			karteMitEnthaltung({ stimmwirkung: [] } as never, mit.enthaltung).stimmwirkung.join(' ')
		).toContain('Sagen Sie das vor der Abstimmung an');
		const ohne = herleiten('k-baulich-notwendig', [regel(false)]);
		expect(ohne.vorbehalt).toBe('einstimmigkeit_ausgeschlossen');
		expect(ohne.erfordernis.enthaltungZaehltMit).toBe(false);
	});

	it('die Beschlussfähigkeit bleibt: wer sich enthält, ist anwesend und gezählt', () => {
		const z = zaehle(herleiten('k-verwaltung-gewoehnlich').erfordernis);
		expect(z.koepfe.enthaltung).toBe(1);
		expect(z.koepfe.nichtAnwesend).toBe(0);
		expect(z.koepfe.ohneAbgabe).toBe(0);
	});

	it('Wahlen sind mitgemeint', () => {
		expect(herleiten('k-organ-waehlen').erfordernis.enthaltungZaehltMit).toBe(false);
		expect(herleiten('k-bewirtschaftung-waehlen').erfordernis.enthaltungZaehltMit).toBe(false);
	});

	// Fachprüfung 07.10.2026, F1: je Geschäft verschieden.
	it('bei Abberufung und Wertquotenänderung greift sie nicht, und die Karte sagt warum', () => {
		for (const knoten of ['k-bewirtschaftung-abberufen', 'k-wertquoten-aendern']) {
			const a = herleiten(knoten);
			expect(a.erfordernis.enthaltungZaehltMit, knoten).not.toBe(false);
			expect(a.enthaltung?.angewandt, knoten).toBe(false);
		}
		const karte = (knoten: string) =>
			karteMitEnthaltung({ stimmwirkung: ['Satz zum Gesetz'] } as never, herleiten(knoten).enthaltung)
				.stimmwirkung.join(' ');
		expect(karte('k-bewirtschaftung-abberufen')).toContain('Rz. 64 ad Art. 712g');
		expect(karte('k-wertquoten-aendern')).toContain('Rz. 86 f. ad Art. 712e');
		for (const knoten of ['k-bewirtschaftung-abberufen', 'k-wertquoten-aendern']) {
			expect(karte(knoten)).toContain('Votum zählt Enthaltungen hier mit');
			expect(karte(knoten)).toContain('Sagen Sie das vor der Abstimmung an');
		}
	});

	it('bei der notwendigen baulichen Massnahme greift sie, mit dem Lehrstreit auf der Karte', () => {
		const a = herleiten('k-baulich-notwendig');
		expect(a.erfordernis.enthaltungZaehltMit).toBe(false);
		expect(a.enthaltung?.angewandt).toBe(true);
		const karte = karteMitEnthaltung(
			{ stimmwirkung: [], reglementsvorbehalt: 'Kasten zum Reglement.' } as never,
			a.enthaltung
		);
		expect(karte.stimmwirkung.join(' ')).toContain('Rz. 36 ad Art. 712g');
		expect(karte.stimmwirkung.join(' ')).not.toContain('voraussetzt');
		// Seit 2026-10-15 trägt die Karte `vereinbart` und wendet Regeln an; der
		// Ausnahmesatz zur alten Sperre entfällt, der allgemeine steht.
		// Mit der Bedingung (Fachprüfung nach dem Bau, A7).
		expect(karte.reglementsvorbehalt).toContain('war beim Setzen des Hakens');
		// Nur hier erreicht die Einstellung den Zweig `vereinbart`; die
		// Erleichterung ist umstritten, also keine hinreichende Bedingung
		// (Codeprüfung 07.10.2026), und die Frist statt «nie angefochten».
		expect(karte.reglementsvorbehalt).toContain('Rechtmässig eingeführt ist sie nur');
		expect(karte.reglementsvorbehalt).not.toMatch(/Sicher gilt sie/);
		expect(karte.reglementsvorbehalt).toContain('nicht innert Frist angefochten');
		expect(karte.reglementsvorbehalt).toContain('zweite, umstrittene Frage');
		expect(karte.reglementsvorbehalt).toContain('solange die Versammlung nicht eröffnet ist');
	});

	it('die Leitung wählt das qualifizierte Mehr: die Einstellung fährt nicht mit', () => {
		const vorschlag = herleiten('k-verwaltung-gewoehnlich');
		const gewaehlt = { ...vorschlag.erfordernis, typ: 'qualifiziertes_mehr' as const, rechtsgrundlage: '' };
		const e = enthaltungNachWahl(gewaehlt, vorschlag, EINSTELLUNG);
		expect(e.enthaltungZaehltMit).toBeUndefined();
		expect(e.rechtsgrundlage).toBe('');

		// Wählt sie wieder ein einfaches Mehr, gilt die Einstellung, mit eigenem Satz.
		const einfach = enthaltungNachWahl({ ...gewaehlt, typ: 'einfaches_mehr' }, vorschlag, EINSTELLUNG);
		expect(einfach.enthaltungZaehltMit).toBe(false);
		expect(einfach.rechtsgrundlage).toMatch(/^Enthaltungen nach dem Reglement/);
	});
});

/*
 * Die Vermerke fürs Protokoll (Fachprüfung 08.10.2026,
 * `quellen/pruefung/berichte/2026-10-08-votum-protokoll-hinweise-fach.md`):
 * eigene Fassung ohne Fundstellen und Bedienungsanweisungen, geordnet nach
 * Bezugsgrösse und Ausgang. Die Anzeige-Hinweise bleiben daneben bestehen.
 */
describe('Protokollhinweise', () => {
	function satz(a: { protokollhinweise?: { ort: string; satz: string }[] }, ort: string): string {
		return (a.protokollhinweise ?? []).filter((h) => h.ort === ort).map((h) => h.satz).join(' ');
	}

	it('ruhende Vertretung: Feststellung ohne Fundstelle und ohne «wie eine abwesende»', () => {
		const m = momentaufnahme(
			[
				{ name: 'Nirgendweg 7', quoten: [250] },
				{ name: 'Ursula Beispiel', quoten: [250] },
				{ name: 'Dritte', quoten: [250] },
				{ name: 'Vierte', quoten: [250] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p3', 'yes'), ...stimme(m, 'p4', 'no')],
				imAusstand: ['p2'],
				vertretungen: [{ vertreteneId: 'p1', bevollmaechtigtId: 'p2' }]
			})
		);
		const protokoll = satz(a, 'bezugsgroesse');
		expect(protokoll).toContain('«Nirgendweg 7» war nur über Ursula Beispiel vertreten');
		expect(protokoll).toContain('Ursula Beispiel durfte bei diesem Traktandum niemanden vertreten');
		expect(protokoll).toContain('konnte hier keine Stimme abgeben');
		expect(protokoll).toContain('Bei den übrigen Traktanden übt dieselbe Vollmacht wieder aus');
		expect(protokoll).not.toMatch(/BGE|Rz\.|wie eine abwesende|wie abwesende/);
	});

	it('Beklagter unter einer anderen Bezugsgrösse, mit Art. 649b Abs. 2', () => {
		const m = momentaufnahme(
			[
				{ name: 'Anna Muster', quoten: [500] },
				{ name: 'Berta', quoten: [250] },
				{ name: 'Cleo', quoten: [250] }
			],
			'per_owner'
		);
		const anwesende = { ...EINFACHES_MEHR, knotenId: 'k-ausschlussklage' };
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: anwesende,
				betroffeneParteiIds: ['p1'],
				stimmen: [...stimme(m, 'p2', 'yes'), ...stimme(m, 'p3', 'yes')]
			})
		);
		const protokoll = satz(a, 'bezugsgroesse');
		expect(protokoll).toContain(
			'«Anna Muster» ist als beklagte Partei bezeichnet und zählte bei diesem Traktandum nicht mit ' +
				'(Art. 649b Abs. 2 ZGB).'
		);
	});

	it('Lesart bei Einstimmigkeit mit Ausstand, ohne Quellen, mit Schlusssatz', () => {
		const m = momentaufnahme(
			[
				{ name: 'Eins', quoten: [500] },
				{ name: 'Zwei', quoten: [500] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: EINSTIMMIGKEIT,
				stimmen: [stimme(m, 'p1', 'yes')[0]],
				imAusstand: ['p2']
			})
		);
		const protokoll = satz(a, 'bezugsgroesse');
		expect(protokoll).toContain('Gerechnet wurde ohne die Ausgetretenen');
		expect(protokoll).toContain('Die Gegenlesart stellt auf sämtliche im Grundbuch aufgeführten Eigentümer ab');
		expect(protokoll).toContain('Die Frage ist nicht entschieden.');
		expect(protokoll).not.toMatch(/Beobachter|WISS/);
	});

	it('eine erfasste Stimme, die nicht zählt: als Fussnote, ohne Regeln', () => {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [400] },
				{ name: 'Bucher', quoten: [300] },
				{ name: 'Christen', quoten: [300] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'yes')],
				imAusstand: ['p1'],
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);
		const protokoll = satz(a, 'ausgang');
		expect(protokoll).toContain('liegt eine Stimme vor, die Aebi abgegeben hat');
		expect(protokoll).toContain('Sie ist bei diesem Traktandum nicht gezählt.');
	});

	it('uneinheitliche Stimmabgabe als Fussnote zur Bezugsgrösse', () => {
		const m = momentaufnahme([{ name: 'Villa', quoten: [400, 600] }], 'per_owner');
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [einheitsstimme('p1', 'p1-u1', 'yes'), einheitsstimme('p1', 'p1-u2', 'no')]
			})
		);
		const protokoll = satz(a, 'bezugsgroesse');
		expect(protokoll).toContain('«Villa» hat je Einheit verschieden gestimmt');
		expect(protokoll).toContain('die Wertquoten sind aufgeteilt gezählt');
	});

	it('Stichentscheid nach Wertquoten nennt die Zahlen im Protokoll', () => {
		const m = {
			...momentaufnahme(
				[
					{ name: 'Ost', quoten: [320] },
					{ name: 'Mitte', quoten: [340] },
					{ name: 'West', quoten: [340] }
				],
				'per_owner'
			),
			tieBreak: 'wertquote' as const
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				anwesende: ['p1', 'p2'],
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no')]
			})
		);
		expect(a.angenommen).toBe(false);
		const protokoll = satz(a, 'ausgang');
		expect(protokoll).toContain('Gleichstand bei den Kopfstimmen (1 zu 1)');
		expect(protokoll).toContain('entscheidet die Anteilsberechtigung: 320 Wertquoten dafür, 340 dagegen');
		expect(protokoll).toContain('Auch dort führt der Antrag nicht.');
	});

	/*
	 * Bei geheimer Abstimmung ohne Zahlen und ohne Stimmverhalten (Ä-38,
	 * Codeprüfung und Sicherheitsprüfung 16.10.2026).
	 */
	it('Stichentscheid nach Wertquoten nennt bei geheimer Abstimmung keine Zahlen', () => {
		const m = {
			...momentaufnahme(
				[
					{ name: 'Ost', quoten: [320] },
					{ name: 'Mitte', quoten: [340] },
					{ name: 'West', quoten: [340] }
				],
				'per_owner'
			),
			tieBreak: 'wertquote' as const
		};
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				anwesende: ['p1', 'p2'],
				geheim: true,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no')]
			})
		);
		const protokoll = satz(a, 'ausgang');
		expect(protokoll).toContain('entscheidet die Anteilsberechtigung. Auch dort führt der Antrag nicht.');
		expect(protokoll).not.toMatch(/\d/);
	});

	it('uneinheitliche Stimmabgabe steht bei geheimer Abstimmung nicht im Protokoll', () => {
		const m = momentaufnahme([{ name: 'Villa', quoten: [400, 600] }], 'per_owner');
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				geheim: true,
				stimmen: [einheitsstimme('p1', 'p1-u1', 'yes'), einheitsstimme('p1', 'p1-u2', 'no')]
			})
		);
		expect(satz(a, 'bezugsgroesse')).not.toContain('verschieden gestimmt');
	});

	it('die Ausstandsmeldung als Feststellung mit Norm', () => {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [500] },
				{ name: 'Bucher', quoten: [500] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				stimmen: [stimme(m, 'p1', 'yes')[0]],
				imAusstand: ['p2']
			})
		);
		// Die Meldung trägt das Protokoll über die Vorgänge; `ausstandswirkung`
		// trägt die Schranke in der Protokollfassung.
		expect(ausstandProtokollInWorten(['Bucher'])).toBe(
			'«Bucher» ist bei diesem Traktandum in den Ausstand getreten und hat dazu keine Stimme ' +
				'abgegeben (Art. 68 i.V.m. Art. 712m Abs. 2 ZGB).'
		);
		expect(ausstandProtokollInWorten(['Bucher'], false)).not.toContain('«');
		// Ohne den Überleitungssatz der Anzeige.
		expect(ausstandProtokollInWorten(['Bucher'])).not.toContain('hängt vom Erfordernis');
	});

	it('die Schranke des Ausstands als Feststellung, ohne die Frage an die Leitung', () => {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [500] },
				{ name: 'Bucher', quoten: [500] }
			],
			'per_owner'
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: QUALIFIZIERTES_MEHR,
				stimmen: [stimme(m, 'p1', 'yes')[0]],
				imAusstand: ['p2']
			})
		);
		expect(a.ausstandswirkung).toContain('Im Ausstand stehen 500 Wertquoten');
		expect(a.ausstandswirkung).toContain(AUSSTAND_UNGEKLAERT);
		expect(a.ausstandswirkung).toContain('nach dieser Rechnung ist das Erfordernis nicht mehr zu erfüllen.');
		expect(a.ausstandswirkung).not.toContain('gehört vor die Abstimmung');
	});

	it('die Differenz der erfassten Wertquoten als Fussnote zur Bezugsgrösse', () => {
		const m = momentaufnahme(
			[
				{ name: 'Ost', quoten: [500] },
				{ name: 'West', quoten: [500] }
			],
			'per_owner',
			1100
		);
		const a = zaehleAus(
			lage({
				momentaufnahme: m,
				erfordernis: QUALIFIZIERTES_MEHR,
				stimmen: [...stimme(m, 'p1', 'yes'), ...stimme(m, 'p2', 'no')]
			})
		);
		const protokoll = satz(a, 'bezugsgroesse');
		expect(protokoll).toContain('Die erfassten Wertquoten ergeben 1000, die Gesamtquote der Gemeinschaft ist 1100');
		expect(protokoll).toContain('Die Differenz von 100 kann keine Zustimmung geben.');
	});
});

/*
 * **Ein Vertreter ohne Eigentum im Ausstand ist keine Partei** (Ä-26,
 * Codeprüfung 17.10.2026, M1 bis M3). Seine Kennung steht in `imAusstand`,
 * damit seine Vollmachten ruhen; Sätze über «Parteien im Ausstand» und die
 * Lesart der Einstimmigkeit dürfen ihn nicht zählen.
 */
describe('Vertreter ohne Eigentum im Ausstand (Ä-26)', () => {
	const KENNUNG = 'vertreter:prüfverwaltung ag';
	function lageMitVertreter(erfordernis: Erfordernis) {
		const m = momentaufnahme(
			[
				{ name: 'Aebi', quoten: [300] },
				{ name: 'Bucher', quoten: [300] },
				{ name: 'Custer', quoten: [400] }
			],
			'per_owner'
		);
		return {
			momentaufnahme: m,
			erfordernis,
			anwesende: m.parties.map((p) => p.partyId),
			vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: KENNUNG, bevollmaechtigtName: 'Prüfverwaltung AG' }],
			imAusstand: [KENNUNG]
		};
	}

	it('lässt die Vollmacht ruhen und nennt den Vertreter beim Namen', () => {
		const a = zaehleAus({ ...lageMitVertreter(EINFACHES_MEHR), stimmen: [] });
		expect(a.ohneZustimmung.find((f) => f.name === 'Bucher')?.grund).toBe('vertretung_ruht');
		expect(a.hinweise.join(' ')).toContain('nur über Prüfverwaltung AG vertreten');
		expect(a.hinweise.join(' ')).not.toContain(KENNUNG);
	});

	it('spricht von keiner Partei im Ausstand und von keiner Lesart der Einstimmigkeit', () => {
		const a = zaehleAus({ ...lageMitVertreter(EINSTIMMIGKEIT), stimmen: [] });
		const alles = [...a.hinweise, ...(a.protokollhinweise ?? []).map((h) => h.satz)].join(' ');
		expect(alles).not.toMatch(/Ausstand(s)? von \d+ Partei/);
		expect(alles).not.toContain('Gerechnet wurde ohne die Ausgetretenen');
	});

	it('zählt bei der Handzählung keine Partei im Ausstand', () => {
		const a = zaehleSummenAus(lageMitVertreter(EINFACHES_MEHR), { ja: 1, nein: 0, enthaltung: 0 });
		expect([...a.hinweise, ...(a.protokollhinweise ?? []).map((h) => h.satz)].join(' ')).not.toMatch(
			/Partei(en)? (steht|stehen) im Ausstand/
		);
	});
});
