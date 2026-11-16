/**
 * Regelwerk, Fassung 2026-10-09.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert an einer Karte die
 * Hinweise, an keiner das Erfordernis und an keinem Weg durch den
 * Entscheidbaum etwas.
 *
 * **`k-kenntnisnahme`.** Die Karte sagte seit 2026-09-23, über nicht
 * Angekündigtes werde nur beschlossen, «wenn das Reglement es ausdrücklich
 * zulässt», und ein Beschluss einer vollzähligen Versammlung ohne
 * Widerspruch «hält praktisch; halten Sie beides im Protokoll fest». Seit
 * Block 3 der Universalversammlung (29.09.2026) nennen die Absagen in Votum
 * beide Ausnahmen gleichrangig (`NICHT_ANGEKUENDIGT_GRUNDSATZ` in
 * `domain/ausnahmen.ts`, durch Laien- und Fachprüfung). Die Karte sagt jetzt
 * dasselbe, mit der Zurückhaltung, zu der der Kommentar rät (Rz. 38, 39 ad
 * Art. 712n), und dem Vermerk im Protokoll. Nach Laien- und Fachprüfung dazu:
 * was als Widerspruch gilt und wann, dass ein Beschluss ohne Ausnahme
 * anfechtbar ist, und dass Anträge zum Ablauf nicht gemeint sind. Aus zwei
 * Hinweisen werden vier, geordnet nach dem, was die Leitung zuerst braucht.
 * Codeprüfung Block 3, N-3; Auftrag
 * `.auftraege/2026-09-29-votum-universalversammlung-rest.md`, Block 4b.
 *
 * **Ohne Aussage über das Werkzeug**, weil der Export die Karte wörtlich auf
 * die Website nimmt (`scripts/quorumsbaum-export.mjs`, `UMFORMULIERUNGEN`):
 * Was Votum zulässt, steht in seinen Absagen, nicht hier.
 *
 * Texte nach Laien- und Fachprüfung in vier Runden
 * (`quellen/pruefung/berichte/2026-09-29-kenntnisnahme-karte.md`).
 */

import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_08 } from './quorum-2026-10-08';

/**
 * Grundsatz, beide Ausnahmen, das Mehr und was nicht gemeint ist, in einem
 * Hinweis: Die Leitung liest an der Versammlung zuerst diesen (Laienprüfung
 * Runde 2, N.5, N.6). Das Mehr als Folgerung (Fachprüfung Runde 2, Frage 2):
 * Art. 67 Abs. 3 regelt, ob beschlossen werden darf, nicht mit welchem Mehr.
 */
export const KENNTNISNAHME_AUSNAHMEN =
	'Wird während der Behandlung doch ein Antrag in der Sache gestellt, darf darüber in der Regel ' +
	'nicht beschlossen werden. Geschützt ist, wer auf die Traktandenliste vertraut hat (ZGB Art. 67 ' +
	'Abs. 3 i.V.m. Art. 712m Abs. 2). Ausnahmen gibt es zwei: Das Reglement gestattet es ' +
	'ausdrücklich, oder die Versammlung tagt als Universalversammlung (SVIT-Kommentar Rz. 28, 39 ' +
	'und 84 ad Art. 712n). Ob Ihr Reglement es gestattet, klären Sie am besten vor der ' +
	'Versammlung. Greift keine der beiden Ausnahmen, gehört der Antrag auf die Traktandenliste der ' +
	'nächsten Versammlung. Greift eine, gilt für den Beschluss dasselbe Mehr, wie wenn der Antrag ' +
	'angekündigt gewesen wäre; knüpft Ihr Reglement die Ausnahme an eine Bedingung, muss auch diese ' +
	'erfüllt sein. Anträge zum ' +
	'Ablauf, etwa der Schluss der Diskussion, sind nicht gemeint: Über sie wird sofort ' +
	'abgestimmt, in der Regel mit dem einfachen Mehr (SVIT-Kommentar Rz. 76a und 98a ad ' +
	'Art. 712n).';

/** Vor dem Ablauf der Universalversammlung, damit er davor gelesen wird (Laien N.6). */
export const KENNTNISNAHME_ZURUECKHALTUNG =
	'Auch wo eine Ausnahme greift, rät die Fachliteratur zur Zurückhaltung: Die Ankündigung soll ' +
	'allen Zeit geben, sich vorzubereiten (SVIT-Kommentar Rz. 38 und 39 ad Art. 712n). Ist die ' +
	'Sache nicht dringend, traktandieren Sie sie für die nächste Versammlung. Wird doch ' +
	'beschlossen, halten Sie im Protokoll fest, worauf sich der Beschluss stützt: auf die ' +
	'Bestimmung des Reglements, oder wer da war und dass auf Ihre Frage niemand widersprochen hat. ' +
	'Widerspricht jemand, gehört auch das ins Protokoll; bei der Universalversammlung wird dann ' +
	'nicht beschlossen.';

/**
 * Was «Universalversammlung» im Saal heisst, mit dem Vermerk im Protokoll am
 * Schluss (Fachprüfung Runde 1, Befunde 1 und 2; Laienprüfung 1.1, 1.2, 2.1,
 * Runde 2 N.3). «Persönlich», weil offen ist, ob eine Vertretung genügt
 * (Frage 54); die Nein-Stimme als Folgerung aus BGE 136 III 174 (Regeste,
 * E. 5.1.2).
 */
export const KENNTNISNAHME_UNIVERSAL =
	'Universalversammlung heisst: Alle Eigentümer sind persönlich da, und niemand widerspricht, ' +
	'dass heute darüber beschlossen wird. Ob eine Vertretung genügt, ist nicht geklärt; ist jemand ' +
	'nur vertreten, traktandieren Sie die Sache besser. Gehört eine Wohnung mehreren und ist nur ' +
	'einer da, gilt dasselbe. Fragen Sie vor der Abstimmung, ob jemand widerspricht. Ein ' +
	'Widerspruch genügt, dann wird nicht beschlossen. Eine Nein-Stimme ist kein Widerspruch (BGE ' +
	'136 III 174).';

