<script lang="ts">
	/**
	 * Das Fenster mit dem ausgegebenen Zugangscode.
	 *
	 * **Warum ein echtes `dialog` mit `showModal`:** Wer einen Code am Eingang
	 * vorliest, während zehn Leute warten, darf ihn nicht dadurch verlieren, dass
	 * jemand daneben eine Anwesenheit bestätigt. Der Dialog liegt über allem,
	 * nimmt die Tastatur an sich und geht erst weg, wenn die Sitzungsleitung ihn
	 * schliesst.
	 *
	 * **Der Code erscheint nur jetzt** — danach steht in der Datenbank nur sein
	 * Prüfwert. Ein weggeflogenes Fenster heisst: Die Person braucht einen neuen.
	 *
	 * **Als Komponente seit dem 24.08.2026** (Auftraggeber: «Die Funktionalität von
	 * Anwesenheit und Beschlussfähigkeit gegenüber Einlass ist auch nicht
	 * identisch»). Am Abend erschien der Code bis dahin nur als Meldungszeile —
	 * ohne Fenster, ohne QR, und verschwunden, sobald der Ereignisstrom die Seite
	 * nachlud.
	 */
	interface Ausgabe {
		code: string;
		name: string;
		gueltigBis: string;
		adresse: string;
		svg: string;
	}

	interface Eigenschaften {
		/** Was der Server zurückgegeben hat. Null heisst: kein Fenster. */
		ausgabe: Ausgabe | null;
		/** Die Adresse zum Eintippen, ohne Schema — für den Fall ohne Kamera. */
		einstiegAdresse: string;
		/** Wird gerufen, wenn das Fenster geschlossen wird. */
		beimSchliessen?: () => void;
	}

	let { ausgabe, einstiegAdresse, beimSchliessen }: Eigenschaften = $props();

	let codefenster = $state<HTMLDialogElement | null>(null);
	let codeOffen = $state(false);

	$effect(() => {
		if (ausgabe && codefenster && !codeOffen) {
			codefenster.showModal();
			codeOffen = true;
		}
	});
</script>

{#if ausgabe}
	<dialog
		class="ausgabe"
		bind:this={codefenster}
		onclose={() => {
			codeOffen = false;
			beimSchliessen?.();
		}}
	>
		<h2>Code für {ausgabe.name}</h2>
		<!--
			**Scannen statt abschreiben** (Auftraggeber, 24.08.2026). Der QR trägt denselben
			Code, der darunter steht — er ersetzt nur den Zettel, das Vorlesen durch
			den Saal und das Vertippen. Halten Sie den Bildschirm hin; das Telefon der
			Person öffnet damit ihren Zugang.
		-->
		<div class="mitqr">
			<!--
				**Der QR ist eigenes Erzeugnis, kein fremder Text.** `qrcode` baut das SVG
				serverseitig aus einer Adresse, die wir selbst zusammensetzen — es gibt keinen
				Weg, über den ein Eigentümer hier Markup einschleusen könnte. Ein Bild lässt
				sich nur so einbetten; eine Datei daraus zu machen hiesse, ihn abzulegen.
			-->
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="qr">{@html ausgabe.svg}</div>
			<div>
				<p class="code">{ausgabe.code}</p>
				<p class="klein">
					Mit dem Telefon der Person abscannen — oder vorlesen und unter
					<strong>{einstiegAdresse}</strong> eintippen.
				</p>
			</div>
		</div>
		<p class="klein">
			Gültig bis
			{new Date(ausgabe.gueltigBis).toLocaleTimeString('de-CH', {
				timeZone: 'Europe/Zurich',
				hour: '2-digit',
				minute: '2-digit'
			})} Uhr, dann verfällt er.
		</p>
		<p class="klein">
			Er erscheint <strong>nur jetzt</strong> — danach steht in der Datenbank nur sein Prüfwert.
			Die Zugangskarte der Person bleibt gültig. War bereits ein Gerät angemeldet, löst dieser
			Code es ab; das andere Gerät erfährt es beim nächsten Aufruf.
		</p>
		<form method="dialog">
			<button type="submit" class="haupt">Fertig — schliessen</button>
		</form>
	</dialog>
{/if}

<style>
	/* Ein Fenster, kein Abschnitt: mittig, über allem, mit gedämpftem Hintergrund. */
	dialog.ausgabe {
		max-width: 32rem;
		width: calc(100% - 2rem);
		padding: 1.25rem 1.4rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
	}

	dialog.ausgabe::backdrop {
		/* themenfest: Durchscheinendes Schwarz als Schleier, das traegt in beiden Themen. */
		background: rgb(0 0 0 / 0.55);
	}

	dialog.ausgabe h2 {
		margin-top: 0;
	}

	dialog.ausgabe form {
		margin-top: 1rem;
	}

	/*
	 * QR links, Code und Weg rechts. Der QR ist der schnellere Weg und steht
	 * deshalb zuerst; der Code bleibt daneben, weil nicht jede Kamera mitspielt.
	 */
	.mitqr {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.mitqr .qr {
		width: clamp(7rem, 30vw, 11rem);
		flex: none;
		/* themenfest: Der QR-Code braucht Weiss, damit ihn jede Kamera liest. */
		background: #fff;
		padding: 0.4rem;
		border-radius: var(--radius);
	}

	.mitqr .qr :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}

	.code {
		font-family: ui-monospace, monospace;
		font-size: clamp(1.6rem, 5vw, 2.4rem);
		font-weight: 700;
		letter-spacing: 0.1em;
		margin: 0.2rem 0 0.6rem;
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
	}
</style>
