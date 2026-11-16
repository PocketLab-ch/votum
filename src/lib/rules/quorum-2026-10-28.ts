/**
 * Fassung 2026-10-28: Die Einsprache zählt nach der Lesart L3 der Gemeinschaft.
 *
 * **Daten, kein Code** (AD-4), bis auf die Rechnung selbst: Sie hängt an der
 * Fassung (`zaehlweiseFuer` und `EINSPRACHE_ZAEHLWEISE_AB` in
 * `entscheidbaum.ts`), wie 1e ab 2026-10-25 und die gemeinsame Wohnung des
 * Beklagten ab 2026-10-11. Diese Fassung ändert ein Ergebnis.
 *
 * **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft), Block 5. Der
 * Knoten `k-einsprache` behält Kennung und Mehr; geändert wird allein die
 * Zählung: In einer Gemeinschaft je Einheit zählt die Einsprache ab hier nach
 * der Wahl L3 (Vorgabe eine Stimme je Eigentümer, Rz. 181 ad Art. 712m; wählbar
 * die Zählung je Einheit aus dem Reglement, Rz. 185 ad Art. 712c mit Rz. 186 ad
 * Art. 712m), und das Ergebnis nach der anderen Zählweise steht daneben. Alte
 * Traktanden rechnen weiter nach ihrer Fassung, also je Einheit mit dem
 * bisherigen Hinweis.
 *
 * Am Knoten selbst ändert diese Fassung nichts: Die Zählweise trägt kein
 * Merkmal des Knotens, sondern die Fassungskennung am Erfordernis. Ein neuer
 * Fall entsteht nicht, und kein bestehender Knoten rechnet anders; die
 * Neuherleitung über die Knotenkennung findet unter dieser Fassung dasselbe und
 * meldet eine Einsprache nicht als älteres Erfordernis.
 */
import type { Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_27 } from './quorum-2026-10-27';

export const REGELWERK_2026_10_28 = {
	...REGELWERK_2026_10_27,
	fassung: '2026-10-28',

	freigabevermerk:
		REGELWERK_2026_10_27.freigabevermerk +
		' In der Fassung 2026-10-28 zählt die Einsprache in einer Gemeinschaft je Einheit nach der ' +
		'Lesart L3 der Gemeinschaft: nach der Vorgabe eine Stimme je Eigentümer, daneben das Ergebnis ' +
		'nach der Zählung je Einheit.'
} satisfies Regelwerk;
