/**
 * Die allgemeinen Feiertage der Schweiz, soweit sie für die Werktagsrechnung
 * der Einberufungsfrist zählen (Produktentscheid 06.10.2026, «Bundesweite
 * Feiertage», Wortwahl nach dem Produktentscheid «allgemeine Feiertage»).
 * «Allgemein», nicht «bundesweit»: Rechtlich ist nur der
 * 1. August ein Bundesfeiertag (Art. 110 Abs. 3 BV); die übrigen sind kantonal,
 * gelten aber fast überall (Fachprüfung Runde 2, 06.10.2026).
 *
 * Gezählt werden Neujahr, Karfreitag, Ostermontag, Auffahrt, Pfingstmontag,
 * der 1. August, Weihnachten und der Stephanstag. Kantonale Feiertage fehlen
 * bewusst, auch der 2. Januar; warum, steht bei `werktagDavor` in
 * `einberufungsfrist.ts`.
 *
 * Rein: Die beweglichen Feiertage werden aus dem Ostersonntag gerechnet, nicht
 * aus einer Liste mit Jahreszahlen, die still ausläuft.
 */
import { tageSpaeter } from './versammlung';

/**
 * Der Ostersonntag eines Jahres im gregorianischen Kalender, als `JJJJ-MM-TT`.
 *
 * Nach dem Verfahren von Meeus, Jones und Butcher; es gilt ohne Ausnahmen für
 * jedes gregorianische Jahr.
 */
export function ostersonntag(jahr: number): string {
	const a = jahr % 19;
	const b = Math.floor(jahr / 100);
	const c = jahr % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const monat = Math.floor((h + l - 7 * m + 114) / 31);
	const tag = ((h + l - 7 * m + 114) % 31) + 1;
	return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
}

/** Feste Feiertage als `MM-TT`. */
const FESTE = new Set(['01-01', '08-01', '12-25', '12-26']);

/** Bewegliche Feiertage als Abstand in Tagen zum Ostersonntag. */
const NACH_OSTERN = [
	-2, // Karfreitag
	1, // Ostermontag
	39, // Auffahrt
	50 // Pfingstmontag
];

/** Ob ein Kalendertag (`JJJJ-MM-TT`) einer der allgemeinen Feiertage ist. */
export function istAllgemeinerFeiertag(datum: string): boolean {
	if (FESTE.has(datum.slice(5, 10))) return true;
	const jahr = Number(datum.slice(0, 4));
	if (!Number.isInteger(jahr) || jahr < 1583) return false;
	const ostern = ostersonntag(jahr);
	return NACH_OSTERN.some((abstand) => tageSpaeter(ostern, abstand) === datum);
}
