/**
 * Einheiten, Quotenarten und die Prüfung der Wertquoten (Story 1.5, FR-2, AD-12).
 *
 * Die Saldoprüfung ist keine Formsache: Gehen die Wertquoten nicht auf, ist jede
 * spätere Auszählung nach Quoten falsch — und zwar unauffällig falsch, weil das
 * Ergebnis trotzdem eine Zahl liefert. Deshalb wird geprüft, bevor jemand
 * abstimmt, und nicht erst, wenn ein Beschluss angefochten wird.
 *
 * Eine Gemeinschaft führt in der Regel mehrere Schlüssel: die **Stammquote** aus
 * dem Grundbuch und daneben Verteiler für Aufzug, Heizung oder Waschküche. Jeder
 * hat seinen eigenen Nenner und geht für sich auf. Für das Stimmrecht nach
 * Wertquote zählt allein die Stammquote (ZGB Art. 712e); die übrigen sind
 * Kostenschlüssel.
 */
import type { Id, QuotaKind, UnitKind } from './types';
import { FachlicherFehler } from './gemeinschaft';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';
import { zeichenzahl } from './zeichenzahl';

export const EINHEITSARTEN: UnitKind[] = ['unit', 'parking'];

/** Schlüssel der Stammquote. Fest, weil die Auszählung sich darauf verlässt. */
export const STAMMQUOTE = 'stamm';

/**
 * Der Weg, wenn eine Stammquote Nachkommastellen hat (Ä-10, Produktentscheid
 * 18.10.2026, `docs/entscheide/0008`).
 *
 * Wertquoten bleiben ganzzahlig (AD-12); gerundet wird nichts. «Nenner ändern»
 * rechnet erfasste Quoten nicht um (`bearbeiteGemeinschaft` setzt nur
 * `quota_denominator`), deshalb verlangt der Satz, alle neu einzutragen.
 * Geteilt von Formular, Liste einfügen und Übernahme, damit die drei Wege
 * dasselbe sagen.
 */
export const WEG_GROESSERER_NENNER =
	'Vergrössern Sie unter «Angaben der Gemeinschaft» den Wertquoten-Nenner und tragen Sie ' +
	'alle Stammquoten neu ein, etwa 123,5 von 1000 als 1235 von 10 000. ' +
	'Bei einer Mehrhausanlage rechnen Sie die ganze Anlage um.';

/**
 * Wahr für eine positive Zahl mit Nachkommastellen: nur dann passt der Weg
 * über den Nenner. Bei Text, Leerem oder einer negativen Zahl nicht.
 */
export function hatNachkommastellen(wert: number): boolean {
	return Number.isFinite(wert) && wert > 0 && !Number.isInteger(wert);
}

/**
 * Eine Quote aus einer Eingabe, für die Prüfung danach (Ä-10).
 *
 * **Das Komma wird nur als Nachkommastelle gelesen, wenn eine herauskommt.**
 * «123,5» ergibt 123.5, damit die Absage den Weg nennt; «500,0» ergibt 500.
 * «1,000» sieht aus wie
 * ein Tausendertrenner und bleibt NaN, wie vorher: Als Punkt gelesen wäre es
 * still die Quote 1 (Codeprüfung 18.10.2026). Gerundet wird nie; was nicht
 * ganzzahlig ist, weist der Aufrufer ab.
 */
export function quoteAusEingabe(roh: string): number {
	const text = roh.trim();
	if (text === '') return Number.NaN;
	if (!text.includes(',')) return Number(text);
	if (/^-?\d+,\d{3}$/.test(text)) return Number.NaN;
	// «500,0» und «500,» sind ganze Zahlen; «Liste einfügen» nahm sie immer an.
	if (/^-?\d+,0*$/.test(text)) return Number(text.slice(0, text.indexOf(',')));
	const zahl = Number(text.replace(',', '.'));
	// Auch ein negativer Bruchteil geht durch, damit die Absage danach stimmt.
	return Number.isFinite(zahl) && !Number.isInteger(zahl) ? zahl : Number.NaN;
}

/** Erlaubte Form eines Schlüssels: kurz, kleingeschrieben, ohne Leerzeichen. */
const SCHLUESSEL_MUSTER = /^[a-z][a-z0-9_]{1,29}$/;

export interface QuotenartEingabe {
	stwegId: Id;
	key: string;
	name: string;
	denominator: number;
	isPrimary: boolean;
	sortOrder: number;
}

