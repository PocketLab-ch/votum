/**
 * Aus einer Notiz einen Protokollabsatz formulieren (FR-61, rein).
 *
 * **Die Maschine schreibt kein Protokoll.** Sie formuliert **einen Absatz aus
 * einer Notiz** — mehr nicht. Kopf, Anwesenheit, Beschlussfähigkeit,
 * Beschlusswortlaut, Ergebnis und Zahlen entstehen weiterhin in
 * `domain/protokoll.ts` aus den erfassten Daten und gehen dem Modell nie unter
 * die Augen.
 *
 * Damit ist die Zusage aus FR-61 — «Zahlen, Beschlusswortlaute, Namen und Daten
 * werden unverändert übernommen» — **baulich** erfüllt und nicht bloss
 * versprochen: Was das Modell nicht sieht, kann es nicht verändern.
 *
 * **Und es darf nichts dazuerfinden.** Das ist die zweite Zusage von FR-61, und
 * sie ist zum Teil nachprüfbar: Jede Zahl im Absatz muss in der Notiz stehen.
 * Ein Entwurf, der aus «Offerte 24 800» eine «Offerte über rund 25 000» macht,
 * fällt hier durch — im Protokoll wäre das eine erfundene Zahl, und die liest
 * später jemand als beschlossen.
 */

/**
 * Alle Zahlen eines Textes, auf eine vergleichbare Form gebracht.
 *
 * Vergleichbar heisst: ohne Tausendertrennung und ohne Währungszeichen. «24’800»,
 * «24'800», «24 800» und «24800» sind dieselbe Zahl — wer das nicht angleicht,
 * meldet bei jedem zweiten Absatz eine Erfindung.
 */
