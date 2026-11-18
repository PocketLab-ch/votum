/**
 * Fassung 2026-11-21: Der Widerruf an den Wahlkarten nach dem Wortlaut der
 * Website, der Weg über die Rücknahme an der zweiten Wahlkarte, und ab hier das
 * Häkchen «Begründungsakt oder Zustimmung aller» an einer Regel zur Bezahlung
 * aus dem Fonds (Auftrag `.auftraege/2026-11-17-votum-pendenzen-folge.md`,
 * Teile 1 bis 3; Pendenz «Widerruf an den Wahlkarten: Wortlaut für die nächste
 * Fassung»; Produktentscheid 17.11.2026, «Häkchen, sonst Hinweis»).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-20 abgeleitet wie
 * 2026-11-19 von 2026-11-18. Die Fassungen bis 2026-11-20 bleiben unverändert.
 *
 * **Was sich ändert:**
 *
 *  - `WIDERRUF` der Fassung 2026-11-19 lautet wie auf der Website nach deren
 *    Laien- und Fachprüfung (`quellen/pruefung/berichte/2026-11-16-website-widerruf-gegenlesung-*`):
 *    «und wenn es dazu nichts regelt, das qualifizierte Mehr» statt «sonst das
 *    qualifizierte», «zu einem für die Bewirtschaftung ungünstigen Zeitpunkt»
 *    statt «zur Unzeit», und der Zusatz zur höheren Hürde mit dem Verweis auf
 *    die Lesart L6. Ersetzt wird überall, wo der Satz steht (`STELLEN`), an
 *    beiden Wahlkarten der Bewirtschaftung.
 *  - An der zweiten Wahlkarte (`k-bewirtschaftung-waehlen-erweitert`) ein
 *    Hinweis zum Weg über die Rücknahme (Rz. 44 ad Art. 712m; `RUECKNAHME_VOR_DER_WAHL`).
 *  - An der vereinbarten Verwendung (`k-erneuerungsfonds-entnahme-vereinbart`)
 *    ein Hinweis, dass eine luxuriöse Arbeit ohne die Zustimmung aller nicht
 *    aus dem Fonds bezahlt wird (`LUXURIOES_NICHT_AUS_DEM_FONDS`).
 *  - An `k-reglement-quoren` die Wartezeit nach Ablauf der Frist im Wortlaut
 *    der Website (`QUOREN_FRIST`, `WARTEZEIT_K`).
 *  - Das Häkchen an einer Regel wirkt ab dieser Fassung (`FONDSREGEL_HAEKCHEN_AB`
 *    in `domain/reglement.ts`): An `k-erneuerungsfonds-entnahme` rechnet Votum
 *    unter L17 «streng» eine Regel mit Häkchen, ob milder oder strenger. Das
 *    steht im Kern, nicht hier, weil es an der Regel der Gemeinschaft hängt; die
 *    Karten selbst bleiben gleich.
 *
 * Wortlaut nach fünf Runden Laien- und Fachprüfung
 * (`quellen/pruefung/berichte/2026-11-17-votum-widerruf-fondsregel-*`). Runde 5 hatte
 * einen Befund mittel (L5-1, gleich F5-4: «die Übertragung» statt «sie»); eingearbeitet
 * am 17.11.2026 im Wortlaut des Vorschlags beider Prüfungen, nicht neu geprüft.
 */
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_20 } from './quorum-2026-11-20';
import { WIDERRUF as WIDERRUF_VORHER, nachDieserFassung as nachDerVorfassung } from './quorum-2026-11-19';

const VOR = REGELWERK_2026_11_20;

/** Die Karte, an der der Hinweis zur Rücknahme vor der Wahl steht. */
export const WAEHLEN_ERWEITERT_ID = 'k-bewirtschaftung-waehlen-erweitert';

/**
 * Der Widerruf ab dieser Fassung, nach Runde 3 des Entwurfs
 * (`quellen/pruefung/zu-pruefen-2026-11-17-votum-widerruf-und-fondsregel-runde3.md`,
 * Stelle A): angekündigtes Traktandum (Laien L-1), die offene Rückkehr aus dem
 * Begründungsakt, auch einem Reglement als dessen Bestandteil, und aus einer
 * Bestimmung mit der Zustimmung aller (Fach F-4, F2-1; Laien L2-2), die Lesart
 * L6 und die Antwort im Baum (L-3, L2-1, F2-1), und dass die finanziellen
 * Folgen die Rücknahme nicht hindern (L-2).
 */
