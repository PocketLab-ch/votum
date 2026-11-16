/**
 * Der Beschluss, den die Sitzungsleitung von Hand festhält (Plan
 * `docs/plan-beschluss-von-hand-2026-09-30.md`, Block 1).
 *
 * **Produktentscheid 30.09.2026:** «Einfach während der Versammlung muss der
 * Sitzungsleiter alles übersteuern können. Theoretisch könnte es ja sein, dass
 * eine Entscheidung im Tool durch ein Gerichtsurteil oder neue Gesetze falsch
 * ist, bzw. geändert hat.» Die bestehenden Sperren bleiben; dazu kommt je
 * Traktandum ein Notweg an ihnen und an der Auszählung vorbei.
 *
 * **Was hier gebildet wird, ist eine vollständige Auszählung**, wie sie
 * `zaehleAus` liefert, nur mit gesetzten statt gerechneten Werten. So lesen
 * sie alle Stellen über denselben Weg wie jedes andere Ergebnis
 * (`ergebnisIn`), und die Festschreibung gilt wie sonst. Das Merkmal `vonHand`
 * sagt den Lesern, dass keine Schwelle angewandt wurde.
 *
 * Rein wie der übrige Kern: keine Datenbank, keine Uhr.
 */
import { kopfgewicht } from './eigentuemer';
import { FachlicherFehler } from './gemeinschaft';
import { EREIGNISARTEN, ereignis, type Ereignis } from './verlauf';
import { zeichenzahl } from './zeichenzahl';
import type { Auszaehlung, Stimmenspiegel } from './auszaehlung';
import { EINWAND_VOLLZUG, einwandBedingungen, zaehlweiseFuer, type Erfordernis } from './entscheidbaum';
import { FRISTBEGINN } from './protokoll';
import type { Id, Snapshot, VoteChoice } from './types';

/** Ja, Nein und Enthaltung, wie die Leitung sie einträgt. */
export interface Dreizahl {
	ja: number;
	nein: number;
	enthaltung: number;
}

/**
 * Die Zahlen zum Beschluss (Produktentscheide 30.09.2026): entweder als Summen
 * («Von Hand erfassen müsste dann noch die Wertquote und Anzahl eingetragen
 * werden können»), oder über eine Wahl je Partei («ja, Partei»), aus der
 * Köpfe und Wertquoten summiert werden.
 */
export type VonHandZahlen =
	| {
			erfassung: 'summen';
			koepfe: Dreizahl;
			/** `null`: Wertquoten nicht eingetragen. Das ist nicht «null Wertquoten». */
			quoten: Dreizahl | null;
	  }
	| { erfassung: 'parteien'; stimmen: { parteiId: Id; wahl: VoteChoice }[] };

export interface VonHandEingabe {
	ergebnis: 'angenommen' | 'abgelehnt';
	zahlen: VonHandZahlen;
	/** Freiwillig: Eine Pflichtfrage wäre eine halbe Sperre (Leitplanken). */
	begruendung?: string | null;
	/**
	 * Warum die Leitung von Hand festhält (Entscheid 0046, A7). Fehlt er, ist es
	 * der bisherige Weg (`notweg`); vorgewählt ist er auch in der Maske, damit
	 * die Frage keine Hürde vor dem Notweg wird.
	 */
	grund?: VonHandGrund;
	/** Nur beim Grund `eingewendete_bestimmung`: Fundstelle und Wortlaut. */
	einwand?: string | null;
	/** Nur beim Grund `eingewendete_bestimmung`: wie sie eingeführt wurde (Laienprüfung E2, L-14, R2-L-8). */
	einfuehrung?: string | null;
}

/**
 * Die Gründe des Beschlusses von Hand (Entscheid 0046, A7, 10.11.2026).
 *
 * `notweg`: der bisherige Weg, wenn sich die Abstimmung mit Votum nicht
 * durchführen oder abschliessen lässt. `eingewendete_bestimmung`: Im Saal wird
 * eine nicht hinterlegte Bestimmung eingewendet, die klar gilt, gültig
 * eingeführt und in jeder Hinsicht strenger ist als das Gesetz; der Antrag
 * erreicht das Gesetz, sie aber nicht, und die Leitung hält «abgelehnt» fest.
 * Der Kasten «Reglement» der Karten mit vereinbarter Ordnung schickt die
 * Leitung hierher (ab Fassung 2026-11-11, Abschnitt `einwandImSaal`).
 *
 * **Ein Grund, kein Freitext:** Am Grund hängen Pflichtfeld, festes Ergebnis,
 * der Satz im Protokoll und die Öffnung am gemeinsamen Abend.
 */
export const VON_HAND_GRUENDE = ['notweg', 'eingewendete_bestimmung'] as const;
export type VonHandGrund = (typeof VON_HAND_GRUENDE)[number];

/** Eine Absage, an der die Leitung vorbeigegangen ist: Kennung und Satz. */
export interface Uebergangen {
	kennung: string;
	satz: string;
}

/**
 * Ein Durchgang, den der Beschluss von Hand überholt.
 *
 * `rueckkommen`: nach einem angenommenen Rückkommen ersetzt, wie durch einen
 * gezählten Durchgang; `notweg`: ohne tragendes Rückkommen überholt, oder ein
 * offener Durchgang, der ohne Auszählung beendet wurde. `traktandumId` nur,
 * wenn er an einem anderen Traktandum liegt (Folgeantrag, Migration 133).
 */
export interface Ueberholt {
	durchgang: number;
	offen: boolean;
	art: 'notweg' | 'rueckkommen';
	traktandumId?: Id;
}

/**
 * Der Ausweg in der Maske, wenn über den Antrag nicht abgestimmt wurde.
 *
 * **Produktentscheid 01.10.2026:** «Kein Beschluss» lässt sich nicht von Hand
 * festhalten; das Ergebnis bleibt bei angenommen oder abgelehnt. Wörtlich:
 * «Nein passt. Das muss aber so in der Maske stehen, als Ausweg für diesen
 * Fall.» Die Notiz zum Traktandum geht ins Protokoll (`domain/protokoll.ts`).
 *
 * **Der Satz knüpft an «nicht abgestimmt» an, nicht an «kein Beschluss
 * zustande»** (Fach- und Laienprüfung 01.10.2026,
 * `quellen/pruefung/berichte/2026-10-01-votum-beschluss-von-hand-maske-*.md`).
 * Die erste Fassung hatte drei Grenzen, und jede führte zu einer falschen
 * Handlung:
 *
 *   - Hat der Saal abgestimmt und das Mehr verfehlt, auch bei
 *     Stimmengleichheit, ist der Antrag abgelehnt (Rz. 181 und 187 ad Art.
 *     712m; derselbe Satz steht in `rueckkommen.ts`). Ohne Eintrag schriebe das
 *     Protokoll «Über diesen Antrag wurde nicht abgestimmt.», neben einer Notiz
 *     der Leitung, die das Gegenteil sagt. Der Satz nennt deshalb den Eintrag
 *     «Abgelehnt» mit den Zahlen, und nur für die beschlussfähige
 *     Versammlung: Sonst widerspräche er dem Warnsatz gleich darüber (Runde 2).
 *   - Steht schon ein Ergebnis da, bleibt es ohne Eintrag bestehen. Das sagt
 *     `VON_HAND_ERGEBNIS_BLEIBT`, gezeigt nur in dieser Lage.
 *   - Ist ein Durchgang offen, riete der Satz vom einzigen Weg ab, der ihn
 *     beendet. Die Maske zeigt den Ausweg dann nicht.
 *
 * Das Feld heisst nach seinem Platzhalter, wie in `ausnahmen.ts`
 * (`Votum.svelte`).
 */
export const VON_HAND_OHNE_BESCHLUSS =
	'Wurde über diesen Antrag nicht abgestimmt, etwa weil er vertagt wurde oder die Versammlung ' +
	'nicht beschlussfähig ist, halten Sie hier nichts fest. Schreiben Sie den Grund beim ' +
	'Traktandum ins Feld «Voten, Begründungen, Ordnungsentscheide»; er steht dann im Protokoll. ' +
	'Ist die Versammlung beschlussfähig, hat der Saal abgestimmt und der Antrag das nötige Mehr ' +
	'verfehlt, auch bei Stimmengleichheit, ist er abgelehnt. Halten Sie dann «Abgelehnt» mit den ' +
	'Zahlen fest. Sieht Ihr Reglement bei Stimmengleichheit etwas anderes vor, etwa einen ' +
	'Stichentscheid, tragen Sie das Ergebnis danach ein.';

/** Zusatz zum Ausweg, wenn am Traktandum schon ein Ergebnis steht. */
export const VON_HAND_ERGEBNIS_BLEIBT =
	'Zu diesem Antrag steht schon ein Ergebnis. Halten Sie nichts fest, bleibt es bestehen.';

