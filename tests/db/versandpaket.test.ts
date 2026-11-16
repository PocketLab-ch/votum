/**
 * Das Versandpaket — eine ZIP mit lauter Einzeldokumenten.
 *
 * Geprüft wird, was sich nur am fertigen Paket zeigt: dass genau so viele
 * Karten darin liegen, wie es Parteien gibt, dass gleichnamige Parteien nicht
 * eine Datei überschreiben, dass die Versandliste jede Karte ihrem Empfänger
 * zuordnet — und dass die Codes darin nur ein einziges Mal entstanden sind.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import {
	erstelleEigentuemer,
	erstelleGemeinschaftlicheZeile,
	ordneEigentumZu
} from '$lib/server/eigentuemer';
import { setzeZustelladresse } from '$lib/server/mitberechtigte';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { erzeugeVersandpaket } from '$lib/server/versandpaket';
import { zerlege } from '$lib/domain/csv';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null as unknown as string, label: 'Prüflauf' };
}

/** Liest die Namen aus dem Verzeichnis am Ende des Archivs. */
function eintraege(zip: Uint8Array): { name: string; groesse: number }[] {
	const zahl = (stelle: number, breite: number) => {
		let wert = 0;
		for (let i = breite - 1; i >= 0; i--) wert = wert * 256 + zip[stelle + i];
		return wert;
	};

	const abschluss = zip.length - 22;
	const anzahl = zahl(abschluss + 10, 2);
	let stelle = zahl(abschluss + 16, 4);

	const gefunden: { name: string; groesse: number }[] = [];
	const leser = new TextDecoder();
	for (let i = 0; i < anzahl; i++) {
		expect(zahl(stelle, 4)).toBe(0x02014b50);
		const namenslaenge = zahl(stelle + 28, 2);
		gefunden.push({
			name: leser.decode(zip.slice(stelle + 46, stelle + 46 + namenslaenge)),
			groesse: zahl(stelle + 24, 4)
		});
		stelle += 46 + namenslaenge + zahl(stelle + 30, 2) + zahl(stelle + 32, 2);
	}
	return gefunden;
}

/** Holt eine Datei aus dem Archiv — der Inhalt liegt unverdichtet hinter dem Kopf. */
function datei(zip: Uint8Array, name: string): Uint8Array {
	const leser = new TextDecoder();
	let stelle = 0;
	while (stelle < zip.length) {
		const kennung =
			zip[stelle] | (zip[stelle + 1] << 8) | (zip[stelle + 2] << 16) | (zip[stelle + 3] << 24);
		if (kennung !== 0x04034b50) break;
		const groesse =
			zip[stelle + 18] |
			(zip[stelle + 19] << 8) |
			(zip[stelle + 20] << 16) |
			(zip[stelle + 21] << 24);
		const namenslaenge = zip[stelle + 26] | (zip[stelle + 27] << 8);
		const zusatz = zip[stelle + 28] | (zip[stelle + 29] << 8);
		const gefunden = leser.decode(zip.slice(stelle + 30, stelle + 30 + namenslaenge));
		const beginn = stelle + 30 + namenslaenge + zusatz;
		if (gefunden === name) return zip.slice(beginn, beginn + groesse);
		stelle = beginn + groesse;
	}
	throw new Error(`«${name}» liegt nicht im Archiv.`);
}

