/**
 * Wie viele Nachweise ein Absenden mitnehmen darf, für Server und Oberfläche.
 *
 * **Woher die Zahl kommt** (Produktentscheid 16.10.2026, Auftrag Abschluss,
 * B3). Der Betrieb nimmt Anfragen bis `BODY_SIZE_LIMIT` 52M an
 * (`compose.prod.yml`), eine Datei darf bis 10 MB gross sein. Fünf volle
 * Dateien sind 50 MB; die zwei übrigen tragen den Rest des Formulars (der
 * Wächter verlangt davon mindestens 1 MB).
 * `tests/domain/anfragegrenze.test.ts` wird rot, wenn das nicht mehr aufgeht.
 *
 * **Warum die Oberfläche es vorher sagen muss.** Was über 52M geht, weist
 * adapter-node mit der nackten 413-Seite ab, **bevor** die Aktion läuft. Die
 * Prüfung im Server greift also nur unterhalb der Grenze, etwa bei sechs
 * kleinen Fotos. Bei sechs grossen Scans hilft nur die Prüfung im Browser,
 * die das Absenden gar nicht erst zulässt.
 *
 * Liegt ausserhalb von `$lib/server`, weil der Browser dieselbe Zahl braucht.
 * **`HOECHSTGROESSE` gilt für jede Ablage**, nicht nur für Nachweise
 * (`$lib/server/dateien` reicht sie weiter): Wer sie ändert, ändert die Grenze
 * aller Hochladewege und muss die Rechnung oben neu machen.
 */
import type { Attachment } from 'svelte/attachments';

/** Höchstgrösse je Datei. Nutzniessungsverträge, Anträge und Offerten sind Textdokumente. */
export const HOECHSTGROESSE = 10 * 1024 * 1024;

/** Höchstzahl der Nachweise je Absenden. */
export const HOECHSTZAHL_JE_ABSENDEN = 5;

const MB = Math.round(HOECHSTGROESSE / 1024 / 1024);

/** Der Hinweis neben dem Dateifeld, damit die Grenze vor dem Absenden bekannt ist. */
export const GRENZHINWEIS = `Höchstens ${HOECHSTZAHL_JE_ABSENDEN} Dateien auf einmal, je bis ${MB} MB.`;

/** Die Absage, wenn mehr gewählt sind. Gleicher Satz im Browser und im Server. */
export const ZU_VIELE =
	`Höchstens ${HOECHSTZAHL_JE_ABSENDEN} Dateien auf einmal. ` +
	'Wählen Sie weniger und reichen Sie die übrigen danach unter «Vollmachten» nach, je Vollmacht.';

/** Die Absage im Browser für eine einzelne zu grosse Datei. */
function zuGrossImBrowser(name: string): string {
	return `«${name}» ist grösser als ${MB} MB. Wählen Sie eine kleinere Datei oder ein Foto.`;
}

/**
 * Was an dieser Auswahl nicht durchginge, als Satz; leer, wenn alles passt.
 *
 * Nimmt nur, was Grösse und Name hat, damit es im Browser (`FileList`) und in
 * der Prüfung gleich läuft.
 */
export function grenzverstoss(dateien: ArrayLike<{ size: number; name: string }>): string {
	const liste = Array.from(dateien).filter((d) => d.size > 0);
	if (liste.length > HOECHSTZAHL_JE_ABSENDEN) return ZU_VIELE;
	const zuGross = liste.find((d) => d.size > HOECHSTGROESSE);
	return zuGross ? zuGrossImBrowser(zuGross.name) : '';
}

/**
 * Hält das Absenden an, solange die Auswahl die Grenze überschreitet.
 *
 * Über die eingebaute Gültigkeit des Felds (`setCustomValidity`): Der Browser
 * lässt ein Formular mit ungültigem Feld nicht abgehen und zeigt den Satz am
 * Feld, auch ohne `use:enhance`.
 *
 * ```svelte
 * <input type="file" name="nachweis" multiple {@attach nachweisgrenze} />
 * ```
 */
export const nachweisgrenze: Attachment<HTMLInputElement> = (feld) => {
	const pruefe = () => {
		const satz = grenzverstoss(feld.files ?? []);
		feld.setCustomValidity(satz);
		if (satz) feld.reportValidity();
	};
	feld.addEventListener('change', pruefe);
	return () => feld.removeEventListener('change', pruefe);
};
