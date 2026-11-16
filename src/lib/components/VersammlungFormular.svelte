<script lang="ts">
	import { untrack } from 'svelte';
	import type { Betriebsart, Versammlungsart } from '$lib/domain/versammlung';
	import { fristvermerk, pruefeZehntagesfrist } from '$lib/domain/versammlung';
	import type { Versammlungsstufe } from '$lib/domain/beschlussfaehigkeit';
	import {
		abstimmungsweise,
		beschriftung,
		versammlungsart,
		versammlungsstufe
	} from '$lib/domain/klartext';
	import type { Beschlussfaehigkeitsregel } from '$lib/domain/beschlussfaehigkeit';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import { datumLang, istKalendertag } from '$lib/domain/datum';
	import Suchauswahl from './Suchauswahl.svelte';

	interface Vorgaengerin {
		id: string;
		datum: string;
		ort: string;
	}

	let {
		werte = {
			datum: '',
			uhrzeit: '19:00',
			ort: '',
			art: 'ordentlich' as Versammlungsart,
			stufe: 'erste' as Versammlungsstufe,
			betriebsart: 'einfach' as Betriebsart,
			anlass: '',
			vorgaengerId: ''
		},
		vorgaengerinnen = [] as Vorgaengerin[],
		/**
		 * Die Reglementsfrist zur zweiten Versammlung, falls eine hinterlegt ist
		 * (Migration 122). `null` heisst «nicht hinterlegt», dann gilt das Gesetz.
		 *
		 * Sie gehört hierher, weil dieses Formular den Fristbefund und den Vermerk
		 * **selbst** rechnet, damit beide beim Tippen mitwandern. Ohne sie zeigte
		 * die Vorschau die gesetzlichen zehn Tage, während der Server die längere
		 * Frist des Reglements schreibt — zwei Zahlen für dieselbe Regel, genau
		 * das, was Befund R-1 an sieben Stellen aufgeräumt hat.
		 */
		reglementsfrist = null as { tage: number | null; fundstelle: string | null } | null,
		anzahlParteien = 0,
		vorschlagBetriebsart = 'einfach' as Betriebsart,
		fehler = null as { nachricht: string; feld?: string } | null,
		beschriftungKnopf = 'Anlegen',
		abbrechenNach = '/versammlungen',
		aktion = '',
		/**
		 * Die drei Wahlblöcke nebeneinander statt untereinander.
		 *
		 * Beim **Anlegen** ist das Formular die Strecke: eine Frage nach der
		 * anderen, von oben nach unten, ohne Ablenkung. Beim **Nachbessern** ist
		 * es eine Übersicht — dort standen die drei Blöcke als 1400 Pixel hoher
		 * Turm, und wer die Betriebsart ändern wollte, sah sie erst nach zwei
		 * Bildschirmen.
		 */
		kompakt = false,
		/**
		 * Die Kennung des Formulars, wenn Felder ausserhalb davon dazugehören.
		 *
		 * Auf der Versammlungsseite liegen die Auswahl des gemeinsamen Abends und
		 * die Datei in Karten neben dem Formular. Über das HTML-Attribut `form`
		 * gehören sie trotzdem dazu — und die Seite kommt mit **einem**
		 * Speicherknopf aus (gewünscht am 11.08.2026).
		 */
		id = '',
		/** Ohne eigenen Knopf: Der Speicherknopf steht dann ausserhalb, am Seitenfuss. */
		mitKnopf = true,
		/**
		 * Die Anwesenheitsregeln aus dem Reglement, je Stufe.
		 *
		 * Fehlt eine, gilt für diese Stufe das Gesetz — den Satz dazu baut der
		 * Kern, nicht diese Datei.
		 */
		anwesenheitsregeln = {} as Partial<Record<Versammlungsstufe, Beschlussfaehigkeitsregel>>,
		/**
		 * Die gemeinsame Versammlung, die Tag, Ort, Art und Abstimmungsweise
		 * vorgibt — oder `null`, wenn diese Versammlung für sich steht.
		 *
		 * **Warum die Felder dann verschwinden** (Auftraggeber, 25.08.2026: «wenn die
		 * Gruppe mit Hart im Lead ist, sollte man in der Einzelveranstaltung
		 * keine Einstellungen machen können»). Ein Saal hat eine Zeit, einen
		 * Ort und eine Abstimmungsweise; zwei davon wären im Raum sichtbar
		 * Unsinn. Welche Angabe hart ist und welche der Gemeinschaft gehört,
		 * steht in `docs/vererbung-abend.md`.
		 *
		 * **Kein ausgegrautes Feld, sondern ein Satz mit Weg** — nach
		 * `docs/gestaltung.md`: Eine harte Angabe steht da, wo sie hingehört,
		 * aber ohne Knopf, mit dem Hinweis, woher sie kommt und wo man sie
		 * ändert. Ein gesperrtes Feld sagt nicht, wer es gesperrt hat.
		 */
		vomAbend = null as { bezeichnung: string; pfad: string } | null
	} = $props();

	const artText = {
		ordentlich: versammlungsart('ordentlich'),
		ausserordentlich: versammlungsart('ausserordentlich')
	};
	const stufeText = $derived({
		erste: versammlungsstufe('erste', anwesenheitsregeln?.erste),
		zweite: versammlungsstufe('zweite', anwesenheitsregeln?.zweite)
	});
	const abstimmText = { einfach: abstimmungsweise('einfach'), gefuehrt: abstimmungsweise('gefuehrt') };

	// Nur der Anfangswert: Sobald jemand tippt, gehört das Feld ihm. Nach einem
	// fachlichen Fehler lädt die Seite neu und bringt die Eingaben mit.
	let art = $state<Versammlungsart>(untrack(() => werte.art));
	let stufe = $state<Versammlungsstufe>(untrack(() => werte.stufe));
	let vorgaengerId = $state(untrack(() => werte.vorgaengerId ?? ''));
	let datum = $state(untrack(() => werte.datum));

	const vorgaengerin = $derived(vorgaengerinnen.find((v: Vorgaengerin) => v.id === vorgaengerId));

	/*
	 * **Der Fristbefund kommt aus dem Kern, nicht aus diesem Formular.**
	 *
	 * Hier standen bis zum 23.09.2026 drei eigene Rechnungen: eine eigene
	 * Tagesdifferenz, die Schwelle als `< 10` und ein eigener Wortlaut für die
	 * Meldung. Die Schwelle war damit ein zweiter Schreiber der Regel aus R-1,
	 * und die Meldung ein zweiter Wortlaut derselben Rechtsaussage, der bei der
	 * Prüfung der Texte gar nicht vorgelegen hat (Fachprüfung 23.09.2026,
	 * Befund 7). Jetzt steht die Rechtsaussage an einer Stelle, und was die
	 * Leserin unter dem Datumsfeld liest, ist derselbe Satz, den sie beim
	 * Speichern bekäme. **Mit einer Ausnahme**, und die ist gleich darunter
	 * beschrieben: Liegt die zweite Versammlung vor der ersten, antwortet der
	 * Kern mit einem eigenen Satz. Das Formular sagt dann nicht denselben
	 * Wortlaut, sondern einen eigenen mit demselben Inhalt und einem Zusatz, was
	 * zu tun ist. Der Kern exportiert seine Meldung nicht als Konstante; solange
	 * das so ist, sind es zwei Wortläufe derselben Aussage, und sie können
	 * auseinanderlaufen. Keine Zahl darin, deshalb hingenommen und hier
	 * vermerkt statt stillschweigend gebaut.
	 */
	const befund = $derived(
		stufe === 'zweite' && vorgaengerin && istKalendertag(datum)
			? pruefeZehntagesfrist(vorgaengerin.datum, datum, reglementsfrist?.tage)
			: null
	);
	/*
	 * **Der negative Abstand ist kein Fristverstoss, sondern ein Tippfehler**
	 * (Code-Review vom 23.09.2026, Befund 2).
	 *
	 * Liegt die zweite Versammlung **vor** der ersten, ist die Frist ebenfalls
	 * nicht eingehalten — die beiden Lagen brauchen trotzdem verschiedene Sätze.
	 * Der zu knappe Abstand ist eine Rechtsfolge und bekommt den Vermerk; das
	 * verdrehte Datum ist ein Tippfehler, und `pruefeVersammlung` weist es mit
	 * `vorgaenger_spaeter` ab. Diese Unterscheidung hielt schon das
	 * Begründungsfeld nicht durch, das bis zum 23.09.2026 unter beiden Lagen
	 * stand und bei der zweiten nichts rettete (Befund R-2b hat es entfernt).
	 */
	const vorgaengerSpaeter = $derived(befund !== null && befund.abstandTage < 0);
	// **Mit der Stufe**, wie `befund` zwei Zeilen darüber (Code-Review vom
	// 24.09.2026, Befund 7). Heute folgenlos, weil die Anzeige an `fristVerletzt`
	// hängt und das die Stufe über `befund` mitbringt. Wer diese Bedingung später
	// lockert, bekäme den Vermerk an einer Erstversammlung, die gar keine Frist
	// hat — eine Abhängigkeit, die man der Zeile nicht ansieht.
	const vermerk = $derived(
		stufe === 'zweite' && vorgaengerin
			? fristvermerk(vorgaengerin.datum, datum, reglementsfrist)
			: null
	);
	const fristVerletzt = $derived(
		befund !== null && !befund.eingehalten && !vorgaengerSpaeter
	);
