/**
 * Die winzige Auszeichnung des Protokolltextes — an einer Stelle.
 *
 * **Warum dieses Modul entstand** (05.09.2026). Die Erkennung stand zweimal im
 * Haus: in `domain/docx.ts` und in `server/pdf/protokoll.ts`, letztere mit
 * gleich drei Kommentaren «dieselbe Regel wie in `domain/docx.ts`». Ein
 * Kommentar, der eine Gleichheit behauptet, hält sie nicht. Mit dem
 * weiteren Ausgabeformat wäre daraus die dritte Fassung geworden, und
 * spätestens dann laufen sie auseinander: Der Kopf des Protokolls sähe je nach
 * Format anders aus, ohne dass jemand etwas geändert hätte.
 *
 * **Was hier steht und was nicht.** Hier steht, *was* eine Zeile ist. Wie sie
 * gesetzt wird, entscheidet jedes Format für sich — das PDF setzt Zeile für
 * Zeile mit eigenen Abständen, die beiden Bürodokumente bündeln
 * zusammenhängende Tabellenzeilen zu einer Tabelle.
 *
 * **Der Zerleger ist deshalb nur für die Bürodokumente** (`zerlegeInBausteine`). Ihn auch dem PDF zu geben wäre der naheliegende,
 * aber falsche Schritt: Es behält jede Leerzeile und rückt dafür um drei
 * Millimeter ab, während die Bürodokumente überflüssige Leerzeilen wegwerfen,
 * weil dort die Vorlagen den Abstand tragen. Eine gemeinsame Zerlegung hätte
 * den Satzspiegel des PDF verändert, ohne dass es im Auftrag stünde.
 *
 * Die Auszeichnung selbst: `#` bis `######` für Überschriften, `- ` für
 * Aufzählungen, `| a | b |` für eine Tabellenzeile, Leerzeilen für Absätze.
 * Alles andere ist ein Absatz.
 */

/** Was für eine Zeile das ist. */
export type Zeilenart = 'ueberschrift' | 'liste' | 'tabelle' | 'absatz' | 'leer';

/**
 * Eine Tabellenzeile: `| Bezeichnung | Wert |`.
 *
 * **Beginnt und endet mit `|`** und hat dazwischen wenigstens einen Trenner,
 * damit ein Satz mit einem senkrechten Strich darin nicht versehentlich zur
 * Tabelle wird.
 */
export function istTabellenzeile(text: string): boolean {
	const t = text.trim();
	return t.startsWith('|') && t.endsWith('|') && t.split('|').length >= 4;
}

/**
 * Die Trennzeile `| --- | --- |`, die Markdown unter einer Kopfzeile erwartet.
 *
 * **Sie wird verworfen, nicht gesetzt** (03.09.2026, aus dem Code-Review):
 * Unsere Tabelle hat keine Kopfzeile, und wer die Zeile aus Gewohnheit tippt,
 * bekäme sonst eine Zeile mit zwei Strichen darin.
 */
export function istTrennzeile(text: string): boolean {
	if (!istTabellenzeile(text)) return false;
	return text
		.trim()
		.slice(1, -1)
		.split('|')
		.every((f) => /^\s*:?-{1,}:?\s*$/.test(f));
}

/**
 * Die beiden Felder einer Tabellenzeile.
 *
 * **Geschnitten wird am ERSTEN inneren Trenner**, alles Weitere gehört zum Wert
 * (03.09.2026, aus dem Code-Review). Ort, Gemeinschaft und Vorsitz sind
 * Freitextfelder ohne Einschränkung: Steht dort ein `|`, hätte eine Regel «genau
 * zwei Felder» die Zeile nicht mehr erkannt, und der Kopf zerfiele in einen
 * Absatz mit sichtbarer Auszeichnung.
 *
 * Erwartet eine Zeile, die `istTabellenzeile` bejaht — und die hat damit immer
 * einen inneren Trenner.
 */
export function felder(text: string): [string, string] {
	const t = text.trim();
	const innen = t.slice(1, -1);
	const trenner = innen.indexOf('|');
	if (trenner < 0) return [innen.trim(), ''];
	return [innen.slice(0, trenner).trim(), innen.slice(trenner + 1).trim()];
}

/**
 * Die Art einer Zeile.
 *
 * Die Erkennung ist bewusst stur: Was nicht wie eine Überschrift, ein
 * Aufzählungspunkt oder eine Tabellenzeile aussieht, ist ein Absatz. Eine
 * klügere Regel erriete irgendwann etwas, das der Mensch so nicht gemeint hat —
 * und im Protokoll ist geraten schlimmer als schlicht.
 */
