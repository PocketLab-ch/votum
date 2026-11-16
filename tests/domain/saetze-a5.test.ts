/**
 * Votum A5 (30.10.2026): Sätze in Protokoll, Teilnehmerseite, Blättern und
 * Leitung. Eine Probe je Punkt des Auftrags
 * (`.auftraege/2026-10-30-votum-a5-saetze-opencode.md`), damit der neue Wortlaut nicht still verfällt.
 *
 * Die Gegentests (Akzeptanzkriterium 2: die neue Stelle kurz auf den alten
 * Wortlaut zurückgesetzt, der Test wird rot) sind im Bericht
 * `.auftraege/2026-10-30-votum-a5-bericht.md` protokolliert.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	andereLesartInWorten,
	ausstandswahlDesErgebnisses,
	einspracheHaende,
	mitKeinemBeschluss,
	zaehleSummenAus,
	einspracheZaehlhilfe,
	lesartKartensatz,
	zaehleAus,
	stichentscheidGrenzeKartensatz,
	ZAEHLBASIS_ALLE,
	ZAEHLBASIS_ANWESENDE,
	type ErgebnisNachAndererLesart
} from '$lib/domain/auszaehlung';
import {
	ausstandslesartKartensatz,
	ausstandslesartSatz,
	einsprachelesartKartensatz,
	einspracheHandzaehlungTexte,
	einspracheHaendeVorsatz,
	LESARTEN_VORGABE,
	lesartVon,
	wendeLesartAn
} from '$lib/domain/lesarten';
import { zaehlweiseImKopf, zaehlweiseInWorten } from '$lib/domain/gemeinschaft';
import { neuAnZweiterProtokoll } from '$lib/domain/mehrhinweise';
import { einspracheMappensatz } from '$lib/domain/auszaehlmappe';
import { holeRegelwerk } from '$lib/rules';
import { erfordernisAus, laufe } from '$lib/domain/entscheidbaum';
import type { Beschlussfaehigkeitsregel } from '$lib/domain/beschlussfaehigkeit';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const text = (rel: string) => readFileSync(join(wurzel, rel), 'utf-8');

/** Eine Gemeinschaft je Einheit: p1 hat 1, p2 hat 1, p3 hat 3 Einheiten. */
function snapshot(tieBreak: Snapshot['tieBreak'] = 'keiner'): Snapshot {
	const einheiten = (id: string, n: number, quota: number) =>
		Array.from({ length: n }, (_, i) => ({
			unitId: `${id}-u${i + 1}`,
			label: `Whg ${id} ${i + 1}`,
			kind: 'unit' as const,
			countsAsHead: true,
			quota
		}));
	return {
		meetingId: 'v-1',
		takenAt: '2026-10-30T17:00:00.000Z',
		headCountMode: 'per_unit',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak,
		totalQuota: 1000,
		parties: [
			{
				partyId: 'p1',
				displayName: 'Partei 1',
				representativeName: null,
				isCommunity: false,
				units: einheiten('p1', 1, 100)
			},
			{
				partyId: 'p2',
				displayName: 'Partei 2',
				representativeName: null,
				isCommunity: false,
				units: einheiten('p2', 1, 300)
			},
			{
				partyId: 'p3',
				displayName: 'Partei 3',
				representativeName: null,
				isCommunity: false,
				units: einheiten('p3', 3, 200)
			}
		]
	} as Snapshot;
}

function stimme(partei: Snapshot['parties'][number], wahl: VoteChoice): Vote[] {
	return partei.units.map((u) => ({
		partyId: partei.partyId,
		unitId: u.unitId,
		choice: wahl,
		castAt: '2026-10-30T19:10:00.000Z',
		recordedByChair: false
	}));
}

/** Das Erfordernis eines Traktandums mit Lesart am Mehr (L2 am Zustaendigkeitsknoten). */
function zustaendigkeit(wahl: 'einfach' | 'qualifiziert'): Erfordernis {
	const rw = holeRegelwerk('2026-10-26');
	return wendeLesartAn(erfordernisAus(rw, laufe(rw, 'a-sonderfaelle', ['f8-1-zustaendigkeit'])), {
		...LESARTEN_VORGABE,
		L2: wahl
	});
}