/** Dieselbe Grenze wie beim Text zum Beschluss; der Eintrag steht im Verlauf. */
export const VON_HAND_BEGRUENDUNG_HOECHSTENS = 600;
/** Dieselbe Grenze für die eingewendete Bestimmung; sie steht auch im Protokoll. */
export const VON_HAND_EINWAND_HOECHSTENS = 600;
/** Für die Angabe, wie die Bestimmung eingeführt wurde; sie steht auch im Protokoll. */
export const VON_HAND_EINFUEHRUNG_HOECHSTENS = 300;

/**
 * Die Begründung, bereinigt: `null`, wo keine dasteht. Keine Mindestlänge,
 * weil sie freiwillig ist; eine Höchstlänge, weil der Verlauf nur anfügbar ist
 * und ein versehentlich eingefügter Roman dort für immer stünde.
 */
export function begruendungVonHand(roh: string | null | undefined): string | null {
	const text = (roh ?? '').trim();
	if (text.length === 0) return null;
	if (zeichenzahl(text) > VON_HAND_BEGRUENDUNG_HOECHSTENS) {
		throw new FachlicherFehler(
			'zu_lang',
			`Die Begründung fasst höchstens ${VON_HAND_BEGRUENDUNG_HOECHSTENS} Zeichen.`,
			'begruendung'
		);
	}
	return text;
}

/**
 * Die zwei Grenzen des Notwegs, die bewusst bleiben (Plan, «Grenzen, bewusst»).
 *
 * **Nur bei laufender Versammlung** (Produktentscheid 30.09.2026: «Es muss ja
 * während der Versammlung sein»): Vorher gibt es keinen Saal, der beschliessen
 * könnte, nachher wäre es eine nachträgliche Berichtigung.
 *
 * **Nicht an einem zurückgezogenen Antrag.** Die Datenbank weist den Durchgang
 * ab (Migration 044), und zwar mit einer rohen Ausnahme statt mit einem Satz.
 * Der Rückzug lässt sich zurücknehmen; die Absage nennt diesen Weg.
 */
export function verlangeVonHandMoeglich(lage: {
	versammlungszustand: string;
	traktandumtitel: string;
	zurueckgezogen: boolean;
}): void {
	if (lage.versammlungszustand !== 'laufend') {
		throw new FachlicherFehler(
			'nicht_laufend',
			lage.versammlungszustand === 'freigegeben'
				? 'Die Versammlung ist noch nicht eröffnet. Ein Beschluss lässt sich erst ab der ' +
					'Eröffnung von Hand festhalten.'
				: 'Die Versammlung läuft nicht mehr. Ein Beschluss lässt sich nur von Hand festhalten, ' +
					'solange sie läuft.',
			'zustand'
		);
	}
	if (lage.zurueckgezogen) {
		throw new FachlicherFehler(
			'zurueckgezogen',
			`Der Antrag «${lage.traktandumtitel}» ist zurückgezogen; dazu lässt sich kein Beschluss ` +
				'festhalten. Nehmen Sie zuerst den Rückzug zurück, danach geht es.',
			'zustand'
		);
	}
}

const FELDNAMEN: Record<keyof Dreizahl, string> = {
	ja: 'Ja',
	nein: 'Nein',
	enthaltung: 'Enthaltung'
};

/**
 * Prüft die Form der eingetragenen Zahlen, nicht ihre Richtigkeit.
 *
 * **Keine Obergrenze** gegen die Zahl der Stimmberechtigten oder die
 * Gesamtquote: Der Notweg führt an den Sperren vorbei, und eine Zahl, die das
 * Werkzeug für unmöglich hält, kann genau der Fall sein, für den es ihn gibt.
 * Abgewiesen wird nur, was keine Zahl ist.
 */
function verlangeDreizahl(d: Dreizahl, art: 'koepfe' | 'quoten'): Dreizahl {
	for (const feld of ['ja', 'nein', 'enthaltung'] as const) {
		const wert = d[feld];
		const gueltig =
			typeof wert === 'number' &&
			Number.isFinite(wert) &&
			wert >= 0 &&
			(art === 'quoten' || Number.isInteger(wert));
		if (!gueltig) {
			throw new FachlicherFehler(
				'zahl_ungueltig',
				art === 'koepfe'
					? `«${FELDNAMEN[feld]}» bei den Kopfstimmen braucht eine ganze Zahl ab null.`
					: `«${FELDNAMEN[feld]}» bei den Wertquoten braucht eine Zahl ab null.`,
				`${art}_${feld}`
			);
		}
	}
	return { ja: d.ja, nein: d.nein, enthaltung: d.enthaltung };
}

/**
 * Der Stimmenspiegel aus eingetragenen Zahlen.
 *
 * `schwelle` bleibt null, weil nichts gegen eine Schwelle gerechnet wurde, und
 * `erreicht` ist wahr im Sinn von «keine Schranke im Weg», wie überall, wo es
 * keine gibt. `basis` ist die Summe der eingetragenen Zahlen und keine
 * Bezugsgrösse; `ohneAbgabe` und `nichtAnwesend` sind nicht erhoben und
 * stehen auf null. Wer sie ausgibt, fragt vorher `Auszaehlung.vonHand` ab.
 */
function spiegel(d: Dreizahl): Stimmenspiegel {
	return {
		ja: d.ja,
		nein: d.nein,
		enthaltung: d.enthaltung,
		ohneAbgabe: 0,
		nichtAnwesend: 0,
		basis: d.ja + d.nein + d.enthaltung,
		schwelle: null,
		erreicht: true
	};
}

const FELD_ZUR_WAHL: Record<VoteChoice, keyof Dreizahl> = {
	yes: 'ja',
	no: 'nein',
	abstain: 'enthaltung'
};

/**
 * Summiert die Wahl je Partei zu Köpfen und Wertquoten.
 *
 * Köpfe nach der Zählweise der Momentaufnahme, dieselbe Gewichtung wie in der
 * Handzählung (`zaehleSummenAus`); Wertquoten aus den Einheiten der
 * Momentaufnahme. Eine Partei ohne Wahl steht in keiner Zahl: Ob sie anwesend
 * war oder sich nicht geäussert hat, ist hier nicht erhoben.
 */
function summiere(
	stimmen: { parteiId: Id; wahl: VoteChoice }[],
	m: Snapshot,
	erfordernis?: Erfordernis
): { koepfe: Dreizahl; quoten: Dreizahl } {
	const nachId = new Map(m.parties.map((p) => [p.partyId, p]));
	const gesehen = new Set<Id>();
	const koepfe: Dreizahl = { ja: 0, nein: 0, enthaltung: 0 };
	const quoten: Dreizahl = { ja: 0, nein: 0, enthaltung: 0 };
	// Dieselbe Zählweise wie die Auszählung (`zaehlweiseFuer`), damit der
	// Beschluss von Hand an der Einsprache je Eigentümer zählt, wo L3 es vorgibt.
	const zaehlweise = erfordernis ? zaehlweiseFuer(erfordernis, m) : m.headCountMode;
	for (const s of stimmen) {
		const p = nachId.get(s.parteiId);
		if (!p) {
			throw new FachlicherFehler(
				'fremde_partei',
				'Eine der gewählten Parteien steht nicht im festgehaltenen Stand der Stimmberechtigten ' +
					'dieser Versammlung.',
				'stimmen'
			);
		}
		if (gesehen.has(s.parteiId)) {
			throw new FachlicherFehler(
				'partei_doppelt',
				`Für «${p.displayName}» ist mehr als eine Wahl eingetragen.`,
				'stimmen'
			);
		}
		gesehen.add(s.parteiId);
		// `Object.hasOwn`, nicht der blosse Zugriff: «constructor» oder «toString»
		// fänden sonst ein geerbtes Merkmal, gälten als Wahl und stünden so in
		// der Festschreibung (Sicherheitsprüfung 01.10.2026).
		const feld = Object.hasOwn(FELD_ZUR_WAHL, s.wahl) ? FELD_ZUR_WAHL[s.wahl] : undefined;
		if (!feld) {
			throw new FachlicherFehler(
				'wahl_ungueltig',
				`Für «${p.displayName}» ist weder Ja noch Nein noch Enthaltung gewählt.`,
				'stimmen'
			);
		}
		koepfe[feld] += kopfgewicht(p, zaehlweise, m.parkingCountsAsHead);
		quoten[feld] += p.units.reduce((summe, u) => summe + u.quota, 0);
	}
	// Die Quoten der Einheiten sind ganzzahlig (AD-12, Ä-10). Gerundet wird für
	// den Fall, dass doch ein Bruchteil ankommt: Sonst stünde nach einer Summe
	// eine Zahl wie 0.30000000000000004 in der Festschreibung.
	const rund = (n: number) => Math.round(n * 10000) / 10000;
	return {
		koepfe,
		quoten: { ja: rund(quoten.ja), nein: rund(quoten.nein), enthaltung: rund(quoten.enthaltung) }
	};
}

/**
 * Der Grund und die eingewendete Bestimmung, geprüft (Entscheid 0046, A7).
 *
 * Gibt die bereinigte Bestimmung zurück, `null` beim Notweg. **Nur
 * «abgelehnt»:** Eine strengere Bestimmung kann einen Antrag, der das Gesetz
 * erreicht, nur scheitern lassen. Ein «Angenommen» mit diesem Grund hiesse,
 * die Leitung setze ein Mehr durch, das niemand gerechnet hat; dafür bleibt
 * der Notweg. Ein unbekannter Grund wird abgewiesen, nicht still zum Notweg:
 * Er stünde sonst so in der Festschreibung.
 */
