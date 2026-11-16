import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { bindungen, RAHMENNAMEN } from '../../scripts/lib/kernbindung.mjs';

/**
 * Der Gegentest zur Kernbindungsregel (`scripts/lib/kernbindung.mjs`).
 *
 * **Warum die Regel als eigenes Modul steht und nicht im Wächter.** Ein
 * Wächter, der nur am gesunden Bestand läuft, ist grün, weil der Bestand
 * gesund ist — nicht, weil er misst. Erst wenn die Regel eine Funktion ist,
 * lässt sich ihr ein Fall reichen, in dem die Bindung **fehlt**, und dann
 * verlangen, dass sie rot wird. Der Rat kam am 07.09.2026 von website-94,
 * nachdem ihr eigener Wächter eine Eigenschaft der Bibliothek geprüft hatte
 * statt der eigenen Regel.
 *
 * **Jede Absage bekommt ihre eigene Probe.** Die erste Fassung dieser Datei
 * hatte fünf rote Fälle, aber alle fielen an derselben Schranke: Wer
 * `VERGLEICH` unwirksam machte, blieb grün, weil die `WHERE`-Prüfung noch
 * traf. Gemessen im Code-Review vom 08.09.2026 — beide Schranken einzeln
 * ausgehebelt, alle Proben grün. Deshalb steht unten je Mechanismus ein Fall,
 * der **nur** ihn trifft.
 */

/** Der Rumpf einer Kernfunktion, wie er in `src/lib/server` steht. */
function kern(rumpf: string): string {
	return `export async function handle(handelnder, meetingId, id) {\n${rumpf}\n}`;
}

function felder(quelle: string, name = 'handle') {
	return bindungen(quelle, 'probe.ts', name).felder;
}

describe('erkennt die Bindung, wo sie steht', () => {
	it('findet sie in der Abfrage selbst', () => {
		const e = felder(
			kern('await tx`DELETE FROM agenda_item WHERE id = ${id} AND meeting_id = ${meetingId}`;')
		);
		expect(e).toHaveLength(1);
		expect(e[0].gebunden).toBe(true);
	});

	it('folgt einem Helfer, der beide Werte bekommt', () => {
		const e = felder(
			`async function leseEines(tx, meetingId, id) {
				const [z] = await tx\`SELECT * FROM agenda_item WHERE id = \${id} AND meeting_id = \${meetingId}\`;
				return z;
			}
			${kern('const t = await leseEines(tx, meetingId, id);')}`
		);
		expect(e[0].gebunden).toBe(true);
		expect(e[0].weg).toEqual(['leseEines']);
	});

	it('folgt zwei Stufen weit', () => {
		// Die Tiefe ist kein Zierrat: `vollmacht.ts` geht über zwei Helfer.
		const e = felder(
			`async function tief(tx, meetingId, id) {
				await tx\`SELECT 1 FROM t WHERE id = \${id} AND meeting_id = \${meetingId}\`;
			}
			async function mitte(tx, meetingId, id) { await tief(tx, meetingId, id); }
			${kern('await mitte(tx, meetingId, id);')}`
		);
		expect(e[0].gebunden).toBe(true);
		expect(e[0].weg).toEqual(['mitte', 'tief']);
	});

	it('kennt die parametrisierte Abfrage mit $1 und $2', () => {
		// So bindet `zugehoerigkeit.ts`, weil der Tabellenname variabel ist.
		const e = felder(
			kern(
				'const z = await tx.unsafe(`SELECT 1 FROM ${tabelle} WHERE id = $1 AND meeting_id = $2`, [id, meetingId]);'
			)
		);
		expect(e[0].gebunden).toBe(true);
	});

	it('nimmt die Mengenbedingung ANY und IN an', () => {
		// `holeVersandanschriften` schreibt genau so; die Klammern gehören zur
		// Schreibweise, nicht zur Verschachtelung.
		for (const sql of [
			'SELECT 1 FROM t WHERE meeting_id = ${meetingId} AND id = ANY(${id})',
			'SELECT 1 FROM t WHERE meeting_id = ${meetingId} AND id IN (${id})'
		]) {
			expect(felder(kern(`await tx\`${sql}\`;`))[0].gebunden, sql).toBe(true);
		}
	});

	it('nimmt die nullsichere Gleichheit an', () => {
		const e = felder(
			kern(
				'await tx`SELECT 1 FROM t WHERE id = ${id} AND meeting_id IS NOT DISTINCT FROM ${meetingId}`;'
			)
		);
		expect(e[0].gebunden).toBe(true);
	});

	it('prüft gegen JEDEN Rahmen der Signatur, nicht nur den ersten', () => {
		// `erhebeAufnahmelage(operatorId, tagId, meetingId)` trägt zwei Rahmen.
		const quelle = `export async function handle(operatorId, tagId, meetingId) {
			await tx\`SELECT 1 FROM meeting WHERE id = \${meetingId} AND meeting_day_id = \${tagId}\`;
		}`;
		const e = felder(quelle);
		expect(e.length).toBeGreaterThan(0);
		expect(e.every((f: { gebunden: boolean }) => f.gebunden)).toBe(true);
	});
});

