/**
 * Ein Traktandum im Saal aufnehmen (FR-44, FR-60).
 *
 * **Warum als eigene Funktion** (24.08.2026): Der Weg stand ausgeschrieben in
 * der Leitung einer einzelnen Versammlung — hundertvierzig Zeilen mit der Art,
 * der Antragstellerschaft, dem Mehrheitserfordernis und dem Satz, der die
 * Abweichung meldet. Geerbt wird das Erfordernis seit dem Produktentscheid
 * 08.10.2026 nicht mehr; der Folgeantrag bekommt es wie ein neu angelegtes
 * Traktandum. Am gemeinsamen Abend fehlte er deshalb ganz, und «Von der
 * Funktionalität her muss es gleich sein wie bei der Einzelversammlung»
 * verlangt ihn dort ebenso.
 *
 * **Der Kern der Sache steht in ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2:**
 * Über ein nicht angekündigtes Geschäft wird nur beschlossen, wenn das
 * Reglement es ausdrücklich gestattet oder die Versammlung als
 * Universalversammlung tagt (Migration 128). Entschieden wird das in
 * `nimmTraktandumAuf` an der Momentaufnahme, nicht hier; die Datenbank weist
 * ein neues Geschäft als Abstimmung ohne vermerkte Ausnahme ab (Migration 127).
 * Bis zum 29.09.2026 erzwang dieser Weg die Kenntnisnahme selbst.
 */
import {
	erfordernisAmHaus,
	holeTraktanden,
	nimmTraktandumAuf,
	setzeGewaehltesErfordernis
} from './traktanden';
import { holeVersammlung } from './versammlungen';
import { trageBetroffeneEin } from './betroffene';
import { holeEinladungsmehrInWorten } from './einladungsmehr';
import { alsBetreiber } from './db';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { erfordernisabweichung } from '$lib/domain/folgeantrag';
import { text } from './formular';
import type { Handelnder } from './audit';
import type { Id } from '$lib/domain/types';

/**
 * Was eine Aufnahme im Saal hinterlässt: den Satz für die Sitzungsleitung und
 * die Kennung dessen, was entstanden ist.
 *
 * **Die Kennung kam am 06.09.2026 dazu.** Die aufgenommene Zeile entsteht auf
 * der Sitzungsleitungssicht weit unterhalb des Bildschirms — gemessen 3157 px
 * bei 1100 px Fensterhöhe. Wer den Knopf drückt, sieht seine Wirkung also
 * nicht und drückt noch einmal; im Prüfdurchgang vom 05.09.2026 entstand so
 * ein zweiter, wortgleicher Folgeantrag. Mit der Kennung kann die Seite
 * hinrollen, statt eine Quittung an den Bildschirmrand zu legen.
 */