describe('A5, Punkt 1a: nicht «die Lesart dieser Versammlung»', () => {
	const r: ErgebnisNachAndererLesart = {
		kennung: 'L4',
		eigeneWahl: 'Einfaches Mehr',
		wahl: 'Qualifiziertes Mehr',
		verlangt: 'mehr als die Hälfte der Anwesenden und mehr als die Hälfte aller Wertquoten',
		feststellbar: true,
		angenommen: true,
		koepfe: { ja: 2, basis: 4, schwelle: 3, erreicht: true },
		quoten: null,
		abweichend: true
	};
	it('nennt die Verwaltung als die, die eingestellt hat', () => {
		const satz = andereLesartInWorten(r, false).leitung;
		expect(satz).toContain('Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist');
		expect(satz).not.toContain('Lesart dieser Versammlung');
	});
});

describe('A5, Punkt 1b: der Grund der Vorgabe statt der Software', () => {
	it('nennt im Satz zu L1 den Grund der Vorgabe', () => {
		const satz = ausstandslesartSatz('bleibt', false);
		expect(satz).toContain('Das ist die Standardeinstellung: Im Zweifel wird streng gerechnet');
		expect(satz).not.toContain('Voreinstellung von Votum');
		expect(ausstandslesartSatz('faellt_heraus', false)).toContain(
			'Die Standardeinstellung wäre die andere: Im Zweifel'
		);
		expect(satz).not.toContain('Votum');
	});

	it('nennt den Grund auch auf der Karte zu L1 und L3', () => {
		expect(ausstandslesartKartensatz('bleibt')).toContain('(Standardeinstellung: Im Zweifel wird streng gerechnet');
		expect(ausstandslesartKartensatz('faellt_heraus')).toContain('die Standardeinstellung wäre die andere');
		expect(einsprachelesartKartensatz('je_eigentuemer')).toContain(
			'(Standardeinstellung: So kommt die Einsprache nicht leichter zustande als nach Gesetz)'
		);
	});

	it('trägt den Grund je Lesart im Katalog', () => {
		for (const l of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'] as const) {
			expect(lesartVon(l)?.vorgabeGrund.length ?? 0).toBeGreaterThan(20);
		}
	});
});

// A5, Punkt 1c: gemessen am Kasten, `tests/db/lesart-zustaendigkeit.test.ts`.

describe('A5, Punkt 3: die Stimme an der Einsprache auf der Teilnehmerseite', () => {
	it('zählt an der Einsprache nach L3 «je Eigentümer» eine Stimme je Eigentümer', () => {
		/*
		 * Die Teilnehmerseite importiert die Schale (Server); ein Domaintest
		 * liest sie deshalb als Text. Gemessen wird der Knoten, nicht der
		 * Wortlaut der Seite: `einspracheJeEigentuemer` entscheidet, was der
		 * Kasten «Sie sind erkannt als» nennt, und die Bedingung steht neben
		 * `kopfstimmenHier`, das die Bestätigung nach der Stimmabgabe nennt.
		 */
		const server = text('src/routes/z/+page.server.ts');
		expect(server).toContain('einspracheJeEigentuemer:');
		expect(server).toContain('l3Wirkt(offen.erfordernis, momentaufnahme)');
		expect(server).toContain("einsprachelesartVon(offen.erfordernis) === 'je_eigentuemer'");
		const seite = text('src/routes/z/+page.svelte');
		expect(seite).toContain('{#if data.ich.einspracheJeEigentuemer}');
		expect(seite).toContain('eine Stimme je Eigentümer, auch wer mehrere Einheiten hat');
	});
});

