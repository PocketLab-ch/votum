/**
 * Die Pendenz — wer erledigt was bis wann.
 *
 * Hier stehen die Regeln, in `$lib/server/pendenz` der Weg zur Datenbank
 * (AD-1). Die Begründung des Modells steht in Migration 106; hier steht nur,
 * was daraus für Eingabe und Anzeige folgt.
 *
 * **Was eine Pendenz nicht ist.** Sie ist kein Beschluss und kein Votum. Der
 * Beschluss steht am Durchgang (`voting_round.decision_text`), das Gesagte am
 * Traktandum (`agenda_item.minute_text`). Die Pendenz ist das, was jemand
 * daraus zu tun hat — und das ist ein Satz, kein Absatz.
 */
import { FachlicherFehler } from './fehler';
import { istKalendertag } from './datum';
import { zeichenzahl } from './zeichenzahl';

/**
 * Bis wann, in drei Fällen.
 *
 * Warum drei und nicht ein Datum, das auch fehlen darf: Migration 106. Kurz —
 * «noch kein Termin gesetzt» und «ausdrücklich ohne Termin» sind zwei
 * verschiedene Auskünfte, und ein Feld, das fehlen darf, trägt nur eine.
 */
export type Fristart = 'datum' | 'naechste_versammlung' | 'keine';

export type Pendenzzustand = 'offen' | 'erledigt' | 'hinfaellig';

export const FRISTARTEN: Fristart[] = ['datum', 'naechste_versammlung', 'keine'];
export const PENDENZZUSTAENDE: Pendenzzustand[] = ['offen', 'erledigt', 'hinfaellig'];

/**
 * Höchstens so lang wie der Text zum Beschluss.
 *
 * **Warum dieselbe Zahl.** Die Pendenz ist im Regelfall seine Abschrift: «zum
 * Kostendach von CHF 8'000» wird zu «Offerte einholen, Kostendach CHF 8'000».
 * Wäre sie hier grösser, entstünde eine Pendenz, die sich aus keinem Beschluss
 * mehr füllen liesse; wäre sie kleiner, ginge die Übernahme mit einer
 * Kürzung aus, die niemand bestellt hat.
 *
 * Und sie ist keine willkürliche Bequemlichkeit: Die Pendenz steht später in
 * einer Liste und auf der Traktandenliste des Folgejahres. Was dort nicht in
 * eine Zeile passt, ist keine Pendenz, sondern ein Votum.
 */
export const PENDENZ_HOECHSTENS = 600;

export interface Pendenzeingabe {
	text: string;
	verantwortlich?: string | null;
	fristArt: string;
	/** Nur bei `fristArt === 'datum'`, dann Pflicht. */
	fristDatum?: string | null;
}

export interface Pendenz {
	id: string;
	versammlungId: string;
	traktandumId: string;
	text: string;
	verantwortlich: string | null;
	fristArt: Fristart;
	fristDatum: string | null;
	zustand: Pendenzzustand;
	zustandSeit: string;
	abschlussNotiz: string | null;
	erfasstAm: string;
}

/**
 * Prüft eine Eingabe und gibt sie geputzt zurück.
 *
 * **Jede Schranke der Migration steht hier vorher** (`docs/gestaltung.md`:
 * «Eine Schranke der Datenbank ist keine Fehlermeldung»). Ohne das käme ein
 * leerer Satz als `new row for relation "pendenz" violates check constraint
 * "pendenz_wortlaut"` heraus, und im Saal stünde eine Fehlerseite.
 */
