<script lang="ts">
	/**
	 * Wächter über ungespeicherte Eingaben.
	 *
	 * Gemessen am 11.08.2026: Wer auf der Versammlungsseite das Datum ändert und
	 * dann auf «Als Nächstes» klickt, verliert die Änderung — ohne Dialog, ohne
	 * Meldung, ohne Spur. Die Seite wechselt, das Feld steht danach wieder auf
	 * dem alten Wert. Das ist die schlimmste Art von Datenverlust: eine, die
	 * niemand bemerkt.
	 *
	 * **Warum kein automatisches Speichern.** Es wäre hier falsch, aus drei
	 * Gründen:
	 *
	 * 1. **Der Verlauf.** Jede Änderung an einer Versammlung schreibt einen
	 *    Eintrag. Bei jedem Tastendruck zu speichern hiesse, den Verlauf mit
	 *    «Ort: P», «Ort: Pr», «Ort: Prü» zu füllen — und ihn damit als Beleg zu
	 *    zerstören, der er sein soll.
	 * 2. **Halbe Wahrheiten.** Ort und Datum sind Pflichtfelder. Ein Zwischenstand
	 *    ohne Ort ist keine gültige Versammlung; ihn zu speichern hiesse, eine
	 *    ungültige Angabe als gültige abzulegen.
	 * 3. **«Abbrechen» verlöre seinen Sinn.** Wer etwas ausprobiert und es sich
	 *    anders überlegt, muss zurück können.
	 *
	 * Also: nicht speichern, sondern **fragen**. Und zwar auf beiden Wegen, auf
	 * denen eine Seite verlassen wird — der Verweis innerhalb der Anwendung
	 * (`beforeNavigate`) und das Schliessen des Fensters (`beforeunload`).
	 */
	import { beforeNavigate } from '$app/navigation';

	interface Eigenschaften {
		/**
		 * Die Kennung des Formulars, über das gewacht wird.
		 *
		 * Über die Kennung und nicht über den Baum: Zum Formular gehören auch
		 * Felder, die woanders auf der Seite stehen und nur per `form="…"`
		 * dazugehören — genau die Bauart, mit der die Seite zu einem
		 * Speicherknopf kommt. Ein Lauscher am Formular selbst bekäme von ihnen
		 * nichts mit, weil Ereignisse dem DOM-Baum folgen und nicht der
		 * Zugehörigkeit.
		 */
		formular: string;
	}

	let { formular }: Eigenschaften = $props();

	let offen = $state(false);

	/** Gehört dieses Feld zum bewachten Formular? */
	function gehoertDazu(ziel: EventTarget | null): boolean {
		const el = ziel as (HTMLElement & { form?: HTMLFormElement | null }) | null;
		return el?.form?.id === formular;
	}

	$effect(() => {
		const geaendert = (e: Event) => {
			if (gehoertDazu(e.target)) offen = true;
		};
		// Abgeschickt heisst gespeichert: Danach lädt die Seite neu und bringt
		// den Stand vom Server mit.
		const abgeschickt = (e: Event) => {
			if ((e.target as HTMLElement)?.id === formular) offen = false;
		};

		document.addEventListener('input', geaendert, true);
		document.addEventListener('change', geaendert, true);
		document.addEventListener('submit', abgeschickt, true);
		return () => {
			document.removeEventListener('input', geaendert, true);
			document.removeEventListener('change', geaendert, true);
			document.removeEventListener('submit', abgeschickt, true);
		};
	});

	$effect(() => {
		const warnen = (e: BeforeUnloadEvent) => {
			if (!offen) return;
			// Der Wortlaut steht nicht bei uns: Browser zeigen seit Jahren ihren
			// eigenen Text. `preventDefault` ist alles, was zählt.
			e.preventDefault();
		};
		window.addEventListener('beforeunload', warnen);
		return () => window.removeEventListener('beforeunload', warnen);
	});

	beforeNavigate((navigation) => {
		if (!offen) return;
		// Kein Rückfragen beim Absenden des Formulars selbst — dort ist die
		// Navigation ja gerade das Speichern.
		if (navigation.type === 'form') return;
		/*
		 * **Hier ist die Browserabfrage die richtige — und die einzige mögliche.**
		 * `Rueckfrage.svelte` ist ein Fenster in der Seite; es kann eine
		 * Navigation nicht anhalten, weil `beforeNavigate` synchron entscheiden
		 * muss. Der Fall, für den die Regel gemacht ist, ist ein anderer: ein
		 * Formular mit `use:enhance`, bei dem SvelteKit `defaultPrevented` nicht
		 * prüft und «Abbrechen» deshalb nicht abbricht.
		 *
		 * Bis zum 24.08.2026 stand diese Ausnahme als Dateiname in einer Liste im
		 * Wächter. Jetzt steht sie da, wo sie gilt.
		 */
		// eslint-disable-next-line versammlung/keine-browserabfrage
		const weiter = confirm(
			'Ihre Änderungen sind noch nicht gespeichert.\n\n' +
				'Wenn Sie jetzt weitergehen, gehen sie verloren.\n\n' +
				'Trotzdem weitergehen?'
		);
		if (!weiter) navigation.cancel();
	});
</script>

{#if offen}
	<!--
		Sichtbar und nicht nur im Dialog: Wer die Seite gar nicht verlässt,
		sondern nur weggeschaut hat, soll sehen, dass noch etwas offen ist.
		`role="status"` meldet es auch dem Vorleseprogramm.
	-->
	<p class="offen" role="status">Noch nicht gespeichert.</p>
{/if}

<style>
	.offen {
		margin: 0;
		font-size: 0.9rem;
		color: var(--warnung);
		font-weight: 550;
	}
</style>
