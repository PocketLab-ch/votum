/**
 * Warnungen am Mehrheitserfordernis eines Traktandums, vor der Abstimmung
 * (Block 3 der Freigabeliste, 17.10.2026; Zweitprüfung vom 17.09.2026, Ä-11,
 * Ä-15, Ä-20).
 *
 * **Warnungen, keine Sperren** (Produktlinie aus Block 2: Votum empfiehlt, die
 * Leitung entscheidet). Jeder Satz sagt, was gilt und was Votum rechnet; keiner
 * hält ein Eröffnen auf.
 *
 * **Fest, ohne Anwesenheit.** Was hier steht, hängt allein am Erfordernis, am
 * Knoten seiner Fassung, an der Stufe der Versammlung und, für den Hinweis an
 * der Einsprache (19.10.2026), an der Zählweise. Die Zählweise geben die
 * Aufrufer aus derselben Quelle wie die Auszählung: ab der Freigabe die
 * Momentaufnahme, vorher die Gemeinschaft (Codeprüfung Durchgang 3, N1). Es steht deshalb
 * schon in der Vorbereitung. Ob eine Mehrheit mit den Anwesenden erreichbar
 * ist, rechnet `erreichbarkeitshinweis` in `auszaehlung.ts` am Abend.
 *
 * **Der Knoten kommt von aussen**, aus der Fassung des Erfordernisses, wie bei
 * `umstrittenSatz`: Der Kern darf das Regelwerk nicht laden.
 */
import { fondsgrenzeKartensatz, type Fondsgrenze } from './fondsgrenze';
import type { Ergebnisknoten } from './regelwerk';
import { einspracheZaehlweiseHinweis, RUECKKOMMEN_TITEL, type Erfordernis } from './entscheidbaum';
import type { HeadCountMode } from './types';
import type { Versammlungsstufe } from './beschlussfaehigkeit';
import { anteilInWorten, type Beschlussfaehigkeitsregel } from './beschlussfaehigkeit';
import { zahlwort } from './einladung';
import { mitQuelle } from './gemeinschaft';
import type { Schwelle } from './mehrheit';
import {
	ausstandslesartSatz,
	lesartVon,
	type Neutraktandenwahl,
	type Verwaltungsvollmachtwahl
} from './lesarten';
import { kopfzaehlweiseWirkt, NOTWENDIGE_ARBEITEN_ARTIKEL, type Ausstandsbeschlussfaehigkeit } from './lesarten';
import type { Verwaltungsangabe } from './verwaltungsangabe';

/** Ein Bruch, der die ganze Bezugsgrösse verlangt: die Zustimmung aller. */
function alle(s: Schwelle | null | undefined): boolean {
	return !!s && s.zaehler === s.nenner && s.art === 'mindestens';
}

/**
 * Der Streit um die Kopfbasis «aller», für den Satz in der Vorbereitung und
 * den am Abend (Fachprüfung 17.10.2026, Stelle 2, Befund 2).
 *
 * **Votum rechnet streng, der Kommentar nicht.** Bei der Einstimmigkeit
 * verlangt die herrschende Lehre die Zustimmung sämtlicher Eigentümer;
 * Wermelinger lässt die der Anwesenden und Vertretenen genügen, ausdrücklich
 * nur bei der luxuriösen Massnahme (Rz. 197 ad Art. 712m; Fachprüfung
 * 22.10.2026, siehe unten). Bei der Ermächtigung zur Ausschlussklage zählt Wermelinger die
 * Anwesenden und Vertretenen ohne den Beklagten, Strittmatter alle (Rz. 214
 * ad Art. 712a; ebenso Rz. 166b ad Art. 712m). Ohne den Satz trat «misst sich
 * an allen» als gesichert auf, und eine Leitung verschob eine Ermächtigung,
 * die nach dem Kommentar zustande gekommen wäre.
 *
 * **Nicht «nach dem Wortlaut»** bei der Ausschlussklage (Fachprüfung Runde 3,
 * Befund 2.1): Bis zur Fassung 2026-10-24 fielen Angehörige im Ausstand dort
 * still aus der Zahl, Votum rechnete dann milder als Art. 649b Abs. 2. Ab
 * 2026-10-25 bleiben sie darin (1e); der Satz bleibt vorsichtig, weil er auch
 * Traktanden älterer Fassungen trägt.
 *
 * `null` unter «die Anwesenden»: Dort gibt es nichts zu streiten.
 */
export function kopfbasisStreit(
	e: Pick<
		Erfordernis,
		'kopfbasis' | 'kopfSchwelle' | 'quelle' | 'knotenId' | 'gemeinschaftslesart' | 'lesartDesBeschlusses'
	> &
		Partial<Pick<Erfordernis, 'fassung' | 'typ' | 'rechtsgrundlage' | 'enthaltungZaehltMit' | 'titel'>>
): {
	satz: string;
	streitig: boolean;
	mildereBedingung?: 'qualifiziert';
	/** Der Satz zu L13; neben dem Kartensatz zu L13 entfällt er (Endfassung Block C, Abschnitt 5). */
	nachZaehlweise?: true;
} | null {
	if (e.kopfbasis === 'anwesend_vertreten') return null;
	/*
	 * **Unter L13 «Alle Eigentümer» ist die Zählung die der Gemeinschaft**
	 * (Fassung 2026-11-14; Endfassung Block C, Abschnitt 5), eigener Zweig wie
	 * L9: kein `streitig`, denn die Gemeinschaft hat gewählt, und das zweite
	 * Ergebnis nennt die Zählung unter den Anwesenden. Steht der Kartensatz zu
	 * L13 auf derselben Ansicht, lässt der Aufrufer ihn weg (`nachZaehlweise`).
	 */
	const nachZaehlweise =
		e.fassung !== undefined &&
		e.typ !== undefined &&
		e.rechtsgrundlage !== undefined &&
		kopfzaehlweiseWirkt({ ...e, fassung: e.fassung, typ: e.typ, rechtsgrundlage: e.rechtsgrundlage });
	/*
	 * **Am Rückkommen ein eigener Satz** (Codeprüfung Block C, Lauf 2, M-A;
	 * Fachprüfung Nachtrag Runde 2, N2-F-3): ohne den Teil zum Sachbeschluss
	 * (M1) und ohne `streitig`. Sonst rückte der allgemeine Satz unten nach, mit
	 * «umstritten» und «nach seiner strengen Lesart», wo die Gemeinschaft die
	 * Zählung eingestellt hat.
	 */
	if (nachZaehlweise && e.titel?.startsWith(RUECKKOMMEN_TITEL)) {
		return {
			satz:
				'Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern, wie am ' +
				'Beschluss selbst; die herrschende Lehre zählt nur die Anwesenden und Vertretenen.',
			streitig: false
		};
	}
	if (nachZaehlweise && e.rechtsgrundlage !== undefined) {
		return {
			satz:
				'Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern. Erreicht ' +
				'ein Antrag die Mehrheit der Anwesenden und Vertretenen, aber nicht die aller Eigentümer, weist ' +
				'Votum ihn als abgelehnt aus; nach der herrschenden Lehre wäre er angenommen.' +
				(e.rechtsgrundlage.startsWith(NOTWENDIGE_ARBEITEN_ARTIKEL)
					? ' Bei notwendigen Arbeiten kann jeder Eigentümer beim Gericht verlangen, dass sie angeordnet ' +
						'werden (ZGB Art. 647 Abs. 2 Ziff. 1).'
					: ''),
			streitig: false,
			nachZaehlweise: true
		};
	}
	/*
	 * **Eine Reglementsklausel sagt «aller» selbst**: Dort gibt es keinen
	 * Streit um die Lesart des Gesetzes, nur die Klausel.
	 */
	if (e.quelle === 'reglement') {
		return {
			satz: 'Das Reglement zählt die Köpfe hier an allen Eigentümern, auch an den abwesenden.',
			streitig: false
		};
	}
	/*
	 * **Unter L9 an der Ausschlussklage ist die Zählbasis die der Gemeinschaft**
	 * (Fassung 2026-11-10, Lesart L9): Der Streit um die Zahl ist dort
	 * entschieden, die Gemeinschaft hat gewählt, und die Lesart nennt das
	 * Ergebnis an der anderen Zahl. Der Satz «das ist umstritten» im Zweig
	 * darunter wäre daneben falsch; deshalb kein `streitig`. Unter der milden
	 * Wahl kommt der Zweig nicht zum Zug, weil `kopfbasisStreit` bei
	 * `anwesend_vertreten` oben schon `null` gibt. Traktanden älterer Fassungen
	 * tragen keine L9 und fallen in den Zweig darunter.
	 */
	const lesart = e.gemeinschaftslesart ?? e.lesartDesBeschlusses;
	if (lesart?.kennung === 'L9') {
		return {
			satz:
				'Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern ' +
				'ausser dem Beklagten, auch an den abwesenden (ZGB Art. 649b Abs. 2). Wer die Mehrheit ' +
				// Fachprüfung E1 L9, F-4: «sicher» nur im Streit um die Zahl.
				'aller ausser dem Beklagten erreicht, ist im Streit um die Zahl auf der sicheren Seite.',
			streitig: false
		};
	}
	if (e.kopfbasis === 'alle_ausser_betroffene') {
		return {
			satz:
				// «dem Beklagten» wie im Wortlaut (Laien- und Fachprüfung Block 6, L6-8 und
				// F6-5): «den Betroffenen» las sich, als fielen die Angehörigen im Ausstand mit heraus.
				'Votum zählt die Köpfe hier an allen Eigentümern ausser dem Beklagten, auch an den ' +
				'abwesenden (ZGB Art. 649b Abs. 2). Der Kommentar lässt die ' +
				'Mehrheit der Anwesenden und Vertretenen genügen; das ist umstritten (Wermelinger, ' +
				'Rz. 214 ad Art. 712a). Wer die Mehrheit aller ausser dem Beklagten erreicht, ist auf ' +
				'der sicheren Seite.',
			streitig: true
		};
	}
	/*
	 * «Zustimmung aller», nicht «Mehrheit aller» (Laien- und Fachprüfung
	 * 17.10.2026, Runde 2, Befunde 2.1 und 3.1): Die Knoten mit dieser Basis
	 * sind Einstimmigkeiten, und sieben von zwölf sind die Mehrheit aller.
	 */
	const einstimmig = alle(e.kopfSchwelle);
	if (!einstimmig) {
		return {
			satz:
				'Votum zählt die Köpfe hier an allen Eigentümern, auch an den abwesenden. Ob nur die ' +
				'Anwesenden und Vertretenen zählen, ist umstritten (Wermelinger, Rz. 166b ad ' +
				'Art. 712m). Wer die Mehrheit aller erreicht, ist auf der sicheren Seite.',
			streitig: true
		};
	}
	/*
	 * **Unter L12 an der luxuriösen Massnahme ist die Zählung die der
	 * Gemeinschaft** (Fassung 2026-11-10, Lesart L12): Der Streit um die
	 * Zählbasis ist dort entschieden, die Gemeinschaft hat gewählt, und die
	 * Lesart nennt das Ergebnis nach der anderen Wahl. Der Satz «verkündet
	 * Votum nach seiner strengen Lesart trotzdem eine Ablehnung» in
	 * `auszaehlung.ts` wäre daneben doppelt und falsch; deshalb kein
	 * `streitig`. Unter der milden Wahl kommt der Zweig nicht zum Zug, weil
	 * `kopfbasisStreit` bei `anwesend_vertreten` oben schon `null` gibt: Dort
	 * gibt es nichts zu streiten. Traktanden älterer Fassungen tragen keine L12
	 * und fallen in den Zweig darunter.
	 */
	if (lesart?.kennung === 'L12' && e.knotenId === 'k-baulich-luxurioes') {
		return {
			satz: 'Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern, auch an den abwesenden. Wer die Zustimmung aller Eigentümer hat, ist auf der sicheren Seite.',
			streitig: false
		};
	}
	/*
	 * **Der Streit um die Zählung nur an der luxuriösen Massnahme**
	 * (Fachprüfung nachträgliche Zustimmung, Runde 9, F9-2, 22.10.2026): Rz. 197
	 * ad Art. 712m lässt die Zustimmung der Anwesenden und Vertretenen
	 * ausdrücklich nur dort genügen; für die Vereinbarungen verlangt Rz. 8a die
	 * Unterschrift aller, für Art. 712g Abs. 2 der Wortlaut «aller». Bis dahin
	 * nannte dieser Satz den Streit an jeder Einstimmigkeit (Fachprüfung
	 * 17.10.2026), und die Leitung stellte eine Anfechtung in Aussicht, die keine
	 * Stelle trägt. An den beiden Reglementskarten ist schon die Einstimmigkeit
	 * strittig: ob das qualifizierte Mehr genügt (eigene Schranke Rz. 40 und 125,
	 * Sonderinhalt Rz. 125 und 126 ad Art. 712g).
	 */
	if (e.knotenId === 'k-baulich-luxurioes') {
		return {
			satz:
				'Votum zählt die Köpfe hier an allen Eigentümern, auch an den abwesenden. Ob die ' +
				'Zustimmung der Anwesenden und Vertretenen genügt, ist umstritten (Wermelinger, Rz. 197 ' +
				'ad Art. 712m). Wer die Zustimmung aller Eigentümer hat, ist auf der sicheren Seite.',
			streitig: true
		};
	}
	/*
	 * **Unter L6 an der eigenen Schranke ist die Klausel die Regel der
	 * Gemeinschaft** (Fassung 2026-11-05, Lesart L6): Der Streit um die
	 * Zählbasis ist dort entschieden, die Gemeinschaft hat gewählt, und die
	 * Lesart nennt das Ergebnis nach der anderen Wahl. Der Satz «verkündet
	 * Votum nach seiner strengen Lesart trotzdem eine Ablehnung» in
	 * `auszaehlung.ts` wäre daneben doppelt und falsch, weil die Regel jetzt
	 * die der Gemeinschaft ist; deshalb kein `streitig` und keine
	 * `mildereBedingung`. Traktanden älterer Fassungen tragen keine L6 und
	 * fallen in den Zweig darunter.
	 *
	 * **Am Rückkommen derselbe Satz** (Review DeepSeek 05.11.2026, B2): Es
	 * übernimmt das Mehr ohne die Lesart (`rueckkommen.ts`), und ohne
	 * `lesartDesBeschlusses` sagte die Leitung dort den Streit samt «strenger
	 * Lesart», während der Beschluss die Klausel als Regel der Gemeinschaft
	 * nannte. Ein zweites Ergebnis hat das Rückkommen nicht.
	 */
	if (lesart?.kennung === 'L6' && e.knotenId === 'k-reglement-eigene-schranke') {
		return {
			satz: 'Votum zählt die Köpfe hier nach der Klausel an allen Eigentümern, auch an den abwesenden. Wer die Zustimmung aller Eigentümer hat, ist auf der sicheren Seite.',
			streitig: false
		};
	}
	if (e.knotenId === 'k-reglement-eigene-schranke' || e.knotenId === 'k-reglement-sonderinhalt') {
		// «nicht geklärt» am Sonderinhalt: Rz. 126 sagt nur «möglicherweise»
		// (Fachprüfung Runde 10, am Rand).
		const offen =
			e.knotenId === 'k-reglement-eigene-schranke'
				? 'ist umstritten (Wermelinger, Rz. 40 und 125 ad Art. 712g; BGer 5C.50/2004 E. 4.2)'
				: 'ist nicht geklärt (Wermelinger, Rz. 125 und 126 ad Art. 712g)';
		return {
			satz:
				'Votum zählt die Köpfe hier an allen Eigentümern, auch an den abwesenden. Ob statt der ' +
				`Zustimmung aller das qualifizierte Mehr genügt, ${offen}. Wer die Zustimmung aller ` +
				'Eigentümer hat, ist auf der sicheren Seite.',
			streitig: true,
			mildereBedingung: 'qualifiziert'
		};
	}
	return {
		satz:
			'Votum zählt die Köpfe hier an allen Eigentümern, auch an den abwesenden; so verlangt es ' +
			'die herrschende Lehre (Wermelinger, Rz. 197 ad Art. 712m).',
		streitig: false
	};
}

