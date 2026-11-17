<script lang="ts">
	import { untrack } from 'svelte';
	import { datumLang } from '$lib/domain/datum';
	import Saalbild from '$lib/components/Saalbild.svelte';
	import Vollbildecke from '$lib/components/Vollbildecke.svelte';
	import Beschlussfaehigkeitsanzeige from '$lib/components/Beschlussfaehigkeitsanzeige.svelte';
	import { nachzieher } from '$lib/components/neuladen';
	import type { Stromnachricht } from '$lib/server/ereignisstrom';

	let { data } = $props();

	/**
	 * Der laufende Stand über den Ereignisstrom.
	 *
	 * Er trägt ausschliesslich Zahlen (AD-11). Namen stehen auf dieser Seite
	 * nirgends — sie hängt an der Wand, und ein Anwesenheitsstand mit Namen wäre
	 * eine Anwesenheitsliste im Saal.
	 */
	// Bewusst nur der Anfangswert: Ab dem ersten Beitrag führt der Strom.
	let stand = $state<Stromnachricht | null>(untrack(() => data.stand));
	let verbunden = $state(false);

	$effect(() => {
		const quelle = new EventSource(`/versammlungen/${data.versammlung.id}/strom`);
		quelle.onopen = () => (verbunden = true);
		quelle.onerror = () => (verbunden = false);
		quelle.onmessage = (e) => {
			stand = JSON.parse(e.data) as Stromnachricht;
			verbunden = true;
		};
		return () => quelle.close();
	});

	/**
	 * Wechselt das aufgerufene Traktandum, muss die Seite neu laden.
	 *
	 * Der Strom meldet nur die Kennung — den Inhalt holt die Seite vom Server.
	 * Ihn mitzuschicken hiesse, Traktandentexte über einen Weg zu schicken, der
	 * ausdrücklich nur Zahlen trägt.
	 */
	/**
	 * Hinkt die Wand hinterher, obwohl der Strom lebt?
	 *
	 * **Zwei Eingänge, eine Zeile** (Produktentscheid 10.09.2026). Der Hinweis
	 * unten hing bis hierher allein am Ereignisstrom. Wer im Saalnetz nur den
	 * Abrufweg sperrt, lässt den Strom leben: Die Wand meldet sich als verbunden,
	 * die Zahlen stehen still, und ausgerechnet der Satz, der davor warnt, wird
	 * nicht gezeigt. Gemessen am 09.09.2026 in `e2e/netzunterbruch.mjs`, indem
	 * nur `/robots.txt` blockiert wurde.
	 *
	 * **Kein gemeinsamer Schalter.** Beide Ursachen in ein `verbunden` zu
	 * schreiben hiesse, dass der nächste Herzschlag des Stroms die Warnung
	 * löscht, während der Abrufweg weiter tot ist. Genau diese Bauform hat den
	 * Befund erzeugt.
	 */
	let hinterher = $state(false);

	/*
	 * **Ein Nachzieher, eine zusammengesetzte Marke** (09.09.2026) — dieselbe
	 * Bauform wie am Telefon und auf `/p`.
	 *
	 * Darin stecken drei Anlässe, und alle drei haben denselben Grund: Der Strom
	 * führt ausschliesslich Zahlen und Kennungen (AD-11), den Wortlaut holt die
	 * Seite vom Server.
	 *
	 *   · **Der Zustand.** Das Schliessen der Versammlung wechselt kein
	 *     Traktandum. Ohne ihn hinge an der Wand nach dem Ende weiter das letzte
	 *     Geschäft, als liefe die Versammlung noch. Hier stand bis heute ein
	 *     `location.reload()`; kippt das Netz dabei, bleibt die Wand auf
	 *     Chromiums Fehlerseite stehen.
	 *   · **Das aufgerufene Traktandum**, dessen Wortlaut der Strom nicht trägt.
	 *   · **Das Wandbild** (Migration 035), aus demselben Grund.
	 *   · **Die Unterbrechung** — und die fehlte hier bis zum 10.09.2026 ganz.
	 *     Diese Wand zeigt `data.versammlung.pause`, und nichts erneuerte `data`,
	 *     wenn die Sitzungsleitung unterbrach: An der Leinwand stand weiter das
	 *     Traktandum, während im Saal Pause war. Für `/p` wurde dieselbe Lücke
	 *     am 22.08.2026 geschlossen, hier nie. Gefunden hat es der Durchstich
	 *     `e2e/netzunterbruch.mjs` beim allerersten Lauf.
	 *
	 * Abstimmung und Ergebnis stehen dagegen **in** der Nachricht und brauchen
	 * keinen Nachzug.
	 */

	const nach = nachzieher(
		untrack(() =>
			[
				data.versammlung.zustand,
				data.versammlung.aktuellesTraktandumId ?? '-',
				data.stand?.wandbild ?? '-',
				data.versammlung.pause?.seit ?? '-',
				data.stand?.zurueckgezogenAm ?? '-'
			].join('|')
		),
		{},
		(r) => (hinterher = r)
	);
	// Der Nachzieher hängt sich für die Lebensdauer der Seite an das Fenster;
	// hier wird er wieder abgemeldet.
	$effect(() => nach.ende);

	$effect(() => {
		if (!stand) return;
		nach.jetzt(
			[
				stand.zustand ?? data.versammlung.zustand,
				stand.aktuellesTraktandumId ?? '-',
				stand.wandbild ?? '-',
				stand.pause ?? '-',
				stand.zurueckgezogenAm ?? '-'
			].join('|')
		);
	});
