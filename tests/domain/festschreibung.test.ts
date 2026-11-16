/**
 * Die festgeschriebene Auszählung (seit 25.09.2026, Produktentscheid:
 * «nach jeder Abstimmung [soll] das bereits abgestimmte nicht mehr verändert
 * werden können»).
 *
 * **Warum eine Hülle von heute als Literal in dieser Datei steht.** Ein
 * verkündetes Ergebnis wird mit dem Code von morgen gelesen. Bekommt die
 * Auszählung ein Feld, fehlt es jedem Ergebnis, das vorher festgeschrieben
 * wurde, und ein Verbraucher, der es voraussetzt, bricht an einem alten
 * Protokoll. Die Probe unten vergleicht die Schlüssel einer frischen
 * Auszählung mit denen der alten Hülle, gelesen über `ausFestschreibung`. Wird
 * sie rot, gehört in `ausFestschreibung` ein Ersatzwert für das neue Feld, mit
 * Datum und dem Wert, der für ein Ergebnis von vorher zutrifft. **Das Literal
 * wird dabei nicht angepasst**; es ist der Bestand, den es zu lesen gilt.
 * Kommt ein Format 2, bekommt es ein eigenes Literal daneben.
 *
 * **Die Reichweite** (Code-Review 25.09.2026): Sicher gefunden wird ein neues
 * Pflichtfeld, weil es in jeder frischen Auszählung steht. Ein neues
 * optionales Feld nur, wenn eine der beiden Lagen unten es setzt; dafür
 * verlangt der Typ vom Verbraucher, dass er mit seinem Fehlen umgehen kann.
 *
 * Die Texte im Literal sind gekürzt. Geprüft wird die Form, nicht der Wortlaut.
 */
import { describe, expect, it } from 'vitest';
import { andereLesartenVon, zaehleAus, zaehleSummenAus } from '$lib/domain/auszaehlung';
import { ausFestschreibung, festschreibung, FESTSCHREIBUNGSFORMAT } from '$lib/domain/festschreibung';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Snapshot, Vote } from '$lib/domain/types';

const MOMENTAUFNAHME: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-09-25T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: true,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: ['Erdbeer', 'Himbeer', 'Stachelbeer', 'Holunder', 'Betroffene'].map((name, i) => ({
		partyId: `p${i + 1}`,
		displayName: name,
		representativeName: null,
		isCommunity: false,
		units: [
			{
				unitId: `p${i + 1}-u1`,
				label: name,
				kind: 'unit' as const,
				countsAsHead: true,
				quota: [300, 250, 200, 150, 100][i]
			}
		]
	}))
};

/** Füllt möglichst viele Felder: Wertquoten, Ausstand, fehlende Zustimmung. */
const ERFORDERNIS: Erfordernis = {
	fassung: '2026-09-27',
	juristischGegengelesen: false,
	astId: 'a-probe',
	knotenId: 'k-probe',
	typ: 'qualifiziertes_mehr',
	titel: 'Qualifiziertes Mehr',
	rechtsgrundlage: 'ZGB Art. 712g Abs. 3',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'alle_quoten',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	zustimmungBetroffenerNoetig: true,
	pfad: [],
	quelle: 'hergeleitet'
};

const LAGE = {
	momentaufnahme: MOMENTAUFNAHME,
	erfordernis: ERFORDERNIS,
	anwesende: ['p1', 'p2', 'p3', 'p4', 'p5'],
	betroffeneParteiIds: ['p5'],
	imAusstand: ['p4']
};

function stimme(partyId: string, choice: Vote['choice']): Vote {
	return {
		partyId,
		unitId: `${partyId}-u1`,
		choice,
		castAt: '2026-09-25T19:10:00.000Z',
		recordedByChair: false
	};
}

function einzeln() {
	return zaehleAus({
		...LAGE,
		stimmen: [stimme('p1', 'yes'), stimme('p2', 'yes'), stimme('p3', 'abstain'), stimme('p5', 'no')]
	});
}

function vonHand() {
	return zaehleSummenAus(
		{
			...LAGE,
			erfordernis: {
				...ERFORDERNIS,
				quotenbasis: 'keine',
				quotenSchwelle: null,
				zustimmungBetroffenerNoetig: false
			},
			betroffeneParteiIds: []
		},
		{ ja: 2, nein: 1, enthaltung: 1, vermerk: 'Probe' }
	);
}

