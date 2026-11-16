/**
 * Mitberechtigte an gemeinschaftlichem Eigentum (Migration 094).
 *
 * Geprüft wird die Datenbank, nicht die Anwendung: Die Schranken sind die
 * Zusage, auf die sich alles Weitere verlässt. Hält eine davon nicht, hilft
 * keine Prüfung im Formular — von Hand schreiben lässt sich trotzdem.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import {
	bearbeiteEigentuemer,
	entferneEigentuemer,
	erstelleEigentuemer,
	erstelleGemeinschaftlicheZeile,
	ordneEigentumZu,
	stimmkraftAnsicht,
	trageMiteigentumEin
} from '$lib/server/eigentuemer';
import { erstelleEinheit } from '$lib/server/einheiten';
import {
	entferneMitberechtigten,
	holeHuellenDerPerson,
	holeMitberechtigte,
	holeMitberechtigteJeHuelle,
	holeNurMitberechtigte,
	nimmMitberechtigtenAuf,
	setzeVertretung,
	setzeZustelladresse
} from '$lib/server/mitberechtigte';
import { archiviere } from '$lib/server/archivieren';
import { fuehreUebernahmeAus, vorschau } from '$lib/server/uebernahme';
import { holeEigentuemer } from '$lib/server/eigentuemer';
import { eigentuemerzeileAusPerson, erstellePerson, verknuepfePartei } from '$lib/server/personen';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

async function gemeinschaftMitZeilen(name: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const huelle = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna und Beat Muster',
		isCommunity: true,
		representativeName: 'Anna Muster'
	});
	const anna = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna Muster',
		isCommunity: false,
		representativeName: null
	});
	const beat = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Beat Muster',
		isCommunity: false,
		representativeName: null
	});
	return { gemeinschaft: g.id, huelle: huelle.id, anna: anna.id, beat: beat.id };
}

/** Schreibt direkt in die Tabelle — hier wird die Schranke geprüft, nicht die Schale. */
async function trageEin(
	stwegId: string,
	huelle: string,
	mitglied: string,
	zustelladresse = false
) {
	await admin`
		INSERT INTO party_member (operator_id, stweg_id, huelle_party_id, mitglied_party_id,
		                          ist_zustelladresse)
		VALUES (${betreiber}, ${stwegId}, ${huelle}, ${mitglied}, ${zustelladresse})
	`;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Mitberechtigte');
	benutzer = await pruefbenutzer(betreiber, 'mitberechtigtenleitung');
});

afterAll(verbindungenSchliessen);

describe('Die Tabelle der Mitberechtigten', () => {
	it('nimmt zwei Mitberechtigte an derselben Hülle auf', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 1');
		await trageEin(s.gemeinschaft, s.huelle, s.anna);
		await trageEin(s.gemeinschaft, s.huelle, s.beat);

		const zeilen = await admin`
			SELECT mitglied_party_id FROM party_member WHERE huelle_party_id = ${s.huelle}
		`;
		expect(zeilen).toHaveLength(2);
	});

	it('weist dieselbe Person zweimal an derselben Hülle ab', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 2');
		await trageEin(s.gemeinschaft, s.huelle, s.anna);
		await expect(trageEin(s.gemeinschaft, s.huelle, s.anna)).rejects.toThrow(
			/party_member_einmalig/
		);
	});

	it('weist eine Hülle als Mitglied ab — keine Hülle in der Hülle', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 3');
		const zweiteHuelle = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: s.gemeinschaft,
			kind: 'natural',
			displayName: 'Erbengemeinschaft Muster',
			isCommunity: true,
			representativeName: 'Anna Muster'
		});
		await expect(trageEin(s.gemeinschaft, s.huelle, zweiteHuelle.id)).rejects.toThrow();
	});

	it('weist eine gewöhnliche Zeile als Hülle ab', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 4');
		await expect(trageEin(s.gemeinschaft, s.anna, s.beat)).rejects.toThrow();
	});

	it('weist eine Zeile aus einer anderen Gemeinschaft ab', async () => {
		const eins = await gemeinschaftMitZeilen('Mitberechtigte 5a');
		const zwei = await gemeinschaftMitZeilen('Mitberechtigte 5b');
		await expect(trageEin(eins.gemeinschaft, eins.huelle, zwei.anna)).rejects.toThrow();
	});

	it('lässt höchstens eine gemeldete Zustelladresse zu', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 6');
		await trageEin(s.gemeinschaft, s.huelle, s.anna, true);
		await expect(trageEin(s.gemeinschaft, s.huelle, s.beat, true)).rejects.toThrow(
			/party_member_eine_zustelladresse/
		);
		// Ohne die Meldung geht die zweite Zeile durch — der Regelfall.
		await trageEin(s.gemeinschaft, s.huelle, s.beat, false);
	});

	it('nimmt die Mitgliedschaft mit, wenn die Hülle verschwindet', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 7');
		await trageEin(s.gemeinschaft, s.huelle, s.anna);
		await admin`DELETE FROM party WHERE id = ${s.huelle}`;
		const rest = await admin`SELECT 1 FROM party_member WHERE huelle_party_id = ${s.huelle}`;
		expect(rest).toHaveLength(0);
	});

	/*
	 * **Nicht im Plan, sondern beim Umsetzen gemessen** (26.08.2026). Ohne diese
	 * Klammer liess sich eine Zeile mit einer fremden Betreiberkennung anlegen —
	 * gemessen, sie ging durch. Der Zeilenschutz filtert allein über
	 * `operator_id`; die Zeile wäre dann beim falschen Mandanten sichtbar
	 * gewesen und beim richtigen nicht.
	 */
	it('weist eine fremde Betreiberkennung ab', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 8');
		const fremder = await pruefbetreiber('Fremdbetreiber Mitberechtigte');
		await expect(
			admin`
				INSERT INTO party_member (operator_id, stweg_id, huelle_party_id, mitglied_party_id)
				VALUES (${fremder}, ${s.gemeinschaft}, ${s.huelle}, ${s.anna})
			`
		).rejects.toThrow(/party_member_gleicher_betreiber/);
	});
});

/*
 * **Der Klassen-Wächter aus `eigentuemerzeile-tilgen.test.ts` hat es verlangt.**
 * Ein Mitglied hält keine Einheit und steht auf keiner Momentaufnahme — nach
 * jedem bisherigen Massstab war die Zeile «leer» und wurde kommentarlos
 * getilgt, samt Mitgliedschaft (CASCADE). Danach fehlte ein Miteigentümer, und
 * seine Einladung nach ZGB Art. 712n blieb aus, ohne dass es auffiel.
 */
describe('Eine Zeile, die an einer Hülle hängt', () => {
	it('lässt sich nicht tilgen, solange sie mitberechtigt ist', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 9');
		await trageEin(s.gemeinschaft, s.huelle, s.anna);
		// Auf die Kennung geprüft, nicht bloss auf die Fehlerart: `entferneEigentuemer`
		// wirft an fünf Stellen einen `FachlicherFehler`, und ein Test, der jeden
		// davon annimmt, bestätigte auch den falschen Grund.
		await expect(entferneEigentuemer(handelnder(betreiber), s.anna)).rejects.toMatchObject({
			name: 'FachlicherFehler',
			kennung: 'ist_mitberechtigt'
		});
	});

	it('lässt sich tilgen, sobald die Zuordnung gelöst ist', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 10');
		await trageEin(s.gemeinschaft, s.huelle, s.anna);
		await admin`DELETE FROM party_member WHERE mitglied_party_id = ${s.anna}`;
		await entferneEigentuemer(handelnder(betreiber), s.anna);
		const rest = await admin`SELECT 1 FROM party WHERE id = ${s.anna}`;
		expect(rest).toHaveLength(0);
	});

	/*
	 * **Berichtigt am 26.08.2026 (Migration 095).** Hier stand der Vertreter
	 * ohne Mitgliedschaft — «sonst spräche schon die Schranke davor an». Genau
	 * diesen Zustand verbietet `party_vertreter_ist_mitglied` seither. Der Fall
	 * wird deshalb von beiden Seiten festgehalten: Der Zustand lässt sich nicht
	 * mehr herstellen, und wo er entstehen könnte, hält die erste Absage.
	 *
	 * Damit ist `vertritt_gemeinschaft` in `pruefeZeileTilgbar` nicht mehr
	 * erreichbar — es bleibt als zweite Reihe stehen, falls die Schranke einmal
	 * fiele.
	 */
	it('lässt sich nicht tilgen, solange sie die Stimme einer Hülle ausübt', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 11');
		await trageEin(s.gemeinschaft, s.huelle, s.anna);
		await admin`
			UPDATE party SET representative_party_id = ${s.anna} WHERE id = ${s.huelle}
		`;
		await expect(entferneEigentuemer(handelnder(betreiber), s.anna)).rejects.toMatchObject({
			name: 'FachlicherFehler',
			kennung: 'ist_mitberechtigt'
		});
	});

	it('lässt sich gar nicht erst als Vertreterin eintragen, ohne mitberechtigt zu sein', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 11b');
		await expect(
			admin`UPDATE party SET representative_party_id = ${s.anna} WHERE id = ${s.huelle}`
		).rejects.toThrow(/party_vertreter_ist_mitglied/);
	});
});

/**
 * Der Vertreterverweis (`party.representative_party_id`).
 *
 * Er trägt dieselben zwei Klammern wie die Tabelle daneben — im Plan stand ein
 * blosses `REFERENCES party (id)`, und damit liess sich beim Umsetzen gemessen
 * eine Zeile aus einem fremden Haus eintragen.
 */
