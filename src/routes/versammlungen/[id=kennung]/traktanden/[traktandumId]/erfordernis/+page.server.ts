import { FONDSGRENZE_ANTWORTEN, FONDSGRENZE_FRAGE, fondsgrenzeSatz, fondsgrenzeSchrankeSatz } from '$lib/domain/fondsgrenze';
import { error, fail, redirect } from '@sveltejs/kit';
import { FREMDES_TRAKTANDUM } from '$lib/domain/fehler';
import { pruefeRueckweg } from '$lib/domain/rueckweg';

/**
 * Wohin nach dem Festlegen der Mehrheit.
 *
 * Aus dem Saal zurück in den Saal, aus der Vorbereitung in die Traktandenliste
 * — die Prüfung des Weges steht im Kern (`domain/rueckweg`), damit sie prüfbar
 * ist und nicht in einer Route versteckt.
 */
function zurueckweg(url: URL, versammlungId: string): string {
	return pruefeRueckweg(
		url.searchParams.get('zurueck'),
		versammlungId,
		`/versammlungen/${versammlungId}/traktanden`
	);
}
import { holeRegelwerk } from '$lib/rules';
import {
	ANFECHTUNGSHINWEIS,
	erfordernisAus,
	ergebniskarte,
	laufe,
	REGLEMENTSBRUCHHINWEIS,
	setzeErfordernis,
	uebersteuere,
	urheberschaft,
	WAEHLBARE_TYPEN,
	basisbezeichnung,
	waehlbareBasen,
	AUSSCHLUSSKLAGE_KNOTEN,
	angehoerigeBeimSetzen,
	beklagtenwohnungZaehltMit,
	type Kennzahlen
} from '$lib/domain/entscheidbaum';
import {
	enthaltungNachWahl,
	enthaltungseinstellungVon,
	karteMitEnthaltung,
	zaehlweiseFuerKarte,
	karteMitReglement,
	wendeReglementAn,
	zahlenbeispielNachZaehlweise
} from '$lib/domain/reglement';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Ergebnistyp } from '$lib/domain/regelwerk';
import { text } from '$lib/server/formular';
import { holeDurchgaenge, holeRueckkommenOffen } from '$lib/server/abstimmung';
import { entscheidetDasGeschaeft } from '$lib/domain/konsultativ';
import { durchAnderesTraktandumErsetzt } from '$lib/domain/abstimmung';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { stimmkraftAnsicht } from '$lib/server/eigentuemer';
import { holeEnthaltungseinstellung, holeReglementsregeln } from '$lib/server/reglement';
import { knotenNachLesart } from '$lib/domain/lesarten';
import { holeLesarten } from '$lib/server/lesarten';
import { holeVersammlung } from '$lib/server/versammlungen';
import { kiEingerichtet } from '$lib/server/ki';
import { holeVorschlag, vorschlagAmHaus } from '$lib/server/erfordernisvorschlag';
import { holeBetroffene } from '$lib/server/betroffene';
import { vermerkeEntscheid } from '$lib/server/ki';
import { verfuegbarkeit, verlangeEntscheid } from '$lib/domain/ki';
import {
	ERFORDERNIS_NACH_DER_ABSTIMMUNG,
	haltErfordernisAmTraktandumFest,
	holeTraktanden
} from '$lib/server/traktanden';
import type { Actions, PageServerLoad } from './$types';
import { holeBetreiber } from '$lib/server/betreiber';
import { holeEinladungsmehrInWorten } from '$lib/server/einladungsmehr';

