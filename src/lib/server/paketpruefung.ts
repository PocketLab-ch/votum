/**
 * Ein Abschlusspaket prüfen — auch eines, das von aussen kommt (FR-54).
 *
 * **Der Fall, für den das gebaut ist:** Jemand legt in fünf Jahren ein ZIP auf
 * den Tisch und behauptet, so sei damals beschlossen worden. Dann muss sich
 * beantworten lassen, ob das Paket unverändert ist — ohne dass die Antwort
 * davon abhängt, dass die Versammlung noch in dieser Datenbank steht.
 *
 * Geprüft wird in vier getrennten Aussagen, wie FR-54 es verlangt. Ein einziges
 * «in Ordnung» wäre im Streitfall wertlos; die Frage ist immer, **was** nicht
 * stimmt:
 *
 *   1. Stimmen die Prüfsummen der Bestandteile gegen das Manifest?
 *   2. Stimmt die Prüfsumme des Manifests gegen das Siegel?
 *   3. Ist der Zeitstempel gültig und **auf dieses Manifest** ausgestellt?
 *   4. Kennt dieses System die Versammlung — und sagt es dasselbe?
 *
 * Aussage 2 braucht einen Vergleichswert von aussen: Das Siegel steht nicht im
 * Paket, sonst wäre es keiner. Es kommt entweder aus der eigenen Datenbank
 * oder wird von der prüfenden Person eingetippt. Fehlt beides, wird das gesagt
 * statt beschönigt.
 */
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { alsBetreiber } from './db';
import {
	beurteileZeitstempel,
	dienst,
	ersatzdienst,
	type Zeitstempelbeurteilung
} from './zeitstempel';
import { pruefe, type Manifest, type Pruefbefund } from '$lib/domain/siegel';
import { istNachtragsmanifest, type Nachtragsmanifest } from '$lib/domain/nachtragssiegel';
import { pruefeKetteDerVersammlung } from './nachtragssiegel';
import type { Id } from '$lib/domain/types';

function u16(b: Uint8Array, i: number): number {
	return b[i] | (b[i + 1] << 8);
}

function u32(b: Uint8Array, i: number): number {
	return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}

/**
 * Grösstes Abschlusspaket, das Prüfseite und Einspielen annehmen.
 *
 * **50 MB** (Produktentscheid 15.10.2026: «25 pro Dokument sollte eigentlich
 * ausreichen … und wenn man spassig ist 50 MB pro Datei»). Vorher 200 MB, je
 * Seite eine eigene Zahl; im Betrieb kam davon nie etwas an, weil adapter-node
 * ohne `BODY_SIZE_LIMIT` alles über 512 KB mit 413 abwies. Die Grenze dort
 * steht in `compose.prod.yml` und muss diese hier plus den Zeitstempel
 * fassen; `tests/domain/anfragegrenze.test.ts` hält beide beieinander.
 */
export const PAKET_HOECHSTGROESSE = 50 * 1024 * 1024;

export class PaketFehler extends Error {
	constructor(nachricht: string) {
		super(nachricht);
		this.name = 'PaketFehler';
	}
}

/**
 * Ein ZIP auseinandernehmen.
 *
 * **Warum hier und nicht im Kern.** Verdichtete Einträge brauchen `zlib`, und
 * der Kern kennt keine Node-Schnittstellen (AD-1). Eigene Pakete sind
 * unverdichtet; verdichtete kommen vor, wenn jemand den entpackten Ordner mit
 * einem gewöhnlichen Werkzeug neu gepackt hat — dann stimmen die Prüfsummen der
 * **Inhalte** weiterhin, und genau darauf kommt es an.
 */
/** Deckel gegen ein Archiv, das entpackt den Speicher sprengt (25.08.2026). */
const HOECHSTE_ENTPACKTE_GROESSE = 64 * 1024 * 1024;
const HOECHSTE_EINTRAEGE = 1000;

