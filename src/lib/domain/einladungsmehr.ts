/**
 * Das Mehr aus der Einladung als Untergrenze.
 *
 * **Produktentscheid 27.09.2026** (`quellen`, `fragen.md`, Frage zum milderen
 * Mehr im Saal; `pruefung/berichte/2026-09-27-anwaltsfragen-empfehlung.md`,
 * Entscheid 3): «Eigentlich gelten die Quoren auf der Einladung. Nachträglich
 * Anpassung vor der Sitzung sind möglich, die Traktandenliste müsste aber
 * angepasst werden.» Dazu «passt für mich so» zum Vorschlag: Im Saal ist das
 * gedruckte Mehr die Untergrenze, strenger geht, milder nicht.
 *
 * **Produktentscheid 06.10.2026** zur Zeit zwischen Versand und Beginn
 * («Erlauben, Neuversand verlangen»): Votum übernimmt das mildere Mehr, es
 * gilt ab dann als Untergrenze, der Versandvermerk fällt zurück, und bis zum
 * neuen Versand steht ein Hinweis. Ist die Versandfrist hinterlegt und
 * abgelaufen, sagt Votum ab (seit 07.10.2026 nur, wo die Gemeinschaft es so
 * eingestellt hat; das ist die Vorgabe).
 *
 * **Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»** (Auftrag
 * `2026-10-07-votum-aufmerksam-statt-sperren.md`): «Grundsätzlich muss das
 * Tool nicht den Empfang sicherstellen sondern die Traktanden erstellen. [...]
 * Das Tool soll nur darauf aufmerksam machen.» Das mildere Mehr gilt, sobald
 * es vor Beginn gesetzt ist. Beim Eröffnen fällt es nicht mehr auf die erste
 * Einladung zurück; das nimmt «Erste Einladung gilt» vom 06.10.2026 zurück.
 * Der Haken «Die Einladung ist verschickt» steuert nur noch Hinweis,
 * Erinnerung und Verlauf; eine Milderung nimmt ihn weiterhin zurück. Vor der
 * Versammlung steht der Hinweis auf der Seite Vorbereitung, im Saal eine
 * stehende Warnung beim Traktandum (`saalhinweisNachMilderung`), und der
 * Verlauf hält beim Eröffnen fest, ob der Haken nach der Milderung gesetzt war.
 * Ob ein milderes Mehr nach Ablauf der erfassten Einberufungsfrist noch geht,
 * ist eine Einstellung der Gemeinschaft (Migration 148, Vorgabe «nicht
 * zulassen»).
 *
 * **Warum milder nicht geht.** Massgebend ist das Mehr nach Gesetz und
 * Reglement; die Einladung ändert es nicht. Sie begründet aber Vertrauen: Wer
 * wegen eines strengeren Mehrs in der Einladung fernbleibt, kann anfechten,
 * wenn sein Fernbleiben das Ergebnis beeinflussen konnte (in `quellen`
 * hergeleitet aus BGE 132 III 503 E. 5.3 und 5.4, BGer 5A_760/2011
 * E. 3.2.3.2; eine Folgerung, keine wörtliche Fundstelle). **Strenger muss
 * gehen**, weil eine zu mild gedruckte Einladung das gesetzliche Mehr nicht
 * senkt: Die Leitung muss es im Saal richtigstellen können.
 *
 * **Verglichen wird, was gezählt wird, nicht der Name.** Köpfe, Wertquoten
 * und Enthaltung über `vergleicheMasse`, dazu die Zustimmung der Betroffenen.
 * Ein «gemischtes» Mehr (in einer Hinsicht strenger, in einer anderen milder)
 * gilt als milder: Wer nur auf die mildere Hinsicht vertraut hat, ist genau
 * der, den die Untergrenze schützt.
 *
 * Rein: kein Zugriff auf Datenbank oder Uhr, der heutige Tag kommt herein.
 */
import { FachlicherFehler } from './fehler';
import {
	betroffeneStimmenNichtMit,
	erfordernisSteht,
	waehlbareErfordernisse,
	waehleErfordernis,
	type Erfordernis
} from './entscheidbaum';
import {
	vergleicheMasse,
	wendeReglementAn,
	type Enthaltungseinstellung,
	type Reglementsregel
} from './reglement';
import type { Regelwerk } from './regelwerk';
import type { Lesartenwahl } from './lesarten';
import { erfordernisInWorten } from './auszaehlung';
import { datumLang } from './datum';
import { postlage, VERANTWORTUNG } from './einberufungsfrist';
import {
	BERICHTIGTE_MIT_FOLGE,
	BERICHTIGTE_SOLLTE,
	postwegZuKnapp,
	warnungImSaal
} from './mailversand';
import type { Versammlungszustand } from './versammlung';
import type { Universalvariante } from './ausnahmen';

/** Ob ein Erfordernis ein Mehr trägt, nach dem sich zählen lässt. */
function zaehlbar(e: Erfordernis): e is Erfordernis & { kopfSchwelle: NonNullable<Erfordernis['kopfSchwelle']> } {
	return erfordernisSteht(e) && e.typ !== 'keine_abstimmung' && e.kopfSchwelle !== null;
}

/**
 * Was bei der Freigabe als Untergrenze festgehalten wird, oder `null`.
 *
 * Nur ein Mehr, das die Einladung auch nennt: Ein Traktandum ohne Erfordernis
 * oder mit Grenzfall druckt keines (`fusszeileZu` in
 * `server/pdf/traktandenliste.ts`), eine Kenntnisnahme ebenso wenig. Wo nichts
 * gedruckt ist, hat niemand auf etwas vertraut.
 */
export function untergrenzeBeiFreigabe(
	art: string,
	e: Erfordernis | null | undefined
): Erfordernis | null {
	if (art !== 'abstimmung' || !e) return null;
	return zaehlbar(e) ? e : null;
}

/**
 * Wie sich ein neu gewähltes Mehr zum gedruckten verhält.
 *
 * `gleich` und `strenger` sind zulässig; `milder` und `gemischt` unterschreiten
 * die Untergrenze.
 */
export function vergleicheMitEinladung(
	neu: Erfordernis,
	gedruckt: Erfordernis
): 'gleich' | 'strenger' | 'milder' | 'gemischt' {
	if (!zaehlbar(neu) || !zaehlbar(gedruckt)) return 'gemischt';

	const masse = vergleicheMasse(
		{
			kopfbasis: neu.kopfbasis,
			kopfSchwelle: neu.kopfSchwelle,
			quotenbasis: neu.quotenbasis,
			quotenSchwelle: neu.quotenSchwelle,
			// `undefined` heisst am Erfordernis «zählen mit» (siehe dort).
			enthaltungZaehltMit: neu.enthaltungZaehltMit !== false
		},
		{
			kopfbasis: gedruckt.kopfbasis,
			kopfSchwelle: gedruckt.kopfSchwelle,
			quotenbasis: gedruckt.quotenbasis,
			quotenSchwelle: gedruckt.quotenSchwelle,
			enthaltungZaehltMit: gedruckt.enthaltungZaehltMit !== false
		},
		// Beide ohne die Betroffenen gezählt (Ausschlussklage, Einsprache; Codeprüfung
		// M1, 19.10.2026): nur dann ist «die Anwesenden» eine Teilmenge von «alle
		// ausser den Betroffenen».
		betroffeneStimmenNichtMit(neu) && betroffeneStimmenNichtMit(gedruckt)
	);

	// Die Zustimmung der Betroffenen ist eine weitere Bedingung: Wer sie
	// zusätzlich verlangt, ist strenger, wer sie fallen lässt, milder.
	const betroffene =
		neu.zustimmungBetroffenerNoetig === gedruckt.zustimmungBetroffenerNoetig
			? 0
			: neu.zustimmungBetroffenerNoetig
				? 1
				: -1;

	if (betroffene === 0 || masse === 'gemischt') return masse;
	if (masse === 'gleich') return betroffene > 0 ? 'strenger' : 'milder';
	if ((masse === 'strenger') === betroffene > 0) return masse;
	return 'gemischt';
}