export function pruefeQuotenart(eingabe: QuotenartEingabe): QuotenartEingabe {
	const key = eingabe.key?.trim().toLowerCase() ?? '';
	if (!SCHLUESSEL_MUSTER.test(key)) {
		throw new FachlicherFehler(
			'schluessel_ungueltig',
			'Der Schlüssel besteht aus Kleinbuchstaben, Ziffern und Unterstrichen und beginnt mit einem Buchstaben.',
			'key'
		);
	}

	const name = eingabe.name?.trim() ?? '';
	if (zeichenzahl(name) < 2) {
		throw new FachlicherFehler('name_zu_kurz', 'Die Bezeichnung der Quotenart fehlt.', 'name');
	}

	if (!Number.isInteger(eingabe.denominator)) {
		throw new FachlicherFehler(
			'nenner_nicht_ganzzahlig',
			'Der Nenner muss eine ganze Zahl sein.',
			'denominator'
		);
	}
	if (eingabe.denominator <= 0) {
		// Anders als bei der Gemeinschaft gibt es hier keine blosse Klammer: Eine
		// Quotenart ohne Nenner hätte nichts, wogegen sie prüfen könnte.
		throw new FachlicherFehler(
			'nenner_nicht_positiv',
			'Der Nenner einer Quotenart muss grösser als null sein.',
			'denominator'
		);
	}

	// Die Stammquote trägt einen festen Schlüssel. Sonst hiesse sie in einer
	// Gemeinschaft «stamm» und in der nächsten «wq», und die Auszählung fände sie
	// nicht mehr.
	if (eingabe.isPrimary && key !== STAMMQUOTE) {
		throw new FachlicherFehler(
			'stammquote_schluessel',
			`Die Stammquote trägt zwingend den Schlüssel «${STAMMQUOTE}».`,
			'key'
		);
	}
	if (!eingabe.isPrimary && key === STAMMQUOTE) {
		throw new FachlicherFehler(
			'stammquote_schluessel',
			`Der Schlüssel «${STAMMQUOTE}» ist der Stammquote vorbehalten.`,
			'key'
		);
	}

	return { ...eingabe, key, name };
}

/**
 * Darf dieser Verteiler weg — und was verschwindet mit ihm?
 *
 * **Warum es die Prüfung überhaupt gibt** (Auftraggeber, 11.08.2026): «Ich habe vorhin
 * einen angeklickt und den kann ich nicht wieder entfernen.» Ein Verteiler ist
 * mit drei Feldern angelegt; ohne Gegenstück bleibt ein Vertipper für immer in
 * der Tabelle stehen und verlangt bei jeder Einheit eine Spalte mehr.
 *
 * Zwei Regeln, beide aus dem Datenmodell:
 *
 * 1. **Die Stammquote bleibt.** Sie wird nicht hier geführt, sondern vom Nenner
 *    der Gemeinschaft (`migrations/005_einheiten.sql`, Auslöser
 *    `stweg_stammquote`); jede Einheit braucht sie, und die Auszählung nach
 *    Wertquoten verlässt sich auf sie.
 * 2. **Erfasste Werte werden gezählt, nicht verschwiegen.** `unit_quota` hängt
 *    mit `ON DELETE RESTRICT` daran — die Datenbank liesse das Löschen gar
 *    nicht zu. Statt diese Schranke als 500er durchzureichen, nennt die
 *    Rückfrage die Zahl (docs/gestaltung.md, «Löschen … fragt mit Zahlen»).
 */
export function pruefeVerteilerLoeschen(
	art: { name: string; isPrimary: boolean },
	einheitenMitWert: number,
	bestaetigt: boolean
): { rueckfrage: { betroffen: number } | null } {
	if (art.isPrimary) {
		throw new FachlicherFehler(
			'stammquote_bleibt',
			'Die Stammquote lässt sich nicht entfernen — sie trägt das Stimmrecht. ' +
				'Den Nenner ändern Sie bei den Angaben der Gemeinschaft.',
			'artId'
		);
	}

	if (einheitenMitWert > 0 && !bestaetigt) {
		return { rueckfrage: { betroffen: einheitenMitWert } };
	}

	return { rueckfrage: null };
}

// ── Einheiten ───────────────────────────────────────────────────────────────