describe('A5, Punkt 4: Zählweise der Gemeinschaft und die Ausnahme an der Einsprache', () => {
	it('bezeichnet im Kopf die Zählweise als die der Gemeinschaft und nennt die Ausnahme', () => {
		const kopf = zaehlweiseImKopf('per_unit', false, 'Art. 14');
		expect(kopf).toContain('Das ist die Zählweise der Gemeinschaft an dieser Versammlung.');
		expect(kopf).toContain('Nur an der Einsprache kann nach der Einstellung der Gemeinschaft eine andere gelten');
	});

	it('nennt die Ausnahme nicht, wo keine gelten kann', () => {
		const kopf = zaehlweiseImKopf('per_owner', false, null);
		expect(kopf).toContain('Das ist die Zählweise der Gemeinschaft an dieser Versammlung.');
		expect(kopf).not.toContain('Einsprache');
	});

	it('lässt den Satz der Gemeinschaftsseite ohne Versammlung und Traktandum', () => {
		for (const modus of ['per_unit', 'per_owner'] as const) {
			const satz = zaehlweiseInWorten(modus, false, 'Art. 14');
			expect(satz).not.toContain('Versammlung');
			expect(satz).not.toContain('Traktandum');
		}
	});
});

describe('A5, Punkt 5: die Lesart L1 auf dem Stimmnachweis', () => {
	it('nennt die Wahl, die hinter dem zweiten Ergebnis stand', () => {
		expect(ausstandswahlDesErgebnisses({ eigeneWahl: 'Wertquote zählt mit' })).toBe('bleibt');
		expect(ausstandswahlDesErgebnisses({ eigeneWahl: 'Wertquote fällt heraus' })).toBe('faellt_heraus');
		expect(text('src/lib/server/pdf/stimmnachweis.ts')).toContain('ausstandslesartSatz(ausstandswahlDesErgebnisses(l1), true)');
	});
});

describe('A5, Punkt 6: L1 am zweiten Ergebnis nach L4 und L2', () => {
	it('sagt der Karte, dass das zweite Ergebnis über alle Wertquoten rechnet, mit der eingestellten Wahl', () => {
		const e = zustaendigkeit('einfach');
		const bleibt = lesartKartensatz(e)!;
		expect(bleibt).toContain('Das Ergebnis nach der anderen Lesart rechnet über alle Wertquoten.');
		expect(bleibt).toContain('bleibt in diesem Ergebnis seine Wertquote nach der Einstellung Ihrer Gemeinschaft in der Zahl');
		const heraus = lesartKartensatz({ ...e, ausstandslesart: 'faellt_heraus' })!;
		expect(heraus).toContain('wird in diesem Ergebnis die Zahl aller Wertquoten nach der Einstellung Ihrer Gemeinschaft');
		expect(heraus).toContain('Am Ergebnis, das Sie verkünden, ändert das nichts.');
	});

	it('sagt es nicht, wo das Traktandum selbst über alle Wertquoten rechnet', () => {
		const satz = lesartKartensatz(zustaendigkeit('qualifiziert'))!;
		expect(satz).not.toContain('Das Ergebnis nach der anderen Lesart rechnet');
	});
});

describe('A5, Punkt 8: die Regel des Reglements an der Zeile zu L5', () => {
	const regel: Beschlussfaehigkeitsregel = {
		kopf: { zaehler: 1, nenner: 2, art: 'mindestens' },
		quoten: null,
		mindestens: 3,
		fundstelle: 'Art. 5'
	};

	it('nennt die Regel des Reglements samt Fundstelle', () => {
		const satz = neuAnZweiterProtokoll('drittel', null, regel);
		expect(satz).toContain('nach dem Reglement');
		expect(satz).toContain('mindestens aber drei');
		expect(satz).toContain('Art. 5');
		expect(satz).not.toContain('nach Gesetz ein Drittel');
	});

	it('bleibt ohne Regel beim Drittel nach Gesetz', () => {
		expect(neuAnZweiterProtokoll('drittel', null, null)).toContain(
			'nach Gesetz ein Drittel der Eigentümer'
		);
		expect(neuAnZweiterProtokoll('drittel')).toContain('nach Gesetz ein Drittel der Eigentümer');
	});
});

