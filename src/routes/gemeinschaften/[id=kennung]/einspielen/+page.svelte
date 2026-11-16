<script lang="ts">
	import Meldung from '$lib/components/Meldung.svelte';
	import { manifestzeitpunkt } from '$lib/domain/datum';
	import { anwendungInWorten } from '$lib/domain/version';
	let { data, form } = $props();

	/*
	 * Einzeln herausgezogen statt als ein Objekt: Das Formularergebnis ist eine
	 * Vereinigung aus «Fehler» und «Vorschau», und eine Prüfung auf ein Feld
	 * verengt in Svelte nicht den ganzen Wert.
	 */
	const befund = $derived(form && 'befund' in form ? (form.befund ?? null) : null);
	const moeglich = $derived(form && 'moeglich' in form ? (form.moeglich ?? null) : null);
	const beschluesse = $derived(form && 'beschluesse' in form ? (form.beschluesse ?? []) : []);
	const siegel = $derived(form && 'siegel' in form ? (form.siegel ?? '') : '');
</script>

<h1>Eine Versammlung von aussen aufnehmen</h1>

<p class="einleitung">
	Für Versammlungen, die auf einem anderen Gerät geführt wurden — etwa auf dem Notebook im Saal
	ohne Netz. Aufgenommen wird das <strong>Abschlusspaket als Ganzes</strong>, so wie es dort
	versiegelt wurde. Es bleibt unverändert; nachgebaut wird hier nichts.
</p>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{/if}

