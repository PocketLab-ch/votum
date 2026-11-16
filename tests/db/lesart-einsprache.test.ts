/**
 * Lesart L3 in der Datenhaltung (Migration 172): die Zählung an der Einsprache.
 *
 * Gemessen wird: Vorgabe und Schranke, der Verlauf, und dass die Wahl am
 * Traktandum ankommt, ohne dass eine Schreibstelle sie mitschickt — vor der
 * Freigabe aus der Gemeinschaft, ab der Freigabe aus der Momentaufnahme, und
 * die Freigabe zieht eine Umstellung dazwischen nach (Konzept, Kriterien 1 bis
 * 3). Dazu die zweite Dreizahl der Handzählung an der Einsprache (Kriterium 5).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import {
	bearbeiteTraktandum,
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden
} from '$lib/server/traktanden';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erfasseSummen, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { holeLesarten, holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import { veralteteErfordernisse } from '$lib/server/reglement';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

const EINSPRACHE: Erfordernis = {
	fassung: '2026-10-28',
	juristischGegengelesen: false,
	astId: 'a-sonderfaelle',
	knotenId: 'k-einsprache',
	typ: 'einfaches_mehr',
	titel: 'Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht',
	rechtsgrundlage: 'ZGB Art. 712c Abs. 2 und 3',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L3');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

async function gemeinschaft(name: string, tieBreak: 'keiner' | 'verwalter' = 'keiner') {
	return erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_unit',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak,
		tieBreakRuleSource: tieBreak === 'keiner' ? undefined : 'Art. 7 Ziff. 5'
	});
}

async function versammlung(
	name: string,
	datum: string,
	einheitenJePartei = [2, 1, 1],
	tieBreak: 'keiner' | 'verwalter' = 'keiner'
) {
	const g = await gemeinschaft(name, tieBreak);
	const parteien: string[] = [];
	const gesamt = einheitenJePartei.reduce((a, b) => a + b, 0);
	// Die Wertquoten gehen auf den Nenner 1000 auf, sonst sagt die Freigabe ab.
	const quote = 1000 / gesamt;
	for (const [nummer, anzahl] of einheitenJePartei.entries()) {
		const einheiten: string[] = [];
		for (let i = 0; i < anzahl; i++) {
			const e = await erstelleEinheit(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'unit',
				label: `Whg ${nummer + 1}.${i + 1}`,
				quotas: { stamm: quote },
				countsAsHead: true
			});
			einheiten.push(e.id);
		}
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Eigentümer ${nummer + 1}`,
			isCommunity: false,
			representativeName: null
		});
		for (const e of einheiten) await ordneEigentumZu(handelnder(betreiber), e, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Einsprache gegen die Vermietung',
		art: 'abstimmung',
		antragswortlaut: 'Die Versammlung erhebt Einsprache.',
		antragstellerart: 'bewirtschaftung',
		// Die Einsprache braucht eine betroffene Partei, sonst sagt die Freigabe ab.
		betroffeneParteiIds: [parteien[2]]
		},
	// Entscheid 0050, Antwort 3: Betroffene nimmt das Formular nur mit einem Mehr an,
	// das sie kennt, wie die Route mit dem Feld «erfordernis».
	'k-einsprache');
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

async function spalte(traktandumId: string) {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ l3: string | null }[]>`SELECT requirement_reading_l3 AS l3 FROM agenda_item WHERE id = ${traktandumId}`
	);
	return z.l3;
}

describe('Vorgabe, Schranke und Verlauf (Kriterien 1 und 2)', () => {
	it('eine neue Gemeinschaft rechnet an der Einsprache je Eigentümer', async () => {
		const g = await gemeinschaft('L3 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L3).toBe('je_eigentuemer');
	});

	it('die Datenbank weist eine unbekannte Wahl ab', async () => {
		const a = await versammlung('L3 falsch', '2027-12-01');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l3 = 'halb' WHERE id = ${a.gemeinschaft}`)
		).rejects.toThrow(/stweg_lesart_l3/);
	});

	it('hält die Umstellung mit Vorzustand und neuem Wert in Worten fest', async () => {
		const g = await gemeinschaft('L3 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L3: 'je_einheit' });
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id}
				   AND event_type = ${EREIGNISARTEN.lesartGesetzt} AND detail->>'lesart' = 'L3'
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L3',
			vorher: 'Eine Stimme je Eigentümer (Vorgabe)',
			nachher: 'Eine Stimme je Einheit',
			rolle: 'admin'
		});
	});
});

describe('Die Wahl kommt ans Traktandum und in den Durchgang (Kriterium 3)', () => {
	it('der Auslöser setzt sie aus der Gemeinschaft, nicht was man hineinschreibt', async () => {
		const a = await versammlung('L3 von Hand', '2027-12-06');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L3: 'je_einheit' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, {
			...EINSPRACHE,
			einspracheLesart: 'je_eigentuemer'
		});
		expect(await spalte(a.traktandum)).toBe('je_einheit');
	});

	it('die Freigabe friert sie ein und zieht eine Umstellung nach', async () => {
		const a = await versammlung('L3 Freigabe', '2027-12-03');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINSPRACHE);
		expect(await spalte(a.traktandum)).toBe('je_eigentuemer');

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L3: 'je_einheit' });
		// L3 ändert das Mehr nicht; die Freigabe sagt nicht ab, sie friert ein.
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect(await spalte(a.traktandum)).toBe('je_einheit');
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L3).toBe('je_einheit');

		// Nach der Freigabe umgestellt: Es gilt die eingefrorene Wahl.
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L3: 'je_eigentuemer' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINSPRACHE);
		expect(await spalte(a.traktandum)).toBe('je_einheit');
	});

	it('ein Traktandum ohne Mehr trägt keine Wahl', async () => {
		const a = await versammlung('L3 Kenntnisnahme', '2027-12-04');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINSPRACHE);
		await bearbeiteTraktandum(handelnder(betreiber), a.versammlung, a.traktandum, {
			meetingId: a.versammlung,
			parentId: null,
			titel: 'Bericht',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		expect(await spalte(a.traktandum)).toBeNull();
	});

	it('steht im eingefrorenen Erfordernis des Durchgangs', async () => {
		const a = await versammlung('L3 Durchgang', '2027-12-05');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L3: 'je_einheit' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINSPRACHE);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const [d] = await imKontext(betreiber, (tx) =>
			tx<{ e: Erfordernis }[]>`
				SELECT requirement_json AS e FROM voting_round WHERE agenda_item_id = ${a.traktandum}
			`
		);
		expect(d.e.einspracheLesart).toBe('je_einheit');
	});

	/*
	 * Kriterium 3 bis in Durchgang und Protokoll (Featureprüfung Lesarten,
	 * 22.10.2026): nach der Freigabe umgestellt, und doch zählt die Versammlung
	 * je Einheit, wie eingefroren, und das Protokoll nennt diese Zählweise.
	 */
	it('eine Umstellung nach der Freigabe ändert weder Durchgang noch Protokoll', async () => {
		const a = await versammlung('L3 nach Freigabe', '2027-12-08');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L3: 'je_einheit' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINSPRACHE);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L3: 'je_eigentuemer' });
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const [d] = await imKontext(betreiber, (tx) =>
			tx<{ e: Erfordernis }[]>`
				SELECT requirement_json AS e FROM voting_round WHERE agenda_item_id = ${a.traktandum}
			`
		);
		expect(d.e.einspracheLesart).toBe('je_einheit');

		// p1 mit zwei Einheiten und p2 Ja: 3 je Einheit, 2 je Eigentümer.
		await erfasseSummen(handelnder(betreiber), a.versammlung, {
			ja: 3,
			nein: 0,
			enthaltung: 0,
			andereJa: 2,
			andereNein: 0,
			andereEnthaltung: 0
		});
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain('Gezählt je Einheit nach dem Reglement, wie es für diese Versammlung eingestellt war.');
		expect(text).not.toContain('Gezählt nach dem Gesetz: eine Stimme je Eigentümer');
	});
});

