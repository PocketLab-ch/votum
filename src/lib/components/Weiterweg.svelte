<script lang="ts">
	/**
	 * Die Leiste am Fuss: was als Nächstes dran ist.
	 *
	 * Die Seitenleiste sagt, wo man steht. Diese Leiste sagt, wohin es geht —
	 * und zwar dort, wo man beim Arbeiten hinschaut: unter dem Formular, nicht
	 * am Rand. Auf dem Telefon ist die Seitenleiste zugeklappt; ohne diese
	 * Leiste endet die Führung mit dem Speichern-Knopf.
	 *
	 * Der Ton hängt davon ab, ob die Seite, auf der man steht, selbst noch offen
	 * ist: «Wenn Sie hier fertig sind» wartet ab, «Als Nächstes» führt weiter.
	 * Wer mitten in der Erfassung steht, soll nicht gedrängt werden.
	 */
	import { page } from '$app/state';
	import { naechsterSchritt } from '$lib/domain/weiterweg';
	import type { Schritt } from '$lib/domain/vorbereitung';

	interface Eigenschaften {
		schritte: Schritt[];
		/**
		 * Ob der Ablauf noch läuft.
		 *
		 * Eine geschlossene Versammlung kennt kein «zurück zur Einladung» mehr:
		 * Was übersprungen wurde, ist dann Vergangenheit und kein offener Punkt.
		 */
		offenerAblauf?: boolean;
		/** Der Satz, der am Ende steht. Ohne ihn schweigt die Leiste. */
		abschluss?: string;
		/**
		 * Woher der Weg kommt, wenn die Seite nicht zur Versammlung gehört.
		 *
		 * Die ersten beiden Schritte führen auf **Gemeinschafts**seiten. Ohne
		 * diesen Hinweis wüsste dort niemand mehr, für welche Versammlung er
		 * gerade Einheiten erfasst — und der Weg zurück wäre geraten.
		 */
		herkunft?: { titel: string; pfad: string };
	}

	let { schritte, herkunft, offenerAblauf = true, abschluss }: Eigenschaften = $props();

	const weg = $derived(naechsterSchritt(schritte, page.url.pathname, offenerAblauf));
</script>

