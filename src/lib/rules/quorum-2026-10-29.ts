/**
 * Fassung 2026-10-29: Die Einstimmigkeit rät nicht mehr zur nachträglichen
 * Zustimmung der Abwesenden, und jede Karte sagt, was gilt, wenn eine
 * Zustimmung fehlt.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert kein Erfordernis und keinen
 * Weg im Baum. Die Wirkung des Ergebnistyps `einstimmigkeit` schloss bis hier
 * mit «Zustimmungen sind nachträglich schriftlich einzuholen». Dafür gibt es
 * keine Stelle; dagegen sprechen Art. 66 Abs. 2 ZGB (schriftliche Zustimmung
 * **aller**), BGE 127 III 506 E. 3a (beschlossen wird an der Versammlung mit
 * Protokoll oder rein schriftlich), Rz. 125, 128 und 197 ad Art. 712m und
 * Handschin/Wyttenbach 2011, S. 75 («negativer Beschluss»). Eine nachträgliche
 * Zustimmung nimmt nur das Anfechtungsrecht gegen einen bestehenden Beschluss
 * (Handschin/Wyttenbach S. 80).
 *
 * **Warum der Weg am Knoten steht** (`einstimmigkeitsweg`, Laien- und
 * Fachprüfung 22.10.2026, NZ-1 bis NZ-5, N-1 bis N-6): Ein Satz am Typ war der
 * erste Entwurf und sagte an mindestens fünf Karten etwas Falsches. An der
 * luxuriösen Massnahme genügen nach dem SVIT-Kommentar die Anwesenden und
 * Vertretenen (Rz. 197); an den beiden Reglementskarten ist schon die
 * Einstimmigkeit umstritten; der Zirkularbeschluss ist selbst der schriftliche
 * Weg und verlangt beim Scheitern eine Versammlung (Rz. 125); und wo eine
 * öffentliche Urkunde nötig ist, ersetzt der schriftliche Beschluss sie nicht.
 * Der Typ behält deshalb nur, was für alle gilt.
 *
 * **Der Anlass:** Produktentscheid 21.10.2026 («Eigener Auftrag, vor Block 8»
 * der Lesarten), Fachprüfung `quellen`
 * `pruefung/berichte/2026-10-22-nachtraegliche-zustimmung-einstimmigkeit.md`,
 * Runden in `pruefung/berichte/2026-10-22-nachtraegliche-zustimmung-*.md`.
 */
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_28 } from './quorum-2026-10-28';

/** Der Satz des Typs: gilt an jeder Karte mit Einstimmigkeit. */
export const EINSTIMMIGKEIT_WIRKUNG =
	'Nötig ist die ausdrückliche Zustimmung jedes Einzelnen; Enthaltung und Nichtabgabe ' +
	'verhindern sie gleichermassen.';

/**
 * Unterschriften nur der Abwesenden. Nicht am Zirkularbeschluss, der selbst
 * der schriftliche Weg ist, und nicht an den Karten mit Vereinbarung (dort
 * siehe `VEREINBARUNG_SAAL`).
 */
const NUR_ABWESENDE = 'Unterschriften nur derer, die gefehlt haben, holen ihn nicht nach.';

/** Die Form der Unterschrift (Rz. 128 ad Art. 712m mit OR Art. 14 Abs. 2bis). */
const FORM =
	'Ein Ja per E-Mail genügt nicht; nötig ist die Unterschrift von Hand oder eine qualifizierte ' +
	'elektronische Signatur, und nicht jede elektronische Unterschrift ist qualifiziert';

/** Der erste Satz des sicheren Wegs; an jeder Karte ausser dem Zirkularbeschluss genau einmal. */
export const SICHERER_WEG =
	'Sicher ist dann ein schriftlicher Beschluss über denselben Antrag, den alle unterschreiben, ' +
	'auch wer schon zugestimmt hat (ZGB Art. 66 Abs. 2 i.V.m. Art. 712m Abs. 2).';

