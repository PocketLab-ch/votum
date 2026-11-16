/**
 * Der Zugang zum Modell — als **Kette**, nicht als ein Anbieter (FR-58 bis 63).
 *
 * **Das Modell ist Konfiguration, nicht Programm** (Vorgabe des Auftraggebers vom
 * 05.08.2026): «Das LLM bewusst offen halten, wenn sich das Programm öffentlich
 * schaltet. Jeder soll selbst entscheiden, was korrekt ist. Wichtig ist, sollte
 * ein Modell ausfallen, dass man eine Fallbackebene anbietet. Es könnte auch ein
 * lokales LLM sein.»
 *
 * Deshalb steht hier kein Anbietername, kein Vorzugsmodell und keine Annahme
 * über den Standort. Eingerichtet werden **Stufen**: jede mit Adresse, Modell,
 * Schlüssel und einer Bezeichnung, die der Betreiber selbst vergibt. Wer nur
 * eine will, richtet eine ein.
 *
 * **Gesprochen wird OpenAI-kompatibel** (`/chat/completions`). Das ist die
 * Schnittstelle, die Infomaniak, Mistral, llama.cpp, Ollama und vLLM alle
 * anbieten — die Kette kann damit ein Rechenzentrum und einen Rechner im Keller
 * mischen.
 *
 * **Ausgewichen wird nur bei Ausfall**, nie weil eine Antwort nicht gefällt:
 * Zeitüberschreitung, Nichterreichbarkeit, 429 und 5xx. Eine inhaltlich
 * unbequeme Antwort so lange neu zu würfeln, bis sie passt, wäre das Gegenteil
 * einer Prüfung.
 *
 * **Ein Ausfall bricht nie einen Ablauf ab** (FR-62). Diese Datei wirft nicht;
 * sie gibt zurück, dass es nicht ging.
 */
import { alsBetreiber } from './db';
import { entschluessele } from './tresor';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Entscheid, KiFunktion } from '$lib/domain/ki';
import { FachlicherFehler } from '$lib/domain/fehler';
import type { Id } from '$lib/domain/types';

/**
 * Wie lange eine Stufe höchstens braucht, bevor die nächste dran ist.
 * Die Zahl steht im Kern — dieselbe braucht das Formular und die Aktion.
 */
import { GEDULD_VORGABE_MS as GEDULD_MS } from '$lib/domain/dienste';

/** Woher eine Stufe stammt. Steht in der Anzeige — sonst sucht jemand am falschen Ort. */
export type Kiquelle = 'anwendung' | 'umgebung';

export interface Kistufe {
	nummer: number;
	/** Bezeichnung aus der Konfiguration, etwa «Infomaniak (CH)». */
	name: string;
	url: string;
	modell: string;
	schluessel: string | null;
	geduldMs: number;
	quelle: Kiquelle;
	/** Nur bei Stufen aus der Anwendung — die Zeile lässt sich dort ändern. */
	id?: Id;
}

/**
 * Die Stufen aus der Umgebung, in der Reihenfolge ihrer Nummern.
 *
 * `VERSAMMLUNG_KI_1_URL`, `_1_MODELL`, `_1_SCHLUESSEL`, `_1_NAME`, `_1_GEDULD`
 * — und dasselbe mit 2, 3, … Die Numerierung ist die Reihenfolge; eine Lücke
 * beendet die Kette, damit ein Tippfehler nicht stillschweigend eine Stufe
 * überspringt.
 */
export function umgebungsstufen(): Kistufe[] {
	const aus: Kistufe[] = [];
	for (let n = 1; n <= 9; n++) {
		const url = process.env[`VERSAMMLUNG_KI_${n}_URL`]?.trim();
		const modell = process.env[`VERSAMMLUNG_KI_${n}_MODELL`]?.trim();
		if (!url || !modell) break;
		aus.push({
			nummer: n,
			name: process.env[`VERSAMMLUNG_KI_${n}_NAME`]?.trim() || (URL.parse(url)?.host ?? url),
			url,
			modell,
			schluessel: process.env[`VERSAMMLUNG_KI_${n}_SCHLUESSEL`]?.trim() || null,
			geduldMs: Number(process.env[`VERSAMMLUNG_KI_${n}_GEDULD`] ?? '') || GEDULD_MS,
			quelle: 'umgebung'
		});
	}
	return aus;
}

