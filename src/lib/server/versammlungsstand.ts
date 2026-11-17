import { nurNachWertquoten } from '$lib/domain/mehrheit';
import { KONSULTATIV_OFFEN, KONSULTATIV_OFFEN_NEU } from '$lib/domain/konsultativ';
/**
 * Der Stand einer Versammlung, wie ihn der Ereignisstrom trägt (AD-11).
 *
 * An genau einer Stelle zusammengestellt: Jede Änderung an der Anwesenheit ruft
 * `verkuendeStand`, und die Präsentationssicht, die Steuerungssicht und das
 * Telefon des Eigentümers lesen dasselbe. Stellte jede Sicht ihren Stand selbst
 * zusammen, zeigte der Beamer eine andere Zahl als das Rednerpult.
 */
import { stelleBeschlussfaehigkeitFest } from '$lib/domain/beschlussfaehigkeit';
import { ergebnisInWorten, ergebnislage } from '$lib/domain/auszaehlung';
import {
	grundOhneBeschluss,
	ohneAnnahmeNachQuorum,
	ohneAnnahmeNachQuorumNach,
	ohneBeschlussNachRueckkommen,
	rueckkommenOhneBeschlussNach
} from '$lib/domain/rueckkommen';
import { keinBeschlussKurz } from '$lib/domain/ausnahmen';
import { holeFeststellungen } from './beschlussfaehigkeit';
import { holeUebersicht } from './anwesenheit';
import { holeOffeneSaalmeldungen } from './saaleinstieg';
import { holeAnwesenheitsregeln } from './reglement';
import { holeVersammlung } from './versammlungen';
import { zaehleVetozeilen } from './veto';
import { holeDurchgaenge, holeErgebnis, holeFortschritt, zaehleStimmzeilen,
	holeMehrheitsvorschau
} from './abstimmung';
import { holeTraktanden } from './traktanden';
import { ersetzungslage } from './auswertung';
import { massgebenderDerSache } from '$lib/domain/abstimmung';
import { ersetzungInKuerze } from '$lib/domain/folgeantragsersetzung';
import { sende, type Abstimmungsstand, type Stromnachricht } from './ereignisstrom';
import type { Versammlung } from '$lib/domain/versammlung';
import type { Id } from '$lib/domain/types';

/**
 * Der Abstimmungsstand für den Strom.
 *
 * Massgebend ist der offene Durchgang, wenn einer offen ist — eine laufende
 * Abstimmung geht allem vor, und der Gegenstand einer offenen Abstimmung darf
 * sich nicht ändern, nur weil daneben ein anderes Traktandum aufgerufen wird.
 *
 * Sonst der zuletzt geschlossene Durchgang **des aufgerufenen Traktandums**. So
 * bleibt das Ergebnis nach dem Schliessen stehen, statt dass die Leinwand leer
 * wird — und es verschwindet, sobald das nächste Geschäft aufgerufen ist.
 *
 * **Warum die Einschränkung auf das aufgerufene Traktandum.** Sie fehlte, und
 * damit war der zuletzt geschlossene Durchgang der ganzen Versammlung
 * massgebend. Die Leinwand zeigte das verkündete Ergebnis dann bis ans Ende des
 * Abends: Ein neu aufgerufenes Traktandum kam nie zur Anzeige, weil die
 * Saalsicht das Ergebnis vor dem Traktandum prüft. Gemeldet am 02.08.2026:
 * «Wenn ich bei Alle Traktanden ein Traktandum aufrufe, geschieht am Monitor
 * nichts.»
 *
 * Das Ergebnis wird nur mitgegeben, wenn es freigegeben ist — oder wenn alle
 * gestimmt haben. Was nicht gesendet wird, kann keine Sicht anzeigen; das ist
 * hier die ganze Umsetzung von FR-40.
 */
