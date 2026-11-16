/**
 * Der PDF-Baukasten (Story 3.6, AD-13).
 *
 * pdf-lib ist eine Bibliothek, kein zweiter Dienst — AD-13 bleibt gewahrt. Der
 * Umbruch selbst steht im Kern (`domain/textsatz.ts`); hier wird nur gezeichnet.
 *
 * **Warum eine eigene Schrift statt der eingebauten:** Die Standardschriften
 * eines PDF können nur WinAnsi. Ein Eigentümer namens «Petrović» oder
 * «Nowak-Łukasik» brächte die Erzeugung zum Absturz — und zwar genau dann, wenn
 * die Einladung entstehen soll. DejaVu Sans deckt Latin Extended ab und liegt
 * als Datei im Projekt: Sie ist eine Bauzutat wie das Stylesheet und darf nicht
 * davon abhängen, welche Pakete auf dem Wirt installiert sind (AD-18).
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { umbrich, type Messer } from '$lib/domain/textsatz';

const HIER = dirname(fileURLToPath(import.meta.url));

/**
 * Die Schriftdateien.
 *
 * Zur Bauzeit bündelt Vite sie nicht mit — sie werden zur Laufzeit gelesen.
 * Deshalb drei Kandidatenpfade: neben dem Modul, im Quelltext (Entwicklungslauf
 * und gebauter Stand im Dev-Container) und im Arbeitsverzeichnis.
 *
 * Im Betriebsabbild greift nur der letzte, `/app/schriften`: Dorthin kopiert
 * das `Dockerfile` die Schriften, und `scripts/abbild-bauen.sh` bricht ab, wenn
 * sie dort fehlen oder nicht lesbar sind. Bis zum 15.10.2026 fehlten sie, und
 * jedes PDF samt Versiegeln endete am Betrieb mit 500 (Auftrag M6). Wer diesen
 * Pfad streicht, bricht den Betrieb, nicht den Entwicklungslauf.
 */
const SCHRIFTPFADE = [
	join(HIER, 'schriften'),
	join(process.cwd(), 'src/lib/server/pdf/schriften'),
	join(process.cwd(), 'schriften')
];

async function leseSchrift(name: string): Promise<Uint8Array> {
	for (const pfad of SCHRIFTPFADE) {
		try {
			return await readFile(join(pfad, name));
		} catch {
			// nächster Kandidat
		}
	}
	throw new Error(
		`Die Schriftdatei ${name} wurde nicht gefunden. Gesucht in: ${SCHRIFTPFADE.join(', ')}`
	);
}

export interface Schriften {
	normal: PDFFont;
	fett: PDFFont;
}

export interface Blatt {
	dokument: PDFDocument;
	schriften: Schriften;
}

export async function neuesBlatt(): Promise<Blatt> {
	const dokument = await PDFDocument.create();
	dokument.registerFontkit(fontkit);
	const [normal, fett] = await Promise.all([
		leseSchrift('DejaVuSans.ttf').then((b) => dokument.embedFont(b, { subset: true })),
		leseSchrift('DejaVuSans-Bold.ttf').then((b) => dokument.embedFont(b, { subset: true }))
	]);
	return { dokument, schriften: { normal, fett } };
}

/** Eine Messfunktion für den Umbruch im Kern. */
export function messer(schrift: PDFFont, groesse: number): Messer {
	return (text) => schrift.widthOfTextAtSize(text, groesse);
}

export const SCHWARZ = rgb(0.1, 0.1, 0.12);
/**
 * Die leise Textfarbe der PDF.
 *
 * **Dunkler als sie aussieht** (Auftraggeber, 28.08.2026): «Graue Schrift auf den PDF
 * vermeiden. Drucker geben Grau verschieden gut wieder, und für Menschen mit
 * schwächeren Augen ist es schlecht lesbar.» Sie stand auf
 * `rgb(0.42, 0.44, 0.48)` — am Bildschirm angenehm zurückhaltend, im Druck je
 * nach Gerät blass bis fehlend.
 *
 * Der Wert bleibt eine eigene Farbe und wird nicht zu `SCHWARZ`: Was leise ist,
 * soll leise bleiben, sonst tritt jede Fussnote so laut auf wie der Beschluss
 * daneben. Er ist nur so weit gedunkelt, dass er auch auf einem müden
 * Bürodrucker steht — **gerechnet 4,96:1 Kontrast auf Weiss vorher, 9,68:1
 * jetzt** (`SCHWARZ` läge bei 17,42:1). Die alte Farbe erfüllte WCAG AA damit
 * knapp; im Druck ist «knapp» zu wenig.
 *
 * `tests/domain/pdf-farben.test.ts` hält die Schwelle fest, damit sie nicht
 * beim nächsten Feinschliff wieder aufgehellt wird.
 */