/**
 * Die Stufen, die in der Anwendung eingerichtet wurden (14.08.2026).
 *
 * **Eine Lücke beendet die Kette hier nicht.** Anders als bei der Umgebung
 * werden die Zeilen sortiert gelesen und danach durchnumeriert: Wer Stufe 1
 * löscht, hat Stufe 2 als erste, statt gar keine mehr. Bei der Umgebung ist die
 * Nummer ein getippter Text und eine Lücke wahrscheinlich ein Tippfehler; hier
 * ist sie eine Zeile, die jemand entfernt hat.
 *
 * **Ein unlesbarer Schlüssel wirft nicht.** Wurde das Geheimnis gewechselt,
 * bliebe sonst die ganze Anwendung an einer Nebensache hängen. Die Stufe kommt
 * ohne Schlüssel zurück, scheitert beim Anruf und sagt dort, was fehlt.
 */
export async function anwendungsstufen(operatorId: Id): Promise<Kistufe[]> {
	const zeilen = await alsBetreiber(operatorId, async (tx) => {
		return tx<
			{ id: string; position: number; name: string; url: string; model: string; api_key_enc: string | null; patience_ms: number }[]
		>`
			SELECT id, position, name, url, model, api_key_enc, patience_ms
			FROM ai_stage WHERE operator_id = ${operatorId} ORDER BY position
		`;
	});

	return zeilen.map((z, i) => ({
		nummer: i + 1,
		name: z.name,
		url: z.url,
		modell: z.model,
		schluessel: z.api_key_enc === null ? null : leseSchluessel(z.api_key_enc),
		geduldMs: z.patience_ms,
		quelle: 'anwendung' as const,
		id: z.id
	}));
}

function leseSchluessel(abgelegt: string): string | null {
	try {
		return entschluessele(abgelegt);
	} catch {
		return null;
	}
}

/**
 * Die geltende Kette: was in der Anwendung steht, sonst die Umgebung.
 *
 * **Vorrang für die Anwendung**, nicht Vermischen. Zwei Quellen zu einer Kette
 * zusammenzuhängen ergäbe eine Reihenfolge, die niemand angeordnet hat — und
 * beim Ausfall der ersten Stufe fragte die Anwendung ein Haus, von dem der
 * Betreiber nicht mehr weiss, dass es eingetragen ist. Die Umgebung bleibt
 * damit der Rückfall für Anlagen, die nie etwas eingerichtet haben.
 */
export async function stufen(operatorId: Id): Promise<Kistufe[]> {
	const eigene = await anwendungsstufen(operatorId);
	return eigene.length > 0 ? eigene : umgebungsstufen();
}

export async function kiEingerichtet(operatorId: Id): Promise<boolean> {
	return (await stufen(operatorId)).length > 0;
}

export interface Antwort {
	ok: boolean;
	/** Der Text des Modells — bei `ok` gesetzt. */
	text: string;
	/** Welche Stufe geantwortet hat. */
	stufe: Kistufe | null;
	dauerMs: number;
	/** Was schiefging, je Stufe — für die Anzeige und den Nachweis. */
	fehlschlaege: string[];
}

/**
 * Fragt die Kette der Reihe nach.
 *
 * **Je Stufe ein Versuch.** Die Kette *ist* die Wiederholung; ein zweiter
 * Versuch gegen dasselbe hängende Haus kostet die Zeit, die der nächsten Stufe
 * fehlt. Wer nur eine Stufe einrichtet, bekommt deshalb zwei Versuche — sonst
 * wäre ein einzelner Aussetzer gleich ein Ausfall.
 */
export async function frage(
	operatorId: Id,
	system: string,
	auftrag: string,
	opts: { hoechstlaenge?: number } = {}
): Promise<Antwort> {
	const kette = await stufen(operatorId);
	const fehlschlaege: string[] = [];
	const begonnen = Date.now();

	if (kette.length === 0) {
		return {
			ok: false,
			text: '',
			stufe: null,
			dauerMs: 0,
			fehlschlaege: ['Es ist kein Modell eingerichtet.']
		};
	}

	const versuche = kette.length === 1 ? [kette[0], kette[0]] : kette;

	for (const stufe of versuche) {
		try {
			const text = await einVersuch(stufe, system, auftrag, opts.hoechstlaenge ?? 1200);
			return { ok: true, text, stufe, dauerMs: Date.now() - begonnen, fehlschlaege };
		} catch (fehler) {
			fehlschlaege.push(
				`${stufe.name}: ${fehler instanceof Error ? fehler.message : String(fehler)}`
			);
		}
	}

	return { ok: false, text: '', stufe: null, dauerMs: Date.now() - begonnen, fehlschlaege };
}

