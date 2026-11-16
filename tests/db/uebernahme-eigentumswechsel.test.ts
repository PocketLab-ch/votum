/**
 * Der Eigentümerwechsel über die Datei (01.09.2026).
 *
 * **Zwei gemessene Fehler, dieselbe Wurzel.** Die Vorschau las das Eigentum
 * nicht, und der Schreibweg rechnete mit eigenem SQL statt mit
 * `planeZuordnung`:
 *
 * - Nannte die Datei nur einen anderen Eigentümer, galt die Zeile als
 *   «unverändert», die Ausführung übersprang sie, und die Handänderung geschah
 *   **gar nicht**. Die Vorschau meldete «1 unverändert» — eine Auskunft, die den
 *   Benutzer in dem Glauben lässt, es sei nichts zu tun.
 * - Wo der Zweig griff, kappte er **jede** Zeile mit offenem oder späterem Ende
 *   auf den Stichtag. Begann eine davon **am** Stichtag, ergab das
 *   `valid_to = valid_from` und verletzte die Schranke der Datenbank: Die ganze
 *   Übernahme brach ab und rollte zurück.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit, holeEinheiten } from '$lib/server/einheiten';
import {
	erstelleEigentuemer,
	holeEigentuemer,
	holeEigentumsverlauf,
	ordneEigentumZu
} from '$lib/server/eigentuemer';
import { fuehreUebernahmeAus, vorschau, vorschauAusTabelle } from '$lib/server/uebernahme';
import { erzeugeVorschau, kennungenAusVorschau } from '$lib/domain/uebernahme';
import { zerlege } from '$lib/domain/csv';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/**
 * Eine echte Authentik-Kennung.
 *
 * `istAuthentikKennung()` verlangt die UUID-Form aus dem `sub`-Anspruch. Eine
 * Merkzeichenfolge wie `auth-abc` scheitert schon daran, und jede Probe, die
 * eine spätere Stufe treffen will, käme dort nie an.
 */
const KENNUNG_ANNA = '3f2b8c14-5d6e-4a7b-9c80-1e2f3a4b5c6d';

/** Dieselbe Zeile wie im Bestand, nur mit anderem Eigentümer. */
const NUR_EIGENTUEMER_ANDERS = [
	'holding_ref;holding_type;label;owner_voter_ref;quota_units',
	'H1;unit;Whg 1;E-NEU;1000'
].join('\n');

beforeAll(async () => {
	betreiber = await pruefbetreiber('Uebernahme-Eigentumswechsel');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

/**
 * Eine Gemeinschaft mit einer Einheit und zwei Eigentümerzeilen, alle mit
 * Fremdkennung — so, wie sie nach einer ersten Übernahme dastünde.
 */
async function bestand(name: string) {
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
	const alt = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Alt Eigentuemer',
		representativeName: null,
		isCommunity: false
	});
	const neu = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Neu Eigentuemer',
		representativeName: null,
		isCommunity: false
	});
	// Eine dritte Zeile fuer den Fall, dass ein Wechsel neben einer bereits
	// erfassten kuenftigen Handaenderung stattfindet.
	const dritt = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Dritt Eigentuemer',
		representativeName: null,
		isCommunity: false
	});
	// Die Fremdkennungen nachtragen: Über sie findet die Übernahme wieder.
	await imKontext(betreiber, async (tx) => {
		await tx`UPDATE unit  SET import_ref = 'H1'     WHERE id = ${e.id}`;
		await tx`UPDATE party SET import_ref = 'E-ALT'  WHERE id = ${alt.id}`;
		await tx`UPDATE party SET import_ref = 'E-NEU'  WHERE id = ${neu.id}`;
		await tx`UPDATE party SET import_ref = 'E-DRIT' WHERE id = ${dritt.id}`;
	});
	return { g, e, alt, neu, dritt };
}

async function verlauf(stwegId: string) {
	return (await holeEigentumsverlauf(betreiber, stwegId)).map((z) => [
		z.eigentuemer,
		z.von,
		z.bis
	]);
}

