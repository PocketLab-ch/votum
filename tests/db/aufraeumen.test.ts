/**
 * Das Aufräumskript läuft durch — an einem Bestand, wie ihn ein Prüflauf
 * hinterlässt.
 *
 * **Warum es diesen Test gibt.** `scripts/testdaten-entfernen.sql` ist Handarbeit
 * auf Ansage und läuft deshalb selten — und rostet zwischen zwei Aufrufen still
 * vor sich hin. Am 25.08.2026 brach es zweimal aus zwei verschiedenen Gründen:
 *
 *   * `quorum_finding` (Migration 080) und `bylaw_instruction_rule`
 *     (Migration 085) fehlten in der Löschordnung. Das schliesst
 *     `check-aufraeumen` seither ab.
 *   * Das Skript setzte `previous_meeting_id = NULL`, und seit dem
 *     Vertagungsumbau verlangt `meeting_vorgaenger`, dass eine zweite
 *     Versammlung einen Vorgänger HAT. Ebenso hielt die Migration 084
 *     `current_agenda_item_id` und `-_at` zusammen, während das Skript nur die
 *     eine Spalte leerte.
 *
 * Der zweite Grund lässt sich nicht aus Dateitext ablesen: Er hängt an
 * Schranken, die erst beim Ausführen greifen. Also wird ausgeführt.
 *
 * **Was aufgebaut wird, ist genau das, woran es gescheitert ist**: eine
 * Versammlung mit geschlossenem Durchgang, festgehaltener Beschlussfähigkeit,
 * einer Weisungsregel am Haus, einem aufgerufenen Traktandum — und einer
 * vertagten zweiten Versammlung.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstellePerson } from '$lib/server/personen';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	erstelleVersammlung,
	eroeffneVersammlung,
	stelleAufTraktandum,
	vertageVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { gibStimmenAb, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { halteBeschlussfaehigkeitFest } from '$lib/server/beschlussfaehigkeit';
import { speichereWeisungsregel } from '$lib/server/reglement';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;
let wegId: string;
let bleibtId: string;

/**
 * Ein Vertreter je Namensmuster des Skripts — bewusst mit einem anderen Wortlaut
 * als die Muster selbst, damit der Test die Regel prüft und nicht ihre Abschrift.
 */
const MUSTERNAMEN = [
	'E2E Musterhaus',
	'Irgendwas Prüflauf irgendwas',
	'Probe Musterhaus',
	'PP Musterhaus',
	'Sichtprobe 1787900000000',
	'Anzeigeprobe 20260827131500',
	'Durchstich Hülle 1787900000001',
	'Einladung Hülle 123456789'
];
const musterIds = new Map<string, string>();

/**
 * Eine Person, die **keine** der beiden älteren Personenregeln fasst.
 *
 * Der Name trägt weder Zeitstempel noch «Prüflauf», und das Konto dieses Tests
 * heisst nicht `pruefer` und nicht `pruefkonto…`. Genau so sehen die Personen
 * aus, die ein Mensch von Hand anlegt — am 27.08.2026 blieben 19 davon nach dem
 * Aufräumen verwaist stehen.
 *
 * **Ohne sie wäre die Zusicherung leer.** Der erste Anlauf zählte die Personen
 * des Betreibers und war immer grün: `erstelleEigentuemer` legt gar keine
 * Person an, es legt eine Partei an. Die Gegenprobe hat das aufgedeckt, nicht
 * der Testlauf.
 */
let handpersonId: string;

/**
 * Eine Person ohne Muster im Namen, angelegt von einem `prueflauf-…`-Konto.
 * So legt `e2e/einsprache.mjs` auf einem Stapel «Aebi» bis «Duss» an; vier
 * davon blieben einmal nach dem Aufräumen stehen.
 */
let laufpersonId: string;

function wer() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-gewoehnlich',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