describe('Der Vertreterverweis', () => {
	it('nimmt eine Zeile aus demselben Haus an', async () => {
		const s = await gemeinschaftMitZeilen('Vertreter 1');
		// Seit Migration 095 muss die Mitgliedschaft vorher stehen.
		await trageEin(s.gemeinschaft, s.huelle, s.anna);
		await admin`UPDATE party SET representative_party_id = ${s.anna} WHERE id = ${s.huelle}`;
		const [zeile] = await admin<{ representative_party_id: string }[]>`
			SELECT representative_party_id FROM party WHERE id = ${s.huelle}
		`;
		expect(zeile.representative_party_id).toBe(s.anna);
	});

	it('weist eine Zeile aus einem anderen Haus ab', async () => {
		const eins = await gemeinschaftMitZeilen('Vertreter 2a');
		const zwei = await gemeinschaftMitZeilen('Vertreter 2b');
		await expect(
			admin`UPDATE party SET representative_party_id = ${zwei.anna} WHERE id = ${eins.huelle}`
		).rejects.toThrow(/party_vertreter_fk/);
	});

	it('weist den Selbstbezug ab', async () => {
		const s = await gemeinschaftMitZeilen('Vertreter 3');
		await expect(
			admin`UPDATE party SET representative_party_id = ${s.huelle} WHERE id = ${s.huelle}`
		).rejects.toThrow(/party_vertreter_kein_selbstbezug/);
	});

	it('setzt nur den Verweis zurück, wenn die Vertreterzeile fällt — nicht die Gemeinschaft', async () => {
		const s = await gemeinschaftMitZeilen('Vertreter 4');
		await trageEin(s.gemeinschaft, s.huelle, s.anna);
		await admin`UPDATE party SET representative_party_id = ${s.anna} WHERE id = ${s.huelle}`;
		await admin`DELETE FROM party WHERE id = ${s.anna}`;
		const [zeile] = await admin<
			{ representative_party_id: string | null; stweg_id: string; representative_name: string }[]
		>`
			SELECT representative_party_id, stweg_id, representative_name
			  FROM party WHERE id = ${s.huelle}
		`;
		expect(zeile.representative_party_id).toBeNull();
		// `ON DELETE SET NULL` ohne Spaltenangabe hätte auch `stweg_id` genullt —
		// die Spalte ist NOT NULL, das Löschen wäre an unerwarteter Stelle gebrochen.
		expect(zeile.stweg_id).toBe(s.gemeinschaft);
		// Der Name bleibt: Die Urkunde muss sagen, wer am Versammlungstag vertrat.
		expect(zeile.representative_name).toBe('Anna Muster');
	});
});

/*
 * ────────────────────────────────────────────────────────────────────────────
 * Aufgabe 2: der Lese- und Schreibweg (`src/lib/server/mitberechtigte.ts`).
 */
describe('Der Schreibweg', () => {
	it('nimmt auf, liest zurück und entfernt wieder', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 12');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.beat);

		const gelesen = await holeMitberechtigte(betreiber, s.huelle);
		expect(gelesen.map((m) => m.displayName)).toEqual(['Anna Muster', 'Beat Muster']);

		await entferneMitberechtigten(handelnder(betreiber), s.huelle, s.beat);
		expect(await holeMitberechtigte(betreiber, s.huelle)).toHaveLength(1);
	});

	it('schreibt beide Vorgänge in den Verlauf', async () => {
		// Ohne Spur bliebe im Streit «ich wurde nie eingeladen» Aussage gegen
		// Aussage — wer zur Hülle gehört, entscheidet über die Einladung.
		const s = await gemeinschaftMitZeilen('Mitberechtigte 13');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await entferneMitberechtigten(handelnder(betreiber), s.huelle, s.anna);

		const eintraege = await admin<{ event_type: string }[]>`
			SELECT event_type FROM audit_entry
			 WHERE subject_id = ${s.huelle} AND event_type LIKE 'party.member.%'
			 ORDER BY id
		`;
		expect(eintraege.map((e) => e.event_type)).toEqual([
			'party.member.added',
			'party.member.removed'
		]);
	});

	it('meldet den Vertreter mit, sobald der Verweis steht', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 14');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.beat);
		await admin`UPDATE party SET representative_party_id = ${s.anna} WHERE id = ${s.huelle}`;

		const gelesen = await holeMitberechtigte(betreiber, s.huelle);
		expect(gelesen.filter((m) => m.istVertreter).map((m) => m.displayName)).toEqual([
			'Anna Muster'
		]);
	});

	it('bündelt die Mitberechtigten der ganzen Gemeinschaft je Hülle', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 15');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.beat);

		const je = await holeMitberechtigteJeHuelle(betreiber, s.gemeinschaft);
		expect([...je.keys()]).toEqual([s.huelle]);
		expect(je.get(s.huelle)?.map((m) => m.displayName)).toEqual(['Anna Muster', 'Beat Muster']);
	});

	it('wechselt die gemeldete Zustelladresse, ohne am Teilindex zu scheitern', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 16');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.beat);

		await setzeZustelladresse(handelnder(betreiber), s.huelle, s.anna);
		await setzeZustelladresse(handelnder(betreiber), s.huelle, s.beat);

		const gelesen = await holeMitberechtigte(betreiber, s.huelle);
		expect(gelesen.filter((m) => m.istZustelladresse).map((m) => m.displayName)).toEqual([
			'Beat Muster'
		]);

		await setzeZustelladresse(handelnder(betreiber), s.huelle, null);
		expect((await holeMitberechtigte(betreiber, s.huelle)).some((m) => m.istZustelladresse)).toBe(
			false
		);
	});
});

/*
 * **Die Absagen vor den Schranken.** `docs/gestaltung.md`: «Eine Schranke der
 * Datenbank ist keine Fehlermeldung.» Jede Prüfung hier hat eine Schranke aus
 * Migration 094 hinter sich — geprüft wird, dass der Satz kommt und nicht der
 * Fremdschlüssel. Auf die Kennung geprüft, nicht bloss auf die Fehlerart: Ein
 * Test, der jeden `FachlicherFehler` annimmt, bestätigte auch den falschen
 * Grund.
 */
describe('Die Absagen des Schreibwegs', () => {
	it('weist eine gewöhnliche Zeile als Hülle ab', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 17');
		await expect(
			nimmMitberechtigtenAuf(handelnder(betreiber), s.anna, s.beat)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'keine_huelle' });
	});

	it('weist eine zweite Hülle als Mitglied ab', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 18');
		const zweite = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: s.gemeinschaft,
			kind: 'natural',
			displayName: 'Erbengemeinschaft Muster',
			isCommunity: true,
			representativeName: 'Anna Muster'
		});
		await expect(
			nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, zweite.id)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'mitglied_ist_huelle' });
	});

	it('weist eine Zeile aus einer anderen Gemeinschaft ab', async () => {
		const eins = await gemeinschaftMitZeilen('Mitberechtigte 19a');
		const zwei = await gemeinschaftMitZeilen('Mitberechtigte 19b');
		await expect(
			nimmMitberechtigtenAuf(handelnder(betreiber), eins.huelle, zwei.anna)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'fremde_gemeinschaft' });
	});

	it('weist dieselbe Person zweimal ab', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 20');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await expect(
			nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'schon_mitberechtigt' });
	});

	it('weist den Selbstbezug ab', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 21');
		await expect(
			nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.huelle)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'selbstbezug' });
	});

	/*
	 * **Zwei Mitberechtigte, nicht einer** (26.08.2026 berichtigt, aus dem
	 * Code-Review). Die Absage gilt seither nur, solange jemand anderes
	 * dasteht: Die letzte Person ist zwangsläufig die vertretende, und ohne
	 * Ausnahme wäre die Hülle für immer gesperrt. Der Fall «letzte Person» hat
	 * einen eigenen Test unter «Eine Hülle mit Mitberechtigten tilgen».
	 */
	it('entfernt nicht die Person, die die Stimme ausübt', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 22');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.beat);
		await admin`UPDATE party SET representative_party_id = ${s.anna} WHERE id = ${s.huelle}`;

		await expect(
			entferneMitberechtigten(handelnder(betreiber), s.huelle, s.anna)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'vertritt_gemeinschaft' });
		// Und die Zuordnung steht noch: Eine Absage, die trotzdem löscht, wäre
		// schlimmer als gar keine.
		expect(await holeMitberechtigte(betreiber, s.huelle)).toHaveLength(2);
	});

	it('sagt ab, statt ins Leere zu löschen', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 23');
		await expect(
			entferneMitberechtigten(handelnder(betreiber), s.huelle, s.beat)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'nicht_mitberechtigt' });
	});

	it('lässt die gemeldete Zustelladresse stehen, wenn die neue nicht dazugehört', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 24');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await setzeZustelladresse(handelnder(betreiber), s.huelle, s.anna);

		await expect(
			setzeZustelladresse(handelnder(betreiber), s.huelle, s.beat)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'nicht_mitberechtigt' });

		// Das Zurücksetzen läuft vor dem Setzen. Ohne Rücknahme der Transaktion
		// stünde die Hülle jetzt ohne gemeldete Adresse da — und niemand hätte es
		// gesehen.
		const gelesen = await holeMitberechtigte(betreiber, s.huelle);
		expect(gelesen.filter((m) => m.istZustelladresse).map((m) => m.displayName)).toEqual([
			'Anna Muster'
		]);
	});
});

/*
 * **Der Haken «Gemeinschaftliches Eigentum» beim Speichern** (Pendenz aus
 * Aufgabe 1). `bearbeiteEigentuemer` schreibt `is_community` bei jedem
 * Speichern mit; sobald Mitberechtigte daran hängen, hält der Fremdschlüssel
 * dagegen. Vor dieser Prüfung kam eine rohe 500 heraus — `uebersetzeSchranke`
 * kennt 23503 bewusst nicht.
 */
describe('Der Haken an einer Zeile mit Mitberechtigten', () => {
	it('lässt sich nicht wegnehmen, solange Mitberechtigte daran hängen', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 25');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);

		await expect(
			bearbeiteEigentuemer(handelnder(betreiber), s.huelle, {
				stwegId: s.gemeinschaft,
				kind: 'natural',
				displayName: 'Anna und Beat Muster',
				isCommunity: false,
				representativeName: null
			})
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'huelle_hat_mitberechtigte' });
	});

	it('lässt sich nicht setzen, solange die Zeile selbst mitberechtigt ist', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 26');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);

		await expect(
			bearbeiteEigentuemer(handelnder(betreiber), s.anna, {
				stwegId: s.gemeinschaft,
				kind: 'natural',
				displayName: 'Anna Muster',
				isCommunity: true,
				representativeName: 'Anna Muster'
			})
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'mitglied_wird_huelle' });
	});

	it('lässt jedes andere Speichern an der Hülle unangetastet', async () => {
		// Die Sichtprobe zur Schranke: Sie darf nur den Haken selbst treffen.
		// Ohne sie wäre die Prüfung oben auch dann grün, wenn sie jedes Speichern
		// abwiese.
		const s = await gemeinschaftMitZeilen('Mitberechtigte 27');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);

		const geaendert = await bearbeiteEigentuemer(handelnder(betreiber), s.huelle, {
			stwegId: s.gemeinschaft,
			kind: 'natural',
			displayName: 'Anna und Beat Muster-Meier',
			isCommunity: true,
			representativeName: 'Anna Muster',
			email: 'huelle@example.ch'
		});
		expect(geaendert.displayName).toBe('Anna und Beat Muster-Meier');
	});
});