{#if !befund || !moeglich}
	<form method="POST" action="?/pruefen" enctype="multipart/form-data" class="untereinander kachel">
		<label>
			Abschlusspaket (ZIP)
			<input type="file" name="paket" accept=".zip,application/zip" required />
		</label>
		<label class="breit">
			Siegel, falls bekannt
			<input name="siegel" placeholder="64 Zeichen, hexadezimal" autocomplete="off" />
			<span class="hilfe">
				Freiwillig. Ohne Eintrag wird das Siegel aus dem Paket gerechnet — das beantwortet, ob
				das Paket in sich stimmt, aber nicht, ob es dasselbe ist wie damals.
			</span>
		</label>
		<div class="knoepfe">
			<button type="submit">Prüfen</button>
		</div>
	</form>

	<details class="hintergrund">
		<summary>Was heisst «als Ganzes»?</summary>
		<p>
			Die Versammlung wird hier <strong>nicht</strong> als eigene Versammlung angelegt. Sie ist
			anderswo geführt, geschlossen und versiegelt worden; das Siegel gilt für das Paket. Würde
			die Anwendung daraus wieder Zeilen bauen, stünde neben dem Nachweis eine zweite Fassung,
			die sich ab dem ersten Tag von ihm entfernen kann.
		</p>
		<p>
			Deshalb bleibt das Paket, wie es ist. Was in ihm steht — Beschlüsse, Auswertung,
			Anwesenheit, Verlauf —, wird beim Anzeigen daraus gelesen. Und es lässt sich jederzeit
			herunterladen und mit der <a href="/pruefen">Prüfseite</a> nachrechnen.
		</p>
	</details>
{:else}
	<h2>Vorschau: {form?.dateiname ?? 'Paket'}</h2>

	<!--
		Vier getrennte Aussagen wie auf der Prüfseite, und darüber die eine Frage,
		die hier zusätzlich zählt: Darf das aufgenommen werden?
	-->
	<div class="meldung" class:gut={moeglich.moeglich} class:warnung={!moeglich.moeglich}>
		<p><strong>{moeglich.moeglich ? 'Kann aufgenommen werden.' : 'Wird nicht aufgenommen.'}</strong></p>
		<p>{moeglich.satz}</p>
	</div>

	{#if befund.manifest}
		{@const m = befund.manifest}
		{@const anwendung = anwendungInWorten((m as { anwendung?: unknown }).anwendung)}
		<section class="teil">
			<h3>Was im Paket steht</h3>
			<dl class="angaben">
				<dt>Gemeinschaft</dt>
				<dd>{m.gemeinschaft}</dd>
				<dt>Versammlung</dt>
				<dd>{manifestzeitpunkt(m.versammlung.datum)}, {m.versammlung.uhrzeit} — {m.versammlung.ort}</dd>
				<dt>Art</dt>
				<dd>{m.versammlung.art}, {m.versammlung.stufe}</dd>
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
				<dd class="pruefsumme">{befund.gerechnetesSiegel}</dd>
			</dl>
		</section>

		<section class="teil">
			<h3>Prüfung</h3>
			<ul class="aussagen">
				<li>{befund.inhalt?.satz ?? 'Ohne Manifest nicht prüfbar.'}</li>
				<li>{befund.herkunft.satz}</li>
				{#if befund.zeitstempel}
					<li>{befund.zeitstempel.satz}</li>
				{:else}
					<li>Dem Paket liegt kein Zeitstempel bei.</li>
				{/if}
			</ul>
		</section>

		{#if beschluesse.length > 0}
			<section class="teil">
				<h3>Beschlüsse, die mitkommen</h3>
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
							{#each beschluesse as b (b.nummer + b.titel)}
								<tr>
									<td class="zahl">{b.nummer}</td>
									<td>
										{b.titel}
										{#if b.erfordernis}
											<span class="klein">{b.erfordernis}</span>
										{/if}
									</td>
									<td>{b.satz ?? '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	{/if}

	{#if moeglich.moeglich}
		<form method="POST" action="?/aufnehmen" enctype="multipart/form-data" class="untereinander">
			<!--
				Die Datei kommt noch einmal mit: Ein Browser kann sie zwischen den
				beiden Schritten nicht behalten, und der Server prüft sie ohnehin ein
				zweites Mal — sonst liesse sich mit dem zweiten Formular eine andere
				Datei einreichen als die geprüfte.
			-->
			<label>
				Dasselbe Paket noch einmal wählen
				<input type="file" name="paket" accept=".zip,application/zip" required />
				<span class="hilfe">
					Geprüft wird erneut. Ist es ein anderes Paket, wird es abgewiesen statt aufgenommen.
				</span>
			</label>
			<input type="hidden" name="siegel" value={siegel} />
			<label class="breit">
				Woher es kommt
				<input name="herkunft" placeholder="Notebook aus dem Saal, USB-Stick" autocomplete="off" />
				<span class="hilfe">
					Freiwillig, steht später im Verlauf. Ein Jahr später ist das die Angabe, die niemand
					mehr rekonstruieren kann.
				</span>
			</label>
			<div class="knoepfe">
				<button type="submit">Aufnehmen</button>
				<a href="/gemeinschaften/{data.gemeinschaft.id}/einspielen">Von vorn</a>
			</div>
		</form>
	{:else}
		<div class="knoepfe">
			<a href="/gemeinschaften/{data.gemeinschaft.id}/einspielen">Anderes Paket wählen</a>
		</div>
	{/if}
{/if}

<style>

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		background: var(--flaeche);
		margin: 1rem 0;
		max-width: 46rem;
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.meldung p {
		margin: 0 0 0.4rem;
	}

	.meldung p:last-child {
		margin: 0;
	}

	.untereinander {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.9rem;
		max-width: 46rem;
		margin-top: 1.25rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		font-weight: 550;
	}

	.hilfe {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	input[type='file'] {
		font: inherit;
		font-weight: 400;
		padding: 0.4rem 0;
	}

	input[name='siegel'],
	input[name='herkunft'] {
		min-height: var(--ziel-min);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	.knoepfe {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.75rem;
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
		flex: none;
	}

	.teil {
		margin-top: 1.5rem;
		max-width: 46rem;
	}

	.teil h3 {
		font-size: 1rem;
		margin: 0 0 0.5rem;
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

	.aussagen {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.95rem;
	}

	.aussagen li {
		margin-bottom: 0.3rem;
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

	.hintergrund {
		margin-top: 2rem;
		max-width: 46rem;
	}

	summary {
		cursor: pointer;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
		color: var(--text-leise);
	}

	.hintergrund p {
		font-size: 0.95rem;
		color: var(--text-leise);
	}
</style>
