/**
 * Regelwerk, Fassung 2026-10-12.
 *
 * **Daten, kein Code** (AD-4). Am Erfordernis und an keinem Weg durch den
 * Entscheidbaum ändert sich etwas; es ändern zwei Hinweise.
 *
 * 1. **`k-kenntnisnahme`, Universalversammlung bei gemeinsamem Eigentum.**
 *    Produktentscheid 30.09.2026 nach der Fachprüfung zur Regel
 *    (`quellen/pruefung/berichte/2026-09-30-universalversammlung-gemeinsames-eigentum.md`):
 *    Sicher ist die Universalversammlung nur, wenn alle Eigentümer der Wohnung
 *    da sind, gleich in welcher Form sie ihnen gehört, und auch Nutzniesser,
 *    Wohnberechtigte und bei einer Pfändung, einer Pfandverwertung oder im Konkurs
 *    die zuständige Behörde. Bis 2026-10-11
 *    hiess es, nach unserer Lesart genüge eine Person. Als Lesart, nicht als
 *    geklärtes Recht (Fachprüfung Runde 1, F1, F4).
 * 2. **`k-ausschlussklage`, Hinweis zu den Angehörigen.** «Dieses Werkzeug
 *    misst die Mehrheit dann ohne die Angehörigen» stimmte seit 2026-10-11 nicht
 *    mehr für Angehörige, denen nur die Wohnung des Beklagten mitgehört
 *    (Codeprüfung 30.09.2026). Auf der Website steht der Hinweis ohne
 *    Werkzeugsätze (`ANGEHOERIGE_WEBSITE`, über `UMFORMULIERUNGEN` im Export).
 *
 * Auftrag `.auftraege/2026-09-30-kartenbefunde-kenntnisnahme-ausschlussklage.md`,
 * Nachtrag «offene Punkte».
 */

import type { Ergebnisknoten, HinweisUnterRegel } from '$lib/domain/regelwerk';
import { KENNTNISNAHME_NEU as KENNTNISNAHME_1011, REGELWERK_2026_10_11 } from './quorum-2026-10-11';

/** Befund 1: der Satz zur gemeinsamen Wohnung an der Universalversammlung. */
export const KENNTNISNAHME_1012 =
	'Gehört eine Wohnung mehreren, lässt der SVIT-Kommentar an einer einberufenen Versammlung eine ' +
	'anwesende Person von ihnen für die ganze Wohnung stimmen, ohne ausdrückliche Vollmacht der ' +
	'übrigen (Rz. 19 und 24 ad Art. 712o). Für die Universalversammlung genügt das nach unserer ' +
	'Lesart nicht: Jede von ihnen ist selbst Stockwerkeigentümerin (Rz. 3 und 5 ad Art. 712o), und wer ' +
	'ohne Vorbehalt teilnimmt, nimmt damit hin, dass ohne Ankündigung beschlossen wird (Rz. 28 und ' +
	'39 ad Art. 712n). Wörtlich sagt der Kommentar das für gemeinsames Eigentum nicht. Sicher ist ' +
	'die Universalversammlung deshalb nur, wenn alle Eigentümer der Wohnung da sind, gleich in ' +
	'welcher Form sie ihnen gehört, etwa einem Ehepaar, einer Erbengemeinschaft oder einer einfachen ' +
	'Gesellschaft. Sicher ist sie zudem nur, wenn auch da ist, wer an einer Wohnung eine ' +
	'Nutzniessung oder ein Wohnrecht hat, und bei einer Pfändung, einer Pfandverwertung oder im ' +
	'Konkurs die zuständige Behörde, denn auch sie sind einzuladen (Rz. 56 und 58 ad Art. 712n; ' +
	'Rz. 25 ad Art. 712m); ob es ohne sie geht, sagt der Kommentar nicht.';

/** Befund 2: die beiden Satzteile im Hinweis zu den Angehörigen, wie sie seit 2026-10-03 stehen. */
const MISST_ALT = 'Werkzeug misst die Mehrheit dann ohne die Angehörigen, wie ohne den Beklagten.';
const MISST_NEU =
	'Werkzeug misst die Mehrheit dann ohne die Angehörigen mit eigener Wohnung, wie ohne den ' +
	'Beklagten; eine Wohnung, die ihnen mit dem Beklagten gehört, behandelt der nächste Hinweis.';
const REICHEN_ALT = 'nur, wenn die Ja-Stimmen auch mit ihnen reichen:';
const REICHEN_NEU =
	'nur, wenn die Ja-Stimmen auch dann reichen, wenn die Angehörigen mitgezählt werden, obwohl ' +
	'sie nicht abstimmen:';

