/**
 * Fassung 2026-10-27: Entscheiden statt der Versammlung (C1, C2a bis C2c,
 * Entscheid 0018 «Fest»).
 *
 * Gemessen werden die Kriterien 11, 12 und 14 des Konzepts Lesarten an den
 * Wegen des Baums, Kriterium 4 des Auftrags (die Einstimmigkeit rechnet wie
 * bisher, auch mit Ausstand) und dass kein bestehender Knoten seine Rechnung
 * ändert: Alle Stellen, die ein gespeichertes Erfordernis mit einer
 * Neuherleitung vergleichen, leiten über die Knotenkennung her
 * (`waehleErfordernis` mit `wendeReglementAn`), und dort darf sich für keinen
 * Knoten der Vorfassung etwas ändern, unter keiner Lesart und keiner Regel.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, alleFassungen, holeRegelwerk } from '$lib/rules';
import {
	erfordernisAus,
	ergebniskarte,
	laufe,
	sperreNachLehre,
	waehleErfordernis,
	waehlbareErfordernisse,
	type Kennzahlen
} from '$lib/domain/entscheidbaum';
import { pruefeRegelwerk, type Regelwerk } from '$lib/domain/regelwerk';
import { karteMitReglement, wendeReglementAn, type Reglementsregel } from '$lib/domain/reglement';
import { LESARTEN_VORGABE, pruefeLesartenImRegelwerk, wendeLesartAn, type Lesartenwahl } from '$lib/domain/lesarten';
import { zaehleAus } from '$lib/domain/auszaehlung';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';
import {
	BEISPIELE_ERWEITERT,
	BEISPIEL_VORHER,
	BEWIRTSCHAFTUNG_STATT_ID,
	DELEGATION_VORHER,
	ERWEITERT_ID,
	HINWEIS_ALLTAG,
	HINWEIS_ORGAN,
	HINWEIS_STATT,
	KOMPETENZHILFE_ERSATZ,
	ORGAN_ID,
	REGLEMENT_FRAGE_ID,
	REGLEMENT_ID,
	STATT_FRAGE_ID,
	UEBERTRAGUNG_BESCHLUSS_ID,
	UEBERTRAGUNG_FRAGE_ID,
	UEBERTRAGUNG_STATT_ID,
	ZUSTAENDIGKEIT_ID
} from '$lib/rules/quorum-2026-10-27';
import { KOMPETENZFRAGE_ID } from '$lib/rules/quorum-2026-10-24';

const VOR = holeRegelwerk('2026-10-26');
const NEU = holeRegelwerk('2026-10-27');

const ZAHLEN: Kennzahlen = { kopfstimmen: 20, gesamtquote: 1000, anwesend: 15, zaehlweise: 'per_owner' };

const NEUE_KNOTEN = [BEWIRTSCHAFTUNG_STATT_ID, UEBERTRAGUNG_STATT_ID, UEBERTRAGUNG_BESCHLUSS_ID];
const NEUE_FRAGEN = [STATT_FRAGE_ID, UEBERTRAGUNG_FRAGE_ID, REGLEMENT_FRAGE_ID];

function herleiten(rw: Regelwerk, ...antworten: string[]) {
	return erfordernisAus(rw, laufe(rw, 'a-organe', antworten));
}

/** Was die Auszählung entscheidet, ohne Herkunft und Fassung. */
function rechnung(e: ReturnType<typeof herleiten>) {
	return {
		typ: e.typ,
		kopfbasis: e.kopfbasis,
		quotenbasis: e.quotenbasis,
		kopf: e.kopfSchwelle,
		quoten: e.quotenSchwelle
	};
}

