/**
 * Musterwortlaute je Geschäftsart (23.08.2026, Prüflauf I, B-18).
 *
 * «Für elf Traktanden habe ich elf Anträge frei formuliert. Die Anwendung kennt
 * die Geschäftsart, den Titel und den Betrag.»
 */
import { describe, expect, it } from 'vitest';
import { antragsmuster, hatMuster } from '$lib/domain/antragsmuster';

describe('antragsmuster', () => {
	it('schreibt einen führenden Artikel klein', () => {
		// «beschliesst Die Sanierung» wäre ein Fehler, den jeder sieht und der
		// doch durchginge, weil man den Vorschlag überfliegt.
		const satz = antragsmuster('baulich_notwendig', 'Die Sanierung der Tiefgaragen-Einfahrt');
		expect(satz).toMatch(/beschliesst die Sanierung der Tiefgaragen-Einfahrt/);
	});

	it('lässt jedes andere Wort in Ruhe', () => {
		// Im Deutschen bleibt ein Substantiv auch mitten im Satz gross;
		// «beschliesst dachsanierung» sähe nach Tippfehler aus.
		expect(antragsmuster('baulich_notwendig', 'Dachsanierung Haus B')).toMatch(
			/beschliesst Dachsanierung Haus B/
		);
	});

	it('lässt den Titel weg, wo er nicht in den Satz passt', () => {
		// «beschliesst Hausordnung anpassen in der vorliegenden Fassung» — der
		// Titel ist hier eine Handlung, kein Gegenstand.
		const satz = antragsmuster('hausordnung', 'Hausordnung anpassen')!;
		expect(satz).not.toMatch(/anpassen/);
		expect(satz).toMatch(/vorliegende Fassung der Hausordnung/);
	});

	it('lässt den Betrag als sichtbare Lücke', () => {
		// Eine erfundene Zahl wäre schlimmer als eine Lücke: Sie stünde im
		// Beschluss und läse sich wie geprüft.
		expect(antragsmuster('baulich_notwendig', 'Dachsanierung')).toMatch(/… Franken/);
	});

	it('kommt ohne Titel aus', () => {
		expect(antragsmuster('jahresgeschaefte', '')).toMatch(/genehmigt …/);
	});

	it('lässt keinen Platzhalter stehen', () => {
		// Ein «{titel}» im Antragswortlaut stünde später im Protokoll.
		for (const art of ['baulich_notwendig', 'hausordnung', 'organe', 'reglement'] as const) {
			expect(antragsmuster(art, 'Probe'), art).not.toMatch(/[{}]/);
			expect(antragsmuster(art, ''), art).not.toMatch(/[{}]/);
		}
	});

	it('schweigt, wo sich nichts vorschlagen lässt', () => {
		// Für Sonderfälle wäre jedes Muster eine Behauptung.
		expect(antragsmuster('sonderfall', 'Ausschlussklage')).toBeNull();
		expect(hatMuster('sonderfall')).toBe(false);
		expect(antragsmuster(null, 'Irgendwas')).toBeNull();
	});

	it('kennt die häufigen Arten', () => {
		for (const art of [
			'baulich_notwendig',
			'baulich_nuetzlich',
			'baulich_luxurioes',
			'jahresgeschaefte',
			'organe',
			'reglement'
		] as const) {
			expect(hatMuster(art), art).toBe(true);
		}
	});

	it('macht aus jedem Muster einen ganzen Satz', () => {
		// Ein Vorschlag, der mit einem Halbsatz endet, wird nicht redigiert,
		// sondern abgeschickt.
		for (const art of ['baulich_notwendig', 'organe', 'hausordnung'] as const) {
			const satz = antragsmuster(art, 'Probe')!;
			expect(satz.startsWith('Die Versammlung'), art).toBe(true);
			expect(satz.trimEnd().endsWith('.'), art).toBe(true);
		}
	});
});
