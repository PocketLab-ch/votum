/**
 * Das Abschlusspaket erzeugen und versiegeln (Welle 2, FR-51 bis FR-55).
 *
 * Der Kern in `$lib/domain/siegel` bestimmt die Form des Manifests und wie
 * geprüft wird; hier wird zusammengetragen, gerechnet und geschrieben (AD-1).
 *
 * **Die Reihenfolge ist nicht beliebig:**
 *
 *   1. Alles lesen, solange noch gelesen werden darf.
 *   2. Dateien bauen, Prüfsummen bilden, Manifest setzen — damit steht das
 *      Siegel fest.
 *   3. Den Zeitstempel **auf das Siegel** holen und seine Antwort mit ins Paket
 *      legen (FR-53). Das geht nur hier: Danach ist das Paket zu.
 *   4. Paket packen und ablegen, Siegel eintragen — und **erst dann** die
 *      Versammlung auf «versiegelt» setzen.
 *
 * Andersherum liefe der Schreibschutz (FR-55) gegen die eigene Erzeugung: Die
 * Auslöser weisen ab dem Zustandswechsel jede Änderung an Stimmen, Anwesenheit
 * und Vollmachten ab — auch die des Siegels selbst.
 */
import { wahlInWorten, type Neutraktandenwahl } from '$lib/domain/lesarten';
import { NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL } from '$lib/domain/mehrhinweise';
import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { alsBetreiber } from './db';
import { legeInternAb, lies } from './dateien';
import { schreibeVerlauf, zeitquelle, type Handelnder } from './audit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	EREIGNISARTEN,
	angabenInWorten,
	beschriftung,
	ereignis,
	nichtZugeordnet,
	type AngabenAufloeser
} from '$lib/domain/verlauf';
import { ERFORDERNISQUELLEN, typnamenAus, wertwoerter } from '$lib/domain/verlaufswerte';
import { holeRegelwerk } from '$lib/rules';
import { dosZeitstempel, packe } from '$lib/domain/archiv';
import {
	manifestAlsJson,
	manifestInWorten,
	type Manifest,
	type Manifesteintrag
} from '$lib/domain/siegel';
import { bezeuge, dienst, ersatzdienst } from './zeitstempel';
import { erzeugeAuswertung } from './pdf/auswertung';
import { erzeugeStimmnachweis, type Stimmzeile } from './pdf/stimmnachweis';
import { erzeugeVerlauf, type VerlaufszeileImBlatt } from './pdf/verlauf';
import { zeitpunktKurz } from '$lib/domain/datum';
import { holeAuswertung } from './auswertung';
import { abgebrochen } from '$lib/domain/abstimmung';
import { holeVersammlung } from './versammlungen';
import { holeGemeinschaft } from './gemeinschaften';
import { holeMomentaufnahme } from './freigabe';
import { holeAnwesenheitsereignisse } from './anwesenheit';
import { holeNachweise, holeParteien, holeVollmachten } from './vollmacht';
import { holeEmpfehlungen } from './selbstvollmacht';
import { holeNeueTraktandenDerZweiten, holeTraktanden } from './traktanden';
import { holeDurchgaenge, holeErgebnisse, holeStimmenDerVersammlung } from './abstimmung';
import { PaketFehler } from './paketpruefung';
import { holeWidersprueche } from './universal';
import {
	ausstandslesartWirkt,
	klammer,
	kopfzaehlweiseSiegelzeile,
	lesartenZeileMitHerkunft,
	letzteStimmen
} from '$lib/domain/auszaehlung';
import { angehoerigenlesartWirkt, erfordernisSteht, l3Wirkt } from '$lib/domain/entscheidbaum';
import { holeAnhaengeDerVersammlung } from './anhaenge';
import { holeRuegenListe } from './ruege';
import { leseVerlauf, type Verlaufszeile } from './verlaufsabfrage';
import type { HeadCountMode, Id, Zeitpunkt } from '$lib/domain/types';

function sha256(inhalt: Uint8Array | string): string {
	return createHash('sha256').update(inhalt).digest('hex');
}

const kodierer = new TextEncoder();

/** Eine Datei des Pakets, bevor sie eine Prüfsumme hat. */
interface Bestandteil {
	pfad: string;
	inhalt: Uint8Array;
	beschreibung: string;
}

function alsJson(wert: unknown): Uint8Array {
	return kodierer.encode(JSON.stringify(wert, null, 2));
}

/**
 * Ein Dateiname, der auf jedem System durchgeht.
 *
 * Umlaute bleiben, weil sie in Namen von Eigentümern vorkommen und ein Paket
 * mit «Muelller» statt «Müller» im Streitfall Fragen aufwirft, die niemand
 * beantworten will. Verboten wird nur, was Pfade zerreisst.
 */
function dateinamensform(name: string): string {
	// Die Steuerzeichen sind hier der Gegenstand, nicht ein Versehen: Genau sie
	// zerreissen Pfade und sollen weg.
	// eslint-disable-next-line no-control-regex
	return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);
}

export interface Siegel {
	meetingId: Id;
	manifest: string;
	siegel: string;
	paketPruefsumme: string;
	paketGroesse: number;
	versiegeltAm: Zeitpunkt;
	versiegeltDurch: string | null;
	zeitstempel: 'ausstehend' | 'vorhanden' | 'gescheitert';
	zeitstempelAm: Zeitpunkt | null;
	zeitstempelStelle: string | null;
	zeitstempelBemerkung: string | null;
	/**
	 * Ob der Ersatzdienst das Siegel bezeugt hat (13.11.2026).
	 *
	 * **Ein eigenes Feld und kein Textvergleich.** Die Bemerkung nennt den
	 * Grund im Klartext, aber ihr Wortlaut ist für Menschen geschrieben und
	 * darf sich ändern. Die Siegelseiten und der Betriebszustand fragen nach
	 * der Tatsache, nicht nach einem Satz.
	 */
	zeitstempelVomErsatz: boolean;
	/**
	 * SHA-256 über die Antwort des Zeitstempeldienstes.
	 *
	 * Stand in der Tabelle, wurde aber nirgends herausgereicht. Seit der Abdruck
	 * im Protokoll steht (22.08.2026), wird er gebraucht: Er ist es, der die
	 * Bezeugung selbst überprüfbar macht, wenn das Paket einmal fehlt.
	 */
	zeitstempelAbdruck: string | null;
}

interface SiegelZeile {
	meeting_id: string;
	manifest: string;
	manifest_hash: string;
	package_hash: string;
	package_bytes: number;
	sealed_at: Date;
	sealed_by_label: string | null;
	timestamp_state: 'ausstehend' | 'vorhanden' | 'gescheitert';
	timestamp_at: Date | null;
	timestamp_authority: string | null;
	timestamp_note: string | null;
	timestamp_hash: string | null;
	timestamp_by_fallback: boolean;
}

function ausDb(z: SiegelZeile): Siegel {
	return {
		meetingId: z.meeting_id,
		manifest: z.manifest,
		siegel: z.manifest_hash,
		paketPruefsumme: z.package_hash,
		paketGroesse: z.package_bytes,
		versiegeltAm: z.sealed_at.toISOString(),
		versiegeltDurch: z.sealed_by_label,
		zeitstempel: z.timestamp_state,
		zeitstempelAm: z.timestamp_at?.toISOString() ?? null,
		zeitstempelStelle: z.timestamp_authority,
		zeitstempelBemerkung: z.timestamp_note,
		zeitstempelVomErsatz: z.timestamp_by_fallback,
		zeitstempelAbdruck: z.timestamp_hash
	};
}

export async function holeSiegel(operatorId: Id, meetingId: Id): Promise<Siegel | null> {
	return alsBetreiber(operatorId, async (tx) => leseSiegel(tx, meetingId));
}

