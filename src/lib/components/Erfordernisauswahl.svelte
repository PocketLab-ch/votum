<script lang="ts">
	/**
	 * Den Fall des Regelwerks wählen — mit thematischer Suche.
	 *
	 * **Warum es sie als Komponente gibt.** Dieselbe Auswahl steht an vier
	 * Stellen: beim Anlegen eines Traktandums, beim Ändern, am Abend und in der
	 * Sitzungsleitung. Viermal kopiert liefen die Hilfstexte auseinander, und die
	 * Suche gäbe es an drei davon nicht.
	 *
	 * **Warum die Suche nötig ist** (Auftraggeber, 11.08.2026): «Eine Suchfunktion wäre
	 * hier noch gut, die auch thematisch sucht.» Die Liste führt dreissig Fälle,
	 * benannt nach ihrer rechtlichen Einordnung — «Nützliche bauliche Massnahme»,
	 * «Wichtigere Verwaltungshandlung». Wer eine Wärmepumpe traktandiert, sucht
	 * aber nach «Heizung». Gesucht wird deshalb auch in den **Beispielen** des
	 * Regelwerks, und dort steht «Heizungsersatz mit Systemwechsel auf eine
	 * Wärmepumpe».
	 *
	 * Die Beispiele stammen aus der Regelfassung, nicht aus dieser Datei (AD-4):
	 * Was fachlich zu einem Fall gehört, entscheidet das Regelwerk.
	 */
	import { tick, untrack } from 'svelte';
	import { sucheErfordernisse, type Erfordernisauswahl } from '$lib/domain/entscheidbaum';
	import { gefuehrteWahl } from '$lib/felder';

	let {
		erfordernisse = [] as Erfordernisauswahl[],
		name = 'erfordernis',
		beschriftung = 'Mehrheitserfordernis',
		leerText = '— offen, über den Entscheidbaum bestimmen —',
		/**
		 * Der gewählte Fall. Bindbar, weil er anderswo eine Warnung steuert — auf
		 * der Sitzungsleitung hängt der Hinweis «schwächer als der Grundantrag»
		 * daran, und im Traktandenformular die Geschäftsart.
		 */
		wert = $bindable(''),
		/** Steht unter dem Feld — sagt, was die Auswahl bewirkt. */
		hilfe = '',
		/**
		 * Die Rasterspur beider Felder — `voll`, `breit` oder leer.
		 *
		 * **Sie gehört an die Beschriftungen, nicht an einen Kasten darum.** Die
		 * Regeln in `app.css` sprechen `.felder > label` an, mit Kind-Selektor:
		 * Eine Zwischenebene nimmt den Beschriftungen ihr Gewicht und ihre Spur.
		 * Gemessen am 11.08.2026 — «Fall suchen» stand mager neben einem fetten
		 * «Titel» (docs/gestaltung.md, «Ein Feld sieht überall gleich aus»).
		 */
		spur = 'voll'
	}: {
		erfordernisse?: Erfordernisauswahl[];
		name?: string;
		beschriftung?: string;
		leerText?: string;
		wert?: string;
		hilfe?: string;
		spur?: string;
	} = $props();

	let suche = $state('');

	/** Das Auswahlfeld selbst — gebraucht, wenn die Seite den Wert von aussen setzt. */
	let feld = $state<HTMLSelectElement | undefined>(undefined);

	/**
	 * Was das Feld zeigt.
	 *
	 * **Warum das nicht `bind:value` ist — nachgemessen am 26.08.2026.** Mit
	 * `bind:value` schreibt Svelte beim Aufbau den gebundenen Wert in das Feld
	 * zurück; wer wählt, bevor das Skript geladen ist, verliert seine Wahl
	 * wortlos. Im Saal wird die Anwendung auf fremden Telefonen benutzt — das ist
	 * dort der Normalfall, nicht der Ausreisser. Die vollständige Begründung
	 * steht bei `gefuehrteWahl` in `$lib/felder`, gemessen wird sie in
	 * `e2e/wahl-vor-hydration.mjs`.
	 *
	 * Hier steht der Wert deshalb im `selected` der Option; nach oben meldet
	 * `use:gefuehrteWahl`.
	 */
	let gezeigt = $state(wert);

	/** Eine Wahl gilt: für die Liste darunter und für die aufrufende Seite. */
	function uebernehmen(neu: string) {
		gezeigt = neu;
		if (wert !== neu) wert = neu;
	}

	/*
	 * **Der Weg nach unten: die Seite setzt den Wert selbst.** Im Bestand steht
	 * `wert={z.erfordernis}` — ändert sich der Datensatz, muss das Feld nachziehen.
	 * Ein angefasstes Auswahlfeld folgt dem `selected` nicht mehr, also wird der
	 * Wert von Hand hineingeschrieben. `untrack` hält den Ring auf; `tick`, weil
	 * die gesetzte Option erst nach dem Anstrich in der Liste steht (dasselbe
	 * Muster wie in `Suchauswahl.svelte`).
	 */
	$effect(() => {
		const aussen = wert;
		untrack(() => {
			if (aussen === gezeigt) return;
			gezeigt = aussen;
			void tick().then(() => {
				if (feld && feld.value !== aussen) feld.value = aussen;
			});
		});
	});

	/** Was die thematische Suche findet — diese Zahl nennt der Hinweis darunter. */
	const treffer = $derived(sucheErfordernisse(erfordernisse, suche));

	/**
	 * Was in der Liste steht: die Treffer — **und der Gewählte, immer**.
	 *
	 * Ohne die zweite Hälfte verlöre eine Suche die getroffene Wahl: Der Browser
	 * stellt ein `<select>`, dessen gewählte Option verschwindet, auf die erste
	 * um, und abgeschickt würde ein Fall, den niemand gewählt hat.
	 */
	const gefunden = $derived.by(() => {
		if (!gezeigt || treffer.some((e) => e.knotenId === gezeigt)) return treffer;
		const dabei = new Set(treffer.map((e) => e.knotenId));
		return erfordernisse.filter((e) => dabei.has(e.knotenId) || e.knotenId === gezeigt);
	});

	/** Die Auswahl nach Ästen gebündelt; die Reihenfolge kommt aus dem Kern. */
	const gruppen = $derived(
		gefunden.reduce<{ astId: string; astTitel: string; eintraege: Erfordernisauswahl[] }[]>(
			(bisher, e) => {
				const letzte = bisher[bisher.length - 1];
				if (letzte && letzte.astId === e.astId) letzte.eintraege.push(e);
				else bisher.push({ astId: e.astId, astTitel: e.astTitel, eintraege: [e] });
				return bisher;
			},
			[]
		)
	);

	/**
	 * Das Beispiel, über das ein Treffer gefunden wurde.
	 *
	 * Ohne diesen Hinweis stünde bei der Suche nach «Heizung» ein Fall in der
	 * Liste, dessen Name das Wort nicht enthält — und niemand wüsste, warum er da
	 * ist.
	 */
	function trefferwort(e: Erfordernisauswahl): string | null {
		const w = suche.trim().toLocaleLowerCase('de-CH');
		if (!w) return null;
		if (e.titel.toLocaleLowerCase('de-CH').includes(w)) return null;
		return e.beispiele.find((b) => b.toLocaleLowerCase('de-CH').includes(w)) ?? null;
	}
