/**
 * Die Übersicht über Versammlungen und Abende: suchen, filtern, ordnen.
 *
 * **Warum das im Kern steht und nicht in der Seite.** Die Liste entscheidet,
 * was jemand sieht, wenn er das Werkzeug öffnet — und damit auch, was er nicht
 * sieht. Eine übersehene laufende Versammlung ist im Saal ein Problem. Als
 * reine Funktion lässt sich die Einteilung mit einer Wertetabelle prüfen; in
 * einer Svelte-Datei liesse sie sich nur durchklicken (AD-1).
 *
 * **Vier Fächer statt fünf Zustände.** Die Zustände beschreiben, wo eine
 * Versammlung im Ablauf steht; die Fächer beschreiben, was zu tun ist. Das ist
 * nicht dasselbe: «geschlossen» klingt nach erledigt, heisst aber, dass
 * Protokoll und Siegel noch fehlen. Wer die Liste nach Zuständen ordnete,
 * versteckte diese Arbeit zwischen den versiegelten Versammlungen.
 *
 * **Der Abend ist eine Zeile, kein eigener Zweig.** Tagen sieben Gemeinschaften
 * an einem Abend, gehören sie in der Übersicht zusammen — aber in dasselbe
 * Fach wie alles andere, sonst muss man an zwei Stellen nachsehen, ob heute
 * etwas läuft. Die Versammlungen darunter bleiben, was sie sind: eigene
 * Beschlussfähigkeit, eigenes Protokoll, eigene Anfechtungsfrist.
 */
import { datumLang } from './datum';
import { filtereNach, punktdatum, suchwoerter, trifft } from './listensuche';
import { zustandsname, type Versammlungsart, type Versammlungszustand } from './versammlung';
import type { Versammlungsstufe } from './beschlussfaehigkeit';

export { suchwoerter };

/** Was zu tun ist — nicht, wo im Ablauf die Versammlung steht. */
export type Arbeitsstand = 'laufend' | 'kommend' | 'nachzuarbeiten' | 'abgeschlossen';

const STAND_JE_ZUSTAND: Record<Versammlungszustand, Arbeitsstand> = {
	laufend: 'laufend',
	entwurf: 'kommend',
	freigegeben: 'kommend',
	geschlossen: 'nachzuarbeiten',
	versiegelt: 'abgeschlossen'
};

export function arbeitsstand(zustand: Versammlungszustand): Arbeitsstand {
	return STAND_JE_ZUSTAND[zustand];
}

/**
 * Die Reihenfolge der Fächer und ihre Beschriftung.
 *
 * `zugeklappt` ist eine Vorgabe für die Seite, keine Aussage über den Inhalt:
 * Abgeschlossenes ist die grösste Gruppe und die, die am seltensten gebraucht
 * wird. Sie ausgeklappt zu zeigen hiesse, das Laufende nach unten zu schieben.
 */
export const FAECHER: {
	stand: Arbeitsstand;
	titel: string;
	leer: string;
	zugeklappt: boolean;
}[] = [
	{
		stand: 'laufend',
		titel: 'Läuft jetzt',
		leer: 'Zurzeit läuft keine Versammlung.',
		zugeklappt: false
	},
	{
		stand: 'kommend',
		titel: 'In Vorbereitung',
		leer: 'Nichts in Vorbereitung.',
		zugeklappt: false
	},
	{
		stand: 'nachzuarbeiten',
		titel: 'Nachzuarbeiten',
		leer: 'Nichts nachzuarbeiten.',
		zugeklappt: false
	},
	{
		stand: 'abgeschlossen',
		titel: 'Abgeschlossen',
		leer: 'Noch nichts abgeschlossen.',
		zugeklappt: true
	}
];

