/**
 * Die Ablage schreibt atomar (F3, Befund N2 aus der Codeprüfung der Sicherung).
 *
 * **Was hier geprüft wird.** Unter einem Prüfsummennamen steht entweder der
 * vollständige Inhalt oder gar nichts. Bis zum 15.10.2026 schrieb die Ablage
 * direkt unter den Endnamen: Ein Abbruch mittendrin liess eine abgeschnittene
 * Datei stehen, und das nächste Ablegen fand sie über `access()` und liess
 * sie liegen. Geprüft wird am Dateisystem, in einer eigenen, leeren Ablage
 * statt über den Bestand von Dev.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { legeAb, legeInternAb, lies } from '$lib/server/dateien';

/*
 * Eine eigene, leere Ablage für diese Datei. `dateien.ts` liest die Wurzel
 * beim Laden; `vi.hoisted` läuft vor den Importen. Der Ersatz für
 * `$env/dynamic/private` reicht `process.env` durch, damit der hier gesetzte
 * Pfad ankommt.
 */
const ablage = await vi.hoisted(async () => {
	const { mkdtempSync } = await import('node:fs');
	const { tmpdir } = await import('node:os');
	const { join } = await import('node:path');
	const ordner = mkdtempSync(join(tmpdir(), 'dateiablage-'));
	process.env.VERSAMMLUNG_DATEIEN = ordner;
	return ordner;
});

vi.mock('$env/dynamic/private', () => ({ env: process.env }));

const text = (s: string) => new TextEncoder().encode(s);
/** Ein Inhalt, den `erkenneArt` als PDF durchlässt. */
const pdf = (kennung: string) => text(`%PDF-1.4\n% ${kennung}\n%%EOF\n`);
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const ordnerVon = (pruefsumme: string) =>
	join(ablage, pruefsumme.slice(0, 2), pruefsumme.slice(2, 4));
const pfadVon = (pruefsumme: string) => join(ordnerVon(pruefsumme), pruefsumme);

function dateienDerAblage(): string[] {
	return readdirSync(ablage, { recursive: true, withFileTypes: true })
		.filter((e) => e.isFile())
		.map((e) => e.name)
		.sort();
}

afterEach(() => {
	rmSync(ablage, { recursive: true, force: true });
	mkdirSync(ablage, { recursive: true });
});

afterAll(() => rmSync(ablage, { recursive: true, force: true }));

describe('F3: Ablage atomar', () => {
	it('ersetzt eine abgeschnittene Datei statt sie liegen zu lassen (legeInternAb)', async () => {
		const inhalt = text('Paketinhalt, beim Schreiben abgebrochen');
		const abgelegt = await legeInternAb(inhalt);

		// Der Abbruch mitten im Schreiben, von Hand nachgestellt: unter dem
		// Prüfsummennamen liegt nur der Anfang des Inhalts.
		writeFileSync(pfadVon(abgelegt.pruefsumme), inhalt.slice(0, 10));

		await legeInternAb(inhalt);

		expect(readFileSync(pfadVon(abgelegt.pruefsumme))).toEqual(Buffer.from(inhalt));
	});

	it('ersetzt eine abgeschnittene Datei statt sie liegen zu lassen (legeAb)', async () => {
		const inhalt = pdf('Vollmacht, beim Schreiben abgebrochen');
		const abgelegt = await legeAb(inhalt, 'Vollmacht.pdf', 'application/pdf');

		writeFileSync(pfadVon(abgelegt.pruefsumme), inhalt.slice(0, 9));

		await legeAb(inhalt, 'Vollmacht.pdf', 'application/pdf');

		expect(Buffer.from(await lies(abgelegt.pruefsumme))).toEqual(Buffer.from(inhalt));
	});

	it('lässt einen falschen Inhalt unter dem Endnamen nicht stehen', async () => {
		const inhalt = text('Der echte Inhalt der Datei');
		const abgelegt = await legeInternAb(inhalt);

		// Genau so lang wie das Original: Die Grösse allein verrät den Schaden nicht.
		writeFileSync(pfadVon(abgelegt.pruefsumme), new Uint8Array(inhalt.byteLength).fill(0x58));

		await legeInternAb(inhalt);

		expect(readFileSync(pfadVon(abgelegt.pruefsumme))).toEqual(Buffer.from(inhalt));
	});

	it('endet bei gleichzeitigen Ablagen desselben Inhalts mit genau einer vollständigen Datei', async () => {
		const inhalt = pdf('Gleichzeitig abgelegt');
		const pruefsumme = sha256(inhalt);

		const ergebnisse = await Promise.allSettled(
			Array.from({ length: 8 }, () => legeAb(inhalt, 'Paket.pdf', 'application/pdf'))
		);

		expect(ergebnisse.map((e) => e.status)).toEqual(Array.from({ length: 8 }, () => 'fulfilled'));
		expect(readFileSync(pfadVon(pruefsumme))).toEqual(Buffer.from(inhalt));
		// Genau die eine Enddatei; Teildateien bleiben keine zurück.
		expect(dateienDerAblage()).toEqual([pruefsumme]);
	});

	it('stört sich nicht an einer liegengebliebenen Teildatei', async () => {
		const inhalt = text('Paket neben einer liegengebliebenen Teildatei');
		const pruefsumme = sha256(inhalt);
		// `.teil` ist die Endung der Teildateien aus `dateien.ts` (F3): daran
		// sind sie erkennbar, und so nimmt sie auch die Sicherung mit.
		const teil = join(ordnerVon(pruefsumme), `${pruefsumme}.3f2a1b0c9d8e7f60.teil`);
		mkdirSync(ordnerVon(pruefsumme), { recursive: true });
		writeFileSync(teil, 'halber Inhalt');

		const abgelegt = await legeInternAb(inhalt);
		expect(abgelegt.pruefsumme).toBe(pruefsumme);
		expect(Buffer.from(await lies(pruefsumme))).toEqual(Buffer.from(inhalt));

		// Kein Aufräumen im Vorbeigehen und keines per Zeitplan: Die Teildatei
		// bleibt liegen.
		expect(existsSync(teil)).toBe(true);
	});
});