async function leseSiegel(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<Siegel | null> {
	const [z] = await tx<SiegelZeile[]>`SELECT * FROM seal WHERE meeting_id = ${meetingId}`;
	return z ? ausDb(z) : null;
}

/**
 * Wie ein Durchgang in einer Absage heisst: Nummer und Traktandum.
 *
 * Eine Stelle für den Gegenstand im Blatt und für die Absagen beim Versiegeln
 * (B4d, 03.10.2026): Beide nennen «Durchgang N zu Traktandum M ‹Titel›».
 */
function durchgangInWorten(
	d: { nummer: number; traktandumId: Id },
	traktanden: Awaited<ReturnType<typeof holeTraktanden>>
): string {
	const t = traktanden.find((x) => x.knoten.id === d.traktandumId);
	return `Durchgang ${d.nummer}${t ? ` zu Traktandum ${t.nummer} «${t.knoten.titel}»` : ''}`;
}

/**
 * Der erste Durchgang, dessen Ergebnis sich nicht lesen oder nicht auswerten
 * lässt, als Satz; `null`, wenn keiner da ist.
 *
 * **Eine gemeinsame Prüfung** (Nachzug-Abnahme, B4b): `erhebeSiegellage` nennt
 * das Hindernis auf der Siegelseite, statt den Knopf anzubieten, der in die
 * Absage führt; `trageZusammen` wirft denselben Satz. Zwei Abschriften liefen
 * auseinander, und die schwächere wäre die, die den Knopf stehen liesse.
 *
 * **Der Grund, warum es die Prüfung gibt:** `holeErgebnisse` schluckt einen
 * solchen Durchgang mit Absicht (die Eigentümerseite soll an einem Geschäft
 * nicht scheitern); im Siegelpaket fiele `stimmen.json` dann still auf
 * «einzelstimmen» zurück und behauptete eine Erfassungsart, die nicht
 * festgeschrieben ist (`tests/db/siegel.test.ts`).
 */
function ergebnisHindernis(
	durchgaenge: Awaited<ReturnType<typeof holeDurchgaenge>>,
	traktanden: Awaited<ReturnType<typeof holeTraktanden>>,
	ergebnisse: Awaited<ReturnType<typeof holeErgebnisse>>
): string | null {
	for (const d of durchgaenge) {
		// Mit dem Traktandum: Die Nummer des Durchgangs zählt je Traktandum,
		// «Durchgang 1» gibt es an jedem.
		const welcher = durchgangInWorten(d, traktanden);
		const ergebnis = ergebnisse.get(d.id);
		if (ergebnis?.unlesbar) {
			return (
				`${welcher}: Das festgeschriebene Ergebnis ist in einem Format, das ` +
				'diese Fassung der Anwendung nicht lesen kann. Das Paket wird nicht versiegelt: ' +
				'Die Stimmenübersicht würde sonst etwas anderes über diesen Durchgang aussagen, als ' +
				'festgeschrieben ist.'
			);
		}
		if (!ergebnis) {
			return (
				`${welcher} liess sich nicht auswerten. Das Paket wird nicht ` +
				'versiegelt, weil die Stimmenübersicht sonst etwas über ihn aussagte, das nicht ' +
				'belegt ist. Versuchen Sie es noch einmal; bleibt es dabei, braucht es den Betrieb.'
			);
		}
	}
	return null;
}

// ── Das Paket zusammentragen (FR-51) ────────────────────────────────────────

/**
 * Baut die Bestandteile des Pakets.
 *
 * **Offenes Format für die Daten, Original für die Dateien** (FR-51): JSON
 * lässt sich in zehn Jahren noch lesen, ein Datenbankabzug nicht. Die
 * Unterlagen bleiben, wie sie hochgeladen wurden — ein umgewandeltes PDF wäre
 * nicht mehr dasselbe Dokument.
 */
async function trageZusammen(
	operatorId: Id,
	meetingId: Id,
	jetzt: string
): Promise<{ bestandteile: Bestandteil[]; gemeinschaft: string; versammlung: Awaited<ReturnType<typeof holeVersammlung>> }> {
	const versammlung = await holeVersammlung(operatorId, meetingId);
	if (!versammlung) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');

	const [gemeinschaft, momentaufnahme, momentparteien, ereignisse, vollmachten, nachweise, traktanden, durchgaenge, anhaenge, auswertung, widersprueche] =
		await Promise.all([
			holeGemeinschaft(operatorId, versammlung.stwegId),
			holeMomentaufnahme(operatorId, meetingId),
			// Die Zeilen der Momentaufnahme mit ihren Namen — der Verlauf trägt
			// bei Anwesenheitsereignissen die Kennung der Zeile, nicht die Partei.
			holeParteien(operatorId, meetingId),
			holeAnwesenheitsereignisse(operatorId, meetingId),
			holeVollmachten(operatorId, meetingId),
			holeNachweise(operatorId, meetingId),
			holeTraktanden(operatorId, meetingId),
			holeDurchgaenge(operatorId, meetingId),
			holeAnhaengeDerVersammlung(operatorId, meetingId),
			holeAuswertung(operatorId, meetingId),
			holeWidersprueche(operatorId, meetingId)
		]);

	// Die Weisungen je Vollmacht — erst jetzt, weil sie die Liste der
	// Vollmachten voraussetzen.
	const weisungen = new Map(
		await Promise.all(
			vollmachten.map(async (v) => [v.id, await holeEmpfehlungen(operatorId, v.id)] as const)
		)
	);

	/*
	 * Der Verlauf **vollständig**, nicht seitenweise (FR-56: «Der Verlauf einer
	 * Versammlung ist Teil ihres Abschlusspakets»). Gelesen wird über dieselbe
	 * Abfrage wie die Anzeige, nur ohne Grenze — zwei Wege zum selben Verlauf
	 * liefen früher oder später auseinander.
	 *
	 * **Über die Zugehörigkeit zur Versammlung, nicht über ihren Gegenstand**
	 * (Block 3, 01.10.2026). `gegenstand: meetingId` traf nur, was `subject_id`
	 * gleich der Versammlungskennung trug: Freigabe, Eröffnung, Schluss. Der
	 * weitaus grösste Teil des Abends hängt aber an seinem Traktandum, an einem
	 * Durchgang, an einer Vollmacht oder an der Momentaufnahme einer Partei
	 * (`gehoertZu` in `verlaufsabfrage.ts` kann genau das). Mit dem alten
	 * Gegenstandsfilter trug das Paket einen halben Verlauf, und **niemand sähe
	 * es**: Das Paket ist kleiner, das Siegel hält, die Prüfung meldet nichts.
	 */
	const verlauf: Verlaufszeile[] = [];
	let erwartet = 0;
	for (let seite = 0; seite < 200; seite++) {
		const { zeilen, weitere, gesamt } = await leseVerlauf(operatorId, {
			seite,
			versammlung: meetingId
		});
		verlauf.push(...zeilen);
		if (zeilen.length > 0) erwartet = gesamt;
		if (!weitere) break;
	}
	/*
	 * **Ein abgeschnittener Verlauf wird nicht versiegelt** (Abnahme Block 3,
	 * 01.10.2026). Die Schleife endet nach 200 Seiten ohne Meldung, und gelesen
	 * wird absteigend: Abgeschnitten würde der Anfang des Abends, das Siegel
	 * hielte, und das PDF nennte die gekürzte Zahl als Zahl der Einträge. Mit
	 * dem weiten Filter kommen deutlich mehr Zeilen zusammen als vorher. Die
	 * Abfrage zählt ohnehin mit; stimmen Zahl und Liste nicht überein, entsteht
	 * kein Paket.
	 */
	if (verlauf.length !== erwartet) {
		throw new FachlicherFehler(
			'nicht_moeglich',
			`Der Verlauf dieser Versammlung liess sich nicht vollständig lesen (${verlauf.length} von ` +
				`${erwartet} Einträgen). Das Paket wird nicht versiegelt, weil es unvollständig wäre. ` +
				'Versuchen Sie es noch einmal; bleibt es dabei, braucht es den Betrieb.',
			'zustand'
		);
	}

	/**
	 * Den Gegenstand eines Verlaufseintrags in Worten.
	 *
	 * **Warum hier und nicht im PDF-Modul.** Die Auflösung braucht die Listen
	 * dieser Versammlung (Traktanden, Durchgänge, Vollmachten, Momentparteien);
	 * sie liegen in dieser Funktion bereits vor. Das PDF-Modul zeichnet nur.
	 *
	 * **Seit B2 zweigeteilt** (03.10.2026): `findeGegenstand` liefert nur den
	 * Treffer oder `null`; die Kennungen in den Angaben brauchen dieselbe
	 * Auskunft, aber mit der Rückfallform des *Feldes* statt der des
	 * Gegenstands. Eine zweite Nachschlagestelle gäbe es damit nicht.
	 */
	const findeGegenstand = (art: string | null, id: string | null): string | null => {
		if (art === 'meeting') return 'Die Versammlung';
		if (art === 'agenda_item') {
			const t = traktanden.find((x) => x.knoten.id === id);
			if (t) return `Traktandum ${t.nummer} «${t.knoten.titel}»`;
			/*
			 * **Ein entferntes Traktandum steht mit seinem Titel da.** Seine
			 * Zeile ist gelöscht; `holeTraktanden` kennt es nicht mehr, und ohne
			 * diesen Zweig schriebe das Blatt «Traktandum (01a0f6c1…)», eine
			 * Kennung, die niemandem etwas sagt. Der Titel steht in den Angaben
			 * des Entfernen-Ereignisses, das in derselben Verlaufsliste liegt.
			 */
			const entfernt = verlauf.find(
				(z) =>
					z.art === EREIGNISARTEN.traktandumEntfernt &&
					z.gegenstandId === id &&
					z.angaben?.versammlung === meetingId &&
					typeof z.angaben?.titel === 'string'
			);
			if (entfernt) return `Traktandum «${entfernt.angaben.titel}» (entfernt)`;
			return null;
		}
		if (art === 'voting_round') {
			const d = durchgaenge.find((x) => x.id === id);
			// Dieselbe Benennung wie in den Absagen (B4d).
			return d ? durchgangInWorten(d, traktanden) : null;
		}
		if (art === 'proxy') {
			const p = vollmachten.find((x) => x.id === id);
			return p ? `Vollmacht: ${p.bevollmaechtigtName ?? '?'} für ${p.vertreteneName}` : null;
		}
		if (art === 'snapshot_party') {
			const p = momentparteien.find((x) => x.id === id);
			/*
			 * **Eine Benennung, keine Feststellung** (B-6): «Stimmberechtigt:
			 * Bucher» las sich, als stelle das Blatt fest, Bucher sei
			 * stimmberechtigt. «Stimmberechtigung von Bucher» benennt den
			 * Gegenstand des Eintrags, wie «Traktandum 3 …» und «Durchgang 2 …».
			 */
			return p ? `Stimmberechtigung von ${p.name}` : null;
		}
		return null;
	};

	/**
	 * Der Gegenstand mit Rückfallform.
	 *
	 * Ein nicht aufgelöster Gegenstand wird **nicht verschwiegen**: Er steht mit
	 * Art und kurzer Kennung da. Ein Verlauf, der einen Eintrag stillschweigend
	 * ohne Gegenstand zeigt, verlöre genau die Angabe, die ihn auffindbar macht.
	 *
	 * **Und er sagt, was die Zeichenfolge ist** (Laienprüfung 01.10.2026, B-4):
	 * eine interne Kennung, keine Traktandennummer. Die Formen baut
	 * `nichtZugeordnet`.
	 */
	const gegenstandInWorten = (art: string | null, id: string | null): string => {
		const gefunden = findeGegenstand(art, id);
		if (gefunden !== null) return gefunden;
		// Unbekannte Arten kommen heute nicht vor; die Rohbezeichnung sagt mehr
		// als «unbekannt», und die Kennung macht den Eintrag auffindbar.
		// `gegenstandsart()` aus `domain/verlauf.ts` gehört erst mit dem Block
		// «Verlaufsblatt lesbar» hierher (siehe `angaben` unten).
		return art ? nichtZugeordnet(art, id) : '';
	};

	/**
	 * **Dieselbe Auflösung für die Kennungen in den Angaben** (B2, 03.10.2026).
	 *
	 * Welcher Schlüssel auf welche Liste zeigt, steht hier an einer Stelle; die
	 * Anzeige bringt ihren eigenen, kleineren Auflöser mit (sie kennt nur
	 * Gemeinschaften und Versammlungen). `null` heisst «gesucht, nicht
	 * gefunden» und gibt die Rückfallform; `undefined` heisst «hier nicht
	 * gesucht» und lässt die Kennung neutral stehen. Gesucht wird nur in dieser
	 * Versammlung: Eine fremde Kennung findet hier nichts.
	 *
	 * `vorher` und `nachher` tragen beim Aufruf eines Traktandums dessen
	 * Kennung, bei anderen Ereignissen etwas anderes; gefunden wird deshalb nur,
	 * was ein Traktandum dieser Versammlung ist, sonst bleibt es neutral.
	 */
	const angabenAufloesen: AngabenAufloeser = (wert, schluessel) => {
		if (schluessel === 'versammlung') {
			return wert === meetingId ? 'diese Versammlung' : null;
		}
		if (schluessel === 'gemeinschaft' || schluessel === 'stweg' || schluessel === 'mitgliedsgemeinschaft') {
			return gemeinschaft?.id === wert ? gemeinschaft.name : null;
		}
		/*
		 * `snapshotPartei` trägt trotz des Namens die Partei, nicht die Zeile
		 * der Momentaufnahme (`Anwesenheitsereignis.parteiId`); gesucht wird
		 * deshalb wie bei `partei` in beiden Spalten.
		 */
		if (
			schluessel === 'snapshotPartei' ||
			schluessel === 'partei' ||
			schluessel === 'parteiId' ||
			schluessel === 'mitglied' ||
			schluessel === 'aus_person' ||
			schluessel === 'bisherigePartei'
		) {
			return momentparteien.find((p) => p.id === wert || p.parteiId === wert)?.name ?? null;
		}
		if (
			schluessel === 'traktandum' ||
			schluessel === 'traktandumId' ||
			schluessel === 'stattTraktandumId' ||
			schluessel === 'verschoben' ||
			schluessel === 'neuerElternteil' ||
			schluessel === 'vor'
		) {
			return findeGegenstand('agenda_item', wert);
		}
		if (schluessel === 'vorher' || schluessel === 'nachher') {
			return findeGegenstand('agenda_item', wert) ?? undefined;
		}
		return undefined;
	};

	/*
	 * Die Bezeichnungen der Erfordernistypen («Qualifiziertes Mehr») stehen nur
	 * im Regelwerk; geholt wie auf der Verlaufsseite (`+page.server.ts`), damit
	 * `wertwoerter()` sie übersetzen kann.
	 */
	const typnamen = typnamenAus(holeRegelwerk());

	/*
	 * **Aufsteigend, nicht wie die Anzeige.** `leseVerlauf` liefert absteigend
	 * (das Neueste zuerst), und die Seiten werden in dieser Reihenfolge
	 * aneinandergehängt. Auf einem Beweisdokument liest man den Abend vorwärts;
	 * das Umdrehen der ganzen Liste erhält die Ordnung auch bei gleichem
	 * Zeitpunkt.
	 */
	const verlaufszeilen: VerlaufszeileImBlatt[] = [...verlauf].reverse().map((z) => ({
		zeitpunkt: z.zeitpunkt.toISOString(),
		zeitquelle: z.zeitquelle,
		eintrag: beschriftung(z.art),
		gegenstand: gegenstandInWorten(z.gegenstandArt, z.gegenstandId),
		person: z.handelnder,
		/*
		 * **Die Werte in Worten** (Block mit Laienprüfung, 08.10.2026). Bis
		 * dahin standen sie hier als Codewörter («Zählweise: per_owner»),
		 * während die Verlaufsseite sie seit V1 (06.10.2026) übersetzte. Das
		 * Blatt ist ein Text nach aussen; derselbe Wortlaut wie auf der Seite
		 * kommt über `wertwoerter()` aus `domain/verlaufswerte.ts`.
		 */
		angaben: angabenInWorten(z.angaben, angabenAufloesen, wertwoerter(z.art, typnamen))
	}));

	const bestandteile: Bestandteil[] = [];

	bestandteile.push({
		pfad: 'daten/versammlung.json',
		inhalt: alsJson({
			versammlung,
			gemeinschaft: gemeinschaft
				? {
						id: gemeinschaft.id,
						name: gemeinschaft.name,
						quotaDenominator: gemeinschaft.quotaDenominator,
						headCountMode: gemeinschaft.headCountMode,
						headCountRuleSource: gemeinschaft.headCountRuleSource,
						tieBreak: gemeinschaft.tieBreak,
						tieBreakRuleSource: gemeinschaft.tieBreakRuleSource
					}
				: null
		}),
		beschreibung: 'Die Versammlung mit Datum, Ort, Art und die Angaben der Gemeinschaft.'
	});

	bestandteile.push({
		pfad: 'daten/stimmberechtigte.json',
		inhalt: alsJson(momentaufnahme),
		beschreibung:
			'Wer mit welchen Einheiten und Wertquoten stimmberechtigt war — festgehalten bei der ' +
			'Freigabe, samt Zählweise und ihrer Fundstelle.'
	});

	bestandteile.push({
		pfad: 'daten/anwesenheit.json',
		inhalt: alsJson(ereignisse),
		beschreibung:
			'Jedes Eintreffen und jeder Weggang mit Zeitpunkt und Weg — die Grundlage jeder ' +
			'Feststellung der Beschlussfähigkeit.'
	});

	bestandteile.push({
		pfad: 'daten/vollmachten.json',
		inhalt: alsJson(
			vollmachten.map((v) => ({
				...v,
				nachweise: nachweise.get(v.id) ?? [],
				// **Die Weisungen gehören dazu.** Sie erklären, warum jemand so
				// abgestimmt hat — und sie halten fest, auf welchen Antragswortlaut
				// sie sich bezogen. Ohne das liesse sich später nicht mehr sagen, ob
				// eine Weisung zum Zeitpunkt der Abstimmung überhaupt noch galt.
				weisungen: weisungen.get(v.id) ?? []
			}))
		),
		beschreibung:
			'Wer wen aufgrund welchen Nachweises vertreten hat, mit Bestätigung, Zurückweisung ' +
			'und Widerruf — und mit den Weisungen, die dabei erteilt wurden.'
	});

	bestandteile.push({
		pfad: 'daten/traktanden.json',
		inhalt: alsJson(traktanden),
		beschreibung:
			'Die Traktanden mit Antragswortlaut, angewandtem Mehrheitserfordernis und dem ' +
			'beschrittenen Pfad durch den Entscheidbaum.'
	});

	bestandteile.push({
		pfad: 'daten/abstimmungen.json',
		/*
		 * **Die Widersprüche als eigene Liste** (Migration 129; Codeprüfung Block
		 * 4a, M-b). Bis dahin standen sie am Durchgang und reisten mit ihm ins
		 * Paket. Seit sie am Geschäft sitzen, gibt es auch den vor dem Eröffnen,
		 * zu dem es keinen Durchgang gibt; nach dem Löschen nach Frist ist das
		 * Paket der einzige Beleg.
		 */
		inhalt: alsJson({ durchgaenge, auswertung, widersprueche: [...widersprueche.values()] }),
		beschreibung:
			'Jeder Abstimmungsdurchgang mit Kopfstimmen und Wertquoten, dem angewandten ' +
			'Erfordernis und dem Ergebnis, dazu die Widersprüche gegen die Universalversammlung.'
	});

	/*
	 * **Die Rügen im Saal** (Ä-06, Migration 160). Sie halten fest, dass vor
	 * der Abstimmung ein Mangel beanstandet wurde, und das erhält das
	 * Anfechtungsrecht (Wermelinger Rz. 69a ad Art. 712n). Gelesen über eine
	 * eigene Verbindung wie alles hier; die Schreibwege warten auf das Siegel,
	 * weil `objection` denselben Schreibschutz trägt wie die übrigen Tabellen
	 * (Migration 157). Die Datei steht auch ohne Rüge da: Eine leere Liste sagt,
	 * dass keine festgehalten wurde; eine fehlende Datei liesse offen, ob das
	 * Paket aus der Zeit vor dem Feld stammt.
	 */
	const ruegen = await holeRuegenListe(operatorId, meetingId);
	bestandteile.push({
		pfad: 'daten/ruegen.json',
		inhalt: alsJson(
			ruegen.map((r) => ({
				...r,
				traktandum: traktanden.find((t) => t.knoten.id === r.traktandumId)?.knoten.titel ?? null
			}))
		),
		beschreibung:
			'Die Rügen im Saal: zu welchem Traktandum, was gerügt wurde, um welche Uhrzeit, wer ' +
			'gerügt hat und wie der Vorsitz vorging (Feld «entscheid»). Eine leere Liste heisst, ' +
			'dass keine festgehalten wurde. Ein späterer Rückzug der Rüge oder ein Beschluss, das ' +
			'Traktandum zu verschieben, steht nicht hier, sondern im Protokoll.'
	});

	/*
	 * **Die einzelnen Stimmen** (Produktentscheid 17.09.2026; Zweitprüfung der
	 * juristischen Gegenlesung, Ä-39/Ä-40).
	 *
	 * Bis dahin trug das Paket nur die Zahlen je Durchgang. Wird eine Auszählung
	 * bestritten, lässt sich mit Zahlen nichts nachrechnen: Die Frage ist dann,
	 * wessen Stimme falsch gezählt wurde. Die Namen stehen aus der Momentaufnahme
	 * daneben, weil die Parteien nach dem Löschen der Versammlung nicht mehr
	 * nachzuschlagen sind.
	 *
	 * **Nicht ins Protokoll.** Dort bleibt es bei den Zahlen, ausser das
	 * Erfordernis verlangt Namen (Einstimmigkeit, Zustimmung Direktbetroffener)
	 * oder das Reglement sieht namentliche Voten vor. Das Paket liegt bei
	 * der Stelle, die es aufbewahrt, das Protokoll geht an alle.
	 */
	const namenJeStimmpartei = new Map(
		(momentaufnahme?.parties ?? []).map((p) => [p.partyId, p.displayName])
	);
	const stimmenJeDurchgang = await holeStimmenDerVersammlung(operatorId, meetingId);
	/*
	 * **Die Festschreibung je Durchgang** (Block 3, Punkt 4). Der von Hand
	 * festgehaltene Beschluss hat keine Zeilen in `vote`: Die Tabelle verlangt
	 * einen offenen Durchgang, und er entsteht geschlossen (`vonhand.ts`). Seine
	 * Wahl je Partei und seine Zahlen stehen in `result_json`; ohne diesen
	 * Lesezugriff enthielte das Paket sie in keiner Datei, und die leere
	 * Stimmliste läse sich wie «niemand hat gestimmt».
	 */
	const ergebnisse = await holeErgebnisse(
		operatorId,
		meetingId,
		durchgaenge.map((d) => d.id)
	);
	/*
	 * **Ein Durchgang, der sich nicht auswerten lässt, hält das Siegel auf**
	 * (Nachzug Block 2c; «Offen aus Block 3», Punkt 8). `holeErgebnisse`
	 * schluckt einen solchen Durchgang mit Absicht — auf der Eigentümerseite
	 * (Verlauf der verkündeten Beschlüsse) soll ein einzelnes Geschäft nicht
	 * die ganze Seite zum Fehler machen. Im Siegelpaket ist das anders:
	 * `daten/stimmen.json` fiel dort still auf «einzelstimmen» zurück und
	 * behauptete eine Erfassungsart, die zum Durchgang nicht gehört. Beim
	 * Versiegeln gilt deshalb: lieber keine Datei als eine falsche.
	 *
	 * **Seit B4b dieselbe Prüfung wie auf der Siegelseite:** Der Satz kommt aus
	 * `ergebnisHindernis`, damit der Knopf dort nicht stehen bleibt.
	 */
	const hindernis = ergebnisHindernis(durchgaenge, traktanden, ergebnisse);
	if (hindernis) {
		throw new FachlicherFehler('nicht_moeglich', hindernis, 'zustand');
	}
	const stimmen = durchgaenge.map((d) => {
		const abgegeben = stimmenJeDurchgang.get(d.id) ?? [];
		/*
		 * **Welche Zeile gezählt hat** (Code-Review 17.09.2026). Eine Berichtigung
		 * fügt eine Zeile hinzu, die alte bleibt stehen (AD-5); gezählt hat die
		 * letzte je Einheit. Ohne diese Marke summierte, wer die Datei liest, eine
		 * berichtigte Einheit doppelt.
		 */
		const gezaehlt = new Set([...letzteStimmen(abgegeben).values()]);
		/*
		 * **Ein ohne Ergebnis abgebrochener Durchgang hat nichts gezählt** (H6,
		 * Codeprüfung N3; mitgenommen in H8). Bis dahin trugen seine Stimmen
		 * `gezaehlt: true`, und ohne Feld am Durchgang las er sich wie einer, der
		 * später durch eine Neuabstimmung überholt wurde.
		 */
		const ohneErgebnis = abgebrochen(d);
		const auszaehlung = ergebnisse.get(d.id)?.auszaehlung ?? null;
		const vonHand = auszaehlung?.vonHand ?? null;
		return {
			durchgangId: d.id,
			traktandumId: d.traktandumId,
			nummer: d.nummer,
			/*
			 * **Von Hand gezählt heisst: keine Einzelstimmen** (Code-Review
			 * 17.09.2026). Beides zugleich gibt es nicht, `erfasseSummen` weist es
			 * ab. Eine leere Liste ohne diesen Vermerk läse sich wie «niemand hat
			 * gestimmt».
			 */
			erfassung: vonHand ? 'von_hand' : d.handzaehlung ? 'handzaehlung' : 'einzelstimmen',
			handzaehlung: d.handzaehlung,
			/*
			 * **Der von Hand festgehaltene Durchgang, vollständig.** Die Wahl je
			 * Partei mit dem Namen aus der Momentaufnahme (nach dem Löschen der
			 * Versammlung ist die Kennung allein nichts wert), dazu die Zahlen,
			 * die daraus folgen oder eingetragen wurden. `null` bei den
			 * Wertquoten heisst «nicht eingetragen», wie überall.
			 */
			vonHand:
				vonHand && auszaehlung
					? {
							erfassung: vonHand.erfassung,
							stimmen:
								vonHand.stimmen?.map((s) => ({
									partei: s.partei,
									name: namenJeStimmpartei.get(s.partei) ?? null,
									wahl: s.wahl
								})) ?? null,
							koepfe: {
								ja: auszaehlung.koepfe.ja,
								nein: auszaehlung.koepfe.nein,
								enthaltung: auszaehlung.koepfe.enthaltung
							},
							quoten:
								auszaehlung.quotenErhoben === false
									? null
									: {
											ja: auszaehlung.quoten.ja,
											nein: auszaehlung.quoten.nein,
											enthaltung: auszaehlung.quoten.enthaltung
										},
							// Die eingewendete Bestimmung (Entscheid 0046, A7); `null` beim
							// Notweg, wie bei älteren Durchgängen.
							einwand: vonHand.einwand?.bestimmung ?? null,
							einfuehrung: vonHand.einwand?.einfuehrung ?? null
						}
					: null,
			ueberholtAm: d.ueberholtAm,
			abgebrochen: ohneErgebnis,
			// Konsultativ abgestimmt (Migration 158): ohne Beschluss (H7, Teil B,
			// Befund 9; mitgenommen in H8).
			konsultativ: d.konsultativ,
			// Geheime Abstimmung (Migration 141): Diese Zeilen gehen in eine eigene
			// Datei, getrennt von den offenen Durchgängen.
			geheim: d.geheim,
			stimmen: abgegeben.map((v) => ({
				...v,
				name: namenJeStimmpartei.get(v.partyId) ?? null,
				gezaehlt: !ohneErgebnis && gezaehlt.has(v)
			}))
		};
	});

	bestandteile.push({
		pfad: 'daten/stimmen.json',
		inhalt: alsJson(stimmen.filter((s) => !s.geheim)),
		beschreibung:
			'Jede abgegebene Stimme mit Stimmpartei, Einheit, Wahl und Zeitpunkt. Dazu, ob die ' +
			'Sitzungsleitung sie erfasst hat und ob sie gezählt hat — eine Berichtigung lässt die ' +
			'frühere Zeile stehen. Bei einem von Hand gezählten Durchgang steht statt Stimmen die ' +
			'Summe, beim Beschluss von Hand die Wahl je Partei mit Namen und die Zahlen aus der ' +
			'Festschreibung. Ein ohne Ergebnis abgebrochener Durchgang ist als solcher vermerkt, ' +
			'seine Stimmen haben nicht gezählt. Ein konsultativer Durchgang ist ebenfalls ' +
			'vermerkt; er ergibt keinen Beschluss. Geheime Abstimmungen stehen getrennt in ' +
			'daten/geheime-stimmen.json.'
	});

	/*
	 * **Die Einzelstimmen einer geheimen Abstimmung, getrennt und vertraulich**
	 * (Produktentscheid 28.09.2026: «die geheime Abstimmung muss ins Paket, da
	 * das Paket der Unveränderbarkeit unterliegt»; die Trennung ist der Entwurf
	 * beim Bau). Sie stehen nicht in `stimmen.json`, damit ein Herausgeber nur
	 * dieses Blatt zurückhalten kann; das Manifest führt die Datei getrennt mit
	 * eigener Prüfsumme. Geöffnet wird sie für ein Gericht oder für Stimmende,
	 * die ihre eigene Stimme verlangen (DSG Art. 25) — nicht für Dritte.
	 */
	const geheimeStimmen = stimmen.filter((s) => s.geheim);
	if (geheimeStimmen.length > 0) {
		bestandteile.push({
			pfad: 'daten/geheime-stimmen.json',
			inhalt: alsJson(geheimeStimmen),
			beschreibung:
				'Einzelstimmen geheimer Abstimmungen, mit Stimmpartei, Einheit, Wahl und Zeitpunkt. ' +
				'Vertraulich: für ein Gericht oder für Stimmende, die ihre eigene Stimme verlangen ' +
				'(DSG Art. 25), nicht für die Weitergabe an die Gemeinschaft.'
		});
	}

	bestandteile.push({
		pfad: 'Entscheidungsweg.txt',
		inhalt: kodierer.encode(
			entscheidungsweg(traktanden, durchgaenge, momentaufnahme?.headCountMode ?? null, {
				neu: await holeNeueTraktandenDerZweiten(operatorId, meetingId),
				wahl: momentaufnahme?.lesarten?.L5 ?? null
			})
		),
		beschreibung:
			'Wie das Mehrheitserfordernis je Traktandum zustande kam: Fassung des Regelwerks, ' +
			'Fragen und Antworten im Wortlaut, Rechtsgrundlage und Begründung.'
	});

	bestandteile.push({
		pfad: 'daten/verlauf.json',
		inhalt: alsJson(verlauf),
		beschreibung:
			'Der lückenlose Verlauf: jede fachlich bedeutsame Handlung mit Zeitpunkt und ' +
			'handelnder Person.'
	});

	/*
	 * **Derselbe Verlauf als lesbares Dokument** (Plan Beschluss von Hand,
	 * Block 3). Das JSON trägt ihn vollständig, aber für ein Gericht ist es
	 * keine lesbare Fassung. Die Auflösung der Gegenstände ist oben geschehen;
	 * hier entsteht nur das Blatt.
	 */
	bestandteile.push({
		pfad: 'Verlauf.pdf',
		inhalt: await erzeugeVerlauf({
			gemeinschaftName: gemeinschaft?.name ?? '',
			versammlung: versammlung!,
			zeilen: verlaufszeilen,
			pfadImPaket: 'Verlauf.pdf',
			erzeugtAm: jetzt
		}),
		beschreibung:
			'Der Verlauf als lesbares Dokument: jede Handlung mit Datum, Zeit, Eintrag, ' +
			'Gegenstand, handelnder Person und Angaben, in der Reihenfolge des Ablaufs.'
	});

	if (auswertung && gemeinschaft) {
		bestandteile.push({
			pfad: 'Auswertung.pdf',
			inhalt: await erzeugeAuswertung({
				versammlung,
				gemeinschaftName: gemeinschaft.name,
				zaehlweise: auswertung.zaehlweise,
				stichentscheid: auswertung.stichentscheid,
				zeilen: auswertung.zeilen,
				erzeugtAm: jetzt
			}),
			beschreibung: 'Das lesbare Ergebnis je Traktandum — für Menschen, nicht für Maschinen.'
		});
	}

	/*
	 * **Der Stimmnachweis, ein Blatt je Traktandum** (Vorgabe des Auftraggebers, 22.09.2026).
	 *
	 * `Auswertung.pdf` daneben führt **keine** Namen zum Stimmverhalten
	 * (NFR-17), weil sie an alle Eigentümer geht. Die Namen liegen aber längst
	 * im Paket, in `daten/stimmen.json`; was fehlte, war die lesbare Form.
	 *
	 * **Je Traktandum eine eigene Datei, nicht ein Dokument mit vielen Seiten.**
	 * Das Manifest führt je Bestandteil eine eigene Prüfsumme. Eine einzelne
	 * Datei lässt sich damit gegen das Manifest prüfen, ohne dass die übrigen
	 * herausgehen; läge alles in einem PDF, müsste zur Prüfung der ganze Abend
	 * auf den Tisch. Im Klagefall geht ein Blatt heraus, nicht die Versammlung.
	 *
	 * **Und je Traktandum, nicht je Durchgang.** Angefochten wird der Beschluss.
	 * Ein Blatt je Durchgang liesse sich als Ergebnis weitergeben, obwohl der
	 * Durchgang überholt ist.
	 */
	/*
	 * **Ein Name, der schon im Archiv liegt, bekommt einen Zusatz.** `packe`
	 * wirft bei doppelten Namen, und das wäre hier kein Schutz, sondern ein
	 * Abbruch des Versiegelns. Je Verzeichnis ein eigener Satz, damit eine
	 * Unterlage und ein Stimmnachweis gleichen Namens einander nicht
	 * umbenennen.
	 */
	const eindeutig = (name: string, namen: Set<string>) => {
		let versuch = name;
		let n = 2;
		while (namen.has(versuch)) {
			const punkt = name.lastIndexOf('.');
			versuch = punkt > 0 ? `${name.slice(0, punkt)} (${n})${name.slice(punkt)}` : `${name} (${n})`;
			n++;
		}
		namen.add(versuch);
		return versuch;
	};

	if (auswertung && gemeinschaft) {
		/*
		 * Bezeichnung und Wertquote der Einheit kommen aus der Momentaufnahme,
		 * nicht aus den lebenden Stammdaten (AD-3): Nach dem Löschen der
		 * Versammlung sind die Einheiten nicht mehr nachzuschlagen, und eine
		 * später geänderte Quote machte das Blatt unerklärbar.
		 */
		const einheitJeId = new Map(
			(momentaufnahme?.parties ?? []).flatMap((p) =>
				p.units.map((e) => [e.unitId, { label: e.label, quota: e.quota }] as const)
			)
		);
		const stimmenJeDurchgangId = new Map(stimmen.map((s) => [s.durchgangId, s]));
		const blattnamen = new Set<string>();

		for (const z of auswertung.zeilen) {
			// Kenntnisnahmen haben kein Stimmverhalten. Ein leeres Blatt dazu
			// wäre ein Dokument, das nichts belegt und trotzdem Namen trägt.
			if (z.art !== 'abstimmung' || !z.durchgangId) continue;

			const durchgang = stimmenJeDurchgangId.get(z.durchgangId);
			const zeilen: Stimmzeile[] = (durchgang?.stimmen ?? []).map((v) => {
				const einheit = einheitJeId.get(v.unitId);
				return {
					name: v.name ?? 'ohne Namen in der Momentaufnahme',
					/*
					 * Kein Rückfall auf die Kennung und keine Null: Eine UUID als
					 * Einheitsbezeichnung und «0 Wertquoten» sind beide keine
					 * Lücke, sondern eine falsche Angabe auf einem Blatt, das
					 * vor Gericht geht. Fehlt der Treffer, sagt das Blatt das.
					 */
					einheit: einheit?.label ?? 'Einheit nicht in der Momentaufnahme',
					quote: einheit?.quota ?? null,
					wahl: v.choice,
					gezaehlt: v.gezaehlt,
					durchSitzungsleitung: v.recordedByChair,
					zeitpunkt: zeitpunktKurz(v.castAt),
					erfasstIso: v.castAt
				};
			});

			/*
			 * **Die Wahl je Partei** (Block 3, Punkt 4). Beim Beschluss von Hand
			 * steht sie in der Festschreibung des Durchgangs, nicht in `vote`;
			 * ohne sie zeigte das Blatt «keine Stimme erfasst» neben den Zahlen,
			 * die aus ihr folgen. Der Name kommt aus der Momentaufnahme, wie
			 * überall (AD-3).
			 */
			const vonHand = z.auszaehlung?.vonHand ?? null;
			const parteiwahlen = vonHand?.stimmen
				? vonHand.stimmen.map((s) => ({
						name: namenJeStimmpartei.get(s.partei) ?? 'ohne Namen in der Momentaufnahme',
						wahl: s.wahl
					}))
				: null;

			/*
			 * **Durch `eindeutig`, wie die beiden anderen Verzeichnisse.** Auf
			 * `manual_number` liegt keine Eindeutigkeitsbedingung, zwei
			 * Traktanden dürfen beide «4.1» heissen. `packe` wirft bei
			 * doppelten Namen, und sein Docstring verlangt diesen Schritt
			 * ausdrücklich. Ohne ihn wäre die Versammlung am Abend geschlossen
			 * und dauerhaft **nicht versiegelbar**: `setzeNummer` greift nur im
			 * Entwurf, die Nummer liesse sich danach nicht mehr ändern.
			 * Gefunden im Code-Review am 22.09.2026.
			 */
			const pfad = `stimmnachweis/${eindeutig(`T-${dateinamensform(z.nummer)}.pdf`, blattnamen)}`;
			bestandteile.push({
				pfad,
				inhalt: await erzeugeStimmnachweis({
					gemeinschaftName: gemeinschaft.name,
					versammlung,
					zaehlweise: auswertung.zaehlweise,
					zeile: z,
					stimmen: zeilen,
					parteiwahlen,
					pfadImPaket: pfad,
					erzeugtAm: jetzt
				}),
				beschreibung:
					`Stimmnachweis zu Traktandum ${z.nummer}: Erfordernis, Quoren, Ergebnis und ` +
					'wer wie gestimmt hat. Namentlich, für den Streitfall und für Nachfragen, ' +
					'nicht für den Versand an die Gemeinschaft.' +
					(z.auszaehlung?.geheim
						? ' Geheime Abstimmung: Diese Urkunde ist vertraulich und nur für ein Gericht ' +
							'oder für Stimmende bestimmt, die ihre eigene Stimme verlangen.'
						: '')
			});
		}
	}

	// ── Unterlagen im Original ────────────────────────────────────────────

	const unterlagennamen = new Set<string>();
	for (const a of anhaenge) {
		bestandteile.push({
			pfad: `unterlagen/${eindeutig(dateinamensform(a.name), unterlagennamen)}`,
			inhalt: await lies(a.pruefsumme),
			beschreibung: `Unterlage zur Versammlung, hochgeladen am ${a.hochgeladenAm.slice(0, 10)}.`
		});
	}

	const vollmachtsnamen = new Set<string>();
	for (const [vollmachtId, dateien] of nachweise) {
		const v = vollmachten.find((x) => x.id === vollmachtId);
		for (const d of dateien) {
			bestandteile.push({
				pfad: `vollmachten/${eindeutig(dateinamensform(d.name), vollmachtsnamen)}`,
				inhalt: await lies(d.pruefsumme),
				beschreibung: v
					? `Nachweis zur Vollmacht: ${v.bevollmaechtigtName} für ${v.vertreteneName}.`
					: 'Nachweis zu einer Vollmacht.'
			});
		}
	}

	return { bestandteile, gemeinschaft: gemeinschaft?.name ?? '', versammlung };
}

/**
 * Der begangene Weg durch den Entscheidbaum, für Menschen lesbar.
 *
 * **Warum als Text und nicht als JSON** (Produktentscheid 17.09.2026): Die Daten
 * stehen schon in `daten/traktanden.json`. Wer in fünf Jahren wissen will, warum
 * für dieses Geschäft Einstimmigkeit galt, liest keine verschachtelte Struktur,
 * sondern die Fragen und Antworten in der Reihenfolge, in der sie gestellt
 * wurden. Die ganze Fassung des Regelwerks liegt nicht bei; der begangene Weg
 * trägt den Beschluss, die nicht begangenen Äste nicht.
 */
function entscheidungsweg(
	traktanden: Awaited<ReturnType<typeof holeTraktanden>>,
	durchgaenge: Awaited<ReturnType<typeof holeDurchgaenge>>,
	/** Die Zählweise der Momentaufnahme, für L3 (`l3Wirkt`); ohne sie keine Zeile zu L3. */
	zaehlweise: HeadCountMode | null,
	/** Die neuen Traktanden einer zweiten Versammlung und die eingefrorene Wahl zu L5. */
	l5: { neu: ReadonlySet<string>; wahl: Neutraktandenwahl | null }
): string {
	const zeilen: string[] = ['Entscheidungsweg je Traktandum', ''];

	for (const eintrag of traktanden) {
		const t = eintrag.knoten;
		zeilen.push(`${eintrag.nummer} ${t.titel}`);

		if (t.art !== 'abstimmung') {
			zeilen.push('  Kenntnisnahme — darüber wird nicht abgestimmt.', '');
			continue;
		}
		if (t.rueckzug) {
			zeilen.push('  Der Antrag wurde zurückgezogen.');
		}

		const e = t.erfordernis;
		if (!e) {
			zeilen.push('  Kein Mehrheitserfordernis festgehalten.', '');
			continue;
		}
		if (!erfordernisSteht(e)) {
			// Grenzfall: Der Baum kommt zu keinem Erfordernis, und ohne eines wird
			// nicht abgestimmt. Die Fragen stehen trotzdem da — sie zeigen, woran es
			// lag (`erfordernisSteht`, `entscheidbaum.ts`).
			zeilen.push('  Grenzfall: Der Entscheidbaum bestimmt kein Erfordernis.');
		} else {
			zeilen.push(`  Erfordernis: ${e.titel}`);
			// Leer bei einer Mehrheit, die die Leitung gesetzt hat (30.09.2026);
			// wie gesetzt wurde, sagt die Zeile «Hergeleitet» darunter.
			if (e.rechtsgrundlage) zeilen.push(`  Rechtsgrundlage: ${e.rechtsgrundlage}`);
		}
		zeilen.push(`  Regelwerksfassung: ${e.fassung}, Knoten ${e.knotenId}`);
		zeilen.push(`  Hergeleitet: ${ERFORDERNISQUELLEN[e.quelle] ?? e.quelle}`);
		if (e.fundstelle) zeilen.push(`  Fundstelle im Reglement: ${e.fundstelle}`);
		// Die Lesart der Gemeinschaft (Migration 169): Sie erklärt, warum das Mehr
		// von dem abweicht, was der Knoten dieser Fassung vorgibt.
		// Neutral, ohne «Gezählt nach»: Der Nachweis steht auch an Traktanden ohne
		// Auszählung (Codeprüfung Teil 4, niedrig 2).
		const l = e.gemeinschaftslesart;
		if (l) {
			zeilen.push(
				`  Eingestellte Lesart: ${lesartenZeileMitHerkunft(l)}`
			);
		}
		// L1 (Migration 170) nur beim Mehr aller Wertquoten: Nur dort entscheidet
		// sie, wer im Nenner steht. Und nur, wo das Erfordernis sie trägt: Ein
		// Traktandum von vorher bekommt keine Zeile, die es beim Siegeln nicht hatte.
		if (e.ausstandslesart && ausstandslesartWirkt(e)) {
			zeilen.push(`  Wertquote im Ausstand (Lesart L1): ${wahlInWorten('L1', e.ausstandslesart)}`);
		}
		// L3 (Migration 172): die eingefrorene Wahl an der Einsprache, wie L1 nur,
		// wo sie wirkt (`l3Wirkt`: ab Fassung 2026-10-28, Gemeinschaft je Einheit).
		// Die Spalte trägt jedes Traktandum mit Mehr; an einer älteren Einsprache
		// nannte die Zeile sonst eine Zählung, nach der nicht gezählt wurde
		// (Codeprüfung Block 5, M3).
		if (e.einspracheLesart && zaehlweise && l3Wirkt(e, { headCountMode: zaehlweise })) {
			zeilen.push(`  Zählung an der Einsprache (Lesart L3): ${wahlInWorten('L3', e.einspracheLesart)}`);
		}
		// L10 (Migration 189): die Zahl der Angehörigen im Ausstand an der
		// Ausschlussklage, wie L1 nur, wo sie wirkt (`angehoerigenlesartWirkt`).
		if (e.angehoerigenlesart && angehoerigenlesartWirkt(e)) {
			zeilen.push(
				`  Angehörige im Ausstand (Lesart L10): ${wahlInWorten('L10', e.angehoerigenlesart)}`
			);
		}
		// L13 (Migration 192): die Zählweise der Köpfe (`kopfzaehlweiseSiegelzeile`).
		const l13 = kopfzaehlweiseSiegelzeile(e);
		if (l13) zeilen.push(`  ${l13}`);
		/*
		 * L5 (Migration 174; Codeprüfung Block 7, N3): ob das Traktandum an der
		 * zweiten Versammlung neu war, und die Wahl aus der Momentaufnahme. Aus
		 * dem Protokollsatz und der Bezeichnung im Katalog; neu ist nur das
		 * Etikett «Lesart L5:», wie bei L1 und L3. Ohne Wahl (Momentaufnahme von
		 * vorher) nur die Tatsache.
		 */
		if (l5.neu.has(t.id)) {
			zeilen.push(
				`  ${NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL}` + (l5.wahl ? ` Lesart L5: ${wahlInWorten('L5', l5.wahl)}.` : '')
			);
		}
		if (e.begruendung) zeilen.push(`  Begründung der Abweichung: ${e.begruendung}`);
		if (e.pfad.length === 0) {
			zeilen.push('  Keine Fragen festgehalten — das Erfordernis wurde ohne den Baum gesetzt.');
		}
		for (const schritt of e.pfad) {
			zeilen.push(`  Frage: ${schritt.frageText}`);
			zeilen.push(`  Antwort: ${schritt.antwortText}`);
		}

		/*
		 * **Gezählt wurde nach der Regel, die beim Eröffnen galt** (Code-Review
		 * 17.09.2026). Der Durchgang friert sie ein (AD-4); das Traktandum trägt
		 * die heutige. Sie können auseinanderfallen, etwa wenn das Erfordernis
		 * nach einer Neuabstimmung geändert wurde. Dann steht beides da, sonst
		 * beschriebe die Datei eine Regel, nach der nie gezählt wurde.
		 */
		for (const d of durchgaenge.filter((x) => x.traktandumId === t.id)) {
			const g = d.erfordernis;
			const wie = g ? `${g.titel}${klammer(g.rechtsgrundlage)}` : 'ohne festgehaltenes Erfordernis';
			// Ein abgebrochener wurde nicht gezählt (H6, `brecheAbstimmungAb`).
			if (abgebrochen(d)) {
				zeilen.push(`  ${d.nummer}. Durchgang: ohne Ergebnis abgebrochen, eröffnet nach ${wie}`);
				continue;
			}
			const nachtrag = d.ueberholtAm ? ', später überholt' : '';
			/*
			 * **Konsultativ heisst: ohne Beschluss** (H7, Teil B, Codeprüfung
			 * Befund 9; mitgenommen in H8). Ohne den Vermerk las sich der Durchgang
			 * wie ein gewöhnlich gezählter. Die Warnzeile darunter gilt auch für
			 * ihn: Nach einer konsultativen Abstimmung lässt sich das Erfordernis
			 * ändern (H7, Teil D), und dann soll beides dastehen (Codeprüfung H8,
			 * N3).
			 */
			zeilen.push(
				d.konsultativ
					? `  ${d.nummer}. Durchgang: konsultativ abgestimmt, weil ` +
							// L5 (Migration 174; Codeprüfung Block 7, H1).
							(d.konsultativNeu
								? 'die Versammlung nicht beschlussfähig war wie eine erste (Lesart L5)'
								: 'die Versammlung nicht beschlussfähig war') +
							`; kein Beschluss. Ausgezählt nach ${wie}${nachtrag}`
					: `  ${d.nummer}. Durchgang: gezählt nach ${wie}${nachtrag}`
			);
			if (g && (g.knotenId !== e.knotenId || g.typ !== e.typ)) {
				zeilen.push(
					`  Achtung: Das Traktandum trägt heute ${e.titel} (Knoten ${e.knotenId}), gezählt wurde nach Knoten ${g.knotenId}.`
				);
			}
		}
		zeilen.push('');
	}

	return zeilen.join('\n');
}

// ── Versiegeln ──────────────────────────────────────────────────────────────

export interface Siegelbefund {
	moeglich: boolean;
	hindernisse: string[];
	siegel: Siegel | null;
}

export async function erhebeSiegellage(operatorId: Id, meetingId: Id): Promise<Siegelbefund> {
	const versammlung = await holeVersammlung(operatorId, meetingId);
	const siegel = await holeSiegel(operatorId, meetingId);
	const hindernisse: string[] = [];

	if (!versammlung) {
		return { moeglich: false, hindernisse: ['Versammlung nicht gefunden.'], siegel: null };
	}
	if (siegel) {
		return { moeglich: false, hindernisse: [], siegel };
	}
	// zustand-nur-geschlossen: Hier geht es um den Schritt VOR dem Siegel. Eine
	// versiegelte Versammlung ein zweites Mal zu versiegeln ist kein Nachweis,
	// sondern ein zweiter, der dem ersten widerspricht.
	if (versammlung.zustand !== 'geschlossen') {
		hindernisse.push(
			versammlung.zustand === 'laufend'
				? 'Die Versammlung läuft noch. Versiegelt wird, was feststeht.'
				: 'Die Versammlung ist noch nicht geschlossen. Erst mit dem Schluss stehen die Zahlen fest.'
		);
	}

	/*
	 * **Ein Durchgang ohne lesbares Ergebnis ist ein Hindernis, kein Knopf**
	 * (Nachzug-Abnahme, B4b). Bis dahin bot die Siegelseite «Versiegeln» an,
	 * und der Klick endete in der Absage aus `trageZusammen`; der Betrieb
	 * erfuhr die Ursache nur aus dem Log. Dieselbe Prüfung an derselben Stelle
	 * wie dort, nicht eine zweite Fassung.
	 */
	const [durchgaenge, traktanden] = await Promise.all([
		holeDurchgaenge(operatorId, meetingId),
		holeTraktanden(operatorId, meetingId)
	]);
	const ergebnisse = await holeErgebnisse(
		operatorId,
		meetingId,
		durchgaenge.map((d) => d.id)
	);
	/*
	 * **Kein Siegel über einem offenen Durchgang** (Pentest-Runde M7, Befund
	 * M7-A1, Folge c). Der Schluss schliesst offene Durchgänge mit; einer, der
	 * danach noch offen ist, stammt aus einem Fehler, und das Paket bezeugte ein
	 * Ergebnis, das nie verkündet wurde. Schliessen weist ihn ab; der Ausweg
	 * ist der Abbruch ohne Ergebnis (`brecheAbstimmungAb` prüft den Zustand der
	 * Versammlung mit Absicht nicht), den die Leitungsseite nach dem Schluss
	 * aber nicht anbietet. Deshalb der Betrieb; sein Ablauf steht in
	 * `docs/installation.md`.
	 *
	 * Nur bei «geschlossen»: In einer laufenden Versammlung ist eine offene
	 * Abstimmung der Normalfall, und das Hindernis «läuft noch» oben sagt
	 * schon alles.
	 */
	// zustand-nur-geschlossen: Bei «versiegelt» ist oben schon zurückgegeben,
	// das Siegel steht, und es gibt nichts mehr zu verhindern.
	const offen = versammlung.zustand === 'geschlossen' && durchgaenge.find((d) => d.zustand === 'offen');
	if (offen) {
		hindernisse.push(
			`${durchgangInWorten(offen, traktanden)} ist noch offen, obwohl die Versammlung ` +
				'geschlossen ist. Das kommt nur durch einen Fehler zustande und lässt sich hier nicht ' +
				'beheben; melden Sie es dem Betrieb, bevor Sie versiegeln.'
		);
	}
	const hindernis = ergebnisHindernis(durchgaenge, traktanden, ergebnisse);
	if (hindernis) hindernisse.push(hindernis);

	return { moeglich: hindernisse.length === 0, hindernisse, siegel: null };
}

/**
 * Versiegelt die Versammlung (FR-51 bis FR-53, FR-55).
 *
 * Der Zeitpunkt kommt von aussen (AD-1, AD-12): Im lokalen Betrieb ohne Netz
 * kann die Uhr des Notebooks falsch gehen, und das Manifest sagt deshalb
 * ausdrücklich, woher sie stammte.
 */
export async function versiegle(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	jetzt: string
): Promise<Siegel> {
	/*
	 * **Zusammentragen und Siegel unter einer Sperre** (Sicherheitsdurchgang
	 * 09.10.2026, Befund D7). Bis dahin lasen Lage und Paket ohne Sperre, und
	 * das Siegel kam danach in einer eigenen Transaktion. Was dazwischen
	 * geschrieben wurde, etwa ein Text zum Beschluss, stand in der Datenbank und
	 * nicht im Paket, und das Siegel bezeugte einen Stand, den die Datenbank
	 * danach nicht mehr hergab. Zwei Siegel zugleich endeten am eindeutigen
	 * Schlüssel als rohe Ausnahme.
	 *
	 * Jetzt hält diese Transaktion die Versammlung mit `FOR UPDATE`, vom Lesen
	 * der Lage bis zum Zustandswechsel. Gelesen wird weiter über eigene
	 * Verbindungen (`trageZusammen`); das genügt, weil die Schreibwege warten:
	 * Der Auslöser hinter jedem Schreibschutz liest eine geschlossene
	 * Versammlung mit `FOR KEY SHARE` (Migration 157), wartet also hier und
	 * sieht danach «versiegelt». Ein Schreiben an den geschützten Tabellen vor
	 * dem Sperren ist im Paket, eines danach wird abgewiesen. Nicht geschützt ist
	 * das Protokoll, das nicht zum Siegel gehört; sein Verlaufseintrag kann
	 * während des Versiegelns entstehen und fehlt dann im Paket, wie vorher.
	 *
	 * **`FOR UPDATE`, nicht `FOR NO KEY UPDATE`.** Nur gegen `FOR UPDATE` wartet
	 * das `FOR KEY SHARE` des Auslösers; mit der schwächeren Sperre liefen die
	 * Schreibwege durch, und `tests/db/abschluss-rennen.test.ts` («rohes
	 * Schreiben») würde rot. Keiner dieser Lesewege sperrt oder schreibt
	 * selbst; täte es einer, hinge er an der eigenen Sperre, und PostgreSQL sähe
	 * es nicht, weil der Kreis über zwei Verbindungen läuft.
	 *
	 * **Wie lange die Sperre hält:** so lange wie das Versiegeln, gemessen am
	 * 13.10.2026 rund vier Sekunden für 80 Parteien und zehn Traktanden, dazu
	 * der Zeitstempeldienst: höchstens drei Anläufe zu zehn Sekunden und zwei
	 * Pausen, seit dem Ersatzdienst (13.11.2026) danach noch dessen ein Anlauf,
	 * zusammen rund 43 Sekunden. Warten müssen in dieser Zeit nur
	 * Schreibwege an dieser Versammlung. Jeder hält dabei aber eine Verbindung
	 * aus dem Vorrat der ganzen Anwendung (zehn), aus dem auch `trageZusammen`
	 * liest; warteten genug, hinge das Siegel und mit ihm die Anwendung, ohne
	 * dass PostgreSQL es sieht. Nach dem Schluss schreibt kaum jemand mehr, und
	 * das Protokoll speichert nicht von selbst; hingenommen. Dasselbe Muster,
	 * kürzer, hat die Freigabe (`erhebeFreigabelage` unter der Sperre).
	 */
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`SELECT 1 FROM meeting WHERE id = ${meetingId} FOR UPDATE`;
		return versiegleUnterSperre(tx, handelnder, meetingId, jetzt);
	});
}

