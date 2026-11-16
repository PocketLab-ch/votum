/**
 * Wann über ein nicht angekündigtes Geschäft doch beschlossen werden darf
 * (Migration 126).
 *
 * **Die Regel und ihre zwei Ausnahmen.** Über einen Gegenstand, der nicht
 * gehörig angekündigt ist, wird nicht beschlossen (ZGB Art. 67 Abs. 3 i.V.m.
 * Art. 712m Abs. 2). Die Bestimmung ist dispositiv (Rz. 31, 32 ad Art. 712n):
 *
 *   - **(a) Reglement.** Gestattet das Reglement es ausdrücklich, darf
 *     beschlossen werden. Die Gemeinschaft hinterlegt das einmal, mit
 *     Fundstelle.
 *   - **(b) Universalversammlung.** Sind alle Eigentümer da und widerspricht
 *     niemand, entscheidet die Versammlung selbst ohne Traktandenliste
 *     (Rz. 28, 39, 84 ad Art. 712n).
 *
 * **Beim Anlegen dieser Datei kennt Votum keine der beiden** und sagt, der
 * Beschluss sei «auch nicht, wenn die Versammlung einverstanden ist» möglich.
 * Das schrieb dem Gesetz ein Verbot zu, das es nicht enthält (Fachprüfung
 * 29.09.2026, Befund D). Produktentscheid vom selben Tag: «Ausnahmen
 * gestatten.»
 *
 * **Wer als da gilt, ist eine Einstellung, keine Regel des Werkzeugs.** Ob an
 * der Universalversammlung eine Vertretung genügt, sagt für das
 * Stockwerkeigentum keine Stelle ausdrücklich. Das Gesetz setzt die
 * Vertretung voraus, und das Reglement kann sie einschränken (Art. 712p;
 * Rz. 26 bis 31 ad Art. 712m); deshalb regelt es die Gemeinschaft über
 * Reglement und Einstellung (Produktentscheide 29.09.2026, der zweite im
 * Nachtrag zu Frage 54 in `quellen`). Der Restzweifel (Rz. 28 ad Art. 712n
 * nennt nur «anwesend») liegt damit bei der Gemeinschaft, nicht beim
 * Werkzeug. Vorgabe ist die sicherste Lesart, nur persönlich Anwesende
 * (Fachprüfung 29.09.2026, Runde 2).
 */
import { uhrzeit } from './datum';
import { FachlicherFehler } from './fehler';
import { mitQuelle } from './gemeinschaft';
import {
	KONSULTATIV_KURZ,
	KONSULTATIV_SATZ,
	KONSULTATIV_SATZ_NEU,
	KONSULTATIV_WEG,
	KONSULTATIV_WEG_NEU
} from './konsultativ';
import type { Id, Zeitpunkt } from './types';
import { vollmachtsschluessel, type Vertretungsgrund } from './vollmacht';
import { zeichenzahl } from './zeichenzahl';

export const UNIVERSALVARIANTEN = ['persoenlich', 'vertreten', 'keine'] as const;
export type Universalvariante = (typeof UNIVERSALVARIANTEN)[number];

/**
 * Die Vorgabe, weil sie die sicherste Lesart ist.
 *
 * **Bei gemeinsamem Eigentum müssen alle Eigentümer der Wohnung da sein**, bei
 * Miteigentum wie bei Gesamteigentum (Produktentscheid 30.09.2026 nach der
 * Fachprüfung zur Regel, `quellen/pruefung/berichte/2026-09-30-universalversammlung-gemeinsames-eigentum.md`):
 * Jedes Mitglied ist selbst Stockwerkeigentümer (Rz. 5 ad Art. 712o), der
 * Verzicht auf die Ankündigung geschieht durch Teilnahme (Rz. 28 ad Art. 712n),
 * und beim Verzicht aller unterzeichnen alle (Rz. 22 ad Art. 712o, Rz. 125 ad
 * Art. 712m). Rz. 19 trägt die Stimmabgabe über Angekündigtes, nicht den
 * Verzicht. Bis zum 30.09.2026 genügte hier eine Person je Einheit
 * (Produktentscheid 29.09.2026); die Fachprüfung hielt das für zu locker, am
 * deutlichsten bei der Erbengemeinschaft.
 *
 * Ebenso muss da sein, wer als Nutzniesser eingeladen werden musste (Rz. 58 ad
 * Art. 712n; keine Stelle verlangt es ausdrücklich, das ist die sichere Antwort).
 */
export const UNIVERSALVARIANTE_VORGABE: Universalvariante = 'persoenlich';

export const UNIVERSALVARIANTE_TEXT: Record<Universalvariante, string> = {
	persoenlich: 'Alle Eigentümer persönlich anwesend',
	vertreten: 'Alle Eigentümer anwesend oder mit Vollmacht vertreten',
	keine: 'Keine Universalversammlung'
};

export function istUniversalvariante(wert: unknown): wert is Universalvariante {
	return typeof wert === 'string' && (UNIVERSALVARIANTEN as readonly string[]).includes(wert);
}

/** Was die Gemeinschaft hinterlegt hat. */
export interface AusnahmenNichtangekuendigtes {
	/** (a) Das Reglement gestattet Beschlüsse über nicht Angekündigtes. */
	reglementGestattet: boolean;
	/** Wo das steht. Pflicht, sobald (a) gilt. */
	reglementFundstelle: string | null;
	/** (b) Wer an der Universalversammlung als da gilt. */
	universalvariante: Universalvariante;
	/** Eine eigene Regel des Reglements zur Universalversammlung, falls es eine gibt. */
	universalFundstelle: string | null;
	/**
	 * Ob Vollmachten der Sitzungsleitung oder der Verwaltung mitzählen. Wirkt
	 * nur bei «vertreten». Vorgabe nein: Die Leitung soll neutral bleiben und
	 * kein eigenes, nicht angekündigtes Geschäft durch das Schweigen ihrer
	 * Vertretenen beschliessen lassen (Rz. 91 ad Art. 712n; Fachprüfung
	 * 29.09.2026, B-4).
	 */
	leitungsvollmachtenZaehlen: boolean;
}

export const AUSNAHMEN_VORGABE: AusnahmenNichtangekuendigtes = {
	reglementGestattet: false,
	reglementFundstelle: null,
	universalvariante: UNIVERSALVARIANTE_VORGABE,
	universalFundstelle: null,
	leitungsvollmachtenZaehlen: false
};

/**
 * Prüft die Eingabe der Reglementsseite.
 *
 * **Alle Angaben sind Pflicht**, auch die, die leer bleiben dürfen: Geprüft
 * wird immer der ganze Satz. Wer nur einen Teil ändert, ergänzt den Rest aus
 * dem Vorzustand, wie `speichereAusnahmen` es tut; eine weggelassene Angabe
 * hiesse sonst still «zurücksetzen» (Codeprüfung 29.09.2026).
 *
 * **Ohne (a) keine Fundstelle zu (a)**, dieselbe Regel wie bei der
 * Änderungsschranke: Wer die Angabe herausnimmt, soll keinen Verweis
 * zurücklassen, der nichts mehr belegt. Die Fundstelle zu (b) bleibt stehen,
 * auch bei der Vorgabe: Ein Reglement kann die persönliche Anwesenheit selbst
 * verlangen, und dann belegt sie genau die Vorgabe.
 */
export function pruefeAusnahmen(e: {
	reglementGestattet: boolean;
	reglementFundstelle: string | null;
	universalvariante: unknown;
	universalFundstelle: string | null;
	leitungsvollmachtenZaehlen: boolean;
}): AusnahmenNichtangekuendigtes {
	if (!istUniversalvariante(e.universalvariante)) {
		throw new FachlicherFehler(
			'unbekannte_variante',
			'Wählen Sie, wer bei einer Universalversammlung als anwesend gilt.',
			'universalvariante'
		);
	}

	let reglementFundstelle: string | null = null;
	if (e.reglementGestattet) {
		const beleg = e.reglementFundstelle?.trim() ?? '';
		if (zeichenzahl(beleg) < 3) {
			throw new FachlicherFehler(
				'nichtangekuendigtes_ohne_fundstelle',
				'Zur Angabe gehört der Artikel im Reglement, der Beschlüsse über nicht angekündigte ' +
					'Gegenstände ausdrücklich gestattet.',
				'reglementFundstelle'
			);
		}
		reglementFundstelle = beleg;
	}

	const universal = e.universalFundstelle?.trim() ?? '';
	return {
		reglementGestattet: e.reglementGestattet,
		reglementFundstelle,
		universalvariante: e.universalvariante,
		universalFundstelle: universal === '' ? null : universal,
		leitungsvollmachtenZaehlen: e.leitungsvollmachtenZaehlen
	};
}

// ── Universalversammlung ────────────────────────────────────────────────────

/**
 * Eine Partei der Momentaufnahme, wie sie im Moment dasteht.
 *
 * **Wer «mit Vollmacht» da ist, entscheidet die Schale**, nach diesen Regeln:
 *
 *   - Das Organ einer juristischen Person zählt als die Eigentümerin selbst
 *     (Rz. 24 ad Art. 712m), also nicht mit Vollmacht.
 *   - Bei gemeinsamem Eigentum müssen alle Eigentümer der Wohnung da sein
 *     (Produktentscheid 30.09.2026, siehe `UNIVERSALVARIANTE_VORGABE`); ein
 *     Mitberechtigter zählt nicht mehr als selbst da. Ob alle da sind, sieht
 *     Votum nicht, die Leitung bestätigt es.
 *   - Gesetzliche Vertretung (Beistand, Eltern) zählt wie eine Vollmacht: Der
 *     Bestand sagt nichts dazu, und das ist die sicherere Richtung.
 *   - Eine Nutzniesserin ist in Votum nie eine eigene Partei; gezählt wird
 *     immer die Eigentümerin.
 */
export interface Universalpartei {
	parteiId: Id;
	name: string;
	anwesend: boolean;
	/** Anwesend nur kraft gewöhnlicher Vollmacht. */
	mitVollmacht: boolean;
	/** Diese Vollmacht hält die Sitzungsleitung oder die Verwaltung. */
	vollmachtDerLeitung: boolean;
	/** Wer vertritt, bei `mitVollmacht`. Das Protokoll nennt es (Fachprüfung Runde 2, Stelle 9). */
	vertreter?: string | null;
	/**
	 * Selbst da, aber über eine Person, die nicht die Partei ist: das Organ.
	 * «mitberechtigt» setzt seit dem 30.09.2026 keine Zählung mehr; der Wert
	 * bleibt im Typ, weil alte gespeicherte Stände ihn tragen können.
	 */
	selbstAls?: 'organ' | 'mitberechtigt' | null;
	/**
	 * Die Wohnung gehört mehreren (gemeinsames Eigentum). Votum führt die
	 * Anwesenheit je Partei und sieht nicht, welche der Eigentümer da sind; ob
	 * alle da sind, bestätigt die Leitung (Produktentscheid 30.09.2026).
	 */
	gemeinsam?: boolean;
	/**
	 * Die Nutzniesser der Einheiten dieser Partei aus der Momentaufnahme bei der
	 * Freigabe (`snapshot_unit.usufruct_holder_name`), als «Einheit: Name». Auch sie müssen da sein; bestätigt von der Leitung.
	 */
	nutzniesser?: string[];
}

