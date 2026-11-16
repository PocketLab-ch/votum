/**
 * Gemeinsame Grundlage der Datenbanktests.
 *
 * Diese Tests laufen bewusst unter der **Anwendungsrolle** `versammlung_app`,
 * nicht unter der privilegierten Rolle. Der Grund wiegt schwer: Ein Superuser
 * umgeht den Zeilenschutz immer — auch bei `FORCE ROW LEVEL SECURITY` — und
 * ignoriert entzogene Rechte. Ein Test unter der falschen Rolle würde jede
 * Schutzregel bestätigen, ohne dass eine davon wirkt. Genau das ist in einem
 * Vorgängerprojekt geschehen und blieb lange unbemerkt.
 *
 * Die privilegierte Verbindung gibt es hier nur zum Anlegen der Prüfdaten, nie
 * zum Prüfen einer Regel. Aufgeräumt wird nicht — die ganze Prüfdatenbank wird
 * am Ende des Laufs verworfen (siehe `aufbau.ts`).
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { appUrl, migrationsUrl } from './urls';

/** Verbindung mit den Rechten der Anwendung. Alles, was eine Regel prüft, läuft hierüber. */
export const app = postgres(appUrl(), { max: 2, onnotice: () => {} });

/** Privilegierte Verbindung. Nur für den Aufbau der Prüfdaten. */
export const admin = postgres(migrationsUrl(), { max: 2, onnotice: () => {} });

export async function verbindungenSchliessen(): Promise<void> {
	await Promise.all([app.end(), admin.end()]);
}

/** Legt einen Betreiber für einen Prüflauf an und gibt seine Kennung zurück. */
export async function pruefbetreiber(bezeichnung: string): Promise<string> {
	const [zeile] = await admin<{ id: string }[]>`
		INSERT INTO operator (name) VALUES (${bezeichnung}) RETURNING id
	`;
	return zeile.id;
}

/**
 * Ein angemeldeter Benutzer für Prüfläufe, die einen brauchen.
 *
 * Manche Angaben haben ohne benannte Person keinen Wert: Eine von der
 * Sitzungsleitung erfasste Stimme trägt den Vermerk «wurde so erfasst», und der
 * ist ohne Namen wertlos. Die Datenbank verlangt ihn deshalb — und ein Prüflauf
 * mit `userId: null` kommt an dieser Stelle nicht durch, was richtig ist.
 */
export async function pruefbenutzer(operatorId: string, name: string): Promise<string> {
	// Der Benutzername bekommt einen Anhang, der Anzeigename nicht. Namen sind
	// über alle Betreiber eindeutig (Migration 155), und die Prüfdateien legen
	// bei jedem ihrer Betreiber gern dasselbe «Prüflauf» an.
	const benutzername = `${name}-${randomUUID().slice(0, 8)}`;
	const [zeile] = await admin<{ id: string }[]>`
		INSERT INTO app_user (operator_id, username, display_name, password_hash)
		VALUES (${operatorId}, ${benutzername}, ${name}, 'x')
		RETURNING id
	`;
	return zeile.id;
}

/**
 * Führt Arbeit unter der Anwendungsrolle im Kontext eines Betreibers aus.
 *
 * `SET LOCAL` endet mit dem Commit. Wer danach abfragt, bekommt keine Fehlermeldung,
 * sondern eine leere Menge — deshalb muss alles innerhalb dieser Transaktion liegen.
 */
export function imKontext<T>(
	operatorId: string,
	arbeit: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
	return app.begin(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${operatorId}, true)`;
		return arbeit(tx);
	}) as Promise<T>;
}

/** Wie `imKontext`, aber ohne gesetzten Mandanten — für die Gegenprobe. */
export function ohneKontext<T>(arbeit: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
	return app.begin((tx) => arbeit(tx)) as Promise<T>;
}
