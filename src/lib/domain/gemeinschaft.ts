/**
 * Regeln der Stockwerkeigentümergemeinschaft (Story 1.4, FR-1, AD-2, AD-12).
 *
 * Reine Funktionen: Sie bekommen Werte und geben Werte zurück. Ob eine
 * Gemeinschaft angelegt werden darf, entscheidet sich hier — nicht in einer
 * Datenbankabfrage und nicht in einem Formular.
 */
import type { HeadCountMode, Id, Stichentscheid, Stweg } from './types';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';
import { KI_FUNKTIONEN } from './ki';
import type { AusnahmenNichtangekuendigtes } from './ausnahmen';
import type { Neuabstimmungsart } from './neuabstimmung';
import type { Fondsgrenze } from './fondsgrenze';

/*
 * **Der fachliche Fehler steht seit dem 24.08.2026 in `fehler.ts`** und wird
 * hier nur weitergegeben. Er stand hier, alle banden ihn von hier ein — auch
 * `ki.ts`, aus dem diese Datei `KI_FUNKTIONEN` holt. Das war ein Ring zwischen
 * zwei Kernmodulen, den `dependency-cruiser` am Tag seiner Einführung fand.
 *
 * Die Weitergabe bleibt, damit die bestehenden Einbindungen unverändert
 * weiterlaufen; wer neu schreibt, nimmt ihn aus `fehler.ts`.
 */
import { FachlicherFehler } from './fehler';
import { zeichenzahl } from './zeichenzahl';
export { FachlicherFehler };

export const ZAEHLWEISEN: HeadCountMode[] = ['per_owner', 'per_unit'];

/**
 * S11, F4a (Z17; Endfassung, Laien S11-1): Hilfetext beim Feld «Fundstelle im
 * Reglement» zum Stichentscheid, angehängt (`GemeinschaftFormular.svelte`).
 * Sicherer Weg: Rz. 186 ad Art. 712m verlangt Einstimmigkeit für eine
 * Abweichung von der gesetzlichen Berechnung des einfachen Mehrs; ob das auch
 * für den Stichentscheid gilt (Rz. 187 und 188), ist Folgerung, deshalb
 * behauptet der Satz es nicht.
 */
export const STICHENTSCHEID_EINFUEHRUNG =
	'Am sichersten ist eine solche Klausel, wenn alle Eigentümer ihr zugestimmt haben, etwa weil sie schon im ' +
	'ersten Reglement bei der Gründung des Stockwerkeigentums stand. Kam sie später mit Mehrheit dazu, tragen ' +
	'Sie die Fundstelle trotzdem ein.';

/**
 * Der Nenner der Wertquoten. Üblich sind Tausendstel; das Reglement kann anderes
 * vorsehen. Null bedeutet: Die Ebene ist eine blosse Klammer ohne eigene Quote.
 */
export const NENNER_VORSCHLAEGE = [1000, 10000, 100] as const;

/**
 * Wer laut Grundbuch den Anteil einer Miteigentümergemeinschaft trägt, deren
 * Mitglieder Gemeinschaften sind (Ä-43, Produktentscheid 17.09.2026,
 * `docs/freigabe.md`). Die drei Werte stehen in der Zweitprüfung
 * (`docs/zweitpruefung-2026-09-17.md`, Ä-43); am Volltext geprüft trägt
 * ad Art. 712l Rz. 75b: Den Anspruch aus unselbstständigem Eigentum übt «in der
 * Regel» die Stockwerkeigentümergemeinschaft aus.
 *
 * **Eine Angabe, keine Rechenregel.** Votum zählt danach nicht anders. Ob
 * Art. 712m Abs. 2, 712p und 75 ZGB in dieser Gemeinschaft gelten und ob eine
 * Stimme je Haus zulässig ist, bleibt offen (Zweitprüfung, Teil 4, Nr. 16);
 * die Angabe macht sichtbar, worauf eine Antwort sich stützen müsste.
 */
export const TRAEGERSCHAFTEN = ['stammgrundstueck', 'stockwerkanteile', 'personen'] as const;
export type Traegerschaft = (typeof TRAEGERSCHAFTEN)[number];

/** Die drei Werte in Worten, für Formular und Verlauf. */
export const TRAEGERSCHAFT_IN_WORTEN: Readonly<Record<Traegerschaft, string>> = {
	stammgrundstueck:
		'Mit dem Stammgrundstück des Hauses verknüpft: Die Gemeinschaft des Hauses übt den Anteil aus',
	stockwerkanteile:
		'Mit den einzelnen Stockwerkanteilen verknüpft: Jede Eigentümerin und jeder Eigentümer ist selbst Mitglied',
	personen: 'Selbstständiges Miteigentum: Die Anteile gehören einzelnen Personen'
};

export function istTraegerschaft(wert: unknown): wert is Traegerschaft {
	return typeof wert === 'string' && (TRAEGERSCHAFTEN as readonly string[]).includes(wert);
}

/**
 * Verlangt die Trägerschaft, wenn Gemeinschaften Mitglied sind.
 *
 * **Beim Anlegen und beim nächsten Bearbeiten, nicht rückwirkend**
 * (Produktentscheid 17.09.2026): Bestehende Anlagen behalten den leeren Wert,
 * bis jemand ihre Angaben speichert. Ein geratener Wert stünde sonst da, als
 * hätte jemand den Grundbuchauszug gelesen.
 */
function verlangeTraegerschaft(g: GemeinschaftEingabe, mitHaeusern: boolean): void {
	if (mitHaeusern && !g.traegerschaft) {
		throw new FachlicherFehler(
			'traegerschaft_fehlt',
			'Wählen Sie die Trägerschaft gemäss Grundbuch. Sie steht im Grundbuchauszug der ' +
				'gemeinsamen Parzelle; fehlt er Ihnen, erhalten Sie ihn beim Grundbuchamt.',
			'traegerschaft'
		);
	}
}

