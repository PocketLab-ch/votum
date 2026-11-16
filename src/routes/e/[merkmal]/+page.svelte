<script lang="ts">
	import Meldung from '$lib/components/Meldung.svelte';
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Teilnahme melden</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="karte">
	{#if !data.gueltig}
		<h1>Zugang nicht gültig</h1>
		<p>{data.grund ?? 'Dieser Zugang ist nicht gültig.'}</p>
	{:else if form?.gemeldet}
		<h1>Gemeldet</h1>
		<p>
			Ihre Meldung liegt der Sitzungsleitung vor. Sie ordnet sie Ihrem Eigentum zu und gibt die
			Teilnahme frei — melden Sie sich, wenn es zu lange dauert.
		</p>
		<p class="klein">
			Beim nächsten Mal geht es schneller mit Ihrer persönlichen Zugangskarte: Sie kommt mit der
			Einladung.
		</p>
	{:else}
		<p class="oben">{data.gemeinschaftName}</p>
		<h1>Teilnahme melden</h1>
		<p class="wann">Versammlung vom {data.datum}, {data.uhrzeit} Uhr · {data.ort}</p>

		<div class="mitkarte">
			<h2>Sie haben Ihre Zugangskarte dabei?</h2>
			<p class="klein">
				Dann tippen Sie den Code darauf ein — das geht auch, wenn die Kamera den kleinen QR-Code
				nicht liest.
			</p>
			<a class="knopf" href="/z">Code eingeben</a>
		</div>

		<p class="trenner"><span>oder ohne Karte</span></p>

		<p class="hinweis">
			Sie haben Ihre Karte nicht dabei? Dann melden Sie sich hier. Dieser Weg führt nicht
			unmittelbar in die Versammlung: Die Sitzungsleitung ordnet Ihre Meldung zu und gibt sie frei.
		</p>

		{#if form?.fehler}
			<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
		{/if}

		<form method="POST">
			<label>
				Ihr Name
				<input name="name" required minlength="2" maxlength="200" autocomplete="name" />
				<span class="klein">So, wie er im Grundbuch steht — damit die Zuordnung gelingt.</span>
			</label>

			<label>
				Bemerkung (freiwillig)
				<input name="bemerkung" maxlength="200" placeholder="z. B. Wohnung 3.2" />
			</label>

			<button type="submit">Melden</button>
		</form>
	{/if}
</section>

<style>
	.karte {
		max-width: 30rem;
		margin: 0 auto;
	}

	.oben {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0;
	}

	h1 {
		margin: 0.2rem 0 0.5rem;
		font-size: 1.5rem;
	}

	.wann {
		color: var(--text-leise);
		margin: 0 0 1rem;
	}

	.mitkarte {
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 10%, transparent);
		padding: 1rem 1.15rem;
		margin-bottom: 1.25rem;
	}

	.mitkarte h2 {
		margin: 0 0 0.3rem;
		font-size: 1rem;
	}

	.knopf {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 3rem;
		margin-top: 0.75rem;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		text-decoration: none;
		font-weight: 600;
	}

	.trenner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-leise);
		font-size: 0.875rem;
		margin: 0 0 1.25rem;
	}

	.trenner::before,
	.trenner::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--linie);
	}

	.hinweis {
		padding: 0.8rem 1rem;
		border-radius: var(--radius);
		background: var(--flaeche-2);
		margin: 0 0 1.25rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-weight: 550;
	}

	input {
		min-height: 3rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	.klein {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
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


</style>