/**
 * Ruft **eine** Stufe an, damit die Einrichtung prüfbar ist (14.08.2026).
 *
 * Nicht über `frage()`: Die Kette weicht bei Ausfall aus, und genau das darf
 * hier nicht passieren — sonst meldet der Prüfknopf «geht» und gemeint war die
 * Nachbarstufe. Geprüft wird immer die, auf deren Knopf jemand gedrückt hat.
 *
 * Der Auftrag ist absichtlich winzig: Es geht um Erreichbarkeit, Schlüssel und
 * Modellnamen, nicht um die Güte der Antwort.
 */
export async function pruefeStufenanruf(
	stufe: Kistufe
): Promise<{ ok: boolean; dauerMs: number; bemerkung: string }> {
	const begonnen = Date.now();
	try {
		const text = await einVersuch(
			stufe,
			'Antworte mit einem einzigen Wort.',
			'Sage: bereit',
			20
		);
		return {
			ok: true,
			dauerMs: Date.now() - begonnen,
			bemerkung: `${stufe.name} antwortete in ${Date.now() - begonnen} ms («${text.slice(0, 40)}»).`
		};
	} catch (fehler) {
		return {
			ok: false,
			dauerMs: Date.now() - begonnen,
			bemerkung: `${stufe.name} ${fehler instanceof Error ? fehler.message : String(fehler)}`
		};
	}
}

async function einVersuch(
	stufe: Kistufe,
	system: string,
	auftrag: string,
	hoechstlaenge: number
): Promise<string> {
	const antwort = await fetch(stufe.url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...(stufe.schluessel ? { authorization: `Bearer ${stufe.schluessel}` } : {})
		},
		body: JSON.stringify({
			model: stufe.modell,
			// Niedrig, aber nicht null: Es geht um Prüfen und Formulieren, nicht um
			// Einfälle. Bei null liefern manche Modelle stur denselben Satz, auch
			// wo er nicht passt.
			temperature: 0.2,
			max_tokens: hoechstlaenge,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: auftrag }
			]
		}),
		signal: AbortSignal.timeout(stufe.geduldMs)
	});

	if (!antwort.ok) {
		throw new Error(`antwortete mit ${antwort.status} ${antwort.statusText}`);
	}

	const d = (await antwort.json()) as {
		choices?: { message?: { content?: string | null } }[];
	};
	const text = d.choices?.[0]?.message?.content;
	if (typeof text !== 'string' || text.trim() === '') {
		// Kommt vor: Reasoning-Modelle legen den Text in ein anderes Feld und
		// lassen `content` leer. Für uns ist das ein Ausfall dieser Stufe.
		throw new Error('lieferte keinen Text (Modell antwortet in anderer Form?)');
	}
	return text.trim();
}

/**
 * Liest JSON aus einer Modellantwort.
 *
 * **Zäune abräumen.** Manche Modelle liefern reines JSON, andere packen es in
 * ```-Zäune, obwohl der Auftrag es verbietet. Daran soll eine Prüfung nicht
 * scheitern — geprüft wird der Inhalt, nicht die Höflichkeit des Modells.
 */
export function alsJson(text: string): unknown {
	let roh = text.trim();
	if (roh.startsWith('```')) {
		const teile = roh.split('```');
		roh = (teile[1] ?? '').replace(/^json/i, '').trim();
	}
	// Manche stellen einen Satz voran. Das erste ausgewogene Objekt genügt.
	const anfang = roh.indexOf('{');
	const ende = roh.lastIndexOf('}');
	if (anfang > 0 && ende > anfang) roh = roh.slice(anfang, ende + 1);

	try {
		return JSON.parse(roh);
	} catch {
		return null;
	}
}

// ── Der Nachweis (FR-63) ────────────────────────────────────────────────────

export interface Nutzungseintrag {
	stwegId: Id;
	meetingId?: Id | null;
	funktion: KiFunktion;
	gegenstandArt?: string | null;
	gegenstandId?: string | null;
	stufe?: Kistufe | null;
	dauerMs?: number;
	gescheitert?: boolean;
	bemerkung?: string | null;
}

/**
 * Hält eine Nutzung fest — **Gegenstand und Ergebnis, nicht Anfrage und
 * Antwort** (FR-63).
 *
 * Der Verlauf ist ein Nachweis darüber, wer was entschieden hat. Vollständige
 * Anfragen mitzuschreiben hiesse, Personenbezogenes ein weiteres Mal abzulegen —
 * an einer Stelle, die nie gelöscht wird (AD-5).
 */
