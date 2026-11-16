/**
 * Das Mehr aus der Einladung als Untergrenze, gegen die Datenbank
 * (Migration 144, `server/einladungsmehr.ts`; Produktentscheide 27.09.2026 und
 * 06.10.2026).
 *
 * Was der Kern nicht prüfen kann und hier gemessen wird:
 *
 * - dass die Freigabe das gedruckte Mehr festhält und die Rücknahme es verwirft;
 * - dass im Saal beide Schreibwege ein milderes Mehr abweisen, der über die
 *   Route (`haltErfordernisAmTraktandumFest`) und der gemeinsame
 *   (`schreibeErfordernisIn`, über den gemeinsames Geschäft und Nachziehen
 *   laufen);
 * - dass vor Beginn die Untergrenze mitwandert, der Versandvermerk zurückfällt
 *   und der Hinweis bis zum neuen Vermerk steht;
 * - dass beim Eröffnen nichts zurückfällt, der Verlauf die Milderung festhält
 *   und die Leitung daraus ihre Warnung liest (Produktentscheid 07.10.2026,
 *   «Nur noch aufmerksam machen»);
 * - dass die Einstellung der Gemeinschaft entscheidet, ob ein milderes Mehr
 *   nach Ablauf der Frist abgewiesen wird (Migration 148);
 * - dass die Sperre in der Datenbank die Untergrenze ab der Eröffnung hält;
 * - dass ein Folgeantrag die Untergrenze seines angekündigten Traktandums hält,
 *   an beiden Schreibwegen, beim Öffnen, beim Beschluss von Hand und bei der
 *   Aufnahme im Saal (Produktentscheid 06.10.2026, «Ja, dieselbe Untergrenze»);
 * - dass am gemeinsamen Abend die Absage die Gemeinschaft nennt, die abweist,
 *   und in keiner Gemeinschaft etwas gesetzt ist.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, nimmVersammlungsfreigabeZurueck } from '$lib/server/freigabe';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	nimmTraktandumAuf,
	verschiebeTraktandum
} from '$lib/server/traktanden';
import { nimmImSaalAuf } from '$lib/server/saalaufnahme';
import { schreibeErfordernisIn } from '$lib/server/erfordernisse';
import {
	holeEinladungsmehrInWorten,
	holeEinladungsmehrJeTraktandum,
	holeNeuversandHinweis,
	holeNeuversandLage,
	holeSaalhinweiseNachMilderung,
	speichereMilderungNachFrist
} from '$lib/server/einladungsmehr';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import {
	holeVersandvermerk,
	legeMarkeAb,
	neueMarke,
	schauMarkeAn,
	vermerkeVersand
} from '$lib/server/versandvermerk';
import { erfordernisseNachziehen, speichereEinberufungsfrist, veralteteErfordernisse } from '$lib/server/reglement';
import { alsBetreiber } from '$lib/server/db';
import { holeVorbereitung } from '$lib/server/uebersicht';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { haltBeschlussVonHandFest, oeffneAbstimmung } from '$lib/server/abstimmung';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import {
	erstelleGeschaeft,
	holeGemeinsameListe,
	setzeErfordernisAmGeschaeft,
	verschiebeInGeschaeft
} from '$lib/server/geschaeft';
import { tageSpaeter } from '$lib/domain/versammlung';
import { EREIGNISARTEN, angabenInWorten } from '$lib/domain/verlauf';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Universalvariante } from '$lib/domain/ausnahmen';
import { speichereAusnahmen } from '$lib/server/ausnahmen';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

const HEUTE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

const EINFACH: Erfordernis = {
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

/** Das gedruckte Mehr der Proben: zwei Drittel der Anwesenden. */
const ZWEIDRITTEL: Erfordernis = {
	...EINFACH,
	kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' }
};

const DREIVIERTEL: Erfordernis = {
	...EINFACH,
	kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' }
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Einladungsmehr');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

/**
 * Eine freigegebene Versammlung mit einem Abstimmungstraktandum (zwei Drittel),
 * einem ohne Erfordernis und einer Kenntnisnahme.
 */
async function freigegeben(
	name: string,
	datum: string,
	frist?: number,
	zweites = false,
	/** `mehr`: das gedruckte Mehr; `tag`: der gemeinsame Abend, in den das Haus kommt. */
	optionen: {
		mehr?: Erfordernis;
		tag?: string;
		universalvariante?: Universalvariante;
		leitungsvollmachtenZaehlen?: boolean;
	} = {}
) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	if (frist) await speichereEinberufungsfrist(handelnder(betreiber), g.id, frist, 'Reglement Ziff. 12');
	if (optionen.universalvariante) {
		await speichereAusnahmen(handelnder(betreiber), g.id, {
			universalvariante: optionen.universalvariante,
			...(optionen.leitungsvollmachtenZaehlen !== undefined
				? { leitungsvollmachtenZaehlen: optionen.leitungsvollmachtenZaehlen }
				: {})
		});
	}
	const parteien: string[] = [];
	for (const [nummer, quote] of [600, 400].entries()) {
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
			displayName: nummer === 0 ? 'Anna Muster' : 'Peter Kunz',
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
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird gemäss Offerte saniert.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	const ohne = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Ersatz der Briefkästen',
		art: 'abstimmung',
		antragswortlaut: 'Die Briefkästen werden ersetzt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	const kenntnis = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Jahresbericht',
		art: 'kenntnisnahme',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, optionen.mehr ?? ZWEIDRITTEL);
	if (optionen.tag) await nimmInTagAuf(handelnder(betreiber), optionen.tag, v.id, 0);
	if (zweites) await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, ohne.id, ZWEIDRITTEL);
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	return { versammlung: v.id, traktandum: t.id, ohne: ohne.id, kenntnis: kenntnis.id, parteien, gemeinschaft: g.id };
}

async function gemeinschaftVon(versammlung: string): Promise<string> {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ stweg_id: string }[]>`SELECT stweg_id FROM meeting WHERE id = ${versammlung}`
	);
	return z.stweg_id;
}

/**
 * Setzt das Mehr eines Traktandums an der Schreibstelle vorbei auf die Hälfte,
 * wie ein Altbestand. Bis 07.10.2026 entstand ein Grundantrag mit milderem
 * Mehr als die Einladung durch den Rückfall beim Eröffnen; seit dem
 * Produktentscheid 07.10.2026 («Nur noch aufmerksam machen») nur noch so.
 */
async function mehrVorbeiAufHaelfte(id: string) {
	await imKontext(betreiber, (tx) =>
		tx`
			UPDATE agenda_item
			   SET requirement_head_numerator = 1, requirement_head_denominator = 2,
			       requirement_head_mode = 'mehr_als'
			 WHERE id = ${id}
		`
	);
}

async function untergrenze(id: string) {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ released_requirement: Erfordernis | null; released_requirement_relaxed_at: Date | null; requirement_head_numerator: number | null }[]>`
			SELECT released_requirement, released_requirement_relaxed_at, requirement_head_numerator
			  FROM agenda_item WHERE id = ${id}
		`
	);
	return z;
}

describe('Festhalten bei der Freigabe', () => {
	it('hält das gedruckte Mehr fest, nur wo die Einladung eines nennt', async () => {
		const a = await freigegeben('Einladungsweg 1', '2027-10-01');
		expect((await untergrenze(a.traktandum)).released_requirement?.kopfSchwelle).toEqual(
			ZWEIDRITTEL.kopfSchwelle
		);
		expect((await untergrenze(a.ohne)).released_requirement).toBeNull();
		expect((await untergrenze(a.kenntnis)).released_requirement).toBeNull();
	});

	it('die Rücknahme verwirft die Untergrenze und nimmt den Versandvermerk zurück', async () => {
		/*
		 * Produktentscheid 06.10.2026 («Nein, Neuversand verlangen»): Die neue
		 * Freigabe ist eine neue Einladung. Votum vergleicht nicht mit der
		 * früheren; die Untergrenze ist das Mehr der neuen.
		 */
		const a = await freigegeben('Einladungsweg 2', '2027-10-02');
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), a.versammlung, 'Prüflauf');
		expect((await untergrenze(a.traktandum)).released_requirement).toBeNull();
		expect((await holeVersandvermerk(betreiber, a.versammlung)).gesetzt).toBe(false);

		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		const z = await untergrenze(a.traktandum);
		expect(z.released_requirement?.kopfSchwelle).toEqual(EINFACH.kopfSchwelle);
		expect(z.released_requirement_relaxed_at).toBeNull();
	});
});

describe('Rücknahme und Erinnerungsmarke', () => {
	it('die Rücknahme verbraucht die Marke einer Erinnerung, auch ohne Vermerk (Codeprüfung M1)', async () => {
		/*
		 * Codeprüfung M1, 06.10.2026: Die Marke fiel nur zusammen mit einem
		 * gesetzten Vermerk. Ohne ihn überlebte sie die Rücknahme, und nach der
		 * neuen Freigabe hätte der alte Link den Versand der neuen Einladung
		 * vermerkt.
		 */
		const a = await freigegeben('Einladungsweg 46', '2027-10-08');
		const klartext = neueMarke();
		expect(await legeMarkeAb(betreiber, a.versammlung, klartext)).toBe(true);
		expect(await schauMarkeAn(klartext)).not.toBeNull();
		expect((await holeVersandvermerk(betreiber, a.versammlung)).gesetzt).toBe(false);

		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), a.versammlung, 'Prüflauf');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);

		expect(await schauMarkeAn(klartext)).toBeNull();
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ h: string | null }[]>`
				SELECT invitation_reminder_token_hash AS h FROM meeting WHERE id = ${a.versammlung}
			`
		);
		expect(z.h).toBeNull();
	});
});

