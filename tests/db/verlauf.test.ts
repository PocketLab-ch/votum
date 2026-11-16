/**
 * Story 1.3 — der Verlauf hält, was er verspricht.
 *
 * Diese Tests prüfen Zusagen, die nicht im Code stehen, sondern in der Datenbank:
 * Schreibschutz, Zeilenschutz und die Kopplung an die Transaktion. Sie laufen
 * unter der Anwendungsrolle, weil sie sonst nichts beweisen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EREIGNISARTEN, ereignis, uebergang } from '$lib/domain/verlauf';
import { schreibeUebergang, schreibeVerlauf, zeitquelle } from '$lib/server/audit';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import {
	erstelleGeschaeft,
	holeGeschaefte,
	loescheGeschaeft,
	setzeBeteiligte
} from '$lib/server/geschaeft';
import {
	bearbeiteTraktandum,
	erstelleTraktandum,
	loescheTraktandum
} from '$lib/server/traktanden';
import { leseVerlauf } from '$lib/server/verlaufsabfrage';
import { admin, app, imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let betreiberB: string;

const handelnder = { operatorId: '', userId: null, label: 'Prüflauf' };

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Verlauf A');
	betreiberB = await pruefbetreiber('Verlauf B');
	handelnder.operatorId = betreiberA;
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Die Tests laufen unter der richtigen Rolle', () => {
	it('ist die Anwendungsrolle, ohne Superuser und ohne Umgehung des Zeilenschutzes', async () => {
		// Ohne diesen Test beweist keiner der folgenden etwas. Ein Superuser umgeht
		// den Zeilenschutz immer — auch bei FORCE — und ignoriert entzogene Rechte.
		// Liefe die Prüfreihe versehentlich unter der privilegierten Rolle, wäre
		// jede Schutzregel bestätigt und keine davon wirksam.
		const [rolle] = await app<{ name: string; superuser: boolean; umgeht: boolean }[]>`
			SELECT rolname AS name, rolsuper AS superuser, rolbypassrls AS umgeht
			FROM pg_roles WHERE rolname = current_user
		`;
		expect(rolle.name).toBe('versammlung_app');
		expect(rolle.superuser).toBe(false);
		expect(rolle.umgeht).toBe(false);
	});
});

describe('Nur anfügen (AD-5)', () => {
	it('weist ein UPDATE der Anwendungsrolle ab', async () => {
		await imKontext(betreiberA, (tx) =>
			schreibeVerlauf(tx, handelnder, ereignis(EREIGNISARTEN.anmeldung, { art: 'app_user' }))
		);

		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`UPDATE audit_entry SET event_type = 'gefaelscht' WHERE operator_id = ${betreiberA}`
			)
		).rejects.toThrow();
	});

	it('weist ein DELETE der Anwendungsrolle ab', async () => {
		await expect(
			imKontext(betreiberA, (tx) => tx`DELETE FROM audit_entry WHERE operator_id = ${betreiberA}`)
		).rejects.toThrow();
	});

	it('weist es auch dann ab, wenn das Recht bestünde — der Auslöser greift ebenfalls', async () => {
		// Zwei Schranken: entzogenes Recht und Auslöser. Fällt eine durch eine
		// spätere Migration weg, hält die andere. Hier wird die zweite geprüft,
		// indem unter der privilegierten Rolle geändert wird, die das Recht hat.
		await expect(
			admin`UPDATE audit_entry SET event_type = 'gefaelscht' WHERE operator_id = ${betreiberA}`
		).rejects.toThrow(/nur anfügbar/);

		await expect(
			admin`DELETE FROM audit_entry WHERE operator_id = ${betreiberA} AND event_type = 'user.login'`
		).rejects.toThrow(/nur anfügbar/);
	});
});

describe('Zeilenschutz je Betreiber (AD-6)', () => {
	it('weist einen Eintrag ohne Mandantenkontext ab', async () => {
		await expect(
			ohneKontext(
				(tx) => tx`
					INSERT INTO audit_entry (operator_id, actor_label, event_type)
					VALUES (${betreiberA}, 'ohne Kontext', 'user.login')
				`
			)
		).rejects.toThrow();
	});

	it('zeigt einem fremden Betreiber nichts', async () => {
		const ausSichtB = await imKontext(
			betreiberB,
			(tx) => tx`SELECT count(*)::int AS anzahl FROM audit_entry WHERE operator_id = ${betreiberA}`
		);
		expect(ausSichtB[0].anzahl).toBe(0);

		const ausSichtA = await imKontext(
			betreiberA,
			(tx) => tx`SELECT count(*)::int AS anzahl FROM audit_entry WHERE operator_id = ${betreiberA}`
		);
		expect(ausSichtA[0].anzahl).toBeGreaterThan(0);
	});
});

describe('Ein Eintrag je Ereignis, mit allen Angaben', () => {
	it('schreibt Art, Gegenstand, Angaben und Zeitquelle', async () => {
		const kennung = crypto.randomUUID();
		await imKontext(betreiberA, (tx) =>
			schreibeVerlauf(
				tx,
				handelnder,
				ereignis(EREIGNISARTEN.gemeinschaftAngelegt, { art: 'stweg', id: kennung }, { name: 'Musterweg 3' })
			)
		);

		const [eintrag] = await imKontext(
			betreiberA,
			(tx) => tx`SELECT * FROM audit_entry WHERE subject_id = ${kennung}`
		);

		expect(eintrag.event_type).toBe('stweg.created');
		expect(eintrag.subject_type).toBe('stweg');
		expect(eintrag.actor_label).toBe('Prüflauf');
		expect(eintrag.detail).toEqual({ name: 'Musterweg 3' });
		expect(eintrag.clock_source).toBe(zeitquelle());
		// Der Zeitpunkt kommt aus der Datenbank und steht in UTC (AD-12).
		expect(eintrag.occurred_at).toBeInstanceOf(Date);
	});

	it('schreibt mehrere Ereignisse eines Übergangs vollständig', async () => {
		const kennung = crypto.randomUUID();
		const u = uebergang(
			{ id: kennung },
			ereignis(EREIGNISARTEN.einheitAngelegt, { art: 'unit', id: kennung }),
			ereignis(EREIGNISARTEN.eigentumZugeordnet, { art: 'unit', id: kennung })
		);

		const ergebnis = await imKontext(betreiberA, (tx) => schreibeUebergang(tx, handelnder, u));
		expect(ergebnis).toEqual({ id: kennung });

		const zeilen = await imKontext(
			betreiberA,
			(tx) => tx`SELECT event_type FROM audit_entry WHERE subject_id = ${kennung} ORDER BY id`
		);
		expect(zeilen.map((z) => z.event_type)).toEqual(['unit.created', 'ownership.assigned']);
	});
});

describe('Verlauf und Änderung teilen dieselbe Transaktion (AD-1)', () => {
	it('lässt keinen Eintrag zurück, wenn die Änderung scheitert', async () => {
		const kennung = crypto.randomUUID();

		await expect(
			imKontext(betreiberA, async (tx) => {
				await schreibeVerlauf(
					tx,
					handelnder,
					ereignis(EREIGNISARTEN.gemeinschaftAngelegt, { art: 'stweg', id: kennung })
				);
				// Steht für den fachlichen Teil, der danach fehlschlägt.
				throw new Error('Änderung abgebrochen');
			})
		).rejects.toThrow('Änderung abgebrochen');

		const zeilen = await imKontext(
			betreiberA,
			(tx) => tx`SELECT id FROM audit_entry WHERE subject_id = ${kennung}`
		);
		// Kein halber Beleg: Was nicht geschehen ist, steht auch nicht im Verlauf.
		expect(zeilen).toHaveLength(0);
	});
});

describe('Zeitquelle', () => {
	it('vermerkt eine ungesicherte Uhr im Offline-Betrieb', async () => {
		const vorher = process.env.VERSAMMLUNG_OFFLINE;
		process.env.VERSAMMLUNG_OFFLINE = 'true';
		try {
			const kennung = crypto.randomUUID();
			await imKontext(betreiberA, (tx) =>
				schreibeVerlauf(tx, handelnder, ereignis(EREIGNISARTEN.anmeldung, { art: 'app_user', id: kennung }))
			);
			const [eintrag] = await imKontext(
				betreiberA,
				(tx) => tx`SELECT clock_source FROM audit_entry WHERE subject_id = ${kennung}`
			);
			expect(eintrag.clock_source).toBe('local-unsynced');
		} finally {
			if (vorher === undefined) delete process.env.VERSAMMLUNG_OFFLINE;
			else process.env.VERSAMMLUNG_OFFLINE = vorher;
		}
	});
});

/**
 * Eine Versammlung im Entwurf mit einem Traktandum, das angelegt, geändert und
 * wieder entfernt wird. Die Zeile ist danach hart gelöscht; nur der Verlauf
 * erinnert noch an sie.
 */