async function versiegleUnterSperre(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	jetzt: string
): Promise<Siegel> {
	const lage = await erhebeSiegellage(handelnder.operatorId, meetingId);
	if (lage.siegel) {
		throw new FachlicherFehler(
			'schon_versiegelt',
			'Diese Versammlung ist bereits versiegelt. Ein zweites Siegel hiesse, es gäbe zwei Wahrheiten darüber, was beschlossen wurde.',
			'zustand'
		);
	}
	if (!lage.moeglich) {
		throw new FachlicherFehler('nicht_moeglich', lage.hindernisse.join(' '), 'zustand');
	}

	const { bestandteile, gemeinschaft, versammlung } = await trageZusammen(
		handelnder.operatorId,
		meetingId,
		jetzt
	);

	const eintraege: Manifesteintrag[] = bestandteile.map((b) => ({
		pfad: b.pfad,
		groesse: b.inhalt.byteLength,
		pruefsumme: sha256(b.inhalt),
		beschreibung: b.beschreibung
	}));

	/*
	 * Der hinterlegte Dienst wird **vor** dem Manifest gelesen, weil seine
	 * Fingerabdrücke hineingehören. Der Stempel selbst kommt danach: Er lautet
	 * auf das Siegel, und das Siegel ist die Prüfsumme dieses Manifests.
	 *
	 * **Der Ersatzdienst kommt mit** (13.11.2026). Er kann das Siegel
	 * bezeugen, wenn der Hauptdienst ausfällt; nennte das Manifest ihn nicht,
	 * meldete die Prüfseite den Stempel des Ersatzes als Widerspruch im Paket.
	 * Welcher der beiden tatsächlich gestempelt hat, steht erst danach fest;
	 * darum ist beides Erwartung und nicht Ergebnis.
	 */
	const zeitdienst = await dienst(handelnder.operatorId);
	const zeitersatz = await ersatzdienst(handelnder.operatorId);

	const manifest: Manifest = {
		fassung: 1,
		gemeinschaft,
		versammlung: {
			kennung: meetingId,
			datum: versammlung!.datum,
			uhrzeit: versammlung!.uhrzeit,
			ort: versammlung!.ort,
			art: versammlung!.art,
			stufe: versammlung!.stufe,
			geschlossenAm: versammlung!.geschlossenAm ?? null
		},
		versiegeltAm: jetzt,
		versiegeltDurch: handelnder.label ?? '',
		/*
		 * Nur schreiben, wenn wirklich etwas angeheftet war. Ein leeres Feld
		 * sähe aus wie eine Zusage und wäre keine; ein fehlendes Feld sagt
		 * ehrlich, dass es keine Erwartung gab.
		 *
		 * **Der Ersatz zählt für sich** (13.11.2026): Ist ein Hauptdienst
		 * eingetragen, aber nur der Ersatz angeheftet, steht das Feld trotzdem
		 * da, mit leerer Liste beim Hauptdienst. Sonst meldete die Prüfseite
		 * einen Stempel des Ersatzes als Widerspruch.
		 *
		 * **Ohne Hauptdienst nicht** (Codeprüfung 13.11.2026, M1): Dann fragt
		 * `bezeuge` niemanden, auch den Ersatz nicht. Ein Manifest, das ihn
		 * trotzdem als einspringende Stelle nennt, beschriebe eine Ausweichung,
		 * die es nicht gab.
		 *
		 * **Und es ist kein Schutz gegen ein neu versiegeltes Paket**, siehe
		 * `Manifest.zeitstempelstelle`. Wer neu siegelt, schreibt es mit.
		 */
		...(zeitdienst && (zeitdienst.fingerabdruecke.length || zeitersatz?.fingerabdruecke.length)
			? {
					zeitstempelstelle: {
						fingerabdruecke: zeitdienst.fingerabdruecke,
						name: zeitdienst.name ?? null,
						url: zeitdienst.url ?? null,
						...(zeitersatz?.fingerabdruecke.length
							? {
									ersatz: {
										fingerabdruecke: zeitersatz.fingerabdruecke,
										name: zeitersatz.name ?? null,
										url: zeitersatz.url ?? null
									}
								}
							: {})
					}
				}
			: {}),
		zeitquelle: zeitquelle(),
		eintraege,
		nichtEnthalten: [
			{
				was: 'Das Protokoll',
				grund:
					'Es entsteht nach der Sitzung, wird redigiert und von der nächsten Versammlung ' +
					'genehmigt. Es wird getrennt geführt und ist nicht Teil dieses Siegels.'
			},
			{
				was: 'Zugangscodes und Wartelisten',
				grund:
					'Betriebsdaten ohne Beweiswert. Sie werden nach der Versammlung gelöscht und ' +
					'gehören nicht in ein Paket, das aufzubewahren ist, solange das Stockwerkeigentum ' +
					'besteht.'
			},
			{
				was: 'Die Notizen zu den Traktanden',
				grund:
					'Was im Saal gesagt wurde — Voten, Begründungen, Ordnungsentscheide. Es steht ' +
					'im Protokoll und wird dort redigiert; der Verlauf hält nur fest, dass notiert ' +
					'wurde und wie viele Zeichen. Wer sich auf ein Votum beruft, findet es nicht ' +
					'in diesem Paket.'
			}
		]
	};

	const manifestJson = manifestAlsJson(manifest);
	const siegel = sha256(manifestJson);
	const lesbar = manifestInWorten(manifest, siegel);

	// Der Zeitstempel lautet auf das **Siegel**, nicht auf das Paket — sonst
	// könnte er nicht hineingelegt werden, ohne das zu ändern, was er bezeugt.
	// Klappt es nicht, wird trotzdem versiegelt und später nachgeholt (AD-9).
	const stempel = await bezeuge(handelnder.operatorId, siegel);

	const dateien = [
		...bestandteile.map((b) => ({ name: b.pfad, inhalt: b.inhalt })),
		{ name: 'manifest.json', inhalt: kodierer.encode(manifestJson) },
		{ name: 'MANIFEST.txt', inhalt: kodierer.encode(lesbar) },
		...(stempel.roh ? [{ name: 'zeitstempel.tsr', inhalt: stempel.roh }] : [])
	];

	const paket = packe(dateien, dosZeitstempel(jetzt));
	const abgelegt = await legeInternAb(paket);

	await tx`
		INSERT INTO seal (operator_id, meeting_id, manifest, manifest_hash, package_hash,
		                  package_bytes, sealed_by, sealed_by_label, clock_source,
		                  timestamp_state, timestamp_at, timestamp_hash,
		                  timestamp_authority, timestamp_note, timestamp_by_fallback)
		VALUES (${handelnder.operatorId}, ${meetingId}, ${manifestJson}, ${siegel},
		        ${abgelegt.pruefsumme}, ${paket.byteLength}, ${handelnder.userId},
		        ${handelnder.label}, ${zeitquelle()},
		        ${stempel.zustand}, ${stempel.zeitpunkt}, ${stempel.pruefsumme},
		        ${stempel.stelle}, ${stempel.bemerkung}, ${stempel.ersatz === true})
	`;

	// **Erst jetzt** der Zustandswechsel: Ab hier weisen die Auslöser jede
	// Änderung an Stimmen, Anwesenheit und Vollmachten ab (FR-55). An
	// `geschlossen` gebunden als Netz unter der Lage oben (Befund D7).
	const versiegelt = await tx`
		UPDATE meeting SET state = 'versiegelt' WHERE id = ${meetingId} AND state = 'geschlossen'
	`;
	if (versiegelt.count !== 1) {
		throw new FachlicherFehler(
			'nicht_moeglich',
			'Die Versammlung hat während des Versiegelns ihren Zustand gewechselt. Laden Sie die ' +
				'Seite neu.',
			'zustand'
		);
	}

	await schreibeVerlauf(tx, handelnder, [
		ereignis(EREIGNISARTEN.versammlungVersiegelt, { art: 'meeting', id: meetingId }, {
			siegel,
			paket: abgelegt.pruefsumme,
			bestandteile: eintraege.length,
			groesse: paket.byteLength,
			zeitstempel: stempel.zustand,
			// Getrennt von der Bemerkung, wie am Siegel selbst (13.11.2026):
			// Wer den Verlauf durchsucht, findet den Ersatz ohne Satzsuche.
			ersatz: stempel.ersatz === true
		})
	]);

	return (await leseSiegel(tx, meetingId)) as Siegel;
}