export function einwandVonHand(
	eingabe: Pick<VonHandEingabe, 'grund' | 'einwand' | 'einfuehrung' | 'ergebnis'>
): { bestimmung: string; einfuehrung: string } | null {
	const grund = eingabe.grund ?? 'notweg';
	if (!(VON_HAND_GRUENDE as readonly string[]).includes(grund)) {
		throw new FachlicherFehler('grund_ungueltig', VON_HAND_GRUND_UNGUELTIG, 'grund');
	}
	if (grund === 'notweg') return null;
	if (eingabe.ergebnis !== 'abgelehnt') {
		throw new FachlicherFehler('einwand_nur_ablehnung', VON_HAND_EINWAND_NUR_ABLEHNUNG, 'ergebnis');
	}
	const bestimmung = pflichttext(eingabe.einwand, VON_HAND_EINWAND_HOECHSTENS, 'einwand', VON_HAND_EINWAND_FEHLT, 'Die eingewendete Bestimmung');
	const einfuehrung = pflichttext(
		eingabe.einfuehrung,
		VON_HAND_EINFUEHRUNG_HOECHSTENS,
		'einfuehrung',
		VON_HAND_EINFUEHRUNG_FEHLT,
		'Die Angabe zur Einführung'
	);
	return { bestimmung, einfuehrung };
}

/** Ein Pflichtfeld des Grundes, bereinigt, mit Höchstlänge. */
function pflichttext(roh: string | null | undefined, hoechstens: number, feld: string, fehlt: string, name: string): string {
	// Leerraum zusammengefasst: Ein Zeilenumbruch zerrisse den Satz im Protokoll, und
	// eine Zeile mit «- », «#» oder «|» würde dort zu Aufzählung, Titel oder Tabelle
	// (Codeprüfung E2, M3).
	const text = (roh ?? '').replace(/\s+/g, ' ').trim();
	if (text.length === 0) throw new FachlicherFehler(`${feld}_fehlt`, fehlt, feld);
	if (zeichenzahl(text) > hoechstens) {
		throw new FachlicherFehler('zu_lang', `${name} fasst höchstens ${hoechstens} Zeichen.`, feld);
	}
	return text;
}

/**
 * Mit dem Grund «Eingewendete Bestimmung» nicht bei offenem Durchgang.
 *
 * Der Grund setzt voraus, dass das Ergebnis nach dem Gesetz feststeht; bei
 * offener Abstimmung steht es nicht fest, und das Protokoll sagte trotzdem,
 * der Antrag hätte das Gesetz erreicht. Am gemeinsamen Abend kommt dazu: Der
 * Grund öffnet die Maske dort ohne Notweg, und eine offene Abstimmung des
 * Abends zu beenden hiesse, an seiner Steuerung vorbei zu handeln.
 */
export function verlangeEinwandOhneOffenenDurchgang(lage: {
	grund: VonHandGrund | undefined;
	durchgangOffen: boolean;
	/**
	 * Ob der Grund an diesem Traktandum gilt (`einwandLageAm` des Erfordernisses).
	 * Sonst weist der Kern ab, auch wenn das Formular ihn schickt: Die Maske
	 * bietet ihn dort nicht an (Sicherheitsprüfung E2, Beobachtung).
	 */
	amErfordernis: boolean;
	/** Das geltende Ergebnis am Traktandum ist «angenommen», ohne diesen Grund (Featureprüfung E2, Z2). */
	nachGesetzAngenommen: boolean;
}): void {
	if (lage.grund !== 'eingewendete_bestimmung') return;
	if (!lage.amErfordernis) {
		throw new FachlicherFehler('einwand_hier_nicht', VON_HAND_EINWAND_HIER_NICHT, 'grund');
	}
	if (lage.durchgangOffen) {
		throw new FachlicherFehler('einwand_offen', VON_HAND_EINWAND_OFFEN, 'grund');
	}
	if (!lage.nachGesetzAngenommen) {
		throw new FachlicherFehler('einwand_ohne_annahme', VON_HAND_EINWAND_OHNE_ANNAHME, 'grund');
	}
}

/**
 * Die Auszählung zu einem von Hand festgehaltenen Beschluss.
 *
 * **`angenommen` setzt die Leitung**, es folgt nicht aus den Zahlen. Genau
 * dafür gibt es den Weg: Ist die Regel des Werkzeugs überholt, wäre eine
 * Wertung aus den Zahlen wieder die überholte Regel.
 *
 * **Keine Hinweise.** Die Hinweise der Auszählung gehen in die Auswertung und
 * auf die Leitungsseite; ein Satz «von Hand festgehalten» dort wäre der
 * Hinweis auf den Weg, den es nach aussen nicht geben soll. Was übergangen
 * wurde, steht im Verlauf (`beschlussVonHandEreignis`).
 *
 * `momentaufnahme` braucht es nur für die Wahl je Partei.
 */
export function auszaehlungVonHand(
	eingabe: VonHandEingabe,
	momentaufnahme: Snapshot | null,
	/** Für die Wahl je Partei: die Zählweise an diesem Traktandum (L3, `zaehlweiseFuer`). */
	erfordernis?: Erfordernis
): Auszaehlung {
	if (eingabe.ergebnis !== 'angenommen' && eingabe.ergebnis !== 'abgelehnt') {
		throw new FachlicherFehler(
			'ergebnis_fehlt',
			'Wählen Sie, ob der Antrag angenommen oder abgelehnt ist.',
			'ergebnis'
		);
	}

	/*
	 * **Die Form der Eingabe wird hier geprüft, nicht erst an der Route**
	 * (Sicherheitsprüfung 01.10.2026). Die Art der Erfassung steht danach in
	 * Festschreibung und Verlauf; ohne die Prüfung liefe alles ausser
	 * «parteien» in den Summenzweig, und der rohe Wert stünde dort für immer.
	 */
	const z = eingabe.zahlen as Partial<{ erfassung: unknown; stimmen: unknown; koepfe: unknown }> | null;
	const formStimmt =
		z?.erfassung === 'parteien'
			? Array.isArray(z.stimmen) && z.stimmen.every((x) => x !== null && typeof x === 'object')
			: z?.erfassung === 'summen' && z.koepfe !== null && typeof z.koepfe === 'object';
	if (!formStimmt) {
		throw new FachlicherFehler(
			'zahlen_fehlen',
			'Tragen Sie die Zahlen als Summen ein oder wählen Sie je Partei Ja, Nein oder Enthaltung.',
			'zahlen'
		);
	}

	let koepfe: Dreizahl;
	let quoten: Dreizahl | null;
	let stimmen: { partei: Id; wahl: VoteChoice }[] | undefined;
	if (eingabe.zahlen.erfassung === 'parteien') {
		if (!momentaufnahme) {
			throw new FachlicherFehler(
				'ohne_momentaufnahme',
				'Für die Wahl je Partei fehlt der festgehaltene Stand der Stimmberechtigten. Tragen Sie ' +
					'die Zahlen als Summen ein.',
				'stimmen'
			);
		}
		/*
		 * **Keine einzige Wahl ist keine Auszählung** (Codeprüfung 01.10.2026).
		 * Bei den Summen wird ein leeres Feld abgewiesen; hier ergäbe die leere
		 * Liste still «0 Ja, 0 Nein, 0 Enthaltung», festgeschrieben an Wand und
		 * im Protokoll.
		 */
		if (eingabe.zahlen.stimmen.length === 0) {
			throw new FachlicherFehler(
				'keine_wahl',
				'Wählen Sie für mindestens eine Partei Ja, Nein oder Enthaltung.',
				'stimmen'
			);
		}
		({ koepfe, quoten } = summiere(eingabe.zahlen.stimmen, momentaufnahme, erfordernis));
		stimmen = eingabe.zahlen.stimmen.map((s) => ({ partei: s.parteiId, wahl: s.wahl }));
	} else {
		koepfe = verlangeDreizahl(eingabe.zahlen.koepfe, 'koepfe');
		quoten = eingabe.zahlen.quoten ? verlangeDreizahl(eingabe.zahlen.quoten, 'quoten') : null;
	}
	// Nach den Zahlen: Wer beides falsch hat, liest zuerst den Satz zu den Zahlen,
	// wie bei der Begründung.
	const einwand = einwandVonHand(eingabe);

	return {
		koepfe: spiegel(koepfe),
		quoten: spiegel(quoten ?? { ja: 0, nein: 0, enthaltung: 0 }),
		// «Nicht eingetragen» ist nicht «null», wie bei der Handzählung.
		...(quoten ? {} : { quotenErhoben: false }),
		betroffene: {
			noetig: false,
			form: 'im_saal_oder_vorab',
			zugestimmt: [],
			fehlend: [],
			vorab: [],
			ausstehend: [],
			veto: [],
			erfuellt: true
		},
		ohneZustimmung: [],
		angenommen: eingabe.ergebnis === 'angenommen',
		durchStichentscheid: false,
		stichentscheidOffen: false,
		stichentscheidArt: null,
		// Der Beschluss von Hand ist nie geheim: Die Leitung trägt die Zahlen
		// selbst ein, und die Anzeige soll sie zeigen.
		geheim: false,
		hinweise: [],
		// Keine Protokollhinweise: Von Hand wurde nicht gerechnet, also gibt es
		// keine Bezugsgrösse und keinen Gleichstand zu erklären.
		protokollhinweise: [],
		vonHand: {
			erfassung: eingabe.zahlen.erfassung,
			...(stimmen ? { stimmen } : {}),
			// Mit der Karte des Traktandums, eingefroren: Das Protokoll nennt an der
			// notwendigen Massnahme den Weg zum Gericht (`einwandSatz`).
			...(einwand
				? {
						einwand: {
							...einwand,
							...(erfordernis?.knotenId ? { knotenId: erfordernis.knotenId } : {})
						}
					}
				: {})
		}
	};
}

