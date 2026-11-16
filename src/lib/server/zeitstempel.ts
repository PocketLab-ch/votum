/**
 * Den Zeitstempel holen und prüfen (FR-53).
 *
 * Der Kern in `$lib/domain/rfc3161` baut die Anfrage und zerlegt die Antwort;
 * hier wird gesendet, geprüft, abgelegt und eingetragen (AD-1).
 *
 * **Was ein Zeitstempel leistet — und was nicht.** Er bezeugt, dass eine
 * bestimmte Prüfsumme zu einem bestimmten Zeitpunkt bereits vorlag. Er sagt
 * nichts darüber, ob der Inhalt richtig ist.
 *
 * **Bezeugt wird das Siegel — die Prüfsumme über das Manifest.** Nicht die des
 * Pakets, und zwar aus zwei Gründen. Erstens deckt das Manifest ohnehin jeden
 * Bestandteil ab, also bindet der Stempel über es alles mit. Zweitens steht das
 * Siegel **vor** dem Packen fest: Nur so kann die Antwort des Dienstes noch
 * mit ins Paket (FR-53). Bezeugte der Stempel das Paket, änderte er es beim
 * Hineinlegen und zerstörte die eigene Aussage.
 *
 * Wird er später nachgeholt — im Versammlungsraum ohne Netz der Regelfall —,
 * ist das Paket längst geschlossen. Dann liegt er als eigene Datei daneben.
 *
 * **Ohne Netz bricht nichts ab.** Der Abschluss einer Versammlung darf nicht am
 * Internet hängen (AD-9). Die Lücke wird ausgewiesen und nachgeholt.
 */
import { createHash, createVerify, randomBytes, X509Certificate } from 'node:crypto';
import { alsBetreiber } from './db';
import { legeInternAb, lies } from './dateien';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import {
	baueAnfrage,
	lautetAuf,
	leseAntwort,
	zufallStimmt,
	type Token
} from '$lib/domain/rfc3161';
import { DerFehler } from '$lib/domain/asn1';
import type { Id } from '$lib/domain/types';

/** Wie lange auf den Dienst gewartet wird, bevor **ein Versuch** aufgibt. */
const GEDULD_MS = 10_000;

/**
 * Wie oft angefragt wird, und wie lange dazwischen gewartet wird.
 *
 * **Warum überhaupt wiederholt wird.** Ein Zeitstempel ist ein einziger Aufruf
 * über das offene Netz an ein fremdes Haus. Ein Lastverteiler, der einen
 * schlechten Knoten erwischt, eine abgeschnittene Antwort, ein kurzer
 * Aussetzer — das geht beim zweiten Mal durch. Ein einziger Fehlschlag
 * hinterliesse dagegen ein Siegel ohne Bezeugung, und bemerkt würde das erst,
 * wenn jemand die Übersicht liest.
 *
 * **Warum nicht öfter.** Beim Versiegeln steht jemand davor und wartet. Ohne
 * Netz scheitert jeder Versuch sofort — die Namensauflösung schlägt fehl —,
 * also kosten drei Anläufe dort nur die Pausen. Beim hängenden Dienst ist die
 * obere Schranke rund 33 Sekunden. Seit dem Ersatzdienst (13.11.2026) kommt
 * sein einer Anlauf dazu, zusammen rund 43 Sekunden; mehr wäre im Saal nicht
 * zu vertreten.
 *
 * **Und sie läuft in der Transaktion des Versiegelns.** `bezeuge` wird aus
 * `versiegleUnterSperre` aufgerufen (`server/siegel.ts`), also während die
 * Versammlung mit `FOR UPDATE` gesperrt ist. Die Wartezeit auf einen fremden
 * Dienst hält diese Sperre offen; das ist der Preis dafür, dass der Stempel
 * noch ins Paket kommt, und der Grund, warum die Anläufe gedeckelt sind.
 */
const VERSUCHE = 3;
const PAUSEN_MS = [1000, 2000];

function warte(ms: number): Promise<void> {
	return new Promise((fertig) => setTimeout(fertig, ms));
}

export interface Zeitstempeldienst {
	url: string;
	/** Wie die Stelle heissen soll, wenn das Zertifikat keinen Namen hergibt. */
	name: string;
	/**
	 * Zugelassene Fingerabdrücke (SHA-256) der Signaturzertifikate.
	 *
	 * **Warum angeheftet.** Ein Zeitstempel ist nur so viel wert wie die Frage,
	 * wer ihn ausgestellt hat. Ohne Anheftung nähme die Anwendung jede Antwort
	 * an, die irgendjemand unter der eingestellten Adresse ausliefert — auch die
	 * eines Angreifers, der sich dazwischenschaltet. Ist die Liste leer, wird
	 * das im Siegel vermerkt statt verschwiegen.
	 */
	fingerabdruecke: string[];
	/** Woher die Einstellung stammt. Steht in der Anzeige — sonst sucht jemand am falschen Ort. */
	quelle: 'anwendung' | 'umgebung';
}