/*
 * ────────────────────────────────────────────────────────────────────────────
 * Was das Code-Review vom 26.08.2026 gefunden hat. Jede Behebung hat hier
 * ihren Fall — eine Behebung ohne Prüfung ist eine Behauptung.
 */
describe('Die Nachbesserungen aus dem Review', () => {
	it('sagt «nicht mitberechtigt», bevor sie über den Vertreter spricht', async () => {
		// Vorher stand die Vertreterprüfung zuerst: Wer eine gar nicht
		// eingetragene Zeile wegnehmen wollte, las «bestimmen Sie zuerst eine
		// andere Vertretung» — richtig geraten, am Fall vorbei.
		//
		// **Anders gebaut seit Migration 095** (26.08.2026): Der Vertreter muss
		// jetzt selbst mitberechtigt sein. Der Fall bleibt derselbe — vertreten
		// wird von Beat, weggenommen werden soll Anna, die gar nicht dabei ist.
		const s = await gemeinschaftMitZeilen('Mitberechtigte 28');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.beat);
		await admin`UPDATE party SET representative_party_id = ${s.beat} WHERE id = ${s.huelle}`;
		await expect(
			entferneMitberechtigten(handelnder(betreiber), s.huelle, s.anna)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'nicht_mitberechtigt' });
	});

	it('schreibt Name und gemeldete Zustelladresse in den Eintrag zum Entfernen', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 29');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.beat);
		await setzeZustelladresse(handelnder(betreiber), s.huelle, s.anna);
		await entferneMitberechtigten(handelnder(betreiber), s.huelle, s.anna);

		const [eintrag] = await admin<{ detail: Record<string, unknown> }[]>`
			SELECT detail FROM audit_entry
			 WHERE subject_id = ${s.huelle} AND event_type = 'party.member.removed'
		`;
		// Ohne den Namen stünde dort nur eine Kennung — und sobald die Zeile
		// getilgt ist, sagt der Eintrag niemandem mehr, wer entfernt wurde.
		expect(eintrag.detail.name).toBe('Anna Muster');
		expect(eintrag.detail.war_zustelladresse).toBe(true);
	});

	it('weist die Zustelladresse an einer gewöhnlichen Zeile ab', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 30');
		await expect(
			setzeZustelladresse(handelnder(betreiber), s.anna, null)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'keine_huelle' });
	});

	it('schreibt keinen Eintrag, wenn gar keine Zustelladresse gemeldet war', async () => {
		const s = await gemeinschaftMitZeilen('Mitberechtigte 31');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await setzeZustelladresse(handelnder(betreiber), s.huelle, null);

		const eintraege = await admin`
			SELECT 1 FROM audit_entry
			 WHERE subject_id = ${s.huelle} AND event_type = 'party.member.delivery.cleared'
		`;
		expect(eintraege).toHaveLength(0);

		// Die Sichtprobe: Wo etwas aufzuheben war, entsteht der Eintrag sehr wohl.
		await setzeZustelladresse(handelnder(betreiber), s.huelle, s.anna);
		await setzeZustelladresse(handelnder(betreiber), s.huelle, null);
		const danach = await admin`
			SELECT 1 FROM audit_entry
			 WHERE subject_id = ${s.huelle} AND event_type = 'party.member.delivery.cleared'
		`;
		expect(danach).toHaveLength(1);
	});

	it('lässt eine archivierte Mitberechtigte stehen und sagt es', async () => {
		// Sie aus der Liste zu filtern verkleinerte den Empfängerkreis nach
		// ZGB Art. 712n stillschweigend. Wer sie nicht anschreiben will,
		// entscheidet das selbst — dafür kommt `archiviertAm` mit.
		const s = await gemeinschaftMitZeilen('Mitberechtigte 32');
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.anna);
		await nimmMitberechtigtenAuf(handelnder(betreiber), s.huelle, s.beat);
		await archiviere(handelnder(betreiber), 'eigentuemer', s.beat, 'Prüflauf');

		const gelesen = await holeMitberechtigte(betreiber, s.huelle);
		expect(gelesen).toHaveLength(2);
		expect(gelesen.find((m) => m.displayName === 'Anna Muster')?.archiviertAm).toBeNull();
		expect(gelesen.find((m) => m.displayName === 'Beat Muster')?.archiviertAm).not.toBeNull();
	});
});

/*
 * **Der zweite Schreiber von `is_community`** (Code-Review, Befund 1). Der
 * Upsert der Übernahme setzt den Haken aus der Quelldatei — auch auf
 * bestehenden Zeilen. Ohne die Prüfung bräche die ganze Übernahme an einem
 * Fremdschlüssel ab, mit einer rohen 500 und ohne zu sagen, an welcher Zeile.
 */
describe('Der Haken beim Einspielen einer Datei', () => {
	const MIT_ZWEIEN = [
		'voter_ref;display_name;person_names;ownership_type;legal_representatives',
		'E9;Anna und Beat Muster;Anna Muster|Beat Muster;gesamteigentum;Anna Muster'
	].join('\n');
	const MIT_EINER = [
		'voter_ref;display_name;person_names;ownership_type;legal_representatives',
		'E9;Anna Muster allein;;alleineigentum;'
	].join('\n');

	it('sagt mit einem Satz ab, statt an der Schranke zu brechen', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Mitberechtigte 33',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		await fuehreUebernahmeAus(handelnder(betreiber), g.id, MIT_ZWEIEN, '2026-01-01');
		/*
		 * **Über den Haken gesucht, nicht über die Stelle in der Liste**
		 * (27.08.2026 berichtigt). Seit Aufgabe 6 legt die Übernahme aus zwei
		 * genannten Personen eine Hülle **mit** Mitberechtigten an; die erste Zeile
		 * der nach Namen sortierten Liste ist damit «Anna Muster» und nicht mehr
		 * die Hülle.
		 */
		const huelle = (await holeEigentuemer(betreiber, g.id, 'aktiv')).find((p) => p.isCommunity)!;
		expect(huelle.isCommunity).toBe(true);
		expect(await holeMitberechtigte(betreiber, huelle.id)).toHaveLength(2);

		const anna = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Anna Muster',
			isCommunity: false,
			representativeName: null
		});
		await nimmMitberechtigtenAuf(handelnder(betreiber), huelle.id, anna.id);

		/*
		 * **Übersprungen statt abgebrochen** (27.08.2026 geändert, aus dem
		 * Code-Review zu Aufgabe 6).
		 *
		 * Bis hierher warf `pruefeHakenUmlegbar` mitten in der Transaktion, und
		 * die ganze Übernahme scheiterte. Das war vertretbar, solange eine Hülle
		 * mit Mitberechtigten nur von Hand entstehen konnte. Seit die Übernahme
		 * selbst welche anlegt, ist «die Datei nennt nur noch eine Person» der
		 * Alltagsfall — und eine Datei mit fünfzig Zeilen bliebe daran hängen.
		 *
		 * Jetzt entscheidet die Vorschau: Die Zeile wird übersprungen, der Grund
		 * steht da, die übrigen laufen durch. `pruefeHakenUmlegbar` bleibt als
		 * Netz darunter und ist über `bearbeiteEigentuemer` weiter geprüft.
		 */
		const plan = await vorschau(betreiber, g.id, MIT_EINER, '2026-09-01');
		expect(plan.zusammenfassung.fehlerhaft).toBe(1);
		expect(plan.befunde[0].grund).toMatch(/hängen 3 Mitberechtigte/);

		const ergebnis = await fuehreUebernahmeAus(
			handelnder(betreiber),
			g.id,
			MIT_EINER,
			'2026-01-01'
		);
		expect(ergebnis).toMatchObject({ angelegt: 0, geaendert: 0, uebersprungen: 1 });

		// Und die Übernahme hat nichts halb erledigt: Der Haken steht noch.
		// Über die Kennung gesucht, nicht über die Stelle in der Liste — seit der
		// Mitberechtigten stehen dort zwei Zeilen.
		const danach = (await holeEigentuemer(betreiber, g.id, 'aktiv')).find(
			(p) => p.id === huelle.id
		);
		expect(danach?.isCommunity).toBe(true);
	});

	it('lässt eine Datei ohne Hakenwechsel unverändert durch', async () => {
		// Die Sichtprobe zur Schranke oben: Sie darf nur den Wechsel treffen.
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Mitberechtigte 34',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		await fuehreUebernahmeAus(handelnder(betreiber), g.id, MIT_ZWEIEN, '2026-01-01');
		const huelle = (await holeEigentuemer(betreiber, g.id, 'aktiv')).find((p) => p.isCommunity)!;
		const anna = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Anna Muster',
			isCommunity: false,
			representativeName: null
		});
		await nimmMitberechtigtenAuf(handelnder(betreiber), huelle.id, anna.id);

		const nochmals = MIT_ZWEIEN.replace('Anna und Beat Muster;', 'Anna und Beat Muster-Meier;');
		const ergebnis = await fuehreUebernahmeAus(handelnder(betreiber), g.id, nochmals, '2026-01-01');
		expect(ergebnis.geaendert).toBe(1);
	});
});

/*
 * ────────────────────────────────────────────────────────────────────────────
 * Aufgabe 3: die Erfassungsmaske (`erstelleGemeinschaftlicheZeile`).
 */

/** Eine leere Gemeinschaft — die Zeilen entstehen hier in einem Zug. */
async function leereGemeinschaft(name: string): Promise<string> {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	return g.id;
}

function person(name: string, email: string | null = null, adresse: string | null = null) {
	return { name, email, adresse };
}

