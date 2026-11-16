/**
 * Betroffene im Saal und die Vorab-Zustimmung (Block A2, 25.09.2026;
 * ZGB Art. 712g Abs. 4, Art. 712e Abs. 2).
 *
 * **Die Kette, auf die es ankommt:** im Saal eingetragen → vorab vermerkt →
 * beim Schliessen eingefroren → in der Auszählung als Zustimmung gezählt, und
 * durch ein Nein im Saal widerrufen. Reisst sie, steht ein Beschluss angenommen
 * oder abgelehnt da, ohne dass jemand es an einer Zahl merkt.
 *
 * **Und die Schranken des neuen Schreibwegs**, je Handlung: Eine neue
 * Schreibstelle erbt die Sperre «nur im Entwurf» nicht, unter der diese
 * Tabelle bis Migration 124 stand.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei, nimmVersammlungsfreigabeZurueck } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	bearbeiteTraktandum,
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden
} from '$lib/server/traktanden';
import {
	erfasseSummen,
	gibStimmenAb,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import {
	holeBetroffene,
	nimmVorabZustimmungZurueck,
	trageBetroffeneAus,
	trageBetroffeneEin,
	vermerkeVorabZustimmung
} from '$lib/server/betroffene';
import { waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { schreibeErfordernisIn } from '$lib/server/erfordernisse';
import { erklaereAusstand } from '$lib/server/ausstand';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { erstelleNutzniessung } from '$lib/server/nutzniessung';
import { nimmImSaalAuf } from '$lib/server/saalaufnahme';
import { betroffenenabweichung } from '$lib/domain/folgeantrag';
import { holeAuswertung } from '$lib/server/auswertung';
import { erzeugeAuswertung } from '$lib/server/pdf/auswertung';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { actions as leitungVersammlung } from '../../src/routes/versammlungen/[id=kennung]/leitung/+page.server';
import { actions as leitungAbend } from '../../src/routes/tage/[id=kennung]/leitung/+page.server';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Das Erfordernis eines Knotens aus der geltenden Fassung, wie im Betrieb. */
function erfordernisVon(knotenId: string): Erfordernis {
	const e = waehleErfordernis(holeRegelwerk(), knotenId).ergebnis;
	if (!e) throw new Error(`Knoten ${knotenId} liefert in der geltenden Fassung kein Erfordernis`);
	return e;
}

/** Nutzungsrechte zuteilen (ZGB Art. 712g Abs. 4): im Saal oder vorab. */
const NUTZUNGSRECHT = 'k-nutzungsrecht-zuteilung';
/** Wertquoten ändern (Art. 712e Abs. 2): die Zustimmung kommt nachher. */
const WERTQUOTEN = 'k-wertquoten-aendern';

/**
 * Siehe `ausstand.test.ts`: Seit dem 25.09.2026 liest `ergebnisIn` ein
 * verkündetes Ergebnis aus `result_json`. Die Proben zum Einfrieren liefen
 * sonst nur durch den Lesezweig und blieben grün, auch wenn das Einfrieren
 * kaputtginge.
 */
async function ohneFestschreibung(durchgang: string) {
	await admin.begin(async (tx) => {
		await tx`SET LOCAL session_replication_role = replica`;
		await tx`UPDATE voting_round SET result_json = NULL WHERE id = ${durchgang}`;
	});
}

/**
 * Vier Eigentümer zu je 250 (Aebi, Bucher, Christen, Duss), alle anwesend,
 * die Versammlung läuft, das Traktandum mit dem Erfordernis `knoten` ist
 * aufgerufen. **Niemand ist als betroffen zugeordnet**: Genau das ist die Lage,
 * für die der Schreibweg im Saal gebaut ist.
 *
 * `mehrImSaal`: Das Erfordernis kommt erst nach der Eröffnung an das
 * Traktandum. Dann nennt die Einladung keines, und es gibt keine Untergrenze
 * (Migration 144); ein Folgeantrag darf darunter jedes Mehr wählen.
 */
async function laufend(
	name: string,
	datum: string,
	knoten = NUTZUNGSRECHT,
	eroeffnen = true,
	mehrImSaal = false,
	abend = false,
	/** Eine vor der Freigabe erfasste Nutzniessung an Whg 4 (Duss), mit diesem Namen. */
	nutzniesserWhg4: string | null = null
) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	const einheiten: string[] = [];
	for (const [i, wer] of ['Aebi', 'Bucher', 'Christen', 'Duss'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 250 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
		einheiten.push(e.id);
		if (i === 3 && nutzniesserWhg4) {
			await erstelleNutzniessung(handelnder(betreiber), {
				unitId: e.id,
				holderName: nutzniesserWhg4,
				validFrom: '2021-01-01',
				hasAgreement: false,
				contractOnFile: true
			});
		}
	}

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	// Für die Aktionen unter `/tage/<id>`: die Versammlung als Haus eines Abends.
	let tagId: string | null = null;
	if (abend) {
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: `${name}, Abend`,
			datum,
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			anlass: null
		});
		await nimmInTagAuf(handelnder(betreiber), tag.id, v.id, 0);
		tagId = tag.id;
	}
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Sondernutzungsrecht am Gartensitzplatz',
		art: 'abstimmung',
		antragswortlaut: 'Der Gartensitzplatz wird Whg 4 zur ausschliesslichen Nutzung zugewiesen.',
		antragstellerart: 'bewirtschaftung'
	});
	if (!mehrImSaal) {
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, erfordernisVon(knoten));
	}

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	if (!eroeffnen) return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien, einheiten, tagId };
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	if (mehrImSaal) {
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, erfordernisVon(knoten));
	}
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}
	await stelleAufTraktandum(handelnder(betreiber), v.id, t.id);

	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien, einheiten, tagId };
}

/** Alle vier stimmen; `duss` ist die Stimme der betroffenen Partei. */
async function abstimmen(
	s: Awaited<ReturnType<typeof laufend>>,
	duss: 'yes' | 'no' | 'abstain' | null,
	geheim = false
) {
	await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum, {
		geheim,
		geheimBeschlossen: geheim
	});
	await gibStimmenAb(
		handelnder(betreiber),
		s.versammlung,
		[
			{ parteiId: s.parteien[0], wahl: 'yes' as const },
			{ parteiId: s.parteien[1], wahl: 'yes' as const },
			{ parteiId: s.parteien[2], wahl: 'yes' as const },
			...(duss ? [{ parteiId: s.parteien[3], wahl: duss }] : [])
		],
		true,
		'Prüflauf: von der Sitzungsleitung erfasst'
	);
	const d = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
	const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, d.id);
	return { durchgang: d.id, a: auszaehlung! };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Betroffene');
	benutzer = await pruefbenutzer(betreiber, 'betroffenenleitung');
});

afterAll(verbindungenSchliessen);

