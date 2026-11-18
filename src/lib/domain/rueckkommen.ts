/**
 * Der Rückkommensantrag (Welle 3, FR-44) — rein.
 *
 * **Zwei Wege, die man nicht verwechseln darf.**
 *
 *   * **Überholen:** Der Durchgang war fehlerhaft — falsch gezählt, zu früh
 *     geschlossen, die halbe Wand hat nicht mitbekommen, worum es ging. Die
 *     Sitzungsleitung stellt das richtig. Die Versammlung hat dazu nichts zu
 *     beschliessen, denn ihr Wille war nie richtig erfasst.
 *     **Aber nur bis zur Verkündung** (H6, Fachprüfung 08.10.2026, `quellen`
 *     Frage 65): Ein verkündeter Beschluss wirkt, auch ein fehlerhafter, und
 *     ändern kann ihn nur die Versammlung. Weil das Schliessen verkündet,
 *     bleibt der Leitung der Durchgang mit offenem Stichentscheid; nach der
 *     Verkündung führt auch der fehlerhafte Durchgang über das Rückkommen.
 *
 *   * **Rückkommen:** Der Durchgang war einwandfrei, der Wille ist erfasst —
 *     und die Versammlung will ihn ändern. Das steht **ihr** zu, nicht der
 *     Leitung. Deshalb wird zuerst gesondert darüber abgestimmt.
 *
 * Wer ein einwandfreies Ergebnis als «fehlerhaft» überholt, nimmt der
 * Versammlung eine Abstimmung ab, die ihr zusteht. Deshalb sind es zwei Wege
 * und nicht einer mit zwei Begründungen.
 */
import { nurNachWertquoten } from './mehrheit';
import { FachlicherFehler } from './gemeinschaft';
import { RUECKKOMMEN_AUF_GESETZTES_MEHR, RUECKKOMMEN_TITEL, type Erfordernis } from './entscheidbaum';
import { keinBeschlussKurz, type KeinBeschluss } from './ausnahmen';
import { KONSULTATIV_WEG, KONSULTATIV_WEG_NEU } from './konsultativ';
import { verlangeFolgeantragNachRueckkommen } from './folgeantrag';
import { direktNachQuorumSatz } from './neuabstimmung';
import { massgebender, WEG_NACH_DER_VERKUENDUNG, type Durchgang } from './abstimmung';

/**
 * Der Zusatz zu den Absagen, die ein Rückkommen verlangen (H6). Bis dahin
 * stand dort, ein fehlerhafter Durchgang lasse sich mit Begründung überholen;
 * das gilt seither nur bis zur Verkündung, und die geschieht beim Schliessen.
 * Bedingt formuliert, weil derselbe Satz auch neben einem Durchgang mit
 * offenem Stichentscheid stehen kann, der noch nicht verkündet ist.
 */
export const AUCH_WENN_FEHLERHAFT =
	'Ein verkündetes Ergebnis ändert auch dann nur die Versammlung, wenn der Durchgang ' +
	'fehlerhaft war.';

/**
 * Ob `a` mindestens so streng ist wie `b`.
 *
 * Gebraucht für die eine Frage, die sich beim Rückkommen stellt: Darf die im
 * Reglement hinterlegte Regel an die Stelle des Erfordernisses treten, das der
 * aufzuhebende Beschluss trug? Nur wenn sie nicht dahinter zurückfällt.
 *
 * **Verglichen wird nur, was vergleichbar ist.** Zwei Brüche auf verschiedenen
 * Bezugsgrössen — «zwei Drittel der Anwesenden» gegen «die Hälfte aller» —
 * lassen sich nicht ordnen, ohne zu wissen, wie viele kommen. Dann lautet die
 * Antwort «nicht vergleichbar» und nicht «gleich streng»: Im Zweifel bleibt das
 * Erfordernis des Beschlusses stehen.
 */
export function mindestensSoStreng(a: Erfordernis, b: Erfordernis): boolean | null {
	// Einstimmigkeit übertrifft jedes Mehr; nur Einstimmigkeit erreicht sie.
	if (b.typ === 'einstimmigkeit') return a.typ === 'einstimmigkeit';
	if (a.typ === 'einstimmigkeit') return true;

	/*
	 * **Ohne Köpfe** (Regel «Köpfe zählen nicht», 16.11.2026): Wer die Köpfe
	 * weglässt, wo der Beschluss sie zählte, erleichtert; wer sie hinzunimmt,
	 * verschärft bei den Köpfen, und es entscheiden die Wertquoten unten. Ohne
	 * Kopf- und ohne Wertquotenschwelle bleibt es nicht vergleichbar.
	 */
	if (!a.kopfSchwelle || !b.kopfSchwelle) {
		if ((!a.kopfSchwelle && !nurNachWertquoten(a)) || (!b.kopfSchwelle && !nurNachWertquoten(b))) return null;
		if (!a.kopfSchwelle && b.kopfSchwelle) return false;
	} else {
		if (a.kopfbasis !== b.kopfbasis) return null;

		// Ganzzahlig über Kreuz, damit aus 2/3 gegen 1/2 kein Gleitkomma wird.
		const kopfKleiner = a.kopfSchwelle.zaehler * b.kopfSchwelle.nenner
			< b.kopfSchwelle.zaehler * a.kopfSchwelle.nenner;
		if (kopfKleiner) return false;
		const kopfGleich = a.kopfSchwelle.zaehler * b.kopfSchwelle.nenner
			=== b.kopfSchwelle.zaehler * a.kopfSchwelle.nenner;
		// Bei gleichem Bruch entscheidet die Art: «mehr als die Hälfte» ist strenger
		// als «mindestens die Hälfte» — bei 20 Stimmen sind das 11 gegen 10.
		if (kopfGleich && a.kopfSchwelle.art === 'mindestens' && b.kopfSchwelle.art === 'mehr_als') {
			return false;
		}
	}

	/*
	 * **Enthaltungen aus der Bezugsgrösse zu nehmen, ist eine Erleichterung**
	 * (04.09.2026, aus dem Code-Review). Sie senkt den Nenner und damit die
	 * nötige Zahl an Ja-Stimmen, ohne dass sich ein Bruch ändert. Wo der
	 * Beschluss sie mitzählte und die Rückkommensregel nicht, ist diese also
	 * milder, auch wenn alle Zahlen darüber gleich aussehen.
	 */
	if (a.enthaltungZaehltMit === false && b.enthaltungZaehltMit !== false) return false;

	// Eine Wertquotenbedingung wegzulassen, wo der Beschluss eine trug, ist eine
	// Erleichterung — und eine, die nicht in einer Zahl steht, sondern in deren
	// Fehlen.
	if (b.quotenSchwelle && !a.quotenSchwelle) return false;
	if (b.quotenSchwelle && a.quotenSchwelle) {
		if (a.quotenbasis !== b.quotenbasis) return null;
		if (
			a.quotenSchwelle.zaehler * b.quotenSchwelle.nenner <
			b.quotenSchwelle.zaehler * a.quotenSchwelle.nenner
		) {
			return false;
		}
	}

	return true;
}

/**
 * Warum eine hinterlegte Rückkommensregel nicht zum Zug kommt.
 *
 * Der Satz hängt sich an die Rechtsgrundlage des Erfordernisses — also genau
 * dorthin, wo ein Leser fragt «warum dieses Mehr?». Das ist zugleich die Stelle,
 * die wörtlich ins Protokoll geht: Eine hinterlegte Regel, die still übergangen
 * wird, sähe später wie ein Versehen aus.
 */
function regelvorbehalt(regel: Erfordernis, ziel: Erfordernis, vergleichbar: boolean): string {
	const kopf = ` Ihr Reglement regelt das Rückkommen eigens (${regel.fundstelle ?? 'Reglement'}); `;
	if (!vergleichbar) {
		return (
			kopf +
			'angewandt wird es hier nicht, weil sich seine Bezugsgrösse und die des Beschlusses ' +
			'nicht ordnen lassen. Im Zweifel bleibt es beim strengeren.'
		);
	}
	return (
		kopf +
		'angewandt wird es hier nicht, weil es hinter dem Erfordernis des Beschlusses ' +
		'zurückbliebe. Sonst liesse sich über den Umweg des Rückkommens aufheben, was ohne ' +
		'diesen Umweg nicht aufzuheben wäre.'
	);
}

/**
 * Die Geschäftsart der **Sache** behalten, auch wenn das Mehr aus dem Reglement kommt.
 *
 * Daran hängt mehr als die Beschriftung: Bei einer Nutzniessung entscheidet die
 * Geschäftsart, wer die Stimme ausübt (ZGB Art. 712o Abs. 2 — bei nützlichen und
 * luxuriösen baulichen Massnahmen der Eigentümer, sonst der Nutzniesser). Liesse
 * man hier `rueckkommen` stehen, fiele eine bauliche Massnahme in die
 * Auffangregel und die Stimme wechselte die Person, bloss weil über den Umweg
 * eines Ordnungsantrags abgestimmt wird.
 */
function mitSachgebiet(erfordernis: Erfordernis, ziel: Erfordernis | null): Erfordernis {
	if (!ziel?.geschaeftsart) return erfordernis;
	return { ...erfordernis, geschaeftsart: ziel.geschaeftsart };
}