</script>

<label class={spur}>
	Fall suchen
		<!--
			`bind:value` statt `anfangswert`: Das Feld steuert die Liste darunter,
			also muss sein Wert reaktiv sein. Abgeschickt wird es nie — es trägt
			keinen `name`.
		-->
	<input type="search" bind:value={suche} placeholder="Heizung, Lift, Reglement, 647d …" />
	<span class="hilfe">
		Sucht auch in den Beispielen des Regelwerks — «Wärmepumpe» findet die nützliche bauliche
		Massnahme.
	</span>
</label>

<label class={spur}>
	{beschriftung}
	<!--
		**Die begründete Ausnahme von `Suchauswahl.svelte`** (26.08.2026).

		Der Wächter `versammlung/durchsuchbare-auswahl` verlangt für jedes
		Auswahlfeld aus dem Bestand den gemeinsamen Baustein. Hier bliebe dabei
		genau das auf der Strecke, wofür diese Datei gebaut wurde: Gesucht wird
		nicht im angezeigten Text, sondern zusätzlich in den **Beispielen** des
		Regelwerks (`sucheErfordernisse`), und der Treffer wird hinter dem Namen
		genannt. `Suchauswahl` sucht in dem, was dasteht — «Wärmepumpe» fände die
		nützliche bauliche Massnahme dann nicht mehr.

		Die Ausnahme steht hier und nicht in einer Liste im Wächter, damit sie
		beim Lesen dieser Stelle sichtbar ist.
	-->
	<!-- eslint-disable-next-line versammlung/durchsuchbare-auswahl -->
	<select {name} bind:this={feld} use:gefuehrteWahl={uebernehmen}>
		<option value="" selected={gezeigt === ''}>{leerText}</option>
		{#each gruppen as gruppe (gruppe.astId)}
			<optgroup label={gruppe.astTitel}>
				{#each gruppe.eintraege as e (e.knotenId)}
					{@const grund = trefferwort(e)}
					<!--
						`selected` an der Option — und der Gewählte bleibt in der Liste (siehe
						`gefunden`). Beides gehört zusammen: `selected` bestimmt die Wahl nur
						beim **Erzeugen** der Option, und weil der gewählte Eintrag beim Tippen
						nicht aus der Liste fällt, wird sein Knoten verschoben statt neu
						gebaut. So übersteht die Wahl das Filtern.
					-->
					<option value={e.knotenId} selected={e.knotenId === gezeigt}>
						{e.titel} · {e.kurz}{grund ? ` — ${grund}` : ''}
					</option>
				{/each}
			</optgroup>
		{/each}
	</select>
	<!--
		Gezählt werden die **Treffer**, nicht die Liste: In der Liste steht
		zusätzlich der Gewählte, auch wenn er zur Suche nicht passt. «1 von 30» bei
		null Treffern wäre eine falsche Auskunft.
	-->
	{#if suche.trim() && treffer.length === 0}
		<span class="hilfe leer">
			Kein Fall zu «{suche}». Der Entscheidbaum führt auch ohne Suchwort hin.
		</span>
	{:else if suche.trim()}
		<span class="hilfe">{treffer.length} von {erfordernisse.length} Fällen.</span>
	{/if}
	{#if hilfe}<span class="hilfe">{hilfe}</span>{/if}
</label>

<style>
	/*
	 * Keine eigenen Regeln für `label` und `select`: Die stehen in `app.css` und
	 * gelten für jedes Feld in einem `.felder`-Raster. Eine Kopie hier liefe beim
	 * nächsten Feinschliff auseinander — genau das beschreibt
	 * docs/gestaltung.md unter «Was für alle gilt, wird für alle geändert».
	 */
	.hilfe {
		color: var(--text-leise);
		font-size: 0.875rem;
		font-weight: 400;
	}

	.hilfe.leer {
		color: var(--warnung);
	}
</style>