export function zahlenIn(text: string): Set<string> {
	const aus = new Set<string>();
	// Erst Tausendertrennzeichen entfernen, dann Zahlen lesen.
	const geglaettet = text.replace(/(\d)[’'’   ](?=\d{3}\b)/g, '$1');
	for (const treffer of geglaettet.matchAll(/\d+(?:[.,]\d+)?/g)) {
		// Nachkommanullen weg: «80.00» und «80» sind dieselbe Zahl.
		const roh = treffer[0].replace(',', '.');
		const n = Number(roh);
		aus.add(Number.isFinite(n) ? String(n) : roh);
	}
	return aus;
}

/** Zahlen, die im Entwurf stehen und in der Vorlage fehlen. */
export function erfundeneZahlen(quelle: string, entwurf: string): string[] {
	const bekannt = zahlenIn(quelle);
	return [...zahlenIn(entwurf)].filter((z) => !bekannt.has(z));
}

export interface Absatz {
	text: string;
	/** Zahlen, die das Modell hinzugefügt hat. Ist die Liste leer, ist es sauber. */
	erfunden: string[];
	/**
	 * Hinweise, die den Absatz nicht verwerfen, aber ein Hinsehen verlangen.
	 *
	 * **Der Unterschied zur Verwerfung:** Eine erfundene Zahl ist ein Fehler,
	 * hier stehen Dinge, die richtig sein *können*. Sie zu verwerfen hiesse,
	 * brauchbare Absätze wegzuwerfen; sie zu verschweigen hiesse, sie
	 * durchgehen zu lassen.
	 */
	hinweise: string[];
}

/** Wie viele verschiedene Personen im maskierten Text vorkommen. */
function personen(text: string): Set<string> {
	return new Set([...text.matchAll(/\[(?:Person|Name) \d+[a-z]?\]/g)].map((t) => t[0]));
}

/**
 * Was am Absatz auffällt, ohne ihn unbrauchbar zu machen.
 *
 * Beide Fälle sind am 05.08.2026 im Durchgang aufgetreten:
 *
 *   * Das Modell schrieb «Eine anwesende Person erkundigte sich» statt den
 *     Platzhalter zu übernehmen. Kein Leck — aber im Protokoll steht dann
 *     nicht mehr, **wer** gefragt hat, und das war der Zweck der Notiz.
 *   * Das Modell schrieb «und beschlossen, Offerten einzuholen», wo die Notiz
 *     nur «Offerten einholen» sagte. Der Beschluss steht bereits darunter, aus
 *     den erfassten Daten — hier wäre er eine zweite, unbelegte Fassung.
 */
export function auffaelligkeiten(notiz: string, entwurf: string): string[] {
	const hinweise: string[] = [];

	const inNotiz = personen(notiz);
	const inEntwurf = personen(entwurf);
	const verloren = [...inNotiz].filter((p) => !inEntwurf.has(p));
	if (verloren.length > 0) {
		hinweise.push(
			verloren.length === 1
				? 'Der Absatz nennt eine Person nicht mehr beim Namen, die in der Notiz steht.'
				: `Der Absatz nennt ${verloren.length} Personen nicht mehr beim Namen, die in der Notiz stehen.`
		);
	}

	if (/\bbeschlossen\b|\bbeschliesst\b|\bBeschluss\b/i.test(entwurf)) {
		hinweise.push(
			'Der Absatz spricht von einem Beschluss. Das Ergebnis setzt die Anwendung selbst darunter, ' +
				'aus den erfassten Daten — prüfen Sie, ob hier zweimal dasselbe steht.'
		);
	}

	return hinweise;
}

export interface Absatzlage {
	absatz: Absatz | null;
	/** Warum es keinen gibt. */
	grund: string | null;
}

/**
 * Nimmt entgegen, was das Modell geschrieben hat.
 *
 * **Ein Absatz, der Zahlen erfindet, wird verworfen** und nicht bloss markiert.
 * Bei einem Befund oder einer Einschätzung ist eine Markierung richtig — dort
 * liest jemand den Vorschlag und entscheidet. Hier geht der Text in ein
 * Dokument, das unterschrieben wird, und die Erfahrung mit jedem
 * Textbaustein-Werkzeug lautet: Was dasteht, bleibt stehen.
 */
export function lesbarerAbsatz(roh: unknown, notiz: string): Absatzlage {
	const text =
		typeof roh === 'string'
			? roh.trim()
			: typeof roh === 'object' && roh !== null && typeof (roh as { absatz?: unknown }).absatz === 'string'
				? ((roh as { absatz: string }).absatz.trim())
				: '';

	// zeichenzahl-frei: Plausibilität einer KI-Antwort, keine Eingabeschranke.
	if (text.length < 10) return { absatz: null, grund: 'Es kam kein brauchbarer Text zurück.' };

	/*
	 * **Ein erfundener Platzhalter wird verworfen wie eine erfundene Zahl.**
	 * «[Person 9]», das nie vergeben wurde, bliebe beim Zurücksetzen stehen und
	 * stünde wörtlich im Protokoll. Die Zahlenprüfung fängt den Fall heute
	 * nebenbei mit ab, weil ein Platzhalter eine Ziffer enthält — darauf soll
	 * sich niemand verlassen, der eines Tages die Schreibweise ändert.
	 */
	const fremdePersonen = [...personen(text)].filter((p) => !personen(notiz).has(p));
	if (fremdePersonen.length > 0) {
		return {
			absatz: null,
			grund:
				`Der Entwurf nennt Personen, die in der Notiz nicht vorkommen (${fremdePersonen.join(', ')}). ` +
				'Verworfen — im Protokoll stünde sonst jemand, der nichts gesagt hat.'
		};
	}

	/*
	 * **Lückentext wird verworfen** (Fund vom 05.08.2026). Das Modell machte aus
	 * «Offerte 24’800» eine «Offerte in Höhe von [Betrag]» — die Zahlenprüfung
	 * winkt das durch, weil keine Zahl hinzukam, sondern eine verschwand. Im
	 * Protokoll stünde dann eine Klammer, wo ein Betrag hingehört, und niemand
	 * sieht ihr an, dass die Angabe vorlag.
	 */
	const lueckentext = [...text.matchAll(/\[[^\]]*\]/g)]
		.map((t) => t[0])
		.filter((t) => !/^\[(?:Person|Name) \d+\]$/.test(t));
	if (lueckentext.length > 0) {
		return {
			absatz: null,
			grund:
				`Der Entwurf enthält Lückentext (${lueckentext.join(', ')}) statt der Angabe aus der Notiz. ` +
				'Verworfen — die Angabe lag vor.'
		};
	}

	const erfunden = erfundeneZahlen(notiz, text);
	if (erfunden.length > 0) {
		return {
			absatz: null,
			grund:
				`Der Entwurf enthält Zahlen, die in der Notiz nicht vorkommen (${erfunden.join(', ')}). ` +
				'Verworfen — eine erfundene Zahl im Protokoll liest später jemand als beschlossen.'
		};
	}

	/*
	 * **Länge als grober Wächter.** Ein Absatz, der ein Vielfaches der Notiz
	 * umfasst, hat nicht formuliert, sondern ausgeschmückt. Grosszügig gefasst,
	 * weil aus drei Stichworten durchaus zwei Sätze werden dürfen.
	 */
	// zeichenzahl-frei: Grössenvergleich zweier Texte, keine Eingabeschranke.
	if (text.length > Math.max(400, notiz.length * 4)) {
		return {
			absatz: null,
			grund:
				'Der Entwurf ist um ein Vielfaches länger als die Notiz. Das ist keine Formulierung ' +
				'mehr, sondern eine Ergänzung — verworfen.'
		};
	}

	return { absatz: { text, erfunden: [], hinweise: auffaelligkeiten(notiz, text) }, grund: null };
}

/**
 * Der Auftrag an das Modell.
 *
 * **Formulieren, nicht ergänzen.** Der Auftrag sagt dreimal dasselbe auf
 * verschiedene Weise, weil genau hier die Versuchung eines Sprachmodells liegt:
 * Aus einer knappen Notiz einen «vollständigen» Absatz zu machen, indem es das
 * Fehlende ergänzt. Im Protokoll einer Versammlung ist das keine Hilfe, sondern
 * eine Behauptung über etwas, das niemand gesagt hat.
 */
export function absatzauftrag(): string {
	return [
		'Du formulierst aus einer stichwortartigen Notiz einen Absatz für das Protokoll einer',
		'Stockwerkeigentümerversammlung.',
		'',
		'Regeln:',
		'- Schreibe **nur**, was in der Notiz steht. Ergänze nichts, auch nichts Naheliegendes.',
		'- Erfinde keine Zahlen, Beträge, Namen oder Daten. Eine Zahl, die nicht in der Notiz',
		'  steht, darf auch nicht im Absatz stehen.',
		'- Beschluss, Abstimmungsergebnis und Zahlen stehen **nicht** in deinem Absatz — die',
		'  Anwendung setzt sie selbst darunter. Schreibe nur, was besprochen wurde.',
		'- Nüchtern, in der dritten Person, Vergangenheit. Keine Anrede, keine Bewertung, keine',
		'  Überschrift, keine Aufzählungszeichen.',
		'- Schreibe nicht «beschlossen» oder «Beschluss». Das Ergebnis steht bereits darunter.',
		'- Personen erscheinen als Platzhalter wie [Person 1]. **Übernimm sie unverändert** und',
		'  umschreibe sie nicht («eine anwesende Person» ist falsch) — im Protokoll muss stehen,',
		'  wer etwas gesagt hat.',
		'- Ein bis drei Sätze. Ist die Notiz schon ein Satz, gib sie sprachlich geglättet zurück.',
		'',
		'Antworte ausschliesslich mit dem Absatz, ohne Anführungszeichen und ohne Vorrede.'
	].join('\n');
}