async function abstimmungsstand(
	operatorId: Id,
	meetingId: Id,
	aufgerufenesTraktandumId: Id | null,
	/** Einmal geholt in `ermittleStand`, das sie auch für den Rückzug braucht. */
	traktanden: Awaited<ReturnType<typeof holeTraktanden>>
): Promise<Abstimmungsstand | null> {
	const alleDurchgaenge = await holeDurchgaenge(operatorId, meetingId);
	const durchgaenge = alleDurchgaenge.filter((d) => !d.ueberholtAm);
	if (durchgaenge.length === 0) return null;

	const offen = durchgaenge.find((d) => d.zustand === 'offen');
	const zumTraktandum = aufgerufenesTraktandumId
		? durchgaenge.filter((d) => d.traktandumId === aufgerufenesTraktandumId)
		: [];
	/*
	 * **Der Folgeantrag ohne Beschluss nach dem Rückkommen** (Plan Folgeantrag
	 * nach Rückkommen, Soll 6). Sein Durchgang ist dann überholt, und am
	 * aufgerufenen Folgeantrag gäbe es nichts zu zeigen, obwohl der Saal eben
	 * abgestimmt hat. Die Wand zeigt dann, was gilt: den Beschluss des
	 * Grundantrags, mit dem Satz dazu.
	 */
	const ersetzungAmAufgerufenen =
		!offen && zumTraktandum.length === 0 && aufgerufenesTraktandumId
			? await ersetzungslage(operatorId, meetingId, aufgerufenesTraktandumId, alleDurchgaenge, traktanden)
			: null;
	const stattDessen =
		ersetzungAmAufgerufenen?.rolle === 'folgeantrag' &&
		ersetzungAmAufgerufenen.ausgang === 'ohne_beschluss'
			? massgebenderDerSache(alleDurchgaenge, ersetzungAmAufgerufenen.grundantragId ?? '')
			: null;
	const massgebend = offen ?? zumTraktandum[zumTraktandum.length - 1] ?? stattDessen;
	if (!massgebend) return null;

	const t = traktanden.find((x) => x.knoten.id === massgebend.traktandumId);
	const fortschritt = await holeFortschritt(operatorId, meetingId, massgebend.id);

	/*
	 * **Einmal geholt, zweimal gelesen.** Die Vorschau kostet eine Auszählung
	 * ohne Stimmen; ein erster Anlauf rief sie für `noetig` und `ausstandsgrund`
	 * getrennt auf, und dieser Stand entsteht bei jedem Ereignis neu.
	 */
	const vorschau = await holeMehrheitsvorschau(
		operatorId,
		meetingId,
		massgebend.traktandumId,
		massgebend.erfordernis ?? null
	);

	const stand: Abstimmungsstand = {
		durchgangId: massgebend.id,
		traktandumId: massgebend.traktandumId,
		nummer: massgebend.nummer,
		titel: t ? `${t.nummer} ${t.knoten.titel}` : '',
		frage: t?.knoten.antragswortlaut ?? '',
		// Konsultativ ohne Erfordernis und ohne «nötig» (Migration 158): Gegen
		// die Schwelle wird nichts entschieden.
		erfordernis: massgebend.konsultativ ? '' : (massgebend.erfordernis?.titel ?? ''),
		// Geheim (Migration 141): Die Sicht sagt es beim Eröffnen an; die Zahlen
		// kommen beim Ergebnis gar nicht erst mit.
		geheim: massgebend.geheim,
		konsultativ: massgebend.konsultativ,
		konsultativSatz: !massgebend.konsultativ
			? ''
			: massgebend.konsultativNeu
				? KONSULTATIV_OFFEN_NEU
				: KONSULTATIV_OFFEN,
		// Dieselbe Rechnung wie beim Auszählen, nur ohne Stimmen — sonst nennt die
		// Wand vorher eine andere Zahl als das Protokoll nachher.
		noetig: massgebend.konsultativ ? '' : (vorschau?.satz ?? ''),
		ausstandsgrund: vorschau?.ausstandshinweis ?? null,
		zustand: massgebend.zustand,
		abgegeben: fortschritt.abgegeben,
		stimmberechtigt: fortschritt.stimmberechtigt,
		/*
		 * **Wie viele Stimmzeilen es gibt** — nicht, wie viele Parteien gestimmt
		 * haben.
		 *
		 * Gemeldet am 21.08.2026: «Das automatische Laden bei der Leitungsansicht
		 * geschieht noch nicht, wenn ein Eigentümer abgestimmt hat, bzw. die
		 * Stimme geändert hat.» Für die Änderung ist der Grund hier: Eine
		 * Berichtigung erzeugt eine neue Zeile (AD-5), lässt aber `abgegeben`
		 * unverändert — die Zahl der Parteien bleibt dieselbe. Wer nur darauf
		 * schaut, sieht eine Berichtigung nie.
		 *
		 * Eine blosse Zahl, wie alles in diesem Strom: keine Namen, keine
		 * Verteilung (AD-11).
		 *
		 * **Die Veto-Zeilen zählen mit** (Code-Review 26.09.2026, N1). Ein
		 * Veto am Telefon ändert weder `abgegeben` noch eine Stimmzeile; ohne
		 * sie sah die Leitung unter «Veto» weiter «noch kein Entscheid». Die
		 * Zahl bleibt ein blosses Signal «etwas ist dazugekommen».
		 */
		zeilen:
			(await zaehleStimmzeilen(operatorId, massgebend.id)) +
			(await zaehleVetozeilen(operatorId, massgebend.id)),
		ergebnis: null,
		wartesatz: null
	};

	/*
	 * **Geschlossen heisst sichtbar** (Produktentscheid 21.08.2026).
	 *
	 * Vorher hing es zusätzlich an der Verkündung — es sei denn, alle hatten
	 * abgestimmt, dann erschien es auch ohne. Diese zweite Bedingung war der
	 * Grund für einen Knopf, der bei vollzähliger Abstimmung nichts tat und
	 * daneben behauptete, ohne ihn erscheine nichts. Seit das Schliessen selbst
	 * verkündet, entscheidet nur noch der Zustand — und ältere Durchgänge, die
	 * ohne Verkündung geschlossen wurden, hängen nicht in der Schwebe.
	 *
	 * **Ein offener Gleichstand bleibt verborgen.** Es gibt ihn beim
	 * Verwalter-Stichentscheid, dessen Entscheid noch aussteht, und beim
	 * Quotenstichentscheid über einer Handzählung: Die Auszählung wüsste kein
	 * Ergebnis, und «abgelehnt» an der Wand wäre für einen Antrag, den niemand
	 * entschieden oder gerechnet hat, schlicht falsch. Dort löst ihn der
	 * Eintrag, hier die Neuabstimmung mit Einzelerfassung.
	 */
	if (massgebend.zustand !== 'geschlossen') return stand;

	const e = await holeErgebnis(operatorId, meetingId, massgebend.id);
	if (!e.auszaehlung || !massgebend.erfordernis) return stand;
	if (e.auszaehlung.stichentscheidOffen) {
		// Was aussteht, gehört an die Wand, nicht ein Ergebnis (B4).
		stand.wartesatz = ergebnisInWorten(e.auszaehlung, massgebend.erfordernis);
		return stand;
	}

	// Von Hand festgehalten: Gegen kein Erfordernis wurde gerechnet, also geht
	// auch keines in den Strom, weder das des Traktandums noch der Platzhalter
	// (`ERFORDERNIS_VON_HAND`). Gezeichnet werden die beiden Felder nur bei
	// offener Abstimmung; in der Nutzlast stünden sie trotzdem.
	if (e.auszaehlung.vonHand) {
		stand.erfordernis = '';
		stand.noetig = '';
	}

	/*
	 * **Geheim heisst blind, nicht leer.** Der Strom geht auch an die Telefone im
	 * Saal; bei einer geheimen Abstimmung trägt er die Zahlen deshalb gar nicht
	 * erst (Produktentscheid 28.09.2026). Die Spiegel werden auf Nullen gestellt
	 * und nie gezeichnet (`geheim`); so bleibt die Nutzlast an einer Stelle
	 * dieselbe und keine Sicht kann versehentlich rechnen.
	 */
	const geheim = e.auszaehlung.geheim === true;
	const blind = { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, basis: 0, schwelle: null };
	stand.ergebnis = {
		angenommen: e.auszaehlung.angenommen,
		keinBeschluss: e.auszaehlung.keinBeschluss ? keinBeschlussKurz(e.auszaehlung.keinBeschluss) : null,
		// Der Kopfspiegel: keine Schwelle, keine Bezugsgrösse (Block 2).
		ohneSchwelle: e.auszaehlung.vonHand != null,
		/*
		 * Konsultativ: Wand und Kachel zeigen die Zahlen ohne «nötig», wie
		 * Protokoll und Auswertung (Migration 158; Codeprüfung 14.10.2026, M3).
		 * Ein Merkmal statt einer genullten Schwelle: Die Wand blendet die
		 * Wertquoten-Zeile ganz aus, wo die Schwelle fehlt (zweite Codeprüfung,
		 * Befund 6).
		 */
		ohneNoetig: e.auszaehlung.keinBeschluss?.grund === 'konsultativ',
		koepfeAlsAuskunft: nurNachWertquoten(massgebend.erfordernis),
		geheim,
		koepfe: geheim
			? blind
			: {
					ja: e.auszaehlung.koepfe.ja,
					nein: e.auszaehlung.koepfe.nein,
					enthaltung: e.auszaehlung.koepfe.enthaltung,
					ohneAbgabe: e.auszaehlung.koepfe.ohneAbgabe,
					basis: e.auszaehlung.koepfe.basis,
					schwelle: e.auszaehlung.koepfe.schwelle
				},
		quoten: geheim
			? blind
			: {
					ja: e.auszaehlung.quoten.ja,
					nein: e.auszaehlung.quoten.nein,
					enthaltung: e.auszaehlung.quoten.enthaltung,
					ohneAbgabe: e.auszaehlung.quoten.ohneAbgabe,
					basis: e.auszaehlung.quoten.basis,
					schwelle: e.auszaehlung.quoten.schwelle
				},
		satz: ergebnisInWorten(e.auszaehlung, massgebend.erfordernis),
		nachRueckkommen: await (async () => {
			// Nach einem Rückkommen über einen Folgeantrag (Soll 6): am Folgeantrag,
			// woran er ersetzt oder dass es ohne Beschluss beim alten bleibt.
			if (ersetzungAmAufgerufenen) return ersetzungInKuerze(ersetzungAmAufgerufenen);
			// Der Satz zum Rückkommen an diesem Traktandum selbst hat Vorrang
			// (Codeprüfung B2b, M1); sonst der über einen Folgeantrag.
			const selbst = rueckkommenOhneBeschlussNach(
				alleDurchgaenge.filter((d) => d.traktandumId === massgebend.traktandumId),
				massgebend
			);
			const ers = selbst
				? null
				: await ersetzungslage(operatorId, meetingId, massgebend.traktandumId, alleDurchgaenge, traktanden);
			if (ers) return ersetzungInKuerze(ers);
			// Punkt 1 der Reste vom 30.09.2026: Nach einem Rückkommen ohne Beschluss
			// ist der frühere massgebend, und ohne diesen Satz läse sich sein
			// Ergebnis wie das des eben geschlossenen Durchgangs.
			const ohne = rueckkommenOhneBeschlussNach(
				alleDurchgaenge.filter((d) => d.traktandumId === massgebend.traktandumId),
				massgebend
			);
			if (ohne) {
				return ohneBeschlussNachRueckkommen(
					ohne.nummer,
					massgebend.nummer,
					ergebnislage(e.auszaehlung) === 'abgelehnt',
					grundOhneBeschluss((await holeErgebnis(operatorId, meetingId, ohne.id)).auszaehlung)
				);
			}
			// Dasselbe nach Eintritt der Beschlussfähigkeit (Migration 139):
			// Der gescheiterte zweite Durchgang ist überholt, der frühere gilt.
			const ohneQuorum = ohneAnnahmeNachQuorumNach(
				alleDurchgaenge.filter((d) => d.traktandumId === massgebend.traktandumId),
				massgebend
			);
			return ohneQuorum
				? ohneAnnahmeNachQuorum(
						ohneQuorum.nummer,
						massgebend.nummer,
						ergebnislage((await holeErgebnis(operatorId, meetingId, ohneQuorum.id)).auszaehlung),
						ergebnislage(e.auszaehlung) === 'abgelehnt'
					)
				: null;
		})()
	};
	return stand;
}