/**
 * Was gilt, wenn trotzdem beschlossen wird, für die Eigentümerin (Fachprüfung
 * Runde 1, Frage 3; Runde 2, B1 und B2; Laienprüfung 1.4, Runde 2 N.1, N.2,
 * N.4). Anfechtbar vorneweg, das Widersprechen mit demselben Wort wie oben,
 * Gericht und Fristbeginn wie in der Fassung 2026-09-30.
 */
export const KENNTNISNAHME_ANFECHTUNG =
	'Wird ohne eine dieser Ausnahmen beschlossen, ist der Beschluss anfechtbar. Er gilt, bis ein ' +
	'Gericht ihn aufhebt (SVIT-Kommentar Rz. 67 und 68 ad Art. 712n, Rz. 207 ad Art. 712m). Wer an ' +
	'der Versammlung war oder vertreten war, kann sich auf die fehlende Ankündigung nur berufen, ' +
	'wenn er oder sein Vertreter vor der Abstimmung widersprochen hat, auch wenn niemand danach ' +
	'fragt (BGE 136 III 174 E. 5.1; SVIT-Kommentar Rz. 230b und Rz. 26 ad Art. 712m). Achten Sie ' +
	'darauf, dass Ihr Widerspruch oder der Ihres Vertreters im Protokoll steht. Angefochten wird ' +
	'innert eines Monats beim Gericht, in der Regel mit einem ' +
	'Schlichtungsgesuch. Die Frist läuft für Anwesende und Vertretene ab der Versammlung, für die ' +
	'übrigen, sobald sie vom Beschluss erfahren, in der Regel mit der Zustellung des Protokolls ' +
	'(ZGB Art. 75 i.V.m. Art. 712m Abs. 2; SVIT-Kommentar Rz. 230 und 230a ad Art. 712m).';

/** Die beiden Hinweise der Vorfassung, am Wortanfang erkannt; genau einmal. */
const ALT_ANFAENGE = [
	'Wird während der Behandlung doch ein Antrag gestellt, darf darüber in der Regel',
	'Sind ausnahmsweise alle Eigentümer anwesend und widerspricht niemand'
];

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function kenntnisnahme(k: Ergebnisknoten): Ergebnisknoten {
	const alt = k.hinweise ?? [];
	const treffer = ALT_ANFAENGE.map((a) => alt.filter((h) => h.startsWith(a)).length);
	/*
	 * **Beim Laden werfen, statt still den alten Satz zu behalten.** Der Ersatz
	 * läuft über den Wortanfang; wer die Vorfassung umformuliert, liefe sonst
	 * ohne Fehler mit dem alten Text (dieselbe Falle wie 2026-10-05).
	 */
	if (treffer.some((n) => n !== 1)) {
		throw new Error(
			'Fassung 2026-10-09: Die Hinweise von k-kenntnisnahme sind nicht die der Vorfassung.'
		);
	}
	return {
		...k,
		hinweise: alt.flatMap((h) =>
			h.startsWith(ALT_ANFAENGE[0])
				? [KENNTNISNAHME_AUSNAHMEN]
				: h.startsWith(ALT_ANFAENGE[1])
					? [KENNTNISNAHME_ZURUECKHALTUNG, KENNTNISNAHME_UNIVERSAL, KENNTNISNAHME_ANFECHTUNG]
					: [h]
		)
	};
}

export const REGELWERK_2026_10_09 = {
	...REGELWERK_2026_10_08,
	fassung: '2026-10-09',

	quellen: [
		...REGELWERK_2026_10_08.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712n Rz. 5a und 28 (Universalversammlung: alle anwesend, ' +
			'Teilnahme ohne Vorbehalt als Verzicht), Rz. 38 (von der Beschlussfassung ohne ' +
			'Traktandierung abzuraten), Rz. 39 (Universalversammlung entscheidet auch ohne ' +
			'Traktandenliste; nicht ohne Not darauf verzichten), Rz. 67 und 68 (unvollständige ' +
			'Traktandenliste: eher anfechtbar als nichtig), Rz. 76a und 98a (Ordnungsanträge), Rz. 84 ' +
			'(beide Ausnahmen: Universalversammlung und Reglement); Art. 712m Rz. 207 (der Beschluss ' +
			'wirkt, bis er aufgehoben ist), Rz. 230 und 230a (Monatsfrist, Verwirkung, Fristbeginn ' +
			'für Vertretene), Rz. 230b (ungenügende Traktandierung vor Ort rügen).',
		'BGE 136 III 174 E. 5.1 (einen Verfahrensmangel vor der Beschlussfassung über die ' +
			'betroffene Frage beanstanden, Art. 2 ZGB).'
	],

	knoten: REGELWERK_2026_10_08.knoten.map(
		(k): Ergebnisknoten => (k.id === 'k-kenntnisnahme' ? kenntnisnahme(k) : k)
	),

	freigabevermerk:
		REGELWERK_2026_10_08.freigabevermerk +
		' Am 09.10.2026 nennt die Karte zur Kenntnisnahme neu auch die zweite Ausnahme, unter der ' +
		'über einen nicht angekündigten Antrag beschlossen werden kann: die Universalversammlung. ' +
		'Sie sagt, was dort als Widerspruch gilt, dass ein Beschluss, für den keine Ausnahme greift, ' +
		'anfechtbar ist, und dass Anträge zum Ablauf nicht gemeint sind. Am Mehrheitserfordernis ' +
		'ändert sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
