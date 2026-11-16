<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { nachziehen } from '$lib/nachziehen';
	import { fruehesterZweitTermin, vertagenNeueErsteSatz, vertagenUeberschrift, vertagenZweiteNachLesartSatz, zustandsname } from '$lib/domain/versammlung';
	import { datumLang, uhrzeit } from '$lib/domain/datum';
	import Beamerfenster from '$lib/components/Beamerfenster.svelte';
	import Wandbild from '$lib/components/Wandbild.svelte';
	import VollmachtFuer from '$lib/components/VollmachtFuer.svelte';
	import { GRUNDFRAGE, grundhilfe, GRUNDHILFE_DRITTE, GRUNDWAHL, gleicheDrittePerson } from '$lib/domain/vollmacht';
	import { VERWALTUNG_HAKEN_HILFE_LEITUNG } from '$lib/domain/mehrhinweise';
	import Einlass from '$lib/components/Einlass.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Kartenscanner from '$lib/components/Kartenscanner.svelte';
	import Zeichen from '$lib/components/Zeichen.svelte';
	import Wahlliste from '$lib/components/Wahlliste.svelte';
	import { anfangswert, angekreuzt, gefuehrteWahl } from '$lib/felder';
	import { filtereNach } from '$lib/domain/listensuche';
	import { zeichenzahl } from '$lib/domain/zeichenzahl';
	import Meldung from '$lib/components/Meldung.svelte';
	import Papierentscheid from '$lib/components/Papierentscheid.svelte';
	import Codefenster from '$lib/components/Codefenster.svelte';
	import Saaleinstieg from '$lib/components/Saaleinstieg.svelte';

	let { data, form } = $props();

	const v = $derived(data.versammlung);
	const u = $derived(data.uebersicht);
	const laufend = $derived(v.zustand === 'laufend');
	/** Wer auf Papier abstimmt — als Menge, weil je Zeile danach gefragt wird. */
	const aufPapier = $derived(new Set(data.aufPapier));

	/**
	 * Was das Erfassen von Hand für diese Zeile bedeutet.
	 *
	 * Steht als Funktion da, weil die Zeile seit der Papierfrage zwei Rückfragen
	 * trägt und beide denselben ersten Satz brauchen. Zweimal geschrieben liefen
	 * sie beim nächsten Wortwechsel auseinander.
	 */
	function anwesendfolge(s: { einheiten: string[] }): string {
		return s.einheiten.length > 0
			? `${s.einheiten.join(', ')} — die Partei zählt danach für die Beschlussfähigkeit mit.`
			: 'Die Partei zählt danach für die Beschlussfähigkeit mit.';
	}

	/**
	 * Das Fenster mit dem Ausgabecode.
	 *
	 * `showModal` statt des `open`-Merkmals: Nur so liegt es über allem, fängt
	 * die Tastatur und lässt sich nicht durch einen Klick daneben verlieren. Der
	 * Code erscheint genau einmal — wer ihn beim Vorlesen verliert, muss einen
	 * neuen ausgeben und dabei den vorigen entwerten.
	 */
	/**
	 * Der Einlass am Eingang: scannen, hinsehen, erfassen.
	 *
	 * **Warum ein Zwischenschritt.** Gewünscht am 20.08.2026: «QR-Scannen, dann
	 * gleicht der QR den Inhalt mit der DB ab und zeigt mir dies zur Kontrolle an
	 * und ich kann annehmen oder ablehnen.» Der Scanner meldet nur den Code; die
	 * Seite schlägt ihn nach (`?/pruefen`, das **nichts** schreibt) und legt das
	 * Ergebnis hin. Erst der Klick auf «Als anwesend erfassen» erzeugt einen
	 * Eintrag — der Verlauf ist nur anfügbar (AD-5), ein Eintritt lässt sich
	 * nicht zurücknehmen.
	 */
	let scanfeld = $state<HTMLInputElement | null>(null);
	// Der Grund in den beiden Einlassformularen, geführt, damit die Beschriftung
	// des Nachweises ihm folgt (Produktentscheid 03.11.2026).
	let grundEinlass = $state('');
	let grundDritte = $state('');
	// Der Name im Formular «Bevollmächtigte dritte Person»; er gibt vorab
	// erfasste Vollmachten auf denselben Namen frei (E3, 11.11.2026).
	let nameDritte = $state('');
	// Ob der Name schon eine Vollmacht mit dem Häkchen «Verwaltung» trägt; dann
	// ist das Kästchen vorbelegt und folgt dem Namen, bis jemand es umstellt.
	const verwaltungVorbelegt = $derived(
		data.drittePersonen.some((d) => d.istVerwaltung && gleicheDrittePerson(d.name, nameDritte))
	);
	let verwaltungDritte = $state(false);
	$effect(() => {
		verwaltungDritte = verwaltungVorbelegt;
	});
	let scanformular = $state<HTMLFormElement | null>(null);
	let weggelegt = $state(false);

	/**
	 * Was zur Kontrolle dasteht — aus dem Scanner oder aus der Kamera-App.
	 *
	 * Beide Wege enden hier: Der Keks von `/z/<CODE>` füllt `data.gescannt`, der
	 * Scanner im Fenster `form.geprueft`. Eine Karte, zwei Herkünfte; hätte jede
	 * ihre eigene, liefen sie auseinander.
	 */
	const rohkontrolle = $derived(
		(form && 'geprueft' in form ? form.geprueft : null) ?? data.gescannt ?? null
	);
	const kontrolle = $derived(weggelegt ? null : rohkontrolle);

	function scanne(inhalt: string) {
		if (!scanfeld || !scanformular) return;
		scanfeld.value = inhalt;
		scanformular.requestSubmit();
	}

	/**
	 * Nach dem Nachschlagen: Die Karte ist neu, also ist sie nicht weggelegt.
	 *
	 * **Und die Karte ins Blickfeld holen.** Der Scanner steht weiter unten als
	 * die Karte; wer in die Kamera schaut, sieht sonst nicht, dass oben eine
	 * Antwort steht. `absenden()` tauscht nur die Daten aus und rollt von sich
	 * aus nirgendwohin — ausser einer Absage, die sich selbst ins Bild holt.
	 *
	 * `danach` und nicht `beiErfolg`: Der Scan kann auch mit einer Absage enden
	 * («Code abgelaufen»), und dann ist die Karte erst recht nicht weggelegt.
	 */
	const nachPruefung = absenden({
		reset: false,
		danach: async () => {
			weggelegt = false;
			// **Erst zeichnen lassen, dann suchen.** Die Karte hängt an `weggelegt`;
			// wer sie im selben Zug sucht, findet nichts (28.08.2026 gefunden).
			await tick();
			document.getElementById('gescannt')?.scrollIntoView({ block: 'center' });
		}
	});

	/** Nach dem Erfassen ist die Karte erledigt; der Nächste zeigt eine andere. */
	const nachEinlass = absenden({
		danach: () => {
			weggelegt = false;
		}
	});

	/**
	 * Weglegen, ohne etwas zu erfassen.
	 *
	 * Der Scanner bleibt dabei auf diesen Code gesperrt, bis die Karte einmal aus
	 * dem Bild war — sonst stünde sie im nächsten Durchgang sofort wieder da.
	 */
	function verwerfen() {
		weggelegt = true;
	}

	/**
	 * Die Rückfragen stehen in `Rueckfrage.svelte`, nicht mehr in `confirm()`.
	 *
	 * Nicht des Aussehens wegen: Auf einem Formular mit `use:enhance` bricht ein
	 * `confirm()` mit `preventDefault()` **nicht** ab — abgeschickt wurde trotzdem
	 * (gemeldet am 20.08.2026, Ursache in der Komponente aufgeschrieben).
	 */

	/**
	 * Wer sich anmeldet, erscheint von selbst — ohne Nachladen von Hand.
	 *
	 * **Warum das hier zählt.** Am Eingang steht jemand mit dem Telefon in der
	 * Hand und wartet auf die Freigabe. Bis zum 20.08.2026 sah die
	 * Sitzungsleitung ihn erst, wenn sie die Seite neu lud — sie musste also
	 * raten, wann es sich lohnt. Gemeldet vom Auftraggeber beim ersten Durchgang mit dem
	 * eigenen Konto.
	 *
	 * **Über den bestehenden Strom, und der trägt keine Namen** (AD-11): Er
	 * meldet nur, dass sich die Zahl der Wartenden oder der Anwesenden geändert
	 * hat. Wer das ist, holt die Seite über ihren eigenen, angemeldeten Loader —
	 * dieselben Daten wie beim Nachladen von Hand.
	 *
	 * `invalidateAll` und nicht `location.reload()`: Die Formulare dieser Seite
	 * senden als echte Navigation, und die eigene Freigabe löst denselben
	 * Zustandswechsel aus. Ein Reload träfe die noch laufende POST-Navigation
	 * und bräche sie ab — die Lehre aus den Durchspiel-Läufen vom 14./15.08.
	 */
	let letzterStand = $state<{ wartend: number; anwesend: number; saal: number } | null>(null);

	$effect(() => {
		if (v.zustand !== 'laufend' && v.zustand !== 'freigegeben') return;
		/*
		 * **Nicht nachladen, während ein Formular die Seite ohnehin ersetzt**
		 * (21.08.2026). Die Formulare dieser Seite senden als echte Navigation,
		 * und die eigene Handlung — jemanden einlassen, eine Vollmacht
		 * widerrufen — löst genau den Wechsel aus, auf den hier reagiert wird.
		 * Der Datenabruf, den der Seitenwechsel abreisst, stand als «Failed to
		 * fetch» in der Konsole: zweimal je Durchlauf, reproduzierbar.
		 */
		/*
		 * **Nicht nachladen, während am Eingang jemand ausfüllt** (21.08.2026).
		 *
		 * «Ohne Karte einlassen» und «Bevollmächtigte dritte Person» sind
		 * mehrschrittig: Partei wählen, Vollmachten ankreuzen, Nachweis
		 * bestätigen. Trifft dazwischen jemand ein, meldet es der Strom — und der
		 * Nachzug rendert die Listen neu und nimmt die halbfertige Eingabe mit.
		 * Abgeschickt wurde dann eine leere Partei.
		 *
		 * Geprüft wird am offenen `details`, nicht am Fokus: Wer zwischendurch
		 * zum Papier greift, hat keinen Fokus im Formular und soll trotzdem in
		 * Ruhe gelassen werden.
		 */
		const nach = nachziehen({
			nichtWaehrend: () =>
				document.querySelector('details.vonhand[open], details.dritte[open]') !== null
		});
		const quelle = new EventSource(`/versammlungen/${v.id}/strom`);
		quelle.onmessage = (e) => {
			const neu = JSON.parse(e.data);
			untrack(() => {
				const jetzt = {
					wartend: neu.wartend ?? 0,
					anwesend: neu.anzahlAnwesend ?? 0,
					// Der QR auf der Leinwand führt in dieselbe Warteschlange, nur über
					// eine andere Tür. Ohne diese Zahl erschiene, wer sich dort meldet,
					// erst beim nächsten Nachladen.
					saal: neu.saalmeldungen ?? 0
				};
				const vorher = letzterStand;
				letzterStand = jetzt;
				// Der erste Beitrag ist der volle Stand und keine Änderung — sonst
				// lüde die Seite beim Öffnen sofort ein zweites Mal.
				if (!vorher) return;
				if (
					vorher.wartend !== jetzt.wartend ||
					vorher.anwesend !== jetzt.anwesend ||
					vorher.saal !== jetzt.saal
				) {
					nach.jetzt();
				}
			});
		};
		return () => {
			quelle.close();
			nach.ende();
		};
	});

	/**
	 * Der ausgegebene Code — **eine eigene Kopie**, nicht `form.ausgabe`.
	 *
	 * **Der Fehler, den das behebt** (gefunden am 21.08.2026 im Durchlauf, dort
	 * als sprunghaft gescheiterter Schritt 20 «Kein Ausgabecode erschienen»).
	 *
	 * Diese Seite hört am Ereignisstrom und lädt nach, sobald sich im Saal etwas
	 * ändert. Das Ausgeben eines Codes ist so eine Änderung — es ruft selbst
	 * `verkuendeStand`. Trifft das eigene Ereignis ein, nachdem die neue Seite
	 * steht, läuft `invalidateAll()`, und **`form` wird dabei geleert**. Der
	 * Dialog verschwand mitten im Vorlesen.
	 *
	 * Das ist kein Schönheitsfehler: «Er erscheint **nur jetzt** — danach steht
	 * in der Datenbank nur sein Prüfwert.» Ein weggeflogener Dialog heisst, dass
	 * die Person einen neuen Code braucht.
	 *
	 * **Der Anfangswert kommt aus `form`, nicht aus dem Effekt.** Sonst stünde der
	 * Dialog erst nach der Hydration im DOM — beim Rendern auf dem Server wäre er
	 * nicht da, und wer die Seite ohne JavaScript bedient, sähe seinen Code nie.
	 *
	 * `$state.raw`, weil nur ersetzt und nie im Inneren geändert wird.
	 */
	// svelte-ignore state_referenced_locally
	// Der Anfangswert ist hier genau das Gewollte: Was der Server mitgeschickt
	// hat, steht sofort im DOM. Was danach kommt, trägt der Effekt nach.
	let ausgabe = $state.raw<{
		code: string;
		name: string;
		gueltigBis: string;
		adresse: string;
		svg: string;
	} | null>(
		form?.ausgabe ?? null
	);
	$effect(() => {
		if (form?.ausgabe) ausgabe = form.ausgabe;
	});


	/**
	 * In der einfachen Betriebsart ist die Häkchenliste von Anfang an offen.
	 *
	 * Dort gibt es keine Zugangskarten und keinen Scanner — sie ist der einzige
	 * Weg, die Anwesenheit zu erfassen. Sie hinter einem Umschalter zu verstecken
	 * kostet im Saal einen Handgriff für nichts. In der geführten Betriebsart
	 * bleibt sie zu, weil dort der Regelfall der Scanner am Eingang ist.
	 */
	// `untrack`, weil nur der Anfangswert gemeint ist: Wer die Liste zuklappt,
	// soll sie zugeklappt behalten.
	let listenmodus = $state(untrack(() => v.betriebsart === 'einfach'));

	/**
	 * Wer beim Einlassen von Hand gewählt ist.
	 *
	 * Geführt und nicht dem DOM überlassen: Die Seite lädt bei jedem Ereignis im
	 * Saal nach, und ein ungesteuertes Feld verlöre dabei seine Auswahl.
	 *
	 * Als Liste, weil `Wahlliste` mehrere zulässt und hier `mehrfach={false}`
	 * steht — der eine Eintrag ist der gewählte.
	 */
	let werTrifftEinListe = $state<string[]>([]);
	const gewaehltePartei = $derived(
		werTrifftEinListe.length > 0
			? data.vertretbare.find((v) => v.parteiId === werTrifftEinListe[0])
			: null
	);

	/* Die Schnellsuche über die Liste — im Browser, weil alle Parteien auf der
	   Seite stehen. */
	let suche = $state('');
	const gefiltert = $derived(
		filtereNach(u?.staende ?? [], suche, (s) => `${s.name} ${s.einheiten.join(' ')}`)
	);

	// Die Formatierung steht im Kern (`domain/datum.ts`), seit der Einlass eine
	// eigene Komponente hat: Zwei Fassungen zeigten dieselbe Ankunft verschieden.
	const zeit = uhrzeit;
