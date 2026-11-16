/**
 * Die Rüge im Saal (Ä-06, Auftrag H8, Teil A).
 *
 * Hier stehen die Regeln, in `$lib/server/ruege` der Weg zur Datenbank (AD-1).
 * Warum es das Feld gibt und warum es nichts sperrt, steht in Migration 160.
 *
 * **Was eine Rüge hier ist.** Ein Eintrag, der festhält, dass jemand im Saal
 * vor der Abstimmung einen Mangel beanstandet hat, und wie der Vorsitz darauf
 * entschied. Ob die Rüge begründet war, entscheidet nicht die Anwendung,
 * sondern im Streitfall ein Gericht; die Anwendung hält nur fest, dass sie
 * erhoben wurde.
 */
import { FachlicherFehler } from './fehler';
import { zeichenzahl } from './zeichenzahl';

/** Wie lang Wortlaut und Entscheid höchstens sind; die Schranken in Migration 160. */
export const RUEGE_HOECHSTENS = 2000;
/** Wie lang die Angabe «wer rügt» höchstens ist. */
export const RUEGENDE_HOECHSTENS = 200;

export interface Ruegeeingabe {
	wortlaut: string;
	wer: string;
	/** «HH:MM», die Uhrzeit im Saal. */
	uhrzeit: string;
	/** Wie der Vorsitz entschied; darf leer bleiben. */
	entscheid?: string | null;
}

export interface Ruege {
	id: string;
	versammlungId: string;
	traktandumId: string;
	wortlaut: string;
	wer: string;
	uhrzeit: string;
	entscheid: string | null;
	erfasstAm: string;
	erfasstDurch: string | null;
}

const UHRZEIT = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Prüft eine Eingabe und gibt sie geputzt zurück.
 *
 * Jede Schranke der Migration steht hier vorher, damit im Saal ein Satz
 * erscheint und keine Datenbankmeldung (`docs/gestaltung.md`).
 *
 * **Eine Uhrzeit mit einer Stelle wird ergänzt** («9:05» zu «09:05»): So
 * tippt man sie, und eine Absage dafür wäre Pedanterie im ungünstigsten
 * Augenblick.
 */
export function pruefeRuege(eingabe: Ruegeeingabe): {
	wortlaut: string;
	wer: string;
	uhrzeit: string;
	entscheid: string | null;
} {
	const wortlaut = (eingabe.wortlaut ?? '').trim();
	if (zeichenzahl(wortlaut) < 3) {
		throw new FachlicherFehler(
			'zu_kurz',
			'Was wird gerügt? Ein Stichwort genügt, drei Zeichen braucht es.',
			'wortlaut'
		);
	}
	if (zeichenzahl(wortlaut) > RUEGE_HOECHSTENS) {
		throw new FachlicherFehler(
			'zu_lang',
			`Die Rüge ist länger als ${RUEGE_HOECHSTENS} Zeichen. Halten Sie das Wesentliche fest.`,
			'wortlaut'
		);
	}

	const wer = (eingabe.wer ?? '').trim();
	if (zeichenzahl(wer) < 2) {
		throw new FachlicherFehler('fehlt', 'Wer rügt? Bitte einen Namen eintragen.', 'wer');
	}
	if (zeichenzahl(wer) > RUEGENDE_HOECHSTENS) {
		throw new FachlicherFehler(
			'zu_lang',
			`Der Name ist länger als ${RUEGENDE_HOECHSTENS} Zeichen.`,
			'wer'
		);
	}

	const roh = (eingabe.uhrzeit ?? '').trim();
	const uhrzeit = /^\d:\d\d$/.test(roh) ? `0${roh}` : roh;
	if (!UHRZEIT.test(uhrzeit)) {
		throw new FachlicherFehler(
			'ungueltig',
			'Um welche Uhrzeit wurde gerügt? Bitte als Stunden und Minuten eintragen, etwa 19:45.',
			'uhrzeit'
		);
	}

	const e = (eingabe.entscheid ?? '').trim();
	if (e.length > 0 && zeichenzahl(e) < 2) {
		throw new FachlicherFehler(
			'zu_kurz',
			'Das Vorgehen des Vorsitzes braucht mindestens zwei Zeichen. Leer lassen geht auch.',
			'entscheid'
		);
	}
	if (zeichenzahl(e) > RUEGE_HOECHSTENS) {
		throw new FachlicherFehler(
			'zu_lang',
			`Das Vorgehen des Vorsitzes ist länger als ${RUEGE_HOECHSTENS} Zeichen.`,
			'entscheid'
		);
	}

	return { wortlaut, wer, uhrzeit, entscheid: e.length > 0 ? e : null };
}

/** Aus der Rüge nur, was ins Protokoll gehört. */
export type Ruegeangabe = Pick<Ruege, 'wer' | 'uhrzeit' | 'wortlaut' | 'entscheid'>;

/**
 * Die Rüge als Zeile im Protokoll.
 *
 * **Ins Protokoll, nicht nur ins Paket** (Fachprüfung 14.10.2026, R4-a). Das
 * Protokoll ist das einzige Dokument, das an alle Eigentümer geht, und wer
 * rügt, verlangt im Saal fast immer «zu Protokoll». Zum Pflichtinhalt gehört
 * die Rüge nicht (Wermelinger Rz. 128, 130 ad Art. 712n); der Entwurf schlägt
 * sie vor, die Leitung kann sie bearbeiten.
 *
 * **«Vorgehen», nicht «Entscheid»** (Laien- und Fachprüfung H8, Runde 2,
 * P1-a): Das Wort lud dazu ein, ein Urteil über die Rüge einzutragen
 * («unbegründet»), und im Protokoll an alle kann das jemanden die Frist
 * verstreichen lassen. Im Datenmodell heisst das Feld weiter `entscheid`.
 *
 * **Eine Zeile, auch wenn der Wortlaut mehrere hat** (Codeprüfung H8, N-C):
 * Die Felder sind Textbereiche, und die Auszeichnung des Protokolls liest
 * jede Zeile für sich; eine zweite Zeile mit «- » sähe aus wie eine zweite
 * Rüge.
 *
 * `ohneName` für das gemeinsame Protokoll eines Abends, das an alle
 * beteiligten Gemeinschaften geht (`domain/gemeinsamesprotokoll.ts`).
 */
export function ruegeSatz(r: Ruegeangabe, optionen: { ohneName?: boolean } = {}): string {
	const vorgehen = r.entscheid ? ` Vorgehen des Vorsitzes: ${mitPunkt(einzeilig(r.entscheid))}` : '';
	const wer = optionen.ohneName ? '' : `, ${einzeilig(r.wer)}`;
	return `${r.uhrzeit} Uhr${wer}: ${mitPunkt(einzeilig(r.wortlaut))}${vorgehen}`;
}

function einzeilig(text: string): string {
	return text.replace(/\s*\n\s*/g, ' ').trim();
}

/** Ein Satz endet mit einem Satzzeichen, sonst läuft der nächste in ihn hinein. */
function mitPunkt(text: string): string {
	return /[.!?…»"]$/.test(text) ? text : `${text}.`;
}
