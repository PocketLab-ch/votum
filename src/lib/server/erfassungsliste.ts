/**
 * Die Erfassungsliste eines offenen Durchgangs — wer stimmen kann, mit welcher
 * Stimmkraft, und was bisher eingetragen ist.
 *
 * **Warum als eigene Funktion** (Auftraggeber, 24.08.2026): «Musst du zwei Ansichten
 * für die Sektion ‹An der Versammlung› bauen? Kann man die nicht generisch
 * nutzen?» Die Rechnung stand ausgeschrieben in der Leitung einer einzelnen
 * Versammlung; am Abend fehlte sie deshalb ganz — «Mir fehlt, dass der
 * Versammlungsleiter für die anderen abstimmen darf».
 *
 * Sie wird in **beiden** Betriebsarten gebraucht: In der einfachen ist sie die
 * Erfassungstabelle (der Saal stimmt von Hand), in der geführten die Ausnahme
 * für das ausgefallene Telefon. Ohne diesen Weg fiele eine solche Stimme unter
 * «ohne Abgabe» — und das ist keine Enthaltung, sondern eine verlorene Stimme:
 * Sie bleibt in der Bezugsgrösse und wirkt wie ein Nein.
 */
import { holeUebersicht } from './anwesenheit';
import { holeMomentaufnahme } from './freigabe';
import { holeOffenen, holeStimmen, holeStimmsperren, sperreInWorten } from './abstimmung';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { kopfstimmenAn } from '$lib/domain/auszaehlung';
import type { Id, VoteChoice } from '$lib/domain/types';

export interface Erfassungszeile {
	parteiId: string;
	name: string;
	einheiten: string[];
	kopfstimmen: number;
	wertquote: number;
	/**
	 * Was **die Sitzungsleitung** eingetragen hat. Null heisst: nichts von ihr.
	 *
	 * **Was vom Gerät der Partei kam, verlässt den Server nicht** (FR-40): Sonst
	 * stünde in der Tabelle der Zwischenstand, und der Zeitpunkt des Schliessens
	 * liesse sich danach wählen.
	 */
	gewaehlt: VoteChoice | null;
	/** Ob diese Stimme vom Gerät der Partei kam und nicht von der Leitung. */
	selbst: boolean;
	/**
	 * Ob diese Partei an dieser Versammlung auf Papier abstimmt (Migration 107).
	 *
	 * **Sie steht in der Liste, nicht daneben.** Genau ihre Stimme muss die
	 * Sitzungsleitung vom Zettel übertragen; sie herauszufiltern hiesse, den
	 * Vermerk gegen seinen Zweck zu wenden. Die Marke ist eine Auskunft für die
	 * Maske, keine Schranke.
	 */
	aufPapier: boolean;
}

export interface Erfassungsstand {
	/** Leer, solange keine Abstimmung offen ist. */
	zeilen: Erfassungszeile[] | null;
	/**
	 * Wer nicht mitstimmt und warum: Ausstand, ruhende Vertretung (ZGB Art. 68).
	 *
	 * **Der Papiervermerk gehört ausdrücklich NICHT hierher**, obwohl er
	 * dieselbe Sperre trägt. Er sperrt das Gerät der Partei, nicht die
	 * Sitzungsleitung, und sein Satz («Am Telefon ist hier nichts zu tun») wäre
	 * auf diesem Bildschirm an die Falschen gerichtet.
	 */
	sperren: string[];
}

