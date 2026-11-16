<script lang="ts">
	import Kartenscanner from '$lib/components/Kartenscanner.svelte';
	import Meldung from '$lib/components/Meldung.svelte';
	import Codefenster from '$lib/components/Codefenster.svelte';
	import Saaleinstieg from '$lib/components/Saaleinstieg.svelte';
	import Beschlussfaehigkeitskachel from '$lib/components/Beschlussfaehigkeitskachel.svelte';
	import Einlass from '$lib/components/Einlass.svelte';
	import Papierentscheid from '$lib/components/Papierentscheid.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Wahlliste from '$lib/components/Wahlliste.svelte';
	import Beamerfenster from '$lib/components/Beamerfenster.svelte';
	import Wandbild from '$lib/components/Wandbild.svelte';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import { filtereNach } from '$lib/domain/listensuche';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	/*
	 * **Ohne `use:enhance` sprang die Seite an den Anfang** (Auftraggeber, 25.08.2026:
	 * «Wenn ich bei ‹Alle Parteien› auf ‹Code ausgeben› klicke, springt der
	 * Browser ganz nach oben. Er soll dort bleiben wo er ist»).
	 *
	 * Ein Formular ohne `enhance` lädt die Seite ganz neu, und bei achtzig
	 * Zeilen heisst das, nach jeder Handlung wieder hinunterzusuchen.
	 *
	 * Bis zum 28.08.2026 stand dafür eine eigene Fabrik hier, wortgleich mit der
	 * auf der Anwesenheitsseite. Beide sind durch `absenden()` ersetzt; die
	 * Marke steht nur noch am Knopf, und ein Doppelklick auf dieselbe Zeile
	 * wird abgewiesen, statt zweimal zu schreiben.
	 */
	import { absenden } from '$lib/absenden';
	/** Wer kommt herein — einmal am Eingang, für alle Versammlungen des Tages. */
	let { data, form } = $props();

	/*
	 * Die Schnellsuche über die Liste. Sie greift im Browser, und das ist hier
	 * richtig: Die Parteien eines Abends stehen vollständig auf der Seite, es
	 * gibt keine zweite Seite, auf der ein Treffer läge (anders als im Verlauf,
	 * siehe `domain/verlaufsfilter.ts`).
	 */
	let suche = $state('');
	const gefiltert = $derived(
		filtereNach(data.zeilen, suche, (z) => `${z.name} ${z.einheiten.join(' ')} ${z.gemeinschaft}`)
	);

	/**
	 * Der ausgegebene Code — **eine eigene Kopie**, nicht `form.ausgabe`.
	 *
	 * Diese Seite lädt nach, sobald sich im Saal etwas ändert; dabei wird `form`
	 * geleert. Der Dialog verschwände sonst mitten im Vorlesen — und der Code
	 * erscheint nur einmal, danach steht in der Datenbank nur sein Prüfwert.
	 */
	// svelte-ignore state_referenced_locally
	let ausgabe = $state.raw<{
		code: string;
		name: string;
		gueltigBis: string;
		adresse: string;
		svg: string;
	} | null>(form?.ausgabe ?? null);
	$effect(() => {
		if (form?.ausgabe) ausgabe = form.ausgabe;
	});

	/**
	 * Das versteckte Feld, das die Kamera füllt — dasselbe Muster wie im Haus:
	 * Der Scanner findet einen Code, schreibt ihn hinein und schickt ab.
	 */
	let scanfeld = $state<HTMLInputElement | null>(null);
	function scanne(code: string) {
		if (!scanfeld) return;
		scanfeld.value = code;
		scanfeld.form?.requestSubmit();
	}

	/**
	 * Die Häkchenliste ist zugeklappt — wie im Haus.
	 *
	 * Der Regelfall ist die einzelne Erfassung am Eingang; die Liste ist die
	 * einfache Führung, in der jemand eine Papierliste abarbeitet. Immer offen
	 * stünde sie über der Tabelle und verdoppelte jede Zeile.
	 */
	let listenmodus = $state(false);

	/**
	 * Wen die Sitzungsleitung ohne Karte einlässt.
	 *
	 * Geführt statt ungesteuert: Die Seite lädt bei jedem Ereignis im Saal nach
	 * und baut die Optionsliste dabei neu — ein ungesteuertes `select` verliert
	 * dann seine Auswahl, und abgeschickt wird eine leere Kennung. Dieselbe
	 * Falle wie auf der Anwesenheitsseite eines Hauses, dort am 21.08.2026
	 * gemessen.
	 */
	/* Als Liste, weil `Wahlliste` mehrere zulässt und hier `mehrfach={false}`
	   steht — der eine Eintrag ist der gewählte. */
	let werTrifftEinListe = $state<string[]>([]);
	const gewaehltePerson = $derived(
		werTrifftEinListe.length > 0
			? data.einlassbar.find((p) => p.id === werTrifftEinListe[0])
			: null
	);

	/** Wie viele Häuser eröffnet werden können und wie viele noch laufen. */
	const zuEroeffnen = $derived(data.stand.filter((s) => s.zustand === 'freigegeben'));
	const laufende = $derived(data.stand.filter((s) => s.zustand === 'laufend'));
</script>

<!--
	**«Anwesenheit», wie in der einzelnen Versammlung** (Auftraggeber, 24.08.2026:
	«Optisch soll Gruppe und Einzel identisch aussehen»). Die Seite hiess «Wer
	ist da?» — dieselbe Frage, ein anderes Wort, und wer zwischen Gruppe und Haus
	wechselt, sucht zweimal.
