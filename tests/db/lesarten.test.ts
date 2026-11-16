/**
 * Lesarten der Gemeinschaft in der Datenhaltung (Migration 169).
 *
 * Gemessen wird: die Vorgaben, der Schreibweg mit Verlauf und Rolle, die
 * Rechte der Sitzungsleitung, das Einfrieren bei der Freigabe (Konzept,
 * Akzeptanzkriterien 1 bis 3 und 17) und dass die Lesart am Erfordernis den
 * Weg bis in den Durchgang übersteht.
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
	holeTraktanden,
	setzeGewaehltesErfordernis
} from '$lib/server/traktanden';
import { erfordernisseNachziehen, veralteteErfordernisse } from '$lib/server/reglement';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	gibStimmenAb,
	holeErgebnis,
	holeMomentaufnahmeIn,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { speichereAusnahmen } from '$lib/server/ausnahmen';
import {
	holeLesarten,
	holeLesarteneinstellung,
	speichereLesarten,
	speichereLesartenrecht
} from '$lib/server/lesarten';
import { alsBetreiber } from '$lib/server/db';
import { lesartVon, wendeLesartAn } from '$lib/domain/lesarten';
import { FachlicherFehler } from '$lib/domain/fehler';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/**
 * Ein Erfordernis mit L4 «einfach», wie es die Fassung 2026-10-24 herleitet,
 * hier von Hand gebaut, damit die Proben der Datenhaltung nicht an
 * einer Fassung hängen. Die echte Herleitung misst «Mit dem Knoten der Fassung
 * 2026-10-24» unten.
 */
const L4_EINFACH: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-organe',
	knotenId: 'k-bewirtschaftung-waehlen',
	typ: 'einfaches_mehr',
	titel: 'Bewirtschaftung wählen',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet',
	gemeinschaftslesart: {
		kennung: 'L4',
		wahl: 'einfach',
		// Bis Block B die Vorgabe; seit der Fassung 2026-11-13 ist es
		// «qualifiziert» (Entscheid 0048).
		vorgabe: false,
		andere: {
			wahl: 'qualifiziert',
			typ: 'qualifiziertes_mehr',
			rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		}
	}
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesarten');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

async function gemeinschaft(name: string) {
	return erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
}

/**
 * Eine Versammlung im Entwurf mit Eigentümern (Vorgabe zwei) und einem
 * L4-Traktandum. Die Gemeinschaft steht auf «einfach», passend zum Traktandum:
 * Bis Block B war das die Vorgabe, seit der Fassung 2026-11-13 stellt sie es
 * ein (Entscheid 0048).
 */
