import { fondsgrenzeKartensatz } from '$lib/domain/fondsgrenze';
import { andereLesartenVon, andereLesartInWorten, lesartKartensatz, stichentscheidGrenzeKartensatz } from '$lib/domain/auszaehlung';
import { erfordernisluecke, teilentschiedenSatz } from '$lib/domain/abstimmung';
import { erreichtQuorumEinerErsten } from '$lib/server/beschlussfaehigkeit';
import { holeLesarten } from '$lib/server/lesarten';
import { durchgangWiederEroeffenbar } from '$lib/domain/ausnahmen';
import { entscheidetDasGeschaeft } from '$lib/domain/konsultativ';
import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	ablegepunkt,
	abendschritte,
	gemeinsameListe,
	laufendeStelle
} from '$lib/domain/gemeinsameliste';
import { abendfeststellungssatz, satzZumEinzigen } from '$lib/domain/beschlussfaehigkeit';
import {
	betroffenenabweichung,
	fragtNachBetroffenenabweichung,
	hindernisFuerRueckzug,
	lageZumGrundantrag
} from '$lib/domain/folgeantrag';
import { ersetzungInKuerze } from '$lib/domain/folgeantragsersetzung';
import { ersetzungslage } from '$lib/server/auswertung';
import { stelltBeschlussfaehigkeitFest } from '$lib/domain/traktandenvorlage';
import { kurznamen } from '$lib/domain/kurzname';
import { gemeinsamePause, type Hauslage } from '$lib/domain/pausenstand';
import { datumLang } from '$lib/domain/datum';
import { folgestufenSatz, fristAmAbend, geltendeZweitfrist, tageSpaeter } from '$lib/domain/versammlung';
import {
	holeEnthaltungseinstellung,
	holeReglementsregeln,
	laengsteZweitfrist
} from '$lib/server/reglement';
import { text } from '$lib/server/formular';
import {
	hausDesAbends,
	hausbefundssatz,
	holeTafel,
	holeVersammlungstag,
	schliesseAmAbendGanz
} from '$lib/server/versammlungstag';
import {
	bestaetigeAnwesenheit,
	holeUebersicht as holeAnwesenheitsuebersicht,
	lehneAnmeldungAb
} from '$lib/server/anwesenheit';
import {
	holeOffeneSaalmeldungen,
	lehneSaalmeldungAb,
	ordneSaalmeldungZu
} from '$lib/server/saaleinstieg';
import {
	holeGemeinsameListe,
	verschiebeGeschaeft,
	verschiebeInGeschaeft
} from '$lib/server/geschaeft';
import { holeAbendhaeuser } from '$lib/server/uebersicht';
import { fragtNachPapier } from '$lib/domain/versammlung';
import { hebePapierabgabeAuf } from '$lib/server/papierabgabe';
import { papiervermerkAusFormular } from '$lib/server/einlassaktionen';
import {
	halteAmAbendFest,
	holeAbendantraege,
	nimmAmAbendZurueck,
	oeffneAmAbend,
	rufeAmAbendAuf,
	schliesseAmAbend,
	brecheAbAmAbend,
	vertageAmAbend
} from '$lib/server/abendsteuerung';
import {
	erfasseSummen,
	gibStimmenAb,
	haltBeschlusstextFest,
	haltStichentscheidFest,
	holeDirektNachQuorumLage,
	holeDurchgaenge,
	holeErgebnis,
	holeFolgeantragsbeschluesse,
	holeEntschiedeneAmAbend,
	holeMehrheitsvorschau,
	holeZuordnung,
	holeOffenen,
	holeEinspracheZaehlung,
	setzeNeuabstimmungAn,
	holeBeschlussfaehigkeitOhneAusstand,
	holeAusstandAmGrundantrag,
	holeTeilentschieden,
	holeVerwaltungsvollmachtenLage
} from '$lib/server/abstimmung';
import { durchAnderesTraktandumErsetzt, massgebender, massgebenderDerSache } from '$lib/domain/abstimmung';
import { taugtAlsGrundantrag } from '$lib/domain/folgeantrag';
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
	angehoerigenhinweis,
	angehoerigenlesartHinweis,
	ausstandsmeldung,
	vertreterausstandsmeldung,
	betroffenenmeldung,
	ergebnisInWorten,
	ergebnislage,
	summenhindernis,
	summenvermerkNoetig
} from '$lib/domain/auszaehlung';
import { holeNotizen, setzeProtokollnotiz } from '$lib/server/protokoll';
import { holeErfassungsstand } from '$lib/server/erfassungsliste';
import { holeTraktanden,
	holeNeueTraktandenDerZweiten,
	holeOffeneFolgeantraege
} from '$lib/server/traktanden';
import { holeMomentaufnahme } from '$lib/server/freigabe';
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
import {
	nimmRueckzugZurueck,
	stelleRueckkommensantrag,
	waehlbareErfordernisseAmHaus,
	ziehAntragZurueck
} from '$lib/server/traktanden';
import { nimmImSaalAuf } from '$lib/server/saalaufnahme';
import {
	holeEinladungsmehrJeTraktandum,
	holeSaalhinweiseNachMilderung,
	type Folgeantragsgrenze
} from '$lib/server/einladungsmehr';
import {
	betroffenenlage,
	bezeichnungMitBasis,
	waehlbareErfordernisse,
	einspracheZaehlweiseHinweis
} from '$lib/domain/entscheidbaum';
import { stimmrechtBeiNutzniessung } from '$lib/domain/nutzniessung';
import { holeRegelwerk, holeRegelwerkFuerAnzeige, knotenDerFassung } from '$lib/rules';
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
import { kiEingerichtet } from '$lib/server/ki';
import {
	gibVerwaltungsangabe,
	holeVerwaltungsangabelage,
	nimmVerwaltungsangabeZurueck
} from '$lib/server/verwaltungsangabe';
import { verwaltungsangabeImSaal } from '$lib/domain/verwaltungsangabe';
import { haltAntragsentscheidFest, pruefeAntrag } from '$lib/server/antragspruefung';
import { verfuegbarkeit, verlangeEntscheid } from '$lib/domain/ki';
import { holeBetreiber } from '$lib/server/betreiber';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import type { VoteChoice } from '$lib/domain/types';
import { holeFeststellungen } from '$lib/server/beschlussfaehigkeit';
import { feststellungssatz } from '$lib/domain/beschlussfaehigkeit';
import { setzePause, setzeWandbild } from '$lib/server/versammlungen';
import { verkuendeStand } from '$lib/server/versammlungsstand';
import type { Wandbildart } from '$lib/domain/versammlung';
import { holeVersammlung } from '$lib/server/versammlungen';
import type { Actions, PageServerLoad } from './$types';

function handelnder(b: { operatorId: string; id: string | null; displayName: string }) {
	return { operatorId: b.operatorId, userId: b.id, label: b.displayName };
}

