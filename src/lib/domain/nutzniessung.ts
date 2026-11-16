/**
 * Nutzniessung an einer Stockwerkeinheit (Story 1.7, FR-4).
 *
 * In Welle 1 ausdrücklich **nur Datenhaltung**: Wer bei einem Traktandum stimmen
 * darf, bestimmt die Sitzungsleitung von Hand. Eine automatische Ableitung wäre
 * hier gefährlich, weil die Regel des Gesetzes eine blosse Auffangregel ist und
 * ein Vertrag sie vollständig verdrängen kann — ohne den Vertrag zu kennen, kann
 * das System nichts entscheiden.
 *
 * **ZGB Art. 712o Abs. 2**: «Ebenso haben sich der Eigentümer und der Nutzniesser
 * eines Stockwerkes über die Ausübung des Stimmrechtes zu verständigen, ansonst
 * der Nutzniesser in allen Fragen der Verwaltung mit Ausnahme der bloss
 * nützlichen oder der Verschönerung und Bequemlichkeit dienenden baulichen
 * Massnahmen als stimmberechtigt gilt.»
 *
 * Zwei Dinge stehen darin, die leicht übersehen werden:
 *
 *   - Die Verständigung geht **vor**. Die Regel danach greift nur, «ansonst».
 *   - Der Vertrag kann das Stimmrecht für **alle** Beschlussarten regeln, auch
 *     für qualifiziertes Mehr und Einstimmigkeit. Die Auffangregel des Gesetzes
 *     teilt nur nach Gegenstand, nicht nach Mehrheitserfordernis.
 */
import type { Id, SnapshotParty } from './types';
import type { Geschaeftsart } from './regelwerk';
import { FachlicherFehler } from './gemeinschaft';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';
import { zeichenzahl } from './zeichenzahl';
import { istKalendertag } from './datum';

/**
 * Wer nach der gesetzlichen Auffangregel stimmt, wenn keine Vereinbarung besteht.
 *
 * Die Einteilung folgt dem Gegenstand des Beschlusses, nicht dem
 * Mehrheitserfordernis. Sie dient als **Hinweis** an die Sitzungsleitung; die
 * Zuordnung trifft diese selbst und hält sie am Traktandum fest.
 *
 * **`nutzungsaenderung` und `grundordnung` sind keine Verwaltung** (27.09.2026).
 * Nach Rz. 46 ad Art. 712o sind Verfügung und Zweckänderung nicht von Abs. 2
 * erfasst; ohne Absprache stimmt dort der Eigentümer. Beide Werte tragen die
 * Bezeichnung ihrer Geschäftsart.
 */
export type Beschlussgegenstand =
	| 'verwaltung'
	| 'notwendige_bauliche_massnahme'
	| 'nuetzliche_bauliche_massnahme'
	| 'verschoenernde_bauliche_massnahme'
	| 'nutzungsaenderung'
	| 'grundordnung';

export type Stimmberechtigt = 'nutzniesser' | 'eigentuemer';

/**
 * Gesetzliche Auffangregel nach ZGB Art. 712o Abs. 2.
 *
 * Gilt nur, wo keine Vereinbarung besteht. Notwendige bauliche Massnahmen sind
 * Verwaltung im weiteren Sinn und fallen deshalb nicht unter die Ausnahme —
 * ausgenommen sind ausdrücklich nur die «bloss nützlichen» und die «der
 * Verschönerung und Bequemlichkeit dienenden».
 *
 * **Verfügung und Zweckänderung sind nicht einmal Verwaltung** (Rz. 46 ad
 * Art. 712o). Der Nutzniesser darf an der wirtschaftlichen Bestimmung der
 * Sache keine Veränderung vornehmen, die dem Eigentümer zu erheblichem
 * Nachteil gereicht (ZGB Art. 769 Abs. 1), und die Sache weder umgestalten
 * noch wesentlich verändern (Abs. 2); Wortlaut nach F4a, S17. Ohne Absprache
 * stimmt dort der Eigentümer.
 */