async function versammlungMitEntferntem(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder, {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const v = await erstelleVersammlung(handelnder, {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder, {
		meetingId: v.id,
		titel: `${name}: Der Punkt`,
		art: 'abstimmung',
		antragswortlaut: 'Der Punkt wird behandelt.',
		antragstellerart: 'bewirtschaftung'
	});
	await bearbeiteTraktandum(handelnder, v.id, t.id, {
		meetingId: v.id,
		titel: `${name}: Der Punkt, geändert`,
		art: 'abstimmung',
		antragswortlaut: 'Der Punkt wird behandelt.',
		antragstellerart: 'bewirtschaftung'
	});
	await loescheTraktandum(handelnder, v.id, t.id);
	return { versammlung: v.id, gemeinschaft: g.id, traktandum: t.id };
}

describe('Ein entferntes Traktandum bleibt im Verlauf seiner Versammlung', () => {
	it('trägt Anlegen, Ändern und Entfernen, obwohl die Zeile gelöscht ist', async () => {
		/*
		 * Der Gegenstand eines Verlaufseintrags ist das Traktandum, nicht die
		 * Versammlung. `gehoertZu` ordnete ihn über die **lebenden** Zeilen zu,
		 * und ein entferntes Traktandum lebt nicht mehr. Anlegen, Ändern und
		 * Entfernen fielen damit aus dem Verlauf der Versammlung, in der Anzeige
		 * wie im Siegelpaket. Das Ereignis `traktandumEntfernt` nennt Traktandum
		 * und Versammlung; es ist die Zuordnung, die den Weg zurück trägt.
		 */
		const a = await versammlungMitEntferntem('Verlauf entfernt A', '2026-06-15');

		const { zeilen } = await leseVerlauf(betreiberA, { versammlung: a.versammlung });
		const meine = zeilen.filter((z) => z.gegenstandId === a.traktandum);

		expect(meine.map((z) => z.art).sort()).toEqual([
			'agenda.item.created',
			'agenda.item.removed',
			'agenda.item.updated'
		]);
	});

	it('holt das entfernte Traktandum einer anderen Versammlung nicht herein', async () => {
		// Derselbe Betreiber, zwei Versammlungen. Die Zuordnung kommt aus den
		// Angaben des Entfernen-Ereignisses; wer sie nur über die Kennung suchte,
		// zöge das fremde Traktandum in jede Versammlung.
		const eine = await versammlungMitEntferntem('Verlauf entfernt B1', '2026-06-16');
		const andere = await versammlungMitEntferntem('Verlauf entfernt B2', '2026-06-17');

		const { zeilen: erste } = await leseVerlauf(betreiberA, { versammlung: eine.versammlung });
		expect(erste.some((z) => z.gegenstandId === andere.traktandum)).toBe(false);

		// Und in der eigenen Versammlung steht es sehr wohl.
		const { zeilen: zweite } = await leseVerlauf(betreiberA, { versammlung: andere.versammlung });
		expect(zweite.some((z) => z.gegenstandId === andere.traktandum)).toBe(true);
	});

	it('findet es auch über die Gemeinschaft und über den Abend', async () => {
		// Die beiden anderen Zweige derselben Funktion tragen dieselbe Lücke:
		// Auf der Gemeinschaftsseite und auf der Abendseite fiel das entfernte
		// Traktandum ebenso heraus. Der Entfernen-Eintrag nennt nur die
		// Versammlung; beide Wege führen über sie.
		const a = await versammlungMitEntferntem('Verlauf entfernt C', '2026-06-18');

		const ueberGemeinschaft = await leseVerlauf(betreiberA, { gemeinschaft: a.gemeinschaft });
		expect(ueberGemeinschaft.zeilen.some((z) => z.gegenstandId === a.traktandum)).toBe(true);

		const abend = await erstelleVersammlungstag(handelnder, {
			bezeichnung: 'Verlauf entfernt C: Abend',
			datum: '2026-06-18',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			betriebsart: 'gefuehrt'
		});
		await nimmInTagAuf(handelnder, abend.id, a.versammlung, 1, true);

		const ueberAbend = await leseVerlauf(betreiberA, { abend: abend.id });
		expect(ueberAbend.zeilen.some((z) => z.gegenstandId === a.traktandum)).toBe(true);
	});
});

/** Ein Abend mit `anzahl` Häusern, jedes mit seinen Pflichttraktanden. */
async function abendMitHaeusern(name: string, anzahl: number) {
	const tag = await erstelleVersammlungstag(handelnder, {
		bezeichnung: `${name}: Abend`,
		datum: '2026-07-01',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		betriebsart: 'gefuehrt'
	});
	const versammlungen: { id: string; gemeinschaft: string }[] = [];
	for (let i = 0; i < anzahl; i++) {
		const g = await erstelleGemeinschaft(handelnder, {
			name: `${name}: Haus ${i + 1}`,
			quotaDenominator: 1000,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const m = await erstelleVersammlung(handelnder, {
			stwegId: g.id,
			datum: '2026-07-01',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await nimmInTagAuf(handelnder, tag.id, m.id, i);
		versammlungen.push({ id: m.id, gemeinschaft: g.id });
	}
	return { tag: tag.id, versammlungen };
}

describe('Die beiden Geschäftslöschstellen schreiben ein Entfernen-Ereignis je Traktandum', () => {
	it('beim Löschen des Geschäfts', async () => {
		/*
		 * `loescheGeschaeft` löschte die Traktanden aller Häuser und schrieb nur
		 * `geschaeftEntfernt` an den Abend. Die Traktanden selbst verschwanden
		 * damit auch aus dem Verlauf ihrer Versammlung: dieselbe Lücke wie beim
		 * einzelnen Traktandum. Ohne diese Ereignisse hätte `gehoertZu` für den
		 * Altbestand dieser Stelle nichts, woran es sie festmachen könnte.
		 */
		const a = await abendMitHaeusern('Verlauf Geschäft löschen', 2);
		const g = await erstelleGeschaeft(handelnder, a.tag, {
			titel: 'Veloständer',
			antragswortlaut: 'Ein Veloständer sei zu beschaffen.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});
		const traktanden = (await holeGeschaefte(betreiberA, a.tag)).find((x) => x.id === g.id)!
			.traktanden;
		expect(traktanden).toHaveLength(2);

		// Eines der beiden stammt aus der Vorlage, wie die Pflichttraktanden
		// eines Abends. Der Eintrag ist unveränderlich; ein fest verdrahtetes
		// «ausVorlage: false» liesse sich nie mehr berichtigen.
		const ausVorlage = traktanden[0].traktandumId;
		await admin`UPDATE agenda_item SET from_template = true WHERE id = ${ausVorlage}`;

		await loescheGeschaeft(handelnder, a.tag, g.id);

		for (const t of traktanden) {
			const { zeilen } = await leseVerlauf(betreiberA, { versammlung: t.meetingId });
			const entfernt = zeilen.find(
				(z) => z.art === 'agenda.item.removed' && z.gegenstandId === t.traktandumId
			);
			expect(entfernt?.angaben?.titel, `kein Entfernen-Ereignis für ${t.meetingId}`).toBe(
				'Veloständer'
			);
			expect(entfernt?.angaben?.ausVorlage).toBe(t.traktandumId === ausVorlage);
		}
	});

	it('beim Herausnehmen einer Gemeinschaft', async () => {
		// `setzeBeteiligte` löscht das Traktandum der entfernten Gemeinschaft;
		// auch dieser Weg schrieb bisher kein Entfernen-Ereignis.
		const a = await abendMitHaeusern('Verlauf Beteiligte', 2);
		const g = await erstelleGeschaeft(handelnder, a.tag, {
			titel: 'Rampe',
			antragswortlaut: 'Die Rampe sei zu sanieren.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});
		const traktanden = (await holeGeschaefte(betreiberA, a.tag)).find((x) => x.id === g.id)!
			.traktanden;
		const bleibt = a.versammlungen[0].id;
		const raus = traktanden.find((t) => t.meetingId !== bleibt)!;
		await admin`UPDATE agenda_item SET from_template = true WHERE id = ${raus.traktandumId}`;

		await setzeBeteiligte(handelnder, a.tag, g.id, [bleibt]);

		const { zeilen } = await leseVerlauf(betreiberA, { versammlung: raus.meetingId });
		const entfernt = zeilen.find(
			(z) => z.art === 'agenda.item.removed' && z.gegenstandId === raus.traktandumId
		);
		expect(entfernt?.angaben?.titel).toBe('Rampe');
		expect(entfernt?.angaben?.ausVorlage).toBe(true);
	});
});

describe('Rechte der Anwendungsrolle', () => {
	it('darf die Struktur nicht ändern', async () => {
		await expect(app`CREATE TABLE zzz_test_tabelle (id int)`).rejects.toThrow();
	});

	it('darf die Migrationstabelle lesen, aber nicht beschreiben', async () => {
		// Lesen muss gehen, sonst wäre der Fehler unten auch bei fehlender Tabelle
		// derselbe und der Test bewiese nichts.
		await expect(app`SELECT name FROM schema_migration LIMIT 1`).resolves.toBeDefined();
		await expect(
			app`INSERT INTO schema_migration (name, checksum) VALUES ('999_falsch.sql', 'x')`
		).rejects.toThrow(/permission denied|keine Berechtigung/i);
	});
});