/**
 * Die Sitzungsleitung des gemeinsamen Abends (Auftraggeber, 23.08.2026).
 *
 * «Ziel wirklich: eine Steuerung, ein Monitor, ein Protokoll, aber alles
 * gespeichert in den jeweiligen STWEG/MEG.»
 *
 * Die Seite führt die **gemeinsame Liste** — dieselbe, aus der die Traktanden
 * der Häuser entstanden sind. Jede Handlung wirkt auf alle Häuser des Punktes,
 * geschrieben wird aber in jedem Haus für sich (`abendsteuerung.ts`).
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const tag = await holeVersammlungstag(op, params.id);
	if (!tag) error(404, 'Gemeinsame Versammlung nicht gefunden');

	const [zeilen, haeuser, tafelzeilen] = await Promise.all([
		holeGemeinsameListe(op, params.id),
		holeAbendhaeuser(op, params.id),
		holeTafel(op, params.id)
	]);
	const liste = gemeinsameListe(zeilen);
	// Für den Vertagungsvorschlag weiter unten: Der Termin gilt allen Häusern
	// gemeinsam, also entscheidet die längste hinterlegte Frist.
	const laengsteFrist = await laengsteZweitfrist(
		op,
		haeuser.map((h) => h.stwegId)
	);

	/*
	 * **Der Stand je Haus, nicht je Punkt.** Was offen ist, weiss die einzelne
	 * Versammlung; der Abend fasst es nur zusammen. Eine Abfrage je Haus — ein
	 * Abend trägt eine Handvoll.
	 */
	const offene = await Promise.all(
		haeuser.map(async (h) => ({
			meetingId: h.versammlungId,
			gemeinschaft: h.name,
			offen: await holeOffenen(op, h.versammlungId)
		}))
	);

	// Was jedes Haus gerade aufgerufen hat — die Grundlage des Dreischritts —
	// und was bei ihm an der Wand steht.
	const entschiedene = await holeEntschiedeneAmAbend(op, params.id);

	/**
	 * Je Haus: der aufgerufene Punkt **und wann** (Migration 084).
	 *
	 * Die Uhrzeit gehört dazu, seit `laufendeStelle` sie braucht. Ohne sie fiel
	 * die Steuerung bei Gleichstand auf den höheren Index zurück — und zeigte
	 * dann einen Punkt, den niemand aufgerufen hatte, während «Abstimmung
	 * eröffnen» daneben stand.
	 */
	const zustandJeHaus = new Map<string, { traktandumId: string | null; seit: string | null }>();
	const wandbildJeHaus = new Map<string, { art: Wandbildart } | null>();
	/** Zustand und Unterbrechung je Haus — die Eingabe für `gemeinsamePause`. */
	const pausenlageJeHaus = new Map<string, Hauslage>();
	await Promise.all(
		haeuser.map(async (h) => {
			const v = await holeVersammlung(op, h.versammlungId);
			zustandJeHaus.set(h.versammlungId, {
				traktandumId: v?.aktuellesTraktandumId ?? null,
				seit: v?.aufgerufenSeit ?? null
			});
			wandbildJeHaus.set(h.versammlungId, v?.wandbild ?? null);
			pausenlageJeHaus.set(h.versammlungId, {
				zustand: v?.zustand ?? null,
				pause: v?.pause ?? null
			});
		})
	);

	/*
	 * **Vorher, jetzt, nachher — wie in der einzelnen Sitzungsleitung.**
	 *
	 * «Optisch soll Gruppe und Einzel identisch aussehen» (Auftraggeber, 24.08.2026).
	 * Die Regel steht seit dem 11.08. in `docs/gestaltung.md` («Gleicher
	 * Gegenstand, gleiches Layout»), galt aber nur für den Rahmen; die Seite
	 * selbst führte eine flache Knopfliste, während die einzelne Versammlung
	 * einen Dreischritt zeigt.
	 *
	 * Welcher Punkt läuft, sagen die Häuser (AD-10 gilt je Versammlung). Stimmen
	 * sie nicht überein — weil eines weiter ist —, entscheidet `laufendeStelle`
	 * im Kern; dort steht auch, warum der jüngste Aufruf zählt und nicht die
	 * Zahl der Häuser auf einem Schritt.
	 */
	const aufgerufene = haeuser.map(
		(h) => zustandJeHaus.get(h.versammlungId) ?? { traktandumId: null, seit: null }
	);

	/*
	 * **Der Abend läuft über Schritte, nicht über Punkte** (Auftraggeber, 24.08.2026):
	 * «Wenn Subtraktanden vorhanden sind, muss durch die durch navigiert werden.
	 * Eine Ausnahme ist die Beschlussfähigkeit. Dort genügt eine globale
	 * Feststellung.»
	 *
	 * Bis hierher führte der Dreischritt durch die Punkte und rief in allen
	 * Häusern zugleich auf. Beschlossen wird aber in jeder Gemeinschaft für sich
	 * — und wo der Antrag je Haus anders lautet (Erneuerungsfonds, Ausschuss),
	 * muss auch je Haus gefragt werden. Die Rechnung dazu steht im Kern.
	 */
	/*
	 * **Mit den angehängten Anträgen** (Rückkommen und Folgeantrag, 25.09.2026).
	 * Sie stehen nicht in der
	 * gemeinsamen Liste, laufen aber als eigener Schritt vor ihrem Ziel;
	 * sonst fände der Dreischritt einen aufgerufenen Antrag nicht, und nach dem
	 * Aufruf gab es am Abend nichts zu eröffnen. Begründung in `abendschritte`.
	 */
	const schritte = abendschritte(
		liste,
		stelltBeschlussfaehigkeitFest,
		await holeAbendantraege(op, liste.flatMap((z) => z.traktanden))
	);

	/*
	 * **Kurznamen für die Steuerung** (24.08.2026). Ein Gemeinschaftsname trägt
	 * oft Zusätze in Klammern; im Dreischritt stand dann «2.1 Wahl der
	 * Stimmenzähler MEG Nirgendweg 3-13a (Umgebung) (Prüflauf 20260823202200)»
	 * und der Punkt selbst ging darin unter. Dieselbe Rechnung wie an der Wand —
	 * gekürzt wird nur, solange die Häuser unterscheidbar bleiben.
	 */
	const kurzliste = kurznamen(haeuser.map((h) => h.name));
	const kurz = new Map(haeuser.map((h, i) => [h.name, kurzliste[i]]));
	const kurzname = (name: string | null) => (name ? (kurz.get(name) ?? name) : null);

	// Der jüngste Aufruf gewinnt, nicht die Zahl der Häuser auf einem Schritt.
	// Begründung im Kern.
	const stelle = laufendeStelle(schritte, aufgerufene);

	const alsZeile = (z: (typeof schritte)[number] | undefined) =>
		z
			? {
					nummer: z.nummer,
					titel: z.titel,
					punktart: z.punktart,
					geschaeftId: z.geschaeftId,
					/** Null heisst: alle Häuser des Punktes zugleich. */
					traktandumId: z.traktandumId,
					gemeinschaft: kurzname(z.gemeinschaft),
					antragswortlaut: z.antragswortlaut,
					haeuser: z.traktanden.length,
					traktanden: z.traktanden
				}
			: null;

	/*
	 * Der gemeinsame Wandbildstand: Sind die Häuser einig, gilt ihre Wahl;
	 * laufen sie auseinander, zeigt die Seite das an, statt eine Wahl zu
	 * behaupten, die nur für eines gilt.
	 */
	/*
	 * **Der gemeinsame Pausenstand kommt aus dem Kern** (`pausenstand.ts`).
	 *
	 * Hier standen nacheinander zwei Rechnungen, die beide nicht trugen: erst
	 * ein `Set` über die Pausenobjekte (Objektidentität, Code-Review
	 * 24.08.2026), dann eines über die Zeitstempel — und die gehen zwangsläufig
	 * auseinander, weil `setzePause` je Haus in einer eigenen Transaktion läuft.
	 * Beide Male erschien «Fortfahren» nie, und `paused_at` sperrt jede
	 * Stimmabgabe: Der Abend stand. Die Rechnung ist deshalb geprüft und liegt
	 * an einer Stelle, die auch die Wand benutzt.
	 */
	const pausenstand = gemeinsamePause(haeuser.map((h) => pausenlageJeHaus.get(h.versammlungId) ?? { zustand: null, pause: null }));
	const wandbilder = new Set<Wandbildart>(
		haeuser.map((h) => (wandbildJeHaus.get(h.versammlungId)?.art ?? 'traktanden') as Wandbildart)
	);

	/*
	 * **Die Zahlen im Kopf, wie im Haus**: «x von y anwesend». Über alle
	 * Gemeinschaften summiert — das ist keine Beschlussfähigkeit (die gibt es
	 * nur je Gemeinschaft), sondern die Zahl der Menschen im Saal, und genau
	 * die will die Sitzungsleitung im Kopf haben.
	 */
	const stand = await Promise.all(
		haeuser.map(async (h) => {
			const [u, feststellungen] = await Promise.all([
				holeAnwesenheitsuebersicht(op, h.versammlungId),
				holeFeststellungen(op, h.versammlungId)
			]);
			// Die **letzte** Feststellung, nicht die erste: Im Saal zählt, was
			// zuletzt festgestellt wurde. Die erste steht im Protokollkopf.
			const zuletzt = feststellungen.at(-1) ?? null;
			return {
				meetingId: h.versammlungId,
				gemeinschaft: kurzname(h.name) ?? h.name,
				/** Ob diese Versammlung noch läuft — entscheidet über den Abschlussknopf. */
				zustand: tafelzeilen.find((z) => z.meetingId === h.versammlungId)?.zustand ?? 'entwurf',
				/** Vertagen gibt es nur bei der ersten — eine dritte kennt ZGB 712p nicht. */
				stufe: tafelzeilen.find((z) => z.meetingId === h.versammlungId)?.stufe ?? 'erste',
				anwesend: u?.anzahlAnwesend ?? 0,
				gesamt: u?.anzahlGesamt ?? 0,
				beschlussfaehig: tafelzeilen.find((z) => z.meetingId === h.versammlungId)?.beschlussfaehig ?? null,
				/*
				 * Ä-17 A am Abend wie in der Leitung eines Hauses (Featureprüfung
				 * 3b bis 3e): etwa eine Einstellhalle mit einem einzigen Eigentümer.
				 * Nur solange beschlussfähig; sonst nennt die Kachel, was fehlt.
				 */
				einzigerEigentuemer: (() => {
					const b = tafelzeilen.find((z) => z.meetingId === h.versammlungId)?.beschlussfaehig;
					return b?.erfuellt && b.einzigerEigentuemer
						? satzZumEinzigen(b.einzigeParteiGemeinsam, false)
						: null;
				})(),
				festgestellt: zuletzt
					? {
							zeitpunkt: zuletzt.zeitpunkt.toISOString(),
							beschlussfaehig: zuletzt.beschlussfaehig,
							satz: feststellungssatz(
								zuletzt,
								tafelzeilen.find((z) => z.meetingId === h.versammlungId)?.beschlussfaehig
									?.einzigeParteiGemeinsam
							),
							anzahl: feststellungen.length
						}
					: null
			};
		})
	);

	/*
	 * **Wer am Eingang wartet — auch während der Sitzung** (24.08.2026).
	 *
	 * Der Kasten steht seit dem 12.08. in der Leitung eines Hauses, weil eine
	 * Anmeldung mitten in der Abstimmung nicht warten kann: «Wer während der
	 * Abstimmung erst die Seite wechseln muss, lässt den Menschen stehen.» Am
	 * gemeinsamen Abend fehlte er ganz — dort ist der Wechsel sogar teurer, weil
	 * die Hausansicht die Liste des Abends nicht führt.
	 */
	const eingang = await Promise.all(
		haeuser.map(async (h) => {
			const [u, meldungen, versammlung] = await Promise.all([
				holeAnwesenheitsuebersicht(op, h.versammlungId),
				holeOffeneSaalmeldungen(op, h.versammlungId),
				/*
				 * **Nur wegen der Papierfrage** (10.09.2026, im Code-Review gefunden).
				 * Diese Seite zeigt denselben `Einlass.svelte` wie der Eingang des
				 * Abends, setzte aber `papierfrage` nirgends: Wer hier eine wartende
				 * Partei freigab, galt still als digital, während dieselbe Freigabe
				 * eine Seite weiter fragte. Die Frage hängt am **einzelnen Haus**,
				 * also muss sie je Haus gelesen werden.
				 */
				holeVersammlung(op, h.versammlungId)
			]);
			const staende = u?.staende ?? [];
			const papierfrage = versammlung ? fragtNachPapier(versammlung) : false;
			return {
				wartende: staende
					.filter((s) => s.zustand === 'wartet')
					.map((s) => ({
						meetingId: h.versammlungId,
						gemeinschaft: kurzname(h.name) ?? h.name,
						parteiId: s.parteiId,
						name: s.name,
						einheiten: s.einheiten,
						papierfrage
					})),
				saalmeldungen: meldungen.map((m) => ({
					...m,
					meetingId: h.versammlungId,
					gemeinschaft: kurzname(h.name) ?? h.name,
					papierfrage
				})),
				parteien: staende.map((s) => ({
					meetingId: h.versammlungId,
					parteiId: s.parteiId,
					name: s.name,
					zustand: s.zustand,
					seit: s.seit
				}))
			};
		})
	);

	/*
	 * **Was zum laufenden Schritt gehört** (24.08.2026): das Votum, die
	 * Erfassungsliste und der Fortschritt der Abstimmung — dieselben Dinge wie in
	 * der Leitung eines Hauses, denn ein Schritt IST ein Traktandum in einem Haus.
	 *
	 * Geladen wird nur für das Haus des Schrittes; bei einem Punkt über alle
	 * Häuser (der Feststellung der Beschlussfähigkeit) gibt es nichts zu erfassen
	 * — dort wird nicht abgestimmt.
	 */
	const laufenderSchritt = stelle >= 0 ? schritte[stelle] : null;
	const einHaus =
		laufenderSchritt && laufenderSchritt.traktanden.length === 1
			? laufenderSchritt.traktanden[0]
			: null;

	/*
	 * **Das Ergebnis nach dem Schliessen** (24.08.2026).
	 *
	 * Ohne es war die Steuerung nach dem Schliessen blind: Die Abstimmung
	 * verschwand, und was herauskam, stand nur in der Leitung des Hauses. Im Saal
	 * verkündet die Sitzungsleitung genau in diesem Moment.
	 *
	 * Je Haus des Schrittes eines — bei einem Punkt über alle Häuser sind es
	 * mehrere, und jedes zählt für sich.
	 */
	const ergebnisse = await Promise.all(
		(laufenderSchritt?.traktanden ?? []).map(async (t) => {
			const durchgaenge = await holeDurchgaenge(op, t.meetingId);
			const dazu = durchgaenge.filter((d) => d.traktandumId === t.traktandumId);
			const m = massgebender(dazu);
			// Die Lagen nach einem Rückkommen über einen Folgeantrag in diesem Haus,
			// je Traktandum einmal (Soll 6; Codeprüfung B2b, H1), wie im Haus.
			const traktandenHier = await holeTraktanden(op, t.meetingId);
			const lagen = new Map(
				await Promise.all(
					traktandenHier.map(
						async (x) =>
							[
								x.knoten.id,
								await ersetzungslage(op, t.meetingId, x.knoten.id, durchgaenge, traktandenHier)
							] as const
					)
				)
			);
			if (!m || m.zustand !== 'geschlossen') return null;
			const e = await holeErgebnis(op, t.meetingId, m.id);
			return {
				gemeinschaft: kurzname(t.gemeinschaft) ?? t.gemeinschaft,
				meetingId: t.meetingId,
				durchgang: m.nummer,
				/** Für Stichentscheid und Neuabstimmung — beide hängen am Durchgang. */
				durchgangId: m.id,
				stichentscheid: m.stichentscheid,
				beschlusstext: m.beschlusstext,
				verkuendet: m.verkuendetAm !== null,
				stichentscheidOffen: e?.auszaehlung?.stichentscheidOffen === true,
				stichentscheidArt: e?.auszaehlung?.stichentscheidArt ?? null,
				angenommen: e?.auszaehlung?.angenommen ?? null,
				keinBeschluss: !!e?.auszaehlung?.keinBeschluss,
				satz:
					e?.auszaehlung && m.erfordernis
						? ergebnisInWorten(e.auszaehlung, m.erfordernis)
						: null,
				// Die Ergebnisse nach der anderen Lesart des Hauses (Migrationen 169 und
				// 170), wie in der Leitung des Hauses (zweite Codeprüfung Teil 3, M1).
				andereLesarten: e?.auszaehlung
					? andereLesartenVon(e.auszaehlung).map((r) => ({
							kennung: r.kennung,
							satz: andereLesartInWorten(r, e.auszaehlung!.geheim).leitung
						}))
					: [],
				// Nach einem Rückkommen ohne Beschluss (Reste vom 30.09.2026, Punkt 1).
				/*
			 * Der Durchgang nach dem Rückkommen mit offenem Stichentscheid: Die
			 * Neuabstimmung gehört an ihn, nicht an den geltenden (Codeprüfung
			 * Reste, H1). Sonst überholte der Knopf den geltenden Beschluss.
			 */
			offenNachRueckkommen: await (async () => {
				// An der Karte des Durchgangs, der dabei gilt, wie im Haus (Codeprüfung
				// B2b, H1 und zweiter Durchgang, Befund 1).
				const stich = [...lagen.values()].find(
					(l) =>
						l?.fruehererDurchgangId === m.id &&
						l.ausgang === 'ohne_beschluss' &&
						l.grund === 'stichentscheid'
				);
				if (stich?.folgeDurchgangId) return stich.folgeDurchgangId;
				const ohne = rueckkommenOhneBeschlussNach(dazu, m);
				if (!ohne) {
					// Dasselbe nach Eintritt der Beschlussfähigkeit (Migration 139).
					const quorum = ohneAnnahmeNachQuorumNach(dazu, m);
					if (!quorum) return null;
					const aq = (await holeErgebnis(op, t.meetingId, quorum.id)).auszaehlung;
					return aq?.stichentscheidOffen ? quorum.id : null;
				}
				const a = (await holeErgebnis(op, t.meetingId, ohne.id)).auszaehlung;
				return a?.stichentscheidOffen ? ohne.id : null;
			})(),
			nachRueckkommen: await (async () => {
					// Der Satz zum Rückkommen an diesem Traktandum selbst hat Vorrang, dann
					// der nach einem Rückkommen über einen Folgeantrag (Soll 6), wie im Haus.
					// Nur mit festem Ergebnis des geltenden: Sonst stimmte «Es bleibt beim
					// Beschluss» nicht (Codeprüfung Reste, N1).
					const lageGeltend = ergebnislage(e?.auszaehlung);
					const ohne = rueckkommenOhneBeschlussNach(dazu, m);
					if (ohne && (lageGeltend === 'angenommen' || lageGeltend === 'abgelehnt')) {
						return ohneBeschlussNachRueckkommen(
							ohne.nummer,
							m.nummer,
							lageGeltend === 'abgelehnt',
							grundOhneBeschluss((await holeErgebnis(op, t.meetingId, ohne.id)).auszaehlung)
						);
					}
					const ohneQuorum = ohneAnnahmeNachQuorumNach(dazu, m);
					if (ohneQuorum) {
						return ohneAnnahmeNachQuorum(
							ohneQuorum.nummer,
							m.nummer,
							ergebnislage((await holeErgebnis(op, t.meetingId, ohneQuorum.id)).auszaehlung),
							lageGeltend === 'abgelehnt'
						);
					}
					const ers = lagen.get(t.traktandumId);
					return ers ? ersetzungInKuerze(ers) : null;
				})()
			};
		})
	);

	/*
	 * **Was die Eingriffe brauchen** (24.08.2026, «Von der Funktionalität her
	 * muss es gleich sein wie bei der Einzelversammlung»): die Parteien des
	 * Hauses für den Ausstand, den bereits erklärten Ausstand, die angekündigten
	 * Anträge für einen Folgeantrag und die Fälle des Regelwerks.
	 */
	const traktandenDesHauses = einHaus ? await holeTraktanden(op, einHaus.meetingId) : [];
	// Ä-17 B, wie in der Leitung des Hauses: nur ohne das Quorum einer ersten.
	// Nur an einer zweiten Versammlung (Codeprüfung 3d, L3).
	const neueAnZweiterDesHauses =
		einHaus &&
		tafelzeilen.find((z) => z.meetingId === einHaus.meetingId)?.stufe === 'zweite' &&
		!(await erreichtQuorumEinerErsten(op, einHaus.meetingId))
			? await holeNeueTraktandenDerZweiten(op, einHaus.meetingId)
			: new Set<string>();
	// L5 wie beim Eröffnen aus `holeLesartenIn` (Migration 174).
	const neutraktandenwahlDesHauses =
		einHaus && neueAnZweiterDesHauses.size > 0
			? (await holeLesarten(op, { meetingId: einHaus.meetingId })).L5
			: null;
	// Die Untergrenze aus der Einladung je Grundantrag, für das Aufnahmeformular
	// (Codeprüfung 1 und Fachprüfung FP-3 vom 06.10.2026), gerechnet wie beim
	// Setzen: erst das Reglement des Hauses, dann der Vergleich.
	const stwegDesHauses = einHaus
		? haeuser.find((h) => h.versammlungId === einHaus.meetingId)?.stwegId
		: undefined;
	const einladungsmehrDesHauses =
		einHaus && stwegDesHauses
			? await holeEinladungsmehrJeTraktandum(op, einHaus.meetingId, {
					regeln: await holeReglementsregeln(op, stwegDesHauses),
					enthaltung: await holeEnthaltungseinstellung(op, stwegDesHauses),
					traktanden: traktandenDesHauses
				})
			: new Map<string, Folgeantragsgrenze>();

	/*
	 * **Das Rückkommen rechnet jetzt gleich wie im Haus** (Auftraggeber, 24.08.2026:
	 * «geht ein Gleichrechnen nicht?»).
	 *
	 * Bis hierher fragte diese Seite bloss, ob **irgendwann** ein
	 * Rückkommensantrag zu diesem Punkt gestellt worden war — mit dem Vermerk,
	 * die vorsichtige Antwort sei am Abend die richtige. Das war die bequeme
	 * Antwort und die falsche: Ein abgelehnter oder ein verbrauchter Antrag
	 * sperrte «Nochmals abstimmen» für den Rest des Abends, obwohl Beschlüsse
	 * der Versammlung abänderbar sind, soweit sie keine Gestaltungswirkung
	 * entfalten und nicht bereits realisiert wurden (Rz. 202a ad Art. 712g).
	 * Die Sperre soll zwei Anträge nebeneinander
	 * verhindern, nicht einen zweiten Anlauf.
	 *
	 * Gerechnet wird im Kern (`domain/rueckkommen.ts`) — dieselben drei
	 * Funktionen, die die Leitung eines Hauses benutzt. Zwei Rechnungen für
	 * dieselbe Frage liefen sonst wieder auseinander, und diesmal wüsste
	 * niemand, welche gilt.
	 */
	const durchgaengeDesHauses = einHaus ? await holeDurchgaenge(op, einHaus.meetingId) : [];
	const antraegeDesHauses = traktandenDesHauses.map((x) => ({
		id: x.knoten.id,
		nummer: x.nummer,
		zielId: x.knoten.rueckkommenZielId ?? null,
		aufgenommenAm: x.knoten.aufgenommenAm ?? null
	}));

	/**
	 * Der Grundantrag eines Folgeantrags, wenn über ihn entschieden ist, sonst
	 * null. Dann trägt nur ein Rückkommen auf ihn den Durchgang über den
	 * Folgeantrag (`lageZumGrundantrag`, dieselbe Rechnung wie beim Eröffnen).
	 */
	function grundantragDesFolgeantrags(traktandumId: string) {
		const k = traktandenDesHauses.find((t) => t.knoten.id === traktandumId)?.knoten;
		if (!k || k.spontanart !== 'folgeantrag' || !k.parentId) return null;
		const grund = traktandenDesHauses.find((t) => t.knoten.id === k.parentId);
		if (!grund) return null;
		const lage = lageZumGrundantrag(durchgaengeDesHauses, traktandumId, grund.knoten.id, (d) =>
			durchgangWiederEroeffenbar(d)
		);
		const geltendBei = traktandenDesHauses.find((t) => t.knoten.id === lage.geltend?.traktandumId);
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

	/** Der massgebende Durchgang eines Antrags samt Ergebnis — nur für den einen. */
	async function ueberDenAntrag(antragId: string) {
		const m = massgebender(durchgaengeDesHauses.filter((d) => d.traktandumId === antragId));
		if (!m) return null;
		const e = m.zustand === 'geschlossen' ? await holeErgebnis(op, einHaus!.meetingId, m.id) : null;
		return { offen: m.zustand === 'offen', angenommen: e?.auszaehlung?.angenommen ?? null };
	}

	/*
	 * **Folgeanträge mit eigenem Beschluss** neben dem laufenden Grundantrag
	 * (Fachprüfung 08.10.2026, Frage 2), derselbe Hinweis wie im Haus.
	 */
	const folgeantragHinweis =
		einHaus && laufenderSchritt?.traktandumId
			? folgeantragBleibtHinweis(
					(
						await holeFolgeantragsbeschluesse(op, einHaus.meetingId, traktandenDesHauses, durchgaengeDesHauses)
					).get(laufenderSchritt.traktandumId) ?? []
				)
			: null;
	let rueckkommen: {
		abstimmbar: boolean;
		satz: string;
		weg: ReturnType<typeof rueckkommensauskunft>['weg'];
		antragId: string | null;
		antragNummer: string | null;
		laeuft: boolean;
	} | null = null;
	if (einHaus && laufenderSchritt?.traktandumId) {
		const zielId = laufenderSchritt.traktandumId;
		/*
		 * **Der direkte Weg nach Eintritt der Beschlussfähigkeit** (Migration
		 * 139). Am Abend ist die Hausseite gesperrt; eröffnet wird hier über
		 * `oeffneAmAbend`, und Tor und Anzeige rechnen dieselbe Lagerechnung
		 * wie im Haus.
		 */
		const direkt = await holeDirektNachQuorumLage(op, einHaus.meetingId, zielId);
		const antrag = juengsterRueckkommensantrag(antraegeDesHauses, zielId);
		const stand = antrag
			? standDesRueckkommensantrags(antrag.id, durchgaengeDesHauses, await ueberDenAntrag(antrag.id))
			: null;
		// **Abgestimmt** heisst: ein geschlossener, nicht überholter Durchgang am
		// Ziel — dieselbe Rechnung wie im Haus (`entschieden`). Dazu der Beschluss,
		// den ein Folgeantrag nach einem Rückkommen ersetzt hat (Migration 133).
		// Ohne konsultative Durchgänge (H7, Teil D).
		const abgestimmt =
			durchgaengeDesHauses.some(
				(d) => d.traktandumId === zielId && entscheidetDasGeschaeft(d)
			) || durchAnderesTraktandumErsetzt(durchgaengeDesHauses, zielId);
		/*
		 * **Beim Folgeantrag nach dem Grundantrag zählt das Rückkommen auf den
		 * Grundantrag** (Produktentscheid 30.09.2026), wie beim Eröffnen. Bis dahin
		 * hiess ein vorher aufgenommener Folgeantrag hier «abstimmbar», und der
		 * Server wies ihn ab (Codeprüfung B1).
		 */
		const zumGrund = grundantragDesFolgeantrags(zielId);
		const aufGrund = zumGrund ? juengsterRueckkommensantrag(antraegeDesHauses, zumGrund.id) : null;
		const standAufGrund = aufGrund
			? standDesRueckkommensantrags(aufGrund.id, durchgaengeDesHauses, await ueberDenAntrag(aufGrund.id))
			: null;
		const auskunft = zumGrund
			? rueckkommensauskunft({
					abgestimmt,
					antrag: aufGrund && standAufGrund ? { nummer: aufGrund.nummer, ...standAufGrund } : null,
					grundantrag: {
						titel: zumGrund.titel,
						eigenerDurchgang: zumGrund.eigenerDurchgang,
						geltend: zumGrund.geltend,
						folgeantragTitel: (traktandenDesHauses.find((t) => t.knoten.id === zielId)?.knoten.titel ?? ''),
						// Für die Ansage vor dem Freigeben (Fachprüfung Runde 2, R2-1).
						geltendAngenommen: zumGrund.geltendId
							? (await holeErgebnis(op, einHaus.meetingId, zumGrund.geltendId)).auszaehlung
									?.angenommen === true
							: true
					}
				})
			: rueckkommensauskunft({
					abgestimmt,
					antrag:
						antrag && stand
							? {
									nummer: antrag.nummer,
									...stand,
									// Wo gerade abgestimmt wird, für den Satz dazu (Laienprüfung 5c).
									offenBei:
										traktandenDesHauses.find(
											(x) =>
												x.knoten.id ===
												durchgaengeDesHauses.find((d) => d.zustand === 'offen')?.traktandumId
										)?.nummer ?? null
								}
							: null,
					geltenderDurchgang: (() => {
						const dazu = durchgaengeDesHauses.filter((d) => d.traktandumId === zielId);
						return geltendNachNeuabstimmung(dazu, massgebender(dazu));
					})(),
					direktNachQuorum: direkt
						? {
								nummer: direkt.nummer,
								beschlussfaehig:
									tafelzeilen.find((z) => z.meetingId === einHaus.meetingId)?.beschlussfaehig
										?.erfuellt ?? false
							}
						: null
				});
		const wegAntrag = zumGrund ? aufGrund : antrag;
		// Am ersetzten Grundantrag zuerst, was geschah (Soll 6), wie im Haus.
		const ersetztSatz =
			!durchgaengeDesHauses.some((d) => d.traktandumId === zielId && !d.ueberholtAm) &&
			durchAnderesTraktandumErsetzt(durchgaengeDesHauses, zielId)
				? await ersetzungslage(op, einHaus.meetingId, zielId, durchgaengeDesHauses, traktandenDesHauses)
				: null;
		rueckkommen = {
			...auskunft,
			satz: ersetztSatz ? `${ersetzungInKuerze(ersetztSatz)} ${auskunft.satz}` : auskunft.satz,
			antragId: wegAntrag?.id ?? null,
			antragNummer: wegAntrag?.nummer ?? null,
			laeuft: rueckkommenWirktNoch(stand)
		};
	}
	const momentaufnahme = einHaus ? await holeMomentaufnahme(op, einHaus.meetingId) : null;
	const ausstand =
		einHaus && laufenderSchritt?.traktandumId
			? await holeAusstand(op, laufenderSchritt.traktandumId)
			: [];
	const jetztTraktandum = laufenderSchritt?.traktandumId
		? traktandenDesHauses.find((t) => t.knoten.id === laufenderSchritt.traktandumId)
		: undefined;
	// L7 (Migration 183), wie in der Leitung des Hauses, mit Stufe und Wahl
	// dieses Hauses aus derselben Serverfunktion wie das Eröffnen
	// (Codeprüfung Block 4, M2).
	const stufeDesHauses = einHaus ? tafelzeilen.find((z) => z.meetingId === einHaus.meetingId)?.stufe : undefined;
	const ohneAusstandDesHauses =
		einHaus && jetztTraktandum && stufeDesHauses && stwegDesHauses
			? await holeBeschlussfaehigkeitOhneAusstand(
					op,
					einHaus.meetingId,
					{ tier: stufeDesHauses, stweg_id: stwegDesHauses },
					jetztTraktandum.knoten.id
				)
			: null;
	// L8 (Migration 184), wie in der Leitung des Hauses: der Satz zu den
	// Vollmachten der Verwaltung am laufenden Geschäft dieses Hauses.
	const verwaltungsvollmachtenDesHauses =
		einHaus && jetztTraktandum
			? await holeVerwaltungsvollmachtenLage(op, einHaus.meetingId, jetztTraktandum.knoten.id)
			: null;
	// Entscheid 0045, Punkt 9 (beim Bau geklärt 07.11.2026): Ist unter dem
	// Häkchen ein Folgeantrag zur Wahl oder Abberufung entschieden, wird über
	// den Grundantrag nicht mehr abgestimmt; derselbe Satz wie die Absage.
	const teile = einHaus && jetztTraktandum ? await holeTeilentschieden(op, einHaus.meetingId, jetztTraktandum.knoten.id) : [];
	const teilentschiedenHinweis = teile.length > 0 ? teilentschiedenSatz(teile) : null;
	// Laienprüfung Runde 5, R5-4 (Produktentscheid 07.11.2026): Ein Folgeantrag
	// übernimmt einen am Grundantrag erklärten Ausstand nicht.
	const ausstandAmGrundantrag = einHaus && jetztTraktandum ? await holeAusstandAmGrundantrag(op, einHaus.meetingId, jetztTraktandum.knoten.id) : false;
	// Entscheid 0045, Punkt 11, wie in der Leitung des Hauses: die Angabe der
	// Leitung am Folgeantrag dieses Hauses, gesetzt oder als Angebot.
	const verwaltungsangabeDesHauses =
		einHaus && jetztTraktandum
			? verwaltungsangabeAnzeige(
					verwaltungsangabeImSaal(
						await holeVerwaltungsangabelage(op, einHaus.meetingId, jetztTraktandum.knoten.id),
						verwaltungsvollmachtenDesHauses !== null
					)
				)
			: null;
	// Die Betroffenen des laufenden Schrittes im Haus (Block A2), wie im Haus.
	const betroffene =
		einHaus && laufenderSchritt?.traktandumId
			? await holeBetroffene(op, einHaus.meetingId, laufenderSchritt.traktandumId)
			: [];
	/*
	 * Der Veto-Stand der Betroffenen im Ausstand, solange der Durchgang offen
	 * ist (Auftrag «Veto im Ausstand», 26.09.2026). Leer heisst: kein offener
	 * Durchgang, keine Betroffenen im Ausstand oder die Form kennt kein Veto.
	 */
	const vetoStand =
		einHaus && laufenderSchritt?.traktandumId
			? await holeVeto(op, einHaus.meetingId, laufenderSchritt.traktandumId)
			: [];

	/*
	 * **Wer bei Nutzniessung stimmt** (FR-22) — auch am Abend.
	 *
	 * Dieselbe Rechnung wie in der Leitung eines Hauses: aus der Geschäftsart des
	 * am Traktandum festgehaltenen Erfordernisses und dem in der Momentaufnahme
	 * eingefrorenen Stand. Sie fehlte hier ganz — und gerade am Verbundabend
	 * fällt sie auf: Wenn eine Wohnung im Nutzniessungsrecht steht, ist im Saal
	 * strittig, wer die Hand hebt, und die Antwort stand nur in der Hausansicht.
	 *
	 * Nur zum laufenden Schritt und nur, wenn er in genau einem Haus liegt: Bei
	 * einem Punkt über alle Häuser wird nicht abgestimmt.
	 */
	const nutzniessungen: { einheit: string; partei: string; satz: string; vonHand: boolean }[] = [];
	if (jetztTraktandum && momentaufnahme) {
		for (const partei of momentaufnahme.parties) {
			for (const e of partei.units) {
				if (!e.nutzniessung) continue;
				const befund = stimmrechtBeiNutzniessung(
					e.nutzniessung,
					jetztTraktandum.knoten.erfordernis?.geschaeftsart ?? null,
					jetztTraktandum.knoten.erfordernis?.knotenId ?? null
				);
				nutzniessungen.push({
					einheit: e.label,
					partei: partei.displayName,
					satz: befund.satz,
					vonHand: befund.vonHand
				});
			}
		}
	}

	/*
	 * **Die KI-Antragsprüfung — je Gemeinschaft** (FR-60, FR-62).
	 *
	 * Sie fehlte am Abend ganz: Ein im Saal gestellter Folgeantrag liess sich
	 * dort aufnehmen, aber nicht auf Zulässigkeit prüfen. Die Zulassung hängt an
	 * der **Gemeinschaft** (`aiEnabled`), nicht am Betreiber — deshalb gerechnet
	 * für das Haus des laufenden Schrittes. Steht der Punkt in mehreren Häusern,
	 * wird nicht abgestimmt und es gibt keinen Folgeantrag zu prüfen.
	 *
	 * **Sichtbar deaktiviert statt fehlerhaft** (FR-62): `verfuegbarkeit` liefert
	 * den Grund gleich mit.
	 */
	const hausversammlung = einHaus ? await holeVersammlung(op, einHaus.meetingId) : null;
	const hausgemeinschaft = hausversammlung
		? await holeGemeinschaft(op, hausversammlung.stwegId)
		: null;
	const ki = verfuegbarkeit(
		{
			eingerichtet: await kiEingerichtet(op),
			zugelassen: hausgemeinschaft?.aiEnabled ?? false,
			offline: false,
			ausgenommen: hausgemeinschaft?.aiDisabledFunctions ?? [],
			hinweiseAusblenden: (await holeBetreiber(op))?.kiHinweiseAusblenden === true
		},
		'antragspruefung'
	);

	const erfassungsstand = einHaus
		? await holeErfassungsstand(op, einHaus.meetingId)
		: { zeilen: null, sperren: [] };
	const notizen = einHaus ? await holeNotizen(op, einHaus.meetingId) : new Map<string, string>();
	const betriebsart = einHaus
		? ((await holeVersammlung(op, einHaus.meetingId))?.betriebsart ?? 'gefuehrt')
		: 'gefuehrt';

	/*
	 * Die Handzählung des Hauses, dessen Punkt gerade läuft — und der Grund,
	 * wenn sie hier nicht taugt (Auftraggeber, 25.08.2026: «Summen-Erfassung nur bei
	 * einfachem Mehr»). Der Satz kommt aus dem Kern, damit Oberfläche und Server
	 * dieselbe Grenze ziehen.
	 */
	const offenerDurchgang = einHaus ? await holeOffenen(op, einHaus.meetingId) : null;
	/*
	 * **Als Menge, nicht als Liste** (Code-Review 07.09.2026). Die Frage «ist
	 * über diesen Punkt entschieden?» wird einmal je Traktandum des Hauses
	 * gestellt, und dieser Loader läuft bei jedem Nachziehen aus dem
	 * Ereignisstrom neu. Die Haussicht rechnet dieselbe Frage schon über ein Set.
	 */
	const entschiedeneKennungen = new Set(entschiedene);
	/*
	 * **Worauf ein angenommenes, unverbrauchtes Rückkommen wartet**
	 * (Produktentscheid 30.09.2026). Dort darf ein Folgeantrag an die Stelle des
	 * alten Antrags treten, und die Auswahl muss ihn anbieten; der Server fragt
	 * dasselbe (`rueckkommenOffenIn`). Bis dahin gab diese Seite die Angabe nicht
	 * mit, und der Weg war in der Oberfläche nicht erreichbar (Codeprüfung B1).
	 */
	const rueckkommenOffenBei = new Set<string>();
	for (const t of traktandenDesHauses) {
		if (!entschiedeneKennungen.has(t.knoten.id)) continue;
		const a = juengsterRueckkommensantrag(antraegeDesHauses, t.knoten.id);
		if (!a) continue;
		const s = standDesRueckkommensantrags(a.id, durchgaengeDesHauses, await ueberDenAntrag(a.id));
		if (s.stand === 'angenommen' && !s.verbraucht) rueckkommenOffenBei.add(t.knoten.id);
	}
	const summenerfordernis =
		offenerDurchgang?.erfordernis ??
		(einHaus && laufenderSchritt?.traktandumId
			? ((await holeTraktanden(op, einHaus.meetingId)).find(
					(t) => t.knoten.id === laufenderSchritt.traktandumId
				)?.knoten.erfordernis ?? null)
			: null);

	/*
	 * **Ohne Fangblock** (seit 25.09.2026). Hier stand am 24.09.2026 einer, wie
	 * auf `/z`, gegen die fachlichen Würfe aus `zaehleAus`. Er fing aber alles,
	 * auch echte Fehler, und machte aus «die Zahl fehlt» eine Stille, die
	 * aussah wie «keine Zahl nötig». Die fachlichen Fälle fängt jetzt
	 * `mehrheitsvorschau` selbst und sagt der Leitung Grund und Weg
	 * (`sperrgrund`).
	 */
	const vorschau =
		einHaus && jetztTraktandum
			? await holeMehrheitsvorschau(
					op,
					einHaus.meetingId,
					jetztTraktandum.knoten.id,
					jetztTraktandum.knoten.erfordernis ?? null
				)
			: null;

	/*
	 * Die Zuordnung, die «Abstimmung eröffnen» für das Haus des laufenden
	 * Schrittes bestätigt (Ä-05, M4). Für «Abstimmen» unter «Einzeln führen»
	 * steht sie je Haus in `zuordnungen` weiter unten.
	 */
	const zuordnung =
		einHaus && jetztTraktandum && jetztTraktandum.knoten.art === 'abstimmung'
			? await holeZuordnung(
					op,
					einHaus.meetingId,
					jetztTraktandum.knoten.id,
					jetztTraktandum.knoten.erfordernis ?? null
				)
			: null;

	/*
	 * **Auch unter «Einzeln führen» kein Knopf, der in eine Absage führt**
	 * (25.09.2026). Dort steht «Abstimmen» an jedem Haus, das den Punkt
	 * aufgerufen hat, und nicht nur am Schritt, der gerade «jetzt» ist: Nach
	 * einem Sammelaufruf sind es alle Häuser des Punktes. Ohne diese Rechnung
	 * führte der Knopf bei einer Erfordernislücke in die rote Absage, während
	 * der Dreischritt ihn in derselben Lage gar nicht anbietet.
	 *
	 * Dieselbe Quelle wie dort (`holeMehrheitsvorschau`, deren `sperrgrund` aus
	 * `erfordernisluecke`), damit Knopf und Server dieselbe Grenze ziehen. Je
	 * Haus ist höchstens ein Traktandum aufgerufen, also höchstens eine Rechnung
	 * je Haus; die des laufenden Schrittes steht schon in `vorschau`.
	 */
	const sperren: Record<string, string> = {};
	/*
	 * **Welcher Weg neben dem Satz steht** (Code-Review 25.09.2026 zu A2b,
	 * Befund 1). Seit Block A2 führt der Satz bei fehlenden Betroffenen zu
	 * «Betroffene» unter «Jetzt möglich». Das gibt es auf dieser Seite nur für
	 * das Haus des laufenden Schrittes; daneben stand allein «Nötige Mehrheit
	 * ändern», also genau der Weg, den der Satz nur für ein falsches
	 * Erfordernis vorsieht. Wahr heisst hier: der Verweis führt in die Leitung
	 * des Hauses, wo der Punkt aufgerufen ist und der Eingriff steht.
	 */
	const sperrtWegenBetroffener: Record<string, boolean> = {};
	/*
	 * **Ohne Mehrheitserfordernis kein «Abstimmen»** (Laienprüfung Runde 3,
	 * Befund N-1, 06.10.2026). `holeMehrheitsvorschau` liefert ohne Erfordernis
	 * nichts, also auch keinen Sperrgrund, und der Knopf führte in die Absage
	 * aus `domain/abstimmung.ts`, die auf den Entscheidbaum verweist. Den gibt
	 * es auf dieser Seite nicht. Das trifft den im Saal aufgenommenen
	 * Folgeantrag, dessen Mehr an der Untergrenze abgewiesen wurde, ebenso wie
	 * ein angekündigtes Traktandum, das ohne Mehr freigegeben wurde. Gelesen
	 * wird aus den Traktanden, die die Rechnung darunter ohnehin holt; keine
	 * eigene Abfrage.
	 */
	const ohneMehr: Record<string, boolean> = {};
	/*
	 * **Auch «Abstimmen» unter «Einzeln führen» bestätigt die Zuordnung**
	 * (Ä-05; Erhebung zur Freigabe vom 16.10.2026). Bis dahin eröffnete der
	 * Knopf ohne Marke, also ohne Bestätigung im Verlauf und ohne Absage, wenn
	 * ein anderes Gerät Ausstand oder Mehrheit inzwischen geändert hatte; nur
	 * der Hauptknopf trug sie. Je aufgerufenem Traktandum, wo der Knopf steht.
	 */
	const zuordnungen: Record<string, Awaited<ReturnType<typeof holeZuordnung>>> = {};
	await Promise.all(
		haeuser.map(async (h) => {
			const t = zustandJeHaus.get(h.versammlungId)?.traktandumId;
			if (!t || entschiedeneKennungen.has(t)) return;
			if (offene.some((o) => o.offen?.traktandumId === t)) return;
			if (liste.find((z) => z.tiefe === 2 && z.traktandumId === t)?.punktart !== 'abstimmung') return;
			const knoten =
				einHaus?.meetingId === h.versammlungId && jetztTraktandum?.knoten.id === t
					? jetztTraktandum.knoten
					: (await holeTraktanden(op, h.versammlungId)).find((k) => k.knoten.id === t)?.knoten;
			const e = knoten?.erfordernis ?? null;
			if (e === null) {
				// Ein zurückgezogener Antrag wird nicht abgestimmt; der Satz träfe
				// ihn nicht (Codeprüfung 5, Runde 5).
				if (!knoten?.rueckzug) ohneMehr[t] = true;
				return;
			}
			const v =
				einHaus?.meetingId === h.versammlungId && jetztTraktandum?.knoten.id === t
					? vorschau
					: await holeMehrheitsvorschau(op, h.versammlungId, t, e);
			if (v?.sperrgrund) {
				sperren[t] = v.sperrgrund;
				sperrtWegenBetroffener[t] =
					e !== null &&
					['ohne_betroffene', 'ohne_beklagten', 'einsprache_ohne_betroffene'].includes(
						erfordernisluecke(e, 0)?.kennung ?? ''
					) &&
					v.sperrgrund === erfordernisluecke(e, 0)?.satz;
			} else {
				zuordnungen[t] =
					(einHaus?.meetingId === h.versammlungId && jetztTraktandum?.knoten.id === t
						? zuordnung
						: null) ?? (await holeZuordnung(op, h.versammlungId, t, e));
			}
		})
	);

	return {
		tag: { id: tag.id, bezeichnung: tag.bezeichnung, datum: tag.datum, ort: tag.ort },
		verwaltungsangabe: verwaltungsangabeDesHauses,
		/**
		 * Warum «Abstimmen» unter «Einzeln führen» nicht angeboten wird, je
		 * aufgerufenem Traktandum. Begründung oben bei der Rechnung.
		 */
		sperren,
		sperrtWegenBetroffener,
		/** Aufgerufene Traktanden zur Abstimmung ohne Mehrheitserfordernis (Befund N-1). */
		ohneMehr,
		/**
		 * Ob der laufende Schritt, eine Abstimmung in einem Haus, noch kein
		 * Mehrheitserfordernis trägt. Dann steht statt «Abstimmung eröffnen» der
		 * Weg dorthin (Befund N-1, Laienprüfung Runde 3).
		 */
		aktuellOhneMehr: Boolean(
			einHaus &&
				jetztTraktandum &&
				jetztTraktandum.knoten.art === 'abstimmung' &&
				!jetztTraktandum.knoten.erfordernis &&
				!jetztTraktandum.knoten.rueckzug
		),
		/** Die Zuordnung, die «Abstimmung eröffnen» bestätigt (Ä-05, M4). */
		zuordnung,
		/** Dieselbe je Traktandum für «Abstimmen» unter «Einzeln führen». */
		zuordnungen,
		/** Das Haus des laufenden Schrittes — null beim Punkt über alle. */
		schritthaus: einHaus
			? { meetingId: einHaus.meetingId, gemeinschaft: kurzname(einHaus.gemeinschaft) }
			: null,
		ergebnisse: ergebnisse.filter((e): e is NonNullable<typeof e> => Boolean(e)),
		/**
		 * **Die nötige Mehrheit in Zahlen, vor der Abstimmung** (Produktentscheid
		 * 24.09.2026; `docs/freigabe.md`, «Die drei entschiedenen Punkte», Punkt 3).
		 * Hier stand bis dahin nur der Erfordernistitel. Am Abend wirft die
		 * Ausstandsmeldung die Frage nach der Wirkung auf, und die Antwort stand in
		 * der Leitung des Hauses, einen Klick in eine andere Versammlung entfernt.
		 *
		 * Dieselbe Rechnung wie dort (`holeMehrheitsvorschau`), und nur, wenn der
		 * Schritt in genau einem Haus liegt: Nur dann gibt es hier einen Ausstand,
		 * und bei einem Punkt über mehrere Häuser hat jedes seine eigene Mehrheit.
		 * Bei jedem Laden neu gerechnet, wie im Haus: Wer dazukommt oder in den
		 * Ausstand tritt, verschiebt die Bezugsgrösse.
		 */
		vorschau,
		// Der Satz zur Erreichbarkeit nur bei Beschlussfähigkeit des Hauses
		// (Codeprüfung 17.10.2026, N1), wie in der Leitung des Hauses.
		erreichbarkeitZeigen: Boolean(
			einHaus && tafelzeilen.find((z) => z.meetingId === einHaus.meetingId)?.beschlussfaehig?.erfuellt
		),
		// Warnungen am Erfordernis des laufenden Schrittes (Block 3, Ä-15 und
		// Ä-20), wie in der Leitung des Hauses.
		mehrhinweise: (() => {
			// Entscheid 0045, Punkt 9 (Codeprüfung P9, G-4): Am gesperrten
			// Grundantrag steht nur der Satz zur Sperre; alle übrigen bereiten
			// eine Abstimmung vor, die nicht kommt.
			if (teilentschiedenHinweis) return [teilentschiedenHinweis];
			// Ä-17 B, wie in der Leitung des Hauses.
			const neu =
				jetztTraktandum &&
				neutraktandenwahlDesHauses &&
				neueAnZweiterDesHauses.has(jetztTraktandum.knoten.id) &&
				// Die milde Wahl nur mit dem Drittel (Review DeepSeek zu Block 7, Befund 4).
				(neutraktandenwahlDesHauses === 'erste' ||
					tafelzeilen.find((z) => z.meetingId === einHaus?.meetingId)?.beschlussfaehig?.erfuellt === true)
					? // Am Abend ohne konsultative Abstimmung (`oeffneAmAbend`).
						[neuAnZweiterHinweis(neutraktandenwahlDesHauses, true, false)]
					: [];
			// L7 (Migration 183), wie in der Leitung des Hauses.
			const ausstand = ausstandssaetzeVorDemEroeffnen(ohneAusstandDesHauses);
			// L8 (Migration 184): der Satz zur Einstellung, je Wahl aus
			// derselben Serverfunktion wie das Eröffnen. Entscheid 8
			// (07.11.2026): wie in der Leitung des Hauses der Satz zur Wahl
			// trotz Häkchen, wenn das Erfordernis nach der Freigabe auf der
			// Wahl oder Wiederwahl der Verwaltung steht.
			const verwaltung = [
				...verwaltungssaetzeVorDemEroeffnen(verwaltungsvollmachtenDesHauses, teilentschiedenHinweis),
				...(ausstandAmGrundantrag ? [AUSSTAND_NICHT_GEERBT] : [])
			];
			const e = jetztTraktandum?.knoten.erfordernis;
			if (!e) return [...neu, ...ausstand, ...verwaltung];
			return [
				zirkularbeschlusshinweis(
					e,
					Boolean(jetztTraktandum && einladungsmehrDesHauses?.has(jetztTraktandum.knoten.id))
				),
				einstimmigkeitAusReglement(e, knotenDerFassung(e.fassung, e.knotenId)),
				// Zählweise des Hauses an der Einsprache, wie die Auszählung: die
				// Momentaufnahme des Hauses, sonst seine Gemeinschaft (Codeprüfung N1);
				// ab der Fassung 2026-10-28 der Kartensatz L3.
				einspracheZaehlweiseHinweis(
					e,
					momentaufnahme?.headCountMode ?? hausgemeinschaft?.headCountMode
				),
				// Die Lesart des Hauses, wie sie am Erfordernis eingefroren ist (Migration 169).
				lesartKartensatz(e),
				// A5, Punkt 12b: die hinterlegte Klausel gilt nicht an jedem Mehr; das
				// sagt die Leitung vor der Abstimmung (Rz. 99 ad Art. 712n).
				stichentscheidGrenzeKartensatz(e, momentaufnahme?.tieBreak ?? hausgemeinschaft?.tieBreak ?? 'keiner'),
				// Die Bestimmung zur Einlage in den Erneuerungsfonds (Migration 193), wie am Traktandum.
				fondsgrenzeKartensatz(e, hausgemeinschaft?.fondsgrenze),
				...neu,
				...ausstand,
				...verwaltung
			].filter((s): s is string => s !== null);
		})(),
		/** Alles, was die Eingriffe am laufenden Punkt brauchen. */
		eingriffe: einHaus && jetztTraktandum
			? {
					art: jetztTraktandum.knoten.art,
					/**
					 * Warum sich der Antrag gerade nicht zurückziehen lässt.
					 *
					 * Am Abend steht derselbe Eingriff wie im Haus; ohne diese Angabe
					 * liesse sich hier das Formular ausfüllen und der Server sagte
					 * danach ab (Code-Review 08.09.2026). Die Zusicherung prüft der
					 * Kern unabhängig davon.
					 */
					rueckzugHindernis:
						hindernisFuerRueckzug(
							await holeOffeneFolgeantraege(
								locals.benutzer.operatorId,
								einHaus.meetingId,
								jetztTraktandum.knoten.id
							)
						)?.meldung ?? null,
					hatErfordernis: Boolean(jetztTraktandum.knoten.erfordernis),
					erfordernisTitel: jetztTraktandum.knoten.erfordernis?.titel ?? '',
					/*
					 * **Der Quorumstyp in Worten, mit seiner Bezugsgrösse**
					 * (Praxisfund 03.10.2026; Produktentscheid 08.10.2026): Bis
					 * dahin nannte die Zeile Fall und Schwelle, aber nicht
					 * «Einfaches Mehr» — und wo der Typ stand, fehlte die Basis.
					 * Fassung des Erfordernisses, nicht die heute geltende.
					 */
					erfordernisBezeichnung: jetztTraktandum.knoten.erfordernis
						? bezeichnungMitBasis(
								holeRegelwerkFuerAnzeige(jetztTraktandum.knoten.erfordernis.fassung),
								jetztTraktandum.knoten.erfordernis
							)
						: null,
					betroffenenlage: betroffenenlage(jetztTraktandum.knoten.erfordernis ?? null),
					angehoerigenhinweis: angehoerigenhinweis(jetztTraktandum.knoten.erfordernis ?? null),
					// Die Zahl der Angehörigen im Ausstand (E1, Block D; L10).
					angehoerigenlesartHinweis: angehoerigenlesartHinweis(
						jetztTraktandum.knoten.erfordernis ?? null
					),
					/*
					 * Die stehende Warnung nach einer Milderung, im Haus, in dem das
					 * Traktandum steht (Produktentscheid 07.10.2026, Punkt 4a), wie in der
					 * Leitung der Versammlung.
					 */
					milderungshinweis:
						(await holeSaalhinweiseNachMilderung(op, einHaus.meetingId)).get(
							jetztTraktandum.knoten.id
						) ?? null,
					folgeantragHinweis,
					betroffene,
					/*
					 * Trifft der Folgeantrag andere Eigentümer als sein Grundantrag?
					 * (Block A3b). Dieselbe Rechnung, dieselben Bedingungen und derselbe
					 * Baustein wie im Haus, auch nur bei nötiger Zustimmung.
					 */
					betroffenenabweichung:
						jetztTraktandum.knoten.parentId &&
						fragtNachBetroffenenabweichung({
							spontanart: jetztTraktandum.knoten.spontanart,
							grundantragId: jetztTraktandum.knoten.parentId,
							art: jetztTraktandum.knoten.art,
							form: betroffenenlage(jetztTraktandum.knoten.erfordernis ?? null).form
						})
							? betroffenenabweichung(
									await holeBetroffene(op, einHaus.meetingId, jetztTraktandum.knoten.parentId),
									betroffene
								)
							: null,
					vetoStand,
					zurueckgezogen: Boolean(jetztTraktandum.knoten.rueckzug),
					/*
					 * Erst im Saal aufgenommen: dann kein Gegenantrag, wie im Haus
					 * (`domain/eingriffe.ts`, Codeprüfung 29.09.2026).
					 */
					spontan: jetztTraktandum.knoten.spontan ?? false,
					/** Mit Grund — damit die Rücknahme sagen kann, was zurückgenommen wird. */
					rueckzug: jetztTraktandum.knoten.rueckzug ?? null,
					/*
					 * Ob der laufende Punkt ein im Saal gestellter Folgeantrag ist — nur
					 * für den lässt sich die Zulässigkeit prüfen. Ein angekündigtes
					 * Traktandum braucht die Frage nicht: Es steht auf der Einladung.
					 */
					istFolgeantrag: Boolean(
						jetztTraktandum.knoten.spontan &&
							jetztTraktandum.knoten.spontanart === 'folgeantrag' &&
							jetztTraktandum.knoten.parentId !== null
					),
					/*
					 * Ob zu diesem Punkt ein Rückkommensantrag **noch wirkt** — dieselbe
					 * Rechnung wie im Haus, seit dem 24.08.2026 aus dem Kern.
					 */
					rueckkommenLaeuft: rueckkommen?.laeuft ?? false,
					/*
					 * Aus dem Stand des Abends, nicht aus der Ergebnisliste: Nach einer
					 * Ersetzung durch einen Folgeantrag hat der Grundantrag kein eigenes
					 * Ergebnis mehr und ist doch entschieden (Migration 133).
					 */
					abgestimmt: entschiedeneKennungen.has(jetztTraktandum.knoten.id),
					rueckkommenOffen: rueckkommenOffenBei.has(jetztTraktandum.knoten.id),
					grundantragEntschieden: grundantragDesFolgeantrags(jetztTraktandum.knoten.id) !== null,
					/*
					 * Ob der geltende Beschluss angenommen ist, für den Hinweis beim
					 * Rückkommen. Aus dem massgebenden Durchgang der Sache: Nach einer
					 * Ersetzung liegt er am Folgeantrag, und die Ergebnisliste des
					 * Schrittes kennt ihn nicht (Codeprüfung B2a, M-b).
					 */
					sacheAngenommen: await (async () => {
						const m = massgebenderDerSache(durchgaengeDesHauses, jetztTraktandum.knoten.id);
						return m?.zustand === 'geschlossen'
							? (await holeErgebnis(op, einHaus.meetingId, m.id)).auszaehlung?.angenommen === true
							: false;
					})(),
					parteien: (momentaufnahme?.parties ?? []).map((pp) => ({
						id: pp.partyId,
						name: pp.displayName
					})),
					// Vertreter ohne Partei zur Wahl beim Ausstand (Ä-26), wie im Haus.
					vertreterOhnePartei: (await holeVertreterOhnePartei(op, einHaus.meetingId)).map((v) => ({
						id: v.kennung,
						name: v.name,
						zusatz: `vertritt ${v.vertritt.join(', ')}; nicht Eigentümer`
					})),
					ausstand: ausstand.map((a) => ({ parteiId: a.parteiId })),
					/*
					 * Der Ausstand am Grundantrag, für die Erinnerung beim Folgeantrag
					 * (Befund C-02, 22.08.2026). Bis zum 26.09.2026 nur im Haus.
					 */
					ausstandAmGrundantrag: jetztTraktandum.knoten.parentId
						? (await holeAusstand(op, jetztTraktandum.knoten.parentId)).map((a) => ({
								id: a.id,
								name: a.name
							}))
						: [],
					/*
					 * Woran ein Folgeantrag hängen kann — dieselbe Regel wie im Haus,
					 * aus dem Kern (`domain/folgeantrag.ts`). Entschieden und
					 * zurückgezogen kamen am 07.09.2026 dazu: «Jetzt möglich» nennt
					 * dort längst keinen Gegenantrag mehr, die Auswahl bot ihn weiter
					 * an. `entschiedene` deckt den ganzen Abend ab und damit auch
					 * dieses Haus.
					 */
					grundantraege: traktandenDesHauses
						.filter((t) =>
							taugtAlsGrundantrag({
								art: t.knoten.art === 'abstimmung' ? 'abstimmung' : 'kenntnisnahme',
								spontan: t.knoten.spontan ?? false,
								entschieden: entschiedeneKennungen.has(t.knoten.id),
								durchgangOffen: offenerDurchgang?.traktandumId === t.knoten.id,
								zurueckgezogen: t.knoten.rueckzug != null,
								rueckkommenOffen: rueckkommenOffenBei.has(t.knoten.id)
							})
						)
						.map((t) => ({
							id: t.knoten.id,
							nummer: t.nummer,
							titel: t.knoten.titel,
							erfordernisTyp: t.knoten.erfordernis?.typ ?? null,
							einladungsmehr: einladungsmehrDesHauses.get(t.knoten.id) ?? null,
							// Vorauswahl der Betroffenen beim Folgeantrag (Block A3b).
							betroffene: t.knoten.betroffeneParteiIds ?? []
						}))
				}
			: null,
		/*
		 * **Am Haus des Schritts** (Codeprüfung Block 2, Teil 2, M2): Die
		 * Eingriffe gehören zu einem Haus, und gegen diese Liste vergleicht das
		 * Formular den Grundantrag. Jede Gemeinschaft kann ihre Lesarten anders
		 * eingestellt haben; ohne ein Haus gibt es kein Formular.
		 */
		erfordernisse:
			einHaus && stwegDesHauses
				? await waehlbareErfordernisseAmHaus(op, {
						meetingId: einHaus.meetingId,
						stwegId: stwegDesHauses
					})
				: waehlbareErfordernisse(holeRegelwerk()),
		nutzniessungen,
		ki,
		/** Was am behandelten Punkt gilt — und der Weg dahin, wie im Haus. */
		rueckkommen,
		folgeantragHinweis,
		erfassung: erfassungsstand.zeilen,
		erfassungssperren: erfassungsstand.sperren,
		handzaehlung: offenerDurchgang?.handzaehlung ?? null,
		einspracheZaehlung:
			einHaus && offenerDurchgang
				? await holeEinspracheZaehlung(op, einHaus.meetingId, offenerDurchgang.traktandumId)
				: null,
		summenhindernis: summenerfordernis ? summenhindernis(summenerfordernis) : null,
		summenvermerk: summenerfordernis ? summenvermerkNoetig(summenerfordernis) : null,
		betriebsart,
		notiz: einHaus && laufenderSchritt?.traktandumId
			? (notizen.get(laufenderSchritt.traktandumId) ?? '')
			: '',
		stand,
		wartende: eingang.flatMap((e) => e.wartende),
		saalmeldungen: eingang.flatMap((e) => e.saalmeldungen),
		eingangsparteien: eingang.flatMap((e) => e.parteien),
		anwesend: stand.reduce((s, z) => s + z.anwesend, 0),
		/** «4 von 5 beschlussfähig» — die Frage, auf die es im Saal ankommt. */
		beschlussfaehige: stand.filter((z) => z.beschlussfaehig?.erfuellt).length,
		stimmberechtigt: stand.reduce((s, z) => s + z.gesamt, 0),
		wandbild: wandbilder.size === 1 ? [...wandbilder][0] : null,
		/*
		 * Die Pause: Unterbrochen ist der Abend, sobald ein LAUFENDES Haus
		 * unterbrochen ist — dieselbe vorsichtige Richtung wie an der Wand, denn
		 * dort kann gerade niemand abstimmen. Liegen die Häuser auseinander,
		 * sagt `pausenEinig` es; die Seite bietet dann beide Wege an.
		 *
		 * **Der Kommentar hier behauptete bis zum 01.09.2026 das Gegenteil**
		 * («sonst zeigt die Seite keine»). An genau dieser Rechnung sind schon
		 * zwei Fassungen gescheitert; eine Doku, die das alte Verhalten
		 * beschreibt, ist der schnellste Weg zur dritten.
		 */
		pause: pausenstand.pause,
		/**
		 * Ob die Häuser beim Pausenstand übereinstimmen.
		 *
		 * Stand hier vorher nichts: Die Seite schloss aus `pause === null` auf
		 * Uneinigkeit und behauptete sie damit auch im Normalfall, in dem
		 * schlicht niemand unterbrochen hat.
		 */
		pausenEinig: pausenstand.einig,
		/** Der Dreischritt — dieselben drei Rollen wie in der einzelnen Leitung. */
		vorheriges: stelle > 0 ? alsZeile(schritte[stelle - 1]) : null,
		aktuelles: stelle >= 0 ? alsZeile(schritte[stelle]) : null,
		naechstes: alsZeile(schritte[stelle >= 0 ? stelle + 1 : 0]),
		liste: liste.map((z) => ({
			nummer: z.nummer,
			tiefe: z.tiefe,
			titel: z.tiefe === 2 ? (kurzname(z.titel) ?? z.titel) : z.titel,
			art: z.art,
			punktart: z.punktart,
			geschaeftId: z.geschaeftId,
			/** Nur bei einer Zeile, hinter der genau ein Traktandum steht. */
			traktandumId: z.traktandumId,
			// Die Versammlung dahinter — für den Weg ins Haus, wenn hier kein Knopf
			// mehr steht (entschiedener Punkt).
			meetingId: z.meetingId,
			/** Ob der Wortlaut in diesem Haus vom Punkt abweicht — der Fall, der einzeln zu führen ist. */
			abweichend: z.abweichend,
			antragswortlaut: z.antragswortlaut,
			gemeinschaft: kurzname(z.gemeinschaft),
			haeuser: z.haeuser,
			traktanden: z.traktanden
		})),
		haeuser: haeuser.map((h) => ({ id: h.versammlungId, name: h.name })),
		/**
		 * Der Terminvorschlag fürs Vertagen — der früheste zulässige Tag.
		 *
		 * Gerechnet im Kern (`tageSpaeter`) und nicht im Browser: Dieselbe
		 * Rechnung steht hinter der Vertagung im Haus, und zwei Rechnungen für
		 * eine Frist laufen auseinander.
		 */
		// **Aus der längsten Frist der beteiligten Häuser** (Migration 122): Der
		// Vorschlag gilt für alle, also muss er für alle zulässig sein.
		vertagungsvorschlag: tageSpaeter(tag.datum, geltendeZweitfrist(laengsteFrist) + 1),
		/*
		 * **Der Satz daneben muss zum Datum passen** (Code-Review 24.09.2026,
		 * Befund 2). Die Seite zeigte `FRISTLAUF` roh, also «die gesetzliche Frist
		 * von zehn Tagen», neben einem Vorschlag, der bei einer längeren
		 * Reglementsfrist den 21. Tag nannte. Im selben Hilfetext gelesen, wirkt
		 * das wie ein Rechenfehler der Anwendung.
		 */
		fristlauf: fristAmAbend(laengsteFrist),
		/**
		 * Welches Traktandum jedes Haus gerade führt.
		 *
		 * Damit die Liste je Gemeinschaft **einen** Knopf zeigen kann statt aller
		 * drei: aufrufen, wenn nichts läuft; abstimmen, wenn der Punkt aufgerufen
		 * ist; schliessen, wenn die Abstimmung offen ist. Drei Knöpfe nebeneinander
		 * sind für die Sitzungsleitung drei Entscheidungen, wo eine ansteht.
		 */
		aufgerufene: [...zustandJeHaus.values()]
			.map((z) => z.traktandumId)
			.filter((t): t is string => Boolean(t)),
		/**
		 * Über welche Traktanden schon entschieden ist (Auftraggeber, 25.08.2026: «und
		 * wenn 2.1 bereits abgestimmt, kann ich dort nicht nochmals abstimmen,
		 * wie es der button suggeriert»).
		 *
		 * Die Liste bot «Abstimmen» und «Aufrufen» weiter an; der Server wies
		 * beides ab. Im Saal liest sich das wie ein Defekt.
		 */
		entschiedene,
		offene: offene
			.filter((o) => o.offen)
			.map((o) => ({
				meetingId: o.meetingId,
				// Kurzname wie überall in dieser Sicht — der volle steht in der Liste
				// der Häuser am Fuss.
				gemeinschaft: kurzname(o.gemeinschaft) ?? o.gemeinschaft,
				traktandumId: o.offen!.traktandumId
			}))
	};
};

