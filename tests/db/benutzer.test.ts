/**
 * Konten und Kennwörter in der Datenbank.
 *
 * Geprüft werden die **Grenzen**, nicht das Anlegen: Ein Konto anzulegen ist
 * ein `INSERT`. Dass sich die Bewirtschaftung nicht aus ihrer eigenen Anwendung
 * aussperren kann und dass ein Kennwortwechsel die übrigen Sitzungen beendet,
 * ist das, was im Ernstfall zählt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anmelden, merkmalPruefwert } from '$lib/server/auth';
import {
	aendereEigenesKennwort,
	aendereRolle,
	holeKonten,
	legeKontoAn,
	setzeAusserDienst,
	setzeKennwort
} from '$lib/server/benutzer';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

function handelnder(userId: string | null = null) {
	return { operatorId: betreiber, userId, label: 'Prüflauf' };
}

/** Ein Konto mit Kennwort, über den regulären Weg angelegt. */
async function konto(username: string, rolle: 'admin' | 'chair' = 'admin', kennwort = 'brauner tisch am fenster') {
	return legeKontoAn(handelnder(), {
		username,
		displayName: `Prüf ${username}`,
		rolle,
		kennwort,
		wiederholung: kennwort
	});
}

/** Ein zweites Verwaltungskonto, das die Eingriffe vornimmt. */
let handelnderId: string;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Konten');
	// Wer handelt, ist selbst ein Konto — sonst stünde im Verlauf niemand, und
	// die Selbstprüfung («niemand stellt sich selbst ausser Dienst») liesse sich
	// gar nicht auslösen.
	handelnderId = (await konto('pruefleitung')).id;
});

afterAll(verbindungenSchliessen);

describe('Ein Konto anlegen', () => {
	it('steht danach in der Liste, mit Rolle und ohne Sitzung', async () => {
		const k = await konto('anlegen1');
		const liste = await holeKonten(betreiber);
		const gefunden = liste.find((x) => x.id === k.id)!;
		expect(gefunden.username).toBe('anlegen1');
		expect(gefunden.role).toBe('admin');
		expect(gefunden.hatKennwort).toBe(true);
		expect(gefunden.sitzungen).toBe(0);
		expect(gefunden.ausserDienstSeit).toBeNull();
	});

	it('lässt sich damit sofort anmelden', async () => {
		await konto('anlegen2', 'chair', 'gruener stuhl am tisch');
		const ergebnis = await anmelden('anlegen2', 'gruener stuhl am tisch');
		expect(ergebnis.art).toBe('erfolg');
	});

	it('weist denselben Benutzernamen zweimal ab', async () => {
		await konto('anlegen3');
		await expect(konto('anlegen3')).rejects.toThrow(/bereits/);
	});

	it('weist einen Benutzernamen mit Umlauten und Leerzeichen ab', async () => {
		// Er wird getippt, oft am Telefon und im Halbdunkel.
		await expect(konto('Anna Müller')).rejects.toThrow(/Kleinbuchstaben/);
	});

	it('weist ein Kennwort ab, das den Benutzernamen enthält', async () => {
		await expect(
			legeKontoAn(handelnder(), {
				username: 'mmeier9',
				displayName: 'M. Meier',
				rolle: 'chair',
				kennwort: 'mmeier9-sommer-2026',
				wiederholung: 'mmeier9-sommer-2026'
			})
		).rejects.toThrow(/enthält Ihren Namen/);
	});
});

