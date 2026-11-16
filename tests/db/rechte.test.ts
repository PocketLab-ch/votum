/**
 * Rechte und Zeilenschutz als **Klasse**, nicht als Aufzählung (Audit 08.08.2026).
 *
 * Das Audit fand drei Tabellen, die durch die REVOKE-Disziplin gerutscht waren:
 * `seal`, `minutes_version` und `login_attempt`. Keine davon war schlecht
 * gebaut — sie waren nur **vergessen worden**, während fünfzehn Schwestern den
 * Entzug ausdrücklich tragen.
 *
 * Ein Prüfstand, der genau diese drei nachträgt, behebt drei Fälle und lässt die
 * Fehlerklasse offen: Die nächste Tabelle rutscht genauso durch. Deshalb steht
 * hier zuerst ein **Wächter über den ganzen Bestand** — jede Tabelle trägt
 * Zeilenschutz mit `FORCE` und eine Regel, ausser sie steht mit Begründung auf
 * der Ausnahmeliste. Wer künftig eine Tabelle ohne beides anlegt, sieht diesen
 * Prüfstand rot und muss sich entscheiden: Schutz nachtragen oder die Ausnahme
 * begründen.
 *
 * Geprüft wird unter der **Anwendungsrolle**. Die privilegierte Rolle ist ein
 * Superuser und umgeht sowohl den Zeilenschutz als auch entzogene Rechte — ein
 * Prüfstand unter ihr würde jede Regel bestätigen, ohne dass eine davon wirkt.
 */
import { readFile, readdir } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, app, imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let betreiberB: string;

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Rechte A');
	betreiberB = await pruefbetreiber('Rechte B');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

/**
 * Tabellen ohne Zeilenschutz — jede mit dem Grund, warum sie keinen hat.
 *
 * Diese Liste ist die einzige Stelle, an der eine Ausnahme entstehen darf, und
 * sie zu verlängern ist eine bewusste Handlung.
 */
const OHNE_ZEILENSCHUTZ: Record<string, string> = {
	// Der Stand der Migrationen gehört der privilegierten Rolle; die Anwendung
	// darf ihn nur lesen (Migration 002 entzieht alles andere).
	schema_migration: 'Migrationsstand, kein Mandantendatum',
	// Die Sperre nach Fehlversuchen rechnet über Benutzernamen hinweg, bevor
	// überhaupt feststeht, zu welchem Betreiber ein Name gehört. Eine
	// Betreiberspalte gäbe es erst nach dem Auflösen — also nach der Sperre.
	login_attempt: 'Fehlversuche werden vor dem Auflösen des Mandanten gezählt',
	// Ein Code, der nicht greift, gehört zu keinem Betreiber. Die Zeile kann gar
	// keinen tragen — es gäbe nichts, was hineingehörte.
	code_attempt: 'Codeversuche lassen sich keinem Betreiber zuordnen',
	/*
	 * Das eigene Schlüsselpaar dieser Anwendung als Saalgerät (Migration 116).
	 * Es gehört dem **Gerät** und nicht einem Mandanten: Dasselbe Notebook steht
	 * für mehrere Gemeinschaften desselben Hauses im Saal, und es gibt davon
	 * genau eine Zeile.
	 *
	 * Geschützt ist nicht der Zugriff, sondern der Inhalt: Die geheimen Teile
	 * liegen verschlüsselt, mit dem Geheimnis aus der Umgebung (`tresor.ts`).
	 * Ein Datenbankauszug allein nützt damit nichts.
	 */
	device_identity: 'Eigenes Geräteschlüsselpaar, kein Mandantendatum; die geheimen Teile liegen verschlüsselt'
};

