/**
 * Dateiablage (AD-17).
 *
 * Der Dateiname ist die Prüfsumme des Inhalts. Daraus folgt dreierlei, und alle
 * drei sind der Grund für diese Wahl:
 *
 *   1. Unter einem Namen steht nie ein anderer Inhalt. Eine zweite Fassung ist
 *      eine zweite Datei — ein Abschlusspaket, dessen Manifest auf eine Datei
 *      verweist, kann nie auf einen veränderten Inhalt zeigen. Ersetzt wird
 *      eine Datei nur durch ihren eigenen Inhalt (`schreibeAtomar`).
 *   2. Derselbe Inhalt liegt nur einmal da. Wer denselben Vertrag an zwei
 *      Einheiten hängt, erzeugt keine zweite Kopie.
 *   3. Der vom Benutzer gelieferte Name landet nie im Dateisystem. Damit sind
 *      Pfadangaben im Namen wirkungslos; der ursprüngliche Name steht in der
 *      Datenbank und wird nur beim Herunterladen wieder angezeigt.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { env } from '$env/dynamic/private';
import { beschreibeAbgelehntes, erkenneArt, ZUGELASSENE_ARTEN } from '$lib/domain/dateiart';
import { HOECHSTGROESSE, HOECHSTZAHL_JE_ABSENDEN, ZU_VIELE } from '$lib/nachweisgrenze';
import { FachlicherFehler } from '$lib/domain/fehler';

const WURZEL = env.VERSAMMLUNG_DATEIEN ?? './daten/dateien';

// Die Höchstgrösse steht neben der Höchstzahl, weil der Browser beide braucht.
export { HOECHSTGROESSE };

/** Erlaubte Arten. Bewusst eng: Was hier landet, wird später ausgeliefert. */
export const ERLAUBTE_ARTEN = new Set<string>(ZUGELASSENE_ARTEN);

export class DateiFehler extends Error {
	constructor(
		readonly kennung: string,
		nachricht: string
	) {
		super(nachricht);
		this.name = 'DateiFehler';
	}
}

/** Zwei Ebenen Unterverzeichnis, damit nicht alles in einem Ordner liegt. */
function pfadZu(pruefsumme: string): { ordner: string; datei: string } {
	const ordner = join(WURZEL, pruefsumme.slice(0, 2), pruefsumme.slice(2, 4));
	return { ordner, datei: join(ordner, pruefsumme) };
}

export interface AbgelegteDatei {
	pruefsumme: string;
	groesse: number;
	art: string;
	name: string;
}

/**
 * Liest eine hochgeladene Datei in den Speicher, aber erst nach der
 * Grössenprüfung (K1, Sicherheitsdurchgang 09.10.2026).
 *
 * `legeAb` prüft die Grösse am fertigen Puffer, und bis zum 15.10.2026 lasen
 * alle Ablagewege die Datei vorher vollständig ein. Bei parallelen Anfragen
 * vervielfachte sich so der Speicher, und die Grenze verhinderte die Spitze
 * nicht, gegen die sie steht. `File.size` steht schon nach dem Zerlegen des
 * Formulars fest; daran wird hier abgewiesen, bevor eine zweite Kopie
 * entsteht. Die Prüfung in `legeAb` bleibt, denn sie sieht, was wirklich
 * geschrieben würde.
 */
export async function liesHochgeladene(datei: File): Promise<Uint8Array> {
	if (datei.size > HOECHSTGROESSE) throw zuGross();
	return new Uint8Array(await datei.arrayBuffer());
}

/**
 * Die Nachweise eines Absendens, höchstens `HOECHSTZAHL_JE_ABSENDEN`
 * (Produktentscheid 16.10.2026, Begründung in `$lib/nachweisgrenze`).
 *
 * **Als fachliche Absage**, nicht als `DateiFehler`: Die Einlasswege
 * übersetzen nur `FachlicherFehler` in einen Satz, alles andere wird dort zur
 * Fehlerseite. Leere Felder (kein Foto gewählt) zählen nicht.
 */
export function begrenzeNachweise(dateien: File[]): File[] {
	const echte = dateien.filter((d) => d && d.size > 0);
	if (echte.length > HOECHSTZAHL_JE_ABSENDEN) {
		throw new FachlicherFehler('zu_viele_nachweise', ZU_VIELE, 'nachweis');
	}
	return echte;
}

