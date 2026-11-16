/**
 * Notizen zu Protokollabsätzen ausformulieren lassen (FR-61).
 *
 * **Je Notiz ein Aufruf, und nur dort, wo eine Notiz steht.** «Fehlt zu einem
 * Traktandum jede Notiz, erscheint nur der Beschlussteil» (FR-61) ist damit
 * keine Regel, die jemand einhalten muss, sondern eine Folge des Aufbaus: Ohne
 * Notiz gibt es nichts zu formulieren und also keinen Aufruf.
 *
 * **Geschrieben wird nichts.** Was zurückkommt, liegt neben der Notiz und
 * wartet auf einen Klick. Die Sitzungsleitung entscheidet, nicht das Werkzeug.
 */
import { alsBetreiber } from './db';
import { frage, haltNutzungFest, vermerkeEntscheid } from './ki';
import type { Entscheidbindung } from './ki';
import { namenDerGemeinschaft } from './kinamen';
import type { Handelnder } from './audit';
import { enthuelle, maskiereFelder } from '$lib/domain/namensschutz';
import { absatzauftrag, lesbarerAbsatz } from '$lib/domain/protokollentwurf';
import type { Entscheid } from '$lib/domain/ki';
import type { Id } from '$lib/domain/types';

export interface Absatzvorschlag {
	traktandumId: Id;
	titel: string;
	/** Die Notiz, wie sie erfasst wurde — zum Vergleich nebeneinander. */
	notiz: string;
	absatz: string | null;
	/** Warum keiner entstand. */
	grund: string | null;
	/** Was am Absatz auffällt, ohne ihn unbrauchbar zu machen. */
	hinweise: string[];
}

/**
 * Wie viele Notizen ein Durchgang höchstens formuliert.
 *
 * **Je Notiz ein Aufruf** — bei dreissig Traktanden sind das dreissig, und bei
 * einem hängenden Anbieter je zwölf Sekunden Geduld. Wer dann auf den Knopf
 * drückt, steht Minuten vor einem stehenden Bildschirm und hält die Anwendung
 * für abgestürzt. Was über der Schranke liegt, wird **genannt** und nicht
 * stillschweigend weggelassen.
 */
export const HOECHSTENS = 20;

export interface Entwurfsergebnis {
	vorschlaege: Absatzvorschlag[];
	hinausgegangen: string;
	namenGeschuetzt: number;
	stufe: string | null;
	dauerMs: number;
	nutzungId: string | null;
	fehlschlaege: string[];
	/** Traktanden ohne Notiz — sie werden gar nicht erst gefragt. */
	ohneNotiz: number;
	/** Notizen, die diesmal nicht drankamen, weil die Schranke greift. */
	uebrig: number;
}

interface Zeile {
	id: string;
	title: string;
	note: string | null;
	stweg_id: string;
}