describe('Das eigene Kennwort ändern', () => {
	it('verlangt das bisherige als Nachweis', async () => {
		/*
		 * **Auch bei bestehender Sitzung.** Ein unbeaufsichtigtes Gerät im
		 * Sitzungszimmer ist der Normalfall; ohne diese Frage genügte eine Minute
		 * daran, um das Konto zu übernehmen.
		 */
		const k = await konto('eigen1', 'chair', 'brauner tisch am fenster');
		const benutzer = {
			id: k.id,
			operatorId: betreiber,
			username: k.username,
			displayName: k.displayName,
			role: k.role
		};
		await expect(
			aendereEigenesKennwort(benutzer, 'falsches kennwort hier', 'neues langes kennwort', 'neues langes kennwort', null)
		).rejects.toThrow(/bisherige Kennwort stimmt nicht/);
	});

	it('beendet die anderen Sitzungen und lässt die eigene stehen', async () => {
		/*
		 * **Der Kern der Sache.** Wer sein Kennwort wechselt, tut das im Zweifel,
		 * weil es jemand kennt — dann hilft ein neues nichts, solange die alte
		 * Sitzung weiterläuft. Die eigene bleibt: Sich beim Wechsel selbst
		 * abzumelden wäre eine Strafe für richtiges Verhalten.
		 */
		const k = await konto('eigen2', 'chair', 'brauner tisch am fenster');
		const benutzer = {
			id: k.id,
			operatorId: betreiber,
			username: k.username,
			displayName: k.displayName,
			role: k.role
		};

		// Drei Geräte melden sich an.
		const erste = await anmelden('eigen2', 'brauner tisch am fenster');
		await anmelden('eigen2', 'brauner tisch am fenster');
		await anmelden('eigen2', 'brauner tisch am fenster');
		expect((await holeKonten(betreiber)).find((x) => x.id === k.id)!.sitzungen).toBe(3);

		if (erste.art !== 'erfolg') throw new Error('Anmeldung fehlgeschlagen');
		const { entwertet } = await aendereEigenesKennwort(
			benutzer,
			'brauner tisch am fenster',
			'gelbes regal an der wand',
			'gelbes regal an der wand',
			merkmalPruefwert(erste.sitzungsmerkmal)
		);

		expect(entwertet).toBe(2);
		expect((await holeKonten(betreiber)).find((x) => x.id === k.id)!.sitzungen).toBe(1);

		// Und das neue Kennwort gilt, das alte nicht mehr.
		expect((await anmelden('eigen2', 'gelbes regal an der wand')).art).toBe('erfolg');
		expect((await anmelden('eigen2', 'brauner tisch am fenster')).art).toBe('abgelehnt');
	});

	it('weist dasselbe Kennwort noch einmal ab', async () => {
		const k = await konto('eigen3', 'chair', 'brauner tisch am fenster');
		await expect(
			aendereEigenesKennwort(
				{ id: k.id, operatorId: betreiber, username: k.username, displayName: k.displayName, role: k.role },
				'brauner tisch am fenster',
				'brauner tisch am fenster',
				'brauner tisch am fenster',
				null
			)
		).rejects.toThrow(/dasselbe wie das bisherige/);
	});
});

describe('Die Herkunft einer Anmeldung', () => {
	it('nimmt einen Kopfwert, der keine Adresse ist, ohne Herkunft statt mit 500', async () => {
		// Hängt der Proxy nichts an, steht in der Kopfzeile, was der Aufrufer
		// schrieb, und `client_ip inet` scheiterte daran mit 22P02 (B2).
		await konto('herkunft1', 'chair', 'brauner tisch am fenster');
		expect((await anmelden('herkunft1', 'falsch', Date.now(), 'kein-ip')).art).toBe('abgelehnt');
		// `isIP` nimmt die Zone an, `inet` nicht (Codeprüfung, 27.10.2026).
		expect((await anmelden('herkunft1', 'falsch', Date.now(), 'fe80::1%eth0')).art).toBe('abgelehnt');
		expect((await anmelden('herkunft1', 'falsch', Date.now(), '198.51.100.20')).art).toBe('abgelehnt');

		const zeilen = await admin<{ client_ip: string | null }[]>`
			SELECT host(client_ip) AS client_ip FROM login_attempt
			WHERE username = 'herkunft1' ORDER BY attempted_at
		`;
		expect(zeilen.map((z) => z.client_ip)).toEqual([null, null, '198.51.100.20']);
	});
});