function fingerabdruckliste(roh: string | null | undefined): string[] {
	return (roh ?? '')
		.split(/[,\s]+/)
		.map((f) => f.trim().toUpperCase())
		.filter(Boolean);
}

/** Was in der Umgebung steht — der Rückfall, wenn in der Anwendung nichts eingerichtet ist. */
export function umgebungsdienst(): Zeitstempeldienst | null {
	const url = process.env.VERSAMMLUNG_ZEITSTEMPEL_URL?.trim();
	if (!url) return null;
	return {
		url,
		// Ein unbrauchbarer Eintrag darf nicht schon beim Lesen der Einstellung
		// alles hinwerfen; er scheitert später beim Anruf, und dann mit Grund.
		name: process.env.VERSAMMLUNG_ZEITSTEMPEL_NAME?.trim() || URL.parse(url)?.host || url,
		fingerabdruecke: fingerabdruckliste(process.env.VERSAMMLUNG_ZEITSTEMPEL_FINGERABDRUECKE),
		quelle: 'umgebung'
	};
}

/**
 * Der geltende Dienst: was in der Anwendung steht, sonst die Umgebung
 * (14.08.2026).
 *
 * Vorrang für die Anwendung, aus demselben Grund wie bei der KI-Kette: Sonst
 * liesse sich in der Oberfläche nichts ändern, solange die Umgebung etwas
 * trägt — und man suchte den Fehler am falschen Ort.
 */
export async function dienst(operatorId: Id): Promise<Zeitstempeldienst | null> {
	const [zeile] = await alsBetreiber(operatorId, async (tx) => {
		return tx<{ tsa_url: string | null; tsa_name: string | null; tsa_fingerprints: string | null }[]>`
			SELECT tsa_url, tsa_name, tsa_fingerprints FROM operator WHERE id = ${operatorId}
		`;
	});

	const url = zeile?.tsa_url?.trim();
	if (!url) return umgebungsdienst();

	return {
		url,
		name: zeile.tsa_name?.trim() || URL.parse(url)?.host || url,
		fingerabdruecke: fingerabdruckliste(zeile.tsa_fingerprints),
		quelle: 'anwendung'
	};
}

/**
 * Der Ersatzdienst (13.11.2026).
 *
 * **Nur aus der Anwendung.** Anders als der Hauptdienst hat er keine
 * Umgebungsvariable: Er ist eine Ausweichung für den laufenden Betrieb, und
 * eine, deren Zustand niemand sieht, wäre im Ernstfall wertlos. Fehlt der
 * Eintrag, gibt es keinen Ersatz, auch wenn die Umgebung einen Hauptdienst
 * trägt.
 *
 * **Ohne Rückfall auf den Hauptdienst.** Wer hier fragt, will wissen, was der
 * Ersatz sagt. Ein stiller Griff zum Hauptdienst machte aus der Ausweichung
 * eine zweite Hauptleitung und aus der Bemerkung am Siegel eine falsche
 * Auskunft.
 */
export async function ersatzdienst(operatorId: Id): Promise<Zeitstempeldienst | null> {
	const [zeile] = await alsBetreiber(operatorId, async (tx) => {
		return tx<
			{
				tsa_fallback_url: string | null;
				tsa_fallback_name: string | null;
				tsa_fallback_fingerprints: string | null;
			}[]
		>`
			SELECT tsa_fallback_url, tsa_fallback_name, tsa_fallback_fingerprints
			  FROM operator WHERE id = ${operatorId}
		`;
	});

	const url = zeile?.tsa_fallback_url?.trim();
	if (!url) return null;

	return {
		url,
		name: zeile.tsa_fallback_name?.trim() || URL.parse(url)?.host || url,
		fingerabdruecke: fingerabdruckliste(zeile.tsa_fallback_fingerprints),
		quelle: 'anwendung'
	};
}