describe('Die Form der Zustimmung am Traktandum', () => {
	it('wird gespeichert, gelesen und beim Öffnen eingefroren', async () => {
		/*
		 * Bis Migration 124 speicherte `schreibeErfordernisIn` das Feld nicht,
		 * und die Form hing allein an der Kennung des Knotens. Die Probe liest
		 * über den Leseweg der Anwendung und das eingefrorene JSON am Durchgang.
		 */
		const s = await laufend('Betroffene Form', '2027-06-01', WERTQUOTEN);
		const [spalte] = await admin<{ form: string | null }[]>`
			SELECT requirement_affected_consent_form AS form FROM agenda_item WHERE id = ${s.traktandum}
		`;
		expect(spalte.form).toBe('nachher');

		const liste = await holeTraktanden(betreiber, s.versammlung);
		const zeile = liste.find((x) => x.knoten.id === s.traktandum);
		if (!zeile) throw new Error('Traktandum fehlt in der gelesenen Liste');
		expect(zeile.knoten.erfordernis?.betroffenenzustimmung).toBe('nachher');

		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		const [d] = await admin<{ form: string | null }[]>`
			SELECT requirement_json->>'betroffenenzustimmung' AS form FROM voting_round
			WHERE agenda_item_id = ${s.traktandum}
		`;
		expect(d.form).toBe('nachher');
	});
});

describe('Die Form über den zweiten Schreibweg', () => {
	it('schreibt auch `schreibeErfordernisIn` sie ans Traktandum', async () => {
		/*
		 * Das Erfordernis hat zwei Schreiber: `haltErfordernisAmTraktandumFest`
		 * (die Probe darüber) und `schreibeErfordernisIn` für Pflichttraktanden,
		 * Musterübernahme, Geschäfte am Abend und das Nachziehen nach einer
		 * Reglementsänderung. Die Gegenprobe vom 25.09.2026 zeigte: Ohne diese
		 * Probe blieb die zweite Stelle ungeprüft, und die Probe darüber war
		 * grün, auch wenn sie das Feld nicht schrieb.
		 */
		/*
		 * **Vor Beginn, nicht im Saal** (06.10.2026). Wertquoten ändern ist in
		 * einem Punkt milder als das gedruckte Mehr der Nutzungsrechte, und im
		 * Saal weist die Schreibstelle das seit Migration 144 ab
		 * (`einladungsmehr.ts`). Diese Probe gilt dem Feld, nicht dem Zustand;
		 * vor Beginn ist die Milderung zulässig.
		 */
		const s = await laufend('Betroffene Form 2', '2027-06-01', NUTZUNGSRECHT, false);
		await imKontext(betreiber, (tx) =>
			schreibeErfordernisIn(tx, handelnder(betreiber), s.traktandum, erfordernisVon(WERTQUOTEN))
		);
		const [spalte] = await admin<{ form: string | null }[]>`
			SELECT requirement_affected_consent_form AS form FROM agenda_item WHERE id = ${s.traktandum}
		`;
		expect(spalte.form).toBe('nachher');
	});
});

describe('Betroffene im Saal eintragen', () => {
	it('hebt die Sperre auf, die ohne Betroffene das Eröffnen abweist', async () => {
		const s = await laufend('Betroffene 1', '2027-06-02');
		// Gegenprobe: ohne Eintrag bleibt die Abstimmung gesperrt, und der Satz
		// nennt den Weg über das Eintragen (seit Block A2b).
		await expect(
			oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum)
		).rejects.toThrow(/eingetragen ist aber niemand\. Tragen Sie sie unter «Jetzt möglich» bei «Betroffene» ein/);

		const namen = await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [
			s.parteien[3]
		]);
		expect(namen).toEqual(['Duss']);
		const liste = await holeBetroffene(betreiber, s.versammlung, s.traktandum);
		expect(liste).toEqual([
			{
				parteiId: s.parteien[3],
				name: 'Duss',
				eingetragenDurch: 'Prüflauf',
				vorab: null,
				// Seit Migration 132: Alleineigentum, und die Vorgabe «nur eine Person».
				gemeinsam: false,
				alleEigentuemerBeklagt: false
			}
		]);

		await expect(
			oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum)
		).resolves.toBeDefined();
	});

	it('zählt ein Ja im Saal als Zustimmung, eine Enthaltung nicht', async () => {
		const ja = await laufend('Betroffene 2', '2027-06-03');
		await trageBetroffeneEin(handelnder(betreiber), ja.versammlung, ja.traktandum, [ja.parteien[3]]);
		expect((await abstimmen(ja, 'yes')).a.angenommen).toBe(true);

		const enthalten = await laufend('Betroffene 3', '2027-06-04');
		await trageBetroffeneEin(handelnder(betreiber), enthalten.versammlung, enthalten.traktandum, [
			enthalten.parteien[3]
		]);
		const { a } = await abstimmen(enthalten, 'abstain');
		expect(a.angenommen).toBe(false);
		expect(a.betroffene.fehlend).toEqual([
			{ parteiId: enthalten.parteien[3], name: 'Duss', grund: 'enthaltung' }
		]);
	});

	it('steht im Verlauf, mit Partei, Traktandum und Person, auch das Austragen', async () => {
		const s = await laufend('Betroffene 4', '2027-06-05');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await trageBetroffeneAus(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3]);

		expect(await holeBetroffene(betreiber, s.versammlung, s.traktandum)).toEqual([]);
		const eintraege = await admin<
			{ event_type: string; detail: Record<string, unknown>; actor_label: string | null }[]
		>`
			SELECT event_type, detail, actor_label FROM audit_entry
			WHERE subject_id = ${s.traktandum} AND event_type LIKE 'agenda.item.affected.%'
			ORDER BY id
		`;
		expect(eintraege.map((e) => e.event_type)).toEqual([
			'agenda.item.affected.added',
			'agenda.item.affected.removed'
		]);
		for (const e of eintraege) {
			expect(e.detail.partei).toBe('Duss');
			expect(e.detail.traktandum).toBe('Sondernutzungsrecht am Gartensitzplatz');
			expect(e.actor_label).toBe('Prüflauf');
		}
	});
});

