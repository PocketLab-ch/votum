<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { einblenden } from '$lib/einblender.svelte';
	import { geradeAbgesendet } from '$lib/absenden';
	import { rolleInsBild } from '$lib/sichtfeld';

	/**
	 * Eine Meldung über dem Inhalt — mit einem Knopf, der sie wegnimmt.
	 *
	 * ## Warum sie einen Schliessknopf hat
	 *
	 * Gemeldet am 20.08.2026: «Die rote Meldung soll weggedrückt werden können.»
	 *
	 * Eine Absage bleibt stehen, bis die Seite neu geladen wird — und weil die
	 * Sitzungsleitung während einer Versammlung selten neu lädt, steht der rote
	 * Balken dort auch dann noch, wenn die Sache längst erledigt ist. Im Saal
	 * liest ihn dann jemand über die Schulter und fragt nach etwas, das nicht
	 * mehr gilt.
	 *
	 * **Weggedrückt heisst nicht erledigt.** Der Knopf nimmt die Anzeige weg,
	 * nicht den Anlass. Was tatsächlich zu tun ist, steht im Text — deshalb
	 * verschwindet die Meldung nicht von selbst nach ein paar Sekunden: Wer
	 * gerade woanders hinschaut, hätte sie dann nie gesehen.
	 *
	 * ## Warum sie eine `marke` braucht
	 *
	 * Nach dem Wegdrücken muss die **nächste** Meldung wieder erscheinen — auch
	 * wenn sie wörtlich dieselbe ist, weil jemand zweimal auf denselben Knopf
	 * gedrückt hat. Am Text lässt sich das nicht erkennen. Deshalb bekommt die
	 * Meldung mit, woraus sie stammt: `marke={form}` ist bei jeder Antwort des
	 * Servers ein neues Objekt, und daran hängt die Anzeige.
	 *
	 * ```svelte
	 * <Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
	 * ```
	 *
	 * ## Ohne JavaScript
	 *
	 * Dann bleibt der Knopf wirkungslos und die Meldung stehen — so, wie sie es
	 * vor diesem Baustein überall tat. Ein Rückschritt ist das nicht.
	 */
	interface Eigenschaften {
		/**
		 * `fehler` hält auf, `warnung` gibt zu bedenken, `gut` bestätigt. Der Ton
		 * bestimmt auch, wie dringend ein Bildschirmleser sie ansagt.
		 */
		ton: 'fehler' | 'warnung' | 'gut';
		/**
		 * Woraus die Meldung stammt — üblicherweise `form`. Ändert sich der Wert,
		 * erscheint die Meldung wieder, auch wenn ihr Text derselbe ist.
		 */
		marke: unknown;
		/**
		 * Was beim Schliessen zusätzlich geschehen soll.
		 *
		 * **Für Meldungen, deren Anlass in der Adresse steht** (21.08.2026):
		 * `/z?stand=uebernommen` zeigt einen Hinweis, der bei jedem Neuladen
		 * wiederkommt — «Der rote Balken lässt sich weiterhin nicht entfernen».
		 * Dort nimmt der Knopf nicht die Anzeige weg, sondern den Grund: Die
		 * Seite streicht den Parameter aus der Adresse.
		 *
		 * Ohne diesen Rückruf bleibt es beim Wegnehmen der Anzeige — richtig für
		 * alles, was aus einer Antwort des Servers stammt und ohnehin nicht
		 * wiederkommt.
		 */
		beimSchliessen?: () => void;
		children: Snippet;
	}

	let { ton, marke, beimSchliessen, children }: Eigenschaften = $props();

	/*
	 * Der Startwert ist ein eigenes Symbol: Es ist mit keiner Marke identisch,
	 * die von aussen kommen kann — auch nicht mit `null` oder `undefined`.
	 * Damit ist die erste Meldung immer sichtbar.
	 *
	 * **`$state.raw`, nicht `$state`** — und das ist kein Feinschliff. `$state`
	 * hüllt ein zugewiesenes Objekt in einen reaktiven Stellvertreter; aus
	 * `weggedrueckt = marke` wird dann ein **anderes** Objekt als `marke`, der
	 * Vergleich `!==` ist für immer wahr, und die Meldung liesse sich nicht
	 * wegdrücken. Am 20.08.2026 gemessen: Knopf da, Klick wirkungslos, Meldung
	 * blieb stehen. `$state.raw` legt den Wert ab, wie er ist.
	 */
	let weggedrueckt = $state.raw<unknown>(Symbol('nichts weggedrückt'));
	const sichtbar = $derived(weggedrueckt !== marke);

	/**
	 * **Eine Quittung wandert nach unten rechts** (Auftraggeber, 21.08.2026): «kann man
	 * die Infofenster, also wenn eine Aktion erfolgreich war […] in ein Fenster
	 * das unten rechts aufpoppt, mit der Info das man wegklicken kann oder selbst
	 * verschwindet.»
	 *
	 * Nur `gut`. Eine Absage hält auf und muss stehen bleiben, bis jemand den
	 * genannten Weg geht — was von selbst verschwindet, taugt dafür nicht.
	 *
	 * **Erst im Browser.** Auf dem Server wird die Meldung ganz normal gerendert;
	 * ohne JavaScript bleibt sie deshalb an ihrem Platz stehen, wie überall vor
	 * diesem Baustein. Sobald der Effekt läuft, gibt er sie weiter und die Stelle
	 * hier bleibt leer — sonst stünde dieselbe Meldung zweimal da.
	 */
	let abgegeben = $state.raw<unknown>(Symbol('nichts abgegeben'));
	$effect(() => {
		if (ton !== 'gut' || !sichtbar || abgegeben === marke) return;
		// **Nur der Text, nicht der Knopf.** `textContent` des ganzen Absatzes nimmt
		// das «×» des Schliessknopfes mit — gemessen: «Wandbild gewechselt. × ×».
		const text = knoten?.querySelector('.text')?.textContent?.trim();
		if (!text) return;
		abgegeben = marke;
		einblenden(text);
	});

	/**
	 * **Eine Absage holt sich selbst ins Bild** (27.08.2026).
	 *
	 * Solange jedes Absenden die Seite neu lud, rollte der Neuaufbau an den
	 * Seitenkopf und die Meldung stand vor einem. Seit `absenden()` die
	 * Navigation abschafft, bewegt sich nichts mehr, und wer am unteren Ende
	 * einer 1500 px langen Seite auf «Speichern» drückt, sieht bei einer Absage
	 * gar nichts. Er klickt noch einmal.
	 *
	 * **Nur nach einer Absendung.** Der erste Anlauf liess den Effekt bei jedem
	 * Aufbau laufen, und das war falsch: `/z` lädt sich während einer
	 * Versammlung alle 20 bis 60 Sekunden selbst neu, trägt dabei eine stehende
	 * Warnung aus der Adresse, und SvelteKit stellt den Rollstand wieder her.
	 * Der Effekt hätte dem Eigentümer im Saal im Minutentakt die Abstimmung
	 * unter dem Daumen weggerissen. `geradeAbgesendet()` ist genau die Frage,
	 * die dieser Baustein selbst nicht beantworten kann: Er wird **mit** der
	 * Meldung erzeugt, ob die Seite frisch geladen wurde oder nicht.
	 *
	 * **Ein Bild später**, nicht sofort. Beim ersten Anlauf stand das Rollen
	 * unmittelbar im Effekt, und die Meldung landete gemessen bei −39 px, also
	 * halb über dem oberen Rand: Der Browser verankert den Rollstand beim
	 * Einfügen eines Knotens («scroll anchoring») und verschiebt ihn um die Höhe
	 * der eingefügten Meldung, **nach** dem Effekt.
	 *
	 * **Wie weit gerollt wird, rechnet `$lib/sichtfeld`** — dort steht auch,
	 * warum nicht `scrollIntoView` und warum die Unterkante der Kopfleiste
	 * gemessen statt geschätzt wird. Dieselbe Rechnung braucht die
	 * Sitzungsleitungssicht für die eben aufgenommene Zeile.
	 *
	 * Kein Fokus dazu: `role="alert"` sagt den Text ohnehin an, ein Fokus
	 * obendrauf liest ihn ein zweites Mal vor.
	 */
	let gezeigt = $state.raw<unknown>(Symbol('nichts gezeigt'));
	$effect(() => {
		if (ton === 'gut' || !sichtbar || gezeigt === marke) return;
		if (!geradeAbgesendet()) return;
		const p = knoten;
		if (!p) return;
		gezeigt = marke;
		requestAnimationFrame(() => rolleInsBild(p));
	});

	/**
	 * Der Weg aus einer Meldung, die aus der **Adresse** stammt.
	 *
	 * **Der Anlass** (Auftraggeber, 11.09.2026): «Traktandum aufgerufen lässt sich mit
	 * Klick auf das X nicht entfernen» — und: es verschwinde erst, wenn man
	 * `aufrufen` aus der Adresse lösche.
	 *
	 * So kommt es dazu: Wer einen Knopf drückt, **bevor** Svelte übernommen hat,
	 * schickt das Formular auf dem gewöhnlichen Weg ab. Danach steht `?/aufrufen`
	 * in der Adresse, die Antwort des Servers trägt die Meldung — und der
	 * Schliessknopf hängt an einem Ereignis, das ohne Svelte niemand abfängt. Ein
	 * sichtbarer Knopf, der nichts tut, ist schlimmer als keiner: der Auftraggeber hat ihn
	 * gedrückt und daraus geschlossen, die Anwendung sei kaputt.
	 *
	 * **Der Ausweg ist ein Verweis, kein Knopf.** Wo die Adresse die Handlung
	 * trägt, führt derselbe Pfad ohne sie auf dieselbe Seite ohne Meldung — das
	 * tut ein Browser von sich aus, ohne eine Zeile JavaScript. Ist Svelte da,
	 * fängt `onclick` den Klick ab und nimmt bloss die Anzeige weg; dann bleibt
	 * es beim bisherigen Verhalten, und die Seite wird nicht neu geladen.
	 *
	 * `?/` ist die Form, die SvelteKit für eine Handlung an die Adresse hängt.
	 * Eine gewöhnliche Abfrage (`?suche=…`) bleibt unberührt: Sie ist nicht der
	 * Anlass der Meldung, und ein Verweis, der sie wegwirft, nähme mehr als die
	 * Meldung.
	 *
	 * **Nur bei `gut`, und das ist der Kern der Sache** (aus dem Code-Review,
	 * 11.09.2026). Eine Absage bringt die eingetippten Werte zurück
	 * (`fail(400, { werte })`), und die Maske füllt sich daraus wieder. Ein
	 * Verweis auf den blanken Pfad wirft sie weg — auf `/versammlungen/neu?/einzeln`
	 * stünde danach ein leeres Formular. Der wirkungslose Knopf war dort das
	 * kleinere Übel, und er bleibt. Nach einer gelungenen Handlung gibt es nichts
	 * mehr zu verlieren; genau dort stand die Meldung «Traktandum aufgerufen.», die der Auftraggeber sah.
	 */
	const ausDerAdresse = $derived(
		(page.url?.search?.startsWith('?/') ?? false) && ton === 'gut'
	);

	/** Der gerenderte Text — nur, um ihn weiterzugeben. */
	let knoten = $state<HTMLElement | null>(null);
	const umgezogen = $derived(ton === 'gut' && abgegeben === marke);
