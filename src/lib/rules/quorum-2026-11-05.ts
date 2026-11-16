/**
 * Fassung 2026-11-05: Die eigene Schranke des Reglements als Lesart der
 * Gemeinschaft (L6).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-04 abgeleitet, nicht
 * abgeschrieben: Jede Änderung holt sich ihren alten Wortlaut aus der
 * Vorfassung und bricht ab, wenn er dort nicht genau einmal steht oder der
 * neue schon dasteht. Auftrag F4c, Block 1 (Einteilung F3b, Zeile D1;
 * Entscheid 0018).
 *
 * **Der Anlass.** Verlangt das Reglement für seine eigene Änderung die
 * Zustimmung aller, ist umstritten, ob diese Klausel gilt: Der SVIT-Kommentar
 * hält eine Erschwerung für unzulässig (Rz. 40 und 125 ad Art. 712g), andere
 * Autoren lassen sie zu, und das Bundesgericht hat die Frage offengelassen
 * (BGer 5C.50/2004 E. 4.2). Bis hier rechnete Votum fest nach der Klausel.
 * Jetzt stellt die Gemeinschaft ein, ob Votum sie anwendet (Vorgabe) oder
 * nach dem qualifizierten Mehr von ZGB Art. 712g Abs. 3 rechnet; das
 * Ergebnis nach der anderen Wahl nennt Votum dazu, wie bei L2 und L4.
 *
 * **Was sich an der Karte `k-reglement-eigene-schranke` ändert:**
 *
 *  - Die Begründung sagt nicht mehr, dieses Werkzeug setze die Einstimmigkeit
 *    an, sondern dass die Gemeinschaft einstellt; der Schluss nennt den
 *    Beschluss, der nach beiden Wahlen besteht: dem alle zustimmen.
 *  - Das Merkmal `gegenmeinung` fällt weg. Die Lesart trägt die andere Ansicht
 *    jetzt selbst; `umstrittenSatz` schweigt an dieser Karte deshalb ab hier,
 *    und auf der Traktandenseite steht stattdessen der Satz der Lesart im
 *    Kasten der Mehrhinweise (`lesartKartensatz`).
 *  - Im Hinweis «Zum Streit» ändern sich zwei Sätze: Das Festhalten nach der
 *    strengen Lesart wird zur Verkündung nach der Einstellung der
 *    Gemeinschaft, und der Satz zur Anfechtung verliert sein «trotzdem».
 *  - `lesart` trägt L6, die andere Wahl ist «gesetz» (Art. 712g Abs. 3).
 *  - Der Freigabevermerk nennt die Lesart, wie bei L2 in der Fassung 2026-10-26.
 *  - Die Antwort «f3-1-selbst» bekommt eine Hilfe: Hat die Bestimmung unter
 *    der Frage eine eigene Antwort, gehört sie dorthin; bei Nutzungsrechten
 *    nur unter «Nach dem Gesetz», denn Art. 712g Abs. 4 verlangt die
 *    Betroffenen «zudem» und nicht statt der Klausel (Fachprüfung 05.11.2026,
 *    E-1; Runde 2, R2-E-1 und R2-M-1).
 *  - Die andere Wahl trägt ihren eigenen `einstimmigkeitsweg`: derselbe Weg
 *    mit einem Satz, dass der Beschluss mit dem Mehr ohne Vorbehalt verkündet
 *    wird und «nicht sicher» nur anfechtbar heisst (Runde 2, R2-G-3).
 *
 * **Sonst bleibt alles am Knoten**, auch `rang`, `rechtsgrundlage` und
 * `einstimmigkeitsweg`; kein anderer Knoten ändert sich, ausser der Hilfe
 * oben keine Frage, und am Erfordernis
 * ändert sich nichts: Nach der Vorgabe rechnet die Karte weiter die
 * Zustimmung aller Eigentümer.
 *
 * **Ausserhalb der Daten hängt an dieser Fassung** das zweite Ergebnis zur
 * Partei eines Vertreters im Ausstand (B3, Entscheid 0041): Votum rechnet es
 * nur für Erfordernisse ab 2026-11-05 (`VERTRETUNG_IM_AUSSTAND_AB_FASSUNG` in
 * `auszaehlung.ts`). Kein Knoten trägt es; der Fassungstest sieht es deshalb
 * nicht, die Proben stehen in `tests/domain/vertretung-im-ausstand.test.ts`
 * (Featureprüfung F4c, G1).
 *
 * **Alte Traktanden** dieser Karte aus Fassungen vor L6 rechnen ohne Lesart
 * weiter nach der Klausel, solange die Gemeinschaft auf der Vorgabe steht;
 * stellt sie auf «gesetz», sagt die Freigabe ab, bis nachgezogen ist
 * (`veralteteLesartenIn`, Review DeepSeek zu Lesarten Block 3, V1).
 */
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_04 } from './quorum-2026-11-04';

