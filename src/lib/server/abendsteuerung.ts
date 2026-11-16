/**
 * Die Sitzung eines gemeinsamen Abends führen — von einer Stelle aus.
 *
 * **Der Auftrag** (Auftraggeber, 23.08.2026): «Der gemeinsame Abend braucht eine
 * Steuerungsmaske, die den Einlass regelt und durch die Sitzung führt. […] Was
 * abgestimmt wird, gehört jeweils zu der jeweiligen STWEG oder MEG. Die
 * Eigentümer stimmen in ihrer STWEG oder MEG ab, und im gemeinsamen Abend
 * kommt das zusammen. Ziel wirklich: eine Steuerung, ein Monitor, ein
 * Protokoll, aber alles gespeichert in den jeweiligen STWEG/MEG. Sonst
 * verbringt der Sitzungsleiter [die Zeit] mit ständigem Hin-und-her-Klicken.»
 *
 * **Was hier NICHT passiert: zusammenlegen.** Es entsteht kein Traktandum des
 * Abends, kein Durchgang des Abends, kein Beschluss des Abends. Jede
 * Gemeinschaft behält ihr eigenes `agenda_item`, ihren eigenen `voting_round`,
 * ihre eigene Auszählung — sonst liesse sich später nicht mehr sagen, wer was
 * beschlossen hat, und genau das ist im Anfechtungsfall die Frage.
 *
 * Zusammengelegt wird allein die **Bedienung**: Ein Klick ruft denselben Punkt
 * in jedem beteiligten Haus auf. Die Funktionen darunter sind unverändert die
 * der einzelnen Versammlung.
 *
 * **Ein Haus, das nicht mitkann, hält die anderen nicht auf.** Am Abend sind
 * die Häuser verschieden weit — eines ist eröffnet, das andere noch nicht.
 * Deshalb sammelt jede Handlung, was gelang und was nicht, statt beim ersten
 * Widerstand abzubrechen. Wer im Saal steht, braucht die Punkte, die gehen,
 * und den Satz zu denen, die nicht gehen.
 */
import type { Hausbefund, Hausversiegelung, Versammlungsstufe } from '$lib/domain/beschlussfaehigkeit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	angehaengteAntraege,
	aufrufreihenfolge,
	zielDesAntrags,
	gemeinsameListe,
	type Abendantrag,
	type Listenzeile
} from '$lib/domain/gemeinsameliste';
import { holeGemeinsameListe } from './geschaeft';
import { holeTraktanden } from './traktanden';
import { halteBeschlussfaehigkeitFest } from './beschlussfaehigkeit';
import { holeAbendhaeuser } from './uebersicht';
import { versiegle } from './siegel';
import { holeZeitstempel } from './zeitstempel';
import { brecheAbstimmungAb, holeOffenen, oeffneAbstimmung, schliesseAbstimmung } from './abstimmung';
import { holeVersammlung, stelleAufTraktandum, vertageVersammlung } from './versammlungen';
import { erstelleVersammlungstag, holeVersammlungstag, nimmInTagAuf } from './versammlungstag';
import { folgestufenSatz, geltendeZweitfrist, tageSpaeter } from '$lib/domain/versammlung';
import { laengsteZweitfrist } from './reglement';
import { verkuendeStand } from './versammlungsstand';
import type { Handelnder } from './audit';
import type { Id } from '$lib/domain/types';

/** Was eine Handlung über alle Häuser eines Punktes bewirkt hat. */
export interface Sammelergebnis {
	/** Wie viele Häuser die Handlung ausgeführt haben. */
	gelungen: number;
	/**
	 * Häuser, bei denen sie nicht ging — mit dem Grund im Klartext.
	 *
	 * Kein Fehler, sondern ein Befund: Am Abend sind die Häuser verschieden
	 * weit, und das ist der Normalfall, nicht die Ausnahme.
	 */
	offen: { gemeinschaft: string; grund: string }[];
}

/**
 * Was in EINEM Haus festgestellt wurde.
 *
 * **Warum das Ergebnis mitkommt und nicht nur die Zahl** (Auftraggeber, 25.08.2026:
 * «wenn man die Beschlussfähigkeit feststellt, sollte dies dann auf dem
 * Bildschirm auch angezeigt werden. Also welche Gemeinschaft ist
 * beschlussfähig und welche nicht»).
 *
 * Bis hierher meldete der Abend «Beschlussfähigkeit festgehalten in 5
 * Gemeinschaften» — richtig und nutzlos: Festgehalten wird immer, die Frage ist
 * ja gerade, WAS. Wer im Saal steht und weiterführen will, braucht die Antwort
 * je Haus, und zwar an der Stelle, an der er gedrückt hat. Die Wand zeigt sie
 * auch, aber die Wand steht hinter ihm.
 */
/** Ein Sammelergebnis, das zusätzlich sagt, wie jedes Haus dasteht. */
export interface Abendfeststellung extends Sammelergebnis {
	befunde: Hausbefund[];
}

/** Dasselbe fürs Versiegeln. */
export interface Abendversiegelung extends Sammelergebnis {
	befunde: Hausversiegelung[];
}