export function entpacke(archiv: Uint8Array): Map<string, Uint8Array> {
	let ende = -1;
	for (let i = archiv.length - 22; i >= 0; i--) {
		if (u32(archiv, i) === 0x06054b50) {
			ende = i;
			break;
		}
	}
	if (ende < 0) throw new PaketFehler('Das ist kein ZIP-Archiv: Das Ende des Verzeichnisses fehlt.');

	const anzahl = u16(archiv, ende + 10);
	if (anzahl > HOECHSTE_EINTRAEGE) {
		throw new PaketFehler(`Das Archiv hat mehr als ${HOECHSTE_EINTRAEGE} Einträge.`);
	}
	let gesamt = 0;
	let stelle = u32(archiv, ende + 16);
	const dekodierer = new TextDecoder();
	const aus = new Map<string, Uint8Array>();

	for (let n = 0; n < anzahl; n++) {
		if (u32(archiv, stelle) !== 0x02014b50) {
			throw new PaketFehler('Das Verzeichnis des Archivs ist beschädigt.');
		}
		const verfahren = u16(archiv, stelle + 10);
		const gepackt = u32(archiv, stelle + 20);
		const groesse = u32(archiv, stelle + 24);
		const namenslaenge = u16(archiv, stelle + 28);
		const zusatz = u16(archiv, stelle + 30);
		const kommentar = u16(archiv, stelle + 32);
		const ort = u32(archiv, stelle + 42);
		const name = dekodierer.decode(archiv.subarray(stelle + 46, stelle + 46 + namenslaenge));

		if (u32(archiv, ort) !== 0x04034b50) {
			throw new PaketFehler(`Der lokale Kopf von «${name}» ist beschädigt.`);
		}
		const beginn = ort + 30 + u16(archiv, ort + 26) + u16(archiv, ort + 28);

		if (verfahren === 0) {
			aus.set(name, archiv.subarray(beginn, beginn + groesse));
		} else if (verfahren === 8) {
			/*
				 * **Mit Deckel** (25.08.2026). `inflateRawSync` ohne
				 * `maxOutputLength` entpackt bis 4 GiB je Eintrag — und ein ZIP
				 * darf 65'535 Einträge führen. Gemessen: 200 MB Nullen verdichten
				 * auf 204 KB (1029:1) und blähen sich in 291 ms auf 460 MB
				 * Arbeitsspeicher zurück. Der Heap-Deckel greift dabei nicht, weil
				 * Puffer ausserhalb des JS-Speichers liegen.
				 *
				 * Seit die Übernahme fremde Excel-Dateien liest, ist das keine
				 * Frage mehr für ein selbst erzeugtes Abschlusspaket allein.
				 */
			/*
				 * **`uebrig + 1`, damit der Vergleich unten überhaupt greift**
				 * (25.08.2026, zweite Prüfrunde). Mit `uebrig` als Deckel bleibt
				 * `teil.length` immer darunter — der `PaketFehler` war toter Code,
				 * und stattdessen kam ein englischer `RangeError` («Cannot create a
				 * Buffer larger than …») aus der Tiefe. `/pruefen` und das
				 * Einspielen fangen nur `PaketFehler`: Dort endete ein zu grosses
				 * Paket neu in einer nackten Fehlerseite.
				 *
				 * Der `catch` fängt den Rest — ein verdorbener Verdichtungsstrom
				 * wirft ebenfalls, und auch das ist eine Absage, kein Serverfehler.
				 */
			const uebrig = HOECHSTE_ENTPACKTE_GROESSE - gesamt;
			let teil: Uint8Array;
			try {
				teil = new Uint8Array(
					inflateRawSync(archiv.subarray(beginn, beginn + gepackt), {
						maxOutputLength: uebrig + 1
					})
				);
			} catch (fehler) {
				if (fehler instanceof RangeError) {
					throw new PaketFehler('Das Archiv ist zu gross — entpackt über 64 MB.');
				}
				throw new PaketFehler('Ein Eintrag des Archivs lässt sich nicht entpacken.');
			}
			gesamt += teil.length;
			if (gesamt > HOECHSTE_ENTPACKTE_GROESSE) {
				throw new PaketFehler('Das Archiv ist zu gross — entpackt über 64 MB.');
			}
			aus.set(name, teil);
		} else {
			throw new PaketFehler(`«${name}» liegt in einem Verfahren vor, das hier nicht gelesen wird.`);
		}

		stelle += 46 + namenslaenge + zusatz + kommentar;
	}

	if (aus.size === 0) throw new PaketFehler('Das Archiv ist leer.');
	return aus;
}

export interface Herkunftsbefund {
	/** Kennt dieses System die Versammlung des Manifests? */
	bekannt: boolean;
	/** Stimmt das Siegel mit dem hier festgehaltenen überein? */
	stimmtUeberein: boolean | null;
	satz: string;
}

/**
 * Woher die Erwartung an die Zeitstempelstelle stammt.
 *
 * `manifest` ist die tragfähige Antwort: Der Fingerabdruck reiste mit dem
 * Paket. `betreiber` ist der Rückfall für ältere Pakete und sagt nur, wem
 * **dieses** System vertraut. `keine` heisst, dass niemand eine Erwartung
 * hinterlegt hat; das ist kein Mangel des Pakets und wird nicht so genannt.
 */
export type Erwartungsquelle = 'betreiber' | 'nur_manifest' | 'keine';

/**
 * Ob der Zeitstempel zu der Stelle passt, die das **Paket selbst** nennt.
 *
 * `keine` heisst, dass das Paket keine nennt oder kein Stempel beiliegt.
 * `verletzt` ist der scharfe Fall: Das Paket widerspricht sich selbst.
 */
