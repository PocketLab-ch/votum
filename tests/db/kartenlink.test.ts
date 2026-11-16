/**
 * Der Kartenlink löst erst auf Formular ein (FP-1, 12.11.2026).
 *
 * **Der Anlass.** `GET /z/<code>` rief im `load` sofort `loeseCodeEin` auf. Je
 * Zugang ist nur ein Gerät zugelassen; damit verbrauchte jeder Vorschau-Bot
 * eines Messengers, jedes Mailprogramm und jeder Crawler den Code für ein
 * fremdes Gerät, und der Eigentümer kam mit seiner eigenen Karte nicht mehr
 * hinein. Jetzt merkt der Abruf den Code nur in einem kurzlebigen Keks vor;
 * eingelöst wird erst der POST der Aktion `?/karte` auf `/z`.
 *
 * Die Tests rufen `load` und die Aktion selbst auf, wie
 * `tests/db/absagen-statt-500-ladewege.test.ts`: Der geprüfte Weg sitzt in der
 * Schale, und ein Test gegen die Funktionen darunter sähe von ihm nichts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

/*
 * `$app/environment` gibt es ausserhalb von SvelteKit nicht; dieselbe
 * Begründung wie in `absagen-statt-500.test.ts`.
 */
vi.mock('$app/environment', () => ({
	building: false,
	browser: false,
	dev: true,
	version: 'test'
}));

import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erzeugeZugaenge } from '$lib/server/zugaenge';
import { holeUebersicht } from '$lib/server/anwesenheit';
import {
	KARTENSCANKEKS,
	KARTENSCANKEKS_PFAD,
	KARTENSCANKEKS_SEKUNDEN,
	ZUGANGS_COOKIE,
	gibCodeAus,
	loeseCodeEin,
	loeseSitzungAuf
} from '$lib/server/zugangssitzung';
import { normalisiere } from '$lib/domain/zugang';
import { load as kartenLoad } from '../../src/routes/z/[code]/+page.server';
import { actions as zAktionen, load as zLoad } from '../../src/routes/z/+page.server';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

function handelnder() {
	return { operatorId: betreiber, userId: null, label: 'Prüflauf' };
}

/**
 * Eine Versammlung mit einer stimmberechtigten Person.
 *
 * `eroeffnen: false` lässt sie im Zustand `freigegeben`, die Lage vor dem
 * Abend, in der FP-1b den Tipp verlangt.
 */
async function aufbau(name: string, datum: string, { eroeffnen = true } = {}) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e1 = await erstelleEinheit(handelnder(), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p1 = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna Muster',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(), e1.id, p1.id, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await gibVersammlungFrei(handelnder(), v.id);
	if (eroeffnen) await eroeffneVersammlung(handelnder(), v.id);

	return { versammlung: v.id, parteiId: p1.id };
}

interface Keks {
	name: string;
	wert: string;
	optionen: Record<string, unknown>;
}

/**
 * Ein Keksspeicher, der mitschreibt, was gesetzt und gelöscht wurde.
 *
 * SvelteKit reicht `cookies` als Objekt herein; für den Test genügt die Form,
 * die `setzeKartenscan`, `leseKartenscan`, `loescheKartenscan`, `setzeKeks` und
 * `leseKeks` benutzen.
 */
function kekse(start: Record<string, string> = {}) {
	const werte = new Map(Object.entries(start));
	const gesetzt: Keks[] = [];
	const geloescht: Keks[] = [];
	return {
		werte,
		gesetzt,
		geloescht,
		cookies: {
			get: (name: string) => werte.get(name),
			set: (name: string, wert: string, optionen: Record<string, unknown>) => {
				werte.set(name, wert);
				gesetzt.push({ name, wert, optionen });
			},
			delete: (name: string, optionen: Record<string, unknown>) => {
				werte.delete(name);
				geloescht.push({ name, wert: '', optionen });
			},
			getAll: () => [...werte].map(([name, value]) => ({ name, value })),
			serialize: () => ''
		}
	};
}

/** Was aus einem Aufruf herauskam. */
type Ausgang =
	| { art: 'erfolg'; wert: unknown }
	| { art: 'umleitung'; status: number; ziel: string }
	| { art: 'roh'; fehler: unknown };

