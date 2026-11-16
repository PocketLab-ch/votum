<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Die Bedienecke der Wandsicht: Vollbild, und was die Seite sonst braucht.
	 *
	 * **Warum die Ecke sich versteckt.** An der Wand steht die Wand, kein
	 * Werkzeug. Die Knöpfe liegen unsichtbar in der Ecke und erscheinen, sobald
	 * jemand die Maus bewegt oder den Bildschirm berührt — wie die
	 * Bedienelemente eines Videos. Nach vier Sekunden Ruhe verschwinden sie
	 * wieder. Am Beamer bewegt sich nichts, also sieht sie dort niemand.
	 *
	 * **Warum Vollbild, wenn `F11` dasselbe tut** (gefragt am 20.08.2026: «kann
	 * man in der Präsentationsansicht noch ein Vollbildmodus-Ansicht machen?
	 * Geht darum, dass man die URL nicht sieht»): Am Beamer hat selten jemand
	 * eine Tastatur zur Hand, und im Pop-up-Fenster der Sitzungsleitung ist die
	 * Taste je nach System ohne Wirkung.
	 *
	 * **Zur Sorge um die Adresszeile.** Was dort steht, ist kein Schlüssel: die
	 * Präsentationssicht läuft unter `/versammlungen/<kennung>/praesentation` und
	 * nützt nur, wer als Sitzungsleitung angemeldet ist; die Wandsicht am zweiten
	 * Gerät läuft unter `/p` und hat den Anzeigecode gar nicht in der Adresse —
	 * er wird eingetippt. Es geht also um die Fläche und um das ruhige Bild,
	 * nicht um Geheimhaltung.
	 */
	let { weitere }: { weitere?: Snippet } = $props();

	let sichtbar = $state(false);
	let imVollbild = $state(false);

	$effect(() => {
		let uhr: ReturnType<typeof setTimeout> | undefined;
		const wecken = () => {
			sichtbar = true;
			clearTimeout(uhr);
			uhr = setTimeout(() => (sichtbar = false), 4000);
		};
		window.addEventListener('pointermove', wecken);
		window.addEventListener('pointerdown', wecken);
		return () => {
			clearTimeout(uhr);
			window.removeEventListener('pointermove', wecken);
			window.removeEventListener('pointerdown', wecken);
		};
	});

	function vollbild() {
		// Fehlschläge werden verschluckt: Ein Browser, der es verweigert, sagt es
		// selbst — eine zweite Meldung an der Wand hilft niemandem.
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
		else document.documentElement.requestFullscreen().catch(() => {});
	}
</script>

<svelte:document onfullscreenchange={() => (imVollbild = Boolean(document.fullscreenElement))} />

<div class="ecke" class:sichtbar>
	<button type="button" class="knopf" onclick={vollbild}>
		{imVollbild ? 'Vollbild verlassen' : 'Vollbild'}
	</button>
	{@render weitere?.()}
</div>

<style>
	.ecke {
		position: fixed;
		right: 1rem;
		top: 1rem;
		z-index: 5;
		display: flex;
		gap: 0.5rem;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.25s ease;
	}

	.ecke.sichtbar,
	.ecke:focus-within {
		opacity: 1;
		pointer-events: auto;
	}

	/*
	 * `:global`, weil der Verweis «Zur Sitzungsleitung» aus der aufrufenden Seite
	 * kommt: Svelte grenzt Stilblöcke auf ihre Komponente ab, und ein Knopf, der
	 * hier hineingereicht wird, bekäme sonst keine Gestalt.
	 */
	.ecke :global(.knopf) {
		padding: 0.5rem 0.9rem;
		border: none;
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text-leise);
		font: inherit;
		font-size: 0.9rem;
		text-decoration: none;
		cursor: pointer;
	}
</style>
