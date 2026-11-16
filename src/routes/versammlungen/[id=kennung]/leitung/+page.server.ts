import { lesartKartensatz, stichentscheidGrenzeKartensatz } from '$lib/domain/auszaehlung';
import { fondsgrenzeKartensatz } from '$lib/domain/fondsgrenze';
import type { EinstimmigkeitImSaal } from '$lib/domain/entscheidbaum';
import { error, fail } from '@sveltejs/kit';
import {
	abschlussOhneBeschluss,
	entscheidetDasGeschaeft,
	KONSULTATIV_OFFEN,
	KONSULTATIV_OFFEN_NEU
} from '$lib/domain/konsultativ';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	angehoerigenhinweis,
	angehoerigenlesartHinweis,
	ausstandsmeldung,
	vertreterausstandsmeldung,
	beschlussGilt,
	betroffenenmeldung,
	ergebnisInWorten,
	ergebnislage,
	summenhindernis,
	summenvermerkNoetig
} from '$lib/domain/auszaehlung';
import {
	durchAnderesTraktandumErsetzt,
	fortschrittInWorten,
	massgebender,
	massgebenderDerSache,
	teilentschiedenSatz
} from '$lib/domain/abstimmung';
import { naechsterPunkt } from '$lib/domain/traktandenbaum';
import {
	feststellungssatz,
	satzZumEinzigen,
	stelleBeschlussfaehigkeitFest
} from '$lib/domain/beschlussfaehigkeit';
import { halteBeschlussfaehigkeitFest, holeFeststellungen, quorumEinerErstenErreicht } from '$lib/server/beschlussfaehigkeit';
import { holeErfassungsstand } from '$lib/server/erfassungsliste';
import { text } from '$lib/server/formular';
import { fragtNachPapier, vertagtMeldung } from '$lib/domain/versammlung';
import { einlassaktionen, papiervermerkAusFormular } from '$lib/server/einlassaktionen';
import { abendSperrt, holeTagDerVersammlung } from '$lib/server/versammlungstag';
import { holeNotizen, setzeProtokollnotiz } from '$lib/server/protokoll';
import {
	aenderePendenz,
	entfernePendenz,
	erfassePendenz,
	holePendenzen,
	setzePendenzzustand
} from '$lib/server/pendenz';
import { fristSatz, ZUSTANDSWORT } from '$lib/domain/pendenz';
import { entferneRuege, erfasseRuege, holeRuegen } from '$lib/server/ruege';
import { holeAnwesenheitsregeln, holeReglementsregeln } from '$lib/server/reglement';
import { enthaltungseinstellungVon } from '$lib/domain/reglement';
import { holeAbendgeschwister } from '$lib/server/uebersicht';
import {
	erklaereAusstand,
	holeAusstand,
	holeVertreterOhnePartei,
	nimmAusstandZurueck
} from '$lib/server/ausstand';
import {
	holeBetroffene,
	nimmVorabZustimmungZurueck,
	beklagtenumfangMeldung,
	setzeBeklagtenumfang,
	trageBetroffeneAus,
	trageBetroffeneEin,
	vermerkeVorabZustimmung
} from '$lib/server/betroffene';
import { erfasseVeto, holeVeto } from '$lib/server/veto';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import {
	holeVersammlung,
	schliesseVersammlung,
	setzePause,
	setzeWandbild,
	stelleAufTraktandum,
	vertageVersammlung
} from '$lib/server/versammlungen';
import { datumLang } from '$lib/domain/datum';
import { kiEingerichtet } from '$lib/server/ki';
import { haltAntragsentscheidFest, pruefeAntrag } from '$lib/server/antragspruefung';
import { verfuegbarkeit, verlangeEntscheid } from '$lib/domain/ki';
import type { Wandbildart } from '$lib/domain/versammlung';
import {
	betroffenenlage,
	bezeichnungMitBasis,
	einspracheZaehlweiseHinweis
} from '$lib/domain/entscheidbaum';
import { stimmrechtBeiNutzniessung } from '$lib/domain/nutzniessung';
import {
	juengsterRueckkommensantrag,
	rueckkommensauskunft,
	folgeantragBleibtHinweis,
	geltendNachNeuabstimmung,
	rueckkommenWirktNoch,
	standDesRueckkommensantrags,
	ohneBeschlussNachRueckkommen,
	rueckkommenOhneBeschlussNach,
	ohneAnnahmeNachQuorum,
	ohneAnnahmeNachQuorumNach,
	grundOhneBeschluss
} from '$lib/domain/rueckkommen';
import {
	betroffenenabweichung,
	fragtNachBetroffenenabweichung,
	erfordernisabweichung,
	lageZumGrundantrag,
	reihenfolgehinweisNachEroeffnen
} from '$lib/domain/folgeantrag';
import { ersetzungInKuerze } from '$lib/domain/folgeantragsersetzung';
import { ersetzungslage } from '$lib/server/auswertung';
import { holeRegelwerkFuerAnzeige, knotenDerFassung } from '$lib/rules';
import {
	verwaltungssaetzeVorDemEroeffnen,
	verwaltungsangabeAnzeige,
	VERWALTUNGSANGABE_GEMACHT,
	VERWALTUNGSANGABE_ZURUECK,
	AUSSTAND_NICHT_GEERBT,
	ausstandssaetzeVorDemEroeffnen,
	einstimmigkeitAusReglement,
	neuAnZweiterHinweis,
	zirkularbeschlusshinweis
} from '$lib/domain/mehrhinweise';
import { nimmImSaalAuf } from '$lib/server/saalaufnahme';
import {
	gibVerwaltungsangabe,
	holeVerwaltungsangabelage,
	nimmVerwaltungsangabeZurueck
} from '$lib/server/verwaltungsangabe';
import { verwaltungsangabeImSaal } from '$lib/domain/verwaltungsangabe';
import { holeEinladungsmehrJeTraktandum, holeSaalhinweiseNachMilderung } from '$lib/server/einladungsmehr';
import {
	holeNeueTraktandenDerZweiten,
	holeTraktanden,
	waehlbareErfordernisseAmHaus,
	nimmTraktandumAuf,
	haltErfordernisAmTraktandumFest,
	setzeGewaehltesErfordernis,
	stelleRueckkommensantrag,
	verschiebeTraktandum,
	nimmRueckzugZurueck,
	ziehAntragZurueck,
	holeOffeneFolgeantraege
} from '$lib/server/traktanden';
import { bestaetigeAnwesenheit, holeUebersicht, lehneAnmeldungAb } from '$lib/server/anwesenheit';
import {
	holeOffeneSaalmeldungen,
	lehneSaalmeldungAb,
	ordneSaalmeldungZu
} from '$lib/server/saaleinstieg';
import { holeMomentaufnahme } from '$lib/server/freigabe';
import { holeLesarten } from '$lib/server/lesarten';
import {
	haltWiderspruchFest,
	holeUniversalansicht,
	holeWidersprueche,
	setzeLeitungsvertreter
} from '$lib/server/universal';
import {
	empfehlungUniversal,
	reglementGestattet,
	UNIVERSAL_KENNTNIS,
	UNIVERSAL_FRUEHERER_BESCHLUSS,
	nachWiderspruchSatz,
	durchgangWiederEroeffenbar,
	universalbestaetigung,
	universalgruende
} from '$lib/domain/ausnahmen';
import {
	einwandLageDesErfordernisses,
	haltBeschlussVonHandFest,
	haltBeschlusstextFest,
	haltStichentscheidFest,
	erfasseSummen,
	gibStimmenAb,
	holeDurchgaenge,
	holeErgebnis,
	holeFolgeantragsbeschluesse,
	holeFortschritt,
	holeStimmsperren,
	holeVonHandVorschau,
	oeffneAbstimmung,
	holeBeschlussfaehigkeitOhneAusstand,
	holeVerwaltungsausstand,
	holeAusstandAmGrundantrag,
	holeTeilentschieden,
	holeVerwaltungsvollmachtenLage,
	holeKonsultativMoeglich,
	schliesseAbstimmung,
	brecheAbstimmungAb,
	setzeNeuabstimmungAn,
	holeMehrheitsvorschau,
	holeZuordnung,
	holeDirektNachQuorumLage,
	holeEinspracheZaehlung,
	warVersammlungZeitweiseBeschlussfaehig
} from '$lib/server/abstimmung';
import {
	eingabeAusFormular,
	quittungVonHand,
	ueberholtInWorten,
	vonHandStandSatz
} from '$lib/domain/vonhand';
import { verkuendeStand } from '$lib/server/versammlungsstand';
import type { Actions, PageServerLoad } from './$types';
import type { VoteChoice } from '$lib/domain/types';
import { holeBetreiber } from '$lib/server/betreiber';