export interface Einladungslage {
	/** Die Untergrenze, wie sie jetzt steht; `null` ohne Untergrenze. */
	gedruckt: Erfordernis | null;
	/**
	 * Das Mehr der Einladung vor einer Milderung, nach der noch kein Versand
	 * vermerkt ist; sonst `null`. Daran misst sich der Rückweg.
	 */
	vorher: Erfordernis | null;
	neu: Erfordernis;
	zustand: Versammlungszustand;
	/** Heute, als ISO-Tag in hiesiger Zeit. */
	heute: string;
	/** Der letzte Versandtag nach Reglement, `null`, wo keine Frist hinterlegt ist. */
	versandfrist: string | null;
	/**
	 * Ob die Gemeinschaft ein milderes Mehr nach Ablauf der erfassten
	 * Einberufungsfrist zulässt (`stweg.relax_after_invitation_deadline`,
	 * Migration 148). Vorgabe `false`: Dann sagt `versandfrist_vorbei` ab.
	 */
	milderungNachFristZulassen: boolean;
	/** Wie das Traktandum in der Absage heisst, etwa «3 Fassadensanierung». */
	traktandum: string;
}

/**
 * Was eine Änderung des Mehrs gegenüber der Einladung bewirkt.
 *
 * - `frei`: keine Untergrenze berührt.
 * - `senken`: vor Beginn milder gewählt; die Untergrenze folgt dem neuen
 *   Mehr, und die Anwendung weist auf die berichtigte Einladung hin.
 * - `zurueck`: vor Beginn wieder auf das Mehr der Einladung oder strenger
 *   gestellt, bevor ein Versand vermerkt war. Die Untergrenze kehrt zurück,
 *   und es muss nichts neu hinaus.
 *
 * **Warum es den Rückweg braucht** (Laienprüfung 06.10.2026, T3-b). Ohne ihn
 * blieb nach einem Hin und Zurück die gesenkte Untergrenze stehen, samt
 * Hinweis. Wer dann den Versand vermerkte, ohne etwas zu verschicken, hätte im
 * Saal das mildere Mehr wählen können, obwohl alle nur die strengere
 * Einladung hatten.
 *
 * Im Saal wirft sie, nach abgelaufener Versandfrist nur, wo die Gemeinschaft
 * ein milderes Mehr dann nicht zulässt (`milderungNachFristZulassen`, Vorgabe).
 *
 * **Warum die Vorgabe absagt** (Produktentscheid 07.10.2026, Einstellung an
 * der Gemeinschaft). Die Einberufung ist empfangsbedürftig, die Frist ist nur
 * eingehalten, wenn die Einladung innert Frist angekommen ist (SVIT-Kommentar
 * Rz. 30 ad Art. 712n). Nach dem letzten Tag kann eine berichtigte Einladung
 * nicht mehr rechtzeitig ankommen. Das Recht verlangt die Absage nicht; eine zu
 * späte Einladung macht eher anfechtbar als nichtig (Rz. 66 und 68 ad
 * Art. 712n). Die Absage ist die sichere Lesart, die Gemeinschaft kann sie
 * abstellen. Ohne erfasste Frist hat die Einstellung keine Wirkung.
 */
export function folgeFuerEinladung(
	lage: Einladungslage
): { art: 'frei' } | { art: 'senken' } | { art: 'zurueck' } {
	const { gedruckt, neu } = lage;
	if (!gedruckt) return { art: 'frei' };
	// Ohne zählbares Mehr wird nicht abgestimmt (`erfordernisluecke`), und was
	// nicht abgestimmt wird, kann niemanden übergehen, der ferngeblieben ist.
	if (!zaehlbar(neu)) return { art: 'frei' };
	if (lage.zustand === 'entwurf') return { art: 'frei' };

	if (lage.zustand === 'freigegeben') {
		if (lage.vorher) {
			const r = vergleicheMitEinladung(neu, lage.vorher);
			if (r === 'gleich' || r === 'strenger') return { art: 'zurueck' };
		}
		const v = vergleicheMitEinladung(neu, gedruckt);
		// Ohne ausstehende Milderung lässt ein strengeres Mehr die Untergrenze
		// stehen. Mit einer folgt sie dem Mehr, das die berichtigte Einladung
		// nennen wird.
		if ((v === 'gleich' || v === 'strenger') && !lage.vorher) return { art: 'frei' };
		if (v === 'gleich') return { art: 'frei' };
		if (v !== 'strenger' && !lage.milderungNachFristZulassen) {
			pruefeVersandfrist(lage, lage.vorher ?? gedruckt);
		}
		return { art: 'senken' };
	}

	const v = vergleicheMitEinladung(neu, gedruckt);
	if (v === 'gleich' || v === 'strenger') return { art: 'frei' };
	throw new FachlicherFehler(
		'milder_als_einladung',
		milderImSaal(lage.traktandum, erfordernisInWorten(gedruckt)),
		'erfordernis'
	);
}

/**
 * Verlangt beim Öffnen einer Abstimmung, dass ihr Mehr nicht milder ist als
 * das der Einladung.
 *
 * **Warum auch dort und nicht nur beim Schreiben.** Dieselbe Prüfung fängt
 * jeden Weg, der das Mehr ohne die Schranke an der Schreibstelle setzt. Bis
 * 07.10.2026 fing sie dazu den Rückfall beim Eröffnen (Produktentscheid
 * 06.10.2026, «Erste Einladung gilt»), nach dem das Traktandum noch das
 * mildere Mehr trug. Den gibt es seit dem Produktentscheid 07.10.2026, «Nur
 * noch aufmerksam machen», nicht mehr, und mit ihm entfiel die eigene Absage
 * dafür.
 */
export function verlangeMehrDerEinladung(
	mehr: Erfordernis | null | undefined,
	gedruckt: Erfordernis | null,
	traktandum: string
): void {
	if (!gedruckt || !mehr || !zaehlbar(mehr)) return;
	const v = vergleicheMitEinladung(mehr, gedruckt);
	if (v === 'gleich' || v === 'strenger') return;
	throw new FachlicherFehler(
		'milder_als_einladung',
		milderImSaal(traktandum, erfordernisInWorten(gedruckt)),
		'erfordernis'
	);
}

/**
 * Ein Vorfahr eines Folgeantrags, vom direkten Elternteil nach oben gelesen.
 */
export interface Vorfahr {
	/** Ob die Zeile im Saal aufgenommen wurde (`is_spontaneous`). */
	spontan: boolean;
	/** `folgeantrag`, `neu` oder `rueckkommen`; `null` am angekündigten Traktandum. */
	spontanart: string | null;
	/** Das festgehaltene Mehr der Einladung (`released_requirement`), sonst `null`. */
	untergrenze: Erfordernis | null;
	/** Wie das Traktandum in der Absage heisst, etwa «3 Fassadensanierung». */
	bezeichnung: string;
}

