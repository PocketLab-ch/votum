<script lang="ts">
	/**
	 * Die Beschlussfähigkeit als Balken statt als Satz.
	 *
	 * **Der Anlass** (Auftraggeber, 23.08.2026): «Könnte man die Beschlussfähigkeit als
	 * Gauge anzeigen? Braucht weniger Platz.» Und im Verbund je Haus — auf der
	 * Sitzungsleitung alle nebeneinander, auf der Wand die eine, die gerade dran
	 * ist.
	 *
	 * **Zwei Balken und kein Tacho.** Ein Halbkreis zeigt einen Wert; die
	 * Beschlussfähigkeit hat zwei — Kopfstimmen und Wertquoten —, und beide
	 * müssen erfüllt sein. Zwei Tachos nebeneinander brauchten mehr Platz als der
	 * Satz, den sie ersetzen sollen. Zwei schmale Balken untereinander brauchen
	 * weniger und zeigen dasselbe.
	 *
	 * **Die Schwelle ist eine Marke im Balken**, nicht seine Farbe. Wer nur die
	 * Füllung sieht, weiss nicht, ob 60 % viel oder zu wenig sind — bei einer
	 * verschärften Reglementsregel (§ 8: «mindestens drei») liegt die Schwelle
	 * ganz woanders als bei der Hälfte.
	 *
	 * **Die Zahlen bleiben.** Der Balken ist die Übersicht, nicht der Beleg; wer
	 * die Beschlussfähigkeit ins Protokoll schreibt, braucht «14 von 30». Sie
	 * stehen klein daneben statt darunter — das ist der Platz, den es spart.
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
		/** Kopfstimmen und Wertquoten, wie sie der Kern liefert. */
		bedingungen: Bedingung[];
		beschlussfaehig: boolean;
		/** Was fehlt — nur gezeigt, wenn etwas fehlt. */
		fehlt?: string;
		/** Überschrift, im Verbund der Name des Hauses. */
		titel?: string;
		/**
		 * `saal` macht die Anzeige gross genug für die Leinwand.
		 *
		 * Nicht über eine Klasse von aussen: Svelte grenzt Stilblöcke auf ihre
		 * Komponente ab, und eine Klasse, die die aufrufende Seite kennt, wirkt
		 * hier nicht.
		 */
		groesse?: 'normal' | 'saal';
	}

	let {
		bedingungen,
		beschlussfaehig,
		fehlt,
		titel,
		groesse = 'normal'
	}: Eigenschaften = $props();

	/**
	 * Wie weit der Balken gefüllt ist — und wo die Marke sitzt.
	 *
	 * **Bezugsgrösse ist das Ganze, nicht die Schwelle.** Füllte man bis zur
	 * Schwelle, stünde ein voller Balken auch dort, wo zwei von dreissig
	 * erschienen sind und die Schwelle bei zwei liegt. Der Balken soll die
	 * Beteiligung zeigen; ob sie reicht, sagt die Marke.
	 *
	 * **Das Ganze steht seit dem 11.09.2026 in der Bedingung** (Auftraggeber: «Was hier
	 * fehlt ist, von wie vielen Eigentümern man ausgeht»). Vorher behalf sich der
	 * Balken mit der grösseren von `vorhanden` und `noetig` — und war damit
	 * **voll**, sobald die Schwelle erreicht war. Bei 16 von 17 Anwesenden und
	 * neun nötigen stand ein randvoller Balken da, obwohl noch jemand fehlte.
	 * Genau die Aussage, die der Absatz darüber vermeiden will, nur in der
	 * anderen Richtung.
	 *
	 * `Math.max(…, 1)` bleibt als Schutz gegen Division durch null; und
	 * `vorhanden` kann das Ganze übersteigen, wenn eine Vollmacht mehr Quoten
	 * trägt, als der Stichtag kannte — dann füllt der Balken eben ganz.
	 */
	/**
	 * Passt der Teil ins Ganze?
	 *
	 * **Sonst kein «von»** (aus dem Code-Review, 11.09.2026). Bei den Wertquoten
	 * ist das Ganze der Nenner der Gemeinschaft; dass die erfassten Einheiten
	 * davon abweichen, lässt der Kern ausdrücklich zu und meldet es an anderer
	 * Stelle als Hinweis. Dann stünde hier «1010 von 1000» — und «X von Y» heisst
	 * im Deutschen ein Teil von einem Ganzen, der nie grösser ist als sein Ganzes.
	 * Genau dieselbe Falle hat `bedingungInWorten` im Kern schon einmal
	 * geschlossen; sie kommt mit jeder neuen Bezugsgrösse zurück.
	 */
	function passt(b: Bedingung): boolean {
		return b.gesamt > 0 && b.vorhanden <= b.gesamt;
	}

	function anteile(b: Bedingung) {
		const ganzes = Math.max(b.gesamt, b.vorhanden, b.noetig, 1);
		return {
			gefuellt: Math.min(100, (b.vorhanden / ganzes) * 100),
			marke: Math.min(100, (b.noetig / ganzes) * 100)
		};
	}
</script>