describe('Zeilenschutz über den ganzen Bestand', () => {
	it('trägt auf jeder Tabelle ausser den begründeten Ausnahmen', async () => {
		const zeilen = await admin<
			{ tabelle: string; rls: boolean; force: boolean; regeln: number }[]
		>`
			SELECT c.relname               AS tabelle,
			       c.relrowsecurity        AS rls,
			       c.relforcerowsecurity   AS force,
			       count(p.polname)::int   AS regeln
			  FROM pg_class c
			  JOIN pg_namespace n ON n.oid = c.relnamespace
			  LEFT JOIN pg_policy p ON p.polrelid = c.oid
			 -- Auch partitionierte Tabellen ('p'), nicht nur gewöhnliche ('r').
			 -- Heute gibt es keine; die Zusage «über den ganzen Bestand» hält aber
			 -- erst mit diesem Zusatz, und die erste Partition käme sonst
			 -- ungeprüft herein (Abnahme 08.08.2026).
			 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
			 GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
			 ORDER BY c.relname
		`;

		// Ein leeres Ergebnis wäre der stillste Fehlschlag von allen: Der
		// Prüfstand wäre grün, weil er nichts geprüft hat.
		expect(zeilen.length).toBeGreaterThan(35);

		const ungeschuetzt = zeilen
			.filter((z) => !(z.tabelle in OHNE_ZEILENSCHUTZ))
			.filter((z) => !z.rls || !z.force || z.regeln === 0)
			.map((z) => `${z.tabelle} (rls=${z.rls} force=${z.force} regeln=${z.regeln})`);

		expect(ungeschuetzt).toEqual([]);
	});

	it('lässt sich nicht mit einer Regel abspeisen, die nichts einschränkt', async () => {
		/*
		 * **Der Prüfstand zählte Regeln, statt sie zu lesen** (Abnahme
		 * 08.08.2026). Eine Tabelle mit `ENABLE`, `FORCE` und
		 * `CREATE POLICY … USING (true)` kam anstandslos durch — und das ist
		 * genau der nächste Fehler dieser Klasse: Der Schutz sieht dann in jedem
		 * Katalogauszug richtig aus und lässt alles durch.
		 *
		 * Geprüft wird deshalb der Ausdruck: Jede Regel muss den Mandanten aus
		 * `versammlung.operator_id` heranziehen.
		 */
		/*
		 * **Beide Ausdrücke, nicht nur `USING`** (Migration 154). Eine Regel nur
		 * für INSERT hat kein `USING`, sondern allein `WITH CHECK`; eine Regel
		 * für alles kann neben einem strengen `USING` ein `WITH CHECK (true)`
		 * tragen. Geprüft wird deshalb jeder Ausdruck, den eine Regel hat, und
		 * eine Regel ohne jeden Ausdruck gilt als zahnlos.
		 */
		const zeilen = await admin<
			{ tabelle: string; regel: string; lesen: string | null; schreiben: string | null }[]
		>`
			SELECT c.relname AS tabelle,
			       p.polname AS regel,
			       pg_get_expr(p.polqual, p.polrelid) AS lesen,
			       pg_get_expr(p.polwithcheck, p.polrelid) AS schreiben
			  FROM pg_policy p
			  JOIN pg_class c ON c.oid = p.polrelid
			  JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE n.nspname = 'public'
		`;

		expect(zeilen.length).toBeGreaterThan(35);

		const zahnlos = zeilen
			.filter((z) => {
				const ausdruecke = [z.lesen, z.schreiben].filter((a): a is string => a !== null);
				return (
					ausdruecke.length === 0 ||
					ausdruecke.some((a) => !a.includes('versammlung.operator_id'))
				);
			})
			.map((z) => `${z.tabelle}.${z.regel}: ${z.lesen} / ${z.schreiben}`);

		expect(zahnlos).toEqual([]);
	});

	it('lässt die Antragstellertabelle wieder lesen und schreiben', async () => {
		/*
		 * **Der Fund des Wächters vom 08.08.2026.** Die Regel auf
		 * `agenda_item_proposer` fragte `app.operator_id` ab, gesetzt wird aber
		 * `versammlung.operator_id` — sie traf also nie zu. Nicht zu viel
		 * durchgelassen, sondern gar nichts: Die Tabelle war unter der
		 * Anwendungsrolle leer, und der Antrag mehrerer Eigentümer gemeinsam hätte
		 * in Betrieb nicht funktioniert.
		 *
		 * Der Prüfstand oben fängt die Fehlerklasse ab; dieser hier belegt, dass
		 * die Tabelle nach Migration 057 wirklich wieder trägt — eine Regel kann
		 * dem richtigen Muster folgen und trotzdem am falschen Feld hängen.
		 */
		const [{ da }] = await imKontext(
			betreiberA,
			(tx) => tx<{ da: boolean }[]>`
				SELECT current_setting('versammlung.operator_id', true) IS NOT NULL AS da
			`
		);
		expect(da).toBe(true);

		// Ein Lesezugriff, der nicht an der Regel scheitert. Ohne die Berichtigung
		// wäre schon das Zählen auf einer gefüllten Tabelle 0 gewesen.
		const gelesen = await imKontext(
			betreiberA,
			(tx) => tx<{ anzahl: number }[]>`SELECT count(*)::int AS anzahl FROM agenda_item_proposer`
		);
		expect(gelesen[0].anzahl).toBe(0);

		const [regel] = await admin<{ ausdruck: string }[]>`
			SELECT pg_get_expr(p.polqual, p.polrelid) AS ausdruck
			  FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
			 WHERE c.relname = 'agenda_item_proposer'
		`;
		expect(regel.ausdruck).toMatch(/versammlung\.operator_id/);
		expect(regel.ausdruck).not.toMatch(/app\.operator_id/);
	});

	it('führt keine Ausnahme, die es nicht mehr gibt', async () => {
		// Sonst bleibt eine Ausnahme stehen, nachdem die Tabelle
		// Zeilenschutz bekommen hat, und deckt die nächste Lücke zu.
		const [{ namen }] = await admin<{ namen: string[] }[]>`
			SELECT array_agg(c.relname) AS namen
			  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
		`;
		expect([...(namen ?? [])].sort()).toEqual(Object.keys(OHNE_ZEILENSCHUTZ).sort());
	});
});

