/**
 * Freigabe und Rücknahme (Story 3.5, FR-9, AD-3, AD-10, AD-1).
 *
 * Mit der Freigabe ist die Versammlung einberufen, und der Stimmberechtigtenstand
 * wird eingefroren. Ab diesem Zeitpunkt rechnet keine Auswertung mehr auf den
 * lebenden Stammdaten: Ein Eigentümerwechsel im März darf das Ergebnis der
 * Februar-Versammlung nicht verändern.
 *
 * Die Rücknahme **verwirft** die Momentaufnahme vollständig. Eine teilweise
 * Fortschreibung gäbe es nicht — sie wäre ein Zwitter, bei dem niemand sagen
 * könnte, welcher Stand gilt. Bei erneuter Freigabe entsteht sie neu.
 */
import { FachlicherFehler } from './gemeinschaft';
import { stimmkraftliste } from './stimmkraft';
import type { Snapshot } from './types';
import { verlangeZustand, type Versammlung } from './versammlung';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';

/**
 * Ein Grund, der die Freigabe verhindert.
 *
 * Getrennt von den blossen Hinweisen: Was hier steht, macht die Versammlung
 * unbrauchbar. Ein fehlendes Mehrheitserfordernis dagegen lässt sich noch im
 * Saal nachholen und darf die Einladung nicht aufhalten. **Eine gewollte
 * Ausnahme:** die Ausschlussklage ohne beklagte Partei. Nachholen liesse sie
 * sich im Saal, aufhalten soll sie trotzdem, weil der Antrag die Person vor
 * dem Versand nennen soll (Produktentscheid 29.09.2026).
 */
export interface Hindernis {
	kennung: string;
	text: string;
	/** Wohin die Sitzungsleitung muss, um es zu beheben. */
	weg?: string;
}

export interface Freigabebefund {
	moeglich: boolean;
	hindernisse: Hindernis[];
	/** Was auffällt, aber nicht aufhält. */
	hinweise: Hindernis[];
}

/**
 * Wer einberufen darf, als Satz bei der Freigabe (Produktentscheid 24.09.2026).
 *
 * **Warum überhaupt**, obwohl das Werkzeug nicht fragt, wer einberuft, und es
 * auch künftig nicht soll: Die Freigabe **ist** die Einberufung, und die
 * unzuständige Einberufung ist der eine Mangel dieser Seite, für den das
 * Bundesgericht die Nichtigkeit als Rechtsfolge nennt (BGer 5A_48/2022
 * E. 6.1.2.2; ebenso Wermelinger Rz. 212 ad Art. 712m). Was sonst an der
 * Freigabe entstehen kann, endet bei der Anfechtbarkeit; die zwei übrigen
 * Nichtigkeitsfälle der Einberufung entstehen beim Versand (unten). Deshalb ein
 * Satz, kein Pflichtfeld und keine Sperre.
 *
 * **Warum der Absatz mit der Handlung beginnt und den Anlassfall nennt.** Die
 * erste Fassung sagte nur «die Verwaltung», und wer die Seite liest, ist die
 * Verwaltung. Beide Prüfungen fanden, dass sie darin eine Bestätigung liest
 * und weiterklickt, gerade im Fall, für den der Satz da ist: vor Beginn oder
 * nach Ende des Mandats. Der Übergang zwischen zwei Verwaltungen ist genau der
 * Sachverhalt von 5A_48/2022, deshalb auch der Satz, wer dann einberuft.
 *
 * Geprüft von Laien- und Fachprüfung, zwei Durchgänge. Die Endfassung setzt
 * Gegenwortlaute beider zweiter Durchgänge neu zusammen und ist als Ganzes
 * nicht ein drittes Mal geprüft; den Satz zu «jeder Eigentümer» hat nur die
 * Fachprüfung gesehen, die ihn vorgeschlagen hat. Einzelheiten:
 * `quellen/pruefung/zu-pruefen-2026-09-24-einberufungszustaendigkeit.md`.
 * Dort steht auch, warum die zwei weiteren Nichtigkeitsfälle aus Rz. 68 ad
 * Art. 712n (Nichtzustellung, Versammlung ohne Einladung) hier nicht stehen:
 * Sie gehören zum Versand, nicht zur Freigabe.
 *
 * Eine Konstante, weil zwei Seiten sie führen (die einzelne Versammlung und der
 * gemeinsame Versammlungstag). Zwei Wortlaute einer Rechtsaussage laufen beim
 * nächsten Befund auseinander.
 */