export interface EinheitEingabe {
	stwegId: Id;
	kind: UnitKind;
	label: string;
	/**
	 * Werte je Quotenart-Schlüssel. Ein fehlender Schlüssel bedeutet: an diesem
	 * Verteiler nicht beteiligt — etwa eine Erdgeschosswohnung am Aufzug. Das ist
	 * ausdrücklich etwas anderes als der Wert null, der eine Beteiligung mit
	 * Anteil null wäre.
	 */
	quotas: Record<string, number>;
	/**
	 * Nur bei der Zählweise «je Einheit» wirksam und vor allem für Nebenobjekte
	 * gedacht: ob die Einheit eine eigene Kopfstimme trägt. Auf die Zählung nach
	 * Wertquoten hat das nie eine Wirkung.
	 */
	countsAsHead: boolean;
	/**
	 * Zimmerzahl, Fläche und Lage — eigene Angaben statt eines Klumpens in der
	 * Bezeichnung (Bedienbarkeitsprüfung 05.09.2026, Befund 26).
	 *
	 * **Warum sie hierher gehören.** Ohne eigene Felder schreibt der Verwalter
	 * «3.5 Zi. Wohnung, 87 m², EG links» in die Bezeichnung, weil es der einzige
	 * Ort ist. Danach steht dieser Satz überall, wo die Einheit genannt wird: in
	 * der Auswahl beim Ausstand, auf der Zugangskarte, im Protokoll.
	 *
	 * **Und warum sie nirgends mitgerechnet werden.** Die Fläche ist **kein**
	 * Verteiler. Wer nach Fläche verteilen will, legt eine Quotenart an; das ist
	 * eine Entscheidung der Gemeinschaft und steht im Reglement. Diese Angaben
	 * beschreiben die Einheit, sie gewichten sie nicht.
	 *
	 * Alle drei sind freiwillig: `null` heisst «nicht erfasst», nicht «keine».
	 */
	zimmer?: number | null;
	flaeche?: number | null;
	lage?: string | null;
}

export interface Einheit extends EinheitEingabe {
	id: Id;
}

/** Was die Anwendung als Zimmerzahl und Fläche noch für glaubhaft hält. */
export const ZIMMER_HOECHSTENS = 30;
export const FLAECHE_HOECHSTENS = 10000;
/** Wie viele Zeilen die Sammeleingabe auf einmal entgegennimmt. */
export const ZEILEN_HOECHSTENS = 200;

/**
 * Prüft eine Einheit gegen die Quotenarten ihrer Gemeinschaft.
 *
 * Die Arten werden mitgegeben statt nachgeschlagen: Der Kern kennt keine
 * Datenbank, und eine Prüfung, die stillschweigend eine unbekannte Art annimmt,
 * liesse Tippfehler im Schlüssel durchgehen — die Einheit fehlte dann bei der
 * Saldoprüfung dieser Art, ohne dass es auffiele.
 */
