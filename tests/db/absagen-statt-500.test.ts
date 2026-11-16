/**
 * Absagen statt 500: leere Kennungen und unlesbare Rümpfe (F7).
 *
 * **Der Befund (Pentest-Runde M7, 15.10.2026, M7-2-02).** `POST
 * /versammlungen/<id>/leitung?/oeffnen` mit `traktandum=` (leer) endete als
 * HTTP 500, im Protokoll `PostgresError: invalid input syntax for type uuid:
 * ""`. Eine gültige, unbekannte Kennung ergab richtig 400. Die erste Gruppe
 * misst die Klasse: **Jede Aktion der Erhebung antwortet auf ein leeres
 * Kennungsfeld ohne rohe Ausnahme.** Eine rohe Ausnahme ist im Betrieb die
 * 500-Seite.
 *
 * **Aufgerufen werden die Aktionen selbst**, nicht die Funktionen darunter —
 * wie in `kennungspruefung.test.ts`: Die Abwehr sitzt in der Schale, und ein
 * Test gegen den Kern sähe von ihr nichts.
 *
 * **Was «keine rohe Ausnahme» heisst.** `fail(...)` unter 500 und ein
 * gewöhnlicher Rückgabewert sind Antworten; `redirect(...)` und `error(...)`
 * unter 500 sind kontrollierte Ausgänge von SvelteKit. Alles andere, ein
 * `PostgresError`, ein `TypeError`, ein `fail` oder `error` ab 500, ist die
 * 500 im Betrieb.
 *
 * **Und dass die Kennung erreicht wurde.** Keine 500 allein belegt nichts: Eine
 * Aktion, die vorher an etwas anderem absagt, wäre ebenso grün. Jeder
 * Aktionsfall verlangt deshalb die Zeile «Ungültige Kennung in einer Abfrage»
 * aus `kennungsfehler` im Protokoll (Codeprüfung F7, 16.10.2026). Vor der Behebung (Teil B) standen
 * hier die Postgres-Fehler; erwartet werden sie bewusst nicht, die Datei war
 * vor Teil B rot.
 *
 * **Die Liste der Stellen stammt aus einer Messung am Dev-Stapel** (15.10.2026,
 * 134 Aktionen mit Kennungsfeld, alle Formularfelder leer, gegen eine eigene
 * laufende Versammlung): 27 gaben 500, 26 davon am Postgres-Fehler und der
 * `kiantrag` am Abend an einer ungefangenen Absage zum Haus. Dazu kommt als
 * 28. Fall der `kiantrag`
 * im Haus, der auf Dev nur verdeckt war, weil die KI dort nicht zugelassen
 * war. Die drei Ausnahmen der Messung stehen am Ende dieser Datei begründet.
 *
 * **Und die Fälle aus der Codeprüfung** (16.10.2026), die die Messung nicht
 * erreicht hatte: `kipruefen` auf der Traktandenseite (dasselbe Muster wie
 * `kiantrag`), die Kontoverwaltung unter `/betreiber/benutzer` (sie lief an
 * der Übersetzung vorbei, seither über `ohneBindung`) und die Leitungsaktionen
 * an einer Versammlung **ohne Abend**: An der Versammlung des Abends brechen
 * neun von ihnen schon vorher mit «am Abend führen» ab, darunter `oeffnen`,
 * um das es im Befund M7-2-02 ging. Ohne Abend gaben davon zwei 500.
 *
 * **Die zweite Gruppe ist der M5-Punkt `zugaenge/karten.pdf`**: ein JSON-POST
 * liess `request.formData()` werfen, und `handleError` antwortete mit der
 * 500-Seite. Dieselbe Klasse, anderer Auslöser — der unlesbare Rumpf.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';

/*
 * `$app/environment` gibt es ausserhalb von SvelteKit nicht. Die importierten
 * Routen ziehen über `$lib/server/keks` die Grösse `dev` herein; ohne diesen
 * Ersatz scheitert schon das Laden der Datei. Dasselbe Muster wie in
 * `tests/domain/zeitgeber.test.ts`.
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
import {
	eroeffneVersammlung,
	erstelleVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { actions as einheitenAktionen } from '../../src/routes/gemeinschaften/[id=kennung]/einheiten/+page.server';
import { actions as tagGeschaefteAktionen } from '../../src/routes/tage/[id=kennung]/geschaefte/+page.server';
import { actions as tagLeitungAktionen } from '../../src/routes/tage/[id=kennung]/leitung/+page.server';
import { actions as versammlungAktionen } from '../../src/routes/versammlungen/[id=kennung]/+page.server';
import { actions as anwesenheitAktionen } from '../../src/routes/versammlungen/[id=kennung]/anwesenheit/+page.server';
import { actions as leitungAktionen } from '../../src/routes/versammlungen/[id=kennung]/leitung/+page.server';
import { actions as protokollAktionen } from '../../src/routes/versammlungen/[id=kennung]/protokoll/+page.server';
import { actions as traktandenAktionen } from '../../src/routes/versammlungen/[id=kennung]/traktanden/+page.server';
import { actions as vollmachtenAktionen } from '../../src/routes/versammlungen/[id=kennung]/vollmachten/+page.server';
import { actions as nachweiseAktionen } from '../../src/routes/versammlungen/[id=kennung]/vollmachten/nachweise/+page.server';
import { actions as weisungenAktionen } from '../../src/routes/versammlungen/[id=kennung]/weisungen/+page.server';
import { actions as benutzerAktionen } from '../../src/routes/betreiber/benutzer/+page.server';
import { POST as kartensatzPost } from '../../src/routes/versammlungen/[id=kennung]/zugaenge/karten.pdf/+server';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;
/** Die Gemeinschaft der Aktionen unter `gemeinschaften/[id=kennung]`. */
let stweg: string;
/** Die laufende Versammlung mit Traktandum — der Bestand fast aller Fälle. */
let versammlung: string;
/** Der Abend, dem die Versammlung zugeordnet ist (für die beiden `tage`-Fälle). */
let tag: string;
/**
 * Eine zweite laufende Versammlung **ohne Abend**, in einer eigenen
 * Gemeinschaft: Nur an ihr erreichen die Leitungsaktionen, die am Abend
 * gesperrt sind, die Kennung.
 */
