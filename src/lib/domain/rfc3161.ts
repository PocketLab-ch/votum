/**
 * Zeitstempel nach RFC 3161 — Anfrage bauen, Antwort lesen (rein).
 *
 * **Wozu.** Das Siegel sagt, *dass* etwas unverändert ist. Der Zeitstempel sagt,
 * **wann** es entstand, und zwar von einer Stelle, die nichts mit uns zu tun
 * hat. Ohne ihn liesse sich behaupten, das Paket sei erst nach der Anfechtung
 * gebaut worden.
 *
 * **Was hier geschieht und was nicht.** Hier wird die Anfrage gebaut und die
 * Antwort zerlegt: Zustand, Zeitpunkt, Prüfsumme, auf die der Stempel lautet,
 * und das Zertifikat, das ihn ausgestellt hat. Die **Signaturprüfung** liegt in
 * der Schale — sie braucht Schlüssel und damit das Laufzeitsystem (AD-1).
 *
 * **Der Zufallswert kommt von aussen.** Er verhindert, dass eine alte Antwort
 * wiedergespielt wird; der Kern zieht keine Zufallszahlen.
 */
import {
	folge,
	ganzzahl,
	kinder,
	lies,
	oidInWorten,
	schreibe,
	schreibeGanzzahl,
	schreibeOid,
	verkette,
	zeitpunkt,
	BOOLEAN,
	DerFehler,
	NULL_ELEMENT,
	OCTET_STRING,
	SEQUENCE,
	type Element
} from './asn1';

const OID_SHA256 = '2.16.840.1.101.3.4.2.1';
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_TSTINFO = '1.2.840.113549.1.9.16.1.4';
const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';

/**
 * Welches Streuverfahren hinter einem OID steckt.
 *
 * **Nicht raten, sondern lesen.** Der erste Prüflauf gegen einen echten Dienst
 * scheiterte genau hier: Die Anfrage lautet auf SHA-256, der Dienst signiert
 * seine Antwort aber mit SHA-512. Wer den Wert der Anfrage einsetzt, rechnet
 * eine Prüfsumme, die nie stimmt — und hält einen gültigen Zeitstempel für
 * gefälscht.
 */
const STREUVERFAHREN: Record<string, string> = {
	'1.3.14.3.2.26': 'sha1',
	'2.16.840.1.101.3.4.2.1': 'sha256',
	'2.16.840.1.101.3.4.2.2': 'sha384',
	'2.16.840.1.101.3.4.2.3': 'sha512',
	// Signaturverfahren, die das Streuverfahren mitführen.
	'1.2.840.113549.1.1.11': 'sha256',
	'1.2.840.113549.1.1.12': 'sha384',
	'1.2.840.113549.1.1.13': 'sha512',
	'1.2.840.10045.4.3.2': 'sha256',
	'1.2.840.10045.4.3.3': 'sha384',
	'1.2.840.10045.4.3.4': 'sha512'
};

/** Der Name des Streuverfahrens, wie ihn das Laufzeitsystem kennt. */
export function streuverfahren(oid: string): string | null {
	return STREUVERFAHREN[oid] ?? null;
}

/** Zustände nach RFC 3161 §2.4.2. */
export const ZUSTAENDE: Record<number, string> = {
	0: 'angenommen',
	1: 'angenommen, mit Vorbehalt',
	2: 'abgelehnt',
	3: 'wartet',
	4: 'Widerruf steht bevor',
	5: 'widerrufen'
};

/**
 * Baut eine Zeitstempelanfrage über eine SHA-256-Prüfsumme.
 *
 * `certReq` steht auf wahr: Ohne das mitgelieferte Zertifikat liesse sich die
 * Antwort später nur prüfen, wenn man es anderswoher hat — und in zehn Jahren
 * hat man es nicht.
 */
export function baueAnfrage(pruefsumme: Uint8Array, zufall: Uint8Array): Uint8Array {
	if (pruefsumme.length !== 32) {
		throw new DerFehler('Die Prüfsumme ist keine SHA-256-Summe.');
	}
	const algorithmus = schreibe(SEQUENCE, verkette(schreibeOid(OID_SHA256), schreibe(NULL_ELEMENT, [])));
	const imprint = schreibe(SEQUENCE, verkette(algorithmus, schreibe(OCTET_STRING, pruefsumme)));

	return schreibe(
		SEQUENCE,
		verkette(
			schreibeGanzzahl(1),
			imprint,
			schreibeGanzzahl(zufall),
			schreibe(BOOLEAN, [0xff])
		)
	);
}

