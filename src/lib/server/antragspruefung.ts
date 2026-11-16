/**
 * Einen im Saal gestellten Antrag prüfen lassen (FR-60).
 *
 * **Im Saal, unter Zeitdruck.** Deshalb hier eine einzige Frage an das Modell
 * und keine Kette: Was sich rechnen lässt, wird gerechnet (siehe
 * `domain/antragspruefung.ts`), gefragt wird nur die Beurteilung des
 * Sachbereichs. Fällt die Kette aus, geht die Sitzung ohne sie weiter.
 */
import { alsBetreiber } from './db';
import { frage, alsJson, haltNutzungFest, vermerkeEntscheid } from './ki';
import type { Entscheidbindung } from './ki';
import { namenDerGemeinschaft } from './kinamen';
import type { Handelnder } from './audit';
import { enthuelle, maskiereFelder } from '$lib/domain/namensschutz';
import {
	beurteilungsauftrag,
	lesbareBeurteilung,
	type Beurteilung
} from '$lib/domain/antragspruefung';
import type { Entscheid } from '$lib/domain/ki';
import type { Id } from '$lib/domain/types';

export interface Antragsergebnis {
	beurteilung: Beurteilung | null;
	/** Warum es keine gibt. */
	grund: string | null;
	hinausgegangen: string;
	namenGeschuetzt: number;
	stufe: string | null;
	dauerMs: number;
	nutzungId: string | null;
	fehlschlaege: string[];
}

interface Zeile {
	id: string;
	title: string;
	motion_text: string | null;
	body: string | null;
	parent_id: string | null;
	meeting_id: string;
	stweg_id: string;
	eltern_titel: string | null;
	eltern_wortlaut: string | null;
	eltern_inhalt: string | null;
}

/**
 * Prüft einen Antrag gegen das angekündigte Geschäft, unter dem er hängt.
 *
 * Ohne Grundantrag gibt es nichts zu vergleichen: Ein Antrag, der unter keinem
 * angekündigten Traktandum hängt, ist schon der Form nach ein neues Geschäft —
 * dafür braucht es kein Modell, sondern die Aufnahme im Saal und eine Ausnahme
 * (Reglement oder Universalversammlung).
 */
