/**
 * Kontrast messen — an dem, was der Browser wirklich zeichnet.
 *
 * **Warum als eigener Baustein** (Code-Review 01.09.2026). `themenkontrast.mjs`
 * geht die Seiten im dunklen Thema durch, kommt aber nicht an jede: Die
 * Wahlknöpfe am Telefon stehen erst da, wenn eine Abstimmung offen ist, und
 * dorthin fährt `durchspielen.mjs`. Gemessen wird deshalb an beiden Stellen
 * dasselbe, mit demselben Code — zwei Rechnungen für eine Frage laufen
 * auseinander.
 *
 * **Der Anlass für den zweiten Aufrufer.** Der «Nein»-Knopf im Saal trug
 * `background: var(--fehler)` ohne Gegenfarbe und erbte `--text`: Kontrast 2.14
 * im hellen und 2.16 im dunklen Thema. Beide Farben sind saubere Token, der
 * Quellwächter kann das also nicht finden — nur eine Messung am gezeichneten
 * Bild.
 *
 * Zurück kommt `{ gemessen, treffer }`: wie viele Textstellen angesehen wurden
 * und welche unter der Schranke liegen.
 */
export async function messeKontrast(seite, schranke, auswahl = 'body *') {
	return seite.evaluate(
		({ schranke, auswahl }) => {

	const zahlen = (s) => (s.match(/-?[\d.]+/g) ?? []).map(Number);
	const leuchtkraft = ([r, g, b]) => {
		const f = (c) => {
			const v = c / 255;
			return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
		};
		return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
	};
	const mischen = (vorn, hinten, alpha) =>
		[0, 1, 2].map((i) => vorn[i] * alpha + hinten[i] * (1 - alpha));
	const abstand = (a, b) => {
		const la = leuchtkraft(a);
		const lb = leuchtkraft(b);
		return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
	};

	/** Der erste Vorfahre mit deckender Fläche — der Grund, auf dem der Text steht. */
	const grundVon = (k) => {
		let grund = [255, 255, 255];
		const kette = [];
		for (let e = k; e; e = e.parentElement) kette.push(e);
		// Von aussen nach innen mischen: Halbdurchsichtiges legt sich darüber.
		for (const e of kette.reverse()) {
			const w = zahlen(getComputedStyle(e).backgroundColor);
			if (w.length < 3) continue;
			const alpha = w.length > 3 ? w[3] : 1;
			if (alpha === 0) continue;
			grund = mischen(w.slice(0, 3), grund, alpha);
		}
		return grund;
	};

	const treffer = [];
	let gemessen = 0;
	for (const k of document.querySelectorAll(auswahl)) {
		// Nur Elemente mit EIGENEM Text: Sonst wird jeder Vorfahre noch einmal
		// für denselben Satz gemeldet.
		const eigen = [...k.childNodes]
			.filter((n) => n.nodeType === 3)
			.map((n) => n.textContent.trim())
			.join(' ')
			.trim();
		if (!eigen) continue;

		const r = k.getBoundingClientRect();
		if (r.width < 2 || r.height < 2) continue;
		const stil = getComputedStyle(k);
		if (stil.visibility === 'hidden' || stil.display === 'none' || Number(stil.opacity) < 0.1)
			continue;
		// Weggeschnittenes hört nur der Bildschirmleser — dort gibt es keine Farbe.
		if (stil.clipPath !== 'none' && r.width <= 2) continue;

		const vorn = zahlen(stil.color);
		if (vorn.length < 3) continue;
		const alpha = vorn.length > 3 ? vorn[3] : 1;
		if (alpha < 0.1) continue;
		const grund = grundVon(k);
		const schrift = mischen(vorn.slice(0, 3), grund, alpha);

		gemessen++;
		const wert = abstand(schrift, grund);
		if (wert < schranke) {
			treffer.push({
				wert: Math.round(wert * 100) / 100,
				wie:
					k.tagName.toLowerCase() +
					(k.className && typeof k.className === 'string'
						? `.${k.className.split(' ').filter(Boolean).slice(0, 2).join('.')}`
						: ''),
				schrift: stil.color,
				grund: `rgb(${grund.map((c) => Math.round(c)).join(' ')})`,
				text: eigen.replace(/\s+/g, ' ').slice(0, 60)
			});
		}
	}
			return { gemessen, treffer };
		},
		{ schranke, auswahl }
	);
}
