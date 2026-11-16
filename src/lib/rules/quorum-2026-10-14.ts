/**
 * Regelwerk, Fassung 2026-10-14.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert einen Hinweis der Karte
 * `k-reglement-normal`; an den Wegen durch den Entscheidbaum ändert sich
 * nichts.
 *
 * **Der Anlass** (`versammlung`, `docs/freigabe.md`, «Offen: Hinweis an
 * k-reglement-normal zur Milderung», Fachprüfung 27.09.2026, Runde 1 und 2):
 * Der Hinweis sagte, das Reglement dürfe dieses Quorum mildern, «sofern die
 * Milderung seinerzeit einstimmig beschlossen wurde» (Rz. 84 ad Art. 712g).
 * Er stellte die Milderung damit als gesichert dar. Rz. 40 ad Art. 712g nennt
 * aber die Gegenmeinung Rey/Maetzke: Sie halten eine Milderung des
 * gesetzlichen Mehrs für unzulässig. Seit der Fassung 2026-10-06 verweist der
 * Kasten derselben Karte für die Rechtslage auf diesen Hinweis; das Gewicht
 * der Aussage ist damit gestiegen, und sie muss den Streit nennen.
 *
 * **Was die Fassung tut.** Sie ersetzt den ersten Hinweis am Wortanfang durch
 * eine Fassung, die beide Meinungen und den sicheren Weg nennt; die übrigen
 * Hinweise der Karte bleiben, wie sie sind. Der Ersatz wirft beim Laden, wenn
 * der alte Hinweis nicht genau einmal vorkommt: Wer die Vorfassung umformuliert,
 * liefe sonst ohne Fehler mit dem alten Text (dieselbe Falle wie 2026-10-05 und
 * 2026-10-09).
 *
 * **Geprüft** durch Laien- und Fachprüfung; der Bericht liegt in
 * `quellen/pruefung/berichte/`.
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_13 } from './quorum-2026-10-13';

/**
 * Die neue Fassung des Hinweises zur Milderung (Laien- und Fachprüfung vom
 * 04.10.2026; Bericht in `quellen/pruefung/berichte/`).
 *
 * **Beide Meinungen, dann der sichere Weg.** Der SVIT-Kommentar bejaht die
 * Milderung und verlangt für sie die Einstimmigkeit (Rz. 40, 84 und 125);
 * Rey/Maetzke halten sie für unzulässig (Rz. 40, andere Meinung). Zur
 * Erschwerung bleibt es beim bisherigen Satz: Der SVIT-Kommentar hält sie für
 * unzulässig (Rz. 40 und 125), Steinauer lässt sie zu (ZWR S. 307 f.), das
 * Bundesgericht liess die Frage offen (BGer 5C.50/2004 E. 4.2). Wer eine
 * mildere Klausel anwendet, trägt das Risiko; sicher ist ein Beschluss nur,
 * wenn er auch das gesetzliche Erfordernis erreicht.
 */
export const REGLEMENT_MILDERUNG =
	'Ihr Reglement kann dieses Quorum mildern; ob eine solche Milderung gilt, ist aber umstritten. ' +
	'Der SVIT-Kommentar bejaht sie und verlangt für die Milderung selbst die Einstimmigkeit ' +
	'(Art. 712g Rz. 84; ergänzend Rz. 40 und 125); Rey/Maetzke halten eine Milderung des ' +
	'gesetzlichen Mehrs für ' +
	'unzulässig (andere Meinung, Rz. 40). Ob das Reglement das Mehr für seine eigene Änderung ' +
	'erschweren darf, ist ebenfalls umstritten: Der SVIT-Kommentar hält es für unzulässig ' +
	'(Art. 712g Rz. 40 und 125), Steinauer lässt es zu (ZWR S. 307 f.), das Bundesgericht hat die ' +
	'Frage offengelassen (BGer 5C.50/2004 E. 4.2). Sicher ist ein Beschluss nur, wenn er auch das ' +
	'gesetzliche Erfordernis erreicht; lassen Sie die Geltung Ihrer Klausel vor der Versammlung ' +
	'durch Ihre Verwaltung oder eine Fachperson klären.';

/** Der alte Hinweis, am Wortanfang erkannt; genau einmal. */
const ALT_ANFANG = 'Ihr Reglement darf dieses Quorum mildern, sofern die Milderung seinerzeit';

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function reglementMilderung(k: Ergebnisknoten): Ergebnisknoten {
	const alt = k.hinweise ?? [];
	const treffer = alt.filter((h) => h.startsWith(ALT_ANFANG)).length;
	if (treffer !== 1) {
		throw new Error(
			'Fassung 2026-10-14: Der Hinweis zur Milderung auf k-reglement-normal ist nicht der der Vorfassung.'
		);
	}
	return {
		...k,
		hinweise: alt.flatMap((h) => (h.startsWith(ALT_ANFANG) ? [REGLEMENT_MILDERUNG] : [h])),
		/*
		 * **Unter einer angewandten Regel bleibt der Hinweis sichtbar**, im
		 * Abschnitt «Zum gesetzlichen Erfordernis». Er sagt nicht, was diese
		 * Karte rechnet, sondern ob eine Milderung im Reglement überhaupt gilt;
		 * das ist auch dann die Frage, wenn eine hinterlegte Regel angewandt
		 * wird. Ohne diesen Eintrag fiele der neue Wortlaut durch den Wächter
		 * der Fassungsproben («kennt jeden Hinweis oder hat ihn eingeordnet»).
		 */
		hinweiseUnterRegel: [
			...(k.hinweiseUnterRegel ?? []),
			{ hinweis: REGLEMENT_MILDERUNG, zumGesetz: true }
		]
	};
}

export const REGELWERK_2026_10_14 = {
	...REGELWERK_2026_10_13,
	fassung: '2026-10-14',

	quellen: [
		...REGELWERK_2026_10_13.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 40 (Milderung möglich, a.M. Rey/Maetzke; ' +
			'Erschwerung unzulässig, BGer 5C.50/2004 E. 4.2 offen), Rz. 84 (Erleichterung einstimmig ' +
			'zu beschliessen), Rz. 125 (Einführung des einfachen Mehrs zulässig, Erschwerung ' +
			'grundsätzlich nicht; Steinauer ZWR S. 307 f.).'
	],

	knoten: REGELWERK_2026_10_13.knoten.map(
		(k): Ergebnisknoten => (k.id === 'k-reglement-normal' ? reglementMilderung(k) : k)
	),

	freigabevermerk:
		REGELWERK_2026_10_13.freigabevermerk +
		' Am 14.10.2026 nennt der Hinweis zur Milderung des Quorums beide Meinungen: Der ' +
		'SVIT-Kommentar bejaht die Milderung und verlangt für sie die Einstimmigkeit, Rey/Maetzke ' +
		'halten sie für unzulässig. Am Erfordernis und an der Rechnung ändert sich nichts. ' +
		'Zugleich klargestellt: Der Vermerk der Fassung 2026-10-06, das Werkzeug wende einen ' +
		'Stichentscheid des Verwalters nicht mehr an, ist seit dem Produktentscheid vom 28.09.2026 ' +
		'überholt; die Klausel gilt wieder (Nachzug 04.10.2026, kein Fassungsteil).'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
