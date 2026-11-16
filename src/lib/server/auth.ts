/**
 * Anmeldung, Sitzungen und Kennwortprüfung.
 *
 * Bewusst ohne äussere Dienste: Die lokale Anmeldung muss im Versammlungsraum
 * ohne Internet funktionieren (AD-9). Authentik kommt in Epic 4 als zusätzlicher
 * Weg dazu, nie als Voraussetzung.
 */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import argon2 from 'argon2';
import { sql } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Rolle } from '$lib/domain/rollen';
import {
	pruefeHerkunftssperre,
	pruefeSperre,
	SITZUNGSDAUER_SEKUNDEN,
	type Fehlversuch,
	type Namensversuch
} from '$lib/domain/anmeldeschutz';

export const SITZUNGS_COOKIE = 'versammlung_sitzung';

export interface AngemeldeterBenutzer {
	id: string;
	operatorId: string;
	username: string;
	displayName: string;
	role: Rolle;
}

/**
 * Argon2id mit bewusst gesetzten Werten statt der Vorgaben der Bibliothek.
 * 64 MiB und drei Durchgänge sind für eine Anmeldung an einem Notebook
 * vertretbar und machen das Durchprobieren teuer.
 */
const ARGON2_EINSTELLUNGEN = {
	type: argon2.argon2id,
	memoryCost: 65536,
	timeCost: 3,
	parallelism: 1
} as const;

export function kennwortAbleiten(kennwort: string): Promise<string> {
	return argon2.hash(kennwort, ARGON2_EINSTELLUNGEN);
}

/** Sitzungsmerkmal wird nur als Prüfwert gespeichert (NFR-5). */
export function merkmalPruefwert(merkmal: string): string {
	return createHash('sha256').update(merkmal).digest('hex');
}

export type AnmeldeErgebnis =
	| { art: 'erfolg'; benutzer: AngemeldeterBenutzer; sitzungsmerkmal: string }
	| { art: 'abgelehnt' }
	| { art: 'gesperrt'; verbleibendSekunden: number };

/**
 * Prüft Zugangsdaten und legt bei Erfolg eine Sitzung an.
 *
 * Die Antwort unterscheidet nie zwischen «Benutzer unbekannt» und «Kennwort
 * falsch»: Beides ist `abgelehnt`, sonst liesse sich herausfinden, welche
 * Benutzernamen es gibt. Bei unbekanntem Benutzer wird trotzdem eine Ableitung
 * gerechnet, damit die Antwortzeit nichts verrät.
 */
