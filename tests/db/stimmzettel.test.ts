/**
 * Der Stimmzettel als PDF: ein Zettel je Traktandum, vier je Seite
 * (Produktentscheid 14.11.2026).
 *
 * Geprüft wird am erzeugten Dokument: das Zählblatt vorne, dann Teil 1
 * (qualifiziertes Mehr und Einstimmigkeit) und Teil 2 (einfaches Mehr), je
 * Partei auf eigenen Seiten; jeder Zettel, auch der Ersatzzettel, trägt seine
 * Unterschriftslinie.
 */
import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { erzeugeStimmzettel, stimmzettelplan, zettelzuteilung, type Zettelangaben } from '$lib/server/pdf/stimmzettel';

async function seitenzahl(a: Zettelangaben): Promise<number> {
	const bytes = await erzeugeStimmzettel(a);
	const d = await PDFDocument.load(bytes);
	return d.getPageCount();
}

/**
 * Wie viele Unterschriftslinien das Dokument trägt.
 *
 * **Seiten zu zählen genügt nicht** (01.09.2026): Damals waren genau die
 * Blätter unsigniert, die getrennt eingesammelt werden sollten, und kein Test
 * wurde rot. Seit dem 14.11.2026 ist jeder Zettel einzeln abzugeben; also muss
 * jeder seine eigene Linie tragen.
 *
 * **Gesucht wird die Linie, nicht das Wort.** Die Schrift ist eingebettet und
 * mit Teilmenge versehen; im Inhaltsstrom stehen Glyphen-Indizes, nicht
 * «Unterschrift». Die Zeichenbefehle selbst sind Klartext. Die
 * Unterschriftslinie ist die einzige waagrechte Linie von 50 mm Länge
 * (141,7 Punkte); Schreiblinien und Schnittlinien sind länger oder kürzer.
 */
async function unterschriften(a: Zettelangaben): Promise<number[]> {
	const bytes = await erzeugeStimmzettel(a);
	const d = await PDFDocument.load(bytes);
	const jeSeite: number[] = [];
	for (const seite of d.getPages()) {
		const verweise = seite.node.Contents();
		let text = '';
		if (verweise) {
			const stroeme = 'asArray' in verweise ? verweise.asArray() : [verweise];
			for (const v of stroeme) {
				const strom = seite.doc.context.lookup(v) as { contents?: Uint8Array } | undefined;
				if (!strom?.contents) continue;
				try {
					text += inflateSync(Buffer.from(strom.contents)).toString('latin1');
				} catch {
					text += Buffer.from(strom.contents).toString('latin1');
				}
			}
		}
		const linien = [...text.matchAll(/([\d.]+) ([\d.]+) m\n(?:[\d.]+ [\d.]+ m\n)?([\d.]+) ([\d.]+) l/g)];
		jeSeite.push(
			linien.filter(
				(t) =>
					Math.abs(Number(t[2]) - Number(t[4])) < 0.5 &&
					Math.abs(Number(t[3]) - Number(t[1]) - 141.7) < 0.5
			).length
		);
	}
	return jeSeite;
}

function angaben(posten: Zettelangaben['posten'], parteien = 1): Zettelangaben {
	return {
		gemeinschaftName: 'Prüfhaus',
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Saal',
		gesamtquote: 1000,
		kopfstimmenGesamt: 5,
		posten,
		parteien: Array.from({ length: parteien }, (_, i) => ({
			name: `Partei ${i + 1}`,
			ausgeuebtDurch: `Partei ${i + 1}`,
			einheiten: [`Whg ${i + 1}`],
			kopfstimmen: 1,
			wertquote: 200
		}))
	};
}

const EINFACH = {
	nummer: '1',
	titel: 'Budget',
	antrag: 'Das Budget wird genehmigt.',
	erfordernis: 'mehr als die Hälfte',
	gruppe: 'hand' as const,
	quoteZaehlt: false
};
const QUALIFIZIERT = {
	nummer: '2',
	titel: 'Sanierung',
	antrag: 'Die Fassade wird saniert.',
	erfordernis: 'mehr als die Hälfte und mehr als die Hälfte aller Wertquoten',
	gruppe: 'zettel' as const,
	quoteZaehlt: true
};
const nr = (posten: typeof EINFACH | typeof QUALIFIZIERT, nummer: string) => ({ ...posten, nummer });
const satz = 'Die Versammlung beschliesst die Sanierung zu einem Kostendach von 180 000 Franken. ';
const LANG = { ...QUALIFIZIERT, nummer: '3', antrag: satz.repeat(30) };
const UFERLOS = { ...QUALIFIZIERT, nummer: '4', antrag: satz.repeat(200) };

