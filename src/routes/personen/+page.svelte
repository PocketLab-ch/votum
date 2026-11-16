<script lang="ts">
	import { untrack } from 'svelte';
	import Sortierkopf from '$lib/components/Sortierkopf.svelte';
	import { begrenzt, brauchtSuchfeld, filtereNach } from '$lib/domain/listensuche';
	import { naechsteSortierung, sortiere, type Sortierung } from '$lib/domain/tabellensortierung';
	import { anfangswert } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';
	import Archivschalter from '$lib/components/Archivschalter.svelte';
	import Sammelarchivierung from '$lib/components/Sammelarchivierung.svelte';
	import Sammelbericht from '$lib/components/Sammelbericht.svelte';

	let { data, form } = $props();

	let suche = $state('');

	/** Was zum Sammelarchivieren angekreuzt ist (Auftraggeber, 15.09.2026). */
	let angekreuzt = $state.raw<Set<string>>(new Set());

	function kreuzeAn(id: string, an: boolean) {
		const neu = new Set(angekreuzt);
		if (an) neu.add(id);
		else neu.delete(id);
		angekreuzt = neu;
	}

	/**
	 * Steht das Anlegeformular offen?
	 *
	 * Zu, sobald es etwas zu sehen gibt — offen, solange die Liste leer ist: Dann
	 * ist Anlegen das Einzige, was hier zu tun ist, und ein zugeklappter Knopf
	 * über einer leeren Seite wäre eine Sackgasse.
	 *
	 * `untrack`, weil nur der **Anfangswert** gemeint ist: Wer aufklappt und die
	 * Seite lädt neu, soll sie nicht wieder zufallen sehen.
	 */
	/*
	 * **Nicht `bestand`** (25.08.2026, dritte Reviewrunde). `untrack` ruft die
	 * Closure **sofort** auf — `bestand` ist zwanzig Zeilen weiter unten
	 * deklariert und damit noch in der zeitlichen Totzone. Die Seite warf
	 * `ReferenceError: Cannot access 'bestand' before initialization`, und
	 * `npm run check` blieb dabei gruen: Der Uebersetzer kann nicht wissen, wann
	 * eine Closure laeuft. Hier steht deshalb, woraus `bestand` gebaut wird —
	 * derselbe Wert, ohne die Abhaengigkeit von einer spaeteren Zeile.
	 */
	let anlegenOffen = $state(
		untrack(() => data.personen.filter((p) => !p.archiviertAm).length === 0)
	);

	/**
	 * Gesucht wird über Name, Gemeinschaften und E-Mail.
	 *
	 * Die Gemeinschaft gehört dazu: «wer wohnt im Nirgendweg» ist die häufigere
	 * Frage als «gibt es einen Berger» — und ohne sie müsste man die Liste
	 * durchblättern, was bei 500 Zeilen 27 Bildschirme sind.
	 */
	/** Ob die archivierten Personen mitlaufen (Migration 086). */
	let archivZeigen = $state(false);
	const suchtext = (p: (typeof data.personen)[number]) =>
		`${p.name} ${p.parteien.map((x) => x.gemeinschaft).join(' ')} ${p.email ?? ''}`;

	const bestand = $derived(
		archivZeigen ? data.personen : data.personen.filter((p) => !p.archiviertAm)
	);
	const archiviert = $derived(data.personen.filter((p) => p.archiviertAm));
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

	const gefunden = $derived(filtereNach(bestand, suche, suchtext));

	/** Sortieren nach jeder der drei Spalten (Auftraggeber, 12.08.2026). */
	let sortierung = $state<Sortierung | null>(null);

	function wertVon(p: (typeof data.personen)[number], spalte: string): unknown {
		if (spalte === 'name') return p.name;
		if (spalte === 'gemeinschaften') return p.parteien.map((x) => x.gemeinschaft).join(', ');
		if (spalte === 'mail') return p.email;
		return null;
	}

	const treffer = $derived(sortiere(gefunden, sortierung, wertVon));

	/**
	 * Ohne Suchbegriff nur die ersten fünfundzwanzig (A-48).
	 *
	 * Beim Betreten stand «164 von 164 Eigentümern», «Ackermann» sechsundzwanzig
	 * Mal untereinander, 7,8 Bildschirmhöhen. Das Suchfeld war da und gut — nur
	 * merkt man erst nach dem Blättern, dass man es braucht.
	 */
	let alleZeigen = $state(false);
	/**
	 * Dieselbe Frage für die zweite Liste (03.09.2026).
	 *
	 * Sie stand ungekürzt da, während die obere seit dem Prüfdurchgang II
	 * gekürzt wird: gemessen 208 Zeilen auf einer Seite, deren erste Tabelle
	 * fünfundzwanzig zeigt. Ein eigener Zustand, weil beide Listen verschiedene
	 * Längen haben und wer die eine aufschlägt, nicht zwingend die andere meint.
	 */
	let alleUnverknuepft = $state(false);
	const sichtbar = $derived(begrenzt(treffer, suche, alleZeigen));

	/**
	 * Die Auswahl in der Reihenfolge der Tabelle — und **nur, was sichtbar ist**.
	 *
	 * Wer etwas ankreuzt und dann die Suche einengt, sähe sonst «7 ausgewählt»
	 * bei drei sichtbaren Zeilen und archivierte vier Personen, die er gerade
	 * nicht vor Augen hat. Die Haken selbst bleiben: Wer die Suche wieder weitet,
	 * findet sie vor.
	 */
	const gewaehlt = $derived(sichtbar.zeigen.map((p) => p.id).filter((id) => angekreuzt.has(id)));

	/**
	 * Ankreuzen geht nur, wo Archivieren möglich ist.
	 *
	 * Wer keine Stammdaten ändern darf, bekommt kein Kästchen — ein Haken, der in
	 * einer Absage endet, ist eine Einladung ins Leere. Und wer schon im Archiv
	 * liegt, ebenso wenig: Dort wäre die Handlung wirkungslos.
	 */
	const darfAnkreuzen = $derived(Boolean(data.darfStammdaten));

	/*
	 * **Derselbe Suchbegriff filtert beide Listen** — sonst hätte man zwei Suchen
	 * auf einer Seite, und die zweite fände man nicht.
	 */
	/**
	 * Wie viele Zeilen dieser eine Suchbegriff erreicht.
	 *
	 * **Nicht `bestand.length`** (27.08.2026, aus dem Code-Review): Die Seite
	 * führt zwei Tabellen, und beide hängen an demselben Feld. Nach einer
	 * Übernahme aus dem immotool können drei erfasste Personen über vierzig noch
	 * nicht zugeordneten Parteien stehen. Zählte die Schwelle nur die erste
	 * Liste, verschwände das einzige Suchfeld der Seite genau dann, wenn die
	 * zweite es am nötigsten braucht.
	 */
	const durchsuchbar = $derived(bestand.length + data.unverknuepft.length);

	const unverknuepfteTreffer = $derived(
		filtereNach(
			data.unverknuepft,
			suche,
			(p) => `${p.name} ${p.gemeinschaft} ${p.email ?? ''}`
		)
	);

	const unverknuepfteSichtbar = $derived(
		begrenzt(unverknuepfteTreffer, suche, alleUnverknuepft)
	);

	function sortiereNach(spalte: string) {
		sortierung = naechsteSortierung(sortierung, spalte);
	}

	/**
	 * Der Knopf oben rechts: aufklappen **und** hinbringen.
	 *
	 * Nur aufzuklappen genügte nicht — das Formular steht unter der Tabelle, und
	 * die ist bei 233 Eigentümern sechs Bildschirme lang. Ein Knopf, der etwas
	 * ausserhalb des Sichtfelds öffnet, sieht aus, als täte er nichts.
	 */
	let anlegenAbschnitt = $state<HTMLElement | null>(null);
	function erfassenOeffnen() {
		anlegenOffen = true;
		anlegenAbschnitt?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<!--
	**Der Weg zum Anlegen steht oben rechts** (Auftraggeber, 25.08.2026: «Eigentümer
	anlegen ist interessanterweise zuunterst. Mach es gleich wie bei
	Gemeinschaften»). Er stand als Ausklapper unter der Tabelle — bei 233
	Eigentümern sechs Bildschirme tief, also praktisch nicht auffindbar. Der
	Ausklapper bleibt, wo er ist; der Knopf klappt ihn auf und bringt ihn in den
	Blick.
-->
{#if data.geloescht}
	<p class="meldung gut" role="status">{data.geloescht} wurde gelöscht.</p>
{/if}

<!--
	**Diese Seite heisst «Personen», nicht «Eigentümer»** (Produktentscheid
	27.08.2026).

	Die beiden Wörter bezeichnen zwei verschiedene Dinge, und der Aufklapper
	«Wer ist was?» auf der Eigentümerseite bringt genau das bei: Ein
	**Eigentümer** ist die Zeile in **einer** Gemeinschaft, mit der Stimmkraft
	dort; eine **Person** ist derselbe Mensch über **alle** Gemeinschaften.
	Geführt wird hier das Zweite. Solange die Seite «Eigentümer» hiess, sagte
	die Navigation das Gegenteil dessen, was der Aufklapper erklärte.

	Nachgezogen wurden alle vier Stellen zusammen: Navigation
	(`src/routes/+layout.svelte`), Überschrift, Knopf und der Begleittext
	darunter. Eine davon stehenzulassen hiesse, die Unterscheidung erneut zu
	verwischen.
-->
<div class="kopf">
	<h1>Personen</h1>
	<button type="button" class="knopf" onclick={erfassenOeffnen}>Person erfassen</button>
</div>
<!--
	`einleitung`, nicht `lesebreite`: Der Erklärsatz unter der Überschrift tritt
	zurück (grau), und die Breite deckt `main > p:not(.breit)` ohnehin. Mit
	`lesebreite` stand er hier als einziger in der Farbe des Fliesstexts
	(02.09.2026 gemessen, Befund des Auftraggebers «das Layout unterscheidet sich»).
-->
<p class="einleitung">
	Hier steht jeder Mensch <strong>einmal</strong>, mit seinen Einheiten über alle Gemeinschaften
	hinweg. Die Eigentümerzeile in der jeweiligen Gemeinschaft entsteht dabei von selbst; sie trägt
	die Stimmkraft dort und wird bei jeder Versammlung eingefroren.
</p>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{/if}

<!--
	**Hier nicht zweispaltig, sondern zugeklappt** (Auftraggeber, 12.08.2026: Fläche
	besser nutzen). Nachgemessen war das Nebeneinander hier schlechter: Die
	Tabelle führt eine Spalte mit Gemeinschaftsnamen, und in einer halben Bahn
	(684 px) wuchs sie von 685 auf 1196 px — die Seite wurde von 1.57 auf 1.75
	Bildschirme länger statt kürzer.

	Also andersherum: Die Liste bekommt die ganze Breite, das Anlegeformular
	wartet hinter einem Knopf neben der Suche. Wer die Seite öffnet, sucht
	jemanden; wer anlegt, tut es einmal.
-->
<!--
	`archiviert.length > 0` gehört dazu (25.08.2026, vierte Reviewrunde): Sind
	alle Personen archiviert, ist `bestand` leer — und mit dem Block verschwänden
	Schalter und Hinweis, also der einzige Weg zurück. Die Gemeinschaftsliste
	löst denselben Fall genauso.
-->
<!--
	**Die Leiste steht ausserhalb des Tabellenblocks** (27.08.2026, aus dem
	Code-Review). Sie bedient zwei Listen: die Personentabelle und den Abschnitt
	«Noch keiner Person zugeordnet», der weiter unten und ausserhalb steht. Lag
	sie mit im Block, fehlte sie genau dann, wenn noch keine Person erfasst ist
	und vierzig unverknüpfte Parteien darunter stehen, also im Fall nach einer
	Übernahme aus dem immotool.

	Die Schwelle selbst zählt beide Listen (`durchsuchbar`). Der Archivschalter
	steht in derselben Leiste und geht nicht verloren, weil `brauchtSuchfeld`
	bei `archiviert > 0` immer wahr ist.
-->
{#if brauchtSuchfeld({ durchsuchbar, archiviert: archiviert.length })}
	<div class="suchleiste">
		<label class="suchfeld">
			<span class="nurLeser">Person suchen</span>
			<input
				type="search"
				placeholder="Name, Gemeinschaft oder E-Mail"
				{...anfangswert(suche)}
				oninput={(e) => (suche = e.currentTarget.value)}
				autocomplete="off"
			/>
		</label>
		<Archivschalter
			art="person"
			archiviert={archiviert.length}
			trefferImArchiv={imArchivGefunden}
			gesucht={suche.trim().length > 0}
			aktivLeer={treffer.length === 0 && unverknuepfteTreffer.length === 0}
			bind:zeigen={archivZeigen}
		/>
		<!-- «0 von 0 Personen» stünde da, wenn erst unverknüpfte Parteien erfasst
		     sind; der Zähler gehört zur oberen Tabelle und schweigt ohne sie. -->
		{#if bestand.length > 0}
			<!--
				**Die Zahl der gezeigten Zeilen, nicht der gefundenen** (03.09.2026):
				Der Zaehler sagte «137 von 137», waehrend darunter fuenfundzwanzig
				Zeilen standen.
			-->
			<p class="zaehler">
				{sichtbar.zeigen.length} von {bestand.length}
				{bestand.length === 1 ? 'Person' : 'Personen'}
			</p>
		{/if}
	</div>
{/if}

{#if bestand.length > 0 || archiviert.length > 0}

	<!--
		**«Niemand passt» nur, wenn wirklich niemand passt** (Nachprüfung
		23.08.2026). Der Satz hing allein an der oberen Tabelle — und stand
		deshalb direkt über dem Abschnitt, der den Treffer anzeigte. Die Suche
		fand die Partei, die Meldung darüber sagte das Gegenteil.

		Seit die unverknüpften Parteien mitgesucht werden (22.08.2026, Befund
		A-04), muss die Meldung beide Listen kennen.
	-->
	{#if treffer.length === 0 && unverknuepfteTreffer.length === 0}
		<p class="leer">
			{#if suche.trim()}
				Niemand passt zu «{suche}».
			{:else}
				<!-- Ohne Suchbegriff hiesse «passt zu «»» nichts (25.08.2026). -->
				Niemand erfasst — alle liegen im Archiv.
			{/if}
		</p>
		<Archivschalter
			art="person"
			archiviert={archiviert.length}
			trefferImArchiv={imArchivGefunden}
			gesucht={suche.trim().length > 0}
			aktivLeer={true}
			mitSchalter={false}
			bind:zeigen={archivZeigen}
		/>
	{/if}

	<div class="tabellenbahn">
	{#if form?.quelle === 'sammel'}
		<!--
			**Keine zweite Absage** (aus dem Code-Review, 15.09.2026). Die
			Fehlermeldung des Formulars steht schon weiter oben und gilt für jede
			Quelle; hier ein zweites Mal ausgegeben, stünde «Höchstens 200 auf
			einmal» doppelt auf der Seite. Der Bericht dagegen gibt es nur hier.
		-->
		{#if !form.fehler}
			<!--
				Kein `mitgegangenText`: Personen hängen an keinem Baum, es gibt keine
				Klammer, die jemanden mitnimmt. Der Baustein lässt den Satz dann weg.
			-->
			<Sammelbericht ergebnis={form.ergebnis} marke={form} einzahl="Person" mehrzahl="Personen" />
		{/if}
	{/if}

	<!-- svelte-ignore a11y_no_redundant_roles -->
	<table role="table" class="liste karten">
		<thead>
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<tr role="row">
				{#if darfAnkreuzen}
					<!--
						Eine Spalte ohne Beschriftung: Die Kästchen brauchen eine, aber
						«Auswahl» über dreissig Haken sagt nichts. `<th>` mit einer
						Beschriftung nur für Vorlesehilfen.
					-->
					<th scope="col" class="ankreuzspalte"><span class="nurLeser">Auswahl</span></th>
				{/if}
				<Sortierkopf spalte="name" {sortierung} klick={sortiereNach}>Name</Sortierkopf>
				<Sortierkopf spalte="gemeinschaften" {sortierung} klick={sortiereNach}>
					Gemeinschaften
				</Sortierkopf>
				<Sortierkopf spalte="mail" {sortierung} klick={sortiereNach}>E-Mail</Sortierkopf>
			</tr>
		</thead>
		<tbody>
			{#each sichtbar.zeigen as p (p.id)}
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<tr role="row">
					{#if darfAnkreuzen}
						<td role="cell" class="ankreuzspalte">
							{#if !p.archiviertAm}
								<!--
									`data-gefuehrt`: Diesen Haken führt der Browser, nicht der
									Server (siehe `scripts/eslint/felder.mjs`). Er muss dem
									Zustand folgen, sonst blieben die Haken nach «Auswahl
									aufheben» stehen.
								-->
								<input
									type="checkbox"
									class="ankreuz"
									data-gefuehrt
									checked={angekreuzt.has(p.id)}
									onchange={(e) => kreuzeAn(p.id, e.currentTarget.checked)}
									aria-label="«{p.name}» auswählen"
								/>
							{/if}
						</td>
					{/if}
					<td role="cell" class="kopfzelle">
						<a href="/personen/{p.id}">{p.name}</a>
						<!--
							**Die Marke, sobald der Schalter an ist** (25.08.2026, aus dem
							Code-Review). Ohne sie stehen archivierte und aktive Zeilen
							ununterscheidbar nebeneinander — man holt die falsche hervor.
						-->
						{#if p.archiviertAm}
							<span class="archivmarke" title={p.archivnotiz ?? 'Archiviert'}>archiviert</span>
						{/if}
					</td>
					<td role="cell" data-spalte="Gemeinschaften">
						{#if p.parteien.length === 0}
							<span class="leer">noch keine Einheit zugeordnet</span>
						{:else}
							{p.parteien.map((x) => x.gemeinschaft).join(', ')}
						{/if}
					</td>
					<td role="cell" data-spalte="E-Mail">{p.email ?? '—'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	</div>
	{#if sichtbar.verborgen > 0}
		<p class="mehr">
			<strong>{sichtbar.verborgen} weitere</strong> — suchen Sie oben, oder
			<button type="button" class="flach" onclick={() => (alleZeigen = true)}>
				alle {treffer.length} anzeigen
			</button>.
		</p>
	{/if}

	<Sammelarchivierung
		einzahl="Person"
		mehrzahl="Personen"
		{gewaehlt}
		aufheben={() => (angekreuzt = new Set())}
	/>
{/if}

<!--
	**Eigentümerzeilen ohne Person** (22.08.2026, Befund A-04). Über der Liste
	steht «Hier steht jeder Mensch einmal», und die Suche fand im
	Prüflauf 4 von 5. Die fünfte, ein Ehepaar, war nur als Partei in ihrer
	Gemeinschaft erfasst und nie verknüpft; die Liste oben liest ausschliesslich
	Personen.

	**Eine Suche, die 4 von 5 findet, ist schlimmer als keine:** Sie antwortet
	«Niemand passt zu …», wo jemand ist — und wer das liest, legt die Partei ein
	zweites Mal an.

	Getrennt statt untergemischt: Diese Zeilen haben keine Personenkennung und
	damit keine eigene Seite. Sie führen dorthin, wo sie entstanden sind — und
	derselbe Suchbegriff filtert beide Listen.
-->
{#if unverknuepfteTreffer.length > 0}
	<section class="unverknuepft">
		<h2>Noch nicht mit einer Person verknüpft</h2>
		<!--
			**Auch diese Liste nennt ihre Zahlen** (03.09.2026). Sie wird seit heute
			gekürzt, und ohne Zähler sähe man weder, wie viele Zeilen dastehen,
			noch wie viele es insgesamt sind. Dieselbe Form wie oben.
		-->
		<p class="zaehler">
			{unverknuepfteSichtbar.zeigen.length} von {data.unverknuepft.length}
			{data.unverknuepft.length === 1 ? 'Zeile' : 'Zeilen'}
		</p>
		<p class="lesebreite klein">
			Diese Eigentümerzeilen stehen in ihrer Gemeinschaft, sind aber nicht mit einer Person
			über den Gemeinschaften verknüpft. Sie stimmen und zählen dort ganz normal mit; was
			fehlt, ist die Klammer über mehrere Gemeinschaften hinweg.
		</p>
		<table class="liste">
			<thead>
				<tr><th scope="col">Name</th><th scope="col">Gemeinschaft</th><th scope="col">E-Mail</th></tr>
			</thead>
			<tbody>
				{#each unverknuepfteSichtbar.zeigen as p (p.parteiId)}
					<tr>
						<td>{p.name}</td>
						<td><a href="/gemeinschaften/{p.stwegId}/eigentuemer">{p.gemeinschaft}</a></td>
						<td>{p.email ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if unverknuepfteSichtbar.verborgen > 0}
			<p class="mehr">
				<strong>{unverknuepfteSichtbar.verborgen} weitere</strong> — suchen Sie oben, oder
				<button type="button" class="flach" onclick={() => (alleUnverknuepft = true)}>
					alle {unverknuepfteTreffer.length} anzeigen
				</button>.
			</p>
		{/if}
	</section>
{/if}

<section
	class="anlegen"
	class:kachel={anlegenOffen}
	class:offen={anlegenOffen}
	bind:this={anlegenAbschnitt}
>
	<button type="button" class="klappe" onclick={() => (anlegenOffen = !anlegenOffen)}>
		{anlegenOffen ? '−' : '+'} Person erfassen
	</button>
	{#if anlegenOffen}
<form method="POST" action="?/anlegen" class="felder">
	<label class="breit">
		Name
		<input name="name" required minlength="2" placeholder="Renate Berger" />
	</label>
	<label>
		Art
		<select name="art">
			<option value="natural">natürliche Person</option>
			<option value="legal">juristische Person</option>
		</select>
	</label>
	<label class="breit">
		E-Mail
		<input name="email" type="email" />
		<span class="hilfe">
			Später der Anknüpfungspunkt für einen eigenen Zugang über Authentik — ein Konto je Person,
			nicht je Gemeinschaft.
		</span>
	</label>
	<label>
		Telefon
		<input name="telefon" />
	</label>
	<label class="voll">
		Adresse
		<input name="adresse" />
	</label>
	<button type="submit" class="haupt">Anlegen</button>
</form>
	{/if}
</section>

<style>
	/* Wie auf der Gemeinschaftsseite: Überschrift links, Handlung rechts. */
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
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	/* Der Hinweis steht unter der Liste, wo das Blättern endet — nicht darüber,
	   wo er wie eine Warnung aussähe. */
	.mehr {
		margin: 0.6rem 0 0;
		color: var(--text-leise);
	}


	.anlegen {
		margin-top: 1.25rem;
	}

	/*
	 * Offen bekommt der Abschnitt den Kachelrahmen aus `app.css` — zu ist er nur
	 * eine Zeile. Deshalb hier nur der schmalere obere Innenabstand: Der Knopf
	 * trägt seine Zielgrösse selbst.
	 */
	.anlegen.offen {
		padding-top: 0.5rem;
	}

	.klappe {
		background: none;
		border: none;
		color: var(--akzent);
		cursor: pointer;
		font: inherit;
		font-weight: 550;
		min-height: var(--ziel-min);
		padding: 0;
		text-align: left;
	}

	.liste {
		width: 100%;
		border-collapse: collapse;
		margin: 1rem 0 0;
	}

	/*
	 * **`:where(.liste)`, damit die Karte gewinnt** (Auftrag V2, 06.10.2026).
	 * Als `.liste td` wog die Regel mehr als `table.karten td` aus app.css, und
	 * unter 46rem trug in der Karte jede Angabe eine Linie und seitliches
	 * Polster (gemessen 100 von 100 Zellen). `:where()` zählt nicht, und die
	 * Karte setzt sich durch; die untere Tabelle ohne `karten` behält die Regel.
	 */
	:where(.liste) td {
		padding: 0.3rem 0.5rem;
		border-bottom: 1px solid var(--linie);
	}

	/*
	 * **Die Köpfe, die nicht aus `Sortierkopf.svelte` kommen** (UI-Durchgang
	 * 06.10.2026). Die untere Tabelle führt gewöhnliche `th`, und für die gab es
	 * hier keine Regel: gemessen 17 px, fett, mittig, ohne Linie, über einer
	 * Tabelle, deren Nachbar oben 12.8 px in Grossbuchstaben mit Linie trägt.
	 * Dieselben Werte wie im Sortierkopf; die Regel erreicht dessen `th` nicht
	 * (Stilkapselung), wohl aber das Auswahl-`th` der oberen Tabelle.
	 */
	.liste th {
		border-bottom: 1px solid var(--linie);
		color: var(--text-leise);
		font-size: 0.8rem;
		font-weight: 600;
		height: 2.25rem;
		letter-spacing: 0.03em;
		padding: 0.35rem 0.5rem;
		text-align: left;
		text-transform: uppercase;
		white-space: nowrap;
	}

	/*
	 * Die Namensspalte bekommt die Breite, die Angaben daneben nicht mehr als
	 * nötig: Vorher standen «noch keine Einheit zugeordnet» in der Mitte des
	 * Bildschirms und die E-Mail am fernen rechten Rand, mit einer Handbreit
	 * Leere dazwischen.
	 */
	/* Die Breite über die Zellen: Der Kopf kommt aus einer Komponente und ist von
	   hier aus nicht mehr ansprechbar. Für die Spaltenbreite genügt eine Zeile. */
	/*
	 * Die Namensspalte trägt die Breite — und das ist seit dem 15.09.2026 nicht
	 * mehr immer die erste Zelle.
	 *
	 * **Der Anlass** (Auftraggeber, am Bildschirm gezeigt): «Die checkbox passt nicht zur
	 * Tabelle. Viel zu breite Spalte.» Diese Regel hiess `td:first-child` und
	 * meinte den Namen; seit die Auswahlspalte davor steht, traf sie das
	 * Kästchen — 22rem für einen Haken von 1,15rem. Und sie gewinnt gegen
	 * `.ankreuzspalte`, weil eine Pseudoklasse die Spezifität hebt.
	 *
	 * Beide Tabellen dieser Seite sind gedeckt: Die untere (Eigentümerzeilen ohne
	 * Person) hat kein Kästchen, dort bleibt die erste Zelle der Name.
	 */
	/*
	 * **Nur, solange die Tabelle eine Tabelle ist** (UI-Durchgang 06.10.2026).
	 * Unter 46rem wird die obere Tabelle zur Kartenliste (`table.karten` in
	 * `app.css`), und dort machte die feste Breite die Namenszelle 352 px breit:
	 * Sie ragte mit ihrer Linie 8 px über den Rand der 358 px breiten Karte.
	 * Dieselbe Grenze wie dort.
	 */
	@media not all and (max-width: 46rem) {
		.liste td:first-child:not(.ankreuzspalte),
		.liste td.ankreuzspalte + td {
			width: 22rem;
		}

		.liste td:last-child {
			width: 18rem;
		}
	}

	.leer,
	.hilfe {
		color: var(--text-leise);
		font-size: 0.875rem;
		font-weight: 400;
	}

	.hilfe {
		display: block;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		max-width: var(--lesebreite);
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}
	.unverknuepft {
		margin-top: 2rem;
	}
	/*
	 * Die Spalte zum Sammelarchivieren — so schmal wie ihr Inhalt. `--ziel-min`
	 * ist die Fläche, die ein Finger trifft (docs/gestaltung.md).
	 */
	/*
	 * So schmal wie ihr Inhalt: `width: 1px` mit `nowrap` ist der übliche Weg,
	 * eine Tabellenspalte auf ihre Mindestbreite zu zwingen — die übrigen Spalten
	 * nehmen den Rest.
	 */
	.ankreuzspalte {
		width: 1px;
		padding-right: 0;
		white-space: nowrap;
	}

	.ankreuz {
		width: 1.15rem;
		height: 1.15rem;
		min-height: 0;
		margin: 0;
		cursor: pointer;
	}
</style>