/**
 * Warum die Versammlung nicht vollzählig ist, je Grund getrennt.
 *
 * Getrennt, weil jeder Grund einen anderen Ausweg hat: Wer fehlt, kann kommen
 * oder eine Vollmacht schicken; wer nur mit Vollmacht da ist, zählt erst unter
 * einer anderen Einstellung. Ein einziger Satz «es fehlen» schickte die Leitung
 * ans Telefon, wo die Einstellung der Grund ist.
 */
export interface Universalbefund {
	/** Ob die Versammlung nach der Einstellung vollzählig ist. */
	vollzaehlig: boolean;
	/** Nicht da. */
	fehlend: string[];
	/** Nur mit gewöhnlicher Vollmacht da, und die Einstellung ist «persönlich». */
	nurVollmacht: string[];
	/** Von der Leitung vertreten, und diese Vollmachten zählen nicht. */
	durchLeitung: string[];
	/** Mit Vollmacht da und mitgezählt. Belegt nur bei «vertreten». */
	vertreten: string[];
	/**
	 * Da, aber die Wohnung gehört mehreren: Ob alle ihre Eigentümer da sind,
	 * sieht Votum nicht; die Leitung prüft es selbst (Produktentscheid
	 * 30.09.2026). Kein Grund gegen die Vollzähligkeit, eine Aufgabe vor der
	 * Bestätigung.
	 */
	pruefenGemeinsam?: string[];
	/** Da, mit einer erfassten Nutzniessung: «Einheit: Name», von der Leitung zu prüfen. */
	pruefenNutzniessung?: string[];
	/** Wie viele Parteien die Momentaufnahme führt. */
	anzahl: number;
}

/**
 * Stellt fest, ob die Versammlung als Universalversammlung tagt.
 *
 * Gezählt wird je Partei, wie überall in Votum. Eine Momentaufnahme ohne
 * Partei ist nie vollzählig: «alle null Eigentümer anwesend» ist keine
 * Versammlung. Bei «keine» ist sie es auch dann nicht, wenn alle da sind.
 */
export function pruefeUniversalversammlung(
	einstellung: Pick<AusnahmenNichtangekuendigtes, 'universalvariante' | 'leitungsvollmachtenZaehlen'>,
	parteien: Universalpartei[]
): Universalbefund {
	const befund: Universalbefund = {
		vollzaehlig: false,
		fehlend: [],
		nurVollmacht: [],
		durchLeitung: [],
		vertreten: [],
		pruefenGemeinsam: [],
		pruefenNutzniessung: [],
		anzahl: parteien.length
	};
	const variante = einstellung.universalvariante;
	if (variante === 'keine' || parteien.length === 0) return befund;

	for (const p of parteien) {
		if (zaehltAlsDa(einstellung, p)) {
			if (p.gemeinsam) befund.pruefenGemeinsam!.push(p.name);
			befund.pruefenNutzniessung!.push(...(p.nutzniesser ?? []));
		}
		if (!p.anwesend) befund.fehlend.push(p.name);
		else if (!p.mitVollmacht) continue;
		else if (variante === 'persoenlich') befund.nurVollmacht.push(p.name);
		else if (p.vollmachtDerLeitung && !einstellung.leitungsvollmachtenZaehlen)
			befund.durchLeitung.push(p.name);
		else befund.vertreten.push(p.name);
	}
	befund.vollzaehlig =
		befund.fehlend.length === 0 &&
		befund.nurVollmacht.length === 0 &&
		befund.durchLeitung.length === 0;
	return befund;
}

/**
 * Zählt diese Partei im Moment als da, nach der Einstellung?
 *
 * Dieselbe Regel wie in `pruefeUniversalversammlung`, für eine einzelne
 * Partei. Das Schliessen braucht sie je Partei, weil dort nur zählt, wer nicht
 * abgestimmt hat.
 */
export function zaehltAlsDa(
	einstellung: Pick<AusnahmenNichtangekuendigtes, 'universalvariante' | 'leitungsvollmachtenZaehlen'>,
	p: Universalpartei
): boolean {
	if (einstellung.universalvariante === 'keine' || !p.anwesend) return false;
	if (!p.mitVollmacht) return true;
	if (einstellung.universalvariante === 'persoenlich') return false;
	return !p.vollmachtDerLeitung || einstellung.leitungsvollmachtenZaehlen;
}

/** Wie eine Partei im Saal steht, aus dem Anwesenheitsstand gelesen. */
export interface Praesenzeintrag {
	parteiId: Id;
	name: string;
	anwesend: boolean;
	/** Anwesend über den Erfassungsweg `vertretung`: Jemand anders ist für sie da. */
	ueberVertretung: boolean;
	/** Aus der Momentaufnahme: Die Wohnung gehört mehreren. */
	gemeinsam?: boolean;
	/** Aus der Momentaufnahme: erfasste Nutzniesser, «Einheit: Name». */
	nutzniesser?: string[];
}

/** Eine wirksame Vertretung, mit ihrem Grund (Migration 120). */
export interface Vertretungseintrag {
	vertreteneParteiId: Id;
	/** NULL heisst gewöhnliche Vollmacht. */
	grund: Vertretungsgrund | null;
	vertreter: string;
}

/**
 * Baut aus Präsenz und Vollmachten die Parteien für die Universalversammlung.
 *
 * **Wer über eine Vertretung da ist, gilt als «mit Vollmacht», ausser**
 * (Produktentscheide 29.09.2026):
 *
 *   - das Organ einer juristischen Person: Es ist die Eigentümerin im Handeln
 *     (Rz. 24 ad Art. 712m);
 *
 * Ein Mitberechtigter derselben Einheit zählt seit dem 30.09.2026 nicht mehr
 * als selbst da: An der Universalversammlung müssen alle Eigentümer der
 * Wohnung da sein (Produktentscheid 30.09.2026). Seine Vertretung ist eine
 * wie jede andere.
 *
 * **Die gesetzliche Vertretung zählt wie eine Vollmacht**: Der Bestand sagt
 * nichts, und das ist die sicherere Richtung (Entscheid der Sitzung vom
 * 29.09.2026). Findet sich zu einer Vertretung keine wirksame Vollmacht, gilt
 * sie ebenso als Vollmacht: Im Zweifel zählt eine Partei nicht als selbst da.
 *
 * **Eine Nutzniesserin ist nie eine eigene Partei.** Ist sie für die
 * Eigentümerin da, dann mit Vollmacht, und zählt unter «persönlich» nicht.
 *
 * `leitung` sind die Schlüssel der Vertreter, die die Leitung als
 * Sitzungsleitung oder Verwaltung angekreuzt hat (Migration 128), gebildet mit
 * `vollmachtsschluessel`.
 */
export function universalparteien(
	praesenz: Praesenzeintrag[],
	vertretungen: Vertretungseintrag[],
	leitung: ReadonlySet<string>
): Universalpartei[] {
	const jePartei = new Map(vertretungen.map((v) => [v.vertreteneParteiId, v]));
	return praesenz.map((p) => {
		if (!p.anwesend || !p.ueberVertretung) {
			return {
				parteiId: p.parteiId,
				name: p.name,
				anwesend: p.anwesend,
				mitVollmacht: false,
				vollmachtDerLeitung: false,
				vertreter: null,
				selbstAls: null,
				gemeinsam: p.gemeinsam ?? false,
				nutzniesser: p.nutzniesser ?? []
			};
		}
		const v = jePartei.get(p.parteiId);
		// Nur das Organ ist die Eigentümerin selbst. Ein Mitberechtigter, der die
		// Wohnung vertritt, ist seit dem 30.09.2026 eine Vertretung wie jede
		// andere: Für die Universalversammlung müssen alle Eigentümer der Wohnung
		// da sein (`UNIVERSALVARIANTE_VORGABE`).
		const selbst = v?.grund === 'organ';
		return {
			parteiId: p.parteiId,
			name: p.name,
			anwesend: true,
			mitVollmacht: !selbst,
			vollmachtDerLeitung: !selbst && !!v && leitung.has(vollmachtsschluessel(v.vertreter)),
			vertreter: v?.vertreter ?? null,
			selbstAls: selbst ? 'organ' : null,
			gemeinsam: p.gemeinsam ?? false,
			nutzniesser: p.nutzniesser ?? []
		};
	});
}

// ── Absagen ─────────────────────────────────────────────────────────────────

/** Worauf sich ein nicht angekündigtes Geschäft stützt, das zur Abstimmung darf. */
export type Ausnahmegrund = 'reglement' | 'universal';

/**
 * Die Fundstelle, wenn das Reglement Beschlüsse über nicht Angekündigtes
 * gestattet, sonst null. Gelesen wird die Momentaufnahme, nicht die
 * Gemeinschaft: Es gilt, was bei der Freigabe der Einladung stand.
 */
export function reglementGestattet(a: AusnahmenNichtangekuendigtes | undefined): string | null {
	return a?.reglementGestattet ? a.reglementFundstelle : null;
}

/**
 * Die Sätze der Absage, **einmal** und nicht je Weg.
 *
 * Aufnehmen und Eröffnen sagen dasselbe; standen die Sätze an beiden Orten
 * ausgeschrieben, liefen sie auseinander (so bei der Folgeantragsprüfung am
 * 07.09.2026).
 *
 * **Beide Ausnahmen, seit Votum beide prüft** (Migration 128). Bis dahin
 * durfte der Satz die Universalversammlung weder als Weg nennen noch dem
 * Gesetz absprechen (Fachprüfung 29.09.2026, Runde 3). «Universalversammlung»
 * wird im selben Satz erklärt (Laienprüfung Runde 2, L17).
 */
export const NICHT_ANGEKUENDIGT_GRUNDSATZ =
	'Über ein Geschäft, das nicht auf der versandten Traktandenliste stand, wird in der Regel nicht ' +
	'beschlossen. Geschützt ist, wer nicht da ist und auf die Liste vertraut hat (ZGB Art. 67 Abs. 3 ' +
	'i.V.m. Art. 712m Abs. 2). Ausnahmen gibt es zwei: Das Reglement gestattet es ausdrücklich, oder ' +
	'die Versammlung tagt als Universalversammlung. Das heisst: Alle Eigentümer sind da, und niemand ' +
	'widerspricht (SVIT-Kommentar Rz. 39 und 84 ad Art. 712n).';

/** Warum (a) fehlt, und wann ein Nachtrag wirkt (Laienprüfung 29.09.2026, L1). */
export const NICHT_ANGEKUENDIGT_OHNE_REGLEMENT =
	'Eine solche Bestimmung des Reglements ist für diese Versammlung nicht hinterlegt. Hinterlegt ' +
	'wird sie auf der Reglementsseite der Gemeinschaft, bevor die Einladung freigegeben wird; ein ' +
	'Nachtrag jetzt gilt erst für die nächste Versammlung.';

/**
 * **Am gemeinsamen Abend nicht** (Codeprüfung 29.09.2026). Dort wird über die
 * Liste des Abends abgestimmt, und die führt kein neues Geschäft
 * (`zielDesAntrags` in `domain/gemeinsameliste.ts`). Das gilt für beide
 * Ausnahmen: Eine Universalversammlung über mehrere Gemeinschaften hinweg
 * hiesse zudem, dass alle Eigentümer aller Häuser da sind.
 */