describe('Eine gemeinschaftliche Zeile anlegen', () => {
	it('legt Hülle, Mitberechtigte und Vertreterverweis in einem Zug an', async () => {
		const g = await leereGemeinschaft('Erfassung 1');

		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [
				person('Anna Muster', 'anna@example.ch', 'Probehalde 14'),
				person('Beat Muster', 'beat@example.ch')
			],
			vertreterIndex: 0
		});

		const [zeile] = await admin<
			{ display_name: string; representative_name: string; is_community: boolean }[]
		>`
			SELECT display_name, representative_name, is_community FROM party WHERE id = ${huelle}
		`;
		expect(zeile.display_name).toBe('Anna Muster und Beat Muster');
		expect(zeile.representative_name).toBe('Anna Muster');
		expect(zeile.is_community).toBe(true);

		const mitglieder = await holeMitberechtigte(betreiber, huelle);
		expect(mitglieder).toHaveLength(2);
		expect(mitglieder.find((m) => m.istVertreter)?.displayName).toBe('Anna Muster');
		expect(mitglieder.find((m) => m.displayName === 'Beat Muster')?.email).toBe('beat@example.ch');
		expect(mitglieder.find((m) => m.displayName === 'Anna Muster')?.address).toBe(
			'Probehalde 14'
		);
	});

	it('schreibt für jede Zeile einen Verlaufseintrag', async () => {
		// Der Plan legte die Zeilen mit rohen `INSERT`s an — dann entstünden drei
		// Eigentümerzeilen ohne eine einzige Spur. Wer später fragt, woher die
		// Zeile kommt, fände nichts.
		const g = await leereGemeinschaft('Erfassung 2');
		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 1
		});

		const eintraege = await admin<{ event_type: string }[]>`
			SELECT event_type FROM audit_entry
			 WHERE subject_id IN (SELECT id::text FROM party WHERE stweg_id = ${g})
			 ORDER BY id
		`;
		expect(eintraege.filter((e) => e.event_type === 'party.created')).toHaveLength(3);
		expect(eintraege.filter((e) => e.event_type === 'party.member.added')).toHaveLength(2);

		const mitglieder = await holeMitberechtigte(betreiber, huelle);
		expect(mitglieder.find((m) => m.istVertreter)?.displayName).toBe('Beat Muster');
	});

	/*
	 * **Seit dem 27.08.2026 ist die Vertretung freiwillig** (Produktentscheid).
	 * Ein Index ausserhalb der Liste heisst damit nicht mehr «Absage», sondern
	 * «niemand bezeichnet» — genau das schickt die Maske, wenn niemand
	 * angekreuzt ist (`vertreterIndex` = −1).
	 */
	it('legt die Zeile ohne Vertretung an, wenn niemand bezeichnet ist', async () => {
		const g = await leereGemeinschaft('Erfassung 3');
		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: -1
		});

		const [zeile] = await admin<
			{ representative_name: string | null; representative_party_id: string | null }[]
		>`
			SELECT representative_name, representative_party_id FROM party WHERE id = ${huelle}
		`;
		expect(zeile.representative_name).toBeNull();
		expect(zeile.representative_party_id).toBeNull();
		// Die Mitberechtigten stehen trotzdem, jeder mit seiner eigenen Einladung.
		expect(await holeMitberechtigte(betreiber, huelle)).toHaveLength(2);
	});

	it('verlangt die Vertretung bei einer juristischen Hülle weiterhin', async () => {
		// `party_vertretung_bei_juristisch` (Migration 025) bleibt: Eine AG
		// handelt nie selbst. Die Absage zeigt auf das Feld, das die Maske führt.
		const g = await leereGemeinschaft('Erfassung 3b');
		await expect(
			erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
				stwegId: g,
				kind: 'legal',
				personen: [person('Anna Muster'), person('Beat Muster')],
				vertreterIndex: -1
			})
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'vertretung_fehlt' });
		expect(await admin`SELECT 1 FROM party WHERE stweg_id = ${g}`).toHaveLength(0);
	});

	/*
	 * **Produktentscheid 26.08.2026: doppelte Namen werden abgewiesen.** Der
	 * Sammelname lautete sonst «Anna Muster und Anna Muster», und der
	 * eingefrorene `representative_name` benennt nicht mehr eindeutig, wer
	 * stimmt — auf einer Urkunde, die im Anfechtungsfall auf dem Tisch liegt.
	 */
	it('weist zwei gleiche Namen ab und nennt den Ausweg', async () => {
		const g = await leereGemeinschaft('Erfassung 4');
		await expect(
			erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
				stwegId: g,
				kind: 'natural',
				personen: [person('Anna Muster'), person('Anna Muster')],
				vertreterIndex: 0
			})
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'name_doppelt' });
		expect(await admin`SELECT 1 FROM party WHERE stweg_id = ${g}`).toHaveLength(0);
	});

	/*
	 * **Die Mindestzahl greift beim Speichern der Hülle als Ganzes** (Entscheid
	 * Auftraggeber, 26.08.2026). Beim einzelnen Entfernen ist sie bewusst nicht
	 * erzwungen: Der Berichtigungsweg «falsche Person weg, richtige hin» führt
	 * zwangsläufig durch den Zustand mit einer Person.
	 */
	it('weist eine Hülle mit einer einzigen Person ab', async () => {
		const g = await leereGemeinschaft('Erfassung 5');
		await expect(
			erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
				stwegId: g,
				kind: 'natural',
				personen: [person('Anna Muster'), person('   ')],
				vertreterIndex: 0
			})
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'zu_wenige_mitberechtigte' });
		expect(await admin`SELECT 1 FROM party WHERE stweg_id = ${g}`).toHaveLength(0);
	});

	/*
	 * **Eine leere Zeile in der Mitte verschiebt nichts** — der Fund beim
	 * Umsetzen. Der Plan filterte allein die Namensliste und griff danach mit
	 * demselben Zähler auf `emails[i]`: Die zweite Person bekäme die Adresse der
	 * ersten, und der Vertreter wäre ein anderer als der angekreuzte.
	 */
	it('lässt Anschrift und Vertretung bei der richtigen Person, wenn eine Zeile leer bleibt', async () => {
		const g = await leereGemeinschaft('Erfassung 6');
		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [
				person('', 'niemand@example.ch'),
				person('Anna Muster', 'anna@example.ch'),
				person('Beat Muster', 'beat@example.ch')
			],
			vertreterIndex: 2
		});

		const mitglieder = await holeMitberechtigte(betreiber, huelle);
		expect(mitglieder.map((m) => [m.displayName, m.email])).toEqual([
			['Anna Muster', 'anna@example.ch'],
			['Beat Muster', 'beat@example.ch']
		]);
		expect(mitglieder.find((m) => m.istVertreter)?.displayName).toBe('Beat Muster');
	});

	it('gibt den Mitberechtigten keine Kopfstimme', async () => {
		// Der Kern der Bauform: Die Stimme hängt an der Einheit, und die hält die
		// Hülle. Ohne Einheit sind es null Kopfstimmen — ohne Sonderregel.
		const g = await leereGemeinschaft('Erfassung 7');
		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g,
			kind: 'unit',
			label: 'Whg 1',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, huelle, '2020-01-01');

		const ansicht = await stimmkraftAnsicht(betreiber, g, '2026-08-26');
		expect(ansicht.summeKopfstimmen).toBe(1);
		const mitgliedszeilen = ansicht.zeilen.filter((z) => z.einheiten.length === 0);
		expect(mitgliedszeilen).toHaveLength(2);
		expect(mitgliedszeilen.every((z) => z.kopfstimmen === 0)).toBe(true);
	});
});

/*
 * Schritt 4b: der Weg zum Wechsel der Vertretung. Ohne ihn nennte die Absage
 * aus `entferneMitberechtigten` («Bestimmen Sie zuerst eine andere Vertretung»)
 * einen Ausweg, den die Anwendung nicht anbietet.
 */
describe('Die Vertretung wechseln', () => {
	it('setzt Verweis und eingefrorenen Namen zusammen um', async () => {
		const g = await leereGemeinschaft('Wechsel 1');
		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});

		await setzeVertretung(handelnder(betreiber), huelle, mitglieder[1]);

		const [zeile] = await admin<
			{ representative_party_id: string; representative_name: string }[]
		>`
			SELECT representative_party_id, representative_name FROM party WHERE id = ${huelle}
		`;
		expect(zeile.representative_party_id).toBe(mitglieder[1]);
		// **Der Name wandert mit.** Bliebe er stehen, druckte die Zugangskarte
		// nach dem Wechsel den falschen Menschen.
		expect(zeile.representative_name).toBe('Beat Muster');
	});

	it('macht damit den Weg frei, den die Absage beim Entfernen nennt', async () => {
		const g = await leereGemeinschaft('Wechsel 2');
		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});

		await expect(
			entferneMitberechtigten(handelnder(betreiber), huelle, mitglieder[0])
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'vertritt_gemeinschaft' });

		await setzeVertretung(handelnder(betreiber), huelle, mitglieder[1]);
		await entferneMitberechtigten(handelnder(betreiber), huelle, mitglieder[0]);
		expect(await holeMitberechtigte(betreiber, huelle)).toHaveLength(1);
	});

	it('schreibt keinen Eintrag, wenn dieselbe Person nochmals gewählt wird', async () => {
		const g = await leereGemeinschaft('Wechsel 5');
		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});
		await setzeVertretung(handelnder(betreiber), huelle, mitglieder[0]);

		const eintraege = await admin`
			SELECT 1 FROM audit_entry
			 WHERE subject_id = ${huelle} AND event_type = 'party.representative.changed'
		`;
		expect(eintraege).toHaveLength(0);
	});

	it('lässt den Vertreternamen nicht am Verweis vorbei überschreiben', async () => {
		/*
		 * Aus der Sicherheitsprüfung vom 26.08.2026: Die Maske schickt den Namen
		 * bei einer Hülle mit Mitberechtigten nur noch verborgen mit — ein
		 * handgebauter Aufruf setzte aber jeden Text, und die Zugangskarte
		 * druckte danach jemand anderen, als die Anwendung zählt.
		 */
		const g = await leereGemeinschaft('Wechsel 6');
		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});

		await bearbeiteEigentuemer(handelnder(betreiber), huelle, {
			stwegId: g,
			kind: 'natural',
			displayName: 'Anna Muster und Beat Muster',
			representativeName: 'Zora Fremd',
			isCommunity: true
		});

		const [zeile] = await admin<{ representative_name: string }[]>`
			SELECT representative_name FROM party WHERE id = ${huelle}
		`;
		expect(zeile.representative_name).toBe('Anna Muster');
	});

	it('weist eine Person ab, die nicht mitberechtigt ist', async () => {
		const g = await leereGemeinschaft('Wechsel 3');
		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});
		const fremd = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			displayName: 'Cora Muster',
			isCommunity: false,
			representativeName: null
		});

		await expect(
			setzeVertretung(handelnder(betreiber), huelle, fremd.id)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'nicht_mitberechtigt' });
	});

	it('schreibt den Wechsel mit beiden Namen in den Verlauf', async () => {
		const g = await leereGemeinschaft('Wechsel 4');
		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});
		await setzeVertretung(handelnder(betreiber), huelle, mitglieder[1]);

		const [eintrag] = await admin<{ detail: { name: string; vorher: string } }[]>`
			SELECT detail FROM audit_entry
			 WHERE subject_id = ${huelle} AND event_type = 'party.representative.changed'
		`;
		expect(eintrag.detail.name).toBe('Beat Muster');
		expect(eintrag.detail.vorher).toBe('Anna Muster');
	});
});

