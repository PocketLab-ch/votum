/**
 * Was am aufgerufenen Traktandum **jetzt** noch möglich ist (AD-1).
 *
 * **Der Anlass.** Die Eingriffe während einer Sitzung standen an vier Orten,
 * alle zugeklappt, alle mit einem Fachwort beschriftet: der Ausstand in der
 * Ablaufkarte, Zurückziehen und Rückkommen an der Zeile in der Traktandenliste,
 * der Folgeantrag unter «Traktandum aufnehmen» ganz unten. Wer sie kannte, fand
 * sie. Wer sie nicht kannte, erfuhr nirgends, dass es sie gibt — und im Saal
 * sucht niemand.
 *
 * Gemeldet am 13.08.2026: «Immer den Fokus des Nutzers ohne Programmkenntnisse
 * und Stress durch die Sitzungsleitung im Hinterkopf behalten. Einfach
 * verständlich, intuitiv und sichtbar (nicht dominant).»
 *
 * **Deshalb eine Zeile statt eines Menüs.** Sie nennt genau die Eingriffe, die
 * in dieser Lage möglich sind — nicht alle denkbaren, ausgegraut. Ein Eintrag,
 * den man nicht drücken kann, ist eine Frage ohne Antwort: Warum nicht? Was
 * fehlt? Steht er gar nicht erst da, stellt sich die Frage nicht.
 *
 * **Und deshalb hier und nicht in der Seite.** Ob ein Antrag noch
 * zurückgezogen werden darf, ist dieselbe Frage wie die, die der Server beim
 * Abschicken stellt. Zwei Fassungen liefen auseinander, und dann böte die Seite
 * etwas an, das die Absage danach verweigert.
 */
import { taugtAlsGrundantrag } from './folgeantrag';

/** Die Lage, aus der sich ergibt, was geht. */
export interface Traktandumslage {
	/** 'abstimmung', 'kenntnisnahme' oder eine der übrigen Arten. */
	art: string;
	/** Ob ein geschlossener Durchgang mit Ergebnis vorliegt. */
	abgestimmt: boolean;
	/**
	 * Ob dieses Ergebnis «kein Beschluss» ist (Migration 128). Dann gibt es kein
	 * Rückkommen: Es gibt keinen Beschluss, auf den man zurückkäme
	 * (`verlangeRueckkommbar`). Alles andere bleibt wie nach jeder Abstimmung.
	 */
	keinBeschluss?: boolean;
	/**
	 * Ob über das Geschäft bisher nur konsultativ abgestimmt wurde (Migration
	 * 158). Dann ist `abgestimmt` falsch, das Geschäft ist offen
	 * (Produktentscheid 14.10.2026, H7 Teil D), und die Sätze zu Rückzug und
	 * Mehrheit sagen nicht mehr «es gab keine Abstimmung» oder «bis zur
	 * Abstimmung». Fehlt die Angabe, gilt nein.
	 */
	konsultativ?: boolean;
	/** Ob gerade abgestimmt wird. */
	durchgangOffen: boolean;
	/** Ob der Antrag bereits zurückgezogen wurde. */
	zurueckgezogen: boolean;
	/** Ob zu diesem Traktandum schon ein Rückkommensantrag steht. */
	rueckkommenLaeuft: boolean;
	/** Ob ein Mehrheitserfordernis festgehalten ist. */
	hatErfordernis: boolean;
	/**
	 * Ob es während des offenen Durchgangs ein Veto zu erfassen gibt: eine
	 * Betroffene, die zugleich im Ausstand ist (Auftrag «Veto im Ausstand»,
	 * 26.09.2026). Fehlt es, gibt es den Eingriff nicht.
	 */
	kenntVeto?: boolean;
	/**
	 * Ob das Traktandum erst im Saal aufgenommen wurde. Dann gibt es keinen
	 * Gegenantrag: Ein Folgeantrag stützt sich auf einen angekündigten Antrag,
	 * und `nimmTraktandumAuf` weist jeden anderen Grundantrag ab
	 * (`hindernisAlsGrundantrag`). Angeboten und dann abgewiesen hiess, die
	 * Leitung füllt einen Dialog aus, der nicht zum Ziel führt (Codeprüfung
	 * 29.09.2026).
	 */
	spontan?: boolean;
	/**
	 * Ob auf diesen Antrag ein angenommener Rückkommensantrag wartet, der seinen
	 * einen Durchgang noch nicht getragen hat. Dann gibt es den Gegenantrag auch
	 * nach der Abstimmung: Er tritt an die Stelle des alten Antrags
	 * (Produktentscheid 30.09.2026; `hindernisAlsGrundantrag`). Fehlt die
	 * Angabe, gilt nein.
	 */
	rueckkommenOffen?: boolean;
	/**
	 * Nur beim Folgeantrag: ob sein Grundantrag entschieden ist. Dann wird auf
	 * den Grundantrag zurückgekommen, nicht auf den Folgeantrag, und der Server
	 * weist ein Rückkommen hier ab (`hindernisRueckkommenAufFolgeantrag`).
	 */
	grundantragEntschieden?: boolean;
	/**
	 * Ob der geltende Beschluss angenommen ist. Nach einem Rückkommen auf eine
	 * Ablehnung bleibt es mit Nein bei einer Ablehnung; der Hilfesatz zum
	 * Gegenantrag unterscheidet das (Fachprüfung 30.09.2026, Runde 2, R2-1).
	 * Fehlt die Angabe, gilt angenommen, die strengere Warnung.
	 */
	beschlussAngenommen?: boolean;
}

