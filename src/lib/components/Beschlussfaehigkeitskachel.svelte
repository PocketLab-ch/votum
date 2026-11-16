<script lang="ts">
	/**
	 * Die Beschlussfähigkeit einer Gemeinschaft auf einem Quadrat.
	 *
	 * **Der Anlass** (Auftraggeber, 24.08.2026): «Bekommt man die STWEG-Beschlussfähigkeit
	 * je auf ein Quadrat? Es müsste ja nur der Name stehen, ein Balken grün mit
	 * Zahl — rot, wenn nicht erreicht. Das wäre hilfreich, wenn bspw. 7 STWEG an
	 * einer Versammlung wäre.»
	 *
	 * `Beschlussfaehigkeitsanzeige` bleibt, was sie ist: die ausführliche Sicht
	 * mit einer Zeile je Bedingung, für die Leitung eines einzelnen Hauses und die
	 * Wand einer einzelnen Versammlung. Bei sieben Gemeinschaften nebeneinander
	 * braucht sie zu viel Breite — «Wertquoten anwesend oder vertreten» ist länger
	 * als die ganze Kachel.
	 *
	 * **Ein Balken, nicht zwei.** Beschlussfähig ist eine Gemeinschaft nur, wenn
	 * ALLE Bedingungen erfüllt sind — der Balken zeigt deshalb die **knappste**:
	 * Sie entscheidet. Die Zahlen aller Bedingungen stehen darunter, damit die
	 * Auskunft vollständig bleibt.
	 *
	 * **Die Farbe sagt das Urteil, nicht der Balken die Farbe.** Grün heisst
	 * beschlussfähig, rot heisst nicht. Ein grüner Balken bei roter Kachel wäre
	 * die verwirrendste aller Anzeigen.
	 */
	interface Bedingung {
		bezeichnung: string;
		noetig: number;
		vorhanden: number;
		/** Das Ganze — alle Eigentümer, alle Wertquoten. Siehe `domain/beschlussfaehigkeit`. */
		gesamt: number;
		erfuellt: boolean;
	}

	interface Eigenschaften {
		name: string;
		bedingungen: Bedingung[];
		beschlussfaehig: boolean;
		/** `saal` macht die Kachel gross genug für die Leinwand. */
		groesse?: 'normal' | 'saal';
	}

	let { name, bedingungen, beschlussfaehig, groesse = 'normal' }: Eigenschaften = $props();

	/** Wie weit eine Bedingung erfüllt ist — 1 heisst «genau die Schwelle». */
	function grad(b: Bedingung): number {
		return b.noetig > 0 ? b.vorhanden / b.noetig : b.vorhanden > 0 ? Infinity : 0;
	}

	/** Die knappste Bedingung — sie entscheidet über die Beschlussfähigkeit. */
	const knappste = $derived(
		bedingungen.length > 0
			? bedingungen.reduce((a, b) => (grad(b) < grad(a) ? b : a))
			: null
	);

	/**
	 * Wie weit der Balken gefüllt ist und wo die Schwelle sitzt.
	 *
	 * Bezugsgrösse ist das Ganze, nicht die Schwelle: Füllte man bis zur
	 * Schwelle, stünde ein voller Balken auch dort, wo zwei von dreissig
	 * erschienen sind und die Schwelle bei zwei liegt.
	 */
	const anteile = $derived.by(() => {
		if (!knappste) return { gefuellt: 0, marke: 0 };
		// Das Ganze seit dem 11.09.2026 aus der Bedingung; vorher war der Balken
		// voll, sobald die Schwelle erreicht war. Siehe `Beschlussfaehigkeitsanzeige`.
		const ganzes = Math.max(knappste.gesamt, knappste.vorhanden, knappste.noetig, 1);
		return {
			gefuellt: Math.min(100, (knappste.vorhanden / ganzes) * 100),
			marke: Math.min(100, (knappste.noetig / ganzes) * 100)
		};
	});

	/**
	 * «Stockwerkeigentümer anwesend oder vertreten» → «Eigentümer». Auf der Kachel
	 * zählt das Wort, nicht der Satz.
	 *
	 * **Das erste Wort genügt nicht mehr** (26.08.2026). Seit die Bedingung
	 * Personen zählt, heisst es «Stockwerkeigentümer» — neunzehn Zeichen ohne
	 * Trennstelle, in einer Kachel, die es genau deswegen gibt, dass lange
	 * Beschriftungen sie nicht sprengen. Im Saal steht ohnehin der Name der
	 * Gemeinschaft darüber; «Eigentümer» ist dort eindeutig.
	 */
	function kurz(bezeichnung: string): string {
		const wort = bezeichnung.split(' ')[0];
		return wort === 'Stockwerkeigentümer' ? 'Eigentümer' : wort;
	}