export const WIDERRUF_ANFANG =
	// Sätze geteilt für die Grenze von 180 Zeichen (`check:texte`); die Aussage bleibt.
	'Zurücknehmen kann die Versammlung beides jederzeit mit einfachem Mehr (SVIT-Kommentar Rz. 42 ad Art. 712m, ' +
	'Rz. 70 ad Art. 712s). Die Rücknahme muss als Traktandum angekündigt sein (ZGB Art. 67 Abs. 3 mit Art. 712m ' +
	// Runde 3 (F3-1, L3-1): der Begründungsakt zuerst, mit der zeitlichen Grenze; der Schluss am offenen Fall.
	'Abs. 2). Zum Begründungsakt gehört auch ein Reglement, das bei der Begründung als sein Bestandteil erlassen ' +
	'wurde, wenn die Übertragung schon damals darin stand. Kam die Übertragung erst später mit einem ' +
	'Mehrheitsbeschluss ins Reglement, braucht es das Mehr, das Ihr Reglement für seine eigene Änderung verlangt. ' +
	// Runde 4 (F4-1, L4-2): Umstritten ist auch die tiefere Hürde; der Satz direkt beim Mehr des Reglements.
	'Regelt es dazu nichts, braucht es das qualifizierte Mehr (ZGB Art. 712g Abs. 3). Ob das Reglement für seine ' +
	'eigene Änderung ein anderes Mehr setzen darf, das einfache oder etwa die Zustimmung aller, ist umstritten ' +
	// Runde 5 (F5-4, L5-1): «die Übertragung» statt «sie», das sonst auf die Zustimmung aller zeigte.
	'(Rz. 40, 125 und 145 ad Art. 712g). Steht die Übertragung schon im Begründungsakt oder kam sie mit der Zustimmung aller ' +
	'ins Reglement, ist offen, ob ihre Rücknahme die Zustimmung aller braucht (BGer 5C.110/2001 E. 2b). Sicher ist ' +
	'in beiden Fällen die Zustimmung aller.';

/** Was nur die Anwendung sagt: die Lesart L6 und unter welcher Antwort die Rücknahme liegt. */
export const WIDERRUF_IN_VOTUM =
	// Runde 4 (F4-1, Hinweis zur Formulierung): «das» zeigte nach der Umstellung nicht mehr auf die Hürde.
	'Wie Votum eine Klausel rechnet, nach der das Reglement für seine Änderung die Zustimmung aller verlangt, ' +
	'stellen Sie mit der Lesart L6 auf der Seite «Lesarten» ein. Eine eigene Karte für die Rücknahme hat Votum nicht. Kam die Übertragung erst später mit einem ' +
	'Mehrheitsbeschluss ins Reglement, wählen Sie unter «Was soll geändert werden?» die Antwort «Reglement, ' +
	'gewöhnliche Bestimmung». Steht die Übertragung schon ' +
	'im Begründungsakt oder kam sie mit der Zustimmung aller ins Reglement, ist die Antwort zur Bestimmung über ' +
	'Zuständigkeit oder Quoren der sichere Weg. Beruht die Übertragung auf einem Beschluss, setzen Sie unter «Anderes ' +
	'Erfordernis setzen» das einfache Mehr.';

export const WIDERRUF_SCHLUSS =
	'Finanzielle Folgen einer Rücknahme bleiben vorbehalten (Rz. 42 ad Art. 712m). Dazu gehört, was der ' +
	'Verwaltungsvertrag etwa zum Honorar vorsieht. Dazu gehört auch Schadenersatz, wenn die Rücknahme zu einem für ' +
	'die Bewirtschaftung ungünstigen Zeitpunkt kommt (OR Art. 404 Abs. 2). Das hindert die Rücknahme nicht, kann ' +
	'sie aber kosten; lesen Sie den Vertrag deshalb vor der Versammlung nach.';

export const WIDERRUF = `${WIDERRUF_ANFANG} ${WIDERRUF_IN_VOTUM} ${WIDERRUF_SCHLUSS}`;

/**
 * Derselbe Satz für den Website-Abzug, ohne das, was nur die Anwendung sagt:
 * Die Website nennt Votum nirgends (`check-abzug.mjs`).
 */
