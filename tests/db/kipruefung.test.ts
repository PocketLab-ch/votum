/**
 * Der Nachweis über die KI-Nutzung durch die Kette (Welle 3, FR-58, FR-62, FR-63).
 *
 * Der Kern prüft, was hinausgeht; hier geht es um das, was er nicht sehen kann:
 * dass die **Zulassung** wirklich an der Gemeinschaft hängt, dass die
 * **Namensliste** die richtigen Leute umfasst, und dass der Nachweis
 * **entsteht und nicht mehr verschwindet** (AD-5).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft, bearbeiteGemeinschaft, holeGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleNutzniessung } from '$lib/server/nutzniessung';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { haltNutzungFest, vermerkeEntscheid } from '$lib/server/ki';
import { namenDerGemeinschaft } from '$lib/server/kinamen';
import { maskiere } from '$lib/domain/namensschutz';
import { verfuegbarkeit } from '$lib/domain/ki';
import { pruefeTraktandum } from '$lib/server/traktandenpruefung';
import { pruefeAntrag } from '$lib/server/antragspruefung';
import { holeVorschlag } from '$lib/server/erfordernisvorschlag';
import { holeRegelwerk } from '$lib/rules';
import { erstelleTraktandum, holeTraktanden } from '$lib/server/traktanden';
import { actions as erfordernisAktionen } from '../../src/routes/versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis/+page.server';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('KI-Prüflauf');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

async function gemeinschaftMitLeuten(name: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
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
		displayName: 'Anna Meier',
		representativeName: null,
		isCommunity: false
	});
	await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
	return { g, e, p };
}

describe('Die Zulassung hängt an der Gemeinschaft', () => {
	it('ist bei einer neuen Gemeinschaft aus', async () => {
		// **Vorgabe aus** (FR-62): Es werden Inhalte an ein fremdes Haus
		// übermittelt. Wer das will, schaltet es bewusst ein.
		const { g } = await gemeinschaftMitLeuten('KI aus');
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.aiEnabled).toBe(false);
		expect(gelesen?.aiDisabledFunctions).toEqual([]);
	});

	it('lässt einzelne Funktionen ausnehmen', async () => {
		const { g } = await gemeinschaftMitLeuten('KI teilweise');
		await bearbeiteGemeinschaft(handelnder(betreiber), g.id, {
			name: 'KI teilweise',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null,
			aiEnabled: true,
			aiDisabledFunctions: ['protokollentwurf']
		});
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.aiEnabled).toBe(true);
		expect(gelesen?.aiDisabledFunctions).toEqual(['protokollentwurf']);

		const lage = {
			eingerichtet: true,
			zugelassen: gelesen!.aiEnabled!,
			offline: false,
			ausgenommen: gelesen!.aiDisabledFunctions!
		};
		expect(verfuegbarkeit(lage, 'traktandenpruefung').verfuegbar).toBe(true);
		expect(verfuegbarkeit(lage, 'protokollentwurf').verfuegbar).toBe(false);
	});

	it('nimmt eine erfundene Funktion nicht in die Ausnahmeliste', async () => {
		// Ein Tippfehler liesse eine Funktion offen, die jemand für abgeschaltet
		// hält — und das fiele erst auf, wenn sie benutzt wurde.
		const { g } = await gemeinschaftMitLeuten('KI Tippfehler');
		await bearbeiteGemeinschaft(handelnder(betreiber), g.id, {
			name: 'KI Tippfehler',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null,
			aiEnabled: true,
			aiDisabledFunctions: ['protokolentwurf', 'protokollentwurf']
		});
		expect((await holeGemeinschaft(betreiber, g.id))?.aiDisabledFunctions).toEqual([
			'protokollentwurf'
		]);
	});
});

describe('Die Namensliste', () => {
	it('umfasst Eigentümer, Vertretungen und Nutzniesser', async () => {
		/*
		 * **Ein Name, der hier fehlt, geht ungeschützt hinaus.** Deshalb wird die
		 * Liste breit gezogen: Die Vertretung einer juristischen Person ist eine
		 * natürliche Person und steht so auch im Text, und der Nutzniesser
		 * erscheint regelmässig im Traktandum über seine Wohnung.
		 */
		const { g, e } = await gemeinschaftMitLeuten('Namensliste');
		const firma = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'legal',
			displayName: 'Bauherren AG',
			representativeName: 'Beat Winter',
			isCommunity: false
		});
		await erstelleNutzniessung(handelnder(betreiber), {
			unitId: e.id,
			holderName: 'Frau Keller',
			validFrom: '2020-01-01',
			hasAgreement: false
		});
		expect(firma.id).toBeTruthy();

		const s = await namenDerGemeinschaft(betreiber, g.id);
		const satz = 'Anna Meier, Beat Winter und Keller besprechen mit der Bauherren AG die Sanierung.';
		const m = maskiere(s, satz);
		expect(m.text).not.toMatch(/Meier|Winter|Keller|Bauherren/);
	});

	it('nimmt die Untergemeinschaften mit', async () => {
		// Ein Traktandum der Muttergemeinschaft nennt regelmässig jemanden aus
		// einem der Häuser; im Verbund erst recht.
		const { g } = await gemeinschaftMitLeuten('Mutter');
		const kind = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Haus B',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: g.id
		});
		await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: kind.id,
			kind: 'natural',
			displayName: 'Urs Neuenschwander',
			representativeName: null,
			isCommunity: false
		});

		const s = await namenDerGemeinschaft(betreiber, g.id);
		expect(maskiere(s, 'Neuenschwander widerspricht.').text).not.toMatch(/Neuenschwander/);
	});
});

