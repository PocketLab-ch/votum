/**
 * Gegentest zum Wächter «Suchpfad» (`scripts/check-suchpfad.mjs`).
 *
 * Drei Fragen: Findet er eine Funktion ohne Pin, seit Migration 164 auch ohne
 * SECURITY DEFINER? Lässt er
 * eine spätere Heilung gelten, ohne eine spätere Verschlechterung zu
 * übersehen? Und lässt er Begründungen in Kommentaren in Ruhe? Die letzte ist
 * nicht nebensächlich: Die Migrationen dieses Hauses erklären ausführlich, und
 * «SECURITY DEFINER» steht in vielen Kommentaren.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fahreWaechter } from './waechterlauf';

const SKRIPT = join(process.cwd(), 'scripts', 'check-suchpfad.mjs');
const verzeichnisse: string[] = [];

function baumMit(dateien: Record<string, string>): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'suchpfadwaechter-'));
	verzeichnisse.push(wurzel);
	mkdirSync(join(wurzel, 'migrations'));
	for (const [name, inhalt] of Object.entries(dateien)) {
		writeFileSync(join(wurzel, 'migrations', name), inhalt, 'utf8');
	}
	return wurzel;
}

afterAll(() => {
	for (const v of verzeichnisse) rmSync(v, { recursive: true, force: true });
});

const OHNE_PIN = `
CREATE OR REPLACE FUNCTION loesche(x uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM meeting WHERE id = x;
END;
$$;
`;

const MIT_PIN = `
CREATE OR REPLACE FUNCTION loesche(x uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM meeting WHERE id = x;
END;
$$;
`;

describe('findet die Bauart von D1 und D2', () => {
	it('meldet eine Funktion mit SECURITY DEFINER ohne Pin', () => {
		const { rot, ausgabe } = fahreWaechter(SKRIPT, baumMit({ '001_a.sql': OHNE_PIN }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/001_a\.sql:2: loesche\(\)/);
	});

	it('meldet sie auch, wenn SECURITY DEFINER erst nach dem Körper steht', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({
				'001_a.sql':
					'CREATE FUNCTION f() RETURNS int AS $body$ SELECT 1 $body$ LANGUAGE sql SECURITY DEFINER;\n'
			})
		);
		expect(rot).toBe(true);
	});

	it('meldet eine spätere Fassung, die den Pin wieder verliert', () => {
		const { rot, ausgabe } = fahreWaechter(
			SKRIPT,
			baumMit({ '001_a.sql': MIT_PIN, '002_b.sql': OHNE_PIN })
		);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/002_b\.sql/);
	});

	it('lässt sich vom Wort «search_path» im Körper nicht täuschen', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({
				'001_a.sql': `CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM set_config('x', 'y', true); -- SET search_path steht hier nur im Kommentar
    EXECUTE 'SET search_path = public';
END;
$$;
`
			})
		);
		expect(rot).toBe(true);
	});

	it('meldet einen Pin ohne pg_temp am Ende', () => {
		/*
		 * Fehlt `pg_temp`, durchsucht PostgreSQL es für Tabellen zuerst; der Pin
		 * wehrte D1 nicht ab (Code-Review 13.10.2026). Dasselbe gilt für
		 * `pg_temp` vorne und für `FROM CURRENT`, das den Pfad des Aufrufers
		 * übernimmt.
		 */
		for (const pfad of ['= public', '= pg_temp, public', 'FROM CURRENT', "= 'public, pg_temp'"]) {
			const { rot } = fahreWaechter(
				SKRIPT,
				baumMit({ '001_a.sql': MIT_PIN.replace('= public, pg_temp', pfad) })
			);
			expect(rot, pfad).toBe(true);
		}
	});

	it('erbt den Pin nicht von der nächsten Funktion', () => {
		// Ein Körper ohne Dollar-Zeichen: Die erste Fassung des Wächters nahm
		// das nächste `AS $$` und damit den Pin der Funktion danach.
		const { rot, ausgabe } = fahreWaechter(
			SKRIPT,
			baumMit({
				'001_a.sql':
					"CREATE FUNCTION zuerst() RETURNS int LANGUAGE sql SECURITY DEFINER AS 'SELECT 1';\n" +
					MIT_PIN
			})
		);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/zuerst\(\)/);
	});

	it('sieht auch eine Prozedur', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({
				'001_a.sql': OHNE_PIN.replace('FUNCTION loesche(x uuid) RETURNS void', 'PROCEDURE loesche(x uuid)')
			})
		);
		expect(rot).toBe(true);
	});

	it('nimmt ein späteres ALTER FUNCTION mit falschem Pfad als Verschlechterung', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({
				'001_a.sql': MIT_PIN,
				'002_b.sql': 'ALTER FUNCTION loesche(uuid) SET search_path = public;\n'
			})
		);
		expect(rot).toBe(true);
	});

	it('wird an einer Kopie des Bestands vor Migration 154 rot, mit genau D1 und D2', () => {
		/*
		 * **Nur die Migrationen vor 154, nicht «alle ausser 154»** (Code-Review
		 * 13.10.2026). Legte eine spätere Migration eine der beiden Funktionen
		 * gepinnt neu an, wäre die Kopie ohne 154 trotzdem geheilt, und dieser
		 * Test würde an einer richtigen Migration rot.
		 */
		const wurzel = mkdtempSync(join(tmpdir(), 'suchpfadwaechter-'));
		verzeichnisse.push(wurzel);
		cpSync(join(process.cwd(), 'migrations'), join(wurzel, 'migrations'), {
			recursive: true,
			filter: (quelle) => {
				const nummer = /\/(\d{3})_[^/]*\.sql$/.exec(quelle);
				return nummer === null || Number(nummer[1]) < 154;
			}
		});
		const { rot, ausgabe } = fahreWaechter(SKRIPT, wurzel);
		expect(rot).toBe(true);
		// Seit C1 nennt er dort auch die ungepinnten ohne SECURITY DEFINER; die
		// Bauart von D1 und D2 sind die beiden, die mit DEFINER gemeldet werden.
		const genannt = [...ausgabe.matchAll(/· (\S+): (\w+)\(\) \(SECURITY DEFINER\)/g)]
			.map((t) => t[2])
			.sort();
		expect(genannt).toEqual(['betriebsdaten_loeschen', 'versammlung_loeschen']);
	});

	it('wird an einer Kopie des Bestands vor Migration 164 rot, mit der Abgabesperre', () => {
		// C1, 16.10.2026: `versammlung_abgegeben` las `meeting_handover` ohne Pin.
		const wurzel = mkdtempSync(join(tmpdir(), 'suchpfadwaechter-'));
		verzeichnisse.push(wurzel);
		cpSync(join(process.cwd(), 'migrations'), join(wurzel, 'migrations'), {
			recursive: true,
			filter: (quelle) => {
				const nummer = /\/(\d{3})_[^/]*\.sql$/.exec(quelle);
				return nummer === null || Number(nummer[1]) < 164;
			}
		});
		const { rot, ausgabe } = fahreWaechter(SKRIPT, wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/· \S+: versammlung_abgegeben\(\)\n/);
	});
});