export interface Versuchsergebnis {
	zustand: 'vorhanden' | 'ausstehend' | 'gescheitert';
	/** Im Klartext, für Anzeige und Verlauf. */
	bemerkung: string;
	zeitpunkt: string | null;
	stelle: string | null;
	/** Die Prüfsumme der abgelegten Antwort — darunter liegt die Datei. */
	pruefsumme: string | null;
	/** Wie viele Anläufe es brauchte. Fehlt, wenn der erste genügte. */
	anlaeufe?: number;
	/** Gesetzt, wenn Wiederholen nichts ändern würde. */
	endgueltig?: boolean;
	/**
	 * Ob der **Ersatzdienst** bezeugt hat (13.11.2026).
	 *
	 * Steht getrennt von der Bemerkung, weil daran eine Anzeige und eine
	 * Warnung hängen: Wer ein Siegel mit einem Stempel von freetsa vor sich
	 * hat, soll den Grund sehen, ohne den Satz zu durchsuchen.
	 */
	ersatz?: boolean;
	/**
	 * Der Aussteller, an dem die Anheftung scheiterte.
	 *
	 * **Nur für die Probe in der Maske** (13.11.2026): Wechselt der Hauptdienst
	 * sein Zertifikat, ist der Stempel in Ordnung und allein die Anheftung
	 * veraltet. Ohne diesen Befund meldete die Probe nur «nicht hinterlegt»
	 * und böte keinen Weg an, den neuen Abdruck zu übernehmen. Am Siegel
	 * bleibt das Feld ohne Wirkung; abgelegt wird nichts.
	 */
	unangehefteterAussteller?: UnangehefteterAussteller;
}

export interface UnangehefteterAussteller {
	fingerabdruck: string;
	name: string | null;
	gueltigVon: string;
	gueltigBis: string;
	zeitpunkt: string;
}

class Abgelehnt extends Error {}

/**
 * Eine Absage, die sich durch Wiederholen nicht ändert.
 *
 * Weist der Dienst die **Anfrage** zurück — falsches Format, nicht
 * unterstütztes Streuverfahren, Richtlinie —, dann tut er das beim zweiten Mal
 * genauso. Weiterzuklopfen wäre bloss Lärm; die Absage gehört stattdessen
 * sofort und im Wortlaut ans Siegel.
 */
class Endgueltig extends Abgelehnt {}

/**
 * Der Stempel ist geprüft und in Ordnung; allein der Aussteller ist nicht
 * angeheftet.
 *
 * **Eine eigene Klasse, weil daran ein Angebot hängt** (13.11.2026): Nach einem
 * Zertifikatswechsel soll die Probe den neuen Abdruck zeigen und zum Anheften
 * anbieten, statt nur abzulehnen. Das Zertifikat reist mit, damit die Maske
 * Aussteller und Gültigkeit nennen kann, ohne die Antwort nochmals zu lesen.
 */
class NichtAngeheftet extends Abgelehnt {
	constructor(
		nachricht: string,
		readonly zert: X509Certificate,
		readonly zeitpunkt: string
	) {
		super(nachricht);
	}
}

function zertifikatsname(zert: X509Certificate, ersatz: string): string {
	return (
		zert.subject?.split('\n').find((z) => z.startsWith('O=') || z.startsWith('CN='))?.slice(2) ??
		ersatz
	);
}

/**
 * Welches der mitgelieferten Zertifikate hat unterschrieben?
 *
 * **Nicht das erste nehmen.** RFC 5652 schreibt keine Reihenfolge vor, und die
 * Häuser halten es verschieden: freetsa und DigiCert stellen den Unterzeichner
 * voran, SwissSign stellt ihn ans **Ende**, DFN und Izenpe in die Mitte. Die
 * erste Fassung dieses Prüfers nahm `zertifikate[0]` und erklärte deren
 * Antworten für ungültig — eine falsche Anschuldigung gegen einwandfreie
 * Dienste, und im Betrieb ein Siegel ohne Bezeugung ohne erkennbaren Grund.
 *
 * Gesucht wird über die Signatur selbst statt über die Kennung aus dem
 * `SignerInfo`: Das ist genau die Eigenschaft, auf die es ankommt — wessen
 * Schlüssel die Attribute trägt. Ein Zertifikat, das nur zufällig richtig
 * benannt ist, käme damit nicht durch.
 */
export function findeUnterzeichner(token: Token): X509Certificate | null {
	const s = token.signatur;
	if (!s) return null;
	for (const roh of token.zertifikate) {
		let zert: X509Certificate;
		try {
			zert = new X509Certificate(Buffer.from(roh));
		} catch {
			continue;
		}
		const pruefer = createVerify(s.streuverfahren);
		pruefer.update(Buffer.from(s.signierteAttribute));
		try {
			if (pruefer.verify(zert.publicKey, Buffer.from(s.wert))) return zert;
		} catch {
			// Schlüsseltyp passt nicht zum Signaturverfahren — dann war es nicht
			// dieses Zertifikat.
		}
	}
	return null;
}