export const WIDERRUF_WEBSITE = `${WIDERRUF_ANFANG} ${WIDERRUF_SCHLUSS}`;

/** Wie oft der Satz im Regelwerk der Vorfassung steht (Hinweise, Ersatz und Lesart der zwei Wahlkarten). */
export const STELLEN = 6;

/**
 * Der Hinweis an der zweiten Wahlkarte zum Weg über die Rücknahme (Rz. 44 ad
 * Art. 712m), nach Runde 3 des Entwurfs, Stelle B: nur, wenn auch der Vertrag
 * keine solchen Kompetenzen gibt (Fach F-1, Rz. 69 ad Art. 712s); für wen der
 * Weg taugt (F-2, Laien L-7); Beleg auch aus dem Gesetz (F-3); der Schritt in
 * Votum, auch gegen Frage und Verweis der anderen Karte (L-4, L2-3); die
 * gescheiterte Rücknahme mit Vollmachten und Einladung (F2-3, L2-4); das Mehr
 * einer späteren Erweiterung (F2-4, L2-5); kein Rückweg über den Vertrag (L-6).
 */
export const RUECKNAHME_VOR_DER_WAHL =
	'Will Ihre Gemeinschaft die Kompetenzen über die gewöhnliche Verwaltung hinaus nicht weiterführen, kann sie ' +
	'sie vor der Wahl zurücknehmen. Das geschieht in einem eigenen Traktandum, das in der Einladung vor der Wahl ' +
	'steht, mit dem Mehr, das oben auf dieser Karte dafür steht. Stehen die Kompetenzen im Reglement, braucht schon ' +
	'die Rücknahme in der Regel ein qualifiziertes Mehr; der Weg hilft vor allem, wenn sie auf einem früheren ' +
	'Beschluss beruhen. Danach hat die Bewirtschaftung nur die Aufgaben, die das Gesetz jeder Bewirtschaftung gibt. ' +
	'Für ihre Wahl genügt dann das einfache Mehr (ZGB Art. 647b Abs. 1; SVIT-Kommentar Rz. 44 ad Art. 712m). Das ' +
	'gilt nur, wenn auch ihr Verwaltungsvertrag ihr keine solchen Kompetenzen gibt, der laufende so wenig wie ein ' +
	'neuer. Sonst bleibt es beim Mehr dieser Karte (Rz. 69 ad Art. 712s). Gibt auch kein Vertrag ihr solche Kompetenzen, legen Sie das Wahltraktandum ' +
	'auf die Karte «Bewirtschaftung wählen». Beantworten Sie dort die Frage nach den Kompetenzen mit Nein, obwohl ' +
	'die Bewirtschaftung sie bis zur Rücknahme noch hat; der Hinweis jener Karte auf diese gilt dann nicht. Wird ' +
	'die Rücknahme abgelehnt, wechseln Sie für die Wahl zurück auf diese Karte; dann gilt ihr Mehr. Sagen Sie das ' +
	'schon in der Einladung, und holen Sie für diesen Fall vor der Versammlung Vollmachten ein. Nach der Rücknahme ' +
	'entscheidet über solche Geschäfte wieder die Versammlung. Soll die Bewirtschaftung später wieder mehr dürfen, ' +
	'braucht das einen eigenen Beschluss mit dem Mehr, das oben auf dieser Karte dafür steht. Für Befugnisse statt ' +
	'der Versammlung ist das die Einstimmigkeit. Der Vertrag allein genügt nicht. Was ihr aus dem laufenden Vertrag ' +
	'zusteht, etwa ihr Honorar, bleibt vorbehalten (Rz. 72 ad Art. 712s).';

/** Die Karte der vereinbarten Verwendung (Fassung 2026-11-20). */
export const VEREINBART_ID = 'k-erneuerungsfonds-entnahme-vereinbart';

/**
 * Der Hinweis an der vereinbarten Verwendung zu einer luxuriösen Arbeit
 * (Fachprüfung zum Antragsmuster, Runde 2, F2-1; Rz. 137, 138 ad Art. 712l):
 * Sonst höbe der Satz des Antragsmusters «gilt das statt der Kostenverteilung»
 * den Schutz nach Art. 647e Abs. 2 ZGB auf. Runde 2 des Entwurfs, Stelle F.
 */
