/**
 * Wann eine Versammlung aus Votum gelöscht werden darf (Produktentscheid 17.09.2026).
 *
 * **Die Ordnung dahinter.** Abschlusspaket und unterzeichnetes Protokoll werden
 * bei der Verwaltung aufbewahrt, sonst beim Stockwerkeigentümer, der den
 * Vorsitz geführt hat (ZGB Art. 712n Abs. 2 für das Protokoll, für das Paket
 * sinngemäss), nach herrschender Lehre solange das Stockwerkeigentum besteht
 * (Wermelinger, Rz. 141, 144 f. ad Art. 712n). Votum
 * braucht die Daten danach nicht mehr, aber erst, wenn niemand den Beschluss
 * mehr anfechten kann.
 *
 * **Die Frist.** Ein Monat ab Kenntnis (ZGB Art. 75 i.V.m. Art. 712m Abs. 2), für
 * Abwesende ab Zustellung des Protokolls (Wermelinger, Rz. 230, 230a ad
 * Art. 712m). Weil sie je Person anders beginnt, zählt die **letzte**
 * Zustellung. Sie endet am Tag des Folgemonats mit derselben Zahl, fehlt er, am
 * letzten Tag dieses Monats (OR Art. 77 Abs. 1 Ziff. 3).
 *
 * **Die Reserve.** Dreissig volle Tage nach dem Fristende. Eine Klage wird
 * innert Frist eingereicht, das Schlichtungsgesuch erreicht die Gemeinschaft
 * aber oft erst Wochen später.
 *
 * **Die Genehmigung.** Die Frist allein genügt nicht. Die Berichtigung des
 * Protokolls lässt sich bis zur nächsten Versammlung verlangen, theoretisch
 * über ein Jahr (Wermelinger, Rz. 136 ad Art. 712n); endgültig ist es erst,
 * wenn diese es genehmigt hat (Rz. 138). Bis dahin belegen die Stimmen in Votum
 * eine Berichtigung. Gelöscht wird deshalb erst nach der Genehmigung, und nur
 * eine versiegelte Versammlung (Produktentscheid 17.09.2026, Zweitprüfung Ä-40).
 * Wie weit die Genehmigung ist, bestimmt `protokoll_genehmigung` in Migration
 * 115.
 *
 * **Was die Regel nicht abdeckt.** Nichtige Beschlüsse kennen keine Frist
 * (Wermelinger, Rz. 214 ad Art. 712m). Das trägt die Stelle, die das Protokoll
 * aufbewahrt, nicht Votum; die Rückfrage beim Löschen sagt es.
 *
 * Dieselbe Rechnung steht in `migrations/113_loeschen_nach_frist.sql`. Die
 * Datenbank entscheidet, dieser Kern erklärt vorher, warum es noch nicht geht.
 *
 * Rein: hinein gehen Kalendertage, heraus kommen Kalendertage und Absagen. Der
 * heutige Tag wird übergeben (AD-1).
 */
import { FachlicherFehler } from './fehler';
import { datumLang, istKalendertag } from './datum';
import { tageSpaeter } from './versammlung';

/** Die Reserve nach dem Ende der Anfechtungsfrist, in vollen Tagen. */
export const RESERVE_TAGE = 30;

/**
 * Derselbe Tag im Folgemonat, fehlt er, der letzte Tag dieses Monats.
 *
 * Aus dem 31. Januar wird der 28. oder 29. Februar, nicht der 3. März. So
 * rechnen OR Art. 77 Abs. 1 Ziff. 3 und PostgreSQL mit `+ interval '1 month'`
 * gleichermassen; lägen die beiden auseinander, sagte die Oberfläche ein anderes
 * Datum als die Datenbank.
 */
export function monatSpaeter(datum: string): string {
	const [jahr, monat, tag] = datum.split('-').map(Number);
	const zielJahr = monat === 12 ? jahr + 1 : jahr;
	const zielMonat = monat === 12 ? 1 : monat + 1;
	// Tag 0 des übernächsten Monats ist der letzte Tag des Zielmonats.
	const letzter = new Date(Date.UTC(zielJahr, zielMonat, 0)).getUTCDate();
	const zwei = (z: number) => String(z).padStart(2, '0');
	return `${zielJahr}-${zwei(zielMonat)}-${zwei(Math.min(tag, letzter))}`;
}