export interface GemeinschaftEingabe {
	name: string;
	strasse?: string;
	plz?: string;
	ort?: string;
	quotaDenominator: number;
	headCountMode: HeadCountMode;
	parkingCountsAsHead: boolean;
	parentStwegId: Id | null;
	/**
	 * Wo die Zählweise im Reglement steht, etwa «Reglement Ziff. 14.2».
	 *
	 * Bei der Zählung je Einheit ist das der Nachweis, auf den es im Streitfall
	 * ankommt — sie gilt nur, soweit das Reglement sie vorsieht. Bei der
	 * gesetzlichen Auffangregel bleibt das Feld leer, denn dort gibt es nichts
	 * zu belegen.
	 */
	headCountRuleSource?: string;
	/**
	 * Wie ein Gleichstand aufgelöst wird. Ohne Angabe die gesetzliche Lage: Wer die
	 * Mehrheit nicht hat, hat sie nicht.
	 */
	tieBreak?: Stichentscheid;
	/** Fundstelle im Reglement für den Stichentscheid, etwa «Art. 30 Reglement». */
	tieBreakRuleSource?: string;
	/**
	 * Ob Enthaltungen beim einfachen Mehr aus der Bezugsgrösse fallen
	 * (07.10.2026). Gerechnet wird das nicht hier, sondern in
	 * `wendeReglementAn`, das die Einstellung ins Erfordernis legt; dort steht
	 * auch, wo sie greift und wo nicht.
	 *
	 * **Vorgabe: aus**, also die gesetzliche Berechnung nach herrschender Lehre
	 * (Rz. 181 ad Art. 712m, selbst nicht unumstritten).
	 */
	abstentionExcluded?: boolean;
	/**
	 * Fundstelle der Klausel. Pflicht, weil ihre Einführung einstimmig sein muss
	 * (Rz. 186 ad Art. 712m) und Votum das nicht prüfen kann.
	 */
	abstentionExcludedSource?: string;
	/**
	 * Höchstzahl der Vollmachten, die eine Person übernehmen darf (FR-23).
	 *
	 * Das Gesetz kennt keine solche Schranke, viele Reglemente schon. Ohne
	 * hinterlegte Zahl prüft die Anwendung nichts.
	 *
	 * **Seit dem 24.09.2026 sperrt sie, statt zu warnen** (Produktentscheid,
	 * `verlangeVollmachtsgrenze` in `server/vollmacht.ts`). Hier stand bis dahin
	 * «Sie warnt nur: Über die Zulassung entscheidet die Versammlung, nicht das
	 * Werkzeug.» Der Grund für den Wechsel: Die überzählige Vollmacht bleibt
	 * nicht folgenlos stehen, sie zählt bei Köpfen und Wertquoten mit und kann
	 * das Ergebnis drehen. Damit hängt an dieser Zahl jetzt eine Absage im Saal
	 * und nicht mehr eine Zeile in einer Liste.
	 */
	proxyLimit?: number | null;
	/** Fundstelle der Schranke — ohne sie liesse sich die Absage nicht begründen. */
	proxyLimitRuleSource?: string;
	/**
	 * Ob Eigentümer über ihren persönlichen Zugang selbst bevollmächtigen dürfen.
	 *
	 * **Vorgabe: aus.** Manche Reglemente verlangen eine *schriftliche*
	 * Vollmacht, und ob eine Erklärung über den persönlichen Code das erfüllt,
	 * entscheidet keine Software. Wer freischaltet, hat das geprüft — und sagt,
	 * woraufhin.
	 */
	proxyByAccess?: boolean;
	/** Worauf sich die Freischaltung stützt. Ohne sie bleibt der Weg zu. */
	proxyByAccessSource?: string;
	/**
	 * Ob KI-Unterstützung für diese Gemeinschaft zugelassen ist (FR-62).
	 *
	 * **Vorgabe: aus.** Nicht, weil die KI gefährlich wäre, sondern weil dabei
	 * Inhalte an ein fremdes Haus übermittelt werden. Wer das will, schaltet es
	 * bewusst ein — und weiss aus der Einrichtung, wohin.
	 */
	aiEnabled?: boolean;
	/**
	 * Einzelne Funktionen, die trotzdem nicht genutzt werden.
	 *
	 * Eine Gemeinschaft kann die Traktandenprüfung wollen und den
	 * Protokollentwurf nicht. Beides an einem Schalter hiesse, dass
	 * Zurückhaltung bei einem Punkt die Hilfe bei allen anderen kostet.
	 */
	aiDisabledFunctions?: string[];
	/**
	 * Wer laut Grundbuch den Anteil trägt (Ä-43, `TRAEGERSCHAFTEN`). Pflicht nur,
	 * wenn Gemeinschaften Mitglied sind; `undefined` heisst «nicht mitgeschickt»
	 * und lässt den gespeicherten Wert stehen.
	 */
	traegerschaft?: Traegerschaft | null;
}

/**
 * Prüft eine Eingabe und gibt die bereinigten Werte zurück.
 *
 * Getrennt vom Anlegen, weil dieselbe Prüfung beim Ändern und beim CSV-Import
 * gebraucht wird.
 */