/*
 * ── Die Sätze und Beschriftungen der Maske (Block 2) ───────────────────────
 *
 * Jeder Satz, den die Maske zeigt, steht hier und nicht im Markup verstreut.
 *
 * **Durch Laien- und Fachprüfung gegangen** (01.10.2026, zwei Runden;
 * `quellen/pruefung/berichte/2026-10-01-votum-beschluss-von-hand-maske-*.md`).
 * Zwei Befunde tragen die Fassung und gehören deshalb hierher:
 *
 *   - **Kein Satz sagt, der Beschluss «gelte».** Das Werkzeug kann zusagen, was
 *     Wand und Protokoll zeigen, nicht die Rechtswirkung: Fehlte die
 *     Beschlussfähigkeit, ist der Beschluss anfechtbar oder nichtig.
 *   - **Wer handelt, steht im Satz.** «Übergangen wird» las die Laienprüfung
 *     so, als erlaube das Werkzeug den Weg.
 */

/** Die Überschrift der Maske und die Beschriftung ihres Knopfs. */
export const VON_HAND_TITEL = 'Beschluss von Hand festhalten';

/**
 * Der Warnkasten der Maske: Sie ist der Notweg, nicht der gewöhnliche Ablauf.
 *
 * **Produktentscheid 03.10.2026**, wörtlich: «Dann lassen wir den Notweg so wie
 * er ist. Was aus der Ansicht nicht herauskommt ist, dass dies der Notweg ist
 * und Text sollte noch eine Warnung stehen, dass das eben der Notweg ist. Weil
 * so sieht es einfach wie eine zusätzliche Funktion aus. Warntext, dass ein
 * Beschluss neben Votum vorbei geschlossen wird und der Versammlung auch so
 * kommuniziert wird. Also ein Warnkasten, weil nicht der normale Weg.»
 *
 * **Der Schluss ist am Code geprüft** (03.10.2026): Wand und Protokoll zeigen
 * den Weg nicht. Für die Wand räumt `abstimmungsstand` in
 * `server/versammlungsstand.ts` nur Erfordernis und Schwelle weg; den Satz
 * bildet `vonHandInWorten` in `domain/auszaehlung.ts` ohne Hinweis auf den Weg,
 * und `ergebniswertung` schreibt im Protokoll nur «Angenommen.» oder
 * «Abgelehnt.» (`domain/protokoll.ts` sagt es an der Struktur ausdrücklich).
 * «Von Hand abgestimmt» am Schluss der Wand kommt aus dem Beschlussvermerk
 * (`server/auswertung.ts`, `mitBeschlussvermerk`), nicht von hier.
 *
 * **Geprüft in der Abnahme von Lauf B** (03.10.2026, Laien- und Fachprüfung,
 * `quellen/pruefung/zu-pruefen-2026-10-03-votum-notweg-und-verlauf*.md`). Die
 * Satz zum Zählen kam aus beiden Prüfungen: Die Laienprüfung vermisste, dass
 * das Zählen jetzt bei der Leitung liegt; die Fachprüfung, dass Art und
 * Bezugsgrösse des Mehrs nach Reglement abweichen können (Rz. 175, 186, 192a
 * ad Art. 712m) und die Zustimmung der Betroffenen auf diesem Weg nicht geprüft
 * wird (Rz. 164a). Das Mehr selbst zeigt die Maske unter dem Kasten, aus
 * derselben Vorschau wie vor dem Eröffnen.
 */
export const VON_HAND_NOTWEG_WARNUNG =
	'Das ist der Notweg, nicht der gewöhnliche Ablauf. Sie halten den Beschluss an Votum vorbei ' +
	'fest: Votum lässt niemanden abstimmen, zählt keine Stimmen und prüft kein Mehr. Zählen Sie ' +
	'selbst und prüfen Sie das Mehr, das darunter steht, und ob Betroffene zustimmen müssen. ' +
	'Nehmen Sie ' +
	'diesen Weg nur, wenn sich die Abstimmung mit Votum nicht durchführen oder nicht abschliessen ' +
	'lässt. Sagen Sie der Versammlung vor dem Festhalten, dass dieser Beschluss ohne Votum ' +
	'festgehalten wird; Wand und Protokoll zeigen das nicht.';

/** Was der Weg tut. Erste Zeile der Maske, vor den Prüfungen. */
export const VON_HAND_EINLEITUNG =
	'Halten Sie hier fest, was der Saal ohne Votum beschlossen hat. Wand und Protokoll zeigen das ' +
	'Ergebnis danach wie ein abgestimmtes; Votum rechnet es nicht nach.';

/**
 * Was Votum empfehlen würde: dieselben Prüfungen wie beim Eröffnen,
 * trocken gefahren. Mit und ohne Absage, in zwei Sätzen.
 */
export const VON_HAND_OHNE_ABWEICHUNG =
	'Votum hätte die Abstimmung so zugelassen. Sie übergehen nichts.';
export const VON_HAND_MIT_ABWEICHUNG =
	'Votum hätte die Abstimmung so nicht zugelassen. Sie entscheiden trotzdem und übergehen damit:';

/**
 * Dass der Weg Spuren hinterlässt, und wo.
 *
 * **Seit Block 5 mit der Beschlussfähigkeit** (01.10.2026): Das Protokoll nennt
 * bei einem von Hand festgehaltenen Beschluss die fehlende Beschlussfähigkeit
 * (`beschlussfaehigkeitFehlteSatz` in `protokoll.ts`). «Zeigt Ergebnis und
 * Zahlen» allein wäre danach falsch; der Zusatz nennt die Tatsache, nicht den
 * Weg.
 *
 * **Mit dem Hinweis auf die Anfechtung und mit «jetzt»** (Laienprüfung
 * 01.10.2026): Die erste Fassung («Fehlte die Beschlussfähigkeit, nennt es das
 * am Beschluss») verschwieg, dass alle Eigentümer im Protokoll auch lesen, wie
 * sich der Beschluss anfechten lässt. «Jetzt» sagt, welcher Stand zählt: der
 * im Augenblick des Eintrags.
 */
export const VON_HAND_VERLAUF_HINWEIS =
	'Was Sie festhalten und was Sie übergehen, steht danach unveränderlich im Verlauf; das ' +
	'Protokoll zeigt Ergebnis und Zahlen. Ist die Versammlung jetzt nicht beschlussfähig, steht ' +
	'das im Protokoll beim Beschluss, zusammen mit dem Hinweis, wie er sich anfechten lässt.';

/**
 * Welcher Anwesenheitsstand mit dem Eintrag festgehalten wird, in Zahlen, und
 * was zu tun ist, wenn er nicht der Stand bei der Abstimmung ist. Letzte Zeile
 * vor dem Knopf.
 *
 * **Produktentscheid 02.10.2026:** «Stand in der Maske zeigen». Der Eintrag
 * friert die Anwesenheit im Augenblick des Eintragens ein, und daraus rechnet
 * das Protokoll, ob die Versammlung «bei diesem Beschluss» beschlussfähig
 * war. Rechtlich zählt die Abstimmung (Rz. 23 ad Art. 712p). Wird nach einem
 * Ausfall später nachgetragen, kann der Satz im Protokoll sonst zu Unrecht
 * stehen oder fehlen. Keine neue Datenhaltung: Die Maske nimmt keinen
 * Zeitpunkt entgegen, sie zeigt den Stand und nennt den Handgriff.
 *
 * **Eigentümer und Wertquoten, nicht Kopfstimmen:** die zwei Grössen, an
 * denen Art. 712p Abs. 1 misst (Rz. 10). Die Zahlen kommen aus
 * `beteiligungDerAnwesenden`, derselben Rechnung wie im Protokoll.
 *
 * **Neben `VON_HAND_VERLAUF_HINWEIS`, nicht an seiner Stelle:** Jener sagt
 * die Folge («steht das im Protokoll beim Beschluss»), dieser die Tatsache,
 * an der sie hängt.
 *
 * **«Anwesend oder vertreten», und der Rückweg** (Laien- und Fachprüfung
 * 02.10.2026). Ohne den Zusatz verglich die Leitung «7 von 12» mit den Köpfen
 * im Saal und hielt einen richtigen Stand für falsch. Und «berichtigen Sie
 * zuerst die Anwesenheit» allein liess den alten Stand stehen: Die nächste
 * Abstimmung rechnete dann mit Leuten, die gegangen sind (Rz. 181 ad Art.
 * 712m zur Bezugsgrösse der Anwesenden). «Stellen … auf jenen Stand» statt
 * «berichtigen»: Der Stand von jetzt ist nicht falsch, nur ein anderer.
 */
