/**
 * Fassung 2026-11-26: die Rücknahme einer Übertragung an die Bewirtschaftung (Pendenzen «Hilfe zu
 * `f3-1-quoren`», «Widerruf: Übertragung im Gründungsreglement, später mit Mehrheit geändert» und
 * «Widerruf: der sichere Weg, wenn das Reglement für seine Änderung ein anderes Mehr setzt»; Berichte
 * `quellen/pruefung/berichte/2026-11-17-votum-widerruf-fondsregel-*`, Fach F2-1, Laien L4-1 und L5-2),
 * dazu drei niedrige Befunde aus der Pendenz «Fassung 2026-11-22, nicht übernommene Befunde» (Laien
 * VK-L-6, VK3-L-2; Fach F4-1; Berichte `…/2026-11-18-votum-korrektur-abzug-2026-11-21-*`).
 *
 * **Geprüft** in sechs Runden Laien- und Fachprüfung, je als eigener Agent, die letzte je ohne Befund:
 * `quellen/pruefung/zu-pruefen-2026-11-18-votum-ruecknahme-uebertragung{,-runde2,…,-runde6}.md`, Berichte
 * `quellen/pruefung/berichte/2026-11-18-votum-ruecknahme-uebertragung-{laien,fach}{,-runde2,…,-runde6}.md`.
 * **Kennungen in den Kommentaren:** «Runde n» nennt die Runde dieser Prüfung, in der ein Satz neu gelesen
 * wurde; der Befund dazu steht im Bericht der Runde davor (F2-5 in `…-fach-runde2.md`). «Prüfung 18.11.»
 * meint ihre Runde 1. Kennungen ohne beides gehören zu den zwei Serien oben (F2-1, L4-1, L5-2 vom
 * 17.11.2026; VK-L-6, VK3-L-2, F4-1 aus der Korrektur am Abzug 2026-11-21).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-25 abgeleitet. Die Fassungen bis
 * 2026-11-25 bleiben unverändert. Kein Mehr ändert sich.
 *
 * **Was sich ändert:**
 *
 *  - Die Hilfe der Antwort `f3-1-quoren` sagt, welche Antwort die Rücknahme einer Übertragung braucht
 *    (F2-1): die gewöhnliche Bestimmung, wenn die Übertragung später mit Mehrheit ins Reglement kam oder
 *    nur eine solche Erweiterung zurückgenommen wird; die Antwort zu Zuständigkeit oder Quoren als sicherer
 *    Weg beim Begründungsakt; die gewöhnliche Bestimmung für eine Klausel über alltägliche Aufträge; bei
 *    einer Einstimmigkeitsklausel überall statt der gewöhnlichen Bestimmung die Antwort dazu (L6).
 *  - Der Widerruf an beiden Wahlkarten nennt den sicheren Weg, wenn das Reglement für seine
 *    Änderung ein anderes Mehr setzt (L5-2), und was für eine Übertragung des Gründungsreglements
 *    gilt, die eine Revision übernommen oder erweitert hat (L4-1). Die Sätze passen auch in den
 *    FAQ-Kasten «Befugnisse zurücknehmen» der Website; ihn zieht die Website selbst nach.
 *  - An der Prozessführung nennt die Begründung in Anwendung und Website die Erstreckung einer
 *    Frist des Gerichts (F4-1), auf beiden Seiten des Paars im Export.
 *  - Nur Website: an der Wahl mit erweiterten Kompetenzen die Abrede im Vertrag nach K (VK3-L-2); an
 *    der Prozessführung nach K die Erstreckung (F4-1). VK-L-6 bleibt ohne Änderung: Die Lehre kennt
 *    keine Pflicht, zuerst zu verlängern, die Praxis ist geteilt, und der Halbsatz machte aus einer
 *    Möglichkeit eine Bedingung (Prüfung 18.11., Fach Frage 7 und F-3).
 */
import type { Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_25, VOR_K as VOR_K_VORHER, NACH_K as NACH_K_VORHER, nachDieserFassung as nachDerVorfassung } from './quorum-2026-11-25';
import type { Absatz } from './quorum-2026-11-23';
import { WIDERRUF_WEBSITE as WIDERRUF_WEBSITE_VORHER } from './quorum-2026-11-22';
import { WAEHLEN_ERWEITERT_ID } from './quorum-2026-11-21';