describe('A5, Punkt 9: die Zählhilfe an der Einsprache für beide Zählweisen', () => {
	it('nennt den Vorsatz je Zählung und sagt, dass eine Partei einmal zählt', () => {
		expect(einspracheHaendeVorsatz('je_eigentuemer')).toBe(
			'Bei der Zählung je Eigentümer zählen diese Anwesenden nicht einfach einmal: '
		);
		expect(einspracheHaendeVorsatz('je_einheit')).toBe(
			'Bei der Zählung je Einheit zählen diese Anwesenden nicht einfach einmal: '
		);
		for (const wahl of ['je_eigentuemer', 'je_einheit'] as const) {
			expect(einspracheHandzaehlungTexte(wahl).erklaerung).toContain(
				'Mehrere Personen derselben Partei, etwa ein Ehepaar mit einer Wohnung, zählen zusammen einmal.'
			);
		}
	});

	it('zählt mit Vertretenen: eine Hand mit Vollmacht zählt mehr', () => {
		const m = snapshot();
		m.parties.push({
			partyId: 'p4',
			displayName: 'Partei 4',
			representativeName: null,
			isCommunity: false,
			units: [{
				unitId: 'p4-u1',
				label: 'Whg p4 1',
				kind: 'unit',
				countsAsHead: true,
				quota: 100
			}]
		});
		const lage = {
			momentaufnahme: m,
			erfordernis: {
				fassung: '2026-10-28',
				juristischGegengelesen: false,
				astId: 'a-sonderfaelle',
				knotenId: 'k-einsprache',
				typ: 'einfaches_mehr',
				titel: 'Einsprache',
				rechtsgrundlage: 'ZGB Art. 712c Abs. 2',
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'keine',
				kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
				quotenSchwelle: null,
				zustimmungBetroffenerNoetig: false,
				pfad: [],
				quelle: 'hergeleitet',
				einspracheLesart: 'je_eigentuemer' as const
			} satisfies Erfordernis,
			stimmen: [
				...stimme(m.parties[0], 'yes'),
				...stimme(m.parties[3], 'yes')
			],
			anwesende: ['p1', 'p4'],
			vertretungen: [{ vertreteneId: 'p4', bevollmaechtigtId: 'p1' }]
		};
		// Die Hand der Partei 1 zählt in beiden Zählungen für Partei 4 mit, und
		// Partei 4 hat keine eigene Hand. Die Pflicht zur zweiten Zählung
		// bleibt davon unberührt (`einspracheZaehlhilfe`).
		expect(einspracheHaende(lage)).toEqual({
			je_eigentuemer: ['Partei 1 mit 2 Stimmen'],
			je_einheit: ['Partei 1 mit 2 Stimmen']
		});
		expect(einspracheZaehlhilfe(lage)).toEqual([]);

		// Mehrere Einheiten: nur in der Zählung je Einheit; dort auch vertreten.
		const mitDrei = { ...lage, anwesende: ['p1', 'p3'], vertretungen: [{ vertreteneId: 'p3', bevollmaechtigtId: 'p1' }] };
		expect(einspracheHaende(mitDrei)).toEqual({
			je_eigentuemer: ['Partei 1 mit 2 Stimmen'],
			je_einheit: ['Partei 1 mit 4 Stimmen']
		});
		// Die Pflicht hängt weiter an den drei Einheiten, nach beiden Einstellungen.
		expect(einspracheZaehlhilfe(mitDrei)).toEqual(['Partei 3 mit 3 Stimmen']);

		// Ohne Vollmacht: je Einheit genannt, je Eigentümer nicht.
		expect(einspracheHaende({ ...lage, anwesende: ['p3'], vertretungen: [] })).toEqual({
			je_eigentuemer: [],
			je_einheit: ['Partei 3 mit 3 Stimmen']
		});
	});
});