export async function haltNutzungFest(
	handelnder: Handelnder & { operatorId: string },
	eintrag: Nutzungseintrag
): Promise<Id> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<{ id: string }[]>`
			INSERT INTO ai_usage (operator_id, stweg_id, meeting_id, feature, subject_type, subject_id,
			                      provider, model, stage, duration_ms, failed, note,
			                      used_by, used_by_label)
			VALUES (${handelnder.operatorId}, ${eintrag.stwegId}, ${eintrag.meetingId ?? null},
			        ${eintrag.funktion}, ${eintrag.gegenstandArt ?? null}, ${eintrag.gegenstandId ?? null},
			        ${eintrag.stufe?.name ?? null}, ${eintrag.stufe?.modell ?? null},
			        ${eintrag.stufe?.nummer ?? null}, ${eintrag.dauerMs ?? null},
			        ${eintrag.gescheitert ?? false}, ${eintrag.bemerkung ?? null},
			        ${handelnder.userId}, ${handelnder.label})
			RETURNING id
		`;
		return z.id;
	});
}

/**
 * Wohin eine Nutzung gehören muss, damit ein Entscheid auf sie geschrieben
 * werden darf.
 *
 * **Warum das ein Pflichtparameter ist** (Code-Review 02.09.2026). Bis hierher
 * nahm `vermerkeEntscheid` die Kennung der Nutzung entgegen und schrieb darauf,
 * ohne zu fragen, wozu sie gehört. Die Kennung kommt aus einem verborgenen
 * Formularfeld; RLS hielt den Mandanten, sonst nichts. Wer eine beliebige
 * `ai_usage`-Kennung seines Betreibers schickte, setzte deren Ausgang — und
 * verfälschte damit den Nachweis, den die Betreiberseite als «wer wann was
 * übernommen hat» ausweist.
 *
 * Es waren **vier** Wege dorthin (Traktandenprüfung, Erfordernis, Entwurf,
 * Antragsprüfung) und sechs Aufrufer. Deshalb steht die Bindung hier unten und
 * nicht in den Wrappern: Was ein Pflichtparameter ist, kann der nächste Weg
 * nicht vergessen.
 *
 * **Zwei Formen, weil es zwei Adressen gibt.** Die Seiten einer einzelnen
 * Versammlung kennen deren Kennung; die Sitzungsleitung eines gemeinsamen
 * Abends kennt nur den Abend, und die Nutzung hängt dort an einer seiner
 * Versammlungen.
 */
export type Entscheidbindung =
	| { art: 'versammlung'; versammlungId: Id }
	| { art: 'abend'; tagId: Id };

/**
 * Was die Bindung leistet — und was nicht.
 *
 * **Sie bindet an die Adresse, nicht an den Gegenstand** (Code-Review
 * 02.09.2026, zweite Runde). Wer die Kennung einer anderen Nutzung DERSELBEN
 * Versammlung schickt, kommt weiterhin durch; beim gemeinsamen Abend reicht das
 * über alle seine Gemeinschaften.
 *
 * Das ist bewusst so und keine Nachlässigkeit: Die Seite zeigt der
 * Sitzungsleitung alle Nutzungen ihrer Versammlung, sie darf über jede davon
 * entscheiden. Was die Bindung verhindert, ist der Sprung über die Grenze der
 * Adresse — und das war die Lücke. Ein Entscheid, der innerhalb derselben
 * Versammlung auf der falschen Zeile landet, ist ein Anzeigefehler; genau dafür
 * wird der gehaltene Sammelstand jetzt nachgeführt.
 *
 * Diese Zeilen stehen hier, damit der nächste Leser die Zusicherung nicht
 * grösser liest, als sie ist.

/**
 * Was die Sitzungsleitung mit dem Vorschlag gemacht hat (FR-63).
 *
 * Wirft `FachlicherFehler`, wenn die Nutzung nicht dorthin gehört, wo der
 * Aufrufer steht — und **nicht** stillschweigend nichts zu tun: Ein Entscheid,
 * der nicht ankommt, gehört gemeldet, sonst hält die Sitzungsleitung ihn für
 * festgehalten.
 */