export function pruefeEinheit(eingabe: EinheitEingabe, arten: QuotenartEingabe[]): EinheitEingabe {
	const label = eingabe.label?.trim() ?? '';
	if (zeichenzahl(label) < 1) {
		throw new FachlicherFehler('label_fehlt', 'Die Bezeichnung der Einheit fehlt.', 'label');
	}
	if (zeichenzahl(label) > 100) {
		throw new FachlicherFehler(
			'label_zu_lang',
			'Die Bezeichnung ist länger als 100 Zeichen.',
			'label'
		);
	}

	if (!EINHEITSARTEN.includes(eingabe.kind)) {
		throw new FachlicherFehler('art_unbekannt', `Unbekannte Art: ${eingabe.kind}.`, 'kind');
	}

	const bekannt = new Set(arten.map((a) => a.key));
	const quotas: Record<string, number> = {};

	for (const [schluessel, wert] of Object.entries(eingabe.quotas)) {
		if (!bekannt.has(schluessel)) {
			throw new FachlicherFehler(
				'quotenart_unbekannt',
				`Die Gemeinschaft kennt keine Quotenart «${schluessel}».`,
				'quotas'
			);
		}
		if (!Number.isInteger(wert)) {
			// Rundungsfehler summieren sich in der Auszählung zu einem falschen
			// Beschluss (AD-12).
			throw new FachlicherFehler(
				'quote_nicht_ganzzahlig',
				`Die Quote «${schluessel}» muss eine ganze Zahl in der kleinsten Einheit des Nenners sein.` +
					(schluessel === STAMMQUOTE && hatNachkommastellen(wert) ? ` ${WEG_GROESSERER_NENNER}` : ''),
				'quotas'
			);
		}
		if (wert < 0) {
			throw new FachlicherFehler(
				'quote_negativ',
				`Die Quote «${schluessel}» kann nicht negativ sein.`,
				'quotas'
			);
		}
		quotas[schluessel] = wert;
	}

	// Eine Einheit ohne Stammquote gäbe es im Grundbuch nicht. Ohne diese Regel
	// verschwände sie stillschweigend aus jeder Zählung nach Wertquoten.
	if (arten.some((a) => a.isPrimary) && !(STAMMQUOTE in quotas)) {
		throw new FachlicherFehler(
			'stammquote_fehlt',
			'Jede Einheit braucht eine Stammquote.',
			'quotas'
		);
	}

	/*
	 * **Die Schranken hier UND in der Datenbank** (Befund 26, 07.09.2026). Die
	 * Datenbank hält sie als CHECK; sie dort allein zu lassen hiesse, dem
	 * Verwalter statt eines Satzes den Schrankenfehler zu zeigen — «Diese
	 * Eingabe hat die Datenbank abgewiesen» sagt ihm nicht, dass er ein Komma
	 * vergessen hat.
	 *
	 * Die Obergrenzen sind Tippfehlerfänger, keine Fachregeln: «870» statt «87»
	 * fiele sonst erst auf, wenn jemand die Flächen summiert.
	 */
	/*
	 * **Drei Absagen statt einer** (Code-Review 07.09.2026). Die erste Fassung
	 * warf alles in einen Satz: «muss zwischen 0 und 30 liegen» — obwohl 0
	 * abgewiesen wird, und obwohl derselbe Satz auch dann kam, wenn gar keine
	 * Zahl dastand. «87 m²» in einem Zahlenfeld ist kein Wert ausserhalb der
	 * Spanne, sondern gar keiner, und der Verwalter sucht sonst den Fehler an
	 * der falschen Stelle.
	 *
	 * **Und die Nachkommastellen gehören dazu.** Die Datenbank hält eine Stelle
	 * für Zimmer und zwei für die Fläche; ohne Prüfung rundete sie still, und
	 * die Antwort des Schreibwegs nennte 87.456, während 87.46 gespeichert ist.
	 */
	const zahlPruefen = (
		wert: number | null | undefined,
		was: string,
		feld: string,
		hoechstens: number,
		stellen: number
	): number | null => {
		const zahl = wert ?? null;
		if (zahl === null) return null;
		if (!Number.isFinite(zahl)) {
			throw new FachlicherFehler(`${feld}_keine_zahl`, `${was} ist keine Zahl.`, feld);
		}
		if (zahl <= 0 || zahl > hoechstens) {
			throw new FachlicherFehler(
				`${feld}_unglaubhaft`,
				`${was} muss grösser als 0 und höchstens ${hoechstens} sein.`,
				feld
			);
		}
		const gerundet = Math.round(zahl * 10 ** stellen) / 10 ** stellen;
		if (gerundet !== zahl) {
			throw new FachlicherFehler(
				`${feld}_zu_genau`,
				stellen === 1
					? `${was} nimmt höchstens eine Nachkommastelle: «3.5», nicht «3.55».`
					: `${was} nimmt höchstens zwei Nachkommastellen.`,
				feld
			);
		}
		return zahl;
	};

	const zimmer = zahlPruefen(eingabe.zimmer, 'Die Zimmerzahl', 'zimmer', ZIMMER_HOECHSTENS, 1);
	const flaeche = zahlPruefen(eingabe.flaeche, 'Die Fläche', 'flaeche', FLAECHE_HOECHSTENS, 2);
	const lage = eingabe.lage?.trim() || null;
	if (lage !== null && zeichenzahl(lage) > 60) {
		throw new FachlicherFehler('lage_zu_lang', 'Die Lage ist länger als 60 Zeichen.', 'lage');
	}

	return { ...eingabe, label, quotas, zimmer, flaeche, lage };
}

export function legeEinheitAn(
	id: Id,
	eingabe: EinheitEingabe,
	arten: QuotenartEingabe[]
): Uebergang<Einheit> {
	const geprueft = pruefeEinheit(eingabe, arten);
	const einheit: Einheit = { ...geprueft, id };

	return uebergang(
		einheit,
		ereignis(
			EREIGNISARTEN.einheitAngelegt,
			{ art: 'unit', id },
			{
				label: geprueft.label,
				art: geprueft.kind,
				quoten: geprueft.quotas,
				stweg: geprueft.stwegId
			}
		)
	);
}

