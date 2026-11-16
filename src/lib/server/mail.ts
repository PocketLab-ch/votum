/**
 * Der Mailausgang — die Schale (PRD §13, offene Frage «Mailversand»).
 *
 * **Ein Dienst wie jeder andere: nicht eingerichtet, nicht vorhanden.** Ohne
 * `VERSAMMLUNG_SMTP_HOST` erscheint kein Knopf, und die Anwendung bleibt genau
 * so benutzbar wie bisher — Dateien erzeugen, selbst verschicken. Keine
 * Versammlung hängt daran; verschickt wird bei der Vorbereitung, nicht im Saal.
 *
 * **Warum eine Bibliothek und nicht von Hand**, anders als bei CSV und bei der
 * Anmeldung über Authentik: Dort sind es zwei Aufrufe und eine Prüfung. Hier
 * geht es um MIME, Kodierungen, TLS und Anmeldeverfahren — und um Anhänge, die
 * einen persönlichen Zugangscode tragen. Ein selbstgebauter Versand scheitert
 * nicht beim ersten Empfänger, sondern beim zehnten, und still. `nodemailer`
 * bringt seinerseits **keine** Abhängigkeit mit; die Lieferkette wächst also
 * nicht.
 *
 * **Der Schlüssel steht in der Umgebung, nie in der Datenbank und nie im
 * Verlauf.** Was im Verlauf steht, ist die Tatsache des Versands und die
 * Empfängeradresse — nicht der Inhalt und nicht der Anhang.
 */
import { createTransport, type Transporter } from 'nodemailer';
import { env } from '$env/dynamic/private';
import { ERREICHBARKEIT_ZEITLIMIT_MS, type Erreichbarkeit } from '$lib/domain/anmeldewege';
import type { Nachricht, Versandergebnis } from '$lib/domain/mailversand';

export interface Mailausgang {
	host: string;
	port: number;
	benutzer: string;
	kennwort: string;
	absender: string;
	absenderName: string;
	/** Ob die Verbindung von Beginn an verschlüsselt ist (Port 465). */
	direktVerschluesselt: boolean;
}

export function einstellungen(): Mailausgang | null {
	const host = env.VERSAMMLUNG_SMTP_HOST?.trim();
	if (!host) return null;

	const port = Number(env.VERSAMMLUNG_SMTP_PORT ?? '587');
	return {
		host,
		port: Number.isInteger(port) && port > 0 ? port : 587,
		benutzer: env.VERSAMMLUNG_SMTP_BENUTZER?.trim() ?? '',
		kennwort: env.VERSAMMLUNG_SMTP_KENNWORT ?? '',
		// Ohne eigene Absenderadresse nimmt der Server meist die des Benutzers;
		// wir setzen sie trotzdem ausdrücklich, sonst entscheidet der Anbieter.
		absender: env.VERSAMMLUNG_SMTP_ABSENDER?.trim() || env.VERSAMMLUNG_SMTP_BENUTZER?.trim() || '',
		absenderName: env.VERSAMMLUNG_SMTP_ABSENDERNAME?.trim() ?? '',
		direktVerschluesselt: (env.VERSAMMLUNG_SMTP_PORT ?? '587').trim() === '465'
	};
}

export function istEingerichtet(): boolean {
	const e = einstellungen();
	return e !== null && e.absender !== '';
}

function verbindung(e: Mailausgang): Transporter {
	return createTransport({
		host: e.host,
		port: e.port,
		secure: e.direktVerschluesselt,
		auth: e.benutzer ? { user: e.benutzer, pass: e.kennwort } : undefined,
		// **Kein Rückfall auf unverschlüsselt.** Ein Mailserver, der STARTTLS
		// nicht anbietet, bekommt keine Zugangscodes — das Kennwort ginge sonst
		// im Klartext über die Leitung, und mit ihm die Anhänge.
		requireTLS: !e.direktVerschluesselt,
		connectionTimeout: 15_000,
		greetingTimeout: 10_000,
		socketTimeout: 30_000
	});
}

/**
 * Fragt, ob der Mailserver antwortet — ohne etwas zu verschicken.
 *
 * `verify()` baut die Verbindung auf, handelt TLS aus und meldet sich an. Damit
 * ist beantwortet, was auf der Seite steht: Ob ein Versand jetzt gelänge.
 */
let gemerkt: { bis: number; wert: Erreichbarkeit } | null = null;

export async function pruefeErreichbarkeit(): Promise<Erreichbarkeit> {
	const e = einstellungen();
	if (!e || !e.absender) return 'nicht_eingerichtet';
	if (gemerkt && Date.now() < gemerkt.bis) return gemerkt.wert;

	let wert: Erreichbarkeit = 'nicht_erreichbar';
	const post = verbindung(e);
	try {
		await post.verify();
		wert = 'erreichbar';
	} catch {
		wert = 'nicht_erreichbar';
	} finally {
		post.close();
	}

	// Wie bei den übrigen Diensten: erreichbar länger gemerkt als nicht
	// erreichbar.
	gemerkt = { wert, bis: Date.now() + (wert === 'erreichbar' ? 60_000 : 15_000) };
	return wert;
}