export type Eingriffsart =
	| 'ausstand'
	| 'betroffene'
	| 'veto'
	| 'gegenantrag'
	| 'zurueckziehen'
	| 'mehrheit'
	| 'rueckkommen';

export interface Eingriff {
	art: Eingriffsart;
	/**
	 * Die Beschriftung in der Zeile — **ein Wort in Laiensprache**, kein
	 * Fachbegriff. «Ausstand» sagt nur denen etwas, die ihn schon kennen; die
	 * anderen lesen darüber hinweg.
	 */
	wort: string;
	/** Der Fachbegriff, in Klammern hinter der Überschrift (docs/gestaltung.md). */
	fachwort: string | null;
	/** Die Überschrift des aufgeklappten Feldes — eine ganze Aussage. */
	titel: string;
	/** Was es bewirkt, in einem Satz. Steht im aufgeklappten Feld. */
	satz: string;
}

/**
 * Der Katalog. Die Reihenfolge ist die der Zeile, und sie ist nicht beliebig:
 * Zuerst das, was **vor** der Abstimmung geschieht (Ausstand, Gegenantrag),
 * dann die Rücknahme, dann die Regeländerung — und ganz am Ende, was erst
 * **nach** einem Ergebnis in Frage kommt.
 */
const KATALOG: Record<Eingriffsart, Omit<Eingriff, 'art'>> = {
	ausstand: {
		wort: 'Ausstand',
		fachwort: 'Ausstand, ZGB Art. 68',
		titel: 'Jemand darf hier nicht mitentscheiden',
		satz:
			'Wer über eine Sache in eigener Sache mitentscheiden soll, ist vom Stimmrecht ' +
			'ausgeschlossen. Er zählt dann auch nicht mit — anders als bei einer Enthaltung, ' +
			'die in der Regel in der Bezugsgrösse bleibt und wie ein Nein wirkt.'
	},
	/*
	 * **Seit Block A2 (25.09.2026) auch im Saal.** Vorher liessen sich
	 * Betroffene nur im Entwurf zuordnen, und die Sperre beim Eröffnen hatte
	 * keinen Weg. Der Satz sagt, was die Anwendung tut, nicht was das Gesetz
	 * verlangt: Das steht am Erfordernis.
	 */
	betroffene: {
		wort: 'Betroffene',
		fachwort: 'unmittelbar Betroffene',
		titel: 'Wer bei diesem Geschäft unmittelbar betroffen ist',
		/*
		 * Für beide Fälle, die `betroffenenlage.kennt` zusammenfasst (Code-Review
		 * A2b, Befund 2): Bei den Nutzungsrechten und Wertquoten braucht es die
		 * Zustimmung der Betroffenen, bei der Ausschlussklage zählen sie nicht mit.
		 */
		satz:
			'Je nach Erfordernis braucht es ihre Zustimmung, oder sie zählen nicht mit. Tragen Sie ' +
			'sie hier ein, vor der Abstimmung. Wo das Erfordernis die Zustimmung im Saal oder ' +
			'vorab vorsieht, lässt sich eine vorher schriftlich erteilte Zustimmung vermerken. ' +
			'Ohne Vermerk kann die betroffene Person dort an der Abstimmung selbst zustimmen, per ' +
			'Wortmeldung im Saal, per schriftlicher Antwort oder über das Mobiltelefon. Erfassen ' +
			'Sie die Zustimmung dann hier.'
	},
	/*
	 * **Der einzige Eingriff während des offenen Durchgangs** (Auftrag «Veto im
	 * Ausstand», 26.09.2026). Alles andere verschiebt die Bezugsgrösse unter den
	 * laufenden Stimmen; das Veto nicht: Es zählt nur als Zustimmung, nie bei
	 * der Mehrheit. Die Betroffene kann es am eigenen Telefon abgeben; hier
	 * erfasst die Sitzungsleitung den mündlichen Entscheid.
	 */
	veto: {
		wort: 'Veto',
		fachwort: 'Zustimmung im Ausstand',
		// «entscheidet über ihr Veto» las sich neben «Zustimmen» wie «dem Veto
		// zustimmen» (Laienprüfung Runde 9, Stelle 2).
		titel: 'Eine Betroffene im Ausstand entscheidet, ob sie zustimmt',
		satz:
			'Eine Betroffene im Ausstand stimmt bei der Mehrheit nicht mit, entscheidet aber, ob sie ' +
			'zustimmt. Das tut sie oder ihre Vertretung am eigenen Gerät, oder eine von beiden sagt es ' +
			'Ihnen, auch telefonisch, und Sie erfassen es hier; bei einer Vertretung nach geprüfter ' +
			'Vollmacht. Der Entscheid wirkt nur auf die Zustimmung, nie auf die Mehrheit. Schliessen ' +
			'Sie die Abstimmung ohne Entscheid und ohne Vermerk, fehlt die Zustimmung, und der Antrag ' +
			'ist abgelehnt, auch wenn die Mehrheit zustimmt.'
	},
	gegenantrag: {
		wort: 'Gegenantrag',
		fachwort: 'Folgeantrag',
		titel: 'Jemand stellt einen Gegenantrag',
		satz:
			'Ein anderer Betrag, eine Etappierung, ein Vorbehalt: Solange er sich im Kern des ' +
			'angekündigten Antrags hält, darf darüber abgestimmt werden. Über ihn wird zuerst ' +
			// Codeprüfung P9, G-2: Nach einem angenommenen Folgeantrag oder
			// unter dem Häkchen (Entscheid 0045, Punkt 9) entfällt der zweite.
			'abgestimmt, danach, wenn nötig, über den ursprünglichen Antrag.'
	},
	zurueckziehen: {
		wort: 'Zurückziehen',
		fachwort: null,
		titel: 'Der Antrag wird zurückgezogen',
		satz:
			'Er bleibt in der Liste und im Protokoll — als zurückgezogen, nicht als abgelehnt. ' +
			'Es gab keine Abstimmung, also auch keine Mehrheit dagegen.'
	},
	mehrheit: {
		wort: 'Nötige Mehrheit',
		fachwort: 'Mehrheitserfordernis',
		titel: 'Die nötige Mehrheit stimmt nicht',
		satz:
			'Bis zur Abstimmung lässt sie sich ändern, danach erst wieder nach einem angenommenen ' +
			'Rückkommen: Sonst stünde am Traktandum eine andere Regel als die, nach der gezählt wurde.'
	},
	rueckkommen: {
		wort: 'Nochmals abstimmen',
		fachwort: 'Rückkommen',
		titel: 'Über die Sache soll nochmals abgestimmt werden',
		satz:
			'Darüber entscheidet die Versammlung, nicht die Sitzungsleitung. Es entsteht ein ' +
			'eigener Antrag; erst wenn er angenommen ist, lässt sich zur Sache nochmals ' +
			'abstimmen. Bis dahin gilt der frühere Beschluss.'
	}
};

