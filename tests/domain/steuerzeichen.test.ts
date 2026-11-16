import { describe, expect, it } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { EINGABE_MIT_NUL, enthaeltNul } from '$lib/domain/steuerzeichen';
import { ausserAbsage, sperreNulImRumpf } from '$lib/server/nulsperre';

/**
 * NUL-Zeichen sagen am Eingang mit 400 ab statt als 500 an PostgreSQL
 * (22021). Befund und Begründung in `src/lib/domain/steuerzeichen.ts`.
 *
 * Geprüft wird der Leseweg an einer echten `Request`, wie sie `adapter-node`
 * übergibt: Die Sperre ersetzt `formData()` und `json()` an der Anfrage
 * selbst, und ob sich das an einer Undici-`Request` überhaupt setzen lässt,
 * zeigt nur ein Test daran. Die Messung am Dev-Stapel (27.10.2026, `POST
 * /anmelden` und `/verlauf?suche=%00` je 400) steht im Commit.
 */

function formularanfrage(daten: FormData): Request {
	return new Request('http://votum.test/anmelden', { method: 'POST', body: daten });
}

async function absage(lesen: () => Promise<unknown>): Promise<number | null> {
	try {
		await lesen();
		return null;
	} catch (fehler) {
		if (isHttpError(fehler)) {
			expect(fehler.body.message).toBe(EINGABE_MIT_NUL);
			return fehler.status;
		}
		throw fehler;
	}
}

describe('enthaeltNul', () => {
	it('findet das Zeichen in Text, Liste, Schlüssel und Verschachtelung', () => {
		expect(enthaeltNul('a\u0000b')).toBe(true);
		expect(enthaeltNul([['suche', '\u0000']])).toBe(true);
		expect(enthaeltNul({ 'a\u0000': 'x' })).toBe(true);
		expect(enthaeltNul({ a: [{ b: 'x\u0000' }] })).toBe(true);
	});

	it('lässt gewöhnliche Werte durch, auch andere Steuerzeichen', () => {
		expect(enthaeltNul('Zeile\nund\tTab')).toBe(false);
		expect(enthaeltNul({ a: 1, b: null, c: [true, 'ä'] })).toBe(false);
		expect(enthaeltNul(undefined)).toBe(false);
	});
});

describe('sperreNulImRumpf', () => {
	it('sagt bei NUL in einem Formularwert mit 400 ab', async () => {
		const daten = new FormData();
		daten.set('username', 'a\u0000b');
		const anfrage = formularanfrage(daten);
		sperreNulImRumpf(anfrage);
		expect(await absage(() => anfrage.formData())).toBe(400);
	});

	it('sagt bei NUL in einem Feldnamen und im Namen einer Datei ab', async () => {
		const imNamen = new FormData();
		imNamen.set('a\u0000', 'x');
		const anfrage1 = formularanfrage(imNamen);
		sperreNulImRumpf(anfrage1);
		expect(await absage(() => anfrage1.formData())).toBe(400);

		const imDateinamen = new FormData();
		imDateinamen.set('datei', new File(['x'], 'a\u0000.pdf'));
		const anfrage2 = formularanfrage(imDateinamen);
		sperreNulImRumpf(anfrage2);
		expect(await absage(() => anfrage2.formData())).toBe(400);
	});

	it('lässt NUL-Bytes im Inhalt einer Datei durch', async () => {
		// Binärinhalt trägt NUL zu Recht; er geht nie als Text in die Datenbank.
		const daten = new FormData();
		daten.set('datei', new File([new Uint8Array([0x25, 0x00, 0x50])], 'beleg.pdf'));
		daten.set('titel', 'Beleg');
		const anfrage = formularanfrage(daten);
		sperreNulImRumpf(anfrage);
		const gelesen = await anfrage.formData();
		expect(gelesen.get('titel')).toBe('Beleg');
		expect(new Uint8Array(await (gelesen.get('datei') as File).arrayBuffer())).toEqual(
			new Uint8Array([0x25, 0x00, 0x50])
		);
	});

	it('sagt bei NUL in einem JSON-Rumpf ab und lässt einen sauberen durch', async () => {
		const mitNul = new Request('http://votum.test/x', {
			method: 'POST',
			body: JSON.stringify({ text: 'a\u0000b' })
		});
		sperreNulImRumpf(mitNul);
		expect(await absage(() => mitNul.json())).toBe(400);

		const sauber = new Request('http://votum.test/x', {
			method: 'POST',
			body: JSON.stringify({ text: 'ab' })
		});
		sperreNulImRumpf(sauber);
		expect(await sauber.json()).toEqual({ text: 'ab' });
	});
});

describe('ausserAbsage', () => {
	it('lässt die Absage durch, statt sie durch den Ersatz zu decken', async () => {
		// `karten.pdf` und `versandpaket.zip`: Ein leeres Formular hiesse dort
		// «Zugänge für alle», aus der Absage würde ein Schreiben ohne Auftrag.
		const daten = new FormData();
		daten.set('partei', 'a\u0000b');
		const anfrage = formularanfrage(daten);
		sperreNulImRumpf(anfrage);
		expect(await absage(() => anfrage.formData().catch(ausserAbsage(new FormData())))).toBe(400);
	});

	it('deckt einen unlesbaren Rumpf weiter durch den Ersatz', async () => {
		const anfrage = new Request('http://votum.test/x', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		});
		sperreNulImRumpf(anfrage);
		const gelesen = await anfrage.formData().catch(ausserAbsage(new FormData()));
		expect([...gelesen]).toEqual([]);
	});
});
