/**
 * Ein ZIP-Archiv wieder auseinandernehmen — nur für Prüfläufe.
 *
 * **Warum eigens und nicht mit einer Bibliothek.** Der Prüfling ist der eigene
 * Packer (`domain/archiv.ts`). Ihn mit demselben Code zu prüfen, mit dem er
 * gebaut wurde, bewiese nichts; eine Bibliothek dafür einzubinden brächte eine
 * Abhängigkeit in den Prüfstand, die im Betrieb nichts zu suchen hat. Der
 * Entpacker liest deshalb das zentrale Verzeichnis so, wie es ein fremdes
 * Werkzeug täte.
 *
 * Er kennt nur, was der Packer erzeugt: gespeicherte Einträge ohne Verdichtung.
 * Alles andere weist er ab, statt es zu erraten.
 */

function u16(b: Uint8Array, i: number): number {
	return b[i] | (b[i + 1] << 8);
}

function u32(b: Uint8Array, i: number): number {
	return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}

/** Pfad → Inhalt, in der Reihenfolge des zentralen Verzeichnisses. */
export function entpacke(archiv: Uint8Array): Map<string, Uint8Array> {
	// Das Ende des zentralen Verzeichnisses steht am Schluss, hinter einem
	// möglichen Kommentar. Rückwärts suchen ist der übliche Weg.
	let ende = -1;
	for (let i = archiv.length - 22; i >= 0; i--) {
		if (u32(archiv, i) === 0x06054b50) {
			ende = i;
			break;
		}
	}
	if (ende < 0) throw new Error('Kein ZIP: das Ende des Verzeichnisses fehlt.');

	const anzahl = u16(archiv, ende + 10);
	let stelle = u32(archiv, ende + 16);

	const dekodierer = new TextDecoder();
	const aus = new Map<string, Uint8Array>();

	for (let n = 0; n < anzahl; n++) {
		if (u32(archiv, stelle) !== 0x02014b50) throw new Error('Verzeichniseintrag beschädigt.');
		const verfahren = u16(archiv, stelle + 10);
		if (verfahren !== 0) throw new Error(`Unerwartetes Verdichtungsverfahren ${verfahren}.`);

		const groesse = u32(archiv, stelle + 24);
		const namenslaenge = u16(archiv, stelle + 28);
		const zusatz = u16(archiv, stelle + 30);
		const kommentar = u16(archiv, stelle + 32);
		const ort = u32(archiv, stelle + 42);
		const name = dekodierer.decode(archiv.subarray(stelle + 46, stelle + 46 + namenslaenge));

		// Am lokalen Kopf stehen eigene Längen; ohne sie fände man den Inhalt nicht.
		if (u32(archiv, ort) !== 0x04034b50) throw new Error(`Lokaler Kopf von «${name}» beschädigt.`);
		const lokalName = u16(archiv, ort + 26);
		const lokalZusatz = u16(archiv, ort + 28);
		const beginn = ort + 30 + lokalName + lokalZusatz;

		aus.set(name, archiv.subarray(beginn, beginn + groesse));
		stelle += 46 + namenslaenge + zusatz + kommentar;
	}

	return aus;
}