/** Der letzte Tag, an dem noch angefochten werden kann. */
export function anfechtungsfristEnde(zugestelltAm: string): string {
	return monatSpaeter(zugestelltAm);
}

/**
 * Der erste Tag, an dem gelöscht werden darf.
 *
 * Fristende plus dreissig volle Tage Reserve, und dann der Tag danach.
 */
export function loeschbarAb(zugestelltAm: string): string {
	return tageSpaeter(anfechtungsfristEnde(zugestelltAm), RESERVE_TAGE + 1);
}

export interface Loeschangaben {
	/** Tag der letzten Zustellung des Protokolls, «JJJJ-MM-TT». */
	zugestelltAm: string;
	paketArchiviert: boolean;
	protokollArchiviert: boolean;
	keineAnfechtung: boolean;
}

/**
 * Wie weit die Genehmigung des Protokolls ist, wie `protokoll_genehmigung`
 * (Migration 115) es bestimmt.
 *
 * - `genehmigt`: Es gibt eine Fassung «von der Versammlung genehmigt», und eine
 *   spätere geschlossene Versammlung der Gemeinschaft fand vorher statt.
 * - `ohne_folgeversammlung`: Die Fassung ist da, eine solche Versammlung nicht.
 * - `fehlt`: Es gibt keine Fassung «von der Versammlung genehmigt».
 */
export type Genehmigungsstand = 'genehmigt' | 'ohne_folgeversammlung' | 'fehlt';

export interface Loeschlage {
	/** Heute, in Schweizer Zeit. */
	heute: string;
	/** Der Tag, an dem die späteste der Versammlungen geschlossen wurde. */
	spaetesterSchluss: string | null;
	/** Wie viele Pendenzen der Versammlungen noch offen sind. */
	offenePendenzen: number;
	/** Ob eine der Versammlungen noch nicht geschlossen ist. */
	nichtGeschlossen: boolean;
	/** Ob eine der Versammlungen kein Siegel hat. */
	nichtVersiegelt: boolean;
	/** Die Gemeinschaften, deren Protokoll noch nicht als genehmigt festgehalten ist. */
	ohneGenehmigung: string[];
	/** Die Gemeinschaften mit einer Fassung «genehmigt», aber ohne spätere Versammlung davor. */
	ohneFolgeversammlung: string[];
}

/**
 * Prüft, ob gelöscht werden darf, und sagt sonst, warum nicht und was fehlt.
 *
 * Die Reihenfolge ist die, in der jemand die Sache in die Hand nimmt: erst der
 * Zustand und das Siegel, dann die Pendenzen, dann die Genehmigung, dann das
 * Datum, dann die Frist, zuletzt die Bestätigungen. Wer an einer späteren Stelle abgewiesen wird, hat die
 * früheren schon hinter sich.
 */