/**
 * Die zwei Sätze, die nach einer konsultativen Abstimmung nicht mehr stimmen
 * (H7, Teil D): Es gab eine Abstimmung, aber keinen Beschluss.
 *
 * Mit wem, der zurückzieht: Nach einem deutlichen Nein läge es für die
 * Leitung nahe, selbst «aufzuräumen» (Laienprüfung 14.10.2026, D1). Und die
 * Mehrheit wird berichtigt, nicht dem Ergebnis angepasst: Das Quorum bestimmt
 * der Vorsitz nach Gesetz und Reglement, ein ungültiges Mehr macht den
 * Beschluss anfechtbar (Fach- und Laienprüfung 14.10.2026, D2 und D6;
 * Rz. 99, 100 ad Art. 712n).
 */
export const NACH_KONSULTATIV: Record<'zurueckziehen' | 'mehrheit', string> = {
	zurueckziehen:
		'Er bleibt in der Liste und im Protokoll, als zurückgezogen, nicht als abgelehnt. ' +
		'Zurückziehen kann, wer den Antrag gestellt hat. Die konsultative Abstimmung bleibt mit ' +
		'ihren Zahlen im Protokoll stehen; einen Beschluss gab es dabei nicht.',
	mehrheit:
		'Abgestimmt wurde nur konsultativ, entschieden ist nichts. Ist das Geschäft falsch ' +
		'eingeordnet, lässt sich die nötige Mehrheit deshalb bis zur verbindlichen Abstimmung ' +
		'berichtigen. Massgebend sind Gesetz und Reglement, nicht das konsultative Ergebnis.'
};

