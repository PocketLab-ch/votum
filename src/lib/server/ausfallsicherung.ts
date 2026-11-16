import { alsBetreiber } from './db';
import { schreibeVerlauf, zeitquelle, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';
import { kopfstimmenUngleich, mappenpostenAus, zaehlweise } from '$lib/domain/auszaehlmappe';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { holeMomentaufnahme } from './freigabe';
import { holeNeueTraktandenDerZweiten, holeTraktanden } from './traktanden';

/**
 * Der Vermerk, dass eine Unterlage der Ausfallsicherung geholt wurde.
 *
 * **Wozu.** Gemeldet am 20.08.2026: «Die Ausfallsicherung zu machen gehört zur
 * Vorbereitung.» Damit sie in der Leiste als Schritt stehen kann, muss die
 * Anwendung wissen, ob sie getan ist — und das Einzige, was sie beobachten
 * kann, ist, dass die Unterlagen geholt wurden.
 *
 * **Was der Vermerk NICHT behauptet:** dass jemand sie gedruckt oder auf einen
 * Stick gelegt hat. Das kann niemand hier wissen, und ein Häkchen, das mehr
 * verspricht als es weiss, ist schlimmer als keines. Der Schritt heisst deshalb
 * «geholt», nicht «bereit».
 */
/*
 * **Die Unterschriftenliste fehlte hier** (02.09.2026, beim Nachgehen des
 * Praxisbefunds des Auftraggebers). Sie steht seit dem 23.08.2026 auf der Ausfallseite und trägt im
 * Totalausfall den einzigen Anwesenheitsnachweis, den es dann noch gibt — gezählt
 * hat sie niemand. Der Schritt sagte «erledigt», während genau dieses Blatt nie
 * geholt worden war.
 *
 * Folge der Aufnahme: Bei einer Versammlung, die schon alle bisherigen Unterlagen
 * geholt hat, springt der Schritt von «erledigt» zurück auf «3 von 4». Das ist
 * die Berichtigung einer falschen Auskunft, nicht ein Rückschritt.
 */
export const AUSFALLUNTERLAGEN = [
	'traktanden',
	'unterschriften',
	'stimmzettel',
	'auszaehlung'
] as const;
export type Ausfallunterlage = (typeof AUSFALLUNTERLAGEN)[number];

/**
 * Hält fest, dass eine Unterlage geholt wurde — **einmal je Unterlage**.
 *
 * Jeder Abruf einen Eintrag zu schreiben, machte aus dem Verlauf ein
 * Zugriffsprotokoll: Wer die Datei dreimal öffnet, weil der Drucker klemmt,
 * füllt ihn mit drei Zeilen, die niemandem etwas sagen. Der Verlauf soll die
 * Chronik der Versammlung bleiben.
 */
export async function vermerkeAusfallunterlage(
	handelnder: Handelnder & { operatorId: Id },
	meetingId: Id,
	unterlage: Ausfallunterlage
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [schon] = await tx<{ eins: number }[]>`
			SELECT 1 AS eins FROM audit_entry
			WHERE subject_type = 'meeting' AND subject_id = ${meetingId}
			  AND event_type = ${EREIGNISARTEN.ausfallunterlageGeholt}
			  AND detail->>'unterlage' = ${unterlage}
			LIMIT 1
		`;
		if (schon) return;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.ausfallunterlageGeholt,
				{ art: 'meeting', id: meetingId },
				{ unterlage, quelle: zeitquelle() }
			)
		);
	});
}