export async function anmelden(
	username: string,
	kennwort: string,
	jetzt: number = Date.now(),
	/**
	 * Woher der Versuch kommt — oder `null`, wenn keine verlässliche Adresse
	 * vorliegt. Siehe `herkunft()` in `hooks.server.ts`.
	 */
	herkunft: string | null = null
): Promise<AnmeldeErgebnis> {
	// Nur eine Adresse zählt als Herkunft. Die Spalte ist `inet`, und ein Wert aus
	// der Kopfzeile, an den kein Proxy etwas anhängte, scheiterte dort mit 22P02
	// als 500 (Codeprüfung zu B2, 16.10.2026). Ohne Adresse wird nicht nach
	// Herkunft gesperrt, wie unten; die Namenssperre bleibt. Eine IPv6-Adresse
	// mit Zone (`fe80::1%eth0`) nimmt `isIP` an, `inet` nicht.
	if (herkunft && (!isIP(herkunft) || herkunft.includes('%'))) herkunft = null;

	// Gezählt wird nach Namen, ohne Betreiber. Das trägt, weil ein Name genau
	// einem Konto gehört (Migration 155); vorher sperrten Fehlversuche am einen
	// Konto jedes gleichnamige bei einem anderen Betreiber (Befund D5).
	const versuche = await sql<{ attempted_at: Date }[]>`
		SELECT attempted_at
		FROM login_attempt
		WHERE username = ${username} AND succeeded = false
		  AND attempted_at > now() - interval '1 hour'
		ORDER BY attempted_at DESC
		LIMIT 50
	`;

	const alsFehlversuche: Fehlversuch[] = versuche.map((v) => ({
		zeitpunkt: v.attempted_at.getTime()
	}));

	const sperre = pruefeSperre(alsFehlversuche, jetzt);
	if (sperre.gesperrt) {
		return { art: 'gesperrt', verbleibendSekunden: sperre.verbleibendSekunden! };
	}

	/*
	 * **Die zweite Zählung: viele Namen von derselben Adresse.**
	 *
	 * Die Sperre oben bremst, wer ein Konto durchprobiert. Wer viele Namen je
	 * einmal versucht, läuft an ihr vorbei — jeder Name hat seinen eigenen
	 * Zähler. Gezählt werden hier deshalb **verschiedene Namen**, nicht
	 * Versuche: Im Saal sitzen Leitung, Beamergerät und Notebook hinter einer
	 * Adresse, und drei Vertipper dürfen die Versammlung nicht anhalten.
	 *
	 * Ohne verlässliche Adresse wird gar nicht nach Herkunft gesperrt.
	 */
	if (herkunft) {
		const vonDort = await sql<{ attempted_at: Date; username: string }[]>`
			SELECT attempted_at, username
			FROM login_attempt
			WHERE client_ip = ${herkunft} AND succeeded = false
			  AND attempted_at > now() - interval '1 hour'
			ORDER BY attempted_at DESC
			LIMIT 200
		`;
		const herkunftssperre = pruefeHerkunftssperre(
			vonDort.map((v): Namensversuch => ({
				zeitpunkt: v.attempted_at.getTime(),
				username: v.username
			})),
			jetzt
		);
		if (herkunftssperre.gesperrt) {
			return { art: 'gesperrt', verbleibendSekunden: herkunftssperre.verbleibendSekunden! };
		}
	}

	// Über eine eng umrissene Funktion mit SECURITY DEFINER, weil `app_user` dem
	// Zeilenschutz unterliegt und der Betreiber beim Anmelden noch unbekannt ist
	// (Migration 003). Sie liefert höchstens eine Zeile, seit der Name über alle
	// Betreiber eindeutig ist (Migration 155, Befund D4).
	const [zeile] = await sql<
		{
			id: string;
			operator_id: string;
			username: string;
			display_name: string;
			role: Rolle;
			password_hash: string | null;
			disabled_at: Date | null;
		}[]
	>`SELECT * FROM anmeldedaten(${username})`;

	const gueltig =
		zeile?.password_hash && !zeile.disabled_at
			? await argon2.verify(zeile.password_hash, kennwort).catch(() => false)
			: await argon2
					// Vergleichsableitung gegen einen festen Wert, damit die Antwortzeit
					// bei unbekanntem Benutzer nicht auffällig kürzer ist.
					.hash(kennwort, ARGON2_EINSTELLUNGEN)
					.then(() => false)
					.catch(() => false);

	if (!gueltig || !zeile) {
		await sql`
			INSERT INTO login_attempt (username, succeeded, client_ip)
			VALUES (${username}, false, ${herkunft})
		`;
		/*
		 * Bei unbekanntem Namen gibt es keinen Betreiber, und die Zeile steht
		 * ohne ihn. Seit Migration 154 (Befund D9) liest sie kein Betreiber
		 * mehr mit, nur noch der Betrieb über die privilegierte Rolle: Welche
		 * Namen bei fremden Betreibern durchprobiert werden, geht keine
		 * Sitzungsleitung etwas an.
		 */
		await sql.begin(async (tx) => {
			await tx`SELECT set_config('versammlung.operator_id', ${zeile?.operator_id ?? ''}, true)`;
			await schreibeVerlauf(
				tx,
				{ operatorId: zeile?.operator_id ?? null, userId: null, label: username },
				ereignis(EREIGNISARTEN.anmeldungFehlgeschlagen, {
					art: 'app_user',
					id: zeile?.id ?? undefined
				})
			);
		});
		return { art: 'abgelehnt' };
	}

	const merkmal = randomBytes(32).toString('base64url');
	const ablauf = new Date(jetzt + SITZUNGSDAUER_SEKUNDEN * 1000);

	await sql.begin(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${zeile.operator_id}, true)`;
		await tx`
			INSERT INTO user_session (user_id, token_hash, expires_at)
			VALUES (${zeile.id}, ${merkmalPruefwert(merkmal)}, ${ablauf})
		`;
		await tx`
			INSERT INTO login_attempt (username, succeeded, client_ip)
			VALUES (${username}, true, ${herkunft})
		`;
		await schreibeVerlauf(
			tx,
			{ operatorId: zeile.operator_id, userId: zeile.id, label: zeile.display_name },
			ereignis(EREIGNISARTEN.anmeldung, { art: 'app_user', id: zeile.id }, { method: 'local' })
		);
	});

	return {
		art: 'erfolg',
		sitzungsmerkmal: merkmal,
		benutzer: {
			id: zeile.id,
			operatorId: zeile.operator_id,
			username: zeile.username,
			displayName: zeile.display_name,
			role: zeile.role
		}
	};
}

/**
 * Legt eine Sitzung für einen bereits festgestellten Benutzer an.
 *
 * Für die Anmeldung über Authentik (Story 4.1): Dort ist die Identität bereits
 * geprüft, es gibt kein Kennwort und keine Sperrstaffelung. Die Sitzung selbst
 * entsteht aber auf demselben Weg — ein zweiter Sitzungsbegriff wäre die Art
 * von Doppelung, bei der eine der beiden irgendwann eine Ablaufprüfung
 * verpasst.
 */
export async function legeSitzungAn(
	benutzer: AngemeldeterBenutzer,
	weg: 'local' | 'authentik',
	jetzt: number = Date.now()
): Promise<string> {
	const merkmal = randomBytes(32).toString('base64url');
	const ablauf = new Date(jetzt + SITZUNGSDAUER_SEKUNDEN * 1000);

	await sql.begin(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${benutzer.operatorId}, true)`;
		await tx`
			INSERT INTO user_session (user_id, token_hash, expires_at)
			VALUES (${benutzer.id}, ${merkmalPruefwert(merkmal)}, ${ablauf})
		`;
		await schreibeVerlauf(
			tx,
			{ operatorId: benutzer.operatorId, userId: benutzer.id, label: benutzer.displayName },
			ereignis(
				weg === 'authentik' ? EREIGNISARTEN.anmeldungAuthentik : EREIGNISARTEN.anmeldung,
				{ art: 'app_user', id: benutzer.id },
				{ method: weg }
			)
		);
	});

	return merkmal;
}