/**
 * Welches Mehr ein Rückkommensantrag braucht.
 *
 * **Dasselbe wie der Beschluss, auf den zurückgekommen wird.**
 *
 * Der Grundsatz ist in der Sache anerkannt und in unseren eigenen Quellen
 * zweimal belegt (Beobachter, «Stockwerkeigentum»):
 *
 *   * «Für die Abänderung der Hausordnung gilt dasselbe Quorum wie für den
 *     Erlass.» (S. 109)
 *   * Zum Fall «Quellenhof», wo ein einstimmig geänderter Reglementspunkt
 *     wieder aufgehoben werden soll: «Dazu ist abermals ein einstimmiger
 *     Beschluss nötig, obwohl das Reglement des ‹Quellenhof› ansonsten
 *     Änderungen mit einem tieferen Quorum erlaubt.» (S. 108)
 *
 * **Warum das für das Rückkommen entscheidend ist — und nicht bloss eine
 * Formalie.** Der Rückkommensantrag sieht aus wie ein Verfahrensentscheid:
 * beraten wir nochmals? Seine Wirkung ist eine andere. Wird zurückgekommen
 * und die Sache scheitert im zweiten Durchgang am qualifizierten Mehr, dann
 * ist der frühere Beschluss **weg** — beseitigt durch die einfache Mehrheit,
 * die für das Rückkommen genügte. Über diesen Umweg liesse sich jeder
 * qualifizierte Beschluss mit einfachem Mehr aufheben.
 *
 * **Das gilt seit dem 30.09.2026 wieder** (Produktentscheid «Nein heisst
 * Nein», `docs/freigabe.md`, Punkt (a)). Dazwischen liess Votum den früheren
 * Beschluss nach einer Ablehnung stehen, und die Begründung beschrieb einen
 * Stand, den es nicht mehr gab (Anwaltsfragen-Empfehlung 27.09.2026, A-10).
 * Das Mehr ist eine Regel dieser Anwendung (Ä-34 vom 17.09.2026), keine des
 * Gesetzes; der Text sagt das (Fachprüfung 30.09.2026, F-4).
 *
 * Die erste Fassung dieses Bausteins behandelte den Rückkommensantrag als
 * Ordnungsantrag mit einfachem Mehr. Das war zu schwach; der Auftraggeber hat auf den
 * Grundsatz hingewiesen, und die Quellen geben ihm recht.
 *
 * **Im Zweifel das strengere Mehr** — auch das steht so im Beobachter (S. 159,
 * zur Abgrenzung gewöhnlicher von wichtigeren Verwaltungshandlungen).
 */
export function erfordernisFuerRueckkommen(
	ziel: Erfordernis | null,
	zielAngenommen: boolean,
	/**
	 * Was das Reglement zum Rückkommen selbst sagt, falls hinterlegt.
	 *
	 * Die Annahme des PRD lautete «einfaches Mehr als Ordnungsantrag, sofern das
	 * Reglement nichts anderes sagt» — dieser Nachsatz war bis zum 13.08.2026
	 * nicht erfüllbar, weil es die Geschäftsart gar nicht gab.
	 */
	ausReglement: Erfordernis | null = null,
	/**
	 * Ob der Beschluss die Ja-Stimmen aller Eigentümer hatte (B2b, B2-F-4):
	 * Unter L6 hängt daran, ob seine Aufhebung nach beiden Lesarten besteht.
	 * Unbekannt heisst `undefined`, und die Sätze dazu bleiben weg.
	 */
	beschlussMitAllen?: boolean
): Erfordernis {
	/*
	 * **Fall A — der frühere Antrag wurde abgelehnt.** Es gibt keinen Beschluss,
	 * den das Rückkommen beseitigen könnte, und damit nichts zu schützen. Wer
	 * nach neuen Erkenntnissen zurückkommt und die Sache diesmal annimmt, fasst
	 * einen **neuen** Beschluss — und der trägt ohnehin das volle Erfordernis.
	 *
	 * Hier das strengere Mehr zu verlangen, hiesse genau den Fall zu blockieren,
	 * für den es das Institut gibt: Ein knapp gescheiterter Antrag, zu dem die
	 * zweite Offerte eintrifft, käme nie mehr auf den Tisch (Einwand des Auftraggebers vom
	 * 05.08.2026).
	 */
	if (!zielAngenommen) {
		// Hier gilt eine hinterlegte Regel ohne Vorbehalt: Es gibt keinen
		// Beschluss, den sie unterlaufen könnte.
		return ausReglement ? mitSachgebiet(ausReglement, ziel) : EINFACHES_MEHR_ORDNUNGSANTRAG;
	}

	/*
	 * **Fall B — es liegt ein Beschluss vor.** Das Rückkommen zielt auf seine
	 * Aufhebung, und dafür gilt der Grundsatz: dasselbe Mehr wie für den Erlass.
	 * Belegt für verwandte Fälle im Beobachter «Stockwerkeigentum»:
	 *
	 *   * «Für die Abänderung der Hausordnung gilt dasselbe Quorum wie für den
	 *     Erlass.» (S. 109)
	 *   * Fall «Quellenhof»: Eine einstimmig beschlossene Reglementsbestimmung
	 *     wieder aufzuheben verlangt «abermals einen einstimmigen Beschluss,
	 *     obwohl das Reglement ansonsten Änderungen mit einem tieferen Quorum
	 *     erlaubt». (S. 108)
	 */
	if (!ziel) {
		return (
			ausReglement ?? {
				...EINFACHES_MEHR_ORDNUNGSANTRAG,
				titel: 'Einfaches Mehr (Ordnungsantrag, ohne bekanntes Erfordernis)'
			}
		);
	}

	/*
	 * **Das Reglement darf das Rückkommen erschweren, nicht erleichtern.**
	 *
	 * Dieselbe Richtung wie bei der Beschlussfähigkeit (ZGB Art. 712p,
	 * `pruefeErschwerung`), aber aus einem anderen Grund: Dort schützt sie die
	 * Minderheit vor einer kleinen Gruppe, hier den gefassten Beschluss vor
	 * seiner Beseitigung auf dem Umweg. Anders als dort lässt sich das nicht beim
	 * Erfassen prüfen — womit verglichen wird, steht erst im Saal fest, wenn
	 * bekannt ist, welcher Beschluss aufgehoben werden soll.
	 */
	let nachsatz = '';
	if (ausReglement) {
		const reicht = mindestensSoStreng(ausReglement, ziel);
		if (reicht === true) return mitSachgebiet(ausReglement, ziel);
		nachsatz = regelvorbehalt(ausReglement, ziel, reicht !== null);
	}

	return {
		...ziel,
		// Das Rückkommen übernimmt das Mehr, nicht die Lesart: Es ist ein
		// Ordnungsantrag mit eigenem Titel und eigener Rechtsgrundlage, und ein
		// zweites Ergebnis nach dem Gegenstück des Beschlusses verlöre beide
		// (Codeprüfung Lesarten, Teil 1). Lesart und zweites Ergebnis stehen am
		// Beschluss selbst.
		gemeinschaftslesart: undefined,
		// Aber die Lesart, nach der der Beschluss gerechnet war, ohne ihr zweites
		// Ergebnis: Daran sagt die Leitung am Rückkommen denselben Satz wie am
		// Beschluss (Review DeepSeek 05.11.2026, B2; `kopfbasisStreit`). Beim
		// Rückkommen auf ein Rückkommen reicht sie weiter.
		lesartDesBeschlusses: ziel.gemeinschaftslesart
			? {
					kennung: ziel.gemeinschaftslesart.kennung,
					wahl: ziel.gemeinschaftslesart.wahl,
					andere: ziel.gemeinschaftslesart.andere,
					...(beschlussMitAllen === undefined ? {} : { mitAllen: beschlussMitAllen })
				}
			: // Beim Rückkommen auf ein Rückkommen ohne den Ausgang: Er gehörte zum
				// Beschluss, nicht zum Rückkommensantrag, der jetzt aufgehoben würde
				// (Codeprüfung B2b, M2).
				ziel.lesartDesBeschlusses && { ...ziel.lesartDesBeschlusses, mitAllen: undefined },
		// Ebenso das Mehr aus Gesetz und Reglement des Beschlusses (Lesarten Block 6,
		// Codeprüfung M1): Es gehört an den Beschluss, nicht an seine Aufhebung.
		gesetzlich: undefined,
		// Ebenso das Häkchen zum Satz an der Karte (Migration 198): Das Rückkommen
		// hat keine Karte, an der ein Satz zur Regel stünde.
		regelGesichert: undefined,
		titel: `${RUECKKOMMEN_TITEL}${ziel.titel}`,
		// Hat die Leitung die Mehrheit des Beschlusses gesetzt, ist dessen
		// Rechtsgrundlage leer (30.09.2026); der Satz beginnt dann selbst. Aus der
		// Konstante, an deren Anfang `ausstandBleibtBeiGewaehlterBasis` ein solches
		// Rückkommen erkennt (Codeprüfung Textrunde 0050, G6); der gespeicherte Text
		// bleibt zeichengleich.
		rechtsgrundlage:
			(ziel.rechtsgrundlage
				? `${ziel.rechtsgrundlage} — ${RUECKKOMMEN_AUF_GESETZTES_MEHR.charAt(0).toLowerCase()}${RUECKKOMMEN_AUF_GESETZTES_MEHR.slice(1)}`
				: RUECKKOMMEN_AUF_GESETZTES_MEHR) +
			', weil das Rückkommen ihn aufhebt (Regel dieser Anwendung).' +
			nachsatz,
		pfad: [
			{
				frageId: 'f-rueckkommen',
				frageText: 'Worüber wird abgestimmt?',
				antwortId: 'a-rueckkommen-aufhebung',
				antwortText:
					'Über die Aufhebung eines gefassten Beschlusses und die erneute Beschlussfassung. ' +
					'Es gilt dasselbe Mehr wie für den Beschluss selbst.'
			},
			...ziel.pfad
		],
		quelle: 'gewaehlt'
	};
}

/** Rückfall, wenn am Zieltraktandum kein Erfordernis steht. */
const EINFACHES_MEHR_ORDNUNGSANTRAG: Erfordernis = {
	fassung: 'ordnungsantrag-2026-08-05',
	juristischGegengelesen: false,
	astId: 'a-ordnungsantrag',
	knotenId: 'k-rueckkommen',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr (Ordnungsantrag)',
	rechtsgrundlage: 'Im ZGB nicht geregelt; behandelt als Ordnungsantrag',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [
		{
			frageId: 'f-rueckkommen',
			frageText: 'Worüber wird abgestimmt?',
			antwortId: 'a-ordnungsantrag',
			antwortText: 'Über einen Ordnungsantrag: ob auf ein behandeltes Traktandum zurückgekommen wird'
		}
	],
	quelle: 'gewaehlt'
};

