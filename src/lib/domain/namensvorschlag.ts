/**
 * Welche Partei jemand sein könnte, der sich über den Beamer gemeldet hat.
 *
 * **Der Fall.** Am QR auf der Leinwand tippt jemand seinen Namen ein — «Meier
 * Hans», «H. Meier», «Maier». Die Sitzungsleitung muss ihn in einer Liste von
 * vierzehn Parteien finden, während er vor ihr steht. Ein Suchfeld hilft nur,
 * wer richtig tippt; ein Vorschlag hilft auch dem, der nicht weiss, wie der
 * Name in den Stammdaten geschrieben ist.
 *
 * **Vorschlagen, nie vorwählen** (dieselbe Regel wie beim Personenabgleich).
 * Ein automatisch gesetzter Treffer wäre bequem und gefährlich: «Meier» gibt es
 * in einer Überbauung dreimal, und im Gedränge am Eingang bestätigt man, was
 * dasteht. Diese Datei sagt deshalb, was ihr auffällt, **mit dem Grund** — und
 * die Sitzungsleitung entscheidet.
 *
 * **Der Grund gehört sichtbar dazu.** «Name stimmt» ist eine andere Aussage als
 * «unterscheidet sich in einem Buchstaben», und wer nur einen hervorgehobenen
 * Eintrag sieht, kann die beiden nicht unterscheiden.
 *
 * Reine Rechnerei, kein I/O (AD-1).
 */

/** Wie sicher ein Vorschlag ist. Die Reihenfolge ist die Rangfolge. */
export type Trefferart =
	/** Nach Vereinheitlichung genau derselbe Name. */
	| 'gleich'
	/** Dieselben Wörter, andere Reihenfolge: «Meier Hans» ↔ «Hans Meier». */
	| 'umgestellt'
	/** Ein Wort weniger, aber alle vorhandenen stimmen: «Meier» ↔ «Hans Meier». */
	| 'teil'
	/** Bis auf wenige Zeichen gleich — Tippfehler, Umlautschreibung. */
	| 'aehnlich';

export interface Namensvorschlag {
	parteiId: string;
	name: string;
	art: Trefferart;
	/** Steht so auf dem Bildschirm, hinter dem Namen. */
	grund: string;
}

/**
 * Vereinheitlicht, was am selben Namen verschieden geschrieben werden kann.
 *
 * Umlaute wandern auf ihre zweibuchstabige Form, weil beide Schreibweisen
 * derselbe Name sind — «Probère» tippt am Telefon niemand mit Accent.
 */
export function vereinheitliche(wert: string): string {
	return (wert ?? '')
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.normalize('NFD')
		// Zeichen ohne eigene Bedeutung im Namen: Accents, Bindestriche, Punkte.
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function woerter(wert: string): string[] {
	return vereinheitliche(wert).split(' ').filter(Boolean);
}

/**
 * Der Abstand zweier Zeichenketten (Levenshtein), gedeckelt.
 *
 * Gedeckelt, weil nur kleine Abstände interessieren: Ab drei Abweichungen ist
 * es kein Tippfehler mehr, sondern ein anderer Name — und die Rechnung darf
 * dann früh aufhören.
 */
export function abstand(a: string, b: string, deckel = 3): number {
	if (a === b) return 0;
	if (Math.abs(a.length - b.length) > deckel) return deckel + 1;

	let vorige = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const jetzt = [i];
		let kleinste = i;
		for (let j = 1; j <= b.length; j++) {
			const kosten = a[i - 1] === b[j - 1] ? 0 : 1;
			jetzt[j] = Math.min(vorige[j] + 1, jetzt[j - 1] + 1, vorige[j - 1] + kosten);
			kleinste = Math.min(kleinste, jetzt[j]);
		}
		// Ganze Zeile schon über dem Deckel: Es kann nur noch schlechter werden.
		if (kleinste > deckel) return deckel + 1;
		vorige = jetzt;
	}
	return vorige[b.length];
}

export interface Wahlpartei {
	parteiId: string;
	name: string;
}

/**
 * Wie viele Zeichen abweichen dürfen, damit es noch ein Tippfehler ist.
 *
 * An der Länge bemessen: Bei «Ott» wäre ein Zeichen Abweichung schon ein
 * anderer Name («Ort»), bei «Bergmann-Steiner» sind zwei harmlos.
 */
function erlaubterAbstand(laenge: number): number {
	if (laenge <= 4) return 0;
	if (laenge <= 8) return 1;
	return 2;
}

/**
 * Die besten Vorschläge zu einem behaupteten Namen.
 *
 * Gibt höchstens drei zurück: Wer vier gleichwertige Vorschläge sieht, liest
 * sie nicht mehr, sondern sucht wieder selbst — und dann hat die Liste nichts
 * gebracht.
 */
export function schlageVor(
	behauptet: string,
	parteien: readonly Wahlpartei[],
	hoechstens = 3
): Namensvorschlag[] {
	const gesucht = vereinheitliche(behauptet);
	// zeichenzahl-frei: Ähnlichkeitssuche, keine Eingabeschranke.
	if (gesucht.length < 2) return [];
	const gesuchteWoerter = woerter(behauptet);

	const rang: Record<Trefferart, number> = { gleich: 0, umgestellt: 1, teil: 2, aehnlich: 3 };
	const treffer: Namensvorschlag[] = [];

	for (const p of parteien) {
		const name = vereinheitliche(p.name);
		if (!name) continue;
		const namensWoerter = woerter(p.name);

		if (name === gesucht) {
			treffer.push({ ...p, art: 'gleich', grund: 'Name stimmt' });
			continue;
		}

		const sortiert = (w: string[]) => [...w].sort().join(' ');
		if (sortiert(gesuchteWoerter) === sortiert(namensWoerter)) {
			treffer.push({ ...p, art: 'umgestellt', grund: 'Name stimmt, andere Reihenfolge' });
			continue;
		}

		// Alle genannten Wörter kommen vor, aber es fehlt eines: «Meier» zu
		// «Hans Meier». Mindestens ein Wort muss lang genug sein — sonst passte
		// «von» auf jede Partei mit «von» im Namen.
		const alleEnthalten =
			gesuchteWoerter.length > 0 &&
			gesuchteWoerter.every((w) => namensWoerter.includes(w)) &&
			// zeichenzahl-frei: Ähnlichkeitssuche, keine Eingabeschranke.
			gesuchteWoerter.some((w) => w.length >= 3);
		if (alleEnthalten) {
			treffer.push({ ...p, art: 'teil', grund: 'Teil des Namens stimmt' });
			continue;
		}

		const d = abstand(gesucht, name);
		if (d > 0 && d <= erlaubterAbstand(Math.max(gesucht.length, name.length))) {
			treffer.push({
				...p,
				art: 'aehnlich',
				grund: d === 1 ? 'unterscheidet sich in einem Zeichen' : `unterscheidet sich in ${d} Zeichen`
			});
		}
	}

	return treffer
		.sort((a, b) => rang[a.art] - rang[b.art] || a.name.localeCompare(b.name, 'de'))
		.slice(0, hoechstens);
}