describe('B-01 · Der Betreiber trägt Zeilenschutz', () => {
	it('zeigt im Kontext von A nur A', async () => {
		const gesehen = await imKontext(
			betreiberA,
			(tx) => tx<{ id: string }[]>`SELECT id FROM operator`
		);
		expect(gesehen.map((z) => z.id)).toEqual([betreiberA]);
	});

	it('ändert bei einem UPDATE ohne WHERE nur den eigenen Betreiber', async () => {
		/*
		 * **Das ist der Befund in einem Satz.** Vor dieser Migration hätte ein
		 * vergessenes `WHERE` die Aufbewahrungsfrist **aller** Betreiber
		 * umgestellt. Jetzt greift die Änderung ins Leere, wo sie nicht hingehört
		 * — dieselbe Zusage wie auf den 37 anderen Tabellen.
		 */
		await imKontext(betreiberA, (tx) => tx`UPDATE operator SET retention_years = 11`);

		const [a] = await imKontext(
			betreiberA,
			(tx) => tx<{ retention_years: number }[]>`SELECT retention_years FROM operator`
		);
		const [b] = await imKontext(
			betreiberB,
			(tx) => tx<{ retention_years: number }[]>`SELECT retention_years FROM operator`
		);
		expect(a.retention_years).toBe(11);
		expect(b.retention_years).not.toBe(11);
	});

	it('liefert ohne gesetzten Mandanten nichts', async () => {
		// Die Trennung fällt zur sicheren Seite aus: kein Kontext, keine Daten.
		const gesehen = await app<{ id: string }[]>`SELECT id FROM operator`;
		expect(gesehen).toEqual([]);
	});

	it('lässt die Anwendung keinen Betreiber anlegen', async () => {
		// Das Aufsetzen läuft über die privilegierte Rolle. Legte die Anwendung
		// selbst einen Betreiber an, entstünde ein Mandant, den niemand bestellt hat.
		await expect(
			imKontext(betreiberA, (tx) => tx`INSERT INTO operator (name) VALUES ('geschmuggelt')`)
		).rejects.toThrow(/denied|verweigert/i);
	});

	it('lässt die Anwendung keinen Betreiber löschen', async () => {
		await expect(
			imKontext(betreiberA, (tx) => tx`DELETE FROM operator WHERE id = ${betreiberA}`)
		).rejects.toThrow(/denied|verweigert/i);
	});
});

/** Ob die Anwendungsrolle ein Recht an einer Tabelle hat. */
async function recht(tabelle: string, art: string): Promise<boolean> {
	const [z] = await admin<{ hat: boolean }[]>`
		SELECT has_table_privilege('versammlung_app', ${tabelle}, ${art}) AS hat
	`;
	return z.hat;
}

