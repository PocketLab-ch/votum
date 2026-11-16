/**
 * Den Erfordernisvorschlag holen (FR-59).
 *
 * Wie die Traktandenprüfung: auswählen, maskieren, fragen, prüfen,
 * zurücksetzen, festhalten. Zwei Dinge sind hier anders und beide wichtig —
 * **das Modell wählt aus einer Liste**, statt zu formulieren, und **der
 * Vorschlag setzt nichts**. Er landet als Hinweis neben dem Entscheidbaum,
 * den die Sitzungsleitung weiterhin selbst durchläuft.
 */
import { alsBetreiber } from './db';
import { frage, alsJson, haltNutzungFest } from './ki';
import { namenDerGemeinschaft } from './kinamen';
import type { Handelnder } from './audit';
import { erfordernisAmHaus } from './traktanden';
import { enthuelle, maskiereFelder } from '$lib/domain/namensschutz';
import {
	einstiegsauftrag,
	frageauftrag,
	lesbareAntwort,
	lesbarerEinstieg,
	vorschlagAus,
	type Modellschritt,
	type Vorschlagslage
} from '$lib/domain/erfordernisvorschlag';
import { laufe } from '$lib/domain/entscheidbaum';
import type { Regelwerk } from '$lib/domain/regelwerk';
import type { Id } from '$lib/domain/types';

export interface Vorschlagsergebnis extends Vorschlagslage {
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
	body: string | null;
	motion_text: string | null;
	item_kind: string;
	meeting_id: string;
	stweg_id: string;
}

