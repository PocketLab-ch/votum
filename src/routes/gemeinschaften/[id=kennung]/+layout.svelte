<script lang="ts">
	/**
	 * Die zweite Ebene einer Gemeinschaft — dasselbe Muster wie bei der
	 * Versammlung, an derselben Stelle (Story 6.7).
	 *
	 * **Zwei Leisten, eine Regel: Die Leiste zeigt die Arbeit, nicht den Ort.**
	 *
	 * Kommt man aus einer Versammlung (Kennung im Abfrageteil), führt weiterhin
	 * ihr Ablauf — dieselbe Leiste wie auf den Versammlungsseiten, aus demselben
	 * Aufbau. Zwei Schritte der Vorbereitung liegen nun einmal hier, und wer sie
	 * anklickt, bereitet aus seiner Sicht weiterhin dieselbe Versammlung vor. Die
	 * Bereiche der Gemeinschaft stehen dann darunter, damit nichts unerreichbar
	 * wird.
	 *
	 * Ohne Versammlung ist die Gemeinschaft die Sache: Bereiche statt Schritte,
	 * ohne Zustand und ohne Fortschrittsband — ein Häkchen an «Einheiten» hiesse,
	 * die Gemeinschaft sei irgendwann fertig.
	 */
	import Abendregister from '$lib/components/Abendregister.svelte';
	import Seitenleiste from '$lib/components/Seitenleiste.svelte';
	import Weiterweg from '$lib/components/Weiterweg.svelte';
	import { abendregister } from '$lib/domain/register';
	import { page } from '$app/state';
	import {
		ablaufgruppen,
		gemeinschaftsgruppen,
		mitHerkunft,
		ohneDoppelte
	} from '$lib/components/ablaufleiste';
	import { zustandsname } from '$lib/domain/versammlung';
	import type { Leistengruppe } from '$lib/components/seitenleiste';

	let { children, data } = $props();

	const g = $derived(data.rahmenGemeinschaft);
	const a = $derived(data.ablauf);

	/*
	 * **Ein Zwischenschritt, den die Seite liefert** (UI-Durchgang 06.10.2026).
	 * Eine Seite unterhalb eines Bereichs (heute nur die einzelne
	 * Eigentümerzeile) nennt ihren Bereich über `pfadschritt` in ihren Daten.
	 * Vorher setzte sie dafür eine eigene Pfadzeile unter diese, und die Brotkrume
	 * stand zweizeilig ohne Trenner da. Seiten ohne `pfadschritt` bleiben, wie
	 * sie sind. Steht die Herkunft `?zur=` in der Adresse, trägt der Schritt sie
	 * weiter wie die Schritte der Leiste. Die Verweise auf die Parteiseite
	 * reichen sie heute nicht mit (Code-Review 06.10.2026); ohne sie lautet der
	 * Weg «Gemeinschaften · Eigentümer und Stimmkraft», den Namen der
	 * Gemeinschaft nennt dann die Leiste.
	 */
	const pfadschritt = $derived(
		page.data.pfadschritt as { titel: string; pfad: string } | undefined
	);

	/*
	 * Der Weg kommt aus `page`, nicht aus den Daten: Das Layout bleibt beim
	 * Wechsel des Reiters stehen, nur der Weg ändert sich. Aus den Daten
	 * abgeleitet zeigte die Leiste noch das vorige Thema.
	 */
	const register = $derived(
		abendregister({ pfad: page.url.pathname, haeuser: data.abendhaeuser })
	);

	/** Die Schritte tragen die Herkunft weiter, sonst bricht der Weg beim nächsten ab. */
	const ablaufschritte = $derived(
		a ? a.schritte.map((s) => ({ ...s, pfad: mitHerkunft(s.pfad, a.versammlungId) })) : []
	);

	const gruppen = $derived.by<Leistengruppe[]>(() => {
		if (!a)
			return gemeinschaftsgruppen(
				g.id,
				data.offeneVersammlungen,
				data.stammdatenluecken,
				data.klammer
			);

		const ablauf = ablaufgruppen({
			versammlungId: a.versammlungId,
			versammlungszustand: a.zustand,
			schritte: a.schritte,
			mitgliedsgemeinschaften: a.mitgliedsgemeinschaften
		});

		// Erreichbar bleiben muss alles — aber nachrangig, denn hierher kam man
		// wegen der Versammlung. Und nur einmal: Was der Ablauf schon führt, fällt
		// aus den Bereichen weg.
		// Die offenen Abende bleiben hier weg: Der Ablauf führt schon einen, und
		// zwei Wege zur selben Sache in einer Leiste sind einer zu viel.
		const uebrige = ohneDoppelte(gemeinschaftsgruppen(g.id), ablauf).flatMap((x) => x.punkte);
		return uebrige.length > 0
			? [...ablauf, { titel: 'Diese Gemeinschaft', punkte: uebrige }]
			: ablauf;
	});
