/**
 * Der Ereignisstrom zur Versammlung (AD-11, AD-13).
 *
 * **Was hier fliesst und was nicht.** Über diesen Weg gehen ausschliesslich
 * Zustandswechsel und Summen: Versammlungszustand, Zahl der Anwesenden,
 * Kopfstimmen, Wertquoten, welches Traktandum aufgerufen ist. Nie ein Name, nie
 * ein Stimmverhalten, nie eine Kennung, aus der sich eine Person ableiten
 * lässt. Der Grund ist der Beamer: Was hier ankommt, steht potenziell auf einer
 * Leinwand, die alle sehen — und ein mitlesender Browser im Saal hätte sonst
 * mehr Einblick als die Person am Rednerpult.
 *
 * **Warum in diesem Prozess und nicht über eine Warteschlange.** AD-13 lässt
 * genau zwei Laufzeitteile zu: die Anwendung und PostgreSQL. Bei einer
 * Versammlung zur Zeit und 120 Teilnehmern ist eine Karte im Speicher das
 * Richtige. Sollte je ein zweiter Prozess nötig werden, bricht AD-13, und das
 * ist dann bewusst zu entscheiden — nicht hier vorwegzunehmen.
 */
import type { Id } from '$lib/domain/types';

/**
 * Was ein Beobachter erfährt.
 *
 * Ausdrücklich getippt und nicht `Record<string, unknown>`: Ein offener Typ
 * liesse irgendwann einen Namen durchrutschen, und niemand sähe es der Stelle
 * an, die ihn hineingibt.
 */