</script>

{#if sichtbar && !umgezogen}
	<!--
		**`tabindex="-1"` ist kein Fokus, sondern die Möglichkeit dazu**
		(02.09.2026, aus dem Code-Review). Der Absatz darüber begründet, warum die
		Meldung sich den Fokus nicht **nimmt** — `role="alert"` sagt den Text
		ohnehin an. Etwas anderes ist, ob eine Seite ihn ihr **geben** kann.

		`betreiber/dienste` versucht genau das als dritten und letzten Griff: Ist
		die auslösende Handlung nach dem Erfolg verschwunden («In die Anwendung
		übernehmen» gibt es nach dem Übernehmen nicht mehr), fällt der Fokus sonst
		auf `<body>`, und wer mit der Tastatur arbeitet, tabbt sich durch die ganze
		Seite zurück. Der Kommentar dort schrieb der Meldung das `tabindex` seit
		dem 28.08.2026 zu — hier stand keines, und `focus()` auf einem blanken
		`<p>` tut nichts.

		Die Tab-Reihenfolge ändert sich dadurch nicht: `-1` heisst «nur
		programmatisch erreichbar».
	-->
	<p
		class="meldung {ton}"
		role={ton === 'fehler' ? 'alert' : 'status'}
		tabindex="-1"
		bind:this={knoten}
	>
		<span class="text">{@render children()}</span>
		{#if ausDerAdresse}
			<a
				class="weg"
				href={page.url.pathname}
				onclick={(e) => {
					// Mit Svelte: nur die Anzeige wegnehmen, kein Seitenwechsel. Ohne
					// Svelte läuft dieser Zuhörer nicht, und der Verweis trägt.
					e.preventDefault();
					weggedrueckt = marke;
					beimSchliessen?.();
				}}
				aria-label="Meldung schliessen"
				title="Meldung schliessen">×</a
			>
		{:else}
			<button
				type="button"
				class="weg"
				onclick={() => {
					weggedrueckt = marke;
					beimSchliessen?.();
				}}
				aria-label="Meldung schliessen"
				title="Meldung schliessen">×</button
			>
		{/if}
	</p>
{/if}

<style>
	.meldung {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.7rem 0.95rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		margin: 0.75rem 0;
		max-width: var(--lesebreite);
	}

	.text {
		flex: 1;
		min-width: 0;
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 12%, transparent);
	}

	/*
	 * **Der Knopf trägt die Farbe der Meldung, nicht die eines Knopfes.** Er ist
	 * das Gegenteil einer Handlung: Er tut nichts, er nimmt nur weg. Ein
	 * gefüllter Knopf daneben sähe aus, als bestätige man damit etwas.
	 *
	 * Die Zielgrösse ist trotzdem die eines Fingers — im Saal wird auf einem
	 * Telefon gedrückt, und daneben zu treffen kostet dort mehr als am Schreibtisch.
	 */
	/*
	 * Knopf ODER Verweis — dieselbe Gestalt. Der Verweis trägt den Fall ohne
	 * Svelte (siehe `ausDerAdresse`); für das Auge darf das keinen Unterschied
	 * machen, sonst sieht die Meldung je nach Zustand anders aus.
	 */
	.weg {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		min-width: var(--ziel-min);
		min-height: var(--ziel-min);
		margin: -0.35rem -0.5rem -0.35rem 0;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: inherit;
		font: inherit;
		font-size: 1.35rem;
		line-height: 1;
		opacity: 0.65;
		cursor: pointer;
	}

	.weg:hover,
	.weg:focus-visible {
		opacity: 1;
		background: color-mix(in srgb, currentColor 12%, transparent);
	}
</style>
