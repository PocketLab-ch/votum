/**
 * Ersatz für `$env/dynamic/private` in den Datenbanktests.
 *
 * SvelteKit stellt diesen Namensraum zur Laufzeit bereit; ausserhalb davon ist
 * er nicht auflösbar. Der Ersatz reicht die Umgebung durch — mit einer
 * entscheidenden Ausnahme: `DATABASE_URL` zeigt zwingend auf die Prüfdatenbank.
 *
 * Ohne diese Umlenkung liefen die Tests gegen die Entwicklungsdatenbank. Sie
 * würden dort Prüfdaten hinterlassen, die sich aus dem nur anfügbaren Verlauf
 * nicht mehr entfernen liessen, und sie würden neben den Demo-Gemeinschaften
 * stehen, mit denen gearbeitet wird.
 */
import { appUrl } from './urls';

export const env: Record<string, string | undefined> = {
	...process.env,
	DATABASE_URL: appUrl()
};
