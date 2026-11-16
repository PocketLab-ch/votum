<script lang="ts">
	import { enhance } from '$app/forms';
	import { nachziehen, type Nachzug } from '$lib/nachziehen';
	import { datumLang } from '$lib/domain/datum';
	import { angekreuzt } from '$lib/felder';

	let { data, form } = $props();

	/**
	 * Das Kästchen sendet beim Umschalten ab — und der Knopf bleibt.
	 *
	 * **Warum beides.** Ohne JavaScript geschieht beim Umschalten nichts; ein
	 * Kästchen, das dann stumm zurückspringt, sähe aus wie ein Defekt. Der Knopf
	 * ist der Weg, der immer trägt, und mit JavaScript ist er nur noch die
	 * Bestätigung dessen, was schon unterwegs ist.
	 */
	let vermerkform: HTMLFormElement | undefined = $state();

	/*
	 * **Nachziehen statt `invalidateAll()` direkt** — der Wächter `check:stroeme`
	 * verlangt es, und aus gutem Grund: Ein Abruf, den der nächste
	 * Formularversand abreisst, hinterlässt «Failed to fetch» in der Konsole und
	 * lässt einen Browserdurchlauf scheitern, in dem alle Schritte grün waren.
	 *
	 * **Und der Aufruf gehört in den Effekt, nicht daneben** (02.09.2026):
	 * `nachziehen()` hängt sich an `window`, und beim Rendern auf dem Server gibt
	 * es das nicht — die Seite antwortete mit 500. Der Prüflauf war dabei grün;
	 * gefunden hat es erst der Browserdurchlauf.
	 */
	let nach: Nachzug | undefined = $state();
	$effect(() => {
		const n = nachziehen();
		nach = n;
		return () => {
			n.ende();
			nach = undefined;
		};
	});

	const v = $derived(data.versammlung);

	/**
	 * Ein gesperrter Schritt ist kein Link.
	 *
	 * Er bleibt sichtbar und nennt seinen Grund — aber anklickbar zu sein und
	 * dann nichts zu tun, wäre schlimmer als grau: Wer klickt und nichts
	 * geschieht, hält es für einen Fehler.
	 */
	function anklickbar(zustand: string): boolean {
		return zustand !== 'gesperrt';
	}
</script>


<h1>Vorbereitung</h1>

<p class="stand">
	<span class="balken" style:--anteil="{data.fortschritt.anteil}%"></span>
	<!--
		**«jetzt möglichen»** (07.09.2026, Befund 34 der Bedienbarkeitsprüfung, hier
		nachgezogen). `vorbereitungsfortschritt` zählt nur, was **nicht gesperrt**
		ist; die Bezugsgrösse wächst also, sobald ein Schritt aufgeht, und die Zahl
		sprang «6 von 7» auf «9 von 14». `82c00cf` hat das Wort in der
		Seitenleiste ergänzt und diese Seite übersehen — dabei steht die Zahl hier
		am grössten.
	-->
	{data.fortschritt.erledigt} von {data.fortschritt.moeglich} jetzt möglichen Schritten erledigt
</p>