/**
 * Wo die Versammlung beschliesst, kann das Reglement den schriftlichen Weg
 * ausschliessen; der Satz steht gleich hinter dem ersten, damit niemand im
 * Saal nutzlos unterschreiben lässt (Fachprüfung Runde 5, am Rand).
 */
const REGLEMENT_SCHLIESST_AUS =
	'Schliesst Ihr Reglement diesen Weg aus, braucht es stattdessen eine neue Versammlung, an der ' +
	'alle da oder vertreten sind und zustimmen (Rz. 125, 127 und 197 ad Art. 712m).';

/**
 * Der Vertreter (Fachprüfung Runde 4 und 5, R4-3, F5-1): Eine Stimmvollmacht
 * umfasst Teilnahme und Stimmrecht (Rz. 26 ad Art. 712m); ob sie das
 * Unterschreiben deckt, sagt keine Stelle, ihr Umfang richtet sich nach dem
 * Inhalt (OR Art. 33 Abs. 2).
 */
const VERTRETER =
	'Wer vertreten ist, unterschreibt durch den Vertreter, sicher nur mit einer schriftlichen ' +
	'Vollmacht, die das Unterschreiben dieses Antrags nennt, auch in geänderter Fassung (OR Art. 33 ' +
	'Abs. 2); sonst unterschreibt der Vertretene danach selbst auf demselben Blatt.';

const GEAENDERT = 'Wird der Antrag im Saal geändert, braucht es ein Blatt mit dem geänderten Wortlaut.';

/**
 * Wo das Blatt schon im Saal unterschrieben wird, stehen geänderter Antrag und
 * Vertreter vor der Verzweigung, gleich hinter dem vorbereiteten Blatt: Stimmen
 * alle zu, liest sonst niemand bis zum Fall, dass jemand fehlt (Laienprüfung
 * Runde 6, L6-1), und stünden sie im ersten Zweig, läse sie im zweiten niemand
 * (Fachprüfung Runde 7, F7-1).
 */
const IM_SAAL = `${GEAENDERT} ${VERTRETER}`;

/**
 * Der sichere Weg (Rz. 125, 127, 128, 197 ad Art. 712m). `blattVorbereitet`:
 * Die Karte hat das Blatt schon vorher genannt (Vereinbarung, Sonderinhalt).
 */
function schriftlich({
	ausschluss,
	blattVorbereitet
}: {
	ausschluss: boolean;
	blattVorbereitet: boolean;
}): string {
	return [
		SICHERER_WEG,
		ausschluss ? REGLEMENT_SCHLIESST_AUS : null,
		blattVorbereitet
			? 'Die Anwesenden unterschreiben das vorbereitete Blatt gleich im Saal, die übrigen dasselbe ' +
				'Blatt danach.'
			: 'Für den schriftlichen Beschluss bereiten Sie ein Blatt mit dem Wortlaut vor; die Anwesenden ' +
				'können es gleich im Saal unterschreiben, die übrigen dasselbe Blatt danach.',
		blattVorbereitet ? null : IM_SAAL,
		`Gefasst ist der Beschluss erst mit der letzten Unterschrift. ${FORM} (SVIT-Kommentar Rz. 128 ad ` +
			'Art. 712m).'
	]
		.filter(Boolean)
		.join(' ');
}

/**
 * Wo eine Vereinbarung aller entsteht (Fachprüfung Runde 2 bis 4, R2-1,
 * R3-1, R4-2; Laienprüfung Runde 3, L3-1, L3-2): Zuerst das vorbereitete
 * Blatt und der Schritt im Saal, wenn alle zustimmen, denn das Protokoll mit
 * den Unterschriften von Vorsitz und Protokollführung genügt in der Regel
 * nicht (Rz. 8a und 197 ad Art. 712m; Rz. 23 ad Art. 712c). Danach der Weg,
 * wenn jemand fehlt; er geht auch ausserhalb einer Versammlung, und ein
 * Ausschluss im Reglement hindert die Vereinbarung nach Rz. 8a kaum. «Unterschriften
 * nur derer, die gefehlt haben» fehlt hier mit Absicht: Ein Blatt, das die
 * Anwesenden im Saal und die Abwesenden danach unterschreiben, kann eine
 * Vereinbarung aller sein (Fachprüfung Runde 4, Folgerung).
 */