describe('Fassung 2026-10-27 gegenüber 2026-10-26', () => {
	it('ist die aktuelle Fassung und in sich stimmig, ohne neue Lesart', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-23');
		expect(pruefeRegelwerk(NEU)).toEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toEqual([]);
		expect(NEU.knoten.filter((k) => k.lesart).map((k) => k.id)).toEqual(
			VOR.knoten.filter((k) => k.lesart).map((k) => k.id)
		);
	});

	it('ändert nur den Zweig der Organe', () => {
		expect(NEU.aeste).toEqual(VOR.aeste);
		const alteFragen = NEU.fragen.filter((f) => !NEUE_FRAGEN.includes(f.id));
		expect(alteFragen.map((f) => f.id)).toEqual(VOR.fragen.map((f) => f.id));
		for (const f of alteFragen) {
			const v = VOR.fragen.find((x) => x.id === f.id)!;
			if (f.id === KOMPETENZFRAGE_ID) {
				// Codeprüfung N3: nur das Mehr der Erweiterung in der Hilfe.
				const zurueck = KOMPETENZHILFE_ERSATZ.reduce((h, [vorher, neu]) => h.replace(neu, vorher), f.hilfe!);
				expect({ ...f, hilfe: zurueck }, f.id).toEqual(v);
				expect(f.hilfe).not.toMatch(/grössere Aufträge vergeben/);
				continue;
			}
			if (f.id !== 'f2-1') {
				expect(f, f.id).toEqual(v);
				continue;
			}
			expect(f.antworten.map((a) => [a.id, a.ziel])).toEqual(
				v.antworten.flatMap((a) => {
					if (a.id === 'f2-1-erweitert') return [[a.id, STATT_FRAGE_ID]];
					if (a.id === 'f2-1-organ') return [[a.id, a.ziel], ['f2-1-uebertragen', UEBERTRAGUNG_FRAGE_ID]];
					return [[a.id, a.ziel]];
				})
			);
		}
		expect(NEU.knoten.filter((k) => !NEUE_KNOTEN.includes(k.id)).map((k) => k.id)).toEqual(
			VOR.knoten.map((k) => k.id)
		);
		for (const k of NEU.knoten) {
			if (NEUE_KNOTEN.includes(k.id) || k.id === ERWEITERT_ID || k.id === ORGAN_ID) continue;
			expect(k, k.id).toEqual(VOR.knoten.find((x) => x.id === k.id));
		}
	});

	it('ändert an den bisherigen Karten nur Text, nicht die Rechnung', () => {
		const text = ['titel', 'begruendung', 'rechtsgrundlage', 'hinweise', 'beispiele'];
		const ohneText = (k: object) => Object.fromEntries(Object.entries(k).filter(([f]) => !text.includes(f)));
		for (const id of [ERWEITERT_ID, ORGAN_ID]) {
			expect(ohneText(NEU.knoten.find((k) => k.id === id)!), id).toEqual(ohneText(VOR.knoten.find((k) => k.id === id)!));
		}
	});
});

describe('C1: Bewirtschaftung statt der Versammlung (Kriterium 11)', () => {
	it('verlangt bei Ja die Zustimmung aller Eigentümer', () => {
		const ja = herleiten(NEU, 'f2-1-erweitert', 'f2-1-statt-ja');
		expect(ja.knotenId).toBe(BEWIRTSCHAFTUNG_STATT_ID);
		expect(rechnung(ja)).toMatchObject({ typ: 'einstimmigkeit', kopfbasis: 'alle_eigentuemer', quotenbasis: 'keine' });
	});

	it('bleibt bei Nein beim qualifizierten Mehr der Vorfassung', () => {
		const nein = herleiten(NEU, 'f2-1-erweitert', 'f2-1-statt-nein');
		expect(nein.knotenId).toBe(ERWEITERT_ID);
		expect(rechnung(nein)).toEqual(rechnung(herleiten(VOR, 'f2-1-erweitert')));
		expect(nein.typ).toBe('qualifiziertes_mehr');
	});

	it('Gegenprobe: In der Vorfassung führt derselbe Einstieg ohne Frage zum qualifizierten Mehr', () => {
		// Kriterium 16: Ohne die neue Frage gäbe es keinen Weg zur Einstimmigkeit.
		const vor = herleiten(VOR, 'f2-1-erweitert');
		expect(vor.knotenId).toBe(ERWEITERT_ID);
		expect(vor.typ).toBe('qualifiziertes_mehr');
		expect(VOR.knoten.some((k) => k.id === BEWIRTSCHAFTUNG_STATT_ID)).toBe(false);
	});

	it('zeigt an der bisherigen Karte auf die neue und tauscht das Beispiel der Pendenz', () => {
		const k = NEU.knoten.find((x) => x.id === ERWEITERT_ID)!;
		expect(k.hinweise).toContain(HINWEIS_STATT);
		expect((k.hinweise ?? []).some((h) => h.startsWith(DELEGATION_VORHER))).toBe(false);
		expect(k.hinweise).toContain(HINWEIS_ALLTAG);
		expect(k.beispiele).toEqual(BEISPIELE_ERWEITERT);
		expect(k.beispiele).not.toContain(BEISPIEL_VORHER);
		// Die Vorfassung bleibt, wie sie war: Sie trägt gefasste Beschlüsse.
		const v = VOR.knoten.find((x) => x.id === ERWEITERT_ID)!;
		expect(v.beispiele).toContain(BEISPIEL_VORHER);
		expect((v.hinweise ?? []).some((h) => h.startsWith(DELEGATION_VORHER))).toBe(true);
	});
});