export interface Saalaufnahme {
	/**
	 * Die Quittung für die Sitzungsleitung. Die Seite zeigt sie mit `ton="gut"`,
	 * also in der Ecke unten rechts, wo sie nach sechs Sekunden verschwindet.
	 * Fehlt, wenn an ihrer Stelle eine `warnung` steht; welche Sätze das
	 * auslösen, steht bei `warnung`.
	 */
	hinweis?: string;
	/**
	 * Der Text, wenn er einen der unten genannten Handlungssätze enthält. Dann
	 * reist die ganze Rückgabe hier, die Quittung «… ist aufgenommen …» samt dem
	 * Handlungssatz, und `hinweis` fehlt.
	 *
	 * **Welche Sätze das sind.** Zuerst der aus `hinweisOhneMehr`: Ein
	 * Folgeantrag steht ohne Mehr da, weil das gewählte milder ist als das der
	 * Einladung. Seit der Codeprüfung Teil 2 zum Nachtrag (06.10.2026; Auftrag
	 * «votum-hinweise-lesbar», Teil 4) genau die drei Sätze aus dem Auftrag
	 * (`mitHandlung`), nicht jeder Satz mit einer Handlung:
	 *
	 * - «Vor der Abstimmung fehlt noch das Mehrheitserfordernis» samt dem Weg
	 *   dorthin, beim Folgeantrag ohne gewähltes Mehr (geerbt wird seit dem
 *   Produktentscheid 08.10.2026 nichts mehr);
	 * - derselbe Satz beim gewöhnlichen Traktandum zur Abstimmung ohne
	 *   gewähltes Mehr;
	 * - der Satz zu den Betroffenen, wenn sie nicht eingetragen sind. Er hat drei
	 *   Fassungen: ohne jedes Mehr (`betroffeneOhneMehr`), wenn das Mehr keine
	 *   Zustimmung verlangt («Prüfen Sie das Erfordernis …»), und nach einer
	 *   anderen fachlichen Absage («Tragen Sie sie … ein, … bevor abgestimmt
	 *   wird»).
	 *
	 * Alles andere bleibt `hinweis`: die Quittung allein, das übernommene Mehr,
	 * «Als unmittelbar betroffen eingetragen: …». **Zwei Sätze mit einer
	 * Handlung bleiben bewusst `hinweis`** (Codeprüfung Runde 1, G2, Auftrag
	 * Hinweise lesbar, 06.10.2026): «Vor dem Eröffnen bestätigen Sie, dass
	 * niemand widerspricht» bei der Universalversammlung, weil das Eröffnen die
	 * Bestätigung ohnehin verlangt; und der Abweichungssatz aus
	 * `erfordernisabweichung` («Prüfen Sie, ob …»), dessen Feld offen ist. Steht
	 * einer der beiden mit einem der drei Sätze oben zusammen, reist er mit in
	 * `warnung`.
	 *
	 * **Warum auch diese.** Die Codeprüfung fand, dass sie dasselbe Schicksal
	 * hatten wie zuvor der Satz aus `hinweisOhneMehr`: Sie verlangen etwas, bevor
	 * abgestimmt wird, und verschwanden mit der Quittung nach sechs Sekunden.
	 * Der Wortlaut blieb dabei, wie er war; nur das Feld wechselte.
	 *
	 * **Ein eigenes Feld, weil es stehen bleiben muss** (Produktentscheid
	 * 06.10.2026, «Eigenes Feld für Warnungen, das stehen bleibt»). Der Satz aus
	 * `hinweisOhneMehr` lief bis dahin als `hinweis` und verschwand mit der
	 * Quittung nach sechs Sekunden (Codeprüfung M2, 06.10.2026); gelesen hatte
	 * ihn dann niemand, der kurz woanders hinsah. Die Seite zeigt ihn mit
	 * `ton="warnung"`: Er steht über dem Inhalt, bis die Leitung ihn schliesst
	 * oder die nächste Antwort des Servers kommt. Die Leitung einer Versammlung
	 * springt dann nicht zur neuen Zeile, sondern bleibt bei der Warnung.
	 *
	 * Gesetzt ist immer nur eines der beiden Felder, damit derselbe Satz nicht
	 * zweimal dasteht.
	 */
	warnung?: string;
	/** Was aufgenommen wurde — damit die Seite es zeigen kann. */
	traktandumId: Id;
}

/**
 * Die Rückgabe mit dem Text im richtigen Feld: `warnung`, wenn er einen der
 * drei Handlungssätze aus `Saalaufnahme.warnung` enthält, sonst `hinweis`.
 * Nie beide.
 */
function mitHandlung(traktandumId: Id, satz: string, handlung: boolean): Saalaufnahme {
	return handlung ? { traktandumId, warnung: satz } : { traktandumId, hinweis: satz };
}

/**
 * Setzt das Mehr und gibt die Absage an der Untergrenze aus der Einladung
 * zurück (`milder_als_einladung`), statt sie zu werfen; sonst `null`. Jeder
 * andere Fehler geht weiter nach oben.
 */
async function absageUnterDerEinladung(setzen: () => Promise<unknown>): Promise<string | null> {
	try {
		await setzen();
		return null;
	} catch (fehler) {
		if (!(fehler instanceof FachlicherFehler) || fehler.kennung !== 'milder_als_einladung') {
			throw fehler;
		}
		return fehler.message;
	}
}

/**
 * Die Seite, die aufnimmt: die Leitung einer Versammlung oder die des
 * gemeinsamen Abends.
 *
 * **Die Route sagt es, nicht `meeting_day_id`** (Codeprüfung N1, dritte Runde
 * 06.10.2026). Auch die Leitung einer Gemeinschaft, die am Abend tagt, ruft
 * hier auf; ihr Hinweis erscheint auf ihrer eigenen Seite, und dort gibt es
 * «Erfordernis setzen» in der Zeile.
 */
