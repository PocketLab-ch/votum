<script lang="ts">
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	// S10, F4a (E5): derselbe Satz wie im Hinweis zum Stichentscheid.
	import { WIDERSPRUCH_FESTHALTEN } from '$lib/domain/auszaehlung';
	/**
	 * Was nach dem Schliessen einer Abstimmung noch geschehen kann — an **einer**
	 * Stelle gebaut, in beiden Sitzungsleitungen gezeigt.
	 *
	 * Zwei Dinge, die nichts miteinander zu tun haben und doch beide hierher
	 * gehören, weil sie denselben Durchgang betreffen:
	 *
	 * **Der offene Gleichstand** (Story 7.9). Weist das Reglement die
	 * Entscheidung bei Stimmengleichheit einer Person zu (Verwalter), kann die
	 * Anwendung sie nicht rechnen. Sie hält an und fragt, statt ein Ergebnis zu
	 * erfinden; verkündet wird bis dahin nichts, denn eine ausstehende
	 * Entscheidung ist keine Ablehnung. Votum empfiehlt die Ablehnung
	 * (Produktentscheid 28.09.2026). Lässt das Reglement die Wertquoten
	 * entscheiden und sind die Stimmen als Summen erfasst, lässt sich das
	 * Ergebnis ebenfalls nicht rechnen; dann verweist der Kasten auf die
	 * Neuabstimmung mit Einzelerfassung. Früher eingetragene Entscheide zeigt
	 * die Anwendung weiter an.
	 *
	 * **Die Neuabstimmung.** Ein Verfahrensfehler macht den Durchgang nicht
	 * ungeschehen — er wird als überholt vermerkt und bleibt einsehbar.
	 * **Nur solange das Ergebnis nicht verkündet ist** (H6, Fachprüfung
	 * 08.10.2026): Ein verkündeter Beschluss ändert nur die Versammlung, über
	 * das Rückkommen. Weil das Schliessen verkündet, ist das allein der Fall des
	 * offenen Gleichstands; deshalb hängt der Knopf an `stichentscheidOffen`.
	 * Stünde er nach der Verkündung da, führte er in die Absage von
	 * `ueberholeDurchgang`.
	 *
	 * **Der Text zum Beschluss** (Auftraggeber, 09.09.2026), seit dem 09.09.2026 das
	 * dritte. Er führt Details, Präzisierungen oder Änderungen aus; Annahme und
	 * Ablehnung kommen hart aus der Abstimmung und stehen schon darüber.
	 *
	 * **Als Komponente seit dem 24.08.2026** (Auftraggeber: «Die Gruppenveranstaltung
	 * muss dasselbe können wie die Einzelveranstaltung. Idealerweise so
	 * ausbauen, dass man je Thema eine Maske braucht»). Am gemeinsamen Abend
	 * fehlten beide Wege ganz: Wer dort in eine Stimmengleichheit lief, kam ohne
	 * Wechsel in die Hausansicht nicht weiter — und die Hausansicht führt nicht
	 * die Liste des Abends.
	 */
	interface Eigenschaften {
		/** Der Durchgang, um den es geht. */
		durchgangId: string;
		/** Ob ein Gleichstand offen ist. */
		stichentscheidOffen: boolean;
		/**
		 * Welche Regel den offenen Gleichstand entscheidet: eine Person über die
		 * Regel `verwalter` oder `vorsitz` (auch als zweite Stufe nach den
		 * Wertquoten) oder die Wertquoten über einer Handzählung.
		 */
		stichentscheidArt?: 'wertquote' | 'verwalter' | 'vorsitz' | null;
		/** Ein eingetragener Stichentscheid, falls einer vorliegt. */
		stichentscheid?: {
			wer: string;
			wahl: string;
			begruendung?: string | null;
			/** Selbst Stockwerkeigentümer im Vorsitz (Migration 150). */
			eigentuemer?: boolean;
		} | null;
		/** Der Text zum Beschluss dieses Durchgangs, soweit einer festgehalten ist. */
		beschlusstext?: string | null;
		/** Am Abend: das Haus, in dem der Durchgang liegt. Null in der Leitung eines Hauses. */
		mitVersammlungId?: string | null;
		/**
		 * Keine Neuabstimmung anbieten: nach einem Widerspruch an der
		 * Universalversammlung, wo das Eröffnen danach ohnehin abweist (Migration 128).
		 */
		ohneNeuabstimmung?: boolean;
		/**
		 * Ohne das Feld für den Beschlusstext: für den Durchgang nach einem
		 * Rückkommen mit offenem Stichentscheid, der nichts entschieden hat und
		 * nur über die Neuabstimmung festgestellt wird (Reste vom 30.09.2026,
		 * Punkt 3; Codeprüfung H1).
		 */
		ohneBeschlusstext?: boolean;
	}

	let {
		durchgangId,
		stichentscheidOffen,
		stichentscheidArt = null,
		stichentscheid = null,
		beschlusstext = null,
		mitVersammlungId = null,
		ohneNeuabstimmung = false,
		ohneBeschlusstext = false
	}: Eigenschaften = $props();