export const EINBERUFUNGSZUSTAENDIGKEIT =
	'Vor der Freigabe klären, wer einberufen darf: die Verwaltung, sofern Versammlung oder ' +
	'Reglement nichts anderes bestimmen (ZGB Art. 712n Abs. 1). Nicht zuständig ist sie ' +
	'etwa vor Beginn oder nach Ende ihres Mandats oder wenn das Reglement die Einberufung ' +
	'anderen vorbehält. Ist keine Verwaltung im Amt und bestimmt das Reglement niemanden, ' +
	'darf jeder Eigentümer einberufen (BGer 5A_48/2022 E. 6.1.2.1). Fehlt die ' +
	'Zuständigkeit, können die Beschlüsse nichtig sein, also auch nach Ablauf der ' +
	'Anfechtungsfrist angreifbar (BGer 5A_48/2022 E. 6.1.2.2).';

export interface Freigabelage {
	/** Der Stichtag, auf den der Eigentümerstand gelesen wird. */
	versammlungsdatum: string;
	anzahlTraktanden: number;
	/** Traktanden der Art «abstimmung» ohne gesetztes Erfordernis. */
	ohneErfordernis: { nummer: string; titel: string }[];
	/** Traktanden mit Erfordernis vom Typ «grenzfall». */
	grenzfaelle: { nummer: string; titel: string }[];
	/** Abweichungen der Stammquote je Ebene. Leer heisst: geht auf. */
	quotenabweichungen: { ebene: string; abweichung: number }[];
	einheitenOhneEigentuemer: { label: string }[];
	anzahlParteien: number;
	/**
	 * Ermächtigungen zur Ausschlussklage ohne benannte beklagte Partei
	 * (Produktentscheid 29.09.2026). Fehlt das Feld, gilt: keine.
	 */
	ausschlussklageOhneBeklagten?: { nummer: string; titel: string }[];
	/**
	 * Einsprachen nach Art. 712c Abs. 2 ohne eingetragene betroffene Partei
	 * (ab Fassung 2026-10-20, wie die Ausschlussklage). Fehlt das Feld: keine.
	 */
	einspracheOhneBetroffene?: { nummer: string; titel: string }[];
	/**
	 * Traktanden, deren Mehr nach einer anderen Lesart gebildet ist als der, die
	 * die Freigabe einfriert (Migration 169; Rest aus Lesarten Block 1, Review
	 * DeepSeek). Fehlt das Feld: keine.
	 */
	lesartVeraltet?: { nummer: string; titel: string; grund?: VeraltetGrund }[];
}

/**
 * Warum ein Traktandum an einer Karte mit L17 veraltet ist: das Mehr passt
 * nicht mehr (`fondsentnahme`), oder nur das Häkchen zum Satz an der Karte hat
 * gewechselt (`haekchen`, Migration 198).
 */
export type VeraltetGrund = 'fondsentnahme' | 'haekchen';

/**
 * Die Absage an einem Traktandum zur Bezahlung aus dem Erneuerungsfonds, dessen
 * Mehr nicht mehr zu den Regeln und der Lesart L17 passt (Codeprüfung L17, M1).
 * Dort kann auch eine bloss geänderte Regel das Mehr ändern: Fundstelle
 * berichtigt, Regel gelöscht, eine fallgenaue neben die allgemeine gesetzt.
 * «Lesarten umgestellt» nennte dann die falsche Ursache.
 */
