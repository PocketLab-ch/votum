/**
 * Prüfdatei zu L10 (E1, Block D): Das Skript läuft als Modul und gibt die Sätze
 * in jedem Zusammenhang aus, je Wahl und je Fall. Der Test prüft die Ausgabe und
 * schreibt keine Datei: Für die Laien- und die Fachprüfung (`quellen/pruefung/`)
 * entsteht die Prüfdatei von Hand mit `vite-node`, wie im Kopf des Skripts
 * beschrieben (Auftrag E1, «Rückmeldung»).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Prüfdatei zu L10', () => {
	it('läuft und hat je Wahl und jeden Fall einen Abschnitt', async () => {
		const protokoll: string[] = [];
		const spy = vi.spyOn(console, 'log').mockImplementation((...z: unknown[]) => {
			protokoll.push(z.map(String).join(' '));
		});
		try {
			await import('../../scripts/pruefdatei-e1-l10.ts');
		} finally {
			spy.mockRestore();
		}
		expect(protokoll).toHaveLength(1);
		const text = protokoll[0];

		expect(text).toContain(
			'# Prüfdatei: Lesarten der Gemeinschaft, E1 Block D (L10 Angehörige im Ausstand an der Ermächtigung zur Ausschlussklage)'
		);
		expect(text).toContain('Fassung 2026-11-10');
		expect(text).toContain('«Sonderfälle» › «Welcher Sonderfall?» ›');

		// 1. Katalog: Frage, beide Wahlen mit Wirkung und Fundstelle, Grund, Geltung, Folge.
		expect(text).toContain('## 1. Katalog: Seite «Lesarten»');
		expect(text).toContain(
			'- **Frage:** Bleiben Angehörige des Beklagten mit eigener Wohnung, die im Ausstand sind, in der Zahl, an der die Mehrheit für die Ermächtigung zur Ausschlussklage gemessen wird?'
		);
		expect(text).toContain(
			'- **Wahl «Bleiben in der Zahl» (Vorgabe):** Die Angehörigen stimmen nicht mit, zählen aber in der Zahl aller Eigentümer und wirken wie ein Nein.'
		);
		expect(text).toContain(
			'- **Wahl «Fallen aus der Zahl»:** Die Angehörigen stimmen nicht mit und zählen auch in der Zahl aller Eigentümer nicht.'
		);
		expect(text).toContain(
			'- **Warum die Vorgabe:** Art. 649b Abs. 2 ZGB nimmt aus der Zahl aller Eigentümer nur den Beklagten aus.'
		);
		expect(text).toContain(
			'- **Geltung:** Die Einstellung gilt nur für die Ermächtigung zur Ausschlussklage, wenn die Mehrheit an allen Eigentümern ohne den Beklagten gemessen wird.'
		);
		expect(text).toContain(
			'- **Folge der milden Wahl (steht immer unter «Fallen aus der Zahl»; auf der Karte nur, wenn eingestellt):** Die Ermächtigung ist eine Voraussetzung der Klage'
		);

		// 2. Die Karte ist für beide Wahlen dieselbe; der Hinweis 9 nennt die Einstellung (W12).
		const karte = text.split('## 2. Karte (für beide Wahlen dieselbe)')[1].split('\n## ')[0];
		expect(karte).toContain('#### Ermächtigung zur Ausschlussklage');
		expect(karte).toContain('- **typ:** einfaches_mehr');
		expect(karte).toContain(
			'- **bezugsgroessensatz:** Die Bezugsgrösse sind alle Eigentümer ohne den Beklagten, unabhängig von der Anwesenheit.'
		);
		expect(karte).toContain(
			'Ob sie in der Zahl bleiben, an der die Mehrheit gemessen wird, stellt Ihre Gemeinschaft auf der Seite «Lesarten» ein.'
		);
		expect(karte).toContain(
			'Bei elf Eigentümern, einem Beklagten und seiner Ehefrau mit eigener Wohnung braucht es dann sechs Ja von zehn.'
		);
		// Der alte Satz zu 1e behauptete, Votum lasse sie fest in der Zahl.
		expect(karte).not.toContain('lässt Votum sie trotzdem, wie es der Wortlaut von');

		// 3. Satz vor der Abstimmung (W11): die Folge der milden Wahl nur, wenn sie eingestellt ist.
		const hinweis = text.split('## 3. Satz vor der Abstimmung (W11) nach beiden Wahlen')[1].split('\n## ')[0];
		const hinweisVorgabe = hinweis.split('- **Umgestellt auf «Fallen aus der Zahl»:**')[0];
		const hinweisMild = hinweis.split('- **Umgestellt auf «Fallen aus der Zahl»:**')[1];
		expect(hinweisVorgabe).toContain(
			'- **Vorgabe «Bleiben in der Zahl»:** Ob die Angehörigen im Ausstand in der Zahl aller Eigentümer bleiben, stellt Ihre Gemeinschaft auf der Seite «Lesarten» ein. Nach der Auszählung nennt Votum auch das Ergebnis nach der anderen Wahl.'
		);
		expect(hinweisVorgabe).not.toContain('Den Streit um die Zahl vermeidet nur eine Ermächtigung');
		expect(hinweisMild).toContain('Den Streit um die Zahl vermeidet nur eine Ermächtigung, die die Mehrheit auch mit den Angehörigen in der Zahl erreicht.');

		// 4. Hinweis an die Leitung (W13): unter «fallen_heraus» kein Rat, von Hand zu zählen.
		const leitung = text.split('## 4. Hinweis an die Leitung zu den Angehörigen (W13) nach beiden Wahlen')[1].split('\n## ')[0];
		const leitungVorgabe = leitung.split('- **Umgestellt auf «Fallen aus der Zahl»:**')[0];
		const leitungMild = leitung.split('- **Umgestellt auf «Fallen aus der Zahl»:**')[1];
		expect(leitungVorgabe).toContain('Die Anwendung lässt diese Angehörigen in der Zahl aller Eigentümer');
		expect(leitungVorgabe).not.toContain('Nach der Einstellung Ihrer Gemeinschaft misst die Anwendung');
		// Ein Satz zur Messung, nicht zwei (Laien- und Fachprüfung L10, L-6 und F3).
		expect(leitungMild).toContain(
			'Nach der Einstellung Ihrer Gemeinschaft misst die Anwendung die Mehrheit ohne die Angehörigen mit eigener Wohnung.'
		);
		expect(leitungMild.split('misst die Anwendung die Mehrheit ohne').length).toBe(2);
		expect(leitungMild).not.toContain('Die Anwendung misst die Mehrheit ohne');
		expect(leitungMild).toContain(
			'Sind solche Angehörige im Ausstand, nennt die Anwendung nach der Auszählung auch das Ergebnis mit ihnen in der Zahl.'
		);

		// 5. Vier Fälle nach der Auszählung, je Leitung und Protokoll.
		const faelle = text.split('## 5. Sätze nach der Auszählung')[1];
		const titel = [
			'Beide Wahlen angenommen: sechs von neun Anwesenden stimmen zu',
			'Eingestellt «Bleiben in der Zahl»: abgelehnt; ohne die Angehörigen angenommen',
			'Eingestellt «Fallen aus der Zahl»: angenommen; mit ihnen in der Zahl abgelehnt',
			'Beide Wahlen abgelehnt: vier Ja von neun Anwesenden'
		];
		for (const t of titel) expect(faelle).toContain(`### ${t}`);
		expect(faelle.split('### ').slice(1)).toHaveLength(4);
		for (const teil of faelle.split('### ').slice(1)) {
			expect(teil, teil.slice(0, 40)).toContain('- **Ergebnis nach der eingestellten Wahl:**');
			expect(teil, teil.slice(0, 40)).toContain('- **Köpfe:**');
			expect(teil, teil.slice(0, 40)).toContain('- **Leitung:** Nach der');
			// Ohne Abweichung steht L10 nicht im Protokoll (Codeprüfung Block D, N3).
			const gleich = teil.startsWith('Beide Wahlen');
			expect(teil, teil.slice(0, 40)).toContain(
				gleich ? '- **Protokoll am Ausgang:** (kein Satz im Protokoll)' : '- **Protokoll am Ausgang:** Nach der anderen Lesart'
			);
		}
		const fallGleich = faelle.split('### Beide Wahlen angenommen')[1].split('\n### ')[0];
		expect(fallGleich).toContain('- **Ergebnis nach der eingestellten Wahl:** angenommen');
		expect(fallGleich).toContain('- **Köpfe:** 6 Ja von 10, nötig 6');
		expect(fallGleich).toContain('dasselbe Ergebnis');
		const fallVorgabe = faelle
			.split('### Eingestellt «Bleiben in der Zahl»')[1]
			.split('\n### ')[0];
		expect(fallVorgabe).toContain('- **Ergebnis nach der eingestellten Wahl:** abgelehnt');
		expect(fallVorgabe).toContain('- **Köpfe:** 5 Ja von 10, nötig 6');
		expect(fallVorgabe).toContain('wäre er angenommen: 5 Ja von 9 Kopfstimmen, nötig 5');
		expect(fallVorgabe).toContain(
			'- **Protokoll am Ausgang:** Nach der anderen Lesart («Fallen aus der Zahl»: die Rechnung ohne die Angehörigen), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag angenommen gewesen: 5 Ja von 9 Kopfstimmen, nötig 5. Verkündet ist die Ablehnung; ermächtigt ist damit niemand, und auch eine Anfechtung der Ablehnung allein ermächtigt nicht zur Klage.'
		);
		const fallMild = faelle
			.split('### Eingestellt «Fallen aus der Zahl»')[1]
			.split('\n### ')[0];
		expect(fallMild).toContain('- **Ergebnis nach der eingestellten Wahl:** angenommen');
		expect(fallMild).toContain('- **Köpfe:** 5 Ja von 9, nötig 5');
		expect(fallMild).toContain('wäre er abgelehnt: 5 Ja von 10 Kopfstimmen, nötig 6');
		// Die andere Wahl lehnt ab: der Rat nach der Annahme steht im Protokoll (L10).
		expect(fallMild).toContain('Verkündet ist die Ermächtigung; sie gilt, bis ein Gericht sie aufhebt.');
		const fallDrei = faelle.split('### Beide Wahlen abgelehnt')[1].split('\n### ')[0];
		expect(fallDrei).toContain('- **Ergebnis nach der eingestellten Wahl:** abgelehnt');
		expect(fallDrei).toContain('- **Köpfe:** 4 Ja von 10, nötig 6');
		expect(fallDrei).not.toContain('wäre das Ergebnis dasselbe gewesen');

		// Der Test schreibt keine Datei, und das Skript kann es auch nicht.
		const quelle = readFileSync('scripts/pruefdatei-e1-l10.ts', 'utf8');
		expect(quelle).not.toMatch(/writeFile|createWriteStream|appendFile/);
	});
});