const VOR = REGELWERK_2026_11_25;

export const QUOREN_ANTWORT = 'f3-1-quoren';
export const PROZESS_ID = 'k-prozessfuehrung';
export const WAEHLEN_ID = 'k-bewirtschaftung-waehlen';

// ── Die Ersetzungen im Wortlaut, mit der Zahl der Stellen ─────────────────────

/**
 * Hilfe zu `f3-1-quoren`, nach dem Satz zur Klausel über alltägliche Aufträge (Fach F2-1, produktseitig).
 * Runde 2: hinter Regel und Ausnahme, damit sich die Ausnahme nicht auf die Rücknahme bezieht (Laien L-1);
 * mit der Einstimmigkeitsklausel, an deren Antwort L6 wirkt (Fach F-1, Laien L-3), und der Erweiterung (Laien L-2).
 * Die Vergabeklausel bleibt auch aus dem Begründungsakt bei der gewöhnlichen Bestimmung (Runde 4, Fach F3-1).
 */
export const QUOREN_HILFE_VORHER = 'Soll sie im Reglement stehen, wählen Sie dafür die gewöhnliche Bestimmung.';
export const QUOREN_HILFE =
	QUOREN_HILFE_VORHER +
	// Runde 5, Fach F4-1: nur die später mit Mehrheit hineingekommene Übertragung, wie die Sätze zu Votum.
	' Die gewöhnliche Bestimmung gilt auch für die Rücknahme einer Übertragung an die Bewirtschaftung, die später ' +
	'mit Mehrheit ins Reglement kam (SVIT-Kommentar Rz. 70 ad Art. 712s). ' +
	// Runde 4, Laien L3-2: gleich nach dem Satz, den er ersetzt; Runde 3, Fach F2-1: nur statt der gewöhnlichen
	// Bestimmung, nicht beim Begründungsakt. Runde 6, Fach F5-1 und Laien L5-1: auch für die Vergabeklausel unten.
	'Verlangt Ihr Reglement für seine eigene Änderung Einstimmigkeit, wählen Sie überall, wo diese Hilfe die ' +
	'gewöhnliche Bestimmung nennt, die Antwort dazu. ' +
	// Runde 3: die Antwort beim Namen (Laien L2-2).
	'Stand die Übertragung schon im Begründungsakt oder kam sie mit der Zustimmung aller ins Reglement, ist die ' +
	'Antwort zu Zuständigkeit oder Quoren der sichere Weg. ' +
	// Runde 4, Fach F3-1 (hoch, Laien L2-1): Art. 647a Abs. 2 schliesst die Einstimmigkeit für die Vergabeklausel
	// aus, auch aus dem Begründungsakt (Rz. 78 ad Art. 712g); BGer 5C.110/2001 E. 2b trägt das Gegenteil nicht.
	// Runde 6, Laien L5-2: gleich nach dem Satz zum Begründungsakt.
	'Eine Klausel, die nur sagt, wer alltägliche Aufträge vergibt, nehmen Sie mit der gewöhnlichen Bestimmung zurück ' +
	'(ZGB Art. 647a Abs. 2, 712g Abs. 3). Das gilt auch, wenn sie schon im Begründungsakt stand oder später erweitert ' +
	'wurde. ' +
	// Runde 3: «mit Mehrheit» (Fach F2-2), die zwei Traktanden auch hier (Laien L2-4); Runde 6: nicht für die
	// Vergabeklausel (Laien L4-2).
	'Nehmen Sie bei einer anderen Übertragung nur eine spätere, mit Mehrheit beschlossene Erweiterung zurück, bleibt ' +
	'es bei der gewöhnlichen Bestimmung. Nehmen Sie eine so erweiterte Übertragung ganz zurück, legen Sie zwei ' +
	'Traktanden an, eines für die Erweiterung und eines für den Rest. ' +
	// Runde 6, Fach F5-2: nicht direkt nach dem Satz zur Vergabeklausel.
	'Was zum Begründungsakt zählt, sagt der Hinweis zur Rücknahme an der Karte «Bewirtschaftung wählen».';

