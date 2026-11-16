<script lang="ts">
	import { onDestroy } from 'svelte';

	/**
	 * Der QR-Code der Zugangskarte, mit der Kamera dieses Geräts gelesen.
	 *
	 * **Wozu, und warum nicht die Kamera-App genügt.** Mit der Kamera-App des
	 * Telefons öffnet ein Scan die Adresse aus dem Code — die Sitzungsleitung
	 * landet dann auf der Anwesenheitsseite und bekommt die Rückfrage. Das
	 * funktioniert, hat aber zwei Haken: Es braucht ein Telefon (ein Notebook am
	 * Eingang kann es nicht), und zwischen zwei Eigentümern liegt jedes Mal ein
	 * Seitenwechsel. Gewünscht am 20.08.2026: «eine Maske, wo ich dann einfach
	 * den QR-Code der Eigentümer für das Checkin abschiessen kann».
	 *
	 * **Warum `jsqr` und nicht die eingebaute Erkennung.** `BarcodeDetector`
	 * gibt es in Chrome auf Android, aber weder in Safari auf dem iPhone noch in
	 * Chromium auf Linux — im Browser dieses Rechners nachgemessen: nicht
	 * vorhanden. Ein Knopf, der auf dem Notebook am Eingang nichts tut, ist
	 * schlimmer als keiner. Genommen wird deshalb, was da ist: die eingebaute
	 * Erkennung, wo es sie gibt, sonst `jsqr` — **mitgeliefert, nicht
	 * nachgeladen**. Im Saal ist das Netz das Erste, was fehlt.
	 *
	 * **Die Bibliothek wird erst beim Öffnen geholt** (`await import`). Sie wiegt
	 * rund 30 kB; auf einer Seite, die den ganzen Abend offen bleibt und alle
	 * paar Sekunden nachlädt, hat sie im Grundgepäck nichts verloren.
	 */
	interface Eigenschaften {
		/** Was mit einem gelesenen Code geschieht. Der Aufrufer schlägt ihn nach. */
		beiFund: (inhalt: string) => void;
		/** Solange wahr, wird nicht weitergesucht — etwa während einer Rückfrage. */
		angehalten?: boolean;
	}

	let { beiFund, angehalten = false }: Eigenschaften = $props();

	let offen = $state(false);
	let meldung = $state<string | null>(null);
	let video = $state<HTMLVideoElement | null>(null);
	let strom: MediaStream | null = null;
	let laeuft = false;
	let zuletzt = '';
	let leerlauf = 0;

	/**
	 * Ob die Kamera überhaupt zur Verfügung steht.
	 *
	 * `getUserMedia` gibt es **nur im sicheren Kontext** — über HTTPS oder auf
	 * `localhost`. Wer die Seite über die reine IP-Adresse aufruft
	 * (`http://192.168.…:3100`), hat `navigator.mediaDevices` gar nicht, und ein
	 * Klick liefe in einen Fehler ohne Erklärung. Deshalb steht der Grund am
	 * Knopf, bevor jemand darauf drückt.
	 */
	const moeglich = $derived(
		typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
	);

	const grund = $derived(
		typeof window !== 'undefined' && !window.isSecureContext
			? 'Die Kamera gibt der Browser nur über HTTPS frei. Rufen Sie diese Seite über ' +
					'die Adresse mit https:// auf — oder scannen Sie mit der Kamera-App des Telefons, ' +
					'die öffnet den Link der Karte direkt.'
			: 'Dieser Browser gibt keine Kamera frei. Nutzen Sie die Kamera-App des Telefons ' +
					'oder tippen Sie den Code ein.'
	);

	async function oeffne() {
		meldung = null;
		try {
			strom = await navigator.mediaDevices.getUserMedia({
				// Die rückwärtige Kamera: Am Eingang hält jemand sein Telefon hin.
				video: { facingMode: { ideal: 'environment' } }
			});
		} catch (fehler) {
			meldung =
				(fehler as Error)?.name === 'NotAllowedError'
					? 'Die Kamera ist gesperrt. Erlauben Sie sie in der Adresszeile des Browsers.'
					: 'Es liess sich keine Kamera öffnen.';
			return;
		}
		offen = true;
		// Erst nach dem Zeichnen gibt es das Videoelement.
		queueMicrotask(() => {
			if (video && strom) {
				video.srcObject = strom;
				video.play().catch(() => {});
			}
			void suche();
		});
	}

	function schliesse() {
		laeuft = false;
		offen = false;
		zuletzt = '';
		for (const spur of strom?.getTracks() ?? []) spur.stop();
		strom = null;
	}

	/**
	 * Der Suchlauf. Alle 120 ms ein Bild, nicht jedes einzelne.
	 *
	 * Ein Bild je Bildwiederholung wäre rund achtmal so viel Arbeit für dasselbe
	 * Ergebnis: Wer eine Karte hinhält, hält sie länger als eine Zehntelsekunde.
	 * Auf dem Notebook am Eingang, das nebenher den Beamer bedient, zählt das.
	 */
	async function suche() {
		if (laeuft) return;
		laeuft = true;

		const eingebaut =
			'BarcodeDetector' in globalThis
				? new (globalThis as any).BarcodeDetector({ formats: ['qr_code'] })
				: null;
		const jsQR = eingebaut ? null : (await import('jsqr')).default;

		const flaeche = document.createElement('canvas');
		const stift = flaeche.getContext('2d', { willReadFrequently: true });

		while (laeuft && video) {
			if (!angehalten && video.readyState >= 2 && video.videoWidth > 0) {
				let inhalt: string | null = null;
				if (eingebaut) {
					const treffer = await eingebaut.detect(video).catch(() => []);
					inhalt = treffer[0]?.rawValue ?? null;
				} else if (jsQR && stift) {
					flaeche.width = video.videoWidth;
					flaeche.height = video.videoHeight;
					stift.drawImage(video, 0, 0, flaeche.width, flaeche.height);
					const bild = stift.getImageData(0, 0, flaeche.width, flaeche.height);
					inhalt = jsQR(bild.data, bild.width, bild.height)?.data ?? null;
				}

				/*
				 * **Dieselbe Karte wird erst wieder gemeldet, wenn sie aus dem Bild
				 * war.**
				 *
				 * Ohne diese Regel bekäme die Sitzungsleitung dieselbe Karte in Serie:
				 * Sie bleibt nach dem Treffer noch Sekunden im Bild, und jeder
				 * Durchgang fände sie erneut. Am 20.08.2026 mit einer Kamera-Attrappe
				 * gemessen — nach «Verwerfen» stand die Karte sofort wieder da, und die
				 * Erfolgsmeldung eines Eintritts wurde vom nächsten Fund überschrieben.
				 *
				 * «War aus dem Bild» heisst: drei Durchgänge ohne Fund, also gut eine
				 * Drittelsekunde. Ein einzelner Aussetzer — eine Hand davor, ein
				 * unscharfes Bild — reicht dafür nicht.
				 */
				if (!inhalt) {
					leerlauf++;
					if (leerlauf >= 3) zuletzt = '';
				} else {
					leerlauf = 0;
					if (inhalt !== zuletzt) {
						zuletzt = inhalt;
						beiFund(inhalt);
					}
				}
			}
			await new Promise((r) => setTimeout(r, 120));
		}
	}

	onDestroy(schliesse);
</script>

<div class="scanner">
	{#if !offen}
		<button type="button" class="handlung" onclick={oeffne} disabled={!moeglich}>
			Karte mit der Kamera scannen
		</button>
		{#if !moeglich}
			<p class="klein">{grund}</p>
		{/if}
	{:else}
		<div class="sucher">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={video} playsinline muted></video>
			<p class="klein">Karte in den Rahmen halten. Erkannt wird sie von selbst.</p>
			<button type="button" class="handlung" onclick={schliesse}>Kamera schliessen</button>
		</div>
	{/if}
	{#if meldung}
		<p class="klein fehler" role="alert">{meldung}</p>
	{/if}
</div>

<style>
	.scanner {
		margin: 0.75rem 0;
	}

	.sucher {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}

	video {
		width: 100%;
		max-width: 24rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		/* themenfest: Schwarz hinter dem Kamerabild, damit kein Rand blitzt. */
		background: #000;
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
		max-width: 52ch;
		margin: 0.4rem 0 0;
	}

	.fehler {
		color: var(--fehler);
	}
</style>
