/**
 * Der Ablauf einer **gemeinsamen Versammlung** — dieselbe Bauart wie bei einer
 * einzelnen (`vorbereitung.ts`), damit die Seite daneben dieselbe ist (rein).
 *
 * **Warum das nötig war.** Die Seite der gemeinsamen Versammlung war die letzte
 * ohne Ablaufleiste: vier Abschnitte untereinander, neun Knöpfe, eine Tabelle
 * mit sieben Spalten — und «Einlass» mitten in der Vorbereitung, obwohl er erst
 * im Saal etwas tut. Gemeldet am 11.08.2026: «Das sieht nach einem eigenen
 * Ablauf aus und stimmt überhaupt nicht mit der Ansicht der Einzelversammlung
 * überein. Ob Einzelversammlung oder gemeinsame Versammlung, das Layout soll
 * sich nicht unterscheiden.»
 *
 * **Sichtbar gesperrt statt versteckt**, wie im einzelnen Ablauf: Der Einlass
 * verschwindet nicht, solange keine Versammlung läuft — er steht da und sagt,
 * was ihn freischaltet. Ein Formular, das sichtbar ist und nichts tut, ist
 * schlimmer als eines, das seinen Grund nennt.
 *
 * Rein: hinein geht die Lage, heraus kommt die Schrittfolge. Kein Zugriff auf
 * Datenbank oder Uhr (AD-1).
 */
import type { Schritt, Schrittgruppe } from './vorbereitung';

/**
 * Die vier Stammdatenthemen — **wortgleich** mit dem Ablauf einer einzelnen
 * Versammlung (`vorbereitung.ts`).
 *
 * Gemeldet am 11.08.2026: «Auch das Wording ist nicht einheitlich.» Wer beide
 * Abläufe nebeneinander sieht, soll dieselben Namen lesen; zwei Bezeichnungen
 * für dieselbe Sache lassen den Verdacht aufkommen, es sei nicht dasselbe.
 */
const STAMMDATENSCHRITTE = [
	{
		kennung: 'einheiten',
		titel: 'Einheiten und Wertquoten',
		beschreibung: 'Was es gibt und mit welchem Anteil — je Gemeinschaft.'
	},
	{
		kennung: 'eigentuemer',
		titel: 'Eigentümer und Zuordnung',
		beschreibung: 'Wem was gehört, und seit wann.'
	},
	{
		kennung: 'reglement',
		titel: 'Reglement und Quoren',
		beschreibung: 'Wo das Reglement vom Gesetz abweicht.'
	},
	{
		kennung: 'beschlussfaehigkeit',
		titel: 'Beschlussfähigkeit',
		beschreibung: 'Ab wann die Versammlung beschliessen darf.'
	}
];

export interface GemeinsameLage {
	tagId: string;
	/** Wie viele Versammlungen dazugehören. */
	haeuser: number;
	/** Wie viele davon laufen gerade. */
	laufend: number;
	/** Wie viele schon geschlossen oder versiegelt sind. */
	fertig: number;
	/** Häuser, bei denen die Stammdaten noch nicht vollständig sind. */
	stammdatenOffen: number;
	/**
	 * Je Stammdatenthema, bei wie vielen Häusern es noch offen ist.
	 *
	 * Gemeldet am 11.08.2026: «Bei der Einzelansicht gibt es noch Einheiten WQ,
	 * Eigentümer und Zuordnung oder Reglement und Quoren. Braucht es das bei der
	 * Sammelversammlung nicht?» Es brauchte es — nur stand es hinter einem
	 * einzigen Schritt «Stammdaten je Gemeinschaft» und war von aussen nicht zu
	 * sehen.
	 */
	themenOffen: Record<string, number>;
	/** Wie viele gemeinsame Geschäfte angelegt sind. */
	geschaefte: number;
	/** Ob Bezeichnung, Datum und Ort stehen — beim Anlegen Pflicht, also immer. */
	angabenStehen: boolean;
	/** Wie viele der mittagenden Versammlungen noch im Entwurf sind. */
	imEntwurf: number;
	/**
	 * Bei wie vielen Häusern die Ausfallsicherung noch offen ist.
	 *
	 * **Der Abend hatte sie gar nicht** (02.09.2026, beim Nachgehen des
	 * Praxisbefunds des Auftraggebers «die Liste muss je Gemeinschaft sein, bei einer
	 * Sammelveranstaltung also eine pro Gemeinschaft»). Der einzelne Ablauf führt
	 * die Ausfallsicherung seit dem 23.08.2026 als Schritt; der gemeinsame sprang
	 * von der Freigabe direkt in den Saal. Wer den Abend führte, sah den Punkt
	 * nie — und die Unterlagen hängen je Gemeinschaft, also gerade dort, wo der Auftraggeber
	 * «ohne dass ich in 5 STWEG hin und her springen muss» nicht mehr hinwollte.
	 */
	ausfallOffen: number;
	/**
	 * Wie viele Versammlungen geschlossen oder versiegelt sind (Story 7.5b).
	 *
	 * Die Zusammenstellung des Abends lohnt sich erst, wenn überhaupt etwas
	 * beschlossen wurde — vorher stünde ein Dokument da, in dem unter jedem Punkt
	 * «noch kein Ergebnis» steht.
	 */
	abgeschlossen: number;
	/** Was der Zusammenstellung noch fehlt, fertig als Satz aus dem Kern. */
	protokollluecke?: string | null;
}

