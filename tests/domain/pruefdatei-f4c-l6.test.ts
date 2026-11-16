/**
 * Prüfdatei zu L6 (F4c, Block 1): Das Skript läuft als Modul und gibt die
 * Sätze in jedem Zusammenhang aus, je Wahl und je Fall. Der Test prüft die
 * Ausgabe und schreibt keine Datei: Für die Laien- und die Fachprüfung
 * (`quellen/pruefung/`) entsteht die Prüfdatei von Hand mit `vite-node`, wie
 * im Kopf des Skripts beschrieben (Auftrag F4c, «Abnahme»). Bis zum Review
 * DeepSeek (05.11.2026, B1) schrieb der Test sie bei jedem Prüflauf nach
 * `_bericht/`, das nicht ignoriert ist, in den eingehängten Baum.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Prüfdatei zu L6', () => {
	it('läuft und hat je Wahl und jeden Fall einen Abschnitt', async () => {
		const protokoll: string[] = [];
		const spy = vi.spyOn(console, 'log').mockImplementation((...z: unknown[]) => {
			protokoll.push(z.map(String).join(' '));
		});
		try {
			await import('../../scripts/pruefdatei-f4c-l6.ts');
		} finally {
			spy.mockRestore();
		}
		expect(protokoll).toHaveLength(1);
		const text = protokoll[0];

		expect(text).toContain('# Prüfdatei: Votum F4c, Block 1 (L6 Reglementsschranke)');
		expect(text).toContain('## 1. Katalog: Seite «Lesarten»');
		expect(text).toContain('- **Frage:** Verlangt Ihr Reglement für seine eigene Änderung die Zustimmung aller');
		expect(text).toContain('- **Wahl «Klausel anwenden» (Vorgabe):** Die Änderung ist nur angenommen, wenn alle Eigentümer zustimmen');
		expect(text).toContain('- **Wahl «Nach dem Gesetz»:** Die Änderung ist angenommen, wenn mehr als die Hälfte der anwesenden und vertretenen');
		expect(text).toContain('- **Warum die Vorgabe:** Der SVIT-Kommentar hält eine solche Klausel für unzulässig');
		expect(text).toContain('- **Geltung:** Die Einstellung wirkt nur bei einer Reglementsänderung');

		// Je Wahl im eigenen Abschnitt, bis zur nächsten Überschrift zweiter Stufe
		// (Featureprüfung F4c, 06.11.2026: über den ganzen Text gesucht, fand der
		// Test die Abschnitte der einen Wahl unter der anderen).
		for (const [abschnitt, wahl] of [
			[2, 'Klausel anwenden (Vorgabe)'],
			[3, 'Nach dem Gesetz']
		] as const) {
			const kopf = `## ${abschnitt}. Wahl «${wahl}»`;
			expect(text).toContain(kopf);
			const teil = text.split(kopf)[1].split('\n## ')[0];
			expect(teil, wahl).toContain('### Ergebniskarte der Herleitung');
			expect(teil, wahl).toContain('### Traktandenseite');
			expect(teil, wahl).toContain('### Leitung vor der Abstimmung');
			expect(teil, wahl).toContain('### Leitung und Protokoll nach der Abstimmung');
			for (const fall of [
				'Alle sechs stimmen zu; der Sechste ist vertreten',
				'Alle Anwesenden stimmen zu; der Sechste ist abwesend',
				'Das qualifizierte Mehr ist erreicht, die Zustimmung aller nicht',
				'Das qualifizierte Mehr ist nicht erreicht'
			]) {
				expect(teil, `${wahl}: ${fall}`).toContain(`#### Fall: ${fall}`);
			}
			// Vor der Karte des Rückkommens, die eine eigene Zeile dieses Namens trägt (Codeprüfung Block A, N3).
			expect(teil.split('### Leitungskarte vor dem Eröffnen: Beschluss und Rückkommen')[0], wahl).toContain(
				'- **Zeile im Protokoll je Beschluss:** Gezählt nach'
			);
		}

		// B2 (Review DeepSeek 05.11.2026): Die Karte am Rückkommen steht je Wahl neben der des Beschlusses.
		const [, klauselTeil, gesetzTeil] = text.split(/## [23]\. Wahl /);
		for (const teil of [klauselTeil, gesetzTeil]) {
			expect(teil).toContain('### Leitungskarte vor dem Eröffnen: Beschluss und Rückkommen');
			expect(teil).toContain('##### Karte des Rückkommens auf den angenommenen Beschluss');
			expect(teil).toContain('### Rückkommen: Leitung und Protokoll nach der Abstimmung');
		}
		const rueckkommenKlausel = klauselTeil.split('##### Karte des Rückkommens auf den angenommenen Beschluss')[2];
		expect(rueckkommenKlausel).toContain('Votum zählt die Köpfe hier nach der Klausel an allen Eigentümern');
		expect(klauselTeil).not.toContain('strengen Lesart');

		// B2-F-6: der zweite Durchgang nach dem angenommenen Rückkommen, je Wahl mit Protokollauszug.
		for (const teil of [klauselTeil, gesetzTeil]) {
			const zweiter = teil.split('### Zweiter Durchgang nach dem angenommenen Rückkommen')[1];
			expect(zweiter).toContain('Die Versammlung ist zurückgekommen (Traktandum 1.1)');
			expect(zweiter.split('#### Zweiter Durchgang, Fall: ')).toHaveLength(5);
			expect(zweiter).toContain('Der Beschluss aus dem 1. Durchgang («angenommen») ist damit ersetzt');
			expect(zweiter).toContain('  > #### 1.1 Rückkommen auf 1 ');
			// Codeprüfung B2-F-6, H1: die Mehrheit in Worten wie im Protokoll, nicht der Fallname.
			expect(zweiter).toContain('  > Erforderliche Mehrheit: ');
			expect(zweiter).toContain('hergeleitet als «Reglement verlangt für seine Änderung selbst Einstimmigkeit»');
			expect(zweiter).not.toContain('Über diesen Antrag wurde nicht abgestimmt.');
		}
		// M2: Der zweite Durchgang rechnet mit der Lesart des Traktandums und nennt das zweite Ergebnis.
		const fallAbwesend = (teil: string) =>
			teil.split('#### Zweiter Durchgang, Fall: Alle Anwesenden stimmen zu; der Sechste ist abwesend')[1].split('\n#### ')[0];
		expect(fallAbwesend(klauselTeil)).toContain('- **Ergebnis nach der eingestellten Wahl:** abgelehnt');
		expect(fallAbwesend(klauselTeil)).toContain('  > - Nach der anderen Lesart («Nach dem Gesetz»: mehr als die Hälfte der Anwesenden oder Vertretenen und mehr als die Hälfte aller Wertquoten), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag angenommen gewesen');
		expect(fallAbwesend(gesetzTeil)).toContain('- **Ergebnis nach der eingestellten Wahl:** angenommen');
		// B2b (Befund zur Prüfdatei B2-F-6): Der Beschluss hatte alle, das Rückkommen nicht; nach der
		// Klausel wäre schon das Rückkommen gescheitert, nicht nur die Sache.
		expect(fallAbwesend(gesetzTeil)).toContain(
			'  > - Nach der anderen Lesart («Klausel anwenden») wäre schon das Rückkommen abgelehnt gewesen, und es gälte der Beschluss aus dem 1. Durchgang (siehe Traktandum 1.1).'
		);
		expect(fallAbwesend(gesetzTeil)).not.toContain('wäre der Antrag abgelehnt gewesen');
		// B2b-F-1: Stimmen im zweiten Durchgang alle zu, bleibt das gewohnte zweite Ergebnis.
		const zweiterGesetz = gesetzTeil.split('### Zweiter Durchgang nach dem angenommenen Rückkommen')[1];
		const fallAlle = zweiterGesetz.split('#### Zweiter Durchgang, Fall: Alle sechs stimmen zu; der Sechste ist vertreten')[1].split('\n#### ')[0];
		expect(fallAlle).toContain('- **Leitung, andere Lesart:** Nach der anderen Lesart («Klausel anwenden») dasselbe Ergebnis.');
		expect(fallAlle).not.toContain('schon das Rückkommen');
		// B2b: Unter «Nach dem Gesetz» die Karte des Rückkommens für beide Ausgänge des Beschlusses.
		expect(gesetzTeil).toContain('Ein Ergebnis nach «Klausel anwenden» nennt Votum hier nicht: Nach ihr wäre schon der Beschluss abgelehnt gewesen.');
		expect(gesetzTeil).toContain('Seine Aufhebung mit diesem Mehr besteht nur nach «Nach dem Gesetz»');
		expect(gesetzTeil).toContain('kann man den neuen Beschluss beim Gericht anfechten');
		expect(klauselTeil).toContain('Beides besteht nach beiden Lesarten.');
		expect(klauselTeil).toContain('Das Rückkommen hat das qualifizierte Mehr erreicht, nicht aber die Zustimmung aller.');
		expect(klauselTeil).toContain('an eine spätere Versammlung geht das Rückkommen nicht mit');
		expect(klauselTeil).toContain('Hebt das Gericht die Ablehnung auf, gilt nach dem Wortlaut des Rückkommens wieder der frühere Beschluss');
		expect(text).toContain('- **Zeile im Protokoll je Beschluss:** Gezählt wie beim Beschluss nach');
		expect(text).not.toContain('(Regel dieser Anwendung).)');

		// Der neue Satz des Freigabevermerks, und jede Zeile am Ausgang nur einmal je Fall.
		expect(text).toContain('## Freigabevermerk der Fassung (neuer Satz)');
		expect(text).toContain('nach der Lesart der Gemeinschaft.');
		expect(text).toContain('- **Hilfe:** Einige Bestimmungen haben unter dieser Frage eine eigene Antwort');
		// R2-G-3: Der Satz zur Verkündung ohne Vorbehalt steht nur im Abschnitt «Nach dem Gesetz».
		const [klausel, gesetz] = text.split('## 3. Wahl «Nach dem Gesetz»');
		expect(gesetz).toContain('verkünden Sie ihn nach der Einstellung Ihrer Gemeinschaft ohne Vorbehalt als angenommen');
		expect(klausel).not.toContain('ohne Vorbehalt als angenommen');
		// Je Fall bis zum nächsten Abschnitt: Danach folgt die Karte des Rückkommens (B2).
		for (const fall of text.split('#### Fall: ').slice(1).map((f) => f.split('\n### ')[0])) {
			const zeilen = fall.split('\n').filter((z) => z.startsWith('- **Protokoll am Ausgang:**'));
			expect(new Set(zeilen).size, fall.slice(0, 60)).toBe(zeilen.length);
		}

		// Die zwei geänderten Sätze der Karte stehen je Wahl da, die alten nicht.
		expect(text).toContain('ist er nach der Klausel abgelehnt und nach dem gesetzlichen Mehr angenommen; verkündet wird nach der Einstellung Ihrer Gemeinschaft.');
		expect(text).toContain('Wird er als angenommen festgehalten, ist er anfechtbar, falls die Klausel gilt.');
		expect(text).not.toContain('halten Sie ihn nach der strengen Lesart als abgelehnt fest');
		expect(text).not.toContain('Wird der Beschluss trotzdem als angenommen festgehalten');

		// Codeprüfung 11: Der alte Satz ist mit dem Erfordernis von 2026-11-04 gerechnet, nicht ein Schweigen.
		const vergleich = text.split('## Traktandenseite bis zur Fassung 2026-11-04')[1].split('\n## ')[0];
		expect(vergleich).toContain('- **Satz zur Gegenmeinung:** ');
		expect(vergleich).not.toContain('(kein Satz)');

		// Entscheid 0042: Die Sätze der Reglementsseite stehen so auf der Seite (Zeilenumbrüche ausgeglichen).
		const { REGLEMENTSSEITE } = await import('../../scripts/pruefdatei-f4c-l6.ts');
		const seite = readFileSync('src/routes/gemeinschaften/[id=kennung]/reglement/+page.svelte', 'utf8')
			.replace(/\s+/g, ' ');
		for (const [, saetze] of REGLEMENTSSEITE) {
			for (const satz of saetze.replace(' (Fundstelle). ', '. ').split(/(?<=\.) /)) {
				if (satz.startsWith('Dieses Reglement')) continue; // vor der Fundstelle bricht ein {#if} den Satz
				expect(seite, satz).toContain(satz);
			}
		}
		expect(text).toContain('## Reglementsseite: Kasten «Änderung des Reglements»');
	});
});