export function auffangregelStimmrecht(gegenstand: Beschlussgegenstand): Stimmberechtigt {
	switch (gegenstand) {
		case 'nuetzliche_bauliche_massnahme':
		case 'verschoenernde_bauliche_massnahme':
		case 'nutzungsaenderung':
		case 'grundordnung':
			return 'eigentuemer';
		case 'verwaltung':
		case 'notwendige_bauliche_massnahme':
			return 'nutzniesser';
	}
}

/**
 * Der Beschlussgegenstand aus der **Geschäftsart** des Entscheidbaums (FR-22).
 *
 * **Warum aus der Geschäftsart und nicht aus dem Mehrheitserfordernis.** Die
 * Auffangregel teilt nach dem *Gegenstand* des Beschlusses, nicht nach der
 * nötigen Mehrheit. Beides fällt oft zusammen — nützliche Massnahmen brauchen
 * das qualifizierte Mehr —, aber eben nicht immer: Ein Reglementsbeschluss
 * verlangt auch ein qualifiziertes Mehr und ist keine bauliche Massnahme.
 * Wer am Erfordernistyp anknüpfte, gäbe dem Eigentümer eine Stimme, die dem
 * Nutzniesser zusteht.
 */
export function gegenstandAus(
	geschaeftsart: Geschaeftsart | null | undefined,
	knotenId?: string | null
): Beschlussgegenstand | null {
	/*
	 * **Je Knoten, wo die Geschäftsart zu grob ist** (27.09.2026). Unter
	 * «Nutzungs- und Zweckänderung» steht neben der Zweckänderung auch die
	 * Benutzungsweise nach Art. 647b Abs. 1, eine wichtigere
	 * Verwaltungshandlung: Dort stimmt ohne Absprache der Nutzniesser (Art. 712o
	 * Abs. 2). Der Grenzfall hat kein Erfordernis, das eine Zuordnung trüge; dort
	 * entscheidet die Leitung.
	 */
	if (knotenId === 'k-benutzungsweise') return 'verwaltung';
	if (knotenId === 'k-grenzfall-nutzung') return null;
	switch (geschaeftsart) {
		case 'baulich_notwendig':
			return 'notwendige_bauliche_massnahme';
		case 'baulich_nuetzlich':
			return 'nuetzliche_bauliche_massnahme';
		case 'baulich_luxurioes':
			return 'verschoenernde_bauliche_massnahme';
		case 'nutzungsaenderung':
			return 'nutzungsaenderung';
		case 'grundordnung':
			return 'grundordnung';
		case undefined:
		case null:
			// Kommt vor: Ein Erfordernis darf auch «ohne Herleitung» gesetzt werden,
			// dann kennt niemand die Geschäftsart. Geraten wird hier nicht.
			return null;
		default:
			// Alles Übrige ist Verwaltung im weiteren Sinn. Die Ausnahme des
			// Gesetzes nennt ausdrücklich nur die beiden baulichen Fälle, und
			// Verfügung und Zweckänderung sind nach Rz. 46 ad Art. 712o nicht
			// einmal Verwaltung — für sie stehen die beiden Fälle darüber.
			return 'verwaltung';
	}
}

export interface Stimmrechtsbefund {
	/** Wer ausübt — oder `unbestimmt`, wo es die Anwendung nicht entscheiden darf. */
	wer: Stimmberechtigt | 'unbestimmt';
	/** Ein Satz für die Sitzungsleitung: wer, und woraus es folgt. */
	satz: string;
	/** Ob die Sitzungsleitung es selbst bestimmen muss. */
	vonHand: boolean;
}