describe('Der Nachweis', () => {
	it('hält Gegenstand, Stufe und Entscheid fest — aber keine Texte', async () => {
		const { g } = await gemeinschaftMitLeuten('Nachweis');
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2027-04-20',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});

		const id = await haltNutzungFest(handelnder(betreiber), {
			stwegId: g.id,
			meetingId: v.id,
			funktion: 'traktandenpruefung',
			gegenstandArt: 'agenda_item',
			gegenstandId: v.id,
			stufe: { nummer: 2, name: 'Mistral (EU/FR)', url: 'x', modell: 'm', schluessel: null, geduldMs: 1, quelle: 'umgebung' },
			dauerMs: 1400,
			bemerkung: '2 Befunde, 3 Namen ersetzt'
		});
		await vermerkeEntscheid(handelnder(betreiber), id, 'veraendert', {
			art: 'versammlung',
			versammlungId: v.id
		});

		const [z] = await imKontext(betreiber, async (tx) =>
			tx`SELECT feature, provider, model, stage, duration_ms, outcome, failed, note
			   FROM ai_usage WHERE id = ${id}`
		);
		expect(z.feature).toBe('traktandenpruefung');
		expect(z.provider).toBe('Mistral (EU/FR)');
		// **Welche Stufe geantwortet hat.** Höher als 1 heisst: davor ist etwas
		// ausgefallen — im Streitfall die Frage, wo der Text entstanden ist.
		expect(z.stage).toBe(2);
		expect(z.outcome).toBe('veraendert');
		expect(z.failed).toBe(false);

		// **Und im Verlauf** (Produktentscheid 30.09.2026): `outcome` lässt sich
		// überschreiben, der Verlauf nicht, und nur er geht ins Siegelpaket.
		const eintraege = await imKontext(betreiber, async (tx) =>
			tx`SELECT subject_type, subject_id, detail FROM audit_entry
			   WHERE event_type = 'ai.decision.recorded' AND detail->>'nutzung' = ${id}`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].subject_type).toBe('meeting');
		expect(eintraege[0].subject_id).toBe(v.id);
		expect(eintraege[0].detail).toMatchObject({
			funktion: 'traktandenpruefung',
			entscheid: 'veraendert'
		});
		// Weder Anfrage noch Antwort: Personenbezogenes gehört nicht ein zweites
		// Mal an eine Stelle, die nie gelöscht wird (AD-5).
		expect(Object.keys(z)).not.toContain('prompt');
		expect(z.note).toBe('2 Befunde, 3 Namen ersetzt');
	});

	it('hält auch einen Ausfall fest', async () => {
		// Sonst sähe es später aus, als sei nie geprüft worden — dabei wurde es
		// versucht und der Anbieter antwortete nicht.
		const { g } = await gemeinschaftMitLeuten('Ausfall');
		const id = await haltNutzungFest(handelnder(betreiber), {
			stwegId: g.id,
			funktion: 'traktandenpruefung',
			gescheitert: true,
			bemerkung: 'Infomaniak (CH): Zeitüberschreitung'
		});
		const [z] = await imKontext(betreiber, async (tx) =>
			tx`SELECT failed, provider FROM ai_usage WHERE id = ${id}`
		);
		expect(z.failed).toBe(true);
		expect(z.provider).toBeNull();
	});

	it('lässt sich von der Anwendung nicht löschen', async () => {
		/*
		 * Der Nachweis, dass ein Vorschlag von einer Maschine kam und wer ihn
		 * verantwortet hat, gehört zum Beschluss (AD-5). Ein Löschrecht wäre die
		 * Möglichkeit, genau das nachträglich verschwinden zu lassen.
		 */
		const { g } = await gemeinschaftMitLeuten('Unloeschbar');
		const id = await haltNutzungFest(handelnder(betreiber), {
			stwegId: g.id,
			funktion: 'traktandenpruefung'
		});
		await expect(
			imKontext(betreiber, async (tx) => tx`DELETE FROM ai_usage WHERE id = ${id}`)
		).rejects.toThrow(/permission denied|keine Berechtigung/i);
	});
});

