<script lang="ts">
	/**
	 * Das Protokoll der gemeinsamen Versammlung (Story 7.5b).
	 *
	 * **Die Geltungsklausel steht über allem.** Das Dokument gilt für alle
	 * beteiligten Gemeinschaften zugleich, und jede genehmigt nur den sie
	 * betreffenden Teil. Wer es unterschreibt, muss das vorher gelesen haben —
	 * deshalb ist es die erste Zeile der Seite und nicht eine Fussnote.
	 *
	 * **Der Entwurfsfall ist der gefährliche.** Seit das Protokoll signiert wird
	 * (Auftraggeber, 12.08.2026: «Ich kann das PDF dann digital mit Skribble signieren»),
	 * ist eine Lücke nicht mehr unschön, sondern folgenreich. Solange etwas fehlt,
	 * sagt die Seite es in Warnfarbe, und der Knopf heisst «Entwurf als PDF».
	 *
	 * **Ein Seitenstapel: Lage, Bestand, Handeln** (01.09.2026, `docs/gestaltung.md`,
	 * «Der Seitenstapel»). Bis dahin stand hier eine Arbeitsfläche mit Bestand
	 * links und Handlung rechts. Die Reihenfolge hat sich dabei geändert: «Stand»
	 * sagt, ob überhaupt unterschrieben werden darf, und stand vorher rechts an
	 * dritter Stelle — unter dem Block zum Unterzeichnen.
	 */
	import { enhance } from '$app/forms';
	import { GELTUNG } from '$lib/domain/gemeinsamesprotokoll';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';
	import Signaturwege from '$lib/components/Signaturwege.svelte';
	import Standfelder from '$lib/components/Standfelder.svelte';
	import { LEITUNGSFELDER } from '$lib/domain/versammlung';

	let { data, form } = $props();

	const z = $derived(data.zusammenstellung);

	/**
	 * Die Wahl beim Unterschriftsblock, als Anhang für die Ausgabewege.
	 *
	 * Sie hängt an **beiden** Verweisen, PDF und Word: Zwei Ausgaben derselben
	 * Seite müssen dasselbe Dokument liefern.
	 */
	const wahl = $derived(data.unterschriften ? '' : '?unterschrift=ohne');

	/**
	 * Der Text in die Zwischenablage.
	 *
	 * **Kein Speichern, kein Bearbeiten** — massgebend ist die Fassung, die
	 * signiert wurde (siehe `+page.server.ts`). Wer den Text anderswo
	 * weiterverarbeiten will, kopiert ihn; das PDF bleibt die Fassung zum
	 * Unterschreiben.
	 */
	let kopiert = $state(false);
	async function kopieren() {
		await navigator.clipboard.writeText(z.text);
		kopiert = true;
		setTimeout(() => (kopiert = false), 2500);
	}
</script>

<h1>Protokoll des Abends</h1>

<!--
	Der Entwurfshinweis steht **vor** der Geltungsklausel und in Warnfarbe: Wer die
	Seite öffnet, um das Protokoll zu unterschreiben, soll zuerst lesen, dass er
	das noch nicht darf.