/**
 * Das Erfordernis für ein bestimmtes Traktandum.
 *
 * Derselbe Entscheidbaum wie unter /quorum, aber mit einem Ziel: Am Ende hängt
 * das Ergebnis am Traktandum und trägt dessen Fassungskennung (AD-4). Der
 * Rechner unter /quorum bleibt daneben bestehen — er ist zum Nachschlagen da,
 * ohne dass etwas gesetzt wird.
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const traktanden = await holeTraktanden(locals.benutzer.operatorId, params.id);
	const eintrag = traktanden.find((t) => t.knoten.id === params.traktandumId);
	// Derselbe Sachverhalt wie in den Aktionen darunter, also derselbe Satz.
	if (!eintrag) error(404, FREMDES_TRAKTANDUM);

	const regelwerk = holeRegelwerk();
	const [gemeinschaft, regeln, durchgaenge, lesarten] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		holeReglementsregeln(locals.benutzer.operatorId, versammlung.stwegId),
		holeDurchgaenge(locals.benutzer.operatorId, params.id),
		holeLesarten(locals.benutzer.operatorId, { meetingId: params.id })
	]);

	// Zwei der drei Schranken, die `haltErfordernisAmTraktandumFest` durchsetzt.
	// Sie hier nachzubilden ist kein zweites Regelwerk, sondern die Auskunft
	// darüber, was der Server annehmen wird — ein Formular anzuzeigen, das
	// nachher abgewiesen wird, wäre im Saal die schlechtere Antwort. Die dritte,
	// das Mehr der Einladung (`achteEinladungsmehr`), hängt am gewählten Mehr;
	// die Seite nennt sie deshalb nur (`einladungsmehr`), der Server entscheidet.
	const geschlossen =
		versammlung.zustand === 'geschlossen' || versammlung.zustand === 'versiegelt';
	// Auch nach einer Ersetzung durch einen Folgeantrag, wie der Server
	// (`durch_anderes_traktandum_ersetzt`, Migration 133).
	// Nach einem angenommenen Rückkommen wieder frei, wie der Server (H6).
	// Nach einer konsultativen Abstimmung ebenso (H7, Teil D).
	const schonAbgestimmt =
		(durchgaenge.some(
			(d) => d.traktandumId === params.traktandumId && entscheidetDasGeschaeft(d)
		) ||
			durchAnderesTraktandumErsetzt(durchgaenge, params.traktandumId)) &&
		!(await holeRueckkommenOffen(locals.benutzer.operatorId, params.id, params.traktandumId));

	// Die Zahlen dieser Gemeinschaft, zum Datum der Versammlung — nicht zu heute.
	// Eine Nachbereitung im Dezember rechnete sonst mit einem anderen Bestand als
	// die Versammlung im September.
	let kennzahlen: Kennzahlen | null = null;
	if (gemeinschaft && gemeinschaft.quotaDenominator > 0) {
		const stimmkraft = await stimmkraftAnsicht(
			locals.benutzer.operatorId,
			versammlung.stwegId,
			versammlung.datum
		);
		/*
		 * **Die gemeinsame Wohnung des Beklagten** (Codeprüfung 30.09.2026, M3).
		 * Ab Fassung 2026-10-11 bleibt sie an der Ausschlussklage in der Basis,
		 * ausser alle Eigentümer der Wohnung sind beklagt (Migration 132). Gefragt
		 * wird nach der Fassung, mit der diese Seite herleitet; das Beispiel steht
		 * nur auf dieser Karte.
		 */
		const betroffene = eintrag.knoten.betroffeneParteiIds.length;
		const beklagtenwohnungen =
			betroffene > 0 &&
			beklagtenwohnungZaehltMit({
				knotenId: AUSSCHLUSSKLAGE_KNOTEN,
				kopfbasis: 'alle_ausser_betroffene',
				fassung: regelwerk.fassung
			})
				? (await holeBetroffene(locals.benutzer.operatorId, params.id, params.traktandumId)).filter(
						(b) => b.gemeinsam && !b.alleEigentuemerBeklagt
					).length
				: 0;
		kennzahlen = {
			kopfstimmen: stimmkraft.summeKopfstimmen,
			// Für die Einsprache nach L3 je Eigentümer (`kennzahlenNachZaehlweise`).
			eigentuemer: stimmkraft.summeEigentuemer,
			gesamtquote: gemeinschaft.quotaDenominator,
			zaehlweise: gemeinschaft.headCountMode,
			betroffene: betroffene || undefined,
			beklagtenwohnungen: beklagtenwohnungen || undefined
		};
	}

	// **Sichtbar deaktiviert statt fehlerhaft** (FR-62). Der Grund steht schon
	// hier fest und nicht erst nach dem Drücken.
	const ki = verfuegbarkeit(
		{
			eingerichtet: await kiEingerichtet(locals.benutzer.operatorId),
			zugelassen: gemeinschaft?.aiEnabled ?? false,
			offline: false,
			ausgenommen: gemeinschaft?.aiDisabledFunctions ?? [],
			hinweiseAusblenden: (await holeBetreiber(locals.benutzer.operatorId))?.kiHinweiseAusblenden === true
		},
		'erfordernisvorschlag'
	);

	const astId = url.searchParams.get('ast') ?? '';
	const pfad = (url.searchParams.get('p') ?? '').split(',').filter(Boolean);
	const einladungsmehr = await holeEinladungsmehrInWorten(
		locals.benutzer.operatorId,
		params.traktandumId
	);

	const gemeinsam = {
		versammlung,
		traktandum: eintrag.knoten,
		nummer: eintrag.nummer,
		fassung: regelwerk.fassung,
		freigabevermerk: regelwerk.freigabevermerk,
		aeste: regelwerk.aeste,
		kennzahlen,
		waehlbar: WAEHLBARE_TYPEN.map((typ) => ({
			typ,
			bezeichnung: regelwerk.ergebnistypen.find((t) => t.typ === typ)?.bezeichnung ?? typ,
			/*
			 * **Die Bezugsgrösse gehört zum Erfordernis** (Auftraggeber, 11.08.2026): «Es
			 * gibt halt Mehrheit aller und Mehrheit der anwesenden Köpfe … das wird
			 * nicht abgebildet.» Der Typ sagt nur, wie hoch die Schwelle liegt.
			 */
			basen: {
				kopf: waehlbareBasen(typ).kopf.map((b) => ({ wert: b, text: basisbezeichnung(b) })),
				quoten: waehlbareBasen(typ).quoten.map((b) => ({ wert: b, text: basisbezeichnung(b) }))
			}
		})),
		bezeichnungen: Object.fromEntries(
			regelwerk.ergebnistypen.map((t) => [t.typ, t.bezeichnung])
		) as Record<string, string>,
		anfechtungshinweis: ANFECHTUNGSHINWEIS,
		reglementsbruchhinweis: REGLEMENTSBRUCHHINWEIS,
		/**
		 * Bis zur Abstimmung, nicht bis zur Freigabe.
		 *
		 * Die Oberfläche liess das Erfordernis nur im Entwurf zu und war damit
		 * strenger als die Regel, die sie durchsetzen sollte: Der Server erlaubt es
		 * bis zum Schliessen der Versammlung und sperrt erst, wenn über *dieses*
		 * Traktandum bereits abgestimmt wurde. Das ist auch die sachlich richtige
		 * Grenze — bis zur Stimmabgabe schadet eine Berichtigung niemandem, danach
		 * stünde am Traktandum eine andere Regel als die, nach der gezählt wurde.
		 *
		 * Im Saal ist das kein Randfall: Die Zuordnung wird oft erst dort geklärt,
		 * und der Vorbereitungsablauf sagt seit je «im Saal nachholbar». Wer den
		 * Antrag umformuliert, ändert womöglich auch die nötige Mehrheit.
		 *
		 * **Nach der Freigabe aber nicht in jede Richtung** (06.10.2026). Hier
		 * stand, ein Abweichen von der versandten Traktandenliste sei ein
		 * Ordnungsentscheid der Versammlung. Das Mehr wird aber nicht beschlossen,
		 * sondern vom Vorsitz bestimmt (Wermelinger Rz. 99 ad Art. 712n), und
		 * seit Migration 144 ist das Mehr der Einladung die Untergrenze: im Saal
		 * nur strenger, vor Beginn milder nur mit neuem Versand
		 * (`einladungsmehr.ts`). Der Verlauf hält jede Änderung fest (AD-5).
		 */
		aenderbar: !geschlossen && !schonAbgestimmt,
		/** Was die Sperre verursacht — nie sperren, ohne den Grund zu nennen. */
		sperrgrund: geschlossen
			? 'Die Versammlung ist geschlossen. Das Mehrheitserfordernis steht damit fest.'
			: schonAbgestimmt
				? ERFORDERNIS_NACH_DER_ABSTIMMUNG
				: null,
		/** Ab der Freigabe gilt das Mehr der Einladung als Untergrenze. */
		nachDemVersand: versammlung.zustand !== 'entwurf',
		/** Ob die Versammlung schon läuft: dann nur noch strenger. */
		imSaal: versammlung.zustand === 'laufend',
		/** Das Mehr, das die Einladung nennt, in Worten; `null` ohne Untergrenze. */
		einladungsmehr: einladungsmehr?.worte ?? null,
		/**
		 * Beim Folgeantrag das angekündigte Traktandum, dessen Mehr er hält
		 * (Produktentscheid 06.10.2026, «Ja, dieselbe Untergrenze»); sonst `null`.
		 */
		einladungsmehrVon: einladungsmehr?.grundantrag ?? null,
		/**
		 * Ob für dieses Traktandum eine Milderung aussteht (`neuversandVermerkt`, bis 07.10.2026 `neuversandGilt`).
		 * Dann sagt die Seite, was Zurückstellen hier heisst (Laienprüfung Teil 2
		 * Runde 3, Punkt 1).
		 */
		einladungsmehrGemildert: einladungsmehr?.gemildert ?? false,
		/**
		 * Was die Gemeinschaft zur Änderung ihres Reglements hinterlegt hat
		 * (Migration 101, Auftraggeber 28.08.2026).
		 *
		 * **Gezeigt, nicht gesetzt.** Die Antwort bliebe sonst eine, die niemand
		 * getroffen hat — und der Baum ist der Ort, an dem die Sitzungsleitung
		 * entscheidet. Der Hinweis steht an der Frage, zu der er gehört; wer ihn
		 * liest, weiss, welche Antwort das Reglement dieser Gemeinschaft verlangt.
		 */
		aenderungsschranke: gemeinschaft?.aenderungsschranke
			? { fundstelle: gemeinschaft.aenderungsschrankeFundstelle ?? null }
			: null,
		/**
		 * Was das Reglement zur Höhe der Einlage in den Erneuerungsfonds sagt
		 * (Migration 193). Gezeigt an der Frage, mit den Antworten, die zur Art
		 * passen; gesetzt wird nichts, aus demselben Grund wie oben.
		 */
		fondsgrenze: gemeinschaft?.fondsgrenze
			? {
					frage: FONDSGRENZE_FRAGE,
					satz: fondsgrenzeSatz(gemeinschaft.fondsgrenze),
					antworten: FONDSGRENZE_ANTWORTEN[gemeinschaft.fondsgrenze.art]
				}
			: null,
		/** Die Änderungsschranke auch an der Frage zur Einlage (Codeprüfung M3). */
		fondsgrenzeSchranke: gemeinschaft?.aenderungsschranke
			? { frage: FONDSGRENZE_FRAGE, satz: fondsgrenzeSchrankeSatz(gemeinschaft.aenderungsschrankeFundstelle ?? null) }
			: null,
		ki
	};

	if (!astId) return { ...gemeinsam, stand: null };

	try {
		const lauf = laufe(regelwerk, astId, pfad);
		if (lauf.stand.art === 'frage') {
			return {
				...gemeinsam,
				stand: { art: 'frage' as const, frage: lauf.stand.frage, schritte: lauf.schritte, astId }
			};
		}

		const hergeleitet = erfordernisAus(regelwerk, lauf);
		const angewandt = wendeReglementAn(
			hergeleitet,
			regeln,
			enthaltungseinstellungVon(gemeinschaft),
			lesarten
		);
		// Nach der eingestellten Lesart, wie das gespeicherte Erfordernis (Review DeepSeek, B1).
		const gesetzliche = ergebniskarte(
			regelwerk,
			// L13 nicht, wo die Enthaltungsklausel sie verdrängt (Block C, Antwort 10).
			knotenNachLesart(regelwerk, lauf.stand.knoten, { ...lesarten, L13: zaehlweiseFuerKarte(angewandt, lesarten) }),
			kennzahlen ?? undefined,
			lesarten.L3
		);

		return {
			...gemeinsam,
			stand: {
				art: 'ergebnis' as const,
				karte: karteMitEnthaltung(
					karteMitReglement(
						gesetzliche,
						angewandt.regel,
						angewandt.vorbehalt,
						null,
						angewandt.regel && kennzahlen && !angewandt.vorbehalt
							? zahlenbeispielNachZaehlweise(angewandt.regel, kennzahlen, hergeleitet, lesarten.L3)
							: null,
						angewandt.lesart,
						hergeleitet,
						angewandt.verdraengt
					),
					angewandt.enthaltung
				),
				schritte: lauf.schritte,
				astId,
				erfordernis: angewandt.erfordernis,
				// Unter «Mehrheit wovon?», wo L10 am Vorschlag hängt (Auftrag «Texte nach 0047», Punkt 5).
				angehoerigeBeimSetzen: angehoerigeBeimSetzen(angewandt.erfordernis),
				urheberschaft: urheberschaft(angewandt.erfordernis),
				/*
				 * **Die Regel, die hier nicht greift** (Prüflauf I, B-19).
				 *
				 * Im Grenzfall wird eine hinterlegte Reglementsregel bewusst nicht
				 * angewandt — offen ist ja gerade, ob das Vorhaben darunter fällt.
				 * Der Kasten sagt das. Die FOLGE stand nirgends: Wer anschliessend
				 * von Hand «Qualifiziertes Mehr» setzt, verliert damit auch die
				 * Wertquotenschranke der Regel, «und ich merke es nirgends»
				 * (ausprobiert und mit der Auszählmappe gegengelesen).
				 *
				 * Nur beim Grenzfall: Bei jedem anderen Vorbehalt gilt entweder die
				 * Regel oder es gibt nichts zu verlieren.
				 */
				regelVorbehalten:
					angewandt.vorbehalt === 'grenzfall' && angewandt.regel
						? {
								fundstelle: angewandt.regel.fundstelle,
								mitQuotenschranke: angewandt.regel.quotenSchwelle !== null
							}
						: null
			}
		};
	} catch (fehler) {
		if (fehler instanceof FachlicherFehler) error(400, fehler.message);
		throw fehler;
	}
};