describe('Im Saal', () => {
	async function eroeffnet(name: string, datum: string) {
		const a = await freigegeben(name, datum);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		return a;
	}

	it('weist ein milderes Mehr ab und lässt das gesetzte stehen', async () => {
		const a = await eroeffnet('Einladungsweg 3', '2027-10-03');
		await expect(
			haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH)
		).rejects.toMatchObject({ kennung: 'milder_als_einladung' });
		expect((await untergrenze(a.traktandum)).requirement_head_numerator).toBe(2);
	});

	it('lässt ein strengeres zu und danach wieder das der Einladung', async () => {
		const a = await eroeffnet('Einladungsweg 4', '2027-10-04');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, DREIVIERTEL);
		expect((await untergrenze(a.traktandum)).requirement_head_numerator).toBe(3);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, ZWEIDRITTEL);
		expect((await untergrenze(a.traktandum)).requirement_head_numerator).toBe(2);
	});

	it('der gemeinsame Schreibweg weist ebenso ab', async () => {
		const a = await eroeffnet('Einladungsweg 5', '2027-10-05');
		await expect(
			alsBetreiber(betreiber, (tx) =>
				schreibeErfordernisIn(tx, handelnder(betreiber), a.traktandum, EINFACH)
			)
		).rejects.toMatchObject({ kennung: 'milder_als_einladung' });
	});

	it('ohne gedrucktes Mehr gibt es keine Untergrenze', async () => {
		const a = await eroeffnet('Einladungsweg 6', '2027-10-06');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.ohne, EINFACH);
		expect((await untergrenze(a.ohne)).requirement_head_numerator).toBe(1);
	});

	it('die Datenbank hält die Untergrenze ab der Eröffnung', async () => {
		const a = await eroeffnet('Einladungsweg 7', '2027-10-07');
		await expect(
			imKontext(betreiber, (tx) =>
				tx`UPDATE agenda_item SET released_requirement = NULL WHERE id = ${a.traktandum}`
			)
		).rejects.toThrow(/ab der Eröffnung fest/);
	});
});