export interface Versammlungseintrag {
	id: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	gemeinschaftName: string;
	art: Versammlungsart;
	stufe: Versammlungsstufe;
	anlass?: string | null;
	zustand: Versammlungszustand;
	/** Der Abend, zu dem sie gehört — oder null, wenn sie für sich steht. */
	tagId: string | null;
	/** Seit wann sie im Archiv liegt (Migration 086); null heisst: im Dienst. */
	/**
	 * **Pflichtfeld, nicht optional** (25.08.2026). Als `?` gefuehrt fehlte es
	 * in der Zuordnung auf `/versammlungen` — ohne einen Mucks vom Uebersetzer.
	 * Die Seite filterte dann gegen `undefined`: Archiviertes stand weiter in
	 * der Liste, und der Schalter erschien nie.
	 */
	archiviertAm: string | null;
	/** Seit wann die Gruppe der Gemeinschaft im Archiv liegt — `null`, wenn nicht. */
	gemeinschaftArchiviertSeit: string | null;
}

export interface Abendeintrag {
	id: string;
	bezeichnung: string;
	datum: string;
	uhrzeit: string;
	ort: string;
}

export interface Einzelzeile {
	art: 'einzeln';
	schluessel: string;
	versammlung: Versammlungseintrag;
}

export interface Abendzeile {
	art: 'abend';
	schluessel: string;
	abend: Abendeintrag;
	/** Die sichtbaren Versammlungen des Abends, in der Reihenfolge des Fachs. */
	versammlungen: Versammlungseintrag[];
	/** Wie viele der Abend insgesamt hat — auch die, die Suche oder Filter ausblenden. */
	gesamt: number;
}

export type Zeile = Einzelzeile | Abendzeile;

export interface Fachinhalt {
	stand: Arbeitsstand;
	titel: string;
	leer: string;
	zugeklappt: boolean;
	zeilen: Zeile[];
	/** Die Zahl der Versammlungen im Fach — Abende zählen nicht als Einheit. */
	anzahl: number;
}

export interface Listenfilter {
	suche?: string;
	zustand?: Versammlungszustand | null;
	/**
	 * Welche Abende im **ungefilterten** Bestand überhaupt Versammlungen haben.
	 *
	 * Trennt «noch nie eine zugeordnet» von «gerade alle weggefiltert» — ohne
	 * diese Unterscheidung stand ein Abend, dessen Versammlungen im Archiv
	 * liegen, als anstehende, leere Zeile in der Liste.
	 */
	belegteAbende?: ReadonlySet<string>;
}

/**
 * Woraus die Suche einer Versammlung besteht.
 *
 * Das Datum steht dreimal darin, weil es dreimal gesucht wird: als ISO-Form aus
 * einem Bericht oder einer Adresse übernommen, als «11.09.2026» aus dem
 * Kalender und als «11. September 2026» aus der Einladung. Ein Suchfeld, das
 * nur eine davon kennt, wirkt kaputt.
 *
 * **Die ISO-Form steht seit dem 06.09.2026 nicht mehr in der Liste selbst**
 * (Bedienbarkeitsprüfung, Befund 21): Die Datumsspalte zeigt jetzt
 * «11.09.2026». Gesucht wird sie trotzdem weiter — abgeschrieben wird sie nun
 * aus anderen Quellen, nicht mehr vom Bildschirm daneben.
 */
function suchtextVersammlung(v: Versammlungseintrag): string {
	return [
		v.gemeinschaftName,
		v.ort,
		v.anlass ?? '',
		v.datum,
		punktdatum(v.datum),
		datumLang(v.datum),
		zustandsname(v.zustand),
		v.art === 'ordentlich' ? 'ordentlich' : 'ausserordentlich',
		v.stufe === 'zweite' ? 'Zweitversammlung' : 'Erstversammlung'
	].join(' ');
}

function suchtextAbend(a: Abendeintrag): string {
	return [a.bezeichnung, a.ort, a.datum, punktdatum(a.datum), datumLang(a.datum)].join(' ');
}

const RANG: Record<Arbeitsstand, number> = {
	laufend: 0,
	kommend: 1,
	nachzuarbeiten: 2,
	abgeschlossen: 3
};

/**
 * In welches Fach ein Abend gehört.
 *
 * In das dringlichste seiner Versammlungen: Läuft eine von sieben, gehört der
 * ganze Abend nach oben — dort wird gearbeitet. Ein Abend ohne zugeordnete
 * Versammlung ist eine angefangene Planung und steht deshalb bei den kommenden,
 * nicht bei den abgeschlossenen.
 */
