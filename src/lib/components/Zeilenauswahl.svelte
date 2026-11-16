<script lang="ts">
	/**
	 * Eine `Suchauswahl`, die ihren Wert selbst hält und nach oben meldet.
	 *
	 * **Wozu die Zwischenschicht** (29.08.2026). In einer Liste braucht jede
	 * Zeile ihre eigene Wahl. Der nächstliegende Bau ist eine Tabelle über allen
	 * Zeilen:
	 *
	 * ```svelte
	 * {#each meldungen as m (m.id)}
	 *   <Suchauswahl bind:wert={gewaehlt[m.id]} … />
	 * ```
	 *
	 * Solange niemand gewählt hat, gibt es den Schlüssel nicht, und Svelte 5
	 * wirft beim **Rendern** `props_invalid_value`: Der `{#each}`-Block bricht
	 * ab, die Zeile verschwindet samt ihren Formularen, und die Überschrift
	 * zählt weiter. Am Eingang stand deshalb zwei Tage lang «Über den Beamer
	 * gemeldet (1)» über einer leeren Liste.
	 *
	 * **Warum nicht einfach `beiWechsel`.** Das war der erste Versuch und griff
	 * zu kurz: `beiWechsel` hängt am `change` des Auswahlfelds, `Suchauswahl`
	 * meldet über `use:gefuehrteWahl` aber **auch beim Aufbau** — das ist der
	 * Wert, den der Browser nach einem Nachladen wiederherstellt. Der kam dann
	 * oben nie an, und die Rückfrage fragte «als  erfassen?» ohne Namen.
	 *
	 * Hier ist `wert` eine gewöhnliche Variable mit Anfangswert. `bind:` darf
	 * darauf zeigen, beide Meldewege kommen an, und eine neue Zeile bringt ihre
	 * eigene mit, statt einen Schlüssel in einer fremden Tabelle zu brauchen.
	 *
	 * **Kein Layout, mit Absicht:** Die Komponente rendert nur die
	 * `Suchauswahl`. So bleibt sie aus dem scoped CSS der aufrufenden Seite
	 * heraus, das die Zeile gestaltet.
	 */
	import Suchauswahl from './Suchauswahl.svelte';

	let {
		name,
		beschriftung,
		leerText,
		pflicht = false,
		eintraege,
		/** Wird mit der gewählten Kennung gerufen, sobald sie feststeht. */
		beiWahl
	}: {
		name: string;
		beschriftung: string;
		leerText?: string;
		pflicht?: boolean;
		eintraege: { wert: string; text: string; deaktiviert?: boolean }[];
		beiWahl: (wert: string) => void;
	} = $props();

	let wert = $state('');

	/*
	 * **Nach oben melden statt binden.** Ein `bind:` bis zur aufrufenden Seite
	 * durchzureichen hiesse, dort wieder eine Stelle je Zeile zu brauchen —
	 * genau das, was hier aufhören soll.
	 */
	$effect(() => {
		beiWahl(wert);
	});
</script>

<Suchauswahl {name} {beschriftung} {leerText} {pflicht} bind:wert {eintraege} />