export const FONDSENTNAHME_VERALTET =
	'Das Mehr eines Traktandums zur Bezahlung aus dem Erneuerungsfonds stimmt nicht mehr mit den Regeln und der ' +
	// Laienprüfung Runde 6 (R6-L-3): Vor der Freigabe ist noch nicht eingeladen.
	'Lesart L17 Ihrer Gemeinschaft überein. Leiten Sie es auf der Reglementseite neu her und geben Sie dann frei; ' +
	'die Einladung nennt das neue Mehr.';

/**
 * Die Absage, wenn an einem Traktandum zur Bezahlung aus dem Erneuerungsfonds
 * der Teil zum Häkchen «Begründungsakt oder Zustimmung aller» nicht mehr passt
 * (Migration 198; Entscheid des Auftraggebers vom 18.11.2026, «Auch Häkchen
 * einfrieren»). Ab der Freigabe zeigt die Karte den Satz von damals.
 *
 * **Als Zustand, nicht als Änderung** (Codeprüfung N1, Laienprüfung L-1 und
 * L-3, 18.11.2026): Den Grund gibt es auch, wo niemand das Häkchen angefasst
 * hat (L17 von «svit» auf «streng» zurückgestellt, vor Migration 198
 * hergeleitet), und wo zugleich die Schwelle einer Regel mit derselben
 * Fundstelle wechselte; «hat sich geändert» und «Das Mehr bleibt gleich» wären
 * dort falsch. Die Prüfung des Häkchens steht vor dem Herleiten (L-1).
 */
export const FONDSENTNAHME_HAEKCHEN_VERALTET =
	'Der Hinweis an der Karte eines Traktandums zur Bezahlung aus dem Erneuerungsfonds passt nicht mehr zum ' +
	'Häkchen «Begründungsakt oder Zustimmung aller» an seiner Regel. Die Freigabe hielte ihn so fest. ' +
	'Prüfen Sie, ob das Häkchen stimmt. Leiten Sie das Traktandum dann auf der Reglementseite neu her und ' +
	'geben Sie frei.';

/** Der Satz zu einem veralteten Traktandum, nach seinem Grund. */
export function veraltetInWorten(t: { titel: string; grund?: VeraltetGrund }): string {
	if (t.grund === 'haekchen') return `${FONDSENTNAHME_HAEKCHEN_VERALTET} Betroffen ist «${t.titel}».`;
	return t.grund === 'fondsentnahme' ? `${FONDSENTNAHME_VERALTET} Betroffen ist «${t.titel}».` : lesartVeraltetInWorten(t.titel);
}

/**
 * Der Satz, wenn ein Traktandum nach einer anderen Lesart rechnet als der, die
 * die Freigabe einfriert. Eine Stelle für das Hindernis auf der Seite und die
 * Absage der Freigabe selbst, damit beide dasselbe sagen.
 */
export function lesartVeraltetInWorten(titel: string): string {
	return (
		`Die Lesarten der Gemeinschaft wurden umgestellt, nachdem «${titel}» sein Mehr bekam. ` +
		'Ziehen Sie das Mehr auf der Seite «Lesarten» der Gemeinschaft nach und geben Sie dann frei.'
	);
}

/**
 * Prüft, ob freigegeben werden darf.
 *
 * Die Trennung in Hindernis und Hinweis ist der ganze Punkt dieser Funktion.
 * Würde alles blockieren, gäbe es bald einen Weg daran vorbei; würde nichts
 * blockieren, entstünde eine Momentaufnahme, auf der sich nicht rechnen lässt.
 */
