import { describe, expect, it } from 'vitest';
import {
	baueAuszaehlmappe,
	brauchtRechnung,
	kopfstimmenUngleich,
	zaehlweise,
	schwellenformel,
	mappenrechnungAus,
	type Mappenposten
} from '../../src/lib/domain/auszaehlmappe';
import { holeRegelwerk } from '../../src/lib/rules';
import { erfordernisAusKnoten, uebersteuere, type Erfordernis } from '../../src/lib/domain/entscheidbaum';
import { LESARTEN_VORGABE } from '../../src/lib/domain/lesarten';
import { wendeReglementAn } from '../../src/lib/domain/reglement';
import { zaehleAus } from '../../src/lib/domain/auszaehlung';
import type { Snapshot } from '../../src/lib/domain/types';
import { schwelle, type Schwelle } from '../../src/lib/domain/mehrheit';
import { spaltenname, type Zelle } from '../../src/lib/domain/xlsx';
import { AUSSTAND_UNGEKLAERT } from '../../src/lib/domain/mehrhinweise';

const HAELFTE: Schwelle = { zaehler: 1, nenner: 2, art: 'mehr_als' };
const ZWEIDRITTEL: Schwelle = { zaehler: 2, nenner: 3, art: 'mindestens' };

const PARTEIEN = [
	{ name: 'Aebi', kopfstimmen: 1, wertquote: 400 },
	{ name: 'Bucher', kopfstimmen: 1, wertquote: 400 },
	{ name: 'Christen', kopfstimmen: 1, wertquote: 200 }
];

const QUALI: Mappenposten = {
	nummer: '1',
	titel: 'Fassade',
	erfordernis: 'Qualifiziertes Mehr',
	kopfbasis: 'anwesend_vertreten',
	kopfSchwelle: HAELFTE,
	quotenbasis: 'alle_quoten',
	quotenSchwelle: HAELFTE
};

function mappe(posten: Mappenposten[] = [QUALI], ausstandslesart?: 'bleibt' | 'faellt_heraus') {
	return baueAuszaehlmappe({
		ausstandslesart,
		gemeinschaftName: 'Prüf',
		datum: '1. Januar 2026',
		uhrzeit: '19:00',
		ort: 'Saal',
		gesamtquote: 1000,
		jeEinheit: false,
		parteien: PARTEIEN,
		posten
	});
}

/** Die Beschriftung einer Auswertungszeile finden. */
function zeileMit(blatt: { zeilen: Zelle[][] }, beschriftung: string): { nr: number; zellen: Zelle[] } {
	const i = blatt.zeilen.findIndex(
		(z) => z[0]?.art === 'text' && (z[0] as { wert: string }).wert === beschriftung
	);
	if (i < 0) throw new Error(`Zeile «${beschriftung}» fehlt`);
	return { nr: i + 1, zellen: blatt.zeilen[i] };
}

function formelVon(blatt: { zeilen: Zelle[][] }, beschriftung: string, spalte = 4): string {
	const z = zeileMit(blatt, beschriftung).zellen[spalte];
	if (z?.art !== 'formel') throw new Error(`«${beschriftung}» ist keine Formel, sondern ${z?.art}`);
	return z.formel;
}

/**
 * Rechnet eine Schwellenformel in JavaScript nach.
 *
 * **Warum eine eigene Auswertung und nicht die Tabellenkalkulation.** Die Mappe
 * ist der Ausweichplan für den Ausfall; sie muss dieselbe Zahl liefern wie
 * `schwelle()`, sonst steht am Ende ein Beschluss, den die Anwendung anders
 * gerechnet hätte. Die beiden Formen sind bekannt und eng — genau deshalb lässt
 * sich hier ohne fremde Bibliothek nachrechnen.
 */
function rechneSchwelle(formel: string, basis: number): number | '' {
	const m =
		/^IF\((\w+)=0,"",(?:INT\(ROUND\(\1\*(\d+)\/(\d+),6\)\)\+1|CEILING\(ROUND\(\1\*(\d+)\/(\d+),6\),1\))\)$/.exec(
			formel
		);
	if (!m) throw new Error(`unerwartete Form: ${formel}`);
	if (basis === 0) return '';
	const mehrAls = m[2] !== undefined;
	const zaehler = Number(mehrAls ? m[2] : m[4]);
	const nenner = Number(mehrAls ? m[3] : m[5]);
	const roh = Math.round(((basis * zaehler) / nenner) * 1e6) / 1e6;
	return mehrAls ? Math.trunc(roh) + 1 : Math.ceil(roh);
}

describe('Spaltennamen', () => {
	it('zählt über Z hinaus weiter', () => {
		// Eine Versammlung mit mehr als 26 abstimmbaren Traktanden ist selten,
		// aber eine falsche Formel fiele erst im Saal auf.
		expect(spaltenname(0)).toBe('A');
		expect(spaltenname(25)).toBe('Z');
		expect(spaltenname(26)).toBe('AA');
		expect(spaltenname(27)).toBe('AB');
		expect(spaltenname(51)).toBe('AZ');
		expect(spaltenname(52)).toBe('BA');
	});
});