/**
 * **Der zweite Adressteil gehört gegen den ersten geprüft** (03.09.2026, aus
 * dem Code-Review; die Route trägt zwei Kennungen).
 *
 * Die Reglementsregeln stammen aus der Versammlung der Adresse. Gehörte das
 * Traktandum zu einer anderen, bekäme es die Regeln der falschen Gemeinschaft —
 * innerhalb desselben Betreibers, den `alsBetreiber` allein also nicht
 * abfängt. `kivorschlag` prüft das seit dem 02.09.2026; die drei setzenden
 * Aktionen taten es nicht.
 *
 * **Steht hier und nicht im Kern**: `haltErfordernisAmTraktandumFest` hat 63
 * Aufrufstellen, die meisten in Tests und ohne Versammlung zur Hand. Ein
 * *optionaler* Parameter dort wäre keine Schranke, sondern eine Bitte. Gehalten
 * wird die Regel stattdessen durch `tests/db/erfordernisadresse.test.ts`: je
 * Aktion ein Aufruf mit fremdem Traktandum, der 404 bekommen muss.
 */
async function verlangeTraktandumDieserVersammlung(
	operatorId: string,
	versammlungId: string,
	traktandumId: string
): Promise<void> {
	const traktanden = await holeTraktanden(operatorId, versammlungId);
	if (!traktanden.some((t) => t.knoten.id === traktandumId)) {
		// Derselbe Satz wie im Serverteil, aus derselben Quelle — hier nur als
		// HTTP-404 statt als fachlicher Fehler.
		error(404, FREMDES_TRAKTANDUM);
	}
}

