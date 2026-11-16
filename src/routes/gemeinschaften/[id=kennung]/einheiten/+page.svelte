<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Sortierkopf from '$lib/components/Sortierkopf.svelte';
	import { saldoText } from '$lib/domain/einheiten';
	import { filtereNach } from '$lib/domain/listensuche';
	import { naechsteSortierung, sortiere, type Sortierung } from '$lib/domain/tabellensortierung';
	import { absenden } from '$lib/absenden';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import { traegtKopfstimme } from '$lib/domain/eigentuemer';
	import Meldung from '$lib/components/Meldung.svelte';
	import Rueckfragefenster from '$lib/components/Rueckfragefenster.svelte';

	let { data, form } = $props();

	const arten = $derived(data.quotenarten);
	// Nur die Zeilen dieser Ebene: Die Salden der Untergemeinschaften gehören auf
	// deren eigene Seite, sonst weiss niemand mehr, wo etwas zu korrigieren ist.
	const eigeneSalden = $derived(data.salden.zeilen.filter((z) => z.stwegId === data.gemeinschaft.id));
	const andereSalden = $derived(data.salden.zeilen.filter((z) => z.stwegId !== data.gemeinschaft.id));

	/*
	 * **Offen, wenn es gerade um einen Verteiler ging** (26.08.2026). Jedes
	 * Absenden ist eine echte Navigation, die Seite wird neu gebaut und der
	 * Aufklapper stünde wieder zu — mit der `.bestand`-Liste darin, die als
	 * einzige zeigt, was es schon gibt, und die als einzige den Weg zurück
	 * anbietet. Seit der Verteiler der **erste** Schritt ist, kostete das je
	 * angelegtem Schlüssel einen Klick.
	 */
	let verteilerOffen = $state(
		// `untrack`, weil hier bewusst nur der Anfangswert zählt: Danach entscheidet
		// der Klick des Benutzers. Dasselbe Muster wie in `TraktandumFormular`.
		untrack(() => Boolean(form?.verteilerAngelegt || form?.verteilerEntfernt || form?.rueckfrage))
	);

	/** Alles ausser der Stammquote — nur das lässt sich entfernen. */
	const zusatzverteiler = $derived(arten.filter((a) => !a.isPrimary));

	/**
	 * Suchen und Sortieren (Auftraggeber, 12.08.2026).
	 *
	 * **Die Zeilen tragen Formularfelder.** Ihre Namen hängen an der Kennung der
	 * Einheit (`label.<id>`), nicht an ihrer Stelle — Umsortieren ändert also nur,
	 * was man sieht, und «Tabelle speichern» schickt weiterhin alles Richtige.
	 * Beim Filtern wäre das anders: Eine ausgeblendete Zeile schickt nichts mit,
	 * und der Server bekäme eine Einheit weniger zu sehen. Sie wird deshalb
	 * versteckt statt entfernt.
	 */
	let suche = $state('');
	let sortierung = $state<Sortierung | null>(null);

	/**
	 * Der Wortlaut der Sammeleingabe beim Seitenaufbau.
	 *
	 * `untrack`, damit daraus kein Template-Effekt wird: Ein reaktiver Wert im
	 * Rumpf eines `<textarea>` leert das Feld, sobald eine **andere** Handlung
	 * dieser Seite antwortet. Siehe die Begründung am Feld selbst.
	 */
	const zeilenAnfang = untrack(() => form?.zeilen ?? '');

	function wertVon(e: (typeof data.einheiten)[number], spalte: string): unknown {
		if (spalte === 'label') return e.label;
		if (spalte === 'kind') return e.kind === 'unit' ? 'Einheit' : 'Nebenobjekt';
		if (spalte === 'kopf') return e.countsAsHead;
		// Freiwillige Merkmale (Befund 26): `null` sortiert ans Ende, wie eine
		// fehlende Quote — nicht als Null, sonst stünden die nicht erfassten
		// Wohnungen vor den kleinsten.
		if (spalte === 'zimmer') return e.zimmer ?? null;
		if (spalte === 'flaeche') return e.flaeche ?? null;
		if (spalte === 'lage') return e.lage ?? null;
		return e.quotas[spalte] ?? null;
	}

	const passend = $derived(
		new Set(filtereNach(data.einheiten, suche, (e) => e.label).map((e) => e.id))
	);
	const zeilen = $derived(sortiere(data.einheiten, sortierung, wertVon));

	function sortiereNach(spalte: string) {
		sortierung = naechsteSortierung(sortierung, spalte);
	}
</script>