async function fahre(aufruf: () => unknown): Promise<Ausgang> {
	try {
		return { art: 'erfolg', wert: await aufruf() };
	} catch (fehler) {
		if (isRedirect(fehler)) {
			return {
				art: 'umleitung',
				status: (fehler as { status: number }).status,
				ziel: String((fehler as { location: string }).location)
			};
		}
		return { art: 'roh', fehler };
	}
}

/**
 * Der POST der Aktion `?/karte`.
 *
 * `auto` schickt nur der Anstoss der Seite; der Knopf «Anmelden» lässt das
 * Feld weg (FP-1b, 12.11.2026). Der Tipp schickt deshalb einen Formularkörper
 * ohne `auto`, wie der Browser (Codeprüfung 12.11.2026): Ein POST ohne
 * Formularart erreicht die Aktion gar nicht, SvelteKit weist ihn vorher mit 415
 * ab. Ein Tipp ohne Körper prüfte deshalb einen Weg, den es nicht gibt, und
 * bliebe grün, wenn jeder Formular-POST als Anstoss gälte.
 */
function kartePosten(k: ReturnType<typeof kekse>, { auto = false } = {}) {
	return fahre(() =>
		zAktionen.karte({
			cookies: k.cookies,
			request: new Request('http://pruefung.example/z?/karte', {
				method: 'POST',
				headers: {
					'user-agent': 'Prüflauf',
					'content-type': 'application/x-www-form-urlencoded'
				},
				body: auto ? 'auto=1' : ''
			}),
			url: new URL('http://pruefung.example/z?/karte')
		} as never)
	);
}

/** Der Zähler der Codeversuche ist global; vor und nach dem Aufruf messen. */
async function versuche(): Promise<number> {
	const [zeile] = await imKontext(
		betreiber,
		(tx) => tx<{ n: number }[]>`SELECT coalesce(sum(count), 0)::int AS n FROM code_attempt`
	);
	return zeile.n;
}

async function zustandDerZugaenge(versammlung: string) {
	const [zeile] = await imKontext(
		betreiber,
		(tx) => tx<{ sitzungen: number; benutzt: string | null }[]>`
			SELECT
				(SELECT count(*)::int
				   FROM access_session s
				   JOIN meeting_access a ON a.id = s.meeting_access_id
				  WHERE a.meeting_id = ${versammlung}) AS sitzungen,
				(SELECT a.last_used_at::text
				   FROM meeting_access a
				  WHERE a.meeting_id = ${versammlung}
				  LIMIT 1) AS benutzt
		`
	);
	return { sitzungen: zeile.sitzungen, benutzt: zeile.benutzt };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Kartenlink');
});

afterAll(verbindungenSchliessen);

