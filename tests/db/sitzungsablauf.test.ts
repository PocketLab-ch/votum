/**
 * Sitzungsablauf und Sitzungsentwertung am Datenweg (Nachtrag aus dem
 * Sicherheitsdurchgang vom 09.10.2026, Befund V1).
 *
 * Der Ablauf war bis dahin nur als Domänenfunktion gemessen
 * (`tests/domain/anmeldeschutz.test.ts`), nie am Datenweg: Kein Prüflauf rief
 * `sitzungAufloesen` oder `abmelden`. Fällt eine der drei Bedingungen in
 * `sitzung_aufloesen` (Migration 003: nicht entwertet, nicht abgelaufen,
 * Konto nicht gesperrt) weg, blieben abgelaufene und abgemeldete Sitzungen
 * gültig — unbemerkt, weil jeder Handtest frisch anmeldet.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abmelden, merkmalPruefwert, sitzungAufloesen } from '$lib/server/auth';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzerId: string;

/**
 * Legt eine Sitzung über die privilegierte Verbindung an. Der normale Weg
 * wäre die Anmeldung, aber die rechnet Argon2 und würde hier nur Zeit kosten:
 * Die Frage ist allein, was `sitzung_aufloesen` aus der Zeile macht.
 */
async function sitzung(merkmal: string, frist: string, entwertet = false): Promise<void> {
	await admin`
		INSERT INTO user_session (user_id, token_hash, expires_at, revoked_at)
		VALUES (${benutzerId}, ${merkmalPruefwert(merkmal)}, ${frist}, ${entwertet ? new Date() : null})
	`;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Sitzungsablauf');
	benutzerId = await pruefbenutzer(betreiber, 'leitung');
});

afterAll(verbindungenSchliessen);

describe('sitzungAufloesen am Datenweg', () => {
	it('löst eine gültige Sitzung auf', async () => {
		const merkmal = 'gueltig-mer-kmal-01';
		await sitzung(merkmal, '2027-01-01 12:00:00+00');
		const benutzer = await sitzungAufloesen(merkmal);
		expect(benutzer?.id).toBe(benutzerId);
		expect(benutzer?.operatorId).toBe(betreiber);
	});

	it('gibt eine abgelaufene Sitzung als null zurück', async () => {
		const merkmal = 'abgelaufen-merkmal';
		await sitzung(merkmal, '2020-01-01 12:00:00+00');
		expect(await sitzungAufloesen(merkmal)).toBeNull();
	});

	it('gibt eine entwertete Sitzung als null zurück', async () => {
		const merkmal = 'entwertet-merkmal';
		await sitzung(merkmal, '2027-01-01 12:00:00+00', true);
		expect(await sitzungAufloesen(merkmal)).toBeNull();
	});

	it('entwertet die Sitzung serverseitig bei der Abmeldung: der kopierte Keks ist tot', async () => {
		const merkmal = 'abgemeldet-merkmal';
		await sitzung(merkmal, '2027-01-01 12:00:00+00');
		const benutzer = await sitzungAufloesen(merkmal);
		expect(benutzer).not.toBeNull();

		// Der Keks im Browser wird gelöscht; wer ihn vorher kopiert hat, hält
		// noch eine Aufzeichnung. Deshalb der serverseitige Widerruf.
		await abmelden(merkmal, benutzer);
		expect(await sitzungAufloesen(merkmal)).toBeNull();
	});
});