const VEREINBARUNG_SAAL =
	'Stimmen an der Versammlung alle zu, lassen Sie das Blatt noch im Saal von allen ' +
	'unterschreiben; ein Protokoll nur mit ' +
	'den Unterschriften von Vorsitz und Protokollführung genügt in der Regel nicht (SVIT-Kommentar ' +
	'Rz. 8a und 197 ad Art. 712m).';

const VEREINBARUNG_AUSSEN =
	'Als Vereinbarung aller geht das auch ausserhalb einer Versammlung (Rz. 8a ad Art. 712m).';

const MIT_AUSSCHLUSS = schriftlich({ ausschluss: true, blattVorbereitet: false });

/**
 * Wenn an der Versammlung eine Zustimmung fehlt, an allen Karten ausser der
 * luxuriösen Massnahme, dem Zirkularbeschluss und den beiden Reglementskarten.
 * «Nach herrschender Lehre», aber **ohne Streit**: Rz. 197 ad Art. 712m lässt
 * die Anwesenden und Vertretenen ausdrücklich nur bei der luxuriösen
 * Massnahme genügen; für die Vereinbarungen verlangt Rz. 8a die Unterschrift
 * aller (Fachprüfung Runde 9, F9-1, gegen die Fassung nach der Codeprüfung,
 * die den Streit an alle Karten setzte). Die Leitung sagt seit derselben Runde
 * dasselbe (`kopfbasisStreit` in `mehrhinweise.ts`).
 */
const FEHLT_EINE =
	'Fehlt an der Versammlung eine Zustimmung, kommt der Beschluss nach herrschender Lehre nicht ' +
	'zustande (SVIT-Kommentar Rz. 197 ad Art. 712m).';

export const WEG_GEWOEHNLICH = `${FEHLT_EINE} ${NUR_ABWESENDE} ${MIT_AUSSCHLUSS}`;

export const WEG_LUXURIOES =
	'Fehlt die Zustimmung von Abwesenden, kommt der Beschluss nach herrschender Lehre nicht ' +
	'zustande. Nach dem SVIT-Kommentar genügt die Zustimmung aller Anwesenden und Vertretenen ' +
	`(Hinweis zur Zählung unten). ${NUR_ABWESENDE} ${MIT_AUSSCHLUSS}`;

/** An den beiden Reglementskarten, wo schon die Einstimmigkeit umstritten ist. */
function wegUmstritten(blattVorbereitet: boolean, offen = 'umstritten ist'): string {
	return (
		'Das qualifizierte Mehr heisst: Mehr als die Hälfte der anwesenden und vertretenen Eigentümer ' +
		'stimmt zu, und die Zustimmenden halten zusammen mehr als die Hälfte aller Wertquoten (ZGB ' +
		'Art. 712g Abs. 3; SVIT-Kommentar Rz. 190 f. ad Art. 712m). Erreicht der Beschluss dieses Mehr, ' +
		`aber nicht die Zustimmung aller, ist er nicht sicher, weil ${offen}, ob es die Zustimmung ` +
		'aller braucht (Hinweis unten); erreicht er es nicht, kommt er nicht zustande. Unterschriften ' +
		'nur derer, die gefehlt haben, machen ihn nicht sicher. ' +
		schriftlich({ ausschluss: true, blattVorbereitet })
	);
}

export const WEG_ZIRKULAR =
	`Gefasst ist der Beschluss erst mit der letzten Unterschrift unter denselben Antrag. ${FORM}. ` +
	'Fehlt eine Unterschrift, kommt er nicht zustande; dann braucht es eine Versammlung ' +
	'(SVIT-Kommentar Rz. 125, 128 ad Art. 712m).';