describe('Der Maschinenvermerk im Protokoll', () => {
	it('lässt sich abschalten, ohne den Nachweis anzutasten', async () => {
		/*
		 * **Vorgabe des Auftraggebers vom 05.08.2026.** Der Vermerk steht in einem Dokument,
		 * das an alle Eigentümer geht; über dessen Inhalt entscheidet die
		 * Sitzungsleitung. Abschaltbar ist aber **nur die Zeile im Protokoll** —
		 * sonst wäre es kein Schalter, sondern ein Radiergummi.
		 */
		const { holeBetreiber, setzeKiHinweise } = await import('$lib/server/betreiber');
		const { haltNutzungFest, vermerkeEntscheid } = await import('$lib/server/ki');
		const { maschinellVorbereitet } = await import('$lib/server/protokollentwurf');

		const { g } = await gemeinschaftMitLeuten('Vermerk');
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2027-11-11',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		const nutzung = await haltNutzungFest(handelnder(betreiber), {
			stwegId: g.id,
			meetingId: v.id,
			funktion: 'protokollentwurf',
			stufe: { nummer: 1, name: 'Infomaniak (CH)', url: 'x', modell: 'm', schluessel: null, geduldMs: 1, quelle: 'umgebung' }
		});
		await vermerkeEntscheid(handelnder(betreiber), nutzung, 'angenommen', {
			art: 'versammlung',
			versammlungId: v.id
		});

		// Vorgabe: der Vermerk erscheint.
		expect((await maschinellVorbereitet(betreiber, v.id))?.anbieter).toBe('Infomaniak (CH)');
		expect((await holeBetreiber(betreiber))?.maschinenvermerkImProtokoll).toBe(true);

		// Abgeschaltet — die Zeile bleibt weg.
		await setzeKiHinweise(handelnder(betreiber), false, false);
		expect((await holeBetreiber(betreiber))?.maschinenvermerkImProtokoll).toBe(false);

		// **Der Nachweis steht unverändert.** Er ist die Zusage, die nicht am
		// Schalter hängt (FR-63, AD-5).
		const [z] = await imKontext(betreiber, async (tx) =>
			tx`SELECT feature, provider, outcome FROM ai_usage WHERE id = ${nutzung}`
		);
		expect(z.provider).toBe('Infomaniak (CH)');
		expect(z.outcome).toBe('angenommen');

		// Und wieder ein.
		await setzeKiHinweise(handelnder(betreiber), false, true);
		expect((await holeBetreiber(betreiber))?.maschinenvermerkImProtokoll).toBe(true);
	});
});