async function versammlung(name: string, datum: string, quoten = [600, 400]) {
	const g = await gemeinschaft(name);
	await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L4: 'einfach' });
	const parteien: string[] = [];
	for (const [nummer, quote] of quoten.entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${nummer + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: ['Erika Beispiel', 'Hans Probe', 'Grosse Wohnung AG'][nummer] ?? `Partei ${nummer + 1}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
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
		titel: 'Wahl der Bewirtschaftung',
		art: 'abstimmung',
		antragswortlaut: 'Die Probe AG wird als Bewirtschaftung gewählt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, L4_EINFACH);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

async function verlaufVon(stwegId: string, art: string) {
	return imKontext(betreiber, (tx) =>
		tx<{ actor_label: string; detail: Record<string, unknown> }[]>`
			SELECT actor_label, detail FROM audit_entry
			 WHERE subject_type = 'stweg' AND subject_id = ${stwegId} AND event_type = ${art}
			 ORDER BY id
		`
	);
}

describe('Vorgaben (Kriterium 1)', () => {
	it('eine neue Gemeinschaft rechnet nach den Vorgaben, nur die Verwaltung stellt um', async () => {
		const g = await gemeinschaft('Lesarten neu');
		const e = await holeLesarteneinstellung(betreiber, g.id);
		expect(e.wahl).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		expect(e.recht).toBe('verwaltung');
		expect(e.geaendert).toEqual({});
		expect(e.rechtGeaendert).toBeNull();
	});

	it('die Datenbank weist eine unbekannte Wahl selbst ab', async () => {
		const g = await gemeinschaft('Lesarten falsch');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l4 = 'zwei_drittel' WHERE id = ${g.id}`)
		).rejects.toThrow(/stweg_lesart_l4/);
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_changer = 'alle' WHERE id = ${g.id}`)
		).rejects.toThrow(/stweg_lesarten_wer/);
	});
});

describe('Umstellen mit Verlauf (Kriterium 2)', () => {
	it('hält Person, Rolle, Vorzustand und neuen Wert in Worten fest', async () => {
		const g = await gemeinschaft('Lesarten Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		expect(await holeLesarten(betreiber, { stwegId: g.id })).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });

		const eintraege = await verlaufVon(g.id, EREIGNISARTEN.lesartGesetzt);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].actor_label).toBe('Prüflauf');
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L4',
			vorher: 'Qualifiziertes Mehr (Vorgabe)',
			nachher: 'Einfaches Mehr',
			rolle: 'admin'
		});
		expect(String(eintraege[0].detail.frage)).toMatch(/Bewirtschaftung/);

		const e = await holeLesarteneinstellung(betreiber, g.id);
		expect(e.geaendert.L4).toMatchObject({ durch: 'Prüflauf', rolle: 'admin' });
	});

	it('schreibt nichts, wenn sich nichts ändert', async () => {
		const g = await gemeinschaft('Lesarten unverändert');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, {});
		expect(await verlaufVon(g.id, EREIGNISARTEN.lesartGesetzt)).toHaveLength(0);
	});

	it('weist eine unbekannte Wahl fachlich ab', async () => {
		const g = await gemeinschaft('Lesarten unbekannt');
		await expect(
			speichereLesarten(handelnder(betreiber), 'admin', g.id, { L1: 'bleibt', L2: 'einfach', L4: 'zwei_drittel' })
		).rejects.toThrow(FachlicherFehler);
	});
});

describe('Rechte (Kriterium 17)', () => {
	it('ohne Umstellung erhält die Sitzungsleitung eine Absage', async () => {
		const g = await gemeinschaft('Lesarten Leitung gesperrt');
		await expect(
			speichereLesarten(handelnder(betreiber), 'chair', g.id, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' })
		).rejects.toThrow(/nur die Verwaltung/);
		expect(await holeLesarten(betreiber, { stwegId: g.id })).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
	});

	it('mit «Verwaltung und Sitzungsleitung» stellt sie um, aber nicht das Recht selbst', async () => {
		const g = await gemeinschaft('Lesarten Leitung erlaubt');
		await speichereLesartenrecht(handelnder(betreiber), 'admin', g.id, 'verwaltung_und_leitung');
		await speichereLesarten(handelnder(betreiber), 'chair', g.id, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		expect(await holeLesarten(betreiber, { stwegId: g.id })).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });

		const [eintrag] = await verlaufVon(g.id, EREIGNISARTEN.lesartGesetzt);
		expect(eintrag.detail.rolle).toBe('chair');

		await expect(
			speichereLesartenrecht(handelnder(betreiber), 'chair', g.id, 'verwaltung')
		).rejects.toThrow(/nur die Verwaltung/);
		const [recht] = await verlaufVon(g.id, EREIGNISARTEN.lesartenrechtGesetzt);
		expect(recht.detail).toMatchObject({
			vorher: 'Nur die Verwaltung',
			nachher: 'Verwaltung und Sitzungsleitung',
			rolle: 'admin'
		});
	});
});

describe('Einfrieren bei der Freigabe (Kriterium 3)', () => {
	it('friert die Wahl ein; eine spätere Umstellung ändert die Versammlung nicht', async () => {
		const a = await versammlung('Lesarten eingefroren', '2027-11-03');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });

		expect(await holeLesarten(betreiber, { meetingId: a.versammlung })).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });

		const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter(
			(x) => x.knoten.id === a.traktandum
		);
		expect(t.knoten.erfordernis?.gemeinschaftslesart?.wahl).toBe('einfach');
		expect(t.knoten.erfordernis?.typ).toBe('einfaches_mehr');
	});

	it('friert auch die andere Wahl ein, nicht nur die Vorgabe', async () => {
		const a = await versammlung('Lesarten qualifiziert eingefroren', '2027-11-07');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			wendeLesartAn(L4_EINFACH, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' })
		);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });

		expect(await holeLesarten(betreiber, { meetingId: a.versammlung })).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		expect(await holeLesarten(betreiber, { stwegId: a.gemeinschaft })).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
	});

	it('beide Leser der Momentaufnahme liefern denselben Kopf, samt Ausnahmen', async () => {
		const a = await versammlung('Lesarten zwei Leser', '2027-11-04');
		await speichereAusnahmen(handelnder(betreiber), a.gemeinschaft, { universalvariante: 'vertreten' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);

		const aussen = await holeMomentaufnahme(betreiber, a.versammlung);
		const innen = await alsBetreiber(betreiber, (tx) => holeMomentaufnahmeIn(tx, a.versammlung));
		const kopf = (s: typeof aussen) => s && { ...s, parties: undefined };
		expect(kopf(innen)).toEqual(kopf(aussen));
		expect(innen?.ausnahmen?.universalvariante).toBe('vertreten');
		expect(innen?.lesarten).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
	});

	/*
	 * Das Nachziehen nach einer Umstellung braucht den Knoten mit der Lesart im
	 * Regelwerk; es wird mit der Fassung 2026-10-24 gemessen.
	 */
	it('sagt ab, solange ein Traktandum nach einer anderen Wahl rechnet', async () => {
		const a = await versammlung('Lesarten veraltet', '2027-11-05');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });

		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/das Mehr auf der Seite «Lesarten» der Gemeinschaft/
		);

		// Dieselbe Versammlung gibt frei, sobald die Wahl wieder zum Traktandum passt.
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect(await holeLesarten(betreiber, { meetingId: a.versammlung })).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'einfach', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
	});
});

describe('Befunde der Codeprüfung, Teil 1', () => {
	it('ein Traktandum, das zur Kenntnisnahme wird, verliert die Lesart und sperrt die Freigabe nicht', async () => {
		const a = await versammlung('Lesarten Kenntnisnahme', '2027-11-08');
		await bearbeiteTraktandum(handelnder(betreiber), a.versammlung, a.traktandum, {
			meetingId: a.versammlung,
			parentId: null,
			titel: 'Bericht der Bewirtschaftung',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ r: unknown }[]>`SELECT requirement_reading AS r FROM agenda_item WHERE id = ${a.traktandum}`
		);
		expect(z.r).toBeNull();
		// Und stünde sie doch noch da, etwa aus einem älteren Stand: Die Freigabe
		// fragt nur nach Traktanden, die der Kasten «nachziehen» auch zeigt.
		await imKontext(betreiber, (tx) => tx`
			UPDATE agenda_item SET requirement_reading = ${tx.json(L4_EINFACH.gemeinschaftslesart as never)}
			 WHERE id = ${a.traktandum}
		`);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('die Datenbank weist eine unvollständige Lesart am Traktandum ab', async () => {
		const a = await versammlung('Lesarten Form', '2027-11-09');
		// Als JSON übergeben, nicht als Zeichenkette mit `::jsonb`: postgres.js
		// schickte sie sonst als JSON-Zeichenkette, und jeder Fall scheiterte schon
		// am ersten Glied (bei der Gegenprobe gemerkt).
		const falsche: unknown[] = [
			{},
			[],
			{ kennung: 'L4', wahl: 'einfach' },
			{ wahl: 'einfach', vorgabe: true, andere: {} },
			{ kennung: 'L4', vorgabe: true, andere: {} },
			{ kennung: 'L4', wahl: 'einfach', vorgabe: true }
		];
		for (const falsch of falsche) {
			await expect(
				imKontext(betreiber, (tx) => tx`
					UPDATE agenda_item SET requirement_reading = ${tx.json(falsch as never)} WHERE id = ${a.traktandum}
				`),
				JSON.stringify(falsch)
			).rejects.toThrow(/agenda_item_lesart_form/);
		}
	});

	it('ein Durchgang ohne Lesart trägt keinen Schlüssel dafür', async () => {
		const a = await versammlung('Lesarten ohne', '2027-11-10');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, {
			...L4_EINFACH,
			knotenId: 'k-bewirtschaftung-abberufen',
			gemeinschaftslesart: undefined
		});
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const [d] = await imKontext(betreiber, (tx) =>
			tx<{ e: Record<string, unknown> }[]>`
				SELECT requirement_json AS e FROM voting_round WHERE agenda_item_id = ${a.traktandum}
			`
		);
		expect('gemeinschaftslesart' in d.e).toBe(false);
	});
});

describe('Die Lesart übersteht den Weg bis zum Durchgang', () => {
	it('steht im eingefrorenen Erfordernis des Durchgangs', async () => {
		const a = await versammlung('Lesarten Durchgang', '2027-11-06');
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
		expect(d.e.gemeinschaftslesart).toEqual(L4_EINFACH.gemeinschaftslesart);
	});
});

/*
 * `setzeGewaehltesErfordernis` leitet unter der aktuellen Fassung her. Seit
 * Block B (Fassung 2026-11-13, Entscheid 0048) rechnet der Knoten dort nach der
 * Vorgabe «qualifiziert»; die Gemeinschaft dieser Proben steht auf «einfach»
 * (`versammlung`), und die Herleitung tauscht deshalb auf das einfache Mehr.
 */
describe('Mit dem Knoten der Fassung 2026-10-24', () => {
	it('zieht nach einer Umstellung nach, und der Kasten nennt die Lesart', async () => {
		const a = await versammlung('Lesarten nachziehen', '2027-11-11');
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-waehlen-erweitert',
			null
		);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });

		const [v] = (await veralteteErfordernisse(betreiber, a.gemeinschaft)).filter(
			(x) => x.traktandumId === a.traktandum
		);
		expect(v.bisher).toMatch(/Lesart: Einfaches Mehr$/);
		expect(v.neu).toMatch(/Lesart: Qualifiziertes Mehr \(Vorgabe\)$/);

		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter(
			(x) => x.knoten.id === a.traktandum
		);
		expect(t.knoten.erfordernis?.typ).toBe('qualifiziertes_mehr');
		expect(t.knoten.erfordernis?.gemeinschaftslesart).toMatchObject({ wahl: 'qualifiziert', vorgabe: true });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	/*
	 * Kriterium 3 am Kasten «nachziehen» (Featureprüfung Lesarten, 22.10.2026):
	 * `veralteteErfordernisseIn` liest auch freigegebene Versammlungen. Eine
	 * Umstellung nach der Freigabe darf dort nichts melden und nichts nachziehen,
	 * sonst schriebe «nachziehen» das Mehr einer eingeladenen Versammlung um.
	 */
	it('eine Umstellung nach der Freigabe meldet und zieht nichts an der freigegebenen Versammlung', async () => {
		const a = await versammlung('Lesarten nach Freigabe', '2027-11-13');
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-waehlen-erweitert',
			null
		);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });

		expect(
			(await veralteteErfordernisse(betreiber, a.gemeinschaft)).filter((x) => x.traktandumId === a.traktandum)
		).toEqual([]);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter(
			(x) => x.knoten.id === a.traktandum
		);
		expect(t.knoten.erfordernis?.typ).toBe('einfaches_mehr');
		expect(t.knoten.erfordernis?.gemeinschaftslesart).toMatchObject({ wahl: 'einfach', vorgabe: false });
	});

	it('rechnet im Saal nach der eingefrorenen Lesart und nennt das abweichende Ergebnis im Protokoll', async () => {
		// Zwei kleine Wohnungen Ja, die grosse Nein: einfaches Mehr erreicht,
		// qualifiziertes nicht (Kriterien 5, 6, 10).
		const a = await versammlung('Lesarten im Saal', '2027-11-12', [200, 200, 600]);
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-waehlen-erweitert',
			null
		);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		// Nach der Freigabe umgestellt: wirkt erst für die nächste Versammlung (Kriterium 3).
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' },
				{ parteiId: a.parteien[2], wahl: 'no' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.andereLesart).toMatchObject({ wahl: 'Qualifiziertes Mehr', angenommen: false, abweichend: true });

		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			// A5, Punkt 1b: der Grund der Vorgabe statt der Software. Seit Block B ist
			// «einfach» die eingestellte Wahl, nicht mehr die Vorgabe.
			'Gezählt nach dem einfachen Mehr. Ob die Wahl einer Bewirtschaftung mit erweiterten Kompetenzen das qualifizierte Mehr braucht, ist umstritten. So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet. ' +
				`Die Standardeinstellung wäre das qualifizierte Mehr: ${lesartVon('L4')!.vorgabeGrund}`
		);
		expect(text).toMatch(/Nach der anderen Lesart \(«Qualifiziertes Mehr»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen/);
	});
});

