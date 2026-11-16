<script lang="ts">
	/**
	 * Die zweite Ebene — überall dieselbe (Story 6.7).
	 *
	 * **Warum es sie gibt.** Bisher hatte jede Ebene ihr eigenes Muster: Bei der
	 * Versammlung standen acht gleich aussehende Knöpfe über dem Inhalt, bei der
	 * Gemeinschaft dieselben acht **unter** dem Speichern-Knopf, und in der
	 * Sitzungsleitung waren es zwei kleine Textverweise. Wer die Gemeinschaft
	 * öffnete, musste erst am Formular vorbeiscrollen, um zu sehen, dass es
	 * überhaupt Bereiche gibt.
	 *
	 * Ab hier steht die zweite Ebene links, dauerhaft sichtbar, an derselben
	 * Stelle — und füllt zugleich die Fläche, die auf einem breiten Bildschirm
	 * rechts leer stand.
	 *
	 * **Was sie zeigt und was nicht.** Sie trägt keine Wahrheit. Zustand, Stand
	 * und Sperrgrund kommen fertig aus dem Kern (`vorbereitungsschritte`,
	 * `bereicheDerGemeinschaft`); dieser Baustein ordnet sie an. Rechnete er
	 * selbst, stünde in der Leiste eines Tages ein anderer Stand als auf der
	 * Seite dahinter.
	 */
	import { page } from '$app/state';
	import { zeigtHierher, type Leistengruppe } from './seitenleiste';

	interface Eigenschaften {
		/** Wonach die Leiste benannt ist — Gemeinschaftsname oder Versammlungsdatum. */
		gegenstand: string;
		unterzeile?: string;
		zustand?: { text: string; art?: string };
		/** Wohin der Gegenstand selbst führt. */
		pfad?: string;
		gruppen: Leistengruppe[];
		fortschritt?: { erledigt: number; moeglich: number; anteil: number };
		beschriftung?: string;
	}

	let {
		gegenstand,
		unterzeile,
		zustand,
		pfad,
		gruppen,
		fortschritt,
		beschriftung = 'Bereiche'
	}: Eigenschaften = $props();

	const hier = $derived(page.url.pathname);

	/**
	 * Der laufende Schritt: der erste offene über alle Gruppen hinweg.
	 *
	 * Er beantwortet die Frage, an der die alte Oberfläche scheiterte — was ist
	 * jetzt dran. Gibt es keinen offenen Schritt, gibt es auch keinen Balken;
	 * einen zu setzen hiesse, auf etwas Erledigtes zu zeigen.
	 */
	const laufender = $derived.by(() => {
		for (const gruppe of gruppen) {
			for (const punkt of gruppe.punkte) {
				if (punkt.zustand === 'offen') return punkt.titel;
			}
		}
		return null;
	});

	/**
	 * Genau ein Punkt gilt als aktuell.
	 *
	 * Verglichen wird der ganze Pfad und nicht sein Anfang: Sonst wäre die
	 * Versammlungsübersicht bei jedem ihrer Unterbereiche mitmarkiert.
	 *
	 * **Und höchstens einer, auch wenn mehrere denselben Pfad tragen.** Genau das
	 * kommt vor: «Traktandenliste» und «Mehrheitserfordernisse» sind zwei
	 * Schritte des Ablaufs, führen aber auf dieselbe Seite — das Erfordernis wird
	 * am Traktandum gesetzt. Beide markiert zu sehen liest sich wie ein Fehler.
	 *
	 * Den Zuschlag bekommt der Schritt, der gerade dran ist; sind beide erledigt,
	 * der erste. So wandert die Marke mit der Arbeit weiter, statt am ersten
	 * Treffer zu kleben.
	 */
	const passt = (p: string | null) => zeigtHierher(p, hier, page.url.searchParams);

	/**
	 * Die Stelle in der Leiste, nicht der Titel.
	 *
	 * Titel sind nicht eindeutig: «Traktandenliste» und «Mehrheitserfordernisse»
	 * zeigen auf dieselbe Seite, und zwei Versammlungen am selben Datum heissen
	 * gleich — an einem Verbundabend ist das die Regel, nicht die Ausnahme. Wer
	 * am Titel unterscheidet, markiert dann zwei Zeilen als «hier».
	 */
	const stellen = $derived(
		gruppen.flatMap((g, gi) => g.punkte.map((p, pi) => ({ p, schluessel: `${gi}/${pi}` })))
	);

	const aktuelleStelle = $derived.by(() => {
		const treffer = stellen.filter((s) => passt(s.p.pfad));
		if (treffer.length === 0) return null;
		return (treffer.find((s) => s.p.titel === laufender) ?? treffer[0]).schluessel;
	});

	const aktuellerTitel = $derived(
		stellen.find((s) => s.schluessel === aktuelleStelle)?.p.titel ?? null
	);

	/**
	 * Auf dem Telefon zugeklappt — aber nicht versteckt.
	 *
	 * Vierzehn Punkte untereinander sind auf einem schmalen Gerät über 500 Pixel
	 * Navigation, bevor der Inhalt beginnt. Zugeklappt bleibt die Führung
	 * trotzdem sichtbar: Der Knopf nennt, wo man steht, sofern die Seite in der
	 * Leiste steht; sonst die Beschriftung der Leiste (siehe `hierName`).
	 *
	 * Der Anfangswert ist **offen**. So kommt die Seite vom Server, und so bleibt
	 * sie, wenn kein Javascript läuft — eine zugeklappte Liste, die sich ohne
	 * Javascript nicht öffnen lässt, wäre eine Sackgasse. Erst der Browser klappt
	 * sie auf schmalen Geräten zu.
	 */
	let schmal = $state(false);
	let offen = $state(true);

	$effect(() => {
		const abfrage = window.matchMedia('(max-width: 60rem)');
		const nachfuehren = () => {
			schmal = abfrage.matches;
			offen = !abfrage.matches;
		};
		nachfuehren();
		abfrage.addEventListener('change', nachfuehren);
		return () => abfrage.removeEventListener('change', nachfuehren);
	});

	/** Der erste gesperrte Punkt — nur er nennt seinen Grund. */
	const ersterGesperrter = $derived.by(() => {
		for (const gruppe of gruppen) {
			for (const punkt of gruppe.punkte) {
				if (punkt.zustand === 'gesperrt' || punkt.pfad === null) return punkt.titel;
			}
		}
		return null;
	});

	/**
	 * Womit der zugeklappte Knopf beschriftet ist: die Seite, auf der man steht.
	 *
	 * **Steht sie nicht in der Leiste, die Beschriftung der Leiste, nicht der
	 * laufende Schritt** (06.10.2026, UI-Durchgang). Der Rückfall auf den
	 * laufenden Schritt nannte eine fremde Seite: Auf 7 von 16 Seiten der
	 * Versammlung (Einlass, Vorbereitung, Weisungen und weitere) stand
	 * «▸ Reglement und Quoren», bei 390 px gemessen. Was dran ist, zeigt die
	 * aufgeklappte Leiste mit ihrem Punkt; der Knopf sagt nur, wo man ist.
	 */
	const hierName = $derived(aktuellerTitel ?? beschriftung);
	/**
	 * Welche Gruppen zugeklappt sind — nach ihrem Titel.
	 *
	 * **Nach dem Titel und nicht nach der Stelle:** Die Leiste baut sich bei jeder
	 * Nachladung neu, und eine Gruppe kann dabei ihre Nummer wechseln (am
	 * gemeinsamen Abend kommen Häuser dazu). Ein Zustand an der Stelle klappte
	 * dann die falsche Gruppe zu.
	 *
	 * **`$state.raw` mit einer neuen Menge je Änderung**: Ein `Set` in `$state`
	 * wäre ein Stellvertreter, und `has()` darauf löst zwar aus, aber das
	 * Austauschen der ganzen Menge ist hier die einfachere Geschichte.
	 */
	let zugeklappt = $state.raw<Set<string>>(new Set());