describe('Ein Traktandum wird nur unter SEINER Versammlung geprüft', () => {
	/**
	 * **Der Anlass** (Sicherheitsdurchgang 01.09.2026). Die Schale prüft, ob die
	 * Gemeinschaft der Versammlung aus der Adresse die KI zugelassen hat. Die
	 * Kennung des Traktandums kam aber aus dem Formular und wurde ungeprüft
	 * weitergereicht: Innerhalb eines Betreibers liess sich damit ein Traktandum
	 * einer ANDEREN Versammlung prüfen lassen — auch aus einer Gemeinschaft, die
	 * die KI ausdrücklich nicht zugelassen hat.
	 *
	 * Die Mandantengrenze hielt (RLS), die Zulassung der Gemeinschaft nicht.
	 * Geprüft wird deshalb der Fall INNERHALB eines Betreibers; über die
	 * Mandantengrenze hinweg wacht die Datenbank.
	 *
	 * Das Modell wird dabei nie befragt: Die Bindung sitzt in der Abfrage davor,
	 * und ohne Zeile gibt `pruefeTraktandum` den Fehlschlag zurück, statt zu
	 * fragen.
	 */
	it('gibt einen Fehlschlag, wenn die Versammlung nicht passt', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: `Fremdbindung ${Date.now()}`,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const eine = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt',
			datum: '2027-03-01',
			uhrzeit: '19:00',
			ort: 'Saal A'
		});
		const andere = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			art: 'ausserordentlich',
			anlass: 'Zweite Versammlung fuer den Prueffall',
			stufe: 'erste',
			betriebsart: 'gefuehrt',
			datum: '2027-04-01',
			uhrzeit: '19:00',
			ort: 'Saal B'
		});
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: eine.id,
			titel: 'Ein Punkt der einen Versammlung',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung'
		});

		const fremd = await pruefeTraktandum(handelnder(betreiber), t.id, andere.id);
		expect(fremd.stufe).toBeNull();
		expect(fremd.fehlschlaege.join(' ')).toMatch(/gibt es nicht mehr/);
		expect(fremd.hinausgegangen).toBe('');
		expect(fremd.nutzungId).toBeNull();
	});

	/*
	 * **Dieselbe Klasse an zwei weiteren Wegen** (Code-Review 02.09.2026, Befund
	 * 1b und was beim Nachgehen dazukam).
	 *
	 * Gemeldet war `pruefeAntrag`. `holeVorschlag` hatte denselben Fehler, nur
	 * über zwei Adressteile statt über das Formular: Die Schale prüft die
	 * Zulassung der Gemeinschaft aus `params.id`, `params.traktandumId` stand
	 * daneben und wurde nie gegen sie geprüft. Eine POST-Aktion läuft ohne
	 * `load`, also fängt auch dort nichts ab.
	 *
	 * Am laufenden System nachgemessen, zwei Gemeinschaften desselben
	 * Betreibers: unter der eigenen Adresse 400 («nicht zugelassen»), unter der
	 * fremden 200 mit vollem Vorschlag — samt den Inhalten der Gemeinschaft, die
	 * die KI abgelehnt hat.
	 *
	 * Auch hier wird das Modell nie befragt: Die Bindung sitzt in der Abfrage
	 * davor. Genau deshalb lässt sich das ohne bezahlten Aufruf prüfen.
	 */
	async function zweiVersammlungen(name: string) {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: `${name} ${Date.now()}`,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const grund = { stwegId: g.id, stufe: 'erste', betriebsart: 'gefuehrt', uhrzeit: '19:00' } as const;
		const eine = await erstelleVersammlung(handelnder(betreiber), {
			...grund,
			art: 'ordentlich',
			datum: '2027-03-01',
			ort: 'Saal A'
		});
		const andere = await erstelleVersammlung(handelnder(betreiber), {
			...grund,
			art: 'ausserordentlich',
			anlass: 'Zweite Versammlung fuer den Prueffall',
			datum: '2027-04-01',
			ort: 'Saal B'
		});
		return { g, eine, andere };
	}

	it('gibt beim Erfordernisvorschlag einen Grund, wenn die Versammlung nicht passt', async () => {
		const { eine, andere } = await zweiVersammlungen('Fremdbindung Vorschlag');
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: eine.id,
			titel: 'Ein Punkt der einen Versammlung',
			art: 'abstimmung',
			antragswortlaut: 'Die Versammlung beschliesst den Ersatz der Waschmaschine.',
			antragstellerart: 'bewirtschaftung'
		});

		/*
		 * **Die Gegenprobe geht über den Leseweg, nicht über die KI** — ein
		 * zweiter Aufruf «unter der eigenen Adresse» würde das Modell wirklich
		 * befragen, und ein Test, der Geld kostet und vom Netz abhängt, wird
		 * abgeschaltet. Nachgewiesen werden muss hier nur, dass das Traktandum
		 * existiert; sonst wäre «gibt es nicht mehr» richtig aus dem falschen
		 * Grund.
		 */
		const stehtDa = await holeTraktanden(betreiber, eine.id);
		expect(stehtDa.map((x) => x.knoten.id)).toContain(t.id);

		const fremd = await holeVorschlag(handelnder(betreiber), t.id, andere.id, holeRegelwerk());
		expect(fremd.vorschlag).toBeNull();
		expect(fremd.hinausgegangen).toBe('');
		expect(fremd.nutzungId).toBeNull();
		expect(fremd.stufe).toBeNull();
	});

	it('gibt bei der Antragsprüfung einen Grund, wenn die Versammlung nicht passt', async () => {
		const { eine, andere } = await zweiVersammlungen('Fremdbindung Antrag');
		const eltern = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: eine.id,
			titel: 'Angekuendigtes Geschaeft',
			art: 'abstimmung',
			antragswortlaut: 'Die Versammlung beschliesst den Ersatz der Waschmaschine.',
			antragstellerart: 'bewirtschaftung'
		});
		const antrag = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: eine.id,
			titel: 'Im Saal gestellter Antrag',
			art: 'abstimmung',
			antragswortlaut: 'Die Versammlung beschliesst den Ersatz erst im naechsten Jahr.',
			antragstellerart: 'bewirtschaftung',
			parentId: eltern.id
		});

		// Dieselbe Gegenprobe wie oben, aus demselben Grund.
		const stehtDa = await holeTraktanden(betreiber, eine.id);
		expect(stehtDa.map((x) => x.knoten.id)).toContain(antrag.id);

		const fremd = await pruefeAntrag(handelnder(betreiber), antrag.id, andere.id);
		expect(fremd.beurteilung).toBeNull();
		expect(fremd.grund).toMatch(/gibt es nicht mehr/);
		expect(fremd.hinausgegangen).toBe('');
		expect(fremd.nutzungId).toBeNull();
	});
});

