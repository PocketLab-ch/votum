import { error } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeLesarten } from '$lib/server/lesarten';
import { stimmkraftAnsicht } from '$lib/server/eigentuemer';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeMomentaufnahme } from '$lib/server/freigabe';
import { erzeugeVollmachtsformular } from '$lib/server/pdf/vollmachtsformular';
import type { RequestHandler } from './$types';

/**
 * Das Vollmachtsformular als PDF (Bedienbarkeitsprüfung 05.09.2026, Befund 25).
 *
 * **Warum eine eigene Route neben dem Versandsatz.** Der Versandsatz legt das
 * Blatt jeder Person bei — er entsteht aber nur zusammen mit **neuen
 * Zugangscodes**, und das ist ein unumkehrbarer Vorgang (der alte Code wird
 * ungültig). Wer nur ein Formular nachdrucken will, weil jemand anruft und es
 * verlegt hat, darf dafür niemandem den Zugang entwerten.
 *
 * **Ein Blatt je stimmberechtigter Partei**, mit Name und Einheiten schon
 * darauf: Am Einlass bleibt dann nichts zu raten. Wer ein leeres Blatt braucht,
 * druckt eines davon und streicht den Namen — ein zusätzlicher Weg für den Fall
 * wäre ein Knopf mehr für einen Fall, den es selten gibt.
 *
 * Wie die Einladung wird es bei jedem Abruf neu erzeugt und nicht gespeichert.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, momentaufnahme, stimmkraft] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		/*
		 * **Dieselbe Quelle wie Karten und Zugangsliste** (Code-Review
		 * 07.09.2026). Ab der Freigabe steht der Stimmberechtigtenstand
		 * eingefroren in der Momentaufnahme, und `erzeugeKartensatz` rechnet
		 * daraus — mit dem ausdrücklichen Vermerk, dass zwei Rechnungen für
		 * dieselben Zahlen eines Tages auseinanderlaufen. Die erste Fassung las
		 * hier die Lebenddaten: Ein nachträglich erfasster Eigentümerwechsel
		 * hätte ein Blatt auf jemanden gedruckt, der am Einlass keine Stimme
		 * hat.
		 */
		holeMomentaufnahme(locals.benutzer.operatorId, params.id),
		/*
		 * Vor der Freigabe gibt es noch keine Momentaufnahme. Dann zählt der
		 * Stand am Versammlungstag — dieselbe Frage, nur noch nicht eingefroren.
		 */
		stimmkraftAnsicht(locals.benutzer.operatorId, versammlung.stwegId, versammlung.datum)
	]);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	/*
	 * **Nur Parteien mit Einheiten.** Eine Hülle ohne Einheit stimmt nicht mit;
	 * ein Vollmachtsformular für sie wäre ein Blatt für eine Stimme, die es
	 * nicht gibt.
	 */
	const geber = momentaufnahme
		? momentaufnahme.parties
				.filter((p) => p.units.length > 0)
				.map((p) => ({ name: p.displayName, einheiten: p.units.map((u) => u.label) }))
		: stimmkraft.zeilen
				.filter((z) => z.einheiten.length > 0)
				.map((z) => ({ name: z.displayName, einheiten: z.einheiten.map((e) => e.label) }));
	if (geber.length === 0) {
		error(409, 'Für diese Versammlung ist keine stimmberechtigte Partei erfasst.');
	}

	const bytes = await erzeugeVollmachtsformular(
		{
			gemeinschaftName: gemeinschaft.name,
			// Wie in `kartensatz.ts` gefiltert: Ein Feld mit einem Leerschlag ergäbe
			// sonst ein führendes Komma auf einem Blatt, das am Einlass vorliegt.
			gemeinschaftAdresse: [
				gemeinschaft.strasse,
				[gemeinschaft.plz, gemeinschaft.ort].filter((t) => t && t.trim()).join(' ')
			]
				.filter((t) => t && t.trim())
				.join(', '),
			datum: versammlung.datum,
			uhrzeit: versammlung.uhrzeit,
			ort: versammlung.ort,
			stufe: versammlung.stufe,
			vollmachtsgrenze: gemeinschaft.proxyLimit,
			vollmachtsgrenzeQuelle: gemeinschaft.proxyLimitRuleSource ?? null,
			stimmfuehrungZaehlt:
				(await holeLesarten(locals.benutzer.operatorId, { meetingId: params.id })).L15 === 'mitzaehlen'
		},
		geber
	);

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="Vollmachtsformular-${versammlung.datum}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
