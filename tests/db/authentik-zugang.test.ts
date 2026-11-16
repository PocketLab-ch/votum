/**
 * Der Eigentümerzugang über Authentik — gegen die echte Datenbank.
 *
 * Der Kern liegt in `authentik_einloesen` (Migration 068), einer Funktion mit
 * `SECURITY DEFINER`: Wer sich über sein Konto anmeldet, ist in dieser
 * Anwendung noch niemand, es gibt also keinen Mandanten, unter dem die Abfrage
 * laufen könnte. Ein Mock-Test sähe von alledem nichts.
 *
 * Geprüft wird vor allem, was NICHT passieren darf: dass eine Kennung eine
 * Berechtigung erzeugt, wo keine ist.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { loeseAuthentikEin, loeseSitzungAuf } from '$lib/server/zugangssitzung';
import { meldeTeilnahmeAn, holeAnwesenheitsereignisse } from '$lib/server/anwesenheit';
import {
	holeOderErzeugeSaalmerkmal,
	holeOffeneSaalmeldungen,
	meldeUeberSaal,
	ordneSaalmeldungZu
} from '$lib/server/saaleinstieg';
import { vermerkeRueckfall } from '$lib/server/authentik';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

const FREMD = 'ffffffff-1111-4222-8333-444444444444';

/**
 * Je Fall eine eigene Kennung.
 *
 * Beim ersten Anlauf trugen alle Prüfversammlungen dieselbe — und jeder Test
 * ausser dem ersten schlug fehl, weil `authentik_einloesen` dann «mehrdeutig»
 * meldet. Der Befund war richtig und der Aufbau falsch: Ein Mensch kann in
 * mehreren Gemeinschaften Einheiten halten, und offene Prüfversammlungen
 * bleiben stehen, bis jemand aufräumt.
 */
function kennung(nr: number): string {
	return `4e6eaf2c-a2f1-4c8c-810a-2b8299ac18${String(nr).padStart(2, '0')}`;
}

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/** Eine eröffnete Versammlung mit zwei Parteien; die erste trägt eine Kennung. */
async function aufbau(name: string, kennung: string | null) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e1 = await erstelleEinheit(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 600 },
		countsAsHead: true
	});
	const e2 = await erstelleEinheit(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 2',
		quotas: { stamm: 400 },
		countsAsHead: true
	});
	const p1 = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna Muster',
		isCommunity: false,
		representativeName: null
	});
	const p2 = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Beat Beispiel',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(betreiber), e1.id, p1.id, '2020-01-01');
	await ordneEigentumZu(handelnder(betreiber), e2.id, p2.id, '2020-01-01');

	// Die Kennung steht an den Stammdaten — wie nach einer Übernahme aus
	// immotool (Migration 066).
	if (kennung) {
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE party SET authentik_subject = ${kennung} WHERE id = ${p1.id}`
		);
	}

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	return { stwegId: g.id, versammlung: v.id, parteien: [p1.id, p2.id] };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Authentik-Zugang');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Die Kennung wandert in die Momentaufnahme', () => {
	it('steht nach der Freigabe an der eingefrorenen Zeile', async () => {
		const { versammlung } = await aufbau('Kennungsweg A', kennung(1));
		const zeilen = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT display_name, authentik_subject FROM snapshot_party
				WHERE meeting_id = ${versammlung} ORDER BY display_name
			`
		);
		expect(zeilen).toHaveLength(2);
		expect(zeilen[0]).toMatchObject({ display_name: 'Anna Muster', authentik_subject: kennung(1) });
		expect(zeilen[1].authentik_subject).toBeNull();
	});
});

