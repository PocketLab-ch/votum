/**
 * Äussere Dienste in der Anwendung einrichten (14.08.2026).
 *
 * Drei Dinge, die nur hier zu prüfen sind, weil sie an der Datenhaltung hängen:
 *
 *  1. **Der Schlüssel liegt verschlüsselt.** Ein Datenbankauszug darf ihn nicht
 *     hergeben — das ist der ganze Zweck des Tresors.
 *  2. **Vorrang der Anwendung vor der Umgebung.** Sonst liesse sich in der
 *     Oberfläche nichts ändern, solange die Umgebung etwas trägt.
 *  3. **Ein leeres Schlüsselfeld heisst «unverändert», nicht «löschen».** Sonst
 *     verlöre ein blosser Namenswechsel den Zugang, und niemand merkte es, bis
 *     im Saal jemand auf «Vorschlag holen» drückt.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import {
	aendereKistufe,
	entferneErsatzdienst,
	entferneKistufe,
	entferneZeitstempeldienst,
	hefteAn,
	holeDienstelage,
	holePruefzeitstempel,
	legeKistufeAn,
	setzeErsatzdienst,
	setzeZeitstempeldienst,
	uebernimmAusUmgebung,
	verschiebeKistufe
} from '$lib/server/dienste';
import { anwendungsstufen, stufen } from '$lib/server/ki';
import { dienst, ersatzdienst, findeUnterzeichner } from '$lib/server/zeitstempel';
import { GEHEIMNIS_VARIABLE } from '$lib/server/tresor';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { normalisiereFingerabdruck } from '$lib/domain/dienste';
import { leseAntwort } from '$lib/domain/rfc3161';
import { KETTEN_ANTWORT, KETTEN_PRUEFSUMME } from './zeitstempel-kette.fixture';

/**
 * Der aufgezeichnete Zufallswert der Probewerte (13.11.2026).
 *
 * `holePruefzeitstempel` stempelt auf einen frischen Zufallswert und
 * `einVersuch` schickt einen frischen Zufallswert mit. Eine aufgezeichnete
 * Antwort trägt beides von damals; ohne diese Prüfstandsverkürzung entstünde
 * im Prüflauf kein gültiger Stempel. Nur die Proben schalten sie ein, und nur
 * für ihre beiden Grössen.
 */
const pruefZufall = vi.hoisted(() => ({ nonce: null as string | null, probe: null as string | null }));

vi.mock('node:crypto', async (importOriginal) => {
	const echt = await importOriginal<typeof import('node:crypto')>();
	return {
		...echt,
		randomBytes: (n: number) => {
			if (n === 8 && pruefZufall.nonce !== null) return Buffer.from(pruefZufall.nonce, 'hex');
			if (n === 32 && pruefZufall.probe !== null) return Buffer.from(pruefZufall.probe, 'hex');
			return echt.randomBytes(n);
		}
	};
});

let betreiber: string;
let benutzer: string;

const stufe = {
	name: 'Prüfhaus (CH)',
	url: 'https://haus.example.com/v1/chat/completions',
	modell: 'pruefmodell',
	geduldMs: 9000,
	schluessel: 'sk-geheim-1234567890'
};

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Dienste-Prüflauf');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
	// Ohne Geheimnis liessen sich keine Schlüssel ablegen — dann prüfte die
	// halbe Datei nichts.
	process.env[GEHEIMNIS_VARIABLE] = 'a1'.repeat(32);
});

afterAll(verbindungenSchliessen);

beforeEach(async () => {
	await imKontext(betreiber, async (tx) => {
		await tx`DELETE FROM ai_stage WHERE operator_id = ${betreiber}`;
		await tx`
			UPDATE operator SET
				tsa_url = NULL, tsa_name = NULL, tsa_fingerprints = NULL,
				tsa_fallback_url = NULL, tsa_fallback_name = NULL, tsa_fallback_fingerprints = NULL
			WHERE id = ${betreiber}
		`;
	});
});

