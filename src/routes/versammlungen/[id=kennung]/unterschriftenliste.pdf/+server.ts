import { error } from '@sveltejs/kit';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { standVon } from '$lib/domain/anwesenheit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeMomentaufnahme } from '$lib/server/freigabe';
import { holeAnwesenheitsereignisse } from '$lib/server/anwesenheit';
import { erzeugeUnterschriftenliste } from '$lib/server/pdf/unterschriftenliste';
import { vermerkeAusfallunterlage } from '$lib/server/ausfallsicherung';
import type { RequestHandler } from './$types';

/**
 * Die Unterschriftenliste.
 *
 * Sie rechnet auf der **Momentaufnahme** — dieselbe Grundlage wie jede Zählung
 * (AD-3). Eine Liste aus den lebenden Stammdaten könnte eine Partei enthalten,
 * die zum Versammlungsdatum gar nicht stimmberechtigt war.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, momentaufnahme, ereignisse] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		holeMomentaufnahme(locals.benutzer.operatorId, params.id),
		holeAnwesenheitsereignisse(locals.benutzer.operatorId, params.id)
	]);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');
	if (!momentaufnahme) {
		error(
			400,
			'Für diese Versammlung steht noch nicht fest, wer stimmberechtigt ist. Geben Sie sie ' +
				'zuerst frei.'
		);
	}

	const liste = stimmkraftliste(momentaufnahme);

	const bytes = await erzeugeUnterschriftenliste({
		gemeinschaftName: gemeinschaft.name,
		gemeinschaftAdresse: [
			gemeinschaft.strasse,
			[gemeinschaft.plz, gemeinschaft.ort].filter(Boolean).join(' ')
		]
			.filter((t) => t && t.trim())
			.join(', '),
		datum: versammlung.datum,
		uhrzeit: versammlung.uhrzeit,
		ort: versammlung.ort,
		stufe: versammlung.stufe,
		gesamtquote: momentaufnahme.totalQuota,
		kopfstimmenGesamt: liste.summeKopfstimmen,
		zeilen: liste.eintraege.map((e) => ({
			name: e.displayName,
			ausgeuebtDurch: e.ausgeuebtDurch,
			einheiten: e.einheiten.map((u) => u.label),
			kopfstimmen: e.kopfstimmen,
			wertquote: e.wertquote,
			bereitsErfasst:
				standVon(ereignisse.filter((x) => x.parteiId === e.partyId))?.zustand === 'anwesend'
		}))
	});

	/*
	 * Sie gehört zum Ausweichplan: Im Totalausfall ist sie der einzige Nachweis
	 * der Anwesenheit, der dann noch existiert. Der Vermerk steht **nach** dem
	 * Erzeugen — was nicht entstanden ist, wurde auch nicht geholt.
	 */
	await vermerkeAusfallunterlage(
		{
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		},
		params.id,
		'unterschriften'
	);

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="Unterschriftenliste-${versammlung.datum}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