export type Manifesterwartung = 'erfuellt' | 'verletzt' | 'keine';

/**
 * Woher der geprüfte Stempel kam — und warum das den Widerspruch entscheidet.
 *
 * **`im_paket`**: Der Stempel lag als `zeitstempel.tsr` im Archiv. Er entstand
 * unmittelbar nach dem Manifest, aus demselben Vorgang und mit demselben
 * hinterlegten Dienst. Nennt er eine andere Stelle als das Manifest, gibt es
 * dafür keine harmlose Erklärung.
 *
 * **`daneben`**: Der Stempel wurde getrennt eingereicht. So kommt jeder
 * nachgeholte Stempel (FR-53): Das Paket ist beim Nachholen längst geschlossen
 * und wird nicht neu geschrieben, also kann das Manifest den späteren
 * Aussteller gar nicht kennen. Ein Wechsel des Dienstes zwischen Versiegeln und
 * Nachholen ist ein **gewöhnlicher Betriebsvorgang**, und der Widerspruch, den
 * er erzeugt, ist keiner.
 *
 * **`ersetzt`**: Das Archiv führt einen Stempel, und **daneben** wurde ein
 * anderer eingereicht. Das ist der schärfste der drei Fälle, nicht der
 * mildeste: Ein Paket mit eigenem Stempel braucht keinen nachgeholten, denn
 * ein untauglicher kommt gar nicht erst hinein (`versiegle` legt
 * `zeitstempel.tsr` nur bei `stempel.roh` bei). Die Erzählung «nachgeholt»
 * ist hier also widerlegt, und beurteilt wird der Stempel **aus dem Paket**.
 *
 * Ohne diese Unterscheidung las sich alles gleich scharf — und die Warnung,
 * die im ernsten Fall trägt, hätte im harmlosen Fall die Gewöhnung erzeugt,
 * die sie entwertet.
 */
export type Stempelquelle = 'im_paket' | 'daneben' | 'ersetzt' | 'keine';

/** Bytegleich? Zwei Stempel, die sich nicht unterscheiden, sind derselbe. */
function gleich(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) return false;
	for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
	return true;
}

/**
 * Wo ein Paket einer Protokollfassung in der Kette steht (Ä-39).
 *
 * `haelt` ist `null`, wenn sich die Kette hier nicht nachrechnen lässt, weil
 * die Versammlung in dieser Anwendung nicht (mehr) steht. Dann sagt der Satz,
 * worauf das Paket verweist und wogegen es zu halten ist.
 */
export interface Kettenaussage {
	haelt: boolean | null;
	satz: string;
}

export interface Paketbefund {
	/** Abschlusspaket oder das Paket einer Protokollfassung mit Nachtragssiegel. */
	art: 'abschlusspaket' | 'nachtragssiegel';
	dateien: { pfad: string; groesse: number; pruefsumme: string }[];
	/** Das Manifest eines Abschlusspakets; `null` beim Paket einer Fassung. */
	manifest: Manifest | null;
	/** Das Manifest einer Fassung mit Nachtragssiegel; sonst `null`. */
	nachtragsmanifest?: Nachtragsmanifest | null;
	/** Die gerechnete Prüfsumme über `manifest.json` — das wäre das Siegel. */
	gerechnetesSiegel: string | null;
	/** Woher der Vergleichswert stammt. */
	siegelquelle: 'datenbank' | 'eingegeben' | 'keine';
	inhalt: Pruefbefund | null;
	zeitstempel: Zeitstempelbeurteilung | null;
	/** Woher die angehefteten Fingerabdrücke kamen, gegen die geprüft wurde. */
	erwartungsquelle: Erwartungsquelle;
	/** Ob der Stempel zu der Stelle passt, die das Paket selbst nennt. */
	manifesterwartung: Manifesterwartung;
	/** Lag der geprüfte Stempel im Paket oder daneben? */
	stempelquelle: Stempelquelle;
	herkunft: Herkunftsbefund;
	/** Nur beim Paket einer Protokollfassung: ihr Platz in der Kette. */
	kette: Kettenaussage | null;
	/**
	 * Die Versammlung steht hier, an der Nummer des Pakets aber keine Fassung
	 * mit Nachtragssiegel. Der Vergleich lief dann gegen nichts.
	 */
	fassungFehlt?: boolean;
	/** Die Antwort in einem Satz — für den Kopf der Seite. */
	satz: string;
}

function sha256(inhalt: Uint8Array): string {
	return createHash('sha256').update(inhalt).digest('hex');
}