/**
 * Das angekündigte Traktandum, unter dem ein Folgeantrag steht, samt dem Mehr,
 * das die Einladung dafür nennt (`untergrenze`; `null`, wo bei der Freigabe
 * keines eingestellt war). `null` ganz, wo es kein angekündigtes gibt.
 *
 * **Produktentscheid 06.10.2026, «Ja, dieselbe Untergrenze».** Ein Folgeantrag,
 * auch der Gegenantrag, hält dasselbe Mehr wie das angekündigte Traktandum:
 * gleich oder strenger geht, milder nicht. Wer im Vertrauen auf das gedruckte
 * Mehr ferngeblieben ist, hat auf den angekündigten Gegenstand vertraut
 * (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 3; SVIT-Kommentar Rz. 38 und 40 ad
 * Art. 712n), und ein Folgeantrag hält sich in dessen Kern (Migration 031).
 * Ohne diese Regel liesse sich die Untergrenze umgehen, indem dieselbe Sache
 * als Folgeantrag mit einfachem Mehr gestellt wird.
 *
 * **Gesucht wird nach oben, nur über Folgeanträge.** Beim Anlegen hängt ein
 * Folgeantrag immer direkt an einem angekündigten Traktandum
 * (`hindernisAlsGrundantrag`), die Datenbank verbietet eine Kette aber nicht
 * (`agenda_folgeantrag_hat_grundantrag`, Migration 031). Halt ist das erste
 * angekündigte Traktandum. Trifft die Suche vorher auf eine andere spontane
 * Art, gibt es keine Untergrenze: Ein neues Geschäft stand in keiner Einladung,
 * und das Rückkommen trägt sein eigenes Mehr (`erfordernisFuerRueckkommen`).
 */
export function untergrenzeDesFolgeantrags(
	kette: Vorfahr[]
): { untergrenze: Erfordernis | null; grundantrag: string } | null {
	for (const v of kette) {
		if (!v.spontan) return { untergrenze: v.untergrenze, grundantrag: v.bezeichnung };
		if (v.spontanart !== 'folgeantrag') return null;
	}
	return null;
}

/**
 * Verlangt, dass das Mehr eines Folgeantrags nicht milder ist als das, welches
 * die Einladung für sein angekündigtes Traktandum nennt
 * (`untergrenzeDesFolgeantrags`). Dieselbe Rechnung wie
 * `verlangeMehrDerEinladung`, mit einer Absage, die beide nennt.
 *
 * **Ohne die Zustimmung der Betroffenen** (Produktentscheid 06.10.2026, «Nur
 * wenn der Inhalt es verlangt»): Verglichen werden Köpfe, Wertquoten und
 * Enthaltungen. Ob der Folgeantrag die Zustimmung der Betroffenen braucht,
 * ergibt sich aus seinem Inhalt (ZGB Art. 712g Abs. 4; ebenso die Vetorechte
 * aus Art. 647d Abs. 2 und 3 und Art. 647e Abs. 2). Diese Zustimmungen
 * schützen den Berechtigten, nicht den Abwesenden (SVIT-Kommentar Rz. 208 und
 * 210 ad Art. 712g; zu den Vetorechten Rz. 208); wer der Versammlung im
 * Vertrauen auf die Einladung fernbleibt, verliert durch einen Folgeantrag ohne
 * Eingriff in ein Recht nichts.
 *
 * Einen Rückfall beim Eröffnen gibt es hier nicht: Folgeanträge entstehen erst
 * im Saal, und ab dann steht die Untergrenze fest.
 */
export function verlangeMehrDerEinladungImFolgeantrag(
	mehr: Erfordernis | null | undefined,
	gedruckt: Erfordernis | null,
	folgeantrag: string,
	grundantrag: string
): void {
	if (!gedruckt || haeltUntergrenzeImFolgeantrag(mehr, gedruckt)) return;
	throw new FachlicherFehler(
		'milder_als_einladung',
		milderImFolgeantrag(folgeantrag, grundantrag, erfordernisInWorten(gedruckt)),
		'erfordernis'
	);
}

/**
 * Ob ein Mehr die Untergrenze eines Folgeantrags hält: dieselbe Rechnung wie
 * `verlangeMehrDerEinladungImFolgeantrag`, ohne Absage. Ohne Untergrenze und
 * ohne zählbares Mehr hält es (abgestimmt wird unter einem solchen ohnehin
 * nicht, `erfordernisluecke`).
 */
export function haeltUntergrenzeImFolgeantrag(
	mehr: Erfordernis | null | undefined,
	gedruckt: Erfordernis | null
): boolean {
	if (!gedruckt || !mehr || !zaehlbar(mehr)) return true;
	const v = vergleicheMitEinladung(
		{ ...mehr, zustimmungBetroffenerNoetig: false },
		{ ...gedruckt, zustimmungBetroffenerNoetig: false }
	);
	return v === 'gleich' || v === 'strenger';
}

/**
 * Was das Aufnahmeformular vor dem Absenden über die Untergrenze wissen muss
 * (Laienprüfung R2-4, Codeprüfung M1 und Fachprüfung FP2-10 vom 06.10.2026).
 *
 * - `zuMild`: die Knoten der wählbaren Erfordernisse, die unter dieser
 *   Untergrenze abgewiesen würden, und zwar so, wie `setzeGewaehltesErfordernis`
 *   sie setzt: erst das Reglement angewandt, dann verglichen. Ein Vergleich
 *   nach dem Typ allein («schwächer») sagte bei gleicher Art aber anderer
 *   Reglementsregel das Falsche.
 * - `geerbtZuMild`: ob das Mehr, das der Grundantrag jetzt trägt, die
 *   Untergrenze nicht hält — bis 07.10.2026 für den Folgeantrag ohne Wahl,
 *   der es erbte; seit dem Produktentscheid 08.10.2026 erbt niemand mehr,
 *   das Feld wird nur noch gerechnet und getestet (Altbestand). Bis 07.10.2026
 *   geschah das nach einem Rückfall beim Eröffnen; seit dem Produktentscheid
 *   07.10.2026, «Nur noch aufmerksam machen», fällt nichts mehr zurück, und
 *   das Feld fängt nur noch ein Mehr, das an der Schreibstelle vorbei an den
 *   Grundantrag kam.
 */
export function grenzeFuerFolgeantrag(
	gedruckt: Erfordernis,
	geerbt: Erfordernis | null | undefined,
	rw: Regelwerk,
	regeln: Reglementsregel[],
	einstellung: Enthaltungseinstellung | null,
	lesarten: Lesartenwahl
): { zuMild: string[]; geerbtZuMild: boolean } {
	const zuMild = waehlbareErfordernisse(rw)
		.filter(
			(w) =>
				!haeltUntergrenzeImFolgeantrag(
					wendeReglementAn(waehleErfordernis(rw, w.knotenId).ergebnis, regeln, einstellung, lesarten)
						.erfordernis,
					gedruckt
				)
		)
		.map((w) => w.knotenId);
	return { zuMild, geerbtZuMild: !haeltUntergrenzeImFolgeantrag(geerbt, gedruckt) };
}