/**
 * Das Paket aus der Ablage lesen; eine fehlende Datei wird zum `PaketFehler`.
 *
 * **Eine Übersetzung für beide Leser** (Nachzug-Abnahme, B4c). Der Download des
 * ganzen Pakets (`holePaket`) liest dieselbe Datei wie
 * `leseGeprueftenBestandteil` und warf bei fehlender Datei weiter einen rohen
 * ENOENT mit dem Ablagepfad. Nur «Datei fehlt» wird übersetzt; ein
 * Rechteproblem oder ein Lesefehler der Platte steigt unverändert auf, sonst
 * suchte der Betrieb unter dem Satz «liegt nicht mehr in der Ablage» an der
 * falschen Stelle. `folge` ist der Teil nach dem Semikolon und sagt, was der
 * Aufrufer nicht mehr tun kann.
 */
async function liesPaket(paketPruefsumme: string, folge: string): Promise<Uint8Array> {
	try {
		return await lies(paketPruefsumme);
	} catch (fehler) {
		if ((fehler as NodeJS.ErrnoException).code !== 'ENOENT') throw fehler;
		throw new PaketFehler(
			`Das Abschlusspaket dieser Versammlung liegt nicht mehr in der Ablage; ${folge}`
		);
	}
}

/** Das Paket selbst — zum Herunterladen und zum Prüfen. */
export async function holePaket(operatorId: Id, meetingId: Id): Promise<Uint8Array | null> {
	const siegel = await holeSiegel(operatorId, meetingId);
	if (!siegel) return null;
	return liesPaket(
		siegel.paketPruefsumme,
		'es lässt sich nicht herunterladen. Prüfen Sie die Ablage, bevor Sie etwas weitergeben.'
	);
}