/**
 * Was ein Rückkommensbeschluss **nicht** bewirkt (A-10, 24.09.2026).
 *
 * **Wermelinger, SVIT-Kommentar 2023, Rz. 202a ad Art. 712g:**
 * Verwaltungsbeschlüsse können widerrufen oder abgeändert werden, «soweit sie
 * keine Gestaltungswirkung entfalten und nicht bereits realisiert wurden».
 *
 * **Die Merkmale schränken nicht die Beschlussfassung ein, sondern die
 * Beseitigungswirkung.** Die Versammlung darf beschliessen; was sie nicht kann,
 * ist die eingetretene Wirkung rückgängig machen. Das ausgeführte Dach bleibt
 * ausgeführt, die Rechnung des Handwerkers bleibt geschuldet. Belegt aus
 * Rz. 4 ad Art. 712r (das ausgeübte Gestaltungsrecht ist verbraucht),
 * Rz. 139a ad Art. 712l (auch teilweise Ausführung zählt) und **Rz. 79a ad
 * Art. 712h**: «Eine rückwirkende Änderung des Kostenverteilschlüssels ist
 * mithin nur durch einstimmigen Beschluss oder zumindest mit der Zustimmung
 * der benachteiligten Stockwerkeigentümer möglich.» Das ist eine
 * Quorumsaussage und deshalb der zweite Satz.
 *
 * ---
 *
 * **Warum nur ein Hinweis, und das ist die Lehre eines ganzen Tages.**
 *
 * Ein Entwurf vom 23.09.2026 machte daraus **zwei Pflichtfragen** mit Warnung
 * und Protokollvermerk. Vier Prüfungen liefen darüber, und drei Befunde haben
 * den Bau als Ganzes verworfen:
 *
 *   - **Die Fachprüfung:** Der Entwurf schrieb «ein Rückkommensbeschluss käme
 *     nicht zustande». Das widerspricht Rz. 206 f. ad Art. 712m, wonach bei
 *     widerrechtlichen Beschlüssen «in der Regel von der Anfechtbarkeit
 *     auszugehen» ist. Wer den Satz las, liess die Monatsfrist verstreichen —
 *     der Text hätte genau den Schaden angerichtet, den er verhindern sollte.
 *   - **Die Laienprüfung:** Nach der Warnung gab es nur einen Knopf, und der
 *     führte vorwärts. «Ich drücke. Nicht, weil ich überzeugt bin, sondern weil
 *     der Weg zurück auf dem Bildschirm nicht existiert.»
 *   - **Die Vorgabe des Auftraggebers vom 24.09.2026:** Das Werkzeug ist ein Hilfsmittel.
 *     Das Rückkommen auf einen vollzogenen Beschluss steht auf keiner der
 *     beiden Achsen weit genug oben, um zu sperren oder aufzuhalten
 *     (`docs/leitplanken.md`, Zeile 19). **Eine Pflichtfrage ist eine halbe
 *     Sperre:** Sie hält auf und erzwingt eine Erklärung, die ins Protokoll
 *     geht.
 *
 * Geblieben ist der Satz, und der Satz ist das, was die Sitzungsleitung
 * braucht. Die vier Prüfberichte stehen im Repo `quellen` unter
 * `pruefung/berichte/`, je zweimal zum Einladungssatz und zu den
 * Rückkommensschranken vom 23.09.2026.
 */
const GRENZEN =
	'Ist der bisherige Beschluss schon ausgeführt, oder wurde daraufhin etwas einseitig erklärt, ' +
	'etwa eine Kündigung oder eine Abberufung? Dann kann die Versammlung zwar neu beschliessen, ' +
	'das Geschehene aber nicht rückgängig machen (Wermelinger, SVIT-Kommentar 2023, Rz. 202a ad ' +
	'Art. 712g). Für eine rückwirkende Änderung der Kostenverteilung braucht es zudem die ' +
	'Zustimmung der Benachteiligten oder Einstimmigkeit (Rz. 79a ad Art. 712h). ' +
	'Ob eine dieser Lagen vorliegt, entscheiden Sie; die Anwendung hält Sie nicht auf.';

/**
 * Der Hinweis, der bei jedem Rückkommensantrag sichtbar sein muss — je nachdem,
 * ob ein Beschluss vorliegt oder nicht.
 */
export function rueckkommensvorbehalt(zielAngenommen: boolean): string {
	if (zielAngenommen) {
		return (
			// Auf Rz. 202a statt auf den Beobachter (Anwaltsfragen-Empfehlung
			// 27.09.2026, A-10), das Mehr als Regel der Anwendung (Fachprüfung
			// 30.09.2026, F-4), und «abgelehnt» getrennt von «kein Beschluss»
			// (Produktentscheid 30.09.2026, «Nein heisst Nein»).
			'Es liegt ein Beschluss vor. Mit dem Rückkommen beschliesst die Versammlung die Sache ' +
			'erneut, über denselben oder einen geänderten Antrag im Rahmen des angekündigten ' +
			'Traktandums. Der neue Beschluss, auch eine Ablehnung, hebt den bisherigen auf, auch ' +
			'bei einem geänderten Antrag; nur wenn ' +
			'gar kein Beschluss zustande kommt, bleibt er in Kraft. Eine Stimmengleichheit ist eine ' +
			'Ablehnung, wenn das Reglement nichts anderes bestimmt. Für das Rückkommen setzt ' +
			'die Anwendung dasselbe Mehr wie für den Beschluss selbst; widerrufen lässt sich ein ' +
			'Beschluss nur mit dem erforderlichen Mehr (Rz. 202a ad Art. 712g). ' +
			EIN_DURCHGANG +
			GRENZEN
		);
	}
	return (
		// «nichts Angenommenes»: Die Ablehnung ist auch ein Beschluss, und das
		// Protokoll nennt sie so (Codeprüfung 30.09.2026, G1).
		'Der Antrag wurde abgelehnt; es gibt nichts Angenommenes zu schützen. Das Rückkommen ist ' +
		'deshalb ein Ordnungsantrag mit einfachem Mehr. Über die Sache selbst wird danach mit ' +
		'ihrem eigenen Erfordernis entschieden. ' +
		EIN_DURCHGANG.trim()
	);
}

/**
 * **Danach wird einmal abgestimmt, und das gehört angesagt** (Laienprüfung
 * 30.09.2026, Runde 2, 4-1). Wer über das Rückkommen abstimmt, erwartet sonst
 * eine Wahl zwischen dem bisherigen und dem geänderten Antrag. Als Regel dieser
 * Anwendung, im Hinweis an die Leitung und nicht im Beschlusstext
 * (Fachprüfung Runde 2: der Wortlaut trägt ohne ihn).
 */
const EIN_DURCHGANG =
	// «entweder … oder …, nicht beide nacheinander» statt «einmal»: «einmal»
	// überhört man, und es widerspräche dem eigenen Weg der Neuabstimmung
	// (Fachprüfung Runde 3, F3-3; Laienprüfung Runde 3, 4-2). Wer wählt, steht
	// dabei (4-3).
	'Nach der Regel dieser Anwendung kommt danach entweder der bisherige oder ein geänderter ' +
	'Antrag zur Abstimmung, nicht beide nacheinander. Welchen, schlagen Sie vor; die Versammlung ' +
	'kann per Ordnungsantrag den anderen verlangen. Sagen Sie das vor der Abstimmung über das ' +
	'Rückkommen an. '

export interface Rueckkommensziel {
	id: string;
	nummer: string;
	titel: string;
	/** Ob über dieses Traktandum bereits abgestimmt und geschlossen wurde. */
	behandelt: boolean;
	/** Ob dazu bereits ein Rückkommensantrag läuft oder angenommen wurde. */
	rueckkommenOffen: boolean;
	/** Ob es zurückgezogen wurde — dann gibt es keinen Beschluss, auf den man zurückkäme. */
	zurueckgezogen: boolean;
	/**
	 * Ob der massgebende Durchgang «kein Beschluss» ergab (Migration 128). Auch
	 * dann gibt es nichts, worauf man zurückkäme.
	 */
	keinBeschluss?: boolean;
	/** Ob dieses «kein Beschluss» aus einer konsultativen Abstimmung kommt (Migration 158). */
	konsultativ?: boolean;
	/** Konsultativ nach der Sperre von L5 (Migration 174; Codeprüfung Block 7, R2-N1). */
	konsultativNeu?: boolean;
}

/**
 * Prüft, ob auf dieses Traktandum zurückgekommen werden kann.
 *
 * Drei Gründe, warum nicht — und jeder nennt den Weg, der stattdessen gilt.
 */
export function verlangeRueckkommbar(ziel: Rueckkommensziel): void {
	if (ziel.zurueckgezogen) {
		throw new FachlicherFehler(
			'zurueckgezogen',
			`«${ziel.titel}» wurde zurückgezogen. Es gibt keinen Beschluss, auf den zurückzukommen wäre — ` +
				'nehmen Sie die Sache als neues Geschäft auf, wenn sie heute noch behandelt werden soll.',
			'ziel'
		);
	}
	if (ziel.keinBeschluss && ziel.konsultativ) {
		throw new FachlicherFehler(
			'kein_beschluss',
			`Über «${ziel.titel}» wurde nur konsultativ abgestimmt; es gibt keinen Beschluss, auf den ` +
				`zurückzukommen wäre. ${ziel.konsultativNeu ? KONSULTATIV_WEG_NEU : KONSULTATIV_WEG}`,
			'ziel'
		);
	}
	if (ziel.keinBeschluss) {
		throw new FachlicherFehler(
			'kein_beschluss',
			`Über «${ziel.titel}» kam kein Beschluss zustande; es gibt nichts, worauf zurückzukommen wäre. ` +
				// Auch wenn eine Vertretung durch die Leitung nicht zählte: Dort ist
				// niemand «wieder» da (Codeprüfung 30.09.2026, N-1).
				// Laienprüfung 30.09.2026, Runde 3, L3-4: die Voraussetzung nennen.
				'Nach einem Weggang eröffnen Sie die Abstimmung neu, sobald wieder alle da sind. Nach einer ' +
				'Vertretung, die nicht zählte, eröffnen Sie neu, sobald die Partei selbst da ist oder durch ' +
				'jemanden vertreten wird, dem sie die Vollmacht selbst gegeben hat. Diese Person darf nicht ' +
				'für Sie oder die Verwaltung handeln, und ihre Vollmacht muss auch dieses Geschäft decken. Nach einem Widerspruch traktandieren Sie das Geschäft für die nächste Versammlung.',
			'ziel'
		);
	}
	if (!ziel.behandelt) {
		throw new FachlicherFehler(
			'nicht_behandelt',
			`Über «${ziel.titel}» ist noch nicht abgestimmt. Ein Rückkommensantrag setzt einen ` +
				'gefassten Beschluss voraus; rufen Sie das Traktandum einfach auf.',
			'ziel'
		);
	}
	if (ziel.rueckkommenOffen) {
		throw new FachlicherFehler(
			'schon_beantragt',
			`Zu «${ziel.titel}» läuft bereits ein Rückkommensantrag oder es wurde bereits ` +
				'zurückgekommen. Schliessen Sie zuerst ab, was offen ist.',
			'ziel'
		);
	}
}

