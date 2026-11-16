/**
 * Was ein Auswahlfeld anzeigt — und ab wann es eine Suche braucht.
 *
 * **Die Schwelle selbst steht im Kern** (`domain/listensuche.ts`, Umzug am
 * 27.08.2026): Seit auch die Listenseiten sie holen, wäre sie hier in der
 * Schale am falschen Ort, und die Schichtregel `kern-bleibt-rein` verbietet dem
 * Kern, sie sich hier zu holen. Wer sie braucht, nimmt sie von dort.
 */
import { vergleichsform } from '$lib/domain/historiesuche';

/** Ein Eintrag zur Wahl. `text` ist, was dasteht und wonach gesucht wird. */
export interface Auswahleintrag {
	/** Was das Formular schickt. */
	wert: string;
	/** Was dasteht. Danach wird gesucht. */
	text: string;
	/** Überschrift einer `<optgroup>`. Einträge ohne Gruppe stehen zuoberst. */
	gruppe?: string;
	/** Steht in der Liste, ist aber nicht wählbar — mit dem Grund im `text`. */
	deaktiviert?: boolean;
	/**
	 * Wonach ausserdem gesucht wird, ohne dass es dasteht.
	 *
	 * **Der Anlass** (Bedienbarkeitsprüfung 05.09.2026, dritter der schweren
	 * Befunde der Bewirtschaftersicht): Beim Hinterlegen einer Abweichung
	 * suchte der Prüfer «Erneuerungsfonds», «Beitrag», «Budget», «Fonds» — und
	 * bekam viermal «Kein Eintrag passt zur Suche». In der Liste stehen
	 * Geschäftsarten; der Fall «Erneuerungsfonds schaffen oder Beiträge
	 * festsetzen» steckt darunter und ist erst nach der Wahl der Art sichtbar.
	 * Er riet «Jahresgeschäfte» und legte damit eine Regel über vier Fälle an.
	 *
	 * Wer nach dem Fall sucht, soll die Art finden, unter der er steht.
	 */
	auchSuchen?: string;
}

/**
 * Prüft einen Auswahleintrag gegen alle Wörter der Suche.
 *
 * Gruppentitel sind sichtbarer Inhalt. Deshalb gehören sie in denselben
 * Suchtext wie die Beschriftung des Eintrags. Ein gemeinsames Prädikat hält
 * sichtbare Treffer und Trefferzähler deckungsgleich.
 */
export function passtZurAuswahlsuche(eintrag: Auswahleintrag, suche: string): boolean {
	const woerter = vergleichsform(suche).split(/\s+/).filter(Boolean);
	if (woerter.length === 0) return true;
	const suchtext = vergleichsform(
		`${eintrag.gruppe ?? ''} ${eintrag.text} ${eintrag.auchSuchen ?? ''}`
	);
	return woerter.every((wort) => suchtext.includes(wort));
}