/*
 * Aufgabe 4, Schritt 2: Wer aus der Hauptliste genommen wird — und wer nicht.
 *
 * **Der berichtigte Fall.** Der erste Entwurf des Plans schloss jede Zeile aus,
 * die in `party_member` vorkommt. Das hätte auch den Eigentümer ausgeblendet,
 * der selbst eine Einheit hält und zusätzlich an einer zweiten mitberechtigt
 * ist — samt seiner Kopfstimme, und die Summe im Fuss der Tabelle ginge nicht
 * mehr auf.
 */
describe('Wer unter der Hülle steht statt in der Liste', () => {
	it('nimmt die Zeilen heraus, die ausser der Mitberechtigung nichts halten', async () => {
		const g = await leereGemeinschaft('Anzeige 1');
		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});

		const versteckt = await holeNurMitberechtigte(betreiber, g);
		expect([...versteckt].sort()).toEqual([...mitglieder].sort());
		// Die Hülle selbst bleibt: Sie hält die Einheit und die eine Stimme.
		expect(versteckt).not.toContain(huelle);
	});

	it('lässt den Doppelfall in der Liste stehen — eigene Einheit plus Anteil am Paar', async () => {
		const g = await leereGemeinschaft('Anzeige 2');
		const { mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 1
		});
		const anna = mitglieder[0];
		const beat = mitglieder[1];

		// Anna hält daneben eine eigene Wohnung.
		const eigene = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g,
			kind: 'unit',
			label: 'Whg 2',
			quotas: { stamm: 400 },
			countsAsHead: true
		});
		await ordneEigentumZu(handelnder(betreiber), eigene.id, anna, '2020-01-01');

		const versteckt = await holeNurMitberechtigte(betreiber, g);
		// Beat hält nichts — er steht unter der Hülle. Anna hält eine Einheit und
		// bleibt deshalb eine eigene Zeile.
		expect(versteckt).toEqual([beat]);

		const ansicht = await stimmkraftAnsicht(betreiber, g, '2026-08-26');
		const annazeile = ansicht.zeilen.find((z) => z.partyId === anna);
		expect(annazeile?.kopfstimmen).toBe(1);
		expect(ansicht.summeKopfstimmen).toBe(1);
	});

	it('nimmt eine Zeile mit beendeter Zuordnung nicht heraus', async () => {
		/*
		 * Ohne Stichtag gezählt: Sonst wanderte dieselbe Zeile beim Verschieben
		 * des Stichtags aus der Liste und wieder hinein — und wer 2022 verkauft
		 * hat, verlöre seine Zeile samt Eigentümergeschichte.
		 */
		const g = await leereGemeinschaft('Anzeige 3');
		const { mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 1
		});
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g,
			kind: 'unit',
			label: 'Whg 3',
			quotas: { stamm: 300 },
			countsAsHead: true
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, mitglieder[0], '2020-01-01');
		await admin`
			UPDATE unit_ownership SET valid_to = '2022-01-01'
			 WHERE party_id = ${mitglieder[0]}
		`;

		expect(await holeNurMitberechtigte(betreiber, g)).toEqual([mitglieder[1]]);
	});
});

/*
 * Produktentscheid 26.08.2026: Eine Hülle mit Mitberechtigten lässt sich nicht
 * tilgen. Ohne die Absage kaskadieren die Mitgliedschaften weg, und zurück
 * bleiben Personenzeilen ohne Einheit — genau das Bild, an dem die
 * Laienprüfung gescheitert ist.
 */
describe('Eine Hülle mit Mitberechtigten tilgen', () => {
	it('wird abgewiesen, mit dem Weg im Satz', async () => {
		const g = await leereGemeinschaft('Tilgen 1');
		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});

		await expect(entferneEigentuemer(handelnder(betreiber), huelle)).rejects.toMatchObject({
			name: 'FachlicherFehler',
			kennung: 'huelle_hat_mitberechtigte'
		});

		// Nichts ist weggekaskadiert: Hülle und beide Personen stehen noch.
		expect(await holeMitberechtigte(betreiber, huelle)).toHaveLength(2);
	});

	it('geht, sobald die Mitberechtigten weg sind', async () => {
		const g = await leereGemeinschaft('Tilgen 2');
		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});

		/*
		 * **Nur mit den Wegen, die die Anwendung anbietet** — kein rohes SQL. Der
		 * erste Anlauf brauchte hier ein `UPDATE party SET
		 * representative_party_id = NULL`, und genau das war der Befund: Die
		 * Absage nannte einen Ausweg, den es nicht gab.
		 */
		await entferneMitberechtigten(handelnder(betreiber), huelle, mitglieder[1]);
		// Jetzt steht nur noch der Vertreter da — und der darf weg.
		await entferneMitberechtigten(handelnder(betreiber), huelle, mitglieder[0]);

		await entferneEigentuemer(handelnder(betreiber), huelle);
		expect(await admin`SELECT 1 FROM party WHERE id = ${huelle}`).toHaveLength(0);
	});

	it('weist den Vertreter ab, solange jemand anderes dasteht', async () => {
		const g = await leereGemeinschaft('Tilgen 3');
		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster'), person('Cora Muster')],
			vertreterIndex: 0
		});

		await expect(
			entferneMitberechtigten(handelnder(betreiber), huelle, mitglieder[0])
		).rejects.toMatchObject({ kennung: 'vertritt_gemeinschaft' });

		await setzeVertretung(handelnder(betreiber), huelle, mitglieder[2]);
		await entferneMitberechtigten(handelnder(betreiber), huelle, mitglieder[0]);
		expect(await holeMitberechtigte(betreiber, huelle)).toHaveLength(2);
	});

	it('löst den Vertreterverweis mit der letzten Person — sichtbar, nicht still', async () => {
		const g = await leereGemeinschaft('Tilgen 4');
		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});
		await entferneMitberechtigten(handelnder(betreiber), huelle, mitglieder[1]);
		await entferneMitberechtigten(handelnder(betreiber), huelle, mitglieder[0]);

		const [zeile] = await admin<
			{ representative_party_id: string | null; representative_name: string; is_community: boolean }[]
		>`
			SELECT representative_party_id, representative_name, is_community
			  FROM party WHERE id = ${huelle}
		`;
		expect(zeile.representative_party_id).toBeNull();
		// Der eingefrorene Name bleibt: `party_vertreter_bei_gemeinschaft`
		// (Migration 006) verlangt ihn, solange die Zeile gemeinschaftlich ist.
		expect(zeile.representative_name).toBe('Anna Muster');
		expect(zeile.is_community).toBe(true);
	});
});

/*
 * Produktentscheid 26.08.2026: Mitberechtigte bekommen eine Personenklammer.
 * Ohne sie wäre der Mitberechtigte die einzige Eigentümerzeile, die über die
 * Gemeinschaften hinweg unsichtbar bleibt — und `party_person_je_gemeinschaft`
 * könnte den Doppelfall nicht zu einer Zeile zusammenfassen.
 */
describe('Die Personenklammer der Mitberechtigten', () => {
	it('gibt jeder Mitgliedszeile eine Person, der Hülle keine', async () => {
		const g = await leereGemeinschaft('Klammer 1');
		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster', 'anna@example.ch'), person('Beat Muster')],
			vertreterIndex: 0
		});

		const zeilen = await admin<{ id: string; person_id: string | null }[]>`
			SELECT id, person_id FROM party WHERE stweg_id = ${g}
		`;
		const je = new Map(zeilen.map((z) => [z.id, z.person_id]));
		expect(je.get(mitglieder[0])).not.toBeNull();
		expect(je.get(mitglieder[1])).not.toBeNull();
		// `party_person_nur_bei_einzelnen` verbietet der Hülle die Klammer — und
		// das zu Recht: Hinter ihr stehen mehrere Menschen.
		expect(je.get(huelle)).toBeNull();

		// Die Anschrift wandert mit: Die Person ist der Ort, an dem sie steht.
		const [p] = await admin<{ email: string | null }[]>`
			SELECT pe.email FROM party pa JOIN person pe ON pe.id = pa.person_id
			 WHERE pa.id = ${mitglieder[0]}
		`;
		expect(p.email).toBe('anna@example.ch');
	});

	it('nennt die Hülle auf der Personenseite', async () => {
		const g = await leereGemeinschaft('Klammer 2');
		const { mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});
		const [{ person_id }] = await admin<{ person_id: string }[]>`
			SELECT person_id FROM party WHERE id = ${mitglieder[0]}
		`;

		const huellen = await holeHuellenDerPerson(betreiber, person_id);
		expect(huellen).toHaveLength(1);
		expect(huellen[0].huelle).toBe('Anna Muster und Beat Muster');
		expect(huellen[0].gemeinschaft).toBe('Klammer 2');
		expect(huellen[0].istVertreter).toBe(true);
	});

	it('rollt die Personen mit zurück, wenn die Zeile nicht zustande kommt', async () => {
		// Ein Teilerfolg wäre hier schlimmer als der Misserfolg: Zwei Personen
		// ohne Eigentümerzeile sähen aus wie eine halbfertige Erfassung.
		//
		// **Der Abbruchgrund ist seit dem 27.08.2026 ein anderer**: Ein fehlender
		// Vertreter ist keine Absage mehr (Migration 096). Gebrochen wird hier
		// über den doppelten Namen — die Regel, die den Sammelname eindeutig hält.
		const g = await leereGemeinschaft('Klammer 3');
		await expect(
			erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
				stwegId: g,
				kind: 'natural',
				personen: [person('Anna Muster'), person('Anna Muster')],
				vertreterIndex: 0
			})
		).rejects.toMatchObject({ name: 'FachlicherFehler' });

		expect(
			await admin`SELECT 1 FROM person WHERE display_name IN ('Anna Muster', 'Beat Muster')
			             AND operator_id = ${betreiber}
			             AND id NOT IN (SELECT person_id FROM party WHERE person_id IS NOT NULL)`
		).toHaveLength(0);
	});
});