describe('C2: Ausschuss oder Delegierter (Kriterium 12)', () => {
	it('C2a: statt der Versammlung entscheiden verlangt die Zustimmung aller', () => {
		const e = herleiten(NEU, 'f2-1-uebertragen', 'f2-1-uebertragung-statt');
		expect(e.knotenId).toBe(UEBERTRAGUNG_STATT_ID);
		expect(rechnung(e)).toMatchObject({ typ: 'einstimmigkeit', kopfbasis: 'alle_eigentuemer', quotenbasis: 'keine' });
	});

	it('C2b: andere Aufgaben als Beschluss mit einfachem Mehr', () => {
		const e = herleiten(NEU, 'f2-1-uebertragen', 'f2-1-uebertragung-anderes', 'f2-1-uebertragung-reglement-nein');
		expect(e.knotenId).toBe(UEBERTRAGUNG_BESCHLUSS_ID);
		expect(rechnung(e)).toMatchObject({ typ: 'einfaches_mehr', kopfbasis: 'anwesend_vertreten', quotenbasis: 'keine' });
	});

	it('C2b: andere Aufgaben im Reglement mit qualifiziertem Mehr', () => {
		const e = herleiten(NEU, 'f2-1-uebertragen', 'f2-1-uebertragung-anderes', 'f2-1-uebertragung-reglement-ja');
		expect(e.knotenId).toBe(REGLEMENT_ID);
		expect(rechnung(e)).toMatchObject({ typ: 'qualifiziertes_mehr', kopfbasis: 'anwesend_vertreten', quotenbasis: 'alle_quoten' });
	});

	it('C2c: beraten, prüfen, berichten führt zur Wahl mit einfachem Mehr', () => {
		const e = herleiten(NEU, 'f2-1-uebertragen', 'f2-1-uebertragung-beraten');
		expect(e.knotenId).toBe(ORGAN_ID);
		expect(rechnung(e)).toEqual(rechnung(herleiten(VOR, 'f2-1-organ')));
		expect(rechnung(herleiten(NEU, 'f2-1-organ'))).toEqual(rechnung(e));
		expect(NEU.knoten.find((k) => k.id === ORGAN_ID)!.hinweise).toEqual([HINWEIS_ORGAN]);
		expect(NEU.knoten.find((k) => k.id === ORGAN_ID)!.titel).toMatch(/Delegierten/);
	});

	it('C2b: Ausgaben der alltäglichen Verwaltung rechnen nach der Lesart L2 (Produktentscheid zu F4-1)', () => {
		const pfade = [
			['f2-1-uebertragen', 'f2-1-uebertragung-gewoehnlich'],
			['f2-1-erweitert', 'f2-1-statt-gewoehnlich']
		];
		for (const pfad of pfade) {
			const e = herleiten(NEU, ...pfad);
			expect(e.knotenId, pfad.join(' › ')).toBe(ZUSTAENDIGKEIT_ID);
			expect(rechnung(wendeLesartAn(e, LESARTEN_VORGABE)), pfad.join(' › ')).toMatchObject({ typ: 'einfaches_mehr' });
			expect(rechnung(wendeLesartAn(e, { ...LESARTEN_VORGABE, L2: 'qualifiziert' })), pfad.join(' › ')).toMatchObject({
				typ: 'qualifiziertes_mehr',
				quotenbasis: 'alle_quoten'
			});
		}
	});

	it('Gegenprobe: Die Vorfassung kennt keinen Weg zur Übertragung', () => {
		const f21 = VOR.fragen.find((f) => f.id === 'f2-1')!;
		expect(f21.antworten.some((a) => a.id === 'f2-1-uebertragen')).toBe(false);
		expect(VOR.knoten.some((k) => k.id === UEBERTRAGUNG_STATT_ID || k.id === UEBERTRAGUNG_BESCHLUSS_ID)).toBe(false);
	});

	it('nennt unter einer Regel die Sperre nach der Lehre, nicht zwingendes Recht', () => {
		for (const id of [BEWIRTSCHAFTUNG_STATT_ID, UEBERTRAGUNG_STATT_ID]) {
			const k = NEU.knoten.find((x) => x.id === id)!;
			expect(sperreNachLehre(k), id).toBe(true);
			const karte = karteMitReglement(ergebniskarte(NEU, k, ZAHLEN), regel({ geschaeftsart: 'organe' }), 'zwingend', null, null);
			expect(karte.reglementsvorbehalt, id).toMatch(/Sie wird hier nicht angewandt\./);
			expect(karte.reglementsvorbehalt, id).toMatch(/ist nicht geklärt; gerechnet wird die strengere Lesart/);
			expect(karte.reglementsvorbehalt, id).not.toMatch(/zwingendes Recht/);
		}
	});

	it('eine Regel des Reglements mildert die Einstimmigkeit nicht', () => {
		const e = herleiten(NEU, 'f2-1-uebertragen', 'f2-1-uebertragung-statt');
		const mild = regel({ geschaeftsart: 'organe', kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } });
		const angewandt = wendeReglementAn(e, [mild], null, LESARTEN_VORGABE).erfordernis;
		expect(rechnung(angewandt as typeof e)).toEqual(rechnung(e));
	});
});

