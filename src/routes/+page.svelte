<script lang="ts">
	import { tagVon, uhrzeit } from '$lib/domain/datum';
	import { zustandsname } from '$lib/domain/versammlung';

	import Marke from '$lib/components/Marke.svelte';

	import { begrenzt } from '$lib/domain/listensuche';

	let { data } = $props();

	const u = $derived(data.uebersicht);

	/**
	 * Wie viele Kacheln ein Abschnitt höchstens zeigt (Auftraggeber, 25.08.2026:
	 * «Weniger ist mehr. Würde da minimalistisch verfahren und maximal 8 Kacheln
	 * pro Thema anzeigen»).
	 *
	 * **An einer Stelle, für alle drei Abschnitte.** Verschiedene Grenzen
	 * nebeneinander lesen sich wie eine Wertung: Der Abschnitt mit fünfundzwanzig
	 * Karten sähe wichtiger aus als der mit acht, obwohl nur die Zahl der
	 * Einträge verschieden ist. Unter jedem gekürzten Abschnitt steht, was er
	 * verbirgt, und ein Weg zu allem.
	 */
	const KACHELN = 8;

	/**
	 * Die Liste «Steht an» ohne Suchbegriff auf fünfundzwanzig kürzen (A-47).
	 *
	 * Hier gibt es kein eigenes Suchfeld — das oben führt in die
	 * Versammlungsübersicht. Deshalb der leere Suchbegriff: Gekürzt wird immer,
	 * bis jemand «alle anzeigen» klickt.
	 */
	let alleAnstehend = $state(false);
	const anstehend = $derived(begrenzt(u?.anstehend ?? [], '', alleAnstehend, KACHELN));

	/** Zugangs- und Anzeigecode zusammen — der Unterschied hilft hier niemandem. */
	const vergeblich = $derived(
		(data.codeversuche?.vergeblichZugang ?? 0) + (data.codeversuche?.vergeblichAnzeige ?? 0)
	);

	/**
	 * Was jetzt keinen Aufschub duldet: laufende Versammlungen und solche, deren
	 * Termin verstrichen ist.
	 *
	 * **Zusammen, nicht in zwei Abschnitten** (25.08.2026). Beide sagen dasselbe:
	 * «geh sofort hin». Zwei Überschriften dafür zwangen den Blick, zweimal zu
	 * entscheiden, ob etwas gemeint ist — und schoben das Übrige nach unten.
	 */
	const jetzt = $derived([
		...(u?.laufend ?? []).map((v) => ({ v, laeuft: true })),
		...(u?.ueberfaellig ?? []).map((v) => ({ v, laeuft: false }))
	]);

	/*
	 * **Auch das Dringende wird gekürzt** (25.08.2026, am Prüfbestand gemessen:
	 * 66 Karten, die Seite dreizehn Bildschirmhöhen lang).
	 *
	 * Der Einwand liegt nahe: Was läuft, muss man sehen. Er trifft nicht — bei
	 * sechsundsechzig Karten sieht man gar nichts mehr, und die Blöcke darunter
	 * überhaupt nicht. Dieselbe Kürzung wie unter «In Vorbereitung» (A-47), mit
	 * demselben Weg heraus: «alle anzeigen» steht darunter, und die Zahl der
	 * verborgenen ist genannt. Nichts verschwindet still.
	 */
	let alleJetzt = $state(false);
	const jetztGekuerzt = $derived(begrenzt(jetzt, '', alleJetzt, KACHELN));

	let allePunkte = $state(false);
	const punkte = $derived(begrenzt(u?.punkte ?? [], '', allePunkte, KACHELN));

	/**
	 * «vor 10 Minuten», «gestern, 16:40», «Di, 19. Mai».
	 *
	 * Bei «zuletzt bearbeitet» ist der Abstand die Auskunft, nicht das Datum: Wer
	 * zurückkommt, will wissen, ob das eben war oder letzte Woche. Ein
	 * Zeitstempel «2026-08-25 11:47» beantwortet dieselbe Frage, aber erst nach
	 * einer Rechnung im Kopf.
	 */
	function vorhin(wann: Date | string): string {
		const dann = new Date(wann);
		const minuten = Math.round((Date.now() - dann.getTime()) / 60000);
		if (minuten < 1) return 'gerade eben';
		if (minuten < 60) return `vor ${minuten} Minute${minuten === 1 ? '' : 'n'}`;
		const stunden = Math.round(minuten / 60);
		if (stunden < 12) return `vor ${stunden} Stunde${stunden === 1 ? '' : 'n'}`;
		// Über die Hausfunktion: Ohne Zeitzone hinge «heute, 14:07» am Gerät und
		// stünde neben derselben Angabe anderswo verschieden da (04.09.2026).
		const uhr = uhrzeit(dann.toISOString());
		/*
		 * **Auch der Tagesvergleich läuft über Schweizer Zeit** (04.09.2026, aus
		 * dem Code-Review). `toDateString()` nimmt die Zone des Geräts: Im Fenster
		 * um Mitternacht sagte der Server «gestern, 01:30» und der Browser «heute,
		 * 01:30», an derselben Zeile. `tagVon` liefert den Kalendertag hier.
		 */
		const heute = new Date();
		const tagDann = tagVon(dann.toISOString());
		if (tagDann === tagVon(heute.toISOString())) return `heute, ${uhr}`;
		const gestern = new Date(heute.getTime() - 86400000);
		if (tagDann === tagVon(gestern.toISOString())) return `gestern, ${uhr}`;
		const tag = dann.toLocaleDateString('de-CH', {
			timeZone: 'Europe/Zurich',
			weekday: 'short',
			day: 'numeric',
			month: 'long'
		});
		return `${tag}, ${uhr}`;
	}

	/** Wie der Gegenstand heisst, an dem zuletzt gearbeitet wurde. */
	const GATTUNG = {
		versammlung: 'Versammlung',
		abend: 'Gemeinsame Versammlung',
		gemeinschaft: 'Gemeinschaft'
	} as const;

	/** «Di, 15. September 2026» liest sich schneller als 2026-09-15. */
	function datum(iso: string): string {
		const [j, m, t] = iso.split('-').map(Number);
		return new Date(Date.UTC(j, m - 1, t)).toLocaleDateString('de-CH', {
			weekday: 'short',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}
</script>

{#if !u}
	<!-- Die Wortmarke statt einer blossen Überschrift: Hier sieht jemand die
	     Anwendung zum ersten Mal, und der Name ist das Erste, was bleibt. -->
	<h1 class="anmeldekopf"><Marke /></h1>
	<p class="einleitung">
		Werkzeug zur Führung von Stockwerkeigentümer-Versammlungen nach ZGB Art. 712a ff.
	</p>
	<p><a href="/anmelden">Anmelden</a></p>
{:else}
	<h1>Übersicht</h1>

	<!--
		**Schnellsuche** (21.08.2026): «Hier fehlt noch die Schnellsuche also nach
		Stweg, Ort etc einfach die Daten, die es [gibt].»

		Sie führt zur vollständigen Liste und sucht nicht hier: Diese Seite zeigt
		Auszüge — was gerade läuft, was ansteht, die letzten fünf abgeschlossenen.
		Eine Suche, die nur darin sucht, verschwiege den Rest und behauptete
		trotzdem, gesucht zu haben.

		Ein einfaches GET-Formular: Es funktioniert ohne JavaScript, die Adresse
		lässt sich teilen und mit dem Zurück-Knopf wiederfinden.
	-->
	<form class="schnellsuche" method="GET" action="/versammlungen">
		<label>
			<!--
				**Das Feld sucht Versammlungen, nicht Gemeinschaften** (23.08.2026,
				Prüflauf I, A-23). Der Platzhalter «Gemeinschaft, Ort oder Datum»
				beschrieb, wonach gesucht wird — nicht, was gefunden wird. Der Prüfer
				tippte «Probehalde», bekam «Nichts gefunden» und schloss daraus, die
				Gemeinschaft gebe es nicht; sie hatte nur keine Versammlung.
			-->
			<span class="nurLeser">Versammlung suchen</span>
			<input
				type="search"
				name="suche"
				placeholder="Versammlung suchen — Gemeinschaft, Ort oder Datum"
				autocomplete="off"
			/>
		</label>
		<button type="submit">Suchen</button>
		<!--
			**Keine Wege neben der Suche** (Auftraggeber, 23.08.2026). «Alle Versammlungen»
			und «Gemeinschaften» standen hier als Zweitweg — beide führt die
			Kopfleiste ohnehin, auf jeder Seite. Zwei Wege zum selben Ziel
			nebeneinander machen die Zeile voll und die Suche zur Nebensache.
			Wo es einen Weg braucht, weil sonst keiner da ist, steht er weiter:
			unter «Keine anstehende Versammlung».
		-->
	</form>

	<!--
		**Schnellstart** (Auftraggeber, 25.08.2026: «Bspw. Schnellstart für Versammlung
		anlegen, Eigentümer anlegen / bearbeiten, etc.»)

		**Anlegen, nicht navigieren** — das ist der Unterschied zur Kopfleiste und
		der Grund, warum das hier kein zweiter Weg zum selben Ziel ist. Die
		Kopfleiste führt zu den Listen; hier beginnt etwas Neues. Deshalb steht
		überall ein Verb, und die Zeile heisst nicht «Versammlungen», sondern
		«Versammlung anlegen».

		**Eine flache Zeile, kein Kartenblock.** Etwas anzulegen ist der seltenere
		Fall; was drängt, steht darunter. Ein Block Karten oben hätte den Saal
		nach unten geschoben — genau das, was die Seite am Abend nicht darf.
	-->
	<nav class="schnellstart" aria-label="Neu anlegen">
		<a class="knopf leise" href="/versammlungen/neu">Versammlung anlegen</a>
		<a class="knopf leise" href="/gemeinschaften/neu">Gemeinschaft anlegen</a>
		<!--
			**Eigentümer gehören immer zu einer Gemeinschaft** — es gibt keinen Weg,
			einen ohne sie anzulegen (nachgesehen: `/personen` ist eine Liste ohne
			Erfassungsformular). Deshalb führt der Weg über die Gemeinschaftsliste;
			der Titel sagt, warum. «Eigentümer bearbeiten» steht daneben ohnehin
			meist unter «Zuletzt bearbeitet» — dort mit dem richtigen Haus.
		-->
		<a
			class="knopf leise"
			href="/gemeinschaften"
			title="Eigentümer gehören zu einer Gemeinschaft — wählen Sie zuerst die Gemeinschaft."
			>Eigentümer erfassen</a
		>
	</nav>

	{#if u.leer}
		<section class="einstieg">
			<h2>Noch nichts erfasst</h2>
			<p>
				Der Weg beginnt bei der Gemeinschaft: Einheiten mit Wertquoten, dann die Eigentümer, dann
				die erste Versammlung.
			</p>
			<a class="knopf" href="/gemeinschaften/neu">Erste Gemeinschaft anlegen</a>
		</section>
	{/if}

	<!--
		**Was jetzt keinen Aufschub duldet — in EINEM Block** (25.08.2026).

		Zwei Dinge stehen hier: was gerade läuft, und was freigegeben ist,
		dessen Termin verstrichen ist und das niemand eröffnet hat (22.08.2026,
		Befund C-05 — es fiel bis dahin durch alle Raster). Beide sagen dasselbe:
		geh sofort hin. Vorher waren es zwei Abschnitte mit zwei Überschriften;
		der Blick musste zweimal entscheiden, ob er gemeint ist, und alles
		Übrige rutschte eine Bildschirmhöhe nach unten.

		Ganz oben, weil die Startseite am Versammlungsabend geöffnet wird und
		dann genau diese Frage hat.
	-->
	{#if jetzt.length > 0}
		<section class="dringend">
			<h2>Jetzt im Saal</h2>
			<div class="karten">
				{#each jetztGekuerzt.zeigen as { v, laeuft } (v.id)}
					<!--
						**Der Abend führt, nicht das einzelne Haus** (Auftraggeber, 25.08.2026).
						Steht die Zeile für einen gemeinsamen Abend, führt sie auch
						dorthin — die Sitzungsleitung des einzelnen Hauses wäre der
						falsche Ort, dort wird an einem Verbundabend nichts geführt.
					-->
					<a
						class="karte"
						class:jetzt={laeuft}
						class:ueberfaellig={!laeuft}
						href={v.abend
							? laeuft
								? `/tage/${v.abend.id}/leitung`
								: `/tage/${v.abend.id}`
							: laeuft
								? `/versammlungen/${v.id}/leitung`
								: `/versammlungen/${v.id}`}
					>
						<span class="marke" class:jetzt-marke={laeuft}>
							{laeuft ? 'läuft' : 'freigegeben, nicht eröffnet'}
						</span>
						<strong>{v.gemeinschaft}</strong>
						<span class="wann">
							{datum(v.datum)}, {v.uhrzeit} Uhr · {v.ort}{#if v.abend}
								· {v.abend.haeuser}
								{v.abend.haeuser === 1 ? 'Gemeinschaft' : 'Gemeinschaften'}{/if}
						</span>
						<span class="fuehrt">
							{laeuft ? 'Zur Sitzungsleitung' : 'Eröffnen'}
						</span>
					</a>
				{/each}
			</div>
			{#if jetztGekuerzt.verborgen > 0}
				<p class="mehr">
					<strong>{jetztGekuerzt.verborgen} weitere</strong> —
					<button type="button" class="flach" onclick={() => (alleJetzt = true)}>
						alle {jetzt.length} anzeigen
					</button>.
				</p>
			{/if}
		</section>
	{/if}

	<!--
		**Wo war ich?** (Auftraggeber, 25.08.2026: «Dann einen Bereich zuletzt Bearbeitet,
		wo man direkt rein und weiterbearbeiten kann.»)

		**Eine Liste, keine Karten.** Was hier steht, ist bekannt — man sucht
		nicht, man erkennt wieder. Dafür genügt eine Zeile mit Name, Handgriff und
		Abstand; Karten hätten dieselbe Auskunft auf der vierfachen Fläche.

		**Der Abstand statt des Datums**: «vor 10 Minuten» beantwortet die Frage,
		die man beim Zurückkommen hat. «25.08.2026, 11:47» beantwortet sie auch,
		aber erst nach einer Rechnung im Kopf.

		Der Weg führt dorthin, wo weitergearbeitet wird — auf die Eigentümerliste
		der Gemeinschaft, nicht auf eine Seite je Partei. Was aus dem Bestand
		verschwunden ist, steht gar nicht erst da (siehe `server/zuletzt.ts`).
	-->
	{#if data.zuletzt.length > 0}
		<section>
			<h2>Zuletzt bearbeitet</h2>
			<ul class="zuletzt">
				{#each data.zuletzt as z (z.pfad)}
					<li>
						<a href={z.pfad}>
							<span class="was">{z.name}</span>
							<span class="gattung">{GATTUNG[z.art]}</span>
							<span class="woran">{z.woran}</span>
							<span class="wann">{vorhin(z.wann)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!--
		**«Das fehlt noch» statt «Offene Punkte»** (25.08.2026: «für Laien
		verständlich»). Ein «offener Punkt» ist Verwaltungsdeutsch; was hier
		steht, ist schlicht: etwas fehlt, und ohne das geht es nicht weiter.
	-->
	{#if u.punkte.length > 0}
		<section>
			<h2>Das fehlt noch</h2>
			<div class="karten">
				{#each punkte.zeigen as p (p.kennung + p.bezug)}
					<article class="punkt" class:hindernis={p.stufe === 'hindernis'}>
						<p class="bezug">{p.bezug}</p>
						<p class="text">{p.text}</p>
						<a href={p.pfad}>Dorthin</a>
					</article>
				{/each}
			</div>
			{#if punkte.verborgen > 0}
				<p class="mehr">
					<strong>{punkte.verborgen} weitere</strong> —
					<button type="button" class="flach" onclick={() => (allePunkte = true)}>
						alle {u.punkte.length} anzeigen
					</button>.
				</p>
			{/if}
		</section>
	{/if}

	<!--
		**Neununddreissig Karten untereinander** (23.08.2026, Prüflauf II, A-47).
		Die Startseite war 4,2 Bildschirmhöhen lang, und die eigene Anlage fand man
		darin nicht. Ein Suchfeld gibt es oben (es führt in die
		Versammlungsübersicht), aber die Liste selbst lief ungefiltert durch.

		Gekürzt wird nur der längste Block; «läuft gerade» und «abgeschlossen»
		tragen selten mehr als eine Handvoll.
	-->
	<!--
		**«In Vorbereitung»**: Was hier steht, ist noch nicht eröffnet — die
		Karten tragen den Fortschritt und den nächsten Schritt. «Steht an» sagte
		nur, dass es kommt, nicht dass daran zu arbeiten ist.
	-->
	<section>
		<h2>In Vorbereitung</h2>
		{#if u.anstehend.length === 0}
			<p class="leer">
				Keine anstehende Versammlung. <a href="/versammlungen">Alle Versammlungen</a>
			</p>
		{:else}
			<div class="karten">
				{#each anstehend.zeigen as v (v.id)}
					<a class="karte" href={v.abend ? `/tage/${v.abend.id}` : `/versammlungen/${v.id}`}>
						<span class="marke">{zustandsname(v.zustand)}</span>
						<strong>{v.gemeinschaft}</strong>
						<span class="wann">
							{datum(v.datum)}, {v.uhrzeit} Uhr · {v.ort}{#if v.abend}
								· {v.abend.haeuser}
								{v.abend.haeuser === 1 ? 'Gemeinschaft' : 'Gemeinschaften'}{/if}
						</span>
						<!--
							**«der jetzt möglichen Schritte», nicht bloss «vorbereitet»**
							(07.09.2026, aus dem Code-Review zu `82c00cf`).
							`vorbereitungsfortschritt` zählt nur, was gerade **nicht
							gesperrt** ist — sonst klebte die Anzeige am Anfang bei einem
							Drittel. Damit wächst die Bezugsgrösse, sobald ein Schritt
							aufgeht, und der Prozentsatz kann **fallen**, ohne dass jemand
							etwas rückgängig gemacht hätte. In der Seitenleiste steht seit
							`82c00cf` «X von Y jetzt möglichen erledigt»; hier stand weiter
							nur eine Zahl, und genau hier sieht man sie über mehrere
							Versammlungen nebeneinander.

							**Auf einer Abendkarte gehört die Zahl einem Haus**
							(Code-Review 07.09.2026): `abendeZusammenfassen` setzt den
							Fortschritt des **schwächsten** Hauses, während daneben «3
							Gemeinschaften» steht. «der jetzt möglichen Schritte» wäre dort
							eine Bezugsgrösse, die es nirgends gibt — deshalb zwei Sätze.
						-->
						<span class="fortschritt">
							<span class="balken" style:--anteil="{v.fortschritt}%"></span>
							<span class="anteil">
								<!-- Das Leerzeichen ausdrücklich: Svelte schneidet es am Blockanfang weg. -->
								{v.fortschritt}%{v.abend
									? ' im Haus, das am weitesten zurück ist'
									: ' der jetzt möglichen Schritte'}{#if v.naechsterSchritt}{' '}·
									als Nächstes: {v.naechsterSchritt}{/if}
							</span>
						</span>
					</a>
				{/each}
			</div>
			{#if anstehend.verborgen > 0}
				<p class="mehr">
					<strong>{anstehend.verborgen} weitere</strong> —
					<a href="/versammlungen">alle Versammlungen mit Suche</a>, oder
					<button type="button" class="flach" onclick={() => (alleAnstehend = true)}>
						hier alle {u?.anstehend.length ?? 0} anzeigen
					</button>.
				</p>
			{/if}
		{/if}
	</section>

	<!--
		**Abgeschlossenes steht als Zeile, nicht als Kartenblock** (25.08.2026:
		«Ziel, aufgeräumt, übersichtlich»).

		Ein voller Kartenblock am Fuss der Seite nahm so viel Platz wie das, was
		noch zu tun ist — für Versammlungen, an denen nichts mehr zu tun ist. Wer
		eine Auswertung sucht, sucht eine bestimmte; dafür genügt der Name mit dem
		Datum. Was an einer abgeschlossenen Versammlung tatsächlich noch fehlt
		(Auswertung, Siegel, Protokoll), steht oben unter «Das fehlt noch».
	-->
	{#if u.abgeschlossen.length > 0}
		<section>
			<h2>Abgeschlossen</h2>
			<ul class="erledigt">
				{#each u.abgeschlossen as v (v.id)}
					<li>
						<!-- Der Abend hat ein gemeinsames Protokoll; dorthin führt die Zeile. -->
						<a
							href={v.abend
								? `/tage/${v.abend.id}/protokoll`
								: `/versammlungen/${v.id}/auswertung`}
						>
							<span class="was">{v.gemeinschaft}</span>
							<span class="wann">{datum(v.datum)}</span>
							<span class="woran">{v.abend ? 'Zum Protokoll' : 'Zur Auswertung'}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}

<!--
	**Migrationsstände gehören nicht auf die Startseite eines Verwalters**
	(23.08.2026, Prüflauf I, A-26). «Datenbank erreichbar (18.4)», «Migrationen 74
	ausgeführt» — für den Prüfer war das «Zahlensalat, mit dem ich nichts anfangen
	kann». Es gibt einen eigenen Menüpunkt «Betreiber»; dorthin gehören sie.

	Was bleibt, ist die eine Zeile, die auch einen Verwalter angeht: ob die
	äusseren Dienste erreichbar sind. Das entscheidet, ob am Abend ein Zeitstempel
	zu holen ist. Der Rest steht im Ausklapper und unter «Betreiber».
-->
<section class="zustand">
	<h2>Betriebszustand</h2>
	<dl>
		<div>
			<dt>Datenbank</dt>
			<dd class:gut={data.db.erreichbar} class:schlecht={!data.db.erreichbar}>
				{data.db.erreichbar ? `erreichbar (${data.db.version})` : 'nicht erreichbar'}
			</dd>
		</div>

		<div>
			<dt>Äussere Dienste</dt>
			<dd class:gut={data.betrieb.art === 'verbunden'} class:warn={data.betrieb.art === 'getrennt'}>
				{data.betrieb.kurz}
			</dd>
		</div>
	</dl>
	<!--
		**Ein Hinweis, der kein Ausfall ist** (13.11.2026). Der Ersatzdienst
		bezeugt das Siegel, wenn der Hauptdienst nicht liefert. Das gehört auf
		diese Seite und nicht in eine Fussnote: Der Grund ist meist ein
		gewechseltes Zertifikat, und das behebt nur, wer es sieht.
	-->
	{#each data.betrieb.warnungen as w (w)}
		<p class="hinweis warnung" data-betriebswarnung>{w}</p>
	{/each}
	<p class="hinweis">{data.betrieb.satz}</p>
	<details class="technisch">
		<summary>Technischer Stand</summary>
		<p class="hinweis">
			Datenbank {data.db.erreichbar ? `erreichbar, Fassung ${data.db.version}` : 'nicht erreichbar'} ·
			{data.db.migrationen} Migrationen ausgeführt. Ausführlicher unter
			<a href="/betreiber">Betreiber</a>.
		</p>
	</details>

	{#if vergeblich > 0}
		<!--
			Nur wenn es etwas zu sehen gibt (Audit B-05). Eine Zeile «0 vergebliche
			Versuche», die immer dasteht, wird nach einer Woche nicht mehr gelesen —
			und dann fällt auch die Zahl 40 nicht mehr auf.
		-->
		<p class="hinweis">
			Vergebliche Codeeingaben auf dieser Anlage, letzte {data.codeversuche?.seitStunden} Stunden:
			<strong>{vergeblich}</strong>. Ein paar davon sind Tippfehler. Viele auf einmal heissen,
			dass jemand probiert — abgetippt wird ein Code nicht vierzigmal falsch.
			<!--
				«auf dieser Anlage» steht da, weil es stimmt: Ein Code, der nicht
				greift, gehört zu keinem Betreiber, also zählt die Zahl über alle.
				Deshalb sieht sie nur die Verwaltung (siehe +page.server.ts).
			-->
		</p>
	{/if}
</section>

<style>
	.mehr {
		margin: 0.6rem 0 0;
		color: var(--text-leise);
	}

	/*
	 * **Der Schnellstart: eine flache Zeile unter der Suche.**
	 *
	 * `leise` statt Haupthandlung: Anlegen ist nicht das, was die Seite von
	 * einem will — es ist das, was man will, wenn man selbst etwas anfängt. Drei
	 * kräftige Knöpfe oben zögen den Blick von dem weg, was drängt.
	 */
	.schnellstart {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: -0.75rem 0 1.5rem;
	}

	/*
	 * **«Zuletzt bearbeitet» und «Abgeschlossen» sind Listen, keine Karten.**
	 *
	 * Beide zeigen Bekanntes: Man erkennt wieder, statt zu suchen. Eine Zeile je
	 * Eintrag mit dem Namen vorn und dem Beiwerk dahinter — auf dem Telefon
	 * bricht es um, ohne die Ordnung zu verlieren.
	 */
	.zuletzt,
	.erledigt {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--linie);
	}

	.zuletzt li,
	.erledigt li {
		border-bottom: 1px solid var(--linie);
	}

	.zuletzt a,
	.erledigt a {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.2rem 0.75rem;
		/* Die ganze Zeile ist der Weg — auf dem Telefon trifft man sonst nur den
		   Namen. `--ziel-min` ist das Mass für Fingerziele in dieser Anwendung. */
		min-height: var(--ziel-min);
		padding: 0.5rem 0;
		text-decoration: none;
		color: inherit;
	}

	.zuletzt a:hover .was,
	.erledigt a:hover .was,
	.zuletzt a:focus-visible .was,
	.erledigt a:focus-visible .was {
		text-decoration: underline;
	}

	.zuletzt .was,
	.erledigt .was {
		font-weight: 600;
		/* Der Name führt und darf die Zeile für sich nehmen; das Beiwerk rückt
		   dann nach unten statt den Namen zu quetschen. */
		flex: 1 1 14rem;
		overflow-wrap: anywhere;
	}

	.zuletzt .gattung {
		font-size: 0.85em;
		color: var(--text-leise);
	}

	.zuletzt .woran,
	.erledigt .woran {
		font-size: 0.9em;
		color: var(--text-leise);
	}

	.zuletzt .wann,
	.erledigt .wann {
		font-size: 0.9em;
		color: var(--text-leise);
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.anmeldekopf {
		font-size: 2rem;
		margin: 0 0 .4rem;
	}

	/*
	 * Die Schnellsuche steht zwischen Titel und Karten — dort, wo man sie sucht,
	 * und ohne die Karten wegzuschieben.
	 */
	.schnellsuche {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1.25rem;
	}

	.schnellsuche label {
		flex: 1 1 18rem;
		min-width: 0;
		margin: 0;
	}

	.schnellsuche input {
		width: 100%;
		min-height: var(--ziel-min);
		box-sizing: border-box;
	}

	.schnellsuche button {
		min-height: var(--ziel-min);
		flex: none;
	}

	h2 {
		font-size: 1rem;
		color: var(--text-leise);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-top: 2rem;
	}

	.einstieg {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 1.25rem;
		background: var(--flaeche);
		max-width: 42rem;
	}

	.einstieg h2 {
		margin-top: 0;
	}

	.knopf {
		display: inline-flex;
		align-items: center;
		min-height: var(--ziel-min);
		padding: 0 1rem;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		text-decoration: none;
		font-weight: 550;
	}

	/*
	 * **Der Schnellstart ist umrandet, nicht gefüllt.**
	 *
	 * Drei gefüllte Knöpfe oben zogen den Blick von dem weg, was drängt — im
	 * Bild vom 25.08. stand «Versammlung anlegen» kräftiger da als «Jetzt im
	 * Saal». Umrandet in der Akzentfarbe heisst: anklickbar, aber nicht das,
	 * was die Seite von einem will. Grau wäre das falsche Signal — es liest
	 * sich wie gesperrt.
	 */
	.knopf.leise {
		background: transparent;
		color: var(--akzent);
		border: 1px solid var(--akzent);
		font-weight: 500;
	}

	.knopf.leise:hover,
	.knopf.leise:focus-visible {
		background: var(--flaeche-2);
	}

	/*
	 * Die Karten stehen nebeneinander, sobald das Fenster es hergibt.
	 *
	 * Untereinander in einer Spalte liessen sie auf einem breiten Bildschirm die
	 * rechte Hälfte leer, und wer von «Läuft gerade» zu «Offene Punkte» wollte,
	 * musste scrollen — bei einer Übersicht genau das, was sie ersparen soll.
	 * `auto-fill` legt von selbst um: drei Spalten am Notebook, eine am Telefon.
	 */
	.karten {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(26rem, 100%), 1fr));
		gap: 0.75rem;
		align-items: start;
	}

	.karte {
		display: grid;
		gap: 0.35rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--linie);
		border-left: 4px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: inherit;
		text-decoration: none;
	}

	.karte:hover {
		border-color: var(--akzent);
	}

	.karte.jetzt {
		border-left-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 8%, var(--flaeche));
	}

	.marke {
		justify-self: start;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		font-size: 0.78rem;
		color: var(--text-leise);
	}

	.jetzt-marke {
		background: var(--akzent);
		color: var(--akzent-text);
	}

	.wann,
	.fuehrt {
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	.fortschritt {
		display: grid;
		gap: 0.3rem;
	}

	.balken {
		height: 4px;
		border-radius: 999px;
		background: var(--flaeche-2);
		position: relative;
		overflow: hidden;
	}

	.balken::after {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--anteil);
		background: var(--akzent);
	}

	.anteil {
		font-size: 0.85rem;
		color: var(--text-leise);
		font-variant-numeric: tabular-nums;
	}

	.punkt {
		padding: 0.85rem 1rem;
		border: 1px solid var(--linie);
		border-left: 4px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	.punkt.hindernis {
		border-left-color: var(--fehler);
		background: color-mix(in srgb, var(--fehler) 8%, var(--flaeche));
	}

	.bezug {
		margin: 0 0 0.25rem;
		font-weight: 600;
	}

	.text {
		margin: 0 0 0.5rem;
		font-size: 0.92rem;
	}

	.leer {
		color: var(--text-leise);
	}

	.zustand {
		margin-top: 2.5rem;
		padding: 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		max-width: 46rem;
	}

	.zustand h2 {
		margin-top: 0;
	}

	dl {
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}

	dl > div {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		justify-content: space-between;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--linie);
	}

	dl > div:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}

	dt {
		color: var(--text-leise);
	}

	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.gut {
		color: var(--akzent);
	}

	.schlecht {
		color: var(--fehler);
	}

	.warn {
		color: var(--warnung);
	}

	.hinweis {
		margin: 1rem 0 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--linie);
		color: var(--text-leise);
		font-size: 0.9375rem;
	}

	/* Der Einspringen-Hinweis ist kein Ausfall und soll trotzdem auffallen:
	   Warnfarbe an der Kante, nicht im ganzen Satz. */
	.hinweis.warnung {
		border-left: 3px solid var(--warnung);
		padding-left: 0.6rem;
	}
	/*
	 * Eine überfällige Versammlung ist keine Panne, aber auch nichts, worüber man
	 * hinwegliest: derselbe Rahmen wie die laufende, in Warnfarbe statt in der
	 * Akzentfarbe.
	 */
	.karte.ueberfaellig {
		border-left: 3px solid var(--warnung);
	}
</style>
