/**
 * Zugangsschlüssel verschlüsselt ablegen (14.08.2026).
 *
 * **Wozu.** Seit die KI-Kette in der Anwendung eingerichtet werden kann, liegt
 * ihr Zugangsschlüssel in der Datenbank. Im Klartext wäre jeder
 * Datenbankauszug — jede Sicherung, jeder `pg_dump` auf einem Notebook — ein
 * verschenkter Schlüssel. Verschlüsselt ist der Auszug für sich genommen
 * wertlos: Das Geheimnis steht in der Umgebung und wird getrennt gesichert.
 *
 * **Was das nicht leistet.** Wer den laufenden Server hat, hat beides. Das ist
 * kein Mangel dieser Datei, sondern die Grenze des Verfahrens: Die Anwendung
 * muss den Schlüssel benutzen können, also muss sie ihn lesen können. Geschützt
 * ist der Weg über die Datenbank allein — und das ist der Weg, über den solche
 * Schlüssel tatsächlich abhandenkommen.
 *
 * AES-256-GCM: verschlüsselt **und** beglaubigt. Ohne Beglaubigung könnte
 * jemand mit Schreibrecht auf der Datenbank den Geheimtext verändern; das fiele
 * dann nicht auf, sondern ergäbe einen anderen Schlüssel.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Wie das Geheimnis heisst und wie es erzeugt wird — beides gehört in jede Absage. */
export const GEHEIMNIS_VARIABLE = 'VERSAMMLUNG_GEHEIMNIS';
export const GEHEIMNIS_ERZEUGEN = 'openssl rand -hex 32';

export class TresorFehler extends Error {}

/**
 * Das Geheimnis aus der Umgebung — 32 Byte als 64 Hexzeichen.
 *
 * Bewusst **nicht** aus einem kürzeren Wort abgeleitet: Ein abgeleiteter
 * Schlüssel sähe genauso aus und wäre so stark wie das Wort, aus dem er kommt.
 * Wer `openssl rand -hex 32` nicht ausführen will, soll keine Schlüssel in der
 * Anwendung ablegen.
 */
function geheimnis(): Buffer | null {
	const roh = process.env[GEHEIMNIS_VARIABLE]?.trim();
	if (!roh) return null;
	if (!/^[0-9a-fA-F]{64}$/.test(roh)) {
		throw new TresorFehler(
			`${GEHEIMNIS_VARIABLE} muss aus genau 64 Hexzeichen bestehen (32 Byte). Erzeugen mit: ${GEHEIMNIS_ERZEUGEN}`
		);
	}
	return Buffer.from(roh, 'hex');
}

/**
 * Ob sich überhaupt etwas ablegen lässt.
 *
 * Die Oberfläche fragt das vorher, damit sie die Absage **vor** dem Ausfüllen
 * anzeigen kann und nicht erst beim Speichern. Ein Formular, das man ausfüllt
 * und dessen Absenden dann an einer Voraussetzung scheitert, ist der Weg,
 * Eingaben zu verlieren.
 */
export function tresorBereit(): boolean {
	try {
		return geheimnis() !== null;
	} catch {
		// Ein unbrauchbares Geheimnis ist kein bereiter Tresor — die Meldung
		// bekommt, wer zu speichern versucht.
		return false;
	}
}

/** Gibt es kein Geheimnis, ist das kein Absturz, sondern eine Auskunft. */
function verlangeGeheimnis(): Buffer {
	const g = geheimnis();
	if (!g) {
		throw new TresorFehler(
			`Es ist kein ${GEHEIMNIS_VARIABLE} hinterlegt. Ohne dieses lassen sich keine ` +
				`Zugangsschlüssel in der Anwendung ablegen. Erzeugen mit: ${GEHEIMNIS_ERZEUGEN}`
		);
	}
	return g;
}

/** Vorangestellte Kennung, damit ein Verfahrenswechsel später erkennbar bleibt. */
const KENNUNG = 'v1';

export function verschluessele(klartext: string): string {
	const schluessel = verlangeGeheimnis();
	// Zwölf Byte ist die für GCM vorgesehene Länge; jeder Einsatz bekommt einen
	// eigenen — derselbe Zufallswert zweimal hebt die Verschlüsselung auf.
	const iv = randomBytes(12);
	const c = createCipheriv('aes-256-gcm', schluessel, iv);
	const geheim = Buffer.concat([c.update(klartext, 'utf8'), c.final()]);
	return [KENNUNG, iv.toString('base64'), c.getAuthTag().toString('base64'), geheim.toString('base64')].join(
		':'
	);
}

export function entschluessele(gespeichert: string): string {
	const schluessel = verlangeGeheimnis();
	const teile = gespeichert.split(':');
	if (teile.length !== 4 || teile[0] !== KENNUNG) {
		throw new TresorFehler('Der abgelegte Wert hat eine unbekannte Form.');
	}
	const [, iv, marke, geheim] = teile;
	try {
		const d = createDecipheriv('aes-256-gcm', schluessel, Buffer.from(iv, 'base64'));
		d.setAuthTag(Buffer.from(marke, 'base64'));
		return Buffer.concat([d.update(Buffer.from(geheim, 'base64')), d.final()]).toString('utf8');
	} catch {
		// Falsches Geheimnis oder veränderter Geheimtext — von aussen dasselbe,
		// und in beiden Fällen darf kein halber Schlüssel herauskommen.
		throw new TresorFehler(
			`Der abgelegte Schlüssel liess sich nicht lesen. Wurde ${GEHEIMNIS_VARIABLE} geändert? ` +
				'Tragen Sie den Zugangsschlüssel neu ein.'
		);
	}
}

/**
 * Was von einem Schlüssel angezeigt werden darf.
 *
 * Nie der Wert, auch nicht in einem Formularfeld: Ein `<input value="sk-…">`
 * steht im ausgelieferten HTML und damit im Zwischenspeicher jedes Geräts, das
 * die Seite je geladen hat. Angezeigt wird, dass einer da ist — und gerade so
 * viel, dass man zwei auseinanderhält.
 */
export function schluesselAndeutung(klartext: string): string {
	const rein = klartext.trim();
	// zeichenzahl-frei: gehört zu slice() — das zählt ebenfalls Einheiten.
	if (rein.length <= 8) return '••••';
	return `${rein.slice(0, 3)}…${rein.slice(-3)}`;
}
