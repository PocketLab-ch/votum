/**
 * Zeitstempel nach RFC 3161 lesen — an einer echten Antwort.
 *
 * Geprüft wird gegen `zeitstempel.fixture.ts`: die unveränderte Antwort eines
 * echten Dienstes. Erfundene Bytes würden hier nichts beweisen; der ganze Sinn
 * dieses Lesers ist, dass er mit dem zurechtkommt, was Dienste tatsächlich
 * schicken — und die weichen voneinander ab.
 */
import { describe, expect, it } from 'vitest';
import { createHash, createVerify, X509Certificate } from 'node:crypto';
import {
	baueAnfrage,
	leseAntwort,
	lautetAuf,
	streuverfahren,
	zufallStimmt
} from '$lib/domain/rfc3161';
import {
	DerFehler,
	SEQUENCE,
	kinder,
	lies,
	oidInWorten,
	schreibe,
	schreibeGanzzahl,
	schreibeOid,
	verkette
} from '$lib/domain/asn1';
import { GESTEMPELTE_PRUEFSUMME, ZEITSTEMPEL_ANTWORT } from './zeitstempel.fixture';

const antwort = Uint8Array.from(Buffer.from(ZEITSTEMPEL_ANTWORT, 'base64'));

describe('DER lesen', () => {
	it('weist die längenunbestimmte Form ab', () => {
		// BER erlaubt sie, DER nicht. Ein Leser, der sie stillschweigend
		// annimmt, liest am Ende etwas anderes als der Prüfer gegenüber.
		expect(() => lies(Uint8Array.from([0x30, 0x80, 0x00, 0x00]))).toThrow(DerFehler);
	});

	it('weist abgeschnittene Daten ab', () => {
		expect(() => lies(Uint8Array.from([0x30, 0x10, 0x01]))).toThrow(DerFehler);
	});

	it('schreibt und liest ein OID wieder ein', () => {
		for (const oid of ['1.2.840.113549.1.7.2', '2.16.840.1.101.3.4.2.3', '1.3.6.1.4.1.11129']) {
			expect(oidInWorten(lies(schreibeOid(oid)).element)).toBe(oid);
		}
	});
});

describe('Anfrage', () => {
	it('trägt Prüfsumme und Zufallswert', () => {
		const pruefsumme = createHash('sha256').update('Beispiel').digest();
		const zufall = Uint8Array.from([9, 8, 7, 6, 5, 4, 3, 2]);
		const anfrage = baueAnfrage(new Uint8Array(pruefsumme), zufall);

		const teile = kinder(lies(anfrage).element);
		// Fassung 1, dann der Abdruck, dann der Zufallswert, dann certReq.
		expect(teile[0].inhalt[0]).toBe(1);
		const abdruck = kinder(teile[1]);
		expect(oidInWorten(kinder(abdruck[0])[0])).toBe('2.16.840.1.101.3.4.2.1');
		expect(Buffer.from(abdruck[1].inhalt).toString('hex')).toBe(pruefsumme.toString('hex'));
		expect(Buffer.from(teile[2].inhalt).toString('hex')).toBe('0908070605040302');
		// certReq: Ohne das Zertifikat liesse sich die Signatur später nicht
		// prüfen — und ein ungeprüfter Zeitstempel bezeugt nichts.
		expect(teile[3].inhalt[0]).toBe(0xff);
	});
});

