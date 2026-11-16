/**
 * Regelwerk, Fassung 2026-10-04.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ergänzt an der Karte
 * `k-baulich-luxurioes-ausweg` die erste Bedingung und an der Frage `f1-4`
 * davor die Hilfe um eine Ausnahme von der Flächenregel: den Teil von Dach
 * oder Fassade direkt über dem eigenen Sondernutzungsbereich. **Am
 * Erfordernis und an den Wegen durch den Entscheidbaum ändert sich nichts.**
 *
 * **Anlass.** Seit 2026-10-02 geht das Werkzeug von Einstimmigkeit aus, wenn
 * eine luxuriöse Anlage eine gemeinsame Fläche belegt, die ein Gegner benutzen
 * darf. Dach und Fassade sind gemeinsame Teile, und so fiel auch die Markise
 * über dem eigenen Sitzplatz darunter. Produktentscheid 27.09.2026: «Dachfläche
 * (ausser Fläche gemeinsame Dachterrasse) und Fassade kann der 647e angewendet
 * werden, weil dort eigentlich kein Nutzung bspw. einer Partei im EG besteht.
 * Also wenn das auf dem Bereich eigener Sondernutzungsrecht steht.» Auf
 * Rückfrage ausgenommen **nur** der Teil über dem eigenen
 * Sondernutzungsbereich, nicht Dach und Fassade allgemein
 * (`quellen/themen/stockwerkeigentum/fragen.md`, «Offen»). Stütze: Benutzt
 * werden darf ein gemeinschaftlicher Teil nur nach seiner Zweckbestimmung,
 * Zugänglichkeit allein berechtigt nicht (Wermelinger, SVIT-Kommentar 2023,
 * Art. 712a Rz. 143, 144; BGE 127 III 506, nicht publizierter Teil, E. 5).
 *
 * **Das Aussehen bleibt unter der ersten Bedingung**, ebenso eine andere
 * Wohnung, an deren Balkon die Anlage hängt. Rz. 129 ad Art. 712a nennt
 * optische Veränderungen «heikel», dort zu Art. 647d Abs. 2; Rz. 141 bindet ein
 * reglementarisches Baurecht am Sondernutzungsrecht daran, dass die äussere
 * Erscheinung nicht beeinträchtigt wird. Beide Stellen tragen nur übertragen,
 * und die Fundstellen sagen das (Fachprüfung 27.09.2026, C1-1, C1-R2-1). Der
 * Satz nach dem Einschub schliesst Aussehen und fremden Balkon ausdrücklich
 * ein, sonst bliebe für sie kein Schritt.
 *
 * **Sonderrecht fehlt, mit Absicht.** Die Fachprüfung vom 27.09.2026 (C1-2)
 * fand, die Begründung trage für den eigenen Balkon im Sonderrecht erst recht.
 * Der Produktentscheid nennt nur den Sondernutzungsbereich; die Ausnahme
 * bleibt so eng, bis das Haus es anders entscheidet. Die Folge ist die
 * strengere Antwort, Einstimmigkeit.
 *
 * Geprüft in Laien- und Fachprüfung
 * (`quellen/pruefung/berichte/2026-09-27-vertretung-und-dachflaeche.md`).
 */
import type { Ergebnisknoten, Frage } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_03 } from './quorum-2026-10-03';

/** Wonach an der Karte eingefügt wird; ändert sich der Wortlaut, bricht die Fassung laut. */
const KARTE_ANKER =
	'Soll die Anlage allen offenstehen, passen Sie zudem das Sondernutzungsrecht im Reglement ' +
	'an, als eigenen Antrag.';