export function aendereEinheit(
	bisher: Einheit,
	eingabe: EinheitEingabe,
	arten: QuotenartEingabe[]
): Uebergang<Einheit> {
	const geprueft = pruefeEinheit(eingabe, arten);
	const geaendert: Einheit = { ...bisher, ...geprueft };

	const felder: Record<string, { vorher: unknown; nachher: unknown }> = {};
	/*
	 * **Auch die drei Merkmale** (Code-Review 07.09.2026). Sie wurden geschrieben
	 * und tauchten im Verlauf nicht auf: Wer aus 87 m² versehentlich 870 macht,
	 * ändert die Daten, und nichts sagt später, wer wann was. Dieselbe
	 * Begründung wie bei den Quoten darunter.
	 */
	for (const feld of ['label', 'kind', 'countsAsHead', 'zimmer', 'flaeche', 'lage'] as const) {
		if (bisher[feld] !== geaendert[feld]) {
			felder[feld] = { vorher: bisher[feld], nachher: geaendert[feld] };
		}
	}

	// Quoten einzeln vergleichen: «die Quoten haben sich geändert» wäre im
	// Streitfall wertlos. Welche, von wie viel auf wie viel — das ist die Frage.
	for (const schluessel of new Set([
		...Object.keys(bisher.quotas),
		...Object.keys(geaendert.quotas)
	])) {
		const vorher = bisher.quotas[schluessel];
		const nachher = geaendert.quotas[schluessel];
		if (vorher !== nachher) {
			felder[`quote.${schluessel}`] = { vorher: vorher ?? null, nachher: nachher ?? null };
		}
	}

	if (Object.keys(felder).length === 0) return uebergang(geaendert);

	return uebergang(
		geaendert,
		ereignis(EREIGNISARTEN.einheitGeaendert, { art: 'unit', id: bisher.id }, { felder })
	);
}

// ── Saldoprüfung ────────────────────────────────────────────────────────────

/** Eine Ebene der Anlage, wie die Prüfung sie braucht. */
export interface Ebene {
	id: Id;
	name: string;
	parentStwegId: Id | null;
	/** Quotenarten dieser Ebene. Eine Ebene ohne Arten ist eine blosse Klammer. */
	quotenarten: Pick<QuotaKind, 'key' | 'name' | 'denominator' | 'isPrimary'>[];
}

export interface SaldoZeile {
	stwegId: Id;
	stwegName: string;
	quotenart: string;
	quotenartName: string;
	istStammquote: boolean;
	/** Nenner dieser Art auf dieser Ebene, das Soll. */
	soll: number;
	/** Summe der unmittelbar zugeordneten Einheiten. */
	summeEinheiten: number;
	/** Summe der Nenner derselben Art in den unmittelbaren Untergemeinschaften. */
	summeUntergemeinschaften: number;
	/** Soll minus beide Summen. Null heisst: geht auf. */
	abweichung: number;
	anzahlEinheiten: number;
}

export interface SaldoErgebnis {
	zeilen: SaldoZeile[];
	/** Wahr, wenn jede Quotenart jeder Ebene aufgeht. */
	stimmig: boolean;
	/** Wahr, wenn wenigstens jede Stammquote aufgeht — das Mindeste vor einer Abstimmung. */
	stammquotenStimmig: boolean;
}

/**
 * Prüft je Ebene und Quotenart: Soll minus Summe der Untergemeinschaften minus
 * Summe der eigenen Einheiten.
 *
 * Eine Ebene ohne Quotenarten ist eine blosse Klammer und wird übersprungen —
 * sie als Sollebene zu werten ergäbe eine Abweichung, die es nicht gibt.
 *
 * Der Beitrag einer Untergemeinschaft zählt nur bei **gleichem Schlüssel**: Führt
 * Haus A einen Aufzugsverteiler und die Dachgemeinschaft nicht, hat er dort oben
 * kein Gegenstück und darf die Stammquote nicht verfälschen.
 *
 * Nebenobjekte zählen bei jeder Quotenart mit. Ihre Kennzeichnung wirkt nur auf
 * die Kopfzählung; würde sie hier durchschlagen, ergäbe die Summe nie den Nenner.
 */
