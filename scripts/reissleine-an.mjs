/**
 * Erster Schritt von `npm run pruefen`: Die Reissleinen dürfen nicht
 * abgeschaltet sein.
 *
 * Der Ausschalter `VERSAMMLUNG_REISSLEINE=aus` ist für Gegentests da, die gegen
 * Wegwerfbäume mit einer Handvoll Dateien fahren. Sie setzen ihn je
 * Kindprozess. Steht er dagegen in der Sitzung — ein vergessenes `export`, eine
 * Zeile in einer Profildatei —, dann liefe der ganze Prüflauf mit
 * abgeschalteten Reissleinen und meldete «in Ordnung», auch wenn kein einziger
 * Wächter noch etwas zu lesen bekäme (04.09.2026).
 *
 * Ein Hinweis aus `lib/pruefmenge.mjs` selbst taugt dafür nicht: Er käme aus
 * jedem der rund siebzig Testprozesse und wäre Dauerrauschen. Hier läuft er
 * einmal, an der Stelle, an der es zählt.
 */
const wert = process.env.VERSAMMLUNG_REISSLEINE;
if (wert !== undefined) {
	console.error(
		`\nVERSAMMLUNG_REISSLEINE ist in dieser Sitzung gesetzt («${wert}»).\n\n` +
			'Der Prüflauf liefe damit mit abgeschalteten Reissleinen: Jeder Wächter,\n' +
			'der seine Prüfmenge verloren hat, meldete «in Ordnung». Der Ausschalter\n' +
			'gehört in den einzelnen Gegentest, nicht in die Sitzung.\n\n' +
			'  unset VERSAMMLUNG_REISSLEINE\n'
	);
	process.exit(1);
}