const KARTE_DACH =
	' Ausgenommen ist auch ein Teil von Dach oder Fassade direkt über dem Sitzplatz oder ' +
	'Garten des Bauherrn, also über einer Fläche, an der er selbst ein Sondernutzungsrecht hat, ' +
	'etwa seine Markise über diesem Sitzplatz. Die anderen Eigentümer benutzen diesen Teil ' +
	'ohnehin nicht: Einen gemeinsamen Teil darf man nur nach seinem Zweck benutzen, und dass ' +
	'man ihn erreichen könnte, genügt nicht (Wermelinger, SVIT-Kommentar 2023, Art. 712a ' +
	'Rz. 143, 144). Die Zustimmung eines einzelnen Eigentümers braucht es für diese Fläche ' +
	'nicht; beschliessen muss die Versammlung trotzdem. Dach und Fassade im Übrigen gehören ' +
	'nicht dazu, auch keine gemeinsame Dachterrasse. Das Aussehen des Hauses und die anderen ' +
	'Wohnungen bleiben zu prüfen: Eine sichtbare Veränderung oder eine Markise, die an einem ' +
	'fremden Balkon hängt, kann die anderen Eigentümer dauernd beeinträchtigen; ob das Aussehen ' +
	'allein genügt, ist nicht geklärt (Rz. 129, dort zu Art. 647d Abs. 2; Rz. 141, dort zu ' +
	'Baurechten im Reglement). Dass man die Anlage sieht, etwa eine Markise in Farbe und Art ' +
	'der übrigen, begründet noch keinen Zweifel; es braucht einen Grund, der auch einen ' +
	'Durchschnittsmenschen stören würde, etwa eine auffällig abweichende Farbe oder Form.';

/**
 * Der Satz danach bezog «anderen» bis hierher auf die Fläche; nach dem Einschub
 * läse er sich als «anders als Aussehen und fremder Balkon» und liesse genau
 * diese beiden ohne Schritt (Laienprüfung 27.09.2026, Runde 2, C1-3).
 */
const FOLGESATZ_ALT = 'Bleibt bei einer anderen Beeinträchtigung Zweifel,';
const FOLGESATZ_NEU =
	'Bleibt beim Aussehen, bei einer anderen Wohnung oder bei einer anderen Beeinträchtigung ' +
	'Zweifel,';

const FRAGE_ANKER = 'Stimmt er nicht zu, wählen Sie «Ja, oder es ist unklar».';

const FRAGE_DACH =
	' Ausgenommen ist auch ein Teil von Dach oder Fassade direkt über dem Sitzplatz oder ' +
	'Garten des Bauherrn, also über einer Fläche, an der er selbst ein Sondernutzungsrecht hat, ' +
	'etwa seine Markise darüber, nicht aber Dach und Fassade im Übrigen. Dort verliert niemand ' +
	'etwas, und die Zustimmung eines einzelnen Eigentümers braucht es für diese Fläche nicht. ' +
	'Bleibt Zweifel, ob die Anlage durch ihr Aussehen oder an einer anderen Wohnung, etwa an ' +
	'einem fremden Balkon, jemanden dauernd beeinträchtigt, wählen Sie «Ja, oder es ist ' +
	'unklar»; ob das Aussehen allein genügt, ist nicht geklärt.';

function fuegeEin(text: string, anker: string, zusatz: string, wo: string): string {
	if (text.split(anker).length !== 2) throw new Error(`${wo}: Anker nicht genau einmal gefunden`);
	return text.replace(anker, anker + zusatz);
}

function ersetzeGenau(text: string, alt: string, neu: string, wo: string): string {
	if (text.split(alt).length !== 2) throw new Error(`${wo}: Wortlaut nicht genau einmal gefunden`);
	return text.replace(alt, neu);
}

/**
 * Der Kostenhinweis sagte «auf» der Fläche; die Markise hängt darüber und fiel
 * wörtlich nicht darunter, sodass für sie der Rat zu Ausschluss und Einkauf
 * galt (Codeprüfung 27.09.2026, Niedrig 1). Ersetzt wird der ganze Hinweis:
 * Rz. 182 ad Art. 712a trägt nur die Anlage auf der Fläche; dass es darüber
 * weder Ausschluss noch Einkauf braucht, tragen Rz. 143, 144. Und wo die
 * Gemeinschaft am Bauteil darunter oder dahinter arbeitet, an der Fassade wie
 * an der Abdichtung einer Dachterrasse, kommt die Ab- und Wiedermontage dazu
 * (Rz. 110, 111 ad Art. 712h; Fachprüfung Runden 8 und 9).
 */