</script>

<nav class="leiste" aria-label={beschriftung}>
	<div class="kopf">
		{#if pfad && !passt(pfad)}
			<a class="gegenstand" href={pfad}>{gegenstand}</a>
		{:else}
			<span class="gegenstand">{gegenstand}</span>
		{/if}
		{#if zustand}
			<span class="pille" data-art={zustand.art}>{zustand.text}</span>
		{/if}
		{#if unterzeile}
			<p class="unterzeile">{unterzeile}</p>
		{/if}
	</div>

	{#if fortschritt && fortschritt.moeglich > 0}
		<!--
			Als Satz, nicht als Balken. Ein gefüllter Balken ist ein Versprechen auf
			Vollendung; hier geht es um eine Vorbereitung, die über Wochen springt.
			Die Zahl sagt dasselbe, ruhiger — und eine Vorlesehilfe kann sie lesen.
		-->
		<!--
			**«Jetzt möglich» statt bloss einer Zahl** (Bedienbarkeitsprüfung
			05.09.2026, Befund 34): «Der Fortschritt springt von ‹6 von 7› auf ‹9
			von 14›; die Zählbasis wechselt still.»

			Gezählt werden nur die Schritte, die gerade möglich sind — gesperrte
			mitzuzählen liesse die Anzeige am Anfang bei einem Drittel kleben
			(`vorbereitungsfortschritt`). Damit wächst die Bezugsgrösse, sobald ein
			Schritt aufgeht, und ohne ein Wort dazu sieht das nach einem Fehler
			aus. Zwei Wörter sagen, dass die Zahl noch steigen kann.
		-->
		<p class="fortschritt">
			{fortschritt.erledigt} von {fortschritt.moeglich} jetzt möglichen erledigt
		</p>
	{/if}

	{#if schmal}
		<button
			type="button"
			class="klapper"
			aria-expanded={offen}
			onclick={() => (offen = !offen)}
		>
			<span class="pfeil" aria-hidden="true">{offen ? '▾' : '▸'}</span>
			<span class="klapptext">{offen ? beschriftung : hierName}</span>
		</button>
	{/if}

	{#each offen ? gruppen : [] as gruppe, gi (gruppe.titel ?? gi)}
		{@const zu = zugeklappt.has(gruppe.titel ?? String(gi))}
		<div class="gruppe">
			{#if gruppe.titel}
				<!--
					**Jede Gruppe klappt für sich** (Auftraggeber, 11.09.2026: «Wenn man sie nicht
					mehr braucht, dass man schliessen kann»). Die ganze Leiste liess sich
					schon zuklappen — alles oder nichts. Wer am Abend führt, hat
					«Vorbereiten» hinter sich und «Danach» noch vor sich; beide kosten
					Platz in der Spalte, in der man arbeitet.

					**Ein Knopf, kein `<details>`.** Der äussere Schalter dieser Leiste ist
					seit je einer, und zwei Bauformen für dieselbe Geste nebeneinander
					wären eine Stelle zum Lernen mehr. Das Pfeilzeichen ist dasselbe.

					**Zugeklappt bleibt es nur in dieser Sitzung.** Ein Neuladen öffnet
					wieder alle. Das ist Absicht, solange niemand danach fragt: Eine Leiste,
					die sich Zustände über Tage merkt, versteckt beim nächsten Mal Schritte,
					an die sich niemand erinnert.
				-->
				<button
					type="button"
					class="gruppentitel"
					aria-expanded={!zu}
					onclick={() => {
						const marke = gruppe.titel ?? String(gi);
						const neuMenge = new Set(zugeklappt);
						if (neuMenge.has(marke)) neuMenge.delete(marke);
						else neuMenge.add(marke);
						zugeklappt = neuMenge;
					}}
				>
					<span class="pfeil" aria-hidden="true">{zu ? '▸' : '▾'}</span>
					<!--
						**Der Name in einem eigenen Element** (11.09.2026, im ersten Lauf
						gefunden). `innerText` des Knopfes nimmt seither das Pfeilzeichen mit —
						«▾ Danach» statt «Danach» —, und ein Drehbuch verglich auf
						Gleichheit. Dieselbe Falle wie in `Meldung.svelte`, wo `textContent`
						des Absatzes das «×» des Schliessknopfes mitnahm.
					-->
					<span class="gruppenname">{gruppe.titel}</span>
				</button>
			{/if}
			<ul hidden={zu}>
				<!-- Schlüssel ist die Stelle, nicht der Titel: Titel wiederholen sich. -->
				{#each gruppe.punkte as punkt, pi (`${gi}/${pi}`)}
					{@const gesperrt = punkt.zustand === 'gesperrt' || punkt.pfad === null}
					{@const aktuell = `${gi}/${pi}` === aktuelleStelle}
					{@const dran = punkt.titel === laufender}
					{@const laeuft = dran && !aktuell}
					<!--
						**Ein Zeichen, eine Bedeutung.** Der volle Punkt stand bisher sowohl
						am laufenden Schritt als auch an der Seite, auf der man gerade steht
						— zwei verschiedene Aussagen mit demselben Symbol, und in der Leiste
						sahen zwei Einträge gleich wichtig aus. Wo man steht, sagt schon der
						hervorgehobene Kasten; der Punkt gehört allein dem, was dran ist.
					-->
					{@const zeichen =
						punkt.warnung
							? '!'
							: punkt.zustand === 'erledigt'
								? '✓'
								: gesperrt
									? '·'
									: dran
										? '●'
										: '·'}
					<li
						class:gesperrt
						class:aktuell
						class:laeuft
						class:erledigt={punkt.zustand === 'erledigt'}
						class:unvollstaendig={!!punkt.warnung}
					>
						{#if gesperrt}
							<span class="punkt">
								<span class="zeichen" aria-hidden="true">{zeichen}</span>
								<span class="titel">{punkt.titel}</span>
							</span>
							<!--
								Der Sperrgrund steht nur beim **ersten** gesperrten Punkt.
								Fünfmal «Erst nach der Freigabe der Versammlung möglich»
								untereinander ist keine Auskunft mehr, sondern Lärm — und macht
								aus der Führung eine Textwand. Einmal genannt, gilt er
								erkennbar für alles Blasse darunter; vollständig steht er
								weiterhin auf der Vorbereitungsseite.
							-->
							{#if punkt.sperrgrund && punkt.titel === ersterGesperrter}
								<span class="grund">{punkt.sperrgrund}</span>
							{/if}
							<!--
								**Die Warnung steht auch hier** (02.09.2026, aus dem
								Code-Review). Der Kommentar darüber sagt seit dem 12.08.2026
								«Die Warnung steht immer da» — dieser Zweig zeigte sie nicht,
								und das Zeichen «!» war zusätzlich mit `!gesperrt` abgeriegelt.
								Betroffen war die abgelaufene Einberufungsfrist: Sie hängt am
								Schritt «Einladung erzeugen», der im Entwurf gesperrt ist, und
								stand damit in der Leiste nirgends.

								Kein Lärm dadurch, gemessen an einer Versammlung im Entwurf:
								neun gesperrte Punkte, kein einziger mit Warnung. Eine Warnung
								entsteht nicht aus der Sperre, sondern aus einer Lücke — und
								Lücken sind selten. Der **Stand** bleibt draussen: Für ihn gilt
								die Sparsamkeitsregel oben, und vollständig steht er auf der
								Vorbereitungsseite.
							-->
							{#if punkt.warnung}
								<span class="stand warnt">{punkt.warnung}</span>
							{/if}
						{:else}
							<a
								class="punkt"
								href={punkt.pfad}
								target={punkt.extern ? '_blank' : undefined}
								rel={punkt.extern ? 'noopener' : undefined}
								aria-current={aktuell ? 'page' : laeuft ? 'step' : undefined}
							>
								<span class="zeichen" aria-hidden="true">{zeichen}</span>
								<span class="titel">{punkt.titel}</span>
							</a>
							<!--
								**Die Warnung steht immer da**, anders als der Stand: Sie ist der
								Grund, warum jemand hinsehen soll — und wer erst hinklicken muss,
								um zu erfahren, dass etwas fehlt, sieht es eben nicht sofort
								(Auftraggeber, 12.08.2026). Der Stand dagegen bleibt bei der Zeile, wo
								man steht oder als Nächstes hinsoll; sonst stünden unter
								vierzehn Punkten vierzehn Sätze.
							-->
							{#if punkt.warnung}
								<span class="stand warnt">{punkt.warnung}</span>
							{:else if punkt.stand && (aktuell || laeuft)}
								<span class="stand">{punkt.stand}</span>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</nav>

<style>
	/*
		Rand, nicht Karte.

		Vorher ein umrandeter Kasten mit Radius, der in der Mitte der Seite
		schwebte — «abgesetzt». Die Leiste ist aber die Kante der Anwendung: eine
		eigene Fläche am Fensterrand, vom Inhalt durch eine einzige Linie getrennt.
		Der leichte Farbunterschied zu `--flaeche` trägt die Trennung mit, damit
		sie auch dort steht, wo die Linie schwach wirkt.
	*/
	/*
		**Nicht klebend.** Der erste Versuch liess die Leiste unter der Kopfleiste
		kleben und begrenzte sie auf die Fensterhöhe. Auf einem 880 Pixel hohen
		Fenster ist die Schrittfolge aber rund 1000 Pixel lang, also bekam die
		Leiste eine eigene Rollleiste — ein zweiter Rollbereich neben dem der
		Seite, und der ist im Gebrauch immer verwirrend.

		Die Alternativen wären beide schlechter: ohne Begrenzung kleben hiesse,
		dass die untersten Punkte im geklebten Zustand unerreichbar sind; die
		Zeilen niedriger zu machen hiesse, unter die Mindestgrösse für
		Berührungsziele zu gehen.

		Also rollt die Leiste mit der Seite. Sie ist dort, wo man ankommt, und
		verhält sich wie alles andere auch.
	*/
	.leiste {
		background: var(--flaeche-2);
		border-right: 1px solid var(--linie);
		padding: 0.85rem 0;
	}

	.kopf {
		padding: 0 1rem 0.75rem;
		border-bottom: 1px solid var(--linie);
	}

	.gegenstand {
		font-weight: 650;
		letter-spacing: -0.01em;
		line-height: 1.3;
		display: block;
		/*
		 * «Stockwerkeigentümerversammlung» ist breiter als die Leiste. Ohne diese
		 * Zeile bricht das Wort nicht, sondern ragt in den Inhalt hinein und legt
		 * sich über dessen Überschrift — gesehen am 11.08.2026 bei der
		 * gemeinsamen Versammlung «Mit- und Stockwerkeigentümerversammlung
		 * Nirgendwerk».
		 */
		overflow-wrap: anywhere;
	}

	a.gegenstand {
		color: inherit;
		text-decoration: none;
	}

	a.gegenstand:hover {
		text-decoration: underline;
	}

	.pille {
		display: inline-block;
		margin-top: 0.35rem;
		font-size: 0.8rem;
		padding: 0.1rem 0.6rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		color: var(--text-leise);
	}

	.pille[data-art='laufend'] {
		background: color-mix(in srgb, var(--akzent) 25%, transparent);
		color: var(--text);
		font-weight: 550;
	}

	.unterzeile {
		margin: 0.35rem 0 0;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.fortschritt {
		margin: 0;
		padding: 0.55rem 1rem 0.75rem;
		border-bottom: 1px solid var(--linie);
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	/*
	 * Kapitel und Unterpunkte, sichtbar abgestuft.
	 *
	 * Bisher war der Kapiteltitel eine kleine graue Beschriftung und die Schritte
	 * die kräftigen Zeilen: optisch eine flache Liste mit Trennstrichen, obwohl
	 * die Sache eine Gliederung ist — vier Stationen eines Wegs, jede mit ihren
	 * Schritten.
	 *
	 * **Ohne Nummern.** Eine Gliederung braucht keine Ziffern, und in dieser
	 * Anwendung wären sie gefährlich: Die Traktanden tragen bereits Nummern
	 * (1, 1.1, 6.2). Ein zweites «1.2» im selben Bild hiesse im Saal zwei
	 * verschiedene Dinge — und dort werden Nummern ausgesprochen.
	 *
	 * Die Abstufung macht dreierlei: Das Kapitel bekommt Gewicht und die Farbe
	 * des Textes statt der leisen, die Schritte rücken darunter ein, und zwischen
	 * den Kapiteln steht mehr Luft als zwischen ihren Schritten.
	 */
	.gruppe {
		padding: 1rem 0 0.35rem;
	}

	.gruppe + .gruppe {
		border-top: 1px solid var(--linie);
	}

	.gruppentitel {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		margin: 0 0 0.4rem;
		padding: 0.35rem 1rem;
		background: none;
		border: 0;
		text-align: left;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 650;
		color: var(--text);
		letter-spacing: 0.01em;
	}

	.gruppentitel .pfeil {
		color: var(--text-leise);
		font-size: 0.8em;
	}

	/*
	 * **Eigene Rückmeldung, weil die geerbte nicht mehr greift** (aus dem
	 * Code-Review, 11.09.2026): `background: none` hier ist abgegrenzt und
	 * spezifischer als `button:hover` in `app.css`. Ohne diese Regel sähe der neu
	 * anklickbare Titel beim Überfahren aus wie Text.
	 */
	.gruppentitel:hover {
		background: color-mix(in srgb, var(--akzent) 10%, transparent);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.punkt {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
		/* Links mehr als rechts: Der Einzug ordnet den Punkt seinem Kapitel unter. */
		padding: 0.4rem 0.55rem 0.4rem 1rem;
		margin: 0 0.45rem;
		border-radius: var(--radius);
		min-height: var(--ziel-min);
		color: inherit;
		text-decoration: none;
		font-size: 0.92rem;
		line-height: 1.35;
	}

	a.punkt:hover {
		background: var(--flaeche);
	}

	/* Eine schmale Spalte für das Zeichen, damit alle Titel fluchten. */
	.zeichen {
		width: 0.9rem;
		flex: none;
		text-align: center;
		color: var(--text-leise);
		font-size: 0.85rem;
	}

	li.erledigt .zeichen {
		color: var(--akzent);
	}

	li.laeuft .zeichen,
	li.aktuell .zeichen {
		color: var(--akzent);
	}

	/*
	 * Das Ausrufezeichen sticht heraus — es ist das einzige Zeichen, das etwas
	 * verlangt. Es steht **vor** dem Häkchen: Ein Punkt kann erledigt sein und
	 * trotzdem eine Lücke tragen (der Saldo ging auf, als er zuletzt geprüft
	 * wurde, und seither kam eine Einheit dazu).
	 */
	li.unvollstaendig .zeichen {
		color: var(--warnung);
		font-weight: 700;
	}

	.stand.warnt {
		color: var(--warnung);
	}

	.titel {
		min-width: 0;
	}

	/* Steht nur beim laufenden Schritt und auf der offenen Seite. */
	.stand,
	.grund {
		display: block;
		/* Fluchtet mit dem Titel: Einzug des Punktes plus Zeichenspalte plus Lücke. */
		padding: 0 1rem 0.35rem 2.9rem;
		font-size: 0.8rem;
		color: var(--text-leise);
		line-height: 1.35;
	}

	/*
		Die offene Seite hebt sich zur helleren Inhaltsfläche hin ab — sie ist
		sozusagen schon ein Stück des Inhalts. Der Akzent sitzt als Einzug im
		Kasten, nicht als eigene Kante: eine Linie weniger im Bild.
	*/
	li.aktuell .punkt {
		background: var(--flaeche);
		box-shadow: inset 3px 0 0 var(--akzent);
		font-weight: 600;
	}

	/*
		Gesperrt heisst blass, aber nicht unsichtbar: Wer nur sieht, was gerade
		geht, weiss nicht, wie viel noch kommt, und kann den Abend nicht planen.
	*/
	/*
		**Das Warnzeichen bleibt deckend** (02.09.2026, aus dem Code-Review). Der
		gesperrte Punkt ist blass, damit er zuruecktritt — das «!» daran soll aber
		genau das Gegenteil tun. Es stand innerhalb von `.punkt` und war damit
		halb durchsichtig, waehrend der Warnsatz daneben voll deckend stand: zwei
		Gewichte fuer dieselbe Aussage.
	*/
	li.gesperrt.unvollstaendig .punkt .zeichen {
		opacity: 1;
	}

	li.gesperrt .punkt {
		opacity: 0.5;
		cursor: default;
	}

	/*
	 * **Der Klappknopf steht am Rand des Inhalts** (06.10.2026, UI-Durchgang).
	 * Ohne eigene Regel begann er bei 390 px an x = 0, Kopf und Inhalt bei
	 * 16 px. Derselbe Rand wie `.kopf`, und der Name bricht um, statt den
	 * Knopf über die Leiste hinauszuschieben.
	 */
	button.klapper {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		max-width: calc(100% - 2rem);
		margin: 0.6rem 1rem 0;
		text-align: left;
	}

	.klapptext {
		min-width: 0;
		overflow-wrap: break-word;
	}

	@media (max-width: 60rem) {
		/* Gestapelt trennt die Linie nach unten statt nach rechts. */
		.leiste {
			position: static;
			max-height: none;
			overflow-y: visible;
			border-right: 0;
			border-bottom: 1px solid var(--linie);
		}
	}
</style>
