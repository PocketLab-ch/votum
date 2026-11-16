/**
 * Die konsultative Abstimmung bei fehlender Beschlussfähigkeit (Migration 158;
 * Ä-18 der Zweitprüfung vom 17.09.2026; Auftrag H7, Teil B).
 *
 * **Die Sperre bleibt.** Ohne Beschlussfähigkeit wird nicht verbindlich
 * abgestimmt (`verlangeBeschlussfaehigkeit`, `beschlussfaehigkeit.ts`). Einen
 * Weg daran vorbei gibt es seit dem 30.09.2026 doch: den Beschluss von Hand
 * (`vonhand.ts`), mit dem die Leitung jede Sperre übergehen kann, auch diese.
 * Er ist kein Durchgang, sondern ein festgehaltenes Ergebnis; die übergangene
 * Absage steht beim Beschluss, die Maske warnt vor der Ungültigkeit
 * (`VON_HAND_NICHTIGKEITSRISIKO`), und das Protokoll nennt die fehlende
 * Beschlussfähigkeit. Bis zum 16.10.2026 stand hier «keinen Weg daran
 * vorbei» (Erhebung zur Freigabe, Ä-18). Ohne Beschlussfähigkeit kann die
 * Versammlung keine Beschlüsse fassen (Rz. 20, 26 und 29 ad Art. 712p); die
 * Diskussion bleibt zulässig, «solange keine Beschlüsse gefasst werden»
 * (Rz. 30). Was bleibt, ist die Frage, wie die Anwesenden zu einem Geschäft
 * stehen. Eine Rechtsfolge hat die Antwort nicht. Die
 * Leitung eröffnet den Durchgang als konsultativ, abgestimmt und gezählt wird
 * wie sonst, und beim Schliessen steht «kein Beschluss» mit dem Grund
 * `konsultativ` in der Auszählung (`KeinBeschluss`, `ausnahmen.ts`). Damit fällt
 * jede Stelle, die nur `angenommen` liest, in die sichere Richtung, und jede,
 * die `ergebnislage` liest, kennt den Fall schon.
 *
 * **Nur bei fehlender Beschlussfähigkeit.** Ist die Versammlung beschlussfähig,
 * wird verbindlich abgestimmt; eine konsultative Abstimmung daneben gäbe der
 * Leitung einen Weg, einer Entscheidung auszuweichen, die die Versammlung
 * treffen könnte.
 *
 * **Ein späterer Durchgang überholt den konsultativen** wie nach einem
 * Weggang (`durchgangWiederEroeffenbar`): Wird die Versammlung beschlussfähig,
 * gibt die Leitung die Abstimmung neu frei, ohne Rückkommen, weil es keinen
 * Beschluss gibt, auf den zurückzukommen wäre. Die Zahlen des konsultativen
 * bleiben im Protokoll stehen; sie sind sein einziger Inhalt.
 */
import { FachlicherFehler } from './fehler';

/** Was die Kopfzeile eines offenen konsultativen Durchgangs auf Wand und Telefon sagt. */
export const KONSULTATIV_OFFEN =
	'Konsultative Abstimmung: Die Versammlung ist nicht beschlussfähig. Das Ergebnis zeigt, wie ' +
	'die Anwesenden zum Antrag stehen; ein Beschluss entsteht nicht.';

/**
 * Das Häkchen beim Freigeben, nur bei fehlender Beschlussfähigkeit, seit L5
 * auch bei fehlender Beschlussfähigkeit einer ersten (Migration 174).
 */
export const KONSULTATIV_HAKEN =
	'Konsultativ abstimmen: Das Ergebnis zeigt nur, wie die Anwesenden zum Antrag stehen; ein ' +
	'Beschluss entsteht nicht.';

/** Der kurze Grund ohne «Kein Beschluss: », für Leinwand, Telefon und Rückkommen. */
export const KONSULTATIV_KURZ = 'konsultative Abstimmung';

/**
 * Der Satz für Leinwand und Leitung nach dem Schliessen. Mit dem Satz, wer
 * entscheidet: Ohne ihn hält der Saal die Sache für erledigt (Laienprüfung
 * 14.10.2026, K6).
 */