describe('Ein Entscheid gehört an die Adresse, unter der er abgegeben wird', () => {
	/*
	 * **Der Anlass** (Code-Review 02.09.2026). `vermerkeEntscheid` nahm die
	 * Kennung der Nutzung aus einem verborgenen Formularfeld und schrieb darauf,
	 * ohne zu fragen, wozu sie gehört. RLS hielt den Mandanten, sonst nichts: Wer
	 * eine beliebige `ai_usage`-Kennung seines Betreibers schickte, setzte deren
	 * Ausgang — und verfälschte den Nachweis, den die Betreiberseite als «wer
	 * wann was übernommen hat» ausweist.
	 */
	it('weist einen Entscheid ab, der auf eine fremde Versammlung zeigt', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: `Fremdentscheid ${Date.now()}`,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const eine = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2033-05-05',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		const andere = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2033-06-06',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});

		const nutzung = await haltNutzungFest(handelnder(betreiber), {
			stwegId: g.id,
			meetingId: eine.id,
			funktion: 'traktandenpruefung'
		});

		// Dieselbe Nutzung, aber unter der Adresse der anderen Versammlung.
		await expect(
			vermerkeEntscheid(handelnder(betreiber), nutzung, 'angenommen', {
				art: 'versammlung',
				versammlungId: andere.id
			})
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);

		// Und der Ausgang steht unverändert auf nichts.
		const [z] = await imKontext(betreiber, async (tx) =>
			tx<{ outcome: string | null }[]>`SELECT outcome FROM ai_usage WHERE id = ${nutzung}`
		);
		expect(z.outcome).toBeNull();

		// Unter der richtigen Adresse geht es durch.
		await vermerkeEntscheid(handelnder(betreiber), nutzung, 'angenommen', {
			art: 'versammlung',
			versammlungId: eine.id
		});
		const [nachher] = await imKontext(betreiber, async (tx) =>
			tx<{ outcome: string | null }[]>`SELECT outcome FROM ai_usage WHERE id = ${nutzung}`
		);
		expect(nachher.outcome).toBe('angenommen');
	});

	it('weist eine Kennung ab, die es gar nicht gibt', async () => {
		await expect(
			vermerkeEntscheid(handelnder(betreiber), '01a00000-0000-7000-8000-000000000000', 'angenommen', {
				art: 'versammlung',
				versammlungId: '01a00000-0000-7000-8000-000000000001'
			})
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
	});
});

