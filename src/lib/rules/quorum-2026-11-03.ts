/**
 * Fassung 2026-11-03: Wer bei der Ausschlussklage klagt (F1, Frage 3).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-10-30 abgeleitet, nicht
 * abgeschrieben: Jede Änderung holt sich ihren alten Wortlaut aus der
 * Vorfassung und bricht ab, wenn er dort nicht mehr steht. Auftrag F1,
 * Ablaufplan 2026-10-29 (Block A), entschieden vom Auftraggeber am 03.11.2026;
 * Prüfdateien `quellen/pruefung/zu-pruefen-2026-11-03-votum-f1-fachfragen.md`
 * und `…-runde2.md` (Frage 3 und 2.2), Fachprüfung in zwei Runden,
 * `quellen/pruefung/berichte/2026-11-03-votum-f1-fachfragen-fach.md` und
 * `…-fach-runde2.md`.
 *
 * **Anlass.** Wer klagt, sagte die Karte `k-ausschlussklage` nur unter einer
 * hinterlegten Regel (`KLAUSEL_UNTER_REGEL`, Fassung 2026-10-08), sonst
 * schwieg sie; die Karte `k-prozessfuehrung` (Art. 712t Abs. 2) grenzte sich
 * nicht ab. Eine Leitung beantragte deshalb womöglich «die Verwaltung wird
 * ermächtigt», und darauf gestützt klagt niemand, der klagen kann.
 *
 * Drei Punkte, jeder mit Fundstelle:
 *
 *  1. `k-ausschlussklage`, neuer Hinweis unter jeder Regel (`KLAEGER`): Klagen
 *     können nur Eigentümer, die selbst betroffen sind
 *     («der betroffene Stockwerkeigentümer», Rz. 215; «der oder die
 *     gestörten Miteigentümer», 5A_735/2019 E. 3.3.1; Fachprüfung F1-Sätze,
 *     A1), in eigenem Namen, nicht Gemeinschaft,
 *     Bewirtschaftung und Nutzniesser (Rz. 215 ad Art. 712a: «Weder die
 *     Stockwerkeigentümergemeinschaft noch der Verwalter noch die Berechtigten
 *     eines dinglichen oder persönlichen Rechts sind aktivlegitimiert»;
 *     Rz. 60 ad Art. 712l). Der Antrag nennt am sichersten mit Namen, wer
 *     von den Betroffenen klagt. Wer
 *     Ja stimmt, muss nicht klagen: Folgerung aus «berechtigt nur» (Rz. 206).
 *     Dass nicht alle zusammen klagen müssen, steht wörtlich (Rz. 215;
 *     BGer 5A_735/2019 E. 3.3.1, keine notwendige Streitgenossenschaft;
 *     Fachprüfung Runde 2, 3.2). Anwalt ohne weiteren Beschluss (E. 3.3.2);
 *     die Bewirtschaftung unterstützt, vertritt aber nicht vor Gericht
 *     (Art. 68 Abs. 2 ZPO; Rz. 21 ad Art. 712t). Kosten bei den Klagenden
 *     (Art. 106 Abs. 1 ZPO; Rz. 120 ad Art. 712h). Ob die Gemeinschaft Kosten
 *     übernehmen darf, ist offen (Hauslinie Frage 79); ein Beschluss dazu
 *     gehört in die Einladung (Art. 712m Abs. 2 mit Art. 67 Abs. 3 ZGB).
 *     Rz. 119 ad Art. 712h trägt das nicht, sie betrifft Verfahren der
 *     Gemeinschaft selbst (Fachprüfung F1-Sätze, A2).
 *  2. `k-ausschlussklage`, neuer Hinweis unter jeder Regel
 *     (`GRENZE_NUTZNIESSUNG`): Eine Klage gegen einen Nutzniesser
 *     (Art. 649c ZGB) kann Votum noch nicht führen, weil es ihn nicht als
 *     beklagte Partei erfasst (Produktentscheid 03.11.2026: kein Bau jetzt,
 *     Pendenz Ä-23). Der Hinweis verbaut den Umweg, den Eigentümer der
 *     Einheit als beklagt einzutragen (Laienprüfung F1-Sätze, A3-1). Unter
 *     der Regel fällt aus `KLAUSEL_UNTER_REGEL` der Satz
 *     «Die Gemeinschaft und die Bewirtschaftung können nicht selbst klagen»,
 *     den Punkt 1 jetzt in jedem Fall trägt; der Satz zum Zuwarten der
 *     ermächtigten Eigentümer bleibt, er sagt etwas anderes.
 *  3. `k-prozessfuehrung`, neuer Hinweis unter jeder Regel (`ABGRENZUNG`):
 *     Die Karte gilt nicht für die Ausschlussklage. Unter einer Regel ersetzt
 *     `ERMAECHTIGUNG_UNTER_REGEL` nur den Hinweis zum Streit um das Mehr; der
 *     neue steht daneben und bleibt deshalb auch dort sichtbar.
 *
 * **Am Erfordernis ändert sich nichts**: Typ, Bezugsgrössen und Verhalten
 * beider Karten bleiben, es kommt kein Traktandum in den Kasten «älteres
 * Erfordernis».
 *
 * **Nicht in diesem Lauf:** die Klage gegen Nutzniesser selbst (Ä-23), der
 * Website-Abzug.
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_30 } from './quorum-2026-10-30';

// ── Punkt 1 und 2: Wer klagt, und wo Votum noch nicht hilft ─────────────────

/**
 * Wer klagt, nach der Ermächtigung (Punkt 1). Steht in den Hinweisen, nicht
 * in der Begründung: Unter einer angewandten Regel ersetzt `karteMitReglement`
 * die Begründung, die Hinweise ohne Eintrag unter `hinweiseUnterRegel`
 * bleiben stehen.
 */
