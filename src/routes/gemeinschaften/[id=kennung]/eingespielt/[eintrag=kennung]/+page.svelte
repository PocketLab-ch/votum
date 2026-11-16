<script lang="ts">
	import { manifestzeitpunkt } from '$lib/domain/datum';
	import { anwendungInWorten } from '$lib/domain/version';

	let { data } = $props();

	const m = $derived(data.eintrag.manifest);
	const anwendung = $derived(anwendungInWorten((m as { anwendung?: unknown }).anwendung));

	function groesse(bytes: number): string {
		return bytes < 1024 * 1024
			? `${Math.round(bytes / 1024)} kB`
			: `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	function zeitpunkt(iso: string): string {
		// Ein unlesbarer Wert aus einem nur gecasteten Manifest steht roh da
		// statt als «Invalid Date» (Code-Review 06.10.2026).
		if (Number.isNaN(Date.parse(iso))) return iso;
		return new Date(iso).toLocaleString('de-CH', {
			timeZone: 'Europe/Zurich',
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}
</script>

<p class="weg"><a href="/gemeinschaften/{data.gemeinschaft.id}/historie">Versammlungen</a></p>

<h1>{manifestzeitpunkt(m.versammlung.datum)} — {m.versammlung.ort}</h1>

<p class="marke">Von aussen aufgenommen</p>

<p class="einleitung">
	Diese Versammlung wurde <strong>nicht hier</strong> geführt, sondern anderswo — und dort
	geschlossen und versiegelt. Aufbewahrt wird ihr Abschlusspaket, so wie es ist. Was unten steht,
	ist bei jedem Aufruf daraus gelesen; geändert werden kann daran nichts.
</p>

<section class="teil">
	<h2>Angaben</h2>
	<dl class="angaben">
		<dt>Gemeinschaft</dt>
		<dd>{m.gemeinschaft}</dd>
		<dt>Beginn</dt>
		<dd>{m.versammlung.uhrzeit}</dd>
		<dt>Art</dt>
		<dd>{m.versammlung.art}, {m.versammlung.stufe}</dd>
		<dt>Geschlossen</dt>
		<!--
			`geschlossenAm` ist anders als `versiegeltAm` ein echter Zeitpunkt in UTC
			(`toISOString()`), deshalb umgerechnet in Schweizer Zeit wie
			«Aufgenommen» unten (Code-Review 06.10.2026: stand roh als
			«2026-10-04T19:30:12.345Z»).
		-->
		<dd>
			{m.versammlung.geschlossenAm
				? zeitpunkt(String(m.versammlung.geschlossenAm))
				: 'nicht vermerkt'}
		</dd>
		<dt>Versiegelt</dt>
		<dd>{manifestzeitpunkt(m.versiegeltAm)} durch {m.versiegeltDurch}</dd>
		<dt>Zeitquelle</dt>
		<dd>{m.zeitquelle}</dd>
		<!-- Seit Entscheid 0053; ältere Pakete tragen die Angabe nicht. -->
		{#if anwendung}
			<dt>Anwendung</dt>
			<dd>{anwendung}</dd>
		{/if}
		<dt>Siegel</dt>
		<dd class="pruefsumme">{data.eintrag.siegel}</dd>
		<dt>Aufgenommen</dt>
		<dd>
			{zeitpunkt(data.eintrag.eingespieltAm)} durch {data.eintrag.eingespieltDurch}{#if data.eintrag.herkunft},
				{data.eintrag.herkunft}{/if}
		</dd>
		<dt>Paket</dt>
		<dd>{groesse(data.eintrag.groesse)}</dd>
	</dl>
</section>

<section class="teil">
	<h2>Beschlüsse</h2>
	{#if data.beschluesse.length === 0}
		<p class="leer">
			Im Paket steht keine Auswertung. Das kommt vor, wenn die Versammlung ohne Abstimmung
			geschlossen wurde — die übrigen Bestandteile sind trotzdem enthalten.
		</p>
	{:else}
		<div class="tabellenrahmen">
			<table>
				<thead>
					<tr>
						<th>Nr.</th>
						<th>Traktandum</th>
						<th>Ergebnis</th>
					</tr>
				</thead>
				<tbody>
					{#each data.beschluesse as b (b.nummer + b.titel)}
						<tr>
							<td class="zahl">{b.nummer}</td>
							<td>
								{b.titel}
								{#if b.antragswortlaut}
									<span class="klein wortlaut">«{b.antragswortlaut}»</span>
								{/if}
								{#if b.erfordernis}
									<span class="klein">
										{b.erfordernis}{#if b.rechtsgrundlage} · {b.rechtsgrundlage}{/if}
									</span>
								{/if}
							</td>
							<td>{b.satz ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<section class="teil">
	<h2>Das Paket</h2>
	<p class="hilfe">
		Dieselben Bytes, die eingespielt wurden. Wer nachrechnen will, ob hier dasselbe liegt wie
		damals im Saal, lädt es herunter und legt es auf die <a href="/pruefen">Prüfseite</a>.
	</p>
	<p>
		<a class="knopf" href="/gemeinschaften/{data.gemeinschaft.id}/eingespielt/{data.eintrag.id}/paket.zip">
			Abschlusspaket herunterladen
		</a>
	</p>
	<details>
		<summary>Was das Paket enthält</summary>
		<ul class="bestandteile">
			{#each m.eintraege as e (e.pfad)}
				<li><strong>{e.pfad}</strong> — {e.beschreibung}</li>
			{/each}
		</ul>
		{#if m.nichtEnthalten.length > 0}
			<p class="hilfe"><strong>Was ausdrücklich nicht enthalten ist:</strong></p>
			<ul class="bestandteile">
				{#each m.nichtEnthalten as n (n.was)}
					<li>{n.was} — {n.grund}</li>
				{/each}
			</ul>
		{/if}
	</details>
</section>

<style>
	.weg {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
	}

	.marke {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		font-size: 0.85rem;
		color: var(--text-leise);
		margin: 0 0 0.75rem;
	}

	.teil {
		margin-top: 2rem;
		max-width: 46rem;
	}

	.teil h2 {
		font-size: 1.05rem;
		margin: 0 0 0.6rem;
	}

	.angaben {
		display: grid;
		grid-template-columns: minmax(0, 10rem) minmax(0, 1fr);
		gap: 0.3rem 1rem;
		margin: 0;
		font-size: 0.95rem;
	}

	dt {
		color: var(--text-leise);
	}

	dd {
		margin: 0;
	}

	.pruefsumme {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}

	.tabellenrahmen {
		overflow-x: auto;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.45rem 0.75rem;
		border-bottom: 1px solid var(--linie);
		vertical-align: top;
		min-width: 0;
	}

	th {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--text-leise);
		white-space: nowrap;
	}

	.zahl {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.klein {
		display: block;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.wortlaut {
		font-style: italic;
	}

	.leer,
	.hilfe {
		color: var(--text-leise);
		font-size: 0.95rem;
	}

	.knopf {
		display: inline-flex;
		align-items: center;
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font-weight: 550;
		text-decoration: none;
	}

	summary {
		cursor: pointer;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
		color: var(--text-leise);
	}

	.bestandteile {
		margin: 0 0 0.5rem;
		padding-left: 1.25rem;
		font-size: 0.9rem;
		color: var(--text-leise);
	}
</style>