describe('Die KI-Kette', () => {
	it('legt eine Stufe an und liest sie zurück', async () => {
		const { nummer } = await legeKistufeAn(handelnder(), stufe);
		expect(nummer).toBe(1);

		const kette = await anwendungsstufen(betreiber);
		expect(kette).toHaveLength(1);
		expect(kette[0].name).toBe(stufe.name);
		expect(kette[0].modell).toBe(stufe.modell);
		expect(kette[0].geduldMs).toBe(9000);
		expect(kette[0].quelle).toBe('anwendung');
		// Entschlüsselt kommt er zurück — die Kette braucht ihn zum Anrufen.
		expect(kette[0].schluessel).toBe(stufe.schluessel);
	});

	/** Der Zweck des Tresors: In der Tabelle steht der Schlüssel nicht. */
	it('legt den Zugangsschlüssel verschlüsselt ab', async () => {
		await legeKistufeAn(handelnder(), stufe);

		const [zeile] = await imKontext(betreiber, async (tx) => {
			return tx<{ api_key_enc: string }[]>`
				SELECT api_key_enc FROM ai_stage WHERE operator_id = ${betreiber}
			`;
		});
		expect(zeile.api_key_enc).not.toContain('sk-geheim');
		expect(zeile.api_key_enc.startsWith('v1:')).toBe(true);
	});

	/** Was die Seite anzeigen darf: eine Andeutung, nie der Wert. */
	it('gibt an die Anzeige nur eine Andeutung des Schlüssels', async () => {
		await legeKistufeAn(handelnder(), stufe);
		const lage = await holeDienstelage(betreiber);
		expect(lage.kette[0].schluessel).not.toBe(stufe.schluessel);
		expect(lage.kette[0].schluessel).toMatch(/^sk-…890$/);
	});

	it('hängt weitere Stufen hinten an, statt die erste zu verdrängen', async () => {
		await legeKistufeAn(handelnder(), stufe);
		const zweite = await legeKistufeAn(handelnder(), {
			...stufe,
			name: 'Ausweichhaus (EU)',
			schluessel: ''
		});
		expect(zweite.nummer).toBe(2);

		const kette = await anwendungsstufen(betreiber);
		expect(kette.map((s) => s.name)).toEqual([stufe.name, 'Ausweichhaus (EU)']);
		expect(kette[1].schluessel).toBeNull();
	});

	/*
	 * Der Fall, der ohne Test verlorenginge: Wer nur die Bezeichnung ändert,
	 * lässt das Kennwortfeld leer. Würde das als «keinen Schlüssel» gelesen,
	 * verlöre die Stufe ihren Zugang — sichtbar erst beim nächsten Anruf.
	 */
	it('lässt den Schlüssel stehen, wenn das Feld leer bleibt', async () => {
		await legeKistufeAn(handelnder(), stufe);
		const [vorher] = await anwendungsstufen(betreiber);

		await aendereKistufe(handelnder(), vorher.id!, {
			name: 'Neuer Name',
			url: stufe.url,
			modell: stufe.modell,
			geduldMs: stufe.geduldMs,
			schluessel: ''
		});

		const [nachher] = await anwendungsstufen(betreiber);
		expect(nachher.name).toBe('Neuer Name');
		expect(nachher.schluessel).toBe(stufe.schluessel);
	});

	it('ersetzt den Schlüssel, wenn einer eingetragen wird', async () => {
		await legeKistufeAn(handelnder(), stufe);
		const [vorher] = await anwendungsstufen(betreiber);

		await aendereKistufe(handelnder(), vorher.id!, { ...stufe, schluessel: 'sk-neu-0987654321' });

		const [nachher] = await anwendungsstufen(betreiber);
		expect(nachher.schluessel).toBe('sk-neu-0987654321');
	});

	it('entfernt den Schlüssel nur auf ausdrückliche Ansage', async () => {
		await legeKistufeAn(handelnder(), stufe);
		const [vorher] = await anwendungsstufen(betreiber);

		await aendereKistufe(handelnder(), vorher.id!, {
			...stufe,
			schluessel: '',
			schluesselEntfernen: true
		});

		const [nachher] = await anwendungsstufen(betreiber);
		expect(nachher.schluessel).toBeNull();
	});

	/*
	 * Anders als bei der Umgebung darf eine Lücke die Kette nicht beenden: Dort
	 * ist eine fehlende Nummer wahrscheinlich ein Tippfehler, hier eine Zeile,
	 * die jemand entfernt hat.
	 */
	it('macht nach dem Entfernen der ersten die zweite zur ersten', async () => {
		await legeKistufeAn(handelnder(), stufe);
		await legeKistufeAn(handelnder(), { ...stufe, name: 'Zweites Haus', schluessel: '' });
		const [erste] = await anwendungsstufen(betreiber);

		await entferneKistufe(handelnder(), erste.id!);

		const kette = await anwendungsstufen(betreiber);
		expect(kette).toHaveLength(1);
		expect(kette[0].name).toBe('Zweites Haus');
		expect(kette[0].nummer).toBe(1);
	});

	/*
	 * Umordnen (17.08.2026). Die Reihenfolge ist die Aussage: Stufe 1 ist das
	 * Modell, das im Saal antwortet. Bis dahin liess sie sich nur beim Anlegen
	 * bestimmen — wer tauschen wollte, musste beide Stufen entfernen und neu
	 * anlegen und verlor dabei die Zugangsschlüssel.
	 */
	it('tauscht zwei Stufen und behält dabei Schlüssel und Angaben', async () => {
		await legeKistufeAn(handelnder(), stufe);
		await legeKistufeAn(handelnder(), {
			...stufe,
			name: 'Ausweichhaus (EU)',
			schluessel: 'sk-zweiter-9876543210'
		});
		const [, zweite] = await anwendungsstufen(betreiber);

		const ergebnis = await verschiebeKistufe(handelnder(), zweite.id!, 'vor');
		expect(ergebnis).toEqual({ name: 'Ausweichhaus (EU)', nummer: 1 });

		const kette = await anwendungsstufen(betreiber);
		expect(kette.map((s) => s.name)).toEqual(['Ausweichhaus (EU)', stufe.name]);
		expect(kette.map((s) => s.nummer)).toEqual([1, 2]);
		// Der Schlüssel wandert mit — genau das ging beim Weg über Entfernen und
		// Neuanlegen verloren.
		expect(kette[0].schluessel).toBe('sk-zweiter-9876543210');
		expect(kette[1].schluessel).toBe(stufe.schluessel);
	});

	it('schiebt auch nach hinten und lässt die Kette dabei lückenlos', async () => {
		await legeKistufeAn(handelnder(), stufe);
		await legeKistufeAn(handelnder(), { ...stufe, name: 'Zweites', schluessel: '' });
		await legeKistufeAn(handelnder(), { ...stufe, name: 'Drittes', schluessel: '' });
		const [erste] = await anwendungsstufen(betreiber);

		await verschiebeKistufe(handelnder(), erste.id!, 'zurueck');

		const kette = await anwendungsstufen(betreiber);
		expect(kette.map((s) => s.name)).toEqual(['Zweites', stufe.name, 'Drittes']);
		expect(kette.map((s) => s.nummer)).toEqual([1, 2, 3]);
	});

	/*
	 * **Der Fall, für den Migration 065 da ist.** Neun Stufen belegen jede
	 * zulässige Nummer (CHECK 1..9); ein Tausch über einen freien Hilfswert wäre
	 * hier unmöglich. Nur weil die Eindeutigkeit aufgeschoben gilt, darf der
	 * Zwischenstand zwei gleiche Nummern tragen.
	 */
	it('tauscht auch dann, wenn alle neun Nummern belegt sind', async () => {
		for (let n = 1; n <= 9; n++) {
			await legeKistufeAn(handelnder(), { ...stufe, name: `Haus ${n}`, schluessel: '' });
		}
		const kette = await anwendungsstufen(betreiber);
		expect(kette).toHaveLength(9);

		await verschiebeKistufe(handelnder(), kette[8].id!, 'vor');

		const nachher = await anwendungsstufen(betreiber);
		expect(nachher.map((s) => s.name).slice(7)).toEqual(['Haus 9', 'Haus 8']);
	});

	it('weist den Schritt über den Rand ab, statt still nichts zu tun', async () => {
		await legeKistufeAn(handelnder(), stufe);
		await legeKistufeAn(handelnder(), { ...stufe, name: 'Zweites', schluessel: '' });
		const [erste] = await anwendungsstufen(betreiber);

		await expect(verschiebeKistufe(handelnder(), erste.id!, 'vor')).rejects.toThrow(
			FachlicherFehler
		);
		const kette = await anwendungsstufen(betreiber);
		expect(kette.map((s) => s.name)).toEqual([stufe.name, 'Zweites']);
	});

	it('hält das Umstellen als eigene Art im Verlauf fest', async () => {
		await legeKistufeAn(handelnder(), stufe);
		await legeKistufeAn(handelnder(), { ...stufe, name: 'Zweites', schluessel: '' });
		const [, zweite] = await anwendungsstufen(betreiber);

		await verschiebeKistufe(handelnder(), zweite.id!, 'vor');

		const [jüngster] = await imKontext(betreiber, async (tx) => {
			return tx<{ event_type: string; detail: Record<string, unknown> }[]>`
				SELECT event_type, detail FROM audit_entry
				WHERE operator_id = ${betreiber} AND event_type LIKE 'ai.stage%'
				ORDER BY id DESC LIMIT 1
			`;
		});
		expect(jüngster.event_type).toBe('ai.stage.moved');
		expect(jüngster.detail).toMatchObject({ name: 'Zweites', von: 2, nach: 1 });
	});

	it('hält jeden Eingriff im Verlauf fest — ohne den Schlüssel', async () => {
		await legeKistufeAn(handelnder(), stufe);

		// Der jüngste Eintrag, nicht alle: Der Verlauf ist anfügbar (AD-5) und
		// trägt deshalb auch, was die Tests davor angelegt haben. Nach `id`
		// sortiert und nicht nach der Zeit — mehrere Einträge derselben
		// Millisekunde hätten sonst keine bestimmte Reihenfolge.
		const [jüngster] = await imKontext(betreiber, async (tx) => {
			return tx<{ event_type: string; detail: Record<string, unknown> }[]>`
				SELECT event_type, detail FROM audit_entry
				WHERE operator_id = ${betreiber} AND event_type LIKE 'ai.stage%'
				ORDER BY id DESC LIMIT 1
			`;
		});
		expect(jüngster.event_type).toBe('ai.stage.created');
		expect(jüngster.detail.name).toBe(stufe.name);
		expect(jüngster.detail.mitSchluessel).toBe(true);
		expect(JSON.stringify(jüngster.detail)).not.toContain('sk-geheim');
	});
});