/** Was eine Vertagung in EINEM Haus ergeben hat. */
export interface Hausvertagung {
	gemeinschaft: string;
	/** Die vertagte Versammlung — sie ist jetzt geschlossen. */
	versammlungId: Id;
	/** Die Folgeversammlung, die daraus entstanden ist. */
	folgeId: Id;
	/**
	 * Ihre Stufe: die zweite, oder eine neue erste, wenn das Haus an diesem
	 * Abend schon beschlussfähig war (C3, F4c; `folgestufeNachVertagung`).
	 */
	folgestufe: Versammlungsstufe;
	/** Die zweite nur nach L16: Das Haus war schon beschlussfähig (Migration 194). */
	nachLesart?: boolean;
}

/** Ein Sammelergebnis fürs Vertagen — mit dem gemeinsamen Folgetermin. */
export interface Abendvertagung extends Sammelergebnis {
	befunde: Hausvertagung[];
	/** Der Abend, an dem die vertagten Häuser wieder zusammenkommen. */
	folgeabendId: Id | null;
	/** Sein Datum — auch dann gesetzt, wenn kein Abend entstand. */
	datum: string;
}

/** Die Zeile der gemeinsamen Liste zu einer Nummer — mit ihren Traktanden. */
async function punktMitHaeusern(
	operatorId: Id,
	tagId: Id,
	geschaeftId: Id
): Promise<Listenzeile[]> {
	const liste = gemeinsameListe(await holeGemeinsameListe(operatorId, tagId));
	/*
	 * **Alle Zeilen des Geschäfts, nicht nur eine.** Ein Punkt, der in mehreren
	 * Häusern läuft, steht in der Liste als Sammelpunkt mit Unterzeilen; der
	 * Sammelpunkt selbst trägt keine Traktanden (er wird nicht abgestimmt).
	 * Gesucht ist alles, was unter dieser Geschäftskennung hängt.
	 */
	return liste.filter((z) => z.geschaeftId === geschaeftId);
}

/**
 * Alle Traktanden eines Geschäfts, je Haus eines — die Ziele jeder Handlung.
 *
 * Über `traktanden` und nicht über `traktandumId`: Beim einheitlichen Punkt
 * tragen alle Häuser dieselbe Zeile, und `traktandumId` ist dort bewusst leer.
 */
function zieleVon(
	zeilen: Listenzeile[],
	nurTraktandum?: Id | null
): { traktandumId: Id; meetingId: Id; gemeinschaft: string }[] {
	const raus = new Map<string, { traktandumId: Id; meetingId: Id; gemeinschaft: string }>();
	for (const z of zeilen) {
		for (const t of z.traktanden) {
			raus.set(t.traktandumId, {
				traktandumId: t.traktandumId,
				meetingId: t.meetingId,
				gemeinschaft: t.gemeinschaft
			});
		}
	}
	const alle = [...raus.values()];
	if (!nurTraktandum) return alle;

	/*
	 * **Ein einzelnes Haus, wenn der Punkt nicht überall derselbe ist** (Auftraggeber,
	 * 24.08.2026): «Wie funktioniert das Mecano bei Traktanden, die nicht alle
	 * STWEG betreffen? […] Eigentlich muss über jedes Subtraktandum einzeln
	 * abgestimmt werden. Erneuerungsfonds, Bestellung Ausschuss etc. kann
	 * unterschiedlich sein.»
	 *
	 * Der Sammelaufruf ist richtig, solange im Saal EINE Frage gestellt wird:
	 * «Wer stimmt der Jahresrechnung zu?» — jede Gemeinschaft beschliesst für
	 * sich, aber alle hören dieselbe Frage. Lautet der Antrag je Haus anders (7.1
	 * CHF 20 000, 7.2 CHF 35 000), wird nacheinander gefragt, und dann muss auch
	 * nacheinander aufgerufen und geöffnet werden können. Sonst stünde auf jedem
	 * Telefon die Frage des Nachbarhauses.
	 *
	 * Für das Aufrufen gilt das weiter. **Eröffnet wird seit 25.09.2026 immer
	 * nacheinander**, auch bei gleichem Antrag: `oeffneAmAbend` weist den Aufruf
	 * über mehrere Häuser ab, Begründung dort.
	 *
	 * Eine leere Auswahl ist kein «alle»: Wer ein bestimmtes Haus meint und eine
	 * unbekannte Kennung schickt, soll nichts auslösen statt alles.
	 */
	return alle.filter((z) => z.traktandumId === nurTraktandum);
}

/**
 * Die angehängten Anträge in diesen Häusern: Rückkommensanträge und im Saal
 * aufgenommene Folgeanträge, für `abendschritte` und die Bindung in
 * `zieleDesPunktes`.
 *
 * Gelesen wird nur in den Versammlungen, die hereingereicht werden: Ein Antrag
 * entsteht in der Versammlung seines Ziels, und die Aufrufer reichen die
 * Häuser aus der gemeinsamen Liste des Abends herein. Geordnet wie
 * `juengsterRueckkommensantrag`: nach Aufnahme, bei gleicher Zeit nach Kennung.
 *
 * **Folgeanträge seit dem 25.09.2026** (Auftraggeber: «Gegenanträge sollen am
 * gemeinsamen Abend möglich sein, gelöst wie der Rückkommensantrag»). Ein
 * Folgeantrag ist ein Unterpunkt seines Grundantrags (`parent_id`); sein Ziel
 * ist damit dasselbe wie beim Rückkommensantrag: ein Traktandum des Geschäfts.
 * Ein sachfremd aufgenommener Punkt (`spontanart` `neu`) gehört nicht dazu,
 * denn er stützt sich auf keinen Grundantrag. Welche Knoten zählen, rechnet
 * `zielDesAntrags` im Kern.
 */