describe('findet auch Funktionen ohne SECURITY DEFINER', () => {
	it('meldet eine Auslöserfunktion ohne Pin', () => {
		const { rot, ausgabe } = fahreWaechter(
			SKRIPT,
			baumMit({
				'001_a.sql': `
CREATE FUNCTION sperre() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM meeting_handover) THEN RAISE EXCEPTION 'abgegeben'; END IF;
    RETURN NEW;
END;
$$;
`
			})
		);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/· 001_a\.sql:\d+: sperre\(\)\n/);
	});
});

describe('lässt Richtiges in Ruhe', () => {
	it('schweigt bei gepinnter Funktion', () => {
		expect(fahreWaechter(SKRIPT, baumMit({ '001_a.sql': MIT_PIN })).rot).toBe(false);
	});

	it('lässt eine spätere Heilung mit CREATE OR REPLACE gelten', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({ '001_a.sql': OHNE_PIN, '002_b.sql': MIT_PIN })
		);
		expect(rot).toBe(false);
	});

	it('lässt eine spätere Heilung mit ALTER FUNCTION gelten', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({
				'001_a.sql': OHNE_PIN,
				'002_b.sql': 'ALTER FUNCTION loesche(uuid) SET search_path = public, pg_temp;\n'
			})
		);
		expect(rot).toBe(false);
	});

	it('vergisst mehrere entfernte Funktionen in einer Anweisung', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({
				'001_a.sql': OHNE_PIN + OHNE_PIN.replace('loesche', 'raeume'),
				'002_b.sql': 'DROP FUNCTION IF EXISTS loesche(uuid), raeume(uuid) CASCADE;\n'
			})
		);
		expect(rot).toBe(false);
	});

	it('nimmt auch die Schreibweise mit TO und Anführungszeichen', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({ '001_a.sql': MIT_PIN.replace('= public, pg_temp', "TO 'public', 'pg_temp'") })
		);
		expect(rot).toBe(false);
	});

	it('vergisst eine entfernte Funktion', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({ '001_a.sql': OHNE_PIN, '002_b.sql': 'DROP FUNCTION IF EXISTS loesche(uuid);\n' })
		);
		expect(rot).toBe(false);
	});

	it('zählt SECURITY DEFINER in einem Kommentar nicht', () => {
		// Seit C1 ist die ungepinnte Funktion ein Befund; geprüft wird, dass der
		// Kommentar sie nicht zur SECURITY DEFINER macht.
		const { rot, ausgabe } = fahreWaechter(
			SKRIPT,
			baumMit({
				/*
				 * Der Kommentar steht zwischen Kopf und Körper, wo der Wächter die
				 * Eigenschaften liest (Codeprüfung C1: davor stand er ausserhalb,
				 * und eine Mutante ohne Kommentarbereinigung blieb grün). Seit C1
				 * ist ein Pin im Kommentar die gefährliche Richtung.
				 */
				'001_a.sql': `CREATE FUNCTION f() RETURNS int LANGUAGE sql
-- SECURITY DEFINER, SET search_path = public, pg_temp folgt in 002
AS $$ SELECT 1 $$;
`
			})
		);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/· 001_a\.sql:\d+: f\(\)\n/);
		expect(ausgabe).not.toMatch(/SECURITY DEFINER\)/);
	});

	it('ist über dem echten Bestand grün', () => {
		const { rot, ausgabe } = fahreWaechter(SKRIPT);
		expect(rot, ausgabe).toBe(false);
	});
});