export function pruefeGemeinschaft(eingabe: GemeinschaftEingabe): GemeinschaftEingabe {
	const name = eingabe.name?.trim() ?? '';
	if (zeichenzahl(name) < 2) {
		throw new FachlicherFehler(
			'name_zu_kurz',
			'Die Bezeichnung der Gemeinschaft fehlt oder ist zu kurz.',
			'name'
		);
	}
	if (zeichenzahl(name) > 200) {
		throw new FachlicherFehler('name_zu_lang', 'Die Bezeichnung ist länger als 200 Zeichen.', 'name');
	}

	const nenner = eingabe.quotaDenominator;
	if (!Number.isInteger(nenner)) {
		// Ein Kommawert als Nenner wäre der Anfang von Rundungsfehlern in der
		// Auszählung. Wertquoten sind ganzzahlig (AD-12).
		throw new FachlicherFehler(
			'nenner_nicht_ganzzahlig',
			'Der Wertquoten-Nenner muss eine ganze Zahl sein.',
			'quotaDenominator'
		);
	}
	if (nenner < 0) {
		throw new FachlicherFehler(
			'nenner_negativ',
			'Der Wertquoten-Nenner kann nicht negativ sein.',
			'quotaDenominator'
		);
	}

	if (!ZAEHLWEISEN.includes(eingabe.headCountMode)) {
		// Keine stillschweigende Voreinstellung: Rechtlich gilt eine Stimme je
		// Eigentümer, in den meisten Reglementen steht die Zählung je Einheit. Wer
		// hier nicht wählt, hat nicht ins Reglement gesehen — und das fiele sonst
		// erst auf, wenn ein Beschluss angefochten wird.
		throw new FachlicherFehler(
			'zaehlweise_fehlt',
			'Die Zählweise der Kopfstimme ist zu wählen. Sie steht im Reglement; fehlt dort eine Regel, gilt eine Stimme je Eigentümer.',
			'headCountMode'
		);
	}

	// Der Zusatz zu den Nebenobjekten ergibt nur bei der Zählung je Einheit einen
	// Sinn: Bei einer Kopfstimme je Eigentümer ändert die Zahl seiner Einheiten
	// ohnehin nichts.
	const nebenobjekte = eingabe.headCountMode === 'per_unit' ? eingabe.parkingCountsAsHead : false;

	// Die Fundstelle nur dort führen, wo sie etwas belegt. Bei der gesetzlichen
	// Auffangregel wäre ein Verweis aufs Reglement irreführend.
	const fundstelle = brauchtReglementsbeleg(eingabe.headCountMode)
		? eingabe.headCountRuleSource?.trim() || undefined
		: undefined;

	const stichentscheid = eingabe.tieBreak ?? 'keiner';
	if (!STICHENTSCHEIDE.includes(stichentscheid)) {
		throw new FachlicherFehler(
			'stichentscheid_unbekannt',
			`Unbekannte Regel für den Gleichstand: ${stichentscheid}.`,
			'tieBreak'
		);
	}
	// Anders als bei der Zählweise gibt es hier eine Voreinstellung: Das Gesetz
	// kennt keinen Stichentscheid, wer nichts einträgt, bekommt also die
	// Rechtslage. Eine Abweichung davon verlangt aber die Fundstelle.
	const stichentscheidFundstelle =
		stichentscheid === 'keiner' ? undefined : eingabe.tieBreakRuleSource?.trim() || undefined;

	// Die Enthaltungen beim einfachen Mehr: aus, oder an mit Fundstelle. Ohne sie
	// liesse sich ein Beschluss, der erst dadurch zustande kam, nicht verteidigen.
	const ohneEnthaltung = eingabe.abstentionExcluded === true;
	const ohneEnthaltungFundstelle = ohneEnthaltung
		? eingabe.abstentionExcludedSource?.trim() || undefined
		: undefined;
	if (ohneEnthaltung && (!ohneEnthaltungFundstelle || zeichenzahl(ohneEnthaltungFundstelle) < 3)) {
		throw new FachlicherFehler(
			'enthaltung_ohne_fundstelle',
			'Wenn Enthaltungen beim einfachen Mehr nicht mitzählen sollen, gehört die Fundstelle im Reglement dazu.',
			'abstentionExcludedSource'
		);
	}

	// Die Vollmachtsschranke: eine Zahl oder gar nichts. Eine Null wäre etwas
	// anderes als «keine Schranke» — sie hiesse, niemand dürfe vertreten, und
	// das steht in keinem Reglement.
	let schranke: number | null = null;
	let schrankeFundstelle: string | undefined;
	if (eingabe.proxyLimit !== null && eingabe.proxyLimit !== undefined) {
		if (!Number.isInteger(eingabe.proxyLimit) || eingabe.proxyLimit < 1) {
			throw new FachlicherFehler(
				'vollmachtschranke_ungueltig',
				'Die Höchstzahl der Vollmachten ist eine ganze Zahl ab 1. Lassen Sie das Feld leer, wenn das Reglement keine Schranke kennt.',
				'proxyLimit'
			);
		}
		schranke = eingabe.proxyLimit;
		schrankeFundstelle = eingabe.proxyLimitRuleSource?.trim() || undefined;
		if (!schrankeFundstelle || zeichenzahl(schrankeFundstelle) < 3) {
			// Dieselbe Begründung wie bei der Zählweise: Wer den Beschluss ficht,
			// greift zuerst die Vertretungsmacht an. Eine Schranke ohne Fundstelle
			// liesse sich dann nicht verteidigen.
			throw new FachlicherFehler(
				'vollmachtschranke_ohne_fundstelle',
				'Zur Höchstzahl der Vollmachten gehört die Fundstelle im Reglement.',
				'proxyLimitRuleSource'
			);
		}
	}

	// Der Weg über den persönlichen Zugang: an oder aus, und wenn an, dann mit
	// Begründung. Eine Freischaltung ohne Fundstelle liesse sich im Streit über
	// die Form der Vollmacht nicht verteidigen.
	const ueberZugang = eingabe.proxyByAccess === true;
	const ueberZugangFundstelle = ueberZugang
		? eingabe.proxyByAccessSource?.trim() || undefined
		: undefined;
	if (ueberZugang && (!ueberZugangFundstelle || zeichenzahl(ueberZugangFundstelle) < 3)) {
		throw new FachlicherFehler(
			'vollmacht_ueber_zugang_ohne_fundstelle',
			'Zur Freischaltung der Vollmacht über den persönlichen Zugang gehört die Fundstelle im Reglement — oder der Beschluss, auf den sie sich stützt.',
			'proxyByAccessSource'
		);
	}

	/*
	 * **Eine übergeordnete Gemeinschaft steht nicht selbst unter einer anderen.**
	 *
	 * Gemeldet am 12.08.2026: «Wenn übergeordnet ist, sollte diese nicht ‹Gehört
	 * diese Gemeinschaft zu einer übergeordneten?› möglich sein, weil
	 * übergeordnet.» Der Grund ist stärker als die Anschauung — es wäre nicht
	 * rechenbar. Nachgerechnet mit `pruefeSalden` an einer dreistufigen Anlage:
	 *
	 *     Sonnenhof:      soll 1000, eigene 0, unten 0, Abweichung 1000
	 *     Teilanlage Süd: keine Zeile (Nenner 0 → keine Quotenart)
	 *     Haus 1/Haus 2:  600 + 400, gehen für sich auf
	 *
	 * Eine Zwischenebene ohne eigene Quote trägt nach oben **nichts** bei: Der
	 * Nenner der Kinder wird nur eine Ebene weit angerechnet. Der Sonnenhof ginge
	 * nie auf, egal was darunter erfasst wird — eine Sackgasse, aus der auch
	 * sorgfältiges Erfassen nicht herausführt.
	 *
	 * Wer eine dreistufige Anlage wirklich braucht, gibt der mittleren Ebene einen
	 * eigenen Nenner; dann ist sie keine blosse Zusammenfassung mehr, sondern eine
	 * Gemeinschaft mit eigener Quote, und die Rechnung geht durch.
	 */
	if (nenner === 0 && eingabe.parentStwegId) {
		throw new FachlicherFehler(
			'uebergeordnete_mit_eltern',
			'Eine übergeordnete Gemeinschaft ohne eigene Wertquote kann nicht selbst unter einer ' +
				'anderen stehen: Sie trüge zu deren Wertquoten nichts bei, und der Saldo dort ginge ' +
				'nie auf. Geben Sie ihr einen eigenen Nenner, wenn sie eine Zwischenebene sein soll.',
			'parentStwegId'
		);
	}

	// Nur bekannte Funktionen: Ein Tippfehler in der Ausnahmeliste liesse eine
	// Funktion offen, die jemand für abgeschaltet hält — und das fiele erst auf,
	// wenn sie benutzt wurde.
	const ausgenommen = [...new Set(eingabe.aiDisabledFunctions ?? [])].filter((f) =>
		(KI_FUNKTIONEN as readonly string[]).includes(f)
	);

	// Ein unbekannter Wert ist ein Fehler, kein leeres Feld: Er käme nur von
	// aussen am Formular vorbei, und still verworfen sähe er aus wie gespeichert.
	if (eingabe.traegerschaft != null && !istTraegerschaft(eingabe.traegerschaft)) {
		throw new FachlicherFehler(
			'traegerschaft_unbekannt',
			'Diese Trägerschaft kennt Votum nicht. Wählen Sie einen der drei Werte.',
			'traegerschaft'
		);
	}

	return {
		name,
		strasse: eingabe.strasse?.trim() || undefined,
		plz: eingabe.plz?.trim() || undefined,
		ort: eingabe.ort?.trim() || undefined,
		quotaDenominator: nenner,
		headCountMode: eingabe.headCountMode,
		parkingCountsAsHead: nebenobjekte,
		parentStwegId: eingabe.parentStwegId,
		headCountRuleSource: fundstelle,
		tieBreak: stichentscheid,
		tieBreakRuleSource: stichentscheidFundstelle,
		abstentionExcluded: ohneEnthaltung,
		abstentionExcludedSource: ohneEnthaltungFundstelle,
		proxyLimit: schranke,
		proxyLimitRuleSource: schrankeFundstelle,
		proxyByAccess: ueberZugang,
		proxyByAccessSource: ueberZugangFundstelle,
		aiEnabled: eingabe.aiEnabled === true,
		aiDisabledFunctions: ausgenommen,
		// Nur, wenn mitgeschickt: Das Formular zeigt das Feld nur bei
		// Gemeinschaften mit Häusern, und ein fehlendes Feld darf den
		// gespeicherten Wert beim Ändern nicht überschreiben.
		...(eingabe.traegerschaft !== undefined ? { traegerschaft: eingabe.traegerschaft } : {})
	};
}

