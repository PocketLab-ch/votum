<script lang="ts">
	/**
	 * Die Leinwand als eigenes Fenster.
	 *
	 * **Warum kein Tab.** Bisher öffnete die Präsentationssicht mit
	 * `target="_blank"` und landete als Reiter im selben Fenster. Wer den auf den
	 * Beamer ziehen will, reisst das ganze Browserfenster mit — und damit die
	 * Sitzungsleitung. `window.open` mit `popup` erzeugt ein eigenes Fenster ohne
	 * Adresszeile und Lesezeichen: hinüberziehen, F11, fertig.
	 *
	 * **Warum keine automatische Platzierung.** Die Fensterverwaltung des Browsers
	 * (`getScreenDetails`) könnte das Fenster selbst auf den zweiten Bildschirm
	 * legen, verlangt dafür aber einen gesicherten Ursprung. Die Anwendung läuft
	 * im Netz über HTTP. Ein Aufruf, der dort still nichts tut, wäre schlimmer als
	 * keiner: Die Sitzungsleitung wartete auf ein Fenster, das nie kommt.
	 *
	 * **Warum kein Zustand mehr.** Die Zeile sagte «Beamer offen» oder «nicht
	 * offen», gemessen am Fenstergriff aus `window.open`. Dieser Griff überlebt
	 * kein Neuladen — und die Sitzungsleitung lädt sich selbst neu, sobald eine
	 * Abstimmung wechselt. Danach stand dort «nicht offen», während das Fenster
	 * auf dem zweiten Bildschirm lief. Gemeldet am 02.08.2026.
	 *
	 * Eine Auskunft, die regelmässig falsch ist, ist schlechter als keine: Wer
	 * ihr einmal geglaubt hat, öffnet ein zweites Fenster oder sucht einen
	 * Fehler, den es nicht gibt. Der Browser gibt keinen verlässlichen Weg, das
	 * Fenster nach einem Neuladen wiederzufinden.
	 *
	 * Was bleibt, ist die Handlung — und die ist gefahrlos: Das Fenster trägt
	 * einen Namen, ein zweiter Klick holt dasselbe nach vorne, statt eine zweite
	 * Leinwand zu erzeugen.
	 */

	interface Eigenschaften {
		/** Die Präsentationssicht dieser Versammlung. */
		pfad: string;
		/**
		 * Nur der Knopf, ohne die Einrichtungshilfe daneben.
		 *
		 * Gemeldet am 21.08.2026: «kann man den Button Beamerfenster öffnen auf die
		 * Ebene Sitzungsleitung schieben? Dann hat die Kachel Aktuelles Geschäft
		 * bessere Sichtbarkeit.» Der Knopf samt Erklärung nahm im Saal eine ganze
		 * Zeile weg — und die braucht das aufgerufene Geschäft, das man vom
		 * Notebook aus im Blick behalten muss.
		 *
		 * Die Hilfe ist damit nicht weg: Sie steht am Knopf (`title`) und im
		 * Handbuch. **Die Blockademeldung bleibt sichtbar** — sie ist keine
		 * Erklärung, sondern eine Störung, und wer sie nicht sieht, wartet auf ein
		 * Fenster, das nie kommt.
		 */
		knapp?: boolean;
	}

	let { pfad, knapp = false }: Eigenschaften = $props();

	const HILFE =
		'Auf den zweiten Bildschirm ziehen, dann F11 für Vollbild. Ein zweiter Klick holt ' +
		'dasselbe Fenster nach vorne. Am eigenen Gerät geht auch /p mit dem Anzeigecode.';

	/** Nur für den Fall, dass der Browser das Fenster gar nicht erst zulässt. */
	let blockiert = $state(false);

	function oeffnen() {
		// Ein benanntes Fenster: Ein zweiter Klick holt das bestehende nach vorne,
		// statt eine zweite Leinwand zu erzeugen — auch nach einem Neuladen.
		const neu = window.open(pfad, 'versammlung-beamer', 'popup,width=1280,height=800');
		blockiert = !neu;
		neu?.focus();
	}
</script>

<div class="beamer" class:knapp>
	<button
		type="button"
		class="knopf"
		onclick={oeffnen}
		title={knapp ? HILFE : undefined}>Beamerfenster öffnen</button
	>
	{#if blockiert}
		<p class="zustand stoerung" role="status">
			Der Browser hat das Fenster blockiert. Erlauben Sie ihm für diese Adresse
			Pop-up-Fenster, oder öffnen Sie am zweiten Gerät <code>/p</code> mit dem Code für die
			Leinwand.
		</p>
	{:else if !knapp}
		<p class="zustand" role="status">
			Auf den zweiten Bildschirm ziehen, dann F11 für Vollbild. Ein zweiter Klick holt
			dasselbe Fenster nach vorne. Am eigenen Gerät geht auch <code>/p</code> mit dem
			Code für die Leinwand.
		</p>
	{/if}
</div>

<style>
	.beamer {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.knopf {
		min-height: var(--ziel-saal);
		padding: 0 1.1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		font-weight: 550;
	}

	/*
	 * In der Kopfzeile ist der Knopf ein Nebenweg, keine Haupthandlung: Er wird
	 * einmal am Anfang gedrückt. Die Zielgrösse bleibt fingertauglich
	 * (`--ziel-min`), nur die Saalgrösse fällt weg.
	 */
	.beamer.knapp .knopf {
		min-height: var(--ziel-min);
		padding: 0 0.8rem;
		font-size: 0.9rem;
	}

	.stoerung {
		color: var(--warnung);
	}

	.zustand {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-leise);
	}


</style>