export function pruefeSalden(
	ebenen: Ebene[],
	einheiten: Pick<Einheit, 'stwegId' | 'quotas'>[]
): SaldoErgebnis {
	const einheitenJeEbene = new Map<Id, { summen: Map<string, number>; anzahl: number }>();
	for (const e of einheiten) {
		const bisher = einheitenJeEbene.get(e.stwegId) ?? { summen: new Map(), anzahl: 0 };
		for (const [schluessel, wert] of Object.entries(e.quotas)) {
			bisher.summen.set(schluessel, (bisher.summen.get(schluessel) ?? 0) + wert);
		}
		bisher.anzahl += 1;
		einheitenJeEbene.set(e.stwegId, bisher);
	}

	const untenJeEbene = new Map<Id, Map<string, number>>();
	for (const ebene of ebenen) {
		if (!ebene.parentStwegId) continue;
		const beimEltern = untenJeEbene.get(ebene.parentStwegId) ?? new Map<string, number>();
		for (const art of ebene.quotenarten) {
			beimEltern.set(art.key, (beimEltern.get(art.key) ?? 0) + art.denominator);
		}
		untenJeEbene.set(ebene.parentStwegId, beimEltern);
	}

	const zeilen: SaldoZeile[] = [];
	for (const ebene of ebenen) {
		const eigene = einheitenJeEbene.get(ebene.id);
		const unten = untenJeEbene.get(ebene.id);

		for (const art of ebene.quotenarten) {
			const summeEinheiten = eigene?.summen.get(art.key) ?? 0;
			const summeUnten = unten?.get(art.key) ?? 0;

			zeilen.push({
				stwegId: ebene.id,
				stwegName: ebene.name,
				quotenart: art.key,
				quotenartName: art.name,
				istStammquote: art.isPrimary,
				soll: art.denominator,
				summeEinheiten,
				summeUntergemeinschaften: summeUnten,
				abweichung: art.denominator - summeUnten - summeEinheiten,
				// Gezählt werden die Einheiten der Ebene, nicht die an dieser Art
				// beteiligten — sonst läse sich «0 Einheiten» bei einem Verteiler, an
				// dem tatsächlich niemand hängt, wie ein leerer Datenbestand.
				anzahlEinheiten: eigene?.anzahl ?? 0
			});
		}
	}

	return {
		zeilen,
		stimmig: zeilen.every((z) => z.abweichung === 0),
		stammquotenStimmig: zeilen.filter((z) => z.istStammquote).every((z) => z.abweichung === 0)
	};
}

/**
 * Verständlicher Satz zu einer Saldozeile.
 *
 * «Abweichung: -2» sagt einer Sitzungsleitung nichts. Der Satz muss benennen,
 * auf welcher Ebene und bei welchem Schlüssel es klemmt und in welche Richtung.
 */
export function saldoText(z: SaldoZeile): string {
	const erfasst = z.summeEinheiten + z.summeUntergemeinschaften;
	const wo = `${z.stwegName}, ${z.quotenartName}`;
	if (z.abweichung === 0) {
		return `${wo}: ${erfasst} von ${z.soll} — geht auf.`;
	}
	const richtung = z.abweichung > 0 ? 'fehlen' : 'zu viel';
	return `${wo}: ${Math.abs(z.abweichung)} ${richtung} (erfasst ${erfasst} von ${z.soll}).`;
}

/**
 * Was an den Stammdaten einer Gemeinschaft noch fehlt — in einem Satz.
 *
 * **Warum das im Kern steht und nicht in der Leiste.** Gemeldet am 12.08.2026:
 * «Bei Eigentümer und Zuordnung und auch Einheiten und Wertquoten mit einem
 * Icon kennzeichnen, wenn die Zuordnungen nicht vollständig ist. Ziel, damit
 * der Nutzer es sofort sieht.» Denselben Satz braucht die Seitenleiste der
 * Gemeinschaft, die Ablaufleiste einer Versammlung und später der Prüfbericht;
 * dreimal gerechnet liefe er auseinander.
 *
 * **Null heisst: nichts zu melden.** Ein Satz «alles in Ordnung» an jeder Zeile
 * wäre Lärm — die Leiste trägt vierzehn Punkte.
 */
export function einheitenluecke(e: {
	einheiten: number;
	stammquotenStimmig: boolean;
	/**
	 * Eine übergeordnete Gemeinschaft ohne eigene Wertquote — die Klammer über
	 * mehreren Häusern. Ohne dieses Wissen mahnte die Leiste bei ihr dauerhaft
	 * «noch keine Einheit erfasst», auch wenn beide Häuser darunter sauber auf
	 * 1000 aufgehen (Prüflauf II, A-20). Ein Warnzeichen, das nie grün wird,
	 * wird bald übersehen — und dann auch dort, wo es etwas bedeutet.
	 */
	ohneEigeneQuote?: boolean;
}): string | null {
	if (e.ohneEigeneQuote) return null;
	if (e.einheiten === 0) return 'noch keine Einheit erfasst';
	if (!e.stammquotenStimmig) return 'Wertquoten gehen nicht auf';
	return null;
}