/**
 * Worauf sich eine Zählweise stützt.
 *
 * Zwei Ebenen, die nicht zusammenfallen:
 *
 * **Rechtlich** ist eine Stimme je Eigentümer die Auffangregel — ZGB Art. 712m
 * Abs. 2 in Verbindung mit Art. 67 Abs. 1, und der Beobachter-Ratgeber sagt es
 * ausdrücklich: «jeder Stockwerkeigentümer nur eine Stimme, selbst als Eigentümer
 * mehrerer Wohnungen».
 *
 * **In der Praxis** steht in den meisten Reglementen die Zählung je Einheit. Das
 * Schulskript hält das gleich mit fest: «In der Praxis wird dieser Punkt jedoch
 * im Reglement oft abgeändert.»
 *
 * Daraus folgt das Wichtigste: **Eine Voreinstellung wäre hier falsch, egal
 * welche.** Wer «je Einheit» unbesehen übernimmt, zählt vielleicht ohne Grundlage
 * im Reglement; wer «je Eigentümer» unbesehen übernimmt, zählt vielleicht gegen
 * das eigene Reglement. Beides fällt erst auf, wenn ein Beschluss angefochten
 * wird. Deshalb verlangt die Oberfläche eine bewusste Wahl und fragt bei der
 * Zählung je Einheit nach der Fundstelle.
 */
export type Rechtsgrundlage = 'gesetzliche_auffangregel' | 'reglement';

export function grundlageDerZaehlweise(modus: HeadCountMode): Rechtsgrundlage {
	return modus === 'per_owner' ? 'gesetzliche_auffangregel' : 'reglement';
}

/**
 * Braucht die Zählweise einen Beleg im Reglement?
 *
 * Nur die Zählung je Einheit: Sie weicht von der gesetzlichen Auffangregel ab und
 * gilt nur, soweit das Reglement sie vorsieht. Die Auffangregel gilt von selbst.
 */
export function brauchtReglementsbeleg(modus: HeadCountMode): boolean {
	return modus === 'per_unit';
}

export const STICHENTSCHEIDE: Stichentscheid[] = [
	'keiner',
	'wertquote',
	'verwalter',
	'vorsitz',
	'wertquote_verwalter',
	'wertquote_vorsitz'
];

/** Ob die Anteilsberechtigung den Gleichstand zuerst auflöst. */
export function quotenstufe(s: Stichentscheid): boolean {
	return s === 'wertquote' || s === 'wertquote_verwalter' || s === 'wertquote_vorsitz';
}

/**
 * Welche Person den Gleichstand entscheidet, wo das Reglement eine benennt:
 * allein oder nach den Wertquoten, wenn auch diese gleich sind.
 */
export function personenstufe(s: Stichentscheid): 'verwalter' | 'vorsitz' | null {
	if (s === 'verwalter' || s === 'wertquote_verwalter') return 'verwalter';
	if (s === 'vorsitz' || s === 'wertquote_vorsitz') return 'vorsitz';
	return null;
}

