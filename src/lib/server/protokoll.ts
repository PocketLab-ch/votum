/**
 * Das Protokoll — Zugriff und Zusammentragen (FR-46, FR-48 bis FR-50).
 *
 * Der Kern in `$lib/domain/protokoll` setzt den Text; hier steht, woher die
 * Angaben kommen und wie sie gespeichert werden (AD-1).
 *
 * **Das Protokoll ist nicht Teil des Siegels** (PRD §4.11). Es entsteht nach
 * der Sitzung, wird redigiert und von der nächsten Versammlung genehmigt.
 * Deshalb ist die Arbeitsfassung frei änderbar — festgehalten wird, was
 * versandt oder genehmigt wurde, und das bleibt dann unverändert.
 */
import { NOTWENDIGE_MASSNAHME_KNOTEN } from '$lib/domain/entscheidbaum';
import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdesTraktandum } from '$lib/domain/fehler';
import { mitQuelle } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { Schreibkonflikt, veralteteFelder } from '$lib/domain/schreibstand';
import {
	feststellungssatz,
	satzZumEinzigen,
	stelleBeschlussfaehigkeitFest,
	type Beschlussfaehigkeitsregel,
	type Versammlungsstufe
} from '$lib/domain/beschlussfaehigkeit';
import { beteiligungDerAnwesenden } from '$lib/domain/anwesenheit';
import { holeFeststellungen } from './beschlussfaehigkeit';
import {
	uebersicht as vollmachtsuebersicht,
	vertretungsgrundInWorten,
	vertretungszeitraeume,
	type Vertretungszeitraum
} from '$lib/domain/vollmacht';
import { rueckzugInWorten } from '$lib/domain/traktanden';
import { uhrzeit, zeitpunktLang } from '$lib/domain/datum';
import { vorgezogene } from '$lib/domain/traktandenbaum';
import {
	beschlussfaehigkeitFehlteAmBeschluss,
	ausstandFehlteAmBeschluss,
	ersteFehlteAmBeschluss,
	ohneErgebnis,
	protokollentwurf,
	pruefeProtokolltext,
	type Fassungsart,
	type Protokolleingabe,
	type Protokollspiegel,
	type Protokollzeile
} from '$lib/domain/protokoll';
import { abgeschlossen } from '$lib/domain/versammlung';
import { VON_HAND_TITEL } from '$lib/domain/vonhand';
import {
	vetoWegInWorten,
	ergebnislage,
	zustimmungBetroffenerGefragt,
	type Stimmenspiegel
} from '$lib/domain/auszaehlung';
import { holeAuswertung, holeBeschlussvermerke } from './auswertung';
import { holeSiegel } from './siegel';
import { holeTeilentschieden, holeDurchgaenge, holeErgebnis, holeStellvertretendeStimmen, type Durchgangsstand } from './abstimmung';
import { holeMomentaufnahme } from './freigabe';
import { stimmkraftliste, type Stimmkraftliste } from '$lib/domain/stimmkraft';
import { nutzniessungenDerBetroffenen } from '$lib/domain/nutzniessung';
import { holePapierabgaben } from './papierabgabe';
import { holeNeueTraktandenDerZweiten, holeTraktanden } from './traktanden';
import { holeUebersicht } from './anwesenheit';
import { holeGemeinschaft } from './gemeinschaften';
import { holeVersammlung } from './versammlungen';
import { holeAnwesenheitsregeln } from './reglement';
import { holeParteien, holeVollmachten } from './vollmacht';
import { ABBERUFUNGSKNOTEN, VERWALTUNGSKNOTEN, VERWALTUNGSWAHLKNOTEN } from './erfordernisse';
import { vertreterkennung } from '$lib/domain/vollmacht';
import type { Verwaltungsangabe } from '$lib/domain/verwaltungsangabe';
import { leseEinstellungIn } from './universal';
import type { Id, Zeitpunkt } from '$lib/domain/types';
import { maschinellVorbereitet } from './protokollentwurf';
import { maschinenvermerk } from '$lib/domain/ki';
import { holeBetreiber } from './betreiber';
import { namenSatz } from '$lib/domain/folgeantrag';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { holePendenzen } from './pendenz';
import { holeRuegen, ruegeangaben } from './ruege';
import { baueNachtragssiegel } from './nachtragssiegel';
import type { Pendenz, Pendenzangabe } from '$lib/domain/pendenz';

/**
 * Aus der Pendenz nur das, was ins Protokoll gehört.
 *
 * **Warum das Kappen und nicht das blosse Durchreichen** (Sicherheitsprüfung
 * 09.09.2026). `Pendenzangabe` hat vier Felder, `Pendenz` hat neun — und
 * TypeScript lässt die grössere Form strukturell überall dort zu, wo die
 * kleinere verlangt ist. Zur Laufzeit lagen damit `zustand` und vor allem
 * `abschlussNotiz` («war nicht erreichbar») in der Protokolleingabe, obwohl der
 * Renderer sie nie liest.
 *
 * Heute erreicht keines der beiden eine Ausgabe: Die Zusammenstellung gibt eine
 * Zeichenkette zurück, und das Eingabeobjekt verlässt die Funktion nicht.
 * Genau das ist aber eine Beobachtung über den heutigen Code und keine
 * Zusicherung — wer morgen die Eingabe an die Seite durchreicht oder ein Feld
 * ergänzt, nimmt beides still mit. Nach dem Kappen gibt es nichts mehr
 * mitzunehmen.
 *
 * Dieselbe Überlegung wie beim Verlaufseintrag am selben Tag: Eine Regel, die
 * nur gilt, solange niemand etwas ändert, ist keine.
 */
export function nurAngaben(pendenzen: Pendenz[] | undefined): Pendenzangabe[] {
	return (pendenzen ?? []).map(({ text, verantwortlich, fristArt, fristDatum }) => ({
		text,
		verantwortlich,
		fristArt,
		fristDatum
	}));
}

/**
 * Der zweite Durchgang nach Eintritt der Beschlussfähigkeit (Migration 139,
 * `domain/neuabstimmung.ts`) — eine Rechnung für beide Protokolle.
 *
 * **Warum sie hier steht und nicht zweimal.** Das Hausprotokoll und das
 * gemeinsame Protokoll des Abends tragen denselben Satz; am Abend führt das
 * Haus kein eigenes Protokoll. Beide Schalen rufen diese Funktion mit den
 * Grössen des Hauses (Durchgänge, Stimmkraft, Stufe, Regel), statt die
 * Erkennung ein zweites Mal zu schreiben — eine Kopie liefe bei der nächsten
 * Änderung auseinander. Dasselbe Verfahren wie bei
 * `beschlussfaehigkeitFehlteAmBeschluss` (Block 6).
 *
 * Erkannt an der Überholungsart: Der frühere Durchgang trägt `nachquorum` und
 * verweist auf den geltenden, oder der frühere gilt weiter und der zweite ist
 * als `nachquorum_erfolglos` überholt. `null` heisst: kein solcher Fall.
 *
 * bindung: operatorId/meetingId — gelesen wird über `holeErgebnis`, das unter
 * `alsBetreiber` läuft; die Kennungen kommen aus derselben Versammlung.
 */
export async function nachQuorumLage(e: {
	operatorId: Id;
	meetingId: Id;
	traktandumId: Id;
	/** Der geltende Durchgang dieses Traktandums aus der Auswertung. */
	geltenderId: Id | null;
	durchgaenge: readonly Durchgangsstand[];
	stimmkraft: Stimmkraftliste | null;
	stufe: Versammlungsstufe;
	regel: Beschlussfaehigkeitsregel | null;
}): Promise<Protokollzeile['nachQuorum']> {
	if (!e.geltenderId || !e.stimmkraft) return null;
	const dazu = e.durchgaenge.filter((d) => d.traktandumId === e.traktandumId);
	const ersetzt = dazu.find(
		(d) => d.ueberholungsart === 'nachquorum' && d.ersetztDurchId === e.geltenderId
	);
	const geltend = dazu.find((d) => d.id === e.geltenderId);
	/*
	 * **Der jüngste gescheiterte Durchgang nach dem geltenden**, nicht der
	 * erste: Wird nach einem Fehlversuch erneut von Hand festgehalten (3) und
	 * scheitert danach wieder ein direkter Durchgang (4), nennte der Satz
	 * sonst den Durchgang 2 und liesse sich von der Nummernschranke
	 * abweisen, während die Wand den Durchgang 4 zeigt (Codeprüfung
	 * 03.10.2026, zweiter Durchgang).
	 */
	const zweiter = ersetzt
		? geltend
		: dazu
				.filter(
					(d) =>
						d.ueberholungsart === 'nachquorum_erfolglos' &&
						!!geltend &&
						d.nummer > geltend.nummer
				)
				.reduce<typeof geltend>((a, b) => (!a || b.nummer > a.nummer ? b : a), undefined);
	const erster = ersetzt ?? (zweiter ? geltend : undefined);
	// Nur ein von Hand festgehaltener Durchgang trägt die beiden Sätze; ein
	// späteres Rückkommen kann den von Hand festgehaltenen ersetzt haben, und
	// dann gehört der frühere Fehlversuch nicht mehr in den Satz.
	if (!erster || !zweiter || !erster.anwesende || !erster.vonHand) return null;
	const beteiligungErster = beteiligungDerAnwesenden(e.stimmkraft, erster.anwesende);
	const befund = stelleBeschlussfaehigkeitFest(e.stufe, beteiligungErster, e.regel);
	// Der erste Durchgang war nur dann ohne Beschlussfähigkeit, wenn die
	// eingefrorenen Zahlen es hergeben. Der Eintrag selbst belegt es nicht
	// mehr (die Regel wird heute gelesen); die Sätze behaupteten sonst eine
	// Tatsache, die der Stand nicht trägt.
	if (befund.beschlussfaehig) return null;
	/*
	 * Trägt der frühere die Überholungsart `nachquorum`, ist der zweite
	 * angenommen — nur dann überholt das Schliessen ihn. Sonst kommt der
	 * Ausgang aus der festgeschriebenen Auszählung des gescheiterten
	 * Durchgangs; «angenommen» kann er dort nicht sein. Und der Ausgang des
	 * ersten Durchgangs entscheidet, ob der Satz von einem Beschluss oder
	 * von einer Ablehnung spricht.
	 */
	const lage = ersetzt
		? 'angenommen'
		: ergebnislage((await holeErgebnis(e.operatorId, e.meetingId, zweiter.id)).auszaehlung);
	const ersteLage = ergebnislage((await holeErgebnis(e.operatorId, e.meetingId, erster.id)).auszaehlung);
	return {
		ohneQuorum: {
			nummer: erster.nummer,
			// Die Uhrzeit stammt aus `closed_at`; beide Kandidaten sind
			// geschlossene Durchgänge (der geltende aus der Auswertung, der
			// überholte aus derselben Liste), der Wert ist also gesetzt.
			zeitpunkt: erster.geschlossenAm ? uhrzeit(erster.geschlossenAm) : '',
			anwesend: beteiligungErster,
			angenommen: ersteLage === 'angenommen'
		},
		danach: {
			nummer: zweiter.nummer,
			zeitpunkt: zweiter.geschlossenAm ? uhrzeit(zweiter.geschlossenAm) : '',
			anwesend: zweiter.anwesende
				? beteiligungDerAnwesenden(e.stimmkraft, zweiter.anwesende)
				: null,
			...(zweiter.handzaehlung ? { vonHandGezaehlt: true } : {})
		},
		ausgang: lage === 'angenommen' ? 'angenommen' : lage === 'abgelehnt' ? 'abgelehnt' : 'kein_beschluss',
		grundlage: befund.grundlage,
		fundstelle: befund.fundstelle ?? null
	};
}

