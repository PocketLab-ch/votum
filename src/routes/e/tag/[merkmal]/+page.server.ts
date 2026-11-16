import { redirect } from '@sveltejs/kit';
import { loeseAbendeinstiegAuf, saalmerkmalDesHauses } from '$lib/server/saaleinstieg';
import type { PageServerLoad } from './$types';

/**
 * Der Einstieg über den QR-Code auf dem gemeinsamen Monitor (24.08.2026).
 *
 * **Der Anlass** (Auftraggeber): «Es ist wenig komfortabel, wenn man zwei QR hat und
 * einen davon abschiessen will. Darum ein QR, die öffnet dann eine Hilfsseite,
 * bei dem man dann die richtige STWEG auswählen kann.»
 *
 * Ein Code für den Abend, eine Frage darauf: In welchem Haus wohnen Sie?
 * Danach geht es weiter auf den bekannten Weg — dieselbe Seite, die auch der
 * QR einer einzelnen Versammlung öffnet.
 *
 * Offen erreichbar und bewusst arm an Inhalt: Es erscheint nur, was ohnehin an
 * der Wand steht — Bezeichnung, Datum, Ort und die Namen der Häuser.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	const befund = await loeseAbendeinstiegAuf(params.merkmal);

	/*
	 * **Die Weiterleitung geschieht auf dem Server.** Das Saalmerkmal des Hauses
	 * steht damit nie im HTML der Auswahl: Wer den Bildschirm abfotografiert,
	 * bekommt die Namen, nicht die Zugänge aller Häuser.
	 */
	const haus = url.searchParams.get('haus');
	if (befund.gueltig && haus) {
		const merkmal = await saalmerkmalDesHauses(params.merkmal, haus);
		if (merkmal) redirect(303, `/e/${merkmal}`);
	}

	return {
		gueltig: befund.gueltig,
		grund: befund.grund ?? null,
		bezeichnung: befund.bezeichnung ?? '',
		datum: befund.datum ?? '',
		uhrzeit: befund.uhrzeit ?? '',
		ort: befund.ort ?? '',
		/*
		 * Nur laufende und freigegebene Versammlungen: In einem Haus, das noch im
		 * Entwurf steht oder schon geschlossen ist, kann sich niemand melden — es
		 * anzubieten hiesse, in eine Absage zu führen.
		 */
		haeuser: (befund.haeuser ?? [])
			.filter((h) => h.zustand === 'laufend' || h.zustand === 'freigegeben')
			.map((h) => ({ meetingId: h.meetingId, name: h.name })),
		/** Ob die Wahl ins Leere lief — etwa nach einem alten Aufruf mit fremder Kennung. */
		fehlgeschlagen: Boolean(haus)
	};
};
