<script lang="ts">
	import { anfangswert } from '$lib/felder';
	let { data, form } = $props();
	let laeuft = $state(false);
</script>

<svelte:head><title>Anmelden — Votum</title></svelte:head>

<div class="mitte">
	<h1>Anmelden</h1>

	{#if form?.fehler}
		<p class="fehler" role="alert">{form.fehler}</p>
	{:else if data.fehlerAusOidc}
		<p class="fehler" role="alert">
			{#if data.fehlerAusOidc === 'kein_konto'}
				Sie sind bei der zentralen Anmeldung bekannt, haben hier aber kein Konto. Wer eine
				Versammlung führen darf, entscheidet die Bewirtschaftung — melden Sie sich dort.
			{:else if data.fehlerAusOidc === 'nicht_erreichbar'}
				Die zentrale Anmeldung war nicht erreichbar. Melden Sie sich lokal an.
			{:else if data.fehlerAusOidc === 'abgelehnt'}
				Die zentrale Anmeldung hat den Zugang abgelehnt.
			{:else}
				Die zentrale Anmeldung liess sich nicht abschliessen. Versuchen Sie es erneut oder melden
				Sie sich lokal an.
			{/if}
		</p>
	{/if}

	<!--
		**Der Weg für die Zugangskarte steht zuoberst** (Bedienbarkeitsprüfung
		05.09.2026, schwerster Befund der Eigentümersicht).

		Diese Seite war für die Bewirtschaftung gebaut: Benutzername, Kennwort,
		Authentik. Ein Eigentümer, der die Adresse eintippt, landet hier ebenfalls
		— und fand **kein Wort** zu seiner Karte. Der Prüfer probierte den Code als
		Benutzernamen, dann als Benutzernamen und Kennwort, dann riet er neun
		Adressen; der elfte Versuch führte ihn zum Ziel. Die Seite `/z` mit dem
		Codefeld gibt es und sie ist gut gemacht, sie war nur von vorne nicht
		erreichbar.

		**Warum oben und nicht unten:** An einer Versammlung kommen vierzehn
		Eigentümer auf eine Sitzungsleitung, und nur die Eigentümer stehen unter
		Zeitdruck in einem fremden Saal. Die Bewirtschaftung kennt ihren Weg und
		verliert einen Blick; wer die Karte in der Hand hält, verliert sonst seine
		Stimme. Der Fall ist nicht selten: leerer Akku, alte Kamera, Karte im
		Mantel an der Garderobe — dann bleibt nur dieser Weg.
	-->
	<a class="karte" href="/z">
		<strong>Ich habe eine Zugangskarte</strong>
		<span>Für Eigentümerinnen und Eigentümer: Code von der Karte eintippen</span>
	</a>

	<p class="trenner"><span>oder als Bewirtschaftung anmelden</span></p>

	{#if data.wege.authentik}
		<a class="authentik" href="/anmelden/authentik?weiter={encodeURIComponent(data.weiter)}">
			Mit Authentik anmelden
		</a>
		<p class="trenner"><span>oder mit lokalen Zugangsdaten</span></p>
	{/if}

	{#if data.wege.hinweis}
		<p class="rueckfall">{data.wege.hinweis}</p>
	{/if}

	<form
		method="POST"
		onsubmit={() => {
			laeuft = true;
		}}
	>
		<input type="hidden" name="weiter" value={data.weiter} />

		<label>
			Benutzername
			<input
				name="username"
				autocomplete="username"
				required
				{...anfangswert(form?.username ?? '')}
				autocapitalize="none"
				spellcheck="false"
			/>
		</label>

		<label>
			Kennwort
			<input name="kennwort" type="password" autocomplete="current-password" required />
		</label>

		<button type="submit" disabled={laeuft}>
			{laeuft ? 'Wird geprüft …' : 'Anmelden'}
		</button>
	</form>

	<p class="hinweis">
		Die lokale Anmeldung funktioniert auch ohne Internetverbindung — im
		Versammlungsraum ist das der Regelfall. Sie steht deshalb immer offen, auch wenn die zentrale
		Anmeldung erreichbar ist: Fiele sie mitten in der Versammlung aus, käme sonst niemand mehr
		herein.
	</p>
</div>

<style>
	.mitte {
		max-width: 24rem;
		margin: 2rem auto;
	}

	form {
		display: grid;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	label {
		display: grid;
		gap: 0.375rem;
		color: var(--text-leise);
	}

	input {
		min-height: var(--ziel-min);
		padding: 0 0.75rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
	}

	button {
		background: var(--akzent);
		color: var(--akzent-text);
		border-color: var(--akzent);
		font-weight: 600;
	}

	button:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.fehler {
		padding: 0.75rem 1rem;
		border: 1px solid var(--fehler);
		border-radius: var(--radius);
		color: var(--fehler);
		background: color-mix(in srgb, var(--fehler) 8%, transparent);
	}

	.hinweis {
		margin-top: 2rem;
		font-size: 0.9375rem;
		color: var(--text-leise);
	}

	/*
	 * Der Kartenweg trägt die Akzentfläche, nicht bloss einen Link: Er ist für
	 * seine Zielgruppe der Hauptweg, und sie sucht ihn unter Zeitdruck.
	 */
	.karte {
		display: block;
		min-height: var(--ziel-min);
		padding: 0.75rem 1.25rem;
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 12%, transparent);
		color: inherit;
		text-decoration: none;
	}

	.karte strong {
		display: block;
		font-weight: 600;
	}

	.karte + .trenner {
		margin-top: 1rem;
	}

	.karte span {
		display: block;
		margin-top: 0.125rem;
		font-size: 0.9375rem;
		color: var(--text-leise);
	}

	.authentik {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 12%, transparent);
		color: inherit;
		text-decoration: none;
		font-weight: 550;
		margin-bottom: 1rem;
	}

	.trenner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-leise);
		font-size: 0.875rem;
		margin: 0 0 1rem;
	}

	.trenner::before,
	.trenner::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--linie);
	}

	.rueckfall {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 14%, transparent);
		font-size: 0.9rem;
		margin: 0 0 1rem;
	}
</style>