// ── Notizen je Traktandum (FR-46) ───────────────────────────────────────────

/**
 * Hält fest, was zu einem Traktandum gesagt wurde.
 *
 * **Auch nach dem Schliessen der Versammlung, und auch nach dem Versiegeln.**
 * FR-46 sagte «solange nicht versiegelt ist»; gebaut ist es weiter: Migration
 * 039 nimmt die Protokollnotiz ausdrücklich vom Siegel aus, und diese Funktion
 * prüft keinen Zustand (gemessen in `tests/db/beschluss-von-hand.test.ts`,
 * «Nach dem Schluss»). Das Handbuch stützt sich darauf. Wer den Saal verlässt und im Auto noch
 * einen Satz nachträgt, tut das Richtige — das Protokoll entsteht nun einmal
 * danach. Was dabei geändert wird, steht mit Zeitpunkt im Verlauf.
 */
export async function setzeProtokollnotiz(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	text: string,
	/**
	 * Der Text, den der Absender zuletzt kannte.
	 *
	 * **Wozu.** Dasselbe Feld steht an zwei Stellen — in der Sitzungsleitung beim
	 * aufgerufenen Traktandum und auf der Protokollseite. Wer beide offen hat und
	 * im einen tippt, überschriebe beim Sichern des anderen die frische Fassung
	 * mit einer alten, und niemand sähe es. Stimmt der bekannte Stand nicht mehr
	 * mit dem gespeicherten überein, wird nichts überschrieben, sondern
	 * gemeldet.
	 *
	 * Ohne Angabe (das Formular ohne JavaScript) gilt der alte Weg: letzter
	 * Schreibvorgang gewinnt.
	 */
	bisher?: string
): Promise<{ titel: string; laenge: number }> {
	const wortlaut = (text ?? '').trim();
	if (zeichenzahl(wortlaut) > 20000) {
		throw new FachlicherFehler(
			'zu_lang',
			'Die Notiz ist länger als 20 000 Zeichen. Das Protokoll ist ein Beschlussprotokoll, kein Wortprotokoll.',
			'notiz'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// `FOR UPDATE`: Zwischen Lesen und Schreiben liegt die Konfliktprüfung.
		// Ohne Sperre lesen zwei gleichzeitige Vorgänge denselben Stand, beide
		// finden nichts Veraltetes, und der zweite überschreibt den ersten still —
		// genau die Überschreibung, die hier verhindert werden soll.
		const [t] = await tx<{ title: string; minute_text: string | null; minute_decision: boolean }[]>`
			SELECT title, minute_text, minute_decision FROM agenda_item
			WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
			FOR UPDATE
		`;
		if (!t) {
			throw fremdesTraktandum('traktandumId');
		}
		const gespeichert = t.minute_text ?? '';
		if (veralteteFelder({ notiz: gespeichert }, { notiz: bisher }, { notiz: wortlaut }).length > 0) {
			throw new Schreibkonflikt(
				{ notiz: gespeichert }
			);
		}
		/*
		 * **Ein leerer Text nimmt den Beschlussvermerk mit** (Block 7). Der
		 * Vermerk behauptet, der Text im Votenfeld sei der Beschluss; ohne
		 * Text behauptete er einen Beschluss, den niemand lesen kann. Der
		 * Sonderfall `wortlaut === ''` steht darum vor dem Gleichheitsfall:
		 * Steht das Feld schon leer und trägt trotzdem den Vermerk, ist das
		 * kein Grund, ihn stehen zu lassen.
		 */
		if (gespeichert === wortlaut && !(wortlaut === '' && t.minute_decision)) {
			return { titel: t.title, laenge: zeichenzahl(wortlaut) };
		}

		await tx`
			UPDATE agenda_item
			SET minute_text = ${wortlaut || null},
			    minute_text_changed_at = now(),
			    minute_text_changed_by = ${handelnder.userId},
			    minute_decision = CASE WHEN ${wortlaut === ''} THEN false ELSE minute_decision END
			WHERE id = ${traktandumId}
		`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.protokollnotizErfasst, { art: 'agenda_item', id: traktandumId }, {
				traktandum: t.title,
				zeichen: zeichenzahl(wortlaut),
				geleert: wortlaut.length === 0
			}),
			// Fällt der Beschlussvermerk mit dem geleerten Text, steht das im
			// Verlauf wie ein Zurücknehmen von Hand. Sonst bliebe «erfasst,
			// vermerk: true» der letzte Eintrag seiner Art (Codeprüfung zur
			// Abnahme, 02.10.2026).
			...(wortlaut === '' && t.minute_decision
				? [
						ereignis(EREIGNISARTEN.beschlussvermerkErfasst, { art: 'agenda_item', id: traktandumId }, {
							traktandum: t.title,
							vermerk: false,
							mitDemTextGeleert: true
						})
					]
				: [])
		]);
		return { titel: t.title, laenge: zeichenzahl(wortlaut) };
	});
}

/** Die Notizen aller Traktanden — für die Protokollseite und den Entwurf. */
export async function holeNotizen(operatorId: Id, meetingId: Id): Promise<Map<Id, string>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ id: string; minute_text: string | null }[]>`
			SELECT id, minute_text FROM agenda_item WHERE meeting_id = ${meetingId}
		`;
		return new Map(zeilen.filter((z) => z.minute_text).map((z) => [z.id, z.minute_text as string]));
	});
}

// ── Der Beschlussvermerk je Traktandum (Block 7) ────────────────────────────

/**
 * Der Folgeantrag, der einen Antrag gegenstandslos gemacht hat.
 *
 * Aus derselben Rechnung wie `stelleEntwurfZusammen` (dort bis Block 7 inline):
 * Für jede Auswertungszeile mit angenommenem Ergebnis, deren Traktandum ein
 * Elternteil hat, trägt dieses Elternteil den Folgeantrag. Gelesen von der
 * Protokollzeile und von der Prüfung des Beschlussvermerks — zwei Fassungen
 * der Zuordnung liefen auseinander.
 */
function angenommeneFolgeantraege(
	auswertung: Awaited<ReturnType<typeof holeAuswertung>>,
	traktanden: Awaited<ReturnType<typeof holeTraktanden>>
): Map<string, { nummer: string; titel: string }[]> {
	const jeTraktandum = new Map(traktanden.map((t) => [t.nummer, t]));
	// Entscheid 0045, Punkt 9 (beim Bau geklärt 07.11.2026): alle, nicht der
	// zuletzt gefundene; die Folge der Nummern setzt der Satz.
	const angenommene = new Map<string, { nummer: string; titel: string }[]>();
	for (const z of auswertung?.zeilen ?? []) {
		const t = jeTraktandum.get(z.nummer);
		const elternId = t?.knoten.parentId;
		// Nur Folgeanträge (Codeprüfung P9, G-6): Ein angekündigter Unterpunkt
		// macht den Punkt darüber nicht gegenstandslos.
		if (!elternId || t?.knoten.spontanart !== 'folgeantrag' || !z.auszaehlung?.angenommen) continue;
		const eltern = traktanden.find((x) => x.knoten.id === elternId);
		if (!eltern) continue;
		const liste = angenommene.get(eltern.nummer) ?? [];
		liste.push({ nummer: z.nummer, titel: z.titel });
		angenommene.set(eltern.nummer, liste);
	}
	return angenommene;
}

/**
 * Entscheid 0045, Punkt 9 (Codeprüfung P9, M-2): je Grundantrag mit Häkchen
 * die Folgeanträge zur Wahl oder Abberufung der Verwaltung, über die
 * entschieden ist. Ist keiner angenommen, sagt das Protokoll beim
 * gesperrten Grundantrag damit, warum über ihn nicht abgestimmt wurde.
 * **Dieselbe Abfrage wie die Sperre** (`holeTeilentschieden`; Codeprüfung
 * P9, N-M2): konsultative Durchgänge und der Weggang zählen nicht, der
 * Knoten kommt aus dem Durchgang.
 */
async function entschiedeneTeile(
	operatorId: Id,
	meetingId: Id,
	traktanden: Awaited<ReturnType<typeof holeTraktanden>>
): Promise<Map<string, { nummer: string; titel: string; art: 'wahl' | 'abberufung' }[]>> {
	const nummer = new Map(traktanden.map((t) => [t.knoten.id, t.nummer]));
	const teile = new Map<string, { nummer: string; titel: string; art: 'wahl' | 'abberufung' }[]>();
	for (const g of traktanden) {
		if (!g.knoten.verwaltungsGeschaeft || g.knoten.spontanart) continue;
		const liste = (await holeTeilentschieden(operatorId, meetingId, g.knoten.id))
			.filter((x) => nummer.has(x.traktandumId))
			.map((x) => ({ nummer: nummer.get(x.traktandumId)!, titel: x.titel, art: x.art }));
		if (liste.length > 0) teile.set(g.nummer, liste);
	}
	return teile;
}

/** Warum über einen Antrag nicht abgestimmt wurde, wo Folgeanträge entschieden haben. */
export interface Folgeantragslage {
	/** Wie `Protokollzeile.folgeantraegeAngenommen`. */
	folgeantraegeAngenommen: { nummer: string; titel: string }[] | null;
	/** Wie `Protokollzeile.teileEntschieden`; `null`, wo ein Folgeantrag angenommen ist. */
	teileEntschieden: { nummer: string; titel: string; art: 'wahl' | 'abberufung' }[] | null;
}

/**
 * Je Auswertungszeile die Folgeantragslage, **eine Stelle für das
 * Hausprotokoll und das gemeinsame Abenddokument** (Featureprüfung 2 zu F4c,
 * M1, 08.11.2026). Bis dahin rechnete nur `stelleEntwurfZusammen` sie, und
 * das Abenddokument schrieb beim gesperrten Grundantrag «Zu diesem Punkt
 * liegt noch kein Ergebnis vor.», während das Hausprotokoll den Grund nannte.
 *
 * Nicht nach einer Abstimmung über den Antrag selbst und nicht nach einem
 * Rückkommen über einen Folgeantrag: Dann steht dort ein Ergebnis, und
 * `ersetzung` sagt, was daraus wurde (Soll 6). Die Bedingung ist die des
 * Hausprotokolls, sie wurde nur hierher gezogen.
 */
export async function holeFolgeantragslagen(
	operatorId: Id,
	meetingId: Id,
	auswertung: Awaited<ReturnType<typeof holeAuswertung>>,
	traktanden: Awaited<ReturnType<typeof holeTraktanden>>
): Promise<(z: { nummer: string; auszaehlung: unknown; ersetzung?: unknown }) => Folgeantragslage> {
	const angenommene = angenommeneFolgeantraege(auswertung, traktanden);
	// Codeprüfung P9, M-2: beim gesperrten Grundantrag ohne angenommenen
	// Folgeantrag die entschiedenen Teile.
	const teile = await entschiedeneTeile(operatorId, meetingId, traktanden);
	return (z) => {
		if (z.auszaehlung || z.ersetzung) return { folgeantraegeAngenommen: null, teileEntschieden: null };
		const angenommen = angenommene.get(z.nummer) ?? null;
		return {
			folgeantraegeAngenommen: angenommen,
			teileEntschieden: angenommen ? null : (teile.get(z.nummer) ?? null)
		};
	};
}

/**
 * Ob Folgeanträge über den Antrag entschieden haben: angenommen, dann
 * gegenstandslos; unter dem Häkchen zur Wahl oder Abberufung entschieden,
 * dann gesperrt (Entscheid 0045, Punkt 9). **Eine Bedingung für das
 * Abenddokument und die Tafel** (Produktentscheid 08.11.2026, «Leiste und
 * Tafel zählen wie das Protokoll», 02.10.2026); `ohneErgebnis` im Kern liest
 * dieselben zwei Felder.
 */