/**
 * Wer bei **diesem** Traktandum für eine mit Nutzniessung belastete Einheit
 * stimmt (FR-22, letzter Punkt).
 *
 * Drei Fälle, und nur einer davon ist automatisch:
 *
 *   1. **Es besteht eine Vereinbarung.** Dann verdrängt sie die Auffangregel
 *      vollständig — auch für qualifiziertes Mehr und Einstimmigkeit. Was sie
 *      sagt, weiss das Werkzeug nicht; es zeigt ihren Wortlaut und überlässt die
 *      Zuordnung der Sitzungsleitung. **Hier zu raten wäre der schlimmste Fehler
 *      dieses Bausteins:** Er beträfe die Stimmberechtigung, und die ist der
 *      erste Angriffspunkt einer Anfechtung.
 *   2. **Keine Vereinbarung, Geschäftsart bekannt.** Dann greift die Auffangregel
 *      von ZGB Art. 712o Abs. 2, und die Zuordnung ergibt sich aus dem
 *      Entscheidbaum — automatisch, mit Begründung.
 *   3. **Keine Vereinbarung, Geschäftsart unbekannt.** Kommt vor, wenn das
 *      Erfordernis ohne Herleitung gesetzt wurde. Dann sagt das Werkzeug, dass
 *      es die Frage nicht beantworten kann, statt eine Antwort zu erfinden.
 */
export function stimmrechtBeiNutzniessung(
	nutzniessung: {
		holderName: string;
		hasAgreement: boolean;
		agreementSummary?: string | null;
		/**
		 * Ob der Vertrag der Bewirtschaftung vorliegt — als **Vermerk**.
		 *
		 * Er liegt ohnehin vor der Versammlung dort: Er ist die Grundlage der
		 * Erfassung. Ihn ein zweites Mal in die Anwendung zu heben, ist eine
		 * Bequemlichkeit, kein Nachweis. Dieselbe Ordnung wie bei der Vollmacht,
		 * wo «Original vorgelegt» vollwertig ist und die Datei ein Nachtrag.
		 */
		contractOnFile?: boolean;
		/** Ob zusätzlich eine Kopie hinterlegt ist. Freiwillig. */
		hasDocument?: boolean;
	},
	geschaeftsart: Geschaeftsart | null | undefined,
	knotenId?: string | null
): Stimmrechtsbefund {
	const befund = stimmberechtigtBeiNutzniessung(nutzniessung, geschaeftsart, knotenId);
	const zusatz = zustimmungNebenDerStimme(knotenId, nutzniessung.holderName);
	return zusatz ? { ...befund, satz: `${befund.satz} ${zusatz}` } : befund;
}

/** Die Karte der Wertquotenänderung (ZGB Art. 712e Abs. 2). */
const WERTQUOTEN_AENDERN_KNOTEN = 'k-wertquoten-aendern';

/**
 * Wo es neben der Stimme die Zustimmung der nutzniessenden Person braucht
 * (Produktentscheid 03.11.2026, fachgeprüft in zwei Runden:
 * `quellen/pruefung/berichte/2026-11-03-votum-f1-fachfragen-fach.md` und
 * `…-fach-runde2.md`, Frage 2 und 2.3).
 *
 *   - **Wertquoten** (ZGB Art. 712e Abs. 2): Ändert sich die Quote der
 *     belasteten Einheit, braucht das Grundbuch die schriftliche Zustimmung
 *     des Nutzniessers (SVIT-Kommentar 2023, Art. 712e Rz. 80, 88).
 *   - **Aufhebung** (Art. 712f): ratsam, weil sie nicht gegen den Willen der
 *     dinglich Berechtigten geschehen soll (Rz. 62 ad Art. 712f); nötig, wenn
 *     die Nutzniessung nicht ohne Nachteil auf das ganze Grundstück übergehen
 *     kann (Art. 712f Abs. 2). Das klärt der Notar.
 *
 * **Keine Stimme im Saal.** Gezählt wird wie ohne den Satz; er gilt deshalb
 * auch neben einer Vereinbarung, die bestimmt, wer stimmt. Am Knoten statt an
 * der Geschäftsart, weil «Grundordnung» auch Verkauf, Sonderrecht und
 * Reglementsbestimmungen umfasst, wo nichts davon gilt.
 */
