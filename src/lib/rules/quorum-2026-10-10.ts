/**
 * Regelwerk, Fassung 2026-10-10.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert an einer Karte einen
 * Hinweis, an keiner das Erfordernis und an keinem Weg durch den
 * Entscheidbaum etwas.
 *
 * **`k-kenntnisnahme`, der Hinweis zur Universalversammlung.** Die Fassung
 * 2026-10-09 riet, bei blosser Vertretung und bei gemeinsamem Eigentum mit
 * nur einer anwesenden Person besser zu traktandieren, weil beides «nicht
 * geklärt» sei. Nachgelesen am 29.09.2026 (Frage 54 in `quellen`, Nachtrag):
 * Bei gemeinsamem Eigentum genügt eine Person je Einheit (Art. 712o Abs. 1,
 * Rz. 19 und 24 ad Art. 712o), und ob eine Vertretung genügt, regelt die
 * Gemeinschaft, denn das Gesetz setzt die Vertretung voraus und das Reglement
 * kann sie einschränken (Art. 712p; Rz. 26 bis 31 ad Art. 712m); jede
 * Vertretene zählt aber nur mit einer Vollmacht, die auch nicht Angekündigtes
 * deckt.
 * Produktentscheid 29.09.2026, festgehalten in `docs/freigabe.md`. Die Karte
 * sagt jetzt, wo die Antwort steht, statt pauschal zum Traktandieren zu raten.
 * Auftrag `.auftraege/2026-09-29-votum-vertretung-gemeinsames-eigentum-nachtrag.md`.
 *
 * **Ohne Aussage über das Werkzeug**, weil der Export die Karte wörtlich auf
 * die Website nimmt (`scripts/quorumsbaum-export.mjs`).
 *
 * Texte nach Laien- und Fachprüfung
 * (`quellen/pruefung/berichte/2026-09-29-vertretung-gemeinsames-eigentum.md`).
 */

import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_09 } from './quorum-2026-10-09';

/**
 * Was «Universalversammlung» im Saal heisst. «Da» statt «persönlich da», weil
 * bei gemeinsamem Eigentum eine Person je Einheit genügt, belegt mit Rz. 24
 * ad Art. 712o (bindet die übrigen) neben Rz. 19 (Fachprüfung Runde 1, 1.2).
 * Bei der Vertretung entscheiden Reglement und Vollmacht, nicht ein Beschluss
 * der Gemeinschaft: Er ersetzt die Vollmacht der einzelnen Vertretenen nicht
 * (Fachprüfung Runde 1, 1.1; Art. 33 Abs. 2 OR). «Im Zweifel traktandieren»
 * als Auffangfall, wenn das Reglement schweigt (Laienprüfung Runde 1, 1A).
 */
export const KENNTNISNAHME_UNIVERSAL =
	'Universalversammlung heisst: Alle Eigentümer sind da, und niemand widerspricht, dass heute ' +
	'darüber beschlossen wird. Gehört eine Wohnung mehreren, genügt nach dem SVIT-Kommentar eine ' +
	'anwesende Person von ihnen für die ganze Wohnung; eine ausdrückliche Vollmacht der übrigen ' +
	'braucht sie dafür nicht (Rz. 19 und 24 ad Art. 712o). Ob daneben auch zählt, wer nur ' +
	'vertreten ist, regelt das Gesetz nicht ausdrücklich. Es lässt die Vertretung an der ' +
	'Versammlung zu, bei der Universalversammlung spricht der Kommentar aber nur von anwesenden ' +
	'Eigentümern (ZGB Art. 712p; SVIT-Kommentar Rz. 28 ad Art. 712n). Schliesst Ihr Reglement ' +
	'Vertretene aus, zählen sie nicht. Sonst zählen sie nur, wenn ihre Vollmacht auch Geschäfte ' +
	'deckt, die nicht angekündigt waren; eine Vollmacht nur für die Traktanden der Einladung deckt ' +
	'das nicht (OR Art. 33 Abs. 2; SVIT-Kommentar Rz. 26 und 27 ad Art. 712m). Im Zweifel ' +
	'traktandieren Sie die ' +
	'Sache. Fragen Sie vor der Abstimmung, ob jemand widerspricht. Ein Widerspruch genügt, dann ' +
	'wird nicht beschlossen. Eine Nein-Stimme ist kein Widerspruch (BGE 136 III 174).';

/** Der Hinweis der Vorfassung, am Wortanfang erkannt; genau einmal. */
const ALT_ANFANG = 'Universalversammlung heisst: Alle Eigentümer sind persönlich da';

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function kenntnisnahmeUniversal(k: Ergebnisknoten): Ergebnisknoten {
	const alt = k.hinweise ?? [];
	// Beim Laden werfen, statt still den alten Satz zu behalten (wie 2026-10-09).
	if (alt.filter((h) => h.startsWith(ALT_ANFANG)).length !== 1) {
		throw new Error(
			'Fassung 2026-10-10: Die Hinweise von k-kenntnisnahme sind nicht die der Vorfassung.'
		);
	}
	return {
		...k,
		hinweise: alt.map((h) => (h.startsWith(ALT_ANFANG) ? KENNTNISNAHME_UNIVERSAL : h))
	};
}

export const REGELWERK_2026_10_10 = {
	...REGELWERK_2026_10_09,
	fassung: '2026-10-10',

	quellen: [
		...REGELWERK_2026_10_09.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712o Rz. 19 (ist ein einziges Mitglied des ' +
			'gemeinschaftlichen Eigentums anwesend, darf davon ausgegangen werden, dass es dieses gültig ' +
			'vertritt) und Rz. 24 (sein Verhalten bindet die übrigen); Art. 712m Rz. 26 (Vertretung in ' +
			'Art. 712p vorausgesetzt, mit entsprechender Vollmacht sämtliche Befugnisse) und Rz. 27 (der ' +
			'Vorsitzende prüft die Vollmacht vor der Zulassung); Art. 712n Rz. 28 (Universalversammlung: ' +
			'sämtliche Stockwerkeigentümer anwesend).',
		'OR Art. 33 Abs. 2 (der Umfang einer rechtsgeschäftlichen Vollmacht beurteilt sich nach ' +
			'ihrem Inhalt).'
	],

	knoten: REGELWERK_2026_10_09.knoten.map(
		(k): Ergebnisknoten => (k.id === 'k-kenntnisnahme' ? kenntnisnahmeUniversal(k) : k)
	),

	freigabevermerk:
		REGELWERK_2026_10_09.freigabevermerk +
		' Am 10.10.2026 sagt die Karte zur Kenntnisnahme, dass bei gemeinsamem Eigentum an der ' +
		'Universalversammlung eine Person je Wohnung genügt und dass Vertretene nur mitzählen, wenn ' +
		'das Reglement sie nicht ausschliesst und ihre Vollmacht auch nicht angekündigte Geschäfte ' +
		'deckt. Am Mehrheitserfordernis ändert sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