/**
 * Vier Handlungen, eine Mechanik: Jede wirkt auf alle Häuser des Punktes und
 * meldet, was gelang und was nicht. Ein Haus, das nicht mitkann, hält die
 * anderen nicht auf — am Abend sind die Häuser verschieden weit.
 */
function meldung(art: string, e: { gelungen: number; offen: { gemeinschaft: string; grund: string }[] }) {
	const nicht = e.offen.map((o) => `${o.gemeinschaft} (${o.grund})`).join(', ');

	/*
	 * **Null Erfolge sind keine gute Nachricht** (Code-Review 24.08.2026,
	 * Befund 8).
	 *
	 * Vorher stand auch dann ein grüner Hinweis da: «Aufgerufen in 0
	 * Gemeinschaften. Nicht möglich bei: A (…), B (…)». Im Saal liest man das
	 * Grün und fährt fort — ohne dass irgendwo etwas aufgerufen wäre. Ein
	 * Geschäft ohne Traktanden erzeugte sogar «Aufgerufen in 0 Gemeinschaften.»
	 * ganz ohne Zusatz.
	 */
	if (e.gelungen === 0) {
		return fail(400, {
			fehler:
				e.offen.length > 0
					? `Nirgends möglich: ${nicht}`
					: 'Zu diesem Punkt gibt es in keiner Gemeinschaft ein Traktandum.'
		});
	}

	const kern =
		e.gelungen === 1
			? `${art} in einer Gemeinschaft.`
			: `${art} in ${e.gelungen} Gemeinschaften.`;
	if (e.offen.length === 0) return { hinweis: kern };
	return { hinweis: `${kern} Nicht möglich bei: ${nicht}` };
}