export const NICHT_ANGEKUENDIGT_AM_ABEND =
	'Am gemeinsamen Abend lässt Votum über ein nicht angekündigtes Geschäft keinen Beschluss zu, ' +
	'auch nicht gestützt auf das Reglement oder als Universalversammlung. Abgestimmt wird dort über ' +
	'die Liste des Abends, und die führt kein neues Geschäft.';

export const NICHT_ANGEKUENDIGT_WEGE =
	'Nehmen Sie das Geschäft als Kenntnisnahme auf und traktandieren Sie den Beschluss für ' +
	'die nächste Versammlung. Liegt die Sache im Kern eines angekündigten Antrags, führen ' +
	'Sie sie als Folgeantrag dazu.';

/**
 * Beim Eröffnen steht das Geschäft schon auf der Liste; «aufnehmen» wäre dort
 * der falsche Handgriff (Laienprüfung 29.09.2026, L6).
 */
export const NICHT_ANGEKUENDIGT_BEIM_EROEFFNEN =
	'Beim Aufnehmen wurde keine Ausnahme vermerkt. Behandeln Sie das Geschäft heute zur Kenntnis ' +
	'und traktandieren Sie den Beschluss für die nächste Versammlung. Liegt die Sache im Kern eines ' +
	'angekündigten Antrags, nehmen Sie sie dort als Folgeantrag auf.';

/**
 * Der Schluss, wenn die Universalversammlung im Moment nicht trägt. Nicht bei
 * blosser fehlender Bestätigung: Dort genügt das Häkchen, und ein Rat zum
 * Aufgeben wäre der falsche (Laienprüfung Runde 2, L4).
 */
export const UNIVERSAL_SONST =
	'Lässt sich das nicht erreichen, behandeln Sie das Geschäft heute zur Kenntnis und ' +
	'traktandieren Sie den Beschluss für die nächste Versammlung.';

/**
 * Der Schluss, wo es nichts zu erreichen gibt: nach einem Widerspruch und bei
 * «keine» (Laienprüfung Block 3, U7).
 */
export const UNIVERSAL_KENNTNIS =
	'Behandeln Sie das Geschäft heute zur Kenntnis und traktandieren Sie den Beschluss für die ' +
	'nächste Versammlung.';

const EINSTELLUNG_EINGEFROREN =
	'Die Einstellung gilt, wie sie bei der Freigabe der Einladung stand.';

/** Grund 2d: die Bestätigung der Leitung fehlt. */
export const UNIVERSAL_OHNE_BESTAETIGUNG =
	'Bestätigen Sie zuerst, dass Sie nach einem Widerspruch gefragt haben und niemand ' +
	'widersprochen hat.';

/**
 * Nach einem Widerspruch nicht nochmals. Sonst liesse sich ein Widerspruch
 * überstimmen, indem die Leitung den Durchgang für fehlerhaft erklärt und neu
 * eröffnet; der Widerspruch hat aber die Universalversammlung für dieses
 * Geschäft aufgehoben (Laienprüfung Runde 2, L22).
 *
 * **Ohne «bei einer früheren Abstimmung»** (Migration 129): Seit auch der
 * Widerspruch vor dem Eröffnen festgehalten wird, gab es vor ihm nicht
 * immer eine Abstimmung.
 */
export const UNIVERSAL_NACH_WIDERSPRUCH =
	'Zu diesem Geschäft hat jemand widersprochen, dass heute darüber beschlossen wird. Als ' +
	'Universalversammlung wird heute nicht mehr darüber beschlossen.';

/**
 * Der Schluss nach einem Widerspruch, wenn zum Geschäft schon ein Beschluss
 * gilt und die Versammlung das Rückkommen beschlossen hatte (Fachprüfung Block
 * 4a, Stelle 6). «Traktandieren Sie den Beschluss» wäre dort falsch: Es gibt
 * einen.
 */
export const UNIVERSAL_FRUEHERER_BESCHLUSS =
	'Es gilt, was die Versammlung vorher darüber beschlossen hat. Soll das geändert werden, ' +
	'traktandieren Sie es für die nächste Versammlung.';

/**
 * Derselbe Satz für die Leitung, mit Namen und Zeit: Sie muss wissen, wer.
 * An Wand und Telefon steht kein Name (Laienprüfung Runde 2, L14).
 */
export function nachWiderspruchSatz(w: { name: string; am: Zeitpunkt; vorDemEroeffnen: boolean }): string {
	return (
		`${w.name} hat um ${uhrzeit(w.am)}${w.vorDemEroeffnen ? ' vor dem Eröffnen' : ''} ` +
		'widersprochen, dass heute darüber beschlossen wird. Als Universalversammlung wird heute ' +
		'nicht mehr darüber beschlossen.'
	);
}

/**
 * **Alle Gründe auf einmal**, nicht nacheinander (Fachprüfung Runde 2 zu
 * Stelle 2; Laienprüfung L5). Fehlt eine Partei und ist eine andere nur
 * vertreten, holte die Leitung sonst die fehlende ans Telefon und erhielte
 * danach die nächste Absage.
 *
 * Getrennt je Grund, weil jeder einen anderen Ausweg hat (`Universalbefund`).
 * Leer heisst: Die Universalversammlung trägt.
 */
export function universalgruende(l: {
	variante: Universalvariante;
	befund: Universalbefund;
	bestaetigt: boolean;
	fruehererWiderspruch?: boolean;
}): string[] {
	if (l.variante === 'keine') {
		return [
			'Ihre Gemeinschaft hat eingestellt, dass sie keine Universalversammlung abhält. ' +
				EINSTELLUNG_EINGEFROREN
		];
	}
	const b = l.befund;
	const gruende: string[] = [];
	if (l.fruehererWiderspruch) gruende.push(UNIVERSAL_NACH_WIDERSPRUCH);
	if (b.anzahl === 0) gruende.push('Für diese Versammlung ist niemand als stimmberechtigt erfasst.');
	if (b.fehlend.length > 0) {
		gruende.push(`Für eine Universalversammlung fehlen: ${b.fehlend.join(', ')}.`);
	}
	if (b.nurVollmacht.length > 0) {
		gruende.push(
			'Nach der Einstellung Ihrer Gemeinschaft zählen dafür nur persönlich Anwesende. ' +
				`Nur mit Vollmacht vertreten sind: ${b.nurVollmacht.join(', ')}. ` +
				'Hat jemand davon laut Handelsregister Einzelunterschrift für die Gesellschaft, der die ' +
				'Wohnung gehört, erfassen Sie die Vollmacht mit dem Grund «Organ» neu. Vertritt ein Mitberechtigter die Wohnung allein, genügt das ' +
				'nicht: Alle Eigentümer der Wohnung müssen persönlich da sein. Sind sie es, erfassen Sie ' +
				'die Wohnung neu als selbst anwesend; sonst traktandieren Sie das Geschäft für die ' +
				'nächste Versammlung.'
		);
	}
	if (b.durchLeitung.length > 0) {
		gruende.push(
			'Nach der Einstellung Ihrer Gemeinschaft zählen Vollmachten der Sitzungsleitung oder der ' +
				`Verwaltung dafür nicht. So vertreten sind: ${b.durchLeitung.join(', ')}.`
		);
	}
	if (b.nurVollmacht.length > 0 || b.durchLeitung.length > 0) gruende.push(EINSTELLUNG_EINGEFROREN);
	if (!l.bestaetigt) gruende.push(UNIVERSAL_OHNE_BESTAETIGUNG);
	return gruende;
}

/** Ob ausser der Bestätigung noch etwas fehlt; dann gehört `UNIVERSAL_SONST` dazu. */
export function nurBestaetigungFehlt(gruende: string[]): boolean {
	return gruende.length === 1 && gruende[0] === UNIVERSAL_OHNE_BESTAETIGUNG;
}

/**
 * Der Schluss einer Absage: keiner, wo nur das Häkchen fehlt (L4); ohne
 * Bedingung, wo es nichts zu erreichen gibt (U7); sonst `UNIVERSAL_SONST`.
 *
 * **Nach einem Widerspruch derselbe Schluss wie auf der Leitungsseite**
 * (`docs/freigabe.md`, «Offen: Reste zur Universalversammlung», Punkt 10):
 * Gilt nach einem Rückkommen ein früherer Beschluss (`beschlussGilt`), sagt
 * auch die Absage `UNIVERSAL_FRUEHERER_BESCHLUSS` statt «traktandieren Sie
 * den Beschluss».
 */
export function universalschluss(
	l: { variante: Universalvariante; fruehererWiderspruch?: boolean; fruehererBeschluss?: boolean },
	gruende: string[]
): string {
	if (gruende.length === 0 || nurBestaetigungFehlt(gruende)) return '';
	if (l.variante !== 'keine' && l.fruehererWiderspruch) {
		return nachWiderspruchSchluss(l.fruehererBeschluss === true);
	}
	return l.variante === 'keine' ? UNIVERSAL_KENNTNIS : UNIVERSAL_SONST;
}

/**
 * Der Schluss nach einem Widerspruch am Geschäft: Gilt ein früherer Beschluss,
 * bleibt er; sonst zur Kenntnis und traktandieren. Eine Stelle für Eröffnen
 * und Neuabstimmung.
 */
export function nachWiderspruchSchluss(fruehererBeschluss: boolean): string {
	return fruehererBeschluss ? UNIVERSAL_FRUEHERER_BESCHLUSS : UNIVERSAL_KENNTNIS;
}

// ── Hinweise und Bestätigung ────────────────────────────────────────────────

/**
 * Die Empfehlung, wenn das Reglement es gestattet (Fachprüfung 29.09.2026,
 * Stelle 4a). Rz. 38 ad Art. 712n: «dass von der Benutzung der gesetzlichen
 * Gestaltungsfreiheit (Beschlussfassung ohne Traktandierung) abgeraten werden
 * muss».
 */
export function empfehlungMitReglement(fundstelle: string): string {
	return (
		`Ihr Reglement gestattet Beschlüsse über nicht angekündigte Gegenstände (${fundstelle}). ` +
		'Wer nicht da ist, erfährt erst aus dem Protokoll davon. Die Fachliteratur rät, davon nur ' +
		'zurückhaltend Gebrauch zu machen, weil es oft Streit auslöst (SVIT-Kommentar Rz. 38 ad ' +
		'Art. 712n). Ist die Sache nicht dringend, traktandieren Sie sie für die nächste Versammlung.'
	);
}

/**
 * Die Empfehlung bei der Universalversammlung (Runde 2, Stelle 4b, mit den
 * Befunden L8 und L9). Der Satz zum Weggehen ist der wichtigste für die
 * Leitung: Er sagt ihr, worauf sie bis zum Schliessen achten muss.
 */