export const KONSULTATIV_SATZ =
	'Kein Beschluss: Die Versammlung war nicht beschlussfähig, abgestimmt wurde nur konsultativ. ' +
	'Das Ergebnis zeigt, wie die Anwesenden zum Antrag stehen, und bewirkt nichts. Beschliessen ' +
	'kann eine beschlussfähige Versammlung oder ein schriftlicher Beschluss, dem alle Eigentümer ' +
	'zustimmen.';

/**
 * Die Wertung im Protokoll, ohne Zahlen; der Spiegel darunter trägt sie, ohne
 * Schwelle (`auswertung.ts`). «Eröffnet», weil die Beschlussfähigkeit beim
 * Freigeben fehlte; ob sie sich während der Abstimmung änderte, ändert an
 * diesem Durchgang nichts. «Bewirkt nichts» und wer entscheidet, weil das
 * Protokoll an die Abwesenden geht (Fach- und Laienprüfung 14.10.2026, K7;
 * Rz. 131 ad Art. 712n).
 */
export const KONSULTATIV_WERTUNG =
	'Kein Beschluss: Die Abstimmung wurde konsultativ eröffnet, weil die Versammlung nicht ' +
	'beschlussfähig war. Das Ergebnis zeigt nur, wie die Anwesenden und Vertretenen zum Antrag ' +
	'standen, und bewirkt nichts. Beschliessen kann eine beschlussfähige Versammlung oder ein ' +
	'schriftlicher Beschluss, dem alle Eigentümer zustimmen.';

/**
 * Der Weg danach auf der Leitungsseite. «Neue Versammlung, die Sie
 * einberufen», nicht «nächste»: Das las sich als nächste Jahresversammlung
 * (Fachprüfung 14.10.2026, K9; Art. 712p Abs. 2, Rz. 29 ad Art. 712p). Ob dort
 * die erleichterte Beschlussfähigkeit nach Abs. 3 gilt, lässt der Kommentar
 * offen; der Satz verspricht sie nicht. Mit dem schriftlichen Beschluss aller
 * (Fachprüfung Runde 2, ZGB Art. 66 Abs. 2 i.V.m. Art. 712m Abs. 2; Rz. 124 bis
 * 129 ad Art. 712m; Rz. 38 ad Art. 712p): Ohne ihn beriefe die Leitung auch
 * bei einem unbestrittenen Geschäft eine Versammlung ein. Mit der Form
 * (Fach- und Laienprüfung Runde 3, K9; Rz. 128 ad Art. 712m: «Eine einfache
 * Zustimmung auf einer E-Mail genügt somit nicht»).
 */
export const KONSULTATIV_WEG =
	'Wird die Versammlung noch beschlussfähig, etwa weil jemand nachkommt, geben Sie die Abstimmung ' +
	'erneut frei, dann verbindlich. Sonst gehört das Geschäft an eine neue Versammlung, die Sie ' +
	'einberufen. Ohne Versammlung entsteht ein Beschluss nur, wenn alle Eigentümer dem Antrag ' +
	'schriftlich mit Unterschrift zustimmen, eine E-Mail genügt nicht; das konsultative Ergebnis ' +
	'ersetzt diese Zustimmung nicht.';

/**
 * Ob ein Durchgang das Geschäft entschieden hat: geschlossen, nicht überholt
 * und nicht konsultativ.
 *
 * **Nach einer konsultativen Abstimmung ist das Geschäft offen**
 * (Produktentscheid 14.10.2026, Auftrag H7, Teil D): Erfordernis, Ausstand und
 * Betroffene bleiben änderbar, Gegen- und Folgeantrag gehen, der Antrag lässt
 * sich zurückziehen. Der konsultative Durchgang behält sein Erfordernis
 * eingefroren (`requirement_json`), der nächste nimmt das dann geltende.
 * Seiten und Server fragen hier, damit keine Seite etwas sperrt, was der
 * Server annimmt; die SQL-Fassungen daneben tragen `NOT consultative`.
 *
 * **Ein Weggang unter der Universalversammlung zählt hier weiter als
 * entschieden, und das bleibt so** (Schritt F2, 03.11.2026; `freigabe.md`,
 * «Offen aus H7, Teil D», (a)). Weiter geht es dort nur über die Rückkehr und
 * das Neueröffnen, das den Durchgang überholt und damit alles wieder freigibt,
 * oder an der nächsten Versammlung; ein Erfordernis oder Rückzug dazwischen
 * hätte nichts, woran es wirkt.
 */