/*
 * ────────────────────────────────────────────────────────────────────────────
 * Aufgabe 6: die Übernahme aus einer Datei legt eine Hülle an.
 */

const KOPF = 'voter_ref;display_name;person_names;ownership_type;legal_representatives';

describe('Eine Datei mit mehreren Personen in einer Zeile', () => {
	it('legt eine Hülle mit zwei Mitberechtigten an', async () => {
		const g = await leereGemeinschaft('Übernahme 1');
		const ergebnis = await fuehreUebernahmeAus(
			handelnder(betreiber),
			g,
			// Der Strichpunkt trennt hier die Personen, nicht die Spalten — deshalb
			// das Feld in Anführungszeichen. Genau so kommt eine von Hand
			// geschriebene Datei aus einer Tabellenkalkulation.
			[KOPF, 'E1;;"Anna Muster; Beat Muster";miteigentum;Anna Muster'].join('\n'),
			'2026-01-01'
		);

		// **Eine angelegte Zeile, nicht drei.** Gezählt werden die Zeilen der
		// Datei; die Mitberechtigten sind ihr Inhalt.
		expect(ergebnis).toMatchObject({ angelegt: 1, geaendert: 0, uebersprungen: 0 });

		const zeilen = await holeEigentuemer(betreiber, g, 'aktiv');
		const huelle = zeilen.find((p) => p.isCommunity)!;
		expect(huelle.displayName).toBe('Anna Muster und Beat Muster');
		expect(huelle.representativeName).toBe('Anna Muster');

		const mitglieder = await holeMitberechtigte(betreiber, huelle.id);
		expect(mitglieder.map((m) => m.displayName)).toEqual(['Anna Muster', 'Beat Muster']);
		expect(mitglieder.find((m) => m.istVertreter)?.displayName).toBe('Anna Muster');

		// Die beiden stehen unter der Hülle, nicht als eigene Zeilen daneben.
		expect(await holeNurMitberechtigte(betreiber, g)).toHaveLength(2);
	});

	it('findet dieselbe Zeile beim zweiten Lauf wieder', async () => {
		// Ohne Fremdkennung an der Hülle wäre jeder zweite Lauf eine Verdoppelung
		// — und aus zwei Mitberechtigten würden vier.
		const g = await leereGemeinschaft('Übernahme 2');
		const datei = [KOPF, 'E1;;Anna Muster|Beat Muster;miteigentum;Anna Muster'].join('\n');
		await fuehreUebernahmeAus(handelnder(betreiber), g, datei, '2026-01-01');

		const ergebnis = await fuehreUebernahmeAus(handelnder(betreiber), g, datei, '2026-01-01');
		expect(ergebnis).toMatchObject({ angelegt: 0, geaendert: 0 });
		expect(await holeEigentuemer(betreiber, g, 'aktiv')).toHaveLength(3);
	});

	it('gibt den Mitberechtigten keine Kopfstimme', async () => {
		const g = await leereGemeinschaft('Übernahme 3');
		await fuehreUebernahmeAus(
			handelnder(betreiber),
			g,
			[KOPF, 'E1;;Anna Muster|Beat Muster;miteigentum;Anna Muster'].join('\n'),
			'2026-01-01'
		);
		await fuehreUebernahmeAus(
			handelnder(betreiber),
			g,
			['holding_ref;label;owner_voter_ref;quota_units', 'H1;Whg 1;E1;1000'].join('\n'),
			'2026-01-01'
		);

		const ansicht = await stimmkraftAnsicht(betreiber, g, '2026-06-01');
		expect(ansicht.summeKopfstimmen).toBe(1);
		expect(ansicht.summeWertquote).toBe(1000);
	});

	it('überspringt zweimal denselben Namen und übernimmt die übrige Zeile', async () => {
		// Käme die Absage erst beim Schreiben, nähme sie der zweiten Zeile ihren
		// Lauf — die ganze Übernahme bräche ab.
		const g = await leereGemeinschaft('Übernahme 4');
		const ergebnis = await fuehreUebernahmeAus(
			handelnder(betreiber),
			g,
			[
				KOPF,
				'E1;;Anna Muster|Anna Muster;miteigentum;Anna Muster',
				'E2;Cora Muster;;alleineigentum;'
			].join('\n'),
			'2026-01-01'
		);
		expect(ergebnis).toMatchObject({ angelegt: 1, uebersprungen: 1 });
		expect((await holeEigentuemer(betreiber, g, 'aktiv')).map((p) => p.displayName)).toEqual([
			'Cora Muster'
		]);
	});

	it('überspringt einen Vertreter, der nicht zu den Genannten gehört', async () => {
		// Sonst entstünde eine Hülle, deren Vertreter auf niemanden zeigt — und am
		// Einlass wäre nicht mehr zu klären, wer die eine Stimme ausübt.
		const g = await leereGemeinschaft('Übernahme 5');
		const ergebnis = await fuehreUebernahmeAus(
			handelnder(betreiber),
			g,
			[KOPF, 'E1;;Anna Muster|Beat Muster;miteigentum;Cora Muster'].join('\n'),
			'2026-01-01'
		);
		expect(ergebnis).toMatchObject({ angelegt: 0, uebersprungen: 1 });
		expect(await holeEigentuemer(betreiber, g, 'aktiv')).toHaveLength(0);
	});

	it('lässt eine gemeinschaftliche Zeile ohne Personenliste den alten Weg gehen', async () => {
		// Der Bestand vor Migration 094 bleibt stehen (Produktentscheid
		// 26.08.2026): eine Zeile mit dem Haken und einem Vertreter als Text.
		const g = await leereGemeinschaft('Übernahme 6');
		await fuehreUebernahmeAus(
			handelnder(betreiber),
			g,
			[KOPF, 'E1;Erbengemeinschaft Muster;;gesamteigentum;Cora Muster'].join('\n'),
			'2026-01-01'
		);
		const [zeile] = await holeEigentuemer(betreiber, g, 'aktiv');
		expect(zeile.isCommunity).toBe(true);
		expect(zeile.representativeName).toBe('Cora Muster');
		expect(await holeMitberechtigte(betreiber, zeile.id)).toHaveLength(0);
	});
});

/*
 * **Der Vertretername am zweiten Schreiber** (27.08.2026, aus dem Code-Review
 * zu Aufgabe 6). Der Upsert der Übernahme setzt `representative_name` mit —
 * und die Datei rät ihn, weil immotool gar nicht führt, wer die Stimme ausübt.
 */
describe('Die gewählte Vertretung und eine spätere Übernahme', () => {
	it('lässt den gedruckten Namen am Verweis, statt ihn aus der Datei zu setzen', async () => {
		const g = await leereGemeinschaft('Übernahme 7');
		await fuehreUebernahmeAus(
			handelnder(betreiber),
			g,
			[KOPF, 'E1;;Anna Muster|Beat Muster;miteigentum;'].join('\n'),
			'2026-01-01'
		);
		const huelle = (await holeEigentuemer(betreiber, g, 'aktiv')).find((p) => p.isCommunity)!;
		const beat = (await holeMitberechtigte(betreiber, huelle.id)).find(
			(m) => m.displayName === 'Beat Muster'
		)!;
		await setzeVertretung(handelnder(betreiber), huelle.id, beat.partyId);

		// Dieselbe Datei, nur mit einem anderen Namen für die Zeile: Die Zeile
		// gilt als geändert und läuft damit in den Upsert.
		await fuehreUebernahmeAus(
			handelnder(betreiber),
			g,
			[KOPF, 'E1;Erbengemeinschaft Muster;Anna Muster|Beat Muster;miteigentum;'].join('\n'),
			'2026-01-01'
		);

		const danach = (await holeEigentuemer(betreiber, g, 'aktiv')).find(
			(p) => p.id === huelle.id
		)!;
		expect(danach.displayName).toBe('Erbengemeinschaft Muster');
		// **Beat, nicht Anna.** Die Datei fällt mangels Angabe auf die
		// erstgenannte Person zurück; die Zugangskarte druckt diesen Namen.
		expect(danach.representativeName).toBe('Beat Muster');
		expect(
			(await holeMitberechtigte(betreiber, huelle.id)).find((m) => m.istVertreter)?.displayName
		).toBe('Beat Muster');
	});
});

/*
 * ─── «Wen tragen Sie ein?» je Person (27.08.2026) ───────────────────────────
 *
 * Die Personenliste nahm bis hierher nur Namen entgegen und legte deshalb
 * **immer** neue Zeilen an. Stand A schon irgendwo, entstand ein zweites A:
 * formal zwei Menschen, von der Datenbank nicht abgefangen.
 */