</script>

<div class="bahn">
	<!--
		Kopf und Beschriftung folgen der Leiste: Führt der Ablauf, steht oben die
		Versammlung samt Fortschritt — sonst die Gemeinschaft. Ein Kopf, der etwas
		anderes nennt als die Liste darunter, wäre schlimmer als gar keiner.
	-->
	<Seitenleiste
		beschriftung={a ? 'Ablauf der Versammlung' : 'Bereiche der Gemeinschaft'}
		gegenstand={a ? a.titel : g.name}
		unterzeile={a ? a.unterzeile : (g.ort ?? undefined)}
		zustand={a ? { text: zustandsname(a.zustand), art: a.zustand } : undefined}
		pfad={a ? `/versammlungen/${a.versammlungId}` : `/gemeinschaften/${g.id}`}
		fortschritt={a?.fortschritt ?? undefined}
		{gruppen}
	/>
	<div class="inhalt">
		<p class="pfad">
			<a href="/gemeinschaften">Gemeinschaften</a>
			{#if a}· <a href="/gemeinschaften/{g.id}">{g.name}</a>{/if}
			{#if pfadschritt}
				· <a href={a ? mitHerkunft(pfadschritt.pfad, a.versammlungId) : pfadschritt.pfad}
					>{pfadschritt.titel}</a
				>
			{/if}
		</p>
		<!--
			Einmal oben statt an jedem Formular: Die Stammdaten führt die
			Bewirtschaftung. Wer als Sitzungsleitung hier steht, schaut nach — und
			soll das gleich wissen, statt es an einer Absage zu merken.
		-->
		<!-- Ausser auf Seiten, die ihre Rechte selbst führen und sagen (Lesarten). -->
		{#if !data.darfStammdaten && !page.data.eigeneRechte}
			<p class="nurlesend">
				Nur zum Nachsehen: Einheiten, Wertquoten und Eigentümer ändert die Bewirtschaftung.
			</p>
		{/if}
		<!--
			Quer zum Ablauf: dasselbe Thema bei den anderen Häusern des Abends.
			Über dem Inhalt, weil sie ihn betrifft — und nur, wenn man aus einem
			Abend mit mehreren Häusern kommt.
		-->
		{#if register}
			<Abendregister leiste={register} />
		{/if}
		{@render children()}
		<!--
			Die Herkunft nennt die **gemeinsame** Versammlung, wenn es eine gibt:
			Von dort kam man, über das Register der Stammdaten. Der Weg zur
			einzelnen Versammlung steht ohnehin in der Leiste daneben — und zwar
			sechzehnmal, wie sich am 11.08.2026 beim Nachmessen zeigte, während
			die gemeinsame nirgends vorkam.
		-->
		{#if a}
			<Weiterweg
				schritte={ablaufschritte}
				herkunft={a.gemeinsam
					? { titel: a.gemeinsam.bezeichnung, pfad: `/tage/${a.gemeinsam.id}/stammdaten` }
					: { titel: a.titel, pfad: `/versammlungen/${a.versammlungId}` }}
			/>
		{/if}
	</div>
</div>

<style>
	.inhalt {
		min-width: 0;
	}

	.pfad {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0 0 0.5rem;
	}

	.nurlesend {
		background: var(--flaeche-2);
		border-left: 3px solid var(--linie);
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0 0 1rem;
		padding: 0.5rem 0.75rem;
	}
</style>