export async function holeAbendantraege(
	operatorId: Id,
	haeuser: { meetingId: Id; gemeinschaft: string }[]
): Promise<Abendantrag[]> {
	const jeHaus = new Map(haeuser.map((h) => [h.meetingId, h.gemeinschaft]));

	const gefunden = await Promise.all(
		[...jeHaus].map(async ([meetingId, gemeinschaft]) =>
			(await holeTraktanden(operatorId, meetingId))
				.filter((t) => zielDesAntrags(t.knoten) !== null)
				.map((t) => ({
					aufgenommenAm: t.knoten.aufgenommenAm ?? '',
					antrag: {
						traktandumId: t.knoten.id,
						meetingId,
						gemeinschaft,
						zielId: zielDesAntrags(t.knoten)!,
						nummer: t.nummer,
						titel: t.knoten.titel,
						antragswortlaut: t.knoten.antragswortlaut ?? null,
						art: t.knoten.art === 'abstimmung' ? 'abstimmung' : 'kenntnisnahme'
					} satisfies Abendantrag
				}))
		)
	);
	return gefunden
		.flat()
		.sort(
			(a, b) =>
				a.aufgenommenAm.localeCompare(b.aufgenommenAm) ||
				a.antrag.traktandumId.localeCompare(b.antrag.traktandumId)
		)
		.map((g) => g.antrag);
}

/**
 * Die Ziele einer Handlung: die Traktanden des Geschäfts, und mit
 * `nurTraktandum` auch ein angehängter Antrag, der an einem von ihnen hängt.
 *
 * **Der Anlass** (Messung 25.09.2026): Am Abend führte «Rückkommensantrag
 * 10.1.1 aufrufen» in die Absage «Zu diesem Punkt gibt es in keiner
 * Gemeinschaft ein Traktandum.» Der Antrag ist ein eigenes Traktandum ohne
 * Geschäft und fiel aus `zieleVon` heraus; im Haus fehlt das Aufrufen, weil
 * der Abend führt. Der zweite Durchgang war damit am Abend nicht erreichbar.
 * Seit dem 25.09.2026 gilt derselbe Weg für den im Saal aufgenommenen
 * Folgeantrag (Auftraggeber: «gelöst wie der Rückkommensantrag»).
 *
 * **Die Bindung bleibt die an das Geschäft.** Ein angehängter Antrag gehört zu
 * dem Geschäft, an dessen Traktandum er hängt (`angehaengteAntraege`). Gesucht
 * wird nur in den Häusern, die ein Traktandum des Geschäfts tragen, und
 * nur unter den Anträgen, deren Ziel eines davon ist oder die an einem solchen
 * Antrag hängen. Eine Kennung, die weder das eine noch das andere ist, trifft
 * nichts.
 *
 * **Nie beim Sammelaufruf.** Ohne `nurTraktandum` bleibt es bei den
 * Traktanden des Geschäfts: Sonst riefe «Aufrufen» am Punkt im selben Haus
 * das Budget und seinen Rückkommens- oder Folgeantrag nacheinander auf, und
 * der zweite Aufruf verdrängte den ersten.
 */
async function zieleDesPunktes(
	operatorId: Id,
	tagId: Id,
	geschaeftId: Id,
	nurTraktandum?: Id | null
): Promise<{ traktandumId: Id; meetingId: Id; gemeinschaft: string }[]> {
	const zeilen = await punktMitHaeusern(operatorId, tagId, geschaeftId);
	const direkt = zieleVon(zeilen, nurTraktandum);
	if (!nurTraktandum || direkt.length > 0) return direkt;

	const alle = zieleVon(zeilen);
	return angehaengteAntraege(
		alle.map((z) => z.traktandumId),
		await holeAbendantraege(operatorId, alle)
	)
		.filter((a) => a.traktandumId === nurTraktandum)
		.map((a) => ({ traktandumId: a.traktandumId, meetingId: a.meetingId, gemeinschaft: a.gemeinschaft }));
}

/**
 * Führt eine Handlung über alle Häuser eines Punktes aus und sammelt, was war.
 *
 * **Und verkündet nach jedem Erfolg** (Code-Review 24.08.2026, Befund 1).
 *
 * Das fehlte, und es war der schwerste Fehler dieses Umbaus: Weder
 * `oeffneAbstimmung` noch `schliesseAbstimmung` noch `stelleAufTraktandum`
 * schicken selbst etwas in den Ereignisstrom — das tun in der einzelnen
 * Versammlung die Routen, nach JEDER Handlung. Die Abendsteuerung tat es nur
 * bei Pause und Wandbild.
 *
 * Die Folge: Die Sitzungsleitung öffnet die Abstimmung, `voting_round` steht
 * offen, und kein Telefon erfährt davon. Die Frage erscheint nirgends, die
 * Wand bleibt auf dem alten Punkt, und wer nach zwei Minuten schliesst, zählt
 * NULL Stimmen aus — der Antrag gilt als abgelehnt.
 *
 * Deshalb hier, an der einen Stelle, durch die alle vier Handlungen laufen.
 */