describe('Vorrang zwischen Anwendung und Umgebung', () => {
	/*
	 * **Die Umgebung des Prüfstands ist die echte.** Auf dem Entwicklungsrechner
	 * stehen dort zwei Stufen; ein Test, der eine erwartet, zählte in Wahrheit
	 * die `.env` mit. Deshalb wird hier genau eine gesetzt und alles Weitere
	 * geräumt — und danach zurückgestellt, damit die übrigen Läufe die Anlage
	 * vorfinden, die sie erwarten.
	 */
	const gemerkt = new Map<string, string | undefined>();

	beforeEach(() => {
		for (let n = 1; n <= 9; n++) {
			for (const feld of ['NAME', 'URL', 'MODELL', 'SCHLUESSEL', 'GEDULD']) {
				const name = `VERSAMMLUNG_KI_${n}_${feld}`;
				if (!gemerkt.has(name)) gemerkt.set(name, process.env[name]);
				delete process.env[name];
			}
		}
		process.env.VERSAMMLUNG_KI_1_NAME = 'Aus der Umgebung';
		process.env.VERSAMMLUNG_KI_1_URL = 'https://umgebung.example.com/v1/chat/completions';
		process.env.VERSAMMLUNG_KI_1_MODELL = 'umgebungsmodell';
	});

	afterAll(() => {
		for (const [name, wert] of gemerkt) {
			if (wert === undefined) delete process.env[name];
			else process.env[name] = wert;
		}
	});

	it('nimmt die Umgebung, solange in der Anwendung nichts steht', async () => {
		const kette = await stufen(betreiber);
		expect(kette[0].name).toBe('Aus der Umgebung');
		expect(kette[0].quelle).toBe('umgebung');
	});

	it('nimmt die Anwendung, sobald dort etwas steht — und mischt nicht', async () => {
		await legeKistufeAn(handelnder(), stufe);

		const kette = await stufen(betreiber);
		expect(kette).toHaveLength(1);
		expect(kette[0].name).toBe(stufe.name);
		expect(kette[0].quelle).toBe('anwendung');

		// Die Anzeige sagt, dass daneben noch etwas wartet — sonst sucht jemand
		// den Grund an der falschen Stelle.
		const lage = await holeDienstelage(betreiber);
		expect(lage.kiQuelle).toBe('anwendung');
		expect(lage.umgebungswartet).toBe(1);
	});

	it('übernimmt die Umgebung auf Ansage in die Anwendung', async () => {
		const { stufen: anzahl } = await uebernimmAusUmgebung(handelnder());
		expect(anzahl).toBe(1);

		const kette = await anwendungsstufen(betreiber);
		expect(kette[0].name).toBe('Aus der Umgebung');
		expect(kette[0].quelle).toBe('anwendung');
	});

	it('übernimmt nicht ein zweites Mal — das verdoppelte die Kette', async () => {
		await uebernimmAusUmgebung(handelnder());
		await expect(uebernimmAusUmgebung(handelnder())).rejects.toThrow(FachlicherFehler);
	});
});