export interface Stromnachricht {
	/** Zustand der Versammlung — entwurf, freigegeben, laufend, geschlossen. */
	zustand: string;
	anzahlAnwesend: number;
	anzahlGesamt: number;
	kopfstimmenAnwesend: number;
	kopfstimmenGesamt: number;
	quotenAnwesend: number;
	gesamtquote: number;
	beschlussfaehig: boolean;
	/**
	 * Die Bedingungen mit ihren Schwellen (23.08.2026).
	 *
	 * **Zahlen, keine Namen** (AD-11) — dieselbe Regel wie für den ganzen Strom.
	 * Sie machen aus «14 von 30 Köpfen» eine Auskunft: Wie viele es braucht,
	 * stand bis dahin auf der Wand nirgends, und bei einer verschärften
	 * Reglementsregel liegt die Schwelle ganz woanders als bei der Hälfte.
	 *
	 * Der Kern rechnet sie ohnehin; sie wurden bloss nicht weitergereicht.
	 */
	bedingungen: {
		bezeichnung: string;
		noetig: number;
		vorhanden: number;
		/** Das Ganze, auf das sich `vorhanden` bezieht — siehe `domain/beschlussfaehigkeit`. */
		gesamt: number;
		erfuellt: boolean;
	}[];
	/** Zahl der offenen Anmeldungen — als Zahl, nicht als Liste. */
	wartend: number;
	/**
	 * Zahl der offenen Meldungen vom QR auf der Leinwand.
	 *
	 * Eine zweite Zahl und nicht in `wartend` hineingerechnet: Die beiden
	 * verlangen verschiedene Handgriffe. Wer sich angemeldet hat, wird
	 * freigegeben; wer sich über die Leinwand gemeldet hat, muss erst einer
	 * Partei zugeordnet werden — er hat bisher nur einen Namen behauptet.
	 */
	saalmeldungen: number;
	/** Kennung des aufgerufenen Traktandums. Keine Person, kein Inhalt. */
	aktuellesTraktandumId: Id | null;
	/**
	 * Wann dieser Punkt aufgerufen wurde — eine Uhrzeit, kein Inhalt (AD-11).
	 *
	 * **Wozu.** Die gemeinsame Wand eines Abends muss erkennen, welches Haus
	 * zuletzt aufgerufen wurde; die blosse Menge der laufenden Punkte genügt
	 * dafür nicht. Springt die Sitzungsleitung von 2.2 auf 2.1 zurück, bleibt
	 * die Menge unverändert — und ohne diese Uhrzeit merkte die Wand den
	 * Rücksprung nie.
	 */
	aufgerufenSeit: string | null;
	/**
	 * Wann das aufgerufene Traktandum zurückgezogen wurde, oder `null`: eine
	 * Uhrzeit, kein Grund und kein Name (AD-11). Die gemeinsame Wand lädt daran
	 * neu und zeigt den Rückzug; vorher zeigte sie den Antrag unverändert weiter
	 * (Probe Wertquotenmehr, 17.11.2026, B4).
	 */
	zurueckgezogenAm: string | null;
	/**
	 * Wann die Beschlussfähigkeit zuletzt festgehalten wurde — eine Uhrzeit,
	 * kein Befund (AD-11).
	 *
	 * **Wozu** (Auftraggeber, 25.08.2026): «Wenn Beschlussfähigkeit festgehalten wird,
	 * also mit dem Button auf Sitzungsleitung, soll dies an der Sitzung
	 * entsprechend am Monitor angezeigt werden.» Der Befund selbst ist ein Satz
	 * mit Gemeinschaftsnamen und Gründen — Inhalt, und der geht über den
	 * Ladeweg. Hier steht nur die Marke, an der die Wand erkennt, dass sie
	 * nachladen muss; dasselbe Muster wie bei Pause und Wandbild.
	 */
	festgestelltAm: string | null;
	/**
	 * Marke der Unterbrechung — der Zeitpunkt, nie der Wortlaut (AD-11).
	 *
	 * `null` heisst: läuft. Die Saalsicht und die Telefone erkennen daran, dass
	 * sie nachladen und die Pausenansicht zeigen müssen; den Text holen sie vom
	 * Server, wie beim Wandbild.
	 */
	pause: string | null;
	/**
	 * Marke des Wandbildes — Art und Änderungszeitpunkt, nie der Wortlaut.
	 *
	 * Der freie Text steht ausdrücklich **nicht** im Strom (AD-11): Er ist
	 * Inhalt, und der Strom trägt Zahlen und Kennungen. Die Saalsicht sieht an
	 * der geänderten Marke, dass sie nachladen muss, und holt den Wortlaut vom
	 * Server — derselbe Weg wie beim Traktandenwortlaut.
	 */
	wandbild: string | null;
	/**
	 * Die laufende oder zuletzt geschlossene Abstimmung.
	 *
	 * Die Frage **im Wortlaut** fliesst mit: Sie steht ohnehin auf der Leinwand
	 * und auf jedem Teilnehmergerät, und ohne sie müsste jedes Gerät die Seite
	 * neu laden, sobald eine Abstimmung öffnet — im Saal-WLAN gleichzeitig für
	 * hundert Telefone.
	 *
	 * Der **Fortschritt** trägt nur zwei Zahlen, nie die Verteilung (FR-37): Wer
	 * während der offenen Abstimmung den Zwischenstand kennt, kann den Zeitpunkt
	 * des Schliessens danach wählen.
	 *
	 * Das **Ergebnis** erscheint erst nach der Freigabe durch die
	 * Sitzungsleitung (FR-40) — oder sofort, wenn alle gestimmt haben. Vorher
	 * steht hier `null`, und was nicht gesendet wird, kann keine Sicht anzeigen.
	 */
	abstimmung: Abstimmungsstand | null;
}