/**
 * Ä-11: An einer zweiten Versammlung kann eine Mehrheit aller unerreichbar
 * sein.
 *
 * **Fundstellen.** Rz. 42 ad Art. 712p: Beschlussfähig ist die zweite
 * Versammlung mit einem Drittel der Eigentümer, mindestens zwei. Rz. 191 ad
 * Art. 712m: «Für die Berechnung des Mehrs nach Wertquoten dient das gesamte
 * Stockwerkeigentum … als Berechnungsgrundlage.» Bis zur Fachprüfung vom
 * 17.10.2026 stand hier Rz. 124 ad Art. 712a; die Stelle führt die
 * rechnerische Unmöglichkeit als Argument **gegen** ein Mehr aller an und trug
 * die Aussage nicht. Zu den Köpfen `kopfbasisStreit`.
 *
 * Nur wo eine Bezugsgrösse nicht an der Anwesenheit hängt: Köpfe aller (auch
 * ohne die Betroffenen) oder Wertquoten aller. Unter «die Anwesenden» ist jede
 * Mehrheit mit den Erschienenen erreichbar.
 *
 * **Der Schritt steht vor der Versammlung** (Laienprüfung 17.10.2026, Befund
 * 2): Vollmachten lassen sich jetzt einholen, am Abend ist es zu spät.
 */
export function zweitversammlungshinweis(
	e: Pick<
		Erfordernis,
		'typ' | 'kopfbasis' | 'quotenbasis' | 'kopfSchwelle' | 'quotenSchwelle' | 'quelle' | 'knotenId'
	> &
		Partial<Pick<Erfordernis, 'fassung' | 'rechtsgrundlage' | 'enthaltungZaehltMit' | 'titel'>>,
	stufe: Versammlungsstufe
): string | null {
	if (stufe !== 'zweite') return null;
	if (e.typ === 'keine_abstimmung' || e.typ === 'grenzfall') return null;
	// Beim Zirkulationsbeschluss sagt dessen eigener Satz, was gilt (Codeprüfung
	// 17.10.2026, M2): Ein Streit um die Anwesenden widerspräche ihm.
	if (e.knotenId === ZIRKULARBESCHLUSS_KNOTEN) return null;
	const koepfe = !!e.kopfSchwelle && e.kopfbasis !== 'anwesend_vertreten';
	const quoten = !!e.quotenSchwelle && e.quotenbasis === 'alle_quoten';
	if (!koepfe && !quoten) return null;
	const teile = [
		'An einer zweiten Versammlung genügt für die Beschlussfähigkeit ein Drittel der ' +
			'Eigentümer, mindestens zwei (Wermelinger, Rz. 42 ad Art. 712p).'
	];
	/*
	 * Unter L13 steht der Satz zur Zählweise der Köpfe auf der Traktandenseite
	 * schon im Kartensatz daneben (`lesartKartensatz`); dort entfällt er
	 * (Endfassung Block C, Abschnitt 5). Dafür sagt der Hinweis selbst, dass
	 * auch die Köpfe an allen Eigentümern zählen (Fachprüfung Nachtrag, N-F-12):
	 * An der zweiten Versammlung ist das die Aussage, auf die es ankommt.
	 */
	const streit = koepfe ? kopfbasisStreit(e) : null;
	if (streit?.nachZaehlweise) {
		teile.push(
			quoten
				? 'Das Mehr für dieses Traktandum misst sich aber bei den Köpfen an allen Eigentümern ' +
						'(Einstellung Ihrer Gemeinschaft) und bei den Wertquoten an allen Wertquoten der Gemeinschaft, ' +
						'auch an denen der Abwesenden (Wermelinger, Rz. 191 ad Art. 712m, zu den Wertquoten).'
				: 'Das Mehr für dieses Traktandum misst sich aber an allen Eigentümern (Einstellung Ihrer Gemeinschaft).'
		);
	} else {
		if (quoten) {
			teile.push(
				'Das Mehr für dieses Traktandum misst sich bei den Wertquoten aber an allen Wertquoten ' +
					'der Gemeinschaft, auch an denen der Abwesenden (Wermelinger, Rz. 191 ad Art. 712m).'
			);
		}
		if (streit) teile.push(streit.satz);
	}
	teile.push(
		'Erscheinen zu wenige, ist das Mehr rechnerisch nicht zu erreichen. Bitten Sie deshalb ' +
			'schon vor der Versammlung die Abwesenden, sich vertreten zu lassen. An der Versammlung zeigt ' +
			'Votum vor der Abstimmung, ob das Mehr erreichbar ist.'
	);
	return teile.join(' ');
}

/**
 * Ä-15: Eine angewandte Reglementsklausel verlangt die Zustimmung aller, wo
 * das Gesetz ein Mehr genügen lässt.
 *
 * **Fundstelle.** Rz. 173 ad Art. 712m: «So ist es nicht zulässig, für alle
 * Beschlüsse die Einstimmigkeit zu fordern, da in der Folge eine unzulässige
 * Lähmung der gemeinschaftlichen Verwaltung entstehen würde.» Rz. 196: nur in
 * den gesetzlichen Fällen «und allenfalls in anderen Ausnahmesituationen»; eine
 * systematische Einführung «ist rechtsmissbräuchlich».
 *
 * **Nur, wo Votum die Klausel anwendet.** An den Karten mit `vereinbart` wendet
 * es sie nicht an (`einstimmigkeit_ausgeschlossen` in `domain/reglement.ts`,
 * Fachprüfung 07.10.2026); dort sagt die Karte den Grund. Verlangt schon das
 * Gesetz die Zustimmung aller, gibt es nichts zu warnen. Ob es das tut, sagt
 * der Knoten der Fassung; fehlt er, schweigt der Hinweis lieber, als ein
 * gesetzliches Erfordernis zu rügen.
 */
export function einstimmigkeitAusReglement(
	e: Pick<Erfordernis, 'quelle' | 'kopfSchwelle' | 'quotenSchwelle' | 'kopfbasis' | 'knotenId'>,
	knoten: Pick<Ergebnisknoten, 'id' | 'typ'> | undefined
): string | null {
	if (e.quelle !== 'reglement') return null;
	if (!knoten || knoten.id !== e.knotenId || knoten.typ === 'einstimmigkeit') return null;
	if (!alle(e.kopfSchwelle) && !alle(e.quotenSchwelle)) return null;
	const wer = alle(e.kopfSchwelle)
		? e.kopfbasis === 'anwesend_vertreten'
			? 'aller Anwesenden und Vertretenen'
			: 'aller Eigentümer'
		: 'aller Wertquoten';
	/*
	 * Fassung nach der Fachprüfung vom 17.10.2026 (Stelle 4): Rz. 196 empfiehlt
	 * («sollte»), die Grenze liegt bei «alle Beschlüsse» (Rz. 173) und der
	 * «systematischen» Einführung (Rz. 196), nicht bei «viele». Laienprüfung:
	 * «die Lehre» ist kein Begriff, und die Leitung braucht, was sie tut.
	 */
	return (
		`Das Reglement verlangt hier die Zustimmung ${wer}; das Gesetz liesse ein Mehr genügen. ` +
		'Nach der Fachliteratur soll Einstimmigkeit die Ausnahme bleiben; für alle Geschäfte ' +
		'oder systematisch eingeführt, lähmt sie die Gemeinschaft und ist unzulässig ' +
		'(Wermelinger, Rz. 173 und 196 ad Art. 712m). Votum rechnet nach dem Reglement und ' +
		'verkündet das Ergebnis danach. Halten Sie die Bestimmung für unzulässig, lassen Sie das ' +
		'rechtlich prüfen; im Streitfall entscheidet das Gericht.'
	);
}

/**
 * Ä-20: Der Zirkulationsbeschluss als Traktandum.
 *
 * **Fundstelle.** Rz. 124 und 125 ad Art. 712m: Art. 66 Abs. 2 erlaubt den
 * Beschluss «mit schriftlicher Zustimmung sämtlicher Mitglieder»; Rz. 128: Er
 * ist erst mit der letzten Unterschrift gefasst, für die elektronische
 * Unterschrift gilt Art. 14 Abs. 2bis OR, «eine einfache Zustimmung auf einer
 * E-Mail genügt somit nicht».
 *
 * Die Karte selbst sagt schon, dass er kein Traktandum ist. Gewählt werden kann
 * er trotzdem, und dann rechnet Votum im Saal die Zustimmung aller Eigentümer
 * (Zweitprüfung, Ä-20). Der Satz steht, wo die Leitung das Erfordernis sieht.
 */
export const ZIRKULARBESCHLUSS_KNOTEN = 'k-zirkularbeschluss';

/** Der Teil, den beide Fassungen teilen (Codeprüfung 17.10.2026, N-C). */
const ZIRKULARBESCHLUSS_FORM =
	'Ein Zirkulationsbeschluss entsteht nicht durch eine Abstimmung an der Versammlung, ' +
	'sondern schriftlich: Alle Eigentümer unterschreiben den Antrag, von Hand oder mit ' +
	'qualifizierter elektronischer Signatur; eine Zustimmung per E-Mail genügt nicht ' +
	'(Wermelinger, Rz. 124, 125 und 128 ad Art. 712m). Votum rechnet hier im Saal die ' +
	'Zustimmung aller Eigentümer, auch der abwesenden.';

export const ZIRKULARBESCHLUSS_HINWEIS =
	`${ZIRKULARBESCHLUSS_FORM} Soll an der Versammlung beschlossen werden, ändern Sie die ` +
	'nötige Mehrheit und wählen Sie den Fall, um den es inhaltlich geht.';

/**
 * Dieselbe Auskunft im Saal (Codeprüfung 17.10.2026, M1). Der Weg «nötige
 * Mehrheit ändern» trägt dort nicht: Im laufenden Zustand weist
 * `folgeFuerEinladung` jedes mildere Mehr als das der Einladung ab, und jeder
 * inhaltliche Fall ist milder als die Zustimmung aller. Offen bleibt die
 * Verschiebung (Rz. 98a ad Art. 712n). Als Regel von Votum gekennzeichnet,
 * mit dem Grund (Fachprüfung Runde 4, Stelle 5b, Wortlaut übernommen): Das
 * Mehr bestimmt der Vorsitz nach Gesetz und Reglement (Rz. 99 f. ad
 * Art. 712n); das Hindernis ist der Vertrauensschutz der Abwesenden.
 */
