<script lang="ts">
	/**
	 * Eine Karte — ein Thema, eine Antwort, höchstens eine Handlung.
	 *
	 * Der Baustein für ruhige Übersichtsseiten (Gestaltungsmuster, siehe
	 * `docs/gestaltung.md`). Drei Dinge macht er, die von Hand jedes Mal anders
	 * herauskamen:
	 *
	 * **Gleiche Höhe.** Die Karte füllt ihre Rasterzelle und schiebt ihren Fuss
	 * nach unten. Ohne das standen auf der Versammlungsseite drei Karten mit
	 * 215, 197 und 314 Pixeln nebeneinander und drei Knöpfe auf drei Höhen.
	 *
	 * **Antwort vor Erklärung.** Zuerst der Satz, der die Frage beantwortet, dann
	 * — zugeklappt — warum. Der Hintergrund geht nicht verloren; er wartet nur,
	 * bis jemand ihn wissen will.
	 *
	 * **Eine Überschrift, die eine Frage ist.** «Wie wird abgestimmt?» statt
	 * «Betriebsart»: Wer die Frage liest, weiss, ob ihn die Karte angeht.
	 */
	import type { Snippet } from 'svelte';

	interface Eigenschaften {
		/** Die Frage, die diese Karte beantwortet. */
		titel: string;
		/** Die Antwort in einem Satz. Fällt weg, wenn der Inhalt sie selbst gibt. */
		antwort?: string;
		/** Ein zweiter Satz zur Antwort — knapp, sichtbar, nicht zugeklappt. */
		zusatz?: string;
		/**
		 * Was nicht stimmt — sichtbar, aber ohne zu sperren.
		 *
		 * Für Widersprüche, die einen zulässigen Grund haben können und trotzdem
		 * auffallen müssen. Steht über der Handlung, nicht darunter: Wer den Knopf
		 * schon gefunden hat, liest nichts mehr.
		 */
		warnung?: string | null;
		/**
		 * Hier fehlt noch etwas — die Karte trägt dann Zeichen und farbige Kante.
		 *
		 * Gemeldet am 12.08.2026 zur Sammelansicht: «Fehlende Einträge können da
		 * leicht übersehen werden.» Sechs Kacheln sahen gleich aus; dass zwei davon
		 * «noch keine Einheit erfasst» sagten, stand nur im Text und in derselben
		 * Farbe wie alles andere.
		 *
		 * **Nicht dasselbe wie `warnung`.** Die Warnung ist ein Widerspruch, der
		 * einen Grund haben kann und trotzdem auffallen muss; sie steht als eigener
		 * Satz. Dies hier ist bloss «noch nicht gemacht» — es färbt die Karte, ohne
		 * eine Zeile hinzuzufügen.
		 */
		offen?: boolean;
		/** Der Hintergrund. Steht hinter «Was heisst das?» und ist zugeklappt. */
		erklaerung?: Snippet;
		/** Der Rang der Überschrift. Auf Seiten mit eigenem h1 bleibt es h2. */
		stufe?: 2 | 3;
		children?: Snippet;
		/** Die Handlung. Steht immer unten, damit die Knöpfe fluchten. */
		fuss?: Snippet;
	}

	let {
		titel,
		antwort,
		zusatz,
		warnung,
		offen = false,
		erklaerung,
		stufe = 2,
		children,
		fuss
	}: Eigenschaften = $props();
</script>

<section class="karte" class:offen>
	<!--
		Das Zeichen steht **in** der Überschrift, nicht davor: So wandert es mit,
		wenn der Titel umbricht, und die Sprachausgabe liest es nicht als eigene
		Zeile. Sie liest ohnehin die Antwort darunter, die den Mangel benennt —
		«noch keine Einheit erfasst» —, deshalb bleibt das Zeichen versteckt.
	-->
	{#if stufe === 2}
		<h2>{#if offen}<span class="offenzeichen" aria-hidden="true">!</span>{/if}{titel}</h2>
	{:else}
		<h3>{#if offen}<span class="offenzeichen" aria-hidden="true">!</span>{/if}{titel}</h3>
	{/if}

	{#if antwort}
		<p class="antwort">{antwort}</p>
	{/if}
	{#if zusatz}
		<p class="zusatz">{zusatz}</p>
	{/if}

	{#if children}
		<div class="mitte">{@render children()}</div>
	{/if}

	{#if warnung}
		<p class="warnung" role="status">{warnung}</p>
	{/if}

	{#if erklaerung}
		<details class="erklaerung">
			<summary>Was heisst das?</summary>
			{@render erklaerung()}
		</details>
	{/if}

	{#if fuss}
		<div class="fuss">{@render fuss()}</div>
	{/if}
</section>

<style>
	/*
	 * Die Karte füllt ihre Zelle. Im Raster (`.kacheln`) bestimmt die höchste
	 * Karte die Zeilenhöhe; ohne `height: 100%` bliebe jede bei ihrem eigenen
	 * Inhalt stehen und die Unterkanten lägen versetzt.
	 */
	.karte {
		display: flex;
		flex-direction: column;
		height: 100%;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.9rem 1.05rem;
	}

	/*
	 * Offen heisst: Kante, Zeichen, farbige Antwort — drei Träger für dieselbe
	 * Aussage, weil keiner allein genügt. Die Kante fällt im Überfliegen auf, das
	 * Zeichen hält beim Titel, und die Farbe an der Antwort zeigt, **was** fehlt.
	 *
	 * Der Einzug innen statt einer eigenen Kante links: eine Linie weniger im
	 * Bild, und dieselbe Bauart wie die offene Zeile in der Seitenleiste
	 * (`Seitenleiste.svelte`), damit dasselbe dasselbe bedeutet.
	 */
	.karte.offen {
		border-color: color-mix(in srgb, var(--warnung) 45%, var(--linie));
		box-shadow: inset 3px 0 0 var(--warnung);
	}

	.karte h2,
	.karte h3 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}

	.offenzeichen {
		color: var(--warnung);
		font-weight: 700;
		margin-right: 0.35rem;
	}

	.antwort {
		margin: 0;
		font-size: 1.05rem;
	}

	.karte.offen .antwort {
		color: var(--warnung);
	}

	.zusatz {
		margin: 0.2rem 0 0;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	.mitte {
		margin-top: 0.6rem;
	}

	.warnung {
		margin: 0.6rem 0 0;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
		color: var(--warnung);
		font-size: 0.9rem;
	}

	/*
	 * Der Hintergrund, zugeklappt.
	 *
	 * `<details>` und nicht ein aufklappender Knopf: Das ist reines HTML und
	 * wirkt vor dem Hydrieren. Ein Knopf, der sein Ziel per Client-Code zeigt,
	 * geht ins Leere, solange die Seite noch übersetzt wird — daran brach am
	 * 10.08.2026 ein Prüflauf ab, ohne dass etwas kaputt war.
	 */
	.erklaerung {
		margin-top: 0.6rem;
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.erklaerung summary {
		cursor: pointer;
		color: var(--akzent);
	}

	.erklaerung :global(p) {
		margin: 0.4rem 0 0;
	}

	/* `auto` schiebt den Fuss ans untere Ende — dort fluchten die Knöpfe. */
	.fuss {
		margin-top: auto;
		padding-top: 0.75rem;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}
</style>