/**
 * Eine reine Artikelangabe um ihre Quelle ergänzen.
 *
 * **Der Befund** (Auftraggeber, 28.08.2026): «Gezählt wird eine Kopfstimme je Einheit,
 * gestützt auf Art. 18.» müsste «Art. 18 Reglement» heissen. Das Feld ist frei;
 * wer «Art. 18» einträgt, meint seinen Reglementsartikel, und im Protokoll
 * stand dann ein Artikel ohne Gesetz — ein Leser sucht ihn im ZGB.
 *
 * **Ergänzt wird nur, was nichts als eine Gliederungsangabe ist.** Die erste
 * Fassung hängte «des Reglements» an alles, worin das Wort nicht vorkam, und
 * hätte «Art. 712m Abs. 2 ZGB» zu «… ZGB des Reglements» gemacht — im
 * gesiegelten PDF. Das Muster ist deshalb eng geschnitten, und im Zweifel
 * geschieht nichts: Wer mehr schreibt als Artikel, Absatz und Buchstabe, hat
 * seine Quelle selbst benannt.
 *
 * **Die vier Aufrufstellen sind heute alle reglementsgebunden** — die Felder
 * heissen in der Maske «Fundstelle im Reglement», und die Beschlussfähigkeit
 * der Einladung stammt aus den hinterlegten Reglementsregeln. Der Zusatz sagt
 * dort also nur, was das Feld ohnehin zusichert. Wer diese Funktion einmal an
 * einem Feld verwendet, das auch einen Begründungsakt oder einen Beschluss
 * aufnimmt (`proxyByAccessSource` ist ein solches und läuft bewusst nicht
 * hier durch), macht sie damit falsch.
 */
const NUR_GLIEDERUNG =
	/^(?:art\.?|artikel|ziff\.?|ziffer|§)\s*\d+[a-z]?(?:\s*(?:abs\.?|absatz)\s*\d+)?(?:\s*(?:lit\.?|bst\.?|buchstabe)\s*[a-z])?\.?$/i;

export function mitQuelle(fundstelle: string): string {
	const f = fundstelle.trim();
	return NUR_GLIEDERUNG.test(f) ? `${f} des Reglements` : f;
}

/**
 * Der Stichentscheid in einem Satz, für die Auswertung.
 *
 * Steht nur da, wo das Reglement eine Regel führt: Bei der gesetzlichen Lage
 * gibt es nichts zu erklären.
 *
 * **Seit dem 28.09.2026 sagt der Satz beim Verwalter, dass die Klausel gilt**
 * (Produktentscheid: «Wendet es an. Empfohlen wird ablehnen, weil das dem
 * Gesetz entspricht und man nicht Partei ergreifen würde.»). Die Person trägt
 * ihren Entscheid ein; der Satz nennt die Regel, die Empfehlung und den
 * Vorbehalt, dass die Befugnis eines Verwalters umstritten ist. Die Fundstelle
 * bleibt genannt: Sie belegt, was im Reglement steht, und wird gebraucht, wenn
 * die Gemeinschaft es ändern will.
 */
export function stichentscheidInWorten(
	stichentscheid: Stichentscheid,
	fundstelle: string | null
): string | null {
	if (stichentscheid === 'keiner') return null;
	const beleg = fundstelle?.trim()
		? `gestützt auf ${mitQuelle(fundstelle)}`
		: 'ohne im System vermerkte Fundstelle im Reglement';
	/*
	 * **Empfehlung und Frist für jede Person** (Codeprüfung 07.10.2026, M3).
	 * Das Protokoll übernimmt nur diesen Satz, nicht die Hinweise beim
	 * Gleichstand; was dort steht, muss also auch hier stehen.
	 *
	 * **Vorsitz und Verwalter sind rechtlich nicht dasselbe** (Fachprüfung
	 * 07.10.2026, `quellen/pruefung/berichte/2026-10-07-votum-stichentscheid-kaskade.md`).
	 * Rz. 187 ad Art. 712m nennt den Stichentscheid des Vorsitzenden als
	 * zulässige Reglementslösung; als «inakzeptable Variante» gilt dort nur der
	 * Verwalter, «welcher nicht gleichzeitig Stockwerkeigentümer ist». Einer
	 * Eigentümerin im Vorsitz empfiehlt Votum deshalb keine Richtung
	 * (Produktentscheid 07.10.2026).
	 */
	const person = personenstufe(stichentscheid);
	if (person) {
		const anfang = quotenstufe(stichentscheid)
			? 'Bei Stimmengleichheit entscheiden nach dem Reglement zuerst die Wertquoten; stehen ' +
				`hinter Ja und Nein gleich viele, entscheidet ${person === 'verwalter' ? 'der Verwalter' : 'die Person im Vorsitz'}`
			: person === 'verwalter'
				? 'Das Reglement sieht bei Stimmengleichheit den Verwalter als entscheidende Person vor'
				: 'Das Reglement sieht bei Stimmengleichheit die Person im Vorsitz als entscheidende Person vor';
		const empfehlung =
			person === 'verwalter'
				? 'Dem Verwalter wird empfohlen, den Antrag abzulehnen, weil der Beschluss nach dem Gesetz bei Stimmengleichheit ' +
					'nicht gefasst ist; ob ein Verwalter den ' +
					'Stichentscheid haben darf, ist umstritten (SVIT-Kommentar 2023, Art. 712m Rz. 187)'
				: 'Der Kommentar nennt den Stichentscheid des Vorsitzenden als zulässige Lösung im ' +
					'Reglement (SVIT-Kommentar 2023, Art. 712m Rz. 187). Ist die Person im Vorsitz selbst ' +
					'Stockwerkeigentümer, wird ihr keine Richtung empfohlen; ist sie es nicht, wird ihr ' +
					'empfohlen, den Antrag abzulehnen, weil sie die Folgen nicht trägt';
		/*
		 * **Ohne den Programmnamen und mit dem Fristbeginn** (Laienprüfung
		 * 07.10.2026, L3 und L4): Der Satz steht im Protokoll, das die
		 * Eigentümer lesen, und eine Frist ohne Beginn läuft dort ins Leere.
		 *
		 * A5, Punkt 12a: die Grenze dazu, seit A2 gilt ein Stichentscheid
		 * jeder Art nur beim einfachen Mehr ohne Wertquoten
		 * (`stichentscheidMoeglich` in `auszaehlung.ts`).
		 */
		return (
			// 16.11.2026: auch beim einfachen Mehr nach Wertquoten allein (Regel «Köpfe zählen nicht»).
			`${anfang}, ${beleg}. Die Klausel wird nur beim einfachen Mehr angewandt, nach Köpfen ohne ` +
			'Wertquoten oder, wo das Reglement die Köpfe nicht zählt, nach Wertquoten allein. ' +
			'Der Entscheid wird eingetragen, mit dem ' +
			`Namen der entscheidenden Person. ${empfehlung}. ` +
			'Eine Annahme durch Stichentscheid lässt sich innert eines Monats beim Gericht anfechten, ' +
			'gerechnet ab der Versammlung. Wer weder da noch vertreten war, rechnet in der Regel ab Erhalt ' +
			'des Protokolls (ZGB Art. 712m Abs. 2 mit Art. 75).'
		);
	}
	return (
		`Bei Stimmengleichheit entscheidet die Anteilsberechtigung, ${beleg}. ` +
		'Das Gesetz kennt diesen Stichentscheid nicht; er gilt nur, soweit das Reglement ihn vorsieht.'
	);
}