/** Ein einzelnes Blatt aus dem versiegelten Paket, mit seiner Prüfsumme. */
export interface Stimmnachweisblatt {
	pfad: string;
	inhalt: Uint8Array;
	/** Die Prüfsumme aus dem Manifest, die das Blatt einlöst. */
	pruefsumme: string;
	traktandum: string;
}

/**
 * Einen Bestandteil aus dem versiegelten Paket lesen und gegen das Manifest
 * prüfen.
 *
 * **Verglichen wird gegen das Inhaltsverzeichnis aus der Datenbank, nicht
 * gegen das im Archiv** (Code-Review 22.09.2026). Die erste Fassung las
 * `manifest.json` aus demselben Archiv, das sie prüfen sollte. Wer das
 * abgelegte Paket austauscht, tauscht dieses Verzeichnis mit aus, und der
 * Vergleich ginge durch: Er hätte gemessen, dass das Paket zu sich selbst
 * passt. `lies()` hasht den gelesenen Inhalt nicht nach. Die Zeile in der
 * Datenbank ist dagegen durch das Siegel gedeckt und liegt ausserhalb des
 * Archivs.
 *
 * **Eine Stelle für alle Herausgaben.** Stimmnachweis und Verlauf holen ihren
 * Inhalt hier; zwei Fassungen derselben Prüfung liefen auseinander, und die
 * zweite wäre die schwächere.
 */
