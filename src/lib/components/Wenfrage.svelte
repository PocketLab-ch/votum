<script lang="ts">
	/**
	 * «Wen tragen Sie ein?» — die Wahl zwischen einem neuen und einem bereits
	 * erfassten Menschen.
	 *
	 * **Warum dieselbe Frage überall gleich aussieht** (11.08. und 27.08.2026).
	 * Sie stand zweimal verschieden da: im Alleineigentumszweig als Kasten mit
	 * zwei Auswahlknöpfen, in der Personenliste als Auswahlfeld.
	 * `docs/gestaltung.md`, Regel 1: **Gleichrangiges bleibt gleich.** Dieselbe
	 * Frage, zweimal anders dargestellt, ist genau der Fall.
	 *
	 * **Das Auswahlfeld gewinnt**, weil die Personenliste die härtere
	 * Einschränkung hat: Sie trägt beliebig viele Zeilen mit je vier Feldern, und
	 * ein eigener Knopfsatz je Zeile machte aus dem Kasten wieder die Aufreihung,
	 * gegen die «Ein Erfassungskasten ordnet nach Fragen, nicht nach Platz»
	 * schreibt.
	 *
	 * **Der Erklärsatz bleibt** und ist der eigentliche Grund, die Wahl überhaupt
	 * zu treffen: Wer schon in einer anderen Gemeinschaft steht, braucht nur
	 * einen Einlass für alle.
	 *
	 * **«Noch niemand erfasst» wird nicht angeboten, sondern erklärt.** Ein
	 * abgeschalteter Eintrag in einer Liste ist auf dem Telefon kaum als solcher
	 * zu erkennen; der Satz darunter sagt es.
	 *
	 * `use:gefuehrteWahl` statt `bind:value`: Ein `<select>`, an das gebunden
	 * ist, bekommt beim Aufbau den gebundenen Wert zurückgeschrieben und löscht
	 * eine Wahl aus dem Fenster vor der Hydration (`e2e/wahl-vor-hydration.mjs`).
	 *
	 * **Seit dem 04.09.2026 ein Baustein** (Task 8 des Hüllen-Plans). Vorher
	 * stand dieses Stück Maske als Ausschnitt in zwei Seiten, wortgleich, aber
	 * mit den Begründungen nur an einer der beiden Stellen.
	 */
	import { gefuehrteWahl } from '$lib/felder';
	import type { PersonenWahl } from '$lib/domain/personenangaben';

	interface Eigenschaften {
		/** Name des Formularfelds. */
		feldname: string;
		/** Kennung des Auswahlfelds, damit eine Beschriftung darauf zeigen kann. */
		kennung: string;
		wahl: PersonenWahl;
		/** Ob es überhaupt jemanden gibt, den man wählen könnte. */
		hatWaehlbare: boolean;
		melden: (wert: string) => void;
	}

	let { feldname, kennung, wahl, hatWaehlbare, melden }: Eigenschaften = $props();
</script>

<label class="voll">
	Wen tragen Sie ein?
	<select id={kennung} name={feldname} use:gefuehrteWahl={melden}>
		<option value="neu" selected={wahl === 'neu'}>jemanden, den es hier noch nicht gibt</option>
		{#if hatWaehlbare}
			<option value="bestehend" selected={wahl === 'bestehend'}>
				jemanden, der schon erfasst ist
			</option>
		{/if}
	</select>
	<span class="hilfe">
		{#if !hatWaehlbare}
			Noch niemand erfasst, deshalb steht hier nur der erste Weg.
		{:else}
			Wer schon in einer anderen Gemeinschaft steht: Dann reicht ein Einlass für alle, und
			derselbe Mensch bekommt keinen zweiten Eintrag.
		{/if}
	</span>
</label>