export interface Zeitstempelbefund {
	/** Der Zustand, den der Dienst gemeldet hat. */
	zustand: number;
	zustandInWorten: string;
	angenommen: boolean;
	/** Der Text des Dienstes, wenn er einen mitgibt. */
	meldung: string | null;
	/** Nur bei Annahme gesetzt. */
	token: Token | null;
}

export interface Token {
	/** Die Prüfsumme, auf die der Stempel lautet — hexadezimal. */
	pruefsumme: string;
	/** Der bezeugte Zeitpunkt, als ISO-Zeichenkette. */
	zeitpunkt: string;
	seriennummer: string;
	/** Der Zufallswert der Anfrage, sofern der Dienst ihn zurückgibt. */
	zufall: string | null;
	/** Die mitgelieferten Zertifikate in DER — das erste ist der Aussteller. */
	zertifikate: Uint8Array[];
	/** Was signiert wurde und womit — für die Prüfung in der Schale. */
	signatur: {
		/** Die signierten Attribute, **neu ausgezeichnet als SET** (RFC 5652 §5.4). */
		signierteAttribute: Uint8Array;
		wert: Uint8Array;
		algorithmus: string;
		/** Die Prüfsumme über den Inhalt, wie sie in den Attributen steht. */
		inhaltspruefsumme: string | null;
		/**
		 * Womit gestreut wurde — aus der Antwort gelesen, nicht aus der Anfrage
		 * übernommen. Ein Dienst darf mit einem anderen Verfahren signieren, als
		 * die Anfrage verwendet hat, und tut es auch.
		 */
		streuverfahren: string;
	} | null;
	/** Der signierte Inhalt (TSTInfo in DER) — die Prüfsumme darüber gehört geprüft. */
	inhalt: Uint8Array;
}