async function leseGeprueftenBestandteil(
	siegel: Siegel,
	pfad: string,
	beschaedigt: { kennung: string; satz: string }
): Promise<{ inhalt: Uint8Array; pruefsumme: string } | null> {
	const manifest = JSON.parse(siegel.manifest) as Manifest;
	const eintrag = manifest.eintraege.find((e) => e.pfad === pfad);
	// Nur wo das Manifest den Pfad gar nicht kennt, ist «gibt es in diesem
	// Paket nicht» die richtige Antwort (404 in der Route).
	if (!eintrag) return null;

	/*
	 * **Ein fehlendes Paket bekommt einen eigenen Satz** (Nachzug Block 2c;
	 * «Offen aus Block 3», Punkt 6). Das Manifest führt den Pfad, die
	 * Paketdatei in der Ablage fehlt aber. Ein Serverfehler war das schon
	 * vorher: `lies` wirft bei fehlender Datei, und die Routen reichen alles
	 * ausser `FachlicherFehler` weiter. Im Serverlog stand dann aber nur ein
	 * roher ENOENT mit dem Ablagepfad, ohne Versammlung und Bestandteil. Jetzt
	 * steht dort, was fehlt. Die Seite zeigt wie bei jedem Serverfehler nur die
	 * Kennung; der Satz ist für den Betrieb, der das Log liest.
	 *
	 * **Dieselbe Übersetzung wie beim Paket-Download** (B4c, 03.10.2026): Die
	 * Regel steht in `liesPaket`, eine zweite Abschrift gäbe es sonst.
	 */
	const bytes = await liesPaket(
		siegel.paketPruefsumme,
		`der Bestandteil «${pfad}» lässt sich nicht herausgeben. Prüfen Sie die Ablage, bevor Sie ` +
			'etwas weitergeben.'
	);

	const { entpacke } = await import('./paketpruefung');
	let inhalt: Uint8Array | undefined;
	try {
		inhalt = entpacke(bytes).get(pfad);
	} catch {
		inhalt = undefined;
	}
	/*
	 * **Unlesbares Archiv und fehlender Eintrag sind derselbe Fall**
	 * (Codeprüfung 01.10.2026): Das Manifest führt den Pfad (oben geprüft),
	 * das Archiv gibt ihn nicht her. Als `PaketFehler` stiege das als roher
	 * 500er aus der Route; hier wird daraus der Satz, der zum Fall gehört.
	 * Nur wo das Manifest den Pfad gar nicht kennt, ist `null` die richtige
	 * Antwort: «gibt es in diesem Paket nicht».
	 */
	if (!inhalt) {
		throw new FachlicherFehler(beschaedigt.kennung, beschaedigt.satz);
	}

	if (sha256(inhalt) !== eintrag.pruefsumme) {
		throw new FachlicherFehler(beschaedigt.kennung, beschaedigt.satz);
	}
	return { inhalt, pruefsumme: eintrag.pruefsumme };
}

