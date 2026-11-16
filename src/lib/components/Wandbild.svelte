<script lang="ts">
	/**
	 * Was an der Wand steht, solange kein Geschäft läuft.
	 *
	 * Vorgeschlagen am 02.08.2026 als Ersatz für das zweite Feld zum Aufrufen
	 * eines Traktandums am Eingang: «Was man anstelle Aufgerufenes Traktandum
	 * machen könnte, ist die Auswahl der Traktandenliste, einer Begrüssung und
	 * Freitext.»
	 *
	 * Steht an **zwei** Stellen, weil die drei Bilder zu verschiedenen Zeiten
	 * gebraucht werden: am Eingang die Begrüssung, bevor die Versammlung
	 * beginnt, und an der Sitzungsleitung der freie Text für die Pause. Eine
	 * Komponente, damit sie nicht auseinanderlaufen.
	 *
	 * Die Auswahl schickt sofort ab, ohne zweiten Klick auf «Speichern»: Im Saal
	 * zählt, dass die Wand wechselt, wenn die Sitzungsleitung es sagt. Nur der
	 * freie Text braucht den Knopf — ein Text schickt sich nicht beim Tippen.
	 */
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { WANDBILDARTEN, type Wandbildart } from '$lib/domain/versammlung';
	import { angekreuzt } from '$lib/felder';

	interface Eigenschaften {
		art: Wandbildart;
		text: string | null;
		/**
		 * Das aufgerufene Traktandum, wenn eines aufgerufen ist.
		 *
		 * Es geht dem Wandbild vor. Ohne diesen Hinweis wählte die
		 * Sitzungsleitung ein Bild, an der Wand geschähe nichts, und niemand
		 * wüsste warum.
		 */
		aufgerufen?: { nummer: string; titel: string } | null;
	}

	let { art, text, aufgerufen = null }: Eigenschaften = $props();

	/*
	 * Der eigene Text nur bei «frei» — sonst stünde ein Eingabefeld da, das
	 * nichts bewirkt.
	 *
	 * `null` heisst «noch nichts angeklickt»: Dann gilt, was der Server sagt.
	 * Ein Anfangswert aus der Eigenschaft bliebe nach dem Neuladen auf dem alten
	 * Stand stehen.
	 */
	let angeklickt = $state<Wandbildart | null>(null);

	/**
	 * **Nach einer Antwort gilt wieder der Server.** Vorher setzte das Neuladen
	 * `angeklickt` auf `null` zurück; seit dem 28.08.2026 lädt die Seite nicht
	 * mehr neu. Ein Klick auf «Eigener Text» schickt mit Absicht nicht ab — er
	 * überstimmte den Serverstand danach dauerhaft, und `angekreuzt()` bekäme
	 * den Radiopunkt nicht mehr zurück, weil der Browser ein einmal geklicktes
	 * Feld als «schmutzig» führt und `defaultChecked` nicht mehr ansieht.
	 */
	function wiederVomServer(): void {
		angeklickt = null;
	}
	const gewaehlt = $derived(angeklickt ?? art);
</script>

<section class="wandbild">
	<h2>Was an der Wand steht</h2>
	<p class="klein">
		Gilt, solange kein Traktandum aufgerufen und keine Abstimmung offen ist. Ein laufendes
		Geschäft geht immer vor.
	</p>

	{#if aufgerufen}
		<p class="vorrang">
			Zurzeit steht Traktandum {aufgerufen.nummer} «{aufgerufen.titel}» an der Wand. Nehmen Sie
			den Aufruf oben zurück, damit das gewählte Bild erscheint.
		</p>
	{/if}

	<!--
		`reset: false`: Das Formular zeigt den Bestand — welche Art an der Wand
		steht und mit welchem Wortlaut. Ein Leeren fiele auf die Werte vom
		letzten Seitenaufbau zurück.

		**Ohne Fokusmarke, und das ist Absicht.** Der Wechsel der Art schickt
		über `requestSubmit()` ohne Absender ab; es gibt keinen Knopf, von dem
		eine Marke käme. Eine feste Marke bräuchte ein festes Ziel, und das
		einzige sinnvolle wäre das **gewählte** Feld — ein Wert, der erst zur
		Laufzeit feststeht und den `scripts/check-fokusmarke.mjs` zu Recht nicht
		als Ziel erkennen kann. Der Fokus geht nach dem Wechsel also verloren,
		genau wie vor der Umstellung: kein Rückschritt, aber auch keine
		Verbesserung. Der Knopf «An die Wand» trägt seine Marke selbst.
	-->
	<form method="POST" action="?/wandbild" use:enhance={absenden({ reset: false, beiErfolg: wiederVomServer })}>
		<div class="wahl">
			{#each WANDBILDARTEN as w (w.art)}
				<label class:aktiv={gewaehlt === w.art}>
					<!--
						`angekreuzt()` statt `checked`: Ein gebundenes `checked` ist
						reaktiv und wird bei jedem Neuzeichnen auf den Wert vom Server
						zurückgestellt. Beim Wechsel auf «Eigener Text» erschien das
						Textfeld, aber der Punkt sprang zurück — abgeschickt wurde dann
						die alte Art. Der Helfer nimmt im Browser `defaultChecked` und
						auf dem Server `checked`, damit auch ohne JavaScript etwas
						gewählt ist.
					-->
					<input
						type="radio"
						name="art"
						value={w.art}
						{...angekreuzt(art === w.art)}
						onchange={(e) => {
							angeklickt = w.art;
							// «Freitext» wartet auf den Wortlaut; die anderen zwei
							// brauchen keine zweite Bestätigung.
							if (w.art !== 'frei') e.currentTarget.form?.requestSubmit();
						}}
					/>
					<span class="titel">{w.titel}</span>
					<span class="wofuer">{w.wofuer}</span>
				</label>
			{/each}
		</div>

		{#if gewaehlt === 'frei'}
			<label class="wortlaut">
				<span>Wortlaut</span>
				<textarea name="text" rows="2" placeholder="Weiter um 20:15">{text ?? ''}</textarea>
			</label>
			<button type="submit" data-fokus="wandbild:frei">An die Wand</button>
		{/if}
	</form>
</section>

<style>
	.wandbild {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
		margin: 1.25rem 0;
	}

	h2 {
		margin: 0 0 0.25rem;
		font-size: 1.05rem;
	}

	.klein {
		margin: 0 0 0.9rem;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	/* Kein Alarm, sondern eine Auskunft: Es ist nichts kaputt, es ist nur
	   etwas anderes dran. */
	.vorrang {
		margin: 0 0 0.9rem;
		padding: 0.5rem 0.7rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
		font-size: 0.85rem;
	}

	.wahl {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	/* Grosse Ziele: Die Auswahl wird im Saal mit dem Daumen getroffen. */
	.wahl label {
		flex: 1 1 12rem;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.15rem 0.6rem;
		align-items: baseline;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.6rem 0.8rem;
		cursor: pointer;
	}

	.wahl label.aktiv {
		border-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 8%, transparent);
	}

	.wahl input {
		grid-row: span 2;
	}

	.titel {
		font-weight: 600;
	}

	.wofuer {
		grid-column: 2;
		font-size: 0.8rem;
		color: var(--text-leise);
	}

	.wortlaut {
		display: block;
		margin: 0.9rem 0 0.6rem;
	}

	.wortlaut span {
		display: block;
		font-size: 0.85rem;
		color: var(--text-leise);
		margin-bottom: 0.2rem;
	}

	textarea {
		width: 100%;
		font: inherit;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		resize: vertical;
	}
</style>