describe('Der Zeitstempeldienst', () => {
	it('trägt Adresse und Abdrücke ein und normalisiert sie dabei', async () => {
		const { hinweise } = await setzeZeitstempeldienst(handelnder(), {
			url: 'https://freetsa.example.org/tsr',
			name: 'Prüfstelle',
			// Ohne Doppelpunkte eingegeben — abgelegt wird die Form, gegen die
			// später verglichen wird.
			fingerabdruecke: 'ab'.repeat(32)
		});
		expect(hinweise).toEqual([]);

		const d = await dienst(betreiber);
		expect(d?.name).toBe('Prüfstelle');
		expect(d?.quelle).toBe('anwendung');
		expect(d?.fingerabdruecke[0]).toMatch(/^AB:AB:/);
	});

	it('nimmt einen Dienst ohne Anheftung an, sagt aber, was fehlt', async () => {
		const { hinweise } = await setzeZeitstempeldienst(handelnder(), {
			url: 'https://freetsa.example.org/tsr',
			name: '',
			fingerabdruecke: ''
		});
		expect(hinweise[0]).toMatch(/jede Antwort/);

		// Ohne Bezeichnung nimmt er den Wirtsnamen — eine leere Stelle im Siegel
		// wäre schlechter als ein technischer Name.
		expect((await dienst(betreiber))?.name).toBe('freetsa.example.org');
	});

	it('entfernt ihn wieder und fällt dann auf die Umgebung zurück', async () => {
		await setzeZeitstempeldienst(handelnder(), {
			url: 'https://freetsa.example.org/tsr',
			name: 'Prüfstelle',
			fingerabdruecke: ''
		});
		await entferneZeitstempeldienst(handelnder());

		// Auf dem Prüfstand steht in der Umgebung nichts — dann ist gar keiner da.
		const d = await dienst(betreiber);
		expect(d === null || d.quelle === 'umgebung').toBe(true);
	});
});