/**
 * Ein Stimmnachweis aus dem Paket holen (S-4, Vorgabe des Auftraggebers 22.09.2026).
 *
 * **Gelesen, nicht neu erzeugt.** Ein zweiter Bau ergäbe andere Bytes und damit
 * eine andere Prüfsumme als die im Manifest. Genau diese Prüfsumme ist der
 * Grund, warum es eine Datei je Traktandum gibt: Das Blatt soll sich einzeln
 * gegen das Manifest halten lassen. Ein nachgebautes könnte das nicht.
 *
 * **Und es geht nur heraus, wenn es stimmt.** Wer ein Blatt weitergibt, gibt
 * es als das versiegelte weiter. Weicht es ab, ist das Paket beschädigt, und
 * dann gehört das gesagt statt stillschweigend ein Dokument ausgeliefert,
 * dessen Prüfsumme nicht mehr trägt.
 *
 * **Nur unterhalb von `stimmnachweis/`.** Der Name kommt aus der Adresse, und
 * auch wenn hier keine Datei geöffnet wird, sondern in einer Tabelle
 * nachgeschlagen: Ohne diese Schranke wäre der Weg eine allgemeine
 * Herausgabestelle für jeden Bestandteil, auch für die Unterlagen und die
 * Vollmachtsnachweise.
 */