export function vonHandStandSatz(b: {
	eigentuemerAnwesend: number;
	eigentuemerGesamt: number;
	quotenAnwesend: number;
	gesamtquote: number;
}): string {
	// Wertquoten sind Summen von Dezimalzahlen; ohne Runden stünde in der
	// Maske gelegentlich «333.29999999999995».
	const rund = (n: number) => Math.round(n * 1000) / 1000;
	return (
		`Festgehalten wird der Anwesenheitsstand von jetzt: ${b.eigentuemerAnwesend} von ` +
		`${b.eigentuemerGesamt} Eigentümern anwesend oder vertreten, mit ${rund(b.quotenAnwesend)} ` +
		`von ${rund(b.gesamtquote)} Wertquoten. War der Stand bei der Abstimmung ein anderer, ` +
		'stellen Sie zuerst die Anwesenheit auf jenen Stand und erfassen Sie nach dem Festhalten ' +
		'wieder, wer seither gekommen oder gegangen ist.'
	);
}

/**
 * Die Rechtsfolge bei fehlender Beschlussfähigkeit. Gezeigt, wenn unter
 * «übergangen» die Absage `nicht_beschlussfaehig` steht, direkt unter ihr.
 *
 * **Der Regelfall zuerst: anfechtbar.** Rz. 31 ad Art. 712p («im Zweifelsfall
 * als anfechtbar und nicht als nichtig»), ZGB Art. 75 über Art. 712m Abs. 2.
 * Die Rechtsfolge ist in der Lehre umstritten (Rz. 32); Nichtigkeit nimmt Rz.
 * 33 als Autorenmeinung an, wo die Versammlung «willentlich trotz einer
 * schweren Verletzung» beschliesst (Beispiel dort: 15 % der Wertquoten).
 * «Willentlich» ist auf diesem Weg immer erfüllt, übrig bleibt die Schwere.
 *
 * **BGE 143 III 537 trägt den Satz nicht** und steht deshalb nicht mehr darin
 * (Fachprüfung 01.10.2026, im Volltext nachgelesen): E. 4.2.3 handelt von den
 * Mehrheitsarten, die Nichtigkeit verneint E. 4.2.4, und im Fall waren alle
 * Anteile vertreten. Die Fundstelle stammt aus Rz. 33a, die den Entscheid
 * selbst als terminologisches Missverständnis einordnet.
 *
 * **Jede Norm steht an dem Satz, den sie trägt** (Fachprüfung, Runde 2): Art.
 * 712p regelt die Beschlussfähigkeit, Art. 75 die Anfechtung. Die Ungültigkeit
 * von Anfang an ist Lehre (Rz. 33 ad Art. 712p, Rz. 214 ad Art. 712m) und
 * trägt deshalb keine Norm. Ein Mass für «viel» gibt es nicht; die
 * Laienprüfung hat das als offen gemeldet, und der Satz erfindet keines.
 *
 * **Der Schlusssatz verweist, statt die Auswege zu wiederholen:** Welche es
 * gibt (Anwesenheit berichtigen, warten, zweite Versammlung), hängt an der
 * Lage und steht in der Absage. «So nicht», nicht «heute nicht»: Zwei der
 * Auswege führen noch am selben Abend zum Beschluss (Rz. 29 ad Art. 712p).
 */
export const VON_HAND_NICHTIGKEITSRISIKO =
	'Die Versammlung ist nicht beschlussfähig (ZGB Art. 712p). Halten Sie trotzdem einen Beschluss ' +
	'fest, kann ihn jeder Eigentümer, der nicht zugestimmt hat, einen Monat lang beim Gericht ' +
	'anfechten (ZGB Art. 75). Die Frist läuft, sobald er vom Beschluss erfährt. Fehlt viel zur ' +
	'Beschlussfähigkeit, kann der Beschluss von Anfang an ungültig sein. Sicherer ist, so nicht ' +
	'zu beschliessen; was Sie stattdessen tun können, steht in der Absage darüber.';

/**
 * Die Quittung nach dem Festhalten.
 *
 * **Mit dem Weg zur Berichtigung** (Laienprüfung 01.10.2026): Ein zweiter
 * Beschluss von Hand überholt den ersten (`haltBeschlussVonHandFest`). Und
 * **mit der Anfechtbarkeit, wo die Beschlussfähigkeit fehlte**: Sonst wäre die
 * Quittung das letzte Wort nach der Warnung, und es lautete «festgehalten».
 */
export const VON_HAND_FESTGEHALTEN =
	'Der Beschluss ist festgehalten. Wand und Protokoll zeigen ihn wie ein abgestimmtes Ergebnis. ' +
	'Stimmt etwas nicht, halten Sie ihn noch einmal fest; der neue Eintrag überholt diesen.';
export const VON_HAND_FESTGEHALTEN_ANFECHTBAR =
	'Die Versammlung war nicht beschlussfähig; der Beschluss kann angefochten werden.';

/**
 * Nach der Vorgabe von L5 übergangen (Migration 174): Die Versammlung war
 * beschlussfähig, aber nicht wie eine erste, und das Traktandum war neu. Der
 * Satz zu Art. 712p oben passte nicht; anfechtbar ist der Beschluss trotzdem,
 * denn genau dieses Risiko trägt die Vorgabe.
 */
// Laienprüfung Block 7, L7-5 (die Warnung zuerst, mit dem nächsten Schritt);
// Fachprüfung F7-4 (der Widerspruch zur Fussnote der Einladung ist ein
// zweiter Anfechtungsgrund, BGE 132 III 503 E. 5.3; Rz. 31, 32, 53 ad Art. 712p).
// Runde 2: Anfechten kann jeder, der nicht zugestimmt hat (F7-8, L7-14;
// Art. 75 ZGB, Rz. 223 ad Art. 712m); die Frist läuft für Abwesende ab dem
// Protokoll (F7-9; Rz. 230, 230a ad Art. 712m).
// Die Wartezeit nach der Frist (hier und in `VON_HAND_FESTGEHALTEN_AUSSTAND`, 15.11.2026):
// «einige Tage für die Post» war zu kurz (Fachprüfung der Fassung 2026-11-17, R2-M1); ein
// Schlichtungsgesuch vom letzten Tag kommt erst mit der Vorladung (ZPO Art. 202 Abs. 3).
// Wer die Anfechtung erhält und wo gefragt wird nach der Laien- und Fachprüfung der
// Korrektur (`quellen` `pruefung/berichte/2026-11-15-votum-wartezeit-kern-*`).
// «seit mehr als einem Monat erhalten»: ab dem Erhalt, wie der Satz im Protokoll (Runde 3,
// F7-13 und L7-17). Keine Kommentare in der Kette, damit `check:texte` jeden Satz misst.
export const VON_HAND_FESTGEHALTEN_NEU_GESPERRT =
	'Das Traktandum stand in der Einladung zur ersten Versammlung nicht zur Abstimmung, und die Versammlung war nicht ' +
	'beschlussfähig wie eine erste. Den Beschluss kann jeder Eigentümer anfechten, der ihm nicht ' +
	'zugestimmt hat; zudem hat die Einladung gesagt, dass darüber so nicht beschlossen wird. Sagen ' +
	'Sie das der Versammlung. Führen Sie den Beschluss am sichersten erst aus, wenn alle das ' +
	'Protokoll seit mehr als einem Monat erhalten haben und keine Anfechtung bekannt ist. ' +
	'Rechnen Sie einige Wochen dazu: Eine Anfechtung erhält die Bewirtschaftung erst, wenn die ' +
	'Schlichtungsbehörde oder das Gericht sie zustellt. Fragen Sie die Bewirtschaftung, ob Post der ' +
	'Schlichtungsbehörde oder des Gerichts gekommen ist, bevor Sie ausführen.';

/**
 * Die Warnung vor dem Festhalten nach der Sperre von L5 (Codeprüfung Block 7,
 * M1): wie `VON_HAND_NICHTIGKEITSRISIKO` vor dem Klick, nicht erst in der
 * Quittung. Wortlaut aus der geprüften Quittung, ohne den Rat zum Ausführen.
 */
export const VON_HAND_NEU_GESPERRT_RISIKO =
	'Das Traktandum stand in der Einladung zur ersten Versammlung nicht zur Abstimmung, und die Versammlung ist nicht ' +
	'beschlussfähig wie eine erste. Halten Sie trotzdem einen Beschluss fest, kann ihn jeder ' +
	'Eigentümer anfechten, der ihm nicht zugestimmt hat; zudem hat die Einladung gesagt, dass ' +
	'darüber so nicht beschlossen wird. Sicherer ist, so nicht zu beschliessen; was Sie stattdessen ' +
	'tun können, steht in der Absage darüber.';

