/**
 * Prüfdatei zu L12 (E1, Block B): Das Skript läuft als Modul und gibt die
 * Sätze in jedem Zusammenhang aus, je Wahl und je Fall. Der Test prüft die
 * Ausgabe und schreibt keine Datei: Für die Laien- und die Fachprüfung
 * (`quellen/pruefung/`) entsteht die Prüfdatei von Hand mit `vite-node`, wie
 * im Kopf des Skripts beschrieben (Auftrag E1, «Rückmeldung»).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Prüfdatei zu L12', () => {
	it('läuft und hat je Wahl und jeden Fall einen Abschnitt', async () => {
		const protokoll: string[] = [];
		const spy = vi.spyOn(console, 'log').mockImplementation((...z: unknown[]) => {
			protokoll.push(z.map(String).join(' '));
		});
		try {
			await import('../../scripts/pruefdatei-e1-l12.ts');
		} finally {
			spy.mockRestore();
		}
		expect(protokoll).toHaveLength(1);
		const text = protokoll[0];

		expect(text).toContain(
			'# Prüfdatei: Lesarten der Gemeinschaft, E1 Block B (L12 luxuriöse bauliche Massnahme)'
		);
		expect(text).toContain('Fassung 2026-11-10');
		expect(text).toContain('«Bauen, sanieren, erneuern» › «Dient die Massnahme nur');

		// 1. Katalog: Frage, beide Wahlen mit Wirkung und Fundstelle, Grund, Geltung, Folge.
		expect(text).toContain('## 1. Katalog: Seite «Lesarten»');
		expect(text).toContain(
			'- **Frage:** Wessen Zustimmung braucht eine luxuriöse bauliche Massnahme: die aller eingetragenen Eigentümer oder die aller Anwesenden und Vertretenen?'
		);
		expect(text).toContain(
			'- **Wahl «Alle eingetragenen Eigentümer» (Vorgabe):** Jeder im Grundbuch eingetragene Eigentümer muss zustimmen'
		);
		expect(text).toContain(
			'- **Wahl «Alle Anwesenden und Vertretenen»:** Es genügt, dass alle zustimmen, die da oder vertreten sind.'
		);
		expect(text).toContain('- **Warum die Vorgabe:** Die herrschende Lehre verlangt für die luxuriöse Massnahme');
		expect(text).toContain('- **Geltung:** Die Einstellung gilt für die luxuriöse bauliche Massnahme');
		expect(text).toContain(
			'- **Folge der milden Wahl (steht immer unter «Alle Anwesenden und Vertretenen»; auf der Karte nur, wenn eingestellt):** Nach der herrschenden Lehre braucht es die Zustimmung aller eingetragenen Eigentümer.'
		);

		// 2. Karte nach beiden Wahlen, mit dem neuen Hinweis und ohne den alten.
		const karten = text.split('## 2. Karte nach beiden Wahlen')[1].split('\n## ')[0];
		const vorgabeKarte = karten.split('#### Umgestellt auf «Alle Anwesenden und Vertretenen»')[0];
		const mildKarte = karten.split('#### Umgestellt auf «Alle Anwesenden und Vertretenen»')[1];
		expect(vorgabeKarte).toContain('#### Vorgabe «Alle eingetragenen Eigentümer»');
		expect(vorgabeKarte).toContain('- **typ:** einstimmigkeit');
		/*
		 * Unter «anwesende» trägt die Karte die eigene Formel der Wahl
		 * (`FORMEL_ANWESENDE`), nicht die des Typs «einstimmigkeit», die «nicht
		 * nur der Anwesenden» sagt (Bericht des Baus, offener Wortlaut).
		 */
		expect(mildKarte).toContain('- **formel:** Zustimmung sämtlicher anwesenden und vertretenen Eigentümer');
		expect(mildKarte).not.toContain('nicht nur der Anwesenden');
		expect(vorgabeKarte).toContain('nicht nur der Anwesenden');
		expect(vorgabeKarte).toContain(
			'- **bezugsgroessensatz:** Die Bezugsgrösse sind alle Eigentümer, auch die nicht erschienenen.'
		);
		expect(mildKarte).toContain(
			'- **bezugsgroessensatz:** Die Bezugsgrösse sind die anwesenden und vertretenen Stimmen.'
		);
		for (const teil of [vorgabeKarte, mildKarte]) {
			expect(teil).toContain('Nach welcher Zählung Votum rechnet, stellt Ihre Gemeinschaft auf der Seite «Lesarten» ein');
			expect(teil).toContain('Die Zustimmung aller eingetragenen Eigentümer genügt beiden Lesarten.');
			expect(teil).not.toContain('Dieses Werkzeug rechnet über alle Eigentümer');
			// Der erste Hinweis bleibt an beiden Wahlen stehen.
			expect(teil).toContain('Ein Weg ohne Einstimmigkeit besteht nach ZGB Art. 647e Abs. 2');
		}
		// Der Weg der Karte: unter der Vorgabe der alte, unter der milden Wahl der neue.
		expect(vorgabeKarte).toContain('Fehlt die Zustimmung von Abwesenden, kommt der Beschluss nach herrschender Lehre nicht zustande.');
		expect(mildKarte).toContain('Gerechnet wird nach der Einstellung Ihrer Gemeinschaft mit der Zustimmung aller Anwesenden und');
		expect(mildKarte).toContain('Unterschriften nur derer, die gefehlt haben, holen ihn nicht nach.');

		// 3. Kartensatz vor der Abstimmung: die Folge der milden Wahl nur, wenn sie eingestellt ist.
		const kartensatz = text.split('## 3. Satz zur Lesart vor der Abstimmung')[1].split('\n## ')[0];
		const satzVorgabe = kartensatz.split('- **Umgestellt auf «Alle Anwesenden und Vertretenen»:**')[0];
		const satzMild = kartensatz.split('- **Umgestellt auf «Alle Anwesenden und Vertretenen»:**')[1];
		expect(satzVorgabe).toContain('rechnet nach der Lesart «Alle eingetragenen Eigentümer» (Standardeinstellung:');
		expect(satzVorgabe).not.toContain('Sicher ist der Beschluss mit der Zustimmung aller eingetragenen Eigentümer;');
		expect(satzMild).toContain(
			'rechnet nach der Lesart «Alle Anwesenden und Vertretenen», die für Ihre Gemeinschaft eingestellt ist'
		);
		expect(satzMild).toContain('Sicher ist der Beschluss mit der Zustimmung aller eingetragenen Eigentümer;');

		// 4. Vier Fälle nach der Auszählung, je Leitung und Protokoll.
		const faelle = text.split('## 4. Sätze nach der Auszählung')[1].split('### Zeile im Protokoll je Beschluss')[0];
		const titel = [
			'Beide Lesarten angenommen: alle sechs Eigentümer stimmen zu',
			'Eingestellt «Alle eingetragenen Eigentümer»: abgelehnt, weil einer fehlt; nach der milden Lesart angenommen',
			'Eingestellt «Alle Anwesenden und Vertretenen»: angenommen; nach der strengen Lesart abgelehnt',
			'Beide Lesarten abgelehnt: ein Anwesender enthält sich'
		];
		for (const t of titel) expect(faelle).toContain(`### ${t}`);
		expect(faelle.split('### ').slice(1)).toHaveLength(4);
		for (const teil of faelle.split('### ').slice(1)) {
			expect(teil, teil.slice(0, 40)).toContain('- **Ergebnis nach der eingestellten Wahl:**');
			expect(teil, teil.slice(0, 40)).toContain('- **Leitung:** Nach der');
			expect(teil, teil.slice(0, 40)).toContain('- **Protokoll am Ausgang:** Nach der anderen Lesart');
		}
		const fallVorgabe = faelle.split('### Eingestellt «Alle eingetragenen Eigentümer»')[1].split('\n### ')[0];
		expect(fallVorgabe).toContain('- **Ergebnis nach der eingestellten Wahl:** abgelehnt');
		expect(fallVorgabe).toContain('wäre er angenommen');
		const fallMild = faelle.split('### Eingestellt «Alle Anwesenden und Vertretenen»')[1].split('\n### ')[0];
		expect(fallMild).toContain('- **Ergebnis nach der eingestellten Wahl:** angenommen');
		expect(fallMild).toContain('wäre er abgelehnt');
		// Der eigene Rat der Lesart steht statt des allgemeinen (W15).
		expect(fallMild).toContain('Folgt das Gericht der herrschenden Lehre, hebt es ihn auf.');
		expect(fallMild).not.toContain('nicht mehr angreifbar');
		const fallEnthaltung = faelle.split('### Beide Lesarten abgelehnt')[1].split('\n### ')[0];
		expect(fallEnthaltung).toContain('- **Ergebnis nach der eingestellten Wahl:** abgelehnt');

		// Die Zeile im Protokoll je Beschluss, mit Vorgabe und Einstellung.
		expect(text).toContain('- **Vorgabe «Alle eingetragenen Eigentümer»:** Gezählt nach der Zustimmung aller eingetragenen Eigentümer.');
		expect(text).toContain('- **Umgestellt auf «Alle Anwesenden und Vertretenen»:** Gezählt nach der Zustimmung aller Anwesenden und Vertretenen.');
		expect(text).toContain('So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet.');

		// Der Test schreibt keine Datei, und das Skript kann es auch nicht.
		const quelle = readFileSync('scripts/pruefdatei-e1-l12.ts', 'utf8');
		expect(quelle).not.toMatch(/writeFile|createWriteStream|appendFile/);
	});
});
