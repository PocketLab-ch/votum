<script lang="ts">
	import Hilfetext from '$lib/components/Hilfetext.svelte';
	import { untrack } from 'svelte';
	import { aufgeklappt } from '$lib/felder';
	import { enhance } from '$app/forms';
	import { nachziehen, type Nachzug } from '$lib/nachziehen';
	import Ergebniskarte from '$lib/components/Ergebniskarte.svelte';
	import Modellantwort from '$lib/components/Modellantwort.svelte';
	import Meldung from '$lib/components/Meldung.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';
	import {
		aktualisiereVergleich,
		gehoertZuTraktandum,
		holeGemerktenVorschlag,
		istErledigt,
		merkeVorschlag,
		vorschlagMerker,
		type VorschlagAnzeige
	} from '$lib/vorschlagmerker';

	let { data, form } = $props();

	/*
	 * **Nachziehen statt `invalidateAll()` direkt** — der Wächter `check:stroeme`
	 * verlangt es, und aus gutem Grund: Ein Abruf, den der nächste
	 * Formularversand abreisst, hinterlässt «Failed to fetch» in der Konsole und
	 * lässt einen Browserdurchlauf scheitern, in dem alle Schritte grün waren.
	 * Der Aufruf gehört in den Effekt, nicht daneben: `nachziehen()` hängt sich
	 * an `window`, und beim Rendern auf dem Server gibt es das nicht.
	 */
	let nach: Nachzug | undefined = $state();
	$effect(() => {
		const n = nachziehen();
		nach = n;
		return () => {
			n.ende();
			nach = undefined;
		};
	});

	/*
	 * **Der Vorschlag übersteht ein Neuladen** (Befund Praxisdurchlauf
	 * 03.10.2026, Punkt 2). Bis hierher lebte er allein im Formularergebnis:
	 * Ein Druck auf F5, und eine Einschätzung, die ein Modellaufruf gekostet
	 * hat, war weg. Gemerkt wird im Sitzungsspeicher des Tabs, nicht auf dem
	 * Server — warum, steht im Baustein.
	 *
	 * **Der Schlüssel folgt dem Traktandum.** Der Baum besteht aus Verweisen
	 * auf dieselbe Route; SvelteKit tauscht nur `data` aus. Ein einmal
	 * gerechneter Schlüssel bliebe deshalb beim ersten Traktandum stehen, und
	 * die Karte des Nachbarn stünde am falschen Ort.
	 *
	 * `$state.raw`, weil der Wert nur als Ganzes ersetzt wird.
	 */
	const vorschlagsmerker = $derived(vorschlagMerker(data.versammlung.id, data.traktandum.id));
	let gemerkterVorschlag = $state.raw<VorschlagAnzeige | null>(null);
	/** Zu welchem Traktandum der gemerkte Wert gehört; `null`, solange keiner geholt wurde. */
	let gemerkterSchluessel = $state<string | null>(null);

	/**
	 * Der frische Vorschlag, und nur, wenn er zu diesem Traktandum gehört
	 * (Zweitprüfung 04.10.2026, mittel 1). Der Pfadname ist für alle
	 * Traktanden derselbe; wechselt die Leitung während des Modellaufrufs,
	 * träfe die Antwort sonst am Nachbarn ein, samt Merker.
	 */
	const frischerVorschlag = $derived(
		form?.vorschlag && gehoertZuTraktandum(form.vorschlag, data.traktandum.id)
			? form.vorschlag
			: null
	);

	$effect(() => {
		const schluessel = vorschlagsmerker;
		// Ein neues Ergebnis ersetzt das gemerkte — es ist der jüngere Stand.
		if (frischerVorschlag) {
			merkeVorschlag(sessionStorage, schluessel, frischerVorschlag);
			gemerkterVorschlag = null;
			gemerkterSchluessel = schluessel;
			return;
		}
		// Ohne Ergebnis im Formular: aus dem Sitzungsspeicher holen, einmal je
		// Traktandum. Auch eine spätere Absage lässt den Vorschlag im
		// Sitzungsspeicher stehen: Sie sagt nur, dass der neue Versuch nicht
		// ging; nach einem Neuladen ist er wieder da.
		if (gemerkterSchluessel !== schluessel) {
			const gemerkt = holeGemerktenVorschlag(sessionStorage, schluessel);
			// Ist das Erfordernis inzwischen auf genau diesen Fall gesetzt, ist
			// der Vorschlag erledigt und die Karte bleibt weg (Codeprüfung M3).
			gemerkterVorschlag =
				gemerkt && !istErledigt(gemerkt, data.traktandum.erfordernis?.knotenId) ? gemerkt : null;
			gemerkterSchluessel = schluessel;
		}
	});

	/**
	 * Was die Karte zeigt: der frische Vorschlag, sonst der gemerkte. Der
	 * Vergleich wird dabei gegen den heutigen Stand gerechnet (Codeprüfung
	 * 04.10.2026, mittel 1): Gemerkt wäre er vom Tag der Anfrage und stünde
	 * nach einer späteren Änderung des Erfordernisses über einem Stand, den es
	 * nicht mehr gibt.
	 */
	const angezeigterVorschlag = $derived(
		aktualisiereVergleich(
			frischerVorschlag ?? gemerkterVorschlag,
			data.traktandum.erfordernis ?? null
		)
	);

	const wurzel = $derived(
		`/versammlungen/${data.versammlung.id}/traktanden/${data.traktandum.id}/erfordernis`
	);

	function pfadUrl(astId: string, antwortIds: string[]): string {
		const p = new URLSearchParams();
		if (astId) p.set('ast', astId);
		if (antwortIds.length > 0) p.set('p', antwortIds.join(','));
		const s = p.toString();
		return s ? `${wurzel}?${s}` : wurzel;
	}

	const bisherige = $derived(data.stand ? data.stand.schritte.map((s) => s.antwortId) : []);

	/**
	 * Welcher Typ im Formular «ohne Herleitung» gerade gewählt ist.
	 *
	 * Davon hängt ab, welche Bezugsgrössen zur Wahl stehen: Beim einfachen Mehr
	 * die Köpfe, beim qualifizierten zusätzlich die Wertquoten, bei der
	 * Einstimmigkeit keine.
	 */
	let gesetzterTyp = $state(untrack(() => data.waehlbar[0]?.typ ?? 'einfaches_mehr'));
	const basen = $derived(data.waehlbar.find((w) => w.typ === gesetzterTyp)?.basen ?? null);

	/**
	 * Dasselbe für das Formular am Ende des Baums («Anderes Erfordernis setzen»).
	 *
	 * **Warum eigene Zustände** und nicht die von oben: Beide Formulare stehen
	 * nie gleichzeitig auf der Seite — das eine gehört zur Astliste, das andere
	 * zum Ergebnis.
	 *
	 * **Die Basen beginnen leer** (Nachprüfung 23.08.2026). Zuerst standen sie
	 * auf der ersten erlaubten Option, und das Formular schickte sie damit
	 * IMMER mit. Für «Ermächtigung zur Ausschlussklage» (ZGB Art. 649b Abs. 2)
	 * war das falsch: Der Fall trägt die Bezugsgrösse «alle ausser den
	 * Betroffenen», und die steht in keiner Auswahlliste — `waehlbareBasen`
	 * kennt nur die beiden, zwischen denen es etwas zu wählen gibt. Wer den Typ
	 * änderte, verlor die gesetzliche Basis stillschweigend an
	 * «anwesend_vertreten»: Bei zehn Eigentümern, einer betroffen, vier
	 * erschienen, wären statt fünf Ja-Stimmen noch drei nötig gewesen — und der
	 * Beklagte hätte wieder mitgezählt.
	 *
	 * Leer heisst «wie vorgeschlagen», und `uebersteuere()` erbt dann. Das ist
	 * zugleich der richtige Anfangswert, wenn `data` beim Erzeugen der
	 * Komponente noch keinen Vorschlag trägt — der Regelfall, denn der Baum
	 * wird geklickt und die Komponente dabei nicht neu erzeugt.
	 */
	let abweichenderTyp = $state(untrack(() => data.stand?.erfordernis?.typ ?? 'einfaches_mehr'));
	let abweichendeKopfbasis = $state('');
	let abweichendeQuotenbasis = $state('');
	const abweichendeBasen = $derived(
		data.waehlbar.find((w) => w.typ === abweichenderTyp)?.basen ?? null
	);

	/*
	 * **Der Typ folgt dem Vorschlag, bis jemand selbst wählt.**
	 *
	 * `$state(untrack(...))` allein wertet einmal beim Erzeugen der Komponente
	 * aus — und auf dem üblichen Weg ist `data.stand` da noch `null`: Der Baum
	 * besteht aus Verweisen auf dieselbe Route, SvelteKit tauscht nur `data`
	 * aus. Die Auswahl stand deshalb auf «Einfaches Mehr», gleich was
	 * vorgeschlagen war; wer nur die Bezugsgrösse ändern wollte, setzte
	 * nebenbei die Mehrheit herab.
	 *
	 * Der Effekt hängt an `data` und schreibt unter `untrack`. Eine Handwahl
	 * ändert `data` nicht und bleibt deshalb stehen; ein Schritt im Baum ändert
	 * es und setzt zurück — genau dann soll er auch zurücksetzen.
	 */
	$effect(() => {
		const vorschlag = data.stand?.erfordernis?.typ;
		if (!vorschlag) return;
		/*
		 * **Nur, was auch wählbar ist** (gefunden im Durchgang, 23.08.2026).
		 *
		 * Der Vorschlag kann ein Typ sein, den man gar nicht setzen kann — ein
		 * Reglementsmehr etwa steht nicht in `WAEHLBARE_TYPEN`. Ungeprüft
		 * geschrieben stand das Pflichtfeld auf einem Wert, den keine Option
		 * trägt: Der Browser zeigte es LEER, und das Formular liess sich nicht
		 * mehr abschicken. Dann lieber der erste Eintrag, wie bisher.
		 */
		/*
		 * Und wenn er nicht wählbar ist, NICHT der erste Eintrag: Der heisst
		 * «keine Abstimmung», und wer in einem Formular für das
		 * Mehrheitserfordernis nicht aufpasst, macht daraus lautlos eine
		 * Kenntnisnahme. Das einfache Mehr ist der harmlose Rückfall — es
		 * beschliesst, aber verschärft nichts.
		 */
		const waehlbar = data.waehlbar.some((w) => w.typ === vorschlag)
			? vorschlag
			: data.waehlbar.some((w) => w.typ === 'einfaches_mehr')
				? 'einfaches_mehr'
				: (data.waehlbar[0]?.typ ?? 'einfaches_mehr');
		untrack(() => {
			abweichenderTyp = waehlbar;
			abweichendeKopfbasis = '';
			abweichendeQuotenbasis = '';
		});
	});
