/**
 * Legt einen Betreiber und ein Benutzerkonto an.
 *
 * Nötig, weil ohne Konto niemand hineinkommt und die Anwendung selbst keine
 * Selbstregistrierung kennt — es gibt genau einen Betreiber, und wer Zugang
 * bekommt, entscheidet die Bewirtschaftung.
 *
 * Läuft unter der privilegierten Rolle, weil das Anlegen des ersten Betreibers
 * dem Zeilenschutz vorausgeht.
 *
 * Aufruf:
 *   node scripts/benutzer-anlegen.mjs <benutzername> <anzeigename> [rolle]
 *
 * Das Kennwort kommt über die Umgebungsvariable VERSAMMLUNG_PASSWORT oder über
 * die **Standardeingabe** — nie als Argument, damit es nicht in der
 * Prozessliste und in der Verlaufsdatei der Shell steht.
 *
 * **Warum die Standardeingabe dazukam** (11.09.2026, mit `scripts/einrichten.sh`).
 * Die Umgebungsvariable ist sicher, solange sie im aufrufenden Prozess gesetzt
 * wird. Beim Weg über Docker ist sie es nicht: `docker compose exec -e
 * VERSAMMLUNG_PASSWORT="…"` stellt den Wert in die Argumentliste des
 * **docker**-Prozesses, und der steht in der Prozessliste des Wirts. Die
 * Hausregel in `CLAUDE.md` des Arbeitsverzeichnisses sagt dazu: «Secrets nie als
 * Kommandozeilen-Argument … Über Datei oder eine bereits gesetzte Variable.»
 *
 * Über ein Rohr gelesen, steht das Kennwort nirgends ausser im Speicher der
 * beiden beteiligten Prozesse:
 *
 *   printf '%s' "$kennwort" | docker compose exec -T app \
 *     node scripts/benutzer-anlegen.mjs muster 'Max Probère' admin
 */
import postgres from 'postgres';
import argon2 from 'argon2';

const [, , username, displayName, rolle = 'admin'] = process.argv;

/**
 * Liest das Kennwort von der Standardeingabe, wenn dort etwas anliegt.
 *
 * `isTTY` unterscheidet die beiden Fälle: Hängt ein Rohr daran, ist es
 * `undefined`, und das Lesen endet mit dem Ende des Rohrs. Auf einem Terminal
 * bliebe es stehen und der Aufruf hinge — deshalb wird dort gar nicht gelesen.
 *
 * Der abschliessende Zeilenumbruch fällt weg: `echo` hängt einen an, und ein
 * Kennwort mit unsichtbarem Zeilenumbruch am Ende meldet sich später als
 * «falsches Kennwort».
 */
async function ausDerEingabe() {
	if (process.stdin.isTTY) return null;
	let roh = '';
	process.stdin.setEncoding('utf8');
	for await (const stueck of process.stdin) roh += stueck;
	const sauber = roh.replace(/\r?\n$/, '');
	return sauber.length > 0 ? sauber : null;
}

// `||` und nicht `??` (aus dem Code-Review, 11.09.2026): `??` fällt nur bei
// `undefined` zurück. Eine gesetzte, aber **leere** Variable verdeckte sonst die
// Standardeingabe — das gepipte Kennwort würde nie gelesen, und die Meldung
// spräche von einer Variablen, die der Aufrufer gar nicht gesetzt zu haben
// glaubt.
const kennwort = process.env.VERSAMMLUNG_PASSWORT || (await ausDerEingabe());
const betreiberName = process.env.VERSAMMLUNG_BETREIBER ?? 'Bewirtschaftung';

if (!username || !displayName) {
	console.error(
		'Aufruf: node scripts/benutzer-anlegen.mjs <benutzername> <anzeigename> [admin|chair]\n' +
			'Kennwort über VERSAMMLUNG_PASSWORT setzen.'
	);
	process.exit(1);
}