export function pruefeLoeschung(a: Loeschangaben, l: Loeschlage): void {
	if (l.nichtGeschlossen) {
		throw new FachlicherFehler(
			'loeschen_noch_offen',
			'Gelöscht wird nur eine geschlossene Versammlung. Schliessen Sie sie zuerst.',
			'zustand'
		);
	}

	if (l.nichtVersiegelt) {
		throw new FachlicherFehler(
			'loeschen_nicht_versiegelt',
			'Gelöscht wird nur eine versiegelte Versammlung. Versiegeln Sie sie zuerst und legen Sie das Abschlusspaket ins Archiv.',
			'zustand'
		);
	}

	if (l.offenePendenzen > 0) {
		throw new FachlicherFehler(
			'loeschen_offene_pendenzen',
			l.offenePendenzen === 1
				? 'An dieser Versammlung hängt eine offene Pendenz. Sie gehört der Gemeinschaft und verschwindet nicht mit der Versammlung. Schliessen Sie sie ab oder setzen Sie sie auf «hinfällig».'
				: `An dieser Versammlung hängen ${l.offenePendenzen} offene Pendenzen. Sie gehören der Gemeinschaft und verschwinden nicht mit der Versammlung. Schliessen Sie sie ab oder setzen Sie sie auf «hinfällig».`,
			'pendenzen'
		);
	}

	if (l.ohneGenehmigung.length > 0) {
		throw new FachlicherFehler(
			'loeschen_nicht_genehmigt',
			`Das Protokoll ${vonWem(l.ohneGenehmigung)}ist noch nicht genehmigt. Berichtigen lässt es sich bis zur Genehmigung durch die nächste Versammlung, und bis dahin belegen die Stimmen in Votum eine Berichtigung. Hat die nächste Versammlung es genehmigt, halten Sie auf der Protokollseite die Fassung «von der Versammlung genehmigt» fest.`,
			'genehmigung'
		);
	}
	if (l.ohneFolgeversammlung.length > 0) {
		throw new FachlicherFehler(
			'loeschen_genehmigung_ohne_versammlung',
			`Das Protokoll ${vonWem(l.ohneFolgeversammlung)}ist als genehmigt festgehalten, aber in Votum fand vorher keine spätere Versammlung dieser Gemeinschaft statt, die es hätte genehmigen können. Ist die nächste Versammlung in Votum geschlossen, halten Sie die Fassung «von der Versammlung genehmigt» noch einmal fest.`,
			'genehmigung'
		);
	}

	const datum = (a.zugestelltAm ?? '').trim();
	if (!istKalendertag(datum)) {
		throw new FachlicherFehler(
			'loeschen_ohne_zustellung',
			'Geben Sie den Tag an, an dem das Protokoll zuletzt zugestellt wurde. Ab diesem Tag läuft die Anfechtungsfrist für die, die nicht an der Versammlung waren.',
			'zugestelltAm'
		);
	}
	if (datum > l.heute) {
		throw new FachlicherFehler(
			'loeschen_zustellung_zukunft',
			'Der Tag der Zustellung liegt in der Zukunft. Geben Sie den Tag an, an dem das Protokoll tatsächlich zugestellt wurde.',
			'zugestelltAm'
		);
	}
	if (l.spaetesterSchluss !== null && datum < l.spaetesterSchluss) {
		throw new FachlicherFehler(
			'loeschen_zustellung_vor_schluss',
			`Das Protokoll kann nicht vor dem Schluss der Versammlung am ${datumLang(l.spaetesterSchluss)} zugestellt worden sein.`,
			'zugestelltAm'
		);
	}

	const ab = loeschbarAb(datum);
	if (ab > l.heute) {
		throw new FachlicherFehler(
			'loeschen_frist_laeuft',
			`Die Anfechtungsfrist endet am ${datumLang(anfechtungsfristEnde(datum))}, danach laufen noch ${RESERVE_TAGE} Tage Reserve. Löschen lässt sich die Versammlung ab dem ${datumLang(ab)}.`,
			'zugestelltAm'
		);
	}

	if (!a.paketArchiviert) {
		throw new FachlicherFehler(
			'loeschen_paket_nicht_archiviert',
			'Bestätigen Sie, dass das Abschlusspaket heruntergeladen ist und im Archiv liegt: bei der Verwaltung, sonst beim Stockwerkeigentümer, der den Vorsitz geführt hat. Nach dem Löschen lässt es sich aus Votum nicht mehr holen.',
			'paketArchiviert'
		);
	}
	if (!a.protokollArchiviert) {
		throw new FachlicherFehler(
			'loeschen_protokoll_nicht_archiviert',
			'Bestätigen Sie, dass das unterzeichnete Protokoll im Archiv liegt: bei der Verwaltung, sonst beim Stockwerkeigentümer, der den Vorsitz geführt hat. Es ist aufzubewahren, solange das Stockwerkeigentum besteht.',
			'protokollArchiviert'
		);
	}
	if (!a.keineAnfechtung) {
		throw new FachlicherFehler(
			'loeschen_anfechtung',
			'Bestätigen Sie, dass weder eine Anfechtungsklage noch ein Schlichtungsgesuch eingegangen ist. Ist eines hängig, bleibt die Versammlung stehen, bis es erledigt ist.',
			'keineAnfechtung'
		);
	}
}

/** «von X » oder «von X und Y », mit Leerschlag am Schluss, damit der Satz ohne Namen auch trägt. */
function vonWem(gemeinschaften: string[]): string {
	if (gemeinschaften.length === 0) return '';
	const namen =
		gemeinschaften.length === 1
			? gemeinschaften[0]
			: `${gemeinschaften.slice(0, -1).join(', ')} und ${gemeinschaften.at(-1)}`;
	return `von ${namen} `;
}