export function entscheidetDasGeschaeft(d: {
	zustand: string;
	ueberholtAm?: unknown;
	konsultativ?: boolean;
}): boolean {
	return d.zustand === 'geschlossen' && !d.ueberholtAm && d.konsultativ !== true;
}

/**
 * Der Satz beim Schliessen der Versammlung, wo über Anträge nur konsultativ
 * abgestimmt wurde (Codeprüfung 14.10.2026, Befund 2). «Wurde nicht
 * abgestimmt» stimmte dort nicht, und ohne Satz schlösse die Leitung, ohne
 * erinnert zu werden, dass diese Geschäfte offen bleiben. «Neue Versammlung»
 * wie im Weg nach dem Ergebnis (`KONSULTATIV_WEG`; Rz. 29 ad Art. 712p).
 *
 * **Mit den Nummern und, an einer ersten Versammlung, dem Weg übers
 * Vertagen** (Schritt F2, 03.11.2026; Laienprüfung H7 Teil D, Runde 3, E1):
 * Ohne die Nummern blieb offen, welche Anträge gemeint sind, und ohne den
 * Vertagungsweg schloss die Leitung, statt zu vertagen, und musste die
 * Geschäfte danach selbst neu traktandieren. Der Weg zeigt auf die Seite
 * «Anwesenheit», weil der Ausklapper dort an jeder laufenden ersten
 * Versammlung steht; der beim Traktandum hängt an dessen Titel. Die zweite
 * übernimmt nur, was in der Einladung stand (`uebertrageOffeneTraktanden`),
 * daher «aus der Einladung» (Fachprüfung F2: Rz. 49, 29 ad Art. 712p).
 * `vertagbar` setzt der Aufrufer nur, wo die Versammlung an diesem Abend nie
 * beschlussfähig war (Fachprüfung F2, S1, mittel).
 */