export type Aufnahmeseite = 'versammlung' | 'abend';

/**
 * Wo die Leitung nach der Aufnahme weitermacht, je nach Seite.
 *
 * **Jeder Satz nennt nur, was es auf der Seite gibt, auf der er erscheint**
 * (Codeprüfung N1 und Laienprüfung R2-2, 06.10.2026). Auf der Seite des Abends
 * gibt es «Erfordernis setzen» und «Antrag zurückziehen» nicht: Ein
 * Folgeantrag steht dort nicht in der Liste «Alle Traktanden», sondern als
 * eigener Schritt im Ablauf direkt vor seinem Grundantrag (`abendschritte`),
 * und «Nötige Mehrheit» unter «Jetzt möglich» erscheint erst, wenn schon ein
 * Mehr gesetzt ist (`eingriffe.ts`). Beides steht in der Zeile der Leitung des
 * Hauses, die unter «Es tagen mit» verlinkt ist, auch am Abend. Seit Befund
 * N-1 steht «Erfordernis setzen» ausserdem im Ablauf beim laufenden Schritt
 * ohne Mehr (`mehrSetzen`). «Jetzt
 * möglich» steht auf beiden Seiten nur beim aufgerufenen Traktandum, am Abend
 * beim aufgerufenen Schritt.
 */
interface Saalort {
	seite: Aufnahmeseite;
	/** Der Name der Gemeinschaft, wie ihn «Es tagen mit» nennt. */
	gemeinschaft: string;
}

async function holeSaalort(operatorId: Id, meetingId: Id, seite: Aufnahmeseite): Promise<Saalort> {
	if (seite === 'versammlung') return { seite, gemeinschaft: '' };
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ name: string }[]>`
			SELECT s.name FROM meeting m JOIN stweg s ON s.id = m.stweg_id WHERE m.id = ${meetingId}
		`;
		return { seite, gemeinschaft: z?.name ?? '' };
	});
}

/** Wo eine Handlung in der Zeile des aufgenommenen Antrags steht, als Ortsangabe. */
function inSeinerZeile(ort: Saalort, knopf: string): string {
	return ort.seite === 'abend'
		? `in der Leitung von «${ort.gemeinschaft}» (unter «Es tagen mit») mit «${knopf}» in ` +
				'seiner Zeile'
		: `mit «${knopf}» in seiner Zeile`;
}

/**
 * Der Satz, der sagt, wo das Mehr eines aufgenommenen Antrags gesetzt wird;
 * `was` ist «es» oder «dieses Mehr oder ein strengeres».
 *
 * **Am Abend zwei Wege** (Codeprüfung 10, Runde 5 vom 06.10.2026): Seit Befund
 * N-1 steht beim laufenden Schritt ohne Mehr im Ablauf selbst «Erfordernis
 * setzen» (`tage/[id=kennung]/leitung/+page.svelte`, statt «Abstimmung
 * eröffnen»). Daneben bleibt die Zeile in der Leitung der Gemeinschaft. In
 * zwei Sätzen, damit keiner über 180 Zeichen läuft.
 */
function mehrSetzen(ort: Saalort, was: 'es' | 'dieses Mehr oder ein strengeres'): string {
	if (ort.seite === 'abend') {
		return (
			` Setzen Sie ${was} im Ablauf mit «Erfordernis setzen», sobald er aufgerufen ist. Oder ` +
			`setzen Sie es ${inSeinerZeile(ort, 'Erfordernis setzen')}.`
		);
	}
	return was === 'es'
		? ' Setzen Sie es mit «Erfordernis setzen» in seiner Zeile.'
		: ' Setzen Sie mit «Erfordernis setzen» in seiner Zeile dieses Mehr oder ein strengeres.';
}

/** Wann «Jetzt möglich» am aufgenommenen Antrag erscheint. */
function sobaldAufgerufen(ort: Saalort): string {
	return ort.seite === 'abend' ? 'sobald er im Ablauf aufgerufen ist' : 'sobald er aufgerufen ist';
}

