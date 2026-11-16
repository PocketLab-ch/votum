/**
 * Die Summen-Erfassung in der Datenbank — der Teil, den die Kerntests nicht
 * sehen.
 *
 * `tests/domain/summenzaehlung.test.ts` prüft die Rechnung. Hier geht es um die
 * Verdrahtung: dass die Summe am Durchgang landet, dass sie sich mit den
 * einzelnen Stimmen **gegenseitig ausschliesst**, und dass das Ergebnis nach
 * dem Schliessen aus ihr entsteht und nicht aus einer leeren Stimmenliste.
 *
 * Der letzte Punkt ist der gefährliche: Ohne die Verdrahtung zählte
 * `zaehleAus` null Stimmen aus, und der Antrag gälte als abgelehnt — bei einer
 * Handzählung, die dreimal Ja ergeben hat.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	erstelleVersammlung,
	eroeffneVersammlung,
	schliesseVersammlung
} from '$lib/server/versammlungen';
import { erzeugeProtokollentwurf } from '$lib/server/protokoll';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import {
	erfasseSummen,
	gibStimmenAb,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüferin' });

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

const QUALIFIZIERTES_MEHR: Erfordernis = {
	...EINFACHES_MEHR,
	knotenId: 'k-baulich-nuetzlich',
	typ: 'qualifiziertes_mehr',
	titel: 'Qualifiziertes Mehr',
	rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
	quotenbasis: 'alle_quoten',
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Summenerfassung');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-summen');
});

afterAll(verbindungenSchliessen);

/** Eine laufende Versammlung mit fünf Eigentümern und einem Antrag. */
async function aufbau(
	name: string,
	erfordernis: Erfordernis = EINFACHES_MEHR,
	betroffen: number[] = []
) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 500,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});

	const parteien: string[] = [];
	for (let i = 0; i < 5; i++) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 100 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Eigentümer ${i + 1}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}

	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: betroffen.map((i) => parteien[i])
	},
	// Entscheid 0050, Antwort 3: Betroffene nimmt das Formular nur mit einem Mehr an,
	// das sie kennt, wie die Route mit dem Feld «erfordernis».
	betroffen.length > 0 ? erfordernis.knotenId : null);
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, t.id, erfordernis);
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	for (const p of parteien) await bestaetigeAnwesenheit(handelnder(), v.id, p, 'von_hand');

	return { versammlung: v.id, traktandum: t.id, parteien };
}

describe('Die Summe landet am Durchgang', () => {
	it('schreibt die drei Zahlen und den Vermerk', async () => {
		const a = await aufbau('Summenweg 1');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		const d = await erfasseSummen(handelnder(), a.versammlung, {
			ja: 3,
			nein: 1,
			enthaltung: 1,
			vermerk: 'Handzeichen, gezählt von der Sitzungsleitung'
		});

		expect(d.handzaehlung).toMatchObject({ ja: 3, nein: 1, enthaltung: 1 });
		expect(d.handzaehlung?.vermerk).toContain('Handzeichen');
	});

	it('nimmt sie zurück, wenn keine Summe kommt', async () => {
		const a = await aufbau('Summenweg 2');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, { ja: 3, nein: 1, enthaltung: 0 });
		const d = await erfasseSummen(handelnder(), a.versammlung, null);
		expect(d.handzaehlung).toBeNull();
	});

	it('schreibt einen Verlaufseintrag mit den Zahlen', async () => {
		const a = await aufbau('Summenweg 3');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, { ja: 3, nein: 1, enthaltung: 0 });

		const zeilen = await imKontext(betreiber, (tx) =>
			tx<{ event_type: string; detail: Record<string, unknown> }[]>`
				SELECT event_type, detail FROM audit_entry
				WHERE event_type = 'vote.tally.recorded'
				ORDER BY occurred_at DESC, id DESC LIMIT 1
			`
		);
		expect(zeilen[0].detail).toMatchObject({ ja: 3, nein: 1, enthaltung: 0 });
	});

	it('verlangt eine offene Abstimmung', async () => {
		const a = await aufbau('Summenweg 4');
		await expect(
			erfasseSummen(handelnder(), a.versammlung, { ja: 1, nein: 0, enthaltung: 0 })
		).rejects.toThrow(/keine Abstimmung offen/);
	});
});

