/**
 * Einsprache nach Art. 712c Abs. 2 (Fassung 2026-10-20): Ohne eingetragene
 * betroffene Partei sperren Freigabe und Abstimmung, wie bei der
 * Ausschlussklage (Entscheid der auftraggebenden Sitzung 19.10.2026). Mit
 * Eintrag geht beides, und die Partei zählt nicht mit.
 *
 * Fünf Wohnungen mit je einer Stimme; W1 verkauft.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearbeiteGemeinschaft, erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit, erfasseVerlassenDerVersammlung } from '$lib/server/anwesenheit';
import { bestaetigeVollmacht, erfasseVollmacht, holeParteien, vermerkeVorlage } from '$lib/server/vollmacht';
import { holeErfassungsstand } from '$lib/server/erfassungsliste';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import {
	gibStimmenAb,
	holeErgebnis,
	oeffneAbstimmung,
	holeStimmsperren,
	schliesseAbstimmung,
	sperreInWorten
} from '$lib/server/abstimmung';
import { trageBetroffeneAus } from '$lib/server/betroffene';
import { waehleErfordernis, zaehlweiseBeiEinsprache, type Erfordernis } from '$lib/domain/entscheidbaum';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { load as hausLoad } from '../../src/routes/versammlungen/[id=kennung]/leitung/+page.server';
import type { PageData as Hausdaten } from '../../src/routes/versammlungen/[id=kennung]/leitung/$types';
import { load as abendLoad } from '../../src/routes/tage/[id=kennung]/leitung/+page.server';
import type { PageData as Abenddaten } from '../../src/routes/tage/[id=kennung]/leitung/$types';
import { load as traktandenLoad } from '../../src/routes/versammlungen/[id=kennung]/traktanden/+page.server';
import type { PageData as Traktandendaten } from '../../src/routes/versammlungen/[id=kennung]/traktanden/$types';
import { FASSUNGEN } from '$lib/rules';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

function einsprache(): Erfordernis {
	const e = waehleErfordernis(FASSUNGEN['2026-10-20'], 'k-einsprache').ergebnis;
	if (!e) throw new Error('Fassung 2026-10-20 liefert für die Einsprache kein Erfordernis');
	return e;
}

/** Fünf Wohnungen, das Traktandum «Einsprache», W1 auf Wunsch als betroffen eingetragen. */
async function aufbau(
	name: string,
	datum: string,
	mitBetroffener: boolean,
	zaehlweise: 'per_owner' | 'per_unit' = 'per_owner',
	/** Ein Versammlungstag, in den die Versammlung als einziges Haus kommt. */
	tag?: string
) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: zaehlweise,
		parkingCountsAsHead: false,
		parentStwegId: null,
		...(zaehlweise === 'per_unit' ? { headCountRuleSource: 'Reglement Ziff. 14' } : {})
	});
	const parteien: string[] = [];
	for (let i = 0; i < 5; i++) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `W${i + 1}`,
			quotas: { stamm: 200 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: i === 0 ? 'Erfunden Verkäuferin' : `Erfunden W${i + 1}`,
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
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Einsprache gegen den Verkauf von W1',
		art: 'abstimmung',
		antragswortlaut: 'Die Gemeinschaft erhebt Einsprache gegen den Verkauf von W1.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: mitBetroffener ? [parteien[0]] : []
	},
	// Entscheid 0050, Antwort 3: Betroffene nimmt das Formular nur mit einem Mehr an,
	// das sie kennt, wie die Route mit dem Feld «erfordernis».
	mitBetroffener ? 'k-einsprache' : null);
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, einsprache());
	// Wie im Betrieb: Das Haus kommt mit seinen Traktanden in den Abend.
	if (tag) await nimmInTagAuf(handelnder(betreiber), tag, v.id, 0);
	return { versammlung: v.id, traktandum: t.id, parteien, gemeinschaft: g.id, name };
}

async function eroeffnetUndAufgerufen(s: Awaited<ReturnType<typeof aufbau>>) {
	await gibVersammlungFrei(handelnder(betreiber), s.versammlung);
	await eroeffneVersammlung(handelnder(betreiber), s.versammlung);
	for (const p of s.parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, p, 'von_hand');
	}
	await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.traktandum);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Einsprache 712c');
	benutzer = await pruefbenutzer(betreiber, 'einspracheleitung');
});

afterAll(verbindungenSchliessen);