export interface Abstimmungsstand {
	durchgangId: Id;
	traktandumId: Id;
	nummer: number;
	titel: string;
	frage: string;
	erfordernis: string;
	/**
	 * Was es braucht, damit dieser Antrag durchkommt — als fertiger Satz.
	 *
	 * **Eine Regel, keine Person und kein Zwischenstand** (AD-11): «Nötig: 4 von 5
	 * Kopfstimmen (aller Eigentümer — unabhängig davon, wer erscheint).» Sie
	 * verrät nichts über Stimmverhalten, sondern sagt, wogegen am Schluss
	 * gemessen wird. Auf der Leinwand steht sie, seit im Prüflauf vom 22.08.2026
	 * niemand vor der Abstimmung wusste, wie viele Ja nötig waren.
	 *
	 * Sie ändert sich im Lauf des Abends: Wer dazukommt, verschiebt die
	 * Bezugsgrösse der anwesenheitsabhängigen Erfordernisse. Deshalb gehört sie
	 * in den Strom und nicht in die einmal geladenen Seitendaten.
	 */
	noetig: string;
	/**
	 * Warum die Wertquotenschranke stehen bleibt, während die Kopfbasis sinkt.
	 *
	 * Gemeldet am 05.09.2026 (Befund 15): «Nach einem Ausstand sinkt die
	 * Kopfbasis, die Quotenbasis nicht — ohne ein Wort, warum.» Der Satz gehört
	 * aus demselben Grund in den Strom wie `noetig`: Er entsteht erst, wenn die
	 * Sitzungsleitung einen Ausstand erklärt, also mitten im Abend, und die
	 * Leinwand ist dann längst geladen.
	 *
	 * **Zu AD-11, und zwar genauer als «nennt keine Person».** Er nennt keine,
	 * das stimmt. Eine Quotensumme ist in einer kleinen Gemeinschaft aber sehr
	 * wohl eine Kennung, aus der sich eine Person ableiten lässt: Bei drei
	 * Eigentümern mit 300/300/400 sagt «400 Wertquoten im Ausstand» eindeutig,
	 * wer es ist, und die Quoten stehen ohnehin im Grundbuch und in der
	 * Einladung.
	 *
	 * Vertretbar ist es aus einem anderen Grund, und der gehört hierhin statt
	 * einer zu bequemen Behauptung: **Der Ausstand wird im Saal laut erklärt**
	 * und steht namentlich im Protokoll. Die Wand verrät nichts, was die
	 * Anwesenden nicht gerade gehört haben. Ausserdem trägt derselbe Strom mit
	 * `quotenAnwesend` längst einen feineren Kanal — der verschiebt sich bei
	 * jedem Eintreffen um genau die Quote einer Partei.
	 *
	 * Kein Stimmverhalten (FR-37, FR-40) und kein Name im Wortlaut. Dass Letzteres
	 * so bleibt, prüft `tests/domain/auszaehlung.test.ts`; der Wächter
	 * `check-stromnamen` sieht nur Feldnamen und könnte es nicht fangen.
	 */
	ausstandsgrund: string | null;
	zustand: 'offen' | 'geschlossen';
	/**
	 * Die Abstimmung ist geheim (Migration 141, Produktentscheid 28.09.2026).
	 *
	 * Dann trägt der Strom keine Zahlen zur Verteilung: `ergebnis.koepfe` und
	 * `ergebnis.quoten` stehen auf null, und die Anzeigen nennen nur «erreicht»
	 * oder «nicht erreicht». Beim Eröffnen sagt die Sicht damit vor der
	 * Abstimmung an, dass geheim abgestimmt wird (DSG Art. 19).
	 */
	geheim: boolean;
	/**
	 * Konsultative Abstimmung bei fehlender Beschlussfähigkeit (Migration 158).
	 * Wand und Telefon sagen es an, solange abgestimmt wird: Wer seine Stimme
	 * abgibt, soll wissen, dass daraus kein Beschluss wird.
	 */
	konsultativ: boolean;
	/**
	 * Der Satz dazu nach dem Grund (Migration 174): nach der Sperre von L5 ein
	 * eigener, weil die Versammlung dann beschlussfähig ist (Codeprüfung Block 7,
	 * R2-M1). Leer ohne konsultative Abstimmung.
	 */
	konsultativSatz: string;
	abgegeben: number;
	stimmberechtigt: number;
	/**
	 * Die Zahl der Stimm- und Veto-Zeilen im Durchgang — nicht der Parteien
	 * (Veto-Zeilen seit 26.09.2026, siehe `versammlungsstand.ts`).
	 *
	 * Daran erkennt eine offene Seite auch eine **Berichtigung**: Die erzeugt
	 * eine neue Zeile (AD-5), lässt `abgegeben` aber unverändert. Eine blosse
	 * Zahl, keine Namen und keine Verteilung (AD-11).
	 */
	zeilen: number;
	/** Nur nach der Freigabe. Zahlen ohne Namen (AD-11, NFR-17). */
	ergebnis: Ergebnisstand | null;
	/**
	 * Geschlossen, aber der Stichentscheid steht aus: der Satz dazu, wie ihn die
	 * Leitung vorliest (`ergebnisInWorten`), ohne Namen. Bis dahin sagte die Wand
	 * «Das Ergebnis wird verkündet», als läge eines vor (Probe Wertquotenmehr,
	 * 17.11.2026, B4). Leer, solange offen abgestimmt wird oder ein Ergebnis da ist.
	 */
	wartesatz: string | null;
}