/** Widerruf, nach dem Satz zum Streit um das Mehr des Reglements (Laien L5-2; Prüfung 18.11., Fach Frage 6: «beide»). */
export const STREIT_VORHER =
	'Ob das Reglement für seine ' +
	'eigene Änderung ein anderes Mehr setzen darf, das einfache oder etwa die Zustimmung aller, ist umstritten ' +
	'(Rz. 40, 125 und 145 ad Art. 712g).';
export const SICHER_BEIDE =
	'Auf der sicheren Seite ist ein Beschluss, der beide erreicht, das Mehr Ihres Reglements und das ' +
	'qualifizierte Mehr.';
export const STREIT = `${STREIT_VORHER} ${SICHER_BEIDE}`;

/**
 * Widerruf, nach dem Satz zum Reglement als Bestandteil des Begründungsakts (Laien L4-1; Prüfung 18.11., Fach Frage 5:
 * eine Folgerung aus Art. 712g Abs. 2, Rz. 120, 146 ad Art. 712g und BGer 5C.110/2001 E. 2b).
 * Runde 2: das Beispiel ohne Betrag, weil ein Vergabebetrag nach der Fassung 2026-11-25 nicht zählt;
 * getrennt abstimmen und die alte Fassung bereitlegen (Prüfung 18.11., Fach F-2).
 */
export const BESTANDTEIL_VORHER =
	'Reglement, das bei der Begründung als sein Bestandteil erlassen wurde, wenn die Übertragung schon damals darin stand.';
export const SPAETER_GEAENDERT =
	'Hat eine spätere Revision sie unverändert übernommen, gilt das weiter. Hat eine Versammlung sie später mit ' +
	'Mehrheit erweitert, etwa auf weitere gemeinschaftliche Teile, kam nur diese Erweiterung nach der Begründung ins ' +
	'Reglement. Ihre Rücknahme allein braucht deshalb das Mehr wie eine Übertragung, die später ins Reglement kam; ' +
	'für die ganze Übertragung bleibt die Zustimmung aller der sichere Weg. Wollen Sie eine so erweiterte ' +
	// Runde 3, Laien L2-5: was «scheitert» heisst.
	'Übertragung ganz zurücknehmen, stimmen Sie über die Erweiterung und den Rest getrennt ab. Erreicht der Rest ' +
	'nicht die Zustimmung aller, gilt die Rücknahme der Erweiterung trotzdem. Legen Sie dafür die Fassung des ' +
	'Reglements von der Begründung bereit.';
export const BESTANDTEIL = `${BESTANDTEIL_VORHER} ${SPAETER_GEAENDERT}`;

/** Widerruf, Sätze zu Votum: die Rücknahme nur der Erweiterung (Laien L4-1) und L6 (Prüfung 18.11., Fach F-1). */
export const IN_VOTUM_VORHER =
	'Mehrheitsbeschluss ins Reglement, wählen Sie unter «Was soll geändert werden?» die Antwort «Reglement, ' +
	'gewöhnliche Bestimmung».';
export const NUR_ERWEITERUNG =
	'Dasselbe gilt, wenn Sie nur eine spätere Erweiterung zurücknehmen. Verlangt Ihr Reglement für seine eigene ' +
	'Änderung Einstimmigkeit, wählen Sie in beiden Fällen die Antwort dazu; dann wirkt L6.';
export const IN_VOTUM = `${IN_VOTUM_VORHER} ${NUR_ERWEITERUNG}`;

/** Widerruf, Sätze zu Votum, nach dem sicheren Weg beim Begründungsakt: zwei Traktanden (Prüfung 18.11., Fach F-2). */
// Mit «zur Bestimmung über», damit der Anker nicht auch den Satz der Hilfe zu `f3-1-quoren` trifft.
export const ZWEI_TRAKTANDEN_VORHER = 'die Antwort zur Bestimmung über Zuständigkeit oder Quoren der sichere Weg.';
export const ZWEI_TRAKTANDEN =
	ZWEI_TRAKTANDEN_VORHER +
	// Runde 3, Laien L2-4: nur, wer eine Erweiterung hat.
	' Nehmen Sie eine so erweiterte Übertragung ganz zurück, legen Sie dafür zwei Traktanden an, für die Erweiterung ' +
	'und für den Rest, je mit seiner Antwort.';