export const actions: Actions = {
	/**
	 * Die Pause — für den ganzen Saal (Auftraggeber, 24.08.2026).
	 *
	 * **Eine Pause gilt nicht für eine Gemeinschaft, sondern für den Raum.** Wer
	 * unterbricht, unterbricht alle: Die Leute stehen auf und gehen hinaus. Sie
	 * je Haus zu setzen hiesse, in einem weiterzustimmen, während im anderen
	 * niemand mehr sitzt.
	 *
	 * Geschrieben wird trotzdem je Versammlung — wie jede Handlung des Abends.
	 */
	pause: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const an = text(daten.get('an')) === 'ja';
		const wortlaut = text(daten.get('pausentext'));
		const op = locals.benutzer.operatorId;

		const haeuser = await holeAbendhaeuser(op, params.id);

		/*
		 * **Ein laufendes Haus wird nicht ein zweites Mal unterbrochen**
		 * (Sicherheitsdurchgang 01.09.2026, als fachlicher Nebeneffekt gemeldet).
		 *
		 * `setzePause` mit `an=ja` setzt `paused_at = now()` und `pause_text`
		 * bedingungslos. Über den Knopf «In allen Gemeinschaften unterbrechen»,
		 * der aus einem gemischten Stand herausführt, hätte das bei den bereits
		 * unterbrochenen Häusern den Beginn zurückgesetzt und den Text von der
		 * Wand genommen — «Weiter um 20:15» wäre mitten in der Pause zu «Pause»
		 * geworden. Angleichen heisst, die anderen nachzuziehen, nicht die Pause
		 * neu zu beginnen.
		 *
		 * **Und der Text kommt von der bestehenden Pause**, wenn keiner mitkommt:
		 * Sonst stünde an der Wand des einen Hauses etwas anderes als am anderen,
		 * und die Wand des Abends zeigt nur eine davon.
		 *
		 * **Gezählt wird nur, was läuft** — dieselbe Regel wie in
		 * `pausenstand.ts` (Code-Review 01.09.2026, zweite Runde). Ein
		 * unterbrochen geschlossenes Haus behält `paused_at` und `pause_text`;
		 * ohne diese Filterung hätte sein alter Wandtext die laufenden Häuser
		 * überschrieben, und es wäre als «war es schon» gezählt worden, statt
		 * unter «Nicht möglich bei» zu erscheinen. Zwei Filter für eine Frage
		 * laufen auseinander.
		 */
		const lage = new Map(
			await Promise.all(
				haeuser.map(async (h) => {
					const v = await holeVersammlung(op, h.versammlungId);
					return [h.versammlungId, v?.zustand === 'laufend' ? (v.pause ?? null) : null] as const;
				})
			)
		);
		const bestehenderText = haeuser
			.map((h) => lage.get(h.versammlungId))
			.filter((p): p is { seit: string; text: string | null } => Boolean(p))
			.sort((a, b) => (a.seit < b.seit ? -1 : 1))[0]?.text;
		const satz = an ? (wortlaut || bestehenderText || null) : null;

		const offen: string[] = [];
		let gelungen = 0;
		let unveraendert = 0;
		for (const h of haeuser) {
			/*
			 * **Die Sprungmarke gilt in beide Richtungen.** Sie stand zuerst nur
			 * für `an=ja`; damit schrieb «Fortfahren» bei gemischtem Stand ein
			 * Ereignis «Versammlung fortgesetzt» in den Verlauf jedes Hauses, das
			 * nie unterbrochen war. Der Verlauf ist der Nachweis dessen, was im
			 * Saal geschah, nicht dessen, was jemand gedrückt hat.
			 */
			if (an === Boolean(lage.get(h.versammlungId))) {
				unveraendert++;
				continue;
			}
			try {
				await setzePause(handelnder(locals.benutzer), h.versammlungId, { an, text: satz });
				await verkuendeStand(op, h.versammlungId);
				gelungen++;
			} catch (fehler) {
				if (fehler instanceof FachlicherFehler) {
					offen.push(`${h.name} (${fehler.message})`);
					continue;
				}
				throw fehler;
			}
		}
		const zahlwort = (n: number) => `${n} ${n === 1 ? 'Gemeinschaft' : 'Gemeinschaften'}`;
		return {
			hinweis:
				(an
					? `Unterbrochen in ${zahlwort(gelungen)}${unveraendert > 0 ? `, ${zahlwort(unveraendert)} war es schon` : ''}. Abgestimmt werden kann erst wieder, wenn Sie fortfahren.`
					: `Fortgesetzt in ${zahlwort(gelungen)}${unveraendert > 0 ? `, ${zahlwort(unveraendert)} lief weiter` : ''}.`) +
				(offen.length > 0 ? ` Nicht möglich bei: ${offen.join(', ')}` : '')
		};
	},

	/**
	 * Was an der Wand steht — für alle Gemeinschaften des Abends zugleich.
	 *
	 * «Optisch soll Gruppe und Einzel identisch aussehen» (Auftraggeber, 24.08.2026).
	 * Der Abschnitt fehlte hier als einziger; ein gemeinsamer Bildschirm mit
	 * fünf verschiedenen Wandbildern wäre ohnehin keiner.
	 *
	 * Geschrieben wird wie bei jeder Handlung des Abends je Haus — ein Haus,
	 * das nicht läuft, hält die anderen nicht auf.
	 */
	wandbild: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const art = text(daten.get('art')) as Wandbildart;
		const eigener = text(daten.get('text')) || null;
		const op = locals.benutzer.operatorId;

		const haeuser = await holeAbendhaeuser(op, params.id);
		const offen: string[] = [];
		let gelungen = 0;
		for (const h of haeuser) {
			try {
				await setzeWandbild(handelnder(locals.benutzer), h.versammlungId, art, eigener);
				await verkuendeStand(op, h.versammlungId);
				gelungen++;
			} catch (fehler) {
				if (fehler instanceof FachlicherFehler) {
					offen.push(`${h.name} (${fehler.message})`);
					continue;
				}
				throw fehler;
			}
		}
		return {
			hinweis:
				`Wandbild in ${gelungen} ${gelungen === 1 ? 'Gemeinschaft' : 'Gemeinschaften'} gewechselt.` +
				(offen.length > 0 ? ` Nicht möglich bei: ${offen.join(', ')}` : '')
		};
	},

	aufrufen: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await rufeAmAbendAuf(
				handelnder(locals.benutzer),
				params.id,
				text(daten.get('geschaeft')),
				text(daten.get('traktandum')) || null
			);
			return meldung('Aufgerufen', e);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	zuruecknehmen: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const e = await nimmAmAbendZurueck(
			handelnder(locals.benutzer),
			params.id,
			text(daten.get('geschaeft')),
			// Leer heisst «alle Häuser des Punktes»; gesetzt heisst «nur dieses».
			text(daten.get('traktandum')) || null
		);
		return meldung('Aufruf zurückgenommen', e);
	},

	oeffnen: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		// Seit 25.09.2026 weist `oeffneAmAbend` ein leeres Traktandum über mehrere
		// Häuser ab; die Absage gehört als Satz auf die Seite, nicht als 500.
		try {
			const e = await oeffneAmAbend(
				handelnder(locals.benutzer),
				params.id,
				text(daten.get('geschaeft')),
				// Gesetzt heisst «nur dieses»; leer geht nur, wenn der Punkt in
				// höchstens einem Haus steht.
				text(daten.get('traktandum')) || null,
				// Geheime Abstimmung (Migration 141) mit Grundlage (165, 166; Ä-38).
				text(daten.get('geheim')) === 'ja'
					? {
							beschlossen: text(daten.get('geheimBeschlossen')) === 'ja',
							reglement: text(daten.get('geheimNachReglement')) === 'ja'
						}
					: null,
				// Die bestätigte Zuordnung (Ä-05, M4); fehlt das Feld, ohne Bestätigung.
				daten.has('zuordnung') ? text(daten.get('zuordnung')) : undefined
			);
			return meldung('Abstimmung eröffnet', e);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Die Beschlussfähigkeit in allen Gemeinschaften festhalten.
	 *
	 * Ohne Geschäftskennung: Festgestellt wird, wer im Saal ist, und der Saal
	 * gehört nicht zu einem Traktandum. Bei welchem Punkt jedes Haus steht,
	 * schreibt die Feststellung von sich aus mit.
	 */
	festhalten: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const e = await halteAmAbendFest(handelnder(locals.benutzer), params.id);
		if (e.gelungen === 0) {
			return fail(400, {
				fehler:
					e.offen.length > 0
						? `Nirgends möglich: ${e.offen.map((o) => `${o.gemeinschaft} (${o.grund})`).join(', ')}`
						: 'Zu diesem Abend gehört keine Gemeinschaft.'
			});
		}
		/*
		 * **Der Befund steht im Hinweis, nicht bloss die Zahl** (Auftraggeber,
		 * 25.08.2026): «wenn man die Beschlussfähigkeit feststellt, sollte dies
		 * dann auf dem Bildschirm auch angezeigt werden. Also welche
		 * Gemeinschaft ist beschlussfähig und welche nicht. […] der Monitor
		 * zeigt das an. Aber ein Text wäre noch gut, wenn man die Aktion
		 * drückt.»
		 *
		 * Vorher stand hier «Beschlussfähigkeit festgehalten in 5
		 * Gemeinschaften» — richtig und nutzlos: Festgehalten wird immer, die
		 * Frage ist ja gerade, WAS. Die Wand zeigt es auch; sie steht hinter
		 * dem, der gedrückt hat.
		 */
		const nicht =
			e.offen.length > 0
				? ` Nicht festgehalten bei: ${e.offen
						.map((o) => `${o.gemeinschaft} (${o.grund})`)
						.join(', ')}.`
				: '';
		return {
			hinweis: `Festgehalten. ${abendfeststellungssatz(e.befunde)}${nicht} ` +
				'Die Einträge bleiben stehen — auch wenn nachher jemand geht.'
		};
	},

	/**
	 * Das Votum zum laufenden Punkt (FR-46).
	 *
	 * **Der Anlass** (Auftraggeber, 24.08.2026): «Auch kann ich keine Voten
	 * hinschreiben.» In der Leitung eines Hauses gibt es das Feld seit dem
	 * 12.08.; am Abend fehlte es — und geschrieben wird, während gesprochen wird.
	 *
	 * Die Versammlung kommt aus dem Formular: Eine Route führt hier mehrere
	 * Häuser, und das Votum gehört in das Protokoll **des** Hauses, dessen Punkt
	 * gerade läuft.
	 */
	notiz: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await setzeProtokollnotiz(
				handelnder(locals.benutzer),
				await hausDesAbends(
					locals.benutzer.operatorId,
					params.id,
					text(daten.get('versammlung'))
				),
				text(daten.get('traktandum')),
				text(daten.get('notiz'))
			);
			return { hinweis: `Votum zu «${e.titel}» gesichert.` };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Für eine Partei stimmen (Auftraggeber, 24.08.2026).
	 *
	 * «Mir fehlt, dass der Versammlungsleiter für die anderen abstimmen darf —
	 * wenn man bspw. einen Auftrag erhalten hat von einem Eigentümer oder ein
	 * Eigentümer Probleme mit der Technik hat und man schnell reagieren muss.»
	 *
	 * Dieselbe Funktion wie in der Leitung eines Hauses, mit derselben Pflicht
	 * zur Begründung: Eine fremde Stimme, für die niemand einen Grund nennen
	 * kann, ist keine Stimme, sondern ein Eingriff.
	 */
	stellvertretend: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const versammlung = text(daten.get('versammlung'));
		const wahl = text(daten.get('wahl'));
		const parteiId = text(daten.get('partei'));

		if (wahl !== 'yes' && wahl !== 'no' && wahl !== 'abstain') {
			return fail(400, { fehler: 'Es ist keine Wahl getroffen.' });
		}
		if (!parteiId) return fail(400, { fehler: 'Es ist keine Partei gewählt.' });

		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, versammlung);
			const e = await gibStimmenAb(
				handelnder(locals.benutzer),
				versammlung,
				[{ parteiId, wahl: wahl as VoteChoice }],
				true,
				// Ob ein Grund Pflicht ist, entscheidet die Betriebsart — die Regel
				// steht im Kern (`pruefeStellvertretendeStimme`), nicht hier.
				text(daten.get('begruendung'))
			);
			await verkuendeStand(locals.benutzer.operatorId, versammlung);
			return {
				hinweis:
					`Stimme erfasst (${e.zeilen} ${e.zeilen === 1 ? 'Einheit' : 'Einheiten'}). ` +
					'Der Grund steht im Protokoll und im Verlauf.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Alle Stimmen von Hand erfassen — der Teilausfall: Server läuft, Netz weg.
	 *
	 * Ein Grund für den ganzen Durchgang genügt; vierzehnmal denselben Satz zu
	 * tippen wäre keine bessere Auskunft.
	 */
	/**
	 * Die Summen einer Handzählung — am Abend für **ein** Haus.
	 *
	 * Die Versammlung kommt aus dem Formular: Eine Route führt hier mehrere
	 * Häuser, und gezählt wird je Gemeinschaft. `hausDesAbends` prüft, dass sie
	 * zu diesem Abend gehört — sonst liesse sich über die Kennung in ein fremdes
	 * Haus schreiben.
	 */
	summen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const versammlung = text(daten.get('versammlung'));
		const zahl = (name: string) => {
			const w = Number(text(daten.get(name)));
			return Number.isFinite(w) ? w : NaN;
		};
		// Die zweite Zählung an der Einsprache (L3): leer bleibt `undefined`.
		const andereZahl = (name: string) => {
			const roh = text(daten.get(name));
			const w = Number(roh);
			return roh === '' || !Number.isFinite(w) ? undefined : w;
		};
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, versammlung);
			const zurueck = text(daten.get('zuruecknehmen')) === 'ja';
			await erfasseSummen(
				handelnder(locals.benutzer),
				versammlung,
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
			await verkuendeStand(locals.benutzer.operatorId, versammlung);
			return {
				hinweis: zurueck
					? 'Handzählung zurückgenommen. Jetzt lassen sich wieder einzelne Stimmen erfassen.'
					: `Von Hand gezählt: ${zahl('ja')} Ja, ${zahl('nein')} Nein, ` +
						`${zahl('enthaltung')} Enthaltung. Wer wie gestimmt hat, ist nicht festgehalten.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	erfassen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const versammlung = text(daten.get('versammlung'));

		const abgaben = [];
		for (const [schluessel, wert] of daten.entries()) {
			if (!schluessel.startsWith('wahl:')) continue;
			const wahl = String(wert);
			if (wahl !== 'yes' && wahl !== 'no' && wahl !== 'abstain') continue;
			abgaben.push({ parteiId: schluessel.slice('wahl:'.length), wahl: wahl as VoteChoice });
		}
		if (abgaben.length === 0) {
			return fail(400, { fehler: 'Es ist keine einzige Wahl getroffen. Es wurde nichts erfasst.' });
		}

		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, versammlung);
			const e = await gibStimmenAb(
				handelnder(locals.benutzer),
				versammlung,
				abgaben,
				true,
				text(daten.get('begruendung'))
			);
			await verkuendeStand(locals.benutzer.operatorId, versammlung);
			return {
				hinweis:
					`${abgaben.length} ${abgaben.length === 1 ? 'Partei' : 'Parteien'} erfasst ` +
					`(${e.zeilen} ${e.zeilen === 1 ? 'Einheit' : 'Einheiten'}).`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Ausstand erklären (ZGB Art. 68 i.V.m. Art. 712m Abs. 2).
	 *
	 * Wer über ein Geschäft mitentscheiden soll, das ihn selbst betrifft, ist
	 * vom Stimmrecht ausgeschlossen: Er stimmt nicht. Was das an den
	 * Bezugsgrössen ändert, hängt an der Basis (Kopf von `server/ausstand.ts`). Am
	 * Abend gilt das je Gemeinschaft; erklärt wird im Haus des laufenden
	 * Schrittes.
	 */
	ausstand: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const versammlung = text(daten.get('versammlung'));
		const parteien = daten
			.getAll('partei')
			.map((w) => text(w))
			.filter((w) => w.length > 0);
		if (parteien.length === 0) {
			return fail(400, {
				fehler: 'Niemand ausgewählt. Kreuzen Sie an, wer nicht mitentscheiden darf.'
			});
		}

		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, versammlung);
			const namen: string[] = [];
			const vertreter: string[] = [];
			for (const parteiId of parteien) {
				const a = await erklaereAusstand(
					handelnder(locals.benutzer),
					versammlung,
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
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Betroffene im Saal eintragen (Block A2), im Haus des laufenden
	 * Schrittes. Gebunden wie der Ausstand über `hausDesAbends`.
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
				handelnder(locals.benutzer),
				await hausDesAbends(locals.benutzer.operatorId, params.id, text(daten.get('versammlung'))),
				text(daten.get('traktandum')),
				parteien
			);
			return { hinweis: betroffenenmeldung(namen) };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	betroffeneAus: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const geaendert = await trageBetroffeneAus(
				handelnder(locals.benutzer),
				await hausDesAbends(locals.benutzer.operatorId, params.id, text(daten.get('versammlung'))),
				text(daten.get('traktandum')),
				text(daten.get('partei'))
			);
			if (!geaendert) throw new FachlicherFehler('unbekannt', 'Die Partei war bei diesem Traktandum nicht als betroffen eingetragen; nichts geändert.', 'partei');
			return { hinweis: 'Die Partei ist bei diesem Traktandum nicht mehr als betroffen eingetragen.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	vorabVermerken: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await vermerkeVorabZustimmung(
				handelnder(locals.benutzer),
				await hausDesAbends(locals.benutzer.operatorId, params.id, text(daten.get('versammlung'))),
				text(daten.get('traktandum')),
				text(daten.get('partei')),
				text(daten.get('vermerk'))
			);
			return { hinweis: 'Die Vorab-Zustimmung ist vermerkt.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	vorabZurueck: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const geaendert = await nimmVorabZustimmungZurueck(
				handelnder(locals.benutzer),
				await hausDesAbends(locals.benutzer.operatorId, params.id, text(daten.get('versammlung'))),
				text(daten.get('traktandum')),
				text(daten.get('partei'))
			);
			if (!geaendert) throw new FachlicherFehler('unbekannt', 'Bei dieser Partei war keine Vorab-Zustimmung vermerkt; nichts geändert.', 'partei');
			return { hinweis: 'Der Vermerk der Vorab-Zustimmung ist zurückgenommen.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Ausschlussklage: nur eine Person oder alle Eigentümer der gemeinsamen
	 * Wohnung beklagt (Migration 132). Gebunden wie die übrigen
	 * Betroffenen-Handlungen über `hausDesAbends`; die Schranken stehen in
	 * `setzeBeklagtenumfang`.
	 */
	beklagtenumfang: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const alle = text(daten.get('alle')) === 'ja';
		try {
			await setzeBeklagtenumfang(
				handelnder(locals.benutzer),
				await hausDesAbends(locals.benutzer.operatorId, params.id, text(daten.get('versammlung'))),
				text(daten.get('traktandum')),
				text(daten.get('partei')),
				alle
			);
			return { hinweis: beklagtenumfangMeldung(alle) };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Der mündliche Veto-Entscheid einer Betroffenen im Ausstand (26.09.2026).
	 *
	 * Gebunden wie die übrigen Betroffenen-Handlungen über `hausDesAbends`.
	 * Der Weg ist hier immer «mündlich, von der Sitzungsleitung erfasst»; den Entscheid am
	 * Telefon erfasst die Betroffene selbst.
	 */
	veto: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const entscheid = text(daten.get('entscheid'));
		if (entscheid !== 'ja' && entscheid !== 'nein') {
			return fail(400, { fehler: 'Unbekannter Veto-Entscheid.' });
		}
		try {
			const versammlung = await hausDesAbends(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('versammlung'))
			);
			const stand = await erfasseVeto(
				handelnder(locals.benutzer),
				versammlung,
				text(daten.get('traktandum')),
				text(daten.get('partei')),
				{ entscheid, weg: 'leitung', erfasstDurch: locals.benutzer.displayName }
			);
			// Offene Leitungsseiten des Hauses laden nach (N1). Das Telefon der
			// Betroffenen zieht nur bei einem Zustandswechsel nach und zeigt den
			// Entscheid erst beim nächsten Laden.
			await verkuendeStand(locals.benutzer.operatorId, versammlung);
			return {
				hinweis:
					`Der Entscheid von «${stand.name}» ist erfasst: ` +
					`${stand.entscheid === 'ja' ? 'Zustimmung' : 'keine Zustimmung'}.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/** Den Ausstand zurücknehmen — er war ein Entscheid, kein Zustand. */
	ausstandZurueck: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const zurueck = await nimmAusstandZurueck(
				handelnder(locals.benutzer),
				await hausDesAbends(
					locals.benutzer.operatorId,
					params.id,
					text(daten.get('versammlung'))
				),
				text(daten.get('ausstand'))
			);
			if (!zurueck) throw new FachlicherFehler('unbekannt', 'Es war kein Ausstand mehr eingetragen; nichts geändert.', 'ausstand');
			return { hinweis: 'Der Ausstand ist zurückgenommen; wer betroffen war, stimmt oder vertritt bei diesem Traktandum wieder.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Einen Antrag zurückziehen (FR-45).
	 *
	 * **Zurückgezogen ist nicht abgelehnt** — es entsteht kein Durchgang und kein
	 * Ergebnis. Das Traktandum bleibt auf der Liste und erscheint im Protokoll
	 * mit seinem Grund.
	 */
	zurueckziehen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const versammlung = text(daten.get('versammlung'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, versammlung);
			const t = await ziehAntragZurueck(
				handelnder(locals.benutzer),
				versammlung,
				text(daten.get('traktandum')),
				text(daten.get('grund'))
			);
			// Die Wand zeigt das Geschäft sonst weiter, als stünde es noch an.
			await verkuendeStand(locals.benutzer.operatorId, versammlung);
			return { hinweis: `«${t.titel}» ist zurückgezogen — nicht abgelehnt.` };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Entscheid 0045, Punkt 11, wie in der Leitung des Hauses: die Angabe der
	 * Leitung an einem Folgeantrag mit Häkchen, im Haus des laufenden
	 * Schrittes. Gebunden wie der Ausstand über `hausDesAbends`.
	 */
	verwaltungsangabe: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await gibVerwaltungsangabe(
				handelnder(locals.benutzer),
				await hausDesAbends(locals.benutzer.operatorId, params.id, text(daten.get('versammlung'))),
				text(daten.get('traktandum')),
				text(daten.get('grund'))
			);
			return { hinweis: VERWALTUNGSANGABE_GEMACHT };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	verwaltungsangabeZurueck: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await nimmVerwaltungsangabeZurueck(
				handelnder(locals.benutzer),
				await hausDesAbends(locals.benutzer.operatorId, params.id, text(daten.get('versammlung'))),
				text(daten.get('traktandum'))
			);
			return { hinweis: VERWALTUNGSANGABE_ZURUECK };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/** Einen Rückkommensantrag stellen (FR-44). */
	rueckkommen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const t = await stelleRueckkommensantrag(
				handelnder(locals.benutzer),
				await hausDesAbends(
					locals.benutzer.operatorId,
					params.id,
					text(daten.get('versammlung'))
				),
				text(daten.get('traktandum'))
			);
			return {
				hinweis:
					`«${t.titel}» steht als Antrag auf der Liste. Rufen Sie ihn auf und lassen Sie ` +
					'darüber abstimmen — erst bei Annahme wird die Sache erneut behandelt.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/** Eine weitere Sache aufnehmen (FR-44, FR-60) — dieselbe Arbeit wie im Haus. */
	aufnehmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const aufgenommen = await nimmImSaalAuf(
				handelnder(locals.benutzer),
				await hausDesAbends(
					locals.benutzer.operatorId,
					params.id,
					text(daten.get('versammlung'))
				),
				daten,
				// Der Hinweis erscheint auf dieser Seite und nennt deren Wege
				// (Codeprüfung N1, dritte Runde 06.10.2026).
				'abend'
			);
			// Die Warnung getrennt von der Quittung, damit sie stehen bleibt
			// (siehe `Saalaufnahme.warnung`).
			return {
				hinweis: aufgenommen.hinweis,
				warnung: aufgenommen.warnung,
				aufgenommen: aufgenommen.traktandumId
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Die Reihenfolge während der Sitzung ändern — ein Ordnungsentscheid (FR-14).
	 *
	 * **Der Anlass** (Auftraggeber, 24.08.2026): «Das Sortieren fehlt bei den
	 * Traktanden.» Die Leitung einer einzelnen Versammlung kann es seit dem
	 * 21.08.; am Abend gab es nur das Ziehen auf der Pflegeseite, und im Saal
	 * zieht niemand mit der Maus.
	 *
	 * **Die Seite schickt eine Stelle, der Kern rechnet den Ablegepunkt.** Ein
	 * leeres Feld wird bewusst zu `NaN` und nicht zu 0: `Number('')` ist null,
	 * und daraus würde «ganz nach vorne» — eine Wirkung, die niemand bestellt
	 * hat.
	 */
	verschieben: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const geschaeft = text(daten.get('geschaeft'));
		const rohe = text(daten.get('stelle')).trim();
		const stelle = rohe === '' ? NaN : Number(rohe);
		if (!Number.isFinite(stelle)) {
			return fail(400, { fehler: 'Geben Sie die Stelle im Ablauf an, an die der Punkt rücken soll.' });
		}

		const op = locals.benutzer.operatorId;
		const punkte = gemeinsameListe(await holeGemeinsameListe(op, params.id)).filter(
			(z) => z.tiefe === 1
		);
		try {
			await verschiebeGeschaeft(
				handelnder(locals.benutzer),
				params.id,
				geschaeft,
				ablegepunkt(
					punkte.map((z) => z.geschaeftId),
					geschaeft,
					stelle
				)
			);
			return { hinweis: 'Reihenfolge geändert — die Nummern sind nachgezogen.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Die Reihenfolge der Gemeinschaften innerhalb eines Punktes (7.1 ↔ 7.2).
	 *
	 * «Kann ja sein, dass die Auswahl uneinheitlich ist oder abweicht von anderen
	 * Abstimmungen mit denselben Gemeinschaften» (Auftraggeber, 11.08.2026) — und am
	 * 24.08.2026: «Jetzt sind wieder die Sortierbarkeit der Traktanden und
	 * Subtraktanden verschwunden.» Welche Gemeinschaft zuerst abstimmt,
	 * entscheidet sich manchmal erst im Saal.
	 */
	umordnen: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const geschaeft = text(daten.get('geschaeft'));
		const traktandum = text(daten.get('traktandum'));
		const rohe = text(daten.get('stelle')).trim();
		const stelle = rohe === '' ? NaN : Number(rohe);
		if (!Number.isFinite(stelle)) {
			return fail(400, { fehler: 'Geben Sie die Stelle an, an der diese Gemeinschaft abstimmt.' });
		}

		const op = locals.benutzer.operatorId;
		const unter = gemeinsameListe(await holeGemeinsameListe(op, params.id)).filter(
			(z) => z.tiefe === 2 && z.geschaeftId === geschaeft
		);
		try {
			await verschiebeInGeschaeft(
				handelnder(locals.benutzer),
				params.id,
				geschaeft,
				traktandum,
				ablegepunkt(
					unter.map((z) => z.traktandumId ?? ''),
					traktandum,
					stelle
				)
			);
			return { hinweis: 'Reihenfolge in diesem Punkt geändert — die Ziffern sind nachgezogen.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},


	/**
	 * Der Text zum Beschluss — am Abend wie im Haus (Auftraggeber, 09.09.2026).
	 *
	 * Die Versammlung kommt aus dem Formular und wird gegen den Abend der Adresse
	 * geprüft; kein `verkuendeStand`, weil der Text am Ergebnis nichts ändert.
	 */
	beschlusstext: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const versammlung = text(daten.get('versammlung'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, versammlung);
			const d = await haltBeschlusstextFest(
				handelnder(locals.benutzer),
				versammlung,
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
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Der Stichentscheid bei Stimmengleichheit (Story 7.9) — auch am Abend.
	 *
	 * **Warum er hier fehlte** (24.08.2026). Weist das Reglement die Entscheidung
	 * bei Stimmengleichheit dem Verwalter zu, hält die Anwendung an und fragt,
	 * statt ein Ergebnis zu erfinden. Am gemeinsamen Abend gab es die Frage
	 * nicht: Die Steuerung zeigte «Stichentscheid steht aus» und bot nichts an.
	 * Wer dort hineinlief, kam nur über die Hausansicht weiter — und die führt
	 * die Liste des Abends nicht.
	 */
	stichentscheid: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const versammlung = await hausDesAbends(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('versammlung'))
			);
			// Ein fehlendes oder unbekanntes `wahl`-Feld still als Nein zu werten
			// hiesse: Aus einer kaputten Anfrage wird eine Ablehnung, und die wird
			// festgeschrieben und verkündet. Die Absage gehört hierher, nicht in
			// den Eintrag.
			const wahl = text(daten.get('wahl'));
			if (wahl !== 'yes' && wahl !== 'no') {
				throw new FachlicherFehler('unbekannt', 'Unbekannter Entscheid.', 'wahl');
			}
			await haltStichentscheidFest(handelnder(locals.benutzer), versammlung, text(daten.get('durchgang')), {
				wahl,
				wer: text(daten.get('wer')),
				begruendung: text(daten.get('begruendung')) || undefined,
				// Die zweite Stimme (Migration 150): nur ein ausdrückliches Häkchen.
				eigentuemer: daten.get('eigentuemer') === 'ja'
			});
			await verkuendeStand(locals.benutzer.operatorId, versammlung);
			return {
				hinweis:
					'Der Stichentscheid ist festgehalten und das Ergebnis verkündet. Der Entscheid steht ' +
					'mit Namen in der Auswertung und im Verlauf.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/** Einen Durchgang als überholt vermerken und neu abstimmen lassen. */
	neuabstimmung: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const versammlung = text(daten.get('versammlung'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, versammlung);
			await setzeNeuabstimmungAn(
				handelnder(locals.benutzer),
				versammlung,
				text(daten.get('durchgang')),
				text(daten.get('begruendung'))
			);
			await verkuendeStand(locals.benutzer.operatorId, versammlung);
			return {
				hinweis:
					'Der bisherige Durchgang ist als überholt vermerkt und bleibt einsehbar. ' +
					'Geben Sie die Abstimmung erneut frei, wenn Sie so weit sind.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Einen im Saal gestellten Antrag prüfen lassen (FR-60) — auch am Abend.
	 *
	 * Die Zulassung hängt an der Gemeinschaft, deshalb wird sie hier für das
	 * Haus des Antrags geprüft und nicht einmal für den Abend: Zwei Gemeinschaften
	 * desselben Abends können verschieden entschieden haben.
	 */
	kiantrag: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const op = locals.benutzer.operatorId;
		const traktandumId = text(daten.get('traktandumId'));

		/*
		 * **Mit Absage statt Wurf** (F7, 15.10.2026). `hausDesAbends` weist ein
		 * Haus ab, das nicht zum Abend gehört, und `pruefeAntrag` ein
		 * Traktandum, das nicht an der Versammlung hängt oder dessen Kennung
		 * leer oder verstellt ist. Beides sind FachlicheFehler, und ohne diesen
		 * Fang wurden daraus 500-Seiten — mitten in der Sitzung.
		 */
		try {
			const meetingId = await hausDesAbends(op, params.id, text(daten.get('versammlung')));
			const v = await holeVersammlung(op, meetingId);
			const g = v ? await holeGemeinschaft(op, v.stwegId) : null;

			const erlaubt = verfuegbarkeit(
				{
					eingerichtet: await kiEingerichtet(op),
					zugelassen: g?.aiEnabled ?? false,
					offline: false,
					ausgenommen: g?.aiDisabledFunctions ?? [],
					hinweiseAusblenden: (await holeBetreiber(op))?.kiHinweiseAusblenden === true
				},
				'antragspruefung'
			);
			if (!erlaubt.verfuegbar) return fail(400, { fehler: erlaubt.grund ?? '' });

			// `hausDesAbends()` hat `meetingId` schon gegen den Abend geprüft, und für
			// genau diese Versammlung fragt die Schale oben die KI-Zulassung ab. Das
			// Traktandum muss deshalb an ihr hängen, nicht bloss irgendwo am Abend:
			// Ein Abend fasst mehrere Gemeinschaften, und die Zulassung hängt an einer.
			const ergebnis = await pruefeAntrag(handelnder(locals.benutzer), traktandumId, meetingId);
			return { antragspruefung: { traktandumId, ...ergebnis } };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/** Was die Sitzungsleitung mit der Einschätzung gemacht hat (FR-60, FR-63). */
	kiantragentscheid: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			/*
			 * **Der Abend, nicht die Versammlung.** Hier steht in der Adresse die
			 * Kennung des gemeinsamen Abends; die Nutzung haengt an einer seiner
			 * Versammlungen. Die Bindung prueft genau das (Code-Review 02.09.2026).
			 */
			await haltAntragsentscheidFest(
				handelnder(locals.benutzer),
				text(daten.get('nutzungId')),
				{ art: 'abend', tagId: params.id },
				verlangeEntscheid(text(daten.get('entscheid')))
			);
			return { hinweis: 'Im Nachweis festgehalten.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/** Einen Rückzug zurücknehmen — er war ein Entscheid, kein Zustand (FR-45). */
	rueckzugZurueck: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const versammlung = text(daten.get('versammlung'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, versammlung);
			await nimmRueckzugZurueck(
				handelnder(locals.benutzer),
				versammlung,
				text(daten.get('traktandum'))
			);
			await verkuendeStand(locals.benutzer.operatorId, versammlung);
			return { hinweis: 'Rückzug zurückgenommen. Der Antrag steht wieder zur Abstimmung.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/*
	 * **Wer am Eingang wartet, wartet auch während der Sitzung** — dieselben vier
	 * Handlungen wie auf der Anwesenheitsseite. Sie stehen in der Leitung, weil
	 * wer während einer Abstimmung erst die Seite wechseln muss, den Menschen
	 * stehen lässt (so begründet in `Einlass.svelte` seit dem 12.08.2026).
	 */
	bestaetigen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const meetingId = await hausDesAbends(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('meeting'))
			);
			const e = await bestaetigeAnwesenheit(
				handelnder(locals.benutzer),
				meetingId,
				text(daten.get('partei'))
			);
			/*
			 * **Auch hier der Vermerk** (10.09.2026, im Code-Review gefunden). Diese
			 * Handlung ist dieselbe Freigabe wie am Eingang des Abends, nur von der
			 * Leitungsseite aus — sie schrieb die Anwesenheit und liess die Antwort
			 * auf «digital oder von Hand» fallen. Der Wächter in
			 * `scripts/lib/papiereingang` hat sie nicht gesehen, weil seine
			 * Sichtprobe diese Datei nicht aufzählte.
			 */
			/*
			 * **`e.parteiId` und nicht der eingegebene Wert** (Sicherheitsdurchgang
			 * 10.09.2026). `findeZiel` nimmt beide Kennungen entgegen, die der Partei
			 * und die der Momentaufnahme; der Vermerk kennt nur die aus den
			 * Stammdaten. Wer die Eingabe durchreicht, bekommt im ungünstigen Fall
			 * eine Anwesenheit, die steht, und einen Vermerk, der mit
			 * «unbekannte Partei» danebenfällt. So steht es auch im Kommentar an
			 * `Erfassungsergebnis.parteiId`, und mein erster Anlauf hier las ihn nicht.
			 */
			const p = await papiervermerkAusFormular(locals, meetingId, e.parteiId, daten);
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return {
				hinweis: `${e.name} ist freigegeben und gilt als anwesend.${p.satz}`,
				papier: p.papier
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	ablehnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const meetingId = await hausDesAbends(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('meeting'))
			);
			await lehneAnmeldungAb(
				handelnder(locals.benutzer),
				meetingId,
				text(daten.get('partei'))
			);
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return { hinweis: 'Anmeldung abgelehnt.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	saalZuordnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const meetingId = await hausDesAbends(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('meeting'))
			);
			const e = await ordneSaalmeldungZu(
				handelnder(locals.benutzer),
				meetingId,
				text(daten.get('meldung')),
				text(daten.get('partei'))
			);
			// Dieselbe Lücke wie bei `bestaetigen` darüber, und derselbe Schluss —
			// samt der aufgelösten Kennung statt der eingegebenen.
			const p = await papiervermerkAusFormular(locals, meetingId, e.parteiId, daten);
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return { hinweis: `${e.name} ist als anwesend erfasst.${p.satz}`, papier: p.papier };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Den Vermerk «stimmt von Hand» wieder wegnehmen.
	 *
	 * **Weil diese Seite ihn jetzt setzen kann, muss sie ihn wegnehmen können**
	 * (die zweite Regel in `scripts/lib/papiereingang`). Der Kasten
	 * `Papierentscheid` steht fünf Sekunden über der Liste; danach führt der Weg
	 * über den Eingang des Abends, wo der Vermerk an der Zeile steht.
	 *
	 * Wortgleich zur Handlung auf `/tage/<id>/einlass`. Die Versammlung kommt aus
	 * dem Formular und nicht aus dem Pfad: Hier ist `params.id` der Abend, und
	 * `hausDesAbends` prüft, dass das genannte Haus zu ihm gehört.
	 */
	papierZuruecknehmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, meetingId);
			const weg = await hebePapierabgabeAuf(
				handelnder(locals.benutzer),
				meetingId,
				text(daten.get('partei'))
			);
			// Der Vermerk sperrt das Telefon der Partei; wer ihn wegnimmt, gibt es
			// wieder frei. Ohne Verkündung erführe das Gerät es erst beim Nachladen.
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return weg
				? { hinweis: 'Zurückgenommen — die Partei stimmt digital ab.' }
				: { hinweis: 'Es war kein Vermerk gesetzt; nichts geändert.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	saalAblehnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const meetingId = await hausDesAbends(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('meeting'))
			);
			await lehneSaalmeldungAb(
				handelnder(locals.benutzer),
				meetingId,
				text(daten.get('meldung'))
			);
			return { hinweis: 'Meldung abgelehnt.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	/**
	 * Die Versammlungen des Abends schliessen (24.08.2026).
	 *
	 * **Der letzte Schritt fehlte ganz.** Geschlossen wurde bis hierher nur auf
	 * der Seite eines einzelnen Hauses — am Ende eines gemeinsamen Abends, wenn
	 * alle aufstehen, fünf Wechsel nacheinander. Wer den letzten vergisst, hat
	 * eine Woche später eine Versammlung, die noch läuft.
	 *
	 * **Mit Rückfrage in der Maske**, anders als beim Unterbrechen: Schliessen
	 * ist der eine Schritt, der sich nicht zurücknehmen lässt. Danach sind die
	 * Zugänge entwertet und offene Abstimmungen mitgeschlossen.
	 */
	/*
	 * abend: versammlung — wie beim Eröffnen: `schliesseAmAbendGanz` holt die
	 * Häuser über `params.id` und filtert danach auf diese Kennung; eine fremde
	 * ergibt eine leere Auswahl und wirft `fremdes_haus`.
	 */
	abschliessen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const befund = await schliesseAmAbendGanz(
				handelnder(locals.benutzer),
				params.id,
				text(daten.get('versammlung')) || null
			);
			for (const b of befund.filter((x) => x.ergebnis === 'getan')) {
				await verkuendeStand(locals.benutzer.operatorId, b.meetingId);
			}
			return {
				hinweis:
					hausbefundssatz(befund, 'geschlossen') +
					(befund.some((b) => b.ergebnis === 'getan')
						? ' Die Protokolle stehen bereit.'
						: '')
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	},

	schliessen: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const e = await schliesseAmAbend(
			handelnder(locals.benutzer),
			params.id,
			text(daten.get('geschaeft')),
			// Leer heisst «alle Häuser des Punktes»; gesetzt heisst «nur dieses».
			text(daten.get('traktandum')) || null
		);
		return meldung('Abstimmung geschlossen', e);
	},

	/** Die laufende Abstimmung zu einem Punkt ohne Ergebnis abbrechen (H6). */
	abbrechen: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const e = await brecheAbAmAbend(
			handelnder(locals.benutzer),
			params.id,
			text(daten.get('geschaeft')),
			text(daten.get('begruendung')),
			text(daten.get('traktandum')) || null
		);
		return meldung('Abstimmung ohne Ergebnis abgebrochen', e);
	},

	/**
	 * Mehrere Häuser vertagen — in einem Zug, auf **einen** Termin.
	 *
	 * **Der Fall** (Auftraggeber, 25.08.2026): «Wenn nur eine von fünf einheiten
	 * beschlussfähig sind, wird die Sitzung mit der beschlussfähigen
	 * Gemeinschaft durchgeführt. Die anderen brauchen einen neuen Termin,
	 * frühestens in 10 Tage später.»
	 *
	 * Die gewählten Häuser kommen als mehrfaches Feld `versammlung` — die
	 * Häkchenliste im Formular. Was daraus entsteht, sagt der Hinweis mit
	 * Namen: Wer im Saal steht, muss danach wissen, wer weitertagt.
	 */
	/*
	 * abend: versammlung — die Häkchenliste kommt als mehrfaches Feld;
	 * `vertageAmAbend` schneidet sie gegen die Häuser des Abends aus
	 * `params.id` und lässt bei leerem Schnitt nichts geschehen. Eine
	 * untergeschobene Kennung fällt dort heraus, statt hier geprüft zu werden.
	 */
	vertagen: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await vertageAmAbend(handelnder(locals.benutzer), params.id, {
				versammlungen: daten.getAll('versammlung').map(String).filter(Boolean),
				grund: text(daten.get('grund')),
				datum: text(daten.get('datum')) || undefined
			});

			/*
			 * Die vertagten Häuser sind geschlossen — Wand und Telefone müssen es
			 * erfahren, sonst steht dort weiter der alte Punkt. Verkündet wird je
			 * **vertagter Versammlung**, nicht für den Abend: Die Ströme hängen an
			 * der Versammlung, und die Folgeversammlung hört noch niemand ab.
			 */
			for (const b of e.befunde) {
				await verkuendeStand(locals.benutzer.operatorId, b.versammlungId);
			}

			if (e.gelungen === 0) {
				return fail(400, {
					fehler: `Nirgends möglich: ${e.offen
						.map((o) => `${o.gemeinschaft} (${o.grund})`)
						.join(', ')}`
				});
			}

			const nicht =
				e.offen.length > 0
					? ` Nicht vertagt: ${e.offen.map((o) => `${o.gemeinschaft} (${o.grund})`).join(', ')}.`
					: '';
			return {
				hinweis:
					`Vertagt: ${e.befunde.map((b) => b.gemeinschaft).join(', ')}. ` +
					`Die Folgeversammlungen stehen als Entwurf bereit, ${datumLang(e.datum)}, ` +
					`als eigener gemeinsamer Abend. ${folgestufenSatz(e.befunde)}${nicht}`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	}
};