describe('B-03 · Das Siegel ist die zweite Schranke wert', () => {
	/*
	 * Beide Tabellen hatten schon einen Auslöser, der Löschen abweist. Der
	 * Rechteentzug ist die zweite Schranke daneben — aus demselben Grund, den
	 * Migration 002 für `audit_entry` nennt: weil eine der beiden durch eine
	 * spätere Migration versehentlich fallen könnte. Geprüft wird deshalb der
	 * **Rechteentzug**, nicht bloss die Wirkung: Ein Auslöser, der zufällig
	 * denselben Fehler wirft, würde eine gefallene Schranke verdecken.
	 */
	it('entzieht der Anwendung das Löschrecht am Siegel', async () => {
		expect(await recht('seal', 'DELETE')).toBe(false);
	});

	it('lässt das Änderungsrecht am Siegel stehen', async () => {
		// Der nachgeholte RFC-3161-Zeitstempel wird eingetragen; der Auslöser
		// `seal_nur_zeitstempel` lässt genau das und nichts sonst durch. Ein
		// Entzug hier machte die Nachholmechanik unmöglich.
		expect(await recht('seal', 'UPDATE')).toBe(true);
	});

	it('entzieht der Anwendung Änderung und Löschung an den Protokollfassungen', async () => {
		expect(await recht('minutes_version', 'UPDATE')).toBe(false);
		expect(await recht('minutes_version', 'DELETE')).toBe(false);
	});

	it('entzieht der Anwendung Änderung und Löschung an den Fehlversuchen', async () => {
		// Sonst liesse sich die Sperre durch einen Fehler im Anwendungscode
		// aufheben — und die Spur der Versuche mit ihr. `SET succeeded = true`
		// tut das genauso wie ein DELETE (Abnahme 08.08.2026).
		expect(await recht('login_attempt', 'DELETE')).toBe(false);
		expect(await recht('login_attempt', 'UPDATE')).toBe(false);
	});

	it('hält jede Entziehung, die je eine Migration ausgesprochen hat', async () => {
		/*
		 * **Aus den Migrationen abgeleitet, nicht abgeschrieben** (Abnahme
		 * 08.08.2026). Die erste Fassung führte hier eine Liste von zwölf
		 * Tabellennamen — also genau das, was der Kopf dieser Datei kritisiert:
		 * eine Aufzählung, an der die nächste Tabelle vorbeirutscht.
		 *
		 * Was sich wirklich als Klasse fassen lässt, ist die **Drift**: Migration
		 * 002 vergibt über `ALTER DEFAULT PRIVILEGES` alle vier Rechte an jede
		 * künftige Tabelle. Ein `GRANT` in einer späteren Migration kann eine
		 * frühere Entziehung deshalb still wieder aufheben, ohne dass jemand es
		 * bemerkt. Dieser Prüfstand liest alle Entziehungen aus dem
		 * Migrationsverzeichnis und stellt sie dem heutigen Stand gegenüber.
		 *
		 * Was er nicht kann: erkennen, dass eine **neue** Tabelle eine Entziehung
		 * gebraucht hätte. Das bleibt eine menschliche Entscheidung — nur wird
		 * sie jetzt nicht mehr rückgängig gemacht, ohne rot zu werden.
		 */
		const verzeichnis = new URL('../../migrations/', import.meta.url);
		const dateien = (await readdir(verzeichnis)).filter((d) => d.endsWith('.sql')).sort();
		expect(dateien.length).toBeGreaterThan(50);

		const verlangt = new Map<string, Set<string>>();
		for (const d of dateien) {
			const inhalt = await readFile(new URL(d, verzeichnis), 'utf8');
			for (const t of inhalt.matchAll(
				/REVOKE\s+([A-Z,\s]+?)\s+ON\s+(\w+)\s+FROM\s+versammlung_app/gi
			)) {
				const arten = t[1]
					.split(',')
					.map((a) => a.trim().toUpperCase())
					.filter((a) => ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(a));
				if (arten.length === 0) continue;
				const bisher = verlangt.get(t[2]) ?? new Set<string>();
				arten.forEach((a) => bisher.add(a));
				verlangt.set(t[2], bisher);
			}
		}

		// Wenn das Auslesen scheitert, wäre der Prüfstand grün, weil er nichts
		// gefunden hat — der stillste Fehlschlag von allen.
		expect(verlangt.size).toBeGreaterThan(12);

		const zurueckgefallen: string[] = [];
		for (const [tabelle, arten] of verlangt) {
			for (const art of arten) {
				if (await recht(tabelle, art)) zurueckgefallen.push(`${tabelle}: ${art} wieder vergeben`);
			}
		}
		expect(zurueckgefallen).toEqual([]);
	});
});