describe('Einlösen über das eigene Konto', () => {
	it('legt Zugang und Sitzung an, auch ohne je gedruckte Karte', async () => {
		const { versammlung } = await aufbau('Kennungsweg B', kennung(2));

		// Es wurden nie Zugänge erzeugt — der Weg über Authentik braucht kein
		// Papier. Der Zugang entsteht beim ersten Anmelden.
		const vorher = await imKontext(
			betreiber,
			(tx) => tx`SELECT count(*)::int AS n FROM meeting_access WHERE meeting_id = ${versammlung}`
		);
		expect(vorher[0].n).toBe(0);

		const e = await loeseAuthentikEin(kennung(2), 'Prüflauf');
		expect(e.gelungen).toBe(true);
		expect(e.merkmal).toBeTruthy();
		expect(e.partei).toBe('Anna Muster');

		const nachher = await imKontext(
			betreiber,
			(tx) => tx`SELECT count(*)::int AS n FROM meeting_access WHERE meeting_id = ${versammlung}`
		);
		expect(nachher[0].n).toBe(1);
	});

	it('kennzeichnet die Sitzung als «authentik»', async () => {
		await aufbau('Kennungsweg C', kennung(3));
		const e = await loeseAuthentikEin(kennung(3), 'Prüflauf');
		const befund = await loeseSitzungAuf(e.merkmal as string);
		expect(befund.gueltig).toBe(true);
		// Ohne diese Auskunft hiesse die Anwesenheit später «selbst angemeldet»
		// und wäre von der Karte nicht mehr zu unterscheiden.
		expect(befund.herkunft).toBe('authentik');
	});

	it('schreibt die Anwesenheit mit dem Weg «authentik»', async () => {
		const { versammlung } = await aufbau('Kennungsweg D', kennung(4));
		const e = await loeseAuthentikEin(kennung(4), 'Prüflauf');
		const befund = await loeseSitzungAuf(e.merkmal as string);

		await meldeTeilnahmeAn(
			befund.operatorId as string,
			befund.meetingId as string,
			befund.parteiId as string,
			'authentik'
		);

		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		const meins = ereignisse.filter((x) => x.weg === 'authentik');
		expect(meins).toHaveLength(1);
		expect(meins[0].art).toBe('angemeldet');
	});

	it('gibt nach dem Schluss eine Nachschau, aber keinen gültigen Zugang', async () => {
		/*
		 * **Die Stunde nach dem Schluss** (04.09.2026, Produktentscheid: «dieselbe
		 * Stunde auf dem Mobiltelefon»). Das Telefon soll noch zeigen, was
		 * beschlossen wurde — so, wie der Anzeigecode der Leinwand seit dem
		 * 21.08.2026 eine Stunde weitergilt.
		 *
		 * **Der Kern dieser Probe ist die erste Zeile.** `gueltig` muss `false`
		 * bleiben: An diesem Wert hängen alle acht Aktionen der Telefonseite über
		 * die Hilfsfunktion `sitzung()`. Wäre die Nachschau ein gültiger Zugang,
		 * öffnete man acht Schreibwege, um eine Liste zu zeigen.
		 */
		const { versammlung } = await aufbau('Kennungsweg Nachschau', kennung(9));
		const e = await loeseAuthentikEin(kennung(9), 'Prüflauf');
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'geschlossen', closed_at = now() WHERE id = ${versammlung}
		`);

		const befund = await loeseSitzungAuf(e.merkmal as string);
		expect(befund.gueltig).toBe(false);
		expect(befund.nachschau).toBeDefined();
		expect(befund.nachschau?.meetingId).toBe(versammlung);
		// Die Kennungen für den Zutritt bleiben leer: Wer sie liest, käme an den
		// Aktionen vorbei.
		expect(befund.meetingId).toBeUndefined();
		expect(befund.parteiId).toBeUndefined();
	});

	it('gibt die Nachschau auch, wenn das Schliessen die Sitzung beendet hat', async () => {
		/*
		 * **Der Weg, den das Schliessen wirklich nimmt** (04.09.2026, gemessen).
		 * `schliesseVersammlung` widerruft die Gerätesitzungen mit dem Grund
		 * «geschlossen» und entwertet nebenbei jeden Zugang. Die Prüfung darauf
		 * steht in `loeseSitzungAuf` **vor** dem Zutritt; ohne diesen Fall käme die
		 * Nachschau nie zum Zug, und genau so war es beim ersten Anlauf.
		 *
		 * **Der Zugangszustand taugt hier nicht als Merkmal**: Das Schliessen
		 * entwertet alle, das ist Aufräumen. Was den Fall kennzeichnet, ist der
		 * Widerrufsgrund der Sitzung.
		 */
		const { versammlung } = await aufbau('Kennungsweg Schluss', kennung(11));
		const e = await loeseAuthentikEin(kennung(11), 'Prüflauf');
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'geschlossen', closed_at = now() WHERE id = ${versammlung}
		`);
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting_access SET state = 'entwertet' WHERE meeting_id = ${versammlung}
		`);
		await imKontext(betreiber, (tx) => tx`
			UPDATE access_session s SET revoked_at = now(), revoked_reason = 'geschlossen'
			  FROM meeting_access a
			 WHERE a.id = s.meeting_access_id AND a.meeting_id = ${versammlung}
		`);

		const befund = await loeseSitzungAuf(e.merkmal as string);
		expect(befund.gueltig).toBe(false);
		expect(befund.nachschau?.meetingId).toBe(versammlung);
	});

	it('gibt einem ersetzten Zugang keine Nachschau', async () => {
		/*
		 * **Der Fall, den die erste Fassung übersah** (04.09.2026, aus dem
		 * Code-Review). Wird ein Zugang während der Versammlung erneuert, geht die
		 * alte Karte auf «ersetzt», ihre Gerätesitzung läuft aber weiter und wird
		 * erst vom Schliessen widerrufen — mit dem Grund «geschlossen», also genau
		 * dem, der die Nachschau öffnet.
		 *
		 * Das ausgesperrte alte Telefon hätte danach eine Stunde lang die
		 * Beschlussliste gesehen, und das Erneuern wäre so lange folgenlos
		 * gewesen.
		 */
		const { versammlung } = await aufbau('Kennungsweg Ersetzt', kennung(13));
		const e = await loeseAuthentikEin(kennung(13), 'Prüflauf');
		// `superseded_at` gehört dazu: `access_ersetzt_zeitpunkt` verlangt es, und
		// ein «ersetzt» ohne Zeitpunkt wäre eine Angabe ohne Beleg.
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting_access SET state = 'ersetzt', superseded_at = now()
			 WHERE meeting_id = ${versammlung}
		`);
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'geschlossen', closed_at = now() WHERE id = ${versammlung}
		`);
		await imKontext(betreiber, (tx) => tx`
			UPDATE access_session s SET revoked_at = now(), revoked_reason = 'geschlossen'
			  FROM meeting_access a
			 WHERE a.id = s.meeting_access_id AND a.meeting_id = ${versammlung}
		`);

		const befund = await loeseSitzungAuf(e.merkmal as string);
		expect(befund.gueltig).toBe(false);
		expect(befund.nachschau).toBeUndefined();
	});

	it('gibt keine Nachschau, wenn sich jemand selbst abgemeldet hat', async () => {
		/*
		 * Dort ist das Ende eine **Handlung**, und die soll wirken. Sonst zeigte
		 * das Gerät nach dem Abmelden weiter etwas an, und «abmelden» hiesse nur
		 * noch «die Knöpfe verstecken».
		 */
		const { versammlung } = await aufbau('Kennungsweg Abgemeldet', kennung(12));
		const e = await loeseAuthentikEin(kennung(12), 'Prüflauf');
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'geschlossen', closed_at = now() WHERE id = ${versammlung}
		`);
		await imKontext(betreiber, (tx) => tx`
			UPDATE access_session s SET revoked_at = now(), revoked_reason = 'abgemeldet'
			  FROM meeting_access a
			 WHERE a.id = s.meeting_access_id AND a.meeting_id = ${versammlung}
		`);

		const befund = await loeseSitzungAuf(e.merkmal as string);
		expect(befund.gueltig).toBe(false);
		expect(befund.nachschau).toBeUndefined();
	});

	it('gibt einer entwerteten Karte auch keine Nachschau', async () => {
		/*
		 * Die Nachschau hängt an einer Karte, die für sich in Ordnung ist. Eine
		 * entwertete oder ersetzte bekommt nichts — sonst wäre das Entwerten für
		 * eine Stunde folgenlos.
		 */
		const { versammlung } = await aufbau('Kennungsweg Entwertet', kennung(10));
		const e = await loeseAuthentikEin(kennung(10), 'Prüflauf');
		// Zwei Anweisungen, zwei Aufrufe: postgres.js bereitet jede Abfrage vor,
		// und ein vorbereitetes Statement nimmt nur einen Befehl.
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'geschlossen', closed_at = now() WHERE id = ${versammlung}
		`);
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting_access SET state = 'entwertet' WHERE meeting_id = ${versammlung}
		`);

		const befund = await loeseSitzungAuf(e.merkmal as string);
		expect(befund.gueltig).toBe(false);
		expect(befund.nachschau).toBeUndefined();
	});

	it('meldet an, macht aber NICHT anwesend', async () => {
		/*
		 * Der Kern der ganzen Sache. Anmelden ist keine Anwesenheit: Wer sich vom
		 * Sofa aus einloggt und damit für die Beschlussfähigkeit zählte,
		 * verschöbe das Quorum. Die Freigabe bleibt bei der Sitzungsleitung.
		 */
		const { versammlung } = await aufbau('Kennungsweg E', kennung(5));
		const e = await loeseAuthentikEin(kennung(5), 'Prüflauf');
		const befund = await loeseSitzungAuf(e.merkmal as string);
		const ergebnis = await meldeTeilnahmeAn(
			befund.operatorId as string,
			befund.meetingId as string,
			befund.parteiId as string,
			'authentik'
		);
		expect(ergebnis.zustand).toBe('wartet');

		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		expect(ereignisse.some((x) => x.art === 'eingetroffen')).toBe(false);
	});
});

