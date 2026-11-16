<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { passtZurAuswahlsuche, type Auswahleintrag } from '$lib/auswahl';
	import { brauchtSuchfeld, SUCHSCHWELLE } from '$lib/domain/listensuche';
	import { gefuehrteWahl } from '$lib/felder';

	/**
	 * Ein Auswahlfeld, in dem man tippen kann.
	 *
	 * ## Wozu
	 *
	 * Gemeldet am 26.08.2026: «Bei Eigentümer fehlt die Möglichkeit nach Einheit
	 * zu suchen. Im Dropdown muss dann gescrollt werden.» Eine Gemeinschaft mit
	 * dreissig Einheiten ist der Normalfall, nicht der Ausreisser — und beim
	 * Zuordnen steht die Nummer der Einheit auf dem Papier vor einem, während
	 * man sie in einer Liste sucht.
	 *
	 * ## Warum ein echtes `<select>` und keine eigene Liste
	 *
	 * `Wahlliste.svelte` gibt es schon; sie löst denselben Fall dort, wo
	 * **mehrere** Namen anzukreuzen sind, und ersetzt das Auswahlfeld durch eine
	 * Liste. Hier bleibt das `<select>` stehen, aus drei Gründen — alle drei
	 * sind Anforderungen dieser Anwendung und keine Geschmacksfragen:
	 *
	 *   * **Ohne JavaScript muss gewählt werden können.** Im Saal wird die
	 *     Anwendung auf fremden Geräten benutzt. Das Suchfeld erscheint deshalb
	 *     erst nach dem Aufbau (`onMount`); vorher — und ohne JavaScript — steht
	 *     genau das Auswahlfeld da, das vorher dort stand. Kein Feld, das
	 *     dasteht und nichts tut.
	 *   * **Auf dem Telefon ist das eigene Fenster des Betriebssystems besser
	 *     als jede nachgebaute Liste** — es ist gross, es rollt, und es ist das,
	 *     was der Daumen kennt.
	 *   * **Keine neue Abhängigkeit.** Geprüft und verworfen: `<datalist>` kann
	 *     Anzeigetext und geschickten Wert nicht trennen — es schickt, was
	 *     dasteht. Unsere Felder schicken Kennungen und zeigen Namen; mit
	 *     `datalist` käme «Muster, Anna» am Server an, wo eine UUID erwartet wird.
	 *
	 * ## Die Falle, um die es hier eigentlich geht
	 *
	 * **Das Filtern darf die Wahl nicht wegnehmen.** Wer «3.2» sucht, wählt und
	 * dann «Keller» tippt, hat 3.2 gewählt — nähme der Filter die Option aus der
	 * Liste, stünde das Feld auf dem ersten Eintrag, und abgeschickt würde ein
	 * anderer. Der Gewählte bleibt deshalb **immer** in der Liste, gleich was im
	 * Suchfeld steht.
	 *
	 * ## Wo die Beschriftung herkommt
	 *
	 * Die aufrufende Seite umschliesst den Baustein mit `<label>`. Ein `<label>`
	 * beschriftet aber nur **ein** Feld — das erste darin, und das wäre hier das
	 * Suchfeld. Beide Felder tragen deshalb ein eigenes `aria-label`; das
	 * ausdrückliche gewinnt gegen das umschliessende, und ein Vorleseprogramm
	 * nennt jedes der beiden bei seinem Namen.
	 */
	interface Eigenschaften {
		/** Der Feldname im Formular. */
		name: string;
		/** Was zur Wahl steht. */
		eintraege: Auswahleintrag[];
		/** Wie das Feld heisst — für das Vorleseprogramm und die Suche. */
		beschriftung: string;
		/**
		 * Der Eintrag zuoberst, der nichts wählt («— wählen —»).
		 *
		 * Weglassen heisst: Es gibt keine leere Wahl, der erste Eintrag gilt.
		 */
		leerText?: string;
		/** Der gewählte Wert — gebunden, damit die Seite ihn lesen kann. */
		wert?: string;
		/** Eine Wahl verlangen. */
		pflicht?: boolean;
		/** Zu welchem Formular das Feld gehört (Regel 6 in `docs/gestaltung.md`). */
		form?: string;
		/** Kennung des Auswahlfelds — für ein `<label for=…>` daneben. */
		id?: string;
		/** Bis zu wie vielen Einträgen es **ohne** Suchfeld geht. */
		schwelle?: number;
		/** Läuft nach jeder Wahl — etwa, um das Formular abzuschicken. */
		beiWechsel?: (wert: string) => void;
	}

	let {
		name,
		eintraege,
		beschriftung,
		leerText,
		wert = $bindable(''),
		pflicht = false,
		form,
		id,
		schwelle = SUCHSCHWELLE,
		beiWechsel
	}: Eigenschaften = $props();

	let suche = $state('');

	/**
	 * Das Auswahlfeld selbst — gebraucht wird es an genau zwei Stellen unten.
	 */
	let feld = $state<HTMLSelectElement | undefined>(undefined);

	/**
	 * Was das Feld zeigt.
	 *
	 * **Warum das nicht `bind:value` ist — nachgemessen am 26.08.2026.** Mit
	 * `bind:value` schreibt Svelte beim Aufbau den gebundenen Wert in das Feld
	 * zurück. Wer im Fenster **vor der Hydration** wählt — und das ist im Saal
	 * der Normalfall, nicht der Ausreisser —, verliert seine Wahl wortlos: Das
	 * Feld stand wieder auf «— wählen —», das Formular war unvollständig, und
	 * der Knopf tat beim Drücken nichts. Gemessen mit gebremstem Skript:
	 * «Whg 1» gewählt, nach der Hydration leer. `e2e/telefonbreite.mjs` fiel
	 * genau darüber, bevor es jemand im Saal tat.
	 *
	 * Es ist dieselbe Falle wie bei `value={…}` an einem Textfeld, und die
	 * Antwort ist dieselbe wie in `$lib/felder`: **Im Browser führt der Browser
	 * das Feld.** Hier steht der Wert im `selected` der Option — beim Aufbau
	 * gesetzt, danach nicht mehr massgeblich, weil ein angefasstes Auswahlfeld
	 * seine Wahl selbst behält.
	 *
	 * Nach oben meldet `use:gefuehrteWahl` (`$lib/felder`) — beim Aufbau einmal,
	 * das ist die frühe Wahl, und danach bei jeder Änderung. Bis zum 26.08.2026
	 * stand die Nachholung hier als eigene Zeile in `onMount`; sie ist dieselbe
	 * Sache und steht jetzt an **einer** Stelle, damit niemand die Hälfte davon
	 * abschreibt.
	 */
	let gezeigt = $state(wert);

	/*
	 * **Erst nach dem Aufbau.** `onMount` läuft im Browser und nur dort — ohne
	 * JavaScript bleibt es beim reinen Auswahlfeld.
	 */
	let montiert = $state(false);
	onMount(() => {
		montiert = true;
	});

	/** Eine Wahl gilt: für die Liste darunter und für die aufrufende Seite. */
	function uebernehmen(neu: string) {
		gezeigt = neu;
		if (wert !== neu) wert = neu;
	}

	/*
	 * **Der Weg nach unten: die Seite setzt den Wert selbst.**
	 *
	 * Das kommt vor — «Vorschlag übernehmen» auf der Eigentümerseite setzt die
	 * Person, ein Wechsel der Erfordernisart setzt die Bezugsgrössen zurück.
	 * `untrack` hält den Ring auf: Ohne es liefe jede Wahl im Feld sofort wieder
	 * über diesen Weg zurück.
	 */
	$effect(() => {
		const aussen = wert;
		untrack(() => {
			if (aussen === gezeigt) return;
			gezeigt = aussen;
			/*
			 * **Nach dem Anstrich, nicht davor.** Steht eine Suche im Feld und blendet
			 * ihr Filter den gesetzten Eintrag gerade aus, findet `feld.value` keine
			 * Option und das Feld fällt auf «keine Auswahl». Erst mit dem neuen
			 * `gezeigt` steht der Eintrag wieder in der Liste (siehe `sichtbar`).
			 */
			void tick().then(() => {
				if (feld && feld.value !== aussen) feld.value = aussen;
			});
		});
	});

	// `brauchtSuchfeld` und nicht `> schwelle` von Hand (27.08.2026): Sonst
	// stünde der Vergleich an zwei Stellen, und wer die Regel für Listen
	// ändert, verschöbe die Auswahlfelder nicht mit.
	const suchbar = $derived(
		montiert && brauchtSuchfeld({ durchsuchbar: eintraege.length, archiviert: 0, schwelle })
	);

	/**
	 * Was der Filter übrig lässt — **und der Gewählte, immer**.
	 *
	 * Ohne die zweite Hälfte verlöre eine Suche die getroffene Wahl: Der Browser
	 * stellt ein `<select>`, dessen gewählte Option verschwindet, auf die erste
	 * um, und abgeschickt würde etwas, das niemand gewählt hat.
	 */
	const sichtbar = $derived.by(() => {
		if (!suchbar) return eintraege;
		if (!suche.trim()) return eintraege;
		return eintraege.filter((e) => e.wert === gezeigt || passtZurAuswahlsuche(e, suche));
	});

	/** Die Gruppen in der Reihenfolge, in der sie zuerst vorkommen. */
	const gruppiert = $derived.by(() => {
		const ohne = sichtbar.filter((e) => !e.gruppe);
		const mit = new Map<string, Auswahleintrag[]>();
		for (const e of sichtbar) {
			if (!e.gruppe) continue;
			const bisher = mit.get(e.gruppe);
			if (bisher) bisher.push(e);
			else mit.set(e.gruppe, [e]);
		}
		return { ohne, gruppen: [...mit.entries()].map(([titel, eintraege]) => ({ titel, eintraege })) };
	});

	const gesucht = $derived(suchbar && suche.trim().length > 0);
	const treffer = $derived(eintraege.filter((e) => passtZurAuswahlsuche(e, suche)).length);