/**
 * Begründung an `k-prozessfuehrung`, in Anwendung und Website (Fach F4-1, E1 und E2). Runde 2: nur eine
 * Frist, die das Gericht gesetzt hat, und vor ihrem Ablauf (Fach F-5); was gilt, wenn das nicht hilft (Laien L-6).
 */
export const DRINGLICH_VORHER =
	'Dringlich ist es etwa, wenn eine Frist des Gerichts oder die Verjährung abläuft, bevor die Versammlung ' +
	'entscheiden kann (SVIT-Kommentar Rz. 78 ad Art. 712t).';
export const ERSTRECKUNG =
	'Bei einer Frist, die das Gericht gesetzt hat, beantragt die Verwaltung vor ihrem Ablauf eine Erstreckung, damit ' +
	'die Versammlung entscheiden kann (ZPO Art. 144 Abs. 2). Ist sie kurz vor Ablauf noch nicht gewährt, handelt ' +
	// Runde 3, Fach F2-5: auch ohne Entscheid des Gerichts bis zum Ablauf.
	'die Verwaltung dringlich; gesetzliche Fristen, etwa für eine Berufung, lassen sich nicht erstrecken (ZPO Art. 144 Abs. 1).';
export const DRINGLICH = `${DRINGLICH_VORHER} ${ERSTRECKUNG}`;

/** Je Ersetzung: alt, neu, wie oft sie im Regelwerk der Vorfassung steht (der Widerruf sechsmal wie in 2026-11-22). */
export const ERSETZUNGEN: readonly (readonly [string, string, number])[] = [
	[QUOREN_HILFE_VORHER, QUOREN_HILFE, 1],
	[STREIT_VORHER, STREIT, 6],
	[BESTANDTEIL_VORHER, BESTANDTEIL, 6],
	[IN_VOTUM_VORHER, IN_VOTUM, 6],
	[ZWEI_TRAKTANDEN_VORHER, ZWEI_TRAKTANDEN, 6],
	[DRINGLICH_VORHER, DRINGLICH, 1]
];

/** Ersetzt in jedem Text des Regelwerks und zählt, wie oft (wie in der Fassung 2026-11-25). */
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

// ── Die Proben gegen die Vorfassung ──────────────────────────────────────────

let ersetzt: Regelwerk = VOR;
for (const [alt, neu, erwartet] of ERSETZUNGEN) {
	const z = { n: 0 };
	ersetzt = ersetzeUeberall(ersetzt, alt, neu, z);
	if (z.n !== erwartet) {
		throw new Error(`Fassung 2026-11-26: «${alt.slice(0, 50)}…» steht ${z.n}-mal statt ${erwartet}-mal.`);
	}
}
const ERSETZT = ersetzt as typeof VOR;
const quoren = ERSETZT.fragen.flatMap((f) => f.antworten).find((a) => a.id === QUOREN_ANTWORT);
if (!quoren?.hilfe?.includes(QUOREN_HILFE)) {
	throw new Error(`Fassung 2026-11-26: Die Hilfe zu «${QUOREN_ANTWORT}» trägt den Satz zur Rücknahme nicht.`);
}

/**
 * Ein Wortlaut der Fassungen 2026-11-13 bis 2026-11-25, wie er in dieser Fassung lautet:
 * die Ersetzungen der Vorfassungen und die dieser Fassung. Für den Website-Abzug.
 */
export function nachDieserFassung(text: string): string {
	let t = nachDerVorfassung(text);
	for (const [alt, neu] of ERSETZUNGEN) t = t.split(alt).join(neu);
	return t;
}

/** Ersetzt genau einmal und bricht sonst ab. */
function einmal(text: string, alt: string, neu: string, wo: string): string {
	if (text.split(alt).length !== 2) throw new Error(`Fassung 2026-11-26: «${alt.slice(0, 50)}…» steht nicht genau einmal ${wo}.`);
	return text.replace(alt, () => neu);
}

/**
 * **Nur für den Website-Abzug:** der Widerruf ohne die Sätze zu Votum, mit denselben zwei
 * Einfügungen wie in der Anwendung (L4-1, L5-2). Seite Website des Paars im Export.
 */
