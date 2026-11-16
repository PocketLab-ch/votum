/**
 * Der gemeinsame Pausenstand eines Abends — aus den Ständen der Häuser.
 *
 * **Warum das eine eigene Rechnung ist.** Am gemeinsamen Abend hat jedes Haus
 * seinen eigenen `paused_at` (AD-10: geschrieben wird je Versammlung). Der Saal
 * hat aber nur eine Pause: Wer unterbricht, unterbricht den Raum. Die Frage
 * «ist unterbrochen?» ist deshalb nicht die Frage eines Hauses, sondern eine
 * Rechnung über alle.
 *
 * **Was hier schon zweimal schiefging.**
 *
 * 1. Ein `Set` über die Pausenobjekte war bei zwei unterbrochenen Häusern immer
 *    zwei gross, weil `holeVersammlung` je Aufruf ein frisches Objekt baut
 *    (Code-Review 24.08.2026).
 * 2. Der Ersatz verglich die **Zeitstempel**. Die unterscheiden sich aber
 *    zwangsläufig: `setzePause` läuft je Haus in einer eigenen Transaktion, und
 *    `now()` ist die Startzeit der Transaktion. Zwei Häuser bekommen nie
 *    dieselbe Mikrosekunde. Der Knopf «Fortfahren» erschien damit nie, und
 *    `paused_at` sperrt jede Stimmabgabe: Der Abend stand (01.09.2026).
 *
 * Die Klasse dahinter ist dieselbe: **Einigkeit über einen Zustand darf nicht
 * über seinen Zeitstempel gemessen werden.** Verglichen wird deshalb hier, an
 * einer Stelle, das Einzige, was der Saal sieht — unterbrochen oder nicht.
 *
 * **Nur laufende Häuser zählen.** Ein geschlossenes Haus behält seinen
 * `paused_at`; nichts löscht ihn beim Schliessen. Zählte es mit, hinge die
 * Pause nach dem Schluss für immer an der Wand, und `setzePause` könnte sie
 * nicht mehr lösen: Unterbrechen und Fortfahren verlangen den Zustand
 * «laufend». Ein Haus, das nicht läuft, hat keine Pause.
 *
 * Rein: hinein geht die Lage, heraus kommt der Stand. Kein Zugriff auf
 * Datenbank oder Uhr (AD-1).
 */

/** Was ein Haus zum gemeinsamen Pausenstand beiträgt. */
export interface Hauslage {
	/** Der Zustand der Versammlung — nur «laufend» trägt eine Pause. */
	zustand: string | null | undefined;
	/** Seit wann dieses Haus unterbrochen ist, mit dem Text für die Wand. */
	pause: { seit: string; text?: string | null } | null | undefined;
}

export interface GemeinsamerPausenstand {
	/**
	 * Die Unterbrechung des Abends, oder `null`.
	 *
	 * Genommen wird die **früheste** unter den laufenden Häusern: Die Pause
	 * begann, als das erste Haus unterbrach, und der Text, den die Wand zeigt,
	 * ist der, der zuerst gesetzt wurde.
	 */
	pause: { seit: string; text: string | null } | null;
	/**
	 * Ob alle laufenden Häuser denselben Stand haben.
	 *
	 * `false` heisst: eines ist unterbrochen, ein anderes nicht. Das kommt vor,
	 * wenn ein Haus einzeln unterbrochen wurde oder wenn `setzePause` bei einem
	 * Haus nicht durchging. Die Sitzungsleitung soll das lesen können — der
	 * Knopf gleicht sie an.
	 */
	einig: boolean;
}

export function gemeinsamePause(haeuser: Hauslage[]): GemeinsamerPausenstand {
	const laufende = haeuser.filter((h) => h.zustand === 'laufend');
	if (laufende.length === 0) return { pause: null, einig: true };

	const unterbrochene = laufende
		.map((h) => h.pause)
		.filter((p): p is { seit: string; text?: string | null } => Boolean(p))
		.sort((a, b) => (a.seit < b.seit ? -1 : a.seit > b.seit ? 1 : 0));

	const frueheste = unterbrochene[0];
	return {
		pause: frueheste ? { seit: frueheste.seit, text: frueheste.text ?? null } : null,
		einig: unterbrochene.length === 0 || unterbrochene.length === laufende.length
	};
}