/**
 * Art und Änderungszeitpunkt des Wandbildes als eine Zeichenkette.
 *
 * Zwei Angaben in einem Feld, weil die Saalsicht nur eine Frage hat: Hat sich
 * etwas geändert? Der Wortlaut fehlt hier bewusst — er ist Inhalt und gehört
 * nicht in den Strom (AD-11).
 */
function wandbildmarke(v: Versammlung): string {
	const w = v.wandbild;
	return `${w?.art ?? 'traktanden'}@${w?.geaendertAm ?? ''}`;
}

export async function ermittleStand(
	operatorId: Id,
	meetingId: Id
): Promise<Stromnachricht | null> {
	const versammlung = await holeVersammlung(operatorId, meetingId);
	if (!versammlung) return null;

	const [uebersicht, regeln, feststellungen, traktanden] = await Promise.all([
		holeUebersicht(operatorId, meetingId),
		holeAnwesenheitsregeln(operatorId, versammlung.stwegId),
		holeFeststellungen(operatorId, meetingId),
		holeTraktanden(operatorId, meetingId)
	]);
	const zurueckgezogenAm =
		traktanden.find((t) => t.knoten.id === versammlung.aktuellesTraktandumId)?.knoten.rueckzug?.am ?? null;
	/*
	 * **Die Marke der letzten Feststellung** (Auftraggeber, 25.08.2026): «Wenn
	 * Beschlussfähigkeit festgehalten wird, also mit dem Button auf
	 * Sitzungsleitung, soll dies an der Sitzung entsprechend am Monitor angezeigt
	 * werden.»
	 *
	 * Nur der Zeitpunkt — der Befund selbst ist ein Satz mit Namen und Gründen
	 * und geht über den Ladeweg (AD-11). Die Wand erkennt an der geänderten
	 * Marke, dass sie nachladen muss; dasselbe Muster wie bei Pause und
	 * Wandbild.
	 */
	const festgestelltAm = feststellungen.at(-1)?.zeitpunkt?.toISOString() ?? null;

	if (!uebersicht) {
		// Vor der Freigabe gibt es keinen Stimmberechtigtenstand — und damit
		// nichts zu zählen. Nullen statt einer Ausrede: Die Anzeige soll sagen,
		// dass es hier noch nichts gibt.
		return {
			zustand: versammlung.zustand,
			anzahlAnwesend: 0,
			anzahlGesamt: 0,
			kopfstimmenAnwesend: 0,
			kopfstimmenGesamt: 0,
			quotenAnwesend: 0,
			gesamtquote: 0,
			beschlussfaehig: false,
			// Vor der Freigabe gibt es keine Momentaufnahme und damit keine
			// Schwellen — eine leere Liste statt erfundener Nullen.
			bedingungen: [],
			wartend: 0,
			saalmeldungen: 0,
			aktuellesTraktandumId: versammlung.aktuellesTraktandumId ?? null,
			aufgerufenSeit: versammlung.aufgerufenSeit ?? null,
			zurueckgezogenAm,
			festgestelltAm,
			wandbild: wandbildmarke(versammlung),
			pause: versammlung.pause?.seit ?? null,
			abstimmung: null
		};
	}

	const b = stelleBeschlussfaehigkeitFest(
		versammlung.stufe,
		{
			eigentuemerGesamt: uebersicht.eigentuemerGesamt,
			eigentuemerAnwesend: uebersicht.eigentuemerAnwesend,
			kopfstimmenGesamt: uebersicht.kopfstimmenGesamt,
			kopfstimmenAnwesend: uebersicht.kopfstimmenAnwesend,
			gesamtquote: uebersicht.gesamtquote,
			quotenAnwesend: uebersicht.quotenAnwesend,
			einzigeParteiGemeinsam: uebersicht.einzigeParteiGemeinsam
		},
		regeln[versammlung.stufe] ?? null
	);

	return {
		zustand: versammlung.zustand,
		anzahlAnwesend: uebersicht.anzahlAnwesend,
		anzahlGesamt: uebersicht.anzahlGesamt,
		kopfstimmenAnwesend: uebersicht.kopfstimmenAnwesend,
		kopfstimmenGesamt: uebersicht.kopfstimmenGesamt,
		quotenAnwesend: uebersicht.quotenAnwesend,
		gesamtquote: uebersicht.gesamtquote,
		beschlussfaehig: b.beschlussfaehig,
		bedingungen: b.bedingungen,
		wartend: uebersicht.wartendeParteiIds.length,
		saalmeldungen: (await holeOffeneSaalmeldungen(operatorId, meetingId)).length,
		aktuellesTraktandumId: versammlung.aktuellesTraktandumId ?? null,
		aufgerufenSeit: versammlung.aufgerufenSeit ?? null,
		zurueckgezogenAm,
		festgestelltAm,
		wandbild: wandbildmarke(versammlung),
		pause: versammlung.pause?.seit ?? null,
		abstimmung: await abstimmungsstand(
			operatorId,
			meetingId,
			versammlung.aktuellesTraktandumId ?? null,
			traktanden
		)
	};
}

/** Ermittelt den Stand und schickt ihn an alle Beobachter. */
export async function verkuendeStand(operatorId: Id, meetingId: Id): Promise<void> {
	const stand = await ermittleStand(operatorId, meetingId);
	if (stand) sende(meetingId, stand);
}