/**
 * L7 unter «Zählt nicht mit» übergangen (Migration 183; Fachprüfung L7, F-2,
 * 06.11.2026): Die Versammlung ist beschlussfähig, aber nicht ohne die
 * Personen im Ausstand. Gebaut wie die Sätze zu L5, ohne den Satz zur
 * Nichtigkeit: Anfechtbar ist der Beschluss (Fachprüfung, Frage 1; Rz. 31 ad
 * Art. 712p). Mit dem Rat zum Ausführen (Laienprüfung L7, L-6).
 */
export const VON_HAND_AUSSTAND_RISIKO =
	'Ohne die Personen im Ausstand ist die Versammlung bei diesem Traktandum nicht beschlussfähig; nach ' +
	// Neutral zum Ausgang (Laienprüfung Runde 2, N-3; Fachprüfung Runde 2, N-4):
	// Vor dem Klick steht noch nicht fest, ob angenommen oder abgelehnt.
	'der Einstellung Ihrer Gemeinschaft zählen sie dafür nicht mit. Halten Sie trotzdem ein Ergebnis ' +
	'fest, kann es jeder Eigentümer anfechten, der damit nicht einverstanden ist. Sicherer ist, so nicht ' +
	'zu beschliessen; was Sie stattdessen tun können, steht in der Absage darüber.';
export const VON_HAND_FESTGEHALTEN_AUSSTAND =
	'Ohne die Personen im Ausstand war die Versammlung nicht beschlussfähig; nach der Einstellung Ihrer ' +
	'Gemeinschaft zählen sie dafür nicht mit. Das Ergebnis kann jeder Eigentümer anfechten, der damit ' +
	'nicht einverstanden ist. Sagen Sie das der Versammlung. Ist der Antrag angenommen, führen Sie ihn ' +
	'am sichersten erst aus, wenn alle das Protokoll seit mehr als einem Monat erhalten haben und keine ' +
	'Anfechtung bekannt ist. Rechnen Sie einige Wochen dazu: Eine Anfechtung erhält die Bewirtschaftung ' +
	'erst, wenn die Schlichtungsbehörde oder das Gericht sie zustellt. Fragen Sie die Bewirtschaftung, ob ' +
	'Post der Schlichtungsbehörde oder des Gerichts gekommen ist, bevor Sie ausführen.';

export function quittungVonHand(uebergangen: { kennung: string }[], mitEinwand = false): string {
	// Mit dem Grund «Eingewendete Bestimmung» sagt die Quittung, was das Protokoll
	// zeigt; «wie ein abgestimmtes Ergebnis» stimmte dort nicht mehr.
	const festgehalten = mitEinwand ? VON_HAND_FESTGEHALTEN_EINWAND : VON_HAND_FESTGEHALTEN;
	if (uebergangen.some((u) => u.kennung === 'nicht_beschlussfaehig')) {
		return `${festgehalten} ${VON_HAND_FESTGEHALTEN_ANFECHTBAR}`;
	}
	if (uebergangen.some((u) => u.kennung === 'neues_traktandum_gesperrt')) {
		return `${VON_HAND_FESTGEHALTEN_NEU_GESPERRT} ${festgehalten}`;
	}
	if (uebergangen.some((u) => u.kennung === 'ausstand_nicht_beschlussfaehig')) {
		return `${VON_HAND_FESTGEHALTEN_AUSSTAND} ${festgehalten}`;
	}
	return festgehalten;
}

/**
 * Die Rückfrage vor dem Festhalten (Codeprüfung 01.10.2026). Der Eintrag ist
 * festgeschrieben und kann anderes überholen; ohne Frage schriebe ein Enter in
 * einem Zahlenfeld den Tippfehler fest.
 */
/*
 * ── Der Grund «Eingewendete Bestimmung» (Entscheid 0046, A7) ──────────────
 *
 * Der Kasten «Reglement» der Karten mit vereinbarter Ordnung schickt die
 * Leitung hierher (`einwandImSaal`), wenn im Saal eine nicht hinterlegte Bestimmung eingewendet
 * wird, die klar gilt, gültig eingeführt und in jeder Hinsicht strenger ist
 * als das Gesetz (Rz. 99, 100 ad Art. 712n: Die Leitung bestimmt das Mehr, ein
 * ungültiges macht den Beschluss anfechtbar; Rz. 194 ad Art. 712m: eine
 * unklare Bestimmung gilt nicht). Für diesen Grund ist der Weg kein Notweg:
 * Die Warnung und die Einleitung des Notwegs stehen dann nicht, sondern
 * die Sätze `VON_HAND_EINWAND_*` weiter unten.
 */
export const VON_HAND_GRUND = 'Grund';
export const VON_HAND_GRUND_NOTWEG =
	'Notweg: Die Abstimmung lässt sich mit Votum nicht durchführen oder abschliessen';
export const VON_HAND_GRUND_EINWAND =
	'Eingewendete Bestimmung: Der Antrag erreicht das Gesetz, aber nicht eine strengere Bestimmung des Reglements';
/*
 * **Für sich verständlich, ohne Verweis auf die Karte** (Laienprüfung E2, L-2,
 * L-3, R2-L-1, R2-L-3): Die Karte zeigt die Leitungsseite nicht, im Saal steht
 * nur diese Maske. Die drei Bedingungen und der Vollzug kommen deshalb aus
 * denselben Bausteinen wie der Abschnitt der Karte (`einwandBedingungen`,
 * `EINWAND_VOLLZUG`), die Ausnahme der Zustimmung aller aus derselben Lage
 * (`einwandLageAm`). «Mehr oben» ist die Zeile `mehr` der Maske. Kein
 * «gilt» über den Beschluss (Wächter in `vonhand.test.ts`).
 */
export const VON_HAND_EINWAND_EINLEITUNG =
	'Wählen Sie diesen Grund nur, wenn drei Dinge feststehen. Ob Sie die Bestimmung einhalten, ' +
	'entscheiden Sie als Leitung; die Versammlung stimmt darüber nicht ab, und Votum prüft es nicht.';
export const VON_HAND_EINWAND_BEDINGUNGEN: readonly string[] = einwandBedingungen('geschaeft');
// Mit einem Satz zum Übernehmen ins Votenfeld (Laienprüfung E2, R3-L-1): So steht die
// Vollzugssperre im Protokoll und erreicht Bewirtschaftung und Abwesende.
export const VON_HAND_EINWAND_NICHT_FEST =
	'Steht eines der drei nicht fest, halten Sie hier nichts fest. Es bleibt dann beim Ergebnis nach ' +
	'dem Gesetz. Sagen Sie das an, mit dem Grund, und schreiben Sie den Einwand beim Traktandum ins Feld ' +
	'«Voten, Begründungen, Ordnungsentscheide». Etwa: «Eingewendet wurde Reglement Art. …. Es steht ' +
	'nicht fest, dass diese Bestimmung hier anzuwenden ist; es bleibt beim Ergebnis nach dem Gesetz. ' +
	'Erreicht der Antrag sie nicht, wird er erst vollzogen, wenn die Anfechtungsfrist für alle abgelaufen ' +
	// Fachprüfung E2, R4-F-1 (Rz. 207 ad Art. 712m): Der Einwand zählt nur mit Anfechtung.
	'ist, ausser es eilt. Wer meint, die Bestimmung sei hier anzuwenden, kann den Beschluss innert eines ' +
	'Monats anfechten, in der Regel mit einem Schlichtungsgesuch; ein Schreiben an die Verwaltung genügt ' +
	// Mit dem Fristbeginn wie im Protokoll (Laienprüfung E2, R5-L-1).
	`nicht. ${FRISTBEGINN}» ${EINWAND_VOLLZUG}`;
export const VON_HAND_EINWAND_FOLGE =
	'Mit diesem Grund ist der Antrag abgelehnt. Tragen Sie Ja, Nein und Enthaltungen ein, wie Votum sie ' +
	'bei der Abstimmung angezeigt hat. Sagen Sie der Versammlung, dass der Antrag wegen dieser Bestimmung ' +
	'abgelehnt ist. Das Protokoll nennt die Bestimmung und wie sie eingeführt wurde. Es hält fest, dass ' +
	'der Antrag das Mehr nach dem Gesetz erreicht hätte, nach ihr aber nicht.';
/**
 * Der Hinweis auf der Leitungsseite, sichtbar ohne die Maske zu öffnen
 * (Laienprüfung E2, R2-L-2): Nach einem «angenommen» denkt niemand von selbst
 * an einen Kasten, der «Notweg» heisst. Nur an Traktanden, an denen der Weg
 * gilt (`einwandLageAm`).
 */
