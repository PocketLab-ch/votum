import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { neuversandHinweis } from '$lib/domain/einladungsmehr';
import { VERANTWORTUNG } from '$lib/domain/einberufungsfrist';
import { BERICHTIGTE_FOLGE, WARNUNG_SOLANGE } from '$lib/domain/mailversand';

/**
 * Der Haken auf der Seite Vorbereitung, Beschriftung und Hilfetext
 * (06.10.2026, Abschnitt «Offen» des Prüfberichts Hinweise lesbar, und
 * Laien-/Fach-/Codeprüfung Restpunkte Runde 1).
 *
 * **Warum die Vorlage gelesen wird.** Der Hilfetext steht in der Svelte-Datei
 * und wurde bis hierher von keiner Probe gelesen (Codeprüfung, gering). Ein
 * Rendern bräuchte die SvelteKit-Laufzeit, die die Kerntests nicht haben. Die
 * Probe nimmt deshalb den Text zwischen Beschriftung und Ende des Labels,
 * ohne Kommentare und Tags, mit dem Zweig für die fehlende Frist je nach Lage.
 * Sie misst den Wortlaut, nicht die Darstellung.
 *
 * **Am Formular verankert** (Codeprüfung Restpunkte Runde 1, G3): Der
 * Ausschnitt beginnt beim Formular, das den Haken absendet, nicht beim ersten
 * `<strong>` der Datei. Ein neues `<strong>` weiter oben würde sonst still den
 * falschen Text messen.
 */
const VORLAGE = join(
	process.cwd(),
	'src/routes/versammlungen/[id=kennung]/vorbereitung/+page.svelte'
);

