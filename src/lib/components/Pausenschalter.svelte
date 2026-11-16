<script lang="ts">
	/**
	 * Der Schalter für die Unterbrechung.
	 *
	 * **Der Anlass** (Auftraggeber, 21.08.2026): «Für die Pause braucht es einen eigenen
	 * Knopf bei der Steuerung. […] Der Pausenschalter könnte so sein, dass wenn
	 * aktiv den Inhalt übernimmt und auf der Präsi-Ansicht überlagert bis der
	 * Schalter aus ist.»
	 *
	 * **Warum nicht das Wandbild «Eigener Text».** Das gab es schon — es greift
	 * aber nur, solange kein Traktandum aufgerufen und keine Abstimmung offen
	 * ist. Wer in der Pause etwas anschreiben will, hat in aller Regel ein
	 * Traktandum aufgerufen; der Text erschien nie, und die Meldung daneben
	 * verlangte, erst den Aufruf zurückzunehmen. Also: die Sitzung verlassen, um
	 * eine Pause anzukündigen.
	 *
	 * Die Pause ist deshalb eine Schicht über allem — auch über einer laufenden
	 * Abstimmung, «wenn diese bspw. ungeplant ist (notfall, störung oder so)».
	 *
	 * **Ohne Rückfrage, in beide Richtungen.** Unterbrechen ist umkehrbar und
	 * verliert nichts: Der Durchgang bleibt offen, die Stimmen bleiben stehen.
	 * Eine Rückfrage kostete im Notfall genau die Sekunden, für die es diesen
	 * Knopf gibt.
	 */
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { anfangswert } from '$lib/felder';

	interface Eigenschaften {
		/** Seit wann unterbrochen wird — `null` heisst: läuft. */
		pause: { seit: string; text?: string | null } | null;
		/** Ob gerade eine Abstimmung offen ist — dann sagt der Knopf es dazu. */
		abstimmungOffen?: boolean;
	}

	let { pause, abstimmungOffen = false }: Eigenschaften = $props();

	/**
	 * Ein Vorschlag für den Wortlaut: die Uhrzeit in zwanzig Minuten.
	 *
	 * Nicht vorausgefüllt, sondern als Platzhalter — wer nichts schreibt, bekommt
	 * «Pause» an die Wand, und das genügt. Eine Pflichtangabe hielte im Notfall
	 * auf.
	 */
	const vorschlag = $derived.by(() => {
		const t = new Date(Date.now() + 20 * 60 * 1000);
		return `Weiter um ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
	});

	function seitWann(zeitpunkt: string): string {
		const min = Math.max(0, Math.round((Date.now() - new Date(zeitpunkt).getTime()) / 60000));
		return min < 1 ? 'seit eben' : min === 1 ? 'seit einer Minute' : `seit ${min} Minuten`;
	}
</script>

<section class="pausenschalter" class:laeuft={!!pause}>
	{#if pause}
		<div class="lage">
			<h2>Unterbrochen</h2>
			<p class="klein">
				{seitWann(pause.seit)}{#if pause.text} · an der Wand steht «{pause.text}»{/if}
			</p>
			<p class="klein">
				Es kann nicht abgestimmt werden. Eine offene Abstimmung bleibt offen — die abgegebenen
				Stimmen bleiben stehen.
			</p>
		</div>
		<form method="POST" action="?/pause" use:enhance={absenden()}>
			<input type="hidden" name="an" value="nein" />
			<button type="submit" class="haupt" data-fokus="pause:schalter">Fortfahren</button>
		</form>
	{:else}
		<form method="POST" action="?/pause" class="anschalten" use:enhance={absenden()}>
			<input type="hidden" name="an" value="ja" />
			<!--
				**Die Beschriftung folgt dem Knopf** (Bedienbarkeitsprüfung
				05.09.2026, Befund 24): «‹Pause — was an der Wand stehen soll› neben
				einem Knopf, der ‹Abstimmung unterbrechen› heisst.» Der Knopf
				unterscheidet die beiden Lagen seit je, das Feld daneben nicht.

				**Und sie nennt die Handlung, nicht nur die Wand** (Code-Review
				06.09.2026): Ein blosses «Was an der Wand stehen soll» stünde auf
				derselben Seite neben dem Kasten `Wandbild` mit der Überschrift «Was
				an der Wand steht» — zwei Wandtextfelder, um ein Wort verschieden,
				und ausgerechnet das mit der stärkeren Wirkung ohne eigenen Namen.
			-->
			<!--
				**Der Knopf steht vorn, der Text klappt auf** (Auftraggeber, 11.09.2026: «Kann
				man Text für die Pause einklappbar machen? Das spart etwas Platz in der
				Ansicht.»).

				Vorher nahm das Feld eine ganze Zeile der Sitzungsleitungssicht ein,
				für eine Angabe, die freiwillig ist: Wer nichts schreibt, bekommt
				«Pause» an die Wand, und das genügt. Zugeklappt bleibt der Kasten eine
				Zeile hoch.

				**Der Knopf bleibt sichtbar und steht jetzt zuerst.** Für ihn gilt
				derselbe Satz wie gegen die Rückfrage weiter oben: Im Notfall zählen
				die Sekunden. Ihn mit einzuklappen hiesse, die Pause hinter einen Klick
				zu legen, den man erst suchen muss.

				**Das Feld wird trotzdem mitgeschickt.** Ein zugeklapptes `<details>`
				nimmt seinen Inhalt nicht aus dem Formular; wer den Text schreibt und
				wieder zuklappt, schickt ihn dennoch ab.
			-->
			<button type="submit" data-fokus="pause:schalter">
				{abstimmungOffen ? 'Abstimmung unterbrechen' : 'Pause'}
			</button>
			<details class="wandtext">
				<summary>{abstimmungOffen ? 'Text für die Unterbrechung' : 'Text für die Pause'}</summary>
				<label>
					<span class="nurLeser">
						{abstimmungOffen ? 'Text für die Unterbrechung' : 'Text für die Pause'}
					</span>
					<input name="pausentext" placeholder={vorschlag} maxlength="200" autocomplete="off" {...anfangswert('')} />
				</label>
			</details>
			{#if abstimmungOffen}
				<p class="klein">
					Die offene Abstimmung wird nicht geschlossen; es kann nur niemand mehr abstimmen,
					bis Sie fortfahren.
				</p>
			{/if}
		</form>
	{/if}
</section>

<style>
	.pausenschalter {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.85rem 1rem;
		margin: 1rem 0;
	}

	/*
	 * Im unterbrochenen Zustand auffällig: Wer an die Sitzungsleitung
	 * zurückkommt, muss auf einen Blick sehen, dass der Saal wartet.
	 */
	.pausenschalter.laeuft {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		background: color-mix(in srgb, var(--warnung) 18%, var(--flaeche));
		border-color: var(--warnung);
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.lage {
		min-width: 0;
	}

	.klein {
		margin: 0.2rem 0 0;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.anschalten {
		display: flex;
		flex-wrap: wrap;
		/*
		 * **Oben ausgerichtet, seit der Wortlaut aufklappt** (11.09.2026, aus dem
		 * Code-Review). Mit `flex-end` schob das offene `<details>` den Knopf
		 * «Pause» um rund 50 px nach unten — genau der Knopf, von dem der
		 * Kommentar oben sagt, er müsse ungestört stehen. Zugeklappt sind Knopf
		 * und Zusammenfassung gleich hoch (`--ziel-min`), die Zeile steht also
		 * auch so bündig.
		 */
		align-items: flex-start;
		gap: 0.6rem;
	}

	.wandtext {
		flex: 1 1 16rem;
		min-width: 0;
		font-size: 0.9rem;
	}

	/*
	 * Die Marke bleibt stehen: Ein `<summary>` ohne Dreieck sieht aus wie Text,
	 * und niemand klickt darauf (`scripts/stylelint/dreieck-am-summary.mjs`).
	 * Der erste Anlauf zentrierte mit `display: flex` und nahm dem Dreieck damit
	 * seinen Platz; der Wächter hat es gemeldet. Die Fingergrösse kommt deshalb
	 * über `min-height` und `padding`.
	 */
	.wandtext summary {
		cursor: pointer;
		color: var(--text-leise);
		min-height: var(--ziel-min);
		padding: 0.5rem 0;
	}

	.anschalten label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		font-size: 0.9rem;
		margin-top: 0.35rem;
	}

	.anschalten input {
		min-height: var(--ziel-min);
	}

	.anschalten .klein {
		flex-basis: 100%;
	}

	button {
		min-height: var(--ziel-min);
		flex: none;
	}
</style>