export const ZIRKULARBESCHLUSS_HINWEIS_IM_SAAL =
	`${ZIRKULARBESCHLUSS_FORM} In Votum lässt sich ein milderes Mehr als in der Einladung im ` +
	'Saal nicht mehr setzen; die Abwesenden durften sich darauf verlassen, dass ohne ihre ' +
	'Unterschrift nichts beschlossen wird. Die Versammlung kann das Traktandum auf Antrag auf ' +
	'eine spätere Versammlung verschieben (Wermelinger, Rz. 98a ad Art. 712n).';

/**
 * `mehrFest`: Ein milderes Mehr als das gedruckte lässt sich nicht mehr
 * setzen. Das gilt ab der Eröffnung, und nur wo ein Einladungsmehr
 * festgehalten ist (`folgeFuerEinladung`: ohne gedrucktes Mehr ist es frei,
 * etwa bei einem im Saal aufgenommenen Traktandum; Codeprüfung 17.10.2026,
 * M-A und N-D).
 */
export function zirkularbeschlusshinweis(
	e: Pick<Erfordernis, 'knotenId'>,
	mehrFest = false
): string | null {
	if (e.knotenId !== ZIRKULARBESCHLUSS_KNOTEN) return null;
	return mehrFest ? ZIRKULARBESCHLUSS_HINWEIS_IM_SAAL : ZIRKULARBESCHLUSS_HINWEIS;
}

/**
 * Alle festen Warnungen zu einem Erfordernis, in fester Reihenfolge, für die
 * Traktandenseite. `vorBeginn`: Die Versammlung ist im Entwurf oder
 * freigegeben. Danach gilt der Rat «vor der Versammlung» nicht mehr (N2).
 * `mehrFest` wie bei `zirkularbeschlusshinweis`: nach Beginn und nur, wo ein
 * Einladungsmehr festgehalten ist (M-A). Bis zur Featureprüfung von Block 3
 * (18.10.2026) folgte die Saalfassung hier allein aus `vorBeginn` und sagte bei
 * einem im Saal aufgenommenen Traktandum, ein milderes Mehr lasse sich nicht
 * mehr setzen, obwohl es frei ist; die Leitungsseiten fragten schon richtig.
 */
export function mehrhinweise(
	e: Erfordernis | null | undefined,
	knoten: Pick<Ergebnisknoten, 'id' | 'typ'> | undefined,
	stufe: Versammlungsstufe,
	vorBeginn = true,
	mehrFest = false,
	/** Die Zählweise wie in der Auszählung (Momentaufnahme, sonst Gemeinschaft), für die Einsprache. */
	zaehlweise?: HeadCountMode | null,
	/** Was das Reglement zur Einlage in den Erneuerungsfonds sagt (Migration 193), für die Karten zur Einlage. */
	fondsgrenze?: Fondsgrenze | null
): string[] {
	if (!e) return [];
	return [
		zirkularbeschlusshinweis(e, mehrFest),
		einstimmigkeitAusReglement(e, knoten),
		vorBeginn ? zweitversammlungshinweis(e, stufe) : null,
		einspracheZaehlweiseHinweis(e, zaehlweise),
		fondsgrenzeKartensatz(e, fondsgrenze)
	].filter((s): s is string => s !== null);
}

/**
 * Ä-26: Wer im Ausstand ist und Vollmachten hält, kann bei diesem Traktandum
 * auch nicht für andere stimmen.
 *
 * **Fundstellen.** BGE 134 III 481 E. 3.8 (auch Regeste) für den
 * ausgeschlossenen Eigentümer als Vertreter. Für einen Vertreter, der nicht
 * Eigentümer ist, eine Ableitung (Fachprüfung 17.10.2026, Stelle 0): bei der
 * Entlastung Art. 695 Abs. 1 OR («Personen, die in irgendeiner Weise an der
 * Geschäftsführung teilgenommen haben») mit Rz. 145 ad Art. 712q («weder selbst
 * noch über einen Vertreter»), bei Verträgen mit der Verwaltung, etwa ihrer
 * Entschädigung, E. 3.6 und 3.8 sinngemäss. Bei Wahl und Wiederwahl gilt
 * Art. 68 nicht (E. 3.5 und 3.8), die Vollmachten ruhen dort nicht; bei der Abberufung
 * ist es für den Vertreter ohne Eigentum nicht geklärt (`VERTRETERGRENZE`).
 * Rz. 35 ad Art. 712m trägt nur,
 * dass ein Ausstand des Verwalters üblich ist, nicht das Ruhen.
 *
 * **Vor der Versammlung**, auf der Traktandenseite (Produktentscheid
 * 17.10.2026: den Ausstand vorab erklären). Am Abend nennt die Leitungsseite
 * die ruhenden Vollmachten selbst. Eine Ersatzvertretung für ein einzelnes
 * Traktandum führt Votum nicht (Produktentscheid 17.10.2026: nur warnen);
 * der Satz sagt deshalb, dass eine neue Vollmacht für die ganze Versammlung
 * gilt (Laien- und Fachprüfung, Befund 1.2).
 */
/**
 * Wo die Vollmachten eines Vertreters ohne Eigentum ruhen und wo nicht
 * (Fachprüfung 17.10.2026, Runde 2, Wortlaut sinngemäss übernommen). Bei Wahl
 * und Wiederwahl verneint das Bundesgericht den Ausschluss (BGE 134 III 481
 * E. 3.5 und 3.8). Unnötig ruhende Stimmen machen das Mehr falsch berechnet und damit
 * anfechtbar (Rz. 26 ad Art. 712r). Ein Satz für Vorbereitung und Saal.
 *
 * **Abberufung berichtigt** (Fachprüfung zum Handbuch, 18.10.2026, Befund 4.1,
 * am Volltext nachgesehen): Bis dahin hiess es, die Vollmachten ruhten bei der
 * Abberufung «nach der überwiegenden Lehre» nicht, mit Rz. 25 ad Art. 712r.
 * Rz. 25 betrifft nur den Verwalter, der selbst Eigentümer ist; dem Verwalter
 * ohne Eigentum rät Rz. 24, bei der Beschlussfassung den Raum zu verlassen,
 * ebenso Donauer, Rz. 741. Der Kopfkommentar von Migration 167 trägt noch die
 * alte Fassung; er lässt sich nicht ändern (Prüfsumme), gilt aber nicht mehr.
 * Zu den Vollmachten äussert sich keine der Stellen;
 * wer den Raum verlässt, übt aber auch keine aus, und Votum zählt ruhende
 * Vertretungen wie Abwesende. Der Ausstand gehört deshalb nur dorthin, wo die
 * Verwaltung den Raum tatsächlich verlässt; ein Ruhen als Rechtsfolge trägt
 * keine Stelle (Fachprüfung Runde 3, Befund 1). Die Vollmachten bei der Wahl trägt erst E. 3.8 (dort
 * eine bevollmächtigte Nichteigentümerin), nicht E. 3.5 allein. Die Bitte an
 * die Vertretenen steht nicht hier: Im Saal käme sie zu spät, in der
 * Vorbereitung sagt `ausstandMitVollmachten` sie schon.
 */
export const VERTRETERGRENZE =
	'Abgeleitet ist das Ruhen der Vollmachten für Verträge mit der Verwaltung, etwa ihre ' +
	'Entschädigung, und für ihre Entlastung. Bei Wahl und Wiederwahl ruhen sie nach dem ' +
	'Bundesgericht nicht (BGE 134 III 481 E. 3.5 und 3.8); wer sie dort trotzdem ruhen lässt, ' +
	'riskiert die Anfechtung, nehmen Sie den Ausstand dann zurück. Stimmen Sie Wiederwahl und ' +
	'Entschädigung getrennt ab. Bei der Abberufung ist es für einen Vertreter, der nicht ' +
	'Eigentümer ist, nicht geklärt. Die Kommentare raten einer Verwaltung ohne Eigentum, dort den ' +
	'Vorsitz abzugeben und bei der Abstimmung den Raum zu verlassen (Wermelinger, Rz. 24 ad ' +
	'Art. 712r; Donauer, Rz. 741). Den Vorsitz gibt sie dort an einen Eigentümer ab, auch wenn ' +
	'die Versammlung den Wechsel nicht mit dem nötigen Mehr beschliesst. Sonst kann der Beschluss ' +
	'innert eines Monats angefochten werden (ZGB Art. 712m Abs. 2 i.V.m. Art. 75; Wermelinger, ' +
	'Rz. 76a ad Art. 712n). Verlässt sie den Raum, übt sie auch ihre Vollmachten nicht aus; erst ' +
	'dann, im Saal, gehört sie in Votum in den Ausstand, nicht schon vorab. Ob sie ihre ' +
	'Vollmachten ausüben darf, wenn sie bleibt, ist nicht geklärt.';

export function ausstandMitVollmachten(
	name: string,
	vertretene: string[],
	vertreter = false
): string | null {
	if (vertretene.length === 0) return null;
	const liste =
		vertretene.length === 1
			? `«${vertretene[0]}»`
			: `${vertretene.slice(0, -1).map((v) => `«${v}»`).join(', ')} und «${vertretene.at(-1)}»`;
	return (
		`«${name}» hält Vollmachten von ${liste}. Wer im Ausstand ist, kann bei diesem Traktandum ` +
		'auch nicht für andere stimmen' +
		(vertreter
			? ' (BGE 134 III 481 E. 3.8; bei der Entlastung Art. 695 Abs. 1 OR, beides sinngemäss). '
			: ' (BGE 134 III 481 E. 3.8). ') +
		'Diese Stimmen zählen hier nur, wenn die Vertretenen selbst kommen oder jemanden ' +
		'bevollmächtigen, der ' +
		(vertreter ? 'nicht für diesen Vertreter arbeitet oder ihm nahesteht' : `«${name}» nicht nahesteht`) +
		'; eine neue Vollmacht gilt in Votum für die ganze Versammlung. Sagen Sie es ihnen vor der ' +
		'Versammlung.' +
		// Die Grenze nach der Handlung, nicht davor (Laienprüfung zum Handbuch,
		// Runde 3, Befund 5): Sonst steht «Sagen Sie es ihnen» hinter neun
		// Sätzen Recht, und «Diese Stimmen» verliert seinen Bezug.
		(vertreter ? ` ${VERTRETERGRENZE}` : '')
	);
}

/**
 * Der Satz zur Wertquote im Ausstand nach der Vorgabe von L1 (Ä-27,
 * Entscheide 0010 und 0018), mit und ohne Fundstellen. Seit der Lesart L1
 * (Migration 170) bildet ihn `ausstandslesartSatz` je Wahl; diese beiden
 * Konstanten sind die Fassung nach der Vorgabe, für Leser ohne Erfordernis.
 */
export const AUSSTAND_UNGEKLAERT = ausstandslesartSatz('bleibt', true);

/** Dieselbe Aussage ohne Fundstellen, für Leitung, Wand und Telefone (Codeprüfung 3c, 18.10.2026). */
export const AUSSTAND_UNGEKLAERT_KURZ = ausstandslesartSatz('bleibt', false);

/**
 * Dasselbe im Protokoll, nur als Tatsache (Fachprüfung 18.10.2026): Das
 * Protokoll ist das Beweisstück; die offene Rechtsfrage gehört in
 * Vorbereitung und Leitung, nicht in die Urkunde der Gemeinschaft.
 */
export const NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL =
	'Das Traktandum stand in der Einladung zur ersten Versammlung nicht zur Abstimmung.';

/**
 * S15, F4a (L5; Runde 2, Fach F-3, Laien S15-1; geteilt nach Runde 3, T4), Ort 3: Traktandenseite und
 * Sitzungsleitung, wenn die Gemeinschaft das Drittel gewählt hat (Entscheid
 * 0039). Rz. 33 ad Art. 712p: nichtig bei willentlicher schwerer Verletzung
 * der Beschlussfähigkeit; Handschin/Wyttenbach S. 78.
 */
export const L5_OFFEN_DRITTEL =
	// Textwächter: in Sätze unter 180 Zeichen geteilt (Runde 3, T4).
	'Ob das genügt, ist nicht geklärt. Ein Beschluss könnte angefochten werden, unter Umständen sogar nichtig ' +
	'sein (SVIT-Kommentar Rz. 33 ad Art. 712p; Handschin/Wyttenbach S. 78). Nichtig heisst: ungültig auch ' +
	'ohne Anfechtung. Sicher ist er, wenn so viele anwesend oder vertreten sind wie an einer ersten ' +
	'Versammlung.';

/** S15, F4a (L5; Runde 2), Ort 4: derselbe Vorbehalt nach der Vorgabe, im Satz zur anderen Lesart. */
export const L5_OFFEN_ANDERE_LESART =
	'Ob das genügt, ist nicht geklärt; ein solcher Beschluss könnte angefochten werden, unter Umständen sogar ' +
	'nichtig sein.';

/**
 * Was die andere Lesart verlangt, für die Sätze nach der Vorgabe `erste`
 * (Konzept Lesarten, Kriterium 4; Featureprüfung 22.10.2026). Der Name der
 * Wahl kommt aus dem Katalog, der Vorbehalt ist inhaltlich derselbe wie bei
 * der milden Wahl.
 */