export function gemeinsameSchritte(lage: GemeinsameLage): Schritt[] {
	const s: Schritt[] = [];
	const w = `/tage/${lage.tagId}`;

	s.push({
		kennung: 'angaben',
		titel: 'Angaben',
		beschreibung: 'Bezeichnung, Tag, Beginn und Ort — so steht es in der Einladung.',
		zustand: lage.angabenStehen ? 'erledigt' : 'offen',
		pfad: w
	});

	s.push({
		kennung: 'haeuser',
		titel: 'Wer tagt mit',
		beschreibung: 'Welche Gemeinschaften an diesem Tag zusammenkommen.',
		zustand: lage.haeuser > 0 ? 'erledigt' : 'offen',
		pfad: `${w}/haeuser`,
		stand:
			lage.haeuser === 0
				? 'noch keine Gemeinschaft zugeordnet'
				: `${lage.haeuser} ${lage.haeuser === 1 ? 'Gemeinschaft' : 'Gemeinschaften'}`
	});

	/*
	 * **Die Themen als Schritte, die Häuser als Reiter.** Vorher stand hier ein
	 * einziger Punkt «Stammdaten je Gemeinschaft» — mit der Begründung, vier
	 * Themen mal sechs Häuser wären vierundzwanzig Zeilen. Das stimmt für die
	 * Kreuzung von beidem, nicht für die Themen allein: Die sind vier, wie bei
	 * einer einzelnen Versammlung auch, und wer den Ablauf dort kennt, findet
	 * hier dieselben Namen wieder. Welche Häuser dahinterstehen, zeigt die Seite.
	 */
	for (const t of STAMMDATENSCHRITTE) {
		const offen = lage.themenOffen[t.kennung] ?? 0;
		// Der Plural richtet sich nach der **Gesamtzahl**, nicht nach den offenen:
		// «1 von 2 Gemeinschaft» stand da, bis es jemand las.
		const wieViele = `${offen} von ${lage.haeuser} ${
			lage.haeuser === 1 ? 'Gemeinschaft' : 'Gemeinschaften'
		} noch offen`;
		/*
		 * **Die Lücke steht nur, wenn schon gearbeitet wurde** — also wenn ein Teil
		 * der Häuser erfasst ist und ein Teil nicht.
		 *
		 * Genau dieser Zustand ist der übersehbare: Der Schritt sieht aus wie
		 * angefangen, und dass zwei von sechs Gemeinschaften noch fehlen, stand
		 * bisher nur in der Zeile, auf der man gerade stand. «Noch gar nichts
		 * erfasst» dagegen ist keine Lücke, sondern der Anfang — vier
		 * Ausrufezeichen an einem frisch angelegten Abend wären ein Alarm über den
		 * Normalfall.
		 */
		const angefangen = offen > 0 && offen < lage.haeuser;
		/*
		 * **Die Warnung ist die kurze Fassung**, der Stand die lange. Sie steht in
		 * der Leiste an allen vier Themen zugleich; ausgeschrieben brach jede auf
		 * zwei Zeilen um und machte die Leiste um 160 Pixel länger (gemessen bei
		 * 1440 px). Was gemeint ist, sagt der Titel darüber — und ausgeschrieben
		 * steht es weiterhin auf der Seite und im Weiterweg am Fuss.
		 */
		const knapp = `${offen} von ${lage.haeuser} offen`;
		s.push({
			kennung: t.kennung,
			titel: t.titel,
			beschreibung: t.beschreibung,
			zustand: lage.haeuser === 0 ? 'gesperrt' : offen === 0 ? 'erledigt' : 'offen',
			sperrgrund:
				lage.haeuser === 0 ? 'Erst wenn mindestens eine Gemeinschaft mittagt.' : undefined,
			pfad: `${w}/stammdaten?thema=${t.kennung}`,
			warnung: angefangen ? knapp : undefined,
			stand:
				lage.haeuser === 0
					? undefined
					: offen === 0
						? `alle ${lage.haeuser === 1 ? 'vollständig' : `${lage.haeuser} vollständig`}`
						: wieViele
		});
	}

	s.push({
		kennung: 'geschaefte',
		// «Traktandenliste», wie bei einer einzelnen Versammlung — nicht
		// «Traktanden» und nicht «Gemeinsame Geschäfte» (Auftraggeber, 11.08.2026).
		titel: 'Traktandenliste',
		beschreibung:
			'Die Liste des ganzen Abends — dieselbe Nummer im Saal wie im Protokoll jeder Gemeinschaft.',
		/*
		 * Nie «offen»: Was die Gemeinschaften an Pflichttraktanden mitbringen, steht
		 * beim Öffnen der Seite ohnehin schon auf der Liste. Bis zum 11.08.2026 hiess
		 * es hier «jede Gemeinschaft hat ihre eigene Liste» — das galt, solange die
		 * mitgebrachten Traktanden aussen vor blieben, und war genau der Bruch, den
		 * der Auftraggeber gemeldet hat.
		 */
		zustand: lage.haeuser === 0 ? 'gesperrt' : 'erledigt',
		sperrgrund: lage.haeuser === 0 ? 'Erst wenn mindestens eine Gemeinschaft mittagt.' : undefined,
		pfad: `${w}/geschaefte`,
		stand:
			lage.geschaefte === 0
				? 'noch keines'
				: `${lage.geschaefte} ${lage.geschaefte === 1 ? 'Traktandum' : 'Traktanden'}`
	});

	/*
	 * **Der Abschnitt «Ausgeben» fehlte.** Der einzelne Ablauf hat ihn
	 * (`vorbereitung.ts`: Freigeben, Einladung, Zugänge), der gemeinsame sprang
	 * von der Vorbereitung direkt in den Saal — gemeldet am 11.08.2026 im
	 * Vergleich mit dem Entwurf. Freigegeben wird je Gemeinschaft, denn jede hat
	 * ihre eigene Momentaufnahme; die Seite tut es für alle auf einmal.
	 */
	s.push({
		kennung: 'freigabe',
		titel: 'Freigeben',
		beschreibung: 'Jede Gemeinschaft einzeln — hier für alle auf einmal.',
		zustand:
			lage.haeuser === 0 ? 'gesperrt' : lage.imEntwurf === 0 ? 'erledigt' : 'offen',
		sperrgrund: lage.haeuser === 0 ? 'Erst wenn mindestens eine Gemeinschaft mittagt.' : undefined,
		pfad: `${w}/freigeben`,
		stand:
			lage.haeuser === 0
				? undefined
				: lage.imEntwurf === 0
					? 'alle freigegeben'
					: `${lage.imEntwurf} von ${lage.haeuser} noch im Entwurf`
	});

	/*
	 * **Die Ausfallsicherung, wie im Haus** (02.09.2026). Sie steht nach der
	 * Freigabe, weil alle Unterlagen auf der Momentaufnahme rechnen — dieselbe
	 * Begründung wie im einzelnen Ablauf.
	 *
	 * Der Stand zählt **Häuser, nicht Unterlagen**: Am Abend geht es darum, dass
	 * keine Gemeinschaft ohne ihren Papierstapel dasteht. Wie viele Blätter das
	 * je Haus sind, hängt an dessen Abstimmungsweise und steht dort.
	 */
	/*
	 * **Offen ab der ersten Freigabe, nicht erst ab der letzten** (aus dem
	 * Code-Review). Der erste Anlauf sperrte, solange **eine** Gemeinschaft im
	 * Entwurf stand. Ein gesperrter Punkt ist in der Leiste ein `<span>` ohne
	 * Link: bei vier von fünf freigegebenen Häusern wäre die Seite nur über die
	 * eingetippte Adresse erreichbar gewesen. Und genau dort hätte sie gezeigt, was sie zeigen soll: die vier
	 * fertigen Sätze und den einen, der noch fehlt.
	 *
	 * Derselbe Schnitt wie beim Nachbarschritt «Anwesenheit»: `freigegeben > 0`.
	 * Was für eine einzelne Gemeinschaft noch nicht bereit ist, sagt ihre Karte.
	 *
	 * **Seit dem 09.09.2026 gibt es einen zweiten Weg**, den Verweis unter
	 * «Jederzeit». Er ändert nichts an dieser Rechnung, weil er sie nicht selbst
	 * anstellt: Er übernimmt Zustand und Grund von diesem Schritt. Solange hier
	 * gesperrt ist, ist es dort gesperrt.
	 */
	const freigegebeneHaeuser = lage.haeuser - lage.imEntwurf;
	s.push({
		kennung: 'ausfall',
		titel: 'Ausfallsicherung holen',
		beschreibung:
			'Traktandenliste, Unterschriftenliste und Stimmzettel — je Gemeinschaft ein eigener ' +
			'Satz. Wer sie braucht, hat den Server nicht mehr, von dem er sie holen könnte.',
		zustand:
			freigegebeneHaeuser === 0 ? 'gesperrt' : lage.ausfallOffen === 0 ? 'erledigt' : 'offen',
		sperrgrund:
			freigegebeneHaeuser > 0
				? undefined
				: lage.haeuser === 0
					? 'Erst wenn mindestens eine Gemeinschaft mittagt.'
					: 'Erst nach der Freigabe: Die Unterlagen rechnen auf dem eingefrorenen Stand der ' +
						'Stimmberechtigten.',
		pfad: `${w}/ausfall`,
		stand:
			freigegebeneHaeuser === 0
				? undefined
				: lage.ausfallOffen === 0
					? 'für alle Gemeinschaften geholt'
					: `${lage.ausfallOffen} von ${lage.haeuser} noch offen`
	});

	/*
	 * **Derselbe Name wie im Haus** (Auftraggeber, 24.08.2026): «Die Funktionalität von
	 * Anwesenheit und Beschlussfähigkeit gegenüber Einlass ist auch nicht
	 * identisch. Bitte Einlass nach Anwesenheit und Beschlussfähigkeit anpassen.
	 * Auch die Bezeichnung in der Seitenleiste übernehmen.»
	 *
	 * Der Schritt hiess «Einlass» und meinte dasselbe wie «Anwesenheit und
	 * Beschlussfähigkeit» im Ablauf einer einzelnen Versammlung. Zwei Wörter für
	 * eine Sache heisst: Wer zwischen Gruppe und Haus wechselt, sucht zweimal.
	 *
	 * **Offen ab der Freigabe, nicht erst mit der ersten Eröffnung** — ebenfalls
	 * wie im Haus. Bis hierher war der Schritt gesperrt, solange keine
	 * Versammlung lief; eröffnet wurde aber auf der Seite jedes einzelnen
	 * Hauses. Der Weg führte also an den Ort, den der Auftraggeber gerade nicht mehr
	 * aufsuchen wollte («ohne dass ich in 5 STWEG hin und her springen muss»),
	 * und der Schritt, der das Eröffnen jetzt trägt, sperrte sich selbst aus.
	 */
	const freigegeben = lage.haeuser - lage.imEntwurf;
	s.push({
		kennung: 'einlass',
		titel: 'Anwesenheit und Beschlussfähigkeit',
		beschreibung:
			'Versammlungen eröffnen, Anwesende erfassen — eine Anmeldung für alle Häuser, in ' +
			'denen jemand stimmberechtigt ist.',
		zustand: freigegeben > 0 ? 'offen' : 'gesperrt',
		sperrgrund:
			freigegeben > 0
				? undefined
				: 'Erst wenn mindestens eine Traktandenliste freigegeben ist.',
		pfad: `${w}/einlass`,
		stand:
			lage.laufend > 0
				? `${lage.laufend} von ${lage.haeuser} ${lage.laufend === 1 ? 'läuft' : 'laufen'}`
				: freigegeben > 0
					? 'noch keine eröffnet'
					: undefined
	});

	/*
	 * **Die Vollmachten des Abends** (Auftraggeber, 23.08.2026): «Wie auch Vollmachten
	 * […] muss über die Gruppe gehen.»
	 *
	 * Vor dem Führen: Wer im Saal steht, nimmt zuerst Vollmachten entgegen und
	 * beginnt dann. Und eine erfasste Vollmacht überträgt nichts — solange
	 * welche offen sind, fehlt Stimmkraft.
	 */
	s.push({
		kennung: 'vollmachten',
		titel: 'Vollmachten',
		beschreibung:
			'Alle Gemeinschaften an einer Stelle. Eine Vollmacht gilt je Gemeinschaft — wer in ' +
			'zwei Häusern Eigentümer ist, erteilt zwei.',
		zustand: lage.laufend > 0 ? 'offen' : 'gesperrt',
		sperrgrund:
			lage.laufend > 0 ? undefined : 'Erst wenn mindestens eine Versammlung eröffnet ist.',
		pfad: `${w}/vollmachten`
	});

	/*
	 * **Den Abend führen** (Auftraggeber, 23.08.2026): «Der gemeinsame Abend braucht
	 * eine Steuerungsmaske, die den Einlass regelt und durch die Sitzung führt.
	 * […] Sonst verbringt der Sitzungsleiter [die Zeit] mit ständigem
	 * Hin-und-her-Klicken.»
	 *
	 * Sie steht VOR der Tafel: Wer im Saal steht, führt — und sieht nach. Die
	 * Reihenfolge der Leiste ist die des Abends.
	 */
	s.push({
		kennung: 'fuehren',
		titel: 'Versammlung führen',
		beschreibung:
			'Ein Aufruf für alle Gemeinschaften, die den Punkt führen. Abgestimmt wird in jeder ' +
			'für sich — dort bleibt der Beschluss.',
		zustand: lage.laufend > 0 ? 'offen' : 'gesperrt',
		sperrgrund:
			lage.laufend > 0 ? undefined : 'Erst wenn mindestens eine Versammlung eröffnet ist.',
		pfad: `${w}/leitung`,
		stand: lage.laufend > 0 ? `${lage.laufend} laufend` : undefined
	});

	s.push({
		kennung: 'tafel',
		titel: 'Tafel im Saal',
		/*
		 * **Und von hier führt jede Sitzung** (Auftraggeber, 23.08.2026: «Was ist mit
		 * Tafel im Saal gemeint? Wie kann ich beide gemeinsam führen?»).
		 *
		 * Der Name ist der Fachbegriff des Verbunds — «ein Einlass und eine Tafel
		 * im Saal» — und bleibt. Was fehlte, war der Hinweis, dass dies der
		 * Einstieg in die Leitung ist: Wer beide Gemeinschaften führt, geht
		 * hierher und von hier in die eine oder die andere.
		 */
		beschreibung:
			'Wer gerade tagt, wie viele da sind, wo die Beschlussfähigkeit steht — und von hier ' +
			'in jede Sitzungsleitung.',
		zustand: lage.laufend > 0 ? 'offen' : 'gesperrt',
		sperrgrund: lage.laufend > 0 ? undefined : 'Erst wenn mindestens eine Versammlung eröffnet ist.',
		pfad: `${w}/tafel`,
		stand: lage.laufend > 0 ? `${lage.laufend} laufend` : undefined
	});

	/*
	 * **Das Protokoll des Abends (Story 7.5b).**
	 *
	 * Es steht unter «Danach», wie das Protokoll im Ablauf einer einzelnen
	 * Versammlung — und aus demselben Grund: Es entsteht, wenn getagt ist.
	 *
	 * **Gesperrt, solange nichts geschlossen ist.** Nicht aus Vorsicht, sondern
	 * weil es sonst leer wäre: Unter jedem Punkt stünde «zu diesem Punkt liegt
	 * noch kein Ergebnis vor». Der Sperrgrund sagt das, statt eine leere Seite
	 * anzubieten.
	 *
	 * **Nie «erledigt».** Die Anwendung erfährt nicht, ob das PDF unterzeichnet
	 * wurde — signiert wird ausserhalb (Skribble). Ein Häkchen behauptete einen
	 * Abschluss, den sie nicht kennt.
	 */
	s.push({
		kennung: 'zusammenstellung',
		titel: 'Protokoll des Abends',
		beschreibung:
			'Alle Punkte in der Reihenfolge des Abends, darunter, was jede Gemeinschaft beschlossen hat.',
		zustand: lage.abgeschlossen > 0 ? 'offen' : 'gesperrt',
		sperrgrund:
			lage.abgeschlossen > 0
				? undefined
				: 'Erst wenn mindestens eine Versammlung geschlossen ist — vorher steht unter jedem Punkt «noch kein Ergebnis».',
		pfad: `${w}/protokoll`,
		warnung: lage.protokollluecke ?? undefined,
		stand:
			lage.abgeschlossen > 0
				? `${lage.abgeschlossen} von ${lage.haeuser} abgeschlossen`
				: undefined
	});

	/*
	 * **Versiegeln steht auch am Abend** (Auftraggeber, 25.08.2026: «Warum kann nicht auf
	 * der Stufe Gruppe versiegelt werden?»).
	 *
	 * Es gibt kein gemeinsames Siegel — acht der neun Bestandteile eines
	 * Abschlusspakets gibt es nur je Gemeinschaft; die Begründung steht in
	 * `docs/vererbung-abend.md`. Was fehlte, war der Weg: Wer den Abend
	 * abschloss, musste danach fünfmal in ein Haus wechseln, um dort denselben
	 * Knopf zu suchen.
	 *
	 * Gesperrt, solange keine Versammlung geschlossen ist — versiegelt wird, was
	 * feststeht, und vorher stünde der Schritt als Einladung da, die nichts tut.
	 */
	s.push({
		kennung: 'siegel',
		titel: 'Versiegeln',
		beschreibung:
			'Je Gemeinschaft ein Abschlusspaket, unveränderlich und bezeugt — in einem Zug ausgelöst.',
		zustand: lage.abgeschlossen > 0 ? 'offen' : 'gesperrt',
		sperrgrund:
			lage.abgeschlossen > 0
				? undefined
				: 'Erst wenn eine Versammlung geschlossen ist. Versiegelt wird, was feststeht.',
		pfad: `${w}/siegel`,
		stand:
			lage.abgeschlossen > 0
				? `${lage.abgeschlossen} von ${lage.haeuser} geschlossen`
				: undefined
	});

	return s;
}