export interface Ergebnisstand {
	angenommen: boolean;
	/**
	 * «Kein Beschluss» mit kurzem Grund, ohne Namen (Migration 128). Dann ist
	 * `angenommen` falsch, und die Anzeige sagt statt «Abgelehnt» diesen Satz;
	 * sonst sieht der Saal zehn Ja und «Abgelehnt» (Laienprüfung Runde 2, L12).
	 */
	keinBeschluss?: string | null;
	/**
	 * Nach einem Rückkommen, das keinen Beschluss ergab: der Satz, dass der
	 * frühere Beschluss bleibt (`ohneBeschlussNachRueckkommen`). Die Zahlen
	 * darunter sind dann die des früheren Durchgangs.
	 */
	nachRueckkommen?: string | null;
	/**
	 * **Kopfspiegel:** Für dieses Ergebnis wurde nichts gegen eine Schwelle
	 * gerechnet, und es gibt keine Bezugsgrösse. Die Wand und die Kachel der
	 * Abendwand zeigen dann nur Ja, Nein und Enthaltung, ohne «ohne Abgabe» und
	 * ohne «von N» (Plan 30.09.2026, «Offen aus Block 1», Punkt 3). Das Telefon
	 * zeigt ohnehin nur den Satz.
	 *
	 * **Das Merkmal heisst nach aussen nicht nach seinem Anlass.** Es steht als
	 * Zahlenschalter im Strom und nicht als Satz; keine Anzeige nennt den Weg
	 * (`check:stromnamen`, Entscheid 30.09.2026).
	 */
	ohneSchwelle: boolean;
	/**
	 * Konsultative Abstimmung (Migration 158): die Zahlen mit Bezugsgrösse, aber
	 * ohne «nötig». Gegen die Schwelle wurde nichts entschieden.
	 */
	ohneNoetig?: boolean;
	/**
	 * Die Köpfe zählen nicht (Regel nur nach Wertquoten): Wand und Kachel zeigen
	 * sie nach den Wertquoten, als Auskunft. Ein Merkmal statt der Ableitung aus
	 * zwei Nullwerten; eine leere Kopfbasis ergäbe sonst dasselbe Bild
	 * (Codeprüfung Block A, zweiter Durchgang, B5).
	 */
	koepfeAlsAuskunft?: boolean;
	/**
	 * Geheime Abstimmung: Die beiden Spiegel darunter sind blind gestellt (nur
	 * Nullen), und keine Anzeige nennt Zahlen (Produktentscheid 28.09.2026).
	 * Der Strom ist geräteübergreifend lesbar; was er nicht trägt, kann keine
	 * Sicht verraten.
	 */
	geheim: boolean;
	koepfe: { ja: number; nein: number; enthaltung: number; ohneAbgabe: number; basis: number; schwelle: number | null };
	quoten: { ja: number; nein: number; enthaltung: number; ohneAbgabe: number; basis: number; schwelle: number | null };
	satz: string;
}

type Zuhoerer = (n: Stromnachricht) => void;

const zuhoerer = new Map<Id, Set<Zuhoerer>>();

/** Der zuletzt gesendete Stand je Versammlung, für neu Hinzukommende. */
const letzter = new Map<Id, Stromnachricht>();