/**
 * Prüft die Antwort so streng, wie es geht — und wirft bei allem, was nicht
 * stimmt. Ein Stempel, der die Prüfung nur halb besteht, ist kein Beweismittel,
 * sondern eine Behauptung mit Siegelbild.
 */
function pruefeToken(token: Token, erwartet: string, zufall: string, d: Zeitstempeldienst): string {
	if (!lautetAuf(token, erwartet)) {
		throw new Abgelehnt(
			'Der Stempel lautet auf eine andere Prüfsumme als das Paket. Er gehört nicht dazu.'
		);
	}
	if (!zufallStimmt(token, zufall)) {
		throw new Abgelehnt(
			'Der Zufallswert der Anfrage kam verändert zurück. Das kann eine wiedereingespielte alte Antwort sein.'
		);
	}
	if (!token.signatur) {
		throw new Abgelehnt('Die Antwort trägt keine prüfbare Signatur.');
	}
	if (token.zertifikate.length === 0) {
		throw new Abgelehnt('Die Antwort enthält kein Zertifikat; die Signatur wäre nicht prüfbar.');
	}

	const s = token.signatur;
	const gestreut = createHash(s.streuverfahren).update(token.inhalt).digest('hex');
	if (s.inhaltspruefsumme !== gestreut) {
		throw new Abgelehnt('Die signierten Angaben gehören nicht zum bezeugten Inhalt.');
	}

	const zert = findeUnterzeichner(token);
	if (!zert) {
		throw new Abgelehnt(
			'Die Signatur des Dienstes stimmt zu keinem der mitgelieferten Zertifikate.'
		);
	}

	// Ein Zertifikat, das zur bezeugten Zeit noch nicht oder nicht mehr galt,
	// bezeugt nichts.
	const bezeugt = Date.parse(token.zeitpunkt);
	if (bezeugt < Date.parse(zert.validFrom) || bezeugt > Date.parse(zert.validTo)) {
		throw new Abgelehnt(
			`Der bezeugte Zeitpunkt liegt ausserhalb der Gültigkeit des Zertifikats (${zert.validFrom} bis ${zert.validTo}).`
		);
	}

	if (d.fingerabdruecke.length > 0 && !d.fingerabdruecke.includes(zert.fingerprint256)) {
		throw new NichtAngeheftet(
			`Das Zertifikat des Dienstes ist nicht hinterlegt (${zert.fingerprint256}). Angeheftet sind: ${d.fingerabdruecke.join(', ')}.`,
			zert,
			token.zeitpunkt
		);
	}

	return zertifikatsname(zert, d.name);
}

/**
 * Holt einen Zeitstempel auf eine Prüfsumme und legt die Antwort ab.
 *
 * **Ohne Datenbank.** Das Versiegeln braucht den Stempel, bevor es etwas
 * einzutragen gibt; das Nachholen braucht ihn danach. Beide rufen hier an.
 *
 * **Erst der Hauptdienst, dann der Ersatz** (13.11.2026). Liefert der
 * Hauptdienst nach seinen Anläufen keinen geprüften Stempel, gleich aus
 * welchem Grund und auch nach einer endgültigen Absage, folgt **ein** Anlauf
 * beim Ersatzdienst. Der Grund für den Ersatz ist praktisch immer derselbe:
 * Das Unterzeichnerzertifikat des Hauptdienstes hat gewechselt, und bis jemand
 * den neuen Abdruck anheftet, weist die Anheftung jeden seiner Stempel ab.
 * Ohne den Ersatz stünde in dieser Zeit jedes Siegel ohne Bezeugung da.
 *
 * **Der Ersatz bekommt genau einen Anlauf.** Er ist die Ausweichung, nicht
 * eine zweite Warteschlange: Im Saal wartet jemand, und die obere Schranke des
 * Versiegelns soll um höchstens einen Anlauf wachsen (Vorgabe
 * `GEDULD_MS`, 13.11.2026). Klappt es bei ihm nicht, steht das am Siegel.
 *
 * Wirft nie wegen des Dienstes: Ein Fehlschlag ist ein Ergebnis, kein Absturz.
 * Genau das unterscheidet den Fall vom immotool, wo der Vorgang abbricht.
 */
