<script lang="ts">
	/**
	 * **Der Ausweichplan des Abends, an einer Stelle.**
	 *
	 * Der Aufbau folgt der Ausfallseite im Haus
	 * (`versammlungen/[id]/ausfall/+page.svelte`), nur mit einer Ebene mehr: Dort
	 * steht je Unterlage eine Karte, hier je **Gemeinschaft** eine, denn jede
	 * bringt ihren eigenen Satz mit. Was in der Karte steht, sagt derselbe Satz
	 * wie dort — zwei Beschreibungen derselben Unterlage würden auseinanderlaufen.
	 */
	let { data } = $props();

	const offen = $derived(data.haeuser.filter((h) => !h.erledigt).length);
	const gesperrt = $derived(data.haeuser.filter((h) => !h.freigegeben).length);

	/*
	 * Der Satz steht hier und nicht im Markup: Ausgeschrieben zwischen den
	 * Tags las ihn der Textwächter als einen Satz von 201 Zeichen, und er hat
	 * recht — was zwischen zwei Tags steht, liest ein Mensch am Stück.
	 */
	const gesperrtSatz = $derived(
		gesperrt === 1
			? 'Eine Gemeinschaft ist noch nicht freigegeben.'
			: `${gesperrt} Gemeinschaften sind noch nicht freigegeben.`
	);
</script>

<h1>Ausfallsicherung</h1>

<p class="einleitung">
	<strong>Holen Sie diese Unterlagen vor der Versammlung</strong>: auf Papier oder auf einen Stick,
	je Gemeinschaft ein eigener Satz. Wer sie braucht, hat den Server nicht mehr, von dem er sie holen
	könnte.
</p>