/** Dieselben vier Abschnitte wie im einzelnen Ablauf, damit die Leiste sich liest wie dort. */
const ABSCHNITTE: { titel: string; kennungen: string[] }[] = [
	{
		titel: 'Vorbereiten',
		kennungen: [
			'angaben',
			'haeuser',
			...STAMMDATENSCHRITTE.map((t) => t.kennung),
			'geschaefte'
		]
	},
	{ titel: 'Ausgeben', kennungen: ['freigabe', 'ausfall'] },
	/*
	 * **Dieselbe Reihenfolge wie im Haus** (Auftraggeber, 24.08.2026: «Zudem ist die
	 * Reihenfolge der Seitenleiste anders zwischen Einzel- und
	 * Gruppenversammlung»).
	 *
	 * Im Ablauf einer einzelnen Versammlung stehen die **Vollmachten vor der
	 * Anwesenheit**, und das ist kein Geschmack: Eine Vollmacht, die erst nach
	 * dem Einlassen geprüft wird, kommt zu spät — die vertretene Partei gilt
	 * dann bereits als anwesend. Hier stand der Einlass zuerst, und wer zwischen
	 * Gruppe und Haus wechselt, suchte in der Leiste an zwei Orten.
	 *
	 * Die **Tafel** ist der eine Schritt, den es nur am Abend gibt: Im Haus
	 * steht der Beamer als Schaltfläche auf der Anwesenheitsseite.
	 */
	{ titel: 'An der Versammlung', kennungen: ['vollmachten', 'einlass', 'fuehren', 'tafel'] },
	/*
	 * **Versiegeln vor Protokoll, wie im Haus** (Produktentscheid 03.10.2026:
	 * «Ja, mit dem Abendbau angleichen»). Im Ablauf der einzelnen Versammlung
	 * führt «Danach» seit dem Nachzug Auswertung, Siegel, Protokoll — der Versand
	 * ist kein eigener Schritt, sondern steckt im Protokoll und folgt damit dem
	 * Siegel (`vorbereitung.ts`). Hier stand die Zusammenstellung zuerst.
	 *
	 * Beim Haus eines Abends steht der Grund dahinter unmittelbar bevor: Erst
	 * mit dem Siegel dieses Hauses lässt sich dort die Fassung «als versandt»
	 * festhalten (A2).
	 */
	{ titel: 'Danach', kennungen: ['siegel', 'zusammenstellung'] }
];

