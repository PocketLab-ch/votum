import stylelint from 'stylelint';

const { createPlugin, utils } = stylelint;

export const ruleName = 'versammlung/dreieck-am-summary';

export const messages = utils.ruleMessages(ruleName, {
	genommen: (selektor, wert) =>
		`«${selektor}» setzt display: ${wert}. Das nimmt dem <summary> sein Dreieck — ` +
		'der Ausklapper sieht aus wie ein Satz und wird nicht angeklickt. ' +
		'Für die Fingergrösse: min-height: var(--ziel-min) und padding, nicht Flex.'
});

/**
 * Erlaubt ist nur, was dem Element seinen Listenpunkt lässt.
 *
 * `list-item` ist der Normalwert; `revert` und `unset` geben ihn zurück. Alles
 * andere — auch das harmlos wirkende `block` — nimmt das Dreieck.
 */
const UNBEDENKLICH = new Set(['list-item', 'revert', 'revert-layer', 'unset', 'inherit']);

/**
 * Trifft die Regel das `<summary>` selbst?
 *
 * Nur dann zählt sie. `summary::marker` gestaltet den Punkt (erwünscht),
 * `summary > span` ein Kind — beide enden nicht auf `summary`.
 */
function trifftSummary(selektor) {
	return selektor
		.split(',')
		.map((s) => s.trim())
		.some((s) => /(^|[\s>+~])summary$/.test(s));
}

/**
 * Das Dreieck am `<summary>` — als Stylelint-Regel statt als Regex über die Datei.
 *
 * **Der Anlass, am 22.08.2026.** `docs/gestaltung.md` beschreibt die Falle seit
 * Monaten: `display: flex` auf einem `<summary>` nimmt ihm sein Dreieck. Der
 * Satz sieht dann aus wie ein Satz, und niemand klappt ihn auf. Dokumentiert
 * war sie — geschlossen nicht: Fünf Ausklapper trugen sie weiterhin.
 *
 * **Warum jetzt als Regel und nicht mehr als Skript** (24.08.2026, auf die
 * Frage des Auftraggebers «sind Wächter state of the art oder Flickwerk?»). Die erste Fassung las
 * die Datei mit einem regulären Ausdruck `([^{}]+)\{([^{}]*)\}`. Der kann
 * nicht zwischen Code und Kommentar unterscheiden, stolpert über verschachtelte
 * Regeln (`@media`, `:has()`) und sieht eine über zwei Zeilen geschriebene
 * Deklaration nicht. Stylelint bringt einen echten CSS-Baum mit — dieselbe
 * Regel, ohne die blinden Stellen, und mit Datei, Zeile und Spalte.
 *
 * **`summary` ist von Haus aus `display: list-item`** — daher das ▶. Jede
 * andere Angabe überschreibt das **ohne Meldung**: Der Ausklapper funktioniert
 * weiter, er sieht nur nicht mehr wie einer aus. Im Browser gemessen
 * (Chromium): `display: flex` → kein `::marker`, Höhe 44 px; `padding: 0.7rem 0`
 * → Dreieck da, Höhe 45 px.
 */
const regel = () => (wurzel, ergebnis) => {
	wurzel.walkRules((r) => {
		if (!trifftSummary(r.selector)) return;
		r.walkDecls('display', (d) => {
			const wert = d.value.trim().toLowerCase();
			if (UNBEDENKLICH.has(wert)) return;
			utils.report({
				ruleName,
				result: ergebnis,
				node: d,
				message: messages.genommen(r.selector.replace(/\s+/g, ' '), wert)
			});
		});
	});
};

regel.ruleName = ruleName;
regel.messages = messages;

export default createPlugin(ruleName, regel);