describe('Eine bestehende Person in der Personenliste', () => {
	it('legt für eine Person aus einer anderen Gemeinschaft eine Zeile an, ohne sie zu verdoppeln', async () => {
		const daheim = await leereGemeinschaft('Bestehende 1a');
		const neu = await leereGemeinschaft('Bestehende 1b');

		// Anna steht bereits in einer anderen Gemeinschaft.
		const anna = await erstellePerson(handelnder(betreiber), {
			art: 'natural',
			name: 'Anna Muster',
			email: 'anna@example.ch',
			telefon: null,
			adresse: 'Probehalde 14'
		});
		await eigentuemerzeileAusPerson(handelnder(betreiber), anna.id, daheim);

		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: neu,
			kind: 'natural',
			personen: [
				{ name: '', email: null, adresse: null, personId: anna.id },
				person('Beat Muster', 'beat@example.ch')
			],
			vertreterIndex: 0
		});

		// Der Name kommt von der Person, nicht aus dem leeren Feld.
		const [zeile] = await admin<{ display_name: string }[]>`
			SELECT display_name FROM party WHERE id = ${huelle}
		`;
		expect(zeile.display_name).toBe('Anna Muster und Beat Muster');

		// **Genau eine Zeile je Gemeinschaft**, beide an derselben Person.
		const annazeilen = await admin<{ stweg_id: string }[]>`
			SELECT stweg_id FROM party WHERE person_id = ${anna.id} ORDER BY stweg_id
		`;
		expect(annazeilen).toHaveLength(2);
		expect(new Set(annazeilen.map((z) => z.stweg_id))).toEqual(new Set([daheim, neu]));

		const mitglieder = await holeMitberechtigte(betreiber, huelle);
		expect(mitglieder.map((m) => m.displayName)).toEqual(['Anna Muster', 'Beat Muster']);
		expect(mitglieder.find((m) => m.istVertreter)?.displayName).toBe('Anna Muster');
	});

	it('nimmt die vorhandene Zeile, wenn die Person in dieser Gemeinschaft schon steht', async () => {
		const g = await leereGemeinschaft('Bestehende 2');
		const anna = await erstellePerson(handelnder(betreiber), {
			art: 'natural',
			name: 'Anna Muster',
			email: null,
			telefon: null,
			adresse: null
		});
		const vorhanden = await eigentuemerzeileAusPerson(handelnder(betreiber), anna.id, g);

		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [
				{ name: '', email: null, adresse: null, personId: anna.id },
				person('Beat Muster')
			],
			vertreterIndex: 1
		});

		// Keine zweite Zeile für Anna: `party_person_je_gemeinschaft` liesse sie
		// gar nicht zu, und selbst ohne die Schranke wäre sie falsch.
		expect(mitglieder[0]).toBe(vorhanden.id);
		const annazeilen = await admin`
			SELECT id FROM party WHERE stweg_id = ${g} AND person_id = ${anna.id}
		`;
		expect(annazeilen).toHaveLength(1);
		expect(await holeMitberechtigte(betreiber, huelle)).toHaveLength(2);
	});

	it('weist eine archivierte Person ab und legt nichts an', async () => {
		const g = await leereGemeinschaft('Bestehende 3');
		const carla = await erstellePerson(handelnder(betreiber), {
			art: 'natural',
			name: 'Carla Weber',
			email: null,
			telefon: null,
			adresse: null
		});
		await archiviere(handelnder(betreiber), 'person', carla.id, 'weggezogen');

		await expect(
			erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
				stwegId: g,
				kind: 'natural',
				personen: [
					{ name: '', email: null, adresse: null, personId: carla.id },
					person('Beat Muster')
				],
				vertreterIndex: 1
			})
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'person_archiviert' });
		expect(await admin`SELECT 1 FROM party WHERE stweg_id = ${g}`).toHaveLength(0);
	});
});

/*
 * ─── Miteigentum eintragen (27.08.2026) ────────────────────────────────────
 *
 * Der Auftrag im Wortlaut (Auftraggeber): «wenn A eine Einheit hat und nach einem Jahr
 * B heiratet und Miteigentümerin wird, müsste ich dies ja ohne grossen Aufwand
 * nachführen können.»
 */
