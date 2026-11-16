/**
 * Gültigkeitszeiträume der Stammdaten (Story 1.8, FR-5, AD-3, AD-16).
 *
 * Der Zweck ist einer: Eine vergangene Versammlung muss den damaligen Stand
 * zeigen. Wird eine Wohnung im März verkauft, hat die Februar-Versammlung
 * trotzdem mit dem Februar-Eigentümer stattgefunden, und ihr Protokoll muss ihn
 * nennen — auch wenn es im April gelesen wird.
 *
 * Alle Zeiträume sind **links geschlossen, rechts offen**: Der Tag des Wechsels
 * gehört dem neuen Eigentümer. Sonst gäbe es einen Tag mit zwei Eigentümern oder
 * einen ohne — und beides wäre in einer Abstimmung an genau diesem Tag falsch.
 */
import { FachlicherFehler } from './gemeinschaft';
import type { Id } from './types';
import { istKalendertag } from './datum';

export interface Zeitraum {
	validFrom: string;
	validTo: string | null;
}

export interface Zuordnung extends Zeitraum {
	id: Id;
	partyId: Id;
}

/** Gilt der Zeitraum an diesem Tag? Links geschlossen, rechts offen. */
export function giltAm(z: Zeitraum, tag: string): boolean {
	if (z.validFrom > tag) return false;
	if (z.validTo !== null && z.validTo <= tag) return false;
	return true;
}

export function ueberschneidet(a: Zeitraum, b: Zeitraum): boolean {
	const aEnde = a.validTo ?? '9999-12-31';
	const bEnde = b.validTo ?? '9999-12-31';
	return a.validFrom < bEnde && b.validFrom < aEnde;
}

/**
 * Ergebnis einer geplanten Änderung an der Eigentumsgeschichte einer Einheit.
 *
 * Getrennt vom Ausführen, damit sich vorher zeigen lässt, was geschieht — eine
 * rückwirkende Korrektur, die stillschweigend eine bestehende Zuordnung kappt,
 * wäre schwer zu durchschauen.
 */
export interface Aenderungsplan {
	/** Zuordnungen, deren Ende auf den Stichtag gesetzt wird. */
	zuBeenden: { id: Id; partyId: Id; neuesEnde: string }[];
	/** Zuordnungen, die vollständig verdrängt werden. */
	zuEntfernen: { id: Id; partyId: Id }[];
	/** Der neue Zeitraum. */
	neu: Zeitraum & { partyId: Id };
	/** Lücken, die durch die Änderung entstünden. */
	luecken: Zeitraum[];
}

/**
 * Plant die Zuordnung einer Einheit an eine Partei ab einem Stichtag.
 *
 * Die drei Fälle, die auftreten können:
 *
 *   - **Anschluss** an eine laufende Zuordnung: Sie endet am Stichtag.
 *   - **Rückwirkende Korrektur** mitten in einer Zuordnung: Sie wird gekappt.
 *   - **Rückwirkende Korrektur über eine ganze Zuordnung hinweg**: Sie
 *     verschwindet. Das ist der Fall, der ohne Vorschau am ehesten überrascht.
 */
export function planeZuordnung(
	bestehende: Zuordnung[],
	neuePartei: Id,
	abStichtag: string,
	bisStichtag: string | null = null
): Aenderungsplan {
	if (!istKalendertag(abStichtag)) {
		throw new FachlicherFehler('stichtag_ungueltig', 'Der Stichtag ist kein gültiges Datum.', 'ab');
	}
	if (bisStichtag !== null && bisStichtag <= abStichtag) {
		throw new FachlicherFehler('zeitraum_rueckwaerts', 'Das Ende liegt vor dem Beginn.', 'bis');
	}

	const neu = { partyId: neuePartei, validFrom: abStichtag, validTo: bisStichtag };
	const zuBeenden: Aenderungsplan['zuBeenden'] = [];
	const zuEntfernen: Aenderungsplan['zuEntfernen'] = [];

	for (const b of bestehende) {
		if (!ueberschneidet(b, neu)) continue;

		if (b.validFrom < abStichtag) {
			// Sie beginnt früher: kappen statt entfernen. Der frühere Eigentümer
			// bleibt für vergangene Versammlungen sichtbar.
			zuBeenden.push({ id: b.id, partyId: b.partyId, neuesEnde: abStichtag });
		} else {
			// Sie beginnt am Stichtag oder danach und wird vollständig verdrängt.
			zuEntfernen.push({ id: b.id, partyId: b.partyId });
		}
	}

	return { zuBeenden, zuEntfernen, neu, luecken: findeLuecken([...bestehende], neu, zuEntfernen) };
}

/**
 * Sucht Zeitspannen ohne gültige Zuordnung, die durch eine Änderung entstünden.
 *
 * Eine Einheit ohne Eigentümer gibt es im Grundbuch nicht. Entstünde eine Lücke,
 * fehlte die Einheit in jeder Abstimmung dieses Zeitraums — und die Summe der
 * Wertquoten ginge dort nicht auf, ohne dass ersichtlich wäre, warum.
 */
export function findeLuecken(
	bestehende: Zuordnung[],
	neu: Zeitraum,
	entfernt: { id: Id }[] = []
): Zeitraum[] {
	const entferntIds = new Set(entfernt.map((e) => e.id));

	const spannen: Zeitraum[] = [
		...bestehende
			.filter((b) => !entferntIds.has(b.id))
			.map((b) => ({
				validFrom: b.validFrom,
				// Wer gekappt wird, endet am Beginn des Neuen.
				validTo: b.validFrom < neu.validFrom && ueberschneidet(b, neu) ? neu.validFrom : b.validTo
			})),
		{ validFrom: neu.validFrom, validTo: neu.validTo }
	].sort((a, b) => a.validFrom.localeCompare(b.validFrom));

	if (spannen.length === 0) return [];

	const luecken: Zeitraum[] = [];
	let bisher = spannen[0].validTo;

	for (let i = 1; i < spannen.length; i++) {
		if (bisher === null) return luecken; // Ab hier gilt etwas auf Weiteres.
		if (spannen[i].validFrom > bisher) {
			luecken.push({ validFrom: bisher, validTo: spannen[i].validFrom });
		}
		const ende = spannen[i].validTo;
		bisher = ende === null || bisher === null ? null : ende > bisher ? ende : bisher;
	}

	return luecken;
}

/**
 * Prüft, ob eine Änderung einen bereits eingefrorenen Versammlungsstand berührt.
 *
 * Sie darf es nicht: Eine Momentaufnahme ist bei der Freigabe entstanden und
 * bleibt, was sie war (AD-3, AD-16). Eine rückwirkende Korrektur der Stammdaten
 * ist zulässig und ändert am Ergebnis einer vergangenen Abstimmung nichts —
 * gerade deshalb muss sichtbar sein, dass beides nebeneinander besteht.
 */
export interface BeruehrteVersammlung {
	meetingId: Id;
	bezeichnung: string;
	datum: string;
}

export function beruehrteVersammlungen(
	versammlungen: BeruehrteVersammlung[],
	abStichtag: string
): BeruehrteVersammlung[] {
	return versammlungen.filter((v) => v.datum >= abStichtag);
}
