import { error, isHttpError } from '@sveltejs/kit';
import { EINGABE_MIT_NUL, enthaeltNul } from '$lib/domain/steuerzeichen';

/**
 * Lässt `formData()` und `json()` dieser Anfrage mit 400 absagen, sobald ein
 * Textwert ein NUL-Zeichen trägt (siehe `domain/steuerzeichen.ts`).
 *
 * **Warum die Lesewege ersetzt werden, statt den Rumpf vorweg zu lesen.** Die
 * 265 Aktionen lesen ihr Formular selbst. Ein Wächter, der vorher eine Kopie
 * liest (`request.clone()`), hielte den Rumpf zweimal im Speicher, bei einer
 * Datei bis 52M, und genau dieser Speicher ist schon ohne Grenze
 * gleichzeitiger Anfragen (`docs/pendenzen-sicherheit.md`, K1); der
 * Speicherdeckel des Containers fängt nur die Summe ab. So wird jeder Rumpf einmal gelesen,
 * von dem, der ihn ohnehin liest.
 *
 * **Dateien bleiben unberührt**, nur ihr Name wird geprüft: Binärinhalt trägt
 * NUL-Bytes zu Recht und geht nie als Text in die Datenbank.
 *
 * `error(400)` aus einer Aktion ist ein kontrollierter Ausgang von SvelteKit,
 * keine rohe Ausnahme: `use:enhance` bekommt `{ type: 'error' }` mit Status,
 * die Navigation die Fehlerseite.
 */
export function sperreNulImRumpf(anfrage: Request): void {
	const formData = anfrage.formData.bind(anfrage);
	const json = anfrage.json.bind(anfrage);

	Object.defineProperty(anfrage, 'formData', {
		value: async () => {
			const daten = await formData();
			for (const [name, wert] of daten) {
				if (enthaeltNul(name) || enthaeltNul(typeof wert === 'string' ? wert : wert.name)) {
					error(400, EINGABE_MIT_NUL);
				}
			}
			return daten;
		}
	});
	Object.defineProperty(anfrage, 'json', {
		value: async () => {
			const daten: unknown = await json();
			if (enthaeltNul(daten)) error(400, EINGABE_MIT_NUL);
			return daten;
		}
	});
}

/**
 * Für `.catch(...)` an einem Leseweg, der einen unlesbaren Rumpf durch einen
 * Ersatz deckt: Die Absage oben fängt er nicht mit.
 *
 * **Der Anlass** (Codeprüfung, 27.10.2026). `karten.pdf` und `versandpaket.zip`
 * lasen mit `.catch(() => new FormData())`. Die Absage wäre dort zum leeren
 * Formular geworden, und das heisst dort «Zugänge für alle, die noch keinen
 * haben»: Aus einer gezielten Auswahl mit NUL wäre still ein Schreiben ohne
 * Auftrag geworden.
 */
export function ausserAbsage<T>(ersatz: T): (fehler: unknown) => T {
	return (fehler) => {
		if (isHttpError(fehler)) throw fehler;
		return ersatz;
	};
}
