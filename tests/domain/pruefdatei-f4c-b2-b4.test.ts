/**
 * Prüfdatei zu L7 und, in den Läufen 2 und 3, zu L8 (F4c, Blöcke 4 und 5):
 * Das Skript läuft als Modul und gibt die Sätze je Wahl und Lage aus. Der
 * Test prüft die Ausgabe und schreibt keine Datei: Für die Laien- und die
 * Fachprüfung (`quellen/pruefung/`) entsteht die Prüfdatei von Hand mit
 * `vite-node`, wie im Kopf des Skripts beschrieben (Auftrag F4c,
 * «Abnahme»).
 */
import { describe, expect, it, vi } from 'vitest';

describe('Prüfdatei zu L7 und L8', () => {
	it('läuft und hat je Wahl und jede Lage einen Abschnitt', async () => {
		const protokoll: string[] = [];
		const spy = vi.spyOn(console, 'log').mockImplementation((...z: unknown[]) => {
			protokoll.push(z.map(String).join(' '));
		});
		try {
			await import('../../scripts/pruefdatei-f4c-b2-b4.ts');
		} finally {
			spy.mockRestore();
		}
		expect(protokoll).toHaveLength(1);
		const text = protokoll[0];

		expect(text).toContain('# Prüfdatei: Votum F4c, B2 und B4 (L7 Ausstand und Beschlussfähigkeit, L8 Vollmachten der Verwaltung)');
		// «Texte nach 0047», Punkt 2: Auswertung und Stimmnachweis nennen zu L8 kein gleiches zweites Ergebnis mehr.
		expect(text).not.toContain('**Zeile in der Auswertung:** Nach der anderen Lesart («Vollmachten ruhen») wäre das Ergebnis dasselbe gewesen.');
		expect(text).toContain('## 1. Katalog: Seite «Lesarten»');
		expect(text).toContain('- **Frage:** Zählt für die Beschlussfähigkeit mit, wer bei einem Traktandum im Ausstand ist?');
		expect(text).toContain('- **Wahl «Zählt mit» (Vorgabe):** Wer bei einem Traktandum im Ausstand ist oder nur über einen Vertreter im Ausstand vertreten');
		expect(text).toContain('- **Wahl «Zählt nicht mit»:** Votum prüft vor jeder Abstimmung, ob die Versammlung auch ohne die Personen im Ausstand');
		expect(text).toContain('- **Warum die Vorgabe:** Der SVIT-Kommentar sagt, ein Interessenkonflikt ändere an der Beschlussfähigkeit nichts');
		expect(text).toContain('- **Geltung:** Die Einstellung wirkt an ersten und zweiten Versammlungen');

		// Je Wahl im eigenen Abschnitt, bis zur nächsten Überschrift zweiter
		// Stufe (Featureprüfung F4c, 06.11.2026: über den ganzen Text gesucht,
		// fand der Test die Abschnitte der einen Wahl unter der anderen).
		for (const [abschnitt, wahl] of [
			[2, 'Zählt mit (Vorgabe)'],
			[3, 'Zählt nicht mit']
		] as const) {
			const kopf = `## ${abschnitt}. Wahl «${wahl}»`;
			expect(text).toContain(kopf);
			const teil = text.split(kopf)[1].split('\n## ')[0];
			for (const lage of [
				'Die Beschlussfähigkeit hängt an den Personen im Ausstand',
				'Genug weitere Eigentümer sind da oder vertreten'
			]) {
				expect(teil, `${wahl}: ${lage}`).toContain(`### Lage: ${lage}`);
			}
		}

		// Unter der Vorgabe stehen die Sätze an die Leitung und ins Protokoll
		// genau in den Lagen, in denen die Beschlussfähigkeit ohne die
		// Personen im Ausstand fehlt; im Gegenfall keiner.
		const vorgabe = text.split('## 2. Wahl «Zählt mit (Vorgabe)»')[1].split('\n## ')[0];
		const haengt = vorgabe.split('### Lage: Die Beschlussfähigkeit hängt an den Personen im Ausstand')[1].split('\n### ')[0];
		expect(haengt).toContain('- **Ohne die Personen im Ausstand:** nicht beschlussfähig');
		expect(haengt).toContain(
			'- **Satz an die Leitung vor dem Eröffnen:** Ohne die Personen im Ausstand wäre die Versammlung bei diesem Traktandum nicht beschlussfähig. Votum zählt sie nach der Einstellung Ihrer Gemeinschaft mit (SVIT-Kommentar Rz. 17 ad Art. 712p). Nach einer anderen Lehrmeinung zählen sie nicht, und der Beschluss wäre angreifbar. Sicher ist er, wenn so viele weitere Eigentümer da oder vertreten sind, dass die Versammlung auch ohne die Personen im Ausstand beschlussfähig ist.'
		);
		expect(haengt).toContain(
			'- **Zeile im Protokoll am Beschluss:** Ohne die Personen im Ausstand wäre die Versammlung bei diesem Beschluss nicht beschlussfähig gewesen; nach der Einstellung der Gemeinschaft zählten sie mit.'
		);
		const vertreten = vorgabe.split('### Lage: Die Partei ist nur über einen Vertreter im Ausstand vertreten')[1].split('\n### ')[0];
		expect(vertreten).toContain('- **Ohne die Personen im Ausstand:** nicht beschlussfähig');
		expect(vertreten).toContain('- **Satz an die Leitung vor dem Eröffnen:** Ohne die Personen im Ausstand');
		const genug = vorgabe.split('### Lage: Genug weitere Eigentümer sind da oder vertreten')[1].split('\n### ')[0];
		expect(genug).toContain('- **Ohne die Personen im Ausstand:** beschlussfähig');
		expect(genug).toContain('- **Satz an die Leitung vor dem Eröffnen:** keiner;');
		expect(genug).toContain('- **Zeile im Protokoll am Beschluss:** keine.');
		// Gegenprüfung Lauf 1: Ohne Ausstand, oder wo schon mit ihm die
		// Beschlussfähigkeit fehlt, steht keiner der beiden Sätze.
		for (const lage of [
			'Niemand ist im Ausstand, und die Beschlussfähigkeit fehlt',
			'Die Beschlussfähigkeit fehlt schon mit den Personen im Ausstand'
		]) {
			const teil = vorgabe.split(`### Lage: ${lage}`)[1].split('\n### ')[0];
			expect(teil, lage).toContain('- **Satz an die Leitung vor dem Eröffnen:** keiner;');
			expect(teil, lage).toContain('- **Zeile im Protokoll am Beschluss:** keine.');
		}
		expect(text).toContain('- **Geltung von L5:** ');
		expect(text).toContain('Ob mitzählt, wer im Ausstand ist, regelt die Einstellung zum Ausstand und zur Beschlussfähigkeit.');

		// Unter «Zählt nicht mit» steht die Absage in genau der Lage, in der
		// die Beschlussfähigkeit ohne die Personen im Ausstand fehlt; im
		// Gegenfall öffnet der Durchgang.
		const sperrt = text.split('## 3. Wahl «Zählt nicht mit»')[1].split('\n## ')[0];
		const gesperrt = sperrt.split('### Lage: Die Beschlussfähigkeit hängt an den Personen im Ausstand')[1].split('\n### ')[0];
		expect(gesperrt).toContain('- **Ohne die Personen im Ausstand:** nicht beschlussfähig');
		expect(gesperrt).toContain(
			'(im Haus und am gemeinsamen Abend gleich): Ohne die Personen im Ausstand ist die Versammlung bei diesem Traktandum nicht beschlussfähig. Nach der Einstellung Ihrer Gemeinschaft zählen sie dafür nicht mit; verbindlich abgestimmt wird deshalb nicht. Ist jemand im Saal, der nicht als anwesend erfasst ist, oder steht jemand irrtümlich im Ausstand, berichtigen Sie das. Sonst setzen Sie das Traktandum auf die Liste einer späteren Versammlung; besprechen darf die Versammlung es trotzdem.'
		);
		expect(gesperrt).toContain('- **Unverbindlich abstimmen:** nicht angeboten');
		expect(gesperrt).toContain('- **Beschluss von Hand, Warnung vor dem Festhalten:** Ohne die Personen im Ausstand ist');
		expect(gesperrt).toContain('- **Beschluss von Hand, Quittung danach:** Ohne die Personen im Ausstand war');
		expect(gesperrt).toContain(
			'- **Zeile im Protokoll, Beschluss von Hand angenommen:** Ohne die Personen im Ausstand war die Versammlung bei diesem Beschluss nicht beschlussfähig; nach der Einstellung der Gemeinschaft zählten sie dafür nicht mit. Der Beschluss gilt, bis ein Gericht ihn aufhebt.'
		);
		expect(gesperrt).toContain('- **Zeile im Protokoll, Beschluss von Hand abgelehnt:** Ohne die Personen im Ausstand war');
		const ohneAusstand = sperrt.split('### Lage: Niemand ist im Ausstand, und die Beschlussfähigkeit fehlt')[1].split('\n### ')[0];
		expect(ohneAusstand).toContain('- **Absage beim Eröffnen:** die gewöhnliche zur fehlenden Beschlussfähigkeit');
		const offen = sperrt.split('### Lage: Genug weitere Eigentümer sind da oder vertreten')[1].split('\n### ')[0];
		expect(offen).toContain('- **Ohne die Personen im Ausstand:** beschlussfähig');
		expect(offen).toContain('- **Absage beim Eröffnen:** keine; der Durchgang öffnet.');

		// ── L8 (Lauf 3) ────────────────────────────────────────────────────

		// Der Katalog zu L8, wie die Einstellungsseite ihn zeigt.
		expect(text).toContain('## 4. Katalog zu L8: Seite «Lesarten»');
		expect(text).toContain(
			'- **Frage:** Ruhen die Vollmachten der Verwaltung, wenn über ihre Entschädigung, einen Vertrag mit ihr oder ihre Entlastung abgestimmt wird?'
		);
		expect(text).toContain(
			'- **Wahl «Vollmachten ruhen» (Vorgabe):** An einem Traktandum, das als Entschädigung, Vertrag oder Entlastung der Verwaltung'
		);
		expect(text).toContain(
			'- **Wahl «Die Sitzungsleitung entscheidet»:** Votum lässt die Vollmachten der Verwaltung nur ruhen, wenn die Sitzungsleitung bei diesem'
		);
		expect(text).toContain(
			'- **Warum die Vorgabe:** Wer bei einem Geschäft nicht selbst stimmen darf, darf es nach dem Bundesgericht auch nicht als'
		);
		expect(text).toContain(
			'- **Geltung:** Die Einstellung wirkt nur an Traktanden, die als Entschädigung, Vertrag oder Entlastung der'
		);

		// Je Wahl im eigenen Abschnitt, bis zur nächsten Überschrift zweiter
		// Stufe, mit allen sieben Lagen.
		for (const [abschnitt, wahl] of [
			[5, 'Vollmachten ruhen (Vorgabe)'],
			[6, 'Die Sitzungsleitung entscheidet']
		] as const) {
			const kopf = `## ${abschnitt}. Wahl «${wahl}»`;
			expect(text).toContain(kopf);
			const teil = text.split(kopf)[1].split('\n## ')[0];
			for (const lage of [
				'Das Traktandum ist gekennzeichnet, und die Verwaltung hält eine Vollmacht',
				'Das Traktandum ist gekennzeichnet, und beide Grenzen tragen das Ergebnis',
				'Die vertretene Partei ist selbst da',
				'Das Traktandum ist gekennzeichnet, die Verwaltung hält keine Vollmacht',
				'Das Traktandum ist nicht gekennzeichnet, die Verwaltung hält eine Vollmacht',
				'Die Sitzungsleitung hat den Ausstand der Verwaltung erklärt',
				'Wiederwahl nach der Freigabe'
			]) {
				expect(teil, `${wahl}: ${lage}`).toContain(`### Lage: ${lage}`);
			}
		}

		// Unter der Vorgabe gibt die Verwaltung keine Stimme ab (die
		// Stimmsperre nimmt sie nicht an, G3); der Satz an die Leitung und der
		// in der Einladung stehen, das zweite Ergebnis nennt die Grenzen
		// (Entscheid 2), und das Protokoll trägt nur die Tatsachenzeile
		// (Entscheid 3).
		const ruhen = text.split('## 5. Wahl «Vollmachten ruhen (Vorgabe)»')[1].split('\n## ')[0];
		const geschaeft = ruhen
			.split('### Lage: Das Traktandum ist gekennzeichnet, und die Verwaltung hält eine Vollmacht')[1]
			.split('\n### ')[0];
		expect(geschaeft).toContain(
			'- **Die Stimme, die die Verwaltung für Hans Probe abgibt:** gibt keine ab; die Stimmsperre nimmt sie nicht an, weil die Vollmacht nach der Einstellung der Gemeinschaft ruht.'
		);
		expect(geschaeft).toContain('- **Ergebnis:** Abgelehnt');
		expect(geschaeft).toContain(
			'- **Satz an die Leitung vor dem Eröffnen:** Bei diesem Traktandum ruhen die Vollmachten der Verwaltung nach der Einstellung Ihrer Gemeinschaft. Die Stimmen, die die Verwaltung mit Vollmachten abgibt, zählen nicht; die Vertretenen stimmen nur, wenn sie selbst da sind oder eine andere Person bevollmächtigt haben. Fragen Sie vor der Abstimmung, ob jemand diese Zählung beanstandet. Sagen Sie dazu: Wer anwesend ist und nichts sagt, kann das Recht verlieren, den Beschluss deswegen anzufechten. Halten Sie eine Beanstandung mit «Rüge festhalten» fest; sagt niemand etwas, vermerken Sie das im Feld «Voten, Begründungen, Ordnungsentscheide». Beanstandet jemand, dass die Vollmachten ruhen, halten Sie das fest. Gehört eine Vollmacht in Wahrheit nicht der Verwaltung, entfernen Sie das Häkchen unter Vollmachten, bevor Sie eröffnen. Sonst können Sie trotzdem abstimmen; die Einstellung Ihrer Gemeinschaft gilt.'
		);
		expect(geschaeft).toContain(
			'- **Satz in der Einladung:** Bei diesem Traktandum zählen keine Stimmen, die die Verwaltung mit einer Vollmacht abgibt, auch nicht solche mit Weisung. Haben Sie der Verwaltung eine Vollmacht gegeben und wollen hier mitstimmen, kommen Sie selbst oder bevollmächtigen eine andere Person, die nicht für die Verwaltung arbeitet. Bevollmächtigen Sie eine andere Person, sagen Sie der Verwaltung, dass ihre Vollmacht für diese Versammlung nicht mehr gilt. Diese Person stimmt dann bei allen Traktanden dieser Versammlung für Sie.'
		);
		expect(geschaeft).toContain(
			'- **Zweites Ergebnis, an die Leitung:** Nach der anderen Lesart («Die Sitzungsleitung entscheidet») hätte die ruhende Vollmacht der Verwaltung gezählt. Je nachdem, wie die Verwaltung damit gestimmt hätte, hätte das Ergebnis anders ausfallen können; erfasst ist das nicht, weil Votum diese Stimmen nicht annimmt. Die Ablehnung gilt wie gezählt. Wer nicht Nein gestimmt hat, auch eine Partei, die nur über die ruhende Vollmacht vertreten war, und meint, diese Stimmen hätten zählen müssen, kann die Ablehnung beim Gericht anfechten, innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). Das Gericht hebt sie dann in der Regel nur auf; angenommen ist der Antrag damit nicht. Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung beanstandet haben. Für die Vertretenen, deren Vollmacht ruhte, läuft die Frist womöglich schon ab heute; stellen Sie ihnen das Protokoll rasch zu.'
		);
		expect(geschaeft).toContain(
			'- **Zweites Ergebnis, Zeile im Protokoll:** keine; unter der Vorgabe trägt das Protokoll kein zweites Ergebnis (Entscheid 3, 06.11.2026).'
		);
		expect(geschaeft).toContain(
			'- **Zeilen im Protokoll zu den ruhenden Vollmachten:** Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung. Für eine vertretene Partei (Hans Probe) zählte deshalb keine Stimme.'
		);
		// M-2 und M-4 (Lauf 4): B3 besteht an Traktanden mit Ausstand aus L8
		// weiter und liefert hier dasselbe Ergebnis; die Auswertung schweigt,
		// weil kein Satz davon abweicht.
		expect(geschaeft).toContain(
			'- **B3, Satz an die Leitung:** Zählen die Parteien, deren einziger Vertreter im Ausstand ist, ohne Stimme mit, wie ungültige Stimmen (SVIT-Kommentar Rz. 181 ad Art. 712m), wirken sie wie ein Nein. Das Ergebnis wäre dasselbe.'
		);
		expect(geschaeft).toContain('- **B3, Zeile im Protokoll:** keine; das Ergebnis wäre dasselbe.');
		expect(geschaeft).toContain('- **Zeile in der Auswertung:** keine.');
		// M-5 (Lauf 5): die Hinweise der Auszählung, hier der eigene Satz zur
		// ruhenden Vertretung aus L8.
		expect(geschaeft).toContain(
			'- **Hinweise der Auszählung:** «Hans Probe» war nur über Grosse Verwaltung AG vertreten; nach der Einstellung Ihrer Gemeinschaft ruhen die Vollmachten der Verwaltung bei diesem Traktandum. Diese Partei kann hier keine Stimme abgeben; bei den übrigen Traktanden gilt sie wieder, ausser wo die Vollmachten der Verwaltung ebenfalls ruhen.'
		);
		// Trägt keine Grenze das Ergebnis, heisst es «dasselbe».
		const grenzen = ruhen
			.split('### Lage: Das Traktandum ist gekennzeichnet, und beide Grenzen tragen das Ergebnis')[1]
			.split('\n### ')[0];
		expect(grenzen).toContain('- **Ergebnis:** Angenommen');
		expect(grenzen).toContain(
			'- **Zweites Ergebnis, an die Leitung:** Nach der anderen Lesart («Die Sitzungsleitung entscheidet») hätte die ruhende Vollmacht der Verwaltung gezählt. Das Ergebnis wäre dasselbe, gleich wie die Verwaltung damit gestimmt hätte.'
		);
		// Ist die Partei selbst da, ruht nichts: kein Satz, kein zweites
		// Ergebnis, keine Protokollzeile (M2).
		const selbstDa = ruhen.split('### Lage: Die vertretene Partei ist selbst da')[1].split('\n### ')[0];
		expect(selbstDa).toContain(
			'- **Die Stimme, die die Verwaltung für Hans Probe abgibt:** gibt keine ab; Hans Probe ist selbst da und stimmt selbst.'
		);
		expect(selbstDa).toContain('- **Satz an die Leitung vor dem Eröffnen:** keiner;');
		expect(selbstDa).toContain('- **Zweites Ergebnis:** keins;');
		expect(selbstDa).toContain('- **Zeilen im Protokoll zu den ruhenden Vollmachten:** keine.');
		// Ohne wirksame Vertretung entsteht kein Hinweis (M2, M-5).
		expect(selbstDa).toContain('- **Hinweise der Auszählung:** keine.');
		// Ohne Häkchen am Traktandum zählt die Stimme, und keiner der Sätze
		// steht; ohne Vollmacht gibt es keine und kein zweites Ergebnis.
		const ohneHaekchen = ruhen
			.split('### Lage: Das Traktandum ist nicht gekennzeichnet, die Verwaltung hält eine Vollmacht')[1]
			.split('\n### ')[0];
		expect(ohneHaekchen).toContain(
			'- **Die Stimme, die die Verwaltung für Hans Probe abgibt:** zählt; das Traktandum ist nicht als Geschäft der Verwaltung gekennzeichnet.'
		);
		expect(ohneHaekchen).toContain('- **Ergebnis:** Angenommen:');
		expect(ohneHaekchen).toContain('- **Satz an die Leitung vor dem Eröffnen:** keiner; das Traktandum trägt kein Häkchen.');
		expect(ohneHaekchen).toContain('- **Satz in der Einladung:** keiner; das Traktandum trägt kein Häkchen.');
		expect(ohneHaekchen).toContain(
			'- **Zweites Ergebnis:** keins; das Traktandum ist nicht als Geschäft der Verwaltung gekennzeichnet.'
		);
		const ohneVollmacht = ruhen
			.split('### Lage: Das Traktandum ist gekennzeichnet, die Verwaltung hält keine Vollmacht')[1]
			.split('\n### ')[0];
		expect(ohneVollmacht).toContain(
			'- **Die Stimme, die die Verwaltung für Hans Probe abgibt:** gibt keine ab; Hans Probe hat niemanden bevollmächtigt.'
		);
		expect(ohneVollmacht).toContain(
			'- **Satz an die Leitung vor dem Eröffnen:** keiner; die Verwaltung hält keine Vollmacht.'
		);
		// Der Einladungssatz steht auch hier: Er wendet sich an die, die der
		// Verwaltung noch eine Vollmacht geben könnten.
		expect(ohneVollmacht).toContain('- **Satz in der Einladung:** Bei diesem Traktandum zählen keine Stimmen');
		expect(ohneVollmacht).toContain(
			'- **Zweites Ergebnis:** keins; die Verwaltung hält keine Vollmacht, für die das Ruhen etwas änderte.'
		);
		// Der erklärte Ausstand wirkt in beiden Wahlen; kein Satz zur
		// Einstellung, kein zweites Ergebnis, und statt der Tatsachenzeile zu
		// L8 die gewöhnliche Zeile zur ruhenden Vollmacht.
		const erklaert = ruhen
			.split('### Lage: Die Sitzungsleitung hat den Ausstand der Verwaltung erklärt')[1]
			.split('\n### ')[0];
		expect(erklaert).toContain(
			'- **Die Stimme, die die Verwaltung für Hans Probe abgibt:** gibt keine ab; die Sitzungsleitung hat den Ausstand der Verwaltung erklärt.'
		);
		expect(erklaert).toContain(
			'- **Satz an die Leitung vor dem Eröffnen:** keiner; die Vollmacht ruht über den erklärten Ausstand, und das Merkmal aus L8 trägt nur, was ohne Erklärung ruht.'
		);
		expect(erklaert).toContain('- **Zweites Ergebnis:** keins; der erklärte Ausstand wirkt nach beiden Wahlen gleich.');
		expect(erklaert).toContain('war nur über Grosse Verwaltung AG vertreten');
		// Beim erklärten Ausstand steht der gewöhnliche Satz zu den ruhenden
		// Vollmachten, nicht der aus L8 (M-5).
		expect(erklaert).toContain(
			'- **Hinweise der Auszählung:** «Hans Probe» war nur über Grosse Verwaltung AG vertreten; wer im Ausstand ist, kann niemanden vertreten (BGE 134 III 481 E. 3.8). Diese Partei konnte hier keine Stimme abgeben; bei den übrigen übt dieselbe Vollmacht wieder aus.'
		);
		// M-2 (Lauf 4): wie bei einem erklärten Ausstand liefert B3 auch hier
		// dasselbe Ergebnis, ohne Zeile im Protokoll.
		expect(erklaert).toContain(
			'- **B3, Satz an die Leitung:** Zählen die Parteien, deren einziger Vertreter im Ausstand ist, ohne Stimme mit, wie ungültige Stimmen (SVIT-Kommentar Rz. 181 ad Art. 712m), wirken sie wie ein Nein. Das Ergebnis wäre dasselbe.'
		);
		expect(erklaert).toContain('- **B3, Zeile im Protokoll:** keine; das Ergebnis wäre dasselbe.');

		// Unter «Die Sitzungsleitung entscheidet» zählt die Stimme ohne
		// erklärten Ausstand; der Satz an die Leitung bittet um den Ausstand,
		// die Einladung trägt den eigenen Satz dieser Wahl (G7, 08.11.2026),
		// und das zweite Ergebnis nennt den Ausgang nach der Vorgabe.
		const leitung = text.split('## 6. Wahl «Die Sitzungsleitung entscheidet»')[1].split('\n## ')[0];
		const geschaeftLeitung = leitung
			.split('### Lage: Das Traktandum ist gekennzeichnet, und die Verwaltung hält eine Vollmacht')[1]
			.split('\n### ')[0];
		expect(geschaeftLeitung).toContain(
			'- **Die Stimme, die die Verwaltung für Hans Probe abgibt:** zählt; die Sitzungsleitung hat den Ausstand der Verwaltung nicht erklärt, und ohne ihn ruhen die Vollmachten nicht.'
		);
		expect(geschaeftLeitung).toContain('- **Ergebnis:** Angenommen:');
		expect(geschaeftLeitung).toContain(
			'- **Satz an die Leitung vor dem Eröffnen:** Bei diesem Traktandum geht es um ein Geschäft der Verwaltung. Nach der Einstellung Ihrer Gemeinschaft entscheiden Sie, ob ihre Vollmachten ruhen; wollen Sie das, erklären Sie den Ausstand der Verwaltung. Leitet die Verwaltung die Versammlung, entscheidet sie so über ihre eigenen Vollmachten. Den Vorsitz für dieses Traktandum übernimmt dann besser eine Eigentümerin oder ein Eigentümer. Fragen Sie vor der Abstimmung, ob jemand diese Zählung beanstandet. Sagen Sie dazu: Wer anwesend ist und nichts sagt, kann das Recht verlieren, den Beschluss deswegen anzufechten. Halten Sie eine Beanstandung mit «Rüge festhalten» fest; sagt niemand etwas, vermerken Sie das im Feld «Voten, Begründungen, Ordnungsentscheide». Beanstandet jemand, dass die Vollmachten zählen, können Sie den Ausstand der Verwaltung jetzt noch erklären.'
		);
		expect(geschaeftLeitung).toContain(
			'- **Satz in der Einladung:** Bei diesem Traktandum entscheidet die Sitzungsleitung, ob Stimmen zählen, die die Verwaltung mit einer Vollmacht abgibt. Das gilt auch für Stimmen, zu denen Sie der Verwaltung eine Weisung gegeben haben. Haben Sie der Verwaltung eine Vollmacht gegeben und wollen sicher sein, dass Ihre Stimme hier zählt? Dann kommen Sie selbst oder bevollmächtigen eine andere Person, die nicht für die Verwaltung arbeitet. Bevollmächtigen Sie eine andere Person, sagen Sie der Verwaltung, dass ihre Vollmacht für diese Versammlung nicht mehr gilt. Diese Person stimmt dann bei allen Traktanden dieser Versammlung für Sie.'
		);
		expect(geschaeftLeitung).toContain(
			'- **Zweites Ergebnis, an die Leitung:** Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist («Die Sitzungsleitung entscheidet»), ist der Antrag angenommen. Nach der anderen Lesart («Vollmachten ruhen»: das Ruhen der Vollmachten der Verwaltung) wäre er abgelehnt'
		);
		expect(geschaeftLeitung).toContain(
			'- **Zweites Ergebnis, Zeile im Protokoll:** Nach der anderen Lesart («Vollmachten ruhen»: das Ruhen der Vollmachten der Verwaltung), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen'
		);
		// M-4 (Lauf 4): dieselbe Zeile drucken Auswertungsseite, Auswertungs-PDF
		// und Stimmnachweis.
		expect(geschaeftLeitung).toContain(
			'- **Zeile in der Auswertung:** Nach der anderen Lesart («Vollmachten ruhen»: das Ruhen der Vollmachten der Verwaltung), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 1 Ja von 2 Kopfstimmen, nötig 2.'
		);
		// Ohne erklärten Ausstand ruht unter «Die Sitzungsleitung entscheidet»
		// nichts; der Hinweis entsteht nicht (M-5).
		expect(geschaeftLeitung).toContain('- **Hinweise der Auszählung:** keine.');
		// Die Lage mit vier Anwesenden rechnet unter beiden Wahlen dasselbe;
		// die Zeile steht deshalb nicht im Protokoll.
		const grenzenLeitung = leitung
			.split('### Lage: Das Traktandum ist gekennzeichnet, und beide Grenzen tragen das Ergebnis')[1]
			.split('\n### ')[0];
		expect(grenzenLeitung).toContain('- **Ergebnis:** Angenommen');
		expect(grenzenLeitung).toContain(
			'- **Zweites Ergebnis, an die Leitung:** Nach der anderen Lesart («Vollmachten ruhen») dasselbe Ergebnis.'
		);
		expect(grenzenLeitung).toContain(
			'- **Zweites Ergebnis, Zeile im Protokoll:** keine; das andere Ergebnis weicht nicht ab.'
		);
		const erklaertLeitung = leitung
			.split('### Lage: Die Sitzungsleitung hat den Ausstand der Verwaltung erklärt')[1]
			.split('\n### ')[0];
		expect(erklaertLeitung).toContain(
			'- **Die Stimme, die die Verwaltung für Hans Probe abgibt:** gibt keine ab; die Sitzungsleitung hat den Ausstand der Verwaltung erklärt.'
		);
		expect(erklaertLeitung).toContain('- **Ergebnis:** Abgelehnt');
		expect(erklaertLeitung).toContain('- **Zweites Ergebnis:** keins; der erklärte Ausstand wirkt nach beiden Wahlen gleich.');

		// Entscheid 8 (Lauf 4): die Lage der Wiederwahl nach der Freigabe, je
		// Wahl der Lesart. Die Stimme der Verwaltung zählt trotz Häkchen, der
		// Satz an die Leitung sagt es, und ein zweites Ergebnis gibt es nicht.
		const wiederwahlRuhen = ruhen
			.split('### Lage: Wiederwahl nach der Freigabe')[1]
			.split('\n### ')[0];
		expect(wiederwahlRuhen).toContain(
			'- **Die Stimme, die die Verwaltung für Hans Probe abgibt:** zählt; das Erfordernis steht auf der Wahl der Verwaltung, und dort ruhen die Vollmachten nicht (Entscheid 8), obwohl das Traktandum das Häkchen trägt.'
		);
		expect(wiederwahlRuhen).toContain('- **Ergebnis:** Angenommen: 2 Ja von 3 Kopfstimmen, nötig 2.');
		expect(wiederwahlRuhen).toContain(
			'- **Satz an die Leitung vor dem Eröffnen:** Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.8). Votum zählt sie hier, obwohl die Einladung bei diesem Traktandum sagt, dass sie nicht zählen; sagen Sie das der Versammlung vor der Abstimmung. Votum prüft nicht, ob die Einladung die Wahl bei diesem Traktandum ankündigt; das prüfen Sie. Eine Erneuerung des Verwaltungsvertrags mit der bisherigen Verwaltung gilt in der Regel als Ankündigung der Wiederwahl. Kündigt sie sie nicht an, stimmen Sie die Wahl nicht ab, sondern setzen sie auf eine spätere Versammlung, und stellen das nötige Mehr wieder auf das vorherige. Lautet der Antrag nur auf die Wahl, stimmen Sie hier darüber ab. Stehen darin auch Entschädigung, Entlastung oder neue Vertragsbedingungen, stimmen Sie die Teile getrennt ab. Nehmen Sie dafür mit «Gegenantrag» einen Folgeantrag mit der Wahl auf, mit dem nötigen Mehr «Bewirtschaftung wählen». Die Erneuerung des Vertrags zu den bisherigen Bedingungen gehört zu ihm. Für die übrigen Teile nehmen Sie je einen eigenen auf; dort ruhen die Vollmachten der Verwaltung. Über diesen Antrag stimmen Sie danach nicht mehr ab. Fragen Sie vor der Abstimmung, ob jemand diese Zählung beanstandet. Sagen Sie dazu: Wer anwesend ist und nichts sagt, kann das Recht verlieren, den Beschluss deswegen anzufechten. Halten Sie eine Beanstandung mit «Rüge festhalten» fest; sagt niemand etwas, vermerken Sie das im Feld «Voten, Begründungen, Ordnungsentscheide». Beanstandet jemand, dass die Vollmachten hier zählen, halten Sie das fest; abstimmen können Sie trotzdem.'
		);
		// Die Einladung hatte das Ruhen angekündigt; ihr Satz steht deshalb auch
		// hier, und die Zeile am Beschluss hebt es ins Protokoll.
		expect(wiederwahlRuhen).toContain('- **Satz in der Einladung:** Bei diesem Traktandum zählen keine Stimmen');
		expect(wiederwahlRuhen).toContain(
			'- **Zeile im Protokoll am Beschluss:** Bei diesem Traktandum ging es um die Wahl der Verwaltung; anders als die Einladung angekündigt hatte, ruhten ihre Vollmachten hier nicht.'
		);
		expect(wiederwahlRuhen).toContain(
			'- **Zweites Ergebnis:** keins; das Erfordernis steht auf der Wahl der Verwaltung, und dort ruhen die Vollmachten nicht (Entscheid 8).'
		);
		const wiederwahlLeitung = leitung
			.split('### Lage: Wiederwahl nach der Freigabe')[1]
			.split('\n### ')[0];
		expect(wiederwahlLeitung).toContain(
			'- **Satz an die Leitung vor dem Eröffnen:** Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.8). Votum prüft nicht, ob die Einladung die Wahl bei diesem Traktandum ankündigt; das prüfen Sie. Eine Erneuerung des Verwaltungsvertrags mit der bisherigen Verwaltung gilt in der Regel als Ankündigung der Wiederwahl. Kündigt sie sie nicht an, stimmen Sie die Wahl nicht ab, sondern setzen sie auf eine spätere Versammlung, und stellen das nötige Mehr wieder auf das vorherige. Lautet der Antrag nur auf die Wahl, stimmen Sie hier darüber ab. Stehen darin auch Entschädigung, Entlastung oder neue Vertragsbedingungen, stimmen Sie die Teile getrennt ab. Nehmen Sie dafür mit «Gegenantrag» einen Folgeantrag mit der Wahl auf, mit dem nötigen Mehr «Bewirtschaftung wählen». Die Erneuerung des Vertrags zu den bisherigen Bedingungen gehört zu ihm. Für die übrigen Teile nehmen Sie je einen eigenen auf; dort entscheiden Sie dann selbst, ob die Vollmachten der Verwaltung ruhen. Über diesen Antrag stimmen Sie danach nicht mehr ab.'
		);
		expect(wiederwahlLeitung).toContain(
			'- **Zeile im Protokoll am Beschluss:** keine; sie steht nur unter der Vorgabe «Vollmachten ruhen».'
		);

		// Die Handzählung unter «Die Sitzungsleitung entscheidet» (H1): Das
		// zweite Ergebnis lässt sich aus den Summen nicht bestimmen, und der
		// Durchgang schliesst; an die Leitung kommt der Zusatz, dass der
		// Beschluss trotzdem gilt (N-4, Lauf 4).
		const summen = leitung.split('### Lage: Handzählung mit Summen\n')[1].split('\n### ')[0];
		expect(summen).toContain('- **Ergebnis:** Angenommen');
		expect(summen).toContain(
			'- **Zweites Ergebnis, an die Leitung:** Nach der anderen Lesart («Vollmachten ruhen»: das Ruhen der Vollmachten der Verwaltung) lässt sich das Ergebnis nicht bestimmen: Gezählt wurden nur die Summen, und darin ist nicht getrennt, wie die Verwaltung mit ihren Vollmachten gestimmt hat. Der Beschluss gilt wie gezählt. Wer ihm nicht zugestimmt hat und meint, diese Stimmen hätten ruhen müssen, kann ihn beim Gericht anfechten, innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung beanstandet haben.'
		);
		expect(summen).toContain(
			'- **Zweites Ergebnis, Zeile im Protokoll:** Nach der anderen Lesart («Vollmachten ruhen») lässt sich das Ergebnis nicht bestimmen: Gezählt wurden nur die Summen, und darin ist nicht getrennt, wie die Verwaltung mit ihren Vollmachten gestimmt hat.'
		);
		expect(summen).toContain(
			'- **Zeile in der Auswertung:** Nach der anderen Lesart («Vollmachten ruhen») lässt sich das Ergebnis nicht bestimmen: Gezählt wurden nur die Summen, und darin ist nicht getrennt, wie die Verwaltung mit ihren Vollmachten gestimmt hat.'
		);
		// N-4 (Lauf 4): In der zweiten Handzählung tragen beide Grenzen das
		// Ergebnis, und der Satz sagt «dasselbe Ergebnis» statt «nicht
		// bestimmbar»; Protokoll und Auswertung schweigen dazu.
		const summenGrenzen = leitung
			.split('### Lage: Handzählung mit Summen, beide Grenzen tragen das Ergebnis')[1]
			.split('\n## ')[0];
		expect(summenGrenzen).toContain('- **Ergebnis:** Abgelehnt');
		expect(summenGrenzen).toContain(
			'- **Zweites Ergebnis, an die Leitung:** Nach der anderen Lesart («Vollmachten ruhen») dasselbe Ergebnis, gleich wie die Verwaltung mit ihren Vollmachten gestimmt hat.'
		);
		expect(summenGrenzen).toContain(
			'- **Zweites Ergebnis, Zeile im Protokoll:** keine; das andere Ergebnis weicht nicht ab.'
		);
		expect(summenGrenzen).toContain('- **Zeile in der Auswertung:** keine.');

		// Die Absagen am Häkchen, an den drei Knoten mit den Titeln aus dem
		// Regelwerk, dazu die beiden Hilfetexte am Häkchen der Vollmacht.
		const absage = text.split('## 7. Die Absagen am Häkchen am Traktandum und die Hilfetexte')[1] ?? '';
		expect(absage).toContain('- «Bewirtschaftung wählen» (`k-bewirtschaftung-waehlen`)');
		expect(absage).toContain(
			'- «Bewirtschaftung wählen, die schon erweiterte Kompetenzen hat» (`k-bewirtschaftung-waehlen-erweitert`)'
		);
		expect(absage).toContain('- «Bewirtschaftung abberufen» (`k-bewirtschaftung-abberufen`)');
		expect(absage).toContain(
			'- **Wortlaut:** Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.5). Geht es auch um ihre Entschädigung, stimmen Sie diese in einem eigenen Traktandum ab und setzen Sie das Häkchen nur dort.'
		);
		expect(absage).toContain(
			'- **Wortlaut:** Bei der Abberufung der Verwaltung ist nicht geklärt, ob ihre Vollmachten ruhen, und das Häkchen gilt dort nicht. Bitten Sie die Vertretenen schon mit der Einladung, selbst zu kommen oder eine andere Person zu bevollmächtigen, und schlagen Sie einen Vorsitz für dieses Traktandum vor. Am Abend erklären Sie den Ausstand der Verwaltung, wenn sie den Raum verlässt; mehr dazu im Handbuch unter «Bei der Abberufung der Verwaltung».'
		);
		expect(absage).toContain(
			'- **Wortlaut:** Dieses Traktandum trägt das Häkchen zur Entschädigung, zu einem Vertrag oder zur Entlastung der Verwaltung, und nach der Freigabe lässt es sich nicht mehr abnehmen. Als Abberufung nimmt Votum es deshalb nicht an. Kündigt die Einladung die Abberufung bei diesem Traktandum klar an, nehmen Sie sie mit «Gegenantrag» als eigenen Folgeantrag auf. Dort stellen Sie das nötige Mehr auf «Bewirtschaftung abberufen» und nehmen eine Kündigung des Vertrags in denselben Wortlaut auf. Sonst stimmen Sie sie unter einem eigenen Traktandum ab. Steht keines auf der Traktandenliste, kann Votum sie an dieser Versammlung nicht abstimmen lassen; setzen Sie sie auf eine spätere, wenn nötig eine ausserordentliche.'
		);
		expect(absage).toContain(
			'- **Wortlaut:** Ankreuzen, wenn die Vollmacht auf die Verwaltung lautet oder auf eine Person, die für sie handelt, etwa die Bewirtschafterin oder die Geschäftsführung. Daran erkennt Votum die Vollmachten der Verwaltung. Ob sie an Traktanden zu ihrer Entschädigung, zu Verträgen mit ihr und zu ihrer Entlastung ruhen, regelt die Einstellung Ihrer Gemeinschaft. Bei Wahl, Wiederwahl und Abberufung ruhen sie deswegen nicht.'
		);
		expect(absage).toContain(
			'- **Wortlaut:** Kreuzen Sie das an, wenn Sie die Verwaltung bevollmächtigen oder eine Person, die für sie arbeitet. Je nach Einstellung Ihrer Gemeinschaft zählen Vollmachten der Verwaltung nicht, wenn über ihre Entschädigung, einen Vertrag mit ihr oder ihre Entlastung abgestimmt wird. Die Sitzungsleitung prüft das Häkchen. Wollen Sie dort sicher mitstimmen, kommen Sie selbst oder bevollmächtigen Sie eine andere Person.'
		);

		// Lauf 5 (M-5): die Absagen beim Zurücknehmen eines Ausstands aus L8
		// und beim Kennzeichnen während einer offenen Abstimmung (H-1).
		const absagen = text.split('## 8. Die Absagen beim Zurücknehmen und beim Kennzeichnen (Lauf 5)')[1] ?? '';
		expect(absagen).toContain(
			'- **Wortlaut:** Diesen Ausstand hat niemand erklärt: Er folgt aus der Einstellung Ihrer Gemeinschaft und lässt sich hier nicht zurücknehmen. Ist das Häkchen an der Vollmacht falsch, entfernen Sie es unter Vollmachten. Ist das Traktandum eine Wahl der Verwaltung, stellen Sie stattdessen das nötige Mehr unter «Nötige Mehrheit ändern» auf «Bewirtschaftung wählen».'
		);
		expect(absagen).toContain(
			'- **Wortlaut:** An einem Traktandum zu einem Geschäft der Verwaltung wird gerade abgestimmt. Solange lässt sich die Kennzeichnung dieser Vollmacht nicht ändern, auch nicht beim Bestätigen oder beim Einlass. Sonst stimmte das Ergebnis nicht mit den abgegebenen Stimmen überein. Ist die Kennzeichnung falsch, brechen Sie die Abstimmung mit «Ohne Ergebnis abbrechen» ab, ändern die Kennzeichnung und geben die Abstimmung neu frei. Kommt nur eine weitere Vollmacht auf denselben Namen dazu, ändern Sie sie, wenn die Abstimmung zu Ende ist. Lassen Sie eine Person, die so eine Vollmacht bringt, erst danach ein; nehmen Sie das Häkchen nicht weg, um sie früher einzulassen.'
		);
		// Entscheid 0045, Punkt 9: Abschnitt 9 mit den Lagen der Folgeanträge,
		// der Sperre am Grundantrag und dem Summen-Rat bei «abgelehnt».
		const p9 = text.split('## 9. Der Ausweg am Abend über Folgeanträge')[1];
		expect(p9).toBeDefined();
		expect(p9).toContain('### Lage: Wahl «Die Sitzungsleitung entscheidet», dasselbe, Ausstand der Verwaltung vorab erklärt');
		expect(p9).toContain('Sagen Sie der Versammlung, dass die Vollmachten der Verwaltung hier zählen.');
		expect(p9).toContain('Über diesen Antrag stimmen Sie deshalb nicht mehr ab: Er enthält dieselbe Wahl.');
		expect(p9).toContain('die Folgeanträge 3.1 «Wiederwahl» und 3.2 «Entschädigung gemäss Offerte» angenommen');
		const summenAbgelehnt = p9.split('eigene Zählung abgelehnt')[1];
		expect(summenAbgelehnt).toContain('kann die Ablehnung beim Gericht anfechten');
	});
});
