<script lang="ts">
	import { andereLesartenVon, andereLesartInWorten } from '$lib/domain/auszaehlung';
	import { VON_HAND_EINWAND_ZEIGER_ABEND } from '$lib/domain/vonhand';
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { nachziehen } from '$lib/nachziehen';
	import { anfangswert, gefuehrteWahl } from '$lib/felder';
	import {
		ergebnislage,
		GEHEIM_BESCHLUSS_HAKEN,
		GEHEIM_HINWEIS_LEITUNG,
		GEHEIM_REGLEMENT_HAKEN,
		stimmtNichtInWorten,
		imAusstandInWorten
	} from '$lib/domain/auszaehlung';
	import { untrack } from 'svelte';
	import { rolleInsBild } from '$lib/sichtfeld';
	import Beamerfenster from '$lib/components/Beamerfenster.svelte';
	import BeschlussVonHand from '$lib/components/BeschlussVonHand.svelte';
	import Beschlussfaehigkeitsanzeige from '$lib/components/Beschlussfaehigkeitsanzeige.svelte';
	import Einlass from '$lib/components/Einlass.svelte';
	import Papierentscheid from '$lib/components/Papierentscheid.svelte';
	import Wandbild from '$lib/components/Wandbild.svelte';
	import Pausenschalter from '$lib/components/Pausenschalter.svelte';
	import SicherndesFeld from '$lib/components/SicherndesFeld.svelte';
	import Modellantwort from '$lib/components/Modellantwort.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import {
		UNIVERSAL_KENNTNIS,
		keinBeschlussNamenszeilen,
		KREUZ_ZURUECKNEHMEN,
		wegNachKeinemBeschluss,
		WIDERSPRUCH_ERKLAERUNG,
		WIDERSPRUCH_FOLGE,
		WIDERSPRUCH_VOR_EROEFFNEN,
		WIDERSPRUCH_VOR_EROEFFNEN_FOLGE
	} from '$lib/domain/ausnahmen';
	import Wahlliste from '$lib/components/Wahlliste.svelte';
	import { datumLang, uhrzeit } from '$lib/domain/datum';
	import { fruehesterZweitTermin, vertagenNeueErsteSatz, vertagenUeberschrift } from '$lib/domain/versammlung';
	import { rueckkommensvorbehalt } from '$lib/domain/rueckkommen';
	import { angekreuzt } from '$lib/felder';
	import { stelltBeschlussfaehigkeitFest } from '$lib/domain/traktandenvorlage';
	import { zuordnungssatz } from '$lib/domain/freigabezuordnung';
	import TraktandumAufnehmen from '$lib/components/TraktandumAufnehmen.svelte';
	import Votum from '$lib/components/Votum.svelte';
	import {
		KONSULTATIV_HAKEN,
		entscheidetDasGeschaeft,
		nurKonsultativSatz
	} from '$lib/domain/konsultativ';
	import Stimmerfassung from '$lib/components/Stimmerfassung.svelte';
	import Eingriffe from '$lib/components/Eingriffe.svelte';
	import Ergebnisnachgang from '$lib/components/Ergebnisnachgang.svelte';
	import AbstimmungAbbrechen from '$lib/components/AbstimmungAbbrechen.svelte';
	import Pendenzen from '$lib/components/Pendenzen.svelte';
	import Ruegen from '$lib/components/Ruegen.svelte';
	import Antragspruefung from '$lib/components/Antragspruefung.svelte';
	import {
		NACH_KONSULTATIV,
		eingriffssatz,
		type Eingriffsart
	} from '$lib/domain/eingriffe';
	import {
		hindernisFuerRueckzug,
		offeneFolgeantraege,
		reihenfolgehinweis,
		taugtAlsGrundantrag
	} from '$lib/domain/folgeantrag';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';

	let { data, form } = $props();

	const v = $derived(data.versammlung);
	/** Die zuletzt festgehaltene Feststellung — im Saal zählt die jüngste. */
	const letzteFeststellung = $derived(data.feststellungen.at(-1) ?? null);
	/** Der gewählte Vertagungsgrund — er sperrt die Rückfrage, solange keiner dasteht. */
	let vertagungsgrund = $state('');
	/** Ob das Festhalten angeboten wird — nur beim Traktandum, das die Beschlussfähigkeit betrifft. */
	const festhalten = $derived(
		Boolean(data.aktuelles && stelltBeschlussfaehigkeitFest(data.aktuelles.titel))
	);

	/*
	 * **Was am aufgerufenen Traktandum jetzt möglich ist.**
	 *
	 * Gerechnet im Kern, damit die Zeile nichts anbietet, was der Server danach
	 * verweigert — und damit sich die Regeln an einer Stelle prüfen lassen.
	 */
	const jetztergebnis = $derived(
		data.ergebnisse.find((e) => e.traktandumId === data.aktuelles?.id) ?? null
	);
	const jetztlage = $derived({
		art: data.aktuelles?.art ?? 'abstimmung',
		/*
		 * Nach einer konsultativen Abstimmung ist das Geschäft offen
		 * (Produktentscheid 14.10.2026, H7 Teil D): Ausstand, Betroffene,
		 * Mehrheit, Gegenantrag und Rückzug stehen wieder da, wie am Server.
		 */
		abgestimmt:
			(jetztergebnis != null && entscheidetDasGeschaeft(jetztergebnis)) ||
			(data.aktuelles?.ersetzt ?? false),
		konsultativ: jetztergebnis?.zustand === 'geschlossen' && jetztergebnis.konsultativ,
		// «Kein Beschluss» ist kein Beschluss, auf den man zurückkäme (Migration 128).
		keinBeschluss:
			jetztergebnis?.zustand === 'geschlossen' &&
			ergebnislage(jetztergebnis.auszaehlung) === 'kein_beschluss',
		/*
		 * **Der Durchgang zu DIESEM Traktandum, nicht irgendeiner**
		 * (Code-Review 07.09.2026). `data.offen` trägt die Kennung des
		 * Traktandums mit, und der Server fragt beim Erklären wie beim
		 * Zurücknehmen nach `agenda_item_id = <dieses>`. Ohne die Einengung
		 * verschwiegen die Eingriffe am aufgerufenen Punkt, was der Server
		 * annähme — und der Knopf «Zurücknehmen» stünde da, wo er scheitert.
		 */
		durchgangOffen: data.offen != null && data.offen.traktandumId === data.aktuelles?.id,
		zurueckgezogen: data.aktuelles?.rueckzug != null,
		rueckkommenLaeuft: data.aktuelles?.rueckkommenLaeuft ?? false,
		rueckkommenOffen: data.aktuelles?.rueckkommenOffen ?? false,
		grundantragEntschieden: data.aktuelles?.grundantragEntschieden ?? false,
		// Für den Hilfesatz zum Gegenantrag nach dem Rückkommen (Fachprüfung Runde 2, R2-1).
		beschlussAngenommen:
			(jetztergebnis?.auszaehlung?.angenommen ?? data.aktuelles?.sacheAngenommen ?? true) === true,
		hatErfordernis: data.aktuelles?.hatErfordernis ?? false,
		spontan: data.aktuelles?.spontan ?? false,
		/*
		 * Das Veto braucht Betroffene **im Ausstand** — die Liste kommt vom
		 * Server und ist nur während des offenen Durchgangs gefüllt (Auftrag
		 * «Veto im Ausstand», 26.09.2026).
		 */
		kenntVeto: data.vetoStand.length > 0
	});

	/**
	 * Welches Feld offen steht — höchstens eines.
	 *
	 * Zwei offene Formulare nebeneinander sind im Saal eine Fehlerquelle: Man
	 * tippt in das eine und drückt den Knopf des anderen. Und die Karte bliebe
	 * nicht mehr überblickbar.
	 */

	/**
	 * Während eine Abstimmung läuft, tritt alles andere zurück (Story 6.8).
	 *
	 * Vor vierzehn wartenden Menschen ist die Traktandenliste mit ihren
	 * Aufruf-Knöpfen kein Angebot, sondern eine Fehlerquelle: Ein Klick daneben
	 * ruft mitten in der Abstimmung ein anderes Geschäft auf. Sie verschwindet
	 * deshalb nicht aus Gründen der Ästhetik, sondern damit sie nicht getroffen
	 * werden kann.
	 */
	/** Wer im Formular «Widerspruch festhalten» gewählt ist; die Rückfrage nennt sie (Laienprüfung R5). */
	let widersprechende = $state('');
	// Neu leer bei jedem neuen Durchgang und Geschäft, sonst stünde der frühere
	// Widersprechende vorgewählt da (Codeprüfung Block 3, dritter Durchgang, N-d).
	// Dasselbe Feld vor und nach dem Eröffnen: Sichtbar ist nur eines davon.
	$effect(() => {
		void data.offen?.id;
		void data.aktuelles?.id;
		widersprechende = '';
	});

	const abstimmungLaeuft = $derived(
		v.zustand === 'laufend' && data.offen !== null && data.offen !== undefined
	);

	/**
	 * Der gemeinsame Abend, wenn diese Versammlung zu einem gehört.
	 *
	 * Ist er gesetzt, wird der **Saal** dort geführt: Aufrufen, Abstimmen, Pause
	 * und Wandbild gelten für alle Gemeinschaften zugleich. Was der Gemeinschaft
	 * gehört — Stimmen, Voten, Ausstand, Rückkommen —, bleibt hier
	 * (`docs/vererbung-abend.md`).
	 *
	 * Der Server weist die vier Handlungen dann auch ab; hier verschwinden bloss
	 * die Knöpfe, damit keiner in eine Absage führt.
	 */
	const amAbend = $derived(data.abend);

	/**
	 * Das Mehr für die Maske «Beschluss von Hand» (Lauf B, Runde 3): derselbe
	 * Satz wie vor dem Eröffnen, weil die Seite ihn bei offener Abstimmung
	 * sonst nirgends zeigt. Nur mit einer Zahl (`kopf` oder `quoten`): Ohne
	 * Erfordernis, bei Kenntnisnahme, Grenzfall oder nicht berechenbarem Mehr
	 * richtet sich der Satz der Vorschau an Wand oder Telefone (Dritte Prüfung,
	 * Lauf B); dann sagt die Zeile, dass Votum kein Mehr nennt, statt zu
	 * fehlen, denn der Warnkasten verweist auf sie. Hängt
	 * die Zahl an der Anwesenheit, nennt die Zeile deren Herkunft: Der Notweg
	 * kommt gerade dann, wenn Votum hakt (Laienprüfung, Runde 4).
	 */
	const mehrFuerVonHand = $derived(
		data.aktuelles
			? data.vorschau && (data.vorschau.kopf || data.vorschau.quoten)
				? {
						erfordernis: data.aktuelles.erfordernis ?? null,
						satz: [
							data.vorschau.satz,
							...(data.vorschau.anwesenheitsabhaengig
								? ['Gerechnet mit der Anwesenheit, die Votum erfasst hat.']
								: []),
							...data.vonHandZusatz
						].join(' ')
					}
				: {
						erfordernis: data.aktuelles.erfordernis ?? null,
						satz: 'Votum nennt hier kein berechenbares Mehr; prüfen Sie es nach Reglement.'
					}
			: null
	);

	/**
	 * Ob am aufgerufenen Traktandum gerade konsultativ abgestimmt wird: Dann
	 * nennt die Seite oben weder das Mehr noch «nötig X» (Befund 8; Codeprüfung
	 * 14.10.2026, Befund 6). Gegen die Schwelle wird nichts entschieden.
	 */
	const konsultativOffenHier = $derived(
		!!data.offen?.konsultativ && data.offen.traktandumId === data.aktuelles?.id
	);

	/**
	 * Ob über ein Traktandum bisher nur konsultativ abgestimmt wurde: Dann ist es
	 * offen wie vor einer Abstimmung (H7, Teil D), und die Traktandenliste bietet
	 * an, was sie ohne Ergebnis anbietet.
	 */
	const nurKonsultativ = (e: { zustand: string; konsultativ: boolean } | undefined | null) =>
		e?.zustand === 'geschlossen' && e.konsultativ;

	/**
	 * Über welche Traktanden bereits entschieden ist — der massgebende Durchgang
	 * geschlossen. Einmal gerechnet, weil zwei Stellen danach fragen. Ein
	 * konsultativer zählt nicht (H7, Teil D): Der Folgeantrag bleibt wählbar.
	 */
	const entschieden = $derived(
		new Set([
			...data.ergebnisse.filter((e) => entscheidetDasGeschaeft(e)).map((e) => e.traktandumId),
			// Nach einer Ersetzung durch einen Folgeantrag trägt das Traktandum
			// kein eigenes Ergebnis mehr und ist doch entschieden (Migration 133).
			...data.traktanden.filter((t) => t.ersetzt).map((t) => t.id)
		])
	);

	/**
	 * Woran ein Folgeantrag hängen kann.
	 *
	 * **Die Regel steht im Kern** (`domain/folgeantrag.ts`), und seit dem
	 * 07.09.2026 zählen auch der entschiedene und der zurückgezogene Grundantrag
	 * dazu. Bis dahin nannte «Jetzt möglich» am aufgerufenen Punkt keinen
	 * Gegenantrag mehr, während dieses Formular denselben Antrag weiter zur
	 * Auswahl stellte und der Server ihn entgegennahm.
	 */
	const grundantraege = $derived(
		data.traktanden.filter((t) =>
			taugtAlsGrundantrag({
				art: t.art === 'abstimmung' ? 'abstimmung' : 'kenntnisnahme',
				spontan: t.spontan,
				entschieden: entschieden.has(t.id),
				// Je Versammlung ist höchstens ein Durchgang offen; `data.offen`
				// trägt, zu welchem Traktandum er gehört.
				durchgangOffen: data.offen?.traktandumId === t.id,
				zurueckgezogen: t.rueckzug != null,
				// Nach einem angenommenen Rückkommen tritt ein Folgeantrag an die
				// Stelle des alten Antrags (Produktentscheid 30.09.2026).
				rueckkommenOffen: t.rueckkommenOffen
			})
		)
	);

	/**
	 * Die Stelle eines Traktandums **unter seinen Geschwistern** — nicht sein
	 * Platz in dieser Liste.
	 *
	 * `data.traktanden` ist flach: Untertraktanden stehen darin zwischen den
	 * Hauptpunkten. Der Schleifenindex zählt sie mit, `verschiebeTraktandum`
	 * erwartet aber die Stelle unter den Geschwistern. Sobald irgendwo darüber
	 * ein Untertraktandum steht, laufen die beiden auseinander — der Wert ist zu
	 * gross, `verschiebe()` klemmt ihn ans Ende, und der «↑» bewegt nichts.
	 *
	 * Gefunden am 21.08.2026 vom Durchlauf, nachdem Rückkommensanträge zu
	 * Untertraktanden wurden: Vorher standen sie auf oberster Ebene, und die
	 * beiden Zählungen stimmten zufällig überein, solange es keinen Folgeantrag
	 * gab.
	 */
	const obersteStelle = $derived(
		new Map(data.traktanden.filter((t) => t.tiefe === 1).map((t, i) => [t.id, i]))
	);

	/** Wie viele Punkte auf oberster Ebene stehen — die Obergrenze des Feldes. */
	const obersteAnzahl = $derived(obersteStelle.size);

	/** Die Traktanden in der Form, die der Kern für die Reihenfolge braucht. */
	const antragsliste = $derived(
		data.traktanden.map((t) => ({
			id: t.id,
			nummer: t.nummer,
			titel: t.titel,
			art: t.art,
			hatErfordernis: t.hatErfordernis,
			grundantragId: t.grundantragId,
			entschieden: entschieden.has(t.id),
			zurueckgezogen: t.rueckzug != null
		}))
	);

	/**
	 * Der Anfangswert der Grundantragswahl im allgemeinen Weg: das aufgerufene
	 * Traktandum, wo es als Grundantrag taugt.
	 *
	 * Bewusst nur der Anfangswert — danach gehört das Feld der Sitzungsleitung.
	 * Der kurze Weg oben braucht ihn nicht: Dort steht der Grundantrag fest.
	 *
	 * **Dieselbe Frage wie die Auswahl darunter** (07.09.2026). Sonst steht im
	 * Feld ein Antrag, den die Liste gar nicht mehr führt — gewählt, aber nicht
	 * wählbar.
	 */
	const vorgewaehlterGrundantrag = untrack(() =>
		grundantraege.some((t) => t.id === data.aktuelles?.id) ? (data.aktuelles?.id ?? '') : ''
	);

	/**
	 * Der Stand aus dem Ereignisstrom.
	 *
	 * Damit zieht das zweite Gerät ohne Zutun nach: Wer am Notebook ein
	 * Traktandum aufruft, sieht es auf dem Telefon, ohne es dort neu zu laden
	 * (AD-10, Story 5.4).
	 */
	let stand = $state<{
		anzahlAnwesend: number;
		/** Wer angemeldet ist und auf die Freigabe wartet. */
		wartend?: number;
		/** Offene Meldungen vom QR auf der Leinwand. */
		saalmeldungen?: number;
		abstimmung: {
			durchgangId: string;
			zustand: string;
			abgegeben: number;
			stimmberechtigt: number;
			/** Zahl der Stimmzeilen — steigt auch bei einer Berichtigung. */
			zeilen?: number;
		} | null;
	} | null>(null);


	/*
	 * **Hier stand bis zum 28.08.2026 ein Griff, der nichts tat.**
	 *
	 * Er setzte `offeneZeilen` und `offenerEingriff` zurück, wenn das Geschäft
	 * wechselte — zwei Variablen, die diese Datei zwar deklarierte, aber nie
	 * las. Die wirklichen liegen in `Stimmerfassung.svelte` und
	 * `Eingriffe.svelte`. Der Griff sah richtig aus, war dokumentiert und
	 * blieb wirkungslos; gefunden hat ihn das Review, nicht der Prüflauf.
	 *
	 * An seine Stelle tritt der `{#key}` weiter unten: Was am aufgerufenen
	 * Geschäft hängt, wird beim Wechsel neu gebaut statt von Hand geräumt.
	 */

	/**
	 * **Die eben aufgenommene Zeile ins Bild holen** (Bedienbarkeitsprüfung
	 * 05.09.2026, Befund 5 der Bewirtschaftersicht).
	 *
	 * Gemessen am 06.09.2026: Nach «Aufnehmen» stand die neue Zeile bei
	 * **y = 3157 px**, das Fenster war 1100 px hoch. Wer den Knopf drückt,
	 * sieht seine Wirkung also nicht — im Prüfdurchgang entstand so ein
	 * zweiter, wortgleicher Folgeantrag. Die Quittung unten rechts sagt
	 * *dass* etwas geschah, nicht *was*.
	 *
	 * **Nur einmal je Antwort**: `form` ist bei jeder Antwort ein neues
	 * Objekt, daran hängt die Marke. Sonst rollte jeder Ereignisstrom-Anstoss
	 * die Seite erneut, während jemand woanders liest.
	 *
	 * Wann die Zeile im Baum steht, ist damit noch nicht gesagt; das regelt
	 * `zeigeZeile` weiter unten.
	 */
	let gezeigteAufnahme = $state.raw<unknown>(Symbol('nichts gezeigt'));
	$effect(() => {
		const ziel = form && 'aufgenommen' in form ? form.aufgenommen : null;
		if (!ziel || gezeigteAufnahme === form) return;
		/*
		 * **Erst, wenn die Zeile in den Daten steht.** `update()` stösst
		 * `invalidateAll()` an; der Effekt läuft davor, und ein `tick()` allein
		 * holt das nicht ein — die Marke, die er sucht, gibt es dann noch nicht.
		 * Der Griff scheiterte lautlos: Die Seite blieb stehen, wo sie war.
		 * Über `data.traktanden` hängt der Effekt an den Daten und läuft noch
		 * einmal, sobald sie da sind.
		 */
		if (!data.traktanden.some((t) => t.id === ziel)) return;
		gezeigteAufnahme = form;
		ebenAufgenommen = ziel;
		/*
		 * **Mit einer Warnung bleibt das Bild bei der Warnung** (06.10.2026).
		 * `Meldung.svelte` holt eine stehende Warnung nach dem Absenden selbst
		 * ins Bild; dieser Sprung fiele ins selbe Bild, und welcher zuletzt
		 * rollt, hinge an der Reihenfolge der Effekte. Die Warnung sagt, dass der Antrag steht und
		 * nicht noch einmal aufzunehmen ist, also genau das, wofür der Sprung
		 * da ist. Die Zeile trägt die Marke trotzdem.
		 *
		 * Seit dem Auftrag «votum-hinweise-lesbar» (Teil 4, 06.10.2026) reisen
		 * auch die übrigen Sätze mit einer Handlung vor der Abstimmung als
		 * Warnung (`Saalaufnahme.warnung`). Sie beginnen mit der Quittung
		 * «… ist aufgenommen», sagen also, dass der Antrag steht, aber nicht
		 * ausdrücklich, dass er nicht noch einmal aufzunehmen ist.
		 */
		if (form && 'warnung' in form && form.warnung) return;
		zeigeZeile(ziel);
	});

	/**
	 * Die Zeile anspringen, sobald sie im Baum steht.
	 *
	 * **Ein Bild später, nicht ein `tick()` später** (06.09.2026, an fünf
	 * Läufen gemessen). Mit `tick()` lief der Effekt, setzte die Marke `.eben`
	 * am richtigen Ort — und die Seite blieb trotzdem stehen: `querySelector`
	 * lieferte `null`, weil es die Zeile noch nicht gab, und das Scheitern war
	 * lautlos. Mit `requestAnimationFrame` steht sie da.
	 *
	 * Gemessen wurde auch, was **nicht** nötig ist: Ein zweiter und dritter
	 * Anlauf über weitere Bilder änderte nichts, der Lauf war mit und ohne ihn
	 * grün. `Meldung.svelte` kommt seit dem 27.08.2026 mit demselben einen
	 * Bild aus.
	 */
	function zeigeZeile(ziel: string): void {
		requestAnimationFrame(() => {
			const zeile = document.querySelector(`[data-traktandum="${ziel}"]`);
			if (zeile) rolleInsBild(zeile);
		});
	}

	/**
	 * Welche Zeile eben entstanden ist — sie trägt kurz eine Marke.
	 *
	 * **Die Hervorhebung ist nicht Zierde, sondern die Antwort auf «was ist
	 * neu».** Der Baum führt zwölf bis vierzig Zeilen; eine davon ist gerade
	 * dazugekommen, und wer nach dem Rollen hinsieht, soll sie nicht suchen
	 * müssen.
	 *
	 * Sie verschwindet weder von selbst noch beim nächsten Aufrufen oder
	 * Abstimmen, sondern erst, wenn wieder etwas aufgenommen wird — dann
	 * wandert sie mit. Das ist Absicht: Wer den Blick abwendet und
	 * zurückkommt, fände sie sonst nicht mehr. Die Marke sagt «zuletzt
	 * aufgenommen», nicht «gerade eben».
	 */
	let ebenAufgenommen = $state.raw<string | null>(null);

	$effect(() => {
		if (v.zustand !== 'laufend') return;
		// Nachziehen, aber nicht mitten in einem Seitenwechsel — die Begründung
		// steht im Kopf von `$lib/nachziehen`.
		const nach = nachziehen();
		const quelle = new EventSource(`/versammlungen/${v.id}/strom`);
		quelle.onmessage = (e) => {
			const neu = JSON.parse(e.data);
			untrack(() => {
				// Wechselt der Durchgang oder sein Zustand, müssen die Daten neu
				// geladen werden: Dann ändert sich mehr als eine Zahl — Formulare,
				// Ergebnisse, die Erfassungsliste.
				//
				// **`invalidateAll`, nicht `location.reload()`.** Die Formulare dieser
				// Seite senden als echte Navigation, und die eigene Aktion löst über
				// `verkuendeStand` genau so einen Wechsel aus. Der Reload traf dann
				// die noch laufende POST-Navigation und brach sie ab (ERR_ABORTED):
				// Die Aktion war serverseitig längst ausgeführt, aber Antwort und
				// Hinweis gingen verloren — je nach Rennen zwischen Antwort und
				// Stream-Push. So geschehen in den Durchspiel-Läufen vom
				// 14./15.08.2026 (Schritte 31 und 39). `invalidateAll` holt dieselben
				// Daten, lässt eine laufende Navigation aber zu Ende kommen.
				const alt = stand?.abstimmung;
				/*
				 * **Auch der Eingang ist ein Wechsel.** Bis zum 20.08.2026 lud diese
				 * Seite nur nach, wenn sich an der Abstimmung etwas änderte — wer
				 * währenddessen ankam, erschien erst beim nächsten Handgriff. Für
				 * die Person am Eingang ist das die ganze Wartezeit.
				 */
				const einlassWechsel =
					stand !== null &&
					((stand.wartend ?? 0) !== (neu.wartend ?? 0) ||
						(stand.saalmeldungen ?? 0) !== (neu.saalmeldungen ?? 0));
				/*
				 * **Auch eine einzelne Stimme ist ein Wechsel** (20.08.2026): «Auch in
				 * der Ansicht sollten die Bullets automatisch angezeigt werden, wenn
				 * jemand diese wählt.»
				 *
				 * Bis dahin zog nur die **Zahl** aus dem Strom nach, während die
				 * Erfassungstabelle darunter auf dem Stand des Seitenaufrufs stehen
				 * blieb — «1 von 13 haben abgestimmt» über dreizehn leeren Zeilen.
				 *
				 * Dass die Eingaben der Sitzungsleitung dabei überleben, liegt an zwei
				 * Dingen: Die Zeilen tragen einen Schlüssel (`(p.parteiId)`), also
				 * bleiben ihre Felder dieselben; und `angekreuzt()` setzt im Browser
				 * `defaultChecked`, das ein bereits angeklicktes Feld nicht mehr
				 * anrührt (`felder.ts`).
				 */
				/*
				 * **Auch eine geänderte Stimme ist ein Wechsel** (21.08.2026): «Das
				 * automatische Laden geschieht noch nicht, wenn ein Eigentümer
				 * abgestimmt hat, bzw. die Stimme geändert hat.»
				 *
				 * `abgegeben` zählt **Parteien** — eine Berichtigung lässt die Zahl
				 * unverändert, obwohl eine neue Stimmzeile entstanden ist (AD-5).
				 * Deshalb entscheidet hier `zeilen`: Die Zahl steigt bei jeder
				 * Abgabe und bei jeder Berichtigung.
				 */
				const stimmeDazu =
					alt != null &&
					neu.abstimmung != null &&
					alt.durchgangId === neu.abstimmung.durchgangId &&
					(alt.abgegeben !== neu.abstimmung.abgegeben ||
						(alt.zeilen ?? -1) !== (neu.abstimmung.zeilen ?? -1));
				const wechsel =
					(alt?.durchgangId ?? null) !== (neu.abstimmung?.durchgangId ?? null) ||
					(alt?.zustand ?? null) !== (neu.abstimmung?.zustand ?? null) ||
					stimmeDazu ||
					einlassWechsel;
				stand = neu;
				if (wechsel && alt !== undefined) nach.jetzt();
			});
		};
		return () => {
			quelle.close();
			nach.ende();
		};
	});

	const wartetGesamt = $derived(
		data.einlass.wartende.length + data.einlass.saalmeldungen.length
	);

	const fortschritt = $derived(stand?.abstimmung ?? data.offen?.fortschritt ?? null);
	/**
	 * Wer noch nicht gestimmt hat — **aus dem Loader, nie aus dem Strom**.
	 *
	 * Der Ereignisstrom trägt keine Namen (AD-11): Was dort fliesst, steht
	 * potenziell auf der Leinwand, und ein mitlesender Browser im Saal wüsste
	 * sonst im Umkehrschluss, wer schon gestimmt hat. Der erste Anlauf am
	 * 06.09.2026 hatte die Namen dort eingehängt; der Code-Review hat es
	 * gefunden.
	 *
	 * Nachgezogen werden sie trotzdem bei jeder Stimme: Der Strom stösst
	 * `invalidateAll()` an, und damit kommt der Loader neu.
	 */
	const offeneNamen = $derived(data.offen?.fortschritt?.offeneNamen ?? []);

	/**
	 * Was im Rückfragefenster steht, wenn noch Stimmen fehlen.
	 *
	 * `null`, wenn alle gestimmt haben: Dann gibt es nichts zu bedenken, und
	 * eine Rückfrage ohne Inhalt ist ein Klick zu viel.
	 */
	const schlussfolge = $derived.by(() => {
		const f = data.offen?.fortschritt;
		if (!f || f.abgegeben >= f.stimmberechtigt) return null;
		const fehlend = f.stimmberechtigt - f.abgegeben;
		return (
			`${fehlend} von ${f.stimmberechtigt} ` +
			`${fehlend === 1 ? 'Partei hat' : 'Parteien haben'} noch nicht gestimmt. ` +
			'Ihre Stimme gilt dann als nicht abgegeben — nicht als Enthaltung. ' +
			'Der Anwesenheitsstand dieses Augenblicks wird festgeschrieben.'
		);
	});