async function ueberAlleHaeuser(
	operatorId: Id,
	ziele: { traktandumId: Id; meetingId: Id; gemeinschaft: string }[],
	tun: (ziel: { traktandumId: Id; meetingId: Id }) => Promise<unknown>
): Promise<Sammelergebnis> {
	const offen: { gemeinschaft: string; grund: string }[] = [];
	let gelungen = 0;

	/*
	 * Nacheinander, nicht nebeneinander: Jede Handlung schreibt in ihre eigene
	 * Transaktion, und ein Abend hat eine Handvoll Häuser. Parallel gewänne man
	 * Millisekunden und verlöre die Reihenfolge im Verlauf.
	 */
	for (const ziel of ziele) {
		try {
			await tun(ziel);
			await verkuendeStand(operatorId, ziel.meetingId);
			gelungen++;
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				offen.push({ gemeinschaft: ziel.gemeinschaft, grund: fehler.message });
				continue;
			}
			throw fehler;
		}
	}

	return { gelungen, offen };
}

/**
 * Ruft denselben Punkt in jedem beteiligten Haus auf (AD-10 je Versammlung).
 *
 * bindung: geschaeftId — `punktMitHaeusern` liest die Liste des Abends über
 *   `tagId` und filtert danach auf die Geschäftskennung; eine fremde trifft
 *   keine Zeile. Ein angehängter Antrag (Rückkommen oder Folgeantrag) zählt
 *   nur über sein Ziel in diesem Geschäft (`zieleDesPunktes`).
 */
export async function rufeAmAbendAuf(
	handelnder: Handelnder & { operatorId: Id },
	tagId: Id,
	geschaeftId: Id,
	/** Nur dieses Traktandum — für einen Punkt, der je Haus anders lautet. */
	nurTraktandum?: Id | null
): Promise<Sammelergebnis> {
	const ziele = await zieleDesPunktes(handelnder.operatorId, tagId, geschaeftId, nurTraktandum);
	/*
	 * **Beim Sammelaufruf das erste Haus zuletzt**, damit es «jetzt» ist
	 * (`aufrufreihenfolge`, dort begründet). Hier und nicht in `laufendeStelle`:
	 * Die Regel dort trägt den Fall des veralteten Hauses, und die Wand nimmt
	 * ebenfalls den jüngsten Aufruf, zeigt so ohne eigene Änderung dasselbe Haus.
	 */
	const einzeln = Boolean(nurTraktandum);
	const e = await ueberAlleHaeuser(handelnder.operatorId, aufrufreihenfolge(ziele, einzeln), (z) =>
		stelleAufTraktandum(handelnder, z.meetingId, z.traktandumId)
	);
	// «Nicht möglich bei» in der Reihenfolge des Punktes, nicht in der des Aufrufs.
	return { ...e, offen: aufrufreihenfolge(e.offen, einzeln) };
}

/**
 * Nimmt den Aufruf zurück — aber nur dort, wo DIESER Punkt aufgerufen ist.
 *
 * **Der Bezug ist nötig** (Code-Review 24.08.2026, Befund 6). Zuerst setzte
 * diese Funktion `current_agenda_item_id = NULL` in jedem Haus des Punktes,
 * und `stelleAufTraktandum(…, null)` prüft beim Löschen nichts. Bei einem
 * Abend mit verschieden weiten Häusern hiess das: Haus A und B teilen Punkt 3,
 * B ist schon bei Punkt 5. Wer Punkt 3 zurücknimmt, löscht auch in B den
 * Aufruf von Punkt 5 — die Wand und die Telefone von B verlieren ihren Punkt,
 * ohne dass jemand etwas davon wollte.
 *
 * bindung: geschaeftId — `punktMitHaeusern` liest die Liste des Abends über
 *   `tagId` und filtert danach auf die Geschäftskennung; eine fremde trifft
 *   keine Zeile. Ein angehängter Antrag (Rückkommen oder Folgeantrag) zählt
 *   nur über sein Ziel in diesem Geschäft (`zieleDesPunktes`).
 */
export async function nimmAmAbendZurueck(
	handelnder: Handelnder & { operatorId: Id },
	tagId: Id,
	geschaeftId: Id,
	/** Nur dieses Traktandum — für einen Punkt, der je Haus anders lautet. */
	nurTraktandum?: Id | null
): Promise<Sammelergebnis> {
	const ziele = await zieleDesPunktes(handelnder.operatorId, tagId, geschaeftId, nurTraktandum);
	return ueberAlleHaeuser(handelnder.operatorId, ziele, async (z) => {
		const versammlung = await holeVersammlung(handelnder.operatorId, z.meetingId);
		if (versammlung?.aktuellesTraktandumId !== z.traktandumId) {
			throw new FachlicherFehler(
				'anderer_punkt',
				'Dort ist ein anderer Punkt aufgerufen.',
				'traktandum'
			);
		}
		return stelleAufTraktandum(handelnder, z.meetingId, null);
	});
}

/**
 * Öffnet die Abstimmung zu einem Punkt in **einem** Haus.
 *
 * Bis zum 25.09.2026 stand hier «in jedem beteiligten Haus, im selben Moment,
 * aber getrennt gezählt». Seither wird je Haus eröffnet: Ohne `nurTraktandum`
 * geht es nur, wenn der Punkt in genau einem Haus steht (Begründung an der
 * Sperre unten). Jede Gemeinschaft fasst ihren eigenen Beschluss, mit ihrer
 * eigenen Beschlussfähigkeit und ihrem eigenen Mehr.
 *
 * bindung: geschaeftId — `punktMitHaeusern` liest die Liste des Abends über
 *   `tagId` und filtert danach auf die Geschäftskennung; eine fremde trifft
 *   keine Zeile. Ein angehängter Antrag (Rückkommen oder Folgeantrag) zählt
 *   nur über sein Ziel in diesem Geschäft (`zieleDesPunktes`).
 */
