<script lang="ts">
	import Beschlussfaehigkeitsanzeige from '$lib/components/Beschlussfaehigkeitsanzeige.svelte';
	import { untrack } from 'svelte';
	import Saalbild from '$lib/components/Saalbild.svelte';
	import Vollbildecke from '$lib/components/Vollbildecke.svelte';
	import { nachzieher } from '$lib/components/neuladen';
	import { anfangswert } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';

	let { data, form } = $props();

	/**
	 * Der Stand von der Leinwand aus.
	 *
	 * Startwert ist der beim Laden ermittelte; danach zieht der Strom nach. Ohne
	 * Startwert bliebe die Leinwand leer, bis sich zufällig etwas ändert.
	 */
	// `untrack`, weil der Startwert genau einmal genommen wird: Ab dann führt der
	// Strom die Anzeige, nicht das Neuladen der Seite.
	let stand = $state(untrack(() => (data.offen ? data.stand : null)));

	$effect(() => {
		if (!data.offen) return;
		const quelle = new EventSource('/p/strom');
		quelle.onmessage = (e) => {
			stand = JSON.parse(e.data);
		};
		/*
		 * **Ein endgültig geschlossener Strom heisst meist: Der Code gilt nicht
		 * mehr** (A3, Codeprüfung 15.10.2026). Seit der Herzschlag in `/p/strom`
		 * den Code nachprüft, schliesst der Server die Verbindung, wenn die
		 * Sitzungsleitung einen neuen erzeugt hat oder die Stunde nach dem Schluss
		 * um ist. Der Browser verbindet neu, bekommt 401, und `EventSource` gibt
		 * danach auf. Ohne diese Zeilen stand die Wand dann mit dem letzten Stand
		 * still, ohne jedes Zeichen. Der Nachzug holt den Load, und der zeigt den
		 * Grund und das Eingabefeld.
		 *
		 * Bei einem Netzunterbruch bleibt die Quelle in `CONNECTING` und versucht
		 * es selbst weiter. `CLOSED` heisst aber auch jede andere Antwort als 200,
		 * etwa ein 502 beim Neustart; dann holt der Load eine offene Sicht, und der
		 * Strom wird neu aufgebaut. **Erst nach drei Sekunden**, im Takt des
		 * Browsers: Sofort nachgezogen, liefe eine Störung des Stroms als Schleife
		 * aus Stromaufruf und zwei vollen Loads ohne Pause (Codeprüfung, Runde 2).
		 */
		let abgewiesen: ReturnType<typeof setTimeout> | undefined;
		quelle.onerror = () => {
			if (quelle.readyState !== EventSource.CLOSED || abgewiesen) return;
			abgewiesen = setTimeout(() => nach.jetzt('strom-abgewiesen'), 3_000);
		};
		return () => {
			clearTimeout(abgewiesen);
			quelle.close();
		};
	});

	/*
	 * Wechselt das Wandbild, muss diese Sicht nachladen.
	 *
	 * Der Strom trägt nur die Marke — Art und Zeitpunkt, nie den Wortlaut
	 * (AD-11). Anders als beim Traktandum, dessen Titel ohnehin mitfliesst,
	 * liesse sich der freie Text sonst gar nicht anzeigen.
	 */
	/*
	 * **Ein Nachzieher, eine zusammengesetzte Marke** (09.09.2026).
	 *
	 * Vorher hielt diese Seite zwei Merker, einen für das Wandbild und einen für
	 * die Pause, mit der Begründung, sie sollten einander nicht ins Gehege
	 * kommen. Unter `location.reload()` trug das: Ein Neuladen holte beides, und
	 * nach dem Laden stimmten beide Merker, weil die Seite neu aufgebaut wurde.
	 *
	 * Ein Nachzug baut sie nicht neu auf. Wechseln Wandbild und Pause im selben
	 * Beitrag, feuerten zwei Nachzieher nebeneinander — zwei Abrufe für denselben
	 * Stand, und die Frage, welcher zuletzt schreibt. Dieselbe Lehre steht seit
	 * dem 22.08.2026 in `routes/z/+page.svelte`: ein Wert, ein Vergleich, ein
	 * Merker.
	 */
	const nach = nachzieher(
		untrack(() =>
			data.offen
				? [
						data.versammlung.zustand,
						data.stand?.wandbild ?? '-',
						data.versammlung.pause?.seit ?? '-'
					].join('|')
				: null
		)
	);
	// Der Nachzieher hängt sich für die Lebensdauer der Seite an das Fenster;
	// hier wird er wieder abgemeldet.
	$effect(() => nach.ende);

	$effect(() => {
		if (!data.offen || !stand) return;
		/*
		 * **Der Zustand gehört mit hinein** (Code-Review 09.09.2026). Das
		 * Schliessen der Versammlung ändert weder Wandbild noch Pause; ohne ihn
		 * zeigte diese Sicht weiter das letzte Geschäft, während die
		 * Schwestersicht längst auf den Abschluss umgeschaltet hat.
		 */
		nach.jetzt(
			[stand.zustand ?? data.versammlung.zustand, stand.wandbild ?? '-', stand.pause ?? '-'].join(
				'|'
			)
		);
	});

	/*
	 * **Die Unterbrechung steht in derselben Marke** — und sie fehlte hier bis
	 * zum 22.08.2026 ganz.
	 *
	 * Der Strom trug die Pausenmarke von Anfang an, der Server verkündete sie,
	 * und im Strom stand geschrieben, die Saalsicht erkenne daran, «dass sie
	 * nachladen und die Pausenansicht zeigen muss». Nur las das hier niemand:
	 * Die Pause kam aus `data`, und `data` wechselt nicht von selbst. Im
	 * Prüflauf hing die Wand deshalb weiter am Traktandum, während die Leitung
	 * meldete, dort stehe die Pause — der Satz war eine Behauptung, keine
	 * Messung.
	 */

	const abstimmung = $derived(stand?.abstimmung ?? null);
	const aktuelles = $derived(
		data.offen ? data.traktanden.find((t) => t.id === stand?.aktuellesTraktandumId) : undefined
	);

	const MONATE = [
		'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
		'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
	];

	function datumLang(iso: string): string {
		const [j, m, t] = iso.split('-').map(Number);
		return j && m && t ? `${t}. ${MONATE[m - 1]} ${j}` : iso;
	}