/**
 * Braucht diese Versammlung überhaupt eine Auszählmappe?
 *
 * **Der Anlass** (Prüflauf II, C-02): Die Ausfallseite bot die Mappe auch dort
 * an, wo es nichts zu rechnen gibt — bei einfachem Mehr der Anwesenden und
 * gleichen Kopfstimmen genügt Handzählen. Wer klickte, bekam eine
 * JSON-Fehlerseite mit HTTP 400, und die Ablaufleiste blieb auf «2 von 3
 * Unterlagen geholt» stehen: ein Schritt, der sich nie abschliessen liess.
 *
 * **Die Entscheidung fällt an einer Stelle, gefragt wird sie an dreien** — vom
 * Downloadweg, von der Ausfallseite und von der Ablaufleiste. Vorher stand sie
 * nur im Downloadweg; die beiden anderen nahmen an, es gebe die Mappe immer.
 * Genau das ist die Klasse: ein Angebot, das der Server abweist.
 *
 * Gerechnet wird auf der **Momentaufnahme** — dieselbe Grundlage wie die Mappe
 * selbst. Ohne Freigabe gibt es keine, und dann gibt es auch nichts zu holen.
 */
export async function brauchtAuszaehlmappe(operatorId: Id, meetingId: Id): Promise<boolean> {
	return (await zaehlweisen(operatorId, meetingId)).size > 0;
}

/**
 * Wie je Traktandum gezählt werden muss, für die, an denen Handzählen nicht
 * genügt: Schlüssel ist die Knotenkennung, Wert das Ergebnis von `zaehlweise`
 * (Mappe). Traktanden, an denen Handzählen genügt, fehlen in der Karte.
 *
 * **Eine Stelle für Mappe und Stimmzettel** (Codeprüfung 14.11.2026, M1). Der
 * Stimmzettel teilt seine Zettel in «Zettel nötig» und «Handerheben genügt»;
 * nach dem Typ des Mehrs allein wäre ein einfaches Mehr mit Stichentscheid
 * nach Wertquoten oder mit ungleichen Kopfstimmen unter «Handerheben genügt»
 * gelandet, während die Mappe dafür eine Rechnung baut.
 */
export async function zaehlweisen(
	operatorId: Id,
	meetingId: Id
): Promise<Map<string, { quote: boolean }>> {
	const ergebnis = new Map<string, { quote: boolean }>();
	const [momentaufnahme, traktanden, neue] = await Promise.all([
		holeMomentaufnahme(operatorId, meetingId),
		holeTraktanden(operatorId, meetingId),
		holeNeueTraktandenDerZweiten(operatorId, meetingId)
	]);
	if (!momentaufnahme) return ergebnis;

	const ungleich = kopfstimmenUngleich(
		stimmkraftliste(momentaufnahme).eintraege.map((e) => ({
			name: e.displayName,
			kopfstimmen: e.kopfstimmen,
			wertquote: e.wertquote
		}))
	);
	const l5 = momentaufnahme.lesarten?.L5 ?? LESARTEN_VORGABE.L5;

	for (const t of traktanden) {
		if (t.knoten.art !== 'abstimmung' || t.knoten.rueckzug) continue;
		const e = t.knoten.erfordernis;
		if (!e) continue;
		/*
		 * **Derselbe Posten wie im Downloadweg, sonst antwortet das Haus zweimal
		 * verschieden** (04.09.2026). Diese Stelle entscheidet, ob die
		 * Ausfallseite die Mappe anbietet; der Downloadweg entscheidet dasselbe
		 * noch einmal. Fehlte hier ein Merkmal, sagte die Seite «für diesen Abend
		 * nicht nötig» und blendete den Link aus, während der Weg dahinter sehr
		 * wohl eine Mappe baute. Seit A3 bilden beide den Posten in
		 * `mappenpostenAus`, samt Vergleichen und L5.
		 */
		const p = mappenpostenAus({ nummer: t.nummer, titel: t.knoten.titel }, e, momentaufnahme, {
			neuAnZweiter: neue.has(t.knoten.id),
			wahl: l5
		});
		const weise = p === null ? null : zaehlweise(p, ungleich, momentaufnahme.tieBreak);
		if (weise) ergebnis.set(t.knoten.id, weise);
	}
	return ergebnis;
}