export function durchFolgeantraegeEntschieden(l: Folgeantragslage): boolean {
	return !!l.folgeantraegeAngenommen || (l.teileEntschieden?.length ?? 0) > 0;
}

/** Die Zeilen zu L8 an einem Beschluss, wie `Protokollzeile` sie führt. */
export type L8Zeilenlage = Pick<
	Protokollzeile,
	'wahlTrotzHaekchen' | 'abberufungTrotzHaekchen' | 'abberufungAusstandErklaert' | 'verwaltungsangabe'
>;

/**
 * Die Kennungen der Vollmachten der Verwaltung, wie die Zählung sie führt
 * (`vertreterkennung`); für `l8Zeilenlage`, ob die Leitung ihren Ausstand
 * erklärt hat (Fachprüfung Runde 5, R5-3).
 */
export function verwaltungskennungenAus(
	vollmachten: readonly { istVerwaltung?: boolean; bevollmaechtigtName?: string | null }[]
): Set<string> {
	return new Set(
		vollmachten
			.filter((v) => v.istVerwaltung && v.bevollmaechtigtName)
			.map((v) => vertreterkennung(v.bevollmaechtigtName!))
	);
}

/**
 * **Die Zeilen zu L8 an einem Beschluss, eine Stelle für das Hausprotokoll
 * und das gemeinsame Abenddokument** (Codeprüfung P11, H1, 08.11.2026). Am
 * gemeinsamen Abend führt das Haus kein eigenes Protokoll; das Abenddokument
 * trug keine dieser Zeilen, und die Zusage der Tag-Leitung «das Protokoll
 * nennt Ihre Angabe» brach dort. Die Bedingungen sind die des Hausprotokolls,
 * sie wurden nur hierher gezogen.
 *
 * - **Wahl trotz Häkchen** (Entscheid 8, 07.11.2026): Das Traktandum trägt
 *   das Häkchen, sein Erfordernis steht auf der Wahl oder Wiederwahl der
 *   Verwaltung, und die eingefrorene Wahl ist die Vorgabe. Das Häkchen ist ab
 *   der Freigabe gesperrt (Entscheid 7), das Erfordernis bleibt stellbar, und
 *   die Zeile liest beides am Traktandum wie die Traktandenliste selbst.
 * - **Abberufung als Folgeantrag** (Entscheid 0045, Punkt 9, 07.11.2026):
 *   dieselbe Lage an der Abberufung. Die Zeile sagt, dass die Einladung nicht
 *   galt und was die Leitung entschied (`abberufungAusstandErklaert`).
 * - **Angabe der Leitung am Folgeantrag** (Entscheid 0045, Punkt 11,
 *   08.11.2026): Sie hat angegeben, dass er eine andere als die bisherige
 *   Verwaltung oder die Kündigung ihres Vertrags betrifft. Die Zeile nennt
 *   den Grund und, wie an der Abberufung, ob die Leitung den Ausstand
 *   trotzdem erklärt hat. Nicht an Wahl und Abberufung: Dort wirkt die
 *   Angabe nicht, und die Zeilen darüber sagen, was galt. Nach dem ersten
 *   Durchgang lässt sich die Angabe nicht mehr ändern, die Spalte ist also
 *   der Stand der Abstimmung.
 *
 * Ob die Leitung den Ausstand erklärt hat, kommt aus dem eingefrorenen
 * Ausstand des geltenden Durchgangs (`ausstand`, `null` ohne Durchgang).
 */
export function l8Zeilenlage(e: {
	knoten:
		| {
				verwaltungsGeschaeft?: boolean;
				spontanart?: string | null;
				erfordernis?: { knotenId?: string | null } | null;
				verwaltungsangabe?: Verwaltungsangabe;
		  }
		| undefined;
	/** Die eingefrorene Wahl zu L8 aus der Momentaufnahme. */
	wahl: string | null | undefined;
	ausstand: readonly string[] | null | undefined;
	verwaltungskennungen: ReadonlySet<string>;
}): L8Zeilenlage {
	const k = e.knoten;
	const ruhen = e.wahl === 'ruhen';
	const ausstandErklaert = (e.ausstand ?? []).some((x) => e.verwaltungskennungen.has(x));
	return {
		wahlTrotzHaekchen:
			k?.verwaltungsGeschaeft === true &&
			!!k.erfordernis?.knotenId &&
			VERWALTUNGSWAHLKNOTEN.has(k.erfordernis.knotenId) &&
			ruhen,
		abberufungTrotzHaekchen:
			k?.verwaltungsGeschaeft === true &&
			k.spontanart === 'folgeantrag' &&
			k.erfordernis?.knotenId === ABBERUFUNGSKNOTEN &&
			ruhen,
		abberufungAusstandErklaert: ausstandErklaert,
		verwaltungsangabe:
			k?.verwaltungsangabe &&
			k.verwaltungsGeschaeft === true &&
			k.spontanart === 'folgeantrag' &&
			!(k.erfordernis?.knotenId && VERWALTUNGSKNOTEN.has(k.erfordernis.knotenId)) &&
			ruhen
				? { grund: k.verwaltungsangabe, ausstandErklaert }
				: null
	};
}

/** Wer den Beschlussvermerk trägt, und wer ihn tragen darf. */
export interface Beschlussvermerklage {
	/** Der Titel des Traktandums — für die Absagen des Setzens. */
	titel: string;
	/** Der Vermerk steht heute an diesem Traktandum. */
	vermerk: boolean;
	/** Die Versammlung ist geschlossen oder versiegelt (Schranke 1). */
	geschlossen: boolean;
	/** Votum führt kein Ergebnis zu ihm (Schranke 2, `ohneErgebnis`). */
	ohneErgebnis: boolean;
	/** Beide Schranken erfüllt: Der Haken darf erscheinen. */
	moeglich: boolean;
}

// Die Abfrage liegt bei der Auswertung, die sie seit Block 7b selbst braucht;
// von hier weitergereicht, damit die bisherigen Aufrufer ihren Ort behalten.
export { holeBeschlussvermerke };

/**
 * Die Lage des Beschlussvermerks je Traktandum.
 *
 * **Die Schranken 1 und 2 des Setzens, an einer Stelle.** Die Versammlung ist
 * geschlossen oder versiegelt, und Votum führt kein Ergebnis (die Bedingung
 * des letzten Zweigs von `protokollentwurf`, `ohneErgebnis`). Schranke 3 (der
 * Votentext ist nicht leer) hängt am Text und wird erst beim Setzen geprüft;
 * die Protokollseite zeigt den Haken auch an einem noch leeren Feld, weil das
 * Feld sich beim Verlassen selbst sichert.
 */
export async function holeBeschlussvermerkLagen(
	operatorId: Id,
	meetingId: Id
): Promise<Map<Id, Beschlussvermerklage>> {
	const [versammlung, auswertung, traktanden, vermerke] = await Promise.all([
		holeVersammlung(operatorId, meetingId),
		holeAuswertung(operatorId, meetingId),
		holeTraktanden(operatorId, meetingId),
		holeBeschlussvermerke(operatorId, meetingId)
	]);
	const geschlossen = versammlung ? abgeschlossen(versammlung.zustand) : false;
	// Dieselbe Stelle wie Hausprotokoll und Abenddokument (Produktentscheid
	// 08.11.2026); bis dahin stand hier eine eigene, gleichwertige Bedingung.
	const folgeantragslage = await holeFolgeantragslagen(operatorId, meetingId, auswertung, traktanden);
	const jeNummer = new Map((auswertung?.zeilen ?? []).map((z) => [z.nummer, z]));

	const lagen = new Map<Id, Beschlussvermerklage>();
	for (const t of traktanden) {
		const z = jeNummer.get(t.nummer);
		const lage = z ? folgeantragslage(z) : null;
		const ohne = z
			? ohneErgebnis({
					art: z.art,
					rueckzug: t.knoten.rueckzug ? rueckzugInWorten(t.knoten.rueckzug) : null,
					satz: z.protokollsatz,
					zahlen: z.auszaehlung,
					ersetzung: z.ersetzung,
					neuabstimmungOffen: z.neuabstimmungOffen,
					folgeantraegeAngenommen: lage!.folgeantraegeAngenommen,
					teileEntschieden: lage!.teileEntschieden
				})
			: false;
		lagen.set(t.knoten.id, {
			titel: t.knoten.titel,
			vermerk: vermerke.has(t.knoten.id),
			geschlossen,
			ohneErgebnis: ohne,
			moeglich: geschlossen && ohne
		});
	}
	return lagen;
}

/**
 * Die Abstimmungen, zu denen Votum kein Ergebnis führt und die keinen
 * Beschlussvermerk tragen: die Titel, in der Reihenfolge der Traktandenliste.
 * Für den Hinweis vor dem Versiegeln (`hinweisVorDemVersiegeln` im Kern).
 *
 * Aus `holeBeschlussvermerkLagen`, also mit derselben Bedingung, unter der die
 * Protokollseite den Haken anbietet: Wer hier genannt wird, findet dort einen.
 * Das gilt nur nach dem Schluss; die Funktion prüft den Zustand nicht selbst,
 * beide Aufrufer (die zwei Siegelseiten) rufen nur für geschlossene
 * Versammlungen.
 *
 * bindung: meetingId — an den Betreiber gebunden in `holeBeschlussvermerkLagen`
 *   (`holeVersammlung`, `holeTraktanden`); eine fremde Kennung ergibt eine
 *   leere Liste.
 */
export async function holeOhneErgebnisUndVermerk(operatorId: Id, meetingId: Id): Promise<string[]> {
	const lagen = await holeBeschlussvermerkLagen(operatorId, meetingId);
	return [...lagen.values()].filter((l) => l.ohneErgebnis && !l.vermerk).map((l) => l.titel);
}

/**
 * Setzt oder nimmt den Beschlussvermerk an einem Traktandum (Block 7).
 *
 * **Vier Schranken, jede mit eigener Absage:** Die Versammlung ist geschlossen
 * oder versiegelt; das Traktandum ist eine Abstimmung ohne Ergebnis und nicht
 * zurückgezogen; das Votenfeld ist nicht leer; das Traktandum gehört zur
 * Versammlung. **Nur die erste und die vierte gelten auch beim Zurücknehmen** —
 * ein Vermerk, dessen Grundlage weggefallen ist, muss sich immer abnehmen
 * lassen.
 */
