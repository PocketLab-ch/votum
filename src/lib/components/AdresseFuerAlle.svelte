<script lang="ts">
	/**
	 * «Adresse der Gemeinschaft für alle übernehmen» — der Knopf unter der
	 * Personenliste.
	 *
	 * **Der Anlass** (22.08.2026, Befund A-09): Bei einer
	 * Stockwerkeigentümergemeinschaft wohnen die meisten Eigentümer an der
	 * Liegenschaftsadresse; im Prüflauf wurde «Probehalde 14, 9999
	 * Nirgendheim» viermal von Hand getippt, obwohl die Anwendung sie kennt.
	 *
	 * **Ein Knopf für die ganze Liste, nicht einer je Zeile.** Der häufige Fall
	 * ist das Ehepaar an der Liegenschaftsadresse; dort wären zwei bis fünf
	 * Knöpfe zwei bis fünf Klicks für dieselbe Angabe, und die Personenzeile
	 * trägt schon sechs Felder. Der seltenere Fall, drei Erben, die alle woanders
	 * wohnen, verliert dadurch nichts: Er drückt den Knopf gar nicht.
	 *
	 * **Gefüllt wird nur, was leer ist.** Damit trägt der Knopf auch den
	 * gemischten Fall (Paar plus ein Erbe auswärts): einmal drücken, dann die
	 * eine abweichende Zeile überschreiben. Und er nimmt niemandem weg, was er
	 * schon getippt hat.
	 *
	 * **Ein Knopf und kein Häkchen:** Ein Häkchen «wie die Gemeinschaft» müsste
	 * bei jeder späteren Adressänderung mitwandern oder lügen. Der Knopf trägt
	 * den Wert einmal ein; danach gehört er der Person, und wer wegzieht, ändert
	 * nur seine eigene Zeile.
	 *
	 * **Über den Baum und nicht über den Zustand.** Die Felder führt der Browser
	 * (`anfangswert`); im Zustand steht nur, **welche** Zeilen es gibt. Der Knopf
	 * schreibt deshalb dorthin, wo der Wert wirklich liegt. Denselben Griff macht
	 * `Suchauswahl.svelte`, wenn ein Vorschlag von aussen übernommen wird.
	 *
	 * **Seit dem 04.09.2026 ein Baustein** (Task 8 des Hüllen-Plans). Vorher
	 * standen Knopf und Griff wortgleich in zwei Seiten.
	 */
	interface Eigenschaften {
		/**
		 * Die Anschrift der Gemeinschaft, sofern eine hinterlegt ist.
		 *
		 * Ist sie leer, erscheint der Knopf nicht: Einer, der einen leeren Wert
		 * einträgt, ist eine Zusage, die er nicht hält.
		 */
		adresse: string | null | undefined;
	}

	let { adresse }: Eigenschaften = $props();

	function fuerAlle(knopf: HTMLButtonElement) {
		const formular = knopf.closest('form');
		if (!formular || !adresse) return;
		for (const feld of formular.querySelectorAll<HTMLInputElement>(
			'input[name="mitberechtigterAdresse"]'
		)) {
			if (!feld.value.trim()) feld.value = adresse;
		}
	}
</script>

{#if adresse}
	<button type="button" class="leise weitere" onclick={(e) => fuerAlle(e.currentTarget)}>
		Adresse der Gemeinschaft für alle übernehmen
	</button>
{/if}

<style>
	/* Derselbe Abstand wie «Weitere Person» daneben. */
	.weitere {
		margin-top: 0.75rem;
	}

	/*
		**`.leise` muss hier stehen** (04.09.2026, im Bild gesehen). Svelte kapselt
		Stile je Datei, und `.leise` gibt es nur seitengebunden, an achtzehn
		Stellen abgeschrieben. Ohne diese Regel stand der Knopf gefüllt und dunkel
		neben «Weitere Person», das seine Regel behalten hat: zwei gleichrangige
		Knöpfe nebeneinander, verschieden gezeichnet.

		Dass `.leise` eine Hausklasse in `app.css` werden sollte, ist damit nicht
		erledigt, sondern nur vertagt: Das ist ein eigener Block über achtzehn
		Dateien, kein Nebenbei in diesem hier.
	*/
	.leise {
		background: none;
		border: 1px solid var(--linie);
		color: var(--text-leise);
		font: inherit;
		font-size: 0.85rem;
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.leise:hover {
		border-color: var(--text-leise);
		color: var(--text);
	}
</style>
