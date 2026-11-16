<script lang="ts">
	/**
	 * Eine durchsuchbare Liste zum Ankreuzen — mehrere Namen aus vielen.
	 *
	 * ## Wozu
	 *
	 * Gemeldet am 21.08.2026, zweimal: «bei Ausstand müsste noch eine
	 * Schnellsuche rein. Sonst wird es mühsam, wenn man bei 80 Köpfen den
	 * richtigen Namen suchen muss» und «Die Schnellsuche bei Antragsteller fehlt.
	 * Inkl Selektion.» Ein Aufklappfeld mit achtzig Einträgen findet im Saal
	 * niemand, und beide Fälle brauchen mehrere.
	 *
	 * ## Die Falle, um die es hier eigentlich geht
	 *
	 * **Filtern darf die Auswahl nicht verlieren.** Wer «Meier» sucht, ankreuzt
	 * und dann «Huber» sucht, hat Meier gewählt — sichtbar ist er nicht mehr.
	 * Steht die Auswahl im DOM (ein Ankreuzfeld, das der Filter entfernt), ist
	 * sie damit weg: Beim Abschicken fehlt sie, ohne Meldung, ohne Spur. Genau
	 * so gebaut und im Browser gemessen — von zwei Angekreuzten kam einer an.
	 *
	 * Deshalb führt dieser Baustein die Auswahl **selbst**, nicht über
	 * `bind:group`, und schickt jeden Gewählten, den der Filter gerade
	 * ausblendet, als verstecktes Feld mit. Zusätzlich stehen die Gewählten
	 * immer oben — was gewählt ist, soll man sehen, ohne die Suche zu leeren.
	 */
	interface Eigenschaften {
		/** Der Feldname im Formular. Mehrfach belegt: einmal je Gewähltem. */
		name: string;
		/**
		 * Was zur Wahl steht.
		 *
		 * `zusatz` steht klein hinter dem Namen — Stimmkraft, ein Vermerk. Er wird
		 * **nicht durchsucht**: Wer «Meier» tippt, meint den Namen, und eine Suche,
		 * die auch Zahlen trifft, liefert Treffer, die niemand erklären kann.
		 */
		eintraege: { id: string; name: string; zusatz?: string; leise?: boolean }[];
		/** Beschriftung des Suchfelds für Bildschirmleser. */
		suchbeschriftung: string;
		/** Was steht, wenn niemand gewählt ist. */
		leerhinweis: string;
		/**
		 * Mehrere zulassen (Vorgabe) oder genau eine.
		 *
		 * Ergänzt am 21.08.2026: «Bei für welche Partei fehlt noch die Suchfunktion
		 * für die Partei.» Dort steht ein Aufklappfeld mit allen Parteien, und
		 * gewählt wird genau eine — dieselbe Suche, andere Bedienung.
		 */
		mehrfach?: boolean;
		/** Bei Einzelwahl: eine Wahl verlangen, solange keine getroffen ist. */
		pflicht?: boolean;
		/** Die gewählten Kennungen — gebunden, damit die Seite sie lesen kann. */
		gewaehlt?: string[];
	}

	let {
		name,
		eintraege,
		suchbeschriftung,
		leerhinweis,
		mehrfach = true,
		pflicht = false,
		gewaehlt = $bindable([])
	}: Eigenschaften = $props();

	let suche = $state('');

	const sichtbar = $derived.by(() => {
		const s = suche.trim().toLowerCase();
		if (!s) return eintraege;
		return eintraege.filter((e) => e.name.toLowerCase().includes(s));
	});

	/** Gewählte zuerst — sonst sucht man, was man schon hat. */
	const geordnet = $derived.by(() => {
		const drin = new Set(sichtbar.map((e) => e.id));
		const obenauf = eintraege.filter((e) => gewaehlt.includes(e.id) && !drin.has(e.id));
		return [...obenauf, ...sichtbar];
	});

	/**
	 * Was gewählt ist und in der Liste **gar nicht mehr vorkommt**.
	 *
	 * **Nicht: was der Filter versteckt.** Den Fall gibt es hier nicht mehr,
	 * seit `geordnet` die Gewählten voranstellt — wer gewählt ist und in
	 * `eintraege` steht, steht immer auch in der Liste, gleich was gesucht wird.
	 * Nachgemessen am 25.08.2026: nach einer Suche ohne Treffer steht der
	 * Gewählte oben, angekreuzt, und es gibt **null** versteckte Felder.
	 *
	 * Übrig bleibt der Fall, für den die Felder unten weiterhin gebraucht
	 * werden: Die aufrufende Seite tauscht `eintraege` aus — nach einem
	 * Nachziehen am Ereignisstrom etwa —, und der Gewählte ist nicht mehr dabei.
	 * Ohne die Felder fiele er beim Abschicken lautlos weg.
	 */
	const verdeckt = $derived(
		gewaehlt.filter((id) => !geordnet.some((e) => e.id === id))
	);

	const namenGewaehlt = $derived(
		gewaehlt
			.map((id) => eintraege.find((e) => e.id === id)?.name)
			.filter((n): n is string => Boolean(n))
	);

	function umschalten(id: string, an: boolean) {
		// Bei Einzelwahl ersetzt die neue Wahl die alte. Abwählen gibt es dort
		// nicht: Ein Radio lässt sich nicht ausschalten, nur umsetzen.
		if (!mehrfach) {
			gewaehlt = an ? [id] : gewaehlt;
			return;
		}
		gewaehlt = an ? [...new Set([...gewaehlt, id])] : gewaehlt.filter((x) => x !== id);
	}