describe('Wer in die Mappe gehört', () => {
	it('nimmt jedes Traktandum mit Wertquotenschranke', () => {
		expect(brauchtRechnung(QUALI, false)).toBe(true);
	});

	it('lässt das einfache Mehr der Anwesenden bei gleichen Kopfstimmen weg', () => {
		const einfach: Mappenposten = { ...QUALI, quotenbasis: 'keine', quotenSchwelle: null };
		expect(brauchtRechnung(einfach, false)).toBe(false);
	});

	it('nimmt das einfache Mehr der Anwesenden auf, wenn der Beklagte nicht mitstimmt', () => {
		/*
		 * Die Ausschlussklage unter einer Klausel der Anwesenden (29.09.2026,
		 * Codeprüfung M-2). In den drei alten Fragen sah sie aus wie ein
		 * einfaches Mehr und fiel aus der Mappe; im Ausfall zählte der Saal den
		 * Beklagten dann mit.
		 */
		const klausel: Mappenposten = {
			...QUALI,
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			quotenSchwelle: null,
			ohneBetroffene: true
		};
		expect(brauchtRechnung(klausel, false)).toBe(true);
		expect(brauchtRechnung({ ...klausel, ohneBetroffene: false }, false)).toBe(false);
	});

	it('nimmt es mit, sobald die Schwelle nicht die halbe ist', () => {
		/*
		 * **Der fünfte Grund** (04.09.2026, Prüfdurchgang). Ein Zweidrittelmehr aus
		 * dem Reglement, auf der Basis der Anwesenden und ohne Quotenschranke, sah
		 * in den drei alten Fragen aus wie ein einfaches Mehr und fiel aus der
		 * Mappe. Gemessen stand es dort als «Einfaches Mehr der Anwesenden».
		 *
		 * Zwei Drittel von dreizehn Anwesenden sind neun, und das sieht man einem
		 * Saal voller erhobener Hände nicht an.
		 */
		const grund: Mappenposten = { ...QUALI, quotenbasis: 'keine', quotenSchwelle: null };
		/*
		 * **Beide Hälften der Bedingung einzeln.** `ZWEIDRITTEL` trägt
		 * `art: 'mindestens'`, prüft also nur die Art. Ohne den Fall darunter
		 * bliebe die Probe grün, wenn man den Bruchvergleich aus
		 * `istEinfachesMehr` streicht.
		 */
		expect(brauchtRechnung({ ...grund, kopfSchwelle: ZWEIDRITTEL }, false)).toBe(true);
		expect(
			brauchtRechnung(
				{ ...grund, kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mehr_als' } },
				false
			)
		).toBe(true);
	});

	it('lässt «mehr als die Hälfte» auch als 2/4 durchgehen', () => {
		// Der Bruch wird über den Nenner verglichen, nicht über die Zeichenkette.
		const zweiviertel: Mappenposten = {
			...QUALI,
			quotenbasis: 'keine',
			quotenSchwelle: null,
			kopfSchwelle: { zaehler: 2, nenner: 4, art: 'mehr_als' }
		};
		expect(brauchtRechnung(zweiviertel, false)).toBe(false);
	});

	it('behandelt «mindestens die Hälfte» als rechenbedürftig', () => {
		/*
		 * «Mindestens die Hälfte» ist bei gerader Zahl etwas anderes als «mehr als
		 * die Hälfte»: bei zwanzig Stimmen zehn gegen elf. Erhobene Hände zeigen
		 * das nicht.
		 */
		const mindestens: Mappenposten = {
			...QUALI,
			quotenbasis: 'keine',
			quotenSchwelle: null,
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mindestens' }
		};
		expect(brauchtRechnung(mindestens, false)).toBe(true);
	});

	it('nimmt es mit, sobald das Reglement die Enthaltungen aus der Basis nimmt', () => {
		/*
		 * **Der vierte Grund** (04.09.2026). Eine Regel, die allein die
		 * Enthaltungen herausnimmt, sieht in den drei alten Fragen aus wie ein
		 * einfaches Mehr und fiel deshalb aus der Mappe. Die Mappe ist die
		 * Unterlage für den Ausfall: Sie hätte dem Saal gesagt, Handzählen genüge,
		 * und zwar gegen eine Bezugsgrösse, die die Zahl der erhobenen Hände nicht
		 * mehr ist.
		 */
		const einfach: Mappenposten = {
			...QUALI,
			quotenbasis: 'keine',
			quotenSchwelle: null,
			enthaltungZaehltMit: false
		};
		expect(brauchtRechnung(einfach, false)).toBe(true);
	});

	it('zieht die Enthaltungen dann auch in der Formel ab', () => {
		/*
		 * **Die Mappe ist ein zweiter Rechenweg.** Ihre Formeln rechnet eine
		 * Tabellenkalkulation, nicht `zaehleAus`. Was dort die Bezugsgrösse
		 * verändert, muss hier mitwandern, sonst verkündet die Anwendung das eine
		 * und die ausgedruckte Mappe das andere, und beide Zahlen sehen amtlich
		 * aus.
		 */
		const grund: Mappenposten = { ...QUALI, quotenbasis: 'keine', quotenSchwelle: null };
		const formelOhne = formelVon(
			mappe([{ ...grund, enthaltungZaehltMit: true }]),
			'Bezugsgrösse Kopfstimmen'
		);
		const formelMit = formelVon(
			mappe([{ ...grund, enthaltungZaehltMit: false }]),
			'Bezugsgrösse Kopfstimmen'
		);
		// Genau ein Abzug mehr, und die bisherige Formel steht unverändert davor.
		// Seit Lesarten Block 2 drei Abzüge ohne: 9, 8 (Entscheid 0020) und 7 (1e).
		expect(formelOhne.split('-SUMIFS').length).toBe(4);
		expect(formelMit.split('-SUMIFS').length).toBe(5);
		expect(formelMit.startsWith(formelOhne)).toBe(true);
	});

	it('nimmt es aber mit, sobald die Kopfstimmen ungleich sind', () => {
		// Dann sind erhobene Hände nicht mehr die Zahl, auf die es ankommt.
		const einfach: Mappenposten = { ...QUALI, quotenbasis: 'keine', quotenSchwelle: null };
		expect(brauchtRechnung(einfach, true)).toBe(true);
		expect(kopfstimmenUngleich([...PARTEIEN, { name: 'Dubs', kopfstimmen: 2, wertquote: 0 }])).toBe(
			true
		);
		expect(kopfstimmenUngleich(PARTEIEN)).toBe(false);
	});

	it('nimmt auch mit, was die Abwesenden mitzählt', () => {
		const einstimmig: Mappenposten = {
			...QUALI,
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			quotenSchwelle: null
		};
		expect(brauchtRechnung(einstimmig, false)).toBe(true);
	});
});

describe('Die Schwellenformel rechnet wie schwelle()', () => {
	/*
	 * **Der eigentliche Prüfpunkt der Mappe.** Sie darf nicht «ungefähr so»
	 * rechnen wie die Anwendung — sonst steht am Ende ein Beschluss, den niemand
	 * nachvollziehen kann.
	 */
	for (const s of [HAELFTE, ZWEIDRITTEL, { zaehler: 3, nenner: 4, art: 'mindestens' } as Schwelle]) {
		it(`für ${s.zaehler}/${s.nenner} (${s.art}) über alle Bezugsgrössen bis 1000`, () => {
			const formel = schwellenformel('E18', s);
			for (let basis = 1; basis <= 1000; basis++) {
				expect(rechneSchwelle(formel, basis)).toBe(schwelle(basis, s));
			}
		});
	}

	it('gibt bei leerer Bezugsgrösse nichts aus statt null', () => {
		// `zaehleAus` setzt die Schwelle dann auf `null` und erreicht nichts; eine
		// «0» in der Mappe hiesse dagegen: von null Stimmen genügen null.
		expect(rechneSchwelle(schwellenformel('E18', HAELFTE), 0)).toBe('');
	});
});

describe('Der Aufbau des Blattes', () => {
	it('legt je Partei eine Zeile und je Traktandum eine Spalte an', () => {
		const b = mappe([QUALI, { ...QUALI, nummer: '2', titel: 'Dach' }]);
		const kopf = zeileMit(b, 'Partei');
		expect(kopf.zellen.length).toBe(4 + 2);
		// Direkt unter dem Kopf stehen die Parteien.
		const ersteMatrixzeile = b.zeilen[kopf.nr];
		expect((ersteMatrixzeile[0] as { wert: string }).wert).toBe('Aebi');
		expect((ersteMatrixzeile[1] as { wert: number }).wert).toBe(1);
		expect((ersteMatrixzeile[2] as { wert: number }).wert).toBe(400);
		// Eingabefelder sind als solche gekennzeichnet.
		expect(ersteMatrixzeile[3].stil).toBe('eingabe');
		expect(ersteMatrixzeile[4].stil).toBe('eingabe');
	});

	it('summiert Ja, Nein und Enthaltung über genau die Parteizeilen', () => {
		const b = mappe();
		const kopf = zeileMit(b, 'Partei').nr;
		const von = kopf + 1;
		const bis = kopf + PARTEIEN.length;
		expect(formelVon(b, 'Ja (Kopfstimmen)')).toBe(`SUMIF(E$${von}:E$${bis},1,$B$${von}:$B$${bis})`);
		expect(formelVon(b, 'Nein (Kopfstimmen)')).toBe(
			`SUMIF(E$${von}:E$${bis},3,$B$${von}:$B$${bis})`
		);
		expect(formelVon(b, 'Enthaltung (Kopfstimmen)')).toBe(
			`SUMIF(E$${von}:E$${bis},2,$B$${von}:$B$${bis})`
		);
		expect(formelVon(b, 'Ja (Wertquoten)')).toBe(`SUMIF(E$${von}:E$${bis},1,$C$${von}:$C$${bis})`);
	});

	it('bildet die Bezugsgrösse der Köpfe aus den Anwesenden, ohne die Ausgetretenen', () => {
		const b = mappe();
		const kopf = zeileMit(b, 'Partei').nr;
		const von = kopf + 1;
		const bis = kopf + PARTEIEN.length;
		// Und ohne wen nur jemand im Ausstand vertritt (8, Entscheid 0020) und
		// ohne wen 1e im Ausstand in der Zahl hält (7).
		expect(formelVon(b, 'Bezugsgrösse Kopfstimmen')).toBe(
			`SUMIF($D$${von}:$D$${bis},1,$B$${von}:$B$${bis})` +
				`-SUMIFS($B$${von}:$B$${bis},$D$${von}:$D$${bis},1,E$${von}:E$${bis},9)` +
				`-SUMIFS($B$${von}:$B$${bis},$D$${von}:$D$${bis},1,E$${von}:E$${bis},8)` +
				`-SUMIFS($B$${von}:$B$${bis},$D$${von}:$D$${bis},1,E$${von}:E$${bis},7)`
		);
	});

	it('nimmt bei alle_eigentuemer auch die Abwesenden in die Bezugsgrösse', () => {
		const b = mappe([{ ...QUALI, kopfbasis: 'alle_eigentuemer' }]);
		const kopf = zeileMit(b, 'Partei').nr;
		const von = kopf + 1;
		const bis = kopf + PARTEIEN.length;
		expect(formelVon(b, 'Bezugsgrösse Kopfstimmen')).toBe(
			`SUM($B$${von}:$B$${bis})-SUMIF(E$${von}:E$${bis},9,$B$${von}:$B$${bis})`
		);
	});

	it('setzt bei alle_quoten die ganze Gemeinschaftsquote als feste Zahl', () => {
		// Die strengere Lesart: Die Quote im Ausstand bleibt in der Basis (Ä-27,
		// `AUSSTAND_UNGEKLAERT`; so rechnet auch zaehleAus).
		const b = mappe();
		const zelle = zeileMit(b, 'Bezugsgrösse Wertquoten').zellen[4];
		expect(zelle.art).toBe('zahl');
		expect((zelle as { wert: number }).wert).toBe(1000);
	});

	/**
	 * **Der Ausstand und die absolute Wertquotenschranke** (Auftraggeber, 20.08.2026).
	 *
	 * Gerechnet war der Fall schon — eine 9 nimmt die Partei aus allen Eimern.
	 * Was fehlte, war die Folge: Bei «mehr als die Hälfte ALLER Wertquoten»
	 * bleibt die Schranke stehen, und damit kann das Erfordernis unerreichbar
	 * werden. Das muss vor der Abstimmung dastehen.
	 */
	it('zeigt beim absoluten Quotenmehr, was im Ausstand steht und was noch erreichbar ist', () => {
		const b = mappe();
		const kopf = zeileMit(b, 'Partei').nr;
		const von = kopf + 1;
		const bis = kopf + PARTEIEN.length;

		expect(formelVon(b, 'Wertquoten im Ausstand (9)')).toBe(
			`SUMIF(E$${von}:E$${bis},9,$C$${von}:$C$${bis})`
		);
		// Erreichbar ist die ganze Gemeinschaftsquote abzüglich dessen, was im
		// Ausstand steht — die Schranke selbst sinkt nicht.
		const ausstandszeile = zeileMit(b, 'Wertquoten im Ausstand (9)').nr;
		expect(formelVon(b, 'Noch erreichbar (Wertquoten)')).toBe(`1000-E${ausstandszeile}`);
		expect(formelVon(b, 'Erfordernis überhaupt noch erreichbar?')).toContain(
			'"NEIN — zu viel Wertquote im Ausstand"'
		);
	});

	it('lässt die Erreichbarkeit weg, wo die Quote an den Anwesenden hängt', () => {
		// Dort schrumpft die Bezugsgrösse mit dem Ausstand; eine Schranke, die
		// mitsinkt, kann nicht unerreichbar werden.
		const b = mappe([{ ...QUALI, quotenbasis: 'anwesend_vertreten' }]);
		expect(zeileMit(b, 'Noch erreichbar (Wertquoten)').zellen[4]).toMatchObject({ art: 'text' });
		expect(zeileMit(b, 'Erfordernis überhaupt noch erreichbar?').zellen[4]).toMatchObject({
			art: 'text'
		});
	});

	it('lässt die Quotenzeilen leer, wo es kein Quotenerfordernis gibt', () => {
		const b = mappe([{ ...QUALI, quotenbasis: 'keine', quotenSchwelle: null }]);
		expect(zeileMit(b, 'Bezugsgrösse Wertquoten').zellen[4]).toMatchObject({ art: 'text' });
		expect(zeileMit(b, 'Quotenmehr erreicht').zellen[4]).toMatchObject({
			art: 'text',
			wert: 'entfällt'
		});
		// Und das Ergebnis hängt dann nur am Kopfmehr.
		expect(formelVon(b, 'Ergebnis')).not.toContain('Quotenmehr');
		expect(formelVon(b, 'Ergebnis')).toContain('"ANGENOMMEN"');
	});

	it('nennt am Fuss, was nicht in der Mappe steht', () => {
		// Eine Mappe, die zwölf von vierzehn Traktanden zeigt und darüber
		// schweigt, liest sich wie eine vollständige.
		const b = baueAuszaehlmappe({
			gemeinschaftName: 'Prüf',
			datum: '1.',
			uhrzeit: '19:00',
			ort: 'Saal',
			gesamtquote: 1000,
			jeEinheit: false,
			parteien: PARTEIEN,
			posten: [QUALI],
			ausgelassen: [{ nummer: '4', titel: 'Verschiedenes', grund: 'Kenntnisnahme' }]
		});
		const text = b.zeilen
			.flat()
			.filter((z): z is { art: 'text'; wert: string } => z.art === 'text')
			.map((z) => z.wert)
			.join(' | ');
		expect(text).toContain('Nicht in dieser Mappe');
		expect(text).toContain('4 Verschiedenes — Kenntnisnahme');
		expect(text).toContain('Geheime Abstimmung');
	});
});

/*
 * **Ä-27: Die Mappe rechnet den Ausstand wie die Auszählung**
 * (`docs/entscheide/0010`). Der Fall aus der Entscheidvorlage: vier Parteien
 * zu 250, D im Ausstand (9), A und B Ja (1), C Nein (3). Die Formeln werden
 * hier ausgewertet, nicht nur ihr Wortlaut verglichen: Erwartet ist dieselbe
 * Basis, Schwelle und dasselbe Ergebnis wie in `tests/domain/auszaehlung.test.ts`,
 * «Ä-27: Ausstand und Wertquotenbasis».
 */
describe('Ä-27: Ausstand in der Auszählmappe', () => {
	const VIER = ['A', 'B', 'C', 'D'].map((name) => ({ name, kopfstimmen: 1, wertquote: 250 }));
	const EINTRAG = [1, 1, 3, 9];

	/** Wertet die Formeln eines Blatts mit den gelben Feldern aus. */
	function rechner(blatt: { zeilen: Zelle[][] }, eingaben: Map<string, number>) {
		const zelle = (ref: string): number | string => {
			const r = ref.replace(/\$/g, '');
			if (eingaben.has(r)) return eingaben.get(r)!;
			const m = /^([A-Z]+)(\d+)$/.exec(r)!;
			const spalte = m[1].charCodeAt(0) - 65;
			const z = blatt.zeilen[Number(m[2]) - 1]?.[spalte];
			if (!z) return 0;
			if (z.art === 'zahl') return (z as { wert: number }).wert;
			if (z.art === 'formel') return werte(z.formel);
			return (z as { wert?: string }).wert ?? '';
		};
		const bereich = (von: string, bis: string): (number | string)[] => {
			const [a, b] = [von, bis].map((x) => /^\$?([A-Z]+)\$?(\d+)$/.exec(x)!);
			const out: (number | string)[] = [];
			for (let n = Number(a[2]); n <= Number(b[2]); n++) out.push(zelle(`${a[1]}${n}`));
			return out;
		};
		function werte(formel: string): number | string {
			const t = formel.match(/"[^"]*"|\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+|\$?[A-Z]+\$?\d+|[A-Z]+(?=\()|\d+(?:\.\d+)?|>=|<=|<>|[-+*/(),=<>]/g)!;
			let i = 0;
			const weiter = () => t[i++];
			const sieh = () => t[i];
			type W = number | string | (number | string)[];
			function vergleich(): W {
				let l = summe();
				while (['=', '>=', '<=', '>', '<', '<>'].includes(sieh())) {
					const op = weiter();
					const r = summe();
					const [x, y] = [l, r] as [number, number];
					l = op === '=' ? +(x === y) : op === '>=' ? +(x >= y) : op === '<=' ? +(x <= y) : op === '>' ? +(x > y) : op === '<' ? +(x < y) : +(x !== y);
				}
				return l;
			}
			function summe(): W {
				let l = produkt();
				while (sieh() === '+' || sieh() === '-') {
					const op = weiter();
					const r = produkt() as number;
					l = op === '+' ? (l as number) + r : (l as number) - r;
				}
				return l;
			}
			function produkt(): W {
				let l = einzeln();
				while (sieh() === '*' || sieh() === '/') {
					const op = weiter();
					const r = einzeln() as number;
					l = op === '*' ? (l as number) * r : (l as number) / r;
				}
				return l;
			}
			function argumente(): W[] {
				const a: W[] = [];
				weiter(); // (
				if (sieh() !== ')') {
					a.push(vergleich());
					while (sieh() === ',') {
						weiter();
						a.push(vergleich());
					}
				}
				weiter(); // )
				return a;
			}
			function einzeln(): W {
				const k = weiter();
				if (k === '-') return -(einzeln() as number);
				if (k === '(') {
					const v = vergleich();
					weiter();
					return v;
				}
				if (k.startsWith('"')) return k.slice(1, -1);
				if (/^\d/.test(k)) return Number(k);
				if (k.includes(':')) {
					const [von, bis] = k.split(':');
					return bereich(von, bis);
				}
				if (/^\$?[A-Z]+\$?\d+$/.test(k)) return zelle(k);
				const a = argumente();
				const zahlen = (x: W) => (x as (number | string)[]).map((v) => (typeof v === 'number' ? v : 0));
				switch (k) {
					case 'SUM':
						return zahlen(a[0]).reduce((s, v) => s + v, 0);
					case 'SUMIF': {
						const r = a[0] as (number | string)[];
						return zahlen(a[2]).reduce((s, v, j) => (r[j] === a[1] ? s + v : s), 0);
					}
					case 'SUMIFS': {
						const werteListe = zahlen(a[0]);
						return werteListe.reduce((s, v, j) => {
							for (let p = 1; p < a.length; p += 2) {
								if ((a[p] as (number | string)[])[j] !== a[p + 1]) return s;
							}
							return s + v;
						}, 0);
					}
					case 'IF':
						return a[0] ? a[1] : a[2];
					case 'AND':
						return +a.every(Boolean);
					case 'INT':
						return Math.floor(a[0] as number);
					case 'ROUND':
						return Math.round((a[0] as number) * 10 ** (a[1] as number)) / 10 ** (a[1] as number);
					case 'CEILING':
						return Math.ceil((a[0] as number) / (a[1] as number)) * (a[1] as number);
					default:
						throw new Error(`Funktion ${k} kennt der Prüfrechner nicht`);
				}
			}
			return vergleich() as number | string;
		}
		return (beschriftung: string) => {
			const nr = zeileMit(blatt, beschriftung).nr;
			return zelle(`E${nr}`);
		};
	}

	function fall(quotenbasis: 'alle_quoten' | 'anwesend_vertreten') {
		const b = baueAuszaehlmappe({
			gemeinschaftName: 'Prüf',
			datum: '18. Oktober 2026',
			uhrzeit: '19:00',
			ort: 'Saal',
			gesamtquote: 1000,
			jeEinheit: false,
			parteien: VIER,
			posten: [{ ...QUALI, quotenbasis }]
		});
		const kopf = zeileMit(b, 'Partei').nr;
		const eingaben = new Map<string, number>();
		VIER.forEach((_p, j) => {
			eingaben.set(`D${kopf + 1 + j}`, 1);
			eingaben.set(`E${kopf + 1 + j}`, EINTRAG[j]);
		});
		return rechner(b, eingaben);
	}

	it('rechnet unter «alle Wertquoten» mit 1000, nötig 501: abgelehnt', () => {
		const r = fall('alle_quoten');
		expect(r('Ja (Wertquoten)')).toBe(500);
		expect(r('Bezugsgrösse Wertquoten')).toBe(1000);
		expect(r('Nötig (Wertquoten)')).toBe(501);
		expect(r('Wertquoten im Ausstand (9)')).toBe(250);
		expect(r('Kopfmehr erreicht')).toBe('ja');
		expect(r('Ergebnis')).toBe('abgelehnt');
	});

	it('rechnet unter «anwesend/vertreten» mit 750, nötig 376: angenommen', () => {
		const r = fall('anwesend_vertreten');
		expect(r('Bezugsgrösse Wertquoten')).toBe(750);
		expect(r('Nötig (Wertquoten)')).toBe(376);
		expect(r('Ergebnis')).toBe('ANGENOMMEN');
	});

	it('führt den Satz zur offenen Frage', () => {
		const b = mappe();
		const texte = b.zeilen.flat().map((z) => (z as { wert?: unknown }).wert);
		expect(texte.some((w) => typeof w === 'string' && w.includes(AUSSTAND_UNGEKLAERT))).toBe(true);
	});

	/*
	 * **Fachprüfung Textrunde 0050, Runde 3, R3-F-1** (gemessen 14.11.2026 mit
	 * `scripts/mappe-nachrechnen.mjs`, Code 3, Calc 4): Unter einer von Hand
	 * gesetzten Basis «aller Eigentümer» liess die Mappe an der Ausschlussklage
	 * auch den Beklagten mit seiner 9 in der Zahl; Kern und Gesetz nehmen ihn aus
	 * (ZGB Art. 649b Abs. 2). A ist beklagt bzw. betroffen (9), D im Ausstand
	 * (an der Klage als Angehöriger mit 7).
	 */
	describe('von Hand gesetzte Basis «aller Eigentümer», Mappe gegen Kern (R3-F-1)', () => {
		const M: Snapshot = {
			meetingId: 'v-1',
			takenAt: '2026-11-16T17:00:00.000Z',
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			headCountRuleSource: null,
			tieBreak: 'keiner',
			totalQuota: 1000,
			parties: VIER.map((p) => ({
				partyId: p.name,
				displayName: p.name,
				representativeName: null,
				isCommunity: false,
				units: [{ unitId: `${p.name}-u`, label: `Whg ${p.name}`, kind: 'unit' as const, countsAsHead: true, quota: 250 }]
			}))
		};
		const rw = holeRegelwerk('2026-11-16');
		function vonHand(knotenId: string): Erfordernis {
			const k = rw.knoten.find((x) => x.id === knotenId)!;
			const vorschlag = wendeReglementAn(erfordernisAusKnoten(rw, k), [], null, LESARTEN_VORGABE).erfordernis;
			return uebersteuere(rw, vorschlag, 'einfaches_mehr', 'So stand es in der Einladung', {
				kopfbasis: 'alle_eigentuemer'
			}).ergebnis;
		}
		function mappeUndKern(e: Erfordernis, eintrag: number[]) {
			const b = baueAuszaehlmappe({
				gemeinschaftName: 'Prüf',
				datum: '16. November 2026',
				uhrzeit: '19:00',
				ort: 'Saal',
				gesamtquote: 1000,
				jeEinheit: false,
				parteien: VIER,
				posten: [{ nummer: '1', titel: 'Probe', ...mappenrechnungAus(e, M)! }]
			});
			const kopf = zeileMit(b, 'Partei').nr;
			const eingaben = new Map<string, number>();
			VIER.forEach((_p, j) => {
				eingaben.set(`D${kopf + 1 + j}`, 1);
				eingaben.set(`E${kopf + 1 + j}`, eintrag[j]);
			});
			const kern = zaehleAus({
				momentaufnahme: M,
				erfordernis: e,
				stimmen: [
					{ partyId: 'B', unitId: 'B-u', choice: 'yes', castAt: '2026-11-16T19:10:00.000Z', recordedByChair: false },
					{ partyId: 'C', unitId: 'C-u', choice: 'no', castAt: '2026-11-16T19:10:00.000Z', recordedByChair: false }
				],
				anwesende: ['A', 'B', 'C', 'D'],
				imAusstand: ['D'],
				betroffeneParteiIds: ['A']
			});
			return { mappe: rechner(b, eingaben)('Bezugsgrösse Kopfstimmen'), kern: kern.koepfe.basis };
		}

		it('an der Ausschlussklage: der Beklagte fällt heraus, der Angehörige bleibt, in Mappe und Kern', () => {
			const r = mappeUndKern(vonHand('k-ausschlussklage'), [9, 1, 3, 7]);
			expect(r.kern).toBe(3);
			expect(r.mappe).toBe(r.kern);
		});

		// An der Einsprache tragen Betroffene und Ausstand dieselbe 9; beide fallen heraus,
		// wie unter L13, das dort nicht wirkt (Folge aus Entscheid 0050, Antwort 1).
		it('an der Einsprache: die Betroffene und der Ausstand fallen heraus, in Mappe und Kern', () => {
			const r = mappeUndKern(vonHand('k-einsprache'), [9, 1, 3, 9]);
			expect(r.kern).toBe(2);
			expect(r.mappe).toBe(r.kern);
		});
	});
});

describe('Die Mappe nach der Lesart L1 und der Regel 1e (Migration 170, Fassung 2026-10-25)', () => {
	it('nach «fällt heraus» zieht die Bezugsgrösse die Quoten mit 9 ab', () => {
		const b = mappe([{ ...QUALI, ausstandFaelltHeraus: true }], 'faellt_heraus');
		const { von, bis } = (() => {
			const erste = b.zeilen.findIndex((z) => z[0]?.art === 'text' && (z[0] as { wert: string }).wert === 'Aebi') + 1;
			return { von: erste, bis: erste + PARTEIEN.length - 1 };
		})();
		expect(formelVon(b, 'Bezugsgrösse Wertquoten')).toBe(`1000-SUMIF(E$${von}:E$${bis},9,$C$${von}:$C$${bis})`);
		const text = b.zeilen.flat().map((z) => (z.art === 'text' ? z.wert : '')).join(' ');
		expect(text).toContain('Gerechnet wird an allen Wertquoten der Gemeinschaft ausser denen mit 9.');
		expect(text).toContain('«Wertquote fällt heraus»');
	});

	it('nach der Vorgabe bleibt die ganze Gemeinschaftsquote, mit dem Satz zur Vorgabe', () => {
		const b = mappe([QUALI]);
		expect(zeileMit(b, 'Bezugsgrösse Wertquoten').zellen[4]).toMatchObject({ art: 'zahl', wert: 1000 });
		const text = b.zeilen.flat().map((z) => (z.art === 'text' ? z.wert : '')).join(' ');
		expect(text).toContain('«Wertquote zählt mit»');
	});

	it('bei der Ausschlussklage ab 2026-10-25 sagt die Anleitung, dass Angehörige 7 bekommen', () => {
		const klage: Mappenposten = {
			...QUALI,
			erfordernis: 'Ermächtigung zur Ausschlussklage',
			kopfbasis: 'alle_ausser_betroffene',
			quotenbasis: 'keine',
			quotenSchwelle: null,
			ohneBetroffene: true,
			ausstandBleibtInDerZahl: true
		};
		const text = (p: Mappenposten) =>
			mappe([p]).zeilen.flat().map((z) => (z.art === 'text' ? z.wert : '')).join(' ');
		expect(text(klage)).toContain('bei der Ausschlussklage für Angehörige des Beklagten im Ausstand, nicht 9');
		expect(text(klage)).not.toContain('leer lassen');
		expect(text({ ...klage, ausstandBleibtInDerZahl: false })).not.toContain('Angehörige des Beklagten im Ausstand');
	});
});

describe('Eintrag 8: nur über eine Person im Ausstand vertreten (Entscheid 0020)', () => {
	it('fällt aus der Basis der Anwesenden, bleibt beim Mehr aller Wertquoten', () => {
		const b = mappe([{ ...QUALI, ausstandFaelltHeraus: true }], 'faellt_heraus');
		expect(formelVon(b, 'Bezugsgrösse Kopfstimmen')).toContain(',8)');
		expect(formelVon(b, 'Bezugsgrösse Wertquoten')).not.toContain(',8,');
		const anwesend = mappe([{ ...QUALI, quotenbasis: 'anwesend_vertreten' }]);
		expect(formelVon(anwesend, 'Bezugsgrösse Wertquoten')).toContain(',8)');
		const text = b.zeilen.flat().map((z) => (z.art === 'text' ? z.wert : '')).join(' ');
		expect(text).toContain('tragen Sie 8 ein, nicht 9');
	});
});

describe('Eintrag 7: im Ausstand, aber in der Zahl (1e; Review DeepSeek Block 2, Befunde 1 und 5)', () => {
	const KLAGE: Mappenposten = {
		...QUALI,
		erfordernis: 'Ermächtigung zur Ausschlussklage',
		kopfbasis: 'alle_ausser_betroffene',
		quotenbasis: 'anwesend_vertreten',
		ohneBetroffene: true,
		ausstandBleibtInDerZahl: true
	};

	it('fällt aus der Quote der Anwesenden, bleibt in der Kopfzahl über alle', () => {
		const b = mappe([KLAGE]);
		expect(formelVon(b, 'Bezugsgrösse Wertquoten')).toContain(',7)');
		expect(formelVon(b, 'Bezugsgrösse Kopfstimmen')).not.toContain(',7');
	});

	it('bleibt beim Mehr aller Wertquoten im Nenner, ist aber nicht mehr erreichbar', () => {
		const b = mappe([{ ...KLAGE, quotenbasis: 'alle_quoten' }]);
		expect(zeileMit(b, 'Bezugsgrösse Wertquoten').zellen[4]).toMatchObject({ art: 'zahl', wert: 1000 });
		// Seit A3 nennt die Zeile den Beklagten mit, wo Betroffene nicht mitstimmen.
		expect(formelVon(b, 'Wertquoten im Ausstand oder der Betroffenen (9, 7)')).toContain(',7,');
		// Ohne Traktandum nach 1e kennt die Mappe keine 7 (Laienprüfung Runde 5, N4).
		expect(formelVon(mappe([QUALI]), 'Wertquoten im Ausstand (9)')).not.toContain(',7,');
	});
});

describe('Die 9 für Betroffene nur, wo sie nicht mitstimmen (Review DeepSeek Block 2, Befund 2)', () => {
	const text = (b: { zeilen: Zelle[][] }) =>
		b.zeilen.flat().map((z) => (z.art === 'text' ? z.wert : '')).join(' ');

	it('nennt Betroffene bei der 9 nicht, wo kein Traktandum sie ausnimmt', () => {
		const b = mappe([QUALI]);
		expect(text(b)).toContain('zählt bei DIESEM Traktandum nicht mit: im Ausstand.');
		expect(text(b)).not.toContain('unmittelbar betroffen');
		expect(() => zeileMit(b, 'Unmittelbar Betroffene')).toThrow();
	});

	it('sagt je Traktandum, ob Betroffene mitstimmen', () => {
		const b = mappe([QUALI, { ...QUALI, nummer: '2', ohneBetroffene: true }]);
		expect(text(b)).toContain('oder unmittelbar betroffen, wo die Zeile «Unmittelbar Betroffene» «stimmen nicht mit» sagt');
		const zeile = zeileMit(b, 'Unmittelbar Betroffene').zellen;
		expect(zeile[4]).toMatchObject({ wert: 'stimmen mit: keine 9, ausser im Ausstand' });
		expect(zeile[5]).toMatchObject({ wert: 'stimmen nicht mit: 9' });
		// Die gemeinsame Wohnung des Beklagten bekommt seit A3 die 7 statt leer:
		// Leer zählte sie in einer Quote der Anwesenden mit, der Kern nicht.
		const wohnung = zeileMit(mappe([{ ...QUALI, ohneBetroffene: true, beklagtenwohnungZaehltMit: true }]), 'Unmittelbar Betroffene');
		expect(wohnung.zellen[4]).toMatchObject({
			wert: 'stimmen nicht mit: 9; gemeinsame Wohnung des Beklagten: 7, siehe oben'
		});
	});
});

/*
 * Block C, L13 «Alle Eigentümer» (Codeprüfung Block C, Lauf 1 H1 und Lauf 2
 * M-B, M-C): Der Ausstand bleibt in der Kopfzahl, eingetragen mit 9; wo die
 * Mappe die 7 erklärt, rechnet eine 7 ausserhalb der Ausschlussklage wie die 9.
 * Nachgerechnet mit LibreOffice in `scripts/mappe-nachrechnen.mjs`; hier die
 * Formeln, damit der Prüflauf sie fasst.
 */
describe('Zählweise der Köpfe (L13) in der Mappe', () => {
	const ALLE: Mappenposten = { ...QUALI, kopfbasis: 'alle_eigentuemer', ausstandNachZaehlweise: true };
	const KLAGE: Mappenposten = {
		...QUALI,
		nummer: '2',
		erfordernis: 'Ermächtigung zur Ausschlussklage',
		kopfbasis: 'alle_ausser_betroffene',
		quotenbasis: 'anwesend_vertreten',
		ohneBetroffene: true,
		ausstandBleibtInDerZahl: true,
		ausschlussklage: true
	};
	const bereich = (b: { zeilen: Zelle[][] }) => {
		const erste = b.zeilen.findIndex((z) => z[0]?.art === 'text' && (z[0] as { wert: string }).wert === 'Aebi') + 1;
		return { von: erste, bis: erste + PARTEIEN.length - 1 };
	};

	it('lässt den Ausstand unter «Alle Eigentümer» in der Kopfzahl, ohne die 7 zu erklären', () => {
		const b = mappe([ALLE]);
		const { von, bis } = bereich(b);
		expect(formelVon(b, 'Bezugsgrösse Kopfstimmen')).toBe(`SUM($B$${von}:$B$${bis})`);
		const text = b.zeilen.flat().map((z) => (z.art === 'text' ? z.wert : '')).join(' ');
		expect(text).not.toContain('Zählweise «Alle Eigentümer»');
		expect(() => zeileMit(b, 'Wertquoten im Ausstand (9)')).not.toThrow();
		// Gegenprobe: «aller» ohne die Zählweise nimmt die 9 heraus.
		const ohne = mappe([{ ...ALLE, ausstandNachZaehlweise: false }]);
		const r = bereich(ohne);
		expect(formelVon(ohne, 'Bezugsgrösse Kopfstimmen')).toBe(
			`SUM($B$${r.von}:$B$${r.bis})-SUMIF(E$${r.von}:E$${r.bis},9,$B$${r.von}:$B$${r.bis})`
		);
	});

	it('rechnet eine 7 ausserhalb der Ausschlussklage wie die 9, wo die Mappe die 7 erklärt', () => {
		const ALLER: Mappenposten = { ...QUALI, kopfbasis: 'alle_eigentuemer' };
		const b = mappe([ALLER, KLAGE]);
		const { von, bis } = bereich(b);
		expect(formelVon(b, 'Bezugsgrösse Kopfstimmen', 4)).toBe(
			`SUM($B$${von}:$B$${bis})-SUMIF(E$${von}:E$${bis},9,$B$${von}:$B$${bis})-SUMIF(E$${von}:E$${bis},7,$B$${von}:$B$${bis})`
		);
		// An der Klage behält die 7 ihre Bedeutung: in der Zahl.
		expect(formelVon(b, 'Bezugsgrösse Kopfstimmen', 5)).not.toContain(',7,');
		// Nach L1 «fällt heraus» fällt die Quote der 7 wie die der 9 aus dem Nenner.
		const fh = mappe([{ ...QUALI, ausstandFaelltHeraus: true }, KLAGE], 'faellt_heraus');
		const r = bereich(fh);
		expect(formelVon(fh, 'Bezugsgrösse Wertquoten', 4)).toBe(
			`1000-SUMIF(E$${r.von}:E$${r.bis},9,$C$${r.von}:$C$${r.bis})-SUMIF(E$${r.von}:E$${r.bis},7,$C$${r.von}:$C$${r.bis})`
		);
		// Ohne Traktandum, das die 7 braucht, bleibt die Formel, wie sie war (N4).
		expect(
			formelVon(mappe([{ ...QUALI, ausstandFaelltHeraus: true }], 'faellt_heraus'), 'Bezugsgrösse Wertquoten')
		).not.toContain(',7,');
	});
});

describe('Anleitung zur 9 unter L13 (Fachprüfung Nachtrag Runde 3, N3-F-1)', () => {
	// Endwortlaut T7a der Textrunde zu den Pendenzen nach Regel 43 (14.11.2026; R3-L-1, R3-F-1).
	const SATZ =
		'Setzen Sie die 9 auch dort, wo die Köpfe unter allen Eigentümern zählen, nach der Einstellung Ihrer Gemeinschaft oder weil die Sitzungsleitung das Mehr so gesetzt hat. Wer im Ausstand ist, bleibt dann in der Zahl aller Eigentümer und wirkt wie ein Nein. Die Mappe weiss, bei welchen Traktanden das gilt, und rechnet es selbst.';
	const text = (b: { zeilen: Zelle[][] }) => b.zeilen.flat().map((z) => (z.art === 'text' ? z.wert : '')).join(' ');
	const ALLE: Mappenposten = { ...QUALI, kopfbasis: 'alle_eigentuemer', ausstandNachZaehlweise: true };

	it('steht an der Zeile zur 9, wo eine Hauptspalte unter allen zählt', () => {
		// Laienprüfung Block D, D-L-1: dort «Stimme zählt nicht», damit sich die Zeile nicht widerspricht.
		expect(text(mappe([ALLE]))).toContain(
			`Stimme zählt bei DIESEM Traktandum nicht: im Ausstand. Brauchen Sie selten; im Zweifel keine 9 setzen und den Zweifel im Protokoll festhalten. ${SATZ}`
		);
	});

	it('fehlt, wo nur eine Spalte zum Vergleich unter allen zählt, und unter der Vorgabe', () => {
		expect(text(mappe([QUALI]))).not.toContain(SATZ);
		expect(text(mappe([QUALI]))).toContain('zählt bei DIESEM Traktandum nicht mit: im Ausstand.');
		expect(text(mappe([QUALI]))).not.toContain('Stimme zählt bei DIESEM Traktandum nicht');
		const mitVergleich: Mappenposten = {
			...QUALI,
			vergleiche: [{ kennung: 'L13', wahl: 'Alle Eigentümer', verlangt: 'alle', rechnung: { ...ALLE } }]
		};
		expect(text(mappe([mitVergleich]))).not.toContain(SATZ);
	});
});

/**
 * **Was der Stimmzettel aus der Regel der Mappe liest** (Codeprüfung
 * 14.11.2026): ob Zettel nötig sind und ob das Zählblatt die Quote führt.
 */
describe('zaehlweise', () => {
	const EINFACH: Mappenposten = { ...QUALI, quotenbasis: 'keine', quotenSchwelle: null, stichentscheidMoeglich: true };

	it('sagt «Handzählen genügt» beim schlichten einfachen Mehr', () => {
		expect(zaehlweise(EINFACH, false)).toBeNull();
	});

	it('verlangt Zettel samt Quote beim Stichentscheid nach Wertquoten', () => {
		expect(zaehlweise(EINFACH, false, 'wertquote')).toEqual({ quote: true });
	});

	it('verlangt Zettel ohne Quote bei ungleichen Kopfstimmen', () => {
		expect(zaehlweise(EINFACH, true)).toEqual({ quote: false });
	});

	it('verlangt Zettel ohne Quote bei Einstimmigkeit aller Eigentümer', () => {
		expect(zaehlweise({ ...EINFACH, kopfbasis: 'alle_eigentuemer', stichentscheidMoeglich: false }, false)).toEqual({
			quote: false
		});
	});

	it('führt die Quote beim qualifizierten Mehr', () => {
		expect(zaehlweise(QUALI, false)).toEqual({ quote: true });
	});

	it('führt die Quote auch, wenn nur ein Vergleich sie braucht', () => {
		const mitVergleich: Mappenposten = {
			...EINFACH,
			vergleiche: [{ kennung: 'L4', wahl: 'qualifiziert', verlangt: 'qualifiziert', rechnung: QUALI }]
		};
		expect(zaehlweise(mitVergleich, false)).toEqual({ quote: true });
	});
});
