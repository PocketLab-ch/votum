<script lang="ts">
	/**
	 * Der Verlauf mit Suche und Filter.
	 *
	 * Die Filter stehen in der Adresse und werden als gewöhnliches Formular
	 * abgeschickt (GET). Das ist hier nicht Sparsamkeit, sondern die Sache
	 * selbst: Der Verlauf wird seitenweise gelesen, also muss die Datenbank
	 * filtern — und dann ist die Adresse ohnehin der Ort, an dem der Filterstand
	 * steht. Nebenbei funktioniert die Seite damit auch ohne JavaScript, und
	 * jeder Stand lässt sich verschicken.
	 */
	import {
		angabenInWorten,
		beschriftung,
		gegenstandsart,
		type AngabenAufloeser
	} from '$lib/domain/verlauf';
	import { wertwoerter } from '$lib/domain/verlaufswerte';
	import { bereichsname, istGefiltert, verlaufsAdresse } from '$lib/domain/verlaufsfilter';
	import { anfangswert } from '$lib/felder';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';

	let { data } = $props();

	const gefiltert = $derived(istGefiltert(data.filter));

	/**
	 * **Was diese Seite auflösen kann** (B2, 03.10.2026). Sie lädt ohnehin alle
	 * Versammlungen und Gemeinschaften für die Filter; mehr Listen hat sie
	 * nicht. Eine Versammlung oder Gemeinschaft, die nicht in den Listen steht,
	 * erscheint in der Rückfallform (`nichtZugeordnet`); jede andere Kennung
	 * sucht die Seite gar nicht (`undefined`) und zeigt sie neutral als
	 * «interne Kennung …». Das Siegelpaket kennt zusätzlich Traktanden und
	 * Parteien; dieselbe Anzeige, ein weiter gehender Auflöser. Die Werte in
	 * Worten zeigen Seite und Blatt im Siegelpaket (Kommentar unten).
	 */
	const aufloeser: AngabenAufloeser = (wert, schluessel) => {
		if (schluessel === 'versammlung') {
			return data.versammlungen.find((v) => v.id === wert)?.bezeichnung ?? null;
		}
		if (
			schluessel === 'gemeinschaft' ||
			schluessel === 'stweg' ||
			schluessel === 'mitgliedsgemeinschaft'
		) {
			return data.gemeinschaften.find((g) => g.id === wert)?.name ?? null;
		}
		return undefined;
	};

	/**
	 * Zeitpunkt in Schweizer Schreibweise. Die Zeit kommt in UTC aus der Datenbank
	 * (AD-12); umgerechnet wird erst hier, damit im Verlauf nichts doppelt
	 * verschoben wird.
	 */
	const formatiere = new Intl.DateTimeFormat('de-CH', {
		dateStyle: 'short',
		timeStyle: 'medium',
		timeZone: 'Europe/Zurich'
	});

	// Die Art des Gegenstands und die Codewörter in den Angaben kommen aus dem
	// Kern (`gegenstandsart`, `wertwoerter`); das Verlaufsblatt im Siegelpaket
	// nimmt sie ebenfalls (`server/siegel.ts`).
</script>

<h1>Verlauf</h1>

<p class="einleitung">
	Jede fachlich bedeutsame Handlung mit Zeitpunkt und handelnder Person. Einträge lassen sich
	weder ändern noch löschen — auch nicht durch die Anwendung selbst.
</p>

<!--
	Die Ereignisart und der Gegenstand kommen als verborgene Felder mit: Sie
	entstehen durch einen Klick in der Tabelle und dürfen beim Abschicken der
	Suche nicht verlorengehen. Der Verweis «Verlauf dieser Versammlung» setzt
	dagegen das sichtbare Auswahlfeld `versammlung`.