/**
 * Was zu den gewählten Betroffenen gesagt wird, solange kein Mehr steht.
 *
 * **Nach der Laien- und Fachprüfung Runde 3 vom 06.10.2026** (FP3-4, R3-2 b;
 * `quellen/pruefung/zu-pruefen-2026-10-06-votum-einladungsmehr-folgeantrag-runde3.md`);
 * die vierte Prüfung folgt. Ob die Zustimmung nötig ist, ergibt sich aus dem
 * Inhalt (Produktentscheid 06.10.2026, «Nur wenn der Inhalt es verlangt»),
 * und nur ein hergeleitetes Mehr kennt Betroffene (Fachprüfung FP4-8, Runde
 * 4). «dabei» bezieht sich auf den Satz davor, der sagt, wo das Mehr gesetzt
 * wird; steht keiner davor (`nachDemWeg` falsch), heisst es «beim Setzen».
 */
function betroffeneOhneMehr(ort: Saalort, nachDemWeg = true): string {
	return (
		' Verlangt der Inhalt des Folgeantrags die Zustimmung der im Formular ausgewählten ' +
		`Betroffenen, beantworten Sie ${nachDemWeg ? 'dabei ' : 'beim Setzen '}` +
		'die Fragen nach seinem Inhalt. Dann verlangt das Ergebnis sie (Handbuch, Folgeantrag, ' +
		'Punkt 4). Ein von ' +
		'Hand gesetztes Mehr kennt keine Betroffenen. Eintragen lassen sie sich danach unter ' +
		`«Jetzt möglich» bei «Betroffene», ${sobaldAufgerufen(ort)}; gespeichert sind sie noch ` +
		'nicht.'
	);
}

/**
 * Der Hinweis, wenn der Folgeantrag steht, sein Mehr aber an der Untergrenze
 * aus der Einladung abgewiesen wurde.
 *
 * **Nach der Laien- und Fachprüfung Runde 4 vom 06.10.2026**
 * (`quellen/pruefung/zu-pruefen-2026-10-06-votum-einladungsmehr-folgeantrag-runde4.md`,
 * R4-2 a und FP4-1); die fünfte Prüfung folgt. Zuerst, dass er steht, dann der Grund, dann der
 * Ort, dann die Betroffenen, zuletzt der Ausweg. Was nur eine Regel der
 * Anwendung ist, heisst so (Fachprüfung FP3-3). Der Ausweg wie in der Absage
 * (`milderImFolgeantrag`): an eine weitere Versammlung, wenn die
 * Antragstellerin zurückzieht oder die Versammlung verschiebt, festgehalten mit
 * «Antrag zurückziehen» und dem Grund, der sagt, was geschah.
 *
 * Fehlen die Worte aus der Einladung, was nach einer Absage an der Untergrenze
 * nicht vorkommen sollte, bleibt die Absage selbst der Grund.
 */