function neuAnZweiterAndereLesart(imSaal: boolean): string {
	const name = (wert: Neutraktandenwahl) => lesartVon('L5')!.wahlen.find((w) => w.wert === wert)!.bezeichnung;
	return (
		`Ihre Gemeinschaft hat für neue Geschäfte an der zweiten Versammlung die Lesart «${name('erste')}» ` +
		'eingestellt' +
		// Laienprüfung L-1: ob sich das im Saal noch ändern lässt (eingefroren bei
		// der Freigabe, Kriterium 3).
		(imSaal ? '; eine Umstellung wirkt erst für die nächste Versammlung. ' : '. ') +
		`Nach der anderen Lesart («${name('drittel')}») würde für dieses Traktandum die ` +
		'Beschlussfähigkeit der zweiten Versammlung reichen, nach Gesetz ein Drittel der Eigentümer' +
		// Fachprüfung F-3: im Saal die Ankündigung wie bei der milden Wahl; in der
		// Vorbereitung steht sie schon vorn.
		(imSaal ? ', wenn das Geschäft in der Einladung zur zweiten stand. ' : '. ') +
		L5_OFFEN_ANDERE_LESART
	);
}

/**
 * **L5, die Sätze je Wahl** (Migration 174, Konzept Lesarten Block 7). Ä-17 B
 * (Entscheid 0012) war ein Satz für alle; seit L5 steht er je Wahl und Ort.
 * Nach der Vorgabe `erste` sperrt das Eröffnen, und die Sätze sagen das
 * vorher; die milde Wahl `drittel` ist die Lösung aus 0012.
 *
 * Ob das Drittel genügt, sagt keine Stelle im Bestand; Rz. 49 ad Art. 712p
 * regelt den Inhalt der Einberufung: «Neue Traktanden müssen aber formell
 * korrekt mitgeteilt werden.» Über nicht Angekündigtes darf ohnehin nicht
 * beschlossen werden (Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 3 ZGB). Erreicht
 * die Versammlung das Quorum einer ersten (Abs. 1), ist die Frage ohne Folge;
 * die Leitung zeigt den Satz dann nicht (Fachprüfung 18.10.2026).
 * Anwaltsfrage Nr. 9.
 *
 * `imSaal`: für die Leitung, nur ohne das Quorum einer ersten (sonst ist die
 * Frage ohne Folge, Fachprüfung 18.10.2026). Sonst für die Vorbereitung auf
 * der Traktandenseite, immer.
 */
export function neuAnZweiterHinweis(
	wahl: Neutraktandenwahl,
	imSaal: boolean,
	/**
	 * Ob die Seite eine konsultative Abstimmung anbietet. Am gemeinsamen Abend
	 * nicht (`oeffneAmAbend`); dort sagt der Satz sie nicht zu (Codeprüfung
	 * Block 7, H1).
	 */
	konsultativ = true
): string {
	const kopf = 'Dieses Traktandum stand in der Einladung zur ersten Versammlung nicht zur Abstimmung.';
	/*
	 * **Die milde Wahl je Ort** (Laienprüfung Block 7, L7-6): In der
	 * Vorbereitung ist die Einladung oft noch nicht verschickt, im Saal kann die
	 * Leitung die Ankündigung nur noch nachsehen; dort steht zuerst, dass die
	 * Beschlussfähigkeit einer ersten jetzt fehlt.
	 */
	if (wahl === 'drittel') {
		const offen = L5_OFFEN_DRITTEL;
		return imSaal
			? // Runde 2, L7-15: nachsehen statt «nur, wenn», und die Versammlung vorher unterrichten.
				`${kopf} Die Versammlung ist jetzt nicht beschlussfähig wie eine erste; Ihre Gemeinschaft ` +
					`lässt trotzdem abstimmen. ${offen} Sagen Sie das der Versammlung vor der Abstimmung. ` +
					'Abgestimmt werden darf nur, wenn das Geschäft in der Einladung zur zweiten Versammlung ' +
					'stand; sehen Sie dort nach.'
			: `${kopf} Beschliessen kann die Versammlung darüber nur, wenn es in der Einladung zur ` +
					'zweiten steht. Ihre Gemeinschaft lässt dafür die Beschlussfähigkeit der zweiten ' +
					`Versammlung genügen, nach Gesetz ein Drittel der Eigentümer. ${offen} Bitten Sie ` +
					'Eigentümer, die nicht kommen können, um eine Vollmacht.';
	}
	if (imSaal) {
		// L7-2, L7-3, L7-9 und F7-7: was die Leitung jetzt tun kann, beides, und
		// dass «unverbindlich» kein Beschluss ist.
		return (
			`${kopf} Ihre Gemeinschaft lässt darüber nur verbindlich abstimmen, wenn die Versammlung ` +
			'beschlussfähig ist wie eine erste, und das ist sie jetzt nicht. Kommen noch Eigentümer ' +
			'dazu oder legen Vollmachten vor, kann sich das ändern. ' +
			(konsultativ
				? 'Sonst kann die Versammlung unverbindlich abstimmen: Das zeigt ihre Meinung, ist aber ' +
					'kein Beschluss und erlaubt der Verwaltung nichts. '
				: '') +
			// Laienprüfung L-1 bis L-3 (Featureprüfung Lesarten): die eigene
			// Einstellung zuerst, vor den Handlungen, nicht hinter dem Notfallsatz.
			`${neuAnZweiterAndereLesart(true)} ` +
			'Setzen Sie das Geschäft in jedem Fall auf die Liste einer späteren ' +
			'Versammlung; ist es dringend, kann die Verwaltung dafür eigens eine einberufen. ' +
			// Runde 3, F7-14 und L7-16: nur die Abwehr eines Schadens, nicht das Geschäft.
			// Runde 4, L7-21: «sofort nötig», sonst fällt ein Ersatz darunter; Runde 5,
			// F7-15: auch die unmittelbaren Folgen beheben (Rz. 27, 27a ad Art. 712s).
			'Unabhängig davon darf sie ohne Beschluss tun, was sofort nötig ist, um einen Schaden ' +
			'abzuwehren oder seine unmittelbaren Folgen zu beheben, etwa bei einem Wasserleitungsbruch ' +
			'das Wasser abstellen, das Leck flicken und den Keller trocknen lassen (ZGB Art. 712s ' +
			'Abs. 1); die eigentliche Massnahme, etwa den Ersatz der Leitung, beschliesst die Versammlung.'
		);
	}
	// L7-7 und L7-11: Vollmachten einholen, und was «angekündigt» heisst.
	// Kriterium 4 auch nach der Vorgabe: was die andere Lesart verlangt
	// (Featureprüfung Lesarten, 22.10.2026).
	return (
		`${kopf} Beschliessen kann die Versammlung darüber nur, wenn es in der Einladung zur zweiten ` +
		'steht. Ihre Gemeinschaft lässt darüber zudem nur verbindlich abstimmen, wenn so viele ' +
		'anwesend oder vertreten sind wie an einer ersten Versammlung; die Einladung nennt das in ' +
		'einer Fussnote. Bitten Sie Eigentümer, die nicht kommen können, um eine Vollmacht. ' +
		neuAnZweiterAndereLesart(false)
	);
}

/** Die Absage beim Eröffnen nach der Vorgabe von L5, mit dem, was fehlt. */
export function neuAnZweiterGesperrt(fehlt: string, konsultativ = true): string {
	const grund = fehlt.replace(/\.\s*$/, '');
	// Laienprüfung Block 7, L7-3: beides, nicht «oder», wie in der Leitung.
	return (
		'Dieses Traktandum stand in der Einladung zur ersten Versammlung nicht zur Abstimmung. Nach der Einstellung ' +
		'Ihrer Gemeinschaft wird darüber nur verbindlich abgestimmt, wenn die Versammlung ' +
		`beschlussfähig ist wie eine erste: ${grund}. Ist jemand im Saal, der nicht als anwesend ` +
		'erfasst ist, berichtigen Sie die Anwesenheit. ' +
		(konsultativ ? 'Sonst kann die Versammlung unverbindlich abstimmen; das ist kein Beschluss. ' : '') +
		'Setzen Sie das Geschäft in jedem Fall auf die Liste einer späteren Versammlung.'
	);
}

/**
 * Die Zeile im Protokoll je Wahl (F3: die Lesart je betroffenen Beschluss).
 * Ohne Wahl (Leser ohne Momentaufnahme) die bisherige Tatsache allein.
 *
 * `ersteFehlte` (Laienprüfung L7-4, Fachprüfung F7-5): Ob die
 * Beschlussfähigkeit einer ersten bei diesem Beschluss fehlte, gerechnet an
 * den Anwesenden des Durchgangs. Sie fehlt meist nach einem Beschluss von
 * Hand trotz Sperre, sonst, weil während der Abstimmung jemand ging; dann muss
 * es dastehen, denn für Abwesende läuft die Anfechtungsfrist ab dem Protokoll.
 * Für beide Wahlen gerechnet; der Anfechtungssatz danach nur nach der Vorgabe
 * (Codeprüfung Block 7, H2). `null`: nicht bestimmbar, dann ohne
 * Aussage dazu. Die offene Rechtsfrage gehört nicht ins Protokoll
 * (Fachprüfung 18.10.2026), auch nicht bei der milden Wahl.
 */
export function neuAnZweiterProtokoll(
	wahl: Neutraktandenwahl | null | undefined,
	ersteFehlte: boolean | null = null,
	/**
	 * A5, Punkt 8 (Entscheid 0032): die hinterlegte Anwesenheitsregel für die
	 * zweite Versammlung, wenn das Reglement eine hat. Ohne Regel bleibt der
	 * Satz beim Gesetz («ein Drittel der Eigentümer»).
	 */
	regelZweite?: Beschlussfaehigkeitsregel | null
): string {
	if (wahl === 'erste') {
		const regel =
			`${NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL} Nach der Einstellung der Gemeinschaft wird darüber ` +
			'nur abgestimmt, wenn die Versammlung beschlussfähig ist wie eine erste';
		// Runde 2, F7-10 und L7-13: sonst liest man «erfüllt».
		if (ersteFehlte === null) return `${regel}; ob sie es bei diesem Beschluss war, ist nicht festgehalten.`;
		return ersteFehlte ? `${regel}; das war sie bei diesem Beschluss nicht.` : `${regel}; das war sie.`;
	}
	if (wahl === 'drittel') {
		/*
		 * A5, Punkt 8 (Entscheid 0032): die Regel des Reglements samt Fundstelle
		 * nennen, wie die Fussnote der Einladung (`neutraktandenFussnote`, mit
		 * `anteilInWorten`); ohne Regel bleibt es beim Drittel nach Art. 712p
		 * Abs. 3.
		 */
		const reglement = regelZweite
			? `, nach dem Reglement: ${anteilInWorten(regelZweite.kopf)} der Eigentümer` +
				(regelZweite.mindestens > 0 ? `, mindestens aber ${zahlwort(regelZweite.mindestens)}` : '') +
				(regelZweite.quoten ? `, und ${anteilInWorten(regelZweite.quoten)} der Wertquoten` : '') +
				(regelZweite.fundstelle ? ` (${mitQuelle(regelZweite.fundstelle)})` : '')
			: ', nach Gesetz ein Drittel der Eigentümer';
		// Fachprüfung Runde 8, Nachtrag: War sie es, liest sich die Zeile sonst wie
		// ein Anfechtungsgrund, den es nicht gibt.
		if (ersteFehlte === false) {
			return (
				`${NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL} Die Versammlung war bei diesem Beschluss ` +
				'beschlussfähig wie eine erste.'
			);
		}
		return (
			// Codeprüfung Block 7, N2; Fachprüfung F7-17; Laienprüfung L7-27: Vor
			// Migration 174 hat niemand gewählt, also eine Tatsache ohne Zuschreibung.
			`${NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL} Abgestimmt wurde mit der Beschlussfähigkeit der ` +
			`zweiten Versammlung${reglement}.`
		);
	}
	return NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL;
}

/** Was `neueTraktandenDerZweiten` je Traktandum braucht. */
export interface Traktandenherkunft {
	id: string;
	art: 'abstimmung' | 'kenntnisnahme';
	/** Aus der Vorlage der Gemeinschaft angelegt (`from_template`). */
	ausVorlage: boolean;
	/**
	 * Laut Verlauf aus der ersten Versammlung übernommen (`agenda.item.copied`
	 * mit `ausVersammlung`), und dort zur Abstimmung traktandiert (C2, F4c).
	 * Nicht `copied_from_meeting_id`: Das Feld heisst
	 * «unverändert übernommen» und wird beim Bearbeiten und beim Setzen des
	 * Erfordernisses geleert (Codeprüfung 3d, 18.10.2026, H1).
	 */
	ausErsterUebernommen: boolean;
	/** Im Saal entstanden (`is_spontaneous`): Folgeantrag, Rückkommen, Saalausnahme. */
	spontan: boolean;
	/**
	 * Beim Folgeantrag der Grundantrag (`parent_id` bei `spontaneous_kind =
	 * 'folgeantrag'`), sonst null. Er erbt dessen Kennzeichnung: Wird er
	 * angenommen, trägt er den Beschluss (Codeprüfung 3d, M-a).
	 */
	folgeantragZu?: string | null;
	titel: string;
}