</script>

{#snippet mitVersammlung()}
	{#if mitVersammlungId}
		<input type="hidden" name="versammlung" value={mitVersammlungId} />
	{/if}
{/snippet}

{#if stichentscheidOffen && (stichentscheidArt === 'verwalter' || stichentscheidArt === 'vorsitz')}
	<!--
		**Der Eintragsweg ist wieder da** (Produktentscheid 28.09.2026: «Wendet
		es an. Empfohlen wird ablehnen, weil das dem Gesetz entspricht und man
		nicht Partei ergreifen würde.»). Die Option «Der Antrag ist abgelehnt»
		steht zuerst, weil Votum sie empfiehlt; entscheiden muss es die Person.
	-->
	<form
		method="POST"
		action="?/stichentscheid"
		class="stichentscheid"
		use:enhance={absenden()}
	>
		<input type="hidden" name="durchgang" value={durchgangId} />
		{@render mitVersammlung()}
		<h4>
			Stimmengleichheit: {stichentscheidArt === 'vorsitz'
				? 'die Person im Vorsitz entscheidet'
				: 'der Verwalter entscheidet'}
		</h4>
		<p class="klein">
			{#if stichentscheidArt === 'vorsitz'}
				<!--
					Beim Vorsitz hängt die Empfehlung an der Person (Produktentscheid
					07.10.2026): keine Richtung für eine Eigentümerin, Ablehnung für
					eine Person ohne Eigentum. Die Auswahl steht deshalb leer, statt die
					Ablehnung vorzubelegen.
				-->
				Nach dem Reglement dieser Gemeinschaft entscheidet bei Stimmengleichheit die Person, die
				den Vorsitz führt. Ist sie selbst Stockwerkeigentümer, gibt Votum ihr keine Richtung vor.
				Ist sie es nicht, empfiehlt Votum die Ablehnung, weil sie die Folgen nicht trägt.
				Nach dem Gesetz ist der Beschluss bei Stimmengleichheit nicht gefasst (SVIT-Kommentar 2023,
				Art. 712m Rz. 187). Fragen Sie dann vor dem Eintrag den
				Saal, ob jemand widerspricht. {WIDERSPRUCH_FESTHALTEN}
				Ist sie bei diesem Geschäft vom Stimmrecht ausgeschlossen, etwa weil es um einen Auftrag an
				sie selbst geht, kann sie den Stichentscheid nicht geben. Das ist eine Folgerung;
				getragen ist der Vorsitzwechsel (Rz. 76a ad Art. 712n). Dann bestimmt die Versammlung
				für dieses Traktandum einen anderen Vorsitz. Eine
				Annahme lässt sich innert eines Monats beim Gericht anfechten (ZGB Art. 75). Der Entscheid
				steht mit Namen in der Auswertung und im Verlauf.
			{:else}
				Nach dem Reglement dieser Gemeinschaft entscheidet bei Stimmengleichheit der Verwalter.
				Votum empfiehlt die Ablehnung: Nach dem Gesetz ist der Beschluss bei Stimmengleichheit
				nicht gefasst. Ob die Klausel trägt, ist umstritten (SVIT-Kommentar 2023, Art. 712m Rz. 187);
				eine Annahme lässt sich innert Monatsfrist beim Gericht anfechten (ZGB Art. 75). Der
				Entscheid steht mit Namen in der Auswertung und im Verlauf.
			{/if}
		</p>
		<div class="felder">
			<label>
				Entscheid
				<select name="wahl" required>
					{#if stichentscheidArt === 'vorsitz'}
						<option value="" selected disabled>Bitte wählen</option>
					{/if}
					<option value="no">Der Antrag ist abgelehnt</option>
					<option value="yes">Der Antrag ist angenommen</option>
				</select>
			</label>
			<label class="breit">
				Wer entscheidet
				<input name="wer" required minlength="2" placeholder="Name der entscheidenden Person" />
			</label>
			{#if stichentscheidArt === 'vorsitz'}
				<label class="voll wahl">
					<input type="checkbox" name="eigentuemer" value="ja" />
					Die Person im Vorsitz ist selbst Stockwerkeigentümer, nicht bloss mit Vollmacht hier
				</label>
			{/if}
			<label class="voll">
				Begründung (freiwillig)
				<textarea name="begruendung" rows="2"></textarea>
			</label>
			<button type="submit" class="haupt" data-fokus="stichentscheid:{durchgangId}">
				Entscheid festhalten
			</button>
		</div>
	</form>
{:else if stichentscheidOffen && stichentscheidArt === 'wertquote'}
	<div class="stichentscheid">
		<h4>Stimmengleichheit: Die Wertquoten entscheiden</h4>
		<p class="klein">
			Nach dem Reglement dieser Gemeinschaft entscheiden bei Stimmengleichheit die Wertquoten.
			Aus einer Handzählung lässt sich nicht ablesen, welche Anteile hinter Ja und hinter Nein
			stehen. Setzen Sie unten eine Neuabstimmung an und erfassen Sie die Stimmen dabei einzeln;
			dann rechnet das Werkzeug die Wertquoten selbst.
		</p>
	</div>
{:else if stichentscheidOffen}
	<!--
		**Ohne bekannte Regel** (Nachtrag 04.10.2026): Der zweite Baustein am
		Durchgang nach einem Rückkommen kennt die Art des Gleichstands nicht und
		darf deshalb keine nennen. Früher stand hier «Die Wertquoten
		entscheiden», seit dem Verwalter-Stichentscheid wäre das für diesen Fall
		falsch.
	-->
	<div class="stichentscheid">
		<h4>Stimmengleichheit: Dieser Durchgang ergab keinen Beschluss</h4>
		<p class="klein">
			Der frühere Beschluss gilt weiter. Setzen Sie unten eine Neuabstimmung an und lassen Sie
			die Versammlung neu entscheiden.
		</p>
	</div>
{/if}

{#if stichentscheid}
	<p class="klein">
		Stichentscheid durch <strong>{stichentscheid.wer}</strong>{stichentscheid.eigentuemer
			? ' im Vorsitz, selbst Stockwerkeigentümer (in der Zählung nicht enthalten)'
			: ''}:
		<!-- Der Leerschlag ausdrücklich: Am Anfang des Blocks schluckt Svelte ihn (Probe Wertquotenmehr). -->
		{stichentscheid.wahl === 'yes' ? 'angenommen' : 'abgelehnt'}{#if stichentscheid.begruendung}{'. Begründung: '}{stichentscheid.begruendung}{/if}
	</p>
{/if}

<!--
	**Der Text steht unter dem Ergebnis, nicht daneben.** Das ist die ganze
	Gestaltungsfrage an diesem Feld: Wer es neben dem Ergebnis sähe, könnte auf
	den Gedanken kommen, hier «abgelehnt» hineinzuschreiben. Es steht deshalb
	unter einer bereits gerechneten Angabe, und die Beschriftung sagt, wozu es
	da ist — «was darüber hinaus gilt», nicht «der Beschluss».
-->
{#if !ohneBeschlusstext}
<form
	method="POST"
	action="?/beschlusstext"
	class="beschlusstext"
	use:enhance={absenden({ reset: false })}
>
	<input type="hidden" name="durchgang" value={durchgangId} />
	<!--
		**Der zuletzt bekannte Stand geht mit** (Code-Review 09.09.2026). Am
		gemeinsamen Abend steht dasselbe Feld in zwei Masken offen; ohne ihn
		überschriebe die zweite Absendung die erste stillschweigend.
	-->
	<input type="hidden" name="bekannt" value={beschlusstext ?? ''} />
	{@render mitVersammlung()}
	<div class="felder">
		<label class="voll">
			Was darüber hinaus gilt (freiwillig)
			<textarea
				name="text"
				rows="2"
				maxlength="600"
				placeholder="zum Kostendach von CHF 8'000">{beschlusstext ?? ''}</textarea>
			<span class="klein">
				Details, Präzisierungen oder Änderungen zum Beschluss — etwa ein Kostendach oder ein
				Vorbehalt. Ob angenommen oder abgelehnt wurde, steht schon oben und kommt aus der
				Auszählung.
			</span>
		</label>
		<button type="submit" data-fokus="beschlusstext:{durchgangId}">
			Text zum Beschluss festhalten
		</button>
	</div>
</form>
{/if}

{#if stichentscheidOffen && !ohneNeuabstimmung}
<details class="neu">
	<summary>Neuabstimmung ansetzen</summary>
	<form method="POST" action="?/neuabstimmung" use:enhance={absenden()}>
		<input type="hidden" name="durchgang" value={durchgangId} />
		{@render mitVersammlung()}
		<label>
			Begründung (steht im Protokoll und im Verlauf)
			<textarea
				name="begruendung"
				rows="2"
				required
				minlength="10"
				placeholder="Verfahrensfehler bei der Fragestellung"
			></textarea>
		</label>
		<button type="submit" class="leise" data-fokus="neuabstimmung:{durchgangId}">
			Durchgang überholen
		</button>
	</form>
	<p class="klein">
		Der bisherige Durchgang bleibt einsehbar. Danach geben Sie die Abstimmung erneut frei.
	</p>
</details>
{/if}

<style>
	/*
	 * **Der Stichentscheid hält an** — deshalb eine Warnkante und nicht die
	 * gewohnte graue. Wer über ihn hinwegliest, verkündet nichts und wundert
	 * sich, warum die Wand leer bleibt.
	 */
	.stichentscheid {
		border: 1px solid var(--warnung);
		border-left-width: 4px;
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin: 0.75rem 0;
	}

	.stichentscheid h4 {
		margin: 0 0 0.3rem;
		font-size: 1rem;
	}

	.felder {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.5rem 0.75rem;
		margin-top: 0.6rem;
	}

	.felder label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-weight: 550;
	}

	.felder label.voll {
		grid-column: 1 / -1;
	}

	/*
	 * **Fett ist nur die Beschriftung** (UI-Durchgang 06.10.2026). `font: inherit`
	 * holte die 550 des Labels in das Feld, und der Hilfetext darunter erbte sie
	 * ebenso: Eingabe, Platzhalter und Erklärung standen fett wie die Frage.
	 */
	.felder input,
	.felder select,
	.felder textarea {
		min-height: var(--ziel-min);
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-weight: 400;
		max-width: 100%;
		box-sizing: border-box;
	}

	.felder label .klein {
		font-weight: 400;
	}

	/*
	 * **Der Knopf zum Beschlusstext ist untergeordnet** (Code-Review 09.09.2026).
	 * `.felder button` macht daraus sonst den Akzentknopf, und er stünde so laut
	 * da wie «Entscheid festhalten» — das Gegenteil dessen, was der Kommentar am
	 * Formular begründet. `class="leise"` half nicht: Die Klasse wirkt hier nicht.
	 *
	 * **Eine eigene Zeile, so breit wie sein Text** (UI-Durchgang 06.10.2026).
	 * In einer Rasterspalte von 14rem brach «Text zum Beschluss festhalten» auf
	 * zwei Zeilen um (56 px hoch) und lief bei 390 px über die ganze Breite.
	 * Die kleinere Schrift passt zum untergeordneten Rang und hält ihn in der
	 * 282 px schmalen Spalte der Sitzungsleitung auf einer Zeile.
	 */
	.beschlusstext .felder button {
		grid-column: 1 / -1;
		justify-self: start;
		background: var(--flaeche);
		color: var(--text);
		border: 1px solid var(--linie);
		font-weight: 400;
		font-size: 0.9rem;
	}

	.felder button {
		min-height: var(--ziel-min);
		align-self: end;
		padding: 0 1rem;
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	/*
	 * Kein `display: flex` am `<summary>`: Das nähme ihm sein Dreieck, und der
	 * Ausklapper sähe aus wie ein Satz. Die Fingergrösse kommt aus Polster und
	 * Mindesthöhe (die Stylelint-Regel `versammlung/dreieck-am-summary` hat es beanstandet).
	 */
	.neu summary {
		min-height: var(--ziel-min);
		padding: 0.5rem 0;
		cursor: pointer;
	}

	.neu label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0.5rem 0;
	}

	.neu textarea {
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		max-width: 100%;
		box-sizing: border-box;
	}

	.neu button {
		min-height: var(--ziel-min);
		padding: 0 0.9rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}
</style>