function zustimmungNebenDerStimme(knotenId: string | null | undefined, name: string): string | null {
	if (knotenId === WERTQUOTEN_AENDERN_KNOTEN) {
		return (
			'Ändert sich die Wertquote dieser Einheit, braucht es für das Grundbuch zusätzlich die ' +
			`schriftliche Zustimmung von ${name}. Für die Abstimmung ändert das nichts.`
		);
	}
	if (knotenId === 'k-aufhebung') {
		return (
			`Holen Sie am sichersten auch die schriftliche Zustimmung von ${name} ein. Nötig ist sie, ` +
			'wenn die Nutzniessung nicht ohne Nachteil auf das ganze Grundstück übergehen kann; das ' +
			'klärt der Notar.'
		);
	}
	return null;
}

/**
 * Wer bei der Genehmigung einer Änderung der Wertquoten ohne Absprache stimmt:
 * nach der Vorgabe von Votum der Eigentümer (Produktentscheid 27.09.2026),
 * geklärt ist das nicht (`quellen` Frage 78: Rz. 45 gegen Rz. 46 ad Art. 712o;
 * Codeprüfung E4, G3; Auftrag «Texte nach 0047», Punkt 9).
 */
function wertquotenOhneAbsprache(name: string): string {
	return (
		`Ohne Absprache stimmt nach der Vorgabe von Votum der **Eigentümer**, nicht ${name}; geklärt ist das ` +
		'bei den Wertquoten nicht. Sicher ist, wenn beide vorher vereinbaren, wer stimmt, oder beide gleich abstimmen.'
	);
}

/** Die Karte zu Reglementsbestimmungen über etwas anderes als Nutzung und Verwaltung. */
const SONDERINHALT_KNOTEN = 'k-reglement-sonderinhalt';

/**
 * Der Satz an `k-reglement-sonderinhalt`: Ob der Nutzniesser über eine solche
 * Bestimmung stimmt, ist nicht geklärt, wie bei den Wertquoten (Fachprüfung
 * «Texte nach 0047», F-6). Endwortlaut T6b der Textrunde zu den Pendenzen nach
 * Regel 43 (`quellen`
 * `pruefung/zu-pruefen-2026-11-14-votum-pendenzen-textrunde-endfassung.md`; R3-F-2:
 * der Beleg am Satz, den er trägt).
 */
function sonderinhaltOhneAbsprache(name: string): string {
	return (
		'Es geht um eine Reglementsbestimmung über etwas anderes als Nutzung und Verwaltung. Der Nutzniesser ' +
		'stimmt in fast allen Fragen der Verwaltung, nicht bei Verfügungen (ZGB Art. 712o Abs. 2; ' +
		'SVIT-Kommentar 2023, Art. 712o Rz. 45 und 46). Ob er auch über eine solche Bestimmung stimmt, ist ' +
		`nicht geklärt. Ohne Absprache stimmt nach der Vorgabe von Votum der **Eigentümer**, nicht ${name}. ` +
		'Sicher ist, wenn beide vorher vereinbaren, wer stimmt, oder beide gleich abstimmen.'
	);
}