/**
 * Prüft ein hochgeladenes Paket.
 *
 * `zeitstempelDatei` ist nur nötig, wenn der Stempel nicht im Paket liegt —
 * also wenn er nachgeholt wurde, nachdem das Paket schon geschlossen war.
 */
export async function pruefePaket(
	operatorId: Id,
	archiv: Uint8Array,
	zeitstempelDatei: Uint8Array | null,
	eingetipptesSiegel: string | null
): Promise<Paketbefund> {
	const dateien = entpacke(archiv);

	const gefunden = new Map<string, string>();
	const liste: Paketbefund['dateien'] = [];
	for (const [pfad, inhalt] of dateien) {
		const p = sha256(inhalt);
		gefunden.set(pfad, p);
		liste.push({ pfad, groesse: inhalt.byteLength, pruefsumme: p });
	}

	const manifestBytes = dateien.get('manifest.json');
	if (!manifestBytes) {
		return {
			art: 'abschlusspaket',
			dateien: liste,
			manifest: null,
			gerechnetesSiegel: null,
			siegelquelle: 'keine',
			inhalt: null,
			zeitstempel: null,
			erwartungsquelle: 'keine',
			manifesterwartung: 'keine',
			stempelquelle: 'keine',
			herkunft: { bekannt: false, stimmtUeberein: null, satz: 'Ohne Inhaltsverzeichnis nicht feststellbar.' },
			kette: null,
			satz: 'Das Archiv enthält kein Inhaltsverzeichnis («manifest.json»). Es ist kein ' +
			'Abschlusspaket dieser Anwendung.'
		};
	}

	let manifest: Manifest | Nachtragsmanifest;
	try {
		manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as Manifest | Nachtragsmanifest;
		/*
		 * **Ohne brauchbare Liste der Bestandteile ist es so unlesbar wie
		 * kaputtes JSON.** `pruefe` liest je Eintrag `pfad` und `pruefsumme`; ein
		 * Inhaltsverzeichnis ohne die Liste endete dort als `TypeError` und
		 * 500-Seite (Feldteil von `e2e/fremdbetreiber.mjs`, 27.10.2026, mit einem
		 * Paket, das nur die Versammlung nannte), ein Eintrag ohne diese Felder
		 * ebenso (Codeprüfung desselben Tags).
		 */
		const eintraege = (manifest as { eintraege?: unknown } | null)?.eintraege;
		const brauchbar =
			Array.isArray(eintraege) &&
			eintraege.every(
				(e) =>
					typeof e === 'object' &&
					e !== null &&
					typeof (e as { pfad?: unknown }).pfad === 'string' &&
					typeof (e as { pruefsumme?: unknown }).pruefsumme === 'string'
			);
		if (!brauchbar) throw new TypeError('Inhaltsverzeichnis ohne brauchbare Liste der Bestandteile');
	} catch {
		return {
			art: 'abschlusspaket',
			dateien: liste,
			manifest: null,
			gerechnetesSiegel: null,
			siegelquelle: 'keine',
			inhalt: null,
			zeitstempel: null,
			erwartungsquelle: 'keine',
			manifesterwartung: 'keine',
			stempelquelle: 'keine',
			herkunft: { bekannt: false, stimmtUeberein: null, satz: 'Ohne Inhaltsverzeichnis nicht feststellbar.' },
			kette: null,
			satz: 'Das Inhaltsverzeichnis («manifest.json») ist nicht lesbar. Das Paket ist beschädigt.'
		};
	}

	const gerechnet = sha256(manifestBytes);
	/*
	 * **Das Paket einer Protokollfassung** (Ä-39, H8 Teil B). Gleich gebaut wie
	 * das Abschlusspaket; anders sind nur der Vergleichswert, der an der Fassung
	 * steht, und die Frage nach der Kette. Den Zeitstempel trägt es nicht.
	 */
	const nachtrag = istNachtragsmanifest(manifest) ? manifest : null;

	// **Der Vergleichswert von aussen.** Die eigene Datenbank hat Vorrang: Sie
	// ist die einzige Quelle, die niemand mit dem Paket zusammen fälschen kann.
	//
	// **Ob die Versammlung hier steht, entscheidet ihr Siegel, nicht `art`**
	// (Codeprüfung H8, Teil B, Befund 2). `art` steht im ungeprüften Manifest.
	// Wer ein Abschlusspaket als Fassungspaket ausgab, schaltete sonst den
	// Vergleich ab: An der Nummer stand kein Nachtragssiegel, und die Seite
	// meldete «nicht (mehr) festgehalten» über eine Versammlung, die hier steht.
	const grundsiegelHier = await holeSiegelwert(operatorId, manifest.versammlung?.kennung ?? null);
	const fassungssiegelHier =
		nachtrag && grundsiegelHier
			? await holeNachtragssiegelwert(
					operatorId,
					nachtrag.versammlung?.kennung ?? null,
					nachtrag.protokollfassung?.nummer
				)
			: null;
	// Bekannt, aber an dieser Stelle ohne Nachtragssiegel: ein Befund, kein
	// fehlender Vergleichswert.
	const fassungFehlt = Boolean(nachtrag && grundsiegelHier && !fassungssiegelHier);
	const eigenes = nachtrag ? (grundsiegelHier ? (fassungssiegelHier ?? FEHLT) : null) : grundsiegelHier;
	const eingetippt = (eingetipptesSiegel ?? '').trim().toLowerCase();
	const vergleich = eigenes ?? (/^[0-9a-f]{64}$/.test(eingetippt) ? eingetippt : null);
	const siegelquelle = eigenes ? 'datenbank' : vergleich ? 'eingegeben' : 'keine';

	const inhalt = pruefe(manifest, gefunden, gerechnet, vergleich ?? gerechnet);

	/*
	 * **Das Archiv hat Vorrang, und die Herkunft wird gemessen statt geglaubt.**
	 *
	 * Die erste Fassung las die Herkunft aus dem **Formularfeld**: Wer eine
	 * Datei getrennt einreichte, bekam `daneben` und damit die harmlose
	 * Lesart. Die Sicherheitsprüfung vom 22.09.2026 hat das zerlegt, und zwar
	 * zu Recht: Ob ein Stempel nachgeholt wurde, ist keine Behauptung des
	 * Einreichenden, sondern eine Eigenschaft des Pakets. Ein nachgeholter
	 * Stempel setzt voraus, dass **kein** `zeitstempel.tsr` im Archiv liegt —
	 * und genau das steht in `dateien`.
	 *
	 * Wer einen widersprüchlichen Stempel im Paket hatte, musste ihn sonst nur
	 * herausziehen und ins zweite Feld legen; aus «dafür gibt es keine
	 * harmlose Erklärung» wurde «dazwischen kann der Dienst gewechselt haben».
	 *
	 * **Und der Vorrang schliesst eine zweite Lücke.** Mit `zeitstempelDatei ??
	 * Archiv` liess sich ein untauglicher Stempel im Paket durch einen
	 * eingereichten tauglichen verdecken: Beurteilt wurde nur der
	 * eingereichte. Der Stempel im Paket ist Teil des Versiegelten und damit
	 * das stärkere Beweisstück; er wird beurteilt, wenn es ihn gibt. Der
	 * Docstring oben sagt das ohnehin seit je («nur nötig, wenn der Stempel
	 * nicht im Paket liegt») — die Reihenfolge widersprach der eigenen Zusage.
	 */
	const imArchiv = dateien.get('zeitstempel.tsr') ?? null;
	const stempelBytes = imArchiv ?? zeitstempelDatei ?? null;
	const stempelquelle: Stempelquelle = imArchiv
		? zeitstempelDatei && !gleich(imArchiv, zeitstempelDatei)
			? 'ersetzt'
			: 'im_paket'
		: zeitstempelDatei
			? 'daneben'
			: 'keine';
	/*
	 * **Zwei Erwartungen, und sie werden nicht vermischt.**
	 *
	 * Die erste Fassung dieses Blocks liess die Angabe aus dem Manifest die
	 * angeheftete Liste des prüfenden Betreibers **verdrängen**. Die
	 * Sicherheitsprüfung vom 22.09.2026 hat das als Rückschritt benannt, und
	 * zwar zu Recht: Das Manifest ist genau der Bereich, den ein Angreifer
	 * schreibt, wenn er ein Paket neu versiegelt. Er hätte dort seine eigene
	 * Stelle eingetragen und aus «passt nicht» ein «passt» gemacht. Verloren
	 * gegangen wäre das einzige halbwegs unabhängige Signal, das es in der
	 * Lage ohne bekanntes Siegel gab.
	 *
	 * Deshalb bleibt `angeheftet` das, was es war: der Vergleich gegen die
	 * Liste **dieses** Systems. Die Angabe aus dem Paket kommt als eigene,
	 * zweite Aussage daneben.
	 *
	 * **Und was diese zweite Aussage wert ist, steht hier, damit es niemand
	 * später für mehr hält:** Sie ist eine Absichtserklärung, die mit dem
	 * Paket reist, keine kryptografische Bindung. Wer das Siegel neu rechnet,
	 * schreibt sie mit. Sie trägt erst zusammen mit einem Siegelwert von
	 * aussen, also aus der Datenbank des prüfenden Systems oder von Hand
	 * eingegeben. Ihr eigener Nutzen ist, dass ein Mensch sieht, welche Stelle
	 * beansprucht wird, und dass ein Widerspruch im Paket auffällt.
	 */
	const stelle = nachtrag ? null : (manifest as Manifest).zeitstempelstelle;
	const nurZeichen = (liste: unknown): string[] =>
		Array.isArray(liste) ? liste.filter((f): f is string => typeof f === 'string') : [];
	const hauptLautManifest = nurZeichen(stelle?.fingerabdruecke);
	const erwartetLautManifest = [
		...(Array.isArray(stelle?.fingerabdruecke) ? stelle.fingerabdruecke : []),
		/*
		 * **Der Ersatzdienst zählt zur Erwartung des Pakets** (13.11.2026).
		 * Er steht seit diesem Datum im Manifest, weil er das Siegel bezeugen
		 * kann, wenn der Hauptdienst ausfällt. Ohne ihn meldete die Seite einen
		 * Widerspruch, wo keiner ist, und zwar genau im Fall, für den der
		 * Ersatz gebaut wurde.
		 */
		...(Array.isArray(stelle?.ersatz?.fingerabdruecke) ? stelle.ersatz.fingerabdruecke : [])
	].filter(
		// Fremde Manifeste sind ungeprüftes JSON. Eine Zeichenkette statt einer
		// Liste überlebte `.length` und machte aus dem Vergleich einen
		// Teilstringvergleich.
		(f): f is string => typeof f === 'string'
	);
	/*
	 * **Hier reicht die Vereinigung beider Listen** (13.11.2026). Auf der
	 * Prüfseite geht es um eine Feststellung, nicht um eine Zulassung: Ist der
	 * Aussteller diesem Haus überhaupt bekannt? Das Manifest trennt zwar
	 * Haupt- und Ersatzliste, aber es ist die Erwartung von damals und kann
	 * mit dem Paket neu geschrieben sein; massgebend sind hier die heutigen
	 * Listen dieses Systems. Und die Antwort selbst sagt nicht, für welche
	 * Rolle ihr Aussteller angeheftet ist. Getrennt geprüft
	 * wird beim **Holen**: Dort prüft jeder Dienst ausschliesslich gegen seine
	 * eigene Liste (`pruefeToken`), und das ist die Grenze, an der eine
	 * falsche Zuordnung Schaden anrichtete.
	 */
	const [haupt, ersatz] = await Promise.all([dienst(operatorId), ersatzdienst(operatorId)]);
	const angeheftete = [...(haupt?.fingerabdruecke ?? []), ...(ersatz?.fingerabdruecke ?? [])];
	const erwartungsquelle: Erwartungsquelle = angeheftete.length
		? 'betreiber'
		: erwartetLautManifest.length
			? 'nur_manifest'
			: 'keine';
	const zeitstempel = stempelBytes
		? beurteileZeitstempel(stempelBytes, gerechnet, angeheftete)
		: null;

	/*
	 * Der Widerspruch **im Paket**: Es nennt eine Stelle, signiert hat eine
	 * andere. Das ist keine Alterserscheinung, sondern ein eigener Befund.
	 */
	/*
	 * **Ein Hauptdienst ohne Abdruck erwartet keinen bestimmten Aussteller**
	 * (Codeprüfung 13.11.2026, Runde 3). Seit K5 steht das Feld auch da, wenn
	 * nur der Ersatz angeheftet war; die Liste des Hauptdienstes ist dann leer.
	 * Im Regelfall stempelt trotzdem der Hauptdienst, und `pruefeToken` nimmt
	 * ihn ohne Anheftung an. Sein Abdruck steht in keiner Liste des Pakets,
	 * und «verletzt» wäre ein falscher Alarm. Erst mit einer Erwartung an den
	 * Hauptdienst ist ein fremder Aussteller ein Widerspruch.
	 */
	const manifesterwartung: Manifesterwartung =
		erwartetLautManifest.length === 0 || !zeitstempel?.fingerabdruck
			? 'keine'
			: erwartetLautManifest.includes(zeitstempel.fingerabdruck)
				? 'erfuellt'
				: hauptLautManifest.length === 0
					? 'keine'
					: 'verletzt';

	const herkunft: Herkunftsbefund = fassungFehlt
		? {
				bekannt: true,
				stimmtUeberein: false,
				satz:
					'Diese Versammlung ist hier festgehalten, aber an dieser Stelle trägt sie keine ' +
					'Protokollfassung mit Nachtragssiegel. Das Paket gehört nicht zu dem, was hier steht.'
			}
		: eigenes
		? {
				bekannt: true,
				stimmtUeberein: eigenes === gerechnet,
				satz:
					eigenes === gerechnet
						? 'Diese Versammlung ist hier festgehalten, und ihr Siegel stimmt mit dem gerechneten überein.'
						: 'Diese Versammlung ist hier festgehalten — mit einem **anderen** Siegel. Das Paket gehört nicht zu dem, was hier steht.'
			}
		: {
				bekannt: false,
				stimmtUeberein: null,
				satz:
					'Diese Versammlung ist in dieser Anwendung nicht (mehr) festgehalten. Geprüft wurde ' +
					'das Paket in sich' +
					(siegelquelle === 'eingegeben' ? ' und gegen das eingegebene Siegel.' : '.')
			};

	/*
	 * **Die Kette gilt nur für die hier festgehaltene Fassung** (Sicherheitsprüfung
	 * H8, Teil B). Nennt ein Paket Kennung und Nummer einer echten Fassung, trägt
	 * aber ein anderes Manifest, sagte die Kette sonst «hält» über eine Fassung,
	 * die nicht vorliegt, während der Kopf richtig die Abweichung meldet.
	 */
	const kette: Kettenaussage | null = !nachtrag
		? null
		: fassungFehlt
			? {
					// Die Versammlung steht hier, an dieser Stelle aber keine Fassung
					// mit Nachtragssiegel (Codeprüfung H8, Teil B, zweiter Durchgang,
					// N1): ein Befund über das Paket, nicht «nicht nachrechenbar».
					haelt: false,
					satz:
						(istFassungsnummer(nachtrag.protokollfassung?.nummer)
							? `Die Fassung Nr. ${nachtrag.protokollfassung.nummer} trägt hier kein Nachtragssiegel.`
							: 'Das Paket nennt keine Fassung, die hier ein Nachtragssiegel trägt.') +
						' Es gehört nicht zur Kette dieser Versammlung.'
				}
			: eigenes && eigenes !== gerechnet
				? {
						haelt: false,
						satz:
							'Die Kette wird für dieses Paket nicht beurteilt: Sein Inhaltsverzeichnis ist nicht ' +
							'das der hier festgehaltenen Fassung.'
					}
				: await ketteZumPaket(operatorId, nachtrag);

	return {
		art: nachtrag ? 'nachtragssiegel' : 'abschlusspaket',
		dateien: liste,
		manifest: nachtrag ? null : (manifest as Manifest),
		nachtragsmanifest: nachtrag,
		gerechnetesSiegel: gerechnet,
		siegelquelle,
		inhalt,
		zeitstempel,
		erwartungsquelle,
		manifesterwartung,
		stempelquelle,
		herkunft,
		kette,
		fassungFehlt,
		satz: nachtrag
			? fasseNachtragZusammen(inhalt, siegelquelle, herkunft, kette)
			: fasseZusammen(inhalt, siegelquelle, zeitstempel, herkunft)
	};
}

