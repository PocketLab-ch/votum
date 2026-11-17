<script lang="ts">
	/**
	 * Was im Saal an der Wand steht — für **beide** Beamersichten dieselbe.
	 *
	 * **Warum es diese Komponente gibt.** Es gab zwei Präsentationssichten:
	 * `/p` mit dem Anzeigecode für ein fremdes Gerät, und
	 * `/versammlungen/<id>/praesentation` für das Fenster, das die
	 * Sitzungsleitung selbst öffnet. Die erste zeigte Abstimmung und Ergebnis,
	 * die zweite nicht — sie kannte nur das aufgerufene Traktandum und die
	 * Anwesenheitszahlen.
	 *
	 * Gemeldet am 02.08.2026: «Wenn ich das Ergebnis verkünden klicke, wird dies
	 * auf dem Monitor nicht angezeigt.» Genau so war es: Der Knopf
	 * «Beamerfenster öffnen» führt auf die zweite, und dort gab es nichts zu
	 * verkünden. Die Ende-zu-Ende-Prüfung sah es nicht, weil sie den Beamer über
	 * den Anzeigecode öffnet — also die andere Sicht.
	 *
	 * Zwei Sichten auf dieselbe Sache laufen auseinander, sobald eine geändert
	 * wird. Deshalb hier eine.
	 *
	 * **Was hier nie stehen darf:** ein Name oder ein Stimmverhalten. Die
	 * Leinwand hängt im Saal; der Zwischenstand einer offenen Abstimmung sind
	 * zwei Zahlen und sonst nichts (FR-37, AD-11).
	 */
	import type { Snippet } from 'svelte';
	import type { Abstimmungsstand } from '$lib/server/ereignisstrom';
	import type { Wandbildart } from '$lib/domain/versammlung';

	interface Traktandum {
		id: string;
		nummer: string;
		titel: string;
		tiefe: number;
		/** Für die Kennzeichnung «zur Kenntnisnahme» in der Liste. */
		art?: string;
	}

	interface Aufgerufen {
		nummer: string;
		titel: string;
		/** Vor der Abstimmung zurückgezogen (Probe Wertquotenmehr, 17.11.2026, B4). */
		zurueckgezogen?: boolean;
		kurzfassung?: string | null;
		antragswortlaut?: string | null;
		art?: string;
		erfordernis?: {
			titel: string | null;
			rechtsgrundlage: string;
			bezeichnung?: string | null;
		} | null;
		/**
		 * Der Satz, dass dieser Grundantrag durch einen Folgeantrag ersetzt
		 * wurde (Produktentscheid 08.10.2026, `ersetzungInKuerze`). Er steht
		 * über dem Titel, weil der ersetzte Grundantrag weder Ergebnis noch
		 * Schwelle trägt und der Satz die ganze Auskunft ist.
		 */
		ersetzung?: string | null;
		/**
		 * Was es braucht, damit dieser Antrag durchkommt — schon **vor** dem
		 * Öffnen der Abstimmung.
		 *
		 * Gerade hier ist sie am meisten wert: Solange nicht abgestimmt wird, kann
		 * der Saal noch etwas tun — vertagen, eine Vollmacht holen, jemanden
		 * anrufen. Ist die Abstimmung offen, trägt der Stand dieselbe Angabe
		 * mit, weil sie sich dann noch verschieben kann.
		 */
		noetig?: string | null;
		/**
		 * Warum die Wertquotenschranke stehen bleibt, während die Kopfbasis sinkt.
		 *
		 * Gemeldet am 05.09.2026 (Befund 15). Hier gehört er hin und nicht nur auf
		 * die Leitungsseite: Im Saal sehen alle, wie die eine Zahl fällt und die
		 * andere nicht, und gefragt wird dann laut. Ohne Namen (AD-11) — wer im
		 * Ausstand steht, sagt die Sitzungsleitung, nicht die Wand.
		 */
		ausstandsgrund?: string | null;
	}

	interface Eigenschaften {
		abstimmung: Abstimmungsstand | null;
		aufgerufen: Aufgerufen | null;
		traktanden: Traktandum[];
		/**
		 * Was gezeigt wird, solange kein Geschäft läuft (Migration 035). Fehlt es,
		 * bleibt es bei der Traktandenliste — so war es vorher immer.
		 */
		wandbild?: { art: Wandbildart; text?: string | null } | null;
		/** Für die Begrüssung: Gemeinschaft, Datum und Beginn. */
		anlass?: { gemeinschaft: string; wann: string; ort: string } | null;
		/**
		 * Die Unterbrechung (Migration 073) — sie überlagert alles.
		 *
		 * Anders als die Wandbilder, die nur greifen, solange kein Geschäft läuft:
		 * «Pause würde auch eine Abstimmung unterbrechen, wenn diese bspw.
		 * ungeplant ist (notfall, störung oder so)» (Auftraggeber, 21.08.2026).
		 */
		pause?: { seit: string; text?: string | null } | null;
		/**
		 * Der Abschluss (21.08.2026) — erst nach dem Schliessen belegt.
		 *
		 * «Auf der Präsentationssicht braucht es dann eine Abschlussseite.
		 * Eventuell mit den Auswertungen der Traktandenabstimmungen?» Genau dann:
		 * Alle stehen auf, und was beschlossen wurde, ist die letzte Frage des
		 * Abends.
		 */
		abschluss?: {
			angenommen: number;
			abgelehnt: number;
			ohneAbstimmung: number;
			/** Mit Beschlussvermerk: von Hand abgestimmt, nur im Protokoll (Block 7c). */
			vonHand?: number;
			zeilen: { nummer: string; titel: string; angenommen: boolean | null }[];
		} | null;
		/**
		 * Die Beschlussfähigkeit füllt die Wand, wo der aufgerufene Punkt sie zum
		 * Gegenstand hat (28.08.2026).
		 *
		 * **Warum sie hierher gehört und nicht davor** (01.09.2026). Zuerst stand
		 * sie als eigener Zweig in den Beamerseiten, **vor** dieser Komponente —
		 * und ersetzte damit alles, was hier eine Rangfolge hat. Solange ein Punkt
		 * mit «beschlussfähig» im Titel aufgerufen war, zeigte die Wand die
		 * Kacheln weiter, auch wenn die Versammlung in die Pause ging oder
		 * geschlossen wurde. Beides steht hier ausdrücklich «vor allem anderen».
		 *
		 * Eine Anzeige, die eine Rangfolge hat, gehört in die Rangfolge. Sie tritt
		 * an die Stelle der Traktandensicht, nicht an die Stelle des Saalbilds.
		 */
		beschlussfaehigkeit?: Snippet | null;
	}

	let {
		abstimmung,
		aufgerufen,
		traktanden,
		wandbild,
		anlass,
		pause,
		abschluss,
		beschlussfaehigkeit
	}: Eigenschaften = $props();

	const art = $derived(wandbild?.art ?? 'traktanden');

	/** Was tatsächlich beschlossen wurde — ohne die Punkte ohne Beschluss. */
	const beschluesse = $derived(
		(abschluss?.zeilen ?? []).filter(
			(z): z is { nummer: string; titel: string; angenommen: boolean } => z.angenommen !== null
		)
	);

	/**
	 * Die Traktandenliste an die Wand bringen, auch wenn es viele sind.
	 *
	 * Gefragt am 02.08.2026: «Das gibt Probleme, wenn es viele Traktanden sind.
	 * Da müsste die Traktandenliste auf zwei Spalten aufgeteilt werden, wenn die
	 * Grösse nicht ausreicht. Was, wenn sich diese nicht ausreicht? Wäre rollende
	 * Ansicht das Mittel der Wahl?»
	 *
	 * Drei Stufen, in dieser Reihenfolge:
	 *
	 *   1. **Eine Spalte**, solange die Liste in die Höhe passt.
	 *   2. **Zwei Spalten**, solange die halbe Höhe passt. Der Satz bleibt
	 *      stehen — man kann zeigen, was man meint.
	 *   3. **Rollend**, erst wenn auch das nicht mehr reicht. Bewegung ist der
	 *      letzte Ausweg, nicht der erste: Eine wandernde Liste lässt sich nicht
	 *      überfliegen, und wer den eigenen Punkt sucht, muss warten.
	 *
	 * Entschieden wird gerechnet, nicht ausprobiert: natürliche Höhe der Liste
	 * gegen die verfügbare Höhe. Ein zweiter Durchgang durch das Layout — erst
	 * setzen, dann nachsehen, ob es passt — flackerte an der Wand.
	 */
	let fensterEl: HTMLElement | undefined = $state();
	let listeEl: HTMLElement | undefined = $state();

	/** Wie viele Pixel in der Sekunde wandern. Langsam genug zum Mitlesen. */
	const TEMPO = 30;

	$effect(() => {
		// Ändert sich die Liste, muss neu gerechnet werden.
		traktanden.length;
		const fenster = fensterEl;
		const liste = listeEl;
		if (!fenster || !liste) return;

		const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)');

		function passe() {
			if (!fenster || !liste) return;
			// Erst zurück auf eine Spalte: Nur so misst `scrollHeight` die
			// natürliche Höhe und nicht das Ergebnis der letzten Anpassung.
			liste.classList.remove('zweispaltig', 'rollend');
			liste.style.removeProperty('--weg');
			liste.style.removeProperty('--dauer');

			const platz = fenster.clientHeight;
			const hoehe = liste.scrollHeight;
			if (!platz || !hoehe || hoehe <= platz) return;

			// Etwas Luft, damit die zweite Spalte nicht auf den letzten Pixel
			// gerechnet unten anschlägt.
			if (hoehe <= 2 * platz - 16 || ruhig.matches) {
				liste.classList.add('zweispaltig');
				return;
			}

			liste.classList.add('rollend');
			liste.style.setProperty('--weg', `${hoehe}px`);
			liste.style.setProperty('--dauer', `${Math.max(30, Math.round(hoehe / TEMPO))}s`);
		}

		// Die eigenen Änderungen wirken nach innen, nicht auf die Fenstergrösse —
		// trotzdem den Vergleich, damit kein Beobachter sich selbst weckt.
		let letzte = '';
		const beobachter = new ResizeObserver(() => {
			const jetzt = `${fenster.clientWidth}×${fenster.clientHeight}`;
			if (jetzt === letzte) return;
			letzte = jetzt;
			requestAnimationFrame(passe);
		});
		beobachter.observe(fenster);
		requestAnimationFrame(passe);
		ruhig.addEventListener('change', passe);

		return () => {
			beobachter.disconnect();
			ruhig.removeEventListener('change', passe);
		};
	});