<ol class="schritte">
	{#each data.schritte as s (s.kennung)}
		<li class="schritt {s.zustand}">
			<span class="zeichen" aria-hidden="true">
				{#if s.zustand === 'erledigt'}✓{:else if s.zustand === 'gesperrt'}·{:else}○{/if}
			</span>
			<div class="inhalt">
				<p class="titel">
					{#if anklickbar(s.zustand)}
						<a href={s.pfad}>{s.titel}</a>
					{:else}
						<span>{s.titel}</span>
					{/if}
					<span class="zustandsmarke">
						{s.zustand === 'erledigt' ? 'erledigt' : s.zustand === 'gesperrt' ? 'gesperrt' : 'offen'}
					</span>
				</p>
				<p class="beschreibung">{s.beschreibung}</p>
				<!--
					**Die Warnung steht immer, auch bei einem gesperrten Schritt**
					(01.09.2026). Sie war bis hierher nur in der Seitenleiste zu sehen:
					Der Kern setzt sie seit Langem, diese Seite kannte das Feld nicht.
					Ausgerechnet die vollständige Liste zeigte damit weniger als die
					Leiste daneben — und die abgelaufene Einberufungsfrist stünde
					nirgends, wo man sie sucht.
				-->
				{#if s.warnung}
					<p class="schrittwarnung">{s.warnung}</p>
				{/if}
				<!--
					**Der Stand steht neben dem Sperrgrund, nicht dahinter**
					(02.09.2026, aus dem Code-Review). Beide standen in einem
					`{:else if}`, und damit verschluckte der Sperrgrund den Stand —
					dieselbe Klasse wie eine Zeile darüber, nur einen Tag später.

					Betroffen war genau eine Zeile, und ausgerechnet die dringlichste:
					Die Fristansage «Heute ist der letzte Tag, an dem die Einladung
					hinausgehen darf» (damaliger Wortlaut; heute «… bei allen sein soll»)
					hängt am Schritt «Einladung erzeugen», und der
					ist im Entwurf gesperrt. Sichtbar wurde sie erst nach der
					Freigabe, also nachdem die Einladung längst draussen sein müsste.
					Am laufenden System gemessen: null Treffer auf der ganzen Seite,
					bei einer Versammlung, deren Frist heute abläuft.

					Gemessen an einer frischen Versammlung im Entwurf: neun Schritte
					gesperrt, davon tragen zwei einen Stand — dieser hier und
					«Protokoll wird am Abend geführt» beim gemeinsamen Abend. Der
					zweite bleibt: Er beantwortet «was ist hier zu tun?» mit «nichts»,
					und das hilft auch im Entwurf.

					Die Zahl ist eine Momentaufnahme, keine Obergrenze: «Ausfallsicherung
					holen» bekommt seinen Stand, sobald eine Unterlage geholt ist, und
					das ist im Entwurf möglich. Zwei Sätze an einem Schritt sind aber
					kein Lärm, sondern die vollständige Auskunft — genau dafür ist
					diese Seite da.

					Ein dritter fiel beim Messen auf und ist weg: «keine erfasst» bei
					den Vollmachten war vor der Freigabe keine Auskunft, sondern die
					Definition.
				-->
				{#if s.sperrgrund}
					<p class="sperrgrund">{s.sperrgrund}</p>
				{/if}
				{#if s.stand}
					<p class="schrittstand">{s.stand}</p>
				{/if}
			</div>
		</li>
	{/each}
</ol>

<!--
	**Der Vermerk steht unter der Liste, nicht im Schritt** (02.09.2026). Er sagt
	nichts über den Schritt «Einladung erzeugen» — dort entsteht ein PDF, und das
	entsteht dadurch nicht. Er sagt etwas über die Wirklichkeit daneben: dass die
	Eigentümer eingeladen sind, auf welchem Weg auch immer. Deshalb wirkt er auf
	die Fristwarnung und auf die Erinnerungsmail. Vom 06.10.2026 bis 07.10.2026
	wirkte er auch auf das Mehr nach einer Milderung: Ohne rechtzeitigen Vermerk
	nach der Milderung nahm die Anwendung beim Eröffnen wieder das Mehr der ersten
	Einladung (Produktentscheid «Erste Einladung gilt»). Seit dem Produktentscheid
	07.10.2026 («Nur noch aufmerksam machen») nimmt er nach einer Milderung nur
	den Hinweis darüber weg; das Mehr bleibt (`einladungsmehr.ts`).
-->
<!--
	**Der Hinweis zur berichtigten Einladung steht über dem Vermerk** (Produktentscheid
	06.10.2026): Wird das Mehr nach der Freigabe milder, fällt der Vermerk zurück,
	und erst ein neuer Vermerk nimmt den Hinweis weg. Beides gehört deshalb
	nebeneinander.
-->
{#if data.neuversand}
	<p class="neuversand" role="status">{data.neuversand}</p>
{/if}

<form
	method="POST"
	action="?/versandVermerken"
	class="vermerk"
	bind:this={vermerkform}
	use:enhance={() =>
		async ({ result, update }) => {
			/*
			 * **Nach einer Absage muss das Kästchen zurückspringen** (Code-Review
			 * 02.09.2026, zweite Runde). Sonst bliebe es in der angeklickten
			 * Stellung stehen, während die Fehlerzeile darunter sagt, dass nichts
			 * geschehen ist — zwei Aussagen über denselben Zustand, und die
			 * sichtbarere ist die falsche.
			 *
			 * **`update()` allein tut das nicht**, nachgelesen in SvelteKit: Es
			 * ruft `form.reset()` nur bei `type === 'success'`. Und `invalidateAll`
			 * hilft hier nicht, weil `angekreuzt()` im Browser `defaultChecked`
			 * setzt — neue Daten ändern den Vorgabewert, nicht die Stellung, die
			 * der Benutzer angefasst hat. Genau dafür ist `reset()` da: Es setzt
			 * das Feld auf eben diesen Vorgabewert zurück.
			 */
			await update();
			if (result.type === 'failure') {
				vermerkform?.reset();
				nach?.jetzt();
			}
		}}
>
	<label>
		<!--
			`angekreuzt` statt `checked`: Ein `checked={…}` schriebe den Zustand bei
			jedem Neuzeichnen zurück und verwürfe, was der Benutzer gerade angeklickt
			hat. Der Wächter `versammlung/anfangswert` hat genau das hier gefunden.

			**Das Kästchen schickt seinen eigenen Zustand** (02.09.2026, aus dem
			Code-Review). Davor stand darüber ein
			`<input type="hidden" name="gesetzt" value={data.vermerk.gesetzt ? 'false' : 'true'} />`
			— ein Umschalten, eingefroren im Augenblick des Renderns. Der Server
			begründet ausdrücklich das Gegenteil («Das Kästchen sagt, was es sein
			soll»), weil ein Umschalten sich verrechnet, sobald zwei Leute
			gleichzeitig klicken.

			Es verrechnete sich schlimmer als gedacht. `nachziehen()` frischt die
			Daten auch dann auf, wenn dieser Benutzer nichts tut. Setzt jemand
			anderes den Vermerk, wandert `data.vermerk.gesetzt` auf `true` und das
			versteckte Feld auf `false` — die Stellung des Kästchens bleibt, weil
			`angekreuzt()` nur `defaultChecked` schreibt. Wer dann das leer
			aussehende Kästchen ankreuzt, schickt `false` und **nimmt** den Vermerk
			heraus, statt ihn zu setzen. Die Handlung tut das Gegenteil dessen, was
			auf dem Bildschirm steht.

			Ein unangekreuztes Kästchen schickt nichts, und `get()` gibt dann `null`
			— das ist die Aussage «false». Ein Gegenstück braucht es dafür nicht.
		-->
		<input
			type="checkbox"
			name="gesetzt"
			value="true"
			{...angekreuzt(data.vermerk.gesetzt)}
			onchange={() => vermerkform?.requestSubmit()}
		/>
		<span>
			<!--
				**«verschickt»** (Produktentscheid 07.10.2026, «Nur noch aufmerksam
				machen»: «Versand ist auch okay, aber es gibt keine Garantie»). Der Haken
				ist eine Angabe der Sitzungsleitung, kein Nachweis des Empfangs; daneben
				steht, bei wem der rechtzeitige Empfang liegt. Bis 07.10.2026 hiess er
				«Die Einladung ist bei allen angekommen» (Produktentscheid 06.10.2026, auf
				Fachprüfung Runde 1, Auftrag Hinweise lesbar), davor «… ist
				hinausgegangen».
			-->
			<strong>Die Einladung ist verschickt</strong>
			<span class="klein">
				Setzen Sie den Haken, sobald die Einladung verschickt ist, vor allem, wenn Sie sie
				ausserhalb der Anwendung geschrieben haben. Er schaltet die Fristwarnung und die
				Erinnerungsmail ab. Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.
				{#if !data.einberufungsfristErfasst}
					<!-- Produktentscheid 06.10.2026, «Hinweis, zehn Tage zu erfassen»: ein Rat, kein
					     Vorgabewert. Seit dem Auftrag «Hinweise lesbar» (06.10.2026) nur, wo keine
					     Frist erfasst ist, unabhängig von einer Milderung. -->
					Nennt Ihr Reglement keine Einberufungsfrist, erfassen Sie unter «Reglement und Quoren»
					mindestens zehn Tage; dann prüft die Anwendung den letzten Tag und erinnert daran.
				{/if}
			</span>
			<!--
				**Der Normalfall zuerst, die Milderung abgesetzt** (Laienprüfung Restpunkte
				Runde 1, B3, 06.10.2026): Wer nur einladen will, liest den ersten Teil und
				darf dort aufhören. Der zweite Teil beginnt mit seiner Bedingung, damit
				erkennbar ist, dass er sonst nicht gilt. Zwei Elemente statt `<br>`: Das
				Label darf nur Phrasing-Inhalt tragen, ein `span` mit `display: block` ist
				zulässig und bekommt seinen Abstand über `.milderung`. Die Probe
				`tests/domain/hakentext.test.ts` liest beide. Im zweiten Teil stehen die
				bisherigen Sätze; das wiederholte «nach einer Milderung» trägt jetzt die
				Bedingung am Anfang, der Satz zur Erinnerungsmail ist in zwei geteilt.
			-->
			<span class="klein milderung">
				<!--
					**Neu gefasst nach dem Produktentscheid 07.10.2026, «Nur noch aufmerksam
					machen».** Bis 07.10.2026 stand hier, der Haken schalte die
					Erinnerungsmail erst ab, wenn er nach der Milderung und spätestens am
					letzten Fristtag gesetzt sei, und ohne ihn nehme die Anwendung beim
					Eröffnen wieder das Mehr der bisherigen Einladung (`neuversandGilt`).
					Seither zählt jeder Haken nach der Milderung (`neuversandVermerkt`), und
					das mildere Mehr bleibt auch ohne ihn. Eine Milderung nimmt den Haken
					weiterhin zurück (`achteEinladungsmehr`); ein gesetzter Haken ist danach
					also immer einer nach der Milderung.

					**Ein Satz, der in jeder Lage stimmt** (Produktentscheid 06.10.2026, «Ein
					Satz für alle Lagen», gilt weiter): Was von der Frist abhängt, sagt nur
					der Hinweis darüber (`neuversandHinweis`, je Zweig geprüft). Nach dem
					Rückweg sagte kein Text mehr, wann der Haken zu setzen ist (Laien Runde 2,
					B; Code Runde 3, N3); der Satz dazu gilt nur, wenn kein Hinweis mehr
					darüber steht, und sagt dasselbe wie der Rückweg in allen drei Zweigen von
					`neuversandHinweis`.
				-->
				<!-- Laienprüfung Runde 1, Punkte 1 und 3, 07.10.2026: was der Haken wegnimmt und
				     dass die Warnung im Saal am Mehr hängt, nicht am Haken. Satz zur Verantwortung
				     oben (`VERANTWORTUNG` in `einberufungsfrist.ts`, Punkt 10); bis dahin «…
				     liegt bei der Sitzungsleitung». -->
				Nur nach einer Milderung des Mehrs: Die Anwendung nimmt den Haken dann zurück, und
				darüber steht ein Hinweis. Setzen Sie ihn neu, sobald die berichtigte Einladung verschickt
				ist. Der Haken nimmt nur diesen Hinweis und die Erinnerungsmail weg; die Warnung im Saal steht trotzdem, solange das
				Mehr dort milder ist als in der Einladung vor der Milderung. Die Anwendung nimmt das
				mildere Mehr auch ohne Haken; sie macht nur aufmerksam. Haben Sie das Mehr zurückgestellt und steht über dem Haken
				kein Hinweis mehr, setzen Sie ihn, sobald die bisherige Einladung verschickt ist. Entfernen
				Sie den Haken, ändert das am Mehr nichts.
			</span>
		</span>
	</label>
	{#if data.vermerk.gesetzt && data.vermerk.wann}
		<p class="klein vermerkstand">
			Vermerkt am {datumLang(data.vermerk.wann)}{data.vermerk.wer ? `, ${data.vermerk.wer}` : ''}.
		</p>
	{/if}
	<!--
		**Der Knopf speichert, was das Kästchen zeigt** (02.09.2026, aus dem
		Code-Review). Er hiess «Vermerk entfernen», solange ein verstecktes Feld
		das Gegenteil des Bestandes schickte — mit dem Kästchen als Absender wäre
		daraus ein Knopf geworden, der den Vermerk **setzt** und dabei «entfernen»
		auf sich stehen hat. Ohne JavaScript ist er der einzige Absendeweg.

		Wer entfernen will, nimmt den Haken weg und speichert; mit JavaScript
		genügt der Haken allein, dann ist der Knopf Beiwerk.
	-->
	<button type="submit">Speichern</button>
	{#if form?.fehler}
		<p class="klein vermerkstand">{form.fehler.nachricht}</p>
	{/if}
</form>

<p class="fussnote">
	Die Reihenfolge ist die übliche, keine Vorschrift. Gesperrt ist nur, was sachlich noch nicht geht —
	alles andere lässt sich in beliebiger Folge bearbeiten.
</p>

<style>
	.neuversand {
		margin: 1.5rem 0 0;
		padding: 0.8rem 1rem;
		max-width: 46rem;
		border: 1px solid var(--warnung);
		border-radius: var(--radius);
		background: var(--flaeche-hinweis);
		color: var(--text);
		/* Der Hinweis ohne erfasste Frist gliedert seine zwei Wege mit
		   Zeilenumbrüchen (`neuversandHinweis`, Auftrag «Hinweise lesbar»,
		   06.10.2026). */
		white-space: pre-line;
	}

	/*
	 * `max-width` wie Schrittliste und Hinweis darüber (UI-Durchgang
	 * 06.10.2026): Der Kasten lief bei 1440 px über die ganze Bahn, 1120 px
	 * breit neben 736 px Schrittliste.
	 */
	.vermerk {
		max-width: 46rem;
		margin: 1.5rem 0 0;
		padding: 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
	}

	.vermerk label {
		display: flex;
		align-items: start;
		gap: 0.6rem;
	}

	.vermerk label > span {
		display: block;
	}

	.vermerk .klein {
		display: block;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	/* Der Teil nur nach einer Milderung, abgesetzt vom Normalfall (06.10.2026). */
	.vermerk .milderung {
		margin-top: 0.5rem;
	}

	/*
		Nicht `.stand`: Diese Seite hat weiter oben schon eine Regel dafür (der
		Fortschrittskopf, `display: grid`), und die schlug hier durch — gefunden
		im Code-Review vom 02.09.2026.
	*/
	.vermerk .vermerkstand {
		margin: 0.5rem 0 0;
	}

	.vermerk button {
		margin-top: 0.8rem;
	}


	.stand {
		display: grid;
		gap: 0.4rem;
		max-width: 46rem;
		color: var(--text-leise);
		font-variant-numeric: tabular-nums;
	}

	.balken {
		height: 5px;
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

	.schritte {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0 0;
		max-width: 46rem;
	}

	.schritt {
		display: flex;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		margin: 0.5rem 0;
		border: 1px solid var(--linie);
		border-left: 4px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	.schritt.erledigt {
		border-left-color: var(--akzent);
	}

	.schritt.gesperrt {
		opacity: 0.62;
	}

	.zeichen {
		flex: 0 0 1.5rem;
		text-align: center;
		font-size: 1.1rem;
		line-height: 1.5;
		color: var(--text-leise);
	}

	.schritt.erledigt .zeichen {
		color: var(--akzent);
	}

	.inhalt {
		flex: 1;
		min-width: 0;
	}

	.titel {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		font-weight: 600;
	}

	.zustandsmarke {
		font-weight: 400;
		font-size: 0.78rem;
		color: var(--text-leise);
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: var(--flaeche-2);
	}

	.beschreibung {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	.sperrgrund,
	.schrittstand,
	.schrittwarnung {
		margin: 0.35rem 0 0;
		font-size: 0.87rem;
	}

	/* Der Grund, warum jemand hinsehen soll — in der Farbe, die das überall sagt. */
	.schrittwarnung {
		color: var(--warnung);
	}

	.sperrgrund {
		color: var(--text-leise);
		font-style: italic;
	}

	.fussnote {
		margin-top: 1.5rem;
		max-width: 46rem;
		font-size: 0.87rem;
		color: var(--text-leise);
	}
</style>
