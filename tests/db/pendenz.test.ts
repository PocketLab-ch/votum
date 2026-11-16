/**
 * Pendenzen an der Datenbank (Migration 106).
 *
 * Die Regeln des Kerns prüft `tests/domain/pendenz`. Hier steht, was sich nur
 * an der Datenbank zeigt: dass die Herkunft eine echte Klammer ist, dass die
 * Mandantengrenze hält — und **dass das Siegel sie nicht sperrt**. Das letzte
 * ist die eine Zusicherung, um die es bei dieser Tabelle geht: Eine Pendenz
 * wird Monate nach der Sitzung abgehakt, und wäre sie dann gesperrt, gäbe es
 * sie umsonst.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung, eroeffneVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { alsBetreiber } from '$lib/server/db';
import {
	aenderePendenz,
	entfernePendenz,
	erfassePendenz,
	holePendenzen,
	setzePendenzzustand
} from '$lib/server/pendenz';
import { leseVerlauf } from '$lib/server/verlaufsabfrage';
import { nurAngaben } from '$lib/server/protokoll';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let betreiberB: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Eine laufende Versammlung mit einem Traktandum. */
async function aufbau(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: 'keiner'
	});
	const e = await erstelleEinheit(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna Muster',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');

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
		titel: 'Rampe beim Hauseingang',
		art: 'abstimmung',
		antragswortlaut: 'Die Rampe wird gemäss Offerte erstellt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Pendenz A');
	betreiberB = await pruefbetreiber('Pendenz B');
	benutzer = await pruefbenutzer(betreiber, 'pruefleitung');
});

afterAll(verbindungenSchliessen);

describe('Erfassen', () => {
	it('hält Zusage, Zuständigkeit und Frist fest', async () => {
		const a = await aufbau('Prüflauf Pendenz 1', '2027-10-01');
		const p = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: '  Offerten für die Rampe einholen  ',
			verantwortlich: '  die Bewirtschaftung ',
			fristArt: 'datum',
			fristDatum: '2027-12-31'
		});
		expect(p.text).toBe('Offerten für die Rampe einholen');
		expect(p.verantwortlich).toBe('die Bewirtschaftung');
		expect(p.fristDatum).toBe('2027-12-31');
		expect(p.zustand).toBe('offen');

		const nach = await holePendenzen(betreiber, a.versammlung);
		expect(nach.get(a.traktandum)?.map((x) => x.id)).toEqual([p.id]);
	});

	/*
	 * **Die Zeitzone ist der Fallstrick an einer `date`-Spalte.** Der Treiber
	 * liefert sie als Mitternacht in UTC; durch `tagVon` geschickt, käme in
	 * hiesiger Zeit der 30. heraus. Deshalb steht `kalendertag` im Serverteil,
	 * und deshalb misst diese Probe den Silvestertag.
	 */
	it('gibt die Frist als den Tag zurück, der eingetragen wurde', async () => {
		const a = await aufbau('Prüflauf Pendenz 2', '2027-10-02');
		const p = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Techniker aufbieten',
			fristArt: 'datum',
			fristDatum: '2027-12-31'
		});
		const nach = await holePendenzen(betreiber, a.versammlung);
		expect(nach.get(a.traktandum)?.[0].fristDatum).toBe('2027-12-31');
		expect(p.fristDatum).toBe('2027-12-31');
	});

	it('nimmt eine Pendenz ohne Namen und ohne Termin', async () => {
		const a = await aufbau('Prüflauf Pendenz 3', '2027-10-03');
		const p = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Wird abgeklärt',
			verantwortlich: '',
			fristArt: 'keine'
		});
		expect(p.verantwortlich).toBeNull();
		expect(p.fristDatum).toBeNull();
		expect(p.fristArt).toBe('keine');
	});

	/*
	 * **Die Herkunft ist eine Klammer, kein Paar einzelner Verweise.** Ohne die
	 * Bindung in der Abfrage liesse sich eine Pendenz an das Traktandum einer
	 * fremden Versammlung hängen; die Schranke `pendenz_herkunft_traktandum`
	 * hielte sie auf, aber als rohe Datenbankmeldung auf einer Fehlerseite.
	 */
	it('weist ein Traktandum aus einer anderen Versammlung ab', async () => {
		const a = await aufbau('Prüflauf Pendenz 4', '2027-10-04');
		const b = await aufbau('Prüflauf Pendenz 5', '2027-10-05');
		await expect(
			erfassePendenz(handelnder(betreiber), a.versammlung, b.traktandum, {
				text: 'Gehört woanders hin',
				fristArt: 'keine'
			})
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
	});

	it('bleibt hinter der Mandantengrenze', async () => {
		const a = await aufbau('Prüflauf Pendenz 6', '2027-10-06');
		await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Nur für A sichtbar',
			fristArt: 'keine'
		});
		const fremd = await holePendenzen(betreiberB, a.versammlung);
		expect(fremd.size).toBe(0);
	});
});