export async function setzeBeschlussvermerk(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	vermerk: boolean
): Promise<{ titel: string; vermerk: boolean }> {
	/*
	 * **Erst die Lage, dann die Sperre am Traktandum.**
	 *
	 * Der Zustand kann nach dem Schluss höchstens von «geschlossen» auf
	 * «versiegelt» wandern, und beides lässt den Vermerk zu. Der Votentext
	 * dagegen lässt sich jederzeit ändern; er wird darum in der Transaktion
	 * unter der Zeilensperre nochmals geprüft.
	 *
	 * **Das Ergebnis liegt nicht unter der Sperre** (Abnahme 02.10.2026,
	 * gemessen): Eine von Hand gesendete Neuabstimmung ging damals auch nach
	 * dem Schluss durch. Seit dem Nachzug vom 03.10.2026 (Block 1c) weist
	 * `setzeNeuabstimmungAn` sie ab, solange die Versammlung nicht läuft;
	 * gerichtet nach `verlangeVonHandMoeglich`. Die beiden Leitungsseiten
	 * boten sie nach dem Schluss ohnehin nicht an (im Nachzug gelesen:
	 * `schliesseVersammlung` leert das aufgerufene Traktandum, damit fehlt
	 * beiden der laufende Schritt). Damit ist der Wettlauf praktisch zu: Der
	 * Vermerk geht nur nach dem Schluss, die Neuabstimmung nur, solange die
	 * Versammlung läuft. Ganz zu ist er nicht, weil `setzeNeuabstimmungAn` den
	 * Zustand ohne Zeilensperre liest (wie die Nachbarfunktionen); ein Schluss
	 * im selben Augenblick bleibt denkbar. Eine vorher angesetzte, noch offene Neuabstimmung lässt den
	 * Vermerk gar nicht zu (`ohneErgebnis` ist dann falsch, die Absage nennt
	 * sie).
	 */
	const lage = (await holeBeschlussvermerkLagen(handelnder.operatorId, meetingId)).get(traktandumId);
	if (!lage) throw fremdesTraktandum('traktandumId');

	if (!lage.geschlossen) {
		throw new FachlicherFehler(
			'nicht_abgeschlossen',
			'Die Versammlung ist noch nicht geschlossen. Solange sie läuft, halten Sie den Beschluss ' +
				`in der Sitzungsleitung mit «${VON_HAND_TITEL}» fest; Votum führt dann das Ergebnis. ` +
				'Den Haken gibt es erst nach dem Schluss. Laden Sie die Seite neu.',
			'zustand'
		);
	}

	if (vermerk && !lage.ohneErgebnis) {
		throw new FachlicherFehler(
			'hat_ergebnis',
			`Zu «${lage.titel}» führt Votum schon etwas: ein Ergebnis, einen Folgeantrag an seiner ` +
				'Stelle, eine angesetzte Neuabstimmung oder einen Rückzug, oder es ist eine Kenntnisnahme. ' +
				'Der Haken ist nur für Abstimmungen, zu denen Votum nichts führt. Laden Sie die Seite ' +
				'neu. Was dann gilt, steht im Handbuch unter «Wenn die Versammlung schon geschlossen ist».',
			'traktandum'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [t] = await tx<{ title: string; minute_text: string | null; minute_decision: boolean }[]>`
			SELECT title, minute_text, minute_decision FROM agenda_item
			 WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
			 FOR UPDATE
		`;
		if (!t) throw fremdesTraktandum('traktandumId');

		if (vermerk && !t.minute_text?.trim()) {
			throw new FachlicherFehler(
				'leer',
				`Das Votenfeld zu «${t.title}» ist leer. Der Haken sagt, dass der Text dort der Beschluss ` +
					'ist; schreiben Sie zuerst den Beschluss hinein.',
				'notiz'
			);
		}

		if (t.minute_decision === vermerk) return { titel: t.title, vermerk };

		await tx`UPDATE agenda_item SET minute_decision = ${vermerk} WHERE id = ${traktandumId}`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.beschlussvermerkErfasst, { art: 'agenda_item', id: traktandumId }, {
				traktandum: t.title,
				vermerk
			})
		]);
		return { titel: t.title, vermerk };
	});
}

// ── Der Entwurf (FR-48) ─────────────────────────────────────────────────────

/**
 * Trägt zusammen, was das Protokoll braucht, und lässt den Kern den Text setzen.
 *
 * Alles kommt aus derselben Quelle wie die Auswertung — es gibt genau einen
 * Zählweg (AD-2). Ein Protokoll, das anders rechnete als die Auswertung, wäre
 * schlimmer als keines: Zwei Zahlen zum selben Beschluss, und im Streitfall
 * steht Aussage gegen Aussage.
 */
