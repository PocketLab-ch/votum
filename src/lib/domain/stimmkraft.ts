/**
 * Stimmkraft aus der Momentaufnahme (Story 2.5, FR-22, AD-1, AD-2, AD-3).
 *
 * Die Rechnung selbst steht seit Story 1.6 in `eigentuemer.ts`. Was hier
 * dazukommt, ist die **Eingabe**: Ab jetzt rechnet die Auszählung auf der
 * eingefrorenen Momentaufnahme und nicht auf lebenden Stammdaten (AD-3). Ein
 * Eigentümerwechsel im März verändert damit das Ergebnis der Februar-Versammlung
 * nicht mehr.
 *
 * Bewusst genau **ein** Zählweg: Die Ansicht der Stammdaten baut sich eine
 * Momentaufnahme zum Stichtag und ruft dieselbe Funktion auf wie später die
 * Versammlung. Zwei Wege, die dasselbe zählen, laufen früher oder später
 * auseinander — und dann steht Zahl gegen Zahl ohne Möglichkeit zu sagen, welche
 * gilt.
 */
import { stimmkraft, type Stimmkraft, type StimmkraftEinheit } from './eigentuemer';
import type { Id, Snapshot, SnapshotParty } from './types';

export interface StimmkraftEintrag extends Stimmkraft {
	displayName: string;
	isCommunity: boolean;
	representativeName: string | null;
	einheiten: SnapshotParty['units'];
	/** Wer die eine Stimme tatsächlich ausübt — die Person oder ihr Vertreter. */
	ausgeuebtDurch: string;
}

export interface Stimmkraftliste {
	eintraege: StimmkraftEintrag[];
	summeKopfstimmen: number;
	summeWertquote: number;
	zaehlweise: Snapshot['headCountMode'];
	nebenobjekteZaehlen: boolean;
	/** Gesamtquote der Gemeinschaft — Bezugsgrösse des qualifizierten Mehrs. */
	gesamtquote: number;
}

/**
 * Stimmkraft aller Parteien einer Momentaufnahme.
 *
 * Reine Funktion ohne Datenbank, Uhr und Zufall (AD-1): Sie bekommt die
 * Momentaufnahme und gibt Zahlen zurück. Genau deshalb lässt sich mit einer
 * Wertetabelle belegen, dass sie richtig zählt — und genau das ist im Streitfall
 * vorzulegen.
 */
export function stimmkraftliste(snapshot: Snapshot): Stimmkraftliste {
	const eintraege = snapshot.parties.map((p): StimmkraftEintrag => {
		const einheiten: StimmkraftEinheit[] = p.units.map((u) => ({
			unitId: u.unitId,
			kind: u.kind,
			countsAsHead: u.countsAsHead,
			stammquote: u.quota
		}));
		const k = stimmkraft(
			p.partyId,
			einheiten,
			snapshot.headCountMode,
			snapshot.parkingCountsAsHead
		);
		return {
			...k,
			displayName: p.displayName,
			isCommunity: p.isCommunity,
			representativeName: p.representativeName,
			einheiten: p.units,
			ausgeuebtDurch: ausuebung(p)
		};
	});

	return {
		eintraege,
		summeKopfstimmen: eintraege.reduce((s, e) => s + e.kopfstimmen, 0),
		summeWertquote: eintraege.reduce((s, e) => s + e.wertquote, 0),
		zaehlweise: snapshot.headCountMode,
		nebenobjekteZaehlen: snapshot.parkingCountsAsHead,
		gesamtquote: snapshot.totalQuota
	};
}

/**
 * Wer die Stimme ausübt.
 *
 * Bei gemeinschaftlichem Eigentum eine Stimme, ausgeübt durch den bezeichneten
 * Vertreter (ZGB Art. 712o Abs. 1). Im Saal ist das die Angabe, die eine
 * Bestreitung sofort klärt: nicht «die Erbengemeinschaft Kunz», sondern «Ruth
 * Kunz für die Erbengemeinschaft Kunz».
 */
export function ausuebung(p: Pick<SnapshotParty, 'displayName' | 'representativeName'>): string {
	return p.representativeName ? `${p.representativeName} für ${p.displayName}` : p.displayName;
}

/** Eine einzelne Partei aus der Liste holen — für die Klärung einer Bestreitung. */
export function stimmkraftVon(liste: Stimmkraftliste, partyId: Id): StimmkraftEintrag | undefined {
	return liste.eintraege.find((e) => e.partyId === partyId);
}

/**
 * Erklärt in einem Satz, wie die Kopfstimmen dieser Partei zustande kommen.
 *
 * Damit die Sitzungsleitung die Bestreitung im Saal nicht mit «das System sagt
 * es so» beantworten muss.
 */
export function kopfstimmenErklaerung(
	eintrag: StimmkraftEintrag,
	liste: Stimmkraftliste
): string {
	if (eintrag.einheiten.length === 0) {
		return 'Ohne zugeordnete Einheit besteht kein Stimmrecht.';
	}

	if (liste.zaehlweise === 'per_owner') {
		const zahl = eintrag.einheiten.length;
		return (
			`Eine Kopfstimme, ${zahl === 1 ? 'für die eine Einheit' : `obwohl ${zahl} Einheiten zugeordnet sind`}: ` +
			`Diese Gemeinschaft zählt je Eigentümer (ZGB Art. 712o Abs. 1).`
		);
	}

	const ohneKopf = eintrag.einheiten.filter((u) => !u.countsAsHead);
	const nebenobjekte = eintrag.einheiten.filter(
		(u) => u.kind === 'parking' && u.countsAsHead && !liste.nebenobjekteZaehlen
	);

	const teile = [
		`${eintrag.kopfstimmen} von ${eintrag.einheiten.length} Einheiten tragen eine Kopfstimme: ` +
			`Diese Gemeinschaft zählt je Einheit.`
	];
	if (ohneKopf.length > 0) {
		teile.push(
			`Ohne Kopfstimme gekennzeichnet: ${ohneKopf.map((u) => u.label).join(', ')}.`
		);
	}
	if (nebenobjekte.length > 0) {
		teile.push(
			`Als Nebenobjekt ohne Kopfstimme nach der Einstellung der Gemeinschaft: ` +
				`${nebenobjekte.map((u) => u.label).join(', ')}.`
		);
	}
	return teile.join(' ');
}
