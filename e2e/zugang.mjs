/**
 * Zugang der Browserläufe aus der Umgebung, ohne Vorgabe.
 *
 * **Anlass:** Bis zum 15.11.2026 trug jedes Skript ein festes Vorgabe-Kennwort
 * für das Prüfkonto. Im öffentlichen Stand wäre das ein bekannter Zugang
 * (Sicherheitsprüfung des Codeberg-Stands). Jetzt bricht ein Lauf ohne
 * `KENNWORT` ab und sagt, was fehlt; das Kennwort kommt aus der Umgebung.
 *
 * @param {string} name Name der Umgebungsvariable, etwa `KENNWORT`
 * @returns {string}
 */
export function zugang(name) {
	const wert = process.env[name];
	if (!wert) {
		console.error(`${name} fehlt: Das Kennwort des Prüfkontos kommt aus der Umgebung, ohne Vorgabe (README, Abschnitt «Tests»).`);
		process.exit(2);
	}
	return wert;
}