function zuGross(): DateiFehler {
	return new DateiFehler(
		'zu_gross',
		`Die Datei ist grösser als ${Math.round(HOECHSTGROESSE / 1024 / 1024)} MB.`
	);
}

/**
 * Endung der Teildateien aus `schreibeAtomar`. Daran sind sie erkennbar, und
 * darum kollidieren sie nie mit einem Endnamen: Der ist ein reiner
 * Prüfsummenwert aus 64 Hexzeichen.
 */
const TEIL_ENDUNG = '.teil';

/**
 * Schreibt einen Inhalt unter den Namen seiner Prüfsumme, atomar (F3,
 * 15.10.2026).
 *
 * **Erst daneben, dann umbenennen.** Geschrieben wird in eine Teildatei im
 * selben Verzeichnis, danach `fsync`, dann `rename` auf den Endnamen.
 * Innerhalb eines Dateisystems ist `rename` atomar: Unter dem
 * Prüfsummennamen steht danach die bisherige Datei oder die neue,
 * vollständige, nie eine halbe. Der frühere Weg schrieb direkt unter den
 * Endnamen; ein Abbruch mittendrin liess eine abgeschnittene Datei stehen,
 * und das nächste Ablegen fand sie über `access()` und liess sie liegen
 * (Befund N2, Codeprüfung der Sicherung).
 *
 * **Ein vorhandenes Ziel wird ersetzt, nicht stehen gelassen.** Der Endname
 * ist die Prüfsumme des Inhalts; unter ihm gehört genau dieser Inhalt hin.
 * Eine abgeschnittene oder verfälschte Datei dort wäre für immer
 * «vorhanden» und liesse sich nur von Hand berichtigen. Ersetzt wird
 * ausschliesslich durch den Inhalt, dessen Prüfsumme der Name ist; die
 * Zusage aus AD-17, dass kein Verweis auf einen veränderten Inhalt zeigt,
 * bleibt unberührt. Deshalb entfällt der frühere Schnellweg «liegt schon
 * da»: Er konnte eine vollständige nicht von einer abgeschnittenen Datei
 * unterscheiden, und ein sicherer Schnellweg müsste die Datei erst lesen
 * und nachrechnen.
 *
 * **Teildateien stören nicht.** Sie liegen im selben Verzeichnis (nötig für
 * `rename`) und tragen einen Zufallsteil, damit gleichzeitige Ablagen einander
 * nicht auf derselben Teildatei begegnen. Bleibt nach einem Abbruch eine
 * liegen, liest die Ablage sie nie, und die Sicherung nimmt sie mit; das ist
 * gewollt: kein Aufräumen im Vorbeigehen, keines per Zeitplan (F3).
 */
async function schreibeAtomar(datei: string, inhalt: Uint8Array): Promise<void> {
	const teil = `${datei}.${randomBytes(8).toString('hex')}${TEIL_ENDUNG}`;
	// `wx`: Eine fremde Teildatei wird nie überschrieben, auch nicht bei einer
	// Zufallskollision im Namen.
	const griff = await open(teil, 'wx');
	try {
		await griff.writeFile(inhalt);
		// Ohne `fsync` läge der Inhalt nach einem Stromausfall womöglich noch
		// im Schreibpuffer, und das Umbenennen machte den leeren Schein zum
		// Endstand.
		await griff.sync();
		await griff.close();
		await rename(teil, datei);
	} catch (fehler) {
		// Die Teildatei gehört uns (frisch angelegt), bei einem abgefangenen
		// Fehler darf sie weg. Nach einem Abbruch des Prozesses bleibt sie
		// liegen, und das ist in Ordnung (siehe oben).
		await griff.close().catch(() => {});
		await unlink(teil).catch(() => {});
		throw fehler;
	}
	// Auch das Umbenennen muss auf der Platte stehen, bevor der Aufrufer die
	// Zeile schreibt, die auf die Datei zeigt. Sonst steht nach einem
	// Stromausfall die Zeile in der Datenbank und unter dem Endnamen nichts.
	const verzeichnis = await open(dirname(datei), 'r');
	try {
		await verzeichnis.sync();
	} finally {
		await verzeichnis.close();
	}
}