<div class="anzeige" class:saal={groesse === 'saal'} class:erfuellt={beschlussfaehig}>
	{#if titel}<p class="titel">{titel}</p>{/if}

	<p class="urteil">
		{beschlussfaehig ? 'Beschlussfähig' : 'Nicht beschlussfähig'}
	</p>

	{#each bedingungen as b (b.bezeichnung)}
		{@const a = anteile(b)}
		<div class="zeile">
			<span class="wort">{b.bezeichnung}</span>
			<!--
				`role="img"` mit `aria-label`: Der Balken ist ein Bild einer Zahl. Ohne
				die Beschriftung läse eine Vorlesehilfe zwei leere Kästen vor — die
				Zahlen daneben stehen in einem eigenen Element und ergäben ohne Bezug
				keinen Satz.
			-->
			<span
				class="balken"
				class:reicht={b.erfuellt}
				role="img"
				aria-label="{b.bezeichnung}: {passt(b)
					? `${b.vorhanden} von ${b.gesamt}`
					: b.vorhanden}, mindestens {b.noetig} nötig"
			>
				<span class="fuellung" style="width: {a.gefuellt}%"></span>
				<span class="marke" style="left: {a.marke}%"></span>
			</span>
			<!--
				**Drei Zahlen, in der Reihenfolge, in der man sie liest** (Auftraggeber,
				11.09.2026): was da ist, wovon, und was mindestens sein muss. Hier stand
				«16 / 9» — die Bezugsgrösse fehlte, und ob 16 alle sind oder fast alle,
				stand nirgends. «von» gehört dabei ans Ganze und nie an die Schwelle;
				warum, steht bei `bedingungInWorten` im Kern.
			-->
			<span class="zahlen">
				{b.vorhanden}
				{#if passt(b)}<span class="noetig">von {b.gesamt}</span>{/if}
				<span class="schwelle">mindestens {b.noetig}</span>
			</span>
		</div>
	{/each}

	{#if !beschlussfaehig && fehlt}
		<p class="fehlt">{fehlt}</p>
	{/if}
</div>

<style>
	/*
	 * Drei Spalten: Wort, Balken, Zahlen. Der Balken nimmt, was übrig bleibt —
	 * so bleibt die Anzeige in einer schmalen Kachel ebenso lesbar wie über die
	 * ganze Breite.
	 *
	 * **Das Raster gehört der Anzeige, nicht der Zeile** (06.10.2026,
	 * UI-Durchgang). Stand es je Zeile, war es für jede Zeile anders breit: am
	 * Notebook 102 px Balken neben «Eigentümer» und 157 px neben «Wertquoten»,
	 * zwei Massstäbe für dieselbe Frage. Die Zeilen übernehmen die Spuren jetzt
	 * mit `subgrid`.
	 *
	 * Und die Wortspur ist gedeckelt: Mit `auto 1fr` nahm «Stockwerkeigentümer
	 * anwesend oder vertreten» seine ganze Länge, und auf der Tafel bei 390 px
	 * blieben dem Balken 0 px. `fit-content(50%)` lässt das Wort umbrechen,
	 * sobald es mehr als die halbe Breite nähme, und die Mindestbreite am
	 * Balken hält ihn auch dann sichtbar, wenn nichts mehr übrig bleibt.
	 */
	.anzeige {
		column-gap: 0.5rem;
		display: grid;
		grid-template-columns: fit-content(50%) minmax(3rem, 1fr) auto;
		row-gap: 0.3rem;
	}

	.titel,
	.urteil,
	.fehlt {
		grid-column: 1 / -1;
	}

	.titel {
		font-weight: 600;
		margin: 0;
	}

	.urteil {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0;
	}

	.anzeige.erfuellt .urteil {
		/* `--akzent` ist die «gut»-Farbe des Hauses (so färbt auch `Meldung`
		   mit `ton="gut"`); ein eigenes `--gut` gibt es nicht. */
		color: var(--akzent);
	}

	.zeile {
		align-items: center;
		display: grid;
		font-size: 0.85rem;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
	}

	/*
	 * Unter rund 385 px Fensterbreite passt «Stockwerkeigentümer» nicht mehr
	 * ganz neben Balken und Zahlen; ohne Umbruch ragte die Anzeige bei 320 px
	 * 30 px hinaus. Getrennt wird dann nach Silben («Stockwerk-eigentümer»),
	 * und nur wo keine Silbentrennung greift, mitten im Wort. Kurze Wörter
	 * wie «anwesend» bleiben ganz (`hyphenate-limit-chars`).
	 */
	.wort {
		color: var(--text-leise);
		hyphenate-limit-chars: 12 5 5;
		hyphens: auto;
		min-width: 0;
		overflow-wrap: break-word;
	}

	.balken {
		background: var(--flaeche-2);
		border-radius: 999px;
		display: block;
		height: 0.5rem;
		overflow: hidden;
		position: relative;
	}

	.fuellung {
		background: var(--text-leise);
		display: block;
		height: 100%;
	}

	.balken.reicht .fuellung {
		background: var(--akzent);
	}

	/*
	 * Die Schwellenmarke sitzt IM Balken und ragt oben und unten hinaus, damit
	 * sie auch dort zu sehen ist, wo die Füllung sie überdeckt. `overflow: hidden`
	 * am Balken würde sie beschneiden — deshalb liegt sie als eigener Strich
	 * darüber, mit `inset` statt `top/bottom`.
	 */
	.marke {
		background: var(--text);
		bottom: -2px;
		position: absolute;
		top: -2px;
		width: 2px;
	}

	.zahlen {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.schwelle {
		display: block;
		font-size: 0.82em;
		color: var(--text-leise);
		font-variant-numeric: tabular-nums;
	}

	.noetig {
		color: var(--text-leise);
	}

	.fehlt {
		color: var(--text-leise);
		font-size: 0.85rem;
		margin: 0.15rem 0 0;
	}

	/* Für die Leinwand: dieselbe Anzeige, aus der letzten Reihe lesbar. */
	.anzeige.saal {
		column-gap: 0.75rem;
	}

	.anzeige.saal .zeile {
		font-size: clamp(1rem, 1.8vw, 1.6rem);
	}

	.anzeige.saal .balken {
		height: 0.9rem;
	}

	.anzeige.saal .urteil {
		font-size: clamp(1.1rem, 2vw, 1.8rem);
	}
</style>