export async function bezeuge(
	operatorId: Id,
	pruefsumme: string
): Promise<Versuchsergebnis & { roh: Uint8Array | null }> {
	const haupt = await dienst(operatorId);
	if (!haupt) {
		/*
		 * **Auch mit eingetragenem Ersatz bleibt es dabei.** Ohne Hauptdienst
		 * wird niemand gefragt, und ein Ersatz, der allein stempelt, wäre ein
		 * Hauptdienst unter falschem Namen: Die Maske sagt «Ersatz», das Siegel
		 * bezeugte eine Stelle, die niemand als erste bestellt hat.
		 */
		return {
			zustand: 'ausstehend',
			bemerkung:
				'Es ist kein Zeitstempeldienst hinterlegt. Das Paket ist gültig, trägt aber keine ' +
				'Bezeugung von aussen. Einzurichten unter «Betreiber → Äussere Dienste».',
			zeitpunkt: null,
			stelle: null,
			pruefsumme: null,
			roh: null
		};
	}

	const hauptlauf = await mitWiederholung(pruefsumme, haupt);
	if (hauptlauf.zustand === 'vorhanden') return { ...hauptlauf, ersatz: false };

	const ersatz = await ersatzdienst(operatorId);
	if (!ersatz) return hauptlauf;

	/*
	 * **Ohne angeheftetes Zertifikat wird der Ersatz nicht gefragt**
	 * (13.11.2026, Sicherheitsprüfung). DigiCert läuft über http; wer im
	 * Netzweg sitzt, kann den Hauptdienst gezielt scheitern lassen. Stünde der
	 * Ersatz ohne Abdruck da, nähme Votum danach jede Antwort an, die unter
	 * seiner Adresse ausgeliefert wird. Die Ausweichung darf nicht die
	 * schwächere Prüfung sein. Der Grund gehört an das Siegel, sonst wirkt es
	 * wie ein vergessener Dienst.
	 */
	if (ersatz.fingerabdruecke.length === 0) {
		return {
			...hauptlauf,
			ersatz: false,
			bemerkung:
				`${hauptlauf.bemerkung} Der Ersatzdienst ${ersatz.name} wurde nicht gefragt: ` +
				'Für ihn ist kein Zertifikat angeheftet.'
		};
	}

	const ersatzlauf = await einVersuch(pruefsumme, ersatz);

	if (ersatzlauf.zustand === 'vorhanden') {
		/*
		 * **Beide gehören in die Bemerkung.** Wer später ein Siegel mit einem
		 * Stempel von freetsa vor sich hat, muss sehen, dass DigiCert gefragt
		 * wurde und warum es nicht ging. Stünde nur «Bezeugt durch Free TSA»,
		 * läse sich das wie ein planmässiger Wechsel, und der nächste, dessen
		 * DigiCert-Stempel abgewiesen wird, fände keinen Hinweis auf die Ursache.
		 */
		return {
			...ersatzlauf,
			ersatz: true,
			bemerkung:
				`Bezeugt durch ${ersatz.name} (Ersatz); der Hauptdienst ${haupt.name} ` +
				`scheiterte: ${hauptlauf.bemerkung}`
		};
	}

	return {
		...ersatzlauf,
		ersatz: false,
		bemerkung:
			`Weder der Hauptdienst ${haupt.name} noch der Ersatzdienst ${ersatz.name} lieferten ` +
			`einen geprüften Stempel. Hauptdienst: ${hauptlauf.bemerkung} ` +
			`Ersatzdienst: ${ersatzlauf.bemerkung}`
	};
}

/**
 * Bis zu drei Anläufe beim **selben** Dienst, mit Pausen dazwischen.
 *
 * **Warum überhaupt wiederholt wird** (siehe `VERSUCHE`). Und warum die
 * Bemerkung den ersten Fehlschlag mitführt: Steht am Siegel nur der letzte
 * Versuch, sieht ein geglückter zweiter Anlauf aus wie ein reibungsloser
 * erster, und niemand erfährt, dass der Dienst wackelt.
 */
async function mitWiederholung(
	pruefsumme: string,
	d: Zeitstempeldienst
): Promise<Versuchsergebnis & { roh: Uint8Array | null }> {
	let ergebnis = await einVersuch(pruefsumme, d);
	const zuerst = ergebnis.bemerkung;

	for (let n = 2; n <= VERSUCHE && ergebnis.zustand !== 'vorhanden' && !ergebnis.endgueltig; n++) {
		await warte(PAUSEN_MS[n - 2] ?? PAUSEN_MS[PAUSEN_MS.length - 1]);
		ergebnis = { ...(await einVersuch(pruefsumme, d)), anlaeufe: n };
	}

	// **Was zuerst schieflief, geht sonst verloren.**
	const anlaeufe = ergebnis.anlaeufe ?? 1;
	if (anlaeufe === 1) return ergebnis;
	return {
		...ergebnis,
		bemerkung:
			ergebnis.zustand === 'vorhanden'
				? `${ergebnis.bemerkung} Im ${anlaeufe}. Anlauf; der erste scheiterte: ${zuerst}`
				: `${ergebnis.bemerkung} (${anlaeufe} Versuche)`
	};
}