describe('Einzeln oder als Summe — nicht beides', () => {
	it('weist die Summe ab, wenn schon einzelne Stimmen erfasst sind', async () => {
		const a = await aufbau('Summenweg 5');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			true,
			'Handzeichen'
		);

		await expect(
			erfasseSummen(handelnder(), a.versammlung, { ja: 3, nein: 1, enthaltung: 0 })
		).rejects.toThrow(/einzelne Stimmen erfasst/);
	});

	it('weist eine einzelne Stimme ab, wenn eine Summe steht', async () => {
		const a = await aufbau('Summenweg 6');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, { ja: 3, nein: 1, enthaltung: 0 });

		await expect(
			gibStimmenAb(
				handelnder(),
				a.versammlung,
				[{ parteiId: a.parteien[0], wahl: 'yes' }],
				true,
				'Handzeichen'
			)
		).rejects.toThrow(/Handzählung erfasst/);
	});
});

describe('Nur beim einfachen Mehr', () => {
	it('weist ein qualifiziertes Mehr ab und nennt die Wertquoten', async () => {
		const a = await aufbau('Summenweg 7', QUALIFIZIERTES_MEHR);
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await expect(
			erfasseSummen(handelnder(), a.versammlung, { ja: 4, nein: 1, enthaltung: 0 })
		).rejects.toThrow(/Wertquoten/);
	});

	it('weist mehr Stimmen ab, als Anwesende da sind — vor dem Schreiben', async () => {
		const a = await aufbau('Summenweg 8');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await expect(
			erfasseSummen(handelnder(), a.versammlung, { ja: 5, nein: 1, enthaltung: 0 })
		).rejects.toThrow(/Mehr Stimmen als Stimmberechtigte/);

		// Und es steht nichts in der Datenbank.
		const zeilen = await imKontext(betreiber, (tx) =>
			tx<{ tally_yes: number | null }[]>`
				SELECT tally_yes FROM voting_round WHERE meeting_id = ${a.versammlung}
			`
		);
		expect(zeilen[0].tally_yes).toBeNull();
	});
});

/*
 * **Der Beklagte zählt bei der Handzählung nicht mit** (seit 25.09.2026). Unter
 * `alle_ausser_betroffene` (ZGB Art. 649b Abs. 2) fällt er aus der Basis, und
 * die Vorabprüfung beim Erfassen muss dieselbe Zahl Köpfe kennen wie die
 * Rechnung danach. Vorher liess sie seine Hand zu und rechnete ihn mit.
 */
describe('Mit einem Beklagten', () => {
	const AUSSCHLUSSKLAGE: Erfordernis = {
		...EINFACHES_MEHR,
		knotenId: 'k-ausschlussklage',
		titel: 'Ermächtigung zur Ausschlussklage',
		rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
		kopfbasis: 'alle_ausser_betroffene'
	};

	it('weist fünf Hände ab, wenn einer der fünf Anwesenden beklagt ist', async () => {
		const a = await aufbau('Summenweg 11', AUSSCHLUSSKLAGE, [4]);
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await expect(
			erfasseSummen(handelnder(), a.versammlung, { ja: 5, nein: 0, enthaltung: 0 })
		).rejects.toThrow(/Mehr Stimmen als Stimmberechtigte/);
	});

	it('rechnet das Ergebnis ohne ihn', async () => {
		const a = await aufbau('Summenweg 12', AUSSCHLUSSKLAGE, [4]);
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, { ja: 3, nein: 1, enthaltung: 0 });
		const geschlossen = await schliesseAbstimmung(handelnder(), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, geschlossen.id);
		expect(auszaehlung!.koepfe.basis).toBe(4);
		expect(auszaehlung!.koepfe.schwelle).toBe(3);
		expect(auszaehlung!.angenommen).toBe(true);
	});
});

/*
 * Die Mandantengrenze, nicht angenommen sondern gemessen: `erfasseSummen` läuft
 * unter `alsBetreiber`, und RLS soll die Zeile eines fremden Betreibers gar
 * nicht erst zeigen. Ein neuer Endpunkt ohne diese Probe wäre genau die Stelle,
 * an der eine Tenant-Grenze lautlos fehlt.
 */