/**
 * Welche Eingriffe in dieser Lage möglich sind.
 *
 * **Während einer laufenden Abstimmung fällt fast alles weg**, und das ist
 * keine Bequemlichkeit: Ein Ausstand mitten im Durchgang verschöbe die
 * Bezugsgrösse unter den bereits abgegebenen Stimmen weg. Was übrig bleibt,
 * ist der Abbruch ohne Ergebnis (H6, `AbstimmungAbbrechen`), und den nennt
 * die Absage.
 */
export function moeglicheEingriffe(lage: Traktandumslage): Eingriff[] {
	const arten: Eingriffsart[] = [];
	const antrag = lage.art === 'abstimmung';
	const offen = !lage.abgestimmt && !lage.zurueckgezogen;

	// Der Ausstand geht auch bei einer Kenntnisnahme nicht: Dort wird nicht
	// abgestimmt, also gibt es kein Stimmrecht, von dem jemand auszuschliessen
	// wäre. Und nicht im laufenden Durchgang.
	if (antrag && offen && !lage.durchgangOffen) arten.push('ausstand');
	/*
	 * **Immer angeboten, auch wo das Erfordernis keine Betroffenen kennt**
	 * (Auftrag 03.10.2026). Vorher fiel der Eintrag beim von Hand gesetzten
	 * Mehr weg, und die Leitung fand den Weg nicht, wenn sich in der Diskussion
	 * eine betroffene Person zeigte. Jetzt steht er; das Feld zeigt dann statt
	 * der Eingabe den Weg über «Nötige Mehrheit ändern», weil eine Eintragung
	 * ohne passendes Erfordernis keine Wirkung hätte und der Server sie
	 * ablehnt. Dieselbe Grenze wie beim Ausstand: nicht im laufenden Durchgang.
	 */
	if (antrag && offen && !lage.durchgangOffen) arten.push('betroffene');

	/*
	 * **Dieselbe Regel wie das Aufnahmeformular** (`taugtAlsGrundantrag`). Bis
	 * zum 30.09.2026 stand hier eine eigene Fassung, und nach einem angenommenen
	 * Rückkommen fehlte der Gegenantrag, obwohl der Server ihn annahm: Die
	 * Leitung fand den Weg «statt des alten Antrags» nicht (Codeprüfung B1).
	 */
	if (
		antrag &&
		taugtAlsGrundantrag({
			art: 'abstimmung',
			spontan: lage.spontan ?? false,
			entschieden: lage.abgestimmt,
			durchgangOffen: lage.durchgangOffen,
			zurueckgezogen: lage.zurueckgezogen,
			rueckkommenOffen: lage.rueckkommenOffen
		})
	) {
		arten.push('gegenantrag');
	}
	if (antrag && offen && !lage.durchgangOffen) arten.push('zurueckziehen');
	if (antrag && offen && lage.hatErfordernis && !lage.durchgangOffen) arten.push('mehrheit');

	/*
	 * **Und der eine Eingriff, der gerade jetzt geht.** Während des offenen
	 * Durchgangs fällt alles andere weg; der Veto-Entscheid gehört genau
	 * dorthin. Er braucht die Betroffenen im Ausstand, und die gibt es nur,
	 * wo das Erfordernis sie kennt.
	 */
	if (antrag && lage.durchgangOffen && lage.kenntVeto) arten.push('veto');

	if (
		antrag &&
		lage.abgestimmt &&
		!lage.keinBeschluss &&
		!lage.rueckkommenLaeuft &&
		!lage.durchgangOffen &&
		!lage.grundantragEntschieden
	) {
		arten.push('rueckkommen');
	}

	return arten.map((art): Eingriff => {
		if (lage.konsultativ && (art === 'zurueckziehen' || art === 'mehrheit')) {
			return { art, ...KATALOG[art], satz: NACH_KONSULTATIV[art] };
		}
		/*
		 * **Nach der Abstimmung heisst Gegenantrag etwas anderes** (Codeprüfung
		 * B2a, M2). Vor ihr wird über ihn zuerst abgestimmt und danach über den
		 * ursprünglichen Antrag; nach einem angenommenen Rückkommen tritt er an
		 * dessen Stelle, und über den alten Antrag wird nicht mehr abgestimmt
		 * (Produktentscheid 30.09.2026). Der Satz vor der Abstimmung sagte hier
		 * die falsche Reihenfolge.
		 */
		if (art === 'gegenantrag' && lage.abgestimmt) {
			return {
				art,
				...KATALOG[art],
				satz: gegenantragNachRueckkommen(lage.beschlussAngenommen !== false)
			};
		}
		return { art, ...KATALOG[art] };
	});
}