/**
 * Der Antragswortlaut des Rückkommensantrags.
 *
 * **Von der Anwendung formuliert, nicht von Hand getippt**, und er sagt
 * ausdrücklich, **was mit dem früheren Beschluss geschieht**. Der angenommene
 * Rückkommensantrag ist selbst der Widerruf mit dem erforderlichen Mehr, den
 * Rz. 202a ad Art. 712g verlangt; wenn aus dem Antrag nicht hervorginge, ob er
 * den früheren Beschluss aufhebt, liesse sich hinterher nicht sagen, ob
 * überhaupt etwas abgeändert wurde.
 *
 * **«Abgelehnt» und «kein Beschluss» getrennt** (Produktentscheid 30.09.2026,
 * «Nein heisst Nein»). Bis dahin hiess es «Kommt der neue Beschluss nicht
 * zustande, bleibt der bisherige in Kraft», und Votum liess den früheren auch
 * nach einer Ablehnung stehen. Eine Ablehnung ist aber selbst ein Beschluss
 * (BGE 131 III 459, Sachverhalt und E. 5.2; Rz. 235a ad Art. 712m), und im Saal
 * kommt nur derselbe Antrag nochmals zur Abstimmung: Ja und Nein führten zum
 * selben Beschluss (Laien- und Fachprüfung 30.09.2026, L1, F-1). Anträge, die
 * schon mit dem alten Wortlaut in einer Versammlung stehen, behalten ihn.
 */
export function rueckkommenswortlaut(
	ziel: { nummer: string; titel: string },
	zielAngenommen: boolean,
	/**
	 * Hat ein Folgeantrag den Beschluss nach einem früheren Rückkommen ersetzt,
	 * dieser Folgeantrag: Der bisherige Beschluss ist dann der zu ihm, und der
	 * Wortlaut nennt ihn, statt nur das Grundtraktandum (Codeprüfung B1; Plan
	 * Folgeantrag nach Rückkommen, Soll 7).
	 */
	geltendZu?: { nummer: string; titel: string } | null
): string {
	/*
	 * **Derselbe oder ein geänderter Antrag** (Produktentscheid 30.09.2026;
	 * Plan Soll 7). Nach dem Rückkommen darf statt des alten Antrags ein
	 * Folgeantrag zur Abstimmung kommen; wer über den Rückkommensantrag
	 * abstimmt, soll wissen, dass auch das möglich ist.
	 */
	const antrag = 'über denselben oder einen geänderten Antrag';
	if (zielAngenommen) {
		return (
			// Die Sache beim Namen, nicht «der Antrag»: Sonst liest man es als Satz
			// über diesen Rückkommensantrag und stimmt falsch herum (Laienprüfung
			// 30.09.2026, L9). Aufgehoben wird mit dem neuen Beschluss, nicht schon
			// jetzt (L11).
			`Die Versammlung beschliesst die Sache zu Traktandum ${ziel.nummer} «${ziel.titel}» ` +
			`erneut, ${antrag}. ` +
			(geltendZu
				? `Bisher gilt dazu der Beschluss zum Folgeantrag ${geltendZu.nummer} ` +
					`«${geltendZu.titel}». `
				: '') +
			// «auch wenn über einen geänderten Antrag abgestimmt wird»: Wer über das
			// Rückkommen abstimmt, sah sonst nicht, dass auch das Nein zu einem
			// anderen Antrag den bisherigen Beschluss aufhebt (Laienprüfung
			// 30.09.2026, Stelle 4; Fachprüfung: trägt, Rz. 202a ad Art. 712g).
			'Mit dem neuen Beschluss zur Sache wird der bisherige aufgehoben, auch mit einer ' +
			'Ablehnung und auch wenn über einen geänderten Antrag abgestimmt wird; kommt dabei gar ' +
			'kein Beschluss zustande, auch keine Ablehnung, ' +
			'bleibt er in Kraft. Eine Stimmengleichheit im neuen Durchgang gilt als Ablehnung, wenn das ' +
			// Im Beschlusstext, nicht nur im Hinweis an die Leitung: Ausgelegt wird
			// der Beschluss (Fachprüfung 30.09.2026, F-12; Rz. 187 ad Art. 712m
			// sagt «nicht gefasst»).
			'Reglement nichts anderes bestimmt.'
		);
	}
	return (
		`Auf Traktandum ${ziel.nummer} «${ziel.titel}» wird zurückgekommen. ` +
		(geltendZu
			? `Zuletzt wurde dazu der Folgeantrag ${geltendZu.nummer} «${geltendZu.titel}» abgelehnt; `
			: 'Der Antrag wurde abgelehnt; ') +
		`die Versammlung beschliesst erneut darüber, ${antrag}.`
	);
}

export function rueckkommenstitel(
	ziel: { nummer: string; titel: string },
	/** Siehe `rueckkommenswortlaut`: der Folgeantrag, dessen Beschluss gilt. */
	geltendZu?: { nummer: string } | null
): string {
	return (
		`Rückkommen auf ${ziel.nummer} ${ziel.titel}` +
		(geltendZu ? ` (Beschluss zu ${geltendZu.nummer})` : '')
	);
}

export interface Rueckkommensstand {
	/** Ob der Rückkommensantrag beschlossen ist. */
	angenommen: boolean;
	/** Ob er bereits einen neuen Durchgang getragen hat. */
	verbraucht: boolean;
}

/**
 * Darf jetzt ein neuer Durchgang zum Zieltraktandum eröffnet werden?
 *
 * **Ein Rückkommensbeschluss trägt genau einen Durchgang.** Sonst liesse sich
 * mit einer einmal erteilten Erlaubnis so oft neu abstimmen, bis das Ergebnis
 * gefällt — und das wäre das Gegenteil dessen, was die Versammlung beschlossen
 * hat.
 */
export function verlangeNeuenDurchgangZulaessig(
	stand: Rueckkommensstand | null,
	titel: string
): void {
	if (!stand) {
		throw new FachlicherFehler(
			'ohne_rueckkommen',
			`Über «${titel}» ist bereits abgestimmt. Für eine erneute Abstimmung braucht es einen ` +
				'angenommenen Rückkommensantrag — darüber entscheidet die Versammlung, nicht die ' +
				`Sitzungsleitung. ${AUCH_WENN_FEHLERHAFT}`,
			'zustand'
		);
	}
	if (!stand.angenommen) {
		throw new FachlicherFehler(
			'rueckkommen_nicht_angenommen',
			`Der Rückkommensantrag zu «${titel}» ist nicht angenommen. Der frühere Beschluss gilt.`,
			'zustand'
		);
	}
	if (stand.verbraucht) {
		throw new FachlicherFehler(
			'rueckkommen_verbraucht',
			`Auf «${titel}» wurde bereits zurückgekommen und neu abgestimmt. Ein weiterer Durchgang ` +
				'braucht einen neuen Rückkommensantrag.',
			'zustand'
		);
	}
}

/**
 * Warum ein Durchgang überholt wurde.
 *
 * `neueroeffnung` ist nicht `korrektur`: Bei der Neueröffnung nach einem
 * Weggang war der Durchgang nicht fehlerhaft, und es stand kein Beschluss da,
 * den die Leitung hätte ersetzen lassen. `korrektur` heisst dagegen
 * «Neuabstimmung durch die Leitung» oder, seit H6, «ohne Ergebnis
 * abgebrochen» (`abgebrochen` in `domain/abstimmung.ts`).
 *
 * `notweg` (Migration 134): durch einen von der Sitzungsleitung von Hand
 * festgehaltenen Beschluss überholt (`domain/vonhand.ts`). Weder eine
 * angesetzte Neuabstimmung noch ein Beschluss nach Rückkommen; das Protokoll
 * nennt dazu nur die Zahl der Durchgänge und verweist auf den Verlauf.
 *
 * `nachquorum`/`nachquorum_erfolglos` (Migration 139): der zweite Durchgang
 * nach Eintritt der Beschlussfähigkeit (`domain/neuabstimmung.ts`). Ersetzt er
 * den von Hand festgehaltenen Beschluss, wird der frühere als `nachquorum`
 * überholt, und `superseded_by_round_id` zeigt von ihm auf den neuen; endete er
 * ohne Annahme (Ablehnung oder kein Beschluss), ist er selbst als
 * `nachquorum_erfolglos` überholt, und der frühere bleibt massgebend.
 */
export type Ersetzungsart =
	| 'korrektur'
	| 'neueroeffnung'
	| 'rueckkommen'
	| 'rueckkommen_erfolglos'
	| 'notweg'
	| 'nachquorum'
	| 'nachquorum_erfolglos';

