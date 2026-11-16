/**
 * Saalgeräte: Schlüsselpaare, Gerätecode und die Verschlüsselung für ein Gerät.
 *
 * **Das Verfahren in einem Satz.** Das Notebook erzeugt einmal zwei
 * Schlüsselpaare und zeigt die öffentlichen Teile als einen Code. Wer abgibt,
 * trägt ihn in der Hauptinstanz ein; ab dann wird jedes Paket für genau dieses
 * Gerät verschlüsselt, und niemand tippt mehr einen Schlüssel ab.
 *
 * **Warum zwei Paare.** X25519 kann ein gemeinsames Geheimnis aushandeln, aber
 * nicht unterschreiben; Ed25519 kann unterschreiben, aber kein Geheimnis
 * aushandeln. Das erste verschlüsselt das Vorbereitungspaket, das zweite weist
 * später die Rückgabe nach. Sie in eines zu zwängen ginge, ist aber genau die
 * Sorte Trickserei, die man in fünf Jahren nicht mehr versteht.
 *
 * **Was das Verfahren nicht leistet**, und beides gehört benannt, weil ein
 * halbes Versprechen schlechter ist als keines:
 *
 *   * Wer das laufende Notebook hat, hat beides: den geheimen Schlüssel und das
 *     Geheimnis aus der Umgebung. Geschützt ist das Paket auf dem Weg dorthin,
 *     also der Stick in der Jackentasche und die Datei auf einem fremden
 *     Rechner. Das ist der Weg, über den solche Daten tatsächlich abhandenkommen.
 *   * **Es gibt keinen Absendernachweis** (18.09.2026, aus der
 *     Sicherheitsprüfung). Verschlüsselt wird gegen den öffentlichen Teil des
 *     Geräts, und der ist öffentlich. Wer ihn kennt, kann ein eigenes Paket
 *     bauen, das sich sauber öffnet. Solange nur diese Richtung existiert und
 *     das Einspielen noch nicht gebaut ist, schadet das niemandem; **vor** dem
 *     Einspielweg muss die abgebende Stelle unterschreiben. Der Entwurf führt
 *     das als Vorbedingung von Block E3.
 */
import {
	createDecipheriv,
	createHash,
	createCipheriv,
	createPrivateKey,
	createPublicKey,
	diffieHellman,
	generateKeyPairSync,
	randomBytes,
	sign,
	verify
} from 'node:crypto';
import { entschluessele, verschluessele } from './tresor';

/** Die Kennung im Kopf eines verschlüsselten Pakets. */
const MARKE = 'VOTUMG1';

export interface Geraeteschluessel {
	encPublic: string;
	encSecret: string;
	sigPublic: string;
	sigSecret: string;
	fingerabdruck: string;
}

export interface OeffentlicherSchluessel {
	encPublic: string;
	sigPublic: string;
	fingerabdruck: string;
}

function roh(schluessel: string): Buffer {
	return Buffer.from(schluessel, 'base64url');
}

/**
 * Der Fingerabdruck über beide öffentlichen Teile.
 *
 * Er dient dem Vergleich von Auge: Auf dem Notebook stehen dieselben Zeichen
 * wie nach dem Eintragen in der Hauptinstanz. Ein vertauschtes oder
 * abgefangenes Gerät fällt damit auf, bevor das erste Paket entsteht.
 */
export function fingerabdruck(encPublic: string, sigPublic: string): string {
	return createHash('sha256').update(`${encPublic}.${sigPublic}`, 'utf8').digest('hex');
}

/** Erzeugt ein frisches Paar für dieses Gerät. */
export function erzeugeGeraeteschluessel(): Geraeteschluessel {
	const verschluesselung = generateKeyPairSync('x25519');
	const unterschrift = generateKeyPairSync('ed25519');

	const encPublic = verschluesselung.publicKey
		.export({ type: 'spki', format: 'der' })
		.toString('base64url');
	const sigPublic = unterschrift.publicKey
		.export({ type: 'spki', format: 'der' })
		.toString('base64url');

	return {
		encPublic,
		encSecret: verschluesselung.privateKey
			.export({ type: 'pkcs8', format: 'der' })
			.toString('base64url'),
		sigPublic,
		sigSecret: unterschrift.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64url'),
		fingerabdruck: fingerabdruck(encPublic, sigPublic)
	};
}