describe('A5, Punkt 10: der lange Satz zur Zuordnung', () => {
	it('ist ohne Gedankenstrich, und kein Satz bleibt über 179 Zeichen', () => {
		const seite = text('src/routes/gemeinschaften/[id=kennung]/eigentuemer/+page.svelte');
		expect(seite).not.toContain(' — mit Datum');
		expect(seite).toContain('Mit Datum, damit eine');
		// Der Absatz in Fliesstext, die Marken der Seite gestrichen; Sätze an
		// Satzenden getrennt (auch nach Semikola, die hier Sätze scheiden).
		const absatz = seite
			.split('Zugeordnet wird die')[1]
			?.split('</p>')[0]
			?.replace(/<[^>]+>/g, '')
			?.replace(/&auml;/g, 'ä')
			?.replace(/&ouml;/g, 'ö')
			?.replace(/&uuml;/g, 'ü')
			?.replace(/\s+/g, ' ');
		expect(absatz).toBeTruthy();
		const saetze = ('Zugeordnet wird die' + absatz!)
			.replace(/\s*$/g, '')
			.split(/(?<=[.;])\s+/)
			.map((s) => s.replace(/\s+/g, ' ').trim());
		for (const satz of saetze) {
			// 179: Der Auftrag nennt 192 für den längsten und verlangt unter 180.
			expect(satz.length, satz).toBeLessThan(180);
		}
	});
});

describe('A5, Punkt 11: die Einstellhalle im Miteigentum', () => {
	it('fragt in der Einheitenmaske nach der Halle im Begründungsakt', () => {
		const seite = text('src/routes/gemeinschaften/[id=kennung]/einheiten/+page.svelte');
		expect(seite).toContain('Eine Einstellhalle im Begründungsakt');
		expect(seite).toContain('Platz für Platz');
		expect(seite).toContain('eine Einheit mit einer gemeinschaftlichen Partei');
		expect(seite).toContain('getrennt von den Stimmen');
		expect(seite).toContain('Nutzungsrechte');
		expect(seite).toContain('Rz. 139 und 212 ad');
		expect(seite).toContain('Rz. 24 und 27 ad Art. 712b');
	});
});

describe('A5, Punkt 12a: die Grenze am Versprechen zum Stichentscheid', () => {
	it('steht im Gemeinschaftsformular', () => {
		const formular = text('src/lib/components/GemeinschaftFormular.svelte');
		expect(formular.match(/Votum wendet die Klausel nur beim einfachen Mehr ohne Wertquoten an/g)).toHaveLength(2);
	});

	it('steht im Protokollsatz zum Stichentscheid', () => {
		expect(
			text('src/lib/domain/gemeinschaft.ts').match(/Die Klausel wird nur beim einfachen Mehr ohne Wertquoten angewandt/g)
		).toHaveLength(1);
	});

	it('steht im Handbuch an beiden Stellen', () => {
		const handbuch = text('docs/versammlung-fuehren.md');
		expect(handbuch).toContain('nur beim\neinfachen Mehr ohne Wertquoten');
		expect(handbuch).toContain('nur beim einfachen Mehr ohne Wertquoten an');
	});
});