/**
 * Ob ein Durchgang, der sich auf einen Rückkommensantrag stützt, diesen
 * **verbraucht** hat.
 *
 * **Die Neuabstimmung gibt ihn zurück** (`docs/freigabe.md`, «Reste zur
 * Universalversammlung», Punkt 9). Hat die Leitung den Durchgang nach dem
 * Rückkommen als fehlerhaft überholt (`korrektur`), dann hat die Versammlung
 * über die Sache nicht wirksam neu entschieden. Der Rückkommensbeschluss steht
 * noch, und der Folgedurchgang läuft wieder unter ihm. Sonst wäre er ohne
 * Verweis eröffnet, und scheiterte er, stellte nichts den früheren Beschluss
 * wieder her.
 *
 * Das öffnet keine Wiederholung, bis das Ergebnis gefällt: Überholen kann die
 * Leitung seit H6 nur einen Durchgang, dessen Ergebnis nicht verkündet ist,
 * also den mit offenem Stichentscheid; einen Beschluss gibt es dort nicht.
 * Ebenso den laufenden, den sie ohne Ergebnis abbricht. Der Abbruch lässt
 * sich wiederholen, aber jeder steht mit Begründung im Protokoll, und eine
 * verkündete Mehrheit beseitigt er nicht.
 *
 * Dieselbe Regel steht in SQL an drei Stellen: `rueckkommenZuEroeffnen`
 * (`server/abstimmung.ts`), `stelleRueckkommensantrag`
 * (`server/traktanden.ts`), je als `supersede_kind IS DISTINCT FROM 'korrektur'`,
 * und im Teilindex `voting_round_ein_durchgang_je_rueckkommen` (Migration 131).
 */
export function verbrauchtDenRueckkommensantrag(art: Ersetzungsart | null): boolean {
	return art !== 'korrektur';
}

/**
 * Der Durchgang nach einem Rückkommen, auf den die Leitung eine Neuabstimmung
 * angesetzt hat, solange danach nicht neu abgestimmt ist; sonst null.
 *
 * Dann gilt weiter der frühere Beschluss, und der überholte liegt **nach** dem
 * massgebenden. Auswertung, Protokoll und Leitungsseite erkennen den Fall an
 * derselben Stelle.
 *
 * **Seit H6 nur noch mit offenem Stichentscheid oder nach einem Abbruch.**
 * Überholen lässt sich nur, was nicht verkündet ist: nach einem Rückkommen
 * der Durchgang, der unentschieden endete (`rueckkommen_erfolglos`), oder der
 * laufende, den die Leitung ohne Ergebnis abbricht. Keiner von beiden hatte
 * den früheren Beschluss ersetzt. Bis dahin konnte die Leitung auch einen
 * verkündeten Beschluss nach dem Rückkommen überholen, und der frühere galt
 * dann wieder (Migration 131).
 */
export function neuabstimmungNachRueckkommen<
	T extends {
		nummer: number;
		ueberholungsart?: Ersetzungsart | null;
		rueckkommensantragId?: string | null;
	}
>(dazu: T[], massgebend: T | null): T | null {
	if (!massgebend || dazu.length === 0) return null;
	const letzter = dazu.reduce((a, b) => (b.nummer > a.nummer ? b : a));
	return letzter.nummer > massgebend.nummer &&
		letzter.ueberholungsart === 'korrektur' &&
		letzter.rueckkommensantragId
		? letzter
		: null;
}

/**
 * Die Nummer des Durchgangs, der nach einer Neuabstimmung auf den Durchgang
 * nach dem Rückkommen wieder gilt; sonst null. Für den Satz auf der
 * Leitungsseite (`Rueckkommenslage.geltenderDurchgang`).
 */
export function geltendNachNeuabstimmung<
	T extends {
		nummer: number;
		ueberholungsart?: Ersetzungsart | null;
		rueckkommensantragId?: string | null;
	}
>(dazu: T[], massgebend: T | null): number | null {
	return massgebend && neuabstimmungNachRueckkommen(dazu, massgebend) ? massgebend.nummer : null;
}

/**
 * Der Satz im Saal nach einem Rückkommen, das keinen Beschluss ergab
 * (`docs/freigabe.md`, «Gebaut: Rückkommen, Reste 1 bis 3», Punkt 1).
 *
 * Massgebend ist dann weiter der frühere Durchgang, und Leitung und Wand
 * zeigen dessen Ergebnis, etwa «Angenommen», direkt nachdem der Saal erneut
 * abgestimmt hat. Ohne diesen Satz liest sich das wie das Ergebnis des eben
 * geschlossenen Durchgangs. Eine Ablehnung endet seit dem 30.09.2026 nicht
 * hier, sie ersetzt («Nein heisst Nein»).
 */
export function ohneBeschlussNachRueckkommen(
	nummer: number,
	geltenderDurchgang: number,
	geltendAbgelehnt: boolean,
	/**
	 * Warum kein Beschluss: der kurze Grund ohne Namen (`keinBeschlussKurz`
	 * ohne «Kein Beschluss: »), oder `stichentscheid`, wenn er offen ist. Ohne
	 * Grund denkt der Saal an eine Panne (Laienprüfung 30.09.2026, Reste, L1).
	 */
	grund: string | 'stichentscheid' | null
): string {
	const bleibt = geltendAbgelehnt
		? `Es bleibt bei der Ablehnung aus dem ${geltenderDurchgang}. Durchgang`
		: `Es bleibt beim Beschluss aus dem ${geltenderDurchgang}. Durchgang`;
	if (grund === 'stichentscheid') {
		return (
			`Im ${nummer}. Durchgang nach dem Rückkommen ist der Stichentscheid nicht festgestellt. ` +
			`${bleibt}, bis eine Neuabstimmung entscheidet.`
		);
	}
	return (
		`Im ${nummer}. Durchgang nach dem Rückkommen kam kein Beschluss zustande` +
		`${grund ? ` (${grund})` : ''}. ${bleibt}.`
	);
}

/** Der Grund für `ohneBeschlussNachRueckkommen` aus der Auszählung des Durchgangs. */
export function grundOhneBeschluss(
	a: { stichentscheidOffen?: boolean; keinBeschluss?: KeinBeschluss | null } | null | undefined
): string | 'stichentscheid' | null {
	if (a?.stichentscheidOffen) return 'stichentscheid';
	return a?.keinBeschluss ? keinBeschlussKurz(a.keinBeschluss).replace(/^Kein Beschluss: /, '') : null;
}

/**
 * Der jüngste Durchgang, der als Rückkommen ohne Beschluss nach dem
 * massgebenden liegt; sonst null. Für Wand und Leitung.
 */
export function rueckkommenOhneBeschlussNach<
	T extends { nummer: number; ueberholungsart?: Ersetzungsart | null }
>(dazu: T[], massgebend: T | null): T | null {
	if (!massgebend) return null;
	const spaeter = dazu.filter(
		(d) => d.nummer > massgebend.nummer && d.ueberholungsart === 'rueckkommen_erfolglos'
	);
	return spaeter.length > 0 ? spaeter.reduce((a, b) => (b.nummer > a.nummer ? b : a)) : null;
}

/**
 * Der jüngste zweite Durchgang nach Eintritt der Beschlussfähigkeit, der den
 * früheren Beschluss **nicht angenommen** hat (abgelehnt oder ohne Beschluss);
 * sonst null. Für Wand und Leitung, dasselbe Muster wie
 * `rueckkommenOhneBeschlussNach`.
 *
 * **Nur später als der massgebende.** Wird nach einem gescheiterten direkten
 * Durchgang erneut ein Beschluss von Hand festgehalten, bleibt der gescheiterte
 * Durchgang als `nachquorum_erfolglos` stehen; ohne diese Schranke nennte der
 * Satz dann einen früheren Durchgang als den zweiten (Codeprüfung 03.10.2026).
 */
export function ohneAnnahmeNachQuorumNach<
	T extends { nummer: number; ueberholungsart?: Ersetzungsart | null }
>(dazu: T[], massgebend: T | null): T | null {
	if (!massgebend) return null;
	const spaeter = dazu.filter(
		(d) => d.nummer > massgebend.nummer && d.ueberholungsart === 'nachquorum_erfolglos'
	);
	return spaeter.length > 0 ? spaeter.reduce((a, b) => (b.nummer > a.nummer ? b : a)) : null;
}

/**
 * Der Satz der Wand und der Leitungsseite, wenn der zweite Durchgang nach
 * Eintritt der Beschlussfähigkeit den früheren Beschluss nicht angenommen hat.
 *
 * **Derselbe Wortlaut wie im Protokoll** (`nachQuorumSatz`, S4): Die Leser
 * dürfen nicht auseinanderlaufen, und die Sätze sind dort durch Laien- und
 * Fachprüfung gegangen. `lage` ist der Ausgang des gescheiterten Durchgangs
 * (`ergebnislage`): «abgelehnt» nennt die Ablehnung, alles andere (kein
 * Beschluss, offener Stichentscheid) lässt den Grund offen. `geltendAbgelehnt`
 * unterscheidet, ob der frühere Durchgang selbst eine Ablehnung war — dann
 * steht dort keine «Beschluss», den es nie gab (Codeprüfung 03.10.2026).
 */
export function ohneAnnahmeNachQuorum(
	nummer: number,
	geltenderDurchgang: number,
	lage: 'angenommen' | 'abgelehnt' | 'kein_beschluss' | 'offen',
	geltendAbgelehnt: boolean
): string {
	const bleibt = geltendAbgelehnt
		? `es bleibt bei der Ablehnung aus dem ${geltenderDurchgang}. Durchgang.`
		: `der Beschluss aus dem ${geltenderDurchgang}. Durchgang bleibt in Kraft.`;
	return lage === 'abgelehnt'
		? `Im ${nummer}. Durchgang wurde der Antrag abgelehnt; ${bleibt}`
		: `Ein Beschluss kam im ${nummer}. Durchgang nicht zustande; ${bleibt}`;
}

/** Wie ein ersetzter Durchgang im Protokoll heisst. */
export function ersetzungInWorten(art: Ersetzungsart, grund: string | null): string {
	if (art === 'rueckkommen') {
		return (
			'Dieser Beschluss wurde ersetzt: Die Versammlung ist auf das Traktandum zurückgekommen ' +
			'und hat neu entschieden. Er bleibt hier festgehalten, weil er bis zum neuen Beschluss ' +
			'galt.'
		);
	}
	if (art === 'rueckkommen_erfolglos') {
		// **Kein Beschluss, also keine Änderung.** Der Durchgang hat stattgefunden
		// und ist gezählt; abgeändert hat er nichts. Seit dem 30.09.2026 nur noch
		// ohne Beschluss: Eine Ablehnung ersetzt den früheren («Nein heisst Nein»).
		return (
			// Auch eine Universalversammlung, die nicht hielt, endet hier
			// (Migration 128), wie im Protokoll.
			'Auf das Traktandum wurde zurückgekommen und erneut abgestimmt. Ein Beschluss kam ' +
			'dabei nicht zustande; der frühere Beschluss bleibt in Kraft.'
		);
	}
	return `Dieser Durchgang wurde überholt${grund ? `: ${grund}` : ''}. Er zählt nicht.`;
}

