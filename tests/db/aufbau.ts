/**
 * Legt für jeden Testlauf eine frische Datenbank an und wirft sie danach weg.
 *
 * Der Grund ist nicht Bequemlichkeit, sondern eine Zusage, die wir uns selbst
 * gegeben haben: Der Verlauf ist nur anfügbar (AD-5). Prüfdaten liessen sich
 * daraus nicht mehr entfernen, ohne genau den Schutz auszuhebeln, den die Tests
 * belegen sollen. Eine eigene Datenbank je Lauf löst das, ohne irgendwo eine
 * Hintertür zu öffnen — und hält die Entwicklungsdatenbank frei von Prüfdaten,
 * die sonst neben den Demo-Gemeinschaften stünden.
 *
 * Nebenwirkung mit eigenem Wert: Die Migrationskette läuft bei jedem Testlauf
 * einmal von Null durch. Eine Migration, die nur auf einer gewachsenen Datenbank
 * funktioniert, fällt damit sofort auf.
 */
import postgres from 'postgres';
import { migriere } from '../../src/lib/server/migrate';
import { PRUEFDATENBANK, migrationsUrl, wartungsUrl } from './urls';

export async function setup(): Promise<void> {
	const wartung = postgres(wartungsUrl(), { max: 1, onnotice: () => {} });
	try {
		// FORCE trennt hängende Verbindungen eines abgebrochenen Vorlaufs.
		await wartung.unsafe(`DROP DATABASE IF EXISTS ${PRUEFDATENBANK} WITH (FORCE)`);
		await wartung.unsafe(`CREATE DATABASE ${PRUEFDATENBANK}`);
	} finally {
		await wartung.end();
	}

	await migriere(migrationsUrl());
}

/**
 * **Verwaiste Datenbanken werden NICHT automatisch weggeräumt** — und das ist
 * eine Entscheidung, keine Lücke.
 *
 * Bricht ein Lauf hart ab, bleibt seine Datenbank stehen. Verlockend wäre, beim
 * Aufbau alle `versammlung_pruefung_*` ohne offene Verbindung wegzuwerfen. Genau
 * das wäre der Fehler, den diese Datei seit dem 20.08.2026 verhindern soll:
 * Zwischen dem Anlegen und der ersten Verbindung hat auch ein **fremder,
 * laufender** Prüflauf für einen Moment keine Verbindung — und bekäme seine
 * Datenbank unter den Füssen weggezogen. Die Symptome sähen aus wie zufällige
 * Fehler in fremden Dateien; genau daran sind am selben Tag zwei Commits
 * gescheitert.
 *
 * Aufräumen ist deshalb Handarbeit, auf Ansage:
 *
 * ```sql
 * SELECT datname FROM pg_database WHERE datname LIKE 'versammlung_pruefung%';
 * DROP DATABASE versammlung_pruefung_12345 WITH (FORCE);
 * ```
 *
 * Eine leere Datenbank kostet fast nichts; ein weggezogener Prüflauf kostet
 * eine halbe Stunde Suche.
 */
export async function teardown(): Promise<void> {
	const wartung = postgres(wartungsUrl(), { max: 1, onnotice: () => {} });
	try {
		await wartung.unsafe(`DROP DATABASE IF EXISTS ${PRUEFDATENBANK} WITH (FORCE)`);
	} finally {
		await wartung.end();
	}
}