{#if data.haeuser.length === 0}
	<p class="leer">
		Noch tagt keine Gemeinschaft mit. Nehmen Sie unter «Wer tagt mit» eine Versammlung auf.
	</p>
{:else}
	{#if gesperrt > 0}
		<!--
			Dieselbe Warnung wie im Haus, nur gezählt: Die Unterlagen rechnen auf
			der Momentaufnahme, und ohne Freigabe gibt es die nicht. Der Downloadweg
			sagt dann mit HTTP 400 ab — ein Knopf, der dorthin führt, gehört nicht
			hin (Absagenwächter, 23.08.2026).
		-->
		<p class="meldung warnung">
			{gesperrtSatz} Ihre Unterlagen rechnen auf dem eingefrorenen Stand der Stimmberechtigten.
			Vorher gibt es ihn nicht.
			<a href="/tage/{data.rahmenTag.id}/freigeben">Jetzt freigeben</a>
		</p>
	{/if}

	<p class="stand">
		{#if offen === 0}
			Für alle {data.haeuser.length} Gemeinschaften geholt.
		{:else}
			{offen} von {data.haeuser.length}
			{data.haeuser.length === 1 ? 'Gemeinschaft' : 'Gemeinschaften'} noch offen.
		{/if}
	</p>

	<section class="haeuser">
		{#each data.haeuser as h (h.versammlungId)}
			<article class:erledigt={h.erledigt}>
				<h2>{h.name}</h2>
				{#if h.stand}
					<p class="zwischenstand">{h.stand}</p>
				{:else if h.erledigt}
					<p class="zwischenstand">alle Unterlagen geholt</p>
				{/if}

				<!--
					**Die Traktandenliste hängt nicht an der Freigabe** (aus dem
					Code-Review). Sie rechnet nicht auf der Momentaufnahme, und im Haus
					steht sie schon im Entwurf bereit. Sie mit den anderen zu sperren
					hiesse, vor der Freigabe gar nichts anzubieten.
				-->
				<ul class="wege">
					<li>
						<a href="/versammlungen/{h.versammlungId}/traktandenliste.pdf" target="_blank" rel="noopener"
							>Traktandenliste</a
						>
						<span>Antragswortlaut und nötiges Mehr — das, was sonst an der Wand stünde.</span>
					</li>
				</ul>

				{#if h.freigegeben}
					<ul class="wege">
						<li>
							<a
								href="/versammlungen/{h.versammlungId}/unterschriftenliste.pdf"
								target="_blank"
								rel="noopener">Anwesenheits- und Unterschriftenliste</a
							>
							<span>
								Trägt den Nachweis der Anwesenheit, nicht das System. Ausdrucken und an den Eingang
								legen.
							</span>
						</li>
						<li>
							<a href="/versammlungen/{h.versammlungId}/stimmzettel.pdf" target="_blank" rel="noopener"
								>Stimmzettel und Zählblatt</a
							>
							<span>Je Traktandum ein Zettel; vorne das Zählblatt für die Sitzungsleitung.</span>
						</li>
						{#if h.mappeNoetig}
							<li>
								<a href="/versammlungen/{h.versammlungId}/auszaehlung.xlsx">Auszählmappe</a>
								<span>
									Für alles, was Handzählen nicht leistet, etwa Wertquoten, Abwesende in der
									Bezugsgrösse, ungleiche Kopfstimmen, zweite Ergebnisse oder neue Traktanden.
								</span>
							</li>
						{:else}
							<li class="entfaellt">
								<span>
									<strong>Keine Auszählmappe nötig.</strong> Hier entscheidet jedes Traktandum am einfachen
									Mehr der Anwesenden, und alle Parteien haben gleich viele Kopfstimmen. Das lässt sich
									im Saal auszählen.
								</span>
							</li>
						{/if}
					</ul>
				{:else}
					<p class="probe">Bereit, sobald diese Gemeinschaft freigegeben ist.</p>
				{/if}

				<a class="leise" href="/versammlungen/{h.versammlungId}/ausfall">
					Zur Ausfallsicherung dieser Gemeinschaft
				</a>
			</article>
		{/each}
	</section>
{/if}

<details class="erklaerung lesebreite">
	<summary>Was heisst das im Saal?</summary>
	<p>
		<strong>Teilausfall — das Netz ist weg, der Server läuft.</strong> Dann bleibt die Anwendung Ihr
		Werkzeug: Die Telefone erreichen sie nicht mehr, aber Sie tragen die Stimmen selbst ein.
		Abgestimmt wird im Saal durch Handerheben, gerechnet wird hier.
	</p>
	<p>
		<strong>Totalausfall — der Rechner ist weg.</strong> Jetzt zählt nur, was auf Papier liegt. Und
		es zählt <em>je Gemeinschaft</em>: Jede hat ihre eigene Beschlussfähigkeit, ihre eigenen
		Wertquoten und ihre eigene Unterschriftenliste. Ein gemeinsamer Stapel für den ganzen Abend
		hilft niemandem, wenn im Nachhinein für eine einzelne Gemeinschaft nachgewiesen werden muss,
		wer da war.
	</p>
</details>

<style>
	.stand {
		color: var(--text-leise);
		margin: 1rem 0 0.5rem;
	}

	.haeuser {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(min(22rem, 100%), 1fr));
		max-width: 74rem;
		margin: 0.5rem 0 1.5rem;
	}

	article {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
	}

	article.erledigt {
		border-color: color-mix(in srgb, var(--akzent) 45%, var(--linie));
	}

	.leer {
		color: var(--text-leise);
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.zwischenstand {
		margin: 0;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.wege {
		list-style: none;
		margin: 0.3rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		flex: 1;
	}

	.wege li {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.wege span {
		color: var(--text-leise);
		font-size: 0.88rem;
	}

	.entfaellt span {
		color: var(--text);
	}

	.probe {
		margin: 0;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
		color: var(--text);
		font-size: 0.9rem;
		flex: 1;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		max-width: 46rem;
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.leise {
		align-self: flex-start;
		font-size: 0.88rem;
	}

	.erklaerung {
		margin-top: 1rem;
	}

	.erklaerung summary {
		cursor: pointer;
		font-weight: 550;
		padding: 0.4rem 0;
	}
</style>