describe('GET /z/<code> löst den Code nicht mehr ein', () => {
	it('merkt den Code vor und leitet mit dem Keks auf /z', async () => {
		const { versammlung } = await aufbau('Kartenlink Abruf', '2026-09-15');
		const [zugang] = await erzeugeZugaenge(handelnder(), versammlung);
		const k = kekse();
		const vorher = await versuche();

		const ausgang = await fahre(() =>
			kartenLoad({
				params: { code: zugang.code },
				locals: {},
				cookies: k.cookies,
				url: new URL(`http://pruefung.example/z/${zugang.code}`)
			} as never)
		);

		expect(ausgang).toEqual({ art: 'umleitung', status: 303, ziel: '/z' });
		expect(k.gesetzt).toEqual([
			{
				name: KARTENSCANKEKS,
				wert: normalisiere(zugang.code),
				optionen: {
					path: KARTENSCANKEKS_PFAD,
					httpOnly: true,
					sameSite: 'lax',
					secure: false,
					maxAge: KARTENSCANKEKS_SEKUNDEN
				}
			}
		]);

		// Datenbank unverändert: keine Gerätesitzung, kein Benutzungsvermerk,
		// kein gezählter Codeversuch.
		expect(await zustandDerZugaenge(versammlung)).toEqual({ sitzungen: 0, benutzt: null });
		expect(await versuche()).toBe(vorher);
	},
	20000);

	it('gibt auf /z nur ein Kennzeichen zurück, nie den Code', async () => {
		const code = 'ABCD-EFGH-JKMN-PQRS-TWXY';
		const k = kekse({ [KARTENSCANKEKS]: normalisiere(code) });

		const daten = await zLoad({
			cookies: k.cookies,
			url: new URL('http://pruefung.example/z')
		} as never);

		expect(daten).toMatchObject({ angemeldet: false, kartewartet: true });
		expect(JSON.stringify(daten)).not.toContain(normalisiere(code));
	},
	20000);

	it('gilt auch bei einer bestehenden Sitzung', async () => {
		const { versammlung } = await aufbau('Kartenlink Wechsel', '2026-09-19');
		const [zugang] = await erzeugeZugaenge(handelnder(), versammlung);
		const e = await loeseCodeEin(zugang.code);
		const k = kekse({
			[ZUGANGS_COOKIE]: e.merkmal ?? '',
			[KARTENSCANKEKS]: 'ABCDEFGHJKMNPQRSTWXY'
		});

		const daten = await zLoad({
			cookies: k.cookies,
			url: new URL('http://pruefung.example/z')
		} as never);

		/*
		 * Der Scan wechselt den Zugang, wie der bisherige Weg über `/z/<code>`
		 * es tat. Ohne dieses Kennzeichen bliebe er wirkungslos, und wer die
		 * Karte eines anderen Hauses scannt, sähe weiter die alte Sitzung. Die
		 * alte Sitzung wird dafür gar nicht erst aufgelöst (Code-Review
		 * 12.11.2026): `load` nimmt den Zweig ohne Anmeldung.
		 */
		expect(daten).toMatchObject({ angemeldet: false, kartewartet: true });
		expect(JSON.stringify(daten)).not.toContain('ABCDEFGHJKMNPQRSTWXY');
	},
	20000);
});

describe('Die Aktion ?/karte löst den vorgemerkten Code ein', () => {
	it('endet bei Erfolg wie der bisherige Weg, mit gelöschtem Keks', async () => {
		const { versammlung, parteiId } = await aufbau('Kartenlink Aktion', '2026-09-16');
		const [zugang] = await erzeugeZugaenge(handelnder(), versammlung);
		const k = kekse({ [KARTENSCANKEKS]: zugang.code });

		const ausgang = await fahre(() =>
			zAktionen.karte({
				cookies: k.cookies,
				request: new Request('http://pruefung.example/z?/karte', {
					method: 'POST',
					headers: {
						'user-agent': 'Prüflauf',
						'content-type': 'application/x-www-form-urlencoded'
					},
					body: ''
				}),
				url: new URL('http://pruefung.example/z?/karte')
			} as never)
		);

		expect(ausgang).toEqual({ art: 'umleitung', status: 303, ziel: '/z' });
		expect(k.geloescht.map((x) => x.name)).toContain(KARTENSCANKEKS);
		expect(k.werte.has(KARTENSCANKEKS)).toBe(false);

		const sitzung = k.gesetzt.find((x) => x.name === ZUGANGS_COOKIE);
		expect(sitzung).toBeDefined();
		const befund = await loeseSitzungAuf(sitzung?.wert ?? '');
		expect(befund.gueltig).toBe(true);
		expect(befund.parteiId).toBe(parteiId);

		// Dieselbe Folge wie beim bisherigen Scan: die Person steht in der
		// Warteschlange der Sitzungsleitung.
		const uebersicht = await holeUebersicht(betreiber, versammlung);
		expect(uebersicht?.wartendeParteiIds).toContain(parteiId);
	},
	20000);

	it('endet bei Misserfolg auf ?stand=… und löscht den Keks ebenfalls', async () => {
		const { versammlung } = await aufbau('Kartenlink Fehlschlag', '2026-09-17');
		const k = kekse({ [KARTENSCANKEKS]: 'ABCDEFGHJKMNPQRSTWXY' });

		const ausgang = await fahre(() =>
			zAktionen.karte({
				cookies: k.cookies,
				request: new Request('http://pruefung.example/z?/karte', {
					method: 'POST',
					headers: {
						'user-agent': 'Prüflauf',
						'content-type': 'application/x-www-form-urlencoded'
					},
					body: ''
				}),
				url: new URL('http://pruefung.example/z?/karte')
			} as never)
		);

		expect(ausgang).toEqual({ art: 'umleitung', status: 303, ziel: '/z?stand=unbekannt' });
		expect(k.geloescht.map((x) => x.name)).toContain(KARTENSCANKEKS);
		expect(k.werte.has(KARTENSCANKEKS)).toBe(false);
		expect(k.gesetzt.some((x) => x.name === ZUGANGS_COOKIE)).toBe(false);
		expect(await zustandDerZugaenge(versammlung)).toEqual({ sitzungen: 0, benutzt: null });
	},
	20000);
});