/**
 * Die Gruppe «Jederzeit» am gemeinsamen Abend (Auftraggeber, 25.08.2026: «Und bei
 * Gruppen fehlt ‹jederzeit› in der Seitenleiste»).
 *
 * Im Haus gibt es sie seit Langem (`components/ablaufleiste.ts`): das fünfte
 * Kapitel, das sagt «unabhängig davon, wann». Am Abend fehlte sie ganz, und
 * damit auch der Weg zum Verlauf — den man gerade dann sucht, wenn etwas
 * unklar ist, und nicht dann, wenn man an der Reihe wäre.
 *
 * **Kein gemeinsames Ausfallblatt** — das bleibt so. Stimmzettel und
 * Unterschriftenliste gibt es je Gemeinschaft, mit deren Traktanden und deren
 * Stimmberechtigten; ein zusammengeworfenes Blatt wäre für keinen Saal das
 * richtige.
 *
 * **Der Weg dorthin steht hier trotzdem** (Auftraggeber, 09.09.2026: «Bei der
 * Gruppenversammlung steht bei ‹jederzeit› nicht die Stimmzettel für den
 * Ausfall»). Bis dahin fehlte er, und die Begründung an dieser Stelle
 * verwechselte zwei Dinge: Dass es kein gemeinsames Blatt gibt, ist ein Grund
 * gegen ein gemeinsames PDF — kein Grund dagegen, den Weg dort anzubieten, wo
 * ihn jeder sucht, der ihn im Haus kennt.
 *
 * **Im Haus steht die Ausfallsicherung an beiden Orten**, und das ist der
 * Massstab: als Schritt in der Vorbereitung («Die Ausfallsicherung zu machen
 * gehört zur Vorbereitung», Auftraggeber 20.08.2026) und unter «Jederzeit». Der Schritt
 * kam damals **dazu**, nicht an die Stelle, mit der Begründung, die in
 * `domain/vorbereitung.ts` steht: «dort findet sie, wer sie sucht, und das ist
 * genau der Fall, der nicht eintritt». Am Abend gab es bisher nur den Schritt.
 *
 * **Nicht gleich, sondern entsprechend**: Unter «Jederzeit» führt das Haus die
 * drei Dateien selbst (`components/ablaufleiste.ts`), weil es je Versammlung
 * genau einen Satz gibt. Am Abend sind es mehrere, deshalb steht hier der Weg
 * auf die Seite, die sie je Haus zusammenführt.
 *
 * Der Verweis führt deshalb auf die Ausfallseite des Abends und nicht auf ein
 * PDF: Sie führt je Haus zusammen, was es je Haus schon gibt.
 */