export async function oeffneAmAbend(
	handelnder: Handelnder & { operatorId: Id },
	tagId: Id,
	geschaeftId: Id,
	/** Nur dieses Traktandum — für einen Punkt, der je Haus anders lautet. */
	nurTraktandum?: Id | null,
	/**
	 * Geheime Abstimmung (Migration 141) mit ihrer Grundlage (Migrationen 165
	 * und 166), siehe `oeffneAbstimmung`. `null`: offen. Als ein Wert statt
	 * dreier Stellen, damit keine vertauscht werden kann (Codeprüfung
	 * 16.10.2026).
	 */
	geheim: { beschlossen: boolean; reglement: boolean } | null = null,
	/** Die bestätigte Zuordnung (Ä-05, M4), siehe `oeffneAbstimmung`. */
	zuordnung?: string
): Promise<Sammelergebnis> {
	const ziele = await zieleDesPunktes(handelnder.operatorId, tagId, geschaeftId, nurTraktandum);
	/*
	 * **Abgestimmt wird je Haus, nie über mehrere zugleich** (Produktentscheid
	 * 25.09.2026: kein Abstimmungsschritt über mehrere Häuser; `laeuftGemeinsam`
	 * im Kern).
	 *
	 * Die Oberfläche bietet keinen Knopf mehr, der ohne Traktandum über mehrere
	 * Häuser eröffnet: Ein gemeinsamer Schritt ist nur noch eine Kenntnisnahme.
	 * Diese Sperre hält den Weg auch für einen Aufruf zu, der an der Oberfläche
	 * vorbeigeht. Sonst eröffnete er die Häuser ohne Vorschau und Sperre am
	 * Knopf, und eines, das abweist, stünde nur in einem Nebensatz.
	 */
	if (!nurTraktandum && ziele.length > 1) {
		throw new FachlicherFehler(
			'mehrere_haeuser',
			'Abgestimmt wird je Gemeinschaft. Rufen Sie den Punkt in der Gemeinschaft auf, die ' +
				'abstimmt, und eröffnen Sie dort.',
			'traktandum'
		);
	}
	return ueberAlleHaeuser(handelnder.operatorId, ziele, (z) =>
		oeffneAbstimmung(handelnder, z.meetingId, z.traktandumId, {
			geheim: geheim !== null,
			geheimBeschlossen: geheim?.beschlossen === true,
			geheimNachReglement: geheim?.reglement === true,
			zuordnung,
			amAbend: true
		})
	);
}

/**
 * Schliesst die Abstimmung in jedem beteiligten Haus.
 *
 * bindung: geschaeftId — `punktMitHaeusern` liest die Liste des Abends über
 *   `tagId` und filtert danach auf die Geschäftskennung; eine fremde trifft
 *   keine Zeile. Ein angehängter Antrag (Rückkommen oder Folgeantrag) zählt
 *   nur über sein Ziel in diesem Geschäft (`zieleDesPunktes`).
 */
export async function schliesseAmAbend(
	handelnder: Handelnder & { operatorId: Id },
	tagId: Id,
	geschaeftId: Id,
	/** Nur dieses Traktandum — für einen Punkt, der je Haus anders lautet. */
	nurTraktandum?: Id | null
): Promise<Sammelergebnis> {
	const ziele = await zieleDesPunktes(handelnder.operatorId, tagId, geschaeftId, nurTraktandum);
	/*
	 * **Erst nachsehen, WAS offen ist** (Code-Review 24.08.2026, Befund 2).
	 *
	 * `schliesseAbstimmung(handelnder, meetingId)` nimmt kein Traktandum
	 * entgegen: Es schliesst den offenen Durchgang der Versammlung und zählt
	 * aus. Mein erster Kommentar hier sagte, das sei dasselbe, «weil der Punkt
	 * in jedem Haus einmal vorkommt» — und verwechselte damit «der Punkt kommt
	 * einmal vor» mit «der offene Durchgang IST dieser Punkt».
	 *
	 * Der Unterschied kostet einen Beschluss: Punkt 2 läuft in A und B, die
	 * Leitung öffnet Punkt 3. In A gelingt es, in B nicht — dort ist Punkt 2
	 * noch offen, und das landet als Befund unter «Nicht möglich bei». Die
	 * Seite zeigt trotzdem «Abstimmung läuft», weil A offen ist. Ein Klick auf
	 * «Schliessen» für Punkt 3 schlösse dann in B den laufenden PUNKT-2-Durchgang
	 * und zählte ihn aus, während die Eigentümer von B noch abstimmen.
	 */
	return ueberAlleHaeuser(handelnder.operatorId, ziele, async (z) => {
		const offen = await holeOffenen(handelnder.operatorId, z.meetingId);
		if (!offen) {
			throw new FachlicherFehler(
				'keine_offene',
				'Dort ist keine Abstimmung offen.',
				'durchgang'
			);
		}
		if (offen.traktandumId !== z.traktandumId) {
			throw new FachlicherFehler(
				'anderer_punkt',
				'Dort läuft die Abstimmung zu einem anderen Punkt.',
				'durchgang'
			);
		}
		return schliesseAbstimmung(handelnder, z.meetingId);
	});
}