/**
 * Ein gestellter Rückkommensantrag — so viel, wie zum Rechnen nötig ist.
 *
 * **Warum das hier steht und nicht in der Seite** (24.08.2026, Frage des Auftraggebers
 * «geht ein Gleichrechnen nicht?»). Die Leitung eines Hauses rechnete den Stand
 * eines Rückkommensantrags in ihrer eigenen Ladefunktion aus; die Steuerung des
 * gemeinsamen Abends konnte das nicht abschreiben und fragte deshalb gröber —
 * bloss «steht ein Antrag», nicht «wirkt er noch». Die Folge war ein
 * Unterschied, den niemand sehen konnte: Am Abend blieb «Nochmals abstimmen»
 * versperrt, wenn irgendwann einmal ein Antrag gestellt und abgelehnt worden
 * war. Zwei Rechnungen für dieselbe Frage; jetzt eine.
 */
export interface Rueckkommensantrag {
	id: string;
	nummer: string;
	/** Auf welches Traktandum er zielt. Null heisst: Er ist keiner. */
	zielId: string | null;
	/** Wann er im Saal aufgenommen wurde — der jüngste gilt. */
	aufgenommenAm?: string | null;
}

/**
 * Der **jüngste** Rückkommensantrag zu einem Geschäft.
 *
 * Nicht der erste: Seit ein erledigter Antrag einen zweiten Anlauf zulässt,
 * kann es mehrere geben. Dieselbe Ordnung wie beim Eröffnen im Server
 * (`oeffneAbstimmung`) — jüngster zuerst, bei gleicher Zeit die höhere Kennung.
 * Nicht die Baumreihenfolge: Traktanden lassen sich während der Sitzung
 * verschieben, und dann zeigte die Seite einen Stand, nach dem nicht
 * entschieden wird.
 */
export function juengsterRueckkommensantrag<T extends Rueckkommensantrag>(
	antraege: T[],
	zielId: string
): T | null {
	return (
		antraege
			.filter((a) => a.zielId === zielId)
			.sort(
				(a, b) =>
					(a.aufgenommenAm ?? '').localeCompare(b.aufgenommenAm ?? '') ||
					a.id.localeCompare(b.id)
			)
			.at(-1) ?? null
	);
}

/** Wie weit ein Rückkommensantrag ist — und ob er schon einen Durchgang trug. */
export function standDesRueckkommensantrags(
	antragId: string,
	/** Alle Durchgänge der Versammlung, mit dem Antrag, auf den sie sich stützen. */
	durchgaenge: {
		rueckkommensantragId?: string | null;
		ueberholungsart?: Ersetzungsart | null;
		zustand?: string;
	}[],
	/** Der massgebende Durchgang **des Antrags** — null, wenn noch keiner besteht. */
	ueberDenAntrag: { offen: boolean; angenommen: boolean | null } | null
): {
	stand: 'unbehandelt' | 'laeuft' | 'angenommen' | 'abgelehnt';
	verbraucht: boolean;
	/** Ein Durchgang, der sich auf ihn stützt, ist gerade offen (`rueckkommenWirktNoch`). */
	traegtOffenen?: boolean;
} {
	/*
	 * Verbraucht ist er, sobald sich ein Durchgang auf ihn stützt, der nicht
	 * durch eine Neuabstimmung überholt ist (`verbrauchtDenRueckkommensantrag`).
	 *
	 * **An welchem Traktandum, zählt nicht mehr** (Codeprüfung B1). Bis zum
	 * 30.09.2026 zählte nur ein Durchgang am Ziel. Seit ein Folgeantrag statt
	 * des alten Antrags zur Abstimmung kommen darf (Produktentscheid
	 * 30.09.2026), trägt auch dessen Durchgang das Rückkommen, und der Server
	 * zählt ihn mit (`leseRueckkommen`). Die Seite hielt das Rückkommen danach
	 * für unverbraucht und bot am Grundantrag «Abstimmung freigeben» an, das
	 * der Server abwies. Der Durchgang **über den Rückkommensantrag selbst**
	 * stützt sich auf keinen und zählt deshalb weiterhin nicht.
	 */
	const verbraucht = durchgaenge.some(
		(d) =>
			d.rueckkommensantragId === antragId &&
			verbrauchtDenRueckkommensantrag(d.ueberholungsart ?? null)
	);
	const traegtOffenen = durchgaenge.some(
		(d) => d.rueckkommensantragId === antragId && d.zustand === 'offen'
	);
	if (!ueberDenAntrag) return { stand: 'unbehandelt', verbraucht, traegtOffenen };
	if (ueberDenAntrag.offen) return { stand: 'laeuft', verbraucht, traegtOffenen };
	return {
		stand: ueberDenAntrag.angenommen === true ? 'angenommen' : 'abgelehnt',
		verbraucht,
		traegtOffenen
	};
}

/**
 * Ob ein Rückkommensantrag zu diesem Geschäft **noch wirkt** — dann steht
 * daneben kein zweiter.
 *
 * Erledigt ist er, wenn die Versammlung ihn abgelehnt hat oder wenn er seinen
 * einen Durchgang bereits getragen hat. In beiden Fällen darf ein neuer
 * gestellt werden: Beschlüsse der Versammlung sind abänderbar, soweit sie keine
 * Gestaltungswirkung entfalten und nicht bereits realisiert wurden (Rz. 202a ad
 * Art. 712g); was die Sperre verhindern soll, sind zwei Anträge nebeneinander,
 * nicht ein zweiter Anlauf.
 */
export function rueckkommenWirktNoch(
	stand: {
		stand: 'unbehandelt' | 'laeuft' | 'angenommen' | 'abgelehnt';
		verbraucht: boolean;
		traegtOffenen?: boolean;
	} | null
): boolean {
	if (!stand) return false;
	if (stand.stand === 'abgelehnt') return false;
	/*
	 * **Solange sein Durchgang offen ist, wirkt er noch** (Codeprüfung B2a, M1).
	 * Liegt dieser Durchgang an einem Folgeantrag, sperrt `durchgangOffen` am
	 * Grundantrag nicht, und ein zweiter Rückkommensantrag bekäme Wortlaut und
	 * Mehr eines Beschlusses, den der offene Durchgang gleich ersetzt. Derselbe
	 * Grund steht im Server (`stelleRueckkommensantrag`).
	 */
	if (stand.stand === 'angenommen' && stand.verbraucht && !stand.traegtOffenen) return false;
	return true;
}

/**
 * Die Lage an einem Geschäft, über das bereits abgestimmt wurde.
 *
 * **Der Anlass, am 20.08.2026.** «Zu diesem Traktandum steht bereits ein
 * Rückkommensantrag. — Wenn ein Rückkommensantrag steht, müssten doch die
 * Teilnehmer darüber abstimmen können. Wie du siehst, funktioniert das nicht.»
 *
 * Es funktionierte — nur fand es niemand. Der Antrag entsteht als eigenes
 * Traktandum am Ende der Liste, und keine Zeile sagte, dass er dort steht und
 * aufgerufen werden will. Stattdessen stand am behandelten Geschäft weiterhin
 * «Abstimmung freigeben», und jeder Klick endete in derselben roten Absage.
 *
 * **Warum die Auskunft hier steht und nicht in der Seite.** Es ist dieselbe
 * Frage, die `verlangeNeuenDurchgangZulaessig` beim Abschicken stellt. Zwei
 * Fassungen liefen auseinander, und dann böte die Seite einen Knopf an, den der
 * Server abweist — genau der Fehler, der hier behoben wird.
 */
export interface Rueckkommenslage {
	/** Ob am Geschäft ein geschlossener, nicht überholter Durchgang steht. */
	abgestimmt: boolean;
	/** Der Rückkommensantrag dazu, falls einer gestellt wurde. */
	antrag: {
		/** Die Nummer, unter der er in der Liste steht — sie ist der Wegweiser. */
		nummer: string;
		/** Wie weit er ist. */
		stand: 'unbehandelt' | 'laeuft' | 'angenommen' | 'abgelehnt';
		/** Ob auf ihn bereits ein Durchgang gestützt wurde. */
		verbraucht: boolean;
		/** Ob dieser Durchgang noch offen ist (`standDesRueckkommensantrags`). */
		traegtOffenen?: boolean;
		/** Die Nummer des Traktandums, an dem er offen ist, für den Satz dazu. */
		offenBei?: string | null;
	} | null;
	/**
	 * Nach einer Neuabstimmung auf den Durchgang nach dem Rückkommen: die Nummer
	 * des Durchgangs, der wieder gilt (`neuabstimmungNachRueckkommen`). Dann
	 * nennt der Satz ihn, statt «der bisherige»: Das letzte Ergebnis auf dem
	 * Bildschirm ist das eben überholte (Laienprüfung 29.09.2026).
	 */
	geltenderDurchgang?: number | null;
	/**
	 * Der geltende Durchgang wurde von Hand festgehalten, ohne dass die
	 * Versammlung beschlussfähig war, und die Gemeinschaft lässt den direkten
	 * Weg zu (`domain/neuabstimmung.ts`). Dann braucht der zweite Durchgang
	 * kein Rückkommen, und die Auskunft nennt die Wahl der Sitzungsleitung.
	 *
	 * Nur, solange **kein** Rückkommensantrag gestellt ist: Hat die Versammlung
	 * bereits über ein Rückkommen entschieden, bleibt es bei diesem Weg.
	 */
	direktNachQuorum?: { nummer: number; beschlussfaehig: boolean } | null;
	/**
	 * Nur beim Folgeantrag, dessen Grundantrag entschieden ist. Dann trägt nur
	 * ein angenommenes, unverbrauchtes Rückkommen auf den **Grundantrag** einen
	 * Durchgang über den Folgeantrag (Produktentscheid 30.09.2026), und
	 * `antrag` ist der Rückkommensantrag auf den Grundantrag, nicht auf den
	 * Folgeantrag. `eigenerDurchgang`: Über den Folgeantrag wurde schon vor dem
	 * Grundantrag abgestimmt; dieselbe Angabe wie beim Eröffnen
	 * (`rueckkommenZuEroeffnen`).
	 */
	grundantrag?: {
		titel: string;
		eigenerDurchgang: boolean;
		/**
		 * Der Durchgang, der zur Sache gilt, und die Nummer seines Traktandums:
		 * Ohne diese Angabe hiess es am Folgeantrag «bleibt es beim bisherigen
		 * Ergebnis», und nach einer Neuabstimmung war offen, welches gemeint ist
		 * (Codeprüfung B2a, N1).
		 */
		geltend?: { durchgang: number; traktandum: string } | null;
		/**
		 * Ob dieser geltende Beschluss angenommen ist. Nach einem Rückkommen auf
		 * eine Ablehnung bleibt es mit Nein bei einer Ablehnung, und die Ansage
		 * vor dem Freigeben sagt das (Fachprüfung Runde 2, R2-1). Fehlt die
		 * Angabe, gilt angenommen, die strengere Ansage.
		 */
		geltendAngenommen?: boolean;
		/** Der Titel des Folgeantrags selbst, für die Ansage im Saal (Laienprüfung Runde 3, 5d-6). */
		folgeantragTitel?: string;
	} | null;
}