</script>

{#if suchbar}
	<!--
		**Die Eingabetaste schickt hier nichts ab** (26.08.2026, aus dem
		Code-Review). Ein Textfeld in einem Formular löst mit Enter die Abgabe aus.
		Im Notweg der Sitzungsleitung stünde damit mitten in der Versammlung ein
		«Aufruf zurückgenommen» im Verlauf, das niemand gewollt hat — getippt war
		ein Suchwort. Das Feld trägt keinen `name`; abgeschickt wird es nie.
	-->
	<input
		class="auswahlsuche"
		type="search"
		bind:value={suche}
		placeholder="Tippen zum Filtern"
		autocomplete="off"
		aria-label="{beschriftung} durchsuchen"
		onkeydown={(ereignis) => {
			if (ereignis.key === 'Enter') ereignis.preventDefault();
		}}
	/>
	<!--
		**Der Kasten steht immer da, nur sein Text wechselt** (26.08.2026, aus dem
		Code-Review). Ein `aria-live`-Bereich, der erst mit seinem Inhalt in den
		Baum kommt, wird von Vorleseprogrammen in aller Regel nicht angesagt — die
		Meldung erreichte genau die nicht, für die sie gedacht ist.
	-->
	<p class="zaehler" aria-live="polite">
		{#if !gesucht}
			&nbsp;
		{:else if treffer === 0}
			Kein Eintrag passt zur Suche.
		{:else}
			{treffer} von {eintraege.length}
		{/if}
	</p>
{/if}

<!--
	`selected` an der Option und nicht `bind:value` am Feld — die Begründung
	steht oben bei `gezeigt`. `selected` trägt beides: Auf dem Server steht der
	Wert damit im ausgelieferten HTML (das Feld wirkt ohne JavaScript), und im
	Browser bestimmt es die Wahl nur beim **Erzeugen** der Option. Genau deshalb
	übersteht eine getroffene Wahl das Filtern: Der Eintrag bleibt in der Liste
	(siehe `sichtbar`), sein Knoten wird verschoben statt neu gebaut.
-->
<select
	bind:this={feld}
	{name}
	{form}
	{id}
	required={pflicht}
	aria-label={beschriftung}
	use:gefuehrteWahl={uebernehmen}
	onchange={(ereignis) => beiWechsel?.(ereignis.currentTarget.value)}
>
	{#if leerText !== undefined}
		<option value="" selected={gezeigt === ''}>{leerText}</option>
	{/if}
	{#each gruppiert.ohne as e (e.wert)}
		<option value={e.wert} selected={e.wert === gezeigt} disabled={e.deaktiviert}>{e.text}</option>
	{/each}
	{#each gruppiert.gruppen as g (g.titel)}
		<optgroup label={g.titel}>
			{#each g.eintraege as e (e.wert)}
				<option value={e.wert} selected={e.wert === gezeigt} disabled={e.deaktiviert}>
					{e.text}
				</option>
			{/each}
		</optgroup>
	{/each}
</select>

<style>
	/*
	 * Das Suchfeld nimmt die Breite des Auswahlfelds darunter. `box-sizing`
	 * ausdrücklich, weil der Rahmen sonst über die Spalte hinausragt — auf
	 * 320 px sind das die Pixel, die `e2e/telefonbreite.mjs` meldet.
	 */
	.auswahlsuche {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--ziel-min);
	}

	/*
	 * **Ein `<select>` ohne Breitenangabe wird so breit wie seine längste
	 * Option** (02.09.2026). Auf `/verlauf` stehen in den Filtern die Namen
	 * ganzer Gemeinschaften und Versammlungen; das Feld wuchs damit auf 739 px
	 * und schob die Seite am Telefon **365 px** seitlich weg — der grösste
	 * Querlauf im ganzen Bestand.
	 *
	 * `max-width: 100%` allein reicht nicht, nachgemessen: Das Feld bestimmt
	 * seine Breite aus dem Inhalt, bevor die Obergrenze greift, und weitet dabei
	 * seinen Elternteil auf. Erst `width: 100%` bindet es an den Platz, den es
	 * bekommt — und das ist ohnehin die Absicht dieses Bausteins: Suchfeld und
	 * Auswahl sollen gleich breit sein.
	 */
	select {
		width: 100%;
		box-sizing: border-box;
	}

	.zaehler {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: var(--text-leise);
	}
</style>