export async function holeStimmnachweis(
	operatorId: Id,
	meetingId: Id,
	dateiname: string
): Promise<Stimmnachweisblatt | null> {
	if (!/^[A-Za-z0-9._ ()-]{1,120}\.pdf$/.test(dateiname)) return null;

	const siegel = await holeSiegel(operatorId, meetingId);
	if (!siegel) return null;

	const pfad = `stimmnachweis/${dateiname}`;
	const gelesen = await leseGeprueftenBestandteil(siegel, pfad, {
		kennung: 'stimmnachweis.pruefsumme',
		satz:
			`Das Blatt «${pfad}» stimmt nicht mehr mit dem Inhaltsverzeichnis des Pakets ` +
			'überein. Das Paket ist beschädigt; geben Sie das Blatt nicht weiter, bevor ' +
			'das geklärt ist.'
	});
	if (!gelesen) return null;

	return {
		pfad,
		...gelesen,
		traktandum: dateiname.replace(/^T-/, '').replace(/\.pdf$/, '')
	};
}

/** Der Verlauf als PDF aus dem versiegelten Paket, mit seiner Prüfsumme. */
export interface Verlaufspdf {
	inhalt: Uint8Array;
	/** Die Prüfsumme aus dem Manifest, die das Dokument einlöst. */
	pruefsumme: string;
}

/**
 * Den Verlauf als PDF aus dem versiegelten Paket holen (Plan Beschluss von
 * Hand, Block 3).
 *
 * **Gelesen, nicht neu erzeugt.** Der Verlauf ist bis zum Versiegeln
 * veränderlich; ein nachgebautes Dokument wäre nicht nur andere Bytes, sondern
 * möglicherweise länger als das, was das Siegel deckt. Herausgegeben wird
 * genau der Stand, der im Manifest steht.
 *
 * **Nur dieser eine Pfad.** Wie beim Stimmnachweis ist der feste Name die
 * Schranke: Ohne ihn wäre die Funktion eine allgemeine Herausgabestelle für
 * jeden Bestandteil, auch für die Unterlagen und die Vollmachtsnachweise.
 */
export async function holeVerlaufspdf(operatorId: Id, meetingId: Id): Promise<Verlaufspdf | null> {
	const siegel = await holeSiegel(operatorId, meetingId);
	if (!siegel) return null;
	return leseGeprueftenBestandteil(siegel, 'Verlauf.pdf', {
		kennung: 'verlauf.pruefsumme',
		satz:
			'Der Verlauf im Paket stimmt nicht mehr mit dem Inhaltsverzeichnis überein. Das Paket ' +
			'ist beschädigt; geben Sie das Dokument nicht weiter, bevor das geklärt ist.'
	});
}

/**
 * Ob das Paket einen Verlauf als PDF trägt — aus dem Manifest, ohne das Archiv
 * zu öffnen.
 *
 * Für die Siegelseite: Ohne diese Frage setzte sie den Verweis auch auf Pakete
 * von vor Block 3, die das Dokument nicht enthalten, und der Verweis führte ins
 * Leere.
 */
export async function hatVerlaufspdf(operatorId: Id, meetingId: Id): Promise<boolean> {
	const siegel = await holeSiegel(operatorId, meetingId);
	if (!siegel) return false;
	return (JSON.parse(siegel.manifest) as Manifest).eintraege.some((e) => e.pfad === 'Verlauf.pdf');
}

/**
 * Welche Stimmnachweise im Paket liegen, für die Auswahl auf der Siegelseite.
 *
 * **Aus dem Manifest, nicht aus dem Archiv.** Das Manifest ist die Liste, die
 * das Siegel deckt; es zu lesen kostet nichts und sagt zugleich, welche
 * Prüfsumme ein Blatt einlösen muss. Das Archiv zu entpacken, nur um Namen zu
 * zählen, hiesse jedes Mal alle Dateien auszupacken.
 */
export async function listeStimmnachweise(
	operatorId: Id,
	meetingId: Id
): Promise<{ datei: string; traktandum: string; beschreibung: string }[]> {
	const siegel = await holeSiegel(operatorId, meetingId);
	if (!siegel) return [];
	const manifest = JSON.parse(siegel.manifest) as Manifest;
	return manifest.eintraege
		.filter((e) => e.pfad.startsWith('stimmnachweis/'))
		.map((e) => {
			const datei = e.pfad.slice('stimmnachweis/'.length);
			return {
				datei,
				traktandum: datei.replace(/^T-/, '').replace(/\.pdf$/, ''),
				beschreibung: e.beschreibung
			};
		})
		.sort((a, b) => a.traktandum.localeCompare(b.traktandum, 'de-CH', { numeric: true }));
}
