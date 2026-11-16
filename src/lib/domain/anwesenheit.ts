/**
 * Anwesenheit als Ereignisfolge (Story 4.6, FR-33, AD-16, AD-1).
 *
 * **Warum eine Folge und kein Kennzeichen.** Ein überschreibbares «anwesend
 * ja/nein» beantwortet die Frage nicht, auf die es ankommt: Wer war *im Moment
 * des Schliessens jener Abstimmung* im Saal? Wer um 20:15 geht, war um 20:00
 * anwesend, und das Ergebnis von 20:00 darf sich um 20:15 nicht ändern. Ein
 * Kennzeichen kann das nicht wissen; eine Folge von Ereignissen mit Zeitpunkt
 * kann es zu jedem beliebigen Zeitpunkt beantworten.
 *
 * Ereignisse werden nur angefügt (AD-5). Eine Korrektur ist ein weiteres
 * Ereignis, nie eine Änderung am bisherigen.
 */
import { FachlicherFehler } from './gemeinschaft';
import { stimmkraftliste, type Stimmkraftliste } from './stimmkraft';
import {
	stelleBeschlussfaehigkeitFest,
	type Beschlussfaehigkeit,
	type Beschlussfaehigkeitsregel,
	type Beteiligung,
	type Versammlungsstufe
} from './beschlussfaehigkeit';
import { ruhendeVertretungenBei, type Ausschlussgrund, type Vertretung } from './auszaehlung';
import type { Id, Snapshot, Zeitpunkt } from './types';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';

/**
 * Was geschehen ist.
 *
 * `eingetroffen` und `verlassen` wechseln sich ab. `angemeldet` ist kein
 * Anwesenheitsereignis, sondern der Wunsch danach — er zählt für nichts, bis
 * die Sitzungsleitung bestätigt. Ihn als Anwesenheit zu führen hiesse, dass
 * jeder mit einem Zugangscode sich selbst stimmberechtigt machen könnte.
 */
export type Anwesenheitsart = 'angemeldet' | 'eingetroffen' | 'verlassen' | 'abgelehnt';

/**
 * Auf welchem Weg es festgestellt wurde.
 *
 * Steht im Protokoll: Bei der einfachen Betriebsart gibt es keine einzelnen
 * Zugriffszeitpunkte, und ohne den Vermerk sähe das später wie eine Lücke aus.
 */
export type Erfassungsweg =
	| 'gescannt'
	| 'selbst'
	| 'von_hand'
	| 'liste'
	| 'vertretung'
	/** Über das eigene Konto angemeldet — ohne Karte, ohne Code. */
	| 'authentik';

export interface Anwesenheitsereignis {
	id: Id;
	meetingId: Id;
	/**
	 * Die Partei — nicht die Zeilenkennung der Momentaufnahme.
	 *
	 * Innerhalb einer Versammlung ist sie eindeutig, und der Kern kommt so ohne
	 * Kenntnis davon aus, wie die Momentaufnahme gespeichert ist. Der
	 * Fremdschlüssel in der Datenbank zeigt trotzdem auf `snapshot_party`: Wird
	 * die Freigabe zurückgenommen, gehen die Anwesenheitsereignisse mit, weil es
	 * die Momentaufnahme nicht mehr gibt, auf die sie sich beziehen.
	 */
	parteiId: Id;
	art: Anwesenheitsart;
	weg: Erfassungsweg;
	/** Zeitpunkt aus der Datenbank; der Kern liest keine Uhr. */
	zeitpunkt: Zeitpunkt;
	/** Wer erfasst hat — leer bei Selbstanmeldung. */
	erfasstDurch?: string | null;
	bemerkung?: string | null;
}

/** Zustand einer Partei zu einem Zeitpunkt. */
export type Anwesenheitszustand = 'nicht_erschienen' | 'wartet' | 'anwesend' | 'gegangen';

export interface Anwesenheitsstand {
	parteiId: Id;
	zustand: Anwesenheitszustand;
	/** Erstes Eintreffen. Bleibt stehen, auch wenn jemand später geht. */
	seit: Zeitpunkt | null;
	/** Letztes Verlassen, sofern erfasst. */
	gegangenSeit: Zeitpunkt | null;
	/**
	 * Warum zuletzt verlassen wurde (Befund Praxisdurchlauf 03.10.2026, Punkt 8).
	 *
	 * Die Begründung steht an der Anwesenheitsliste und am Verlaufseintrag. Sie
	 * gehört zum **letzten** Verlassen: Wer zurückkommt, trägt keine alte
	 * Begründung mehr.
	 */
	gegangenGrund: string | null;
	/** Wie zuletzt erfasst wurde. */
	weg: Erfassungsweg | null;
}