/** Wer stimmt, ohne die Zustimmung daneben (`zustimmungNebenDerStimme`). */
function stimmberechtigtBeiNutzniessung(
	nutzniessung: Parameters<typeof stimmrechtBeiNutzniessung>[0],
	geschaeftsart: Geschaeftsart | null | undefined,
	knotenId?: string | null
): Stimmrechtsbefund {
	if (nutzniessung.hasAgreement) {
		return {
			wer: 'unbestimmt',
			vonHand: true,
			satz:
				`Zwischen Eigentümer und ${nutzniessung.holderName} besteht eine Vereinbarung über die ` +
				'Ausübung des Stimmrechts. Sie geht der gesetzlichen Regel vor' +
				(nutzniessung.agreementSummary ? `: «${nutzniessung.agreementSummary}»` : '') +
				'. Bestimmen Sie danach, wer stimmt.' +
				// **Nur wenn zum Vertrag gar nichts vermerkt ist.** Eine Vereinbarung,
				// die die gesetzliche Regel verdrängt, ohne dass irgendwo steht, dass
				// der Vertrag vorliegt, ist im Streitfall schwer zu verteidigen. Der
				// blosse Vermerk genügt dafür — die Kopie ist ein Nachtrag.
				(nutzniessung.contractOnFile === false && nutzniessung.hasDocument !== true
					? ' **Zum Vertrag ist nichts vermerkt** — halten Sie fest, dass er Ihnen vorliegt.'
					: '')
		};
	}

	const gegenstand = gegenstandAus(geschaeftsart, knotenId);
	if (!gegenstand) {
		return {
			wer: 'unbestimmt',
			vonHand: true,
			satz:
				'Zu diesem Traktandum ist die Geschäftsart nicht hinterlegt — das Erfordernis wurde ohne ' +
				'Herleitung gesetzt. Ohne sie lässt sich nicht sagen, ob die Ausnahme von ZGB ' +
				'Art. 712o Abs. 2 greift. Bestimmen Sie, wer stimmt.'
		};
	}

	const wer = auffangregelStimmrecht(gegenstand);
	const wortlaut =
		gegenstand === 'nuetzliche_bauliche_massnahme'
			? 'eine bloss nützliche bauliche Massnahme'
			: gegenstand === 'verschoenernde_bauliche_massnahme'
				? // Im Alltag «luxuriös», im Gesetz «der Verschönerung und Bequemlichkeit
					// dienend» — beide Wörter, damit niemand zwei Kategorien vermutet.
					'eine der Verschönerung oder Bequemlichkeit dienende (luxuriöse) bauliche Massnahme'
				: gegenstand === 'notwendige_bauliche_massnahme'
					? 'eine notwendige bauliche Massnahme und damit Verwaltung'
					: gegenstand === 'nutzungsaenderung'
						? 'eine Zweckänderung'
						: gegenstand === 'grundordnung'
							? 'das Grundstück oder die Grundordnung'
							: 'eine Frage der Verwaltung';

	/*
	 * **Zwei Gegenstände begründen den Eigentümer anders** (27.09.2026). Bei den
	 * nützlichen und luxuriösen Massnahmen ist es die Ausnahme des Gesetzes; bei
	 * Zweckänderung und Verfügung ist es, dass schon der Tatbestand nicht unter
	 * Abs. 2 fällt (Rz. 46 ad Art. 712o; zur Zweckänderung ZGB Art. 769 Abs. 1
	 * und 2: keine Veränderung der wirtschaftlichen Bestimmung zum erheblichen
	 * Nachteil des Eigentümers, kein Umgestalten).
	 */
	const nichtVerwaltung = gegenstand === 'nutzungsaenderung' || gegenstand === 'grundordnung';

	return {
		wer,
		vonHand: false,
		satz:
			wer === 'eigentuemer'
				? nichtVerwaltung && knotenId === SONDERINHALT_KNOTEN
					? sonderinhaltOhneAbsprache(nutzniessung.holderName)
					: nichtVerwaltung
					? `Es geht um ${wortlaut}. Über die Sache verfügen und ihren Zweck ändern kann ` +
						'nur der Eigentümer, nicht der Nutzniesser; das fällt nicht unter die Verwaltung, ' +
						'für die der Nutzniesser stimmt (SVIT-Kommentar 2023, Art. 712o Rz. 46). ' +
						(knotenId === WERTQUOTEN_AENDERN_KNOTEN
							? wertquotenOhneAbsprache(nutzniessung.holderName)
							: `Ohne Absprache stimmt deshalb der **Eigentümer**, nicht ${nutzniessung.holderName}.`)
					: `Es geht um ${wortlaut}. Dafür stimmt der **Eigentümer**, nicht ${nutzniessung.holderName} ` +
						'(ZGB Art. 712o Abs. 2).'
				: /*
					 * **Kein «er» für einen Namen** (23.08.2026, Prüflauf II, C-03). Der
					 * Satz lautete «Dafür stimmt Hedwig Berger-Stucki als Nutzniesser — er
					 * stimmt in allen Fragen …». Gemeint war die Rolle, gelesen wurde die
					 * Person. Die Anwendung kennt das Geschlecht nicht und soll es auch
					 * nicht raten; sie kommt ohne Fürwort aus.
					 */
					`Es geht um ${wortlaut}. Dafür stimmt **${nutzniessung.holderName}** als ` +
					'nutzniessende Person — die Nutzniessung umfasst alle Fragen der ' +
					'Bewirtschaftung, die das Gesetz «Verwaltung» nennt (ZGB Art. 712o Abs. 2).'
	};
}