describe('Die zweite Dreizahl der Handzählung (Kriterium 5)', () => {
	async function laufende(name: string, wahl?: 'je_einheit', erfordernis: Erfordernis = EINSPRACHE) {
		const a = await versammlung(name, '2027-12-07');
		if (wahl) await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L3: wahl });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, erfordernis);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		return a;
	}

	/*
	 * **Erst die Pflicht, dann die Obergrenze** (Codeprüfung Block 5, M1). Nach
	 * der Wahl «je Einheit» sind 3 Ja richtig (p1 mit 2 Einheiten, p2 mit 1); je
	 * Eigentümer stehen nur 2 zur Verfügung. Die Absage muss die zweite Zählung
	 * verlangen, nicht die erste als zu hoch abweisen.
	 */
	it('verlangt bei der Wahl je Einheit die zweite Zählung, statt die erste abzuweisen', async () => {
		const a = await laufende('L3 Pflicht je Einheit', 'je_einheit');
		await expect(
			erfasseSummen(handelnder(betreiber), a.versammlung, { ja: 3, nein: 0, enthaltung: 0 })
		).rejects.toMatchObject({ kennung: 'summe_ohne_andere_zaehlung' });
	});

	// Codeprüfung Block 5, N2: die zweite Dreizahl auch ohne zweites Ergebnis prüfen.
	it('weist eine zu hohe zweite Zählung schon beim Schreiben ab', async () => {
		const a = await laufende('L3 zweite zu hoch');
		await expect(
			erfasseSummen(handelnder(betreiber), a.versammlung, {
				ja: 2,
				nein: 0,
				enthaltung: 0,
				andereJa: 9,
				andereNein: 0,
				andereEnthaltung: 0
			})
		).rejects.toMatchObject({ kennung: 'summe_zu_hoch', feld: 'andereJa' });
	});

	// Codeprüfung Block 5, N3: ausserhalb von L3 keine zweite Zählung.
	it('nimmt keine zweite Zählung, wo L3 nicht wirkt', async () => {
		const a = await laufende('L3 ältere Fassung', undefined, { ...EINSPRACHE, fassung: '2026-10-27' });
		await expect(
			erfasseSummen(handelnder(betreiber), a.versammlung, {
				ja: 2,
				nein: 0,
				enthaltung: 0,
				andereJa: 2,
				andereNein: 0,
				andereEnthaltung: 0
			})
		).rejects.toMatchObject({ kennung: 'summe_andere_unzulaessig' });
	});

	it('weist die fehlende zweite Zählung ab, wo eine Partei je Einheit nicht genau eine Stimme hat', async () => {
		const a = await laufende('L3 Pflicht');
		// p3 ist betroffen; stimmberechtigt sind p1 (2 Einheiten) und p2 (1).
		await expect(
			erfasseSummen(handelnder(betreiber), a.versammlung, { ja: 2, nein: 0, enthaltung: 0 })
		).rejects.toMatchObject({ kennung: 'summe_ohne_andere_zaehlung' });
	});

	it('nimmt beide Dreizahlen und schreibt sie an den Durchgang', async () => {
		const a = await laufende('L3 beide');
		await erfasseSummen(handelnder(betreiber), a.versammlung, {
			ja: 2,
			nein: 0,
			enthaltung: 0,
			andereJa: 3,
			andereNein: 0,
			andereEnthaltung: 0
		});
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ id: string; andere: number | null }[]>`
				SELECT id, tally_other_yes AS andere FROM voting_round WHERE agenda_item_id = ${a.traktandum}
			`
		);
		expect(z.andere).toBe(3);
		// Auch der Verlauf hält die zweite Zählung fest (Abnahme Block 5).
		const [eintrag] = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'voting_round' AND subject_id = ${z.id}
				   AND event_type = ${EREIGNISARTEN.handzaehlungErfasst}
			`
		);
		expect(eintrag.detail).toMatchObject({ ja: 2, andereJa: 3, andereNein: 0, andereEnthaltung: 0 });
	});

	it('weist eine teilweise zweite Zählung ab', async () => {
		const a = await laufende('L3 teilweise');
		await expect(
			erfasseSummen(handelnder(betreiber), a.versammlung, {
				ja: 2,
				nein: 0,
				enthaltung: 0,
				andereJa: 2
			})
		).rejects.toMatchObject({ kennung: 'summe_andere_unvollstaendig' });
	});

	/*
	 * **Die eigene Prüfung der zweiten Dreizahl** (Codeprüfung Block 5, N2):
	 * Bei offenem Stichentscheid rechnet `zaehleSummenAus` das zweite Ergebnis
	 * nicht (`zweitesErgebnis` bricht ab). Ohne `pruefeAndereDreizahl` in
	 * `erfasseSummen` ginge eine zu hohe zweite Zahl ungeprüft in die Datenbank.
	 */
	it('weist eine zu hohe zweite Zählung auch bei offenem Stichentscheid ab', async () => {
		const a = await versammlung('L3 Stichentscheid', '2027-12-10', [2, 1, 1, 1], 'verwalter');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L3: 'je_einheit' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINSPRACHE);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(await spalte(a.traktandum)).toBe('je_einheit');
		// Je Einheit 2 zu 2: Gleichstand, der Verwalter hat noch nicht entschieden.
		await expect(
			erfasseSummen(handelnder(betreiber), a.versammlung, {
				ja: 2,
				nein: 2,
				enthaltung: 0,
				andereJa: 9,
				andereNein: 0,
				andereEnthaltung: 0
			})
		).rejects.toMatchObject({ kennung: 'summe_zu_hoch', feld: 'andereJa' });
	});
});

describe('Ältere Fassungen erscheinen nicht als veraltet (Kriterium 9)', () => {
	it('ein Traktandum der Fassung 2026-10-27 bleibt, wie es war', async () => {
		const a = await versammlung('L3 alt', '2027-12-08');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, {
			...EINSPRACHE,
			fassung: '2026-10-27'
		});
		// L3 ändert das Mehr nicht; die Einsprache von 2026-10-27 ist nicht veraltet.
		const veraltet = await veralteteErfordernisse(betreiber, a.gemeinschaft);
		expect(veraltet.filter((v) => v.traktandumId === a.traktandum)).toHaveLength(0);
		// Und das Traktandum trägt weiter die Vorgabe, nach der es je Einheit zählt.
		expect((await holeTraktanden(betreiber, a.versammlung)).find((x) => x.knoten.id === a.traktandum)?.knoten.erfordernis?.fassung).toBe('2026-10-27');
	});

	it('die Freigabe sagt an einer Einsprache von 2026-10-27 nach der Umstellung nicht ab', async () => {
		const a = await versammlung('L3 alt Freigabe', '2027-12-09');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, {
			...EINSPRACHE,
			fassung: '2026-10-27'
		});
		// L3 umstellen: Sie ändert die Zählung, nicht das Mehr, also keine veraltete
		// Lesart (`veralteteLesartenIn`), und die Freigabe friert ein, statt abzusagen.
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L3: 'je_einheit' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L3).toBe('je_einheit');
	});
});

/*
 * **Vor der Freigabe die Wahl der Gemeinschaft** (Codeprüfung Block 5, H2):
 * `holeLesarten` mit einer Versammlung ohne Momentaufnahme las L3 nicht, und
 * Erfordernis- und Traktandenseite zeigten die Vorgabe statt der Wahl.
 */
describe('Lesarten der Versammlung vor der Freigabe', () => {
	it('liefern L3 aus der Gemeinschaft', async () => {
		const a = await versammlung('L3 vor Freigabe', '2027-12-09');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L3: 'je_einheit' });
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L3).toBe('je_einheit');
	});
});
