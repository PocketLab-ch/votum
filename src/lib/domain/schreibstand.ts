/**
 * Zwei Fenster, ein Feld — und wer zuletzt speichert, gewinnt.
 *
 * **Der Anlass** (26.08.2026, aus dem Code-Review am Vorsitzfeld). Ein Formular,
 * das den eingetippten Wert schreibt, schreibt ihn über das, was inzwischen
 * dasteht. Wer die Seite offen liegen liess, während jemand anders eintrug,
 * setzt beim Speichern dessen Eintrag zurück — **ohne dass es einer der beiden
 * merkt**. Das ist kein Fehlerfall, den man abfangen könnte: Beide Vorgänge
 * waren für sich richtig.
 *
 * **Warum kein `updated_at` als Marke.** Naheliegend wäre, den Zeitstempel der
 * Zeile mitzuschicken und jede Abweichung abzulehnen. Dann meldet aber auch die
 * Änderung an einem **anderen** Feld derselben Zeile einen Konflikt — und ein
 * Wächter, der Richtiges meldet, wird weggeklickt. Verglichen wird deshalb, was
 * der Absender in **diesem** Feld zuletzt gesehen hat.
 *
 * **Die Regel hat drei Fälle**, und der dritte ist der wichtige:
 *
 *   1. Der Absender hat keinen Stand mitgeschickt → nicht geprüft. So setzt
 *      «meinen Text durchsetzen» den eigenen durch: Der Knopf lässt das Feld
 *      `bisher` schlicht weg. (Für ein gewöhnliches Formular gilt das **nicht** —
 *      ein `<input type="hidden">` schickt der Browser immer mit, auch ohne
 *      JavaScript. Dort wird also stets geprüft, und das ist richtig so.)
 *   2. Der gespeicherte Wert ist der, den er kannte → kein Konflikt.
 *   3. Der gespeicherte Wert ist **schon der neue** → ebenfalls kein Konflikt.
 *      Zweimal dasselbe zu schreiben ist keine Überschreibung; ohne diesen Fall
 *      meldete ein doppelter Klick einen Konflikt mit sich selbst.
 *
 * Das Muster stand seit dem 21.08.2026 in `server/protokoll.ts` und galt dort
 * für den Protokolltext. Hier steht es als Regel für alle Felder — dieselbe
 * Rechnung, damit sie nicht dreimal leicht verschieden dasteht.
 */

import { FachlicherFehler } from './fehler';

/** Der Stand, den der Absender kannte. `undefined` heisst «nicht mitgeschickt». */
export type Schreibstand = Record<string, string | undefined>;

/** Der Satz für ein Feld, das laufend sichert und beide Fassungen anbieten kann. */
export const KONFLIKTSATZ =
	'Dieser Text wurde inzwischen anderswo geändert — auf einem zweiten Gerät oder in einem ' +
	'zweiten Fenster. Er wurde nicht überschrieben.';

/**
 * Wurde anderswo geändert. Trägt den gespeicherten Stand mit sich.
 *
 * **Warum er ein `FachlicherFehler` ist** (26.08.2026, aus dem Code-Review).
 * Als eigenständiger `Error` fiel er durch alle 146 bestehenden
 * `instanceof FachlicherFehler`-Abfangstellen hindurch. Wer den Schutz an einem
 * weiteren Schreibweg anschaltet und den `catch`-Zweig der Route vergisst,
 * verwandelt damit einen sauber erkannten Konflikt in genau die rohe 500, gegen
 * die die andere Hälfte dieser Arbeit antritt. So gefangen wird er überall — und
 * wer den 409 statt des 400 will, fängt ihn eigens ab. Die Reihenfolge im
 * `catch` ist deshalb wichtig: **zuerst** `Schreibkonflikt`, dann
 * `FachlicherFehler`.
 *
 * **`aktuell` trägt nie `null`.** Ein leeres Feld ist «dort steht nichts», und
 * das ist eine Angabe. Käme es als `null` bei der Seite an, verschluckte es
 * dort das `??` im versteckten Feld und die Seite schickte wieder den alten
 * Stand — ein Konflikt, aus dem kein zweiter Versuch mehr herausführt.
 */
export class Schreibkonflikt extends FachlicherFehler {
	/** Was jetzt in der Datenbank steht, je Feld. Leer heisst leer, nie `null`. */
	readonly aktuell: Record<string, string>;

	constructor(aktuell: Record<string, string | null>, nachricht: string = KONFLIKTSATZ) {
		super('schreibkonflikt', nachricht);
		this.name = 'Schreibkonflikt';
		this.aktuell = Object.fromEntries(
			Object.entries(aktuell).map(([feld, wert]) => [feld, wert ?? ''])
		);
	}
}

/** Leeres Feld und fehlendes Feld sind dasselbe — die Datenbank kennt beides als NULL. */
function wert(x: string | null | undefined): string {
	return (x ?? '').trim();
}

/**
 * Welche Felder inzwischen anderswo geändert wurden.
 *
 * Leere Liste heisst: schreiben. Was mit einem Treffer geschieht, entscheidet
 * die aufrufende Stelle — der Satz dazu hängt davon ab, was die Oberfläche
 * anbieten kann (nochmals abschicken, den fremden übernehmen).
 */
export function veralteteFelder(
	gespeichert: Record<string, string | null>,
	bekannt: Schreibstand | undefined,
	neu: Record<string, string | null>
): string[] {
	if (!bekannt) return [];
	return Object.keys(neu).filter((feld) => {
		const kannte = bekannt[feld];
		if (kannte === undefined) return false;
		const jetzt = wert(gespeichert[feld]);
		return jetzt !== wert(kannte) && jetzt !== wert(neu[feld]);
	});
}

/**
 * Der Satz für ein gewöhnliches Formular.
 *
 * **Warum er sagt, was dort steht.** «Wurde inzwischen geändert» allein zwingt
 * zum Nachsehen an anderer Stelle — und wer nachsieht, verliert unterwegs, was
 * er getippt hatte. Der fremde Wert steht deshalb im Satz.
 *
 * **Und warum er zum zweiten Versuch auffordert.** Der Konflikt ist keine
 * Absage, sondern eine Rückfrage. Das Formular trägt danach den neuen Stand;
 * ein zweites Abschicken setzt die eigene Angabe durch — bewusst statt still.
 */
export function konfliktsatz(
	felder: string[],
	gespeichert: Record<string, string | null>,
	benennung: Record<string, string>
): string {
	const teile = felder.map((f) => {
		const jetzt = wert(gespeichert[f]);
		return `${benennung[f] ?? f}: ${jetzt === '' ? 'nichts mehr' : `«${jetzt}»`}`;
	});
	const was = felder.length === 1 ? 'Dort steht jetzt' : 'Dort stehen jetzt';
	return (
		'Jemand hat das in der Zwischenzeit anderswo geändert — in einem zweiten Fenster oder ' +
		`auf einem zweiten Gerät. ${was} ${teile.join(', ')}. Ihre Eingabe wurde nicht ` +
		'übernommen. Schicken Sie sie nochmals ab, wenn Ihre gelten soll.'
	);
}