async function gemeinschaftMitAllem(name: string) {
	const g = await erstelleGemeinschaft(wer(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(wer(), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(wer(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna Muster',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(wer(), e.id, p.id, '2020-01-01');

	// Die Weisungsregel am Haus — Migration 085.
	await speichereWeisungsregel(wer(), {
		stwegId: g.id,
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		kopfbasis: 'anwesend_vertreten',
		quotenSchwelle: null,
		quotenbasis: 'keine',
		fundstelle: 'Art. 7 Ziff. 3',
		enthaltungZaehltMit: true,
		ohneBeschluss: 'enthaltung'
	});

	const v = await erstelleVersammlung(wer(), {
		stwegId: g.id,
		datum: '2026-05-20',
		uhrzeit: '19:00',
		ort: 'Gemeindesaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const erledigt = await erstelleTraktandum(wer(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Jahresrechnung',
		art: 'abstimmung',
		antragswortlaut: 'Die Jahresrechnung wird genehmigt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	const offen = await erstelleTraktandum(wer(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	for (const t of [erledigt, offen]) {
		await haltErfordernisAmTraktandumFest(wer(), v.id, t.id, EINFACHES_MEHR);
	}
	await gibVersammlungFrei(wer(), v.id);
	await eroeffneVersammlung(wer(), v.id);
	const [stand] = await imKontext(betreiber, (tx) =>
		tx<{ id: string; party_id: string }[]>`
			SELECT id, party_id FROM snapshot_party WHERE meeting_id = ${v.id}
		`
	);
	await bestaetigeAnwesenheit(wer(), v.id, stand.id);

	// Ein geschlossener Durchgang mit Stimme.
	await oeffneAbstimmung(wer(), v.id, erledigt.id);
	await gibStimmenAb(wer(), v.id, [{ parteiId: stand.party_id, wahl: 'yes' }], true, 'Prüflauf ja');
	await schliesseAbstimmung(wer(), v.id);

	// Festgehaltene Beschlussfähigkeit (Migration 080) und ein aufgerufener Punkt
	// mit seinem Zeitpunkt (Migration 084).
	await halteBeschlussfaehigkeitFest(wer(), v.id, erledigt.id);
	await stelleAufTraktandum(wer(), v.id, offen.id);

	// Vertagt: Weil die Versammlung beschlussfähig war, entsteht seit C3 (F4c)
	// eine neue erste ohne Vorgängerin. Die zweite mit `previous_meeting_id`,
	// an der die Schranke `meeting_vorgaenger` hängt, entsteht deshalb von Hand
	// (DeepSeek-Review F4c Block 2, N-1).
	await vertageVersammlung(wer(), v.id, { grund: 'Nicht beschlussfähig — Fortsetzung nach ZGB 712p Abs. 2' });
	await erstelleVersammlung(wer(), {
		stwegId: g.id,
		datum: '2026-06-01',
		uhrzeit: '19:00',
		ort: 'Gemeindesaal',
		art: 'ordentlich',
		stufe: 'zweite',
		vorgaengerId: v.id,
		vorgaengerDatum: '2026-05-20',
		betriebsart: 'gefuehrt'
	});
	const [verbunden] = await imKontext(betreiber, (tx) =>
		tx<{ n: number }[]>`
			SELECT count(*)::int AS n FROM meeting WHERE stweg_id = ${g.id} AND previous_meeting_id IS NOT NULL
		`
	);
	expect(verbunden.n).toBe(1);
	return g.id;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Aufräumen');
	benutzer = await pruefbenutzer(betreiber, 'aufraeumen');
	// Der Name trägt «Prüflauf» — genau darauf greift das Skript zu.
	wegId = await gemeinschaftMitAllem('Aufräumprobe (Prüflauf)');
	// Und eine, die bleiben muss.
	bleibtId = await gemeinschaftMitAllem('Echter Bestand Musterweg 1');
	/*
	 * **Je eine Gemeinschaft für jedes Namensmuster.**
	 *
	 * Am 27.08.2026 kamen vier Muster dazu und waren von keinem Test gedeckt:
	 * Der Test traf allein `%Prüflauf%` und wäre auch dann grün geblieben, wenn
	 * sich jemand bei «Anzeigeprobe» vertippt hätte. Ein Muster, das nichts
	 * trifft, sieht im Skript genauso aus wie eines, das trifft.
	 *
	 * Diese hier tragen nichts an sich — geprüft wird die Namensregel, nicht das
	 * Abräumen der Anhängsel. Das steht im Test darüber.
	 */
	const hand = await erstellePerson(wer(), { art: 'natural', name: 'Regula Zaugg' });
	handpersonId = hand.id;
	const laufkonto = await pruefbenutzer(betreiber, 'prueflauf-aufraeumen');
	const lauf = await erstellePerson(
		{ operatorId: betreiber, userId: laufkonto, label: 'Prüflauf' },
		{ art: 'natural', name: 'Aebi' }
	);
	laufpersonId = lauf.id;
	for (const name of MUSTERNAMEN) {
		const g = await erstelleGemeinschaft(wer(), {
			name,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		musterIds.set(name, g.id);
	}
}, 60_000);

afterAll(verbindungenSchliessen);

/**
 * Fährt das Skript so, wie es auf dem Server ankommt.
 *
 * **Auf einer reservierten Verbindung**, weil das Skript BEGIN/COMMIT selbst
 * mitbringt. Der Treiber weist ein `BEGIN` auf einer Verbindung aus dem Vorrat
 * sonst ab: Über mehrere Verbindungen verteilt wäre eine Transaktion keine.
 *
 * `alle` setzt die Sitzungseinstellung des Alles-Modus. Sie wird danach wieder
 * zurückgenommen, sonst trüge die nächste Prüfung sie stillschweigend weiter.
 */
async function fahreSkript(sql: string, alle = false) {
	const verbindung = await admin.reserve();
	try {
		if (alle) await verbindung.unsafe("SET aufraeumen.alle = 'on'");
		await verbindung.unsafe(sql);
	} finally {
		/*
		 * **Beides muss auch nach einem Abbruch geschehen.** `release()` gibt die
		 * Verbindung in den Vorrat zurück, ohne sie zu säubern: Bliebe
		 * `aufraeumen.alle` auf `on` stehen, liefe eine spätere gewöhnliche
		 * Prüfung still im Alles-Modus und wäre trotzdem grün. Der Rollback muss
		 * vorangehen, weil in einer abgebrochenen Transaktion jeder weitere
		 * Befehl abgewiesen wird, `RESET` eingeschlossen.
		 */
		await verbindung.unsafe('ROLLBACK').catch(() => {});
		await verbindung.unsafe('RESET aufraeumen.alle').catch(() => {});
		verbindung.release();
	}
}

/**
 * Die Datei so, wie sie auf dem Server ankommt.
 *
 * Ausgeführt wird die Datei, nicht eine Abschrift davon: Eine Abschrift bewiese
 * nur, dass die Abschrift läuft.
 *
 * `\echo` ist ein psql-Befehl und kein SQL — er dient dem Menschen vor dem
 * Terminal. Hier läuft die Datei über den Treiber, also fällt er weg. Alles
 * andere bleibt Zeile für Zeile.
 *
 * **Und genau darin liegt eine Falle.** Der Filter streicht jede `\`-Zeile.
 * Stünde im Skript ein `\if`, nähme psql den einen Zweig und dieser Test
 * stillschweigend den anderen — er wäre grün über einem Skript, das anders
 * läuft. Deshalb die Zusicherung: Bedingte psql-Befehle sind hier verboten,
 * und wer sie doch braucht, muss diesen Test mit anfassen.
 */
function skripttext(): string {
	const roh = readFileSync('scripts/testdaten-entfernen.sql', 'utf8').split('\n');
	const bedingt = roh.filter((zeile) => /^\s*\\(if|elif|else|endif)\b/.test(zeile));
	expect(
		bedingt,
		'Bedingte psql-Befehle im Aufräumskript: Der Treiber streicht sie weg und dieser Test liefe an ihnen vorbei'
	).toEqual([]);
	return roh.filter((zeile) => !zeile.trimStart().startsWith('\\')).join('\n');
}

describe('Das Aufräumskript', () => {
	it('läuft durch und lässt echten Bestand stehen', async () => {
		await fahreSkript(skripttext());

		const [{ count: weg }] = await admin<{ count: string }[]>`
			SELECT count(*)::int AS count FROM stweg WHERE id = ${wegId}
		`;
		expect(Number(weg)).toBe(0);

		// **Jedes Muster trifft wirklich etwas.** Gemeldet wird, welches nicht —
		// «einer von acht ist liegengeblieben» wäre sonst nicht zu erkennen.
		const liegengeblieben: string[] = [];
		for (const [name, id] of musterIds) {
			const [{ count }] = await admin<{ count: string }[]>`
				SELECT count(*)::int AS count FROM stweg WHERE id = ${id}
			`;
			if (Number(count) > 0) liegengeblieben.push(name);
		}
		expect(liegengeblieben, 'Namensmuster ohne Wirkung').toEqual([]);

		// **Und die von Hand angelegte Person überlebt den gewöhnlichen Lauf.**
		// Sie ist die Vorbedingung des Tests darunter: Fiele sie schon hier,
		// bewiese dessen «ist weg» nichts über den Alles-Modus.
		const [{ count: hand }] = await admin<{ count: string }[]>`
			SELECT count(*)::int AS count FROM person WHERE id = ${handpersonId}
		`;
		expect(Number(hand), 'die von Hand angelegte Person').toBe(1);

		// Die Person des `prueflauf-…`-Kontos geht, obwohl ihr Name auf kein
		// Muster passt.
		const [{ count: lauf }] = await admin<{ count: string }[]>`
			SELECT count(*)::int AS count FROM person WHERE id = ${laufpersonId}
		`;
		expect(Number(lauf), 'die Person aus dem Prüflaufkonto').toBe(0);

		// **Beide Seiten zählen.** «Ist weg» allein bewiese auch ein Skript, das
		// alles löscht.
		const [{ count: bleibt }] = await admin<{ count: string }[]>`
			SELECT count(*)::int AS count FROM stweg WHERE id = ${bleibtId}
		`;
		expect(Number(bleibt)).toBe(1);

		// Und was an der entfernten Gemeinschaft hing, ist mitgegangen — nicht
		// bloss die Kopfzeile.
		for (const tabelle of ['unit', 'party', 'bylaw_instruction_rule']) {
			const [{ count }] = await admin.unsafe<{ count: string }[]>(
				`SELECT count(*)::int AS count FROM ${tabelle} WHERE stweg_id = $1`,
				[wegId]
			);
			expect(Number(count), `${tabelle} nicht abgeräumt`).toBe(0);
		}

		// Der Verlauf bleibt: nur anfügbar (AD-5).
		const [{ count: verlauf }] = await admin<{ count: string }[]>`
			SELECT count(*)::int AS count FROM audit_entry WHERE subject_id = ${wegId}
		`;
		expect(Number(verlauf)).toBeGreaterThan(0);
	}, 60_000);

	/*
	 * **Warum der Alles-Modus einen eigenen Test braucht.** Er ist der Weg, den
	 * man einmal im Quartal geht, und genau solche Wege rosten unbemerkt: Am
	 * 27.08.2026 stand er einen Nachmittag lang als psql-Variable im Skript und
	 * hätte über den Treiber nie funktioniert. Der Test oben blieb dabei grün,
	 * weil er den Modus nicht befuhr.
	 *
	 * Er läuft **nach** dem ersten Test und stützt sich auf dessen Ergebnis:
	 * `bleibtId` hat die Namensregel überlebt. Fällt sie jetzt, kann es nur am
	 * Modus liegen.
	 */
	it('nimmt im Alles-Modus auch den echten Bestand mit', async () => {
		const [{ count: vorher }] = await admin<{ count: string }[]>`
			SELECT count(*)::int AS count FROM stweg WHERE id = ${bleibtId}
		`;
		expect(Number(vorher), 'Voraussetzung: der echte Bestand steht noch').toBe(1);

		const sql = skripttext();
		await fahreSkript(sql, true);

		const [{ count: nachher }] = await admin<{ count: string }[]>`
			SELECT count(*)::int AS count FROM stweg WHERE id = ${bleibtId}
		`;
		expect(Number(nachher)).toBe(0);

		/*
		 * **Und keine verwaisten Personen.** Der Modus verspricht einen leeren
		 * Stand; eine Person ohne Partei steht trotzdem unter `/personen` und in
		 * jeder Eigentümerauswahl. Am 27.08.2026 blieben so 19 zurück, weil die
		 * Personenregeln nach Namen und Konto fragen und beides bei von Hand
		 * angelegten Personen nicht greift.
		 */
		const [{ count: verwaist }] = await admin<{ count: string }[]>`
			SELECT count(*)::int AS count FROM person WHERE id = ${handpersonId}
		`;
		expect(Number(verwaist), 'von Hand angelegte Person nach dem Alles-Modus').toBe(0);

		/*
		 * **Und die Einstellung wirkt nur, solange sie gesetzt ist.** Geprüft
		 * wird derselbe Ausdruck, den das Skript benutzt, auf einer Verbindung,
		 * die den Alles-Modus gesehen und wieder zurückgenommen hat.
		 *
		 * Genau dort steckt die Falle: Nach `RESET` liefert Postgres bei einer
		 * selbstvergebenen Einstellung den leeren String, nicht NULL. Ein
		 * `coalesce(…)::boolean` ohne `nullif` bricht daran ab — nicht beim
		 * Alles-Lauf, sondern beim nächsten gewöhnlichen in derselben Sitzung.
		 */
		const verbindung = await admin.reserve();
		try {
			await verbindung.unsafe("SET aufraeumen.alle = 'on'");
			await verbindung.unsafe('RESET aufraeumen.alle');
			const [{ alle }] = await verbindung.unsafe<{ alle: boolean }[]>(
				`SELECT coalesce(nullif(current_setting('aufraeumen.alle', true), ''), 'off')::boolean AS alle`
			);
			expect(alle).toBe(false);
		} finally {
			verbindung.release();
		}
	}, 60_000);
});
