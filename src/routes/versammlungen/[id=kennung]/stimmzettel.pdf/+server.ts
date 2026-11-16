import { error } from '@sveltejs/kit';
import { erfordernisInWorten } from '$lib/domain/auszaehlung';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeMomentaufnahme } from '$lib/server/freigabe';
import { holeTraktanden } from '$lib/server/traktanden';
import { erzeugeStimmzettel, zettelzuteilung } from '$lib/server/pdf/stimmzettel';
import { vermerkeAusfallunterlage, zaehlweisen } from '$lib/server/ausfallsicherung';
import type { RequestHandler } from './$types';

/**
 * Die Stimmzettel für den Ausfall — je Traktandum ein Zettel, dazu ein Zählblatt.
 *
 * **Vor der Versammlung zu drucken.** Ein Ausweichplan, der einen laufenden
 * Server voraussetzt, ist keiner: Wer ihn braucht, hat genau den nicht mehr.
 *
 * Wie jede Zählung rechnet er auf der **Momentaufnahme** (AD-3) — eine Liste
 * aus den lebenden Stammdaten enthielte womöglich eine Partei, die am
 * Versammlungstag gar nicht stimmberechtigt war.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, momentaufnahme, traktanden, weisen] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		holeMomentaufnahme(locals.benutzer.operatorId, params.id),
		holeTraktanden(locals.benutzer.operatorId, params.id),
		zaehlweisen(locals.benutzer.operatorId, params.id)
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

	/*
	 * **Nur Traktanden, über die abgestimmt wird.** Eine Kenntnisnahme kennt
	 * keinen Beschluss; ein Ankreuzfeld daneben lüde zu einer Abstimmung ein, die
	 * es nicht gibt. Zurückgezogene bleiben ebenfalls weg — über sie wird nicht
	 * mehr abgestimmt, und ein Feld dafür wäre eine Falle.
	 */
	const posten = traktanden
		.filter((t) => t.knoten.art === 'abstimmung' && !t.knoten.rueckzug)
		.map((t) => ({
			nummer: t.nummer,
			titel: t.knoten.titel,
			antrag: t.knoten.antragswortlaut ?? null,
			/*
			 * **In Worten, nicht als Fallname** (22.08.2026). Bis dahin stand hier
			 * «Nötiges Mehr: Gewöhnliche Verwaltungshandlung» — eine Auskunft, die
			 * die Frage nicht beantwortet. Jetzt: «mehr als die Hälfte der
			 * Anwesenden und Vertretenen».
			 *
			 * **Und bewusst ohne Zahl.** Der Stimmzettel entsteht am Vortag; eine
			 * Zahl darauf verspräche eine Schwelle, die der Abend verschiebt,
			 * sobald jemand mehr oder weniger erscheint.
			 */
			erfordernis: t.knoten.erfordernis ? erfordernisInWorten(t.knoten.erfordernis) : null,
			/*
			 * **Zwei Teile nach der Zählweise** (Produktentscheid 14.11.2026).
			 * Wo Handerheben genügt, stehen die Zettel hinten und werden nur
			 * gedruckt, wenn auch dort schriftlich abgestimmt wird. Ob es genügt,
			 * entscheidet dieselbe Regel wie für die Auszählmappe
			 * (`zaehlweisen`, Codeprüfung 14.11.2026, M1), nicht der Typ des
			 * Mehrs allein: Auch ein einfaches Mehr braucht Zettel, wenn bei
			 * Gleichstand die Wertquoten entscheiden oder die Kopfstimmen
			 * ungleich sind. Ein noch offenes Mehr gehört ebenfalls nach vorne
			 * (`zettelzuteilung`).
			 */
			...zettelzuteilung(t.knoten.erfordernis?.typ, weisen.get(t.knoten.id))
		}));

	if (posten.length === 0) {
		error(400, 'Diese Versammlung hat kein Traktandum, über das abgestimmt wird.');
	}

	const bytes = await erzeugeStimmzettel({
		gemeinschaftName: gemeinschaft.name,
		datum: versammlung.datum,
		uhrzeit: versammlung.uhrzeit,
		ort: versammlung.ort,
		gesamtquote: momentaufnahme.totalQuota,
		kopfstimmenGesamt: liste.summeKopfstimmen,
		posten,
		parteien: liste.eintraege.map((e) => ({
			name: e.displayName,
			ausgeuebtDurch: e.ausgeuebtDurch,
			einheiten: e.einheiten.map((u) => u.label),
			kopfstimmen: e.kopfstimmen,
			wertquote: e.wertquote
		}))
	});


	// Der Ausweichplan gehört in die Vorbereitung: Die Leiste zeigt ihn erst
	// als erledigt, wenn jede Unterlage geholt wurde.
	await vermerkeAusfallunterlage(
		{ operatorId: locals.benutzer.operatorId, userId: locals.benutzer.id, label: locals.benutzer.displayName },
		params.id,
		'stimmzettel'
	);

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="Stimmzettel-${versammlung.datum}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