/**
 * Wertet die Ereignisfolge einer Partei zu einem Stichzeitpunkt aus.
 *
 * `bis` ist der springende Punkt: Beim Schliessen einer Abstimmung wird der
 * Stand *dieses Augenblicks* festgeschrieben (AD-16). Ohne den Parameter liesse
 * sich ein Ergebnis später nur noch auf dem heutigen Stand nachrechnen — und
 * das ist ein anderer.
 */
export function standVon(
	ereignisse: Anwesenheitsereignis[],
	bis?: Zeitpunkt
): Anwesenheitsstand | null {
	const bisHier = (bis ? ereignisse.filter((e) => e.zeitpunkt <= bis) : ereignisse).sort(
		(a, b) => a.zeitpunkt.localeCompare(b.zeitpunkt) || a.id.localeCompare(b.id)
	);
	if (bisHier.length === 0) return null;

	let zustand: Anwesenheitszustand = 'nicht_erschienen';
	let seit: Zeitpunkt | null = null;
	let gegangenSeit: Zeitpunkt | null = null;
	let gegangenGrund: string | null = null;
	let weg: Erfassungsweg | null = null;

	for (const e of bisHier) {
		weg = e.weg;
		switch (e.art) {
			case 'angemeldet':
				// Nur wer noch nicht anwesend ist, wartet. Wer schon bestätigt ist und
				// seinen Link erneut öffnet, fällt nicht in die Warteliste zurück.
				if (zustand !== 'anwesend') zustand = 'wartet';
				break;
			case 'abgelehnt':
				zustand = zustand === 'anwesend' ? 'anwesend' : 'nicht_erschienen';
				break;
			case 'eingetroffen':
				zustand = 'anwesend';
				seit ??= e.zeitpunkt;
				gegangenSeit = null;
				// Eine frühere Begründung gilt nicht mehr: Der Grund gehört zum
				// letzten Verlassen, und das ist mit dem Wiedereintreffen vorbei.
				gegangenGrund = null;
				break;
			case 'verlassen':
				zustand = 'gegangen';
				gegangenSeit = e.zeitpunkt;
				gegangenGrund = e.bemerkung?.trim() || null;
				break;
		}
	}

	return {
		parteiId: bisHier[0].parteiId,
		zustand,
		seit,
		gegangenSeit,
		gegangenGrund,
		weg
	};
}

/** Zählt eine Partei zum Stichzeitpunkt als anwesend? */
export function istAnwesend(ereignisse: Anwesenheitsereignis[], bis?: Zeitpunkt): boolean {
	return standVon(ereignisse, bis)?.zustand === 'anwesend';
}