describe('Eine Datei, die nur den Eigentümer wechselt', () => {
	it('gilt als Änderung und nicht als unverändert', async () => {
		const { g, e, alt } = await bestand('Wechsel sichtbar');
		await ordneEigentumZu(handelnder(betreiber), e.id, alt.id, '2020-01-01');

		const v = await vorschau(betreiber, g.id, NUR_EIGENTUEMER_ANDERS, '2026-06-01');
		expect(v.zusammenfassung).toMatchObject({ geaendert: 1, unveraendert: 0 });
		// Und der Wechsel steht benannt da, mit beiden Kennungen.
		expect(v.einheiten[0].aenderungen?.eigentuemer).toEqual({
			vorher: 'E-ALT',
			nachher: 'E-NEU'
		});
	});

	it('führt den Wechsel wirklich aus und lässt die Vorgeschichte stehen', async () => {
		const { g, e, alt } = await bestand('Wechsel ausgefuehrt');
		await ordneEigentumZu(handelnder(betreiber), e.id, alt.id, '2020-01-01');

		await fuehreUebernahmeAus(handelnder(betreiber), g.id, NUR_EIGENTUEMER_ANDERS, '2026-06-01');

		expect(await verlauf(g.id)).toEqual([
			// Der alte Eigentümer bleibt stehen und wird nur beendet — eine
			// Versammlung von vorher zeigt weiterhin ihn.
			['Alt Eigentuemer', '2020-01-01', '2026-06-01'],
			['Neu Eigentuemer', '2026-06-01', null]
		]);
	});

	/*
	 * **Der Abbruch.** Beginnt die laufende Zuordnung am Stichtag selbst, ergab
	 * das alte `UPDATE … SET valid_to = <stichtag>` einen leeren Zeitraum und
	 * verletzte `valid_to > valid_from`. Die ganze Übernahme rollte zurück.
	 */
	it('bricht nicht ab, wenn die laufende Zuordnung am Stichtag beginnt', async () => {
		const { g, e, alt } = await bestand('Wechsel am Stichtag');
		await ordneEigentumZu(handelnder(betreiber), e.id, alt.id, '2026-06-01');

		await fuehreUebernahmeAus(handelnder(betreiber), g.id, NUR_EIGENTUEMER_ANDERS, '2026-06-01');

		// Die alte Zeile wird entfernt statt rückwärts gekappt: Sie hätte sonst
		// einen Zeitraum von null Tagen.
		expect(await verlauf(g.id)).toEqual([['Neu Eigentuemer', '2026-06-01', null]]);
	});

	it('lässt eine Zuordnung in Ruhe, die dieselbe Partei schon hält', async () => {
		const { g, e, neu } = await bestand('Kein Scheinwechsel');
		await ordneEigentumZu(handelnder(betreiber), e.id, neu.id, '2020-01-01');

		const v = await vorschau(betreiber, g.id, NUR_EIGENTUEMER_ANDERS, '2026-06-01');
		expect(v.zusammenfassung).toMatchObject({ geaendert: 0, unveraendert: 1 });

		await fuehreUebernahmeAus(handelnder(betreiber), g.id, NUR_EIGENTUEMER_ANDERS, '2026-06-01');
		// Keine zweite Zeile, kein neuer Beginn: Der Bestand bleibt, wie er war.
		expect(await verlauf(g.id)).toEqual([['Neu Eigentuemer', '2020-01-01', null]]);
	});

	/*
	 * **Der Rückschritt, den der Code-Review fand** (01.09.2026). Meine erste
	 * Fassung fragte den Plan «nichts zu beenden, nichts zu entfernen» — was nie
	 * eintreten kann, weil eine laufende Zeile sich immer mit `[stichtag, …)`
	 * überschneidet. Der Wächter war tot, und eine Zeile, die aus einem anderen
	 * Grund als «geändert» galt, bekam eine erfundene Handänderung auf sich
	 * selbst.
	 */
	it('erfindet keine Handänderung, wenn sich nur die Bezeichnung ändert', async () => {
		const { g, e, neu } = await bestand('Nur Bezeichnung');
		await ordneEigentumZu(handelnder(betreiber), e.id, neu.id, '2020-01-01');

		// Dieselbe Zuordnung, aber die Datei nennt eine andere Bezeichnung.
		const nurLabel = [
			'holding_ref;holding_type;label;owner_voter_ref;quota_units',
			'D-H1;unit;Anders beschriftet;E-NEU;1000'
		]
			.join('\n')
			.replace('D-H1', 'H1');

		await fuehreUebernahmeAus(handelnder(betreiber), g.id, nurLabel, '2026-06-01');

		// Eine einzige Zeile, unverändert seit 2020 — kein Wechsel auf sich selbst.
		expect(await verlauf(g.id)).toEqual([['Neu Eigentuemer', '2020-01-01', null]]);
	});

	/*
	 * **Eine erfasste künftige Handänderung bleibt stehen** (01.09.2026, aus dem
	 * Code-Review). Die neue Zuordnung endet, wo die nächste beginnt; ohne diese
	 * Grenze reichte sie bis ins Unendliche und verdrängte die künftige
	 * stillschweigend — der Dateiweg hat keine Rückfrage, in der das stünde.
	 */
	it('verdrängt eine bereits erfasste künftige Handänderung nicht', async () => {
		const { g, e, alt, neu } = await bestand('Kuenftige Handaenderung');
		await ordneEigentumZu(handelnder(betreiber), e.id, alt.id, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiber), e.id, neu.id, '2027-01-01');

		// Die Datei ordnet ab Mitte 2026 einem Dritten zu — die Zeile ab 2027 bleibt.
		const anDritt = [
			'holding_ref;holding_type;label;owner_voter_ref;quota_units',
			'H1;unit;Whg 1;E-DRIT;1000'
		].join('\n');
		await fuehreUebernahmeAus(handelnder(betreiber), g.id, anDritt, '2026-06-01');

		expect(await verlauf(g.id)).toEqual([
			['Alt Eigentuemer', '2020-01-01', '2026-06-01'],
			// Die neue Zeile endet, wo die künftige beginnt — sie überschreibt sie nicht.
			['Dritt Eigentuemer', '2026-06-01', '2027-01-01'],
			['Neu Eigentuemer', '2027-01-01', null]
		]);
	});

	/*
	 * **Ein Wechsel gehört in den Verlauf** (01.09.2026, aus dem Code-Review).
	 * Der Handweg schreibt ihn seit je; der Dateiweg tat es nicht, und wer später
	 * fragte, wann die Wohnung den Eigentümer wechselte, fand nichts (AD-5).
	 */
	it('hält den Wechsel im Verlauf fest', async () => {
		const { g, e, alt } = await bestand('Wechsel im Verlauf');
		await ordneEigentumZu(handelnder(betreiber), e.id, alt.id, '2020-01-01');

		await fuehreUebernahmeAus(handelnder(betreiber), g.id, NUR_EIGENTUEMER_ANDERS, '2026-06-01');

		const eintraege = await imKontext(betreiber, async (tx) => {
			return tx<{ detail: { bisherigePartei: string; per: string; ausDatei?: boolean } }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'unit' AND subject_id = ${e.id}
				   AND event_type = 'ownership.ended'
			`;
		});
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail.per).toBe('2026-06-01');
		expect(eintraege[0].detail.ausDatei).toBe(true);
	});

	/*
	 * **Und beim Entfernen auch, was in der Zeile stand** (01.09.2026, aus dem
	 * Code-Review). Der Eintrag oben betrifft eine gekappte Zuordnung — die Zeile
	 * bleibt, nur ihr Ende wandert. Beginnt sie dagegen am Stichtag, wird sie
	 * gelöscht. Hielte der Vermerk dann nur «verdrängt» fest, wären Zeitraum und
	 * Notiz nirgends mehr, und hier trifft das eine ganze Datei auf einmal.
	 */
	it('nimmt Zeitraum und Notiz einer gelöschten Zuordnung mit', async () => {
		const { g, e, alt } = await bestand('Spuren aus der Datei');
		await ordneEigentumZu(
			handelnder(betreiber),
			e.id,
			alt.id,
			'2026-06-01',
			'Handaenderung laut Grundbuchauszug'
		);

		await fuehreUebernahmeAus(handelnder(betreiber), g.id, NUR_EIGENTUEMER_ANDERS, '2026-06-01');

		const eintraege = await imKontext(betreiber, async (tx) => {
			return tx<
				{
					detail: {
						verdraengtDurchKorrektur?: boolean;
						entfernterBeginn?: string;
						entfernteNotiz?: string | null;
					};
				}[]
			>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'unit' AND subject_id = ${e.id}
				   AND event_type = 'ownership.ended'
				   AND detail->>'verdraengtDurchKorrektur' = 'true'
			`;
		});
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail.entfernterBeginn).toBe('2026-06-01');
		expect(eintraege[0].detail.entfernteNotiz).toBe('Handaenderung laut Grundbuchauszug');
	});

	/*
	 * **Ein Eigentümer, den es hier nicht gibt** (01.09.2026, aus dem
	 * Code-Review). Die Vorschau meldete den Wechsel, die Ausführung tat nichts,
	 * und niemand erfuhr warum — bei jedem Lauf erneut.
	 */
	it('meldet eine Kennung, zu der kein Eigentümer erfasst ist', async () => {
		const { g, e, alt } = await bestand('Unbekannte Kennung');
		await ordneEigentumZu(handelnder(betreiber), e.id, alt.id, '2020-01-01');

		const unbekannt = [
			'holding_ref;holding_type;label;owner_voter_ref;quota_units',
			'H1;unit;Whg 1;E-GIBTS-NICHT;1000'
		].join('\n');

		const v = await vorschau(betreiber, g.id, unbekannt, '2026-06-01');
		expect(v.hinweise.join(' ')).toContain('E-GIBTS-NICHT');
		expect(v.hinweise.join(' ')).toMatch(/keinen Eigent(ü|ue)mer/);
	});

	/*
	 * **Die Erstübernahme darf nicht vor sich selbst warnen** (01.09.2026, aus
	 * dem Code-Review). Wer eine Gemeinschaft neu übernimmt, wählt beide Dateien
	 * zusammen. Die Seite rechnet beide Vorschauen gegen denselben Stand — und
	 * der kennt noch keinen Eigentümer. Der Hinweis erschien deshalb im
	 * Normalfall für jede Zeile und riet zu dem, was ohnehin gleich geschieht.
	 */
	it('meldet keine unbekannte Kennung, die in derselben Auswahl mitkommt', async () => {
		const { g, e, alt } = await bestand('Auswahl mit beiden Dateien');
		await ordneEigentumZu(handelnder(betreiber), e.id, alt.id, '2020-01-01');

		const unbekannt = [
			'holding_ref;holding_type;label;owner_voter_ref;quota_units',
			'H1;unit;Whg 1;E-KOMMT-NOCH;1000'
		].join('\n');

		// Ohne die Mitteilung: der Hinweis steht (das ist der Fall von oben).
		const ohne = await vorschauAusTabelle(betreiber, g.id, zerlege(unbekannt), '2026-06-01');
		expect(ohne.hinweise.join(' ')).toContain('E-KOMMT-NOCH');

		// Mit ihr: Die Kennung wird gleich angelegt, also ist sie keine Lücke.
		const mit = await vorschauAusTabelle(betreiber, g.id, zerlege(unbekannt), '2026-06-01', [
			'E-KOMMT-NOCH'
		]);
		expect(mit.hinweise.join(' ')).not.toContain('E-KOMMT-NOCH');
	});

	/*
	 * **Gelesen wird dieselbe Spalte wie beim Anlegen.** Liefe die Sammlung der
	 * Kennungen auseinander von dem, was `pruefeEigentuemerZeile` liest, wäre der
	 * Hinweis wieder falsch — nur andersherum.
	 */
	it('liest die Kennungen aus einer fertigen Eigentümervorschau', async () => {
		const { g } = await bestand('Kennungen aus der Vorschau');
		const text = [
			'voter_ref;person_names;party_kind',
			'E-EINS;Anna Muster;natural',
			'E-ZWEI;Beat Muster;natural'
		].join('\n');
		const v = await vorschau(betreiber, g.id, text, '2026-06-01');
		expect(kennungenAusVorschau(v)).toEqual(['E-EINS', 'E-ZWEI']);

		// Eine Einheitenvorschau liefert nichts, statt Unsinn zu liefern.
		const einheiten = await vorschau(betreiber, g.id, NUR_EIGENTUEMER_ANDERS, '2026-06-01');
		expect(kennungenAusVorschau(einheiten)).toEqual([]);
	});

	/*
	 * **Eine Zeile, die verworfen wird, kommt nicht** (01.09.2026, zweite Runde
	 * des Code-Reviews). Sonst schweigt der Hinweis über eine Kennung, zu der nie
	 * eine Partei entsteht — aus der zu lauten Warnung wäre eine fehlende
	 * geworden.
	 */
	it('sammelt keine Kennung aus einer fehlerhaften Eigentümerzeile', async () => {
		const { g } = await bestand('Fehlerhafte Zeile');
		const text = [
			'voter_ref;person_names;party_kind',
			'E-GUT;Anna Muster;natural',
			// Ohne Namen: Die Zeile wird verworfen, die Partei entsteht nie.
			'E-OHNE-NAMEN;;natural'
		].join('\n');
		const v = await vorschau(betreiber, g.id, text, '2026-06-01');
		expect(kennungenAusVorschau(v)).toEqual(['E-GUT']);
	});

	/*
	 * **Die Stufe, die der zweite Anlauf übersah** (02.09.2026). Eine
	 * Authentik-Kennung, die hier schon zu jemand anderem gehört, lehnt erst der
	 * Abgleich mit dem Bestand ab — nach `pruefeEigentuemerZeile`. Wer die Regel
	 * nachbaut statt das Ergebnis zu lesen, verpasst sie und unterdrückt den
	 * Hinweis über eine Zuordnung, die nie ankommt.
	 *
	 * **Dieser Test war grün und mass die Stufe nicht** (02.09.2026, beim
	 * Nachmessen). Er schickte `auth-abc`, und das ist keine UUID: Schon die
	 * Formprüfung in `pruefeEigentuemerZeile` wies die Zeile ab, mit dem Grund
	 * «ist keine Authentik-Kennung». Die erste Übernahme legte damit gar keine
	 * Kennung ab, der Bestand blieb leer, und der Abgleich, um den es hier geht,
	 * lief nie. Ein `toBeTruthy()` auf den Befund nimmt jeden Grund an — auch
	 * den, der beweist, dass die Probe daneben zielt. Geprüft wird deshalb der
	 * **Wortlaut**, und dazwischen steht die Messung, dass die Kennung wirklich
	 * im Bestand angekommen ist.
	 */
	it('sammelt keine Kennung, deren Authentik-Kennung hier vergeben ist', async () => {
		const { g } = await bestand('Doppelte Authentik-Kennung');
		const erste = [
			'voter_ref;person_names;party_kind;person_authentik',
			`E-ALT;Anna Muster;natural;${KENNUNG_ANNA}`
		].join('\n');
		await fuehreUebernahmeAus(handelnder(betreiber), g.id, erste, '2026-01-01');

		// Ohne diesen Schritt misst der Rest nichts: Liegt die Kennung nicht im
		// Bestand, ist die zweite Zeile schlicht unauffällig.
		const parteien = await holeEigentuemer(betreiber, g.id, 'alle');
		expect(parteien.find((p) => p.displayName === 'Anna Muster')?.authentikSubject).toBe(
			KENNUNG_ANNA
		);

		// Dieselbe Authentik-Kennung, andere voter_ref: Die Zeile wird abgelehnt.
		const zweite = [
			'voter_ref;person_names;party_kind;person_authentik',
			`E-NEU;Beat Muster;natural;${KENNUNG_ANNA}`
		].join('\n');
		const v = await vorschau(betreiber, g.id, zweite, '2026-06-01');
		expect(v.eigentuemer[0].befund?.grund).toMatch(/gehört hier bereits zu «E-ALT»/);
		expect(kennungenAusVorschau(v)).toEqual([]);
	});

	/*
	 * **Die Gegenprobe zur Formprüfung.** Sie steht daneben, damit die beiden
	 * Absagen unterscheidbar bleiben: Wäre oben wieder eine Nicht-UUID im Spiel,
	 * käme dieser Wortlaut heraus und nicht jener.
	 */
	it('nennt bei einer Kennung, die keine UUID ist, die Form als Grund', async () => {
		const { g } = await bestand('Kennung ohne UUID-Form');
		const text = [
			'voter_ref;person_names;party_kind;person_authentik',
			'E-ALT;Anna Muster;natural;auth-abc'
		].join('\n');
		const v = await vorschau(betreiber, g.id, text, '2026-06-01');
		expect(v.eigentuemer[0].befund?.grund).toMatch(/ist keine Authentik-Kennung/);
		expect(kennungenAusVorschau(v)).toEqual([]);
	});

	/*
	 * **Dieselbe Kennung an derselben Partei ist kein Wechsel.** Sonst stünde die
	 * Absage auch dann da, wenn die Datei nur wiederholt, was schon gilt — und
	 * jede zweite Übernahme derselben Datei wäre rot.
	 */
	it('lässt dieselbe Kennung an derselben Partei durch', async () => {
		const { g } = await bestand('Kennung bleibt, wo sie ist');
		const text = [
			'voter_ref;person_names;party_kind;person_authentik',
			`E-ALT;Anna Muster;natural;${KENNUNG_ANNA}`
		].join('\n');
		await fuehreUebernahmeAus(handelnder(betreiber), g.id, text, '2026-01-01');

		// Dieselbe Vorbedingung wie oben, aus demselben Grund: Ohne Kennung im
		// Bestand ist die Zeile schlicht unauffällig, und «kein Befund» hiesse
		// dann nichts.
		const parteien = await holeEigentuemer(betreiber, g.id, 'alle');
		expect(parteien.find((p) => p.displayName === 'Anna Muster')?.authentikSubject).toBe(
			KENNUNG_ANNA
		);

		const v = await vorschau(betreiber, g.id, text, '2026-06-01');
		expect(v.eigentuemer[0].befund).toBeFalsy();
	});

	it('legt die erste Zuordnung an, wo noch keine steht', async () => {
		const { g } = await bestand('Erste Zuordnung');

		await fuehreUebernahmeAus(handelnder(betreiber), g.id, NUR_EIGENTUEMER_ANDERS, '2026-06-01');

		expect(await verlauf(g.id)).toEqual([['Neu Eigentuemer', '2026-06-01', null]]);
	});

	/*
	 * **Der Stichtag entscheidet, was ein Wechsel ist.** Auf einen Tag vor der
	 * Handänderung gelesen, hält noch der alte Eigentümer — dieselbe Datei ist
	 * dann eine Änderung gegen einen anderen Bestand.
	 */
	it('liest den Eigentumsstand auf den Stichtag, nicht auf heute', async () => {
		const { g, e, alt, neu } = await bestand('Stichtagsbezug');
		await ordneEigentumZu(handelnder(betreiber), e.id, alt.id, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiber), e.id, neu.id, '2026-03-01');

		// Am 1. Februar hielt noch der alte: Die Datei nennt einen anderen.
		const frueher = await vorschau(betreiber, g.id, NUR_EIGENTUEMER_ANDERS, '2026-02-01');
		expect(frueher.zusammenfassung).toMatchObject({ geaendert: 1 });

		// Am 1. Juni hält bereits der neue: nichts zu tun.
		const spaeter = await vorschau(betreiber, g.id, NUR_EIGENTUEMER_ANDERS, '2026-06-01');
		expect(spaeter.zusammenfassung).toMatchObject({ unveraendert: 1 });
	});
});