describe('Antwort', () => {
	const befund = leseAntwort(antwort);

	it('ist angenommen', () => {
		expect(befund.zustand).toBe(0);
		expect(befund.angenommen).toBe(true);
		expect(befund.token).not.toBeNull();
	});

	it('lautet auf die gestempelte Prüfsumme — und auf keine andere', () => {
		expect(lautetAuf(befund.token!, GESTEMPELTE_PRUEFSUMME)).toBe(true);
		expect(lautetAuf(befund.token!, 'a'.repeat(64))).toBe(false);
	});

	it('nennt einen Zeitpunkt und eine Seriennummer', () => {
		expect(befund.token!.zeitpunkt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		expect(Date.parse(befund.token!.zeitpunkt)).not.toBeNaN();
		expect(befund.token!.seriennummer.length).toBeGreaterThan(0);
	});

	it('gibt den Zufallswert der Anfrage zurück', () => {
		// Ohne diesen Rückgabewert liesse sich eine aufgezeichnete Antwort
		// wiedereinspielen.
		expect(befund.token!.zufall).toBe('0102030405060708');
		expect(zufallStimmt(befund.token!, '0102030405060708')).toBe(true);
		expect(zufallStimmt(befund.token!, '0807060504030201')).toBe(false);
	});

	it('vergleicht den Zufallswert als Zahl, nicht als Bytes', () => {
		// DER schreibt Zahlen kürzestmöglich: führende Nullen fallen weg, vor ein
		// gesetztes oberstes Bit kommt eines dazu. Ein byteweiser Vergleich
		// meldete bei jeder zweiten Anfrage einen Wiedereinspielungsversuch.
		const wie = (zufall: string) =>
			zufallStimmt({ ...befund.token!, zufall } as typeof befund.token & object, '00ff00ff00ff00ff');
		// Dieselbe Zahl, anders geschrieben — das ist kein Angriff.
		expect(wie('ff00ff00ff00ff')).toBe(true);
		expect(wie('00ff00ff00ff00ff')).toBe(true);
		expect(wie('000000ff00ff00ff00ff')).toBe(true);
		// Eine andere Zahl bleibt eine andere.
		expect(wie('ff00ff00ff00fe')).toBe(false);
		// Ein Dienst, der gar keinen zurückgibt, gilt nicht als verdächtig.
		expect(zufallStimmt({ ...befund.token!, zufall: null }, 'abcd')).toBe(true);
	});

	it('liefert das Zertifikat des Dienstes mit', () => {
		expect(befund.token!.zertifikate.length).toBeGreaterThan(0);
		const zert = new X509Certificate(Buffer.from(befund.token!.zertifikate[0]));
		expect(zert.fingerprint256).toMatch(/^[0-9A-F:]+$/);
	});

	it('nennt das Streuverfahren der Signatur, statt es zu unterstellen', () => {
		// Der erste Prüflauf gegen einen echten Dienst scheiterte genau hier:
		// Die Anfrage lautet auf SHA-256, signiert wurde mit SHA-512.
		expect(befund.token!.signatur!.streuverfahren).toBe('sha512');
		expect(streuverfahren('2.16.840.1.101.3.4.2.1')).toBe('sha256');
		expect(streuverfahren('1.2.840.113549.1.1.1')).toBeNull();
	});

	it('trägt eine Signatur, die zum Zertifikat passt', () => {
		const t = befund.token!;
		// Die Attribute enthalten die Prüfsumme über den bezeugten Inhalt …
		const gestreut = createHash(t.signatur!.streuverfahren).update(t.inhalt).digest('hex');
		expect(gestreut).toBe(t.signatur!.inhaltspruefsumme);

		// … und über die Attribute läuft die Signatur.
		const pruefer = createVerify(t.signatur!.streuverfahren);
		pruefer.update(Buffer.from(t.signatur!.signierteAttribute));
		const zert = new X509Certificate(Buffer.from(t.zertifikate[0]));
		expect(pruefer.verify(zert.publicKey, Buffer.from(t.signatur!.wert))).toBe(true);
	});

	it('bemerkt eine verfälschte Signatur', () => {
		const verdreht = Uint8Array.from(antwort);
		// Ein Byte im signierten Inhalt genügt.
		const stelle = verdreht.indexOf(0x30, 200);
		verdreht[stelle + 40] ^= 0xff;

		let bemerkt = false;
		try {
			const t = leseAntwort(verdreht).token!;
			const gestreut = createHash(t.signatur!.streuverfahren).update(t.inhalt).digest('hex');
			bemerkt = gestreut !== t.signatur!.inhaltspruefsumme;
		} catch {
			// Auch ein Lesefehler ist ein Bemerken — Hauptsache, es geht nicht durch.
			bemerkt = true;
		}
		expect(bemerkt).toBe(true);
	});

	it('meldet einen abgewiesenen Zeitstempel als solchen', () => {
		// Ein Dienst, der ablehnt, schickt einen Zustand und keinen Stempel.
		const text = new TextEncoder().encode('Der Abdruck ist zu kurz.');
		const abgelehnt = schreibe(
			SEQUENCE,
			verkette(
				schreibe(
					SEQUENCE,
					verkette(schreibeGanzzahl(2), schreibe(SEQUENCE, schreibe(0x0c, text)))
				)
			)
		);

		const b = leseAntwort(abgelehnt);
		expect(b.zustand).toBe(2);
		expect(b.angenommen).toBe(false);
		expect(b.zustandInWorten).toBe('abgelehnt');
		expect(b.meldung).toBe('Der Abdruck ist zu kurz.');
		expect(b.token).toBeNull();
	});
});