export const EIGENE_SCHRANKE_ID = 'k-reglement-eigene-schranke';

const vorher = REGELWERK_2026_11_04.knoten.find((k) => k.id === EIGENE_SCHRANKE_ID);
if (!vorher) throw new Error(`Fassung 2026-11-05: «${EIGENE_SCHRANKE_ID}» fehlt in der Vorfassung.`);

/**
 * Die Begründung der Vorfassung, hinter der der Website-Abzug die Karte zeigt
 * (Konzept Lesarten, Block 8): Auf der Website wählt niemand.
 */
export const BEGRUENDUNG_VORHER = vorher.begruendung;
const WERKZEUGSATZ = ' — deshalb setzt dieses Werkzeug die Einstimmigkeit an.';
if (!BEGRUENDUNG_VORHER.endsWith(WERKZEUGSATZ)) {
	throw new Error(`Fassung 2026-11-05: Die Begründung von «${EIGENE_SCHRANKE_ID}» endet nicht wie erwartet.`);
}

/** Die neue Begründung: die Gemeinschaft stellt ein, und sicher ist, wer alle hat. */
export const BEGRUENDUNG =
	'Verlangt das Reglement für seine eigene Änderung die Einstimmigkeit, ist umstritten, ob diese ' +
	'Verschärfung gilt: Der Kommentar hält sie für unzulässig, andere Autoren lassen sie zu, das ' +
	'Bundesgericht hat die Frage offengelassen. Ob Votum die Klausel anwendet oder nach dem Gesetz ' +
	'rechnet, stellt Ihre Gemeinschaft ein; das Ergebnis nach der anderen Regel nennt Votum dazu. ' +
	'Sicher ist ein Beschluss, dem alle Eigentümer zustimmen.';

/** Der Hinweis der Vorfassung zum Streit, hinter dem der Website-Abzug die Karte zeigt. */
const streitVorher = (vorher.hinweise ?? []).filter((h) => h.startsWith('Zum Streit:'));
if (streitVorher.length !== 1) {
	throw new Error(`Fassung 2026-11-05: «${EIGENE_SCHRANKE_ID}» trägt den Hinweis «Zum Streit» nicht genau einmal.`);
}
export const ZUM_STREIT_VORHER = streitVorher[0];

/** Der Satz zum Festhalten nach der strengen Lesart, der zur Verkündung wird. */
export const STREIT_VERKUENDUNG_VORHER =
	'Erreicht der Beschluss nur das qualifizierte Mehr, halten Sie ihn nach der strengen Lesart als abgelehnt fest.';
export const STREIT_VERKUENDUNG =
	'Erreicht der Beschluss das qualifizierte Mehr, aber nicht die Zustimmung aller, ist er nach der ' +
	'Klausel abgelehnt und nach dem gesetzlichen Mehr angenommen; verkündet wird nach der Einstellung ' +
	'Ihrer Gemeinschaft.';

/** Der Satz zur Anfechtung, der sein «trotzdem» verliert. */
export const STREIT_ANFECHTBAR_VORHER =
	'Wird der Beschluss trotzdem als angenommen festgehalten, ist er anfechtbar, falls die Klausel gilt.';