describe('Ein fremder Betreiber kommt nicht heran', () => {
	it('findet den offenen Durchgang gar nicht', async () => {
		const a = await aufbau('Summenweg 12');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);

		const fremd = await pruefbetreiber('Summen fremd');
		await expect(
			erfasseSummen(
				{ operatorId: fremd, userId: null, label: 'Fremder' },
				a.versammlung,
				{ ja: 1, nein: 0, enthaltung: 0 }
			)
		).rejects.toThrow(/keine Abstimmung offen/);

		// Und nichts steht in der Zeile des eigenen Betreibers.
		const zeilen = await imKontext(betreiber, (tx) =>
			tx<{ tally_yes: number | null }[]>`
				SELECT tally_yes FROM voting_round WHERE meeting_id = ${a.versammlung}
			`
		);
		expect(zeilen[0].tally_yes).toBeNull();
	});
});

describe('Das Ergebnis entsteht aus der Summe', () => {
	it('nimmt den Antrag an, wenn die Handzählung die Mehrheit ergibt', async () => {
		const a = await aufbau('Summenweg 9');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, {
			ja: 3,
			nein: 2,
			enthaltung: 0,
			vermerk: 'Handzeichen'
		});
		const d = await schliesseAbstimmung(handelnder(), a.versammlung);

		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(e?.auszaehlung?.koepfe.ja).toBe(3);
		expect(e?.auszaehlung?.koepfe.basis).toBe(5);
		expect(e?.auszaehlung?.angenommen).toBe(true);
		expect(e?.auszaehlung?.hinweise.join(' ')).toContain('ohne Zuordnung');
	});

	/*
	 * Der gefährliche Fall: Ohne Verdrahtung zaehlte `zaehleAus` eine leere
	 * Stimmenliste aus — der Antrag gaelte als abgelehnt, obwohl die Handzaehlung
	 * dreimal Ja ergeben hat.
	 */
	it('rechnet nicht mit einer leeren Stimmenliste', async () => {
		const a = await aufbau('Summenweg 10');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, { ja: 5, nein: 0, enthaltung: 0 });
		const d = await schliesseAbstimmung(handelnder(), a.versammlung);

		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(e?.auszaehlung?.koepfe.ohneAbgabe).toBe(0);
		expect(e?.auszaehlung?.angenommen).toBe(true);
	});

	it('lehnt ab, wo die Mehrheit fehlt', async () => {
		const a = await aufbau('Summenweg 11');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, { ja: 2, nein: 3, enthaltung: 0 });
		const d = await schliesseAbstimmung(handelnder(), a.versammlung);

		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(e?.auszaehlung?.angenommen).toBe(false);
	});
});

/**
 * **Bis in den Protokolltext** (28.08.2026, Befund des Auftraggebers: «Handabstimmung fehlt
 * im Protokoll»).
 *
 * Die Tests darüber prüfen, dass die Summe am Durchgang landet und dass das
 * Ergebnis aus ihr entsteht. Beide waren grün, während das fertige Protokoll
 * «Wertquoten: 0 Ja, 0 Nein, 0 Enthaltung, 0 ohne Abgabe (von 0)» schrieb und
 * die Handzählung mit keinem Wort erwähnte.
 *
 * Der Grund lag in der Verdrahtung, nicht in der Rechnung: `quotenErhoben` und
 * der Vermerk am Durchgang wurden bis zum Protokoll nicht durchgereicht. Ein
 * Test am Kern hätte das nie gesehen, weil er die Zeile selbst baut.
 */
describe('Die Handzählung im Protokoll', () => {
	it('nennt sie samt Vermerk und schreibt keine Wertquoten, die niemand zählte', async () => {
		const a = await aufbau('Summenweg 12');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, {
			ja: 4,
			nein: 1,
			enthaltung: 0,
			vermerk: 'Handerheben, ausgezählt durch zwei Stimmenzähler'
		});
		await schliesseAbstimmung(handelnder(), a.versammlung);
		await schliesseVersammlung(handelnder(), a.versammlung);

		const p = await erzeugeProtokollentwurf(
			handelnder(),
			a.versammlung,
			'28. August 2026, 21:30'
		);

		expect(p.body).toContain('Von Hand gezählt, ohne Zuordnung zu Personen');
		expect(p.body).toContain('Handerheben, ausgezählt durch zwei Stimmenzähler');
		expect(p.body).toContain('- Stimmen nach Wertquoten: nicht erhoben');
		// Der leere Quotenspiegel darf nicht als Ergebnis erscheinen.
		// Mit oder ohne Einheit (Ä-09): Ein blosses `not.toContain` der alten
		// Zeile wäre seit der Einheit immer erfüllt.
		expect(p.body).not.toMatch(/Wertquoten( \([^)]*\))?: 0 Ja/);
	});
});