/**
 * Welche Abstimmungstraktanden einer zweiten Versammlung neu sind (Ä-17 B).
 *
 * **Die Regel** (gemessen 18.10.2026 an `uebertrageOffeneTraktanden`,
 * `kopiereTraktandumIn` und `legePflichttraktandenAn`): Übernommen ist, was laut
 * Verlauf aus der ersten Versammlung kopiert wurde, beim Vertagen von selbst
 * oder von Hand über «Traktanden übernehmen», auch wenn es danach bearbeitet
 * wurde. Die Pflichttraktanden entstehen an jeder Versammlung neu aus der
 * Vorlage; sie gelten als übernommen, wenn die erste ein Pflichttraktandum
 * gleichen Titels hatte. Neu ist, was an der zweiten von Hand angelegt oder aus
 * einer anderen Versammlung übernommen wurde, und ein Pflichttraktandum, das
 * die erste nicht hatte. Im Saal Entstandenes bleibt weg: Folgeantrag,
 * Rückkommen und Saalausnahme haben eigene Zulassungswege, und «nur wenn
 * angekündigt» wäre dort falsch (Codeprüfung 3d, H2).
 *
 * **Aus einer Kenntnisnahme übernommen** (C2, F4c): Stand der Gegenstand an
 * der ersten nur zur Kenntnisnahme und steht er an der zweiten zur
 * Abstimmung, gilt er als neu. Das bestimmt der Aufrufer, der die Herkunft
 * kennt (`leseNeueTraktandenDerZweitenIn`): `ausErsterUebernommen` ist dann
 * falsch, und ein Pflichttraktandum zählt nur mit dem Titel einer Abstimmung
 * der ersten.
 *
 * **Grenze:** Die Genehmigung des Protokolls trägt an der zweiten einen
 * anderen Antragstext (sie nennt die letzte versiegelte Versammlung) und gilt
 * nach dem Titel trotzdem als übernommen; gleicher Titel steht nur
 * ersatzweise für gleichen Gegenstand (Fachprüfung 18.10.2026, niedrig; nicht
 * gebaut). Kenntnisnahmen bleiben weg: Ohne Beschluss ist die
 * Beschlussfähigkeit ohne Folge. Ein Beschluss von Hand unter einer
 * Kenntnisnahme fällt deshalb nicht unter L5 (Pendenz aus F4c).
 */
export function neueTraktandenDerZweiten(
	stufe: Versammlungsstufe,
	traktanden: readonly Traktandenherkunft[],
	vorlagentitelDerErsten: Iterable<string>
): Set<string> {
	if (stufe !== 'zweite') return new Set();
	const titel = new Set(vorlagentitelDerErsten);
	const art = new Map(traktanden.map((t) => [t.id, t.art]));
	const neu = new Set([
		...traktanden
			.filter((t) => t.art === 'abstimmung' && !t.spontan)
			.filter((t) => !t.ausErsterUebernommen)
			.filter((t) => !(t.ausVorlage && titel.has(t.titel)))
			.map((t) => t.id),
		// Ein Folgeantrag unter einer Kenntnisnahme beschliesst über einen
		// Gegenstand, der nicht zur Abstimmung angekündigt war (C2). Die
		// Kenntnisnahme in Abstimmungsform lässt ihn zu (Codeprüfung F4c Block 2,
		// zweiter Durchgang, M-a).
		...traktanden
			.filter((t) => t.folgeantragZu != null && art.get(t.folgeantragZu) === 'kenntnisnahme')
			.map((t) => t.id)
	]);
	// Bis nichts mehr dazukommt: Die Reihenfolge der Zeilen ist nicht die von
	// Grund- und Folgeantrag, und ein Folgeantrag kann einen Folgeantrag haben
	// (Review DeepSeek zu Block 7, Befund 2; seit L5 sperrt das).
	let gewachsen = true;
	while (gewachsen) {
		gewachsen = false;
		for (const t of traktanden) {
			if (t.folgeantragZu && neu.has(t.folgeantragZu) && !neu.has(t.id)) {
				neu.add(t.id);
				gewachsen = true;
			}
		}
	}
	return neu;
}

// ── L7: Ausstand und Beschlussfähigkeit (Migration 183) ─────────────────────

/**
 * Der Satz an die Leitung vor dem Eröffnen, unter der Vorgabe «Zählt mit»
 * (L7, Migration 183; Einteilung F3b, B2). Er steht nur, wo die
 * Beschlussfähigkeit ohne die Personen im Ausstand fehlt; gerechnet mit
 * `beteiligungOhneAusstand` und derselben Stufe wie die übrige Prüfung. Der
 * Beschluss besteht nach der Einstellung der Gemeinschaft, ist nach der
 * anderen Lehrmeinung aber angreifbar; der Satz nennt beides und den
 * sicheren Weg.
 */
export const AUSSTAND_ZAEHLT_LEITUNG =
	'Ohne die Personen im Ausstand wäre die Versammlung bei diesem Traktandum nicht beschlussfähig. Votum zählt sie nach der Einstellung Ihrer Gemeinschaft mit (SVIT-Kommentar Rz. 17 ad Art. 712p). Nach einer anderen Lehrmeinung zählen sie nicht, und der Beschluss wäre angreifbar. Sicher ist er, wenn so viele weitere Eigentümer da oder vertreten sind, dass die Versammlung auch ohne die Personen im Ausstand beschlussfähig ist.';

/**
 * Die Zeile im Protokoll am Beschluss, unter der Vorgabe (gleiche Bedingung):
 * Die Tatsache, nicht die offene Frage; wer anficht, liest diesen einen
 * Beschluss (wie die fehlende Beschlussfähigkeit daneben). Gerechnet aus dem
 * eingefrorenen `attendance_json` des Durchgangs.
 */
export const AUSSTAND_ZAEHLT_PROTOKOLL =
	'Ohne die Personen im Ausstand wäre die Versammlung bei diesem Beschluss nicht beschlussfähig gewesen; nach der Einstellung der Gemeinschaft zählten sie mit.';

/**
 * Die Absage beim Eröffnen unter «Zählt nicht mit» (L7, Migration 183;
 * Entscheid 0043: Sperre je Traktandum, die übrigen Traktanden gehen weiter).
 * Der Beschluss von Hand geht an der Prüfung vorbei, wie bei fehlender
 * Beschlussfähigkeit.
 *
 * **Ohne den unverbindlichen Weg** (Entscheid 0043): Die Versammlung ist
 * beschlussfähig, nur nicht ohne die Personen im Ausstand, und die Sätze zur
 * konsultativen Abstimmung passten nicht (Codeprüfung Block 4, H1, M4). Damit
 * gilt derselbe Wortlaut im Haus und am gemeinsamen Abend. Die Wege nennt der
 * Satz wie `neuAnZweiterGesperrt`: berichtigen, sonst auf die Liste einer
 * späteren Versammlung (Codeprüfung M5, Laienprüfung L7, L-4; «verschieben»
 * heisst in Votum die Reihenfolge am selben Abend). Sie stehen auch vor dem
 * Klick auf der Leitungsseite.
 */
export const AUSSTAND_NICHT_BESCHLUSSFAEHIG =
	'Ohne die Personen im Ausstand ist die Versammlung bei diesem Traktandum nicht beschlussfähig. ' +
	'Nach der Einstellung Ihrer Gemeinschaft zählen sie dafür nicht mit; verbindlich abgestimmt wird ' +
	// Fachprüfung Runde 2, N-2: auch ein irrtümlicher Ausstand ist zu berichtigen
	// (Laienprüfung Runde 3, N3-2: «irrtümlich», nicht «ohne Grund»);
	// Laienprüfung Runde 2, N-4: besprechen bleibt erlaubt (Rz. 26 ad Art. 712p).
	'deshalb nicht. Ist jemand im Saal, der nicht als anwesend erfasst ist, oder steht jemand ' +
	'irrtümlich im Ausstand, berichtigen Sie das. Sonst setzen Sie das Traktandum auf die Liste einer ' +
	'späteren Versammlung; besprechen darf die Versammlung es trotzdem.';

// ── L8: Vollmachten der Verwaltung (Migration 184) ───────────────────────────

/**
 * Der gemeinsame Schluss der beiden Sätze vor dem Eröffnen (Fachprüfung
 * L8-F-2): Wer anwesend ist und die Zählung nicht schon vor der Abstimmung
 * beanstandet, kann das Recht zur Anfechtung verlieren (BGer 5A_709/2010
 * E. 4). Er steht am Ende, weil er eine Handlung verlangt, nicht erklärt.
 * Lauf 4 (07.11.2026): Er nennt die beiden Orte, an denen die Antwort
 * festgehalten wird, statt nur «im Protokoll».
 */
const VERWALTUNG_RUEGE =
	'Fragen Sie vor der Abstimmung, ob jemand diese Zählung beanstandet. Sagen Sie dazu: Wer ' +
	'anwesend ist und nichts sagt, kann das Recht verlieren, den Beschluss deswegen anzufechten. ' +
	'Halten Sie eine Beanstandung mit «Rüge festhalten» fest; sagt niemand etwas, vermerken Sie das ' +
	'im Feld «Voten, Begründungen, Ordnungsentscheide».';

/**
 * Der Satz an die Leitung vor dem Eröffnen, unter der Vorgabe «Vollmachten
 * ruhen» (L8, Migration 184; Einteilung F3b, B4). Er steht an Traktanden mit
 * Häkchen, an denen die Verwaltung Vollmachten hält, die nicht schon über
 * einen erklärten Ausstand ruhen. Unter der Vorgabe gilt die Verwaltung als
 * im Ausstand, ohne dass jemand ihn erklärt (`leseAusstandskennungen`).
 */
export const VERWALTUNG_RUHEN_LEITUNG =
	'Bei diesem Traktandum ruhen die Vollmachten der Verwaltung nach der Einstellung Ihrer Gemeinschaft. ' +
	'Die Stimmen, die die Verwaltung mit Vollmachten abgibt, zählen nicht; die Vertretenen stimmen nur, ' +
	'wenn sie selbst da sind oder eine andere Person bevollmächtigt haben. ' +
	VERWALTUNG_RUEGE +
	// Fachprüfung Runde 4, R4-4 (07.11.2026): Die Beanstandung kann einen
	// Erfassungsfehler aufdecken; der lässt sich vor dem Eröffnen beheben.
	' Beanstandet jemand, dass die Vollmachten ruhen, halten Sie das fest. Gehört eine Vollmacht in ' +
	'Wahrheit nicht der Verwaltung, entfernen Sie das Häkchen unter Vollmachten, bevor Sie eröffnen. ' +
	'Sonst können Sie trotzdem abstimmen; die Einstellung Ihrer Gemeinschaft gilt.';

/**
 * Der Satz an die Leitung vor dem Eröffnen, unter «Die Sitzungsleitung
 * entscheidet» (L8, Migration 184), an denselben Traktanden: Die Vollmachten
 * zählen, bis die Leitung den Ausstand der Verwaltung erklärt. Der erklärte
 * Ausstand (Migration 167) bleibt der Weg; die Einstellung sagt nur, dass es
 * ohne ihn nicht von selbst geschieht.
 */
export const VERWALTUNG_LEITUNG_LEITUNG =
	'Bei diesem Traktandum geht es um ein Geschäft der Verwaltung. Nach der Einstellung Ihrer ' +
	'Gemeinschaft entscheiden Sie, ob ihre Vollmachten ruhen; wollen Sie das, erklären Sie den Ausstand ' +
	'der Verwaltung. Leitet die Verwaltung die Versammlung, entscheidet sie so über ihre eigenen ' +
	'Vollmachten. Den Vorsitz für dieses Traktandum übernimmt dann besser eine Eigentümerin oder ein ' +
	'Eigentümer. ' +
	VERWALTUNG_RUEGE +
	' Beanstandet jemand, dass die Vollmachten zählen, können Sie den Ausstand der Verwaltung jetzt noch ' +
	'erklären.';

/**
 * Der Satz in der Einladung, an einem Traktandum mit Häkchen unter der Vorgabe
 * (L8, Migration 184): Nur die Einladung erreicht die Vollmachtgeber vor der
 * Versammlung, und wer seine Stimme der Verwaltung gegeben hat, kann sie
 * sonst nirgends mehr abgeben. Wie der Hinweis bei der Einsprache
 * (`einladungEinsprache`) steht er unter dem Traktandum, nicht auf dem
 * Beamer: Im Saal käme er zu spät.
 */
export const VERWALTUNG_RUHEN_EINLADUNG =
	'Bei diesem Traktandum zählen keine Stimmen, die die Verwaltung mit einer Vollmacht abgibt, auch ' +
	'nicht solche mit Weisung. Haben Sie der Verwaltung eine Vollmacht gegeben und wollen hier ' +
	'mitstimmen, kommen Sie selbst oder bevollmächtigen eine andere Person, die nicht für die ' +
	'Verwaltung arbeitet. Bevollmächtigen Sie eine andere Person, sagen Sie der Verwaltung, dass ' +
	'ihre Vollmacht für diese Versammlung nicht mehr gilt. Diese Person stimmt dann bei allen ' +
	'Traktanden dieser Versammlung für Sie.';

