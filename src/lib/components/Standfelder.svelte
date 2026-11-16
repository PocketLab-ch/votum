<script lang="ts">
	/**
	 * Der Stand, den diese Seite vorfand — als versteckte Felder im Formular.
	 *
	 * **Wozu.** Wer eine Seite offen liegen lässt, während jemand anders am selben
	 * Feld einträgt, setzt beim Speichern dessen Eintrag zurück, ohne dass es
	 * einer der beiden merkt. Der Schreibweg vergleicht deshalb mit dem Stand von
	 * hier (`veralteteFelder` in `$lib/domain/schreibstand`) und lehnt ab, statt
	 * still zu überschreiben.
	 *
	 * **Warum als Baustein und nicht je Formular getippt** (26.08.2026, aus dem
	 * Code-Review). Die Felder **sind** der Schutz: Fehlt eines oder heisst es
	 * anders, liest `standAus()` es nicht, `veralteteFelder` prüft es still nicht
	 * mehr, und die Überschreibung ist zurück — ohne dass etwas rot wird. Die
	 * Feldnamen kommen deshalb aus derselben Tabelle, aus der auch der Server
	 * liest (`Object.keys(LEITUNGSFELDER)`), und stehen nur noch hier.
	 *
	 * **Nach einem Konflikt trägt `stand` den neuen Stand.** `use:enhance` lädt
	 * bei einer Absage nicht neu; ohne diesen Vorrang schickte das Formular wieder
	 * den alten mit, und der zweite Versuch liefe in denselben Konflikt. Ein
	 * leerer Wert darin ist eine Angabe («dort steht nichts») und darf **nicht**
	 * durch den Bestand ersetzt werden — deshalb `stand ? … : …` und nicht `??`.
	 */
	interface Props {
		/** Die Feldnamen, in derselben Reihenfolge wie der Server sie liest. */
		felder: readonly string[];
		/** Was beim Laden dastand, je Feld. */
		bestand: Record<string, string | null | undefined>;
		/** Was die letzte Absage als geltenden Stand zurückgab, falls es eine gab. */
		stand?: Record<string, string> | undefined;
	}

	const { felder, bestand, stand }: Props = $props();
</script>

{#each felder as feld (feld)}
	<input type="hidden" name="stand-{feld}" value={stand ? (stand[feld] ?? '') : (bestand[feld] ?? '')} />
{/each}