export const STREIT_ANFECHTBAR = 'Wird er als angenommen festgehalten, ist er anfechtbar, falls die Klausel gilt.';

for (const [hinweis, alt] of [
	[ZUM_STREIT_VORHER, STREIT_VERKUENDUNG_VORHER],
	[ZUM_STREIT_VORHER, STREIT_ANFECHTBAR_VORHER]
] as const) {
	if (hinweis.split(alt).length !== 2) {
		throw new Error(`Fassung 2026-11-05: Der alte Satz «${alt.slice(0, 60)}…» steht nicht genau einmal im Hinweis zum Streit.`);
	}
}

/** Der Hinweis zum Streit mit den zwei neuen Sätzen; der Rest bleibt, wie er war. */
export const ZUM_STREIT = ZUM_STREIT_VORHER.replace(STREIT_VERKUENDUNG_VORHER, STREIT_VERKUENDUNG).replace(
	STREIT_ANFECHTBAR_VORHER,
	STREIT_ANFECHTBAR
);

// ── Die Probe gegen die Vorfassung ───────────────────────────────────────────

/** Die ganze Vorfassung als Text, für die Probe, dass ein neuer Satz nicht schon dasteht. */
const VORFASSUNG = JSON.stringify(REGELWERK_2026_11_04);
for (const neu of [BEGRUENDUNG, STREIT_VERKUENDUNG, STREIT_ANFECHTBAR]) {
	if (VORFASSUNG.includes(JSON.stringify(neu).slice(1, -1))) {
		throw new Error(`Fassung 2026-11-05: «${neu.slice(0, 60)}…» steht schon in der Vorfassung.`);
	}
}

// ── Der Weg nach dem Gesetz ──────────────────────────────────────────────────

/** Der Satz im Weg zur Zustimmung aller, hinter dem unter «Nach dem Gesetz» der neue steht. */
export const WEG_ANKER = 'erreicht er es nicht, kommt er nicht zustande.';

/**
 * Nur unter «Nach dem Gesetz» (Fachprüfung Runde 2, R2-G-3; Laienprüfung
 * Runde 2, 4): Sonst stünde «nicht sicher» neben «angenommen», und die Leitung
 * verkündete unter Vorbehalt, bei offenem Fristbeginn.
 */
export const WEG_NACH_GESETZ_SATZ =
	'Erreicht er dieses Mehr, verkünden Sie ihn nach der Einstellung Ihrer Gemeinschaft ohne Vorbehalt ' +
	'als angenommen. Nicht sicher heisst nur, dass er anfechtbar ist, falls die Klausel gilt.';

if (!vorher.einstimmigkeitsweg || vorher.einstimmigkeitsweg.split(WEG_ANKER).length !== 2) {
	throw new Error(`Fassung 2026-11-05: Der Weg von «${EIGENE_SCHRANKE_ID}» trägt «${WEG_ANKER}» nicht genau einmal.`);
}
export const WEG_NACH_GESETZ = vorher.einstimmigkeitsweg.replace(WEG_ANKER, `${WEG_ANKER} ${WEG_NACH_GESETZ_SATZ}`);

// ── Der Knoten ───────────────────────────────────────────────────────────────

const KNOTEN: Ergebnisknoten[] = REGELWERK_2026_11_04.knoten.map((k) => {
	if (k.id !== EIGENE_SCHRANKE_ID) return k;
	// Die Gegenmeinung fällt weg: Die Lesart trägt die andere Ansicht, und
	// `umstrittenSatz` schweigt deshalb an dieser Karte.
	const { gegenmeinung: _gegenmeinung, ...ohneGegenmeinung } = k;
	void _gegenmeinung;
	return {
		...ohneGegenmeinung,
		begruendung: BEGRUENDUNG,
		hinweise: (k.hinweise ?? []).map((h) => (h === ZUM_STREIT_VORHER ? ZUM_STREIT : h)),
		lesart: {
			kennung: 'L6',
			andere: {
				wahl: 'gesetz',
				typ: 'qualifiziertes_mehr',
				rechtsgrundlage: 'ZGB Art. 712g Abs. 3',
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'alle_quoten',
				einstimmigkeitsweg: WEG_NACH_GESETZ
			}
		}
	};
});