export interface Anwesenheitsuebersicht {
	/**
	 * Je Partei ihr Stand **und ihre Stimmkraft**.
	 *
	 * Die Stimmkraft steht seit dem 20.08.2026 dabei: Am Eingang muss die
	 * Kontrollkarte nach dem Scannen sagen, wen man einlässt und mit welchem
	 * Gewicht — «wer er ist, WQ und ob man einlässt oder nicht». Sie zweimal aus
	 * der Momentaufnahme zu rechnen, hier und in der Karte, hiesse zwei
	 * Rechnungen für dieselbe Zahl.
	 */
	staende: (Anwesenheitsstand & {
		name: string;
		ausgeuebtDurch: string;
		einheiten: string[];
		kopfstimmen: number;
		wertquote: number;
	})[];
	anwesendeParteiIds: Id[];
	wartendeParteiIds: Id[];
	/** Kopfstimmen und Wertquoten der Anwesenden — die Bezugsgrösse. */
	kopfstimmenAnwesend: number;
	quotenAnwesend: number;
	kopfstimmenGesamt: number;
	gesamtquote: number;
	anzahlAnwesend: number;
	anzahlGesamt: number;
	/**
	 * **Stockwerkeigentümer** — Parteien, die mindestens eine Einheit halten.
	 *
	 * **Auf diesem Weg gleich `anzahlGesamt`** — und trotzdem eine eigene Zahl.
	 * `freigabe.ts` nimmt Parteien ohne Einheit gar nicht erst in die
	 * Momentaufnahme auf (`parteien.filter((p) => p.units.length > 0)`), hier
	 * kann also nichts anderes herauskommen.
	 *
	 * Der Filter steht bewusst trotzdem: Er sagt, **was** gezählt wird, statt
	 * sich auf eine Eigenschaft der Momentaufnahme zu verlassen, die vierzig
	 * Zeilen entfernt in einer anderen Datei entschieden wird. Eine erste Fassung
	 * dieses Absatzes behauptete am 26.08.2026 das Gegenteil — die SQL-Abfrage
	 * dort verbindet die Einheiten per `LEFT JOIN`, gefiltert wird erst danach in
	 * JavaScript. Wer nur die Abfrage liest, sieht den Filter nicht.
	 *
	 * Wer keine Einheit hält, ist kein Stockwerkeigentümer und zählt bei
	 * Art. 712p nicht mit — weder im Nenner noch bei «mindestens aber zwei».
	 *
	 * Und nicht dasselbe wie `kopfstimmenGesamt`: Das sind bei «je Einheit» die
	 * Einheiten. Genau diese Verwechslung erklärte bis zum 26.08.2026
	 * Versammlungen für beschlussfähig, in denen nur ein Mensch sass.
	 */
	eigentuemerGesamt: number;
	/** Davon anwesend oder vertreten. */
	eigentuemerAnwesend: number;
	/**
	 * Gehören alle Anteile einer einzigen Partei, die mehrere Personen sind
	 * (Ehepaar, Erbengemeinschaft; `isCommunity` der Momentaufnahme)?
	 * Produktentscheid 20.10.2026, `docs/entscheide/0016`: Gezählt wird wie bei
	 * einer Person, nur der Satz dazu ist ein anderer.
	 */
	einzigeParteiGemeinsam: boolean;
}

/**
 * Die Bezugsgrössen der Beschlussfähigkeit aus der Stimmkraftliste und den
 * anwesenden Parteien.
 *
 * **Wozu eine eigene Funktion** (Block 5, 01.10.2026): Die Beschlussfähigkeit
 * wird an zwei Stellen gerechnet, aus dem lebenden Anwesenheitsstand
 * (`uebersicht`) und beim Protokoll aus dem eingefrorenen `anwesende`-Feld
 * eines Durchgangs. Beide müssen dieselben Zahlen liefern;
 * eine zweite Summierung neben dieser wäre die Stelle, an der sie
 * auseinanderlaufen. Die Schwelle selbst rechnet `stelleBeschlussfaehigkeitFest`
 * (`beschlussfaehigkeit.ts`), nicht diese Funktion.
 *
 * Eine Einheit macht zum Stockwerkeigentümer, nicht eine Kopfstimme. Wem nur
 * ein Einstellplatz gehört, der ist Eigentümer, auch wo Nebenobjekte keine
 * Kopfstimme tragen.
 */
export function beteiligungDerAnwesenden(
	liste: Stimmkraftliste,
	anwesende: readonly Id[]
): Beteiligung & { einzigeParteiGemeinsam: boolean } {
	const dabei = new Set(anwesende);
	const eigentuemer = liste.eintraege.filter((e) => e.einheiten.length > 0);
	return {
		eigentuemerGesamt: eigentuemer.length,
		eigentuemerAnwesend: eigentuemer.filter((e) => dabei.has(e.partyId)).length,
		einzigeParteiGemeinsam: eigentuemer.length === 1 && eigentuemer[0].isCommunity,
		kopfstimmenGesamt: liste.summeKopfstimmen,
		kopfstimmenAnwesend: liste.eintraege
			.filter((e) => dabei.has(e.partyId))
			.reduce((s, e) => s + e.kopfstimmen, 0),
		// Der Nenner aus dem Reglement, nicht die Summe der erfassten Quoten:
		// «die Hälfte aller Anteile» meint 500 von 1000, auch wenn erst 998
		// erfasst sind.
		gesamtquote: liste.gesamtquote,
		quotenAnwesend: liste.eintraege
			.filter((e) => dabei.has(e.partyId))
			.reduce((s, e) => s + e.wertquote, 0)
	};
}

