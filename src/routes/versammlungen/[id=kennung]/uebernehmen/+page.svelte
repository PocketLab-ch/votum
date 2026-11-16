<script lang="ts">
	import Meldung from '$lib/components/Meldung.svelte';
	let { data, form } = $props();

	const v = $derived(data.versammlung);
</script>


<h1>Traktanden aus einer früheren Versammlung übernehmen</h1>

<p class="einleitung">
	Einzeln wählbar, nicht alles oder nichts: Aus einer früheren Versammlung interessieren meist ein
	oder zwei Geschäfte. Übernommen werden Titel, Inhalt, Kurzfassung, Antragswortlaut und das
	Mehrheitserfordernis samt seiner Fassungskennung — unverändert, damit sich nichts still ändert.
</p>
<!--
	Produktentscheid 02.10.2026 «Ja, weglassen»; der Satz sagt, warum ein Punkt fehlt, den jemand
	sucht (Codeprüfung 02.10.2026). Nur solange die Traktanden änderbar sind: Nach der Freigabe
	riete er zu einem Schritt, den es nicht mehr gibt.
-->
{#if data.aenderbar}
	<p class="einleitung">
		Was erst während einer Versammlung entstanden ist, etwa ein Rückkommensantrag, steht nicht zur
		Auswahl. Legen Sie ein solches Traktandum neu an, wenn es wieder auf die Liste soll.
	</p>
{/if}

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{/if}

{#if !data.aenderbar}
	<p class="meldung">Die Versammlung ist freigegeben — die Traktanden sind gesperrt.</p>
{:else if data.angebote.length === 0}
	<p class="leer">
		Für diese Gemeinschaft gibt es keine frühere Versammlung mit übernehmbaren Traktanden. Die
		Pflichttraktanden entstehen ohnehin von selbst und werden deshalb nicht angeboten.
	</p>
{:else}
	<form method="POST">
		{#each data.angebote as angebot (angebot.versammlungId)}
			<section class="versammlung">
				<h2>
					Versammlung vom {angebot.datum}
					<span class="leise">
						{angebot.art === 'ordentlich' ? 'ordentlich' : 'ausserordentlich'}
					</span>
				</h2>

				<ul>
					{#each angebot.traktanden as t (t.quelle.traktandumId)}
						<li>
							<label>
								<input type="checkbox" name="traktandum" value={t.quelle.traktandumId} />
								<span class="inhalt">
									<strong>{t.quelle.titel}</strong>
									{#if t.quelle.art === 'kenntnisnahme'}
										<span class="marke">Kenntnisnahme</span>
									{/if}
									{#if t.quelle.kurzfassung}
										<span class="klein">{t.quelle.kurzfassung}</span>
									{/if}
									{#if t.quelle.erfordernisTitel}
										<span class="klein">
											Erfordernis: {t.quelle.erfordernisTitel}
											{#if t.quelle.erfordernisFassung}
												(Fassung {t.quelle.erfordernisFassung})
											{/if}
										</span>
									{/if}
									{#if t.fassungshinweis}
										<span class="warnung">{t.fassungshinweis}</span>
									{/if}
									{#each t.bleibtZurueck as zurueck (zurueck)}
										<span class="klein zurueck">{zurueck}</span>
									{/each}
								</span>
							</label>
						</li>
					{/each}
				</ul>
			</section>
		{/each}

		<button type="submit">Gewählte übernehmen</button>
	</form>
{/if}

<style>

	.leer {
		color: var(--text-leise);
		max-width: 46rem;
	}

	.versammlung {
		margin-top: 1.75rem;
		max-width: 46rem;
	}

	h2 {
		font-size: 1rem;
		margin: 0 0 0.5rem;
	}

	.leise {
		font-weight: 400;
		color: var(--text-leise);
		font-size: 0.85rem;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	li {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.7rem 0.85rem;
	}

	label {
		display: flex;
		gap: 0.7rem;
		align-items: flex-start;
		cursor: pointer;
	}

	.inhalt {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.zurueck::before {
		content: '↩ ';
	}

	.warnung {
		font-size: 0.85rem;
		padding: 0.35rem 0.55rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 14%, transparent);
	}

	.marke {
		display: inline-block;
		font-size: 0.75rem;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		color: var(--text-leise);
		align-self: flex-start;
	}

	input[type='checkbox'] {
		width: 1.15rem;
		height: 1.15rem;
		margin-top: 0.2rem;
		flex: none;
	}

	button {
		margin-top: 1.5rem;
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
		margin-top: 1rem;
	}

</style>