export async function holeVorschlag(
	handelnder: Handelnder & { operatorId: Id },
	traktandumId: Id,
	/**
	 * Die Versammlung, zu der das Traktandum gehören MUSS.
	 *
	 * **Der Anlass** (Code-Review 02.09.2026, beim Nachgehen von Befund 1b). Der
	 * Befund nannte `pruefeAntrag`; gemessen war dieser Weg hier derselbe Fall,
	 * nur über zwei Adressteile statt über das Formular. Die Schale prüft die
	 * KI-Zulassung der Gemeinschaft aus `params.id` — `params.traktandumId`
	 * stand daneben und wurde nie gegen sie geprüft. Eine POST-Aktion läuft ohne
	 * `load`, also fängt auch dort nichts ab.
	 *
	 * Am laufenden System nachgemessen, zwei Gemeinschaften desselben
	 * Betreibers: Unter der eigenen Adresse antwortet die Anwendung mit 400
	 * («Für diese Gemeinschaft ist die KI-Unterstützung nicht zugelassen»),
	 * unter der fremden mit 200 und vollem Vorschlag.
	 *
	 * Die Bindung gehört an die Abfrage und nicht davor: Eine Prüfung, die
	 * daneben steht, lässt sich beim nächsten Aufrufer vergessen.
	 */
	meetingId: Id,
	regelwerk: Regelwerk
): Promise<Vorschlagsergebnis> {
	const leer = {
		vorschlag: null,
		hinausgegangen: '',
		namenGeschuetzt: 0,
		stufe: null,
		dauerMs: 0,
		nutzungId: null
	};

	const t = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<Zeile[]>`
			SELECT a.id, a.title, a.body, a.motion_text, a.item_kind, a.meeting_id, m.stweg_id
			FROM agenda_item a JOIN meeting m ON m.id = a.meeting_id
			WHERE a.id = ${traktandumId} AND a.meeting_id = ${meetingId}
		`;
		return z ?? null;
	});

	if (t === null) {
		return { ...leer, grund: 'Das Traktandum gibt es nicht mehr.', fehlschlaege: [] };
	}

	const s = await namenDerGemeinschaft(handelnder.operatorId, t.stweg_id);
	const m = maskiereFelder(s, {
		titel: t.title,
		inhalt: t.body ?? '',
		antragswortlaut: t.motion_text ?? ''
	});

	// Nur das Vorhaben. Wer wie viele Wertquoten hält und wer betroffen ist,
	// ändert an der **Einordnung** des Geschäfts nichts — nur an der Zählung,
	// und die geschieht hier ohnehin nicht.
	const hinausgegangen = [
		`Titel: ${m.felder.titel}`,
		m.felder.inhalt !== '' ? `Inhalt: ${m.felder.inhalt}` : null,
		m.felder.antragswortlaut !== '' ? `Antrag: ${m.felder.antragswortlaut}` : null
	]
		.filter((z) => z !== null)
		.join('\n');

	/*
	 * **Ein Aufruf je Frage.** Das Modell wählt jedes Mal aus zwei bis vier
	 * Antworten; mehr kann es nicht tun. Der Weg dazwischen gehört der
	 * Anwendung, und jeder Schritt wird an der geltenden Fassung nachgerechnet.
	 */
	const fehlschlaege: string[] = [];
	let dauerMs = 0;
	let stufe: string | null = null;

	const einstieg = await frage(handelnder.operatorId, einstiegsauftrag(regelwerk), hinausgegangen, { hoechstlaenge: 200 });
	dauerMs += einstieg.dauerMs;
	stufe = einstieg.stufe?.name ?? null;
	fehlschlaege.push(...einstieg.fehlschlaege);

	const astId = einstieg.ok ? lesbarerEinstieg(alsJson(einstieg.text), regelwerk) : null;

	const schritte: Modellschritt[] = [];
	let grund: string | null = null;

	if (astId === null) {
		grund = einstieg.ok
			? 'Das Modell konnte das Geschäft keinem Einstieg zuordnen.'
			: null;
	} else {
		// Der Baum ist endlich; die Schranke fängt nur einen fehlerhaften
		// Regelwerksstand ab, bei dem eine Frage im Kreis führte.
		for (let n = 0; n < 12; n++) {
			const lauf = laufe(
				regelwerk,
				astId,
				schritte.map((s) => s.antwortId)
			);
			if (lauf.stand.art !== 'frage') break;

			const f = lauf.stand.frage;
			const a = await frage(handelnder.operatorId, frageauftrag(f), hinausgegangen, { hoechstlaenge: 250 });
			dauerMs += a.dauerMs;
			if (a.stufe) stufe = a.stufe.name;
			fehlschlaege.push(...a.fehlschlaege);

			const gewaehlt = a.ok ? lesbareAntwort(alsJson(a.text), f) : null;
			if (gewaehlt === null) {
				grund = a.ok
					? `Bei der Frage «${f.text}» kam keine brauchbare Antwort zurück. Bitte selbst entscheiden.`
					: null;
				break;
			}

			const antwort = f.antworten.find((x) => x.id === gewaehlt.antwortId)!;
			schritte.push({
				frageId: f.id,
				frageText: f.text,
				antwortId: antwort.id,
				antwortText: antwort.text,
				begruendung: gewaehlt.begruendung,
				unsicher: gewaehlt.unsicher
			});
		}
	}

	const lage: Vorschlagslage =
		astId !== null && grund === null
			? vorschlagAus(regelwerk, astId, schritte)
			: { vorschlag: null, grund };

	// Namen zurück in die Begründungen — sie sollen im Saal lesbar sein.
	const vorschlag =
		lage.vorschlag === null
			? null
			: {
					...lage.vorschlag,
					schritte: lage.vorschlag.schritte.map((x) => ({
						...x,
						begruendung: enthuelle(m.rueckweg, x.begruendung)
					}))
				};

	const nutzungId = await haltNutzungFest(handelnder, {
		stwegId: t.stweg_id,
		meetingId: t.meeting_id,
		funktion: 'erfordernisvorschlag',
		gegenstandArt: 'agenda_item',
		gegenstandId: t.id,
		stufe: einstieg.stufe,
		dauerMs,
		gescheitert: stufe === null,
		// Welcher Fall vorgeschlagen wurde, gehört in den Nachweis: Wer später
		// fragt, warum dieses Erfordernis am Traktandum steht, bekommt die Kette.
		bemerkung:
			vorschlag?.knotenId ??
			(stufe === null ? fehlschlaege.join(' · ') : `kein Vorschlag: ${lage.grund ?? 'unbekannt'}`)
	});

	return {
		vorschlag,
		grund: lage.grund,
		hinausgegangen,
		namenGeschuetzt: m.anzahl,
		stufe,
		dauerMs,
		nutzungId,
		fehlschlaege
	};
}

/**
 * Der Vorschlag mit dem Typ am Haus (Rest aus Lesarten Block 1, Befund 7).
 *
 * Das Modell nennt einen Knoten, und `typ` war der des Knotens: die Vorgabe,
 * ohne Reglement. Verglichen wird in der Karte mit dem gesetzten Erfordernis
 * (`gegenpruefung`), und das trägt Regel und Lesart; mit L4 «qualifiziert»
 * hiess ein gleiches Mehr dort «Sie verlangen mehr». Ein Grenzfall hat kein
 * Mehr am Haus und bleibt, wie er ist.
 */
export async function vorschlagAmHaus<V extends Vorschlagslage>(
	operatorId: Id,
	wo: { meetingId: Id; stwegId: Id },
	ergebnis: V
): Promise<V> {
	const v = ergebnis.vorschlag;
	if (!v || v.typ === 'grenzfall') return ergebnis;
	const amHaus = await erfordernisAmHaus(operatorId, wo, v.knotenId);
	return { ...ergebnis, vorschlag: { ...v, typ: amHaus.typ } };
}