describe('Vor Beginn', () => {
	it('senkt die Untergrenze, nimmt den Versandvermerk zurück und verlangt den neuen Versand', async () => {
		const a = await freigegeben('Einladungsweg 8', '2027-10-08');
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		expect(await holeNeuversandHinweis(betreiber, a.versammlung)).toBeNull();

		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);

		const z = await untergrenze(a.traktandum);
		expect(z.released_requirement?.kopfSchwelle).toEqual(EINFACH.kopfSchwelle);
		expect(z.released_requirement_relaxed_at).not.toBeNull();
		expect((await holeVersandvermerk(betreiber, a.versammlung)).gesetzt).toBe(false);
		// Die Nummer ist die der Einladung; davor stehen die Pflichttraktanden.
		expect(await holeNeuversandHinweis(betreiber, a.versammlung)).toMatch(
			/eines Traktandums milder geworden: «\d+ Sanierung der Fassade»/
		);

		const verlauf = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.einladungsmehrGemildert}
				   AND subject_id = ${a.traktandum}
			`
		);
		expect(verlauf).toHaveLength(1);
		expect(verlauf[0].detail).toMatchObject({ versandvermerkZurueckgenommen: true });
		expect(String(verlauf[0].detail.einladungNennt)).toMatch(/zwei Drittel/i);

		// Der neue Vermerk sagt: Die berichtigte Einladung ist hinaus.
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		expect(await holeNeuversandHinweis(betreiber, a.versammlung)).toBeNull();

		// Und ab der Eröffnung gilt das gemilderte Mehr als Untergrenze.
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
	});

	it('zurückgestellt vor dem neuen Versand: die Untergrenze kehrt zurück, der Hinweis geht', async () => {
		/*
		 * Laienprüfung 06.10.2026, T3-b: Ohne Rückweg blieb nach einem Hin und
		 * Zurück die gesenkte Untergrenze stehen, und ein Versandvermerk ohne
		 * Versand hätte im Saal das mildere Mehr freigegeben.
		 */
		const a = await freigegeben('Einladungsweg 10', '2027-10-10');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, ZWEIDRITTEL);

		const z = await untergrenze(a.traktandum);
		expect(z.released_requirement?.kopfSchwelle).toEqual(ZWEIDRITTEL.kopfSchwelle);
		expect(z.released_requirement_relaxed_at).toBeNull();
		expect(await holeNeuversandHinweis(betreiber, a.versammlung)).toBeNull();

		const verlauf = await imKontext(betreiber, (tx) =>
			tx<{ event_type: string }[]>`
				SELECT event_type FROM audit_entry
				 WHERE subject_id = ${a.traktandum}
				   AND event_type IN (${EREIGNISARTEN.einladungsmehrGemildert}, ${EREIGNISARTEN.einladungsmehrZurueckgestellt})
				 ORDER BY id
			`
		);
		expect(verlauf.map((v) => v.event_type)).toEqual([
			EREIGNISARTEN.einladungsmehrGemildert,
			EREIGNISARTEN.einladungsmehrZurueckgestellt
		]);

		// Im Saal gilt wieder die Untergrenze der ersten Einladung.
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await expect(
			haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH)
		).rejects.toMatchObject({ kennung: 'milder_als_einladung' });
	});

	it('nach vermerktem neuem Versand bleibt die gesenkte Untergrenze', async () => {
		const a = await freigegeben('Einladungsweg 11', '2027-10-11');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, ZWEIDRITTEL);
		expect((await untergrenze(a.traktandum)).released_requirement?.kopfSchwelle).toEqual(
			EINFACH.kopfSchwelle
		);
	});

	/*
	 * **Die neue Probe zum Produktentscheid 07.10.2026** («Nur noch aufmerksam
	 * machen»). Bis dahin fiel hier die Untergrenze auf die erste Einladung
	 * zurück (Produktentscheid 06.10.2026, «Erste Einladung gilt»), und die
	 * Abstimmung öffnete erst mit dem Mehr der Einladung. Gegen den alten Stand
	 * rot: `released_requirement` war danach zwei Drittel, und statt des neuen
	 * Eintrags stand `einladungsmehrZurueckgestellt` mit `beimEroeffnen`.
	 */
	it('beim Eröffnen ohne Haken bleibt das mildere Mehr, und der Verlauf hält es fest', async () => {
		const a = await freigegeben('Einladungsweg 12', '2027-10-12');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);

		const z = await untergrenze(a.traktandum);
		expect(z.released_requirement?.kopfSchwelle).toEqual(EINFACH.kopfSchwelle);
		expect(z.released_requirement_relaxed_at).not.toBeNull();
		expect(z.requirement_head_numerator).toBe(1);

		const zurueck = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`
				SELECT id FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.einladungsmehrZurueckgestellt}
				   AND subject_id = ${a.traktandum}
			`
		);
		expect(zurueck).toHaveLength(0);
		const verlauf = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.einladungsmehrBeimEroeffnen}
				   AND subject_id = ${a.traktandum}
			`
		);
		expect(verlauf).toHaveLength(1);
		expect(verlauf[0].detail).toMatchObject({
			traktandum: 'Sanierung der Fassade',
			versandVermerkt: false,
			vermerktAm: null,
			gemildertAm: HEUTE
		});
		expect(String(verlauf[0].detail.einladungDavor)).toMatch(/zwei Drittel/i);
		expect(String(verlauf[0].detail.mehrJetzt)).not.toMatch(/zwei Drittel/i);

		// Das Mehr davor ist geleert; die Spur der Milderung bleibt.
		const [davor] = await imKontext(betreiber, (tx) =>
			tx<{ b: unknown }[]>`SELECT released_requirement_before AS b FROM agenda_item WHERE id = ${a.traktandum}`
		);
		expect(davor.b).toBeNull();

		// Die Abstimmung öffnet mit dem milderen Mehr.
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
	});

	it('mit Haken nach der Milderung: der Verlauf nennt den Tag', async () => {
		const a = await freigegeben('Einladungsweg 13', '2027-10-13');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		expect((await untergrenze(a.traktandum)).released_requirement?.kopfSchwelle).toEqual(
			EINFACH.kopfSchwelle
		);
		const [eintrag] = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.einladungsmehrBeimEroeffnen}
				   AND subject_id = ${a.traktandum}
			`
		);
		expect(eintrag.detail).toMatchObject({ versandVermerkt: true, vermerktAm: HEUTE });
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
	});

	/*
	 * **Ein Haken nach dem letzten Fristtag zählt** (Produktentscheid 07.10.2026).
	 * Vom 06.10.2026 (Laienprüfung, dritter Durchgang, T10) bis 07.10.2026 blieb
	 * der Hinweis dann stehen, der Rückweg offen, und das Eröffnen fiel zurück.
	 */
	it('ein Haken nach dem letzten Fristtag erledigt die Milderung', async () => {
		const a = await freigegeben('Einladungsweg 14', tageSpaeter(HEUTE, 40), 20);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		// Die Frist auf heute minus einen Tag ziehen: Der Vermerk liegt dann danach.
		await speichereEinberufungsfrist(handelnder(betreiber), (await gemeinschaftVon(a.versammlung)), 41, 'Reglement Ziff. 12');
		expect(await holeNeuversandLage(betreiber, a.versammlung)).toEqual({ anzahl: 1, fristVorbei: true });
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		expect(await holeNeuversandHinweis(betreiber, a.versammlung)).toBeNull();
		expect(await holeNeuversandLage(betreiber, a.versammlung)).toBeNull();

		// Der Rückweg ist zu: Ein strengeres Mehr lässt die gesenkte Untergrenze stehen.
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, ZWEIDRITTEL);
		expect((await untergrenze(a.traktandum)).released_requirement?.kopfSchwelle).toEqual(
			EINFACH.kopfSchwelle
		);
	});

	it('ein Haken nach dem letzten Fristtag: beim Eröffnen bleibt das mildere Mehr', async () => {
		const a = await freigegeben('Einladungsweg 15', tageSpaeter(HEUTE, 40), 20);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		await speichereEinberufungsfrist(handelnder(betreiber), (await gemeinschaftVon(a.versammlung)), 41, 'Reglement Ziff. 12');
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		expect((await untergrenze(a.traktandum)).released_requirement?.kopfSchwelle).toEqual(
			EINFACH.kopfSchwelle
		);
	});

	it('eine zweite Milderung nimmt der ersten den vermerkten Versand nicht', async () => {
		/*
		 * Fachprüfung 06.10.2026, dritter Durchgang, zu T7: A gemildert und
		 * als verschickt vermerkt, dann B gemildert. Der Vermerk fällt für B
		 * zurück; A bleibt aus dem Hinweis. Seit dem Produktentscheid 07.10.2026
		 * bleiben beim Eröffnen beide beim milderen Mehr (bis dahin fiel B
		 * zurück), und der Verlauf nennt bei A den Haken, bei B keinen.
		 */
		const a = await freigegeben('Einladungsweg 16', '2027-10-16', undefined, true);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.ohne, EINFACH);
		expect(await holeNeuversandHinweis(betreiber, a.versammlung)).toMatch(/Ersatz der Briefkästen/);
		expect(await holeNeuversandHinweis(betreiber, a.versammlung)).not.toMatch(/Sanierung der Fassade/);

		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		expect((await untergrenze(a.traktandum)).released_requirement?.kopfSchwelle).toEqual(
			EINFACH.kopfSchwelle
		);
		expect((await untergrenze(a.ohne)).released_requirement?.kopfSchwelle).toEqual(
			EINFACH.kopfSchwelle
		);
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ subject_id: string; detail: Record<string, unknown> }[]>`
				SELECT subject_id, detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.einladungsmehrBeimEroeffnen}
				   AND subject_id IN (${a.traktandum}, ${a.ohne})
			`
		);
		const je = new Map(eintraege.map((e) => [e.subject_id, e.detail]));
		expect(je.get(a.traktandum)).toMatchObject({ versandVermerkt: true, vermerktAm: HEUTE });
		expect(String(je.get(a.traktandum)?.einladungDavor)).toMatch(/zwei Drittel/i);
		expect(je.get(a.ohne)).toMatchObject({ versandVermerkt: false, vermerktAm: null });
	});

	it('weist nach abgelaufener Versandfrist ab', async () => {
		// Frist 20 Tage, Versammlung in 10 Tagen: Der letzte Versandtag ist vorbei.
		const a = await freigegeben('Einladungsweg 9', tageSpaeter(HEUTE, 10), 20);
		await expect(
			haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH)
		).rejects.toMatchObject({ kennung: 'versandfrist_vorbei' });
		expect((await untergrenze(a.traktandum)).released_requirement_relaxed_at).toBeNull();
	});
});

/*
 * **Ob eine Frist erfasst ist, weiss die Seite Vorbereitung** (Auftrag «Hinweise
 * lesbar», 06.10.2026): Der Rat, mindestens zehn Tage zu erfassen, steht beim
 * Haken nur ohne erfasste Frist. Gegen den Stand davor rot: Das Feld fehlte.
 */
describe('Vorbereitung: erfasste Einberufungsfrist', () => {
	it('liefert `einberufungsfristErfasst` ohne und mit erfasster Frist', async () => {
		const ohne = await freigegeben('Einladungsweg Frist 1', '2027-10-20');
		expect((await holeVorbereitung(betreiber, ohne.versammlung))?.einberufungsfristErfasst).toBe(false);
		const mit = await freigegeben('Einladungsweg Frist 2', '2027-10-21', 20);
		expect((await holeVorbereitung(betreiber, mit.versammlung))?.einberufungsfristErfasst).toBe(true);
		// Wieder entfernt: zurück auf `false`.
		await speichereEinberufungsfrist(handelnder(betreiber), mit.gemeinschaft, null, null);
		expect((await holeVorbereitung(betreiber, mit.versammlung))?.einberufungsfristErfasst).toBe(false);
	});
});

describe('Nachziehen nach einer Reglementsänderung', () => {
	it('lässt ein abgewiesenes Traktandum stehen und zieht die übrigen nach', async () => {
		/*
		 * Codeprüfung 06.10.2026: Ohne Sicherungspunkt fiel das Nachziehen der
		 * ganzen Gemeinschaft zurück, sobald ein Traktandum einer freigegebenen
		 * Versammlung nach Fristablauf milder würde.
		 */
		const a = await freigegeben('Einladungsweg 17', tageSpaeter(HEUTE, 10), 20);
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: a.gemeinschaft,
			datum: tageSpaeter(HEUTE, 90),
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			parentId: null,
			titel: 'Ersatz der Haustür',
			art: 'abstimmung',
			antragswortlaut: 'Die Haustür wird ersetzt.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, ZWEIDRITTEL);

		const offen = await veralteteErfordernisse(betreiber, a.gemeinschaft);
		expect(offen.map((o) => o.traktandumId).sort()).toEqual([a.traktandum, t.id].sort());

		const { nachgezogen, uebersprungen } = await erfordernisseNachziehen(
			handelnder(betreiber),
			a.gemeinschaft
		);
		expect(nachgezogen).toBe(1);
		expect(uebersprungen).toHaveLength(1);
		expect(uebersprungen[0]).toMatch(
			/Sanierung der Fassade.*Der letzte Tag der erfassten Einberufungsfrist war der/
		);
		expect((await untergrenze(t.id)).requirement_head_numerator).toBe(1);
		expect((await untergrenze(a.traktandum)).requirement_head_numerator).toBe(2);
	});
});

describe('Folgeantrag', () => {
	/*
	 * Produktentscheid 06.10.2026, «Ja, dieselbe Untergrenze»: Ein Folgeantrag,
	 * auch der Gegenantrag, hält das Mehr, das die Einladung für sein
	 * angekündigtes Traktandum nennt. Er trägt selbst nie ein festgehaltenes
	 * Mehr; gemessen wird über den Vorfahren.
	 */
	async function mitFolgeantrag(name: string, datum: string, unter: 'traktandum' | 'ohne' = 'traktandum') {
		const a = await freigegeben(name, datum);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const f = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a[unter],
				titel: 'Gegenantrag Holzfassade',
				art: 'abstimmung',
				antragswortlaut: 'Die Fassade wird in Holz statt in Putz erneuert.',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		return { ...a, folgeantrag: f.id };
	}

	it('die Schreibstelle weist ein milderes Mehr ab, gleich und strenger gehen', async () => {
		const a = await mitFolgeantrag('Einladungsweg 20', '2027-10-20');
		await expect(
			haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.folgeantrag, EINFACH)
		).rejects.toMatchObject({
			kennung: 'milder_als_einladung',
			message: expect.stringMatching(
				/«Gegenantrag Holzfassade» ist ein Folge- oder Gegenantrag zu «\d+ Sanierung der Fassade»/
			)
		});
		expect((await untergrenze(a.folgeantrag)).requirement_head_numerator).toBeNull();

		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.folgeantrag, ZWEIDRITTEL);
		expect((await untergrenze(a.folgeantrag)).requirement_head_numerator).toBe(2);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.folgeantrag, DREIVIERTEL);
		expect((await untergrenze(a.folgeantrag)).requirement_head_numerator).toBe(3);
		// Am Folgeantrag selbst wird nichts festgehalten.
		expect((await untergrenze(a.folgeantrag)).released_requirement).toBeNull();
	});

	it('der gemeinsame Schreibweg weist ebenso ab', async () => {
		const a = await mitFolgeantrag('Einladungsweg 21', '2027-10-21');
		await expect(
			alsBetreiber(betreiber, (tx) =>
				schreibeErfordernisIn(tx, handelnder(betreiber), a.folgeantrag, EINFACH)
			)
		).rejects.toMatchObject({ kennung: 'milder_als_einladung' });
	});

	it('unter einem Traktandum ohne Untergrenze ist alles frei', async () => {
		const a = await mitFolgeantrag('Einladungsweg 22', '2027-10-22', 'ohne');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.folgeantrag, EINFACH);
		expect((await untergrenze(a.folgeantrag)).requirement_head_numerator).toBe(1);
	});

	it('das Öffnen weist ein milderes Mehr ab, das an der Schreibstelle vorbei kam', async () => {
		const a = await mitFolgeantrag('Einladungsweg 23', '2027-10-23');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.folgeantrag, ZWEIDRITTEL);
		// Wie ein Altbestand: die Schwelle direkt auf die Hälfte.
		await imKontext(betreiber, (tx) =>
			tx`
				UPDATE agenda_item
				   SET requirement_head_numerator = 1, requirement_head_denominator = 2,
				       requirement_head_mode = 'mehr_als'
				 WHERE id = ${a.folgeantrag}
			`
		);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.folgeantrag)
		).rejects.toMatchObject({
			kennung: 'milder_als_einladung',
			message: expect.stringMatching(/ist ein Folge- oder Gegenantrag zu «\d+ Sanierung der Fassade»/)
		});
	});

	it('der Beschluss von Hand führt die Absage unter «übergangen»', async () => {
		const a = await mitFolgeantrag('Einladungsweg 24', '2027-10-24');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.folgeantrag, ZWEIDRITTEL);
		await imKontext(betreiber, (tx) =>
			tx`
				UPDATE agenda_item
				   SET requirement_head_numerator = 1, requirement_head_denominator = 2,
				       requirement_head_mode = 'mehr_als'
				 WHERE id = ${a.folgeantrag}
			`
		);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		const { uebergangen } = await haltBeschlussVonHandFest(
			handelnder(betreiber),
			a.versammlung,
			a.folgeantrag,
			{
				ergebnis: 'angenommen',
				zahlen: {
					erfassung: 'summen',
					koepfe: { ja: 2, nein: 0, enthaltung: 0 },
					quoten: { ja: 1000, nein: 0, enthaltung: 0 }
				}
			}
		);
		expect(uebergangen).toContainEqual(
			expect.objectContaining({
				kennung: 'milder_als_einladung',
				satz: expect.stringMatching(/ist ein Folge- oder Gegenantrag zu «\d+ Sanierung der Fassade»/)
			})
		);
	});

	it('die Aufnahme im Saal lässt den Folgeantrag stehen, wenn der Grundantrag ein milderes Mehr trägt', async () => {
		/*
		 * Produktentscheid 08.10.2026: Der Folgeantrag erbt nicht mehr. Trägt
		 * der Grundantrag ein milderes Mehr als die Einladung, steht der
		 * Folgeantrag ohne eigenes Mehr da, und die Warnung verlangt, eines zu
		 * setzen. Die Absage darf die Aufnahme nicht scheitern lassen: Der
		 * Folgeantrag steht schon, und ein zweiter Klick legte ihn doppelt an.
		 * Bis 07.10.2026 entstand die Lage durch den Rückfall beim Eröffnen;
		 * seither nur noch an der Schreibstelle vorbei, hier wie ein Altbestand.
		 */
		const a = await freigegeben('Einladungsweg 25', '2027-10-25');
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await mehrVorbeiAufHaelfte(a.traktandum);
		expect((await untergrenze(a.traktandum)).requirement_head_numerator).toBe(1);

		const f = new FormData();
		f.set('spontanart', 'folgeantrag');
		f.set('grundantrag', a.traktandum);
		f.set('art', 'abstimmung');
		f.set('titel', 'Gegenantrag Holzfassade');
		f.set('antragswortlaut', 'Die Fassade wird in Holz statt in Putz erneuert.');
		const auf = await nimmImSaalAuf(handelnder(betreiber), a.versammlung, f, 'versammlung');

		// Ohne Erbe fehlt das Mehr schlicht; die Warnung nennt den Weg.
		expect(auf.warnung).toBe(
			'«Gegenantrag Holzfassade» ist als Folgeantrag aufgenommen. Er stützt sich auf das ' +
				'angekündigte Traktandum, unter dem er steht. Vor der Abstimmung fehlt noch das ' +
				'Mehrheitserfordernis. Setzen Sie es mit «Erfordernis setzen» in seiner Zeile.'
		);
		expect(auf.warnung).not.toContain('wurde übernommen');
		expect(auf.warnung).not.toContain('Betroffene');
		const zeilen = await imKontext(betreiber, (tx) =>
			tx<{ id: string; requirement_type: string | null }[]>`
				SELECT id, requirement_type FROM agenda_item
				 WHERE meeting_id = ${a.versammlung} AND title = 'Gegenantrag Holzfassade'
			`
		);
		expect(zeilen).toHaveLength(1);
		expect(zeilen[0].id).toBe(auf.traktandumId);
		expect(zeilen[0].requirement_type).toBeNull();
	});

	it('die Erfordernisseite nennt das Mehr des angekündigten Traktandums, auch wenn keines eingestellt war', async () => {
		const a = await mitFolgeantrag('Einladungsweg 26', '2027-10-26');
		const mit = await holeEinladungsmehrInWorten(betreiber, a.folgeantrag);
		expect(mit?.worte).toMatch(/zwei Drittel/i);
		expect(mit?.grundantrag).toMatch(/^\d+ Sanierung der Fassade$/);

		const b = await mitFolgeantrag('Einladungsweg 27', '2027-10-27', 'ohne');
		const ohne = await holeEinladungsmehrInWorten(betreiber, b.folgeantrag);
		// `gemildert` seit der Schlusskorrektur Teil 2 (Erfordernisseite, Laienprüfung Runde 3, Punkt 1).
		expect(ohne).toEqual({
			worte: null,
			grundantrag: expect.stringMatching(/^\d+ Ersatz der Briefkästen$/),
			gemildert: false
		});

		// Am angekündigten Traktandum selbst kein Grundantrag.
		expect((await holeEinladungsmehrInWorten(betreiber, a.traktandum))?.grundantrag).toBeNull();
	});

	it('bleibt unter seinem Traktandum: anderer Elternteil abgewiesen, Reihenfolge darunter frei', async () => {
		/*
		 * Codeprüfung 3 vom 06.10.2026: Unter einem anderen Elternteil hielte
		 * der Folgeantrag dessen Untergrenze statt seiner eigenen.
		 */
		const a = await mitFolgeantrag('Einladungsweg 28', '2027-10-28');
		const zweiter = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a.traktandum,
				titel: 'Gegenantrag Metallfassade',
				art: 'abstimmung',
				antragswortlaut: 'Die Fassade wird mit Metallplatten verkleidet.',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		await expect(
			verschiebeTraktandum(handelnder(betreiber), a.versammlung, {
				id: a.folgeantrag,
				neuerElternteil: a.ohne,
				stelle: 0
			})
		).rejects.toMatchObject({
			kennung: 'folgeantrag_bleibt_beim_traktandum',
			// Codeprüfung N6: der Wortlaut nach Fachprüfung FP3-12.
			message:
				'Ein Folgeantrag bleibt unter dem Traktandum, zu dem er gestellt wurde. Nach dessen ' +
				'Ankündigung richtet sich, ob er zulässig ist, und in dieser Anwendung, welches Mehr ' +
				'er mindestens braucht. Hängt er am falschen Traktandum, halten Sie das mit dem Grund ' +
				'«falsch zugeordnet» fest. Das geht in der Leitung der Versammlung mit «Antrag ' +
				'zurückziehen» in seiner Zeile oder, wenn er gerade aufgerufen ist, unter «Jetzt ' +
				'möglich» bei «Zurückziehen». Beim richtigen nehmen Sie ihn ' +
				'neu auf, sofern er sich im Kern dieses Traktandums hält und darüber noch nicht ' +
				'abgestimmt ist.'
		});
		await expect(
			verschiebeTraktandum(handelnder(betreiber), a.versammlung, {
				id: a.folgeantrag,
				neuerElternteil: null,
				stelle: 0
			})
		).rejects.toMatchObject({ kennung: 'folgeantrag_bleibt_beim_traktandum' });

		const danach = await verschiebeTraktandum(handelnder(betreiber), a.versammlung, {
			id: zweiter.id,
			neuerElternteil: a.traktandum,
			stelle: 0
		});
		const unter = danach
			.filter((n) => n.knoten.parentId === a.traktandum)
			.sort((x, y) => x.knoten.position - y.knoten.position)
			.map((n) => n.knoten.id);
		expect(unter).toEqual([zweiter.id, a.folgeantrag]);
	});

	it('nur die Zustimmung weicht ab: gleiche Masse ohne Zustimmung gehen', async () => {
		/*
		 * Produktentscheid 06.10.2026, «Nur wenn der Inhalt es verlangt»: Die
		 * Zustimmung der Betroffenen wird am Folgeantrag nicht mit der Einladung
		 * verglichen.
		 */
		const a = await freigegeben('Einladungsweg 29', '2027-10-29', undefined, false, {
			mehr: { ...ZWEIDRITTEL, zustimmungBetroffenerNoetig: true }
		});
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const f = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a.traktandum,
				titel: 'Gegenantrag Holzfassade',
				art: 'abstimmung',
				antragswortlaut: 'Die Fassade wird in Holz statt in Putz erneuert.',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, f.id, ZWEIDRITTEL);
		expect((await untergrenze(f.id)).requirement_head_numerator).toBe(2);
		await expect(
			haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, f.id, EINFACH)
		).rejects.toMatchObject({ kennung: 'milder_als_einladung' });
	});

	it('das Formular erfährt je Grundantrag, was zu mild ist (Codeprüfung N5)', async () => {
		const a = await freigegeben('Einladungsweg 30', '2027-10-30');
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const lage = async () =>
			holeEinladungsmehrJeTraktandum(betreiber, a.versammlung, {
				regeln: [],
				enthaltung: null,
				traktanden: await holeTraktanden(betreiber, a.versammlung)
			});
		const je = await lage();
		// Nur, wer ein festgehaltenes Mehr trägt (dazu Pflichttraktanden der Vorlage).
		expect(je.has(a.traktandum)).toBe(true);
		expect(je.has(a.ohne)).toBe(false);
		expect(je.has(a.kenntnis)).toBe(false);
		const g = je.get(a.traktandum)!;
		expect(g.worte).toMatch(/zwei Drittel/i);
		expect(g.zuMild).toContain('k-verwaltung-gewoehnlich');
		expect(g.geerbtZuMild).toBe(false);

		/*
		 * Nach einer Milderung ohne Haken: Bis 07.10.2026 fiel die Untergrenze
		 * beim Eröffnen zurück, und der Grundantrag trug ein zu mildes Mehr
		 * (`geerbtZuMild` wahr). Seit dem Produktentscheid 07.10.2026 ist das
		 * mildere Mehr die Untergrenze, und es ist nichts mehr zu mild.
		 */
		const b = await freigegeben('Einladungsweg 31', '2027-10-31');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), b.versammlung, b.traktandum, EINFACH);
		await eroeffneVersammlung(handelnder(betreiber), b.versammlung);
		const nachMilderung = await holeEinladungsmehrJeTraktandum(betreiber, b.versammlung, {
			regeln: [],
			enthaltung: null,
			traktanden: await holeTraktanden(betreiber, b.versammlung)
		});
		expect(nachMilderung.get(b.traktandum)?.geerbtZuMild).toBe(false);
	});

	it('ohne Mehr steht der Satz als Warnung, nicht als Quittung; sonst gibt es keine Warnung', async () => {
		/*
		 * Produktentscheid 06.10.2026, «Eigenes Feld für Warnungen, das stehen
		 * bleibt»: Die Quittung (`hinweis`) verschwindet auf der Seite nach sechs
		 * Sekunden, die Warnung bleibt stehen. Derselbe Satz darf deshalb nicht
		 * im `hinweis` stehen, sonst liefe er wieder in die Quittungsecke.
		 */
		const a = await freigegeben('Einladungsweg 34', '2027-11-03');
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		// Bis 07.10.2026 über eine Milderung und den Rückfall beim Eröffnen.
		await mehrVorbeiAufHaelfte(a.traktandum);
		const formular = (grundantrag: string, titel: string) => {
			const f = new FormData();
			f.set('spontanart', 'folgeantrag');
			f.set('grundantrag', grundantrag);
			f.set('art', 'abstimmung');
			f.set('titel', titel);
			f.set('antragswortlaut', 'Die Fassade wird in Holz statt in Putz erneuert.');
			return f;
		};

		const zuMild = await nimmImSaalAuf(
			handelnder(betreiber),
			a.versammlung,
			formular(a.traktandum, 'Gegenantrag Lärchenholz'),
			'versammlung'
		);
		// Ohne Erbe (Produktentscheid 08.10.2026) fehlt das Mehr schlicht; die
		// Warnung nennt den Weg statt einer Quittung.
		expect(zuMild.warnung).toBe(
			'«Gegenantrag Lärchenholz» ist als Folgeantrag aufgenommen. Er stützt sich auf das ' +
				'angekündigte Traktandum, unter dem er steht. Vor der Abstimmung fehlt noch das ' +
				'Mehrheitserfordernis. Setzen Sie es mit «Erfordernis setzen» in seiner Zeile.'
		);
		expect(zuMild.hinweis).toBeUndefined();

		// Der gewöhnliche Fall: die Quittung wie bisher, keine Warnung. Mit einem
		// Mehr, denn ohne steht seit dem Auftrag «Hinweise lesbar» (06.10.2026) auch
		// «Vor der Abstimmung fehlt noch das Mehrheitserfordernis» als Warnung.
		const mitMehr = formular(a.ohne, 'Gegenantrag Briefkastenanlage');
		mitMehr.set('erfordernis', 'k-verwaltung-gewoehnlich');
		const gewoehnlich = await nimmImSaalAuf(handelnder(betreiber), a.versammlung, mitMehr, 'versammlung');
		expect(gewoehnlich.hinweis).toContain(
			'«Gegenantrag Briefkastenanlage» ist als Folgeantrag aufgenommen.'
		);
		expect(gewoehnlich.warnung).toBeUndefined();
	});

	it('am gemeinsamen Abend nennt der Hinweis den Weg über die Leitung der Gemeinschaft', async () => {
		/*
		 * Codeprüfung N1, Laienprüfung R2-2 (06.10.2026): Am Abend gibt es
		 * «Erfordernis setzen» nur in der Leitung des Hauses, verlinkt unter
		 * «Es tagen mit», und «Jetzt möglich» erst am aufgerufenen Schritt.
		 */
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: 'Einladungsweg, Abend',
			datum: '2027-11-01',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich'
		});
		const a = await freigegeben('Einladungsweg 32', '2027-11-01', undefined, false, { tag: tag.id });
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);

		const formular = (grundantrag: string, titel: string, erfordernis = '', betroffene: string[] = []) => {
			const f = new FormData();
			f.set('spontanart', 'folgeantrag');
			f.set('grundantrag', grundantrag);
			f.set('art', 'abstimmung');
			f.set('titel', titel);
			f.set('antragswortlaut', 'Die Fassade wird in Holz statt in Putz erneuert.');
			if (erfordernis) f.set('erfordernis', erfordernis);
			for (const b of betroffene) f.append('betroffene', b);
			return f;
		};

		const zuMild = await nimmImSaalAuf(
			handelnder(betreiber),
			a.versammlung,
			formular(a.traktandum, 'Gegenantrag Holzfassade', 'k-verwaltung-gewoehnlich', [a.parteien[0]]),
			'abend'
		);
		expect(zuMild.warnung).toContain(
			'und das gewählte ist milder. Setzen Sie dieses Mehr oder ein strengeres im Ablauf mit ' +
				'«Erfordernis setzen», sobald er aufgerufen ist. Oder setzen Sie es in der Leitung von ' +
				'«Einladungsweg 32» (unter «Es tagen mit») mit «Erfordernis setzen» in seiner Zeile. ' +
				'Verlangt der Inhalt des Folgeantrags die Zustimmung der im Formular ausgewählten ' +
				'Betroffenen, beantworten Sie dabei die Fragen nach seinem Inhalt. Dann verlangt das ' +
				'Ergebnis sie (Handbuch, Folgeantrag, Punkt 4). Ein von Hand gesetztes Mehr kennt ' +
				'keine Betroffenen. Eintragen lassen sie sich danach unter «Jetzt möglich» bei ' +
				'«Betroffene», sobald er im Ablauf aufgerufen ist; gespeichert sind sie noch nicht. Soll'
		);
		expect(zuMild.warnung).toContain(
			'Halten Sie das in der Leitung von «Einladungsweg 32» (unter «Es tagen mit») mit «Antrag ' +
				'zurückziehen» in seiner Zeile fest. Nennen Sie als Grund, was geschah.'
		);

		// Codeprüfung N3 (Runde 4): Ruft die Leitung der Gemeinschaft auf, die am
		// Abend tagt, gilt der Weg ihrer eigenen Seite, nicht der des Abends.
		const inDerLeitung = await nimmImSaalAuf(
			handelnder(betreiber),
			a.versammlung,
			formular(a.traktandum, 'Gegenantrag Klinker', 'k-verwaltung-gewoehnlich'),
			'versammlung'
		);
		expect(inDerLeitung.warnung).toContain(
			'Setzen Sie mit «Erfordernis setzen» in seiner Zeile dieses Mehr oder ein strengeres.'
		);
		expect(inDerLeitung.warnung).toContain('Halten Sie das mit «Antrag zurückziehen» in seiner Zeile fest');
		expect(inDerLeitung.warnung).not.toContain('in der Leitung von');

		// Unter dem Traktandum ohne Mehr: der Bestandssatz mit dem Weg dieser Seite.
		const ohneMehr = await nimmImSaalAuf(
			handelnder(betreiber),
			a.versammlung,
			formular(a.ohne, 'Gegenantrag Briefkästen'),
			'abend'
		);
		expect(ohneMehr.hinweis).toBeUndefined();
		expect(ohneMehr.warnung).toContain(
			'Vor der Abstimmung fehlt noch das Mehrheitserfordernis. Setzen Sie es im Ablauf mit ' +
				'«Erfordernis setzen», sobald er aufgerufen ist. Oder setzen Sie es in der Leitung von ' +
				'«Einladungsweg 32» (unter «Es tagen mit») mit «Erfordernis setzen» in seiner Zeile.'
		);
	});

	it('ohne Mehr und mit Betroffenen steht der Weg zum Mehr nur einmal (Codeprüfung M1)', async () => {
		const a = await freigegeben('Einladungsweg 33', '2027-11-02');
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const f = new FormData();
		f.set('spontanart', 'folgeantrag');
		f.set('grundantrag', a.ohne);
		f.set('art', 'abstimmung');
		f.set('titel', 'Gegenantrag Briefkästen');
		f.set('antragswortlaut', 'Die Briefkästen werden nur ersetzt, wo sie defekt sind.');
		f.append('betroffene', a.parteien[0]);
		const auf = await nimmImSaalAuf(handelnder(betreiber), a.versammlung, f, 'versammlung');
		expect(auf.hinweis).toBeUndefined();
		expect((auf.warnung ?? '').split('«Erfordernis setzen»')).toHaveLength(2);
		expect(auf.warnung).toContain(
			'Vor der Abstimmung fehlt noch das Mehrheitserfordernis. Setzen Sie es mit «Erfordernis ' +
				'setzen» in seiner Zeile. Verlangt der Inhalt des Folgeantrags die Zustimmung'
		);
		expect(auf.warnung).toContain('sobald er aufgerufen ist; gespeichert sind sie noch nicht.');
	});
});

describe('Am gemeinsamen Abend', () => {
	/*
	 * Entscheid 06.10.2026, «Mit dem nächsten Block»: Das Mehr eines Geschäfts
	 * wird in allen Häusern gesetzt (`setzeErfordernisAmGeschaeft`), die
	 * Untergrenze steht aber je Haus. Mit Frist (20 Tage, Versammlung in 10) ist
	 * der letzte Versandtag vorbei, und das Haus weist ab; ohne erfasste Frist
	 * sänke die Untergrenze, und der Vermerk fiele.
	 *
	 * **Die Reihenfolge der Häuser** (Codeprüfung 06.10.2026) ist die der
	 * Abendseite: erst die Stelle im Geschäft (`business_position`), dann die im
	 * Ablauf, dann der Name. Hier kommen alle Häuser mit derselben Stelle im
	 * Ablauf in den Abend, also ordnet ohne Stelle im Geschäft der Name.
	 */
	async function abend(
		bezeichnung: string,
		haeuser: { name: string; frist?: number }[],
		titel = 'Velounterstand'
	) {
		const datum = tageSpaeter(HEUTE, 10);
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung,
			datum,
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich'
		});
		const vs: Awaited<ReturnType<typeof freigegeben>>[] = [];
		for (const h of haeuser) vs.push(await freigegeben(h.name, datum, h.frist, false, { tag: tag.id }));
		// Das Geschäft muss vor der Freigabe stehen, sonst hält sie kein Mehr fest.
		for (const v of vs) {
			await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), v.versammlung, 'Prüflauf');
		}
		const g = await erstelleGeschaeft(handelnder(betreiber), tag.id, {
			titel,
			antragswortlaut: 'Ein Velounterstand wird gebaut.',
			meetingIds: vs.map((v) => v.versammlung),
			erfordernis: 'k-baulich-nuetzlich'
		});
		for (const v of vs) await gibVersammlungFrei(handelnder(betreiber), v.versammlung);
		const zeile = (await holeGemeinsameListe(betreiber, tag.id)).find((z) => z.geschaeftId === g.id)!;
		return { tag: tag.id, geschaeft: g.id, vs, haeuser: zeile.haeuser };
	}

	const stand = (geschaeft: string) =>
		imKontext(betreiber, (tx) =>
			tx<{ meeting_id: string; requirement_node: string; gedruckt: boolean; gemildert: boolean }[]>`
				SELECT meeting_id, requirement_node, released_requirement IS NOT NULL AS gedruckt,
				       released_requirement_relaxed_at IS NOT NULL AS gemildert
				  FROM agenda_item WHERE business_id = ${geschaeft} ORDER BY meeting_id
			`
		);

	it('die Absage nennt die Gemeinschaft, die abweist, und gesetzt wird in keiner', async () => {
		const a = await abend('Einladungsweg, Abend mit Frist', [
			{ name: 'Einladungsweg 43', frist: 20 },
			{ name: 'Einladungsweg 42' }
		]);
		// Das Haus, das annähme, steht im Abend vorn und kommt zuerst an die Reihe.
		expect(a.haeuser.map((h) => h.gemeinschaft)).toEqual(['Einladungsweg 42', 'Einladungsweg 43']);
		const [abweisend, annehmend] = a.vs;
		await vermerkeVersand(handelnder(betreiber), annehmend.versammlung, true);

		const vorher = await stand(a.geschaeft);
		expect(vorher).toHaveLength(2);
		expect(vorher.every((z) => z.gedruckt && z.requirement_node === 'k-baulich-nuetzlich')).toBe(true);

		const absage = await setzeErfordernisAmGeschaeft(
			handelnder(betreiber),
			a.tag,
			a.geschaeft,
			'k-verwaltung-gewoehnlich'
		).catch((f: unknown) => f);

		// Nichts geschrieben, auch nicht im Haus, das allein angenommen hätte.
		expect(await stand(a.geschaeft)).toEqual(vorher);
		expect((await holeVersandvermerk(betreiber, annehmend.versammlung)).gesetzt).toBe(true);
		expect((await holeVersandvermerk(betreiber, abweisend.versammlung)).gesetzt).toBe(false);

		expect(absage).toMatchObject({ kennung: 'versandfrist_vorbei', feld: 'erfordernis' });
		const satz = (absage as Error).message;
		expect(
			satz.startsWith(
				'Gemeinschaft «Einladungsweg 43» weist das mildere Mehr ab; gesetzt ist es deshalb in ' +
					'keiner Gemeinschaft dieses Traktandums. '
			)
		).toBe(true);
		expect(satz).toContain('Velounterstand»: Die Einladung nennt');
		expect(satz).toContain('In den übrigen Gemeinschaften können Sie das mildere Mehr einzeln setzen');
		expect(satz).toContain('«Erfordernis ändern»');
		expect(
			satz.endsWith('Ein Verschieben betrifft nur das Traktandum der Gemeinschaft, in der Sie verschieben.')
		).toBe(true);
	});

	it('weisen mehrere ab, nennt die Absage alle in der Reihenfolge des Abends', async () => {
		const a = await abend('Einladungsweg, Abend zweimal Frist', [
			{ name: 'Einladungsweg 44', frist: 20 },
			{ name: 'Einladungsweg 45', frist: 20 }
		]);
		/*
		 * **Eine Reihenfolge, die weder dem Namen noch dem Anlegen folgt**
		 * (Codeprüfung N2, 06.10.2026): «Einladungsweg 45» wird im Geschäft vor
		 * «Einladungsweg 44» gestellt. Eine Sortierung ohne die Stelle im Geschäft
		 * (nur Ablauf und Name) macht die Probe rot, so am 06.10.2026 gegengeprüft.
		 * Gegen das Weglassen der Sortierung schützt sie nicht: Welche Folge eine
		 * Abfrage ohne `ORDER BY` liefert, hängt am Plan, und am 06.10.2026 kam
		 * sie hier zufällig richtig heraus.
		 */
		const [h44, h45] = a.haeuser;
		await verschiebeInGeschaeft(handelnder(betreiber), a.tag, a.geschaeft, h45.traktandumId, h44.traktandumId);
		const reihenfolge = (await holeGemeinsameListe(betreiber, a.tag))
			.find((z) => z.geschaeftId === a.geschaeft)!
			.haeuser.map((h) => h.gemeinschaft);
		expect(reihenfolge).toEqual(['Einladungsweg 45', 'Einladungsweg 44']);
		const vorher = await stand(a.geschaeft);

		const absage = await setzeErfordernisAmGeschaeft(
			handelnder(betreiber),
			a.tag,
			a.geschaeft,
			'k-verwaltung-gewoehnlich'
		).catch((f: unknown) => f);

		expect(await stand(a.geschaeft)).toEqual(vorher);
		expect(absage).toMatchObject({ kennung: 'versandfrist_vorbei', feld: 'erfordernis' });
		const satz = (absage as Error).message;
		expect(
			satz.startsWith(
				'Die Gemeinschaften «Einladungsweg 45» und «Einladungsweg 44» weisen das mildere Mehr ab'
			)
		).toBe(true);
		/*
		 * **Die Begründung steht einmal** (Produktentscheid 06.10.2026,
		 * «Gesammelt nachbessern»): Beide Häuser weisen mit demselben Wortlaut
		 * ab; der Vorsatz nennt sie, die Begründung folgt einmal ohne Namen.
		 * Gegen den Stand vor dem Zusammenfassen rot (je Haus einmal, also zwei).
		 */
		expect(satz.split('Die Einladung nennt').length - 1).toBe(1);
		expect(satz.split('Der letzte Tag der erfassten Einberufungsfrist war der').length - 1).toBe(1);
		expect(satz).toContain('dieses Traktandums. Die Einladung nennt');
		// Übrige gibt es keine.
		expect(satz).not.toContain('In den übrigen Gemeinschaften');
		expect(satz).toContain('nur das Traktandum der Gemeinschaft, in der Sie verschieben.');
	});

	it('ein Titel mit «» und »: bleibt heil, die Begründung steht trotzdem einmal', async () => {
		/*
		 * Codeprüfung N4, Korrekturrunde 06.10.2026: Abgeschnitten wird genau die
		 * bekannte Bezeichnung, nicht ein Muster. Ein Muster bis zum ersten «»: »
		 * schnitte hier mitten im Titel ab und liesse «Ersatz»: » stehen.
		 */
		const a = await abend(
			'Einladungsweg, Abend Titel mit Zeichen',
			[
				{ name: 'Einladungsweg 49', frist: 20 },
				{ name: 'Einladungsweg 50', frist: 20 }
			],
			'Velounterstand «Nord»: Ersatz'
		);
		const absage = await setzeErfordernisAmGeschaeft(
			handelnder(betreiber),
			a.tag,
			a.geschaeft,
			'k-verwaltung-gewoehnlich'
		).catch((f: unknown) => f);
		expect(absage).toMatchObject({ kennung: 'versandfrist_vorbei' });
		const satz = (absage as Error).message;
		expect(satz.split('Die Einladung nennt').length - 1).toBe(1);
		expect(satz).toContain('dieses Traktandums. Die Einladung nennt');
		expect(satz).not.toContain('Ersatz»: Die Einladung');
		// An alle, die eingeladen werden, nicht nur die Eigentümer (Fachprüfung 5).
		expect(satz).toContain('an alle, die zur Versammlung ihrer Gemeinschaft eingeladen werden');
	});

	it('verschiedene Begründungen stehen je einmal, mit den Häusern, für die sie gelten', async () => {
		/*
		 * Zwei Häuser mit 20 Tagen Frist, eines mit 15: Bei einer Versammlung in
		 * zehn Tagen ist bei allen der letzte Tag vorbei, aber nicht derselbe.
		 * Die beiden mit gleicher Frist teilen eine Begründung, das dritte hat
		 * seine eigene.
		 */
		const a = await abend('Einladungsweg, Abend dreimal Frist', [
			{ name: 'Einladungsweg 46', frist: 20 },
			{ name: 'Einladungsweg 47', frist: 20 },
			{ name: 'Einladungsweg 48', frist: 15 }
		]);
		const absage = await setzeErfordernisAmGeschaeft(
			handelnder(betreiber),
			a.tag,
			a.geschaeft,
			'k-verwaltung-gewoehnlich'
		).catch((f: unknown) => f);

		expect(absage).toMatchObject({ kennung: 'versandfrist_vorbei', feld: 'erfordernis' });
		const satz = (absage as Error).message;
		expect(
			satz.startsWith(
				'Die Gemeinschaften «Einladungsweg 46», «Einladungsweg 47» und «Einladungsweg 48» weisen'
			)
		).toBe(true);
		expect(satz.split('Die Einladung nennt').length - 1).toBe(2);
		expect(satz).toContain('Gemeinschaften «Einladungsweg 46» und «Einladungsweg 47»: Die Einladung nennt');
		expect(satz).toContain('Gemeinschaft «Einladungsweg 48»: Die Einladung nennt');
		expect(satz.indexOf('«Einladungsweg 47»: ')).toBeLessThan(satz.indexOf('«Einladungsweg 48»: '));
	});
});

/*
 * **Die Einstellung «Mehr nach Ablauf der Einberufungsfrist milder stellen»**
 * (Migration 148, Produktentscheid 07.10.2026). Vorgabe «nicht zulassen»: die
 * Absage wie bisher. «Zulassen, mit Hinweis»: Die Milderung geht durch, der
 * Haken fällt zurück, und der Hinweis steht in der Lage «Frist vorbei».
 */
describe('Einstellung: milderes Mehr nach Ablauf der Frist', () => {
	it('Vorgabe nicht zulassen: versandfrist_vorbei, nichts geschrieben', async () => {
		const a = await freigegeben('Einladungsweg 60', tageSpaeter(HEUTE, 10), 20);
		expect((await holeGemeinschaft(betreiber, a.gemeinschaft))?.milderungNachFrist).toBe(false);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		await expect(
			haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH)
		).rejects.toMatchObject({ kennung: 'versandfrist_vorbei' });
		expect((await untergrenze(a.traktandum)).released_requirement_relaxed_at).toBeNull();
		expect((await holeVersandvermerk(betreiber, a.versammlung)).gesetzt).toBe(true);
	});

	it('zulassen: die Milderung geht durch, der Haken fällt zurück, der Hinweis nennt «Frist vorbei»', async () => {
		const a = await freigegeben('Einladungsweg 61', tageSpaeter(HEUTE, 10), 20);
		await speichereMilderungNachFrist(handelnder(betreiber), a.gemeinschaft, 'zulassen');
		expect((await holeGemeinschaft(betreiber, a.gemeinschaft))?.milderungNachFrist).toBe(true);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);

		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		const z = await untergrenze(a.traktandum);
		expect(z.released_requirement?.kopfSchwelle).toEqual(EINFACH.kopfSchwelle);
		expect(z.released_requirement_relaxed_at).not.toBeNull();
		expect((await holeVersandvermerk(betreiber, a.versammlung)).gesetzt).toBe(false);

		const h = await holeNeuversandHinweis(betreiber, a.versammlung);
		expect(h).toContain('Der letzte Tag der erfassten Einberufungsfrist war der');
		// Bedingt seit Runde 1 (Fachprüfung B1, 07.10.2026).
		expect(h).toContain('kommt sie nach dieser Frist nicht mehr rechtzeitig an');
		expect(await holeNeuversandLage(betreiber, a.versammlung)).toEqual({ anzahl: 1, fristVorbei: true });

		// Zurückgestellt: wie vor der Frist, der Rückweg ist offen.
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, ZWEIDRITTEL);
		expect((await untergrenze(a.traktandum)).released_requirement?.kopfSchwelle).toEqual(
			ZWEIDRITTEL.kopfSchwelle
		);
		expect(await holeNeuversandHinweis(betreiber, a.versammlung)).toBeNull();
	});

	it('der Schreibweg schreibt den Verlauf und weist einen fremden Wert ab', async () => {
		const a = await freigegeben('Einladungsweg 62', '2027-12-01');
		await speichereMilderungNachFrist(handelnder(betreiber), a.gemeinschaft, 'zulassen');
		await speichereMilderungNachFrist(handelnder(betreiber), a.gemeinschaft, 'nicht');
		const verlauf = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.milderungNachFristGesetzt}
				   AND subject_id = ${a.gemeinschaft}
				 ORDER BY id
			`
		);
		expect(verlauf.map((v) => v.detail)).toEqual([
			{ vorher: 'nicht zulassen', neu: 'zulassen, mit Hinweis' },
			{ vorher: 'zulassen, mit Hinweis', neu: 'nicht zulassen' }
		]);
		await expect(
			speichereMilderungNachFrist(handelnder(betreiber), a.gemeinschaft, 'ja')
		).rejects.toMatchObject({ kennung: 'milderung_nach_frist_unbekannt' });
		expect((await holeGemeinschaft(betreiber, a.gemeinschaft))?.milderungNachFrist).toBe(false);
	});

	it('ein fremder Betreiber findet die Gemeinschaft nicht', async () => {
		const a = await freigegeben('Einladungsweg 63', '2027-12-02');
		const fremd = await pruefbetreiber('Einladungsmehr fremd');
		await expect(
			speichereMilderungNachFrist(
				{ operatorId: fremd, userId: null, label: 'Fremd' },
				a.gemeinschaft,
				'zulassen'
			)
		).rejects.toMatchObject({ kennung: 'unbekannt' });
		expect((await holeGemeinschaft(betreiber, a.gemeinschaft))?.milderungNachFrist).toBe(false);
	});
});