/** Was die Sitzungsleitung als Nächstes tun kann — die Seite macht daraus einen Knopf. */
export type Rueckkommensweg = 'antrag_aufrufen' | 'rueckkommen_beantragen' | null;

export interface Rueckkommensauskunft {
	/** Ob jetzt ein Durchgang eröffnet werden darf. */
	abstimmbar: boolean;
	/** Was gilt, in einem Satz und ohne Fachwort. */
	satz: string;
	/** Der nächste Schritt, wenn die Anwendung dorthin führen kann. */
	weg: Rueckkommensweg;
}

/**
 * Was am Geschäft gilt — und was als Nächstes zu tun ist.
 *
 * **Kein Satz endet in einer Sackgasse.** Wer im Saal vor vierzehn Leuten
 * steht, hat keine Zeit, eine Absage zu deuten: Jede Auskunft nennt entweder
 * den nächsten Schritt oder den Grund, warum es keinen gibt.
 */
export function rueckkommensauskunft(lage: Rueckkommenslage): Rueckkommensauskunft {
	if (lage.grundantrag) return auskunftZumFolgeantrag(lage, lage.grundantrag);

	if (!lage.abgestimmt) {
		return { abstimmbar: true, satz: '', weg: null };
	}

	if (!lage.antrag) {
		/*
		 * **Direkt neu abstimmen nach Eintritt der Beschlussfähigkeit**
		 * (Produktentscheid 03.10.2026). Der frühere Durchgang wurde von Hand
		 * ohne Beschlussfähigkeit festgehalten, und die Gemeinschaft lässt den
		 * direkten Weg zu: Die Sitzungsleitung kann den gewohnten zweiten
		 * Durchgang eröffnen. Der Hinweis sagt die Wirkung und lässt ihr die
		 * Wahl; die Anwendung hält sie nicht auf.
		 */
		if (lage.direktNachQuorum) {
			return {
				abstimmbar: true,
				satz: direktNachQuorumSatz(
					lage.direktNachQuorum.nummer,
					lage.direktNachQuorum.beschlussfaehig
				),
				weg: null
			};
		}
		return {
			abstimmbar: false,
			satz:
				'Über dieses Geschäft ist abgestimmt. Ein zweiter Durchgang braucht einen Beschluss ' +
				'der Versammlung: Beantragen Sie das Rückkommen — im Ablauf beim aufgerufenen ' +
				`Geschäft unter «Nochmals abstimmen». ${AUCH_WENN_FEHLERHAFT}`,
			weg: 'rueckkommen_beantragen'
		};
	}

	if (lage.antrag.stand === 'unbehandelt') {
		return {
			abstimmbar: false,
			satz:
				`Der Rückkommensantrag steht als Traktandum ${lage.antrag.nummer} in der Liste. ` +
				'Rufen Sie ihn auf und lassen Sie die Versammlung darüber abstimmen — erst wenn er ' +
				'angenommen ist, kann hier nochmals abgestimmt werden.',
			weg: 'antrag_aufrufen'
		};
	}

	if (lage.antrag.stand === 'laeuft') {
		return {
			abstimmbar: false,
			satz:
				`Über den Rückkommensantrag (Traktandum ${lage.antrag.nummer}) wird gerade ` +
				'abgestimmt. Schliessen Sie ihn zuerst.',
			weg: 'antrag_aufrufen'
		};
	}

	if (lage.antrag.stand === 'abgelehnt') {
		return {
			abstimmbar: false,
			// **Der frühere Beschluss gilt.** Der Rückkommensantrag selbst ist
			// abgelehnt; widerrufen wurde nichts (Rz. 202a ad Art. 712g).
			satz:
				'Die Versammlung ist nicht auf dieses Geschäft zurückgekommen — der frühere ' +
				'Beschluss gilt. Ein neuer Anlauf braucht einen neuen Rückkommensantrag; er lässt ' +
				'sich im Ablauf unter «Nochmals abstimmen» stellen.',
			weg: 'rueckkommen_beantragen'
		};
	}

	if (lage.antrag.verbraucht && lage.antrag.traegtOffenen) {
		// Der Durchgang, den das Rückkommen trägt, läuft noch, nach dem
		// Produktentscheid vom 30.09.2026 auch an einem Folgeantrag. Der Satz
		// darunter wiese sonst auf «Nochmals abstimmen», das jetzt gesperrt ist
		// (Codeprüfung B2a, N-b).
		return {
			abstimmbar: false,
			// Mit der Nummer: Am Grundantrag läuft keine, und ohne sie musste die
			// Leitung suchen, welche gemeint ist (Laienprüfung 30.09.2026, 5c).
			satz: lage.antrag.offenBei
				? `Nach dem Rückkommen (Traktandum ${lage.antrag.nummer}) wird gerade über Traktandum ` +
					`${lage.antrag.offenBei} abgestimmt. Schliessen Sie diese Abstimmung zuerst.`
				: `Nach dem Rückkommen (Traktandum ${lage.antrag.nummer}) läuft die Abstimmung noch, ` +
					'auch wenn sie an einem Gegenantrag stattfindet. Schliessen Sie sie zuerst.',
			weg: null
		};
	}

	if (lage.antrag.verbraucht) {
		return {
			abstimmbar: false,
			satz:
				'Auf dieses Geschäft wurde bereits zurückgekommen und neu abgestimmt. Ein weiterer ' +
				'Durchgang braucht einen neuen Rückkommensantrag — ein angenommener trägt genau ' +
				'einen Durchgang. Stellen lässt er sich im Ablauf unter «Nochmals abstimmen».',
			weg: 'rueckkommen_beantragen'
		};
	}

	return zurueckgekommen(lage.antrag.nummer, lage.geltenderDurchgang);
}

/** Nach einem angenommenen, unverbrauchten Rückkommen: Der Durchgang darf eröffnet werden. */
function zurueckgekommen(
	antragNummer: string,
	geltenderDurchgang: number | null | undefined,
	/** Die Nummer des Traktandums, an dem er liegt, wenn es nicht dieses ist. */
	zuTraktandum?: string
): Rueckkommensauskunft {
	return {
		abstimmbar: true,
		satz:
			`Die Versammlung ist zurückgekommen (Traktandum ${antragNummer}). Dieser ` +
			// Ja und Nein ersetzen das bisherige Ergebnis, nur ohne Beschluss
			// bleibt es (Produktentscheid 30.09.2026, «Nein heisst Nein»).
			'Durchgang entscheidet die Sache neu, mit Ja wie mit Nein; kommt gar kein Beschluss ' +
			'zustande, ' +
			// «Ergebnis», nicht «Beschluss … in Kraft»: War der Antrag dort
			// abgelehnt, hört der Saal sonst «beschlossen» (Laienprüfung Runde 2).
			(geltenderDurchgang
				? `bleibt es beim Ergebnis des ${geltenderDurchgang}. Durchgangs` +
					(zuTraktandum ? ` zu Traktandum ${zuTraktandum}.` : '.')
				: 'bleibt es beim bisherigen Ergebnis.'),
		weg: null
	};
}

/**
 * Die Auskunft am Folgeantrag, dessen Grundantrag entschieden ist.
 *
 * **Dieselbe Prüfung wie beim Eröffnen** (`verlangeFolgeantragNachRueckkommen`,
 * Codeprüfung B1). Bis zum 30.09.2026 las die Leitungsseite hier nur den
 * Folgeantrag selbst: Ein vorher aufgenommener, noch nicht abgestimmter
 * Folgeantrag hiess «abstimmbar», und «Abstimmung freigeben» endete in der
 * Absage des Servers. Die Absage wird hier nicht nachformuliert, sondern
 * übernommen; zwei Fassungen desselben Satzes liefen auseinander.
 */
