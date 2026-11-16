/**
 * Was ein Modell zu prüfen bekommt (Welle 3, FR-58).
 *
 * **Der Prüfstand einer Zusage.** Datensparsamkeit lässt sich nicht behaupten,
 * nur zeigen: Hier steht schwarz auf weiss, welche vier Angaben hinausgehen und
 * dass alles andere gar nicht erst zusammengebaut wird.
 */
import { describe, expect, it } from 'vitest';
import {
	auftragstext,
	deuteAntwort,
	ergebnissatz,
	pruefpunkteFuer,
	PLATZHALTERHINWEIS,
	PRUEFPUNKTE,
	pruefauftrag,
	type Pruefergebnis
} from '$lib/domain/traktandenpruefung';

const TRAKTANDUM = {
	titel: 'Sanierung der Fassade',
	inhalt: 'Die Westfassade ist verwittert.',
	antragswortlaut: 'Die Versammlung beschliesst die Sanierung.',
	art: 'abstimmung'
};

describe('Was übermittelt wird', () => {
	it('sind vier Angaben und sonst nichts', () => {
		const a = pruefauftrag(TRAKTANDUM, ['Jahresrechnung 2025']);
		expect(Object.keys(a.felder).sort()).toEqual([
			'andere',
			'antragswortlaut',
			'inhalt',
			'titel'
		]);
	});

	it('nimmt von den übrigen Traktanden nur die Titel', () => {
		/*
		 * Für den Abgleich auf Widersprüche genügt, worum es geht. Die Inhalte
		 * aller übrigen Traktanden mitzugeben hiesse, die halbe Versammlung zu
		 * übermitteln, um ein einziges Traktandum zu prüfen.
		 */
		const a = pruefauftrag(TRAKTANDUM, ['Jahresrechnung 2025', 'Wahl der Revision']);
		expect(a.felder.andere).toBe('Jahresrechnung 2025\nWahl der Revision');
	});

	it('baut auf statt auszusieben', () => {
		// Ein Feld, das es am Traktandum gibt, aber nicht im Auftrag: Es darf
		// nicht dadurch hineinrutschen, dass jemand es dem Objekt hinzufügt.
		const mitZusatz = { ...TRAKTANDUM, antragstellerName: 'Anna Meier', protokollnotiz: 'heikel' };
		const a = pruefauftrag(mitZusatz, []);
		const alles = JSON.stringify(a.felder);
		expect(alles).not.toContain('Anna Meier');
		expect(alles).not.toContain('heikel');
	});

	it('sagt es, wenn der Antragswortlaut fehlt', () => {
		// Sonst prüft das Modell einen Text, den es nicht sieht, und meldet
		// nichts — dabei ist der fehlende Wortlaut der schwerste Mangel.
		const t = auftragstext(pruefauftrag({ ...TRAKTANDUM, antragswortlaut: null }, []).felder, 'abstimmung');
		expect(t).toContain('Antragswortlaut: (fehlt)');
	});

	it('unterscheidet Abstimmung und Kenntnisnahme', () => {
		expect(auftragstext(pruefauftrag(TRAKTANDUM, []).felder, 'kenntnisnahme')).toContain(
			'keine Abstimmung'
		);
	});

	it('meldet bei einer Kenntnisnahme keinen fehlenden Wortlaut', () => {
		// Dort ist er **kein** Mangel. Ihn trotzdem als «(fehlt)» zu melden, lädt
		// zu einem Befund ein, der keiner ist — und wer zweimal einen solchen
		// liest, ignoriert die Prüfung.
		const felder = pruefauftrag({ ...TRAKTANDUM, antragswortlaut: null }, []).felder;
		expect(auftragstext(felder, 'kenntnisnahme')).not.toContain('(fehlt)');
		expect(auftragstext(felder, 'abstimmung')).toContain('(fehlt)');
	});

	it('lässt leere Felder weg statt sie leer zu senden', () => {
		const t = auftragstext(pruefauftrag({ ...TRAKTANDUM, inhalt: null }, []).felder, 'abstimmung');
		expect(t).not.toContain('Inhalt:');
	});
});