export const WIDERRUF_WEBSITE = einmal(
	einmal(WIDERRUF_WEBSITE_VORHER, STREIT_VORHER, STREIT, 'im Widerruf der Website'),
	BESTANDTEIL_VORHER,
	BESTANDTEIL,
	'im Widerruf der Website'
);

/**
 * **Nur für den Website-Abzug:** die Begründung der Prozessführung mit der Erstreckung (F4-1).
 * Seite Website des Paars im Export; die Anwendung bekommt den Satz über `ERSETZUNGEN`.
 */
export const mitErstreckung = (begruendung: string): string =>
	einmal(begruendung, DRINGLICH_VORHER, DRINGLICH, 'in der Begründung der Prozessführung');

/** **Nur für den Website-Abzug:** Absatz nach K an der Wahl (Laien VK3-L-2). */
export const ABREDE_VORHER =
	'Vereinbaren Sie mit ihr schriftlich, dass sie Kompetenzen über die gewöhnliche Verwaltung hinaus bis ' +
	'zum Abschluss des Verfahrens nur nutzt, wo es eilt.';
export const ABREDE =
	// Runde 2: der Zeitraum ausdrücklich (Laien L-5), der geschlossene Vertrag (Fach F-4).
	'Halten Sie schon im Vertrag mit ihr fest, dass sie Kompetenzen über die gewöhnliche Verwaltung hinaus nur ' +
	'nutzt, wo es eilt. Das gilt bis zum Ende der Wartezeit nach der Anfechtungsfrist. ' +
	// Runde 3, Fach F2-4: auch die Klagefrist nach einer gescheiterten Schlichtung; F2-3: Schriftform nur zum Beleg.
	'Ist ein Gesuch eingegangen, gilt es, bis das Verfahren endgültig abgeschlossen und die Wartezeit nach einer ' +
	'Klagebewilligung vorbei ist. Ist der Vertrag schon geschlossen, braucht es dafür eine Ergänzung, der sie ' +
	'zustimmen muss (SVIT-Kommentar Rz. 71 ad Art. 712s). Halten Sie sie schriftlich fest, damit sie belegt ist ' +
	'(Rz. 69 ad Art. 712s).';

/** **Nur für den Website-Abzug:** Absatz nach K an der Prozessführung (Fach F4-1, A1). */
export const NACHHOLEN_VORHER = 'fassen Sie den neuen Beschluss so, dass er nach jeder Zählweise trägt.';
export const NACHHOLEN =
	NACHHOLEN_VORHER + ' Reicht die Frist dafür nicht, lassen Sie vor ihrem Ablauf eine Erstreckung beantragen (ZPO Art. 144 Abs. 2).';

const absatzMit = (a: Absatz, alt: string, neu: string, wo: string): Absatz => ({ ...a, text: einmal(a.text, alt, neu, wo) });

/** Der Fallteil vor K bleibt wie in der Fassung 2026-11-25 (Prüfung 18.11., Fach F-3: VK-L-6 ohne Änderung). */
export const VOR_K = VOR_K_VORHER;

export const NACH_K: Readonly<Record<string, Absatz>> = Object.fromEntries(
	Object.entries(NACH_K_VORHER).map(([id, a]) => [
		id,
		id === WAEHLEN_ERWEITERT_ID
			? absatzMit(a, ABREDE_VORHER, ABREDE, 'nach K an der Wahl')
			: id === PROZESS_ID
				? absatzMit(a, NACHHOLEN_VORHER, NACHHOLEN, 'nach K an der Prozessführung')
				: a
	])
);

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_26 = {
	...ERSETZT,
	fassung: '2026-11-26',

	freigabevermerk:
		VOR.freigabevermerk +
		' In der Fassung 2026-11-26 sagt die Hilfe zur Bestimmung über Zuständigkeit oder Quoren, wie eine ' +
		'Übertragung an die Bewirtschaftung zurückgenommen wird, der Hinweis zur Rücknahme nennt den sicheren Weg ' +
		'bei einem anderen Mehr des Reglements und die später erweiterte Übertragung, und die Begründung der ' +
		'Prozessführung nennt die Erstreckung einer Frist des Gerichts.'
} satisfies Regelwerk;