/** Löst ein Sitzungsmerkmal auf; gibt null zurück, wenn es fehlt, abgelaufen oder entwertet ist. */
export async function sitzungAufloesen(
	merkmal: string | undefined
): Promise<AngemeldeterBenutzer | null> {
	if (!merkmal) return null;

	// Ebenfalls über eine Funktion mit SECURITY DEFINER: Wer die Sitzung auflösen
	// will, kennt den Betreiber noch nicht (Migration 003).
	const [zeile] = await sql<
		{
			id: string;
			operator_id: string;
			username: string;
			display_name: string;
			role: Rolle;
		}[]
	>`SELECT * FROM sitzung_aufloesen(${merkmalPruefwert(merkmal)})`;

	if (!zeile) return null;

	return {
		id: zeile.id,
		operatorId: zeile.operator_id,
		username: zeile.username,
		displayName: zeile.display_name,
		role: zeile.role
	};
}

/**
 * Entwertet eine Sitzung serverseitig.
 *
 * Das Cookie zu löschen genügt nicht: Wer es vorher kopiert hat, käme sonst
 * weiterhin hinein.
 */
export async function abmelden(
	merkmal: string | undefined,
	benutzer: AngemeldeterBenutzer | null
): Promise<void> {
	if (!merkmal) return;

	await sql.begin(async (tx) => {
		if (benutzer) {
			await tx`SELECT set_config('versammlung.operator_id', ${benutzer.operatorId}, true)`;
		}
		await tx`
			UPDATE user_session SET revoked_at = now()
			WHERE token_hash = ${merkmalPruefwert(merkmal)} AND revoked_at IS NULL
		`;
		if (benutzer) {
			const handelnder: Handelnder = {
				operatorId: benutzer.operatorId,
				userId: benutzer.id,
				label: benutzer.displayName
			};
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(EREIGNISARTEN.abmeldung, { art: 'app_user', id: benutzer.id })
			);
		}
	});
}

/** Vergleicht zwei Zeichenketten in gleichbleibender Zeit. */
export function sicherGleich(a: string, b: string): boolean {
	const pufferA = Buffer.from(a);
	const pufferB = Buffer.from(b);
	if (pufferA.length !== pufferB.length) return false;
	return timingSafeEqual(pufferA, pufferB);
}