export async function stelleEntwurfZusammen(
	operatorId: Id,
	meetingId: Id,
	erzeugtAm: string,
	erzeugtDurch: string
): Promise<string> {
	const versammlung = await holeVersammlung(operatorId, meetingId);
	if (!versammlung) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');

	const [
		auswertung,
		traktanden,
		notizen,
		gemeinschaft,
		uebersicht,
		regeln,
		vollmachten,
		parteien,
		maschinell,
		betreiber,
		siegel,
		pendenzen,
		ruegen,
		papierabgaben,
		momentaufnahme,
		durchgaenge,
		beschlussvermerke,
		universaleinstellung,
		neueAnZweiter
	] = await Promise.all([
			holeAuswertung(operatorId, meetingId),
			holeTraktanden(operatorId, meetingId),
			holeNotizen(operatorId, meetingId),
			holeGemeinschaft(operatorId, versammlung.stwegId),
			holeUebersicht(operatorId, meetingId),
			holeAnwesenheitsregeln(operatorId, versammlung.stwegId),
			holeVollmachten(operatorId, meetingId),
			holeParteien(operatorId, meetingId),
			maschinellVorbereitet(operatorId, meetingId),
			holeBetreiber(operatorId),
			// Das Siegel für den Abschnitt am Schluss — null, solange nicht
			// versiegelt ist.
			holeSiegel(operatorId, meetingId),
			holePendenzen(operatorId, meetingId),
			holeRuegen(operatorId, meetingId),
			/*
			 * **Wer auf Papier abstimmte** (Migration 108). Hängt von nichts
			 * anderem hier ab und läuft deshalb mit den übrigen, nicht danach:
			 * Vierzehn Abfragen gleichzeitig und eine fünfzehnte hinterher kosten so
			 * viel wie fünfzehn gleichzeitig plus eine Wartezeit.
			 */
			holePapierabgaben(operatorId, meetingId),
			/*
			 * **Der Anwesenheitsstand für die Beschlussfähigkeit am Beschluss**
			 * (Block 5, 01.10.2026). Die Momentaufnahme liefert die Stimmkraft,
			 * die Durchgänge tragen mit `attendance_json` den Stand im Augenblick
			 * des Festhaltens. Die Auswertung lädt beide ebenfalls, reicht sie
			 * aber nicht heraus; die zwei Abfragen sind der schmalere Eingriff
			 * als ein neues Feld an der geteilten Auswertungszeile.
			 */
			holeMomentaufnahme(operatorId, meetingId),
			holeDurchgaenge(operatorId, meetingId),
			/*
			 * **Der Beschlussvermerk** (Block 7): sagt dem letzten Zweig von
			 * `protokollentwurf`, dass der Satz «Über diesen Antrag wurde
			 * nicht abgestimmt.» nicht hingehört.
			 */
			holeBeschlussvermerke(operatorId, meetingId),
			/*
			 * **Wer an einer Universalversammlung als da gilt** (Ä-17), aus der
			 * Momentaufnahme, für die Rechtsfolge im Fristvermerk.
			 */
			alsBetreiber(operatorId, (tx) => leseEinstellungIn(tx, meetingId)),
			// Ä-17 B: neue Traktanden an einer zweiten Versammlung.
			holeNeueTraktandenDerZweiten(operatorId, meetingId)
		]);

	/*
	 * Die festgehaltenen Feststellungen (Migration 080) — älteste zuerst. Die
	 * erste trägt den Kopf des Protokolls, die weiteren stehen im Ablauf.
	 */
	const feststellungen = await holeFeststellungen(operatorId, meetingId);
	const erste = feststellungen[0] ?? null;

	const beschlussfaehigkeit =
		uebersicht &&
		stelleBeschlussfaehigkeitFest(
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

	/*
	 * **Die Stimmkraft und die eingefrorenen Anwesenheitsstände** für die
	 * Beschlussfähigkeit am Beschluss (Block 5, 01.10.2026). Gerechnet wird je
	 * Durchgang aus `attendance_json.anwesende`, dem Stand im Augenblick des
	 * Festhaltens (AD-16), und nicht aus dem heutigen Anwesenheitsstand oder
	 * aus dem Verlauf. `null` bei einem Durchgang, der keinen Stand trägt: Dann
	 * bleibt der Satz am Beschluss weg; bei einem von Hand festgehaltenen
	 * Beschluss schreibt die Anwendung den Stand immer.
	 *
	 * **Eingefroren sind nur die Anwesenden, nicht die Regel** (Codeprüfung
	 * 01.10.2026): Die Anwesenheitsregel der Gemeinschaft wird heute gelesen,
	 * wie bei der Feststellung im Kopf. Ändert die Gemeinschaft sie nach der
	 * Versammlung, kann ein neu erzeugter Entwurf den Satz gewinnen oder
	 * verlieren; eine festgehaltene Fassung trägt ihren Text und bleibt.
	 */
	const stimmkraft = momentaufnahme ? stimmkraftliste(momentaufnahme) : null;
	const anwesendeJeDurchgang = new Map(durchgaenge.map((d) => [d.id, d.anwesende]));
	// L7 (Migration 183): Die Beteiligung ohne die Personen im Ausstand rechnet
	// je Beschluss aus dem eingefrorenen `attendance_json` desselben Durchgangs.
	const vertretungenJeDurchgang = new Map(durchgaenge.map((d) => [d.id, d.vertretungen]));
	const ausstandJeDurchgang = new Map(durchgaenge.map((d) => [d.id, d.ausstand]));

	// Wer wen vertritt — dieselbe Zuordnung wie auf der Anwesenheitsseite.
	const vu = vollmachtsuebersicht(vollmachten);
	const jeParteiId = new Map(parteien.map((p) => [p.id, p.parteiId]));
	const vertretenDurch = new Map<string, string>();
	const bevollmaechtigtFuer = new Map<string, string[]>();
	for (const [snapshotId, v] of vu.wirksamJeVertretene) {
		const parteiId = jeParteiId.get(snapshotId);
		if (parteiId && v.bevollmaechtigtName) {
			// **Der Grund steht dabei, wenn es einer ist** (Ä-28). Wer über der
			// Höchstzahl des Reglements vertrat, soll im Anfechtungsfall im
			// Protokoll belegen können, warum das zulässig war — «vertreten durch
			// X» allein liesse die Frage offen.
			// Seit dem 03.11.2026 mit dem Vermerk «nicht als Mitberechtigte
			// eingetragen», wo ein Nachweis die Mitberechtigung trägt.
			const grund = vertretungsgrundInWorten(v);
			vertretenDurch.set(
				parteiId,
				grund ? `${v.bevollmaechtigtName} (${grund})` : v.bevollmaechtigtName
			);
		}
	}
	for (const [snapshotId, liste] of vu.wirksamJeBevollmaechtigt) {
		const parteiId = jeParteiId.get(snapshotId);
		// **Der Grund steht auf beiden Zeilen** (Code-Review vom 24.09.2026, B11).
		// Ohne ihn stünde an der vertretenden Partei eine Zahl von Vertretungen
		// über der Höchstzahl des Reglements, und daneben keine Erklärung.
		if (parteiId)
			bevollmaechtigtFuer.set(
				parteiId,
				liste.map((v) => {
					const grund = vertretungsgrundInWorten(v);
					return grund ? `${v.vertreteneName} (${grund})` : v.vertreteneName;
				})
			);
	}

	/*
	 * **Vollmachten, die nur einen Teil des Abends galten** (Ä-09): gemessen an
	 * den geschlossenen Durchgängen, Regel bei `vertretungszeitraeume`.
	 */
	const nummerJeTraktandum = new Map(traktanden.map((t) => [t.knoten.id, t.nummer] as const));
	/*
	 * Gezählt wird nur ein Durchgang, der einen Beschluss trug (Codeprüfung
	 * 16.10.2026, M1): der geltende, und der überholte nur, wenn ein späterer
	 * Beschluss ihn ersetzt hat (Rückkommen, zweiter Durchgang nach Eintritt der
	 * Beschlussfähigkeit). Korrektur, Neueröffnung nach Weggang, erfolgloses
	 * Rückkommen und Notweg liessen keinen Beschluss zurück (Migration 139,
	 * Kommentar zu `supersede_kind`).
	 */
	const trugBeschluss = (d: Durchgangsstand) =>
		!d.ueberholtAm || d.ueberholungsart === 'rueckkommen' || d.ueberholungsart === 'nachquorum';
	// In den Kennungen der Parteien, wie `attendance_json.anwesende` sie führt.
	const zeitraeume: Map<string, Vertretungszeitraum[]> = vertretungszeitraeume(
		vollmachten.flatMap((v) => {
			const parteiId = jeParteiId.get(v.vertreteneId);
			return parteiId ? [{ ...v, vertreteneId: parteiId }] : [];
		}),
		durchgaenge.filter(trugBeschluss).flatMap((d) => {
			const nummer = nummerJeTraktandum.get(d.traktandumId);
			return d.geschlossenAm && nummer
				? [{ geschlossenAm: d.geschlossenAm, anwesende: d.anwesende, traktandum: nummer }]
				: [];
		})
	);

	const teilnehmer = (uebersicht?.staende ?? []).map((s) => ({
		name: s.name,
		einheiten: s.einheiten,
		zustand: s.zustand,
		vertretenDurch: vertretenDurch.get(s.parteiId) ?? null,
		bevollmaechtigtFuer: bevollmaechtigtFuer.get(s.parteiId) ?? [],
		vertretungszeitraeume: zeitraeume.get(s.parteiId) ?? []
	}));

	/*
	 * **Wer auf Papier abstimmte** (Migration 108). Derselbe Leseweg, den die
	 * Anwesenheitssicht und der Eingang benutzen; zweimal gerechnet liefe es
	 * auseinander, und dann stünde im Protokoll eine andere Liste als am
	 * Bildschirm.
	 *
	 * **In der Reihenfolge der Anwesenheitsliste**, nicht in der der Vermerke.
	 * Wer die beiden Listen nebeneinanderlegt, soll sie mit dem Finger
	 * vergleichen können; die Reihenfolge des Eintreffens am Eingang sagt hier
	 * nichts.
	 */
	const papierparteien = new Set(papierabgaben.map((p) => p.parteiId));
	/*
	 * **Nur eingelassene Parteien** (10.09.2026, im Sicherheitsdurchgang als
	 * Randpunkt genannt). Der Vermerk setzt die Anwesenheit nicht voraus: Er wird
	 * am Eingang gesetzt, aber `papierNachtragen` schreibt ihn ohne
	 * Anwesenheitsereignis. Eine nie eingelassene Partei unter «Auf Papier
	 * abgestimmt haben» wäre eine falsche Aussage in einem Dokument, das
	 * unterschrieben wird.
	 */
	const aufPapier = (uebersicht?.staende ?? [])
		.filter(
			(s) =>
				papierparteien.has(s.parteiId) &&
				(s.zustand === 'anwesend' || s.zustand === 'gegangen')
		)
		.map((s) => s.name);

	const jeTraktandum = new Map(traktanden.map((t) => [t.nummer, t]));

	/*
	 * Die stellvertretend erfassten Stimmen — in **einer** Abfrage für alle
	 * Durchgänge. Je Traktandum einzeln zu fragen hiesse, bei vierzehn Traktanden
	 * vierzehnmal an die Datenbank zu gehen, um meistens nichts zu bekommen.
	 */
	const stellvertretend = await holeStellvertretendeStimmen(
		operatorId,
		(auswertung?.zeilen ?? []).map((z) => z.durchgangId).filter((id): id is string => Boolean(id))
	);

	/*
	 * **Welcher Antrag durch einen angenommenen Gegenantrag gegenstandslos ist.**
	 *
	 * Gefragt am 21.08.2026. Gerechnet wird es hier und nicht gespeichert: Ob ein
	 * Folgeantrag angenommen wurde, steht in seiner Auszählung, und ein zweites
	 * Mal abgelegt liefe es ihr davon. Seit Block 7 als eigene Funktion, weil
	 * die Prüfung des Beschlussvermerks dieselbe Zuordnung braucht. Seit der
	 * Featureprüfung 2 zu F4c (M1) mit dem gesperrten Grundantrag an einer
	 * Stelle mit dem gemeinsamen Abenddokument (`holeFolgeantragslagen`).
	 */
	const folgeantragslage = await holeFolgeantragslagen(operatorId, meetingId, auswertung, traktanden);
	// Fachprüfung Runde 5, R5-3: an der Abberufung, ob die Leitung den
	// Ausstand der Verwaltung erklärt hat. Die Kennungen ihrer Vollmachten wie
	// in der Zählung (`vertreterkennung`).
	const verwaltungskennungen = verwaltungskennungenAus(vollmachten);

	// Wer vor einem Punkt mit kleinerer Nummer behandelt wurde. Gerechnet aus der
	// Liste, wie sie am Abend stand — die Nummer selbst stammt aus der Einladung.
	const vorgezogen = vorgezogene(traktanden);

	/*
	 * **Der zweite Durchgang nach Eintritt der Beschlussfähigkeit**
	 * (Migration 139, `domain/neuabstimmung.ts`): Die Erkennung steht in
	 * `nachQuorumLage` und wird mit dem Abendprotokoll geteilt.
	 *
	 * Je Traktandum vorab gerechnet, nicht im synchronen `map` darunter: Für
	 * den gescheiterten zweiten Durchgang wird dessen festgeschriebene
	 * Auszählung gelesen.
	 */
	const nachQuorumJeTraktandum = new Map<string, Protokollzeile['nachQuorum']>();
	for (const z of auswertung?.zeilen ?? []) {
		const t = jeTraktandum.get(z.nummer);
		if (!t) continue;
		nachQuorumJeTraktandum.set(
			t.knoten.id,
			await nachQuorumLage({
				operatorId,
				meetingId,
				traktandumId: t.knoten.id,
				geltenderId: z.durchgangId ?? null,
				durchgaenge,
				stimmkraft,
				stufe: versammlung.stufe,
				regel: regeln[versammlung.stufe] ?? null
			})
		);
	}

	const zeilen: Protokollzeile[] = (auswertung?.zeilen ?? []).map((z) => {
		const t = jeTraktandum.get(z.nummer);
		/*
		 * L7 (Migration 183): Dieselbe Stufe, nach der das Eröffnen prüft
		 * (auch L5): An einem neuen Traktandum an der zweiten Versammlung, das
		 * nach der Vorgabe von L5 die Beschlussfähigkeit einer ersten verlangt,
		 * hängt auch der Satz zu L7 an der ersten Stufe.
		 */
		const stufeFuerL7 =
			t && momentaufnahme?.lesarten?.L5 === 'erste' && neueAnZweiter.has(t.knoten.id)
				? ('erste' as const)
				: versammlung.stufe;
		return {
			vorgezogen: t ? vorgezogen.has(t.knoten.id) : false,
			// Ein Satz aus den Namen der Tabelle — «Aebi, Bucher & Christen». Der
			// freie Name («Arbeitsgruppe Umgebung») gilt, wo es keine Parteien gibt.
			antragsteller:
				namenSatz(t?.knoten.antragstellerNamen ?? []) || (t?.knoten.antragstellerName ?? null),
			/*
			 * Nur wo es auch etwas zu erklären gibt: Wurde über den Antrag selbst
			 * abgestimmt, braucht das Protokoll keinen Hinweis auf den Gegenantrag —
			 * dann steht dort ein Ergebnis.
			 */
			// Nicht nach einem Rückkommen über einen Folgeantrag: Dann wurde über den
			// Antrag abgestimmt, und `ersetzung` sagt, was daraus wurde (Soll 6).
			folgeantraegeAngenommen: folgeantragslage(z).folgeantraegeAngenommen,
			ersetzung: z.ersetzung ?? null,
			nummer: z.nummer,
			tiefe: z.tiefe,
			titel: z.titel,
			art: z.art,
			antragswortlaut: t?.knoten.antragswortlaut ?? null,
			kurzfassung: t?.knoten.kurzfassung ?? null,
			notiz: t ? (notizen.get(t.knoten.id) ?? null) : null,
			/*
			 * **Der Beschlussvermerk** (Block 7): Der Text im Votenfeld ist der
			 * Beschluss, den Votum nicht führt. Der letzte Zweig von
			 * `protokollentwurf` schreibt darum «Über diesen Antrag wurde nicht
			 * abgestimmt.» nicht. Ein Traktandum ohne Zeile in der Auswertung
			 * kann keinen tragen; `false` ist dort die richtige Antwort.
			 */
			beschlussvermerk: t ? beschlussvermerke.has(t.knoten.id) : false,
			erfordernis: z.erfordernis,
			fall: z.fall,
			mehrheitGesetzt: z.mehrheitGesetzt,
			vorgaenge: z.vorgaenge,
			rechtsgrundlage: z.rechtsgrundlage,
			regelfassung: z.regelfassung,
			lesart: z.lesart ?? null,
			// Nicht neben einer konsultativen Abstimmung: Ihre Wertung nennt den Grund
			// selbst (Codeprüfung Block 7, R3-N3).
			neuAnZweiterVersammlung:
				t && z.auszaehlung?.keinBeschluss?.grund !== 'konsultativ' ? neueAnZweiter.has(t.knoten.id) : false,
			// L5 aus der Momentaufnahme (Migration 174; F3).
			// Ohne Beschluss (Widerspruch, Weggang) nur die Tatsache (Review DeepSeek
			// zu Block 7, Befund 1).
			neuAnZweiterWahl: z.auszaehlung?.keinBeschluss ? null : (momentaufnahme?.lesarten?.L5 ?? null),
			// A5, Punkt 8: die Regel des Reglements für die zweite Versammlung.
			neuAnZweiterRegel: regeln.zweite ?? null,
			anfechtungssonderfall: z.anfechtungssonderfall,
			neuAnZweiterErsteFehlte:
				// Für beide Wahlen; den Anfechtungssatz nur nach der Vorgabe (H2).
				t && momentaufnahme?.lesarten?.L5 && neueAnZweiter.has(t.knoten.id)
					? ersteFehlteAmBeschluss({
							stimmkraft,
							anwesende: z.durchgangId ? anwesendeJeDurchgang.get(z.durchgangId) : null,
							regelErste: regeln.erste ?? null,
							auszaehlung: z.auszaehlung
						})
					: null,
			// Nur der Grund: Der Satz im Entwurf sagt «zurückgezogen» schon selbst,
			// mit `rueckzugInWorten` stand «zurückgezogen: Zurückgezogen: …» da
			// (gefunden in H7, Teil D).
			rueckzug: t?.knoten.rueckzug ? t.knoten.rueckzug.grund : null,
			// Die Wertung ohne Zahlen; der Spiegel darunter trägt sie vollständig.
			satz: z.protokollsatz,
			beschlusstext: z.beschlusstext ?? null,
			pendenzen: t ? nurAngaben(pendenzen.get(t.knoten.id)) : [],
			ruegen: t ? ruegeangaben(ruegen.get(t.knoten.id)) : [],
			/*
			 * **Geheim: kein Zahlenspiegel** (Produktentscheid 28.09.2026). Der
			 * Satz darüber nennt nur erreicht/nicht erreicht; die Zahlen bleiben
			 * in der Datenbank und im versiegelten Abschlusspaket.
			 */
			zahlen:
				z.auszaehlung && !z.auszaehlung.geheim
					? {
							koepfe: protokollspiegel(z.auszaehlung.koepfe),
							quoten: protokollspiegel(z.auszaehlung.quoten)
						}
					: null,
			geheim: z.auszaehlung?.geheim === true,
			geheimBeschlossen: z.geheimBeschlossen === true,
			geheimNachReglement: z.geheimNachReglement === true,
			...(z.auszaehlung?.beklagtenwohnungen
				? { beklagtenwohnungen: z.auszaehlung.beklagtenwohnungen }
				: {}),
			/*
			 * **Fehlt das Merkmal, sind die Quoten erhoben.** So bleiben Auswertungen
			 * richtig, die vor der Handzählung entstanden sind — nur `false` ist eine
			 * Aussage, `undefined` ist keine.
			 */
			quotenErhoben: z.auszaehlung?.quotenErhoben !== false,
			ausstandswirkung: z.auszaehlung?.ausstandswirkung ?? null,
			/*
			 * Die Vermerke fürs Protokoll, aus der Auszählung. Alte festgeschriebene
			 * Ergebnisse tragen das Feld nicht; dann bleibt die Liste leer, und das
			 * Protokoll zeigt wie bisher nur Ausgang und Zahlen.
			 */
			protokollhinweise: z.auszaehlung?.protokollhinweise ?? [],
			handzaehlung: z.handzaehlung ? { vermerk: z.handzaehlung.vermerk } : null,
			vonHand: z.auszaehlung?.vonHand !== undefined,
			einwand: z.auszaehlung?.vonHand?.einwand?.bestimmung ?? null,
			einwandEinfuehrung: z.auszaehlung?.vonHand?.einwand?.einfuehrung ?? null,
			einwandNotwendig: z.auszaehlung?.vonHand?.einwand?.knotenId === NOTWENDIGE_MASSNAHME_KNOTEN,
			/*
			 * Die Tatsache, nicht der Weg (Produktentscheid 01.10.2026): War die
			 * Versammlung beim Festhalten nicht beschlussfähig, nennt das
			 * Protokoll es am Beschluss. Quelle ist der eingefrorene Stand des
			 * Durchgangs; gerechnet wird mit derselben Kernfunktion wie beim
			 * Eröffnen (`stelleBeschlussfaehigkeitFest`), nicht aus dem Eintrag
			 * des Beschlusses von Hand. Die Grundlage geht mit, damit der Satz
			 * die Regel nennt, an der es fehlte.
			 *
			 * Die Rechnung steht im Kern (`beschlussfaehigkeitFehlteAmBeschluss`);
			 * das gemeinsame Protokoll des Abends ruft dieselbe (Block 6).
			 */
			beschlussfaehigkeitFehlte: beschlussfaehigkeitFehlteAmBeschluss({
				stimmkraft,
				anwesende: z.durchgangId ? anwesendeJeDurchgang.get(z.durchgangId) : null,
				stufe: versammlung.stufe,
				regel: regeln[versammlung.stufe] ?? null,
				auszaehlung: z.auszaehlung
			}),
			/*
			 * **L7, die Vorgabe am Beschluss** (Migration 183): Hing die
			 * Beschlussfähigkeit an den Personen im Ausstand, steht die
			 * Tatsache am Beschluss, je eingefrorener Wahl; unter «Zählt nicht
			 * mit» ein Beschluss, der von Hand an der Sperre vorbei steht.
			 */
			ohneAusstandFehlte:
				z.durchgangId
					? ausstandFehlteAmBeschluss({
							wahl: momentaufnahme?.lesarten?.L7,
							stimmkraft,
							anwesende: anwesendeJeDurchgang.get(z.durchgangId) ?? null,
							vertretungen: vertretungenJeDurchgang.get(z.durchgangId) ?? [],
							ausstand: ausstandJeDurchgang.get(z.durchgangId) ?? null,
							stufe: stufeFuerL7,
							regel: regeln[stufeFuerL7] ?? null,
							auszaehlung: z.auszaehlung
						})
					: null,
			/*
			 * **L8 am Beschluss**: Wahl und Abberufung trotz Häkchen, die
			 * Angabe der Leitung am Folgeantrag. Bedingungen und Begründung an
			 * `l8Zeilenlage`, derselben Stelle wie im gemeinsamen
			 * Abenddokument (Codeprüfung P11, H1).
			 */
			...l8Zeilenlage({
				knoten: t?.knoten,
				wahl: momentaufnahme?.lesarten?.L8,
				ausstand: z.durchgangId ? (ausstandJeDurchgang.get(z.durchgangId) ?? []) : null,
				verwaltungskennungen
			}),
			teileEntschieden: folgeantragslage(z).teileEntschieden,
			/*
			 * Nur die fehlenden Zustimmungen, nicht die ganze Liste der
			 * Nichtzustimmenden: Namentlich gehört ins Protokoll allein, wessen
			 * Zustimmung das Gesetz verlangt (ZGB Art. 712g Abs. 4, NFR-17).
			 *
			 * **Und nur, wo sie verlangt war** (28.08.2026, aus dem
			 * Sicherheitsdurchgang). `betroffene.fehlend` hat eine Schreibstelle
			 * ohne diese Bedingung: Eine als betroffen bezeichnete Partei, die
			 * nicht im Stimmberechtigtenstand steht, landet dort auch dann, wenn
			 * das angewandte Erfordernis gar keine Zustimmung Betroffener
			 * verlangt. `erfuellt` bleibt in dem Fall wahr, der Antrag ist
			 * angenommen — und das Protokoll behauptete daneben eine fehlende
			 * gesetzliche Zustimmung, die niemand gebraucht hat.
			 */
			ohneZustimmung: zustimmungBetroffenerGefragt(z.auszaehlung)
				? z.auszaehlung!.betroffene.fehlend.map((f) => f.name)
				: [],
			/*
			 * **Je Form** (Block A3a, 26.09.2026): Bei den Wertquoten steht die
			 * Zustimmung aus, bei den Nutzungsrechten nennt das Protokoll die
			 * gezählten Vorab-Zustimmungen mit ihrem Vermerk. Nur wo sie verlangt
			 * war, aus demselben Grund wie bei `ohneZustimmung`.
			 */
			zustimmungsform: zustimmungBetroffenerGefragt(z.auszaehlung)
				? (z.auszaehlung!.betroffene.form ?? null)
				: null,
			vorabZugestimmt: zustimmungBetroffenerGefragt(z.auszaehlung)
				? (z.vorab ?? [])
						.filter((v) => z.auszaehlung!.betroffene.vorab.includes(v.parteiId))
						.map((v) => `${v.name} (laut Sitzungsleitung: ${v.vermerk})`)
				: [],
			// Nur bei angenommenem Beschluss: Scheitert die Genehmigung, steht keine
			// Unterschrift aus (Codeprüfung A3a, B1; so auch der Ergebnissatz).
			ausstehend:
				zustimmungBetroffenerGefragt(z.auszaehlung) && z.auszaehlung!.angenommen
					? z.auszaehlung!.betroffene.ausstehend.map((a) => a.name)
					: [],
			/*
			 * **Die Nutzniesser daneben** (Produktentscheid 03.11.2026): aus der
			 * Momentaufnahme, die die am Versammlungstag gültige Nutzniessung mit
			 * der Freigabe einfriert, für dieselben Parteien wie `ausstehend`.
			 */
			ausstehendNutzniessung:
				z.auszaehlung?.betroffene.noetig && z.auszaehlung.angenommen
					? nutzniessungenDerBetroffenen(
							momentaufnahme?.parties ?? [],
							z.auszaehlung.betroffene.ausstehend.map((a) => a.parteiId)
						).map((n) => `${n.nutzniesser} (${n.einheit})`)
					: [],
			/*
			 * **Der Nachweis der Zustimmung im Ausstand** (26.09.2026): Wer im
			 * Ausstand ist, stimmt nicht mit. Trägt der Beschluss trotzdem,
			 * nennt diese Zeile die Veto-Entscheide mit ihrem Weg. Die fehlenden
			 * Zustimmungen stehen daneben in `ohneZustimmung`.
			 */
			// Konsultativ ohne die Zeilen zur Zustimmung (Schritt F2, wie
			// `zustimmungBetroffenerGefragt`); sonst wie bisher auch ohne `noetig`.
			veto: (z.auszaehlung?.keinBeschluss?.grund === 'konsultativ'
				? []
				: (z.auszaehlung?.betroffene.veto ?? [])
			).map(
				(v) =>
					`${v.name} (${vetoWegInWorten(v)}) ` +
					`${v.entscheid === 'ja' ? 'zugestimmt' : 'nicht zugestimmt'}`
			),
			durchgang: z.durchgang,
			frueherenDurchgaenge: z.frueherenDurchgaenge,
			nachQuorum: t ? (nachQuorumJeTraktandum.get(t.knoten.id) ?? null) : null,
			nachWeggang: z.nachWeggang ?? [],
			konsultativFrueher: (z.konsultativFrueher ?? []).map((k) => ({
				nummer: k.nummer,
				neuAnZweiter: k.neuAnZweiter === true,
				zahlen: k.zahlen
					? {
							koepfe: protokollspiegel(k.zahlen.koepfe),
							quoten: k.zahlen.quoten ? protokollspiegel(k.zahlen.quoten) : null
						}
					: null
			})),
			neuabstimmungOffen: z.neuabstimmungOffen ?? null,
			neuabstimmungen: z.neuabstimmungen ?? [],
			neuabstimmungNachRueckkommen: z.neuabstimmungNachRueckkommen ?? null,
			frueherenDurchRueckkommen: z.frueherenDurchRueckkommen ?? 0,
			ersetztNachRueckkommen: z.ersetztNachRueckkommen ?? [],
			rueckkommenOhneDurchgang: z.rueckkommenOhneDurchgang ?? null,
			rueckkommenStichentscheidOffen: z.rueckkommenStichentscheidOffen ?? false,
			rueckkommenNichtGenutzt: z.rueckkommenNichtGenutzt ?? null,
			rueckkommenErfolglos: z.rueckkommenErfolglos ?? false,
			stichentscheid: z.stichentscheid
				? {
						wer: z.stichentscheid.wer,
						wahl: z.stichentscheid.wahl,
						begruendung: z.stichentscheid.begruendung ?? null,
						...(z.stichentscheid.eigentuemer ? { eigentuemer: true } : {})
					}
				: null,
			stellvertretend: z.durchgangId ? (stellvertretend.get(z.durchgangId) ?? []) : [],
			spontan: z.spontan,
			ausnahmeVermerk: z.ausnahmeVermerk ?? null
		};
	});

	// Der Schluss steht im Ereignis, nicht in einer eigenen Spalte: Er ist der
	// Zeitpunkt, zu dem die Versammlung geschlossen wurde.
	const schlusszeit = versammlung.geschlossenAm
		? new Date(versammlung.geschlossenAm).toLocaleTimeString('de-CH', {
				timeZone: 'Europe/Zurich',
				hour: '2-digit',
				minute: '2-digit'
			})
		: null;

	const eingabe: Protokolleingabe = {
		gemeinschaft: gemeinschaft?.name ?? '',
		datum: versammlung.datum,
		uhrzeit: versammlung.uhrzeit,
		ort: versammlung.ort,
		art: versammlung.art,
		stufe: versammlung.stufe,
		fristvermerk: versammlung.fristvermerk ?? null,
		universaleinstellung,
		schlusszeit,
		sitzungsleitung: versammlung.sitzungsleitung ?? null,
		protokollfuehrung: versammlung.protokollfuehrung ?? null,
		/*
		 * **Die festgehaltene Feststellung geht vor** (Migration 080).
		 *
		 * `beschlussfaehigkeit` oben ist eine Rechnung aus dem Anwesenheitsstand
		 * im Moment der Protokollerstellung. Sie stand hier bis zum 24.08.2026
		 * allein — und veränderte sich mit jedem, der ging. Gibt es eine
		 * festgehaltene Feststellung, gilt die erste: Sie ist der Befund zu Beginn
		 * der Versammlung, und an ihr hängen die Beschlüsse.
		 */
		beschlussfaehigkeit: erste
			? {
					beschlussfaehig: erste.beschlussfaehig,
					satz: feststellungssatz(erste, uebersicht?.einzigeParteiGemeinsam),
					kopfstimmenAnwesend: erste.kopfstimmenAnwesend,
					kopfstimmenGesamt: erste.kopfstimmenGesamt,
					// Null bei Feststellungen von vor dem 26.08.2026 — der Satz lässt sie
					// dann weg, statt eine Zahl zu erfinden.
					eigentuemerAnwesend: erste.eigentuemerAnwesend,
					eigentuemerGesamt: erste.eigentuemerGesamt,
					quotenAnwesend: erste.quotenAnwesend,
					gesamtquote: erste.gesamtquote,
					festgehalten: { zeitpunkt: uhrzeit(erste.zeitpunkt.toISOString()), durch: erste.durch }
				}
			: beschlussfaehigkeit
			? {
					festgehalten: null,
					beschlussfaehig: beschlussfaehigkeit.beschlussfaehig,
					// Der Satz wird hier gebildet und nicht im Kern: Die Feststellung
					// kennt ihre Bedingungen, aber nicht die Sprache des Protokolls.
					satz: beschlussfaehigkeit.beschlussfaehig
						? `Die Versammlung ist beschlussfähig${
								beschlussfaehigkeit.grundlage === 'reglement' && beschlussfaehigkeit.fundstelle
									? // `mitQuelle`: «(Art. 18)» allein liesse den Leser im ZGB
										// suchen — dieselbe Behandlung wie in der Einladung, sonst
										// sagen zwei gesiegelte Dokumente dasselbe verschieden.
										` (${mitQuelle(beschlussfaehigkeit.fundstelle)})`
									: // Bei einem einzigen Eigentümer ohne «(ZGB 712p)», wie
										// `feststellungssatz` (Ä-17 A; Codeprüfung 3d, M1).
										beschlussfaehigkeit.einzigerEigentuemer
										? ''
										: ' (ZGB 712p)'
							}.${beschlussfaehigkeit.einzigerEigentuemer ? ` ${satzZumEinzigen(beschlussfaehigkeit.einzigerGemeinsam, true)}` : ''}`
						: `Die Versammlung ist nicht beschlussfähig: ${beschlussfaehigkeit.fehlt}`,
					kopfstimmenAnwesend: uebersicht!.kopfstimmenAnwesend,
					kopfstimmenGesamt: uebersicht!.kopfstimmenGesamt,
					eigentuemerAnwesend: uebersicht!.eigentuemerAnwesend,
					eigentuemerGesamt: uebersicht!.eigentuemerGesamt,
					quotenAnwesend: uebersicht!.quotenAnwesend,
					gesamtquote: uebersicht!.gesamtquote
				}
			: null,
		/** Alles nach der ersten — sie stehen im Ablauf, nicht im Kopf. */
		weitereFeststellungen: feststellungen.slice(1).map((f) => ({
			zeitpunkt: uhrzeit(f.zeitpunkt.toISOString()),
			durch: f.durch,
			satz: feststellungssatz(f, uebersicht?.einzigeParteiGemeinsam),
			kopfstimmenAnwesend: f.kopfstimmenAnwesend,
			kopfstimmenGesamt: f.kopfstimmenGesamt,
			quotenAnwesend: f.quotenAnwesend,
			gesamtquote: f.gesamtquote
		})),
		zaehlweise: auswertung?.zaehlweise ?? null,
		stichentscheid: auswertung?.stichentscheid ?? null,
		// Die Einheit der Wertquoten je Beschluss (Ä-09), aus dem eingefrorenen Nenner.
		quotennenner: momentaufnahme?.totalQuota ?? null,
		aufPapier,
		teilnehmer,
		zeilen,
		/**
		 * Die Unterbrechungen des Abends — sie stehen im Ablauf, nicht unter einem
		 * Geschäft (22.08.2026, Befund D-02).
		 */
		unterbrechungen: auswertung?.unterbrechungen ?? [],
		erzeugtAm,
		erzeugtDurch,
		// FR-63: Im Protokoll wird ausgewiesen, dass Absätze maschinell
		// vorbereitet und von einem Menschen verantwortet wurden.
		// Abschaltbar am Betreiber: Der Vermerk steht in einem Dokument, das an
		// alle Eigentümer geht. Der Nachweis in `ai_usage` bleibt davon unberührt —
		// sonst wäre es kein Schalter, sondern ein Radiergummi.
		maschinenvermerk:
			maschinell && betreiber?.maschinenvermerkImProtokoll !== false
				? maschinenvermerk(maschinell.anbieter, maschinell.wer)
				: null,
		/*
		 * **Das Siegel, wenn es schon besteht** (22.08.2026).
		 *
		 * Damit es hineinkommt, muss versiegelt sein, bevor der Entwurf entsteht —
		 * die umgekehrte Reihenfolge von früher. Das ist auch sachlich richtig
		 * herum: Das Paket beschreibt die Versammlung, das Protokoll den Text
		 * darüber. Fehlt das Siegel, steht der Abschnitt nicht da; ein leeres Feld
		 * wäre schlechter als keines.
		 */
		siegel: siegel
			? {
					abdruck: siegel.siegel,
					bezeugtAm:
						siegel.zeitstempel === 'vorhanden' && siegel.zeitstempelAm
							? zeitpunktLang(siegel.zeitstempelAm)
							: null,
					stelle: siegel.zeitstempelStelle,
					bezeugungAbdruck: siegel.zeitstempelAbdruck ?? null
				}
			: null
	};

	return protokollentwurf(eingabe);
}

// ── Die Arbeitsfassung (FR-49) ──────────────────────────────────────────────

export interface Protokoll {
	body: string;
	erzeugtAm: Zeitpunkt;
	geaendertAm: Zeitpunkt;
	geaendertDurch: string | null;
}

export async function holeProtokoll(operatorId: Id, meetingId: Id): Promise<Protokoll | null> {
	return alsBetreiber(operatorId, async (tx) => leseProtokoll(tx, meetingId));
}

async function leseProtokoll(
	tx: postgres.TransactionSql,
	meetingId: Id,
	/**
	 * Zeile sperren, weil zwischen Lesen und Schreiben die Konfliktprüfung liegt.
	 *
	 * Ohne Sperre lesen zwei gleichzeitige Vorgänge denselben Stand, beide finden
	 * nichts Veraltetes, und der zweite überschreibt den ersten still — genau die
	 * Überschreibung, gegen die die Prüfung gebaut ist. Nur der Schreibweg
	 * braucht das; die Leseseite soll niemanden aufhalten.
	 */
	sperren = false
): Promise<Protokoll | null> {
	const [z] = await tx<
		{ body: string; created_at: Date; updated_at: Date; updated_by_label: string | null }[]
	>`SELECT body, created_at, updated_at, updated_by_label FROM minutes
	  WHERE meeting_id = ${meetingId} ${sperren ? tx`FOR UPDATE` : tx``}`;
	return z
		? {
				body: z.body,
				erzeugtAm: z.created_at.toISOString(),
				geaendertAm: z.updated_at.toISOString(),
				geaendertDurch: z.updated_by_label
			}
		: null;
}

/**
 * Erzeugt den Entwurf und legt ihn als Arbeitsfassung ab.
 *
 * **Ein bestehendes Protokoll wird nicht überschrieben.** Wer den Entwurf ein
 * zweites Mal erzeugte, verlöre die Überarbeitung — und zwar lautlos. Wer ihn
 * wirklich neu will, hält die bisherige Fassung fest und erzeugt dann neu.
 */
export async function erzeugeProtokollentwurf(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	erzeugtAm: string
): Promise<Protokoll> {
	const text = await stelleEntwurfZusammen(
		handelnder.operatorId,
		meetingId,
		erzeugtAm,
		handelnder.label ?? ''
	);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const bestehend = await leseProtokoll(tx, meetingId);
		if (bestehend) {
			/*
			 * **Festgehalten heisst: darf neu erzeugt werden** (berichtigt am
			 * 22.08.2026).
			 *
			 * Die Absage lautete «Halten Sie die bisherige Fassung fest, bevor Sie
			 * neu erzeugen» — und griff danach genauso. Eine Anleitung, die ins
			 * Leere führt: Wer ihr folgte, stand vor derselben Meldung, ohne den
			 * Grund zu sehen. Gefunden, als der Durchlauf nach dem Versiegeln einen
			 * frischen Entwurf brauchte.
			 *
			 * Der Zweck der Sperre ist im Satz selbst genannt — «sonst ginge die
			 * Überarbeitung verloren». Ist der jetzige Wortlaut als Fassung
			 * abgelegt, geht nichts verloren, und die Sperre hat keinen Gegenstand
			 * mehr.
			 *
			 * **Der Anlass ist nicht selten.** Der Siegelabschnitt kommt nur in
			 * einen Entwurf, der nach dem Versiegeln entsteht. Wer die Reihenfolge
			 * einmal andersherum geht, muss neu erzeugen können.
			 */
			const [gesichert] = await tx<{ nummer: number }[]>`
				SELECT number AS nummer FROM minutes_version
				 WHERE meeting_id = ${meetingId} AND body = ${bestehend.body}
				 ORDER BY number DESC LIMIT 1
			`;
			if (!gesichert) {
				throw new FachlicherFehler(
					'schon_vorhanden',
					'Es besteht bereits ein Protokoll. Halten Sie die bisherige Fassung fest, bevor Sie neu erzeugen — sonst ginge die Überarbeitung verloren.',
					'protokoll'
				);
			}
			await tx`DELETE FROM minutes WHERE meeting_id = ${meetingId}`;
		}

		await tx`
			INSERT INTO minutes (operator_id, meeting_id, body, created_by, created_by_label,
			                     updated_by, updated_by_label)
			VALUES (${handelnder.operatorId}, ${meetingId}, ${text}, ${handelnder.userId},
			        ${handelnder.label}, ${handelnder.userId}, ${handelnder.label})
		`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.protokollentwurfErzeugt, { art: 'meeting', id: meetingId }, {
				zeichen: zeichenzahl(text)
			})
		]);
		return (await leseProtokoll(tx, meetingId)) as Protokoll;
	});
}