/** Je Teil die Seiten als Listen von Nummern (`-` für Ersatz), `+` für gekürzt. */
async function plan(a: Zettelangaben): Promise<string[][][]> {
	return (await stimmzettelplan(a)).map((teil) =>
		teil.seiten.map((s) =>
			s.map((p) => `${p.nummer ?? '-'}${p.spalte === 'ganz' ? '=' : ''}${p.gekuerzt ? '+' : ''}`)
		)
	);
}

describe('Stimmzettel', () => {
	it('setzt vier Zettel auf eine Seite, freie Plätze als Ersatzzettel, jeder unterschrieben', async () => {
		const a = angaben([nr(EINFACH, '1'), nr(EINFACH, '2')]);
		expect(await plan(a)).toEqual([[], [['1', '2', '-', '-']]]);
		// Zählblatt ohne, Zettelseite mit vier Unterschriftslinien.
		expect(await unterschriften(a)).toEqual([0, 4]);
	});

	it('stellt die nötigen Zettel vor die, wo Handerheben genügt, in Traktandenfolge je Teil', async () => {
		const a = angaben([nr(EINFACH, '1'), nr(EINFACH, '3'), nr(QUALIFIZIERT, '4'), nr(EINFACH, '5'), nr(EINFACH, '6'), nr(EINFACH, '7')]);
		expect(await plan(a)).toEqual([
			[['4', '-', '-', '-']],
			[['1', '3', '5', '6'], ['7', '-', '-', '-']]
		]);
		expect(await unterschriften(a)).toEqual([0, 4, 4, 4]);
	});

	it('beginnt jede Partei auf einer eigenen Seite', async () => {
		const teile = await stimmzettelplan(angaben([EINFACH], 3));
		expect(teile[1].seiten.map((s) => [...new Set(s.map((p) => p.partei))])).toEqual([
			['Partei 1'],
			['Partei 2'],
			['Partei 3']
		]);
	});

	it('lässt einen Teil ohne Traktanden weg', async () => {
		expect(await seitenzahl(angaben([QUALIFIZIERT]))).toBe(2);
	});

	it('gibt einem langen Antrag die halbe Seite, ungekürzt', async () => {
		expect(await plan(angaben([LANG]))).toEqual([[['3=', '-', '-']], []]);
		expect(await unterschriften(angaben([LANG]))).toEqual([0, 3]);
	});

	it('kürzt einen uferlosen Antrag, statt die Seite zu sprengen', async () => {
		expect(await plan(angaben([UFERLOS]))).toEqual([[['4=+', '-', '-']], []]);
	});

	it('schiebt einen halben Zettel auf eine freie Zeile, der Platz daneben wird Ersatz', async () => {
		// Viertel oben links, Ersatz oben rechts, halber Zettel in der unteren Zeile.
		const teile = await stimmzettelplan(angaben([QUALIFIZIERT, LANG]));
		expect(teile[0].seiten[0].map((p) => [p.zeile, p.spalte, p.nummer])).toEqual([
			[0, 0, '2'],
			[0, 1, null],
			[1, 'ganz', '3']
		]);
	});

	it('beginnt eine neue Seite, wenn ein halber Zettel keine freie Zeile mehr findet', async () => {
		const teile = await stimmzettelplan(angaben([nr(QUALIFIZIERT, '1'), nr(QUALIFIZIERT, '2'), nr(QUALIFIZIERT, '5'), LANG]));
		expect(teile[0].seiten.map((s) => s.map((p) => p.nummer))).toEqual([
			['1', '2', '5', null],
			['3', null, null]
		]);
	});

	it('teilt nach der Regel der Mappe zu, nicht nach dem Typ allein', () => {
		// Schlichtes einfaches Mehr: hinten, ohne Quote.
		expect(zettelzuteilung('einfaches_mehr', undefined)).toEqual({ gruppe: 'hand', quoteZaehlt: false });
		// Einfaches Mehr mit Stichentscheid nach Wertquoten: vorne, mit Quote.
		expect(zettelzuteilung('einfaches_mehr', { quote: true })).toEqual({ gruppe: 'zettel', quoteZaehlt: true });
		// Einfaches Mehr mit ungleichen Kopfstimmen: vorne, ohne Quote.
		expect(zettelzuteilung('einfaches_mehr', { quote: false })).toEqual({ gruppe: 'zettel', quoteZaehlt: false });
		// Einstimmigkeit: vorne.
		expect(zettelzuteilung('einstimmigkeit', { quote: false })).toEqual({ gruppe: 'zettel', quoteZaehlt: false });
		// Offenes Mehr: vorne, Quote im Zweifel.
		expect(zettelzuteilung(undefined, undefined)).toEqual({ gruppe: 'zettel', quoteZaehlt: true });
		expect(zettelzuteilung('grenzfall', undefined)).toEqual({ gruppe: 'zettel', quoteZaehlt: true });
	});
});