export function empfehlungUniversal(
	variante: Universalvariante,
	leitungsvollmachtenZaehlen = false
): string {
	// Zwei Sätze statt «nur überspringen, wenn es nötig ist, damit …» (U9); die
	// Frage zum Ansagen, damit Widerspruch und Nein schon vor dem Eröffnen
	// getrennt sind (U3); bei der Handzählung zählt jeder Weggang (U5).
	const grund =
		'Dieses Geschäft war nicht angekündigt. Die Ankündigung soll allen Zeit geben, sich ' +
		'vorzubereiten; überspringen Sie sie auch an einer Universalversammlung nur, wenn es nötig ' +
		'ist (SVIT-Kommentar Rz. 39 ad Art. 712n). Ist die Sache nicht dringend, traktandieren Sie ' +
		'sie für die nächste Versammlung. Fragen Sie etwa: «Widerspricht jemand, dass wir heute ' +
		'darüber beschliessen? Wer nur gegen den Antrag ist, stimmt nachher Nein.» Widerspricht ' +
		'jemand, halten Sie den Widerspruch fest. Sagen Sie vor dem Eröffnen an, dass alle bis ' +
		'zum Schluss der Abstimmung bleiben: Wer vorher geht, ohne abzustimmen, hebt die ' +
		'Universalversammlung auf, und es entsteht kein Beschluss. ' +
		// Die beim Gehen dagelassene Vollmacht zählt dafür nicht (Fachprüfung
		// Block 3, Runde 2, Befund 1; Laienprüfung R3).
		(variante === 'persoenlich'
			? 'Eine Vollmacht, die jemand beim Gehen dalässt, ändert daran nichts; wer früher gehen ' +
				'muss, stimmt vorher selbst ab. '
			: !leitungsvollmachtenZaehlen
				? 'Eine Vollmacht, die jemand beim Gehen der Sitzungsleitung oder der Verwaltung gibt, ' +
					'ändert daran nichts; wer früher gehen muss, stimmt vorher selbst ab. '
				: '') +
		'Ist jemand nur kurz draussen, schliessen Sie erst, wenn er zurück ist. Bei einer ' +
		'Handzählung genügt schon das Gehen. ' +
		// Was Votum nicht sieht (Produktentscheid 30.09.2026; Fachprüfung Runde 1,
		// F5, F6, Runde 2, R2-4; Laienprüfung U4-1, U4-2, N1). Ein Ausweg für alles,
		// was die Leitung nicht sicher weiss.
		'Ein Wohnrecht, eine Pfändung oder einen Konkurs kennt Votum nicht; prüfen Sie selbst, ob ' +
		'eine Wohnung damit belastet ist. Wissen Sie nicht sicher, wer alles da sein muss, etwa bei ' +
		'einer Erbengemeinschaft, einem Willensvollstrecker, einem Wohnrecht oder einer Pfändung, ' +
		'bestätigen Sie nicht. Traktandieren Sie das Geschäft dann für die nächste Versammlung.';
	if (variante !== 'vertreten') return grund;
	// Die Wahl trägt die Einstellung der Gemeinschaft, nicht die Leitung im Saal
	// (Produktentscheid 29.09.2026, Nachtrag zu Frage 54); «vertretbar,
	// entschieden ist es nicht» gehört deshalb nicht mehr hierher. Die Vollmacht
	// ist Voraussetzung, und die Leitung prüft sie, statt nur zu fragen
	// (Rz. 26, 27 ad Art. 712m; Art. 33 Abs. 2 OR; Fachprüfung Runde 1, 2.1).
	return (
		`${grund} Vertretene zählen hier als anwesend; so ist es für diese Gemeinschaft eingestellt. ` +
		'Prüfen Sie bei jeder Vertretung, ob die Vollmacht auch Geschäfte deckt, die nicht ' +
		'angekündigt waren (SVIT-Kommentar Rz. 26 und 27 ad Art. 712m). Eine Vollmacht nur für die ' +
		'Traktanden der Einladung deckt das nicht. Deckt sie es nicht oder ist es unklar, gilt die ' +
		'Partei für dieses Geschäft nicht als da. Dann ist es keine Universalversammlung, und Sie ' +
		'traktandieren das Geschäft für eine spätere Versammlung; ist es dringend, kann dafür eine ' +
		'ausserordentliche einberufen werden.'
	);
}

/**
 * Was die Leitung vor dem Eröffnen bestätigt (Runde 2, Stelle 3, mit den
 * Befunden der Fachprüfung und L6, L7). «Parteien», weil eine Gesellschaft
 * durch ihr Organ da ist; «Alle Eigentümer sind persönlich anwesend» wäre dort
 * wörtlich falsch. Organ, Behörde und der Satz in der Ich-Form nach den Prüfungen
 * vom 30.09.2026 (`quellen/pruefung/berichte/2026-09-30-universalversammlung-gemeinsames-eigentum.md`,
 * R2-1 bis R2-3, R3-1; Laienprüfung Runde 3, B2).
 * «Auch meinen eigenen» nur, wo Vollmachten der Leitung überhaupt zählen.
 */
export function universalbestaetigung(
	einstellung: Pick<AusnahmenNichtangekuendigtes, 'universalvariante' | 'leitungsvollmachtenZaehlen'>,
	// Der Befund im Moment der Bestätigung: Die Wohnungen, bei denen Votum nicht
	// sieht, wer da ist, bestätigt die Leitung hier namentlich (Produktentscheid
	// 30.09.2026).
	befund?: Universalbefund
): string {
	const frage =
		'Ich habe das Geschäft und den Antrag vorgestellt und gefragt, ob jemand widerspricht, dass ' +
		'heute darüber beschlossen wird.';
	const vertreten = einstellung.universalvariante === 'vertreten';
	const geprueft = universalgeprueft(befund, vertreten);
	const selbstGeprueft =
		'Ob eine Wohnung mit einem Wohnrecht, einer Pfändung oder einem Konkurs belastet ist, habe ' +
		'ich selbst geprüft. ';
	if (vertreten) {
		return (
			'Jede Partei ist selbst da oder mit Vollmacht vertreten, bei gemeinsamem Eigentum jede ' +
			'Eigentümerin der Wohnung. Ebenso da oder vertreten ist, wer an einer Wohnung eine ' +
			'Nutzniessung oder ein Wohnrecht hat, und bei einer Pfändung, einer Pfandverwertung oder ' +
			'im Konkurs die zuständige Behörde. ' +
			selbstGeprueft +
			geprueft +
			`${frage} Bei allen Vertretungen${einstellung.leitungsvollmachtenZaehlen ? ', auch meinen eigenen,' : ''} ` +
			'habe ich geprüft, dass ihre Vollmacht auch Geschäfte deckt, die nicht auf der Liste ' +
			'standen. Niemand hat widersprochen.'
		);
	}
	return (
		'Jede Partei ist selbst da: bei gemeinsamem Eigentum alle Eigentümer der Wohnung, bei einer ' +
		'AG, GmbH oder anderen Eigentümergesellschaft ihr Organ, also wer laut Handelsregister ' +
		'Einzelunterschrift für sie hat. Eine einfache Gesellschaft ist gemeinsames Eigentum. Da ist ' +
		'auch, wer an einer Wohnung eine Nutzniessung oder ein Wohnrecht hat, und bei einer ' +
		'Pfändung, einer Pfandverwertung oder im Konkurs die zuständige Behörde. ' +
		selbstGeprueft +
		geprueft +
		`${frage} Niemand hat widersprochen.`
	);
}

/**
 * Der Satz, mit dem die Leitung die Wohnungen namentlich bestätigt, bei denen
 * Votum nicht sieht, wer da ist: gemeinsames Eigentum und erfasste
 * Nutzniessung. Leer, wo es keine gibt. Mit Leerzeichen am Ende, weil er
 * mitten in der Bestätigung steht.
 */
function universalgeprueft(befund: Universalbefund | undefined, vertreten: boolean): string {
	const gemeinsam = befund?.pruefenGemeinsam ?? [];
	const nutz = befund?.pruefenNutzniessung ?? [];
	const da = vertreten ? 'da oder vertreten' : 'da';
	const teile = [
		...(gemeinsam.length > 0
			? [`Bei ${gemeinsam.join('; ')} habe ich geprüft, dass alle Eigentümer der Wohnung ${da} sind.`]
			: []),
		...(nutz.length > 0 ? [`${vertreten ? 'Da oder vertreten' : 'Da'} sind auch die Nutzniesser: ${nutz.join('; ')}.`] : [])
	];
	return teile.length > 0 ? `${teile.join(' ')} ` : '';
}

/**
 * Der Widerspruch nach dem Eröffnen (Runde 2, Stelle 8). **Getrennt von der
 * Nein-Stimme** (Laienprüfung L21, hoch): Ein Knopfdruck beendet das Geschäft
 * für heute, und wer nur dagegen ist, soll Nein stimmen können, ohne das
 * auszulösen. Widersprechen kann, wer Mitglied der Versammlung ist oder für
 * eines handelt, nicht ein Gast oder Mieter (Fachprüfung Runde 2, Stelle 8;
 * Rz. 92 ad Art. 712n); die Auswahl führt deshalb nur Parteien.
 */
export const WIDERSPRUCH_ERKLAERUNG =
	'Widerspruch heisst: Eine Eigentümerin, ein Eigentümer oder eine Vertretung will nicht, dass ' +
	'heute darüber beschlossen wird. Wer nur gegen den Antrag ist, stimmt Nein; im Zweifel fragen ' +
	'Sie nach. Nach einem Widerspruch entsteht aus dieser Abstimmung kein Beschluss; schliessen ' +
	'Sie sie danach wie gewohnt. Als Universalversammlung wird heute nicht mehr darüber ' +
	'beschlossen.';

/**
 * Vor dem Eröffnen (Produktentscheid 29.09.2026, Migration 129). Dieselbe
 * Trennung vom Nein wie während der Abstimmung; die Folge ist dieselbe, nur
 * gibt es noch keine Abstimmung, die ohne Beschluss endet.
 */
export const WIDERSPRUCH_VOR_EROEFFNEN =
	'Widerspricht jemand, halten Sie das hier fest, statt die Bestätigung anzukreuzen. Wer nur ' +
	'gegen den Antrag ist, widerspricht nicht, sondern stimmt nachher Nein; im Zweifel fragen Sie ' +
	'nach, bevor Sie festhalten.';

/**
 * Endgültig, und das gehört vor den Klick (Laienprüfung Block 4a, L1;
 * Fachprüfung Stelle 2): Die Zeile lässt sich weder ändern noch löschen.
 */
export const WIDERSPRUCH_VOR_EROEFFNEN_FOLGE =
	'Als Universalversammlung wird heute nicht mehr darüber beschlossen, auch wenn die Person es ' +
	'sich danach anders überlegt. Das Protokoll vermerkt den Widerspruch.';

/** Die Rückfrage vor dem Festhalten, gleich gesagt wie die Erklärung (U2). */
export const WIDERSPRUCH_FOLGE =
	'Aus dieser Abstimmung entsteht dann kein Beschluss, und als Universalversammlung wird heute ' +
	'nicht mehr darüber beschlossen.';

/**
 * Nach einem Weggang ohne Stimme darf neu eröffnet werden, sobald wieder alle
 * da sind (Fachprüfung Block 3, Frage 3; Rz. 23, 24 ad Art. 712p analog). Ein
 * Weggang ist kein Widerspruch. Nach einem Widerspruch nicht
 * (`UNIVERSAL_NACH_WIDERSPRUCH`).
 */
