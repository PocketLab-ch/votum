import { redirect } from '@sveltejs/kit';
import { normalisiere } from '$lib/domain/zugang';
import { loeseAnzeigecodeAuf } from '$lib/server/versammlungen';
import { setzeAnzeigeKeks } from '$lib/server/anzeigesitzung';
import { keksSicher } from '$lib/server/keks';
import type { PageServerLoad } from './$types';

/**
 * Der Verweis aus der Steuerungssicht: Code einlösen, dann weiter zu `/p`.
 *
 * Damit lässt sich die Präsentationssicht mit einem Klick öffnen, wenn Beamer
 * und Steuerung am selben Gerät hängen. Der Code verschwindet dabei aus der
 * Adresszeile — auf einer Leinwand hat er nichts verloren.
 */
export const load: PageServerLoad = async ({ cookies, params }) => {
	const befund = await loeseAnzeigecodeAuf(params.code);
	if (befund.gueltig) {
		setzeAnzeigeKeks(cookies, normalisiere(params.code), keksSicher());
	}
	redirect(303, '/p');
};