export function art(text: string): Zeilenart {
	if (text.trim() === '') return 'leer';
	if (/^#{1,6}\s/.test(text)) return 'ueberschrift';
	if (text.startsWith('- ')) return 'liste';
	if (istTabellenzeile(text)) return 'tabelle';
	return 'absatz';
}

/** Überschriftenstufe und Wortlaut, oder `null` für alles andere. */
export function ueberschrift(text: string): { stufe: number; text: string } | null {
	const treffer = /^(#{1,6})\s+(.*)$/.exec(text);
	if (!treffer) return null;
	return { stufe: treffer[1].length, text: treffer[2] };
}

// ── Der Zerleger für die Bürodokumente ──────────────────────────────────────

/** Ein Stück gesetzter Text, wie Word und OpenDocument ihn brauchen. */
export type Baustein =
	| { art: 'ueberschrift'; stufe: number; text: string }
	| { art: 'liste'; text: string }
	| { art: 'absatz'; text: string }
	| { art: 'leerabsatz' }
	| { art: 'tabelle'; zeilen: [string, string][] };

/**
 * Ob eine Leerzeile in einem Bürodokument einen eigenen Absatz braucht.
 *
 * **Der Anlass** (Auftraggeber, 03.09.2026: «Jetzt hat es viele Lücken und sieht optisch
 * nicht ansprechend aus»). Im Entwurfstext trennt eine Leerzeile zwei Absätze —
 * das ist die Markdown-Schreibweise, kein Inhalt. Die Textverarbeitung trennt
 * Absätze selbst: Die Vorlage «Standard» trägt sechs Punkt Abstand. Der
 * zusätzliche leere Absatz kam obendrauf und brachte je Lücke rund 26 Punkt
 * zusammen. Bei einem Traktandum mit vier Angaben sind das 27 Millimeter Luft.
 *
 * **Aber nicht jede Leerzeile ist überflüssig** (aus dem Code-Review). Der erste
 * Anlauf warf sie alle weg, und dann klebte «Nicht erschienen (1):» am letzten
 * Namen der Gruppe darüber: Ein Listenabsatz trägt nur zwei Punkt Abstand, und
 * die Gruppen der Anwesenheitsliste liefen ineinander. Dasselbe beim
 * Unterschriftenblock, der seinen Platz verlor.
 *
 * Die Regel: Zwischen zwei gewöhnlichen Absätzen trennt die Vorlage selbst. Wo
 * eine **Liste** endet oder beginnt, bleibt die Leerzeile — dort ist sie die
 * einzige Trennung, die es gibt.
 */
function leerzeileNoetig(vorher: string | undefined, nachher: string | undefined): boolean {
	if (vorher === undefined || nachher === undefined) return false;
	/*
	 * **Eine Überschrift bringt ihren Abstand mit** (03.09.2026, Sichtprobe am
	 * durch LibreOffice gesetzten Dokument): Vor und nach ihr stand zusätzlich
	 * ein leerer Absatz, und genau diese Löcher meinte der Auftraggeber mit «viele Lücken».
	 */
	if (art(vorher) === 'ueberschrift' || art(nachher) === 'ueberschrift') return false;
	// Eine Tabelle bringt ihren Abstand selbst mit. Den Absatz zwischen zwei
	// Tabellen setzt der Tabellenzweig, weil nur er über Leerzeilen hinwegsieht.
	if (art(vorher) === 'tabelle' || art(nachher) === 'tabelle') return false;
	return art(vorher) === 'liste' || art(nachher) === 'liste';
}

/**
 * Zerlegt den Protokolltext in Bausteine für Word und OpenDocument.
 *
 * Beide Formate setzen daraus dasselbe Dokument, nur in ihrer eigenen Sprache.
 * Dass die Zerlegung eine einzige ist, ist der Grund, weshalb die beiden
 * Ausgaben nicht auseinanderlaufen können.
 */
export function zerlegeInBausteine(text: string): Baustein[] {
	const zeilen = text.split('\n');
	const stuecke: Baustein[] = [];

	for (let i = 0; i < zeilen.length; i++) {
		const z = zeilen[i];
		const dies = art(z);

		/*
		 * **Zusammenhängende Tabellenzeilen werden eine Tabelle.** Einzeln gesetzt
		 * wären es so viele Tabellen wie Zeilen, jede mit eigenem Rahmen — Word
		 * zeichnet dann doppelte Linien zwischen den Feldern.
		 */
		if (dies === 'tabelle') {
			const block: string[] = [];
			while (i < zeilen.length && art(zeilen[i]) === 'tabelle') block.push(zeilen[i++]);
			i -= 1;
			const gesetzt = block.filter((b) => !istTrennzeile(b));
			if (gesetzt.length > 0) {
				stuecke.push({ art: 'tabelle', zeilen: gesetzt.map(felder) });
			}
			/*
			 * **Der Trennabsatz gehört an den Block, nicht an die Leerzeile**
			 * (aus dem Code-Review): Bei zwei Leerzeilen zwischen zwei Tabellen
			 * sah keine der beiden die andere Tabelle als Nachbarn, und Word
			 * verschmolz sie wieder. Hier zählt, was nach beliebig vielen
			 * Leerzeilen folgt.
			 */
			let j = i + 1;
			while (j < zeilen.length && art(zeilen[j]) === 'leer') j++;
			if (j < zeilen.length && art(zeilen[j]) === 'tabelle') {
				stuecke.push({ art: 'leerabsatz' });
				i = j - 1;
			}
			continue;
		}

		if (dies === 'leer') {
			if (leerzeileNoetig(zeilen[i - 1], zeilen[i + 1])) stuecke.push({ art: 'leerabsatz' });
			continue;
		}

		const h = ueberschrift(z);
		if (h) {
			stuecke.push({ art: 'ueberschrift', stufe: h.stufe, text: h.text });
			continue;
		}
		if (dies === 'liste') {
			stuecke.push({ art: 'liste', text: z.slice(2) });
			continue;
		}
		stuecke.push({ art: 'absatz', text: z });
	}

	/*
	 * **Nach der letzten Tabelle braucht Word einen Absatz** (aus dem
	 * Code-Review): Steht `<w:tbl>` unmittelbar vor `<w:sectPr>`, meldet Word
	 * beschädigten Inhalt. Endet der Text mit einer Tabellenzeile, ist genau das
	 * der Fall. OpenDocument stört es nicht, bekommt ihn aber auch: Zwei
	 * Ausgaben desselben Textes sollen dieselbe Gestalt haben.
	 */
	if (stuecke.length > 0 && stuecke[stuecke.length - 1].art === 'tabelle') {
		stuecke.push({ art: 'leerabsatz' });
	}

	return stuecke;
}