export const GRAU = rgb(0.25, 0.27, 0.3);
export const LINIE = rgb(0.82, 0.83, 0.85);

export interface Textstil {
	schrift: PDFFont;
	groesse: number;
	farbe?: RGB;
	/** Zeilenabstand als Vielfaches der Schriftgrösse. */
	durchschuss?: number;
}

/**
 * Zeichnet umbrochenen Text und gibt die neue Grundlinie zurück.
 *
 * Der Rückgabewert ist die Höhe, an der es weitergeht — dadurch kann der Aufrufer
 * einen Absatz nach dem anderen setzen, ohne selbst zu rechnen, wie hoch der
 * vorige war.
 */
export function zeichneText(
	seite: PDFPage,
	text: string,
	x: number,
	y: number,
	breite: number,
	stil: Textstil
): number {
	const abstand = stil.groesse * (stil.durchschuss ?? 1.35);
	let grundlinie = y;
	for (const zeile of umbrich(text, breite, messer(stil.schrift, stil.groesse))) {
		if (zeile !== '') {
			seite.drawText(zeile, {
				x,
				y: grundlinie,
				size: stil.groesse,
				font: stil.schrift,
				color: stil.farbe ?? SCHWARZ
			});
		}
		grundlinie -= abstand;
	}
	return grundlinie;
}

/** Wie hoch ein umbrochener Text würde, ohne ihn zu zeichnen. */
export function hoeheVon(text: string, breite: number, stil: Textstil): number {
	const abstand = stil.groesse * (stil.durchschuss ?? 1.35);
	return umbrich(text, breite, messer(stil.schrift, stil.groesse)).length * abstand;
}

/**
 * Prüft vorab, ob sich eine Briefkopfvorlage einbetten lässt.
 *
 * Der Umweg über ein Wegwerf-Dokument ist nötig, weil pdf-lib das Einbetten
 * **aufschiebt**: `embedPage` merkt es nur vor, ausgeführt wird es erst beim
 * Speichern. Ein `try` um `embedPage` fängt deshalb nichts — die Ausnahme
 * entsteht später, ausserhalb, und reisst die ganze Erzeugung mit. Genau das
 * geschah beim Bauen dieser Story mit einer Vorlage ohne Inhalt.
 *
 * `flush()` zieht das Einbetten vor. Was hier durchkommt, kommt auch im
 * eigentlichen Dokument durch.
 *
 * **Exportiert seit dem 07.09.2026** (Code-Review): Die Einladung entscheidet
 * anhand dieser Frage zweierlei — wie viel oben für den Briefkopf frei bleibt,
 * und ob sie den Absender selbst in den Kopf setzt. Sie kann dafür nicht auf
 * `legeBriefkopfUnter` warten; das läuft erst nach dem Textsatz.
 */
export async function briefkopfBrauchbar(
	vorlage: Uint8Array
): Promise<{ brauchbar: boolean; grund?: string }> {
	try {
		const quelle = await PDFDocument.load(vorlage, { ignoreEncryption: true });
		if (quelle.getPageCount() === 0) {
			return { brauchbar: false, grund: 'Die Briefkopfvorlage hat keine Seite.' };
		}

		const probe = await PDFDocument.create();
		const eingebettet = await probe.embedPage(quelle.getPage(0));
		const seite = probe.addPage([595, 842]);
		seite.drawPage(eingebettet, { x: 0, y: 0, width: 595, height: 842 });
		await probe.flush();

		return { brauchbar: true };
	} catch (fehler) {
		return {
			brauchbar: false,
			grund: `Die Briefkopfvorlage liess sich nicht einbetten: ${(fehler as Error).message}`
		};
	}
}