{#if weg && (weg.art !== 'abschluss' || abschluss)}
	<nav class="weiter" class:ende={weg.art === 'abschluss'} aria-label="Weiter im Ablauf">
		{#if herkunft}
			<p class="herkunft">
				Gehört zu <a href={herkunft.pfad}>{herkunft.titel}</a>
			</p>
		{/if}
		<p class="frage">
			{weg.art === 'abschluss'
				? 'Am Ende des Ablaufs'
				: weg.art === 'ausblick'
					? 'Danach'
					: weg.hierNochOffen
						? 'Wenn Sie hier fertig sind'
						: 'Als Nächstes'}
		</p>
		{#if weg.art === 'abschluss'}
			<p class="was">{abschluss}</p>
		{:else if weg.art === 'weiter' && weg.schritt}
			<a class="ziel" href={weg.schritt.pfad}>
				<span class="titel">{weg.schritt.titel}</span>
				<span class="pfeil" aria-hidden="true">→</span>
			</a>
		{:else if weg.schritt}
			<!--
				Kein Verweis: Der Schritt ist gesperrt, und eine verschlossene Tür
				anzubieten ist schlimmer, als sie zu nennen. Genannt wird sie
				trotzdem — sonst endete die Führung ausgerechnet auf der Seite, die
				das Weitere erst freischaltet.
			-->
			<p class="ziel gesperrt">
				<span class="titel">{weg.schritt.titel}</span>
			</p>
		{/if}
		<!--
			Der Satz aus dem Ablauf, nicht ein neuer: Er sagt, was dort zu tun ist,
			der Stand sagt, was noch fehlt, und der Sperrgrund, warum es noch nicht
			geht. Alles drei steht schon im Schritt — hier eine zweite Formulierung
			zu erfinden hiesse, zwei Wahrheiten zu führen.

			**Sperrgrund und Stand schliessen einander nicht aus** (02.09.2026, aus
			dem Code-Review). Hier stand `sperrgrund ?? stand ?? beschreibung`, und
			damit verschluckte der Grund den Stand — dieselbe Verdrängung wie auf
			der Vorbereitungsseite, nur an der Stelle, an der sie am meisten kostet:
			Wer im Entwurf auf `/freigabe` steht, sieht hier den Ausblick auf
			«Einladung erzeugen». Dort stand «Erst nach der Freigabe möglich»,
			während «Heute ist der letzte Tag, an dem die Einladung hinausgehen
			darf» verschwand (damaliger Wortlaut; heute «… bei allen sein soll») —
			auf genau der Seite vor dem Klick, der das ändert.

			Die Beschreibung tritt zurück, sobald eines der beiden dasteht: Sie sagt,
			was der Schritt überhaupt ist, und das ist die schwächste der drei
			Auskünfte.

			**Nicht am laufenden System nachgewiesen.** Der Ausblick zeigt nur dann
			auf einen gesperrten Schritt, wenn davor nichts mehr offen ist; in
			`durchspielen` steht auf `/freigabe` noch «Reglement und Quoren»
			(gemessen am 02.09.2026). Die Verdrängung stand hier im Code, der Fall
			tritt im Durchstich nicht ein.
		-->
		{#if weg.schritt}
			{#if weg.schritt.sperrgrund || weg.schritt.stand}
				{#if weg.schritt.sperrgrund}
					<p class="was">{weg.schritt.sperrgrund}</p>
				{/if}
				{#if weg.schritt.stand}
					<p class="was">{weg.schritt.stand}</p>
				{/if}
			{:else}
				<p class="was">{weg.schritt.beschreibung}</p>
			{/if}
		{/if}
	</nav>
{/if}

<style>
	.weiter.ende {
		/* Kein Akzent am Kopf: Hier wird nichts mehr angeboten, hier steht nur,
		   dass es vorbei ist. */
		border-top-color: var(--linie);
	}

	.weiter {
		margin-top: 2rem;
		padding: 1rem 1.15rem;
		border: 1px solid var(--linie);
		border-top: 3px solid var(--akzent);
		border-radius: var(--radius);
		background: var(--flaeche);
		max-width: var(--lesebreite);
	}

	.herkunft,
	.frage,
	.was {
		margin: 0;
	}

	/*
		**Zwei Saetze brauchen eine Fuge** (02.09.2026, aus dem Code-Review).
		Sperrgrund und Stand stehen seit heute nebeneinander; mit `margin: 0`
		klebten sie aneinander und lasen sich als ein Satz. Der Abstand gilt nur
		ab dem zweiten, damit der einzelne Fall unveraendert bleibt.
	*/
	.was + .was {
		margin-top: 0.35rem;
	}

	.herkunft {
		font-size: 0.9rem;
		color: var(--text-leise);
		margin-bottom: 0.6rem;
	}

	.frage {
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-leise);
	}

	/*
	 * Ein Knopf in Wortform, kein Kästchen mit «Weiter».
	 *
	 * Im Saal wie am Schreibtisch zählt, **wohin** es geht; «Weiter» allein
	 * zwänge zum Nachsehen in der Leiste, und genau das soll die Leiste
	 * ersparen.
	 */
	.ziel {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: var(--ziel-min);
		margin: 0.2rem 0 0.35rem;
		font-size: 1.15rem;
		font-weight: 600;
		color: inherit;
		text-decoration: none;
	}

	.ziel:hover .titel,
	.ziel:focus-visible .titel {
		text-decoration: underline;
	}

	.ziel.gesperrt {
		color: var(--text-leise);
		font-weight: 550;
	}

	.pfeil {
		color: var(--akzent);
		font-size: 1.3rem;
	}

	.was {
		font-size: 0.9375rem;
		color: var(--text-leise);
	}
</style>