function textAus(teil: string, fristErfasst: boolean): string {
	let t = teil.replace(/<!--[\s\S]*?-->/g, '');
	t = t.replace(
		/\{#if !data\.einberufungsfristErfasst\}([\s\S]*?)\{\/if\}/,
		(_, innen: string) => (fristErfasst ? '' : innen)
	);
	if (/\{[#/:]/.test(t)) throw new Error('Unerwarteter Svelte-Block im Hilfetext');
	return t
		.replace(/<\/strong>/, '. ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Beschriftung samt Normalfall, und der abgesetzte Teil nach einer Milderung. */
function hakenteile(quelle: string, fristErfasst: boolean): { normal: string; milderung: string } {
	const formular = quelle.indexOf('action="?/versandVermerken"');
	if (formular < 0) throw new Error('Formular des Hakens in der Vorlage nicht gefunden');
	const start = quelle.indexOf('<strong>', formular);
	const ende = quelle.indexOf('</label>', start);
	const trenner = quelle.indexOf('<span class="klein milderung">', start);
	if (start < 0 || ende < 0) throw new Error('Haken in der Vorlage nicht gefunden');
	if (trenner < 0 || trenner > ende) throw new Error('Teil nach einer Milderung nicht gefunden');
	return {
		normal: textAus(quelle.slice(start, trenner), fristErfasst),
		milderung: textAus(quelle.slice(trenner, ende), fristErfasst)
	};
}

function hakentext(quelle: string, fristErfasst: boolean): string {
	const { normal, milderung } = hakenteile(quelle, fristErfasst);
	return `${normal} ${milderung}`;
}

function saetze(text: string): string[] {
	return text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ«])/);
}

const quelle = readFileSync(VORLAGE, 'utf8');

describe('Haken auf der Seite Vorbereitung', () => {
	/*
	 * **Der Haken heisst nach dem Versand** (Produktentscheid 07.10.2026, «Nur
	 * noch aufmerksam machen»). Gegen den Stand davor rot: Vom 06.10.2026 bis
	 * 07.10.2026 hiess er «Die Einladung ist bei allen angekommen».
	 */
	it('heisst nach dem Versand, nicht nach dem Empfang (Produktentscheid 07.10.2026)', () => {
		for (const frist of [true, false]) {
			const text = hakentext(quelle, frist);
			expect(text.slice(0, 30)).toBe('Die Einladung ist verschickt. ');
			expect(text).not.toContain('hinausgegangen');
			expect(text).not.toContain('angekommen');
		}
	});

	/*
	 * **Der Normalfall zuerst** (Laienprüfung Restpunkte Runde 1, B3): Wer nur
	 * einlädt, liest den ersten Teil und darf dort aufhören; alles zur Milderung
	 * steht abgesetzt dahinter und beginnt mit seiner Bedingung. Gegen den Stand
	 * davor rot: Dort begann der Text mit «Vor allem für den Fall», und es gab
	 * keinen abgesetzten Teil.
	 */
	it('beginnt mit dem Normalfall und setzt die Milderung ab (Laien Restpunkte B3)', () => {
		for (const frist of [true, false]) {
			const { normal, milderung } = hakenteile(quelle, frist);
			expect(saetze(normal)[1]).toBe(
				'Setzen Sie den Haken, sobald die Einladung verschickt ist, vor allem, wenn Sie sie ' +
					'ausserhalb der Anwendung geschrieben haben.'
			);
			expect(normal).toContain('Er schaltet die Fristwarnung und die Erinnerungsmail ab.');
			// Daneben, bei wem der rechtzeitige Empfang liegt (Produktentscheid 07.10.2026).
			// Seit Runde 1 (Laienprüfung 10, 07.10.2026) der gemeinsame Satz.
			expect(normal).toContain(VERANTWORTUNG);
			expect(normal).not.toContain('Sitzungsleitung');
			expect(normal).not.toMatch(/Milderung|milder/);
			expect(milderung.slice(0, 35)).toBe('Nur nach einer Milderung des Mehrs:');
		}
	});

	/*
	 * **Nach einer Milderung: ohne Rückfall, Haken nach dem Versand**
	 * (Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»). Gegen den
	 * Stand davor rot: Dort stand, der Haken zähle nur bis zum letzten Fristtag,
	 * und «Entfernen Sie den Haken, nimmt die Anwendung beim Eröffnen wieder das
	 * Mehr der bisherigen Einladung».
	 */
	it('nach einer Milderung: Haken neu nach dem Versand, das mildere Mehr auch ohne Haken', () => {
		for (const frist of [true, false]) {
			const { milderung } = hakenteile(quelle, frist);
			expect(milderung).toContain(
				'Nur nach einer Milderung des Mehrs: Die Anwendung nimmt den Haken dann zurück, und ' +
					'darüber steht ein Hinweis. Setzen Sie ihn neu, sobald die berichtigte Einladung ' +
					// Codeprüfung Block B, M2: wie der Hinweis selbst; gegen den Stand davor rot.
					'verschickt ist. Der Haken nimmt nur diesen Hinweis und die Erinnerungsmail weg; die ' +
					'Warnung im Saal steht ' +
					'trotzdem, solange das Mehr dort milder ist als in der Einladung vor der Milderung. ' +
					'Die Anwendung nimmt das mildere Mehr auch ohne Haken; sie macht nur aufmerksam.'
			);
			expect(milderung).toContain('Entfernen Sie den Haken, ändert das am Mehr nichts.');
			expect(milderung).not.toMatch(/beim Eröffnen|letzten Tag|bisherigen Einladung\. Das mildere/);
			expect(hakentext(quelle, frist)).not.toContain('rechtzeitig gesetzt');
		}
	});

	it('sagt nach dem Rückweg, wann der Haken zu setzen ist (Laien Runde 2, B; Code Runde 3, N3)', () => {
		for (const frist of [true, false]) {
			expect(hakenteile(quelle, frist).milderung).toContain(
				'Haben Sie das Mehr zurückgestellt und steht über dem Haken kein Hinweis mehr, setzen ' +
					'Sie ihn, sobald die bisherige Einladung verschickt ist.'
			);
		}
	});

	it('den Rat zu zehn Tagen nur ohne erfasste Frist, und im Normalfall', () => {
		expect(hakenteile(quelle, false).normal).toContain('mindestens zehn Tage');
		expect(hakentext(quelle, true)).not.toContain('zehn Tage');
		expect(hakenteile(quelle, false).milderung).not.toContain('zehn Tage');
	});

	it('hat keinen Satz über 180 Zeichen', () => {
		for (const frist of [true, false]) {
			for (const satz of saetze(hakentext(quelle, frist))) {
				expect(satz.length, satz).toBeLessThanOrEqual(180);
			}
		}
	});

	/*
	 * **Die Invarianz** (Produktentscheid 06.10.2026, «Ein Satz für alle Lagen»):
	 * Der Hilfetext sagt, nach dem Zurückstellen komme der Haken, sobald die
	 * bisherige Einladung bei allen ist. Gemessen wird deshalb in jedem Zweig von
	 * `neuversandHinweis`, in Einzahl und Mehrzahl, die Reihenfolge: erst die
	 * Anweisung zum Zurückstellen, dann der Haken-Satz für die bisherige
	 * Einladung, erst danach «entfällt» (Codeprüfung Restpunkte Runde 1, G2).
	 * Gegen den Stand davor rot: In den Zweigen mit Frist stand «entfällt» vor
	 * dem Haken-Satz.
	 */
	it('in jedem Zweig: zurückstellen, dann der Haken für die bisherige Einladung, dann «entfällt»', () => {
		const lagen = [
			{ versandfrist: null, heute: '2027-02-01' },
			{ versandfrist: '2027-03-01', heute: '2027-02-01' },
			{ versandfrist: '2027-03-01', heute: '2027-03-02' }
		];
		// In jedem Zweig mit «er gilt dann für die bisherige Einladung» (Laien- und
		// Codeprüfung Restpunkte Runde 2, 06.10.2026). Seit dem Produktentscheid
		// 07.10.2026 («Nur noch aufmerksam machen») «sobald sie verschickt ist»
		// statt «sobald sie bei allen ist».
		const hakenSatz =
			/(?:Erst danach|Haben Sie das Mehr (?:überall )?zurückgestellt,) setzen Sie den Haken unten; er gilt dann für die bisherige Einladung\. Setzen Sie ihn, sobald sie verschickt ist; ist sie das schon, gleich\./;
		for (const gemildert of [
			[{ traktandum: '3 Fassade' }],
			[{ traktandum: '3 Fassade' }, { traktandum: '4 Lift' }]
		]) {
			for (const lage of lagen) {
				const h = neuversandHinweis(gemildert, lage)!;
				const was = `${gemildert.length} Traktanden, ${JSON.stringify(lage)}: ${h}`;
				const zurueck = h.lastIndexOf('«Erfordernis ändern»');
				const haken = h.search(hakenSatz);
				const entfaellt = h.indexOf('entfällt dieser Hinweis');
				expect(zurueck, was).toBeGreaterThan(-1);
				expect(haken, was).toBeGreaterThan(zurueck);
				expect(entfaellt, was).toBeGreaterThan(haken);
				expect(h.slice(entfaellt), was).toMatch(
					/^entfällt dieser Hinweis; das Kästchen für den Haken bleibt unten stehen\./
				);
			}
		}
	});
});

/*
 * **Der alte Name des Hakens und die Versand-Wendungen in angezeigtem Text**
 * (06.10.2026, Codeprüfung Restpunkte Runde 1, M1 und G3). Gemessen werden in
 * allen `.ts`- und `.svelte`-Dateien unter `src` der alte Name des Hakens
 * («Einladung ist hinaus», «gilt als hinausgegangen», «noch nicht
 * hinausgegangen») und «Versand» als eigenes Wort, dem höchstens 40 Zeichen
 * später «vermerk…» folgt («Versand vermerken», «kein Versand vermerkt»).
 * Kommentare bleiben ausgenommen: Dort erklärt der alte Name die Herkunft.
 *
 * **Was das Muster nicht findet** (Codeprüfung Restpunkte Runde 2, Punkt 4,
 * 06.10.2026): «Versand» als Teil eines zusammengesetzten Worts, etwa
 * «Neuversand vermerkt» oder «Versandvermerk zurückgenommen» in den Gründen
 * des Verlaufs. Die Probe sagt also nicht, dass kein Text mehr den Vermerk
 * als Versand bezeichnet, sondern nur, dass diese beiden Formen fehlen. Die
 * zusammengesetzten Wörter bleiben, wie sie sind.
 *
 * **Ausnahme `src/lib/domain/verlauf.ts`**: Die Beschriftung «Versand der
 * Einladung vermerkt» gilt auch für Einträge, die vor der Umbenennung
 * geschrieben wurden; ob sie sich ändert, ist eine offene Produktfrage. Die
 * Ausnahme gilt nur für die Versand-Wendung, nicht für den alten Namen.
 */
const ALTER_NAME = /Einladung ist hinaus|Einladung gilt als hinausgegangen|noch nicht hinausgegangen/;
const VERSAND_VERMERK = /\bVersand(?:es)?\b[^.<>"'`]{0,40}\bvermerk/;
const AUSNAHME_VERSAND = /src\/lib\/domain\/verlauf\.ts$/;

/*
 * **Kommentare entfernen, ohne Text zu verschlucken** (Codeprüfung Restpunkte
 * Runde 1, G3). Ein `/*` in einem Attribut wie `accept="image/*,application/pdf"`
 * eröffnete vorher einen «Kommentar» bis zum nächsten `*\/`, und alles dazwischen
 * war für die Probe blind. Ein Blockkommentar beginnt deshalb nur am Zeilenanfang
 * oder nach Leerraum oder Satzzeichen des Codes, nie mitten in einem Wort oder
 * Pfad.
 *
 * **Zeilenkommentare nur am Zeilenanfang** (Codeprüfung Restpunkte Runde 2,
 * Punkt 8, 06.10.2026): Vorher fiel alles nach « //» weg, auch sichtbarer Text
 * wie «<p>Ja // Nein</p>» oder eine Zeichenkette «'a // b'». Jetzt entfällt
 * eine Zeile nur, wenn `//` nach der Einrückung als Erstes steht. Ein
 * Kommentar hinter Code (`const a = 1; // …`) bleibt damit stehen: Das macht
 * die Probe eher zu streng als blind.
 */
function ohneKommentare(q: string): string {
	return q
		.replace(/(^|[\s(,;{}=:[])\/\*[\s\S]*?\*\//g, '$1')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/^([ \t]*)\/\/.*$/gm, '$1');
}

function dateien(verzeichnis: string): string[] {
	return readdirSync(verzeichnis).flatMap((name) => {
		const pfad = join(verzeichnis, name);
		if (statSync(pfad).isDirectory()) return dateien(pfad);
		return /\.(ts|svelte)$/.test(name) ? [pfad] : [];
	});
}

describe('Kommentare entfernen (Selbstprobe)', () => {
	it('verschluckt nach einem Stern im Attribut keinen Text', () => {
		const probe =
			'<input accept="image/*,application/pdf" />\n<p>Sichtbar eins</p>\n' +
			'<script>\n\t/* weg */\n\t// weg\n\tconst b = "https://x.invalid/y";\n</script>\n' +
			'<!-- weg -->\n<p>Sichtbar zwei</p>\n<style>\n\t/* weg */\n</style>';
		const ohne = ohneKommentare(probe);
		expect(ohne).toContain('accept="image/*,application/pdf"');
		expect(ohne).toContain('Sichtbar eins');
		expect(ohne).toContain('Sichtbar zwei');
		expect(ohne).toContain('https://x.invalid/y');
		expect(ohne).not.toContain('weg');
	});

	/*
	 * **Sichtbarer Text nach « //» bleibt** (Codeprüfung Restpunkte Runde 2,
	 * Punkt 8). Gegen die Fassung davor rot: `(^|\s)\/\/.*$` nahm «Nein» im
	 * Absatz und «b» in der Zeichenkette mit.
	 */
	it('lässt « //» in sichtbarem Text und in Zeichenketten stehen', () => {
		const probe =
			'<p>Ja // Nein</p>\n' +
			"<script>\n\tconst s = 'a // b';\n\tconst t = `Zeile\n  mit // Rest`;\n\t  // weg eingerückt\n</script>\n" +
			'// weg am Anfang';
		const ohne = ohneKommentare(probe);
		expect(ohne).toContain('<p>Ja // Nein</p>');
		expect(ohne).toContain("'a // b'");
		expect(ohne).toContain('mit // Rest');
		expect(ohne).not.toContain('weg');
	});

	it('lässt in den echten Dateien mit `accept="image/*"` den Text dahinter stehen', () => {
		const mitStern = dateien(join(process.cwd(), 'src')).filter((d) =>
			readFileSync(d, 'utf8').includes('accept="image/*')
		);
		// Vier Stellen in drei Dateien (gezählt am 06.10.2026); wird es keine,
		// misst diese Probe nichts mehr und soll das sagen.
		expect(mitStern.length).toBeGreaterThan(0);
		for (const d of mitStern) {
			const q = readFileSync(d, 'utf8');
			const ohne = ohneKommentare(q);
			expect(ohne.split('accept="image/*,application/pdf"').length, d).toBe(
				q.split('accept="image/*,application/pdf"').length
			);
		}
	});
});

describe('alter Name des Hakens und Versand-Wendungen', () => {
	it('stehen in keinem angezeigten Text unter src', () => {
		const treffer = dateien(join(process.cwd(), 'src')).flatMap((d) => {
			const text = ohneKommentare(readFileSync(d, 'utf8'));
			const funde: string[] = [];
			if (ALTER_NAME.test(text)) funde.push(`${d}: ${text.match(ALTER_NAME)![0]}`);
			if (!AUSNAHME_VERSAND.test(d) && VERSAND_VERMERK.test(text)) {
				funde.push(`${d}: ${text.match(VERSAND_VERMERK)![0]}`);
			}
			return funde;
		});
		expect(treffer).toEqual([]);
	});

	it('die Muster treffen die Wendungen, die sie ausschliessen sollen', () => {
		for (const w of [
			'Versand vermerken',
			'kein Versand vermerkt wurde',
			'lässt sich der Versand jederzeit vermerken',
			'Versand der Einladung vermerkt'
		]) {
			expect(VERSAND_VERMERK.test(w), w).toBe(true);
		}
		for (const w of [
			'Ja, die Einladung ist hinaus',
			'Die Einladung ist hinausgegangen',
			'Die Einladung gilt als hinausgegangen',
			'ist noch nicht hinausgegangen'
		]) {
			expect(ALTER_NAME.test(w), w).toBe(true);
		}
		// Bezeichner bleiben unberührt (`versandVermerken`, `einladungVersandVermerkt`).
		expect(VERSAND_VERMERK.test('?/versandVermerken einladungVersandVermerkt')).toBe(false);
	});
});

/*
 * **Linkseite nach einer Milderung** (Codeprüfung Restpunkte Runde 2, Punkt 7,
 * 06.10.2026; Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»).
 * Gelesen wird die Vorlage wie oben, der Zweig `{:else if fassung !== 'bisher'}`
 * bis zum Zweig der bisherigen Einladung. Die Seite kennt die Zahl der
 * betroffenen Traktanden nicht und spricht deshalb in der Mehrzahl.
 */
describe('Linkseite nach einer Milderung', () => {
	const linkseite = readFileSync(
		join(process.cwd(), 'src/routes/b/[marke]/+page.svelte'),
		'utf8'
	);
	const ohne = linkseite.replace(/<!--[\s\S]*?-->/g, '');
	const start = ohne.indexOf("{:else if fassung !== 'bisher'}");
	const ende = ohne.indexOf('\t{:else}\n\t\t<p class="oben">', start);
	const zweig = ohne.slice(start, ende);
	const lesbar = (t: string) =>
		t
			// Blöcke trennen Sätze verschiedener Fassungen, Ausdrücke stehen im Satz.
			.replace(/\{[#:/][^}]*\}/g, ' ')
			.replace(/\{[^}]*\}/g, '…')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();

	it('findet den Zweig', () => {
		expect(start).toBeGreaterThan(-1);
		expect(ende).toBeGreaterThan(start);
	});

	/*
	 * Gegen den Stand davor rot: Dort fehlte «ist sie das schon, gleich», und
	 * der Haken-Satz stützte sich mit «danach» auf den Satz davor; bis
	 * 07.10.2026 hiess die Bedingung «sobald sie bei allen ist».
	 */
	it('nennt den Rückweg mit Bedingung und «ist sie das schon, gleich»', () => {
		const text = lesbar(zweig);
		expect(text).toContain(
			'Haben Sie das Mehr überall zurückgestellt, setzen Sie auf der Seite Vorbereitung den ' +
				'Haken; er gilt dann für die bisherige Einladung. Setzen Sie ihn, sobald sie verschickt ' +
				'ist; ist sie das schon, gleich.'
		);
		expect(text).not.toContain('Setzen Sie danach');
		for (const satz of saetze(text)) {
			expect(satz.length, satz).toBeLessThanOrEqual(180);
		}
	});

	/*
	 * **Nach Fristablauf mit Knopf** (Produktentscheid 07.10.2026): Jeder
	 * Vermerk nach der Milderung zählt. Gemessen wird, dass das Formular in
	 * keinem `{#if}` des Zweigs steckt, also in jeder Fassung steht, und dass
	 * es die gezeigte Fassung mitschickt. Gegen den Stand davor rot: Dort stand
	 * das Formular im `{:else}` von `{#if fassung === 'zu_spaet'}`.
	 */
	it('zeigt den Knopf in jeder Fassung, auch nach Fristablauf', () => {
		const formen = [...zweig.matchAll(/<form method="POST">/g)];
		expect(formen).toHaveLength(1);
		const davor = zweig.slice(0, formen[0].index);
		const tiefe =
			(davor.match(/\{#if /g) ?? []).length - (davor.match(/\{\/if\}/g) ?? []).length;
		expect(tiefe).toBe(0);
		expect(zweig).toContain('<input type="hidden" name="fassung" value={fassung} />');
		expect(zweig).toContain('Ja, die berichtigte Einladung ist verschickt');
	});

	it('sagt nach Fristablauf, dass sie nicht mehr rechtzeitig ankommen kann', () => {
		const a = zweig.indexOf("{#if fassung === 'zu_spaet'}");
		const b = zweig.indexOf('{:else if frist}', a);
		const text = lesbar(zweig.slice(a, b));
		// Bedingt (Fachprüfung B1, Runde 1, 07.10.2026); gegen den Stand davor rot.
		expect(text).toContain(
			'Ist die berichtigte Einladung noch nicht verschickt, kommt sie nach dieser Frist nicht mehr ' +
				'rechtzeitig an. War sie am … nicht bei allen, kann ein Beschluss mit dem milderen Mehr ' +
				'angefochten werden.'
		);
		expect(text).not.toContain('kann jetzt nicht mehr');
		// Nach dem Ja ebenso bedingt.
		const erledigt = lesbar(ohne.slice(0, ohne.indexOf("{:else if !data.gefunden")));
		expect(erledigt).toContain(
			'War sie am … nicht bei allen, kann ein Beschluss mit dem milderen Mehr angefochten werden.'
		);
		expect(erledigt).not.toContain('war der');
	});

	/*
	 * **Ohne Rückfall und ohne Empfang als Bedingung, auf der ganzen Seite**
	 * (Produktentscheid 07.10.2026). Gegen den Stand davor rot: Dort standen
	 * «Ein Vermerk jetzt ändert das Mehr nicht mehr», «nimmt beim Eröffnen
	 * wieder das Mehr der bisherigen Einladung» und «bei allen angekommen».
	 */
	it('nennt keinen Rückfall und verlangt keinen Empfang', () => {
		const text = lesbar(ohne);
		expect(text).not.toContain('beim Eröffnen');
		expect(text).not.toContain('ändert das Mehr nicht mehr');
		expect(text).not.toContain('angekommen');
		expect(text).not.toContain('Vermerkt, aber zu spät');
		expect(text).toContain('Das mildere Mehr nimmt die Anwendung auch ohne Ja; sie macht nur aufmerksam.');
		// Runde 1, 07.10.2026 (Laien 3 und 10); gegen den Stand davor rot.
		expect(text).toContain(
			'Im Saal steht trotzdem eine Warnung, solange das Mehr dort milder ist als in der Einladung ' +
				'vor der Milderung.'
		);
		expect(text).not.toContain('Sitzungsleitung');
		expect(text.split(VERANTWORTUNG).length - 1).toBe(3);
		expect(text).toContain('Ist die Einladung verschickt?');
	});
});

/*
 * **Ein Satz zur Verantwortung, an allen Stellen gleich** (Laienprüfung Runde 1,
 * Punkt 10, 07.10.2026): `VERANTWORTUNG` in `einberufungsfrist.ts`, in den
 * Vorlagen derselbe Wortlaut. Gegen den Stand davor rot: Dort hiess es «… liegt
 * bei der Sitzungsleitung», obwohl die Erinnerung an die Bewirtschaftung geht.
 */
describe('Satz zur Verantwortung für den Versand', () => {
	const seiten = [
		'src/routes/versammlungen/[id=kennung]/vorbereitung/+page.svelte',
		'src/routes/b/[marke]/+page.svelte',
		'src/routes/versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis/+page.svelte',
		'src/routes/versammlungen/[id=kennung]/freigabe/+page.svelte',
		'src/routes/gemeinschaften/[id=kennung]/reglement/+page.svelte'
	];

	it('steht auf jeder Seite, die den Empfang nicht prüft, im selben Wortlaut', () => {
		for (const s of seiten) {
			const text = ohneKommentare(readFileSync(join(process.cwd(), s), 'utf8'))
				.replace(/<[^>]+>/g, ' ')
				.replace(/\s+/g, ' ');
			expect(text, s).toContain(VERANTWORTUNG);
		}
	});

	it('«liegt bei der Sitzungsleitung» steht in keinem angezeigten Text unter src', () => {
		const treffer = dateien(join(process.cwd(), 'src')).filter((d) =>
			/liegt bei der\s+Sitzungsleitung/.test(ohneKommentare(readFileSync(d, 'utf8')))
		);
		expect(treffer).toEqual([]);
	});
});

/*
 * **Einstellung, Kasten der Übersicht und Erfordernisseite nach Runde 1**
 * (Laien 5 bis 8, Fach B1, B2, B5, 07.10.2026). Gelesen wird die Vorlage ohne
 * Kommentare und Tags. Gegen den Stand davor rot.
 */
describe('Vorlagen nach Runde 1 «aufmerksam statt sperren»', () => {
	const lies = (pfad: string) =>
		ohneKommentare(readFileSync(join(process.cwd(), pfad), 'utf8'))
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ');

	it('die Einstellung nennt Reichweite, Ort des Hinweises, das bleibende Risiko und den Grund', () => {
		const t = lies('src/routes/gemeinschaften/[id=kennung]/reglement/+page.svelte');
		expect(t).toContain('Ein vorher gesetztes milderes Mehr bleibt in beiden Fällen stehen.');
		expect(t).toContain(
			'Die Anwendung setzt das mildere Mehr und weist auf der Seite Vorbereitung und im Saal darauf hin'
		);
		expect(t).toContain('Das Umstellen verringert dieses Risiko nicht; die Anwendung sagt nur nicht ab.');
		// Runde 2, 07.10.2026: Folge beim Baustein (1a); der doppelte Satz zur
		// Verantwortung entfällt (Fachprüfung R2-2).
		expect(t).toContain('an alle gehen. Kommt sie nicht rechtzeitig bei allen an, kann ein Beschluss mit dem milderen Mehr angefochten werden.');
		expect(t).not.toContain('Die Verantwortung trägt dann');
		expect(t).toContain(
			'Rechnet Ihr Reglement ab Versand, ist es dann ebenso zu spät, weil derselbe Tag der letzte ' +
				'Versandtag ist.'
		);
		expect(t).toContain('Die Anwendung kennt dann keinen letzten Tag');
		expect(t).not.toContain('Massgebend ist, wann sie bei allen ist');
		expect(t).not.toContain('wirkt die Einstellung nicht');
	});

	it('der Kasten der Übersicht: Empfehlung, nach Fristablauf bedingt', () => {
		const t = lies('src/routes/versammlungen/[id=kennung]/+page.svelte');
		expect(t).toContain('Dafür sollte eine berichtigte Einladung an alle gehen');
		// Runde 2, 07.10.2026: «die berichtigte Einladung» statt «sie» (Laien N7)
		// und vor Fristablauf die Folge (Produktentscheid «1a»); gegen den Stand davor rot.
		expect(t).toContain(
			'War die berichtigte Einladung an diesem Tag nicht bei allen, kann ein Beschluss mit dem ' +
				'milderen Mehr angefochten werden.'
		);
		expect(t).toContain('{:else} Kommt sie nicht rechtzeitig bei allen an, kann ein Beschluss mit dem milderen Mehr angefochten werden. {/if}');
		expect(t).not.toContain('Dafür braucht es');
	});

	it('die Erfordernisseite: Empfehlung statt Pflicht', () => {
		const t = lies(
			'src/routes/versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis/+page.svelte'
		);
		expect(t).toContain('Für ein milderes sollte eine berichtigte Einladung an alle gehen');
		// Mit der Folge (Produktentscheid 07.10.2026 «1a»).
		expect(t).toContain('Kommt sie nicht rechtzeitig bei allen an, kann ein Beschluss mit dem milderen Mehr angefochten werden.');
		expect(t).not.toContain('muss die Einladung neu an alle');
	});
});

/*
 * **Vorlagen gegen die Bausteine** (Codeprüfung Block B, N5, 07.10.2026): wie
 * für `VERANTWORTUNG` muss der Text aus der Vorlage die Konstante enthalten,
 * damit eine Änderung am Baustein die Vorlage nicht zurücklässt. `BERICHTIGTE_SOLLTE`
 * selbst steht in keiner Vorlage wörtlich (Kasten, Erfordernisseite und
 * Einstellung führen ihn als eigenen Satzanfang); geprüft wird dort die Folge.
 */
describe('Vorlagen gegen die Bausteine aus mailversand.ts', () => {
	const lies = (pfad: string) =>
		ohneKommentare(readFileSync(join(process.cwd(), pfad), 'utf8'))
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ');

	it('die Folge (`BERICHTIGTE_FOLGE`) steht wörtlich in Kasten, Erfordernisseite und Einstellung', () => {
		for (const s of [
			'src/routes/versammlungen/[id=kennung]/+page.svelte',
			'src/routes/versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis/+page.svelte',
			'src/routes/gemeinschaften/[id=kennung]/reglement/+page.svelte'
		]) {
			expect(lies(s), s).toContain(BERICHTIGTE_FOLGE);
		}
	});

	it('die Bedingung der Saalwarnung (`WARNUNG_SOLANGE`) steht wörtlich in Hilfetext und Linkseite', () => {
		for (const s of [
			'src/routes/versammlungen/[id=kennung]/vorbereitung/+page.svelte',
			'src/routes/b/[marke]/+page.svelte'
		]) {
			expect(lies(s), s).toContain(WARNUNG_SOLANGE);
		}
	});
});

/*
 * **Erklärung der Variante «vertreten»** (Produktentscheid 07.10.2026 «Ja» zu
 * Fassung 2): das Aktienrecht als Vergleich mit Fundstelle, und dass es für das
 * Stockwerkeigentum nicht entschieden ist. Gegen den Stand davor rot.
 */
describe('Reglementsseite, Variante «vertreten»', () => {
	it('nennt Art. 701 Abs. 1 OR, den Onlinekommentar und Rz. 5a ad Art. 712m', () => {
		const t = ohneKommentare(
			readFileSync(
				join(process.cwd(), 'src/routes/gemeinschaften/[id=kennung]/reglement/+page.svelte'),
				'utf8'
			)
		)
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ');
		expect(t).toContain(
			'Im Aktienrecht, das der Kommentar dort zum Vergleich nennt, zählen Vertretene mit ' +
				'(Art. 701 Abs. 1 OR; Onlinekommentar zu Art. 701 OR, N 2 und 12). Für das ' +
				'Stockwerkeigentum ist das nicht entschieden; der Kommentar warnt davor, Grundsätze des ' +
				'Aktienrechts unbesehen zu übernehmen (Rz. 5a ad Art. 712m).'
		);
	});
});