export function pruefeFreigabe(lage: Freigabelage): Freigabebefund {
	const hindernisse: Hindernis[] = [];
	const hinweise: Hindernis[] = [];

	if (lage.anzahlTraktanden === 0) {
		hindernisse.push({
			kennung: 'keine_traktanden',
			text: 'Die Versammlung hat kein Traktandum. Eine Einladung ohne Geschäfte lädt zu nichts ein.',
			weg: 'traktanden'
		});
	}

	// Der Wertquotensaldo ist ein Hindernis und kein Hinweis: Geht er nicht auf,
	// ist jede Auszählung nach Wertquoten falsch — und zwar unbemerkt, weil eine
	// Mehrheit auch von einer falschen Bezugsgrösse aus errechnet wird.
	for (const a of lage.quotenabweichungen) {
		hindernisse.push({
			kennung: 'quotensaldo',
			text:
				`Die Wertquoten von «${a.ebene}» gehen nicht auf: Es fehlen ${a.abweichung} ` +
				`Anteile beziehungsweise es sind ${-a.abweichung} zu viel. Jede Auszählung nach ` +
				`Wertquoten wäre falsch, ohne dass es auffiele.`,
			weg: 'einheiten'
		});
	}

	if (lage.einheitenOhneEigentuemer.length > 0) {
		const namen = lage.einheitenOhneEigentuemer.map((e) => e.label).join(', ');
		hindernisse.push({
			kennung: 'ohne_eigentuemer',
			text:
				`Ohne Eigentümer am ${lage.versammlungsdatum}: ${namen}. Diese Einheiten fehlten in ` +
				'jeder Zählung, und die Wertquotensumme ginge nicht auf, ohne dass ersichtlich wäre, ' +
				'warum. Gelesen wird der Stand zum **Versammlungsdatum** — beginnt eine Zuordnung ' +
				'erst danach, zählt sie hier noch nicht. Bei einer nachträglich erfassten Versammlung ' +
				'ist das der häufigste Grund.',
			weg: 'eigentuemer'
		});
	}

	for (const t of lage.ausschlussklageOhneBeklagten ?? []) {
		hindernisse.push({
			kennung: 'ausschlussklage_ohne_beklagten',
			text:
				`Traktandum ${t.nummer}, «${t.titel}», ermächtigt zur Ausschlussklage, aber niemand ist ` +
				'als beklagt eingetragen; im Saal stimmte die beklagte Partei sonst mit. Tragen Sie sie ' +
				'am Traktandum unter «Beklagte Partei» ein. Die Einladung zeigt nur den Antrag: Nennen ' +
				'Sie die Person auch dort.',
			weg: 'traktanden'
		});
	}

	for (const t of lage.einspracheOhneBetroffene ?? []) {
		hindernisse.push({
			kennung: 'einsprache_ohne_betroffene',
			text:
				`Traktandum ${t.nummer}, «${t.titel}», betrifft eine Einsprache, aber niemand ist als ` +
				'betroffen eingetragen. Im Saal stimmte sonst mit, wer verkauft, vermietet oder ' +
				'belastet. Tragen Sie diese Partei am Traktandum unter «Betroffene Partei» ein; sie ' +
				'stimmt dann nicht mit.',
			weg: 'traktanden'
		});
	}

	/*
	 * **Vor dem Klick, nicht erst danach** (Rest aus Lesarten Block 1, Review
	 * DeepSeek). Die Freigabe sagte schon ab (`pruefeLesartenDerTraktanden`),
	 * aber der Knopf stand aktiv da, und die Seite nannte den Grund erst nach
	 * dem Versuch.
	 */
	for (const t of lage.lesartVeraltet ?? []) {
		hindernisse.push({
			kennung: 'lesart_veraltet',
			text: veraltetInWorten(t),
			weg: t.grund ? 'reglement' : 'lesarten'
		});
	}

	if (lage.anzahlParteien === 0) {
		hindernisse.push({
			kennung: 'keine_parteien',
			text: 'Es ist kein Eigentümer erfasst. Dann wäre niemand stimmberechtigt.',
			weg: 'eigentuemer'
		});
	}

	// Ab hier: auffällig, aber kein Grund, die Einladung aufzuhalten.
	for (const t of lage.ohneErfordernis) {
		hinweise.push({
			kennung: 'ohne_erfordernis',
			text: `Für «${t.nummer} ${t.titel}» steht das Mehrheitserfordernis noch nicht fest.`,
			weg: 'traktanden'
		});
	}

	for (const t of lage.grenzfaelle) {
		hinweise.push({
			kennung: 'grenzfall',
			text:
				`«${t.nummer} ${t.titel}» ist als Grenzfall eingeordnet. Entscheiden Sie vor der ` +
				`Versammlung, welches Erfordernis gilt — im Saal ist es dafür zu spät.`,
			weg: 'traktanden'
		});
	}

	return { moeglich: hindernisse.length === 0, hindernisse, hinweise };
}