</script>


<h1>{data.nummer} {data.traktandum.titel}</h1>

{#if data.traktandum.antragswortlaut}
	<p class="wortlaut">{data.traktandum.antragswortlaut}</p>
{/if}

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{/if}

{#if !data.aenderbar}
	<p class="meldung">{data.sperrgrund}</p>
{:else if data.nachDemVersand}
	<!--
		**Das Mehr der Einladung ist die Untergrenze** (Migration 144,
		Produktentscheide 27.09. und 06.10.2026). Hier stand bis zum 06.10.2026,
		eine Änderung im Saal sei «ausdrücklich vorgesehen» und gehöre als
		Entscheid ins Protokoll. Das Mehr wird aber nicht beschlossen, sondern von
		der Leitung bestimmt, und milder als die Einladung geht es im Saal nicht.
		Die Seite nennt die Untergrenze vorab, damit niemand erst an der Absage
		merkt, dass sie gilt.
	-->
	<p class="meldung hinweis">
		{#if data.einladungsmehrVon && !data.einladungsmehr}
			<!-- Ein Folgeantrag hält das Mehr seines angekündigten Traktandums; dort
			     war keines eingestellt (Produktentscheid 06.10.2026, «Ja, dieselbe
			     Untergrenze»). -->
			Bei der Freigabe war für «{data.einladungsmehrVon}» kein Mehr eingestellt. Nennt die
			verschickte Einladung für «{data.einladungsmehrVon}» eines, halten Sie es auch für diesen
			Folgeantrag als Untergrenze ein.
		{:else if !data.einladungsmehr}
			<!-- «die verschickte Einladung» statt «Ihre selbst geschriebene» (Laienprüfung
			     R2-3, Fachprüfung FP2-11, 06.10.2026): Massgebend ist, was hinausging. -->
			Bei der Freigabe war für dieses Traktandum kein Mehr eingestellt. Es lässt sich bis zur
			Abstimmung setzen. Nennt die verschickte Einladung eines, halten Sie dieses als
			Untergrenze ein.
		{:else if data.einladungsmehrVon}
			<!-- Ein Folgeantrag hält das Mehr seines angekündigten Traktandums
			     (Produktentscheid 06.10.2026, «Ja, dieselbe Untergrenze»). -->
			<!-- In zwei Sätzen und als Regel der Anwendung (Fachprüfung FP3-3, Länge nach
			     Codeprüfung N1, Runde 4 vom 06.10.2026). -->
			Für «{data.einladungsmehrVon}» nennt die Einladung <strong>{data.einladungsmehr}</strong>.
			Die Anwendung verlangt dieses Mehr auch für diesen Folgeantrag. Im Saal lässt sich ein strengeres
			Mehr setzen, ein milderes nicht.
		{:else if data.imSaal}
			Die Einladung nennt <strong>{data.einladungsmehr}</strong>. Im Saal lässt sich ein
			strengeres Mehr setzen, ein milderes nicht.
		{:else}
			Die Einladung nennt <strong>{data.einladungsmehr}</strong>. Ein strengeres Mehr lässt sich
			bis zur Abstimmung setzen. Ein milderes lässt die Anwendung nach dem letzten Tag der erfassten
			Einberufungsfrist nur zu, wenn es für die Gemeinschaft unter «Reglement und Quoren» so
			eingestellt ist.
			<!-- An der Einstellung der Gemeinschaft (Produktentscheid 07.10.2026, Migration 148,
			     Vorgabe «nicht zulassen»). Die Seite kennt die Einstellung nicht; der Satz stimmt
			     deshalb in beiden. Bis 07.10.2026 als feste Regel: «nur zu, solange die
			     berichtigte Einladung noch bis zum letzten Tag … bei allen eintreffen kann». -->
			<!-- «An alle, die eingeladen werden»: Fachprüfung 5, Rz. 56, 58 ad Art. 712n.
			     Der Anlass zuerst, dann der Rat zur Frist (Laienprüfung Runde 3, L2). -->
			<!-- Runde 1, 07.10.2026: als Empfehlung (Fachprüfung B5; bis dahin «muss die
			     Einladung neu an alle») und der Satz `VERANTWORTUNG` (Laienprüfung Punkt 10). -->
			Für ein milderes sollte eine berichtigte Einladung an alle gehen, die zur Versammlung dieser
			Gemeinschaft eingeladen werden. Kommt sie nicht rechtzeitig bei allen an, kann ein Beschluss mit dem milderen Mehr angefochten werden.
			<!-- Folge seit dem Produktentscheid 07.10.2026 «1a» (Laienprüfung Runde 2, N1). -->
			Die Anwendung nimmt den Haken «Die Einladung ist verschickt»
			zurück und weist auf der Seite Vorbereitung darauf hin. Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.
			<!-- Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»: Bis 07.10.2026 stand
			     hier, ohne rechtzeitig wieder gesetzten Vermerk nehme die Anwendung beim Eröffnen
			     wieder dieses Mehr. Einen Rückfall gibt es seither nicht. -->
			<!-- Korrekturrunde 06.10.2026 (Codeprüfung N5): Die Seite kennt die Frist nicht,
			     der Satz steht deshalb immer. Seit 07.10.2026 «kennt den letzten Tag nicht»
			     statt «prüft die Frist nicht»: Die Anwendung prüft den Empfang ohnehin nicht. -->
			Ist keine Einberufungsfrist erfasst, kennt die Anwendung den letzten Tag nicht. Erfassen Sie
			die Frist Ihres Reglements unter «Reglement und Quoren»; nennt es keine, mindestens zehn Tage.
			{#if data.einladungsmehrGemildert}
				<!-- Laienprüfung Teil 2 Runde 3, Punkt 1: was «zurückstellen» hier heisst. -->
				Seit der Freigabe ist das Mehr hier gemildert. Setzen Sie wieder dieses Mehr oder ein strengeres,
				ist die Milderung aufgehoben; steht keine andere aus, entfällt der Hinweis auf der Seite
				Vorbereitung.
				<!-- Laienprüfung L1, Nachtrag: Die Milderung hat den Haken zurückgenommen,
				     falls er stand; «neu», nicht «wieder». -->
				Setzen Sie danach auf der Seite Vorbereitung den Haken «Die Einladung ist verschickt»,
				sobald die bisherige Einladung verschickt ist; ist sie das schon, gleich.
			{/if}
		{/if}
		Jede Änderung steht mit Zeitpunkt und Person im Verlauf.
	</p>
{/if}

{#if data.traktandum.erfordernis}
	<p class="bisher">
		Bisher gesetzt: <strong>{data.traktandum.erfordernis.titel}</strong>
		nach Fassung {data.traktandum.erfordernis.fassung}
		({data.traktandum.erfordernis.quelle === 'hergeleitet'
			? 'hergeleitet'
			: data.traktandum.erfordernis.quelle === 'reglement'
				? 'aus dem Reglement'
				: 'von der Sitzungsleitung gesetzt'}).
	</p>
{/if}

<!--
	**Der Vorschlag steht vor dem Baum, nicht statt seiner.**
	Er sagt der Sitzungsleitung, wo sie anfangen soll (FR-59).

	**Seit dem 03.09.2026 kann sie ihm folgen, ohne den Baum von Hand zu
	durchlaufen** (Auftraggeber, Praxisdurchlauf): «Ich folge der Empfehlung» setzt das
	Erfordernis — hergeleitet über denselben Baum, mit derselben
	Fassungskennung. Das Modell wählt die Antworten, das Regelwerk zieht daraus
	den Schluss. Die beiden anderen Entscheide setzen weiterhin nichts.
-->
{#if data.ki.anzeigen}
<section class="kivorschlag" class:aus={!data.ki.verfuegbar}>
	<h2>Einschätzung holen</h2>
	{#if data.ki.verfuegbar}
		<p class="hilfe">
			Das Modell beantwortet dieselben Rückfragen, die unten stehen — eine nach der anderen.
			Heraus kommt eine <strong>Empfehlung</strong>. Folgen Sie ihr, wird das Erfordernis über
			denselben Entscheidbaum hergeleitet, den Sie unten auch von Hand durchlaufen können —
			nach einer Rückfrage, die den Fall nennt.
		</p>
		<p class="warnung">
			<strong>Lesen Sie die Antworten, nicht das Ergebnis.</strong> Eine falsche Einordnung
			steht immer als falsche Antwort im Weg unten — «Ja, sie erhält Wert oder
			Gebrauchsfähigkeit» für einen Lift, den es vorher gar nicht gab. Wer den Weg Zeile für
			Zeile liest, findet so etwas in Sekunden; wer nur das Ergebnis liest, übernimmt es.
		</p>
		<form method="POST" action="?/kivorschlag" use:enhance>
			<button type="submit" class="leise">Fall vorschlagen lassen</button>
		</form>
	{:else}
		<p class="hilfe">{data.ki.grund}</p>
	{/if}

	{#if angezeigterVorschlag}
		{@const v = angezeigterVorschlag}
		{#if v.stufe === null}
			<p class="fehlschlag">
				Keine Einschätzung möglich: {v.fehlschlaege.join(' · ')}. Der Entscheidbaum unten
				funktioniert unverändert.
			</p>
		{:else if !v.vorschlag}
			<p class="fehlschlag">{v.grund ?? 'Es kam kein brauchbarer Vorschlag zurück.'}</p>
		{:else}
			<div class="vorschlagskarte" class:grenzfall={v.vorschlag.grenzfall}>
				<p class="fall">
					<span class="ast">{v.vorschlag.astTitel}</span>
					<strong>{v.vorschlag.titel}</strong>
				</p>
				<p class="grundlage">{v.vorschlag.rechtsgrundlage}</p>

				<!--
					**Die Rückfragen, die dorthin führen** (FR-59, wörtlich).
					Ohne sie wäre der Vorschlag zu glauben statt nachzuvollziehen —
					und genau das soll die Sitzungsleitung nicht tun.

					**Und der Weg trägt die Umrandung** (Abnahme zu B-09, 08.08.2026).
					Bei der ersten Runde blieb er ungekennzeichnet, weil Audit und
					Handbuch annahmen, das Modell gebe hier nur Antwortkennungen zurück.
					Es gibt auch eine **Begründung** je Schritt zurück, und die ist
					ungeprüfter freier Text — gelesen aus dem Antragstext, der von einem
					Eigentümer stammen darf.

					Der Fall darüber (`astTitel`, `titel`, `rechtsgrundlage`) steht
					ausserhalb: Den rechnet `laufe()` aus dem Regelwerk. Innerhalb steht
					nur, was das Modell gewählt und geschrieben hat — die Fragetexte
					kommen zwar aus dem Entscheidbaum, aber **welche** Frage hier
					auftaucht, hat das Modell bestimmt.
				-->
				<Modellantwort stufe={v.stufe}>
					<ol class="weg">
						{#each v.vorschlag.schritte as s (s.frageId)}
							<li>
								<span class="frage">{s.frageText}</span>
								<span class="antwort" class:unsicher={s.unsicher}>{s.antwortText}</span>
								{#if s.begruendung}<span class="warum">{s.begruendung}</span>{/if}
							</li>
						{/each}
					</ol>
				</Modellantwort>
				{#if v.vorschlag.grenzfall}
					<p class="grenzhinweis">
						Das Modell hält das für einen <strong>Grenzfall</strong> und nennt deshalb das
						strengere Erfordernis. Hier lohnt sich die eigene Prüfung besonders.
					</p>
				{/if}
			</div>

			{#if v.vergleich}
				<p class="vergleich" class:auffaellig={v.vergleich.auffaellig}>{v.vergleich.satz}</p>
			{/if}

			{#if v.nutzungId}
				<!--
					**«Ich folge der Empfehlung» setzt das Erfordernis** (Auftraggeber,
					03.09.2026). Vorher schrieb der Knopf nur den Nachweis, und
					wer ihm glaubte, stand danach ohne Erfordernis da.

					**Er steht in einem eigenen Formular**, weil er etwas anderes
					tut als seine beiden Nachbarn: Die sagen, dass die
					Sitzungsleitung selbst entscheidet, und dürfen nichts setzen.

					**Mit `use:enhance`:** Der Rückfragedialog fängt den *Klick* ab und
					schickt danach selbst ab — beides verträgt sich (so steht es auch
					im Gestaltungsdokument). Ohne `enhance` lud eine Absage die Seite
					neu, und der Vorschlag samt Weg war weg; das ist im Saal der
					teuerste Moment für einen Neuanfang (aus dem Code-Review).
				-->
				<form
					method="POST"
					action="?/kifolgen"
					class="entscheid folgen"
					use:enhance={() => async ({ result, update }) => {
						/*
						 * **Nach der Absage den heutigen Stand holen** (Zweitprüfung
						 * 04.10.2026, niedrig 2; berichtigt nach dem zweiten Blick).
						 * Ist das Erfordernis gesetzt und scheitert nur der Nachweis
						 * über die KI-Nutzung, kommt die Meldung als `fail(400)`;
						 * SvelteKit lädt `data` dabei nicht neu. Die Karte blieb dann
						 * samt veraltetem Vergleich stehen, `istErledigt` griff nicht,
						 * und erst ein Neuladen zeigte den neuen Stand.
						 *
						 * **Warum nicht `update({ invalidateAll: true })`:** SvelteKit
						 * führt das Nachladen nur im Erfolgszweig aus (`forms.js`,
						 * `fallback_callback`); bei einer Absage bewirkt die Option
						 * nichts. Deshalb `update()` für den Formularstand und danach
						 * `nachziehen()` — der Hausweg, den auch `check:stroeme`
						 * verlangt.
						 */
						await update();
						if (result.type === 'failure') await nach?.jetzt();
					}}
				>
					<input type="hidden" name="nutzungId" value={v.nutzungId} />
					<input type="hidden" name="ast" value={v.vorschlag.astId} />
					<input type="hidden" name="p" value={v.vorschlag.schritte.map((s) => s.antwortId).join(',')} />
					<span>Ihr Entscheid:</span>
					<Rueckfrage
						beschriftung="Ich folge der Empfehlung"
						ton="gut"
						frage="Erfordernis auf «{v.vorschlag.titel}» setzen?"
						folge="Das Traktandum bekommt {v.vorschlag.rechtsgrundlage}. Die Herleitung entsteht über den Entscheidbaum, nicht über das Modell — sie steht später im Protokoll."
						bestaetigen="Erfordernis setzen"
					/>
				</form>
				<form method="POST" action="?/kientscheid" class="entscheid" use:enhance>
					<input type="hidden" name="nutzungId" value={v.nutzungId} />
					<!--
						**Enter rät hier nichts.** Beide Knöpfe sind gleichwertige
						Entscheide der Sitzungsleitung; einen davon zur Vorgabe zu
						machen hiesse, den Nachweis von der Eingabetaste schreiben
						zu lassen. Vorher trug «Ich folge der Empfehlung» die
						Vorgabe — der Knopf steht jetzt in seinem eigenen Formular.
					-->
					<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
					<button type="submit" name="entscheid" value="veraendert" class="leise">
						Ich nehme sie als Ausgangspunkt
					</button>
					<button type="submit" name="entscheid" value="abgelehnt" class="leise">
						Ich entscheide anders
					</button>
				</form>
			{/if}

			<p class="selberlaufen">
				<strong>Durchlaufen Sie den Baum trotzdem.</strong> Was unten herauskommt, trägt die
				Fassungskennung und steht später im Protokoll; diese Einschätzung nicht. Sie ist auch
				nicht reproduzierbar — derselbe Text kann morgen anders eingeordnet werden.
			</p>

			<details class="hinausgegangen">
				<summary>Was übermittelt wurde</summary>
				<pre>{v.hinausgegangen}</pre>
			</details>
			<p class="herkunft">
				{v.stufe}, {(v.dauerMs / 1000).toFixed(1)} s,
				{v.namenGeschuetzt === 0 ? 'keine Namen im Text' : v.namenGeschuetzt + ' Namen ersetzt'}
			</p>
		{/if}
	{/if}
</section>
{/if}

{#if !data.stand}
	<h2>Worum geht es?</h2>
	<ul class="kacheln">
		{#each data.aeste as ast (ast.id)}
			<li>
				<a href={pfadUrl(ast.id, [])}>
					<span class="titel">{ast.titel}</span>
					<span class="unter">{ast.beschreibung}</span>
				</a>
			</li>
		{/each}
	</ul>

	{#if data.aenderbar}
		<details class="ohne-baum">
			<summary>Erfordernis ohne Herleitung setzen</summary>
			<p class="hilfe">
				Möglich, aber begründungspflichtig: Ohne Pfad durch den Baum steht im Verlauf nur die
				Entscheidung, nicht der Weg dorthin.
			</p>
			<form method="POST" action="?/setzen" class="felder">
				<label>
					Erfordernis
					<Suchauswahl
						name="typ"
						beschriftung="Erfordernis"
						pflicht
						bind:wert={gesetzterTyp}
						eintraege={data.waehlbar.map((w) => ({ wert: w.typ, text: w.bezeichnung }))}
					/>
				</label>

				<!--
					**Die Bezugsgrösse gehört dazu** (Auftraggeber, 11.08.2026): «Es gibt halt
					Mehrheit aller und Mehrheit der anwesenden Köpfe, als Beispiel. Das
					wird nicht abgebildet.» Der Typ sagt, wie hoch die Schwelle liegt;
					wovon, sagt die Basis. Bei zwölf Eigentümern, von denen sieben
					erschienen sind, heisst «einfaches Mehr» vier Stimmen oder sieben.

					Nur wo das Gesetz die Basis nicht festlegt: Bei der Einstimmigkeit
					gibt es nichts zu wählen — Einstimmigkeit unter den Erschienenen ist
					keine.
				-->
				{#if basen && basen.kopf.length > 1}
					<label>
						Mehrheit wovon?
						<Suchauswahl
							name="kopfbasis"
							beschriftung="Mehrheit wovon?"
							eintraege={basen.kopf.map((b) => ({ wert: b.wert, text: `Mehrheit ${b.text}` }))}
						/>
					</label>
				{/if}
				{#if basen && basen.quoten.length > 1}
					<label>
						Wertquoten wovon?
						<Suchauswahl
							name="quotenbasis"
							beschriftung="Wertquoten wovon?"
							eintraege={basen.quoten.map((b) => ({ wert: b.wert, text: b.text }))}
						/>
					</label>
				{/if}

				<label class="breit">
					Begründung
					<textarea name="begruendung" rows="2" required minlength="3"></textarea>
				</label>
				<button type="submit">Setzen</button>
			</form>
		</details>
	{/if}
{:else}
	<nav class="weg" aria-label="Bisherige Antworten">
		<a href={pfadUrl('', [])}>Vorhaben</a>
		{#each data.stand.schritte as schritt, i (schritt.antwortId)}
			<span aria-hidden="true">›</span>
			<a href={pfadUrl(data.stand.astId, bisherige.slice(0, i))}>{schritt.antwortText}</a>
		{/each}
	</nav>

	{#if data.stand.art === 'frage'}
		<h2>{data.stand.frage.text}</h2>
		{#if data.stand.frage.hilfeTeile}
			<Hilfetext teile={data.stand.frage.hilfeTeile} />
		{/if}
		<!--
			**Was die Gemeinschaft hinterlegt hat, steht an der Frage** (Auftraggeber,
			28.08.2026, Migration 101).

			Vorher musste man wissen, dass das eigene Reglement für seine Änderung
			Einstimmigkeit verlangt — die Antwort dazu steht in dieser Liste unter
			fünf anderen, und wer sie nicht kannte, wählte «gewöhnliche
			Bestimmung». Der Hinweis nennt jetzt den Artikel.

			**Mit Ausnahme** (Codeprüfung F4c Block 1, Befund 1; Lesart L6): Unter
			«Nach dem Gesetz» rechnet die eigene Schranke das qualifizierte Mehr;
			Quoren, Nutzungsrechte und die übrigen Bestimmungen mit eigener Antwort
			gehören dorthin (`SELBST_HILFE`, Fassung 2026-11-05). Ohne Ausnahme schickte
			der Satz sie zum milderen Mehr; «eine eigene Antwort» allein hätte auch die
			gewöhnliche Bestimmung weggeschickt (Laien- und Fachprüfung, Nachtrag N-1).

			**Gezeigt, nicht gesetzt**: Entschieden wird hier, nicht im Formular
			der Gemeinschaft. Eine Antwort, die niemand getroffen hat, stünde
			später im Protokoll als hätte sie jemand getroffen.
		-->
		{#if data.aenderungsschranke && data.stand.frage.antworten.some((a) => a.id === 'f3-1-selbst')}
			<p class="meldung hinweis">
				Diese Gemeinschaft hat hinterlegt: <strong>Das Reglement verlangt für seine eigene
				Änderung Einstimmigkeit</strong>{#if data.aenderungsschranke.fundstelle}
					({data.aenderungsschranke.fundstelle}){/if}. Geht es um eine Änderung des Reglements,
				ist das die zutreffende Antwort, auch bei einer gewöhnlichen Bestimmung. Ausgenommen sind nur
				die Bestimmungen, die die Hilfe an dieser Antwort nennt.
			</p>
		{/if}
		<!--
			**Die Bestimmung zur Einlage in den Erneuerungsfonds** (Migration 193),
			nach demselben Muster: gezeigt, nicht gesetzt. Ob der Antrag über der
			Grenze liegt, steht im Antrag, nicht in einem Feld; deshalb nennt die
			Kachel nur, welche Antworten zur hinterlegten Art passen.
		-->
		{#if data.fondsgrenze && data.stand.frage.id === data.fondsgrenze.frage}
			<p class="meldung hinweis">{data.fondsgrenze.satz}</p>
		{/if}
		{#if data.fondsgrenzeSchranke && data.stand.frage.id === data.fondsgrenzeSchranke.frage}
			<p class="meldung hinweis">{data.fondsgrenzeSchranke.satz}</p>
		{/if}
		<ul class="kacheln antworten">
			{#each data.stand.frage.antworten as antwort (antwort.id)}
				<li>
					<a href={pfadUrl(data.stand.astId, [...bisherige, antwort.id])}>
						<span class="titel">{antwort.text}</span>
						{#if antwort.hilfe}<span class="unter">{antwort.hilfe}</span>{/if}
						{#if data.fondsgrenze && data.stand.frage.id === data.fondsgrenze.frage && data.fondsgrenze.antworten.includes(antwort.id)}
							<span class="unter">Passt zur Art der Bestimmung, die Ihre Gemeinschaft hinterlegt hat.</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<Ergebniskarte karte={data.stand.karte} urheberschaft={data.stand.urheberschaft} />

		{#if data.aenderbar}
			{#if data.stand.erfordernis.typ === 'grenzfall'}
				<p class="meldung warnung">
					Bei einem Grenzfall steht kein Erfordernis fest. Entscheiden Sie ausdrücklich, welches
					gelten soll — im Saal ist es dafür zu spät.
				</p>
			{:else}
				<form method="POST" action="?/uebernehmen" class="uebernehmen">
					<input type="hidden" name="ast" value={data.stand.astId} />
					<input type="hidden" name="p" value={bisherige.join(',')} />
					<button type="submit">Für dieses Traktandum übernehmen</button>
				</form>
			{/if}

			<details class="ohne-baum" {...aufgeklappt(data.stand.erfordernis.typ === 'grenzfall')}>
				<summary>Anderes Erfordernis setzen</summary>
				<p class="hilfe">
					Der Vorschlag stammt vom Werkzeug. Entscheidet die Sitzungsleitung anders, gehören
					Vorschlag, Abweichung und Begründung in den Verlauf.
				</p>
				<form method="POST" action="?/setzen" class="felder">
					<input type="hidden" name="ast" value={data.stand.astId} />
					<input type="hidden" name="p" value={bisherige.join(',')} />
					<!--
						**Was das Setzen von Hand kostet** (23.08.2026, Prüflauf I, B-19).

						Im Grenzfall wird die hinterlegte Reglementsregel nicht angewandt
						— das sagt der Kasten oben. Was er nicht sagte: Wer hier von Hand
						setzt, verliert sie endgültig, samt ihrer Wertquotenschranke. Der
						Prüfer hat es ausprobiert und mit der Auszählmappe gegengelesen:
						«ich merke es nirgends».

						Deshalb steht hier auch der Weg zurück — der Baum kennt eine
						Antwort, mit der die Regel gilt.
					-->
					{#if data.stand.regelVorbehalten}
						<p class="hilfe voll warnung">
							<strong>Achtung:</strong> Setzen Sie hier von Hand, gilt die Reglementsregel
							{data.stand.regelVorbehalten.fundstelle} <strong>nicht</strong>
							{#if data.stand.regelVorbehalten.mitQuotenschranke}
								— auch ihre Wertquotenschranke nicht
							{/if}. Wollen Sie beides, gehen Sie
							<a href={pfadUrl(data.stand.astId, bisherige.slice(0, -1))}>eine Frage zurück</a>
							und entscheiden Sie den Grenzfall.
						</p>
					{/if}
					<label>
						Erfordernis
						<!--
							`bind:wert` am Baustein: Die Bezugsgrössen darunter hängen am
							gewählten Typ, also muss er reaktiv sein — dasselbe wie im Formular
							ohne Baum. Am `<select>` selbst stünde dafür **kein** `bind:value`;
							der Baustein löst die Falle (`$lib/felder`, `gefuehrteWahl`).
						-->
						<Suchauswahl
							name="typ"
							beschriftung="Erfordernis"
							pflicht
							bind:wert={abweichenderTyp}
							eintraege={data.waehlbar.map((w) => ({ wert: w.typ, text: w.bezeichnung }))}
						/>
					</label>

					<!--
						**Die Bezugsgrösse gehört auch hierher** (Prüflauf I, B-16/B-19).

						Sie stand bis zum 23.08.2026 nur im Formular ohne Baum — und das
						ist der seltenere Weg. Wer den Entscheidbaum durchlief und am Ende
						abwich, bekam vier Grobstufen und erbte stillschweigend die Basis
						des Vorschlags. «Zwei Drittel der Anwesenden statt aller» war so
						nicht zu setzen, obwohl das im Stockwerkeigentum der häufigste
						Streitpunkt ist.

						Voreingestellt ist, was der Vorschlag sagt: Wer nur die Höhe ändern
						will, ändert nur die Höhe.
					-->
					{#if abweichendeBasen && abweichendeBasen.kopf.length > 1}
						<label>
							Mehrheit wovon?
							<!--
								`leerText` heisst «erben». Ohne diesen Eintrag schickte das Formular
								immer eine Basis mit und überschrieb damit auch die, die das
								Gesetz selbst nennt und die hier gar nicht zur Wahl steht.
							-->
							<Suchauswahl
								name="kopfbasis"
								beschriftung="Mehrheit wovon?"
								leerText="— wie vorgeschlagen —"
								bind:wert={abweichendeKopfbasis}
								eintraege={abweichendeBasen.kopf.map((b) => ({
									wert: b.wert,
									text: `Mehrheit ${b.text}`
								}))}
							/>
						</label>
						<!-- Die Angehörigen des Beklagten (L10) hängen an dieser Wahl
						     (Entscheid 0047, 2; `angehoerigeBeimSetzen`). -->
						{#if data.stand.angehoerigeBeimSetzen}
							<p class="hilfe voll">{data.stand.angehoerigeBeimSetzen}</p>
						{/if}
					{/if}
					{#if abweichendeBasen && abweichendeBasen.quoten.length > 1}
						<label>
							Wertquoten wovon?
							<Suchauswahl
								name="quotenbasis"
								beschriftung="Wertquoten wovon?"
								leerText="— wie vorgeschlagen —"
								bind:wert={abweichendeQuotenbasis}
								eintraege={abweichendeBasen.quoten.map((b) => ({ wert: b.wert, text: b.text }))}
							/>
						</label>
					{/if}

					<label class="breit">
						Begründung
						<textarea name="begruendung" rows="2" required minlength="3"></textarea>
					</label>
					<button type="submit">Setzen</button>
				</form>
			</details>
		{/if}

		<p class="wegzurueck">
			<a href={pfadUrl(data.stand.astId, bisherige.slice(0, -1))}>Eine Frage zurück</a>
			<a href={pfadUrl('', [])}>Von vorn</a>
		</p>
	{/if}
{/if}

<footer class="fassung">
	<p>
		<!-- Bis zum 16.11.2026 «Noch nicht juristisch gegengelesen.»; entfällt nach Entscheid 0052. -->
		Regelwerk Fassung {data.fassung}. Jedes Ergebnis ist ein Vorschlag an die Sitzungsleitung.
	</p>
	<p class="hilfe">{data.freigabevermerk}</p>
</footer>

<style>

	.wortlaut {
		max-width: 46rem;
		padding: 0.7rem 0.9rem;
		border-left: 3px solid var(--linie);
		background: var(--flaeche);
		white-space: pre-wrap;
	}

	.bisher {
		max-width: 46rem;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	.kacheln {
		list-style: none;
		padding: 0;
		margin: 1rem 0;
		display: grid;
		gap: 0.6rem;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}

	.kacheln.antworten {
		grid-template-columns: 1fr;
		max-width: 46rem;
	}

	.kacheln a {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-height: var(--ziel-min);
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: inherit;
		text-decoration: none;
		height: 100%;
	}

	.kacheln a:hover {
		border-color: var(--akzent);
	}

	.titel {
		font-weight: 550;
	}

	.unter,
	.hilfe {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	.weg {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.875rem;
		color: var(--text-leise);
		margin: 1rem 0 0.5rem;
	}

	.uebernehmen {
		margin: 1rem 0;
	}

	.ohne-baum {
		max-width: 46rem;
		margin: 1.25rem 0;
	}

	summary {
		cursor: pointer;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
		font-weight: 550;
	}


	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		font-weight: 550;
	}

	.breit {
		flex: 1 1 20rem;
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	.felder :global(select),
	.felder :global(.auswahlsuche),
	textarea {
		min-height: var(--ziel-min);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-weight: 400;
		resize: vertical;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		max-width: 46rem;
		margin: 1rem 0;
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	/* Kein Fehler, sondern eine Folge, die man kennen muss. */
	.meldung.hinweis {
		background: color-mix(in srgb, var(--warnung) 10%, transparent);
		border-color: color-mix(in srgb, var(--warnung) 45%, var(--linie));
	}


	.wegzurueck {
		display: flex;
		gap: 1.25rem;
		font-size: 0.9rem;
	}

	.fassung {
		margin-top: 2.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--linie);
		font-size: 0.875rem;
		color: var(--text-leise);
		max-width: 46rem;
	}

	.fassung p {
		margin: 0 0 0.25rem;
	}
	/* ── Der Erfordernisvorschlag (FR-59) ─────────────────────────────────── */
	.kivorschlag {
		margin: 1.25rem 0;
		padding: 0.85rem 1rem;
		border: 1px solid var(--linie);
		border-radius: 6px;
		background: var(--flaeche-2);
	}
	.kivorschlag h2 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}
	.kivorschlag.aus {
		opacity: 0.7;
	}
	.vorschlagskarte {
		margin: 0.75rem 0;
		padding: 0.6rem 0.85rem;
		background: var(--flaeche);
		border-left: 3px solid var(--linie);
	}
	/* Der Grenzfall traegt Farbe: Dort ist die eigene Pruefung am wichtigsten. */
	.vorschlagskarte.grenzfall {
		border-left-color: var(--hinweis);
	}
	.vorschlagskarte .fall {
		margin: 0;
	}
	.vorschlagskarte .ast {
		display: block;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-leise);
	}
	.vorschlagskarte .grundlage {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
	}
	.vorschlagskarte .grenzhinweis {
		margin: 0.5rem 0 0;
		font-size: 0.9rem;
		color: var(--hinweis);
	}
	.vergleich {
		margin: 0.5rem 0;
		padding: 0.5rem 0.75rem;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		font-size: 0.9rem;
	}
	.vergleich.auffaellig {
		border-color: var(--fehler);
	}
	.kivorschlag .entscheid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin: 0.6rem 0;
		font-size: 0.85rem;
	}
	.selberlaufen {
		margin: 0.5rem 0;
		font-size: 0.9rem;
	}
	.kivorschlag .herkunft,
	.kivorschlag .hilfe {
		font-size: 0.85rem;
		color: var(--text-leise);
	}
	/* Die Warnung steht ueber dem Ergebnis, nicht darunter: Wer erst das
	   Ergebnis liest und dann die Einschraenkung, hat das Ergebnis schon
	   geglaubt. */
	.kivorschlag .warnung {
		margin: 0.5rem 0 0.75rem;
		padding: 0.5rem 0.75rem;
		background: var(--flaeche-hinweis);
		border-left: 3px solid var(--hinweis);
		font-size: 0.85rem;
	}
	.weg {
		margin: 0.6rem 0 0;
		padding-left: 1.2rem;
		font-size: 0.85rem;
	}
	.weg li {
		margin-bottom: 0.35rem;
	}
	.weg .frage {
		display: block;
		color: var(--text-leise);
	}
	.weg .antwort {
		font-weight: 600;
	}
	.weg .antwort.unsicher::after {
		content: ' (unsicher)';
		font-weight: 400;
		color: var(--hinweis);
	}
	.weg .warum {
		display: block;
		color: var(--text-leise);
	}
	.kivorschlag .fehlschlag {
		margin: 0.6rem 0 0;
		color: var(--warnung);
	}
	.kivorschlag .hinausgegangen {
		font-size: 0.85rem;
	}
	.kivorschlag .hinausgegangen pre {
		margin: 0.4rem 0 0;
		padding: 0.5rem;
		overflow-x: auto;
		white-space: pre-wrap;
		background: var(--flaeche);
		border: 1px dashed var(--linie);
	}
	.hilfe.warnung {
		border-left: 3px solid var(--warnung);
		padding-left: 0.65rem;
		color: var(--text);
	}
</style>
