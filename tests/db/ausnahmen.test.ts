/**
 * Die Ausnahmen bei nicht angekündigten Geschäften an der Gemeinschaft
 * (Migration 126). Gemessen wird, dass die Angabe hält, auch gegen den zweiten
 * Schreiber, und dass die Datenbank (a) ohne Fundstelle selbst abweist.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	bearbeiteGemeinschaft,
	erstelleGemeinschaft,
	holeGemeinschaft
} from '$lib/server/gemeinschaften';
import { speichereAusnahmen } from '$lib/server/ausnahmen';
import { FachlicherFehler } from '$lib/domain/fehler';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Ausnahmen Nichtangekündigtes');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

/** Eine vollständige Eingabe; jede Probe setzt nur ihre Abweichung darauf. */
const LEER = {
	reglementGestattet: false,
	reglementFundstelle: null,
	universalvariante: 'persoenlich',
	universalFundstelle: null,
	leitungsvollmachtenZaehlen: false
};

async function gemeinschaft(name: string) {
	return erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
}

describe('Ausnahmen bei nicht angekündigten Geschäften', () => {
	it('sind bei einer neuen Gemeinschaft streng', async () => {
		const g = await gemeinschaft('Ausnahmen neu');
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.ausnahmen).toEqual({
			reglementGestattet: false,
			reglementFundstelle: null,
			universalvariante: 'persoenlich',
			universalFundstelle: null,
			leitungsvollmachtenZaehlen: false
		});
	});

	it('werden gespeichert und wieder gelesen', async () => {
		const g = await gemeinschaft('Ausnahmen gesetzt');
		await speichereAusnahmen(handelnder(betreiber), g.id, {
			...LEER,
			reglementGestattet: true,
			reglementFundstelle: 'Art. 21 Abs. 3 Reglement',
			universalvariante: 'vertreten',
			universalFundstelle: 'Art. 18 Reglement',
			leitungsvollmachtenZaehlen: true
		});
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.ausnahmen).toEqual({
			reglementGestattet: true,
			reglementFundstelle: 'Art. 21 Abs. 3 Reglement',
			universalvariante: 'vertreten',
			universalFundstelle: 'Art. 18 Reglement',
			leitungsvollmachtenZaehlen: true
		});
	});

	it('weisen (a) ohne Fundstelle ab, im Kern und in der Datenbank', async () => {
		const g = await gemeinschaft('Ausnahmen ohne Beleg');
		await expect(
			speichereAusnahmen(handelnder(betreiber), g.id, {
			...LEER,
				reglementGestattet: true,
				reglementFundstelle: ' ',
				universalvariante: 'persoenlich'
			})
		).rejects.toThrow(FachlicherFehler);

		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE stweg SET unannounced_bylaw_allowed = true, unannounced_bylaw_source = NULL
				WHERE id = ${g.id}
			`)
		).rejects.toThrow(/stweg_nichtangekuendigtes_fundstelle/);
	});

	it('weisen eine unbekannte Variante in der Datenbank ab', async () => {
		const g = await gemeinschaft('Ausnahmen falsche Variante');
		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE stweg SET universal_meeting_mode = 'alle' WHERE id = ${g.id}
			`)
		).rejects.toThrow(/stweg_universalversammlung_variante/);
	});

	it('überleben ein Speichern der Angaben, das sie gar nicht kennt', async () => {
		const g = await gemeinschaft('Ausnahmen neben Angaben');
		await speichereAusnahmen(handelnder(betreiber), g.id, {
			...LEER,
			reglementGestattet: true,
			reglementFundstelle: 'Art. 21 Reglement',
			universalvariante: 'keine'
		});

		await bearbeiteGemeinschaft(handelnder(betreiber), g.id, {
			...LEER,
			name: 'Ausnahmen neben Angaben',
			strasse: 'Probegasse 9',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});

		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.strasse).toBe('Probegasse 9');
		expect(gelesen?.ausnahmen?.reglementGestattet).toBe(true);
		expect(gelesen?.ausnahmen?.universalvariante).toBe('keine');
	});

	/*
	 * **Eine Teiländerung setzt den Rest nicht zurück** (Codeprüfung
	 * 29.09.2026). Die Reglementsseite zeigt die Angaben nicht zwingend in einem
	 * Formular; was ein Formular nicht schickt, muss stehen bleiben.
	 */
	it('lassen stehen, was eine Änderung nicht nennt', async () => {
		const g = await gemeinschaft('Ausnahmen teilweise');
		await speichereAusnahmen(handelnder(betreiber), g.id, {
			...LEER,
			universalvariante: 'vertreten',
			universalFundstelle: 'Art. 18 Reglement',
			leitungsvollmachtenZaehlen: true
		});
		await speichereAusnahmen(handelnder(betreiber), g.id, {
			reglementGestattet: true,
			reglementFundstelle: 'Art. 21 Reglement'
		});
		expect((await holeGemeinschaft(betreiber, g.id))?.ausnahmen).toEqual({
			reglementGestattet: true,
			reglementFundstelle: 'Art. 21 Reglement',
			universalvariante: 'vertreten',
			universalFundstelle: 'Art. 18 Reglement',
			leitungsvollmachtenZaehlen: true
		});

		// Und `null` leert ausdrücklich.
		await speichereAusnahmen(handelnder(betreiber), g.id, { universalFundstelle: null });
		expect((await holeGemeinschaft(betreiber, g.id))?.ausnahmen?.universalFundstelle).toBeNull();
	});

	it('stehen mit dem vorherigen Stand im Verlauf', async () => {
		const g = await gemeinschaft('Ausnahmen im Verlauf');
		await speichereAusnahmen(handelnder(betreiber), g.id, {
			...LEER,
			reglementGestattet: true,
			reglementFundstelle: 'Art. 21 Reglement',
			leitungsvollmachtenZaehlen: true
		});
		await speichereAusnahmen(handelnder(betreiber), g.id, {
			...LEER,
			universalvariante: 'vertreten'
		});

		const zeilen = await imKontext(betreiber, async (tx) => {
			return tx<
				{
					detail: {
						vorher: Record<string, unknown>;
						universalvariante: string;
						leitungsvollmachtenZaehlen: boolean;
					};
				}[]
			>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id}
				   AND event_type = ${EREIGNISARTEN.nichtangekuendigtesGesetzt}
				 ORDER BY id
			`;
		});
		// Der zweite Eintrag belegt den ganzen Vorzustand, auch die Angaben, die
		// der zweite Aufruf zurücksetzt. Ohne sie wäre ein Zurücksetzen im
		// Verlauf nicht als Änderung zu erkennen.
		expect(zeilen).toHaveLength(2);
		expect(zeilen[1].detail.vorher).toEqual({
			reglementGestattet: true,
			reglementFundstelle: 'Art. 21 Reglement',
			universalvariante: 'persoenlich',
			universalFundstelle: null,
			leitungsvollmachtenZaehlen: true
		});
		expect(zeilen[1].detail.universalvariante).toBe('vertreten');
		expect(zeilen[1].detail.leitungsvollmachtenZaehlen).toBe(false);
	});
});