/**
 * Die Steuerungssicht (Story 5.4, FR-34).
 *
 * Eine Seite für beide Geräte: Auf dem Telefon untereinander, auf dem Notebook
 * nebeneinander. Nicht zwei Sichten, weil zwei Sichten auseinanderlaufen — und
 * weil die Sitzungsleitung mitten in der Versammlung zwischen beiden wechselt,
 * je nachdem ob sie am Tisch sitzt oder im Raum steht.
 *
 * Sie liest denselben Stand, den auch Beamer und Telefone lesen (AD-10): Das
 * aufgerufene Traktandum ist ein Feld an der Versammlung, keine Angabe je
 * Sicht.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const versammlung = await holeVersammlung(op, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [
		gemeinschaft,
		traktanden,
		uebersicht,
		durchgaenge,
		momentaufnahme,
		saalmeldungen,
		anwesenheitsregeln,
		reglementsregeln
	] = await Promise.all([
		holeGemeinschaft(op, versammlung.stwegId),
		holeTraktanden(op, params.id),
		holeUebersicht(op, params.id),
		holeDurchgaenge(op, params.id),
		holeMomentaufnahme(op, params.id),
		holeOffeneSaalmeldungen(op, params.id),
		/*
		 * **Für die Feststellung im Saal** (Auftraggeber, 23.08.2026): «Beim
		 * Standardtraktandum Begrüssung und Feststellung der Beschlussfähigkeit
		 * fehlt in der Sicht ‹Aktuelles Geschäft› die Sicht, ob wir wirklich
		 * beschlussfähig sind.»
		 */
		holeAnwesenheitsregeln(op, versammlung.stwegId),
		holeReglementsregeln(op, versammlung.stwegId)
	]);
	// Die Untergrenze je Grundantrag für das Aufnahmeformular, gerechnet wie beim
	// Setzen (`setzeGewaehltesErfordernis`: erst das Reglement, dann der Vergleich).
	const einladungsmehr = await holeEinladungsmehrJeTraktandum(op, params.id, {
		regeln: reglementsregeln,
		enthaltung: enthaltungseinstellungVon(gemeinschaft),
		traktanden
	});
	// Die stehende Warnung nach einer Milderung (Produktentscheid 07.10.2026,
	// «Nur noch aufmerksam machen»); leer ausser in einer laufenden Versammlung.
	const saalhinweise = await holeSaalhinweiseNachMilderung(op, params.id);
	// Ä-17 B: Erreicht der Saal das Quorum einer ersten, ist die Frage ohne Folge.
	// Gerechnet mit der Übersicht und den Regeln, die dieser Load schon hat
	// (Codeprüfung 3d, L3), über dieselbe Funktion wie `erreichtQuorumEinerErsten`.
	const ersteErreicht = quorumEinerErstenErreicht(uebersicht, anwesenheitsregeln.erste ?? null);
	const neueAnZweiter =
		versammlung.stufe === 'zweite' && !ersteErreicht
			? await holeNeueTraktandenDerZweiten(op, params.id)
			: new Set<string>();
	// L5 aus derselben Quelle wie die Sperre beim Eröffnen (`holeLesartenIn`):
	// ab der Freigabe die Momentaufnahme (Migration 174).
	const neutraktandenwahl =
		neueAnZweiter.size > 0 ? (await holeLesarten(op, { meetingId: params.id })).L5 : null;

	/*
	 * **Der Weg zum Nachbarhaus** (Auftraggeber, 23.08.2026): «Wie kann ich beide
	 * gemeinsam führen?» Am gemeinsamen Abend tagt jede Gemeinschaft für sich —
	 * eine Leitung für beide zugleich gibt es bewusst nicht. Der Wechsel führte
	 * bisher über den Abend und die Tafel; im Saal sind das drei Klicks.
	 */
	const geschwister = await holeAbendgeschwister(op, params.id);
	// Gehört sie zu einem Abend, wird der Saal dort geführt — die Seite bietet
	// die Steuerung dann nur noch als Notweg an.
	const abendDazu = await holeTagDerVersammlung(op, params.id);
	/*
	 * **Die Universalversammlung im Moment** (Migration 128). Am Abend nicht:
	 * Dort ist das Aufnehmen gesperrt wie bei (a), und die Liste führt kein
	 * neues Geschäft.
	 */
	const universal = abendDazu ? null : await holeUniversalansicht(op, params.id);
	/*
	 * Je Geschäft, vor oder nach dem Eröffnen (Migration 129). Dieselbe
	 * Lesestelle wie `fruehererWiderspruch` im Server; über alle Durchgänge,
	 * auch überholte (Codeprüfung Block 3, dritter Durchgang, M1).
	 */
	const widersprueche = await holeWidersprueche(op, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	/*
	 * **Wer bei Nutzniessung stimmt** (FR-22, letzter Punkt).
	 *
	 * Abgeleitet aus der **Geschäftsart** des am Traktandum festgehaltenen
	 * Erfordernisses und dem in der Momentaufnahme eingefrorenen Stand der
	 * Nutzniessung. Besteht eine Vereinbarung, entscheidet die Anwendung nicht —
	 * sie zeigt deren Wortlaut und überlässt die Zuordnung der Sitzungsleitung.
	 *
	 * Nur zum aufgerufenen Traktandum: Die Frage stellt sich, wenn abgestimmt
	 * wird, und eine Liste über alle Traktanden hinweg wäre im Saal Lärm.
	 */
	const nutzniessungen: { einheit: string; partei: string; satz: string; vonHand: boolean }[] = [];
	const aufgerufenes = traktanden.find((t) => t.knoten.id === versammlung.aktuellesTraktandumId);
	if (aufgerufenes && momentaufnahme) {
		for (const p of momentaufnahme.parties) {
			for (const e of p.units) {
				if (!e.nutzniessung) continue;
				const befund = stimmrechtBeiNutzniessung(
					e.nutzniessung,
					aufgerufenes.knoten.erfordernis?.geschaeftsart ?? null,
					aufgerufenes.knoten.erfordernis?.knotenId ?? null
				);
				nutzniessungen.push({
					einheit: e.label,
					partei: p.displayName,
					satz: befund.satz,
					vonHand: befund.vonHand
				});
			}
		}
	}

	/*
	 * Dazu die Traktanden, deren Beschluss ein Folgeantrag nach einem Rückkommen
	 * ersetzt hat (Migration 133). Sie haben keinen eigenen geltenden Durchgang
	 * mehr und sind doch entschieden; ohne sie stand am Grundantrag wieder
	 * «Abstimmung freigeben», und der Server wies es ab (Codeprüfung B1).
	 */
	const ersetzt = new Set(
		traktanden
			.filter((t) => durchAnderesTraktandumErsetzt(durchgaenge, t.knoten.id))
			.map((t) => t.knoten.id)
	);
	/*
	 * Ohne konsultative Durchgänge (H7, Teil D; Codeprüfung 14.10.2026, Befund
	 * 2): Nach ihnen ist das Geschäft offen. Wie auf der Seite und am Abend.
	 */
	const entschieden = new Set([
		...durchgaenge.filter((d) => entscheidetDasGeschaeft(d)).map((d) => d.traktandumId),
		...ersetzt
	]);
	/** Wo bisher nur konsultativ abgestimmt wurde; für den Satz beim Schliessen. */
	const nurKonsultativ = new Set(
		durchgaenge
			.filter((d) => !d.ueberholtAm && d.zustand === 'geschlossen' && d.konsultativ)
			.map((d) => d.traktandumId)
	);
	/*
	 * **Ob der geltende Beschluss eines ersetzten Traktandums angenommen ist**
	 * (Codeprüfung B2a, M-b). Er liegt am Folgeantrag. Ohne diese Angabe sagte
	 * der Hinweis beim Rückkommen «abgelehnt, einfaches Mehr», während der Server
	 * Wortlaut und Mehr nach dem Beschluss zum Folgeantrag setzt
	 * (`stelleRueckkommensantrag`, `massgebender_durchgang`).
	 */
	const sacheAngenommen = new Map<string, boolean>();
	for (const id of ersetzt) {
		const m = massgebenderDerSache(durchgaenge, id);
		if (m?.zustand !== 'geschlossen') continue;
		sacheAngenommen.set(
			id,
			(await holeErgebnis(op, params.id, m.id)).auszaehlung?.angenommen === true
		);
	}
	/*
	 * **Folgeanträge mit eigenem Beschluss neben dem Grundantrag** (Fachprüfung
	 * 08.10.2026, Frage 2): Mit dem neuen Beschluss zum Grundantrag fallen sie
	 * nicht weg. Für den Hinweis beim Rückkommen, derselbe Weg wie am Abend.
	 */
	const folgeantragsbeschluesse = await holeFolgeantragsbeschluesse(op, params.id, traktanden, durchgaenge);
	/*
	 * **Nach einem Weggang ohne Beschluss darf neu eröffnet werden** (Migration
	 * 128), dieselbe Regel wie in `oeffneAbstimmung`, das den Durchgang dann
	 * überholt. Nach einem Widerspruch nicht, dort sagt die Auskunft es. Nach
	 * einer konsultativen Abstimmung ebenfalls (Migration 158).
	 */
	const nachWeggang = new Set(
		durchgaenge
			.filter((d) => !d.ueberholtAm && durchgangWiederEroeffenbar(d))
			.map((d) => d.traktandumId)
	);

	/*
	 * **Je Traktandum der massgebende Durchgang samt Ergebnis — einmal geholt.**
	 *
	 * Gebraucht an drei Stellen: für die Ergebnisliste weiter unten, für die
	 * Marke an der Zeile und für den Stand eines Rückkommensantrags. Ob der
	 * angenommen ist, steht **am Durchgang** (seit 25.09.2026 beim Verkünden
	 * festgeschrieben) und wird hier nicht ein zweites Mal abgelegt; eine Kopie
	 * liefe ihm davon.
	 */
	const massgeblich = new Map<
		string,
		{
			durchgang: (typeof durchgaenge)[number];
			ergebnis: Awaited<ReturnType<typeof holeErgebnis>> | null;
		}
	>();
	for (const t of traktanden) {
		const m = massgebender(durchgaenge.filter((d) => d.traktandumId === t.knoten.id));
		if (!m) continue;
		const e = m.zustand === 'geschlossen' ? await holeErgebnis(op, params.id, m.id) : null;
		massgeblich.set(t.knoten.id, { durchgang: m, ergebnis: e });
	}

	/**
	 * Der **jüngste** Rückkommensantrag zu einem Geschäft.
	 *
	 * Nicht der erste: Seit ein erledigter Antrag einen zweiten Anlauf zulässt,
	 * kann es mehrere geben. Der Server nimmt beim Eröffnen ebenfalls den
	 * jüngsten (`oeffneAbstimmung`) — nähme die Seite den ältesten, zeigte sie
	 * einen Stand, nach dem nicht entschieden wird.
	 */
	/*
	 * **Die Rechnung steht im Kern** (`domain/rueckkommen.ts`, 24.08.2026). Sie
	 * stand hier — und die Steuerung des gemeinsamen Abends konnte sie nicht
	 * abschreiben, weil sie an `traktanden`, `durchgaenge` und `massgeblich`
	 * dieser Seite hing. Sie fragte deshalb gröber, und «Nochmals abstimmen» war
	 * dort versperrt, sobald irgendwann einmal ein Antrag gestellt worden war.
	 */
	const antraege = traktanden.map((x) => ({
		id: x.knoten.id,
		nummer: x.nummer,
		zielId: x.knoten.rueckkommenZielId ?? null,
		aufgenommenAm: x.knoten.aufgenommenAm ?? null
	}));

	/** Der massgebende Durchgang eines Antrags, so wie der Kern ihn liest. */
	const ueberDenAntrag = (antragId: string) => {
		const eintrag = massgeblich.get(antragId);
		if (!eintrag) return null;
		return {
			offen: eintrag.durchgang.zustand === 'offen',
			angenommen: eintrag.ergebnis?.auszaehlung?.angenommen ?? null
		};
	};

	const antragZu = (zielId: string) => {
		const a = juengsterRueckkommensantrag(antraege, zielId);
		return a ? (traktanden.find((x) => x.knoten.id === a.id) ?? null) : null;
	};

	const standDesAntrags = (antragId: string) =>
		standDesRueckkommensantrags(antragId, durchgaenge, ueberDenAntrag(antragId));

	function rueckkommenWirkt(zielId: string): boolean {
		const antrag = juengsterRueckkommensantrag(antraege, zielId);
		return antrag ? rueckkommenWirktNoch(standDesAntrags(antrag.id)) : false;
	}

	/*
	 * **Ob auf dieses Traktandum ein angenommenes, unverbrauchtes Rückkommen
	 * wartet** (Produktentscheid 30.09.2026). Dann darf ein Folgeantrag an die
	 * Stelle des alten Antrags treten; der Server fragt dasselbe
	 * (`rueckkommenOffenIn`). Bis dahin gab die Seite die Angabe nicht mit, und
	 * der Weg war in der Oberfläche nicht erreichbar (Codeprüfung B1).
	 */
	function rueckkommenOffen(zielId: string): boolean {
		if (!entschieden.has(zielId)) return false;
		const antrag = juengsterRueckkommensantrag(antraege, zielId);
		if (!antrag) return false;
		const s = standDesAntrags(antrag.id);
		return s.stand === 'angenommen' && !s.verbraucht;
	}

	/**
	 * Der Grundantrag eines Folgeantrags, wenn über ihn entschieden ist, sonst
	 * null. Dann trägt nur ein Rückkommen auf ihn den Durchgang über den
	 * Folgeantrag (`lageZumGrundantrag`, dieselbe Rechnung wie beim Eröffnen).
	 */
	function grundantragDesFolgeantrags(traktandumId: string) {
		const k = traktanden.find((t) => t.knoten.id === traktandumId)?.knoten;
		if (!k || k.spontanart !== 'folgeantrag' || !k.parentId) return null;
		const grund = traktanden.find((t) => t.knoten.id === k.parentId);
		if (!grund) return null;
		const lage = lageZumGrundantrag(durchgaenge, traktandumId, grund.knoten.id, (d) =>
			durchgangWiederEroeffenbar(d)
		);
		const geltendBei = traktanden.find((t) => t.knoten.id === lage.geltend?.traktandumId);
		return lage.entschieden
			? {
					id: grund.knoten.id,
					titel: grund.knoten.titel,
					eigenerDurchgang: lage.eigenerDurchgang,
					geltend:
						lage.geltend && geltendBei
							? { durchgang: lage.geltend.nummer, traktandum: geltendBei.nummer }
							: null,
					geltendId: lage.geltend?.id ?? null
				}
			: null;
	}

	const liste = traktanden.map((t) => ({
		id: t.knoten.id,
		nummer: t.nummer,
		tiefe: t.tiefe,
		titel: t.knoten.titel,
		art: t.knoten.art,
		antragswortlaut: t.knoten.antragswortlaut,
		hatErfordernis: t.knoten.erfordernis != null,
		erfordernis: t.knoten.erfordernis?.titel ?? null,
		spontan: t.knoten.spontan ?? false,
		spontanart: t.knoten.spontanart ?? null,
		/** Worauf sich ein nicht angekündigtes Geschäft stützt (Migrationen 127, 128). */
		ausnahme: t.knoten.ausnahme ?? null,
		hatGrundantrag: t.knoten.parentId !== null,
		genehmigungTraktandumId: t.knoten.genehmigungTraktandumId ?? null,
		rueckzug: t.knoten.rueckzug ?? null,
		/**
		 * Ob zu diesem Traktandum ein Rückkommensantrag **noch wirkt** — dann gibt
		 * es keinen zweiten daneben.
		 *
		 * **Nicht «es gab je einen»** (berichtigt am 20.08.2026). Bis dahin zählte
		 * jeder gestellte Antrag für immer, und nach einem abgelehnten oder einem
		 * verbrauchten Rückkommen liess sich nie wieder eines beantragen. Die
		 * Anwendung widersprach sich damit selbst: Die Absage am Geschäft nannte
		 * «einen neuen Rückkommensantrag» als Weg, und genau der war versperrt.
		 *
		 * Beschlüsse der Versammlung sind abänderbar, soweit sie keine
		 * Gestaltungswirkung entfalten und nicht bereits realisiert wurden
		 * (Rz. 202a ad Art. 712g); was die Sperre verhindern soll, sind
		 * zwei Anträge nebeneinander, nicht ein zweiter Anlauf.
		 */
		rueckkommenLaeuft: rueckkommenWirkt(t.knoten.id),
		/**
		 * Ob ein Folgeantrag den Beschluss nach einem Rückkommen ersetzt hat
		 * (Migration 133). Das Traktandum trägt dann kein eigenes Ergebnis mehr und
		 * ist doch entschieden; die Ergebnisliste allein sieht das nicht. Nur
		 * dieser Anteil: Entschieden ist auch, was ein eigenes Ergebnis trägt.
		 */
		ersetzt: ersetzt.has(t.knoten.id),
		/** Nur bei `ersetzt`: ob der geltende Beschluss, der zum Folgeantrag, angenommen ist. */
		sacheAngenommen: sacheAngenommen.get(t.knoten.id) ?? null,
		/** Ob ein Folgeantrag an die Stelle des alten Antrags treten darf (`rueckkommenOffen`). */
		rueckkommenOffen: rueckkommenOffen(t.knoten.id),
		/** Beim Folgeantrag: ob der Grundantrag entschieden ist; dann kein Rückkommen hier. */
		grundantragEntschieden: grundantragDesFolgeantrags(t.knoten.id) !== null,
		// Für den Folgeantrag: welchen Erfordernistyp der Grundantrag trägt, für
		// den Vergleich im Aufnahmeformular. Geerbt wird seit dem
		// Produktentscheid 08.10.2026 nichts mehr.
		erfordernisKnoten: t.knoten.erfordernis?.knotenId ?? '',
		erfordernisTyp: t.knoten.erfordernis?.typ ?? null,
		/*
		 * Für den Folgeantrag: das Mehr, das die Einladung für dieses Traktandum
		 * nennt, als Untergrenze im Aufnahmeformular (Codeprüfung 1 und
		 * Fachprüfung FP-3 vom 06.10.2026); `null` ohne Untergrenze.
		 */
		einladungsmehr: einladungsmehr.get(t.knoten.id) ?? null,
		/*
		 * Die stehende Warnung, wenn das Mehr nach der Freigabe milder gestellt
		 * wurde (Produktentscheid 07.10.2026, Punkt 4a), sonst `null`. Gezeigt im
		 * Baustein `Eingriffe`, solange das Traktandum nicht abgeschlossen ist.
		 */
		milderungshinweis: saalhinweise.get(t.knoten.id) ?? null,
		/*
		 * **Der Quorumstyp in Worten, mit seiner Bezugsgrösse** (Praxisfund
		 * 03.10.2026; Produktentscheid 08.10.2026): «Einfaches Mehr» stand
		 * nirgends beim Traktandum, nur der Fall und die Schwelle; und wo es
		 * stand, fehlte die Basis. Die Bezeichnung kommt aus der Fassung des
		 * Erfordernisses, nicht aus der heute geltenden.
		 */
		erfordernisBezeichnung: t.knoten.erfordernis
			? bezeichnungMitBasis(
					holeRegelwerkFuerAnzeige(t.knoten.erfordernis.fassung),
					t.knoten.erfordernis
				)
			: null,
		grundantragId: t.knoten.parentId,
		// Für den Folgeantrag: wer beim Grundantrag als betroffen eingetragen ist
		// (Block A3b), als Vorauswahl im Formular.
		betroffeneIds: t.knoten.betroffeneParteiIds ?? [],
		// Ob «Betroffene» unter «Jetzt möglich» steht, und ob sich eine
		// Vorab-Zustimmung vermerken lässt (Block A2). Dieselbe Kernfunktion
		// entscheidet am Server.
		betroffenenlage: betroffenenlage(t.knoten.erfordernis ?? null),
		// Ehegatte und Verwandte des Beklagten (27.09.2026), nur bei der Ausschlussklage.
		angehoerigenhinweis: angehoerigenhinweis(t.knoten.erfordernis ?? null),
		// Die Zahl der Angehörigen im Ausstand (E1, Block D; L10). Gezeigt wird
		// der Satz nur mit dem Ausstand einer nicht betroffenen Partei
		// (`Eingriffe.svelte`, `ausstandMitAngehoerigenergebnis`).
		angehoerigenlesartHinweis: angehoerigenlesartHinweis(t.knoten.erfordernis ?? null),
		/** Beim Grundantrag: der Hinweis auf Folgeanträge mit eigenem Beschluss, sonst `null`. */
		folgeantragHinweis: folgeantragBleibtHinweis(folgeantragsbeschluesse.get(t.knoten.id) ?? [])
	}));

	/*
	 * **Der Beschluss von Hand** (Plan 30.09.2026, Block 2). Nur bei laufender
	 * Versammlung und zu dem Traktandum, das gerade aufgerufen ist.
	 *
	 * **Am gemeinsamen Abend steht die Maske im Notweg-Kasten** der
	 * Einzelleitung (Block 2b, 01.10.2026). Die Lage wird deshalb auch dort
	 * geliefert; gezeichnet wird sie am Abend nur im Kasten, dessen Formular
	 * `notweg=ja` mitschickt wie die vier Formulare daneben. Ohne Abend bleibt
	 * sie unter «Jetzt möglich» an ihrem Ort.
	 *
	 * Die Vorschau fährt die Prüfungen des Eröffnens trocken
	 * (`holeVonHandVorschau`). Wo der Weg nicht geht (zurückgezogener Antrag),
	 * steht ihr Satz an der Maske statt des Formulars.
	 */
	let vonHand:
		| {
				moeglich: true;
				uebergangen: { kennung: string; satz: string }[];
				ueberholt: string[];
				/** Ein Durchgang ist offen: Der Ausweg «nichts festhalten» rät dann zum Falschen. */
				durchgangOffen: boolean;
				/** An diesem Traktandum steht schon ein Ergebnis (nicht: am Grundantrag der Sache). */
				ergebnisSteht: boolean;
				/**
				 * Welcher Anwesenheitsstand festgehalten wird, als Satz mit Zahlen
				 * (`vonHandStandSatz`, Block 6). `null` ohne Momentaufnahme.
				 */
				stand: string | null;
				/** Wo der Grund «Eingewendete Bestimmung» gilt, mit der Ausnahme der Zustimmung aller. */
				einwand: { einstimmigkeit: EinstimmigkeitImSaal | null } | null;
				parteien: { id: string; name: string; einheiten: { label: string; quote: number }[] }[];
		  }
		| { moeglich: false; satz: string }
		| null = null;
	// Vorher, jetzt, nachher — die drei Angaben, mit denen sich eine Sitzung
	// führen lässt, ohne die ganze Liste durchzusehen.
	const notizen = await holeNotizen(locals.benutzer.operatorId, params.id);
	const pendenzen = await holePendenzen(locals.benutzer.operatorId, params.id);
	const ruegen = await holeRuegen(locals.benutzer.operatorId, params.id);
	const stelle = liste.findIndex((t) => t.id === versammlung.aktuellesTraktandumId);
	const vorheriges = stelle > 0 ? liste[stelle - 1] : null;
	const aktuelles = stelle >= 0 ? liste[stelle] : null;

	// Die Füllung der Deklaration von oben: `aktuelles` entsteht erst hier.
	// Am gemeinsamen Abend ebenfalls (Block 2b); dort zeichnet die Seite sie
	// im Notweg-Kasten.
	if (versammlung.zustand === 'laufend' && aktuelles) {
		try {
			const vorschau = await holeVonHandVorschau(op, params.id, aktuelles.id);
			vonHand = {
				moeglich: true,
				uebergangen: vorschau.uebergangen,
				ueberholt: vorschau.ueberholt.map((u) => {
					const am = u.traktandumId ? liste.find((x) => x.id === u.traktandumId) : null;
					return ueberholtInWorten({
						...u,
						traktandum: am ? `${am.nummer} ${am.titel}` : null
					});
				}),
				durchgangOffen: vorschau.ueberholt.some((u) => u.offen),
				ergebnisSteht: vorschau.ueberholt.some((u) => !u.offen && !u.traktandumId),
				stand: vorschau.stand ? vonHandStandSatz(vorschau.stand) : null,
				// Wo der Grund «Eingewendete Bestimmung» gilt (Auftrag E2, `einwandLageAm`).
				einwand: ((e) => (e ? einwandLageDesErfordernisses(e) : null))(
					traktanden.find((x) => x.knoten.id === aktuelles.id)?.knoten.erfordernis
				),
				parteien: (momentaufnahme?.parties ?? []).map((p) => ({
					id: p.partyId,
					name: p.displayName,
					einheiten: p.units.map((u) => ({ label: u.label, quote: u.quota }))
				}))
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				vonHand = { moeglich: false, satz: fehler.message };
			} else {
				throw fehler;
			}
		}
	}
	/*
	 * **«Nachher» kommt aus dem Stand, nicht aus der Reihenfolge**
	 * (Bedienbarkeitsprüfung 05.09.2026, Befund 13). Die alte Fassung nahm ohne
	 * aufgerufenes Traktandum `liste[0]` und nannte nach «Aufruf zurücknehmen»
	 * wieder «1 Begrüssung», obwohl 1 behandelt und 2 angenommen war — zwei
	 * Aussagen über denselben Abend auf einem Bildschirm.
	 *
	 * Die Rechnung steht in `naechsterPunkt`, samt der Begründung, warum
	 * unbehandelte Punkte vor einem behandelten nicht mehr dran sind.
	 */
	const naechstes = naechsterPunkt(
		liste.map((t) => ({
			...t,
			behandelt: massgeblich.has(t.id) || t.ersetzt,
			aufgerufen: t.id === versammlung.aktuellesTraktandumId
		}))
	);

	const offen = durchgaenge.find((d) => d.zustand === 'offen') ?? null;
	const fortschritt = offen ? await holeFortschritt(op, params.id, offen.id) : null;

	/*
	 * **Die Beschlussfähigkeit im Augenblick** — dieselbe Rechnung wie die
	 * Feststellung weiter unten und wie das Tor beim Eröffnen. Sie
	 * unterscheidet in der Auskunft zur direkten Neuabstimmung, ob die
	 * Versammlung schon so weit ist.
	 */
	const beschlussfaehigkeit = uebersicht
		? stelleBeschlussfaehigkeitFest(
				versammlung.stufe,
				{
					eigentuemerGesamt: uebersicht.eigentuemerGesamt,
					eigentuemerAnwesend: uebersicht.eigentuemerAnwesend,
					kopfstimmenGesamt: uebersicht.kopfstimmenGesamt,
					kopfstimmenAnwesend: uebersicht.kopfstimmenAnwesend,
					gesamtquote: uebersicht.gesamtquote,
					quotenAnwesend: uebersicht.quotenAnwesend,
					einzigeParteiGemeinsam: uebersicht.einzigeParteiGemeinsam
				},
				anwesenheitsregeln[versammlung.stufe] ?? null
			)
		: null;

	/*
	 * **Was am aufgerufenen Geschäft gilt, wenn darüber schon abgestimmt wurde.**
	 *
	 * Gemeldet am 20.08.2026: Am behandelten Geschäft stand weiterhin
	 * «Abstimmung freigeben», und jeder Klick endete in derselben roten Absage —
	 * während der gestellte Rückkommensantrag unbemerkt als Traktandum am Ende
	 * der Liste wartete. Die Auskunft nennt jetzt den Stand **und** den nächsten
	 * Schritt; der Knopf verschwindet, wo er nicht trägt.
	 */
	let rueckkommen: {
		abstimmbar: boolean;
		satz: string;
		weg: ReturnType<typeof rueckkommensauskunft>['weg'];
		antragId: string | null;
		antragNummer: string | null;
	} | null = null;
	if (aktuelles && aktuelles.art === 'abstimmung') {
		const antrag = antragZu(aktuelles.id);
		const stand = antrag ? standDesAntrags(antrag.knoten.id) : null;
		/*
		 * **Beim Folgeantrag nach dem Grundantrag zählt das Rückkommen auf den
		 * Grundantrag** (Produktentscheid 30.09.2026), wie beim Eröffnen. Bis dahin
		 * hiess ein vorher aufgenommener Folgeantrag hier «abstimmbar», und der
		 * Server wies ihn ab (Codeprüfung B1).
		 */
		const zumGrund = grundantragDesFolgeantrags(aktuelles.id);
		const aufGrund = zumGrund ? antragZu(zumGrund.id) : null;
		const standAufGrund = aufGrund ? standDesAntrags(aufGrund.knoten.id) : null;
		const wegAntrag = zumGrund ? aufGrund : antrag;
		const widerspruch = widersprueche.get(aktuelles.id);
		/*
		 * **Der direkte Weg nach Eintritt der Beschlussfähigkeit** (Migration
		 * 139): Die Lagerechnung steht im Server, einmal für Tor und Anzeige.
		 * Am Widerspruch und am Folgeantrag nicht: Dort bleibt es beim
		 * bisherigen Weg.
		 */
		const direkt =
			widerspruch || zumGrund
				? null
				: await holeDirektNachQuorumLage(op, params.id, aktuelles.id);
		// Nach einem Rückkommen auf einen Beschluss bleibt dieser in Kraft
		// (Fachprüfung Block 4a, Stelle 6); sonst gibt es keinen.
		const vorher = massgeblich.get(aktuelles.id)?.ergebnis?.auszaehlung;
		const auskunft = widerspruch
			? {
					// Weder Rückkommen noch Neuabstimmung führen weiter (Codeprüfung
					// Block 3, zweiter Durchgang, F2). Mit Namen: Die Leitung muss
					// wissen, wer (Laienprüfung Runde 2, L14).
					abstimmbar: false,
					satz: `${nachWiderspruchSatz({
						name: widerspruch.name,
						am: widerspruch.am,
						vorDemEroeffnen: widerspruch.durchgangId === null
					})} ${
						beschlussGilt(vorher)
							? UNIVERSAL_FRUEHERER_BESCHLUSS
							: UNIVERSAL_KENNTNIS
					}`,
					weg: null
				}
			: zumGrund
				? rueckkommensauskunft({
						abgestimmt: entschieden.has(aktuelles.id),
						antrag:
							aufGrund && standAufGrund
								? {
										nummer: aufGrund.nummer,
										stand: standAufGrund.stand,
										verbraucht: standAufGrund.verbraucht,
										traegtOffenen: standAufGrund.traegtOffenen
									}
								: null,
						grundantrag: {
							titel: zumGrund.titel,
							eigenerDurchgang: zumGrund.eigenerDurchgang,
							geltend: zumGrund.geltend,
							folgeantragTitel: aktuelles.titel,
							// Für die Ansage vor dem Freigeben (Fachprüfung Runde 2, R2-1).
							geltendAngenommen: zumGrund.geltendId
								? (await holeErgebnis(op, params.id, zumGrund.geltendId)).auszaehlung?.angenommen ===
									true
								: true
						}
					})
				: rueckkommensauskunft({
			abgestimmt: entschieden.has(aktuelles.id) && !nachWeggang.has(aktuelles.id),
			antrag:
				antrag && stand
					? {
							nummer: antrag.nummer,
							stand: stand.stand,
							verbraucht: stand.verbraucht,
							traegtOffenen: stand.traegtOffenen,
							// Wo gerade abgestimmt wird, für den Satz dazu (Laienprüfung 5c).
							offenBei: offen ? (liste.find((x) => x.id === offen.traktandumId)?.nummer ?? null) : null
						}
					: null,
			geltenderDurchgang: (() => {
				const dazu = durchgaenge.filter((d) => d.traktandumId === aktuelles.id);
				return geltendNachNeuabstimmung(dazu, massgebender(dazu));
			})(),
			// Nur ohne Rückkommensantrag; die Auskunft liest es dort (Migration 139).
			direktNachQuorum: direkt
				? { nummer: direkt.nummer, beschlussfaehig: beschlussfaehigkeit?.beschlussfaehig ?? false }
				: null
		});
		/*
		 * **Am ersetzten Grundantrag zuerst, was geschah** (Plan Folgeantrag nach
		 * Rückkommen, Soll 6). Er trägt kein eigenes Ergebnis mehr, und ohne den
		 * Satz stünde dort nur, dass ein weiterer Durchgang ein Rückkommen braucht.
		 */
		const ersetztSatz = ersetzt.has(aktuelles.id)
			? await ersetzungslage(op, params.id, aktuelles.id, durchgaenge, traktanden)
			: null;
		rueckkommen = {
			...auskunft,
			satz: ersetztSatz ? `${ersetzungInKuerze(ersetztSatz)} ${auskunft.satz}` : auskunft.satz,
			antragId: wegAntrag?.knoten.id ?? null,
			antragNummer: wegAntrag?.nummer ?? null
		};
	}

	// Je Traktandum der massgebende Durchgang samt Ergebnis. Die Sitzungsleitung
	// sieht es nach dem Schliessen — vor der Freigabe nur sie (FR-40).
	/*
	 * Die Lage nach einem Rückkommen über einen Folgeantrag, je Traktandum einmal
	 * gerechnet (Plan Folgeantrag nach Rückkommen, Soll 6). Gebraucht für den
	 * Satz unter dem Ergebnis und für den Knopf der Neuabstimmung.
	 */
	const lagen = new Map(
		await Promise.all(
			liste.map(
				async (t) =>
					[t.id, await ersetzungslage(op, params.id, t.id, durchgaenge, traktanden)] as const
			)
		)
	);
	const ergebnisse = [];
	for (const t of liste) {
		const eintrag = massgeblich.get(t.id);
		if (!eintrag) continue;
		const { durchgang: m, ergebnis: e } = eintrag;
		const dazu = durchgaenge.filter((d) => d.traktandumId === t.id);
		ergebnisse.push({
			traktandumId: t.id,
			nummer: t.nummer,
			titel: t.titel,
			durchgangId: m.id,
			durchgang: m.nummer,
			zustand: m.zustand,
			/*
			 * Konsultativ (Migration 158): Das Geschäft ist danach offen, die
			 * Seite rechnet «entschieden» ohne ihn (`entscheidetDasGeschaeft`;
			 * H7, Teil D).
			 */
			konsultativ: m.konsultativ === true,
			verkuendet: m.verkuendetAm !== null,
			frueher: dazu.length - 1,
			/**
			 * Der Gleichstand, den das Reglement einer Person zuweist (Story 7.9),
			 * oder der Quotenstichentscheid über einer Handzählung. Solange er
			 * offen ist, gibt es kein Ergebnis zu verkünden.
			 */
			stichentscheidOffen: e?.auszaehlung?.stichentscheidOffen === true,
			stichentscheidArt: e?.auszaehlung?.stichentscheidArt ?? null,
			stichentscheid: m.stichentscheid,
			beschlusstext: m.beschlusstext,
			satz:
				e?.auszaehlung && m.erfordernis ? ergebnisInWorten(e.auszaehlung, m.erfordernis) : null,
			// Nach einem Rückkommen ohne Beschluss ist der frühere massgebend; ohne
			// diesen Satz läse sich sein Ergebnis wie das des eben geschlossenen
			// Durchgangs (Reste vom 30.09.2026, Punkt 1).
			/*
			 * Der Durchgang nach dem Rückkommen mit offenem Stichentscheid: Die
			 * Neuabstimmung gehört an ihn, nicht an den geltenden (Codeprüfung
			 * Reste, H1). Sonst überholte der Knopf den geltenden Beschluss.
			 */
			offenNachRueckkommen: await (async () => {
				/*
				 * Auch nach einem Folgeantrag, der statt des alten Antrags zur
				 * Abstimmung kam (Codeprüfung B2b, H1): Sein Durchgang liegt an einem
				 * anderen Traktandum, und der Knopf traf sonst den geltenden Beschluss
				 * hier. Ein Klick hob ihn auf, und das Rückkommen war verbraucht.
				 */
				/*
				 * An der Karte des Durchgangs, der dabei gilt, nicht an der Rolle: Nach
				 * einem zweiten Rückkommen liegt er an einem früheren Folgeantrag
				 * (Codeprüfung B2b, zweiter Durchgang, Befund 1).
				 */
				const stich = [...lagen.values()].find(
					(l) =>
						l?.fruehererDurchgangId === m.id &&
						l.ausgang === 'ohne_beschluss' &&
						l.grund === 'stichentscheid'
				);
				if (stich?.folgeDurchgangId) return stich.folgeDurchgangId;
				const ohne = rueckkommenOhneBeschlussNach(dazu, m);
				if (!ohne) {
					// Dasselbe nach Eintritt der Beschlussfähigkeit (Migration 139):
					// Der gescheiterte zweite Durchgang trägt den offenen
					// Stichentscheid, und die Neuabstimmung gehört an ihn.
					const quorum = ohneAnnahmeNachQuorumNach(dazu, m);
					if (!quorum) return null;
					const aq = (await holeErgebnis(op, params.id, quorum.id)).auszaehlung;
					return aq?.stichentscheidOffen ? quorum.id : null;
				}
				const a = (await holeErgebnis(op, params.id, ohne.id)).auszaehlung;
				return a?.stichentscheidOffen ? ohne.id : null;
			})(),
			nachRueckkommen: await (async () => {
				/*
				 * Nach einem Rückkommen über einen Folgeantrag: am Folgeantrag, woran
				 * er ersetzt; am Rückkommensantrag, worüber abgestimmt wurde; am
				 * Grundantrag, wenn über den Folgeantrag kein Beschluss zustande kam
				 * (Plan Folgeantrag nach Rückkommen, Soll 6).
				 */
				// Der Satz zum Rückkommen an diesem Traktandum selbst hat Vorrang:
				// Er gilt dem eben geschlossenen Durchgang (Codeprüfung B2b, M1).
				// Nur mit festem Ergebnis des geltenden: Sonst stimmte «Es bleibt beim
				// Beschluss» nicht (Codeprüfung Reste, N1).
				const lageGeltend = ergebnislage(e?.auszaehlung);
				const ohne = rueckkommenOhneBeschlussNach(dazu, m);
				if (ohne && (lageGeltend === 'angenommen' || lageGeltend === 'abgelehnt')) {
					return ohneBeschlussNachRueckkommen(
						ohne.nummer,
						m.nummer,
						lageGeltend === 'abgelehnt',
						grundOhneBeschluss((await holeErgebnis(op, params.id, ohne.id)).auszaehlung)
					);
				}
				// Nach Eintritt der Beschlussfähigkeit (Migration 139): Ohne diesen
				// Satz läse sich der frühere Beschluss wie das eben geschlossene
				// Ergebnis. Wortlaut wie im Protokoll.
				const ohneQuorum = ohneAnnahmeNachQuorumNach(dazu, m);
				if (ohneQuorum) {
					return ohneAnnahmeNachQuorum(
						ohneQuorum.nummer,
						m.nummer,
						ergebnislage((await holeErgebnis(op, params.id, ohneQuorum.id)).auszaehlung),
						lageGeltend === 'abgelehnt'
					);
				}
				const ers = lagen.get(t.id);
				return ers ? ersetzungInKuerze(ers) : null;
			})(),
			auszaehlung: e?.auszaehlung ?? null,
			/*
			 * **Am Geschäft, nicht am Durchgang** (Codeprüfung Block 4a, M-1). Nach
			 * einem Weggang und einem Widerspruch vor dem Neueröffnen trägt der
			 * Durchgang «weggang», und «Sind wieder alle da, können Sie neu
			 * eröffnen» samt Neuabstimmung führte in eine Absage.
			 */
			widersprochen: widersprueche.has(t.id)
		});
	}

	/*
	 * **Die Erfassungsliste kommt aus `erfassungsliste.ts`** (24.08.2026).
	 *
	 * Sie stand hier ausgeschrieben — sechzig Zeilen mit der Stimmkraft, den
	 * bisherigen Stimmen und den Sperren. Am Abend fehlte sie deshalb ganz («Mir
	 * fehlt, dass der Versammlungsleiter für die anderen abstimmen darf»).
	 * Dieselbe Rechnung an zwei Stellen wäre die Gelegenheit, dass die eine
	 * Sicht andere Parteien anbietet als die andere.
	 */
	const erfassungsstand = await holeErfassungsstand(op, params.id);

	// **Sichtbar deaktiviert statt fehlerhaft** (FR-62).
	const ki = verfuegbarkeit(
		{
			eingerichtet: await kiEingerichtet(locals.benutzer.operatorId),
			zugelassen: gemeinschaft?.aiEnabled ?? false,
			offline: false,
			ausgenommen: gemeinschaft?.aiDisabledFunctions ?? [],
			hinweiseAusblenden: (await holeBetreiber(locals.benutzer.operatorId))?.kiHinweiseAusblenden === true
		},
		'antragspruefung'
	);

	/*
	 * Vertagen als Rat beim Schliessen nur, wenn die Versammlung an diesem Abend
	 * nie beschlussfähig war (Schritt F2; Fachprüfung 03.11.2026, S1). War sie
	 * es, wird die Folgeversammlung eine neue erste (C3, F4c), und der Rat, eine
	 * zweite anzusetzen, stimmte nicht. Dieselbe Regel wie beim Vertagen selbst
	 * (`warZeitweiseBeschlussfaehig`); bis F4c zählte hier jeder verbindliche
	 * Durchgang, auch ein Beschluss von Hand ohne Beschlussfähigkeit.
	 */
	const feststellungenDesAbends = await holeFeststellungen(op, params.id);
	// Nur, wo vertagt werden kann: an einer laufenden ersten (Codeprüfung F4c
	// Block 2, zweiter Durchgang, 7). Sonst gilt sie als beschlussfähig gewesen,
	// was weder Rat noch Ausklapper zeigt.
	const zeitweiseBeschlussfaehig =
		versammlung.stufe === 'erste' && versammlung.zustand === 'laufend'
			? await warVersammlungZeitweiseBeschlussfaehig(op, params.id)
			: true;
	const nieBeschlussfaehig = !zeitweiseBeschlussfaehig;

	/*
	 * **L7, der Satz vor dem Eröffnen** (Migration 183), nur wo die
	 * Beschlussfähigkeit an den Personen im Ausstand hängt. Unter der Vorgabe
	 * «Zählt mit» sagt er der Leitung, dass der Beschluss angreifbar wäre und
	 * was ihn sicher macht. Unter «Zählt nicht mit» steht die Absage schon vor
	 * dem Klick, wie bei fehlender Beschlussfähigkeit und bei L5 (Codeprüfung
	 * Block 4, H1). Stufe und Wahl rechnet dieselbe Serverfunktion wie das
	 * Eröffnen (M3).
	 */
	const ohneAusstand = aktuelles
		? await holeBeschlussfaehigkeitOhneAusstand(
				op,
				params.id,
				{ tier: versammlung.stufe, stweg_id: versammlung.stwegId },
				aktuelles.id
			)
		: null;

	/*
	 * **L8, der Satz zu den Vollmachten der Verwaltung** (Migration 184), an
	 * einem Traktandum mit Häkchen, an dem die Verwaltung Vollmachten hält:
	 * Unter der Vorgabe sagt er, dass sie ruhen, ohne dass jemand den Ausstand
	 * erklärt; die Liste der ruhenden Vollmachten darüber nennt die
	 * Vertretenen. Unter «Die Sitzungsleitung entscheidet» sagt er, wie das
	 * Ruhen ausgelöst wird: über den erklärten Ausstand wie bisher.
	 */
	const verwaltungsvollmachten = aktuelles
		? await holeVerwaltungsvollmachtenLage(op, params.id, aktuelles.id)
		: null;
	// Entscheid 0045, Punkt 9 (beim Bau geklärt 07.11.2026): Ist unter dem
	// Häkchen ein Folgeantrag zur Wahl oder Abberufung entschieden, wird über
	// den Grundantrag nicht mehr abgestimmt; derselbe Satz wie die Absage.
	const teile = aktuelles ? await holeTeilentschieden(op, params.id, aktuelles.id) : [];
	const teilentschiedenHinweis = teile.length > 0 ? teilentschiedenSatz(teile) : null;
	// Laienprüfung Runde 5, R5-4 (Produktentscheid 07.11.2026): Ein Folgeantrag
	// übernimmt einen am Grundantrag erklärten Ausstand nicht.
	const ausstandAmGrundantrag = aktuelles ? await holeAusstandAmGrundantrag(op, params.id, aktuelles.id) : false;
	// Entscheid 0045, Punkt 11: am Folgeantrag mit Häkchen die Angabe der
	// Leitung (andere Verwaltung, Kündigung), gesetzt oder als Angebot; das
	// Angebot nur, wo der Satz zu den ruhenden Vollmachten steht.
	const verwaltungsangabe = aktuelles
		? verwaltungsangabeAnzeige(
				verwaltungsangabeImSaal(
					await holeVerwaltungsangabelage(op, params.id, aktuelles.id),
					verwaltungsvollmachten !== null
				)
			)
		: null;

	return {
		versammlung,
		verwaltungsangabe,
		ki,
		nutzniessungen,
		// Für den Ausklapper «Vertagen»: eine neue erste statt einer zweiten (C3, F4c).
		zeitweiseBeschlussfaehig,
		// Die Maske des Beschlusses von Hand, oder ihr Absagesatz, oder nichts.
		vonHand,
		/**
		 * Der gemeinsame Abend, wenn diese Versammlung zu einem gehört.
		 *
		 * Er entscheidet, ob die Seite die Steuerung anbietet: Aufrufen,
		 * Abstimmen, Pause und Wandbild werden am Abend für alle Gemeinschaften
		 * zugleich geführt (`docs/vererbung-abend.md`). Zwei Steuerungen für
		 * einen Saal laufen auseinander.
		 */
		abend: abendDazu ? { id: abendDazu.id, bezeichnung: abendDazu.bezeichnung } : null,
		// Die Fälle des Regelwerks für den Folgeantrag, der im Saal entsteht, mit
		// dem Typ am Haus: Gegen ihn vergleicht das Formular den Grundantrag
		// (Rest aus Lesarten Block 1, Befund 7).
		erfordernisse: await waehlbareErfordernisseAmHaus(op, {
			meetingId: params.id,
			stwegId: versammlung.stwegId
		}),
		/*
		 * Ob das Reglement Beschlüsse über nicht Angekündigtes gestattet, wie es
		 * bei der Freigabe stand (Migration 127). Die Fundstelle, sonst null.
		 *
		 * **Am gemeinsamen Abend nicht** (Codeprüfung 29.09.2026): Dort wird nur
		 * auf der Abendseite abgestimmt, und deren Liste führt kein neues
		 * Geschäft. Der Dialog böte eine Abstimmung an, die sich nicht eröffnen
		 * liesse.
		 */
		ausnahmeReglement: abendDazu ? null : reglementGestattet(momentaufnahme?.ausnahmen),
		// Auch bei «keine»: Dann nennt der Dialog den Grund (Codeprüfung Block 3, N-1).
		ausnahmeUniversal:
			universal
				? {
						variante: universal.einstellung.universalvariante,
						leitungsvollmachtenZaehlen: universal.einstellung.leitungsvollmachtenZaehlen,
						vollzaehlig: universal.befund.vollzaehlig,
						gruende: universalgruende({
							variante: universal.einstellung.universalvariante,
							befund: universal.befund,
							bestaetigt: true
						})
					}
				: null,
		/*
		 * Was die Leitung bei der Universalversammlung braucht: die Bestätigung
		 * vor dem Eröffnen, die Parteien für den Widerspruch und die Vertreter
		 * zum Ankreuzen (Runde 2, Stellen 3, 8 und 9).
		 */
		universal: universal
			? {
					variante: universal.einstellung.universalvariante,
					bestaetigung: universalbestaetigung(universal.einstellung, universal.befund),
					empfehlung:
						universal.einstellung.universalvariante === 'keine'
							? null
							: empfehlungUniversal(
									universal.einstellung.universalvariante,
									universal.einstellung.leitungsvollmachtenZaehlen
								),
					gruende: universalgruende({
						variante: universal.einstellung.universalvariante,
						befund: universal.befund,
						bestaetigt: true
					}),
					anwesende: universal.parteien
						.filter((p) => p.anwesend)
						.map((p) => ({ id: p.parteiId, name: p.name })),
					vertreter: universal.vertreter
				}
			: null,
		gemeinschaft,
		traktanden: liste,
		vorheriges,
		aktuelles,
		/**
		 * Was das aufgerufene Geschäft braucht, um durchzukommen (22.08.2026).
		 *
		 * **Vor der Abstimmung, nicht danach.** Bis dahin stand hier der Fallname
		 * des Erfordernisses — «Notwendige bauliche Massnahme» — und die Zahl kam
		 * erst mit dem Ergebnis. Im Prüflauf brauchte Traktandum 6 vier von fünf
		 * Ja-Stimmen; dass es aufging, lag an einer Vollmacht, und gemerkt hat es
		 * niemand, bis die Abstimmung vorbei war.
		 *
		 * Sie wird bei jedem Laden neu gerechnet, weil sie sich ändert: Wer
		 * dazukommt, verschiebt die Bezugsgrösse der anwesenheitsabhängigen
		 * Erfordernisse.
		 */
		/**
		 * Die Zuordnung, die «Abstimmung freigeben» bestätigt (Ä-05, M4): Satz
		 * über dem Knopf und Marke, die der Server beim Freigeben vergleicht.
		 */
		zuordnung:
			aktuelles && aktuelles.art === 'abstimmung'
				? await holeZuordnung(
						locals.benutzer.operatorId,
						params.id,
						aktuelles.id,
						traktanden.find((t) => t.knoten.id === aktuelles.id)?.knoten.erfordernis ?? null
					)
				: null,
		vorschau: aktuelles
			? await holeMehrheitsvorschau(
					locals.benutzer.operatorId,
					params.id,
					aktuelles.id,
					traktanden.find((t) => t.knoten.id === aktuelles.id)?.knoten.erfordernis ?? null
				)
			: null,
		/**
		 * Warnungen am Erfordernis des aufgerufenen Traktandums (Block 3, Ä-15
		 * und Ä-20; `domain/mehrhinweise.ts`). Der Satz zur zweiten Versammlung
		 * (Ä-11) steht hier nicht: Am Abend rechnet die Vorschau mit den
		 * Anwesenden (`erreichbarkeitshinweis`).
		 */
		mehrhinweise: (() => {
			// Entscheid 0045, Punkt 9 (Codeprüfung P9, G-4): Am gesperrten
			// Grundantrag steht nur der Satz zur Sperre; alle übrigen bereiten
			// eine Abstimmung vor, die nicht kommt.
			if (teilentschiedenHinweis) return [teilentschiedenHinweis];
			// Ä-17 B: vor dem Eröffnen, auch ohne gesetztes Erfordernis.
			// Die milde Wahl nur, wenn das Drittel erreicht ist; sonst gilt die
			// gewöhnliche Absage (Review DeepSeek zu Block 7, Befund 4).
			const neu =
				aktuelles &&
				neutraktandenwahl &&
				neueAnZweiter.has(aktuelles.id) &&
				(neutraktandenwahl === 'erste' || beschlussfaehigkeit?.beschlussfaehig === true)
					? [neuAnZweiterHinweis(neutraktandenwahl, true)]
					: [];
			// L7 (Migration 183): vor dem Eröffnen, auch ohne gesetztes
			// Erfordernis; nur wo die Beschlussfähigkeit an den Personen im
			// Ausstand hängt (`ausstandsbefund`).
			const ausstand = ausstandssaetzeVorDemEroeffnen(ohneAusstand);
			// L8 (Migration 184): der Satz zur Einstellung, je Wahl aus
			// derselben Serverfunktion wie das Eröffnen. Entscheid 8
			// (07.11.2026): Steht das Erfordernis nach der Freigabe auf der
			// Wahl oder Wiederwahl der Verwaltung, sagt der Satz, dass die
			// Vollmachten dort zählen, obwohl die Einladung das Gegenteil
			// angekündigt hat.
			const verwaltung = [
				...verwaltungssaetzeVorDemEroeffnen(verwaltungsvollmachten, teilentschiedenHinweis),
				...(ausstandAmGrundantrag ? [AUSSTAND_NICHT_GEERBT] : [])
			];
			const e = aktuelles
				? traktanden.find((t) => t.knoten.id === aktuelles.id)?.knoten.erfordernis
				: null;
			if (!e) return [...neu, ...ausstand, ...verwaltung];
			return [
				zirkularbeschlusshinweis(e, aktuelles ? einladungsmehr.has(aktuelles.id) : false),
				einstimmigkeitAusReglement(e, knotenDerFassung(e.fassung, e.knotenId)),
				// Zählweise der festgehaltenen Momentaufnahme, sonst der Gemeinschaft (19.10.2026);
				// ab der Fassung 2026-10-28 der Kartensatz L3.
				einspracheZaehlweiseHinweis(e, momentaufnahme?.headCountMode ?? gemeinschaft?.headCountMode),
				// Die Lesart der Gemeinschaft, wie sie am Erfordernis eingefroren ist (Migration 169).
				lesartKartensatz(e),
				// A5, Punkt 12b: Die hinterlegte Klausel gilt nicht an jedem Mehr;
				// das sagt die Leitung vor der Abstimmung (Rz. 99 ad Art. 712n).
				stichentscheidGrenzeKartensatz(e, momentaufnahme?.tieBreak ?? gemeinschaft?.tieBreak ?? 'keiner'),
				// Die Bestimmung zur Einlage in den Erneuerungsfonds (Migration 193), wie am Traktandum.
				fondsgrenzeKartensatz(e, gemeinschaft?.fondsgrenze),
				...neu,
				...ausstand,
				...verwaltung
			].filter((s): s is string => s !== null);
		})(),
		/**
		 * Was die Zeile der Vorschau in der Maske «Beschluss von Hand» nicht sagt
		 * (Fachprüfung Lauf B, Runde 4). Die Vorschau rechnet ohne Stimmen und
		 * zeigt deshalb die Höchstschwelle; zählen Enthaltungen nach Reglement
		 * nicht mit, liest die Leitung im Notweg sonst ein zu hohes Mehr
		 * (Rz. 186, 192a ad Art. 712m). Und die Zustimmung der Betroffenen prüft
		 * dieser Weg nicht (Rz. 164a).
		 */
		vonHandZusatz: (() => {
			const e = aktuelles
				? traktanden.find((t) => t.knoten.id === aktuelles.id)?.knoten.erfordernis
				: null;
			if (!e) return [] as string[];
			const zusatz: string[] = [];
			// Dieselbe Bedingung wie in der Auszählung (`enthaltungAusBasis`,
			// `quotenbasisWert`): Nur eine Basis der Anwesenden verliert die
			// Enthaltungen. «Kann sinken», weil eine Enthaltung die Schwelle
			// nicht immer verschiebt (5 und 4 brauchen beide 3).
			if (
				e.enthaltungZaehltMit === false &&
				(e.kopfbasis === 'anwesend_vertreten' ||
					(e.quotenSchwelle !== null && e.quotenbasis === 'anwesend_vertreten'))
			) {
				zusatz.push(
					'Enthaltungen fallen nach Reglement aus der Bezugsgrösse; die Zahl der Nötigen kann dadurch sinken.'
				);
			}
			if (e.zustimmungBetroffenerNoetig) {
				zusatz.push('Zusätzlich müssen die unmittelbar Betroffenen zustimmen.');
			}
			return zusatz;
		})(),
		/**
		 * Was zum aufgerufenen Traktandum notiert ist (FR-46).
		 *
		 * Hier und nicht nur auf der Protokollseite: Geschrieben wird, während
		 * gesprochen wird. Wer dafür die Seite wechseln muss, schreibt es nachher
		 * aus dem Gedächtnis — und das ist der Unterschied zwischen einem
		 * Protokoll und einer Erinnerung.
		 */
		notiz: aktuelles ? (notizen.get(aktuelles.id) ?? '') : '',
		/**
		 * Die Pendenzen des aufgerufenen Traktandums.
		 *
		 * Nur dieses eine, wie beim Votum darüber: Was an anderen Punkten
		 * offensteht, gehört auf die Liste der Gemeinschaft und nicht in die
		 * Maske, an der gerade gesprochen wird.
		 */
		pendenzen: aktuelles ? (pendenzen.get(aktuelles.id) ?? []) : [],
		// Die Rügen ebenso nur zum aktuellen Traktandum (Ä-06, Migration 160).
		ruegen: aktuelles ? (ruegen.get(aktuelles.id) ?? []) : [],
		naechstes,
		offen: offen
			? {
					id: offen.id,
					traktandumId: offen.traktandumId,
					nummer: offen.nummer,
					// Geheime Abstimmung (Migration 141): Die Leitung soll es während
					// der Abstimmung sehen — sie hat es beim Eröffnen verlangt.
					geheim: offen.geheim,
					// Konsultativ (Migration 158): Die Leitung sieht es, solange abgestimmt wird.
					konsultativ: offen.konsultativ,
					// Der Satz dazu nach dem Grund (Migration 174, L5).
					konsultativSatz: offen.konsultativNeu ? KONSULTATIV_OFFEN_NEU : KONSULTATIV_OFFEN,
					erfordernis: offen.erfordernis?.titel ?? '',
					fortschritt,
					fortschrittSatz: fortschritt ? fortschrittInWorten(fortschritt) : '',
					/** Unter der Universalversammlung: wer schon widersprochen hat (Migration 128). */
					universal: offen.universal
						? { widerspruch: widersprueche.get(offen.traktandumId)?.name ?? null }
						: null
				}
			: null,
		ergebnisse,
		/**
		 * Ob der Abend vorbei ist — und was ihm sonst noch fehlt (21.08.2026).
		 *
		 * «Wenn das letzte Traktandum durch ist, kann dort der Abschluss knopf
		 * kommen, damit die Sitzung beendet wird.» Bis dahin lag der Knopf auf der
		 * Versammlungsseite, einen Wechsel entfernt — im letzten Augenblick des
		 * Abends, wenn alle aufstehen.
		 *
		 * **Woran «durch» erkannt wird:** Das aufgerufene Traktandum ist das letzte
		 * der Liste, und keine Abstimmung ist offen. Das ist die Lage, in der die
		 * Sitzungsleitung «damit sind wir am Ende» sagt.
		 *
		 * **Nicht daran, dass über alles abgestimmt wurde.** Eine Kenntnisnahme
		 * kennt keinen Beschluss, ein zurückgezogener Antrag auch nicht, und ein
		 * übersprungenes Traktandum ist ein Entscheid der Versammlung. Wer das
		 * zählte, hielte die Leitung von ihrem eigenen Schluss ab.
		 *
		 * Die Zahl der unbehandelten Abstimmungen steht trotzdem dabei — nicht als
		 * Sperre, sondern als letzte Nachfrage: «2 Anträge ohne Beschluss» ist im
		 * Saal die eine Sache, die man vor dem Schluss hören will.
		 */
		abschluss: {
			/*
			 * **Die eigene Rechnung, nicht die von `naechstes`** (Code-Review
			 * 06.09.2026). Seit «nachher» aus dem Stand kommt statt aus der
			 * Reihenfolge, ist `naechstes === null` etwas anderes als «das
			 * aufgerufene ist das letzte»: Ruft die Leitung für einen zweiten
			 * Durchgang ein Traktandum auf, das **vor** einem angenommenen
			 * Rückkommensantrag steht, ist alles danach behandelt — und hier
			 * stünde «Alle Traktanden behandelt» samt dem Knopf, der die
			 * Versammlung unwiderruflich schliesst.
			 */
			amEnde: stelle >= 0 && stelle === liste.length - 1 && offen === null,
			// Ohne Abstimmung: «wurde nicht abgestimmt». Nur konsultativ abgestimmt
			// zählt eigens, der Satz wäre dort falsch (H7, Teil D); mit den Nummern
			// für den Satz beim Schliessen (Schritt F2).
			...(() => {
				const o = abschlussOhneBeschluss(liste, entschieden, nurKonsultativ);
				return {
					ohneBeschluss: o.ohneAbstimmung,
					nurKonsultativ: o.nurKonsultativ,
					nurKonsultativImSaal: o.nurKonsultativImSaal
				};
			})(),
			// Vertagen gibt es nur an der laufenden ersten (Seite «Anwesenheit»);
			// als Rat nur, wo sie nie beschlussfähig war (oben).
			vertagbar: versammlung.stufe === 'erste' && nieBeschlussfaehig
		},
		rueckkommen,
		erfassung: erfassungsstand.zeilen,
		// Wer aus der Erfassung fällt und warum — sonst sucht die Sitzungsleitung
		// in der Anwesenheitsliste nach einem Fehler, den es nicht gibt.
		erfassungssperren: erfassungsstand.sperren,
		/**
		 * Die von Hand gezählten Summen des offenen Durchgangs — und, wenn sie
		 * hier nicht taugen, warum (Auftraggeber, 25.08.2026: «Summen-Erfassung nur bei
		 * einfachem Mehr»).
		 *
		 * Der Satz kommt aus dem Kern, damit Oberfläche und Server dieselbe
		 * Grenze ziehen. Zwei Fassungen derselben Regel liefen auseinander, und
		 * die Oberfläche böte etwas an, was der Server abweist.
		 */
		handzaehlung: offen?.handzaehlung ?? null,
		// Die Texte und die Zählhilfe der Handzählung an der Einsprache (L3).
		einspracheZaehlung: offen
			? await holeEinspracheZaehlung(locals.benutzer.operatorId, params.id, offen.traktandumId)
			: null,
		...(() => {
			const e =
				offen?.erfordernis ??
				(aktuelles
					? (traktanden.find((t) => t.knoten.id === aktuelles.id)?.knoten.erfordernis ?? null)
					: null);
			return {
				summenhindernis: e ? summenhindernis(e) : null,
				// Ob der Vermerk Pflicht ist (Block A3c), aus derselben Quelle wie
				// die Prüfung am Server.
				summenvermerk: e ? summenvermerkNoetig(e) : null
			};
		})(),
		// Für den Antragsteller eines Spontantraktandums: die Parteien der
		// Momentaufnahme. Ein Antrag «eines einzelnen Eigentümers» ohne Namen wäre
		// im Protokoll nicht zuzuordnen.
		parteien: (momentaufnahme?.parties ?? []).map((p) => ({
			id: p.partyId,
			name: p.displayName
		})),
		/**
		 * Wer am Eingang wartet — auch hier, nicht nur auf der Anwesenheitsseite.
		 *
		 * Gemeldet am 20.08.2026: «Ich müsste dort irgendwo sehen, ob es noch
		 * Anmeldungen gibt … die Überlegung war, nicht hin und her zu wechseln.»
		 * Wer während einer Abstimmung erst die Seite wechseln muss, lässt den
		 * Menschen am Eingang stehen.
		 */
		einlass: {
			wartende: (uebersicht?.staende ?? [])
				.filter((s) => s.zustand === 'wartet')
				.map((s) => ({
					parteiId: s.parteiId,
					name: s.name,
					einheiten: s.einheiten,
					papierfrage: fragtNachPapier(versammlung)
				})),
			saalmeldungen: saalmeldungen.map((m) => ({
				...m,
				papierfrage: fragtNachPapier(versammlung)
			})),
			parteien: (uebersicht?.staende ?? []).map((s) => ({
				parteiId: s.parteiId,
				name: s.name,
				zustand: s.zustand,
				seit: s.seit
			}))
		},
		/** Die anderen Häuser des Abends, für den Wechsel im Saal. */
		geschwister,
		beschlussfaehig: uebersicht
			? { anwesend: uebersicht.anzahlAnwesend, gesamt: uebersicht.anzahlGesamt }
			: null,
		/*
		 * **Die Feststellung selbst, nicht nur die Kopfzahl** (Auftraggeber, 23.08.2026).
		 *
		 * Oben stand «5 von 5 anwesend» — eine Zahl, aus der jeder selbst
		 * schliessen musste, ob die Versammlung beschliessen darf. Beim
		 * Traktandum, das genau diese Feststellung zum Gegenstand hat, stand sie
		 * nirgends.
		 *
		 * Dieselbe Funktion wie auf der Anwesenheitsseite und am Beamer — eine
		 * Rechnung, drei Anzeigen. Zwei Wege, die dasselbe feststellen, laufen
		 * auseinander, und dann steht Zahl gegen Zahl.
		 */
		/**
		 * Was bereits festgehalten ist (Migration 080).
		 *
		 * Die **letzte** Feststellung, denn im Saal zählt, was zuletzt festgestellt
		 * wurde; die Zahl daneben sagt, dass es mehrere gab. Ohne diese Anzeige
		 * wüsste die Sitzungsleitung nicht, ob sie schon festgehalten hat — und
		 * hielte im Zweifel dreimal fest.
		 */
		feststellungen: feststellungenDesAbends.map((f) => ({
			// Als ISO-Zeichenkette, weil `uhrzeit()` eine solche erwartet — ein Date
			// durch den Loader wäre ein zweiter Typ für dieselbe Sache.
			zeitpunkt: f.zeitpunkt.toISOString(),
			beschlussfaehig: f.beschlussfaehig,
			satz: feststellungssatz(f, uebersicht?.einzigeParteiGemeinsam),
			kopfstimmenAnwesend: f.kopfstimmenAnwesend,
			kopfstimmenGesamt: f.kopfstimmenGesamt,
			eigentuemerAnwesend: f.eigentuemerAnwesend,
			eigentuemerGesamt: f.eigentuemerGesamt,
			quotenAnwesend: f.quotenAnwesend,
			gesamtquote: f.gesamtquote
		})),
		beschlussfaehigkeit,
		/*
		 * **Die Einpersonengemeinschaft unter den Balken** (Ä-17,
		 * `docs/entscheide/0011`), bei jedem Geschäft, solange beschlussfähig:
		 * Die Balken zeigen «beschlussfähig», und ohne den Satz sähe die
		 * Leitung nicht, dass das nur nach einer Lehrmeinung gilt.
		 */
		einzigerEigentuemer:
			beschlussfaehigkeit?.beschlussfaehig && beschlussfaehigkeit.einzigerEigentuemer
				? satzZumEinzigen(beschlussfaehigkeit.einzigerGemeinsam, false)
				: null,
		/*
		 * **Ob «konsultativ» angeboten wird** (Migration 158; Codeprüfung
		 * 14.10.2026, H1 und M1): nur ohne Beschlussfähigkeit und nur, wo zum
		 * Geschäft noch kein Beschluss gilt. Unter einem angenommenen Rückkommen
		 * und nach einem Beschluss von Hand gilt einer, und der Server wiese ab.
		 * Auch nicht, wo ein Rückkommen den nächsten Durchgang trägt, ohne dass
		 * am eigenen Traktandum ein Beschluss gilt (Befund 5). Die
		 * Universalversammlung schliesst die Seite selbst aus.
		 */
		konsultativMoeglich:
			!!aktuelles &&
			!!beschlussfaehigkeit &&
			// Oder gesperrt nach L5 (Migration 174, Entscheid 0024 a; Codeprüfung
			// Block 7, H1): Dann fehlt nur die Beschlussfähigkeit einer ersten,
			// und `neueAnZweiter` ist nur ohne sie gefüllt.
			(!beschlussfaehigkeit.beschlussfaehig ||
				(neutraktandenwahl === 'erste' && neueAnZweiter.has(aktuelles.id))) &&
			(await holeKonsultativMoeglich(locals.benutzer.operatorId, params.id, aktuelles.id)),
		// Wer beim aufgerufenen Traktandum im Ausstand ist (ZGB Art. 68 i.V.m.
		// Art. 712m Abs. 2). Leer, solange keines aufgerufen ist. Dazu, unter der
		// Vorgabe von L8, die Verwaltung wie ein erklärter Vertreterausstand
		// (G7, 06.11.2026); `ausEinstellung` hält den Eintrag von den Knöpfen
		// fern, die nur einen erklärten Ausstand zurücknehmen können.
		ausstand: aktuelles
			? [
					...(await holeAusstand(locals.benutzer.operatorId, aktuelles.id)).map((a) => ({
						...a,
						ausEinstellung: false
					})),
					...(await holeVerwaltungsausstand(
						locals.benutzer.operatorId,
						params.id,
						aktuelles.id
					)).map((a) => ({ ...a, erklaertAm: '', erklaertDurch: '', ausEinstellung: true }))
				]
			: [],
		// Vertreter ohne Partei zur Wahl beim Ausstand (Ä-26).
		vertreterOhnePartei: (await holeVertreterOhnePartei(locals.benutzer.operatorId, params.id)).map(
			(v) => ({ id: v.kennung, name: v.name, zusatz: `vertritt ${v.vertritt.join(', ')}; nicht Eigentümer` })
		),
		// Wer beim aufgerufenen Traktandum als betroffen eingetragen ist, samt
		// Vorab-Vermerk (Block A2).
		betroffene: aktuelles
			? await holeBetroffene(locals.benutzer.operatorId, params.id, aktuelles.id)
			: [],
		/*
		 * Der Veto-Stand der Betroffenen im Ausstand, solange der Durchgang
		 * offen ist (Auftrag «Veto im Ausstand», 26.09.2026). Leer heisst:
		 * kein offener Durchgang, keine Betroffenen im Ausstand oder die Form
		 * kennt kein Veto.
		 */
		vetoStand: aktuelles
			? await holeVeto(locals.benutzer.operatorId, params.id, aktuelles.id)
			: [],
		/**
		 * Der Ausstand am **Grundantrag** — für den Folgeantrag zur selben Sache
		 * (22.08.2026, Befund C-02).
		 *
		 * Im Prüflauf trat eine Partei bei Traktandum 7 in den Ausstand; beim
		 * Folgeantrag 7.1 zur selben Fassadensanierung stand sie wieder mit voller
		 * Stimmkraft in der Tabelle. Das ist kein Fehler der Rechnung — der
		 * Ausstand wird «Fall für Fall» erklärt, und 7.1 ist ein eigener Fall —,
		 * aber es ist eine Falle: Wer bei der Sache befangen ist, ist es beim
		 * Folgeantrag dazu genauso.
		 *
		 * **Kein automatisches Übernehmen.** Über Befangenheit entscheidet die
		 * Versammlung, nicht das Werkzeug; ein stillschweigend gesetzter Ausstand
		 * verschöbe eine Bezugsgrösse, die niemand angeordnet hat. Also erinnern
		 * statt entscheiden.
		 */
		ausstandAmGrundantrag: aktuelles?.grundantragId
			? await holeAusstand(locals.benutzer.operatorId, aktuelles.grundantragId)
			: [],
		/*
		 * **Trifft der Folgeantrag andere Eigentümer als sein Grundantrag?**
		 * (Block A3b). Derselbe Anlass wie beim Ausstand darüber: erinnern statt
		 * entscheiden. Der Satz steht in `Eingriffe`, damit Haus und Abend ihn
		 * aus einer Stelle zeigen; wann gefragt wird, sagt der Kern
		 * (`fragtNachBetroffenenabweichung`).
		 */
		betroffenenabweichung:
			aktuelles?.grundantragId &&
			fragtNachBetroffenenabweichung({
				spontanart: aktuelles.spontanart,
				grundantragId: aktuelles.grundantragId,
				art: aktuelles.art,
				form: aktuelles.betroffenenlage.form
			})
				? betroffenenabweichung(
						await holeBetroffene(locals.benutzer.operatorId, params.id, aktuelles.grundantragId),
						await holeBetroffene(locals.benutzer.operatorId, params.id, aktuelles.id)
					)
				: null,
		/*
		 * **Die Vollmachten, die dadurch ruhen** (BGE 134 III 481 E. 3.8). Seit dem
		 * 25.09.2026 auch die des Beklagten bei der Ausschlussklage, ohne Ausstand;
		 * seit dem 27.09.2026 nicht mehr die von Betroffenen, die nur eine
		 * Reglementsklausel ausnimmt.
		 * Sie stehen hier und nicht erst in der Auswertung: Wer einen Ausstand
		 * erklärt, ändert damit auch, wer für wen die Hand heben darf —
		 * und das gehört in den Saal, bevor abgestimmt wird, nicht danach ins
		 * Protokoll.
		 */
		ruhendeVollmachten: aktuelles
			? (await holeStimmsperren(locals.benutzer.operatorId, params.id, aktuelles.id)).filter(
					(s) => s.art === 'vertretung_ruht'
				)
			: []
	};
};