function jederzeit(tagId: string, ausfall: Schritt | undefined): Schrittgruppe {
	return {
		titel: 'Jederzeit',
		schritte: [
			{
				kennung: 'protokollausgabe',
				titel: 'Protokoll des Abends (PDF)',
				beschreibung: 'Zum Ausdrucken oder Unterzeichnen — entsteht bei jedem Aufruf neu.',
				zustand: 'offen',
				// `.pdf` genügt: `alsPunkt` macht daraus einen Verweis, der in einem
				// eigenen Reiter öffnet — dieselbe Regel wie im Haus.
				pfad: `/tage/${tagId}/protokoll.pdf`
			},
			/*
			 * **Der Verweis trägt die Sperre des Schritts mit** (aus dem
			 * Code-Review). Ein bedingungslos offener Eintrag hätte die Sperre
			 * daneben zur Zierde gemacht: oben ein grauer Punkt mit dem Grund
			 * «erst nach der Freigabe», drei Zeilen tiefer ein Link auf dieselbe
			 * Seite. Er spiegelt deshalb den Schritt, statt seine Bedingung ein
			 * zweites Mal zu rechnen: Was dort gilt, gilt hier, und die beiden
			 * können nicht auseinanderlaufen.
			 *
			 * Die Beschreibung nennt dieselben drei Unterlagen wie der Schritt
			 * und **nicht** die Auszählmappe: Ob sie nötig ist, hängt an der
			 * Abstimmungsweise des einzelnen Hauses, und am Abend stehen mehrere
			 * nebeneinander. Die Karte je Haus sagt es, die Leiste kann es nicht.
			 */
			...(ausfall
				? [
						{
							kennung: 'ausfallwege',
							titel: 'Ausfallsicherung je Haus',
							beschreibung:
								'Traktandenliste, Unterschriftenliste und Stimmzettel: je Gemeinschaft ein ' +
								'eigener Satz. Vor der Versammlung drucken: Wer sie braucht, hat den Server ' +
								'nicht mehr.',
							zustand: ausfall.zustand === 'gesperrt' ? ('gesperrt' as const) : ('offen' as const),
							sperrgrund: ausfall.sperrgrund,
							pfad: `/tage/${tagId}/ausfall`
						}
					]
				: []),
			{
				kennung: 'verlaufdesabends',
				titel: 'Verlauf dieses Abends',
				beschreibung:
					'Jede Handlung des Abends mit Zeitpunkt — über alle Gemeinschaften, die mittagen.',
				zustand: 'offen',
				pfad: `/verlauf?abend=${tagId}`
			}
		]
	};
}