/**
 * Führt diese Gemeinschaft eigene Anteile, oder ist sie die Klammer darüber?
 *
 * **Der Nenner ist das Merkmal, und er ist es an einer Stelle.** Vorher stand
 * `quotaDenominator === 0` an jeder Seite neu; wer die Bedeutung wissen wollte,
 * musste sie aus dem Vergleich erraten. Sie steht in
 * `domain/gemeinschaft.ts`: Eine Gemeinschaft ohne eigenen Nenner trägt zu
 * keinem Saldo bei, weder nach oben noch für sich.
 */
export function ohneEigeneQuote(g: { quotaDenominator: number }): boolean {
	return g.quotaDenominator === 0;
}

/**
 * Dasselbe für die Zuordnung: Wie viele Einheiten haben keinen Eigentümer?
 *
 * Sie fehlen in **jeder** Zählung, und die Summe oben sähe trotzdem plausibel
 * aus — das ist der Grund, warum die Lücke von aussen sichtbar sein muss.
 */
export function zuordnungsluecke(e: {
	einheiten: number;
	ohneEigentuemer: number;
}): string | null {
	if (e.einheiten === 0) return null; // Ohne Einheiten gibt es nichts zuzuordnen.
	if (e.ohneEigentuemer === 1) return '1 Einheit ohne Eigentümer';
	if (e.ohneEigentuemer > 1) return `${e.ohneEigentuemer} Einheiten ohne Eigentümer`;
	return null;
}

// ── Mehrere Einheiten auf einmal ────────────────────────────────────────────

/**
 * Eine Zeile je Einheit, aus einem Textfeld gelesen.
 *
 * **Der Anlass** (Bedienbarkeitsprüfung 05.09.2026, Befund 29): «Fünf Einheiten
 * sind fünfmal dasselbe Formular; ‹Aus Datei übernehmen› verlangt je einen
 * Eigentümer und hilft hier nicht.»
 *
 * Den Dateiweg gibt es, und er ist der richtige für eine gewachsene Liste aus
 * dem Grundbuchauszug. Er verlangt aber je Zeile einen Eigentümer — beim
 * Anlegen einer Gemeinschaft sind die oft noch nicht erfasst, und dann bleibt
 * nur das Formular, fünfmal. Dieser Weg liegt dazwischen: abtippen, aber
 * einmal statt fünfmal.
 *
 * **Warum Strichpunkte und keine Kommas.** «3.5 Zi. Wohnung, links» ist eine
 * Bezeichnung, die jemand so schreibt; ein Komma als Trenner zerschnitte sie.
 * Der Strichpunkt kommt in keiner Bezeichnung vor, die wir gesehen haben.
 *
 * **Warum die Zeilennummer in jede Absage gehört.** Bei zwanzig Zeilen ist «Die
 * Stammquote fehlt» keine Auskunft, sondern eine Suchaufgabe.
 */
export interface Zeilenfehler {
	zeile: number;
	text: string;
	grund: string;
}

export interface Zeilenbefund {
	einheiten: EinheitEingabe[];
	fehler: Zeilenfehler[];
}

/**
 * Liest «Bezeichnung; Stammquote; Zimmer; Fläche; Lage» je Zeile.
 *
 * Leerzeilen und Zeilen, die mit `#` beginnen, werden übergangen — wer aus
 * einer Tabelle kopiert, hat Überschriften dabei.
 *
 * **Alle Zeilen werden gelesen, auch nach dem ersten Fehler.** Wer zwanzig
 * Zeilen einfügt und drei Tippfehler hat, will sie in einem Durchgang sehen und
 * nicht dreimal auf «Anlegen» drücken.
 */