/*
 * **Die Warnung im Saal** (Produktentscheid 07.10.2026, Punkt 4a): Die Daten
 * kommen beim Traktandum an, aus dem Verlaufseintrag beim Eröffnen, nur in
 * einer laufenden Versammlung und nur bei gemilderten Traktanden.
 */
describe('Warnung im Saal nach einer Milderung', () => {
	it('kommt beim gemilderten Traktandum an, mit und ohne Haken', async () => {
		const a = await freigegeben('Einladungsweg 64', '2027-12-03', undefined, true);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		// Vor Beginn keine Warnung im Saal.
		expect((await holeSaalhinweiseNachMilderung(betreiber, a.versammlung)).size).toBe(0);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);

		const w = await holeSaalhinweiseNachMilderung(betreiber, a.versammlung);
		expect([...w.keys()]).toEqual([a.traktandum]);
		const satz = w.get(a.traktandum)!;
		// Wortlaut seit Runde 2 (Produktentscheid 07.10.2026 «2a»).
		expect(satz).toContain(
			'Das Mehr dieses Traktandums ist seit der Freigabe milder als in der Einladung vor der Milderung.'
		);
		// «vor der Milderung» seit Runde 1 (Laienprüfung 4, 07.10.2026).
		expect(satz).toMatch(/Diese nannte [^.]*zwei Drittel/i);
		expect(satz).toContain(
			'Nach der Milderung ist nicht vermerkt, dass sie verschickt ist.'
		);
		// Vorgabe «persoenlich» (Produktentscheid 07.10.2026 zu Fassung 2).
		expect(satz).toContain(
			'Vertretene zählen dafür nach der Einstellung Ihrer Gemeinschaft bei der Freigabe nicht.'
		);
		expect(satz).not.toContain('Ob Vertretene dafür als anwesend zählen');

		const b = await freigegeben('Einladungsweg 65', '2027-12-04');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), b.versammlung, b.traktandum, EINFACH);
		await vermerkeVersand(handelnder(betreiber), b.versammlung, true);
		await eroeffneVersammlung(handelnder(betreiber), b.versammlung);
		expect((await holeSaalhinweiseNachMilderung(betreiber, b.versammlung)).get(b.traktandum)).toMatch(
			/Nach der Milderung als verschickt vermerkt am \d+\. \S+ \d{4}\./
		);
	});

	/*
	 * **Die Einstellung zur Universalversammlung aus der Momentaufnahme**
	 * (Produktentscheid 07.10.2026 zu Fassung 2): Die Ladefunktion reicht
	 * `snapshot.universal_meeting_mode` durch, wie die Universalversammlung im
	 * Saal. Eine Änderung an der Gemeinschaft nach der Freigabe wirkt nicht.
	 * Gegen den Stand davor rot: Dort stand für alle «Ob Vertretene dafür als
	 * anwesend zählen, ist nicht geklärt.».
	 */
	it('reicht die Einstellung zur Universalversammlung aus der Freigabe durch', async () => {
		const a = await freigegeben('Einladungsweg 67', '2027-12-06', undefined, false, {
			universalvariante: 'vertreten'
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		// Nach der Freigabe umgestellt: zählt im Saal nicht.
		await speichereAusnahmen(handelnder(betreiber), a.gemeinschaft, { universalvariante: 'keine' });
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const satz = (await holeSaalhinweiseNachMilderung(betreiber, a.versammlung)).get(a.traktandum)!;
		expect(satz).toContain(
			'Sind alle Eigentümer anwesend oder mit einer Vollmacht für dieses Traktandum vertreten'
		);
		expect(satz).toContain('Prüfen Sie die Vollmachten vor der Abstimmung.');
		expect(satz).not.toContain('Ob Vertretene dafür');
		// Vorgabe: Vollmachten der Leitung zählen nicht (`universal_chair_proxies_count`).
		expect(satz).toContain('Vollmachten, die Sie als Leitung oder Verwaltung halten, zählen dafür nach dieser Einstellung nicht');

		// Mit Häkchen bei der Freigabe entfällt der Zusatz (Schlussprüfung, Codeprüfung).
		const l = await freigegeben('Einladungsweg 69', '2027-12-08', undefined, false, {
			universalvariante: 'vertreten',
			leitungsvollmachtenZaehlen: true
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), l.versammlung, l.traktandum, EINFACH);
		await eroeffneVersammlung(handelnder(betreiber), l.versammlung);
		const mitLeitung = (await holeSaalhinweiseNachMilderung(betreiber, l.versammlung)).get(l.traktandum)!;
		expect(mitLeitung).toContain('Prüfen Sie die Vollmachten vor der Abstimmung.');
		expect(mitLeitung).not.toContain('Leitung oder Verwaltung');

		const k = await freigegeben('Einladungsweg 68', '2027-12-07', undefined, false, {
			universalvariante: 'keine'
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), k.versammlung, k.traktandum, EINFACH);
		await eroeffneVersammlung(handelnder(betreiber), k.versammlung);
		expect((await holeSaalhinweiseNachMilderung(betreiber, k.versammlung)).get(k.traktandum)).toContain(
			'Ob Vertretene dafür zählen, ist nicht geklärt; verlassen Sie sich dafür nur auf persönlich Anwesende.'
		);
	});

	it('ohne Verlaufseintrag (eröffnet vor Migration 148) keine Warnung und kein Fehler', async () => {
		// Gemildert, dann am Eröffnen vorbei auf «laufend» gestellt: wie eine
		// Versammlung, die vor Migration 148 eröffnet wurde und keinen Eintrag hat.
		const a = await freigegeben('Einladungsweg 66', '2027-12-05');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await imKontext(betreiber, (tx) =>
			tx`UPDATE meeting SET state = 'laufend', opened_at = now() WHERE id = ${a.versammlung}`
		);
		expect((await untergrenze(a.traktandum)).released_requirement_relaxed_at).not.toBeNull();
		expect((await holeSaalhinweiseNachMilderung(betreiber, a.versammlung)).size).toBe(0);
	});
});