/** Karten, an denen eine Vereinbarung aller entsteht. */
const VEREINBARUNGEN = new Set([
	'k-zweckbestimmung',
	'k-grundstueck-verkauf',
	'k-sonderrecht-abgrenzen',
	'k-vorkaufsrecht',
	'k-aufhebung',
	'k-reglement-andere-ordnung'
]);

/** Wo eine Urkunde dazukommt (Fachprüfung 22.10.2026, N-1, R2-6). */
const URKUNDE: Record<string, string> = {
	'k-sonderrecht-abgrenzen':
		'Keiner der beiden Wege ersetzt die öffentlich beurkundete Vereinbarung und die Anmeldung beim ' +
		'Grundbuch (ZGB Art. 712b Abs. 3; SVIT-Kommentar Rz. 12 ad Art. 712b).',
	'k-grundstueck-verkauf':
		'Verkauf und Dienstbarkeit brauchen zusätzlich einen öffentlich beurkundeten Vertrag und den ' +
		'Eintrag im Grundbuch (ZGB Art. 656 Abs. 1, 657 Abs. 1, 731 Abs. 1, 732 Abs. 1).',
	'k-aufhebung':
		'Für die Aufhebung selbst braucht es in der Regel zusätzlich eine öffentliche Urkunde; die ' +
		'blosse Umwandlung in gewöhnliches Miteigentum geht schriftlich (SVIT-Kommentar Rz. 52, 53 ad ' +
		'Art. 712f).',
	'k-vorkaufsrecht':
		'Ist der Preis im Voraus bestimmt, braucht die Vereinbarung eine öffentliche Urkunde (OR ' +
		'Art. 216 Abs. 2). Sicher gegen einen späteren Käufer wirkt das Recht nur, wenn es im Grundbuch ' +
		'vorgemerkt ist (ZGB Art. 712c Abs. 1; SVIT-Kommentar Rz. 25 und 182 ad Art. 712c).',
};

/** Der Weg einer Karte mit Einstimmigkeit, mit den Sätzen zu Vereinbarung und Urkunde. */
export function wegFuer(id: string): string {
	let teile: (string | undefined)[];
	if (id === 'k-zirkularbeschluss') teile = [WEG_ZIRKULAR];
	else if (VEREINBARUNGEN.has(id))
		teile = [
			'Bereiten Sie den Antrag im Wortlaut auf einem Blatt zum Unterschreiben vor.',
			IM_SAAL,
			VEREINBARUNG_SAAL,
			FEHLT_EINE,
			schriftlich({ ausschluss: false, blattVorbereitet: true }),
			VEREINBARUNG_AUSSEN
		];
	else if (id === 'k-reglement-sonderinhalt')
		// Fachprüfung Runde 3, R3-3; Laienprüfung Runde 4 und 5, L4-1, L5-1: der
		// Schritt im Saal vorn, mit dem Blatt.
		teile = [
			'Bereiten Sie die Bestimmung im Wortlaut auf einem Blatt zum Unterschreiben vor.',
			IM_SAAL,
			'Stimmen an der Versammlung alle zu, lassen Sie das Blatt noch im Saal von allen ' +
				'unterschreiben; ob es eine Vereinbarung ist, ist nicht geklärt (SVIT-Kommentar Rz. 126 ad ' +
				'Art. 712g, Rz. 8a ad Art. 712m).',
			'Stimmen nicht alle zu, kommt es auf das qualifizierte Mehr an, und auch dann ist der ' +
				'Beschluss nicht sicher.',
			// «nicht geklärt»: Rz. 126 ad Art. 712g sagt nur «möglicherweise» (Fachprüfung
			// Runde 10 und 11, am Rand; Codeprüfung Durchgang 2, N2).
			wegUmstritten(true, 'nicht geklärt ist')
		];
	else if (id === 'k-reglement-eigene-schranke') teile = [wegUmstritten(false)];
	else if (id === 'k-baulich-luxurioes') teile = [WEG_LUXURIOES];
	else teile = [WEG_GEWOEHNLICH];
	return [...teile, URKUNDE[id]].filter(Boolean).join(' ');
}