export function nurKonsultativSatz(
	nummern: readonly string[],
	vertagbar: boolean,
	imSaal: readonly string[] = []
): string {
	const liste = (n: readonly string[]) =>
		n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} und ${n.at(-1)}`;
	const satz =
		nummern.length === 1
			? `Über den Antrag zu Traktandum ${nummern[0]} wurde nur konsultativ abgestimmt; er bleibt ` +
				'ohne Beschluss und gehört an eine neue Versammlung.'
			: `Über die Anträge zu den Traktanden ${liste(nummern)} wurde nur konsultativ abgestimmt; ` +
				'sie bleiben ohne Beschluss und gehören an eine neue Versammlung.';
	if (!vertagbar) return satz;
	/*
	 * Laienprüfung F2, S1: «stattdessen», weil der Ausklapper selbst sagt, die
	 * Versammlung werde geschlossen; und die im Saal aufgenommenen eigens, weil
	 * man «aus der Einladung» überliest (ebenso Fachprüfung, Hinweis zu S1).
	 */
	const nichtMit =
		imSaal.length === 0
			? ''
			: imSaal.length === 1
				? ` Traktandum ${imSaal[0]} wurde im Saal aufgenommen und geht nicht mit; traktandieren ` +
					'Sie es selbst neu.'
				: ` Die Traktanden ${liste(imSaal)} wurden im Saal aufgenommen und gehen nicht mit; ` +
					'traktandieren Sie sie selbst neu.';
	return (
		`${satz} Sie können stattdessen auf der Seite «Anwesenheit» vertagen und eine zweite ` +
		// «Die zweite», nicht «Sie»: Am Satzanfang las man es als Anrede (Laienprüfung
		// F2, Runde 2).
		'Versammlung ansetzen. Die zweite übernimmt die Traktanden aus der Einladung, über die nicht ' +
		`beschlossen wurde.${nichtMit}`
	);
}

/** Ein Traktandum der Liste, soweit der Abschluss es braucht. */
export interface Abschlusstraktandum {
	id: string;
	nummer: string;
	art: string;
	rueckzug?: unknown;
	/** Im Saal aufgenommen; geht beim Vertagen nicht mit (`uebertrageOffeneTraktanden`). */
	spontan?: boolean;
}

/**
 * Was beim Schliessen ohne Beschluss bleibt (Schritt F2; bis dahin im
 * Leitungsloader gerechnet und ohne eigenen Test, Codeprüfung H7 Teil D,
 * Runde 2, N5).
 *
 * `entschieden`: Traktanden mit einem Durchgang, der das Geschäft entschieden
 * hat (`entscheidetDasGeschaeft`), oder durch einen Folgeantrag ersetzt.
 * `konsultativ`: Traktanden, deren geltender Durchgang konsultativ war.
 * Zurückgezogenes zählt nirgends: Es steht als Rückzug im Protokoll.
 */
export function abschlussOhneBeschluss(
	liste: readonly Abschlusstraktandum[],
	entschieden: ReadonlySet<string>,
	konsultativ: ReadonlySet<string>
): { ohneAbstimmung: number; nurKonsultativ: string[]; nurKonsultativImSaal: string[] } {
	const abstimmbar = liste.filter((t) => t.art === 'abstimmung' && !t.rueckzug);
	const nurKonsultativ = abstimmbar.filter((t) => konsultativ.has(t.id));
	return {
		ohneAbstimmung: abstimmbar.filter((t) => !entschieden.has(t.id) && !konsultativ.has(t.id)).length,
		nurKonsultativ: nurKonsultativ.map((t) => t.nummer),
		nurKonsultativImSaal: nurKonsultativ.filter((t) => t.spontan).map((t) => t.nummer)
	};
}

/** Der Grund, mit dem ein konsultativer Durchgang beim nächsten Eröffnen überholt wird. */
export const KONSULTATIV_UEBERHOLT =
	'Konsultative Abstimmung ohne Beschlussfähigkeit, kein Beschluss; danach neu eröffnet';

/**
 * Prüft beim Eröffnen, ob konsultativ abgestimmt werden darf. Die
 * Beschlussfähigkeit rechnet der Aufrufer mit derselben Kernfunktion wie für
 * die verbindliche Abstimmung (`stelleBeschlussfaehigkeitFest`).
 */
export function verlangeKonsultativZulaessig(e: {
	beschlussfaehig: boolean;
	universal: boolean;
	rueckkommen: boolean;
	/**
	 * Ob zu diesem Geschäft schon ein Beschluss gilt, etwa einer von Hand ohne
	 * Beschlussfähigkeit (Codeprüfung 14.10.2026, H1). Ein konsultativer
	 * Durchgang danach würde massgebend und verdrängte ihn, oder der Schluss
	 * läse ihn als zweiten Durchgang nach Eintritt der Beschlussfähigkeit.
	 */
	beschlussGilt: boolean;
}): void {
	if (e.beschlussfaehig) {
		throw new FachlicherFehler(
			'konsultativ_beschlussfaehig',
			// Mit dem Weg ohne Abstimmung (Laienprüfung 14.10.2026, K11a).
			'Die Versammlung ist beschlussfähig, deshalb wird verbindlich abgestimmt. Geben Sie die ' +
				'Abstimmung ohne «konsultativ» frei, oder besprechen Sie das Geschäft weiter, ohne ' +
				'abzustimmen.',
			'konsultativ'
		);
	}
	if (e.universal) {
		throw new FachlicherFehler(
			'konsultativ_universal',
			'Über ein nicht angekündigtes Geschäft unter der Universalversammlung wird nicht ' +
				'konsultativ abgestimmt.',
			'konsultativ'
		);
	}
	if (e.rueckkommen) {
		throw new FachlicherFehler(
			'konsultativ_rueckkommen',
			// Ohne «verbrauchte»: Das klang nach einer Rechtsfolge, gemeint ist, wie
			// Votum den Durchgang führte; und mit dem, was bis dahin gilt (Fach- und
			// Laienprüfung 14.10.2026, K11c).
			'Auf dieses Traktandum hat die Versammlung das Rückkommen beschlossen. Erneut abgestimmt ' +
				'wird verbindlich, sobald die Versammlung beschlussfähig ist; bis dahin gilt der ' +
				'frühere Beschluss. Konsultativ stimmt Votum hier nicht ab, weil der Durchgang an die ' +
				'Stelle des Rückkommens träte, ohne etwas zu entscheiden.',
			'konsultativ'
		);
	}
	if (e.beschlussGilt) {
		throw new FachlicherFehler(
			'konsultativ_beschluss',
			'Zu diesem Traktandum gilt schon ein Beschluss. Konsultativ abgestimmt wird nur über ein ' +
				'Geschäft, über das noch nicht beschlossen ist; geändert wird ein Beschluss nur verbindlich, ' +
				'sobald die Versammlung beschlussfähig ist.',
			'konsultativ'
		);
	}
}

/*
 * **Konsultativ nach der Sperre von L5** (Migration 174, Entscheid 0024 a;
 * Codeprüfung Block 7, H1). Die Versammlung ist dann beschlussfähig, nur
 * nicht wie eine erste, und das Traktandum ist neu. Die Sätze oben sagten
 * «nicht beschlussfähig» und stimmten nicht. Gewählt wird am Durchgang
 * (`voting_round.consultative_reason`, `KeinBeschluss.neuAnZweiter`).
 */
/**
 * Wer danach beschliessen kann (Fachprüfung Block 7, F7-16): nicht «eine
 * Versammlung, die so beschlussfähig ist wie eine erste», denn das läse sich
 * als Auskunft zur offenen Frage und ist zu eng; an einer späteren Versammlung
 * steht das Geschäft von Anfang an auf der Liste. «Mit Unterschrift» wie im
 * Weg danach (Laienprüfung L7-25; Rz. 128 ad Art. 712m).
 */
const SPAETER_BESCHLIESSEN =
	'Beschliessen kann darüber eine spätere Versammlung, auf deren Liste es von Anfang an steht, ' +
	'oder ohne Versammlung ein schriftlicher Beschluss, dem alle Eigentümer mit Unterschrift ' +
	'zustimmen.';

const NEU_GRUND =
	'Das Geschäft stand in der Einladung zur ersten Versammlung nicht zur Abstimmung, und die Versammlung ist nicht ' +
	'beschlussfähig wie eine erste';

export const KONSULTATIV_OFFEN_NEU =
	`Konsultative Abstimmung: ${NEU_GRUND}. Das Ergebnis zeigt, wie die Anwesenden zum Antrag ` +
	'stehen; ein Beschluss entsteht nicht.';

export const KONSULTATIV_SATZ_NEU =
	`Kein Beschluss: ${NEU_GRUND.replace(' ist nicht', ' war nicht')}. Abgestimmt wurde nur ` +
	'konsultativ. Das Ergebnis zeigt, wie die Anwesenden zum Antrag stehen, und bewirkt nichts. ' +
	SPAETER_BESCHLIESSEN;

export const KONSULTATIV_WERTUNG_NEU =
	'Kein Beschluss: Die Abstimmung wurde konsultativ eröffnet. Das Geschäft stand in der Einladung ' +
	'zur ersten Versammlung nicht zur Abstimmung, und die Versammlung war nach der Einstellung der Gemeinschaft ' +
	'nicht beschlussfähig wie eine erste. Das Ergebnis zeigt nur, wie die Anwesenden und ' +
	'Vertretenen zum Antrag standen, und bewirkt nichts. ' +
	SPAETER_BESCHLIESSEN;

export const KONSULTATIV_WEG_NEU =
	'Kommen noch so viele dazu, dass die Versammlung beschlussfähig ist wie eine erste, geben Sie ' +
	'die Abstimmung erneut frei, dann verbindlich. Sonst gehört das Geschäft auf die Liste einer ' +
	'späteren Versammlung. Ohne Versammlung entsteht ein Beschluss nur, wenn alle Eigentümer dem ' +
	'Antrag schriftlich mit Unterschrift zustimmen, eine E-Mail genügt nicht; das konsultative ' +
	'Ergebnis ersetzt diese Zustimmung nicht.';

export const KONSULTATIV_UEBERHOLT_NEU =
	'Konsultative Abstimmung ohne die Beschlussfähigkeit einer ersten Versammlung (Lesart L5), kein ' +
	'Beschluss; danach neu eröffnet';

/** Der Grund, mit dem ein konsultativer Durchgang eröffnet wurde (Migration 174). */
export type Konsultativgrund = 'neu_an_zweiter';