let freieVersammlung: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüferin' };
}

const ERFORDERNIS: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-gewoehnliche-verwaltung',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Prüflauf Leere Kennungen');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-kennungen');

	/*
	 * **Eine KI-Stufe, damit `kiantrag` bis zur Kennung kommt** (nur die
	 * Einrichtung, kein Aufruf). Ohne sie wiese die Aktion mit «Es ist kein
	 * Modell eingerichtet» ab, und der Befund dahinter bliebe ungemessen —
	 * grün aus dem falschen Grund.
	 */
	await admin`
		INSERT INTO ai_stage (operator_id, position, name, url, model)
		VALUES (${betreiber}, 1, 'Prüfstufe', 'https://example.invalid/v1/chat/completions', 'prüfmodell')
	`;

	const g = await erstelleGemeinschaft(handelnder(), {
		name: 'Prüflauf Leere Kennungen',
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		// Die KI-Zulassung der Gemeinschaft, damit `kiantrag` nicht davor abbricht.
		aiEnabled: true
	});
	stweg = g.id;

	const einheit = await erstelleEinheit(handelnder(), {
		stwegId: stweg,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 900 },
		countsAsHead: true
	});
	const partei = await erstelleEigentuemer(handelnder(), {
		stwegId: stweg,
		kind: 'natural',
		displayName: 'Probe Halterin',
		representativeName: null,
		isCommunity: false
	});
	await ordneEigentumZu(handelnder(), einheit.id, partei.id, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(), {
		stwegId: stweg,
		datum: '2026-03-01',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	versammlung = v.id;

	const t = await erstelleTraktandum(handelnder(), {
		meetingId: versammlung,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(), versammlung, t.id, ERFORDERNIS);

	await gibVersammlungFrei(handelnder(), versammlung);
	await eroeffneVersammlung(handelnder(), versammlung);
	await bestaetigeAnwesenheit(handelnder(), versammlung, partei.id, 'von_hand');

	// Der Abend für die beiden `tage`-Fälle; die Versammlung gehört dazu.
	const d = await erstelleVersammlungstag(handelnder(), {
		bezeichnung: 'Prüfabend',
		datum: '2026-03-01',
		uhrzeit: '19:00',
		ort: 'Prüfsaal'
	});
	tag = d.id;
	await nimmInTagAuf(handelnder(), tag, versammlung, 0);

	const g2 = await erstelleGemeinschaft(handelnder(), {
		name: 'Prüflauf Leere Kennungen ohne Abend',
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		aiEnabled: true
	});
	const einheit2 = await erstelleEinheit(handelnder(), {
		stwegId: g2.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 900 },
		countsAsHead: true
	});
	const partei2 = await erstelleEigentuemer(handelnder(), {
		stwegId: g2.id,
		kind: 'natural',
		displayName: 'Probe Halter',
		representativeName: null,
		isCommunity: false
	});
	await ordneEigentumZu(handelnder(), einheit2.id, partei2.id, '2020-01-01');
	const v2 = await erstelleVersammlung(handelnder(), {
		stwegId: g2.id,
		datum: '2026-03-02',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	freieVersammlung = v2.id;
	const t2 = await erstelleTraktandum(handelnder(), {
		meetingId: freieVersammlung,
		titel: 'Dachsanierung',
		art: 'abstimmung',
		antragswortlaut: 'Das Dach wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(), freieVersammlung, t2.id, ERFORDERNIS);
	await gibVersammlungFrei(handelnder(), freieVersammlung);
	await eroeffneVersammlung(handelnder(), freieVersammlung);
	await bestaetigeAnwesenheit(handelnder(), freieVersammlung, partei2.id, 'von_hand');
}, 60000);

afterAll(verbindungenSchliessen);

/** Die Aktionen, so wie SvelteKit sie aufruft — als Tabelle. */
type Aktionen = Record<string, (arg: never) => Promise<unknown>>;

interface Fall {
	name: string;
	aktionen: Aktionen;
	aktion: string;
	/**
	 * Wohin die Adresse zeigt: die Gemeinschaft, der Abend, die Versammlung am
	 * Abend, die Versammlung ohne Abend oder keine Kennung (Betreiberseiten).
	 */
	wurzel: 'gemeinschaft' | 'tag' | 'versammlung' | 'frei' | 'betreiber';
	/** Die Kennungsfelder, die leer geschickt werden — die auslösenden zuerst. */
	felder: string[];
	/**
	 * Felder mit gültigem Wert, die die Aktion vor der Kennung prüft. Ohne sie
	 * bräche sie vorher ab, und der Fall wäre grün aus dem falschen Grund.
	 */
	zusatz?: () => Record<string, string>;
	/** Eine Datei mitschicken, wo die Aktion sie vor der Kennung verlangt. */
	datei?: boolean;
}

/**
 * Die 28 Fälle der Erhebung vom 15.10.2026 (siehe Kopf) und darunter die
 * Fälle aus der Codeprüfung vom 16.10.2026, je Aktion die Felder, die mit
 * leerem Wert den `PostgresError` ausgelöst haben.
 */
const faelle: Fall[] = [
	{
		name: 'Einheiten · einheitEntfernen · entfernen',
		aktionen: einheitenAktionen as Aktionen,
		aktion: 'einheitEntfernen',
		wurzel: 'gemeinschaft',
		felder: ['entfernen']
	},
	{
		name: 'Einheiten · verteilerLoeschen · artId',
		aktionen: einheitenAktionen as Aktionen,
		aktion: 'verteilerLoeschen',
		wurzel: 'gemeinschaft',
		felder: ['artId']
	},
	{
		name: 'Abend-Geschäfte · umordnen · geschaeft, traktandum',
		aktionen: tagGeschaefteAktionen as Aktionen,
		aktion: 'umordnen',
		wurzel: 'tag',
		felder: ['geschaeft', 'traktandum']
	},
	{
		name: 'Abend-Leitung · kiantrag · traktandumId',
		aktionen: tagLeitungAktionen as Aktionen,
		aktion: 'kiantrag',
		wurzel: 'tag',
		felder: ['traktandumId'],
		// Ohne das Haus wiese `hausDesAbends` vor der Kennung ab (Codeprüfung).
		zusatz: () => ({ versammlung })
	},
	{
		name: 'Versammlung · abloesen · id',
		aktionen: versammlungAktionen as Aktionen,
		aktion: 'abloesen',
		wurzel: 'versammlung',
		felder: ['id']
	},
	{
		name: 'Anwesenheit · codeAusgeben · partei',
		aktionen: anwesenheitAktionen as Aktionen,
		aktion: 'codeAusgeben',
		wurzel: 'versammlung',
		felder: ['partei']
	},
	{
		name: 'Anwesenheit · geraeteWiderrufen · partei',
		aktionen: anwesenheitAktionen as Aktionen,
		aktion: 'geraeteWiderrufen',
		wurzel: 'versammlung',
		felder: ['partei']
	},
	{
		name: 'Leitung · kiantrag · traktandumId',
		aktionen: leitungAktionen as Aktionen,
		aktion: 'kiantrag',
		wurzel: 'versammlung',
		felder: ['traktandumId']
	},
	{
		name: 'Leitung · saalZuordnen · meldung',
		aktionen: leitungAktionen as Aktionen,
		aktion: 'saalZuordnen',
		wurzel: 'versammlung',
		felder: ['meldung', 'partei']
	},
	{
		name: 'Leitung · saalAblehnen · meldung',
		aktionen: leitungAktionen as Aktionen,
		aktion: 'saalAblehnen',
		wurzel: 'versammlung',
		felder: ['meldung']
	},
	{
		name: 'Leitung · beschlusstext · durchgang',
		aktionen: leitungAktionen as Aktionen,
		aktion: 'beschlusstext',
		wurzel: 'versammlung',
		felder: ['durchgang']
	},
	{
		name: 'Leitung · neuabstimmung · durchgang',
		aktionen: leitungAktionen as Aktionen,
		aktion: 'neuabstimmung',
		wurzel: 'versammlung',
		felder: ['durchgang']
	},
	{
		name: 'Leitung · rueckzugZurueck · traktandum',
		aktionen: leitungAktionen as Aktionen,
		aktion: 'rueckzugZurueck',
		wurzel: 'versammlung',
		felder: ['traktandum']
	},
	{
		name: 'Leitung · betroffeneAus · traktandum, partei',
		aktionen: leitungAktionen as Aktionen,
		aktion: 'betroffeneAus',
		wurzel: 'versammlung',
		felder: ['traktandum', 'partei']
	},
	{
		name: 'Leitung · vorabZurueck · traktandum, partei',
		aktionen: leitungAktionen as Aktionen,
		aktion: 'vorabZurueck',
		wurzel: 'versammlung',
		felder: ['traktandum', 'partei']
	},
	{
		name: 'Leitung · beklagtenumfang · traktandum, partei',
		aktionen: leitungAktionen as Aktionen,
		aktion: 'beklagtenumfang',
		wurzel: 'versammlung',
		felder: ['traktandum', 'partei']
	},
	{
		name: 'Leitung · notiz · traktandum',
		aktionen: leitungAktionen as Aktionen,
		aktion: 'notiz',
		wurzel: 'versammlung',
		felder: ['traktandum']
	},
	{
		name: 'Protokoll · notiz · traktandum',
		aktionen: protokollAktionen as Aktionen,
		aktion: 'notiz',
		wurzel: 'versammlung',
		felder: ['traktandum']
	},
	{
		name: 'Protokoll · kiuebernehmen · traktandumId',
		aktionen: protokollAktionen as Aktionen,
		aktion: 'kiuebernehmen',
		wurzel: 'versammlung',
		felder: ['traktandumId']
	},
	{
		name: 'Traktanden · speichern · id',
		aktionen: traktandenAktionen as Aktionen,
		aktion: 'speichern',
		wurzel: 'versammlung',
		felder: ['id']
	},
	{
		name: 'Traktanden · abloesen · id',
		aktionen: traktandenAktionen as Aktionen,
		aktion: 'abloesen',
		wurzel: 'versammlung',
		felder: ['id']
	},
	{
		name: 'Vollmachten · vorlegen · id',
		aktionen: vollmachtenAktionen as Aktionen,
		aktion: 'vorlegen',
		wurzel: 'versammlung',
		felder: ['id']
	},
	{
		name: 'Vollmachten · bestaetigen · id',
		aktionen: vollmachtenAktionen as Aktionen,
		aktion: 'bestaetigen',
		wurzel: 'versammlung',
		felder: ['id']
	},
	{
		name: 'Vollmachten · Nachweise · id',
		aktionen: nachweiseAktionen as Aktionen,
		aktion: 'default',
		wurzel: 'versammlung',
		felder: ['id'],
		datei: true
	},
	{
		name: 'Weisungen · ableiten · traktandum',
		aktionen: weisungenAktionen as Aktionen,
		aktion: 'ableiten',
		wurzel: 'versammlung',
		felder: ['traktandum']
	},
	{
		name: 'Weisungen · ohneBeschluss · traktandum',
		aktionen: weisungenAktionen as Aktionen,
		aktion: 'ohneBeschluss',
		wurzel: 'versammlung',
		felder: ['traktandum']
	},
	{
		name: 'Weisungen · bindung · traktandum',
		aktionen: weisungenAktionen as Aktionen,
		aktion: 'bindung',
		wurzel: 'versammlung',
		felder: ['traktandum']
	},
	{
		name: 'Weisungen · erfassen · traktandum, partei',
		aktionen: weisungenAktionen as Aktionen,
		aktion: 'erfassen',
		wurzel: 'versammlung',
		felder: ['traktandum', 'partei']
	},

	// ── Aus der Codeprüfung vom 16.10.2026 ──────────────────────────────────
	{
		name: 'Traktanden · kipruefen · traktandumId',
		aktionen: traktandenAktionen as Aktionen,
		aktion: 'kipruefen',
		wurzel: 'versammlung',
		felder: ['traktandumId']
	},
	{
		name: 'Benutzer · verknuepfung · konto',
		aktionen: benutzerAktionen as Aktionen,
		aktion: 'verknuepfung',
		wurzel: 'betreiber',
		felder: ['konto']
	},
	{
		name: 'Benutzer · loesen · konto',
		aktionen: benutzerAktionen as Aktionen,
		aktion: 'loesen',
		wurzel: 'betreiber',
		felder: ['konto']
	},
	{
		name: 'Benutzer · dienst · konto',
		aktionen: benutzerAktionen as Aktionen,
		aktion: 'dienst',
		wurzel: 'betreiber',
		felder: ['konto']
	},
	{
		name: 'Benutzer · rolle · konto',
		aktionen: benutzerAktionen as Aktionen,
		aktion: 'rolle',
		wurzel: 'betreiber',
		felder: ['konto'],
		// Ohne gültige Rolle sagte die Aktion vorher mit «Unbekannte Rolle» ab.
		zusatz: () => ({ rolle: 'chair' })
	},
	{
		name: 'Benutzer · angaben · konto',
		aktionen: benutzerAktionen as Aktionen,
		aktion: 'angaben',
		wurzel: 'betreiber',
		felder: ['konto'],
		// Ohne Namen sagte die Aktion vorher mit «Anzeigename fehlt» ab.
		zusatz: () => ({ displayName: 'Probe Name' })
	},
	/*
	 * Von den neun Aktionen, die am Abend vorher abbrechen, gaben ohne Abend
	 * nur diese zwei mit leerer Kennung 500 (gemessen 16.10.2026, ohne die
	 * Abwehr). `wandbild`, `aufrufen`, `widerspruch`, `schliessen`, `abbrechen`
	 * und `pause` sagten schon vorher fachlich ab, `leitungsvertreter` liest
	 * keine Kennung; als Fall belegten sie nichts.
	 */
	...(
		[
			['oeffnen', ['traktandum']],
			['beschlussVonHand', ['traktandum', 'partei']]
		] as const
	).map(
		([aktion, felder]): Fall => ({
			name: `Leitung ohne Abend · ${aktion} · ${felder.join(', ')}`,
			aktionen: leitungAktionen as Aktionen,
			aktion,
			wurzel: 'frei',
			felder: [...felder]
		})
	)
];

/** Was aus einem Aufruf herauskam. */
type Ausgang =
	| { art: 'absage'; status: number }
	| { art: 'erfolg' }
	| { art: 'umleitung' }
	| { art: 'roh'; fehler: unknown };

async function fahre(fall: Fall): Promise<Ausgang> {
	const daten = new FormData();
	for (const feld of fall.felder) daten.append(feld, '');
	for (const [feld, wert] of Object.entries(fall.zusatz?.() ?? {})) daten.append(feld, wert);
	if (fall.datei) {
		daten.append(
			'datei',
			new File([new Uint8Array([1, 2, 3, 4])], 'probe.pdf', { type: 'application/pdf' })
		);
	}

	const ereignis = {
		request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-kennungen',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params:
			fall.wurzel === 'betreiber'
				? {}
				: {
						id:
							fall.wurzel === 'gemeinschaft'
								? stweg
								: fall.wurzel === 'tag'
									? tag
									: fall.wurzel === 'frei'
										? freieVersammlung
										: versammlung
					},
		/*
		 * Für `codeAusgeben` (`herkunft(url)`) und die Bindung der Fälle. Im
		 * Betrieb trägt die Adresse den Herkunftsteil; hier genügt eine gültige.
		 */
		url: new URL('http://pruefung.example/versammlungen/x/leitung'),
		route: { id: '/pruefung' }
	};

	try {
		const ergebnis = (await fall.aktionen[fall.aktion](ereignis as never)) as {
			status?: unknown;
		};
		// `fail()` liefert ein ActionFailure mit `status`; ein Erfolg ist ein
		// gewöhnliches Objekt ohne. Eine Absage ab 500 ist keine Absage.
		if (ergebnis && typeof ergebnis === 'object' && typeof ergebnis.status === 'number') {
			if (ergebnis.status >= 500) return { art: 'roh', fehler: `fail(${ergebnis.status})` };
			return { art: 'absage', status: ergebnis.status };
		}
		return { art: 'erfolg' };
	} catch (fehler) {
		if (isRedirect(fehler)) return { art: 'umleitung' };
		// `error(4xx)` ist ein kontrollierter Ausgang, `error(5xx)` die 500-Seite.
		if (isHttpError(fehler) && fehler.status < 500) return { art: 'umleitung' };
		return { art: 'roh', fehler };
	}
}

describe('Leere Kennungen ergeben eine Absage, keine rohe Ausnahme', () => {
	for (const fall of faelle) {
		it(fall.name, async () => {
			const spion = vi.spyOn(console, 'error');
			let erreicht = false;
			const ausgang = await fahre(fall).finally(() => {
				// Vor dem Zurücksetzen lesen: `mockRestore` leert die Aufrufe.
				erreicht = spion.mock.calls.some((aufruf) =>
					String(aufruf[0]).includes('Ungültige Kennung in einer Abfrage')
				);
				spion.mockRestore();
			});
			if (ausgang.art === 'roh') {
				const roh = ausgang.fehler;
				const sicht =
					roh instanceof Error ? `${roh.name}: ${roh.message.split('\n')[0]}` : String(roh);
				expect.fail(
					`rohe Ausnahme statt Absage (im Betrieb die 500-Seite): ${sicht}. ` +
						`Aktion ${fall.aktion} mit leeren Feldern [${fall.felder.join(', ')}].`
				);
			}
			if (!erreicht) {
				expect.fail(
					`keine 500, aber die Kennung hat die Abfrage nicht erreicht (Ausgang ${ausgang.art}); ` +
						`der Fall misst nichts. Aktion ${fall.aktion}.`
				);
			}
		});
	}
});

/**
 * Der M5-Punkt: `zugaenge/karten.pdf` beantwortete einen JSON-POST mit der
 * 500-Seite, weil `request.formData()` an der Inhaltsart scheitert. Der
 * Nachbar `zugaenge/versandpaket.zip` fängt genau das mit
 * `request.formData().catch(() => new FormData())` ab und antwortet mit der
 * fachlichen Absage; derselbe Fang gehört hierher.
 *
 * **Gemessen wird ohne Bestand**: Die Adresse zeigt auf eine unbekannte
 * Versammlung, der Weg endet deshalb in der fachlichen Absage (eine Umleitung
 * zurück auf die Seite), ohne Zugänge zu erzeugen oder ein PDF zu bauen. Vor
 * dem Fang warf schon das Lesen des Rumpfes.
 */
describe('Ein unlesbarer Rumpf an karten.pdf ergibt keine rohe Ausnahme', () => {
	it('weist einen JSON-POST mit der fachlichen Absage ab', async () => {
		let ausgang: Ausgang;
		try {
			const antwort = await kartensatzPost({
				request: new Request('http://pruefung.example/versammlungen/x/zugaenge/karten.pdf', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: '{}'
				}),
				locals: {
					benutzer: {
						id: benutzer,
						operatorId: betreiber,
						username: 'pruefer-kennungen',
						displayName: 'Prüferin',
						role: 'admin'
					},
					herkunft: null
				},
				params: { id: '00000000-0000-0000-0000-000000000000' },
				url: new URL('http://pruefung.example/versammlungen/x/zugaenge/karten.pdf')
			} as never);
			ausgang = { art: 'erfolg' };
		} catch (fehler) {
			if (isRedirect(fehler) || (isHttpError(fehler) && fehler.status < 500)) {
				ausgang = { art: 'umleitung' };
			} else {
				ausgang = { art: 'roh', fehler };
			}
		}

		if (ausgang.art === 'roh') {
			const roh = ausgang.fehler;
			const sicht =
				roh instanceof Error ? `${roh.name}: ${roh.message.split('\n')[0]}` : String(roh);
			expect.fail(
				`rohe Ausnahme statt Absage (im Betrieb die 500-Seite): ${sicht}. ` +
					'JSON-POST auf karten.pdf.'
			);
		}
	});
});

/*
 * **Die drei Ausnahmen der Messung** (aus dem Bericht zu F7, 15.10.2026): Bei
 * `zugaenge/versenden`, `zugaenge/karten.pdf` und `zugaenge/versandpaket.zip`
 * heisst eine leere Auswahl «alle». Mit leeren Feldern geschickt, hätte die
 * Messung Zugänge und Mails für alle erzeugt; sie stehen deshalb nicht in der
 * Liste oben. Eine leere Kennung erreicht dort keine Abfrage, die an ihr
 * scheitert. Von `karten.pdf` prüft die zweite Gruppe den unlesbaren Rumpf,
 * ohne Bestand.
 *
 * **Und eine Korrektur der ersten Messung:** `uebernehmen · default` erschien
 * als Befund, weil `?/default` als Aufrufname nicht erlaubt ist. Ohne Zusatz
 * aufgerufen, antwortet die Aktion 400 «Es wurde kein Traktandum gewählt.».
 */