export const KLAEGER =
	'Klagen können nur Eigentümerinnen und Eigentümer, die selbst betroffen sind, in eigenem ' +
	'Namen (SVIT-Kommentar Rz. 215 ad Art. 712a; BGer 5A_735/2019 E. 3.3.1). Die Gemeinschaft, die ' +
	'Bewirtschaftung und Nutzniesser können es nicht (Rz. 215 ad Art. 712a). Wer betroffen ist, klären Sie im ' +
	'Zweifel vor der Einladung mit einer Anwältin oder einem Anwalt. Am sichersten nennt der Antrag ' +
	'mit Namen, wer von den Betroffenen klagen soll, und ermächtigt nicht die Bewirtschaftung. Wer Ja ' +
	'stimmt, muss nicht selbst klagen, denn der Beschluss berechtigt nur zur Klage (Rz. 206 ad Art. 712a). Sind ' +
	'mehrere betroffen, müssen nicht alle zusammen klagen (Rz. 215 ad Art. 712a; BGer 5A_735/2019 E. 3.3.1).';

/**
 * Nach dem Beschluss: Anwalt, Bewirtschaftung und Kosten (Punkt 1). Ohne
 * Rz. 119 ad Art. 712h: Sie betrifft Verfahren, in denen die Gemeinschaft
 * selbst Partei ist; ob sie Kosten der Klagenden übernehmen darf, ist offen
 * (Fachprüfung F1-Sätze, A2; Laienprüfung A2-1).
 */
export const KLAGE_UND_KOSTEN =
	'Wer klagt, beauftragt die Anwältin oder den Anwalt selbst; einen weiteren Beschluss braucht es dafür ' +
	'nicht (BGer 5A_735/2019 E. 3.3.2). Die Bewirtschaftung kann dabei unterstützen, vor Gericht vertreten kann ' +
	'sie nicht (Art. 68 Abs. 2 ZPO). Das Kostenrisiko des Prozesses tragen die Klagenden (Art. 106 Abs. 1 ZPO; ' +
	'Rz. 120 ad Art. 712h). Ob die Gemeinschaft Kosten übernehmen darf, ist rechtlich nicht geklärt; ein ' +
	'Beschluss dazu gehört in die Einladung (ZGB Art. 712m Abs. 2 mit Art. 67 Abs. 3).';

/**
 * Die Grenze der Anwendung (Punkt 2; Produktentscheid 03.11.2026, Pendenz
 * Ä-23), mit der Folge und ohne den Umweg über den Eigentümer der Einheit
 * (Laienprüfung F1-Sätze, A3-1; Fachprüfung A3).
 */
export const GRENZE_NUTZNIESSUNG =
	'Ein Traktandum zur Klage gegen einen Nutzniesser oder eine Nutzniesserin (ZGB Art. 649c) kann Votum noch ' +
	'nicht führen, weil es Nutzniesser nicht als beklagte Partei erfassen kann. Tragen Sie nicht die ' +
	'Eigentümerin oder den Eigentümer an seiner Stelle als beklagt ein; das wäre die falsche Partei, und Votum ' +
	'rechnete den Ausstand und das Mehr falsch. Klären Sie das Traktandum vor der Einladung mit einer Anwältin ' +
	'oder einem Anwalt.';