export const UNIVERSAL_NACH_WEGGANG =
	'Sind wieder alle da, können Sie neu eröffnen: Stellen Sie das Geschäft kurz noch einmal vor, ' +
	'fragen Sie erneut nach einem Widerspruch und kreuzen Sie wieder an. Kommt die Person heute ' +
	'nicht mehr, traktandieren Sie den Beschluss für die nächste Versammlung.';

/**
 * Der Weg danach auf der Leitungsseite. Wer nur über eine Vollmacht der Leitung
 * vertreten war, ist nicht gegangen und kommt nicht «wieder»; dort fehlt eine
 * Vertretung, die zählt (Codeprüfung Block 4a, N-4). Ohne Angabe je Name wie
 * bisher.
 */
export function wegNachKeinemBeschluss(k: KeinBeschluss): string {
	if (k.grund === 'konsultativ') return k.neuAnZweiter ? KONSULTATIV_WEG_NEU : KONSULTATIV_WEG;
	const leitung = (k.nurDurchLeitung ?? []).length > 0;
	if (!leitung) return UNIVERSAL_NACH_WEGGANG;
	const gegangen = gegangenOhneLeitung(k).length > 0;
	/*
	 * **Wer vertreten darf, und womit** (Fachprüfung 30.09.2026, Befund 3;
	 * Laienprüfung Befund 5). «Durch jemand anderen» liess eine zweite Person
	 * aus Leitung oder Verwaltung zu. Eine von ihr weitergegebene Vollmacht
	 * genügt nicht: Sonst wählte die Verwaltung aus, wer für die Partei zustimmt
	 * (Fachprüfung Runde 2, Befund 2; Auslegung der Prüfung, der Kommentar
	 * behandelt die Frage nicht). Das Kreuz hält eine Tatsache fest; zurücknehmen
	 * nur, wenn es falsch war, offen und mit Grund im Protokoll über das Votum
	 * (Runde 1, Befund 5; Runde 2, Befund 3; Runde 3, Befund 1; Rz. 91 ad
	 * Art. 712n). Danach zählt dieselbe Vertretung wieder (Laienprüfung Runde 3,
	 * L3-2). Mündlich genügt, Rz. 27 ad Art. 712m.
	 */
	// Die Bedingung zuerst, dann die Prüfung (Laienprüfung Runde 4, L4-1: nach
	// «genügt nicht» las sich «Dann» als «in diesem Fall»).
	// Mehrere nur durch die Leitung Vertretene: «jede Partei, die …» (Schritt F2;
	// Laienprüfung 30.09.2026, Runde 5; «dieser Parteien» konnte sich nach «Wer
	// gegangen ist» auf die Gegangenen beziehen, Laienprüfung F2, S6). Die Sätze
	// danach bleiben in der Einzahl richtig, weil sie von jeder einzelnen sprechen.
	const wer =
		(k.nurDurchLeitung ?? []).length > 1
			? // Runde 2: wie die Kurzzeile darüber, Leitung oder Verwaltung.
				'jede Partei, deren Vollmacht bei Ihnen oder der Verwaltung lag,'
			: 'die Partei';
	return (
		(gegangen ? 'Wer gegangen ist, muss wieder da sein. ' : '') +
		`Neu eröffnen können Sie, sobald ${wer} selbst da ist oder durch jemanden vertreten wird, ` +
		'der nicht für Sie oder die Verwaltung handelt. Dessen Vollmacht muss von der Partei selbst ' +
		'stammen und auch dieses nicht angekündigte Geschäft decken. Mündlich genügt, etwa am ' +
		'Telefon mit Ihnen, wenn das Reglement nichts anderes verlangt; halten Sie beim Traktandum im ' +
		'Feld «Voten, Begründungen, Ordnungsentscheide» fest, wer sie wann bestätigt hat. Eine Vollmacht, die Sie oder die Verwaltung weitergegeben haben, genügt nicht, ' +
		'auch wenn sie das Weitergeben erlaubt: Sonst bestimmten Sie, wer für die Partei entscheidet. ' +
		'Ist das erfüllt, stellen Sie das Geschäft kurz noch einmal vor, fragen Sie erneut nach einem Widerspruch ' +
		'und kreuzen Sie wieder an. Geht das heute nicht, traktandieren Sie den Beschluss für die ' +
		'nächste Versammlung.'
	);
}

/**
 * Der seltene Fall eines falsch gesetzten Kreuzes, als eigener Absatz unter dem
 * Weg danach (Laienprüfung Runde 4, L4-2). Das Feld beim Traktandum heisst nach
 * seinem Platzhalter, weil es keine sichtbare Beschriftung hat
 * (`Votum.svelte`).
 */
export const KREUZ_ZURUECKNEHMEN =
	// «Nur», damit die Berichtigung nicht als zweiter Weg zum Beschluss liest
	// (Laienprüfung Runde 5, L5-1).
	'Nur wenn ein Kreuz bei den Vertretern falsch erfasst war, etwa weil die Person gar nicht für ' +
	'Sie oder die Verwaltung handelt, nehmen Sie es zurück, sagen das im Saal und halten beim ' +
	'Traktandum im Feld «Voten, Begründungen, Ordnungsentscheide» fest, warum es falsch war. Danach zählt diese Vertretung wieder, und Sie können neu eröffnen. An dieser ' +
	'Abstimmung ändert das nichts mehr: Sie bleibt ohne Beschluss.';

/**
 * Die Namen unter «Kein Beschluss» auf der Leitungsseite, je Grund eine Zeile
 * (Laienprüfung Runde 2, L14: die Leitung muss wissen, wer).
 */
export function keinBeschlussNamenszeilen(k: KeinBeschluss): string[] {
	if (k.grund === 'widerspruch') return [`Widersprochen hat: ${k.namen.join(', ')}`];
	if (k.grund === 'konsultativ') return [];
	const gegangen = gegangenOhneLeitung(k);
	const leitung = k.nurDurchLeitung ?? [];
	return [
		...(gegangen.length > 0
			? [
					`${k.handzaehlung ? 'Während der Abstimmung gegangen' : 'Ohne Stimme gegangen'}: ` +
						gegangen.join(', ')
				]
			: []),
		...(leitung.length > 0
			? [
					'Nur über eine Vollmacht der Leitung vertreten: ' +
						leitung.map((l) => (l.vertreter ? `${l.name} (durch ${l.vertreter})` : l.name)).join(', ')
				]
			: [])
	];
}

/** Ob ein Durchgang mit «kein Beschluss» einen neuen Durchgang ohne Weiteres zulässt. */
export function wiederEroeffenbar(stand: { keinBeschluss: KeinBeschluss | null } | null | undefined): boolean {
	return stand?.keinBeschluss?.grund === 'weggang';
}

/**
 * Dasselbe für einen Durchgang, auch einen konsultativen (Migration 158). Der
 * konsultative trägt seinen Grund nicht im Stand der Universalversammlung,
 * sondern am Durchgang; nach ihm wird neu eröffnet wie nach einem Weggang.
 * `wiederEroeffenbar` allein bleibt dort, wo es um die Namen des Weggangs geht.
 */
export function durchgangWiederEroeffenbar(d: {
	konsultativ?: boolean;
	universal?: { stand: { keinBeschluss: KeinBeschluss | null } | null } | null;
}): boolean {
	return d.konsultativ === true || wiederEroeffenbar(d.universal?.stand);
}

// ── Schliessen: kein Beschluss ──────────────────────────────────────────────

/**
 * Warum aus einer Universalversammlung kein Beschluss entsteht (Befund B-3 der
 * Fachprüfung, Produktentscheid 29.09.2026).
 *
 *   - `widerspruch`: Nach dem Eröffnen hat jemand widersprochen (BGE 136 III
 *     174: «vor der Beschlussfassung»).
 *   - `weggang`: Beim Schliessen ist eine Partei nicht mehr da, ohne
 *     abgestimmt zu haben (Rz. 23, 24 ad Art. 712p analog).
 *   - `konsultativ` (Migration 158, `konsultativ.ts`): Der Durchgang wurde bei
 *     fehlender Beschlussfähigkeit als konsultativ eröffnet. Er hat mit der
 *     Universalversammlung nichts zu tun und steht nie in ihrem Stand, nur in
 *     der Auszählung; `namen` ist leer.
 *
 * Ein vierter Zustand neben angenommen, abgelehnt und offen, weil eine
 * Ablehnung selbst ein Beschluss wäre, auf den sich später jemand berufen
 * könnte (Fachprüfung Runde 2 zu 5c).
 */
export interface KeinBeschluss {
	grund: 'widerspruch' | 'weggang' | 'konsultativ';
	/** Wer widersprochen hat oder gegangen ist. Nur fürs Protokoll, nicht für die Leinwand. */
	namen: string[];
	/** Wann widersprochen wurde. */
	zeitpunkt?: Zeitpunkt | null;
	/**
	 * Bei der Handzählung: Wer ging, hat vielleicht abgestimmt, festzustellen ist
	 * es nicht. Der Satz sagt dann «während der Abstimmung verlassen», nicht
	 * «ohne abzustimmen» (Laienprüfung Block 3, U5).
	 */
	handzaehlung?: boolean;
	/**
	 * Wer nach dem Gehen über eine Vollmacht abgestimmt hat, die nach der
	 * Einstellung nicht zählt (Fachprüfung Block 3, Runde 2, Befund 3). Der
	 * Stimmnachweis zeigt die Stimme; das Protokoll sagt, warum sie dafür nicht
	 * zählt.
	 */
	stimmeOhneWirkung?: string[];
	/**
	 * Wer von `namen` nicht gegangen ist, sondern beim Schliessen nur über eine
	 * Vollmacht der Sitzungsleitung oder der Verwaltung da war, die nach der
	 * Einstellung nicht zählt, ohne seit dem Eröffnen die Versammlung verlassen
	 * zu haben (Codeprüfung Block 4a, N-4). Meist ist der Vertreter erst nach dem
	 * Eröffnen angekreuzt worden; vorher hätte das Eröffnen die Versammlung
	 * nicht als vollzählig angenommen. «Hat die Versammlung verlassen» wäre über
	 * eine solche Partei falsch.
	 *
	 * Eine Angabe je Name statt eines dritten Grunds: Der Weg danach ist
	 * derselbe wie nach einem Weggang (neu eröffnen, sobald alle so da sind, wie
	 * es zählt), und beides kann im selben Durchgang vorkommen. Fehlt bei
	 * Ständen von vorher; dort gelten alle `namen` als gegangen.
	 */
	nurDurchLeitung?: Leitungsvertretung[];
	/**
	 * Konsultativ nach der Sperre von L5 (Migration 174): Die Versammlung war
	 * beschlussfähig, nur nicht wie eine erste. Die Sätze nennen diesen Grund.
	 */
	neuAnZweiter?: boolean;
}

/**
 * Eine Partei, die nur über einen Vertreter der Leitung da war. `erfasstAm`
 * ist, seit wann die Leitung den Vertreter als ihren führt (Migration 129);
 * das Protokoll nennt es, weil diese Handlung der Leitung den Beschluss zu Fall
 * bringt (Fachprüfung 30.09.2026, Befund 2; Rz. 91 ad Art. 712n). Null, wo die
 * Zeit nicht zu lesen ist.
 */
