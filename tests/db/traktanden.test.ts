/**
 * Stories 3.2 und 3.3 — Traktanden in der Datenbank.
 *
 * Geprüft wird, was der Kern nicht garantieren kann: die Schranken der Tabelle,
 * die Eindeutigkeit der Positionen, die Sperre nach der Freigabe und dass beim
 * Verschieben keine Zeile auf einer belegten Stelle landet.
 */
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import {
	erstelleEigentuemer,
	erstelleGemeinschaftlicheZeile,
	ordneEigentumZu,
	stimmkraftAnsicht
} from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { archiviere } from '$lib/server/archivieren';
import {
	bearbeiteTraktandum,
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	loescheTraktandum,
	nimmRueckzugZurueck,
	setzeNummer,
	verschiebeTraktandum,
	ziehAntragZurueck
} from '$lib/server/traktanden';
import { imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { TraktandumEingabe } from '$lib/domain/traktanden';
import { waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { wendeReglementAn } from '$lib/domain/reglement';
import { holeRegelwerk } from '$lib/rules';

let betreiberA: string;
let betreiberB: string;
let stwegA: string;
let versammlungA: string;
let fremdeVersammlung: string;
let parteiA: string;
let parteiB: string;

async function neueGemeinschaft(operatorId: string, name: string) {
	return erstelleGemeinschaft(handelnder(operatorId), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
}

async function neueEinheit(
	operatorId: string,
	stwegId: string,
	label: string,
	quote = 1000
) {
	return erstelleEinheit(handelnder(operatorId), {
		stwegId,
		kind: 'unit',
		label,
		quotas: { stamm: quote },
		countsAsHead: true
	});
}

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

function eingabe(meetingId: string, u: Partial<TraktandumEingabe> = {}): TraktandumEingabe {
	return {
		meetingId,
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung',
		...u
	};
}

/**
 * Ein Knoten, an dem der Saal Betroffene annimmt (Zustimmung nötig). Seit
 * Entscheid 0050, Antwort 3, lässt auch das Formular sie nur dort zu; die
 * Proben mit Betroffenen geben ihn deshalb mit, wie die Route das Feld
 * «erfordernis» (`verlangeBetroffeneNachDemSpeichern`).
 */
const MIT_BETROFFENEN = 'k-nutzungsrecht-zuteilung';

const ERFORDERNIS: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-baulich',
	knotenId: 'k-baulich-nuetzlich',
	typ: 'qualifiziertes_mehr',
	titel: 'Qualifiziertes Mehr',
	rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
	kopfbasis: 'alle_eigentuemer',
	quotenbasis: 'alle_quoten',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	geschaeftsart: 'baulich_nuetzlich',
	zustimmungBetroffenerNoetig: false,
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

/**
 * Eine Versammlung ohne Traktanden.
 *
 * Seit Story 3.8 entstehen die Pflichttraktanden von selbst. Für die Prüfung
 * der Nummerierung und des Verschiebens braucht es ein leeres Blatt — die
 * Vorlagen werden deshalb hier ausdrücklich weggeräumt. Dass das möglich ist,
 * ist selbst eine Zusage: Ein festes Traktandum darf entfernt werden.
 */
async function neueVersammlung(operatorId: string, stwegId: string, datum: string) {
	const v = await erstelleVersammlung(handelnder(operatorId), {
		stwegId,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	await imKontext(operatorId, (tx) => tx`
		DELETE FROM agenda_item WHERE meeting_id = ${v.id} AND from_template = true
	`);
	return v.id;
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Traktanden A');
	betreiberB = await pruefbetreiber('Traktanden B');

	const a = await erstelleGemeinschaft(handelnder(betreiberA), {
		name: 'Traktandenweg 1',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stwegA = a.id;
	versammlungA = await neueVersammlung(betreiberA, stwegA, '2026-09-15');

	const b = await erstelleGemeinschaft(handelnder(betreiberB), {
		name: 'Fremdweg 7',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	fremdeVersammlung = await neueVersammlung(betreiberB, b.id, '2026-09-20');

	const p1 = await erstelleEigentuemer(handelnder(betreiberA), {
		stwegId: stwegA,
		kind: 'natural',
		displayName: 'Anna Betroffen',
		isCommunity: false,
		representativeName: null
	});
	const p2 = await erstelleEigentuemer(handelnder(betreiberA), {
		stwegId: stwegA,
		kind: 'natural',
		displayName: 'Beat Nachbar',
		isCommunity: false,
		representativeName: null
	});
	parteiA = p1.id;
	parteiB = p2.id;
	const e1 = await neueEinheit(betreiberA, stwegA, 'Whg A', 500);
	const e2 = await neueEinheit(betreiberA, stwegA, 'Whg B', 500);
	await ordneEigentumZu(handelnder(betreiberA), e1.id, parteiA, '2020-01-01');
	await ordneEigentumZu(handelnder(betreiberA), e2.id, parteiB, '2020-01-01');
});

afterAll(verbindungenSchliessen);

describe('Erfassen', () => {
	it('legt ein Traktandum an und nummeriert es', async () => {
		const v = await neueVersammlung(betreiberA, stwegA, '2026-10-01');
		await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Begrüssung' }));
		await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Jahresrechnung' }));

		const liste = await holeTraktanden(betreiberA, v);
		expect(liste.map((t) => `${t.nummer} ${t.knoten.titel}`)).toEqual([
			'1 Begrüssung',
			'2 Jahresrechnung'
		]);
	});

	it('weist eine Kenntnisnahme mit Antragswortlaut in der Tabelle ab', async () => {
		// Der Kern verwirft ihn; die Schranke fängt ab, wer am Kern vorbeischreibt.
		const t = await erstelleTraktandum(handelnder(betreiberA), eingabe(versammlungA));
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`UPDATE agenda_item SET item_kind = 'kenntnisnahme' WHERE id = ${t.id}`
			)
		).rejects.toThrow(/agenda_wortlaut/);
	});

	it('weist ein Erfordernis an einer Kenntnisnahme ab', async () => {
		const t = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(versammlungA, { art: 'kenntnisnahme', antragswortlaut: undefined })
		);
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					UPDATE agenda_item SET requirement_type = 'einfaches_mehr', requirement_version = '2026-07-30'
					WHERE id = ${t.id}
				`
			)
		).rejects.toThrow(/agenda_kenntnisnahme_ohne_erfordernis/);
	});

	it('weist ein Erfordernis ohne Fassungskennung ab', async () => {
		// Man wüsste sonst, dass ein Zweidrittelmehr galt, aber nicht nach welcher
		// Fassung des Regelwerks (AD-4).
		const t = await erstelleTraktandum(handelnder(betreiberA), eingabe(versammlungA));
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`UPDATE agenda_item SET requirement_type = 'einfaches_mehr' WHERE id = ${t.id}`
			)
		).rejects.toThrow(/agenda_erfordernis_fassung/);
	});

	it('lässt zwei Traktanden nicht auf derselben Stelle stehen', async () => {
		const v = await neueVersammlung(betreiberA, stwegA, '2026-10-02');
		const t1 = await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Eins vorne' }));
		await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Zwei hinten' }));
		await expect(
			imKontext(betreiberA, (tx) => tx`UPDATE agenda_item SET position = 2 WHERE id = ${t1.id}`)
		).rejects.toThrow(/agenda_position_je_elternteil/);
	});
});

describe('Betroffene', () => {
	it('speichert die zugewiesenen Betroffenen', async () => {
		const t = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(versammlungA, { titel: 'Nutzungsänderung', betroffeneParteiIds: [parteiA, parteiB] }),
			MIT_BETROFFENEN
		);
		const liste = await holeTraktanden(betreiberA, versammlungA);
		const eintrag = liste.find((x) => x.knoten.id === t.id);
		expect(eintrag?.knoten.betroffeneParteiIds.sort()).toEqual([parteiA, parteiB].sort());
	});

	it('weist einen Eigentümer einer fremden Gemeinschaft ab', async () => {
		// Sonst hinge der Beschluss an der Zustimmung eines Unbeteiligten.
		const fremd = await erstelleEigentuemer(handelnder(betreiberB), {
			stwegId: (await imKontext(betreiberB, (tx) => tx<{ stweg_id: string }[]>`
				SELECT stweg_id FROM meeting WHERE id = ${fremdeVersammlung}
			`))[0].stweg_id,
			kind: 'natural',
			displayName: 'Fremde Partei',
			isCommunity: false,
			representativeName: null
		});
		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(versammlungA, { betroffeneParteiIds: [fremd.id] })
			)
		).rejects.toThrow(/dieser Gemeinschaft/);
	});

	it('ersetzt die Menge beim Bearbeiten, statt sie zu ergänzen', async () => {
		const t = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(versammlungA, { titel: 'Wechsel', betroffeneParteiIds: [parteiA, parteiB] }),
			MIT_BETROFFENEN
		);
		await bearbeiteTraktandum(
			handelnder(betreiberA),
			versammlungA,
			t.id,
			eingabe(versammlungA, { titel: 'Wechsel', betroffeneParteiIds: [parteiB] }),
			MIT_BETROFFENEN
		);
		const liste = await holeTraktanden(betreiberA, versammlungA);
		expect(liste.find((x) => x.knoten.id === t.id)?.knoten.betroffeneParteiIds).toEqual([parteiB]);
	});

	/*
	 * Entscheid 0050, Antwort 3 («Formular wie Saal»): Bis zum 14.11.2026
	 * schrieb das Formular Betroffene an jedes Traktandum, der Saal
	 * (`trageBetroffeneEin`) nur, wo das Mehr sie kennt (Codeprüfung Block C,
	 * M3, N2). Geprüft wird gegen das Mehr nach dem Speichern.
	 */
	it('nimmt Betroffene nur an, wo auch der Saal sie annimmt', async () => {
		const absage = { name: 'FachlicherFehler', kennung: 'ohne_betroffene', feld: 'betroffene' };
		// Beim Anlegen ohne Mehr und mit einem Mehr ohne Betroffene: Absage, kein Traktandum.
		const vorher = (await holeTraktanden(betreiberA, versammlungA)).length;
		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(versammlungA, { titel: 'Ohne Mehr', betroffeneParteiIds: [parteiA] })
			)
		).rejects.toMatchObject(absage);
		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(versammlungA, { titel: 'Wichtige Verwaltung', betroffeneParteiIds: [parteiA] }),
				'k-verwaltung-wichtig'
			)
		).rejects.toMatchObject(absage);
		expect((await holeTraktanden(betreiberA, versammlungA)).length).toBe(vorher);

		// Beim Bearbeiten gegen das gespeicherte Mehr; die Zeile bleibt ohne Betroffene.
		const t = await erstelleTraktandum(handelnder(betreiberA), eingabe(versammlungA, { titel: 'Hauswart' }));
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiberA),
			versammlungA,
			t.id,
			waehleErfordernis(holeRegelwerk(), 'k-verwaltung-wichtig').ergebnis
		);
		await expect(
			bearbeiteTraktandum(
				handelnder(betreiberA),
				versammlungA,
				t.id,
				eingabe(versammlungA, { titel: 'Hauswart', betroffeneParteiIds: [parteiA] })
			)
		).rejects.toMatchObject(absage);
		expect(
			(await holeTraktanden(betreiberA, versammlungA)).find((x) => x.knoten.id === t.id)?.knoten
				.betroffeneParteiIds
		).toEqual([]);

		// Gegenprobe: dasselbe Formular mit einem Mehr, das Betroffene kennt, im selben Speichern gewählt.
		await bearbeiteTraktandum(
			handelnder(betreiberA),
			versammlungA,
			t.id,
			eingabe(versammlungA, { titel: 'Hauswart', betroffeneParteiIds: [parteiA] }),
			MIT_BETROFFENEN
		);
		expect(
			(await holeTraktanden(betreiberA, versammlungA)).find((x) => x.knoten.id === t.id)?.knoten
				.betroffeneParteiIds
		).toEqual([parteiA]);
	});
});

describe('Eigentum am Versammlungstag', () => {
	it('akzeptiert dieselbe Eigentumsstufe als einzelnen, gemeinsamen und betroffenen Eigentümer', async () => {
		const einzeln = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(versammlungA, {
				titel: 'Einzelantrag',
				antragstellerart: 'eigentuemer',
				antragstellerId: parteiA
			})
		);
		const gemeinsam = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(versammlungA, {
				titel: 'Gemeinsamer Antrag',
				antragstellerart: 'mehrere_eigentuemer',
				antragstellerIds: [parteiA, parteiB]
			})
		);
		const betroffen = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(versammlungA, { titel: 'Betroffener Eigentümer', betroffeneParteiIds: [parteiA] }),
			MIT_BETROFFENEN
		);

		const liste = await holeTraktanden(betreiberA, versammlungA);
		expect(liste.find((t) => t.knoten.id === einzeln.id)?.knoten.antragstellerId).toBe(parteiA);
		expect(
			liste.find((t) => t.knoten.id === gemeinsam.id)?.knoten.antragstellerIds?.sort()
		).toEqual([parteiA, parteiB].sort());
		expect(liste.find((t) => t.knoten.id === betroffen.id)?.knoten.betroffeneParteiIds).toEqual([
			parteiA
		]);
	});

	it('weist eine einheitenlose Partei in allen drei Feldern verständlich ab', async () => {
		const ohne = await erstelleEigentuemer(handelnder(betreiberA), {
			stwegId: stwegA,
			kind: 'natural',
			displayName: 'Ohne Einheit',
			isCommunity: false,
			representativeName: null
		});

		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(versammlungA, {
					titel: 'Manipulierter Einzelantrag',
					antragstellerart: 'eigentuemer',
					antragstellerId: ohne.id
				})
			)
		).rejects.toThrow(/2026-09-15.*mindestens eine Einheit/);
		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(versammlungA, {
					titel: 'Manipulierter gemeinsamer Antrag',
					antragstellerart: 'mehrere_eigentuemer',
					antragstellerIds: [parteiA, ohne.id]
				})
			)
		).rejects.toThrow(/2026-09-15.*mindestens eine Einheit/);
		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(versammlungA, {
					titel: 'Manipulierte Betroffene',
					betroffeneParteiIds: [ohne.id]
				})
			)
		).rejects.toThrow(/2026-09-15.*mindestens eine Einheit/);
	});

	it('behandelt eine manipulierte Nicht-Kennung als fachliche Absage', async () => {
		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(versammlungA, {
					titel: 'Manipulierte Kennung',
					antragstellerart: 'eigentuemer',
					antragstellerId: 'keine-uuid'
				})
			)
		).rejects.toMatchObject({
			name: 'FachlicherFehler',
			kennung: 'fremde_partei',
			feld: 'antragstellerId'
		});
	});

	it('weist beendetes und erst später beginnendes Eigentum ab', async () => {
		const g = await neueGemeinschaft(betreiberA, 'Zeitgrenzen Traktanden');
		const meetingId = await neueVersammlung(betreiberA, g.id, '2026-09-15');
		const beendet = await erstelleEigentuemer(handelnder(betreiberA), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Früher Eigentümer',
			isCommunity: false,
			representativeName: null
		});
		const aktuell = await erstelleEigentuemer(handelnder(betreiberA), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Aktueller Eigentümer',
			isCommunity: false,
			representativeName: null
		});
		const spaeter = await erstelleEigentuemer(handelnder(betreiberA), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Später Eigentümer',
			isCommunity: false,
			representativeName: null
		});
		const e1 = await neueEinheit(betreiberA, g.id, 'Whg Zeit 1', 500);
		const e2 = await neueEinheit(betreiberA, g.id, 'Whg Zeit 2', 500);
		await ordneEigentumZu(handelnder(betreiberA), e1.id, beendet.id, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiberA), e1.id, aktuell.id, '2026-09-15');
		await ordneEigentumZu(handelnder(betreiberA), e2.id, spaeter.id, '2026-09-16');

		for (const parteiId of [beendet.id, spaeter.id]) {
			await expect(
				erstelleTraktandum(
					handelnder(betreiberA),
					eingabe(meetingId, {
						titel: `Zeitgrenze ${parteiId}`,
						antragstellerart: 'eigentuemer',
						antragstellerId: parteiId
					})
				)
			).rejects.toThrow(/2026-09-15.*mindestens eine Einheit/);
		}
	});

	it('gruppiert mehrere Einheiten einmal und lässt Eigentumshülle statt ihrer Mitglieder zu', async () => {
		const g = await neueGemeinschaft(betreiberA, 'Hülle Traktanden');
		const meetingId = await neueVersammlung(betreiberA, g.id, '2026-09-15');
		const gruppe = await erstelleGemeinschaftlicheZeile(handelnder(betreiberA), {
			stwegId: g.id,
			kind: 'natural',
			personen: [
				{ name: 'Anna Hülle', email: null, adresse: null },
				{ name: 'Beat Hülle', email: null, adresse: null }
			],
			vertreterIndex: 0
		});
		const e1 = await neueEinheit(betreiberA, g.id, 'Whg Hülle', 700);
		const e2 = await neueEinheit(betreiberA, g.id, 'PP Hülle', 300);
		await ordneEigentumZu(handelnder(betreiberA), e1.id, gruppe.huelle, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiberA), e2.id, gruppe.huelle, '2020-01-01');

		const ansicht = await stimmkraftAnsicht(betreiberA, g.id, '2026-09-15');
		const waehlbar = ansicht.zeilen.filter((z) => z.einheiten.length > 0);
		expect(waehlbar).toHaveLength(1);
		expect(waehlbar[0]).toMatchObject({
			partyId: gruppe.huelle,
			einheiten: [{ label: 'PP Hülle' }, { label: 'Whg Hülle' }]
		});
		expect(ansicht.zeilen.filter((z) => gruppe.mitglieder.includes(z.partyId))).toHaveLength(2);

		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(meetingId, {
					titel: 'Antrag der Hülle',
					antragstellerart: 'eigentuemer',
					antragstellerId: gruppe.huelle
				})
			)
		).resolves.toMatchObject({ antragstellerId: gruppe.huelle });
		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(meetingId, {
					titel: 'Antrag eines Mitglieds',
					antragstellerart: 'eigentuemer',
					antragstellerId: gruppe.mitglieder[0]
				})
			)
		).rejects.toThrow(/mindestens eine Einheit/);
	});

	it('lässt eine Gemeinschaft als Eigentümerin zu', async () => {
		const mitglied = await neueGemeinschaft(betreiberA, 'Mitgliedsgemeinschaft Traktanden');
		const g = await neueGemeinschaft(betreiberA, 'Dachgemeinschaft Traktanden');
		const meetingId = await neueVersammlung(betreiberA, g.id, '2026-09-15');
		const partei = await erstelleEigentuemer(handelnder(betreiberA), {
			stwegId: g.id,
			kind: 'gemeinschaft',
			displayName: mitglied.name,
			isCommunity: false,
			representativeName: 'Anna Vertretung',
			memberStwegId: mitglied.id
		});
		const einheit = await neueEinheit(betreiberA, g.id, 'Anteil Mitglied');
		await ordneEigentumZu(handelnder(betreiberA), einheit.id, partei.id, '2020-01-01');

		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(meetingId, {
					titel: 'Antrag der Mitgliedsgemeinschaft',
					antragstellerart: 'eigentuemer',
					antragstellerId: partei.id
				})
			)
		).resolves.toMatchObject({ antragstellerId: partei.id });
	});

	it('bewahrt historische Referenzen nur in ihrem bisherigen Feld', async () => {
		const g = await neueGemeinschaft(betreiberA, 'Historische Traktanden');
		const meetingId = await neueVersammlung(betreiberA, g.id, '2026-09-15');
		const alt = await erstelleEigentuemer(handelnder(betreiberA), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Historische Partei',
			isCommunity: false,
			representativeName: null
		});
		const neu = await erstelleEigentuemer(handelnder(betreiberA), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Neue Partei',
			isCommunity: false,
			representativeName: null
		});
		const einheit = await neueEinheit(betreiberA, g.id, 'Whg Historisch');
		await ordneEigentumZu(handelnder(betreiberA), einheit.id, alt.id, '2020-01-01');
		const t = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(meetingId, { titel: 'Historischer Bezug', betroffeneParteiIds: [alt.id] }),
			MIT_BETROFFENEN
		);
		const einzel = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(meetingId, {
				titel: 'Historischer Einzelantrag',
				antragstellerart: 'eigentuemer',
				antragstellerId: alt.id
			})
		);
		// Die Stammdaten werden rückwirkend berichtigt. Der gespeicherte Verweis
		// bleibt trotzdem Teil des Traktandums und darf beim Umbenennen nicht fallen.
		await ordneEigentumZu(handelnder(betreiberA), einheit.id, neu.id, '2026-08-30');
		await archiviere(handelnder(betreiberA), 'eigentuemer', alt.id, 'Historischer Verweis');

		await bearbeiteTraktandum(
			handelnder(betreiberA),
			meetingId,
			t.id,
			eingabe(meetingId, {
				titel: 'Historischer Bezug berichtigt',
				betroffeneParteiIds: [alt.id]
			}),
			MIT_BETROFFENEN
		);
		expect(
			(await holeTraktanden(betreiberA, meetingId)).find((x) => x.knoten.id === t.id)?.knoten
				.betroffeneParteiIds
		).toEqual([alt.id]);
		await bearbeiteTraktandum(
			handelnder(betreiberA),
			meetingId,
			einzel.id,
			eingabe(meetingId, {
				titel: 'Historischer Einzelantrag berichtigt',
				antragstellerart: 'eigentuemer',
				antragstellerId: alt.id
			})
		);
		expect(
			(await holeTraktanden(betreiberA, meetingId)).find((x) => x.knoten.id === einzel.id)?.knoten
				.antragstellerId
		).toBe(alt.id);

		await expect(
			bearbeiteTraktandum(
				handelnder(betreiberA),
				meetingId,
				t.id,
				eingabe(meetingId, {
					titel: 'Historische Partei im falschen Feld',
					antragstellerart: 'eigentuemer',
					antragstellerId: alt.id,
					betroffeneParteiIds: [alt.id]
				})
			)
		).rejects.toThrow(/mindestens eine Einheit/);
	});

	it('bewahrt historische gemeinsame Antragsteller vollständig', async () => {
		const g = await neueGemeinschaft(betreiberA, 'Historische gemeinsame Antragsteller');
		const meetingId = await neueVersammlung(betreiberA, g.id, '2026-09-15');
		const parteien: string[] = [];
		const nachfolger: { einheit: string; partei: string }[] = [];
		for (const [index, name] of ['Anna Alt', 'Beat Alt'].entries()) {
			const alt = await erstelleEigentuemer(handelnder(betreiberA), {
				stwegId: g.id,
				kind: 'natural',
				displayName: name,
				isCommunity: false,
				representativeName: null
			});
			const neu = await erstelleEigentuemer(handelnder(betreiberA), {
				stwegId: g.id,
				kind: 'natural',
				displayName: `${name} Nachfolge`,
				isCommunity: false,
				representativeName: null
			});
			const einheit = await neueEinheit(betreiberA, g.id, `Whg Gemeinsam ${index + 1}`, 500);
			await ordneEigentumZu(handelnder(betreiberA), einheit.id, alt.id, '2020-01-01');
			parteien.push(alt.id);
			nachfolger.push({ einheit: einheit.id, partei: neu.id });
		}
		const t = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(meetingId, {
				titel: 'Gemeinsamer historischer Antrag',
				antragstellerart: 'mehrere_eigentuemer',
				antragstellerIds: parteien
			})
		);
		for (const n of nachfolger) {
			await ordneEigentumZu(handelnder(betreiberA), n.einheit, n.partei, '2026-09-15');
		}

		await bearbeiteTraktandum(
			handelnder(betreiberA),
			meetingId,
			t.id,
			eingabe(meetingId, {
				titel: 'Gemeinsamer historischer Antrag berichtigt',
				antragstellerart: 'mehrere_eigentuemer',
				antragstellerIds: parteien
			})
		);
		expect(
			(await holeTraktanden(betreiberA, meetingId))
				.find((x) => x.knoten.id === t.id)
				?.knoten.antragstellerIds?.sort()
		).toEqual(parteien.sort());
	});
});

describe('Mehrheitserfordernis am Traktandum', () => {
	it('schreibt Fassung, Knoten und Pfad', async () => {
		const t = await erstelleTraktandum(handelnder(betreiberA), eingabe(versammlungA));
		await haltErfordernisAmTraktandumFest(handelnder(betreiberA), versammlungA, t.id, ERFORDERNIS);

		const liste = await holeTraktanden(betreiberA, versammlungA);
		const e = liste.find((x) => x.knoten.id === t.id)?.knoten.erfordernis;
		expect(e?.fassung).toBe('2026-07-30');
		expect(e?.knotenId).toBe('k-baulich-nuetzlich');
		expect(e?.kopfSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
		expect(e?.pfad[0].antwortText).toBe('Antwort');
	});

	it('gibt das Erfordernis auch dann vollständig zurück, wenn das Regelwerk nicht geladen ist', async () => {
		// Die Erklärbarkeit hängt nicht daran, dass die Fassung noch vorliegt: Ein
		// aus dem Vorjahr übernommenes Traktandum trägt eine ältere (AD-4).
		const t = await erstelleTraktandum(handelnder(betreiberA), eingabe(versammlungA));
		await haltErfordernisAmTraktandumFest(handelnder(betreiberA), versammlungA, t.id, {
			...ERFORDERNIS,
			fassung: '2019-01-01'
		});
		const liste = await holeTraktanden(betreiberA, versammlungA);
		const e = liste.find((x) => x.knoten.id === t.id)?.knoten.erfordernis;
		expect(e?.fassung).toBe('2019-01-01');
		expect(e?.rechtsgrundlage).toBe('ZGB Art. 647d Abs. 1');
	});
});


/**
 * Das unmittelbar gewählte Erfordernis (02.08.2026).
 *
 * Der Kern prüft, dass aus einem Knoten ein gültiges Erfordernis wird. Hier
 * geht es um das, was der Kern nicht sehen kann: dass die Quelle den Weg
 * bis in die Datenbank überlebt und dass das Reglement der Gemeinschaft auch
 * auf diesem Weg vorgeht.
 */
describe('Erfordernis unmittelbar gewählt', () => {
	it('trägt «gewählt» als Quelle und einen leeren Pfad in die Tabelle', async () => {
		const t = await erstelleTraktandum(handelnder(betreiberA), eingabe(versammlungA));
		const gewaehlt = waehleErfordernis(holeRegelwerk(), 'k-wertquoten-aendern').ergebnis;
		await haltErfordernisAmTraktandumFest(handelnder(betreiberA), versammlungA, t.id, gewaehlt);

		const [zeile] = await imKontext(betreiberA, (tx) => tx<
			{ requirement_source: string; requirement_node: string; requirement_path: unknown }[]
		>`
			SELECT requirement_source, requirement_node, requirement_path
			  FROM agenda_item WHERE id = ${t.id}
		`);
		expect(zeile.requirement_source).toBe('gewaehlt');
		expect(zeile.requirement_node).toBe('k-wertquoten-aendern');
		expect(zeile.requirement_path).toEqual([]);
	});

	/**
	 * Sonst liesse sich die Regel der Gemeinschaft dadurch umgehen, dass man das
	 * Erfordernis im Traktandumformular statt im Entscheidbaum setzt.
	 */
	it('lässt das Reglement auch dem gewählten Fall vorgehen', async () => {
		const regelwerk = holeRegelwerk();
		const gewaehlt = waehleErfordernis(regelwerk, 'k-hausordnung').ergebnis;
		expect(gewaehlt.geschaeftsart).toBeDefined();

		const angewandt = wendeReglementAn(gewaehlt, [
			{
				geschaeftsart: gewaehlt.geschaeftsart as never,
				fundstelle: 'Art. 12 Abs. 2',
				kopfbasis: 'alle_eigentuemer',
				quotenbasis: 'alle_quoten',
				kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
				quotenSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' }
			} as never
		], null, LESARTEN_VORGABE).erfordernis;

		const t = await erstelleTraktandum(handelnder(betreiberA), eingabe(versammlungA));
		await haltErfordernisAmTraktandumFest(handelnder(betreiberA), versammlungA, t.id, angewandt);

		const liste = await holeTraktanden(betreiberA, versammlungA);
		const e = liste.find((x) => x.knoten.id === t.id)?.knoten.erfordernis;
		expect(e?.quelle).toBe('reglement');
		expect(e?.rechtsgrundlage).toContain('Art. 12 Abs. 2');
		expect(e?.knotenId).toBe('k-hausordnung');
	});
});

describe('Verschieben', () => {
	it('ordnet um, ohne an der eindeutigen Stelle zu scheitern', async () => {
		// Ohne den Umweg über negative Positionen kollidierte die erste Zeile mit
		// einer, die ihren Platz noch nicht geräumt hat.
		const v = await neueVersammlung(betreiberA, stwegA, '2026-10-03');
		const a = await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Alpha' }));
		await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Beta' }));
		const c = await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Gamma' }));

		const neu = await verschiebeTraktandum(handelnder(betreiberA), v, {
			id: c.id,
			neuerElternteil: null,
			stelle: 0
		});
		expect(neu.map((t) => `${t.nummer} ${t.knoten.titel}`)).toEqual(['1 Gamma', '2 Alpha', '3 Beta']);
		expect(neu[1].knoten.id).toBe(a.id);
	});

	it('nimmt den Teilbaum mit', async () => {
		const v = await neueVersammlung(betreiberA, stwegA, '2026-10-04');
		const a = await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Alpha' }));
		const b = await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Beta' }));
		await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(v, { titel: 'Beta eins', parentId: b.id })
		);

		const neu = await verschiebeTraktandum(handelnder(betreiberA), v, {
			id: b.id,
			neuerElternteil: a.id,
			stelle: 0
		});
		expect(neu.map((t) => `${t.nummer} ${t.knoten.titel}`)).toEqual(['1 Alpha', '1.1 Beta', '1.1.1 Beta eins']);
	});

	it('hält alte und neue Nummer im Verlauf fest', async () => {
		const v = await neueVersammlung(betreiberA, stwegA, '2026-10-05');
		await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Alpha' }));
		const b = await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Beta' }));
		await verschiebeTraktandum(handelnder(betreiberA), v, {
			id: b.id,
			neuerElternteil: null,
			stelle: 0
		});

		const zeilen = await imKontext(betreiberA, (tx) => tx<{ detail: Record<string, unknown> }[]>`
			SELECT detail FROM audit_entry
			WHERE subject_id = ${v} AND event_type = 'agenda.tree.reordered'
		`);
		expect(zeilen[0].detail).toMatchObject({ vonNummer: '2', zuNummer: '1' });
	});
});

describe('Manuelle Nummern', () => {
	it('lässt die manuelle Nummer stehen und zählt sie mit', async () => {
		const v = await neueVersammlung(betreiberA, stwegA, '2026-10-06');
		const a = await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Alpha' }));
		await erstelleTraktandum(handelnder(betreiberA), eingabe(v, { titel: 'Beta' }));
		await setzeNummer(handelnder(betreiberA), v, a.id, '1bis');

		const liste = await holeTraktanden(betreiberA, v);
		expect(liste.map((t) => t.nummer)).toEqual(['1bis', '2']);
		expect(liste[0].manuell).toBe(true);
	});

	it('weist Freitext in der Tabelle ab', async () => {
		const t = await erstelleTraktandum(handelnder(betreiberA), eingabe(versammlungA));
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`UPDATE agenda_item SET manual_number = 'siehe oben' WHERE id = ${t.id}`
			)
		).rejects.toThrow(/agenda_nummer/);
	});
});

describe('Sperre nach der Freigabe', () => {
	it('lässt kein Traktandum mehr anlegen', async () => {
		const v = await neueVersammlung(betreiberA, stwegA, '2026-10-07');
		await imKontext(
			betreiberA,
			(tx) => tx`UPDATE meeting SET state = 'freigegeben', released_at = now() WHERE id = ${v}`
		);
		await expect(erstelleTraktandum(handelnder(betreiberA), eingabe(v))).rejects.toThrow(
			/freigegeben/
		);
	});

	it('lässt keines mehr entfernen', async () => {
		const v = await neueVersammlung(betreiberA, stwegA, '2026-10-08');
		const t = await erstelleTraktandum(handelnder(betreiberA), eingabe(v));
		await imKontext(
			betreiberA,
			(tx) => tx`UPDATE meeting SET state = 'freigegeben', released_at = now() WHERE id = ${v}`
		);
		await expect(loescheTraktandum(handelnder(betreiberA), v, t.id)).rejects.toThrow(/freigegeben/);
	});
});

describe('Zeilenschutz', () => {
	it('zeigt einem Betreiber keine fremden Traktanden', async () => {
		await erstelleTraktandum(handelnder(betreiberB), eingabe(fremdeVersammlung));
		expect(await holeTraktanden(betreiberA, fremdeVersammlung)).toHaveLength(0);
	});

	it('liefert ohne Mandantenkontext gar nichts', async () => {
		expect(await ohneKontext((tx) => tx`SELECT id FROM agenda_item`)).toHaveLength(0);
		expect(await ohneKontext((tx) => tx`SELECT party_id FROM agenda_item_affected`)).toHaveLength(0);
	});
});

/**
 * **Ein Traktandum gehört zu genau einer Versammlung** (Sicherheitsdurchgang
 * 07.09.2026).
 *
 * Der Befund kam aus dem `zurueckziehen`: Die Aktion reichte die Kennung aus
 * dem Formular weiter, und die Serverfunktion las das Traktandum allein über
 * sie. Die Versammlung erfuhr sie **aus der gelesenen Zeile** statt aus der
 * Adresse, also gab es nichts zu vergleichen. Die Betreibergrenze hielt;
 * innerhalb derselben Bewirtschaftung liess sich damit an einem Traktandum
 * einer anderen Versammlung arbeiten.
 *
 * Betroffen war nicht eine Stelle, sondern ein halbes Dutzend: `leseEines` ist
 * der gemeinsame Leser von Bearbeiten, Löschen, Nummerieren und Erfordernis,
 * und Rückzug wie Rücknahme hatten je eine eigene Abfrage derselben Bauart.
 *
 * Dieser Block prüft sie zusammen, weil sie zusammen gehören: **zwei
 * Versammlungen desselben Betreibers**, und jeder Weg bekommt die eine
 * Versammlung und das Traktandum der anderen. Eine Fassung ohne Bindung wird
 * hier rot, egal an welcher der Stellen sie fehlt.
 *
 * Dieselbe Klasse wie bei den Vollmachten am 06.09.2026 (`69f107c`).
 */
describe('Ein Traktandum gehört zu genau einer Versammlung', () => {
	let hier: string;
	let dort: string;

	beforeAll(async () => {
		hier = await neueVersammlung(betreiberA, stwegA, '2026-11-02');
		dort = await neueVersammlung(betreiberA, stwegA, '2026-11-03');
	});

	/*
	 * **Je Prüfung ein eigenes Traktandum**, und das ist keine Ordnungsliebe.
	 * Beim ersten Anlauf teilten sich alle Prüfungen eines: In der Mutantenprobe
	 * löschte die Prüfung «löschen» es dann wirklich weg, und die drei danach
	 * bekamen ihr «nicht gefunden» geschenkt. Zwei von fünf wurden rot, drei
	 * blieben grün, ohne etwas zu messen.
	 */
	async function drueben(titel: string): Promise<string> {
		const t = await erstelleTraktandum(handelnder(betreiberA), eingabe(dort, { titel }));
		return t.id;
	}

	/*
	 * **Der Wortlaut ist seit dem 08.09.2026 «gehört nicht zu dieser
	 * Versammlung», und die alte Begründung hielt der Messung nicht stand.**
	 *
	 * Hier stand: «‹Nicht gefunden›, nicht ‹gehört woandershin›: Die Absage darf
	 * nicht verraten, dass es die Kennung anderswo gibt.» Das Anliegen ist
	 * richtig, die Zuordnung war es nicht. Nachgemessen über alle dreizehn
	 * Stellen dieser Klasse: Jede fragt mit **einer** Abfrage
	 * (`WHERE id = … AND meeting_id = …`). Eine fremde Kennung, eine Kennung
	 * eines anderen Betreibers und eine erfundene führen zum selben leeren
	 * Ergebnis und damit zum selben Satz — welcher Satz das ist, trägt also
	 * **null Bit**. Der alte Kommentar verwechselte den Beiklang des Wortlauts
	 * mit einer Auskunft.
	 *
	 * Und die Vorsicht war ohnehin nur hier: Neun der dreizehn Stellen sagten
	 * längst «gehört nicht zu dieser Versammlung». Wer geprüft hätte, hätte
	 * jede davon nehmen können.
	 *
	 * Geblieben ist die Frage, die diese Proben wirklich stellen: Wird die
	 * Handlung abgewiesen? Der Satz steht als `FREMDES_TRAKTANDUM` an einer
	 * Stelle, bewacht von `tests/waechter/absagewortlaut.test.ts`.
	 */
	const fremdesTraktandum = /Dieses Traktandum gehört nicht/;

	it('lässt es nicht über eine andere Versammlung bearbeiten', async () => {
		const dortigesTraktandum = await drueben('Drüben, bearbeiten');
		await expect(
			bearbeiteTraktandum(
				handelnder(betreiberA),
				hier,
				dortigesTraktandum,
				eingabe(hier, { titel: 'Umbenannt' })
			)
		).rejects.toThrow(fremdesTraktandum);
	});

	it('lässt es nicht über eine andere Versammlung löschen', async () => {
		const dortigesTraktandum = await drueben('Drüben, löschen');
		await expect(
			loescheTraktandum(handelnder(betreiberA), hier, dortigesTraktandum)
		).rejects.toThrow(fremdesTraktandum);
		// Und es steht noch: Eine Absage, die halb gewirkt hat, wäre schlimmer.
		expect(
			(await holeTraktanden(betreiberA, dort)).some((t) => t.knoten.id === dortigesTraktandum)
		).toBe(true);
	});

	it('lässt es nicht über eine andere Versammlung umnummerieren', async () => {
		const dortigesTraktandum = await drueben('Drüben, nummerieren');
		await expect(
			setzeNummer(handelnder(betreiberA), hier, dortigesTraktandum, '1bis')
		).rejects.toThrow(fremdesTraktandum);
	});

	it('lässt das Erfordernis nicht über eine andere Versammlung setzen', async () => {
		const dortigesTraktandum = await drueben('Drüben, Erfordernis');
		await expect(
			haltErfordernisAmTraktandumFest(
				handelnder(betreiberA),
				hier,
				dortigesTraktandum,
				ERFORDERNIS
			)
		).rejects.toThrow(fremdesTraktandum);
	});

	it('lässt es nicht über eine andere Versammlung zurückziehen oder zurückholen', async () => {
		const dortigesTraktandum = await drueben('Drüben, Rückzug');
		await expect(
			ziehAntragZurueck(handelnder(betreiberA), hier, dortigesTraktandum, 'Kein Grund')
		).rejects.toThrow(fremdesTraktandum);
		await expect(
			nimmRueckzugZurueck(handelnder(betreiberA), hier, dortigesTraktandum)
		).rejects.toThrow(fremdesTraktandum);

		/*
		 * **Die Gegenrichtung, damit die Reihenfolge der Kennungen mitgeprüft
		 * ist** (Code-Review 07.09.2026). `meetingId` und `traktandumId` sind
		 * beide `Id`; wer sie vertauscht, bekommt immer dieselbe Absage, und
		 * die beiden Behauptungen darüber blieben grün. Mit der richtigen
		 * Paarung darf **diese** Absage gerade nicht kommen: Der Rückzug
		 * scheitert dann am Zustand der Versammlung, die noch im Entwurf steht.
		 */
		await expect(
			ziehAntragZurueck(handelnder(betreiberA), dort, dortigesTraktandum, 'Grund liegt vor')
		).rejects.toThrow(/Zustand/);
		await expect(
			nimmRueckzugZurueck(handelnder(betreiberA), dort, dortigesTraktandum)
		).rejects.toThrow(/Zustand/);
	});

	/*
	 * **Auch der Elternteil gehört geprüft** (Code-Review 07.09.2026). Er kommt
	 * beim Anlegen aus dem Formular, und die Fremdschlüssel der Tabelle binden
	 * ihn nur an den Betreiber. Ohne die Prüfung entstünde in dieser Versammlung
	 * eine Zeile, deren Elternteil in einer anderen liegt.
	 */
	it('lässt kein Traktandum unter einen Elternteil aus einer anderen Versammlung', async () => {
		const dortigesTraktandum = await drueben('Drüben, Elternteil');
		await expect(
			erstelleTraktandum(
				handelnder(betreiberA),
				eingabe(hier, { titel: 'Untergeschoben', parentId: dortigesTraktandum })
			)
		).rejects.toThrow(/derselben Versammlung/);

		// Die Gegenprobe: In der eigenen Versammlung geht es.
		const elternteil = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(hier, { titel: 'Elternteil hier' })
		);
		const kind = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(hier, { titel: 'Kind hier', parentId: elternteil.id })
		);
		expect(kind.parentId).toBe(elternteil.id);
	});

	it('lässt alles davon in der eigenen Versammlung zu', async () => {
		// Die Gegenprobe: Ohne sie prüfte der Block nur, dass die Funktionen
		// überhaupt werfen.
		const eigenes = await erstelleTraktandum(
			handelnder(betreiberA),
			eingabe(hier, { titel: 'Hierhin' })
		);
		await setzeNummer(handelnder(betreiberA), hier, eigenes.id, '2bis');
		await haltErfordernisAmTraktandumFest(handelnder(betreiberA), hier, eigenes.id, ERFORDERNIS);
		await bearbeiteTraktandum(
			handelnder(betreiberA),
			hier,
			eigenes.id,
			eingabe(hier, { titel: 'Hierhin, umbenannt' })
		);
		await loescheTraktandum(handelnder(betreiberA), hier, eigenes.id);
		expect(
			(await holeTraktanden(betreiberA, hier)).some((t) => t.knoten.id === eigenes.id)
		).toBe(false);
	});
});