describe('hält das Weiterreichen NICHT für eine Bindung', () => {
	/**
	 * **Trifft nur die Stellungsprüfung.** Die Vorlage hat eine `WHERE`-Klausel,
	 * beide Werte stehen in ihr, die Kennung wird sogar verglichen — nur der
	 * Rahmen steht in der Auswahlliste statt in der Bedingung. Ohne diesen Fall
	 * bliebe die Probe grün, wenn jemand `VERGLEICH` aushebelt, weil dann die
	 * `WHERE`-Schranke allein alle übrigen roten Fälle abfängt.
	 */
	it('zählt einen Wert ausserhalb der Bedingung nicht, obwohl ein WHERE dasteht', () => {
		// Beide Werte stehen in der Vorlage, die Vorlage hat ein WHERE, und die
		// Kennung wird verglichen — der Rahmen aber steht in der Auswahlliste.
		// Nur die Stellungsprüfung trennt das; ohne sie wäre der Fall grün.
		const e = felder(
			kern('await tx`INSERT INTO log (a, b) SELECT ${meetingId}, x FROM t WHERE id = ${id}`;')
		);
		expect(e[0].gebunden).toBe(false);
	});

	/**
	 * **Trifft nur die `WHERE`-Schranke.** Beide Werte stehen in
	 * Vergleichsstellung (`a =`, `b =`), aber die Anweisung schränkt überhaupt
	 * nichts ein: Sie hat keine Bedingung. Ohne diesen Fall bliebe die Probe
	 * grün, wenn jemand die Schranke entfernt — gemessen am 08.09.2026, da
	 * überlebten alle 21 Prüfungen genau diese Mutation.
	 */
	it('zählt eine Anweisung ganz ohne Bedingung nicht', () => {
		const e = felder(kern('await tx`UPDATE t SET a = ${id}, b = ${meetingId}`;'));
		expect(e[0].gebunden).toBe(false);
	});

	/**
	 * **Der Fall aus dem Bestand** (`versammlungstag.ts · nimmInTagAuf`). Der
	 * Rahmen wird **zugewiesen**, nicht verglichen; die Abfrage schränkt nur
	 * über die Kennung ein. Genau damit geriete eine fremde Versammlung in den
	 * eigenen Abend, und die erste Fassung der Regel meldete Grün.
	 */
	it('zählt eine SET-Zuweisung des Rahmens nicht als Bindung', () => {
		const e = felder(
			kern('await tx`UPDATE meeting SET meeting_day_id = ${meetingId} WHERE id = ${id}`;')
		);
		expect(e[0].gebunden).toBe(false);
	});

	it('zählt ein ODER nicht, weil es die Einschränkung aufhebt', () => {
		const e = felder(
			kern('await tx`DELETE FROM agenda_item WHERE id = ${id} OR meeting_id = ${meetingId}`;')
		);
		expect(e[0].gebunden).toBe(false);
	});

	it('zählt die Ungleichheit nicht — sie ist die Anti-Bindung', () => {
		const e = felder(
			kern('await tx`SELECT 1 FROM t WHERE id = ${id} AND meeting_id <> ${meetingId}`;')
		);
		expect(e[0].gebunden).toBe(false);
	});

	it('zählt eine Unterabfrage nicht, die nur die Existenz des Rahmens prüft', () => {
		const e = felder(
			kern(
				'await tx`SELECT 1 FROM t WHERE id = ${id} AND 1 = (SELECT 1 FROM meeting WHERE id = ${meetingId})`;'
			)
		);
		expect(e[0].gebunden).toBe(false);
	});

	/** Der Rahmen aus dem FORMULAR ist die Fehlerklasse selbst, nicht ihr Beleg. */
	it('zählt einen Rahmen aus einem Objektzugriff nicht', () => {
		const e = felder(
			kern('await tx`SELECT 1 FROM t WHERE id = ${id} AND meeting_id = ${daten.meetingId}`;')
		);
		expect(e[0].gebunden).toBe(false);
	});

	it('zählt eine verschattete Schleifenvariable nicht', () => {
		const e = felder(
			kern(
				'for (const id of andere) {\n\tawait tx`SELECT 1 FROM t WHERE id = ${id} AND meeting_id = ${meetingId}`;\n}'
			)
		);
		expect(e[0].gebunden).toBe(false);
	});

	/**
	 * **Die Verschattung gilt auch im Helfer** (Code-Review 08.09.2026). Wer den
	 * Rahmen aus der gelesenen Zeile überschreibt, vergleicht ihn danach mit
	 * sich selbst — eine Prüfung, die nicht scheitern kann.
	 */
	it('zählt einen Helfer nicht, der den Rahmen aus der Zeile überschreibt', () => {
		const e = felder(
			`async function helfer(tx, meetingId, id) {
				const [z] = await tx\`SELECT meeting_id FROM agenda_item WHERE id = \${id}\`;
				meetingId = z.meeting_id;
				await tx\`DELETE FROM t WHERE id = \${id} AND meeting_id = \${meetingId}\`;
			}
			${kern('await helfer(tx, meetingId, id);')}`
		);
		expect(e[0].gebunden).toBe(false);
	});

	it('zählt einen Helfer nicht, der beide Werte nur protokolliert', () => {
		const e = felder(
			`async function protokolliere(tx, meetingId, id) {
				await tx\`INSERT INTO log (a, b) VALUES (\${meetingId}, \${id})\`;
			}
			${kern('await protokolliere(tx, meetingId, id);\nawait tx`DELETE FROM agenda_item WHERE id = ${id}`;')}`
		);
		expect(e[0].gebunden).toBe(false);
	});

	it('zählt einen Rahmen nicht, der nie in eine Abfrage kommt', () => {
		const e = felder(
			kern("if (!meetingId) throw new Error('fehlt');\nawait tx`DELETE FROM agenda_item WHERE id = ${id}`;")
		);
		expect(e[0].gebunden).toBe(false);
	});

	it('zählt einen Wert nicht, der nur im Wertearray steht', () => {
		const e = felder(kern('const z = await tx.unsafe(`SELECT 1 FROM t WHERE id = $1`, [id, meetingId]);'));
		expect(e[0].gebunden).toBe(false);
	});

	it('meldet eine Funktion ganz ohne Rahmen als offen', () => {
		const e = felder(
			'export async function handle(handelnder, id) {\n\tawait tx`DELETE FROM t WHERE id = ${id}`;\n}'
		);
		expect(e[0].gebunden).toBe(false);
		expect(e[0].grund).toMatch(/Rahmen/);
	});

	/** Ein Absturz ist kein Befund: Er ist rot und belegt nichts. */
	it('stürzt nicht ab, wenn ein gleichnamiger Helfer weniger Parameter hat', () => {
		const quelle = `const werkzeuge = { hole(a) { return a; } };
		${kern('const z = await hole(tx, meetingId, id);')}`;
		expect(() => felder(quelle)).not.toThrow();
		expect(felder(quelle)[0].gebunden).toBe(false);
	});
});