export interface Leitungsvertretung {
	name: string;
	vertreter: string;
	erfasstAm?: Zeitpunkt | null;
}

/**
 * Was beim Schliessen zum gemeinsamen Eigentum festgeschrieben wird
 * (`Universalstand.gemeinsam`). Im Kern statt im Server, damit die Regel dazu
 * neben den übrigen Regeln der Universalversammlung steht; das Protokoll liest
 * den festgeschriebenen Stand.
 */
export function gemeinsamImStand(parteien: Universalpartei[]): GemeinsamEintrag[] {
	return [
		// Das Merkmal der Regel vom 30.09.2026, immer vorn. Ohne es hiesse ein
		// leeres `gemeinsam` bei alten und neuen Ständen Verschiedenes (siehe
		// `gemeinsamSatz`). Hier statt als eigenes Feld, weil der Stand in
		// `server/abstimmung.ts` Feld für Feld gebaut wird.
		{ regel: 'alle_eigentuemer' as const },
		...parteien.filter((p) => p.anwesend && p.gemeinsam).map((p) => ({ name: p.name, alle: true as const })),
		...parteien
			.filter((p) => p.anwesend)
			.flatMap((p) => (p.nutzniesser ?? []).map((n) => ({ name: p.name, nutzniesser: n })))
	];
}

/** Ein Eintrag in `Universalstand.gemeinsam`, siehe dort. */
export type GemeinsamEintrag =
	| { name: string; durch: string }
	| { name: string; alle: true }
	| { name: string; nutzniesser: string }
	| { regel: 'alle_eigentuemer' };

/** Was beim Schliessen über die Universalversammlung festgeschrieben wird (Migration 128). */
export interface Universalstand {
	variante: 'persoenlich' | 'vertreten';
	/** Wie viele Parteien die Momentaufnahme führt. */
	anzahl: number;
	/** Mit Vollmacht vertreten und mitgezählt, je mit dem Vertreter. */
	vertreten: { name: string; vertreter: string | null }[];
	/** Hat abgestimmt und die Versammlung danach verlassen (Fachprüfung Runde 2 zu 5b). */
	abgestimmtUndGegangen: string[];
	/**
	 * Was die Leitung bei gemeinsamem Eigentum und Nutzniessung bestätigt hat.
	 * Fehlt bei Ständen vor Migration 128.
	 *
	 *   - `{ name, durch }`: bis zum 30.09.2026, eine Person für die Einheit
	 *     (Fachprüfung Block 3 zu 5b). Solche Stände behalten ihren Wortlaut.
	 *   - `{ name, alle: true }`: seit dem 30.09.2026, die Wohnung gehört
	 *     mehreren, und laut Bestätigung waren alle ihre Eigentümer da.
	 *   - `{ name, nutzniesser }`: seit dem 30.09.2026, «Einheit: Name» einer
	 *     erfassten Nutzniessung, laut Bestätigung da.
	 *   - `{ regel: 'alle_eigentuemer' }`: das Merkmal, dass der Stand nach der
	 *     Regel vom 30.09.2026 festgeschrieben wurde.
	 */
	gemeinsam?: GemeinsamEintrag[];
	bestaetigtAm: Zeitpunkt;
	keinBeschluss: KeinBeschluss | null;
}

/**
 * Stellt beim Schliessen fest, ob die Universalversammlung gehalten hat.
 *
 * **Wer abgestimmt hat und dann ging, zählt** (Fachprüfung Runde 1, B-3): Er
 * hat an der Beschlussfassung teilgenommen und nicht widersprochen. Wer geht,
 * ohne abzustimmen, hebt sie auf. Dasselbe gilt für eine Partei, die beim
 * Schliessen nur noch so vertreten ist, wie es nach der Einstellung nicht
 * zählt: Sie ist im Sinn der Einstellung gegangen.
 *
 * **Bei der Handzählung** (`abgestimmt` ist null) gibt es keine Stimmen je
 * Partei. Dort führt jeder Weggang während der Abstimmung zu «kein Beschluss»,
 * auch einer mit Rückkehr: Ob jemand vorher abgestimmt hat, ist nicht
 * festzustellen (Produktentscheid 29.09.2026).
 */
export function universalAmSchluss(e: {
	einstellung: Pick<AusnahmenNichtangekuendigtes, 'universalvariante' | 'leitungsvollmachtenZaehlen'>;
	parteien: Universalpartei[];
	abgestimmt: ReadonlySet<Id> | null;
	/**
	 * Wer überhaupt eine Stimme hat, auch eine, die nicht zählt. Ohne Angabe
	 * wie `abgestimmt`.
	 */
	mitStimme?: ReadonlySet<Id>;
	/**
	 * Parteien, die während der Abstimmung als gegangen erfasst wurden. Bei der
	 * Handzählung führt jede davon zu «kein Beschluss»; sonst trennt die Liste
	 * nur, wer gegangen ist und wer nur über die Leitung vertreten war.
	 */
	gegangenWaehrend: Id[];
	/**
	 * Wer davon selbst ging, nicht nur mit seinem Vertreter (Codeprüfung
	 * 30.09.2026, M-1): Geht ein Vertreter kurz hinaus, schreibt Votum jeder
	 * vertretenen Partei ein «verlassen» (`zieheVertreteneNach`), ebenso beim
	 * Beenden einer Vertretung. Das ist kein Weggang der Partei. Ohne Angabe
	 * wie `gegangenWaehrend`.
	 */
	selbstGegangenWaehrend?: Id[];
	/**
	 * Wer beim Eröffnen über welchen Vertreter da war, je Partei. Nur wer beim
	 * Schliessen über **denselben** Vertreter da ist, war «nur durch die Leitung
	 * vertreten» (Fachprüfung 30.09.2026, Runde 3, Befund 2): Geht ein Vertreter
	 * während der Abstimmung und hinterlässt die Vollmacht bei einer Person der
	 * Leitung, ist das der Weggang, den die Einstellung meint, und das Kreuz
	 * läge vor der Bestätigung. Ohne Angabe wird nicht unterschieden.
	 */
	vertreterBeimEroeffnen?: ReadonlyMap<Id, string>;
	/**
	 * Wechselte der Vertreter, zählt, ob die Leitung ihn **nach** der Übernahme
	 * angekreuzt hat (Fachprüfung Runde 4, F4-1): Dann hat ihr Kreuz den
	 * Beschluss zu Fall gebracht, nicht ein Weggang. `vertretenSeit` ist je
	 * Partei der Beginn der jetzigen Vertretung (letztes «eingetroffen» über
	 * eine Vertretung), `kreuzSeit` je Vertreterschlüssel das jetzt geltende
	 * Kreuz.
	 */
	vertretenSeit?: ReadonlyMap<Id, Zeitpunkt>;
	kreuzSeit?: ReadonlyMap<string, Zeitpunkt>;
	widerspruch: { name: string; zeitpunkt: Zeitpunkt } | null;
}): { keinBeschluss: KeinBeschluss | null; abgestimmtUndGegangen: string[] } {
	const nichtDa = e.parteien.filter((p) => !zaehltAlsDa(e.einstellung, p));
	const abgestimmtUndGegangen = e.abgestimmt
		? nichtDa.filter((p) => e.abgestimmt!.has(p.parteiId)).map((p) => p.name)
		: [];
	if (e.widerspruch) {
		return {
			keinBeschluss: {
				grund: 'widerspruch',
				namen: [e.widerspruch.name],
				zeitpunkt: e.widerspruch.zeitpunkt
			},
			abgestimmtUndGegangen
		};
	}
	const gegangen = e.abgestimmt
		? nichtDa.filter((p) => !e.abgestimmt!.has(p.parteiId))
		: e.parteien.filter((p) => nichtDa.includes(p) || e.gegangenWaehrend.includes(p.parteiId));
	/*
	 * **Nur über die Leitung vertreten, nicht gegangen** (Codeprüfung Block 4a,
	 * N-4). Nur wo die Einstellung genau diese Vollmachten ausschliesst; unter
	 * «persönlich» zählt keine Vollmacht, und wer dort nur mit Vollmacht dasteht,
	 * war beim Eröffnen selbst da und ist seither gegangen. Ein Ereignis
	 * «verlassen», das die Partei selbst betrifft, trennt die beiden; eines
	 * über ihren Vertreter nicht (`selbstGegangenWaehrend`).
	 */
	const erstNachUebernahmeAngekreuzt = (p: Universalpartei): boolean => {
		if (!e.vertreterBeimEroeffnen) return true;
		const schluessel = vollmachtsschluessel(p.vertreter ?? '');
		if (vollmachtsschluessel(e.vertreterBeimEroeffnen.get(p.parteiId) ?? '') === schluessel) {
			return true;
		}
		const seit = e.vertretenSeit?.get(p.parteiId);
		const kreuz = e.kreuzSeit?.get(schluessel);
		return !!seit && !!kreuz && kreuz > seit;
	};
	const leitungAusgeschlossen =
		e.einstellung.universalvariante === 'vertreten' && !e.einstellung.leitungsvollmachtenZaehlen;
	/*
	 * **Auch wer mit seinem angekreuzten Vertreter ging** (Codeprüfung
	 * 30.09.2026, zweiter Durchgang, N-a): Stimmt der Vertreter für die Partei
	 * und geht danach, hätte die Stimme ohne das Kreuz gezählt, und «abgestimmt,
	 * dann gegangen» ist erlaubt. Den Beschluss hat das Kreuz zu Fall gebracht.
	 * Ein jetzt geltendes Kreuz am Vertreter vom Eröffnen liegt immer danach;
	 * sonst hätte das Eröffnen abgewiesen.
	 */
	const vertreterDerLeitung = (p: Universalpartei): string | null => {
		if ((e.selbstGegangenWaehrend ?? e.gegangenWaehrend).includes(p.parteiId)) return null;
		if (p.anwesend) {
			return p.mitVollmacht && p.vollmachtDerLeitung && erstNachUebernahmeAngekreuzt(p)
				? (p.vertreter ?? '')
				: null;
		}
		const beimEroeffnen = e.vertreterBeimEroeffnen?.get(p.parteiId);
		return beimEroeffnen && e.kreuzSeit?.has(vollmachtsschluessel(beimEroeffnen))
			? beimEroeffnen
			: null;
	};
	const durchLeitung = leitungAusgeschlossen
		? gegangen.flatMap((p) => {
				const vertreter = vertreterDerLeitung(p);
				return vertreter === null ? [] : [{ partei: p, vertreter }];
			})
		: [];
	const nurLeitung = new Set(durchLeitung.map((d) => d.partei));
	const wirklichGegangen = gegangen.filter((p) => !nurLeitung.has(p));
	return {
		keinBeschluss:
			gegangen.length > 0
				? {
						grund: 'weggang',
						namen: gegangen.map((p) => p.name),
						...(e.abgestimmt ? {} : { handzaehlung: true }),
						...(e.abgestimmt && e.mitStimme
							? (() => {
									const ohne = wirklichGegangen
										.filter((p) => e.mitStimme!.has(p.parteiId))
										.map((p) => p.name);
									return ohne.length > 0 ? { stimmeOhneWirkung: ohne } : {};
								})()
							: {}),
						...(durchLeitung.length > 0
							? {
									nurDurchLeitung: durchLeitung.map((d) => ({
										name: d.partei.name,
										vertreter: d.vertreter
									}))
								}
							: {})
					}
				: null,
		abgestimmtUndGegangen
	};
}