</script>

<div class="kopf">
	<h1>Anwesenheit</h1>
	<span class="zustand" data-zustand={v.zustand}>{zustandsname(v.zustand)}</span>
</div>

<!--
	**Eröffnen von hier aus.**

	Wer am Eingang steht, steht im Prozessschritt «Anwesenheit» — und dort fällt
	auch der Entscheid, wann eröffnet wird. Der Knopf lag bisher nur auf der
	Versammlungsseite, also einen Wechsel entfernt, im ungünstigsten Moment.
-->
{#if v.zustand === 'freigegeben'}
	<section class="eroeffnen">
		<h2>Versammlung eröffnen</h2>
		<p class="lesebreite">
			Ab der Eröffnung zählt die Anwesenheit, und es kann abgestimmt werden. Die
			Beschlussfähigkeit muss dafür nicht erreicht sein — fehlt sie, verlangt jedes
			Traktandum eine ausdrückliche Bestätigung, und der Vermerk geht in den Verlauf.
		</p>
		{#if form?.eroeffnungsfrage}
			<div class="meldung frage" role="alert">
				<p>{form.eroeffnungsfrage}</p>
				<form method="POST" action="?/eroeffnen" class="knoepfe">
					<input type="hidden" name="bestaetigt" value="ja" />
					<button type="submit" class="haupt">Jetzt eröffnen</button>
					<a href="/versammlungen/{v.id}/anwesenheit">Doch nicht</a>
				</form>
			</div>
		{:else}
			<form method="POST" action="?/eroeffnen">
				<button type="submit" class="haupt">Eröffnen</button>
			</form>
		{/if}
	</section>
{/if}

<!--
	**Ein Fenster, das geschlossen werden muss.**

	Der Code stand bisher als Abschnitt oben auf der Seite und verschwand beim
	nächsten Klick — mitten im Vorlesen. Er erscheint nur **einmal**: Danach steht
	in der Datenbank nur sein Prüfwert, und was hier weg ist, ist weg. Wer ihn am
	Eingang vorliest, während zehn Leute warten, darf ihn nicht dadurch verlieren,
	dass jemand daneben eine Anwesenheit bestätigt.

	Deshalb ein echtes `dialog` mit `showModal`: Es liegt über allem, nimmt die
	Tastatur an sich und geht erst weg, wenn die Sitzungsleitung es schliesst.
-->
<!--
	**Der Code als eigenes Fenster** — derselbe Baustein wie am gemeinsamen Abend
	(24.08.2026). Wer einen Code am Eingang vorliest, während zehn Leute warten,
	darf ihn nicht dadurch verlieren, dass jemand daneben eine Anwesenheit
	bestätigt.
-->
<Codefenster
	{ausgabe}
	einstiegAdresse={data.einstiegAdresse}
	beimSchliessen={() => (ausgabe = null)}
/>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.bestaetigt}
	<Meldung ton="gut" marke={form}>{form.bestaetigt}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

<!-- Derselbe Kasten wie auf der schmalen Einlass-Seite. Zwei Abschriften
     liefen auseinander, und dann gäbe der eine Eingang fünf Sekunden und der
     andere sieben — an derselben Handlung. -->
<Papierentscheid papier={form && 'papier' in form ? form.papier : null} />

{#if !u}
	<p class="meldung warnung">
		Für diese Versammlung steht noch nicht fest, wer stimmberechtigt ist. Geben Sie sie zuerst frei.
		<a href="/versammlungen/{v.id}/freigabe">Zur Freigabe</a>
	</p>
{:else}
	<!-- ── Beschlussfähigkeit, dauerhaft sichtbar ──────────────────────────── -->
	{#if data.beschlussfaehigkeit}
		{@const b = data.beschlussfaehigkeit}
		<!--
			**Eine Zeile, volle Breite** (20.08.2026, gemeldet als «Die
			Beschlussfähigkeit steht noch quer im Raum … Die Lücke ist unschön»).

			Der Kasten stand auf 46rem und endete damit bei 736 px, während das
			Wandbild darüber und die Liste darunter 1265 px nutzten — eine Lücke von
			529 px, im Browser nachgemessen. Dazu fünf Zeilen Höhe für zwei Zahlen.
			Jetzt: Marke, Köpfe und Wertquoten nebeneinander, die Grundlage darunter.
			Auf schmalen Schirmen bricht die Zeile um, statt sich zu stauchen.
		-->
		<section class="quorum" class:ja={b.beschlussfaehig}>
			<p class="marke">{b.beschlussfaehig ? 'Beschlussfähig' : 'Nicht beschlussfähig'}</p>
			<ul>
				{#each b.bedingungen as bed (bed.bezeichnung)}
					<li class:erfuellt={bed.erfuellt}>
						<span aria-hidden="true">{bed.erfuellt ? '✓' : '✗'}</span>
						{bed.bezeichnung}: <strong>{bed.vorhanden}</strong>, mindestens {bed.noetig} nötig
					</li>
				{/each}
			</ul>
			<p class="klein grundlage">
				{u.anzahlAnwesend} von {u.anzahlGesamt} Parteien anwesend ·
				{b.grundlage === 'reglement'
					? `Regel dieser Gemeinschaft (${b.fundstelle})`
					: v.stufe === 'zweite'
						? 'ZGB Art. 712p Abs. 3'
						: 'ZGB Art. 712p Abs. 1'}
			</p>
			{#if !b.beschlussfaehig && v.stufe === 'erste'}
				<p class="klein grundlage">{data.fristhinweis}</p>
			{/if}
			<!--
				**Was hier steht, ist eine laufende Rechnung, keine Feststellung**
				(Vorgabe des Auftraggebers, 11.09.2026: «Grundsätzlich gehört die Feststellung in das
				Traktandum 1 und nicht in Anwesenheit und Beschlussfähigkeit. Grund: es
				muss protokolliert werden»).

				Sie ist es auch schon: Festgehalten wird beim Traktandum, das die
				Beschlussfähigkeit zum Gegenstand hat, und das Protokoll setzt den
				Eintrag unter genau dieses Traktandum. Nur sagte es hier niemand — und
				ein Kasten, der die Zahlen prominent zeigt, sieht aus wie der Ort, an
				dem sie festgehalten werden.

				Der Kasten bleibt: Am Eingang muss man sehen, ob man anfangen kann.
			-->
			{#if laufend}
				<p class="klein grundlage">
					Das ist der Stand von jetzt, und er ändert sich mit jedem, der kommt oder
					geht. <a href="/versammlungen/{v.id}/leitung">Festgehalten wird beim Traktandum</a>,
					das die Beschlussfähigkeit feststellt. Ohne Feststellung nennt das Protokoll
					die Zahlen vom Zeitpunkt seiner Erstellung und sagt, dass sie nachzutragen
					sind.
				</p>
			{/if}
		</section>
	{/if}

	{#if laufend && v.stufe === 'erste'}
			<!--
				**Aus dem Hinweis führt jetzt ein Weg** (Auftraggeber, 25.08.2026: «Die
				anderen brauchen einen neuen Termin, frühestens in 10 Tage später»).
			
				Bis hierher stand der Satz allein da. Wer die zweite Versammlung
				wollte, legte sie von Hand an — und `/versammlungen/neu` bietet
				Stufe und Vorgängerin gar nicht an. Dann sieht die zweite aus wie
				eine erste, und die Anwendung verlangt ein Quorum, das ZGB 712p
				Abs. 3 für sie nicht mehr verlangt.
			
				Zugeklappt, weil es die Ausnahme ist — und weil «vertagen» kein
				Knopf sein soll, den man aus Versehen trifft.
			-->
			<details class="vertagen">
				<summary>{vertagenUeberschrift(data.zeitweiseBeschlussfaehig, data.vertagung)}</summary>
				<form method="POST" action="?/vertagen">
					<!-- L16 (Migration 194): schon beschlussfähig und «Zweite Versammlung» gewählt. -->
					{#if data.zeitweiseBeschlussfaehig && data.vertagung === 'zweite'}
						<p class="klein">
							{vertagenZweiteNachLesartSatz(
								datumLang(fruehesterZweitTermin(v.datum, data.gemeinschaft?.zweitversammlungsfristTage))
							)}
						</p>
					{:else if data.zeitweiseBeschlussfaehig}
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
							)}.
							Alles davon lässt sich danach ändern.
						</p>
					{/if}
					<label>
						Warum vertagt wird
						<select name="grund" required>
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
							sich danach, ob die Versammlung heute beschlussfähig war. Ist sie es nicht mehr,
							zählt auch, wie die Gemeinschaft die Lesart L16 eingestellt hat.
						</span>
					</label>
					<button type="submit">Vertagen</button>
				</form>
			</details>
	{/if}

	{#if !laufend}
		<p class="meldung">
			{v.zustand === 'freigegeben'
				? 'Die Versammlung ist noch nicht eröffnet — die Anwesenheit zählt erst ab der Eröffnung.'
				: 'Die Versammlung läuft nicht mehr. Die Anwesenheit steht fest.'}
		</p>
	{/if}

	<!--
		**Der Einlass steht in einer Komponente**, seit ihn auch die
		Sitzungsleitung zeigt (20.08.2026, gemeldet vom Auftraggeber: «Ich müsste dort
		irgendwo sehen, ob es noch Anmeldungen gibt … die Überlegung war, nicht
		hin und her zu wechseln»). Zwei Abschriften desselben Kastens hätten sich
		auseinanderentwickelt; hier ist es derselbe.
	-->
	<!--
		**Hier steht der Wartende weiterhin im Kasten, auch wenn seine Karte oben
		liegt** (Vorgabe des Auftraggebers, 11.09.2026). Der orange Kasten ist die Liste derer,
		die sich angemeldet haben; dass eine gescannte Person dort auftaucht, ist
		gewollt. Auf der schmalen Scan-Ansicht fürs Telefon ist dieselbe Zeile
		Lärm — dort und nur dort wird sie weggelassen, siehe `ohneKontrollkarte`.
	-->
	<Einlass
		wartende={u.staende
			.filter((s) => s.zustand === 'wartet')
			.map((s) => ({
				parteiId: s.parteiId,
				name: s.name,
				einheiten: s.einheiten,
				papierfrage: data.papierfrage
			}))}
		saalmeldungen={data.saalmeldungen.map((m) => ({ ...m, papierfrage: data.papierfrage }))}
		parteien={u.staende.map((s) => ({
			parteiId: s.parteiId,
			name: s.name,
			zustand: s.zustand,
			seit: s.seit
		}))}
		{laufend}
	/>

	<!--
		**Kein Traktandenaufruf am Eingang.**

		Hier stand ein zweites Feld zum Aufrufen eines Traktandums, damit man am
		Eingang das Bild an der Wand wechseln kann. Gemeldet am 02.08.2026:
		«Aufgerufenes Traktandum wird nicht benötigt.» Es ist auch die zweite
		Stelle für dieselbe Handlung gewesen — die Sitzungsleitung führt die
		Traktanden, der Eingang zählt die Anwesenden.
	-->

	<!--
		**Eine eben gescannte Karte.**

		Die Kamera-App führt auf `/z/<CODE>`, und weil hier eine Sitzungsleitung
		angemeldet ist, wurde der Zugang **nicht** eingelöst — er bleibt dem
		Eigentümer. Stattdessen steht seine Karte hier und wartet auf einen Tipp.

		Ganz oben und gross, weil es das Einzige ist, was in diesem Augenblick
		zählt: Jemand steht am Eingang und hält sein Telefon hin.
	-->
	{#if kontrolle}
		<!--
			**Die Sprungmarke ist kein Zierrat.** Wer mit der Kamera-App des Telefons
			scannt, landet über `/z/<CODE>` auf dieser Seite — und die Karte stand
			935 px unter dem Seitenanfang, im Bild, aber ungesehen (20.08.2026
			nachgemessen). Ohne Marke sieht es aus, als sei nichts passiert.
		-->
		<section class="gescannt" id="gescannt">
			<p class="woher">Karte gescannt · zur Kontrolle</p>
			<h2>{kontrolle.name}</h2>
			<p class="einheiten">{kontrolle.einheiten.join(' · ')}</p>
			<!--
				**Die Stimmkraft gehört auf die Karte** (Auftraggeber, 20.08.2026: «müsste
				angezeigt werden, wer er ist, WQ und ob man einlässt oder nicht»).
				Wer hier tippt, entscheidet über ein Gewicht — ohne die Zahl steht
				dort nur ein Name, und der sagt nicht, was er wiegt.

				Derselbe Wortlaut wie auf der Seite des Eigentümers: Wenn beide auf
				dieselbe Karte schauen, sollen sie dasselbe lesen.
			-->
			<p class="stimmkraft">
				{kontrolle.kopfstimmen}
				{kontrolle.kopfstimmen === 1 ? 'Kopfstimme' : 'Kopfstimmen'} ·
				{kontrolle.wertquote} von {kontrolle.gesamtquote} Wertquoten
			</p>
			{#if kontrolle.schonAnwesend}
				<!--
					**Der wichtigste Satz auf dieser Karte.** Wer schon drin ist und
					nochmals gescannt wird, ist entweder verwechselt oder war schon da.
					Beides muss die Sitzungsleitung sehen, bevor sie tippt.
				-->
				<p class="schonda">
					Bereits als anwesend erfasst{#if kontrolle.seit}, seit {zeit(kontrolle.seit)}{/if}. Ein
					zweiter Eintrag entsteht nicht.
				</p>
			{/if}
			{#if kontrolle.wartetSchon}
				<!--
					**Die Karte und der orange Kasten meinen dieselbe Person**
					(11.09.2026, vom Auftraggeber im Eingangstest gefunden). Wer seinen QR selbst
					abgescannt hat, wartet schon; wird dann am Tisch dieselbe Karte
					gescannt, standen hier oben und unten zwei Kacheln mit je eigenem
					Knopfpaar, und keine sagte etwas von der anderen.

					**Beide bleiben stehen** (Vorgabe des Auftraggebers): In der Laptopsicht ist der
					orange Kasten die Liste, die man abarbeitet, und ein gescannter
					Eintrag gehört dort hinein. Was fehlte, war der Satz — dass es
					dieselbe Anmeldung ist und ein Druck genügt.
				-->
				<p class="schonda">
					Hat sich schon selbst angemeldet und wartet auf die Freigabe — dieselbe Person wie im
					Kasten «Am Eingang». Was Sie hier drücken, gibt genau diese Anmeldung frei.
				</p>
			{/if}
			{#if kontrolle.aufPapier}
				<p class="aufpapier">
					<strong>Stimmt an dieser Versammlung von Hand ab.</strong> Die Sitzungsleitung überträgt
					die Stimmen, das Telefon dieser Partei stimmt nicht mit.
				</p>
				<form method="POST" action="?/papierZuruecknehmen" class="zuruecknehmen">
					<input type="hidden" name="partei" value={kontrolle.parteiId} />
					<button type="submit" class="handlung">Vermerk zurücknehmen</button>
				</form>
			{/if}
			<form
				method="POST"
				action="?/einlassen"
				enctype="multipart/form-data"
				use:enhance={nachEinlass}
			>
				<input type="hidden" name="partei" value={kontrolle.parteiId} />
				<input type="hidden" name="weg" value="gescannt" />
				<VollmachtFuer vertretbare={data.vertretbare} />
				<span class="entscheid">
					{#if data.papierfrage}
						<!--
							**Enter darf hier nichts erraten.** Die beiden Knöpfe sind die Frage;
							ein Vorgabeknopf machte aus einem Tastendruck die Antwort «digital»,
							und genau die soll niemand ungefragt geben. Der Platzhalter steht
							INNERHALB des Zweiges: Ist die Frage aus, bleibt es beim einen Knopf
							und bei dem Verhalten, das er bisher hatte.
						-->
						<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
						<!-- Wortgleich zur schmalen Einlass-Seite: zwei Knöpfe, keiner
						     vorbelegt. Dort steht, warum. -->
						<button type="submit" name="papier" value="nein" class="haupt">
							Erfassen, stimmt digital
						</button>
						<button type="submit" name="papier" value="ja" class="haupt vonhand">
							Erfassen, stimmt von Hand
						</button>
					{:else}
						<button type="submit" class="haupt">Als anwesend erfassen</button>
					{/if}
					<!-- Ablehnen heisst hier: weglegen. Es entsteht kein Eintrag, weil
					     keiner entstanden ist — es gibt nichts zurückzunehmen. -->
					<button type="button" class="handlung" data-ton="fehler" onclick={verwerfen}>
						Verwerfen
					</button>
				</span>
			</form>
		</section>
	{/if}

	<!-- ── Check-in ────────────────────────────────────────────────────────── -->
	{#if laufend}
		<section class="checkin" id="einlass">
			<h2>Karte scannen oder Code eintippen</h2>

			<!--
				**Das unsichtbare Formular ist der Weg vom Sucher zum Server.** Der
				Scanner meldet eine Zeichenkette; hier wird sie nachgeschlagen, ohne
				die Seite zu wechseln und ohne die Kamera zu schliessen.
			-->
			<form
				method="POST"
				action="?/pruefen"
				bind:this={scanformular}
				use:enhance={nachPruefung}
				hidden
			>
				<input type="hidden" name="code" bind:this={scanfeld} />
			</form>
			<Kartenscanner beiFund={scanne} angehalten={kontrolle !== null} />

			<form method="POST" action="?/pruefen" class="zeile">
				<label>
					<span class="nurLeser">Zugangscode</span>
					<input
						name="code"
						placeholder="ABCD-EFGH-JKMN-PQRS-TWXY"
						autocomplete="off"
						autocapitalize="characters"
						spellcheck="false"
					/>
				</label>
				<button type="submit">Nachschlagen</button>
			</form>
			<p class="klein">
				<strong>Nachschlagen erfasst noch nichts</strong> — es zeigt Ihnen, wer dahintersteckt,
				und Sie entscheiden. Drei Wege führen zur selben Karte:
			</p>
			<ul>
				<li>die Kamera oben</li>
				<li>ein Handscanner, der wie eine Tastatur tippt — Feld anklicken, scannen, fertig</li>
				<li>die Kamera-App des Telefons: Sie öffnet den Link der Zugangskarte direkt</li>
			</ul>
			<p class="klein">
				Mit dem Telefon landen Sie dabei auf der
				<a href="/versammlungen/{v.id}/einlass">schmalen Einlass-Seite</a> — dort steht nur, was
				am Eingang zählt.
			</p>

			<!--
				**Diese Seite auf das eigene Telefon holen** (Wunsch des Auftraggebers, 20.08.2026).

				Wer am Eingang steht, will mit dem Telefon scannen — dafür muss diese
				Seite dort offen sein, und die Adresse abzutippen ist im Saal die
				schlechteste aller Möglichkeiten.

				**Der Code trägt keinen Zugang**, nur die Adresse: Wer ihn scannt, muss
				sich anmelden wie überall sonst. Deshalb darf er auf einem Bildschirm
				stehen, den andere sehen. Zugeklappt, weil er nur einmal gebraucht wird
				— am Anfang des Abends.
			-->
			<!--
				**Der Saaleinstieg zum Hinhalten** (Auftraggeber, 24.08.2026). Der QR auf der
				Leinwand ist über eine Fernsitzung kaum zu scannen; dieser steht direkt
				vor der Person, die hereinkommt.
			-->
			<Saaleinstieg svg={data.saaleinstieg?.svg ?? null} adresse={data.saaleinstieg?.adresse ?? null} />

			<details class="quicklink">
				<summary>Einlass auf dem Telefon öffnen</summary>
				<div class="qr">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html data.quicklink.svg}
					<div class="wohin">
						<p class="klein">
							Mit der Kamera-App des Telefons scannen. Sie landen auf der <strong>schmalen
							Einlass-Seite</strong>: scannen, sehen wer davorsteht, einlassen — sonst nichts.
							Anmelden müssen Sie sich dort wie überall; der Code ist eine Adresse, kein
							Schlüssel.
						</p>
						<!--
							**Der Link daneben, weil der Code sich nicht selbst scannt.**

							Gemeldet am 20.08.2026 mit einem Bildschirmfoto vom Telefon: «Und es
							braucht hier noch einen Link, wenn man auf dem Mobiltelefon ist.» Wer
							die Seite bereits auf dem Telefon offen hat, kann den QR-Code nicht
							brauchen — er bräuchte ein zweites Gerät, um auf das erste zu kommen.

							Beides steht nebeneinander statt nach Gerät geraten: Welches Gerät
							gerade davor sitzt, weiss die Seite nicht, und eine falsche Vermutung
							nähme genau den Weg weg, den jemand sucht.
						-->
						<p class="adresse klein">
							<a href={data.quicklink.url}>{data.quicklink.url}</a>
						</p>
					</div>
				</div>
			</details>

			<!--
				**Einlass ohne Karte, mit Vollmachten in einem Zug.**

				Für die Person, die ohne Code kommt und Blätter mitbringt. Der Weg
				über die Vollmachtsseite hiesse: einlassen, Seite wechseln, je
				Vollmacht dreimal tippen, zurückwechseln — mit der Schlange im Rücken.
			-->
			<details class="vonhand">
				<summary>Ohne Karte einlassen, mit oder ohne Vollmacht</summary>
				<form method="POST" action="?/einlassen" enctype="multipart/form-data">
					<input type="hidden" name="weg" value="von_hand" />
					<label class="wer">
						Wer trifft ein
						<!--
							Auch hier alle, aber Anwesende gesperrt und benannt: «Warum steht
							Christen nicht in der Liste» ist eine Frage, die im Saal niemand
							beantworten will.
						-->
						<!--
							**`bind:value` mit `$state`, nicht ungesteuert** (21.08.2026).

							Diese Seite lädt nach, sobald sich im Saal etwas ändert — jemand
							trifft ein, eine Vollmacht wird erfasst. Dabei rendert Svelte die
							Optionsliste neu, und ein ungesteuertes `select` verliert seine
							Auswahl: Abgeschickt wurde dann eine leere Partei. Bis heute
							scheiterte das mit «500 Internal Error» (`''` ist keine uuid), jetzt
							mit einer Absage — aber beides ist am Eingang gleich unbrauchbar.

							Der Fall ist nicht theoretisch: Am Eingang steht man selten allein,
							und genau dann kommen Ereignisse herein. Nachgestellt im Durchlauf,
							dort scheiterte Schritt 26 reproduzierbar.

							Das ist derselbe Grund, aus dem `felder.ts` für programmgeführte
							Felder `bind:value` mit `$state` verlangt.
						-->
						<!--
							**Der Wert reist im versteckten Feld, nicht im `select`** (21.08.2026).

							Gemessen im Durchlauf: Beim Abschicken stand im Auswahlfeld die
							richtige Partei (`selectedIndex 2`, Wert gesetzt, nicht gesperrt) —
							und im gesendeten Formular fehlte `partei` ganz. Der Server bekam
							eine leere Kennung und antwortete mit «500 Internal Error» («» ist
							keine uuid). Am Eingang, mitten im Einlass.
							
							Woran es genau liegt, liess sich nicht festnageln; die Seite lädt bei
							jedem Ereignis im Saal nach und baut die Optionsliste dabei neu. Statt
							weiter zu raten, trägt jetzt ein geführtes Feld den Wert: Das `select`
							bedient nur noch, gesendet wird, was im Zustand steht. Dasselbe
							Muster wie in `Wahlliste` — dort waren es die weggefilterten
							Gewählten, hier ist es die neu gebaute Liste.
						-->
						<!--
							**Eine Wahlliste mit Suche statt eines Aufklappfelds** (Auftraggeber,
							25.08.2026: «Beim Einlass ‹Ohne Karte einlassen› braucht es noch
							eine Suchfunktion nach Name, Nummer, Gemeinschaft oder so. Sonst
							wird es schwierig bei 50 Einheiten mit 90 Personen»).

							Ein `<select>` mit neunzig Einträgen ist am Eingang unbrauchbar:
							Man scrollt in einem Kasten, der halb über den Bildschirm reicht,
							während jemand wartet. `Wahlliste` gibt es dafür schon — sie steht
							zwei Ausklapper weiter unten bei «für welche Partei» und wurde am
							21.08. genau aus diesem Grund gebaut.

							**Sie löst nebenbei zwei Fallen mit**, die hier ausführlich
							dokumentiert waren: Das Auswahlfeld verlor bei jedem Nachladen
							seine Auswahl, und beim Abschicken fehlte `partei` gelegentlich
							ganz. Die Wahlliste führt den Wert in einem eigenen Feld — dasselbe
							Muster, das hier von Hand nachgebaut worden war.
						-->
						<Wahlliste
							name="partei"
							mehrfach={false}
							pflicht
							bind:gewaehlt={werTrifftEinListe}
							suchbeschriftung="Partei suchen"
							leerhinweis="Keine Partei gewählt."
							eintraege={data.vertretbare.map((p) => ({
								id: p.parteiId,
								name: p.name,
								zusatz:
									(p.einheiten.length ? p.einheiten.join(', ') : '') +
									(p.anwesend ? (p.einheiten.length ? ' — ' : '') + 'bereits anwesend' : ''),
								leise: p.anwesend
							}))}
						/>
					</label>
					<VollmachtFuer
						vertretbare={data.vertretbare}
						mitberechtigung={grundEinlass === 'mitberechtigt'}
					/>
					<!--
						Auch hier alle Gründe: Die eintretende Person ist zwar selbst Partei,
						kann aber daneben als Organ oder gesetzliche Vertretung für eine
						andere Einheit handeln. Siehe die Begründung in `pruefeEingabe`.

						**Seit dem 03.11.2026 eine andere Frage** (Produktentscheid,
						Fachprüfung F1): «Vertritt von Gesetzes wegen?» traf Mitberechtigte
						nicht, sie sind Eigentümerinnen. Eingetragene erkennt Votum selbst,
						von Hand bleibt nur «nicht eingetragen»; jeder Grund gilt für genau
						eine Partei (`verlangeEinGrundEinePartei`).
					-->
					<label class="grund">
						{GRUNDFRAGE}
						<select name="vertretungsgrund" use:gefuehrteWahl={(w) => (grundEinlass = w)}>
							<option value="" selected={grundEinlass === ''}>{GRUNDWAHL[0].text}</option>
							<option value="organ" selected={grundEinlass === 'organ'}>{GRUNDWAHL[1].text}</option>
							<option value="gesetzlich" selected={grundEinlass === 'gesetzlich'}>{GRUNDWAHL[2].text}</option>
							<option value="mitberechtigt" selected={grundEinlass === 'mitberechtigt'}>{GRUNDWAHL[3].text}</option>
						</select>
					</label>
					<p class="klein">{grundhilfe(data.stimmfuehrung)}</p>
					{#if data.papierfrage}
						<!--
							**Hier ein Haken und nicht zwei Knöpfe.** An der gescannten Karte
							fällt die Entscheidung in einem Griff, deshalb stehen dort zwei
							gleichwertige Knöpfe. Dieses Formular wird ausgefüllt: Partei
							suchen, Vollmachten setzen, dann einlassen. Ein zweiter
							Einlassknopf daneben wäre ein zweiter Weg durch dasselbe Formular.

							Der Haken ist leer, und das ist die richtige Vorgabe: Er steht
							sichtbar im Formular, wird also gestellt und nicht unterstellt.
						-->
						<!--
							**Das versteckte «nein» sagt: hier wurde gefragt.** Ein leeres Kästchen
							schickt gar nichts, und «gefragt und verneint» sähe damit aus wie «gar
							nicht gefragt». Der Server unterscheidet die beiden seit dem 10.09.2026 und
							meldet den zweiten Fall als Lücke in der Maske; ohne dieses Feld meldete er
							ihn hier zu Unrecht. Ein angekreuztes «ja» gewinnt, `getAll` liest beide.
						-->
						<input type="hidden" name="papier" value="nein" />
						<label class="papierhaken">
							<input type="checkbox" name="papier" value="ja" />
							Stimmt an dieser Versammlung von Hand ab
						</label>
					{/if}
					<Rueckfrage
						beschriftung="Einlassen"
						zeichen="haken"
						ton="gut"
						gewicht="haupt"
						frage={gewaehltePartei
							? `${gewaehltePartei.name} einlassen?`
							: 'Partei einlassen?'}
						folge={gewaehltePartei
							? `${gewaehltePartei.einheiten.join(', ') || 'Keine Einheiten'} — die Partei zählt danach für die Beschlussfähigkeit mit.`
							: 'Die Partei zählt danach für die Beschlussfähigkeit mit.'}
						bestaetigen="Einlassen"
					/>
				</form>
			</details>

			<!--
				**Die dritte Person am Eingang.**

				Sie ist keine Partei: keine Karte, kein Code, kein Eintrag in der
				Momentaufnahme. Anwesend wird deshalb die **vertretene** Partei, mit
				dem Namen der Person in der Bemerkung. Ohne diesen Weg wäre der
				naheliegende der falsche — die vertretene Partei von Hand zu erfassen
				gilt als «selbst erschienen» und beendet die eben geprüfte Vollmacht.
			-->
			<details class="dritte">
				<summary>Bevollmächtigte dritte Person (nicht selbst stimmberechtigt)</summary>
				<form method="POST" action="?/dritte" enctype="multipart/form-data">
					<label class="wer">
						Name der bevollmächtigten Person
						<input
							name="bevollmaechtigtName"
							required
							minlength="2"
							autocomplete="off"
							bind:value={nameDritte}
						/>
					</label>
					<VollmachtFuer
						vertretbare={data.vertretbare}
						name={nameDritte}
						zwingend={true}
						mitberechtigung={grundDritte === 'mitberechtigt'}
						dritte={true}
					/>
					<!--
						**Der Grund der Vertretung** (Ä-28 der Zweitprüfung vom 17.09.2026.)
						Organvertreter juristischer Personen und gesetzliche Vertreter zählen
						nicht zur Höchstzahl des Reglements. Ohne dieses Feld liefen sie hier
						in die Sperre, und der Einlasstisch ist genau der Ort, an dem sie
						auftauchen.

						**Eine dritte Person ist nie eingetragene Mitberechtigte**
						(Produktentscheid 03.11.2026). «Mitberechtigt» heisst hier deshalb
						immer «nicht eingetragen», etwa der Erbe, der im Register fehlt, und
						verlangt den Nachweis der Mitberechtigung (Fachprüfung F1 Runde 2,
						1.4 a: der Ausweg gehört in beide Formulare).
					-->
					<label class="grund">
						{GRUNDFRAGE}
						<select name="vertretungsgrund" use:gefuehrteWahl={(w) => (grundDritte = w)}>
							<option value="" selected={grundDritte === ''}>{GRUNDWAHL[0].text}</option>
							<option value="organ" selected={grundDritte === 'organ'}>{GRUNDWAHL[1].text}</option>
							<option value="gesetzlich" selected={grundDritte === 'gesetzlich'}>{GRUNDWAHL[2].text}</option>
							<option value="mitberechtigt" selected={grundDritte === 'mitberechtigt'}>{GRUNDWAHL[3].text}</option>
						</select>
					</label>
					<p class="klein">{GRUNDHILFE_DRITTE}</p>
					<!-- L8 (Migration 184), M3: dasselbe Häkchen wie bei der Vollmacht der
					     Leitung, mit demselben Hilfetext; der Einlasstisch ist der zweite
					     Ort, an dem eine Vollmacht auf die Verwaltung entsteht. -->
					<!-- E3 (11.11.2026): Trägt der Name schon eine Vollmacht mit dem
					     Häkchen, steht es hier angekreuzt; stehen lassen ändert nichts,
					     Abwählen entfernt es am ganzen Namen. Das versteckte Feld sagt
					     dem Server, dass es
					     vorbelegt war; ohne Vorbelegung heisst ein leeres Kästchen
					     «nicht angegeben» (`verwaltungshakenAmEinlass`). -->
					<input type="hidden" name="istVerwaltungVorher" value={verwaltungVorbelegt ? 'ja' : 'nein'} />
					<label class="verwaltungshaken">
						<input type="checkbox" name="istVerwaltung" value="ja" bind:checked={verwaltungDritte} />
						<span>Bevollmächtigt ist die Verwaltung</span>
					</label>
					<p class="klein">{VERWALTUNG_HAKEN_HILFE_LEITUNG}</p>
					<button type="submit" class="haupt">Vollmacht prüfen und einlassen</button>
					<p class="klein">
						Anwesend wird die Partei, für die sie die Vollmacht hält — nicht die Person selbst.
						Ihre Stimme erfassen Sie, oder Sie geben ihr in der Liste unten einen Ausgabecode
						für ihr eigenes Telefon.
					</p>
				</form>
			</details>
		</section>
	{/if}

	<!--
		**Beamer und Wandbild stehen jetzt UNTER dem Einlass** (20.08.2026).

		Sie standen zuoberst, begründet damit, am Eingang werde das Beamerbild
		zuerst gebraucht. Das stimmt — einmal am Abend. Gescannt wird vierzehnmal,
		und auf dem Telefon lag der Scanner dadurch 1319 px unter dem Seitenanfang:
		anderthalb Bildschirme scrollen, bevor die erste Karte drankommt. Gemeldet
		als «Wenn ich den Link zum QR mit dem Mobiltelefon aufrufe, komme ich nicht
		auf ein Einscanntool für den Sitzungsleiter.»

		Häufigkeit schlägt Reihenfolge: Was einmal gebraucht wird, darf weiter unten
		stehen als das, was zwischen zwei Personen wiederholt wird.
	-->
	<!--
		**Der Beamer als Schaltfläche, nicht als Verweis in der Ecke.**

		Er stand klein und rechts oben — auf einem Notebook im Saal die Stelle, an
		der man zuletzt sucht. Am Eingang ist er aber das Erste, was gebraucht wird:
		Ohne Beamerbild sieht niemand, worüber gleich gesprochen wird. Dieselbe
		Schaltfläche wie auf der Sitzungsleitung, damit die Handlung an beiden Orten
		gleich aussieht.
	-->
	<div class="beamerzeile">
		<Beamerfenster pfad="/versammlungen/{v.id}/praesentation" />
	</div>

	<!--
		**Was an der Wand steht, gehört an den Eingang.**

		Hier stand ein zweites Feld zum Aufrufen eines Traktandums — dieselbe
		Handlung wie auf der Sitzungsleitung, an der falschen Stelle. Gemeldet am
		02.08.2026: «Aufgerufenes Traktandum wird nicht benötigt» — und im selben
		Zug der Vorschlag, stattdessen zwischen Traktandenliste, Begrüssung und
		freiem Text zu wählen. Genau das braucht der Eingang: Solange die Leute
		eintreffen, gehört die Begrüssung an die Wand und nicht die Traktandenliste.
	-->
	<!--
		**Nicht am gemeinsamen Abend** (25.08.2026). Es ist dieselbe Wand für alle
		Häuser des Saals; was hier gewählt würde, überschriebe die Wahl des Abends,
		und die gemeinsame Sicht zeigte danach etwas anderes als die Leinwand. Der
		Weg dorthin steht unten in der Leiste unter «Versammlung führen».
	-->
	{#if (v.zustand === 'freigegeben' || laufend) && !data.tag}
		<Wandbild art={v.wandbild?.art ?? 'traktanden'} text={v.wandbild?.text ?? null} />
	{/if}

	<!-- ── Nachtragsliste ──────────────────────────────────────────────────── -->
	<!--
		**Wer hier steht, kam herein, bevor es die Frage gab** (Migration 109).
		Zwei Wege führen hierher: Die Frage wurde mitten im Einlass eingeschaltet,
		und alle davor kamen ungefragt herein; oder die Häkchenliste hat ein
		Dutzend Namen auf einmal abgehakt, denn die fragt mit Absicht nicht.

		**Das ist kein Entscheid mitten in der Sitzung** (Auftraggeber, 09.09.2026),
		sondern das Nachholen einer Frage, die am Eingang gestellt worden wäre. Die
		Menge ist endlich, bekannt und schrumpft auf null; ein freier Knopf an
		jeder Zeile wäre das andere und wurde ausdrücklich verworfen.
	-->
	{#if data.nichtGefragt.length > 0}
		<section class="nachtragsliste">
			<h2>Nicht gefragt ({data.nichtGefragt.length})</h2>
			<!--
				`lesebreite`, gemessen am 10.09.2026: Der Satz lief über 1048 px bei 154
				Zeichen, während der Rest der Seite auf 42rem steht. Eine Zeile, die man
				zweimal ansetzen muss, liest am Eingang niemand.
			-->
			<p class="klein lesebreite">
				Diese Parteien sind anwesend, wurden aber nicht gefragt, ob sie digital oder von Hand
				abstimmen. Bis das geklärt ist, stimmen sie am eigenen Gerät ab.
			</p>
			<ul>
				{#each data.nichtGefragt as p (p.parteiId)}
					<li>
						<strong>{p.name}</strong>
						<form
							method="POST"
							action="?/papierBeantworten"
							use:enhance={absenden()}
							class="knoepfe"
						>
							<input type="hidden" name="partei" value={p.parteiId} />
							<input type="hidden" name="weg" value="von_hand" />
							<!-- Wie an jedem Eingang: kein Knopf ist vorbelegt, und der
							     gesperrte davor hält Enter auf. -->
							<button type="submit" disabled hidden data-vorgabe="keiner">
								Kein Vorgabeknopf
							</button>
							<!--
								**Nur dieser fragt zurück**, und das ist keine Zierde. «Stimmt von
								Hand» ist an der Zeile jederzeit zurückzunehmen; «stimmt digital»
								nimmt die Partei aus dieser Liste, und zurück auf die Liste führt
								kein Weg — die Antwortzeile lässt sich nicht löschen.

								**Der Wortlaut nennt keinen Ausweg** (Code-Review 10.09.2026). Der
								erste Anlauf verwies auf «die nochmals gescannte Karte» — und genau
								die hat diese Gruppe nicht: Wer über die Häkchenliste oder ohne
								Karte hereinkam, müsste sich erst einen Code ausgeben lassen. Einen
								Weg zu versprechen, den die Hälfte der Betroffenen nicht gehen kann,
								ist schlimmer als zu sagen, dass es keinen gibt.
							-->
							<Rueckfrage
								beschriftung="Stimmt digital"
								zeichen="haken"
								ton="neutral"
								name="papier"
								wert="nein"
								marke="gefragt:{p.parteiId}"
								frage="{p.name} als digital abstimmend erfassen?"
								folge="Die Partei verschwindet aus dieser Liste, und in die Liste zurück führt kein Weg: Dass gefragt wurde, lässt sich nicht widerrufen. Stimmt sie doch von Hand, setzen Sie den Vermerk an ihrer Zeile in der Anwesenheitsliste."
								bestaetigen="Stimmt digital"
							/>
							<button
								type="submit"
								name="papier"
								value="ja"
								class="handlung papierknopf"
								data-fokus="gefragtpapier:{p.parteiId}"
							>
								<Zeichen art="haken" />
								Stimmt von Hand
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- ── Liste ───────────────────────────────────────────────────────────── -->
	<div class="listenkopf">
		<h2>Alle Parteien</h2>
		{#if laufend}
			<button type="button" class="leise" onclick={() => (listenmodus = !listenmodus)}>
				{listenmodus ? 'Häkchenliste schliessen' : 'Häkchenliste (einfache Führung)'}
			</button>
		{/if}
	</div>

	<!--
		**Suchen statt scrollen** (Auftraggeber, 25.08.2026: «Alle Parteien auch mit einen
		Schnellsuche ausstatten. Dies auch bei Einzelveranstaltung»).

		Dieselbe Suche wie am gemeinsamen Abend, dieselbe wie in der
		Eigentümerliste: `filtereNach` aus dem Kern. Bei fünfzig Einheiten sucht
		niemand mit den Augen, und wer eine Nummer statt eines Namens hört, findet
		sie hier auch — die Einheiten stehen im durchsuchten Text.
	-->
	<div class="suchleiste">
		<label class="suchfeld">
			<span class="nurLeser">Partei suchen</span>
			<input
				type="search"
				placeholder="Name oder Einheit"
				{...anfangswert(suche)}
				oninput={(e) => (suche = e.currentTarget.value)}
				autocomplete="off"
			/>
		</label>
		{#if suche.trim()}
			<p class="zaehler">{gefiltert.length} von {u.staende.length}</p>
		{/if}
	</div>

	{#if listenmodus && laufend}
		<form method="POST" action="?/liste" class="haken">
			<p class="klein">
				Alle Anwesenden in einem Durchgang anhaken. Wer schon erfasst ist, wird übersprungen. Ein
				fehlendes Häkchen erfasst <strong>kein</strong> Weggehen — das ist ein eigener Vorgang mit
				eigenem Zeitpunkt.
			</p>
			{#if data.papierfrage}
				<!--
					**Diese Liste fragt nicht, und sagt es** (10.09.2026, im Code-Review
					gefunden). Alle anderen Eingänge fragen «digital oder von Hand»; hier
					wäre ein Zwiegespräch je Zeile kein Eingang mehr, sondern ein zweites
					Formular über einem Dutzend Namen.

					Bis hierher stand die Begründung dafür in einem Wächterkommentar und
					lautete, der Weg gehöre zur einfachen Betriebsart, wo sich die Frage
					nicht stelle. Das war falsch: Der Knopf «Häkchenliste» steht in JEDER
					laufenden Versammlung. Wer die Liste benutzte, erfasste ein Dutzend
					Parteien still als digital.

					Geändert ist deshalb nicht der Weg, sondern der Satz darüber — und die
					Reihenfolge, die er nennt. Sie trägt: Der Vermerk am Eingang entsteht
					vor der Anwesenheit, und die Liste überspringt, wer schon erfasst ist.
				-->
				<p class="klein">
					<strong>Diese Liste fragt nicht,</strong> ob jemand von Hand abstimmt; alle hier
					Angehakten stimmen am eigenen Gerät ab. Wer von Hand abstimmt, wird
					<strong>vorher</strong> über seine Zeile erfasst, mit «Erfassen, von Hand».
				</p>
			{/if}
			<div class="kaestchen">
				{#each u.staende as s (s.parteiId)}
					<label>
						<input
							type="checkbox"
							name="partei"
							value={s.parteiId}
							{...angekreuzt(s.zustand === 'anwesend')}
						/>
						{s.name}
					</label>
				{/each}
			</div>
			<button type="submit">Erfassen</button>
			<p class="klein">
				<a href="/versammlungen/{v.id}/unterschriftenliste.pdf" target="_blank" rel="noopener">
					Unterschriftenliste zum Ausdrucken
				</a>
				— sie trägt den Nachweis der Anwesenheit, nicht das System. Vor der Versammlung
				steht sie auch bei der
				<a href="/versammlungen/{v.id}/ausfall">Ausfallsicherung</a>; dort gehört sie hin,
				weil sie ausgedruckt am Eingang liegt.
			</p>
		</form>
	{/if}

	<div class="tabellenbahn">
		<!--
			Die Rollen sind nicht überflüssig, auch wenn der Prüfer das meint: Auf dem
			Telefon wird die Tabelle zu Karten (`display: block`), und damit verliert
			sie ihre eingebauten Rollen. Ein Vorleseprogramm läse dann eine Folge von
			Absätzen statt einer Aufstellung. Der Prüfer sieht die Medienabfrage nicht.
		-->
		<!-- svelte-ignore a11y_no_redundant_roles -->
		<table role="table" class="karten">
		<thead>
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<tr role="row">
				<th scope="col">Partei</th>
				<th scope="col">Einheiten</th>
				<th scope="col">Stand</th>
				<th scope="col">Eingetroffen</th>
				<th scope="col">Gerät</th>
				<th scope="col">Handlungen</th>
			</tr>
		</thead>
		<tbody>
			{#each gefiltert as s (s.parteiId)}
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<tr role="row" class:anwesend={s.zustand === 'anwesend'}>
					<td role="cell" class="kopfzelle">
						{s.name}
						{#if s.ausgeuebtDurch !== s.name}
							<span class="klein">Stimme: {s.ausgeuebtDurch}</span>
						{/if}
						{#if s.vertretenDurch}
							<span class="klein">vertreten durch {s.vertretenDurch}</span>
						{/if}
						{#if s.vertritt.length > 0}
							<span class="klein">bevollmächtigt für {s.vertritt.join(', ')}</span>
						{/if}
					</td>
					<td role="cell" data-spalte="Einheiten" class="einheiten">{s.einheiten.join(', ')}</td>
					<td role="cell" data-spalte="Stand">
						<span class="marke" data-stand={s.zustand}>{s.zustandName}</span>
						{#if s.wegName}<span class="klein">{s.wegName}</span>{/if}
					</td>
					<td role="cell" data-spalte="Eingetroffen" class="zeit">
						{zeit(s.seit)}
						{#if s.gegangenSeit}<span class="klein">gegangen {zeit(s.gegangenSeit)}</span>{/if}
						{#if s.gegangenGrund}<span class="klein">Grund: {s.gegangenGrund}</span>{/if}
					</td>
					<td role="cell" data-spalte="Gerät">
						{#if s.geraet}
							<span class="marke gut">{s.geraet.bezeichnung}</span>
							<span class="klein">
								seit {zeit(s.geraet.seit)}{s.geraet.herkunft === 'ausgabe'
									? ' · über ausgegebenen Code'
									: ''}
							</span>
						{:else}
							<span class="klein">—</span>
						{/if}
					</td>
					<td role="cell" data-spalte="Handlungen" class="tat">
						<!--
							**Zustand links, Handlung rechts** (20.08.2026). «Code ausgeben» und
							«Gerät abmelden» standen bis dahin in der Gerätespalte und stapelten
							sich dort untereinander, weil die Spalte für zwei Knöpfe zu schmal
							ist. Aus jeder Zeile wurde damit ein Block. Jetzt trägt die
							Gerätespalte nur noch, was der Fall ist, und alle Handlungen stehen
							beieinander — in einer Zeile, die umbrechen darf.
						-->
						{#if laufend}
							<span class="knoepfe">
								{#if s.zustand === 'anwesend'}
									<form
										method="POST"
										action="?/verlassen"
										use:enhance={absenden()}
									>
										<input type="hidden" name="partei" value={s.parteiId} />
										<!--
											**Die Begründung ist Pflicht** (Befund
											Praxisdurchlauf 03.10.2026, Punkt 8). Sie steht
											im Fenster und nicht daneben: Wer «Verlassen»
											drückt, hat die Handlung gewählt und begründet
											sie jetzt. Ohne Grund lässt das Fenster nicht
											abschicken, und der Server weist einen POST
											ohne Grund ebenfalls ab.

											**Und der Weg ohne JavaScript**, den die
											Komponente ausdrücklich offen hält: Das Fenster
											bliebe zu, also steht hier ein eigenes Feld.
											Es steht **vor** der Rückfrage, damit die
											Absendung ohne JavaScript dessen Wert liest und
											nicht das leere Feld im geschlossenen Dialog.
											Ist JavaScript an, ist `<noscript>` kein
											Inhalt, sondern Text — es gibt dann nur das
											Feld im Fenster.
										-->
										<noscript>
											<label class="verlassgrund">
												Begründung
												<input name="begruendung" required minlength="3" autocomplete="off" />
											</label>
										</noscript>
										<Rueckfrage
											beschriftung="Verlassen"
											zeichen="hinaus"
											ton="warnung"
											marke="verlassen:{s.parteiId}"
											frage="{s.name} als gegangen erfassen?"
											folge="Kopfstimmen und Wertquoten dieser Partei zählen ab sofort nicht mehr mit."
											bestaetigen="Als gegangen erfassen"
											pruefe={(fenster) => {
												const feld =
													fenster.querySelector<HTMLInputElement>('input[name="begruendung"]');
												// `zeichenzahl` wie der Server: `.length` zählt
												// UTF-16-Einheiten und liesse zwei Bildzeichen
												// durch, die der Server danach abweist.
												return zeichenzahl(feld?.value.trim() ?? '') >= 3
													? null
													: 'Bitte begründen Sie das Verlassen mit mindestens drei Zeichen.';
											}}
										>
											{#snippet inhalt()}
												<label class="verlassgrund">
													Begründung
													<!--
														Kein `required`: Das Feld steht in einem
														geschlossenen Dialog, und ohne JavaScript
														blockierte der Browser die Absendung ohne
														sichtbare Meldung. Die Pflicht prüft `pruefe`,
														den Weg ohne JavaScript trägt das Feld
														darüber.
													-->
													<input
														name="begruendung"
														autocomplete="off"
														placeholder="Warum geht die Partei?"
													/>
													<span class="hilfe">
														Pflicht. Der Grund steht in der Anwesenheitsliste und im Verlauf.
													</span>
												</label>
											{/snippet}
										</Rueckfrage>
									</form>
								{:else}
									<!--
										**Rückfrage mit Namen und Einheiten.**

										Von Hand erfasst wird ohne Karte und ohne Code — es gibt nichts,
										was den Griff daneben abfinge. In einer Liste von vierzehn Zeilen
										liegen «Berger» und «Berger-Kunz» zwei Zeilen auseinander, und
										wer den Falschen anwesend setzt, verschiebt Kopfstimmen und
										Wertquoten in jeder folgenden Abstimmung. «Sind Sie sicher?»
										beantwortet niemand anders als mit Ja; «Erbengemeinschaft Kunz —
										0.1, 1.1» lässt sich mit der Person vor einem vergleichen.
									-->
									<form
										method="POST"
										action="?/bestaetigen"
										use:enhance={absenden()}
									>
										<input type="hidden" name="partei" value={s.parteiId} />
										<input type="hidden" name="weg" value="von_hand" />
										{#if data.papierfrage}
											<!--
												**Auch diese Zeile ist ein Eingang** (10.09.2026). Sie war der
												letzte, der die Frage nicht stellte, und das fiel nirgends auf:
												Ein Formular ohne Feld `papier` sah für den Server
												genauso aus wie eines, in dem jemand «digital» geantwortet hat.
												Wer hier erfasst wurde, stimmte still am eigenen Gerät ab, auch
												wenn er der Sitzungsleitung gerade das Gegenteil gesagt hatte.

												Zwei gleichwertige Knöpfe, wie an der gescannten Karte und bei
												den Wartenden. Jeder trägt seine eigene Rückfrage, denn die Folge
												ist eine andere.

												**Der gesperrte Vorgabeknopf trägt hier den Fall OHNE JavaScript**,
												und nur den. Mit Skript fängt `Rueckfrage` den Klick ab und öffnet
												das Fenster; eine implizite Absendung durch Enter tut dasselbe, denn
												sie wirkt wie ein Klick auf den Vorgabeknopf. Ohne Skript läuft der
												Zuhörer nicht, und dann wäre der erste Knopf im Baum die Antwort
												«digital», die niemand gegeben hat. Der gesperrte Knopf davor hält
												das auf, ohne Skript und ohne Serverumlauf.
											-->
											<button type="submit" disabled hidden data-vorgabe="keiner">
												Kein Vorgabeknopf
											</button>
											<Rueckfrage
												beschriftung="Erfassen, digital"
												zeichen="haken"
												ton="gut"
												name="papier"
												wert="nein"
												marke="hand:{s.parteiId}"
												frage="{s.name} als anwesend erfassen?"
												folge={anwesendfolge(s)}
												bestaetigen="Als anwesend erfassen"
											/>
											<Rueckfrage
												beschriftung="Erfassen, von Hand"
												zeichen="haken"
												ton="gut"
												name="papier"
												wert="ja"
												marke="handpapier:{s.parteiId}"
												frage="{s.name} als anwesend erfassen, stimmt von Hand?"
												folge="{anwesendfolge(s)} Das Telefon dieser Partei stimmt nicht mit; die Sitzungsleitung überträgt ihre Stimmen."
												bestaetigen="Erfassen, stimmt von Hand"
											/>
										{:else}
											<Rueckfrage
												beschriftung="Von Hand erfassen"
												zeichen="haken"
												ton="gut"
												marke="hand:{s.parteiId}"
												frage="{s.name} als anwesend erfassen?"
												folge={anwesendfolge(s)}
												bestaetigen="Als anwesend erfassen"
											/>
										{/if}
									</form>
								{/if}
								<!--
									**Der Rückweg geht in beide Richtungen** (11.09.2026, vom Auftraggeber im
									Eingangstest gefunden).

									Vorher stand hier nur die Rücknahme, und sie hiess «Stimmt von
									Hand» — der Zustand, nicht die Handlung. Der Auftraggeber, der die Frage selbst
									bestellt hat, las sie nicht als Rückweg; das ist die Antwort auf
									A13/A15 des Drehbuchs und die ungünstigste.

									Schwerer wog die Schieflage dahinter: Die Rücknahme steht
									unbefristet da, das **Setzen** aber nur fünf Sekunden lang im
									Kasten oder beim nochmaligen Scannen der Karte. Wer versehentlich
									«Erfassen, digital» drückte, hatte danach keinen Weg mehr; die
									Nachtragsliste fasst nur, wer nie gefragt wurde.

									**Das ist kein Entscheid mitten in der Sitzung** (Vorgabe des Auftraggebers,
									09.09.2026: «Der Entscheid fällt am Eingang»). Es ist die Reparatur
									eines Fehlgriffs am Eingang, und für die gilt derselbe Satz weiter:
									«Dort gilt höchstens der bestehende Weg, wenn es technische
									Probleme gibt.» Produktentscheid 11.09.2026: unbefristet, solange
									die Versammlung läuft.
								-->
								{#if aufPapier.has(s.parteiId)}
									<form
										method="POST"
										action="?/papierZuruecknehmen"
										use:enhance={absenden()}
									>
										<input type="hidden" name="partei" value={s.parteiId} />
										<Rueckfrage
											beschriftung="Stimmt doch digital"
											zeichen="kreuz"
											ton="fehler"
											marke="papierab:{s.parteiId}"
											frage="Vermerk «stimmt von Hand ab» für {s.name} zurücknehmen?"
											folge="Danach stimmt die Partei wieder am eigenen Gerät ab, und die Sitzungsleitung braucht für jede Stimme wieder einen Grund. Die Anwesenheit bleibt bestehen."
											bestaetigen="Vermerk zurücknehmen"
										/>
									</form>
								{:else if data.papierfrage && s.zustand === 'anwesend' && s.weg !== 'vertretung'}
									<!--
										**Nicht bei einer vertretenen Partei.** Sie hat kein Gerät im
										Saal, ihre Stimme übt die bevollmächtigte Person aus. Ein
										Vermerk «stimmt von Hand» hätte dort nichts zu sperren und
										stünde nur im Weg — dieselbe Überlegung wie bei der
										Nachtragsliste.
									-->
									<form
										method="POST"
										action="?/papierBeantworten"
										use:enhance={absenden()}
									>
										<input type="hidden" name="partei" value={s.parteiId} />
										<Rueckfrage
											beschriftung="Stimmt doch von Hand"
											zeichen="kreuz"
											ton="warnung"
											name="papier"
											wert="ja"
											marke="papierdoch:{s.parteiId}"
											frage="{s.name} stimmt doch von Hand?"
											folge="Das Telefon dieser Partei stimmt danach nicht mehr mit; die Sitzungsleitung überträgt ihre Stimmen. Die Anwesenheit bleibt bestehen, und der Weg zurück steht daneben."
											bestaetigen="Stimmt von Hand"
										/>
									</form>
								{/if}
								<!-- Ohne Rückfrage: Ein Code auszugeben nimmt niemandem etwas. Der
								     alte bleibt gültig, bis er benutzt wird. -->
								<form
									method="POST"
									action="?/codeAusgeben"
									use:enhance={absenden()}
								>
									<input type="hidden" name="partei" value={s.parteiId} />
									<button type="submit" class="handlung" data-fokus="code:{s.parteiId}">
										<Zeichen art="schluessel" />
										Code ausgeben
									</button>
								</form>
								{#if s.geraet}
									<!--
										**«Gerät abmelden», nicht «Zugang freigeben».** Der Knopf steht an
										jeder Zeile mit angemeldetem Gerät — also im gesunden Zustand —
										und las sich wie eine Pendenz. Er nimmt dem Gerät die Sitzung,
										nicht der Partei den Zugang.
									-->
									<form
										method="POST"
										action="?/geraeteWiderrufen"
										use:enhance={absenden()}
									>
										<input type="hidden" name="partei" value={s.parteiId} />
										<Rueckfrage
											beschriftung="Gerät abmelden"
											zeichen="geraet"
											ton="fehler"
											marke="geraet:{s.parteiId}"
											frage="Gerät von {s.name} abmelden?"
											folge="Die Person muss sich danach neu anmelden — mit ihrer Karte oder einem Code, den Sie ausgeben. Die Anwesenheit bleibt bestehen."
											bestaetigen="Gerät abmelden"
										/>
									</form>
								{/if}
							</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
		</table>
		<!--
			**Einmal unter der Tabelle statt in jeder Zeile.**

			Bis zum 20.08.2026 stand «Stimmen erfasst die Sitzungsleitung» bei jeder
			betroffenen Partei als dritte Zeile in der Standspalte — bei zehn von
			vierzehn Parteien derselbe Satz, der die Zeilen auf drei Zeilen Höhe
			trieb und den eigentlichen Unterschied erdrückte. Die Aussage bleibt,
			ihre Wiederholung geht.
		-->
		{#if u.staende.some((s) => s.ueberSitzungsleitung && s.zustand === 'anwesend')}
			<p class="fussnote klein">
				Wer <strong>von Hand</strong>, <strong>ab Liste</strong> oder
				<strong>durch Vertretung</strong> erfasst ist, hat kein eigenes Gerät im Saal — seine
				Stimmen erfasst die Sitzungsleitung.
			</p>
		{/if}
	</div>
{/if}

<style>

	.kopf {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.vertagen {
		margin-top: 0.75rem;
	}

	.vertagen summary {
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	/* `minmax(0, 1fr)` (Auftrag V2, 06.10.2026): Die Spur ohne Angabe nahm die
	   Eigenbreite der Auswahl, und mit dem Pfeilpolster aus app.css lief die
	   Seite bei 390 px offen 9 px quer. So schrumpft das Feld mit der Spalte. */
	.vertagen form {
		margin-top: 0.5rem;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.5rem;
		max-width: var(--lesebreite);
	}

	.quorum {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 1.5rem;
		border: 1px solid var(--fehler);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.8rem 1.15rem;
		margin: 1.25rem 0;
	}

	.quorum.ja {
		border-color: var(--akzent);
	}

	.vonhand,
	.dritte {
		margin-top: 0.9rem;
	}

	.dritte .wer {
		display: block;
		font-weight: 550;
		margin-bottom: 0.4rem;
	}

	.dritte .wer input {
		display: block;
		margin-top: 0.2rem;
		max-width: 30rem;
		width: 100%;
	}

	/* Wie der Papierhaken im Einlass: ein Häkchen mit Text daneben. */
	.dritte .verwaltungshaken {
		align-items: center;
		display: flex;
		font-weight: 400;
		gap: 0.5rem;
	}

	.dritte .verwaltungshaken input {
		width: auto;
		min-height: 0;
	}

	.dritte button {
		margin-top: 0.75rem;
	}

	/*
	 * **Vier Aufklapper untereinander, ein Aussehen** (UI-Durchgang 06.10.2026).
	 * «Meldeseite zeigen» (`Saaleinstieg.svelte`) und «Einlass auf dem Telefon
	 * öffnen» standen normal, die beiden hier fett, ohne dass sie mehr wiegen:
	 * Alle vier sind gleichrangige Wege am Eingang. Jetzt alle normal und mit
	 * der Höhe und dem Polster des Saaleinstiegs (vorher 27 und 40 px neben 50).
	 */
	.quicklink summary,
	.vonhand summary,
	.dritte summary {
		cursor: pointer;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
	}

	.vonhand .wer {
		display: block;
		font-weight: 550;
		margin-bottom: 0.4rem;
	}

	:global(.vonhand button) {
		margin-top: 0.75rem;
	}

	.marke {
		display: inline-block;
		padding: 0.15rem 0.7rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--fehler) 18%, transparent);
		font-weight: 550;
		font-size: 0.85rem;
	}

	.quorum .marke {
		margin: 0;
	}

	.quorum.ja .marke {
		background: color-mix(in srgb, var(--akzent) 25%, transparent);
	}

	.quorum ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1.5rem;
		font-variant-numeric: tabular-nums;
	}

	/* Die Grundlage ist die Fussnote der Feststellung und gehört unter sie,
	   nicht daneben: Sie wird gelesen, wenn jemand nachfragt. */
	.quorum .grundlage {
		flex-basis: 100%;
		margin: 0;
	}

	.ausgabe {
		border: 2px solid var(--akzent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 10%, var(--flaeche));
		padding: 1rem 1.15rem;
		max-width: 46rem;
		margin: 1.25rem 0;
	}


	.code {
		font-family: ui-monospace, monospace;
		font-size: clamp(1.6rem, 5vw, 2.4rem);
		font-weight: 700;
		letter-spacing: 0.1em;
		margin: 0.2rem 0 0.6rem;
	}








	/* Die Falle mit der Breite eines `select` steht jetzt bei `Einlass.svelte`,
	   wo die Auswahl lebt. */







	/* Die Rückfrage nach dem Scannen: Sie soll am Eingang mit einem Blick zu
	   lesen und mit dem Daumen zu treffen sein. */
	.gescannt {
		border: 2px solid var(--akzent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 8%, var(--flaeche));
		padding: 1rem 1.15rem;
		margin: 1.25rem 0;
	}

	.gescannt .woher {
		margin: 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-leise);
	}

	.gescannt h2 {
		margin: 0.1rem 0 0.2rem;
		font-size: 1.6rem;
	}

	.gescannt .einheiten {
		margin: 0 0 0.3rem;
		color: var(--text-leise);
	}

	.gescannt .stimmkraft {
		margin: 0 0 0.9rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* Nur der Hauptknopf wird gross — der Verwerfen-Knopf bleibt eine
	   gewöhnliche Handlung, sonst stünden zwei gleich laute Angebote da. */
	.gescannt button.haupt {
		font-size: 1.05rem;
		padding: 0.7rem 1.4rem;
	}

	/* Annehmen oder ablehnen, nebeneinander: Es ist eine Entscheidung, nicht
	   eine Handlung mit einem Ausweg im Kleingedruckten. */
	.entscheid {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.schonda {
		margin: 0 0 0.75rem;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
		max-width: 52ch;
	}

	.aufpapier {
		margin: 0 0 0.5rem;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius);
		background: var(--flaeche-2);
		max-width: 52ch;
	}

	.zuruecknehmen {
		margin: 0 0 0.9rem;
	}

	/* Zwei gleichwertige Knöpfe: gleiche Grösse, gleiches Gewicht. Der eine
	   trägt den Akzent, der andere die Linie — verschieden genug, um sie unter
	   Zeitdruck auseinanderzuhalten, ohne einen davon zur Vorgabe zu machen. */
	.entscheid button.haupt.vonhand {
		background: var(--flaeche);
		color: var(--text);
		border: 2px solid var(--akzent);
	}

	.papierhaken {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.5rem 0;
	}

	.papierhaken input {
		width: auto;
		min-height: 0;
	}

	.checkin {
		margin: 1.5rem 0;
		max-width: 46rem;
		/* Den Abstand zur klebenden Kopfzeile hält `scroll-padding-top` in
		   `app.css` — für jedes Sprungziel, nicht nur für dieses. */
	}

	h2 {
		font-size: 1rem;
		margin: 0 0 0.5rem;
	}

	.zeile {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.zeile label {
		flex: 1 1 18rem;
	}

	.zeile input {
		width: 100%;
		min-height: var(--ziel-min);
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-family: ui-monospace, monospace;
		letter-spacing: 0.06em;
	}

	/*
	 * **Die Begründung im Verlassen-Fenster** (Befund 03.10.2026, Punkt 8).
	 *
	 * Das Feld gehört zum Formular der Zeile und steht doch im Dialog; der
	 * Stil hier erreicht es, weil der Ausschnitt in dieser Datei definiert ist.
	 * Der Dialog selbst trägt die globalen `.rueckfrage`-Regeln aus `app.css`.
	 */
	.verlassgrund {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.9rem;
		font-weight: 550;
	}

	.verlassgrund input {
		min-height: var(--ziel-min);
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	.verlassgrund .hilfe {
		color: var(--text-leise);
		font-size: 0.85rem;
		font-weight: 400;
	}

	/*
	 * **Die Nachtragsliste sieht aus wie der Eingang, nicht wie eine Warnung.**
	 * Sie ist eine Aufgabe und kein Fehler: Jemand ist hereingekommen, bevor es die
	 * Frage gab. Dieselbe Umrandung wie der Einlasskasten darüber, damit klar ist,
	 * wohin sie gehört.
	 */
	/*
	 * **`--linie` und nicht `--rand`** (10.09.2026, am gerenderten Bild gemessen).
	 * Der erste Anlauf schrieb `border: 1px solid var(--rand)` — und `--rand` ist
	 * ein **Abstand** (`1rem`), keine Farbe. `border: 1px solid 1rem` ist ungültig,
	 * also fiel die ganze Kurzschreibweise weg: `border: 0px none`. Der Kasten
	 * stand ohne Rahmen da, und der Kommentar daneben behauptete, er sehe aus wie
	 * der Einlasskasten darüber.
	 *
	 * Aus dem Namen einer Variablen geschlossen, was sie enthält. Der Stilwächter
	 * fängt das nicht: Er prüft, ob eine Variable **existiert**, nicht ob sie an
	 * diese Stelle passt.
	 */
	.nachtragsliste {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
		margin-bottom: 1.2rem;
	}

	.nachtragsliste h2 {
		margin-top: 0;
	}

	/*
	 * **Die Knöpfe beginnen in jeder Zeile an derselben Stelle** (10.09.2026, am
	 * gerenderten Bild gemessen: 539, 563, 577 px — das Ziel wanderte je nach
	 * Länge des Namens). Eine Liste wird von oben nach unten abgearbeitet; wenn
	 * dabei der Knopf springt, klickt man daneben.
	 *
	 * Das Raster steht an der Liste, nicht an der Zeile: Nur so richten sich die
	 * Spalten über alle Zeilen hinweg aneinander aus. `display: contents` an der
	 * Zeile hängt ihre beiden Kinder direkt ins Raster.
	 */
	.nachtragsliste ul {
		list-style: none;
		padding: 0;
		margin: 0.6rem 0 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		align-items: center;
		gap: 0.5rem 0.8rem;
	}

	.nachtragsliste li {
		display: contents;
	}

	/*
	 * **Der eine trägt den Akzent, der andere die Linie** — wortgleich zum
	 * Rückwegkasten (`.entscheid button.haupt.vonhand`). Gleiche Grösse, gleiches
	 * Gewicht, verschieden genug, um sie unter Zeitdruck auseinanderzuhalten, ohne
	 * einen davon zur Vorgabe zu machen.
	 *
	 * **Eine eigene Klasse und nicht `vonhand`** (10.09.2026, am gerenderten Bild
	 * gefunden). `vonhand` heisst auf dieser Seite der Ausklapper «Ohne Karte
	 * einlassen»; die Regel `.vonhand, .dritte { margin-top: 0.9rem }` traf meinen
	 * Knopf mit und stellte die beiden Knöpfe versetzt übereinander. Ein Name, den
	 * es im selben Dokument schon für etwas anderes gibt, wirkt trotzdem.
	 */
	.nachtragsliste .papierknopf {
		border: 2px solid var(--akzent);
	}

	.nachtragsliste li form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.listenkopf {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-top: 2rem;
	}

	.haken {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
		margin: 0.75rem 0;
		max-width: 52rem;
	}

	.kaestchen {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 1.25rem;
		margin: 0.75rem 0;
	}

	.kaestchen label {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-height: var(--ziel-min);
		flex: 0 0 auto;
	}

	input[type='checkbox'] {
		width: 1.15rem;
		height: 1.15rem;
		flex: none;
	}



	/*
	 * **Die Liste darf die Breite nutzen, die da ist.**
	 *
	 * Sie stand auf 60rem — auf einem 1585 px breiten Schirm endete sie bei
	 * 975 px, und der Platz daneben blieb leer, während die Zellen umbrachen.
	 * Gemeldet am 20.08.2026: «Der Bereich Alle Parteien nutzt nicht die volle
	 * Breite. Es wirkt gestaucht.» Eine Grenze bleibt trotzdem: Über 100rem
	 * wandert das Auge von der Partei bis zur Handlung quer über den Tisch.
	 */
	table {
		width: 100%;
		max-width: 100rem;
		border-collapse: collapse;
		margin-top: 0.75rem;
		font-size: 0.92rem;
	}

	/* Nebeneinander statt gestapelt: zwei Knöpfe untereinander machen aus jeder
	   Zeile einen Block. Abstand 0.5rem (UI-Durchgang 06.10.2026): Mit 0.35rem
	   standen «Verlassen», «Stimmt doch von Hand» und «Code ausgeben» 5 bis 6 px
	   auseinander, waagrecht wie nach dem Umbruch, zu knapp für den Finger. */
	.knoepfe {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.quicklink {
		margin-top: 0.5rem;
	}

	/* Gross genug, dass ein Telefon ihn aus einer Armlänge liest — mehr braucht
	   es nicht, er steht nur einmal im Weg. */
	.qr :global(svg) {
		width: 12rem;
		height: 12rem;
		/* themenfest: Der QR-Code braucht Weiss, damit ihn jede Kamera liest. */
		background: #fff;
		padding: 0.5rem;
		border-radius: var(--radius);
	}

	.qr {
		margin-top: 0.5rem;
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.qr .wohin {
		max-width: 34ch;
	}

	.qr p {
		max-width: 34ch;
	}

	/* Die Adresse darf umbrechen: Auf dem Telefon ist sie länger als die
	   Bildschirmbreite, und ein waagrechter Balken über der ganzen Seite wäre
	   der schlechtere Tausch. */
	.adresse {
		margin-top: 0.5rem;
		overflow-wrap: anywhere;
	}

	/* Die Handlungsspalte trägt drei Knöpfe und braucht dafür Platz; die
	   Einheiten dürfen dafür umbrechen. */
	td.tat {
		min-width: 21rem;
	}

	.knoepfe :global(form) {
		display: contents;
	}

	.fussnote {
		margin: 0.6rem 0 0;
		max-width: 62ch;
	}

	th,
	td {
		text-align: left;
		padding: 0.45rem 0.5rem;
		border-bottom: 1px solid var(--linie);
		vertical-align: top;
	}

	tr.anwesend {
		background: color-mix(in srgb, var(--akzent) 6%, transparent);
	}

	.zeit {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	td .marke {
		background: var(--flaeche-2);
		font-weight: 400;
		font-size: 0.8rem;
	}

	td .marke[data-stand='anwesend'] {
		background: color-mix(in srgb, var(--akzent) 22%, transparent);
	}

	td .marke[data-stand='wartet'] {
		background: color-mix(in srgb, var(--warnung) 25%, transparent);
	}

	/*
	 * **`display` nur auf dem `span`** — und das ist kein Schönheitsentscheid.
	 *
	 * Die Klasse stand auch auf der Zelle mit den Einheiten. Eine Hilfsklasse mit
	 * `display: block` macht aus einem `<td>` einen Block: Die Zelle war 37 px
	 * hoch statt 63, ihre untere Linie lag 25 px über der Linie der Nachbarzellen,
	 * und die Tabelle bekam eine Treppe. Gemeldet am 20.08.2026 («Die Zeile
	 * Einheiten sind versetzt»), im Browser nachgemessen: `display: block` statt
	 * `table-cell`.
	 *
	 * Der Zusatz unter einem Namen braucht die eigene Zeile, eine Tabellenzelle
	 * darf sie nicht bekommen. Also am Element festgemacht statt an der Klasse —
	 * `scripts/check-anzeigeart.mjs` hält es offen.
	 */
	span.klein {
		display: block;
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	/* Dieselbe Zurückhaltung wie `.klein`, aber ohne Anzeigeart: eine Zelle
	   bleibt eine Zelle. */
	td.einheiten {
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.nurLeser {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	/*
	 * **`:not(.handlung)` ist kein Zierrat.** Svelte hängt an jeden Selektor
	 * eines Stilblocks eine Komponentenklasse: Aus `button` wird
	 * `button.svelte-xxxx` und damit ein Gewicht, das die globale Klasse
	 * `.handlung` aus `app.css` aussticht. Ohne diese Ausnahme trug «Code
	 * ausgeben» die volle Akzentfläche — dreimal je Zeile, vierzehn Zeilen lang.
	 */
	button:not(.handlung) {
		min-height: var(--ziel-min);
		padding: 0 1.15rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	button.leise {
		background: transparent;
		border: 1px solid var(--linie);
		color: var(--text-leise);
		padding: 0 0.8rem;
		font-size: 0.85rem;
		font-weight: 400;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		max-width: 46rem;
		margin-top: 1rem;
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}
	/*
	 * Die Kartenform selbst steht in app.css — hier nur, was diese Liste
	 * eigenes hat: die grüne Kante für Anwesende, Luft vor den Schaltflächen,
	 * und der Zusatz «Stimme: …», der zum Namen gehört, aber nicht in seine
	 * Stärke.
	 */
	@media (max-width: 46rem) {
		tbody tr {
			border-left: 4px solid var(--linie);
		}

		tbody tr.anwesend {
			border-left-color: var(--akzent);
		}

		td.kopfzelle .klein {
			font-weight: 400;
		}

		/* Die Handlungen stehen unten, mit Luft — dort wird getippt. */
		td.tat {
			padding-top: 0.5rem;
		}

		/* Beschriftung und Wert auf einer Zeile: «Gerät:» und darunter ein
		   Gedankenstrich wirkte wie zwei Angaben statt einer. */
		td[data-spalte] > .klein:first-child {
			display: inline;
		}
	}







	.beamerzeile {
		margin: 0.5rem 0 1rem;
	}

	.eroeffnen {
		margin-bottom: 1.25rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--linie);
		border-left: 4px solid var(--akzent);
		border-radius: var(--radius);
		background: var(--flaeche);
		max-width: 46rem;
	}

	.eroeffnen h2 {
		margin-top: 0;
		font-size: 1rem;
	}

	.eroeffnen form {
		margin-top: 0.75rem;
	}
</style>
