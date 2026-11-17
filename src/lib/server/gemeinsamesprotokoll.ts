/**
 * Die Zusammenstellung des Abends — Daten holen und ordnen (Story 7.5b).
 *
 * **Die Schale, nicht die Wahrheit.** Der Text entsteht im Kern
 * (`domain/gemeinsamesprotokoll.ts`); hier wird nur zusammengetragen, was er
 * braucht. Der Grund ist derselbe wie beim Protokoll einer einzelnen
 * Versammlung: Was ein Gericht liest, muss sich mit einer Wertetabelle belegen
 * lassen — dieselben Daten hinein, derselbe Text heraus (AD-1).
 *
 * **Nichts wird neu gerechnet.** Die Ergebnisse kommen aus `holeAuswertung`,
 * also aus derselben Quelle wie die Auswertungsseite und das Auswertungs-PDF
 * jeder Gemeinschaft. Rechnete diese Datei selbst, stünde in der
 * Zusammenstellung eines Tages eine andere Zahl als im Protokoll des Hauses —
 * und niemand wüsste, welche gilt.
 *
 * **Eine Angabe kommt nicht aus der Auswertung:** ob ein Haus bei einem von
 * Hand festgehaltenen Beschluss nicht beschlussfähig war (Block 6,
 * 02.10.2026). Die Auswertung führt sie nicht, weil Auswertung und
 * Stimmnachweis den Satz bewusst nicht tragen. Gerechnet wird sie trotzdem
 * nicht hier, sondern mit der Kernfunktion des Hausprotokolls
 * (`beschlussfaehigkeitFehlteAmBeschluss`).
 */
import { NOTWENDIGE_MASSNAHME_KNOTEN } from '$lib/domain/entscheidbaum';
import { andereLesartenVon, andereLesartInWorten, ergebnislage, zweitesErgebnisImProtokoll } from '$lib/domain/auszaehlung';
import { gemeinsameListe, nummernJeTraktandum } from '$lib/domain/gemeinsameliste';
import {
	gemeinsamerProtokollentwurf,
	protokollluecke,
	type Abendergebnis,
	type Abendpunkt,
	type Abendteilnahme,
	type GemeinsamesProtokoll
} from '$lib/domain/gemeinsamesprotokoll';
import { zustandsname } from '$lib/domain/versammlung';
import { satzZumEinzigen } from '$lib/domain/beschlussfaehigkeit';
import type { Id } from '$lib/domain/types';
import { holeAuswertung } from './auswertung';
import { ersetzungInKuerze, type Ersetzungslage } from '$lib/domain/folgeantragsersetzung';
import { holeGemeinsameListe } from './geschaeft';
import {
	halteFassungFest,
	holeNotizen,
	holeProtokoll,
	holeBeschlussvermerke,
	holeFolgeantragslagen,
	durchFolgeantraegeEntschieden,
	l8Zeilenlage,
	nachQuorumLage,
	nurAngaben,
	verwaltungskennungenAus,
	type L8Zeilenlage,
	type Protokollfassung
} from './protokoll';
import { holeVollmachten } from './vollmacht';
import {
	beschlussfaehigkeitFehlteAmBeschluss,
	betroffenenzeilen,
	ausstandFehlteAmBeschluss,
	ersteFehlteAmBeschluss,
	type Fassungsart,
	type Protokollzeile
} from '$lib/domain/protokoll';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Handelnder } from './audit';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { nutzniessungenDerBetroffenen } from '$lib/domain/nutzniessung';
import type { SnapshotParty } from '$lib/domain/types';
import { holeDurchgaenge } from './abstimmung';
import { holeMomentaufnahme } from './freigabe';
import { holeAnwesenheitsregeln } from './reglement';
import { gleichstandInZahlen, zustimmungBetroffenerGefragt, type Auszaehlung } from '$lib/domain/auszaehlung';

import { holePapierabgaben } from './papierabgabe';
import { holeUebersicht } from './anwesenheit';
import { holePendenzen } from './pendenz';
import { holeRuegen, ruegeangaben } from './ruege';
import { holeNeueTraktandenDerZweiten, holeTraktanden } from './traktanden';
import { holeTafel, holeVersammlungstag, hausDesAbends } from './versammlungstag';

/**
 * Die Betroffenen-Zeilen eines Hauses für das Abenddokument, ohne Namen
 * (Block A3a). Nur wo die Zustimmung verlangt war, wie im Hausprotokoll.
 * Die Namen braucht es hier nicht: `betroffenenzeilen` zählt nur, und
 * `NICHT_IM_STAND` bleibt als Kennzeichen erhalten.
 */
/**
 * Ob der Satz zur Ersetzung an die Stelle des Ergebnisses treten darf: nicht
 * am Folgeantrag nach einer Neuabstimmung, dort steht noch keines (Codeprüfung
 * B2b, M4).
 */
function ersetzungMitErgebnis(e: Ersetzungslage | null | undefined): boolean {
	return !!e && !(e.rolle === 'folgeantrag' && e.ausgang === 'neuabstimmung');
}

function betroffenenzeilenAmAbend(
	a: Auszaehlung | null,
	/** Der festgehaltene Stand des Hauses, für die Nutzniessungen (03.11.2026). */
	parteien: readonly SnapshotParty[]
): string[] {
	const b = a?.betroffene;
	if (!b || !zustimmungBetroffenerGefragt(a)) return [];
	return betroffenenzeilen(
		{
			zustimmungsform: b.form,
			ohneZustimmung: b.fehlend.map((f) => f.name),
			// Wer vorab zugestimmt und dazu im Ausstand entschieden hat, zählt
			// beim Entscheid, nicht zweimal (Codeprüfung A3a, dritter Durchgang).
			vorabZugestimmt: b.vorab
				.filter((id) => !b.veto.some((v) => v.parteiId === id))
				.map(() => ''),
			// Nur bei angenommenem Beschluss, wie im Ergebnissatz (Codeprüfung A3a, B1).
			ausstehend: a?.angenommen ? b.ausstehend.map((x) => x.name) : [],
			// Nur gezählt, wie die Vorab-Zustimmungen: kein Name ins Abenddokument.
			ausstehendNutzniessung: a?.angenommen
				? nutzniessungenDerBetroffenen(
						parteien,
						b.ausstehend.map((x) => x.parteiId)
					).map(() => '')
				: [],
			vetoAnzahl: {
				ja: b.veto.filter((v) => v.entscheid === 'ja').length,
				nein: b.veto.filter((v) => v.entscheid === 'nein').length
			}
		},
		{ namentlich: false }
	);
}

