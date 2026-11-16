/**
 * Der Kartensatz einer Versammlung — einmal erzeugt, mehrfach verpackt.
 *
 * Es gibt zwei Ausgabewege für dieselbe Sache: ein Sammel-PDF zum Ausdrucken
 * und ein Archiv mit je einer Datei für die Dokumentenablage. Beide brauchen
 * denselben Kranz an Angaben — Rahmen, Kontrollangaben, Codes. Lägen die
 * Rechnungen doppelt vor, stünde eines Tages auf der einen Karte eine andere
 * Stimmkraft als auf der anderen, und niemand wüsste, welche gilt.
 *
 * **Achtung, das hier erzeugt Zugänge.** Der Aufruf ist nicht folgenlos: Jeder
 * Code entsteht genau einmal (NFR-5) und macht einen bestehenden ungültig, wenn
 * die Partei ausdrücklich gewählt wurde.
 */
import { alsBetreiber } from './db';
import { holeGemeinschaft } from './gemeinschaften';
import { holeMomentaufnahme } from './freigabe';
import { holeVersammlung } from './versammlungen';
import { erzeugeZugaenge, type ErzeugterZugang } from './zugaenge';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { zugangsLink } from '$lib/domain/zugang';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Karteninhalt, Kartenrahmen } from './pdf/zugangskarte';
import type { Id } from '$lib/domain/types';

export interface Kartensatz {
	rahmen: Kartenrahmen;
	inhalte: Karteninhalt[];
	/** Die Kennung der Partei je Karte, in derselben Reihenfolge — für die Versandliste. */
	parteiIds: Id[];
	versammlung: Awaited<ReturnType<typeof holeVersammlung>>;
	gemeinschaft: NonNullable<Awaited<ReturnType<typeof holeGemeinschaft>>>;
}

export interface Handelnder {
	operatorId: string;
	userId: string;
	label: string;
}

/**
 * Erzeugt Zugänge und stellt alles zusammen, was auf die Karten gehört.
 *
 * `basis` kommt aus `herkunft()` (`$lib/server/herkunft`): die feste Angabe
 * `ORIGIN`, wenn es eine gibt, sonst die aufrufende Adresse. Der Rückfall ist
 * für den lokalen Betrieb im Versammlungsraum da — dort ist die aufrufende
 * Adresse die des Notebooks im WLAN und nicht die des Servers, und eine fest
 * hinterlegte führte die Eigentümer ins Leere.
 *
 * **Auf einem erreichbaren Server gehört `ORIGIN` gesetzt** (Audit B-15): Was
 * hier hereinkommt, wird **gedruckt**, und eine gedruckte Karte lässt sich nicht
 * zurückrufen.
 */
export async function erzeugeKartensatz(
	handelnder: Handelnder,
	meetingId: Id,
	basis: string,
	gewaehlt?: Id[]
): Promise<Kartensatz> {
	const versammlung = await holeVersammlung(handelnder.operatorId, meetingId);
	if (!versammlung) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');

	const gemeinschaft = await holeGemeinschaft(handelnder.operatorId, versammlung.stwegId);
	if (!gemeinschaft) {
		throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'id');
	}

	const erzeugte = await erzeugeZugaenge(handelnder, meetingId, gewaehlt?.length ? gewaehlt : undefined);
	if (erzeugte.length === 0) {
		throw new FachlicherFehler(
			'nichts_erzeugt',
			'Es wurde kein Zugang erzeugt: Alle gewählten Parteien haben bereits einen gültigen. ' +
				'Um einen zu ersetzen, wählen Sie ihn ausdrücklich aus.',
			'partei'
		);
	}

	// Die Kontrollangaben kommen aus der Momentaufnahme und werden mit derselben
	// Funktion gezählt wie im Saal. Eine eigene Rechnung hier könnte davon
	// abweichen — und dann stünde auf der Karte eine andere Stimmkraft als bei
	// der Auszählung.
	const momentaufnahme = await holeMomentaufnahme(handelnder.operatorId, meetingId);
	if (!momentaufnahme) {
		throw new FachlicherFehler(
			'ohne_momentaufnahme',
			'Für diese Versammlung steht noch nicht fest, wer stimmberechtigt ist.',
			'zustand'
		);
	}
	const stimmkraft = stimmkraftliste(momentaufnahme);

	const rahmen: Kartenrahmen = {
		gemeinschaftName: gemeinschaft.name,
		gemeinschaftAdresse: [
			gemeinschaft.strasse,
			[gemeinschaft.plz, gemeinschaft.ort].filter(Boolean).join(' ')
		]
			.filter((t) => t && t.trim())
			.join(', '),
		datum: versammlung.datum,
		uhrzeit: versammlung.uhrzeit,
		ort: versammlung.ort,
		gesamtquote: momentaufnahme.totalQuota,
		zaehlweise: momentaufnahme.headCountMode,
		betriebsart: versammlung.betriebsart
	};

	const geschwister = await geschwisterhaeuser(handelnder.operatorId, meetingId);

	const inhalte: Karteninhalt[] = erzeugte.map((e: ErzeugterZugang) => {
		const eintrag = stimmkraft.eintraege.find((x) => x.partyId === e.partyId);
		return {
			name: e.name,
			ausgeuebtDurch: e.ausgeuebtDurch,
			/*
			 * **Aus dem festgehaltenen Stand, nicht aus den Namen geraten**
			 * (27.08.2026). Die Karte druckt bei gemeinschaftlichem Eigentum einen
			 * eigenen Satz; woran sie den Fall erkennt, muss dieselbe Quelle sein,
			 * aus der auch gezählt wird. Fehlt der Eintrag, ist es keine Karte
			 * dieser Versammlung — dann gilt der ungefährliche Fall.
			 */
			istGemeinschaftlich: eintrag?.isCommunity ?? false,
			einheiten:
				eintrag?.einheiten.map((u) => ({
					label: u.label,
					quote: u.quota,
					traegtKopfstimme: u.countsAsHead
				})) ?? [],
			kopfstimmen: eintrag?.kopfstimmen ?? 0,
			wertquote: eintrag?.wertquote ?? 0,
			code: e.code,
			link: zugangsLink(basis, e.code),
			auchIn: geschwister.get(e.partyId) ?? []
		};
	});

	return {
		rahmen,
		inhalte,
		parteiIds: erzeugte.map((e) => e.partyId),
		versammlung,
		gemeinschaft
	};
}