/**
 * Der Satz in der Einladung unter «Die Sitzungsleitung entscheidet», an
 * denselben Traktanden (G7, Produktentscheid 08.11.2026; Entscheid 0045,
 * Punkt 10). Anhang 3 des Restpakets, den Entscheid 0044 zur Lesart macht:
 * «Bei beiden Lesarten rät die Einladung, Vollmachten für diese Traktanden
 * einer anderen Person zu geben.» Er sagt nicht, dass die Stimmen ruhen,
 * denn das entscheidet erst die Leitung; auch ein vorab erklärter Ausstand
 * ist ihr Entscheid, und die Einladung kennt ihn nicht.
 */
export const VERWALTUNG_LEITUNG_EINLADUNG =
	'Bei diesem Traktandum entscheidet die Sitzungsleitung, ob Stimmen zählen, die die Verwaltung ' +
	'mit einer Vollmacht abgibt. Das gilt auch für Stimmen, zu denen Sie der Verwaltung eine Weisung ' +
	'gegeben haben. Haben Sie der Verwaltung eine Vollmacht gegeben und wollen sicher sein, dass ' +
	'Ihre Stimme hier zählt? Dann kommen Sie selbst oder bevollmächtigen eine andere Person, die ' +
	'nicht für die Verwaltung arbeitet. Bevollmächtigen Sie eine andere Person, sagen Sie der ' +
	'Verwaltung, dass ihre Vollmacht für diese Versammlung nicht mehr gilt. Diese Person stimmt dann ' +
	'bei allen Traktanden dieser Versammlung für Sie.';

/**
 * Welcher Satz zu den Vollmachten der Verwaltung in der Einladung steht (L8):
 * an einem Traktandum mit Häkchen je nach Wahl der Gemeinschaft, sonst
 * keiner. Ohne Wahl (der Aufrufer kennt sie nicht) bleibt er weg. Eine
 * Stelle für Einladung, Liste und Prüfdatei, damit die Bedingung nicht
 * zweimal getippt wird (Featureprüfung 2, M3 T2).
 */
export function verwaltungssatzEinladung(
	wahl: Verwaltungsvollmachtwahl | undefined,
	verwaltungsGeschaeft: boolean
): string | null {
	if (!verwaltungsGeschaeft || !wahl) return null;
	return wahl === 'ruhen' ? VERWALTUNG_RUHEN_EINLADUNG : VERWALTUNG_LEITUNG_EINLADUNG;
}

/**
 * Die Absage am Häkchen am Traktandum im Entwurf, wenn das Erfordernis auf
 * der Wahl oder der erweiterten Wahl der Verwaltung steht (L8, Migration
 * 184, G1): Bei Wahl und Wiederwahl ruhen die Vollmachten nach dem
 * Bundesgericht nicht (BGE 134 III 481 E. 3.5); das Häkchen gehört zur
 * Entschädigung, die sich trennen lässt.
 */
export const VERWALTUNG_HAKEN_ABSAGE_WAHL =
	'Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.5). ' +
	'Geht es auch um ihre Entschädigung, stimmen Sie diese in einem eigenen Traktandum ab und setzen ' +
	'Sie das Häkchen nur dort.';

/**
 * Die Absage am Häkchen am Traktandum im Entwurf, wenn das Erfordernis auf
 * der Abberufung der Verwaltung steht (L8, Migration 184, G1): Bei der
 * Abberufung ist das Ruhen nicht geklärt, und das Häkchen wirkt dort nicht;
 * der erklärte Ausstand ist der Weg, wenn die Verwaltung den Raum verlässt.
 * Lauf 4 (07.11.2026): Die Vertretenen ruft die Einladung schon vorher auf,
 * und den Vorsitz schlägt die Leitung vor, bevor sie ihn am Abend abgibt.
 */
export const VERWALTUNG_HAKEN_ABSAGE_ABBERUFUNG =
	'Bei der Abberufung der Verwaltung ist nicht geklärt, ob ihre Vollmachten ruhen, und das Häkchen ' +
	'gilt dort nicht. Bitten Sie die Vertretenen schon mit der Einladung, selbst zu kommen oder eine ' +
	'andere Person zu bevollmächtigen, und schlagen Sie einen Vorsitz für dieses Traktandum vor. Am ' +
	'Abend erklären Sie den Ausstand der Verwaltung, wenn sie den Raum verlässt; mehr dazu im Handbuch ' +
	'unter «Bei der Abberufung der Verwaltung».';

/**
 * Die Absage am Erfordernis nach der Freigabe (L8, Migration 184, G1,
 * Entscheid 7): Das Häkchen ist ab der Freigabe gesperrt, und die Einladung
 * richtet sich nach der Kennzeichnung. Lauf 4 (Entscheid 8, 07.11.2026):
 * Wahl und Wiederwahl nimmt Votum nach der Freigabe an; die Absage bleibt
 * der Abberufung am Grundantrag. Entscheid 0045, Punkt 9 (Fachprüfung
 * Runde 3, R3-5): Kündigt die Einladung die Abberufung bei diesem
 * Traktandum klar an, ist der Folgeantrag der Weg; die Grenze heisst die von
 * Votum, nicht die Rechtslage (Fachprüfung Runde 4, R4-2).
 */
export const VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN =
	'Dieses Traktandum trägt das Häkchen zur Entschädigung, zu einem Vertrag oder zur Entlastung der ' +
	'Verwaltung, und nach der Freigabe lässt es sich nicht mehr abnehmen. Als Abberufung nimmt Votum ' +
	'es deshalb nicht an. Kündigt die Einladung die Abberufung bei diesem Traktandum klar an, nehmen ' +
	'Sie sie mit «Gegenantrag» als eigenen Folgeantrag auf. Dort stellen Sie das nötige Mehr auf ' +
	// Fachprüfung Runde 6, R6-1: Ob die Abberufung den Vertrag beendet, ist
	// umstritten (Rz. 9 ad Art. 712r; Donauer Rz. 702).
	'«Bewirtschaftung abberufen» und nehmen eine Kündigung des Vertrags in denselben Wortlaut auf. Sonst stimmen Sie sie unter einem eigenen Traktandum ab. Steht keines ' +
	'auf der Traktandenliste, kann Votum sie an dieser Versammlung nicht abstimmen lassen; setzen Sie ' +
	'sie auf eine spätere, wenn nötig eine ausserordentliche.';

/**
 * Gemeinsam für beide Sätze zur Wahl trotz Häkchen; steht im Code vor ihnen.
 * **Entscheid 0045, Punkt 9 (07.11.2026)**, auf Fach- und Laienprüfung
 * Runde 4, R4-1 und R4-2: Lautet der Antrag auch auf Entschädigung,
 * Entlastung oder einen Vertrag, teilt die Leitung ihn in Folgeanträge auf.
 * Der zur Wahl trägt das nötige Mehr der Wahl, und das geerbte Häkchen wirkt
 * dort nicht; die übrigen tragen ihr eigenes, und dort wirkt es. Angenommen
 * macht der Folgeantrag zur Wahl den Grundantrag gegenstandslos
 * (Produktentscheid 21.08.2026); entschieden sperrt er ihn
 * (`teilentschiedenSatz`). Laienprüfung R4-2, Punkt 3: Votum prüft die
 * Ankündigung nicht, der Satz sagt das. Unter «Die Sitzungsleitung
 * entscheidet» ruhen die Vollmachten in den übrigen Folgeanträgen nicht von
 * selbst.
 */
function verwaltungNurDieWahl(wahl: 'ruhen' | 'leitung', amFolgeantrag: boolean): string {
	// Laienprüfung Runde 5, R5-1: die Prüfung der Ankündigung zuerst, vor der
	// Anleitung zum Aufteilen.
	const ankuendigung =
		'Votum prüft nicht, ob die Einladung die Wahl bei diesem Traktandum ankündigt; das prüfen Sie. ' +
		// Laienprüfung Runde 6, R6-3; Fachprüfung Runde 5, Antwort auf die Frage.
		'Eine Erneuerung des Verwaltungsvertrags mit der bisherigen Verwaltung gilt in der Regel als ' +
		'Ankündigung der Wiederwahl. ';
	// Codeprüfung P9, G-3: Am Folgeantrag ist schon aufgeteilt.
	if (amFolgeantrag) {
		return (
			ankuendigung +
			'Kündigt sie sie nicht an, stimmen Sie diesen Folgeantrag nicht ab; die Wahl kommt auf eine ' +
			'spätere Versammlung.'
		);
	}
	return (
		ankuendigung +
		// R5-2: zurück auf das Mehr, das vorher galt.
		'Kündigt sie sie nicht an, stimmen Sie die Wahl nicht ab, sondern setzen sie auf eine spätere ' +
		'Versammlung, und stellen das nötige Mehr wieder auf das vorherige. Lautet der Antrag nur auf die ' +
		'Wahl, stimmen Sie hier darüber ab. ' +
		// Fachprüfung Runde 5, R5-1: Die Erneuerung des Vertrags ist das
		// Gegenstück der Wahl (Rz. 41a, 95 ad Art. 712q), kein eigener Teil.
		'Stehen darin auch Entschädigung, Entlastung oder neue Vertragsbedingungen, stimmen Sie die Teile ' +
		'getrennt ab. Nehmen Sie dafür mit «Gegenantrag» einen Folgeantrag mit der Wahl auf, mit dem ' +
		'nötigen Mehr «Bewirtschaftung wählen». Die Erneuerung des Vertrags zu den bisherigen ' +
		'Bedingungen gehört zu ihm. Für die ' +
		'übrigen Teile nehmen Sie je einen eigenen auf; ' +
		// R5-3: «wie hier» las sich als «gleich wie hier».
		(wahl === 'ruhen'
			? 'dort ruhen die Vollmachten der Verwaltung. '
			: 'dort entscheiden Sie dann selbst, ob die Vollmachten der Verwaltung ruhen. ') +
		'Über diesen Antrag stimmen Sie danach nicht mehr ab.'
	);
}

/**
 * Der Satz an die Leitung vor dem Eröffnen, Entscheid 8 (07.11.2026), unter
 * «Vollmachten ruhen»: Das Traktandum trägt das Häkchen, und nach der
 * Freigabe steht sein Erfordernis auf der Wahl oder der erweiterten Wahl der
 * Verwaltung. Dort ruhen die Vollmachten nicht (BGE 134 III 481 E. 3.8),
 * obwohl die Einladung das Gegenteil angekündigt hat; die Abweichung sagt die
 * Leitung der Versammlung, bevor abgestimmt wird.
 */
// Ersetzt beide Fassungen aus Lauf 4 (Entscheid 8, neue Fassung).
// Als Funktion seit Codeprüfung P9, G-3: am Folgeantrag ohne die Anleitung
// zum Aufteilen.
export const verwaltungWahlTrotzHakenRuhen = (amFolgeantrag: boolean): string =>
	'Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.8). ' +
	'Votum zählt sie hier, obwohl die Einladung bei diesem Traktandum sagt, dass sie nicht zählen; ' +
	'sagen Sie das der Versammlung vor der Abstimmung. ' +
	verwaltungNurDieWahl('ruhen', amFolgeantrag) +
	' ' +
	VERWALTUNG_RUEGE +
	// Laienprüfung Runde 4, R4-3, Punkt 1: die umgekehrte Beanstandung, wie
	// unter «ruhen» an den übrigen Traktanden.
	' Beanstandet jemand, dass die Vollmachten hier zählen, halten Sie das fest; abstimmen können Sie ' +
	'trotzdem.';

/**
 * Der Satz an die Leitung vor dem Eröffnen, Entscheid 8 (07.11.2026), unter
 * «Die Sitzungsleitung entscheidet»: dieselbe Lage, aber ohne eine
 * Ankündigung, der die Zählung widerspricht. Die Einladung sagt dort seit G7
 * (08.11.2026) nur, dass die Leitung entscheidet; an der Wahl zählen die
 * Vollmachten nach dem Bundesgericht.
 */
export const verwaltungWahlTrotzHakenLeitung = (amFolgeantrag: boolean): string =>
	'Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.8). ' +
	verwaltungNurDieWahl('leitung', amFolgeantrag);

/** Die Fassungen am Grundantrag, unter den bisherigen Namen. */
export const VERWALTUNG_WAHL_TROTZ_HAKEN_RUHEN = verwaltungWahlTrotzHakenRuhen(false);
export const VERWALTUNG_WAHL_TROTZ_HAKEN_LEITUNG = verwaltungWahlTrotzHakenLeitung(false);

/**
 * Zusätzlich an der Wahl trotz Häkchen, wenn ein Ausstand der Verwaltung
 * vorab erklärt ist; unter beiden Wahlen (Fachprüfung Runde 3, R3-3,
 * 07.11.2026): Ein vorab erklärter Ausstand hielte ihre Vollmachten von der
 * Wahl fern, zu der sie nach dem Bundesgericht zählen; die Leitung nimmt ihn
 * deshalb vor der Abstimmung zurück.
 */
export const VERWALTUNG_WAHL_AUSSTAND_ERKLAERT =
	'Sie haben den Ausstand der Verwaltung bei diesem Traktandum erklärt. Bei der Wahl ruhen ihre ' +
	'Vollmachten nicht; nehmen Sie den Ausstand deshalb vor der Abstimmung zurück.';