async function aufbau(name: string, datum: string, parteien: string[]) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});

	// Der Rest auf die erste Einheit: Die Freigabe sperrt zu Recht, wenn die
	// Wertquoten nicht aufgehen.
	const anteil = Math.floor(1000 / parteien.length);
	const rest = 1000 - anteil * parteien.length;

	for (const [nummer, parteiname] of parteien.entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${nummer + 1}`,
			quotas: { stamm: nummer === 0 ? anteil + rest : anteil },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: parteiname,
			isCommunity: false,
			representativeName: null
		});
		await imKontext(betreiber, (tx) => tx`
			UPDATE party SET email = ${`${nummer + 1}@example.ch`} WHERE id = ${p.id}
		`);
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
	}

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird gemäss Offerte saniert.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	return v.id;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Versandpaket');
});

afterAll(verbindungenSchliessen);

describe('Versandpaket', () => {
	it('legt die Traktandenliste einmal und je Partei eine Karte hinein', async () => {
		const v = await aufbau('Paketweg 1', '2026-09-15', [
			'Anna Muster',
			'Peter Kunz',
			'Rita Berger'
		]);

		const paket = await erzeugeVersandpaket(
			handelnder(betreiber),
			v,
			'https://beispiel.ch',
			undefined,
			'2026-08-01 09:00:00'
		);

		const namen = eintraege(paket.bytes).map((e) => e.name);
		expect(namen.filter((n) => n.startsWith('Traktandenliste_'))).toHaveLength(1);
		expect(namen.filter((n) => n.startsWith('Zugangskarte_'))).toHaveLength(3);
		/*
		 * **Und je Partei ein Vollmachtsformular** (Bedienbarkeitsprüfung
		 * 05.09.2026, Befund 25; hier nachgezogen am 07.09.2026 aus dem
		 * Code-Review). Es lag zuerst nur im **gedruckten** Versandsatz bei —
		 * über dieses Paket geht aber der elektronische Versand hinaus, und der
		 * ist der häufigere Weg.
		 */
		expect(namen.filter((n) => n.startsWith('Vollmacht_'))).toHaveLength(3);
		expect(namen).toContain('Versandliste.csv');
		expect(paket.dateiname).toBe('Versandpaket-2026-09-15.zip');
	});

	it('gibt jedem Formular den Namen seiner Partei im Dateinamen', async () => {
		// Welche Person auf welchem Blatt steht, prüft `tests/db/pdf.test.ts` am
		// zurückgelesenen Text. Hier zählt die Zuordnung im Archiv: Der Versand
		// je Person hängt daran, und ein vertauschter Name fiele erst am Einlass
		// auf.
		const v = await aufbau('Paketweg 6', '2026-09-20', ['Anna Muster', 'Peter Kunz']);
		const paket = await erzeugeVersandpaket(
			handelnder(betreiber),
			v,
			'https://beispiel.ch',
			undefined,
			'2026-08-01 09:00:00'
		);
		const namen = eintraege(paket.bytes)
			.map((e) => e.name)
			.filter((n) => n.startsWith('Vollmacht_'));
		expect(namen).toHaveLength(2);
		expect(namen.some((n) => n.includes('Anna-Muster'))).toBe(true);
		expect(namen.some((n) => n.includes('Peter-Kunz'))).toBe(true);
	});

	it('gibt gleichnamigen Parteien verschiedene Dateien', async () => {
		// «Erbengemeinschaft Meier» kommt in einer Liegenschaft durchaus zweimal
		// vor. Zwei gleichnamige Einträge wären je nach Entpacker eine Datei — und
		// dann fehlte einem Eigentümer seine Karte.
		const v = await aufbau('Paketweg 2', '2026-09-16', [
			'Erbengemeinschaft Meier',
			'Erbengemeinschaft Meier'
		]);

		const paket = await erzeugeVersandpaket(
			handelnder(betreiber),
			v,
			'https://beispiel.ch',
			undefined,
			'2026-08-01 09:00:00'
		);

		const karten = eintraege(paket.bytes)
			.map((e) => e.name)
			.filter((n) => n.startsWith('Zugangskarte_'));
		expect(karten).toHaveLength(2);
		expect(new Set(karten).size).toBe(2);
	});

	it('schreibt Umlaute im Dateinamen aus', async () => {
		const v = await aufbau('Paketweg 3', '2026-09-17', ['Jürg Müller']);
		const paket = await erzeugeVersandpaket(
			handelnder(betreiber),
			v,
			'https://beispiel.ch',
			undefined,
			'2026-08-01 09:00:00'
		);
		expect(eintraege(paket.bytes).map((e) => e.name)).toContain(
			'Zugangskarte_2026-09-17_Juerg-Mueller.pdf'
		);
	});

	it('ordnet in der Versandliste Datei, Partei und E-Mail einander zu', async () => {
		// Ohne sie stünde am Ende ein Ordner mit lauter PDF, und die Zuordnung zum
		// Empfänger müsste jemand von Hand aus den Dateinamen ableiten.
		const v = await aufbau('Paketweg 4', '2026-09-18', ['Anna Muster', 'Peter Kunz']);
		const paket = await erzeugeVersandpaket(
			handelnder(betreiber),
			v,
			'https://beispiel.ch',
			undefined,
			'2026-08-01 09:00:00'
		);

		const liste = zerlege(new TextDecoder().decode(datei(paket.bytes, 'Versandliste.csv')));
		expect(liste.zeilen).toHaveLength(2);

		const namen = eintraege(paket.bytes).map((e) => e.name);
		for (const zeile of liste.zeilen) {
			expect(namen).toContain(zeile.werte['zugangskarte']);
			// Seit dem 07.09.2026 trägt die Liste auch das Vollmachtsformular —
			// sonst müsste die Zuordnung doch wieder aus dem Dateinamen kommen.
			expect(namen).toContain(zeile.werte['vollmachtsformular']);
			expect(zeile.werte['e-mail']).toMatch(/@example\.ch$/);
			expect(zeile.werte['wertquote']).toMatch(/ \/ 1000$/);
		}
	});

	it('enthält keinen Zugangscode in der Versandliste', async () => {
		// Sie geht durch mehr Hände als die Karten selbst — in eine Ablage, in eine
		// Tabellenkalkulation, in einen Serienbrief.
		const v = await aufbau('Paketweg 5', '2026-09-19', ['Anna Muster']);
		const paket = await erzeugeVersandpaket(
			handelnder(betreiber),
			v,
			'https://beispiel.ch',
			undefined,
			'2026-08-01 09:00:00'
		);

		const liste = new TextDecoder().decode(datei(paket.bytes, 'Versandliste.csv'));
		expect(liste).not.toMatch(/[A-Z2-9]{20}/);
		expect(liste).not.toMatch(/\/z\//);
	});

	it('erzeugt die Zugänge in einem Zug', async () => {
		// Jeder Code existiert nur im Augenblick seiner Entstehung. Entstünden sie
		// einzeln, machte jeder Aufruf die vorigen ungültig.
		const v = await aufbau('Paketweg 6', '2026-09-20', ['Anna Muster', 'Peter Kunz']);
		await erzeugeVersandpaket(
			handelnder(betreiber),
			v,
			'https://beispiel.ch',
			undefined,
			'2026-08-01 09:00:00'
		);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ state: string }[]>`
			SELECT state FROM meeting_access WHERE meeting_id = ${v}
		`);
		expect(zeilen).toHaveLength(2);
		expect(zeilen.every((z) => z.state === 'gueltig')).toBe(true);
	});

	it('sagt es, wenn es nichts zu erzeugen gibt', async () => {
		const v = await aufbau('Paketweg 7', '2026-09-21', ['Anna Muster']);
		await erzeugeVersandpaket(
			handelnder(betreiber),
			v,
			'https://beispiel.ch',
			undefined,
			'2026-08-01 09:00:00'
		);
		await expect(
			erzeugeVersandpaket(
				handelnder(betreiber),
				v,
				'https://beispiel.ch',
				undefined,
				'2026-08-01 09:00:00'
			)
		).rejects.toThrow(/bereits einen gültigen/);
	});
});

/**
 * Die Einladung an alle Mitberechtigten, nach Wermelinger, Rz. 50 ad Art. 712n (Aufgabe 5).
 *
 * **Warum am fertigen Paket und nicht nur im Kern.** Die Regel selbst steht in
 * `empfaengerkreis` und ist dort geprüft. Hier geht es um die Frage daneben:
 * Kommen die Mitberechtigten überhaupt an? Sie stehen **nicht** im
 * festgehaltenen Stand — `freigabe.ts` lässt Parteien ohne Einheit weg. Ein
 * Empfängerkreis, der von dort läse, bliebe leer und meldete keinen Fehler.
 */
describe('Versandpaket mit gemeinschaftlichem Eigentum', () => {
	async function mitHuelle(name: string, datum: string, emails: (string | null)[]) {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});

		const { huelle, mitglieder } = await erstelleGemeinschaftlicheZeile(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			personen: [
				{ name: 'Anna Muster', email: emails[0], adresse: null },
				{ name: 'Beat Muster', email: emails[1], adresse: null }
			],
			vertreterIndex: 0
		});

		const einheit = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: 'Whg 1',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		await ordneEigentumZu(handelnder(betreiber), einheit.id, huelle, '2020-01-01');

		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum,
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			parentId: null,
			titel: 'Sanierung der Fassade',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird gemäss Offerte saniert.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await gibVersammlungFrei(handelnder(betreiber), v.id);
		return { gemeinschaft: g.id, versammlung: v.id, huelle, mitglieder };
	}

	async function paketVon(versammlung: string, datum = '2026-08-01 09:00:00') {
		return erzeugeVersandpaket(
			handelnder(betreiber),
			versammlung,
			'https://beispiel.ch',
			undefined,
			datum
		);
	}

	it('schickt beiden Mitberechtigten dieselbe Karte', async () => {
		/*
		 * **Der Entscheid vom 27.08.2026.** Bis dahin ging die Karte allein an die
		 * vertretende Person, und die übrigen bekamen die Traktandenliste. Das
		 * folgte dem Aufdruck «Die Stimme übt aus: …» — der ist weg, und damit auch
		 * der Grund. Der Zugangscode ist das «oder»: Die Einheit hat eine Stimme,
		 * der Einlass lässt genau einmal herein.
		 */
		const s = await mitHuelle('Paketweg 8', '2026-09-22', ['anna@example.ch', 'beat@example.ch']);
		const paket = await paketVon(s.versammlung);

		// **Die Zahl der Karten bleibt bei eins.** Beide bekommen dieselbe Datei;
		// eine zweite Karte wäre eine zweite Stimme.
		const namen = eintraege(paket.bytes).map((e) => e.name);
		expect(namen.filter((n) => n.startsWith('Zugangskarte_'))).toHaveLength(1);

		expect(paket.empfaenger).toHaveLength(2);
		expect(paket.empfaenger.map((e) => e.adresse).sort()).toEqual([
			'anna@example.ch',
			'beat@example.ch'
		]);
		for (const e of paket.empfaenger) {
			expect(e.dateinamen[0]).toMatch(/^Zugangskarte_/);
			expect(e.dateinamen[1]).toMatch(/^Vollmacht_/);
			expect(e.gemeinschaftlich).toBe(true);
		}
		// Jede Beilage liegt auch wirklich im Paket: `verschicke` verweigert die
		// Nachricht sonst und meldet einen Fehlschlag, der keiner ist.
		for (const e of paket.empfaenger) for (const d of e.dateinamen) expect(namen).toContain(d);
	});

	it('schickt sie auch dann an beide, wenn niemand als Vertretung bezeichnet ist', async () => {
		/*
		 * **Die Bezeichnung ist seit dem 27.08.2026 freiwillig.** Der alte Weg hing
		 * an ihr: Ohne `representative_party_id` gab es keine Adresse, an die die
		 * Karte ging, und die Zeile blieb unversorgt. Jetzt hängt nichts mehr daran.
		 */
		const s = await mitHuelle('Paketweg 15', '2026-09-29', ['anna@example.ch', 'beat@example.ch']);
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE party SET representative_party_id = NULL, representative_name = NULL
				 WHERE id = ${s.huelle}
			`
		);

		const paket = await paketVon(s.versammlung);
		expect(paket.empfaenger.map((e) => e.adresse).sort()).toEqual([
			'anna@example.ch',
			'beat@example.ch'
		]);
		for (const e of paket.empfaenger) {
			expect(e.dateinamen[0]).toMatch(/^Zugangskarte_/);
			expect(e.dateinamen[1]).toMatch(/^Vollmacht_/);
		}
	});

	it('borgt keine Adresse mehr, wenn die Zeile selbst eine trägt', async () => {
		// Die Zeile bekommt ihre eigene Sendung, die Personen ihre — dieselbe
		// Datei, drei Adressen, eine Stimme.
		const s = await mitHuelle('Paketweg 16', '2026-09-30', ['anna@example.ch', 'beat@example.ch']);
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE party SET email = 'huelle@example.ch' WHERE id = ${s.huelle}`
		);

		const paket = await paketVon(s.versammlung);
		expect(paket.empfaenger.map((e) => e.adresse).sort()).toEqual([
			'anna@example.ch',
			'beat@example.ch',
			'huelle@example.ch'
		]);
	});

	it('schickt nicht zweimal an dieselbe Adresse', async () => {
		// Eheleute mit einem gemeinsamen Postfach: Zwei Sendungen mit derselben
		// Karte an dieselbe Adresse sagten beim zweiten Mal nichts Neues.
		const s = await mitHuelle('Paketweg 17', '2026-10-01', ['paar@example.ch', 'paar@example.ch']);
		const paket = await paketVon(s.versammlung);
		expect(paket.empfaenger.map((e) => e.adresse)).toEqual(['paar@example.ch']);

		const liste = zerlege(new TextDecoder().decode(datei(paket.bytes, 'Versandliste.csv')));
		const beat = liste.zeilen.find((z) => z.werte['partei'] === 'Beat Muster');
		expect(beat?.werte['rolle']).toContain('dieselbe Adresse wurde bereits angeschrieben');
		expect(beat?.werte['zugangskarte']).toBe('');
	});

	it('meldet die Zeile nicht als unversorgt, nur weil sie keine eigene Adresse hat', async () => {
		/*
		 * Eine über die Maske erfasste gemeinschaftliche Zeile trägt keine E-Mail —
		 * die Adressen stehen bei den Personen. Stünde sie trotzdem mit leerer
		 * Adresse in der Empfängerliste, meldete `planeVersand` sie als «nicht
		 * angeschrieben», obwohl beide Beteiligten ihre Karte bekommen haben.
		 */
		const s = await mitHuelle('Paketweg 18', '2026-10-02', ['anna@example.ch', 'beat@example.ch']);
		const paket = await paketVon(s.versammlung);
		expect(paket.empfaenger.map((e) => e.name)).not.toContain('Anna Muster und Beat Muster');
	});

	it('schreibt eine archivierte Mitberechtigte nicht an und sagt es in der Liste', async () => {
		/*
		 * Eine Mitgliedszeile hält keine Einheit und lässt sich deshalb jederzeit
		 * archivieren (`pruefeEigentuemerArchivierbar`); `party_member` bleibt
		 * dabei stehen. Ohne diese Schranke ginge die Zugangskarte an jemanden, der
		 * seinen Anteil verkauft hat.
		 */
		const s = await mitHuelle('Paketweg 13', '2026-09-27', ['anna@example.ch', 'beat@example.ch']);
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE party SET archived_at = now() WHERE id = ${s.mitglieder[1]}`
		);

		const paket = await paketVon(s.versammlung);
		expect(paket.empfaenger.map((e) => e.adresse)).toEqual(['anna@example.ch']);

		const liste = zerlege(new TextDecoder().decode(datei(paket.bytes, 'Versandliste.csv')));
		const beat = liste.zeilen.find((z) => z.werte['partei'] === 'Beat Muster');
		expect(beat?.werte['rolle']).toContain('im Archiv, nicht angeschrieben');
		expect(beat?.werte['zugangskarte']).toBe('');
	});

	it('lässt die Karte nicht liegen, wenn ausgerechnet die Vertretung im Archiv ist', async () => {
		/*
		 * **Der Fall, den der alte Weg verlor.** Anna vertritt und wandert ins
		 * Archiv; die Karte ging danach an niemanden, obwohl Beat erreichbar ist
		 * und nach Wermelinger Rz. 19 ad Art. 712o allein gültig vertreten darf.
		 */
		const s = await mitHuelle('Paketweg 14', '2026-09-28', ['anna@example.ch', 'beat@example.ch']);
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE party SET archived_at = now() WHERE id = ${s.mitglieder[0]}`
		);

		const paket = await paketVon(s.versammlung);
		expect(paket.empfaenger.map((e) => e.adresse)).toEqual(['beat@example.ch']);
		expect(paket.empfaenger[0].dateinamen[0]).toMatch(/^Zugangskarte_/);
	});

	it('behauptet keine Zustellung, wo die gemeldete Adresse keine E-Mail trägt', async () => {
		/*
		 * Der gefährliche Fall: Beat ist als Zustelladresse gemeldet und hat keine
		 * E-Mail. Der Kreis ist damit auf ihn eingeengt — an die übrigen geht
		 * nichts. Stünde bei Anna «Zustellung an die gemeldete Adresse», verdeckte
		 * das genau den Fall, der den Beschluss anfechtbar macht (Art. 75 ZGB).
		 */
		const s = await mitHuelle('Paketweg 12', '2026-09-26', ['anna@example.ch', null]);
		await setzeZustelladresse(handelnder(betreiber), s.huelle, s.mitglieder[1]);

		const paket = await paketVon(s.versammlung);

		const liste = zerlege(new TextDecoder().decode(datei(paket.bytes, 'Versandliste.csv')));
		const beat = liste.zeilen.find((z) => z.werte['partei'] === 'Beat Muster');
		expect(beat?.werte['rolle']).toContain('gemeldete Zustelladresse, keine E-Mail erfasst');
		expect(beat?.werte['zugangskarte']).toBe('');
		const anna = liste.zeilen.find((z) => z.werte['partei'] === 'Anna Muster');
		expect(anna?.werte['rolle']).toContain('nicht angeschrieben');
		expect(anna?.werte['zugangskarte']).toBe('');

		// Beat steht als Empfänger ohne Adresse da — `planeVersand` meldet ihn
		// damit auf dem Bildschirm als «nicht angeschrieben».
		expect(paket.empfaenger.map((e) => e.adresse)).toEqual(['']);
	});

	it('nennt die Mitberechtigten in der Versandliste, unter ihrer Hülle', async () => {
		const s = await mitHuelle('Paketweg 9', '2026-09-23', ['anna@example.ch', null]);
		const paket = await paketVon(s.versammlung);

		const liste = zerlege(new TextDecoder().decode(datei(paket.bytes, 'Versandliste.csv')));
		expect(liste.zeilen.map((z) => z.werte['partei'])).toEqual([
			'Anna Muster und Beat Muster',
			'Anna Muster',
			'Beat Muster'
		]);
		expect(liste.zeilen[0].werte['rolle']).toBe('stimmberechtigt');
		expect(liste.zeilen[1].werte['rolle']).toContain('bekommt die Zugangskarte');
		expect(liste.zeilen[1].werte['zugangskarte']).toMatch(/^Zugangskarte_/);

		/*
		 * **Beat steht da, obwohl er nichts bekommt.** Ohne Adresse fällt er aus
		 * dem Empfängerkreis — aber nicht aus der Liste. Sonst verschwände er
		 * zwischen zwei Filterschritten, und niemand trüge seine Adresse nach.
		 */
		expect(liste.zeilen[2].werte['rolle']).toContain('keine E-Mail-Adresse erfasst');
		expect(liste.zeilen[2].werte['e-mail']).toBe('');
		expect(liste.zeilen[2].werte['zugangskarte']).toBe('');

		// Und er steht auch als Empfänger da, mit leerer Adresse: Nur so meldet
		// ihn `planeVersand` als «ohne Adresse und deshalb nicht angeschrieben».
		expect(paket.empfaenger).toEqual([
			expect.objectContaining({ name: 'Anna Muster', adresse: 'anna@example.ch' }),
			expect.objectContaining({ name: 'Beat Muster', adresse: '' })
		]);
	});

	it('schreibt bei gemeldeter Zustelladresse nur dorthin', async () => {
		// ZGB Art. 712n, Rz. 49/51: Ist eine Zustelladresse bestimmt und gemeldet,
		// genügt die Zustellung dorthin.
		const s = await mitHuelle('Paketweg 10', '2026-09-24', [
			'anna@example.ch',
			'beat@example.ch'
		]);
		await setzeZustelladresse(handelnder(betreiber), s.huelle, s.mitglieder[1]);
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE party SET email = 'huelle@example.ch' WHERE id = ${s.huelle}`
		);

		const paket = await paketVon(s.versammlung);

		/*
		 * **Nur dorthin heisst nur dorthin** (aus dem Code-Review, 27.08.2026).
		 * Weder Anna noch die eigene Adresse der Zeile bekommen etwas: Wer eine
		 * Zustelladresse meldet, tut das gerade, um die übrigen Wege zu schliessen.
		 */
		expect(paket.empfaenger.map((e) => e.adresse)).toEqual(['beat@example.ch']);

		const liste = zerlege(new TextDecoder().decode(datei(paket.bytes, 'Versandliste.csv')));
		expect(liste.zeilen[0].werte['rolle']).toContain('Zustellung an die gemeldete Adresse');
		expect(liste.zeilen[0].werte['zugangskarte']).toBe('');
		const anna = liste.zeilen.find((z) => z.werte['partei'] === 'Anna Muster');
		expect(anna?.werte['rolle']).toContain('Zustellung an die gemeldete Adresse');
		expect(anna?.werte['zugangskarte']).toBe('');
		const beat = liste.zeilen.find((z) => z.werte['partei'] === 'Beat Muster');
		expect(beat?.werte['rolle']).toContain('gemeldete Zustelladresse, bekommt die Zugangskarte');
		expect(beat?.werte['zugangskarte']).toMatch(/^Zugangskarte_/);
	});

	it('fällt auf die Adresse der Zeile zurück, wenn die gemeldete keine E-Mail trägt', async () => {
		/*
		 * Die Sperre oben darf nicht dazu führen, dass gar nichts hinausgeht. Ist
		 * die gemeldete Person nicht erreichbar, greift der Rückfall aus
		 * `empfaengerkreis`: an die Adresse der Zeile, nicht an die übrigen
		 * Personen. Nirgendwohin wäre die gefährliche Richtung (Art. 75 ZGB).
		 */
		const s = await mitHuelle('Paketweg 20', '2026-10-04', ['anna@example.ch', null]);
		await setzeZustelladresse(handelnder(betreiber), s.huelle, s.mitglieder[1]);
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE party SET email = 'huelle@example.ch' WHERE id = ${s.huelle}`
		);

		const paket = await paketVon(s.versammlung);
		expect(paket.empfaenger.map((e) => e.adresse).sort()).toEqual(['', 'huelle@example.ch']);
		expect(paket.empfaenger.find((e) => e.adresse === 'huelle@example.ch')?.dateinamen[0]).toMatch(
			/^Zugangskarte_/
		);
	});

	it('lässt den Alleineigentümer beim bisherigen Begleittext', async () => {
		// `gemeinschaftlich: false` wählt in `planeVersand` die Fassung mit der
		// Warnung «Geben Sie sie nicht weiter» — dort ist sie richtig.
		const v = await aufbau('Paketweg 19', '2026-10-03', ['Anna Muster']);
		const paket = await paketVon(v);
		expect(paket.empfaenger).toHaveLength(1);
		expect(paket.empfaenger[0].gemeinschaftlich).toBe(false);
	});
});