</script>

<svelte:head>
	<title>Präsentation</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !data.offen}
	<section class="einstieg">
		<h1>Präsentationssicht</h1>
		{#if data.grund}
			<p class="meldung fehler" role="alert">{data.grund}</p>
		{/if}
		{#if form?.fehler}
			<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
		{/if}
		<p class="hilfe">
			Diese Sicht gehört auf die Leinwand. Sie verlangt den Code, den die Sitzungsleitung beim Eröffnen sieht — die
			Sitzungsleitung sieht ihn beim Eröffnen und kann jederzeit einen neuen erzeugen.
		</p>
		<form method="POST" action="?/oeffnen">
			<label>
				Code für die Leinwand
				<input
					name="code"
					{...anfangswert(form?.eingabe ?? '')}
					placeholder="ABCD-EFGH-JKMN"
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					required
				/>
			</label>
			<button type="submit">Anzeigen</button>
		</form>
	</section>
{:else}
	<Vollbildecke />

	<div class="buehne">
		<header>
			<span>{data.gemeinschaftName}</span>
			<span>
				{datumLang(data.versammlung.datum)}, {data.versammlung.uhrzeit} Uhr · {data.versammlung.ort}
			</span>
		</header>

		<!--
			**Beim Punkt, der sie zum Gegenstand hat, füllt sie die Wand**
			(28.08.2026, wie am gemeinsamen Abend). Sonst steht sie unten in der
			Fusszeile.

			**Als Baustein an `Saalbild`, nicht davor** (01.09.2026): Dort hat sie
			ihren Platz in der Rangfolge und tritt an die Stelle der
			Traktandensicht. Stand sie davor, ersetzte sie auch Pause und
			Abschluss — die beiden Bilder, die im Saalbild ausdrücklich «vor allem
			anderen» stehen.
		-->
		{#snippet beschlussfaehigkeitsbild()}
			<Beschlussfaehigkeitsanzeige
				bedingungen={stand!.bedingungen}
				beschlussfaehig={stand!.beschlussfaehig}
				titel={data.gemeinschaftName}
				groesse="saal"
			/>
		{/snippet}

		<Saalbild
			{abstimmung}
			aufgerufen={aktuelles
				? { ...aktuelles, noetig: data.noetig, ausstandsgrund: data.ausstandsgrund }
				: null}
			traktanden={data.traktanden}
			wandbild={data.versammlung.wandbild}
			pause={data.versammlung.pause ?? null}
			abschluss={data.abschluss}
			beschlussfaehigkeit={data.beschlussfaehigkeitImVordergrund && stand?.bedingungen.length
				? beschlussfaehigkeitsbild
				: null}
			anlass={{
				gemeinschaft: data.gemeinschaftName,
				wann: `${datumLang(data.versammlung.datum)}, ${data.versammlung.uhrzeit} Uhr`,
				ort: data.versammlung.ort
			}}
		/>

		<!--
			**Die Beschlussfähigkeit als Balkenpaar** (Auftraggeber, 23.08.2026): «Könnte man
			die Beschlussfähigkeit als Gauge anzeigen? Braucht weniger Platz.»

			Vorher standen hier drei Spannen nebeneinander — Anwesende,
			Kopfstimmen/Quoten, und das Urteil. Was fehlte, war die **Schwelle**:
			«512 von 1000 Wertquoten» sagt niemandem im Saal, ob das reicht.

			Der Name der Gemeinschaft steht dazu, weil an einem gemeinsamen Abend
			mehrere Häuser tagen und die Wand jeweils EINES zeigt (der Code
			gehört zu einer Versammlung). Wer hereinkommt, muss sehen, wessen Zahlen
			das sind.
		-->
		<footer>
			{#if stand}
				<span class="anwesend">{stand.anzahlAnwesend} von {stand.anzahlGesamt} anwesend</span>
				{#if stand.bedingungen.length > 0}
					<Beschlussfaehigkeitsanzeige
						bedingungen={stand.bedingungen}
						beschlussfaehig={stand.beschlussfaehig}
						titel={data.gemeinschaftName}
						groesse="saal"
					/>
				{:else}
					<span>{stand.kopfstimmenAnwesend} Kopfstimmen · {stand.quotenAnwesend} von {stand.gesamtquote} Wertquoten</span>
				{/if}
			{/if}
		</footer>
	</div>
{/if}

<style>
	/* Für den Beamer gebaut: grosse Schrift, ruhiger Hintergrund, keine
	   Bedienelemente. Was hier steht, liest der hinterste im Saal. */
	.buehne {
		min-height: 90vh;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	header,
	footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		color: var(--text-leise);
		font-size: 1.1rem;
	}

	header {
		border-bottom: 1px solid var(--linie);
		padding-bottom: 0.5rem;
	}

	footer {
		border-top: 1px solid var(--linie);
		padding-top: 0.5rem;
		margin-top: auto;
		font-variant-numeric: tabular-nums;
	}

	/*
	 * `.gut` und `.schlecht` sind mit der Balkenanzeige weggefallen
	 * (23.08.2026) — das Urteil steht jetzt in der Komponente, samt Farbe. Zwei
	 * Stellen, die dasselbe einfärben, laufen früher oder später auseinander.
	 */



	h1 {
		font-size: clamp(2rem, 5vw, 4rem);
		line-height: 1.1;
		margin: 0 0 1rem;
	}















	/* ── Der Einstieg ────────────────────────────────────────────────────── */
	.einstieg {
		max-width: 32rem;
		margin: 3rem auto;
	}

	.hilfe {
		color: var(--text-leise);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1.5rem 0;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 550;
	}

	input {
		min-height: 3.25rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-family: ui-monospace, monospace;
		font-size: 1.1rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	button {
		min-height: 3.25rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-size: 1.05rem;
		font-weight: 600;
		cursor: pointer;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		margin: 1rem 0;
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}
</style>