export interface Abendzusammenstellung {
	text: string;
	/** Was noch fehlt — für die Leiste und den Hinweis auf der Seite. */
	luecke: string | null;
	versammlungen: number;
	punkte: number;
	/** Wie viele Ergebnisse noch fehlen; die Seite nennt die Zahl. */
	offeneErgebnisse: number;
	/** Wie viele Abstimmungen der Abend insgesamt kennt — die Bezugsgrösse dazu. */
	abstimmungenGesamt: number;
	/** Punkte des Abends ohne beteiligte Gemeinschaft — ebenfalls eine Lücke. */
	ohneZuordnung: number;
}

/**
 * Der Feststellungssatz zur Beschlussfähigkeit, kurz.
 *
 * Aus der Tafel und nicht neu gerechnet. «Fehlt» steht dort als Satz bereit;
 * ist er leer, ist die Versammlung beschlussfähig.
 */
function beschlussfaehigkeitssatz(z: {
	beschlussfaehig: {
		erfuellt: boolean;
		fehlt: string;
		kopfstimmenAnwesend: number;
		kopfstimmenGesamt: number;
		/** Die Grundlage von Art. 712p — Personen. Null vor dem 26.08.2026. */
		eigentuemerAnwesend?: number | null;
		eigentuemerGesamt?: number | null;
		einzigeParteiGemeinsam?: boolean;
	} | null;
}): string | null {
	if (!z.beschlussfaehig) return null;
	const b = z.beschlussfaehig;
	/*
	 * **Nicht «3 von 3 Kopfstimmen anwesend» als Beleg für die
	 * Beschlussfähigkeit** (26.08.2026, aus dem Code-Review). Art. 712p zählt
	 * Stockwerkeigentümer; die Kopfstimmen sind bei «je Einheit» die Einheiten.
	 * Der Satz behauptete damit ausdrücklich eine Grundlage, die es nicht ist.
	 */
	const zahlen =
		b.eigentuemerGesamt === null || b.eigentuemerGesamt === undefined
			? `${b.kopfstimmenAnwesend} von ${b.kopfstimmenGesamt} Kopfstimmen anwesend`
			: // «Eigentümern», nicht «Stockwerkeigentümern»: Am Abend tagt oft eine
				// Miteigentümergemeinschaft mit, für die Art. 712p nicht gilt (Laien- und
				// Fachprüfung 17.11.2026, L5, F4). Gezählt werden weiter Personen.
				`${b.eigentuemerAnwesend} von ${b.eigentuemerGesamt} Eigentümern anwesend`;
	if (!b.erfuellt) return `Nicht beschlussfähig: ${b.fehlt || zahlen}`;
	// Wie `feststellungssatz`: bei einem einzigen Eigentümer mit der Lehrmeinung (Ä-17).
	return `Beschlussfähig: ${zahlen}` + (b.eigentuemerGesamt === 1 ? `. ${satzZumEinzigen(b.einzigeParteiGemeinsam, true)}` : '');
}