</script>

<svelte:head>
	<title>{data.gemeinschaftName} — Präsentation</title>
</svelte:head>

<div class="buehne">
	<header>
		<p class="gemeinschaft">{data.gemeinschaftName}</p>
		<p class="wann">{datumLang(data.versammlung.datum)} · {data.versammlung.ort}</p>
		<!--
			**Zwei Eingänge, ein Satz.** Der Strom ist der eine, der Abrufweg der
			andere; wen im Saal interessiert, welche Leitung gerissen ist? Ein
			zweites Zeichen daneben wäre eine Zeile mit zwei Aussagen.
		-->
		{#if !verbunden || hinterher}
			<!--
				**Die Marke sagt, welcher Eingang es war**, und zwar für den
				Durchstich (10.09.2026, im Code-Review gefunden). Der Satz hängt an
				zwei Ursachen; eine Probe, die nur ihn sieht, kann aus dem falschen
				Grund grün sein — etwa wenn der Strom längst tot ist und der
				Rückstand gar nichts beigetragen hat. Für den Zuschauer ändert die
				Marke nichts, sie steht nicht im Text.
			-->
			<p class="getrennt" data-grund={hinterher ? 'rueckstand' : 'strom'}>
				Verbindung unterbrochen — die Zahlen können veraltet sein.
			</p>
		{/if}
	</header>

	<!--
		**Beim Punkt, der sie zum Gegenstand hat, füllt sie die Wand**
		(28.08.2026, wie am gemeinsamen Abend). Sonst steht sie unten in der
		Fusszeile.

		**Als Baustein an `Saalbild`, nicht davor** (01.09.2026): Dort hat sie
		ihren Platz in der Rangfolge. Stand sie davor, ersetzte sie auch Pause und
		Abschluss.
	-->
	{#snippet beschlussfaehigkeitsbild()}
		<Beschlussfaehigkeitsanzeige
			bedingungen={stand!.bedingungen}
			beschlussfaehig={stand!.beschlussfaehig}
			titel={data.gemeinschaftName}
			groesse="saal"
		/>
	{/snippet}

	<Saalbild
		abstimmung={stand?.abstimmung ?? null}
		aufgerufen={data.aktuelles ?? null}
		traktanden={data.traktanden}
		wandbild={data.versammlung.wandbild ?? null}
		pause={data.versammlung.pause ?? null}
		abschluss={data.abschluss}
		beschlussfaehigkeit={data.beschlussfaehigkeitImVordergrund && stand?.bedingungen.length
			? beschlussfaehigkeitsbild
			: null}
		anlass={{
			gemeinschaft: data.gemeinschaftName,
			wann: `${datumLang(data.versammlung.datum)}, ${data.versammlung.uhrzeit} Uhr`,
			ort: data.versammlung.ort
		}}
	/>

	<!--
		**Der Weg zurück, ohne die Wand zu stören.**

		Die Saalsicht öffnet als eigenes Fenster; dort gibt es keine Zurück-Taste,
		weil es keine Vorgeschichte gibt, und der Kopf ist bewusst weg. Wer sie am
		eigenen Gerät als Reiter offen hat, sass damit fest. Gemeldet am 02.08.2026.

		Der Verweis liegt unsichtbar in der Ecke und erscheint, sobald jemand die
		Maus bewegt oder den Bildschirm berührt — wie die Bedienelemente eines
		Videos. Nach vier Sekunden Ruhe verschwindet er wieder. An der Wand
		bewegt sich nichts, also sieht ihn dort niemand.
	-->
	<Vollbildecke>
		{#snippet weitere()}
			<a class="knopf" href="/versammlungen/{data.versammlung.id}/leitung">Zur Sitzungsleitung</a>
		{/snippet}
	</Vollbildecke>

	<footer>
		{#if stand}
			<div class="zahlen" class:ja={stand.beschlussfaehig}>
				<p class="marke">
					{stand.beschlussfaehig ? 'Beschlussfähig' : 'Nicht beschlussfähig'}
				</p>
				<p class="werte">
					<span><strong>{stand.anzahlAnwesend}</strong> von {stand.anzahlGesamt} Parteien</span>
					<span
						><strong>{stand.kopfstimmenAnwesend}</strong> von {stand.kopfstimmenGesamt} Kopfstimmen</span
					>
					<span><strong>{stand.quotenAnwesend}</strong> von {stand.gesamtquote} Wertquoten</span>
				</p>
			</div>
		{/if}

		{#if data.einstiegSvg}
			<div class="einstieg">
				<!-- Eigenes Erzeugnis: `qrcode` baut das SVG aus unserer eigenen Adresse. -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="qr">{@html data.einstiegSvg}</div>
				<div class="wortlaut">
					<p class="frage">Ohne Karte da?</p>
					<p class="weg">Scannen, Namen angeben, freigeben lassen.</p>
				</div>
			</div>
		{/if}
	</footer>
</div>

<style>
	/* Die Präsentationssicht sprengt das Seitenlayout bewusst: Sie füllt den
	   Bildschirm, weil sie aus zehn Metern lesbar sein muss. */
	.buehne {
		position: fixed;
		inset: 0;
		background: var(--grund);
		color: var(--text);
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 1rem;
		padding: 2vh 3vw;
		overflow: hidden;
	}

	header {
		display: flex;
		align-items: baseline;
		gap: 1.5rem;
		flex-wrap: wrap;
		color: var(--text-leise);
		font-size: clamp(0.9rem, 1.4vw, 1.3rem);
	}

	.gemeinschaft {
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}

	.wann {
		margin: 0;
	}

	.getrennt {
		margin: 0;
		margin-left: auto;
		color: var(--warnung);
		font-weight: 600;
	}











	footer {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.zahlen {
		border-top: 0.25em solid var(--fehler);
		padding-top: 0.6rem;
		flex: 1 1 24rem;
	}

	.zahlen.ja {
		border-color: var(--akzent);
	}

	.marke {
		margin: 0 0 0.2em;
		font-size: clamp(1.1rem, 2.2vw, 2rem);
		font-weight: 700;
	}

	.werte {
		display: flex;
		gap: 1.5em;
		flex-wrap: wrap;
		margin: 0;
		font-size: clamp(0.9rem, 1.6vw, 1.5rem);
		color: var(--text-leise);
		font-variant-numeric: tabular-nums;
	}

	.werte strong {
		color: var(--text);
	}

	/*
	 * QR und Text als ein Block, nicht als Bild mit Beschriftung daneben.
	 *
	 * Gemeinsame Grundlinie unten: Der QR ist ein Quadrat, der Text zwei Zeilen —
	 * bei `center` schwebte der Text in der Mitte des Quadrats und der Block
	 * franste unten aus, während die Zahlen daneben sauber auf der Kante stehen.
	 */
	.einstieg {
		display: flex;
		align-items: end;
		gap: 0.9rem;
	}

	.wortlaut {
		display: flex;
		flex-direction: column;
		gap: 0.15em;
		max-width: 24ch;
		padding-bottom: 0.2rem;
	}

	.einstieg p {
		margin: 0;
		line-height: 1.25;
	}

	.frage {
		font-size: clamp(0.95rem, 1.5vw, 1.35rem);
		font-weight: 600;
	}

	/* Die Anleitung tritt zurück: Wer die Frage bejaht, liest sie ohnehin. */
	.weg {
		font-size: clamp(0.8rem, 1.15vw, 1rem);
		color: var(--text-leise);
	}

	.qr {
		width: clamp(5rem, 9vw, 9rem);
		/* themenfest: Der QR-Code braucht Weiss, damit ihn jede Kamera liest. */
		background: #fff;
		padding: 0.4rem;
		border-radius: 0.4rem;
		line-height: 0;
	}

	.qr :global(svg) {
		width: 100%;
		height: auto;
		display: block;
	}


	/*
	 * Oben rechts, nicht unten links (20.08.2026).
	 *
	 * Dort lag er über der Beschlussfähigkeitszeile — auf einem breiten Schirm
	 * genau auf «10 von 14 Parteien». Er erscheint zwar nur auf Mausbewegung,
	 * aber genau dann liest jemand die Zahlen. Oben rechts ist die einzige Ecke,
	 * die dauerhaft leer bleibt: Links steht das Traktandum, unten die Zahlen,
	 * rechts unten der QR-Code für den Einstieg ohne Karte.
	 */
</style>