describe('A5, Punkt 12b: Satz an die Leitung und Vermerk im Protokoll', () => {
	it('sagt der Leitung vor der Abstimmung, dass die Klausel hier nicht gilt', () => {
		expect(stichentscheidGrenzeKartensatz(zustaendigkeit('qualifiziert'), 'verwalter')).toContain(
			'gilt die Klausel bei diesem Traktandum nicht'
		);
		expect(stichentscheidGrenzeKartensatz(zustaendigkeit('qualifiziert'), 'wertquote')).toContain(
			'gilt die Klausel bei diesem Traktandum nicht'
		);
	});

	it('schweigt, wo die Klausel greift oder keiner hinterlegt ist', () => {
		expect(stichentscheidGrenzeKartensatz(zustaendigkeit('einfach'), 'verwalter')).toBeNull();
		expect(stichentscheidGrenzeKartensatz(zustaendigkeit('qualifiziert'), 'keiner')).toBeNull();
		expect(stichentscheidGrenzeKartensatz(null, 'verwalter')).toBeNull();
	});

	it('vermerkt im Protokoll den Gleichstand ohne die Klausel', () => {
		const m = snapshot('verwalter');
		const lage = {
			momentaufnahme: m,
			erfordernis: zustaendigkeit('qualifiziert'),
			stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[1], 'no')],
			anwesende: ['p1', 'p2']
		};
		const a = zaehleAus(lage);
		expect(a.angenommen).toBe(false);
		expect((a.protokollhinweise ?? []).map((h) => h.satz)).toContain(
			'Bei Stimmengleichheit wurde die hinterlegte Klausel zum Stichentscheid hier nicht angewandt: Dieses ' +
				'Traktandum verlangt ein anderes Mehr als das einfache ohne Wertquoten. Der Antrag ist ' +
				'damit abgelehnt.'
		);
	});

	const VERMERK = 'Bei Stimmengleichheit wurde die hinterlegte Klausel';
	const vermerke = (a: { protokollhinweise?: { satz: string }[] }) =>
		(a.protokollhinweise ?? []).map((h) => h.satz).join(' ');

	it('verrät den Gleichstand bei geheimer Abstimmung nicht', () => {
		const m = snapshot('verwalter');
		const a = zaehleAus({
			momentaufnahme: m,
			erfordernis: zustaendigkeit('qualifiziert'),
			stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[1], 'no')],
			anwesende: ['p1', 'p2'],
			geheim: true
		});
		expect(vermerke(a)).not.toContain(VERMERK);
	});

	it('fällt ohne Beschluss weg', () => {
		const m = snapshot('verwalter');
		const a = zaehleAus({
			momentaufnahme: m,
			erfordernis: zustaendigkeit('qualifiziert'),
			stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[1], 'no')],
			anwesende: ['p1', 'p2']
		});
		expect(vermerke(a)).toContain(VERMERK);
		expect(vermerke(mitKeinemBeschluss(a, { grund: 'konsultativ' } as never))).not.toContain(VERMERK);
	});

	it('steht auch bei der Handzählung', () => {
		const m = snapshot('verwalter');
		const a = zaehleSummenAus(
			{
				momentaufnahme: m,
				erfordernis: { ...zustaendigkeit('qualifiziert'), quotenbasis: 'keine', quotenSchwelle: null, kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } },
				anwesende: ['p1', 'p2']
			},
			{ ja: 1, nein: 1, enthaltung: 0 } as never
		);
		expect(vermerke(a)).toContain(VERMERK);
	});

	it('nennt die Grenze nicht, wo es gar kein Mehr gibt', () => {
		expect(
			stichentscheidGrenzeKartensatz({ ...zustaendigkeit('qualifiziert'), kopfSchwelle: null, quotenSchwelle: null }, 'verwalter')
		).toBeNull();
	});

	it('vermerkt nichts, wo ein Reglementsmehr auch bei Gleichstand erreicht ist', () => {
		const m = snapshot('verwalter');
		const a = zaehleAus({
			momentaufnahme: m,
			erfordernis: {
				...zustaendigkeit('qualifiziert'),
				kopfSchwelle: { zaehler: 1, nenner: 3, art: 'mindestens' },
				quotenbasis: 'keine',
				quotenSchwelle: null
			},
			stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[1], 'no')],
			anwesende: ['p1', 'p2']
		});
		expect((a.protokollhinweise ?? []).map((h) => h.satz).join(' ')).not.toContain(
			'Bei Stimmengleichheit wurde die hinterlegte Klausel'
		);
	});
});

const vermerke12c = (a: { protokollhinweise?: { satz: string }[] }) =>
	(a.protokollhinweise ?? []).map((h) => h.satz).join(' ');

