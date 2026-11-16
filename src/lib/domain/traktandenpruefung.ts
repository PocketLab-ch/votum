/**
 * Was ein Modell zu prüfen bekommt — und was es nie zu sehen bekommt (FR-58).
 *
 * **Rein und damit vorlegbar.** Der Auftrag an ein fremdes Haus ist der Ort,
 * an dem eine Zusage über Datensparsamkeit entweder gilt oder nicht. Sie
 * gehört deshalb in eine Funktion, die man hinlegen und lesen kann, und nicht
 * in eine Abfolge von Abfragen und Zeichenkettenverkettungen quer durch die
 * Schale (AD-1).
 *
 * **Ausgewählt, nicht ausgesiebt.** Es gibt keinen Schritt, der ein Traktandum
 * nimmt und Felder entfernt. Aufgebaut wird von null: drei Felder, dazu die
 * Titel der übrigen Traktanden für den Abgleich auf Widersprüche. Wer später
 * ein Feld hinzufügt, tut es hier sichtbar — beim Aussieben wäre ein neues Feld
 * stillschweigend mitgegangen.
 *
 * Nicht dabei: Einheiten, Wertquoten, Zuordnung zu Personen, Anhänge, der
 * Verlauf, die Beschlussfähigkeit. Nichts davon macht eine Prüfung auf
 * Verständlichkeit besser.
 */
import { KI_FUNKTIONSNAMEN, lesbareBefunde, type Befund } from './ki';

/** Was von einem Traktandum überhaupt prüfbar ist. */
export interface PruefbaresTraktandum {
	titel: string;
	inhalt?: string | null;
	antragswortlaut?: string | null;
	/** «abstimmung» oder «kenntnisnahme» — es ändert, was ein Mangel ist. */
	art: string;
}

export interface Pruefauftrag {
	/** Die Felder, die maskiert und übermittelt werden. */
	felder: { titel: string; inhalt: string; antragswortlaut: string; andere: string };
	system: string;
}

/**
 * Der Auftrag an das Modell.
 *
 * **Die Platzhalter werden erklärt.** Ohne Erklärung bemängelt ein Modell die
 * Maskierung selbst — «[Name 1] ist kein gültiger Platzhalter» — und verbraucht
 * damit einen Befund für nichts. Gemessen am 05.08.2026 gegen beide Stufen;
 * mit der Erklärung war der Einwand weg.
 */
export const PLATZHALTERHINWEIS =
	'Personen erscheinen als Platzhalter in eckigen Klammern: [Person 1] ist eine bestimmte ' +
	'Person, [Person 1b] dieselbe Person in anderer Schreibweise, [Name 1] jemand, der sich ' +
	'nicht eindeutig zuordnen liess. Das ist Absicht und kein Mangel des Textes — bemängle die ' +
	'Platzhalter nicht. Gib sie IMMER unverändert wieder und erfinde keine neuen.';

/**
 * Woraufhin geprüft wird — wörtlich aus FR-58.
 *
 * Die Liste steht im Auftrag **und** in der Oberfläche. Wer im Saal einen
 * Befund liest, soll nachlesen können, wonach überhaupt gesucht wurde; ein
 * Prüfergebnis ohne bekannten Prüfmassstab ist eine Meinung.
 */
export const PRUEFPUNKTE = [
	'verständliche Sprache — auch für jemanden ohne Vorkenntnisse',
	'eindeutiger Antragswortlaut',
	'mit Ja oder Nein entscheidbar',
	'vollständige Angaben für einen Beschluss: Gegenstand, Betrag, Zuständigkeit',
	'erkennbare Widersprüche zu anderen Traktanden derselben Versammlung'
] as const;

/**
 * Welche Punkte für diese Art überhaupt gelten.
 *
 * **Bei einer Kenntnisnahme fallen drei weg.** Es gibt keinen Antragswortlaut,
 * nichts ist mit Ja oder Nein zu entscheiden, und Angaben «für einen Beschluss»
 * braucht es nicht — es wird keiner gefasst. Sie trotzdem zu nennen, lädt zu
 * Befunden ein, die keine sind: «Verschiedenes» am Ende der Traktandenliste ist
 * übliche Praxis und kein Mangel. Wer zweimal einen Scheinbefund liest, hört
 * auf hinzusehen.
 */
export function pruefpunkteFuer(art: string): readonly string[] {
	if (art !== 'kenntnisnahme') return PRUEFPUNKTE;
	return [PRUEFPUNKTE[0], PRUEFPUNKTE[4]];
}