</script>

<form {id} method="POST" action={aktion} class="formular" class:kompakt enctype="multipart/form-data">
	{#if fehler}
		<p class="fehler" role="alert">{fehler.nachricht}</p>
	{/if}

	<!--
		Datum, Beginn und Ort sind **eine** Frage: wann und wo. Sie standen in
		drei Zeilen untereinander und brauchten 290 Pixel; nebeneinander sind es
		90. Bricht die Zeile auf schmalem Gerät um, stehen sie wieder
		untereinander — dafür sorgt `flex-wrap`, nicht eine zweite Fassung.
	-->
	{#if vomAbend}
		<div class="vorgabe">
			<p class="wert">
				{datumLang(werte.datum)}, {werte.uhrzeit} Uhr · {werte.ort}
			</p>
			<p class="woher">
				Tag, Beginn und Ort kommen von <a href={vomAbend.pfad}>{vomAbend.bezeichnung}</a> —
				ein Saal hat einen Termin. Dort ändern gilt für alle Gemeinschaften des Abends.
			</p>
		</div>
	{:else}
		<div class="zeile">
			<label class="breit">
				Datum
				<input type="date" name="datum" bind:value={datum} required />
			</label>
			<label class="schmal">
				Beginn
				<input type="time" name="uhrzeit" {...anfangswert(werte.uhrzeit)} required />
			</label>
			<label class="weit">
				Ort
				<input name="ort" {...anfangswert(werte.ort)} required maxlength="200" autocomplete="off" />
				<span class="hilfe">So, wie er in der Einladung stehen soll.</span>
			</label>
		</div>
	{/if}

	<div class="wahlen" class:raster={kompakt}>
	<fieldset>
		<legend>{artText.ordentlich.frage}</legend>

		{#if vomAbend}
			<p class="wert">{artText[art].antwort}</p>
			{#if art === 'ausserordentlich' && werte.anlass}
				<p class="wert leise">{werte.anlass}</p>
			{/if}
			<p class="woher">
				Findet eine ordentliche Versammlung statt, kann nicht zugleich eine
				ausserordentliche stattfinden. Die Art kommt deshalb von
				<a href={vomAbend.pfad}>{vomAbend.bezeichnung}</a>.
			</p>
		{:else}
		<label class="wahl">
			<input type="radio" name="art" value="ordentlich" bind:group={art} />
			<span>
				<strong>{beschriftung(artText.ordentlich)}</strong>
				<span class="hilfe">{artText.ordentlich.zusatz}</span>
			</span>
		</label>

		<label class="wahl">
			<input type="radio" name="art" value="ausserordentlich" bind:group={art} />
			<span>
				<strong>{beschriftung(artText.ausserordentlich)}</strong>
				<span class="hilfe">{artText.ausserordentlich.zusatz}</span>
			</span>
		</label>

		{#if art === 'ausserordentlich'}
			<label class="eingerueckt">
				Welcher Anlass?
				<input
					name="anlass"
					{...anfangswert(werte.anlass ?? '')}
					required
					maxlength="300"
					placeholder="z. B. Wasserschaden in der Tiefgarage"
				/>
				<span class="hilfe">Er gehört in die Einladung und ins Protokoll.</span>
			</label>
		{/if}

		{/if}

		<details class="erklaerung">
			<summary>Was heisst das?</summary>
			<p><strong>{beschriftung(artText.ordentlich)}</strong> — {artText.ordentlich.erklaerung}</p>
			<p><strong>{beschriftung(artText.ausserordentlich)}</strong> —
				{artText.ausserordentlich.erklaerung}</p>
		</details>
	</fieldset>

	<fieldset>
		<legend>{stufeText.erste.frage}</legend>

		<label class="wahl">
			<input type="radio" name="stufe" value="erste" bind:group={stufe} />
			<span>
				<strong>{beschriftung(stufeText.erste)}</strong>
				<span class="hilfe">{stufeText.erste.zusatz}</span>
			</span>
		</label>

		<label class="wahl">
			<input
				type="radio"
				name="stufe"
				value="zweite"
				bind:group={stufe}
				disabled={vorgaengerinnen.length === 0}
			/>
			<span>
				<strong>{beschriftung(stufeText.zweite)}</strong>
				<span class="hilfe">
					{stufeText.zweite.zusatz}
					{#if vorgaengerinnen.length === 0}
						<strong>Es ist noch kein erstes Treffen erfasst.</strong>
					{/if}
				</span>
			</span>
		</label>

		{#if stufe === 'zweite'}
			<label class="eingerueckt">
				Welches war das erste Treffen?
				<Suchauswahl
					name="vorgaengerId"
					beschriftung="Welches war das erste Treffen?"
					leerText="— wählen —"
					pflicht
					bind:wert={vorgaengerId}
					eintraege={vorgaengerinnen.map((v) => ({
						wert: v.id,
						text: `${v.datum} · ${v.ort}`
					}))}
				/>
			</label>

			{#if vorgaengerSpaeter}
				<p class="frist verletzt">
					Die zweite Versammlung liegt vor der ersten. Prüfen Sie das Datum oder die
					Auswahl des ersten Treffens.
				</p>
			{:else if befund}
				<p class="frist" class:verletzt={fristVerletzt}>{befund.hinweis}</p>
			{/if}

			<!--
				**Kein Begründungsfeld mehr** (Befund R-2b, Produktentscheid vom
				23.09.2026). Hier stand bis dahin «Warum ist der Abstand kürzer?» als
				Pflichtfeld, und sobald etwas darin stand, war die Frist erledigt. Ein
				Pflichtfeld sieht aber aus wie ein vorgesehener Weg, und den gibt es
				nicht. An seine Stelle tritt der Vermerk, den die Empfänger zu sehen
				bekommen — hier nur als Vorschau, damit niemand erst am fertigen PDF
				merkt, was er gerade auslöst.
			-->
			{#if fristVerletzt && vermerk}
				<p class="vermerk">
					<strong>Das steht dann in Einladung und Protokoll:</strong>
					{vermerk}
				</p>
			{/if}
		{/if}

		<details class="erklaerung">
			<summary>Was heisst das?</summary>
			<p><strong>{beschriftung(stufeText.erste)}</strong> — {stufeText.erste
					.erklaerung}</p>
			<p><strong>{beschriftung(stufeText.zweite)}</strong> — {stufeText.zweite
					.erklaerung}</p>
		</details>
	</fieldset>

	<fieldset>
		<legend>{abstimmText.einfach.frage}</legend>

		{#if vomAbend}
			<p class="wert">{abstimmText[werte.betriebsart === 'einfach' ? 'einfach' : 'gefuehrt'].antwort}</p>
			<p class="woher">
				Im Saal wird einheitlich gezählt — Einlass, Tafel und Stimmerfassung folgen dieser
				Wahl. Sie kommt von <a href={vomAbend.pfad}>{vomAbend.bezeichnung}</a>.
			</p>
		{:else}
		<p class="hilfe hinweis">
			{anzahlParteien}
			{anzahlParteien === 1 ? 'Partei' : 'Parteien'} mit Einheiten — vorgeschlagen ist deshalb
			<strong>{abstimmText[vorschlagBetriebsart === 'gefuehrt' ? 'gefuehrt' : 'einfach'].kurz}</strong
			>.
		</p>

		<!--
			**Der Anfangswert über `angekreuzt()`** — hier ist der Fehler aufgefallen,
			der zu `$lib/felder` geführt hat.

			`defaultChecked` erscheint beim serverseitigen Rendern **nicht** im HTML:
			Nachgemessen am 11.08.2026 kamen diese beiden Radios ohne `checked`
			heraus, während `art` und `stufe` daneben eines hatten. Ohne JavaScript
			war gar keine Abstimmungsweise gewählt, und wer klickte, bevor die Seite
			fertig geladen hatte, verlor seine Wahl an die Hydration, die 47 ms nach
			dem Laden den alten Wert setzte. Gespeichert wurde dann stillschweigend
			«geführt» — ohne Meldung, ohne Spur.
		-->
		<label class="wahl">
			<input
				type="radio"
				name="betriebsart"
				value="einfach"
				{...angekreuzt(werte.betriebsart === 'einfach')}
			/>
			<span>
				<strong>{beschriftung(abstimmText.einfach)}</strong>
				<span class="hilfe">{abstimmText.einfach.zusatz}</span>
			</span>
		</label>

		<label class="wahl">
			<input
				type="radio"
				name="betriebsart"
				value="gefuehrt"
				{...angekreuzt(werte.betriebsart === 'gefuehrt')}
			/>
			<span>
				<strong>{beschriftung(abstimmText.gefuehrt)}</strong>
				<span class="hilfe">{abstimmText.gefuehrt.zusatz}</span>
			</span>
		</label>

		{/if}

		<details class="erklaerung">
			<summary>Was heisst das?</summary>
			<p><strong>{beschriftung(abstimmText.einfach)}</strong> — {abstimmText
					.einfach.erklaerung}</p>
			<p><strong>{beschriftung(abstimmText.gefuehrt)}</strong> — {abstimmText
					.gefuehrt.erklaerung}</p>
			<p>Die Wahl lässt sich bis zur Eröffnung ändern, danach nicht mehr.</p>
		</details>
	</fieldset>
	</div>

	{#if mitKnopf}
		<div class="knoepfe">
			<button type="submit">{beschriftungKnopf}</button>
			<a href={abbrechenNach}>Abbrechen</a>
		</div>
	{/if}
</form>

<style>
	/*
	 * **Eine harte Angabe des Abends: der Wert gross, darunter woher er kommt.**
	 *
	 * Nach `docs/gestaltung.md` — kein ausgegrautes Feld: Das sagt nicht, wer es
	 * gesperrt hat, und lädt zum Klicken ein, das nichts tut. Der Satz nennt die
	 * Stelle und verlinkt sie.
	 */
	.vorgabe {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.wert {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 550;
	}

	.wert.leise {
		font-size: 0.95rem;
		font-weight: 400;
		color: var(--text-leise);
	}

	.woher {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-leise);
		max-width: var(--lesebreite);
	}

	.formular {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-width: 42rem;
		margin-top: 1.5rem;
	}

	/*
	 * Beim Nachbessern darf das Formular die Bahn nutzen; beim Anlegen nicht.
	 *
	 * 42rem ist die Lesebreite einer Strecke, die man von oben nach unten
	 * durchgeht. Wer dagegen einen einzelnen Wert korrigiert, sucht ihn — und
	 * fand ihn bisher erst nach zwei Bildschirmen.
	 */
	.formular.kompakt {
		max-width: none;
		margin-top: 0.5rem;
		gap: 0.75rem;
	}

	/*
	 * Ein Feld ist so breit wie sein Inhalt lang ist, nicht so breit wie die
	 * Bahn. «test» als Ort in einem 1100 Pixel breiten Kasten sieht aus, als
	 * fehle etwas — und die Zeile darüber und darunter fluchten mit nichts.
	 */
	.formular.kompakt > .zeile {
		max-width: 42rem;
	}

	.wahlen {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/*
	 * Die drei Wahlblöcke nebeneinander, gleich hoch.
	 *
	 * `stretch` ist bei Rasterzellen die Voreinstellung — genannt sei es
	 * trotzdem, denn die Höhe ist hier der Zweck: Untereinander ergaben die drei
	 * Blöcke 900 Pixel, nebeneinander 300, und die Erklärung sitzt bei allen
	 * dreien auf derselben Linie.
	 */
	.wahlen.raster {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
		gap: 0.75rem;
		align-items: stretch;
	}

	/*
	 * Der Hintergrund, zugeklappt — dieselbe Bauart wie in `Karte.svelte`.
	 *
	 * Die Rechtsgrundlage verschwindet nicht, sie wartet. Sichtbar bleibt der
	 * Satz, der die Wahl entscheidet; wer wissen will, warum, klappt auf.
	 */
	.erklaerung {
		margin-top: auto;
		padding-top: 0.5rem;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.erklaerung summary {
		cursor: pointer;
		color: var(--akzent);
	}

	.erklaerung p {
		margin: 0.4rem 0 0;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 550;
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	input:not([type='radio']):not([type='checkbox']),
	.formular :global(select),
	.formular :global(.auswahlsuche) {
		min-height: var(--ziel-min);
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	.hilfe {
		font-weight: 400;
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.zeile {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.zeile .breit {
		flex: 2 1 12rem;
	}

	.zeile .schmal {
		flex: 1 1 7rem;
	}

	/* Der Ort ist das längste der drei und bekommt den meisten Raum. */
	.zeile .weit {
		flex: 3 1 16rem;
	}

	fieldset {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	legend {
		font-weight: 550;
		padding: 0 0.35rem;
	}

	.wahl {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.6rem;
		font-weight: 400;
		min-height: var(--ziel-min);
	}

	.wahl > span {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.eingerueckt {
		margin-left: 1.6rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--linie);
	}

	.hinweis {
		margin: 0;
		padding: 0.6rem 0.75rem;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}

	.frist {
		margin: 0 0 0 1.6rem;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	.frist.verletzt {
		color: var(--fehler);
		font-weight: 550;
	}

	/*
	 * Der Vermerk ist keine Fehlermeldung: Er hält niemanden auf, und rot
	 * gesetzt läse er sich wie ein Riegel, hinter dem es nicht weitergeht.
	 * Abgesetzt statt eingefärbt — er soll gelesen, nicht weggeklickt werden.
	 */
	.vermerk {
		margin: 0.4rem 0 0 1.6rem;
		padding: 0.6rem 0.8rem;
		border-left: 3px solid var(--fehler);
		border-radius: var(--radius);
		background: var(--flaeche-2);
		font-size: 0.9rem;
		line-height: 1.45;
	}

	input[type='radio'] {
		margin-top: 0.2rem;
		width: 1.1rem;
		height: 1.1rem;
		min-height: 0;
		flex: none;
	}

	.knoepfe {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	.fehler {
		margin: 0;
		padding: 0.75rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}
</style>