/**
 * Der Gerätecode, wie ihn das Notebook anzeigt und die Hauptinstanz entgegennimmt.
 *
 * Ein Feld statt zwei: Wer zwei Zeichenketten überträgt, vertauscht sie
 * irgendwann. Das Trennzeichen ist ein Punkt, damit sich der Code in einer
 * Zeile markieren lässt.
 */
export function alsGeraetecode(oeffentlich: OeffentlicherSchluessel): string {
	return `${oeffentlich.encPublic}.${oeffentlich.sigPublic}`;
}

export class GeraetecodeFehler extends Error {}

/** Liest einen eingetippten oder eingefügten Gerätecode. */
export function ausGeraetecode(code: string): OeffentlicherSchluessel {
	const sauber = code.trim().replace(/\s+/g, '');
	const teile = sauber.split('.');
	if (teile.length !== 2 || !teile[0] || !teile[1]) {
		throw new GeraetecodeFehler(
			'Das ist kein Gerätecode. Er besteht aus zwei Teilen mit einem Punkt dazwischen und steht auf dem anderen Gerät unter «Als Saalgerät einrichten».'
		);
	}
	if (!/^[A-Za-z0-9_-]{40,120}$/.test(teile[0]) || !/^[A-Za-z0-9_-]{40,120}$/.test(teile[1])) {
		throw new GeraetecodeFehler(
			'Der Gerätecode ist unvollständig oder enthält fremde Zeichen. Kopieren Sie ihn ganz, oder scannen Sie den QR-Code.'
		);
	}

	/*
	 * Die Probe aufs Exempel: Lassen sich beide Teile überhaupt als Schlüssel
	 * lesen? Ein Code, der erst beim ersten Paket auffällt, wäre die schlechtere
	 * Absage — dann steht die Versammlung schon auf dem Sprung.
	 *
	 * **Und jeder Teil muss die richtige Art sein** (18.09.2026, aus dem
	 * Code-Review). «Lesbar» genügt nicht: Zwei vertauschte Teile sind beide
	 * lesbar, und der Code ginge durch. Auffallen würde es erst in `gibAb`, wo
	 * Node einen Ed25519-Schlüssel nicht als X25519-Gegenstelle annimmt — als
	 * roher `ERR_CRYPTO_INCOMPATIBLE_KEY` und erst, nachdem das ganze Paket
	 * gebaut ist. Genau der Fall, den der Absatz darüber ausschliessen wollte.
	 */
	try {
		const verschluesselung = createPublicKey({ key: roh(teile[0]), type: 'spki', format: 'der' });
		const unterschrift = createPublicKey({ key: roh(teile[1]), type: 'spki', format: 'der' });
		if (verschluesselung.asymmetricKeyType !== 'x25519' || unterschrift.asymmetricKeyType !== 'ed25519') {
			throw new GeraetecodeFehler(
				'Die beiden Teile des Gerätecodes stehen in der falschen Reihenfolge oder stammen aus verschiedenen Geräten. Kopieren Sie ihn noch einmal ganz.'
			);
		}
	} catch (fehler) {
		if (fehler instanceof GeraetecodeFehler) throw fehler;
		throw new GeraetecodeFehler(
			'Der Gerätecode lässt sich nicht als Schlüsselpaar lesen. Stammt er wirklich aus «Als Saalgerät einrichten»?'
		);
	}

	return {
		encPublic: teile[0],
		sigPublic: teile[1],
		fingerabdruck: fingerabdruck(teile[0], teile[1])
	};
}