export async function speichereProtokoll(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	text: string,
	/** Der zuletzt bekannte Text — siehe `setzeProtokollnotiz`. */
	bisher?: string
): Promise<Protokoll> {
	let wortlaut: string;
	try {
		wortlaut = pruefeProtokolltext(text);
	} catch (fehler) {
		throw new FachlicherFehler('leer', (fehler as Error).message, 'body');
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const bestehend = await leseProtokoll(tx, meetingId, true);
		if (!bestehend) {
			throw new FachlicherFehler(
				'kein_protokoll',
				'Es besteht noch kein Protokoll. Erzeugen Sie zuerst den Entwurf.',
				'protokoll'
			);
		}
		if (veralteteFelder({ body: bestehend.body }, { body: bisher }, { body: wortlaut }).length > 0) {
			throw new Schreibkonflikt(
				{ body: bestehend.body }
			);
		}
		if (bestehend.body === wortlaut) return bestehend;

		await tx`
			UPDATE minutes SET body = ${wortlaut}, updated_by = ${handelnder.userId},
			                   updated_by_label = ${handelnder.label}
			WHERE meeting_id = ${meetingId}
		`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.protokollBearbeitet, { art: 'meeting', id: meetingId }, {
				zeichen: zeichenzahl(wortlaut)
			})
		]);
		return (await leseProtokoll(tx, meetingId)) as Protokoll;
	});
}