export async function holeErfassungsstand(
	operatorId: Id,
	meetingId: Id
): Promise<Erfassungsstand> {
	const offen = await holeOffenen(operatorId, meetingId);
	if (!offen) return { zeilen: null, sperren: [] };

	/*
	 * **Wer bei diesem Traktandum nicht mitstimmt** — der Ausgetretene selbst
	 * (seit 25.09.2026 auch der unter `alle_ausser_betroffene` Betroffene, seit
	 * 29.09.2026 der Beklagte unter jeder Kopfbasis, ab Fassung 2026-10-20 an
	 * der Einsprache der Eigentümer, der verkauft, vermietet oder belastet) und
	 * die Partei, die nur über einen Ausgetretenen, den Beklagten der
	 * Ausschlussklage oder diesen Eigentümer vertreten ist (seit 27.09.2026
	 * nicht mehr über jemanden, den nur eine Reglementsklausel ausnimmt). An der
	 * Einsprache übt er auch keine Vollmachten aus (BGE 134 III 481 E. 3.8
	 * (Regeste), übertragen auf den Ausschluss nach Art. 712c Abs. 2;
	 * Fachprüfung F4a, S5); Votum zählt sie nicht, und der Satz dazu sagt das
	 * (`sperreInWorten`). Diese Parteien
	 * stehen nicht in der Erfassung: Die Absage käme sonst erst beim Abschicken, und weil die
	 * Erfassung alle Stimmen in EINEM Vorgang entgegennimmt, wären die richtigen
	 * gleich mit verloren.
	 *
	 * **Der Papiervermerk wird hier abgetrennt** (Migration 107, aus dem Review).
	 * `holeStimmsperren` liefert ihn mit, weil er am Gerät der Partei wirkt. Auf
	 * diesem Bildschirm wäre er das Gegenteil dessen, wofür es ihn gibt: Die
	 * Papierpartei ist genau die, deren Stimme die Sitzungsleitung eintragen
	 * muss. Sie herauszufiltern hätte den Vermerk unbenutzbar gemacht, und zwar
	 * lautlos — dieselbe Klasse wie auf dem Schreibweg eine Schicht tiefer.
	 */
	const alleSperren = await holeStimmsperren(operatorId, meetingId, offen.traktandumId);
	const sperren = alleSperren.filter((s) => s.art !== 'papier');
	const aufPapier = new Set(
		alleSperren.filter((s) => s.art === 'papier').map((s) => s.parteiId)
	);

	const [momentaufnahme, uebersicht, bisher] = await Promise.all([
		holeMomentaufnahme(operatorId, meetingId),
		holeUebersicht(operatorId, meetingId),
		holeStimmen(operatorId, offen.id)
	]);
	if (!momentaufnahme || !uebersicht) {
		return { zeilen: null, sperren: sperren.map(sperreInWorten) };
	}

	const kraft = stimmkraftliste(momentaufnahme);
	const letzte = new Map<string, VoteChoice>();
	const vonHandErfasst = new Map<string, boolean>();
	for (const s of bisher) {
		letzte.set(s.partyId, s.choice);
		vonHandErfasst.set(s.partyId, s.recordedByChair);
	}
	const gesperrt = new Set(sperren.map((s) => s.parteiId));

	const zeilen = uebersicht.staende
		.filter((s: { zustand: string; parteiId: string }) => s.zustand === 'anwesend' && !gesperrt.has(s.parteiId))
		.map((s) => {
			const k = kraft.eintraege.find((x) => x.partyId === s.parteiId);
			return {
				parteiId: s.parteiId,
				name: s.name,
				einheiten: s.einheiten,
				// An diesem Erfordernis, nicht nach der Gemeinschaft: an der Einsprache
				// nach L3 «je Eigentümer» eine Stimme (Codeprüfung Block 5, M-b).
				kopfstimmen: k ? kopfstimmenAn({ units: k.einheiten }, offen.erfordernis, momentaufnahme) : 0,
				wertquote: k?.wertquote ?? 0,
				// Vorbelegt wird nie mit Enthaltung: Die stille Voreinstellung
				// entschiede beim einfachen Mehr über Annahme oder Ablehnung (AD-15).
				gewaehlt:
					vonHandErfasst.get(s.parteiId) === true ? (letzte.get(s.parteiId) ?? null) : null,
				selbst: letzte.has(s.parteiId) && vonHandErfasst.get(s.parteiId) === false,
				aufPapier: aufPapier.has(s.parteiId)
			};
		});

	return { zeilen, sperren: sperren.map(sperreInWorten) };
}
