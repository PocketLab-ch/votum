<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Anhang } from '$lib/server/anhaenge';
	import { absenden } from '$lib/absenden';

	let {
		anhaenge = [] as Anhang[],
		aenderbar = true,
		aktionAnhaengen = '?/anhaengen',
		aktionAbloesen = '?/abloesen',
		/** Bei Traktandumsanhängen: an welches. */
		gegenstandId = '',
		titel = 'Unterlagen',
		hinweis = '',
		/**
		 * In einer Karte: ohne eigene Überschrift und ohne die langen Sätze.
		 *
		 * Die Karte trägt beides schon — die Frage als Überschrift, die
		 * Bedingungen hinter «Was heisst das?». Beides doppelt zu zeigen war
		 * genau die Unruhe, die am 11.08.2026 gemeldet wurde.
		 */
		knapp = false,
		/**
		 * Gehört das Dateifeld zu einem Formular ausserhalb dieser Komponente?
		 *
		 * Dann trägt es dessen Kennung, und der eigene «Anhängen»-Knopf entfällt:
		 * Die Datei wird mitgespeichert, wenn die Seite gespeichert wird. Ein
		 * Speicherknopf pro Seite, gewünscht am 11.08.2026.
		 */
		formularId = ''
	} = $props();

	/**
	 * Welche Datei gerade hochlädt.
	 *
	 * **Warum es diesen Zustand hier gibt und sonst nirgends.** Ohne
	 * `use:enhance` zeigte der Browser während des Hochladens seinen eigenen
	 * Ladebalken; mit `enhance` bleibt die Seite stumm stehen. Bei einer 10-MB-
	 * Datei über eine Mobilverbindung sieht der Klick dann aus wie nichts, und
	 * genau dort wird ein zweites Mal gedrückt. Die Sperre in `absenden()`
	 * fängt den zweiten Klick zwar ab, aber lautlos — sichtbar wird er erst
	 * hier.
	 */
	let laedt = $state(false);

	/** Grössen in KB und MB, ohne Nachkommastellen unter 1 MB. */
	function groesse(bytes: number): string {
		return bytes < 1024 * 1024
			? `${Math.round(bytes / 1024)} KB`
			: `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<section class="anhaenge" class:knapp>
	{#if !knapp}
		<h3>{titel}</h3>
		{#if hinweis}
			<p class="hilfe">{hinweis}</p>
		{/if}
	{/if}

	{#if anhaenge.length === 0}
		{#if !knapp}
			<p class="hilfe">Keine Unterlage angehängt.</p>
		{/if}
	{:else}
		<ul>
			{#each anhaenge as a (a.id)}
				<li>
					<a href="/anhang/{a.pruefsumme}" target="_blank" rel="noopener">{a.name}</a>
					<span class="klein">{groesse(a.groesse)}</span>
					{#if aenderbar}
						<form method="POST" action={aktionAbloesen} use:enhance={absenden()}>
							<input type="hidden" name="id" value={a.id} />
							<button
								type="submit"
								class="leise"
								aria-label="{a.name} ablösen"
								data-fokus="anhang:{a.id}"
							>
								Ablösen
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if aenderbar && formularId}
		<!--
			Kein eigenes Formular: Das Feld gehört über `form` zu dem der Seite.
			`required` wäre hier falsch — die Seite lässt sich auch speichern,
			ohne dass jemand eine Datei anhängt.
		-->
		<div class="hinzu">
			<input
				type="file"
				name="datei"
				form={formularId}
				accept=".pdf,.jpg,.jpeg,.png,.heic"
				aria-label="Datei anhängen"
			/>
		</div>
	{:else if aenderbar}
		<form
			method="POST"
			action={aktionAnhaengen}
			enctype="multipart/form-data"
			class="hinzu"
			use:enhance={absenden({
				laufend: (marke) => {
					laedt = marke !== null;
				}
			})}
		>
			{#if gegenstandId}
				<input type="hidden" name="traktandumId" value={gegenstandId} />
			{/if}
			<input type="file" name="datei" accept=".pdf,.jpg,.jpeg,.png,.heic" required />
			<button type="submit" disabled={laedt} data-fokus="anhaengen:{gegenstandId}">
				{laedt ? 'Wird hochgeladen …' : 'Anhängen'}
			</button>
		</form>
		{#if !knapp}
			<!--
				In der Karte steht die Bedingung schon als Zusatz unter der Antwort.
				Hier stünde sie unter dem Knopf — und schöbe ihn gegenüber der
				Nachbarkarte um eine Zeile nach oben, womit die Unterkanten wieder
				versetzt lägen.
			-->
			<p class="klein">
				PDF und Bilder, höchstens 10 MB. Massgebend ist der Inhalt der Datei, nicht ihre Endung: Ein
				umbenanntes Office-Dokument wird erkannt und abgewiesen.
			</p>
		{/if}
	{/if}
</section>

<style>
	.anhaenge {
		margin-top: 1rem;
	}

	/* In einer Karte sitzt der Abstand schon am Kartenfuss. */
	.anhaenge.knapp {
		margin-top: 0;
		width: 100%;
	}

	.anhaenge.knapp input[type='file'] {
		flex: 1 1 10rem;
		min-width: 0;
	}

	h3 {
		font-size: 0.95rem;
		margin: 0 0 0.35rem;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0 0 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.hilfe,
	.klein {
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.hinzu {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		align-items: center;
	}

	input[type='file'] {
		min-height: var(--ziel-min);
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-size: 0.9rem;
		max-width: 100%;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 1.1rem;
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
	}
</style>