/**
 * Der kurze Grund für Leinwand und Telefon, **ohne Namen** (Laienprüfung
 * Runde 2, L12 und L14; Fachprüfung zu 5c: «der Grund ohne Namen genügt»).
 * «Kein Beschluss» allein neben einer Ja-Mehrheit versteht der Saal nicht.
 */
export function keinBeschlussKurz(k: KeinBeschluss): string {
	if (k.grund === 'widerspruch') return 'Kein Beschluss: Widerspruch';
	if (k.grund === 'konsultativ') return `Kein Beschluss: ${KONSULTATIV_KURZ}`;
	// Nicht «Vertretung durch die Leitung»: Im Saal zeigte das auf die Person
	// vorne (Laienprüfung 30.09.2026, Befund 4); «hier», weil die Vollmacht für
	// die angekündigten Geschäfte zählt (Fachprüfung, Befund 1).
	if (nurLeitungsvertretung(k)) return 'Kein Beschluss: Vollmacht bei Leitung oder Verwaltung zählt hier nicht';
	return k.handzaehlung
		? 'Kein Beschluss: jemand ist gegangen'
		: 'Kein Beschluss: jemand ist ohne Stimme gegangen';
}

/**
 * Ob alle, deretwegen kein Beschluss entstand, nur über die Leitung vertreten
 * waren und niemand gegangen ist. Dann trifft «gegangen» ohne Namen auf
 * niemanden zu; bei einer Mischung trifft es auf jemanden zu und bleibt.
 */
function nurLeitungsvertretung(k: KeinBeschluss): boolean {
	return k.grund === 'weggang' && gegangenOhneLeitung(k).length === 0;
}

/**
 * Der Grund, mit dem ein Durchgang ohne Beschluss beim Neueröffnen überholt
 * wird; er steht im Verlauf und im Abschlusspaket (Codeprüfung Block 4a, N-4).
 * Zählte eine Vertretung nicht, genügt «wieder alle da» nicht (Codeprüfung
 * 30.09.2026, N-3), und «dafür» hätte in der einzelnen Zeile keinen Bezug
 * (Fachprüfung Runde 2, Befund 4).
 */
export function ueberholungsgrundNachWeggang(k: KeinBeschluss | null | undefined): string {
	const leitung = (k?.nurDurchLeitung ?? []).length > 0;
	if (!k || !leitung) {
		return (
			'Kein Beschluss, weil jemand während der Abstimmung gegangen ist; neu eröffnet, nachdem ' +
			'wieder alle da waren'
		);
	}
	return (
		'Kein Beschluss, weil ' +
		(gegangenOhneLeitung(k).length > 0 ? 'jemand während der Abstimmung gegangen ist und ' : '') +
		'jemand nur durch eine Person vertreten war, die für die Sitzungsleitung oder die ' +
		'Verwaltung handelt; neu eröffnet, nachdem alle so da oder vertreten waren, wie es für dieses ' +
		'nicht angekündigte Geschäft zählt'
	);
}

/** Wer von `namen` wirklich gegangen ist; bei Ständen von vorher alle. */
export function gegangenOhneLeitung(k: KeinBeschluss): string[] {
	const leitung = new Set((k.nurDurchLeitung ?? []).map((l) => l.name));
	return k.namen.filter((n) => !leitung.has(n));
}

/**
 * Der Satz über die Parteien, die nur über einen Vertreter der Leitung da
 * waren, mit dem Vertreter wie im Vermerk der gehaltenen Universalversammlung
 * (Fachprüfung Runde 2, Stelle 9). Protokollvermerk und Zeile zum früheren
 * Durchgang teilen ihn. Leer, wenn es niemanden betrifft.
 *
 *   - **Wer erfasst hat und wann** (Fachprüfung 30.09.2026, Befund 2): Das
 *     Kreuz der Leitung bringt den Beschluss zu Fall, und ob sie neutral
 *     gehandelt hat, lässt sich nur prüfen, wenn das Protokoll es sagt.
 *     «Vollmacht der Sitzungsleitung» las sich zudem als eine, die sie
 *     erteilt hat (Laienprüfung, Befund 1).
 *   - **«dafür», nicht «für diese Versammlung»** (Fachprüfung, Befund 1): Für
 *     die angekündigten Geschäfte zählt die Vollmacht wie jede andere.
 */
export function nurDurchLeitungSatz(k: Pick<KeinBeschluss, 'nurDurchLeitung'>): string {
	const l = k.nurDurchLeitung ?? [];
	if (l.length === 0) return '';
	const vertreten =
		l.length === 1
			? `${l[0].name} war bei der Abstimmung durch ${l[0].vertreter} vertreten.`
			: `Bei der Abstimmung waren ${aufzaehlung(l.map((x) => `${x.name} durch ${x.vertreter}`))} vertreten.`;
	const vertreter = [...new Map(l.map((x) => [x.vertreter, x.erfasstAm ?? null])).entries()];
	const erfasst =
		vertreter.length === 1
			? `Die Sitzungsleitung hat ${vertreter[0][0]}` +
				(vertreter[0][1] ? ` um ${uhrzeit(vertreter[0][1])}` : '') +
				' als Person erfasst, die für die Sitzungsleitung oder die Verwaltung handelt.'
			: `Die Sitzungsleitung hat ${aufzaehlung(
					vertreter.map(([v, am]) => (am ? `${v} (um ${uhrzeit(am)})` : v))
				)} als Personen erfasst, die für die Sitzungsleitung oder die Verwaltung handeln.`;
	return (
		`${vertreten} ${erfasst} Vollmachten an solche Personen zählten nicht dafür, dass über dieses ` +
		'nicht angekündigte Geschäft beschlossen werden konnte.'
	);
}

/** «A», «A und B», «A, B und C». */
function aufzaehlung(teile: string[]): string {
	return teile.length <= 1 ? (teile[0] ?? '') : `${teile.slice(0, -1).join(', ')} und ${teile.at(-1)}`;
}

/** Der Satz für Leinwand und Leitung, ohne Namen. */
export function keinBeschlussSatz(k: KeinBeschluss): string {
	if (k.grund === 'konsultativ') return k.neuAnZweiter ? KONSULTATIV_SATZ_NEU : KONSULTATIV_SATZ;
	return k.grund === 'widerspruch'
		? 'Kein Beschluss: Nach dem Eröffnen hat jemand widersprochen, dass heute über dieses nicht ' +
				'angekündigte Geschäft beschlossen wird. Die abgegebenen Stimmen bewirken nichts.'
		: nurLeitungsvertretung(k)
			? // Eingegrenzt auf dieses Geschäft (Fachprüfung 30.09.2026, Befund 1):
				// Die Wand ist für den Saal die Regel, auch beim nächsten Traktandum.
				// Ohne «Ohne alle Eigentümer»: Das klang hier, als zählte keine
				// Vertretung (Laienprüfung, Befund 4).
				'Kein Beschluss: Jemand war bei der Abstimmung nur durch eine Person vertreten, die für ' +
				'die Sitzungsleitung oder die Verwaltung handelt. Solche Vollmachten zählen nicht dafür, ' +
				'dass über dieses nicht angekündigte Geschäft beschlossen wird; für die angekündigten ' +
				'Geschäfte zählen sie wie jede Vollmacht. Die abgegebenen Stimmen bewirken nichts.'
			: (k.handzaehlung
					? 'Kein Beschluss: Jemand hat die Versammlung während der Abstimmung verlassen. '
					: 'Kein Beschluss: Jemand hat die Versammlung vor dem Schluss der Abstimmung verlassen, ' +
						'ohne vorher abzustimmen. ') +
				'Ohne alle Eigentümer wird über dieses nicht angekündigte Geschäft nicht beschlossen. Die ' +
				'abgegebenen Stimmen bewirken nichts.';
}

// ── Protokoll ───────────────────────────────────────────────────────────────

/**
 * Der Vermerk im Protokoll bei (a).
 *
 * **«Zur Abstimmung aufgenommen», nicht «beschlossen»** (Codeprüfung und
 * Laienprüfung 29.09.2026): Der Satz steht auch bei einem abgelehnten, einem
 * zurückgezogenen und einem nie abgestimmten Geschäft; «beschlossen» läse sich
 * dort wie «angenommen». Die Fundstelle läuft über `mitQuelle`, sonst stünde
 * «Art. 21 Reglement des Reglements» im Protokoll.
 */
export function protokollvermerkReglement(fundstelle: string | null): string {
	return (
		'Nicht angekündigt. Zur Abstimmung aufgenommen gestützt auf ' +
		(fundstelle ? mitQuelle(fundstelle) : 'das Reglement') +
		', das Beschlüsse über nicht angekündigte Gegenstände ausdrücklich gestattet ' +
		'(ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2).'
	);
}

/** Wer das Traktandieren verlangen kann (L13); am Schluss jedes Vermerks ohne Beschluss. */
export const TRAKTANDIEREN_VERLANGEN =
	'Das Geschäft kann an einer nächsten Versammlung traktandiert werden; verlangen kann das jede ' +
	'Eigentümerin und jeder Eigentümer bei der Verwaltung.';

/**
 * Der Vermerk, wenn vor dem Eröffnen widersprochen wurde (Produktentscheid
 * 29.09.2026, Migration 129). Ohne ihn stünde bei so einem Geschäft nur
 * «Über diesen Antrag wurde nicht abgestimmt.», ohne Grund.
 *
 * **Am Geschäft, nicht an der Versammlung** (Fachprüfung Block 4a, Frage 2;
 * Laienprüfung L2): «Die Universalversammlung kam nicht zustande» las sich,
 * als hätte der ganze Abend nicht gezählt, und widerspräche einem anderen
 * Geschäft, das am selben Abend als Universalversammlung beschlossen wurde.
 * Der Satz spiegelt deshalb den bestehenden «Als Universalversammlung zur
 * Abstimmung gebracht».
 *
 * `frueher` ist der Vermerk eines früheren Durchgangs, wenn es einen gab: nach
 * einem Weggang ohne Stimme oder nach einem beschlossenen Rückkommen. Dann
 * gehören beide hin, und der Satz zum Traktandieren ans Ende.
 */