describe('Was eine Kennung NICHT bewirkt', () => {
	it('weist eine unbekannte Kennung ab', async () => {
		await aufbau('Kennungsweg F', kennung(6));
		const e = await loeseAuthentikEin(FREMD, 'Prüflauf');
		expect(e.gelungen).toBe(false);
		expect(e.merkmal).toBeUndefined();
	});

	it('weist eine leere Kennung ab, statt irgendetwas zu finden', async () => {
		const e = await loeseAuthentikEin('', 'Prüflauf');
		expect(e.gelungen).toBe(false);
	});

	/**
	 * **Das zweite Gerät übernimmt** (Migration 071, 20.08.2026).
	 *
	 * Bis dahin wurde es abgewiesen — «wie bei der Karte». Genau das war der
	 * Fehler im Gedankengang: Der Kartencode ist Besitz, die Anmeldung am Konto
	 * ist Identität. Gemeldet hat es der Auftraggeber mit dem eigenen Telefon: «kommt die
	 * Meldung, dass ich woanders eingeloggt sei und dass das nicht geht.»
	 */
	it('lässt das eigene Konto ein zweites Gerät übernehmen', async () => {
		await aufbau('Kennungsweg G', kennung(7));
		const erste = await loeseAuthentikEin(kennung(7), 'Telefon');
		expect(erste.gelungen).toBe(true);

		const zweite = await loeseAuthentikEin(kennung(7), 'Notebook');
		expect(zweite.gelungen).toBe(true);
		expect(zweite.uebernommen).toBe(true);

		// Das erste Gerät ist draussen — und erfährt den Grund.
		const alt = await loeseSitzungAuf(erste.merkmal as string);
		expect(alt.gueltig).toBe(false);
		expect(alt.grund).toMatch(/anderes Gerät/);

		// Das zweite ist drin.
		expect((await loeseSitzungAuf(zweite.merkmal as string)).gueltig).toBe(true);
	});

	it('meldet keine Übernahme, wenn gar kein Gerät angemeldet war', async () => {
		// Sonst stünde beim ersten Anmelden «Ihr anderes Gerät wurde abgemeldet»,
		// und die Person suchte ein Gerät, das es nie gab.
		await aufbau('Kennungsweg G2', kennung(17));
		const erste = await loeseAuthentikEin(kennung(17), 'Telefon');
		expect(erste.gelungen).toBe(true);
		expect(erste.uebernommen).toBe(false);
	});

	it('vermerkt den Grund an der abgelösten Sitzung', async () => {
		// Der Verlauf einer Sitzung ist der einzige Ort, an dem sich später
		// nachlesen lässt, warum ein Gerät herausflog.
		await aufbau('Kennungsweg G3', kennung(18));
		const erste = await loeseAuthentikEin(kennung(18), 'Telefon');
		await loeseAuthentikEin(kennung(18), 'Notebook');

		const zeilen = await imKontext(
			betreiber,
			(tx) => tx<{ revoked_reason: string | null }[]>`
				SELECT revoked_reason FROM access_session
				WHERE revoked_at IS NOT NULL
				ORDER BY revoked_at DESC LIMIT 1
			`
		);
		expect(zeilen[0]?.revoked_reason).toBe('uebernommen');
		expect(erste.gelungen).toBe(true);
	});

	it('wählt nicht aus, wenn zwei Versammlungen offenstehen', async () => {
		/*
		 * Wer in zwei Gemeinschaften Einheiten hält, kann zwei offene
		 * Versammlungen haben. Eine davon stillschweigend zu nehmen hiesse,
		 * jemanden in den falschen Saal zu setzen — und das fiele erst auf, wenn
		 * seine Stimme in der falschen Abstimmung steht.
		 */
		const doppelt = kennung(8);
		await aufbau('Kennungsweg I/1', doppelt);
		await aufbau('Kennungsweg I/2', doppelt);

		const e = await loeseAuthentikEin(doppelt, 'Prüflauf');
		expect(e.gelungen).toBe(false);
		expect(e.grund).toContain('mehrere Versammlungen');
	});

	it('greift nicht, solange die Versammlung noch nicht freigegeben ist', async () => {
		// Eine Kennung an den Stammdaten reicht nicht: Ohne Momentaufnahme gibt
		// es keine Zeile, an der ein Zugang hängen könnte.
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Kennungsweg H',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Clara Entwurf',
			isCommunity: false,
			representativeName: null
		});
		const eigene = '11111111-2222-4333-8444-555555555555';
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE party SET authentik_subject = ${eigene} WHERE id = ${p.id}`
		);

		const e = await loeseAuthentikEin(eigene, 'Prüflauf');
		expect(e.gelungen).toBe(false);
	});
});

describe('Saalmeldung zuordnen', () => {
	it('nimmt die Kennung der PARTEI entgegen und schreibt trotzdem die der Momentaufnahme', async () => {
		/*
		 * **Der Fehler vom 20.08.2026, festgenagelt.**
		 *
		 * Die Oberfläche schickt beim Zuordnen die Kennung der *Partei* — das ist
		 * die Kennung, die sie in der Auswahlliste führt. `findeZiel` nimmt beide
		 * entgegen, deshalb gelang die Anwesenheit; der Schritt danach schrieb
		 * dann aber denselben Wert in eine Spalte, die auf `snapshot_party` zeigt.
		 * Ergebnis: ein Serverfehler nach halb getaner Arbeit — die Person war
		 * anwesend, die Meldung blieb offen.
		 *
		 * Der Test geht bewusst über die Partei-Kennung. Mit der Kennung der
		 * Momentaufnahme wäre er auch vorher grün gewesen.
		 */
		const { versammlung, parteien } = await aufbau('Saalmeldung A', null);

		const merkmal = await holeOderErzeugeSaalmerkmal(betreiber, versammlung);
		const gemeldet = await meldeUeberSaal(merkmal, 'Doris Draussen');
		expect(gemeldet.gemeldet).toBe(true);

		const offene = await holeOffeneSaalmeldungen(betreiber, versammlung);
		expect(offene).toHaveLength(1);

		const e = await ordneSaalmeldungZu(
			handelnder(betreiber),
			versammlung,
			offene[0].id,
			parteien[0] // die Kennung der PARTEI, nicht die der Momentaufnahme
		);
		expect(e.name).toBe('Anna Muster');

		const [zeile] = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT r.state, r.assigned_snapshot_party_id, p.party_id
				FROM room_entry_request r
				JOIN snapshot_party p ON p.id = r.assigned_snapshot_party_id
				WHERE r.id = ${offene[0].id}
			`
		);
		expect(zeile.state).toBe('zugeordnet');
		// Der Fremdschlüssel greift: In der Spalte steht eine Zeile der
		// Momentaufnahme, und die gehört zur eingegebenen Partei.
		expect(zeile.party_id).toBe(parteien[0]);

		// Und die Meldung ist weg aus der offenen Liste.
		expect(await holeOffeneSaalmeldungen(betreiber, versammlung)).toHaveLength(0);
	});
});