/**
 * Wo die Fassung in der Kette steht, nachgerechnet aus der Datenbank.
 *
 * Gerechnet wird die ganze Kette bis zu dieser Fassung: Ein Glied hält nur,
 * wenn alle davor halten, bis zum Siegel des Abschlusspakets.
 */
async function ketteZumPaket(operatorId: Id, m: Nachtragsmanifest): Promise<Kettenaussage> {
	const kennung = m.versammlung?.kennung ?? null;
	const nummer = m.protokollfassung?.nummer;
	const unbekannt: Kettenaussage = {
		haelt: null,
		satz:
			'Die Kette lässt sich hier nicht nachrechnen: Die Versammlung ist in dieser Anwendung ' +
			`nicht (mehr) festgehalten. Das Paket verweist auf das Siegel ${m.vorgaenger?.siegel ?? '?'}` +
			` und steht auf dem Siegel des Abschlusspakets ${m.grundsiegel ?? '?'}; prüfen Sie es dagegen.`
	};
	if (!kennung || !KENNUNG.test(kennung) || !istFassungsnummer(nummer)) return unbekannt;
	const kette = await pruefeKetteDerVersammlung(operatorId, kennung);
	if (!kette) return unbekannt;
	const glied = kette.glieder.find((g) => g.nummer === nummer);
	if (!glied) {
		return {
			haelt: false,
			satz: `Die Fassung Nr. ${nummer} trägt hier kein Nachtragssiegel. Sie gehört nicht zur Kette dieser Versammlung.`
		};
	}
	const bisHier = kette.glieder.filter((g) => g.nummer <= nummer);
	const gebrochen = bisHier.filter((g) => !g.haelt);
	if (!kette.grundsiegelHaelt || gebrochen.length > 0) {
		return { haelt: false, satz: kette.satz };
	}
	return {
		haelt: true,
		satz:
			`Die Kette hält bis zu dieser Fassung: Fassung Nr. ${nummer} verweist auf ` +
			(m.vorgaenger?.was === 'abschlusspaket'
				? 'das Siegel des Abschlusspakets'
				: `das Nachtragssiegel der Fassung Nr. ${m.vorgaenger?.nummer}`) +
			', und jedes Glied davor bis zum Siegel des Abschlusspakets stimmt.'
	};
}