/**
 * Ein einzelner Anlauf gegen **genau diesen** Dienst, für die Probe in der
 * Maske.
 *
 * **Warum nicht über `bezeuge`.** Eine Probe soll zeigen, was *dieser* Dienst
 * antwortet, denn angeheftet wird der Abdruck, den sie zeigt. Liefe die Probe
 * des Ersatzes über `bezeuge`, käme der Stempel des Hauptdienstes zurück; liefe
 * die des Hauptdienstes über `bezeuge`, spränge bei dessen Ausfall der Ersatz
 * ein, und der Abdruck des einen Hauses landete in der Liste des anderen.
 * Genau das soll die Trennung verhindern.
 */
export function probeDienst(
	d: Zeitstempeldienst,
	pruefsumme: string
): Promise<Versuchsergebnis & { roh: Uint8Array | null }> {
	return einVersuch(pruefsumme, d);
}

/**
 * Ein einzelner Anlauf: fragen, lesen, **prüfen**, ablegen.
 *
 * Geprüft wird bei jedem Anlauf vollständig — Abdruck, Zufallswert, Signatur,
 * Gültigkeit des Zertifikats zum bezeugten Zeitpunkt, Anheftung. Ein Stempel,
 * der die Prüfung nicht besteht, kommt nie in die Ablage.
 */
async function einVersuch(
	pruefsumme: string,
	d: Zeitstempeldienst
): Promise<Versuchsergebnis & { roh: Uint8Array | null }> {
	// **Je Anlauf ein neuer Zufallswert.** Ihn zu wiederholen hiesse, die
	// Wiedereinspielungssperre aufzugeben, die er gerade darstellt.
	const zufall = randomBytes(8);
	const zufallHex = zufall.toString('hex');

	try {
		const anfrage = baueAnfrage(
			Uint8Array.from(Buffer.from(pruefsumme, 'hex')),
			new Uint8Array(zufall)
		);
		const antwort = await fetch(d.url, {
			method: 'POST',
			headers: { 'content-type': 'application/timestamp-query' },
			body: anfrage as unknown as BodyInit,
			signal: AbortSignal.timeout(GEDULD_MS)
		});
		if (!antwort.ok) {
			throw new Abgelehnt(`Der Dienst antwortete mit ${antwort.status} ${antwort.statusText}.`);
		}

		const roh = new Uint8Array(await antwort.arrayBuffer());
		const befund = leseAntwort(roh);
		if (!befund.angenommen || !befund.token) {
			throw new Endgueltig(
				`Der Dienst hat die Anfrage nicht angenommen: ${befund.zustandInWorten}${befund.meldung ? ` — ${befund.meldung}` : ''}.`
			);
		}

		const stelle = pruefeToken(befund.token, pruefsumme, zufallHex, d);
		// Erst nach bestandener Prüfung abgelegt: Was in der Ablage liegt, ist
		// geprüft.
		const abgelegt = await legeInternAb(roh);

		return {
			zustand: 'vorhanden',
			bemerkung: `Bezeugt durch ${stelle}.`,
			zeitpunkt: befund.token.zeitpunkt,
			stelle,
			pruefsumme: abgelegt.pruefsumme,
			roh
		};
	} catch (fehler) {
		// **Nicht «gescheitert», wenn nur das Netz fehlt.** Der Unterschied
		// zählt: «ausstehend» heisst nachholen, «gescheitert» heisst hinschauen.
		// Eine abgewiesene, unlesbare oder falsche Antwort ist das Zweite — sie
		// geht nicht von selbst weg.
		const beanstandet = fehler instanceof Abgelehnt || fehler instanceof DerFehler;
		const text = beanstandet
			? `${(fehler as Error).message}${fehler instanceof DerFehler ? ` (Antwort von ${d.name} nicht lesbar)` : ''}`
			: fehler instanceof Error && fehler.name === 'TimeoutError'
				? `Der Dienst ${d.name} hat nicht innert ${GEDULD_MS / 1000} Sekunden geantwortet.`
				: `Der Dienst ${d.name} war nicht erreichbar: ${fehler instanceof Error ? fehler.message : String(fehler)}`;
		/*
		 * **Der eine Abbruch, der ein Angebot mitbringt** (13.11.2026). Scheitert
		 * der Stempel allein an der Anheftung, ist er selbst geprüft: Signatur,
		 * Prüfsumme, Zufallswert und Gültigkeit haben bestanden. Die Probe darf
		 * deshalb den neuen Abdruck zeigen. Am Siegel bleibt es bei
		 * «gescheitert»; geholfen wird dort mit dem Ersatz, nicht mit einer
		 * gelockerten Prüfung.
		 */
		const unangeheftet = fehler instanceof NichtAngeheftet ? fehler : null;
		return {
			zustand: beanstandet ? 'gescheitert' : 'ausstehend',
			bemerkung: text,
			zeitpunkt: null,
			stelle: null,
			pruefsumme: null,
			roh: null,
			endgueltig: fehler instanceof Endgueltig,
			...(unangeheftet
				? {
						unangehefteterAussteller: {
							fingerabdruck: unangeheftet.zert.fingerprint256,
							name: zertifikatsname(unangeheftet.zert, d.name),
							// Als Datum, nicht als X.509-Zeichenkette: Die Maske zeigt
							// es einem Menschen, der den Aussteller prüfen soll.
							gueltigVon: new Date(unangeheftet.zert.validFrom).toISOString().slice(0, 10),
							gueltigBis: new Date(unangeheftet.zert.validTo).toISOString().slice(0, 10),
							zeitpunkt: unangeheftet.zeitpunkt
						}
					}
				: {})
		};
	}
}