/**
 * Der Sitzungsschlüssel, gebunden an beide Seiten des Pakets.
 *
 * **Warum die beiden öffentlichen Teile mit hineingehen** (18.09.2026, aus der
 * Sicherheitsprüfung). Vorher war der Schlüssel `sha256(MARKE || dh)`.
 *
 * **Und wie viel das bringt, ehrlich gerechnet: heute nichts Messbares.** Der
 * gemeinsame Wert ist durch das flüchtige Paar und den Empfänger schon
 * bestimmt; beide öffentlichen Teile hinzuzunehmen fügt weder Zufall noch
 * Nachweis hinzu, und keine Probe kann den Unterschied sehen. Es steht
 * trotzdem hier, und zwar als Vorsorge für den Umbau: Sobald der Kopf ein
 * weiteres Feld trägt — die Abgabekennung etwa, oder eine Fassungsnummer —,
 * ist es durch `setAAD` von selbst mitgeprüft, statt dass jemand daran denken
 * muss. Wer das für Zierrat hält, liegt für den heutigen Stand richtig.
 *
 * **Was das nicht leistet, und das ist wichtiger als das, was es leistet:** Es
 * ist kein Absendernachweis. Der öffentliche Teil des Geräts ist öffentlich —
 * er steht auf der Geräteseite und reist per Mail zur abgebenden Stelle. Wer
 * ihn kennt, kann ein vollständiges, gültig entschlüsselbares Paket bauen. Die
 * Unterschrift der abgebenden Stelle fehlt noch; sie gehört in denselben Block
 * wie das Einspielen, siehe `docs/plan-notebook-und-protokollzustellung-2026-09-18.md`.
 */
function sitzungsschluessel(gemeinsam: Buffer, fluechtig: Buffer, empfaenger: Buffer): Buffer {
	return createHash('sha256')
		.update(Buffer.concat([Buffer.from(MARKE, 'ascii'), gemeinsam, fluechtig, empfaenger]))
		.digest();
}

/** Der nackte Punkt der Kurve aus einem X25519-Schlüssel: die letzten 32 Byte der SPKI-Hülle. */
function punkt(schluessel: ReturnType<typeof createPublicKey>): Buffer {
	return schluessel.export({ type: 'spki', format: 'der' }).subarray(-32);
}

/**
 * Verschlüsselt für ein Gerät.
 *
 * Aufbau: Marke, flüchtiger öffentlicher Teil (32 Byte), Zufallsvorspann
 * (12 Byte), Prüfzeichen (16 Byte), Inhalt. Der flüchtige Teil gehört ins
 * Paket: Ohne ihn kann das Gerät das Geheimnis nicht nachrechnen.
 *
 * Der Kopf bis einschliesslich Vorspann geht als mitgeprüfter Zusatz in die
 * Verschlüsselung (`setAAD`): Er ist damit Teil dessen, was das Prüfzeichen
 * deckt, und lässt sich nicht mehr unbemerkt austauschen.
 */
export function verschluessleFuerGeraet(inhalt: Uint8Array, encPublic: string): Uint8Array {
	const empfaenger = createPublicKey({ key: roh(encPublic), type: 'spki', format: 'der' });
	const fluechtig = generateKeyPairSync('x25519');

	const gemeinsam = diffieHellman({ privateKey: fluechtig.privateKey, publicKey: empfaenger });
	const vorspann = randomBytes(12);
	// Nur der nackte Punkt der Kurve, nicht die SPKI-Hülle: Sie ist auf beiden
	// Seiten dieselbe und kostete nur Platz.
	const kopf = Buffer.concat([
		Buffer.from(MARKE, 'ascii'),
		punkt(fluechtig.publicKey),
		vorspann
	]);
	const schluessel = sitzungsschluessel(gemeinsam, punkt(fluechtig.publicKey), punkt(empfaenger));

	const werk = createCipheriv('aes-256-gcm', schluessel, vorspann);
	werk.setAAD(kopf);
	const geheim = Buffer.concat([werk.update(inhalt), werk.final()]);

	return new Uint8Array(Buffer.concat([kopf, werk.getAuthTag(), geheim]));
}

/** Die SPKI-Hülle eines nackten X25519-Punkts, wie sie Node erwartet. */
const X25519_HUELLE = Buffer.from('302a300506032b656e032100', 'hex');

export class PaketFehler extends Error {}

