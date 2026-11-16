<script lang="ts">
	import { untrack, type Snippet } from 'svelte';

	/**
	 * Eine Rückfrage, die **erst der Server beantworten konnte** — als Fenster.
	 *
	 * ## Warum es sie neben `Rueckfrage.svelte` gibt
	 *
	 * `Rueckfrage.svelte` fängt den Klick ab und fragt sofort. Das geht nur,
	 * solange die Seite alles weiss, was in der Frage steht. Manche Fragen weiss
	 * sie nicht: «Mit ihr gehen 2 Quotenwerte verloren» steht in `unit_quota`,
	 * nicht auf der Seite. Dort geht der erste Klick zum Server, der zählt, und
	 * die Antwort kommt als Formularergebnis zurück.
	 *
	 * ## Warum als Fenster und nicht als Kachel am Seitenkopf
	 *
	 * So stand es bis zum 26.08.2026 — und der Auftraggeber sagte dazu: «Beim Löschen gibt es
	 * ein Infokachel oben. Das sieht gequetscht aus. Wäre da ein Modal nicht
	 * besser, ohne dass die Seite top springt? Das wäre dann bei allen Ansichten
	 * identisch zu handhaben.» Beides trifft zu: Die Kachel stand über der ganzen
	 * Bahn und drückte den Text in eine Zeile, und wer unten in einer langen
	 * Tabelle auf «Entfernen» klickte, musste erst nach oben rollen, um die Frage
	 * überhaupt zu sehen.
	 *
	 * ## Ohne JavaScript bleibt die Frage sichtbar
	 *
	 * Das `dialog` wird mit `open` gezeichnet; erst im Browser wird daraus ein
	 * Fenster (`close()` und `showModal()`). Eine Frage, die ohne JavaScript
	 * verschwände, wäre der schlechtere Tausch: Dann geschähe die Handlung
	 * ungefragt.
	 *
	 * **Dazu gehört eine Zeile in `app.css`**: Ein offenes, nicht-modales
	 * `dialog` ist im Vorgabestil des Browsers `position: absolute` und steht
	 * damit **nicht** im Fluss, sondern über dem Inhalt darunter. Erst
	 * `dialog.rueckfrage:not(:modal) { position: static }` macht daraus den
	 * Block, den dieser Absatz beschreibt (26.08.2026 nachgemessen — vorher
	 * verdeckte die Frage die Kachel darunter).
	 *
	 * ## Warum es `serverfrage` heisst
	 *
	 * Die Drehbücher hängen einen Beobachter ein, der **jedes** aufgehende
	 * `dialog.rueckfrage` bestätigt (`e2e/rueckfrage.mjs`) — gedacht für die
	 * Fenster, die erst ein Klick öffnet. Dieses hier steht schon im
	 * ausgelieferten HTML offen; der Beobachter drückte also «Trotzdem
	 * entfernen», bevor überhaupt jemand gefragt hat. Die zweite Klasse ist sein
	 * Erkennungsmerkmal: Er lässt sie in Ruhe.
	 */
	interface Eigenschaften {
		/** Die Frage. Nennt Ross und Reiter, nicht «Sind Sie sicher?». */
		frage: string;
		/** Was mitgeht und was danach gilt. */
		inhalt: Snippet;
		/** Der bestätigende Weg: ein Formular mit seinen versteckten Feldern. */
		handlung: Snippet;
		/**
		 * Der Weg zurück ohne JavaScript — dieselbe Seite ohne Formularergebnis.
		 *
		 * Im Browser wird daraus ein blosses Schliessen: Ein Wechsel der Adresse
		 * setzte die Seite an den Anfang zurück, und genau das soll wegfallen.
		 */
		zurueck: string;
		/**
		 * Wechselt mit jeder neuen Antwort des Servers.
		 *
		 * Ohne diese Marke ginge das Fenster nach dem Schliessen beim nächsten
		 * Neuzeichnen wieder auf — das Formularergebnis steht ja weiterhin da.
		 */
		marke?: unknown;
	}

	const { frage, inhalt, handlung, zurueck, marke }: Eigenschaften = $props();

	/** Damit das Fenster einen Namen hat, den ein Vorleseprogramm ansagt. */
	const titelId = `rueckfrage-${Math.random().toString(36).slice(2, 9)}`;

	let fenster = $state<HTMLDialogElement | null>(null);
	let gezeigt = $state.raw<unknown>(Symbol('noch nichts gezeigt'));

	$effect(() => {
		const jetzt = marke ?? frage;
		if (!fenster?.showModal) return;
		if (untrack(() => gezeigt) === jetzt) return;
		gezeigt = jetzt;
		// Aus dem `open`-Block ein Fenster machen: `showModal` wirft, solange das
		// Element schon offen dasteht.
		if (fenster.open) fenster.close();
		fenster.showModal();
		/*
		 * **Der Fokus gehört auf die Bestätigung, nicht auf «Abbrechen».** Ohne
		 * diese Zeile nimmt der Browser das erste fokussierbare Element — und das
		 * ist der Rückweg, weil er im Markup zuerst steht. `Rueckfrage.svelte`
		 * setzt den Fokus ausdrücklich auf den Ja-Knopf; zwei gleich aussehende
		 * Fenster, in denen die Eingabetaste das Gegenteil tut, wären genau das,
		 * was hier abgeschafft werden sollte.
		 */
		fenster.querySelector<HTMLElement>('.ja')?.focus();
	});

	function schliesse(e: MouseEvent) {
		if (!fenster?.showModal) return; // Ohne Fenster bleibt der Verweis der Weg.
		e.preventDefault();
		fenster.close();
	}
</script>

<dialog
	bind:this={fenster}
	class="rueckfrage serverfrage"
	aria-labelledby={titelId}
	open
>
	<h2 id={titelId}>{frage}</h2>
	{@render inhalt()}
	<div class="tun">
		<a class="ab" href={zurueck} onclick={schliesse}>Abbrechen</a>
		{@render handlung()}
	</div>
</dialog>