/**
 * Legt eine Briefkopfvorlage als Hintergrund unter die angegebenen Seiten.
 *
 * Die Vorlage bleibt unverändert: Ihre erste Seite wird eingebettet und
 * gezeichnet, nicht verschmolzen. Damit kann ein späterer Wechsel der Vorlage
 * kein bereits erzeugtes Dokument verändern.
 *
 * Ist die Vorlage unbrauchbar — beschädigt, verschlüsselt, ohne Seite, ohne
 * Inhalt —, entsteht das PDF **ohne** Briefkopf statt gar nicht. Eine Einladung
 * ohne Logo ist ein Schönheitsfehler; keine Einladung am Tag des Versands ist
 * ein Problem.
 */
export async function legeBriefkopfUnter(
	blatt: Blatt,
	vorlage: Uint8Array,
	seiten: PDFPage[]
): Promise<{ verwendet: boolean; grund?: string }> {
	const befund = await briefkopfBrauchbar(vorlage);
	if (!befund.brauchbar) return { verwendet: false, grund: befund.grund };

	const quelle = await PDFDocument.load(vorlage, { ignoreEncryption: true });
	const eingebettet = await blatt.dokument.embedPage(quelle.getPage(0));
	for (const seite of seiten) {
		const { width, height } = seite.getSize();
		seite.drawPage(eingebettet, { x: 0, y: 0, width, height });
	}

	// Hier wird bewusst **nicht** geflusht. Das Dokument trägt eine als Teilmenge
	// eingebettete Schrift; ein Flush schliesst diese Teilmenge ab, und das
	// anschliessende Speichern läuft dann in eine Schrift ohne Zeichenbreiten.
	// Die Vorprüfung oben ist die Absicherung: Was sich in ein leeres Dokument
	// einbetten liess, lässt sich auch hier einbetten — das Einbetten einer
	// Seite hängt nicht davon ab, was sonst im Zieldokument steht.
	return { verwendet: true };
}

/**
 * Ein mehrseitiges PDF in einseitige zerlegen.
 *
 * **Wozu** (07.09.2026, aus dem Code-Review): Der Versandsatz legt je Person
 * ein Vollmachtsformular bei. Es je Person **einzeln zu erzeugen** hiess, für
 * jede Partei ein neues Dokument aufzuspannen und beide DejaVu-Schriften neu
 * von der Platte zu lesen und als Teilmenge einzubetten — bei vierzig Parteien
 * achtzig Dateilesevorgänge im Anfragepfad. Erzeugt wird jetzt **ein** Dokument
 * mit einer Seite je Partei, und hier wird die passende herausgelöst.
 *
 * Das Kopieren nimmt die Schriften mit; ein zweites Einbetten gibt es nicht.
 */
export async function seitenEinzeln(bytes: Uint8Array): Promise<Uint8Array[]> {
	/*
	 * **Die Quelle einmal laden** (Code-Review 07.09.2026). Die erste Fassung
	 * hiess `seiteAus(bytes, stelle)` und lud das ganze Dokument je Seite neu —
	 * bei vierzig Parteien vierzigmal über vierzig Seiten. Wer alle braucht,
	 * bekommt sie jetzt in einem Durchgang; wer eine braucht, nimmt die aus der
	 * Liste.
	 */
	const quelle = await PDFDocument.load(bytes, { ignoreEncryption: true });
	const einzeln: Uint8Array[] = [];
	for (const stelle of quelle.getPageIndices()) {
		const ziel = await PDFDocument.create();
		const [seite] = await ziel.copyPages(quelle, [stelle]);
		ziel.addPage(seite);
		einzeln.push(await ziel.save());
	}
	return einzeln;
}

/**
 * Fügt fertige PDF an eines an.
 *
 * Für den Versandsatz aus Traktandenliste und Zugangskarte (Story 3.7).
 */
export async function fuegeZusammen(teile: Uint8Array[]): Promise<Uint8Array> {
	const ziel = await PDFDocument.create();
	for (const teil of teile) {
		const quelle = await PDFDocument.load(teil, { ignoreEncryption: true });
		const seiten = await ziel.copyPages(quelle, quelle.getPageIndices());
		for (const s of seiten) ziel.addPage(s);
	}
	return ziel.save();
}
