/**
 * Prüfdatei zu L11 (E1, Block A): Das Skript läuft als Modul und gibt die
 * Sätze in jedem Zusammenhang aus, je Wahl und je Fall. Der Test prüft die
 * Ausgabe und schreibt keine Datei: Für die Laien- und die Fachprüfung
 * (`quellen/pruefung/`) entsteht die Prüfdatei von Hand mit `vite-node`, wie
 * im Kopf des Skripts beschrieben (Auftrag E1, «Rückmeldung»).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Prüfdatei zu L11', () => {
	it('läuft und hat je Wahl und jeden Fall einen Abschnitt', async () => {
		const protokoll: string[] = [];
		const spy = vi.spyOn(console, 'log').mockImplementation((...z: unknown[]) => {
			protokoll.push(z.map(String).join(' '));
		});
		try {
			await import('../../scripts/pruefdatei-e1-l11.ts');
		} finally {
			spy.mockRestore();
		}
		expect(protokoll).toHaveLength(1);
		const text = protokoll[0];

		expect(text).toContain('# Prüfdatei: Lesarten der Gemeinschaft, E1 Block A (L11 Ermächtigung zur Prozessführung)');
		expect(text).toContain('Fassung 2026-11-10');
		expect(text).toContain('«Geld und Jahresgeschäfte» › «Um welches Jahresgeschäft');

		// 1. Katalog: Frage, beide Wahlen mit Wirkung und Fundstelle, Grund, Geltung, Folge.
		expect(text).toContain('## 1. Katalog: Seite «Lesarten»');
		expect(text).toContain(
			'- **Frage:** Welches Mehr braucht der Beschluss, der die Bewirtschaftung ermächtigt, für die Gemeinschaft einen Prozess zu führen?'
		);
		// Seit Block C: wie die Köpfe zählen, stellt L13 ein.
		expect(text).toContain('- **Wahl «Qualifiziertes Mehr» (Vorgabe):** Es braucht die Mehrheit nach Köpfen, gezählt, wie es die Frage zur Zählweise der Köpfe einstellt');
		expect(text).toContain('- **Wahl «Einfaches Mehr»:** Gezählt werden nur die Köpfe der Anwesenden und Vertretenen');
		expect(text).toContain('- **Warum die Vorgabe:** Der SVIT-Kommentar sieht in der Ermächtigung zur Prozessführung');
		expect(text).toContain('- **Geltung:** Die Einstellung gilt für die Ermächtigung der Bewirtschaftung');
		expect(text).toContain('- **Folge der milden Wahl (steht immer unter «Einfaches Mehr»; auf der Karte nur, wenn eingestellt):** Eine Gegenpartei ausserhalb der Gemeinschaft, etwa ein Handwerker');

		// 2. Karte nach beiden Wahlen, mit dem neuen Hinweis und ohne den alten.
		const karten = text.split('## 2. Karte nach beiden Wahlen')[1].split('\n## ')[0];
		const vorgabeKarte = karten.split('#### Umgestellt auf «Einfaches Mehr»')[0];
		const einfachKarte = karten.split('#### Umgestellt auf «Einfaches Mehr»')[1];
		expect(vorgabeKarte).toContain('#### Vorgabe «Qualifiziertes Mehr»');
		expect(vorgabeKarte).toContain('- **typ:** qualifiziertes_mehr');
		expect(vorgabeKarte).toContain('- **quotenwirkungssatz:** Bei den Wertquoten ist die Bezugsgrösse die Gesamtheit aller Quoten');
		expect(einfachKarte).toContain('- **typ:** einfaches_mehr');
		expect(einfachKarte).not.toContain('- **quotenwirkungssatz:**');
		for (const teil of [vorgabeKarte, einfachKarte]) {
			expect(teil).toContain('Nach welchem Mehr Votum rechnet, stellt Ihre Gemeinschaft auf der Seite «Lesarten» ein');
			expect(teil).toContain('Eine Ermächtigung mit dem qualifizierten Mehr genügt beiden Lesarten.');
			expect(teil).not.toContain('Dieses Werkzeug setzt das strengere Erfordernis an');
			// Der zweite Hinweis bleibt an beiden Wahlen stehen.
			expect(teil).toContain('Diese Karte gilt nicht für die Ausschlussklage.');
		}

		// 3. Kartensatz vor der Abstimmung: die Folge der milden Wahl nur, wenn sie eingestellt ist.
		const kartensatz = text.split('## 3. Satz zur Lesart vor der Abstimmung')[1].split('\n## ')[0];
		const satzVorgabe = kartensatz.split('- **Umgestellt auf «Einfaches Mehr»:**')[0];
		const satzEinfach = kartensatz.split('- **Umgestellt auf «Einfaches Mehr»:**')[1];
		expect(satzVorgabe).toContain('rechnet nach der Lesart «Qualifiziertes Mehr» (Standardeinstellung:');
		expect(satzVorgabe).not.toContain('Im Streit um das Mehr sicher ist eine Ermächtigung');
		expect(satzEinfach).toContain('rechnet nach der Lesart «Einfaches Mehr», die für Ihre Gemeinschaft eingestellt ist');
		// Fachprüfung Block C, Nachtrag, N-F-3.
		expect(satzEinfach).toContain('Im Streit um das Mehr sicher ist eine Ermächtigung mit dem qualifizierten Mehr.');

		// 4. Vier Fälle nach der Auszählung, je Leitung und Protokoll.
		const faelle = text.split('## 4. Sätze nach der Auszählung')[1].split('### Zeile im Protokoll je Beschluss')[0];
		const titel = [
			'Beide Lesarten angenommen: alle fünf Anwesenden stimmen zu',
			'Eingestellt «Qualifiziertes Mehr»: abgelehnt; nach dem einfachen Mehr angenommen',
			'Eingestellt «Einfaches Mehr»: angenommen; nach dem qualifizierten Mehr abgelehnt',
			'Beide Lesarten abgelehnt: zwei Ja von fünf Anwesenden'
		];
		for (const t of titel) expect(faelle).toContain(`### ${t}`);
		expect(faelle.split('### ').slice(1)).toHaveLength(4);
		for (const teil of faelle.split('### ').slice(1)) {
			expect(teil, teil.slice(0, 40)).toContain('- **Ergebnis nach der eingestellten Wahl:**');
			expect(teil, teil.slice(0, 40)).toContain('- **Leitung:** Nach der');
			expect(teil, teil.slice(0, 40)).toContain('- **Protokoll am Ausgang:** Nach der anderen Lesart');
		}
		const fallQualifiziert = faelle.split('### Eingestellt «Qualifiziertes Mehr»')[1].split('\n### ')[0];
		expect(fallQualifiziert).toContain('- **Ergebnis nach der eingestellten Wahl:** abgelehnt');
		expect(fallQualifiziert).toContain('Das Gericht hebt sie dann in der Regel nur auf');
		expect(fallQualifiziert).toContain('auch im Eilfall nicht ohne Ermächtigung klagen');
		const fallEinfach = faelle.split('### Eingestellt «Einfaches Mehr»')[1].split('\n### ')[0];
		expect(fallEinfach).toContain('- **Ergebnis nach der eingestellten Wahl:** angenommen');
		expect(fallEinfach).toContain('480 Ja von 1000 Wertquoten, nötig 501');
		// Der eigene Rat der Lesart steht statt des allgemeinen (Fachprüfung E1 L11, F-2, F-7).
		expect(fallEinfach).toContain('wann eine weitere Versammlung nötig wird, steht in den Hinweisen der Karte');
		expect(fallEinfach).toContain('kann es ihn aufheben');
		expect(fallEinfach).toContain('Nach der anderen Lesart («Qualifiziertes Mehr»: mehr als die Hälfte der Anwesenden oder Vertretenen und mehr als die Hälfte aller Wertquoten), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen');

		// Die Zeile im Protokoll je Beschluss, mit Vorgabe und Einstellung.
		expect(text).toContain('- **Vorgabe «Qualifiziertes Mehr»:** Gezählt nach dem qualifizierten Mehr.');
		expect(text).toContain('- **Umgestellt auf «Einfaches Mehr»:** Gezählt nach dem einfachen Mehr.');
		expect(text).toContain('So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet.');

		// Der Test schreibt keine Datei, und das Skript kann es auch nicht.
		const quelle = readFileSync('scripts/pruefdatei-e1-l11.ts', 'utf8');
		expect(quelle).not.toMatch(/writeFile|createWriteStream|appendFile/);
	});
});