export function leseEinheitenzeilen(roh: string, stwegId: Id): Zeilenbefund {
	const einheiten: EinheitEingabe[] = [];
	const fehler: Zeilenfehler[] = [];

	const zeilen = (roh ?? '').split(/\r?\n/);
	/*
	 * **Ein Deckel, und er sagt seinen Grund** (Code-Review 07.09.2026). Ohne
	 * ihn ergab ein Einfügen von einem halben Megabyte rund zwanzigtausend
	 * Zeilen, und die Anfrage lief in den Zeitablauf. Zweihundert reichen für
	 * jede Liegenschaft, die es gibt; wer mehr hat, nimmt den Dateiweg.
	 */
	if (zeilen.length > ZEILEN_HOECHSTENS) {
		return {
			einheiten: [],
			fehler: [
				{
					zeile: ZEILEN_HOECHSTENS + 1,
					text: '',
					grund:
						`Mehr als ${ZEILEN_HOECHSTENS} Zeilen. So viele auf einmal nimmt dieser Weg nicht ` +
						'entgegen — für eine Liste dieser Grösse gibt es die Übernahme aus einer Datei.'
				}
			]
		};
	}
	for (const [i, rohzeile] of zeilen.entries()) {
		const zeile = rohzeile.trim();
		if (zeile === '' || zeile.startsWith('#')) continue;

		const nummer = i + 1;
		/*
		 * **Auch Tabulatoren trennen** (Code-Review 07.09.2026). Der Hilfetext
		 * begründet sich mit «wer aus einer Tabelle kopiert» — und wer das tut,
		 * bekommt aus Excel, Numbers und Google Tabellen Tabulatoren, keine
		 * Strichpunkte. Ohne diese Zeile wurde jede der zwanzig Zeilen mit «Die
		 * Stammquote fehlt» abgewiesen, und der Grund war nicht zu sehen.
		 *
		 * **Und ein leeres Endstück fällt weg.** Ein Zeilenabschluss mit
		 * Strichpunkt kommt aus jedem Tabellenexport; er galt als sechste Angabe.
		 */
		const teile = zeile.split(/[;\t]/).map((t) => t.trim());
		while (teile.length > 1 && teile[teile.length - 1] === '') teile.pop();
		const [label, quote, zimmer, flaeche, lage] = teile;

		if (teile.length > 5) {
			fehler.push({
				zeile: nummer,
				text: zeile,
				grund: 'Mehr als fünf Angaben. Erwartet: Bezeichnung; Stammquote; Zimmer; Fläche; Lage.'
			});
			continue;
		}
		if (!label) {
			fehler.push({ zeile: nummer, text: zeile, grund: 'Die Bezeichnung fehlt.' });
			continue;
		}

		const zahl = (wert: string | undefined, was: string): number | null | undefined => {
			if (wert === undefined || wert === '') return null;
			const n = Number(wert.replace(',', '.'));
			if (!Number.isFinite(n)) {
				fehler.push({ zeile: nummer, text: zeile, grund: `${was} ist keine Zahl: «${wert}».` });
				return undefined;
			}
			return n;
		};

		const stamm =
			quote === undefined || quote === '' ? null : quoteAusEingabe(quote);
		if (stamm !== null && Number.isNaN(stamm)) {
			fehler.push({ zeile: nummer, text: zeile, grund: `Die Stammquote ist keine Zahl: «${quote}».` });
			continue;
		}
		if (stamm === null) {
			fehler.push({
				zeile: nummer,
				text: zeile,
				grund: 'Die Stammquote fehlt. Ohne sie fiele die Einheit aus jeder Zählung nach Wertquoten.'
			});
			continue;
		}
		if (!Number.isInteger(stamm)) {
			fehler.push({
				zeile: nummer,
				text: zeile,
				grund:
					'Die Stammquote muss eine ganze Zahl sein — der Nenner bestimmt die Einheit.' +
					(hatNachkommastellen(stamm) ? ` ${WEG_GROESSERER_NENNER}` : '')
			});
			continue;
		}

		const z = zahl(zimmer, 'Die Zimmerzahl');
		if (z === undefined) continue;
		const f = zahl(flaeche, 'Die Fläche');
		if (f === undefined) continue;

		einheiten.push({
			stwegId,
			/*
			 * **Immer «Einheit», nie «Nebenobjekt».** Die Art entscheidet über die
			 * Kopfstimme; sie aus einem Wort in der Bezeichnung zu erraten
			 * («Einstellplatz») wäre eine Vermutung an einer Stelle, an der ein
			 * Irrtum eine Stimme verschiebt. Wer Nebenobjekte erfasst, stellt sie
			 * in der Tabelle danach um — dort steht die Art in einer eigenen Spalte.
			 */
			kind: 'unit',
			label,
			quotas: { [STAMMQUOTE]: stamm },
			countsAsHead: true,
			zimmer: z,
			flaeche: f,
			lage: lage || null
		});
	}

	return { einheiten, fehler };
}