/**
 * Eine Regel für eine Geschäftsart, wie sie die Reglementseite hinterlegt.
 * Ohne `knotenId` gilt sie für alle Fälle der Art.
 */
function regel(teil: Partial<Reglementsregel> & Pick<Reglementsregel, 'geschaeftsart'>): Reglementsregel {
	return {
		id: 'r-1',
		stwegId: 's-1',
		knotenId: null,
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
		kopfbasis: 'anwesend_vertreten',
		quotenSchwelle: null,
		quotenbasis: 'keine',
		fundstelle: 'Reglement Art. 9',
		enthaltungZaehltMit: false,
		...teil
	} as Reglementsregel;
}

/*
 * **Kriterium 14 als Eigenschaft, nicht als Beispiel.** Die Vergleiche mit einer
 * Neuherleitung (`veralteteErfordernisseIn`, `veralteteLesartenIn`,
 * Folgeantrag, Auswahl im Saal, KI-Vorschlag, Einladungsmehr) laufen alle über
 * `waehleErfordernis(rw, knotenId)` und `wendeReglementAn` unter der aktuellen
 * Fassung. Ein Traktandum der Vorfassung erscheint dort nur als «älteres
 * Erfordernis», wenn sich das Ergebnis für seinen Knoten ändert. Geprüft wird
 * jeder entscheidungsfähige Knoten der Vorfassung, ohne und mit einer Regel für
 * seine Geschäftsart, nach der Vorgabe und nach den anderen Wahlen von L2 und L4
 * (Falle aus Block 3: «Unter einer Regel des Reglements verhält sich jede neue
 * Prüfung anders»).
 */
describe('Traktanden der Vorfassung (Kriterium 14)', () => {
	const ANDERE: Lesartenwahl = { ...LESARTEN_VORGABE, L2: 'qualifiziert', L4: 'qualifiziert' };
	const entscheidbar = VOR.knoten.filter((k) => k.typ !== 'grenzfall' && k.typ !== 'keine_abstimmung');

	it('prüft alle entscheidungsfähigen Knoten, auch die beiden mit neuem Text', () => {
		expect(entscheidbar.map((k) => k.id)).toEqual(expect.arrayContaining([ERWEITERT_ID, ORGAN_ID]));
		expect(entscheidbar.length).toBeGreaterThan(30);
	});

	for (const [name, wahlen] of [
		['Vorgabe', LESARTEN_VORGABE],
		['andere Wahlen', ANDERE]
	] as const) {
		it(`leitet unter 2026-10-27 dasselbe her wie unter 2026-10-26 (${name}, ohne und mit Regel)`, () => {
			for (const k of entscheidbar) {
				const vor = waehleErfordernis(VOR, k.id).ergebnis!;
				const neu = waehleErfordernis(NEU, k.id).ergebnis!;
				for (const regeln of [[], [regel({ geschaeftsart: k.geschaeftsart })]]) {
					const a = wendeReglementAn(vor, regeln, null, wahlen).erfordernis;
					const b = wendeReglementAn(neu, regeln, null, wahlen).erfordernis;
					expect(rechnung(b as typeof neu), `${k.id}, ${regeln.length} Regel`).toEqual(rechnung(a as typeof vor));
					expect(b.zustimmungBetroffenerNoetig, k.id).toBe(a.zustimmungBetroffenerNoetig);
				}
			}
		});
	}
});