export interface NutzniessungEingabe {
	unitId: Id;
	/** Name des Berechtigten. Pflicht — ohne ihn ist nichts zuzuordnen. */
	holderName: string;
	/** Beginn. Pflicht. */
	validFrom: string;
	/** Ende. Freiwillig: Eine Nutzniessung endet oft erst mit dem Tod. */
	validTo?: string;
	/**
	 * Ob eine Vereinbarung über die Stimmrechtsausübung besteht.
	 *
	 * Besteht sie, verdrängt sie die Auffangregel vollständig — auch für
	 * qualifiziertes Mehr und Einstimmigkeit.
	 */
	hasAgreement: boolean;
	/** Was die Vereinbarung sagt, in Worten der Sitzungsleitung. */
	agreementSummary?: string;
	/**
	 * Vermerk: Der Nutzniessungsvertrag liegt der Bewirtschaftung vor.
	 *
	 * Er ist die Grundlage der Erfassung und liegt deshalb ohnehin vor der
	 * Versammlung dort. Der Vermerk ist der Nachweis; die Kopie unten ist ein
	 * Nachtrag — wie «Original vorgelegt» bei der Vollmacht.
	 */
	contractOnFile?: boolean;
	/** Prüfsumme der hinterlegten Kopie des Nutzniessungsvertrags. */
	documentChecksum?: string;
}

export interface Nutzniessung extends NutzniessungEingabe {
	id: Id;
}

export function pruefeNutzniessung(eingabe: NutzniessungEingabe): NutzniessungEingabe {
	const holderName = eingabe.holderName?.trim() ?? '';
	if (zeichenzahl(holderName) < 2) {
		throw new FachlicherFehler(
			'berechtigter_fehlt',
			'Der Name des Nutzniessers fehlt.',
			'holderName'
		);
	}

	if (!eingabe.validFrom || !istKalendertag(eingabe.validFrom)) {
		throw new FachlicherFehler('beginn_fehlt', 'Der Beginn der Nutzniessung fehlt.', 'validFrom');
	}

	const validTo = eingabe.validTo?.trim() || undefined;
	if (validTo) {
		if (!istKalendertag(validTo)) {
			throw new FachlicherFehler('ende_ungueltig', 'Das Ende ist kein gültiges Datum.', 'validTo');
		}
		if (validTo <= eingabe.validFrom) {
			throw new FachlicherFehler(
				'ende_vor_beginn',
				'Das Ende liegt vor dem Beginn.',
				'validTo'
			);
		}
	}

	const zusammenfassung = eingabe.agreementSummary?.trim() || undefined;

	// Eine Vereinbarung, von der nur bekannt ist, dass es sie gibt, hilft der
	// Sitzungsleitung nicht: Im Moment der Abstimmung muss ablesbar sein, was
	// darin steht.
	if (eingabe.hasAgreement && !zusammenfassung) {
		throw new FachlicherFehler(
			'vereinbarung_ohne_inhalt',
			'Besteht eine Vereinbarung über die Stimmrechtsausübung, ist festzuhalten, was sie regelt.',
			'agreementSummary'
		);
	}

	return {
		...eingabe,
		holderName,
		validTo,
		agreementSummary: eingabe.hasAgreement ? zusammenfassung : undefined,
		contractOnFile: eingabe.contractOnFile ?? false,
		documentChecksum: eingabe.documentChecksum || undefined
	};
}

