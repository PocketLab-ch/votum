<script lang="ts">
	/**
	 * Wie es bei einer Gemeinschaft um DIESEN Punkt steht — auf einer Kachel.
	 *
	 * **Der Anlass** (Auftraggeber, 25.08.2026): «ich habe […] die Abstimmung für das
	 * Traktandum 2.1 gemacht und das Traktandum geschlossen. auf dem Monitor wird
	 * das Ergebnis nicht angezeigt. […] Master ist bei den funktion die
	 * Einzelversammlung.»
	 *
	 * Die Wand einer einzelnen Versammlung (`Saalbild`) kennt vier Zustände einer
	 * Abstimmung: offen, geschlossen ohne Verkündung, Ergebnis, nichts. Die
	 * gemeinsame Wand kannte **keinen** davon — sie zeigte den Punkt und darunter
	 * die Anwesenheitszahlen, und beim Schliessen änderte sich nichts. Im Saal
	 * stand die Sitzungsleitung damit ohne Anzeige da, während das Ergebnis
	 * bereits verkündet war.
	 *
	 * **Warum eine Kachel und nicht `Saalbild` ein zweites Mal.** Am Verbundabend
	 * fasst jede Gemeinschaft ihren eigenen Beschluss — mit eigener
	 * Beschlussfähigkeit, eigenem Mehr und eigener Schwelle. Dieselbe Frage,
	 * mehrere Antworten. `Saalbild` beantwortet sie für **eine** Gemeinschaft und
	 * füllt damit die ganze Wand; nebeneinander gestellt ergäbe das fünf Wände.
	 *
	 * **Der Zwischenstand bleibt verborgen** (FR-37): Solange die Abstimmung
	 * offen ist, stehen hier zwei Zahlen — wie viele abgegeben haben und wie
	 * viele es könnten. Nie, wie sie gestimmt haben. Wer den Zwischenstand kennt,
	 * kann den Zeitpunkt des Schliessens danach wählen.
	 */
	import type { Abstimmungsstand } from '$lib/server/ereignisstrom';

	interface Eigenschaften {
		/** Kurzname der Gemeinschaft — der Name, nicht die Kennung. */
		name: string;
		/**
		 * Der Stand der Abstimmung, sofern er zu diesem Punkt gehört.
		 *
		 * Die Prüfung, ob er das tut, macht die aufrufende Seite: Sie kennt das
		 * Traktandum dieses Hauses in diesem Schritt. Ein Haus, das schon weiter
		 * ist, brächte sonst das Ergebnis eines anderen Punktes an die Wand.
		 */
		abstimmung: Abstimmungsstand | null;
	}

	let { name, abstimmung }: Eigenschaften = $props();
</script>

<article
	class="kachel"
	class:offen={abstimmung?.zustand === 'offen'}
	class:angenommen={abstimmung?.ergebnis?.angenommen === true}
	class:abgelehnt={abstimmung?.ergebnis?.angenommen === false && !abstimmung.ergebnis.keinBeschluss}