export function abendstand(versammlungen: Versammlungseintrag[]): Arbeitsstand {
	if (versammlungen.length === 0) return 'kommend';
	return versammlungen
		.map((v) => arbeitsstand(v.zustand))
		.reduce((a, b) => (RANG[a] <= RANG[b] ? a : b));
}

function schluesselVon(datum: string, uhrzeit: string): string {
	return `${datum} ${uhrzeit}`;
}

/**
 * Sortiert ein Fach.
 *
 * Kommendes aufsteigend — das Nächste zuerst, weil danach gefragt wird. Alles
 * andere absteigend, weil dort das Jüngste das Gesuchte ist. Eine einheitliche
 * Richtung wäre einfacher zu erklären und in beiden Fällen die falsche.
 */
function sortiere<T>(eintraege: T[], stand: Arbeitsstand, schluessel: (e: T) => string): T[] {
	const aufsteigend = stand === 'kommend' || stand === 'laufend';
	return [...eintraege].sort((a, b) => {
		const x = schluessel(a);
		const y = schluessel(b);
		if (x === y) return 0;
		return aufsteigend ? (x < y ? -1 : 1) : x < y ? 1 : -1;
	});
}

/**
 * Baut die Übersicht: Suche und Zustandsfilter angewandt, in Fächer geordnet.
 *
 * **Ein Abend bleibt sichtbar, sobald seine Bezeichnung passt** — dann mit
 * allen seinen Versammlungen. Trifft nur eine seiner Versammlungen, steht er
 * mit dieser einen da und sagt daneben, wie viele er insgesamt hat. Ihn
 * wegzulassen, weil er selbst nicht passt, versteckte die Treffer darunter.
 */
export function baueUebersicht(
	versammlungen: Versammlungseintrag[],
	abende: Abendeintrag[],
	filter: Listenfilter = {}
): Fachinhalt[] {
	const woerter = suchwoerter(filter.suche ?? '');
	const zustand = filter.zustand ?? null;
	const belegteAbende = filter.belegteAbende;

	const passtVersammlung = (v: Versammlungseintrag) =>
		(zustand === null || v.zustand === zustand) && trifft(suchtextVersammlung(v), woerter);

	const jeAbend = new Map<string, Versammlungseintrag[]>();
	for (const a of abende) jeAbend.set(a.id, []);
	const einzeln: Versammlungseintrag[] = [];
	for (const v of versammlungen) {
		// Eine Versammlung mit einem Abend, den es nicht gibt, fiele sonst aus der
		// Liste. Sie steht dann für sich — sichtbar bleibt sie in jedem Fall.
		const gruppe = v.tagId ? jeAbend.get(v.tagId) : undefined;
		if (gruppe) gruppe.push(v);
		else einzeln.push(v);
	}

	const zeilen: { stand: Arbeitsstand; schluessel: string; zeile: Zeile }[] = [];

	for (const v of einzeln) {
		if (!passtVersammlung(v)) continue;
		const stand = arbeitsstand(v.zustand);
		zeilen.push({
			stand,
			schluessel: schluesselVon(v.datum, v.uhrzeit),
			zeile: { art: 'einzeln', schluessel: v.id, versammlung: v }
		});
	}

	for (const a of abende) {
		const alle = jeAbend.get(a.id) ?? [];
		const abendTrifft = trifft(suchtextAbend(a), woerter);
		// Der Zustandsfilter greift auch dann, wenn der Abend selbst passt: Wer auf
		// «laufend» filtert, will keine versiegelten Zeilen sehen, bloss weil sie an
		// einem Abend hängen, dessen Name das Suchwort trägt.
		const sichtbar = alle.filter((v) =>
			abendTrifft ? zustand === null || v.zustand === zustand : passtVersammlung(v)
		);
		if (sichtbar.length === 0) {
			/*
			 * Ein Abend ohne Versammlungen ist noch keine Leiche: Er ist angelegt
			 * und wartet auf die Zuordnung. Sichtbar bleibt er, solange nicht nach
			 * einem Zustand gefiltert wird, den er gar nicht haben kann.
			 *
			 * **«Nie belegt» ist nicht «gerade weggefiltert»** (25.08.2026, dritte
			 * Reviewrunde). Seit die Gruppe gemeinsam ins Archiv geht, kann ein
			 * einmal gefüllter Abend leer werden: Klammer archivieren, und beide
			 * versiegelten Versammlungen von 2024 fallen aus dem Bestand. Der Abend
			 * stand danach als **anstehende** Zeile in der Liste, als warte er auf
			 * Zuordnung. `belegteAbende` kennt den ungefilterten Bestand und
			 * unterscheidet die beiden Fälle.
			 */
			const nieBelegt = belegteAbende ? !belegteAbende.has(a.id) : alle.length === 0;
			if (!(abendTrifft && nieBelegt && zustand === null)) continue;
		}
		const stand = abendstand(sichtbar.length > 0 ? sichtbar : alle);
		zeilen.push({
			stand,
			schluessel: schluesselVon(a.datum, a.uhrzeit),
			zeile: {
				art: 'abend',
				schluessel: a.id,
				abend: a,
				versammlungen: sortiere(sichtbar, stand, (v) => schluesselVon(v.datum, v.uhrzeit)),
				gesamt: alle.length
			}
		});
	}

	return FAECHER.map((fach) => {
		const eigene = zeilen.filter((z) => z.stand === fach.stand);
		const geordnet = sortiere(eigene, fach.stand, (z) => z.schluessel).map((z) => z.zeile);
		return {
			...fach,
			zeilen: geordnet,
			anzahl: geordnet.reduce(
				(summe, z) => summe + (z.art === 'abend' ? z.versammlungen.length : 1),
				0
			)
		};
	});
}

