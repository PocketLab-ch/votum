/**
 * **Das Protokoll nennt die Begründung jeder angesetzten Neuabstimmung**
 * (Produktentscheid 30.09.2026: «Ja, immer nennen»; `docs/freigabe.md`, «Reste
 * zur Universalversammlung», Punkt 7).
 *
 * Vorher stand beim Geschäft nur «2. Durchgang; weitere Durchgänge siehe
 * Verlauf». Die Begründung lag im Verlauf und damit im Abschlusspaket bei der
 * Verwaltung; wer bei der Genehmigung fragt, warum wiederholt wurde (Rz. 133c
 * ad Art. 712n), fand sie im Protokoll nicht, obwohl nur das an alle geht.
 *
 * Der Satz gibt die Anordnung der Leitung wieder, nicht ihre Wirkung: Ob die
 * Leitung einen verkündeten Durchgang allein überholen darf, ist offen
 * (Fachprüfung 30.09.2026, F-3; `docs/freigabe.md`, Punkt (b) unter «Offen: Aus
 * der Prüfung zu ‹Rückkommen, dann Neuabstimmung›»).
 *
 * Seit H6 ist das verneint: Überholen lässt sich nur noch ein Durchgang, dessen
 * Ergebnis nicht verkündet ist. Die Proben setzen die Neuabstimmung deshalb an
 * einem offenen Gleichstand an (Stichentscheid beim Verwalter, nicht
 * eingetragen).
 *
 * Über den ganzen Weg, nicht über eine gebaute Eingabe: Abstimmen, Schliessen,
 * Neuabstimmung ansetzen, neu abstimmen, dann `stelleEntwurfZusammen`. Die
 * Zuordnung der Begründung zum Durchgang geschieht in der Auswertung, und
 * genau die sieht ein Domänentest nicht.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	gibStimmenAb,
	oeffneAbstimmung,
	schliesseAbstimmung,
	setzeNeuabstimmungAn
} from '$lib/server/abstimmung';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder() {
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

/** Zwei anwesende Parteien, ein Geschäft mit einfachem Mehr, eröffnet. */
async function aufbau(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: 'verwalter',
		tieBreakRuleSource: 'Art. 7 Ziff. 5'
	});
	const parteien: string[] = [];
	for (const [i, quote] of [600, 400].entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: i === 0 ? 'Probe Erstpartei' : 'Probe Zweitpartei',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Ersatz der Gegensprechanlage',
		art: 'abstimmung',
		antragswortlaut: 'Die Gegensprechanlage wird ersetzt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, t.id, EINFACHES_MEHR);
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	for (const p of parteien) await bestaetigeAnwesenheit(handelnder(), v.id, p, 'von_hand');
	return { versammlung: v.id, traktandum: t.id, parteien };
}

/** Ein Durchgang: eröffnen, beide stimmen gleich, schliessen. */
async function durchgang(a: Awaited<ReturnType<typeof aufbau>>, wahl: 'yes' | 'no') {
	await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
	await gibStimmenAb(
		handelnder(),
		a.versammlung,
		a.parteien.map((parteiId) => ({ parteiId, wahl })),
		false
	);
	return schliesseAbstimmung(handelnder(), a.versammlung);
}

/**
 * Ein Durchgang mit offenem Gleichstand: Ja gegen Nein, und der Entscheid des
 * Verwalters fehlt. Nicht verkündet, also mit einer Neuabstimmung zu überholen.
 */
async function gleichstand(a: Awaited<ReturnType<typeof aufbau>>) {
	await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
	await gibStimmenAb(
		handelnder(),
		a.versammlung,
		[
			{ parteiId: a.parteien[0], wahl: 'yes' },
			{ parteiId: a.parteien[1], wahl: 'no' }
		],
		false
	);
	const d = await schliesseAbstimmung(handelnder(), a.versammlung);
	expect(d.verkuendetAm).toBeNull();
	return d;
}

async function protokolltext(versammlung: string) {
	return (
		await stelleEntwurfZusammen(betreiber, versammlung, new Date().toISOString(), 'Prüflauf')
	).replace(/\s+/g, ' ');
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Neuabstimmung im Protokoll');
	benutzer = await pruefbenutzer(betreiber, 'pruefleitung');
});

afterAll(verbindungenSchliessen);

