<script lang="ts">
	import '../app.css';
	import Einblender from '$lib/components/Einblender.svelte';
	import Marke from '$lib/components/Marke.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import ThemeSchalter from '$lib/components/ThemeSchalter.svelte';
	import { istAuffaellig } from '$lib/domain/betrieb';
	import { istOffenerPfad } from '$lib/domain/oeffentlich';
	import { handbuchZiel } from '$lib/handbuch';
	import { deutschePflichtfelder } from '$lib/pflichtfelder';

	let { children, data } = $props();

	/**
	 * Hydrations-Marke für die Prüfläufe.
	 *
	 * Zwischen dem gerenderten HTML und dem Augenblick, in dem die Seite
	 * bedienbar ist, liegt im Entwicklungsbetrieb eine sichtbare Lücke: Die
	 * Routenmodule laden nach, und ein Klick oder eine Eingabe davor läuft ins
	 * Leere (leere Anmeldefelder, totes Akkordeon, nativer Formular-Submit
	 * statt enhance — alles am 15.08.2026 in Durchspiel-Läufen beobachtet).
	 * Die Marke sagt den Prüfläufen, wann die Seite wirklich bereit ist; für
	 * Menschen ändert sie nichts.
	 */
	onMount(() => {
		document.documentElement.dataset.bereit = '1';
		/*
		 * **Die Pflichtfeldmeldung auf Deutsch** (Bedienbarkeitsprüfung
		 * 05.09.2026, Telefon 14 und Bewirtschaftung 20). Die Sprechblase des
		 * Browsers folgt der Sprache seiner Oberfläche, nicht dem `lang="de"` des
		 * Dokuments — hier stand sie auf Englisch, «halb hinter dem Knopf».
		 *
		 * In der Wurzel und nicht je Formular: 41 Dateien tragen Pflichtfelder,
		 * und die 42. käme ohne. Die Begründung im Einzelnen steht in
		 * `$lib/pflichtfelder`.
		 */
		return deutschePflichtfelder();
	});

	const stoerung = $derived(data.betrieb && istAuffaellig(data.betrieb));

	/**
	 * Die Saalsicht trägt keinen Kopf.
	 *
	 * An der Wand hängt eine Anzeige, kein Programm: Die Navigationsleiste
	 * verrät dem ganzen Saal, welche Bewirtschaftung hier arbeitet, bietet
	 * Verweise an, die niemand anklicken kann, und nimmt der Frage die oberen
	 * Zentimeter. Sie ganz wegzulassen ist deshalb richtiger, als sie zu
	 * überdecken — die Präsentationssicht liegt zwar fest über der Seite, aber
	 * der Kopf klebt mit eigener Stapelhöhe darüber und blieb sichtbar.
	 */
	/**
	 * Die Hilfe zeigt auf die Stelle im Handbuch, die zur offenen Seite gehört.
	 *
	 * Das Handbuch ist statisches HTML aus dem Abbild, keine Route dieser
	 * Anwendung — darum `data-sveltekit-reload` an beiden Verweisen: Ohne das
	 * versucht der Router, sie als Route aufzulösen, und landet auf 404.
	 *
	 * **Und in einem eigenen Fenster** (17.08.2026, gemeldet vom Auftraggeber): Bis dahin
	 * ersetzte das Handbuch die Anwendung im selben Tab. Wer im Saal etwas
	 * nachschlägt, hat dann die Sitzungsleitung nicht mehr vor sich und muss sich
	 * zurückklicken — mitten in einer laufenden Versammlung.
	 *
	 * Der Name `handbuch` statt `_blank`, und **ohne** `rel="noopener"`: Beide
	 * zusammen ergäben nach der Spezifikation wieder `_blank`, und dann läge nach
	 * fünf Fragen ein Stapel Handbuchfenster da. So gibt es genau eines, und ein
	 * weiterer Klick auf «?» springt darin an die neue Stelle. Ein
	 * `window.opener` ist hier ungefährlich: Das Handbuch ist unser eigenes,
	 * statisches HTML aus demselben Abbild.
	 */
	const hilfe = $derived(handbuchZiel(page.url.pathname));
	const HANDBUCHFENSTER = 'handbuch';

	/**
	 * Wohin «Zur Sitzungsleitung» führt — und wie es beschriftet ist.
	 *
	 * **Am gemeinsamen Abend zum ABEND** (Auftraggeber, 24.08.2026: «Oben zeigt es mir
	 * die STWEG an und nicht Gruppe»). Wer eine Gruppe führt, arbeitet in der
	 * Steuerung des Abends; ein Band, das in eines der Häuser zurückspringt,
	 * führt eine Ebene zu tief — und im Saal merkt man das erst, wenn die
	 * Knöpfe fehlen, die man sucht. Von der Abendsteuerung führt ein Weg in
	 * jedes Haus, umgekehrt nicht so kurz.
	 */
	const sitzungsziel = $derived.by(() => {
		const l = data.laufendeVersammlung;
		if (!l) return null;
		return l.tag
			? { pfad: `/tage/${l.tag.id}/leitung`, name: l.tag.bezeichnung }
			: { pfad: `/versammlungen/${l.id}/leitung`, name: l.gemeinschaft };
	});

	const saalsicht = $derived(
		page.route.id === '/p' || page.route.id?.endsWith('/praesentation') === true
	);

	/**
	 * **Der Weg zum Quellcode steht dort, wo die Verwaltung arbeitet**
	 * (Produktentscheid 16.11.2026: Fusszeile für Verwaltung und Sitzungsleitung,
	 * dazu die Anmeldeseite).
	 *
	 * Nicht in der Saalsicht und nicht auf den übrigen offenen Pfaden (`/z`,
	 * `/e`, `/b`): Dort stehen die Eigentümer, am Telefon oder vor der
	 * Leinwand, und jede Zeile mehr lenkt von der einen Handlung ab, für die
	 * sie gekommen sind. Die Anmeldeseite ist offen und trotzdem dabei, weil
	 * sie die Tür der Verwaltung ist.
	 */
	const zeigeQuellcode = $derived(
		!saalsicht &&
			(page.url.pathname === '/anmelden' ||
				(!!data.benutzer && !istOffenerPfad(page.url.pathname)))
	);

	/**
	 * Die gemessene Höhe der klebenden Kopfleiste, als `--kopf-ist`.
	 *
	 * **Ein fester Wert trägt hier nicht** (29.08.2026). Die Leiste hat
	 * `flex-wrap: wrap`: Mit einem langen Gemeinschaftsnamen und dem Knopf «Zur
	 * Sitzungsleitung» bricht sie um. Gemessen auf derselben Seite, nur die
	 * Fensterbreite geändert: 1400 px → 118 px hoch, 1000 px → 167 px, 900 px →
	 * **206 px**, 375 px → 146 px.
	 *
	 * `scroll-padding-top: 8rem` (128 px) deckte damit genau die breiten Fenster
	 * ab — die einzige Breite, bei der auch gemessen worden war. Bei 900 px lagen
	 * 13 von 18 Sprungzielen weiterhin vollständig unter der Leiste.
	 *
	 * `--kopf-hoehe: 4.5rem` in `app.css` ist die dritte Zahl für dieselbe Leiste
	 * und ebenfalls zu klein; sie trägt dort eine `min-height` und bleibt hier
	 * unangetastet.
	 */
	let kopfleiste = $state<HTMLElement | null>(null);
	$effect(() => {
		const leiste = kopfleiste;
		if (!leiste) {
			// Saalsicht: keine klebende Leiste, also auch nichts zu umgehen.
			document.documentElement.style.removeProperty('--kopf-ist');
			return;
		}
		const setze = () => {
			const hoehe = Math.ceil(leiste.getBoundingClientRect().height);
			document.documentElement.style.setProperty('--kopf-ist', `${hoehe}px`);
		};
		setze();
		const beobachter = new ResizeObserver(setze);
		beobachter.observe(leiste);
		return () => beobachter.disconnect();
	});
