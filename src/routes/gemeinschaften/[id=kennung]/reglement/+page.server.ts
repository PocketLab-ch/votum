import { LESARTEN, LESARTENRECHT_IN_WORTEN, LESARTENRECHT_VORGABE } from '$lib/domain/lesarten';
import { holeLesarteneinstellung, speichereLesarten, speichereLesartenrecht } from '$lib/server/lesarten';
import { error, fail } from '@sveltejs/kit';
import { regelKannGreifen, GESCHAEFTSARTEN } from '$lib/domain/regelwerk';
import { holeRegelwerk } from '$lib/rules';
import { typdefinition } from '$lib/domain/regelwerk';
import {
	pruefungshinweis,
	pruefungOffen,
	regelGiltFuer,
	regelOhneKoepfeGiltFuer,
	regelInWorten,
	regelNurFallgenauNachLesart,
	regelReichweite
} from '$lib/domain/reglement';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Schwellenart } from '$lib/domain/mehrheit';
import type { Geschaeftsart, Kopfbasis, Quotenbasis } from '$lib/domain/regelwerk';
import { ganzzahl, jaNein, text } from '$lib/server/formular';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { pruefeReglementsregelGehoert } from '$lib/server/zugehoerigkeit';
import {
	aendereReglementsregelAn,
	erstelleReglementsregel,
	holePruefstand,
	holeReglementsregeln,
	loescheReglementsregel,
	setzePruefungZurueck,
	speichereVermerk,
	vermerkePruefung,
	veralteteErfordernisse,
	erfordernisseNachziehen,
	holeWeisungsregel,
	istMitgliedsgemeinschaft,
	loescheWeisungsregel,
	speichereWeisungsregel,
	speichereEinberufungsfrist,
	speichereFondsgrenze,
	speichereZweitversammlungsfrist,
	speichereAenderungsschranke
} from '$lib/server/reglement';
import {
	holeTraktandenordnung,
	setzeTraktandenordnungZurueck,
	speichereTraktandenordnung
} from '$lib/server/traktandenordnung';
import { speichereAusnahmen } from '$lib/server/ausnahmen';
import { speichereNeuabstimmung } from '$lib/server/neuabstimmung';
import { speichereMilderungNachFrist } from '$lib/server/einladungsmehr';
import { AUSNAHMEN_VORGABE } from '$lib/domain/ausnahmen';
import { NEUABSTIMMUNG_VORGABE } from '$lib/domain/neuabstimmung';
import { vorlagenFuer, ordneVorlagen } from '$lib/domain/traktandenvorlage';
import { FRIST_HOECHSTENS_TAGE, versandfrist } from '$lib/domain/einberufungsfrist';
import { FONDSGRENZE_ARTEN, FONDSGRENZE_ART_TEXT, FONDSGRENZE_FOLGE } from '$lib/domain/fondsgrenze';
import { FRIST_TAGE, ZWEITFRIST_HOECHSTENS_TAGE, tageSpaeter } from '$lib/domain/versammlung';
import { datumLang } from '$lib/domain/datum';
import type { Actions, PageServerLoad } from './$types';