/** Der Weg zu «Nützliche bauliche Massnahme» — genau der Fall aus dem Durchlauf. */
const AST = 'a-bauen';
const PFAD = ['f1-0-nein', 'f1-1-nein', 'f1-2-ja'];
const ZIELKNOTEN = 'k-baulich-nuetzlich';

/**
 * **Der Knopf, der nur so aussah, als täte er etwas** (Auftraggeber, 03.09.2026).
 *
 * Praxisdurchlauf an einer laufenden Versammlung, Traktandum «Spielplatz»: Das
 * Quorum durch die KI bestimmen lassen lief, «nur die Übernahme für die
 * laufende Sitzung wurde nicht übernommen». Der Nachweis in `ai_usage` zeigte
 * drei Entscheide desselben Menschen am selben Traktandum — zweimal
 * «angenommen», einmal «veraendert», alle mit dem Fall `k-baulich-nuetzlich`.
 * Am Traktandum stand danach kein Erfordernis.
 *
 * «Ich folge der Empfehlung» schrieb bis dahin nur den Nachweis, *dass* gefolgt
 * wurde. Gesetzt hat allein der Entscheidbaum darunter.
 *
 * Geprüft wird hier die Aktion, nicht das Modell: Ob eine Empfehlung
 * herauskommt, ist Sache des Anbieters; dass ihr Folgen etwas setzt, ist Sache
 * der Anwendung.
 */