const vorher = REGELWERK_2026_10_28.ergebnistypen.find((t) => t.typ === 'einstimmigkeit');
if (!vorher || vorher.stimmwirkungen.art !== 'festgelegt')
	throw new Error('Fassung 2026-10-29: Die Vorfassung trägt keine festgelegte Einstimmigkeit.');
if (!vorher.stimmwirkungen.wirkung.startsWith(EINSTIMMIGKEIT_WIRKUNG))
	throw new Error('Fassung 2026-10-29: Die Wirkung der Vorfassung ist nicht mehr die erwartete.');
for (const id of [
	'k-zirkularbeschluss',
	'k-reglement-sonderinhalt',
	'k-reglement-eigene-schranke',
	'k-baulich-luxurioes',
	...Object.keys(URKUNDE),
	...VEREINBARUNGEN
]) {
	const k = REGELWERK_2026_10_28.knoten.find((x) => x.id === id);
	if (!k || k.typ !== 'einstimmigkeit')
		throw new Error(`Fassung 2026-10-29: «${id}» fehlt oder rechnet nicht mehr mit Einstimmigkeit.`);
}

/**
 * Der Hinweis zum Streit an der eigenen Schranke (seit Fassung 2026-09-23)
 * sagte «Erreicht der Beschluss nur das qualifizierte Mehr, ist er anfechtbar,
 * falls die Klausel gilt», die Leitung «… verkündet trotzdem eine Ablehnung».
 * Beide angeglichen (Laienprüfung Runde 10, L10-1); ohne «Votum», weil der
 * Hinweis auch auf der Website steht.
 */
const SCHRANKE_ALT = 'Erreicht der Beschluss nur das qualifizierte Mehr, ist er anfechtbar, falls die Klausel gilt.';
export const SCHRANKE_NEU =
	'Erreicht der Beschluss nur das qualifizierte Mehr, ist er nach der strengen Lesart abgelehnt; ' +
	'gilt die Klausel nicht, kann diese Ablehnung angefochten werden. Wird er trotzdem als ' +
	'angenommen festgehalten, ist er anfechtbar, falls die Klausel gilt.';

function mitWeg(k: Ergebnisknoten): Ergebnisknoten {
	if (k.typ !== 'einstimmigkeit') return k;
	const mit = { ...k, einstimmigkeitsweg: wegFuer(k.id) };
	if (k.id !== 'k-reglement-eigene-schranke') return mit;
	const hinweise = (k.hinweise ?? []).map((h) => h.replace(SCHRANKE_ALT, SCHRANKE_NEU));
	if (hinweise.join() === (k.hinweise ?? []).join())
		throw new Error('Fassung 2026-10-29: Der Hinweis zum Streit an der eigenen Schranke ist nicht mehr der erwartete.');
	return { ...mit, hinweise };
}

export const REGELWERK_2026_10_29 = {
	...REGELWERK_2026_10_28,
	fassung: '2026-10-29',

	ergebnistypen: REGELWERK_2026_10_28.ergebnistypen.map((t) =>
		t.typ === 'einstimmigkeit' && t.stimmwirkungen.art === 'festgelegt'
			? { ...t, stimmwirkungen: { ...t.stimmwirkungen, wirkung: EINSTIMMIGKEIT_WIRKUNG } }
			: t
	),

	knoten: REGELWERK_2026_10_28.knoten.map(mitWeg),

	freigabevermerk:
		REGELWERK_2026_10_28.freigabevermerk +
		' In der Fassung 2026-10-29 sagt jede Karte mit Einstimmigkeit, was gilt, wenn eine Zustimmung ' +
		'fehlt, und nennt den sicheren Weg.'
} satisfies Regelwerk;
