import { error } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { abendschritte, gemeinsameListe } from '$lib/domain/gemeinsameliste';
import { holeVersammlungstag } from '$lib/server/versammlungstag';
import { holeGemeinsameListe } from '$lib/server/geschaeft';
import { holeAbendhaeuser } from '$lib/server/uebersicht';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeTraktanden } from '$lib/server/traktanden';
import {
	holeOderErzeugeAbendmerkmal,
	holeOderErzeugeSaalmerkmal
} from '$lib/server/saaleinstieg';
import { abendfeststellungssatz } from '$lib/domain/beschlussfaehigkeit';
import { holeFeststellungen } from '$lib/server/beschlussfaehigkeit';
import { kurznamen } from '$lib/domain/kurzname';
import { gemeinsamePause } from '$lib/domain/pausenstand';
import { stelltBeschlussfaehigkeitFest } from '$lib/domain/traktandenvorlage';
import { herkunft } from '$lib/server/herkunft';
import type { PageServerLoad } from './$types';

/**
 * Der gemeinsame Monitor (Auftraggeber, 23.08.2026).
 *
 * «Was nicht brauchbar ist, sind 5 Bildschirme für Präsentationen. Ein
 * gemeinsamer Abend hat auch einen gemeinsamen Bildschirm.»
 *
 * **Ein Punkt, mehrere Gemeinschaften.** Oben steht die Sache, über die im Saal
 * gesprochen wird — einmal. Darunter je Gemeinschaft, wie es bei ihr steht:
 * beschlussfähig, wie viele abgestimmt haben, was herauskam. Das ist der
 * Unterschied zur Wand einer einzelnen Versammlung, und deshalb ist es eine
 * eigene Sicht und keine Ausprägung von `Saalbild`: Dort geht es um eine
 * Gemeinschaft, hier um ihr Nebeneinander.
 *
 * **Keine Namen** (AD-11). Was hier steht, sehen alle im Saal; ein
 * Anwesenheitsstand mit Namen wäre eine Anwesenheitsliste an der Wand.
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const tag = await holeVersammlungstag(op, params.id);
	if (!tag) error(404, 'Gemeinsame Versammlung nicht gefunden');

	const [zeilen, haeuser] = await Promise.all([
		holeGemeinsameListe(op, params.id),
		holeAbendhaeuser(op, params.id)
	]);
	const liste = gemeinsameListe(zeilen);

	/*
	 * **Welcher Punkt läuft, sagen die Häuser.** Aufgerufen wird je Versammlung
	 * (AD-10); am Abend ist der laufende Punkt der, der **zuletzt** aufgerufen
	 * wurde. Die Sitzungsleitung führt den Saal, und die Wand folgt ihrem
	 * letzten Handgriff.
	 *
	 * **Vorher stand hier «der am häufigsten aufgerufene»** — und das war
	 * falsch, sobald ein Punkt je Haus getrennt abgestimmt wird (Auftraggeber,
	 * 25.08.2026: «Wenn ich nun das Traktandum 2.2 aufrufe, bleibt die
	 * Präsentationsansicht bei 2.1 stehen»).
	 *
	 * Dann hat nämlich jedes Haus sein **eigenes** Traktandum: zwei Häuser, zwei
	 * Kennungen, je einmal gezählt. Der Gleichstand fiel auf das erste Haus in
	 * der Reihenfolge — alphabetisch, und damit für immer dasselbe. Am Prüflauf
	 * vom 24.08. nachgemessen: 11:07 MEG aufgerufen (2.1), 11:11 ihr Ergebnis
	 * verkündet, 11:14 Nirgendweg 5/5a (2.2) — die Wand blieb bei 2.1, weil
	 * «MEG …» vor «Nirgendweg …» steht.
	 *
	 * Die Häufigkeit war nie die Frage. Der Zeitpunkt fehlte bloss; er steht
	 * seit Migration 084 neben dem Punkt.
	 */
	const aufgerufene = await Promise.all(
		haeuser.map(async (h) => {
			const v = await holeVersammlung(op, h.versammlungId);
			return {
				traktandumId: v?.aktuellesTraktandumId ?? null,
				seit: v?.aufgerufenSeit ?? null
			};
		})
	);
	const juengstes = aufgerufene
		.filter((a): a is { traktandumId: string; seit: string | null } => Boolean(a.traktandumId))
		// Ohne Zeitpunkt hinten anstellen: Der CHECK verlangt ihn zwar, aber ein
		// Haus, das ihn aus einem Grund doch nicht trägt, darf ein frisch
		// aufgerufenes nicht verdrängen.
		.sort((a, b) => (b.seit ?? '').localeCompare(a.seit ?? ''))[0];
	const laufendesTraktandum = juengstes?.traktandumId ?? null;

	/*
	 * **Die Wand zeigt den Schritt, nicht den Sammelpunkt** (Auftraggeber, 24.08.2026):
	 * «Wenn Traktandum 2.1, muss in der Präsentationsansicht auch 2.1 angezeigt
	 * werden.»
	 *
	 * Vorher stand hier der Punkt der obersten Ebene — «2 Wahl der
	 * Stimmenzähler» —, während die Steuerung längst 2.1 führte. Im Saal ruft
	 * die Sitzungsleitung «2.1» auf, und an der Wand stand «2»: zwei Nummern für
	 * dieselbe Sache, und das Protokoll trägt die dritte.
	 *
	 * `abendschritte` liefert dieselbe Folge, durch die auch die Steuerung geht —
	 * mit dem **Titel des Punktes** und dem Namen der Gemeinschaft daneben. Die
	 * Unterzeile selbst trägt als Titel den Gemeinschaftsnamen; wer sie nähme,
	 * schriebe «MEG Nirgendweg 3-13a» an die Wand statt «Sanierung der
	 * Einfahrt».
	 *
	 * Ohne die angehängten Anträge (Rückkommen und Folgeantrag), die die
	 * Steuerung seit dem 25.09.2026
	 * mitgibt: Ein aufgerufener Antrag steht in keinem Schritt und kommt über
	 * den Rückfall `einzelpunkt` unten an die Wand, mit seiner Nummer, seinem
	 * Titel und seiner Gemeinschaft (gemessen in `e2e/abendschritte.mjs`).
	 */
	const schritte = abendschritte(liste, stelltBeschlussfaehigkeitFest);
	const punkt = laufendesTraktandum
		? (schritte.find((z) => z.traktanden.some((t) => t.traktandumId === laufendesTraktandum)) ?? null)
		: null;

	/*
	 * **Was nicht in der gemeinsamen Liste steht, gehört trotzdem an die Wand**
	 * (Code-Review 24.08.2026, Befund 4).
	 *
	 * `holeGemeinsameListe` liest nur Traktanden mit `business_id` — ein
	 * Spontantraktandum oder ein von Hand ergänzter Punkt hat keine. Wird eines
	 * davon in der Leitung eines Hauses aufgerufen, fand die Wand keinen Punkt,
	 * hielt das für einen Widerspruch und lud neu. Und wieder: Die Lage nach dem
	 * Neuladen war dieselbe. Statt des Ordnungsantrags blinkte die Leinwand im
	 * Sekundentakt.
	 *
	 * Deshalb der Rückfall auf das Traktandum des Hauses, das es aufgerufen hat.
	 * Es gehört dann nur dieser einen Gemeinschaft — was die Zeile darunter
	 * sagt.
	 */
	let einzelpunkt: {
		nummer: string;
		titel: string;
		antragswortlaut: string | null;
		art: string;
		gemeinschaft: string;
	} | null = null;
	if (!punkt && laufendesTraktandum) {
		for (const h of haeuser) {
			const traktanden = await holeTraktanden(op, h.versammlungId);
			const t = traktanden.find((x) => x.knoten.id === laufendesTraktandum);
			if (t) {
				einzelpunkt = {
					nummer: t.nummer,
					titel: t.knoten.titel,
					antragswortlaut: t.knoten.antragswortlaut ?? null,
					art: t.knoten.art,
					gemeinschaft: h.name
				};
				break;
			}
		}
	}

	/**
	 * Welches Traktandum jedes Haus im laufenden Schritt hat.
	 *
	 * **Wozu.** Die Abstimmungskachel je Haus darf nur zeigen, was zu DIESEM
	 * Punkt gehört. Der Strom trägt je Haus den offenen oder zuletzt
	 * geschlossenen Durchgang; ein Haus, das schon weiter ist, brächte sonst das
	 * Ergebnis eines anderen Punktes an die gemeinsame Wand.
	 *
	 * Beim gefundenen Schritt stehen die Traktanden dort; beim Rückfall auf ein
	 * Traktandum ausserhalb der gemeinsamen Liste (Spontantraktandum) gehört es
	 * genau einem Haus — dem, das es aufgerufen hat.
	 */
	const traktandumJeHaus = new Map<string, string>();
	if (punkt) {
		for (const t of punkt.traktanden) traktandumJeHaus.set(t.meetingId, t.traktandumId);
	} else if (laufendesTraktandum) {
		const eigner = aufgerufene.findIndex((a) => a.traktandumId === laufendesTraktandum);
		if (eigner >= 0) traktandumJeHaus.set(haeuser[eigner].versammlungId, laufendesTraktandum);
	}

	/*
	 * **Pause und Wandbild mit ihrem Text** (Code-Review 24.08.2026, Befund 5).
	 *
	 * Der Strom trägt nur Marken (`traktanden@2026-…`), keine Texte — er ist
	 * ausdrücklich der Weg für Zahlen und Kennungen. Die Wand holt die Worte
	 * deshalb hier und lädt neu, wenn die Marke wechselt; dasselbe Muster wie
	 * die Wand einer einzelnen Versammlung.
	 *
	 * **Einheitlich über alle Häuser**: Eine halbe Pause gibt es im Saal nicht.
	 * Unterbrochen ist die Wand, sobald ein LAUFENDES Haus unterbrochen ist — das
	 * ist die vorsichtige Richtung und stimmt mit der Wirkung überein: Dort kann
	 * gerade niemand abstimmen.
	 *
	 * **Warum nur laufende** (01.09.2026): `paused_at` bleibt beim Schliessen
	 * stehen, nichts löscht ihn. Ein Haus, das unterbrochen geschlossen wurde,
	 * hätte die Wand für den Rest des Abends verdunkelt, und lösen liesse sich
	 * das nicht: `setzePause` verlangt den Zustand «laufend». Gerechnet wird
	 * deshalb wie in der Sitzungsleitung, mit derselben Funktion.
	 */
	const staende = await Promise.all(
		haeuser.map(async (h) => (await holeVersammlung(op, h.versammlungId)) ?? null)
	);
	const pause = gemeinsamePause(
		staende.map((v) => ({ zustand: v?.zustand, pause: v?.pause }))
	).pause;
	const wandbildarten = new Set(staende.map((v) => v?.wandbild?.art ?? 'traktanden'));
	const wandbild =
		wandbildarten.size === 1 ? (staende.map((v) => v?.wandbild).find((w) => w) ?? null) : null;

	/**
	 * Die Kurznamen der Häuser — ohne Klammerzusätze, solange sie unterscheidbar
	 * bleiben. Sie stehen hier oben, weil sowohl der Feststellungssatz als auch
	 * die Kacheln sie brauchen.
	 */
	const kurz = kurznamen(haeuser.map((h) => h.name));

	/**
	 * Die festgehaltene Beschlussfähigkeit — als Satz, wie ihn die
	 * Sitzungsleitung nach dem Knopfdruck liest.
	 *
	 * **Der Anlass** (Auftraggeber, 25.08.2026): «Wenn Beschlussfähigkeit festgehalten
	 * wird, also mit dem Button auf Sitzungsleitung, soll dies an der Sitzung
	 * entsprechend am Monitor angezeigt werden. In Form von Alle STWEG und MEG
	 * sind beschlussfähig oder so ähnlich.»
	 *
	 * **Der Unterschied zu den Zahlen darunter.** Die Kacheln und die Fusszeile
	 * zeigen den **laufenden** Stand — er ändert sich, sobald jemand kommt oder
	 * geht. Was hier steht, ist der **festgehaltene** Befund: eine Zeile in
	 * `quorum_finding`, mit Zeitpunkt, die das Protokoll trägt und auf die sich
	 * jeder Beschluss dieses Abends stützt. Deshalb steht die Uhrzeit dabei —
	 * ohne sie behauptete der Satz etwas über jetzt.
	 *
	 * **Dieselbe Funktion wie an der Sitzungsleitung** (`abendfeststellungssatz`):
	 * Zwei Fassungen desselben Satzes liefen sonst auseinander, und dann stünde
	 * an der Wand etwas anderes als auf dem Notebook, ohne dass jemand sagen
	 * könnte, welche gilt.
	 *
	 * **«Gemeinschaften», nicht «STWEG und MEG»**: Die Anwendung führt keine
	 * Rechtsform je Gemeinschaft — `stweg` kennt nur `parent_stweg_id`. Ein Satz
	 * mit «STWEG» wäre für eine MEG schlicht falsch, und geraten wird hier
	 * nichts.
	 */
	const feststellungen = await Promise.all(
		haeuser.map(async (h, i) => {
			const alle = await holeFeststellungen(op, h.versammlungId);
			const letzte = alle.at(-1);
			return letzte
				? {
						gemeinschaft: kurz[i],
						beschlussfaehig: letzte.beschlussfaehig,
						kopfstimmen: `${letzte.kopfstimmenAnwesend} von ${letzte.kopfstimmenGesamt}`,
						wertquoten: `${letzte.quotenAnwesend} von ${letzte.gesamtquote}`,
						fehlt: letzte.fehlt,
						zeitpunkt: letzte.zeitpunkt
					}
				: null;
		})
	);
	const befunde = feststellungen.filter((f) => f !== null);
	const feststellung =
		befunde.length > 0
			? {
					satz: abendfeststellungssatz(befunde),
					/*
					 * Die Uhrzeit der jüngsten Feststellung. Am Abend entstehen sie in
					 * einem Zug, aber ein Haus kann nachgereicht werden — dann gilt für
					 * die Wand die jüngste, und wer genau hinsieht, liest im Protokoll
					 * die einzelnen.
					 */
					wann: befunde
						.map((b) => b.zeitpunkt.toISOString())
						.sort()
						.at(-1)!,
					/** Ob überhaupt alle Häuser des Abends festgestellt sind. */
					vollstaendig: befunde.length === haeuser.length
				}
			: null;

	/*
	 * **Ein Code für den Abend** (Auftraggeber, 24.08.2026): «Es ist wenig komfortabel,
	 * wenn man zwei QR hat und einen davon abschiessen will. Darum ein QR, die
	 * öffnet dann eine Hilfsseite, bei dem man dann die richtige STWEG auswählen
	 * kann.»
	 *
	 * Zuerst stand je Gemeinschaft einer da — das Saalmerkmal führt in EINE
	 * Versammlung, und der falsche Code wäre die falsche Anmeldung. Die Lösung
	 * liegt nicht in mehr Codes, sondern in einer Frage danach: Der Abend-Code
	 * öffnet die Hausauswahl, und von dort geht es auf den bekannten Weg.
	 *
	 * **Die Saalmerkmale der Häuser entstehen trotzdem hier.** Die Auswahl
	 * leitet auf sie weiter; gäbe es sie nicht, liefe der Weg ins Leere, sobald
	 * der Monitor eines Hauses nie geöffnet wurde.
	 */
	const laufende = haeuser.filter((_, i) => staende[i]?.zustand === 'laufend');
	for (const h of laufende) await holeOderErzeugeSaalmerkmal(op, h.versammlungId);

	const abendmerkmal = laufende.length > 0 ? await holeOderErzeugeAbendmerkmal(op, params.id) : null;
	const einstiegSvg = abendmerkmal
		? await QRCode.toString(`${herkunft(url)}/e/tag/${abendmerkmal}`, {
				type: 'svg',
				errorCorrectionLevel: 'M',
				margin: 1
			})
		: null;

	/*
	 * **Wie gross die Beschlussfähigkeit an der Wand steht** (Auftraggeber, 24.08.2026).
	 *
	 * «Die Sicht Beschlussfähigkeit braucht es nicht in dieser Grösse auf dem
	 * Monitor. […] Das Pflichttraktandum Feststellung der Beschlussfähigkeit
	 * braucht die Sicht, um zu sehen, ob man beschlussfähig ist.»
	 *
	 * Zwei Zustände statt einer Dauergrösse: Beim Punkt, der sie zum Gegenstand
	 * hat, füllen die Balken die Wand; sonst steht je Haus eine Zeile mit den
	 * Zahlen. Der Punkt bleibt der Punkt — die Zahlen daneben sind die
	 * Voraussetzung, nicht die Sache.
	 */
	const titelDesPunktes = punkt?.titel ?? einzelpunkt?.titel ?? null;
	const beschlussfaehigkeitImVordergrund = titelDesPunktes
		? stelltBeschlussfaehigkeitFest(titelDesPunktes)
		: false;


	return {
		tag: { id: tag.id, bezeichnung: tag.bezeichnung, datum: tag.datum, ort: tag.ort },
		beschlussfaehigkeitImVordergrund,
		feststellung,
		einstiegSvg,
		pause: pause ? { seit: pause.seit, text: pause.text ?? null } : null,
		/*
		 * **Mit dem Änderungszeitpunkt** (Code-Review 09.09.2026). Die Wand
		 * vergleicht ihre Marke mit der aus dem Strom, und die trägt seit jeher
		 * `art@zeitstempel` (`wandbildmarke` in `versammlungsstand.ts`). Ohne den
		 * Zeitpunkt hier liesse sich nur die Art vergleichen — eine reine
		 * Textänderung am Wandbild käme an der gemeinsamen Wand nie an, während
		 * die Wand des einzelnen Hauses sie zeigt.
		 */
		wandbild: wandbild
			? { art: wandbild.art, text: wandbild.text ?? null, geaendertAm: wandbild.geaendertAm ?? null }
			: null,
		haeuser: haeuser.map((h, i) => ({
			meetingId: h.versammlungId,
			gemeinschaft: h.name,
			/** Ohne Klammerzusätze — solange die Häuser unterscheidbar bleiben. */
			kurz: kurz[i],
			/**
			 * Das Traktandum dieses Hauses im laufenden Schritt — null, wenn es an
			 * ihm nicht beteiligt ist.
			 *
			 * **Wozu.** Die Abstimmungskachel darf nur zeigen, was zu DIESEM Punkt
			 * gehört. Der Strom trägt je Haus den offenen oder zuletzt
			 * geschlossenen Durchgang; ein Haus, das schon weiter ist, brächte
			 * sonst das Ergebnis eines anderen Punktes an die gemeinsame Wand.
			 */
			traktandumImSchritt: traktandumJeHaus.get(h.versammlungId) ?? null
		})),
		einzelpunkt,
		/**
		 * Der Punkt, den der Server beim Laden für den laufenden hielt — die
		 * Vergleichsgrösse für das Neuladen.
		 *
		 * **Aus dem Zustand, nicht aus dem gefundenen Schritt**: Die Traktanden
		 * eines Geschäfts sind mehr als die gerade aufgerufenen (ein Haus kann
		 * weiter sein). Wer beides vergleicht, findet immer einen Unterschied und
		 * lädt endlos neu — dieselbe Schleife, nur an anderer Stelle.
		 *
		 * **Eine Kennung, nicht mehr die Menge aller laufenden** (25.08.2026): Die
		 * Menge bleibt gleich, wenn die Sitzungsleitung von 2.2 auf 2.1
		 * zurückspringt — beide Häuser stehen ja weiter auf je einem Punkt. Die
		 * Wand hätte den Rücksprung nie bemerkt.
		 */
		laufendesTraktandum: laufendesTraktandum,
		punkt: punkt
			? {
					nummer: punkt.nummer,
					titel: punkt.titel,
					/** Wessen Punkt gerade läuft — leer, wenn er allen gehört. */
					gemeinschaft: punkt.gemeinschaft
						? (kurznamen(haeuser.map((h) => h.name))[
								haeuser.findIndex((h) => h.name === punkt.gemeinschaft)
							] ?? punkt.gemeinschaft)
						: null,
					antragswortlaut: punkt.antragswortlaut,
					art: punkt.punktart,
					/**
					 * Alle Traktanden des Geschäfts — nicht nur die der obersten Zeile.
					 * Der Sammelpunkt trägt selbst keine; gebraucht werden sie, um zu
					 * erkennen, wann der Saal weiterzieht und die Wand neu laden muss.
					 */
					traktanden: liste
						.filter((z) => z.geschaeftId === punkt.geschaeftId)
						.flatMap((z) => z.traktanden)
				}
			: null,
		/** Die Liste für die Wand, solange kein Punkt läuft. */
		punkte: liste
			.filter((z) => z.tiefe === 1)
			.map((z) => ({ nummer: z.nummer, titel: z.titel }))
	};
};