/**
 * Ob nach der letzten Milderung ein Versand vermerkt ist, also der Haken «Die
 * Einladung ist verschickt» nach ihr gesetzt wurde.
 *
 * **Jeder Haken nach der Milderung zählt** (Produktentscheid 07.10.2026, «Nur
 * noch aufmerksam machen»). Ob die berichtigte Einladung rechtzeitig war,
 * beurteilt die Anwendung nicht; der Haken steuert nur Hinweis, Rückweg,
 * Erinnerung und Verlauf. Bis 07.10.2026 hiess die Funktion `neuversandGilt`
 * und zählte einen Haken nur bis zum letzten Tag der erfassten Frist; ohne
 * gültigen Haken fiel das Eröffnen auf die erste Einladung zurück.
 *
 * **Vergleich der Zeitpunkte, nicht der Tage**, wie bisher bei
 * `nachDerMilderung`: Ein Haken am Morgen erledigt eine Milderung vom
 * Nachmittag nicht.
 */
export function neuversandVermerkt(lage: {
	/** Wann der Versand vermerkt wurde, `null` ohne Vermerk. */
	vermerkt: Date | null;
	/** Wann das Mehr zuletzt gemildert wurde. */
	gemildertAm: Date;
}): boolean {
	return lage.vermerkt !== null && lage.vermerkt >= lage.gemildertAm;
}

function pruefeVersandfrist(lage: Einladungslage, einladung: Erfordernis): void {
	if (!lage.versandfrist || lage.heute <= lage.versandfrist) return;
	throw new FachlicherFehler(
		'versandfrist_vorbei',
		versandfristVorbei(lage.traktandum, erfordernisInWorten(einladung), lage.versandfrist),
		'erfordernis'
	);
}

/*
 * **Die Sätze nach Laien- und Fachprüfung vom 06.10.2026**
 * (`quellen/pruefung/zu-pruefen-2026-10-06-votum-einladungsmehr.md`). Die
 * Absage im Saal nennt, worin ein Mehr milder sein kann (Laienprüfung T1-a),
 * und den sicheren Weg: Ist das gedruckte Mehr selbst in einem Punkt zu mild,
 * wäre es allein anfechtbar (Fachprüfung zu T1, Wermelinger Rz. 100 ad
 * Art. 712n). Die Frist zählt bis zum Empfang, nicht bis zum Versand (Rz. 30
 * ad Art. 712n).
 */
function milderImSaal(traktandum: string, alt: string): string {
	return (
		`«${traktandum}»: Die Einladung nennt ${alt}. Wählen Sie dieses Mehr oder ein ` +
		'strengeres; verlangen Gesetz oder Reglement in einem Punkt mehr als die Einladung, gilt ' +
		'das Strengere. Das gewählte Mehr ist in mindestens einem Punkt milder, etwa weil Köpfe, ' +
		'Wertquoten, Enthaltungen oder die Zustimmung der Betroffenen anders zählen. Im Saal darf ' +
		'das Mehr nur strenger werden: Wer wegen der Einladung nicht gekommen ist, könnte den ' +
		'Beschluss sonst anfechten. ' +
		SPAETER
	);
}

/*
 * **Die Absage am Folgeantrag, geändert nach der Laien- und Fachprüfung Runde
 * 4 vom 06.10.2026**
 * (`quellen/pruefung/zu-pruefen-2026-10-06-votum-einladungsmehr-folgeantrag-runde4.md`);
 * die fünfte Prüfung folgt. **Kein Satz über 180 Zeichen** (Codeprüfung N1,
 * Runde 4): `check:texte` liest Rückgaben aus Funktionen nicht, die Länge ist
 * deshalb von Hand gemessen; geteilt wurde an Semikolon und Doppelpunkt. Seit Runde 4 sagt sie auch, was gilt,
 * wenn weder zurückgezogen noch verschoben wird (das Mehr der Einladung), und
 * wo der Rückzug beim aufgerufenen Antrag steht («Jetzt möglich»). Sie hat einen eigenen Wortlaut statt des Rests der
 * Absage am Traktandum:
 *
 * - Die Zustimmung der Betroffenen wird hier nicht verglichen
 *   (Produktentscheid 06.10.2026, «Nur wenn der Inhalt es verlangt»), also
 *   nennt der Satz sie auch nicht als Grund.
 * - **Was nur eine Regel der Anwendung ist, heisst so** (Fachprüfung FP3-3):
 *   «die Anwendung verlangt», «lässt nicht zu», nicht «gilt» oder «darf». Dass
 *   die Untergrenze des angekündigten Traktandums auch den Folgeantrag bindet,
 *   ist ein Produktentscheid, keine Rechtslage.
 * - Der Ausweg: Der Antrag kommt mit voller Frist an eine weitere Versammlung,
 *   wenn die Antragstellerin ihn zurückzieht oder die Versammlung ihn
 *   verschiebt (Ordnungsantrag mit einfachem Mehr, SVIT-Kommentar Rz. 98a ad
 *   Art. 712n; zum Mehr, das der Vorsitz bestimmt, Rz. 99 ad Art. 712n). Dass
 *   der Rückzug ein Recht der Antragstellerin ist, ist eine Folgerung; der
 *   Kommentar schweigt dazu. Festgehalten wird es mit «Antrag zurückziehen»
 *   und dem Grund, der sagt, was geschah, wie nach einem Ordnungsbeschluss
 *   beim Rückkommen.
 * - Wird der Grundantrag heute angenommen, führt die Verwaltung ihn aus
 *   (ZGB Art. 712s Abs. 1); eine weitere Versammlung kann ihn nur ändern,
 *   solange er nicht ausgeführt ist (Rz. 202a ad Art. 712g), ein
 *   Nutzungsrecht nur mit Zustimmung dessen, der es dann hat (Art. 712g
 *   Abs. 4).
 */
function milderImFolgeantrag(folgeantrag: string, grundantrag: string, alt: string): string {
	return (
		`«${folgeantrag}» ist ein Folge- oder Gegenantrag zu «${grundantrag}» und betrifft ` +
		`denselben Gegenstand. Für «${grundantrag}» nennt die Einladung ${alt}. Die Anwendung ` +
		'verlangt dieses Mehr deshalb auch für ihn. Wählen Sie dieses Mehr oder ein strengeres; verlangen ' +
		'Gesetz oder Reglement in einem Punkt mehr als die Einladung, gilt das Strengere. Das ' +
		'gewählte Mehr ist in mindestens einem Punkt milder, etwa weil Köpfe, Wertquoten oder ' +
		'Enthaltungen anders zählen. Ein milderes Mehr lässt die Anwendung im Saal nicht zu: Wer ' +
		'wegen der Einladung nicht gekommen ist, könnte einen so gefassten Beschluss anfechten. ' +
		'Soll das mildere Mehr gelten, kommt der Antrag heute nicht zur Abstimmung, sondern mit ' +
		'voller Frist als eigenes Traktandum in die Einladung zu einer weiteren Versammlung. Das ' +
		'kann auch eine ausserordentliche sein. Möglich ist das, wenn die Antragstellerin ihn ' +
		'zurückzieht ' +
		'oder die Versammlung ihn verschiebt: als Ordnungsantrag mit einfachem Mehr, per ' +
		'Handzeichen, mit den Zahlen im Votenfeld. Geschieht beides nicht, lassen Sie heute mit ' +
		'dem Mehr der Einladung abstimmen; ein milderes setzt die Anwendung nicht. Halten Sie ' +
		'Rückzug oder Verschiebung in der Leitung der Versammlung fest, am gemeinsamen Abend in der ' +
		'Leitung der Gemeinschaft (unter «Es tagen mit»). Dort steht dafür «Antrag zurückziehen» ' +
		'in seiner Zeile oder, wenn er gerade aufgerufen ist, «Zurückziehen» unter «Jetzt ' +
		'möglich». ' +
		'Schreiben Sie als Grund, was geschah, etwa «von der Versammlung verschoben an …»; dass ' +
		'die Antragstellerin ihn zurückgezogen hat, nur, wenn sie es tat. Heute nicht abgestimmt ' +
		'wird dann nur ' +
		`über diesen Antrag; über «${grundantrag}» stimmen Sie wie geplant ab. Wird ` +
		`«${grundantrag}» heute angenommen, führt die Verwaltung ihn aus. Die weitere Versammlung ` +
		'kann ihn mit dem Folgeantrag nur noch ändern, solange er nicht ausgeführt ist, und ein ' +
		'Nutzungsrecht nur mit Zustimmung dessen, der es dann hat. Soll die Versammlung beide ' +
		'zusammen entscheiden, kann sie das ganze Traktandum verschieben. Das ist ein ' +
		'Ordnungsantrag mit einfachem Mehr, per Handzeichen, festgehalten im Votenfeld des ' +
		'Traktandums.'
	);
}