/** Aus derselben Lage am 25.09.2026 mit `festschreibung` erzeugt, Texte gekürzt. */
const FORMAT_1_EINZELN = {
	format: 1,
	auszaehlung: {
		koepfe: { ja: 2, nein: 1, enthaltung: 1, ohneAbgabe: 0, nichtAnwesend: 0, basis: 4, schwelle: 3, erreicht: false },
		quoten: { ja: 550, nein: 100, enthaltung: 200, ohneAbgabe: 0, nichtAnwesend: 0, basis: 1000, schwelle: 501, erreicht: true },
		betroffene: {
			noetig: true,
			zugestimmt: [],
			fehlend: [{ parteiId: 'p5', name: 'Betroffene', grund: 'nein' }],
			erfuellt: false
		},
		ohneZustimmung: [
			{ parteiId: 'p3', name: 'Stachelbeer', grund: 'enthaltung' },
			{ parteiId: 'p5', name: 'Betroffene', grund: 'nein' }
		],
		angenommen: false,
		durchStichentscheid: false,
		stichentscheidOffen: false,
		stichentscheidArt: null,
		hinweise: ['«Holunder» ist bei diesem Traktandum in den Ausstand getreten …'],
		ausstandswirkung: 'Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 4 statt 5 Kopfstimmen. …'
	}
};

/** Dasselbe für die Handzählung, die zusätzlich `quotenErhoben` trägt. */
const FORMAT_1_VON_HAND = {
	format: 1,
	auszaehlung: {
		koepfe: { ja: 2, nein: 1, enthaltung: 1, ohneAbgabe: 0, nichtAnwesend: 0, basis: 4, schwelle: 3, erreicht: false },
		quoten: { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 0, schwelle: null, erreicht: true },
		quotenErhoben: false,
		ausstandswirkung: 'Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 4 statt 5 Kopfstimmen.',
		betroffene: { noetig: false, zugestimmt: [], fehlend: [], erfuellt: true },
		ohneZustimmung: [],
		angenommen: false,
		durchStichentscheid: false,
		stichentscheidOffen: false,
		stichentscheidArt: null,
		hinweise: ['Von Hand gezählt, ohne Zuordnung zu Personen: Probe …']
	}
};

/**
 * Die Schlüsselpfade eines Werts, Listenelemente unter `[]` zusammengefasst.
 * Ein Pfad trägt die Art seines Werts, damit auch ein Feld auffällt, das
 * seine Form wechselt (Zahl wird Gegenstand). `null` passt zu jeder Art: Ein
 * Feld, das heute leer war, sagt über seine Form nichts.
 */
function pfade(wert: unknown, vorn = ''): Map<string, string> {
	const aus = new Map<string, string>();
	const art = wert === null ? 'null' : Array.isArray(wert) ? 'liste' : typeof wert;
	if (vorn) aus.set(vorn, art);
	if (Array.isArray(wert)) {
		for (const e of wert) for (const [p, a] of pfade(e, `${vorn}[]`)) aus.set(p, a);
	} else if (wert && typeof wert === 'object') {
		for (const [k, v] of Object.entries(wert)) {
			if (v === undefined) continue;
			for (const [p, a] of pfade(v, vorn ? `${vorn}.${k}` : k)) aus.set(p, a);
		}
	}
	return aus;
}

function fehlendeFelder(frisch: unknown, alt: unknown): string[] {
	const vorhanden = pfade(alt);
	return [...pfade(frisch)]
		.filter(([p, a]) => {
			const b = vorhanden.get(p);
			if (b === undefined) return true;
			return a !== 'null' && b !== 'null' && a !== b;
		})
		.map(([p, a]) => `${p} (${a})`);
}

