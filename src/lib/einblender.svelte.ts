/**
 * Die Sammelstelle für Erfolgsmeldungen — unten rechts, gestapelt.
 *
 * **Der Wunsch** (Auftraggeber, 21.08.2026): «kann man die Infofenster, also wenn eine
 * Aktion erfolgreich war nicht in eine […] in ein Fenster das unten rechts
 * aufpoppt, mit der Info das man wegklicken kann oder selbst verschwindet. Wenn
 * mehrere Infons sind reiht es sich auf und verschwindet nach der Zeit oder
 * wird weggeklickt.»
 *
 * **Warum nur Erfolge.** Eine Erfolgsmeldung ist eine Quittung: gelesen,
 * abgehakt, weg. Sie steht bisher über dem Inhalt und schiebt ihn nach unten —
 * in der Sitzungsleitung bei jedem Handgriff. Eine **Absage** ist etwas
 * anderes: Sie hält auf, nennt einen Weg und muss so lange stehen, bis jemand
 * ihn geht. Was von selbst verschwindet, taugt dafür nicht.
 *
 * Deshalb wandert nur `ton="gut"` hierher; `fehler` und `warnung` bleiben, wo
 * sie sind.
 *
 * **Ohne JavaScript** bleibt auch die Erfolgsmeldung an ihrem Platz stehen —
 * `Meldung.svelte` rendert sie beim Aufbau auf dem Server ganz normal und gibt
 * sie erst im Browser hierher weiter. Ein Rückschritt ist das nicht: So war es
 * vorher überall.
 */

export interface Einblendung {
	/** Fortlaufend, damit `{#each}` einen Schlüssel hat. */
	id: number;
	text: string;
}

/**
 * Wie lange eine Meldung steht.
 *
 * Sechs Sekunden: lang genug, um einen Satz zu lesen, ohne den Blick zu heben;
 * kurz genug, dass beim nächsten Handgriff nichts mehr im Weg ist. Wer schneller
 * ist, klickt sie weg.
 */
export const DAUER = 6000;

let naechste = 0;

/**
 * Die offenen Einblendungen.
 *
 * `$state` in einer `.svelte.ts`-Datei: Die Liste wird von mehreren Bausteinen
 * gefüllt und von einem angezeigt — ein gemeinsamer Zustand, kein Eigentum
 * einer Komponente.
 */
export const einblendungen = $state<Einblendung[]>([]);

/** Zeigt eine Meldung an und lässt sie nach `DAUER` von selbst verschwinden. */
export function einblenden(text: string): void {
	const id = ++naechste;
	einblendungen.push({ id, text });
	setTimeout(() => schliessen(id), DAUER);
}

export function schliessen(id: number): void {
	const i = einblendungen.findIndex((e) => e.id === id);
	if (i >= 0) einblendungen.splice(i, 1);
}