/**
 * **Die Formen, die die Sicherheitsprüfung vom 08.09.2026 gefunden hat.**
 *
 * Alle sechs lieferten Grün, obwohl die Abfrage die Zeile nicht auf den Rahmen
 * einschränkt, und vier davon stehen so im Bestand. Sie stehen hier als
 * Tabelle, weil sie eine gemeinsame Wurzel haben: Der Ausschnitt wurde rein
 * textuell gebildet. Wer daran etwas ändert, muss alle wieder rot bekommen.
 */
describe('kennt die Verstecke, in denen eine Bindung nur so aussieht', () => {
	const kernSql = (sql: string) =>
		bindungen(`export async function handle(h, meetingId, id) { await tx\`${sql}\`; }`, 'p.ts', 'handle')
			.felder[0];

	const rot: [string, string][] = [
		[
			'die Bindung steht im Hilfsblock, nicht in der Anweisung',
			'WITH rahmen AS (SELECT id FROM meeting WHERE id = ${meetingId}) DELETE FROM agenda_item WHERE id = ${id}'
		],
		[
			'der zweite Zweig eines UNION bindet, der erste nicht',
			'SELECT 1 FROM agenda_item WHERE id = ${id} UNION ALL SELECT 1 FROM meeting WHERE id = ${meetingId}'
		],
		[
			'ein Zeilenkommentar hat die Bindung stillgelegt',
			'DELETE FROM agenda_item WHERE id = ${id}\n-- AND meeting_id = ${meetingId}'
		],
		[
			'ein Blockkommentar hat die Bindung stillgelegt',
			'DELETE FROM agenda_item WHERE id = ${id} /* AND meeting_id = ${meetingId} */'
		],
		['NOT vor dem Vergleich kehrt ihn um', 'SELECT 1 FROM t WHERE id = ${id} AND NOT meeting_id = ${meetingId}'],
		[
			'HAVING schränkt die Zeilen nicht ein',
			'SELECT a FROM t WHERE id = ${id} GROUP BY a HAVING meeting_id = ${meetingId}'
		],
		[
			'ORDER BY schränkt gar nichts ein',
			'SELECT 1 FROM t WHERE id = ${id} ORDER BY meeting_id = ${meetingId} DESC'
		],
		[
			'der Rahmen steht in einem Textwert',
			"UPDATE agenda_item SET notiz = 'WHERE meeting_id = ${meetingId}' WHERE id = ${id}"
		]
	];
	for (const [name, sql] of rot) {
		it(`meldet offen: ${name}`, () => {
			expect(kernSql(sql).gebunden).toBe(false);
		});
	}

	/** Die Gegenprobe: Die Verschärfung darf die gewöhnlichen Formen nicht treffen. */
	const gruen: [string, string][] = [
		[
			'ein Hilfsblock davor stört die echte Bindung nicht',
			'WITH x AS (SELECT 1) DELETE FROM agenda_item WHERE id = ${id} AND meeting_id = ${meetingId}'
		],
		[
			'ein JOIN mit Bedingung im WHERE zählt',
			'SELECT 1 FROM agenda_item a JOIN meeting m ON m.id = a.meeting_id WHERE a.id = ${id} AND m.id = ${meetingId}'
		],
		[
			'ORDER BY nach einer echten Bindung stört nicht',
			'SELECT 1 FROM t WHERE id = ${id} AND meeting_id = ${meetingId} ORDER BY a'
		]
	];
	for (const [name, sql] of gruen) {
		it(`bleibt gebunden: ${name}`, () => {
			expect(kernSql(sql).gebunden).toBe(true);
		});
	}
});