describe('A5, Punkt 12c: das Mehr beim Namen, nicht immer die Einstimmigkeit', () => {
	it('spricht bei der Einstimmigkeit von Einstimmigkeit', () => {
		const m = snapshot();
		const lage = {
			momentaufnahme: m,
			erfordernis: {
				fassung: '2026-10-28',
				juristischGegengelesen: false,
				astId: 'a-sonderfaelle',
				knotenId: 'k-sonstiges',
				typ: 'einstimmigkeit',
				titel: 'Einstimmigkeit',
				rechtsgrundlage: 'ZGB Art. 712i',
				kopfbasis: 'alle_eigentuemer',
				quotenbasis: 'keine',
				kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' },
				quotenSchwelle: null,
				zustimmungBetroffenerNoetig: false,
				pfad: [],
				quelle: 'hergeleitet'
			} satisfies Erfordernis,
			// Beide Stimmberechtigten stimmen zu: Der Satz steht seit E3 nur am
			// angenommenen Antrag; bis dahin rechnete dieser Fall eine Ablehnung.
			stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[2], 'yes')],
			anwesende: ['p1', 'p2', 'p3'],
			imAusstand: ['p2']
		};
		const a = zaehleAus(lage);
		expect(a.angenommen).toBe(true);
		// `toContain` auf dem Array verlangt Elementgleichheit; der Satz hat
		// einen Nachsatz, deshalb der Vergleich auf den Anfang.
		expect((a.protokollhinweise ?? []).map((h) => h.satz)).toContain(
			'Gerechnet wurde ohne die Ausgetretenen: Die Einstimmigkeit bemisst sich hier an den ' +
				'stimmberechtigten Eigentümern. Die Gegenlesart stellt auf sämtliche im Grundbuch ' +
				'aufgeführten Eigentümer ab; danach wäre der Beschluss nicht zustande gekommen. Die Frage ' +
				'ist nicht entschieden.'
		);
	});

	it('spricht auch bei einer einstimmigen Reglementsregel von der Einstimmigkeit', () => {
		const m = snapshot();
		const a = zaehleAus({
			momentaufnahme: m,
			erfordernis: {
				fassung: '2026-10-28',
				juristischGegengelesen: false,
				astId: 'a-sonderfaelle',
				knotenId: 'k-sonstiges',
				typ: 'reglementsmehr',
				titel: 'Alle Eigentümer',
				rechtsgrundlage: 'Reglement',
				kopfbasis: 'alle_eigentuemer',
				quotenbasis: 'keine',
				kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' },
				quotenSchwelle: null,
				zustimmungBetroffenerNoetig: false,
				pfad: [],
				quelle: 'reglement'
			} as Erfordernis,
			stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[2], 'yes')],
			anwesende: ['p1', 'p2', 'p3'],
			imAusstand: ['p2']
		});
		expect(vermerke12c(a)).toContain('Die Einstimmigkeit bemisst sich hier');
	});

	it('spricht unter einer Regel «Mehrheit aller Eigentümer» vom Mehr aller Eigentümer', () => {
		const m = snapshot();
		const lage = {
			momentaufnahme: m,
			erfordernis: {
				fassung: '2026-10-28',
				juristischGegengelesen: false,
				astId: 'a-sonderfaelle',
				knotenId: 'k-sonstiges',
				typ: 'einfaches_mehr',
				titel: 'Mehrheit aller Eigentümer',
				rechtsgrundlage: 'Reglement',
				kopfbasis: 'alle_eigentuemer',
				quotenbasis: 'keine',
				kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
				quotenSchwelle: null,
				zustimmungBetroffenerNoetig: false,
				pfad: [],
				quelle: 'reglement'
			} satisfies Erfordernis,
			stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[2], 'yes')],
			anwesende: ['p1', 'p2', 'p3'],
			imAusstand: ['p2']
		};
		const a = zaehleAus(lage);
		expect(a.angenommen).toBe(true);
		// Eine grössere Zahl macht aus einer Ablehnung keine Annahme: nur am angenommenen Antrag.
		const abgelehnt = zaehleAus({ ...lage, stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[2], 'no')] });
		expect(abgelehnt.angenommen).toBe(false);
		expect((abgelehnt.protokollhinweise ?? []).map((h) => h.satz).join(' ')).not.toContain('Gerechnet wurde ohne');
		expect((a.protokollhinweise ?? []).map((h) => h.satz)).toContain(
			'Gerechnet wurde ohne die Ausgetretenen: Das Mehr aller Eigentümer bemisst sich hier an den ' +
				'stimmberechtigten Eigentümern. Mit den Ausgetretenen in der Zahl könnte die nötige Zahl grösser ' +
				'sein, und der Antrag das Mehr verfehlen. Die Frage ist nicht entschieden.'
		);
		expect((a.protokollhinweise ?? []).map((h) => h.satz)).not.toContain(
			'Gerechnet wurde ohne die Ausgetretenen: Die Einstimmigkeit bemisst sich hier an den ' +
				'stimmberechtigten Eigentümern. Die Gegenlesart stellt auf sämtliche im Grundbuch ' +
				'aufgeführten Eigentümer ab; danach wäre der Beschluss nicht zustande gekommen. Die Frage ' +
				'ist nicht entschieden.'
		);
	});
});

