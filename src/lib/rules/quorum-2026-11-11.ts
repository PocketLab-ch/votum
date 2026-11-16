/**
 * Fassung 2026-11-11: Der Kasten «Reglement» an den Karten mit vereinbarter
 * Ordnung sagt, wie die Leitung eine im Saal eingewendete, nicht hinterlegte
 * Bestimmung behandelt (Auftrag E2; Entscheid 0046, A7; Fachprüfung A4, R6-F-1
 * bis R9-L-3).
 *
 * **Daten, kein Code** (AD-4): Diese Fassung ändert keinen Knoten, keine Frage
 * und kein Erfordernis. Die neuen Sätze entstehen im Kern aus dem Verhalten
 * des Knotens (`reglementssatz`, `vorbehaltInWorten`) und gelten ab dieser
 * Kennung (`EINWAND_STRENGER_AB`); deshalb gibt es sie als eigene Fassung,
 * damit die Karten der Fassungen bis 2026-11-10 ihren Wortlaut behalten.
 *
 * **Was sich am Kasten ändert** (Karten `k-baulich-notwendig`,
 * `k-baulich-nuetzlich`, `k-bewirtschaftung-erweitert`, `k-benutzungsweise`,
 * `k-zweckbestimmung`, `k-verwaltung-wichtig`):
 *
 *  - Statt «zählen Sie nach dem Gesetz» bei jedem Einwand: Eine Bestimmung,
 *    die klar dieses Geschäft betrifft, so eingeführt wurde, wie es der Kasten
 *    verlangt, und in jeder Hinsicht strenger ist als das Gesetz, hält die
 *    Leitung ein. Erreicht der Antrag das Gesetz, aber nicht sie, hält sie
 *    ihn mit dem Beschluss von Hand und dem Grund «Eingewendete Bestimmung»
 *    als abgelehnt fest; das Protokoll nennt die Bestimmung. Sonst nach dem
 *    Gesetz, Einwand im Protokoll, Vollzug eines angenommenen Antrags erst nach
 *    der Frist, ausser er erreicht auch die Bestimmung (`einwandImSaal`, `EINWAND_VOLLZUG`).
 *  - Die Wahl, eine Bestimmung zu hinterlegen, gilt auch für eine, deren
 *    Einführung sich nicht feststellen lässt, mit dem sichereren Weg je
 *    Richtung (`FOLGE_DER_WAHL_UNKLAR`; R6-F-2, R9-L-3).
 *  - Die Absage an der erweiterten Bewirtschaftung, wo eine Regel für Organe
 *    oder Wahlen hinterlegt ist, nennt denselben Weg (R7-F-8).
 *
 * **Kein Ergebnis ändert sich.** Votum rechnet weiter nach dem Gesetz; dass
 * eine eingewendete Bestimmung den Antrag scheitern lässt, hält die Leitung
 * fest, nicht die Auszählung (`tests/domain/fassung-2026-11-11.test.ts`).
 */
import type { Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_10 } from './quorum-2026-11-10';

export const REGELWERK_2026_11_11 = {
	...REGELWERK_2026_11_10,
	fassung: '2026-11-11',
	freigabevermerk:
		REGELWERK_2026_11_10.freigabevermerk +
		' In der Fassung 2026-11-11 sagt der Kasten zum Reglement, wie die Leitung eine im Saal ' +
		'eingewendete strengere Bestimmung einhält; am Ergebnis ändert sich nichts.'
} satisfies Regelwerk;
