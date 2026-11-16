<script lang="ts">
	import { brauchtReglementsbeleg } from '$lib/domain/gemeinschaft';
	import { begrenzt, brauchtSuchfeld, filtereMitVorfahren, filtereNach } from '$lib/domain/listensuche';
	import { anfangswert } from '$lib/felder';
	import Archivschalter from '$lib/components/Archivschalter.svelte';
	import Sammelarchivierung from '$lib/components/Sammelarchivierung.svelte';
	import Meldung from '$lib/components/Meldung.svelte';
	import Sammelbericht from '$lib/components/Sammelbericht.svelte';

	let { data, form } = $props();

	/**
	 * Was zum Sammelarchivieren angekreuzt ist (Auftraggeber, 15.09.2026).
	 *
	 * **Ein `Set` in `$state.raw`, kein `$state(new Set())`.** Svelte 5 macht aus
	 * einem `Set` in `$state` zwar einen beobachteten Wert, aber die Absicht ist
	 * hier eine andere: Die Menge wird immer als Ganzes ersetzt, nie in sich
	 * verändert. Dieselbe Bauart wie bei den zugeklappten Gruppen der
	 * Seitenleiste; sie hält die Ableitungen unten frei von Überraschungen.
	 */
	let angekreuzt = $state.raw<Set<string>>(new Set());

	function kreuzeAn(id: string, an: boolean) {
		const neu = new Set(angekreuzt);
		if (an) neu.add(id);
		else neu.delete(id);
		angekreuzt = neu;
	}

	let suche = $state('');
	/** Ob die archivierten Gemeinschaften mitlaufen (Migration 086). */
	let archivZeigen = $state(false);

	const suchtext = (g: (typeof data.gemeinschaften)[number]) =>
		`${g.name} ${g.strasse ?? ''} ${g.plz ?? ''} ${g.ort ?? ''}`;

	/**
	 * Der Bestand, aus dem die Liste gebaut wird — je nach Schalter mit oder ohne
	 * Archiv.
	 *
	 * **Der Server liefert beides.** Das kostet ein paar Zeilen mehr über die
	 * Leitung und spart einen Seitenwechsel je Schalterstellung — und der
	 * Archivhinweis unten lässt sich damit exakt rechnen statt schätzen.
	 */
	/*
	 * **`imArchivSeit`, nicht `archiviertAm`** (Auftraggeber, 25.08.2026). Geschrieben
	 * wird das Archiv nur auf der Zeile, auf der man stand; im Archiv liegt aber
	 * die ganze Gruppe. Filterte die Liste nach der eigenen Spalte, stünden die
	 * fünf Häuser einer archivierten Klammer weiter da — eingerückt unter nichts.
	 */
	const bestand = $derived(
		archivZeigen ? data.gemeinschaften : data.gemeinschaften.filter((g) => !g.imArchivSeit)
	);

	/**
	 * Gesucht wird über Name und Adresse — mit den Vorfahren der Treffer.
	 *
	 * Eine getroffene Untergemeinschaft ohne ihre Klammer stünde eingerückt unter
	 * nichts und sähe aus wie eine eigenständige Gemeinschaft.
	 */
	const treffer = $derived(
		filtereMitVorfahren(
			bestand,
			suche,
			suchtext,
			(g) => g.id,
			(g) => g.parentStwegId
		)
	);

	/** Wie viele Archivierte es gibt und wie viele davon zur Suche passen. */
	const archiviert = $derived(data.gemeinschaften.filter((g) => g.imArchivSeit));
	/**
	 * **Dieselbe Suche wie die Liste** (25.08.2026, aus dem Code-Review).
	 *
	 * Vorher stand hier ein eigenes `includes` über die klein geschriebene
	 * Zeichenkette. Die Liste sucht aber über `filtereNach`: in Wörter zerlegt,
	 * mit Und verknüpft und ohne Akzente verglichen. Zwei Suchen, ein Satz —
	 * «berger nirgendweg» fand die Liste, der Zähler nicht, und der Hinweis
	 * blieb aus, obwohl der Schalter etwas gezeigt hätte.
	 */
	const imArchivGefunden = $derived(filtereNach(archiviert, suche, suchtext).length);

	// Die Liste kommt flach aus der Datenbank; die Zugehörigkeit macht erst die
	// Einrückung sichtbar. Ohne sie sieht eine Mehrhausanlage aus wie vier
	// unabhängige Gemeinschaften.
	const nachEltern = $derived.by(() => {
		const kinder = new Map<string | null, typeof data.gemeinschaften>();
		for (const g of treffer) {
			const schluessel = g.parentStwegId;
			if (!kinder.has(schluessel)) kinder.set(schluessel, []);
			kinder.get(schluessel)!.push(g);
		}
		return kinder;
	});

	/**
	 * Die Wurzeln der Anzeige — nicht bloss die ohne Elternteil.
	 *
	 * **Der Fehler, den das behebt** (25.08.2026, in der Sichtprobe gemessen).
	 * Der Baum lief von `null` abwärts. Sobald ein Elternteil aus dem gezeigten
	 * Bestand fällt — weil er archiviert ist und der Schalter aus —, wurden
	 * seine Kinder **nie besucht**: Ich archivierte «MEG Sonnenhof», und die
	 * Liste verlor drei Zeilen statt einer. Sonnenhof A und B verschwanden
	 * mit, obwohl niemand sie archiviert hatte.
	 *
	 * Eine Zeile darf nur verschwinden, weil sie selbst archiviert ist. Wessen
	 * Elternteil fehlt, steht deshalb als Wurzel da — sichtbar, nur ohne seine
	 * Einrückung.
	 */
	const wurzeln = $derived.by(() => {
		const drin = new Set(treffer.map((g) => g.id));
		return treffer.filter((g) => !g.parentStwegId || !drin.has(g.parentStwegId));
	});

	function geordnet(
		eigene: typeof data.gemeinschaften,
		tiefe = 0
	): { g: (typeof data.gemeinschaften)[0]; tiefe: number }[] {
		return eigene.flatMap((g) => [
			{ g, tiefe },
			...geordnet(nachEltern.get(g.id) ?? [], tiefe + 1)
		]);
	}

	/**
	 * Ohne Suchbegriff nur die ersten fünfundzwanzig Zeilen (A-49).
	 *
	 * Im Prüflauf 3,6 Bildschirmhöhen bei sechsundfünfzig Gemeinschaften, davon
	 * achtzehn «E2E …» und sechsundzwanzig «Prüflauf …». Geschnitten wird die
	 * bereits abgeflachte Liste: Eltern stehen darin vor ihren Kindern, ein
	 * Schnitt am Ende reisst also keine Zeile aus ihrem Zusammenhang.
	 */
	let alleZeigen = $state(false);
	const flach = $derived(geordnet(wurzeln));
	const sichtbar = $derived(begrenzt(flach, suche, alleZeigen));

	/**
	 * Die Auswahl in der Reihenfolge der Liste — und **nur, was sichtbar ist**.
	 *
	 * Wer etwas ankreuzt und dann die Suche einengt, sähe sonst «7 ausgewählt»
	 * bei drei sichtbaren Zeilen und archivierte vier Gemeinschaften, die er
	 * gerade nicht vor Augen hat. Die Auswahl selbst bleibt erhalten: Wer die
	 * Suche wieder weitet, findet seine Haken vor.
	 */
	const gewaehlt = $derived(
		sichtbar.zeigen.map(({ g }) => g.id).filter((id) => angekreuzt.has(id))
	);

	/**
	 * Ankreuzen geht nur, wo Archivieren überhaupt möglich ist.
	 *
	 * Wer keine Stammdaten ändern darf, bekommt kein Kästchen: Ein Haken, der in
	 * einer Absage endet, ist eine Einladung ins Leere (`domain/rollen`: «Ein
	 * Knopf, der zu einer Absage führt, gehört nicht hingestellt»). Und wer schon
	 * im Archiv liegt, ebenso wenig — dort wäre die Handlung wirkungslos.
	 */
	const darfAnkreuzen = $derived(Boolean(data.darfStammdaten));
