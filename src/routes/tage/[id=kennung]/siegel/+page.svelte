<script lang="ts">
	/**
	 * Versiegeln am gemeinsamen Abend.
	 *
	 * **Eine Seite, eine Frage** (docs/gestaltung.md, Regel 1): «Ist der Abend
	 * abgeschlossen?» Die Liste beantwortet sie je Gemeinschaft, der Knopf
	 * darunter erledigt, was fehlt.
	 *
	 * **Warum es fünf Siegel sind und nicht eines** (Auftraggeber, 25.08.2026: «Warum
	 * kann nicht auf der Stufe Gruppe versiegelt werden?»): Der Grund steht
	 * zugeklappt hinter «Was heisst das?» (Regel 4) — er gehört auf die Seite,
	 * weil die Frage naheliegt, und nicht in den Weg dessen, der nur
	 * abschliessen will.
	 */
	import Meldung from '$lib/components/Meldung.svelte';
	import { zeitpunktLang } from '$lib/domain/datum';
	import { zustandsname } from '$lib/domain/versammlung';

	let { data, form } = $props();

	const offen = $derived(data.zeilen.filter((z) => !z.siegelkopf));
	/*
	 * zustand-nur-geschlossen: Diese Seite fragt «darf versiegelt werden», und
	 * das ist genau der Zustand VOR dem Siegel. `offen` enthält ohnehin nur
	 * Häuser ohne Siegelkopf; eine versiegelte Versammlung steht gar nicht zur
	 * Wahl.
	 */
	const bereit = $derived(offen.filter((z) => z.zustand === 'geschlossen' && !z.hindernis));
	/*
	 * zustand-nur-geschlossen: Die geschlossenen Häuser, bei denen das Siegel
	 * selbst nicht geht: Sie stehen nicht als «bereit» da, und der Knopf zählt
	 * sie nicht mit.
	 */
	const gehindert = $derived(offen.filter((z) => z.zustand === 'geschlossen' && z.hindernis));
	// zustand-nur-geschlossen: die Gegenmenge zu `bereit`, siehe oben.
	const nochNicht = $derived(offen.filter((z) => z.zustand !== 'geschlossen'));
</script>

<h1>Versiegeln</h1>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

<p class="einleitung">
	Das Siegel macht das Abschlusspaket einer Gemeinschaft unveränderlich: Wer später
	fragt, was beschlossen wurde, bekommt genau das, was am Abend feststand.
	<strong>Jede Gemeinschaft bekommt ihr eigenes Paket</strong> — der Knopf hier nimmt
	Ihnen nur ab, es einzeln zu tun. Danach hält die Leitung jeder Gemeinschaft auf der
	Protokollseite ihres Hauses fest, welche Fassung sie verschickt hat. Die Genehmigung
	trägt sie nach der nächsten Versammlung dort ein.
</p>

<details class="hintergrund">
	<summary>Was heisst das?</summary>
	<p>
		Ein Abschlusspaket trägt acht Bestandteile:
	</p>
	<ul>
		<li>die Gemeinschaft</li>
		<li>wer stimmberechtigt war</li>
		<li>die Anwesenheit</li>
		<li>die Vollmachten samt Nachweisen</li>
		<li>die Traktanden</li>
		<li>die Abstimmungsdurchgänge</li>
		<li>die Anhänge</li>
		<li>die Auswertung</li>
	</ul>
	<p>
		Alle davon gibt es <strong>nur je Gemeinschaft</strong>. Ein gemeinsames Paket
		müsste sie vermengen. Im Anfechtungsfall bekäme ein Haus dann die Listen der
		anderen mitgeliefert — und die eigene nur als Teil darin.
	</p>
	<p>
		Dazu kommt der Ablauf: Die Gemeinschaften schliessen zu verschiedenen Zeiten, und
		versiegelt wird, was feststeht. Ein Haus, das noch tagt oder vertagt wurde, würde
		ein gemeinsames Siegel aufhalten.
	</p>
	<p>
		Das <a href="/tage/{data.tagId}/protokoll">Protokoll</a> ist dagegen eines für den
		ganzen Abend — dort ist die gemeinsame Führung richtig, weil im Saal eine Sitzung
		stattfand und nicht fünf.
	</p>
