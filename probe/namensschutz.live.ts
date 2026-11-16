/**
 * Durchgang gegen die echten Modelle — nicht Teil des Prüflaufs.
 *
 * Geprüft wird die ganze Kette mit dem echten Kernmodul: erfasste Namen →
 * maskieren → Modell → Namen zurücksetzen. Zwei Fragen entscheiden:
 * **Rutscht ein echter Name hinaus?** und **kommt der Text heil zurück?**
 */
import { describe, expect, it } from 'vitest';
import { enthuelle, maskiereFelder, schild, type Namenstraeger } from '$lib/domain/namensschutz';

const GEMEINSCHAFT: Namenstraeger[] = [
	{ id: 'p1', name: 'Anna Meier' },
	{ id: 'p2', name: 'Peter Meier' }, // gleichnamig — darf nicht zugeordnet werden
	{ id: 'p3', name: 'Familie Müller-Keller' },
	{ id: 'p4', name: 'Beat Winter' }, // Jahreszeit
	{ id: 'p5', name: 'Erbengemeinschaft Gross' }, // Eigenschaftswort
	{ id: 'p6', name: 'Marc Probère' }, // Akzent
	{ id: 'p7', name: 'Bauherren AG' }, // Rechtsform
	{ id: 'p8', name: 'Jean-Luc Béguelin' }, // Doppelvorname + Akzent
	{ id: 'p9', name: 'Sandra Frei' }, // Eigenschaftswort
	{ id: 'p10', name: 'Urs Neuenschwander' }, // ue-Falle
	{ id: 'p11', name: 'Beat Zimmermann' }, // Berufswort
	{ id: 'p12', name: 'Hans Ott' } // kurz
];

const S = schild(GEMEINSCHAFT);

/** Jede Zeile: eine Schreibweise, wie sie wirklich getippt wird. */
const SCHREIBWEISEN: [string, string, boolean][] = [
	['voller Name', 'Anna Meier beantragt die Sanierung.', true],
	['Nachname allein (gleichnamig)', 'Meier beantragt die Sanierung.', true],
	['Vorname allein', 'Anna hat zugestimmt.', true],
	['zweiter Fall', 'Meiers Antrag wurde angenommen.', true],
	['klein geschrieben', 'meier hat widersprochen.', true],
	['mit Anrede', 'Herr Neuenschwander wünscht Auskunft.', true],
	['Anfangsbuchstabe', 'A. Meier legt die Offerte vor.', true],
	['Umlaut ausgeschrieben', 'Mueller-Keller ist dagegen.', true],
	['halber Doppelname', 'Keller stellt den Gegenantrag.', true],
	['Familie davor', 'Familie Müller-Keller wohnt oben.', true],
	['ohne Akzent getippt', 'Probere unterstützt den Antrag.', true],
	['Doppelvorname', 'Jean-Luc Béguelin enthält sich.', true],
	['Firma mit Rechtsform', 'Die Bauherren AG hat offeriert.', true],
	['Eigenschaftswort als Name', 'Frei und Gross sind sich einig.', true],
	['Berufswort als Name', 'Zimmermann übernimmt den Vorsitz.', true],
	['kurzer Name', 'Ott stimmt zu.', true],
	// Die ehrlichen Grenzfälle: hier darf und soll nichts geschehen.
	['Vertipper (wird übersehen)', 'Meyer hat widersprochen.', false],
	['Liegenschaftsname', 'Der Weg zum Meierhof ist beschädigt.', false],
	['Jahreszeit klein', 'Die Arbeiten erfolgen im winter.', false],
	['ohne Namen erkennbar', 'Der Eigentümer der Attikawohnung widerspricht.', false]
];

const ECHTE_NAMEN =
	/\b(Meier|M[üu]e?ller|Keller|Winter|Gross|Prob[èe]re|Bauherren|B[ée]guelin|Frei|Neuenschwander|Zimmermann|Ott|Anna|Peter|Beat|Marc|Jean-Luc|Sandra|Urs|Hans)\b/gi;

describe('Was hinausgeht — jede Schreibweise einzeln', () => {
	for (const [art, satz, sollErkanntWerden] of SCHREIBWEISEN) {
		it(`${art}: ${satz}`, () => {
			const m = maskiereFelder(S, { text: satz });
			const uebrig = m.felder.text.match(ECHTE_NAMEN) ?? [];
			const bericht = `«${m.felder.text}»`;

			if (sollErkanntWerden) {
				expect(uebrig, `${bericht} — Name durchgerutscht`).toEqual([]);
				expect(m.anzahl).toBeGreaterThan(0);
			}
			// Zurück muss es in jedem Fall wortgleich sein.
			expect(enthuelle(m.rueckweg, m.felder.text)).toBe(satz);
			console.log(`  ${sollErkanntWerden ? '·' : '○'} ${art.padEnd(30)} ${bericht}`);
		});
	}
});
