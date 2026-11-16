<script lang="ts">
	import { datumLang } from '$lib/domain/datum';

	/**
	 * **Der Ausweichplan, an einer Stelle.**
	 *
	 * Gemeldet am 20.08.2026: «Die Ausfallsicherung zu machen gehört zur
	 * Vorbereitung.» Die Unterlagen standen nur unter «Jederzeit» — dort
	 * findet sie, wer sie sucht, und das ist genau der Fall, der nicht eintritt:
	 * Wer an den Ausfall denkt, hat ihn schon.
	 */
	let { data } = $props();

	const v = $derived(data.versammlung);
</script>

<h1>Ausfallsicherung</h1>
<p class="unterzeile">{data.gemeinschaftName} · Versammlung vom {datumLang(v.datum)}</p>

<p class="lesebreite">
	<strong>Holen Sie diese Unterlagen vor der Versammlung</strong> — auf Papier oder auf einen
	Stick. Wer sie braucht, hat den Server nicht mehr, von dem er sie holen könnte.
</p>

{#if !data.freigegeben}
	<!--
		**Die Warnung stand da, die Knöpfe auch** (23.08.2026, Prüflauf II).
		Unterschriftenliste und Auszählmappe rechnen auf dem eingefrorenen
		Stand der Stimmberechtigten; ohne Freigabe gibt es den nicht, und der
		Downloadweg sagt mit HTTP 400 ab. Wer die Warnung überlas — und dafür ist
		sie da —, klickte trotzdem und landete auf einer JSON-Zeile.

		Gefunden hat das nicht der Prüflauf, sondern der Absagenwächter, als er
		auf die Downloadwege erweitert wurde. Genau dafür ist er da.
	-->
	<p class="meldung warnung">
		Die Versammlung ist noch nicht freigegeben. Die Unterlagen rechnen auf dem eingefrorenen
		Stand der Stimmberechtigten — vorher gibt es ihn nicht, und die Zahlen wären vorläufig.
		<strong>Geben Sie die Versammlung zuerst frei</strong>, dann stehen sie hier bereit.
	</p>
{/if}

<section class="unterlagen">
	<article>
		<h2>Alle Traktanden</h2>
		<p>
			Die vollständige Liste mit Antragswortlaut und nötigem Mehr — das, was sonst an der Wand
			stünde.
		</p>
		<a
			class="knopfartig"
			href="/versammlungen/{v.id}/traktandenliste.pdf"
			target="_blank"
			rel="noopener">Als PDF öffnen</a
		>
	</article>

	<!--
		**Die Unterschriftenliste gehörte hierher** (23.08.2026, Befund B-15). Sie
		wird seit dem 30.07. erzeugt und war trotzdem nicht zu finden: Ihr einziger
		Verweis stand auf der Anwesenheitsseite in `{#if listenmodus && laufend}` —
		also erst, wenn die Versammlung LÄUFT.

		Gebraucht wird sie vorher. Man druckt sie aus und legt sie an den Eingang;
		wer erst im Saal danach sucht, hat sie nicht. Der Prüfer suchte im
		Usability-Lauf die ganze Seitenleiste, die Anwesenheitsseite und diese
		Seite ab und schrieb «die Anwendung erzeugt keine» — sie tut es, nur zu
		einem Zeitpunkt, an dem es zu spät ist.
	-->
	<article>
		<h2>Unterschriftenliste</h2>
		<p>
			Ein Blatt mit allen Stimmberechtigten, ihren Einheiten, Kopfstimmen und Wertquoten — dazu
			die Spalte für die Unterschrift. Sie trägt den Nachweis der Anwesenheit, nicht das System.
		</p>
		{#if data.freigegeben}
			<a
				class="knopfartig"
				href="/versammlungen/{v.id}/unterschriftenliste.pdf"
				target="_blank"
				rel="noopener">Als PDF öffnen</a
			>
		{:else}
			<p class="probe">Bereit, sobald die Versammlung freigegeben ist.</p>
		{/if}
	</article>

	<article>
		<h2>Stimmzettel und Zählblatt</h2>
		<p>
			Je Traktandum ein Zettel zum Ausschneiden, mit Antrag, Stimmgewicht und Feldern zum
			Ankreuzen; vorne das Zählblatt für die Sitzungsleitung. Wo Handerheben genügt, stehen die
			Zettel in einem eigenen Teil, den Sie nur bei Bedarf drucken.
		</p>
		<a
			class="knopfartig"
			href="/versammlungen/{v.id}/stimmzettel.pdf"
			target="_blank"
			rel="noopener">Als PDF öffnen</a
		>
	</article>

	<article>
		<h2>Auszählmappe</h2>
		{#if !data.mappeNoetig}
			<!--
				**Kein Knopf, wo der Server absagt** (23.08.2026, Prüflauf II, C-02).
				Die Mappe entsteht nur, wo es etwas zu rechnen gibt. Vorher stand der
				Knopf auch sonst da; wer klickte, bekam HTTP 400 mit einer
				JSON-Zeile — und die Ablaufleiste blieb auf «2 von 3 Unterlagen
				geholt» stehen, ein Schritt, der sich nie abschliessen liess.
			-->
			<p>
				<strong>Für diesen Abend nicht nötig.</strong> Jedes Traktandum entscheidet
				sich an mehr als der Hälfte der Anwesenden, und alle Parteien haben gleich
				viele Kopfstimmen. Das lässt sich im Saal mit erhobenen Händen auszählen.
			</p>
			<p>Die Zahlen tragen Sie ins Zählblatt vorne im Stimmzettel-PDF ein.</p>
			<!--
				**Die Aufzählung nennt alle Gründe, nicht zwei davon** (04.09.2026).
				Vorher standen hier Wertquoten und Abwesende; seither sind eine andere
				Schwelle und die Enthaltungsregel dazugekommen. Wer die kürzere Liste
				liest, hält die Mappe für unnötig, obwohl sie erscheinen wird.
			-->
			<!--
				**Ein Kasten, nicht zwei** (UI-Durchgang 06.10.2026). Die Klasse stand
				an Satz und Liste getrennt; das ergab zwei Kästen mit einer Fuge
				dazwischen, und die Aufzählungspunkte lagen ohne Einzug halb ausserhalb.
			-->
			<div class="probe">
				<p>Die Mappe erscheint hier von selbst, sobald ein Traktandum</p>
				<ul>
					<li>Wertquoten verlangt,</li>
					<li>die Abwesenden in die Bezugsgrösse nimmt,</li>
					<li>eine andere Mehrheit fordert als mehr als die Hälfte,</li>
					<li>Enthaltungen aus der Bezugsgrösse nimmt,</li>
					<li>Betroffene aus einer Bezugsgrösse nimmt, die sie nicht eigens nennt, etwa bei Ausschlussklage oder Einsprache,</li>
					<li>ein zweites Ergebnis nach einer anderen Rechnung hat, das nicht von Hand geht,</li>
					<li>bei Gleichstand nach Wertquoten entschieden wird,</li>
					<li>oder an einer zweiten Versammlung neu ist.</li>
				</ul>
			</div>
		{:else}
		<p>Die Rechenhilfe für alles, was Handzählen nicht leisten kann:</p>
		<ul>
			<li>Wertquoten,</li>
			<li>Bezugsgrössen mit Abwesenden,</li>
			<li>ungleiche Kopfstimmen,</li>
			<li>andere Mehrheiten als mehr als die Hälfte,</li>
			<li>Enthaltungen ausserhalb der Bezugsgrösse,</li>
			<li>Betroffene, die nicht mitzählen, etwa bei Ausschlussklage oder Einsprache,</li>
			<li>das zweite Ergebnis nach einer anderen Rechnung,</li>
			<li>den Stichentscheid nach Wertquoten,</li>
			<li>die Beschlussfähigkeit für neue Traktanden einer zweiten Versammlung.</li>
		</ul>
		<p>Eingetragen wird 1 = Ja, 2 = Enthaltung, 3 = Nein.</p>
		{#if data.freigegeben}
			<a class="knopfartig" href="/versammlungen/{v.id}/auszaehlung.xlsx">Als Excel-Mappe laden</a>
		{:else}
			<p class="probe">Bereit, sobald die Versammlung freigegeben ist.</p>
		{/if}
		<!--
			**Der Satz steht hier, weil er hier gebraucht wird.** Die Mappe ist
			bisher nur maschinell gegengelesen worden, nicht in Excel geöffnet (siehe
			Kopf von `src/lib/domain/xlsx.ts`). Unabhängig davon gilt der Rat für
			jeden Ausweichplan: Was im Ernstfall laufen soll, probiert man vorher
			einmal aus — dann ist die Frage «öffnet das überhaupt?» schon
			beantwortet.
		-->
		<p class="probe">
			<strong>Einmal probehalber öffnen.</strong> Tragen Sie zwei, drei Stimmen ein und sehen Sie,
			ob unten «angenommen» oder «abgelehnt» erscheint. Im Ernstfall ist keine Zeit, das
			herauszufinden.
		</p>
		{/if}
	</article>
</section>

<details class="erklaerung lesebreite">
	<summary>Was heisst das im Saal?</summary>
	<p>
		<strong>Teilausfall — das Netz ist weg, der Server läuft.</strong> Dann bleibt die Anwendung Ihr
		Werkzeug: Die Telefone erreichen sie nicht mehr, aber Sie tragen die Stimmen selbst ein.
		Abgestimmt wird im Saal durch Handerheben, gerechnet wird hier.
	</p>
	<p>
		<strong>Totalausfall — der Rechner ist weg.</strong> Jetzt zählt nur, was auf Papier liegt. Beim
		einfachen Mehr genügt Handzählen; die Auszählmappe brauchen Sie dort, wo die Wertquote
		entscheidet. Der ganze Ablauf steht im Handbuch unter «Wenn der Server ausfällt».
	</p>
	<!--
		**Der Satz beschrieb einen Weg, den es hier nicht mehr braucht**
		(02.09.2026). Er stammte aus der Zeit, als die Unterschriftenliste nur in
		der Anwesenheitssicht stand — seit dem 23.08.2026 liegt sie oben auf
		dieser Seite, zwei Absätze darüber. Wer dem Satz folgte, verliess die
		Seite, auf der er schon war.
	-->
	<p>
		Die Unterschriftenliste oben trägt den Nachweis der Anwesenheit, nicht das System. Drucken Sie
		sie aus und legen Sie sie an den Eingang — im Totalausfall ist sie das Einzige, was von der
		Anwesenheit bleibt.
	</p>
</details>

<style>
	.unterzeile {
		color: var(--text-leise);
		margin-top: -0.5rem;
	}

	.unterlagen {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
		max-width: 74rem;
		margin: 1.5rem 0;
	}

	article {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	article p {
		margin: 0;
		color: var(--text-leise);
		flex: 1;
	}

	article a {
		align-self: flex-start;
	}

	.probe {
		margin: 0;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
		color: var(--text);
		font-size: 0.9rem;
		flex: none;
	}

	.probe p {
		color: var(--text);
	}

	.probe ul {
		margin: 0.25rem 0 0;
		padding-left: 1.25rem;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		max-width: 46rem;
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.erklaerung {
		margin-top: 1rem;
	}

	.erklaerung summary {
		cursor: pointer;
		font-weight: 550;
		padding: 0.4rem 0;
	}
</style>