describe('Der Empfehlung folgen setzt das Erfordernis', () => {
	async function lage(name: string) {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: `${name} ${Date.now()}`,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			stufe: 'erste',
			betriebsart: 'gefuehrt',
			uhrzeit: '19:00',
			art: 'ordentlich',
			datum: '2027-03-01',
			ort: 'Saal A'
		});
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			titel: 'Spielplatz',
			art: 'abstimmung',
			antragswortlaut: 'Die Versammlung beschliesst den Bau eines Spielplatzes.',
			antragstellerart: 'bewirtschaftung'
		});
		const nutzung = await haltNutzungFest(handelnder(betreiber), {
			stwegId: g.id,
			meetingId: v.id,
			funktion: 'erfordernisvorschlag',
			gegenstandArt: 'agenda_item',
			gegenstandId: t.id,
			dauerMs: 1200,
			gescheitert: false,
			bemerkung: 'k-baulich-nuetzlich'
		});
		return { g, v, t, nutzung };
	}

	async function folgen(
		v: string,
		t: string,
		felder: Record<string, string>
	): Promise<{ status?: number; data?: { fehler?: { nachricht?: string } } }> {
		const daten = new FormData();
		for (const [k, w] of Object.entries(felder)) daten.set(k, w);
		try {
			return (await erfordernisAktionen.kifolgen({
				request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
				locals: {
					benutzer: {
						id: benutzer,
						operatorId: betreiber,
						username: 'pruefer-ki',
						displayName: 'Prüferin',
						role: 'admin'
					},
					herkunft: null
				},
				params: { id: v, traktandumId: t },
				url: new URL('http://pruefung.example/aktion')
			} as never)) as never;
		} catch (fehler) {
			// Der Erfolgsfall leitet weiter; `redirect()` wirft.
			if (fehler && typeof fehler === 'object' && 'status' in fehler) {
				return { status: (fehler as { status: number }).status };
			}
			throw fehler;
		}
	}

	it('setzt das Erfordernis am Traktandum und vermerkt den Entscheid', async () => {
		const { v, t, nutzung } = await lage('Empfehlung folgen');

		const vorher = (await holeTraktanden(betreiber, v.id)).find((x) => x.knoten.id === t.id);
		expect(vorher?.knoten.erfordernis, 'ohne Zutun steht dort nichts').toBeFalsy();

		const antwort = await folgen(v.id, t.id, {
			nutzungId: nutzung,
			ast: AST,
			p: PFAD.join(',')
		});
		expect(antwort.status, 'der Erfolgsfall leitet weiter').toBe(303);

		const nachher = (await holeTraktanden(betreiber, v.id)).find((x) => x.knoten.id === t.id);
		expect(nachher?.knoten.erfordernis?.typ, 'das Erfordernis steht am Traktandum').toBeTruthy();
		expect(nachher?.knoten.erfordernis?.fassung, 'mit Fassungskennung wie beim Baum').toBeTruthy();
		expect(nachher?.knoten.erfordernis?.knotenId).toBe(ZIELKNOTEN);

		const [n] = await imKontext(betreiber, async (tx) =>
			tx<{ outcome: string | null }[]>`SELECT outcome FROM ai_usage WHERE id = ${nutzung}`
		);
		expect(n.outcome, 'und der Nachweis hält fest, dass gefolgt wurde').toBe('angenommen');
	});

	/*
	 * **Der Nachweis darf dem Setzen nicht vorauseilen.** Schlägt das Setzen
	 * fehl, stünde sonst «der Empfehlung gefolgt» da, ohne dass ihr jemand
	 * gefolgt wäre.
	 */
	it('vermerkt nichts, wenn der Weg nicht zum Entscheidbaum passt', async () => {
		const { v, t, nutzung } = await lage('Empfehlung unpassend');

		const antwort = await folgen(v.id, t.id, {
			nutzungId: nutzung,
			ast: 'gibt-es-nicht',
			p: ''
		});
		expect(antwort.status, 'eine fachliche Absage, kein Absturz').toBe(400);

		const nachher = (await holeTraktanden(betreiber, v.id)).find((x) => x.knoten.id === t.id);
		expect(nachher?.knoten.erfordernis, 'nichts gesetzt').toBeFalsy();

		const [n] = await imKontext(betreiber, async (tx) =>
			tx<{ outcome: string | null }[]>`SELECT outcome FROM ai_usage WHERE id = ${nutzung}`
		);
		expect(n.outcome, 'und nichts vermerkt').toBeNull();
	});
});