describe('Der Anstoss löst vor Beginn nicht ein (FP-1b)', () => {
	it('Kriterium 1: antwortet mit tippen, lässt den Keks stehen und zählt den Versuch', async () => {
		const { versammlung } = await aufbau('Anstoss vor Beginn', '2026-09-20', {
			eroeffnen: false
		});
		const [zugang] = await erzeugeZugaenge(handelnder(), versammlung);
		const k = kekse({ [KARTENSCANKEKS]: zugang.code });
		const vorher = await versuche();

		const ausgang = await kartePosten(k, { auto: true });

		expect(ausgang).toEqual({ art: 'erfolg', wert: { tippen: true } });
		// Der Keks bleibt: Er gehört zu der Karte, die auf ihren Tipp wartet.
		expect(k.werte.get(KARTENSCANKEKS)).toBe(normalisiere(zugang.code));
		expect(k.geloescht).toEqual([]);
		expect(k.gesetzt).toEqual([]);
		// Kein Einlösen: keine Gerätesitzung, kein Benutzungsvermerk.
		expect(await zustandDerZugaenge(versammlung)).toEqual({ sitzungen: 0, benutzt: null });
		// Die Nachschau ist eine Prüfung des Codes und wird gezählt.
		expect(await versuche()).toBe(vorher + 1);

		// Und erst der Tipp löst ein, auch vor Beginn.
		const getippt = await kartePosten(k);

		expect(getippt).toEqual({ art: 'umleitung', status: 303, ziel: '/z' });
		expect(k.geloescht.map((x) => x.name)).toEqual([KARTENSCANKEKS]);
		const sitzung = k.gesetzt.find((x) => x.name === ZUGANGS_COOKIE);
		expect(sitzung).toBeDefined();
		expect((await loeseSitzungAuf(sitzung?.wert ?? '')).gueltig).toBe(true);
	},
	20000);

	it('Kriterium 2: löst während der Versammlung ein, wie ohne Anstoss', async () => {
		const { versammlung, parteiId } = await aufbau('Anstoss laufend', '2026-09-21');
		const [zugang] = await erzeugeZugaenge(handelnder(), versammlung);
		const k = kekse({ [KARTENSCANKEKS]: zugang.code });

		const ausgang = await kartePosten(k, { auto: true });

		expect(ausgang).toEqual({ art: 'umleitung', status: 303, ziel: '/z' });
		expect(k.werte.has(KARTENSCANKEKS)).toBe(false);
		const sitzung = k.gesetzt.find((x) => x.name === ZUGANGS_COOKIE);
		expect(sitzung).toBeDefined();
		expect((await loeseSitzungAuf(sitzung?.wert ?? '')).parteiId).toBe(parteiId);

		// Dieselbe Folge wie ohne Anstoss: die Person steht in der Warteschlange.
		const uebersicht = await holeUebersicht(betreiber, versammlung);
		expect(uebersicht?.wartendeParteiIds).toContain(parteiId);
	},
	20000);

	it('Kriterium 4: ein unbekannter Code bekommt dieselbe Antwort wie eine Karte vor Beginn', async () => {
		const k = kekse({ [KARTENSCANKEKS]: 'ABCDEFGHJKMNPQRSTWXY' });
		const vorher = await versuche();

		const ausgang = await kartePosten(k, { auto: true });

		expect(ausgang).toEqual({ art: 'erfolg', wert: { tippen: true } });
		expect(k.werte.has(KARTENSCANKEKS)).toBe(true);
		expect(await versuche()).toBe(vorher + 1);

		// Erst der Tipp nennt den Grund; der Anstoss verrät nichts.
		const getippt = await kartePosten(k);

		expect(getippt).toEqual({ art: 'umleitung', status: 303, ziel: '/z?stand=unbekannt' });
		expect(k.werte.has(KARTENSCANKEKS)).toBe(false);
	},
	20000);

	it('Kriterium 4: ein Formfehler bekommt dieselbe Antwort und behält den Keks', async () => {
		// `/z/----` legt einen leeren Keks an; er scheitert schon an der Form
		// (Gegenprobe des Prüfschritts 12.11.2026: ohne diesen Fall blieb ein
		// gelöschter Keks unbemerkt).
		const k = kekse({ [KARTENSCANKEKS]: '' });
		const vorher = await versuche();

		const ausgang = await kartePosten(k, { auto: true });

		expect(ausgang).toEqual({ art: 'erfolg', wert: { tippen: true } });
		expect(k.werte.has(KARTENSCANKEKS)).toBe(true);
		expect(await versuche()).toBe(vorher + 1);
	},
	20000);

	it('Kriterium 5: ein Ausgabecode löst auch vor Beginn ohne Nachschau ein', async () => {
		const { versammlung, parteiId } = await aufbau('Anstoss Ausgabecode', '2026-09-22', {
			eroeffnen: false
		});
		await erzeugeZugaenge(handelnder(), versammlung);
		const a = await gibCodeAus(handelnder(), versammlung, parteiId);
		const k = kekse({ [KARTENSCANKEKS]: a.code });
		const vorher = await versuche();

		const ausgang = await kartePosten(k, { auto: true });

		expect(ausgang).toEqual({ art: 'umleitung', status: 303, ziel: '/z' });
		expect(k.werte.has(KARTENSCANKEKS)).toBe(false);
		expect(k.gesetzt.some((x) => x.name === ZUGANGS_COOKIE)).toBe(true);
		// Genau ein Versuch: `loeseCodeEin`. Eine Nachschau hätte ein zweites
		// Mal gezählt und mit `tippen` geantwortet.
		expect(await versuche()).toBe(vorher + 1);
	},
	20000);
});