export async function legeAb(
	inhalt: Uint8Array,
	name: string,
	art: string
): Promise<AbgelegteDatei> {
	if (inhalt.byteLength === 0) {
		throw new DateiFehler('leer', 'Die Datei ist leer.');
	}
	if (inhalt.byteLength > HOECHSTGROESSE) throw zuGross();
	// Massgebend ist der Inhalt, nicht die Angabe des Browsers. Sie steht im
	// Formular und lässt sich beliebig setzen — wer eine ausführbare Datei als
	// `application/pdf` deklariert, käme sonst an jeder Prüfung vorbei. Der
	// zurückgegebene Typ ist der erkannte, nicht der behauptete: Wird später
	// ausgeliefert, was der Absender behauptet hat, öffnet der Browser einen
	// Inhalt in der falschen Annahme.
	const erkannt = erkenneArt(inhalt);
	if (!erkannt) {
		throw new DateiFehler('art_nicht_erlaubt', beschreibeAbgelehntes(inhalt, art));
	}

	const pruefsumme = createHash('sha256').update(inhalt).digest('hex');
	const { ordner, datei } = pfadZu(pruefsumme);

	await mkdir(ordner, { recursive: true });
	await schreibeAtomar(datei, inhalt);

	return { pruefsumme, groesse: inhalt.byteLength, art: erkannt, name };
}

/**
 * Legt etwas ab, das die Anwendung **selbst erzeugt** hat.
 *
 * Ohne die Artprüfung von `legeAb`, und zwar mit Grund: Jene Prüfung schützt
 * vor dem, was ein Browser hochlädt — eine ausführbare Datei, die sich als PDF
 * ausgibt. Ein Abschlusspaket kommt nicht von aussen, es entsteht hier; die
 * Prüfung würde es abweisen, weil ZIP unter den hochladbaren Arten nichts zu
 * suchen hat.
 *
 * Der Name fehlt bewusst: Solche Dateien werden über ihre Prüfsumme
 * angesprochen, nicht über einen Namen (AD-17).
 */
export async function legeInternAb(inhalt: Uint8Array): Promise<{ pruefsumme: string; groesse: number }> {
	if (inhalt.byteLength === 0) {
		throw new DateiFehler('leer', 'Der Inhalt ist leer.');
	}
	const pruefsumme = createHash('sha256').update(inhalt).digest('hex');
	const { ordner, datei } = pfadZu(pruefsumme);
	await mkdir(ordner, { recursive: true });
	await schreibeAtomar(datei, inhalt);
	return { pruefsumme, groesse: inhalt.byteLength };
}

export async function lies(pruefsumme: string): Promise<Uint8Array> {
	// Nur Hexadezimalzeichen: Alles andere wäre ein Versuch, aus der Ablage
	// herauszukommen.
	if (!/^[0-9a-f]{64}$/.test(pruefsumme)) {
		throw new DateiFehler('kennung_ungueltig', 'Ungültige Dateikennung.');
	}
	const { datei } = pfadZu(pruefsumme);
	return readFile(datei);
}

/**
 * Entfernt eine Datei aus der Ablage (17.09.2026, Löschen nach Frist).
 *
 * **Ob sie noch gebraucht wird, prüft der Aufrufer**, und zwar über
 * `pruefsumme_verwendet` in der Datenbank, über alle Betreiber hinweg: Derselbe
 * Inhalt liegt nur einmal da (AD-17), und unter dem Zeilenschutz sähe die
 * Anwendung fremde Verweise nicht.
 *
 * `false`, wenn die Datei schon fehlt. Das ist kein Fehler: Wer zweimal
 * aufräumt, soll beim zweiten Mal nicht scheitern.
 */
export async function entferneDatei(pruefsumme: string): Promise<boolean> {
	if (!/^[0-9a-f]{64}$/.test(pruefsumme)) {
		throw new DateiFehler('kennung_ungueltig', 'Ungültige Dateikennung.');
	}
	const { datei } = pfadZu(pruefsumme);
	try {
		await unlink(datei);
		return true;
	} catch (fehler) {
		if ((fehler as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw fehler;
	}
}