describe('Aus Alleineigentum wird gemeinschaftliches Eigentum', () => {
	/** A hält «Whg 3» seit 2020 allein. */
	async function alleineigentum(name: string) {
		const g = await leereGemeinschaft(name);
		const anna = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			displayName: 'Anna Muster',
			isCommunity: false,
			representativeName: null,
			email: 'anna@example.ch',
			address: 'Probehalde 14'
		});
		const whg = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g,
			kind: 'unit',
			label: 'Whg 3',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		await ordneEigentumZu(handelnder(betreiber), whg.id, anna.id, '2020-01-01');
		return { gemeinschaft: g, anna: anna.id, einheit: whg.id };
	}

	it('macht aus A und B eine Hülle, ohne A ein zweites Mal anzulegen', async () => {
		const s = await alleineigentum('Heirat 1');

		const { huelle, name, mitglieder } = await trageMiteigentumEin(handelnder(betreiber), {
			stwegId: s.gemeinschaft,
			bisherigeZeile: s.anna,
			einheiten: [s.einheit],
			weitere: [person('Beat Muster', 'beat@example.ch')],
			vertreterIndex: 0,
			ab: '2027-05-01'
		});

		expect(name).toBe('Anna Muster und Beat Muster');
		// **Dieselbe Zeile**, mit Anschrift und Zugang: kein zweites «Anna Muster».
		expect(mitglieder[0]).toBe(s.anna);
		const annazeilen = await admin<{ address: string | null }[]>`
			SELECT address FROM party
			 WHERE stweg_id = ${s.gemeinschaft} AND display_name = 'Anna Muster'
		`;
		expect(annazeilen).toHaveLength(1);
		expect(annazeilen[0].address).toBe('Probehalde 14');

		const eingetragen = await holeMitberechtigte(betreiber, huelle);
		expect(eingetragen.map((m) => m.displayName)).toEqual(['Anna Muster', 'Beat Muster']);
		expect(eingetragen.find((m) => m.istVertreter)?.displayName).toBe('Anna Muster');
	});

	/**
	 * **Die Zusicherung, an der alles hängt.**
	 *
	 * Das Eintragen ist eine Handänderung, keine Korrektur: In `unit_ownership`
	 * steht weiter «A allein, ab 2020», beendet auf den Stichtag. Eine
	 * Versammlung von 2024 muss danach weiterhin A allein mit seiner Stimme
	 * zeigen — sonst rechnete jede Auswertung einer vergangenen Versammlung
	 * rückwirkend falsch, ohne dass es jemand sähe.
	 */
	it('zeigt eine Versammlung von vor dem Datum weiterhin A allein', async () => {
		const s = await alleineigentum('Heirat 2');
		const { huelle } = await trageMiteigentumEin(handelnder(betreiber), {
			stwegId: s.gemeinschaft,
			bisherigeZeile: s.anna,
			einheiten: [s.einheit],
			weitere: [person('Beat Muster')],
			vertreterIndex: 0,
			ab: '2027-05-01'
		});

		// **Vorher**: A allein, eine Kopfstimme, die volle Wertquote.
		const damals = await stimmkraftAnsicht(betreiber, s.gemeinschaft, '2024-05-01');
		const aDamals = damals.zeilen.find((z) => z.partyId === s.anna)!;
		expect(aDamals.einheiten.map((e) => e.label)).toEqual(['Whg 3']);
		expect(aDamals.kopfstimmen).toBe(1);
		expect(aDamals.wertquote).toBe(1000);
		expect(damals.zeilen.find((z) => z.partyId === huelle)?.kopfstimmen).toBe(0);
		expect(damals.summeKopfstimmen).toBe(1);
		expect(damals.einheitenOhneEigentuemer).toHaveLength(0);

		// **Am Tag des Wechsels**: die Hülle. Der Tag gehört dem neuen Eigentümer.
		const wechsel = await stimmkraftAnsicht(betreiber, s.gemeinschaft, '2027-05-01');
		expect(wechsel.zeilen.find((z) => z.partyId === huelle)?.kopfstimmen).toBe(1);
		expect(wechsel.zeilen.find((z) => z.partyId === s.anna)?.kopfstimmen).toBe(0);
		expect(wechsel.summeKopfstimmen).toBe(1);

		// **Der Verlauf bleibt lückenlos**: die alte Zeile endet, sie verschwindet nicht.
		const geschichte = await admin<{ party_id: string; valid_from: Date; valid_to: Date | null }[]>`
			SELECT party_id, valid_from, valid_to FROM unit_ownership
			 WHERE unit_id = ${s.einheit} ORDER BY valid_from
		`;
		expect(geschichte).toHaveLength(2);
		expect(geschichte[0].party_id).toBe(s.anna);
		expect(geschichte[0].valid_to?.toISOString().slice(0, 10)).toBe('2027-05-01');
		expect(geschichte[1].party_id).toBe(huelle);
		expect(geschichte[1].valid_from.toISOString().slice(0, 10)).toBe('2027-05-01');
	});

	/**
	 * **Derselbe Tag löscht die Vorgeschichte — abgewiesen** (27.08.2026, aus dem
	 * Code-Review).
	 *
	 * `planeZuordnung` kappt nur bei **echt** früherem Beginn
	 * (`domain/historie.ts`: `b.validFrom < abStichtag`); bei Gleichheit
	 * verdrängt sie die bestehende Zuordnung vollständig. Ohne diese Absage wäre
	 * «A allein ab 2020» nach einem versehentlich gleichen Datum aus
	 * `unit_ownership` **verschwunden**, und eine Versammlung von 2024 zeigte
	 * rückwirkend die Hülle.
	 *
	 * Der Test daneben («zeigt eine Versammlung von vor dem Datum weiterhin A
	 * allein») fährt mit einem späteren Datum und trifft den Fall deshalb nicht.
	 */
	it('weist ein Datum ab, das nicht nach dem Beginn der Zuordnung liegt', async () => {
		const s = await alleineigentum('Heirat 11');

		for (const ab of ['2020-01-01', '2019-06-01']) {
			await expect(
				trageMiteigentumEin(handelnder(betreiber), {
					stwegId: s.gemeinschaft,
					bisherigeZeile: s.anna,
					einheiten: [s.einheit],
					weitere: [person('Beat Muster')],
					vertreterIndex: 0,
					ab
				})
			).rejects.toMatchObject({
				name: 'FachlicherFehler',
				// Der frühere Tag fällt schon an der Deckungsprüfung durch: Da hielt
				// A die Einheit noch gar nicht.
				kennung: ab === '2020-01-01' ? 'datum_nicht_spaeter' : 'einheit_nicht_gehalten'
			});
		}

		// **Nichts angerührt**: keine Hülle, und die Geschichte steht unverändert.
		expect(
			await admin`SELECT 1 FROM party WHERE stweg_id = ${s.gemeinschaft} AND is_community`
		).toHaveLength(0);
		const geschichte = await admin<{ party_id: string; valid_to: Date | null }[]>`
			SELECT party_id, valid_to FROM unit_ownership WHERE unit_id = ${s.einheit}
		`;
		expect(geschichte).toHaveLength(1);
		expect(geschichte[0].party_id).toBe(s.anna);
		expect(geschichte[0].valid_to).toBeNull();
	});

	it('nimmt eine bereits erfasste Person als zweite Beteiligte', async () => {
		const s = await alleineigentum('Heirat 3');
		const beat = await erstellePerson(handelnder(betreiber), {
			art: 'natural',
			name: 'Beat Muster',
			email: 'beat@example.ch',
			telefon: null,
			adresse: null
		});

		const { huelle } = await trageMiteigentumEin(handelnder(betreiber), {
			stwegId: s.gemeinschaft,
			bisherigeZeile: s.anna,
			einheiten: [s.einheit],
			weitere: [{ name: '', email: null, adresse: null, personId: beat.id }],
			vertreterIndex: 1,
			ab: '2027-05-01'
		});

		const mitglieder = await holeMitberechtigte(betreiber, huelle);
		expect(mitglieder.map((m) => m.displayName)).toEqual(['Anna Muster', 'Beat Muster']);
		expect(mitglieder.find((m) => m.istVertreter)?.displayName).toBe('Beat Muster');
		expect(await holeHuellenDerPerson(betreiber, beat.id)).toHaveLength(1);
	});

	it('weist eine Einheit ab, die diese Zeile am Stichtag gar nicht hält', async () => {
		const s = await alleineigentum('Heirat 4');
		const fremd = await erstelleEinheit(handelnder(betreiber), {
			stwegId: s.gemeinschaft,
			kind: 'unit',
			label: 'Whg 4',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});

		await expect(
			trageMiteigentumEin(handelnder(betreiber), {
				stwegId: s.gemeinschaft,
				bisherigeZeile: s.anna,
				einheiten: [fremd.id],
				weitere: [person('Beat Muster')],
				vertreterIndex: 0,
				ab: '2027-05-01'
			})
		).rejects.toMatchObject({
			name: 'FachlicherFehler',
			kennung: 'einheit_nicht_gehalten',
			// Die Absage nennt die Einheit beim Namen: Angekreuzt sein können
			// mehrere, und «diese Einheit» sagte dann nicht, welche.
			message: expect.stringContaining('«Whg 4»')
		});

		// Kein Rest: weder Hülle noch Mitgliedschaft noch verschobene Einheit.
		expect(
			await admin`SELECT 1 FROM party WHERE stweg_id = ${s.gemeinschaft} AND is_community`
		).toHaveLength(0);
		expect(await admin`SELECT 1 FROM party_member WHERE stweg_id = ${s.gemeinschaft}`).toHaveLength(
			0
		);
	});

	/*
	 * **Dieselbe Zeile zweimal** (27.08.2026, aus dem Code-Review). A steht als
	 * `bisherigeZeile` fest; wählt jemand daneben A's **Person**, zeigen beide
	 * Wege auf dieselbe `party`. `party_member_einmalig` hielte das ab, aber als
	 * roher Schlüsselbruch. `pruefeMitberechtigte` fängt es nicht: Sie vergleicht
	 * Namen, und `party.display_name` darf vom `person.display_name` abweichen.
	 */
	it('weist dieselbe Zeile ab, wenn sie über die Person nochmals gewählt wird', async () => {
		const s = await alleineigentum('Heirat 8');
		const anna = await erstellePerson(handelnder(betreiber), {
			art: 'natural',
			// Bewusst anders geschrieben als die Eigentümerzeile «Anna Muster»: Über
			// den Namen liesse sich der Doppelbezug nicht erkennen.
			name: 'A. Muster',
			email: null,
			telefon: null,
			adresse: null
		});
		await verknuepfePartei(handelnder(betreiber), s.anna, anna.id);

		await expect(
			trageMiteigentumEin(handelnder(betreiber), {
				stwegId: s.gemeinschaft,
				bisherigeZeile: s.anna,
				einheiten: [s.einheit],
				weitere: [{ name: '', email: null, adresse: null, personId: anna.id }],
				vertreterIndex: 0,
				ab: '2027-05-01'
			})
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'zeile_doppelt' });

		expect(
			await admin`SELECT 1 FROM party WHERE stweg_id = ${s.gemeinschaft} AND is_community`
		).toHaveLength(0);
	});

	it('nimmt Telefon und Anschrift der neuen Person mit', async () => {
		// Die Personenliste erfasste bis zum 27.08.2026 kein Telefon; dieselbe
		// Person bekam je nach Eigentumsform verschieden viel erfasst.
		const s = await alleineigentum('Heirat 9');
		const { huelle } = await trageMiteigentumEin(handelnder(betreiber), {
			stwegId: s.gemeinschaft,
			bisherigeZeile: s.anna,
			einheiten: [s.einheit],
			weitere: [
				{
					name: 'Beat Muster',
					email: 'beat@example.ch',
					telefon: '031 000 00 00',
					adresse: 'Probehalde 14'
				}
			],
			vertreterIndex: 0,
			ab: '2027-05-01'
		});

		const beat = (await holeMitberechtigte(betreiber, huelle)).find(
			(m) => m.displayName === 'Beat Muster'
		)!;
		expect(beat.phone).toBe('031 000 00 00');
		expect(beat.address).toBe('Probehalde 14');
		// Auch an der Person, denn dort führt sie der Weg über die Gemeinschaften.
		const [klammer] = await admin<{ phone: string | null }[]>`
			SELECT pe.phone FROM party p JOIN person pe ON pe.id = p.person_id
			 WHERE p.id = ${beat.partyId}
		`;
		expect(klammer.phone).toBe('031 000 00 00');
	});

	it('weist eine juristische Hülle ab, die ihre Vertretung zurücknehmen will', async () => {
		// `party_vertretung_bei_juristisch` (Migration 025) bleibt: Migration 096
		// hat nur die Schranke für gemeinschaftliches Eigentum fallen lassen.
		const g = await leereGemeinschaft('Heirat 10');
		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'legal',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});
		await expect(
			setzeVertretung(handelnder(betreiber), huelle, null)
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'vertretung_pflicht' });

		const [zeile] = await admin<{ representative_name: string | null }[]>`
			SELECT representative_name FROM party WHERE id = ${huelle}
		`;
		expect(zeile.representative_name).toBe('Anna Muster');
	});

	it('weist eine Zeile ab, die schon gemeinschaftliches Eigentum ist', async () => {
		const g = await leereGemeinschaft('Heirat 5');
		const { huelle } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g,
			kind: 'natural',
			personen: [person('Anna Muster'), person('Beat Muster')],
			vertreterIndex: 0
		});
		const whg = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g,
			kind: 'unit',
			label: 'Whg 5',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		await ordneEigentumZu(handelnder(betreiber), whg.id, huelle, '2020-01-01');

		await expect(
			trageMiteigentumEin(handelnder(betreiber), {
				stwegId: g,
				bisherigeZeile: huelle,
				einheiten: [whg.id],
				weitere: [person('Carla Weber')],
				vertreterIndex: 0,
				ab: '2027-05-01'
			})
		).rejects.toMatchObject({ name: 'FachlicherFehler', kennung: 'mitglied_ist_huelle' });
	});

	/*
	 * **Ohne bezeichnete Vertretung** (Produktentscheid 27.08.2026). Wer beim
	 * Eintragen nicht weiss, wer die Stimme abgibt, lässt es offen; die Maske
	 * schickt dann `-1`. Am Abend darf die anwesende Person zählen
	 * (Wermelinger, Rz. 19 ad Art. 712o).
	 */
	it('trägt das Miteigentum auch ohne bezeichnete Vertretung ein', async () => {
		const s = await alleineigentum('Heirat 6');
		const { huelle } = await trageMiteigentumEin(handelnder(betreiber), {
			stwegId: s.gemeinschaft,
			bisherigeZeile: s.anna,
			einheiten: [s.einheit],
			weitere: [person('Beat Muster')],
			vertreterIndex: -1,
			ab: '2027-05-01'
		});

		const [zeile] = await admin<
			{ representative_name: string | null; representative_party_id: string | null }[]
		>`
			SELECT representative_name, representative_party_id FROM party WHERE id = ${huelle}
		`;
		expect(zeile.representative_name).toBeNull();
		expect(zeile.representative_party_id).toBeNull();

		// Die Einheit ist trotzdem gewandert, die Stimme bleibt eine.
		const danach = await stimmkraftAnsicht(betreiber, s.gemeinschaft, '2027-06-01');
		expect(danach.zeilen.find((z) => z.partyId === huelle)?.kopfstimmen).toBe(1);
		expect(danach.zeilen.find((z) => z.partyId === s.anna)?.kopfstimmen).toBe(0);
		expect(danach.summeKopfstimmen).toBe(1);
	});

	it('nimmt eine bezeichnete Vertretung wieder zurück', async () => {
		// Ohne diesen Weg wäre die Wahl eine Einbahnstrasse: Ein Auswahlknopf
		// lässt sich nicht abwählen.
		const s = await alleineigentum('Heirat 7');
		const { huelle } = await trageMiteigentumEin(handelnder(betreiber), {
			stwegId: s.gemeinschaft,
			bisherigeZeile: s.anna,
			einheiten: [s.einheit],
			weitere: [person('Beat Muster')],
			vertreterIndex: 0,
			ab: '2027-05-01'
		});
		expect((await holeMitberechtigte(betreiber, huelle)).find((m) => m.istVertreter)).toBeTruthy();

		const zurueck = await setzeVertretung(handelnder(betreiber), huelle, null);
		expect(zurueck.vertreter).toBeNull();

		const [zeile] = await admin<
			{ representative_name: string | null; representative_party_id: string | null }[]
		>`
			SELECT representative_name, representative_party_id FROM party WHERE id = ${huelle}
		`;
		expect(zeile.representative_name).toBeNull();
		expect(zeile.representative_party_id).toBeNull();
		expect((await holeMitberechtigte(betreiber, huelle)).some((m) => m.istVertreter)).toBe(false);

		// Der Rückzug steht im Verlauf: Wer die Stimme abgab, ist eine Frage, die
		// im Streit gestellt wird.
		const [eintrag] = await admin<{ detail: { vorher: string | null } }[]>`
			SELECT detail FROM audit_entry
			 WHERE subject_id = ${huelle}::text AND event_type = 'party.representative.changed'
			 ORDER BY id DESC LIMIT 1
		`;
		expect(eintrag.detail.vorher).toBe('Anna Muster');
	});
});