describe('Die Vorab-Zustimmung', () => {
	it('zählt als Zustimmung, wenn die Betroffene sich enthält oder nicht abstimmt', async () => {
		const s = await laufend('Vorab 1', '2027-06-10');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Schreiben vom 12.09.2026'
		);
		const liste = await holeBetroffene(betreiber, s.versammlung, s.traktandum);
		expect(liste[0].vorab?.vermerk).toBe('Schreiben vom 12.09.2026');
		expect(liste[0].vorab?.erfasstDurch).toBe('Prüflauf');

		const { a } = await abstimmen(s, 'abstain');
		expect(a.angenommen).toBe(true);
		expect(a.betroffene.zugestimmt).toEqual([s.parteien[3]]);
		expect(a.betroffene.vorab).toEqual([s.parteien[3]]);
		expect(a.betroffene.fehlend).toEqual([]);

		// Und bei Nichtabgabe ebenso: Sie ist keine Äusserung.
		const ohne = await laufend('Vorab 2', '2027-06-11');
		await trageBetroffeneEin(handelnder(betreiber), ohne.versammlung, ohne.traktandum, [
			ohne.parteien[3]
		]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			ohne.versammlung,
			ohne.traktandum,
			ohne.parteien[3],
			'E-Mail vom 20.09.2026'
		);
		expect((await abstimmen(ohne, null)).a.angenommen).toBe(true);
	});

	it('wird durch ein Nein im Saal widerrufen', async () => {
		/*
		 * **Produktentscheid 25.09.2026:** Die jüngste Äusserung gilt. Die
		 * Widerrufssätze auf Leinwand und im Protokoll werden erst mit diesem
		 * Schreibweg erreichbar.
		 */
		const s = await laufend('Vorab 3', '2027-06-12');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Schreiben vom 12.09.2026'
		);
		const { a } = await abstimmen(s, 'no');
		expect(a.angenommen).toBe(false);
		expect(a.betroffene.fehlend).toEqual([
			{ parteiId: s.parteien[3], name: 'Duss', grund: 'widerrufen' }
		]);
		expect(a.betroffene.vorab).toEqual([]);
	});

	it('bleibt ohne Wirkung, wenn sie vor dem Öffnen zurückgenommen wird', async () => {
		// Gegenprobe zur ersten Probe: dieselbe Lage ohne Vermerk ist abgelehnt.
		const s = await laufend('Vorab 4', '2027-06-13');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Schreiben vom 12.09.2026'
		);
		await nimmVorabZustimmungZurueck(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3]);
		const { a } = await abstimmen(s, 'abstain');
		expect(a.angenommen).toBe(false);
		expect(a.betroffene.fehlend[0].grund).toBe('enthaltung');

		const eintraege = await admin<{ event_type: string; detail: Record<string, unknown> }[]>`
			SELECT event_type, detail FROM audit_entry
			WHERE subject_id = ${s.traktandum} AND event_type LIKE 'agenda.item.affected.consent.%'
			ORDER BY id
		`;
		expect(eintraege.map((e) => e.event_type)).toEqual([
			'agenda.item.affected.consent.noted',
			'agenda.item.affected.consent.removed'
		]);
		expect(eintraege[1].detail.vermerk).toBe('Schreiben vom 12.09.2026');
	});

	it('übersteht das Speichern des Traktandenformulars nach zurückgenommener Freigabe', async () => {
		/*
		 * Bis Migration 124 löschte `schreibeBetroffene` alle Zeilen und schrieb
		 * sie neu. Seit die Zeile einen Vermerk trägt, verlöre jedes Speichern im
		 * Entwurf ihn still. Vermerkt wird ab der Freigabe; wird sie
		 * zurückgenommen, läuft das Formular wieder über dieselbe Zeile.
		 */
		const s = await laufend('Vorab Entwurf', '2027-06-17', NUTZUNGSRECHT, false);
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Schreiben vom 12.09.2026'
		);
		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), s.versammlung, 'Prüflauf');
		await bearbeiteTraktandum(handelnder(betreiber), s.versammlung, s.traktandum, {
			meetingId: s.versammlung,
			titel: 'Sondernutzungsrecht am Gartensitzplatz, bereinigt',
			art: 'abstimmung',
			antragswortlaut: 'Der Gartensitzplatz wird Whg 4 zur ausschliesslichen Nutzung zugewiesen.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: [s.parteien[3], s.parteien[2]]
		});
		const [zeile] = await admin<{ vorab_vermerk: string | null }[]>`
			SELECT vorab_vermerk FROM agenda_item_affected
			WHERE agenda_item_id = ${s.traktandum} AND party_id = ${s.parteien[3]}
		`;
		expect(zeile.vorab_vermerk).toBe('Schreiben vom 12.09.2026');
		const [{ anzahl }] = await admin<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM agenda_item_affected WHERE agenda_item_id = ${s.traktandum}
		`;
		expect(anzahl).toBe(2);
	});

	it('fällt weg, wenn sich der Wortlaut des Antrags ändert', async () => {
		/*
		 * Fachprüfung 25.09.2026 (Block A2, V1-1): Eine schriftliche Zustimmung
		 * gilt dem Antrag, dem sie erteilt wurde (Rz. 209 bis 211 ad 712g).
		 * Gegenprobe ist die Probe darüber: gleicher Wortlaut, Vermerk bleibt.
		 */
		const s = await laufend('Vorab Wortlaut', '2027-06-18', NUTZUNGSRECHT, false);
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Schreiben vom 12.09.2026'
		);
		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), s.versammlung, 'Prüflauf');
		await bearbeiteTraktandum(handelnder(betreiber), s.versammlung, s.traktandum, {
			meetingId: s.versammlung,
			titel: 'Sondernutzungsrecht am Gartensitzplatz',
			art: 'abstimmung',
			antragswortlaut: 'Der Gartensitzplatz wird Whg 4 samt Unterhaltspflicht zugewiesen.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: [s.parteien[3]]
		});
		const [zeile] = await admin<{ vorab_vermerk: string | null }[]>`
			SELECT vorab_vermerk FROM agenda_item_affected
			WHERE agenda_item_id = ${s.traktandum} AND party_id = ${s.parteien[3]}
		`;
		expect(zeile.vorab_vermerk).toBeNull();
	});

	it('verlangt eine Angabe', async () => {
		const s = await laufend('Vorab 5', '2027-06-14');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await expect(
			vermerkeVorabZustimmung(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], ' ')
		).rejects.toThrow(/worauf sich die Zustimmung stützt/);
	});

	it('gibt es nur für Eingetragene und nur, wo die Zustimmung im Saal oder vorab geht', async () => {
		const s = await laufend('Vorab 6', '2027-06-15');
		await expect(
			vermerkeVorabZustimmung(
				handelnder(betreiber),
				s.versammlung,
				s.traktandum,
				s.parteien[3],
				'Schreiben vom 12.09.2026'
			)
		).rejects.toThrow(/nicht als betroffen eingetragen/);

		const w = await laufend('Vorab 7', '2027-06-16', WERTQUOTEN);
		await trageBetroffeneEin(handelnder(betreiber), w.versammlung, w.traktandum, [w.parteien[3]]);
		await expect(
			vermerkeVorabZustimmung(
				handelnder(betreiber),
				w.versammlung,
				w.traktandum,
				w.parteien[3],
				'Schreiben vom 12.09.2026'
			)
		).rejects.toThrow(/Abänderungsurkunde/);
	});
});

describe('Betroffen und im Ausstand', () => {
	it('zählt den Vorab-Vermerk als Zustimmung, ohne dass sie bei der Mehrheit mitzählt', async () => {
		/*
		 * Produktentscheid 26.09.2026 (Lesart B), etwa beim Eingriff gegen
		 * Entschädigung: im Ausstand für die Mehrheit, zustimmend über das
		 * Schreiben vorab. Über den ganzen Weg: eingetragen, vermerkt, Ausstand
		 * erklärt, abgestimmt, eingefroren, gezählt. Gegenprobe ohne Vermerk
		 * darunter.
		 */
		const s = await laufend('Ausstand Vorab', '2027-07-05');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Schreiben vom 12.09.2026'
		);
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Die Verkleinerung wird ihr entschädigt.'
		);
		const { a } = await abstimmen(s, null);
		expect(a.angenommen).toBe(true);
		expect(a.betroffene.vorab).toEqual([s.parteien[3]]);
		expect(a.koepfe.basis).toBe(3);

		const ohne = await laufend('Ausstand ohne Vorab', '2027-07-06');
		await trageBetroffeneEin(handelnder(betreiber), ohne.versammlung, ohne.traktandum, [
			ohne.parteien[3]
		]);
		await erklaereAusstand(
			handelnder(betreiber),
			ohne.versammlung,
			ohne.traktandum,
			ohne.parteien[3],
			'Die Verkleinerung wird ihr entschädigt.'
		);
		const gegen = await abstimmen(ohne, null);
		expect(gegen.a.angenommen).toBe(false);
		expect(gegen.a.betroffene.fehlend[0].grund).toBe('im_ausstand');
	});
});

describe('Beim Schliessen eingefroren', () => {
	it('ändert eine spätere Rücknahme des Vermerks das Ergebnis nicht', async () => {
		/*
		 * Bis Migration 124 las `ergebnisIn` die Betroffenen live. Mit dem
		 * Schreibweg im Saal, der nach dem Schliessen wieder offen ist, wirkte
		 * eine Änderung sonst auf einen geschlossenen, noch nicht festgeschriebenen
		 * Durchgang zurück.
		 */
		const s = await laufend('Einfrieren 1', '2027-06-20');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Schreiben vom 12.09.2026'
		);
		const { durchgang, a } = await abstimmen(s, 'abstain');
		expect(a.angenommen).toBe(true);

		const [eingefroren] = await admin<{ affected_json: unknown }[]>`
			SELECT affected_json FROM voting_round WHERE id = ${durchgang}
		`;
		expect(eingefroren.affected_json).toEqual([
			{ parteiId: s.parteien[3], vorab: 'Schreiben vom 12.09.2026', veto: null }
		]);

		await ohneFestschreibung(durchgang);
		await nimmVorabZustimmungZurueck(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3]);
		await trageBetroffeneAus(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3]);
		const danach = await holeErgebnis(betreiber, s.versammlung, durchgang);
		expect(danach.auszaehlung?.angenommen).toBe(true);
		expect(danach.auszaehlung?.betroffene.vorab).toEqual([s.parteien[3]]);
	});

	it('liest bei Durchgängen ohne festgeschriebenen Stand, wer jetzt eingetragen ist, ohne Vermerk', async () => {
		// Gegenprobe zur Probe darüber: Ohne `affected_json` wirkt der jetzige
		// Stand, und ein Vermerk zählt nicht, weil es ihn damals nicht gab.
		const s = await laufend('Einfrieren 2', '2027-06-21');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Schreiben vom 12.09.2026'
		);
		const { durchgang } = await abstimmen(s, 'abstain');

		await ohneFestschreibung(durchgang);
		await admin`UPDATE voting_round SET affected_json = NULL WHERE id = ${durchgang}`;
		const danach = await holeErgebnis(betreiber, s.versammlung, durchgang);
		expect(danach.auszaehlung?.angenommen).toBe(false);
		expect(danach.auszaehlung?.betroffene.fehlend[0].grund).toBe('enthaltung');
	});
});

describe('Abgewiesen wird', () => {
	it('jede der vier Handlungen bei offenem Durchgang', async () => {
		const s = await laufend('Schranke 1', '2027-06-25');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);

		const h = handelnder(betreiber);
		const [v, t, p] = [s.versammlung, s.traktandum, s.parteien];
		await expect(trageBetroffeneEin(h, v, t, [p[2]])).rejects.toThrow(/gerade abgestimmt/);
		await expect(trageBetroffeneAus(h, v, t, p[3])).rejects.toThrow(/gerade abgestimmt/);
		await expect(vermerkeVorabZustimmung(h, v, t, p[3], 'Schreiben')).rejects.toThrow(
			/gerade abgestimmt/
		);
		await expect(nimmVorabZustimmungZurueck(h, v, t, p[3])).rejects.toThrow(/gerade abgestimmt/);
		// Und die Absage nennt den Weg, den es gibt (Code-Review 25.09.2026, M1);
		// seit H6 der Abbruch ohne Ergebnis statt der Neuabstimmung.
		await expect(trageBetroffeneEin(h, v, t, [p[2]])).rejects.toThrow(
			/Brechen Sie die Abstimmung ohne Ergebnis ab, ordnen Sie die Betroffenen und geben Sie sie neu frei/
		);
		// Und nichts davon hat geschrieben.
		expect(await holeBetroffene(betreiber, v, t)).toHaveLength(1);
	});

	it('das Eintragen im Entwurf: dort gilt das Traktandenformular', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Schranke Entwurf',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2027-06-26',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			titel: 'Sondernutzungsrecht',
			art: 'abstimmung',
			antragswortlaut: 'Zuweisung.',
			antragstellerart: 'bewirtschaftung'
		});
		await expect(
			trageBetroffeneEin(handelnder(betreiber), v.id, t.id, ['00000000-0000-7000-8000-000000000000'])
		).rejects.toThrow(/Betroffene eintragen/);
	});

	it('jede der vier Handlungen nach dem Schliessen der Versammlung', async () => {
		const s = await laufend('Schranke geschlossen', '2027-06-24');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await admin.begin(async (tx) => {
			await tx`SET LOCAL session_replication_role = replica`;
			await tx`
				UPDATE meeting SET state = 'geschlossen', closed_at = now() WHERE id = ${s.versammlung}
			`;
		});
		const h = handelnder(betreiber);
		const [v, t, p] = [s.versammlung, s.traktandum, s.parteien];
		await expect(trageBetroffeneEin(h, v, t, [p[2]])).rejects.toThrow(/Zustand/);
		await expect(trageBetroffeneAus(h, v, t, p[3])).rejects.toThrow(/Zustand/);
		await expect(vermerkeVorabZustimmung(h, v, t, p[3], 'Schreiben')).rejects.toThrow(/Zustand/);
		await expect(nimmVorabZustimmungZurueck(h, v, t, p[3])).rejects.toThrow(/Zustand/);
	});

	it('ein Vermerk für eine Partei ausserhalb des Stimmberechtigtenstands', async () => {
		/*
		 * Code-Review 25.09.2026, M3: Das Traktandenformular lässt frühere
		 * Eigentümer zu. Ein Vermerk für eine solche Partei wurde angenommen und
		 * blieb in der Rechnung ohne Wirkung.
		 */
		const s = await laufend('Schranke Stand', '2027-06-23');
		// Eine Partei der Gemeinschaft, die nicht im Stand steht, wie ein früherer
		// Eigentümer: aus der Momentaufnahme genommen, dann zugeordnet.
		await admin.begin(async (tx) => {
			await tx`SET LOCAL session_replication_role = replica`;
			/*
			 * **Mit den abhängigen Zeilen** (26.09.2026). Ohne Trigger prüft
			 * Postgres auch die Fremdschlüssel nicht; die Einheit und das
			 * Anwesenheitsereignis der Partei blieben als Waisen stehen, und
			 * `aufbewahrung.test.ts` wurde rot, wann immer diese Datei vor ihr lief
			 * (seit 00871a9, von der Dateireihenfolge abhängig).
			 */
			const [sp] = await tx<{ id: string }[]>`
				SELECT id FROM snapshot_party WHERE meeting_id = ${s.versammlung} AND party_id = ${s.parteien[3]}
			`;
			await tx`DELETE FROM attendance_event WHERE snapshot_party_id = ${sp.id}`;
			await tx`DELETE FROM snapshot_unit WHERE snapshot_party_id = ${sp.id}`;
			await tx`DELETE FROM snapshot_party WHERE id = ${sp.id}`;
			await tx`
				INSERT INTO agenda_item_affected (agenda_item_id, party_id, operator_id, stweg_id)
				VALUES (${s.traktandum}, ${s.parteien[3]}, ${betreiber}, ${s.gemeinschaft})
			`;
		});
		await expect(
			vermerkeVorabZustimmung(
				handelnder(betreiber),
				s.versammlung,
				s.traktandum,
				s.parteien[3],
				'Schreiben vom 12.09.2026'
			)
		).rejects.toThrow(/nicht zu denen, die in dieser Versammlung stimmberechtigt/);
		// Austragen geht, damit sich die Zuordnung berichtigen lässt.
		await trageBetroffeneAus(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3]);
		expect(await holeBetroffene(betreiber, s.versammlung, s.traktandum)).toEqual([]);
	});

	it('eine Partei aus einer anderen Gemeinschaft, und ein fremdes Traktandum', async () => {
		const eine = await laufend('Schranke 2', '2027-06-27');
		const andere = await laufend('Schranke 3', '2027-06-28');
		await expect(
			trageBetroffeneEin(handelnder(betreiber), eine.versammlung, eine.traktandum, [
				andere.parteien[0]
			])
		).rejects.toThrow(/nicht zu denen, die in dieser Versammlung stimmberechtigt/);
		await expect(
			trageBetroffeneEin(handelnder(betreiber), eine.versammlung, andere.traktandum, [
				eine.parteien[0]
			])
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
	});

	it('das Eintragen ganz, wenn eine von mehreren scheitert', async () => {
		const eine = await laufend('Schranke 4', '2027-06-29');
		const andere = await laufend('Schranke 5', '2027-06-30');
		await expect(
			trageBetroffeneEin(handelnder(betreiber), eine.versammlung, eine.traktandum, [
				eine.parteien[3],
				andere.parteien[0]
			])
		).rejects.toThrow(/nicht zu denen, die in dieser Versammlung stimmberechtigt/);
		expect(await holeBetroffene(betreiber, eine.versammlung, eine.traktandum)).toEqual([]);
	});

	it('jedes Schreiben an der Tabelle nach dem Siegel, in der Datenbank', async () => {
		/*
		 * Bis Migration 124 genügte die Sperre «nur im Entwurf». Der neue Weg
		 * läuft ab der Freigabe; das Siegel sperrt deshalb die Tabelle selbst,
		 * wie bei Ausstand und Stimmen (FR-55). Gegenprobe: vor dem Siegel geht
		 * dieselbe Änderung durch.
		 */
		const s = await laufend('Schranke Siegel', '2027-07-01');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await admin`
			UPDATE agenda_item_affected SET eingetragen_durch = 'vor dem Siegel'
			WHERE agenda_item_id = ${s.traktandum}
		`;
		await admin.begin(async (tx) => {
			await tx`SET LOCAL session_replication_role = replica`;
			await tx`
				UPDATE meeting SET state = 'versiegelt', closed_at = now() WHERE id = ${s.versammlung}
			`;
		});
		await expect(
			admin`
				UPDATE agenda_item_affected SET eingetragen_durch = 'nach dem Siegel'
				WHERE agenda_item_id = ${s.traktandum}
			`
		).rejects.toThrow(/versiegelt/);
		await expect(
			admin`DELETE FROM agenda_item_affected WHERE agenda_item_id = ${s.traktandum}`
		).rejects.toThrow(/versiegelt/);
		await expect(
			admin`
				INSERT INTO agenda_item_affected (agenda_item_id, party_id, operator_id, stweg_id)
				VALUES (${s.traktandum}, ${s.parteien[0]}, ${betreiber}, ${s.gemeinschaft})
			`
		).rejects.toThrow(/versiegelt/);
	});
});

describe('Protokollzeilen je Form (Block A3a)', () => {
	it('nennen bei den Wertquoten die ausstehende Zustimmung mit Art. 712e Abs. 2', async () => {
		/*
		 * Bis A3a las das Protokoll nur die fehlenden Zustimmungen. Bei den
		 * Wertquoten fehlt keine, sie steht aus, und die Zeile fehlte ganz.
		 */
		const s = await laufend('Protokoll Wertquoten', '2027-06-20', WERTQUOTEN);
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await abstimmen(s, 'yes');
		const entwurf = await stelleEntwurfZusammen(betreiber, s.versammlung, '2027-06-30', 'Prüflauf');
		expect(entwurf).toContain(
			'- Noch aus steht die Zustimmung nach ZGB Art. 712e Abs. 2; sie wird mit der Unterschrift ' +
				'auf der Abänderungsurkunde erteilt: Duss.'
		);
		expect(entwurf).not.toContain('712g Abs. 4 nötige');
		// Gegenprobe zur nächsten Probe: ohne Nutzniessung keine solche Zeile.
		expect(entwurf).not.toContain('nutzniessenden');
	});

	it('nennen bei den Wertquoten die Nutzniessung an der Einheit einer Betroffenen, aus dem Stand der Freigabe', async () => {
		/*
		 * Produktentscheid 03.11.2026 (SVIT-Kommentar 2023, Art. 712e Rz. 80,
		 * 88): Das Grundbuch braucht auch die schriftliche Zustimmung der
		 * nutzniessenden Person. Die vor der Freigabe erfasste an Whg 4 steht
		 * im Protokoll; die erst danach an Whg 3 erfasste nicht, denn der Stand
		 * ist mit der Freigabe eingefroren.
		 */
		const s = await laufend(
			'Protokoll Wertquoten Nutzniessung',
			'2027-06-23',
			WERTQUOTEN,
			true,
			false,
			false,
			'Erna Beispiel'
		);
		await erstelleNutzniessung(handelnder(betreiber), {
			unitId: s.einheiten[2],
			holderName: 'Otto Erfunden',
			validFrom: '2021-01-01',
			hasAgreement: false,
			contractOnFile: true
		});
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [
			s.parteien[2],
			s.parteien[3]
		]);
		await abstimmen(s, 'yes');
		const entwurf = await stelleEntwurfZusammen(betreiber, s.versammlung, '2027-06-30', 'Prüflauf');
		expect(entwurf).toContain(
			'- Für das Grundbuch steht zudem die schriftliche Zustimmung der nutzniessenden Person aus, ' +
				'wenn sich die Quote ihrer Einheit ändert: Erna Beispiel (Whg 4)'
		);
		expect(entwurf).not.toContain('Otto Erfunden');
	});

	it('schweigen bei den Wertquoten, wenn die Genehmigung scheitert', async () => {
		/*
		 * Codeprüfung A3a, B1: Der Befund füllt `ausstehend` unabhängig von der
		 * Annahme. Ohne Genehmigung steht keine Unterschrift aus; der
		 * Ergebnissatz sagt es ebenso nur bei «angenommen».
		 */
		const s = await laufend('Protokoll Wertquoten abgelehnt', '2027-06-22', WERTQUOTEN);
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			s.parteien.map((p) => ({ parteiId: p, wahl: 'no' as const })),
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const entwurf = await stelleEntwurfZusammen(betreiber, s.versammlung, '2027-06-30', 'Prüflauf');
		expect(entwurf).toMatch(/Abgelehnt/);
		expect(entwurf).not.toContain('Noch aus steht die Zustimmung');
	});

	it('nennen bei den Nutzungsrechten die gezählte Vorab-Zustimmung mit Vermerk', async () => {
		const s = await laufend('Protokoll Vorab', '2027-06-21');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Schreiben vom 12.06.2027'
		);
		await abstimmen(s, 'abstain');
		const entwurf = await stelleEntwurfZusammen(betreiber, s.versammlung, '2027-06-30', 'Prüflauf');
		expect(entwurf).toContain(
			'- Vorab schriftlich zugestimmt: Duss (laut Sitzungsleitung: Schreiben vom 12.06.2027)'
		);
	});
});

describe('Handzählung bei den Wertquoten (Block A3c)', () => {
	it('geht mit Vermerk, und das Protokoll nennt die ausstehende Unterschrift', async () => {
		/*
		 * Der ganze Weg: Wertquoten, Betroffene im Saal eingetragen, von Hand
		 * gezählt mit Vermerk, geschlossen, im Protokoll. Bis A3c wies
		 * `summenhindernis` die Handzählung hier ab, weil sie die Betroffenen
		 * nicht kannte und das Protokoll dann verschwiegen hätte, wessen
		 * Unterschrift aussteht (Produktentscheid 26.09.2026).
		 */
		const s = await laufend('Handzählung Wertquoten', '2027-06-24', WERTQUOTEN);
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);

		// Ohne Vermerk weist der Server ab, bevor etwas geschrieben ist.
		await expect(
			erfasseSummen(handelnder(betreiber), s.versammlung, { ja: 3, nein: 1, enthaltung: 0 })
		).rejects.toThrow(/Vermerk Pflicht/);
		await expect(
			erfasseSummen(handelnder(betreiber), s.versammlung, {
				ja: 3,
				nein: 1,
				enthaltung: 0,
				vermerk: '  x '
			})
		).rejects.toThrow(/Vermerk Pflicht/);

		await erfasseSummen(handelnder(betreiber), s.versammlung, {
			ja: 3,
			nein: 1,
			enthaltung: 0,
			vermerk: 'Handzeichen, gezählt von der Sitzungsleitung'
		});
		const d = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);

		const pruefe = async () => {
			const { auszaehlung: a } = await holeErgebnis(betreiber, s.versammlung, d.id);
			expect(a!.angenommen).toBe(true);
			expect(a!.quotenErhoben).toBe(false);
			expect(a!.betroffene.noetig).toBe(true);
			expect(a!.betroffene.form).toBe('nachher');
			expect(a!.betroffene.ausstehend).toEqual([{ parteiId: s.parteien[3], name: 'Duss' }]);
		};
		await pruefe();
		// Und ohne Festschreibung, also über `zaehleSummenAus` selbst.
		await ohneFestschreibung(d.id);
		await pruefe();

		const entwurf = await stelleEntwurfZusammen(betreiber, s.versammlung, '2027-06-30', 'Prüflauf');
		expect(entwurf).toContain(
			'- Von Hand gezählt, ohne Zuordnung zu Personen: Handzeichen, gezählt von der Sitzungsleitung'
		);
		expect(entwurf).toContain(
			'- Noch aus steht die Zustimmung nach ZGB Art. 712e Abs. 2; sie wird mit der Unterschrift ' +
				'auf der Abänderungsurkunde erteilt: Duss.'
		);
	});

	it('bleibt bei den Nutzungsrechten gesperrt', async () => {
		/*
		 * Im geltenden Regelwerk verlangt der Knoten ein qualifiziertes Mehr mit
		 * Wertquoten; die Absage kommt deshalb aus dem Zweig davor. Die Absage
		 * nach Art. 712g Abs. 4 prüft die Kernprobe mit einfachem Mehr.
		 */
		const s = await laufend('Handzählung Nutzungsrecht', '2027-06-25');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await expect(
			erfasseSummen(handelnder(betreiber), s.versammlung, {
				ja: 3,
				nein: 1,
				enthaltung: 0,
				vermerk: 'Handzeichen'
			})
		).rejects.toThrow(/braucht es die einzelnen Stimmen/);
	});
});

describe('Der Folgeantrag übernimmt die Betroffenen (Block A3b)', () => {
	/** Ein Folgeantrag zum aufgerufenen Grundantrag, wie das Formular ihn schickt. */
	function formular(grundantrag: string, betroffene: string[], erfordernis = '') {
		const f = new FormData();
		f.set('spontanart', 'folgeantrag');
		f.set('grundantrag', grundantrag);
		f.set('art', 'abstimmung');
		f.set('titel', 'Gartensitzplatz nur bis 2030');
		f.set('antragswortlaut', 'Der Gartensitzplatz wird Whg 4 bis Ende 2030 zugewiesen.');
		if (erfordernis) f.set('erfordernis', erfordernis);
		for (const b of betroffene) f.append('betroffene', b);
		return f;
	}

	it('trägt die gewählten Betroffenen am Folgeantrag ein, über den Weg im Saal', async () => {
		const s = await laufend('Folgeantrag Betroffene', '2027-07-01');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		// Das Erfordernis wird gewählt, nicht mehr geerbt (Produktentscheid
		// 08.10.2026): Nur ein Erfordernis mit Zustimmungspflicht kennt
		// «Betroffene», und nur mit gesetztem Erfordernis trägt sie der Weg ein.
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			formular(s.traktandum, [s.parteien[3]], NUTZUNGSRECHT),
			'versammlung'
		);
		expect(auf.hinweis).toContain('Als unmittelbar betroffen eingetragen: Duss.');
		const folge = await holeBetroffene(betreiber, s.versammlung, auf.traktandumId);
		expect(folge.map((b) => b.name)).toEqual(['Duss']);
		// Gleiche Menge: kein Hinweis vor dem Eröffnen.
		const grund = await holeBetroffene(betreiber, s.versammlung, s.traktandum);
		expect(betroffenenabweichung(grund, folge)).toBeNull();
	});

	it('trägt ohne gewähltes Erfordernis keine Betroffenen ein, seit nicht mehr geerbt wird', async () => {
		/*
		 * Produktentscheid 08.10.2026: Der Folgeantrag erbt das Erfordernis
		 * nicht mehr. Ohne eigenes steht er ohne Mehr da, und Betroffene lassen
		 * sich erst eintragen, wenn eines gesetzt ist.
		 */
		const s = await laufend('Folgeantrag Betroffene ohne Erbe', '2027-07-21');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			formular(s.traktandum, [s.parteien[3]]),
			'versammlung'
		);
		expect(await holeBetroffene(betreiber, s.versammlung, auf.traktandumId)).toEqual([]);
		expect(auf.warnung).toContain('Vor der Abstimmung fehlt noch das Mehrheitserfordernis.');
	});

	it('trägt eine geänderte Auswahl ein, und der Hinweis nennt die Abweichung', async () => {
		const s = await laufend('Folgeantrag andere Betroffene', '2027-07-02');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			formular(s.traktandum, [s.parteien[2]], NUTZUNGSRECHT),
			'versammlung'
		);
		const folge = await holeBetroffene(betreiber, s.versammlung, auf.traktandumId);
		expect(folge.map((b) => b.name)).toEqual(['Christen']);
		const grund = await holeBetroffene(betreiber, s.versammlung, s.traktandum);
		const satz = betroffenenabweichung(grund, folge) ?? '';
		expect(satz).toContain('Neu betroffen: «Christen».');
		expect(satz).toContain('Nicht mehr betroffen: «Duss».');
	});

	it('trägt niemanden ein, wenn das gewählte Erfordernis keine Zustimmung verlangt, und sagt es', async () => {
		// Ohne Untergrenze aus der Einladung: Mit ihr wiese die Anwendung das
		// mildere Mehr schon ab (Produktentscheid 06.10.2026, «Ja, dieselbe
		// Untergrenze»), und dieser Zweig wäre nicht erreichbar. Den Fall mit
		// Untergrenze misst die nächste Probe.
		const s = await laufend('Folgeantrag ohne Zustimmung', '2027-07-03', NUTZUNGSRECHT, true, true);
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			formular(s.traktandum, [s.parteien[3]], 'k-verwaltung-gewoehnlich'),
			'versammlung'
		);
		// Der Satz verlangt eine Handlung vor der Abstimmung und reist deshalb als
		// stehende Warnung (Auftrag «votum-hinweise-lesbar», Teil 4, 06.10.2026).
		expect(auf.hinweis).toBeUndefined();
		expect(auf.warnung).toContain('verlangt keine Zustimmung von Betroffenen');
		// Erst das Erfordernis, dann eintragen: Ohne Zustimmung gibt es «Betroffene» dort nicht.
		// Codeprüfung N1 (06.10.2026): «Nötige Mehrheit» und «Betroffene» stehen
		// unter «Jetzt möglich», und das erst am aufgerufenen Antrag.
		expect(auf.warnung).toContain(
			'Ebenso, wenn er eine nützliche bauliche Massnahme ist, die jemandem den Gebrauch ' +
				'erheblich und dauernd erschwert oder unwirtschaftlich macht oder ihm unzumutbare Kosten ' +
				'auferlegt. Das geht unter «Jetzt möglich» bei «Nötige Mehrheit»; danach tragen Sie die ' +
				'Betroffenen bei «Betroffene» ein, sobald er aufgerufen ist.'
		);
		expect(auf.warnung).not.toContain('bevor abgestimmt wird');
		expect(await holeBetroffene(betreiber, s.versammlung, auf.traktandumId)).toEqual([]);
		// Der Folgeantrag steht trotzdem: Eine Absage hätte zum zweiten Anlegen verleitet.
		const liste = await holeTraktanden(betreiber, s.versammlung);
		expect(liste.some((t) => t.knoten.id === auf.traktandumId)).toBe(true);
	});

	it('unter der Untergrenze aus der Einladung bleibt der Folgeantrag ohne Mehr stehen und sagt es', async () => {
		// Produktentscheid 06.10.2026, «Ja, dieselbe Untergrenze»: Das einfache
		// Mehr ist milder als das gedruckte, weil die Wertquoten fehlen. Die
		// Zustimmung der Betroffenen zählt beim Vergleich nicht mit
		// (Produktentscheid 06.10.2026, «Nur wenn der Inhalt es verlangt»).
		const s = await laufend('Folgeantrag unter der Einladung', '2027-07-04');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			formular(s.traktandum, [s.parteien[3]], 'k-verwaltung-gewoehnlich'),
			'versammlung'
		);
		expect(auf.warnung).toContain(
			'Die Anwendung verlangt dieses Mehr auch für den Folgeantrag, und das gewählte ist milder.'
		);
		expect(auf.warnung).toContain('nehmen Sie ihn nicht noch einmal auf');
		// Ohne gesetztes Mehr der Ort auf dieser Seite und dann die Betroffenen,
		// nicht der Satz über die Zustimmung (Laienprüfung F2, R2-2, R3-2 b).
		expect(auf.warnung).toContain(
			'Setzen Sie mit «Erfordernis setzen» in seiner Zeile dieses Mehr oder ein strengeres. ' +
				'Verlangt der Inhalt des Folgeantrags die Zustimmung der im Formular ausgewählten ' +
				'Betroffenen, beantworten Sie dabei die Fragen nach seinem Inhalt. Dann verlangt das ' +
				'Ergebnis sie (Handbuch, Folgeantrag, Punkt 4). Ein von Hand gesetztes Mehr kennt ' +
				'keine Betroffenen. Eintragen lassen sie sich danach unter «Jetzt möglich» bei ' +
				'«Betroffene», sobald er aufgerufen ist; gespeichert sind sie noch nicht.'
		);
		expect(auf.warnung).not.toContain('verlangt keine Zustimmung von Betroffenen');
		expect(await holeBetroffene(betreiber, s.versammlung, auf.traktandumId)).toEqual([]);
		const liste = await holeTraktanden(betreiber, s.versammlung);
		const folge = liste.filter((t) => t.knoten.titel === 'Gartensitzplatz nur bis 2030');
		expect(folge).toHaveLength(1);
		expect(folge[0].knoten.erfordernis ?? null).toBeNull();
	});
});

/**
 * Ä-38 (16.10.2026): Bei geheimer Abstimmung zählt als Zustimmung der
 * Betroffenen nur die offene Erklärung (Vorab-Vermerk), nie der Stimmzettel.
 * Duss ist betroffen. Vorher stand in der Auswertung, die an alle geht,
 * «Duss (im Saal Nein gesagt)», abgelesen aus der geheimen Stimme.
 */
describe('Betroffene bei geheimer Abstimmung (Ä-38)', () => {
	async function auswertungsText(versammlung: string) {
		const w = (await holeAuswertung(betreiber, versammlung))!;
		const bytes = await erzeugeAuswertung({
			versammlung: w.versammlung,
			gemeinschaftName: 'Prüfgemeinschaft',
			zaehlweise: w.zaehlweise,
			stichentscheid: w.stichentscheid,
			zeilen: w.zeilen,
			erzeugtAm: '30. Juni 2027, 21:30'
		});
		const { PDFDocument } = await import('pdf-lib');
		const { textVonSeite } = await import('./pdftext');
		const seiten = (await PDFDocument.load(bytes)).getPageCount();
		return (await Promise.all(Array.from({ length: seiten }, (_, i) => textVonSeite(bytes, i))))
			.join(' ')
			.replace(/\s+/g, ' ');
	}

	it('nennt den Namen, aber nicht die Stimme, wenn die offene Zustimmung fehlt', async () => {
		const s = await laufend('Geheim Betroffen', '2027-06-24');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		const { a } = await abstimmen(s, 'no', true);
		expect(a.betroffene.fehlend).toEqual([expect.objectContaining({ grund: 'nicht_offen' })]);

		// Das Protokoll nennt, wessen Zustimmung fehlt (Rz. 129 ad Art. 712n).
		const entwurf = await stelleEntwurfZusammen(betreiber, s.versammlung, '2027-06-30', 'Prüflauf');
		expect(entwurf).toContain('Ohne offen erklärte Zustimmung nach ZGB Art. 712g Abs. 4: Duss');

		const pdf = await auswertungsText(s.versammlung);
		expect(pdf).toContain('Duss (nicht offen erklärt');
		expect(pdf).not.toContain('Nein gesagt');
	});

	it('zählt die offene Zustimmung, auch gegen ein geheimes Nein', async () => {
		const s = await laufend('Geheim Vorab', '2027-06-25');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Zettel im Saal, unterschrieben'
		);
		const { a } = await abstimmen(s, 'no', true);
		expect(a.betroffene.erfuellt).toBe(true);
		expect(a.angenommen).toBe(true);
		expect(await auswertungsText(s.versammlung)).not.toContain('widerrufen');
	});
});

/*
 * **Erfolg ohne Wirkung** (Kreuzteil des Fremdbetreiber-Durchstichs,
 * 28.10.2026). Mit der Partei eines anderen Betreibers trafen das DELETE und
 * das UPDATE nichts, und beide Aktionen meldeten trotzdem Erfolg. Seither sagt
 * der Rückgabewert, ob etwas geändert ist; die Aktionen sagen sonst ab.
 */
describe('Austragen und Zurücknehmen mit einer Partei, die hier nicht steht', () => {
	async function parteiVonB(): Promise<string> {
		const b = await pruefbetreiber('Betroffene B');
		const g = await erstelleGemeinschaft(handelnder(b), {
			name: 'Betroffene B, Haus',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const p = await erstelleEigentuemer(handelnder(b), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Fremd',
			isCommunity: false,
			representativeName: null
		});
		return p.id;
	}

	it('trageBetroffeneAus meldet «nichts geändert» und lässt die eigene Zeile stehen', async () => {
		const s = await laufend('Betroffene fremd 1', '2027-07-01');
		const fremd = await parteiVonB();
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);

		expect(await trageBetroffeneAus(handelnder(betreiber), s.versammlung, s.traktandum, fremd)).toBe(false);
		expect(await holeBetroffene(betreiber, s.versammlung, s.traktandum)).toHaveLength(1);

		// Gegenhälfte: die eingetragene Partei von A.
		expect(await trageBetroffeneAus(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3])).toBe(
			true
		);
		expect(await holeBetroffene(betreiber, s.versammlung, s.traktandum)).toEqual([]);
	});

	it('nimmVorabZustimmungZurueck meldet «nichts geändert» und lässt den eigenen Vermerk stehen', async () => {
		const s = await laufend('Betroffene fremd 2', '2027-07-02');
		const fremd = await parteiVonB();
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Schreiben vom 12.09.2026'
		);

		expect(await nimmVorabZustimmungZurueck(handelnder(betreiber), s.versammlung, s.traktandum, fremd)).toBe(
			false
		);
		const [z] = await admin<{ vorab_vermerk: string | null }[]>`
			SELECT vorab_vermerk FROM agenda_item_affected
			 WHERE agenda_item_id = ${s.traktandum} AND party_id = ${s.parteien[3]}
		`;
		expect(z.vorab_vermerk).toBe('Schreiben vom 12.09.2026');

		// Gegenhälfte: der Vermerk der Partei von A.
		expect(
			await nimmVorabZustimmungZurueck(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3])
		).toBe(true);
	});

	/** Eine Aktion wie SvelteKit sie aufruft, als die Leitung von A. */
	async function rufe(aktion: unknown, id: string, felder: Record<string, string>) {
		const daten = new FormData();
		for (const [feld, wert] of Object.entries(felder)) daten.append(feld, wert);
		return (aktion as (e: never) => Promise<unknown>)({
			request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
			locals: {
				benutzer: {
					id: benutzer,
					operatorId: betreiber,
					username: 'betroffenenleitung',
					displayName: 'Prüflauf',
					role: 'admin'
				},
				herkunft: null
			},
			params: { id },
			url: new URL('http://pruefung.example/aktion'),
			route: { id: '/pruefung' }
		} as never);
	}

	/*
	 * Die Absage steht in der Aktion, nicht in der Funktion: Fiele dort die
	 * Prüfung auf den Rückgabewert weg, meldete die Aktion wieder Erfolg
	 * (Codeprüfung 28.10.2026). Deshalb je Pfad beide Aktionen.
	 */
	for (const pfad of ['versammlungen', 'tage'] as const) {
		it(`/${pfad}/[id]/leitung: betroffeneAus und vorabZurueck sagen mit der Partei von B ab, mit A nicht`, async () => {
			const s = await laufend(`Betroffene fremd ${pfad}`, '2027-07-03', NUTZUNGSRECHT, true, false, pfad === 'tage');
			const fremd = await parteiVonB();
			await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
			await vermerkeVorabZustimmung(
				handelnder(betreiber),
				s.versammlung,
				s.traktandum,
				s.parteien[3],
				'Schreiben vom 12.09.2026'
			);
			const aktionen = pfad === 'tage' ? leitungAbend : leitungVersammlung;
			const id = pfad === 'tage' ? s.tagId! : s.versammlung;
			const felder = (partei: string) => ({ versammlung: s.versammlung, traktandum: s.traktandum, partei });

			for (const name of ['vorabZurueck', 'betroffeneAus'] as const) {
				const absage = await rufe(aktionen[name], id, felder(fremd));
				expect(absage, name).toMatchObject({ status: 400 });
				expect(JSON.stringify(absage), name).toContain('nichts geändert');
			}
			expect(await holeBetroffene(betreiber, s.versammlung, s.traktandum)).toHaveLength(1);

			for (const name of ['vorabZurueck', 'betroffeneAus'] as const) {
				const erfolg = await rufe(aktionen[name], id, felder(s.parteien[3]));
				expect(erfolg, name).toMatchObject({ hinweis: expect.any(String) });
			}
			expect(await holeBetroffene(betreiber, s.versammlung, s.traktandum)).toEqual([]);
		});
	}
});
