import { error } from '@sveltejs/kit';
import { weisungInWorten } from '$lib/domain/weisung';
import { datumLang } from '$lib/domain/datum';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeTraktanden } from '$lib/server/traktanden';
import { holeErgebnis } from '$lib/server/abstimmung';
import { holeVertreterAm } from '$lib/server/vertretung';
import { holeWeisungen, holeWeisungspflichtige } from '$lib/server/weisung';
import { erzeugeWeisungsblatt, type Weisungszeile } from '$lib/server/pdf/weisungsblatt';
import type { RequestHandler } from './$types';

/**
 * Das Weisungsblatt eines Hauses (Story 7.8).
 *
 * Ein Blatt je Haus — `?haus=<parteiId>`. Ein gemeinsames Blatt gäbe jedem
 * Vertreter ohne Not Auskunft darüber, wie die anderen Häuser stimmen werden.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const parteiId = url.searchParams.get('haus');
	if (!parteiId) error(400, 'Geben Sie an, für welches Haus das Blatt gilt (?haus=…).');

	const versammlung = await holeVersammlung(op, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, traktanden, pflichtige, vertreter] = await Promise.all([
		holeGemeinschaft(op, versammlung.stwegId),
		holeTraktanden(op, params.id),
		holeWeisungspflichtige(op, versammlung.stwegId, versammlung.datum),
		holeVertreterAm(op, versammlung.stwegId, versammlung.datum)
	]);

	const haus = pflichtige.find((p) => p.parteiId === parteiId);
	if (!haus) error(404, 'Diese Gemeinschaft ist an der Versammlung nicht weisungsberechtigt.');

	const zeilen: Weisungszeile[] = [];
	for (const t of traktanden.filter((x) => x.knoten.art === 'abstimmung')) {
		const weisungen = await holeWeisungen(op, t.knoten.id);
		const meine = weisungen.find((w) => w.parteiId === parteiId) ?? null;
		if (!meine) continue;

		// Bei einer Weisung aus einem Beschluss wird der Beleg aus dem Durchgang
		// geholt und nicht zweitgespeichert: Die Zahlen stehen dort, und eine
		// Kopie liefe eines Tages auseinander.
		let beleg: string | null = meine.bemerkung;
		if (meine.herkunft === 'beschluss' && meine.quelleVersammlungId && meine.quelleDurchgangId) {
			const e = await holeErgebnis(op, meine.quelleVersammlungId, meine.quelleDurchgangId);
			const hv = await holeVersammlung(op, meine.quelleVersammlungId);
			const a = e.auszaehlung;
			if (a) {
				const ergebnis = a.keinBeschluss
					? 'kein Beschluss'
					: a.angenommen
						? 'angenommen'
						: 'abgelehnt';
				/*
				 * **Bei geheimer Abstimmung keine Verteilung auf dem Blatt**
				 * (Produktentscheid 28.09.2026). Das Weisungsblatt geht an die
				 * Vertretung; die Zahlen der Hausversammlung bleiben dort, wo das
				 * Geheimnis gilt. Das Ergebnis steht auch dann.
				 */
				beleg = a.geheim
					? `Beschluss der Hausversammlung vom ${hv ? datumLang(hv.datum) : '—'}: ` +
						`Geheim abgestimmt; das Ergebnis lautet ${ergebnis}.`
					: `Beschluss der Hausversammlung vom ${hv ? datumLang(hv.datum) : '—'}: ` +
						`${a.koepfe.ja} ja, ${a.koepfe.nein} nein, ${a.koepfe.enthaltung} Enthaltung — ` +
						`${ergebnis}.`;
			}
		}

		zeilen.push({
			nummer: t.nummer,
			titel: t.knoten.titel,
			antragswortlaut: t.knoten.antragswortlaut ?? null,
			satz: weisungInWorten(meine, '').replace(/^:\s*/, ''),
			beleg
		});
	}

	const v = vertreter.get(parteiId);
	const bytes = await erzeugeWeisungsblatt({
		gemeinschaftName: gemeinschaft?.name ?? '',
		hausName: haus.name,
		vertreter: v?.personName ?? haus.vertreter,
		grundlage: v?.grundlage ?? null,
		datum: versammlung.datum,
		uhrzeit: versammlung.uhrzeit,
		ort: versammlung.ort,
		zeilen,
		erzeugtAm: new Date().toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich' })
	});

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="Weisung-${haus.name.replace(/[^\w]+/g, '-')}.pdf"`
		}
	});
};