// ── Fassungen (FR-50) ───────────────────────────────────────────────────────

export interface Protokollfassung {
	id: Id;
	nummer: number;
	art: Fassungsart;
	bemerkung: string | null;
	zeitpunkt: Zeitpunkt;
	durch: string | null;
	body: string;
	/**
	 * Das Nachtragssiegel dieser Fassung (Ä-39, Migration 161); `null` bei
	 * einer Fassung vor dem Siegel und bei einer, die vor Migration 161 nach
	 * dem Siegel festgehalten wurde.
	 */
	nachtragssiegel: string | null;
}

/**
 * Die Prüfsumme der Fassung, die die Eigentümer bekommen haben.
 *
 * **Wozu** (22.08.2026): Die nächste Versammlung genehmigt dieses Protokoll —
 * und im Antragswortlaut ihres Traktandums soll stehen, **welches**. Damit
 * bezeugt ein Beschluss der Versammlung selbst, welcher Text gilt, gefasst von
 * genau den Menschen, die im Streitfall Gegenpartei wären. Das ist mehr wert
 * als jeder Zeitstempel, denn hier bestätigt niemand seine eigene Aufzeichnung.
 *
 * **Welche Fassung.** Die zuletzt als **versandt** festgehaltene, sonst die
 * zuletzt festgehaltene überhaupt. Nicht der lebende Text: Der ändert sich
 * beim nächsten Tastendruck, und ein Abdruck darauf wäre schon falsch, bevor
 * die Einladung gedruckt ist. Eine festgehaltene Fassung ist unveränderlich
 * (FR-50) — nur darüber lässt sich ein Abdruck bilden, der ein Jahr später
 * noch stimmt.
 *
 * **Gerechnet, nicht gespeichert.** Der Abdruck ist eine Funktion des Textes.
 * Ihn danebenzulegen erzeugte eine zweite Wahrheit, die auseinanderlaufen kann;
 * gerechnet stimmt er immer.
 */