describe('Fremde Konten führen', () => {
	it('setzt ein Kennwort und beendet dabei alle Sitzungen des Kontos', async () => {
		// Anders als beim eigenen Wechsel ist hier gerade der Fall gemeint, dass
		// jemand anders damit angemeldet ist.
		const k = await konto('fremd1', 'chair', 'brauner tisch am fenster');
		await anmelden('fremd1', 'brauner tisch am fenster');
		await anmelden('fremd1', 'brauner tisch am fenster');

		const { entwertet } = await setzeKennwort(
			handelnder(),
			k.id,
			'ganz neues langes kennwort',
			'ganz neues langes kennwort'
		);
		expect(entwertet).toBe(2);
		expect((await holeKonten(betreiber)).find((x) => x.id === k.id)!.sitzungen).toBe(0);
		expect((await anmelden('fremd1', 'ganz neues langes kennwort')).art).toBe('erfolg');
	});

	it('stellt ausser Dienst, beendet die Sitzungen und sperrt die Anmeldung', async () => {
		const k = await konto('fremd2', 'chair', 'brauner tisch am fenster');
		await anmelden('fremd2', 'brauner tisch am fenster');

		const { entwertet } = await setzeAusserDienst(handelnder(handelnderId), k.id, true);
		expect(entwertet).toBe(1);
		expect((await anmelden('fremd2', 'brauner tisch am fenster')).art).toBe('abgelehnt');

		// Und wieder herein.
		await setzeAusserDienst(handelnder(handelnderId), k.id, false);
		expect((await anmelden('fremd2', 'brauner tisch am fenster')).art).toBe('erfolg');
	});
});

describe('Die Grenzen, die niemand überschreitet', () => {
	it('lässt niemanden sich selbst ausser Dienst stellen', async () => {
		// Kein Sonderfall der Regel unten, sondern ein eigener: Es ist fast immer
		// ein Versehen.
		const k = await konto('grenze1');
		await expect(setzeAusserDienst(handelnder(k.id), k.id, true)).rejects.toThrow(
			/eigenes Konto/
		);
	});

	it('lässt das letzte Verwaltungskonto nicht ausser Dienst stellen', async () => {
		/*
		 * **Sonst sperrt sich die Bewirtschaftung aus ihrer eigenen Anwendung
		 * aus** — hereinkommt sie danach nur noch über die Kommandozeile, also
		 * genau über den Weg, den diese Funktionen ersetzen sollen.
		 */
		const eigener = await pruefbetreiber('Konten letzte Verwaltung');
		const einzig = await legeKontoAn(
			{ operatorId: eigener, userId: null, label: 'Prüflauf' },
			{
				username: 'einzig',
				displayName: 'Einzige Verwaltung',
				rolle: 'admin',
				kennwort: 'brauner tisch am fenster',
				wiederholung: 'brauner tisch am fenster'
			}
		);

		await expect(
			setzeAusserDienst({ operatorId: eigener, userId: null, label: 'Prüflauf' }, einzig.id, true)
		).rejects.toThrow(/letzte Konto mit Verwaltungsrechten/);

		// Auch nicht über den Umweg der Rolle.
		await expect(
			aendereRolle({ operatorId: eigener, userId: null, label: 'Prüflauf' }, einzig.id, 'chair')
		).rejects.toThrow(/letzte Konto mit Verwaltungsrechten/);
	});

	it('lässt es zu, sobald ein zweites Verwaltungskonto da ist', async () => {
		const eigener = await pruefbetreiber('Konten zwei Verwaltungen');
		const wer = { operatorId: eigener, userId: null, label: 'Prüflauf' };
		const erstes = await legeKontoAn(wer, {
			username: 'erste',
			displayName: 'Erste Verwaltung',
			rolle: 'admin',
			kennwort: 'brauner tisch am fenster',
			wiederholung: 'brauner tisch am fenster'
		});
		await legeKontoAn(wer, {
			username: 'zweite',
			displayName: 'Zweite Verwaltung',
			rolle: 'admin',
			kennwort: 'gruener stuhl am tisch',
			wiederholung: 'gruener stuhl am tisch'
		});

		await setzeAusserDienst({ ...wer, userId: null }, erstes.id, true);
		const liste = await holeKonten(eigener);
		expect(liste.find((x) => x.id === erstes.id)!.ausserDienstSeit).not.toBeNull();
	});

	it('trennt die Konten zweier Betreiber', async () => {
		// Der Zeilenschutz gilt auch hier: Ein Betreiber sieht die Konten des
		// anderen nicht, und zwar auch dann nicht, wenn er ihre Kennung kennt.
		const fremder = await pruefbetreiber('Konten fremd');
		await legeKontoAn(
			{ operatorId: fremder, userId: null, label: 'Prüflauf' },
			{
				username: 'fremdling',
				displayName: 'Fremd',
				rolle: 'chair',
				kennwort: 'brauner tisch am fenster',
				wiederholung: 'brauner tisch am fenster'
			}
		);
		const meine = await holeKonten(betreiber);
		expect(meine.some((k) => k.username === 'fremdling')).toBe(false);
	});
});