/**
 * Holt den Zeitstempel für ein bestehendes Siegel nach und trägt ihn ein
 * (FR-53).
 *
 * Liest die Siegelzeile selbst, statt `holeSiegel` zu rufen: Das Versiegeln
 * braucht `bezeuge` aus dieser Datei, und ein gegenseitiger Verweis zwischen
 * beiden Bausteinen wäre ein Ring.
 */
export async function holeZeitstempel(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id
): Promise<Versuchsergebnis> {
	const zeile = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [r] = await tx<
			{ manifest_hash: string; timestamp_state: string; timestamp_at: string | null; timestamp_authority: string | null }[]
		>`
			SELECT manifest_hash, timestamp_state, timestamp_at, timestamp_authority
			  FROM seal WHERE meeting_id = ${meetingId}
		`;
		return r ?? null;
	});

	if (!zeile) {
		return {
			zustand: 'ausstehend',
			bemerkung: 'Diese Versammlung ist nicht versiegelt; es gibt nichts zu bezeugen.',
			zeitpunkt: null,
			stelle: null,
			pruefsumme: null
		};
	}
	if (zeile.timestamp_state === 'vorhanden') {
		return {
			zustand: 'vorhanden',
			bemerkung: 'Der Zeitstempel liegt bereits vor.',
			zeitpunkt: zeile.timestamp_at,
			stelle: zeile.timestamp_authority,
			pruefsumme: null
		};
	}

	const { roh: _unbenutzt, ...ergebnis } = await bezeuge(handelnder.operatorId, zeile.manifest_hash);
	return vermerke(handelnder, meetingId, ergebnis);
}

async function vermerke(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	ergebnis: Versuchsergebnis
): Promise<Versuchsergebnis> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`
			UPDATE seal
			   SET timestamp_state = ${ergebnis.zustand},
			       timestamp_at = ${ergebnis.zeitpunkt},
			       timestamp_hash = ${ergebnis.pruefsumme},
			       timestamp_authority = ${ergebnis.stelle},
			       timestamp_note = ${ergebnis.bemerkung},
			       timestamp_by_fallback = ${ergebnis.ersatz === true}
			 WHERE meeting_id = ${meetingId}
		`;

		if (ergebnis.zustand === 'vorhanden') {
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(EREIGNISARTEN.zeitstempelNachgeholt, { art: 'meeting', id: meetingId }, {
					zeitpunkt: ergebnis.zeitpunkt,
					stelle: ergebnis.stelle,
					antwort: ergebnis.pruefsumme,
					// Auch hier getrennt von der Bemerkung: Wer den Verlauf
					// durchsucht, soll den Ersatz finden, ohne Sätze zu lesen.
					ersatz: ergebnis.ersatz === true
				})
			);
		}
	});
	return ergebnis;
}

/** Die rohe Antwort des Dienstes — zum Herunterladen neben dem Paket. */
export async function holeZeitstempeldatei(
	operatorId: Id,
	meetingId: Id
): Promise<Uint8Array | null> {
	const zeile = await alsBetreiber(operatorId, async (tx) => {
		const [r] = await tx<{ timestamp_hash: string | null; timestamp_state: string }[]>`
			SELECT timestamp_hash, timestamp_state FROM seal WHERE meeting_id = ${meetingId}
		`;
		return r ?? null;
	});
	if (zeile?.timestamp_state !== 'vorhanden' || !zeile.timestamp_hash) return null;
	return lies(zeile.timestamp_hash);
}

// ── Einen vorliegenden Stempel beurteilen (FR-54) ───────────────────────────