/**
 * Die angewandte Zählweise samt ihrer Grundlage, in einem Satz.
 *
 * Steht im Kopf jeder Auswertung — auf dem Bildschirm wie im PDF. Ohne diesen
 * Satz nennt die Auswertung zwar Kopfstimmen und Schwellen, aber nicht, **wie**
 * die Köpfe gezählt wurden. Bei einer Anfechtung ist das die zweite Frage nach
 * dem Ergebnis, und ohne Antwort taugt das Papier nicht als Beleg: Dieselben
 * Stimmen ergeben je nach Zählweise Annahme oder Ablehnung.
 *
 * Fehlt bei der Zählung je Einheit die Fundstelle, sagt der Satz das ausdrücklich
 * statt sie wegzulassen. Eine benannte Lücke lässt sich vor der nächsten
 * Versammlung schliessen; eine verschwiegene fällt erst im Streitfall auf.
 */
export function zaehlweiseInWorten(
	modus: HeadCountMode,
	nebenobjekteZaehlen: boolean,
	fundstelle: string | null
): string {
	if (modus === 'per_owner') {
		return (
			'Gezählt wird eine Kopfstimme je Eigentümer — die gesetzliche Auffangregel ' +
			'(ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 1). Wer mehrere Einheiten besitzt, hat eine Stimme.'
		);
	}

	const beleg = fundstelle?.trim()
		? `gestützt auf ${mitQuelle(fundstelle)}`
		: 'ohne im System vermerkte Fundstelle im Reglement';

	return (
		`Gezählt wird eine Kopfstimme je Einheit, ${beleg}. Das weicht von der gesetzlichen ` +
		'Auffangregel ab und gilt nur, soweit das Reglement es vorsieht. ' +
		(nebenobjekteZaehlen
			? 'Nebenobjekte tragen dabei eine eigene Kopfstimme.'
			: 'Nebenobjekte tragen dabei keine Kopfstimme.')
	);
}

/**
 * Die Zählweise im Kopf von Protokoll und Auswertung (A5, Punkt 4): als die der
 * Gemeinschaft bezeichnet und mit der Ausnahme an der Einsprache, die nur bei
 * «je Einheit» vorkommt (`l3Wirkt`). Die Seite der Gemeinschaft nennt weiter
 * nur die Einstellung; dort gibt es weder Versammlung noch Traktandum.
 */
export function zaehlweiseImKopf(
	modus: HeadCountMode,
	nebenobjekteZaehlen: boolean,
	quelle: string | null
): string {
	const grund = `${zaehlweiseInWorten(modus, nebenobjekteZaehlen, quelle)} Das ist die Zählweise der Gemeinschaft an dieser Versammlung.`;
	return modus === 'per_unit'
		? `${grund} Nur an der Einsprache kann nach der Einstellung der Gemeinschaft eine andere gelten; die Zeile des Traktandums sagt es.`
		: grund;
}

/**
 * Zählt eine Ebene bei der Saldoprüfung mit?
 *
 * Eine Ebene mit Nenner null ist eine blosse Klammer — etwa die Dachgemeinschaft
 * einer Mehrhausanlage, deren Wertquoten vollständig bei den Untergemeinschaften
 * liegen. Sie als Sollebene zu werten, ergäbe eine Abweichung, die es nicht gibt.
 */
export function istSollebene(stweg: Pick<Stweg, 'quotaDenominator'>): boolean {
	return stweg.quotaDenominator > 0;
}

/**
 * Welche Angaben eine Gemeinschaft dieser Art überhaupt braucht.
 *
 * Gefragt am 12.08.2026: «Braucht es weniger Angaben, wenn es eine übergeordnete
 * Sammelbehälter ist? Die Angaben dient ja nur als Gruppierung. Da bräuchte es
 * nur Adresse und Bezeichnung und keine Angaben über WQ etc.»
 *
 * **Ja — und zwar nachprüfbar.** Eine blosse Klammer hat keine eigenen Einheiten,
 * also keine Eigentümer, also keine Stimmberechtigten. Eine Versammlung liesse
 * sich für sie nicht einmal freigeben: `pruefeFreigabe` hält mit «Es ist kein
 * Eigentümer erfasst. Die Momentaufnahme wäre leer.» an. Zählweise,
 * Stichentscheid, Vollmachtenschranke und KI-Freigabe wären Angaben zu einer
 * Abstimmung, die es dort nie gibt.
 *
 * **Warum das eine Regel ist und keine Anzeigefrage.** Was eine Klammer braucht,
 * hängt daran, was sie sein kann — nicht daran, wie ein Formular gerade aussieht.
 * Dieselbe Auskunft braucht später der Prüfbericht («welche Angaben fehlen dieser
 * Gemeinschaft?»), und zwei Stellen mit derselben Liste laufen auseinander.
 *
 * Die Anschrift bleibt in beiden Fällen: Die Klammer ist die Anlage, und deren
 * Adresse steht in der Einladung jeder Untergemeinschaft.
 */