export function pruefePendenz(eingabe: Pendenzeingabe): {
	text: string;
	verantwortlich: string | null;
	fristArt: Fristart;
	fristDatum: string | null;
} {
	const text = (eingabe.text ?? '').trim();
	if (zeichenzahl(text) < 3) {
		throw new FachlicherFehler(
			'zu_kurz',
			'Was ist zu tun? Ein Stichwort genügt, drei Zeichen braucht es.',
			'text'
		);
	}
	if (zeichenzahl(text) > PENDENZ_HOECHSTENS) {
		throw new FachlicherFehler(
			'zu_lang',
			`Die Pendenz ist länger als ${PENDENZ_HOECHSTENS} Zeichen. Sie ist die Essenz — ` +
				'was dazu gesagt wurde, gehört ins Votum.',
			'text'
		);
	}

	const roh = (eingabe.verantwortlich ?? '').trim();
	if (roh.length > 0 && zeichenzahl(roh) < 2) {
		throw new FachlicherFehler(
			'zu_kurz',
			'Wer zuständig ist, braucht mindestens zwei Zeichen. Leer lassen geht auch.',
			'verantwortlich'
		);
	}
	const verantwortlich = roh.length > 0 ? roh : null;

	if (!(FRISTARTEN as string[]).includes(eingabe.fristArt)) {
		throw new FachlicherFehler('unbekannt', 'Diese Art von Frist gibt es nicht.', 'fristArt');
	}
	const fristArt = eingabe.fristArt as Fristart;

	const datum = (eingabe.fristDatum ?? '').trim();
	if (fristArt === 'datum') {
		if (!datum) {
			throw new FachlicherFehler('fehlt', 'Bis wann? Bitte ein Datum eintragen.', 'fristDatum');
		}
		// `istKalendertag` statt einer Gestaltprüfung: Der 31. Februar sähe
		// richtig aus und käme als rohe 22008 aus der Datenbank zurück.
		if (!istKalendertag(datum)) {
			throw new FachlicherFehler('ungueltig', 'Diesen Tag gibt es nicht.', 'fristDatum');
		}
		return { text, verantwortlich, fristArt, fristDatum: datum };
	}

	// **Ein mitgeschicktes Datum wird verworfen, nicht beanstandet.** Wer im
	// Formular erst einen Tag einträgt und dann «bis zur nächsten Versammlung»
	// wählt, hat sich entschieden; eine Absage wäre hier Pedanterie. Die
	// Schranke `pendenz_frist` verlangt ohnehin, dass beides zusammenpasst.
	return { text, verantwortlich, fristArt, fristDatum: null };
}

/** Prüft eine Zustandsangabe samt Notiz. */
export function pruefeZustand(
	zustand: string,
	notiz?: string | null
): { zustand: Pendenzzustand; notiz: string | null } {
	if (!(PENDENZZUSTAENDE as string[]).includes(zustand)) {
		throw new FachlicherFehler('unbekannt', 'Diesen Zustand gibt es nicht.', 'zustand');
	}
	const gewaehlt = zustand as Pendenzzustand;
	const roh = (notiz ?? '').trim();
	if (zeichenzahl(roh) > PENDENZ_HOECHSTENS) {
		throw new FachlicherFehler(
			'zu_lang',
			`Die Notiz ist länger als ${PENDENZ_HOECHSTENS} Zeichen.`,
			'notiz'
		);
	}
	// Beim Wiederöffnen fällt die Notiz weg — sonst stünde unter einer offenen
	// Pendenz, warum sie erledigt sei (Schranke `pendenz_notiz_nur_beim_abschluss`).
	if (gewaehlt === 'offen') return { zustand: gewaehlt, notiz: null };
	return { zustand: gewaehlt, notiz: roh.length > 0 ? roh : null };
}

/**
 * «bis 31.12.2026», «bis zur nächsten Versammlung», «ohne Termin».
 *
 * An einer Stelle, weil derselbe Satz in der Sitzungsleitung, in der Liste der
 * Gemeinschaft und im Protokoll steht. Drei Fassungen liefen bisher immer
 * auseinander.
 */
export function fristSatz(p: { fristArt: Fristart; fristDatum: string | null }): string {
	if (p.fristArt === 'datum' && p.fristDatum) {
		const [jahr, monat, tag] = p.fristDatum.split('-');
		return `bis ${tag}.${monat}.${jahr}`;
	}
	if (p.fristArt === 'naechste_versammlung') return 'bis zur nächsten Versammlung';
	return 'ohne Termin';
}

/** Die Beschriftung eines Zustands, für Oberfläche und Protokoll. */
export const ZUSTANDSWORT: Record<Pendenzzustand, string> = {
	offen: 'offen',
	erledigt: 'erledigt',
	hinfaellig: 'hinfällig'
};

/**
 * Was ein Satz über eine Pendenz braucht — ohne Zustand und ohne Herkunft.
 *
 * Als eigener Typ, damit das Protokoll ihn führen kann, ohne die ganze Zeile zu
 * kennen: Es zeigt bewusst **nicht**, wie es heute um sie steht (Begründung bei
 * `Protokollzeile.pendenzen`).
 */
export interface Pendenzangabe {
	text: string;
	verantwortlich: string | null;
	fristArt: Fristart;
	fristDatum: string | null;
}

/**
 * Die Pendenz in einem Satz — für das Protokoll und die Liste.
 *
 * Ohne Zustand: Wo der Satz steht, steht der Zustand daneben oder ist aus dem
 * Zusammenhang klar (im Protokoll der Sitzung sind alle neu und damit offen).
 */
export function pendenzSatz(p: Pendenzangabe): string {
	const wer = p.verantwortlich ? `${p.verantwortlich}: ` : '';
	return `${wer}${p.text} (${fristSatz(p)})`;
}