const KOSTEN_ALT =
	'Steht die Anlage auf einer Fläche mit Sondernutzungsrecht und bleibt sie dem Berechtigten ' +
	'vorbehalten, braucht es weder Ausschluss noch Einkauf. Betrieb, Unterhalt, spätere ' +
	'Erneuerungen und ein allfälliger Rückbau gehen dann zulasten seiner Wohnung; legen Sie das ' +
	'im Beschluss fest (Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 182).';
const KOSTEN_NEU =
	'Steht die Anlage auf einer Fläche mit Sondernutzungsrecht oder direkt darüber, etwa an der ' +
	'Fassade, und bleibt sie dem Berechtigten vorbehalten, braucht es weder Ausschluss noch ' +
	'Einkauf; über der Fläche verliert niemand eine Nutzung (Wermelinger, SVIT-Kommentar 2023, ' +
	'Art. 712a Rz. 143, 144). Betrieb, Unterhalt, spätere Erneuerungen, ein allfälliger Rückbau ' +
	'und auch Ab- und Wiedermontage, wenn die Gemeinschaft am Bauteil darunter oder dahinter ' +
	'arbeitet, gehen dann zulasten seiner Wohnung; legen Sie das im Beschluss fest (Art. 712a ' +
	'Rz. 182; Art. 712h Rz. 110, 111).';

/** Genau ein Hinweis beginnt so; sonst liefe die Fassung still am Text vorbei. */
function genauEiner(hinweise: string[], anfang: string): string[] {
	if (hinweise.filter((h) => h.startsWith(anfang)).length !== 1) {
		throw new Error(`«${anfang}»: nicht genau ein Hinweis`);
	}
	return hinweise;
}

const KNOTEN_NEU: Record<string, (k: Ergebnisknoten) => Ergebnisknoten> = {
	'k-baulich-luxurioes-ausweg': (k) => ({
		...k,
		hinweise: genauEiner(genauEiner(k.hinweise ?? [], 'Erste Bedingung:'), KOSTEN_ALT).map((h) =>
			h === KOSTEN_ALT
				? ersetzeGenau(h, KOSTEN_ALT, KOSTEN_NEU, 'Kostenhinweis Sondernutzungsfläche')
				: h.startsWith('Erste Bedingung:')
				? ersetzeGenau(
						fuegeEin(h, KARTE_ANKER, KARTE_DACH, 'Erste Bedingung'),
						FOLGESATZ_ALT,
						FOLGESATZ_NEU,
						'Folgesatz der ersten Bedingung'
					)
				: h
		)
	})
};

const FRAGEN_NEU: Record<string, (f: Frage) => Frage> = {
	'f1-4': (f) => ({ ...f, hilfe: fuegeEin(f.hilfe ?? '', FRAGE_ANKER, FRAGE_DACH, 'Hilfe f1-4') })
};

export const REGELWERK_2026_10_04 = {
	...REGELWERK_2026_10_03,
	fassung: '2026-10-04',

	quellen: [
		...REGELWERK_2026_10_03.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 144 (Benutzung nach der Zweckbestimmung, ' +
			'Zugänglichkeit berechtigt nicht; BGE 127 III 506, nicht publizierter Teil, E. 5), ' +
			'Rz. 129 (optische Veränderungen, zu Art. 647d Abs. 2) und Rz. 141 (Baurecht am ' +
			'Sondernutzungsrecht nur ohne Beeinträchtigung der äusseren Erscheinung).'
	],

	fragen: REGELWERK_2026_10_03.fragen.map((f): Frage => FRAGEN_NEU[f.id]?.(f) ?? f),

	knoten: REGELWERK_2026_10_03.knoten.map((k): Ergebnisknoten => KNOTEN_NEU[k.id]?.(k) ?? k),

	freigabevermerk:
		REGELWERK_2026_10_03.freigabevermerk +
		' Am 04.10.2026 nimmt die erste Bedingung der luxuriösen Massnahme den Teil von Dach oder ' +
		'Fassade direkt über dem eigenen Sondernutzungsbereich von der Flächenregel aus; das ' +
		'Aussehen bleibt zu prüfen. Am Erfordernis ändert sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
