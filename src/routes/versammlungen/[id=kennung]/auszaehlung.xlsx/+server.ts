import { kopfgewicht } from '$lib/domain/eigentuemer';
import { error } from '@sveltejs/kit';
import { dosZeitstempel } from '$lib/domain/archiv';
import {
	baueAuszaehlmappe,
	brauchtRechnung,
	kopfstimmenUngleich,
	mappenpostenAus,
	type Ausgelassen,
	type Mappenposten
} from '$lib/domain/auszaehlmappe';
import { schwelleInWorten } from '$lib/domain/mehrheit';
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { datumLang } from '$lib/domain/datum';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { alsArbeitsmappe } from '$lib/domain/xlsx';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeMomentaufnahme } from '$lib/server/freigabe';
import { holeNeueTraktandenDerZweiten, holeTraktanden } from '$lib/server/traktanden';
import { holeAnwesenheitsregeln } from '$lib/server/reglement';
import { vermerkeAusfallunterlage } from '$lib/server/ausfallsicherung';
import type { RequestHandler } from './$types';

/**
 * Die Auszählmappe für den **Totalausfall** — vor der Versammlung zu laden.
 *
 * **Der Unterschied zum Stimmzettel-PDF.** Der Stimmzettel nimmt die Stimmen
 * auf; diese Mappe zählt sie aus. Beim einfachen Mehr der Anwesenden genügt
 * Handzählen, und dafür braucht es keine Tabelle. Gebraucht wird sie, wo
 * **Wertquoten** entscheiden, wo die Abwesenden in die Bezugsgrösse gehören, wo
 * die Kopfstimmen ungleich verteilt sind, wo das Reglement die Enthaltungen aus
 * der Bezugsgrösse nimmt oder wo die **Schwelle** eine andere als «mehr als die
 * Hälfte» ist. Überall dort ist eine Zählung im Kopf keine Zählung mehr; die
 * massgebende Liste steht bei `brauchtRechnung` in `auszaehlmappe.ts`.
 *
 * **Sie gehört auf einen Stick oder in ein Postfach, bevor der Abend beginnt.**
 * Wer sie braucht, hat den Server nicht mehr, von dem er sie holen könnte.
 *
 * Gerechnet wird auf der **Momentaufnahme** (AD-3): Eine Liste aus den lebenden
 * Stammdaten enthielte womöglich eine Partei, die am Versammlungstag gar nicht
 * stimmberechtigt war.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, momentaufnahme, traktanden, neue, regeln] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		holeMomentaufnahme(locals.benutzer.operatorId, params.id),
		holeTraktanden(locals.benutzer.operatorId, params.id),
		// L5: neue Traktanden der zweiten Versammlung und die Regel einer ersten (A3).
		holeNeueTraktandenDerZweiten(locals.benutzer.operatorId, params.id),
		holeAnwesenheitsregeln(locals.benutzer.operatorId, versammlung.stwegId)
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
	const parteien = liste.eintraege.map((e) => ({
		name: e.displayName,
		kopfstimmen: e.kopfstimmen,
		// Für die Einsprache je Eigentümer (L3), aus derselben Stelle wie die
		// Auszählung (Codeprüfung Block 5, M5).
		kopfstimmenJeEigentuemer: kopfgewicht({ units: e.einheiten }, 'per_owner', false),
		wertquote: e.wertquote
	}));
	const ungleich = kopfstimmenUngleich(parteien);
	const l5 = momentaufnahme.lesarten?.L5 ?? LESARTEN_VORGABE.L5;

	const posten: Mappenposten[] = [];
	const ausgelassen: Ausgelassen[] = [];

	for (const t of traktanden) {
		if (t.knoten.art !== 'abstimmung' || t.knoten.rueckzug) continue;
		const e = t.knoten.erfordernis;

		/*
		 * **Keine stillen Lücken.** Ein Traktandum ohne Erfordernis oder ohne
		 * Kopfschwelle lässt sich nicht ausrechnen — dann fehlt die Zahl, ab der
		 * ein Antrag angenommen ist. Es fällt deshalb aus der Mappe, steht aber
		 * mit Grund am Fuss des Blattes. Eine Mappe, die zwölf von vierzehn
		 * Traktanden zeigt und darüber schweigt, liest sich wie eine
		 * vollständige.
		 */
		const p = e
			? mappenpostenAus({ nummer: t.nummer, titel: t.knoten.titel }, e, momentaufnahme, {
					neuAnZweiter: neue.has(t.knoten.id),
					wahl: l5
				})
			: null;
		if (!e || !p) {
			ausgelassen.push({
				nummer: t.nummer,
				titel: t.knoten.titel,
				grund: e
					? `Das Erfordernis «${e.titel}» nennt keine Kopfschwelle — hier lässt sich nicht rechnen.`
					: 'Ohne festgelegtes Mehrheitserfordernis lässt sich nicht rechnen.'
			});
			continue;
		}

		if (!brauchtRechnung(p, ungleich, momentaufnahme.tieBreak)) {
			/*
			 * **Der Grund kommt aus dem Erfordernis, nicht aus einer Konstanten**
			 * (04.09.2026). Der Satz stand fest verdrahtet da und behauptete
			 * «Einfaches Mehr der Anwesenden» auch dort, wo etwas anderes galt: Ein
			 * Zweidrittelmehr aus dem Reglement fiel durch die alte Prüfung und
			 * bekam denselben Satz. Wer im Ausfall danach zählte, mass gegen die
			 * halbe statt die zweidrittel Schwelle.
			 *
			 * Jetzt kann der Satz gar nicht mehr danebenliegen, weil er aus
			 * derselben Schwelle gebildet wird, die auch die Prüfung gelesen hat.
			 */
			ausgelassen.push({
				nummer: t.nummer,
				titel: t.knoten.titel,
				grund:
					// Ohne Köpfe braucht es immer die Rechnung (Quotenschwelle); hier steht nur das Kopfmehr.
					`${e.titel}: ${p.kopfSchwelle ? schwelleInWorten(p.kopfSchwelle) : '—'} der Anwesenden oder Vertretenen, ` +
					'bei gleichen Kopfstimmen im Saal auszuzählen.'
			});
			continue;
		}
		posten.push(p);
	}

	if (posten.length === 0) {
		error(
			400,
			'Kein Traktandum dieser Versammlung braucht mehr als Handzählen. Für die Stimmen selbst ' +
				'gibt es den Stimmzettel als PDF.'
		);
	}

	const bytes = alsArbeitsmappe(
		[
			baueAuszaehlmappe({
				gemeinschaftName: gemeinschaft.name,
				datum: datumLang(versammlung.datum),
				uhrzeit: versammlung.uhrzeit,
				ort: versammlung.ort,
				gesamtquote: momentaufnahme.totalQuota,
				// Die eingefrorene Wahl zu L1, für den Satz am Fuss (Migration 170).
				ausstandslesart: momentaufnahme.lesarten?.L1,
				stichentscheid: momentaufnahme.tieBreak,
				ersteVersammlung: regeln.erste ?? null,
				neuAnZweiterWahl: l5,
				jeEinheit: momentaufnahme.headCountMode !== 'per_owner',
				parteien,
				posten,
				ausgelassen
			})
		],
		dosZeitstempel(new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' }))
	);


	// Der Ausweichplan gehört in die Vorbereitung: Die Leiste zeigt ihn erst
	// als erledigt, wenn jede Unterlage geholt wurde.
	await vermerkeAusfallunterlage(
		{ operatorId: locals.benutzer.operatorId, userId: locals.benutzer.id, label: locals.benutzer.displayName },
		params.id,
		'auszaehlung'
	);

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type':
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'content-disposition': `attachment; filename="Auszaehlung-${versammlung.datum}.xlsx"`,
			'cache-control': 'private, no-store'
		}
	});
};