/*
 * **Befunde der Codeprüfung über Block A, 07.10.2026.**
 */
describe('Eröffnen nach Milderung: die Warnung rechnet im Saal laufend nach', () => {
	/*
	 * **Produktentscheid 07.10.2026, «Die Warnung rechnet im Saal laufend
	 * nach».** Milderung, Haken, dann wieder zwei Dritteln: Beim Eröffnen gibt
	 * es den Eintrag, aber keine Warnung. Stellt die Leitung im Saal auf das
	 * mildere Mehr (die Untergrenze lässt es zu), erscheint sie; wieder strenger,
	 * verschwindet sie. Gegen den Stand davor rot: Dort gab es ohne milderes Mehr
	 * beim Eröffnen keinen Eintrag und damit nie eine Warnung.
	 */
	it('Milderung, Haken, zurück auf zwei Drittel: Eintrag beim Eröffnen, Warnung nur solange milder', async () => {
		const a = await freigegeben('Einladungsweg 70', '2027-12-10');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, ZWEIDRITTEL);
		const z = await untergrenze(a.traktandum);
		expect(z.released_requirement?.kopfSchwelle).toEqual(EINFACH.kopfSchwelle);
		expect(z.requirement_head_numerator).toBe(2);

		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		// (2) Der Eintrag auch, wenn das Traktandum beim Eröffnen strenger steht.
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.einladungsmehrBeimEroeffnen}
				   AND subject_id = ${a.traktandum}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(String(eintraege[0].detail.mehrJetzt)).toMatch(/zwei Drittel/i);
		expect(String(eintraege[0].detail.einladungDavor)).toMatch(/zwei Drittel/i);
		expect((eintraege[0].detail.einladungDavorMass as Erfordernis).kopfSchwelle).toEqual(
			ZWEIDRITTEL.kopfSchwelle
		);
		expect((await holeSaalhinweiseNachMilderung(betreiber, a.versammlung)).size).toBe(0);

		// Im Saal auf das mildere Mehr: Die Warnung erscheint.
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		expect((await holeSaalhinweiseNachMilderung(betreiber, a.versammlung)).get(a.traktandum)).toContain(
			'Nach der Milderung als verschickt vermerkt am'
		);

		// Wieder strenger: weg.
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, DREIVIERTEL);
		expect((await holeSaalhinweiseNachMilderung(betreiber, a.versammlung)).size).toBe(0);
	});

	it('das Vergleichsmass steht nicht in den Angaben des Verlaufs, die Worte schon', async () => {
		const a = await freigegeben('Einladungsweg 73', '2027-12-13');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const [e] = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.einladungsmehrBeimEroeffnen}
				   AND subject_id = ${a.traktandum}
			`
		);
		const zeile = angabenInWorten(e.detail);
		expect(zeile).toContain('Mehr der Einladung davor: ');
		expect(zeile).toContain('Mehr beim Eröffnen: ');
		expect(zeile).not.toContain('Vergleichsmass');
		expect(zeile).not.toContain('kopfbasis');
	});

	it('«Mehr beim Eröffnen» ist das Mehr, das das Traktandum trägt', async () => {
		const a = await freigegeben('Einladungsweg 71', '2027-12-11');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const [e] = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.einladungsmehrBeimEroeffnen}
				   AND subject_id = ${a.traktandum}
			`
		);
		expect(String(e.detail.mehrJetzt)).toMatch(/Hälfte/);
	});

	/*
	 * Der letzte Vermerk nach der Milderung zählt, nicht der erste: A gemildert
	 * und vermerkt, B gemildert (schliesst A ab, nimmt den Haken ohne
	 * Vermerk-Eintrag zurück), dann der Haken gesetzt und von Hand entfernt.
	 * Mit dem ersten Eintrag stand bei A «vermerkt» für einen Haken, den es
	 * beim Eröffnen nicht mehr gab.
	 */
	/*
	 * **Codeprüfung Block A, zweite Runde, M1.** A gemildert, Haken, dann B
	 * gemildert: `achteEinladungsmehr` schliesst A ab und leert dessen Mehr
	 * davor. Beim Eröffnen fehlte dann das Vergleichsmass, und der Saal warnte bei
	 * A immer, auch auf zwei Dritteln. Jetzt kommt das Mass aus dem
	 * Milderungseintrag. Gegen den Stand davor rot.
	 */
	it('A gemildert, Haken, B gemildert: die Warnung bei A rechnet gegen das Mass aus dem Milderungseintrag', async () => {
		const a = await freigegeben('Einladungsweg 74', '2027-12-14', undefined, true);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.ohne, EINFACH);
		const [davor] = await imKontext(betreiber, (tx) =>
			tx<{ b: unknown }[]>`SELECT released_requirement_before AS b FROM agenda_item WHERE id = ${a.traktandum}`
		);
		expect(davor.b).toBeNull();
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);

		const [e] = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.einladungsmehrBeimEroeffnen}
				   AND subject_id = ${a.traktandum}
			`
		);
		expect((e.detail.einladungDavorMass as Erfordernis | null)?.kopfSchwelle).toEqual(
			ZWEIDRITTEL.kopfSchwelle
		);

		// Auf dem milderen Mehr: Warnung bei beiden.
		expect([...(await holeSaalhinweiseNachMilderung(betreiber, a.versammlung)).keys()].sort()).toEqual(
			[a.traktandum, a.ohne].sort()
		);
		// A auf zwei Drittel: bei A keine Warnung mehr, bei B weiter.
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, ZWEIDRITTEL);
		expect([...(await holeSaalhinweiseNachMilderung(betreiber, a.versammlung)).keys()]).toEqual([a.ohne]);
		// Wieder auf das einfache Mehr: die Warnung bei A ist zurück.
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		expect((await holeSaalhinweiseNachMilderung(betreiber, a.versammlung)).has(a.traktandum)).toBe(true);
	});

	it('der letzte Vermerk-Eintrag nach der Milderung zählt, nicht der erste', async () => {
		const a = await freigegeben('Einladungsweg 72', '2027-12-12', undefined, true);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACH);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.ohne, EINFACH);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, true);
		await vermerkeVersand(handelnder(betreiber), a.versammlung, false);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const [e] = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.einladungsmehrBeimEroeffnen}
				   AND subject_id = ${a.traktandum}
			`
		);
		expect(e.detail).toMatchObject({ versandVermerkt: false, vermerktAm: null });
	});
});
