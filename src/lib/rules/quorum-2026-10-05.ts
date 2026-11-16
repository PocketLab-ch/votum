/**
 * Regelwerk, Fassung 2026-10-05.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung erweitert die Ausnahme von der
 * Flächenregel aus 2026-10-04 um den Balkon im Sonderrecht, an drei Stellen:
 * erste Bedingung und Kostenhinweis der Karte `k-baulich-luxurioes-ausweg`,
 * Hilfe zur Frage `f1-4`. **Am Erfordernis und an den Wegen durch den
 * Entscheidbaum ändert sich nichts.**
 *
 * **Anlass.** 2026-10-04 nahm nur den Dach- oder Fassadenteil über einer
 * Fläche mit eigenem Sondernutzungsrecht aus. Das Innere eines Balkons ist
 * aber nach herrschender Lehre sonderrechtsfähig, wenn es vom Balkon der
 * Nachbarn getrennt ist (Wermelinger, SVIT-Kommentar 2023, Art. 712b Rz. 66
 * bis 68; BGer 5A_972/2020 E. 5.1); nur wo das Grundbuch das nicht anerkennt,
 * wird ein Sondernutzungsrecht begründet (Rz. 68). Die Markise über einem
 * solchen Balkon fiel deshalb unter die Einstimmigkeit, obwohl die anderen
 * dort erst recht keine Nutzung verlieren (Fachprüfung 27.09.2026, C1-2).
 * Sonderrecht gibt es nur an Balkon oder Loggia, nie an Garten oder
 * Sitzplatz, weil der Boden zwingend gemeinschaftlich ist (Art. 712b Abs. 2
 * Ziff. 1; Rz. 113, 143 ad Art. 712b; Fachprüfung Runde 11). Und die Markise
 * an der Unterseite des Balkons darüber ist der Regelfall ab dem ersten Stock;
 * die äussere Seite eines Balkons ist gemeinschaftlich wie die Fassade (Rz. 70,
 * 168 ad Art. 712b; Laienprüfung Runde 11).
 * Produktentscheid 27.09.2026 auf diese Rückfrage: «stimmt alles für mich»
 * (`quellen/themen/stockwerkeigentum/fragen.md`, «Offen», «Dach und Fassade»).
 * Die Fassade selbst bleibt gemeinschaftlich (Rz. 170 ad Art. 712b).
 *
 * Geprüft in Laien- und Fachprüfung
 * (`quellen/pruefung/berichte/2026-09-27-vertretung-und-dachflaeche.md`).
 */
import type { Ergebnisknoten, Frage } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_04 } from './quorum-2026-10-04';

/**
 * Die Ersetzungen, je [Wortlaut in 2026-10-04, neuer Wortlaut, Ort]. Neben der
 * Ausnahme selbst: Der Satz zum «fremden Balkon» traf nach der Erweiterung
 * genau die Markise unter dem Balkon darüber; gemeint ist die Innenseite eines
 * fremden Balkons, die dessen Sonderrecht ist (Rz. 67 ad Art. 712b). Und die
 * Montage bei Arbeiten am Bauteil, an dem die Markise hängt, fehlte, wenn das
 * Bauteil darüber liegt (Laien- und Fachprüfung Runde 12); die Aufzählung der
 * Bauteile ist deshalb durch «wenn die Anlage für Arbeiten der Gemeinschaft
 * weichen muss» ersetzt (Laienprüfung Runde 13).
 */
const KARTE: [string, string, string][] = [
	[
		'direkt über dem Sitzplatz oder Garten des Bauherrn, also über einer Fläche, an der ' +
		'er selbst ein Sondernutzungsrecht hat, etwa seine Markise über diesem Sitzplatz.',
		'direkt über einem Sitzplatz oder Garten, an dem der Bauherr ein Sondernutzungsrecht ' +
		'hat, oder über seinem Balkon oder seiner Loggia, wenn sie ihm im Sonderrecht gehören ' +
		'oder er daran ein Sondernutzungsrecht hat, etwa seine Markise darüber; was gilt, ' +
		'steht im Begründungsakt, im Aufteilungsplan, im Reglement oder als Dienstbarkeit im ' +
		'Grundbuch (zum Balkon im Sonderrecht Wermelinger, SVIT-Kommentar 2023, Art. 712b Rz. ' +
		'66 bis 68, 113). Dasselbe gilt für eine Markise an der Unterseite des Balkons ' +
		'darüber oder an der Decke der Loggia: Die äussere Seite eines Balkons ist ' +
		'gemeinschaftlich wie die Fassade, die Decke trägt das Gebäude und ist deshalb ebenfalls ' +
		'gemeinschaftlich (Art. 712b Abs. 2 Ziff. 2; Rz. 70, 154, 168).',
		'Erste Bedingung, Ausnahme'
	],
	[
		'eine Markise, die an einem fremden Balkon hängt, kann die anderen Eigentümer dauernd ' +
		'beeinträchtigen;',
		'eine Markise, die an der Innenseite eines fremden Balkons befestigt ist oder in ihn ' +
		'hineinragt, kann die anderen Eigentümer dauernd beeinträchtigen;',
		'Erste Bedingung, fremder Balkon'
	],
	[
		'Steht die Anlage auf einer Fläche mit Sondernutzungsrecht oder direkt darüber, etwa ' +
		'an der Fassade, und bleibt sie dem Berechtigten vorbehalten,',
		'Steht die Anlage auf einer Fläche mit Sondernutzungsrecht oder direkt über einer ' +
		'solchen Fläche oder über einem Balkon oder einer Loggia im Sonderrecht, etwa an der ' +
		'Fassade, und bleibt sie dem Berechtigten vorbehalten,',
		'Kostenhinweis, Fläche'
	],
	[
		'wenn die Gemeinschaft am Bauteil darunter oder dahinter arbeitet,',
		'wenn die Anlage für Arbeiten der Gemeinschaft weichen muss,',
		'Kostenhinweis, Montage'
	]
];