export function protokollvermerkWiderspruchVorEroeffnen(
	w: { name: string; zeitpunkt: Zeitpunkt },
	frueher: string | null = null,
	/**
	 * Trug der frühere Durchgang einen Beschluss (nach einem beschlossenen
	 * Rückkommen)? Dann bleibt er in Kraft, und das gehört ins Protokoll
	 * (Laienprüfung Block 4a, L8; Fachprüfung Runde 2 zu Stelle B).
	 *
	 * **Mit der Nummer des Durchgangs** (`docs/freigabe.md`, Punkt (c); H6).
	 * Bis dahin stand «der oben festgehaltene Beschluss», aber dieser Vermerk
	 * steht über dem Ergebnis, nicht darunter. Und «Beschluss» auch bei einer
	 * Ablehnung; jetzt «es bleibt bei der Ablehnung» wie im Zweig darunter.
	 */
	fruehererBeschluss: { durchgang: number; abgelehnt: boolean } | null = null,
	/**
	 * Gab es einen Durchgang, der als Neuabstimmung überholt ist, aber keinen
	 * geltenden? Dann «nicht mehr» (Codeprüfung Block 4a, zweiter Durchgang).
	 */
	nachNeuabstimmung = false,
	/**
	 * Nach dem Rückkommen neu abgestimmt, darauf eine Neuabstimmung angesetzt,
	 * und davor widersprochen (Migration 131). Dann wurde neu abgestimmt, nur
	 * ohne Beschluss (seit H6 nur mit offenem Stichentscheid, denn nur der
	 * lässt sich überholen); «Neu abgestimmt wurde nicht» stünde neben dem
	 * Satz, der den überholten Durchgang nennt (Laien- und Fachprüfung
	 * 29.09.2026). Der geltende Durchgang steht mit Nummer, weil dieser Vermerk
	 * über dem Ergebnis steht, nicht darunter.
	 */
	neuabstimmungNachRueckkommen: { durchgang: number; abgelehnt: boolean } | null = null
): string {
	const satz =
		`Um ${uhrzeit(w.zeitpunkt)} hat ${w.name} widersprochen, dass heute darüber beschlossen wird.`;
	if (frueher && fruehererBeschluss && neuabstimmungNachRueckkommen) {
		const n = neuabstimmungNachRueckkommen;
		return (
			`${frueher} Zur angesetzten Neuabstimmung kam es nicht: Um ${uhrzeit(w.zeitpunkt)} hat ` +
			`${w.name} widersprochen, dass heute neu darüber beschlossen wird. ` +
			(n.abgelehnt
				? `Es bleibt bei der Ablehnung aus dem ${n.durchgang}. Durchgang.`
				: `Es bleibt beim Beschluss aus dem ${n.durchgang}. Durchgang.`)
		);
	}
	if (frueher && fruehererBeschluss) {
		return (
			`${frueher} Neu abgestimmt wurde nicht: Um ${uhrzeit(w.zeitpunkt)} hat ${w.name} ` +
			'widersprochen, dass heute neu darüber beschlossen wird. ' +
			(fruehererBeschluss.abgelehnt
				? `Es bleibt bei der Ablehnung aus dem ${fruehererBeschluss.durchgang}. Durchgang.`
				: `Es bleibt beim Beschluss aus dem ${fruehererBeschluss.durchgang}. Durchgang.`)
		);
	}
	if (!frueher) {
		return (
			`Nicht angekündigt. Nicht${nachNeuabstimmung ? ' mehr' : ''} als Universalversammlung zur ` +
			`Abstimmung gebracht: ${satz} ${TRAKTANDIEREN_VERLANGEN}`
		);
	}
	const ohneSchluss = frueher.endsWith(TRAKTANDIEREN_VERLANGEN);
	return (
		`${ohneSchluss ? frueher.slice(0, -TRAKTANDIEREN_VERLANGEN.length).trimEnd() : frueher} ` +
		`Neu abgestimmt wurde nicht: ${satz}` +
		(ohneSchluss ? ` ${TRAKTANDIEREN_VERLANGEN}` : '')
	);
}

/** Vor dem ersten Durchgang, oder wenn der Durchgang nichts festgeschrieben hat. */
export const PROTOKOLLVERMERK_UNIVERSAL_AUFGENOMMEN =
	'Nicht angekündigt. Als Universalversammlung zur Abstimmung aufgenommen.';

/**
 * Der Satz über die Gegangenen im Vermerk ohne Beschluss; leer, wenn alle nur
 * über die Leitung vertreten waren (Codeprüfung Block 4a, N-4).
 */
function weggangSatz(k: KeinBeschluss, variante: Universalstand['variante']): string {
	const namen = gegangenOhneLeitung(k);
	if (namen.length === 0) return '';
	return k.handzaehlung
		? `${namen.join(', ')} ${namen.length === 1 ? 'hat' : 'haben'} die Versammlung ` +
				'während der Abstimmung verlassen; bei der Handzählung ist nicht festzustellen, ob vorher ' +
				'abgestimmt wurde.'
		: `${namen.join(', ')} ${namen.length === 1 ? 'hat' : 'haben'} die Versammlung vor dem ` +
				'Schluss der Abstimmung verlassen, ohne vorher abzustimmen.' +
				((k.stimmeOhneWirkung ?? []).length > 0
					? ` Die danach über eine Vollmacht abgegebene Stimme von ${k.stimmeOhneWirkung!.join(', ')} ` +
						// Die Regel beim Namen (Laienprüfung Block 3, Runde 3, N2), auf
						// dieses Geschäft begrenzt: Für die angekündigten zählt die Vollmacht
						// (Fachprüfung 30.09.2026, Runde 2, Befund 5).
						(variante === 'persoenlich'
							? 'zählt dafür nicht: Für dieses nicht angekündigte Geschäft genügte eine Vollmacht ' +
								'nicht, es zählten nur persönlich Anwesende.'
							: 'zählt dafür nicht: Vollmachten an Personen, die für die Sitzungsleitung oder die ' +
								'Verwaltung handeln, zählten nicht dafür, dass über dieses nicht angekündigte ' +
								'Geschäft beschlossen werden konnte.')
					: '');
}

/**
 * Der Teil des Protokollsatzes zum gemeinsamen Eigentum und zur Nutzniessung.
 *
 * **Zwei Wortlaute, je nach Stand.** Stände bis zum 30.09.2026 tragen
 * `{ name, durch }` und behalten «durch mindestens eine Person je Einheit»:
 * So wurde damals gezählt, und ein Protokoll berichtigt man nicht still.
 * Seither nennt der Satz, was die Leitung bestätigt hat: alle Eigentümer der
 * gemeinsamen Wohnungen und die Nutzniesser (Produktentscheid 30.09.2026).
 */
function gemeinsamSatz(u: Universalstand): string {
	const g = u.gemeinsam;
	if (!g) return '';
	const alt = g.filter((e): e is { name: string; durch: string } => 'durch' in e);
	if (!istNeuerStand(u)) {
		if (u.variante !== 'persoenlich') return '';
		return (
			', bei gemeinsamem Eigentum durch mindestens eine Person je Einheit' +
			(alt.length > 0 ? ` (${alt.map((e) => `${e.name}: ${e.durch}`).join('; ')})` : '')
		);
	}
	const alle = g.filter((e): e is { name: string; alle: true } => 'alle' in e).map((e) => e.name);
	const nutz = g
		.filter((e): e is { name: string; nutzniesser: string } => 'nutzniesser' in e)
		.map((e) => e.nutzniesser);
	const teile = [
		...(alle.length > 0
			? [
					// Unter «vertreten» ausdrücklich, sonst liest sich «davon N vertreten»
					// als vollständig (Laienprüfung 30.09.2026, U6v-1).
					`bei gemeinsamem Eigentum laut Bestätigung der Sitzungsleitung alle Eigentümer der Wohnung${u.variante === 'vertreten' ? ' selbst oder vertreten' : ''} (${alle.join('; ')})`
				]
			: []),
		...(nutz.length > 0 ? [`ebenso die Nutzniesser (${nutz.join('; ')})`] : [])
	];
	return teile.length > 0 ? `, ${teile.join(', ')}` : '';
}

/**
 * Ob ein Stand nach der Regel vom 30.09.2026 festgeschrieben wurde. Ein leeres
 * `gemeinsam` sagt es nicht: Früher hiess es «keine Einheit mit einem
 * Mitberechtigten», heute «keine gemeinsame Wohnung, keine Nutzniessung». Das
 * Merkmal steht deshalb im Stand selbst.
 */
function istNeuerStand(u: Universalstand): boolean {
	return (u.gemeinsam ?? []).some((e) => 'regel' in e);
}

/**
 * Der Vermerk im Protokoll bei (b), Runde 2, Stellen 5b und 5c mit den
 * Befunden.
 *
 *   - «bei der Abstimmung», nicht «bis zum Schluss»: Wer abgestimmt hat und
 *     dann ging, war nicht bis zum Schluss da und zählt trotzdem (Fachprüfung
 *     Runde 2 zu 5b). Der Satz dazu nur, wenn es vorkam.
 *   - Parteien statt Eigentümer, die Vertretenen mit Namen und Vertreter
 *     (Stelle 9), damit jede Vertretene nachlesen kann, ob sie mitgezählt wurde.
 *   - Unter «persönlich» kein «davon vertreten» (L11): Das Organ ist dort
 *     selbst da.
 *   - Die gemeinsamen Wohnungen und Nutzniesser nach «davon vertreten», damit
 *     sich dieses nicht an die Nutzniesser hängt (Codeprüfung 30.09.2026, N1).
 *   - Bei «kein Beschluss» der Grund mit Namen und wer das Traktandieren
 *     verlangen kann (L13).
 */
export function protokollvermerkUniversal(u: Universalstand): string {
	const um = uhrzeit(u.bestaetigtAm);
	if (u.keinBeschluss) {
		const k = u.keinBeschluss;
		const grund =
			k.grund === 'widerspruch'
				? `Um ${uhrzeit(k.zeitpunkt ?? null)} hat ${k.namen.join(', ')} der Beschlussfassung widersprochen.`
				: [weggangSatz(k, u.variante), nurDurchLeitungSatz(k)].filter(Boolean).join(' ');
		return (
			`Nicht angekündigt, als Universalversammlung eröffnet (bestätigt um ${um}). Kein Beschluss: ` +
			`${grund} Die abgegebenen Stimmen sind festgehalten, bewirken aber nichts. ` +
			TRAKTANDIEREN_VERLANGEN
		);
	}
	const wie = u.variante === 'persoenlich' ? 'persönlich anwesend' : 'anwesend oder vertreten';
	// Seit dem 30.09.2026 die gemeinsamen Wohnungen und Nutzniesser, wie die
	// Leitung sie bestätigt hat; alte Stände behalten ihren Satz (`gemeinsamSatz`).
	const gemeinsam = gemeinsamSatz(u);
	const vertreten =
		u.variante === 'vertreten' && u.vertreten.length > 0
			? `, davon ${u.vertreten.length} vertreten (` +
				u.vertreten.map((v) => (v.vertreter ? `${v.name} durch ${v.vertreter}` : v.name)).join('; ') +
				')'
			: '';
	const gegangen =
		u.abgestimmtUndGegangen.length > 0
			? ` ${u.abgestimmtUndGegangen.join(', ')} ${u.abgestimmtUndGegangen.length === 1 ? 'hat' : 'haben'} ` +
				'abgestimmt und die Versammlung danach verlassen.'
			: '';
	return (
		`Nicht angekündigt. Als Universalversammlung zur Abstimmung gebracht: Alle ${u.anzahl} ` +
		`stimmberechtigten Parteien waren bei der Abstimmung ${wie}${vertreten}${gemeinsam}.${gegangen} Auf Frage ` +
		'der Sitzungsleitung hat niemand der Beschlussfassung widersprochen (bestätigt um ' +
		`${um}).`
	);
}