/**
 * Der Ersatzdienst (13.11.2026).
 *
 * **Was hier zählt, ist die Trennung.** Er hat eine eigene Adresse und eine
 * eigene Liste angehefteter Abdrücke, und das Entfernen des einen lässt den
 * anderen stehen. Wären beide ein Eintrag, verlöre ein Wechsel des Hauptdienstes
 * still die Ausweichung, und gemerkt würde es erst, wenn sie gebraucht wird.
 */
describe('Der Ersatzdienst', () => {
	const ERSATZ = {
		url: 'https://freetsa.example.org/tsr',
		name: 'Free TSA',
		fingerabdruecke: 'cd'.repeat(32)
	};

	it('steht neben dem Hauptdienst, mit eigener Adresse und eigenem Abdruck', async () => {
		await setzeZeitstempeldienst(handelnder(), {
			url: 'https://digicert.example.com/tsr',
			name: 'DigiCert',
			fingerabdruecke: 'ab'.repeat(32)
		});
		const { hinweise } = await setzeErsatzdienst(handelnder(), ERSATZ);
		expect(hinweise).toEqual([]);

		const haupt = await dienst(betreiber);
		const ersatz = await ersatzdienst(betreiber);
		expect(haupt?.name).toBe('DigiCert');
		expect(ersatz?.name).toBe('Free TSA');
		expect(ersatz?.fingerabdruecke[0]).toMatch(/^CD:CD:/);
		// Getrennte Listen: Der Abdruck des einen steht nicht beim anderen.
		expect(haupt?.fingerabdruecke[0]).toMatch(/^AB:AB:/);

		// Und die Anzeige der Maske führt beide.
		const lage = await holeDienstelage(betreiber);
		expect(lage.zeitstempel?.name).toBe('DigiCert');
		expect(lage.ersatz?.name).toBe('Free TSA');
	});

	it('bleibt stehen, wenn der Hauptdienst entfernt wird', async () => {
		await setzeZeitstempeldienst(handelnder(), {
			url: 'https://digicert.example.com/tsr',
			name: 'DigiCert',
			fingerabdruecke: 'ab'.repeat(32)
		});
		await setzeErsatzdienst(handelnder(), ERSATZ);

		await entferneZeitstempeldienst(handelnder());

		// **Der Kern der Zusage.** Wer den Hauptdienst entfernt, entfernt nicht
		// die Ausweichung: Sie ist eine eigene Einstellung mit eigenem Verlauf.
		expect(await dienst(betreiber)).toBeNull();
		expect((await ersatzdienst(betreiber))?.name).toBe('Free TSA');
	});

	it('lässt sich entfernen und steht mit Setzen und Entfernen im Verlauf', async () => {
		// Der Verlauf ist anfügbar, und die Tests dieser Datei teilen den
		// Betreiber. Gemessen wird deshalb nur, was dieser eine Lauf schreibt.
		const [marke] = await admin<{ id: number }[]>`
			SELECT coalesce(max(id), 0)::int AS id FROM audit_entry
		`;
		await setzeErsatzdienst(handelnder(), ERSATZ);
		await entferneErsatzdienst(handelnder());

		expect(await ersatzdienst(betreiber)).toBeNull();

		const eintraege = await admin<{ event_type: string; detail: Record<string, unknown> }[]>`
			SELECT event_type, detail FROM audit_entry
			 WHERE operator_id = ${betreiber}
			   AND event_type IN ('tsa.fallback.configured', 'tsa.fallback.removed')
			   AND id > ${marke.id}
			 ORDER BY id
		`;
		expect(eintraege.map((e) => e.event_type)).toEqual([
			'tsa.fallback.configured',
			'tsa.fallback.removed'
		]);
		// Die Adresse steht im Eintrag, ein Geheimnis gibt es hier keines.
		expect(eintraege[0].detail).toMatchObject({ url: ERSATZ.url, name: ERSATZ.name, angeheftet: 1 });
	});

	it('prüft die Eingabe mit denselben Regeln wie der Hauptdienst', async () => {
		await expect(
			setzeErsatzdienst(handelnder(), { url: 'freetsa.example.org/tsr', name: '', fingerabdruecke: '' })
		).rejects.toThrow(FachlicherFehler);
		await expect(
			setzeErsatzdienst(handelnder(), {
				url: 'https://freetsa.example.org/tsr',
				name: '',
				fingerabdruecke: 'kein-abdruck'
			})
		).rejects.toThrow(/kein SHA-256-Fingerabdruck/);
	});
});