export function abonniere(
	meetingId: Id,
	hoerer: Zuhoerer,
	bekanntesSenden = true
): () => void {
	const menge = zuhoerer.get(meetingId) ?? new Set<Zuhoerer>();
	menge.add(hoerer);
	zuhoerer.set(meetingId, menge);

	// Sofort den bekannten Stand: Wer die Seite mitten in der Versammlung öffnet,
	// soll nicht bis zur nächsten Änderung vor einer leeren Anzeige sitzen.
	//
	// **Nicht**, wenn der Aufrufer schon einen frischen Stand geschickt hat. Der
	// gemerkte ist dann älter, und ein älterer Stand hinter einem frischen ist
	// schlimmer als gar keiner: Am 02.08.2026 lud die Saalsicht daraufhin
	// endlos neu, weil sie zwischen dem frischen Stand der Seite und dem alten
	// aus dem Gedächtnis hin und her sprang.
	const bekannt = bekanntesSenden ? letzter.get(meetingId) : undefined;
	if (bekannt) hoerer(bekannt);

	return () => {
		menge.delete(hoerer);
		if (menge.size === 0) zuhoerer.delete(meetingId);
	};
}

/** Merkt einen frisch ermittelten Stand, ohne ihn zu verteilen. */
export function merke(meetingId: Id, nachricht: Stromnachricht): void {
	letzter.set(meetingId, nachricht);
}

export function sende(meetingId: Id, nachricht: Stromnachricht): void {
	letzter.set(meetingId, nachricht);
	for (const hoerer of zuhoerer.get(meetingId) ?? []) {
		try {
			hoerer(nachricht);
		} catch {
			// Ein abgebrochener Beobachter darf die übrigen nicht mitreissen. Er
			// wird beim nächsten Schreibversuch ohnehin abgeräumt.
		}
	}
}

/** Wie viele gerade zuhören — für die Betriebsanzeige. */
export function anzahlZuhoerer(meetingId: Id): number {
	return zuhoerer.get(meetingId)?.size ?? 0;
}

/**
 * Räumt den gemerkten Stand weg.
 *
 * Beim Schliessen der Versammlung: Ein Stand, der nach dem Ende noch
 * ausgeliefert wird, zeigt eine Anwesenheit, die es nicht mehr gibt.
 */
export function vergiss(meetingId: Id): void {
	letzter.delete(meetingId);
}

/**
 * Die Antwort eines Ereignisstroms — an **einer** Stelle, nicht in drei Routen.
 *
 * **Der Anlass, am 20.08.2026.** Drei Routen liefern einen Strom
 * (`/z/strom` für das Telefon, `/p/strom` für die Wand am zweiten Gerät,
 * `/versammlungen/<id>/strom` für Sitzungsleitung und Beamer). Nur die dritte
 * trug `x-accel-buffering: no`. Ein vorgeschalteter Reverse-Proxy puffert alles
 * ohne diesen Kopf — und dann kommt beim Empfänger nichts an, solange der
 * Puffer nicht voll ist.
 *
 * Gemeldet als «bei der Ansicht Eigentümer lädt er endlos. Man kann so nicht
 * abstimmen.» Nachgemessen: über `http://127.0.0.1:3100` stand die Frage nach
 * **einer** Sekunde auf dem Gerät, über die Adresse mit dem Proxy nach zwanzig
 * Sekunden noch nicht — kein einziges Ereignis, nicht einmal ein Herzschlag.
 * Der Beamer lief derweil live, denn sein Strom trug den Kopf bereits. Es traf
 * also ausgerechnet den Strom, an dem alles hängt: Ohne ihn erscheint die Frage
 * auf keinem Telefon, es stimmt niemand ab, und das Ergebnis lautet «abgelehnt»
 * bei null Stimmen.
 *
 * Deshalb baut niemand die Kopfzeilen mehr selbst. `scripts/check-stroeme.mjs`
 * hält es offen.
 */
export function stromantwort(strom: ReadableStream): Response {
	return new Response(strom, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store',
			connection: 'keep-alive',
			// Kein Puffern durch einen Proxy — siehe oben.
			'x-accel-buffering': 'no'
		}
	});
}