function heute(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/** Welche Schlüssel jährliche Geschäfte sind — für die Marke in der Liste. */
const JAHRESGESCHAEFTE_SCHLUESSEL = new Set(
	vorlagenFuer('ordentlich')
		.filter((v) => !vorlagenFuer('ausserordentlich').some((f) => f.schluessel === v.schluessel))
		.map((v) => v.schluessel)
);

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	/*
	 * **Die Frist einmal auf `null` gebracht.** Das Feld ist im Typ freiwillig
	 * (`?: number | null`), weil es nicht über das Gemeinschaftsformular
	 * geschrieben wird. Für die Seite ist «nicht hinterlegt» aber ein Zustand
	 * und keine drei — sonst prüfte sie an einer Stelle auf `null` und an der
	 * nächsten auf `undefined`.
	 */
	const fristTage = gemeinschaft.einberufungsfristTage ?? null;
	/*
	 * **Der Beispieltag muss hinter der Frist liegen** (01.09.2026, aus dem
	 * Code-Review). Fest sechzig Tage waren bei einer Frist von neunzig ein
	 * Beispiel, dessen Versandtag in der Vergangenheit lag — vorgeführt wurde
	 * damit etwas Unmögliches. Dreissig Tage Luft ueber der Frist, mindestens
	 * aber sechzig, damit das übliche Beispiel gleich bleibt.
	 */
	const beispieltag = tageSpaeter(heute(), Math.max(60, (fristTage ?? 0) + 30));

	const [regeln, stand, ordnung, lesarteneinstellung] = await Promise.all([
		holeReglementsregeln(locals.benutzer.operatorId, params.id),
		holePruefstand(locals.benutzer.operatorId, params.id),
		holeTraktandenordnung(locals.benutzer.operatorId, params.id),
		holeLesarteneinstellung(locals.benutzer.operatorId, params.id)
	]);

	return {
		gemeinschaft,
		/**
		 * Wie dieses Haus über die Weisung an seinen Vertreter entscheidet
		 * (Migration 085). Null heisst: nichts hinterlegt — dann wird sie beim
		 * Weisungstraktandum nicht vorgeschlagen, und die Sitzungsleitung wählt
		 * das Erfordernis wie bei jedem anderen Punkt.
		 */
		weisungsregel: await holeWeisungsregel(locals.benutzer.operatorId, params.id),
		/**
		 * Ob dieses Haus irgendwo als Mitglied geführt wird — davon hängt ab, ob
		 * die Frage nach der einen Stimme überhaupt gestellt wird (03.09.2026).
		 */
		istMitglied: await istMitgliedsgemeinschaft(locals.benutzer.operatorId, params.id),
		/**
		 * Die Reihenfolge der Standardtraktanden (Block C2, 31.08.2026).
		 *
		 * `ordnung` ist die gespeicherte Schlüsselliste oder `null`
		 * (Code-Reihenfolge). `vorlagen` steht bereits sortiert, wie eine neue
		 * Versammlung sie bekäme — die Seite zeigt dieselbe Reihenfolge, die
		 * dann gilt, nicht eine andere.
		 */
		ordnung,
		vorlagen: ordneVorlagen(vorlagenFuer('ordentlich'), ordnung).map((v) => ({
			schluessel: v.schluessel,
			titel: v.titel,
			kurzfassung: v.kurzfassung ?? null,
			jaehrlich: JAHRESGESCHAEFTE_SCHLUESSEL.has(v.schluessel)
		})),
		geschaeftsarten: GESCHAEFTSARTEN,
		// Die Reichweite je Geschäftsart, aus der geltenden Fassung gerechnet —
		// nicht in der Seite behauptet (Prüfung vom 15.08.2026, B-6 bis B-11).
		/**
		 * Worauf eine Regel dieser Art angewandt wird — mit Namen (22.08.2026).
		 *
		 * Die Ergänzung zu `reichweiten`: Die sagt, wo eine Regel **nicht**
		 * greift, und schweigt, wenn sie überall greift. Genau dieses Schweigen
		 * war der Fehler — «Jahresgeschäfte» umfasst fünf Fälle (seit der Fassung
		 * 2026-11-18 mit dem Errichten des Erneuerungsfonds), und wer § 15 für
		 * die Einlage erfasst, verschärft die anderen vier mit.
		 */
		giltFuer: Object.fromEntries(
			GESCHAEFTSARTEN.map((g) => [g.art, regelGiltFuer(holeRegelwerk(), g.art)])
		),
		/**
		 * Die Fälle je Geschäftsart, mit ihrer Kennung (22.08.2026, Befund B-02).
		 *
		 * Für die Wahl «gilt für alle Fälle dieser Art» oder «nur für diesen».
		 * `giltFuer` daneben trägt nur die Titel — es beantwortet die andere Frage
		 * («was trifft die Regel»), und beide Listen aus einer zu bauen hiesse,
		 * die eine an die Darstellung der anderen zu binden.
		 */
		faelle: Object.fromEntries(
			GESCHAEFTSARTEN.map((g) => [
				g.art,
				holeRegelwerk()
					.knoten.filter(
						(k) =>
							k.geschaeftsart === g.art &&
							k.typ !== 'grenzfall' &&
							k.typ !== 'keine_abstimmung' &&
							regelKannGreifen(k.reglementsverhalten)
					)
					/*
					 * **Wovon abgewichen wird** (23.08.2026, Prüflauf I, A-14). Die Seite
					 * heisst «Abweichende Quoren» und verlangt damit einen Vergleich —
					 * zeigte aber nirgends, was das Gesetz für diese Art vorsieht. Wer
					 * zwei Drittel hinterlegt, ohne zu wissen, dass das Gesetz hier schon
					 * zwei Drittel verlangt, hat eine Regel erfasst, die nichts ändert.
					 */
					.map((k) => ({
						id: k.id,
						titel: k.titel,
						/*
						 * **Greift nur, wenn eigens gewählt** (Codeprüfung 07.10.2026,
						 * M3): Wo das Gesetz die Zustimmung aller verlangt und die Karte
						 * `vereinbart` trägt, wendet `wendeReglementAn` nur eine Regel für
						 * genau diesen Fall an. «Für alle Geschäfte dieser Art» darf ihn
						 * deshalb nicht mitzählen. Ebenso an der Einsprache
						 * (`nur_verschaerfen`, ab Fassung 2026-10-20). Ab Fassung 2026-11-20
						 * auch an den Karten mit L17 nach dem SVIT-Kommentar: Das hängt an der
						 * Wahl der Gemeinschaft, die `regelNurFallgenau` nicht kennt. Die
						 * Bedingung steht deshalb in `regelNurFallgenauNachLesart`, das mit
						 * der Anwendung (`l17Regelvorbehalt` in `wendeReglementAn`) dieselbe
						 * Stelle `l17NurFallgenau` fragt.
						 */
						nurEigens: regelNurFallgenauNachLesart(k, lesarteneinstellung.wahl),
						gesetzlich: k.formel ?? typdefinition(holeRegelwerk(), k.typ).formel,
						/*
						 * **Die Zuordnungshilfe** — der zweite Teil von A-14: «Dazu fehlt
						 * eine Zuordnungshilfe: welche Geschäfte fallen unter welche der
						 * 15 Arten? Für § 15 (Erneuerungsfondsbeitrag) habe ich geraten.»
						 *
						 * Die Beispiele stehen im Regelwerk und speisen schon die
						 * thematische Suche der Fallauswahl («Wärmepumpe» findet die
						 * nützliche bauliche Massnahme). Hier kosten sie nichts weiter,
						 * als sie mitzugeben — und sie beantworten genau die Frage, die
						 * beim Zuordnen offen bleibt.
						 */
						beispiele: k.beispiele ?? []
					}))
			])
		),
		/*
		 * **Die gesetzliche Lage ALLER Fälle, auch der gesperrten** (23.09.2026).
		 *
		 * `faelle` darüber beantwortet «worauf darf ich meine Regel
		 * beschränken» und ist deshalb auf das gefiltert, woran eine Regel
		 * überhaupt etwas ändert. Der Ausklapper «Was das Gesetz für diese Art
		 * vorsieht» beantwortet eine andere Frage, nämlich «wovon weiche ich
		 * ab», und die stellt sich gerade dort, wo eine Abweichung schwer ist.
		 *
		 * **Er hing bis heute an `faelle` und verschwand damit**, als die
		 * Fassung 2026-09-23 Knoten für Reglementsregeln sperrte (zuerst sieben,
		 * nach dem zweiten Prüfdurchgang vier): Für die baulichen
		 * Massnahmen, mit denen die Seite öffnet, blieb die Liste leer, und die
		 * Seite zeigte nicht mehr, was das Gesetz verlangt. Gefunden hat es der
		 * Durchstich `e2e/reglementsschranke.mjs`, Schritt 6 — kein Unit-Test
		 * deckt die Bedingung, weil sie in der Svelte-Datei steht.
		 *
		 * Dasselbe Muster wie bei `fallTitel` darunter: zwei Fragen, zwei
		 * Listen, keine an die Darstellung der anderen gebunden.
		 */
		gesetzlicheLage: Object.fromEntries(
			GESCHAEFTSARTEN.map((g) => [
				g.art,
				holeRegelwerk()
					.knoten.filter(
						(k) =>
							k.geschaeftsart === g.art &&
							k.typ !== 'grenzfall' &&
							k.typ !== 'keine_abstimmung'
					)
					.map((k) => ({
						id: k.id,
						titel: k.titel,
						gesetzlich: k.formel ?? typdefinition(holeRegelwerk(), k.typ).formel,
						beispiele: k.beispiele ?? []
					}))
			])
		),
		/*
		 * **Die Titel ALLER Fälle, auch der nicht wählbaren** (03.09.2026, aus dem
		 * Code-Review des Änderungswegs).
		 *
		 * `faelle` darüber ist für die **Wahl** gefiltert: Grenzfälle,
		 * Kenntnisnahmen und Knoten, an denen ein Reglement nichts ändern darf,
		 * stehen dort nicht. Eine schon hinterlegte Regel kann aber auf einem
		 * solchen Knoten sitzen — entweder von früher, oder weil das Regelwerk ihn
		 * seither anders einordnet (`k-ausschlussklage` wurde am 16.08.2026 von
		 * frei auf gesperrt gesetzt).
		 *
		 * Ohne diese Zuordnung fiel eine solche Beschränkung beim Ändern
		 * stillschweigend weg, und aus «nur für die Ermächtigung zur
		 * Ausschlussklage» wurde «für alle Sonderfälle». In der Tabelle stand
		 * dafür die rohe Kennung statt eines Titels.
		 */
		fallTitel: Object.fromEntries(
			holeRegelwerk()
				.knoten.filter((k) => k.geschaeftsart)
				.map((k) => [k.id, k.titel])
		),
		// Wo eine Regel ohne Köpfe greift, je Art (Codeprüfung Block A, N2).
		ohneKoepfeGiltFuer: Object.fromEntries(
			GESCHAEFTSARTEN.map((g) => [g.art, regelOhneKoepfeGiltFuer(holeRegelwerk(), g.art, null, lesarteneinstellung.wahl)])
		),
		reichweiten: Object.fromEntries(
			GESCHAEFTSARTEN.map((g) => [g.art, regelReichweite(holeRegelwerk(), g.art, lesarteneinstellung.wahl)])
		),
		regeln: regeln.map((r) => ({ ...r, satz: regelInWorten(r) })),
		/*
		 * **Was die Regeln an bestehenden Traktanden ändern würden** (23.08.2026,
		 * Prüflauf II, B-01). Ein Erfordernis wird beim Anlegen hergeleitet und in
		 * die Zeile geschrieben; wer die Regel danach erfasst, ändert daran
		 * nichts. Die Seite versprach bisher das Gegenteil — «wendet das Werkzeug
		 * bei jeder Herleitung an» — und schwieg über das, was schon dastand.
		 */
		veraltet: await veralteteErfordernisse(locals.benutzer.operatorId, params.id),
		aenderungsschranke: {
			einstimmig: gemeinschaft.aenderungsschranke ?? false,
			fundstelle: gemeinschaft.aenderungsschrankeFundstelle ?? null
		},
		ausnahmen: gemeinschaft.ausnahmen ?? AUSNAHMEN_VORGABE,
		/*
		 * Wie ein zweiter Durchgang möglich wird, wenn die Versammlung erst
		 * nachträglich beschlussfähig wird (Migration 139). Die Vorgabe gilt,
		 * wenn die Spalte leer wäre; aus der Datenbank kommt sie mit dem
		 * Vorgabewert schon gefüllt.
		 */
		neuabstimmung: gemeinschaft.neuabstimmungNachQuorum ?? NEUABSTIMMUNG_VORGABE,
		/*
		 * Ob ein milderes Mehr nach Ablauf der Einberufungsfrist noch geht
		 * (Migration 148, Produktentscheid 07.10.2026). Vorgabe «nicht zulassen».
		 */
		milderungNachFrist: gemeinschaft.milderungNachFrist ?? false,
		/**
		 * Ein Beispiel für die hinterlegte Frist, in Tagen gerechnet — nicht in
		 * der Seite, sondern hier.
		 *
		 * **Warum überhaupt ein Beispiel.** «30 Tage» ist eine Zahl, «bis zum
		 * 1. Oktober» ist ein Termin. Die Rechnung von der Zahl zum Termin ist
		 * genau die, die man beim Planen falsch macht; sie einmal vorzuführen
		 * kostet eine Zeile.
		 *
		 * **Warum im Server.** Der Kalendertag wird aus `heute()` in hiesiger
		 * Zeit abgeleitet. Im Browser gerechnet käme beim Hydrieren ein anderer
		 * Tag heraus, sobald das Gerät in einer anderen Zone steht.
		 */
		/**
		 * Was das Reglement zur Höhe der Einlage in den Erneuerungsfonds sagt
		 * (Migration 193); die Arten mit Beschriftung und Folge für die Wahl.
		 */
		fondsgrenze: {
			hinterlegt: gemeinschaft.fondsgrenze ?? null,
			arten: FONDSGRENZE_ARTEN.map((art) => ({ art, text: FONDSGRENZE_ART_TEXT[art], folge: FONDSGRENZE_FOLGE[art] }))
		},
		einberufungsfrist: {
			tage: fristTage,
			fundstelle: gemeinschaft.einberufungsfristFundstelle ?? null,
			hoechstens: FRIST_HOECHSTENS_TAGE,
			beispielVersammlung: datumLang(beispieltag),
			beispielVersand: fristTage === null ? null : datumLang(versandfrist(beispieltag, fristTage) ?? '')
		},
		/**
		 * Die Frist zur zweiten Versammlung (Migration 122).
		 *
		 * Anders als die Einberufungsfrist darüber trägt sie einen **Vorgabewert
		 * aus dem Gesetz**: Ohne hinterlegte Zahl gelten zehn Tage. Das Feld sagt
		 * das, statt leer zu stehen und Unwissen vorzutäuschen.
		 */
		zweitversammlungsfrist: {
			tage: gemeinschaft.zweitversammlungsfristTage ?? null,
			fundstelle: gemeinschaft.zweitversammlungsfristFundstelle ?? null,
			gesetzlich: FRIST_TAGE,
			hoechstens: ZWEITFRIST_HOECHSTENS_TAGE
		},
		stand,
		offen: pruefungOffen(stand),
		hinweis: pruefungshinweis(stand),
		heute: heute(),
		/** Die Lesarten der Gemeinschaft (Migration 169) samt wer umstellen darf. */
		lesarten: {
			katalog: LESARTEN,
			einstellung: lesarteneinstellung,
			rechte: LESARTENRECHT_IN_WORTEN,
			vorgabe: LESARTENRECHT_VORGABE
		}
	};
};

