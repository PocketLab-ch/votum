import { holeNeutraktandenfussnote } from '$lib/server/neutraktanden';
import { holeLesarten } from '$lib/server/lesarten';
import { error } from '@sveltejs/kit';
import { holeBetreiber, holeBriefkopf } from '$lib/server/betreiber';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { stimmkraftAnsicht, holeParteinamen } from '$lib/server/eigentuemer';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeTraktanden } from '$lib/server/traktanden';
import { erzeugeTraktandenliste } from '$lib/server/pdf/traktandenliste';
import { holeAnwesenheitsregeln } from '$lib/server/reglement';
import { vermerkeEinladung } from '$lib/server/unterlagenvermerk';
import type { RequestHandler } from './$types';

/**
 * Die Einladung als PDF (23.08.2026, Prüflauf I, B-14).
 *
 * **Warum eine eigene Route** und nicht `traktandenliste.pdf?art=einladung`:
 * Der Dateiname steht im Postfach der Eigentümer, und «Traktandenliste.pdf»
 * ist dort das falsche Wort. Ausserdem hängt der Vorbereitungsschritt an dieser
 * Route — eine Ausprägung hinter einem Abfrageparameter wäre ein Zustand, den
 * niemand sieht.
 *
 * Wie die Traktandenliste wird sie bei jedem Abruf neu erzeugt und nicht
 * gespeichert: Ein gespeichertes PDF ginge nach der nächsten Änderung als
 * aktuell durch, obwohl es das nicht mehr wäre.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	/*
	 * **Die provisorische Fassung** (Praxisdurchlauf 28.08.2026). Dieselbe
	 * Einladung, aber mit sichtbarem Vermerk und ohne Vorbereitungsvermerk:
	 * Sie geht als Vorankündigung hinaus, Wochen bevor die Liste freigegeben
	 * ist — der Ablauf zählt sie deshalb nicht als «Einladung erzeugt».
	 */
	const provisorisch = url.searchParams.get('art') === 'provisorisch';
	const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

	const [gemeinschaft, traktanden, betreiber, briefkopf, anwesenheitsregeln, stimmkraft] =
		await Promise.all([
			holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
			holeTraktanden(locals.benutzer.operatorId, params.id),
			holeBetreiber(locals.benutzer.operatorId),
			holeBriefkopf(locals.benutzer.operatorId),
			/*
			 * **Die eigene Beschlussfähigkeitsregel** (Nachprüfung 23.08.2026): Bei
			 * einer Zweitversammlung nannte die Einladung immer das gesetzliche
			 * Drittel — auch dort, wo die Gemeinschaft eine strengere Regel
			 * hinterlegt hat und am Abend danach gerechnet wird.
			 */
			holeAnwesenheitsregeln(locals.benutzer.operatorId, versammlung.stwegId),
			/*
			 * **Nur für die Frage, ob der Absatz zum gemeinschaftlichen Eigentum
			 * hineingehört** (27.08.2026). Gerechnet wird damit nichts.
			 *
			 * **Warum die Stimmkraft und nicht die blosse Eigentümerliste** (aus dem
			 * Code-Review): Gefragt ist nicht, ob eine gemeinschaftliche Zeile
			 * besteht, sondern ob an diesem Abend eine Einheit gemeinsam gehalten
			 * wird. Eine Hülle ohne Einheit stimmt nicht mit und begründet keinen
			 * Absatz. Stichtag ist der Versammlungstag — dieselbe Frage, die am
			 * Abend gezählt wird.
			 */
			stimmkraftAnsicht(locals.benutzer.operatorId, versammlung.stwegId, versammlung.datum)
		]);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	const { bytes, hinweise } = await erzeugeTraktandenliste('einladung', {
		versammlung,
		gemeinschaftName: gemeinschaft.name,
		traktanden,
		parteinamen: await holeParteinamen(locals.benutzer.operatorId, versammlung.stwegId),
		// L5: Zeichen und Fussnote an neuen Traktanden (Migration 174).
		neutraktanden: await holeNeutraktandenfussnote(locals.benutzer.operatorId, params.id),
		// L8 (Migration 184): der Satz zu den Vollmachten der Verwaltung an
		// Traktanden mit Häkchen, je nach Wahl (G7).
		verwaltungL8: (await holeLesarten(locals.benutzer.operatorId, { meetingId: params.id })).L8,
		briefkopf,
		briefkopfHoeheMm: betreiber?.briefkopfHoeheMm,
		briefkopfAlleSeiten: betreiber?.briefkopfAlleSeiten,
		einladung: {
			// Ohne Briefkopf ist der Betreibername der einzige Absender; wer
			// einberuft, muss auch dann dastehen (ZGB Art. 712n Abs. 1).
			absender: betreiber?.name ?? 'Die Bewirtschaftung',
			// Das Datum entsteht hier und nicht im Satzbau: Der Erzeuger bleibt
			// damit prüfbar, und zwei Abrufe am selben Tag ergeben dasselbe Blatt.
			datum: heute,
			vollmachtsgrenze: gemeinschaft.proxyLimit,
			vollmachtsgrenzeQuelle: gemeinschaft.proxyLimitRuleSource ?? null,
			beschlussfaehigkeit: anwesenheitsregeln[versammlung.stufe] ?? null,
			gemeinschaftlichesEigentum: stimmkraft.zeilen.some(
				(z) => z.isCommunity && z.einheiten.length > 0
			)
		},
		provisorischerStand: provisorisch ? heute : undefined
	});

	const kopfzeilen: Record<string, string> = {
		'content-type': 'application/pdf',
		'content-disposition': `inline; filename="Einladung-${provisorisch ? 'provisorisch-' : ''}${versammlung.datum}.pdf"`,
		'cache-control': 'private, no-store'
	};
	if (hinweise.length > 0) kopfzeilen['x-versammlung-hinweis'] = hinweise.join(' | ');

	/*
	 * **Kein Vermerk bei der provisorischen Fassung.** Die Vorankündigung ist
	 * nicht die Einladung im Sinne des Ablaufs; der Schritt «Einladung erzeugt»
	 * bleibt offen, bis die freigegebene Fassung geholt wird.
	 */
	if (!provisorisch) {
		await vermerkeEinladung(
			{
				operatorId: locals.benutzer.operatorId,
				userId: locals.benutzer.id,
				label: locals.benutzer.displayName
			},
			params.id
		);
	}

	return new Response(bytes as BodyInit, { headers: kopfzeilen });
};