/**
 * Die Beteiligung ohne die Personen im Ausstand (L7, Migration 183): ohne die
 * Parteien im Ausstand und ohne die Parteien, die nur über einen Vertreter im
 * Ausstand vertreten sind. Darauf rechnet `stelleBeschlussfaehigkeitFest` mit
 * derselben Stufe wie die übrige Prüfung; beide Wege von L7, die Prüfung beim
 * Eröffnen und der Satz an die Leitung, lesen diese eine Funktion.
 *
 * **Nur der erklärte Ausstand** (Grund `ausstand`): Der Beklagte der
 * Ausschlussklage und die Betroffenen der Einsprache sind von Gesetzes wegen
 * vom Stimmrecht ausgeschlossen, für die Beschlussfähigkeit aber zählen sie
 * nach beiden Wahlen weiter als anwesend. Wer im Ausstand ist, gilt unter
 * «Zählt nicht mit» als abwesend, nicht als weg: Die Gesamtheiten bleiben,
 * wie sie sind, denn auch ein Abwesender bleibt Eigentümer.
 *
 * **Wer nur über einen Vertreter im Ausstand vertreten ist**, fehlt ebenfalls:
 * Seine Anwesenheit beruht auf der Vollmacht, und die ruht
 * (`ruhendeVertretungenBei`, BGE 134 III 481 E. 3.8). Erscheint er selbst,
 * zählt er weiter; die Regel dafür steht an einer Stelle, nicht zweimal.
 */
export function beteiligungOhneAusstand(
	liste: Stimmkraftliste,
	anwesende: readonly Id[],
	ausstand: readonly Id[],
	vertretungen: readonly Vertretung[]
): Beteiligung & { einzigeParteiGemeinsam: boolean } {
	const imAusstand = new Set(ausstand);
	const ruhend = ruhendeVertretungenBei(
		vertretungen,
		new Map<Id, Ausschlussgrund>([...imAusstand].map((id) => [id, 'ausstand'])),
		new Set(anwesende)
	);
	const ohne = anwesende.filter((id) => !imAusstand.has(id) && !ruhend.has(id));
	return beteiligungDerAnwesenden(liste, ohne);
}

/**
 * L7: Die Beschlussfähigkeit ohne die Personen im Ausstand und ob sie **an
 * ihnen hängt**, also mit ihnen gegeben ist und ohne sie nicht. Nur dann
 * stehen der Satz an die Leitung und die Zeile im Protokoll: Fehlt die
 * Beschlussfähigkeit schon mit ihnen, oder ist niemand im Ausstand, sagt der
 * Satz «ohne die Personen im Ausstand» etwas Falsches (Gegenprüfung Lauf 1,
 * 06.11.2026). Beide Rechnungen auf derselben Stufe und Regel.
 */
export function ausstandsbefund(
	stufe: Versammlungsstufe,
	liste: Stimmkraftliste,
	anwesende: readonly Id[],
	ausstand: readonly Id[],
	vertretungen: readonly Vertretung[],
	regel: Beschlussfaehigkeitsregel | null
): { ohne: Beschlussfaehigkeit; haengtAmAusstand: boolean } {
	const ohne = stelleBeschlussfaehigkeitFest(
		stufe,
		beteiligungOhneAusstand(liste, anwesende, ausstand, vertretungen),
		regel
	);
	if (ohne.beschlussfaehig) return { ohne, haengtAmAusstand: false };
	const mit = stelleBeschlussfaehigkeitFest(stufe, beteiligungDerAnwesenden(liste, anwesende), regel);
	return { ohne, haengtAmAusstand: mit.beschlussfaehig };
}

/**
 * Führt Momentaufnahme und Ereignisse zur Anwesenheitsübersicht zusammen.
 *
 * Die Kopfstimmen kommen aus derselben Funktion wie überall
 * (`stimmkraftliste`) — es gibt genau einen Zählweg. Eine eigene Summierung
 * hier wiche bei der Zählung je Einheit ab, und dann stünde auf der
 * Anwesenheitsliste eine andere Zahl als bei der Auszählung.
 */