export function pruefauftrag(
	t: PruefbaresTraktandum,
	andereTitel: readonly string[]
): Pruefauftrag {
	const system = [
		`Du prüfst ein Traktandum einer Stockwerkeigentümerversammlung nach schweizerischem Recht (ZGB Art. 712a ff.).`,
		`Geprüft wird auf: ${pruefpunkteFuer(t.art).join('; ')}.`,
		...(t.art === 'kenntnisnahme'
			? [
					'Es handelt sich um eine Kenntnisnahme: Es wird berichtet, nicht beschlossen. ' +
						'Ein fehlender Antragswortlaut ist hier kein Mangel.'
				]
			: []),
		PLATZHALTERHINWEIS,
		// Ohne Vorschlag kein Befund: «irgendetwas stimmt nicht» ist für eine
		// Sitzungsleitung wertlos, die den Text jetzt verbessern soll.
		'Zu jedem Befund gehört ein konkreter Vorschlag, was stattdessen dastehen könnte.',
		'Ist nichts zu beanstanden, gib eine leere Liste zurück. Erfinde keine Mängel.',
		'Antworte ausschliesslich mit JSON, ohne Zäune und ohne Vorrede:',
		'{"befunde":[{"schwere":"hoch|mittel|tief","was":"…","vorschlag":"…"}]}'
	].join('\n');

	return {
		felder: {
			titel: t.titel,
			inhalt: t.inhalt ?? '',
			antragswortlaut: t.antragswortlaut ?? '',
			// Nur die Titel. Für den Abgleich auf Widersprüche genügt, worum es
			// geht; die Inhalte aller übrigen Traktanden mitzugeben, hiesse, die
			// halbe Versammlung zu übermitteln, um ein Traktandum zu prüfen.
			andere: andereTitel.join('\n')
		},
		system
	};
}

/** Der Text, der wirklich hinausgeht — auch für die Vorschau. */
export function auftragstext(felder: Pruefauftrag['felder'], art: string): string {
	const zeilen = [`Art: ${art === 'kenntnisnahme' ? 'Kenntnisnahme, keine Abstimmung' : 'Abstimmung'}`];
	zeilen.push(`Titel: ${felder.titel}`);
	if (felder.inhalt !== '') zeilen.push(`Inhalt: ${felder.inhalt}`);
	if (felder.antragswortlaut !== '') zeilen.push(`Antragswortlaut: ${felder.antragswortlaut}`);
	// Bei einer Kenntnisnahme ist der fehlende Wortlaut **kein** Mangel. Ihn
	// trotzdem als «(fehlt)» zu melden, lädt zu einem Befund ein, der keiner ist
	// — und wer zweimal einen solchen liest, ignoriert die Prüfung.
	else if (art !== 'kenntnisnahme') zeilen.push('Antragswortlaut: (fehlt)');
	if (felder.andere !== '') zeilen.push(`\nÜbrige Traktanden dieser Versammlung:\n${felder.andere}`);
	return zeilen.join('\n');
}

/**
 * Deutet die Antwort — und unterscheidet **nichts gefunden** von **nicht
 * lesbar**.
 *
 * **Der Unterschied ist keine Feinheit.** Beides sah gleich aus: «Nichts zu
 * beanstanden.» Eine Sitzungsleitung, die das liest, hält ihr Traktandum für
 * geprüft — dabei war die Antwort unbrauchbar und niemand hat hingesehen. Ein
 * Prüfergebnis, das im Zweifel Entwarnung gibt, ist schlimmer als keines.
 */
export function deuteAntwort(roh: unknown): { befunde: Befund[]; lesbar: boolean } {
	const lesbar =
		Array.isArray(roh) ||
		(typeof roh === 'object' &&
			roh !== null &&
			Array.isArray((roh as { befunde?: unknown }).befunde));
	return { befunde: lesbar ? lesbareBefunde(roh) : [], lesbar };
}

export interface Pruefergebnis {
	befunde: Befund[];
	/** Der Anbieter antwortete, aber nicht in verwertbarer Form. */
	unlesbar?: boolean;
	/** Wörtlich, was übermittelt wurde — die Vorschau nach dem Senden. */
	hinausgegangen: string;
	/** Wie viele Namen dabei ersetzt wurden. */
	namenGeschuetzt: number;
	/** Welche Stufe geantwortet hat, für den Nachweis und die Anzeige. */
	stufe: string | null;
	dauerMs: number;
	nutzungId: string | null;
	/** Wenn es nicht ging: warum. Nie ein Abbruch (FR-62). */
	fehlschlaege: string[];
}

/** Der Satz über einem Prüfergebnis. Er nennt Haus und Grenze in einem Zug. */
export function ergebnissatz(e: Pruefergebnis): string {
	if (e.stufe === null) {
		return `${KI_FUNKTIONSNAMEN.traktandenpruefung} nicht möglich: ${e.fehlschlaege.join(' · ')}`;
	}
	if (e.unlesbar === true) {
		return `Die Antwort war nicht lesbar — ${e.stufe}. Am Traktandum ändert das nichts.`;
	}
	const zeit = `${(e.dauerMs / 1000).toFixed(1)} s`;
	const namen =
		e.namenGeschuetzt === 0
			? 'keine Namen im Text'
			: e.namenGeschuetzt === 1
				? '1 Name ersetzt'
				: `${e.namenGeschuetzt} Namen ersetzt`;
	const zahl =
		e.befunde.length === 0
			? 'nichts zu beanstanden'
			: e.befunde.length === 1
				? '1 Befund'
				: `${e.befunde.length} Befunde`;
	return `${zahl} — ${e.stufe}, ${zeit}, ${namen}`;
}