</script>

<div class="rahmen" class:saal={saalsicht}>
	{#if !saalsicht}
		<header bind:this={kopfleiste}>
			<a class="markenweg" href="/"><Marke /></a>
			<!--
				**Am gemeinsamen Abend führt das Band zum ABEND** (Auftraggeber, 24.08.2026:
				«Oben zeigt es mir die STWEG an und nicht Gruppe»).

				Wer eine Gruppe führt, arbeitet in der Steuerung des Abends; ein Band,
				das in eines der Häuser zurückspringt, führt eine Ebene zu tief — und
				im Saal merkt man das erst, wenn die Knöpfe fehlen, die man sucht.
				Von der Abendsteuerung führt ein Weg in jedes Haus, umgekehrt nicht
				so kurz.

				Steht man schon auf dem Ziel, fällt der Knopf weg: Ein Verweis auf die
				Seite, auf der man ist, ist keine Hilfe.
			-->
			{#if data.benutzer && sitzungsziel && !page.url.pathname.startsWith(sitzungsziel.pfad)}
				<!--
					**Zurück in den Saal, von jeder Seite aus** (21.08.2026): «Ziel die
					Einfachheit und Hürden tief halten.»
					
					Wer während der Sitzung das Quorum nachschlägt oder eine Zuordnung
					prüft, landet auf Seiten, die von der Versammlung wegführen. Der Weg
					zurück ging bis dahin über die Versammlungsliste — drei Klicks,
					während vierzehn Leute warten.

					Steht die Sitzungsleitung schon vor einem, fällt der Knopf weg: Ein
					Verweis auf die Seite, auf der man ist, ist keine Hilfe.
				-->
				<a class="zurueckZurSitzung" href={sitzungsziel.pfad}>
					<span class="punkt" aria-hidden="true"></span>
					Zur Sitzungsleitung
					<span class="wo">{sitzungsziel.name}</span>
				</a>
			{/if}
			{#if data.benutzer}
				<nav>
					<a href="/versammlungen">Versammlungen</a>
					<a href="/gemeinschaften">Gemeinschaften</a>
					<a href="/personen">Personen</a>
					<a href="/quorum">Mehrheiten</a>
					<a href="/verlauf">Verlauf</a>
					<!--
						**Nur für die Verwaltung** (26.08.2026). Die Seite weist eine
						Sitzungsleitung seit heute mit 403 ab — wie die beiden Unterseiten
						schon länger. Ein Menüpunkt, der für alle sichtbar ist und für die
						Hälfte in eine Absage führt, ist schlechter als keiner; der
						Kommentar weiter unten setzte diesen Zustand ohnehin voraus.
					-->
					{#if data.darfStammdaten}
						<a href="/betreiber">Betreiber</a>
					{/if}
					<a href="/handbuch/index.html" target={HANDBUCHFENSTER} data-sveltekit-reload>
							Handbuch
						</a>
				</nav>
			{/if}
			<div class="rechts">
				{#if data.benutzer}
					<!--
						**Der eigene Name führt zum eigenen Konto.** Dort steht der
						Kennwortwechsel — und zwar für beide Rollen: «Betreiber» ist der
						Verwaltung vorbehalten, eine Sitzungsleitung käme dort nie hin und
						könnte ihr Kennwort nirgends ändern. Genau das war der Zustand bis
						zum 13.08.2026.
					-->
					<a
						class="hilfe"
						href={hilfe.adresse}
						target={HANDBUCHFENSTER}
						title={hilfe.titel}
						data-sveltekit-reload
					>
						<span aria-hidden="true">?</span>
						<!--
							Der Zusatz steht **nur** in der Beschriftung, nicht zusätzlich im
							`title`. Beides gleich zu füllen liest die Sprachausgabe zweimal
							vor: einmal als Namen, einmal als Beschreibung. Das `title` bleibt,
							weil es die einzige Auskunft ist, die ein Zeigegerät bekommt.
						-->
						<span class="nurLeser">{hilfe.titel} — öffnet sich neben der Anwendung</span>
					</a>
					<a class="benutzer" href="/konto">{data.benutzer.displayName}</a>
					<form method="POST" action="/abmelden">
						<button type="submit">Abmelden</button>
					</form>
				{/if}
				<ThemeSchalter />
			</div>
		</header>
	{/if}

	{#if stoerung && !saalsicht}
		<!--
			Der Zustand steht über allem, nicht in einer Ecke: Wer im Saal merkt, dass
			etwas nicht geht, soll den Grund sehen, ohne ihn zu suchen. Der Satz sagt,
			was trotzdem funktioniert — sonst legte jemand mitten in der Versammlung
			los, das Netz zu reparieren.
		-->
		<p class="betriebsband" role="status">{data.betrieb.satz}</p>
	{/if}

	<main>
		{@render children()}
	</main>

	{#if zeigeQuellcode}
		<!--
			Ein neues Fenster, damit eine laufende Sitzung nicht hinter dem
			Quellcode verschwindet; `noopener`, weil die Seite nicht unsere ist.
		-->
		<footer class="quellcode">
			Votum ist freie Software (AGPLv3) ·
			<a href="https://codeberg.org/PocketLab/votum" target="_blank" rel="noopener noreferrer">
				Quellcode<span class="nurLeser"> (öffnet sich in einem neuen Fenster)</span>
			</a>
		</footer>
	{/if}

	<!--
		**Die Quittungen sammeln sich unten rechts** (21.08.2026). Einmal im
		Gerüst, damit sie über allen Seiten stehen und beim Seitenwechsel nicht
		verschwinden — eine Meldung, die mit ihrer Seite geht, kommt zu spät.
	-->
	<Einblender />
</div>

<style>
	.rahmen {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	/*
	 * `flex-wrap` ist hier keine Feinheit, sondern trägt die ganze
	 * Telefonansicht.
	 *
	 * Ohne es kann der Kopf nicht schmaler werden als seine sieben Verweise plus
	 * Abmelden plus Schalter. Der Browser zoomt dann die **ganze Seite** so weit
	 * heraus, bis der Kopf hineinpasst — auf einem iPhone gemessene 1029 statt
	 * 390 Pixel. Der Inhalt stand danach in einer Spalte über gut ein Drittel der
	 * Fläche, und rechts war Leere. Es sah nach einem Fehler im Inhalt aus und
	 * war einer im Kopf.
	 */
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.3rem 1rem;
		padding: 0.75rem var(--rand);
		border-bottom: 1px solid var(--linie);
		background: var(--flaeche);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.markenweg {
		color: inherit;
		text-decoration: none;
	}

	/*
	 * **Sichtbar, aber nicht laut.** Der Knopf ist ein Angebot für den Fall, dass
	 * jemand während der Sitzung woanders gelandet ist — kein Hauptweg. Der
	 * Punkt davor sagt, dass gerade etwas läuft; er blinkt nicht, denn eine
	 * Anzeige, die zappelt, wird im Saal zur Störung.
	 */
	.zurueckZurSitzung {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.8rem;
		min-height: var(--ziel-min);
		border-radius: 999px;
		border: 1px solid var(--akzent);
		background: color-mix(in srgb, var(--akzent) 14%, transparent);
		color: inherit;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 550;
		white-space: nowrap;
	}

	.zurueckZurSitzung:hover,
	.zurueckZurSitzung:focus-visible {
		background: color-mix(in srgb, var(--akzent) 26%, transparent);
	}

	.zurueckZurSitzung .punkt {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--akzent);
		flex: none;
	}

	/* Auf schmalen Schirmen zählt der Weg, nicht das Haus. */
	.zurueckZurSitzung .wo {
		color: var(--text-leise);
		font-weight: 400;
	}

	@media (max-width: 40rem) {
		.zurueckZurSitzung .wo {
			display: none;
		}
	}

	nav {
		display: flex;
		gap: 1rem;
		margin-right: auto;
		font-size: 0.9375rem;
		min-width: 0;
	}

	nav a {
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
		white-space: nowrap;
	}

	/*
	 * Auf dem Telefon bekommt die Navigation eine eigene Zeile und schiebt
	 * seitlich.
	 *
	 * Umbrechen wäre die Alternative gewesen: Sieben Verweise ergäben drei
	 * Zeilen, und der Kopf nähme ein Viertel des Bildschirms. Eine Schublade wäre
	 * die andere — aber wer im Saal unter Zeitdruck sucht, findet nichts, was
	 * weggeklappt ist. Die Reihe schiebt, und dass sie am Rand abgeschnitten ist,
	 * sagt von selbst, dass rechts noch etwas kommt.
	 */
	@media (max-width: 46rem) {
		header {
			padding: 0.35rem var(--rand);
		}

		/*
		 * Abmelden tritt zurück.
		 *
		 * Als umrandeter Knopf war es das auffälligste Element des Kopfes — auf
		 * einem Bildschirm von 390 Pixeln neben dem Namen der Anwendung die
		 * grösste Fläche, für die Handlung, die man am seltensten braucht und
		 * mitten in einer Versammlung am wenigsten will. Als stiller Verweis
		 * kostet es weniger Höhe und lädt weniger zum Danebentippen ein.
		 *
		 * `:global` ist hier nötig und nicht bequem: Der Themenschalter ist eine
		 * eigene Komponente, und Sveltes Bereichsschutz liesse eine Regel von
		 * hier nicht auf seinen Knopf durch. Ohne das blieb er 44 Pixel hoch und
		 * bestimmte die Höhe der ganzen Zeile weiter — die Ersparnis am
		 * Abmelden-Knopf verpuffte auf drei Pixel. Wer den Kopf zusammensetzt,
		 * bestimmt auch die Höhe seiner Teile.
		 */
		.rechts :global(button) {
			min-height: 2.25rem;
			padding: 0 0.5rem;
			border-color: transparent;
			background: none;
			color: var(--text-leise);
			font-size: 0.9375rem;
		}

		nav {
			order: 3;
			flex-basis: 100%;
			margin-right: 0;
			flex-wrap: nowrap;
			overflow-x: auto;
			gap: 0.85rem;
			/* Der Rand wird ausgeglichen, damit die Reihe an der Kante beginnt und
			   der letzte Verweis nicht in einer Lücke endet. */
			margin-inline: calc(-1 * var(--rand));
			padding-inline: var(--rand);
			/* Auf einem Berührungsbildschirm gibt es keinen sichtbaren Balken; der
			   Platz, den er sonst reservierte, fehlte dem Fingerziel. */
			scrollbar-width: none;
			/*
			 * Der letzte sichtbare Verweis läuft aus, statt abgehackt zu enden.
			 * «Eig» mitten im Wort sieht nach einem Fehler aus; ein Auslaufen
			 * sagt, dass rechts noch etwas kommt. Passt die Reihe ganz hinein,
			 * steht am Rand nichts, und der Verlauf ist unsichtbar.
			 */
			mask-image: linear-gradient(to right, #000 calc(100% - 2rem), transparent);
		}

		nav::-webkit-scrollbar {
			display: none;
		}

		nav a {
			min-height: 2.25rem;
		}
	}

	.rechts {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.betriebsband {
		margin: 0;
		padding: 0.6rem var(--rand);
		background: color-mix(in srgb, var(--warnung) 22%, var(--flaeche));
		border-bottom: 1px solid var(--linie);
		font-size: 0.9rem;
	}

	.benutzer {
		color: var(--text-leise);
		font-size: 0.9375rem;
		/* Der Name ist jetzt ein Weg, kein blosser Vermerk — er darf so
		   aussehen, ohne die Kopfzeile lauter zu machen. */
		text-decoration: none;
		border-bottom: 1px dotted currentColor;
		display: inline-flex;
		align-items: center;
		min-height: var(--ziel-min);
	}

	/* Auf schmalen Geräten zählt die Schaltfläche mehr als der Name. */
	@media (max-width: 26rem) {
		.benutzer {
			display: none;
		}
	}

	/* Die Seitenhilfe bleibt auch auf schmalen Geräten stehen: Wer die Seite
	   nicht versteht, braucht sie dort am ehesten. */
	.hilfe {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--ziel-min);
		min-height: var(--ziel-min);
		border-radius: 999px;
		color: var(--text-leise);
		text-decoration: none;
		font-weight: 600;
	}

	.hilfe:hover,
	.hilfe:focus-visible {
		color: var(--text);
		background: var(--flaeche);
	}

	/*
		Breite und Innenabstand stehen in app.css, weil die Bahn eine Absprache
		zwischen Rahmen und Seiten ist: Eine Seite mit Seitenleiste zeichnet
		`.bahn`, und die Bahn wird breit. Als eingegrenzte Regel hier träfe sie
		die Klasse der Seite nicht.
	*/
	main {
		flex: 1;
		width: 100%;
	}

	/* Ohne Kopf gibt es auch nichts abzusetzen: Die Anzeige beginnt am Rand. */
	.rahmen.saal :global(main) {
		padding: 0;
	}

	/* Leise und am Schluss: ein Angebot, kein Weg der Arbeit. */
	.quellcode {
		padding: 0.75rem var(--rand);
		border-top: 1px solid var(--linie);
		color: var(--text-leise);
		font-size: 0.85rem;
		text-align: center;
	}

	.quellcode a {
		color: inherit;
	}
</style>