/**
 * Bricht die Abstimmung zu einem Punkt in jedem Haus ohne Ergebnis ab (H6,
 * `brecheAbstimmungAb`). Mit derselben Prüfung wie das Schliessen: nur, wo
 * genau dieser Punkt offen ist, nie ein anderer, der dort noch läuft.
 *
 * bindung: geschaeftId — `punktMitHaeusern` liest die Liste des Abends über
 *   `tagId` und filtert danach auf die Geschäftskennung; eine fremde trifft
 *   keine Zeile. Ein angehängter Antrag (Rückkommen oder Folgeantrag) zählt
 *   nur über sein Ziel in diesem Geschäft (`zieleDesPunktes`).
 */
export async function brecheAbAmAbend(
	handelnder: Handelnder & { operatorId: Id },
	tagId: Id,
	geschaeftId: Id,
	begruendung: string,
	nurTraktandum?: Id | null
): Promise<Sammelergebnis> {
	const ziele = await zieleDesPunktes(handelnder.operatorId, tagId, geschaeftId, nurTraktandum);
	return ueberAlleHaeuser(handelnder.operatorId, ziele, async (z) => {
		const offen = await holeOffenen(handelnder.operatorId, z.meetingId);
		if (!offen) {
			throw new FachlicherFehler(
				'keine_offene',
				'Dort ist keine Abstimmung offen.',
				'durchgang'
			);
		}
		if (offen.traktandumId !== z.traktandumId) {
			throw new FachlicherFehler(
				'anderer_punkt',
				'Dort läuft die Abstimmung zu einem anderen Punkt.',
				'durchgang'
			);
		}
		return brecheAbstimmungAb(handelnder, z.meetingId, begruendung, z.traktandumId);
	});
}

/**
 * Hält die Beschlussfähigkeit in **jeder** Gemeinschaft des Abends fest.
 *
 * **Der Anlass** (Auftraggeber, 24.08.2026): «ich habe bei Traktandum 1 auf Abstimmung
 * gedrückt und diese Meldung erhalten. Die Beschlussfähigkeit sollte einfach
 * festgehalten werden können.»
 *
 * **Eine gemeinsame Beschlussfähigkeit gibt es nicht** — das ist keine
 * Feinheit, sondern der Kern der Sache. Jede Gemeinschaft hat ihre eigenen
 * Kopfstimmen, ihre eigenen Wertquoten und womöglich ihre eigene
 * Reglementsregel. Ein Abend, an dem vier von fünf Häusern beschlussfähig sind,
 * ist ein üblicher Abend; ein Werkzeug, das daraus eine Zahl machte, sagte über
 * jedes einzelne Haus die Unwahrheit.
 *
 * Deshalb: ein Knopf, fünf Feststellungen, jede in ihrem Haus gespeichert —
 * dieselbe Regel wie bei jeder anderen Handlung des Abends.
 *
 * **Nicht an den Punkt gebunden.** Die anderen vier Handlungen wirken auf die
 * Häuser EINES Geschäfts; diese auf alle Häuser des Abends. Festgestellt wird,
 * wer im Saal ist, und der Saal gehört nicht zu einem Traktandum. Bei welchem
 * Punkt jedes Haus gerade steht, hält die Feststellung trotzdem fest — dort,
 * wo sie geschrieben wird.
 */
export async function halteAmAbendFest(
	handelnder: Handelnder & { operatorId: Id },
	tagId: Id
): Promise<Abendfeststellung> {
	const haeuser = await holeAbendhaeuser(handelnder.operatorId, tagId);
	const offen: { gemeinschaft: string; grund: string }[] = [];
	const befunde: Hausbefund[] = [];

	for (const h of haeuser) {
		try {
			const v = await holeVersammlung(handelnder.operatorId, h.versammlungId);
			const f = await halteBeschlussfaehigkeitFest(
				handelnder,
				h.versammlungId,
				v?.aktuellesTraktandumId ?? null
			);
			befunde.push({
				gemeinschaft: h.name,
				beschlussfaehig: f.beschlussfaehig,
				kopfstimmen: `${f.kopfstimmenAnwesend} von ${f.kopfstimmenGesamt}`,
				wertquoten: `${f.quotenAnwesend} von ${f.gesamtquote}`,
				fehlt: f.fehlt
			});
			/*
			 * **Verkünden, sonst erfährt es niemand** (Auftraggeber, 25.08.2026: «Wenn
			 * Beschlussfähigkeit festgehalten wird […] soll dies an der Sitzung
			 * entsprechend am Monitor angezeigt werden»).
			 *
			 * `halteBeschlussfaehigkeitFest` schreibt in `quorum_finding` und
			 * schickt nichts in den Ereignisstrom — dieselbe Lücke wie bei
			 * Aufrufen und Öffnen (Code-Review 24.08.2026, Befund 1), nur an der
			 * fünften Handlung, die nicht durch `ueberAlleHaeuser` läuft. Die
			 * Meldung an der Sitzungsleitung stand da, die Wand blieb stumm.
			 */
			await verkuendeStand(handelnder.operatorId, h.versammlungId);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				offen.push({ gemeinschaft: h.name, grund: fehler.message });
				continue;
			}
			throw fehler;
		}
	}

	return { gelungen: befunde.length, offen, befunde };
}