/**
 * Die offenen Folgeanträge zu einem Traktandum — für den Reihenfolgevorschlag.
 *
 * Gelesen über dieselben Bausteine wie die Anzeige: zwei Wege zur selben Frage
 * liefen früher oder später auseinander.
 */
/**
 * **Über den gemeinsamen Leser** (08.09.2026). Diese Funktion hatte die
 * Abbildung auf `Antragsknoten` selbst geschrieben; dieselbe Abbildung braucht
 * inzwischen auch der Rückzug in `server/traktanden.ts`, und zwei Abschriften
 * derselben Frage laufen auseinander.
 */
async function offeneFolgeantraegeZu(operatorId: string, meetingId: string, traktandumId: string) {
	return holeOffeneFolgeantraege(operatorId, meetingId, traktandumId);
}

function handelnder(locals: App.Locals) {
	const b = locals.benutzer!;
	return { operatorId: b.operatorId, userId: b.id, label: b.displayName };
}

function fachlich(fehler: unknown) {
	if (fehler instanceof FachlicherFehler) {
		return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
	}
	throw fehler;
}

/**
 * Die Steuerung des Saals liegt am gemeinsamen Abend, nicht im Haus.
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «wenn die Gruppe mit Hart im Lead ist,
 * sollte man in der Einzelveranstaltung keine Einstellungen machen können.
 * Also keine Steuerung der Präsentation etc.»
 *
 * **Zwei Steuerungen für einen Saal laufen auseinander** — genau das war der
 * Fehler vom 25.08.2026 (Commit `9e17ef6`): Die Häuser standen auf
 * verschiedenen Punkten, und die gemeinsame Sicht zeigte den falschen. Wer im
 * Haus aufruft, während der Abend woanders steht, sieht es an keiner der
 * beiden Stellen.
 *
 * **Ein Notweg bleibt, aber er muss gewollt sein.** Ist der Abend nicht
 * greifbar — Zuordnung versehentlich gelöst, zwei Geräte, ein Fehler —, muss
 * sich ein Haus noch führen lassen. Das Formular schickt dafür `notweg=ja`,
 * und es steht im Verlauf, weil ein Aufruf am Abend vorbei etwas ist, das man
 * später erklären können muss. Geschrieben wird das erst seit dem 30.09.2026,
 * in `abendSperrt`.
 *
 * Gibt `null` zurück, wenn gehandelt werden darf, sonst die Absage.
 */