describe('die festgeschriebene Auszählung', () => {
	it('geht ohne Verlust durch JSON', () => {
		// AD-1 verlangt serialisierbare Ausgabetypen. Eine Map, ein Datum oder
		// NaN in der Auszählung kämen aus `jsonb` anders zurück, als sie
		// hineingingen, und das Ergebnis wäre nicht das verkündete.
		for (const a of [einzeln(), vonHand()]) {
			const h = festschreibung(a);
			expect(JSON.parse(JSON.stringify(h))).toEqual(h);
		}
	});

	it('trägt die heutige Formatnummer', () => {
		expect(festschreibung(einzeln()).format).toBe(FESTSCHREIBUNGSFORMAT);
		expect(FESTSCHREIBUNGSFORMAT).toBe(1);
	});

	it('gibt die Auszählung unverändert zurück', () => {
		const a = einzeln();
		expect(ausFestschreibung(JSON.parse(JSON.stringify(festschreibung(a))))).toEqual(a);
	});

	it('liest eine Hülle von heute mit allen Feldern, die eine frische Auszählung trägt', () => {
		// Rot heisst: Die Auszählung hat ein Feld bekommen, das die alte Hülle
		// nicht kennt. Dann gehört ein Ersatzwert in `ausFestschreibung`; das
		// Literal bleibt, wie es ist (siehe Kopf dieser Datei).
		//
		// **Die Protokollhinweise bleiben als Elementpfade stehen** (08.10.2026):
		// Die Lage trägt einen Vermerk (H11), und eine Hülle von vorher kann die
		// Einträge nicht tragen — der Ersatzwert ist die leere Liste. Dass ein
		// Verbraucher mit ihr umgehen kann, prüft die Probe darunter.
		//
		// **Das zweite Ergebnis nach L1 bleibt ebenso stehen** (21.10.2026,
		// Migration 170): Die Lage hat einen Ausstand beim Mehr aller Wertquoten,
		// und eine Hülle von vorher kann es nicht tragen. Es ist optional; sein
		// Fehlen heisst «nicht gerechnet», und die Verbraucher lesen es über
		// `andereLesartenVon` (Probe darunter).
		const fehlend = fehlendeFelder(einzeln(), ausFestschreibung(FORMAT_1_EINZELN));
		// Ebenso der Eimer der Quote im Ausstand (Codeprüfung Teil 2, M1), optional
		// und für Hüllen von vorher null.
		expect(
			fehlend.filter((f) => !f.startsWith('andereAusstandslesart') && !f.startsWith('quoten.imAusstand'))
		).toEqual([
			'protokollhinweise[] (object)',
			'protokollhinweise[].ort (string)',
			'protokollhinweise[].satz (string)'
		]);
		expect(fehlend).toContain('andereAusstandslesart (object)');
		expect(fehlendeFelder(vonHand(), ausFestschreibung(FORMAT_1_VON_HAND))).toEqual([]);
	});

	it('eine Hülle von vor Migration 170 trägt kein zweites Ergebnis, und die Anzeigen kommen damit aus', () => {
		const alt = ausFestschreibung(FORMAT_1_EINZELN)!;
		expect(alt.andereAusstandslesart ?? null).toBeNull();
		expect(andereLesartenVon(alt)).toEqual([]);
	});

	it('bemerkt ein Feld, das die alte Hülle nicht kennt', () => {
		// Gegenprobe zur Probe darüber: Sie misst etwas. Die frische Auszählung
		// trägt seit dem 08.10.2026 `protokollhinweise`, das die alte Hülle nur
		// als leere Liste kennt.
		const e = einzeln();
		const frisch = {
			...e,
			andereAusstandslesart: undefined,
			quoten: { ...e.quoten, imAusstand: undefined },
			neuesFeld: { art: 'x' }
		};
		expect(fehlendeFelder(frisch, ausFestschreibung(FORMAT_1_EINZELN))).toEqual([
			'protokollhinweise[] (object)',
			'protokollhinweise[].ort (string)',
			'protokollhinweise[].satz (string)',
			'neuesFeld (object)',
			'neuesFeld.art (string)'
		]);
	});

	it('ergänzt die Protokollhinweise einer Hülle ohne sie', () => {
		// Die Hülle von vor dem 08.10.2026 kennt sie nicht; leer heisst, das
		// Protokoll zeigt wie bisher nur Ausgang und Zahlen.
		expect(ausFestschreibung(FORMAT_1_EINZELN)?.protokollhinweise).toEqual([]);
	});

	it('ergänzt die drei neuen Betroffenenfelder einer Hülle ohne sie', () => {
		// Die Hülle von vor dem 25.09.2026 kennt `form`, `vorab` und
		// `ausstehend` nicht. Der Ersatzwert steht in `ausFestschreibung`; das
		// Literal oben bleibt unverändert.
		const a = ausFestschreibung(FORMAT_1_EINZELN);
		expect(a?.betroffene.form).toBe('im_saal_oder_vorab');
		expect(a?.betroffene.vorab).toEqual([]);
		expect(a?.betroffene.ausstehend).toEqual([]);
	});

	it('liest ein unbekanntes Format oder eine unvollständige Hülle nicht, statt neu zu rechnen', () => {
		for (const roh of [
			null,
			{},
			{ format: 2, auszaehlung: einzeln() },
			{ format: 1 },
			{ format: 1, auszaehlung: {} },
			{ format: 1, auszaehlung: { ...einzeln(), koepfe: undefined } }
		]) {
			expect(ausFestschreibung(roh)).toBeNull();
		}
	});
});
