/**
 * Das Aufheben einer Weisungsregel (Nachtrag aus dem Sicherheitsdurchgang vom
 * 09.10.2026, Befund V6).
 *
 * Das Speichern war gemessen (`tests/db/weisungskette.test.ts`), das Aufheben
 * nicht — obwohl es die stärkere Schreibhandlung auf dieser Fläche ist: Sie
 * stellt die Mehrheitserfordernisse einer ganzen Gemeinschaft auf die
 * gesetzliche Vorgabe zurück und ändert damit den Ausgang jeder künftigen
 * Abstimmung. Geprüft wird beides, was der Aktion zusage:
 *
 *   1. Die Wirkung — die Regel ist danach weg, nicht heimlich stehen
 *      geblieben und auch nicht sperrig geworden.
 *   2. Der Verlauf — der Eingriff ist belegbar, denn im Streitfall ist die
 *      Frage «wann galt wieder die Vorgabe?» so entscheidend wie das
 *      Mehr selbst.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { loescheWeisungsregel, speichereWeisungsregel } from '$lib/server/reglement';
import type { WeisungsregelEingabe } from '$lib/domain/weisungsregel';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Weisungsregel aufheben');
	benutzer = await pruefbenutzer(betreiber, 'leitung');
});

afterAll(verbindungenSchliessen);

describe('loescheWeisungsregel', () => {
	it('nimmt eine gespeicherte Regel weg und vermerkt den Eingriff im Verlauf', async () => {
		const g = await erstelleGemeinschaft(handelnder(), {
			name: 'Aufhebehaus',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const eingabe: WeisungsregelEingabe = {
			stwegId: g.id,
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Art. 7 Ziff. 5',
			enthaltungZaehltMit: false,
			ohneBeschluss: 'nein'
		};
		await speichereWeisungsregel(handelnder(), eingabe);

		const regel = await imKontext(betreiber, (tx) => tx<{ n: number }[]>`
			SELECT count(*)::int AS n FROM bylaw_instruction_rule WHERE stweg_id = ${g.id}
		`);
		expect(regel[0].n).toBe(1);

		const verlaufVorher = await imKontext(betreiber, (tx) => tx<{ n: number }[]>`
			SELECT count(*)::int AS n FROM audit_entry WHERE subject_id = ${g.id}
		`);

		await loescheWeisungsregel(handelnder(), g.id);

		const weg = await imKontext(betreiber, (tx) => tx<{ n: number }[]>`
			SELECT count(*)::int AS n FROM bylaw_instruction_rule WHERE stweg_id = ${g.id}
		`);
		expect(weg[0].n).toBe(0);

		// Der Verlauf ist nur anfügbar; der Beleg des Eingriffs muss deshalb
		// mit dem Aufheben entstehen, nicht irgendwann danach.
		const verlaufNachher = await imKontext(betreiber, (tx) => tx<{ n: number }[]>`
			SELECT count(*)::int AS n FROM audit_entry WHERE subject_id = ${g.id}
		`);
		expect(verlaufNachher[0].n).toBeGreaterThan(verlaufVorher[0].n);
	});

	it('lässt das Aufheben ohne Regel still geschehen', async () => {
		// Keine Regel, kein Eingriff: Der Weg muss auch dann durchgehen, wenn
		// nichts daliegt — sonst bliebe eine Stelle, an der die Oberfläche
		// mehr weiss als der Bestand.
		const g = await erstelleGemeinschaft(handelnder(), {
			name: 'Aufhebehaus ohne Regel',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		await expect(loescheWeisungsregel(handelnder(), g.id)).resolves.toBeUndefined();
	});
});