export function uebersicht(
	momentaufnahme: Snapshot,
	ereignisse: Anwesenheitsereignis[],
	bis?: Zeitpunkt
): Anwesenheitsuebersicht {
	const liste: Stimmkraftliste = stimmkraftliste(momentaufnahme);

	const jePartei = new Map<Id, Anwesenheitsereignis[]>();
	for (const e of ereignisse) {
		const bisher = jePartei.get(e.parteiId) ?? [];
		bisher.push(e);
		jePartei.set(e.parteiId, bisher);
	}

	const staende: Anwesenheitsuebersicht['staende'] = [];
	const anwesendeParteiIds: Id[] = [];
	const wartendeParteiIds: Id[] = [];

	for (const eintrag of liste.eintraege) {
		const eigene = jePartei.get(eintrag.partyId) ?? [];
		const stand = standVon(eigene, bis) ?? {
			parteiId: eintrag.partyId,
			zustand: 'nicht_erschienen' as const,
			seit: null,
			gegangenSeit: null,
			gegangenGrund: null,
			weg: null
		};

		staende.push({
			...stand,
			name: eintrag.displayName,
			ausgeuebtDurch: eintrag.ausgeuebtDurch,
			einheiten: eintrag.einheiten.map((u) => u.label),
			kopfstimmen: eintrag.kopfstimmen,
			wertquote: eintrag.wertquote
		});

		if (stand.zustand === 'anwesend') {
			anwesendeParteiIds.push(stand.parteiId);
		} else if (stand.zustand === 'wartet') {
			wartendeParteiIds.push(stand.parteiId);
		}
	}

	return {
		staende,
		anwesendeParteiIds,
		wartendeParteiIds,
		...beteiligungDerAnwesenden(liste, anwesendeParteiIds),
		anzahlAnwesend: anwesendeParteiIds.length,
		anzahlGesamt: liste.eintraege.length
	};
}

// ── Übergänge ───────────────────────────────────────────────────────────────

export interface Erfassung {
	meetingId: Id;
	parteiId: Id;
	name: string;
	weg: Erfassungsweg;
	erfasstDurch?: string | null;
	bemerkung?: string;
}

/**
 * Die Wege, auf denen sich eine Partei **selbst** meldet — ohne die
 * Sitzungsleitung.
 *
 * Gebraucht an zwei Stellen: um zu vermerken, wer die Anwesenheit festgestellt
 * hat, und um beim Freigeben den wahren Weg zu behalten. Eine Liste statt zwei
 * Vergleichen, weil `authentik` beim ersten Mal vergessen ging.
 */
export const SELBSTWEGE: readonly Erfassungsweg[] = ['selbst', 'authentik'];

export type Eintreffen = Omit<Erfassung, 'weg'> & {
	/**
	 * Wie die Person hereinkam.
	 *
	 * **Weglassen heisst «nicht behauptet»** und nicht «Karte gescannt» — der
	 * Unterschied kostete bis zum 24.08.2026 die Wahrheit im Verlauf (siehe
	 * `bestaetigeEintreffen`).
	 */
	weg?: Erfassungsweg;
};

/**
 * Bestätigt das Eintreffen.
 *
 * Ein bereits Anwesender wird **nicht** ein zweites Mal erfasst: Der zweite
 * Scan am Eingang ist ein Versehen, kein Ereignis. Würde er eines erzeugen,
 * stünde in der Liste zweimal dasselbe Eintreffen, und die Frage «wann kam er»
 * hätte zwei Antworten.
 *
 * **Der Weg, den niemand behauptet hat** (Auftraggeber, 24.08.2026: «beheben»). Wer den
 * Knopf «Freigeben» am wartenden Eintrag drückt, sagt nichts darüber, wie die
 * Person hereinkam — er bestätigt eine Anmeldung, die sie selbst vom eigenen
 * Telefon aus gemacht hat. Die Vorgabe lautete trotzdem `gescannt`, und im
 * Verlauf stand danach «Karte gescannt» für jemanden, der nie eine Karte in der
 * Hand hatte. Ein falscher Satz im Nachweis, an allen drei Sichten gleich.
 *
 * Jetzt gilt: **Sagt der Aufrufer nichts, gilt der Weg der Anmeldung.** Steht
 * keine offene Anmeldung da, bleibt `von_hand` — dann hat die Sitzungsleitung
 * die Zeile aus eigenem Antrieb erfasst, und genau das heisst «von Hand».
 */