function fasseNachtragZusammen(
	inhalt: Pruefbefund,
	quelle: Paketbefund['siegelquelle'],
	herkunft: Herkunftsbefund,
	kette: Kettenaussage | null
): string {
	if (!inhalt.bestandteileStimmen) {
		return 'Das Paket ist verändert worden: ' + inhalt.satz;
	}
	if (herkunft.bekannt && herkunft.stimmtUeberein === false) {
		return herkunft.satz;
	}
	if (quelle === 'keine') {
		return (
			'Der Wortlaut entspricht dem Inhaltsverzeichnis. Ob dieses selbst ausgetauscht wurde, ' +
			'lässt sich ohne das Nachtragssiegel aus einer anderen Quelle nicht sagen.'
		);
	}
	if (!inhalt.manifestStimmt) {
		return 'Das Nachtragssiegel hält nicht: Das Inhaltsverzeichnis wurde nach dem Festhalten verändert.';
	}
	return (
		'Das Nachtragssiegel hält: Der Wortlaut der Fassung und ihr Inhaltsverzeichnis sind ' +
		`unverändert. ${kette?.satz ?? ''} Einen Zeitstempel trägt ein Nachtragssiegel nicht.`
	);
}

function fasseZusammen(
	inhalt: Pruefbefund,
	quelle: Paketbefund['siegelquelle'],
	zeit: Zeitstempelbeurteilung | null,
	herkunft: Herkunftsbefund
): string {
	if (!inhalt.bestandteileStimmen) {
		return 'Das Paket ist verändert worden: ' + inhalt.satz;
	}
	if (herkunft.bekannt && herkunft.stimmtUeberein === false) {
		return herkunft.satz;
	}
	if (quelle === 'keine') {
		return (
			'Das Paket ist in sich stimmig: Jeder Bestandteil entspricht dem Inhaltsverzeichnis. ' +
			'Ob dieses selbst ausgetauscht wurde, lässt sich ohne Vergleichswert von aussen nicht ' +
			'sagen — dafür braucht es das Siegel aus einer anderen Quelle.'
		);
	}
	if (!inhalt.manifestStimmt) {
		return inhalt.satz;
	}
	if (zeit?.gueltig) {
		return `Das Siegel hält, und der Zeitstempel bezeugt es: ${zeit.satz}`;
	}
	if (zeit) {
		return `Das Siegel hält. Der Zeitstempel dagegen nicht: ${zeit.satz}`;
	}
	return (
		'Das Siegel hält: Jeder Bestandteil und das Inhaltsverzeichnis sind unverändert. ' +
		'Ein Zeitstempel liegt nicht bei.'
	);
}