/**
 * Der Ausweg, wenn das mildere Mehr gelten soll (Fachprüfung zu T1, zweiter
 * Durchgang). Geändert nach Fachprüfung Teil 2 Runde 3 (F1), 06.10.2026: Ein
 * verlangtes Traktandum verschiebt nicht die Leitung allein, darüber entscheidet
 * die Versammlung (SVIT-Kommentar Rz. 98a ad Art. 712n).
 */
const SPAETER =
	'Soll das mildere Mehr gelten, stimmen Sie heute nicht darüber ab und laden mit voller ' +
	'Frist zu einer weiteren Versammlung ein; das kann auch eine ausserordentliche sein. Hat ' +
	'jemand das Traktandum verlangt, entscheidet über die Verschiebung die Versammlung ' +
	// Laienprüfung L2, Nachtrag: was gilt, wenn sie ablehnt (wie «Geschieht
	// beides nicht …» in `milderImFolgeantrag`).
	'(Ordnungsantrag, in der Regel einfaches Mehr). Lehnt sie die Verschiebung ab, lassen Sie ' +
	'heute mit dem Mehr der Einladung abstimmen.';

/*
 * **Wer über die Verschiebung eines verlangten Traktandums entscheidet, und was
 * gilt, wenn sie abgelehnt wird** (Laienprüfung Runde 1, Bestand, Abschnitt
 * «Offen» des Prüfberichts Hinweise lesbar, 06.10.2026). «Hat es jemand
 * verlangt, entscheidet darüber die Versammlung» liess offen, worauf sich «es»
 * und «darüber» beziehen und was bis dahin gilt. Der Wortlaut folgt `SPAETER`
 * und der Erinnerungsmail nach Fristablauf (`textNachMilderung`), die den
 * Bezug schon ausschreiben; der Folgesatz wie in `SPAETER`, nur «an der
 * Versammlung» statt «heute», weil Absage und Hinweis vor Beginn kommen.
 * Zwei Sätze, je unter 180 Zeichen.
 */
const VERLANGT_EINZAHL =
	'Hat jemand das Traktandum verlangt, entscheidet über die Verschiebung die Versammlung ' +
	'(Ordnungsantrag, in der Regel einfaches Mehr). Lehnt sie die Verschiebung ab, lassen Sie ' +
	'an der Versammlung mit dem Mehr der Einladung abstimmen.';
/*
 * Die Fassung in der Mehrzahl stand bis 07.10.2026 im Hinweis nach Fristablauf
 * (`neuversandHinweis`) und ist seit der Laienprüfung Runde 1 «aufmerksam statt
 * sperren» (Punkt 2) wieder dort: Die Seite nennt denselben sicheren Weg wie
 * Mail und Absage, weil sie ohne Mail genügen muss. Wortlaut wie in der Mail
 * (`textNachMilderung`).
 */
const VERLANGT_MEHRZAHL =
	'Hat jemand eines davon verlangt, entscheidet über dessen Verschiebung die Versammlung ' +
	'(Ordnungsantrag, in der Regel einfaches Mehr). Lehnt sie die Verschiebung ab, lassen Sie ' +
	'über dieses Traktandum an der Versammlung mit dem Mehr der Einladung abstimmen.';

/*
 * **Neu gefasst nach dem Produktentscheid 07.10.2026** («Nur noch aufmerksam
 * machen», Einstellung an der Gemeinschaft): Die Absage verlangt keinen Empfang
 * und keinen Nachweis mehr («Die Anwendung verlangt dafür, dass sie spätestens
 * am letzten Tag … bei allen ist» fiel weg). Sie sagt, warum die Vorgabe
 * absagt (nach dem letzten Tag kann eine berichtigte Einladung nicht mehr
 * rechtzeitig ankommen; Rz. 30 ad Art. 712n), dass das eine Regel der
 * Anwendung ist, und wo die Gemeinschaft sie umstellt. Das Datum steht einmal
 * («spätestens», nicht «innert», Laienprüfung zum Nachtrag 06.10.2026, gilt
 * weiter). «Die Einladung nennt» bleibt vorn: `absageAmAbend` in
 * `geschaeft.ts` fasst die Absagen mehrerer Häuser daran zusammen.
 */
function versandfristVorbei(traktandum: string, alt: string, frist: string): string {
	return (
		`«${traktandum}»: Die Einladung nennt ${alt}. ` +
		`Der letzte Tag der erfassten Einberufungsfrist war der ${datumLang(frist)}. Eine ` +
		/*
		 * **An alle, die eingeladen werden, nicht nur die Eigentümer** (Fachprüfung
		 * 5, Codeprüfung N1, Korrekturrunde 06.10.2026; Rz. 56, 58 ad Art. 712n):
		 * auch Nutzniesser und Wohnberechtigte. «Ihrer Gemeinschaft», nicht
		 * «dieser» (Laienprüfung Runde 3, L1): Am Abend steht der Satz auch nach
		 * mehreren Häusern, und «ihrer» trägt in Einzahl und Mehrzahl. **«Die erfasste Einberufungsfrist»**
		 * statt «Ihres Reglements» (Codeprüfung M1): Erfasst sein kann auch der
		 * Rat von zehn Tagen. Die Fundstelle kennt dieser Satz nicht; sie stünde
		 * nur über `Einladungslage` und den Serverteil zur Verfügung.
		 */
		'berichtigte Einladung an alle, die zur Versammlung ihrer Gemeinschaft eingeladen werden, ' +
		// «nach der erfassten Einberufungsfrist» (Fachprüfung B4, Runde 1 «aufmerksam
		// statt sperren», 07.10.2026): «rechtzeitig» hängt an der erfassten Frist.
		'kann jetzt nach der erfassten Einberufungsfrist nicht mehr rechtzeitig ankommen. ' +
		'Ein Beschluss mit dem milderen Mehr könnte deshalb angefochten werden. ' +
		'Darum lässt die Anwendung ein milderes Mehr nach diesem Tag nicht zu; so ist es für die ' +
		'Gemeinschaft unter «Reglement und Quoren» eingestellt. ' +
		// Laienprüfung Runde 1, Punkt 9: dass sich das ändern lässt und das Risiko bleibt.
		'Dort lässt sich das ändern; das Anfechtungsrisiko bleibt dann bestehen. ' +
		// Laienprüfung Runde 2, N6, 07.10.2026: was ohne und was nach dem Umstellen
		// gilt. Bis dahin «Es bleibt beim Mehr der Einladung oder einem strengeren.»
		'Ohne Umstellen bleibt es beim Mehr der Einladung oder einem strengeren; nach dem ' +
		'Umstellen setzen Sie das mildere Mehr hier neu. ' +
		// Mit Bedingung (Fachprüfung B3, Korrekturrunde 06.10.2026): Ein
		// verlangtes Traktandum verschiebt nicht die Leitung allein.
		'Für das mildere verschieben Sie sonst das Traktandum und laden mit voller Frist neu ' +
		'ein. ' +
		VERLANGT_EINZAHL
	);
}