/**
 * Der Hilfesatz zum Gegenantrag nach einem angenommenen Rückkommen.
 *
 * Der Massstab ist das angekündigte Traktandum, nicht der Antrag (Fachprüfung
 * 30.09.2026, F-4; Rz. 44 ad Art. 712n). «Ein Durchgang» als Regel dieser
 * Anwendung, mit der Folge und dem Ausweg über die Versammlung (F-1;
 * Ordnungsantrag nach Rz. 98a ad Art. 712n, Folgerung), und die Folge schon
 * hier, wo gewählt wird (Laienprüfung 30.09.2026, 5a). Den Ordnungsantrag
 * bildet die Anwendung nicht ab: per Handzeichen, mit Notiz (Runde 2, R2-2).
 * Nach einem Rückkommen auf eine Ablehnung bleibt es mit Nein bei einer
 * Ablehnung (R2-1).
 */
export function gegenantragNachRueckkommen(bisherAngenommen: boolean): string {
	return (
		'Die Versammlung ist zurückgekommen. Statt des alten Antrags darf jetzt ein Gegenantrag ' +
		'(Folgeantrag) zur Abstimmung kommen, solange er sich im Kern des angekündigten Traktandums ' +
		'hält; das beurteilen Sie. Nach der Regel dieser Anwendung trägt das Rückkommen einen ' +
		'Durchgang: Abgestimmt wird dann nur über den Gegenantrag, ' +
		(bisherAngenommen
			? 'und der bisherige Beschluss fällt mit Ja wie mit Nein weg. '
			: 'mit Ja gilt er, mit Nein bleibt es bei einer Ablehnung. ') +
		// In beide Richtungen (Fachprüfung Runde 3, F3-2; Rz. 98a ad Art. 712n:
		// «jederzeit entgegenzunehmen»), nach Stimmen gezählt (F3-1) und mit der
		// Notiz in jedem Fall (Laienprüfung Runde 3, 5d-7).
		'Verlangt jemand, dass stattdessen über den alten Antrag abgestimmt wird, oder umgekehrt über ' +
		'einen Gegenantrag, lassen Sie zuerst die Versammlung darüber entscheiden: als Ordnungsantrag ' +
		'mit einfachem Mehr, per Handzeichen; Vertreter zählen für jede Vollmacht, Zugeschaltete ' +
		'fragen Sie einzeln. Halten Sie den Ordnungsbeschluss in jedem Fall als Notiz beim ' +
		'Traktandum fest.'
	);
}

/**
 * Der Satz über der Zeile — oder der Grund, warum gerade nichts geht.
 *
 * **Eine leere Zeile wäre die schlechteste Antwort.** Wer eben noch vier
 * Möglichkeiten sah und jetzt keine, sucht den Fehler bei sich. Der Satz sagt,
 * woran es liegt und wie man wieder hinkommt.
 */
export function eingriffssatz(lage: Traktandumslage, anzahl: number): string {
	if (anzahl > 0) return 'Jetzt möglich:';
	if (lage.durchgangOffen) {
		return 'Während der Abstimmung sind keine Änderungen möglich — schliessen Sie sie zuerst.';
	}
	if (lage.zurueckgezogen) return 'Der Antrag ist zurückgezogen.';
	if (lage.rueckkommenLaeuft) {
		return 'Zu diesem Traktandum steht bereits ein Rückkommensantrag.';
	}
	if (lage.art === 'kenntnisnahme') {
		return 'Dieses Traktandum wird zur Kenntnis genommen; es gibt nichts zu ändern.';
	}
	// Was nach «kein Beschluss» geht, steht beim Ergebnis (Migration 128;
	// Codeprüfung Block 3, dritter Durchgang, N-e).
	if (lage.keinBeschluss) return 'Kein Beschluss. Was jetzt möglich ist, steht beim Ergebnis.';
	// Am Folgeantrag, sobald der Grundantrag entschieden ist: Der Weg liegt dort,
	// nicht nirgends (Codeprüfung B2a, N3).
	if (lage.grundantragEntschieden) {
		return (
			'Über den Grundantrag ist abgestimmt. Soll die Sache nochmals zur Abstimmung, beantragen ' +
			'Sie das Rückkommen beim Grundantrag.'
		);
	}
	return 'Hier ist nichts mehr zu ändern.';
}