/** Öffnet ein Paket mit dem geheimen Teil dieses Geräts. */
export function oeffneAlsGeraet(paket: Uint8Array, encSecret: string): Uint8Array {
	const b = Buffer.from(paket);
	if (b.subarray(0, MARKE.length).toString('ascii') !== MARKE) {
		throw new PaketFehler(
			'Das ist kein Vorbereitungspaket dieser Anwendung. Erwartet wird die Datei, die beim Abgeben entstanden ist.'
		);
	}
	/*
	 * **Die Länge vor dem Zerlegen** (18.09.2026, aus dem Code-Review). Eine
	 * abgebrochene Übertragung liefert die Marke und dann zu wenig; die
	 * Teilstücke wären dann kürzer als verlangt, und `createDecipheriv` bräche
	 * mit «Invalid initialization vector» ab — einem Satz aus Node, der weder
	 * sagt, was los ist, noch von `PaketFehler` eingefangen würde.
	 */
	if (b.length < MARKE.length + 60) {
		throw new PaketFehler(
			'Das Paket ist unvollständig. Wahrscheinlich ist die Übertragung abgebrochen; kopieren Sie die Datei noch einmal.'
		);
	}
	const fluechtig = b.subarray(MARKE.length, MARKE.length + 32);
	const vorspann = b.subarray(MARKE.length + 32, MARKE.length + 44);
	const pruefzeichen = b.subarray(MARKE.length + 44, MARKE.length + 60);
	const geheim = b.subarray(MARKE.length + 60);

	const eigener = createPrivateKey({ key: roh(encSecret), type: 'pkcs8', format: 'der' });
	const gegenstelle = createPublicKey({
		key: Buffer.concat([X25519_HUELLE, fluechtig]),
		type: 'spki',
		format: 'der'
	});

	const gemeinsam = diffieHellman({ privateKey: eigener, publicKey: gegenstelle });
	const schluessel = sitzungsschluessel(
		gemeinsam,
		Buffer.from(fluechtig),
		punkt(createPublicKey(eigener))
	);

	const werk = createDecipheriv('aes-256-gcm', schluessel, vorspann);
	werk.setAAD(b.subarray(0, MARKE.length + 44));
	werk.setAuthTag(pruefzeichen);
	try {
		return new Uint8Array(Buffer.concat([werk.update(geheim), werk.final()]));
	} catch {
		/*
		 * **Was dieser Satz sagen darf, und was nicht** (18.09.2026, aus der
		 * Sicherheitsprüfung). Hier stand «oder es ist unterwegs verändert
		 * worden», und das versprach eine Erkennung, die es nicht gibt: Wer den
		 * öffentlichen Teil dieses Geräts kennt, kann ein ganz neues Paket bauen,
		 * das sich sauber öffnet. Erkannt wird nur die **Beschädigung** eines
		 * Pakets, nicht sein Austausch. Der Satz sagt deshalb, was zutrifft.
		 */
		throw new PaketFehler(
			'Das Paket lässt sich mit dem Schlüssel dieses Geräts nicht öffnen. Entweder wurde es für ein anderes Gerät verschlüsselt, oder die Datei ist beschädigt.'
		);
	}
}

/** Unterschreibt mit dem geheimen Teil dieses Geräts, für die Rückgabe. */
export function unterschreibe(inhalt: Uint8Array, sigSecret: string): string {
	const schluessel = createPrivateKey({ key: roh(sigSecret), type: 'pkcs8', format: 'der' });
	return sign(null, inhalt, schluessel).toString('base64url');
}

/** Prüft eine Unterschrift gegen den öffentlichen Teil eines Geräts. */
export function unterschriftStimmt(
	inhalt: Uint8Array,
	unterschrift: string,
	sigPublic: string
): boolean {
	try {
		const schluessel = createPublicKey({ key: roh(sigPublic), type: 'spki', format: 'der' });
		return verify(null, inhalt, schluessel, roh(unterschrift));
	} catch {
		return false;
	}
}

/** Legt den geheimen Teil verschlüsselt ab, wie jedes andere Geheimnis im Haus. */
export function versiegeleGeheimteil(wert: string): string {
	return verschluessele(wert);
}

export function oeffneGeheimteil(gespeichert: string): string {
	return entschluessele(gespeichert);
}