export async function pruefeAntrag(
	handelnder: Handelnder & { operatorId: Id },
	traktandumId: Id,
	/**
	 * Wohin das Traktandum gehören MUSS — Pflichtparameter, kein Zusatz.
	 *
	 * **Der Anlass** (Code-Review 02.09.2026, Befund 1b). Die Schale prüft, ob
	 * die Gemeinschaft der Versammlung **aus der Adresse** die KI zugelassen
	 * hat; die Kennung des Traktandums kam ungeprüft aus dem Formular. Am
	 * laufenden System nachgemessen, zwei Gemeinschaften desselben Betreibers:
	 *
	 * | Weg | Antwort |
	 * |---|---|
	 * | unter der eigenen Adresse, KI nicht zugelassen | 400, «nicht zugelassen» |
	 * | dasselbe Traktandum unter fremder Adresse, KI zugelassen | **200 mit Ergebnis** |
	 *
	 * Die Mandantengrenze hält (RLS), die Zulassung der Gemeinschaft nicht. Es
	 * ist ein bezahlter Modellaufruf mit den Inhalten einer Gemeinschaft, die
	 * genau das abgelehnt hat.
	 *
	 * **Die Versammlung, nicht der Abend** — anders als bei `vermerkeEntscheid`,
	 * das eine Abend-Variante kennt. Der Grund ist die Zulassung: Sie hängt an
	 * der Gemeinschaft, und ein gemeinsamer Abend fasst mehrere. Eine Bindung an
	 * den Abend liesse zu, ein Traktandum einer Schwestergemeinschaft prüfen zu
	 * lassen, die die KI abgelehnt hat — derselbe Fehler eine Ebene höher.
	 *
	 * Beide Aufrufer haben die Versammlung: Auf der Leitungsseite steht sie in
	 * der Adresse; am Abend bestimmt `hausDesAbends()` sie aus dem Formular und
	 * prüft sie dabei gegen den Abend. Genau für diese Versammlung fragt die
	 * Schale die Zulassung ab.
	 *
	 * Die Bindung gehört an die Abfrage und nicht davor: Eine Prüfung, die
	 * daneben steht, lässt sich beim nächsten Aufrufer vergessen.
	 */
	meetingId: Id
): Promise<Antragsergebnis> {
	const leer = {
		beurteilung: null,
		hinausgegangen: '',
		namenGeschuetzt: 0,
		stufe: null,
		dauerMs: 0,
		nutzungId: null,
		fehlschlaege: [] as string[]
	};

	const t = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<Zeile[]>`
			SELECT a.id, a.title, a.motion_text, a.body, a.parent_id, a.meeting_id, m.stweg_id,
			       e.title AS eltern_titel, e.motion_text AS eltern_wortlaut, e.body AS eltern_inhalt
			FROM agenda_item a
			JOIN meeting m ON m.id = a.meeting_id
			LEFT JOIN agenda_item e ON e.id = a.parent_id
			WHERE a.id = ${traktandumId} AND a.meeting_id = ${meetingId}
		`;
		return z ?? null;
	});

	/*
	 * **Dieselbe Absage für «gibt es nicht» und «gehört nicht hierher»**: Wer
	 * eine fremde Kennung probiert, soll daraus nicht erfahren, dass es sie gibt.
	 */
	if (t === null) return { ...leer, grund: 'Das Traktandum gibt es nicht mehr.' };
	if (t.parent_id === null || t.eltern_titel === null) {
		return {
			...leer,
			grund:
				'Dieser Antrag hängt unter keinem angekündigten Traktandum. Damit ist er schon der Form ' +
				'nach ein neues Geschäft — ob darüber abgestimmt werden darf, entscheiden das Reglement ' +
				'oder die Universalversammlung, nicht dieses Werkzeug.'
		};
	}

	const s = await namenDerGemeinschaft(handelnder.operatorId, t.stweg_id);
	const m = maskiereFelder(s, {
		elternTitel: t.eltern_titel,
		elternWortlaut: t.eltern_wortlaut ?? '',
		elternInhalt: t.eltern_inhalt ?? '',
		titel: t.title,
		wortlaut: t.motion_text ?? '',
		inhalt: t.body ?? ''
	});

	const hinausgegangen = [
		'ANGEKÜNDIGT WAR:',
		`Titel: ${m.felder.elternTitel}`,
		m.felder.elternInhalt !== '' ? `Inhalt: ${m.felder.elternInhalt}` : null,
		m.felder.elternWortlaut !== '' ? `Antrag: ${m.felder.elternWortlaut}` : null,
		'',
		'IM SAAL GESTELLT WURDE:',
		`Titel: ${m.felder.titel}`,
		m.felder.inhalt !== '' ? `Inhalt: ${m.felder.inhalt}` : null,
		m.felder.wortlaut !== '' ? `Antrag: ${m.felder.wortlaut}` : null
	]
		.filter((z) => z !== null)
		.join('\n');

	// Kurz gehalten: Im Saal zählt die Sekunde, und die Antwort ist drei Felder.
	const antwort = await frage(handelnder.operatorId, beurteilungsauftrag(), hinausgegangen, { hoechstlaenge: 400 });
	const roh = antwort.ok ? lesbareBeurteilung(alsJson(antwort.text)) : null;
	const beurteilung: Beurteilung | null =
		roh === null
			? null
			: {
					...roh,
					begruendung: enthuelle(m.rueckweg, roh.begruendung),
					neuesThema: roh.neuesThema === null ? null : enthuelle(m.rueckweg, roh.neuesThema)
				};

	const nutzungId = await haltNutzungFest(handelnder, {
		stwegId: t.stweg_id,
		meetingId: t.meeting_id,
		funktion: 'antragspruefung',
		gegenstandArt: 'agenda_item',
		gegenstandId: t.id,
		stufe: antwort.stufe,
		dauerMs: antwort.dauerMs,
		gescheitert: !antwort.ok,
		bemerkung: beurteilung?.einschaetzung ?? (antwort.ok ? 'Antwort nicht lesbar' : antwort.fehlschlaege.join(' · '))
	});

	return {
		beurteilung,
		grund:
			beurteilung === null && antwort.ok
				? 'Die Antwort war nicht lesbar. Bitte noch einmal prüfen lassen.'
				: null,
		hinausgegangen,
		namenGeschuetzt: m.anzahl,
		stufe: antwort.stufe?.name ?? null,
		dauerMs: antwort.dauerMs,
		nutzungId,
		fehlschlaege: antwort.fehlschlaege
	};
}

/** Was die Sitzungsleitung mit der Einschätzung gemacht hat (FR-60, FR-63). */
export async function haltAntragsentscheidFest(
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