</script>

<div class="kopf">
	<h1>Gemeinschaften</h1>
	{#if data.darfStammdaten}
		<a class="knopf" href="/gemeinschaften/neu">Gemeinschaft anlegen</a>
	{/if}
</div>

{#if data.gemeinschaften.length === 0}
	<p class="leer">
		{#if data.darfStammdaten}
			Noch keine Gemeinschaft erfasst. Fangen Sie mit einer an — Einheiten und Eigentümer kommen
			danach.
		{:else}
			Noch keine Gemeinschaft erfasst. Angelegt werden sie von der Bewirtschaftung.
		{/if}
	</p>
{:else}
	<!--
		Die Schwelle steht in `brauchtSuchfeld` und nicht hier: Bis zum 27.08.2026
		schrieb jede Listenseite ihre eigene, und die Personenliste zeigte ihre
		Suche schon ab einem Eintrag, während hier acht nötig waren.
	-->
	{#if brauchtSuchfeld({ durchsuchbar: bestand.length, archiviert: archiviert.length })}
		<div class="suchleiste">
			<label class="suchfeld">
				<span class="nurLeser">Gemeinschaft suchen</span>
				<input
					type="search"
					placeholder="Name oder Adresse"
					{...anfangswert(suche)}
					oninput={(e) => (suche = e.currentTarget.value)}
					autocomplete="off"
				/>
			</label>
			<Archivschalter
				art="gemeinschaft"
				archiviert={archiviert.length}
				trefferImArchiv={imArchivGefunden}
				gesucht={suche.trim().length > 0}
				aktivLeer={treffer.length === 0}
				bind:zeigen={archivZeigen}
			/>
			<!--
				**Die Zahl der gezeigten Zeilen, nicht der gefundenen** (03.09.2026).
				Der Zaehler sagte «137 von 137», waehrend darunter fuenfundzwanzig
				Zeilen standen: eine Zahl, die dem widerspricht, was man im selben
				Bild sieht. Wie viele es insgesamt sind, steht daneben; wie viele die
				Suche fand, sagt der Hinweis unter der Liste.
			-->
			<p class="zaehler">
				{sichtbar.zeigen.length} von {bestand.length}
				{bestand.length === 1 ? 'Gemeinschaft' : 'Gemeinschaften'}
			</p>
		</div>
	{/if}

	{#if treffer.length === 0}
		<p class="leer">
			{#if suche.trim()}
				Keine Gemeinschaft passt zu «{suche}».
			{:else}
				Keine Gemeinschaft — alle liegen im Archiv.
			{/if}
		</p>
		<!--
			Der Hinweis steht ein zweites Mal hier, weil die Leerstelle bei einer
			erfolglosen Suche der Ort ist, an dem man ihn liest — nicht die Leiste
			darüber, die man gerade bedient hat.
		-->
		<Archivschalter
			art="gemeinschaft"
			archiviert={archiviert.length}
			trefferImArchiv={imArchivGefunden}
			gesucht={suche.trim().length > 0}
			aktivLeer={true}
			mitSchalter={false}
			bind:zeigen={archivZeigen}
		/>
	{/if}

	{#if form?.quelle === 'sammel'}
		{#if form.fehler}
			<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
		{:else}
			<Sammelbericht
				ergebnis={form.ergebnis}
				marke={form}
				einzahl="Gemeinschaft"
				mehrzahl="Gemeinschaften"
				mitgegangenText={(n) =>
					n === 1 ? 'eine, die mit ihrer Klammer ging' : `${n}, die mit ihrer Klammer gingen`}
			/>
		{/if}
	{/if}

	<ul class="liste">
		{#each sichtbar.zeigen as { g, tiefe } (g.id)}
			<li style="--tiefe: {tiefe}" class:archiviert={g.imArchivSeit}>
				{#if darfAnkreuzen && !g.imArchivSeit}
					<!--
						**Das Kästchen steht vor der Zeile, nicht darin.** Die ganze Zeile ist
						ein Verweis; ein Kästchen innerhalb des `<a>` liesse sich nicht
						ankreuzen, ohne die Seite zu wechseln. Die Beschriftung nennt den
						Namen, weil «Auswählen» dreissigmal untereinander in einer
						Vorlesehilfe keine Auskunft ist.
					-->
					<!--
						`data-gefuehrt`: Diesen Haken führt der Browser, nicht der Server
						(die Markierung verlangt `scripts/eslint/felder.mjs`). Ein
						`angekreuzt(…)` aus `$lib/felder` setzte hier `defaultChecked` —
						richtig für einen Anfangswert, falsch für eine Auswahl, die sich
						ändert: «Auswahl aufheben» räumt die Menge, und die Haken blieben
						stehen. Der Wert **muss** dem Zustand folgen.
					-->
					<input
						type="checkbox"
						class="ankreuz"
						data-gefuehrt
						checked={angekreuzt.has(g.id)}
						onchange={(e) => kreuzeAn(g.id, e.currentTarget.checked)}
						aria-label="«{g.name}» auswählen"
					/>
				{/if}
				<a href="/gemeinschaften/{g.id}">
					<span class="name">{g.name}</span>
					{#if g.strasse || g.ort}
						<span class="adresse">{[g.strasse, [g.plz, g.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
					{/if}
				</a>
				<div class="merkmale">
					<!--
						**Die Marke steht vorn**, nicht hinter fünf anderen: Wer die Liste mit
						eingeschaltetem Archiv liest, muss auf einen Blick sehen, welche Zeile
						nur noch zum Nachschlagen da ist.
					-->
					{#if g.imArchivSeit}
						<span
							class="merkmal archivmarke"
							title={g.imArchivWegen
								? `Im Archiv, weil «${g.imArchivWegen.name}» archiviert ist`
								: (g.archivnotiz ?? 'Archiviert')}
						>
							archiviert{#if g.imArchivWegen}&nbsp;mit «{g.imArchivWegen.name}»{/if}
						</span>
					{/if}
					{#if g.quotaDenominator === 0}
						<!--
							«blosse Klammer» war Fachjargon (Auftraggeber, 12.08.2026). Die Marke sagt
							jetzt, was man sieht: Diese Gemeinschaft steht über anderen und führt
							selbst keine Wertquote.
						-->
						<span class="merkmal klammer" title="Ohne eigene Wertquote — die Anteile liegen bei den Gemeinschaften darunter.">
							übergeordnet
						</span>
					{:else}
						<span class="merkmal">{g.quotaDenominator}stel</span>
					{/if}
					{#if brauchtReglementsbeleg(g.headCountMode)}
						<span
							class="merkmal"
							class:abweichung={!g.headCountRuleSource}
							title={g.headCountRuleSource
								? `Gestützt auf ${g.headCountRuleSource}`
								: 'Fundstelle im Reglement fehlt — die Zählung je Einheit gilt nur, soweit das Reglement sie vorsieht.'}
						>
							Kopfstimme je Einheit
							{#if !g.headCountRuleSource}<span class="ohne-beleg">ohne Fundstelle</span>{/if}
						</span>
					{:else}
						<span class="merkmal" title="Gesetzliche Auffangregel — sie greift, wo das Reglement nichts anderes bestimmt.">
							Kopfstimme je Eigentümer
						</span>
					{/if}
					{#if g.untergemeinschaften > 0}
						<span class="merkmal">
							{g.untergemeinschaften}
							{g.untergemeinschaften === 1 ? 'Untergemeinschaft' : 'Untergemeinschaften'}
						</span>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
	{#if sichtbar.verborgen > 0}
		<p class="mehr">
			<strong>{sichtbar.verborgen} weitere</strong> — suchen Sie oben, oder
			<button type="button" class="flach" onclick={() => (alleZeigen = true)}>
				alle {flach.length} anzeigen
			</button>.
		</p>
	{/if}

	<Sammelarchivierung
		einzahl="Gemeinschaft"
		mehrzahl="Gemeinschaften"
		{gewaehlt}
		aufheben={() => (angekreuzt = new Set())}
	/>
{/if}

<style>
	/*
	 * Das Kästchen zum Sammelarchivieren. `--ziel-min` ist die Fläche, die ein
	 * Finger trifft — ein 13-px-Kästchen in einer 45-px-Zeile wird auf dem
	 * Telefon nicht getroffen, sondern umgangen (docs/gestaltung.md).
	 */
	.ankreuz {
		flex: 0 0 auto;
		width: 1.15rem;
		height: 1.15rem;
		min-height: 0;
		margin: 0;
		cursor: pointer;
	}


	.mehr {
		margin: 0.6rem 0 0;
		color: var(--text-leise);
	}


	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.knopf {
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
		padding: 0 1.1rem;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		text-decoration: none;
		font-weight: 550;
	}

	.leer {
		color: var(--text-leise);
		max-width: 40rem;
	}

	.liste {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.45rem 1rem;
		padding-left: calc(1rem + var(--tiefe) * 1.5rem);
		border-bottom: 1px solid var(--linie);
	}

	li:last-child {
		border-bottom: none;
	}

	li a {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		text-decoration: none;
		color: inherit;
		min-height: var(--ziel-min);
		justify-content: center;
		flex: 1 1 12rem;
	}

	.name {
		font-weight: 550;
	}

	li a:hover .name {
		text-decoration: underline;
	}

	.adresse {
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.merkmale {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	/*
	 * **Archiviertes tritt zurück, verschwindet aber nicht.** Halbe Deckkraft und
	 * keine Farbe: Die Zeile ist lesbar und offensichtlich nicht im Dienst. Sie
	 * ganz auszugrauen hiesse, sie unlesbar zu machen — und man schaltet das
	 * Archiv ja gerade ein, um sie zu lesen.
	 */
	li.archiviert {
		opacity: 0.65;
	}

	.merkmal.archivmarke {
		border-color: var(--warnung);
		color: var(--warnung);
	}

	.merkmal {
		font-size: 0.8125rem;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		color: var(--text-leise);
		white-space: nowrap;
	}

	.abweichung {
		background: color-mix(in srgb, var(--warnung) 18%, transparent);
		color: var(--warnung);
	}

	.ohne-beleg {
		font-style: italic;
		opacity: 0.85;
	}

	.klammer {
		font-style: italic;
	}
</style>