</script>

{#if abschluss}
	<!-- ── Abschluss ─────────────────────────────────────────────────────────
		Vor der Pause und vor allem anderen: Ist die Versammlung geschlossen, gibt
		es nichts mehr zu unterbrechen und nichts mehr aufzurufen.

		**Nur Nummer, Titel, Ergebnis.** Keine Namen, keine Stimmzeilen — die
		Leinwand zeigt Zahlen (AD-11), und daran ändert der Abschluss nichts. Wer
		die Auszählung braucht, findet sie im Protokoll.
	-->
	<div class="bild abschluss">
		<h1>Versammlung geschlossen</h1>
		<p class="satz">
			{abschluss.angenommen === 1 ? '1 Antrag angenommen' : `${abschluss.angenommen} Anträge angenommen`}
			· {abschluss.abgelehnt === 1 ? '1 abgelehnt' : `${abschluss.abgelehnt} abgelehnt`}{#if abschluss.ohneAbstimmung > 0}{' '}· {abschluss.ohneAbstimmung} ohne
				Beschluss{/if}{#if (abschluss.vonHand ?? 0) > 0}{' '}· {abschluss.vonHand} von Hand abgestimmt
				(Ergebnis im Protokoll){/if}
		</p>
		<!--
			**Nur die Beschlüsse.** Die Liste zeigte zuerst alle Abstimmungspunkte,
			auch die ohne Beschluss — bei vierzehn Traktanden lief sie über den
			unteren Bildrand hinaus und schob die Überschrift aus dem Bild
			(nachgemessen, 21.08.2026). An der Wand steht am Ende die eine Frage:
			**was wurde beschlossen.** Wie viele ohne Beschluss blieben, sagt die
			Zeile darüber; welche es waren, sagt das Protokoll.

			Zwei Spalten, sobald es viele sind — dieselbe Stufenfolge wie bei der
			Traktandenliste, nur ohne den rollenden dritten Schritt: Beschlüsse
			wandern nicht, man will sie nebeneinander sehen.
		-->
		{#if beschluesse.length > 0}
			<ul class="beschluesse" class:zweispaltig={beschluesse.length > 8}>
				{#each beschluesse as z (z.nummer)}
					<li class:ja={z.angenommen} class:nein={!z.angenommen}>
						<span class="nr">{z.nummer}</span>
						<span class="was">{z.titel}</span>
						<span class="ob">{z.angenommen ? 'angenommen' : 'abgelehnt'}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{:else if pause}
	<!-- ── Pause ─────────────────────────────────────────────────────────────
		**Ganz oben, vor allem anderen.** Die Wandbilder weichen einem laufenden
		Geschäft; die Pause tut das Gegenteil — sie legt sich darüber. Wer
		unterbricht, will nicht, dass im Saal weiter abgestimmt wird, und die
		Wand ist das Einzige, was alle zugleich sehen.

		Kein Zeitstempel, kein Countdown: «Weiter um 20:15» steht im Text, wenn
		die Sitzungsleitung es so will. Eine mitlaufende Uhr an der Wand macht
		aus einer Pause ein Rennen.
	-->
	<div class="bild pause">
		<h1>Pause</h1>
		{#if pause.text}<p class="satz">{pause.text}</p>{/if}
	</div>
{:else if abstimmung && abstimmung.zustand === 'offen'}
	<!-- ── Abstimmung läuft ──────────────────────────────────────────────── -->
	<div class="bild abstimmung">
		<p class="traktandum">{abstimmung.titel}</p>
		<h1>{abstimmung.frage || 'Abstimmung'}</h1>
		{#if abstimmung.noetig}
			<p class="noetig">{abstimmung.noetig}</p>
		{/if}
		{#if abstimmung.ausstandsgrund}
			<p class="ausstandsgrund">{abstimmung.ausstandsgrund}</p>
		{/if}
		<p class="erfordernis">{abstimmung.erfordernis}</p>

		<div class="fortschritt">
			<span class="zahl">{abstimmung.abgegeben}</span>
			<span class="von">von {abstimmung.stimmberechtigt}</span>
			<span class="wort">haben abgestimmt</span>
		</div>
		{#if abstimmung.geheim}
			<!-- Die Ansage vor der Abstimmung: Wer jetzt abstimmt, soll wissen, dass
			     später niemand sieht, wie er gestimmt hat (DSG Art. 19; Fachprüfung
			     28.09.2026, F-5). -->
			<p class="geheim">Geheime Abstimmung</p>
		{/if}
		{#if abstimmung.konsultativ}
			<!-- Die Ansage vor der Abstimmung (Migration 158): Der Saal soll wissen,
			     dass daraus kein Beschluss wird. -->
			<p class="konsultativ">{abstimmung.konsultativSatz}</p>
		{/if}
		<!-- Wie abgestimmt wurde, steht hier nicht. Die Zahlen kommen erst mit dem
		     Ergebnis, und das erst nach der Freigabe (FR-37, FR-40). -->
	</div>
{:else if abstimmung?.ergebnis}
	<!-- ── Ergebnis ──────────────────────────────────────────────────────── -->
	<div class="bild ergebnis" class:angenommen={abstimmung.ergebnis.angenommen}>
		<p class="traktandum">{abstimmung.titel}</p>
		{#if abstimmung.ergebnis.nachRueckkommen}
			<!-- Nach einem Rückkommen ohne Beschluss: Das Ergebnis darunter ist das des
			     früheren Durchgangs. Über der Überschrift, sonst liest der Saal zuerst
			     das alte «Angenommen» (Reste vom 30.09.2026, Punkt 1; Laienprüfung L2). -->
			<p class="satz nach-rueckkommen">{abstimmung.ergebnis.nachRueckkommen}</p>
		{/if}
		<!-- «Kein Beschluss» ist kein «Abgelehnt» (Migration 128); den Grund sagt der Satz darunter. -->
		<h1>
			{abstimmung.ergebnis.keinBeschluss
				? 'Kein Beschluss'
				: abstimmung.ergebnis.angenommen
					? 'Angenommen'
					: 'Abgelehnt'}
		</h1>
		<p class="satz">{abstimmung.ergebnis.satz}</p>

		<!--
			**Bei geheimer Abstimmung kein Zahlenspiegel** (Produktentscheid
			28.09.2026): Wertquotensummen lassen sich auf Einheiten zurückrechnen.
			Der Satz darüber sagt nur, ob die Mehrheiten erreicht sind.
		-->
		{#if !abstimmung.ergebnis.geheim}
		<dl>
			<!--
				Ohne Köpfe die Wertquoten zuerst und die Köpfe als Auskunft (Regel «Köpfe
				zählen nicht», Codeprüfung Block A, N6; Laienprüfung 16.11.2026, L6).
			-->
			<div
				class:auskunft={abstimmung.ergebnis.koepfeAlsAuskunft === true}
			>
				<dt>
					Kopfstimmen{#if abstimmung.ergebnis.koepfeAlsAuskunft}{' '}(zur Auskunft){/if}
				</dt>
				<!--
					**Der Kopfspiegel** (Plan 30.09.2026, «Offen aus Block 1», Punkt 3):
					Wo nichts gegen eine Schwelle gerechnet wurde, stehen nur Ja, Nein
					und Enthaltung. «von N» und «ohne Abgabe» läsen sich wie eine
					Bezugsgrösse, die es nicht gab.
				-->
				<dd>
					{abstimmung.ergebnis.koepfe.ja} ja · {abstimmung.ergebnis.koepfe.nein} nein ·
					{abstimmung.ergebnis.koepfe.enthaltung} Enthaltung
					{#if !abstimmung.ergebnis.ohneSchwelle && abstimmung.ergebnis.koepfe.ohneAbgabe > 0}
						· {abstimmung.ergebnis.koepfe.ohneAbgabe} ohne Abgabe
					{/if}
				</dd>
				{#if !abstimmung.ergebnis.ohneSchwelle}
					<dd class="basis">
						von {abstimmung.ergebnis.koepfe.basis}{#if abstimmung.ergebnis.koepfe.schwelle !== null && !abstimmung.ergebnis.ohneNoetig}, nötig
							{abstimmung.ergebnis.koepfe.schwelle}{/if}
					</dd>
				{/if}
			</div>
			{#if abstimmung.ergebnis.quoten.schwelle !== null}
				<div>
					<dt>Wertquoten</dt>
					<dd>
						{abstimmung.ergebnis.quoten.ja} ja · {abstimmung.ergebnis.quoten.nein} nein ·
						{abstimmung.ergebnis.quoten.enthaltung} Enthaltung
					</dd>
					<dd class="basis">
						von {abstimmung.ergebnis.quoten.basis}{#if !abstimmung.ergebnis.ohneNoetig}, nötig {abstimmung.ergebnis.quoten.schwelle}{/if}
					</dd>
				</div>
			{/if}
		</dl>
		{/if}
	</div>
{:else if abstimmung && abstimmung.zustand === 'geschlossen'}
	<div class="bild warten">
		<p class="traktandum">{abstimmung.titel}</p>
		<h1>Abstimmung geschlossen</h1>
		<!-- Beim offenen Stichentscheid der Satz dazu (Probe Wertquotenmehr, B4). -->
		<p class="satz">{abstimmung.wartesatz ?? 'Das Ergebnis steht noch nicht fest.'}</p>
	</div>
{:else if beschlussfaehigkeit}
	<!-- ── Der Punkt, der die Beschlussfähigkeit zum Gegenstand hat ────────
		An der Stelle der Traktandensicht, nicht davor: Abschluss, Pause und eine
		laufende Abstimmung behalten ihren Vorrang. Was gezeigt wird, entscheidet
		die aufrufende Seite — die einzelne Versammlung nennt eine Gemeinschaft,
		der gemeinsame Abend deren mehrere.
	-->
	{@render beschlussfaehigkeit()}
{:else if aufgerufen}
	<!-- ── Traktandum ohne laufende Abstimmung ───────────────────────────── -->
	<div class="bild traktandumsicht">
		<p class="traktandum">Traktandum {aufgerufen.nummer}</p>
		<!--
			**Der Ersetzungssatz vor allem anderen** (Produktentscheid
			08.10.2026): Am ersetzten Grundantrag steht weder Ergebnis noch
			Schwelle; ohne den Satz wüsste der Saal nicht, was gilt. Wie beim
			Ergebnis nach einem Rückkommen zuerst, was geschah, dann der Rest.
		-->
		{#if aufgerufen.ersetzung}
			<p class="satz nach-rueckkommen">{aufgerufen.ersetzung}</p>
		{/if}
		<h1>{aufgerufen.titel}</h1>
		{#if aufgerufen.kurzfassung}
			<p class="kurzfassung">{aufgerufen.kurzfassung}</p>
		{/if}
		{#if aufgerufen.antragswortlaut}
			<blockquote>{aufgerufen.antragswortlaut}</blockquote>
		{/if}
		{#if aufgerufen.zurueckgezogen}
			<!-- Statt «nötig»: Es wird nicht abgestimmt (Probe Wertquotenmehr, B4). -->
			<p class="noetig">Zurückgezogen, es wird nicht abgestimmt.</p>
		{:else if aufgerufen.noetig}
			<p class="noetig">{aufgerufen.noetig}</p>
		{/if}
		{#if aufgerufen.ausstandsgrund && !aufgerufen.zurueckgezogen}
			<p class="ausstandsgrund">{aufgerufen.ausstandsgrund}</p>
		{/if}
		{#if aufgerufen.erfordernis}
			<p class="erfordernis">
				<!--
					**Der Quorumstyp als Marke** (Praxisfund 03.10.2026): Die Wand
					nannte Fall und Rechtsgrundlage, aber nicht «Einfaches Mehr».
					Der Saal soll sehen, unter welchem Typ abgestimmt wird; die
					Bezeichnung kommt aus der Fassung des Erfordernisses.
				-->
				{#if aufgerufen.erfordernis.bezeichnung}
					<span class="quorumstyp">{aufgerufen.erfordernis.bezeichnung}</span>
				{/if}
				{aufgerufen.erfordernis.titel}
				<span class="grundlage">{aufgerufen.erfordernis.rechtsgrundlage}</span>
			</p>
		{/if}
		{#if aufgerufen.art === 'kenntnisnahme'}
			<p class="satz">Zur Kenntnisnahme — hier wird nicht abgestimmt.</p>
		{/if}
	</div>
{:else if art === 'begruessung'}
	<!-- ── Vor dem Beginn ────────────────────────────────────────────────── -->
	<div class="bild gruss">
		<p class="traktandum">Herzlich willkommen</p>
		<h1>{anlass?.gemeinschaft ?? 'Versammlung der Stockwerkeigentümer'}</h1>
		{#if anlass}
			<p class="satz">{anlass.wann} · {anlass.ort}</p>
		{/if}
	</div>
{:else if art === 'frei'}
	<!-- ── Eigener Text, meist die Pause ─────────────────────────────────── -->
	<div class="bild freitext">
		<p>{wandbild?.text}</p>
	</div>
{:else}
	<!-- ── Nichts aufgerufen: die Traktandenliste ────────────────────────── -->
	<div class="bild liste">
		<h1>Traktanden</h1>
		<div class="fenster" bind:this={fensterEl}>
			<ol bind:this={listeEl}>
				{#each traktanden as t (t.id)}
					<li style:--tiefe={t.tiefe}>
						<span class="nr">{t.nummer}</span>
						{t.titel}
						{#if t.art === 'kenntnisnahme'}
							<span class="hinweis">zur Kenntnisnahme</span>
						{/if}
					</li>
				{/each}
				<!--
					Der zweite Satz steht immer im Baum und ist nur verborgen. Erst
					dadurch lässt sich die natürliche Höhe der Liste jederzeit messen,
					ohne auf einen Svelte-Durchlauf zu warten: Was `display: none` ist,
					zählt in `scrollHeight` nicht mit.
				-->
				{#each traktanden as t (t.id)}
					<li class="doppel" aria-hidden="true" style:--tiefe={t.tiefe}>
						<span class="nr">{t.nummer}</span>
						{t.titel}
						{#if t.art === 'kenntnisnahme'}
							<span class="hinweis">zur Kenntnisnahme</span>
						{/if}
					</li>
				{/each}
			</ol>
		</div>
	</div>
{/if}

<style>
	/* Für den Beamer gebaut: grosse Schrift, kein Bedienelement. Was hier steht,
	   liest der hinterste im Saal. */
	/*
	 * Ruhig und gross: In der Pause sieht man von hinten im Saal nur, DASS
	 * unterbrochen ist — mehr braucht es nicht.
	 */
	.bild.pause h1 {
		font-size: clamp(3rem, 12vw, 9rem);
	}

	/*
	 * Die Beschlussliste am Ende: lesbar aus der letzten Reihe, aber ohne die
	 * Grösse der Abstimmungsanzeige — hier wird gelesen, nicht erfasst.
	 */
	.beschluesse {
		list-style: none;
		margin: 1.2rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
		width: min(100%, 62rem);
		font-size: clamp(0.95rem, 1.9vw, 1.4rem);
	}

	.beschluesse.zweispaltig {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		width: min(100%, 90rem);
	}

	.beschluesse li {
		display: grid;
		grid-template-columns: 3.5rem minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, currentColor 6%, transparent);
		text-align: left;
	}

	.beschluesse .nr {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}

	.beschluesse .ob {
		font-weight: 600;
		white-space: nowrap;
	}

	.beschluesse li.ja {
		background: color-mix(in srgb, var(--akzent) 16%, transparent);
	}

	.beschluesse li.nein {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
	}

	.bild {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 0;
		overflow: hidden;
	}

	.traktandum {
		font-size: clamp(1rem, 2vw, 1.8rem);
		color: var(--text-leise);
		margin: 0 0 0.3em;
	}

	h1 {
		font-size: clamp(2rem, 5.5vw, 5rem);
		line-height: 1.05;
		margin: 0 0 0.3em;
	}

	.kurzfassung {
		font-size: clamp(1.1rem, 2.6vw, 2.4rem);
		color: var(--text-leise);
		margin: 0 0 0.5em;
		max-width: 40ch;
	}

	blockquote {
		font-size: clamp(1.2rem, 2.8vw, 2.6rem);
		font-weight: 600;
		border-left: 0.2em solid var(--akzent);
		padding-left: 0.6em;
		margin: 0 0 0.5em;
		max-width: 34ch;
	}

	.erfordernis {
		font-size: clamp(1rem, 2vw, 1.8rem);
		margin: 0;
	}

	/* Die Marke trägt den Typ («Einfaches Mehr») vor dem Fallnamen. */
	.quorumstyp {
		display: inline-block;
		font-size: 0.68em;
		font-weight: 600;
		border: 1px solid var(--akzent);
		border-radius: 999px;
		padding: 0.05em 0.6em;
		margin-right: 0.5em;
		white-space: nowrap;
	}

	.grundlage {
		display: block;
		font-size: 0.6em;
		color: var(--text-leise);
		font-family: ui-monospace, monospace;
	}

	.satz {
		font-size: clamp(1rem, 2.2vw, 2rem);
		color: var(--text-leise);
		margin: 0.2em 0 0;
		max-width: 40ch;
	}

	/* Zwei Zahlen und ein Wort — mehr darf eine offene Abstimmung nicht zeigen. */
	.fortschritt {
		display: flex;
		align-items: baseline;
		gap: 0.4em;
		margin-top: 0.6em;
		font-size: clamp(1.2rem, 3vw, 3rem);
	}

	.fortschritt .zahl {
		font-size: 1.8em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.fortschritt .von,
	.fortschritt .wort {
		color: var(--text-leise);
	}

	/* Angenommen oder abgelehnt muss aus zehn Metern zu unterscheiden sein — an
	   der Farbe, nicht am Lesen des Wortes. */
	.ergebnis h1 {
		color: var(--fehler);
	}

	.ergebnis.angenommen h1 {
		color: var(--akzent);
	}

	/*
	 * **Das Ergebnis füllt die verfügbare Höhe von oben** (31.08.2026, Block C3).
	 *
	 * `justify-content: center` schiebt den Inhalt in die Mitte und schneidet,
	 * was nach unten nicht mehr passt. Bei einer abgelehnten qualifizierten
	 * Abstimmung steht dort die Begründung — die muss ganz zu lesen sein, nicht
	 * halb hinter der Kante.
	 */
	.bild.ergebnis {
		justify-content: flex-start;
		padding-top: clamp(1.5rem, 4vh, 3rem);
	}

	.bild.ergebnis .satz {
		max-width: 56ch;
	}

	/*
	 * Die Zeile des Abschlussbilds trägt seit Block 7c bis zu vier Zahlen. Bei
	 * 40ch brach sie auf drei Zeilen um und schob bei 1280 × 720 die
	 * Überschrift oben aus dem Bild (gemessen 02.10.2026: von 10 px auf −12 px).
	 */
	.bild.abschluss .satz {
		max-width: 56ch;
	}

	dl {
		display: flex;
		gap: 2.5em;
		flex-wrap: wrap;
		margin: 0.6em 0 0;
		font-size: clamp(0.9rem, 1.8vw, 1.6rem);
	}

	dl div {
		min-width: 0;
	}

	/* Die Köpfe als Auskunft nach den Wertquoten (Regel «Köpfe zählen nicht»). */
	dl .auskunft {
		order: 2;
	}

	dt {
		font-weight: 600;
		color: var(--text-leise);
		font-size: 0.85em;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	dd {
		margin: 0.1em 0 0;
		font-variant-numeric: tabular-nums;
	}

	dd.basis {
		color: var(--text-leise);
		font-size: 0.85em;
	}

	/* Der freie Text ist meist ein Satz — er darf die ganze Wand haben. */
	.freitext {
		align-items: center;
		text-align: center;
	}

	.freitext p {
		margin: 0;
		font-size: clamp(2rem, 6vw, 6rem);
		font-weight: 700;
		line-height: 1.1;
		max-width: 20ch;
		white-space: pre-line;
	}

	/* Die Liste beginnt oben, nicht in der Mitte: Sie füllt die Fläche selbst. */
	.liste {
		justify-content: flex-start;
	}

	/* Das Fenster schneidet ab, die Liste darin darf grösser sein — sonst gäbe
	   es nichts zu rollen. */
	.liste .fenster {
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
	}

	.liste ol {
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: clamp(1rem, 2.2vw, 2rem);
	}

	/*
	 * Blockfluss statt Flexbox, und der Abstand als `padding` statt `gap`.
	 *
	 * Beides für den Spaltensatz: `column-count` wirkt an einer Flexbox nicht,
	 * und ein `gap` zwischen zwei Einträgen fehlt hinter dem letzten — die
	 * Schlaufe setzte dann sichtbar zu früh wieder an.
	 */
	.liste li {
		margin-left: calc((var(--tiefe) - 1) * 1.5em);
		display: flex;
		gap: 0.7em;
		padding-bottom: 0.35em;
		break-inside: avoid;
	}

	.liste .nr {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		min-width: 2.2em;
	}

	/* «zur Kenntnisnahme» — leise, damit die Nummer der Blickfang bleibt. */
	.liste .hinweis {
		font-size: 0.55em;
		color: var(--text-leise);
		align-self: center;
		white-space: nowrap;
	}

	/* Der zweite Satz zählt nur, wenn gerollt wird — sonst wäre jede Messung
	   der natürlichen Höhe doppelt so gross. */
	.liste .doppel {
		display: none;
	}

	/*
	 * `:global`, weil die zwei Klassen aus dem Skript kommen und nicht aus dem
	 * Baum: Svelte sieht sie nirgends stehen und hielte die Regeln sonst für
	 * überflüssig — und liesse sie weg.
	 */
	.liste ol:global(.zweispaltig) {
		height: 100%;
		column-count: 2;
		column-gap: 3rem;
	}

	.liste ol:global(.rollend) .doppel {
		display: flex;
	}

	.liste ol:global(.rollend) {
		animation: rollen var(--dauer) linear infinite;
	}

	/*
	 * **Kein Halt bei Mauszeiger.**
	 *
	 * Zuerst hielt die Liste an, solange der Zeiger über ihr stand — gedacht für
	 * den Fall, dass jemand im Saal auf einen Punkt zeigen will. In der Prüfung
	 * stand die Liste dauerhaft still: Der Zeiger liegt irgendwo, und wo er beim
	 * Öffnen des Fensters landet, entscheidet niemand bewusst.
	 *
	 * Eine Wand, die aus unerfindlichem Grund stehen bleibt und die niemand
	 * wieder in Gang bringt, ist schlimmer als eine, die durchläuft. Wer einen
	 * Punkt festhalten will, ruft das Traktandum auf — dann steht es gross und
	 * allein an der Wand.
	 */
	@keyframes rollen {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(calc(-1 * var(--weg)));
		}
	}
	/*
	 * **Die nötige Mehrheit auf der Wand.** Grösser als die Fallbezeichnung
	 * darunter, weil sie die Frage beantwortet, die im Saal gestellt wird — «wie
	 * viele brauchen wir?». Aber ohne Signalfarbe: Sie ist eine Angabe, keine
	 * Warnung, und der Saal soll sie lesen, nicht erschrecken.
	 */
	.noetig {
		font-size: clamp(1.1rem, 2.2vw, 2rem);
		font-weight: 600;
		margin: 0.4rem 0 0.2rem;
	}

	/*
	 * **Der Ausstandsgrund ist kleiner als die Zahl, die er erklärt.** Er steht
	 * nur dann da, wenn im Saal ohnehin gefragt wird, warum die eine Zahl fällt
	 * und die andere nicht — und er soll die Antwort geben, nicht die Frage
	 * überdecken. Aus zwei Zeilen Erklärung an der Wand liest ohnehin niemand
	 * mehr als den Anfang.
	 */
	.ausstandsgrund {
		font-size: clamp(0.8rem, 1.2vw, 1.05rem);
		margin: 0 0 0.3rem;
		max-width: 60ch;
		opacity: 0.85;
	}
</style>