function alsHex(b: Uint8Array): string {
	return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Zerlegt die Antwort des Dienstes.
 *
 * Wirft bei allem, was nicht passt. Ein Zeitstempel, den man nicht vollständig
 * versteht, ist als Beweismittel wertlos — und schlimmer als keiner, weil er
 * Sicherheit vortäuscht.
 */
export function leseAntwort(daten: Uint8Array): Zeitstempelbefund {
	const { element: aussen } = lies(daten);
	if (aussen.kennzeichen !== SEQUENCE) throw new DerFehler('Keine TimeStampResp.');
	const teile = kinder(aussen);

	const status = kinder(teile[0]);
	const zustand = ganzzahl(status[0]);
	let meldung: string | null = null;
	if (status.length > 1 && status[1].kennzeichen === SEQUENCE) {
		const texte = kinder(status[1]).map((e) => new TextDecoder().decode(e.inhalt));
		meldung = texte.join(' ') || null;
	}

	const angenommen = zustand === 0 || zustand === 1;
	if (!angenommen || teile.length < 2) {
		return {
			zustand,
			zustandInWorten: ZUSTAENDE[zustand] ?? `unbekannt (${zustand})`,
			angenommen,
			meldung,
			token: null
		};
	}

	return {
		zustand,
		zustandInWorten: ZUSTAENDE[zustand] ?? `unbekannt (${zustand})`,
		angenommen,
		meldung,
		token: leseToken(teile[1])
	};
}

/** ContentInfo → SignedData → TSTInfo. */
function leseToken(contentInfo: Element): Token {
	const ci = kinder(contentInfo);
	if (oidInWorten(ci[0]) !== OID_SIGNED_DATA) throw new DerFehler('Kein SignedData im Token.');
	// ci[1] ist die ausdrückliche Umhüllung [0]; darin liegt genau ein SignedData.
	const signedData = kinder(ci[1])[0];
	const sd = kinder(signedData);

	// sd: version, digestAlgorithms, encapContentInfo, [0] certificates?, [1] crls?, signerInfos
	const encap = kinder(sd[2]);
	if (oidInWorten(encap[0]) !== OID_TSTINFO) throw new DerFehler('Kein TSTInfo im Token.');
	const inhalt = kinder(encap[1])[0].inhalt;

	const zertifikate: Uint8Array[] = [];
	let signerInfos: Element | null = null;
	for (const teil of sd.slice(3)) {
		if (teil.kennzeichen === 0xa0) {
			for (const z of folge(teil.inhalt)) zertifikate.push(z.roh);
		} else if (teil.kennzeichen === 0x31) {
			signerInfos = teil;
		}
	}

	/*
	 * `inhalt` ist die DER-Darstellung des TSTInfo — **einer** Folge. Die
	 * Prüfsumme über genau diese Bytes steht in den signierten Attributen; die
	 * Felder liegen eine Ebene tiefer.
	 */
	const tst = kinder(lies(inhalt).element);
	// version, policy, messageImprint, serialNumber, genTime, …
	const imprint = kinder(tst[2]);
	const pruefsumme = alsHex(imprint[1].inhalt);
	const seriennummer = alsHex(tst[3].inhalt);
	const gen = tst.find((e) => e.kennzeichen === 0x18);
	if (!gen) throw new DerFehler('Kein Zeitpunkt im Zeitstempel.');

	// Der Zufallswert steht hinter genTime, als INTEGER — falls der Dienst ihn
	// zurückgibt. Ohne ihn liesse sich eine alte Antwort wiederspielen.
	const nachGen = tst.slice(tst.indexOf(gen) + 1);
	const zufallsElement = nachGen.find((e) => e.kennzeichen === 0x02);

	return {
		pruefsumme,
		zeitpunkt: zeitpunkt(gen),
		seriennummer,
		zufall: zufallsElement ? alsHex(zufallsElement.inhalt) : null,
		zertifikate,
		signatur: signerInfos ? leseSignatur(signerInfos) : null,
		inhalt
	};
}

function leseSignatur(signerInfos: Element): Token['signatur'] {
	// Genau ein Unterzeichner — mehr kommt in einem Zeitstempel nicht vor.
	const si = kinder(folge(signerInfos.inhalt)[0]);
	// si: version, sid, digestAlgorithm, [0] signedAttrs?, signatureAlgorithm, signature
	const signedAttrs = si.find((e) => e.kennzeichen === 0xa0);
	if (!signedAttrs) return null;

	/*
	 * **Neu ausgezeichnet als SET.** RFC 5652 §5.4: Signiert wird die
	 * DER-Darstellung der Attribute mit dem Kennzeichen SET, nicht mit dem
	 * kontextabhängigen [0], unter dem sie im Token stehen. Wer das übersieht,
	 * bekommt eine Signatur, die nie stimmt — und hält den Zeitstempel für
	 * gefälscht.
	 */
	const alsSet = schreibe(0x31, signedAttrs.inhalt);

	// si[2] ist das Streuverfahren der signierten Attribute.
	const streuOid = oidInWorten(kinder(si[2])[0]);

	const nachAttrs = si.slice(si.indexOf(signedAttrs) + 1);
	const algorithmus = nachAttrs.find((e) => e.kennzeichen === SEQUENCE);
	const wert = nachAttrs.find((e) => e.kennzeichen === OCTET_STRING);
	if (!algorithmus || !wert) throw new DerFehler('Signatur unvollständig.');

	// Die Prüfsumme über den Inhalt steht als Attribut; sie bindet die
	// signierten Attribute an das TSTInfo.
	let inhaltspruefsumme: string | null = null;
	for (const attribut of folge(signedAttrs.inhalt)) {
		const a = kinder(attribut);
		if (oidInWorten(a[0]) === OID_MESSAGE_DIGEST) {
			inhaltspruefsumme = alsHex(kinder(a[1])[0].inhalt);
		}
	}

	const signaturOid = oidInWorten(kinder(algorithmus)[0]);
	return {
		signierteAttribute: alsSet,
		wert: wert.inhalt,
		algorithmus: signaturOid,
		inhaltspruefsumme,
		// Das Signaturverfahren führt das Streuverfahren oft mit; wo nicht, gilt
		// das der Attribute.
		streuverfahren: streuverfahren(signaturOid) ?? streuverfahren(streuOid) ?? 'sha256'
	};
}

/**
 * Ob der zurückgegebene Zufallswert der gesendete ist.
 *
 * **Nicht byteweise vergleichen.** Der Zufallswert reist als ganze Zahl in DER,
 * und DER schreibt Zahlen kürzestmöglich: führende Nullbytes fallen weg, und
 * vor ein gesetztes oberstes Bit kommt eines dazu. Wer die Bytes vergleicht,
 * meldet bei jeder zweiten Anfrage einen Wiedereinspielungsversuch — der erste
 * Lauf gegen einen echten Dienst tat genau das.
 */
export function zufallStimmt(token: Token, gesendet: string): boolean {
	if (token.zufall === null) return true; // Nicht jeder Dienst gibt ihn zurück.
	const nackt = (h: string) => h.toLowerCase().replace(/^(00)+/, '') || '0';
	return nackt(token.zufall) === nackt(gesendet);
}

/** Ob der Stempel auf **diese** Prüfsumme lautet (FR-54). */
export function lautetAuf(token: Token, pruefsumme: string): boolean {
	return token.pruefsumme.toLowerCase() === pruefsumme.toLowerCase();
}