export function gemeinschaftsfelder(istKlammer: boolean): {
	/** Wertquoten-Nenner und alles, was daran hängt. */
	wertquoten: boolean;
	/** Zählweise der Kopfstimme und der Stichentscheid. */
	abstimmung: boolean;
	vollmachten: boolean;
	ki: boolean;
} {
	return {
		wertquoten: !istKlammer,
		abstimmung: !istKlammer,
		vollmachten: !istKlammer,
		ki: !istKlammer
	};
}

/**
 * Ist diese Gemeinschaft eine blosse Klammer?
 *
 * Am Nenner erkannt und nicht an einem eigenen Merkmal: Es gibt kein zweites
 * Feld, das dasselbe sagt — und ein zweites Feld könnte dem ersten widersprechen.
 * Nenner 0 heisst «keine eigene Quote» (`istSollebene`), und genau das macht die
 * Klammer aus.
 */
export function istKlammer(stweg: Pick<Stweg, 'quotaDenominator'>): boolean {
	return stweg.quotaDenominator === 0;
}

/**
 * Prüft, ob eine Zuordnung als Untergemeinschaft einen Ring erzeugen würde.
 *
 * `vorfahren` ist die Kette von der Zielgemeinschaft aufwärts, ohne diese selbst.
 * Ein Ring wäre kein Anzeigefehler, sondern eine Endlosschleife bei jeder
 * Saldoprüfung und jeder Auszählung.
 */
export function erzeugtRing(eigeneId: Id, elternId: Id | null, vorfahren: Id[]): boolean {
	if (elternId === null) return false;
	if (elternId === eigeneId) return true;
	return vorfahren.includes(eigeneId);
}

export interface AngelegteGemeinschaft extends GemeinschaftEingabe {
	id: Id;
	operatorId: Id;
	/**
	 * Die Einberufungsfrist des Reglements in Tagen — `null` heisst: nicht
	 * hinterlegt (Migration 098).
	 *
	 * **Sie steht hier und nicht in `GemeinschaftEingabe`, mit Absicht.**
	 * Geschrieben wird sie ausschliesslich über `speichereEinberufungsfrist`
	 * unter «Reglement und Quoren». Stünde sie in der Eingabe, schriebe das
	 * Angabenformular sie bei jedem Speichern mit — und wer dort die Anschrift
	 * berichtigt, löschte die Frist, ohne ein Feld dafür gesehen zu haben.
	 * Dieselbe Klasse, gegen die das Formular seine versteckten Felder trägt.
	 */
	einberufungsfristTage?: number | null;
	/** Wo die Frist im Reglement steht. Pflicht, sobald eine Zahl dasteht. */
	einberufungsfristFundstelle?: string | null;
	/**
	 * Frist zur zweiten Versammlung nach Reglement, in Tagen (Migration 122).
	 *
	 * Aus demselben Grund hier und nicht in `GemeinschaftEingabe` wie die
	 * Einberufungsfrist darüber: Wer im Angabenformular die Anschrift
	 * berichtigt, löschte sie sonst mit.
	 *
	 * **`null` heisst nicht «keine Frist», sondern «nicht hinterlegt».** Dann
	 * gilt die gesetzliche von zehn Tagen, und die rechnet die Anwendung
	 * ohnehin. Ein Wert steht hier nur, wenn das Reglement **mehr** verlangt.
	 */
	zweitversammlungsfristTage?: number | null;
	/** Wo diese Frist im Reglement steht. Pflicht, sobald eine Zahl dasteht. */
	zweitversammlungsfristFundstelle?: string | null;
	/**
	 * Ob das Reglement für seine eigene Änderung Einstimmigkeit verlangt
	 * (Migration 101).
	 *
	 * Wie die Einberufungsfrist daneben: Sie steht hier und **nicht** in
	 * `GemeinschaftEingabe`, weil sie ausschliesslich über
	 * `speichereAenderungsschranke` geschrieben wird. Im Angabenformular stünde
	 * sie sonst bei jedem Speichern mit — und würde dort gelöscht.
	 */
	aenderungsschranke?: boolean;
	/** Wo die Schranke im Reglement steht. Pflicht, sobald sie gilt. */
	aenderungsschrankeFundstelle?: string | null;
	/**
	 * Wann über ein nicht angekündigtes Geschäft doch beschlossen werden darf
	 * (Migration 126, `domain/ausnahmen.ts`). Wie die Änderungsschranke nicht in
	 * `GemeinschaftEingabe`: geschrieben nur über `speichereAusnahmen`.
	 */
	ausnahmen?: AusnahmenNichtangekuendigtes;
	/**
	 * Wie ein zweiter Durchgang möglich wird, wenn die Versammlung erst
	 * nachträglich beschlussfähig wird (Migration 139,
	 * `domain/neuabstimmung.ts`).
	 *
	 * «direkt» (Vorgabe) lässt ohne Rückkommen neu abstimmen, «rueckkommen»
	 * verlangt wie bisher einen angenommenen Rückkommensantrag. Wie die
	 * Änderungsschranke nicht in `GemeinschaftEingabe`: geschrieben nur über
	 * `speichereNeuabstimmung`.
	 */
	neuabstimmungNachQuorum?: Neuabstimmungsart;
	/**
	 * Ob das Mehr eines Traktandums nach Ablauf der erfassten Einberufungsfrist
	 * noch milder gestellt werden kann (Migration 148, Produktentscheid
	 * 07.10.2026; `domain/einladungsmehr.ts`). Vorgabe `false`, «nicht
	 * zulassen». Wie die Änderungsschranke nicht in `GemeinschaftEingabe`:
	 * geschrieben nur über `speichereMilderungNachFrist`.
	 */
	milderungNachFrist?: boolean;
	/**
	 * Was das Reglement zur Höhe der Einlage in den Erneuerungsfonds sagt
	 * (Migration 193, `domain/fondsgrenze.ts`). `null` heisst: nicht
	 * hinterlegt. Wie die Änderungsschranke nicht in `GemeinschaftEingabe`:
	 * geschrieben nur über `speichereFondsgrenze`.
	 */
	fondsgrenze?: Fondsgrenze | null;
	/**
	 * Seit wann sie im Archiv liegt (Migration 086). Null heisst: in Auswahl und
	 * Suche wie jede andere.
	 */
	archiviertAm?: string | null;
	/** Warum — steht an der Zeile im Archiv, etwa «Mandat beendet per 31.12.2026». */
	archivnotiz?: string | null;
}