/**
 * Eine Fassungsnummer, wie die Spalte sie fasst. Fremde Pakete sind
 * ungeprüftes JSON; eine Zahl ausserhalb von `int` käme sonst als rohe
 * Datenbankmeldung zurück statt als «hier nicht festgehalten».
 */
function istFassungsnummer(n: unknown): n is number {
	return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 2_147_483_647;
}

/**
 * Steht für «die Versammlung ist hier, die Fassung aber nicht». Kein Hexwert,
 * deshalb gleicht ihm kein gerechnetes Siegel.
 */
const FEHLT = 'fehlt';

/** Eine Kennung, wie diese Anwendung sie vergibt (wie `domain/verlauf.ts`). */
const KENNUNG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Das Nachtragssiegel einer Fassung, wie es hier festgehalten ist. */
async function holeNachtragssiegelwert(
	operatorId: Id,
	meetingId: string | null,
	nummer: unknown
): Promise<string | null> {
	if (!meetingId || !KENNUNG.test(meetingId) || !istFassungsnummer(nummer)) return null;
	return alsBetreiber(operatorId, async (tx) => {
		const [r] = await tx<{ seal_hash: string | null }[]>`
			SELECT seal_hash FROM minutes_version WHERE meeting_id = ${meetingId} AND number = ${nummer}
		`;
		return r?.seal_hash ?? null;
	});
}

async function holeSiegelwert(operatorId: Id, meetingId: string | null): Promise<string | null> {
	// Streng, nicht `[0-9a-f-]{36}`: 36 Bindestriche kamen sonst bis zum Cast
	// nach uuid und endeten als Fehlerseite (Codeprüfung H8, Befund 10).
	if (!meetingId || !KENNUNG.test(meetingId)) return null;
	return alsBetreiber(operatorId, async (tx) => {
		const [r] = await tx<{ manifest_hash: string }[]>`
			SELECT manifest_hash FROM seal WHERE meeting_id = ${meetingId}
		`;
		return r?.manifest_hash ?? null;
	});
}