/**
 * Dasselbe unter «Die Sitzungsleitung entscheidet» (Laienprüfung Runde 4,
 * R4-3, Punkt 2, 07.11.2026): Wer den Ausstand vorab erklärt hat, hat den
 * Vertretenen gesagt, dass ihre Vollmachten hier ruhen; der Satz zur Wahl
 * trägt unter dieser Einstellung keine Rüge, deshalb steht sie hier. Unter
 * «ruhen» trägt sie der Satz zur Wahl schon.
 */
export const VERWALTUNG_WAHL_AUSSTAND_ERKLAERT_LEITUNG =
	VERWALTUNG_WAHL_AUSSTAND_ERKLAERT +
	' Sagen Sie der Versammlung, dass die Vollmachten der Verwaltung hier zählen. ' +
	VERWALTUNG_RUEGE;

/**
 * Der gemeinsame Teil beider Sätze an der Abberufung als Folgeantrag
 * (Laienprüfung Runde 5, R5-5 und R5-6; Fachprüfung Runde 5, R5-3;
 * Produktentscheid 07.11.2026: keine Richtung, dazu der Vorsitz): was die
 * Leitung der Versammlung sagt, wer den Vorsitz führt und was nach einer
 * Beanstandung gilt.
 */
const VERWALTUNG_ABBERUFUNG_ENTSCHEID =
	'Entscheiden Sie, ob sie ruhen, und sagen Sie der Versammlung vor der Abstimmung, dass die Frage ' +
	'nicht geklärt ist und was Sie entschieden haben. Leitet die Verwaltung die Versammlung, gibt sie ' +
	// Fachprüfung Runde 6, R6-3: für die Behandlung, nicht nur die Abstimmung
	// (Rz. 24 ad Art. 712r).
	'den Vorsitz für die Behandlung dieses Folgeantrags ab, damit sie nicht selbst über ihre ' +
	'Vollmachten entscheidet. Verlässt die Verwaltung den Raum, erklären Sie ihren Ausstand; mehr dazu im Handbuch ' +
	'unter «Bei der Abberufung der Verwaltung». ' +
	VERWALTUNG_RUEGE +
	' Beanstandet jemand Ihren Entscheid, halten Sie das fest; abstimmen können Sie trotzdem.';

/**
 * Der Satz an die Leitung an einem Folgeantrag zur Abberufung unter einem
 * Traktandum mit Häkchen, unter «Vollmachten ruhen» (Entscheid 0045,
 * Punkt 9; Entscheid 0044, Anhang 3): Das Häkchen wirkt dort nicht von
 * selbst, die Leitung entscheidet über den erklärten Ausstand. Die Einladung
 * hat das Ruhen angekündigt; das sagt die Leitung der Versammlung mit.
 */
export const VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_RUHEN =
	'Bei der Abberufung der Verwaltung ist nicht geklärt, ob ihre Vollmachten ruhen. Das Häkchen wirkt ' +
	'hier nicht von selbst: Votum zählt die Vollmachten, bis Sie den Ausstand der Verwaltung erklären. ' +
	'Das gilt, obwohl die Einladung bei diesem Traktandum sagt, dass sie nicht zählen. ' +
	VERWALTUNG_ABBERUFUNG_ENTSCHEID;

/**
 * Dasselbe unter «Die Sitzungsleitung entscheidet»: ohne die Ankündigung
 * der Einladung.
 */
export const VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_LEITUNG =
	'Bei der Abberufung der Verwaltung ist nicht geklärt, ob ihre Vollmachten ruhen. Votum zählt sie, ' +
	'bis Sie den Ausstand der Verwaltung erklären. ' +
	VERWALTUNG_ABBERUFUNG_ENTSCHEID;

/**
 * Der Satz an die Leitung an einem Folgeantrag mit der Angabe «andere
 * Verwaltung» (Entscheid 0045, Punkt 11; `domain/verwaltungsangabe.ts`), nur
 * unter «Vollmachten ruhen»: Die Vollmachten der bisherigen Verwaltung ruhen
 * dort nicht von selbst, obwohl die Einladung es angekündigt hat; das sagt
 * die Leitung der Versammlung, wie an der Wahl trotz Häkchen.
 */
export const VERWALTUNG_ANGABE_ANDERE_LEITUNG =
	'Sie haben angegeben, dass dieser Antrag eine andere als die bisherige Verwaltung betrifft. Votum ' +
	'lässt die Vollmachten der bisherigen Verwaltung hier deshalb nicht ruhen, obwohl die Einladung bei ' +
	'diesem Traktandum sagt, dass sie nicht zählen. Sagen Sie der Versammlung vor der Abstimmung, dass ' +
	'die bisherige Verwaltung von diesem Antrag nicht betroffen ist und ihre Vollmachten deshalb zählen. ' +
	VERWALTUNG_RUEGE +
	// Laienprüfung Runde 14, R14-2: wie an der Kündigung abstimmen trotz
	// Beanstandung; Codeprüfung P11, M1: Zurücknehmen geht nur bis zur ersten
	// Abstimmung, der Ausstand immer.
	' Beanstandet jemand, dass die Vollmachten hier zählen, halten Sie das fest; abstimmen können Sie ' +
	'trotzdem. Betrifft der Antrag doch die bisherige Verwaltung, erklären Sie ihren Ausstand; vor der ' +
	'ersten Abstimmung können Sie die Angabe auch zurücknehmen.';

/**
 * Dasselbe mit der Angabe «Kündigung»: wie an der Abberufung als Folgeantrag
 * (Entscheid 0045, Punkt 9 und 11; als Folgerung aus Rz. 25b ad Art. 712r,
 * Fachprüfung Runde 14, H1: Rz. 20 und 25 tragen die Gleichstellung nicht), mit dem
 * gemeinsamen Teil der Abberufungssätze.
 */
export const VERWALTUNG_ANGABE_KUENDIGUNG_LEITUNG =
	'Sie haben angegeben, dass es hier um die Kündigung des Vertrags nach der nicht angenommenen ' +
	'Abberufung geht. Wie bei der Abberufung ist nicht geklärt, ob die Vollmachten der Verwaltung ruhen. ' +
	'Votum zählt sie, bis Sie den Ausstand der Verwaltung erklären, obwohl die Einladung bei diesem ' +
	'Traktandum sagt, dass sie nicht zählen. ' +
	VERWALTUNG_ABBERUFUNG_ENTSCHEID;

/**
 * Das Angebot neben dem Knopf, solange keine Angabe gemacht ist und das
 * Geschwister entschieden ist wie verlangt (`verwaltungsangabeImSaal`).
 */
export function verwaltungsangabeAngebot(grund: Verwaltungsangabe, titel: string): string {
	return grund === 'andere_verwaltung'
		? // Laien- und Fachprüfung Runde 14, R14-1: Votum weiss nicht, wer
			// gewählt ist; nach einer Wiederwahl ist die Entschädigung ein
			// Geschäft mit der Verwaltung selbst (BGE 134 III 481 E. 3.6).
			`Die Versammlung hat die Wahl im Folgeantrag «${titel}» angenommen. Ist eine andere als die ` +
				'bisherige Verwaltung gewählt und betrifft dieser Antrag nur die Gewählte, etwa ihre ' +
				'Entschädigung, geben Sie das hier an. Dann ruhen die Vollmachten der bisherigen Verwaltung hier ' +
				'nicht. Nach einer Wiederwahl machen Sie die Angabe nicht. Die Entschädigung der ' +
				'wiedergewählten Verwaltung ist ein Geschäft mit ihr, ihre Vollmachten ruhen dort (abgeleitet aus ' +
				'BGE 134 III 481 E. 3.6 und 3.8). Ist die Gewählte mit der bisherigen verbunden, etwa als Nachfolge- oder ' +
				'Schwesterfirma, ist offen, ob sie ruhen; machen Sie die Angabe dann ebenfalls nicht.'
		: // Fachprüfung Runde 14, R14-2; Laienprüfung R14-3: der Vorsitz vor
			// der Angabe, nicht erst im Satz danach.
			`Die Versammlung hat die Abberufung im Folgeantrag «${titel}» nicht angenommen. Geht es in diesem ` +
				'Antrag um die Kündigung des Vertrags, geben Sie das hier an. Dann ruhen die Vollmachten der ' +
				'Verwaltung hier nicht von selbst, wie bei der Abberufung. Leitet die Verwaltung die ' +
				'Versammlung, gibt sie den Vorsitz für diesen Folgeantrag ab, bevor jemand die Angabe macht.';
}

/**
 * Knopf und Rückfrage je Grund, für beide Leitungsseiten. Mit Rückfrage, weil
 * die Leitung damit eine Tatsache festhält, die Votum nicht prüfen kann und
 * die das Protokoll nennt; das Zurücknehmen stellt die Vorgabe wieder her und
 * fragt nicht nach.
 */
export const VERWALTUNGSANGABE_KNOPF: Readonly<
	Record<Verwaltungsangabe, { beschriftung: string; frage: string; folge: string }>
> = {
	andere_verwaltung: {
		beschriftung: 'Angeben: andere Verwaltung',
		frage: 'Angeben, dass dieser Antrag nur eine andere als die bisherige Verwaltung betrifft? Nicht nach einer Wiederwahl.',
		folge:
			'Dann zählen die Vollmachten der bisherigen Verwaltung bei diesem Antrag, und das Protokoll nennt ' +
			'Ihre Angabe. Bis zur Abstimmung können Sie sie zurücknehmen.'
	},
	kuendigung: {
		beschriftung: 'Angeben: Kündigung des Vertrags',
		frage: 'Angeben, dass es in diesem Antrag um die Kündigung des Vertrags geht?',
		folge:
			'Dann zählen die Vollmachten der Verwaltung bei diesem Antrag, bis Sie ihren Ausstand erklären, und ' +
			'das Protokoll nennt Ihre Angabe. Bis zur Abstimmung können Sie sie zurücknehmen.'
	}
};

/**
 * Was beide Leitungsseiten beim Satz zu den Vollmachten zeigen: aus
 * `verwaltungsangabeImSaal` je Angebot Satz, Knopf und Rückfrage, oder die
 * gesetzte Angabe für den Knopf «Angabe zurücknehmen».
 */
export function verwaltungsangabeAnzeige(
	imSaal: { gesetzt: Verwaltungsangabe | null; angebote: { grund: Verwaltungsangabe; titel: string }[] } | null
): {
	gesetzt: Verwaltungsangabe | null;
	angebote: { grund: Verwaltungsangabe; satz: string; beschriftung: string; frage: string; folge: string }[];
} | null {
	if (!imSaal) return null;
	return {
		gesetzt: imSaal.gesetzt,
		angebote: imSaal.angebote.map((a) => ({
			grund: a.grund,
			satz: verwaltungsangabeAngebot(a.grund, a.titel),
			...VERWALTUNGSANGABE_KNOPF[a.grund]
		}))
	};
}

/** Die Rückmeldungen nach dem Setzen und dem Zurücknehmen. */
export const VERWALTUNGSANGABE_GEMACHT =
	'Die Angabe ist gemacht; die Vollmachten der Verwaltung ruhen bei diesem Antrag nicht von selbst.';
export const VERWALTUNGSANGABE_ZURUECK =
	'Die Angabe ist zurückgenommen; die Vollmachten der Verwaltung ruhen bei diesem Antrag wieder nach ' +
	'der Einstellung Ihrer Gemeinschaft.';

/**
 * Die Sätze zu den Vollmachten der Verwaltung vor dem Eröffnen, für beide
 * Leitungsseiten (Haus und gemeinsamer Tag). Bis Entscheid 0045, Punkt 9,
 * stand die Wahl in jeder Seite einzeln; mit der Abberufung, dem Ausstand
 * unter «leitung» und der Sperre am Grundantrag wären es vier Zweige an zwei
 * Orten geworden.
 *
 * `teil` ist der Satz zur Sperre am Grundantrag (`teilentschiedenSatz`), wenn
 * ein Folgeantrag zur Wahl oder Abberufung entschieden ist. Er ersetzt die
 * übrigen: Über diesen Antrag wird nicht mehr abgestimmt, und ihre Rüge
 * bezöge sich auf eine Abstimmung, die nicht kommt. Die Leitungsseiten
 * kürzen deshalb alle Sätze vor dem Eröffnen auf ihn, auch die zu L7 und
 * zum Erfordernis (Codeprüfung P9, G-4).
 */