/**
 * **Die zweite Runde der Sicherheitsprüfung, 08.09.2026.**
 *
 * Sechs weitere Formen, bei denen die Regel eine Bindung bescheinigte, die
 * keine ist. Die schwerste stand im Bestand: `vorlagen.ts:527` verbindet zwei
 * Tabellenquellen ohne Prädikat, ein Kreuzprodukt — beide Werte werden auf
 * oberster Ebene verglichen, aber gegen **verschiedene Zeilen**.
 */
describe('verlangt, dass beide Vergleiche dieselbe Zeile treffen', () => {
	const kernSql = (sql: string) =>
		bindungen(`export async function handle(h, meetingId, id) { await tx\`${sql}\`; }`, 'p.ts', 'handle')
			.felder[0];

	const rot: [string, string][] = [
		[
			'zwei Quellen ohne Join-Prädikat (der Fall aus vorlagen.ts)',
			'DELETE FROM agenda_item a USING meeting m WHERE a.id = ${id} AND m.id = ${meetingId}'
		],
		[
			'dasselbe als Komma-Liste im FROM',
			'SELECT 1 FROM agenda_item a, meeting m WHERE a.id = ${id} AND m.id = ${meetingId}'
		],
		[
			'dasselbe als CROSS JOIN',
			'SELECT 1 FROM agenda_item a CROSS JOIN meeting m WHERE a.id = ${id} AND m.id = ${meetingId}'
		],
		[
			'ein verschachtelter Blockkommentar — Postgres verschachtelt sie',
			'DELETE FROM agenda_item WHERE id = ${id} /* a /* b */ AND meeting_id = ${meetingId} */'
		],
		[
			'Dollar-Quoting ist ebenfalls Text',
			'UPDATE agenda_item SET notiz = $$ WHERE meeting_id = ${meetingId} $$ WHERE id = ${id}'
		],
		[
			'CASE WHEN schränkt keine Zeile ein',
			'SELECT 1 FROM t WHERE id = ${id} AND CASE WHEN meeting_id = ${meetingId} THEN true ELSE true END'
		],
		[
			'ein gequoteter Bezeichner startet den Ausschnitt nicht',
			'UPDATE agenda_item SET "where" = ${meetingId}, x = 1 WHERE id = ${id}'
		],
		[
			'ein Apostroph im Bezeichner verschluckt kein ODER',
			'SELECT 1 FROM t WHERE id = ${id} AND meeting_id = ${meetingId} AND "a\'b" = 1 OR 1=1'
		]
	];
	for (const [name, sql] of rot) {
		it(`meldet offen: ${name}`, () => {
			expect(kernSql(sql).gebunden).toBe(false);
		});
	}

	/**
	 * **Der Join darf nicht mitfallen.** Zwei Aliasse sind erlaubt, sobald ein
	 * Prädikat sie verbindet — sonst wäre die häufigste richtige Bauform rot,
	 * und ein Wächter, der im gewohnten Zustand rot ist, wird abgeschaltet.
	 */
	const gruen: [string, string][] = [
		[
			'JOIN … ON verbindet die beiden Aliasse',
			'SELECT 1 FROM agenda_item a JOIN meeting m ON m.id = a.meeting_id WHERE a.id = ${id} AND m.id = ${meetingId}'
		],
		[
			'derselbe Alias auf beiden Seiten',
			'DELETE FROM agenda_item a WHERE a.id = ${id} AND a.meeting_id = ${meetingId}'
		],
		[
			'FOR UPDATE nach einer echten Bindung',
			'SELECT 1 FROM t WHERE id = ${id} AND meeting_id = ${meetingId} FOR UPDATE'
		]
	];
	for (const [name, sql] of gruen) {
		it(`bleibt gebunden: ${name}`, () => {
			expect(kernSql(sql).gebunden).toBe(true);
		});
	}

	/** Ein Spread im Wertearray verschiebt die `$n` erst zur Laufzeit. */
	it('meldet offen: ein Spread im Wertearray von unsafe', () => {
		const e = bindungen(
			'export async function handle(h, meetingId, id) { await tx.unsafe(`SELECT 1 FROM t WHERE id = $2 AND meeting_id = $3`, [...vorne, id, meetingId]); }',
			'p.ts',
			'handle'
		).felder[0];
		expect(e.gebunden).toBe(false);
	});
});