export const LUXURIOES_NICHT_AUS_DEM_FONDS =
	'Ist die Arbeit luxuriös und haben ihr nicht alle zugestimmt, bezahlen Sie sie nicht aus dem Fonds. Sonst ' +
	'tragen die, die nicht zugestimmt haben, über den Fonds mit, was Art. 647e Abs. 2 ZGB ihnen erspart. Der ' +
	'SVIT-Kommentar lässt die vereinbarte Verwendung für luxuriöse Arbeiten zu, denen alle zugestimmt haben ' +
	'(Rz. 137 und 138 ad Art. 712l).';

/**
 * Die Wartezeit nach Ablauf der Anfechtungsfrist an `k-reglement-quoren`
 * (Auftrag 2026-11-17, Zusatz; Website-Prüfung `quellen/pruefung/berichte/2026-11-17-website-wartezeit-nach-frist-*-runde3.md`,
 * Fachprüfung W-F-2): «nicht vor Ablauf» statt «erst nach Ablauf», und der
 * geprüfte Kernsatz K hinter dem Satz zur Zustellung, damit der Fristbeginn vor
 * der Wartezeit steht. Wortlaut der Website, unverändert übernommen.
 */
export const WARTEZEIT_K =
	// Geteilt von der Website-Sitzung, Runde 7 ohne Befund
	// (`quellen/pruefung/berichte/2026-11-17-website-wartezeit-nach-frist-{laien,fach}-runde7.md`).
	'Warten Sie nach Ablauf der Frist noch einige Wochen. Ein Schlichtungsgesuch vom letzten Tag der Frist ist ' +
	'rechtzeitig (ZPO Art. 62 Abs. 1, 143 Abs. 1). Die Gemeinschaft erhält es aber erst mit der Vorladung, meist ' +
	'über die Bewirtschaftung (ZPO Art. 202 Abs. 3; ZGB Art. 712t Abs. 3). Fragen Sie die Bewirtschaftung vor der ' +
	'Umsetzung, ob Post der Schlichtungsbehörde gekommen ist. Hat die Gemeinschaft keine Bewirtschaftung, fragen ' +
	'Sie bei der Schlichtungsbehörde am Ort der Liegenschaft nach. Ist ein Gesuch eingegangen, führen Sie nur aus, ' +
	'was eilt, bis das Verfahren endgültig und ohne Aufhebung des Beschlusses abgeschlossen ist. Scheitert die ' +
	'Schlichtung, erhält, wer das Gesuch gestellt hat, eine Klagebewilligung und kann damit noch drei Monate lang ' +
	'klagen (ZPO Art. 209 Abs. 3). Warten Sie diese Zeit und danach noch einige Wochen ab und fragen Sie die ' +
	'Bewirtschaftung, ob Post vom Gericht gekommen ist. Die drei Monate dauern oft länger. Die Frist steht vom ' +
	'15. Juli bis 15. August, eine Woche vor bis eine Woche nach Ostern und vom 18. Dezember bis 2. Januar still ' +
	'(ZPO Art. 145 Abs. 1). Zudem stellt das Gericht die Klage oft erst zu, nachdem die klagende Person den ' +
	'Kostenvorschuss bezahlt hat (ZPO Art. 98 Abs. 1, 101).';

/** Die Kurzform KK für jede weitere Stelle derselben Karte (Website, Runde 3). */
export const WARTEZEIT_KK =
	'Warten Sie auch hier nach Ablauf der Frist noch einige Wochen und fragen Sie die Bewirtschaftung, ob Post der ' +
	'Schlichtungsbehörde oder des Gerichts gekommen ist.';

export const QUOREN_ID = 'k-reglement-quoren';
export const QUOREN_FRIST_VORHER =
	'Führen Sie den Beschluss, wenn die Sache nicht dringlich ist, erst nach Ablauf dieser Frist aus; für Abwesende ' +
	'ohne Vertretung beginnt sie in der Regel erst, wenn sie das Protokoll erhalten haben. Stellen Sie es ihnen ' +
	'deshalb rasch und nachweisbar zu, etwa eingeschrieben.';
export const QUOREN_FRIST =
	'Führen Sie den Beschluss, wenn die Sache nicht dringlich ist, nicht vor Ablauf dieser Frist aus; für Abwesende ' +
	'ohne Vertretung beginnt sie in der Regel erst, wenn sie das Protokoll erhalten haben. Stellen Sie es ihnen ' +
	`deshalb rasch und nachweisbar zu, etwa eingeschrieben. ${WARTEZEIT_K}`;