/** Der Hinweis der Vorfassung, hinter dem die neuen stehen. */
const AUSSCHLUSS_DURCH_GERICHT =
	'Der Ausschluss selbst spricht das Gericht aus; die Versammlung ermächtigt nur zur Klage (BGer 5A_735/2019 E. 3.3.1).';

/** Der Satz, den Punkt 1 jetzt in jedem Fall trägt, aus `KLAUSEL_UNTER_REGEL`. */
const NICHT_SELBST_KLAGEN = ' Die Gemeinschaft und die Bewirtschaftung können nicht selbst klagen (Art. 712a Rz. 215).';

// ── Punkt 3: Abgrenzung an der Prozessführung ───────────────────────────────

/** Die Abgrenzung zur Ausschlussklage, unter jeder Regel. */
export const ABGRENZUNG =
	'Diese Karte gilt nicht für die Ausschlussklage. Dort klagen Eigentümerinnen und Eigentümer selbst, nicht ' +
	'die Bewirtschaftung (SVIT-Kommentar Rz. 215 ad Art. 712a; Karte «Ermächtigung zur Ausschlussklage»).';

// ── Hilfen ───────────────────────────────────────────────────────────────────

/** Ersetzt einen Teilstring, der genau einmal vorkommt; sonst bricht die Fassung ab. */
function ersetze(text: string, alt: string, neu: string): string {
	if (text.split(alt).length !== 2) {
		throw new Error(`Fassung 2026-11-03: «${alt.slice(0, 60)}…» kommt nicht genau einmal vor.`);
	}
	return text.replace(alt, neu);
}

// ── Die Knoten ───────────────────────────────────────────────────────────────

const KNOTEN: Ergebnisknoten[] = REGELWERK_2026_10_30.knoten.map((vorher) => {
	if (vorher.id === 'k-ausschlussklage') {
		const hinweise = vorher.hinweise ?? [];
		const index = hinweise.indexOf(AUSSCHLUSS_DURCH_GERICHT);
		if (index < 0 || hinweise.lastIndexOf(AUSSCHLUSS_DURCH_GERICHT) !== index) {
			throw new Error('Fassung 2026-11-03: Der Hinweis zum Ausschluss durch das Gericht steht nicht genau einmal da.');
		}
		if (hinweise.some((h) => h.includes('Klagen können nur'))) {
			throw new Error('Fassung 2026-11-03: Die Vorfassung sagt schon, wer klagen kann.');
		}
		const unterRegel = vorher.hinweiseUnterRegel ?? [];
		const mitSatz = unterRegel.filter((u) => typeof u.ersatz === 'string' && u.ersatz.includes(NICHT_SELBST_KLAGEN));
		if (mitSatz.length !== 1) {
			throw new Error('Fassung 2026-11-03: Der Satz zur Klage der Gemeinschaft steht nicht genau einmal unter der Regel.');
		}
		return {
			...vorher,
			hinweise: [
				...hinweise.slice(0, index + 1),
				KLAEGER,
				KLAGE_UND_KOSTEN,
				GRENZE_NUTZNIESSUNG,
				...hinweise.slice(index + 1)
			],
			hinweiseUnterRegel: unterRegel.map((u) =>
				u === mitSatz[0] ? { ...u, ersatz: ersetze(u.ersatz as string, NICHT_SELBST_KLAGEN, '') } : u
			)
		};
	}
	if (vorher.id === 'k-prozessfuehrung') {
		if ((vorher.hinweise ?? []).some((h) => h.includes('Ausschlussklage'))) {
			throw new Error('Fassung 2026-11-03: Die Prozessführung grenzt sich schon ab.');
		}
		return { ...vorher, hinweise: [...(vorher.hinweise ?? []), ABGRENZUNG] };
	}
	return vorher;
});

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_03 = {
	...REGELWERK_2026_10_30,
	fassung: '2026-11-03',

	knoten: KNOTEN,

	freigabevermerk:
		REGELWERK_2026_10_30.freigabevermerk +
		' In der Fassung 2026-11-03 sagt die Karte zur Ausschlussklage in jedem Fall, wer klagen kann, was der ' +
		'Antrag am sichersten nennt, wer die Kosten trägt und dass Votum eine Klage gegen Nutzniesser noch nicht ' +
		'führen kann; die Karte zur Prozessführung grenzt sich davon ab. Am Erfordernis ändert sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