function auskunftZumFolgeantrag(
	lage: Rueckkommenslage,
	grundantrag: NonNullable<Rueckkommenslage['grundantrag']>
): Rueckkommensauskunft {
	const a = lage.antrag;
	try {
		verlangeFolgeantragNachRueckkommen(
			a ? { angenommen: a.stand === 'angenommen', verbraucht: a.verbraucht } : null,
			grundantrag.titel,
			grundantrag.eigenerDurchgang
		);
	} catch (e) {
		if (!(e instanceof FachlicherFehler)) throw e;
		return {
			abstimmbar: false,
			satz: e.message,
			// Der Rückkommensantrag auf den Grundantrag wartet auf seine Abstimmung.
			weg: a && (a.stand === 'unbehandelt' || a.stand === 'laeuft') ? 'antrag_aufrufen' : null
		};
	}
	const frei = zurueckgekommen(
		a!.nummer,
		grundantrag.geltend?.durchgang ?? null,
		grundantrag.geltend?.traktandum
	);
	/*
	 * **Vor dem Freigeben ansagen, was Ja und Nein bewirken** (Fachprüfung
	 * 30.09.2026, F-2; Laienprüfung 5d). War der bisherige Beschluss eine
	 * Annahme, fällt er mit Ja wie mit Nein; wer ihn behalten will, kann nur
	 * vorher etwas tun. Vor der Abstimmung müssen sich die Eigentümer äussern
	 * können (Rz. 97 ad Art. 712n); den Satz am Stimmzettel sehen die im Saal
	 * nicht. Mit dem nächsten Schritt, wenn sich jemand meldet (Runde 2, R2-2),
	 * und nach einem Rückkommen auf eine Ablehnung ohne die falsche Warnung
	 * (R2-1). Nicht «wer ihn behalten will»: Das verspräche, dass er bleibt,
	 * wenn sich jemand meldet (Laienprüfung Runde 2, 5d-2).
	 */
	const angenommen = grundantrag.geltendAngenommen !== false;
	const dieser = grundantrag.folgeantragTitel ? `«${grundantrag.folgeantragTitel}»` : 'dieser Antrag';
	const bisher = `«${grundantrag.titel}»`;
	/*
	 * Die Ansage in Anführungszeichen, mit den Titeln: Im Saal hat niemand den
	 * Bildschirm, und die Leitung muss sehen, wo die Ansage endet (Laienprüfung
	 * Runde 3, 5d-4, 5d-6). «hält keine Stimme» statt «behalten lässt sich»,
	 * damit der folgende Satz über den bisherigen Antrag nicht wie ein
	 * Widerspruch klingt (5d-5). Die Zählung per Handzeichen nach Stimmen, nicht
	 * nach Händen (Fachprüfung Runde 3, F3-1; Rz. 26 ad Art. 712m), und die
	 * Notiz in jedem Fall (5d-7).
	 */
	return {
		...frei,
		satz:
			`${frei.satz} Sagen Sie vor dem Freigeben an: «` +
			(angenommen
				? `Mit Ja gilt ${dieser} an Stelle des bisherigen Beschlusses zu ${bisher}. Mit Nein ist ` +
					'zu dieser Sache nichts mehr angenommen; den bisherigen Beschluss hält in dieser ' +
					'Abstimmung keine Stimme. '
				: `Mit Ja gilt ${dieser}. Mit Nein bleibt es bei einer Ablehnung. `) +
			`Wer stattdessen nochmals über ${bisher} abstimmen will, soll das jetzt sagen.» ` +
			'Meldet sich jemand, entscheidet die Versammlung darüber als Ordnungsantrag mit einfachem ' +
			'Mehr, per Handzeichen; Vertreter zählen für jede Vollmacht, Zugeschaltete fragen Sie ' +
			'einzeln. Nimmt sie ihn an, geben Sie diesen Antrag nicht frei, sondern rufen den ' +
			'bisherigen auf. Halten Sie den Ordnungsbeschluss in jedem Fall als Notiz bei diesem ' +
			'Traktandum fest.'
	};
}

/**
 * **Folgeanträge mit eigenem Beschluss neben dem Grundantrag** (Fachprüfung
 * 08.10.2026, `quellen/pruefung/berichte/2026-10-08-votum-rueckkommen-fragen-fach.md`,
 * Frage 2). Im gewöhnlichen Ablauf wird über den Folgeantrag vor dem
 * Grundantrag abgestimmt, und Votum lässt danach auch den Grundantrag
 * abstimmen. Ist der Folgeantrag angenommen, steht sein Beschluss für sich: Ein
 * Rückkommen auf den Grundantrag nennt ihn nicht, und ein Beschluss fällt nur
 * durch einen Beschluss, der ihn erfasst (Rz. 202a ad Art. 712g; Rz. 133b ad
 * Art. 712n; BGer 5C.254/2006 E. 3.2.1 und 3.3).
 *
 * Gezählt wird nur ein **eigener** Durchgang des Folgeantrags. Trat er nach
 * einem Rückkommen an die Stelle des alten Antrags (`rueckkommensantragId`),
 * ist sein Beschluss der zur Sache: Ein weiteres Rückkommen auf den
 * Grundantrag nennt ihn im Wortlaut und hebt ihn auf (Plan Folgeantrag nach
 * Rückkommen, Soll 7).
 *
 * **Steht ein solcher Ersetzer, nennt die Auswahl keinen mehr**
 * (Produktentscheid 15.10.2026, aus der Codeprüfung M3). Dann ist die Leitung
 * genau den Weg gegangen, den der Hinweis nennt; ob der neue Wortlaut den
 * früheren Folgeantrag aufhebt, kann die Anwendung nicht lesen, und «gilt
 * auch» stünde als Behauptung da. Wird der Ersetzer später selbst ersetzt,
 * kommt der Hinweis zurück: lieber einmal zu viel als still.
 */
export function folgeantraegeMitEigenemBeschluss<D extends Durchgang & { rueckkommensantragId?: string | null }>(
	grundantragId: string,
	traktanden: {
		id: string;
		nummer: string;
		titel: string;
		parentId: string | null;
		spontanart?: string | null;
		/** Beim Rückkommensantrag: das Traktandum, auf das er zurückkommt. */
		rueckkommenZielId?: string | null;
	}[],
	durchgaenge: D[],
	angenommen: (durchgang: D) => boolean
): { nummer: string; titel: string }[] {
	const gefunden: { nummer: string; titel: string }[] = [];
	const ziel = new Map(traktanden.map((t) => [t.id, t.rueckkommenZielId ?? null]));
	const folgeantraege = traktanden.filter((t) => t.spontanart === 'folgeantrag' && t.parentId === grundantragId);
	const ersetzerSteht = folgeantraege.some((t) => {
		const m = massgebender(durchgaenge.filter((d) => d.traktandumId === t.id));
		return (
			!!m &&
			m.zustand === 'geschlossen' &&
			!!m.rueckkommensantragId &&
			ziel.get(m.rueckkommensantragId) === grundantragId
		);
	});
	if (ersetzerSteht) return gefunden;
	for (const t of traktanden) {
		if (t.spontanart !== 'folgeantrag' || t.parentId !== grundantragId) continue;
		const m = massgebender(durchgaenge.filter((d) => d.traktandumId === t.id));
		if (!m || m.zustand !== 'geschlossen') continue;
		// Nur ein Rückkommen auf den Grundantrag macht den Beschluss zu dem der
		// Sache. Eines auf den Folgeantrag selbst (solange der Grundantrag offen
		// war) lässt ihn eigen.
		if (m.rueckkommensantragId && ziel.get(m.rueckkommensantragId) === grundantragId) continue;
		if (angenommen(m)) gefunden.push({ nummer: t.nummer, titel: t.titel });
	}
	return gefunden;
}

/**
 * Der Hinweis an die Leitung dazu. **Ein Hinweis, keine Sperre**: Ob der
 * Beschluss zum Folgeantrag fallen soll, entscheidet die Versammlung, und die
 * Anwendung hält das Rückkommen nicht auf. Neben den Sätzen zum Rückkommen,
 * nicht in ihnen (H6): Die enden mit `AUCH_WENN_FEHLERHAFT` und sagen nichts
 * über den Folgeantrag.
 *
 * Der Weg, den er nennt, ist gemessen: Nach dem angenommenen Rückkommen lässt
 * sich ein weiterer Gegenantrag aufnehmen und statt des alten abstimmen, auch
 * wenn über einen früheren Folgeantrag schon abgestimmt ist
 * (`tests/db/folgeantrag-nach-rueckkommen.test.ts`).
 */
export function folgeantragBleibtHinweis(folgeantraege: { nummer: string; titel: string }[]): string | null {
	if (folgeantraege.length === 0) return null;
	const genannt = folgeantraege.map((f) => `${f.nummer} «${f.titel}»`);
	const liste =
		genannt.length === 1 ? genannt[0] : `${genannt.slice(0, -1).join(', ')} und ${genannt.at(-1)}`;
	const einer = folgeantraege.length === 1;
	/*
	 * Laienprüfung 15.10.2026: «mit dem neuen Beschluss zum Grundantrag» statt
	 * «nicht sicher», das nach Ausrede klang und neben dem Vorbehalt («hebt den
	 * bisherigen auf») wie ein Widerspruch las (H1-c). Der Gegenantrag regelt
	 * die Sache neu und hebt den Folgeantrag darin auf: Ein reiner
	 * Aufhebungsantrag ersetzte auch den Beschluss zum Grundantrag (H1-a). Der
	 * Knopf heisst «Gegenantrag», der Eintrag «Folgeantrag» (H1-b).
	 */
	return (
		(einer
			? `Zu dieser Sache gilt auch der Beschluss zum Folgeantrag ${liste}. Das Rückkommen nennt ihn nicht; mit dem neuen Beschluss zum Grundantrag fällt er deshalb nicht weg. `
			: `Zu dieser Sache gelten auch die Beschlüsse zu den Folgeanträgen ${liste}. Das Rückkommen nennt sie nicht; mit dem neuen Beschluss zum Grundantrag fallen sie deshalb nicht weg. `) +
		(einer ? 'Soll er nicht mehr gelten, ' : 'Sollen sie nicht mehr gelten, ') +
		// «vollständig, auch was gleich bleibt»: Ein Antrag, der nur aufhebt, nähme
		// den Beschluss zum Grundantrag mit (Laienprüfung Runde 2, H1-1).
		'nehmen Sie nach dem angenommenen Rückkommen unter «Gegenantrag» einen Antrag auf, der die Sache ' +
		'vollständig neu regelt, auch was gleich bleiben soll, und darin ' +
		(einer ? 'den Beschluss zum Folgeantrag' : 'die Beschlüsse zu den Folgeanträgen') +
		' ausdrücklich aufhebt, und bringen Sie ihn statt des bisherigen Antrags zur Abstimmung. ' +
		(einer
			? 'Sonst bleibt er neben dem neuen Beschluss bestehen.'
			: 'Sonst bleiben sie neben dem neuen Beschluss bestehen.')
	);
}