</details>

<!--
	**Die Tabelle rollt in ihrem Rahmen** (02.09.2026). Vier Spalten passen am
	Telefon nicht nebeneinander; ohne den Rahmen schob die Tabelle die ganze Seite
	42 px seitlich weg. `.tabellenrahmen` ist dafür das Muster im Haus, es steht
	schon auf sieben Seiten.
-->
<div class="tabellenrahmen">
<table class="haeuser">
	<thead>
		<tr>
			<th>Gemeinschaft</th>
			<th>Stand</th>
			<th>Siegel</th>
			<th>Zeitstempel</th>
		</tr>
	</thead>
	<tbody>
		{#each data.zeilen as z (z.versammlungId)}
			<tr>
				<td><a href="/versammlungen/{z.versammlungId}/siegel">{z.gemeinschaft}</a></td>
				<td>
					<!--
						Dieselbe Pille wie in der Seitenleiste (docs/gestaltung.md) — und
						`zustandsname`, damit «entwurf» auch hier «in Vorbereitung»
						heisst. Ein Zustand, der an zwei Orten anders lautet, ist zwei
						Zustände für den, der ihn liest.
					-->
					{#if z.siegelkopf}
						<span class="pille" data-art="geschlossen">versiegelt</span>
					{:else if z.hindernis}
						<!--
							**Nicht «bereit», sondern der Grund.** Ein Haus, dessen
							Durchgang sich nicht lesen lässt, gehört nicht in die Zahl am
							Knopf: Der Klick versiegelt es ohnehin nicht, und «bereit» wäre
							die falsche Auskunft.
						-->
						<span class="pille" data-art="gehindert">nicht möglich</span>
						<span class="leise grund">{z.hindernis}</span>
					<!-- zustand-nur-geschlossen: der Zustand vor dem Siegel, siehe oben. -->
					{:else if z.zustand === 'geschlossen'}
						<span class="pille" data-art="laufend">bereit</span>
					{:else}
						<span class="leise">{zustandsname(z.zustand)}</span>
					{/if}
				</td>
				<td>
					{#if z.siegelkopf}
						<code>{z.siegelkopf}…</code>
						{#if z.versiegeltAm}
							<span class="leise">{zeitpunktLang(z.versiegeltAm)}</span>
						{/if}
					{:else}
						<span class="leise">—</span>
					{/if}
				</td>
				<td>
					{#if !z.siegelkopf}
						<span class="leise">—</span>
					{:else if z.zeitstempel === 'vorhanden'}
						liegt vor
						<!--
							**Der Ersatz gehört sichtbar dazu** (13.11.2026). Stand
							hier nur «liegt vor», sah ein Siegel mit einem Stempel
							von freetsa aus wie eines von DigiCert, und der Grund
							des Einspringens war nirgends zu lesen.
						-->
						{#if z.zeitstempelVomErsatz}
							<span class="leise">vom Ersatzdienst</span>
							{#if z.zeitstempelhinweis}
								<span class="leise ersatzgrund">{z.zeitstempelhinweis}</span>
							{/if}
						{/if}
					{:else}
						<span class="wartet">steht aus</span>
						{#if z.zeitstempelhinweis}
							<span class="leise">{z.zeitstempelhinweis}</span>
						{/if}
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
</div>

{#each data.zeilen.filter((z) => z.hakenhinweis) as z (z.versammlungId)}
	<p class="meldung" data-hakenhinweis>
		<strong>{z.gemeinschaft}:</strong>
		{z.hakenhinweis}
		<a href="/versammlungen/{z.versammlungId}/protokoll">Zum Protokoll dieser Gemeinschaft</a>
	</p>
{/each}

{#if bereit.length > 0}
	<form method="POST" action="?/versiegeln" class="tun">
		<button type="submit" class="haupt">
			{bereit.length === 1
				? '1 Gemeinschaft versiegeln'
				: `${bereit.length} Gemeinschaften versiegeln`}
		</button>
		{#if nochNicht.length > 0}
			<p class="hilfe">
				Nicht dabei, weil noch nicht geschlossen:
				{nochNicht.map((z) => z.gemeinschaft).join(', ')}.
			</p>
		{/if}
		{#if gehindert.length > 0}
			<p class="hilfe">
				Nicht dabei, weil nicht möglich:
				{gehindert.map((z) => z.gemeinschaft).join(', ')}. Der Grund steht in der Zeile.
			</p>
		{/if}
	</form>
{:else if offen.length > 0}
	<p class="hilfe">
		Noch nichts zu versiegeln — versiegelt wird, was feststeht.
		{#if nochNicht.length > 0}
			Offen sind: {nochNicht.map((z) => z.gemeinschaft).join(', ')}.
		{/if}
		{#if gehindert.length > 0}
			Nicht möglich: {gehindert.map((z) => z.gemeinschaft).join(', ')}; der Grund steht in der
			Zeile.
		{/if}
	</p>
{:else}
	<p class="hilfe">Alle Gemeinschaften des Abends sind versiegelt.</p>
{/if}

<style>
	/*
	 * Dasselbe Muster wie auf den Stammdatenseiten: ein Rahmen, in dem die
	 * Tabelle seitlich rollt, statt die Seite mitzunehmen.
	 */
	.tabellenrahmen {
		overflow-x: auto;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	.hintergrund {
		max-width: var(--lesebreite);
		margin: 0.75rem 0 1.25rem;
	}

	.hintergrund p {
		margin: 0.5rem 0;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	/*
	 * **Im Rahmen ohne eigenen Aussenabstand** (06.10.2026, UI-Durchgang). Die
	 * Tabelle stand mit `margin-bottom: 1rem` und ohne linken Innenabstand im
	 * Rahmen: Die erste Spalte klebte mit 0 px an der Linie, und unter der
	 * letzten Zeile lag ein leerer Streifen von 16 px. Den Abstand nach unten
	 * tragen jetzt die Blöcke darunter (`.tun`, `.hilfe`).
	 */
	.haeuser {
		width: 100%;
		border-collapse: collapse;
	}

	.haeuser th,
	.haeuser td {
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--linie);
		vertical-align: top;
	}

	/* Die letzte Linie zieht der Rahmen selbst. */
	.haeuser tbody tr:last-child td {
		border-bottom: none;
	}

	.haeuser th {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-leise);
	}

	.leise {
		color: var(--text-leise);
		font-size: 0.9rem;
		display: block;
	}

	/*
	 * Der Grund eines Hindernisses ist länger als eine Pillenbreite. Die
	 * Begrenzung hält die Zeile lesbar, ohne den Satz zu kürzen.
	 */
	.grund {
		max-width: 30rem;
	}

	/*
	 * Der Grund des Einspringens steht auch bei «liegt vor» und bekommt eine
	 * eigene Kante: Er ist kein Nebensatz zum Zustand, sondern der Hinweis,
	 * dass der Hauptdienst gerade nicht liefert (13.11.2026).
	 */
	.ersatzgrund {
		border-left: 3px solid var(--warnung);
		margin-top: 0.3rem;
		max-width: 30rem;
		padding-left: 0.5rem;
	}

	.wartet {
		color: var(--text);
	}

	/* Wortgleich mit der Pille der Seitenleiste — derselbe Zustand soll überall
	   gleich aussehen (docs/gestaltung.md). */
	.pille {
		display: inline-block;
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

	/* «nicht möglich» trägt die Warnfarbe: Es ist kein Zustand des Ablaufs,
	   sondern eine Absage an das, was der Knopf tun soll. */
	.pille[data-art='gehindert'] {
		background: color-mix(in srgb, var(--warnung) 20%, transparent);
		color: var(--text);
		font-weight: 550;
	}

	.tun {
		margin-top: 1rem;
	}

	.hilfe {
		color: var(--text-leise);
		font-size: 0.9rem;
		max-width: var(--lesebreite);
	}
</style>