describe('Einsprache ohne eingetragene Betroffene', () => {
	it('sperrt die Freigabe, mit dem Satz ohne Beklagten', async () => {
		const s = await aufbau('Einsprache ohne Eintrag', '2026-11-20', false);
		const fehler = await gibVersammlungFrei(handelnder(betreiber), s.versammlung).then(
			() => null,
			(e: unknown) => e as Error
		);
		expect(fehler).not.toBeNull();
		expect(fehler!.message).toMatch(/wer verkauft, vermietet oder belastet/);
		expect(fehler!.message).not.toMatch(/Beklagt|Ausschlussklage/);
	});

	it('gibt mit Eintrag frei und zählt die Verkäuferin nicht mit (Gegenrichtung)', async () => {
		const s = await aufbau('Einsprache mit Eintrag', '2026-11-21', true);
		await eroeffnetUndAufgerufen(s);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			s.parteien.slice(1).map((parteiId, i) => ({
				parteiId,
				wahl: i < 2 ? ('yes' as const) : ('no' as const)
			})),
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, d.id);
		expect(auszaehlung!.koepfe.basis).toBe(4);
		expect(auszaehlung!.koepfe.ja).toBe(2);
		expect(auszaehlung!.angenommen).toBe(false);
	});

	it('sperrt die Abstimmung, wenn die Betroffene nach der Freigabe ausgetragen wurde', async () => {
		const s = await aufbau('Einsprache ausgetragen', '2026-11-22', true);
		await eroeffnetUndAufgerufen(s);
		await trageBetroffeneAus(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[0]);
		const fehler = await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum).then(
			() => null,
			(e: unknown) => e as Error
		);
		expect(fehler).not.toBeNull();
		expect(fehler!.message).toMatch(/Bei der Einsprache muss feststehen, wer verkauft/);
	});
});

describe('Codeprüfung H1: der Satz zur ruhenden Vollmacht', () => {
	const ruht = {
		parteiId: 'p2',
		name: 'Erfunden B',
		art: 'vertretung_ruht' as const,
		ueber: 'Erfunden Verkäuferin',
		wegen: 'betroffen' as const
	};

	it('nennt bei der Einsprache keinen Beklagten', () => {
		const satz = sperreInWorten({ ...ruht, knotenId: 'k-einsprache' });
		expect(satz).toMatch(/stimmt bei der Einsprache gegen das eigene Geschäft nicht mit; Votum zählt ihre Vollmachten hier nicht/);
		expect(satz).toMatch(/Beim nächsten Traktandum gilt die Vollmacht wieder/);
		expect(satz).not.toMatch(/Beklagt|Ausschlussklage|649b/);
	});

	it('Gegenrichtung: bei der Ausschlussklage bleibt der Beklagte', () => {
		expect(sperreInWorten({ ...ruht, knotenId: 'k-ausschlussklage' })).toMatch(/als Beklagter der Ausschlussklage/);
	});
});

/**
 * Stellt die Gemeinschaft nach der Freigabe auf Zählung je Eigentümer um, über
 * den normalen Weg (Codeprüfung zum Fix-Block, Befund 2). Bleibt der Hinweis
 * danach stehen, liest die Seite die Zählweise aus der Momentaufnahme, wie die
 * Auszählung, und nicht aus den Stammdaten.
 */
