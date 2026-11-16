<script lang="ts">
	import Beschlussfaehigkeitsanzeige from '$lib/components/Beschlussfaehigkeitsanzeige.svelte';
	import { page } from '$app/state';
	/**
	 * Der Stand im Saal — eine Karte je Gemeinschaft.
	 *
	 * Vorher eine Tabelle mit sieben Spalten, in der drei davon je nach Zustand
	 * durch eine einzige ersetzt wurden. Eine Karte trägt dieselbe Auskunft und
	 * bricht nicht: Wer nicht freigegeben ist, hat keine Zahlen — dann steht das
	 * da, statt dass die Spalten verrutschen.
	 */
	import Karte from '$lib/components/Karte.svelte';
	import { zustandsname } from '$lib/domain/versammlung';

	let { data } = $props();

	const laufend = $derived(data.tafel.filter((z) => z.zustand === 'laufend').length);
</script>

<h1>Wie steht es im Saal?</h1>

<!--
	**Der Untertitel nennt den Zweck** (Auftraggeber, 23.08.2026). Der Ablauf führt
	hierher unter «Tafel im Saal», die Seite heisst «Wie steht es im Saal?» —
	dass dies zugleich der Einstieg in die einzelnen Sitzungsleitungen ist, stand
	nirgends. Wer beide Gemeinschaften führt, arbeitet von hier aus.
-->
<p class="einleitung">
	Jede Gemeinschaft tagt für sich — eigene Beschlussfähigkeit, eigene Beschlüsse. Von hier führen
	Sie die eine oder die andere.
</p>

{#if data.tafel.length === 0}
	<p class="leer">Noch tagt keine Gemeinschaft mit.</p>
{:else}
	<p class="wessen">
		{#if laufend === 0}
			Noch läuft keine Versammlung. Die Zahlen entstehen mit der Freigabe.
		{:else}
			{laufend} von {data.tafel.length} laufen gerade.
		{/if}
	</p>

	<div class="kacheln">
		{#each data.tafel as z (z.meetingId)}
			<!--
				**Je Haus ein Balkenpaar** (Auftraggeber, 23.08.2026): «Im Verbund müsste die
				Beschlussfähigkeit pro Einheit angezeigt werden.»

				Vorher stand hier ein Satz aus vier Zahlen — «14 von 30 Köpfen · 512
				von 1000 Wertquoten». Was fehlte, war die **Schwelle**: Wie viele es
				braucht, stand nirgends, und bei einer verschärften Reglementsregel
				liegt sie ganz woanders als bei der Hälfte. Der Balken zeigt sie als
				Marke, und bei drei, vier Häusern nebeneinander sieht man mit einem
				Blick, welches noch fehlt.

				Der Satz «Beschlussfähig / Nicht beschlussfähig» wandert in die
				Anzeige; die Karte behält den Namen des Hauses und ihre Erklärung.
			-->
			<Karte
				titel={z.gemeinschaft}
				antwort={z.beschlussfaehig ? undefined : 'Noch keine Zahlen.'}
				zusatz={z.beschlussfaehig ? undefined : 'Die Versammlung ist noch nicht freigegeben.'}
			>
				{#if z.beschlussfaehig}
					<Beschlussfaehigkeitsanzeige
						bedingungen={z.beschlussfaehig.bedingungen}
						beschlussfaehig={z.beschlussfaehig.erfuellt}
						fehlt={z.beschlussfaehig.fehlt}
					/>
				{/if}
				{#snippet erklaerung()}
					<p>
						Zustand: {zustandsname(z.zustand)}.
						{#if z.beschlussfaehig}
							Gerechnet nach {z.beschlussfaehig.grundlage === 'reglement'
								? 'der Schwelle aus dem Reglement dieser Gemeinschaft'
								: 'der gesetzlichen Schwelle (ZGB Art. 712p)'}. Jede Gemeinschaft rechnet mit
							ihrer eigenen — eine gemeinsame Zahl über alle gäbe es nicht.
						{/if}
						{#if z.offeneTraktanden > 0}
							Noch {z.offeneTraktanden}
							{z.offeneTraktanden === 1 ? 'Traktandum' : 'Traktanden'} ohne Ergebnis.
						{/if}
					</p>
				{/snippet}
				{#snippet fuss()}
					<a href="/versammlungen/{z.meetingId}/leitung">Sitzung leiten</a>
				{/snippet}
			</Karte>
		{/each}
	</div>

	<!--
		**Eingegriffen wird beim Einlass, nicht hier** (Auftraggeber, 24.08.2026).

		Zuerst standen die Handlungen an der Tafel: je Haus ein Ausklapper mit
		Verlassen, Code ausgeben, Gerät abmelden. Dann kam der Satz, worauf es
		ankommt — «Ich muss beim Einlass das Checkin machen, ohne dass ich in 5
		STWEG hin und her springen muss» — und damit war klar, dass die Liste
		dorthin gehört, wo am Eingang gearbeitet wird.

		Zwei Tabellen für dieselbe Sache wären der häufigste Fehler dieses
		Werkzeugs gewesen: Eine davon läuft der anderen früher oder später
		hinterher. Die Tafel zeigt den Stand und führt hin.
	-->
	<p class="weg">
		<a href="/tage/{page.params.id}/einlass">Anwesenheit ändern, Codes ausgeben</a>
	</p>
{/if}

<style>
	.wessen {
		color: var(--text-leise);
		margin: 0 0 0.75rem;
	}

	.leer {
		color: var(--text-leise);
	}
	.einleitung {
		margin-top: -0.35rem;
	}
</style>