export function legeNutzniessungAn(
	id: Id,
	eingabe: NutzniessungEingabe
): Uebergang<Nutzniessung> {
	const geprueft = pruefeNutzniessung(eingabe);

	return uebergang(
		{ ...geprueft, id },
		ereignis(
			EREIGNISARTEN.nutzniessungErfasst,
			{ art: 'unit', id: geprueft.unitId },
			{
				nutzniesser: geprueft.holderName,
				ab: geprueft.validFrom,
				bis: geprueft.validTo ?? null,
				vereinbarung: geprueft.hasAgreement,
				nachweis: Boolean(geprueft.documentChecksum)
			}
		)
	);
}

/**
 * Hinweis an die Sitzungsleitung, wenn an einer Einheit eine Nutzniessung besteht.
 *
 * Bewusst ein Satz zum Lesen und keine Entscheidung: In Welle 1 findet keine
 * automatische Ableitung statt.
 */
export function nutzniessungsHinweis(n: Pick<Nutzniessung, 'holderName' | 'hasAgreement' | 'agreementSummary'>): string {
	if (n.hasAgreement) {
		return (
			`An dieser Einheit besteht eine Nutzniessung zugunsten von ${n.holderName}, ` +
			`mit Vereinbarung über die Stimmrechtsausübung: ${n.agreementSummary}. ` +
			`Die Vereinbarung geht der gesetzlichen Regel vor und kann alle Beschlussarten erfassen. ` +
			`Wer stimmberechtigt ist, bestimmt die Sitzungsleitung am Traktandum.`
		);
	}
	return (
		`An dieser Einheit besteht eine Nutzniessung zugunsten von ${n.holderName}, ohne Vereinbarung ` +
		`über die Stimmrechtsausübung. Nach ZGB Art. 712o Abs. 2 gilt der Nutzniesser in allen Fragen ` +
		`der Verwaltung als stimmberechtigt, ausgenommen bloss nützliche und der Verschönerung oder ` +
		`Bequemlichkeit dienende bauliche Massnahmen. Wer stimmberechtigt ist, bestimmt die ` +
		`Sitzungsleitung am Traktandum.`
	);
}

/**
 * Die Nutzniessungen an den Einheiten der Betroffenen eines Wertquotenbeschlusses,
 * für die Zeile «ausstehend» im Protokoll (Produktentscheid 03.11.2026; ZGB
 * Art. 712e Abs. 2, SVIT-Kommentar 2023, Art. 712e Rz. 80, 88).
 *
 * **Aus dem festgehaltenen Stand**, nicht aus den Stammdaten: Er trägt die
 * am Versammlungstag gültige Nutzniessung, mit der Freigabe eingefroren
 * (`server/freigabe.ts`). Eine danach beendete oder neu erfasste änderte sonst
 * das Protokoll einer vergangenen Versammlung.
 *
 * **Je Einheit der Partei, nicht je geänderter Quote.** Votum kennt die
 * Betroffenen als Parteien, nicht die Einheiten, deren Quote sich ändert; der
 * Satz im Protokoll sagt deshalb «wenn sich die Quote ihrer Einheit ändert» und
 * nennt die Einheit. Reihenfolge wie im Stand.
 */
export function nutzniessungenDerBetroffenen(
	parteien: readonly Pick<SnapshotParty, 'partyId' | 'units'>[],
	betroffene: readonly Id[]
): { nutzniesser: string; einheit: string }[] {
	const menge = new Set(betroffene);
	return parteien
		.filter((p) => menge.has(p.partyId))
		.flatMap((p) => p.units)
		.flatMap((e) => (e.nutzniessung ? [{ nutzniesser: e.nutzniessung.holderName, einheit: e.label }] : []));
}
