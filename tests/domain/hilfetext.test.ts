import { describe, expect, it } from 'vitest';
import {
	HILFE_ANFANG_MINDESTENS,
	HILFE_GANZ_BIS,
	teileHilfe
} from '$lib/domain/hilfetext';
import { holeRegelwerk } from '$lib/rules';
import { laufe } from '$lib/domain/entscheidbaum';

const satz = (n: number) => `Satz ${n} erklärt etwas, das man vor der Wahl wissen sollte, in ruhigen Worten.`;
const lang = (anzahl: number) => Array.from({ length: anzahl }, (_, i) => satz(i + 1)).join(' ');
const zusammen = (t: { anfang: string; mehr: string | null }) =>
	t.mehr === null ? t.anfang : `${t.anfang} ${t.mehr}`;

describe('teileHilfe', () => {
	it('lässt eine kurze Hilfe ganz', () => {
		expect(teileHilfe(lang(3))).toEqual({ anfang: lang(3), mehr: null });
	});

	it('teilt eine lange Hilfe an einer Satzgrenze, ohne etwas zu verlieren', () => {
		const text = lang(12);
		const t = teileHilfe(text);
		expect(t.mehr).not.toBeNull();
		expect(t.anfang.endsWith('.')).toBe(true);
		expect(t.anfang.length).toBeGreaterThanOrEqual(HILFE_ANFANG_MINDESTENS);
		expect(zusammen(t)).toBe(text);
	});

	it('trennt nicht nach einer Abkürzung in einer Fundstelle', () => {
		// Die einzige Stelle, an der nach der Mindestlänge ein Punkt vor einem
		// Grossbuchstaben steht, ist «Art. Rz» (erfunden, damit nur sie in Frage kommt).
		// Die Stelle liegt hinter der Mindestlänge, sonst prüfte die Probe nichts.
		const text = `${'a'.repeat(HILFE_ANFANG_MINDESTENS + 10)} gemäss Art. Rz 135 bleibt ${'b'.repeat(200)} Ende.`;
		expect(teileHilfe(text).mehr).toBeNull();
	});

	it('trennt nicht nach weiteren Abkürzungen und nicht in einem Datum', () => {
		const vor = 'a'.repeat(HILFE_ANFANG_MINDESTENS + 10);
		for (const stelle of [
			'seit dem 14. Dezember 2021',
			'Art. 712g i. V. m. Art. 68',
			'Art. 712a ff. ZGB',
			'd. h. Die Frage',
			'in St. Gallen',
			'Abs. 1 Bst. A'
		]) {
			expect(teileHilfe(`${vor} ${stelle} ${'b'.repeat(200)} Ende.`).mehr, stelle).toBeNull();
		}
	});

	it('trennt in Votum an derselben Stelle wie im Export', () => {
		// Votum teilt den Quelltext und entfernt die Auszeichnung danach; der
		// Export teilt denselben Quelltext. Beide Anfänge sind also derselbe Satz.
		// Die ausgelieferte Fassung, nicht eine feste: der Export läuft immer auf der aktuellen.
		const f = holeRegelwerk().fragen.find((x) => x.id === 'f1-4')!;
		const lauf = laufe(holeRegelwerk(), 'a-bauen', [
			'f1-0-nein',
			'f1-1-nein',
			'f1-2-nein',
			'f1-3-verschoenerung'
		]);
		expect(lauf.stand.art).toBe('frage');
		if (lauf.stand.art !== 'frage') return;
		const quelle = teileHilfe(f.hilfe!);
		expect(lauf.stand.frage.hilfeTeile?.anfang).toBe(quelle.anfang.replace(/\*\*/g, ''));
		expect(lauf.stand.frage.hilfeTeile?.mehr).toBe(quelle.mehr!.replace(/\*\*/g, ''));
	});

	it('trennt nicht innerhalb einer Hervorhebung', () => {
		// Die Hervorhebung beginnt bei 440 Zeichen; ihre innere Satzgrenze liegt
		// nach der Mindestlänge und muss übersprungen werden.
		const text = `${'Ein Wort. '.repeat(44)}**Erster Satz fett. Zweiter Satz fett.** ${'Rest folgt. '.repeat(20)}`;
		const t = teileHilfe(text.trim());
		expect(t.mehr).not.toBeNull();
		expect((t.anfang.match(/\*\*/g) ?? []).length % 2).toBe(0);
		expect(t.anfang.endsWith('Zweiter Satz fett.**')).toBe(true);
		expect(zusammen(t)).toBe(text.trim());
	});

	it('teilt die Hilfe zur Frage f1-4 nach den drei Bedingungen', () => {
		const f = holeRegelwerk().fragen.find((x) => x.id === 'f1-4')!;
		const t = teileHilfe(f.hilfe!);
		expect(t.mehr).not.toBeNull();
		// Die drei Bedingungen stehen zusammen im sichtbaren Anfang.
		for (const teil of [/Erstens/, /Zweitens/, /Drittens/, /Alle drei müssen zutreffen und feststehen\.\*\*$/]) {
			expect(t.anfang).toMatch(teil);
		}
		expect(zusammen(t)).toBe(f.hilfe);
	});

	it('gibt jede Hilfe des aktuellen Regelwerks vollständig wieder und teilt nur lange', () => {
		for (const f of holeRegelwerk().fragen) {
			if (!f.hilfe) continue;
			const t = teileHilfe(f.hilfe);
			expect(zusammen(t), f.id).toBe(f.hilfe);
			if (f.hilfe.length <= HILFE_GANZ_BIS) expect(t.mehr, f.id).toBeNull();
		}
	});
});