</script>

<article class="kachel" class:saal={groesse === 'saal'} class:erfuellt={beschlussfaehig}>
	<h4>{name}</h4>

	{#if knappste}
		<span
			class="balken"
			role="img"
			aria-label="{beschlussfaehig ? 'Beschlussfähig' : 'Nicht beschlussfähig'} — {kurz(
				knappste.bezeichnung
			)}: {knappste.gesamt > 0 && knappste.vorhanden <= knappste.gesamt
				? `${knappste.vorhanden} von ${knappste.gesamt}`
				: knappste.vorhanden}, mindestens {knappste.noetig} nötig"
		>
			<span class="fuellung" style="width: {anteile.gefuellt}%"></span>
			<span class="marke" style="left: {anteile.marke}%"></span>
		</span>

		<ul>
			{#each bedingungen as b (b.bezeichnung)}
				<li class:knapp={b === knappste}>
					<span class="wort">{kurz(b.bezeichnung)}</span>
					<!--
						**Zwei Zahlen, nicht drei** (aus dem Code-Review, 11.09.2026). Die
						ausführliche Anzeige nennt auch die Schwelle; hier ist der Platz eine
						Kachel neben sechs anderen, und «623/1000·500» in einem Element ohne
						Umbruch sprengt sie. Die Schwelle steht als Marke im Balken darüber —
						dafür gibt es sie.

						Das Ganze statt der Schwelle als zweite Zahl: Die Frage des Auftraggebers war «von wie
						vielen gehen wir aus», und die beantwortet nur das Ganze.
					-->
					<span class="zahlen"
						>{b.vorhanden}{#if b.gesamt > 0 && b.vorhanden <= b.gesamt}<span class="noetig"
								>/{b.gesamt}</span
							>{/if}</span
					>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="leer">noch keine Zahlen</p>
	{/if}
</article>

<style>
	/*
	 * Quadratisch, damit sieben nebeneinander passen: Die Kachel wächst in der
	 * Breite mit dem Raster, die Höhe folgt dem Inhalt und bleibt gleich — sieben
	 * verschieden hohe Kacheln lesen sich schlechter als sieben gleiche.
	 */
	.kachel {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche-2);
		/* Der farbige Streifen links ist das Urteil — auch aus zehn Metern und
		   auch für Augen, die Rot und Grün schlecht unterscheiden (die Zahlen
		   stehen daneben). */
		border-left: 4px solid var(--warnung);
	}

	.kachel.erfuellt {
		border-left-color: var(--akzent);
	}

	h4 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.25;
		/* Ein langer Gemeinschaftsname darf umbrechen, aber die Kachel nicht
		   sprengen. */
		overflow-wrap: anywhere;
	}

	.balken {
		position: relative;
		display: block;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--flaeche);
		overflow: hidden;
	}

	.fuellung {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--warnung);
	}

	.kachel.erfuellt .fuellung {
		background: var(--akzent);
	}

	.marke {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--text);
		opacity: 0.55;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		font-size: 0.8rem;
		color: var(--text-leise);
	}

	li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}

	/* Die knappste Bedingung ist die, die der Balken zeigt — sie steht deutlicher. */
	li.knapp .zahlen {
		color: var(--text);
		font-weight: 600;
	}

	.zahlen {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.noetig {
		color: var(--text-leise);
		font-weight: 400;
	}

	.leer {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-leise);
	}

	/* Für die Leinwand: alles eine Stufe grösser, aus zehn Metern lesbar. */
	.kachel.saal {
		padding: 0.8rem 1rem;
		gap: 0.5rem;
	}

	.kachel.saal h4 {
		font-size: clamp(1rem, 1.6vw, 1.6rem);
	}

	.kachel.saal .balken {
		height: 0.8rem;
	}

	.kachel.saal ul {
		font-size: clamp(0.8rem, 1.2vw, 1.2rem);
	}
</style>