/**
 * Versiegelt **jede** Gemeinschaft des Abends — ein Knopf, fünf Pakete.
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «Warum kann nicht auf der Stufe Gruppe
 * versiegelt werden? Die Gruppe ist doch fest und bleibt es. Das Protokoll ist
 * auf Stuffe Gruppe.»
 *
 * Beim Protokoll hat er recht, und so ist es gebaut: eines für den ganzen
 * Abend. Beim Siegel geht es nicht, und zwar nicht aus Vorsicht, sondern
 * wegen des Inhalts. Ein Abschlusspaket trägt neun Bestandteile — Gemeinschaft,
 * Stimmberechtigtenstand, Anwesenheit, Vollmachten, Nachweise, Traktanden,
 * Durchgänge, Anhänge, Auswertung —, und acht davon gibt es **nur je
 * Gemeinschaft**. Ein gemeinsames Paket müsste sie vermengen; im
 * Anfechtungsfall bekäme ein Haus dann fremde Stimmberechtigtenstände in die
 * Hand, und den eigenen nur als Teilmenge darin.
 *
 * Dazu zwei Gründe aus dem Ablauf: Die Häuser **schliessen zu verschiedenen
 * Zeiten** — ein gemeinsames Siegel müsste auf das letzte warten, und
 * versiegelt wird, was feststeht. Und ein Haus kann **vertagt** sein; dann hat
 * es keine Beschlüsse, während die anderen welche haben.
 *
 * Was hier also abgenommen wird, ist das fünfmalige Klicken — dieselbe Bauart
 * wie bei `halteAmAbendFest`. Ein Haus, das nicht so weit ist, hält den Rest
 * nicht auf; sein Grund steht im Befund.
 */
export async function versiegleAmAbend(
	handelnder: Handelnder & { operatorId: Id },
	tagId: Id,
	/** Der Zeitpunkt kommt von aussen (AD-12) — siehe `versiegle`. */
	jetzt: string
): Promise<Abendversiegelung> {
	const haeuser = await holeAbendhaeuser(handelnder.operatorId, tagId);
	const offen: { gemeinschaft: string; grund: string }[] = [];
	const befunde: Hausversiegelung[] = [];

	for (const h of haeuser) {
		try {
			const siegel = await versiegle(handelnder, h.versammlungId, jetzt);
			/*
			 * Der Zeitstempel **nach** dem Siegel und ohne Abbruch: Er bezeugt das
			 * fertige Paket und darf das Versiegeln nicht aufhalten. Ohne Netz
			 * bleibt er offen und wird später je Versammlung nachgeholt (FR-53).
			 */
			let bezeugt = false;
			try {
				const stempel = await holeZeitstempel(handelnder, h.versammlungId);
				bezeugt = stempel.zustand === 'vorhanden';
			} catch {
				bezeugt = false;
			}
			befunde.push({
				gemeinschaft: h.name,
				siegelkopf: siegel.siegel.slice(0, 16),
				zeitstempel: bezeugt
			});
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				offen.push({ gemeinschaft: h.name, grund: fehler.message });
				continue;
			}
			throw fehler;
		}
	}

	return { gelungen: befunde.length, offen, befunde };
}

/** Der Zusatz zur Bezeichnung des Folgeabends, nach den Stufen der Häuser (C3, F4c). */
function folgeabendZusatz(befunde: readonly Hausvertagung[]): string {
	const zweite = befunde.filter((b) => b.folgestufe === 'zweite').length;
	if (zweite === befunde.length) return 'zweite Versammlung';
	if (zweite === 0) return 'neue Versammlung';
	return 'Folgeversammlung';
}

/** Die Bemerkung am Folgeabend: welches Haus als zweite tagt und welches als neue erste (C3, F4c). */
function folgeabendBemerkung(datum: string, befunde: readonly Hausvertagung[]): string {
	return `Entstanden aus der Vertagung vom ${datum}. ${folgestufenSatz(befunde)}`;
}

/**
 * Vertagt mehrere Häuser eines Abends in einem Zug — auf **einen** Folgetermin.
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «Wenn nur eine von fünf einheiten
 * beschlussfähig sind, wird die Sitzung mit der beschlussfähigen Gemeinschaft
 * durchgeführt. Die anderen brauchen einen neuen Termin, frühestens in 10 Tage
 * später. Wobei auch die Gemeinschaft entscheiden kann, die Sitzung zu
 * verschieben.»
 *
 * Beide Fälle laufen hier durch: die vier, denen die Beteiligung fehlt, und
 * die eine, die den Beschluss fasst, ein andermal weiterzumachen. Der
 * Unterschied steht im **Grund** und gehört ins Protokoll. Die Stufe der
 * Folgeversammlung entscheidet, ob ein Haus an diesem Abend beschlussfähig war
 * (C3, F4c): Wem die Beteiligung von Anfang an fehlte, der bekommt die zweite
 * nach ZGB Art. 712p Abs. 2; wer beschlussfähig war, eine neue erste.
 *
 * **Und daraus entsteht ein neuer Abend.** Ohne ihn hätte die Bewirtschaftung
 * nach dem Vertagen vier lose Folgeversammlungen und müsste den Abend von Hand
 * nachbauen — dieselbe Lücke, wegen der die Vertagung im Haus überhaupt gebaut
 * wurde: die Funktion da, der Weg nicht. Der neue Abend übernimmt Uhrzeit, Ort
 * und Art des alten; die gemeinsame Traktandenliste entsteht beim Zuordnen von
 * selbst, weil `nimmInTagAuf` die mitgebrachten Listen zusammenführt.
 *
 * **Ein Haus, das nicht mitkann, hält die anderen nicht auf** — dieselbe Regel
 * wie bei jeder anderen Handlung des Abends. Wer schon versiegelt ist oder
 * bereits in zweiter Versammlung tagt, landet mit seinem Grund unter «offen».
 */