// `[...kennwort].length` und nicht `.length`: Dieselbe Zählung wie in
// `src/lib/domain/kennwort.ts` (dort als `zeichenzahl()`), die von hier aus
// nicht einbindbar ist — ein reines Node-Skript kennt `$lib` nicht.
if (!kennwort || [...kennwort].length < 12) {
	console.error(
		'Kennwort fehlt oder ist kürzer als 12 Zeichen.\n' +
			'Über VERSAMMLUNG_PASSWORT setzen oder über ein Rohr auf die Standardeingabe geben.'
	);
	process.exit(1);
}

if (!['admin', 'chair'].includes(rolle)) {
	console.error(`Unbekannte Rolle: ${rolle}. Erlaubt sind admin und chair.`);
	process.exit(1);
}

/*
 * **Nur die privilegierte Verbindung, kein Rückfall auf die der Anwendung.**
 *
 * Bis zum 08.08.2026 fiel dieses Skript still auf `DATABASE_URL` zurück. Seit
 * `operator` Zeilenschutz trägt (Migration 055), ist das eine Falle: Die
 * Anwendungsrolle darf dort weder anlegen noch — ohne gesetzten Mandanten —
 * überhaupt etwas sehen. Der Aufruf endete dann nicht mit einer verständlichen
 * Meldung, sondern mit «permission denied» oder einem Absturz auf einer leeren
 * Zeile. Ein Aufsetzskript, das scheitert, soll sagen warum.
 */
const url =
	process.env.DATABASE_MIGRATION_URL ?? 'postgres://versammlung@localhost:5434/versammlung';

if (process.env.DATABASE_MIGRATION_URL === undefined && process.env.DATABASE_URL) {
	console.error(
		'DATABASE_MIGRATION_URL ist nicht gesetzt. Dieses Skript legt Betreiber und Konten an und\n' +
			'braucht dafür die privilegierte Verbindung — die Anwendungsrolle darf das seit Migration\n' +
			'055 nicht mehr. Setzen Sie DATABASE_MIGRATION_URL (siehe docs/installation.md).'
	);
	process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
	const hash = await argon2.hash(kennwort, {
		type: argon2.argon2id,
		memoryCost: 65536,
		timeCost: 3,
		parallelism: 1
	});

	const [betreiber] = await sql`
		INSERT INTO operator (name)
		SELECT ${betreiberName}
		WHERE NOT EXISTS (SELECT 1 FROM operator)
		RETURNING id, name
	`;

	const [aktiv] = betreiber
		? [betreiber]
		: await sql`SELECT id, name FROM operator ORDER BY created_at LIMIT 1`;

	const [benutzer] = await sql`
		INSERT INTO app_user (operator_id, username, password_hash, display_name, role)
		VALUES (${aktiv.id}, ${username}, ${hash}, ${displayName}, ${rolle})
		ON CONFLICT (operator_id, username) DO UPDATE
			SET password_hash = EXCLUDED.password_hash,
			    display_name  = EXCLUDED.display_name,
			    role          = EXCLUDED.role,
			    disabled_at   = NULL
		RETURNING id, username, role
	`;

	await sql`
		INSERT INTO audit_entry (operator_id, actor_label, event_type, subject_type, subject_id, detail)
		VALUES (${aktiv.id}, 'setup-script', 'user.provisioned', 'app_user', ${benutzer.id},
		        ${sql.json({ username: benutzer.username, role: benutzer.role })})
	`;

	console.log(`Betreiber: ${aktiv.name}`);
	console.log(`Konto:     ${benutzer.username} (${benutzer.role})`);
} catch (fehler) {
	// Den Namen gibt es bei einem anderen Betreiber, oder in anderer
	// Schreibweise beim selben (Migration 155). `ON CONFLICT` oben greift nur
	// für genau diesen Betreiber und genau diese Schreibweise, und das mit
	// Absicht: Sonst überschriebe das Skript ein fremdes Konto.
	if (fehler.code === '23505' && fehler.constraint_name === 'app_user_benutzername_eindeutig') {
		console.error(
			`Den Benutzernamen «${username}» gibt es bereits, bei einem anderen Betreiber oder in\n` +
				'anderer Gross- und Kleinschreibung. Ein Benutzername gehört genau einem Konto;\n' +
				'bitte einen anderen wählen.'
		);
	} else {
		console.error('Fehlgeschlagen:', fehler.message);
	}
	process.exitCode = 1;
} finally {
	await sql.end();
}