-->
<form method="GET" class="filterleiste">
	{#if data.filter.art}<input type="hidden" name="art" value={data.filter.art} />{/if}
	{#if data.filter.gegenstand}
		<input type="hidden" name="gegenstand" value={data.filter.gegenstand} />
	{/if}

	<div class="reihe suchreihe">
		<label class="suchfeld">
			<span class="beschriftung">Suche</span>
			<input
				type="search"
				name="suche"
				placeholder="Person, Kennung oder Angabe"
				{...anfangswert(data.filter.suche ?? '')}
				autocomplete="off"
			/>
		</label>
	</div>

	<!--
		**Die drei Eingrenzungen zusammen, in gleichen Spalten** (Auftraggeber, 02.09.2026:
		«Bei Verlauf gibt es für jeden Bereich eine eigene Suchfunktion? Kann man
		nicht einfach eine Suchfunktion erstellen?»).

		Nein, kann man nicht: Die Suche darüber liest Text, diese drei sind exakte
		Zuordnungen. «Alle Einträge zu Gemeinschaft X» ist etwas anderes als «alle
		Einträge, in denen X vorkommt».

		Der Eindruck kam von der Anordnung. In einer Flusszeile mit
		`align-items: end` zerriss die Paarung: Über einem Tippfeld stand
		«Bereich», und die zugehörige Auswahlliste rutschte in die Zeile der Suche.
		Gemessen bei 1440 px standen die sieben Felder auf FÜNF verschiedenen
		Oberkanten (289, 364, 443, 516, 543), mit Breiten von 87 bis 739 px — man
		sah vier Tippfelder und drei Listen ohne erkennbare Zuordnung.

		Die Reihenfolge im Markup bleibt: Wer sucht, weiss meist erst WORÜBER und
		grenzt dann ein, WANN (25.08.2026).
	-->
	<div class="reihe filterreihe">
		<label>
			<span class="beschriftung">Bereich</span>
			<Suchauswahl
				name="bereich"
				beschriftung="Bereich"
				leerText="alle"
				wert={data.filter.bereich ?? ''}
				eintraege={data.bereiche.map((b) => ({
					wert: b.bereich,
					text: `${bereichsname(b.bereich)} (${b.anzahl})`
				}))}
			/>
		</label>

		<!--
			**Gemeinschaft und Versammlung** (Auftraggeber, 25.08.2026: «Beim Verlauf braucht
			es noch einen Filter nach Versammlung und nach Gemeinschaft»).
	
			Sie stehen VOR den Datumsfeldern, weil man meist erst weiss, WORUEBER man
			etwas sucht, und dann eingrenzt, wann. Und die Gemeinschaft vor der
			Versammlung: Sie ist die groebere Frage.
	
			Beide greifen ueber die zugehoerigen Gegenstaende mit — ein Traktandum, eine
			Vollmacht und eine Einlasszeile tragen ihre eigene Kennung, nicht die der
			Versammlung. Die Bedingung dazu steht im Server (`gehoertZu`).
		-->
		<label>
			<span class="beschriftung">Gemeinschaft</span>
			<Suchauswahl
				name="gemeinschaft"
				beschriftung="Gemeinschaft"
				leerText="alle"
				wert={data.filter.gemeinschaft ?? ''}
				eintraege={data.gemeinschaften.map((g) => ({ wert: g.id, text: g.name }))}
			/>
		</label>

		<label>
			<span class="beschriftung">Versammlung</span>
			<Suchauswahl
				name="versammlung"
				beschriftung="Versammlung"
				leerText="alle"
				wert={data.filter.versammlung ?? ''}
				eintraege={data.versammlungen.map((v) => ({ wert: v.id, text: v.bezeichnung }))}
			/>
		</label>
	</div>

	<div class="reihe zeitreihe">
		<label>
			<span class="beschriftung">von</span>
			<input type="date" name="von" {...anfangswert(data.filter.von ?? '')} />
		</label>

		<label>
			<span class="beschriftung">bis</span>
			<input type="date" name="bis" {...anfangswert(data.filter.bis ?? '')} />
		</label>

		<button type="submit">Filtern</button>
		{#if gefiltert}
			<a class="aufheben" href="/verlauf">Filter aufheben</a>
		{/if}
	</div>
</form>

{#if data.filter.art || data.filter.gegenstand}
	<p class="filtermarken">
		{#if data.filter.art}
			<span class="filtermarke">
				Handlung: <strong>{beschriftung(data.filter.art)}</strong>
				<a
					href={verlaufsAdresse({ ...data.filter, art: undefined })}
					aria-label="Filter auf die Handlung aufheben">×</a
				>
			</span>
		{/if}
		{#if data.filter.gegenstand}
			<span class="filtermarke">
				Ein einzelner Gegenstand
				<a
					href={verlaufsAdresse({ ...data.filter, gegenstand: undefined })}
					aria-label="Filter auf den Gegenstand aufheben">×</a
				>
			</span>
		{/if}
	</p>
{/if}

{#if data.zeilen.length === 0}
	<p class="leer">
		{#if gefiltert}
			Kein Eintrag passt zu diesem Filter.
		{:else}
			Noch keine Einträge.
		{/if}
	</p>
{:else}
	<p class="zaehler">
		{data.gesamt}
		{data.gesamt === 1 ? 'Eintrag' : 'Einträge'}{#if data.gesamt > data.zeilen.length}{' '}·
			angezeigt {data.seite * 50 + 1}–{data.seite * 50 + data.zeilen.length}{/if}
	</p>

	<div class="tabellenrahmen">
		<table>
			<thead>
				<tr>
					<th>Zeitpunkt</th>
					<th>Handlung</th>
					<th>Person</th>
					<th>Gegenstand</th>
					<th>Angaben</th>
				</tr>
			</thead>
			<tbody>
				{#each data.zeilen as zeile (zeile.id)}
					<tr>
						<td class="zeit">
							{formatiere.format(new Date(zeile.zeitpunkt))}
							{#if zeile.zeitquelle !== 'system'}
								<span
									class="uhrwarnung"
									title="Die Uhrzeit stammt von der Uhr des Geräts. Ob diese abgeglichen war, ist nicht festgehalten, und sie kann abweichen."
								>
									Uhr ungesichert
								</span>
							{/if}
						</td>
						<td>
							<a href={verlaufsAdresse({ ...data.filter, art: zeile.art })}>
								{beschriftung(zeile.art)}
							</a>
						</td>
						<td>{zeile.handelnder}</td>
						<td class="gegenstand">
							{#if zeile.gegenstandArt}
								{gegenstandsart(zeile.gegenstandArt)}
								{#if zeile.gegenstandId}
									<a
										class="kennung"
										href={verlaufsAdresse({ ...data.filter, gegenstand: zeile.gegenstandId })}
										title="Nur diesen Gegenstand zeigen"
									>
										{zeile.gegenstandId.slice(0, 8)}
									</a>
								{/if}
							{:else}
								—
							{/if}
						</td>
						<td class="angaben">
							{angabenInWorten(zeile.angaben, aufloeser, wertwoerter(zeile.art, data.typnamen))}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<nav class="blaettern">
		{#if data.seite > 0}
			<a href={verlaufsAdresse(data.filter, data.seite - 1)}>Neuere</a>
		{/if}
		{#if data.weitere}
			<a href={verlaufsAdresse(data.filter, data.seite + 1)}>Ältere</a>
		{/if}
	</nav>
{/if}

<style>

	/*
		**Drei Reihen statt einer Flusszeile** (02.09.2026).

		Vorher war die Leiste EINE Flusszeile: `flex` mit `flex-wrap`, in der alle
		sieben Felder nebeneinander begannen. Die Felder sind aber verschieden
		hoch — eine Suchauswahl bringt Tippfeld, Trefferzahl und Liste mit
		(144 px), ein Datumsfeld nur sich selbst (71). An beliebiger Stelle
		umgebrochen ergab das gemessene fünf Oberkanten und ein Loch oben links.

		Jetzt trägt jede Reihe nur Gleichartiges. Wie innerhalb einer Reihe
		ausgerichtet wird, entscheidet die Reihe selbst: `.filterreihe` und
		`.zeitreihe` richten unten aus, damit die Bedienelemente fluchten
		(Begründung dort).
	*/
	.filterleiste {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		margin: 1rem 0 0.5rem;
	}

	.filterleiste label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.reihe {
		display: flex;
		align-items: start;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	/* Die Suche ist die erste Handlung und darf den Platz haben. */
	.suchreihe .suchfeld {
		flex: 1 1 100%;
		max-width: 34rem;
	}

	/*
		**Gleiche Spalten für die drei Eingrenzungen.** Ohne feste Breite richtet
		sich ein `<select>` nach seinem längsten Eintrag: gemessen 326, 612 und
		739 px nebeneinander, obwohl die drei dasselbe tun.
	*/
	.filterreihe {
		display: grid;
		/*
			**Der Umbruch haengt am Platz, nicht am Fenster** (02.09.2026, aus dem
			Code-Review). Ein erster Anlauf schaltete bei 60rem und 34rem
			Fensterbreite um — das Kriterium ist aber die SPALTENbreite: Bei 970 px
			Fenster ergaben drei Spalten 301 px, bei 560 px zwei Spalten 259, und in
			beiden Bereichen schnitt die Auswahlliste ihren laengsten Eintrag ab.
			`auto-fit` mit einer Mindestbreite rechnet selbst und braucht keine
			Medienabfrage.

			**16rem als Mindestbreite, nachgemessen.** Ein `<select>` schneidet einen
			zu langen Eintrag bei JEDER Breite ab — dafuer ist das Tippfeld darueber
			da. Die Mindestbreite muss also nicht den laengsten Gemeinschaftsnamen
			fassen, sondern das Feld bedienbar halten. Mit 20rem fiel die Leiste
			schon bei 1024 px auf zwei Spalten und wurde damit hoeher als vorher
			(482 statt 309).

			`min(…, 100%)`, damit die Spalte auf einem schmalen Telefon nicht breiter
			wird als die Seite.
		*/
		grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
		/*
			**Unten ausgerichtet, nicht oben** (ebenfalls aus dem Review). Eine
			`Suchauswahl` zeigt Tippfeld und Trefferzahl erst ab NEUN Eintraegen
			(`brauchtSuchfeld` prueft `durchsuchbar > SUCHSCHWELLE`, und die ist 8),
			und die drei Listen sind unabhaengig lang: Bei drei
			Gemeinschaften, aber fuenfzehn Bereichen saesse die eine Liste rund 60 px
			hoeher als ihre Nachbarn — der gemeldete Effekt in klein. An der
			Unterkante fluchten die Listen, mit denen gearbeitet wird; die
			Beschriftung steht ohnehin unmittelbar ueber ihrem eigenen Feld.
		*/
		align-items: end;
		/*
			**Zeilen weiter auseinander als Spalten.** Eine Suchauswahl ist selbst
			dreiteilig. Steht der Abstand zwischen zwei Rasterzeilen genauso weit wie
			der zwischen diesen Teilen, zerfaellt die Spalte optisch wieder in
			Einzelfelder, und man sieht erneut Tippfelder ohne erkennbare Zuordnung.
		*/
		column-gap: 0.6rem;
		row-gap: 1.8rem;
	}

	/* Der Knopf sitzt auf der Höhe der Felder, nicht ihrer Beschriftung. */
	.zeitreihe {
		align-items: end;
	}

	.beschriftung {
		font-size: 0.8rem;
		color: var(--text-leise);
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	.filterleiste input,
	.filterleiste :global(select),
	.filterleiste :global(.auswahlsuche) {
		min-height: var(--ziel-min);
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
	}

	.filterleiste input[type='search'] {
		width: 100%;
	}

	.aufheben {
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
	}

	/* Nicht «.marke»: So heisst schon die Wortmarke in der Kopfzeile. Der Stil
	   kollidiert dank Svelte nicht, wohl aber jeder Selektor in einem Prüfskript. */
	.filtermarken {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin: 0 0 0.5rem;
	}

	.filtermarke {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.15rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: 999px;
		font-size: 0.85rem;
	}

	.filtermarke a {
		text-decoration: none;
		font-weight: 600;
	}

	.zaehler {
		margin: 0;
		color: var(--text-leise);
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
	}

	.leer {
		color: var(--text-leise);
	}

	/* Die Tabelle rollt in ihrem eigenen Rahmen; die Seite selbst nie waagrecht. */
	.tabellenrahmen {
		margin-top: 0.5rem;
		overflow-x: auto;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.4rem 0.75rem;
		border-bottom: 1px solid var(--linie);
		vertical-align: top;
	}

	th {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-leise);
		white-space: nowrap;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	.zeit {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.uhrwarnung {
		display: block;
		font-size: 0.75rem;
		color: var(--warnung);
	}

	.gegenstand,
	.angaben {
		color: var(--text-leise);
	}

	.kennung {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		margin-left: 0.3rem;
	}

	.blaettern {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
	}

	.blaettern a {
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
	}
</style>
