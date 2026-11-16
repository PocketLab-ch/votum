/**
 * Prüfdatei zu L9 (E1, Block C): Das Skript läuft als Modul und gibt die Sätze
 * in jedem Zusammenhang aus, je Wahl und je Fall. Der Test prüft die Ausgabe und
 * schreibt keine Datei: Für die Laien- und die Fachprüfung (`quellen/pruefung/`)
 * entsteht die Prüfdatei von Hand mit `vite-node`, wie im Kopf des Skripts
 * beschrieben (Auftrag E1, «Rückmeldung»).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Prüfdatei zu L9', () => {
	it('läuft und hat je Wahl und jeden Fall einen Abschnitt', async () => {
		const protokoll: string[] = [];
		const spy = vi.spyOn(console, 'log').mockImplementation((...z: unknown[]) => {
			protokoll.push(z.map(String).join(' '));
		});
		try {
			await import('../../scripts/pruefdatei-e1-l9.ts');
		} finally {
			spy.mockRestore();
		}
		expect(protokoll).toHaveLength(1);
		const text = protokoll[0];

		expect(text).toContain(
			'# Prüfdatei: Lesarten der Gemeinschaft, E1 Block C (L9 Zählbasis der Ermächtigung zur Ausschlussklage)'
		);
		expect(text).toContain('Fassung 2026-11-10');
		expect(text).toContain('«Sonderfälle» › «Welcher Sonderfall?» ›');

		// 1. Katalog: Frage, beide Wahlen mit Wirkung und Fundstelle, Grund, Geltung, Folge.
		expect(text).toContain('## 1. Katalog: Seite «Lesarten»');
		expect(text).toContain(
			'- **Frage:** An welcher Zahl wird die Mehrheit für die Ermächtigung zur Ausschlussklage gemessen: an allen Eigentümern ohne den Beklagten oder an den Anwesenden und Vertretenen ohne ihn?'
		);
		expect(text).toContain(
			'- **Wahl «Alle Eigentümer ohne den Beklagten» (Vorgabe):** Die Mehrheit wird an allen Eigentümern ausser dem Beklagten gemessen'
		);
		expect(text).toContain(
			'- **Wahl «Anwesende und Vertretene ohne den Beklagten»:** Die Mehrheit wird nur an den Eigentümern gemessen, die da oder vertreten sind'
		);
		expect(text).toContain(
			'- **Warum die Vorgabe:** Art. 649b Abs. 2 ZGB verlangt den Mehrheitsbeschluss aller Miteigentümer mit Ausnahme des Beklagten.'
		);
		expect(text).toContain(
			'- **Geltung:** Die Einstellung gilt für die Ermächtigung zur Ausschlussklage (ZGB Art. 649b).'
		);
		expect(text).toContain(
			'- **Folge der milden Wahl (steht immer unter «Anwesende und Vertretene ohne den Beklagten»; auf der Karte nur, wenn eingestellt):** Die Ermächtigung ist eine Voraussetzung der Klage'
		);

		// 2. Karte nach beiden Wahlen: die Bezugsgrösse wechselt, der Typ bleibt.
		const karten = text.split('## 2. Karte nach beiden Wahlen')[1].split('\n## ')[0];
		const vorgabeKarte = karten.split('#### Umgestellt auf «Anwesende und Vertretene ohne den Beklagten»')[0];
		const mildKarte = karten.split('#### Umgestellt auf «Anwesende und Vertretene ohne den Beklagten»')[1];
		expect(vorgabeKarte).toContain('#### Vorgabe «Alle Eigentümer ohne den Beklagten»');
		expect(vorgabeKarte).toContain('- **typ:** einfaches_mehr');
		expect(mildKarte).toContain('- **typ:** einfaches_mehr');
		expect(vorgabeKarte).toContain(
			'- **bezugsgroessensatz:** Die Bezugsgrösse sind alle Eigentümer ohne den Beklagten, unabhängig von der Anwesenheit.'
		);
		expect(mildKarte).toContain(
			'- **bezugsgroessensatz:** Die Bezugsgrösse sind die anwesenden und vertretenen Stimmen ohne den Beklagten, der nicht mitstimmt (ZGB Art. 649b Abs. 2).'
		);
		// Der neue Hinweis zu den Zahlen nennt die Wahl, für die sie gelten
		// (Laienprüfung Runde 2, R2-L-5).
		expect(vorgabeKarte).toContain(
			'Die Zahlen auf dieser Karte gelten für die Vorgabe auf der Seite «Lesarten»: Gemessen wird an allen Eigentümern ohne den Beklagten.'
		);
		expect(mildKarte).toContain(
			'Die Zahlen auf dieser Karte gelten für die Einstellung «Anwesende und Vertretene» auf der Seite «Lesarten».'
		);
		expect(mildKarte).not.toContain('Die Zahlen auf dieser Karte gelten für die Vorgabe');
		for (const teil of [vorgabeKarte, mildKarte]) {
			// Der Streit bleibt, der Werkzeugsatz wird zur Einstellung.
			expect(teil).toContain('Nach welcher Zahl Votum rechnet, stellt Ihre Gemeinschaft auf der Seite «Lesarten» ein');
			expect(teil).not.toContain('Dieses Werkzeug rechnet');
			// Die Gegenmeinung fällt weg: Die Lesart trägt die andere Ansicht.
			expect(teil).not.toContain('zählen nur die anwesenden und vertretenen Eigentümer');
		}
		// Die Begründung sagt nicht mehr, das Werkzeug folge der strengeren Lesart.
		expect(vorgabeKarte).toContain(
			'An welcher Zahl gemessen wird, stellt Ihre Gemeinschaft ein; ein Beschluss mit der Mehrheit aller ohne den Beklagten genügt beiden.'
		);
		expect(vorgabeKarte).not.toContain('dieses Werkzeug folgt der strengeren Wortlaut-Lesart');

		// 3. Kartensatz vor der Abstimmung: die Folge der milden Wahl nur, wenn sie eingestellt ist.
		const kartensatz = text.split('## 3. Satz zur Lesart vor der Abstimmung')[1].split('\n## ')[0];
		const satzVorgabe = kartensatz.split('- **Umgestellt auf «Anwesende und Vertretene ohne den Beklagten»:**')[0];
		const satzMild = kartensatz.split('- **Umgestellt auf «Anwesende und Vertretene ohne den Beklagten»:**')[1];
		expect(satzVorgabe).toContain('rechnet nach der Lesart «Alle Eigentümer ohne den Beklagten» (Standardeinstellung:');
		expect(satzVorgabe).not.toContain('Den Streit um die Zahl vermeidet nur eine Ermächtigung mit der Mehrheit aller Eigentümer ohne den Beklagten.');
		expect(satzMild).toContain(
			'rechnet nach der Lesart «Anwesende und Vertretene ohne den Beklagten», die für Ihre Gemeinschaft eingestellt ist'
		);
		expect(satzMild).toContain('Den Streit um die Zahl vermeidet nur eine Ermächtigung mit der Mehrheit aller Eigentümer ohne den Beklagten.');

		// 4. Vier Fälle nach der Auszählung, je Leitung und Protokoll.
		const faelle = text.split('## 4. Sätze nach der Auszählung')[1].split('### Zeile im Protokoll je Beschluss')[0];
		const titel = [
			'Beide Wahlen angenommen: fünf von sechs Anwesenden stimmen zu',
			'Eingestellt «Alle Eigentümer ohne den Beklagten»: abgelehnt; nach den Anwesenden angenommen',
			'Eingestellt «Anwesende und Vertretene ohne den Beklagten»: angenommen; nach allen abgelehnt',
			'Beide Wahlen abgelehnt: drei Ja von sechs Anwesenden'
		];
		for (const t of titel) expect(faelle).toContain(`### ${t}`);
		expect(faelle.split('### ').slice(1)).toHaveLength(4);
		for (const teil of faelle.split('### ').slice(1)) {
			expect(teil, teil.slice(0, 40)).toContain('- **Ergebnis nach der eingestellten Wahl:**');
			expect(teil, teil.slice(0, 40)).toContain('- **Leitung:** Gezählt');
			expect(teil, teil.slice(0, 40)).toContain('- **Protokoll am Ausgang:**');
		}
		const fallVorgabe = faelle
			.split('### Eingestellt «Alle Eigentümer ohne den Beklagten»')[1]
			.split('\n### ')[0];
		expect(fallVorgabe).toContain('- **Ergebnis nach der eingestellten Wahl:** abgelehnt');
		expect(fallVorgabe).toContain('wäre er angenommen');
		// Unter L9 verkündet nicht Votum, sondern es gilt die Einstellung.
		expect(fallVorgabe).toContain('Verkündet wird nach der Einstellung Ihrer Gemeinschaft die Ablehnung:');
		expect(fallVorgabe).not.toContain('Votum verkündet die Ablehnung:');
		const fallMild = faelle
			.split('### Eingestellt «Anwesende und Vertretene ohne den Beklagten»')[1]
			.split('\n### ')[0];
		expect(fallMild).toContain('- **Ergebnis nach der eingestellten Wahl:** angenommen');
		expect(fallMild).toContain('wäre er abgelehnt');
		// Die Annahme trägt nur die Anwesenden: die offene Frage und der sichere Weg,
		// vor dem Rat zum Zeitpunkt der Klage (Fachprüfung E1 L9, F-1, F-2).
		expect(fallMild).toContain('Ob das Gericht im Ausschlussprozess trotzdem prüft, ob die Mehrheit aller erreicht war');
		expect(fallMild).toContain('Den Streit um die Zahl vermeidet nur eine Ermächtigung mit der Mehrheit aller Eigentümer ohne den Beklagten');
		expect(fallMild.indexOf('Den Streit um die Zahl vermeidet')).toBeLessThan(fallMild.indexOf('klagt frühestens'));
		// Laienprüfung Runde 2, R2-L-1: Warten ist unter L9 nicht mehr «am sichersten».
		expect(fallMild).not.toContain('klagt am sichersten erst');
		expect(fallMild).toContain('auch einer ausserordentlichen');
		const fallDrei = faelle.split('### Beide Wahlen abgelehnt')[1].split('\n### ')[0];
		expect(fallDrei).toContain('- **Ergebnis nach der eingestellten Wahl:** abgelehnt');
		expect(fallDrei).toContain('wäre das Ergebnis dasselbe');

		// Die Zeile im Protokoll je Beschluss, mit Vorgabe und Einstellung.
		expect(text).toContain(
			'- **Vorgabe «Alle Eigentümer ohne den Beklagten»:** Gezählt nach der Mehrheit aller Eigentümer ohne den Beklagten.'
		);
		expect(text).toContain(
			'- **Umgestellt auf «Anwesende und Vertretene ohne den Beklagten»:** Gezählt nach der Mehrheit der Anwesenden und Vertretenen ohne den Beklagten.'
		);
		expect(text).toContain('So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet.');
		expect(text).toContain(
			'Die Standardeinstellung wäre die Mehrheit aller Eigentümer ohne den Beklagten: Der Wortlaut des Gesetzes nennt alle Eigentümer ohne den Beklagten'
		);

		// Der Test schreibt keine Datei, und das Skript kann es auch nicht.
		const quelle = readFileSync('scripts/pruefdatei-e1-l9.ts', 'utf8');
		expect(quelle).not.toMatch(/writeFile|createWriteStream|appendFile/);
	});
});