export function verwaltungssaetzeVorDemEroeffnen(
	lage: {
		wahl: 'ruhen' | 'leitung';
		wahlTrotzHaekchen: boolean;
		ausstandErklaert: boolean;
		abberufungTrotzHaekchen: boolean;
		/** Codeprüfung P9, G-3: Das Traktandum ist selbst ein Folgeantrag. */
		amFolgeantrag?: boolean;
		/** Entscheid 0045, Punkt 11: die Angabe der Leitung an diesem Folgeantrag. */
		angabe?: Verwaltungsangabe;
	} | null,
	teil: string | null
): string[] {
	if (teil) return [teil];
	if (!lage) return [];
	// Entscheid 0045, Punkt 11: Die Angabe gibt es nur unter «ruhen» und nie
	// an Wahl oder Abberufung; dort trägt die Lesung sie nicht weiter
	// (`leseVerwaltungsausstandIn`). Unter «leitung» kündigt die Einladung
	// kein Ruhen an, und der Satz stimmte nicht.
	if (lage.angabe && lage.wahl === 'ruhen') {
		return [
			lage.angabe === 'andere_verwaltung' ? VERWALTUNG_ANGABE_ANDERE_LEITUNG : VERWALTUNG_ANGABE_KUENDIGUNG_LEITUNG
		];
	}
	if (lage.abberufungTrotzHaekchen) {
		return [
			lage.wahl === 'ruhen' ? VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_RUHEN : VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_LEITUNG
		];
	}
	if (lage.wahlTrotzHaekchen) {
		return [
			lage.wahl === 'ruhen'
				? verwaltungWahlTrotzHakenRuhen(lage.amFolgeantrag === true)
				: verwaltungWahlTrotzHakenLeitung(lage.amFolgeantrag === true),
			// R3-3 (07.11.2026): Ein vorab erklärter Ausstand hielte ihre
			// Vollmachten von der Wahl fern, zu der sie zählen.
			...(lage.ausstandErklaert
				? [lage.wahl === 'ruhen' ? VERWALTUNG_WAHL_AUSSTAND_ERKLAERT : VERWALTUNG_WAHL_AUSSTAND_ERKLAERT_LEITUNG]
				: [])
		];
	}
	return [lage.wahl === 'ruhen' ? VERWALTUNG_RUHEN_LEITUNG : VERWALTUNG_LEITUNG_LEITUNG];
}

/**
 * Absage beim Kennzeichnen während einer offenen Abstimmung (H-1). Die
 * Absage beim Kennzeichnen oder Übernehmen des Häkchens, solange an einem
 * Traktandum mit Häkchen derselben Versammlung ein Durchgang offen ist
 * (Lauf 5, 07.11.2026): Die Stimmsperre liest den Ausstand aus L8 beim
 * Abgeben, eingefroren wird er beim Schliessen; eine Änderung dazwischen
 * drehte das Ergebnis still.
 */
// Laienprüfung Runde 4, R4-4, und Fachprüfung Runde 4, R4-3 (07.11.2026):
// was gescheitert ist, der Abbruch, wenn die Kennzeichnung diese Abstimmung
// betrifft, und was an der Tür gilt.
export const VERWALTUNG_KENNZEICHNUNG_GESPERRT =
	'An einem Traktandum zu einem Geschäft der Verwaltung wird gerade abgestimmt. Solange lässt sich ' +
	'die Kennzeichnung dieser Vollmacht nicht ändern, auch nicht beim Bestätigen oder beim Einlass. ' +
	'Sonst stimmte das Ergebnis nicht mit den abgegebenen Stimmen überein. Ist die Kennzeichnung ' +
	// Laienprüfung Runde 5, R5-9: «betrifft diese Abstimmung» liess sich im
	// Saal nicht beurteilen.
	'falsch, brechen Sie die Abstimmung mit «Ohne Ergebnis abbrechen» ab, ändern die Kennzeichnung und ' +
	'geben die Abstimmung neu frei. Kommt nur eine weitere Vollmacht auf denselben Namen dazu, ändern ' +
	'Sie sie, wenn die Abstimmung zu Ende ist. Lassen Sie ' +
	'eine Person, die so eine Vollmacht bringt, erst danach ein; nehmen Sie das Häkchen nicht weg, um ' +
	'sie früher einzulassen.';

/**
 * Die Zeile im Protokoll, Entscheid 8 (07.11.2026), nur unter «Vollmachten
 * ruhen»: Das Protokoll hält fest, dass die Einladung etwas angekündigt hat,
 * das bei diesem Beschluss nicht galt.
 */
export const VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL =
	'Bei diesem Traktandum ging es um die Wahl der Verwaltung; anders als die Einladung angekündigt ' +
	'hatte, ruhten ihre Vollmachten hier nicht.';

/**
 * Die Zeile im Protokoll an der Abberufung als Folgeantrag (Entscheid 0045,
 * Punkt 9), nur unter «Vollmachten ruhen»: wie bei der Wahl die Abweichung
 * von der Einladung, dazu je Fassung, was die Leitung entschied (Laien
 * Runde 5, R5-7; Fach Runde 5, R5-3); nur die Tatsache (Entscheid 3). Diese
 * Fassung ohne erklärten Ausstand.
 */
export const VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL =
	'Bei diesem Traktandum ging es um die Abberufung der Verwaltung. Anders als die Einladung ' +
	'angekündigt hatte, zählten ihre Vollmachten hier; die Sitzungsleitung hat ihren Ausstand nicht ' +
	'erklärt.';

/** Dasselbe, wenn die Leitung den Ausstand der Verwaltung erklärt hat. */
export const VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL =
	'Bei diesem Traktandum ging es um die Abberufung der Verwaltung; ihre Vollmachten ruhten, weil die ' +
	'Sitzungsleitung ihren Ausstand erklärt hat.';

/**
 * Die Zeilen im Protokoll an einem Folgeantrag mit Angabe der Leitung
 * (Entscheid 0045, Punkt 11), nur unter «Vollmachten ruhen»: die Angabe mit
 * ihrem Grund, die Abweichung von der Einladung und, wie an der Abberufung,
 * was die Leitung zum Ausstand entschied. Nur die Tatsache (Entscheid 3).
 */
export const VERWALTUNG_ANGABE_ANDERE_PROTOKOLL =
	'Die Sitzungsleitung hat angegeben, dass dieser Antrag eine andere als die bisherige Verwaltung ' +
	'betrifft. Anders als die Einladung angekündigt hatte, zählten die Vollmachten der bisherigen ' +
	'Verwaltung hier.';
export const VERWALTUNG_ANGABE_ANDERE_AUSSTAND_PROTOKOLL =
	'Die Sitzungsleitung hat angegeben, dass dieser Antrag eine andere als die bisherige Verwaltung ' +
	'betrifft. Die Vollmachten der bisherigen Verwaltung ruhten trotzdem, weil die Sitzungsleitung ihren ' +
	'Ausstand erklärt hat.';
// Laienprüfung Runde 14, R14-5: die Angabe als Angabe und die offene Frage,
// damit sich die Zeile nicht wie ein Regelbruch liest.
export const VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL =
	'Die Sitzungsleitung hat angegeben, dass es bei diesem Antrag um die Kündigung des Vertrags der ' +
	'Verwaltung nach der nicht angenommenen Abberufung ging. Ob ihre Vollmachten dabei ruhen, ist wie bei ' +
	'der Abberufung nicht geklärt. Anders als die Einladung angekündigt hatte, zählten sie hier; die ' +
	'Sitzungsleitung hat ihren Ausstand nicht erklärt.';
export const VERWALTUNG_ANGABE_KUENDIGUNG_AUSSTAND_PROTOKOLL =
	'Die Sitzungsleitung hat angegeben, dass es bei diesem Antrag um die Kündigung des Vertrags der ' +
	'Verwaltung nach der nicht angenommenen Abberufung ging. Die Vollmachten der Verwaltung ruhten, weil ' +
	'die Sitzungsleitung ihren Ausstand erklärt hat.';

/** Die Zeile je Grund und je Entscheid zum Ausstand. */
export function verwaltungsangabeProtokollsatz(grund: Verwaltungsangabe, ausstandErklaert: boolean): string {
	if (grund === 'andere_verwaltung') {
		return ausstandErklaert ? VERWALTUNG_ANGABE_ANDERE_AUSSTAND_PROTOKOLL : VERWALTUNG_ANGABE_ANDERE_PROTOKOLL;
	}
	return ausstandErklaert ? VERWALTUNG_ANGABE_KUENDIGUNG_AUSSTAND_PROTOKOLL : VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL;
}

/**
 * Der Satz an die Leitung an einem Folgeantrag, dessen Grundantrag einen
 * erklärten Ausstand trägt (Laienprüfung Runde 5, R5-4; Produktentscheid
 * 07.11.2026: Satz jetzt, Erben als eigener Auftrag). In ganz Votum
 * übernimmt ein Folgeantrag den erklärten Ausstand nicht.
 */
// Fachprüfung Runde 6, R6-6: Der Ausstand folgt aus dem Gesetz (Art. 68 ZGB),
// nicht aus einer Wahl der Leitung.
export const AUSSTAND_NICHT_GEERBT =
	'Einen Ausstand, den Sie beim ursprünglichen Antrag erklärt haben, übernimmt dieser Folgeantrag ' +
	'nicht. Betrifft sein Grund auch diesen Folgeantrag, erklären Sie ihn hier erneut.';

/**
 * Die Hilfe am Häkchen der Vollmacht, wo die Leitung sie erfasst: auf der
 * Seite der Vollmachten und beim Einlass durch Dritte (L8, Migration 184,
 * M3 und M5). Derselbe Wortlaut an beiden Stellen, weil es dieselbe Angabe
 * ist. Lauf 4 (07.11.2026): Das Häkchen ist das Merkmal, an dem Votum die
 * Vollmachten der Verwaltung erkennt; die Hilfe sagt, wer es prüft und was
 * es nicht wirkt.
 */
export const VERWALTUNG_HAKEN_HILFE_LEITUNG =
	'Ankreuzen, wenn die Vollmacht auf die Verwaltung lautet oder auf eine Person, die für sie handelt, ' +
	'etwa die Bewirtschafterin oder die Geschäftsführung. Daran erkennt Votum die Vollmachten der ' +
	'Verwaltung. Ob sie an Traktanden zu ihrer Entschädigung, zu Verträgen mit ihr und zu ihrer ' +
	'Entlastung ruhen, regelt die Einstellung Ihrer Gemeinschaft. Bei Wahl, Wiederwahl und Abberufung ' +
	'ruhen sie deswegen nicht.';

/**
 * Die Hilfe am Häkchen der Vollmacht, wo die Eigentümerin oder der Eigentümer
 * sie selbst erklärt: unter `/z/` (L8, Migration 184, M5). Derselbe Inhalt
 * wie bei der Leitung, in der Anrede der Seite: Auch `/z/` siezt.
 */
export const VERWALTUNG_HAKEN_HILFE_EIGENTUEMER =
	'Kreuzen Sie das an, wenn Sie die Verwaltung bevollmächtigen oder eine Person, die für sie arbeitet. ' +
	'Je nach Einstellung Ihrer Gemeinschaft zählen Vollmachten der Verwaltung nicht, wenn über ihre ' +
	'Entschädigung, einen Vertrag mit ihr oder ihre Entlastung abgestimmt wird. Die Sitzungsleitung ' +
	'prüft das Häkchen. Wollen Sie dort sicher mitstimmen, kommen Sie selbst oder bevollmächtigen Sie ' +
	'eine andere Person.';

/**
 * Die Absage, wenn die Leitung einen Ausstand aus L8 zurücknehmen will
 * (Lauf 4, 07.11.2026): Er steht in keiner Zeile der Tabelle `recusal`,
 * sondern folgt aus der Einstellung der Gemeinschaft; die Kennung `l8:`
 * vor der Vertreterkennung hält ihn auseinander. Der Server weist ihn ab,
 * nicht nur die Maske, und nennt den Weg, der das Häkchen wirklich ändert.
 */
export const VERWALTUNG_AUSSTAND_NICHT_ZURUECK =
	'Diesen Ausstand hat niemand erklärt: Er folgt aus der Einstellung Ihrer Gemeinschaft und lässt sich ' +
	'hier nicht zurücknehmen. Ist das Häkchen an der Vollmacht falsch, entfernen Sie es unter ' +
	// Laienprüfung Runde 4, R4-7 (07.11.2026): Der häufigste Grund ist die
	// Wahl; dort ist das Häkchen an der Vollmacht richtig.
	'Vollmachten. Ist das Traktandum eine Wahl der Verwaltung, stellen Sie stattdessen das nötige Mehr ' +
	'unter «Nötige Mehrheit ändern» auf «Bewirtschaftung wählen».';

// ── L7: der Satz vor dem Eröffnen, für beide Leitungsseiten ────────────────

/**
 * Welcher Satz zu L7 vor dem Eröffnen auf der Leitungsseite steht (Migration
 * 183), für beide Leitungsseiten (Haus und gemeinsamer Tag): keiner, solange
 * die Beschlussfähigkeit nicht an den Personen im Ausstand hängt; sonst unter
 * «Zählt nicht mit» die Absage, unter der Vorgabe der Satz, dass der
 * Beschluss angreifbar wäre. `befund` ist, was
 * `holeBeschlussfaehigkeitOhneAusstand` liefert (`null` ohne Ausstand oder
 * ohne Momentaufnahme).
 *
 * Herausgelöst nach der Featureprüfung 2, M3 T1 (08.11.2026): Stand die Wahl
 * in jeder Seite einzeln, blieb jede Prüfung grün, wenn eine Seite den Satz
 * nie zeigte; geprüft war nur der Wortlaut der Konstanten.
 */
export function ausstandssaetzeVorDemEroeffnen(
	befund: { haengtAmAusstand: boolean; wahl: Ausstandsbeschlussfaehigkeit } | null | undefined
): string[] {
	if (!befund?.haengtAmAusstand) return [];
	return [befund.wahl === 'zaehlt_nicht' ? AUSSTAND_NICHT_BESCHLUSSFAEHIG : AUSSTAND_ZAEHLT_LEITUNG];
}