describe('Zustand', () => {
	it('hakt ab, lässt verfallen und öffnet wieder', async () => {
		const a = await aufbau('Prüflauf Pendenz 7', '2027-10-07');
		const p = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Elektriker kontaktieren',
			fristArt: 'naechste_versammlung'
		});

		const erledigt = await setzePendenzzustand(
			handelnder(betreiber),
			a.versammlung,
			p.id,
			'erledigt',
			'am 12.11. erledigt'
		);
		expect(erledigt.zustand).toBe('erledigt');
		expect(erledigt.abschlussNotiz).toBe('am 12.11. erledigt');

		const verfallen = await setzePendenzzustand(
			handelnder(betreiber),
			a.versammlung,
			p.id,
			'hinfaellig',
			'hat sich nicht mehr gemeldet'
		);
		expect(verfallen.zustand).toBe('hinfaellig');

		// **Beim Wiederöffnen fällt die Notiz weg** — sonst stünde unter einer
		// offenen Pendenz, warum sie erledigt sei. Die Schranke
		// `pendenz_notiz_nur_beim_abschluss` verlangt es, der Kern setzt es um.
		const wieder = await setzePendenzzustand(
			handelnder(betreiber),
			a.versammlung,
			p.id,
			'offen',
			'bleibt trotzdem stehen?'
		);
		expect(wieder.zustand).toBe('offen');
		expect(wieder.abschlussNotiz).toBeNull();
	});

	/**
	 * **Die Zusicherung, für die es diese Tabelle gibt.**
	 *
	 * Am Durchgang ist nach dem Siegel Schluss, an der Anwesenheit auch. Die
	 * Pendenz ist ausgenommen, weil sie gerade dann abgehakt wird — meist an der
	 * nächsten Versammlung, ein Jahr später. Der Zustand wird direkt gesetzt:
	 * Geprüft wird die Ausnahme, nicht der Weg zum Siegel.
	 */
	it('lässt sich auch an einer versiegelten Versammlung noch abhaken', async () => {
		const a = await aufbau('Prüflauf Pendenz 8', '2027-10-08');
		const p = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Rechnung prüfen',
			fristArt: 'naechste_versammlung'
		});
		await imKontext(betreiber, (tx) =>
			tx`UPDATE meeting SET state = 'versiegelt', closed_at = now() WHERE id = ${a.versammlung}`
		);

		const erledigt = await setzePendenzzustand(
			handelnder(betreiber),
			a.versammlung,
			p.id,
			'erledigt'
		);
		expect(erledigt.zustand).toBe('erledigt');

		// Und eine neue lässt sich ebenfalls noch erfassen: Was jemand zugesagt
		// hat, fällt gelegentlich erst beim Redigieren des Protokolls auf.
		const spaet = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Beim Redigieren aufgefallen',
			fristArt: 'keine'
		});
		expect(spaet.zustand).toBe('offen');
	});

	it('legt keinen zweiten Verlaufseintrag an, wenn sich nichts ändert', async () => {
		const a = await aufbau('Prüflauf Pendenz 9', '2027-10-09');
		const p = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Doppelt gesetzt',
			fristArt: 'keine'
		});
		const erst = await setzePendenzzustand(handelnder(betreiber), a.versammlung, p.id, 'erledigt');
		const zweit = await setzePendenzzustand(handelnder(betreiber), a.versammlung, p.id, 'erledigt');
		expect(zweit.zustandSeit).toBe(erst.zustandSeit);

		const [{ anzahl }] = await alsBetreiber(betreiber, async (tx) => {
			return tx<{ anzahl: string }[]>`
				SELECT count(*) AS anzahl FROM audit_entry
				 WHERE event_type = 'todo.state.set' AND detail->>'pendenz' = ${p.id}
			`;
		});
		expect(Number(anzahl)).toBe(1);
	});
});

/**
 * **Der Verlauf ist die einzige Spur, wenn die Zeile weg ist.**
 *
 * Der erste Anlauf setzte die Pendenzkennung als Gegenstand des Ereignisses.
 * Damit fielen alle vier aus jedem gefilterten Verlauf heraus: `gehoertZu` löst
 * den Gegenstand über seine Tabelle zur Versammlung auf, und beim Entfernen ist
 * die Zeile weg — die Auflösung könnte sie nie wiederfinden. Sie hängen deshalb
 * am Traktandum, das überlebt.
 *
 * Die Probe misst genau das, und zwar am **entfernten** Fall: Er ist der, den
 * ein Nachtragen in `gehoertZu` nicht gerettet hätte.
 */
