/**
 * Migrationen: nummerierte SQL-Dateien, aufwärtsgerichtet, beim Start ausgeführt.
 *
 * Läuft unter einer eigenen Rolle mit BYPASSRLS, weil der Zeilenschutz sonst die
 * Migration selbst behindern würde (AD-6). Eine bereits ausgeführte Migration
 * wird nie wiederholt und nie verändert — wer etwas ändern will, schreibt eine
 * neue (AD-14).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import postgres from 'postgres';

const VERZEICHNIS = join(process.cwd(), 'migrations');

export async function migriere(verbindungszeichenkette?: string): Promise<void> {
	const url =
		verbindungszeichenkette ??
		process.env.DATABASE_MIGRATION_URL ??
		process.env.DATABASE_URL ??
		'postgres://versammlung@localhost:5432/versammlung';

	const sql = postgres(url, { max: 1 });

	try {
		await sql`
			CREATE TABLE IF NOT EXISTS schema_migration (
				name        text PRIMARY KEY,
				checksum    text NOT NULL,
				applied_at  timestamptz NOT NULL DEFAULT now()
			)
		`;

		const dateien = readdirSync(VERZEICHNIS)
			.filter((d: string) => d.endsWith('.sql'))
			.sort();

		const bereitsAusgefuehrt = new Map(
			(await sql<{ name: string; checksum: string }[]>`SELECT name, checksum FROM schema_migration`).map(
				(z) => [z.name, z.checksum]
			)
		);

		for (const datei of dateien) {
			const inhalt = readFileSync(join(VERZEICHNIS, datei), 'utf8');
			const pruefsumme = createHash('sha256').update(inhalt).digest('hex');
			const fruehere = bereitsAusgefuehrt.get(datei);

			if (fruehere) {
				// Eine nachträglich geänderte Migration ist ein Fehler, kein Auftrag:
				// Auf einer anderen Datenbank ist die alte Fassung längst gelaufen.
				if (fruehere !== pruefsumme) {
					throw new Error(
						`Migration ${datei} wurde nach dem Ausführen verändert. ` +
							`Änderungen gehören in eine neue Migration (AD-14).`
					);
				}
				continue;
			}

			// Jede Migration in einer eigenen Transaktion: Bricht eine ab, bleiben
			// die vorherigen gültig und der Zustand ist eindeutig.
			await sql.begin(async (tx) => {
				await tx.unsafe(inhalt);
				await tx`INSERT INTO schema_migration (name, checksum) VALUES (${datei}, ${pruefsumme})`;
			});

			console.log(`Migration ausgeführt: ${datei}`);
		}

		await setzeAnwendungskennwort(sql);
	} finally {
		await sql.end();
	}
}

/**
 * Setzt das Kennwort der Anwendungsrolle aus `APP_DB_PASSWORD`.
 *
 * Migration 002 legt `versammlung_app` mit LOGIN an, aber ohne Kennwort — eine
 * Migrationsdatei darf keines enthalten, sie liegt im Repository. Ohne diesen
 * Schritt scheitert eine frische Installation beim ersten Verbindungsaufbau der
 * Anwendung an `password authentication failed`, und zwar nach erfolgreicher
 * Migration, was die Ursache verdeckt.
 *
 * **Nur wenn die Variable gesetzt ist.** Ein Migrationslauf ohne sie darf ein
 * bestehendes Kennwort nicht überschreiben: Sonst sperrt ein Wartungsaufruf von
 * Hand die laufende Anwendung aus, und der Zusammenhang ist von aussen nicht zu
 * sehen.
 */
async function setzeAnwendungskennwort(sql: ReturnType<typeof postgres>): Promise<void> {
	const kennwort = process.env.APP_DB_PASSWORD;
	if (!kennwort) return;

	const [rolle] = await sql<{ rolname: string }[]>`
		SELECT rolname FROM pg_roles WHERE rolname = 'versammlung_app'
	`;
	if (!rolle) return;

	// `ALTER ROLE` ist eine Verwaltungsanweisung und nimmt keine Parameter
	// entgegen — `PASSWORD $1` scheitert am Syntaxfehler. Das Kennwort muss
	// deshalb als Literal im Anweisungstext stehen. Gequotet wird es von
	// PostgreSQL selbst über `format('%L', …)`, nicht von Hand: Ein Kennwort mit
	// Apostroph oder Gegenschrägstrich bräche sonst die Anweisung auf.
	const [{ anweisung }] = await sql<{ anweisung: string }[]>`
		SELECT format('ALTER ROLE versammlung_app PASSWORD %L', ${kennwort}::text) AS anweisung
	`;
	await sql.unsafe(anweisung);
	console.log('Kennwort der Anwendungsrolle gesetzt.');
}

// Direktaufruf über `npm run migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
	migriere()
		.then(() => {
			console.log('Migrationen abgeschlossen.');
			// Neue Spalten an einer Tabelle, die per `SELECT *` gelesen wird,
			// brechen die bestehenden Verbindungen mit «cached plan must not change
			// result type» — vorbereitete Anweisungen kennen die alte Spaltenliste.
			// Im Betrieb harmlos, weil die Migration beim Start läuft; im
			// Entwicklungsbetrieb sieht es nach einem Anwendungsfehler aus (500 auf
			// einer beliebigen Seite). Deshalb der Hinweis, nicht der Hinterhalt.
			console.log(
				'Hinweis: Laufende Anwendungen neu starten — sonst melden sie ' +
					'«cached plan must not change result type».'
			);
			process.exit(0);
		})
		.catch((fehler) => {
			console.error('Migration fehlgeschlagen:', fehler.message);
			process.exit(1);
		});
}