export const VON_HAND_EINWAND_ZEIGER =
	'Wird eine Bestimmung des Reglements eingewendet, die nicht hinterlegt ist: Öffnen Sie «Beschluss von ' +
	'Hand festhalten» und wählen Sie den Grund «Eingewendete Bestimmung». Dort steht, wann Sie sie ' +
	'einhalten und was Sie sonst tun. Kommt der Einwand vor der Abstimmung, entscheiden Sie vorher und ' +
	'sagen an, nach welchem Mehr Sie das Ergebnis feststellen.';
/** Am gemeinsamen Abend: über dem Kasten «Notweg und Beschluss von Hand» (Codeprüfung E2, M2). */
export const VON_HAND_EINWAND_ZEIGER_ABEND =
	'Wird eine Bestimmung des Reglements eingewendet, die nicht hinterlegt ist: Öffnen Sie unten «Notweg ' +
	'und Beschluss von Hand», darin «Beschluss von Hand festhalten». Wählen Sie dort den Grund ' +
	'«Eingewendete Bestimmung». Dort steht, wann Sie sie einhalten und was Sie sonst tun. Kommt der ' +
	'Einwand vor der Abstimmung, entscheiden Sie vorher und sagen an, nach welchem Mehr Sie das ' +
	'Ergebnis feststellen.';
export const VON_HAND_EINWAND_LABEL = 'Eingewendete Bestimmung: Fundstelle und Wortlaut';
export const VON_HAND_EINWAND_PLATZHALTER =
	'etwa: Reglement Art. 14: drei Viertel aller Eigentümer, die zugleich drei Viertel der Wertquoten haben';
export const VON_HAND_EINFUEHRUNG_LABEL = 'Wie sie eingeführt wurde';
export const VON_HAND_EINFUEHRUNG_PLATZHALTER =
	'etwa: Beilage zum Begründungsakt vom …, seither nicht geändert';
export const VON_HAND_EINWAND_ERGEBNIS = 'Ergebnis: Abgelehnt';
export const VON_HAND_GRUND_UNGUELTIG = 'Wählen Sie einen der beiden Gründe.';
export const VON_HAND_EINWAND_NUR_ABLEHNUNG =
	'Mit dem Grund «Eingewendete Bestimmung» halten Sie nur «Abgelehnt» fest. Erreicht der Antrag auch die ' +
	'eingewendete Bestimmung, bleibt es beim Ergebnis der Abstimmung.';
export const VON_HAND_EINWAND_FEHLT =
	'Tragen Sie die eingewendete Bestimmung mit Fundstelle und Wortlaut ein; das Protokoll nennt sie.';
export const VON_HAND_EINFUEHRUNG_FEHLT =
	'Tragen Sie ein, wie die Bestimmung eingeführt wurde; das Protokoll nennt es. Können Sie es nicht ' +
	'angeben, steht die Einführung nicht fest, und Sie wählen diesen Grund nicht.';
export const VON_HAND_EINWAND_HIER_NICHT =
	// Ohne Begründung, warum nicht: Seit dem Ausschluss unter einer angewandten Regel
	// stimmte «wendet keine abweichende Bestimmung an» nicht mehr überall (Codeprüfung E2, D2).
	'Den Grund «Eingewendete Bestimmung» gibt es bei diesem Geschäft nicht. Es bleibt beim Ergebnis der ' +
	'Abstimmung; halten Sie den ' +
	'Einwand beim Traktandum im Feld «Voten, Begründungen, Ordnungsentscheide» fest. ' +
	// Fachprüfung E2, R4-F-2: Auch ausserhalb der sechs Karten kann eine strengere
	// Bestimmung gelten (Rz. 34 ad Art. 712g, Art. 647a Abs. 2).
	'Erreicht ein angenommener Antrag die eingewendete Bestimmung nicht, vollziehen Sie ihn erst nach ' +
	'Ablauf der Anfechtungsfrist, ausser es eilt.';
export const VON_HAND_EINWAND_OHNE_ANNAHME =
	'Den Grund «Eingewendete Bestimmung» wählen Sie erst, wenn die Abstimmung den Antrag nach dem Gesetz ' +
	// Fachprüfung E2, S-F-2: Eine mildere kann gelten (Rz. 35 ad Art. 712g, Rz. 130 ad Art. 712a).
	'angenommen hat. Ist er nach dem Gesetz abgelehnt, bleibt es hier dabei. Eine strengere Bestimmung ' +
	'ändert daran nichts. Wer meint, eine mildere Bestimmung sei hier anzuwenden, kann die Ablehnung innert ' +
	'eines Monats anfechten. Wurde nicht mit Votum abgestimmt, halten Sie zuerst das Ergebnis der ' +
	'Abstimmung mit dem Grund «Notweg» fest.';
export const VON_HAND_EINWAND_OFFEN =
	'Die Abstimmung zu diesem Antrag ist noch offen. Schliessen Sie sie zuerst; tagen mehrere ' +
	'Gemeinschaften zusammen, auf der Leitungsseite des Abends. Danach halten Sie hier fest, dass der ' +
	'Antrag die eingewendete Bestimmung nicht erreicht.';
// Mit dem Rückweg, wenn der Antrag doch angenommen ist (Laienprüfung E2, L-10):
// Mit diesem Grund geht nur «Abgelehnt», der Notweg nimmt beides.
export const VON_HAND_FESTGEHALTEN_EINWAND =
	'Der Antrag ist als abgelehnt festgehalten; das Protokoll nennt die eingewendete Bestimmung. Stimmt ' +
	'etwas nicht, halten Sie ihn noch einmal fest; der neue Eintrag überholt diesen. Ist der Antrag doch ' +
	'angenommen, halten Sie das fest, solange die Versammlung läuft: mit dem Grund «Notweg» und den ' +
	'Zahlen, die Votum angezeigt hat. Die Warnung zum Notweg betrifft Sie dabei nicht. Sagen Sie es der ' +
	'Versammlung. Nach dem Schluss lässt sich der Eintrag nicht mehr ändern. Der Antrag lässt sich dann ' +
	'an einer nächsten Versammlung neu stellen. Wer die Bestimmung für unanwendbar hält, kann die ' +
	'Ablehnung anfechten.';

export const VON_HAND_RUECKFRAGE = 'Beschluss von Hand festhalten?';
export const VON_HAND_RUECKFRAGE_FOLGE =
	'Der Eintrag lässt sich danach weder ändern noch zurücknehmen. Ein weiterer Eintrag kann ihn ' +
	'nur überholen.';
export const VON_HAND_RUECKFRAGE_JA = 'Festhalten';

/** Die Beschriftungen der Maske und ihrer Felder. */
export const VON_HAND_ERFASSUNG = 'Erfassung';
export const VON_HAND_SUMMEN = 'Summen';
export const VON_HAND_PARTEIEN = 'Je Partei';
export const VON_HAND_ERGEBNIS = 'Ergebnis';
export const VON_HAND_ANGENOMMEN = 'Angenommen';
export const VON_HAND_ABGELEHNT = 'Abgelehnt';
export const VON_HAND_BEGRUENDUNG_LABEL = 'Begründung (freiwillig)';
export const VON_HAND_KOEPFE = 'Kopfstimmen';
export const VON_HAND_QUOTEN = 'Wertquoten (leer lassen, wenn nicht erhoben)';
export const VON_HAND_JA = 'Ja';
export const VON_HAND_NEIN = 'Nein';
export const VON_HAND_ENTHALTUNG = 'Enthaltung';
/**
 * Die Vorgabe je Partei. «nichts» fasste Abwesende und Anwesende ohne
 * Äusserung zusammen (Fachprüfung 01.10.2026); Anwesende zählen nach Rz. 181
 * ad Art. 712m mit und gehören als Enthaltung eingetragen.
 */
export const VON_HAND_NICHTS = 'nicht anwesend';
export const VON_HAND_PARTEIEN_HINWEIS =
	'Anwesende und Vertretene, die sich nicht äussern, tragen Sie als Enthaltung ein.';
/** Die Leeroption der Ergebniswahl, wie in `Suchauswahl`. */
export const VON_HAND_WAEHLEN = '— wählen —';

/**
 * Ein überholter Durchgang mit dem Traktandum, an dem er liegt.
 *
 * `traktandum` trägt «Nummer Titel» oder `null` für das eigene. Die Übersetzung
 * aus der Kennung macht die Seite: Sie kennt die Liste.
 */
export interface UeberholtesMitTraktandum extends Ueberholt {
	traktandum: string | null;
}

/**
 * Was überholt wird, in einem Satz je Durchgang.
 *
 * **Auch an einem anderen Traktandum** (Folgeantrag): Dann nennt der Satz es
 * mit Nummer und Titel, sonst wäre «Der bisherige Beschluss» mehrdeutig.
 */
export function ueberholtInWorten(u: UeberholtesMitTraktandum): string {
	const wo = u.traktandum ? ` beim Traktandum «${u.traktandum}»` : '';
	if (u.art === 'rueckkommen') {
		return (
			`Der bisherige Beschluss${wo} (${u.durchgang}. Durchgang) wird ersetzt, weil die ` +
			'Versammlung das Rückkommen angenommen hat.'
		);
	}
	if (u.offen) {
		return (
			`Der offene ${u.durchgang}. Durchgang${wo} wird ohne Auszählung beendet und überholt; ` +
			'schon abgegebene Stimmen zählen nicht.'
		);
	}
	return (
		`Der bisherige Beschluss${wo} (${u.durchgang}. Durchgang) wird überholt; an seine Stelle ` +
		'tritt der neue Eintrag.'
	);
}