<div class="kopf">
	<h1>Einheiten</h1>
	{#if data.darfStammdaten}
		<a class="knopf" href="/gemeinschaften/{data.gemeinschaft.id}/uebernahme?quelle=datei"
			>Aus Datei übernehmen</a
		>
	{/if}
</div>

{#if form?.rueckfrage}
	<!-- Die Zahl kennt nur der Server: Wie viele Einheiten an diesem Verteiler
	     einen Wert tragen, steht in `unit_quota` und nirgends auf der Seite. -->
	<Rueckfragefenster
		frage="«{form.rueckfrage.name}» entfernen?"
		zurueck="/gemeinschaften/{data.gemeinschaft.id}/einheiten"
		marke={form}
	>
		{#snippet inhalt()}
			<p>
				{form?.rueckfrage?.betroffen === 1
					? 'Eine Einheit trägt an diesem Verteiler einen Wert; er geht mit verloren.'
					: `${form?.rueckfrage?.betroffen} Einheiten tragen an diesem Verteiler einen Wert; sie gehen mit verloren.`}
			</p>
			<p>
				Die Stammquote und damit das Stimmrecht bleiben unberührt — ein Verteiler ist ein
				Kostenschlüssel.
			</p>
		{/snippet}
		<!--
			**Die Marke zeigt auf ein Element, das es nach dem Entfernen noch gibt.**
			Ein erster Anlauf gab hier `verteilerEntfernen` an — dazu existiert kein
			`data-fokus`, und der Fokusgriff lief still leer. Nach dem Entfernen ist
			die Zeile weg; der nächste sinnvolle Halt ist das Feld, mit dem man einen
			Verteiler anlegt, im selben Abschnitt.
		-->
		{#snippet handlung()}
			<form
				method="POST"
				action="?/verteilerLoeschen"
				use:enhance={absenden({ marke: 'verteilerAnlegen' })}
			>
				<input type="hidden" name="artId" value={form?.rueckfrage?.artId} />
				<input type="hidden" name="bestaetigt" value="true" />
				<button type="submit" class="ja" data-ton="warnung">Trotzdem entfernen</button>
			</form>
		{/snippet}
	</Rueckfragefenster>
{:else if form?.einheitRueckfrage}
	<!--
		Was mitgeht, steht in der Frage — nicht «Sind Sie sicher?». Zuordnungen,
		Quoten und Nutzniessungen hängen über `ON DELETE CASCADE` an der Einheit;
		die Zahlen kennt nur der Server.
	-->
	<Rueckfragefenster
		frage="«{form.einheitRueckfrage.bezeichnung}» entfernen?"
		zurueck="/gemeinschaften/{data.gemeinschaft.id}/einheiten"
		marke={form}
	>
		{#snippet inhalt()}
			<p>
				{form?.einheitRueckfrage?.zuordnungen === 0 && form?.einheitRueckfrage?.quoten === 0
					? 'An dieser Einheit hängt nichts weiter.'
					: `Mit ihr gehen ${form?.einheitRueckfrage?.zuordnungen} Eigentumszuordnung${form?.einheitRueckfrage?.zuordnungen === 1 ? '' : 'en'} und ${form?.einheitRueckfrage?.quoten} Quotenwert${form?.einheitRueckfrage?.quoten === 1 ? '' : 'e'} verloren, dazu allfällige Nutzniessungen.`}
			</p>
			<p>
				Das lässt sich nicht rückgängig machen. Eine Einheit, die schon an einer freigegebenen
				Versammlung teilgenommen hat, liesse sich gar nicht entfernen — ihre Wertquote steht in
				deren Auszählung.
			</p>
		{/snippet}
		<!--
			Dasselbe für die Einheit: Nach dem Entfernen gibt es ihre Zeile nicht
			mehr, wohl aber die Tabelle. Der Fokus geht auf «Tabelle speichern», die
			Handlung desselben Abschnitts.
		-->
		{#snippet handlung()}
			<form
				method="POST"
				action="?/einheitEntfernen"
				use:enhance={absenden({ marke: 'speichern' })}
			>
				<input type="hidden" name="entfernen" value={form?.einheitRueckfrage?.einheitId} />
				<input type="hidden" name="bestaetigt" value="true" />
				<button type="submit" class="ja" data-ton="fehler">Trotzdem entfernen</button>
			</form>
		{/snippet}
	</Rueckfragefenster>
{:else if form?.einheitEntfernt}
	<Meldung ton="gut" marke={form}>Einheit entfernt.</Meldung>
{:else if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.verteilerEntfernt}
	<Meldung ton="gut" marke={form}>Verteiler entfernt.</Meldung>
{:else if form?.gespeichert}
	<Meldung ton="gut" marke={form}>
		{form.gespeichert}
		{form.gespeichert === 1 ? 'Einheit geprüft' : 'Einheiten geprüft'} und gespeichert.
	</Meldung>
{:else if form?.angelegt}
	<Meldung ton="gut" marke={form}>Einheit angelegt.</Meldung>
{:else if form?.sammelAngelegt}
	<!--
		**Auch die Sammelanlage meldet sich** (Code-Review 07.09.2026). Sie tat es
		nicht, und `use:enhance` leert das Textfeld: Der Verwalter sah ein leeres
		Feld und konnte den Erfolg nicht von einer verschluckten Absendung
		unterscheiden. Jede andere Handlung dieser Seite sagt etwas.
	-->
	<Meldung ton="gut" marke={form}>
		{form.sammelAngelegt}
		{form.sammelAngelegt === 1 ? 'Einheit angelegt' : 'Einheiten angelegt'}.
	</Meldung>
{:else if form?.verteilerAngelegt}
	<Meldung ton="gut" marke={form}>Verteiler angelegt.</Meldung>
{/if}

<!--
	**Ein Stapel benannter Abschnitte statt zweier Spalten** (27.08.2026).

	Die Seite beantwortet drei Fragen in fester Reihenfolge: Wo stehe ich (Lage),
	was ist da (Bestand), was kann ich tun (Handeln). Jeder Abschnitt bekommt die
	ganze Bahn. Nebeneinander steht nur, was **innerhalb** eines Abschnitts
	gleichrangig ist, und dafür gibt es `.kacheln` mit gleich hohen Karten.

	**Warum die Arbeitsfläche hier weichen musste.** Sie kam am 12.08.2026 aus
	einer Messung und war damals richtig: Die Seite wurde von 1.63 auf 1.31
	Bildschirme kürzer. Diese Begründung ist abgelaufen. Seit «Einheit
	hinzufügen» am 26.08.2026 nach Fragen statt nach Platz ordnet, bricht der
	Kasten in der Breite um. Nachgemessen am 27.08.2026, 1440 px, acht Einheiten:

	Gemessen wird die **Inhaltsspalte**, nicht die Seite: Bei 1440 px ist die
	Seitenleiste höher als der Inhalt und bestimmt die Seitenhöhe allein. Wer
	`document.scrollHeight` misst, misst die Navigation.

	| Inhaltsspalte | Zwei Spalten | Ein Stapel |
	|---|---|---|
	| 1440 px, acht Einheiten | 1699 px | 1718 px |
	| 1440 px, leer | 1000 px | 1033 px |
	| 390 px, acht Einheiten | 2110 px | 2126 px |
	| 320 px, acht Einheiten | 2278 px | 2294 px |

	Die linke Spalte trug 118 px (Wertquoten), die rechte 897 px. Darunter stand
	ein Loch von 548 px Breite und 779 px Höhe, ohne Einheiten eines von 548 × 757.
	Beide sind weg.

	**Der Inhalt wird dafür länger, und das ist der Preis:** ein Prozent mit acht
	Einheiten, 3,3 Prozent im leeren Zustand. Eine Lücke ist kein verschenkter
	Platz, sondern der Ort, an dem sich der kürzere Block versteckt; wer sie
	schliesst, zahlt seine Höhe.

	Auf 390 und 320 px gab es nie ein Loch, dort stapeln sich die Spalten ohnehin.
	Dort kostet der Umbau nur die Abstände zwischen den Abschnitten, 8 bis 16 px,
	und bringt etwas anderes: **die Tabelle steht jetzt vor den Formularen.**

	**Und warum die beiden Formulare NICHT nebeneinander stehen**, obwohl sie
	gleichartig sind: «Weitere Verteiler» misst zugeklappt 83 px, «Einheit
	hinzufügen» 678 px. Nebeneinander risse das dasselbe Loch wieder auf, nur
	schmaler. Gleichartig heisst nicht gleich gross.
-->
<div class="seitenstapel">
	<!-- Lage: Wo stehe ich? -->
	<section class="abschnitt">
		<!-- Der Saldo steht oben, nicht unten: Er ist der Grund, warum diese Seite
		     überhaupt aufgerufen wird. -->
		<section class="salden">
	<h2>Wertquoten</h2>
	{#if eigeneSalden.length === 0}
		<p class="hilfe">
			Diese Gemeinschaft führt keine eigene Wertquote: Sie ist eine übergeordnete Gemeinschaft,
			und die Anteile liegen bei den Gemeinschaften darunter.
		</p>
	{:else}
		<ul>
			{#each eigeneSalden as z (z.quotenart)}
				<li class:offen={z.abweichung !== 0}>
					<span class="marke" aria-hidden="true">{z.abweichung === 0 ? '✓' : '!'}</span>
					<span>
						{saldoText(z)}
						{#if !z.istStammquote}
							<span class="nebensache">Kostenschlüssel, ohne Wirkung auf das Stimmrecht.</span>
						{/if}
						<!--
							Der Weg zur Korrektur steht dort, wo der Fehler auffällt.
							Ein aufgehender Saldo hat zwei Seiten: die Anteile der Einheiten
							**und** die Gesamtzahl. Wer sich beim Anlegen bei der Gesamtzahl
							vertippt hat, las hier bisher «100010000 fehlen» und musste den
							Weg zu den Angaben selbst finden — an einer Zahl, die auf einen
							Tippfehler zeigt, ist das die unfreundlichste Stelle dafür.
						-->
						{#if z.istStammquote && z.abweichung !== 0}
							<span class="nebensache">
								Stimmt die Gesamtzahl nicht? <a href="/gemeinschaften/{data.gemeinschaft.id}/angaben"
									>Nenner ändern</a
								>
							</span>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	{#if andereSalden.length > 0}
		<details>
			<summary>Untergemeinschaften ({andereSalden.length} Zeilen)</summary>
			<ul>
				{#each andereSalden as z (z.stwegId + z.quotenart)}
					<li class:offen={z.abweichung !== 0}>
						<span class="marke" aria-hidden="true">{z.abweichung === 0 ? '✓' : '!'}</span>
						<span>{saldoText(z)}</span>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</section>

{#if arten.length === 0}
	<!--
		**Zwei Sätze übereinander, die sich widersprachen** (23.08.2026, A-19).
		Oben stand «Diese Gemeinschaft führt keine eigene Wertquote» — als
		Feststellung —, hier darunter «Ohne Wertquote lassen sich keine Einheiten
		erfassen. Setzen Sie zuerst einen Nenner» — als Mangel. Der Prüfer las
		beides und wusste nicht, welches gilt.

		Beides gilt, nur in unterschiedlichen Fällen: Bei einer Klammer ist es
		die Bauform, bei jeder anderen Gemeinschaft eine Lücke. Der Satz sagt
		jetzt, welcher Fall vorliegt, statt ihn offenzulassen.
	-->
	{#if data.gemeinschaft.quotaDenominator === 0}
		<p class="hilfe">
			Das ist hier kein Mangel: Diese Gemeinschaft ist die Klammer über den Häusern, und
			die Anteile liegen dort. Soll sie <em>eigene</em> Anteile führen — je einen pro Haus
			an Umgebung, Zufahrt und Tiefgarage —, geben Sie ihr zuerst unter
			<a href="/gemeinschaften/{data.gemeinschaft.id}/angaben">Angaben der Gemeinschaft</a>
			einen Nenner.
		</p>
	{:else}
		<p class="hilfe">
			Ohne Wertquote lassen sich keine Einheiten erfassen. Setzen Sie zuerst bei der
			<a href="/gemeinschaften/{data.gemeinschaft.id}">Gemeinschaft</a> einen Nenner.
		</p>
	{/if}
{/if}
	</section>

	<!--
		Bestand: Was ist da?

		**Vor dem Handeln, nicht danach** (Auftraggeber, 27.08.2026: «erst allgemeine
		Information mit Übersicht und Stand, dann erfassen»). Auf dem Telefon
		stand die Tabelle bisher unter beiden Formularen: Wer nachsehen wollte,
		was erfasst ist, rollte erst an allem vorbei, was er nicht wollte.

		Die Tabelle bekommt die ganze Bahn, seit dem 23.08.2026 (Prüflauf II,
		A-27): In halber Bahn wurden vier von sechzehn Bezeichnungen
		abgeschnitten und alle sechzehn Art-Felder auf 37 px gedrückt.

		Fehlt der Bestand, fehlt der Abschnitt. Er wird nicht leer gezeigt und
		auch nicht nach unten geschoben.
	-->
	{#if arten.length > 0 && data.einheiten.length > 0}
		<section class="abschnitt">
				<!--
					**`reset: false`** — als einziges Formular dieser Seite. Seine Felder
					sammeln keine Eingabe, sie zeigen den Bestand. `reset()` setzte sie
					auf die Werte zurück, die beim letzten Seitenaufbau darin standen,
					und die verborgene Kennung einer Zeile, die der Browser nach
					`invalidateAll()` selbst gezeichnet hat, würde dabei leer: Svelte
					schreibt für `value={…}` nur die Eigenschaft, nie das Attribut.
				-->
				<form
					method="POST"
					action="?/speichern"
					class="kachel"
					use:enhance={absenden({ reset: false })}
				>
					<!--
						**Die Kachel braucht ihre Überschrift** (Auftraggeber, 28.08.2026): «Unter
						‹Einheiten und Wertquoten› fehlt der Kachel mit der
						Einheitentabelle ein Titel.» Sie steht **in** der Kachel, wie
						«Wertquoten» weiter oben — davor stünde sie zwischen zwei Kacheln
						und gehörte auf dem Telefon sichtbar zu keiner von beiden.
					-->
					<h2>Erfasste Einheiten</h2>
					<div class="tabellenrahmen">
						<table>
							<thead>
								<tr>
									<Sortierkopf spalte="label" {sortierung} klick={sortiereNach}>Bezeichnung</Sortierkopf>
									<Sortierkopf spalte="kind" {sortierung} klick={sortiereNach}>Art</Sortierkopf>
									{#each arten as a (a.key)}
										<Sortierkopf spalte={a.key} zahl {sortierung} klick={sortiereNach}>
											{a.name}
											<span class="nenner">/{a.denominator}</span>
										</Sortierkopf>
									{/each}
									<!--
										**Zimmer, Fläche und Lage in eigenen Spalten** (Befund 26,
										07.09.2026). Sie stehen hinter den Quoten und vor der
										Kopfstimme: Wer die Tabelle zum Rechnen öffnet, liest links,
										wer sie zum Nachschlagen öffnet, rechts. Sortierbar sind sie,
										weil «welche Wohnungen sind über 100 m²» eine Frage ist, die
										sich stellt.
									-->
									<Sortierkopf spalte="zimmer" zahl {sortierung} klick={sortiereNach}>
										Zi.
									</Sortierkopf>
									<Sortierkopf spalte="flaeche" zahl {sortierung} klick={sortiereNach}>
										m²
									</Sortierkopf>
									<Sortierkopf spalte="lage" {sortierung} klick={sortiereNach}>Lage</Sortierkopf>
									<Sortierkopf
										spalte="kopf"
										{sortierung}
										klick={sortiereNach}
										titel="Trägt eine eigene Kopfstimme — nur bei Zählweise je Einheit"
									>
										Kopf
									</Sortierkopf>
									<!--
										Ohne Sortierkopf: Nach «Entfernen» sortiert man nicht.

										**Die Spalte nur, solange es den Knopf gibt** (UI-Durchgang
										06.10.2026). Hier stand ein `th` mit «Zeile» in einer Klasse
										`.klein`, die es auf der Seite nicht gibt, und ohne eigene
										Gestaltung: gemessen 17 px, fett, ohne Linie, neben Köpfen von
										12.8 px in Grossbuchstaben. Nach der ersten freigegebenen Versammlung war die
										Spalte zudem ganz leer. Die Beschriftung braucht nur das
										Vorleseprogramm; sichtbar sagt der Knopf in jeder Zeile selbst,
										was er tut.
									-->
									{#if !data.hatteVersammlung}
										<th scope="col" class="entfernenspalte"><span class="nurLeser">Entfernen</span></th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each zeilen as e (e.id)}
									<tr class:versteckt={!passend.has(e.id)}>
										<td>
											<input type="hidden" name="einheitId" value={e.id} />
											<input name="label.{e.id}" {...anfangswert(e.label)} required />
										</td>
										<td>
											<select name="kind.{e.id}">
												<option value="unit" selected={e.kind === 'unit'}>Einheit</option>
												<option value="parking" selected={e.kind === 'parking'}>Nebenobjekt</option>
											</select>
										</td>
										{#each arten as a (a.key)}
											<td class="zahl">
												<input
													name="q.{e.id}.{a.key}"
													{...anfangswert(a.key in e.quotas ? e.quotas[a.key] : '')}
													inputmode="numeric"
													placeholder={a.isPrimary ? '' : '—'}
													title={a.isPrimary
														? 'Stammquote, Pflicht'
														: 'Leer lassen, wenn die Einheit an diesem Verteiler nicht beteiligt ist'}
												/>
											</td>
										{/each}
										<td class="zahl">
											<input
												name="zimmer.{e.id}"
												{...anfangswert(e.zimmer ?? '')}
												inputmode="decimal"
												placeholder="—"
												title="Zimmerzahl, freiwillig. Halbe Zimmer als «3.5»."
											/>
										</td>
										<td class="zahl">
											<input
												name="flaeche.{e.id}"
												{...anfangswert(e.flaeche ?? '')}
												inputmode="decimal"
												placeholder="—"
												title="Fläche in m², freiwillig"
											/>
										</td>
										<td>
											<input
												name="lage.{e.id}"
												{...anfangswert(e.lage ?? '')}
												placeholder="—"
												maxlength="60"
												title="Lage im Haus, freiwillig: «EG links», «2. OG»"
											/>
										</td>
										<!--
											**Das Häkchen zeigt, was angekreuzt ist — die Marke daneben, was
											gilt** (23.08.2026, Prüflauf II, A-34).

											Zwei Ebenen entscheiden über die Kopfstimme eines Nebenobjekts:
											das Häkchen hier und der Schalter «Nebenobjekte tragen eine eigene
											Kopfstimme» bei den Angaben der Gemeinschaft. Der zweite ist die
											Obergrenze — steht er aus, zählt das Nebenobjekt nicht, auch mit
											Häkchen. Die Regel ist richtig (sonst liesse sich die
											Reglementsvorgabe Einheit für Einheit aushebeln), nur sah man ihr
											Ergebnis nicht: Der Bastelraum stand mit gesetztem Häkchen da und
											zählte nicht. Im Prüflauf bewiesen — Schalter an: 14 → 15
											Kopfstimmen, Schalter aus: zurück auf 14, das Häkchen blieb beide
											Male gesetzt.

											Gefragt wird `traegtKopfstimme` aus dem Kern — dieselbe Funktion,
											die auch zählt. Ein zweites Nachbauen der Regel liefe früher oder
											später auseinander.
										-->
										<td class="mittig">
											<input type="checkbox" name="kopf.{e.id}" value="true" {...angekreuzt(e.countsAsHead)} />
											{#if e.countsAsHead && !traegtKopfstimme(e, data.gemeinschaft.parkingCountsAsHead)}
												<span
													class="wirkungslos"
													title="Die Angaben der Gemeinschaft sagen, dass Nebenobjekte keine eigene Kopfstimme tragen. Das Häkchen bleibt stehen und wirkt wieder, sobald dort umgestellt wird."
												>
													zählt nicht
												</span>
											{/if}
										</td>
										<!--
											**Entfernen aus der Zeile heraus** (22.08.2026, Befund A-01). Bis
											dahin gab es keinen Weg: Wer fünf Wohnungen doppelt anlegte,
											musste die ganze Gemeinschaft löschen und neu beginnen.

											`formaction` statt eines eigenen Formulars — die Zeile steckt im
											Tabellenformular, und Formulare lassen sich nicht schachteln.
											`formnovalidate`, weil sonst ein leeres Pflichtfeld irgendwo in
											der Tabelle das Entfernen blockierte: Genau die Zeile, die man
											loswerden will, ist oft die unfertige.

											Der Server antwortet mit einer Rückfrage; sie erscheint als
											Fenster über der Seite, wie beim Verteiler (26.08.2026 —
											vorher als Kachel am Seitenkopf, was ein Rollen nach oben
											verlangte, nur um die Frage zu lesen).
										-->
										<!--
											**Nach der Freigabe steht der Knopf nicht mehr da** (Nachprüfung
											23.08.2026). Er führte zuvor in eine Absage — freundlich
											formuliert, aber doch eine: Eine Einheit, die an einer
											freigegebenen Versammlung teilgenommen hat, lässt sich nicht mehr
											entfernen.

											Die Absage im Kern bleibt (sie ist die Sicherung); der Weg dorthin
											verschwindet. Genau so hält es der «tilgen»-Knopf bei den
											Zuordnungen, und der Nachprüfer hat zu Recht gefragt, warum hier
											nicht. Seit dem 06.10.2026 (UI-Durchgang) geht mit dem Knopf auch
											seine Spalte, Kopf wie Zellen.
										-->
										{#if !data.hatteVersammlung}
											<td class="mittig">
												<!--
													**`form=` statt `formaction=`** (27.08.2026). Als
													Absendeknopf des Tabellenformulars war dieser Knopf
													dessen **Vorgabeknopf**: Er ist der erste
													`type="submit"` in Baumreihenfolge, und ein Enter in
													irgendeinem Bezeichnungsfeld löste damit das Entfernen
													aus statt das Speichern. Ausserdem schickte er die
													hundert Felder der ganzen Tabelle an eine Aktion mit,
													die zwei davon liest.

													Über `form=` gehört er dem leeren Formular weiter
													unten. Damit ist «Tabelle speichern» wieder der
													Vorgabeknopf, und `formnovalidate` fällt weg: Im
													eigenen Formular gibt es kein Pflichtfeld, an dem der
													Browser hängen bleiben könnte.
												-->
												<button
													type="submit"
													class="leise"
													form="einheit-entfernen"
													name="entfernen"
													value={e.id}
													data-fokus="entfernen:{e.id}"
													title="Diese Einheit entfernen">Entfernen</button
												>
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<div class="knoepfe">
						<button type="submit" data-fokus="speichern">Tabelle speichern</button>
						<span class="hilfe">
							Leeres Feld heisst «nicht beteiligt», eine 0 heisst «beteiligt mit Anteil null».
						</span>
					</div>
				</form>
				<!--
					Das Ziel der Entfernen-Knöpfe aus der Tabelle. Leer, weil der
					gedrückte Knopf seinen Namen und seinen Wert selbst mitbringt; es
					steht ausserhalb des Tabellenformulars, weil `<form>` sich nicht
					schachteln lässt.
				-->
				<form
					id="einheit-entfernen"
					method="POST"
					action="?/einheitEntfernen"
					hidden
					use:enhance={absenden()}
				></form>
		</section>
	{/if}

	<!--
		Handeln: Was kann ich tun?

		Eine Bedingung statt zweier gleichlautender: Vorher stand `{#if
		arten.length > 0}` zweimal hintereinander um die beiden Blöcke.
	-->
	{#if arten.length > 0}
		<section class="abschnitt">
		<!--
			**Die Verteiler stehen vor dem Erfassen** (Auftraggeber, 26.08.2026: «Nach
			Prozess sollte bei Einheiten erfassen zuerst weitere Verteiler erfassen
			kommen und dann die Einheiten»).

			Ein Verteiler legt eine **Spalte** an — im Formular darunter und in jeder
			Zeile der Tabelle. Wer ihn nachträgt, hat die Einheiten schon erfasst und
			muss für jede den Wert nachtragen. Wer ihn zuerst anlegt, füllt ihn beim
			Erfassen gleich mit.
		-->
		<!--
			**Nur mit Stammquote** (26.08.2026, aus dem Code-Review). Ohne primäre
			Quotenart ist die Gemeinschaft eine blosse Klammer; die Seite sagt das
			im Abschnitt darüber auch. Ein Verteiler wäre dort nicht nur sinnlos, er wäre ein Weg
			an der Wertquote vorbei: Er legt eine Quotenart an, und damit erschiene
			«Einheit hinzufügen», dessen Quotenfeld nur bei einer **primären** Art
			pflichtig ist. Herausgekommen wären Einheiten ohne Wertquote.
		-->
		<section class="verteiler kachel">
	<button type="button" class="flach" onclick={() => (verteilerOffen = !verteilerOffen)}>
		{verteilerOffen ? '−' : '+'} Weitere Verteiler
		{#if zusatzverteiler.length > 0}
			<span class="hilfe zeile">
				{zusatzverteiler.length === 1 ? 'einer angelegt' : `${zusatzverteiler.length} angelegt`}
			</span>
		{/if}
	</button>
	{#if verteilerOffen}
		<p class="hilfe">
			Neben der Stammquote aus dem Grundbuch kennen viele Reglemente eigene Schlüssel für Aufzug,
			Heizung oder Waschküche. Sie werden für sich geprüft und wirken nicht auf das Stimmrecht.
		</p>

		<!--
			Was angelegt ist, steht mit seinem Weg zurück daneben (Auftraggeber, 11.08.2026:
			«Ich habe vorhin einen angeklickt und den kann ich nicht wieder
			entfernen»). Ein Verteiler ist mit drei Feldern erfasst; ohne Gegenstück
			bleibt jeder Vertipper für immer eine Spalte in der Tabelle oben.
		-->
		{#if zusatzverteiler.length > 0}
			<ul class="bestand">
				{#each zusatzverteiler as a (a.id)}
					<li>
						<span>
							{a.name}
							<span class="hilfe">Schlüssel {a.key} · Nenner {a.denominator}</span>
						</span>
						<form method="POST" action="?/verteilerLoeschen" use:enhance={absenden()}>
							<input type="hidden" name="artId" value={a.id} />
							<button type="submit" class="leise" data-fokus="verteiler:{a.id}">Entfernen</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		<h3>Verteiler anlegen</h3>
		<form
			method="POST"
			action="?/verteilerAnlegen"
			class="felder"
			use:enhance={absenden({ marke: 'verteilerAnlegen' })}
		>
			<label>
				Schlüssel
				<input
					name="key"
					required
					placeholder="lift"
					pattern="[a-z][a-z0-9_]*"
					data-fokus="verteilerAnlegen"
				/>
			</label>
			<label class="breit">
				Bezeichnung
				<input name="name" required placeholder="Aufzug" />
			</label>
			<!--
				Ohne `schmal`: Die Klasse stand hier und an den Quotenfeldern, war aber
				weder in `app.css` noch im Stilblock dieser Seite definiert — eine
				Klasse ohne Stil, die eine Gestaltung behauptet, die es nicht gibt
				(`docs/gestaltung.md`, «Eine Klasse ohne Stil ist eine Rückmeldung,
				die niemand sieht»). Am Aussehen ändert das Entfernen nichts.
			-->
			<label>
				Nenner
				<input name="denominator" inputmode="numeric" required value="100" />
			</label>
			<button type="submit">Anlegen</button>
		</form>
	{/if}
		</section>

			<form
				method="POST"
				action="?/anlegen"
				class="neu kachel"
				use:enhance={absenden({ marke: 'anlegen' })}
			>
		<h2>Einheit hinzufügen</h2>
		<!--
			**Der Weg für viele auf einmal** (22.08.2026, Befunde A-05 und A-10). Im
			Prüflauf füllte der Verwalter fünfmal dasselbe Drei-Feld-Formular aus und
			schrieb: «Sammelerfassung fehlt». Sie fehlt nicht — sie war nur nirgends
			zu sehen.

			Bei fünf Einheiten ist das Formular unten schneller. Bei dreissig ist es
			eine halbe Stunde, und genau dann sucht niemand mehr in der Seitenleiste.
			Deshalb steht der Verweis hier, wo die Wiederholung anfängt.

			**Und seit dem 26.08.2026 zusätzlich als Knopf oben rechts** (Auftraggeber: «ich
			finde den Import für den CSV nicht. Wo finde ich den? und wenn ich die
			Frage stellen muss, ist der Zugang nicht intuitiv»). Es gab ihn zu dem
			Zeitpunkt an drei Stellen — hier, gleichlautend auf der Eigentümerseite,
			und als «Stammdaten übernehmen» in der Leiste (`ablaufleiste.ts`). Alle
			drei sind leise: zwei graue Hilfezeilen mitten im Formular, und ein
			Leisteneintrag unter der Überschrift **Verwaltung**, wo niemand einen
			Dateiimport sucht — und in keiner der drei kommt «Datei», «Excel» oder
			«CSV» vor, wonach man tippt. Drei leise Wege sind kein Weg.
		-->
		<p class="hilfe">
			Mehrere auf einmal? <a href="/gemeinschaften/{data.gemeinschaft.id}/uebernahme?quelle=datei"
				>Aus einer Datei übernehmen</a
			> — eine Zeile je Einheit, mit Bezeichnung, Quoten und <strong>je einem
			Eigentümer</strong>. Der Dateiweg verlangt ihn, anders als das Formular hier: Eine
			Einheit ohne Eigentümer lässt sich von Hand erfassen, über eine Datei nicht. Sind die
			Eigentümer noch nicht erfasst, hilft <a href="#sammel">die Liste weiter unten</a>.
		</p>
		<!--
			**Drei Abschnitte statt einer Reihe** (Auftraggeber, 26.08.2026: «In der Kachel
			Einheiten hinzufügen sieht etwas unruhig aus. Es muss ruhiger und
			strukturiert aussehen … WQ könnte man besser strukturieren, ggf.
			untereinander, damit es identisch aussieht. Jetzt wirkt es wie als hätte
			man es einfach aufgereiht»).

			Vorher lagen alle Felder in **einem** `.felder`-Raster mit zwei Spuren,
			und das Raster füllte sich der Reihe nach. Damit hing die Anordnung an
			der **Anzahl der Quotenarten**: Bei einer Art stand «Trägt eine
			Kopfstimme» in Zeile 3 links, bei zwei Arten in Zeile 3 rechts, bei vier
			Arten in Zeile 4 rechts neben «Waschküche» (im Browser nachgemessen).
			Zwei Gemeinschaften nebeneinander sahen deshalb verschieden aus, und
			zwischen «Art» und der Stammquote stand kein Zusammenhang, den es gibt.

			Jetzt sind es drei Abschnitte in der Reihenfolge der Fragen: **Was ist
			es?** — **Mit welchem Anteil?** — **Zählt es als Kopf?** Jeder Abschnitt
			läuft über die ganze Breite der Kachel, die Quoten stehen untereinander
			in einem eigenen Raster. Die Anordnung ist damit bei einer Quotenart
			dieselbe wie bei vier.
		-->
		<div class="felder">
			<!--
				**Der Fokus kehrt ins Feld zurück** (23.08.2026, Prüflauf II, A-28).
				Der Fokus lag nach «Hinzufügen» auf `BODY`. Bei dreissig Einheiten sind
				das dreissig zusätzliche Mausgriffe, nur um weitertippen zu können —
				gemessen 5,2 Handgriffe je Einheit.

				**Zwei Wege, weil es zwei Fälle gibt.** Mit JavaScript lädt die Seite
				nicht mehr neu; `autofocus` wird dann nie wieder ausgewertet, weil die
				Komponente nicht neu gebaut wird. Dort greift `data-fokus="anlegen"`:
				`absenden({ marke: 'anlegen' })` legt den Fokus nach jeder Antwort
				hierher zurück. Ohne JavaScript bleibt es beim Neuaufbau, und dort tut
				`autofocus` weiterhin genau das.

				**Und im Browser wird das Attribut wieder abgeräumt.** Kam die Seite
				einmal mit `autofocus` vom Server — ohne JavaScript oder beim Absenden
				vor der Hydration —, bleibt es danach am Knoten stehen: Sveltes
				`autofocus()` setzt es nur, es nimmt es nie zurück. SvelteKits
				`reset_focus()` beginnt aber mit `querySelector('[autofocus]')?.focus()`
				**ohne** `preventScroll` und läuft nach **jedem** erfolgreichen
				Absenden. Ein einziger Aufbau ohne JavaScript machte das Feld damit
				dauerhaft zur Rollfalle ans Seitenende, also genau zu dem Sprung, den
				dieser Block abschafft.

				Nur nach einer Anlage, nicht beim ersten Öffnen: Wer die Seite
				aufschlägt, um die Wertquoten zu lesen, will nicht in einem Feld
				landen. `absenden()` hält sich von selbst daran — es greift erst nach
				einem Absenden, und nur, wenn der Fokus dann herrenlos ist.
			-->
			<label class="voll">
				Bezeichnung
				<!-- svelte-ignore a11y_autofocus -->
				<input
					name="label"
					required
					placeholder="z. B. 1.1 Wohnung links"
					data-fokus="anlegen"
					autofocus={form?.angelegt === true}
					{@attach (el) => el.removeAttribute('autofocus')}
				/>
			</label>
			<!--
				**Die Erklärung steht dort, wo die Frage entsteht** (Auftraggeber, 26.08.2026:
				«Bei ‹Art› könnte man ein Tooltip für Nebenobjekte hinzufügen»).

				Kein Hinweisfähnchen am Mauszeiger: Auf dem Telefon gibt es keinen
				Mauszeiger, und die Sitzungsleitung erfasst Stammdaten auch dort.
				`docs/gestaltung.md`, Regel 4 — der kurze Satz steht sichtbar unter
				dem Feld, der Hintergrund wartet zugeklappt daneben.
			-->
			<label class="voll art">
				Art
				<select name="kind">
					<option value="unit">Einheit</option>
					<option value="parking">Nebenobjekt</option>
				</select>
				<span class="hilfe">
					Nebenobjekt heisst: Einstellplatz, Garage, Keller oder Bastelraum. Worin gewohnt
					oder gearbeitet wird, ist eine Einheit.
				</span>
			</label>
			<details class="erklaerung voll">
				<summary>Was heisst das?</summary>
				<p>
					Bei der Wertquote zählt beides gleich: Ein Nebenobjekt bringt seinen Anteil ein
					wie jede Einheit. Der Unterschied liegt allein bei den Kopfstimmen, und dort
					nur, wenn je Einheit gezählt wird.
				</p>
				<!--
					A5, Punkt 11 (A1 Frage 4): Die Einstellhalle im Begründungsakt. Hat
					jeder Platz eine eigene Wertquote, ist jeder Platz eine Einheit;
					sind die Plätze Miteigentumsanteile an der Halle, ist die Halle
					eine Einheit mit einer gemeinschaftlichen Partei, auch mit Personen
					ohne Wohnung, mit einer eigenen Stimme. Fachprüfung A5: getrennt von den
					Wohnungsstimmen (`quellen` Frage 76); Nutzungsrechte nach Rz. 22a ad Art. 712b.
				-->
				<p>
					Eine Einstellhalle im Begründungsakt: Hat dort jeder Platz eine eigene Wertquote,
					erfassen Sie Platz für Platz. Im Feld «Art» wählen Sie Nebenobjekt, wenn das Reglement
					dem Platz keine eigene Kopfstimme gibt. Sind die Plätze stattdessen Miteigentumsanteile
					an der einen Halle, erfassen Sie die Halle als eine Einheit mit einer
					gemeinschaftlichen Partei. Auch Personen ohne eigene Wohnung in der Gemeinschaft
					können dazugehören. Die Halle hat als Partei eine Stimme, getrennt von den Stimmen
					ihrer Mitglieder für die Wohnungen. Über diese eine Stimme müssen sich die Mitglieder
					einigen (SVIT-Kommentar Rz. 24 und 27 ad Art. 712b; Rz. 181 ad Art. 712m). Sind die
					Plätze nur Nutzungsrechte an gemeinschaftlichen Teilen, erfassen Sie keine Einheit. Hat
					jemand in der Gemeinschaft nur Plätze und erfassen Sie sie als Nebenobjekte, hätte er
					keine Kopfstimme. Das Stimmrecht kann einem Eigentümer aber nicht dauernd entzogen werden
					(SVIT-Kommentar Rz. 139 und 212 ad Art. 712m). Klären Sie das vor der nächsten
					Versammlung mit einer Fachperson.
				</p>
			</details>

			<!--
				**Drei Felder statt eines Klumpens in der Bezeichnung**
				(Bedienbarkeitsprüfung 05.09.2026, Befund 26: «Zimmerzahl, Fläche und
				Lage landen in einem Klumpen, der überall erscheint, auch auf der
				Zugangskarte»).

				Sie standen nirgends, also schrieb man sie in die Bezeichnung — und
				die steht in jeder Auswahl, auf der Karte und im Protokoll. Als
				eigene Felder bleiben sie dort, wo sie hingehören: in den Stammdaten.

				**Freiwillig, und ausdrücklich als solche gekennzeichnet.** Eine
				Gemeinschaft, die sie nicht führt, soll nicht drei leere Pflichtfelder
				vor sich haben. Leer heisst «nicht erfasst», nicht «keine».

				**Und sie rechnen nichts.** Wer nach Fläche verteilen will, legt eine
				Quotenart an — das ist eine Entscheidung der Gemeinschaft und steht
				im Reglement, nicht in einem Stammdatenfeld.
			-->
			<div class="merkmale voll">
				<label>
					Zimmer
					<input name="zimmer" inputmode="decimal" placeholder="3.5" />
				</label>
				<label>
					Fläche m²
					<input name="flaeche" inputmode="decimal" placeholder="87" />
				</label>
				<label>
					Lage
					<input name="lage" placeholder="EG links" maxlength="60" />
				</label>
				<span class="hilfe voll">
					Alle drei freiwillig. Ohne sie landen sie in der Bezeichnung, und die steht
					danach auf jeder Zugangskarte und in jedem Protokoll.
				</span>
			</div>
		</div>

		<!--
			**Die Wertquoten untereinander, eine Zeile je Art.** Jede Zeile führt
			dasselbe Raster — Name, Feld, Nenner —, deshalb fluchten sie
			untereinander, gleichgültig wie viele Verteiler die Gemeinschaft führt.

			Vorher war jede Art eine Zelle im gemeinsamen Raster, und der Nenner
			stand **unter** dem Namen statt daneben: `.felder > label` ist eine
			Flex-Spalte, in der auch ein `<span>` eine eigene Zeile bekommt. Im
			Browser nachgemessen — «/1000» als eigene 23 px hohe Zeile, das
			Quotenfeld damit 100 px hoch gegen 64 px beim Feld «Art» daneben.
		-->
		<div class="quoten">
			<!--
				«Wertquoten dieser Einheit», nicht bloss «Wertquoten»: Zuoberst auf
				derselben Seite steht schon eine Überschrift dieses Namens, die
				Saldenliste der ganzen Gemeinschaft. Zwei gleich betitelte Kästen
				sind eine Verwechslung, die niemand bemerkt. (Sie standen bis zum
				27.08.2026 nebeneinander, jetzt untereinander; verwechselbar
				bleiben sie so oder so.)
			-->
			<h3>Wertquoten dieser Einheit</h3>
			{#each arten as a (a.key)}
				<label class="quotenzeile">
					<span class="quotenname">{a.name}</span>
					<input
						name="quote.{a.key}"
						inputmode="numeric"
						required={a.isPrimary}
						placeholder={a.isPrimary ? '' : '—'}
					/>
					<span class="nenner">/{a.denominator}</span>
				</label>
			{/each}
			{#if zusatzverteiler.length > 0}
				<p class="hilfe">
					Leeres Feld heisst «nicht beteiligt», eine 0 heisst «beteiligt mit Anteil null».
				</p>
			{/if}
		</div>

		<!--
			**`.felder` auch um das Ankreuzfeld** (26.08.2026, aus dem Code-Review).

			Der erste Entwurf legte das Häkchen in einen blossen `<div>`. Damit
			verlor es `app.css`, `.felder > .kasten` — die Regel ist auf ein
			**direktes** Kind des Feldrasters festgeschrieben. Im Browser
			nachgemessen: `display: inline` statt `flex`, Höhe **20 px** statt 44,
			Schriftgrösse 17 px statt 14,4 und kein Abstand zwischen Häkchen und
			Beschriftung. Auf dem Telefon eine Tippfläche unter `--ziel-min`.

			Die Regel zu lockern wäre der falsche Griff — sie gilt zehn weiteren
			Seiten. Der Abschnitt ist deshalb selbst ein `.felder`, und beide Kinder
			nehmen mit `.voll` die ganze Zeile.
		-->
		<div class="felder kopfstimme">
			<label class="kasten voll">
				<input type="checkbox" name="countsAsHead" value="true" checked />
				Trägt eine Kopfstimme
			</label>
			<!--
				**Der Satz erscheint, sobald er zutrifft** (23.08.2026, A-34). Wer ein
				Nebenobjekt erfasst und das Häkchen stehen lässt, glaubt sonst, es
				zähle — und die Gemeinschaftseinstellung sagt lautlos nein.

				Er stand bis zum 26.08.2026 als Zelle im Feldraster und war damit 245
				px breit und 157 px hoch — eine graue Wand neben dem Häkchen. Als
				Absatz im eigenen Abschnitt läuft er über die ganze Breite.
			-->
			{#if !data.gemeinschaft.parkingCountsAsHead}
				<p class="hilfe voll">
					Bei einem <strong>Nebenobjekt</strong> wirkt dieses Häkchen zurzeit nicht: Die
					<a href="/gemeinschaften/{data.gemeinschaft.id}/angaben">Angaben der Gemeinschaft</a>
					sagen, dass Nebenobjekte keine eigene Kopfstimme tragen. Es bleibt gesetzt und wirkt
					wieder, sobald dort umgestellt wird.
				</p>
			{/if}
		</div>

		<button type="submit">Hinzufügen</button>
			</form>

			<!--
				**Mehrere auf einmal, ohne Eigentümer** (Bedienbarkeitsprüfung
				05.09.2026, Befund 29: «Fünf Einheiten sind fünfmal dasselbe Formular;
				‹Aus Datei übernehmen› verlangt je einen Eigentümer und hilft hier
				nicht»).

				Den Dateiweg gibt es, und er ist der richtige für eine gewachsene
				Liste aus dem Grundbuchauszug. Beim Anlegen einer Gemeinschaft sind
				die Eigentümer aber oft noch nicht erfasst, und dann bleibt nur das
				Formular darüber, fünfmal. Dieser Weg liegt dazwischen: abtippen,
				aber einmal.

				**Neben dem Formular und nicht statt seiner.** Wer eine einzelne
				Einheit nachträgt, will kein Textfeld mit Trennzeichen; wer zwanzig
				erfasst, will kein Formular. Beide stehen da, und der Verweis oben
				führt hierher.
			-->
			<form
				method="POST"
				action="?/sammelAnlegen"
				class="sammel kachel"
				id="sammel"
				use:enhance={absenden({ marke: 'sammel' })}
			>
				<h2>Mehrere Einheiten auf einmal</h2>
				<p class="hilfe">
					Eine Zeile je Einheit, die Angaben mit Strichpunkt getrennt:
					<strong>Bezeichnung; Stammquote; Zimmer; Fläche; Lage</strong>. Nur die ersten
					beiden sind nötig. Leerzeilen und Zeilen mit <code>#</code> werden übergangen —
					wer aus einer Tabelle kopiert, hat Überschriften dabei.
				</p>
				<label class="voll">
					<span class="nurLeser">Zeilen</span>
					<!--
						**Der Wortlaut im Inhalt, aber nicht reaktiv** (07.09.2026, aus
						beiden Durchgängen).

						Zwei Fallen an derselben Stelle, und sie zeigen in verschiedene
						Richtungen. `{form?.zeilen}` im Rumpf kompiliert zu `set_value` in
						einem Template-Effekt: Wechselt `form` auf die Antwort einer
						**anderen** Handlung dieser Seite («Tabelle speichern»,
						«Entfernen»), ist `form.zeilen` undefiniert, der Effekt läuft mit
						`''`, und die eben korrigierten zwanzig Zeilen sind weg. Ein
						`value`-Attribut, wie es `anfangswert` setzt, hilft hier aber
						**nicht**: Ein `<textarea>` nimmt seinen Wert aus dem Inhalt, das
						Attribut ist wirkungslos — ohne JavaScript käme die abgewiesene
						Antwort mit leerem Feld zurück, und genau dafür gibt der Server
						`zeilen` überhaupt zurück.

						Deshalb der Inhalt, aber aus einem beim Aufbau festgehaltenen
						Wert: Ohne JavaScript trägt ihn die frisch gebaute Seite, mit
						JavaScript bleibt das Getippte ohnehin stehen, weil `use:enhance`
						nichts zurücksetzt.
					-->
					<textarea
						name="zeilen"
						rows="8"
						maxlength="20000"
						data-fokus="sammel"
						placeholder={'1.1 Wohnung links; 300; 3.5; 87; EG links\n1.2 Wohnung rechts; 250; 2.5; 64; EG rechts\n2.1 Wohnung links; 300; 3.5; 87; 1. OG links'}
						>{zeilenAnfang}</textarea
					>
				</label>

				{#if form?.zeilenfehler}
					<!--
						**Jede Zeile mit ihrer Nummer und ihrem Wortlaut.** Bei zwanzig
						Zeilen ist «Die Stammquote fehlt» keine Auskunft, sondern eine
						Suchaufgabe. Und alle auf einmal: Wer drei Tippfehler hat, will
						sie in einem Durchgang sehen.
					-->
					<ul class="zeilenfehler">
						{#each form.zeilenfehler as f (f.zeile)}
							<li>
								<strong>Zeile {f.zeile}</strong>
								<span class="wortlaut">{f.text}</span>
								<span class="grund">{f.grund}</span>
							</li>
						{/each}
					</ul>
				{/if}

				<p class="hilfe">
					Angelegt wird alles oder nichts: Steht in einer Zeile ein Fehler, entsteht keine
					einzige Einheit. Die Art steht danach in der Tabelle — dort lassen sich
					Nebenobjekte umstellen.
				</p>
				<button type="submit">Alle anlegen</button>
			</form>
		</section>
	{/if}
</div>

<style>
	/*
		«zählt nicht» steht klein unter dem Häkchen, nicht daneben: Die Spalte ist
		schmal, und ein Wort in der Zeile schöbe die Quotenspalten weiter nach
		links. Warnfarbe, weil es dem Häkchen widerspricht.
	*/
	.wirkungslos {
		display: block;
		font-size: 0.75rem;
		line-height: 1.1;
		color: var(--warnung);
	}


	/* Der Bestand der Verteiler: Name links, der Weg zurück rechts. */
	.bestand {
		list-style: none;
		margin: 0.75rem 0;
		padding: 0;
		max-width: 40rem;
	}

	.bestand li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--linie);
	}

	.verteiler h3 {
		font-size: 0.95rem;
		margin: 1.25rem 0 0.5rem;
	}

	/* Im Aufklapper steht die Zahl hinter dem Wort, nicht darunter. */
	.hilfe.zeile {
		display: inline;
		margin-left: 0.4rem;
	}

	/*
		**`:not(.flach)` auch hier** (06.10.2026, UI-Durchgang). Die Regel
		`button:not(.flach)` weiter unten wiegt mit Datei-Hash gleich viel wie
		`button.leise` und steht später; sie gewann. Gemessen war «Entfernen» in
		jeder Tabellenzeile ein grüner Hauptknopf neben «Tabelle speichern», 135 px
		breit; ebenso «Entfernen» bei den weiteren Verteilern. Mit dem zusätzlichen
		`:not(.flach)` wiegt diese Regel mehr.
	*/
	button.leise:not(.flach) {
		background: none;
		color: var(--text-leise);
		border: 1px solid var(--linie);
		font-weight: 400;
		padding: 0 0.9rem;
	}

	.salden {
		margin: 0;
		padding: 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	.salden h2,
	.neu h2 {
		font-size: 1rem;
		margin: 0 0 0.6rem;
	}

	.salden ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.salden li {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
	}

	.marke {
		font-weight: 700;
		color: var(--akzent);
		flex: none;
		width: 1rem;
	}

	li.offen .marke {
		color: var(--warnung);
	}

	.nebensache,
	.hilfe {
		display: block;
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	/*
		Der Aufklapper der Untergemeinschaften steht am Fuss der Saldenliste und
		trägt deshalb eine Trennlinie. Seit im Erfassungskasten ein zweiter
		Aufklapper steht (der Hintergrund zur Art), ist die Regel auf ihn
		festgeschrieben — ohne das bekäme auch der andere eine Linie über sich,
		die dort nichts trennt.
	*/
	.salden details {
		margin-top: 0.9rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--linie);
	}

	.salden summary,
	details.erklaerung summary {
		cursor: pointer;
		color: var(--text-leise);
		font-size: 0.9rem;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
	}

	/*
		**Der Hintergrund wartet zugeklappt** (`docs/gestaltung.md`, Regel 4). Kein
		`display: flex` an der Zusammenfassung — das nähme ihr das Dreieck, und der
		Wächter `versammlung/dreieck-am-summary` weist es ab.
	*/
	details.erklaerung {
		max-width: var(--lesebreite);
	}

	details.erklaerung p {
		color: var(--text-leise);
		font-size: 0.9rem;
		font-weight: 400;
		margin: 0 0 0.4rem;
	}

	.tabellenrahmen {
		overflow-x: auto;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	/* Der Spaltenkopf gestaltet sich selbst (`Sortierkopf.svelte`) — hier stehen
	   nur noch die Zellen. */
	td {
		text-align: left;
		padding: 0.35rem 0.5rem;
		border-bottom: 1px solid var(--linie);
	}

	/* Beim Suchen ausgeblendet statt entfernt: Eine entfernte Zeile schickte ihre
	   Felder nicht mit, und «Tabelle speichern» verlöre sie. */
	tr.versteckt {
		display: none;
	}

	.zahl {
		text-align: right;
	}

	.zahl input {
		text-align: right;
		font-variant-numeric: tabular-nums;
		max-width: 6rem;
	}

	.mittig {
		text-align: center;
	}

	.nenner {
		font-weight: 400;
		color: var(--text-leise);
		text-transform: none;
	}

	/*
		**Eine Kopie von `app.css`, die nur die Auswahlfelder traf** (26.08.2026).

		Hier stand ein eigener Block für `input:not([type])` und `select` —
		dieselben acht Angaben, die `app.css` für alle Felder unter `main` schon
		trifft, nur mit anderen Zahlen. Er wirkte halb:

		* Für Eingabefelder wiegt `app.css` schwerer
		  (`main input:not([type='radio']):not([type='checkbox'])` = 0-2-2 gegen
		  0-2-1 mit Svelte-Abgrenzung) — die Kopie war dort wirkungslos.
		* Für Auswahlfelder wiegt sie leichter (`main select` = 0-0-2, und die
		  Tabellenausnahme `main td select` = 0-0-3, beide gegen 0-1-1) — dort
		  gewann die Kopie, und zwar **im Kasten wie in der Tabelle**.

		Nachgemessen im Erfassungskasten: Auswahlfeld **36 px** hoch neben
		Textfeldern von **44 px**, dazu Schriftgewicht 550 statt 400 und ein
		anderer Eckenradius. In derselben Zeile, im selben Kasten.

		**Und in der Tabelle nachgemessen, weil `app.css` dort ausdrücklich vor
		grösseren Feldern warnt** (der Querlauf am Telefon, 11.08.2026): Das
		Auswahlfeld der Spalte «Art» geht von 36 auf 44 px — die Zeilenhöhe
		bleibt bei **67 px**, weil sie das 45 px hohe Textfeld daneben bestimmt.
		Sechzehn Einheiten, Tabelle vorher wie nachher **1128 px** hoch und
		**1076 px** breit; `e2e/telefonbreite.mjs` grün.

		Der Block ist deshalb weg; die Felder folgen `app.css` wie überall sonst.
		Übrig bleibt das eine, was `app.css` nicht setzt und die Tabelle braucht.
	*/
	/*
		Ein Feld in einer Tabellenzelle füllt seine Spalte. Ohne das nähme es die
		Standardbreite eines Textfelds, und die Spaltenbreiten der Tabelle hätten
		keine Wirkung mehr.
	*/
	.tabellenrahmen input:not([type='checkbox']),
	.tabellenrahmen select {
		width: 100%;
	}

	/*
		**Mindestbreiten, sonst teilt die Tabelle den Platz falsch** (UI-Durchgang
		06.10.2026). Mit `width: 100%` allein hat kein Feld eine Untergrenze, und die
		Tabelle verteilt nach Gutdünken: Bei 1440 px waren 15 von 17 Bezeichnungen
		abgeschnitten («EG Gartenwohnung, 2.5 Zimmer» braucht 297 px, das Feld hatte
		216), während die Spalte «Lage» breit und leer stand. Bei 390 px war das
		Auswahlfeld «Art» 37 px schmal, zu lesen war «Ei».

		Die Zahlen: «Nebenobjekt» braucht im Auswahlfeld 142 px, daher 9.5rem. Die
		Bezeichnung bekommt mindestens 14rem, nicht mehr: Mit der Entfernen-Spalte
		(solange keine Versammlung freigegeben war) soll die Tabelle bei 1440 px in
		ihre 1076 px passen, bei einer Quotenart mit kurzem Namen mit gut 20 px
		Reserve. Jeder weitere Verteiler ist eine eigene Spalte; dann rollt die
		Tabelle im Rahmen, und das ist so gewollt.
		Die erste Fassung mit 20rem lief dort 43 px über, «Entfernen» war
		abgeschnitten und Zimmer und Fläche auf 34 px gedrückt («3.5» las sich als
		«3»). Zimmer und Fläche haben deshalb ebenfalls eine Untergrenze. Am Telefon
		wird die Tabelle breiter und rollt im Rahmen (`overflow-x: auto` oben), statt
		ihre Felder zu quetschen.
	*/
	.tabellenrahmen input[name^='label.'] {
		min-width: 14rem;
	}

	/* Den Platz, der übrig ist, bekommt die Bezeichnung, nicht «Lage»: Ohne
	   Vorgabe verteilte die Tabelle ihn nach Inhalt, und bei 17 Einheiten stand
	   «Lage» 214 px breit und leer neben einer abgeschnittenen Bezeichnung. */
	.tabellenrahmen td:first-child {
		width: 35%;
	}

	.tabellenrahmen input[name^='zimmer.'],
	.tabellenrahmen input[name^='flaeche.'] {
		min-width: 3.5rem;
	}

	.tabellenrahmen select {
		min-width: 9.5rem;
	}

	.tabellenrahmen input[name^='lage.'] {
		min-width: 8rem;
	}

	/*
		Der Kopf der Entfernen-Spalte trägt nur eine Beschriftung für Vorleseprogramme,
		braucht aber die Linie unten wie die Sortierköpfe daneben. Die Regel trifft
		nur dieses `th`: Die Sortierköpfe gestalten sich in ihrer Komponente selbst.

		`position: relative`, weil `.nurLeser` absolut steht: Ohne einen Bezugspunkt
		im Rollrahmen entkam die Beschriftung dessen Zuschnitt, und die Seite lief
		bei 390 px 701 px quer (gemessen 06.10.2026).
	*/
	th.entfernenspalte {
		border-bottom: 1px solid var(--linie);
		padding: 0;
		position: relative;
	}

	input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
	}

	.knoepfe {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-top: 0.9rem;
	}

	/*
	 * **`:not(.flach)`, sonst gewinnt diese Regel** (03.09.2026, gemessen). Svelte
	 * haengt den Datei-Hash an, also hat `button` hier 0-1-1 und schlaegt das
	 * globale `.flach` mit 0-1-0. Gemessen stand «+ Weitere Verteiler» danach mit
	 * dunkelgruenem Grund und grauer Schrift da, Kontrast rund 1,4:1 und damit
	 * unlesbar — dieselbe Falle wie auf der Betreiberseite.
	 */
	button:not(.flach) {
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
		flex: none;
	}

	button.flach {
		/* Grund und Rahmen kommen aus `app.css`, seit die Regel oben `.flach`
		   ausnimmt; hier steht nur, was dieser Aufklapper anders braucht. */
		color: var(--text-leise);
		padding: 0;
		font-weight: 400;
		text-align: left;
		/*
		 * **Ohne Unterstreichung** (03.09.2026). `.flach` steht seit heute in
		 * `app.css` und bringt eine Unterstreichung mit; dieser Aufklapper ist
		 * aber kein Verweis, sondern oeffnet einen Kasten auf derselben Seite.
		 */
		text-decoration: none;
	}

	/* Den Abstand zwischen den Blöcken setzt der Abschnitt (`gap`), nicht der Block. */
	.neu,
	.verteiler {
		margin-top: 0;
	}

	/*
		**Drei Abschnitte, durch eine Haarlinie getrennt** (26.08.2026).

		Ohne Trennung stünden neun Felder in einem Fluss und der Kasten sähe
		wieder aufgereiht aus; mit Zwischenüberschriften über allen dreien wäre er
		lauter, als er sein muss. Die Linie kostet nichts und zeigt die Gruppen.
	*/
	.neu > .quoten,
	.neu > .kopfstimme {
		border-top: 1px solid var(--linie);
		margin-top: 1.25rem;
		padding-top: 1.1rem;
	}

	.quoten h3 {
		font-size: 0.95rem;
		margin: 0 0 0.6rem;
	}

	/*
		**Jede Quotenart eine Zeile, jede Zeile dasselbe Raster** (Auftraggeber,
		26.08.2026: «WQ könnte man besser strukturieren, ggf. untereinander, damit
		es identisch aussieht»).

		Drei feste Spuren — Name, Feld, Nenner. Weil jede Zeile dieselbe Vorlage
		führt, fluchten Felder und Nenner untereinander, ohne dass es dafür ein
		gemeinsames Raster (`subgrid`) bräuchte. Die erste Spur darf schrumpfen,
		damit lange Bezeichnungen umbrechen statt die Zeile zu sprengen; die
		zweite hat eine Untergrenze, damit auf dem Telefon eine vierstellige Quote
		noch hineinpasst.
	*/
	.sammel textarea {
		font-family: ui-monospace, monospace;
		font-size: 0.9rem;
		min-height: 9rem;
		width: 100%;
	}

	/*
	 * Die Fehlerliste im Ton einer Absage, nicht als Tabelle: Sie ist eine
	 * Aufzählung von Sätzen, und jeder nennt seine Zeile.
	 */
	.zeilenfehler {
		background: color-mix(in srgb, var(--fehler) 8%, var(--flaeche));
		border: 1px solid color-mix(in srgb, var(--fehler) 55%, var(--linie));
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		list-style: none;
		margin: 0.75rem 0;
		padding: 0.75rem 1rem;
	}

	.zeilenfehler li {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.zeilenfehler .wortlaut {
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
	}

	.zeilenfehler .grund {
		font-size: 0.9rem;
	}

	/*
	 * **Die drei Merkmale in einer eigenen Zeile** (Befund 26, 07.09.2026). Sie
	 * gehören zusammen und sind alle kurz; nebeneinander lesen sie sich als eine
	 * Frage («wie sieht die Einheit aus?») statt als drei. Dasselbe Raster wie
	 * `.felder`, aber mit schmaleren Spuren: «Zimmer» braucht keine zwölf
	 * Zentimeter.
	 */
	.merkmale {
		align-items: start;
		display: grid;
		gap: 0.5rem 1rem;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
	}

	.merkmale > label {
		display: flex;
		flex-direction: column;
		font-size: 0.9rem;
		font-weight: 550;
		gap: 0.3rem;
		min-width: 0;
	}

	.merkmale > .voll {
		grid-column: 1 / -1;
	}

	.quotenzeile {
		align-items: center;
		display: grid;
		font-size: 0.9rem;
		font-weight: 550;
		gap: 0.4rem 0.75rem;
		grid-template-columns: minmax(4rem, 1fr) minmax(3.5rem, 7rem) 3.5rem;
		/*
			Die Zeile hört auf, wo das Feld aufhört. Über die volle Kachelbreite
			gezogen stünde zwischen «Stammquote» und dem Feld eine Handbreit
			Nichts, und das Auge müsste sie jedes Mal überspringen.
		*/
		max-width: 24rem;
	}

	.quotenzeile + .quotenzeile {
		margin-top: 0.5rem;
	}

	/*
		**Auf dem schmalsten Gerät steht der Name über seiner Zeile.**

		Bei 320 px misst die Kachel 288 px, die Zeile 246 px, und der Namensspur
		bleiben davon 64 px. «Stammquote» und «Waschküche» liefen dort unter das
		Eingabefeld — im Browser nachgemessen, drei von vier Zeilen. Ein Umbruch
		hilft nicht: Es sind einzelne Wörter ohne Trennstelle.

		Die Spur nach `min-content` zu bemessen wäre der naheliegende Griff und
		wäre falsch: Dann wäre sie in jeder Zeile so breit wie ihr eigenes Wort,
		und genau das Fluchten ginge verloren, um das es hier geht.
	*/
	@media (max-width: 23rem) {
		.quotenzeile {
			grid-template-columns: minmax(3.5rem, 1fr) 3.5rem;
		}

		.quotenname {
			grid-column: 1 / -1;
		}
	}

	/* Rechtsbündig und mit gleich breiten Ziffern — wie in der Tabelle unten. */
	.quotenzeile input {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.quoten .hilfe {
		margin: 0.75rem 0 0;
	}

	/*
		Ein Auswahlfeld mit zwei Einträgen über die ganze Kachelbreite sieht aus
		wie ein Fehler. Der Hinweissatz darunter läuft weiter über die volle
		Breite — er ist ein Satz und kein Feld.
	*/
	.art select {
		max-width: 16rem;
	}

	/* Den Abstand setzt das Raster (`gap`), nicht der Absatz. */
	.kopfstimme .hilfe {
		margin: 0;
	}






	.neu button {
		margin-top: 0.9rem;
	}
	/*
		**Der Weg zur Datei gehört nach oben** (Auftraggeber, 26.08.2026: «ich finde den
		Import für den CSV nicht. Wo finde ich den? und wenn ich die Frage stellen
		muss, ist der Zugang nicht intuitiv»). Er stand nur als graue Hilfezeile
		mitten im Erfassungsformular — bei einer vollen Tabelle darüber also
		unterhalb des Bildrands. Dieselbe Form wie auf der Gemeinschafts- und der
		Eigentümerliste: Überschrift links, Handlung rechts.
	*/
	/*
		**Abstand nach unten trägt der Kopf, nicht die Überschrift** (UI-Durchgang
		06.10.2026). Den Abstand zur Kachel «Wertquoten» gab bisher nur der
		Aussenabstand der Überschrift; der Knopf daneben stand 6 px (1440) und am
		Telefon, wo er unter die Überschrift umbricht, 0 px über der Kachel.
	*/
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.kopf h1 {
		margin: 0;
	}

	.kopf .knopf {
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
		padding: 0 1.1rem;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font-weight: 550;
		text-decoration: none;
	}
</style>