/** Ersetzt genau einmal; beim Laden werfen, statt still nichts zu tun. */
function genauEinmal(text: string, alt: string, neu: string, wo: string): string {
	const n = text.split(alt).length - 1;
	if (n !== 1) {
		throw new Error(`Fassung 2026-10-12: «${wo}» trägt «${alt}» ${n}-mal, erwartet war einmal.`);
	}
	return text.replace(alt, neu);
}

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function kenntnisnahme(k: Ergebnisknoten): Ergebnisknoten {
	const hinweise = k.hinweise ?? [];
	const treffer = hinweise.filter((h) => h.includes(KENNTNISNAHME_1011));
	if (treffer.length !== 1) {
		throw new Error(
			`Fassung 2026-10-12: «${k.id}» trägt ${treffer.length} Hinweise mit dem Satz zur gemeinsamen Wohnung, erwartet war einer.`
		);
	}
	const vorher = treffer[0];
	const neu = vorher.replace(KENNTNISNAHME_1011, KENNTNISNAHME_1012);
	return {
		...k,
		hinweise: hinweise.map((h) => (h === vorher ? neu : h)),
		...(k.hinweiseUnterRegel
			? {
					hinweiseUnterRegel: k.hinweiseUnterRegel.map(
						(u): HinweisUnterRegel => (u.hinweis === vorher ? { ...u, hinweis: neu } : u)
					)
				}
			: {})
	};
}

/** Der Hinweis zu den Angehörigen in der Anwendung, aus dem Wortlaut seit 2026-10-03. */
function angehoerigeNeu(alt: string, wo: string): string {
	return genauEinmal(genauEinmal(alt, MISST_ALT, MISST_NEU, wo), REICHEN_ALT, REICHEN_NEU, wo);
}

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function ausschlussklage(k: Ergebnisknoten): Ergebnisknoten {
	const hinweise = k.hinweise ?? [];
	const i = hinweise.findIndex((h) => h.startsWith('Ehegatte und Verwandte des Beklagten'));
	if (i < 0 || hinweise.filter((h) => h.startsWith('Ehegatte und Verwandte des Beklagten')).length !== 1) {
		throw new Error('Fassung 2026-10-12: «k-ausschlussklage» trägt den Hinweis zu den Angehörigen nicht genau einmal.');
	}
	const vorher = hinweise[i];
	const neu = angehoerigeNeu(vorher, k.id);
	return {
		...k,
		hinweise: hinweise.map((h, j) => (j === i ? neu : h)),
		hinweiseUnterRegel: (k.hinweiseUnterRegel ?? []).map((u): HinweisUnterRegel => {
			if (u.hinweis !== vorher) return u;
			// Unter einer Regel trägt der Hinweis eine eigene Fassung
			// (`ANGEHOERIGE_UNTER_REGEL`, 2026-10-08); dort steht der erste Satzteil
			// ebenso, der zweite nicht.
			const ersatz =
				u.ersatz === undefined ? undefined : genauEinmal(u.ersatz, MISST_ALT, MISST_NEU, `${k.id}, unter Regel`);
			return { ...u, hinweis: neu, ...(ersatz !== undefined ? { ersatz } : {}) };
		})
	};
}

/** Der Hinweis zu den Angehörigen in der Anwendung, ab dieser Fassung. */
export const ANGEHOERIGE_ANWENDUNG = (() => {
	const k = REGELWERK_2026_10_11.knoten.find((x) => x.id === 'k-ausschlussklage')!;
	return angehoerigeNeu(k.hinweise!.find((h) => h.startsWith('Ehegatte und Verwandte des Beklagten'))!, k.id);
})();

/**
 * Derselbe Hinweis auf der Website, ohne Werkzeugsätze: Dort rechnet nichts
 * (Laien- und Fachprüfung 30.09.2026, A3). Der Export setzt ihn über
 * `UMFORMULIERUNGEN` ein.
 */
export const ANGEHOERIGE_WEBSITE = (() => {
	const ohneMessen = genauEinmal(
		ANGEHOERIGE_ANWENDUNG,
		' Dieses ' + MISST_NEU,
		'',
		'Angehörige, Website'
	);
	return genauEinmal(
		ohneMessen,
		'verlangt dieses Werkzeug fünf Ja von neun, sicher ist die Ermächtigung erst mit sechs von zehn.',
		'braucht es sechs Ja von zehn.',
		'Angehörige, Website'
	);
})();

export const REGELWERK_2026_10_12 = {
	...REGELWERK_2026_10_11,
	fassung: '2026-10-12',

	quellen: [
		...REGELWERK_2026_10_11.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712n Rz. 28 und 39 (Universalversammlung: wer ohne ' +
			'Vorbehalt teilnimmt, verzichtet; Entscheide auch ohne Traktandenliste), Rz. 56 und 58 ' +
			'(die zuständige Behörde bei Pfändung, Pfandverwertung und Konkurs, Nutzniesser und ' +
			'Wohnberechtigte sind einzuladen); Art. 712m Rz. 25 (die Behörde übt das Stimmrecht aus); ' +
			'Art. 712o Rz. 3 (Abs. 1 betrifft Miteigentum und Gesamteigentum).'
	],

	knoten: REGELWERK_2026_10_11.knoten.map((k): Ergebnisknoten =>
		k.id === 'k-kenntnisnahme' ? kenntnisnahme(k) : k.id === 'k-ausschlussklage' ? ausschlussklage(k) : k
	),

	freigabevermerk:
		REGELWERK_2026_10_11.freigabevermerk +
		' Am 12.10.2026 sagt die Karte zur Kenntnisnahme, dass eine Universalversammlung bei einer ' +
		'Wohnung, die mehreren gehört, nur sicher ist, wenn alle ihre Eigentümer da sind; die Karte zur ' +
		'Ausschlussklage misst ohne Angehörige mit eigener Wohnung.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
