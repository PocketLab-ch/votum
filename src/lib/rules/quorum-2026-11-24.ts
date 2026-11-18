/**
 * Fassung 2026-11-24: die Ermächtigung im Voraus in der Begründung der Prozessführung
 * (Produktentscheid 18.11.2026: «ok, machen», nach den Prüfungen am Website-Abzug der
 * Fassung 2026-11-23; `quellen/pruefung/berichte/2026-11-18-votum-korrektur-abzug-2026-11-22-fach{,-runde2}.md`,
 * VA-1 und Frage 4d, und `…-laien-runde2.md`, L4-3).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-23 abgeleitet. Die Fassungen bis
 * 2026-11-23 bleiben unverändert.
 *
 * **Was sich ändert:** Die Begründung an `k-prozessfuehrung` sagte «sie kann für fällige
 * Beiträge im Voraus erteilt werden (Rz. 89a ad Art. 712t)». Rz. 89a stützt sich allein auf
 * BGer 5A_590/2011 E. 8.3, und der Entscheid betraf einen bestimmten säumigen Eigentümer und
 * dessen fällige Beiträge; Rz. 88 f. halten eine allgemeine Vollmacht für unzulässig. Neu
 * sagt die Begründung den engeren, belegten Fall, in Anwendung und Website gleich, als eigener
 * Satz; der Satz davor endet jetzt bei «die Ermächtigung» und liegt mit 209 Zeichen weiter
 * über der Grenze von 180 (Bestand, vorher über 290). Die
 * Anwendung trägt dazu zwei Sätze zum Streit und zur Erneuerung, die auf der Website der Kasten
 * darunter sagt (`IM_VORAUS_NUR_ANWENDUNG`).
 */
import type { Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_23, nachDieserFassung as nachDerVorfassung } from './quorum-2026-11-23';

const VOR = REGELWERK_2026_11_23;

export const PROZESS_ID = 'k-prozessfuehrung';

export const IM_VORAUS_VORHER =
	', und sie kann für fällige Beiträge im Voraus erteilt werden (Rz. 89a ad Art. 712t).';
/** In Anwendung und Website gleich; Laien H6-1: «Diese» statt «Sie», weil «Sie» auch die Leserin sein kann. */
export const IM_VORAUS =
	'. Diese kann eigens für die fälligen Beiträge eines säumigen Eigentümers erteilt werden ' +
	'(BGer 5A_590/2011 E. 8.3; Rz. 89a ad Art. 712t).';
/**
 * **Nur in der Anwendung** (Laien L6-1, Fach F-1, je niedrig): Dort steht an dieser Karte kein
 * Kasten «Bei ausstehenden Beiträgen», der den Streit nennt und die Erneuerung empfiehlt. Auf der
 * Website steht er direkt darunter; der Abzug trägt die Begründung deshalb ohne diese zwei Sätze
 * (Paar in `scripts/quorumsbaum-export.mjs`).
 */
export const IM_VORAUS_NUR_ANWENDUNG =
	' Ob eine Ermächtigung für alle Eigentümer oder für künftige Beiträge im Voraus trägt, ist ' +
	'umstritten (Rz. 88 bis 89a ad Art. 712t). ' +
	// Runde 2, Fach F2-1: «sie» bezog sich auch auf die Ermächtigung für alle.
	'Erneuern Sie deshalb die Ermächtigung für den säumigen Eigentümer an jeder ordentlichen ' +
	'Versammlung, solange er nicht zahlt.';
/** Was die Anwendung trägt. */
export const IM_VORAUS_ANWENDUNG = `${IM_VORAUS}${IM_VORAUS_NUR_ANWENDUNG}`;

/** Ersetzt in jedem Text des Regelwerks und zählt, wie oft (wie in der Fassung 2026-11-22). */
function ersetzeUeberall<T>(wert: T, alt: string, neu: string, zaehler: { n: number }): T {
	if (typeof wert === 'string') {
		const teile = wert.split(alt);
		zaehler.n += teile.length - 1;
		return teile.join(neu) as T;
	}
	if (Array.isArray(wert)) return wert.map((w) => ersetzeUeberall(w, alt, neu, zaehler)) as T;
	if (wert && typeof wert === 'object') {
		return Object.fromEntries(
			Object.entries(wert).map(([k, w]) => [k, ersetzeUeberall(w, alt, neu, zaehler)])
		) as T;
	}
	return wert;
}

// ── Die Probe gegen die Vorfassung ───────────────────────────────────────────

const imVoraus = { n: 0 };
const ERSETZT = ersetzeUeberall(VOR, IM_VORAUS_VORHER, IM_VORAUS_ANWENDUNG, imVoraus);
if (imVoraus.n !== 1 || ERSETZT.knoten.find((k) => k.id === PROZESS_ID)?.begruendung?.includes(IM_VORAUS_ANWENDUNG) !== true) {
	throw new Error(`Fassung 2026-11-24: Der Satz zur Ermächtigung im Voraus steht ${imVoraus.n}-mal statt einmal in der Begründung von «${PROZESS_ID}».`);
}

/**
 * Ein Wortlaut der Fassungen 2026-11-13 bis 2026-11-23, wie er in dieser Fassung lautet:
 * die Ersetzungen der Vorfassungen und die dieser Fassung. Für den Website-Abzug.
 */
export function nachDieserFassung(text: string): string {
	return nachDerVorfassung(text).split(IM_VORAUS_VORHER).join(IM_VORAUS_ANWENDUNG);
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_24 = {
	...ERSETZT,
	fassung: '2026-11-24',

	freigabevermerk:
		VOR.freigabevermerk +
		' In der Fassung 2026-11-24 sagt die Begründung an der Ermächtigung zur Prozessführung, dass ' +
		'sie eigens für die fälligen Beiträge eines säumigen Eigentümers erteilt werden kann und dass eine ' +
		'Ermächtigung für alle im Voraus umstritten ist.'
} satisfies Regelwerk;