async function hinweisOhneMehr(
	operatorId: Id,
	t: { id: Id; titel: string },
	ort: Saalort,
	lage: { absage: string; gewaehlt: boolean; mitBetroffenen: boolean }
): Promise<string> {
	const einladung = await holeEinladungsmehrInWorten(operatorId, t.id);
	const setzen = mehrSetzen(ort, 'dieses Mehr oder ein strengeres');
	if (!einladung?.worte || !einladung.grundantrag) {
		return (
			`«${t.titel}» ist als Folgeantrag aufgenommen; nehmen Sie ihn nicht noch einmal auf. ` +
			`Das Mehr ist noch nicht gesetzt: ${lage.absage}` +
			(lage.mitBetroffenen ? betroffeneOhneMehr(ort, false) : '')
		);
	}
	const betroffene = lage.mitBetroffenen ? betroffeneOhneMehr(ort) : '';
	const g = einladung.grundantrag;
	return (
		`«${t.titel}» ist als Folgeantrag zu «${g}» aufgenommen; nehmen Sie ihn nicht noch einmal ` +
		`auf. Das Mehr ist noch nicht gesetzt. Die Einladung nennt für «${g}» ${einladung.worte}. ` +
		'Die Anwendung verlangt dieses Mehr auch für den Folgeantrag, und das ' +
		// Seit dem Produktentscheid 08.10.2026 erbt der Folgeantrag nicht mehr;
		// «übernommen» träfe nur noch Altbestand, der geerbt aufgenommen wurde.
		(lage.gewaehlt ? 'gewählte' : 'vom Grundantrag übernommene') +
		' ist milder.' +
		setzen +
		betroffene +
		' Soll das mildere Mehr gelten, kommt er heute nicht zur Abstimmung, sondern mit voller ' +
		'Frist als eigenes Traktandum in die Einladung zu einer weiteren Versammlung. Das geht, wenn ' +
		'die Antragstellerin ihn zurückzieht oder die Versammlung ihn verschiebt (Ordnungsantrag, ' +
		'einfaches Mehr, per Handzeichen, mit den Zahlen im Votenfeld). Halten Sie das ' +
		`${inSeinerZeile(ort, 'Antrag zurückziehen')} fest. Nennen Sie als Grund, was ` +
		`geschah. Wird «${g}» heute angenommen, kann die weitere Versammlung diesen Beschluss mit dem Folgeantrag nur noch ` +
		'ändern, solange er nicht ausgeführt ist. Ein Nutzungsrecht ändert sie dann nur mit ' +
		'Zustimmung dessen, der es hat. Soll die Versammlung beide zusammen entscheiden, kann sie das ' +
		'ganze Traktandum verschieben.'
	);
}

/**
 * Nimmt auf, was im Saal beantragt wurde.
 *
 * Der Satz gehört hierher und nicht in die Route: Er hängt davon ab, was
 * aufgenommen wurde — Folgeantrag oder neue Sache, mit oder ohne
 * gewähltes Erfordernis, mit oder ohne Abweichung davon. Zwei Fassungen
 * dieses Satzes sagten im selben Fall Verschiedenes.
 */