/**
 * Die E-Mail-Adressen der Parteien, aus den **lebenden** Stammdaten.
 *
 * Anders als alles andere auf der Karte: Die Stimmkraft ist die vom Tag der
 * Freigabe (AD-3), die Adresse ist die von heute. Wer im Juli umgezogen ist,
 * soll den Brief nicht an die alte Anschrift bekommen, nur weil die
 * Momentaufnahme älter ist. Gerechnet wird mit dieser Angabe nichts.
 */
export async function holeVersandanschriften(
	operatorId: Id,
	stwegId: Id,
	parteiIds: Id[]
): Promise<Map<Id, string>> {
	if (parteiIds.length === 0) return new Map();
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ id: string; email: string | null }[]>`
			SELECT id, email FROM party
			WHERE stweg_id = ${stwegId} AND id = ANY(${parteiIds})
		`;
		return new Map(zeilen.filter((z) => z.email).map((z) => [z.id, z.email as string]));
	});
}

/**
 * In welchen anderen Gemeinschaften desselben Abends dieselbe Person ebenfalls
 * stimmberechtigt ist — je Partei dieser Versammlung.
 *
 * **Der Anlass** (Prüflauf II, B-06): Katharina Zbinden hält A 1.1 und B 1.1.
 * Sie bekommt zwei Zugangskarten, je eine je Haus, jede mit eigenem Code — das
 * ist richtig, sie ist in jeder Gemeinschaft eine eigene Partei mit eigener
 * Stimmkraft. Nur sagte keine der beiden Karten, dass es eine zweite gibt. Auf
 * beiden stand «Diese Karte ist persönlich und gilt nur für diese Versammlung»,
 * was eher nahelegt, die zweite sei ein Versehen.
 *
 * **Verknüpft wird über die Person, nicht über den Namen.** Zwei Menschen
 * dürfen gleich heissen; wer nach Namen zusammenführte, schriebe irgendwann
 * jemandem, er habe anderswo eine Karte, die er nie bekommen hat.
 *
 * Gehört die Versammlung zu keinem Abend, gibt es nichts zu verbinden.
 */
export async function geschwisterhaeuser(
	operatorId: Id,
	meetingId: Id
): Promise<Map<string, string[]>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ party_id: string; stweg_name: string }[]>`
			SELECT p.id AS party_id, andere.name AS stweg_name
			  FROM meeting m
			  JOIN meeting geschwister
			    ON geschwister.meeting_day_id = m.meeting_day_id
			   AND geschwister.id <> m.id
			  JOIN stweg andere ON andere.id = geschwister.stweg_id
			  JOIN party p ON p.stweg_id = m.stweg_id AND p.person_id IS NOT NULL
			  JOIN party dort
			    ON dort.stweg_id = geschwister.stweg_id
			   AND dort.person_id = p.person_id
			 WHERE m.id = ${meetingId} AND m.meeting_day_id IS NOT NULL
			 ORDER BY andere.name
		`;
		const aus = new Map<string, string[]>();
		for (const z of zeilen) {
			const liste = aus.get(z.party_id) ?? [];
			if (!liste.includes(z.stweg_name)) liste.push(z.stweg_name);
			aus.set(z.party_id, liste);
		}
		return aus;
	});
}