export function bestaetigeEintreffen(
	bisher: Anwesenheitsereignis[],
	e: Eintreffen
): Uebergang<{ neu: boolean; weg: Erfassungsweg }> {
	const stand = standVon(bisher);
	if (stand?.zustand === 'anwesend') {
		// Kein zweites Ereignis; der Weg bleibt der des ersten Eintreffens.
		return uebergang({ neu: false, weg: stand.weg ?? 'von_hand' });
	}

	/*
	 * `wartet` entsteht nur aus einem `angemeldet`-Ereignis, und `standVon`
	 * führt den Weg des jüngsten Ereignisses mit — bei einem Wartenden ist das
	 * dessen Anmeldung.
	 */
	const ausAnmeldung = stand?.zustand === 'wartet' ? stand.weg : null;
	const weg = e.weg ?? ausAnmeldung ?? 'von_hand';

	return uebergang(
		{ neu: true, weg },
		ereignis(
			EREIGNISARTEN.anwesenheitBestaetigt,
			{ art: 'meeting', id: e.meetingId },
			{
				partei: e.name,
				snapshotPartei: e.parteiId,
				weg,
				/*
				 * Ob die Sitzungsleitung die Anwesenheit festgestellt hat.
				 *
				 * Berichtigt am 24.08.2026: Hier stand `e.weg !== 'selbst'` — und
				 * damit `true` für jemanden, der sich über sein eigenes Konto
				 * angemeldet hat (`authentik`). Derselbe Fehler in klein wie beim Weg
				 * selbst: eine Aufzählung, bei der ein Fall vergessen ging.
				 */
				durchSitzungsleitung: !SELBSTWEGE.includes(weg),
				bemerkung: e.bemerkung ?? null
			}
		)
	);
}

/**
 * Meldet den Wunsch an, teilzunehmen.
 *
 * Kein Anwesenheitsereignis: Es zählt für nichts, bis die Sitzungsleitung
 * bestätigt. Wer schon anwesend ist, wandert nicht in die Warteliste zurück —
 * sonst verlöre ein bereits Bestätigter seine Stimmberechtigung, indem er
 * seinen eigenen Link noch einmal öffnet.
 */
export function meldeAn(
	bisher: Anwesenheitsereignis[],
	e: Erfassung
): Uebergang<{ zustand: Anwesenheitszustand }> {
	const stand = standVon(bisher);
	if (stand?.zustand === 'anwesend') {
		return uebergang({ zustand: 'anwesend' });
	}
	if (stand?.zustand === 'wartet') {
		// Schon in der Warteliste: kein zweiter Eintrag, sonst stünde dieselbe
		// Person mehrfach darin und die Sitzungsleitung gäbe sie zweimal frei.
		return uebergang({ zustand: 'wartet' });
	}

	return uebergang(
		{ zustand: 'wartet' },
		ereignis(
			EREIGNISARTEN.anwesenheitAngemeldet,
			{ art: 'meeting', id: e.meetingId },
			{ partei: e.name, snapshotPartei: e.parteiId, weg: e.weg }
		)
	);
}

export function lehneAb(
	bisher: Anwesenheitsereignis[],
	e: Erfassung,
	grund?: string
): Uebergang<{ abgelehnt: boolean }> {
	const stand = standVon(bisher);
	if (stand?.zustand !== 'wartet') {
		throw new FachlicherFehler(
			'nicht_wartend',
			`«${e.name}» steht nicht in der Warteliste.`,
			'parteiId'
		);
	}

	return uebergang(
		{ abgelehnt: true },
		ereignis(
			EREIGNISARTEN.anwesenheitAbgelehnt,
			{ art: 'meeting', id: e.meetingId },
			{ partei: e.name, snapshotPartei: e.parteiId, grund: grund?.trim() || null }
		)
	);
}

/**
 * Erfasst, dass jemand die Versammlung verlässt.
 *
 * Der bisherige Eintrag bleibt unverändert bestehen (AD-16). Das Verlassen
 * wirkt ab jetzt und nicht rückwirkend: Eine Abstimmung, die vorher geschlossen
 * wurde, behält ihre Bezugsgrösse.
 */
export function erfasseVerlassen(
	bisher: Anwesenheitsereignis[],
	e: Erfassung
): Uebergang<{ erfasst: boolean }> {
	const stand = standVon(bisher);
	if (stand?.zustand !== 'anwesend') {
		throw new FachlicherFehler(
			'nicht_anwesend',
			`«${e.name}» ist nicht als anwesend erfasst.`,
			'parteiId'
		);
	}

	return uebergang(
		{ erfasst: true },
		ereignis(
			EREIGNISARTEN.anwesenheitVerlassen,
			{ art: 'meeting', id: e.meetingId },
			{
				partei: e.name,
				snapshotPartei: e.parteiId,
				weg: e.weg,
				// **Die Begründung gehört in den Nachweis** (Befund 03.10.2026,
				// Punkt 8): Wer im Protokoll liest, dass jemand gegangen ist,
				// soll auch lesen, warum. Derselbe Schlüssel wie bei der
				// abgelehnten Anmeldung, wo der Grund schon mitgeht.
				grund: e.bemerkung?.trim() || null
			}
		)
	);
}