describe('Der Rückfall auf die lokale Anmeldung', () => {
	/*
	 * **Warum dieser Test gegen die Datenbank läuft.**
	 *
	 * `vermerkeRueckfall` schreibt eine Zeile in `audit_entry`, und die steht
	 * unter Zeilenschutz: `operator_id` muss der Einstellung
	 * `versammlung.operator_id` entsprechen. Ein Mock-Test sähe die Regel nicht
	 * und wäre grün geblieben.
	 *
	 * **Was am 27.08.2026 geschah.** Die Funktion öffnete die Transaktion mit
	 * `sql.begin` statt mit `alsBetreiber` und setzte die Einstellung nicht. Die
	 * Zeile wurde abgewiesen, der Fehler schlug bis in die Antwort durch, und
	 * jede lokale Anmeldung endete mit HTTP 500 — aber nur, solange Authentik
	 * als nicht erreichbar galt. Also genau in dem Fall, für den AD-9 die lokale
	 * Anmeldung vorsieht. Der Notweg riss auf, sobald man ihn betrat.
	 *
	 * Aufgefallen ist es zufällig: Der Entwicklungsserver stand unter Last, die
	 * Erreichbarkeitsprüfung lief in ihr Zeitlimit, und plötzlich kam niemand
	 * mehr herein. Ohne diese Last wäre es auf Prod aufgefallen, im Saal.
	 */
	it('hält den Vermerk fest, statt die Anmeldung scheitern zu lassen', async () => {
		const benutzer = await pruefbenutzer(betreiber, `rueckfall-${Date.now()}`);

		await vermerkeRueckfall({
			operatorId: betreiber,
			userId: benutzer,
			label: 'Prüflauf Rückfall'
		});

		const [zeile] = await admin<{ event_type: string; operator_id: string; detail: unknown }[]>`
			SELECT event_type, operator_id, detail
			  FROM audit_entry
			 WHERE actor_user_id = ${benutzer}
			 ORDER BY id DESC
			 LIMIT 1
		`;
		expect(zeile, 'kein Vermerk geschrieben').toBeTruthy();
		expect(zeile.event_type).toBe('user.login.fallback');
		// **Der Mandant gehört an die Zeile.** Ohne ihn sähe sie kein Betreiber:
		// Seit Migration 154 liest die Anwendung nur Zeilen ihres Betreibers.
		expect(zeile.operator_id).toBe(betreiber);
	});

	/*
	 * Ohne Betreiber gibt es keinen Mandanten, unter dem die Zeile stehen
	 * könnte. Sie ohne ihn zu schreiben hiesse, sie keinem Betreiber sichtbar
	 * zu machen (Migration 154); ein Vermerk, den niemand liest, belegt nichts.
	 * Der Vermerk entfällt dann, die Anmeldung nicht.
	 */
	it('lässt die Anmeldung durch, wenn kein Betreiber bekannt ist', async () => {
		await expect(
			vermerkeRueckfall({ operatorId: null, userId: null, label: 'Ohne Betreiber' })
		).resolves.toBeUndefined();
	});
});