/** Vier Eigentümer zu gleichen Teilen. */
const VIER: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-10-21T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: ['p1', 'p2', 'p3', 'p4'].map((id) => ({
		partyId: id,
		displayName: `Eigentümer ${id}`,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `${id}-u`, label: `Whg ${id}`, kind: 'unit' as const, countsAsHead: true, quota: 250 }]
	}))
};

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-10-21T19:10:00.000Z',
		recordedByChair: false
	}));
}

describe('Einstimmigkeit mit Ausstand wie bisher (Entscheid 0018, «Fest»)', () => {
	const lage = {
		momentaufnahme: VIER,
		stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p4', 'yes']),
		anwesende: ['p1', 'p2', 'p3', 'p4']
	};
	const bisherige = waehleErfordernis(NEU, 'k-zweckbestimmung').ergebnis!;

	for (const id of [BEWIRTSCHAFTUNG_STATT_ID, UEBERTRAGUNG_STATT_ID]) {
		it(`${id}: wer im Ausstand ist, muss nicht zustimmen, wie an jeder Karte mit Einstimmigkeit`, () => {
			const e = waehleErfordernis(NEU, id).ergebnis!;
			const mit = zaehleAus({ ...lage, erfordernis: e, geheim: false, imAusstand: ['p3'] });
			const vergleich = zaehleAus({ ...lage, erfordernis: bisherige, geheim: false, imAusstand: ['p3'] });
			expect(mit.angenommen).toBe(true);
			expect(mit.koepfe).toEqual(vergleich.koepfe);
			// Gegenprobe: ohne Ausstand fehlt die Stimme von p3.
			expect(zaehleAus({ ...lage, erfordernis: e, geheim: false }).angenommen).toBe(false);
		});
	}
});

/*
 * **Der Ast einer Karte** (Codeprüfung Block 4, M1). Die neuen Wege führen aus
 * «Organe» auch zur gewöhnlichen Reglementsänderung und zur
 * Zuständigkeitsordnung. Nach der alten Regel («der erste Ast, der sie
 * erreicht») wären beide dorthin gewandert, in jeder Auswahlliste und in
 * `requirement_branch`. Die alte Regel steht hier als Referenz, damit sich zeigt,
 * dass die neue an keiner älteren Fassung etwas verschiebt.
 */
function ersterAst(rw: Regelwerk): Map<string, string> {
	const z = new Map<string, string>();
	for (const ast of rw.aeste) {
		const offen = [ast.einstieg];
		const gesehen = new Set<string>();
		while (offen.length > 0) {
			const ziel = offen.pop()!;
			if (gesehen.has(ziel)) continue;
			gesehen.add(ziel);
			const f = rw.fragen.find((x) => x.id === ziel);
			if (f) {
				offen.push(...f.antworten.map((a) => a.ziel));
				continue;
			}
			if (!z.has(ziel) && rw.knoten.some((k) => k.id === ziel)) z.set(ziel, ast.id);
		}
	}
	return z;
}

describe('Ast je Karte (Codeprüfung M1)', () => {
	it('ordnet in allen älteren Fassungen jede Karte demselben Ast zu wie bisher', () => {
		for (const rw of alleFassungen().filter((r) => r.fassung < '2026-10-27')) {
			const alt = ersterAst(rw);
			for (const e of waehlbareErfordernisse(rw)) {
				expect(e.astId, `${rw.fassung} ${e.knotenId}`).toBe(alt.get(e.knotenId));
			}
		}
	});

	it('lässt Reglementsänderung und Zuständigkeitsordnung in ihrem Ast, die neuen Karten unter «Organe»', () => {
		const ast = new Map(waehlbareErfordernisse(NEU).map((e) => [e.knotenId, e.astId]));
		expect(ast.get(REGLEMENT_ID)).toBe('a-reglement');
		expect(ast.get(ZUSTAENDIGKEIT_ID)).toBe('a-sonderfaelle');
		for (const id of [...NEUE_KNOTEN, ERWEITERT_ID, ORGAN_ID]) expect(ast.get(id), id).toBe('a-organe');
		// Gegenprobe: Nach der alten Regel wären beide gewandert.
		expect(ersterAst(NEU).get(REGLEMENT_ID)).toBe('a-organe');
		expect(ersterAst(NEU).get(ZUSTAENDIGKEIT_ID)).toBe('a-organe');
		expect(waehleErfordernis(NEU, REGLEMENT_ID).ergebnis?.astId).toBe('a-reglement');
	});
});