/** Ersetzt in jedem Text des Regelwerks und zählt, wie oft (wie in der Fassung 2026-11-19). */
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

const zaehler = { n: 0 };
const quoren = { n: 0 };
const ERSETZT = ersetzeUeberall(
	ersetzeUeberall(VOR, WIDERRUF_VORHER, WIDERRUF, zaehler),
	QUOREN_FRIST_VORHER,
	QUOREN_FRIST,
	quoren
);
if (quoren.n !== 1 || ERSETZT.knoten.find((k) => k.id === QUOREN_ID)?.hinweise?.[0]?.endsWith(QUOREN_FRIST) !== true) {
	throw new Error(`Fassung 2026-11-21: Der Satz zur Frist steht ${quoren.n}-mal statt einmal, oder nicht am Ende von «${QUOREN_ID}», Hinweis 1.`);
}
if (zaehler.n !== STELLEN) {
	throw new Error(`Fassung 2026-11-21: Der Widerruf steht ${zaehler.n}-mal statt ${STELLEN}-mal.`);
}
const VOR_ERWEITERT = VOR.knoten.find((k) => k.id === WAEHLEN_ERWEITERT_ID);
if (!VOR_ERWEITERT || (VOR_ERWEITERT.hinweise ?? []).some((h) => h.includes('Rz. 44 ad Art. 712m). Was der'))) {
	throw new Error(`Fassung 2026-11-21: «${WAEHLEN_ERWEITERT_ID}» fehlt oder trägt den Hinweis zur Rücknahme schon.`);
}
const VOR_VEREINBART = VOR.knoten.find((k) => k.id === VEREINBART_ID);
if (!VOR_VEREINBART || (VOR_VEREINBART.hinweise ?? []).some((h) => h.startsWith('Ist die Arbeit luxuriös'))) {
	throw new Error(`Fassung 2026-11-21: «${VEREINBART_ID}» fehlt oder trägt den Hinweis zur luxuriösen Arbeit schon.`);
}
if (!VOR.knoten.some((k) => k.id === 'k-bewirtschaftung-waehlen' && k.titel === 'Bewirtschaftung wählen')) {
	throw new Error('Fassung 2026-11-21: Die Karte «Bewirtschaftung wählen», auf die der Hinweis verweist, fehlt.');
}

/**
 * Ein Wortlaut der Fassungen 2026-11-13 bis 2026-11-20, wie er in dieser
 * Fassung lautet: die Ersetzungen der Vorfassungen und der neue Widerruf. Für
 * den Website-Abzug.
 */
export function nachDieserFassung(text: string): string {
	return nachDerVorfassung(text).split(WIDERRUF_VORHER).join(WIDERRUF).split(QUOREN_FRIST_VORHER).join(QUOREN_FRIST);
}

function mitNeuemHinweis(k: Ergebnisknoten): Ergebnisknoten {
	if (k.id === WAEHLEN_ERWEITERT_ID) return { ...k, hinweise: [...(k.hinweise ?? []), RUECKNAHME_VOR_DER_WAHL] };
	if (k.id === VEREINBART_ID) return { ...k, hinweise: [...(k.hinweise ?? []), LUXURIOES_NICHT_AUS_DEM_FONDS] };
	return k;
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_21 = {
	...ERSETZT,
	fassung: '2026-11-21',

	knoten: ERSETZT.knoten.map(mitNeuemHinweis),

	freigabevermerk:
		VOR.freigabevermerk +
		' In der Fassung 2026-11-21 sagt der Hinweis zur Wahl der Bewirtschaftung, mit welchem Mehr eine ' +
		'Übertragung zurückgenommen wird, wenn das Reglement dazu nichts regelt, und an der Wahl einer ' +
		'Bewirtschaftung mit erweiterten Kompetenzen, wie die Rücknahme vor der Wahl geht. Bei der Bezahlung aus ' +
		// Fachprüfung Runde 2, Hinweis zum Vermerk: nur im gewöhnlichen Zweck, «angegeben» statt «hinterlegt».
		'dem Erneuerungsfonds im gewöhnlichen Zweck rechnet Votum eine Regel, für die angegeben ist, dass sie im ' +
		'Begründungsakt steht oder die Zustimmung aller hat, auch nach der strengeren Auffassung.'
} satisfies Regelwerk;
