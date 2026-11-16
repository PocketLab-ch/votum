/**
 * Verbindungszeichenketten der Tests, aus der Umgebung abgeleitet.
 *
 * Getrennt von `helfer.ts`, weil der Aufbau in einem eigenen Prozess läuft und
 * beide Seiten unabhängig voneinander auf denselben Namen kommen müssen.
 */

// Eine bereits gesetzte Umgebung hat Vorrang: Sonst würde die für den Host
// gedachte .env im Container die richtigen Werte überschreiben, und die Tests
// liefen gegen einen Rechnernamen, den es dort nicht gibt.
if (!process.env.DATABASE_URL) {
	try {
		process.loadEnvFile();
	} catch {
		// Ohne .env gelten die Voreinstellungen unten.
	}
}

/**
 * Der Name der Prüfdatenbank — **je Lauf ein eigener**.
 *
 * **Der Anlass (20.08.2026).** Zwei Sitzungen arbeiteten gleichzeitig am Repo,
 * und beide Prüfläufe griffen auf denselben Namen zu: Der eine warf die
 * Datenbank weg, während der andere sie benutzte. Das Symptom sieht nach allem
 * Möglichen aus, nur nicht nach der Ursache — «database "versammlung_pruefung"
 * does not exist» und «write CONNECTION_CLOSED» in Dateien, die mit der eigenen
 * Änderung nichts zu tun haben. Zwei Commits scheiterten daran, und beide Male
 * suchte jemand den Fehler bei sich.
 *
 * **Warum über die Umgebung und nicht über einen Zufallswert hier.** Der Aufbau
 * (`globalSetup`) läuft in einem eigenen Prozess; ein hier gewürfelter Name
 * wäre in den Testprozessen ein anderer. Die Umgebung erben beide vom selben
 * Aufrufer: `package.json` setzt sie aus der Shell-PID, sofern sie nicht
 * schon gesetzt ist (`scripts/pruefen.sh` setzt je Lauf einen eigenen Namen).
 *
 * Ohne gesetzte Variable bleibt es beim alten Namen: Wer `vitest` von Hand
 * aufruft, soll nicht erst etwas setzen müssen.
 */
export const PRUEFDATENBANK = process.env.VERSAMMLUNG_PRUEFDB ?? 'versammlung_pruefung';

// Ein Datenbankname wandert unmaskiert in CREATE/DROP DATABASE (dort ist kein
// Platzhalter erlaubt). Was von aussen kommt, wird deshalb geprüft statt
// eingesetzt.
if (!/^[a-z][a-z0-9_]{0,62}$/.test(PRUEFDATENBANK)) {
	throw new Error(
		`Unzulässiger Name für die Prüfdatenbank: «${PRUEFDATENBANK}». ` +
			'Erlaubt sind Kleinbuchstaben, Ziffern und Unterstriche.'
	);
}

const APP =
	process.env.DATABASE_URL ?? 'postgres://versammlung_app:entwicklung@localhost:5434/versammlung';
const ADMIN =
	process.env.DATABASE_MIGRATION_URL ??
	'postgres://versammlung:entwicklung@localhost:5434/versammlung';

/** Tauscht den Datenbanknamen aus und lässt Rechner, Port und Zugangsdaten unberührt. */
function mitDatenbank(url: string, name: string): string {
	const zerlegt = new URL(url);
	zerlegt.pathname = `/${name}`;
	return zerlegt.toString();
}

/** Zugang der Anwendungsrolle zur Prüfdatenbank. */
export function appUrl(): string {
	return mitDatenbank(APP, PRUEFDATENBANK);
}

/** Privilegierter Zugang zur Prüfdatenbank. Nur für Aufbau und Prüfdaten. */
export function migrationsUrl(): string {
	return mitDatenbank(ADMIN, PRUEFDATENBANK);
}

/**
 * Zugang zur Wartungsdatenbank `postgres`, weil man eine Datenbank nicht
 * anlegen oder löschen kann, während man mit ihr verbunden ist.
 */
export function wartungsUrl(): string {
	return mitDatenbank(ADMIN, 'postgres');
}
