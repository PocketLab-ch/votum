/**
 * Prüfdatei «Texte nach 0047» (Nachtragsprüfung): Das Skript läuft als Modul und
 * gibt je Punkt die Sätze aus, wie die Anwendung sie erzeugt. Der Test prüft die
 * Ausgabe ohne Website-Abzug (`ABZUG` nicht gesetzt) und schreibt keine Datei;
 * die Prüfdatei für `quellen/pruefung/` entsteht mit `vite-node`, wie im Kopf
 * des Skripts beschrieben.
 */
import { describe, expect, it, vi } from 'vitest';
import { ANGEHOERIGE_BEIM_SETZEN } from '$lib/domain/entscheidbaum';
import { AUSLEGUNG_EBENFALLS_VERTRETEN, GERECHNET_NACH_EINSTELLUNG } from '$lib/domain/auszaehlung';
import { KLAUSEL_MIT_WENIGER_OFFEN, KLAUSEL_MIT_WENIGER_STIMMEN_OFFEN, KLAUSEL_SICHER } from '$lib/domain/reglement';
import { BELEG_712G, BELEG_REGLEMENT, ENTHALTUNG_SATZ_WEBSITE } from '$lib/rules/quorum-2026-11-15';

describe('Prüfdatei «Texte nach 0047»', () => {
	it('läuft und hat je Punkt einen Abschnitt mit den erzeugten Sätzen', async () => {
		const vorher = process.env.ABZUG;
		delete process.env.ABZUG;
		const protokoll: string[] = [];
		const spy = vi.spyOn(console, 'log').mockImplementation((...z: unknown[]) => {
			protokoll.push(z.map(String).join(' '));
		});
		try {
			await import('../../scripts/pruefdatei-texte-nach-0047.ts');
		} finally {
			spy.mockRestore();
			if (vorher !== undefined) process.env.ABZUG = vorher;
		}
		expect(protokoll).toHaveLength(1);
		const text = protokoll[0];

		expect(text).toContain('# Nachtrag, Votum, Texte nach Entscheid 0047: die erzeugten Sätze');
		expect(text).toContain('Fassung 2026-11-15');
		for (const abschnitt of ['## 1.', '## 2.', '## 3a.', '## 3b.', '## 3c.', '## 4.', '## 5.', '## 6.', '## 7.', '## 8.', '## 9.', '## 10.', '## 11 und 12.', '## 12.']) {
			expect(text, abschnitt).toContain(abschnitt);
		}
		// 1: sechs Lesarten mit dem neuen Satz.
		expect(text.split(GERECHNET_NACH_EINSTELLUNG).length - 1).toBe(6);
		// 2: L8 und L10 ohne Abweichung ohne Zeile.
		expect(text).toContain('- **L10 «Bleiben in der Zahl», gleich:** (keine Zeile)');
		// 3a: zehn Lesarten mit dem Einschub, ohne Klammer in der Klammer (R3-L-1) und an L12 nach dem Katalog (R3-L-2).
		const lesarten = ['L1', 'L2', 'L3', 'L4', 'L6', 'L8', 'L10', 'L11', 'L12', 'L13'];
		for (const k of lesarten) expect(text, k).toMatch(new RegExp(`- \\*\\*${k}:\\*\\* Nach der anderen .*, ${AUSLEGUNG_EBENFALLS_VERTRETEN}, wäre`));
		expect(text).toContain('(«Alle Eigentümer»: mehr als die Hälfte aller Eigentümer, auch der abwesenden, und mehr als die Hälfte aller Wertquoten)');
		expect(text).toContain('(«Alle Anwesenden und Vertretenen»: die Zustimmung aller Anwesenden und Vertretenen)');
		expect(text).not.toContain('alle Stimmen der Anwesenden oder Vertretenen), einer Auslegung');
		expect(text).toContain('(«Nach dem Gesetz»: mehr als die Hälfte der Anwesenden oder Vertretenen und mehr als die Hälfte aller Wertquoten), einer Auslegung');
		expect(text).toContain('(«Klausel anwenden»: die Zustimmung aller nach Ihrem Reglement), einer Auslegung');
		// 5, 8, 10, 11 und 12.
		expect(text).toContain(`> ${ANGEHOERIGE_BEIM_SETZEN}`);
		expect(text.split(BELEG_712G).length - 1).toBe(2);
		expect(text).toContain(`(k-baulich-notwendig, Schluss des Kastens:`);
		expect(text).toContain(KLAUSEL_MIT_WENIGER_STIMMEN_OFFEN);
		expect(text).toContain(`${KLAUSEL_MIT_WENIGER_OFFEN} Votum kann beides nicht prüfen. Die Fundstelle steht deshalb bei jedem Beschluss, der so gezählt wird. ${KLAUSEL_SICHER}`);
		expect(text).toContain(BELEG_REGLEMENT);
		expect(text).not.toContain('537 E. 4.2.3');
		for (const zeile of text.split('\n').filter((z) => z.startsWith('- **Website, 4b'))) {
			expect(zeile).toContain(ENTHALTUNG_SATZ_WEBSITE);
			expect(zeile).not.toMatch(/\bVotum\b/);
		}
		expect(text).toContain('Ohne `ABZUG=<Pfad zum erzeugten Abzug>` nicht gezeigt.');
	});
});