/**
 * Der Zustandsübergang: aus einer geprüften Eingabe wird eine Gemeinschaft, und
 * dabei entsteht ein Verlaufseintrag (AD-1).
 */
export function legeGemeinschaftAn(
	id: Id,
	operatorId: Id,
	eingabe: GemeinschaftEingabe,
	vorfahrenDesElternteils: Id[] = [],
	/**
	 * Ob gleich Gemeinschaften als Mitglieder aufgenommen werden; dann ist die
	 * Trägerschaft Pflicht (Ä-43). Der Server weiss es aus der Mitgliederwahl.
	 */
	mitHaeusern = false
): Uebergang<AngelegteGemeinschaft> {
	const geprueft = pruefeGemeinschaft(eingabe);
	verlangeTraegerschaft(geprueft, mitHaeusern);

	if (erzeugtRing(id, geprueft.parentStwegId, vorfahrenDesElternteils)) {
		throw new FachlicherFehler(
			'ring',
			'Eine Gemeinschaft kann sich nicht selbst übergeordnet sein.',
			'parentStwegId'
		);
	}

	const angelegt: AngelegteGemeinschaft = { ...geprueft, id, operatorId };

	return uebergang(
		angelegt,
		ereignis(
			EREIGNISARTEN.gemeinschaftAngelegt,
			{ art: 'stweg', id },
			{
				name: geprueft.name,
				nenner: geprueft.quotaDenominator,
				zaehlweise: geprueft.headCountMode,
				// Ausdrücklich festgehalten, worauf sich die Zählweise stützt. Im
				// Protokoll muss stehen, dass die Wahl bewusst geschah — und bei der
				// Zählung je Einheit, wo sie im Reglement steht.
				grundlage: grundlageDerZaehlweise(geprueft.headCountMode),
				fundstelle: geprueft.headCountRuleSource ?? null,
				...(geprueft.traegerschaft ? { traegerschaft: geprueft.traegerschaft } : {})
			}
		)
	);
}

/** Änderungsübergang. Hält fest, was sich geändert hat, nicht nur dass etwas geändert wurde. */
export function aendereGemeinschaft(
	bisher: AngelegteGemeinschaft,
	eingabe: GemeinschaftEingabe,
	vorfahrenDesElternteils: Id[] = [],
	/**
	 * Wie viele Einheiten diese Gemeinschaft trägt. Der Kern kann sie nicht
	 * zählen; der Server gibt sie mit — wie die Vorfahrenkette bei der Ringprüfung.
	 */
	anzahlEinheiten = 0,
	/**
	 * Ob Gemeinschaften Mitglied sind. Dann verlangt das Speichern die
	 * Trägerschaft, auch bei einer Anlage, die vor dem Feld entstand (Ä-43).
	 */
	mitHaeusern = false
): Uebergang<AngelegteGemeinschaft> {
	const geprueft = pruefeGemeinschaft(eingabe);
	verlangeTraegerschaft({ ...bisher, ...geprueft }, mitHaeusern);

	if (erzeugtRing(bisher.id, geprueft.parentStwegId, vorfahrenDesElternteils)) {
		throw new FachlicherFehler(
			'ring',
			'Eine Gemeinschaft kann sich nicht selbst übergeordnet sein.',
			'parentStwegId'
		);
	}

	/*
	 * **Eine Klammer hat keine eigenen Einheiten** — sonst hingen sie an einer
	 * Stammquote, die es nach dem Umstellen nicht mehr gibt.
	 *
	 * Die Datenbank weiss das auch: Der Auslöser `stweg_stammquote_mitfuehren`
	 * löscht die Stammquotenart bei Nenner null, und der Fremdschlüssel von
	 * `unit_quota` hält dagegen. Nur kam davon bis zum 12.08.2026 ein «500
	 * Internal Error» an — gemessen beim Umstellen einer Gemeinschaft mit einer
	 * Einheit. Eine Schranke der Datenbank ist keine Fehlermeldung
	 * (docs/gestaltung.md); sie braucht den Grund und einen Ausweg.
	 *
	 * Erreichbar war der Weg schon vorher, nur musste man den Nenner von Hand auf
	 * null setzen. Seit es dafür eine Wahl gibt, ist er einen Klick entfernt.
	 */
	if (geprueft.quotaDenominator === 0 && anzahlEinheiten > 0) {
		throw new FachlicherFehler(
			'klammer_mit_einheiten',
			`«${bisher.name}» trägt ${anzahlEinheiten} ${
				anzahlEinheiten === 1 ? 'Einheit' : 'Einheiten'
			} und kann deshalb nicht zur übergeordneten Gemeinschaft werden: Die Anteile hingen ` +
				'an einer Stammquote, die es dann nicht mehr gäbe. Verschieben Sie die Einheiten ' +
				'zuerst in eine untergeordnete Gemeinschaft oder entfernen Sie sie.',
			'quotaDenominator'
		);
	}

	const geaendert: AngelegteGemeinschaft = { ...bisher, ...geprueft };
	const felder: Record<string, { vorher: unknown; nachher: unknown }> = {};

	for (const feld of [
		'name',
		'strasse',
		'plz',
		'ort',
		'quotaDenominator',
		'headCountMode',
		'parkingCountsAsHead',
		'parentStwegId',
		'headCountRuleSource',
		// Seit dem 07.10.2026: Die Einstellung ändert, wie gezählt wird, und
		// gehört deshalb in den Verlauf wie die Zählweise.
		'abstentionExcluded',
		'abstentionExcludedSource',
		'traegerschaft'
	] as const) {
		if (bisher[feld] !== geaendert[feld]) {
			felder[feld] = { vorher: bisher[feld], nachher: geaendert[feld] };
		}
	}

	// Ein Verlaufseintrag ohne Änderung wäre Rauschen und würde die echten
	// Einträge unauffindbar machen.
	if (Object.keys(felder).length === 0) {
		return uebergang(geaendert);
	}

	return uebergang(
		geaendert,
		ereignis(EREIGNISARTEN.gemeinschaftGeaendert, { art: 'stweg', id: bisher.id }, { felder })
	);
}