/**
 * Der Hinweis auf der Seite Vorbereitung, solange nach einer Milderung kein
 * Versand vermerkt ist, oder `null`.
 *
 * **Neu geschrieben nach dem Produktentscheid 07.10.2026, «Nur noch
 * aufmerksam machen».** Die Anwendung nimmt das mildere Mehr, sobald es
 * gesetzt ist; der Hinweis macht nur aufmerksam, dass dafür eine berichtigte
 * Einladung an alle gehen sollte, und dass für Versandweg und Zeitpunkt sorgt,
 * wer einlädt (`VERANTWORTUNG`, Runde 1 vom 07.10.2026). Bis 07.10.2026 sagte er, ohne rechtzeitigen Haken
 * nehme die Anwendung beim Eröffnen wieder das Mehr der bisherigen Einladung,
 * und ein Haken nach dem letzten Fristtag zähle nicht; beides gilt nicht mehr.
 *
 * **Drei Lagen, je nur die Sätze, die dort stimmen**: ohne erfasste Frist (mit
 * der Regel von zehn Tagen und dem Rat, die Frist zu erfassen), Frist läuft
 * (mit Datum und Postsatz, `postlage`) und Frist vorbei (nicht mehr
 * rechtzeitig, anfechtbar). Bleiben aus dem Bestand: das Datum statt «innert
 * der Frist Ihres Reglements» (Laienprüfung 06.10.2026, T3-a), der Rückweg mit
 * den Klicks (Produktentscheid 06.10.2026, «Verweis einbauen»), Einzahl und
 * Mehrzahl, und im Rückweg der Satz zum Haken vor dem Satz, dass der Hinweis
 * entfällt (Laienprüfung Restpunkte Runde 1, B6).
 *
 * **«Die Anwendung nimmt», nicht «gilt»** beim Mehr (Fachprüfung B6,
 * Korrekturrunde 06.10.2026, gilt weiter): Dass das mildere Mehr ohne Haken
 * zählt, ist die Regel der Anwendung, keine Rechtslage.
 *
 * Die Blöcke trennt ein Zeilenumbruch; die Seite Vorbereitung zeigt ihn
 * (`white-space: pre-line` an `.neuversand`).
 */
export function neuversandHinweis(
	gemildert: { traktandum: string }[],
	frist: { versandfrist: string | null; heute: string }
): string | null {
	if (gemildert.length === 0) return null;
	const namen = gemildert.map((g) => `«${g.traktandum}»`).join(', ');
	const einzahl = gemildert.length === 1;
	const lage =
		`Seit der Freigabe ist das Mehr ${einzahl ? 'eines Traktandums' : 'mehrerer Traktanden'} ` +
		`milder geworden: ${namen}. Eine Einladung, die schon verschickt ist, nennt noch das ` +
		// Als Empfehlung (Fachprüfung B5, Runde 1, 07.10.2026; bis dahin «braucht
		// es»), vor Fristablauf und ohne Frist mit der Folge (Produktentscheid
		// 07.10.2026 «1a»); nach Fristablauf folgt ein eigener, bedingter Satz.
		'strengere. ' +
		(frist.versandfrist && frist.heute > frist.versandfrist
			? BERICHTIGTE_SOLLTE
			: BERICHTIGTE_MIT_FOLGE) +
		' ';

	let wann: string;
	if (!frist.versandfrist) {
		wann =
			'Schicken Sie sie so, dass sie rechtzeitig bei allen ist, in der Regel mindestens zehn ' +
			'Tage vor der Versammlung. ' +
			VERANTWORTUNG;
	} else if (frist.heute > frist.versandfrist) {
		/*
		 * **Bedingt, weil die Anwendung den Versand nicht kennt** (Fachprüfung B1,
		 * Runde 1 «aufmerksam statt sperren», 07.10.2026): Ohne Haken kann die
		 * berichtigte Einladung trotzdem rechtzeitig hinausgegangen sein. Was der
		 * späte Versand bringt und was nicht (Laienprüfung Punkt 1), und derselbe
		 * sichere Weg wie Mail und Absage (Laienprüfung Punkt 2): Die Seite muss
		 * ohne Mail genügen. Bis zur Runde 1 hiess es unbedingt «kann jetzt nicht
		 * mehr rechtzeitig ankommen».
		 */
		const tag = datumLang(frist.versandfrist);
		/*
		 * **Die drei Wege je auf einer eigenen Zeile** (Laienprüfung Runde 2, N5,
		 * 07.10.2026; `white-space: pre-line` an `.neuversand`), der erste als
		 * Bedingung. Bis dahin in einem Absatz mit «Schicken Sie sie trotzdem,
		 * wissen alle …».
		 */
		wann =
			`Der letzte Tag der erfassten Einberufungsfrist war der ${tag}. Ist die berichtigte ` +
			'Einladung noch nicht verschickt, kommt sie nach dieser Frist nicht mehr rechtzeitig an. ' +
			`War sie am ${tag} nicht bei allen, kann ein Beschluss mit dem milderen Mehr angefochten ` +
			`werden. ${VERANTWORTUNG}\n` +
			'Wenn Sie sie trotzdem schicken, wissen alle vom milderen Mehr; das Anfechtungsrisiko ' +
			'bleibt.\n' +
			(einzahl
				? 'Der sichere Weg: Verschieben Sie das Traktandum und laden Sie mit voller Frist neu ein. ' +
					VERLANGT_EINZAHL
				: 'Der sichere Weg: Verschieben Sie die betroffenen Traktanden und laden Sie mit voller ' +
					'Frist neu ein. ' +
					VERLANGT_MEHRZAHL) +
			'\nOder bleiben Sie beim Mehr der Einladung; wie, steht unten.';
	} else {
		/*
		 * **Wenn die Post nicht mehr reicht, sagt der Hinweis das** (Codeprüfung
		 * N2, Nachtrag), nach derselben Regel und mit derselben Aussage wie die
		 * Erinnerungsmail (`postlage`, `textNachMilderung`).
		 */
		const postlageHeute = postlage(frist.heute, frist.versandfrist);
		wann =
			`Schicken Sie sie so, dass sie spätestens am ${datumLang(frist.versandfrist)} bei ` +
			'allen ist. ' +
			(postlageHeute ? postwegZuKnapp(postlageHeute) + ' ' : 'Rechnen Sie den Postweg ein. ') +
			VERANTWORTUNG;
	}

	/*
	 * **Was der Haken wegnimmt und was nicht** (Laienprüfung Runde 1, Punkte 1
	 * und 3, 07.10.2026): nur diesen Hinweis und die Erinnerungsmail; die
	 * Warnung im Saal rechnet am Mehr (`warntImSaal`). Bis dahin «im Saal steht
	 * der Hinweis noch einmal».
	 */
	const haken =
		'Setzen Sie unten den Haken «Die Einladung ist verschickt», sobald sie verschickt ist. ' +
		'Der Haken nimmt nur diesen Hinweis und die Erinnerungsmail weg. Die Anwendung nimmt das ' +
		'mildere Mehr auch ohne Haken. ' +
		warnungImSaal(einzahl);

	/*
	 * **In der Mehrzahl jedes Traktandum** (Laienprüfung Teil 2 Runde 3, Punkt 4):
	 * Der Hinweis entfällt erst, wenn alle zurückgestellt sind. Das Mehr, nicht
	 * das Traktandum, wird zurückgestellt (Laienprüfung Nachtrag 2).
	 */
	const klicks = einzahl
		? 'Klicken Sie in der Traktandenliste auf das Traktandum und dann auf «Erfordernis ändern». '
		: 'Klicken Sie in der Traktandenliste auf jedes betroffene Traktandum und dann auf ' +
			'«Erfordernis ändern». ';
	/*
	 * **Erst die Klicks, dann der Haken, erst danach «entfällt»** (Laienprüfung
	 * Restpunkte Runde 1, B6, Codeprüfung G2, 06.10.2026, gilt weiter): Mit dem
	 * Zurückstellen verschwindet der Hinweis und mit ihm die Anleitung. Der
	 * Haken-Satz sagt seit dem Produktentscheid 07.10.2026 «verschickt» statt
	 * «bei allen».
	 */
	const hakenNachRueckweg =
		`Haben Sie das Mehr ${einzahl ? '' : 'überall '}zurückgestellt, setzen Sie den Haken ` +
		'unten; er gilt dann für die bisherige Einladung. Setzen Sie ihn, sobald sie verschickt ' +
		'ist; ist sie das schon, gleich. ';
	const entfaellt = einzahl
		? 'Mit dem Zurückstellen entfällt dieser Hinweis; das Kästchen für den Haken bleibt ' +
			'unten stehen.'
		: 'Ist das Mehr bei allen betroffenen Traktanden zurückgestellt, entfällt dieser ' +
			'Hinweis; das Kästchen für den Haken bleibt unten stehen.';
	const rueckweg =
		'Wollen Sie beim Mehr der Einladung bleiben, stellen Sie es zurück: ' +
		klicks +
		hakenNachRueckweg +
		entfaellt;

	const bloecke = [lage + wann, haken, rueckweg];
	/*
	 * **Der Rat zum Erfassen kurz und zum Schluss** (Produktentscheide
	 * 06.10.2026, «Hinweis, zehn Tage zu erfassen» und «Kürzen und umstellen»):
	 * nur, wo nichts erfasst ist. Die Einzelheiten (Ausland, Feriengemeinschaft)
	 * stehen auf der Seite «Reglement und Quoren»; «zehn Tage» nennt der
	 * Hinweis oben schon.
	 */
	if (!frist.versandfrist) {
		bloecke.push(
			'Für diese Gemeinschaft ist keine Einberufungsfrist erfasst. Erfassen Sie sie unter ' +
				'«Reglement und Quoren»; dann nennt dieser Hinweis den letzten Tag.'
		);
	}
	return bloecke.join('\n');
}