-->
{#if z.luecke}
	<p class="entwurf" role="status">
		<strong>Entwurf — noch nicht zu unterzeichnen.</strong>
		{z.luecke}. Solange etwas fehlt, trägt auch das PDF diesen Vermerk auf jedem Blatt.
	</p>
{/if}

<!--
	`role="note"` und nicht `alert`: Es ist keine Störung, sondern eine dauerhafte
	Einordnung. Ein Alarm, der bei jedem Aufruf ertönt, wird nach dem dritten Mal
	überlesen.
-->
<p class="geltung" role="note">{GELTUNG}</p>

<!--
	Der Seitenstapel statt zweier Spalten (01.09.2026, Task 4 aus
	`docs/plan-seitenaufbau-2026-08-27.md`).

	**Die Reihenfolge ist die des Modells** (`docs/gestaltung.md`: Lage, Bestand,
	Handeln). Sie ändert sich dabei, und das ist der Gewinn: «Stand» sagt, ob das
	Protokoll überhaupt unterschrieben werden darf, und stand bisher rechts an
	dritter Stelle — unter dem Block zum Unterzeichnen. Wer die Seite öffnet, um
	zu unterschreiben, las die Antwort erst, nachdem er den Knopf gesehen hatte.

	**Was das Nebeneinander kostete:** Links eine Kachel, rechts vier. Der
	Protokolltext ist so lang, wie er ist, die vier daneben sind es auch — und
	unter der kürzeren der beiden Spalten stand die Lücke, um die es geht.
-->
<div class="seitenstapel">
	<!-- Lage: Wo stehe ich? -->
	<section class="abschnitt">
		<section class="kachel">
			<h2>Stand</h2>
			<ul class="stand">
				<li>
					<span class="zahl">{z.versammlungen}</span>
					{z.versammlungen === 1 ? 'Gemeinschaft tagt' : 'Gemeinschaften tagen'} an diesem Abend
				</li>
				<li>
					<span class="zahl">{z.punkte}</span>
					{z.punkte === 1 ? 'Punkt' : 'Punkte'} auf der Liste des Abends
				</li>
				{#if z.offeneErgebnisse > 0}
					<!--
						**Die Zahl braucht ihre Bezugsgrösse** (23.08.2026, Prüflauf II,
						D-01). «13 Punkte auf der Liste» und darunter «18 Abstimmungen
						ohne Ergebnis» — beide richtig, aber die eine zählt Traktanden und
						die andere Abstimmungen je Gemeinschaft. Wer sie nebeneinander
						liest, stutzt.
					-->
					<li class="offen">
						<span class="zahl">{z.offeneErgebnisse}</span>
						von {z.abstimmungenGesamt}
						{z.abstimmungenGesamt === 1 ? 'Abstimmung' : 'Abstimmungen'} ohne Ergebnis
					</li>
				{/if}
			</ul>
			{#if z.luecke}
				<p class="luecke" role="status"><span aria-hidden="true">!</span> {z.luecke}</p>
			{/if}
		</section>
	</section>

	<!-- Bestand: Was ist da? -->
	<section class="abschnitt">
		<section class="kachel">
			<h2>Der Text</h2>
			<!--
				`<pre>` und kein gesetztes Dokument: Der Kern gibt Text mit einer
				winzigen Auszeichnung aus (`#`, `##`, `- `), genau wie beim Protokoll
				einer einzelnen Versammlung. Wer ihn weiterverarbeitet, will ihn so
				sehen, wie er ankommt — und nicht raten, was die Anzeige daraus gemacht
				hat.
			-->
			<pre class="text">{z.text}</pre>
		</section>
	</section>

	<!-- Handeln: Was kann ich tun? In der Reihenfolge der Arbeit. -->
	<section class="abschnitt">
		<!--
			**Kein gespeicherter Entwurf.** Die Zusammenstellung entsteht bei jedem
			Aufruf neu — anders als beim Protokoll einer einzelnen Versammlung gibt
			es hier nichts, was nachgezogen werden müsste. Wer den Namen einträgt,
			sieht ihn beim nächsten Aufbau im Kopf.

			**Der Unterschriftsblock erscheint erst im vollständigen Protokoll.**
			Solange eine Lücke besteht, lässt `gemeinsamesprotokoll.ts` ihn weg
			(dort Zeile 354: «Kein Unterschriftsblock unter einem Entwurf»). Der
			Hilfetext unten sagt das, damit niemand die Eingabe für verloren hält.

		-->
		<section class="kachel">
			<h2>Vorsitz und Protokollführung</h2>
			{#if form?.fehler}
				<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
			{:else if form?.hinweis}
				<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
			{/if}
			<p class="hilfe">
				Am gemeinsamen Abend unterschreiben alle Beteiligten <strong>ein</strong> Dokument.
				Beides ist freiwillig — das Gesetz verlangt als Protokollinhalt nur die Beschlüsse
				(ZGB Art. 712n Abs. 2); der SVIT-Kommentar empfiehlt die Unterzeichnung durch den
				Verfasser und den Vorsitzenden. Der Name erscheint sofort im Kopf des Textes;
				<strong>über der Unterschriftszeile</strong> steht er, sobald das Protokoll
				vollständig ist — solange es Entwurf ist, trägt es gar keinen Unterschriftsblock.
			</p>
			<form method="POST" action="?/leitung" class="felder" use:enhance>
			<Standfelder
				felder={Object.keys(LEITUNGSFELDER)}
				bestand={{
					sitzungsleitung: data.tag?.sitzungsleitung,
					protokollfuehrung: data.tag?.protokollfuehrung
				}}
				stand={form?.stand}
			/>
				<label>
					Wer führte den Vorsitz? <span class="hilfe">freiwillig</span>
					<input
						name="sitzungsleitung"
						minlength="2"
						maxlength="120"
						{...anfangswert(
							form?.werte?.sitzungsleitung ?? data.tag?.sitzungsleitung ?? ''
						)}
					/>
				</label>
				<label>
					Wer schrieb das Protokoll? <span class="hilfe">freiwillig</span>
					<input
						name="protokollfuehrung"
						minlength="2"
						maxlength="120"
						{...anfangswert(
							form?.werte?.protokollfuehrung ?? data.tag?.protokollfuehrung ?? ''
						)}
					/>
				</label>
				<p><button type="submit">Vorsitz speichern</button></p>
			</form>
		</section>

		<section class="kachel">
			<h2>Ausgeben und unterzeichnen</h2>
			<p class="hilfe">
				Das PDF ist die Fassung, die unterschrieben wird — und beim gemeinsamen Protokoll
				unterschreibt jede Gemeinschaft dasselbe Dokument.
			</p>
			<!--
				**Dieselbe Auskunft wie auf der Versammlungsseite**, aus derselben
				Komponente. Vorher stand hier eine eigene Fassung, und die beiden waren
				bereits auseinandergelaufen (22.08.2026).
			-->
			<Signaturwege />
			<!--
				**Die Wahl steht in der Adresse, nicht in einem Schalter mit Javascript.**
				Sie muss in denselben PDF-Aufruf durchreichen, damit Bildschirm und
				Dokument dasselbe zeigen — und ein Formular mit GET tut das auch ohne
				Javascript. Vorgabe ist «mit»: Das Gesetz verlangt keine Unterschrift
				(ZGB 712n Abs. 2), die meisten Reglemente schon.
			-->
			<form method="GET" class="wahl">
				<label class="schalter">
					<input
						type="checkbox"
						name="unterschrift"
						value="ohne"
						{...angekreuzt(!data.unterschriften)}
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
					/>
					Ohne Unterschriftsblock
				</label>
				<noscript><button type="submit" class="leise">Übernehmen</button></noscript>
			</form>

			<!--
				**Alle Formate, wie beim Protokoll der Einzelversammlung** (Auftraggeber,
				12.08.2026: «Auch Docx. Und beim Einzel auch PDF. So hat man alle
				Optionen offen.», ergänzt am 05.09.2026 um OpenDocument.) Das PDF ist
				die Fassung zum Signieren, Word und OpenDocument sind die zum
				Nachbearbeiten — welcher Weg der richtige ist, entscheidet der Fall.

				Die Wahl beim Unterschriftsblock hängt an beiden Verweisen: Zwei
				Ausgaben derselben Seite müssen dasselbe Dokument liefern.
			-->
			<div class="knoepfe">
				<a
					class="knopf"
					href="/tage/{data.rahmenTag.id}/protokoll.pdf{wahl}"
					target="_blank"
					rel="noopener"
				>
					{z.luecke ? 'Entwurf als PDF' : 'Als PDF'}
				</a>
				<a
					class="knopf leise"
					href="/tage/{data.rahmenTag.id}/protokoll.docx{wahl}"
					data-sveltekit-reload
				>
					Als Word
				</a>
				<a
					class="knopf leise"
					href="/tage/{data.rahmenTag.id}/protokoll.odt{wahl}"
					data-sveltekit-reload
				>
					Als OpenDocument
				</a>
				<button type="button" class="leise" onclick={kopieren}>Text kopieren</button>
				{#if kopiert}<span class="bestaetigt" role="status">In der Zwischenablage.</span>{/if}
			</div>
			<p class="hilfe nachtrag">
				Das Protokoll wird hier nicht gespeichert. Es entsteht bei jedem Aufruf neu aus dem,
				was gerade steht — so kann es nicht hinter den Beschlüssen zurückbleiben. Massgebend
				ist die Fassung, die Sie signiert haben; jede Gemeinschaft hält die Fassung, die sie
				verschickt, auf ihrer Protokollseite fest.
			</p>
		</section>

		<section class="kachel">
			<h2>Genehmigung und Versiegelung</h2>
			<p class="hilfe">
				Auch Versand und Genehmigung liegen je Gemeinschaft: Jedes Haus hält auf seiner
				Protokollseite die Fassung fest, die es verschickt hat. Die Genehmigung trägt seine
				Leitung nach der nächsten Versammlung dort ein. Versiegelt wird ebenfalls je
				Versammlung, mit ihrem Abschlusspaket — Sie finden sie über
				<a href="/tage/{data.rahmenTag.id}">die Versammlungen dieses Abends</a>.
			</p>
		</section>
	</section>
</div>

<style>
	/*
	 * Der Entwurfsvermerk trägt die Warnfarbe, die Geltungsklausel nicht: Die eine
	 * hält etwas auf, die andere ordnet nur ein. Zwei gleich laute Kästen
	 * nebeneinander liest man beide nicht mehr.
	 */
	.entwurf {
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
		border-left: 3px solid var(--warnung);
		border-radius: var(--radius);
		color: var(--warnung);
		margin: 0 0 1rem;
		max-width: 60rem;
		padding: 0.85rem 1rem;
	}

	.geltung {
		background: var(--flaeche-2);
		border-left: 3px solid var(--akzent);
		border-radius: var(--radius);
		margin: 0 0 1.5rem;
		max-width: 60rem;
		padding: 0.85rem 1rem;
	}

	/*
	 * **Der Text rollt in seinem Kasten** (01.09.2026, Stapelumbau).
	 *
	 * Nebeneinander war er die linke Spalte und die vier Handlungsblöcke standen
	 * rechts daneben — beide von oben erreichbar. Im Stapel steht das Handeln
	 * darunter, und dieser Text ist mit Abstand der längste Block der Seite:
	 * gemessen 1150 von 4400 px bei acht Traktanden, und er wächst mit jedem
	 * weiteren. Ohne Grenze läge «Unterschreiben» zwei Bildschirme unter dem
	 * Knopf, der hierher geführt hat.
	 *
	 * `70vh` und nicht weniger: Der Kasten soll den Text lesbar zeigen, nicht
	 * andeuten. Beim Drucken fällt die Grenze weg — ein abgeschnittenes Protokoll
	 * auf Papier wäre schlimmer als eine lange Seite.
	 */
	.text {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85rem;
		line-height: 1.5;
		margin: 0;
		max-height: 70vh;
		overflow-y: auto;
		/*
		 * Umbrechen statt seitwärts rollen: Ein Protokolltext mit langen Absätzen
		 * ergäbe sonst eine Bahn, die breiter ist als der Bildschirm — und die
		 * Seite liesse sich quer schieben (docs/gestaltung.md, kein Querlauf).
		 */
		white-space: pre-wrap;
		word-break: break-word;
	}

	@media print {
		.text {
			max-height: none;
			overflow: visible;
		}
	}

	.hilfe {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0 0 0.75rem;
	}

	.knoepfe {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.nachtrag {
		margin: 0.75rem 0 0;
	}

	.wahl {
		margin: 0 0 0.85rem;
	}

	.schalter {
		align-items: center;
		color: var(--text);
		cursor: pointer;
		display: flex;
		font-size: 0.9rem;
		gap: 0.5rem;
		min-height: var(--ziel-min);
	}

	.schalter input {
		height: 1.1rem;
		width: 1.1rem;
	}

	.knopf,
	button {
		background: var(--akzent);
		border: none;
		border-radius: var(--radius);
		color: var(--akzent-text);
		cursor: pointer;
		font: inherit;
		font-weight: 550;
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
	}

	.knopf {
		align-items: center;
		display: inline-flex;
		text-decoration: none;
	}

	/* Das PDF ist die Sache — Word und Kopieren sind die Nebenwege. */
	button.leise,
	.knopf.leise {
		background: none;
		border: 1px solid var(--linie);
		color: var(--text);
		font-weight: 400;
	}

	.bestaetigt {
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.stand {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.stand li {
		align-items: baseline;
		display: flex;
		gap: 0.5rem;
		padding: 0.2rem 0;
	}

	.zahl {
		font-variant-numeric: tabular-nums;
		font-weight: 650;
		min-width: 1.5rem;
		text-align: right;
	}

	.stand li.offen .zahl {
		color: var(--warnung);
	}

	.luecke {
		color: var(--warnung);
		font-size: 0.9rem;
		margin: 0.6rem 0 0;
	}
</style>