describe('Rechte nach Absicht (D3, D11, Migration 154)', () => {
	it('entzieht Änderung und Löschung an den Befunden zur Beschlussfähigkeit (D3)', async () => {
		// Ein Befund wird nicht berichtigt, sondern durch einen neuen abgelöst
		// (Migration 080). Gewährt war nur SELECT, INSERT, gewirkt haben alle vier.
		expect(await recht('quorum_finding', 'UPDATE')).toBe(false);
		expect(await recht('quorum_finding', 'DELETE')).toBe(false);
	});

	it('entzieht Änderung und Löschung an der eigenen Geräteidentität (D11)', async () => {
		// Der eindeutige Index hält nur eine zweite Identität ab, nicht das
		// Ersetzen oder Entfernen der ersten (Migration 116). Die Tabelle trägt
		// keinen Zeilenschutz; das Recht ist hier die einzige Schranke.
		expect(await recht('device_identity', 'UPDATE')).toBe(false);
		expect(await recht('device_identity', 'DELETE')).toBe(false);
	});

	it('lässt der Anwendung kein Recht, das ihr keine Migration gewährt hat', async () => {
		/*
		 * **Die Klasse hinter D3 und D11** (Sicherheitsdurchgang 09.10.2026,
		 * gemessen am 13.10.2026). Migration 002 vergibt alle vier Rechte an jede
		 * künftige Tabelle. Wer danach `GRANT SELECT, INSERT ON …` schreibt,
		 * drückt eine Absicht aus und nimmt nichts weg: An sieben Tabellen hatte
		 * die Anwendung ein Recht, das ihre Migration nicht nannte, und an einer
		 * (`minutes`) brauchte der Code genau so ein Recht.
		 *
		 * Die Regel deshalb: Nennt eine Migration für eine Tabelle Rechte
		 * ausdrücklich, dann hat die Anwendung keine anderen. Wer eines mehr
		 * braucht, schreibt es als GRANT hin.
		 *
		 * Was der Prüfstand nicht sieht: eine Tabelle, für die keine Migration
		 * ein Recht nennt. Für die gelten die Vorgaben aus 002, und ob das
		 * gewollt ist, bleibt eine Entscheidung am Bau.
		 *
		 * Ein Recht auf einzelne Spalten (`GRANT UPDATE (ended_at) ON …`)
		 * gewährt kein Recht auf die ganze Tabelle und nimmt sie auch nicht in
		 * die Prüfung. Migration 129 zeigt warum: Dort bleiben SELECT und
		 * INSERT aus den Vorgaben bewusst stehen, DELETE wird entzogen, und das
		 * Spaltenrecht kommt dazu. Das ist das andere Muster des Hauses
		 * (entziehen statt gewähren), und es bewacht schon der Prüfstand oben.
		 * Ein GRANT auf mehrere Tabellen zählt für jede (Code-Review
		 * 13.10.2026; die erste Fassung liess beide Formen still aus).
		 */
		const verzeichnis = new URL('../../migrations/', import.meta.url);
		const dateien = (await readdir(verzeichnis)).filter((d) => d.endsWith('.sql')).sort();

		const gewaehrt = new Map<string, Set<string>>();
		for (const d of dateien) {
			// Kommentare weg: Ein GRANT in einer Begründung gewährt nichts.
			const inhalt = (await readFile(new URL(d, verzeichnis), 'utf8')).replace(/--[^\n]*/g, '');
			for (const t of inhalt.matchAll(
				/GRANT\s+((?:\w+(?:\s*\([^)]*\))?\s*,\s*)*\w+(?:\s*\([^)]*\))?)\s+ON\s+(?:TABLE\s+)?(\w+(?:\s*,\s*\w+)*)\s+TO\s+versammlung_app/gi
			)) {
				// Spaltenrechte weg: Sie gewähren die Tabelle nicht.
				const arten = t[1]
					.split(/,(?![^(]*\))/)
					.map((a) => a.trim())
					.filter((a) => !a.includes('('))
					.map((a) => a.toUpperCase());
				if (arten.length === 0) continue;
				for (const roh of t[2].split(',')) {
					const tabelle = roh.trim().toLowerCase();
					// `ALTER DEFAULT PRIVILEGES … ON TABLES/SEQUENCES TO` ist keine Tabelle.
					if (tabelle === 'tables' || tabelle === 'sequences') continue;
					const bisher = gewaehrt.get(tabelle) ?? new Set<string>();
					arten.forEach((a) => bisher.add(a));
					gewaehrt.set(tabelle, bisher);
				}
			}
		}

		// Leer hiesse: das Muster trifft nicht mehr, und der Prüfstand ist blind.
		expect(gewaehrt.size).toBeGreaterThan(15);

		const zuviel: string[] = [];
		for (const [tabelle, arten] of gewaehrt) {
			const [{ da }] = await admin<{ da: boolean }[]>`
				SELECT to_regclass(${'public.' + tabelle}) IS NOT NULL AS da
			`;
			if (!da) continue;
			for (const art of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
				if (arten.has(art)) continue;
				if (await recht(tabelle, art)) zuviel.push(`${tabelle}: ${art} ohne GRANT`);
			}
		}
		expect(zuviel).toEqual([]);
	});
});