/**
 * Die stehende Warnung im Saal beim Traktandum, dessen Mehr nach der Freigabe
 * milder gestellt wurde (Produktentscheid 07.10.2026, «Nur noch aufmerksam
 * machen», Punkt 4a: in der Leitung beim Traktandum, dazu ein Verlaufseintrag
 * beim Eröffnen; nichts ins Protokoll).
 *
 * Die Angaben kommen aus dem Verlaufseintrag beim Eröffnen
 * (`einladungsmehrBeimEroeffnen`): das Mehr der Einladung davor, wo es bekannt
 * ist, und der Tag des Hakens nach der Milderung, `null` ohne Haken.
 *
 * **Die Anwendung prüft den Empfang nicht und sagt das.** Ob eine zu späte
 * Einladung den Beschluss anfechtbar macht, hängt am Einzelfall; der Satz
 * sagt deshalb «kann angefochten werden». Strenger geht im Saal immer
 * (Produktentscheid 27.09.2026), milder nicht.
 */
export function saalhinweisNachMilderung(eintrag: {
	einladungDavor: string | null;
	vermerktAm: string | null;
	/**
	 * Die Einstellung der Gemeinschaft zur Universalversammlung, wie sie bei der
	 * Freigabe festgehalten wurde (`snapshot.universal_meeting_mode`, Migration
	 * 127); daran richtet sich der Satz zur Anwesenheit (`anwesenheitImSaal`).
	 */
	universalvariante: Universalvariante;
	/**
	 * Ob Vollmachten der Leitung oder der Verwaltung dafür zählen
	 * (`snapshot.universal_chair_proxies_count`, Migration 127; wie
	 * `leitungsvollmachtenZaehlen` bei der Universalversammlung). Nur bei
	 * «vertreten» von Belang; ohne Angabe die Vorgabe `false`.
	 */
	leitungsvollmachtenZaehlen?: boolean;
}): string {
	/*
	 * **Nach Laien- und Fachprüfung Runde 1, 07.10.2026** (Laien 4, Fach B3, B5):
	 * «die Einladung vor der Milderung» statt «davor»; ohne bekanntes Mehr, wo es
	 * steht (gedruckte Einladung, Verlauf beim Eintrag der Milderung); die
	 * berichtigte Einladung als Empfehlung; die Handlung, mit der die Warnung
	 * entfällt, statt «Ein strengeres Mehr können Sie hier jederzeit setzen».
	 * Kein Satz, der zur Abstimmung über das Mehr einlädt: Das Mehr bestimmt der
	 * Vorsitz (SVIT-Kommentar Rz. 99 ad Art. 712n).
	 *
	 * **Alle anwesend, niemand widerspricht** (Fachprüfung B3; Rz. 28, 69a, 70
	 * ad Art. 712n): Dann ist eine Anfechtung wegen der Einberufung kaum mehr
	 * möglich. Die Stelle spricht von Anwesenden; ob Vertretung genügt, sagt sie
	 * nicht, also sagt der Satz es auch nicht.
	 */
	/*
	 * **Lage und Ausweg zuerst, dann die Ansage, dann der Hintergrund**
	 * (Produktentscheid 07.10.2026 «2a», auf Fachprüfung Runde 2, R2-1, und
	 * Laienprüfung N2, N3). Wer beim milderen Mehr bleibt, sagt es vor der
	 * Abstimmung an: Erst dann können Anwesende Einwand erheben (Rz. 28, 69a,
	 * 70 ad Art. 712n). Ob Vertretene als anwesend zählen, sagt die Stelle nicht;
	 * seit dem Produktentscheid 07.10.2026 zu Fassung 2 richtet sich der Satz
	 * nach der Einstellung zur Universalversammlung (`anwesenheitImSaal`), bis
	 * dahin hiess es für alle «Ob Vertretene dafür als anwesend zählen, ist nicht
	 * geklärt.». «Fehlen Eigentümer, besteht das Risiko vor allem
	 * ihnen gegenüber» entfiel als das Kürzere.
	 */
	return (
		'Das Mehr dieses Traktandums ist seit der Freigabe milder als in der Einladung vor der ' +
		'Milderung. ' +
		(eintrag.einladungDavor
			? `Diese nannte ${eintrag.einladungDavor}. `
			: 'Welches Mehr sie nannte, steht in der gedruckten Einladung und im Verlauf der ' +
				'Versammlung. ') +
		// Mit Bedingung (Produktentscheid 07.10.2026 «a», auf Laien- und
		// Fachprüfung Runde 3, R3-1); bis dahin unbedingt «Ein Beschluss mit diesem
		// Mehr kann angefochten werden.» und hinten «Ob sie rechtzeitig …».
		'War die berichtigte Einladung nicht rechtzeitig bei allen, kann ein Beschluss mit diesem ' +
		'Mehr angefochten werden; ob sie es war, prüft die Anwendung nicht. ' +
		'Stellen Sie das Mehr auf das der Einladung vor der Milderung oder strenger, entfällt diese ' +
		'Warnung. ' +
		'Bleiben Sie beim milderen, sagen Sie vor der Abstimmung an, dass das Mehr milder ist als in ' +
		'der Einladung. ' +
		anwesenheitImSaal(eintrag.universalvariante, eintrag.leitungsvollmachtenZaehlen ?? false) +
		' ' +
		// Hintergrund in der Vergangenheit (R3-1): Im Saal ist der Versand vorbei.
		'Für das mildere Mehr hätte eine berichtigte Einladung an alle gehen sollen. ' +
		(eintrag.vermerktAm
			? `Nach der Milderung als verschickt vermerkt am ${datumLang(eintrag.vermerktAm)}.`
			: 'Nach der Milderung ist nicht vermerkt, dass sie verschickt ist.')
	);
}