export async function vermerkeEntscheid(
	handelnder: Handelnder,
	nutzungId: Id,
	entscheid: Entscheid,
	bindung: Entscheidbindung
): Promise<void> {
	await alsBetreiber(handelnder.operatorId as string, async (tx) => {
		/*
		 * Die Bedingung gehört in die Abfrage, nicht davor: Eine Prüfung, die
		 * daneben steht, lässt sich beim nächsten Aufrufer vergessen — dieselbe
		 * Begründung wie beim Anlass der Traktandenprüfung am 01.09.2026.
		 */
		const zeilen =
			bindung.art === 'versammlung'
				? await tx`
						UPDATE ai_usage SET outcome = ${entscheid}
						 WHERE id = ${nutzungId} AND meeting_id = ${bindung.versammlungId}
						RETURNING id, meeting_id, feature, subject_type, subject_id
					`
				: await tx`
						UPDATE ai_usage u SET outcome = ${entscheid}
						 WHERE u.id = ${nutzungId}
						   AND EXISTS (
						       SELECT 1 FROM meeting m
						        WHERE m.id = u.meeting_id AND m.meeting_day_id = ${bindung.tagId}
						   )
						RETURNING u.id, u.meeting_id, u.feature, u.subject_type, u.subject_id
					`;

		if (zeilen.length !== 1) {
			throw new FachlicherFehler(
				'entscheid_fremd',
				'Dieser Eintrag gehört nicht zu dieser Versammlung. Laden Sie die Seite neu.',
				'nutzungId'
			);
		}

		/*
		 * **Und in den Verlauf, in derselben Transaktion** (Produktentscheid
		 * 30.09.2026). `outcome` hält nur den letzten Entscheid und lässt sich
		 * überschreiben; der Verlauf hält jeden, nur anfügbar, und geht ins
		 * Siegelpaket. Gerade «Ich entscheide anders» gehört dorthin und nicht
		 * ins Protokoll: Die Leitung entscheidet, das Werkzeug empfiehlt.
		 */
		const [z] = zeilen as unknown as {
			meeting_id: Id;
			feature: string;
			subject_type: string | null;
			subject_id: string | null;
		}[];
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.kiEntscheid,
				{ art: 'meeting', id: z.meeting_id },
				{
					funktion: z.feature,
					entscheid,
					nutzung: nutzungId,
					gegenstandArt: z.subject_type,
					gegenstandId: z.subject_id
				}
			)
		);
	});
}

/** Ein Nachweis über maschinelle Vorbereitung — für das Protokoll dieser Versammlung. */
export interface Kinachweis {
	anfragen: number;
	uebernommen: number;
	anbieter: string[];
	zuerst: string | null;
	zuletzt: string | null;
}

/**
 * Was zu dieser Versammlung maschinell vorbereitet wurde (22.08.2026, Befund D-05).
 *
 * **Die Zusicherung war unerfüllbar.** Die Betreiberseite versprach: «Wer wann
 * was von einer Maschine vorbereiten liess, steht weiterhin im Verlauf.» Der
 * Nachweis besteht — vollständig, mit Anbieter, Zeitpunkt, Benutzer und
 * Entscheid —, aber er steht in `ai_usage` und nicht im Verlauf. Und einsehbar
 * war er nirgends: Wer ihn im Streitfall brauchte, kam nur über die Datenbank
 * daran. Der Entscheid der Leitung steht seit dem 30.09.2026 zusätzlich im
 * Verlauf (`ai.decision.recorded`, `vermerkeEntscheid`).
 *
 * **`outcome` trennt Fragen von Übernehmen**, und das ist der wichtigere Teil:
 * Wer sich Vorschläge angesehen und keinen übernommen hat, hat kein maschinell
 * vorbereitetes Protokoll. Die Zahl der Anfragen allein sagte das Gegenteil.
 */
export async function holeKinachweis(
	operatorId: Id,
	meetingId: Id
): Promise<Kinachweis | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<
			{
				anfragen: number;
				uebernommen: number;
				anbieter: string[] | null;
				zuerst: Date | null;
				zuletzt: Date | null;
			}[]
		>`
			SELECT count(*)::int AS anfragen,
			       count(*) FILTER (WHERE outcome IN ('angenommen', 'veraendert'))::int AS uebernommen,
			       array_remove(array_agg(DISTINCT provider), NULL) AS anbieter,
			       min(used_at) AS zuerst,
			       max(used_at) AS zuletzt
			  FROM ai_usage
			 WHERE meeting_id = ${meetingId}
		`;
		if (!z || z.anfragen === 0) return null;
		return {
			anfragen: z.anfragen,
			uebernommen: z.uebernommen,
			anbieter: z.anbieter ?? [],
			zuerst: z.zuerst?.toISOString() ?? null,
			zuletzt: z.zuletzt?.toISOString() ?? null
		};
	});
}