async function aufJeEigentuemer(s: Awaited<ReturnType<typeof aufbau>>) {
	const g = await bearbeiteGemeinschaft(handelnder(betreiber), s.gemeinschaft, {
		name: s.name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	expect(g.headCountMode).toBe('per_owner');
}

/** Was der Loader der Traktandenseite als Anfrage erwartet, wie in `ae17-verdrahtung.test.ts`. */
function anfrage(id: string) {
	return {
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-einsprache',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id },
		url: new URL('http://pruefung.example/einsprache')
	} as never;
}

describe('Featureprüfung T1: Hinweis zur Zählweise im Loader der Traktandenseite', () => {
	const satz = zaehlweiseBeiEinsprache('k-einsprache', 'per_unit')!;
	const warnungen = async (s: Awaited<ReturnType<typeof aufbau>>) => {
		const d = (await traktandenLoad(anfrage(s.versammlung))) as unknown as Traktandendaten;
		return d.traktanden.find((t) => t.knoten.id === s.traktandum)!.mehrhinweise;
	};

	it('nennt ihn bei Zählweise je Einheit, vor und nach der Freigabe', async () => {
		const s = await aufbau('Einsprache je Einheit', '2026-11-23', true, 'per_unit');
		expect(await warnungen(s)).toContain(satz);
		// Nach der Freigabe aus der Momentaufnahme, wie die Auszählung: Auch wenn die
		// Gemeinschaft danach je Eigentümer zählt, bleibt der Hinweis.
		await gibVersammlungFrei(handelnder(betreiber), s.versammlung);
		await aufJeEigentuemer(s);
		expect(await warnungen(s)).toContain(satz);
	});

	it('Gegenrichtung: je Eigentümer kein Hinweis', async () => {
		const s = await aufbau('Einsprache je Eigentümer', '2026-11-24', true, 'per_owner');
		expect(await warnungen(s)).not.toContain(satz);
	});
});

describe('Featureprüfung T2: Telefon und Erfassung über den echten Weg', () => {
	it('nennt die ruhende Vollmacht der Verkäuferin ohne Beklagten', async () => {
		const s = await aufbau('Einsprache Vollmacht', '2026-11-25', true);
		await eroeffnetUndAufgerufen(s);
		// Beide hinaus, Vollmacht von W2 an die Verkäuferin, die Verkäuferin kommt wieder.
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[0]);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[1]);
		const momentparteien = await holeParteien(betreiber, s.versammlung);
		const nach = (wer: string) => momentparteien.find((p) => p.name === wer)!;
		const v = await erfasseVollmacht(handelnder(betreiber), s.versammlung, {
			vertreteneId: nach('Erfunden W2').id,
			bevollmaechtigtId: nach('Erfunden Verkäuferin').id
		});
		await vermerkeVorlage(handelnder(betreiber), s.versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), s.versammlung, v.id);
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.parteien[0], 'von_hand');
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);

		const sperren = await holeStimmsperren(betreiber, s.versammlung, s.traktandum);
		const w2 = sperren.find((x) => x.parteiId === s.parteien[1])!;
		expect(w2.art).toBe('vertretung_ruht');
		expect(w2.knotenId).toBe('k-einsprache');

		// Erfassung: der Satz in der Liste der Gesperrten.
		const stand = await holeErfassungsstand(betreiber, s.versammlung);
		const satz = stand.sperren.find((x) => x.includes('Erfunden W2'))!;
		expect(satz).toMatch(/stimmt bei der Einsprache gegen das eigene Geschäft nicht mit; Votum zählt ihre Vollmachten hier nicht/);
		expect(stand.sperren.join(' ')).not.toMatch(/Beklagt|Ausschlussklage/);

		// Absage beim Erfassen derselben Stimme.
		const fehler = await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[{ parteiId: s.parteien[1], wahl: 'yes' }],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		).then(
			() => null,
			(e: unknown) => e as Error
		);
		expect(fehler?.message).toMatch(/stimmt bei der Einsprache gegen das eigene Geschäft nicht mit/);
		expect(fehler?.message).not.toMatch(/Beklagt/);
	});
});

describe('Featureprüfung (Prüfer B): Hinweis zur Zählweise in Haus- und Abendleitung', () => {
	const satz = zaehlweiseBeiEinsprache('k-einsprache', 'per_unit')!;

	async function abend(name: string, datum: string, zaehlweise: 'per_owner' | 'per_unit') {
		const t = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: `${name}, Abend`,
			datum,
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich'
		});
		const s = await aufbau(name, datum, true, zaehlweise, t.id);
		await eroeffnetUndAufgerufen(s);
		return { ...s, tag: t.id };
	}
	const hausleitung = async (versammlung: string) =>
		((await hausLoad(anfrage(versammlung))) as unknown as Hausdaten).mehrhinweise;
	const abendleitung = async (tag: string) => {
		const d = (await abendLoad(anfrage(tag))) as unknown as Abenddaten;
		return d.mehrhinweise;
	};

	it('nennt ihn bei Zählweise je Einheit an der aufgerufenen Einsprache, in beiden Leitungen', async () => {
		const s = await abend('Einsprache Leitung je Einheit', '2026-11-26', 'per_unit');
		// Nach der Freigabe umgestellt: Es gilt die Momentaufnahme (Codeprüfung, Befund 2).
		await aufJeEigentuemer(s);
		expect(await hausleitung(s.versammlung), 'Hausleitung').toContain(satz);
		expect(await abendleitung(s.tag), 'Abendleitung').toContain(satz);
	});

	it('Gegenrichtung: je Eigentümer in keiner Leitung', async () => {
		const s = await abend('Einsprache Leitung je Eigentümer', '2026-11-27', 'per_owner');
		expect(await hausleitung(s.versammlung)).not.toContain(satz);
		expect(await abendleitung(s.tag)).not.toContain(satz);
	});
});