export interface Zeitstempelbeurteilung {
	gueltig: boolean;
	/** Lautet er auf **dieses** Manifest? */
	lautetAufDiesesManifest: boolean;
	zeitpunkt: string | null;
	stelle: string | null;
	fingerabdruck: string | null;
	/** Ob dieser Aussteller hier hinterlegt ist. `null`, wenn niemand hinterlegt ist. */
	angeheftet: boolean | null;
	satz: string;
}

/**
 * Beurteilt einen Zeitstempel, der schon vorliegt — beim Prüfen eines fremden
 * Pakets.
 *
 * **Berichtet, statt abzuweisen.** Beim Holen ist ein nicht angehefteter
 * Aussteller ein Abbruchgrund: Man nimmt nicht an, was man nicht bestellt hat.
 * Beim Prüfen eines fremden Pakets ist er eine **Feststellung** — wer vor fünf
 * Jahren gestempelt hat, muss nicht in der heutigen Liste stehen, und ein
 * «ungültig» an dieser Stelle wäre schlicht falsch.
 */
export function beurteileZeitstempel(
	roh: Uint8Array,
	manifestPruefsumme: string,
	/**
	 * Die angehefteten Fingerabdrücke — als **Eingabe**, nicht hier gelesen
	 * (14.08.2026). Seit der Dienst in der Anwendung stehen kann, wäre das ein
	 * Datenbankzugriff mitten in einer Beurteilung, die sonst nur rechnet. Die
	 * Schale liest, diese Funktion bewertet (AD-1).
	 */
	angeheftete: string[] = []
): Zeitstempelbeurteilung {
	const leer: Zeitstempelbeurteilung = {
		gueltig: false,
		lautetAufDiesesManifest: false,
		zeitpunkt: null,
		stelle: null,
		fingerabdruck: null,
		angeheftet: null,
		satz: ''
	};

	let token: Token;
	try {
		const befund = leseAntwort(roh);
		if (!befund.angenommen || !befund.token) {
			return { ...leer, satz: `Die Datei ist keine Bezeugung: ${befund.zustandInWorten}.` };
		}
		token = befund.token;
	} catch (fehler) {
		return {
			...leer,
			satz: `Die Datei ist kein lesbarer Zeitstempel (${fehler instanceof Error ? fehler.message : String(fehler)}).`
		};
	}

	const lautetDrauf = lautetAuf(token, manifestPruefsumme);

	if (!token.signatur || token.zertifikate.length === 0) {
		return {
			...leer,
			lautetAufDiesesManifest: lautetDrauf,
			zeitpunkt: token.zeitpunkt,
			satz: 'Der Zeitstempel trägt keine prüfbare Signatur oder kein Zertifikat.'
		};
	}

	const s = token.signatur;
	const inhaltStimmt =
		s.inhaltspruefsumme === createHash(s.streuverfahren).update(token.inhalt).digest('hex');
	// Der Unterzeichner steht nicht zwingend an erster Stelle — siehe
	// `findeUnterzeichner`.
	const unterzeichner = inhaltStimmt ? findeUnterzeichner(token) : null;
	const zert = unterzeichner ?? new X509Certificate(Buffer.from(token.zertifikate[0]));
	const stelle =
		zert.subject?.split('\n').find((z) => z.startsWith('O=') || z.startsWith('CN='))?.slice(2) ??
		null;
	const signaturStimmt = unterzeichner !== null;

	const bezeugt = Date.parse(token.zeitpunkt);
	const zertGalt = bezeugt >= Date.parse(zert.validFrom) && bezeugt <= Date.parse(zert.validTo);

	const gueltig = signaturStimmt && zertGalt && lautetDrauf;
	const teile: string[] = [];
	if (!signaturStimmt) teile.push('die Signatur des Dienstes stimmt nicht');
	if (!zertGalt) teile.push('das Zertifikat galt zum bezeugten Zeitpunkt nicht');
	if (!lautetDrauf) {
		teile.push('er lautet auf eine andere Prüfsumme — er gehört zu einem anderen Manifest');
	}

	return {
		gueltig,
		lautetAufDiesesManifest: lautetDrauf,
		zeitpunkt: token.zeitpunkt,
		stelle,
		fingerabdruck: zert.fingerprint256,
		angeheftet: angeheftete.length === 0 ? null : angeheftete.includes(zert.fingerprint256),
		satz: gueltig
			? `Ausgestellt von ${stelle ?? 'unbekannter Stelle'} auf genau dieses Manifest, am ${token.zeitpunkt}.`
			: `Der Zeitstempel trägt nicht: ${teile.join('; ')}.`
	};
}