describe('Der Auftrag an das Modell', () => {
	it('nennt jeden Prüfpunkt aus FR-58', () => {
		const a = pruefauftrag(TRAKTANDUM, []);
		for (const punkt of PRUEFPUNKTE) expect(a.system).toContain(punkt);
	});

	it('erklärt die Platzhalter', () => {
		/*
		 * Ohne Erklärung bemängelt ein Modell die Maskierung selbst — «[Name 1]
		 * ist kein gültiger Platzhalter» — und verbraucht einen Befund für
		 * nichts. Am 05.08.2026 gegen beide Stufen gemessen.
		 */
		expect(pruefauftrag(TRAKTANDUM, []).system).toContain(PLATZHALTERHINWEIS);
		expect(PLATZHALTERHINWEIS).toMatch(/Absicht und kein Mangel/);
	});

	it('verlangt zu jedem Befund einen Vorschlag', () => {
		expect(pruefauftrag(TRAKTANDUM, []).system).toMatch(/konkreter Vorschlag/);
	});

	it('fragt bei einer Kenntnisnahme nicht nach Beschlussangaben', () => {
		/*
		 * **Der Fund vom 05.08.2026.** Es gibt dort keinen Antragswortlaut, nichts
		 * ist mit Ja oder Nein zu entscheiden, und Angaben «für einen Beschluss»
		 * braucht es nicht — es wird keiner gefasst. Sie trotzdem zu nennen, lädt
		 * zu Befunden ein, die keine sind: «Verschiedenes» am Ende der
		 * Traktandenliste ist übliche Praxis und kein Mangel.
		 */
		// Geprüft werden die **Prüfpunkte**, nicht der ganze Auftrag: Dass der
		// Wortlaut dort ausdrücklich als kein Mangel bezeichnet wird, ist der
		// Zweck der Ergänzung und nicht ihr Verstoss.
		const punkte = pruefpunkteFuer('kenntnisnahme');
		expect(punkte).toHaveLength(2);
		expect(punkte.join(' ')).not.toMatch(/Antragswortlaut|Ja oder Nein|für einen Beschluss/);
		expect(punkte.join(' ')).toMatch(/verständliche Sprache/);
		expect(punkte.join(' ')).toMatch(/Widersprüche/);
		expect(pruefpunkteFuer('abstimmung')).toHaveLength(5);

		const k = pruefauftrag({ ...TRAKTANDUM, art: 'kenntnisnahme' }, []).system;
		expect(k).toMatch(/fehlender Antragswortlaut ist hier kein Mangel/);
	});

	it('erlaubt ausdrücklich, nichts zu finden', () => {
		// Ein Modell, das um jeden Preis etwas liefert, erfindet Mängel — und
		// nach dem dritten erfundenen liest niemand mehr hin.
		expect(pruefauftrag(TRAKTANDUM, []).system).toMatch(/leere Liste/);
		expect(pruefauftrag(TRAKTANDUM, []).system).toMatch(/Erfinde keine Mängel/);
	});
});

describe('Die Antwort deuten', () => {
	it('unterscheidet «nichts gefunden» von «nicht lesbar»', () => {
		/*
		 * **Der Fund vom 05.08.2026.** Beides sah gleich aus: «Nichts zu
		 * beanstanden.» Wer das liest, hält sein Traktandum für geprüft — dabei
		 * war die Antwort unbrauchbar und niemand hat hingesehen. Ein
		 * Prüfergebnis, das im Zweifel Entwarnung gibt, ist schlimmer als keines.
		 */
		expect(deuteAntwort({ befunde: [] })).toEqual({ befunde: [], lesbar: true });
		expect(deuteAntwort([])).toEqual({ befunde: [], lesbar: true });

		// Zerbrochenes JSON kommt als `null` aus `alsJson()`.
		expect(deuteAntwort(null).lesbar).toBe(false);
		expect(deuteAntwort('Guten Tag!').lesbar).toBe(false);
		expect(deuteAntwort({ antwort: 'alles gut' }).lesbar).toBe(false);
	});

	it('liest brauchbare Befunde weiterhin', () => {
		const d = deuteAntwort({
			befunde: [{ schwere: 'hoch', was: 'Betrag fehlt', vorschlag: 'Betrag nennen' }]
		});
		expect(d.lesbar).toBe(true);
		expect(d.befunde).toHaveLength(1);
	});
});

describe('Der Satz über dem Ergebnis', () => {
	const grund: Pruefergebnis = {
		befunde: [],
		hinausgegangen: '',
		namenGeschuetzt: 0,
		stufe: 'Infomaniak (CH)',
		dauerMs: 1400,
		nutzungId: 'x',
		fehlschlaege: []
	};

	it('nennt Haus, Zeit und Zahl der geschützten Namen', () => {
		const s = ergebnissatz({
			...grund,
			befunde: [{ schwere: 'hoch', was: 'a', vorschlag: 'b' }],
			namenGeschuetzt: 3
		});
		expect(s).toBe('1 Befund — Infomaniak (CH), 1.4 s, 3 Namen ersetzt');
	});

	it('sagt auch, wenn nichts zu beanstanden war', () => {
		expect(ergebnissatz(grund)).toMatch(/nichts zu beanstanden/);
		expect(ergebnissatz(grund)).toMatch(/keine Namen im Text/);
	});

	it('gibt bei einer unlesbaren Antwort keine Entwarnung', () => {
		const s = ergebnissatz({ ...grund, unlesbar: true });
		expect(s).not.toMatch(/nichts zu beanstanden/);
		expect(s).toMatch(/nicht lesbar/);
	});

	it('meldet einen Ausfall als Hinweis, nicht als Fehler', () => {
		// FR-62: Ein Ausfall führt nie zum Abbruch eines Ablaufs.
		const s = ergebnissatz({ ...grund, stufe: null, fehlschlaege: ['Infomaniak (CH): 503'] });
		expect(s).toMatch(/nicht möglich/);
		expect(s).toMatch(/503/);
	});
});