describe('Verlauf', () => {
	it('zeigt auch die entfernte Pendenz im Verlauf dieser Versammlung', async () => {
		const a = await aufbau('Prüflauf Pendenz 14', '2027-10-14');
		const p = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Sollte im Verlauf stehen',
			fristArt: 'keine'
		});
		await entfernePendenz(handelnder(betreiber), a.versammlung, p.id);

		const { zeilen } = await leseVerlauf(betreiber, { versammlung: a.versammlung });
		const arten = zeilen.map((z) => z.art);
		expect(arten).toContain('todo.recorded');
		expect(arten).toContain('todo.removed');
		const weg = zeilen.find((z) => z.art === 'todo.removed');
		expect(weg?.angaben.wortlaut).toBe('Sollte im Verlauf stehen');
		expect(weg?.angaben.pendenz).toBe(p.id);
	});

	it('zeigt sie auch im Verlauf der Gemeinschaft', async () => {
		const a = await aufbau('Prüflauf Pendenz 15', '2027-10-15');
		await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Auch über die Gemeinschaft auffindbar',
			fristArt: 'keine'
		});
		const { zeilen } = await leseVerlauf(betreiber, { gemeinschaft: a.gemeinschaft });
		expect(zeilen.map((z) => z.art)).toContain('todo.recorded');
	});
});

/**
 * **Was ins Protokoll geht, und was nicht** (Sicherheitsprüfung 09.09.2026).
 *
 * `Pendenzangabe` hat vier Felder, `Pendenz` neun — und TypeScript lässt die
 * grössere Form strukturell überall dort zu, wo die kleinere verlangt ist. Ohne
 * das Kappen lägen `zustand` und `abschlussNotiz` zur Laufzeit in der
 * Protokolleingabe, obwohl der Renderer sie nie liest. Diese Probe misst die
 * Schlüssel und nicht die Ausgabe: Der Renderer ist heute richtig, und genau
 * deshalb würde eine Probe über seinen Text auch dann grün bleiben, wenn das
 * Kappen wegfiele.
 */
describe('Was ins Protokoll geht', () => {
	it('kappt die Pendenz auf die vier Felder, die der Satz braucht', async () => {
		const a = await aufbau('Prüflauf Pendenz 16', '2027-10-16');
		const p = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Nicht alles gehört ins Protokoll',
			fristArt: 'keine'
		});
		await setzePendenzzustand(
			handelnder(betreiber),
			a.versammlung,
			p.id,
			'hinfaellig',
			'war nicht erreichbar'
		);
		const [gekappt] = nurAngaben((await holePendenzen(betreiber, a.versammlung)).get(a.traktandum));
		expect(Object.keys(gekappt).sort()).toEqual([
			'fristArt',
			'fristDatum',
			'text',
			'verantwortlich'
		]);
		// Ausdrücklich die beiden, die nicht ins Protokoll dürfen.
		expect(gekappt).not.toHaveProperty('zustand');
		expect(gekappt).not.toHaveProperty('abschlussNotiz');
	});
});

describe('Ändern und entfernen', () => {
	it('ändert Wortlaut und Frist, ohne den Zustand anzufassen', async () => {
		const a = await aufbau('Prüflauf Pendenz 10', '2027-10-10');
		const p = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Offerte einholen',
			fristArt: 'keine'
		});
		await setzePendenzzustand(handelnder(betreiber), a.versammlung, p.id, 'erledigt', 'erledigt');
		const neu = await aenderePendenz(handelnder(betreiber), a.versammlung, p.id, {
			text: 'Zwei Offerten einholen',
			verantwortlich: 'der Ausschuss',
			fristArt: 'naechste_versammlung'
		});
		expect(neu.text).toBe('Zwei Offerten einholen');
		expect(neu.zustand).toBe('erledigt');
		expect(neu.abschlussNotiz).toBe('erledigt');
	});

	/*
	 * **Abgeschlossenes bleibt stehen.** Dass etwas getan wurde oder still
	 * verfallen ist, hat sonst niemand festgehalten; wer die Zeile wegräumt,
	 * nimmt genau diese Auskunft mit.
	 */
	it('entfernt nur, was offen ist', async () => {
		const a = await aufbau('Prüflauf Pendenz 11', '2027-10-11');
		const offen = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Vertippt',
			fristArt: 'keine'
		});
		await entfernePendenz(handelnder(betreiber), a.versammlung, offen.id);
		expect((await holePendenzen(betreiber, a.versammlung)).size).toBe(0);

		const zu = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Schon erledigt',
			fristArt: 'keine'
		});
		await setzePendenzzustand(handelnder(betreiber), a.versammlung, zu.id, 'erledigt');
		await expect(
			entfernePendenz(handelnder(betreiber), a.versammlung, zu.id)
		).rejects.toThrow(/abgeschlossen/);
	});

	it('weist eine Pendenz aus einer anderen Versammlung ab', async () => {
		const a = await aufbau('Prüflauf Pendenz 12', '2027-10-12');
		const b = await aufbau('Prüflauf Pendenz 13', '2027-10-13');
		const p = await erfassePendenz(handelnder(betreiber), a.versammlung, a.traktandum, {
			text: 'Gehört zu A',
			fristArt: 'keine'
		});
		await expect(
			setzePendenzzustand(handelnder(betreiber), b.versammlung, p.id, 'erledigt')
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
		await expect(entfernePendenz(handelnder(betreiber), b.versammlung, p.id)).rejects.toThrow(
			/gehört nicht zu dieser Versammlung/
		);
	});
});
