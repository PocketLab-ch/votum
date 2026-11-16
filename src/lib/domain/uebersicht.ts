/**
 * Die offenen Punkte der Übersicht (Story 6.1, FR-64).
 *
 * **Ein offener Punkt nennt die Sache, nicht den Zustand.** «Versammlung
 * unvollständig» ist keine Auskunft — wer das liest, muss suchen gehen, und
 * genau das soll die Übersicht ersparen. Jeder Punkt sagt deshalb, was fehlt, wo
 * es fehlt und wohin zu gehen ist.
 *
 * **Zwei Stufen, weil der Unterschied im Betrieb zählt.** Ein Hindernis macht
 * etwas falsch, ohne dass es auffällt — ein nicht aufgehender Wertquotensaldo
 * lässt jede Auszählung eine Mehrheit ausrechnen, nur die falsche. Eine Aufgabe
 * ist bloss noch nicht erledigt. Beides gleich darzustellen hiesse, die
 * Aufmerksamkeit dort zu verbrauchen, wo sie nicht nötig ist.
 *
 * Rein: die Schale erhebt die Befunde, der Kern formuliert sie (AD-1).
 */

export type Punktstufe = 'hindernis' | 'aufgabe';

export interface OffenerPunkt {
	kennung: string;
	stufe: Punktstufe;
	/** Woran es hängt: Gemeinschaft oder Versammlung, so wie es dasteht. */
	bezug: string;
	text: string;
	/** Wohin die Sitzungsleitung muss. Ein Klick, kein Suchen. */
	pfad: string;
}

export interface Uebersichtslage {
	/** Gemeinschaften, deren Wertquoten nicht aufgehen. */
	quotensaldo: { stwegId: string; name: string; abweichung: number }[];
	/** Freigegebene Versammlungen ohne einen einzigen erzeugten Zugang. */
	ohneZugaenge: { meetingId: string; bezeichnung: string }[];
	/** Versammlungen mit Anträgen ohne bestimmtes Mehrheitserfordernis. */
	ohneErfordernis: { meetingId: string; bezeichnung: string; anzahl: number }[];
	/** Geschlossene Versammlungen, für die noch keine Auswertung erzeugt wurde. */
	ohneAuswertung: { meetingId: string; bezeichnung: string }[];
	/**
	 * Versiegelt, aber ohne Bezeugung von aussen (FR-53). Steht hier, weil ein
	 * offener Zeitstempel sonst niemandem auffiele: Die Seite, auf der er steht,
	 * ruft nach dem Abschluss niemand mehr auf.
	 */
	zeitstempelOffen: { meetingId: string; bezeichnung: string }[];
}

export function offenePunkte(lage: Uebersichtslage): OffenerPunkt[] {
	const punkte: OffenerPunkt[] = [];

	for (const g of lage.quotensaldo) {
		punkte.push({
			kennung: 'quotensaldo',
			stufe: 'hindernis',
			bezug: g.name,
			text:
				`Die Wertquoten gehen nicht auf: ${g.abweichung > 0 ? `es fehlen ${g.abweichung}` : `es sind ${-g.abweichung} zu viel`} ` +
				'Anteile. Solange das so ist, rechnet jede Auszählung nach Wertquoten auf einer falschen ' +
				'Bezugsgrösse — und käme trotzdem zu einem Ergebnis.',
			pfad: `/gemeinschaften/${g.stwegId}/einheiten`
		});
	}

	for (const v of lage.ohneZugaenge) {
		punkte.push({
			kennung: 'ohne_zugaenge',
			stufe: 'aufgabe',
			bezug: v.bezeichnung,
			text:
				'Die Versammlung ist freigegeben, es ist aber noch kein Zugang erzeugt. Ohne QR-Blatt ' +
				'kann sich im Saal niemand anmelden.',
			pfad: `/versammlungen/${v.meetingId}/zugaenge`
		});
	}

	for (const v of lage.ohneErfordernis) {
		punkte.push({
			kennung: 'ohne_erfordernis',
			stufe: 'aufgabe',
			bezug: v.bezeichnung,
			text:
				`${v.anzahl === 1 ? 'Ein Antrag hat' : `${v.anzahl} Anträge haben`} noch kein ` +
				'Mehrheitserfordernis. Nachholbar ist das bis zur Abstimmung — danach lässt sich nicht ' +
				'mehr sagen, ob der Antrag angenommen ist.',
			pfad: `/versammlungen/${v.meetingId}/traktanden`
		});
	}

	for (const v of lage.ohneAuswertung) {
		punkte.push({
			kennung: 'ohne_auswertung',
			stufe: 'aufgabe',
			bezug: v.bezeichnung,
			text:
				'Die Versammlung ist geschlossen, die Auswertung aber noch nicht erzeugt. Sie ist die ' +
				'Grundlage des Protokolls.',
			pfad: `/versammlungen/${v.meetingId}/auswertung`
		});
	}

	for (const v of lage.zeitstempelOffen) {
		punkte.push({
			kennung: 'zeitstempel_offen',
			stufe: 'aufgabe',
			bezug: v.bezeichnung,
			text:
				'Das Abschlusspaket ist versiegelt, aber noch nicht von aussen bezeugt. Das Siegel gilt ' +
				'auch so; der Zeitstempel macht es gegenüber Dritten stärker und lässt sich nachholen, ' +
				'sobald wieder Verbindung besteht.',
			pfad: `/versammlungen/${v.meetingId}/siegel`
		});
	}

	// Hindernisse zuerst: Sie stehen für etwas, das gerade falsch läuft, die
	// Aufgaben nur für etwas, das noch aussteht.
	return punkte.sort((a, b) => (a.stufe === b.stufe ? 0 : a.stufe === 'hindernis' ? -1 : 1));
}