describe('D9 · Verlaufseinträge ohne Betreiber', () => {
	/*
	 * Die Regel aus Migration 001 liess `operator_id IS NULL` für alle zu.
	 * Ohne Betreiber schreibt die fehlgeschlagene Anmeldung mit einem Namen,
	 * den es nicht gibt; damit las jede Sitzungsleitung mit, welche Namen bei
	 * fremden Betreibern durchprobiert wurden (Sicherheitsdurchgang
	 * 09.10.2026). Seit Migration 154 darf die Anwendung solche Zeilen
	 * anfügen, aber nicht lesen.
	 */
	it('zeigt einen Eintrag ohne Betreiber keinem Betreiber', async () => {
		const merkmal = `ohne-betreiber-${Date.now()}`;
		await admin`
			INSERT INTO audit_entry (operator_id, actor_label, event_type, clock_source)
			VALUES (NULL, ${merkmal}, 'user.login.failed', 'system')
		`;
		const gesehen = await imKontext(
			betreiberA,
			(tx) => tx<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_entry WHERE actor_label = ${merkmal}`
		);
		expect(gesehen[0].n).toBe(0);

		// Gegenprobe: Die Zeile ist da. Ohne sie wäre die Null oben auch dann
		// grün, wenn das Einfügen gescheitert wäre.
		const [{ n }] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM audit_entry WHERE actor_label = ${merkmal}
		`;
		expect(n).toBe(1);
	});

	it('zeigt den eigenen Eintrag weiterhin', async () => {
		const merkmal = `mit-betreiber-${Date.now()}`;
		await imKontext(
			betreiberA,
			(tx) => tx`
				INSERT INTO audit_entry (operator_id, actor_label, event_type, clock_source)
				VALUES (${betreiberA}, ${merkmal}, 'user.login.failed', 'system')
			`
		);
		const gesehen = await imKontext(
			betreiberA,
			(tx) => tx<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_entry WHERE actor_label = ${merkmal}`
		);
		expect(gesehen[0].n).toBe(1);
	});

	it('lässt die Anwendung einen Eintrag ohne Betreiber weiterhin anfügen', async () => {
		/*
		 * So schreibt `anmelden()` den Fehlversuch mit unbekanntem Namen: leerer
		 * Mandant, `operator_id` NULL. Schlüge das fehl, scheiterte jede
		 * Anmeldung mit falschem Namen an ihrem Vermerk, als 500 statt als
		 * Absage.
		 */
		const merkmal = `anfuegen-${Date.now()}`;
		await app.begin(async (tx) => {
			await tx`SELECT set_config('versammlung.operator_id', '', true)`;
			await tx`
				INSERT INTO audit_entry (operator_id, actor_label, event_type, clock_source)
				VALUES (NULL, ${merkmal}, 'user.login.failed', 'system')
			`;
		});
		const [{ n }] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM audit_entry WHERE actor_label = ${merkmal}
		`;
		expect(n).toBe(1);
	});

	it('lässt die Anwendung keinen Eintrag unter fremdem Betreiber anfügen', async () => {
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO audit_entry (operator_id, actor_label, event_type, clock_source)
					VALUES (${betreiberB}, 'untergeschoben', 'user.login.failed', 'system')
				`
			)
		).rejects.toThrow(/row-level security|Zeilensicherheit/i);
	});
});