>
	<h4>{name}</h4>

	{#if !abstimmung}
		<p class="leise">noch keine Abstimmung</p>
	{:else if abstimmung.zustand === 'offen'}
		<p class="stand">
			<strong>{abstimmung.abgegeben}</strong><span class="von"
				>/{abstimmung.stimmberechtigt}</span
			>
		</p>
		<p class="leise">haben abgestimmt</p>
		{#if abstimmung.geheim}
			<!-- Die Ansage vor der Abstimmung (DSG Art. 19; Fachprüfung F-5). -->
			<p class="leise">Geheime Abstimmung</p>
		{/if}
		{#if abstimmung.konsultativ}
			<!-- Migration 158: konsultativ, ohne Beschluss. Kurz, die Kachel ist klein. -->
			<p class="leise">Konsultative Abstimmung, kein Beschluss</p>
		{/if}
		<!-- Was es braucht, steht schon vor dem Ergebnis da: Beim Prüflauf vom
		     22.08.2026 wusste niemand im Saal, wie viele Ja nötig waren. Je Haus,
		     denn die Schwelle ist je Haus eine andere. -->
		{#if abstimmung.noetig}
			<p class="noetig">{abstimmung.noetig}</p>
		{/if}
	{:else if abstimmung.ergebnis}
		{#if abstimmung.ergebnis.nachRueckkommen}
			<!-- Nach einem Rückkommen mit offenem Stichentscheid: Das Ergebnis darunter
			     ist das des früheren Durchgangs (Reste vom 30.09.2026, Punkt 1;
			     Codeprüfung M3). -->
			<p class="satz">{abstimmung.ergebnis.nachRueckkommen}</p>
		{/if}
		<!-- Am Abend entsteht «kein Beschluss» nicht (Migration 128, Aufnehmen gesperrt); gezeigt wird er trotzdem richtig. -->
		<p class="urteil">
			{abstimmung.ergebnis.keinBeschluss
				? 'Kein Beschluss'
				: abstimmung.ergebnis.angenommen
					? 'Angenommen'
					: 'Abgelehnt'}
		</p>
		<p class="satz">{abstimmung.ergebnis.satz}</p>
		<!-- Bei geheimer Abstimmung kein Zahlenspiegel (Produktentscheid 28.09.2026). -->
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
				<!-- Kopfspiegel: ohne Schwelle nur Ja, Nein und Enthaltung (Block 2). -->
				<dd>
					{abstimmung.ergebnis.koepfe.ja} ja · {abstimmung.ergebnis.koepfe.nein} nein ·
					{abstimmung.ergebnis.koepfe.enthaltung} Enth.
				</dd>
				{#if !abstimmung.ergebnis.ohneSchwelle}
					<dd class="basis">
						von {abstimmung.ergebnis.koepfe.basis}{#if abstimmung.ergebnis.koepfe.schwelle !== null && !abstimmung.ergebnis.ohneNoetig}, nötig
							{abstimmung.ergebnis.koepfe.schwelle}{/if}
					</dd>
				{/if}
			</div>
			<!--
				Die Wertquoten nur, wenn eine Schwelle für sie gilt. Beim einfachen
				Mehr gibt es keine, und eine Zeile «0 von 1000» wäre kein Ergebnis,
				sondern eine Zahl, die niemand gemessen hat.
			-->
			{#if abstimmung.ergebnis.quoten.schwelle !== null}
				<div>
					<dt>Wertquoten</dt>
					<dd>
						{abstimmung.ergebnis.quoten.ja} ja · {abstimmung.ergebnis.quoten.nein} nein ·
						{abstimmung.ergebnis.quoten.enthaltung} Enth.
					</dd>
					<dd class="basis">
						von {abstimmung.ergebnis.quoten.basis}{#if !abstimmung.ergebnis.ohneNoetig}, nötig {abstimmung.ergebnis.quoten.schwelle}{/if}
					</dd>
				</div>
			{/if}
		</dl>
		{/if}
	{:else}
		<!--
			Geschlossen, aber noch kein Ergebnis: ein Gleichstand, dessen Entscheid
			noch aussteht oder sich aus der Handzählung nicht ablesen lässt, oder
			die Auszählung hängt an einer fehlenden Angabe. Was nicht feststeht,
			gehört nicht an die Wand — aber dass es aussteht, schon.
		-->
		<p class="urteil warten">Geschlossen</p>
		<!-- Beim offenen Stichentscheid der Satz dazu statt eines Versprechens (Probe Wertquotenmehr, B4). -->
		<p class="leise">{abstimmung.wartesatz ?? 'Das Ergebnis steht noch nicht fest.'}</p>
	{/if}
</article>

<style>
	/*
	 * Dieselbe Bauart wie `Beschlussfaehigkeitskachel`: Rahmen, farbiger Streifen
	 * links als Urteil, Inhalt darunter. Zwei verschiedene Kachelformen
	 * nebeneinander auf einer Wand läsen sich wie zwei verschiedene Anwendungen.
	 */
	.kachel {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.8rem 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche-2);
		border-left: 4px solid var(--linie);
	}

	.kachel.offen {
		border-left-color: var(--warnung);
	}

	.kachel.angenommen {
		border-left-color: var(--akzent);
	}

	.kachel.abgelehnt {
		border-left-color: var(--fehler);
	}

	h4 {
		margin: 0;
		font-size: clamp(1rem, 1.5vw, 1.5rem);
		font-weight: 600;
		line-height: 1.2;
		/* Ein langer Gemeinschaftsname darf umbrechen, aber die Kachel nicht
		   sprengen. */
		overflow-wrap: anywhere;
	}

	p {
		margin: 0;
	}

	.stand {
		font-size: clamp(1.6rem, 3.4vw, 3.4rem);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.von {
		color: var(--text-leise);
		font-size: 0.55em;
	}

	.urteil {
		font-size: clamp(1.3rem, 2.6vw, 2.6rem);
		font-weight: 700;
		line-height: 1.1;
		color: var(--fehler);
	}

	.kachel.angenommen .urteil {
		color: var(--akzent);
	}

	/* Geschlossen, aber ohne Ergebnis: kein Urteil, also auch keine Urteilsfarbe. */
	.urteil.warten {
		color: var(--text);
	}

	.satz,
	.noetig {
		font-size: clamp(0.85rem, 1.3vw, 1.3rem);
		color: var(--text-leise);
		line-height: 1.25;
	}

	.leise {
		font-size: clamp(0.8rem, 1.2vw, 1.2rem);
		color: var(--text-leise);
	}

	dl {
		margin: 0.2rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: clamp(0.8rem, 1.15vw, 1.15rem);
	}

	/* Die Köpfe als Auskunft nach den Wertquoten (Regel «Köpfe zählen nicht»). */
	dl .auskunft {
		order: 2;
	}

	dt {
		font-weight: 600;
	}

	dd {
		margin: 0;
		color: var(--text-leise);
		font-variant-numeric: tabular-nums;
	}

	.basis {
		font-size: 0.9em;
	}
</style>