export interface Gemeinschaftseintrag {
	id: string;
	name: string;
	/** Strasse, PLZ und Ort, soweit erfasst — das Unterscheidungsmerkmal bei gleichen Namen. */
	adresse?: string | null;
}

/**
 * Die Auswahl der Gemeinschaft beim Anlegen.
 *
 * **Warum das eine Suche braucht und keine Liste genügt.** Ein Betreiber mit
 * fünfzig Gemeinschaften bekam eine Aufklappliste, die länger war als der
 * Bildschirm und nur mit der ganzen Seite scrollte. Gesucht wird über den Namen
 * **und** die Adresse: Zwei Gemeinschaften heissen «Haus 4», und was sie
 * unterscheidet, ist die Strasse.
 */
export function filtereGemeinschaften<T extends Gemeinschaftseintrag>(
	gemeinschaften: T[],
	suche: string
): T[] {
	return filtereNach(gemeinschaften, suche, (g) => `${g.name} ${g.adresse ?? ''}`);
}

export interface Zustandszaehlung {
	zustand: Versammlungszustand;
	anzahl: number;
}

/**
 * Die Zahlen für die Filterknöpfe.
 *
 * Gezählt wird **nach** der Suche, aber ohne den Zustandsfilter selbst: Sonst
 * stünde neben jedem Knopf ausser dem gewählten eine Null, und man sähe nicht
 * mehr, wohin zu wechseln sich lohnt. Zustände ohne Treffer fallen weg — ein
 * Knopf, der nichts findet, ist eine Sackgasse.
 */
export function zaehleZustaende(
	versammlungen: Versammlungseintrag[],
	suche = ''
): { gesamt: number; je: Zustandszaehlung[] } {
	const woerter = suchwoerter(suche);
	const treffer = versammlungen.filter((v) => trifft(suchtextVersammlung(v), woerter));
	const reihenfolge: Versammlungszustand[] = [
		'laufend',
		'entwurf',
		'freigegeben',
		'geschlossen',
		'versiegelt'
	];
	return {
		gesamt: treffer.length,
		je: reihenfolge
			.map((zustand) => ({ zustand, anzahl: treffer.filter((v) => v.zustand === zustand).length }))
			.filter((z) => z.anzahl > 0)
	};
}