-->
<h1>Anwesenheit und Beschlussfähigkeit</h1>

<!--
	**Eröffnen gehört hierher** (Auftraggeber, 24.08.2026: «Bitte Einlass nach Anwesenheit
	und Beschlussfähigkeit anpassen»). Im Haus steht der Knopf seit dem 21.08.2026
	auf genau dieser Seite — «Wer am Eingang steht, steht im Prozessschritt
	Anwesenheit». Am gemeinsamen Abend gab es ihn hier gar nicht: Eröffnet wurde
	auf der Seite jedes einzelnen Hauses, fünfmal nacheinander, während diese
	Seite entgegenhielt, es laufe noch nichts.

	**Alle auf einmal ist der Regelfall** — ein gemeinsamer Abend beginnt
	gemeinsam. Einzeln geht auch: Ein Haus, dessen Vertreter noch im Stau steht,
	wird später eröffnet.
-->
{#if zuEroeffnen.length > 0}
	<section class="eroeffnen">
		<h2>
			{zuEroeffnen.length === 1 ? 'Versammlung eröffnen' : 'Versammlungen eröffnen'}
		</h2>
		<p class="lesebreite">
			Ab der Eröffnung zählt die Anwesenheit, und es kann abgestimmt werden. Die
			Beschlussfähigkeit muss dafür nicht erreicht sein — fehlt sie, verlangt jedes
			Traktandum eine ausdrückliche Bestätigung, und der Vermerk geht in den Verlauf.
		</p>
		<div class="tat">
			<form method="POST" action="?/eroeffnen">
				<button type="submit" class="haupt">
					{zuEroeffnen.length === 1
						? `${zuEroeffnen[0].gemeinschaft} eröffnen`
						: `Alle ${zuEroeffnen.length} eröffnen`}
				</button>
			</form>
			{#if zuEroeffnen.length > 1}
				{#each zuEroeffnen as s (s.meetingId)}
					<form method="POST" action="?/eroeffnen">
						<input type="hidden" name="meeting" value={s.meetingId} />
						<button type="submit">Nur {s.gemeinschaft}</button>
					</form>
				{/each}
			{/if}
		</div>
	</section>
{/if}

{#if data.laufend === 0 && zuEroeffnen.length === 0}
	<!--
		Sichtbar gesperrt statt versteckt, wie im übrigen Ablauf: Der Schritt
		verschwindet nicht, er sagt, was ihn freischaltet.
	-->
	<!--
		**Zwei Gründe, dasselbe Bild** — und sie brauchen verschiedene Sätze
		(24.08.2026, beim Nachsehen am Telefon gefunden): Ein Abend, dessen
		Versammlungen alle geschlossen sind, ist fertig. «Geben Sie zuerst die
		Traktandenlisten frei» stand dort trotzdem und schickte die
		Sitzungsleitung an einen Schritt, den sie längst erledigt hat.
	-->
	<p class="gesperrt">
		<!--
			`length > 0` davor: `every` ist über einer leeren Liste wahr, und ein
			Abend ohne Häuser bekäme sonst «alle geschlossen» zu lesen — die
			Aussage, die am wenigsten stimmt.
		-->
		{#if data.stand.length > 0 && data.stand.every((s) => s.zustand === 'geschlossen' || s.zustand === 'versiegelt')}
			Alle Versammlungen dieses Abends sind geschlossen. Was beschlossen wurde, steht im
			Protokoll des Abends.
		{:else}
			Keine Versammlung dieses Abends ist offen. Geben Sie zuerst die Traktandenlisten frei —
			danach lässt sich hier eröffnen.
		{/if}
	</p>
{:else}
	<!--
		**Die Beschlussfähigkeit als Kachel je Haus** (Auftraggeber, 24.08.2026: «Bekommt
		man die STWEG-Beschlussfähigkeit je auf ein Quadrat?»). Bis hierher stand
		hier nur «beschlussfähig» oder «noch nicht» — das Urteil ohne die Zahlen,
		aus denen es folgt. Am Eingang ist gerade die Zahl die Auskunft: Wie viele
		fehlen noch?

		Derselbe Baustein wie in der Leitung und auf der Leinwand; ein zweites
		Aussehen für dieselbe Aussage liefe früher oder später auseinander.
	-->
	<div class="kacheln">
		{#each data.stand as s (s.meetingId)}
			<Beschlussfaehigkeitskachel
				name={s.gemeinschaft}
				bedingungen={s.beschlussfaehig?.bedingungen ?? []}
				beschlussfaehig={Boolean(s.beschlussfaehig?.erfuellt)}
			/>
		{/each}
	</div>
	<!--
		Der Fristhinweis erscheint nur, wenn er gebraucht wird — wie im Haus, wo er
		an der nicht erreichten Beschlussfähigkeit hängt. Immer dazustehen hiesse,
		dass er nicht mehr gelesen wird.
	-->
	{#if data.stand.some((s) => s.beschlussfaehig && !s.beschlussfaehig.erfuellt)}
		<p class="hilfe lesebreite">{data.fristhinweis}</p>
	{/if}

	<p class="lesebreite hilfe">
		Eine Anmeldung für die ganze Versammlung: Die Person wird in jeder Gemeinschaft angemeldet, in
		der sie stimmberechtigt ist. Der Verlauf jeder Gemeinschaft bleibt für sich lückenlos.
	</p>

	<!--
		**Der Code als eigenes Fenster, mit QR** (Auftraggeber, 24.08.2026): «Die
		Funktionalität von Anwesenheit und Beschlussfähigkeit gegenüber Einlass ist
		auch nicht identisch.» Hier stand er als Meldungszeile — und verschwand,
		sobald der Ereignisstrom die Seite nachlud, mitten im Vorlesen.
	-->
	<Codefenster
		{ausgabe}
		einstiegAdresse={data.einstiegAdresse}
		beimSchliessen={() => (ausgabe = null)}
	/>

	{#if form?.fehler}
		<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
	{:else if form?.hinweis}
		<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
	{/if}

	<!--
		**Der Entscheid «digital oder von Hand», mit fünf Sekunden Rückweg.**

		Hier trägt der Kasten beide Richtungen: Die Wartenden werden an ihren
		Knöpfen gefragt, und wer eine Karte scannt, bekommt danach den Nachtrag
		angeboten — der Scanner erfasst sofort, und vor dem Auflösen des Codes
		ist das Haus unbekannt. Beides bleibt der Entscheid am Eingang.
	-->
	<Papierentscheid
		papier={form && 'papier' in form ? form.papier : null}
		nachtrag={form && 'nachtrag' in form ? form.nachtrag : null}
	/>

	<!--
		**Wer am Eingang wartet** — derselbe Kasten wie im Haus (24.08.2026).
		Zwei Wege führen hierher: die Anmeldung mit eigenem Konto und die Meldung
		über den Saal-QR. Beide sah man bis heute nur auf der Seite des einzelnen
		Hauses — also dort, wo an einem gemeinsamen Abend niemand hinschaut. Der
		Saal-QR des Abends schrieb damit in eine Liste, die keine Sicht las.

		Jeder Eintrag trägt sein Haus, weil die Handlung dorthin gehört und die
		Zuordnung sonst in einer Absage aus der Tiefe endete.
	-->
	<Einlass
		wartende={data.wartende}
		saalmeldungen={data.saalmeldungen}
		parteien={data.parteien}
		laufend={data.laufend > 0}
	/>

	{#if data.einlassbar.length === 0}
		<p class="leer">
			Niemand aus den laufenden Gemeinschaften steht im Personenregister. Erfassen Sie die
			Eigentümer bei ihrer Gemeinschaft.
		</p>
	{:else}
	<!--
		**«Karte scannen oder Code eintippen»** — derselbe Abschnitt wie im Haus
		(Auftraggeber, 24.08.2026: «Optisch soll Gruppe und Einzel identisch aussehen»).

		Der Code trägt seine Versammlung selbst; hier wird geprüft, ob sie zu
		einer der Gemeinschaften dieses Abends gehört. Erfasst wird sofort — am
		gemeinsamen Eingang steht die Person schon davor, und ein Zwischenschritt
		kostet die Zeit, die der Abend nicht hat.
	-->
	<h2>Karte scannen oder Code eintippen</h2>
	<form method="POST" action="?/scannen" class="scan">
		<!--
			**«nachher» ist eine Aussage, kein Platzhalter.** Dieses Formular fragt
			nicht hier: Der Sucher schickt selbst ab, und welches Haus die Karte
			betrifft, steht erst nach dem Auflösen des Codes fest. Gefragt wird danach,
			im Kasten `Papierentscheid`. Ohne dieses Feld hielte der Server das
			Schweigen für eine Lücke in der Maske und meldete sie der Sitzungsleitung.

			Die Aussage trägt nur so weit wie der Kasten daneben. Wer ihn entfernt,
			nimmt diesem Feld seine Wahrheit — gemessen wird der Kasten in
			`e2e/mischform.mjs`, Schritt 13.
		-->
		<input type="hidden" name="papier" value="nachher" />
		<input type="hidden" name="code" bind:this={scanfeld} />
		<Kartenscanner beiFund={scanne} />
	</form>
	<form method="POST" action="?/scannen" class="zeile">
		<!-- Dieselbe Aussage wie am Sucher darüber: gefragt wird danach. -->
		<input type="hidden" name="papier" value="nachher" />
		<label>
			<span class="nurLeser">Zugangscode</span>
			<input
				name="code"
				placeholder="ABCD-EFGH-JKMN-PQRS-TWXY"
				autocomplete="off"
				spellcheck="false"
			/>
		</label>
		<button type="submit">Erfassen</button>
	</form>
	<p class="hilfe lesebreite">
		Drei Wege führen zur selben Karte:
	</p>
	<ul class="lesebreite">
		<li>die Kamera oben</li>
		<li>ein Handscanner, der wie eine Tastatur tippt — Feld anklicken, scannen, fertig</li>
		<li>die Kamera-App des Telefons: Sie öffnet den Link der Zugangskarte direkt</li>
	</ul>

	<!--
		**Der Saaleinstieg zum Hinhalten** — hier, nicht über dem Abschnitt (Auftraggeber,
		24.08.2026: «Bitte die Gruppen so gruppieren wie bei Einzelversammlung»).
		Im Haus stehen die drei Ausklapper untereinander unter dem Scanner:
		Meldeseite, Telefonweg, Einlass ohne Karte. Was sonst dazwischen steht,
		zerreisst die Reihe.
	-->
	<Saaleinstieg
		svg={data.saaleinstieg?.svg ?? null}
		adresse={data.saaleinstieg?.adresse ?? null}
	/>

	<!--
		**Diese Seite auf das eigene Telefon holen** — wie im Haus. Am Eingang
		steht die Sitzungsleitung mit dem Telefon in der Hand; die Adresse
		abzutippen ist im Saal die schlechteste aller Möglichkeiten. Der Code
		trägt keinen Zugang: Wer ihn scannt, muss sich anmelden wie überall.

		Der Link steht daneben, weil sich ein Code nicht selbst scannt — wer die
		Seite schon auf dem Telefon hat, bräuchte sonst ein zweites Gerät.
	-->
	<details class="quicklink">
		<summary>Diesen Eingang auf dem Telefon öffnen</summary>
		<div class="qr">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html data.quicklink.svg}
			<div class="wohin">
				<p class="klein">
					Mit der Kamera-App des Telefons scannen. Sie landen auf dieser Seite und melden
					sich dort an wie überall — der Code ist eine Adresse, kein Schlüssel.
				</p>
				<p class="adresse klein">
					<a href={data.quicklink.url}>{data.quicklink.url}</a>
				</p>
			</div>
		</div>
	</details>

		<!--
			**Zugeklappt und in der Reihe** (Auftraggeber, 24.08.2026: «Bitte die Gruppen so
			gruppieren wie bei Einzelversammlung. Das wirkt aufgeräumter»). Hier
			stand ein offener `h2`-Abschnitt mitten zwischen den Ausklappern; im
			Haus ist es der dritte Ausklapper unter dem Scanner. Der Regelfall am
			Eingang ist die Karte — was danebensteht, gehört zugeklappt.
		-->
		<details class="vonhand">
			<summary>Ohne Karte einlassen</summary>
			<form method="POST" action="?/einlass">
				<label class="wer">
					Wer trifft ein
					<!--
						**Eine Wahlliste mit Suche statt eines Aufklappfelds** (Auftraggeber,
						25.08.2026: «Beim Einlass ‹Ohne Karte einlassen› braucht es noch eine
						Suchfunktion nach Name, Nummer, Gemeinschaft oder so. Sonst wird es
						schwierig bei 50 Einheiten mit 90 Personen»).

						Am Abend ist die Liste noch länger als im Haus — sie führt die
						Personen aller Gemeinschaften zusammen. Dieselbe Wahlliste wie dort,
						damit sich beide Sichten gleich bedienen lassen.

						Anwesende bleiben stehen, leise und benannt: «Warum steht Meier nicht
						in der Liste» ist eine Frage, die im Saal niemand beantworten will.
					-->
					<Wahlliste
						name="person"
						mehrfach={false}
						pflicht
						bind:gewaehlt={werTrifftEinListe}
						suchbeschriftung="Person suchen"
						leerhinweis="Keine Person gewählt."
						eintraege={data.einlassbar.map((p) => ({
							id: p.id,
							name: p.name,
							zusatz:
								p.gemeinschaften.join(', ') +
								(p.offen === 0
									? ' — bereits anwesend'
									: p.haeuser > 1
										? ` — ${p.offen} von ${p.haeuser} offen`
										: ''),
							leise: p.offen === 0
						}))}
					/>
					<span class="hilfe">
						Eine Anmeldung für alle Häuser, in denen die Person stimmberechtigt ist. Wo sie
						schon steht, wird übersprungen.
					</span>
				</label>
				{#if data.papierfrageIrgendwo}
					<!--
						**Ein Haken und nicht zwei Knöpfe**, wie im Haus: Dieses Formular
						wird ausgefüllt (Person suchen, dann einlassen), und ein zweiter
						Einlassknopf daneben wäre ein zweiter Weg durch dasselbe Formular.
						Der Haken ist leer — die Antwort wird gestellt, nicht unterstellt.

						**Eine Antwort für alle Häuser dieser Person.** Am Eingang steht ein
						Mensch und sagt, wie er abstimmt; er tut es nicht in Haus 4 digital
						und in der Einstellhalle von Hand. Häuser, die nicht fragen,
						überspringt der Schreibweg.
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
						Stimmt an diesem Abend von Hand ab
					</label>
				{/if}
				<!--
					**Rückfrage wie im Haus** (Block C1, 31.08.2026). Ohne Karte
					einzulassen ist der Griff, bei dem am ehesten die falsche Person
					erfasst wird. Kein QR danach: Die Person wird hier in mehreren
					Häusern zugleich angemeldet, ein Code gilt aber je Haus — und
					wer eine Karte hat, trägt damit ohnehin alle seine Zugänge.
				-->
				<Rueckfrage
					beschriftung="Einlassen"
					zeichen="haken"
					ton="gut"
					gewicht="haupt"
					frage={gewaehltePerson ? `${gewaehltePerson.name} einlassen?` : 'Person einlassen?'}
					folge={gewaehltePerson
						? `Anmeldung in ${gewaehltePerson.gemeinschaften.join(', ')} — wo die Person schon anwesend ist, wird übersprungen.`
						: 'Wo die Person schon anwesend ist, wird übersprungen.'}
					bestaetigen="Einlassen"
				/>
			</form>
		</details>

		<!--
			**Vollmachten führt die Vollmachtsseite** (Auftraggeber, 24.08.2026: «Smarter
			wäre ein Absprung auf Vollmachten. Sonst führen wir das dort doppelt»).

			Hier stand die ganze Maske «Bevollmächtigte dritte Person» mit einer
			Liste über alle Häuser — dieselbe Arbeit, die `/tage/<id>/vollmachten`
			schon führt, nur an einer zweiten Stelle und in einer zweiten Fassung,
			die auseinanderlaufen kann. Eine Vollmacht gilt je Gemeinschaft; das
			ist Recht und keine Technik, und die Seite dort sagt es auch.
		-->
		<p class="weiterzu">
			<a href="/tage/{page.params.id}/vollmachten">Vollmachten des Abends</a>
			<span class="hilfe">
				Wer für andere kommt: Vollmacht erfassen, Nachweis vermerken, bestätigen — je
				Gemeinschaft eine, alle an einer Stelle.
			</span>
		</p>
	{/if}

	<!--
		**Die Liste des ganzen Abends** (Auftraggeber, 24.08.2026): «Ich muss beim Einlass
		das Checkin machen, ohne dass ich in 5 STWEG hin und her springen muss. Es
		braucht dieselbe Einfachheit wie bei einer Versammlung mit einer STWEG.»

		Eine Zeile je Partei, mit ihrem Haus daneben — nicht eine Tabelle je Haus.
		Am Eingang steht ein Mensch, und die Frage lautet «ist der schon da?»,
		nicht «in welchem Haus wohnt der?». Deshalb auch nach NAMEN sortiert und
		nicht nach Gemeinschaft.

		Dieselben Handlungen wie in der einzelnen Versammlung: Verlassen, Code
		ausgeben, Gerät abmelden. Wer in zwei Häusern stimmberechtigt ist, steht
		zweimal — das ist keine Doppelung, sondern die Wahrheit: Er ist in zwei
		Versammlungen anwesend, und jede führt ihren eigenen Nachweis.
	-->
	<!--
		**Beamer und Wandbild gehören an den Eingang** — wie im Haus. Solange die
		Leute eintreffen, gehört die Begrüssung an die Wand und nicht die
		Traktandenliste; wer dafür erst in die Sitzungsleitung wechseln muss,
		lässt sie stehen. Sie stehen unter dem Scanner, nicht darüber: Gescannt
		wird vierzehnmal am Abend, das Wandbild einmal gewechselt.
	-->
	{#if laufende.length > 0 || zuEroeffnen.length > 0}
		<div class="beamerzeile">
			<Beamerfenster pfad="/tage/{page.params.id}/praesentation" />
		</div>
		<!--
			Ein Wandbild für alle Häuser: Ein gemeinsamer Bildschirm mit fünf
			verschiedenen Bildern wäre keiner. Zeigen sie zurzeit Verschiedenes,
			steht keine Wahl vorgewählt da — das sagt der Satz darunter.
		-->
		<Wandbild art={data.wandbild ?? 'traktanden'} text={null} />
		{#if data.wandbild === null}
			<p class="leise">
				Die Gemeinschaften zeigen zurzeit Verschiedenes. Eine Wahl hier gleicht sie an.
			</p>
		{/if}
	{/if}

	<!--
		**Die Nachtragsliste, hier über alle Häuser** (Migration 109). Wer darin
		steht, kam herein, bevor es die Frage gab: Der Schalter des Hauses war aus,
		oder die Häkchenliste hat ein Dutzend Namen auf einmal abgehakt.

		**Am Abend ist sie der einzige Weg.** Im Haus führt die nochmals gescannte
		Karte zur Frage; hier bietet ein zweiter Scan nichts mehr an, und die Zeile
		fragt nachher statt vorher. Ohne diese Liste gäbe es für diese Parteien
		überhaupt keine Möglichkeit mehr.

		Das Haus steht je Zeile dabei, wie überall an diesem Eingang: Die Frage
		hängt am einzelnen Haus, und derselbe Mensch kann in zweien stimmberechtigt
		sein.
	-->
	{#if data.nichtGefragt.length > 0}
		<section class="nachtragsliste">
			<h2>Nicht gefragt ({data.nichtGefragt.length})</h2>
			<!-- Auf Lesebreite, wie im Haus und aus demselben gemessenen Grund. -->
			<p class="klein lesebreite">
				Diese Parteien sind anwesend, wurden aber nicht gefragt, ob sie digital oder von Hand
				abstimmen. Bis das geklärt ist, stimmen sie am eigenen Gerät ab.
			</p>
			<ul>
				{#each data.nichtGefragt as p (p.meetingId + p.parteiId)}
					<li>
						<span>
							<strong>{p.name}</strong>
							<span class="klein">· {p.gemeinschaft}</span>
						</span>
						<form method="POST" action="?/papierBeantworten" use:enhance={absenden()}>
							<input type="hidden" name="meeting" value={p.meetingId} />
							<input type="hidden" name="partei" value={p.parteiId} />
							<input type="hidden" name="weg" value="von_hand" />
							<!-- Wie an jedem Eingang: kein Knopf ist vorbelegt. -->
							<button type="submit" disabled hidden data-vorgabe="keiner">
								Kein Vorgabeknopf
							</button>
							<!--
								**Nur dieser fragt zurück.** «Stimmt von Hand» ist an der Zeile
								jederzeit zurückzunehmen; «stimmt digital» nimmt die Partei aus
								dieser Liste, und in die Liste zurück führt kein Weg — die
								Antwortzeile lässt sich nicht löschen.

								**Der Vermerk selbst lässt sich seit dem 11.09.2026 auch am Abend
								an der Zeile setzen**, in beide Richtungen. Der Satz darunter hat
								bis dahin das Gegenteil behauptet; er stammte aus der Zeit, als es
								hier nur den Weg zurück gab.
							-->
							<Rueckfrage
								beschriftung="Stimmt digital"
								zeichen="haken"
								ton="neutral"
								name="papier"
								wert="nein"
								marke="gefragt:{p.meetingId}:{p.parteiId}"
								frage="{p.name} als digital abstimmend erfassen?"
								folge="Die Partei verschwindet aus dieser Liste, und in die Liste zurück führt kein Weg: Dass gefragt wurde, lässt sich nicht widerrufen. Stimmt sie doch von Hand, setzen Sie den Vermerk an ihrer Zeile in der Anwesenheitsliste."
								bestaetigen="Stimmt digital"
							/>
							<button
								type="submit"
								name="papier"
								value="ja"
								class="handlung papierknopf"
								data-fokus="gefragtpapier:{p.meetingId}:{p.parteiId}"
							>
								Stimmt von Hand
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.zeilen.length > 0}
		<!-- «Alle Parteien», derselbe Abschnittsname wie im Haus. -->
		<div class="listenkopf">
			<h2>Alle Parteien — {data.anwesend} von {data.zeilen.length} anwesend</h2>
			{#if data.laufend > 0}
				<button type="button" class="leise" onclick={() => (listenmodus = !listenmodus)}>
					{listenmodus ? 'Häkchenliste schliessen' : 'Häkchenliste (einfache Führung)'}
				</button>
			{/if}
		</div>

		<!--
			**Suchen statt scrollen** (Auftraggeber, 25.08.2026: «Alle Parteien auch mit einen
			Schnellsuche ausstatten. Dies auch bei Einzelveranstaltung»).

			Am Eingang steht jemand mit einem Namen, nicht mit einer Zeilennummer. Bei
			fünfzig Einheiten und neunzig Personen ist Scrollen kein Weg — und die
			Gemeinschaft gehört mitdurchsucht, weil dieselbe Person in zwei Häusern
			stehen kann und man das eine meint.

			`filtereNach` aus dem Kern und keine eigene Fassung: Dieselbe Eingabe soll
			hier treffen wie in der Eigentümerliste (`domain/listensuche.ts`).
		-->
		<div class="suchleiste">
			<label class="suchfeld">
				<span class="nurLeser">Partei suchen</span>
				<input
					type="search"
					placeholder="Name, Einheit oder Gemeinschaft"
					{...anfangswert(suche)}
					oninput={(e) => (suche = e.currentTarget.value)}
					autocomplete="off"
				/>
			</label>
			{#if suche.trim()}
				<p class="zaehler">{gefiltert.length} von {data.zeilen.length}</p>
			{/if}
		</div>

		<!--
			**Die Häkchenliste über alle Häuser** (24.08.2026). Im Haus gibt es sie
			seit Langem; am Abend fehlte sie, und wer eine Papierliste abarbeitete,
			klickte je Zeile einmal — bei fünf Gemeinschaften und achtzig Parteien
			ist das der Weg zurück zum Papier.

			Jedes Häkchen trägt Haus und Partei: Dieselbe Person kann in zwei Häusern
			stimmberechtigt sein, und dort entstehen zwei getrennte Anwesenheiten
			(AD-5).
		-->
		{#if listenmodus && data.laufend > 0}
			<form method="POST" action="?/liste" class="haken">
				<p class="klein">
					Alle Anwesenden in einem Durchgang anhaken. Wer schon erfasst ist, wird
					übersprungen. Ein fehlendes Häkchen erfasst <strong>kein</strong> Weggehen — das
					ist ein eigener Vorgang mit eigenem Zeitpunkt.
				</p>
				<div class="kaestchen">
					{#each data.zeilen.filter((z) => z.laeuft) as z (z.meetingId + z.parteiId)}
						<label>
							<input
								type="checkbox"
								name="zeile"
								value="{z.meetingId}|{z.parteiId}"
								{...angekreuzt(z.zustand === 'anwesend')}
							/>
							{z.name} <span class="klein">{z.gemeinschaft}</span>
						</label>
					{/each}
				</div>
				<button type="submit">Erfassen</button>
			</form>
		{/if}
		<div class="tabelle">
			<table>
				<thead>
					<tr>
						<th scope="col">Wer</th>
						<th scope="col">Gemeinschaft</th>
						<th scope="col">Stand</th>
						<th scope="col">Gerät</th>
						<th scope="col">Handlungen</th>
					</tr>
				</thead>
				<tbody>
					{#each gefiltert as z (z.meetingId + z.parteiId)}
						<tr class:anwesend={z.zustand === 'anwesend'}>
							<td>{z.name}</td>
							<td class="haus">{z.gemeinschaft}</td>
							<td>{z.zustandName}</td>
							<td>{z.geraet ?? '—'}</td>
							<td>
								<!--
									Ein `div` in der Zelle, nicht `display: flex` an der Zelle
									selbst: Ein `<td>` mit fremder Anzeigeart fällt aus der
									Tabellenstruktur. Der Wächter `check-anzeigeart` hat es
									gemeldet, bevor es jemand sah.
								-->
								<div class="tat">
								{#if z.laeuft}
									{#if z.zustand !== 'anwesend'}
										<!--
											**Von Hand erfassen** — dieselbe Handlung wie in der
											einzelnen Versammlung. Ohne sie liesse sich eine einzelne
											Zeile gar nicht anmelden: Der Weg über die Personenauswahl
											oben meldet in ALLEN Gemeinschaften an, und jemand kann in
											Haus A da sein und in Haus B noch nicht.
										-->
										<form
											method="POST"
											action="?/vonHand"
											use:enhance={absenden()}
										>
											<input type="hidden" name="meeting" value={z.meetingId} />
											<input type="hidden" name="partei" value={z.parteiId} />
											<!--
												**Auch hier «nachher», und zwar mit Absicht.** Im Haus stellt
												dieselbe Zeile die Frage als zwei Knöpfe. Am Abend steht sie in
												einer Tafel über alle Häuser, und die Frage hängt am einzelnen
												Haus: Zwei Knöpfe je Zeile ergäben eine Tafel aus Knöpfen. Der
												Kasten danach fragt einmal, für den gerade erfassten Eintritt.
											-->
											<input type="hidden" name="papier" value="nachher" />
											<button
												type="submit"
												class="haupt"
												data-fokus="hand:{z.meetingId}:{z.parteiId}"
											>
												Von Hand erfassen
											</button>
										</form>
									{/if}
									{#if z.zustand === 'anwesend'}
										<form
											method="POST"
											action="?/verlassen"
											use:enhance={absenden()}
										>
											<input type="hidden" name="meeting" value={z.meetingId} />
											<input type="hidden" name="partei" value={z.parteiId} />
											<button type="submit" data-fokus="weg:{z.meetingId}:{z.parteiId}">
												Verlassen
											</button>
										</form>
									{/if}
									<form
										method="POST"
										action="?/codeAusgeben"
										use:enhance={absenden()}
									>
										<input type="hidden" name="meeting" value={z.meetingId} />
										<input type="hidden" name="partei" value={z.parteiId} />
										<button type="submit" data-fokus="code:{z.meetingId}:{z.parteiId}">
											Code ausgeben
										</button>
									</form>
									<!--
										**Der Rückweg für alle, auch nach den fünf Sekunden**
										(10.09.2026, im Code-Review gefunden). Der Kasten oben
										verspricht, der Rückweg stehe danach «in der
										Anwesenheitsliste, an der Zeile dieser Partei» — im Haus
										stimmte das, hier stand nichts. Wer den falschen Knopf
										erwischt und den Kasten verpasst hatte, musste in die
										einzelne Versammlung wechseln.

										**Seit dem 11.09.2026 geht es auch hin, und das ist eine
										Kehrtwende.** Hier stand «nur zurück, nicht hin», mit dem Satz
										vom 09.09.2026 begründet, der Entscheid falle am Eingang. Der
										eigene Eingangstest des Auftraggebers hat gezeigt, was das kostet: Wer
										versehentlich «digital» erfasste, hatte nach fünf Sekunden
										keinen Weg mehr, während die Gegenrichtung unbefristet offen
										stand. Eine Reparatur ist kein Entscheid, und derselbe Satz
										nennt sie ausdrücklich: «Dort gilt höchstens der bestehende
										Weg, wenn es technische Probleme gibt.» Produktentscheid
										11.09.2026.
									-->
									{#if z.aufPapier}
										<form
											method="POST"
											action="?/papierZuruecknehmen"
											use:enhance={absenden()}
										>
											<input type="hidden" name="meeting" value={z.meetingId} />
											<input type="hidden" name="partei" value={z.parteiId} />
											<Rueckfrage
												beschriftung="Stimmt doch digital"
												zeichen="kreuz"
												ton="fehler"
												marke="papierab:{z.meetingId}:{z.parteiId}"
												frage="Vermerk «stimmt von Hand ab» für {z.name} zurücknehmen?"
												folge="Danach stimmt die Partei wieder am eigenen Gerät ab, und die Sitzungsleitung braucht für jede Stimme wieder einen Grund. Die Anwesenheit bleibt bestehen."
												bestaetigen="Vermerk zurücknehmen"
											/>
										</form>
									{:else if z.papierfrage && z.zustand === 'anwesend' && z.weg !== 'vertretung'}
										<form
											method="POST"
											action="?/papierBeantworten"
											use:enhance={absenden()}
										>
											<input type="hidden" name="meeting" value={z.meetingId} />
											<input type="hidden" name="partei" value={z.parteiId} />
											<Rueckfrage
												beschriftung="Stimmt doch von Hand"
												zeichen="kreuz"
												ton="warnung"
												name="papier"
												wert="ja"
												marke="papierdoch:{z.meetingId}:{z.parteiId}"
												frage="{z.name} stimmt doch von Hand?"
												folge="Das Telefon dieser Partei stimmt danach nicht mehr mit; die Sitzungsleitung überträgt ihre Stimmen. Die Anwesenheit bleibt bestehen, und der Weg zurück steht daneben."
												bestaetigen="Stimmt von Hand"
											/>
										</form>
									{/if}
									{#if z.geraet}
										<form
											method="POST"
											action="?/geraeteWiderrufen"
											use:enhance={absenden()}
										>
											<input type="hidden" name="meeting" value={z.meetingId} />
											<input type="hidden" name="partei" value={z.parteiId} />
											<button type="submit" data-fokus="geraet:{z.meetingId}:{z.parteiId}">
												Gerät abmelden
											</button>
										</form>
									{/if}
								{:else}
									<span class="hilfe">läuft nicht</span>
								{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}

<style>
	.zeile {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.zeile input {
		min-height: var(--ziel-min);
		padding: 0 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		min-width: 18rem;
	}

	.zeile button {
		min-height: var(--ziel-min);
		padding: 0 1rem;
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	/*
	 * **Die Kacheln füllen die Breite, ohne sie zu sprengen.** Sieben
	 * Gemeinschaften sind der gemeldete Grenzfall; `auto-fill` mit einer
	 * Mindestbreite bricht sie um, statt sie zu stauchen — ein Quadrat, das
	 * schmaler wird als sein Name, ist kein Quadrat mehr.
	 */
	.kacheln {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: 0.6rem;
		margin-bottom: 0.75rem;
	}

	/*
	 * **Das Eröffnen steht über allem** — es ist die eine Handlung, ohne die
	 * nichts anderes auf dieser Seite etwas tut. Deshalb mit farbiger Kante wie
	 * der Einlasskasten: Was den Abend blockiert, darf nicht aussehen wie ein
	 * Hinweis.
	 */
	.eroeffnen {
		border: 1px solid var(--akzent);
		border-left-width: 4px;
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.25rem;
		margin: 0 0 1.25rem;
	}

	.eroeffnen h2 {
		margin-top: 0;
	}

	.eroeffnen .tat {
		margin-top: 0.6rem;
	}

	/* Der Schalter der Häkchenliste steht neben der Überschrift, nicht darunter. */
	/* Wortgleich zur Nachtragsliste im Haus — dieselbe Aufgabe, dieselbe Form,
	   samt dem dort begründeten `--linie` statt `--rand`. */
	.nachtragsliste {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
		margin-bottom: 1.2rem;
	}

	.nachtragsliste h2 {
		margin-top: 0;
	}

	/* Dasselbe Raster wie im Haus, aus demselben gemessenen Grund: Die Knöpfe
	   beginnen in jeder Zeile an derselben Stelle. */
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
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.haken {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
	}

	/*
	 * Die Kästchen in Spalten, damit achtzig Parteien nicht achtzig Zeilen
	 * werden. `auto-fill` statt fester Spaltenzahl: Auf dem Telefon bleibt eine.
	 */
	.kaestchen {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.2rem 1rem;
		margin: 0.6rem 0;
	}

	.kaestchen label {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		min-height: var(--ziel-min);
	}

	/* Der QR und der Text daneben, wie im Haus. */
	.quicklink {
		margin: 0.5rem 0 1rem;
	}

	/*
	 * Polster wie «Meldeseite zeigen» darüber und wie die Aufklapper der
	 * Anwesenheit seit `90c06af` (UI-Durchgang 06.10.2026): Hier standen 0.5rem,
	 * also 44 px neben 50 px in derselben Reihe. Jetzt alle drei 50 px.
	 */
	.quicklink summary {
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
		cursor: pointer;
	}

	.quicklink .qr {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.quicklink .qr :global(svg) {
		width: 8rem;
		height: 8rem;
	}

	.quicklink .wohin {
		flex: 1 1 16rem;
		min-width: 0;
	}

	/* Eine Adresse ohne Umbruchstelle sprengt sonst die Telefonbreite. */
	.quicklink .adresse {
		overflow-wrap: anywhere;
	}

	.beamerzeile {
		margin: 1rem 0 0.5rem;
	}

	/*
	 * **Der Ausklapper «Ohne Karte einlassen»** — dieselben Masse wie im Haus.
	 * Das Dreieck bleibt: kein `display` am `<summary>` (Stylelint-Regel `versammlung/dreieck-am-summary`).
	 */
	/* Wie auf der Anwesenheitsseite: ein Haken in Zeilenhöhe, nicht ein Feld in
	   Formularbreite. */
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

	.vonhand {
		margin-top: 0.75rem;
	}

	/* Dasselbe Polster wie `.quicklink summary` oben, mit derselben Begründung. */
	.vonhand summary {
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
		cursor: pointer;
	}

	.vonhand .wer {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-weight: 550;
		margin: 0.5rem 0;
		max-width: 34rem;
	}

	/*
	 * **Der Absprung ist ein Weg, kein Knopf.** Er steht neben den Ausklappern
	 * und soll sie nicht überstrahlen: Der Regelfall am Eingang ist die Karte.
	 */
	.weiterzu {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin: 0.75rem 0 0;
	}

	.tabelle {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.5rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid var(--linie);
	}

	/* Der Kopf wie überall im Haus: klein, leise, in Grossbuchstaben
	   (06.10.2026, UI-Durchgang; vorher 17 px fett in Textfarbe). */
	th {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-leise);
	}

	tr.anwesend .haus {
		color: var(--text-leise);
	}

	.tat {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	/*
	 * **Die Knöpfe stapelten sich** (gesehen am Bild, 24.08.2026): Die Spalte
	 * war zu schmal, und aus jeder Zeile wurde ein Block — dieselbe Falle wie in
	 * der einzelnen Versammlung am 20.08. Die Tabelle darf stattdessen seitlich
	 * scrollen; die Handlungen bleiben in einer Zeile.
	 */
	.tat form {
		white-space: nowrap;
	}

	td .tat {
		white-space: nowrap;
	}

	/* Bleibt, obwohl `main button.haupt` in app.css steht (Auftrag V2,
	   06.10.2026): `.tat button` darunter wiegt mehr als die Hausregel und
	   zöge den Knopf sonst auf die helle Fläche zurück. */
	.tat button.haupt {
		background: var(--akzent);
		color: var(--akzent-text);
		border-color: var(--akzent);
		font-weight: 550;
	}

	.tat button {
		min-height: var(--ziel-min);
		padding: 0 0.7rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-size: 0.9375rem;
		cursor: pointer;
	}

	.gesperrt {
		background: var(--flaeche-2);
		border-left: 3px solid var(--linie);
		color: var(--text-leise);
		max-width: var(--lesebreite);
		padding: 0.75rem 1rem;
	}




	.leer,
	.hilfe {
		color: var(--text-leise);
		display: block;
		font-size: 0.9rem;
	}
</style>
