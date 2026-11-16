/**
 * Die Traktandenprüfung als Vorgang (FR-58).
 *
 * Der Weg in einer Zeile: **Felder auswählen → Namen ersetzen → fragen →
 * Antwort prüfen → Namen zurücksetzen → Nutzung festhalten.** Jeder dieser
 * Schritte kann fehlschlagen, und keiner davon darf einen Ablauf abbrechen
 * (FR-62): Diese Datei wirft nicht, sie gibt zurück, was herausgekommen ist.
 *
 * **Nichts wird verändert.** Die Prüfung schreibt kein Traktandum um und setzt
 * kein Erfordernis. Sie liefert Befunde, die jemand liest.
 */
import { alsBetreiber } from './db';
import { frage, alsJson, haltNutzungFest, vermerkeEntscheid } from './ki';
import type { Entscheidbindung } from './ki';
import { namenDerGemeinschaft } from './kinamen';
import type { Handelnder } from './audit';
import { enthuelle, maskiereFelder } from '$lib/domain/namensschutz';
import type { Befund, Entscheid } from '$lib/domain/ki';
import {
	auftragstext,
	deuteAntwort,
	pruefauftrag,
	type Pruefergebnis
} from '$lib/domain/traktandenpruefung';
import type { Id } from '$lib/domain/types';

interface Zeile {
	id: string;
	title: string;
	body: string | null;
	motion_text: string | null;
	item_kind: string;
	meeting_id: string;
	stweg_id: string;
}

/**
 * Prüft ein Traktandum und hält die Nutzung fest.
 *
 * Die Zulassung — ob die Gemeinschaft die KI erlaubt und diese Funktion nicht
 * ausgenommen hat — prüft die Schale davor; hier steht der Vorgang.
 */
export async function pruefeTraktandum(
	handelnder: Handelnder & { operatorId: Id },
	traktandumId: Id,
	/**
	 * Die Versammlung, zu der das Traktandum gehören MUSS.
	 *
	 * **Der Anlass** (Sicherheitsdurchgang 01.09.2026). Die Schale prüft, ob die
	 * Gemeinschaft der Versammlung aus der Adresse die KI zugelassen hat — die
	 * Kennung des Traktandums kam aber ungeprüft aus dem Formular. Innerhalb
	 * eines Betreibers liess sich damit ein Traktandum einer ANDEREN Versammlung
	 * prüfen lassen, auch wenn deren Gemeinschaft die KI ausdrücklich nicht
	 * zugelassen hat. Die Mandantengrenze hielt (RLS), die Zulassung der
	 * Gemeinschaft nicht.
	 *
	 * Die Bindung gehört an die Abfrage und nicht davor: Eine Prüfung, die
	 * daneben steht, lässt sich beim nächsten Aufrufer vergessen.
	 */
	meetingId: Id
): Promise<Pruefergebnis> {
	const daten = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [t] = await tx<Zeile[]>`
			SELECT a.id, a.title, a.body, a.motion_text, a.item_kind, a.meeting_id, m.stweg_id
			FROM agenda_item a JOIN meeting m ON m.id = a.meeting_id
			WHERE a.id = ${traktandumId} AND a.meeting_id = ${meetingId}
		`;
		if (!t) return null;
		// Nur die Titel der übrigen — für den Abgleich auf Widersprüche genügt,
		// worum es geht.
		const andere = await tx<{ title: string }[]>`
			SELECT title FROM agenda_item
			WHERE meeting_id = ${t.meeting_id} AND id <> ${traktandumId}
			ORDER BY position
		`;
		return { t, andere: andere.map((z) => z.title) };
	});

	if (daten === null) {
		return {
			befunde: [],
			hinausgegangen: '',
			namenGeschuetzt: 0,
			stufe: null,
			dauerMs: 0,
			nutzungId: null,
			fehlschlaege: ['Das Traktandum gibt es nicht mehr.']
		};
	}

	const { t, andere } = daten;
	const auftrag = pruefauftrag(
		{
			titel: t.title,
			inhalt: t.body,
			antragswortlaut: t.motion_text,
			art: t.item_kind
		},
		andere
	);

	const s = await namenDerGemeinschaft(handelnder.operatorId, t.stweg_id);
	const m = maskiereFelder(s, auftrag.felder);
	const hinausgegangen = auftragstext(m.felder, t.item_kind);

	const antwort = await frage(handelnder.operatorId, auftrag.system, hinausgegangen, { hoechstlaenge: 1200 });

	/*
	 * **Erst deuten, dann die Namen einsetzen — nicht umgekehrt.**
	 *
	 * Andersherum lief es zuerst, und es fiel erst im Durchgang mit echten Daten
	 * auf: Ein Eigentümer namens `Beat "Bäbu" Winter` macht die Antwort beim
	 * Zurücksetzen zu ungültigem JSON. Die Befunde verschwanden **still** — die
	 * Sitzungsleitung las «nichts zu beanstanden», obwohl das Modell einen
	 * schweren Mangel gemeldet hatte.
	 */
	const gedeutet = antwort.ok
		? deuteAntwort(alsJson(antwort.text))
		: { befunde: [] as Befund[], lesbar: true };
	const befunde: Befund[] = gedeutet.befunde.map((b) => ({
		...b,
		was: enthuelle(m.rueckweg, b.was),
		vorschlag: enthuelle(m.rueckweg, b.vorschlag)
	}));

	const nutzungId = await haltNutzungFest(handelnder, {
		stwegId: t.stweg_id,
		meetingId: t.meeting_id,
		funktion: 'traktandenpruefung',
		gegenstandArt: 'agenda_item',
		gegenstandId: t.id,
		stufe: antwort.stufe,
		dauerMs: antwort.dauerMs,
		gescheitert: !antwort.ok,
		bemerkung: !antwort.ok
			? antwort.fehlschlaege.join(' · ')
			: gedeutet.lesbar
				? `${befunde.length} Befunde, ${m.anzahl} Namen ersetzt`
				: 'Antwort nicht lesbar'
	});

	return {
		befunde,
		unlesbar: antwort.ok && !gedeutet.lesbar,
		hinausgegangen,
		namenGeschuetzt: m.anzahl,
		stufe: antwort.stufe?.name ?? null,
		dauerMs: antwort.dauerMs,
		nutzungId,
		fehlschlaege: antwort.fehlschlaege
	};
}

/** Was die Sitzungsleitung mit den Befunden gemacht hat (FR-63). */
export async function haltEntscheidFest(
	handelnder: Handelnder,
	nutzungId: Id,
	/**
	 * Wohin die Nutzung gehören muss (Code-Review 02.09.2026).
	 *
	 * Pflichtparameter, kein Zusatz: Der Aufrufer hat die Adresse ohnehin
	 * geprüft, die Kennung der Nutzung dagegen kommt aus einem verborgenen
	 * Formularfeld. Die Begründung steht bei `vermerkeEntscheid`.
	 */
	bindung: Entscheidbindung,
	entscheid: Entscheid
): Promise<void> {
	await vermerkeEntscheid(handelnder, nutzungId, entscheid, bindung);
}