/**
 * Übersetzt das abgeschickte Formular der Maske in eine `VonHandEingabe`.
 *
 * **Reine Funktion**, damit die Übersetzung ohne Datenbank prüfbar ist. Sie ist
 * der einzige Ort, an dem die Feldnamen der Maske stehen; die Route ruft sie
 * unverändert auf.
 *
 * **Leere Wertquoten heissen `quoten: null`**, nicht «null Wertquoten»: Sind
 * alle drei Felder leer, wurde nichts eingetragen. Steht in einzelnen Feldern
 * nichts, bleibt dort `NaN`, und der Kern nennt das Feld (`verlangeDreizahl`).
 * Dasselbe gilt für die Kopfstimmen: Ein leeres Feld wird nicht still zur
 * Null.
 *
 * **Die Wahl je Partei** kommt aus allen Feldern `wahl_<kennung>` mit einem
 * Wert; «nichts» schickt den leeren Wert und steht in keiner Zahl. Ob die
 * Kennung zu einer Partei gehört und die Wahl gültig ist, prüft der Kern
 * (`auszaehlungVonHand`).
 */
export function eingabeAusFormular(daten: FormData): VonHandEingabe {
	const zahl = (name: string): number => {
		const roh = daten.get(name);
		const wert = typeof roh === 'string' ? roh.trim() : '';
		return wert === '' ? Number.NaN : Number(wert);
	};
	const quotenLeer = ['quoten_ja', 'quoten_nein', 'quoten_enthaltung'].every((name) => {
		const roh = daten.get(name);
		return typeof roh !== 'string' || roh.trim() === '';
	});
	const ergebnisRoh = daten.get('ergebnis');
	const begruendungRoh = daten.get('begruendung');
	const grundRoh = daten.get('grund');
	const einwandRoh = daten.get('einwand');
	const einfuehrungRoh = daten.get('einfuehrung');
	/*
	 * **Die Art der Erfassung geht unverändert weiter** (Codeprüfung
	 * 01.10.2026). Fehlt sie oder ist sie unbekannt, fiele sie hier sonst still
	 * in die Summen und stünde so in der Festschreibung; der Kern weist ab, was
	 * weder «summen» noch «parteien» ist (`zahlen_fehlen`).
	 */
	const erfassung = daten.get('erfassung');
	const zahlen: VonHandEingabe['zahlen'] =
		erfassung === 'parteien'
			? { erfassung: 'parteien', stimmen: stimmenAusFormular(daten) }
			: {
					erfassung: erfassung as 'summen',
					koepfe: {
						ja: zahl('koepfe_ja'),
						nein: zahl('koepfe_nein'),
						enthaltung: zahl('koepfe_enthaltung')
					},
					quoten: quotenLeer
						? null
						: {
								ja: zahl('quoten_ja'),
								nein: zahl('quoten_nein'),
								enthaltung: zahl('quoten_enthaltung')
							}
				};
	return {
		// Was hier nicht «angenommen» oder «abgelehnt» ist, weist der Kern ab
		// (`ergebnis_fehlt`); die Route reicht es unverändert durch.
		ergebnis: (typeof ergebnisRoh === 'string' ? ergebnisRoh : '') as VonHandEingabe['ergebnis'],
		zahlen,
		begruendung: typeof begruendungRoh === 'string' ? begruendungRoh : '',
		// Fehlt das Feld, ist es der Notweg wie bisher; einen unbekannten Wert
		// weist der Kern ab (`einwandVonHand`), die Route reicht ihn durch.
		...(typeof grundRoh === 'string' && grundRoh !== ''
			? { grund: grundRoh as VonHandGrund }
			: {}),
		...(typeof einwandRoh === 'string' ? { einwand: einwandRoh } : {}),
		...(typeof einfuehrungRoh === 'string' ? { einfuehrung: einfuehrungRoh } : {})
	};
}

/** Die Wahl je Partei aus den Feldern `wahl_<kennung>`. */
function stimmenAusFormular(daten: FormData): { parteiId: Id; wahl: VoteChoice }[] {
	const stimmen: { parteiId: Id; wahl: VoteChoice }[] = [];
	for (const [schluessel, wert] of daten) {
		if (!schluessel.startsWith('wahl_')) continue;
		const wahl = typeof wert === 'string' ? wert : '';
		if (wahl === '') continue;
		stimmen.push({ parteiId: schluessel.slice('wahl_'.length), wahl: wahl as VoteChoice });
	}
	return stimmen;
}

/**
 * Das Erfordernis eines von Hand festgehaltenen Durchgangs, wo das Traktandum
 * keines trägt.
 *
 * Ein geschlossener Durchgang verlangt eines (Migration 020,
 * `voting_round_eingefroren`). Der Typ ist `grenzfall`, weil das am ehesten
 * sagt, was gilt: Es steht kein Erfordernis fest. **Nach aussen soll es nie
 * gehen**: Protokoll, Auswertung und der Strom an Wand und Telefon lassen das
 * Erfordernis eines Durchgangs bei `Auszaehlung.vonHand` weg, und gerechnet
 * wird damit nicht, weil das Ergebnis festgeschrieben ist und gelesen wird.
 * Ins Siegelpaket geht es als Teil des Durchgangs; das ist Block 3.
 */
export const ERFORDERNIS_VON_HAND: Erfordernis = {
	fassung: 'von-hand',
	juristischGegengelesen: false,
	astId: '',
	knotenId: 'von-hand',
	typ: 'grenzfall',
	titel: 'Von Hand festgehalten',
	rechtsgrundlage: '',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: null,
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'gewaehlt'
};

/**
 * Der Verlaufseintrag «Beschluss von Hand festgehalten».
 *
 * Gegenstand ist der neue Durchgang; die Versammlung steht in den Angaben,
 * wie bei jeder Art aus `ABWEICHUNGSARTEN`. `abweichung.uebergangen` nennt
 * jede Absage, die das Eröffnen genannt hätte. Eine leere Liste ist eine
 * Aussage: Das Werkzeug hätte die Abstimmung zugelassen (bei einem Geschäft
 * unter der Universalversammlung: mit der Bestätigung der Leitung, siehe
 * `universalBestaetigungUnterstellt`).
 *
 * Die Wahl je Partei steht nicht hier, sondern in der Festschreibung: Der
 * Verlauf wird durchsucht und gefiltert und trägt keine Stimmen nach Namen.
 */
export function beschlussVonHandEreignis(lage: {
	durchgangId: Id;
	meetingId: Id;
	traktandumId: Id;
	traktandumtitel: string;
	nummer: number;
	auszaehlung: Auszaehlung;
	begruendung: string | null;
	uebergangen: Uebergangen[];
	/** Die Durchgänge, die damit überholt oder nach Rückkommen ersetzt sind. */
	ueberholt: Ueberholt[];
	/**
	 * Bei einem Geschäft unter der Universalversammlung: Die trockene Prüfung
	 * hat die Bestätigung der Leitung («nach einem Widerspruch gefragt»)
	 * unterstellt, gegeben wurde sie auf diesem Weg nicht. Die leere Liste
	 * unter «übergangen» gilt dort nur unter dieser Annahme, und der Eintrag
	 * sagt es (Codeprüfung 01.10.2026).
	 */
	universalBestaetigungUnterstellt?: boolean;
}): Ereignis {
	const a = lage.auszaehlung;
	const drei = (s: Stimmenspiegel): Dreizahl => ({ ja: s.ja, nein: s.nein, enthaltung: s.enthaltung });
	return ereignis(
		EREIGNISARTEN.beschlussVonHand,
		{ art: 'voting_round', id: lage.durchgangId },
		{
			versammlung: lage.meetingId,
			traktandum: lage.traktandumtitel,
			traktandumId: lage.traktandumId,
			durchgang: lage.nummer,
			ergebnis: a.angenommen ? 'angenommen' : 'abgelehnt',
			erfassung: a.vonHand?.erfassung ?? null,
			koepfe: drei(a.koepfe),
			quoten: a.quotenErhoben === false ? null : drei(a.quoten),
			begruendung: lage.begruendung,
			// Nur mit dem Grund «Eingewendete Bestimmung» (Entscheid 0046): Alte
			// Einträge haben den Schlüssel nicht, und ein `null` darin sagte nichts.
			...(a.vonHand?.einwand
				? { einwand: a.vonHand.einwand.bestimmung, einfuehrung: a.vonHand.einwand.einfuehrung }
				: {}),
			ueberholt: lage.ueberholt,
			...(lage.universalBestaetigungUnterstellt ? { universalBestaetigungUnterstellt: true } : {}),
			abweichung: { uebergangen: lage.uebergangen }
		}
	);
}