// ── Die Frage zum Reglement ─────────────────────────────────────────────────

/**
 * Die Hilfe an der Antwort zur eigenen Schranke (Fachprüfung 05.11.2026, E-1;
 * Runde 2, R2-E-1 und R2-M-1; Runde 3, R3-K-1 und R3-H-1): Unter «Nach dem Gesetz» rechnet die Karte das
 * qualifizierte Mehr. Verlangt das Gesetz oder die Lehre für die Bestimmung
 * selbst die Zustimmung aller (ZGB Art. 712g Abs. 2; Art. 648 Abs. 2; Rz. 40b
 * ad Art. 712g), gehört das Traktandum unter die Antwort zu jener Bestimmung;
 * alle diese Karten rechnen die Zustimmung aller Eigentümer. **Die
 * Nutzungsrechte nur unter «Nach dem Gesetz»:** Ihre Karte rechnet das
 * qualifizierte Mehr und die Betroffenen, und Art. 712g Abs. 4 verlangt diese
 * «zudem» (Rz. 146 ad Art. 712g). Unter der Klausel fiele sie dort weg.
 */
export const SELBST_HILFE =
	'Einige Bestimmungen haben unter dieser Frage eine eigene Antwort, weil für sie schon das Gesetz oder ' +
	'die Lehre die Zustimmung aller verlangt. Das sind Quoren, Beschlussfähigkeit, Vorkaufs- und ' +
	'Einspracherecht, die Regel für Verkauf, Belastung oder Zweckänderung und Inhalte ausserhalb von ' +
	'Nutzung und Verwaltung. Wo das umstritten ist, sagt es die Karte. Für sie wählen Sie jene Antwort; ' +
	'eine gewöhnliche Bestimmung, etwa ein Kostenschlüssel, bleibt hier. Bei der Zuteilung ' +
	'ausschliesslicher Nutzungsrechte wählen Sie jene Antwort nur, wenn Ihre Gemeinschaft auf der Seite ' +
	'«Lesarten» «Nach dem Gesetz» eingestellt hat. Dann braucht es das qualifizierte Mehr und dazu die ' +
	'Zustimmung der direkt Betroffenen. Unter «Klausel anwenden» bleiben Sie hier; die Zustimmung aller ' +
	'schliesst die Betroffenen ein.';

const FRAGEN = REGELWERK_2026_11_04.fragen.map((f) => {
	if (f.id !== 'f3-1') return f;
	const selbst = f.antworten.find((a) => a.id === 'f3-1-selbst');
	if (!selbst) throw new Error('Fassung 2026-11-05: Die Antwort «f3-1-selbst» fehlt in der Vorfassung.');
	if (selbst.hilfe !== undefined) throw new Error('Fassung 2026-11-05: «f3-1-selbst» trägt schon eine Hilfe.');
	return { ...f, antworten: f.antworten.map((a) => (a === selbst ? { ...a, hilfe: SELBST_HILFE } : a)) };
});
if (!FRAGEN.some((f) => f.antworten.some((a) => a.hilfe === SELBST_HILFE))) {
	throw new Error('Fassung 2026-11-05: Die Frage «f3-1» fehlt in der Vorfassung.');
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_05 = {
	...REGELWERK_2026_11_04,
	fassung: '2026-11-05',

	fragen: FRAGEN,
	knoten: KNOTEN,

	freigabevermerk:
		REGELWERK_2026_11_04.freigabevermerk +
		' In der Fassung 2026-11-05 rechnet Votum eine Reglementsänderung, für die das Reglement selbst ' +
		'die Zustimmung aller verlangt, nach der Lesart der Gemeinschaft.'
} satisfies Regelwerk;
