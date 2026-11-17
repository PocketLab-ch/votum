/**
 * Die Häuser als Mitglieder einer Miteigentümergemeinschaft — in einem Zug.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Die MEG Umgebung gehört den 5 Häusern.
 * Also müsste ich dort doch sagen können, dass die Häuser zur MEG Umgebung
 * gehören.» Und einen Schritt später: «Es wäre doch einfacher, wenn eine MEG,
 * die aus Gemeinschaften besteht, direkt in Gemeinschaften anlegt und zuordnet.»
 *
 * **Was hier NICHT entsteht: eine neue Art von Beziehung.** Am Ende steht genau
 * das, was auch von Hand entstünde — dieselben Zeilen in `unit`, `party` und
 * `ownership`. Der Weg nimmt das Klicken ab, nicht die Entscheidung: Anteil und
 * Vertretung kommen von aussen und werden nicht erraten.
 *
 * **An einer Stelle**, weil zwei Masken denselben Vorgang auslösen: die
 * Anlegeseite (dort ist es der Regelfall) und die Eigentümerseite einer
 * bestehenden Gemeinschaft (dort kommt ein Haus dazu). Zwei Abschriften desselben
 * Ablaufs liefen auseinander, sobald eine davon etwas mehr tut.
 *
 * **Teilerfolg wird gemeldet, nicht verschwiegen.** Jedes Haus läuft für sich;
 * was misslingt, steht mit seinem Grund im Befund. Ein stiller Abbruch nach dem
 * dritten Haus hinterliesse eine Gemeinschaft mit drei Mitgliedern, die ab da
 * falsch rechnet.
 */
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { erstelleEinheitIn, holeQuotenarten } from './einheiten';
import { erstelleEigentuemerIn, schreibeEigentumszuordnung } from './eigentuemer';
import { alsBetreiber } from './db';
import { listeGemeinschaften } from './gemeinschaften';
import type { Handelnder } from './audit';
import type { Id } from '$lib/domain/types';
import { istKalendertag } from '$lib/domain/datum';

export interface Mitgliedseingabe {
	/** Die Gemeinschaft, die Mitglied wird. */
	stwegId: Id;
	/** Ihr Anteil am Hauptverteiler der Miteigentümergemeinschaft. */
	quote: number;
	/** Wer ihre eine Stimme ausübt. Pflicht — Art. 7 Ziff. 3. */
	vertretung: string;
}

export interface Aufnahmebefund {
	/** Namen der Gemeinschaften, die jetzt Mitglied sind. */
	gelungen: string[];
	/** Was nicht ging, mit Grund. */
	offen: string[];
}

export async function nimmGemeinschaftenAlsMitgliederAuf(
	handelnder: Handelnder & { operatorId: string },
	/** Die Miteigentümergemeinschaft, in die aufgenommen wird. */
	megId: Id,
	mitglieder: Mitgliedseingabe[],
	/** Seit wann die Anteile auf die Gemeinschaften lauten. */
	ab: string
): Promise<Aufnahmebefund> {
	if (mitglieder.length === 0) {
		throw new FachlicherFehler(
			'ohne_mitglied',
			'Wählen Sie mindestens eine Gemeinschaft.',
			'mitglied'
		);
	}
	if (!istKalendertag(ab)) {
		throw new FachlicherFehler('datum_fehlt', 'Ab wann die Anteile lauten, fehlt.', 'ab');
	}

	/*
	 * **Die Stammquote ist der Hauptverteiler**, nicht ein erfundener Schlüssel:
	 * Eine Gemeinschaft kann mehrere Verteiler führen, und der Anteil an der
	 * Miteigentümergemeinschaft hängt am ersten. Gibt es keinen, gibt es auch
	 * nichts zu verteilen.
	 */
	const arten = await holeQuotenarten(handelnder.operatorId, megId);
	const stamm = (arten.find((a) => a.isPrimary) ?? arten[0])?.key;
	if (!stamm) {
		throw new FachlicherFehler(
			'ohne_verteiler',
			'Diese Gemeinschaft führt keinen Verteiler — legen Sie zuerst die Wertquoten an.',
			'mitglied'
		);
	}

	// **Auch die archivierten**: Hier werden nur Namen nachgeschlagen. Fehlte
	// eine, meldete der Befund «gibt es nicht mehr» — und das wäre unwahr.
	const alle = await listeGemeinschaften(handelnder.operatorId, 'alle');
	const namen = new Map(alle.map((g) => [g.id, g.name]));

	const gelungen: string[] = [];
	const offen: string[] = [];
	for (const m of mitglieder) {
		const name = namen.get(m.stwegId);
		if (!name) {
			offen.push('Eine gewählte Gemeinschaft gibt es nicht mehr');
			continue;
		}
		/*
		 * **Je Mitglied eine Transaktion** (16.11.2026, Pendenz «Mitglieder
		 * aufnehmen: Absage lässt eine Einheit stehen»). Vorher schrieb jeder der
		 * drei Schritte für sich; scheiterte erst die Partei (etwa an der fehlenden
		 * Vertretung), stand die Einheit «Anteil …» mit Quote und Verlaufseintrag
		 * ohne Eigentümer da, und die Wertquotensumme ging nicht mehr auf. Jetzt
		 * entsteht alles oder nichts; die übrigen Mitglieder laufen weiter für sich.
		 */
		try {
			await alsBetreiber(handelnder.operatorId, async (tx) => {
				const einheit = await erstelleEinheitIn(tx, handelnder, {
					stwegId: megId,
					kind: 'unit',
					label: `Anteil ${name}`,
					quotas: { [stamm]: m.quote },
					countsAsHead: true
				});
				const partei = await erstelleEigentuemerIn(tx, handelnder, {
					stwegId: megId,
					kind: 'gemeinschaft',
					displayName: name,
					isCommunity: false,
					memberStwegId: m.stwegId,
					representativeName: m.vertretung || null
				});
				await schreibeEigentumszuordnung(tx, handelnder, einheit.id, partei.id, ab);
			});
			gelungen.push(name);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				offen.push(`${name} (${fehler.message})`);
				continue;
			}
			throw fehler;
		}
	}

	return { gelungen, offen };
}

/** Der Satz zum Befund — an einer Stelle, nicht in jeder Route neu. */
export function aufnahmesatz(b: Aufnahmebefund): string {
	const kopf =
		b.gelungen.length === 1
			? 'Eine Gemeinschaft ist jetzt Mitglied'
			: `${b.gelungen.length} Gemeinschaften sind jetzt Mitglied`;
	const gut = b.gelungen.length > 0 ? `${kopf}: ${b.gelungen.join(', ')}.` : 'Nichts angelegt.';
	return b.offen.length > 0 ? `${gut} Nicht angelegt: ${b.offen.join('; ')}.` : gut;
}

/**
 * Liest die Mitglieder aus einem Formular.
 *
 * Beide Masken schicken dieselben Felder: `mitglied` mehrfach, dazu je Kennung
 * `quote:<id>` und `vertretung:<id>`. Ein gemeinsamer Leser hält sie gleich.
 */
export function mitgliederAusFormular(daten: FormData): Mitgliedseingabe[] {
	return daten
		.getAll('mitglied')
		.map(String)
		.filter(Boolean)
		.map((id) => ({
			stwegId: id,
			quote: Number(String(daten.get(`quote:${id}`) ?? '').trim() || '0'),
			vertretung: String(daten.get(`vertretung:${id}`) ?? '').trim()
		}));
}