/**
 * **Die Sichtprobe am echten Bestand.**
 *
 * Sie prüft nicht, dass alles gebunden ist — das ist es heute nicht, und die
 * 28 offenen Fälle sind eine eigene Aufgabe. Sie prüft, dass die Regel den
 * wirklichen Code überhaupt noch trifft: Eine Regel, die nach einem Umbau an
 * allen Dateien vorbeigreift, meldet null Bindungen und ist damit still grün.
 */
describe('greift am echten Bestand', () => {
	const WURZEL = join(process.cwd(), 'src', 'lib', 'server');

	function dateien(verzeichnis: string): string[] {
		const raus: string[] = [];
		let eintraege: string[];
		try {
			eintraege = readdirSync(verzeichnis);
		} catch {
			return raus;
		}
		for (const eintrag of eintraege) {
			const pfad = join(verzeichnis, eintrag);
			if (statSync(pfad).isDirectory()) raus.push(...dateien(pfad));
			else if (eintrag.endsWith('.ts')) raus.push(pfad);
		}
		return raus;
	}

	it('findet die Bindung in traktanden.ts und vollmacht.ts', () => {
		for (const [datei, fn] of [
			['traktanden.ts', 'loescheTraktandum'],
			['vollmacht.ts', 'bestaetigeVollmacht']
		] as const) {
			const quelle = readFileSync(join(WURZEL, datei), 'utf8');
			const e = bindungen(quelle, datei, fn);
			expect(e.gefunden, `${datei} · ${fn} nicht gefunden`).toBe(true);
			// **Ohne diese Zeile ist die Prüfung über einer leeren Liste wahr**
			// und misst nichts (Code-Review 08.09.2026).
			expect(e.felder.length, `${datei} · ${fn} hat keine Kennung mehr`).toBeGreaterThan(0);
			expect(
				e.felder.every((f: { gebunden: boolean }) => f.gebunden),
				`${datei} · ${fn} gilt als ungebunden`
			).toBe(true);
		}
	});

	/**
	 * **Der Fall, den die erste Fassung falsch grün gemeldet hat.**
	 * `nimmInTagAuf` weist den Abend zu (`SET meeting_day_id = ${tagId}`) und
	 * schränkt nur über die Versammlung ein. Wird er wieder grün, ist entweder
	 * die Zuweisungsschranke weg oder jemand hat die Bindung nachgetragen —
	 * beides gehört angesehen.
	 */
	it('meldet nimmInTagAuf weiterhin als offen', () => {
		const quelle = readFileSync(join(WURZEL, 'versammlungstag.ts'), 'utf8');
		const e = bindungen(quelle, 'versammlungstag.ts', 'nimmInTagAuf');
		expect(e.gefunden).toBe(true);
		expect(e.felder.length).toBeGreaterThan(0);
		expect(e.felder.some((f: { gebunden: boolean }) => !f.gebunden)).toBe(true);
	});

	/**
	 * **Der zweite Bestandsfall, den die Regel erst nach der Alias-Prüfung
	 * findet.** `vorlagen.ts:527` verbindet `agenda_item_affected b` und
	 * `meeting m` ohne Prädikat; `m.id = ${meetingId}` sagt nur, dass es die
	 * Zielversammlung gibt. Gemessen am 08.09.2026: ohne die Alias-Prüfung
	 * meldet die Regel dort `gebunden: true`, mit ihr `false`. Die Grenze hält
	 * heute im Anwendungscode darüber — der Kommentar an der Abfrage sagt es
	 * selbst als Annahme.
	 */
	it('meldet kopiereTraktandumIn weiterhin als offen', () => {
		const quelle = readFileSync(join(WURZEL, 'vorlagen.ts'), 'utf8');
		const e = bindungen(quelle, 'vorlagen.ts', 'kopiereTraktandumIn');
		expect(e.gefunden).toBe(true);
		expect(e.felder.length).toBeGreaterThan(0);
		expect(e.felder.every((f: { gebunden: boolean }) => !f.gebunden)).toBe(true);
	});

	/**
	 * Die Untergrenze. Gemessen am 08.09.2026: **53** gebundene Felder über
	 * `src/lib/server`. 45 liegt eng genug darunter, dass der Verlust eines
	 * Rahmennamens auffällt (mit nur `meetingId` bleiben 43), und weit genug,
	 * dass eine gewöhnliche Umbenennung sie nicht auslöst.
	 */
	/*
	 * **Das Zeitlimit ist gesetzt, weil das voreingestellte zweimal einen
	 * Commit gekippt hat** (22.09.2026). Nicht die Probe war rot, sondern die
	 * Uhr: Sie liest alle Dateien unter `src/lib/server` und zählt die
	 * gebundenen Felder, und im vollen Prüflauf teilt sie sich die Kerne mit
	 * allem anderen. Zweimal meldete der Hook «Test timed out in 5000ms», bei
	 * Lastdurchschnitt 10,1 beziehungsweise 10,6, während eine zweite Sitzung
	 * ihren eigenen Lauf fuhr.
	 *
	 * **Gemessen statt geschätzt**, auf ruhiger Maschine, drei Läufe:
	 * 2077 ms, 1282 ms, 1425 ms. Das voreingestellte Limit von 5000 ms war
	 * also nur das Zweieinhalbfache der langsamsten Messung. 30 Sekunden sind
	 * rund das Fünfzehnfache und lassen Luft für eine belegte Maschine.
	 *
	 * **Warum das kein Aufweichen ist:** Das Limit misst nichts. Ob die Probe
	 * vier oder acht Sekunden braucht, ändert nichts daran, ob 45 Felder
	 * gebunden sind. Ein Wächter dagegen, der unter Last kippt, wird
	 * irgendwann mit `OHNE_PRUEFLAUF=1` umgangen, und das ist der teurere
	 * Schaden.
	 *
	 * **Wer sie künftig kippen sieht**, hat mit diesen Zahlen einen Massstab:
	 * Dauert sie ungestört deutlich länger als zwei Sekunden, ist die Probe
	 * langsamer geworden; bleibt sie dort und kippt trotzdem, war die Maschine
	 * voll.
	 */
	it('sieht mindestens 45 gebundene Felder im Bestand', { timeout: 30000 }, () => {
		expect(RAHMENNAMEN.length).toBeGreaterThanOrEqual(3);
		let gebunden = 0;
		for (const pfad of dateien(WURZEL)) {
			const quelle = readFileSync(pfad, 'utf8');
			for (const m of quelle.matchAll(/export (?:async )?function (\w+)\(/g)) {
				const e = bindungen(quelle, pfad, m[1]);
				if (e.gefunden) gebunden += e.felder.filter((f: { gebunden: boolean }) => f.gebunden).length;
			}
		}
		expect(gebunden).toBeGreaterThanOrEqual(45);
	});
});
