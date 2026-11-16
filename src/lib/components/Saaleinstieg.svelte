<script lang="ts">
	/**
	 * Der QR zum Hinhalten: die Meldeseite für Eigentümer ohne Karte.
	 *
	 * **Der Anlass** (Auftraggeber, 24.08.2026): «Ich habe jetzt gerade die
	 * Herausforderung, dass der QR auf dem Monitor nicht geht bzw. nicht gelesen
	 * werden kann. Vermutlich auch, weil ich per Guacamole und RDP zugreife.
	 * […] Ich bräuchte noch auf der Seite Einlass einen QR mit Link, wo ich zur
	 * Not mit dem Mobiltelefon des Eigentümers den Code vom Monitor grösser
	 * darstellen kann.»
	 *
	 * Derselbe Code wie auf der Leinwand, nur am Eingang statt an der Wand. Der
	 * Bildschirm der Sitzungsleitung steht direkt vor der Person, die gerade
	 * hereinkommt — an der Wand hängt er zehn Meter weiter, oft schräg und über
	 * eine Fernsitzung übertragen.
	 *
	 * **Er trägt keinen Zugang**, nur die Adresse einer Meldeseite: Wer ihn
	 * scannt, gibt seinen Namen an und wartet auf die Freigabe durch die
	 * Sitzungsleitung. Deshalb darf er auf einem Bildschirm stehen, den andere
	 * sehen. Zugeklappt, weil er die Ausnahme ist — der Regelfall ist die Karte.
	 */
	interface Eigenschaften {
		/** Der QR als SVG. Null, solange die Versammlung nicht läuft. */
		svg: string | null;
		adresse: string | null;
	}

	let { svg, adresse }: Eigenschaften = $props();
</script>

{#if svg && adresse}
	<details class="saaleinstieg">
		<summary>Meldeseite zeigen — für Eigentümer ohne Karte</summary>
		<div class="inhalt">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="qr">{@html svg}</div>
			<div>
				<p class="klein">
					Halten Sie den Bildschirm hin. Die Person scannt mit ihrer Kamera, gibt ihren Namen
					an und erscheint hier unter den Meldungen — Sie geben sie frei.
				</p>
				<p class="klein">
					Derselbe Code wie auf der Leinwand. Er führt auf eine Meldeseite, nicht in die
					Versammlung.
				</p>
				<p class="adresse klein"><a href={adresse}>{adresse}</a></p>
			</div>
		</div>
	</details>
{/if}

<style>
	.saaleinstieg {
		margin: 0.5rem 0 1rem;
	}

	/* Das Dreieck bleibt: `<summary>` ist `display: list-item`, und jede andere
	   Angabe nähme es weg (docs/gestaltung.md). */
	.saaleinstieg summary {
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
		cursor: pointer;
	}

	.inhalt {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.5rem 0 0.75rem;
	}

	.qr {
		width: clamp(8rem, 32vw, 13rem);
		flex: none;
		/* themenfest: Der QR-Code braucht Weiss, damit ihn jede Kamera liest. */
		background: #fff;
		padding: 0.5rem;
		border-radius: var(--radius);
	}

	.qr :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
		margin: 0 0 0.4rem;
		max-width: 34rem;
	}

	.adresse {
		word-break: break-all;
	}
</style>