</script>

<!--
	**Der Notweg-Kasten: einmal beschrieben, an zwei Orten gezeigt**
	(03.10.2026, B1). Ohne offene Abstimmung steht er in `section.ablauf`,
	an seinem bisherigen Platz. Ist eine Abstimmung offen, blendet
	`.raster.eingeengt .ablauf` die ganze Spalte aus; dann wartet der
	Kasten am Ende von `section.geschaeft`. Sonst wären genau die zwei Wege
	verdeckt, die man dann braucht: «Abstimmung schliessen» (den es nur bei
	offener Abstimmung gibt) und der Beschluss von Hand.
-->
<!--
	**Die Zuordnung, die der Klick bestätigt** (Ä-05, nur der Kern; Auftrag M4).
	Geschäftsart, nötige Mehrheit, Ausstand und Anwesende stehen unmittelbar über
	dem Knopf, und der Knopf ist die Bestätigung: kein eigenes Häkchen, das als
	Pflichtfeld nur aufhielte. Die Marke trägt, was hier stand; hat ein anderes
	Gerät seither Geschäftsart, Mehrheit oder Ausstand geändert, weist der Server ab, statt etwas
	Überholtes als bestätigt in den Verlauf zu schreiben (`zuordnungsmarke`).
-->
{#snippet zuordnungsfeld(mitSatz = true)}
	{#if data.zuordnung}
		{#if mitSatz}
			<p class="klein" data-zuordnung>{zuordnungssatz(data.zuordnung, 'Abstimmung freigeben')}</p>
		{/if}
		<input type="hidden" name="zuordnung" value={data.zuordnung.marke} />
	{/if}
{/snippet}

{#snippet notwegKasten()}
	<!--
		**Der Notweg** (`docs/vererbung-abend.md`): «Ist der Abend nicht
		greifbar — Zuordnung versehentlich gelöst, zwei Geräte, ein Fehler
		—, muss sich ein Haus noch führen lassen. Was verschwindet, ist der
		*erste* Weg, nicht jeder.»

		Zugeklappt und benannt, damit niemand versehentlich zwei Steuerungen
		führt. `notweg=ja` ist kein Formfehler-Schalter: Der Server lässt die
		Handlung nur damit durch, und im Verlauf steht anschliessend ein
		Aufruf, den man erklären können muss.
	-->
	<!-- Der Hinweis zur eingewendeten Bestimmung, über dem zugeklappten Kasten
	     (Codeprüfung E2, M2; Laienprüfung E2, R2-L-2). -->
	{#if data.vonHand?.moeglich && data.vonHand.einwand}
		<p class="zeiger">{VON_HAND_EINWAND_ZEIGER_ABEND}</p>
	{/if}
	<details class="notweg">
		<summary>Notweg und Beschluss von Hand: diese Gemeinschaft von hier aus führen</summary>
		<p class="klein">
			In der Regel brauchen Sie diesen Kasten nur, wenn die gemeinsame Sitzungsleitung
			nicht erreichbar ist. Den Beschluss von Hand gibt es am Abend aber nur hier, auch
			wenn die gemeinsame Sitzungsleitung läuft. Was Sie hier tun, gilt für diese
			Gemeinschaft allein; die anderen Häuser des Abends berührt es nicht.
		</p>

		<!--
			**Bei offener Abstimmung nur Schliessen und die Maske** (Codeprüfung
			Lauf B, 03.10.2026). In diesem Zustand blendet der Saal-Modus den
			Ablauf mit Absicht aus; mit dem Kasten kämen sonst «Aufrufen» und
			«Pause» zurück. Ein Aufruf mitten im Durchgang liesse die
			Stimmerfassung verschwinden und die Maske auf ein anderes Traktandum
			zielen, während der alte Durchgang offen bleibt; die Pause stünde ohne
			den Satz des Pausenschalters da. **«Aufrufen» bleibt, wenn nichts
			aufgerufen ist** (Zweitprüfung): Nimmt der Abend den Aufruf zurück,
			während hier ein Durchgang offen ist, ist es der einzige Weg zurück zum
			Traktandum und damit zu Schliessen und Maske.
		-->
		{#if !abstimmungLaeuft || !data.aktuelles}
			<form
				method="POST"
				action="?/aufrufen"
				class="notzeile"
				use:enhance={absenden()}
			>
				<input type="hidden" name="notweg" value="ja" />
				<label>
					Traktandum aufrufen
					<Suchauswahl
						name="traktandum"
						beschriftung="Traktandum aufrufen"
						leerText="— Aufruf zurücknehmen —"
						eintraege={data.traktanden.map((t) => ({
							wert: t.id,
							text: `${t.nummer} ${t.titel}`
						}))}
					/>
				</label>
				<button type="submit" class="leise" data-fokus="notweg:aufrufen">Aufrufen</button>
			</form>
		{/if}

		<!--
			**Verschiedene Fokusmarken für die beiden Knöpfe** (28.08.2026 im
			Sicherheitsdurchgang gefunden). Sie ersetzen einander und trugen
			zuerst dieselbe Marke — wie beim Pausenschalter, wo das richtig ist.
			Hier nicht: Nach dem Schliessen stünde der Fokus auf «Abstimmung
			freigeben», und ein Nachdrücken (Tastenwiederholung, Enter,
			Doppeltipp) eröffnete sofort einen neuen Durchgang. Umgekehrt
			schlösse es die eben eröffnete Abstimmung mit null Stimmen, samt
			Auszählung, festgeschriebenem Anwesenheitsstand und Verkündung auf
			Leinwand und Telefonen. Die Doppelklicksperre greift nicht: Das
			sind zwei verschiedene Aktionen.

			Ohne genauen Treffer bleibt der Fokus auf `<body>` — hier die
			sichere Antwort.
		-->
		{#if data.aktuelles}
			{#if abstimmungLaeuft}
				<form
					method="POST"
					action="?/schliessen"
					class="notzeile"
					use:enhance={absenden()}
				>
					<input type="hidden" name="notweg" value="ja" />
					<button type="submit" class="leise" data-fokus="notweg:schliessen">
						Abstimmung schliessen
					</button>
				</form>
			{:else if data.aktuelles.art === 'abstimmung' && data.aktuelles.hatErfordernis}
				<!-- Der Satz über der Zeile, nicht in ihr: `.notzeile` ist eine
				     Flexzeile und quetschte ihn neben den Knopf (Codeprüfung M4, N5). -->
				{#if data.zuordnung}
					<p class="klein" data-zuordnung>
						{zuordnungssatz(data.zuordnung, 'Abstimmung freigeben')}
					</p>
				{/if}
				<form
					method="POST"
					action="?/oeffnen"
					class="notzeile"
					use:enhance={absenden()}
				>
					<input type="hidden" name="notweg" value="ja" />
					<input type="hidden" name="traktandum" value={data.aktuelles.id} />
					{@render zuordnungsfeld(false)}
					<button type="submit" class="leise" data-fokus="notweg:freigeben">
						Abstimmung freigeben
					</button>
				</form>
			{/if}
		{/if}

		{#if !abstimmungLaeuft}
			<form method="POST" action="?/pause" class="notzeile" use:enhance={absenden()}>
				<input type="hidden" name="notweg" value="ja" />
				<input type="hidden" name="an" value={v.pause ? 'nein' : 'ja'} />
				<button type="submit" class="leise">
					{v.pause ? 'Pause beenden' : 'Pause einlegen'}
				</button>
			</form>
		{/if}

		<!--
			**Der Beschluss von Hand am Abend** (Block 2b, 01.10.2026):
			dieselbe Maske wie unter «Jetzt möglich», hier mit
			`notweg=ja`. Sie steht als letztes im Kasten und nur, wenn
			ein Traktandum aufgerufen ist; sonst gäbe es kein
			Geschäft, an dem der Eintrag hängt.

			**Auch bei offener Abstimmung erreichbar** (03.10.2026, B1).
			Der Kasten lag bis dahin in `section.ablauf`, und die blendet
			`.raster.eingeengt .ablauf` aus, solange ein Durchgang offen
			ist; darin verschwanden genau die zwei Wege, die man dann
			braucht. Jetzt zeichnet ihn die Seite bei offener Abstimmung
			am Ende von `section.geschaeft`.
		-->
		{#if data.aktuelles && data.vonHand}
			{#key data.aktuelles.id}
				<BeschlussVonHand
					traktandumId={data.aktuelles.id}
					lage={data.vonHand}
					notweg
					mehr={mehrFuerVonHand}
					einwand={data.vonHand?.moeglich ? data.vonHand.einwand : null}
				/>
			{/key}
		{/if}
	</details>
{/snippet}

<!--
	**Die Erfassungstabelle steht einmal da und wird zweimal gezeigt.**

	In der einfachen Betriebsart ist sie der Normalfall: Der Saal stimmt von
	Hand, die Sitzungsleitung trägt ein. In der geführten ist sie der Notweg beim
	Teilausfall — Server läuft, Netz weg. Zwei Abschriften liefen auseinander,
	und dann stünde in der einen Betriebsart eine Spalte, die in der anderen
	fehlt.
-->

<div class="saalkopf">
	<div class="kopf">
		<h1>Sitzungsleitung</h1>
		{#if data.beschlussfaehig}
			<span class="marke"
				>{data.beschlussfaehig.anwesend} von {data.beschlussfaehig.gesamt} anwesend</span
			>
		{/if}
		<!--
			**Die Zahl steht dort, wo schon eine Zahl steht.** Wer am Eingang wartet,
			soll auffallen, ohne dass die Seite umspringt — die Marke sitzt neben der
			Anwesenheitszahl, und der Kasten mit den Namen steht darunter. Ein
			Verweis allein hätte verlangt, dass man ihn liest, bevor man weiss, ob
			sich das Lesen lohnt.
		-->
		{#if wartetGesamt > 0}
			<a class="marke wartet" href="#einlass">
				{wartetGesamt}
				{wartetGesamt === 1 ? 'wartet' : 'warten'} am Eingang
			</a>
		{/if}
		<!--
			**Der Beamerknopf gehört in diese Zeile** (21.08.2026): «kann man den
			Button Beamerfenster öffnen auf die Ebene Sitzungsleitung schieben? Dann
			hat die Kachel Aktuelles Geschäft bessere Sichtbarkeit.»

			Er stand darunter, mit seiner Einrichtungshilfe daneben, und nahm damit
			eine ganze Zeile — auf einem Notebook im Saal genug, um das aufgerufene
			Geschäft unter den Rand zu drücken. Gedrückt wird er einmal am Anfang;
			gelesen wird die Kachel darunter die ganze Sitzung.
		-->
		{#if v.zustand === 'laufend'}
			<span class="beamerplatz">
				<Beamerfenster pfad="/versammlungen/{v.id}/praesentation" knapp />
				<!--
					**Der Weg zum Anzeigecode gehört hierher** (22.08.2026, Befund C-04).
					Im Prüflauf suchte die Sitzungsleitung ihn beim Eröffnen und fand
					nichts; er stand auf der Versammlungsübersicht, zugeklappt, unter dem
					Namen «Code für den Beamer».

					Der Knopf daneben öffnet die Wand im eigenen Fenster — das reicht,
					solange der Beamer am selben Gerät hängt. Sobald er ein eigenes Gerät
					ist, braucht es den Code, und genau dann steht man hier.

					**Der Code lässt sich nicht nachschlagen, nur neu erzeugen:** In der
					Datenbank steht allein sein Prüfwert. Deshalb führt der Weg zur
					Übersicht, wo das Erzeugen samt Erklärung steht — statt hier eine
					zweite Stelle dafür aufzumachen.
				-->
				<a class="codeweg klein" href="/versammlungen/{v.id}#anzeigecode"
					>Code für ein anderes Beamer-Gerät</a
				>
			</span>
		{/if}
	</div>
	<p class="wo">
		Versammlung vom {datumLang(v.datum)} · {v.ort}
	</p>
	<p class="hin">
		<a href="/versammlungen/{v.id}">Zur Versammlung</a> ·
		<a href="/versammlungen/{v.id}/anwesenheit">Anwesenheit</a> ·
		<a href="/versammlungen/{v.id}/auswertung">Auswertung</a>
	</p>

	<!--
		**Der Wechsel zum Nachbarhaus** (Auftraggeber, 23.08.2026: «Wie kann ich beide
		gemeinsam führen?»).

		Am gemeinsamen Abend tagt jede Gemeinschaft für sich — eigene
		Beschlussfähigkeit, eigene Stimmberechtigte, eigene Mehrheiten. Eine
		Sitzungsleitung für beide zugleich gibt es deshalb nicht und soll es nicht
		geben: Ein Beschluss gehört genau einer Gemeinschaft. Was fehlte, war der
		WEG von der einen zur anderen — er führte über den Abend zurück und von
		dort auf die Tafel, im Saal drei Klicks und ein Suchen.

		Der Zustand steht dabei: «läuft» heisst, dort wartet jemand.
	-->
	{#if data.geschwister.length > 0}
		<p class="mit">
			<span class="klein">Zugleich am selben Abend:</span>
			{#each data.geschwister as g (g.id)}
				<a href="/versammlungen/{g.id}/leitung">
					{g.name}<span class="stand"
						>{g.zustand === 'laufend'
							? ' · läuft'
							: g.zustand === 'geschlossen'
								? ' · geschlossen'
								: ' · noch nicht eröffnet'}</span
					>
				</a>
			{/each}
		</p>
	{/if}
</div>

<div id="einlass">
	<Einlass
		wartende={data.einlass.wartende}
		saalmeldungen={data.einlass.saalmeldungen}
		parteien={data.einlass.parteien}
		laufend={v.zustand === 'laufend'}
		knapp
	/>
</div>

<!--
	**Die Meldung steht VOR der Verzweigung** (11.09.2026, aus dem Code-Review).
	Sie lag im Zweig «läuft» — und genau die Handlung, deren Auskunft man am
	dringendsten braucht, verlässt diesen Zweig: Vertagen schliesst die
	Versammlung, und der Satz mit Datum, Uhrzeit und Ort der Zweitversammlung
	wäre nie erschienen. Er steht auch sonst nirgends.
-->
{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}
<!--
	**Eine Warnung aus der Aufnahme bleibt stehen** (Produktentscheid
	06.10.2026, «Eigenes Feld für Warnungen, das stehen bleibt»). Mit
	`ton="warnung"` wandert sie nicht in die Quittungsecke, sondern steht hier,
	bis die Leitung sie schliesst oder die nächste Antwort des Servers kommt.
	Warum sie nicht als `hinweis` reist, steht bei `Saalaufnahme.warnung`.
-->
{#if form?.warnung}
	<Meldung ton="warnung" marke={form}>{form.warnung}</Meldung>
{/if}

{#if v.zustand !== 'laufend'}
	<p class="meldung warnung">
		Die Versammlung läuft nicht. <a href="/versammlungen/{v.id}">Zur Versammlung</a>
	</p>
{:else}

	<!-- Derselbe Kasten wie an den beiden Eingängen; er steht überall dort, wo
	     die Frage gestellt werden kann. -->
	<Papierentscheid papier={form && 'papier' in form ? form.papier : null} />

	<!--
		**Der Saal wird am Abend geführt** (Auftraggeber, 25.08.2026: «wenn die Gruppe mit
		Hart im Lead ist, sollte man in der Einzelveranstaltung keine
		Einstellungen machen können. Also keine Steuerung der Präsentation etc.»).

		Zwei Steuerungen für einen Saal laufen auseinander — genau das war der
		Fehler vom 25.08.2026: Die Häuser standen auf verschiedenen Punkten, und
		die gemeinsame Sicht zeigte den falschen.

		Der Kasten steht **ganz oben**, nicht neben den fehlenden Knöpfen: Wer die
		Seite öffnet und die Steuerung sucht, soll den Weg finden, bevor er sie
		vermisst.
	-->
	{#if amAbend}
		<div class="fremdgefuehrt">
			<p>
				<strong>Dieser Saal wird gemeinsam geführt.</strong>
				Aufrufen, Abstimmen, Pause und Wandbild gelten für alle Gemeinschaften des Abends
				zugleich — deshalb stehen sie dort und nicht hier.
			</p>
			<a class="handlung" data-gewicht="haupt" href="/tage/{amAbend.id}/leitung">
				Zur gemeinsamen Sitzungsleitung
			</a>
			<p class="klein">
				Was hier bleibt: Stimmen erfassen, stellvertretend stimmen, Voten, Ausstand und
				Rückkommen, also die Sachen dieser Gemeinschaft. Den Beschluss von Hand finden Sie
				im Kasten «Notweg und Beschluss von Hand».
			</p>
		</div>
	{/if}

	<!--
		**Der Pausenschalter steht vor dem Ablauf** (21.08.2026): «Für die Pause
		braucht es einen eigenen Knopf bei der Steuerung.»

		Ganz oben, weil er im Notfall gebraucht wird — und weil ein unterbrochener
		Saal das Erste ist, was die Sitzungsleitung sehen muss, wenn sie
		zurückkommt.
	-->
	{#if !amAbend}
		<Pausenschalter pause={v.pause ?? null} abstimmungOffen={abstimmungLaeuft} />
	{/if}

	<div class="raster" class:eingeengt={abstimmungLaeuft}>
		<!-- ── Links: der Ablauf ────────────────────────────────────────────── -->
		<section class="ablauf">
			<h2>Ablauf</h2>

			<ol class="dreischritt">
				<li class="vorher">
					<span class="rolle">vorher</span>
					{#if data.vorheriges}
						<strong>{data.vorheriges.nummer}</strong> {data.vorheriges.titel}
						<!--
							**Auch zurück mit einem Klick** (21.08.2026): «beim Vorher wäre auch
							einen Aufruf-Button nützlich. so kann man dann switchen.»

							Vorwärts ging es hier schon, rückwärts führte der Weg über die Liste
							unten — im Saal ein Suchen, während alle zusehen. Zurückgehen ist der
							häufigere Fall: Jemand meldet sich zum vorigen Punkt, und die Wand
							soll ihn wieder zeigen.

							Der Knopf ist **leise**, der bei «nachher» ist die Haupthandlung. Ein
							zweiter gefüllter Knopf machte die Karte zu zwei gleich lauten
							Angeboten, und der Ablauf geht nun einmal vorwärts.
						-->
						{#if !amAbend}
							<form method="POST" action="?/aufrufen" use:enhance={absenden()}>
								<input type="hidden" name="traktandum" value={data.vorheriges.id} />
								<button type="submit" class="leise" data-fokus="aufrufen:vorheriges">Aufrufen</button>
							</form>
						{/if}
					{:else}<span class="leer">—</span>{/if}
				</li>
				<li class="jetzt">
					<span class="rolle">jetzt</span>
					{#if data.aktuelles}
						<strong>{data.aktuelles.nummer}</strong> {data.aktuelles.titel}
						<!--
							**Der Weg zurück zum Wandbild.**

							Solange ein Traktandum aufgerufen ist, steht es an der Wand — vor
							Traktandenliste, Begrüssung und freiem Text. Ohne diesen Knopf
							liesse sich der Aufruf nirgends mehr zurücknehmen, und die Wand
							bliebe bis zum Schluss beim zuletzt aufgerufenen Geschäft stehen.
						-->
						{#if !amAbend}
							<form method="POST" action="?/aufrufen" use:enhance={absenden()}>
								<input type="hidden" name="traktandum" value="" />
								<button type="submit" class="leise" data-fokus="aufrufen:jetzt">Aufruf zurücknehmen</button>
							</form>
						{/if}
						<!--
							**Hier steht nur die Navigation.** Der Arbeitsblock zum aufgerufenen
							Geschäft (Nutzniessung, Votum, Ausstandsstand und «Jetzt möglich»)
							steht seit dem 07.09.2026 rechts unter «Aktuelles Geschäft», wie in
							der Abendsicht. Die Begründung steht dort.
						-->
					{:else}<span class="leer">kein Traktandum aufgerufen</span>{/if}
				</li>
				<li class="nachher" class:amEnde={data.abschluss.amEnde}>
					<span class="rolle">nachher</span>
					{#if data.abschluss.amEnde}
						<!--
							**Der Abschluss steht dort, wo sonst das nächste Geschäft steht**
							(21.08.2026): «Wenn das letzte Traktandum durch ist, kann dort der
							Abschluss knopf kommen, damit die Sitzung beendet wird.»

							Genau hier sucht die Sitzungsleitung den nächsten Schritt — den
							ganzen Abend lang. Ist keiner mehr da, ist der nächste Schritt der
							Schluss.

							**Mit Rückfrage**, anders als beim Unterbrechen: Schliessen lässt
							sich nicht zurücknehmen. Danach sind die Zugänge entwertet und die
							Leinwand wertlos.
						-->
						<strong>Alle Traktanden behandelt</strong>
						{#if data.abschluss.ohneBeschluss > 0}
							<p class="klein">
								{data.abschluss.ohneBeschluss === 1
									? 'Über einen Antrag wurde nicht abgestimmt'
									: `Über ${data.abschluss.ohneBeschluss} Anträge wurde nicht abgestimmt`} — das ist
								zulässig, steht aber so im Protokoll.
							</p>
						{/if}
						{#if data.abschluss.nurKonsultativ.length > 0}
							<p class="klein">
								{nurKonsultativSatz(
									data.abschluss.nurKonsultativ,
									data.abschluss.vertagbar,
									data.abschluss.nurKonsultativImSaal
								)}
								{#if data.abschluss.vertagbar}
									<a href="/versammlungen/{v.id}/anwesenheit">Zur Seite «Anwesenheit»</a>
								{/if}
							</p>
						{/if}
						<form method="POST" action="?/abschliessen" use:enhance={absenden()}>
							<Rueckfrage
								beschriftung="Versammlung schliessen"
								gewicht="haupt"
								ton="warnung"
								frage="Versammlung schliessen?"
								folge={(data.abschluss.ohneBeschluss > 0
									? `Das lässt sich nicht zurücknehmen. Über ${data.abschluss.ohneBeschluss} ${data.abschluss.ohneBeschluss === 1 ? 'Antrag' : 'Anträge'} wurde nicht abgestimmt; die Zugänge werden entwertet, und die Leinwand zeigt danach den Abschluss.`
									: 'Das lässt sich nicht zurücknehmen. Die Zugänge werden entwertet, und die Leinwand zeigt danach den Abschluss.') +
									(data.abschluss.nurKonsultativ.length > 0
										? ` ${nurKonsultativSatz(
									data.abschluss.nurKonsultativ,
									data.abschluss.vertagbar,
									data.abschluss.nurKonsultativImSaal
								)}`
										: '')}
								bestaetigen="Jetzt schliessen"
							/>
						</form>
					{:else if data.naechstes}
						<strong>{data.naechstes.nummer}</strong> {data.naechstes.titel}
						{#if !amAbend}
							<form method="POST" action="?/aufrufen" use:enhance={absenden()}>
								<input type="hidden" name="traktandum" value={data.naechstes.id} />
								<button type="submit" class="haupt" data-fokus="aufrufen:naechstes">Aufrufen</button>
							</form>
						{/if}
					{:else}<span class="leer">—</span>{/if}
				</li>
			</ol>

			<h3>Alle Traktanden</h3>
			<ul class="baum">
				{#each data.traktanden as t (t.id)}
					{@const stelle = obersteStelle.get(t.id) ?? 0}
					{@const e = data.ergebnisse.find((x) => x.traktandumId === t.id)}
					<li
						style:--tiefe={t.tiefe}
						class:aktiv={t.id === v.aktuellesTraktandumId}
						class:eben={t.id === ebenAufgenommen}
						data-traktandum={t.id}
					>
						<!--
							**Drei feste Zonen statt einer umbrechenden Reihe** (20.08.2026).

							Gemeldet nach einem Blick auf das eigene Telefon: «Der Ablauf auf dem
							Mobiltelefon müsste etwas ruhiger und cleaner dargestellt sein.» Die
							Zeile war ein `flex-wrap` mit bis zu sechs Teilen, und je nachdem, wie
							lang der Titel war und welche Teile es gerade gab, landete jedes davon
							woanders: Bei Traktandum 4 stand «Kenntnisnahme» unter dem Titel, bei
							Traktandum 5 die Marke «angenommen» links neben «Aufrufen», bei 6 der
							Erfordernistext über die ganze Breite. Gemessen auf 390 px:
							Zeilenhöhen zwischen 67 und 236 px.

							Jetzt hat jedes Ding seinen Platz, unabhängig von der Titellänge:

							  Nr │ Titel …………………………… │ Stand
							     │ Einordnung (Erfordernis)
							     │ Handlungen

							Der Stand steht immer rechts oben, die Handlungen immer zuunterst.
							Was in einer Zeile fehlt, lässt eine Lücke — keine Verschiebung.
						-->
						<div class="zeile">
							<span class="nr">{t.nummer}</span>
							<span class="titel">
								{t.titel}
								{#if t.spontan}
									<!-- **Der Rückkommensantrag hiess «neu aufgenommen».** Er ist das
									     Gegenteil davon: Sein Gegenstand stand auf der Liste und ist
									     behandelt; neu ist allein die Frage, ob nochmals darüber
									     beraten wird. -->
									<span class="marke leise">
										{t.spontanart === 'folgeantrag'
											? 'Folgeantrag'
											: t.spontanart === 'rueckkommen'
												? 'Rückkommen'
												: 'neu aufgenommen'}
									</span>
								{/if}
							</span>

							<span class="stand">
								{#if t.rueckzug}
									<!-- **Zurückgezogen ist nicht abgelehnt.** Das Wort steht deshalb
									     eigens da und nicht als Spielart von «abgelehnt». -->
									<span class="marke leise" title={t.rueckzug.grund}>zurückgezogen</span>
								{:else if t.art === 'kenntnisnahme'}
									<span class="marke leise">Kenntnisnahme</span>
								{:else if e}
									<!--
										**Drei Zustände, nicht zwei** (05.09.2026, im Browserdurchlauf
										gefunden). Bei offenem Stichentscheid ist `angenommen` falsch,
										weil das Mehr nicht erreicht ist — hier stand deshalb
										«abgelehnt», während zehn Zentimeter weiter rechts stand:
										«solange sein Entscheid nicht vorliegt, steht kein Ergebnis
										fest». Wer nur die Liste liest, hielt den Antrag für erledigt.

										**«Entscheid steht aus» nur, wo einer eingetragen werden
										kann** (aus dem Code-Review): Ein geschlossener Durchgang
										ohne Auszählung hat kein Formular dafür, und der Satz
										schickte in eine Sackgasse. Dort heisst es «ohne Ergebnis».
									-->
									<span
										class="marke"
										class:gut={ergebnislage(e.auszaehlung) === 'angenommen'}
										>{e.zustand === 'offen'
											? 'läuft'
											: ergebnislage(e.auszaehlung) === 'angenommen'
												? 'angenommen'
												: ergebnislage(e.auszaehlung) === 'abgelehnt'
													? 'abgelehnt'
													: ergebnislage(e.auszaehlung) === 'kein_beschluss'
														? 'kein Beschluss'
														: e.auszaehlung
															? 'Gleichstand offen'
															: 'ohne Ergebnis'}</span
									>
								{:else if !t.hatErfordernis}
									<!--
										Ein Verweis, kein blosses Wort: Die Zuordnung wird oft erst im
										Saal geklärt, und wer dort liest «ohne Erfordernis», ohne
										hinzukommen, muss die Seite suchen, während vierzehn Leute warten.
									-->
									<a
										class="marke warnung"
										href="/versammlungen/{v.id}/traktanden/{t.id}/erfordernis?zurueck=/versammlungen/{v.id}/leitung"
									>
										Erfordernis setzen
									</a>
								{/if}
							</span>

							{#if t.art !== 'kenntnisnahme' && t.hatErfordernis && (!e || t.rueckkommenOffen || nurKonsultativ(e))}
								<!--
									Der **Titel** des Erfordernisses, nicht das Wort «Erfordernis».
									Die Zeile sagt sonst nur, dass eines da ist — und wer gleich zur
									Abstimmung aufruft, will wissen, welches. Der Verweis führt
									weiterhin zum Ändern; auch ein gesetztes Erfordernis bleibt bis
									zur Abstimmung änderbar (FR-22), danach nicht mehr: Dann stünde
									am Traktandum eine andere Regel als die, nach der gezählt wurde.
									Wieder änderbar nach einem angenommenen Rückkommen, bis zur
									erneuten Abstimmung (H6, `erfordernisAenderbar`), und nach
									einer konsultativen Abstimmung (H7, Teil D).
								-->
								<span class="einordnung">
									<a
										class="aendern"
										href="/versammlungen/{v.id}/traktanden/{t.id}/erfordernis?zurueck=/versammlungen/{v.id}/leitung"
										title="Mehrheitserfordernis ändern">{t.erfordernis}</a
									>
								</span>
							{/if}

							<!--
								**Die Handlungen zuletzt und beieinander.** Aufrufen ist die
								häufigste und steht zuerst; Verschieben bleibt während der Sitzung
								möglich (Ordnungsentscheid, steht im Verlauf).

								**Die Prüfung des Folgeantrags stand hier mit** und tut es seit
								dem 08.09.2026 nicht mehr; sie ist beim aufgerufenen Geschäft.
								Der Ausdruck hatte damit eine vierte Klammer, die nur den
								Knopf der Prüfung meinte, und ohne sie stand die Zeile leer da.
							-->
							{#if (t.id !== v.aktuellesTraktandumId && !t.rueckzug) || (t.rueckzug && t.id !== v.aktuellesTraktandumId && !amAbend) || (t.tiefe === 1 && obersteAnzahl > 1)}
								<span class="tat">
									{#if t.id !== v.aktuellesTraktandumId && !t.rueckzug && !amAbend}
										<form method="POST" action="?/aufrufen" use:enhance={absenden()}>
											<input type="hidden" name="traktandum" value={t.id} />
											<button type="submit" class="leise">Aufrufen</button>
										</form>
									{/if}
									<!--
										**Der Rückzug lässt sich auch in der Liste zurücknehmen**
										(Bedienbarkeitsprüfung 05.09.2026, zweiter der vier schweren
										Befunde der Bewirtschaftersicht): «Nach dem Rückzug hat die
										Zeile nur noch ‹Stelle› und ‹↵›. Kein Knopf in der Zeile,
										keiner auf der Traktandenseite, nichts im Handbuch.» Der
										Prüfer brach nach vier Minuten ab.

										Den Weg gab es, aber nur am **aufgerufenen** Traktandum weiter
										oben — und ein zurückgezogenes ruft man gerade nicht auf. Der
										Server prüft die Zulässigkeit ohnehin selbst
										(`verlangeRuecknehmbar`); hier steht nur der Weg dorthin.
									-->
									{#if t.rueckzug && t.id !== v.aktuellesTraktandumId && !amAbend}
										<form method="POST" action="?/rueckzugZurueck" use:enhance={absenden()}>
											<input type="hidden" name="traktandum" value={t.id} />
											<button
												type="submit"
												class="leise"
												data-fokus="rueckzug:{t.id}"
											>Rückzug zurücknehmen</button>
										</form>
									{/if}
									{#if t.tiefe === 1 && obersteAnzahl > 1}
										<!--
											**Ein Feld statt eines Pfeils** (21.08.2026): «Wäre nicht
											smart, wenn man anstelle dem Pfeil, ein Feld hat, in dem man
											die Positionsnummer eingeben kann?»

											Bei vierzehn Traktanden bedeutete der Pfeil bis zu dreizehn
											Klicks, jeder mit einem vollständigen Seitenwechsel — im Saal,
											während alle zusehen. Das Feld braucht eine Eingabe.

											**Die Stelle ist nicht die Nummer.** Links steht «12», hier
											steht vielleicht «11»: Seit der Freigabe hängt die Nummer an
											der Einladung, die Stelle am Ablauf des Abends. Deshalb steht
											das Wort dabei und nicht nur die Zahl.
										-->
										<!--
							**Hier wird geleert, anders als bei den übrigen Tabellen.** Das
							Stellenfeld trägt seinen Wert über `anfangswert()`, und das setzt
							im Browser nur `defaultValue` — ein einmal angefasstes Feld
							bliebe sonst dauerhaft auf der getippten Zahl stehen und zeigte
							nach der nächsten Verschiebung eine Stelle, die nicht mehr
							stimmt. Die verborgenen Kennungen daneben überstehen das
							`reset()`: Bei `input[type=hidden]` schreibt der `value`-Setter
							das Attribut mit, der Standardwert ist also derselbe Wert.
						-->
						<form
							method="POST"
							action="?/verschieben"
							class="stellenform"
							use:enhance={absenden({ zurueckBeiAbsage: true })}
						>
											<input type="hidden" name="traktandum" value={t.id} />
											<input type="hidden" name="elternteil" value="" />
											<label>
												Stelle
												<!--
													`anfangswert` und nicht `value`: Ein `value={…}` ist in
													Svelte 5 reaktiv und setzt das Feld bei jedem Neuzeichnen
													zurück — hier bei jedem Nachziehen über den Ereignisstrom,
													also mitten im Tippen. Die Feldregel (`scripts/eslint/felder.mjs`) hat es
													beim ersten Anlauf gefunden.
												-->
												<input
													type="number"
													name="stelle"
													{...anfangswert(String(stelle + 1))}
													min="1"
													max={obersteAnzahl}
													required
													title="An welcher Stelle im Ablauf dieser Punkt behandelt wird"
													onchange={(e) => e.currentTarget.form?.requestSubmit()}
												/>
											</label>
											<!--
												Der Knopf bleibt, obwohl `onchange` schon abschickt: Ohne
												JavaScript ist er der einzige Weg, und auf dem Telefon ist er
												die Bestätigung, dass die Eingabe angekommen ist.
											-->
											<button
												type="submit"
												class="leise"
												aria-label="{t.nummer} {t.titel} an die eingetragene Stelle setzen"
											>Setzen</button>
										</form>
									{/if}
									<!--
										**Hier stand die Zulässigkeitsprüfung** (`Antragspruefung`), und zwar
										zweimal je Traktandum: der Knopf in dieser Handlungszeile, die Antwort
										als Block unter der Zeile. Seit dem 08.09.2026 steht sie einmal, beim
										aufgerufenen Geschäft, wie am gemeinsamen Abend. Die Begründung steht
										dort.
									-->
								</span>
							{/if}
						</div>

						{#if !e || nurKonsultativ(e)}
							{@const folgende = offeneFolgeantraege(antragsliste, t.id)}
							{#if folgende.length > 0}
							<!--
								**Über Folgeanträge wird zuerst abgestimmt** (FR-43). Ein
								Vorschlag, keine Sperre: Die Sitzungsleitung führt die Versammlung
								und kann abweichen — etwa wenn zuerst die Grundsatzfrage geklärt
								werden soll.
							-->
								<p class="reihenfolge">{reihenfolgehinweis(folgende)}</p>
							{/if}
						{/if}
						{#if t.rueckzug}
							<p class="rueckzugsvermerk">
								Zurückgezogen von {t.rueckzug.durch}: {t.rueckzug.grund}
							</p>
						{:else if t.art === 'abstimmung' && ((e && e.zustand === 'geschlossen' && ergebnislage(e.auszaehlung) !== 'kein_beschluss') || t.ersetzt) && !t.rueckkommenLaeuft && t.id !== v.aktuellesTraktandumId}
							<!--
								**Rückkommen** (FR-44). Nicht ein Knopf, der das Traktandum einfach
								wieder öffnet: Über das Rückkommen entscheidet die **Versammlung**.
								Was hier entsteht, ist ein eigener Antrag, über den zuerst
								abgestimmt wird.

								**Nur für die übrigen Traktanden.** Beim aufgerufenen steht derselbe
								Weg oben unter «Jetzt möglich»; zweimal nebeneinander wäre er keine
								zweite Möglichkeit, sondern eine zweite Stelle zum Suchen.

								**Auch am ersetzten Traktandum** (Codeprüfung B2a, M-a). Hat ein
								Folgeantrag seinen Beschluss nach einem Rückkommen ersetzt, trägt
								es kein eigenes Ergebnis mehr; entschieden ist es trotzdem, und der
								Server nimmt ein Rückkommen darauf an. Der Hinweis richtet sich
								dann nach dem Beschluss zum Folgeantrag (`sacheAngenommen`).
							-->
							<details class="rueckkommen">
								<summary>Rückkommen beantragen</summary>
								<p class="hilfe">
									Es entsteht ein eigener Antrag: «{t.nummer} {t.titel}» wird erneut
									behandelt. Erst wenn die Versammlung ihn annimmt, lässt sich zur Sache
									nochmals abstimmen.
								</p>
								<p class="hilfe vorbehalt">
									{rueckkommensvorbehalt((e?.auszaehlung?.angenommen ?? t.sacheAngenommen) === true)}
								</p>
								{#if t.folgeantragHinweis}
									<!-- Neben dem Vorbehalt, nicht in ihm (H6, M3 Teil A). -->
									<p class="hilfe vorbehalt">{t.folgeantragHinweis}</p>
								{/if}
								<form method="POST" action="?/rueckkommen" use:enhance={absenden()}>
									<input type="hidden" name="traktandum" value={t.id} />
									<button type="submit" data-fokus="eingriff:{t.id}">Rückkommensantrag stellen</button>
								</form>
							</details>
						{:else if t.art === 'abstimmung' && (!e || nurKonsultativ(e)) && !t.ersetzt && t.id !== v.aktuellesTraktandumId}
							<!--
								**Zurückziehen** (FR-45). Nur solange nicht abgestimmt ist — danach
								gehört das Ergebnis der Versammlung, und wer es ändern will, braucht
								ihre Zustimmung. Nach einer nur konsultativen Abstimmung gibt es kein
								solches Ergebnis (H7, Teil D). Als aufklappbares Feld, damit der Grund gleich
								mitkommt: «zurückgezogen» ohne Grund lässt jeden Leser des
								Protokolls rätseln.

								Beim aufgerufenen Traktandum steht er oben unter «Jetzt möglich» —
								hier also nur für die übrigen.
							-->
							<details class="rueckzug">
								<summary>Antrag zurückziehen</summary>
								{#if offeneFolgeantraege(antragsliste, t.id).length > 0}
									<!--
										**Der Grund statt des Formulars** (08.09.2026). Solange ein
										Folgeantrag offen daran hängt, sagt der Server ab — ein
										Formular, das man ausfüllen kann und das dann nicht trägt,
										ist schlechter als ein Satz, der sagt, was zuerst dran ist.
										Die Zusicherung hängt nicht hieran: `verlangeZurueckziehbar`
										prüft es unabhängig von dieser Seite.
									-->
									<p class="hilfe">
										{hindernisFuerRueckzug(offeneFolgeantraege(antragsliste, t.id))?.meldung}
									</p>
								{:else}
								<form method="POST" action="?/zurueckziehen" use:enhance={absenden()}>
									<input type="hidden" name="traktandum" value={t.id} />
									<label>
										Grund
										<input
											name="grund"
											required
											minlength="3"
											placeholder="z. B. Offerte liegt noch nicht vor"
										/>
									</label>
									<!-- Nach einer konsultativen Abstimmung derselbe Satz wie oben
									     unter «Jetzt möglich», aus dem Kern (Codeprüfung Runde 2, M1). -->
									{#if nurKonsultativ(e)}
										<p class="hilfe">{NACH_KONSULTATIV.zurueckziehen}</p>
									{:else}
										<p class="hilfe">
											Der Antrag bleibt in der Liste und im Protokoll — als
											<strong>zurückgezogen</strong>, nicht als abgelehnt. Es gab keine
											Abstimmung, also auch keine Mehrheit dagegen.
										</p>
									{/if}
									<button type="submit">Zurückziehen</button>
								</form>
								{/if}
							</details>
						{/if}
					</li>
				{/each}
			</ul>

			<!-- ── Traktandum während der Sitzung (Stories 5.11 und 5.12) ──── -->
			<details class="spontan">
				<summary>Eine weitere Sache aufnehmen</summary>
				<p class="hilfe">
					Für einen Gegenantrag zum <em>aufgerufenen</em> Traktandum gibt es den kürzeren
					Weg oben bei «Jetzt möglich». Hier steht der allgemeine: auch eine Sache, die
					heute gar nicht angekündigt war.
				</p>
				<!--
					**`{#key}` auch hier** (28.08.2026). `vorgewaehlterGrundantrag` ist
					mit `untrack()` beim Seitenaufbau eingefroren — solange «Aufrufen»
					die Seite neu lud, folgte er dem Geschäft, weil die ganze Komponente
					neu entstand. Ohne Neuladen bliebe er den Abend über auf dem
					Traktandum stehen, das beim Laden aufgerufen war: Der Folgeantrag zu
					Traktandum 7 bekäme Traktandum 3 als Grundantrag vorgeschlagen,
					samt dessen Betroffenen-Vorschlag und Abweichungsvergleich. Ein
					Beschluss unter dem falschen Geschäft, womöglich mit dem falschen
					Quorum.
				-->
				{#key data.aktuelles?.id ?? ''}
					<TraktandumAufnehmen
						grundantraege={grundantraege.map((t) => ({
							id: t.id,
							nummer: t.nummer,
							titel: t.titel,
							erfordernisTyp: t.erfordernisTyp,
							einladungsmehr: t.einladungsmehr,
							betroffene: t.betroffeneIds
						}))}
						erfordernisse={data.erfordernisse}
						parteien={data.parteien}
						ausnahmeReglement={data.ausnahmeReglement}
						ausnahmeUniversal={data.ausnahmeUniversal}
						amAbend={Boolean(amAbend)}
						vorgewaehlt={vorgewaehlterGrundantrag}
					/>
				{/key}
			</details>

			<!--
				**Wer als Sitzungsleitung oder Verwaltung vertritt** (Migration 128;
				Runde 2, Stelle 9). Nur wo die Liste etwas bewirkt: Vollmachten zählen
				an der Universalversammlung, die der Leitung aber nicht. Änderbar
				während der Versammlung, weil Vollmachten auch in der Pause dazukommen.
			-->
			{#if !amAbend && data.universal && data.universal.vertreter.length > 0}
				<details class="vertreter">
					<summary>Vertreter der Sitzungsleitung oder Verwaltung</summary>
					<form method="POST" action="?/leitungsvertreter" use:enhance={absenden()}>
						<p class="klein">
							Kreuzen Sie an, wer hier für die Sitzungsleitung oder die Verwaltung Vollmachten
							hält. Dazu gehören auch Vollmachten, die jemandem persönlich erteilt wurden, der heute
							die Sitzung leitet. Nach der Einstellung Ihrer Gemeinschaft zählen diese Vollmachten
							bei einer Universalversammlung nicht mit. Kreuzen Sie vor dem ersten nicht
							angekündigten Geschäft an; die Liste bleibt änderbar.
						</p>
						{#each data.universal.vertreter as r (r.schluessel)}
							<label class="haken">
								<input type="checkbox" name="vertreter" value={r.schluessel} {...angekreuzt(r.angekreuzt)} />
								{r.name}{#if r.vertritt.length > 0}{' '}(vertritt {r.vertritt.join(', ')}){/if}
							</label>
						{/each}
						<button type="submit" class="leise">Festhalten</button>
					</form>
				</details>
			{/if}

			<!--
				**Das Wandbild auch hier.**

				Am Eingang wird die Begrüssung gebraucht, an der Sitzungsleitung der
				freie Text — «Weiter um 20:15» sagt man nicht am Eingang, sondern vom
				Rednerpult aus. Dieselbe Komponente an beiden Orten, damit die beiden
				Stellen nicht auseinanderlaufen.
			-->
			{#if !amAbend}
				<Wandbild
					art={v.wandbild?.art ?? 'traktanden'}
					text={v.wandbild?.text ?? null}
					aufgerufen={data.aktuelles ?? null}
				/>
			{:else if !abstimmungLaeuft}
				{@render notwegKasten()}
			{/if}
		</section>

		<!-- ── Rechts: das laufende Geschäft ────────────────────────────────── -->
		<section class="geschaeft">
			<h2>Aktuelles Geschäft</h2>

			<!--
				**Ob die Versammlung beschliessen darf** (Auftraggeber, 23.08.2026): «Beim
				Standardtraktandum Begrüssung und Feststellung der Beschlussfähigkeit
				fehlt in der Sicht ‹Aktuelles Geschäft› die Sicht, ob wir wirklich
				beschlussfähig sind.»

				Oben stand «5 von 5 anwesend» — eine Zahl, aus der jeder selbst
				schliessen musste. Beim Traktandum, das genau diese Feststellung zum
				Gegenstand hat, stand die Antwort nirgends.

				**Immer, nicht nur dort.** Die Beschlussfähigkeit ist die Voraussetzung
				JEDER Abstimmung, und sie ändert sich im Lauf des Abends: Wer um neun
				geht, nimmt seine Stimme mit. Sie nur beim ersten Traktandum zu zeigen
				hiesse, sie genau dann zu verstecken, wenn sie kippt.

				Dieselbe Funktion wie auf der Anwesenheitsseite und am Beamer — eine
				Rechnung, drei Anzeigen.
			-->
			{#if data.beschlussfaehigkeit && data.beschlussfaehigkeit.bedingungen.length > 0}
				<Beschlussfaehigkeitsanzeige
					bedingungen={data.beschlussfaehigkeit.bedingungen}
					beschlussfaehig={data.beschlussfaehigkeit.beschlussfaehig}
					fehlt={data.beschlussfaehigkeit.fehlt}
					titel="Beschlussfähigkeit"
				/>
				{#if data.einzigerEigentuemer}
					<p class="klein saalhinweis">{data.einzigerEigentuemer}</p>
				{/if}

				<!--
					**Festhalten, was jetzt gilt** (Auftraggeber, 24.08.2026: «Die
					Beschlussfähigkeit sollte einfach festgehalten werden können»).

					Der Balken darüber ist eine laufende Rechnung — er ändert sich, wenn
					jemand geht. Die Feststellung ist ein Befund zu einem Zeitpunkt, und
					sie bleibt stehen. Ohne sie rechnete das Protokoll die Zahlen beim
					Erzeugen neu, und der Beschluss von halb sieben hinge an der
					Anwesenheit von halb zehn.

					**Auch mehrfach.** Beschlussfähig ist die Versammlung nicht einmal,
					sondern für jeden Beschluss (ZGB Art. 712p). Nach der Pause ist der
					Stand ein anderer.
				-->
				<!--
					**Nur beim Traktandum, das sie zum Gegenstand hat** (Auftraggeber, 24.08.2026).
					Die Balken bleiben überall — sie sind die Voraussetzung jeder
					Abstimmung. Das Festhalten steht dort, wo es hingehört; wer nach der
					Pause erneut feststellen will, ruft das Traktandum wieder auf.
				-->
				{#if festhalten}
				<div class="festhalten">
					{#if letzteFeststellung}
						<!--
							Eine Zeile, keine Wiederholung der Balken: Die Zahlen stehen darüber.
							Hier zählt, WANN festgehalten wurde und was dabei herauskam.
						-->
						<p class="klein" class:warnung={!letzteFeststellung.beschlussfaehig}>
							Festgehalten {uhrzeit(letzteFeststellung.zeitpunkt)} —
							{letzteFeststellung.beschlussfaehig ? 'beschlussfähig' : 'nicht beschlussfähig'},
							<!--
								Die Zahl, auf der die Feststellung beruht — Personen (ZGB 712p).
								Vor dem 26.08.2026 wurde auf Kopfstimmen festgestellt; für solche
								Einträge steht die alte Zahl da, nicht eine erfundene neue.
							-->
							{#if letzteFeststellung.eigentuemerGesamt !== null}
								{letzteFeststellung.eigentuemerAnwesend} von {letzteFeststellung.eigentuemerGesamt}
								Stockwerkeigentümern
							{:else}
								{letzteFeststellung.kopfstimmenAnwesend} von {letzteFeststellung.kopfstimmenGesamt}
								Kopfstimmen
							{/if}{#if data.feststellungen.length > 1}{' '}({data.feststellungen.length}×){/if}
						</p>
					{/if}
					<form method="POST" action="?/festhalten" use:enhance={absenden()}>
						<button
							type="submit"
							class={letzteFeststellung ? 'leise' : 'haupt'}
							title="Hält Zahlen, Zeitpunkt und Ergebnis fest. Der Eintrag bleibt im Protokoll stehen, auch wenn nachher jemand geht."
						>
							{letzteFeststellung ? 'Erneut festhalten' : 'Beschlussfähigkeit festhalten'}
						</button>
					</form>

					<!--
						**Der Ausweg gehört an dieses Traktandum** (Vorgabe des Auftraggebers, 11.09.2026:
						«Traktandum 1 Beschlussfähigkeit braucht noch den Exit der Vertagung,
						wenn die Beschlussfähigkeit nicht gegeben ist»).

						Die Sitzungsleitung steht in diesem Augenblick hier: Sie hat eben
						festgestellt, dass zu wenige da sind, und der Saal sieht zu. Bis heute
						stand der einzige Weg auf der Anwesenheitsseite — ein Seitenwechsel
						vor Publikum, und zwar für die Entscheidung, die den Abend beendet.

						**Immer da, nicht nur wenn es fehlt** (Produktentscheid). Vertagt wird
						auch aus einem zweiten Grund: Die Versammlung kann es beschliessen.
						Die Maske fragt danach, weil der Grund ins Protokoll gehört. Die Stufe
						der Folgeversammlung hängt seit F4c nicht am Grund, sondern daran, ob
						die Versammlung heute beschlussfähig war (C3).

						**Zugeklappt**, aus demselben Grund wie am Eingang: «vertagen» soll
						kein Knopf sein, den man aus Versehen trifft. Steht die
						Beschlussfähigkeit nicht, wird der Ausklapper hervorgehoben — dann ist
						er die wahrscheinlichste nächste Handlung.

						**Der Weg am Eingang bleibt bestehen.** Dieser Block hängt daran, dass
						im Titel des Traktandums «beschlussfähig» steht; wer sein erstes
						Traktandum umbenennt, verlöre sonst den einzigen Ausweg.
					-->
					<!--
						**Nur an der ersten Versammlung** (aus dem Code-Review, 11.09.2026),
						wie am Eingang. Die zweite bekommt dasselbe Pflichttraktandum; dort
						sagt `vertageVersammlung` ab, und der Ausklapper wäre ein Weg, der
						hervorgehoben in eine Absage führt.
					-->
					{#if v.stufe === 'erste'}
					<details
						class="vertagen"
						class:dringend={data.beschlussfaehigkeit &&
							!data.beschlussfaehigkeit.beschlussfaehig}
					>
						<summary>{vertagenUeberschrift(data.zeitweiseBeschlussfaehig)}</summary>
						<form method="POST" action="?/vertagen" use:enhance={absenden()}>
							{#if data.zeitweiseBeschlussfaehig}
								<p class="klein">
									{vertagenNeueErsteSatz(
										datumLang(fruehesterZweitTermin(v.datum, data.gemeinschaft?.zweitversammlungsfristTage))
									)}
								</p>
							{:else}
								<p class="klein">
									Die Versammlung wird geschlossen, ohne dass beschlossen wurde — sie hat
									trotzdem stattgefunden. Die zweite entsteht sofort daneben, als Entwurf:
									gleiche Uhrzeit, gleicher Ort, Datum
									{datumLang(
										fruehesterZweitTermin(v.datum, data.gemeinschaft?.zweitversammlungsfristTage)
									)}. Alles davon lässt sich danach
									ändern.
								</p>
							{/if}
							<label>
								Warum vertagt wird
								<!--
									**`use:gefuehrteWahl`, nicht `bind:value`** (11.09.2026, vom
									Wächter gemeldet). `bind:value` schreibt beim Aufbau zurück und
									überschreibt damit, was vor der Hydration gewählt wurde — im Saal,
									auf einem fremden Gerät, ist genau das der Normalfall.
								-->
								<select name="grund" required use:gefuehrteWahl={(w) => (vertagungsgrund = w)}>
									<option value="">— wählen —</option>
									<option value="Nicht beschlussfähig (ZGB Art. 712p Abs. 2).">
										Nicht beschlussfähig
									</option>
									<option value="Die Versammlung hat die Vertagung beschlossen.">
										Die Versammlung hat es beschlossen
									</option>
								</select>
								<span class="hilfe">
									Zwei verschiedene Sachverhalte; der Grund steht im Protokoll. Ob danach
									eine zweite Versammlung nach Abs. 3 oder eine neue erste entsteht, richtet
									sich danach, ob die Versammlung heute beschlussfähig war.
								</span>
							</label>
							<!--
								**Mit Rückfrage** (aus dem Code-Review, 11.09.2026). Ein Klick
								schliesst die Versammlung unwiderruflich und legt die Folgeversammlung an;
								die schwächere Nachbarhandlung «Versammlung schliessen» fragt
								nach. Der zugeklappte Ausklapper schützt vor dem Finden, nicht vor
								dem Klick.

								**Gesperrt, solange kein Grund gewählt ist.** `Rueckfrage` fängt
								den Klick ab und öffnet das Fenster — die Pflichtprüfung des
								Browsers käme erst danach, beim Absenden, und der Bestätigende
								stünde vor einem Fenster, dessen Bestätigung nichts tut.
							-->
							<Rueckfrage
								beschriftung="Vertagen"
								ton="warnung"
								gesperrt={!vertagungsgrund}
								marke="vertagen:{v.id}"
								frage="Versammlung vertagen?"
								folge={data.zeitweiseBeschlussfaehig
									? 'Sie wird geschlossen und lässt sich nicht wieder eröffnen; was beschlossen ist, bleibt gültig. Die neue erste entsteht daneben als Entwurf.'
									: 'Sie wird geschlossen, ohne dass beschlossen wurde, und lässt sich nicht wieder eröffnen. Die zweite entsteht daneben als Entwurf.'}
								bestaetigen="Jetzt vertagen"
							/>
						</form>
					</details>
					{/if}
				</div>
				{/if}
			{/if}

			{#if !data.aktuelles}
				<p class="leer">
					Rufen Sie ein Traktandum auf. Was hier steht, zeigen Beamer und Telefone.
				</p>
			{:else}
				<!--
					**Abgesetzt, wo die Beschlussfähigkeit darüber steht** (UI-Durchgang
					06.10.2026). Der Kopf des Geschäfts klebte mit 0 px und ohne Linie an
					ihrem Block und las sich wie dessen letzte Zeile.
				-->
				<p
					class="nummer"
					class:abgesetzt={data.beschlussfaehigkeit &&
						data.beschlussfaehigkeit.bedingungen.length > 0}
				>
					Traktandum {data.aktuelles.nummer}
					<!--
						**Der Badge mit dem Quorumstyp** (Rückfrage 03.10.2026):
						Am aufgerufenen Geschäft stand nur die Nummer, und welches
						Mehr gilt, war erst weiter unten in der Vorschau zu sehen.
						Der Badge nennt es gleich beim Titel; er kommt aus der
						Fassung des Erfordernisses.
					-->
					{#if data.aktuelles.erfordernisBezeichnung && !konsultativOffenHier}
						<span class="marke">{data.aktuelles.erfordernisBezeichnung}</span>
					{/if}
				</p>
				<h3>{data.aktuelles.titel}</h3>

				<!--
					**Der Arbeitsblock steht hier, nicht in der Ablaufspalte**
					(Bedienbarkeitsprüfung 05.09.2026, Befund 10 der Bewirtschaftersicht):
					«Ausstand, Gegenantrag und Zurückziehen stehen links im Ablaufkasten,
					während rechts ‹Aktuelles Geschäft› steht. Der Prüfer suchte zuerst
					rechts.»

					Hier steht der Name des Geschäfts, also sucht man hier auch, was man
					damit tun kann. Die Abendsicht (`tage/[id=kennung]/leitung`) ordnet es
					seit dem 24.08.2026 so an. Bis zum 07.09.2026 wichen die beiden
					Sichten hier voneinander ab, und ein Wegweiser rechts zeigte nach
					links; er ist mit dem Umzug weggefallen.

					**Die Reihenfolge ist die der Abendsicht:** Nummer, Titel, Wortlaut,
					Nutzniessung, Votum, «Jetzt möglich», dann der Zustand (Kenntnisnahme,
					laufende Abstimmung, Rückkommensweg). Wer zwischen den Sichten
					wechselt, sucht sonst zweimal.

					**Eines fehlte in dieser Aufzählung** und ist am 08.09.2026
					nachgezogen: die Zulässigkeitsprüfung (`Antragspruefung`). Sie stand
					in dieser Sicht an der Zeile in der Traktandenliste, je Traktandum
					zweimal (Knopf in der Handlungszeile, Antwort darunter); jetzt steht
					sie einmal hier, zwischen Wortlaut und Nutzniessung, wie am Abend.

					**Was der Umzug kostet, gemessen am 07.09.2026 bei 1440 px:** Der
					Geschäftskasten war 483 px hoch, die Ablaufspalte daneben 2483. Nach
					dem Umzug sind es 569 gegen 2271, also 86 px mehr auf der rechten
					Seite. Weniger, als der Augenschein links vermuten liess: «Jetzt
					möglich» brach in der 417 px schmalen Ablaufkarte auf zwei Zeilen um
					und steht rechts auf einer. Im Drehbuch, an einem Traktandum mit
					Antragswortlaut, misst der Kasten 641 px und bleibt bei 1440×900 ganz
					sichtbar. Nachgewiesen in `durchspielen.mjs`, Schritt «Traktandum
					aufrufen» und «‹Jetzt möglich› steht in der Spalte des aktuellen
					Geschäfts» — über die Namen, nicht über die Nummern: Die verschieben
					sich, sobald irgendwo davor ein Schritt dazukommt.

					Der Kasten klebt weiter (`.raster:not(.eingeengt) .geschaeft`); ist er
					einmal höher als das Fenster, klebt er nur noch, bis er durchgelaufen
					ist. Kurz war diese Spalte ohnehin nur am Anfang einer Versammlung:
					Unten hängt sich jedes geschlossene Ergebnis an.

					Produktentscheid 07.09.2026, nach dem Vergleich beider Sichten
					nebeneinander: «Rechts ist gut.» Er hebt damit den Teil des Entscheids
					vom 01.09.2026 auf, der diese Spalte kurz halten wollte; dass sie
					klebt, bleibt.
				-->

				{#if data.aktuelles.antragswortlaut}
					<blockquote>{data.aktuelles.antragswortlaut}</blockquote>
				{/if}

				<!--
					**Die nötige Mehrheit steht beim Antrag** (Auftrag 03.10.2026):
					Zwischen Antragstext und Voten-Feld, damit die Sitzungsleitung
					sie vor der Diskussion sieht und nicht erst unten beim
					Freigeben. Zahlen und Regel stehen zusammen; die Zahlen ändern
					sich mit jedem Nachzügler und werden bei jedem Laden neu
					gerechnet. Ohne Zahlen (Grenzfall, kein Erfordernis) bleibt es
					beim Hinweis unten beim Freigeben.
				-->
				<!--
					Nicht während einer konsultativen Abstimmung (Befund 8): Gegen die
					Schwelle wird dann nichts entschieden, und «nötig 2» neben dem
					offenen Durchgang las sich wie das Ziel der Abstimmung.
				-->
				{#if (data.vorschau?.kopf || data.vorschau?.quoten) && !konsultativOffenHier}
					<p class="noetig">{data.vorschau.satz}</p>
					<!--
						**Ohne das Präfix mit der Bezeichnung** (Produktentscheid
						08.10.2026): Die Marke oben trägt die Bezeichnung jetzt mit
						der Bezugsgrösse; hier stünde sie doppelt.
					-->
					<p class="klein leise">
						{data.vorschau.regelInWorten} · {data.aktuelles.erfordernis}
					</p>
				{/if}

				<!--
					**Die Zulässigkeitsprüfung des Folgeantrags** (FR-60), seit dem
					08.09.2026 hier statt in der Traktandenliste.

					Sie stand je Traktandum zweimal in der Liste: der Knopf in der
					Handlungszeile, die Antwort als Block darunter. Zwei Anker für eine
					Maske, und beide an einer anderen Stelle als am gemeinsamen Abend,
					wo sie seit dem 24.08.2026 beim aufgerufenen Schritt hängt. Wer
					zwischen den Sichten wechselt, suchte sie zweimal.

					**Das kostet einen Weg, und der sei benannt:** Bisher liess sich
					jeder Folgeantrag der Liste prüfen, auch ein nicht aufgerufener.
					Jetzt zuerst aufrufen, dann prüfen. Das ist der Ablauf des Abends,
					und es ist derselbe Augenblick, den die Prüfung meint: der zwischen
					«jemand stellt einen Antrag» und «wir stimmen ab».

					**Bei laufender Abstimmung nur noch die Antwort** (Code-Review
					08.09.2026). In der Liste verschwand beides mit ihr:
					`.raster.eingeengt .ablauf` wird im Saal-Modus ausgeblendet. Im
					Geschäftskasten bliebe der Knopf stehen, und dann liesse sich mitten
					im Zählen ein Modellaufruf auslösen, dessen Antwort die
					Stimmerfassung nach unten schiebt. Der Knopf tritt deshalb zurück
					wie Nutzniessung und Votum darunter; eine schon geholte Antwort
					bleibt stehen, denn wer gefragt hat, soll sie lesen können.
				-->
				{#if data.aktuelles.spontan && data.aktuelles.spontanart === 'folgeantrag' && data.aktuelles.hatGrundantrag}
					{#if data.ki.verfuegbar && data.ki.anzeigen}
						<Antragspruefung
							traktandumId={data.aktuelles.id}
							moeglich={!abstimmungLaeuft}
							pruefung={form?.antragspruefung ?? null}
							ausnahmeReglement={data.ausnahmeReglement}
							universalZugelassen={data.ausnahmeUniversal !== null && data.ausnahmeUniversal.variante !== 'keine'}
						/>
					{:else if data.ki.anzeigen}
						<p class="klein">{data.ki.grund}</p>
					{/if}
				{/if}

				<!--
					**Wer bei Nutzniessung stimmt** (FR-22). Steht beim aufgerufenen
					Traktandum, weil sich die Frage dort stellt — und mit Begründung,
					damit eine Bestreitung im Saal sofort zu klären ist.
				-->
				<!--
					**Im Saal-Modus treten diese beiden zurück** (Code-Review
					07.09.2026). Bis zum Umzug lagen Nutzniessung und Votum in der
					linken Spalte und verschwanden mit ihr, sobald eine Abstimmung
					offen ist (`.raster.eingeengt .ablauf { display: none }`). In der
					rechten Spalte blieben sie stehen und schöben die Stimmerfassung
					mit ihren grossen Zielen nach unten — auf 900 px Fensterhöhe unter
					die Falz.

					`Eingriffe` bleibt: Der Kasten trägt dann den Grund, warum nichts
					mehr geht, und genau dessen Fehlen war Befund C-02 vom 22.08.2026.
				-->
				{#if !abstimmungLaeuft && data.nutzniessungen.length > 0}
					<ul class="nutzniessung">
						{#each data.nutzniessungen as n (n.einheit)}
							<li class:vonHand={n.vonHand}>
								<strong>{n.einheit}</strong> ({n.partei}): {n.satz.replaceAll('**', '')}
							</li>
						{/each}
					</ul>
				{/if}

				<!--
					**Das Votum gehört hierher**, nicht nur auf die Protokollseite:
					Geschrieben wird, während gesprochen wird. Wer dafür die Seite
					wechseln muss, schreibt es nachher aus dem Gedächtnis — und das ist
					der Unterschied zwischen einem Protokoll und einer Erinnerung.

					Bestätigt am 12.08.2026: «Wichtig ist, dass diese Voten beim
					Präsentieren pro aktivem Traktandum geschrieben werden kann. Die
					Ansicht im Protokoll fasst alle zusammen zum Redigieren.» Genau so
					ist es gebaut — hier je aufgerufenem Punkt, dort alle untereinander.
				-->
				<!--
					**`{#key}` auf das aufgerufene Geschäft** (28.08.2026). `Votum`
					reicht an `SicherndesFeld` weiter, und das friert seinen
					Sicherungsschlüssel und den zuletzt gesicherten Text mit
					`untrack()` beim Aufbau ein. Solange «Aufrufen» die Seite neu
					lud, war das richtig; seit es über `absenden()` schickt, überlebt
					der Baustein den Wechsel — und schriebe das Votum zum **neuen**
					Traktandum unter den Merker des alten, mit einem 409 beim
					Sichern. Der Schlüssel baut ihn neu, wie es das Neuladen tat.
				-->
				{#if !abstimmungLaeuft}
					{#key data.aktuelles.id}
						<Votum
							versammlungId={v.id}
							traktandumId={data.aktuelles.id}
							wert={data.notiz}
						/>
					{/key}
				{/if}

				<!--
					**Was jetzt geht** — die Eingriffe an einem Ort, in Laiensprache.

					Vorher standen sie an vier Stellen, alle zugeklappt, alle mit einem
					Fachwort beschriftet: der Ausstand hier, Zurückziehen und
					Rückkommen an der Zeile in der Traktandenliste, der Folgeantrag
					unter «Traktandum aufnehmen» ganz unten. Wer sie kannte, fand sie;
					wer sie nicht kannte, erfuhr nirgends, dass es sie gibt.

					Gemeldet am 13.08.2026: «Immer den Fokus des Nutzers ohne
					Programmkenntnisse und Stress durch die Sitzungsleitung im
					Hinterkopf behalten. Einfach verständlich, intuitiv und sichtbar
					(nicht dominant).»

					Welche möglich sind, rechnet der Kern (`domain/eingriffe.ts`) —
					dieselbe Frage, die der Server beim Abschicken stellt. Nichts steht
					ausgegraut da: Ein Eintrag, den man nicht drücken kann, ist eine
					Frage ohne Antwort.
				-->
				<!--
					**Der Stand steht immer da, nicht hinter einem Klick.**

					Gefunden im Durchlauf vom 13.08.2026: Der Ausstand und die dadurch
					ruhenden Vollmachten standen im aufgeklappten Feld — und das klappt
					nach dem Erklären zu. Die Sitzungsleitung hätte das Ergebnis
					verkündet, ohne die Folge je gesehen zu haben. Genau der Fehler, den
					die ganze Anzeige verhindern soll.

					Ein Stand ist etwas anderes als ein Angebot: Er sagt, wie es **ist**,
					und gehört deshalb neben die Zeile, nicht hinein.
				-->
				<!-- Die Erinnerung an den Ausstand am Grundantrag steht seit dem
				     26.09.2026 im Baustein `Eingriffe`, damit der Abend sie auch zeigt. -->

				<!--
					Auch ohne Ausstand, seit 25.09.2026: Bei der Ermächtigung zur
					Ausschlussklage ruhen die Vollmachten des Beklagten
					(ZGB Art. 649b Abs. 2; BGE 134 III 481 E. 3.8), ohne dass jemand
					in den Ausstand tritt. Seit 27.09.2026 nicht mehr bei Betroffenen,
					die nur eine Reglementsklausel aus der Kopfbasis nimmt.
				-->
				{#if data.ausstand.length > 0 || data.ruhendeVollmachten.length > 0}
					<div class="ausstandsstand">
						{#if data.ausstand.length > 0}
						<!--
							**Eine Überschrift für den Stand** (Praxisfund 03.10.2026):
							Die Zeile «… entscheidet hier nicht mit — <Grund>» stand ohne
							Titel da, und wer den Grund las («ihr Anteil wird
							entschädigt»), wusste nicht, worum es geht. Die Marke sagt
							es, und der Abstand oben trennt den Stand von der Zeile
							darüber.
						-->
						<p class="standtitel">
							<span class="marke warnung">Ausstand</span>
							Diese Personen entscheiden bei diesem Traktandum nicht mit:
						</p>
						<ul class="ausstandsliste">
							{#each data.ausstand as a (a.id)}
								<li>
									<span>
										<!-- G7 (06.11.2026): Der Ausstand aus L8 trägt keine Begründung,
										     der Zusatz hinter dem Namen sagt, woher er kommt. -->
										<strong>{a.name}</strong>{#if a.grund}: {a.grund}{/if}
									</span>
									<!--
										**Kein Knopf, der nur scheitern kann** (Code-Review
										07.09.2026). Solange ein Durchgang offen ist, weist
										`nimmAusstandZurueck` die Rücknahme ab: Sie liesse die
										Bezugsgrösse unter den bereits abgegebenen Stimmen
										wachsen.

										Bis zum Umzug des Arbeitsblocks stand dieser Knopf in der
										linken Spalte, und die blendet der Saal-Modus bei offener
										Abstimmung aus. Das sah wie eine Sperre aus und war eine
										Anzeige; die Sperre steht jetzt am Server, und hier steht
										der Knopf nur, wenn er auch trägt.

										`jetztlage.durchgangOffen` und nicht `abstimmungLaeuft`:
										Die Bedingung muss dieselbe sein, die der Server prüft.
										`abstimmungLaeuft` steuert den Saal-Modus und fragt nach
										irgendeiner offenen Abstimmung in der Versammlung; hier
										zählt der Durchgang zu diesem Traktandum.
									-->
									<!-- Der Knopf nur für erklärte Ausstände: Der aus L8 lässt sich
								    	     nicht zurücknehmen, sondern nur über die Einstellung der
								    	     Gemeinschaft ändern (G7, 06.11.2026). -->
									{#if !jetztlage.durchgangOffen && !a.ausEinstellung}
										<form method="POST" action="?/ausstandZurueck" use:enhance={absenden()}>
											<input type="hidden" name="ausstand" value={a.id} />
											<button type="submit" class="leise" data-fokus="ausstand:{a.id}">Zurücknehmen</button>
										</form>
									{/if}
								</li>
							{/each}
						</ul>
						{/if}
						{#if data.ruhendeVollmachten.length > 0}
							<p class="ruhend">
								<strong>Diese Vollmachten ruhen bei diesem Traktandum:</strong>
								{#each data.ruhendeVollmachten as r, i (r.parteiId)}{i > 0
										? ', '
										: ' '}{r.name} (vertreten durch {r.ueber ??
										'eine ausgeschlossene Person'}{r.wegen === 'betroffen' &&
									data.aktuelles?.betroffenenlage.beklagt === false
										? `; ${r.ueber ?? 'diese Person'} stimmt hier nicht mit, die Vollmacht ruht`
										: r.wegen === 'betroffen'
											? ', als Beklagter ausgeschlossen'
											: ', im Ausstand'}){/each}.
								<!-- An der Einsprache ein Satz über die Zählung, nicht über das Recht
								     (Laien- und Fachprüfung Runde 1, 19.10.2026). -->
								{data.aktuelles?.betroffenenlage.beklagt === false &&
								data.ruhendeVollmachten.some((r) => r.wegen === 'betroffen')
									? 'Votum zählt hier keine Vollmachten von Personen, die im Ausstand sind oder bei der Einsprache nicht mitstimmen. Diese Parteien'
									: 'Wer vom Stimmrecht ausgeschlossen ist, kann auch niemanden vertreten — diese Parteien'} können bei
									<em>diesem</em> Traktandum keine Stimme abgeben. {data.aktuelles?.betroffenenlage
									.beklagt === false && data.ruhendeVollmachten.some((r) => r.wegen === 'betroffen')
									? 'Beim nächsten Traktandum gilt die Vollmacht wieder.'
									: 'Beim nächsten übt dieselbe Vollmacht wieder aus.'}
							</p>
						{/if}
					</div>
				{/if}

				<!--
					**Wer betroffen ist, steht immer da** (Code-Review 25.09.2026 zu A2b,
					Befund 8), wie der Ausstand darüber: auch während der Abstimmung, wenn
					das Feld unter «Jetzt möglich» fehlt. Gerade dann will die Leitung
					sehen, wessen Zustimmung zählt und wer vorab zugestimmt hat.
				-->
				{#if data.betroffene.length > 0}
					<p class="klein saalhinweis">
						Unmittelbar betroffen:
						{#each data.betroffene as b, i (b.parteiId)}{i > 0 ? ', ' : ''}<strong>{b.name}</strong
							>{#if b.vorab}{' '}(vorab zugestimmt: {b.vorab.vermerk}){/if}{/each}.
					</p>
					<!-- Der Hinweis «betroffen und im Ausstand» steht seit dem 26.09.2026
					     im Baustein `Eingriffe`, damit der Abend ihn auch zeigt. -->
				{:else if data.aktuelles.betroffenenlage.form && !abstimmungLaeuft}
					<!--
						**Das Erfordernis verlangt Zustimmung, eingetragen ist
						niemand** (Praxisfund 03.10.2026): Die Sitzungsleitung soll
						das beim Traktandum sehen und nicht erst im Notweg oder
						beim Auszählen. Die Zustimmung lässt sich vorab schriftlich
						vermerken oder im Saal erteilen; eingetragen wird, wer
						betroffen ist, unter «Jetzt möglich».
					-->
					<Meldung ton="warnung" marke={'betroffene-leer:' + data.aktuelles.id}>
						Dieses Erfordernis verlangt die Zustimmung der unmittelbar Betroffenen;
						eingetragen ist niemand. Erfassen Sie unter «Jetzt möglich» bei «Betroffene»,
						wer betroffen ist.
						{#if data.aktuelles.betroffenenlage.form === 'im_saal_oder_vorab'}
							Die Zustimmung kann vorab schriftlich vermerkt oder im Saal erteilt werden.
						{:else}
							Die Zustimmung folgt mit der öffentlichen Abänderungsurkunde.
						{/if}
					</Meldung>
				{/if}

				<!--
					**Ein Baustein für beide Sichten** (24.08.2026). Am gemeinsamen
					Abend ist ein Schritt genau ein Traktandum in genau einem Haus —
					dieselbe Lage, dieselben Eingriffe. Nachgebaut liefen sie
					auseinander.
				-->
				<!--
					**Auch hier `{#key}`** — aus demselben Grund. `Eingriffe` merkt
					sich, welcher Kasten aufgeklappt ist und welche Parteien im
					Ausstandsformular angekreuzt sind. Ohne den Schlüssel bliebe der
					Kasten über den Geschäftswechsel hinweg offen, mit der Auswahl
					vom vorigen Traktandum — während das verborgene Feld darin schon
					auf das neue zeigt. Ein Klick auf «Ausstand erklären» träfe dann
					das falsche Geschäft, und im Saal sieht das niemand.
				-->
				{#key data.aktuelles.id}
					<Eingriffe
						traktandumId={data.aktuelles.id}
						amAbend={Boolean(amAbend)}
						lage={jetztlage}
						parteien={data.parteien}
						vertreterOhnePartei={data.vertreterOhnePartei}
						ausstand={data.ausstand}
						betroffene={data.betroffene}
						betroffenenform={data.aktuelles.betroffenenlage.form}
						kenntBetroffene={data.aktuelles.betroffenenlage.kennt}
						beklagtenumfangWirkt={data.aktuelles.betroffenenlage.beklagtenumfang}
						angehoerigenhinweis={data.aktuelles.angehoerigenhinweis}
						angehoerigenlesartHinweis={data.aktuelles.angehoerigenlesartHinweis}
						milderungshinweis={data.aktuelles.milderungshinweis}
						folgeantragHinweis={data.aktuelles.folgeantragHinweis}
						betroffenenabweichung={data.betroffenenabweichung}
						ausstandAmGrundantrag={data.ausstandAmGrundantrag}
						vetoStand={data.vetoStand}
						erfordernisTitel={data.aktuelles.erfordernis ?? ''}
						erfordernisPfad="/versammlungen/{v.id}/traktanden/{data.aktuelles
							.id}/erfordernis?zurueck=/versammlungen/{v.id}/leitung"
						grundantraege={grundantraege.map((t) => ({
							id: t.id,
							nummer: t.nummer,
							titel: t.titel,
							erfordernisTyp: t.erfordernisTyp,
							einladungsmehr: t.einladungsmehr,
							betroffene: t.betroffeneIds
						}))}
						erfordernisse={data.erfordernisse}
						angenommen={(data.ergebnisse.find((x) => x.traktandumId === data.aktuelles?.id)
							?.auszaehlung?.angenommen ?? data.aktuelles.sacheAngenommen) === true}
						rueckzugHindernis={hindernisFuerRueckzug(
							offeneFolgeantraege(antragsliste, data.aktuelles.id)
						)?.meldung ?? null}
					/>
				{/key}

				<!--
					**Die Pendenz steht unter «Jetzt möglich»** (Auftrag 03.10.2026):
					Erst wird festgehalten, was gesagt wurde, dann was jetzt zu tun ist
					(Ausstand, Betroffene und die übrigen Eingriffe), und darunter die
					Zusage. Die Reihenfolge Votum, Eingriffe, Pendenzen gilt in dieser
					Sicht; der Abend führt Votum und Eingriffe in derselben Folge.

					**Derselbe `{#key}` wie beim Votum darüber**, aus verwandtem Grund
					(Code-Review 09.09.2026): Die Komponente führt einen halb getippten
					Wortlaut im Feld und die gewählte Fristart im Zustand. Seit
					«Aufrufen» über `absenden()` schickt, überlebt sie den Wechsel des
					Traktandums — das versteckte Kennungsfeld springt um, der getippte
					Satz bleibt stehen, und der nächste Klick hängte die Zusage unter
					den falschen Punkt.
				-->
				{#if !abstimmungLaeuft}
					{#key data.aktuelles.id}
						<Pendenzen
							traktandumId={data.aktuelles.id}
							pendenzen={data.pendenzen}
							beschlusstext={jetztergebnis?.beschlusstext ?? null}
						/>
					{/key}
				{/if}

				<!--
					**Die Rüge steht auch bei laufender Abstimmung da** (Ä-06): Sie
					gehört vor die Abstimmung, und erfasst wird oft genau dann, wenn
					sie schon offen ist. `{#key}` aus demselben Grund wie bei den
					Pendenzen: Ein halb getippter Wortlaut soll nicht unter das
					nächste Traktandum rutschen.
				-->
				{#key data.aktuelles.id}
					<Ruegen traktandumId={data.aktuelles.id} ruegen={data.ruegen} />
				{/key}

				<!--
					**Der Beschluss von Hand** (Plan 30.09.2026, Block 2). Unter
					«Jetzt möglich» und nur, wo die Seite die Lage mitgibt: bei
					laufender Versammlung. Am gemeinsamen Abend steht sie im
					Notweg-Kasten oben (Block 2b), damit es sie je Lage genau
					einmal gibt. Auch bei offener Abstimmung, denn genau dann
					braucht die Leitung den Weg, wenn sich der Durchgang nicht
					schliessen lässt. Das gilt hier, ohne Abend; am Abend wandert
					der Notweg-Kasten bei offener Abstimmung ans Ende des
					Geschäftskastens (B1, 03.10.2026, `notwegKasten`).
				-->
				{#if data.vonHand && !amAbend}
					{#key data.aktuelles.id}
						<BeschlussVonHand
							traktandumId={data.aktuelles.id}
							lage={data.vonHand}
							mehr={mehrFuerVonHand}
					einwand={data.vonHand?.moeglich ? data.vonHand.einwand : null}
						/>
					{/key}
				{/if}

				{#if data.aktuelles.art === 'kenntnisnahme'}
					<p class="klein">
						Kenntnisnahme — hier wird nicht abgestimmt. Wortmeldungen und Vorbehalte gehören ins
						Protokoll.
					</p>
				{:else if data.offen && data.offen.traktandumId === data.aktuelles.id}
					<!-- ── Offene Abstimmung ────────────────────────────────────── -->
					<div class="offen">
						<h4>Abstimmung läuft{#if data.offen.nummer > 1}{' '}· {data.offen.nummer}. Durchgang{/if}</h4>
						{#if data.offen.geheim}
							<!-- Die geheime Abstimmung ist beim Eröffnen angesagt worden; hier
							     steht sie, solange die Abstimmung läuft (Migration 141). -->
							<p class="klein geheim">
								Geheime Abstimmung: Anzeigen, Auswertung und Protokoll nennen danach nur
								«erreicht» oder «nicht erreicht».
							</p>
						{/if}
						{#if data.offen.konsultativ}
							<!-- Migration 158: konsultativ eröffnet, solange die Abstimmung läuft. -->
							<p class="klein konsultativ">{data.offen.konsultativSatz}</p>
						{/if}
						<p class="fortschritt">
							{#if fortschritt}
								<strong>{fortschritt.abgegeben}</strong> von {fortschritt.stimmberechtigt} haben
								abgestimmt
							{:else}
								{data.offen.fortschrittSatz}
							{/if}
						</p>
						<!--
							**Wer noch fehlt, mit Namen** (Bedienbarkeitsprüfung 05.09.2026,
							vierter der schweren Befunde der Bewirtschaftersicht): «‹0 von 5
							haben abgestimmt›, aber nirgends die Namen. Im Saal ruft man Namen
							auf, nicht Zahlen.»

							Die Namen stehen im eingefrorenen Stand und damit in derselben
							Fassung wie auf der Anwesenheitsliste. Es ist keine Aussage über
							den Inhalt einer Stimme, sondern über ihr Ausbleiben.
						-->
						{#if offeneNamen.length > 0}
							<p class="offeneNamen">
								Es fehlen: {offeneNamen.join(', ')}
							</p>
						{/if}
						<p class="klein">
							<!--
								**Der Satz sagte mehr, als er halten konnte** (berichtigt am
								20.08.2026). «Wie abgestimmt wurde, ist bis zum Schliessen nicht
								sichtbar — auch nicht hier» stand über einer Erfassungstabelle,
								die drei Zeilen weiter unten genau das zeigte. Was wirklich gilt:
								Die **Verteilung** wird nicht gerechnet und nicht angezeigt; die
								einzelne Eintragung steht da, weil sich sonst nichts berichtigen
								liesse.
							-->
							Wie viele dafür oder dagegen sind, rechnet die Anwendung erst beim
							Schliessen — sonst liesse sich der Zeitpunkt nach dem Zwischenstand
							wählen. Was einzeln eingetragen wurde, sehen Sie in der Erfassung
							darunter.
						</p>

						<!--
							**Ein Baustein für beide Sichten** (24.08.2026). Stellvertretend
							stimmen, alle Stimmen von Hand und die Erfassungstabelle standen hier
							ausgeschrieben — am Abend fehlten sie deshalb ganz («Auch kann ich
							keine Voten hinschreiben», «Mir fehlt, dass der Versammlungsleiter für
							die anderen abstimmen darf»). Jetzt trägt `Stimmerfassung` beides.
						-->
						{#if data.erfassung}
							<!--
								`offen`: siehe `Stimmerfassung.svelte` — in der einfachen
								Betriebsart ist die Tabelle der Normalweg und steht auf.

								**`{#key}` auf den Durchgang.** Ein angekreuztes Feld der
								Tabelle ist danach «schmutzig», und ein schmutziges Feld sieht
								`defaultChecked` nicht mehr an — `angekreuzt()` bekäme es
								nicht zurück. Überlebt die Komponente einen Durchgangswechsel,
								trägt «Stimmen erfassen» ein Kreuz aus dem vorigen Durchgang
								ein, lautlos.

								Über die Formulare dieser Seite geschieht das nicht: Jeder Weg
								führt über einen Zustand, in dem `data.offen` null ist oder auf
								ein anderes Traktandum zeigt, und der `{:else if}` oben
								zerstört die Komponente dabei. **Über den Ereignisstrom schon**
								(28.08.2026 im Review gefunden): Führt am gemeinsamen Abend ein
								zweites Gerät, kann `data.offen` beim Nachziehen in einem Zug
								von Durchgang A auf B springen. Dann bleibt der Zweig wahr, und
								nur dieser Schlüssel baut die Tabelle neu.
							-->
							{#key data.offen.id}
								<Stimmerfassung
									erfassung={data.erfassung}
									betriebsart={data.versammlung.betriebsart}
									sperren={data.erfassungssperren}
									summenhindernis={data.summenhindernis}
									summenvermerk={data.summenvermerk}
									handzaehlung={data.handzaehlung}
									einspracheZaehlung={data.einspracheZaehlung}
									offen
								/>
							{/key}
						{/if}

						<!--
							**Warum der Ablauf jetzt fehlt** (22.08.2026, Befund C-02 des
							Prüflaufs). Sobald eine Abstimmung offen ist, blendet der Saal-Modus
							die linke Spalte aus — Ablauf, Traktandenliste, Wandsteuerung. Das
							ist Absicht: Während abgestimmt wird, gehört die Aufmerksamkeit der
							Abstimmung.

							Im Prüflauf suchte die Sitzungsleitung genau dann den Ausstand und
							fand nichts. Fachlich ist die Sperre richtig — ein Ausstand muss
							VOR der Abstimmung erklärt werden, sonst hat womöglich schon jemand
							gestimmt, der nicht durfte. Falsch war nur, dass die Seite dazu
							schwieg und wie ein Fehler aussah.

							**«Jetzt möglich» zählt seit dem 07.09.2026 nicht mehr dazu.** Der
							Kasten steht in dieser Spalte und bleibt sichtbar; leer ist er, weil
							`moeglicheEingriffe` bei offenem Durchgang nichts zurückgibt, und
							`eingriffssatz` sagt warum. Wer diesen Absatz für die Sperre hält,
							irrt: Die Sperre steht am Server (`ausstand.ts`, `abstimmung.ts`).

							Nutzniessung und Votum treten weiterhin zurück — nicht mehr über
							die ausgeblendete Spalte, sondern über `!abstimmungLaeuft` an ihrer
							neuen Stelle.
						-->
						<!--
							**Nicht zweimal dasselbe** (Code-Review 07.09.2026). Der Kasten
							«Jetzt möglich» steht seit dem Umzug in derselben Spalte und sagt
							über `eingriffssatz` bereits, dass während der Abstimmung nichts
							geht. Dieser Absatz sagt, was er nicht sagt: dass der Ablauf
							ausgeblendet ist und wie man wieder hinkommt.
						-->
						<p class="klein saalhinweis">
							Der Ablauf ist ausgeblendet, solange abgestimmt wird. Für das Erfordernis
							oder den Wortlaut schliessen Sie die Abstimmung zuerst; danach steht der
							ganze Ablauf wieder da.
						</p>

						{#if !amAbend && data.offen?.universal && data.universal}
							<!--
								**Widerspruch nach dem Eröffnen** (Migration 128; Runde 2, Stelle 8).
								Getrennt von der Nein-Stimme (Laienprüfung L21, hoch). Die Auswahl
								führt nur Parteien, die im Moment da sind: Ein Gast oder Mieter
								kann nicht widersprechen (Fachprüfung Runde 2, Stelle 8).
							-->
							<section class="widerspruch">
								{#if data.offen.universal.widerspruch}
									<p class="meldung warnung">
										{data.offen.universal.widerspruch} hat widersprochen. Aus dieser
										Abstimmung entsteht kein Beschluss; schliessen Sie sie wie gewohnt.
									</p>
								{:else}
									<p class="klein">{WIDERSPRUCH_ERKLAERUNG}</p>
									<form method="POST" action="?/widerspruch" use:enhance={absenden()}>
										<label>
											Wer widerspricht
											<Suchauswahl
												name="partei"
												beschriftung="Wer widerspricht"
												leerText="— wählen —"
												pflicht
												bind:wert={widersprechende}
												eintraege={data.universal.anwesende.map((p) => ({ wert: p.id, text: p.name }))}
											/>
										</label>
										<Rueckfrage
											beschriftung="Widerspruch festhalten"
											ton="warnung"
											frage={`Widerspruch von ${data.universal.anwesende.find((p) => p.id === widersprechende)?.name ?? 'der gewählten Partei'} festhalten?`}
											folge={WIDERSPRUCH_FOLGE}
											bestaetigen="Festhalten"
										/>
									</form>
								{/if}
							</section>
						{/if}

						{#if !amAbend}
						<form method="POST" action="?/schliessen" use:enhance={absenden()}>
							{#if schlussfolge}
								<Rueckfrage
									beschriftung="Abstimmung schliessen"
									gewicht="haupt"
									ton="warnung"
									frage="Abstimmung schliessen?"
									folge={schlussfolge}
									bestaetigen="Trotzdem schliessen"
								/>
							{:else}
								<!--
									**Alle haben gestimmt — dann führt dieser Knopf** (21.08.2026).

									Vorher war es umgekehrt: Solange Stimmen fehlten, stand hier ein
									hervorgehobener Knopf mit Rückfrage; sobald alle gestimmt hatten,
									ein unscheinbarer. Genau dann ist der Durchgang aber fertig, und
									der Weg weiter ist dieser eine. Eine Rückfrage braucht es dabei
									nicht: Es gibt nichts zu bedenken.
								-->
								<p class="vollzaehlig">
									{#if fortschritt}Alle {fortschritt.stimmberechtigt} haben abgestimmt.{/if}
								</p>
								<button type="submit" class="haupt">Abstimmung schliessen</button>
							{/if}
						</form>
						<AbstimmungAbbrechen />
						{/if}
					</div>
				{:else if !data.aktuelles.hatErfordernis}
					<p class="meldung warnung">
						Für dieses Traktandum steht kein Mehrheitserfordernis fest. Ohne eines liesse sich
						hinterher nicht sagen, ob der Antrag angenommen ist.
						<a
							href="/versammlungen/{v.id}/traktanden/{data.aktuelles.id}/erfordernis?zurueck=/versammlungen/{v.id}/leitung"
						>
							Erfordernis bestimmen
						</a>
					</p>
				{:else if data.offen}
					<p class="meldung warnung">
						Es ist bereits eine andere Abstimmung offen. Schliessen Sie sie zuerst.
					</p>
				{:else if data.rueckkommen && !data.rueckkommen.abstimmbar}
					<!--
						**Kein Knopf, der in eine Absage führt** (gemeldet am 20.08.2026).

						Über das Geschäft ist abgestimmt; ein zweiter Durchgang braucht einen
						Beschluss der Versammlung. Bis hierhin stand trotzdem «Abstimmung
						freigeben» da, und jeder Klick endete in derselben roten Meldung —
						während der gestellte Rückkommensantrag als Traktandum am Ende der
						Liste wartete, wo ihn niemand suchte.

						Jetzt steht hier, was gilt, und daneben der Weg dahin: Wo die
						Anwendung führen kann, führt sie — sonst nennt der Satz den Ort.
					-->
					<div class="rueckkommensweg">
						<p class="meldung warnung">{data.rueckkommen.satz}</p>
						{#if data.aktuelles.folgeantragHinweis}
							<p class="meldung warnung">{data.aktuelles.folgeantragHinweis}</p>
						{/if}
						{#if data.rueckkommen.weg === 'antrag_aufrufen' && data.rueckkommen.antragId && !amAbend}
							<form method="POST" action="?/aufrufen" use:enhance={absenden()}>
								<input type="hidden" name="traktandum" value={data.rueckkommen.antragId} />
								<button type="submit" class="haupt">
									Rückkommensantrag {data.rueckkommen.antragNummer} aufrufen
								</button>
							</form>
						{/if}
					</div>
				{:else if data.aktuelles.rueckzug}
					<!--
						**Kein Knopf, der in einen Serverfehler führt** (21.08.2026): «Wenn
						der Antrag zurückgezogen ist, bitte dann die Abstimmungsmöglichkeit
						entfernen. WEnn man darauf klickt kommt bei Rückzug ein 500er
						fehler.»

						Der 500er ist eigens behoben (`pruefeDurchgangsfreigabe`) — die Regel
						stand nur als Datenbanktrigger da, und der wirft keinen fachlichen
						Fehler, sondern eine weisse Seite. Aber ein angebotener Knopf, den
						der Server abweist, ist auch mit schöner Meldung ein Fehler: Hier
						steht deshalb, was gilt, und daneben der Weg zurück.
					-->
					<div class="rueckkommensweg">
						<p class="meldung warnung">
							Der Antrag ist zurückgezogen; darüber wird nicht abgestimmt.
							{#if data.aktuelles.rueckzug.grund}
								Grund: {data.aktuelles.rueckzug.grund}
							{/if}
						</p>
						<!--
							**Ohne Rückfrage.** Der Schritt ist umkehrbar — wer den Rückzug
							zurücknimmt, kann sofort wieder zurückziehen —, und es entsteht
							dabei nichts, das jemandem gehört. Eine Rückfrage, die nichts zu
							bedenken gibt, lehrt bloss, Rückfragen wegzuklicken.
						-->
						<form method="POST" action="?/rueckzugZurueck" use:enhance={absenden()}>
							<input type="hidden" name="traktandum" value={data.aktuelles.id} />
							<button type="submit" class="haupt" data-fokus="rueckzug:{data.aktuelles.id}">Rückzug zurücknehmen</button>
						</form>
					</div>
				{:else}
					<!--
						**Hier nur noch der Hinweis ohne Zahlen** (Auftrag
						03.10.2026): Die Zahl und die Regel stehen seit demselben Tag
						oben beim Antragstext. An dieser Stelle bleibt der Fall, in
						dem es keine Zahl gibt — Grenzfall, kein Erfordernis oder
						eine Mehrheit, die sich nicht rechnen lässt —, samt dem
						Grund, warum sich nicht eröffnen lässt; er gehört zum Knopf
						daneben.
					-->
					{#if !(data.vorschau?.kopf || data.vorschau?.quoten)}
						<p class="klein">Erfordernis: <strong>{data.aktuelles.erfordernis}</strong></p>
						<!--
							Ein Erfordernis, das keine Abstimmung trägt, ist etwas anderes als
							«keine Zahl nötig»: Dort fehlt etwas, das gebraucht wird, und das
							gehört sichtbar hin, nicht leise. Derselbe Satz, mit dem der Server
							das Eröffnen abweist (seit 25.09.2026, `sperrgrund`).
						-->
						{#if data.vorschau?.sperrgrund}
							<p class="meldung warnung">{data.vorschau.sperrgrund}</p>
						{:else if data.vorschau}
							<p class="klein leise">{data.vorschau.satz}</p>
						{/if}
					{/if}
					<!--
						**Warum die eine Zahl fällt und die andere nicht**
						(Bedienbarkeitsprüfung 05.09.2026, Befund 15): «Nach einem Ausstand
						sinkt die Kopfbasis, die Quotenbasis nicht — ohne ein Wort, warum.»

						Das Wort gab es, es stand nur im Ergebnis. Gefragt wird im Saal
						vorher, wenn die Zahlen sich vor aller Augen verschieben, und wer
						darauf keine Antwort hat, hält die Anwendung für kaputt. Der Wortlaut
						ist derselbe wie im Ergebnis, aus `ausstandshinweis`.
					-->
					{#if data.vorschau?.ausstandshinweis}
						<!--
							`saalhinweis` statt einer eigenen Klasse: Das Haus führt diese
							«leise Erklärung mit linkem Strich» bereits, und eine zweite mit
							anderer Breite und anderem Strich stünde auf derselben Seite
							daneben. Der Code-Review vom 06.09.2026 hat den ersten Anlauf
							gefangen; der Hausklassenwächter sieht eine neu erfundene Klasse
							nicht.
						-->
						<p class="klein saalhinweis">{data.vorschau.ausstandshinweis}</p>
					{/if}
					<!--
						**Warnungen vor dem Eröffnen** (Block 3 der Freigabeliste): ob die
						Mehrheit mit den Anwesenden erreichbar ist (Ä-11), eine
						Einstimmigkeit aus dem Reglement (Ä-15), der Zirkulationsbeschluss
						als Traktandum (Ä-20). Keine Sperre; der Knopf bleibt.
					-->
					<!-- Nur bei Beschlussfähigkeit: sonst wird nicht verbindlich abgestimmt, und
					     der Satz darunter sagt es (Codeprüfung 17.10.2026, N1). Ohne
					     Momentaufnahme ist sie nicht festgestellt, also auch nicht; so wie am
					     gemeinsamen Abend (Featureprüfung Block 3, 18.10.2026). -->
					{#if data.vorschau?.erreichbarkeitshinweis && data.beschlussfaehigkeit?.beschlussfaehig}
						<p class="meldung warnung">{data.vorschau.erreichbarkeitshinweis}</p>
					{/if}
					{#each data.mehrhinweise as h (h)}
						<p class="meldung warnung">{h}</p>
					{/each}
					{#if data.verwaltungsangabe}
						<!--
							**Die Angabe der Leitung am Folgeantrag** (Entscheid 0045, Punkt 11):
							beim Satz zu den Vollmachten, weil sie ihn ändert. Das Angebot mit
							Rückfrage, denn die Leitung hält damit eine Tatsache fest, die
							Votum nicht prüfen kann und die das Protokoll nennt; das
							Zurücknehmen stellt die Vorgabe wieder her und fragt nicht nach.
							Nur vor dem ersten Durchgang; danach liefert der Server nichts.
						-->
						{#each data.verwaltungsangabe.angebote as a (a.grund)}
							<p class="klein saalhinweis">{a.satz}</p>
							<form method="POST" action="?/verwaltungsangabe" use:enhance={absenden()}>
								<input type="hidden" name="traktandum" value={data.aktuelles.id} />
								<input type="hidden" name="grund" value={a.grund} />
								<Rueckfrage
									beschriftung={a.beschriftung}
									ton="neutral"
									gewicht="leise"
									marke="verwaltungsangabe:{a.grund}"
									frage={a.frage}
									folge={a.folge}
								/>
							</form>
						{/each}
						{#if data.verwaltungsangabe.gesetzt}
							<form method="POST" action="?/verwaltungsangabeZurueck" use:enhance={absenden()}>
								<input type="hidden" name="traktandum" value={data.aktuelles.id} />
								<button type="submit" class="leise" data-fokus="verwaltungsangabe:zurueck">
									Angabe zurücknehmen
								</button>
							</form>
						{/if}
					{/if}
					{#if data.rueckkommen?.satz}
						<!-- Der zweite Durchgang nach angenommenem Rückkommen: Er sieht aus wie
						     jeder andere, ersetzt aber einen gefassten Beschluss. Das gehört
						     vor die Freigabe, nicht ins Protokoll danach. -->
						<p class="meldung gut">{data.rueckkommen.satz}</p>
						{#if data.aktuelles.folgeantragHinweis}
							<!--
								**Der Folgeantrag mit eigenem Beschluss** (Fachprüfung 08.10.2026,
								Frage 2). Hier wählt die Leitung, welcher Antrag zur Abstimmung
								kommt; nur hier lässt sich der Beschluss noch einbeziehen.
							-->
							<p class="meldung warnung">{data.aktuelles.folgeantragHinweis}</p>
						{/if}
					{/if}
					{#if data.beschlussfaehigkeit && !data.beschlussfaehigkeit.beschlussfaehig}
						<!--
							Ä-18, 17.09.2026: Ohne Beschlussfähigkeit weist der Server das Freigeben
							ab. Der Grund steht schon vor dem Klick da, mit dem Weg zur Anwesenheit.
							Der Knopf bleibt, weil die Seite hinter einem Einlass am anderen Gerät
							zurückliegen kann; dann entscheidet der Server mit dem neuen Stand.
						-->
						<p class="klein saalhinweis">
							Nicht beschlussfähig: {data.beschlussfaehigkeit.fehlt.replace(/\.\s*$/, '')}. Verbindlich
							abgestimmt wird erst, wenn die Beschlussfähigkeit erreicht ist.
							<!-- Nur wo das Häkchen steht: nicht am Abend, nicht nach einem
							     geltenden Beschluss (Codeprüfung 14.10.2026, M1, M2). -->
							{#if data.konsultativMoeglich && !amAbend && !data.vorschau?.sperrgrund && data.aktuelles?.ausnahme !== 'universal'}
								Konsultativ, ohne Beschluss, lässt sich auch jetzt abstimmen.
							{/if}
							{#if data.beschlussfaehigkeit.bedingungen.length > 0}
								Ist jemand im Saal, der fehlt, berichtigen Sie die
								<a href="/versammlungen/{v.id}/anwesenheit">Anwesenheit</a>.
							{/if}
						</p>
					{/if}
					<!--
						**Kein Knopf, der in eine Absage führt** (seit 25.09.2026). Steht ein
						`sperrgrund`, weist der Server das Freigeben ab
						(`pruefeDurchgangsfreigabe`, `erfordernisluecke`); die Warnung darüber
						nennt den Weg. Ausnahme ist das heute unerreichbare Netz in
						`mehrheitsvorschau`: Dort fehlt der Knopf vorsichtshalber, obwohl der
						Server öffnen würde.
						Anders als bei der Beschlussfähigkeit hängt der Knopf hier nicht an
						einem Stand, der sich laufend ändert: Das Erfordernis ändert sich nur
						über einen Eingriff. Der lädt aber nur das eigene Gerät neu; hat ein
						anderes Gerät eingegriffen, fängt das die Marke der Zuordnung ab
						(`zuordnungsfeld`, Codeprüfung M4, N3).
					-->
					{#if !amAbend && !data.vorschau?.sperrgrund}
						{@const universalHier = data.aktuelles.ausnahme === 'universal' ? data.universal : null}
						<form method="POST" action="?/oeffnen" use:enhance={absenden()}>
							<input type="hidden" name="traktandum" value={data.aktuelles.id} />
							<!--
								**Die Universalversammlung braucht die Bestätigung der Leitung**
								(Migration 128; Runde 2, Stellen 3 und 4). Fehlt noch etwas, nennt
								der Satz alle Gründe; der Knopf bleibt, weil die Seite hinter einem
								Einlass am anderen Gerät zurückliegen kann.
							-->
							{#if universalHier}
								<div class="universal">
									{#if universalHier.empfehlung}
										<p class="klein">{universalHier.empfehlung}</p>
									{/if}
									{#if universalHier.gruende.length > 0}
										<p class="meldung warnung">{universalHier.gruende.join(' ')}</p>
									{/if}
									<label class="haken">
										<input type="checkbox" name="universalBestaetigt" value="ja" />
										{universalHier.bestaetigung}
									</label>
								</div>
							{/if}
							<!--
								**Geheime Abstimmung** (Produktentscheid 28.09.2026, Migration
								141). Verlangt die Versammlung sie im Saal, hält die Leitung
								das hier fest; die Anzeigen nennen dann nur «erreicht» oder
								«nicht erreicht». Die Formulierung nennt die Wirkung, weil
								sie vor der Abstimmung bekannt sein muss (DSG Art. 19;
								Fachprüfung 28.09.2026, F-5).
							-->
							<label class="haken">
								<input type="checkbox" name="geheim" value="ja" />
								Geheim abstimmen: Die Anzeigen nennen nur «erreicht» oder «nicht erreicht».
							</label>
							<!-- Ä-38, Punkt 8: Grundlage der geheimen Abstimmung, mindestens eines (Migrationen 165, 166). -->
							<label class="haken">
								<input type="checkbox" name="geheimBeschlossen" value="ja" />
								{GEHEIM_BESCHLUSS_HAKEN}
							</label>
							<label class="haken">
								<input type="checkbox" name="geheimNachReglement" value="ja" />
								{GEHEIM_REGLEMENT_HAKEN}
							</label>
							<!-- Ä-38, Punkt 1: Votum empfiehlt, die Leitung entscheidet. -->
							<p class="klein">{GEHEIM_HINWEIS_LEITUNG}</p>
							<!--
								**Konsultativ, nur ohne Beschlussfähigkeit** (Migration 158; seit
								L5 auch ohne die einer ersten an einem neuen Traktandum). Das
								Häkchen steht nur da, wo die Seite die Beschlussfähigkeit fehlen
								sieht; ob sie fehlt, entscheidet der Server mit dem Stand beim
								Freigeben und weist sonst ab. Nicht unter der Universalversammlung,
								die setzt voraus, dass alle da sind.
							-->
							{#if data.konsultativMoeglich && !universalHier}
								<label class="haken">
									<input type="checkbox" name="konsultativ" value="ja" />
									{KONSULTATIV_HAKEN}
								</label>
							{/if}
							{@render zuordnungsfeld()}
							<button type="submit" class="haupt" data-fokus="abstimmung:{data.aktuelles.id}">Abstimmung freigeben</button>
						</form>
						{#if universalHier && universalHier.variante !== 'keine'}
							<!--
								**Widerspruch vor dem Eröffnen** (Produktentscheid 29.09.2026,
								Migration 129; vorher Laienprüfung Block 3, U4: «kreuzen Sie nicht
								an»). Ein eigenes Formular neben dem Häkchen, weil Formulare nicht
								ineinander stehen. Danach verschwindet «Abstimmung freigeben», und
								an seiner Stelle steht, was jetzt gilt (`rueckkommen.satz`).
							-->
							<section class="widerspruch">
								<p class="klein">{WIDERSPRUCH_VOR_EROEFFNEN}</p>
								<form method="POST" action="?/widerspruch" use:enhance={absenden()}>
									<input type="hidden" name="traktandum" value={data.aktuelles.id} />
									<label>
										Wer widerspricht
										<Suchauswahl
											name="partei"
											beschriftung="Wer widerspricht"
											leerText="— wählen —"
											pflicht
											bind:wert={widersprechende}
											eintraege={universalHier.anwesende.map((p) => ({ wert: p.id, text: p.name }))}
										/>
									</label>
									<Rueckfrage
										beschriftung="Widerspruch festhalten"
										ton="warnung"
										frage={`Widerspruch von ${universalHier.anwesende.find((p) => p.id === widersprechende)?.name ?? 'der gewählten Partei'} festhalten?`}
										folge={WIDERSPRUCH_VOR_EROEFFNEN_FOLGE}
										bestaetigen="Festhalten"
									/>
								</form>
							</section>
						{/if}
					{/if}
				{/if}
			{/if}

			<!-- ── Ergebnisse ───────────────────────────────────────────────── -->
			{#if data.ergebnisse.some((e) => e.zustand === 'geschlossen')}
				<h3 class="abstand">Ergebnisse</h3>
				{#each data.ergebnisse.filter((e) => e.zustand === 'geschlossen') as e (e.durchgangId)}
					<article class="ergebnis" class:angenommen={e.auszaehlung?.angenommen}>
						<h4>{e.nummer} {e.titel}{#if e.durchgang > 1}{' '}· {e.durchgang}. Durchgang{/if}</h4>
						<p class="satz">{e.satz}</p>
						{#if e.nachRueckkommen}
							<!-- Reste vom 30.09.2026, Punkt 1: Das Ergebnis oben ist das des früheren Durchgangs. -->
							<p class="meldung warnung">{e.nachRueckkommen}</p>
						{/if}
						<!--
							Die Namen nur hier und im Protokoll, nicht an der Wand
							(Laienprüfung Runde 2, L14): Die Leitung muss wissen, wer.
						-->
						{#if e.auszaehlung?.keinBeschluss}
							{#each keinBeschlussNamenszeilen(e.auszaehlung.keinBeschluss) as zeile (zeile)}
								<p class="klein">{zeile}</p>
							{/each}
							<!--
								Der Weg danach (Fachprüfung Block 3 zu Stelle 11; Laienprüfung U1).
								Nach einem Widerspruch am Geschäft, auch einem späteren vor dem
								Neueröffnen, gibt es keinen (Codeprüfung Block 4a, M-1).
							-->
							<p class="klein">
								{e.auszaehlung.keinBeschluss.grund === 'widerspruch' || e.widersprochen
									? UNIVERSAL_KENNTNIS
									: wegNachKeinemBeschluss(e.auszaehlung.keinBeschluss)}
							</p>
							{#if e.auszaehlung.keinBeschluss.grund !== 'widerspruch' && !e.widersprochen && (e.auszaehlung.keinBeschluss.nurDurchLeitung ?? []).length > 0}
								<p class="klein">{KREUZ_ZURUECKNEHMEN}</p>
							{/if}
						{/if}
						{#if e.auszaehlung}
							<dl class="zahlen">
								<div>
									<dt>Kopfstimmen</dt>
									<!--
										**Kopfspiegel beim Beschluss von Hand** (Plan 30.09.2026,
										«Offen aus Block 1», Punkt 3): Nur Ja, Nein und Enthaltung.
										«0 ohne Abgabe» und «Bezugsgrösse N» läsen sich wie eine
										Grösse, die es nicht gab; die Zahlen sind eingetragen,
										nicht ausgezählt.
									-->
									<dd>
										{e.auszaehlung.koepfe.ja} ja · {e.auszaehlung.koepfe.nein} nein ·
										{e.auszaehlung.koepfe.enthaltung} Enthaltung{#if !e.auszaehlung.vonHand}{' '}·
										{e.auszaehlung.koepfe.ohneAbgabe} ohne Abgabe
										{#if e.auszaehlung.koepfe.nichtAnwesend > 0}
											· {e.auszaehlung.koepfe.nichtAnwesend} nicht anwesend
										{/if}
										{#if (e.auszaehlung.koepfe.stimmtNicht ?? 0) > 0}
											· {stimmtNichtInWorten(e.auszaehlung.koepfe.stimmtNicht ?? 0)}
										{/if}
										{#if (e.auszaehlung.koepfe.imAusstand ?? 0) > 0}
											· {imAusstandInWorten(e.auszaehlung.koepfe.imAusstand ?? 0)}
										{/if}
										<span class="klein">
											Bezugsgrösse {e.auszaehlung.koepfe.basis}{#if e.auszaehlung.koepfe.schwelle !== null && e.auszaehlung.keinBeschluss?.grund !== 'konsultativ'}, nötig {e.auszaehlung.koepfe.schwelle}{/if}
										</span>{/if}
									</dd>
								</div>
								<div>
									<dt>Wertquoten</dt>
									<dd>
										<!--
											**Nicht erhoben ist nicht null** (25.08.2026). Bei einer
											Handzählung steht im Quotenspiegel überall null, und «0 ja ·
											0 nein» liest sich wie ein Ergebnis. Wer es vorliest,
											verkündet eine Zahl, die niemand gezählt hat.
										-->
										{#if e.auszaehlung.quotenErhoben === false}
											nicht erhoben
											<!-- Der Satz der Handzählung nennt «Von Hand gezählt» und
											     passt beim Beschluss von Hand nicht; dort bleibt es
											     bei «nicht erhoben». -->
											{#if !e.auszaehlung.vonHand}
												<span class="klein">
													<!-- Konsultativ ohne Erfordernis, also ohne den Teil dazu (Befund 7). -->
													{#if e.auszaehlung.keinBeschluss?.grund === 'konsultativ'}
														Von Hand gezählt: Die Stimmen nach Wertquoten sind nicht erhoben.
													{:else}
														Von Hand gezählt: Die Stimmen nach Wertquoten sind nicht erhoben; das Erfordernis verlangt hier keine Mehrheit der Wertquoten.
													{/if}
												</span>
											{/if}
										{:else}
											{e.auszaehlung.quoten.ja} ja · {e.auszaehlung.quoten.nein} nein ·
											{e.auszaehlung.quoten.enthaltung} Enthaltung
											{#if !e.auszaehlung.vonHand}
												<span class="klein">
													Bezugsgrösse {e.auszaehlung.quoten.basis}{#if e.auszaehlung.keinBeschluss?.grund === 'konsultativ'}{''}{:else if e.auszaehlung.quoten.schwelle !== null}, nötig {e.auszaehlung.quoten.schwelle}{:else}{' '}(kein Quotenerfordernis){/if}
												</span>
											{/if}
										{/if}
									</dd>
								</div>
							</dl>
							{#each e.auszaehlung.hinweise as h (h)}
								<p class="meldung warnung">{h}</p>
							{/each}
							<!-- Das Ergebnis nach der anderen Lesart (Migration 169), mit dem Rat
							     an die Leitung nur hier, nicht in den Hinweisen der Auswertung;
							     Frist und Berechtigte stehen bei 1a und B3 auch im Protokoll. -->
							{#each andereLesartenVon(e.auszaehlung) as r (r.kennung)}
								<p class="meldung warnung">
									{andereLesartInWorten(r, e.auszaehlung.geheim).leitung}
								</p>
							{/each}
						{/if}

						<!--
							**Stichentscheid und Neuabstimmung stehen in `Ergebnisnachgang`**
							(24.08.2026). Sie standen hier ausgeschrieben — und am gemeinsamen
							Abend gar nicht, obwohl dort dieselbe Stimmengleichheit entstehen
							kann. Ein Baustein, zwei Sichten; auseinanderlaufen kann es nicht.
						-->
						<Ergebnisnachgang
							durchgangId={e.durchgangId}
							stichentscheidOffen={e.stichentscheidOffen}
							stichentscheidArt={e.stichentscheidArt}
							stichentscheid={e.stichentscheid}
							beschlusstext={e.beschlusstext}
							ohneNeuabstimmung={e.auszaehlung?.keinBeschluss?.grund === 'widerspruch' ||
								e.widersprochen ||
								!!e.offenNachRueckkommen}
							ohneBeschlusstext={e.auszaehlung?.keinBeschluss?.grund === 'konsultativ'}
						/>
						{#if e.offenNachRueckkommen}
							<!-- Die Neuabstimmung an den offenen Durchgang nach dem Rückkommen, nicht an
							     den geltenden (Reste vom 30.09.2026, Punkt 3; Codeprüfung H1). -->
							<Ergebnisnachgang
								durchgangId={e.offenNachRueckkommen}
								stichentscheidOffen={true}
								ohneBeschlusstext={true}
							/>
						{/if}

						<div class="handlungen">
							<!--
								**Schliessen verkündet** (Produktentscheid 21.08.2026): «Mit dem
								Schliessen der Abstimmung, auch wenn nicht alle abgestimmt haben,
								soll automatisch verkündet werden. Ich sehe dort den Mehrwert
								nicht.»

								Der Knopf stand hier — und behauptete «Erst danach erscheint es auf
								Leinwand und Telefonen», während das Ergebnis bei vollzähliger
								Abstimmung längst dort stand. Ein Klick ohne sichtbare Wirkung,
								neben einem Satz, der nicht stimmte.

								Bleibt der Gleichstand: Seit dem 28.09.2026 wieder beide Fälle,
								der Verwalter-Stichentscheid und der Gleichstand über einer
								Handzählung. Bis der Entscheid eingetragen oder die Stimmen einzeln
								erfasst sind, gibt es kein Ergebnis zu verkünden.
							-->
							{#if e.stichentscheidOffen}
								<span class="klein">
									{#if e.stichentscheidArt === 'verwalter' || e.stichentscheidArt === 'vorsitz'}
										Noch nichts an der Wand: Bei Gleichstand entscheidet nach dem Reglement
										{e.stichentscheidArt === 'vorsitz' ? 'die Person im Vorsitz' : 'der Verwalter'}.
										Sobald der Entscheid unten eingetragen ist, erscheint
										das Ergebnis.
									{:else}
										Noch nichts an der Wand: Bei Gleichstand entscheiden die Wertquoten,
										und die lassen sich aus einer Handzählung nicht ablesen. Mit einer
										Neuabstimmung und einzeln erfassten Stimmen erscheint das Ergebnis.
									{/if}
								</span>
							{:else}
								<span class="marke gut">verkündet</span>
							{/if}

						</div>

						{#if e.frueher > 0}
							<p class="klein">
								{e.frueher === 1
									? '1 weiterer Durchgang zu diesem Traktandum — überholt, aber einsehbar.'
									: `${e.frueher} weitere Durchgänge zu diesem Traktandum — überholt, aber einsehbar.`}
							</p>
						{/if}
					</article>
				{/each}
			{/if}
			<!--
				**Der Notweg bei offener Abstimmung** (03.10.2026, B1): Er steht hier,
				weil `.raster.eingeengt .ablauf` die linke Spalte ausblendet. Genau dann
				braucht die Leitung «Abstimmung schliessen» und den Beschluss von Hand.
				Je Zustand genau eine Stelle: ohne offene Abstimmung steht er oben im
				Ablauf (`notwegKasten`).
			-->
			{#if amAbend && abstimmungLaeuft}
				{@render notwegKasten()}
			{/if}
		</section>
	</div>
{/if}

<style>
	/*
	 * **Der Saal wird am Abend geführt** — der Kasten steht ganz oben, in
	 * Akzentfarbe, und trägt den Weg dorthin. Er ist keine Warnung: Es ist der
	 * Normalfall am Verbundabend, und eine Warnfarbe für den Normalfall stumpft
	 * ab.
	 */
	.fremdgefuehrt {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.6rem;
		margin-bottom: 1rem;
		padding: 0.9rem 1rem;
		border: 1px solid color-mix(in srgb, var(--akzent) 45%, var(--linie));
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 8%, var(--flaeche));
	}

	.fremdgefuehrt p {
		margin: 0;
		max-width: var(--lesebreite);
	}

	/*
	 * **Ein Verweis in Knopfgestalt trägt keinen Unterstrich** (UI-Durchgang
	 * 06.10.2026). `.handlung` in `app.css` ist für `<button>` geschrieben und
	 * setzt `text-decoration` nicht; am `<a>` blieb die Unterstreichung des
	 * Browsers stehen, auf gefüllter Fläche.
	 */
	.fremdgefuehrt a.handlung {
		text-decoration: none;
	}

	/* Der Notweg: leise, zugeklappt, und benannt statt versteckt. */
	/* Wie `.zeiger` in `BeschlussVonHand.svelte`: benennt, warnt nicht. */
	.zeiger {
		margin: 0.6rem 0 0;
		padding: 0.55rem 0.95rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		border-left: 3px solid var(--akzent);
		font-size: 0.9rem;
	}

	.notweg {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--linie);
	}

	.notweg summary {
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	.notweg p {
		max-width: var(--lesebreite);
	}

	.notzeile {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		margin-top: 0.6rem;
	}

	/*
	 * **Luft vor dem Beschluss von Hand** (Befund 04.10.2026). Der zugeklappte
	 * Notweg stand unmittelbar unter der Knopfreihe («Abstimmung freigeben»,
	 * «Pause einlegen») und war von ihr kaum zu trennen. Beides sind Handlungen
	 * an derselben Abstimmung, und der Beschluss von Hand schreibt fest — die
	 * Lücke macht aus der Reihe und dem Kasten zwei Schritte. Gemessen im
	 * Notweg-Kasten: vorher 9 px, nachher 24 px.
	 *
	 * `:global`, weil das `details` in `BeschlussVonHand.svelte` steht und
	 * seinen eigenen Stil mitbringt; die Regel der Seite erreicht es sonst
	 * nicht (dieselbe Falle wie beim Auswahlfeld auf der Erfordernisseite).
	 */
	.notweg :global(details.vonhand) {
		margin-top: 1.5rem;
	}

	/*
	 * **Luft nach dem Beschluss von Hand** (Befund 04.10.2026). Im Aktuellen
	 * Geschäft steht der zugeklappte Notweg unter «Jetzt möglich» und
	 * unmittelbar über der Knopfreihe («Abstimmung freigeben»); gemessen
	 * klebten die beiden mit 0 px aneinander. Dieselbe Lücke wie beim Kasten
	 * darunter, nur die andere Seite: Beides sind Handlungen an derselben
	 * Abstimmung, und der Beschluss von Hand schreibt fest.
	 *
	 * `:global` wie dort, weil das `details` in `BeschlussVonHand.svelte`
	 * steht und seinen eigenen Stil mitbringt.
	 */
	.geschaeft :global(details.vonhand) {
		margin-bottom: 1.5rem;
	}

	.notzeile label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
		min-width: 0;
		flex: 1 1 auto;
	}
	.nutzniessung {
		list-style: none;
		margin: 0.4rem 0;
		padding: 0;
	}

	.nutzniessung li {
		background: color-mix(in srgb, var(--akzent) 10%, transparent);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		margin: 0.2rem 0;
		padding: 0.4rem 0.6rem;
	}

	/* Wo die Anwendung nicht entscheiden darf, sieht es auch anders aus. */
	.nutzniessung li.vonHand {
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
	}

	.reihenfolge {
		background: color-mix(in srgb, var(--akzent) 10%, transparent);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		margin: 0.2rem 0 0.4rem calc(var(--tiefe, 0) * 1.2rem + 2.5rem);
		padding: 0.35rem 0.6rem;
	}

	.rueckkommen {
		font-size: 0.9rem;
		margin: 0 0 0.5rem calc(var(--nr-spalte) + 0.5rem);
	}

	/* Auskunft und Weg gehören zusammen: der Satz, darunter der Knopf, der ihn
	   einlöst. */
	.rueckkommensweg {
		display: grid;
		gap: 0.6rem;
		justify-items: start;
	}
	.rueckkommensweg .meldung {
		margin: 0;
	}

	.vorbehalt {
		border-left: 2px solid var(--warnung);
		padding-left: 0.6rem;
	}

	.rueckzug {
		font-size: 0.9rem;
		margin: 0 0 0.5rem calc(var(--nr-spalte) + 0.5rem);
	}

	.rueckzug label {
		display: block;
		margin: 0.3rem 0;
	}

	.rueckzugsvermerk {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0.1rem 0 0.4rem calc(var(--tiefe, 0) * 1.2rem + 2.5rem);
	}

	.notiz {
		margin-top: 0.5rem;
	}

	.nurLeser {
		clip-path: inset(50%);
		height: 1px;
		overflow: hidden;
		position: absolute;
		white-space: nowrap;
		width: 1px;
	}

	.saalkopf {
		margin-bottom: 1.25rem;
	}

	.kopf {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	/*
	 * Der Knopf ganz nach rechts — und `align-self`, weil die Zeile an der
	 * Schriftlinie ausgerichtet ist: Ein Knopf auf der Grundlinie hinge nach
	 * unten aus der Zeile heraus.
	 */
	.beamerplatz {
		margin-left: auto;
		align-self: center;
	}

	/* Am Ende des Abends führt diese Kachel — deshalb trägt sie die Farbe. */
	.dreischritt > li.nachher.amEnde {
		background: color-mix(in srgb, var(--akzent) 10%, var(--flaeche));
		border-color: var(--akzent);
	}

	/*
	 * `fieldset` statt `label`: Die Beschriftung gehört zu einer Gruppe von
	 * Feldern, nicht zu einem. Der Rahmen fällt weg — er stünde in einer Karte,
	 * die schon einen hat.
	 */
	.parteiwahl {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}


	h1 {
		margin: 0.2rem 0 0.35rem;
	}

	.wo,
	.mit {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem 0.9rem;
		margin: 0.35rem 0 0;
	}

	.mit .klein {
		color: var(--text-leise);
		font-size: 0.875rem;
	}

	.mit .stand {
		color: var(--text-leise);
	}

	.hin {
		margin: 0 0 0.35rem;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.hin {
		margin-bottom: 0.75rem;
	}

	/* Ein Gerät, zwei Anordnungen: Auf dem Telefon untereinander, auf dem
	   Notebook nebeneinander. Dieselben Handlungen, ohne Umweg. */
	.raster {
		display: grid;
		gap: 1.5rem;
	}

	/*
	 * **`min-width: 0` an den Spalten.** Ein Rasterfeld ist von sich aus nie
	 * schmaler als sein Inhalt (`min-width: auto`) — ein einziger langer Titel
	 * schiebt damit die ganze Seite über den Rand, und am Telefon lässt sie sich
	 * quer schieben, ohne dass etwas zu sehen wäre.
	 */
	.raster > * {
		min-width: 0;
	}

	/*
	 * **Schmal: zuerst das Geschäft, dann der Ablauf** (Code-Review
	 * 07.09.2026). Unter 60rem steht alles untereinander, und im Baum kommt
	 * `section.ablauf` zuerst — mit Dreischritt, allen Traktanden,
	 * Wandsteuerung und «Traktandum aufnehmen». Bis zum Umzug lag der
	 * Arbeitsblock **darin**, weit oben in der Karte «jetzt». Ohne diese Zeile
	 * läge er dahinter, und wer im Saal am Telefon ein Votum schreiben oder
	 * einen Ausstand erklären will, rollte erst durch die ganze Liste.
	 *
	 * Der Preis ist eine Abweichung zwischen Baum- und Leseordnung: Wer mit
	 * der Tastatur wandert, kommt zuerst durch den Ablauf. Beide Abschnitte
	 * tragen eine Überschrift, die Reihenfolge bleibt also benennbar — und die
	 * Alternative wäre, den ganzen Abschnitt im Baum zu verschieben und dafür
	 * die breite Anordnung über `grid-column` festzuzurren.
	 */
	.geschaeft {
		order: -1;
	}

	@media (min-width: 60rem) {
		.raster {
			/*
			 * Seit die Seite die ganze Fensterbreite hat, ist der Deckel von 24rem
			 * zu eng: Die Traktandentitel brachen zweizeilig um, während rechts
			 * Platz frei lag. 30rem fasst «Ersatz der Gartenbank» samt Marke und
			 * Knopf auf einer Zeile und lässt der rechten Spalte trotzdem den
			 * grösseren Teil.
			 */
			grid-template-columns: minmax(18rem, 30rem) 1fr;
			align-items: start;
		}

		/* Breit entscheidet wieder die Baumordnung: Ablauf links, Geschäft rechts. */
		.geschaeft {
			order: 0;
		}

		/*
		 * **Das aktuelle Geschäft klebt** (Auftraggeber, 01.09.2026: «Bitte prüfen bei
		 * Versammlung leiten bei einer Einzelversammlung»).
		 *
		 * Gemessen bei 1440 px an einer laufenden Einzelversammlung: Der Ablauf
		 * links ist 2599 px hoch, das Geschäft rechts 263 — daneben standen
		 * **2336 px Leere**, gut zweieinhalb Bildschirmhöhen, und mit
		 * aufgerufenem Traktandum wurde es mehr statt weniger (2532 px). Genau
		 * die Lücke, die `docs/plan-seitenaufbau-2026-08-27.md` beschreibt: zwei
		 * ungleich lange Dinge nebeneinander.
		 *
		 * **Warum nicht der Seitenstapel.** Er stellt alles untereinander. Hier
		 * wäre das falsch: Im Saal ruft man links ein Traktandum auf und sieht
		 * rechts, was daraufhin geschieht — das Nebeneinander ist die Arbeit
		 * selbst. Was fehlte, war nicht die Spalte, sondern dass sie beim Rollen
		 * durch elf Traktanden nach oben verschwand.
		 *
		 * `--kopf-ist` ist die gemessene Höhe der klebenden Kopfleiste
		 * (`+layout.svelte` schreibt sie per `ResizeObserver`); ein fester Wert
		 * deckte nur die breiten Fenster ab.
		 *
		 * **Doch ein Deckel, seit der Arbeitsblock hier steht** (07.09.2026).
		 *
		 * Am 01.09.2026 wurden `max-height` und `overflow-y` wieder entfernt,
		 * mit der Begründung, ein klebendes Element klebe ohnehin nur, bis es
		 * durchgelaufen sei, man komme also an jeden Teil davon. **Das stimmt so
		 * nicht.** Gemessen am 07.09.2026 bei 1440×900, mit aufgeklapptem
		 * Ausstandsformular: Der Kasten war 1158 px hoch, der Absendeknopf lag
		 * bei 1100 px, die Kopfleiste endete bei 118. Beim Rollen auf 300, 800
		 * und 1500 px blieb der Knopf unverändert bei 1100 und damit unter der
		 * Falz; sichtbar wurde er erst am **Seitenende** bei 2223 px, wo das
		 * Kleben aufhört. Bis dahin zeigte die Seite über 1400 px Rollweg
		 * dasselbe Bild.
		 *
		 * Solange in diesem Kasten nur Text stand, kostete das nichts. Der Umzug
		 * des Arbeitsblocks bringt Formulare hinein, die aufklappen, und damit
		 * einen Knopf, den man nicht erreicht.
		 *
		 * Der Deckel greift erst, wenn der Kasten das Fenster füllt; darunter
		 * ändert er nichts. Die lange Ergebnisliste, die 01.09. das Argument
		 * gegen ihn war, bekommt damit tatsächlich einen eigenen Roller — sie
		 * ist dafür jederzeit ganz erreichbar statt erst am Seitenende.
		 */
		.raster:not(.eingeengt) .geschaeft {
			position: sticky;
			/*
			 * **Rückfall 13rem, nicht 7rem** (01.09.2026, aus dem Code-Review).
			 * Dieselbe Variable trägt in `app.css` bewusst 13rem: Die Leiste ist
			 * gemessen 118 bis 206 px hoch, je nach Umbruch. Ein kleinerer
			 * Rückfall schöbe den Kasten vor der Hydration unter die Leiste.
			 */
			top: calc(var(--kopf-ist, 13rem) + 1rem);
			/*
			 * **`dvh`, nicht `vh`** (Code-Review 07.09.2026): Auf Geräten mit
			 * einziehbarer Browserleiste ist `100vh` grösser als das, was man
			 * sieht — der Deckel wäre zu hoch, und der eigene Roller endete
			 * unter der Fensterkante. `+layout.svelte` und `app.css` rechnen für
			 * dieselbe Frage schon mit `dvh`.
			 *
			 * **Der Deckel ist für die klebende Lage gerechnet.** Bei Rollstand
			 * 0 steht der Kasten tiefer als `top`, ragt also um diesen Abstand
			 * über die Fensterkante. Das löst sich beim ersten Rollen von
			 * selbst, weil er dann klebt; unlösbar ist nur der Fall, in dem gar
			 * nicht gerollt wird, und dort ist die Seite ohnehin kurz.
			 */
			max-height: calc(100dvh - var(--kopf-ist, 13rem) - 2rem);
			overflow-y: auto;
		}

		/*
			Läuft eine Abstimmung, bleibt nur das laufende Geschäft — über die
			ganze Breite und mit grösseren Zielen. Der Ablauf ist dann nicht
			bloss versteckt, sondern auch nicht mehr anklickbar.
		*/
		.raster.eingeengt {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.raster.eingeengt .ablauf {
		display: none;
	}

	.raster.eingeengt .geschaeft button {
		min-height: var(--ziel-saal);
	}

	section {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
	}

	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.05rem;
	}

	h3 {
		font-size: 1rem;
		margin: 1.25rem 0 0.5rem;
	}

	h3.abstand {
		margin-top: 2rem;
		border-top: 1px solid var(--linie);
		padding-top: 1rem;
	}

	h4 {
		margin: 0 0 0.35rem;
		font-size: 0.95rem;
	}

	.dreischritt {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/*
	 * **Nur die drei Karten, nicht jedes `li` darunter** (21.08.2026).
	 *
	 * Ohne das `>` traf diese Regel auch die Wörter unter «Jetzt möglich»: Jedes
	 * bekam Fläche, Polster und Rundung und sah damit aus wie ein Knopf — vier
	 * Kästchen mit unterstrichenem Text darin, was von beidem das Schlechteste
	 * ist. Gemeint war die Zeile als Angebot im Fliesstext.
	 */
	.dreischritt > li {
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}

	.dreischritt .jetzt {
		background: color-mix(in srgb, var(--akzent) 18%, transparent);
		border: 1px solid var(--akzent);
	}

	.rolle {
		display: block;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-leise);
	}

	.leer {
		color: var(--text-leise);
	}

	.baum {
		list-style: none;
		padding: 0;
		margin: 0;
		/*
		 * **Die Liste misst sich selbst, nicht das Fenster.** Sie steht auf dem
		 * Telefon über die ganze Breite und am Notebook in einer Spalte von
		 * höchstens 30rem — eine Fensterabfrage träfe deshalb den einen Fall und
		 * verfehlte den anderen. Gemessen wird, was die Liste wirklich hat.
		 */
		container-type: inline-size;
		/*
		 * **Die Nummernspalte steht hier, nicht an `.zeile`** (UI-Durchgang
		 * 06.10.2026). An `.zeile` erreichte die Variable die Blöcke darunter
		 * nicht, sie sind Geschwister der Zeile; Rückkommen und Rückzug trugen
		 * deshalb die Zahl ausgeschrieben. 2.1rem fasste «1.2», aber nicht
		 * «10.1»: Die Nummer lief 4 px an den Titel heran («10.1Rückkommen»).
		 * 2.6rem lässt bei «10.1» rund 12 px.
		 */
		--nr-spalte: 2.6rem;
	}

	.baum li {
		padding-left: calc((var(--tiefe) - 1) * 1rem);
		border-bottom: 1px solid var(--linie);
	}

	/*
	 * **Die zuletzt aufgenommene Zeile** — damit sie unter zwölf bis vierzig
	 * anderen zu finden ist, nachdem die Seite zu ihr gerollt hat.
	 *
	 * Der Rand links trägt die Aussage, die Fläche stützt sie nur. `.aktiv`
	 * (das aufgerufene Traktandum) arbeitet mit Schriftschnitt am Titel und
	 * bleibt damit unterscheidbar: Zwei Marken, zwei Mittel.
	 */
	.baum li.eben {
		border-left: 3px solid var(--akzent);
		background: color-mix(in srgb, var(--akzent) 7%, transparent);
	}

	/*
	 * **Ein Raster mit festen Plätzen, keine umbrechende Reihe.**
	 *
	 * Die Breite der Nummernspalte steht als Variable (an `.baum`), weil
	 * weitere Blöcke daran hängen: Das Rückkommen und der Rückzug rücken um
	 * genau diesen Betrag ein (die Antragsprüfung stand bis zum 08.09.2026
	 * ebenfalls hier). Standen sie auf einer eigenen Zahl, wanderten
	 * sie beim ersten Ändern aus der Flucht.
	 */
	.baum .zeile {
		display: grid;
		grid-template-columns: var(--nr-spalte) minmax(0, 1fr);
		align-items: baseline;
		column-gap: 0.5rem;
		row-gap: 0.3rem;
		padding: 0.5rem 0;
	}

	.baum li.aktiv .titel {
		font-weight: 650;
	}

	.nr {
		font-variant-numeric: tabular-nums;
		color: var(--text-leise);
	}

	.titel {
		min-width: 0;
		/* `break-word`, nicht `anywhere`: Umbrochen wird zwischen Wörtern, ein
		   einzelnes zu langes bricht nur, wenn es allein nicht passt. Mit
		   `anywhere` stand «Beschlussfähigkei / t» in der Liste. */
		overflow-wrap: break-word;
	}

	/*
	 * **Schmal steht alles untereinander.** Zwischen Nummer und einer Marke
	 * («Kenntnisnahme» misst rund 7rem) blieben auf einem Telefon keine 9rem
	 * für den Titel — er brach dann mitten im Wort. Erst wenn die Liste breit
	 * genug ist, rückt der Stand nach rechts oben.
	 */
	.stand,
	.einordnung,
	.tat {
		grid-column: 2 / -1;
	}

	.stand:empty {
		display: none;
	}

	@container (min-width: 26rem) {
		.baum .zeile {
			grid-template-columns: var(--nr-spalte) minmax(0, 1fr) auto;
		}
		.stand {
			grid-column: 3;
			grid-row: 1;
			justify-self: end;
		}
	}

	.tat {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	/*
	 * **Das Feld darf die Zeile nicht sprengen.** Es steht zwischen «Aufrufen»
	 * und den übrigen Handlungen; zwei Ziffern genügen für vierzehn Traktanden,
	 * und das Wort davor sagt, was gemeint ist — die Stelle im Ablauf, nicht die
	 * Traktandennummer links.
	 */
	.stellenform {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/*
	 * **Feld und Knopf gleich hoch, mit Luft dazwischen** (UI-Durchgang
	 * 06.10.2026). Gemessen: «Setzen» 32 px neben einem 44 px hohen Feld und
	 * 4 px davon entfernt; `button.leise` setzt für die ganze Seite 2rem. Hier
	 * steht der Knopf neben einem Feld, also nimmt er dessen Höhe. Mit `.leise`
	 * im Selektor, sonst gewinnt die spätere Seitenregel bei gleichem Gewicht.
	 */
	.stellenform button.leise {
		min-height: var(--ziel-min);
	}

	.stellenform label {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.3rem;
		margin: 0;
		font-weight: 400;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.stellenform input[type='number'] {
		width: 3.6rem;
		min-height: var(--ziel-min);
		padding: 0.1rem 0.3rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.nummer {
		font-variant-numeric: tabular-nums;
		color: var(--text-leise);
		margin: 0;
	}

	/* Dieselbe Trennung wie `h3.abstand`: Linie und Luft zum Block darüber. */
	.nummer.abgesetzt {
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--linie);
	}

	/* Der Quorumstyp steht als Marke neben «Traktandum N». */
	.nummer .marke {
		margin-left: 0.5rem;
	}

	blockquote {
		margin: 0.5rem 0;
		padding: 0.6rem 0.9rem;
		border-left: 3px solid var(--akzent);
		background: var(--flaeche-2);
	}

	.offen {
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 10%, transparent);
		padding: 0.85rem 1rem;
		margin: 1rem 0;
	}

	.offeneNamen {
		margin: 0.2rem 0 0;
		color: var(--text-leise);
		font-size: 0.9375rem;
	}

	.fortschritt {
		font-size: 1.35rem;
		margin: 0.25rem 0;
		font-variant-numeric: tabular-nums;
	}

	/* Der Satz begründet den hervorgehobenen Knopf darunter — er steht dicht
	   dabei, nicht als eigene Meldung. */
	.vollzaehlig {
		margin: 0 0 0.4rem;
		font-weight: 550;
	}

	.erfassung {
		margin: 1rem 0;
	}

	/* Die Ausnahme steht zugeklappt und ruhig: In der geführten Betriebsart
	   stimmen die Eigentümer selbst. */
	.stellvertretend {
		margin: 1rem 0;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.5rem 0.8rem;
	}


	.fuerEine {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 0.6rem;
		max-width: 44rem;
	}



	.grundzeile {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 550;
		max-width: 44rem;
		margin-bottom: 0.75rem;
	}



	.ausgenommen {
		margin: 0.3rem 0;
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
	}








	.zahl {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.ergebnis {
		border: 1px solid var(--linie);
		border-left: 4px solid var(--fehler);
		border-radius: var(--radius);
		padding: 0.85rem 1rem;
		margin: 0.75rem 0;
	}

	.ergebnis.angenommen {
		border-left-color: var(--akzent);
	}

	.satz {
		font-weight: 550;
		margin: 0 0 0.5rem;
	}

	.zahlen {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.zahlen dt {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-leise);
	}

	.zahlen dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}


	.handlungen {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}

	details summary {
		cursor: pointer;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0.5rem 0;
		font-size: 0.9rem;
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
		display: block;
	}

	/*
	 * Die Feststellung sitzt direkt unter dem Balken, den sie festhält — mit
	 * einer Linie dazwischen, damit «laufende Rechnung» und «Befund» nicht als
	 * dasselbe gelesen werden.
	 */
	.festhalten {
		margin: 0.4rem 0 1rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--linie);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 0.75rem;
	}

	/*
	 * **Die ganze Zeile** (aus dem Code-Review, 11.09.2026): `.festhalten` ist ein
	 * Flex-Kasten, und ohne diese Angabe stünde der Ausklapper je nach
	 * Spaltenbreite neben dem Knopf — die Trennlinie liefe dann nur über die
	 * Breite seiner Zusammenfassung, und `max-width` am Formular griffe nie.
	 */
	.festhalten .vertagen {
		flex-basis: 100%;
		margin-top: 0.9rem;
		border-top: 1px solid var(--linie);
		padding-top: 0.7rem;
	}

	.festhalten .vertagen summary {
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--text-leise);
		min-height: var(--ziel-min);
		padding: 0.5rem 0;
	}

	/*
	 * Steht die Beschlussfähigkeit nicht, ist das Vertagen die wahrscheinlichste
	 * nächste Handlung — dann darf der Ausklapper nicht wie eine Randnotiz
	 * aussehen. Die Farbe sagt die Lage, nicht der Ausklapper die Farbe.
	 */
	.festhalten .vertagen.dringend summary {
		color: var(--text);
		font-weight: 600;
	}

	.festhalten .vertagen form {
		margin-top: 0.5rem;
		display: grid;
		gap: 0.5rem;
		max-width: var(--lesebreite);
	}

	.festhalten p {
		margin: 0;
		flex: 1 1 14rem;
	}

	.festhalten p.warnung {
		color: var(--warnung);
	}

	/*
	 * **Kein `white-space: nowrap`.** Die Marke neben «Traktandum N» trägt die
	 * Bezeichnung des Erfordernisses, und «Reglementsmehr der anwesenden oder
	 * vertretenen, ohne den Beklagten» stand am Telefon bei 390 px als eine
	 * Zeile 141 px über dem Rand (gemessen am 21.10.2026, `e2e/ausstand.mjs`
	 * Schritt 27). Kurze Marken bleiben einzeilig, weil sie in die Zeile passen.
	 */
	.marke {
		display: inline-block;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		font-size: 0.8rem;
	}

	.marke.gut {
		background: color-mix(in srgb, var(--akzent) 22%, transparent);
	}

	.marke.warnung {
		background: color-mix(in srgb, var(--warnung) 25%, transparent);
	}

	/*
	 * **Dieselbe Farbe wie der Kasten weiter unten.** Die Marke und der Kasten
	 * sagen dasselbe; sähen sie verschieden aus, müsste man den Zusammenhang
	 * erst herstellen. Sie ist ein Verweis und trägt deshalb die Zielgrösse
	 * eines Fingers, die `a.marke` weiter unten setzt.
	 */
	.marke.wartet {
		background: color-mix(in srgb, var(--warnung) 25%, transparent);
		font-weight: 600;
	}

	/* Als Verweis, aber in derselben Form — im Saal soll nichts neu wirken. */
	a.marke {
		color: inherit;
		text-decoration: underline;
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
	}

	/*
	 * **Kein `white-space: nowrap`.** Die Absicht war, «Einfaches Mehr» nicht
	 * mitten im Wort umbrechen zu lassen — getroffen hat es die langen
	 * Bezeichnungen: «Ausschuss, Revisionsstelle oder Verwaltung» stand als eine
	 * Zeile von 396 px und zog die ganze Seite am Telefon 61 px über den Rand
	 * (gemessen am 11.08.2026). Umbrechen darf er; `anywhere` fängt zusätzlich
	 * ein einzelnes langes Wort ab.
	 */
	.aendern {
		font-size: 0.8rem;
		color: var(--text-leise);
		overflow-wrap: anywhere;
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
	}

	.marke.leise {
		color: var(--text-leise);
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 1.1rem;
		border: none;
		border-radius: var(--radius);
		background: var(--flaeche-2);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}

	button.haupt {
		background: var(--akzent);
		color: var(--akzent-text);
		font-weight: 600;
	}

	button.leise {
		background: transparent;
		border: 1px solid var(--linie);
		font-size: 0.85rem;
		min-height: 2rem;
		padding: 0 0.6rem;
	}

	.meldung {
		padding: 0.7rem 0.95rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		margin: 0.75rem 0;
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 12%, transparent);
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.spontan {
		margin-top: 1rem;
		border-top: 1px solid var(--linie);
		padding-top: 0.75rem;
	}

	/* Steht dort, wo sonst ein Feld stünde, und sieht auch so aus — nur ohne
	   Bedienelement, weil es hier nichts zu entscheiden gibt. */
	.feststellung {
		margin: 0.1rem 0;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	input {
		font: inherit;
		padding: 0.45rem 0.5rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
	}

	/* Der Ausstand — selten, deshalb zugeklappt und leise. */
	/*
	 * **«Jetzt möglich»** — sichtbar, nicht dominant.
	 *
	 * Die Zeile steht immer da und trägt die Farbe des Fliesstexts, nicht die
	 * eines Knopfes: Sie ist ein Angebot, keine Aufforderung. Erst das geöffnete
	 * Feld bekommt eine Fläche — dann arbeitet man darin.
	 */
	.ausstandsstand {
		margin-top: 1.2rem;
		font-size: 0.9rem;
	}

	.standtitel {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.3rem;
	}















	.ausstandsliste {
		list-style: none;
		margin: 0.4rem 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.ausstandsliste li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
	}

	/*
	 * Die ruhenden Vollmachten stehen unmittelbar unter der Ausstandsliste und
	 * tragen deren Farbe: Sie sind deren Folge, keine zweite Meldung.
	 */
	.ruhend {
		margin: 0.4rem 0;
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
	}

	.ausstandsform {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}




	/*
	 * Die nötige Mehrheit trägt Gewicht, aber keine Farbe: Sie ist keine Warnung
	 * und kein Erfolg, sondern die Angabe, gegen die gleich gemessen wird.
	 */
	.noetig {
		font-weight: 600;
		margin: 0.35rem 0 0.15rem;
	}

	.leise {
		color: var(--text-leise);
	}
	/*
	 * Der Hinweis im Saal-Modus. Leise und ohne Warnfarbe: Er erklärt einen
	 * gewollten Zustand, meldet keinen Fehler.
	 */
	.codeweg {
		white-space: nowrap;
	}

	.saalhinweis {
		border-left: 3px solid var(--linie);
		margin: 0.75rem 0;
		max-width: 62ch;
		padding-left: 0.75rem;
	}
</style>