function handelnderAus(benutzer: App.Locals['benutzer']) {
	if (!benutzer) error(401, 'Nicht angemeldet');
	return { operatorId: benutzer.operatorId, userId: benutzer.id, label: benutzer.displayName };
}

export const actions: Actions = {
	/*
	 * kennung: knotenId — kein Verweis auf eine Zeile, sondern der Fall aus dem
	 * Entscheidbaum (`bylaw_quorum_rule.node_id` ist `text`). Das Regelwerk
	 * liegt versioniert im Code und gilt für alle Gemeinschaften gleich;
	 * `erstelleReglementsregel` weist einen Knoten ab, den es dort nicht gibt
	 * oder der nicht zur gewählten Geschäftsart gehört.
	 */
	hinterlegen: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();

		// «Köpfe zählen nicht» verlangt die Wertquoten; das Kästchen dazu ist dann
		// gesperrt und kommt nicht mit (ein gesperrtes Feld sendet der Browser nicht).
		const ohneKoepfe = jaNein(daten.get('kopfeZaehlenNicht'));
		const mitQuoten = ohneKoepfe || jaNein(daten.get('mitQuoten'));
		try {
			await erstelleReglementsregel(handelnder, {
				stwegId: params.id,
				geschaeftsart: text(daten.get('geschaeftsart')) as Geschaeftsart,
				kopfSchwelle: ohneKoepfe
					? null
					: {
							zaehler: ganzzahl(daten.get('kopfZaehler')),
							nenner: ganzzahl(daten.get('kopfNenner')),
							art: text(daten.get('kopfArt')) as Schwellenart
						},
				kopfbasis: ohneKoepfe ? 'anwesend_vertreten' : (text(daten.get('kopfbasis')) as Kopfbasis),
				quotenSchwelle: mitQuoten
					? {
							zaehler: ganzzahl(daten.get('quotenZaehler')),
							nenner: ganzzahl(daten.get('quotenNenner')),
							art: text(daten.get('quotenArt')) as Schwellenart
						}
					: null,
				quotenbasis: mitQuoten ? (text(daten.get('quotenbasis')) as Quotenbasis) : 'keine',
				// Leer heisst «für alle Fälle dieser Art» — die bisherige Wirkung.
				knotenId: text(daten.get('knotenId')) || null,
				fundstelle: text(daten.get('fundstelle')),
				enthaltungZaehltMit: jaNein(daten.get('enthaltungZaehltMit')),
				hinweis: text(daten.get('hinweis')) || undefined
			});
			return { gespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Eine hinterlegte Abweichung aendern (03.09.2026, Punkt 3 der sechs).
	 *
	 * **Ein eigener Weg neben `hinterlegen`, kein Zweig darin.** Beide schreiben
	 * dieselben Felder, aber sie beantworten verschiedene Fragen: Anlegen darf
	 * eine bestehende Regel derselben Art und desselben Falls ersetzen (`ON
	 * CONFLICT`), Aendern darf genau das nicht — dort waere es das stille
	 * Verdraengen einer fremden Zeile. Und im Verlauf steht danach ein anderes
	 * Ereignis. Ein `if` im selben Weg haette diese Unterschiede in einer
	 * Verzweigung versteckt, die man beim Lesen ueberspringt.
	 *
	 * kennung: regelId — die Bindung an die Gemeinschaft der Adresse prueft
	 * `aendereReglementsregelAn` selbst, als erste Anweisung und vor dem ersten
	 * Schreiben. Dort und nicht hier, weil es der einzige Schreibweg auf eine
	 * bestehende Regel ueber ihre Kennung ist: Eine Pruefung, die an der
	 * Aufrufstelle steht, kann die zweite Aufrufstelle vergessen. Belegt in
	 * `tests/db/reglement-aendern.test.ts` mit der Nachbargemeinschaft desselben
	 * Betreibers — ausgebaut wird der Test rot.
	 *
	 * kennung: knotenId — kein Verweis auf eine Zeile dieser Gemeinschaft,
	 * sondern der Fall aus dem Entscheidbaum. Das Regelwerk liegt versioniert im
	 * Code und gilt fuer alle Gemeinschaften gleich; ein Knoten, den es nicht
	 * gibt oder der nicht zur Geschaeftsart gehoert, wird im Kern abgewiesen.
	 */
	aendern: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();

		// «Köpfe zählen nicht» verlangt die Wertquoten; das Kästchen dazu ist dann
		// gesperrt und kommt nicht mit (ein gesperrtes Feld sendet der Browser nicht).
		const ohneKoepfe = jaNein(daten.get('kopfeZaehlenNicht'));
		const mitQuoten = ohneKoepfe || jaNein(daten.get('mitQuoten'));
		try {
			const { geaendert } = await aendereReglementsregelAn(
				handelnder,
				params.id,
				text(daten.get('regelId')),
				{
					geschaeftsart: text(daten.get('geschaeftsart')) as Geschaeftsart,
					kopfSchwelle: ohneKoepfe
						? null
						: {
								zaehler: ganzzahl(daten.get('kopfZaehler')),
								nenner: ganzzahl(daten.get('kopfNenner')),
								art: text(daten.get('kopfArt')) as Schwellenart
							},
					kopfbasis: ohneKoepfe ? 'anwesend_vertreten' : (text(daten.get('kopfbasis')) as Kopfbasis),
					quotenSchwelle: mitQuoten
						? {
								zaehler: ganzzahl(daten.get('quotenZaehler')),
								nenner: ganzzahl(daten.get('quotenNenner')),
								art: text(daten.get('quotenArt')) as Schwellenart
							}
						: null,
					quotenbasis: mitQuoten ? (text(daten.get('quotenbasis')) as Quotenbasis) : 'keine',
					knotenId: text(daten.get('knotenId')) || null,
					fundstelle: text(daten.get('fundstelle')),
					enthaltungZaehltMit: jaNein(daten.get('enthaltungZaehltMit')),
					hinweis: text(daten.get('hinweis')) || undefined
				}
			);
			return geaendert ? { geaendert: true } : { unveraendert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Weisungsregel dieses Hauses (Auftraggeber, 25.08.2026).
	 *
	 * «Also wie viele Kopfstimmen braucht es in % oder im Verhältnis. Dasselbe
	 * wenn WQ auch abgebildet ist. Also K und oder WQ.» — dieselben Felder wie
	 * bei einer Reglementsregel, nur ohne Geschäftsart: Sie gilt für die Weisung,
	 * gleich worum es in der Sache geht.
	 */
	weisungsregel: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		const mitQuoten = jaNein(daten.get('mitQuoten'));
		try {
			await speichereWeisungsregel(handelnder, {
				stwegId: params.id,
				kopfSchwelle: {
					zaehler: ganzzahl(daten.get('kopfZaehler')),
					nenner: ganzzahl(daten.get('kopfNenner')),
					art: text(daten.get('kopfArt')) as Schwellenart
				},
				kopfbasis: text(daten.get('kopfbasis')) as Kopfbasis,
				quotenSchwelle: mitQuoten
					? {
							zaehler: ganzzahl(daten.get('quotenZaehler')),
							nenner: ganzzahl(daten.get('quotenNenner')),
							art: text(daten.get('quotenArt')) as Schwellenart
						}
					: null,
				quotenbasis: mitQuoten ? (text(daten.get('quotenbasis')) as Quotenbasis) : 'keine',
				fundstelle: text(daten.get('fundstelle')),
				enthaltungZaehltMit: jaNein(daten.get('enthaltungZaehltMit')),
				ohneBeschluss: text(daten.get('ohneBeschluss')) === 'nein' ? 'nein' : 'enthaltung',
				hinweis: text(daten.get('hinweis')) || null
			});
			return { gespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	weisungsregelAufheben: async ({ locals, params }) => {
		await loescheWeisungsregel(handelnderAus(locals.benutzer), params.id);
		return { gespeichert: true };
	},

	aufheben: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			/*
			 * **Die Regel muss zu dieser Gemeinschaft gehören** (26.08.2026, aus der
			 * Sicherheitsprüfung). `loescheReglementsregel` sucht allein über die
			 * Kennung und kehrt bei einer unbekannten stillschweigend zurück — eine
			 * fremde fand sie und löschte sie, ohne dass die Seite etwas anzeigte,
			 * auf der sie stand.
			 */
			await pruefeReglementsregelGehoert(
				handelnder.operatorId,
				params.id,
				text(daten.get('regelId'))
			);
			await loescheReglementsregel(handelnder, text(daten.get('regelId')));
			return { aufgehoben: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Durchsicht bestätigen — auch dann, wenn nichts gefunden wurde.
	 *
	 * Gerade dann: Sonst steht die Gemeinschaft ewig auf «noch nie nachgesehen»,
	 * und der offene Punkt vor jeder Versammlung wiederholt sich, obwohl er
	 * erledigt ist.
	 */
	bestaetigen: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await vermerkePruefung(handelnder, params.id, text(daten.get('tag')) || heute());
			return { bestaetigt: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	zuruecksetzen: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await setzePruefungZurueck(handelnder, params.id, text(daten.get('grund')));
			return { zurueckgesetzt: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Erfordernisse der offenen Traktanden neu herleiten.
	 *
	 * Ausdrücklich angestossen und nicht als Nebenwirkung des Hinterlegens: Der
	 * Anwender sieht erst, was sich ändert, und entscheidet dann. Eine Regel zu
	 * erfassen und dabei ungefragt dreizehn Traktanden umzuschreiben wäre die
	 * andere Hälfte desselben Fehlers.
	 */
	nachziehen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const { nachgezogen, uebersprungen } = await erfordernisseNachziehen(
				handelnderAus(locals.benutzer),
				params.id
			);
			// Was die Schreibstelle abwies (Mehr der Einladung, Migration 144),
			// bleibt stehen; die Seite zeigt den Grund wie eine Absage.
			if (uebersprungen.length > 0) {
				return {
					nachgezogen,
					fehler: { nachricht: `Nicht nachgezogen: ${uebersprungen.join(' ')}`, feld: 'erfordernis' }
				};
			}
			return { nachgezogen };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	vermerken: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		await speichereVermerk(handelnder, params.id, text(daten.get('vermerk')));
		return { vermerkt: true };
	},

	/**
	 * Die Reihenfolge der Standardtraktanden speichern (Block C2).
	 *
	 * Das Formular schickt die Schlüssel als Liste versteckter Felder
	 * (`ordnung`) — in der Reihenfolge, die die Seite zeigt. Der Server prüft
	 * jeden Schlüssel gegen die Vorlagen; was nicht dazugehört, wird abgewiesen.
	 */
	ordnungSpeichern: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await speichereTraktandenordnung(
				handelnder,
				params.id,
				daten.getAll('ordnung').map((w) => text(w)).filter(Boolean)
			);
			return { ordnungGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Frist zur zweiten Versammlung hinterlegen oder herausnehmen.
	 *
	 * Leeres Feld heisst «nicht hinterlegt», und dann gilt das Gesetz — nicht
	 * «keine Frist». Eine kürzere als die gesetzliche weist der Kern ab
	 * (`pruefeZweitversammlungsfrist`), weil ein Reglement die Frist nur
	 * verlängern darf (Rz. 40 ad Art. 712p).
	 */
	zweitversammlungsfrist: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		const eingabe = text(daten.get('zweitversammlungsfristTage'));
		try {
			await speichereZweitversammlungsfrist(
				handelnder,
				params.id,
				eingabe ? ganzzahl(daten.get('zweitversammlungsfristTage')) : null,
				text(daten.get('zweitversammlungsfristFundstelle')) || null
			);
			return { zweitfristGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Bestimmung zur Einlage in den Erneuerungsfonds hinterlegen oder
	 * herausnehmen (Migration 193). Ohne Art herausgenommen; der Kern prüft
	 * Wortlaut und Fundstelle.
	 */
	fondsgrenze: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await speichereFondsgrenze(
				handelnder,
				params.id,
				text(daten.get('fondsgrenzeArt')) || null,
				text(daten.get('fondsgrenzeWortlaut')) || null,
				text(daten.get('fondsgrenzeFundstelle')) || null
			);
			return { fondsgrenzeGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Einberufungsfrist hinterlegen oder herausnehmen.
	 *
	 * Ein leeres Zahlenfeld heisst «nicht hinterlegt», nicht «null Tage» — dieselbe
	 * Unterscheidung wie bei der Vollmachtschranke. Der Kern trägt sie; hier wird
	 * nur nicht geraten.
	 */
	einberufungsfrist: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		const eingabe = text(daten.get('einberufungsfristTage'));
		try {
			await speichereEinberufungsfrist(
				handelnder,
				params.id,
				eingabe ? ganzzahl(daten.get('einberufungsfristTage')) : null,
				text(daten.get('einberufungsfristFundstelle')) || null
			);
			return { fristGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Schranke des Reglements über seine eigene Änderung (Migration 101).
	 *
	 * Ohne Häkchen gilt das gesetzliche Mehr; dann wird auch die Fundstelle
	 * weggeräumt, statt einen Verweis stehen zu lassen, der nichts mehr belegt.
	 */
	aenderungsschranke: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await speichereAenderungsschranke(
				handelnder,
				params.id,
				jaNein(daten.get('einstimmig')),
				text(daten.get('aenderungsschrankeFundstelle')) || null
			);
			return { schrankeGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Lesarten der Gemeinschaft (Migration 169). Derselbe Schreibweg wie auf
	 * der Seite `…/lesarten`; hier kommt ohnehin nur die Verwaltung an
	 * (Pfadwächter), die Rolle geht trotzdem vom Konto mit.
	 */
	lesarten: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await speichereLesarten(
				handelnder,
				locals.benutzer!.role,
				params.id,
				Object.fromEntries(LESARTEN.map((l) => [l.kennung, text(daten.get(l.kennung))]))
			);
			return { lesartenGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/** Wer die Lesarten umstellen darf. Nur die Verwaltung (Entscheid 0018, F1). */
	lesartenrecht: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await speichereLesartenrecht(handelnder, locals.benutzer!.role, params.id, text(daten.get('recht')));
			return { lesartenrechtGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Universalversammlung (Migrationen 126, 128): wer als da gilt, eine
	 * eigene Fundstelle, ob Vollmachten der Leitung zählen. Nur diese Angaben;
	 * die Angabe zum Reglement lässt `speichereAusnahmen` stehen.
	 */
	universalversammlung: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await speichereAusnahmen(handelnder, params.id, {
				universalvariante: text(daten.get('universalvariante')),
				universalFundstelle: text(daten.get('universalFundstelle')) || null,
				leitungsvollmachtenZaehlen: jaNein(daten.get('leitungsvollmachtenZaehlen'))
			});
			return { ausnahmenGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Ob das Reglement Beschlüsse über nicht angekündigte Gegenstände gestattet
	 * (Migrationen 126, 127). Nur diese Angabe: Was das Formular nicht schickt,
	 * lässt `speichereAusnahmen` stehen. Ohne Häkchen wird die Fundstelle
	 * weggeräumt, wie bei der Änderungsschranke.
	 */
	nichtangekuendigtes: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await speichereAusnahmen(handelnder, params.id, {
				reglementGestattet: jaNein(daten.get('reglementGestattet')),
				reglementFundstelle: text(daten.get('reglementFundstelle')) || null
			});
			return { ausnahmenGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Wie der zweite Durchgang möglich wird, wenn die Versammlung erst
	 * nachträglich beschlussfähig wird (Migration 139). Nur diese Angabe; der
	 * Kern prüft den Wert, und der eigene Schreibweg lässt die übrigen
	 * `stweg`-Angaben stehen.
	 */
	neuabstimmung: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await speichereNeuabstimmung(handelnder, params.id, text(daten.get('neuabstimmung')));
			return { neuabstimmungGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Ob das Mehr nach Ablauf der Einberufungsfrist noch milder gestellt werden
	 * kann (Migration 148, Produktentscheid 07.10.2026). Nur diese Angabe; der
	 * eigene Schreibweg prüft den Wert und lässt die übrigen `stweg`-Angaben
	 * stehen.
	 */
	milderungNachFrist: async ({ request, locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		const daten = await request.formData();
		try {
			await speichereMilderungNachFrist(handelnder, params.id, text(daten.get('milderungNachFrist')));
			return { milderungNachFristGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	ordnungZuruecksetzen: async ({ locals, params }) => {
		const handelnder = handelnderAus(locals.benutzer);
		try {
			await setzeTraktandenordnungZurueck(handelnder, params.id);
			return { ordnungZurueckgesetzt: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