/*
 * **Der Satz zur Anwesenheit folgt der Einstellung zur Universalversammlung**
 * (Produktentscheid 07.10.2026 «Ja» zu Fassung 2,
 * `quellen/pruefung/zu-pruefen-2026-10-07-votum-vertretene-saal.md`). Ob
 * Vertretene für den Verzicht auf die Rüge zählen, sagt der SVIT-Kommentar
 * nicht (Rz. 28 ad Art. 712n spricht nur von «anwesend»); im Aktienrecht zählen
 * sie (Art. 701 Abs. 1 OR; Onlinekommentar zu Art. 701 OR, N 2, 12 und 26), und
 * Rz. 5a ad Art. 712m warnt vor unbesehener Übernahme. Dieselbe Frage hängt
 * schon an der Einstellung, also eine Lesart im ganzen Werkzeug.
 *
 * - «persoenlich» (Vorgabe): Vertretene zählen nicht, nach der Einstellung.
 * - «vertreten»: mit einer Vollmacht für dieses Traktandum. Für den Verzicht
 *   genügt eine für das angekündigte Traktandum; die strengere Regel der
 *   Universalversammlung (Vollmacht auch für nicht Angekündigtes) gilt hier
 *   nicht (Fachprüfung F1: Rz. 26 ad Art. 712m, Rz. 24 ad Art. 712o, Brugger
 *   N 26, 27; eine Folgerung). Nicht entschieden, und der Satz sagt das.
 * - «keine»: im Ergebnis wie «persoenlich», aber nicht «nach der Einstellung»
 *   begründet, denn die regelt Beschlüsse über nicht Angekündigtes, der
 *   Verzicht folgt aus Rz. 28, 69a ad Art. 712n und Rz. 230b ad Art. 712m
 *   (Fachprüfung F1). Daher «nicht geklärt».
 */
/*
 * **Nach den Schlussprüfungen, Produktentscheid 07.10.2026 «Empfehlungen»:**
 * Der Bezug auf die Einstellung nennt die Freigabe (Laienprüfung N1), denn es
 * gilt die Momentaufnahme. Bei «vertreten» zählen Vollmachten der Leitung oder
 * der Verwaltung nur, wenn die Gemeinschaft es eingestellt hat
 * (`leitungsvollmachtenZaehlen`, wie `befund.durchLeitung` in `ausnahmen.ts`;
 * Codeprüfung). Eine Regel der Anwendung (Produktentscheid 29.09.2026), keine
 * Rechtslage: Rz. 91 ad Art. 712n handelt von der Neutralität des Vorsitzes, nicht
 * von Vollmachten, und wird deshalb nicht genannt (Fachprüfung, letzte Runde).
 * Bei «keine» die sichere Lesart als
 * Handlung (Laienprüfung N2).
 */
function anwesenheitImSaal(variante: Universalvariante, leitungsvollmachtenZaehlen: boolean): string {
	switch (variante) {
		case 'vertreten':
			return (
				'Sind alle Eigentümer anwesend oder mit einer Vollmacht für dieses Traktandum vertreten ' +
				'und erhebt dann niemand Einwand, ist eine Anfechtung deswegen kaum mehr möglich. So ist ' +
				'es nach der Einstellung Ihrer Gemeinschaft bei der Freigabe; für das Stockwerkeigentum ' +
				'entschieden ist es nicht. ' +
				(leitungsvollmachtenZaehlen
					? ''
					: 'Vollmachten, die Sie als Leitung oder Verwaltung halten, zählen dafür nach dieser ' +
						'Einstellung nicht. ') +
				'Prüfen Sie die Vollmachten vor der Abstimmung.'
			);
		case 'keine':
			return (
				'Sind alle Eigentümer persönlich anwesend und erhebt dann niemand Einwand, ist eine ' +
				'Anfechtung deswegen kaum mehr möglich. Ob Vertretene dafür zählen, ist nicht geklärt; ' +
				'verlassen Sie sich dafür nur auf persönlich Anwesende.'
			);
		default:
			return (
				'Sind alle Eigentümer persönlich anwesend und erhebt dann niemand Einwand, ist eine ' +
				'Anfechtung deswegen kaum mehr möglich. Vertretene zählen dafür nach der Einstellung ' +
				'Ihrer Gemeinschaft bei der Freigabe nicht.'
			);
	}
}

/**
 * Ob im Saal beim Traktandum gewarnt wird (Produktentscheid 07.10.2026, «Die
 * Warnung rechnet im Saal laufend nach»): solange das Mehr, das es jetzt
 * trägt, milder oder gemischt ist gegenüber dem Mehr der Einladung davor.
 *
 * - Kein zählbares Mehr am Traktandum: keine Warnung; abgestimmt wird dann
 *   ohnehin nicht (`erfordernisluecke`).
 * - Mehr der Einladung davor unbekannt (`null`, etwa ein Eintrag ohne
 *   Vergleichsmass): Warnung, die vorsichtige Richtung.
 */
export function warntImSaal(mehr: Erfordernis | null, davor: Erfordernis | null): boolean {
	if (!mehr || !zaehlbar(mehr)) return false;
	if (!davor) return true;
	const v = vergleicheMitEinladung(mehr, davor);
	return v === 'milder' || v === 'gemischt';
}