export async function nimmImSaalAuf(
	handelnder: Handelnder & { operatorId: Id },
	meetingId: Id,
	daten: FormData,
	/** Die aufrufende Seite; nach ihr richten sich die Ortsangaben im Hinweis. */
	seite: Aufnahmeseite
): Promise<Saalaufnahme> {
	const spontanart = text(daten.get('spontanart')) === 'folgeantrag' ? 'folgeantrag' : 'neu';
	// Ob ein neues Geschäft zur Abstimmung darf, entscheidet `nimmTraktandumAuf`
	// an der Momentaufnahme (Migration 127). Ohne Angabe bleibt es die
	// vorsichtigere Antwort, die Kenntnisnahme.
	const art = text(daten.get('art')) === 'abstimmung' ? 'abstimmung' : 'kenntnisnahme';
	// Ohne gewählte Partei gilt die Gemeinschaft als Antragstellerin: Ein
	// Antrag «eines einzelnen Eigentümers» ohne Namen wäre im Protokoll nicht
	// zuzuordnen, und ein erfundener Name wäre schlimmer als keiner.
	/*
	 * **Mehrere Antragsteller, und ihre Namen bleiben aus dem Antragstext**
	 * (21.08.2026).
	 *
	 * Einen Gegenantrag stellen oft mehrere gemeinsam. Gespeichert wird beides
	 * getrennt: die Kennung der ersten Partei als Verknüpfung, die Namen aller
	 * als Satz. Der **Antragstext** bleibt frei davon — nur so lässt er sich
	 * an ein Sprachmodell geben, ohne dass Personendaten mitgehen. Was der
	 * Text nicht enthält, kann auch keine Maskierung übersehen.
	 */
	const antragstellerIds = daten
		.getAll('antragsteller')
		.map((w) => text(w))
		.filter((w) => w.length > 0);
		const versammlung = await holeVersammlung(handelnder.operatorId, meetingId);
		if (!versammlung) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');

		const t = await nimmTraktandumAuf(
			handelnder,
			{
				meetingId: meetingId,
				parentId: spontanart === 'folgeantrag' ? text(daten.get('grundantrag')) || null : null,
				titel: text(daten.get('titel')),
				art,
				antragswortlaut: text(daten.get('antragswortlaut')) || undefined,
				/*
				 * **Einer, mehrere oder die Gemeinschaft** — die Arten gibt es seit
				 * Migration 034, samt eigener Tabelle. Beim im Saal aufgenommenen
				 * Traktandum wurden sie bis zum 21.08.2026 nicht genutzt: Das
				 * Formular kannte nur ein Auswahlfeld mit einem Namen.
				 */
				antragstellerart:
					antragstellerIds.length > 1
						? 'mehrere_eigentuemer'
						: antragstellerIds.length === 1
							? 'eigentuemer'
							: 'gemeinschaft',
				antragstellerId: antragstellerIds.length === 1 ? antragstellerIds[0] : null,
				antragstellerIds: antragstellerIds.length > 1 ? antragstellerIds : [],
				// Die Betroffenen schreibt `nimmTraktandumAuf` nicht; sie kommen
				// unten über den Weg im Saal dazu, samt seinen Schranken (Block A3b).
				betroffeneParteiIds: []
			},
			spontanart
		);
		// Ein gewähltes Erfordernis gleich mit — sonst fehlte es genau dann,
		// wenn am wenigsten Zeit ist, es zu holen.
		const knotenId = text(daten.get('erfordernis'));
		const grundantragId = text(daten.get('grundantrag')) || null;
		const alle = await holeTraktanden(handelnder.operatorId, meetingId);
		const grund = alle.find((x) => x.knoten.id === grundantragId);

		/*
		 * **Hält das Mehr die Untergrenze aus der Einladung nicht, bleibt der
		 * Folgeantrag ohne Erfordernis stehen** (Produktentscheid 06.10.2026,
		 * «Ja, dieselbe Untergrenze»; `achteEinladungsmehr`). Das Setzen läuft
		 * nicht in der Transaktion, die ihn angelegt hat. Ginge die Absage nach
		 * oben, sähe die Leitung eine gescheiterte Aufnahme, und ein zweiter
		 * Klick legte denselben Antrag doppelt an, wie unten bei den
		 * Betroffenen. Das geschah bis 07.10.2026 etwa beim Erben, wenn der
		 * Grundantrag nach einem Rückfall beim Eröffnen noch das mildere Mehr trug;
		 * seit dem Produktentscheid 07.10.2026 («Nur noch aufmerksam machen») gibt
		 * es den Rückfall nicht mehr (`grenzeFuerFolgeantrag`). Gefangen wird
		 * nur diese eine Absage; jede andere geht weiter nach oben wie bisher.
		 */
		let nichtGesetzt: string | null = null;

		if (art === 'abstimmung' && knotenId) {
			nichtGesetzt = await absageUnterDerEinladung(() =>
				setzeGewaehltesErfordernis(
					handelnder,
					{ meetingId, stwegId: versammlung.stwegId },
					t.id,
					knotenId,
					null
				)
			);
		}
		/*
		 * **Der Folgeantrag erbt nicht mehr** (Produktentscheid 08.10.2026):
		 * Bis hierher übernahm er das Erfordernis des Grundantrags, wenn die
		 * Leitung keines gewählt hatte. Damit stand «von Hand gewählt» im
		 * Verlauf, wo niemand gewählt hatte. Jetzt bekommt er die Herleitung wie
		 * ein neu angelegtes Traktandum: gewählt über das Formular (Quelle
		 * «gewählt») oder über den Entscheidbaum unter «Nötige Mehrheit»
		 * (Quelle «hergeleitet»); ohne Wahl steht er ohne Erfordernis da, und
		 * der Hinweis unten sagt, dass vor der Abstimmung eines fehlt.
		 */

		/*
		 * **Die Betroffenen des Folgeantrags** (Block A3b). Das Formular schlägt
		 * die des Grundantrags vor; eingetragen wird, was die Leitung gewählt
		 * hat. Über `trageBetroffeneEin`, den Weg im Saal: Er prüft Zustand,
		 * Stand und Erfordernis und schreibt den Verlauf. Ein zweiter
		 * Schreibweg hätte diese Schranken nicht geerbt.
		 *
		 * **Scheitert das Eintragen fachlich, bleibt der Folgeantrag stehen**,
		 * und der Satz sagt es. Ein anderer Fehler geht weiter nach oben, wie
		 * beim Setzen des Erfordernisses davor; eine gemeinsame Transaktion gibt
		 * es für diesen Weg nicht. Eine fachliche Absage hätte die Leitung
		 * glauben lassen, nichts sei aufgenommen, und ein zweiter Klick legte
		 * denselben Antrag ein zweites Mal an (Prüfdurchgang 05.09.2026).
		 */
		const betroffene =
			spontanart === 'folgeantrag' && art === 'abstimmung'
				? daten
						.getAll('betroffene')
						.map((w) => text(w))
						.filter((w) => w.length > 0)
				: [];
		const ort = await holeSaalort(handelnder.operatorId, meetingId, seite);
		let betroffenensatz = '';
		// Jeder Satz aus dem Zweig mit der Absage unten verlangt eine Handlung
		// vor der Abstimmung; «eingetragen: …» nicht (`Saalaufnahme.warnung`).
		let betroffeneOffen = false;
		// Ohne gesetztes Mehr trüge `trageBetroffeneEin` nichts ein; der Hinweis
		// unten sagt dann, dass die Betroffenen danach einzutragen sind.
		if (betroffene.length > 0 && nichtGesetzt === null) {
			try {
				const namen = await trageBetroffeneEin(handelnder, meetingId, t.id, betroffene);
				betroffenensatz = ` Als unmittelbar betroffen eingetragen: ${namen.join(', ')}.`;
			} catch (fehler) {
				if (!(fehler instanceof FachlicherFehler)) throw fehler;
				// Verlangt das gewählte Erfordernis keine Zustimmung, gibt es
				// «Betroffene» am Folgeantrag nicht; der Weg dorthin wäre keiner.
				// Ohne jedes Erfordernis sagt `trageBetroffeneEin` dasselbe; dann wäre
				// «verlangt keine Zustimmung» ein Satz über etwas, das es nicht gibt.
				const hatErfordernis = Boolean(knotenId);
				betroffeneOffen = true;
				// Die Orte je Seite (`Saalort`, Codeprüfung N1 vom 06.10.2026): Am Abend
				// gibt es «Erfordernis setzen» nur in der Leitung des Hauses, und «Jetzt
				// möglich» auf beiden Seiten erst am aufgerufenen Antrag.
				//
				// **Ohne jedes Mehr nur der Satz zu den Betroffenen** (Codeprüfung M1,
				// dritte Runde): Den Weg zum Mehr nennt schon der Satz davor
				// («Vor der Abstimmung fehlt noch …»); zweimal stand er sonst da.
				//
				// **Die nützliche bauliche Massnahme gehört dazu** (Fachprüfung FP3-5,
				// Laienprüfung R3-2 c, ZGB Art. 647d Abs. 2 und 3). Seit Runde 4 in
				// drei Sätzen, damit keiner über 180 Zeichen läuft (Codeprüfung N1).
				betroffenensatz =
					fehler.kennung === 'ohne_betroffene' && !hatErfordernis
						? betroffeneOhneMehr(ort)
						: fehler.kennung === 'ohne_betroffene'
						? ' Die gewählten Betroffenen sind nicht eingetragen: Das Mehrheitserfordernis ' +
							'des Folgeantrags verlangt keine Zustimmung von Betroffenen. Prüfen Sie das ' +
							'Erfordernis, wenn der Folgeantrag ein Nutzungsrecht oder die Wertquoten ' +
							'ändert. Ebenso, wenn er eine nützliche bauliche Massnahme ist, die jemandem ' +
							'den Gebrauch erheblich und dauernd erschwert oder unwirtschaftlich macht oder ' +
							'ihm unzumutbare Kosten auferlegt. Das geht unter «Jetzt möglich» bei «Nötige ' +
							'Mehrheit»; danach tragen Sie die Betroffenen bei «Betroffene» ein, ' +
							`${sobaldAufgerufen(ort)}.`
						: ` Die Betroffenen sind nicht eingetragen: ${fehler.message} Tragen Sie sie ` +
							`unter «Jetzt möglich» bei «Betroffene» ein, ${sobaldAufgerufen(ort)}, und ` +
							'bevor abgestimmt wird.';
			}
		}

		if (spontanart === 'folgeantrag') {
			/*
			 * **Weicht das gewählte Mehr von dem des Grundantrags ab, wird es
			 * gesagt** (FR-43). Beide Richtungen: Ein strengeres heisst, der
			 * Folgeantrag erweitert den Gegenstand. Ein schwächeres ist der
			 * riskante Fall — so liesse sich eine qualifiziert zu beschliessende
			 * Sache in einen «kleinen» Folgeantrag teilen und mit einfachem
			 * Mehr entscheiden.
			 */
			// Mit dem Mehr am Haus, nicht dem des Knotens: Der Grundantrag trägt
			// seines mit Regel und Lesart, also auch der Vergleich (Rest aus
			// Lesarten Block 1, Befund 7).
			// Nur bei einer Abstimmung mit gewähltem Mehr; eine unbekannte Kennung
			// wirft hier nicht mehr nach dem Anlegen, sie vergleicht nichts, wie zuvor
			// `.find` (Codeprüfung Block 2, Teil 2, N6).
			const gewaehlt =
				knotenId && art === 'abstimmung'
					? await erfordernisAmHaus(
							handelnder.operatorId,
							{ meetingId, stwegId: versammlung.stwegId },
							knotenId
						).catch((f: unknown) => {
							if (f instanceof FachlicherFehler) return null;
							throw f;
						})
					: null;
			const abweichung = erfordernisabweichung(
				grund?.knoten.erfordernis?.typ ?? null,
				gewaehlt?.typ ?? null
			);

			if (art === 'abstimmung' && nichtGesetzt !== null) {
				return {
					traktandumId: t.id,
					warnung: await hinweisOhneMehr(handelnder.operatorId, t, ort, {
						absage: nichtGesetzt,
						gewaehlt: Boolean(knotenId),
						mitBetroffenen: betroffene.length > 0
					})
				};
			}

			// Ohne gewähltes Mehr folgt unten «Vor der Abstimmung fehlt noch …»;
			// mit offenen Betroffenen der Satz dazu. Geerbt wird seit dem
			// Produktentscheid 08.10.2026 nichts mehr.
			const mehrFehlt = art === 'abstimmung' && !knotenId;
			return mitHandlung(
				t.id,
				art !== 'abstimmung'
						? `«${t.titel}» ist als Folgeantrag zur Kenntnisnahme aufgenommen.`
						: // «Traktandum» statt «Antrag» (Fachprüfung 06.10.2026, Bestandsnotiz
							// zu F2): Angekündigt ist das Traktandum, nicht jeder Antrag darin.
							`«${t.titel}» ist als Folgeantrag aufgenommen. Er stützt sich auf das ` +
							'angekündigte Traktandum, unter dem er steht.' +
							// Der Satz muss stimmen: Wer das Erfordernis eben gewählt hat,
							// darf nicht nach etwas suchen, das schon dasteht.
							(knotenId
								? ''
								: ' Vor der Abstimmung fehlt noch das Mehrheitserfordernis.' +
									mehrSetzen(ort, 'es')) +
							(abweichung.text ? ` ${abweichung.text.replaceAll('**', '')}` : '') +
							betroffenensatz,
				mehrFehlt || betroffeneOffen
			);
		}
		return mitHandlung(
			t.id,
			art === 'abstimmung'
					? `«${t.titel}» ist zur Abstimmung aufgenommen, ` +
						(t.ausnahme === 'universal'
							? 'als Universalversammlung. Vor dem Eröffnen bestätigen Sie, dass niemand widerspricht.'
							: 'gestützt auf das Reglement.') +
						(knotenId
							? ''
							: ' Vor der Abstimmung fehlt noch das Mehrheitserfordernis. Setzen Sie es mit ' +
								'«Erfordernis setzen» am Traktandum.')
					: `«${t.titel}» ist zur Kenntnisnahme aufgenommen.`,
			// Ohne gewähltes Mehr endet der Satz mit «Vor der Abstimmung fehlt noch …».
			art === 'abstimmung' && !knotenId
		);

		/**
		 * Einen Rückzug zurücknehmen (21.08.2026).
		 *
		 * Warum das rechtlich geht, steht bei `verlangeRuecknehmbar`: Der Rückzug ist
		 * eine Erklärung, kein Beschluss — und der Gegenstand war angekündigt.
		 */
}