</script>

<input
	type="search"
	bind:value={suche}
	placeholder="Name suchen"
	autocomplete="off"
	aria-label={suchbeschriftung}
/>

<p class="stand">
	{#if gewaehlt.length > 0}
		Gewählt: {namenGewaehlt.join(', ')}
	{:else if suche.trim()}
		{sichtbar.length} von {eintraege.length}
	{:else}
		{leerhinweis}
	{/if}
</p>

<ul class="wahlliste">
	{#each geordnet as e (e.id)}
		<li class:gewaehlt={gewaehlt.includes(e.id)}>
			<label>
				<!--
					**`required` nur, solange nichts gewählt ist.** Sonst blockierte der
					Browser das Abschicken, wenn der Gewählte gerade weggefiltert ist —
					sein Wert steckt dann im versteckten Feld unten, und die sichtbare
					Gruppe sähe leer aus.
				-->
				<!--
					**Hier führt das Programm den Wert — mit Absicht.** `bind:group`
					verlöre das Angekreuzte, sobald der Filter das Feld aus dem DOM nimmt
					(gemessen am 21.08.2026): Wer «Christen» sucht, ankreuzt und dann die
					Suche leert, hatte nichts gewählt. Der Zustand steht deshalb in
					`$state`, und `checked` **muss** ihm folgen.

					Bis zum 24.08.2026 stand diese Ausnahme als Dateiname in einer Liste
					im Wächter — weit weg von der Stelle, für die sie gilt. Jetzt steht
					sie hier.
				-->
				<!-- eslint-disable-next-line versammlung/anfangswert -->
				<input
					type={mehrfach ? 'checkbox' : 'radio'}
					{name}
					value={e.id}
					checked={gewaehlt.includes(e.id)}
					required={!mehrfach && pflicht && gewaehlt.length === 0}
					onchange={(ereignis) => umschalten(e.id, ereignis.currentTarget.checked)}
				/>
				<span class:leise={e.leise}>
					{e.name}{#if e.zusatz}<span class="zusatz">{e.zusatz}</span>{/if}
				</span>
			</label>
		</li>
	{:else}
		<li class="leer">Kein Name passt zur Suche.</li>
	{/each}
</ul>

<!--
	Die Gewählten, die in der Liste gar nicht mehr vorkommen — nicht die, die der
	Filter versteckt (die stehen oben, siehe `geordnet`). Ohne diese Felder
	fielen sie beim Abschicken weg.
-->
{#each verdeckt as id (id)}
	<input type="hidden" {name} value={id} />
{/each}

<style>
	input[type='search'] {
		width: 100%;
		min-height: var(--ziel-min);
		box-sizing: border-box;
	}

	.stand {
		margin: 0.35rem 0 0;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.wahlliste {
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0;
		max-height: 12rem;
		overflow-y: auto;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
	}

	.wahlliste li {
		border-bottom: 1px solid var(--linie);
	}

	.wahlliste li:last-child {
		border-bottom: 0;
	}

	.wahlliste li.gewaehlt {
		background: color-mix(in srgb, var(--akzent) 12%, transparent);
	}

	/*
	 * **`row` ausdrücklich.** Die Formulare, in denen dieser Baustein steht,
	 * stellen ihre Beschriftungen untereinander (`label { flex-direction:
	 * column }`). Ein eigener Selektor gewinnt nur bei den Eigenschaften, die er
	 * auch setzt — ohne diese Zeile stünde das Häkchen über dem Namen.
	 */
	.wahlliste label {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.6rem;
		margin: 0;
		padding: 0.15rem 0.6rem;
		min-height: var(--ziel-min);
		font-weight: 400;
		font-size: 0.95rem;
		cursor: pointer;
	}

	/* Ohne Typ im Selektor: Er steht im Template als Ausdruck (`type={…}`). */
	.wahlliste label > input {
		width: 1.2rem;
		height: 1.2rem;
		flex: none;
	}

	.zusatz {
		margin-left: 0.5rem;
		font-size: 0.85em;
		color: var(--text-leise);
	}

	.leise {
		color: var(--text-leise);
	}

	.wahlliste .leer {
		padding: 0.6rem;
		color: var(--text-leise);
	}
</style>