export async function stelleAbendzusammenstellungZusammen(
	operatorId: Id,
	tagId: Id,
	erzeugtAm: string,
	erzeugtDurch: string,
	/**
	 * Ob der Unterschriftsblock mitgeht (Auftraggeber, 12.08.2026: «Mache die Unterschrift
	 * als Option»). Die Wahl steht in der Adresse, nicht in der Datenbank: Sie
	 * betrifft die Ausgabe, nicht den Bestand — und muss vom Bildschirm in denselben
	 * PDF-Aufruf durchreichen.
	 */
	unterschriften = true
): Promise<Abendzusammenstellung | null> {
	const tag = await holeVersammlungstag(operatorId, tagId);
	if (!tag) return null;

	const [tafel, geschaefte] = await Promise.all([
		holeTafel(operatorId, tagId),
		holeGemeinsameListe(operatorId, tagId)
	]);

	/*
	 * Je Versammlung dieselben drei Quellen wie beim Protokoll des Hauses. Alle
	 * gleichzeitig: Bei sieben Gemeinschaften wären es nacheinander einundzwanzig
	 * Abfragen hintereinander, und die Seite stünde spürbar still.
	 */
	const jeVersammlung = new Map(
		await Promise.all(
			tafel.map(async (z) => {
				const [
					auswertung,
					traktanden,
					protokoll,
					notizen,
					pendenzen,
					ruegen,
					uebersicht,
					papier,
					momentaufnahme,
					durchgaenge,
					regeln,
					beschlussvermerke,
					vollmachten
				] = await Promise.all([
					holeAuswertung(operatorId, z.meetingId),
					holeTraktanden(operatorId, z.meetingId),
					holeProtokoll(operatorId, z.meetingId),
					// Seit es nur noch ein Protokoll gibt, gehören die Notizen dorthin
					// (Auftraggeber, 12.08.2026: «Nicht pro Haus»).
					holeNotizen(operatorId, z.meetingId),
					/*
					 * **Die Pendenzen dagegen bleiben je Haus.** Anders als die Notiz:
					 * Die Zusage fällt in der Versammlung eines Hauses und bindet
					 * dieses Haus. Beim Verbund kann derselbe Punkt in einem Haus eine
					 * Pendenz erzeugen und im anderen keine.
					 */
					holePendenzen(operatorId, z.meetingId),
					// Die Rügen ebenfalls je Haus: Erfasst werden sie dort (Ä-06).
					holeRuegen(operatorId, z.meetingId),
					/*
					 * **Die Mischform gilt je Haus** (Migration 108, 10.09.2026). Am
					 * gemeinsamen Abend führt das Haus kein eigenes Protokoll mehr; die
					 * Zusammenstellung ist das Dokument. Stünde der Abschnitt nur im
					 * Protokoll der einzelnen Versammlung, sagte am Verbundabend
					 * niemand, dass ein Teil der Stimmen übertragen wurde.
					 *
					 * Beides wird gebraucht: die Vermerke und die Momentaufnahme. Ohne
					 * die Zahl aller Parteien liesse sich «alle von Hand» nicht von
					 * «gemischt» unterscheiden.
					 */
					holeUebersicht(operatorId, z.meetingId),
					holePapierabgaben(operatorId, z.meetingId),
					/*
					 * **Für den Satz zur fehlenden Beschlussfähigkeit am Beschluss**
					 * (Block 6, 02.10.2026): die Stimmkraft aus der Momentaufnahme, der
					 * eingefrorene Anwesenheitsstand je Durchgang und die Regel des
					 * Hauses. Dieselben drei Quellen wie im Hausprotokoll
					 * (`stelleEntwurfZusammen`), je Haus eigene.
					 */
					holeMomentaufnahme(operatorId, z.meetingId),
					holeDurchgaenge(operatorId, z.meetingId),
					holeAnwesenheitsregeln(operatorId, z.stwegId),
					/*
					 * **Der Beschlussvermerk je Haus** (Block 7): Am gemeinsamen
					 * Abend ist dieses Dokument das Protokoll. Mit dem Vermerk
					 * entfällt «Zu diesem Punkt liegt noch kein Ergebnis vor.»,
					 * und der Punkt zählt nicht als Lücke.
					 */
					holeBeschlussvermerke(operatorId, z.meetingId),
					/*
					 * **Für die Zeilen zu L8** (Codeprüfung P11, H1): ob die
					 * Leitung den Ausstand der Verwaltung erklärt hat, über die
					 * Kennungen ihrer Vollmachten, wie im Hausprotokoll.
					 */
					holeVollmachten(operatorId, z.meetingId)
				]);
				const papierparteien = new Set(papier.map((p) => p.parteiId));
				const staende = uebersicht?.staende ?? [];
				// Die Auswertungszeilen tragen die Nummer **der Einzelversammlung**;
				// die Traktanden tragen Nummer und Kennung. Über die Nummer lassen sich
				// beide verbinden — die Kennung steht in der Auswertung nicht.
				const zeilenJeNummer = new Map(
					(auswertung?.zeilen ?? []).map((zeile) => [zeile.nummer, zeile])
				);
				const nummerJeTraktandum = new Map(traktanden.map((t) => [t.knoten.id, t.nummer]));
				/*
				 * **Die Folgeanträge je Antrag** (Produktentscheid 08.11.2026). Sie
				 * entstehen am Abend je Haus, hängen über `parentId` am Antrag und
				 * stehen in keiner gemeinsamen Liste. Auch der Folgeantrag eines
				 * Folgeantrags gehört unter den Antrag, an dem die Kette beginnt.
				 *
				 * **Und die Rückkommen** (16.11.2026, vor der ersten echten
				 * Versammlung als gemeinsamer Abend): Sie hängen über
				 * `rueckkommenZielId` am Antrag, auch ein Rückkommen auf ein
				 * Rückkommen, und hatten im Dokument keine eigene Zeile; ein
				 * abgelehntes stand gar nicht darin. Folgeanträge zu einem
				 * Rückkommen gibt es nicht (`hindernisAlsGrundantrag`, `spontan`).
				 */
				const jeKennung = new Map(traktanden.map((t) => [t.knoten.id, t]));
				const folgeantraegeJeAntrag = new Map<Id, (typeof traktanden)[number][]>();
				const obenAn = (t: (typeof traktanden)[number]) =>
					t.knoten.spontanart === 'folgeantrag'
						? t.knoten.parentId
						: t.knoten.spontanart === 'rueckkommen'
							? (t.knoten.rueckkommenZielId ?? null)
							: null;
				for (const f of traktanden) {
					if (f.knoten.spontanart !== 'folgeantrag' && f.knoten.spontanart !== 'rueckkommen') continue;
					let antrag = f;
					const gesehen = new Set<Id>();
					for (let oben = obenAn(antrag); oben; oben = obenAn(antrag)) {
						const eltern = jeKennung.get(oben);
						if (!eltern || gesehen.has(eltern.knoten.id)) break;
						gesehen.add(eltern.knoten.id);
						antrag = eltern;
					}
					if (antrag === f || antrag.knoten.spontanart) continue;
					const liste = folgeantraegeJeAntrag.get(antrag.knoten.id) ?? [];
					liste.push(f);
					folgeantraegeJeAntrag.set(antrag.knoten.id, liste);
				}
				const stimmkraft = momentaufnahme ? stimmkraftliste(momentaufnahme) : null;
				/*
				 * **Warum über einen Antrag nicht abgestimmt wurde**, wo
				 * Folgeanträge entschieden haben (Featureprüfung 2 zu F4c, M1):
				 * dieselbe Stelle wie im Hausprotokoll, je Haus.
				 */
				const folgeantragslage = await holeFolgeantragslagen(
					operatorId,
					z.meetingId,
					auswertung,
					traktanden
				);
				/*
				 * **Der zweite Durchgang nach Eintritt der Beschlussfähigkeit**
				 * (Migration 139). Am gemeinsamen Abend ist dieses Dokument das
				 * Protokoll; der Satz des Hauses gehört hierher. Gerechnet mit
				 * derselben Funktion wie das Hausprotokoll, je Haus mit dessen
				 * Durchgängen, Stimmkraft, Stufe und Regel (Codeprüfung
				 * 03.10.2026, zweiter Durchgang).
				 */
				const jeTraktandum = new Map(traktanden.map((t) => [t.nummer, t]));
				const nachQuorumJeTraktandum = new Map<string, Protokollzeile['nachQuorum']>();
				for (const zeile of auswertung?.zeilen ?? []) {
					const t = jeTraktandum.get(zeile.nummer);
					if (!t) continue;
					nachQuorumJeTraktandum.set(
						t.knoten.id,
						await nachQuorumLage({
							operatorId,
							meetingId: z.meetingId,
							traktandumId: t.knoten.id,
							geltenderId: zeile.durchgangId ?? null,
							durchgaenge,
							stimmkraft,
							stufe: z.stufe,
							regel: regeln[z.stufe] ?? null
						})
					);
				}
				/*
				 * **Die Zeilen zu L8 je Traktandum** (Codeprüfung P11, H1,
				 * 08.11.2026): Wahl und Abberufung trotz Häkchen, die Angabe der
				 * Leitung am Folgeantrag. Am gemeinsamen Abend ist dieses Dokument
				 * das Protokoll; dieselbe Funktion wie im Hausprotokoll, je Haus
				 * mit dessen Wahl zu L8, eingefrorenem Ausstand und Vollmachten.
				 */
				const verwaltungskennungen = verwaltungskennungenAus(vollmachten);
				const ausstandJeDurchgang = new Map(durchgaenge.map((d) => [d.id, d.ausstand]));
				const l8JeTraktandum = new Map<Id, L8Zeilenlage>();
				for (const zeile of auswertung?.zeilen ?? []) {
					const t = jeTraktandum.get(zeile.nummer);
					if (!t) continue;
					l8JeTraktandum.set(
						t.knoten.id,
						l8Zeilenlage({
							knoten: t.knoten,
							wahl: momentaufnahme?.lesarten?.L8,
							ausstand: zeile.durchgangId ? (ausstandJeDurchgang.get(zeile.durchgangId) ?? []) : null,
							verwaltungskennungen
						})
					);
				}
				return [
					z.meetingId,
					{
						zeilenJeNummer,
						l8JeTraktandum,
						nummerJeTraktandum,
						folgeantraegeJeAntrag,
						/*
						 * Im Saal aufgenommene Geschäfte (16.11.2026), am Abend in der
						 * Regel Kenntnisnahmen (`NICHT_ANGEKUENDIGT_AM_ABEND`); mit einem
						 * Beschluss von Hand auch mit Ergebnis (Codeprüfung Block B, M1).
						 */
						imSaal: traktanden.filter((t) => t.knoten.spontanart === 'neu' && !t.knoten.parentId),
						gemeinschaftsname: z.gemeinschaft,
						stimmkraft,
						folgeantragslage,
						nachQuorumJeTraktandum,
						anwesendeJeDurchgang: new Map(durchgaenge.map((d) => [d.id, d.anwesende])),
						// L7 (Migration 183): Die Beteiligung ohne die Personen im Ausstand
						// rechnet je Beschluss aus dem eingefrorenen `attendance_json`
						// desselben Durchgangs.
						vertretungenJeDurchgang: new Map(durchgaenge.map((d) => [d.id, d.vertretungen])),
						ausstandJeDurchgang,
						// Ä-17 B, wie im Hausprotokoll; leer an einer ersten Versammlung.
						neueAnZweiter: await holeNeueTraktandenDerZweiten(operatorId, z.meetingId),
						// L5 aus der Momentaufnahme des Hauses (Migration 174).
						neutraktandenwahl: momentaufnahme?.lesarten?.L5 ?? null,
						// L7 aus derselben Momentaufnahme (Migration 183).
						ausstandswahl: momentaufnahme?.lesarten?.L7 ?? null,
						// Für die Nutzniessungen an Einheiten der Betroffenen (03.11.2026).
						parteien: momentaufnahme?.parties ?? [],
						stufe: z.stufe,
						regel: regeln[z.stufe] ?? null,
						regelErste: regeln.erste ?? null,
						// A5, Punkt 8: die Regel des Reglements für die zweite
						// Versammlung dieses Hauses, für `neuAnZweiterProtokoll`.
						regelZweite: regeln.zweite ?? null,
						notizen,
						pendenzen,
						ruegen,
						beschlussvermerke,
						protokoll: protokoll !== null,
						/*
						 * **Nur die Zahl** (10.09.2026, im Sicherheitsdurchgang gefunden).
						 * Das Abenddokument geht an die Eigentümer aller beteiligten
						 * Gemeinschaften; eine Namensliste je Haus wäre der erste
						 * Eigentümername darin und läge danach in jedem anderen Haus.
						 * Die Namen stehen im Abschlusspaket der einzelnen Gemeinschaft
						 * und im Verlauf.
						 *
						 * **Gezählt werden nur eingelassene Parteien.** Der Vermerk setzt
						 * die Anwesenheit nicht voraus; eine nie eingelassene Partei unter
						 * «stimmte auf Papier ab» wäre eine falsche Aussage im Dokument.
						 */
						aufPapier: staende.filter(
							(x) =>
								papierparteien.has(x.parteiId) &&
								(x.zustand === 'anwesend' || x.zustand === 'gegangen')
						).length,
						/*
						 * **Die eingelassenen Parteien, nicht alle** (10.09.2026, im
						 * Code-Review gefunden). Dieselbe Rechnung wie im Hausprotokoll:
						 * Wer nicht erschien, steht nie im Zähler und stünde immer im
						 * Nenner. «Vertreten» zählt mit, die Stimme wird ja abgegeben.
						 */
						eingelassen: staende.filter(
							(x) => x.zustand === 'anwesend' || x.zustand === 'gegangen'
						).length
					}
				] as const;
			})
		)
	);

	const teilnahme: Abendteilnahme[] = tafel.map((z) => ({
		gemeinschaft: z.gemeinschaft,
		zustand: zustandsname(z.zustand),
		beschlussfaehigkeit: beschlussfaehigkeitssatz(z),
		versiegelt: z.zustand === 'versiegelt',
		protokoll: jeVersammlung.get(z.meetingId)?.protokoll ?? false,
		aufPapier: jeVersammlung.get(z.meetingId)?.aufPapier ?? 0,
		eingelassen: jeVersammlung.get(z.meetingId)?.eingelassen ?? 0
	}));

	const liste = gemeinsameListe(geschaefte);
	const nummern = nummernJeTraktandum(liste);

	/*
	 * **Die oberste Ebene führt, die Unterpunkte liefern die Ergebnisse.**
	 *
	 * Ein **Sammelpunkt** trägt selbst keine Traktanden — er wird nicht
	 * abgestimmt, der Beschluss fällt in der einzelnen Gemeinschaft
	 * (`gemeinsameliste.ts`). Seine Ergebnisse stehen bei den Unterpunkten der
	 * Ebene darunter, verbunden über dieselbe Geschäftskennung.
	 *
	 * **Genau das ging am 12.08.2026 schief:** Diese Datei nahm nur
	 * `zeile.traktanden` der obersten Ebene, fand beim Sammelpunkt keines — und
	 * das Protokoll meldete «8 Punkte ohne Gemeinschaft», wo acht Punkte in je
	 * zwei Gemeinschaften sauber beschlossen worden waren. Im Bestand nachgesehen:
	 * Jedes dieser Geschäfte hatte seine zwei Traktanden. Der Fehler lag hier,
	 * nicht in den Daten.
	 */
	const punkte: Abendpunkt[] = [];
	let offeneErgebnisse = 0;
	/*
	 * **Wovon die offenen ein Teil sind** (23.08.2026, Prüflauf II, D-01). Im
	 * Stand-Kasten standen «13 Punkte auf der Liste» und «18 Abstimmungen ohne
	 * Ergebnis» untereinander. Beide Zahlen stimmten — die eine zählt
	 * Traktanden, die andere Abstimmungen je Gemeinschaft —, aber wer sie
	 * nebeneinander liest, fragt sich, wie achtzehn von dreizehn offen sein
	 * können. Mit der Bezugsgrösse daneben stellt sich die Frage nicht.
	 */
	let abstimmungenGesamt = 0;
	let ohneZuordnung = 0;

	/*
	 * **Die Angaben eines Hauses zu einem Antrag**, für die Zeile des Hauses
	 * und ebenso für die Zeile jedes seiner Folgeanträge (Produktentscheid
	 * 08.11.2026, Entscheid 0045, Punkt 11). Eine Stelle: Zwei Fassungen
	 * derselben Felder liefen beim ersten neuen Satz auseinander, und der
	 * Folgeantrag trüge etwa die Lesart oder den Ausstand nicht.
	 */
	type Hausangaben = NonNullable<ReturnType<typeof jeVersammlung.get>>;
	type Hauszeile = NonNullable<ReturnType<Hausangaben['zeilenJeNummer']['get']>>;
	const angabenDesHauses = (
		v: Hausangaben | undefined,
		traktandumId: Id,
		zeileDesHauses: Hauszeile | undefined,
		abstimmung: boolean,
		/*
		 * Die Angabe «Zeile eines Folgeantrags» ist entfallen (16.11.2026): Seit der
		 * Rückzug an jeder Zeile gilt, unterschied sie nichts mehr.
		 */
	): { offen: boolean; felder: Omit<Abendergebnis, 'nummer' | 'gemeinschaft' | 'abweichenderTitel'> } => {
		/*
		 * **Der Beschlussvermerk dieses Hauses** (Block 7): Der Text im
		 * Votenfeld ist der Beschluss, den Votum nicht führt. Dann ist der
		 * Punkt keine Lücke — der Text steht schon im Dokument —, und der
		 * letzte Zweig der Zusammenstellung schreibt «Zu diesem Punkt
		 * liegt noch kein Ergebnis vor.» nicht.
		 */
		const beschlussvermerk = v?.beschlussvermerke.has(traktandumId) ?? false;
		/*
		 * **Nicht abgestimmt, weil Folgeanträge entschieden haben**
		 * (Featureprüfung 2 zu F4c, M1): angenommen, dann gegenstandslos;
		 * unter dem Häkchen zur Wahl oder Abberufung entschieden, dann von
		 * Votum gesperrt (Entscheid 0045, Punkt 9). Der Punkt ist keine
		 * Lücke, das Hausprotokoll nennt den Grund ebenso.
		 */
		const folgeantraege =
			v && zeileDesHauses ? v.folgeantragslage(zeileDesHauses) : null;
		const durchFolgeantraege = !!folgeantraege && durchFolgeantraegeEntschieden(folgeantraege);
		/*
		 * L7 (Migration 183): Dieselbe Stufe, nach der das Eröffnen prüft
		 * (auch L5), je Haus mit dessen Grössen; der Satz steht im
		 * Abenddokument an derselben Stelle wie im Hausprotokoll.
		 */
		const stufeFuerL7 =
			v && v.stufe === 'zweite' && v.neutraktandenwahl === 'erste' && v.neueAnZweiter.has(traktandumId)
				? ('erste' as const)
				: (v?.stufe ?? null);
		/*
		 * **Der Rückzug an jeder Zeile** (Produktentscheid 08.11.2026 für den
		 * Folgeantrag; 16.11.2026 auch an der Zeile des Hauses, vor der ersten
		 * echten Versammlung als gemeinsamer Abend): Zurückgezogen ist ein Antrag
		 * entschieden wie im Hausprotokoll (`ohneErgebnis`), und das Dokument
		 * bliebe sonst ohne Ausweg Entwurf. Die Tafel zählt ihn ebenso nicht mehr
		 * (`holeTafel`, `withdrawn_at`). Nicht neben einem Ergebnis: Dann trägt der
		 * Satz den Durchgang.
		 */
		const zurueckgezogen = !zeileDesHauses?.satz ? (zeileDesHauses?.rueckzug ?? null) : null;
		// Ein ersetzter Grundantrag ist entschieden, nur beim Folgeantrag (Soll 6).
		// Nicht nach einer Neuabstimmung am Folgeantrag: Dort ist noch kein
		// Ergebnis (Codeprüfung B2b, M4).
		const offen =
			abstimmung &&
			!zeileDesHauses?.satz &&
			!ersetzungMitErgebnis(zeileDesHauses?.ersetzung) &&
			!beschlussvermerk &&
			!durchFolgeantraege &&
			!zurueckgezogen;
		return {
			offen,
			felder: {
					/*
					 * **Der Leinwandsatz ohne Namen** (Codeprüfung A3a, B2 und H1).
					 * `satz` nennt bei «abgelehnt» die Fehlenden und bei den Wertquoten
					 * die Ausstehenden beim Namen; das Abenddokument geht an alle
					 * beteiligten Gemeinschaften und trägt keine Eigentümernamen
					 * (10.09.2026). Der namensfreie `protokollsatz` taugt hier nicht: Er
					 * ist ohne Zahlen, weil das Hausprotokoll sie im Spiegel darunter
					 * führt, und einen Spiegel hat das Abenddokument nicht.
					 */
					satz: zeileDesHauses?.satzOhneNamen ?? null,
					ersetzung: ersetzungMitErgebnis(zeileDesHauses?.ersetzung)
						? ersetzungInKuerze(zeileDesHauses!.ersetzung!)
						: null,
					folgeantraegeAngenommen: folgeantraege?.folgeantraegeAngenommen ?? null,
					teileEntschieden: folgeantraege?.teileEntschieden ?? null,
					erfordernis: zeileDesHauses?.erfordernis ?? null,
					rechtsgrundlage: zeileDesHauses?.rechtsgrundlage ?? null,
					// Geheim und die Grundlage (Ä-38), wie im Hausprotokoll.
					geheim: zeileDesHauses?.auszaehlung?.geheim === true,
					geheimBeschlossen: zeileDesHauses?.geheimBeschlossen === true,
					geheimNachReglement: zeileDesHauses?.geheimNachReglement === true,
					// Wie im Hausprotokoll: nicht bei gesetzter Mehrheit (Ä-09, M2).
					regelfassung: zeileDesHauses?.mehrheitGesetzt
						? null
						: (zeileDesHauses?.regelfassung ?? null),
					lesart: zeileDesHauses?.lesart ?? null,
					// Das Ergebnis nach der anderen Lesart als Feststellung, wie am Ausgang
					// des Hausprotokolls; das Abenddokument ist das einzige
					// Protokoll des Abends (zweite Codeprüfung Teil 3, M1).
					// Beide Lesarten in einem Absatz (Migrationen 169 und 170).
					// Nur, was auch das Hausprotokoll nennt (`zweitesErgebnisImProtokoll`;
					// Codeprüfung P11, H1): zu L8 nicht «dasselbe Ergebnis».
					nachAndererLesart: zeileDesHauses?.auszaehlung
						? andereLesartenVon(zeileDesHauses.auszaehlung)
								.filter(zweitesErgebnisImProtokoll)
								.map((r) => andereLesartInWorten(r, zeileDesHauses.auszaehlung!.geheim).protokoll)
								.filter((t): t is string => t !== null)
								.join(' ') || null
						: null,
					// Der Grund aus der Auswertung (oben, `zurueckgezogen`), an jeder Zeile.
					rueckzug: zurueckgezogen,
					/*
					 * **Stichentscheid und frühere Durchgänge wie im Hausprotokoll**
					 * (Probe Wertquotenmehr, 17.11.2026, B1 und B2). Nur neben einem
					 * Ergebnis; der Kern setzt sie in dessen Zweig.
					 */
					stichentscheid:
						zeileDesHauses?.satz && zeileDesHauses.stichentscheid
							? { ...zeileDesHauses.stichentscheid, begruendung: zeileDesHauses.stichentscheid.begruendung ?? null }
							: null,
					gleichstand: zeileDesHauses?.auszaehlung ? gleichstandInZahlen(zeileDesHauses.auszaehlung) : null,
					ausgangsvermerke: (zeileDesHauses?.auszaehlung?.protokollhinweise ?? [])
						.filter((h) => h.ort === 'ausgang' && h.ohneNamen)
						.map((h) => h.ohneNamen!),
					ersetztNachRueckkommen: zeileDesHauses?.ersetztNachRueckkommen ?? [],
					/*
					 * «N. Durchgang.» wie im Hausprotokoll, wo ein Rückkommen den
					 * früheren ersetzt hat; nicht nach einer Neuabstimmung davor
					 * oder nach Eintritt der Beschlussfähigkeit, deren Sätze den
					 * massgebenden selbst nennen (`protokollentwurf`).
					 */
					durchgangszeile: (() => {
						const d = zeileDesHauses?.durchgang ?? null;
						if (!d || d < 2 || (zeileDesHauses?.ersetztNachRueckkommen ?? []).length === 0) return null;
						if ((zeileDesHauses?.neuabstimmungen ?? []).some((n) => n.nummer < d)) return null;
						if (v?.nachQuorumJeTraktandum.get(traktandumId)) return null;
						return d;
					})(),
					// Nach einem angenommenen Rückkommen ohne neue Abstimmung, wie im
					// Hausprotokoll (Codeprüfung Block B, N2).
					rueckkommenOhneDurchgang: zeileDesHauses?.rueckkommenOhneDurchgang ?? null,
					rueckkommenNichtGenutzt: zeileDesHauses?.rueckkommenNichtGenutzt ?? null,
					handzaehlung: zeileDesHauses?.handzaehlung ?? null,
					ausstandswirkung: zeileDesHauses?.auszaehlung?.ausstandswirkung ?? null,
					/*
					 * **Die Vermerke zur Bezugsgrösse ohne Namen** (Codeprüfung P11,
					 * H1): nur die, die eine Fassung ohne Eigentümernamen haben
					 * (`Protokollhinweis.ohneNamen`), bisher die ruhenden Vollmachten
					 * der Verwaltung (Entscheid 3). Dieselbe Zeile wie im
					 * Hausprotokoll, mit der Zahl statt der Namen der Vertretenen;
					 * die Namen stehen im Abschlusspaket des Hauses.
					 */
					bezugsgroessenvermerke: (zeileDesHauses?.auszaehlung?.protokollhinweise ?? [])
						.filter((h) => h.ort === 'bezugsgroesse' && h.ohneNamen)
						.map((h) => h.ohneNamen!),
					// L8 am Beschluss, oben je Traktandum gerechnet (`l8Zeilenlage`).
					...(v?.l8JeTraktandum.get(traktandumId) ?? {}),
					betroffenenzeilen: betroffenenzeilenAmAbend(
						zeileDesHauses?.auszaehlung ?? null,
						v?.parteien ?? []
					),
					beschlusstext: zeileDesHauses?.beschlusstext ?? null,
					// Der Vermerk dieses Hauses, oben gerechnet; der Kern schweigt
					// damit zur Lücke und `offeneErgebnisse` zählt sie nicht.
					beschlussvermerk,
					// Ä-17 B, wie im Hausprotokoll (Codeprüfung 3d, M2).
					// Nicht neben einer konsultativen Abstimmung (Codeprüfung Block 7, R3-N3).
					neuAnZweiterVersammlung:
						zeileDesHauses?.auszaehlung?.keinBeschluss?.grund !== 'konsultativ' &&
						(v?.neueAnZweiter.has(traktandumId) ?? false),
					// Ohne Beschluss nur die Tatsache (Review DeepSeek zu Block 7, Befund 1).
					neuAnZweiterWahl: zeileDesHauses?.auszaehlung?.keinBeschluss ? null : (v?.neutraktandenwahl ?? null),
					// A5, Punkt 8: die Regel des Reglements für die zweite Versammlung.
					neuAnZweiterRegel: v?.regelZweite ?? null,
					anfechtungssonderfall: zeileDesHauses?.anfechtungssonderfall ?? null,
					neuAnZweiterErsteFehlte:
						v && zeileDesHauses && v.neutraktandenwahl && v.neueAnZweiter.has(traktandumId)
							? ersteFehlteAmBeschluss({
									stimmkraft: v.stimmkraft,
									anwesende: zeileDesHauses.durchgangId
										? v.anwesendeJeDurchgang.get(zeileDesHauses.durchgangId)
										: null,
									regelErste: v.regelErste,
									auszaehlung: zeileDesHauses.auszaehlung
								})
							: null,
					/*
					 * Die Tatsache, nicht der Weg, wie im Hausprotokoll; gerechnet mit
					 * derselben Kernfunktion und den Grössen dieses Hauses.
					 */
					beschlussfaehigkeitFehlte:
						v && zeileDesHauses
							? beschlussfaehigkeitFehlteAmBeschluss({
									stimmkraft: v.stimmkraft,
									anwesende: zeileDesHauses.durchgangId
										? v.anwesendeJeDurchgang.get(zeileDesHauses.durchgangId)
										: null,
									stufe: v.stufe,
									regel: v.regel,
									auszaehlung: zeileDesHauses.auszaehlung
								})
							: null,
					/*
					 * L7, die Vorgabe am Beschluss (Migration 183): Hing die
					 * Beschlussfähigkeit an den Personen im Ausstand, steht die
					 * Tatsache am Beschluss, je eingefrorener Wahl dieses Hauses.
					 */
					ohneAusstandFehlte:
						v && zeileDesHauses && zeileDesHauses.durchgangId && stufeFuerL7
							? ausstandFehlteAmBeschluss({
									wahl: v.ausstandswahl,
									stimmkraft: v.stimmkraft,
									anwesende: v.anwesendeJeDurchgang.get(zeileDesHauses.durchgangId) ?? null,
									vertretungen: v.vertretungenJeDurchgang.get(zeileDesHauses.durchgangId) ?? [],
									ausstand: v.ausstandJeDurchgang.get(zeileDesHauses.durchgangId) ?? null,
									stufe: stufeFuerL7,
									regel: stufeFuerL7 === 'erste' ? v.regelErste : v.regel,
									auszaehlung: zeileDesHauses.auszaehlung
								})
							: null,
					/*
					 * Der zweite Durchgang nach Eintritt der Beschlussfähigkeit,
					 * je Haus mit dessen Grössen gerechnet; der Satz steht im
					 * Abenddokument an derselben Stelle wie im Hausprotokoll.
					 */
					nachQuorum: v?.nachQuorumJeTraktandum.get(traktandumId) ?? null,
					einwand: zeileDesHauses?.auszaehlung?.vonHand?.einwand?.bestimmung ?? null,
					einwandEinfuehrung: zeileDesHauses?.auszaehlung?.vonHand?.einwand?.einfuehrung ?? null,
					einwandNotwendig:
						zeileDesHauses?.auszaehlung?.vonHand?.einwand?.knotenId === NOTWENDIGE_MASSNAHME_KNOTEN,
					// Gekappt wie im Hausprotokoll — Begründung bei `nurAngaben`.
					pendenzen: nurAngaben(v?.pendenzen.get(traktandumId)),
					// Ohne Namen: Dieses Dokument geht an alle beteiligten Gemeinschaften.
					ruegen: ruegeangaben(v?.ruegen.get(traktandumId), { ohneName: true }),
					// Seit es nur noch ein Protokoll gibt, gehört die Notiz der
					// Sitzungsleitung hierher (Auftraggeber, 12.08.2026: «Nicht pro Haus»).
					notiz: v?.notizen.get(traktandumId) ?? null,
					art: abstimmung ? ('abstimmung' as const) : ('kenntnisnahme' as const)
			}
		};
	};
	const zaehle = (abstimmung: boolean, offen: boolean) => {
		if (!abstimmung) return;
		abstimmungenGesamt += 1;
		if (offen) offeneErgebnisse += 1;
	};

	for (const zeile of liste.filter((l) => l.tiefe === 1)) {
		// Beim Sammelpunkt die Unterpunkte einsammeln; sonst die eigenen.
		const unterpunkte = liste.filter(
			(l) => l.tiefe === 2 && l.geschaeftId === zeile.geschaeftId
		);
		const traegt =
			zeile.traktanden.length > 0 ? zeile.traktanden : unterpunkte.flatMap((u) => u.traktanden);

		const ergebnisse = traegt.map((t) => {
			const v = jeVersammlung.get(t.meetingId);
			const nummerImHaus = v?.nummerJeTraktandum.get(t.traktandumId) ?? null;
			const zeileDesHauses = nummerImHaus ? v?.zeilenJeNummer.get(nummerImHaus) : undefined;
			// Der Wortlaut des Hauses, aber nur wenn er abweicht — sonst stünde er
			// unter jedem Unterpunkt noch einmal.
			const eigener = geschaefte
				.find((g) => g.geschaeftId === zeile.geschaeftId)
				?.haeuser.find((h) => h.traktandumId === t.traktandumId);
			const abweichenderTitel =
				eigener && eigener.abweichend && eigener.titel.trim() !== zeile.titel.trim()
					? eigener.titel
					: null;

			/*
			 * **Nur Abstimmungen können ein Ergebnis schulden.** Eine Kenntnisnahme
			 * hat keines — sie als Lücke zu zählen hiesse, dass ein Protokoll mit
			 * Begrüssung und Stimmenzählerwahl nie vollständig würde.
			 */
			const art = unterpunkte.find((u) => u.traktanden.some((x) => x.traktandumId === t.traktandumId))?.art
				?? zeile.art;
			const abstimmung = art !== 'kenntnisnahme' && art !== 'sammelpunkt';
			const haus = angabenDesHauses(v, t.traktandumId, zeileDesHauses, abstimmung);
			zaehle(abstimmung, haus.offen);
			/*
			 * **Die Folgeanträge dieses Hauses zum Antrag, je mit eigener Zeile**
			 * (Produktentscheid 08.11.2026). Sie zählen wie die Zeile des Hauses:
			 * ein nie abgestimmter ist offen, wie er im Hausprotokoll ohne
			 * Ergebnis dasteht und vor dem Siegel genannt wird.
			 */
			const folgeantraege = (v?.folgeantraegeJeAntrag.get(t.traktandumId) ?? []).map((f) => {
				const zeileDesFolgeantrags = v!.zeilenJeNummer.get(f.nummer);
				const abstimmt = (zeileDesFolgeantrags?.art ?? f.knoten.art) === 'abstimmung';
				const fa = angabenDesHauses(v, f.knoten.id, zeileDesFolgeantrags, abstimmt);
				zaehle(abstimmt, fa.offen);
				return {
					...fa.felder,
					nummer: f.nummer,
					gemeinschaft: t.gemeinschaft,
					abweichenderTitel: null,
					titel: f.knoten.titel,
					antragswortlaut: f.knoten.antragswortlaut ?? null,
					...(f.knoten.spontanart === 'rueckkommen'
						? {
								rueckkommen: true,
								/*
								 * Abgelehnt: Es bleibt beim bisherigen Ergebnis (Laienprüfung
								 * Runde 2, R2-L6). Sonst läse sich «Abgelehnt» unter «Rückkommen
								 * auf 9.1 …» wie die Ablehnung der Sache.
								 */
								...(ergebnislage(zeileDesFolgeantrags?.auszaehlung) === 'abgelehnt'
									? {
											// Das Ziel des Rückkommens, nicht der Anfang der Kette
											// (Codeprüfung Block B, N1: Rückkommen auf einen Folgeantrag).
											bleibtBeim: f.knoten.rueckkommenZielId
												? (v!.nummerJeTraktandum.get(f.knoten.rueckkommenZielId) ?? null)
												: null
										}
									: {})
							}
						: {})
				};
			});

			return {
				nummer: nummern.get(t.traktandumId) ?? zeile.nummer,
				gemeinschaft: t.gemeinschaft,
				abweichenderTitel,
				...haus.felder,
				folgeantraege
			};
		});

		if (ergebnisse.length === 0) ohneZuordnung += 1;

		punkte.push({
			nummer: zeile.nummer,
			titel: zeile.titel,
			antragswortlaut: zeile.antragswortlaut,
			ergebnisse
		});
	}

	/*
	 * **Im Saal aufgenommen** (16.11.2026), in der Reihenfolge der Tafel: je Haus
	 * ein eigener Punkt mit der Nummer des Hauses, durch denselben Zeilenbau wie
	 * jede Hauszeile, also mit Ergebnis, Votum, Rügen und Pendenzen (Codeprüfung
	 * Block B, M1 und M2). Was die Seite «Geschäfte» schon in die gemeinsame
	 * Liste übernommen hat (`vereinheitlicheListe`), steht dort und nicht noch
	 * einmal hier (M3). Eine Kenntnisnahme schuldet kein Ergebnis und zählt nicht.
	 */
	const inListe = new Set(liste.flatMap((l) => l.traktanden.map((t) => t.traktandumId)));
	for (const z of tafel) {
		const v = jeVersammlung.get(z.meetingId);
		for (const t of v?.imSaal ?? []) {
			if (inListe.has(t.knoten.id)) continue;
			const zeileDesHauses = v!.zeilenJeNummer.get(t.nummer);
			const abstimmung = (zeileDesHauses?.art ?? t.knoten.art) === 'abstimmung';
			const haus = angabenDesHauses(v, t.knoten.id, zeileDesHauses, abstimmung);
			zaehle(abstimmung, haus.offen);
			punkte.push({
				nummer: t.nummer,
				titel: t.knoten.titel,
				ueberschrift: `Im Saal aufgenommen, ${v!.gemeinschaftsname}: ${t.nummer} ${t.knoten.titel}`,
				antragswortlaut: t.knoten.antragswortlaut ?? null,
				ergebnisse: [
					{
						nummer: t.nummer,
						gemeinschaft: v!.gemeinschaftsname,
						abweichenderTitel: null,
						...haus.felder,
						folgeantraege: []
					}
				]
			});
		}
	}

	/*
	 * **Die Lücke zuerst, dann der Text.** Sie entscheidet, ob das Dokument als
	 * Entwurf herauskommt — und ein Entwurf trägt weder Titel noch
	 * Unterschriftsblock eines vollständigen Protokolls. Seit es unterschrieben
	 * werden kann, ist das keine Feinheit mehr.
	 */
	const luecke = protokollluecke({
		versammlungen: tafel.length,
		offeneErgebnisse,
		ohneZuordnung,
		nichtGeschlossen: tafel.filter(
			(z) => z.zustand !== 'geschlossen' && z.zustand !== 'versiegelt'
		).length
	});

	const eingabe: GemeinsamesProtokoll = {
		bezeichnung: tag.bezeichnung,
		datum: tag.datum,
		uhrzeit: tag.uhrzeit,
		ort: tag.ort,
		teilnahme,
		punkte,
		erzeugtAm,
		erzeugtDurch,
		luecke,
		unterschriften,
		sitzungsleitung: tag.sitzungsleitung,
		protokollfuehrung: tag.protokollfuehrung
	};

	return {
		text: gemeinsamerProtokollentwurf(eingabe),
		luecke,
		versammlungen: tafel.length,
		// Nur die Liste des Abends, ohne im Saal Aufgenommenes (zweiter Durchgang der Codeprüfung B, Befund 2).
		punkte: punkte.filter((p) => !p.ueberschrift).length,
		offeneErgebnisse,
		abstimmungenGesamt,
		ohneZuordnung
	};
}

