import { error, fail } from '@sveltejs/kit';
import {
	EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT,
	GESETZLICH,
	stelleBeschlussfaehigkeitFest,
	type Versammlungsstufe
} from '$lib/domain/beschlussfaehigkeit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fristKurz } from '$lib/domain/versammlung';
import { ganzzahl, jaNein, text } from '$lib/server/formular';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { stimmkraftAnsicht } from '$lib/server/eigentuemer';
import {
	erstelleAnwesenheitsregel,
	holeAnwesenheitsregeln,
	loescheAnwesenheitsregel
} from '$lib/server/reglement';
import type { Actions, PageServerLoad } from './$types';

function heute(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/**
 * Beschlussfähigkeit ohne Versammlung.
 *
 * In Epic 3 zieht die Feststellung ihre Zahlen aus der festgeschriebenen
 * Anwesenheit (AD-16). Bis dahin ist das hier ein Rechner: Die Sitzungsleitung
 * gibt ein, wer erschienen ist, und sieht, was fehlt. Dieselbe Kernfunktion,
 * andere Quelle der Zahlen.
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	const [stimmkraft, regeln] = await Promise.all([
		stimmkraftAnsicht(locals.benutzer.operatorId, params.id, heute()),
		holeAnwesenheitsregeln(locals.benutzer.operatorId, params.id)
	]);

	const art = (url.searchParams.get('art') as Versammlungsstufe) === 'zweite' ? 'zweite' : 'erste';
	const kopfstimmenGesamt = stimmkraft.summeKopfstimmen;
	const gesamtquote = gemeinschaft.quotaDenominator;

	/*
	 * **Der Rechner fragt nach Stockwerkeigentümern, nicht nach Kopfstimmen**
	 * (26.08.2026). Art. 712p zählt Personen; bei «je Einheit» wären die
	 * Kopfstimmen die Einheiten, und wer drei Wohnungen hält, erfüllte das
	 * «mindestens aber zwei» im Alleingang.
	 */
	const eigentuemerGesamt = stimmkraft.zeilen.filter((z) => z.einheiten.length > 0).length;

	// Ohne Eingabe wird von voller Anwesenheit ausgegangen — das ist der einzige
	// Wert, der nichts behauptet, was noch niemand weiss.
	const anwesendKopf = Number.isNaN(ganzzahl(url.searchParams.get('kopf')))
		? eigentuemerGesamt
		: Number(url.searchParams.get('kopf'));
	const anwesendQuoten = Number.isNaN(ganzzahl(url.searchParams.get('quoten')))
		? gesamtquote
		: Number(url.searchParams.get('quoten'));

	const feststellung = stelleBeschlussfaehigkeitFest(
		art,
		{
			eigentuemerGesamt,
			eigentuemerAnwesend: anwesendKopf,
			// Für die Beschlussfähigkeit ohne Belang; die Seite weist sie aus.
			kopfstimmenGesamt,
			kopfstimmenAnwesend: anwesendKopf,
			gesamtquote,
			quotenAnwesend: anwesendQuoten
		},
		regeln[art] ?? null
	);

	return {
		gemeinschaft,
		art,
		kopfstimmenGesamt,
		eigentuemerGesamt,
		gesamtquote,
		anwesendKopf,
		anwesendQuoten,
		feststellung,
		regeln,
		gesetzlich: GESETZLICH,
		einstimmigkeitshinweis: EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT,
		// Mit dem Wert dieser Gemeinschaft: Hat ihr Reglement eine längere Frist,
		// nennt der Satz deren Tag und nicht den gesetzlichen (Migration 122).
		fristhinweis: fristKurz(gemeinschaft.zweitversammlungsfristTage)
	};
};

/**
 * Die Stufe aus dem Formular, geprüft statt behauptet.
 *
 * Bis zum 06.09.2026 stand hier `text(daten.get('art')) as Versammlungsstufe`.
 * Eine Zusicherung an den Übersetzer ist keine Prüfung: Bei `art=dritte` oder
 * fehlendem Feld lief der Wert weiter und schlug erst als `TypeError` auf, in
 * `aufheben` sogar erst in der Datenbank — dort löschte die Abfrage null Zeilen,
 * und der Verlaufseintrag darüber bezeugte trotzdem eine Aufhebung.
 */
function stufe(wert: FormDataEntryValue | null): Versammlungsstufe | null {
	const w = text(wert);
	return w === 'erste' || w === 'zweite' ? w : null;
}

const STUFE_FEHLT = 'Wählen Sie, ob die Regel für die Erst- oder die Zweitversammlung gilt.';

export const actions: Actions = {
	hinterlegen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const handelnder = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};
		const art = stufe(daten.get('art'));
		if (!art) return fail(400, { fehler: { nachricht: STUFE_FEHLT, feld: 'art' } });
		const mitQuoten = jaNein(daten.get('mitQuoten'));

		try {
			await erstelleAnwesenheitsregel(handelnder, params.id, art, {
				kopf: {
					zaehler: ganzzahl(daten.get('kopfZaehler')),
					nenner: ganzzahl(daten.get('kopfNenner')),
					art: 'mindestens'
				},
				quoten: mitQuoten
					? {
							zaehler: ganzzahl(daten.get('quotenZaehler')),
							nenner: ganzzahl(daten.get('quotenNenner')),
							art: 'mindestens'
						}
					: null,
				mindestens: ganzzahl(daten.get('mindestens')),
				fundstelle: text(daten.get('fundstelle'))
			});
			return { gespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	aufheben: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const art = stufe(daten.get('art'));
		if (!art) return fail(400, { fehler: { nachricht: STUFE_FEHLT, feld: 'art' } });
		await loescheAnwesenheitsregel(
			{
				operatorId: locals.benutzer.operatorId,
				userId: locals.benutzer.id,
				label: locals.benutzer.displayName
			},
			params.id,
			art
		);
		return { aufgehoben: true };
	}
};