describe('Ein leerer Code verliert seine Meldung nicht', () => {
	it('zählt den Versuch und endet auf ?stand=unbekannt', async () => {
		// `/z/----` ergibt nach `normalisiere` einen leeren Keks.
		const k = kekse({ [KARTENSCANKEKS]: '' });
		const vorher = await versuche();

		const ausgang = await fahre(() =>
			zAktionen.karte({
				cookies: k.cookies,
				request: new Request('http://pruefung.example/z?/karte', {
					method: 'POST',
					headers: {
						'user-agent': 'Prüflauf',
						'content-type': 'application/x-www-form-urlencoded'
					},
					body: ''
				}),
				url: new URL('http://pruefung.example/z?/karte')
			} as never)
		);

		expect(ausgang).toEqual({ art: 'umleitung', status: 303, ziel: '/z?stand=unbekannt' });
		expect(k.werte.has(KARTENSCANKEKS)).toBe(false);
		expect(await versuche()).toBeGreaterThan(vorher);
	},
	20000);
});

describe('Ohne Keks tut die Aktion nichts', () => {
	it('leitet auf /z und rührt die Datenbank nicht an', async () => {
		const { versammlung } = await aufbau('Kartenlink ohne Keks', '2026-09-18');
		await erzeugeZugaenge(handelnder(), versammlung);
		const k = kekse();
		const vorher = await versuche();

		const ausgang = await fahre(() =>
			zAktionen.karte({
				cookies: k.cookies,
				request: new Request('http://pruefung.example/z?/karte', {
					method: 'POST',
					headers: {
						'user-agent': 'Prüflauf',
						'content-type': 'application/x-www-form-urlencoded'
					},
					body: ''
				}),
				url: new URL('http://pruefung.example/z?/karte')
			} as never)
		);

		expect(ausgang).toEqual({ art: 'umleitung', status: 303, ziel: '/z' });
		expect(k.geloescht.map((x) => x.name)).toContain(KARTENSCANKEKS);
		expect(k.gesetzt).toEqual([]);
		expect(await zustandDerZugaenge(versammlung)).toEqual({ sitzungen: 0, benutzt: null });
		expect(await versuche()).toBe(vorher);
	},
	20000);
});