export async function vertageAmAbend(
	handelnder: Handelnder & { operatorId: Id },
	tagId: Id,
	eingabe: {
		/** Kennungen der Versammlungen, die vertagt werden — nicht der Gemeinschaften. */
		versammlungen: Id[];
		grund: string;
		/**
		 * Der gemeinsame Folgetermin. Fehlt er, wird gerechnet: das Datum des
		 * Abends plus `abstandTage`.
		 *
		 * Das Formular gibt ihn vor, weil der frühestmögliche Tag selten der
		 * passende ist: Ein Saal ist am ersten zulässigen Tag nicht zwingend frei.
		 * **Zu früh scheitert nicht mehr**, seit R-2b das Begründungsfeld entfernt
		 * hat (24.09.2026): `pruefeVersammlung` weist nur noch einen negativen
		 * Abstand ab. Ein zu knapper Termin wird erfasst und bekommt den
		 * Fristvermerk, je Haus und nach dessen eigener Frist.
		 */
		datum?: string;
		/** Wie viele Tage später, wenn kein Datum vorgegeben ist. */
		abstandTage?: number;
	}
): Promise<Abendvertagung> {
	const abend = await holeVersammlungstag(handelnder.operatorId, tagId);
	if (!abend) {
		throw new FachlicherFehler('unbekannt', 'Gemeinsame Versammlung nicht gefunden.', 'tagId');
	}

	const haeuser = await holeAbendhaeuser(handelnder.operatorId, tagId);
	/*
	 * **Eine leere Auswahl ist kein «alle»** — dieselbe Regel wie beim Aufrufen
	 * eines einzelnen Hauses (`zieleVon`). Wer nichts angehakt hat, soll nichts
	 * auslösen, und eine fremde Kennung schon gar nicht.
	 */
	const gewaehlt = new Set(eingabe.versammlungen);
	const ziele = haeuser.filter((h) => gewaehlt.has(h.versammlungId));
	if (ziele.length === 0) {
		throw new FachlicherFehler(
			'keine_auswahl',
			'Wählen Sie zuerst aus, welche Gemeinschaften vertagt werden.',
			'versammlungen'
		);
	}

	/*
	 * Der Termin wird **einmal** gerechnet, aus dem Datum des Abends — und dann
	 * jedem Haus fest vorgegeben. Rechnete jedes Haus für sich, ergäbe eine
	 * abweichend datierte Versammlung einen eigenen Tag, und aus «einem neuen
	 * Termin» würden zwei.
	 */
	/*
	 * **Und aus der längsten Frist der beteiligten Häuser** (Migration 122). Hat
	 * eines von ihnen eine Reglementsfrist von zwanzig Tagen und die anderen
	 * keine, wäre der elfte Tag für dieses Haus unzulässig — und der Vorschlag
	 * genau der Tag, den seine Gemeinschaftsordnung ausschliesst.
	 */
	const laengste = await laengsteZweitfrist(
		handelnder.operatorId,
		ziele.map((z) => z.stwegId)
	);
	const datum =
		eingabe.datum?.trim() ||
		tageSpaeter(abend.datum, eingabe.abstandTage ?? geltendeZweitfrist(laengste) + 1);

	const offen: { gemeinschaft: string; grund: string }[] = [];
	const befunde: Hausvertagung[] = [];

	for (const h of ziele) {
		try {
			const e = await vertageVersammlung(handelnder, h.versammlungId, {
				grund: eingabe.grund,
				datum
			});
			befunde.push({
				gemeinschaft: h.name,
				versammlungId: h.versammlungId,
				folgeId: e.folge.id,
				folgestufe: e.folgestufe,
				...(e.nachLesart ? { nachLesart: true } : {})
			});
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				offen.push({ gemeinschaft: h.name, grund: fehler.message });
				continue;
			}
			throw fehler;
		}
	}

	if (befunde.length === 0) return { gelungen: 0, offen, befunde, folgeabendId: null, datum };

	const folgeabend = await erstelleVersammlungstag(handelnder, {
		bezeichnung: `${abend.bezeichnung} — ${folgeabendZusatz(befunde)}`,
		datum,
		uhrzeit: abend.uhrzeit,
		ort: abend.ort,
		bemerkung: folgeabendBemerkung(abend.datum, befunde),
		art: abend.art,
		anlass: abend.anlass,
		// Auch die Abstimmungsweise: Sie ist hart, und der Folgeabend ist
		// derselbe Saal mit denselben Leuten. Ohne dies fiele er auf den
		// Vorgabewert zurück und zöge beim Zuordnen jedes Haus mit um.
		betriebsart: abend.betriebsart
	});

	/*
	 * Die Reihenfolge des alten Abends bleibt: `holeAbendhaeuser` liefert nach
	 * `day_position` sortiert, und wer im Saal zuerst dran war, ist es wieder.
	 */
	for (const [stelle, b] of befunde.entries()) {
		await nimmInTagAuf(handelnder, folgeabend.id, b.folgeId, stelle);
	}

	return { gelungen: befunde.length, offen, befunde, folgeabendId: folgeabend.id, datum };
}