export class MailFehler extends Error {}

/**
 * Verschickt die Nachrichten eines Versandplans — **eine nach der anderen**.
 *
 * **Nicht gleichzeitig**, obwohl es schneller wäre: Mailserver drosseln, und
 * eine Drosselung, die bei zwölf gleichzeitigen Verbindungen zuschlägt, träfe
 * mitten in den Versand. Nacheinander dauert es Sekunden länger und liefert je
 * Nachricht eine klare Auskunft.
 *
 * **Ein Fehler bricht nicht ab.** Wer dreizehn von vierzehn Karten verschicken
 * kann, soll das tun — die eine fehlende steht danach namentlich da und lässt
 * sich einzeln nachreichen.
 */
export async function verschicke(
	nachrichten: readonly Nachricht[],
	anhaenge: Map<string, Uint8Array>
): Promise<Versandergebnis[]> {
	const e = einstellungen();
	if (!e || !e.absender) {
		throw new MailFehler(
			'Es ist kein Mailausgang eingerichtet (VERSAMMLUNG_SMTP_HOST und ' +
				'VERSAMMLUNG_SMTP_ABSENDER). Ohne ihn erzeugt die Anwendung die Dateien, verschickt ' +
				'sie aber nicht.'
		);
	}

	const post = verbindung(e);
	const ergebnisse: Versandergebnis[] = [];

	try {
		for (const n of nachrichten) {
			/*
			 * **Alle Beilagen oder keine** (07.09.2026). Lieber nichts verschicken
			 * als eine Einladung ohne Karte: Der Empfänger stünde im Saal ohne
			 * Zugang und hätte eine Mail, die sagt, er habe einen. Seit dem
			 * Vollmachtsformular sind es mehrere Beilagen, und dieselbe
			 * Überlegung gilt für jede: Eine halbe Sendung ist schlechter als
			 * eine ausgebliebene, weil niemand merkt, dass etwas fehlt.
			 */
			const fehlend = n.anhaenge.filter((name) => !anhaenge.has(name));
			if (fehlend.length > 0) {
				ergebnisse.push({
					parteiId: n.parteiId,
					name: n.name,
					an: n.an,
					zugestellt: false,
					grund:
						fehlend.length === 1
							? `Der Anhang «${fehlend[0]}» fehlt im Versandpaket.`
							: `Diese Anhänge fehlen im Versandpaket: ${fehlend.join(', ')}.`
				});
				continue;
			}

			try {
				await post.sendMail({
					from: e.absenderName ? { name: e.absenderName, address: e.absender } : e.absender,
					// **Genau eine Adresse.** Kein Kopie-Feld, kein Verteiler: Der
					// Anhang trägt einen persönlichen Zugangscode.
					to: n.an,
					subject: n.betreff,
					text: n.text,
					attachments: n.anhaenge.map((name) => ({
						filename: name,
						content: Buffer.from(anhaenge.get(name)!),
						contentType: 'application/pdf'
					}))
				});
				ergebnisse.push({ parteiId: n.parteiId, name: n.name, an: n.an, zugestellt: true, grund: null });
			} catch (fehler) {
				ergebnisse.push({
					parteiId: n.parteiId,
					name: n.name,
					an: n.an,
					zugestellt: false,
					grund: fehler instanceof Error ? fehler.message : 'Unbekannter Fehler'
				});
			}
		}
	} finally {
		post.close();
	}

	return ergebnisse;
}

/**
 * Eine einzelne Nachricht ohne Anhang — für Erinnerungen an das eigene Haus.
 *
 * **Warum nicht über `verschicke`.** Jenes verlangt zu jeder Nachricht einen
 * Anhang und meldet eine fehlende Zugangskarte als Fehlschlag; das ist dort
 * richtig und hier falsch. Eine Erinnerung an die Bewirtschaftung trägt keinen
 * Zugangscode, und ein leerer Anhang wäre eine Ausnahme im Weg, der die Codes
 * verschickt — der Weg, an dem sich diese Anwendung keine Ausnahme leisten
 * will.
 *
 * Wirft bei einem Fehlschlag, statt ihn zu melden: Der Aufrufer muss ihn
 * behandeln — er hat den Merker gesetzt, bevor er hierherkam.
 */
export async function verschickeNachricht(an: string, betreff: string, text: string): Promise<void> {
	const e = einstellungen();
	if (!e || !e.absender) {
		throw new MailFehler('Es ist kein Mailausgang eingerichtet.');
	}

	const post = verbindung(e);
	try {
		await post.sendMail({
			from: e.absenderName ? { name: e.absenderName, address: e.absender } : e.absender,
			to: an,
			subject: betreff,
			text
		});
	} finally {
		post.close();
	}
}

/** Zeitlimit der Erreichbarkeitsprüfung, für die Anzeige auf der Seite. */
export const PRUEFZEIT_MS = ERREICHBARKEIT_ZEITLIMIT_MS;