export function gemeinsameGruppen(schritte: Schritt[]): Schrittgruppe[] {
	const vergeben = new Set<string>();
	const gruppen: Schrittgruppe[] = [];

	for (const a of ABSCHNITTE) {
		const dazu = a.kennungen
			.map((k) => schritte.find((s) => s.kennung === k))
			.filter((s): s is Schritt => s !== undefined);
		dazu.forEach((s) => vergeben.add(s.kennung));
		if (dazu.length > 0) gruppen.push({ titel: a.titel, schritte: dazu });
	}

	// Wie im einzelnen Ablauf: Was keinem Abschnitt zugeordnet ist, fällt nicht
	// lautlos heraus, sondern sammelt sich sichtbar am Schluss.
	const uebrige = schritte.filter((s) => !vergeben.has(s.kennung));
	if (uebrige.length > 0) gruppen.push({ titel: 'Weiteres', schritte: uebrige });

	// «Jederzeit» steht zuunterst — wie im Haus, und aus demselben Grund: Die
	// vier Kapitel davor sagen, WANN etwas dran ist; dieses sagt, dass es das
	// nicht tut.
	const tagId = schritte.find((s) => s.pfad?.startsWith('/tage/'))?.pfad?.split('/')[2];
	if (tagId) gruppen.push(jederzeit(tagId, schritte.find((s) => s.kennung === 'ausfall')));

	return gruppen;
}