export async function holeFassungsabdruck(
	operatorId: Id,
	meetingId: Id
): Promise<{ nummer: number; art: Fassungsart; zeitpunkt: Zeitpunkt; abdruck: string } | null> {
	const fassungen = await holeFassungen(operatorId, meetingId);
	if (fassungen.length === 0) return null;

	const versandt = fassungen.filter((f) => f.art === 'versandt');
	const massgeblich = (versandt.length > 0 ? versandt : fassungen).reduce((a, b) =>
		a.nummer >= b.nummer ? a : b
	);

	return {
		nummer: massgeblich.nummer,
		art: massgeblich.art,
		zeitpunkt: massgeblich.zeitpunkt,
		abdruck: createHash('sha256').update(massgeblich.body, 'utf8').digest('hex')
	};
}

export async function holeFassungen(
	operatorId: Id,
	meetingId: Id
): Promise<Protokollfassung[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				id: string;
				number: number;
				kind: Fassungsart;
				note: string | null;
				frozen_at: Date;
				frozen_by_label: string | null;
				body: string;
				seal_hash: string | null;
			}[]
		>`
			SELECT id, number, kind, note, frozen_at, frozen_by_label, body, seal_hash
			FROM minutes_version WHERE meeting_id = ${meetingId}
			ORDER BY number DESC
		`;
		return zeilen.map((z) => ({
			id: z.id,
			nummer: z.number,
			art: z.kind,
			bemerkung: z.note,
			zeitpunkt: z.frozen_at.toISOString(),
			durch: z.frozen_by_label,
			body: z.body,
			nachtragssiegel: z.seal_hash
		}));
	});
}

/**
 * Hält einen Wortlaut als Fassung fest.
 *
 * Der Sinn steht in FR-50: «Eine als versandt gekennzeichnete Fassung bleibt
 * unverändert abrufbar, auch wenn danach weiter bearbeitet wird.» Ohne diesen
 * Abzug liesse sich später nicht sagen, welchen Text die Eigentümer bekommen
 * haben — und genau das ist die Frage, wenn jemand den Beschluss bestreitet.
 *
 * **Der Wortlaut kommt von aussen, wenn es keine Arbeitsfassung gibt.** Am Haus
 * eines gemeinsamen Abends entsteht kein eigenes Protokoll; `minutes` bleibt
 * leer, und der Text ist die Zusammenstellung des Abends in diesem Augenblick
 * (`gemeinsamesprotokoll.ts`). Die Schreibregeln — «versandt» nur mit Siegel,
 * fortlaufende Nummer, unveränderliche Zeile, Verlaufseintrag — gelten für
 * beide Wege dieselben; deshalb steht hier nur der Text im Parameter und nicht
 * eine zweite Schreibstelle daneben.
 */
export async function halteFassungFest(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	art: Fassungsart,
	bemerkung?: string | null,
	wortlaut?: string
): Promise<Protokollfassung> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Unter der Sperre der Versammlung** (Ä-39, H8 Teil B; Nachtrag aus
		 * H5). Ab dem Siegel trägt jede Fassung ein Nachtragssiegel, das auf das
		 * vorige verweist. Zwei Fassungen zugleich läsen sonst dasselbe vorige
		 * Siegel, und eine Fassung während des Versiegelns bliebe ohne. Dieselbe
		 * Sperre wie `versiegle`, `FOR UPDATE` und nicht `FOR NO KEY UPDATE`:
		 * Nur so wartet sie auf ein laufendes Siegel, und zwei Fassungen warten
		 * aufeinander. Der eindeutige Index in Migration 161 ist das Netz
		 * darunter. Die Sperre hält nur Millisekunden; ausser der Fassung und
		 * dem Verlauf schreibt dieser Weg nichts.
		 */
		await tx`SELECT 1 FROM meeting WHERE id = ${meetingId} FOR UPDATE`;

		let body: string;
		if (wortlaut !== undefined) {
			body = wortlaut;
		} else {
			const protokoll = await leseProtokoll(tx, meetingId);
			if (!protokoll) {
				throw new FachlicherFehler(
					'kein_protokoll',
					'Es besteht noch kein Protokoll, das sich festhalten liesse.',
					'protokoll'
				);
			}
			body = protokoll.body;
		}

		/*
		 * **«Versandt» erst mit dem Siegel** (Block 8, Produktentscheid
		 * 30.09.2026). Ein Protokoll gilt erst versiegelt als versandt: Mit dem
		 * Siegel entsteht das Abschlusspaket, auf das sich der Versand bezieht,
		 * und erst dann lässt sich sagen, welchen Text die Eigentümer zusammen
		 * mit welchem Nachweis bekommen haben. Ohne Siegel hielte die Fassung
		 * eine Zustellung fest, die es nicht gibt.
		 *
		 * Beim Hausprotokoll steht die Prüfung nach der des Protokolls: Der Weg
		 * auf die Seite führt erst über einen Entwurf, und «es gibt noch kein
		 * Protokoll» ist dort die genauere Auskunft. Am Haus eines Abends gibt es
		 * dagegen keine Arbeitsfassung; dort gilt allein das Siegel des Hauses.
		 * `genehmigt` und `festgehalten` bleiben ohne Siegel möglich; sie beziehen
		 * sich auf die Versammlung und nicht auf das Paket.
		 */
		if (art === 'versandt') {
			const [s] = await tx<{ versiegelt: boolean }[]>`
				SELECT EXISTS (SELECT 1 FROM seal WHERE meeting_id = ${meetingId}) AS versiegelt
			`;
			if (!s.versiegelt) {
				throw new FachlicherFehler(
					'nicht_versiegelt',
					'Als versandt lässt sich eine Fassung erst festhalten, wenn die Versammlung versiegelt ist: ' +
						'Erst dann gibt es das Abschlusspaket, das zum Protokoll gehört. ' +
						'Fehlt noch ein Beschluss von Hand, tragen Sie ihn zuerst nach. ' +
						'Versiegeln Sie dann und halten Sie die Fassung danach als «versandt» fest.',
					'art'
				);
			}
		}

		const [{ naechste }] = await tx<{ naechste: number }[]>`
			SELECT coalesce(max(number), 0) + 1 AS naechste
			FROM minutes_version WHERE meeting_id = ${meetingId}
		`;

		/*
		 * **Das Nachtragssiegel entsteht mit der Zeile** (Migration 161). Der
		 * Zeitpunkt im Manifest ist `now()` dieser Transaktion, derselbe, den
		 * `frozen_at` sonst als Vorgabe bekäme; deshalb wird er hier gelesen und
		 * ausdrücklich geschrieben.
		 */
		const [{ jetzt }] = await tx<{ jetzt: Date }[]>`SELECT now() AS jetzt`;
		const nachtrag = await baueNachtragssiegel(tx, meetingId, {
			nummer: naechste,
			art,
			bemerkung: bemerkung?.trim() || null,
			body,
			festgehaltenAm: jetzt.toISOString(),
			festgehaltenDurch: handelnder.label ?? ''
		});

		const [zeile] = await tx<{ id: string; frozen_at: Date }[]>`
			INSERT INTO minutes_version (operator_id, meeting_id, number, body, kind, note,
			                             frozen_at, frozen_by, frozen_by_label,
			                             seal_manifest, seal_hash, seal_previous)
			VALUES (${handelnder.operatorId}, ${meetingId}, ${naechste}, ${body}, ${art},
			        ${bemerkung?.trim() || null}, ${jetzt}, ${handelnder.userId},
			        ${handelnder.label}, ${nachtrag?.manifest ?? null},
			        ${nachtrag?.siegel ?? null}, ${nachtrag?.vorgaenger ?? null})
			RETURNING id, frozen_at
		`;

		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.protokollfassungFestgehalten, { art: 'meeting', id: meetingId }, {
				nummer: naechste,
				fassungsart: art,
				zeichen: body.length,
				...(nachtrag ? { nachtragssiegel: nachtrag.siegel, vorgaenger: nachtrag.vorgaenger } : {})
			})
		]);

		return {
			id: zeile.id,
			nummer: naechste,
			art,
			bemerkung: bemerkung?.trim() || null,
			zeitpunkt: zeile.frozen_at.toISOString(),
			durch: handelnder.label,
			body,
			nachtragssiegel: nachtrag?.siegel ?? null
		};
	});
}

/** Hält fest, dass eine Ausgabe erzeugt wurde (FR-49). */
export async function vermerkeAusgabe(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	format: 'docx' | 'odt' | 'pdf',
	zeichen: number
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.protokollAusgegeben, { art: 'meeting', id: meetingId }, {
				format,
				zeichen
			})
		]);
	});
}

/**
 * Der Stimmenspiegel der Auszählung auf das, was ins Protokoll gehört.
 *
 * Ausdrücklich Feld für Feld statt einer Übernahme des ganzen Objekts: `erreicht`
 * ist eine Wertung und gehört nicht in den Zahlenspiegel, und eine spätere
 * Erweiterung des Stimmenspiegels soll nicht unbemerkt im Protokoll landen.
 */
function protokollspiegel(sp: Stimmenspiegel): Protokollspiegel {
	return {
		ja: sp.ja,
		nein: sp.nein,
		enthaltung: sp.enthaltung,
		ohneAbgabe: sp.ohneAbgabe,
		nichtAnwesend: sp.nichtAnwesend,
		...(sp.stimmtNicht ? { stimmtNicht: sp.stimmtNicht } : {}),
		...(sp.imAusstand ? { imAusstand: sp.imAusstand } : {}),
		basis: sp.basis,
		schwelle: sp.schwelle
	};
}