/*
 * **Befund D4 aus dem Sicherheitsdurchgang vom 09.10.2026.** Namen waren nur
 * je Betreiber eindeutig, die Anmeldung sucht aber ohne Betreiber und nahm die
 * erstbeste Zeile: Vom zweiten Konto gleichen Namens war nur eines anmeldbar.
 * Seit Migration 155 gehört ein Name genau einem Konto. Der Fall stand bis
 * dahin als Nachweis in `probe/benutzername-mehrdeutig.dblive.ts`.
 *
 * D5, die Sperre über die Betreibergrenze, hat damit keinen Gegenstand mehr:
 * Der Zähler nach Namen ist der Zähler dieses einen Kontos.
 */
describe('Ein Benutzername gehört genau einem Konto', () => {
	const kennwort = 'kennwort des ersten hauses';

	it('weist beim Anlegen einen Namen ab, den ein fremder Betreiber schon hat', async () => {
		const erstes = await pruefbetreiber('Namen erstes Haus');
		const zweites = await pruefbetreiber('Namen zweites Haus');
		const bei = (operatorId: string) => ({ operatorId, userId: null, label: 'Prüflauf' });
		const angaben = {
			username: 'doppelname',
			displayName: 'Konto doppelt',
			rolle: 'chair' as const,
			kennwort,
			wiederholung: kennwort
		};
		const vorhanden = await legeKontoAn(bei(erstes), angaben);

		// Gross geschrieben, damit auch die Kleinschreibung beim Anlegen mitgeprüft
		// ist: Die Oberfläche legt «Doppelname» als «doppelname» an.
		const absage = legeKontoAn(bei(zweites), { ...angaben, username: 'Doppelname' });
		await expect(absage).rejects.toThrow(FachlicherFehler);
		await expect(absage).rejects.toMatchObject({
			kennung: 'schon_vergeben',
			feld: 'username',
			message: expect.stringMatching(/anderen Betreiber/)
		});

		const bestand = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM app_user WHERE lower(username) = 'doppelname'
		`;
		expect(bestand[0].n).toBe(1);

		// Das vorhandene Konto bleibt anmeldbar, und zwar genau dieses.
		expect(await anmelden('doppelname', kennwort)).toMatchObject({
			art: 'erfolg',
			benutzer: { id: vorhanden.id, operatorId: erstes }
		});
	});

	it('weist am Index auch ab, was an der Anwendung vorbeigeht, über alle Schreibweisen', async () => {
		// Das Aufsetzskript übernimmt die Schreibweise des Aufrufs; der Index
		// vergleicht deshalb über `lower(username)`.
		const erstes = await pruefbetreiber('Index erstes Haus');
		const zweites = await pruefbetreiber('Index zweites Haus');
		await admin`
			INSERT INTO app_user (operator_id, username, display_name, password_hash)
			VALUES (${erstes}, 'indexname', 'Konto Index A', 'x')
		`;

		for (const [betreiberDesVersuchs, name] of [
			[zweites, 'indexname'],
			[zweites, 'IndexName'],
			[erstes, 'INDEXNAME']
		]) {
			await expect(
				admin`
					INSERT INTO app_user (operator_id, username, display_name, password_hash)
					VALUES (${betreiberDesVersuchs}, ${name}, 'Konto Index B', 'x')
				`
			).rejects.toMatchObject({
				code: '23505',
				constraint_name: 'app_user_benutzername_eindeutig'
			});
		}
	});
});

describe('Der Verlauf', () => {
	it('hält jeden Eingriff fest — anlegen, Kennwort, Rolle, Dienst', async () => {
		const k = await konto('verlauf1', 'chair');
		await setzeKennwort(handelnder(), k.id, 'ganz neues langes kennwort', 'ganz neues langes kennwort');
		await aendereRolle(handelnder(), k.id, 'admin');
		await setzeAusserDienst(handelnder(handelnderId), k.id, true);

		const zeilen = await admin<{ event_type: string }[]>`
			SELECT event_type FROM audit_entry
			WHERE subject_type = 'app_user' AND subject_id = ${k.id}
			ORDER BY id
		`;
		const arten = zeilen.map((z) => z.event_type);
		expect(arten).toContain('user.created');
		expect(arten).toContain('user.password.set');
		expect(arten).toContain('user.role.changed');
		expect(arten).toContain('user.disabled');
	});
});