const HILFE: [string, string, string][] = [
	[
		'direkt über dem Sitzplatz oder Garten des Bauherrn, also über einer Fläche, an der ' +
		'er selbst ein Sondernutzungsrecht hat, etwa seine Markise darüber,',
		'direkt über einem Sitzplatz oder Garten, an dem der Bauherr ein Sondernutzungsrecht ' +
		'hat, oder über seinem Balkon oder seiner Loggia, wenn sie ihm im Sonderrecht gehören ' +
		'oder er daran ein Sondernutzungsrecht hat, etwa seine Markise darüber, auch an der ' +
		'Unterseite des Balkons darüber oder an der Decke der Loggia,',
		'Hilfe f1-4, Ausnahme'
	],
	[
		'an einer anderen Wohnung, etwa an einem fremden Balkon, jemanden dauernd ' +
		'beeinträchtigt,',
		'an einer anderen Wohnung, etwa an der Innenseite eines fremden Balkons, jemanden ' +
		'dauernd beeinträchtigt,',
		'Hilfe f1-4, fremder Balkon'
	]
];

function ersetzeGenau(text: string, alt: string, neu: string, wo: string): string {
	if (text.split(alt).length !== 2) throw new Error(`${wo}: Wortlaut nicht genau einmal gefunden`);
	return text.replace(alt, neu);
}

/**
 * Jede Ersetzung greift in genau einem Hinweis genau einmal; sonst wirft die
 * Fassung beim Laden, statt still am Text vorbeizulaufen.
 */
function ersetzeInHinweisen(hinweise: string[]): string[] {
	let ergebnis = hinweise;
	for (const [alt, neu, wo] of KARTE) {
		if (ergebnis.filter((h) => h.includes(alt)).length !== 1) {
			throw new Error(`${wo}: nicht genau ein Hinweis`);
		}
		ergebnis = ergebnis.map((h) => (h.includes(alt) ? ersetzeGenau(h, alt, neu, wo) : h));
	}
	return ergebnis;
}

const KNOTEN_NEU: Record<string, (k: Ergebnisknoten) => Ergebnisknoten> = {
	'k-baulich-luxurioes-ausweg': (k) => ({ ...k, hinweise: ersetzeInHinweisen(k.hinweise ?? []) })
};

const FRAGEN_NEU: Record<string, (f: Frage) => Frage> = {
	'f1-4': (f) => ({
		...f,
		hilfe: HILFE.reduce((text, [alt, neu, wo]) => ersetzeGenau(text, alt, neu, wo), f.hilfe ?? '')
	})
};

export const REGELWERK_2026_10_05 = {
	...REGELWERK_2026_10_04,
	fassung: '2026-10-05',

	quellen: [
		...REGELWERK_2026_10_04.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712b Rz. 66 bis 68 und 113 (Inneres von Balkon ' +
			'und Loggia sonderrechtsfähig; BGer 5A_972/2020 E. 5.1), Rz. 70, 168 und 170 (äussere ' +
			'Seite des Balkons und Fassade zwingend gemeinschaftlich); Art. 712a Rz. 160 ' +
			'(Sondernutzungsrecht auch als Dienstbarkeit).'
	],

	fragen: REGELWERK_2026_10_04.fragen.map((f): Frage => FRAGEN_NEU[f.id]?.(f) ?? f),

	knoten: REGELWERK_2026_10_04.knoten.map((k): Ergebnisknoten => KNOTEN_NEU[k.id]?.(k) ?? k),

	freigabevermerk:
		REGELWERK_2026_10_04.freigabevermerk +
		' Am 05.10.2026 gilt die Ausnahme für Dach und Fassade auch über einem Balkon oder einer ' +
		'Loggia im Sonderrecht und für eine Markise an der Unterseite des Balkons darüber oder an ' +
		'der Decke der Loggia. Am Erfordernis ändert sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