/**
 * Hält die Zusammenstellung des Abends als Fassung eines Hauses fest (A2,
 * Produktentscheid 03.10.2026: «Fassung je Haus»).
 *
 * **Warum es diese Schreibstelle gibt.** Am Haus eines gemeinsamen Abends
 * entsteht kein eigenes Protokoll; `minutes` bleibt leer, und ein festgehaltener
 * Wortlaut liesse sich dort nicht abholen. Der Versandnachweis je Haus braucht
 * ihn trotzdem: Im Streitfall ist die Frage, welchen Text dieses Haus verschickt
 * hat. Er ist die Zusammenstellung des Abends in diesem Augenblick — sie
 * entsteht bei jedem Aufruf neu, und genau der Augenblick des Festhaltens wird
 * abgelegt.
 *
 * **Die Fassungen zweier Häuser können deshalb abweichen.** Sie werden zu
 * verschiedenen Zeitpunkten festgehalten, und was zwischen den beiden Aufrufen
 * im Abenddokument ändert sich mit (etwa das Siegel eines weiteren Hauses oder
 * ein Nachtrag). Das ist gewollt: Jedes Haus belegt den Stand, den es verschickt
 * hat, und die Fassung bleibt als Abzug genau dieses Standes lesbar; die
 * Schreibregeln samt Siegel-Sperre stehen in `halteFassungFest`.
 *
 * **Der eine Schreibweg.** Die Zeile entsteht über `halteFassungFest`, mit dem
 * Wortlaut als Parameter. Eine zweite Insert-Stelle daneben liefe bei der
 * nächsten Regeländerung auseinander.
 *
 * bindung: meetingId — die Schranke steht hinter dem Aufruf: `hausDesAbends`
 * liest die Tafel des Abends über `tagId` und sucht das Haus darin; eine fremde
 * Kennung wirft, bevor der Text entsteht.
 * bindung: tagId — dasselbe, von der anderen Seite her gelesen.
 */
export async function halteFassungAmAbendFest(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	tagId: Id,
	art: Fassungsart,
	bemerkung: string | null | undefined,
	erzeugtAm: string
): Promise<Protokollfassung> {
	/*
	 * **Die Bindung des Hauses an den Abend** (`hausDesAbends`). Der Abend kommt
	 * aus der Adresse der Hausseite, das Haus aus ihrer Kennung; ohne diese
	 * Prüfung liesse sich mit beiden Werten ein fremdes Haus als Teil des Abends
	 * ausgeben. Dieselbe Schranke wie an den Aktionen des Abends.
	 */
	await hausDesAbends(handelnder.operatorId, tagId, meetingId);

	const zusammenstellung = await stelleAbendzusammenstellungZusammen(
		handelnder.operatorId,
		tagId,
		erzeugtAm,
		handelnder.label ?? ''
	);
	if (!zusammenstellung) {
		throw new FachlicherFehler(
			'unbekannt',
			'Diese Versammlung gehört zu keinem gemeinsamen Abend.',
			'protokoll'
		);
	}
	return halteFassungFest(handelnder, meetingId, art, bemerkung, zusammenstellung.text);
}
