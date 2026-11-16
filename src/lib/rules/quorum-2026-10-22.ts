/**
 * Fassung 2026-10-22: Rechtssätze an zwei gesperrten Karten.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert kein Erfordernis und keinen
 * Weg. Sie gibt `k-zirkularbeschluss` und `k-sonderrecht-abgrenzen` einen
 * eigenen Rechtssatz (`reglementsrecht`); ohne ihn stand im Reglementskasten
 * «Dieses Erfordernis ist zwingendes Recht … wäre unbeachtlich».
 *
 * **Der Anlass** ist die Pendenz vom 18.10.2026 («Zwingendes Recht» im
 * Reglementskasten gesperrter Knoten ohne Rechtssatz) und die Fachprüfung vom
 * 20.10.2026: Am Zirkularbeschluss stellte der Satz eine Streitfrage als
 * geklärt dar und widersprach dem Hinweis derselben Karte (Urabstimmung,
 * Rz. 131 bis 135 ad Art. 712m). An der Abgrenzung des Sonderrechts trug er,
 * sagte aber nicht, warum eine Mehrheitsregel nach Art. 648 Abs. 2 hier nicht
 * greift, obwohl `k-reglement-andere-ordnung` (Fassung 2026-10-19) eine solche
 * Regel zulässt. `k-vorkaufsrecht` und `k-reglement-quoren` bleiben beim Satz
 * «zwingendes Recht»; er trägt dort (Rz. 23, 27 ad Art. 712c; Rz. 78, 78a ad
 * Art. 712g).
 *
 * **Geprüft** in vier Runden Laien- und Fachprüfung, ab Runde 3 am ganzen Kasten mit dem Rahmen aus `reglementssatz` (`quellen`
 * `pruefung/berichte/2026-10-20-votum-rechtssatz-zirkular-sonderrecht.md`).
 */
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_21 } from './quorum-2026-10-21';

export const ZIRKULAR_RECHTSSATZ =
	'Ohne Versammlung ist ein Beschluss sicher, wenn alle Eigentümer schriftlich zustimmen ' +
	'(Art. 66 Abs. 2 i.V.m. Art. 712m Abs. 2 ZGB). Ob ein Reglement stattdessen eine schriftliche ' +
	'Mehrheitsabstimmung ohne Versammlung (Urabstimmung) vorsehen darf, ist umstritten. Die ' +
	'meisten Fachleute lassen es mit Einschränkungen zu, der SVIT-Kommentar lehnt es ab, das ' +
	'Bundesgericht hat es ' +
	'offengelassen. Ein Mehrheitsbeschluss auf diesem Weg ist deshalb unsicher (Wermelinger, ' +
	'SVIT-Kommentar 2023, Art. 712m Rz. 125, 131, 135).';

export const SONDERRECHT_RECHTSSATZ =
	'Ob ein Teil gemeinschaftlich ist oder zum Sonderrecht gehört, ändert nur eine öffentlich ' +
	'beurkundete Vereinbarung aller (Art. 648 Abs. 2, 712b Abs. 3 ZGB; Wermelinger, ' +
	'SVIT-Kommentar 2023, Art. 712b Rz. 12, 12a). Ein Beschluss der Versammlung allein genügt ' +
	'nicht, auch nicht nach einer Mehrheitsregel in Reglement oder Begründungsakt (SVIT-Kommentar, ' +
	'Art. 712g Rz. 56, 58). Ein Umbau, der nichts daran ändert, wem der Teil gehört, fällt nicht ' +
	'darunter.';

const RECHTSSATZ: Record<string, string> = {
	'k-zirkularbeschluss': ZIRKULAR_RECHTSSATZ,
	'k-sonderrecht-abgrenzen': SONDERRECHT_RECHTSSATZ,
};

for (const id of Object.keys(RECHTSSATZ)) {
	const k = REGELWERK_2026_10_21.knoten.find((x) => x.id === id);
	if (!k)
		throw new Error(`Fassung 2026-10-22: «${id}» fehlt in der Vorfassung.`);
	if (k.reglementsrecht)
		throw new Error(
			`Fassung 2026-10-22: «${id}» trägt schon einen Rechtssatz.`,
		);
	if (k.reglementsverhalten !== 'gesperrt_zwingend') {
		throw new Error(`Fassung 2026-10-22: «${id}» ist nicht mehr gesperrt.`);
	}
}

function mitRechtssatz(k: Ergebnisknoten): Ergebnisknoten {
	const satz = RECHTSSATZ[k.id];
	return satz ? { ...k, reglementsrecht: satz } : k;
}

export const REGELWERK_2026_10_22 = {
	...REGELWERK_2026_10_21,
	fassung: '2026-10-22',

	knoten: REGELWERK_2026_10_21.knoten.map(mitRechtssatz),

	freigabevermerk:
		REGELWERK_2026_10_21.freigabevermerk +
		' In der Fassung 2026-10-22 sagen die Karten zum Zirkularbeschluss und zur Abgrenzung des ' +
		'Sonderrechts im Reglementskasten, was gilt, statt «zwingendes Recht».',
} satisfies Regelwerk;