/**
 * Der Übergang in den Zustand «freigegeben».
 *
 * Die Momentaufnahme kommt als Wert herein und wird nicht hier gebaut: Der Kern
 * liest keine Datenbank. Er prüft aber, dass sie zur Versammlung gehört und
 * nicht leer ist — eine leere Momentaufnahme wäre eine Versammlung ohne
 * Stimmberechtigte, und das fiele erst bei der ersten Auszählung auf.
 */
export function gibFrei(
	v: Versammlung,
	befund: Freigabebefund,
	momentaufnahme: Snapshot
): Uebergang<Versammlung> {
	verlangeZustand(v, ['entwurf'], 'freigeben');

	if (!befund.moeglich) {
		throw new FachlicherFehler(
			'freigabe_gesperrt',
			befund.hindernisse.map((h) => h.text).join(' '),
			'freigabe'
		);
	}

	if (momentaufnahme.meetingId !== v.id) {
		throw new FachlicherFehler(
			'momentaufnahme_fremd',
			'Der festgehaltene Stand gehört zu einer anderen Versammlung.',
			'momentaufnahme'
		);
	}
	if (momentaufnahme.parties.length === 0) {
		throw new FachlicherFehler(
			'momentaufnahme_leer',
			'Im festgehaltenen Stand ist niemand stimmberechtigt.',
			'momentaufnahme'
		);
	}

	// Die Kennzahlen der Momentaufnahme entstehen aus derselben Funktion, die
	// später zählt. Stünden sie hier aus einer eigenen Rechnung, könnten die
	// Zahlen der Freigabe von denen der Auswertung abweichen.
	const liste = stimmkraftliste(momentaufnahme);

	return uebergang(
		{ ...v, zustand: 'freigegeben' },
		ereignis(
			EREIGNISARTEN.versammlungFreigegeben,
			{ art: 'meeting', id: v.id },
			{
				parteien: momentaufnahme.parties.length,
				kopfstimmen: liste.summeKopfstimmen,
				wertquoten: liste.summeWertquote,
				gesamtquote: momentaufnahme.totalQuota,
				zaehlweise: momentaufnahme.headCountMode,
				// Die Hinweise ausdrücklich mitschreiben: Wurde trotz offenem
				// Erfordernis eingeladen, soll das später nicht rekonstruiert werden
				// müssen.
				offeneHinweise: befund.hinweise.map((h) => h.text)
			}
		)
	);
}

/**
 * Der Übergang zurück in den Entwurf.
 *
 * Nur vor der Eröffnung. Danach ist die Momentaufnahme unveränderlich — es
 * wurde bereits auf ihr gerechnet, und ein neuer Stand machte jede bisherige
 * Feststellung unbelegbar (AD-3).
 */
export function nimmFreigabeZurueck(v: Versammlung, grund?: string): Uebergang<Versammlung> {
	verlangeZustand(v, ['freigegeben'], 'die Freigabe zurücknehmen');

	return uebergang(
		{ ...v, zustand: 'entwurf' },
		ereignis(
			EREIGNISARTEN.freigabeZurueckgenommen,
			{ art: 'meeting', id: v.id },
			{
				grund: grund?.trim() || null,
				// Ausdrücklich vermerkt: Die Momentaufnahme ist weg, nicht bloss
				// überschrieben. Bei erneuter Freigabe entsteht sie neu und kann
				// andere Zahlen tragen.
				momentaufnahmeVerworfen: true
			}
		)
	);
}