/**
 * Probe und Anheften je Dienst (13.11.2026, Korrektur K2).
 *
 * **Warum die Zähler der eigentliche Test sind.** Beide Dienste sehen von
 * aussen gleich aus; nur der nachgebaute Server weiss, wer gefragt wurde. Und
 * beim Anheften entscheidet die Spalte, in der der Abdruck landet: dieselbe
 * Liste für beide machte aus zwei Vertrauensstellen eine.
 */
describe('Probe und Anheften je Dienst', () => {
	const ABDRUCK = 'AB'.repeat(32);
	const ZWEITER = 'CD'.repeat(32);
	let dienste: Server[] = [];

	afterEach(async () => {
		pruefZufall.nonce = null;
		pruefZufall.probe = null;
		for (const d of dienste) await new Promise((f) => d.close(f));
		dienste = [];
	});

	/** Ein nachgebauter Dienst, der zählt, wie oft er gefragt wurde. */
	async function dienstAn(antwort: Uint8Array | null) {
		const zaehler = { anfragen: 0 };
		const server = createServer((anfrage, abfrage) => {
			anfrage.on('data', () => {});
			anfrage.on('end', () => {
				zaehler.anfragen++;
				abfrage.writeHead(antwort ? 200 : 503, {
					'content-type': 'application/timestamp-reply'
				});
				abfrage.end(antwort ? Buffer.from(antwort) : '');
			});
		});
		await new Promise<void>((f) => server.listen(0, '127.0.0.1', f));
		dienste.push(server);
		const port = (server.address() as { port: number }).port;
		return { zaehler, url: `http://127.0.0.1:${port}/` };
	}

	it('fragt die Probe des Ersatzes nur beim Ersatz', async () => {
		const haupt = await dienstAn(null);
		const ersatz = await dienstAn(null);

		await setzeZeitstempeldienst(handelnder(), {
			url: haupt.url,
			name: 'DigiCert',
			fingerabdruecke: ABDRUCK
		});
		await setzeErsatzdienst(handelnder(), {
			url: ersatz.url,
			name: 'Free TSA',
			fingerabdruecke: ABDRUCK
		});

		const probe = await holePruefzeitstempel(betreiber, 'ersatz');

		expect(probe.art).toBe('ersatz');
		// **Die Zahl ist der Test.** Vertauschte `art`-Zweige fragten den
		// Hauptdienst und hefteten dessen Abdruck beim Ersatz an.
		expect(ersatz.zaehler.anfragen).toBe(1);
		expect(haupt.zaehler.anfragen).toBe(0);
	});

	it('heftet beim Ersatz nur in dessen Liste und beim Hauptdienst nur in seine', async () => {
		await setzeZeitstempeldienst(handelnder(), {
			url: 'https://digicert.example.com/tsr',
			name: 'DigiCert',
			fingerabdruecke: ''
		});
		await setzeErsatzdienst(handelnder(), {
			url: 'https://freetsa.example.org/tsr',
			name: 'Free TSA',
			fingerabdruecke: ''
		});

		await hefteAn(handelnder(), ABDRUCK, 'ersatz');
		let [zeile] = await admin<{ tsa_fingerprints: string | null; tsa_fallback_fingerprints: string | null }[]>`
			SELECT tsa_fingerprints, tsa_fallback_fingerprints FROM operator WHERE id = ${betreiber}
		`;
		expect(zeile.tsa_fallback_fingerprints).toBe(normalisiereFingerabdruck(ABDRUCK));
		// Die Gegenprobe im selben Lauf: Der Hauptdienst bleibt unberührt.
		expect(zeile.tsa_fingerprints).toBeNull();

		await hefteAn(handelnder(), ZWEITER, 'haupt');
		[zeile] = await admin<{ tsa_fingerprints: string | null; tsa_fallback_fingerprints: string | null }[]>`
			SELECT tsa_fingerprints, tsa_fallback_fingerprints FROM operator WHERE id = ${betreiber}
		`;
		expect(zeile.tsa_fingerprints).toBe(normalisiereFingerabdruck(ZWEITER));
		expect(zeile.tsa_fallback_fingerprints).toBe(normalisiereFingerabdruck(ABDRUCK));
	});

	it('zeigt nach einem Zertifikatswechsel den neuen Abdruck und heftet nichts an', async () => {
		/*
		 * **Die DigiCert-Falle** (Auftrag 13.11.2026, K6). Der Hauptdienst
		 * stempelt einwandfrei, aber sein Zertifikat ist nicht mehr das
		 * angeheftete. Bis dahin meldete die Probe nur «nicht hinterlegt»; der
		 * neue Abdruck war nirgends zu sehen, und der einzige Weg zum Anheften
		 * war Handarbeit.
		 */
		const token = leseAntwort(Uint8Array.from(Buffer.from(KETTEN_ANTWORT, 'base64'))).token!;
		pruefZufall.nonce = token.zufall;
		pruefZufall.probe = KETTEN_PRUEFSUMME;

		const haupt = await dienstAn(Uint8Array.from(Buffer.from(KETTEN_ANTWORT, 'base64')));
		const ALT = '99'.repeat(32);
		await setzeZeitstempeldienst(handelnder(), {
			url: haupt.url,
			name: 'DigiCert',
			fingerabdruecke: ALT
		});

		const probe = await holePruefzeitstempel(betreiber, 'haupt');

		expect(probe.art).toBe('haupt');
		expect(probe.nurAnheftungFehlt).toBe(true);
		// Der Stempel selbst ist in Ordnung; das ist der Unterschied zu einem
		// kaputten Dienst.
		expect(probe.ok).toBe(true);
		expect(probe.fingerabdruck).toBe(findeUnterzeichner(token)!.fingerprint256);
		expect(probe.angeheftet).toBe(false);
		expect(probe.aussteller).toBeTruthy();
		expect(probe.ausstellerGueltigBis).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(probe.bemerkung).toMatch(/nicht hinterlegt/);

		// **Abgelegt wird nichts.** Die Probe schlägt nur vor; angeheftet wird
		// erst auf einen eigenen Klick nach eigener Prüfung.
		const [zeile] = await admin<{ tsa_fingerprints: string | null }[]>`
			SELECT tsa_fingerprints FROM operator WHERE id = ${betreiber}
		`;
		expect(zeile.tsa_fingerprints).toBe(normalisiereFingerabdruck(ALT));
		expect(zeile.tsa_fingerprints).not.toContain(probe.fingerabdruck!);
	}, 30000);

	it('bietet einen Stempel, der an einer anderen Prüfung scheitert, nicht zum Anheften an', async () => {
		/*
		 * **Die Gegenrichtung zu K6** (Codeprüfung 13.11.2026, N8). Angeboten
		 * wird nur, wenn allein die Anheftung fehlt. Hier passt der Zufallswert
		 * nicht (die Probe würfelt ihn neu), der Abdruck wäre ebenfalls nicht
		 * angeheftet. Stünde die Prüfung der Anheftung in `pruefeToken` vor der
		 * des Zufallswerts, böte die Maske einen ungeprüften Stempel an.
		 */
		pruefZufall.probe = KETTEN_PRUEFSUMME;

		const haupt = await dienstAn(Uint8Array.from(Buffer.from(KETTEN_ANTWORT, 'base64')));
		await setzeZeitstempeldienst(handelnder(), {
			url: haupt.url,
			name: 'DigiCert',
			fingerabdruecke: '99'.repeat(32)
		});

		const probe = await holePruefzeitstempel(betreiber, 'haupt');

		expect(haupt.zaehler.anfragen).toBe(1);
		expect(probe.ok).toBe(false);
		expect(probe.nurAnheftungFehlt).not.toBe(true);
		expect(probe.bemerkung).not.toMatch(/nicht hinterlegt/);
	}, 30000);
});