async function nurWennNichtAmAbend(
	locals: App.Locals,
	meetingId: string,
	aktion: string,
	daten: FormData
) {
	const notweg = text(daten.get('notweg')) === 'ja';
	const abend = await abendSperrt(handelnder(locals), meetingId, aktion, notweg);
	if (!abend) return null;
	return fail(400, {
		fehler: {
			nachricht:
				`Diese Versammlung tagt am gemeinsamen Abend «${abend.bezeichnung}». Aufrufen, ` +
				'Abstimmen, Pause und Wandbild werden dort für alle Gemeinschaften zugleich ' +
				'geführt — zwei Steuerungen für einen Saal laufen auseinander.',
			feld: 'abend'
		},
		abendfuehrt: { id: abend.id, bezeichnung: abend.bezeichnung }
	});
}

export const actions: Actions = {
	/*
	 * **Die Rücknahme aus `einlassaktionen`, nicht abgeschrieben** (09.09.2026,
	 * im zweiten Code-Review gefunden). Diese Seite zeigt den Rücknahmekasten,
	 * weil sie die Frage stellt — die Handlung dazu fehlte, und «Zurück (5)»
	 * lief in ein 404, das mitten in der Sitzung die Fehlerseite über die
	 * Sitzungsführung gelegt hätte. Einen zweiten Rückweg gibt es hier nicht:
	 * Die Kontrollkarte mit dem Vermerk steht nur an den beiden Eingängen.
	 *
	 * Der Weg passt unverändert, weil `params.id` hier wie dort die Versammlung
	 * ist. Die übrigen Einlasshandlungen stehen aus dem Grund darunter noch
	 * einmal ausgeschrieben, den ihr Kommentar nennt.
	 */
	papierZuruecknehmen: einlassaktionen.papierZuruecknehmen,

	/*
	 * ── Der Einlass, auch von hier aus ─────────────────────────────────────
	 *
	 * Dieselben vier Handlungen wie auf der Anwesenheitsseite, unter denselben
	 * Namen — die Komponente `Einlass.svelte` schickt an `?/bestaetigen`,
	 * `?/ablehnen`, `?/saalZuordnen` und `?/saalAblehnen`, und sie steht auf
	 * beiden Seiten. Hiesse hier eine Aktion anders, fiele es erst beim Druecken
	 * auf.
	 *
	 * **Warum ueberhaupt beidseitig:** Am Eingang ist der Einlass die Arbeit,
	 * waehrend der Sitzung eine Unterbrechung, die nicht warten kann.
	 */
	bestaetigen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			/*
			 * **Ohne Weg** (24.08.2026): Dieser Knopf steht am wartenden Eintrag im
			 * Einlasskasten und bestätigt eine Selbstanmeldung. `'gescannt'` stand
			 * hier fest verdrahtet und schrieb «Karte gescannt» in den Verlauf
			 * einer Person, die nie eine Karte in der Hand hatte.
			 */
			const e = await bestaetigeAnwesenheit(
				handelnder(locals),
				params.id,
				text(daten.get('partei'))
			);
			/*
			 * **Auch hier der geteilte Helfer** (09.09.2026, im Code-Review
			 * gefunden). Diese Seite zeigt den Einlasskasten mit derselben
			 * Komponente und stellt darin die Frage «digital oder von Hand» —
			 * ihre eigene `bestaetigen`-Handlung verwarf die Antwort still. Der
			 * Knopf liess ein, der Vermerk entstand nicht, und niemand hätte es
			 * gemerkt, bis das Telefon im Saal doch mitstimmte.
			 */
			const p = await papiervermerkAusFormular(locals, params.id, e.parteiId, daten);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				hinweis:
					(e.neu ? `${e.name} ist als anwesend erfasst.` : `${e.name} war bereits erfasst.`) +
					p.satz,
				papier: p.papier
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	ablehnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await lehneAnmeldungAb(handelnder(locals), params.id, text(daten.get('partei')));
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: 'Anmeldung abgelehnt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	saalZuordnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await ordneSaalmeldungZu(
				handelnder(locals),
				params.id,
				text(daten.get('meldung')),
				text(daten.get('partei'))
			);
			/*
			 * **Auch der Saal-Zugang ist ein Eingang** (09.09.2026, im zweiten
			 * Code-Review gefunden). Wer sich über die Wand meldet und hier einer
			 * Partei zugeordnet wird, wird damit eingelassen — und die Frage
			 * «digital oder von Hand» gehört an denselben Vorgang.
			 */
			const p = await papiervermerkAusFormular(locals, params.id, e.parteiId, daten);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: `${e.name} ist als anwesend erfasst.${p.satz}`, papier: p.papier };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	saalAblehnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await lehneSaalmeldungAb(handelnder(locals), params.id, text(daten.get('meldung')));
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: 'Meldung abgelehnt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Wechselt das Bild an der Wand (Migration 035).
	 *
	 * Kein `verkuendeStand` mit Wortlaut: Der Strom trägt nur die Marke, die
	 * Saalsicht holt den Text selbst nach (AD-11).
	 */
	wandbild: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const gesperrt = await nurWennNichtAmAbend(locals, params.id, 'wandbild', daten);
		if (gesperrt) return gesperrt;
		try {
			await setzeWandbild(
				handelnder(locals),
				params.id,
				text(daten.get('art')) as Wandbildart,
				text(daten.get('text')) || null
			);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: 'Wandbild gewechselt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/** Ein Traktandum aufrufen — das Feld an der Versammlung, das alle Sichten lesen (AD-10). */
	aufrufen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const gesperrt = await nurWennNichtAmAbend(locals, params.id, 'aufrufen', daten);
		if (gesperrt) return gesperrt;
		try {
			await stelleAufTraktandum(handelnder(locals), params.id, text(daten.get('traktandum')) || null);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: 'Traktandum aufgerufen.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	oeffnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const gesperrt = await nurWennNichtAmAbend(locals, params.id, 'oeffnen', daten);
		if (gesperrt) return gesperrt;
		const traktandumId = text(daten.get('traktandum'));
		try {
			/*
			 * **Über Folgeanträge wird zuerst abgestimmt** (FR-43) — als Vorschlag,
			 * nicht als Sperre. Die Sitzungsleitung führt die Versammlung; sie kann
			 * die Grundsatzfrage zuerst klären wollen. Gesagt werden muss es
			 * trotzdem: Ist der Grundantrag einmal beschlossen, läuft der
			 * Folgeantrag ins Leere, und der Weg zurück kostet einen eigenen
			 * Beschluss der Versammlung.
			 */
			const offene = await offeneFolgeantraegeZu(
				locals.benutzer.operatorId,
				params.id,
				traktandumId
			);

			const eroeffnet = await oeffneAbstimmung(handelnder(locals), params.id, traktandumId, {
				universalBestaetigt: text(daten.get('universalBestaetigt')) === 'ja',
				geheim: text(daten.get('geheim')) === 'ja',
				// Grundlage der geheimen Abstimmung (Migrationen 165, 166; Ä-38).
				geheimBeschlossen: text(daten.get('geheimBeschlossen')) === 'ja',
				geheimNachReglement: text(daten.get('geheimNachReglement')) === 'ja',
				konsultativ: text(daten.get('konsultativ')) === 'ja',
				// Die bestätigte Zuordnung (Ä-05, M4); fehlt das Feld, ohne Bestätigung.
				zuordnung: daten.has('zuordnung') ? text(daten.get('zuordnung')) : undefined
			});
			await verkuendeStand(locals.benutzer.operatorId, params.id);

			return {
				/*
				 * Nicht unter einem Rückkommen: Dann trägt dieser Durchgang es, und ein
				 * offener Folgeantrag kommt danach nicht mehr zur Abstimmung. «Über ihn
				 * wird zuerst abgestimmt» sagte das Gegenteil, gerade nachdem die
				 * Versammlung per Ordnungsantrag den alten Antrag gewählt hatte
				 * (Fachprüfung 30.09.2026, Runde 2, R2-2).
				 *
				 * **Und nicht derselbe Satz wie in der Zeile** (Laienprüfung R3-6 a,
				 * Codeprüfung N5, 06.10.2026): «Über ihn wird zuerst abgestimmt»
				 * stimmt nicht mehr, wenn die Abstimmung über den Grundantrag läuft.
				 */
				hinweis:
					'Die Abstimmung ist offen. Die Frage steht auf allen Geräten.' +
					(offene.length > 0 && !eroeffnet.rueckkommensantragId
						? ` ${reihenfolgehinweisNachEroeffnen(offene)}`
						: '')
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Den Beschluss von Hand festhalten (Plan 30.09.2026, Block 2).
	 *
	 * **Ein eigener Weg neben `?/oeffnen`.** Am ersetzten Grundantrag verlangt
	 * das Drehbuch `folgeantrag-nach-rueckkommen.mjs`, dass dort kein
	 * `form[action="?/oeffnen"]` steht; ein zweiter Eröffnungsweg wäre dort
	 * verboten. Dieselben zwei Schranken wie beim Eröffnen: Anmeldung und der
	 * gemeinsame Abend (`nurWennNichtAmAbend`).
	 *
	 * Was das Formular trägt, übersetzt `eingabeAusFormular`; geprüft wird es im
	 * Kern (`auszaehlungVonHand`), und ein fachlicher Fehler kommt als Absage
	 * zurück, nicht als 500er. Danach `verkuendeStand` wie beim Eröffnen: Wand
	 * und Telefone zeigen das festgehaltene Ergebnis.
	 */
	beschlussVonHand: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const eingabe = eingabeAusFormular(daten);
		/*
		 * **Der Grund «Eingewendete Bestimmung» geht am Abend ohne Notweg**
		 * (Entscheid 0046, A7; Auftrag E2). Der Kasten «Reglement» schickt die
		 * Leitung für diesen Fall hierher; ein Vermerk «am Abend vorbei geführt»
		 * (`meeting.day.bypassed`) wäre falsch, denn die Abstimmung hat der Abend
		 * geführt und geschlossen. Dass sie geschlossen ist, verlangt der Kern
		 * (`verlangeEinwandOhneOffenenDurchgang`); ein unbekannter Grund kommt
		 * nicht durch, sondern wird dort abgewiesen, nach der Abendsperre.
		 */
		if (eingabe.grund !== 'eingewendete_bestimmung') {
			const gesperrt = await nurWennNichtAmAbend(locals, params.id, 'beschlussVonHand', daten);
			if (gesperrt) return gesperrt;
		}
		try {
			const { uebergangen } = await haltBeschlussVonHandFest(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				eingabe
			);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			// Mit der Anfechtbarkeit, wo die Beschlussfähigkeit übergangen wurde.
			return { hinweis: quittungVonHand(uebergangen, eingabe.grund === 'eingewendete_bestimmung') };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/** Widerspruch an der Universalversammlung (Migration 128, Runde 2, Stelle 8). */
	widerspruch: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const gesperrt = await nurWennNichtAmAbend(locals, params.id, 'widerspruch', daten);
		if (gesperrt) return gesperrt;
		try {
			// Mit Geschäft: vor dem Eröffnen (Migration 129). Ohne: an der offenen Abstimmung.
			const traktandum = text(daten.get('traktandum')) || null;
			const { fruehererBeschluss } = await haltWiderspruchFest(
				handelnder(locals),
				params.id,
				text(daten.get('partei')),
				traktandum
			);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				// Derselbe Schluss wie danach auf der Seite (Fachprüfung Block 4a,
				// Runde 2; Codeprüfung M-a).
				hinweis: traktandum
					? `Der Widerspruch ist festgehalten. ${fruehererBeschluss ? UNIVERSAL_FRUEHERER_BESCHLUSS : UNIVERSAL_KENNTNIS}`
					: 'Der Widerspruch ist festgehalten. Aus dieser Abstimmung entsteht kein Beschluss; ' +
						'schliessen Sie sie wie gewohnt.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/** Welche Vertreter als Sitzungsleitung oder Verwaltung handeln (Runde 2, Stelle 9). */
	leitungsvertreter: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const gesperrt = await nurWennNichtAmAbend(locals, params.id, 'leitungsvertreter', daten);
		if (gesperrt) return gesperrt;
		try {
			await setzeLeitungsvertreter(
				handelnder(locals),
				params.id,
				daten.getAll('vertreter').map((v) => text(v))
			);
			return { hinweis: 'Die Vertreter der Sitzungsleitung sind festgehalten.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	schliessen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const gesperrt = await nurWennNichtAmAbend(locals, params.id, 'schliessen', await request.formData());
		if (gesperrt) return gesperrt;
		try {
			await schliesseAbstimmung(handelnder(locals), params.id);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				hinweis:
					'Abstimmung geschlossen. Der Anwesenheitsstand dieses Augenblicks ist festgeschrieben.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/** Die laufende Abstimmung ohne Ergebnis abbrechen (H6, `brecheAbstimmungAb`). */
	abbrechen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const gesperrt = await nurWennNichtAmAbend(locals, params.id, 'abbrechen', daten);
		if (gesperrt) return gesperrt;
		try {
			await brecheAbstimmungAb(handelnder(locals), params.id, text(daten.get('begruendung')));
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			/*
			 * **Nach dem Schluss gibt es keine neue Abstimmung** (Auftrag
			 * Abschluss, C2, Hinweis aus F6). Dort ist der Abbruch der Ausweg aus
			 * der Fehlersuche (`docs/installation.md`) für einen Durchgang, der
			 * offen geblieben ist, und der Satz vom erneuten Freigeben wiese auf
			 * einen Weg, den es in einer geschlossenen Versammlung nicht gibt.
			 */
			const v = await holeVersammlung(locals.benutzer.operatorId, params.id);
			return {
				hinweis:
					'Die Abstimmung ist ohne Ergebnis abgebrochen; die abgegebenen Stimmen bewirken nichts. ' +
					(v?.zustand === 'laufend'
						? 'Geben Sie die Abstimmung erneut frei, wenn die Grundlage stimmt.'
						: 'Die Versammlung ist geschlossen, eine neue Abstimmung gibt es nicht mehr. Dem ' +
							'Versiegeln steht dieser Durchgang nicht mehr im Weg.')
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},


	/**
	 * Der Text zum Beschluss (Auftraggeber, 09.09.2026).
	 *
	 * Kein `verkuendeStand`: Der Text ändert am Ergebnis nichts, und die Wand
	 * zeigt Ergebnisse, keine Protokolltexte. Ihn dorthin zu schicken hiesse, im
	 * Saal eine Änderung anzuzeigen, wo keine ist.
	 */
	beschlusstext: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const d = await haltBeschlusstextFest(
				handelnder(locals),
				params.id,
				text(daten.get('durchgang')),
				text(daten.get('text')),
				daten.has('bekannt') ? text(daten.get('bekannt')) : undefined
			);
			return {
				hinweis: d.beschlusstext
					? 'Festgehalten. Er steht unter dem Ergebnis — im Protokoll, sobald der Entwurf ' +
						'daraus erzeugt wird.'
					: 'Der Text zum Beschluss ist entfernt.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Story 7.9: Der Entscheid, den die Anwendung nicht rechnen kann.
	 *
	 * **Votum empfiehlt die Ablehnung** (Produktentscheid 28.09.2026), der
	 * Entscheid bleibt der Person überlassen. Mit dem Eintrag ist er gefällt und
	 * das Ergebnis verkündet; deshalb geht der Stand danach an die Wand.
	 */
	stichentscheid: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			// Ein fehlendes oder unbekanntes `wahl`-Feld still als Nein zu werten
			// hiesse: Aus einer kaputten Anfrage wird eine Ablehnung, und die wird
			// festgeschrieben und verkündet. Die Absage gehört hierher, nicht in
			// den Eintrag.
			const wahl = text(daten.get('wahl'));
			if (wahl !== 'yes' && wahl !== 'no') {
				throw new FachlicherFehler('unbekannt', 'Unbekannter Entscheid.', 'wahl');
			}
			await haltStichentscheidFest(handelnder(locals), params.id, text(daten.get('durchgang')), {
				wahl,
				wer: text(daten.get('wer')),
				begruendung: text(daten.get('begruendung')) || undefined,
				// Die zweite Stimme (Migration 150): nur ein ausdrückliches Häkchen.
				eigentuemer: daten.get('eigentuemer') === 'ja'
			});
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				hinweis:
					'Der Stichentscheid ist festgehalten und das Ergebnis verkündet. Der Entscheid steht ' +
					'mit Namen in der Auswertung und im Verlauf.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	neuabstimmung: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await setzeNeuabstimmungAn(
				handelnder(locals),
				params.id,
				text(daten.get('durchgang')),
				text(daten.get('begruendung'))
			);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				hinweis:
					'Der bisherige Durchgang ist als überholt vermerkt und bleibt einsehbar. ' +
					'Geben Sie die Abstimmung erneut frei, wenn Sie so weit sind.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Ein Traktandum während der Sitzung aufnehmen (Stories 5.11 und 5.12).
	 *
	 * Zwei Fälle seit Migration 031. Ein **Folgeantrag** hängt unter dem
	 * angekündigten Antrag, in dessen Kern er liegt. Ein **neues, sachfremdes
	 * Geschäft** verlässt die Ankündigung; ob es beschlossen werden darf,
	 * entscheiden das Reglement oder die Universalversammlung, nicht dieses
	 * Werkzeug. Die Zuordnung wird hier noch nicht verlangt, weil sie oft erst
	 * danach entsteht, sondern dort, wo sie zählt: bei der Freigabe der
	 * Abstimmung.
	 */
	/**
	 * Einen im Saal gestellten Antrag prüfen lassen (FR-60).
	 *
	 * **Eine Frage, eine Sekunde.** Was sich rechnen lässt — Erfordernis-
	 * verschiebung, Zugehörigkeit zur Versammlung, Ankündigung — steht schon
	 * fest; gefragt wird nur, ob der Antrag im Sachbereich bleibt.
	 */
	kiantrag: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const traktandumId = text(daten.get('traktandumId'));

		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) error(404, 'Versammlung nicht gefunden');
		const g = await holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId);

		const erlaubt = verfuegbarkeit(
			{
				eingerichtet: await kiEingerichtet(locals.benutzer.operatorId),
				zugelassen: g?.aiEnabled ?? false,
				offline: false,
				ausgenommen: g?.aiDisabledFunctions ?? [],
				hinweiseAusblenden: (await holeBetreiber(locals.benutzer.operatorId))?.kiHinweiseAusblenden === true
			},
			'antragspruefung'
		);
		if (!erlaubt.verfuegbar) return fail(400, { fehler: { nachricht: erlaubt.grund ?? '' } });

		/*
		 * **Mit Absage statt Wurf** (F7, 15.10.2026). `pruefeAntrag` weist ein
		 * Traktandum ab, das nicht an dieser Versammlung hängt, und eine leere
		 * oder verstellte Kennung ebenso. Ohne diesen Fang wurde daraus die
		 * 500-Seite. Beim Nachbarn am Abend derselbe Fang; aufgefallen ist die
		 * Stelle am Abend, weil die KI dort zugelassen war.
		 */
		try {
			const ergebnis = await pruefeAntrag(handelnder(locals), traktandumId, versammlung.id);
			return { antragspruefung: { traktandumId, ...ergebnis } };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/** Was die Sitzungsleitung mit der Einschätzung gemacht hat (FR-60, FR-63). */
	kiantragentscheid: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await haltAntragsentscheidFest(
				handelnder(locals),
				text(daten.get('nutzungId')),
				{ art: 'versammlung', versammlungId: params.id },
				verlangeEntscheid(text(daten.get('entscheid')))
			);
			return { hinweis: 'Im Nachweis festgehalten.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Eine weitere Sache im Saal aufnehmen (FR-44, FR-60).
	 *
	 * Die Arbeit steht in `saalaufnahme.ts` — sie wird am gemeinsamen Abend
	 * genauso gebraucht, und hundertvierzig Zeilen zweimal zu führen hiesse,
	 * dass die eine Sicht bald etwas anderes tut als die andere.
	 */
	aufnehmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const aufgenommen = await nimmImSaalAuf(handelnder(locals), params.id, daten, 'versammlung');
			// Die Kennung reist mit, damit die Seite die neue Zeile zeigen kann,
			// statt die Wirkung des Knopfdrucks weit unterhalb des Bildes zu lassen.
			// Die Warnung reist getrennt von der Quittung: Sie bleibt stehen
			// (siehe `Saalaufnahme.warnung`).
			return {
				hinweis: aufgenommen.hinweis,
				warnung: aufgenommen.warnung,
				aufgenommen: aufgenommen.traktandumId
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	rueckzugZurueck: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await nimmRueckzugZurueck(handelnder(locals), params.id, text(daten.get('traktandum')));
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: 'Rückzug zurückgenommen. Der Antrag steht wieder zur Abstimmung.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Die Versammlung schliessen — vom Saal aus (21.08.2026).
	 *
	 * «Wenn das letzte Traktandum durch ist, kann dort der Abschluss knopf
	 * kommen, damit die Sitzung beendet wird.» Bis dahin lag der Knopf auf der
	 * Versammlungsseite, also einen Wechsel entfernt — im letzten Augenblick des
	 * Abends, wenn alle aufstehen.
	 *
	 * **Mit Rückfrage**, anders als beim Unterbrechen: Schliessen ist der eine
	 * Schritt, der sich nicht zurücknehmen lässt. Danach sind die Zugänge
	 * entwertet und die Leinwand wertlos.
	 */
	abschliessen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const e = await schliesseVersammlung(handelnder(locals), params.id);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			const dazu =
				e.geschlosseneAbstimmungen > 0
					? ` ${e.geschlosseneAbstimmungen === 1 ? 'Eine offene Abstimmung wurde' : `${e.geschlosseneAbstimmungen} offene Abstimmungen wurden`} mitgeschlossen.`
					: '';
			return { hinweis: `Versammlung geschlossen.${dazu} Das Protokoll steht jetzt bereit.` };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Vertagen — der Ausweg am Traktandum «Feststellung der Beschlussfähigkeit».
	 *
	 * **Warum hier und nicht nur am Eingang** (Vorgabe des Auftraggebers, 11.09.2026:
	 * «Traktandum 1 Beschlussfähigkeit braucht noch den Exit der Vertagung, wenn
	 * die Beschlussfähigkeit nicht gegeben ist»).
	 *
	 * Die Sitzungsleitung steht in diesem Augenblick beim Traktandum, nicht auf
	 * der Anwesenheitsseite: Sie hat eben festgestellt, dass zu wenige da sind.
	 * Den Ausweg auf einer anderen Seite zu suchen, während der Saal zusieht, ist
	 * genau der Wechsel, den die Sitzungsleitungssicht vermeiden soll.
	 *
	 * **Der Weg am Eingang bleibt** (Produktentscheid 11.09.2026). Dieser hier
	 * hängt daran, dass das aufgerufene Traktandum die Beschlussfähigkeit
	 * betrifft — erkannt am Titel. Wer sein erstes Traktandum umbenennt, verlöre
	 * mit dem Block den einzigen Ausweg, und zwar in der Lage, in der man ihn
	 * braucht. Zwei Wege, dieselbe Handlung, derselbe Eintrag im Protokoll.
	 */
	vertagen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await vertageVersammlung(handelnder(locals), params.id, {
				grund: text(daten.get('grund'))
			});
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: vertagtMeldung(e.folge, e.folgestufe, datumLang(e.folge.datum)) };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Die Beschlussfähigkeit festhalten (ZGB Art. 712p, Migration 080).
	 *
	 * **Warum es dafür einen Knopf braucht** (Auftraggeber, 24.08.2026): «Die
	 * Beschlussfähigkeit sollte einfach festgehalten werden können.» Bis hierher
	 * rechnete das Protokoll sie beim Erzeugen aus dem momentanen Stand — wer um
	 * neun ging, veränderte damit rückwirkend die Zahl, die um fünf festgestellt
	 * worden war.
	 *
	 * Das aufgerufene Traktandum wird mitgeschrieben, aber nicht verlangt:
	 * Festgestellt wird auch mitten in der Sitzung, wenn der Saal sich geleert
	 * hat und vor dem nächsten Beschluss Klarheit gebraucht wird.
	 */
	festhalten: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
			const f = await halteBeschlussfaehigkeitFest(
				handelnder(locals),
				params.id,
				versammlung?.aktuellesTraktandumId ?? null
			);
			/*
			 * **Verkünden, sonst erfährt die Wand nichts** (25.08.2026). Die
			 * Feststellung schreibt in `quorum_finding` und schickt von sich aus
			 * nichts in den Ereignisstrom; die Saalsicht zeigt bis dahin weiter
			 * die laufenden Zahlen, als wäre nichts festgestellt worden.
			 */
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				/*
				 * **Die Beschlussfähigkeit steht auf den Eigentümern, nicht auf den
				 * Kopfstimmen** (26.08.2026). Deshalb stehen sie zuerst. Die
				 * Kopfstimmen bleiben daneben: Auf ihnen rechnet die Mehrheit.
				 *
				 * Für Feststellungen von vor der Umstellung gibt es die Zahl nicht;
				 * dort bleibt es beim alten Satz, statt eine Zahl zu erfinden.
				 */
				hinweis:
					`Festgehalten: ${feststellungssatz(f)} ` +
					(f.eigentuemerGesamt === null
						? ''
						: `${f.eigentuemerAnwesend} von ${f.eigentuemerGesamt} Stockwerkeigentümern, `) +
					`${f.kopfstimmenAnwesend} von ${f.kopfstimmenGesamt} Kopfstimmen, ` +
					`${f.quotenAnwesend} von ${f.gesamtquote} Wertquoten. ` +
					`Der Eintrag bleibt stehen — auch wenn nachher jemand geht.`
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Unterbrechen und fortfahren (Migration 073).
	 *
	 * Ein Weg für beide Richtungen: Der Schalter schickt `an=ja` oder `an=nein`.
	 * Zwei Aktionen liefen auseinander, sobald eine davon etwas mehr tut.
	 */
	pause: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const gesperrt = await nurWennNichtAmAbend(locals, params.id, 'pause', daten);
		if (gesperrt) return gesperrt;
		const an = text(daten.get('an')) === 'ja';
		try {
			await setzePause(handelnder(locals), params.id, {
				an,
				text: text(daten.get('pausentext'))
			});
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				hinweis: an
					? 'Unterbrochen. An der Wand steht die Pause; abgestimmt werden kann erst wieder, wenn Sie fortfahren.'
					: 'Fortgesetzt. Die Wand zeigt wieder den Ablauf.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/** Die Reihenfolge während der Sitzung ändern — ein Ordnungsentscheid (FR-14). */
	verschieben: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		/*
		 * **Die Seite zählt ab eins, der Kern ab null.** Im Saal wird «an dritter
		 * Stelle» gesagt und nicht «an Stelle zwei» — die Umrechnung gehört
		 * deshalb hierher und nicht in die Anzeige.
		 *
		 * Ein leeres Feld wird bewusst zu `NaN` und nicht zu 0: `Number('')` ist
		 * null, und daraus würde «ganz nach vorne» — eine Wirkung, die niemand
		 * bestellt hat. Über Unsinn entscheidet der Kern (`verschiebe`), damit
		 * jeder Aufrufer dieselbe Antwort bekommt.
		 */
		const rohe = text(daten.get('stelle')).trim();
		try {
			await verschiebeTraktandum(handelnder(locals), params.id, {
				id: text(daten.get('traktandum')),
				neuerElternteil: text(daten.get('elternteil')) || null,
				stelle: rohe === '' ? NaN : Number(rohe) - 1
			});
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: 'Reihenfolge geändert. Der Ordnungsentscheid steht im Verlauf.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Die Erfassung von Hand (Story 5.14, Betriebsart «einfach»).
	 *
	 * Erfasst wird je Partei, **nie eine Summe**: Eine eingetippte Summe liesse
	 * sich weder gegen die Stimmkraft prüfen noch nach Wertquoten auswerten, weil
	 * dafür bekannt sein muss, wer wie gestimmt hat.
	 */
	/**
	 * Die Protokollnotiz zum aufgerufenen Traktandum (FR-46).
	 *
	 * Am Ort des Geschehens, nicht auf einer anderen Seite: Wer zum Schreiben
	 * wechseln muss, schreibt es nachher aus dem Gedächtnis.
	 */
	/**
	 * Einen Antrag zurückziehen (FR-45).
	 *
	 * **Zurückgezogen ist nicht abgelehnt** — es entsteht kein Durchgang und kein
	 * Ergebnis. Das Traktandum bleibt in der Liste stehen und erscheint im
	 * Protokoll mit seinem Grund.
	 */
	/**
	 * Rückkommensantrag stellen (FR-44).
	 *
	 * Es entsteht ein eigenes Traktandum, über das gesondert abgestimmt wird —
	 * über das Rückkommen entscheidet die Versammlung, nicht die Sitzungsleitung.
	 */
	rueckkommen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const t = await stelleRueckkommensantrag(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum'))
			);
			return {
				hinweis:
					`«${t.titel}» steht als Antrag auf der Liste. Rufen Sie ihn auf und lassen Sie ` +
					'darüber abstimmen — erst bei Annahme wird die Sache erneut behandelt.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Ausstand erklären (ZGB Art. 68 i.V.m. Art. 712m Abs. 2).
	 *
	 * **Vor der Abstimmung**, nicht während. Die Absage dazu steht im Kern; hier
	 * wird sie nur weitergereicht.
	 */
	/*
	 * **Mehrere auf einmal, ein Grund für alle** (21.08.2026): «Es müssten auch
	 * mehrere als Auswahl möglich sein.»
	 *
	 * Der Kern nimmt weiterhin eine Partei je Aufruf — jeder Ausstand bleibt ein
	 * eigener Eintrag mit eigenem Verlaufsvermerk. Zusammengefasst wird nur die
	 * Bedienung: Wenn eine Firma drei Eigentümern gehört, treten sie gemeinsam in
	 * den Ausstand, und der Grund ist derselbe. Ihn dreimal zu tippen wäre keine
	 * bessere Auskunft.
	 */
	ausstand: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteien = daten
			.getAll('partei')
			.map((w) => text(w))
			.filter((w) => w.length > 0);

		if (parteien.length === 0) {
			return fail(400, {
				fehler: {
					nachricht: 'Niemand ausgewählt. Kreuzen Sie an, wer nicht mitentscheiden darf.',
					feld: 'partei'
				}
			});
		}

		try {
			const namen: string[] = [];
			const vertreter: string[] = [];
			for (const parteiId of parteien) {
				const a = await erklaereAusstand(
					handelnder(locals),
					params.id,
					text(daten.get('traktandum')),
					parteiId,
					text(daten.get('grund'))
				);
				(a.vertreter ? vertreter : namen).push(a.name);
			}
			// Ein Vertreter ohne Eigentum hat keine eigene Stimme (Ä-26).
			return {
				hinweis: [
					namen.length ? ausstandsmeldung(namen) : '',
					vertreter.length ? vertreterausstandsmeldung(vertreter) : ''
				]
					.filter(Boolean)
					.join(' ')
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Entscheid 0045, Punkt 11: die Angabe der Leitung an einem Folgeantrag
	 * mit Häkchen machen und zurücknehmen (`server/verwaltungsangabe.ts`).
	 *
	 * kennung: traktandum — `sperreUndLies` liest es mit
	 *   `meeting_id = ${meetingId}` aus der Adresse.
	 */
	verwaltungsangabe: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await gibVerwaltungsangabe(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				text(daten.get('grund'))
			);
			return { hinweis: VERWALTUNGSANGABE_GEMACHT };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	verwaltungsangabeZurueck: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await nimmVerwaltungsangabeZurueck(handelnder(locals), params.id, text(daten.get('traktandum')));
			return { hinweis: VERWALTUNGSANGABE_ZURUECK };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	ausstandZurueck: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			if (!(await nimmAusstandZurueck(handelnder(locals), params.id, text(daten.get('ausstand'))))) {
				throw new FachlicherFehler('unbekannt', 'Es war kein Ausstand mehr eingetragen; nichts geändert.', 'ausstand');
			}
			return { hinweis: 'Der Ausstand ist zurückgenommen; wer betroffen war, stimmt oder vertritt bei diesem Traktandum wieder.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Betroffene im Saal eintragen (Block A2, `server/betroffene.ts`).
	 *
	 * Anders als beim Ausstand in **einer** Transaktion für alle Gewählten:
	 * Scheitert eine, ist keine eingetragen.
	 *
	 * kennung: traktandum — `verlangeSchranken` in `server/betroffene.ts` liest
	 *   es mit `meeting_id = ${meetingId}` aus der Adresse.
	 */
	betroffeneEin: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteien = daten
			.getAll('partei')
			.map((w) => text(w))
			.filter((w) => w.length > 0);
		try {
			const namen = await trageBetroffeneEin(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				parteien
			);
			return { hinweis: betroffenenmeldung(namen) };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * kennung: traktandum — wie bei `betroffeneEin`.
	 */
	betroffeneAus: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const geaendert = await trageBetroffeneAus(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				text(daten.get('partei'))
			);
			if (!geaendert) throw new FachlicherFehler('unbekannt', 'Die Partei war bei diesem Traktandum nicht als betroffen eingetragen; nichts geändert.', 'partei');
			return { hinweis: 'Die Partei ist bei diesem Traktandum nicht mehr als betroffen eingetragen.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * kennung: traktandum — wie bei `betroffeneEin`.
	 */
	vorabVermerken: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await vermerkeVorabZustimmung(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				text(daten.get('partei')),
				text(daten.get('vermerk'))
			);
			return { hinweis: 'Die Vorab-Zustimmung ist vermerkt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * kennung: traktandum — wie bei `betroffeneEin`.
	 */
	vorabZurueck: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const geaendert = await nimmVorabZustimmungZurueck(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				text(daten.get('partei'))
			);
			if (!geaendert) throw new FachlicherFehler('unbekannt', 'Bei dieser Partei war keine Vorab-Zustimmung vermerkt; nichts geändert.', 'partei');
			return { hinweis: 'Der Vermerk der Vorab-Zustimmung ist zurückgenommen.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Ausschlussklage: nur eine Person oder alle Eigentümer der gemeinsamen
	 * Wohnung beklagt (Migration 132).
	 *
	 * kennung: traktandum und partei — wie bei `betroffeneEin`.
	 */
	beklagtenumfang: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const alle = text(daten.get('alle')) === 'ja';
		try {
			await setzeBeklagtenumfang(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				text(daten.get('partei')),
				alle
			);
			return { hinweis: beklagtenumfangMeldung(alle) };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Der mündliche Veto-Entscheid einer Betroffenen im Ausstand (26.09.2026).
	 *
	 * kennung: traktandum und partei — wie bei `betroffeneEin`; `entscheid`
	 * kommt vom gedrückten Knopf. Der Weg ist hier immer «über die
	 * Sitzungsleitung»; den Entscheid am Telefon erfasst die Betroffene selbst.
	 */
	veto: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const entscheid = text(daten.get('entscheid'));
		if (entscheid !== 'ja' && entscheid !== 'nein') {
			return fail(400, { fehler: { nachricht: 'Unbekannter Veto-Entscheid.' } });
		}
		try {
			const stand = await erfasseVeto(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				text(daten.get('partei')),
				{ entscheid, weg: 'leitung', erfasstDurch: locals.benutzer.displayName }
			);
			// Offene Leitungsseiten des Hauses laden nach (N1). Das Telefon der
			// Betroffenen zieht nur bei einem Zustandswechsel nach und zeigt den
			// Entscheid erst beim nächsten Laden.
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				hinweis:
					`Der Entscheid von «${stand.name}» ist erfasst: ` +
					`${stand.entscheid === 'ja' ? 'Zustimmung' : 'keine Zustimmung'}.`
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	zurueckziehen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const t = await ziehAntragZurueck(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				text(daten.get('grund'))
			);
			// Die Wand zeigt das Geschäft sonst weiter, als stünde es noch an.
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return { hinweis: `«${t.titel}» ist zurückgezogen — nicht abgelehnt.` };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	notiz: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await setzeProtokollnotiz(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				text(daten.get('notiz'))
			);
			return { hinweis: `Notiz zu «${e.titel}» gesichert.` };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/*
	 * ── Pendenzen (09.09.2026) ─────────────────────────────────────────────
	 *
	 * Vier Wege statt eines «speichern»: Erfassen, Wortlaut ändern, Zustand
	 * setzen, entfernen. Der Zustand hat einen eigenen, weil er Monate später
	 * gesetzt wird und eine eigene Bemerkung trägt — «hat sich nicht mehr
	 * gemeldet» gehört nicht in den Wortlaut der Zusage.
	 *
	 * **Die Bindung an diese Versammlung steht im Serverteil**, nicht hier:
	 * `traktandum` und `pendenz` kommen aus dem Formular, und alle vier
	 * Serverfunktionen fragen mit `AND meeting_id = <die Adresse>` — in **einer**
	 * Abfrage, nicht in zwei hintereinander.
	 *
	 * **Kein Wächter deckt diesen Baum.** `check-kennungen` liest nur
	 * `routes/gemeinschaften`, `check-abendbindung` nur `routes/tage`; für
	 * `routes/versammlungen` steht die Klasse ausdrücklich offen (gezählt am
	 * 26.08.2026: 29 ungebundene Kennungsfelder auf neun Seiten). Die Bindung
	 * hier ist deshalb von Hand gesetzt und von `tests/db/pendenz` gemessen,
	 * nicht von einem Wächter gehalten.
	 */
	pendenzErfassen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const p = await erfassePendenz(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				{
					text: text(daten.get('text')),
					verantwortlich: text(daten.get('verantwortlich')),
					fristArt: text(daten.get('fristArt')),
					fristDatum: text(daten.get('fristDatum'))
				}
			);
			return { hinweis: `Pendenz festgehalten — ${fristSatz(p)}.` };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	pendenzAendern: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await aenderePendenz(handelnder(locals), params.id, text(daten.get('pendenz')), {
				text: text(daten.get('text')),
				verantwortlich: text(daten.get('verantwortlich')),
				fristArt: text(daten.get('fristArt')),
				fristDatum: text(daten.get('fristDatum'))
			});
			return { hinweis: 'Pendenz geändert.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	pendenzZustand: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const p = await setzePendenzzustand(
				handelnder(locals),
				params.id,
				text(daten.get('pendenz')),
				text(daten.get('zustand')),
				text(daten.get('notiz'))
			);
			return {
				hinweis:
					p.zustand === 'offen'
						? 'Die Pendenz steht wieder offen.'
						: `Pendenz als ${ZUSTANDSWORT[p.zustand]} vermerkt.`
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	pendenzEntfernen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await entfernePendenz(handelnder(locals), params.id, text(daten.get('pendenz')));
			return { hinweis: 'Pendenz entfernt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/*
	 * ── Rügen (Ä-06, Migration 160) ─────────────────────────────────────────
	 *
	 * Erfassen und Entfernen, kein Ändern: Berichtigt wird durch Entfernen und
	 * neu Erfassen, beides steht im Verlauf. Die Bindung an diese Versammlung
	 * steht im Serverteil wie bei den Pendenzen und wird in `tests/db/ruege`
	 * gemessen. Keine Sperre am Abend: Wie die Pendenz steuert die Rüge den
	 * Saal nicht.
	 */
	ruegeErfassen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const r = await erfasseRuege(handelnder(locals), params.id, text(daten.get('traktandum')), {
				wortlaut: text(daten.get('wortlaut')),
				wer: text(daten.get('wer')),
				uhrzeit: text(daten.get('uhrzeit')),
				entscheid: text(daten.get('entscheid'))
			});
			return { hinweis: `Rüge von ${r.wer} um ${r.uhrzeit} Uhr festgehalten.` };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	ruegeEntfernen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await entferneRuege(handelnder(locals), params.id, text(daten.get('ruege')));
			return { hinweis: 'Rüge entfernt. Im Verlauf bleibt sie stehen.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Die Sitzungsleitung stimmt für **eine** Partei — mit Begründung.
	 *
	 * **Der Anlass, am 20.08.2026.** Gemeldet als Loch: «dass der Sitzungsleiter
	 * für einen Eigentümer stimmen darf. Das müsste aber dokumentiert sein. Bspw.
	 * Telefon ist gerade ausgefallen. Da müsste man den Stimmberechtigten
	 * auswählen, Begründung schreiben und stimmen.»
	 *
	 * **Getrennt von `erfassen`**, obwohl beides Stimmen schreibt: Die
	 * Massenerfassung ist der Normalfall der einfachen Betriebsart und braucht
	 * keine Begründung je Zeile — dort ist die Betriebsart der Grund. Diese hier
	 * ist die Ausnahme in der geführten Betriebsart und braucht ihn zwingend.
	 * Ein gemeinsamer Weg mit einem Feld, das mal Pflicht ist und mal nicht, wäre
	 * genau die Art Regel, die im Saal niemand mehr überblickt.
	 */
	stellvertretend: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const wahl = text(daten.get('wahl'));
		const parteiId = text(daten.get('partei'));

		if (wahl !== 'yes' && wahl !== 'no' && wahl !== 'abstain') {
			return fail(400, { fehler: { nachricht: 'Es ist keine Wahl getroffen.' } });
		}
		if (!parteiId) {
			return fail(400, { fehler: { nachricht: 'Es ist keine Partei gewählt.' } });
		}

		try {
			const e = await gibStimmenAb(
				handelnder(locals),
				params.id,
				[{ parteiId, wahl: wahl as VoteChoice }],
				true,
				// Ob ein Grund Pflicht ist, entscheidet die Betriebsart — die Regel
				// steht im Kern (`pruefeStellvertretendeStimme`), nicht hier.
				text(daten.get('begruendung'))
			);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				hinweis:
					`Stimme erfasst (${e.zeilen} ${e.zeilen === 1 ? 'Einheit' : 'Einheiten'}). ` +
					'Der Grund steht im Protokoll und im Verlauf.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Die Summen einer Handzählung — drei Zahlen, ohne Zuordnung.
	 *
	 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Wenn müsste man dort die totale
	 * Anzahl an Ja, Nein und Enthaltung eintragen können» — zusätzlich zum
	 * einzelnen Erfassen, nicht statt: «So bleibt man flexibel, je situation.»
	 *
	 * Die Grenze («nur beim einfachen Mehr») rechnet der Kern und prüft der
	 * Server; die Oberfläche zeigt den Block gar nicht erst, wo er nicht taugt.
	 * Beide Enden, weil ein zweites Gerät mit einer alten Seite sonst durchkäme.
	 */
	summen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const zahl = (name: string) => {
			const w = Number(text(daten.get(name)));
			return Number.isFinite(w) ? w : NaN;
		};
		// Die zweite Zählung an der Einsprache (L3): leer bleibt `undefined`, damit
		// der Kern «zusammen oder leer» prüfen kann.
		const andereZahl = (name: string) => {
			const roh = text(daten.get(name));
			const w = Number(roh);
			return roh === '' || !Number.isFinite(w) ? undefined : w;
		};
		try {
			const zurueck = text(daten.get('zuruecknehmen')) === 'ja';
			await erfasseSummen(
				handelnder(locals),
				params.id,
				zurueck
					? null
					: {
							ja: zahl('ja'),
							nein: zahl('nein'),
							enthaltung: zahl('enthaltung'),
							andereJa: andereZahl('andere_ja'),
							andereNein: andereZahl('andere_nein'),
							andereEnthaltung: andereZahl('andere_enthaltung'),
							vermerk: text(daten.get('vermerk'))
						}
			);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				hinweis: zurueck
					? 'Handzählung zurückgenommen. Jetzt lassen sich wieder einzelne Stimmen erfassen.'
					: `Von Hand gezählt: ${zahl('ja')} Ja, ${zahl('nein')} Nein, ` +
						`${zahl('enthaltung')} Enthaltung. Wer wie gestimmt hat, ist nicht festgehalten — ` +
						'das steht so im Protokoll.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	erfassen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		const abgaben = [];
		for (const [schluessel, wert] of daten.entries()) {
			if (!schluessel.startsWith('wahl:')) continue;
			const wahl = String(wert);
			if (wahl !== 'yes' && wahl !== 'no' && wahl !== 'abstain') continue;
			abgaben.push({ parteiId: schluessel.slice('wahl:'.length), wahl: wahl as VoteChoice });
		}

		if (abgaben.length === 0) {
			return fail(400, {
				fehler: { nachricht: 'Es ist keine einzige Wahl getroffen. Es wurde nichts erfasst.' }
			});
		}

		try {
			/*
			 * **Auch die Massenerfassung trägt eine Begründung** — in der geführten
			 * Betriebsart verlangt sie der Kern.
			 *
			 * Der Fall dahinter ist der Teilausfall: Der Server läuft, das WLAN im
			 * Saal nicht. Dann stimmt der Saal von Hand, und die Sitzungsleitung
			 * trägt alles ein. Ein Grund für den ganzen Durchgang genügt dafür;
			 * vierzehnmal denselben Satz zu tippen wäre keine bessere Auskunft.
			 */
			const e = await gibStimmenAb(
				handelnder(locals),
				params.id,
				abgaben,
				true,
				text(daten.get('begruendung'))
			);
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				hinweis:
					`${abgaben.length} ${abgaben.length === 1 ? 'Partei' : 'Parteien'} erfasst ` +
					`(${e.zeilen} ${e.zeilen === 1 ? 'Einheit' : 'Einheiten'}). Jede Stimme trägt den ` +
					'Vermerk, dass die Sitzungsleitung sie erfasst hat.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	}
};