describe('Die Begründung einer Neuabstimmung im Protokoll', () => {
	it('steht beim Geschäft, wenn danach neu abgestimmt wurde', async () => {
		const a = await aufbau('Probeweg Neuabstimmung 1', '2027-08-11');
		const erster = await gleichstand(a);
		await setzeNeuabstimmungAn(
			handelnder(),
			a.versammlung,
			erster.id,
			'Prüflauf: Frage falsch gestellt.'
		);
		await durchgang(a, 'no');

		const text = await protokolltext(a.versammlung);
		// Ohne «Er hatte … ergeben» (H6): Der überholte Durchgang endete
		// unentschieden, und das sagt der Satz. Massgebend ist der nächste, weil
		// die Versammlung darin entschieden hat, nicht «nach ihrer Anordnung».
		expect(text).toContain(
			'Die Sitzungsleitung hat den 1. Durchgang überholt und eine Neuabstimmung angesetzt ' +
				'(Begründung: Prüflauf: Frage falsch gestellt). Er endete unentschieden, und der Stichentscheid wurde nicht festgestellt; massgebend ist der 2. Durchgang.'
		);
		expect(text).not.toContain('nach ihrer Anordnung');
		// Gegenprobe: Der Verweis auf den Verlauf trägt nichts mehr, wenn jeder
		// frühere Durchgang erklärt ist.
		expect(text).not.toMatch(/siehe Verlauf|auf Anfrage/);
	});

	it('nennt die Begründung, wenn die Neuabstimmung nicht mehr eröffnet wurde', async () => {
		const a = await aufbau('Probeweg Neuabstimmung 3', '2027-08-13');
		const erster = await gleichstand(a);
		await setzeNeuabstimmungAn(handelnder(), a.versammlung, erster.id, 'Prüflauf: Frage unklar');

		const text = await protokolltext(a.versammlung);
		expect(text).toContain(
			'Abgestimmt wurde im 1. Durchgang; es stand unentschieden, und der Stichentscheid wurde ' +
				'nicht festgestellt. Die Sitzungsleitung hat eine Neuabstimmung angesetzt (Begründung: ' +
				'Prüflauf: Frage unklar). Ein Beschluss ist nicht gefasst worden. - Zur Neuabstimmung kam ' +
				'es nicht mehr. Die Zahlen des 1. Durchgangs gibt auf Anfrage bekannt, wer das Protokoll ' +
				'aufbewahrt. Soll neu entschieden werden, muss die Sache an einer nächsten Versammlung ' +
				'traktandiert werden'
		);
		// «hatte «angenommen» ergeben» steht seit H6 nicht mehr: Überholt wird nur
		// noch ein unentschiedener Durchgang.
		expect(text).not.toContain('hatte «angenommen» ergeben');
	});

	/*
	 * **Nach dem Schluss ist die Neuabstimmung Geschichte** (Nachzug Block 1c).
	 * Angesetzt wird sie von Hand über die Leitung; die Formulare der beiden
	 * Leitungsseiten verschwinden mit dem Schluss, weil `schliesseVersammlung`
	 * das aufgerufene Traktandum leert. Der Aufruf selbst lief aber weiter
	 * durch: Ein abgeschickter Aufruf überholte den Durchgang noch, während er
	 * in Protokoll und Auswertung schon festgeschrieben war.
	 */
	it('weist eine Neuabstimmung nach dem Schluss ab', async () => {
		const a = await aufbau('Probeweg Neuabstimmung 4', '2027-08-14');
		const erster = await durchgang(a, 'yes');
		await schliesseVersammlung(handelnder(), a.versammlung);

		await expect(
			setzeNeuabstimmungAn(
				handelnder(),
				a.versammlung,
				erster.id,
				'Prüflauf: nach dem Schluss angesetzt'
			)
		).rejects.toThrow(/läuft nicht mehr/);
	});

	it('nennt jede Neuabstimmung, wenn es mehrere gab', async () => {
		const a = await aufbau('Probeweg Neuabstimmung 2', '2027-08-12');
		const erster = await gleichstand(a);
		await setzeNeuabstimmungAn(handelnder(), a.versammlung, erster.id, 'Prüflauf: Stimmen doppelt');
		const zweiter = await gleichstand(a);
		await setzeNeuabstimmungAn(handelnder(), a.versammlung, zweiter.id, 'Prüflauf: Antrag unklar');
		await durchgang(a, 'yes');

		const text = await protokolltext(a.versammlung);
		const eins = text.indexOf('(Begründung: Prüflauf: Stimmen doppelt)');
		const zwei = text.indexOf('(Begründung: Prüflauf: Antrag unklar)');
		expect(eins).toBeGreaterThan(-1);
		expect(zwei).toBeGreaterThan(eins);
		expect(text).toContain(
			'Die Sitzungsleitung hat den 2. Durchgang überholt und eine Neuabstimmung angesetzt ' +
				'(Begründung: Prüflauf: Antrag unklar). Er endete unentschieden, und der Stichentscheid wurde nicht festgestellt; massgebend ist der 3. Durchgang.'
		);
	});
});