export async function formuliereNotizen(
	handelnder: Handelnder & { operatorId: Id },
	meetingId: Id
): Promise<Entwurfsergebnis> {
	const zeilen = await alsBetreiber(handelnder.operatorId, async (tx) => {
		return tx<Zeile[]>`
			SELECT a.id, a.title, a.minute_text AS note, m.stweg_id
			FROM agenda_item a
			JOIN meeting m ON m.id = a.meeting_id
			WHERE a.meeting_id = ${meetingId}
			ORDER BY a.position
		`;
	});

	const alleMitNotiz = zeilen.filter((z) => (z.note ?? '').trim() !== '');
	const mitNotiz = alleMitNotiz.slice(0, HOECHSTENS);
	const uebrig = alleMitNotiz.length - mitNotiz.length;
	const ohneNotiz = zeilen.length - alleMitNotiz.length;

	if (mitNotiz.length === 0) {
		return {
			vorschlaege: [],
			hinausgegangen: '',
			namenGeschuetzt: 0,
			stufe: null,
			dauerMs: 0,
			nutzungId: null,
			fehlschlaege: ['Es ist keine Notiz erfasst. Ohne Notizen gibt es nichts zu formulieren.'],
			ohneNotiz,
			uebrig
		};
	}

	const s = await namenDerGemeinschaft(handelnder.operatorId, zeilen[0].stweg_id);
	const vorschlaege: Absatzvorschlag[] = [];
	const hinaus: string[] = [];
	const fehlschlaege: string[] = [];
	let dauerMs = 0;
	let stufe: string | null = null;
	let namenGeschuetzt = 0;

	for (const z of mitNotiz) {
		const notiz = (z.note ?? '').trim();
		// **Je Notiz eine eigene Maskierung**, damit ein Traktandum nicht die
		// Nummern eines anderen erbt — und damit im Auftrag nur steht, was zu
		// diesem einen Punkt gehört.
		const m = maskiereFelder(s, { titel: z.title, notiz });
		namenGeschuetzt += m.anzahl;
		const auftrag = `Traktandum: ${m.felder.titel}\nNotiz: ${m.felder.notiz}`;
		hinaus.push(auftrag);

		const antwort = await frage(handelnder.operatorId, absatzauftrag(), auftrag, { hoechstlaenge: 400 });
		dauerMs += antwort.dauerMs;
		if (antwort.stufe) stufe = antwort.stufe.name;
		fehlschlaege.push(...antwort.fehlschlaege);

		if (!antwort.ok) {
			vorschlaege.push({
				traktandumId: z.id,
				titel: z.title,
				notiz,
				absatz: null,
				grund: 'Der Anbieter antwortete nicht.',
				hinweise: []
			});
			continue;
		}

		// **Gegen die maskierte Notiz prüfen, nicht gegen die entschlüsselte.**
		// Ein Platzhalter enthält eine Ziffer; wer erst die Namen einsetzt und
		// dann Zahlen vergleicht, meldet «[Person 1]» als erfundene Zahl.
		const lage = lesbarerAbsatz(antwort.text, m.felder.notiz);
		vorschlaege.push({
			traktandumId: z.id,
			titel: z.title,
			notiz,
			absatz: lage.absatz === null ? null : enthuelle(m.rueckweg, lage.absatz.text),
			/*
			 * **Auch der Grund geht den Rückweg** (02.09.2026, aus dem Code-Review).
			 *
			 * Er wird gegen die **maskierte** Notiz gebildet und zitiert deshalb
			 * Platzhalter: «Der Entwurf nennt Personen, die in der Notiz nicht
			 * vorkommen ([Person 2])». Danebengestellt steht die unmaskierte Notiz
			 * mit «Herr Meier» — und damit ist genau die Prüfung unmöglich, für die
			 * die Gegenüberstellung gebaut wurde.
			 *
			 * `enthuelle` ist hier das Richtige und nicht zu viel: Es setzt nur ein,
			 * was der Rückweg kennt. Ein Platzhalter, den das Modell **erfunden**
			 * hat, steht in keinem Rückweg und bleibt stehen — und soll es, denn er
			 * ist der Befund.
			 */
			grund: lage.grund === null ? null : enthuelle(m.rueckweg, lage.grund),
			hinweise: lage.absatz?.hinweise ?? []
		});
	}

	const brauchbar = vorschlaege.filter((v) => v.absatz !== null).length;
	const nutzungId = await haltNutzungFest(handelnder, {
		stwegId: zeilen[0].stweg_id,
		meetingId,
		funktion: 'protokollentwurf',
		gegenstandArt: 'meeting',
		gegenstandId: meetingId,
		stufe: stufe === null ? null : { nummer: 0, name: stufe, url: '', modell: '', schluessel: null, geduldMs: 0, quelle: 'umgebung' },
		dauerMs,
		gescheitert: stufe === null,
		bemerkung:
			`${brauchbar} von ${mitNotiz.length} Notizen formuliert, ${namenGeschuetzt} Namen ersetzt` +
			(uebrig > 0 ? `, ${uebrig} nicht gefragt (Schranke)` : '')
	});

	return {
		vorschlaege,
		hinausgegangen: hinaus.join('\n\n———\n\n'),
		namenGeschuetzt,
		stufe,
		dauerMs,
		nutzungId,
		fehlschlaege,
		ohneNotiz,
		uebrig
	};
}

/** Was die Sitzungsleitung mit den Entwürfen gemacht hat (FR-63). */
export async function haltEntwurfsentscheidFest(
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

/**
 * Ob zu dieser Versammlung ein maschinell vorbereiteter Entwurf entstand.
 *
 * Trägt den Vermerk im Protokoll (FR-63). Gefragt wird der Nachweis und nicht
 * ein Merker am Protokoll: Der Nachweis wird nie gelöscht, ein Merker liesse
 * sich mit dem nächsten Speichern verlieren.
 *
 * **Es genügt nicht, dass gefragt wurde** (Fund vom 05.08.2026). Wer sich die
 * Vorschläge angesehen und keinen übernommen hat, hat kein maschinell
 * vorbereitetes Protokoll — der Vermerk wäre dann eine falsche Aussage über den
 * eigenen Text. Deshalb hängt er am **Entscheid**: angenommen oder verändert
 * übernommen. Das Übernehmen eines Absatzes setzt ihn selbst.
 */
export async function maschinellVorbereitet(
	operatorId: Id,
	meetingId: Id
): Promise<{ anbieter: string; wer: string } | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ provider: string | null; used_by_label: string | null }[]>`
			SELECT provider, used_by_label
			FROM ai_usage
			WHERE meeting_id = ${meetingId}
			  AND feature = 'protokollentwurf'
			  AND failed = false
			  AND outcome IN ('angenommen', 'veraendert')
			ORDER BY used_at DESC
			LIMIT 1
		`;
		if (!z) return null;
		return { anbieter: z.provider ?? 'unbekanntes Modell', wer: z.used_by_label ?? 'die Sitzungsleitung' };
	});
}
