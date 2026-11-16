<script lang="ts">
	/**
	 * Zeichen und Name der Anwendung: **Votum**.
	 *
	 * **Der Name** (Produktentscheid 22.08.2026). «Votum» ist das Wort, das im
	 * Saal ohnehin fällt — «Wortmeldung, Votum». Es wird auf Deutsch richtig
	 * ausgesprochen, ist kurz, international lesbar und trotzdem kein
	 * Anglizismus. Die Kandidaten mit «vote» im Namen scheiterten daran, dass
	 * «Vo» im Deutschen zu «Fo» wird: «Fo-Tuul» am Telefon nennt niemand gern.
	 *
	 * **Das Zeichen** ist die Urne mit dem Zettel im Einwurf. Der Zettel liegt
	 * schräg — er ist unterwegs hinein, nicht abgelegt; das ist der Augenblick,
	 * um den sich die ganze Anwendung dreht. Seine zwei Zeilen sind ungleich
	 * lang: Auch dort schwingt die Wertquote mit, die diese Abstimmung von jeder
	 * anderen unterscheidet.
	 *
	 * **Inline und nicht als `<img>`**, damit `currentColor` greift: Das Zeichen
	 * nimmt die Farbe seiner Umgebung an und steht damit auf hellem wie auf
	 * dunklem Grund richtig. Der Einwurfschlitz ist eine Aussparung in der Farbe
	 * des Grundes — auch die wechselt mit dem Modus.
	 */
	interface Eigenschaften {
		/** Nur das Zeichen, ohne den Namen — für enge Stellen. */
		nurZeichen?: boolean;
	}

	let { nurZeichen = false }: Eigenschaften = $props();
</script>

<span class="marke" class:mitname={!nurZeichen}>
	<svg class="zeichen" viewBox="0 0 64 64" aria-hidden="true">
		<!-- Der Zettel liegt schräg: Er ist im Einwurf, nicht abgelegt. -->
		<g fill="currentColor">
			<g transform="rotate(-12 32 18)">
				<rect x="21" y="4" width="22" height="24" rx="3" opacity="0.38" />
				<rect x="25" y="10" width="14" height="3" rx="1.5" />
				<rect x="25" y="16" width="10" height="3" rx="1.5" />
			</g>
			<rect x="10" y="28" width="44" height="30" rx="5" />
		</g>
		<rect x="20" y="32" width="24" height="4" rx="2" fill="var(--grund)" />
	</svg>
	{#if !nurZeichen}<span class="wort">Votum</span>{/if}
</span>

<style>
	/*
	 * **Die Marke trägt ihre eigene Farbe**, nicht die des Textes. In der
	 * Kopfzeile stand sie zuerst in Schwarz und wirkte dort wie ein Fremdkörper
	 * — ein schwerer Kasten neben leichter Schrift. Der Akzent bindet sie an die
	 * Anwendung und hebt sie zugleich von der Navigation ab.
	 */
	.marke {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--akzent);
	}

	.zeichen {
		width: 1.5em;
		height: 1.5em;
		flex: none;
	}

	.wort {
		font-weight: 650;
		letter-spacing: -0.01em;
	}
</style>