/** Beschriftungen für die Anzeige. */
export const ZUSTANDSNAMEN: Record<Anwesenheitszustand, string> = {
	nicht_erschienen: 'nicht erschienen',
	wartet: 'wartet auf Freigabe',
	anwesend: 'anwesend',
	gegangen: 'vorzeitig gegangen'
};

export const WEGNAMEN: Record<Erfassungsweg, string> = {
	gescannt: 'Karte gescannt',
	selbst: 'selbst angemeldet',
	von_hand: 'von Hand erfasst',
	liste: 'auf der Unterschriftenliste',
	vertretung: 'durch Vertretung',
	// Bewusst nicht «selbst angemeldet»: Der Unterschied zum Code auf der Karte
	// ist genau das, was hier festgehalten werden soll. Ein Konto mit Kennwort
	// ist eine andere Aussage über die Person als ein Zettel in ihrer Hand.
	authentik: 'über eigenes Konto'
};

/**
 * Ob die Stimmen dieser Partei von der Sitzungsleitung erfasst werden.
 *
 * Wer ohne Gerät teilnimmt, stimmt über die Sitzungsleitung ab — und das gehört
 * ins Ergebnis, weil es der Unterschied zwischen einer selbst abgegebenen und
 * einer erfassten Stimme ist.
 */
export function stimmtUeberSitzungsleitung(weg: Erfassungsweg | null): boolean {
	// `vertretung` gehört dazu: Die vertretene Partei hat kein Gerät im Saal —
	// ihre Stimme gibt der Vertreter ab, und erfasst wird sie über die
	// Sitzungsleitung. Ohne diesen Eintrag stünde sie in der Erfassungsliste
	// nicht da, und ihre Stimme fiele lautlos aus.
	return weg === 'von_hand' || weg === 'liste' || weg === 'vertretung';
}

/**
 * Nimmt aus der Warteliste, wer oben schon als Kontrollkarte steht.
 *
 * **Wozu** (11.09.2026, vom Auftraggeber im Eingangstest gefunden). Es gibt zwei Türen
 * in die Warteschlange und eine dritte an den Eingangstisch, und sie treffen
 * sich: Wer seinen QR selbst abscannt, steht angemeldet im Kasten «Am Eingang»;
 * legt er danach dieselbe Karte vor und der Eingang scannt sie, stand daneben
 * eine zweite Kachel mit einem zweiten Knopfpaar. Dieselbe Person, zwei
 * Entscheidungen, keine wusste von der anderen.
 *
 * **Nur auf der schmalen Scan-Ansicht fürs Telefon** (Vorgabe des Auftraggebers,
 * 11.09.2026). Dass eine gescannte Person im orangen Kasten auftaucht, ist
 * gewollt: Der Kasten ist die Liste derer, die sich angemeldet haben, und am
 * Laptop arbeitet man ihn ab. Am Telefon steht dieselbe Zeile zweimal
 * untereinander auf einem Bildschirm, den man mit dem Daumen abrollt, und beide
 * Male mit eigenem Knopfpaar — dort ist sie Lärm. Wer diese Funktion in der
 * Laptopsicht einsetzt, dreht eine Entscheidung um, die nicht seine ist.
 *
 * **Oben gewinnt, wo sie gilt**: Die Kontrollkarte ist die Antwort auf den Scan
 * von eben, sie steht dort, wo der Daumen ohnehin ist, und sie trägt die
 * Stimmkraft. Ihr Knopfpaar gibt dieselbe Anmeldung frei, die der Kasten
 * freigegeben hätte.
 */
export function ohneKontrollkarte<T extends { parteiId: string }>(
	wartende: T[],
	kontrolle: { parteiId: string } | null | undefined
): T[] {
	if (!kontrolle) return wartende;
	return wartende.filter((w) => w.parteiId !== kontrolle.parteiId);
}