describe('E3: der Satz der Einstimmigkeit nur am angenommenen Antrag (Fachprüfung A5)', () => {
	const einstimmig = (m: ReturnType<typeof snapshot>) =>
		({
			fassung: '2026-10-28',
			juristischGegengelesen: false,
			astId: 'a-sonderfaelle',
			knotenId: 'k-sonstiges',
			typ: 'einstimmigkeit',
			titel: 'Einstimmigkeit',
			rechtsgrundlage: 'ZGB Art. 712i',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' },
			quotenSchwelle: null,
			zustimmungBetroffenerNoetig: false,
			pfad: [],
			quelle: 'hergeleitet'
		}) satisfies Erfordernis;

	it('nennt ihn bei einer Ablehnung weder in der Anzeige noch im Protokoll', () => {
		const m = snapshot();
		const a = zaehleAus({
			momentaufnahme: m,
			erfordernis: einstimmig(m),
			stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[2], 'no')],
			anwesende: ['p1', 'p2', 'p3'],
			imAusstand: ['p2']
		});
		expect(a.angenommen).toBe(false);
		expect(vermerke12c(a)).not.toContain('nicht zustande gekommen');
		expect(a.hinweise.join(' ')).not.toContain('nicht zustande gekommen');
	});

	it('Gegenprobe: nennt ihn am angenommenen Antrag in Anzeige und Protokoll', () => {
		const m = snapshot();
		const a = zaehleAus({
			momentaufnahme: m,
			erfordernis: einstimmig(m),
			stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[2], 'yes')],
			anwesende: ['p1', 'p2', 'p3'],
			imAusstand: ['p2']
		});
		expect(a.angenommen).toBe(true);
		expect(vermerke12c(a)).toContain('danach wäre der Beschluss nicht zustande gekommen');
		expect(a.hinweise.join(' ')).toContain('danach wäre der Beschluss nicht zustande gekommen');
	});
});

describe('A5, Punkt 13: der Satz zur Einsprache in der Mappe', () => {
	it('nennt beim Eigentümer, der verkauft, und rät, die erste Mitteilung zu klären', () => {
		const satz = einspracheMappensatz('je_eigentuemer');
		expect(satz).toContain('beim Eigentümer sein, der verkauft, vermietet oder belastet');
		expect(satz).toContain('Klären Sie sofort, wann der Vertrag zum ersten Mal mitgeteilt wurde');
		expect(einspracheMappensatz('je_einheit')).toContain(
			'beim Eigentümer sein, der verkauft, vermietet oder belastet'
		);
	});
});

describe('A5, Punkt 14: Berechtigte, Stelle und Frist am Protokollsatz der Ermächtigung', () => {
	const r: ErgebnisNachAndererLesart = {
		kennung: '1a',
		eigeneWahl: ZAEHLBASIS_ANWESENDE,
		wahl: ZAEHLBASIS_ALLE,
		verlangt: 'die Mehrheit aller Eigentümer ausser dem Beklagten',
		feststellbar: true,
		angenommen: false,
		koepfe: { ja: 3, basis: 6, schwelle: 4, erreicht: false },
		quoten: null,
		abweichend: true
	};

	it('nennt Berechtigte, Stelle und Frist', () => {
		const satz = andereLesartInWorten(r, false).protokoll!;
		expect(satz).toContain('Wer nicht zugestimmt hat, kann sie beim Gericht anfechten, innert eines Monats');
		expect(satz).toContain('wer anwesend oder vertreten war, ab der Versammlung');
		expect(satz).toContain('in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75)');
	});
});