export const actions: Actions = {
	/**
	 * Einen Fall des Entscheidbaums vorschlagen lassen (FR-59).
	 *
	 * **Gesetzt wird nichts.** Der Vorschlag kommt als Hinweis zurück und nennt
	 * den Fall samt Begründung; die Sitzungsleitung durchläuft den Baum
	 * weiterhin selbst. Ist bereits ein Erfordernis am Traktandum, wird
	 * zusätzlich gegengeprüft.
	 */
	kivorschlag: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');

		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) error(404, 'Versammlung nicht gefunden');
		const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId);

		// Auch hier zweimal: Ein ausgeblendeter Knopf ist keine Schranke.
		const erlaubt = verfuegbarkeit(
			{
				eingerichtet: await kiEingerichtet(locals.benutzer.operatorId),
				zugelassen: gemeinschaft?.aiEnabled ?? false,
				offline: false,
				ausgenommen: gemeinschaft?.aiDisabledFunctions ?? [],
				hinweiseAusblenden: (await holeBetreiber(locals.benutzer.operatorId))?.kiHinweiseAusblenden === true
			},
			'erfordernisvorschlag'
		);
		if (!erlaubt.verfuegbar) return fail(400, { fehler: { nachricht: erlaubt.grund ?? '' } });

		const ergebnis = await holeVorschlag(
			{
				operatorId: locals.benutzer.operatorId,
				userId: locals.benutzer.id,
				label: locals.benutzer.displayName
			},
			params.traktandumId,
			// Der zweite Adressteil wird gegen den ersten geprüft: Ohne das liesse
			// sich ein Traktandum einer Gemeinschaft ohne KI-Zulassung unter der
			// Adresse einer zugelassenen prüfen (02.09.2026, nachgemessen).
			params.id,
			holeRegelwerk()
		);

		/*
		 * **Der Vergleich entsteht in der Anzeige** (Codeprüfung 04.10.2026,
		 * mittel 1). Er wurde hier gegen den Stand der Anfrage gerechnet und
		 * mit dem Vorschlag gemerkt; nach einem Neuladen stand er unverändert
		 * über einem inzwischen anderen Erfordernis und behauptete etwas über
		 * einen Stand, den es nicht mehr gab. Er ist eine reine Funktion von
		 * Vorschlag und heutigem Stand (`gegenpruefung`) und wird deshalb dort
		 * gerechnet, wo er gilt: in der Karte (`vorschlagmerker.ts`).
		 *
		 * **Und die Antwort trägt ihr Traktandum** (Zweitprüfung 04.10.2026,
		 * mittel 1): Der Pfadname ist für alle Traktanden derselbe, `use:enhance`
		 * wendet die Antwort deshalb auch dann an, wenn die Leitung während des
		 * Modellaufrufs das Traktandum gewechselt hat. Der Merker hinge den
		 * fremden Vorschlag sonst unter dem neuen Traktandum fest. Mit der
		 * Kennung verwirft die Anzeige ihn.
		 */
		const mitTyp = await vorschlagAmHaus(locals.benutzer.operatorId, {
			meetingId: params.id,
			stwegId: versammlung.stwegId
		}, ergebnis);
		return { vorschlag: { ...mitTyp, traktandumId: params.traktandumId } };
	},

	/**
	 * Was die Sitzungsleitung mit der Empfehlung gemacht hat (FR-63).
	 *
	 * **Der Nachweis war unvollständig.** Bis zum 05.08.2026 hielt die
	 * Erfordernisseite fest, *dass* gefragt wurde, aber nicht, was daraus wurde —
	 * und damit fehlte genau die Angabe, um die es im Streitfall geht: Hat ein
	 * Mensch entschieden oder ist ein Vorschlag durchgerutscht?
	 */
	kientscheid: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await vermerkeEntscheid(
				{ operatorId: locals.benutzer.operatorId, userId: locals.benutzer.id, label: locals.benutzer.displayName },
				text(daten.get('nutzungId')),
				verlangeEntscheid(text(daten.get('entscheid'))),
				{ art: 'versammlung', versammlungId: params.id }
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
	 * Der Empfehlung folgen: **vermerken und setzen** (Auftraggeber, 03.09.2026).
	 *
	 * Bis dahin schrieb «Ich folge der Empfehlung» nur den Nachweis, *dass*
	 * gefolgt wurde. Das Erfordernis setzte allein der Entscheidbaum darunter.
	 * Gemessen am Praxisdurchlauf: der Auftraggeber hat den Knopf an einem Traktandum
	 * dreimal gedrückt («Spielplatz», laufende Versammlung), und danach stand
	 * dort weiterhin kein Erfordernis. Ein Knopf, dessen Beschriftung mehr
	 * verspricht als er hält, wird eben wiederholt gedrückt.
	 *
	 * **Gesetzt wird über denselben Weg wie beim Baum**: `laufe()` mit dem Ast
	 * und den Antwortkennungen des Vorschlags, dann das Reglement darüber. Damit
	 * trägt das Ergebnis die Fassungskennung und die Herleitung wie jeder
	 * Durchlauf von Hand — die Einschätzung des Modells ist der Weg dorthin,
	 * nicht die Quelle der Regel.
	 *
	 * Die beiden anderen Entscheide («als Ausgangspunkt», «anders») setzen
	 * weiterhin nichts: Sie sagen ja gerade, dass die Sitzungsleitung selbst
	 * entscheidet.
	 */
	kifolgen: async ({ request, locals, params, url }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const regelwerk = holeRegelwerk();

		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) error(404, 'Versammlung nicht gefunden');

		await verlangeTraktandumDieserVersammlung(locals.benutzer.operatorId, params.id, params.traktandumId);

		const regeln = await holeReglementsregeln(locals.benutzer.operatorId, versammlung.stwegId);
		const enthaltung = await holeEnthaltungseinstellung(
			locals.benutzer.operatorId,
			versammlung.stwegId
		);
		const lesarten = await holeLesarten(locals.benutzer.operatorId, { meetingId: params.id });

		try {
			const lauf = laufe(
				regelwerk,
				text(daten.get('ast')),
				text(daten.get('p')).split(',').filter(Boolean)
			);
			const angewandt = wendeReglementAn(erfordernisAus(regelwerk, lauf), regeln, enthaltung, lesarten);

			await haltErfordernisAmTraktandumFest(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				params.traktandumId,
				angewandt.erfordernis
			);

			/*
			 * **Der Nachweis danach, nicht davor.** Schlägt das Setzen fehl (die
			 * Versammlung ist geschlossen, es wurde schon abgestimmt), stünde
			 * sonst im Nachweis «der Empfehlung gefolgt», ohne dass ihr jemand
			 * gefolgt wäre.
			 */
			try {
				await vermerkeEntscheid(
					{ operatorId: locals.benutzer.operatorId, userId: locals.benutzer.id, label: locals.benutzer.displayName },
					text(daten.get('nutzungId')),
					verlangeEntscheid('angenommen'),
					{ art: 'versammlung', versammlungId: params.id }
				);
			} catch (fehler) {
				/*
				 * **Zwei Schreibvorgänge, eine Meldung** (aus dem Code-Review).
				 * Setzen und Nachweis laufen in getrennten Transaktionen. Scheitert
				 * der zweite, steht das Erfordernis bereits — eine Absage ohne
				 * diesen Zusatz legte nahe, es sei nichts geschehen, und der
				 * nächste Versuch liefe in «schon abgestimmt» oder setzte doppelt.
				 */
				if (fehler instanceof FachlicherFehler) {
					return fail(400, {
						fehler: {
							nachricht:
								`Das Erfordernis ist gesetzt. Nur der Nachweis über die KI-Nutzung ` +
								`konnte nicht nachgeführt werden: ${fehler.message}`,
							feld: fehler.feld
						}
					});
				}
				throw fehler;
			}
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}

		redirect(303, zurueckweg(url, params.id));
	},

	/** Übernimmt den hergeleiteten Vorschlag unverändert ans Traktandum. */
	uebernehmen: async ({ request, locals, params, url }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const regelwerk = holeRegelwerk();

		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) error(404, 'Versammlung nicht gefunden');

		await verlangeTraktandumDieserVersammlung(locals.benutzer.operatorId, params.id, params.traktandumId);

		const regeln = await holeReglementsregeln(locals.benutzer.operatorId, versammlung.stwegId);
		const enthaltung = await holeEnthaltungseinstellung(
			locals.benutzer.operatorId,
			versammlung.stwegId
		);
		const lesarten = await holeLesarten(locals.benutzer.operatorId, { meetingId: params.id });

		try {
			const lauf = laufe(
				regelwerk,
				text(daten.get('ast')),
				text(daten.get('p')).split(',').filter(Boolean)
			);
			const angewandt = wendeReglementAn(erfordernisAus(regelwerk, lauf), regeln, enthaltung, lesarten);

			await haltErfordernisAmTraktandumFest(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				params.traktandumId,
				angewandt.erfordernis
			);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}

		redirect(303, zurueckweg(url, params.id));
	},

	/** Ein anderes Erfordernis setzen — mit Begründung, und mit Vermerk des Vorschlags. */
	setzen: async ({ request, locals, params, url }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const regelwerk = holeRegelwerk();

		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) error(404, 'Versammlung nicht gefunden');

		await verlangeTraktandumDieserVersammlung(locals.benutzer.operatorId, params.id, params.traktandumId);

		const typ = text(daten.get('typ')) as Ergebnistyp;
		const begruendung = text(daten.get('begruendung'));
		const astId = text(daten.get('ast'));
		const pfad = text(daten.get('p')).split(',').filter(Boolean);
		const regeln = await holeReglementsregeln(locals.benutzer.operatorId, versammlung.stwegId);
		const enthaltung = await holeEnthaltungseinstellung(
			locals.benutzer.operatorId,
			versammlung.stwegId
		);
		const lesarten = await holeLesarten(locals.benutzer.operatorId, { meetingId: params.id });

		try {
			// Abgewichen wird vom **angewandten** Vorschlag: Sonst bliebe ein
			// Übersteuern der Reglementsregel unbemerkt und stünde als blosse
			// Abweichung vom Gesetz im Verlauf.
			/*
			 * Der Typ sagt, wie hoch die Schwelle liegt; wovon, sagt die Basis
			 * (Auftraggeber, 11.08.2026: «Mehrheit aller und Mehrheit der anwesenden Köpfe
			 * … das wird nicht abgebildet»).
			 *
			 * **Beide Wege bekommen sie** (Prüflauf I, B-16/B-19): Bis zum
			 * 23.08.2026 stand die Wahl nur im Formular ohne Baum, und
			 * `uebersteuere()` nahm sie gar nicht entgegen. Wer den Baum durchlief
			 * — der übliche Weg — konnte «zwei Drittel der Anwesenden statt aller»
			 * nicht setzen.
			 */
			const gewaehlteBasen = {
				kopfbasis: (text(daten.get('kopfbasis')) || undefined) as never,
				quotenbasis: (text(daten.get('quotenbasis')) || undefined) as never
			};
			const vorschlag = astId
				? wendeReglementAn(
						erfordernisAus(regelwerk, laufe(regelwerk, astId, pfad)),
						regeln,
						enthaltung,
						lesarten
					)
				: null;
			const uebergang = vorschlag
				? uebersteuere(
						regelwerk,
						vorschlag.erfordernis,
						typ,
						begruendung,
						gewaehlteBasen
					)
				: setzeErfordernis(regelwerk, typ, begruendung, gewaehlteBasen);

			await haltErfordernisAmTraktandumFest(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				params.traktandumId,
				enthaltungNachWahl(uebergang.ergebnis, vorschlag, enthaltung),
				/*
				 * Nur beim Übersteuern. `setzeErfordernis` meldet `requirement.set`,
				 * und diese Art schreibt `haltErfordernisAmTraktandumFest` selbst;
				 * durchgereicht stünde sie doppelt da. Deren Eintrag trägt aber
				 * weder Begründung noch Bezugsgrössen: Beim Direktweg steht die
				 * Begründung bisher nur in `requirement_reason`, nicht im Verlauf.
				 * Offen seit dem 30.09.2026 (Codeprüfung), Teil des Musters für
				 * Abweichungen der Leitung.
				 */
				astId ? uebergang.ereignisse : []
			);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}

		redirect(303, zurueckweg(url, params.id));
	}
};
