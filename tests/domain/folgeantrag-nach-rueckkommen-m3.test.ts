/**
 * Zwei Ergänzungen zum Folgeantrag nach Rückkommen (Auftrag M3, 15.10.2026).
 *
 * **Teil A:** Ein Folgeantrag, über den im gewöhnlichen Ablauf vor dem
 * Grundantrag abgestimmt und der angenommen wurde, trägt einen eigenen
 * Beschluss. Ein Rückkommen auf den Grundantrag nennt ihn nicht, und mit dem
 * neuen Beschluss zum Grundantrag fällt er nicht weg (Fachprüfung 08.10.2026, Frage 2); die Leitung bekommt
 * einen Hinweis, keine Sperre.
 *
 * **Teil B:** Ein zweites, angenommenes, aber unbenutztes Rückkommen nach einer
 * Ersetzung durch den Folgeantrag. Der Rückkommensantrag sagt «siehe
 * Traktandum 9», und dort stand nichts dazu (B2b, zweiter Randfall;
 * Produktentscheid 15.10.2026: eigener Satz). Der Weg durch die Datenbank
 * steht in `tests/db/folgeantrag-nach-rueckkommen.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { folgeantraegeMitEigenemBeschluss, folgeantragBleibtHinweis } from '$lib/domain/rueckkommen';
import type { Durchgang } from '$lib/domain/abstimmung';
import { protokollentwurf, type Protokolleingabe, type Protokollzeile } from '$lib/domain/protokoll';

type D = Durchgang & { rueckkommensantragId?: string | null };

function durchgang(id: string, traktandumId: string, u: Partial<D> = {}): D {
	return {
		id,
		meetingId: 'v',
		traktandumId,
		nummer: 1,
		zustand: 'geschlossen',
		eroeffnetAm: '2027-09-30T19:00:00Z',
		geschlossenAm: '2027-09-30T19:05:00Z',
		ueberholtAm: null,
		ueberholungsgrund: null,
		rueckkommensantragId: null,
		...u
	};
}

const TRAKTANDEN = [
	{ id: 'g', nummer: '9', titel: 'Fassadensanierung', parentId: null },
	{ id: 'f', nummer: '9.1', titel: 'Nur die Wetterseite', parentId: 'g', spontanart: 'folgeantrag' },
	{ id: 'r', nummer: '9.2', titel: 'Rückkommen auf 9', parentId: 'g', spontanart: 'rueckkommen', rueckkommenZielId: 'g' },
	{ id: 'f2', nummer: '9.3', titel: 'Aufhebung und Neufassung', parentId: 'g', spontanart: 'folgeantrag' },
	{ id: 'rf', nummer: '9.4', titel: 'Rückkommen auf 9.1', parentId: 'g', spontanart: 'rueckkommen', rueckkommenZielId: 'f' },
	{ id: 'h', nummer: '10', titel: 'Anderes', parentId: null },
	{ id: 'fh', nummer: '10.1', titel: 'Folgeantrag zu 10', parentId: 'h', spontanart: 'folgeantrag' }
];

const alleAngenommen = () => true;

describe('Folgeanträge mit eigenem Beschluss (Teil A)', () => {
	it('nennt den vorher angenommenen Folgeantrag mit eigenem Durchgang', () => {
		const ds = [durchgang('df', 'f'), durchgang('dg', 'g')];
		expect(folgeantraegeMitEigenemBeschluss('g', TRAKTANDEN, ds, alleAngenommen)).toEqual([
			{ nummer: '9.1', titel: 'Nur die Wetterseite' }
		]);
	});

	it('nennt keinen abgelehnten, offenen oder überholten', () => {
		expect(folgeantraegeMitEigenemBeschluss('g', TRAKTANDEN, [durchgang('df', 'f')], () => false)).toEqual([]);
		expect(
			folgeantraegeMitEigenemBeschluss('g', TRAKTANDEN, [durchgang('df', 'f', { zustand: 'offen' })], alleAngenommen)
		).toEqual([]);
		expect(
			folgeantraegeMitEigenemBeschluss(
				'g',
				TRAKTANDEN,
				[durchgang('df', 'f', { ueberholtAm: '2027-09-30T19:10:00Z' })],
				alleAngenommen
			)
		).toEqual([]);
	});

	it('nennt keinen mehr, sobald nach einem Rückkommen auf den Grundantrag ein Gegenantrag an dessen Stelle trat', () => {
		// Produktentscheid 15.10.2026: Die Leitung ist den Weg aus dem Hinweis gegangen;
		// ob der neue Wortlaut 9.1 aufhebt, liest die Anwendung nicht.
		const ds = [durchgang('df', 'f'), durchgang('df2', 'f2', { rueckkommensantragId: 'r' })];
		expect(folgeantraegeMitEigenemBeschluss('g', TRAKTANDEN, ds, alleAngenommen)).toEqual([]);
		// Ist der Ersetzer selbst wieder überholt, kommt der Hinweis zurück.
		const spaeter = [
			durchgang('df', 'f'),
			durchgang('df2', 'f2', { rueckkommensantragId: 'r', ueberholtAm: '2027-09-30T20:00:00Z' })
		];
		expect(folgeantraegeMitEigenemBeschluss('g', TRAKTANDEN, spaeter, alleAngenommen)).toEqual([
			{ nummer: '9.1', titel: 'Nur die Wetterseite' }
		]);
	});

	it('nennt einen, der nach einem Rückkommen auf sich selbst neu abgestimmt wurde', () => {
		// Solange der Grundantrag offen war, ging das Rückkommen auf den Folgeantrag; sein Beschluss bleibt eigen.
		const ds = [
			durchgang('df1', 'f', { ueberholtAm: '2027-09-30T19:10:00Z', ueberholungsart: 'rueckkommen' }),
			durchgang('df', 'f', { nummer: 2, rueckkommensantragId: 'rf' })
		];
		expect(folgeantraegeMitEigenemBeschluss('g', TRAKTANDEN, ds, alleAngenommen)).toEqual([
			{ nummer: '9.1', titel: 'Nur die Wetterseite' }
		]);
	});

	it('nennt nur Folgeanträge zu diesem Grundantrag', () => {
		const ds = [durchgang('dfh', 'fh')];
		expect(folgeantraegeMitEigenemBeschluss('g', TRAKTANDEN, ds, alleAngenommen)).toEqual([]);
		expect(folgeantraegeMitEigenemBeschluss('h', TRAKTANDEN, ds, alleAngenommen)).toEqual([
			{ nummer: '10.1', titel: 'Folgeantrag zu 10' }
		]);
	});
});

describe('Der Hinweis an die Leitung (Teil A)', () => {
	it('fehlt ohne Folgeantrag mit eigenem Beschluss', () => {
		expect(folgeantragBleibtHinweis([])).toBeNull();
	});

	it('nennt den Folgeantrag, sagt, dass er bleibt, und nennt den Weg', () => {
		const h = folgeantragBleibtHinweis([{ nummer: '9.1', titel: 'Nur die Wetterseite' }])!;
		expect(h).toContain('Beschluss zum Folgeantrag 9.1 «Nur die Wetterseite»');
		expect(h).toContain('mit dem neuen Beschluss zum Grundantrag fällt er deshalb nicht weg');
		expect(h).toContain(
			'unter «Gegenantrag» einen Antrag auf, der die Sache vollständig neu regelt, auch was gleich bleiben soll, und darin den Beschluss zum Folgeantrag ausdrücklich aufhebt'
		);
		expect(h).toContain('Sonst bleibt er neben dem neuen Beschluss bestehen.');
	});

	it('zählt mehrere auf, in der Mehrzahl', () => {
		const h = folgeantragBleibtHinweis([
			{ nummer: '9.1', titel: 'A' },
			{ nummer: '9.3', titel: 'B' },
			{ nummer: '9.4', titel: 'C' }
		])!;
		expect(h).toContain('die Beschlüsse zu den Folgeanträgen 9.1 «A», 9.3 «B» und 9.4 «C»');
		expect(h).toContain('Sonst bleiben sie neben dem neuen Beschluss bestehen.');
	});
});

function zeile(u: Partial<Protokollzeile>): Protokollzeile {
	return {
		nummer: '9',
		tiefe: 0,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		kurzfassung: null,
		notiz: null,
		erfordernis: 'Einfaches Mehr',
		rechtsgrundlage: 'ZGB 712m Abs. 2',
		rueckzug: null,
		beschlusstext: null,
		pendenzen: [],
		satz: null,
		zahlen: null,
		quotenErhoben: false,
		handzaehlung: null,
		ohneZustimmung: [],
		durchgang: null,
		frueherenDurchgaenge: 0,
		frueherenDurchRueckkommen: 0,
		rueckkommenErfolglos: false,
		antragsteller: null,
		folgeantraegeAngenommen: null,
		stichentscheid: null,
		stellvertretend: [],
		spontan: false,
		vorgezogen: false,
		...u
	} as Protokollzeile;
}

function text(z: Partial<Protokollzeile>): string {
	const eingabe: Protokolleingabe = {
		gemeinschaft: 'STWEG Probeweg',
		datum: '2027-09-30',
		uhrzeit: '19:00',
		ort: 'Probesaal',
		art: 'ordentlich',
		stufe: 'erste',
		schlusszeit: '21:00',
		sitzungsleitung: null,
		protokollfuehrung: null,
		beschlussfaehigkeit: null,
		zaehlweise: 'Eine Stimme je Einheit',
		stichentscheid: null,
		teilnehmer: [],
		zeilen: [zeile(z)],
		erzeugtAm: '30. September 2027, 21:30',
		erzeugtDurch: 'Prüfer'
	};
	return protokollentwurf(eingabe).replace(/\s+/g, ' ');
}

const ERSETZUNG = {
	rolle: 'grundantrag' as const,
	grundantrag: { nummer: '9', titel: 'Fassadensanierung' },
	folgeantrag: { nummer: '9.2', titel: 'Nur die Wetterseite' },
	rueckkommensantrag: '9.1',
	frueher: { nummer: 1, ergebnis: 'angenommen' as const, traktandum: null },
	ausgang: 'angenommen' as const,
	spaeterErsetzt: false,
	abgebrochen: false,
	grund: null
};

const WEITER =
	'Soll neu entschieden werden, muss die Sache an einer nächsten Versammlung traktandiert werden, ' +
	'auch an einer eigens einberufenen; Anträge dazu gehen möglichst bald an die Stelle, die die ' +
	'Versammlung einberuft.';

describe('Das unbenutzte Rückkommen nach der Ersetzung durch den Folgeantrag (Teil B)', () => {
	it('steht beim Grundantrag und nennt den Folgeantrag, dessen Beschluss bleibt', () => {
		const t = text({
			ersetzung: ERSETZUNG,
			ersetztNachRueckkommen: [{ nummer: 1, ergebnis: 'angenommen', folgeantrag: '9.2' }],
			rueckkommenOhneDurchgang: { antrag: '9.3', geltenderDurchgang: 1, geltendAbgelehnt: false, folgeantrag: '9.2' }
		});
		expect(t).toContain('kam statt dieses Antrags der Folgeantrag 9.2 «Nur die Wetterseite» zur Abstimmung');
		expect(t).toContain(
			'- Die Versammlung hat beschlossen, auf dieses Traktandum zurückzukommen (Traktandum 9.3); ' +
				'erneut abgestimmt wurde nicht. Es bleibt beim Beschluss zum Folgeantrag 9.2, wie oben ' +
				`festgehalten. ${WEITER}`
		);
		// Nicht «aus dem 1. Durchgang»: Der 1. Durchgang am Grundantrag ist ersetzt.
		expect(t).not.toContain('Es bleibt beim Beschluss aus dem');
	});

	it('nennt nach einer Ablehnung des Folgeantrags die Ablehnung', () => {
		const t = text({
			ersetzung: { ...ERSETZUNG, ausgang: 'abgelehnt' },
			rueckkommenOhneDurchgang: { antrag: '9.3', geltenderDurchgang: 1, geltendAbgelehnt: true, folgeantrag: '9.2' }
		});
		expect(t).toContain(
			'Es bleibt bei der Ablehnung des Folgeantrags 9.2; angenommen ist zu dieser Sache nichts, wie oben festgehalten.'
		);
	});

	it('lässt den Satz am selben Traktandum, wie N2 ihn gemessen hat (Gegenprobe)', () => {
		const t = text({
			satz: 'Angenommen.',
			zahlen: {
				koepfe: { ja: 2, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 2, schwelle: 2 },
				quoten: { ja: 1000, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 1000, schwelle: null }
			},
			durchgang: 2,
			frueherenDurchgaenge: 1,
			frueherenDurchRueckkommen: 1,
			ersetztNachRueckkommen: [{ nummer: 1, ergebnis: 'angenommen' }],
			rueckkommenOhneDurchgang: { antrag: '9.1', geltenderDurchgang: 2, geltendAbgelehnt: false }
		});
		expect(t).toContain(
			'erneut abgestimmt wurde nicht. Es bleibt beim Beschluss aus dem 2. Durchgang, wie oben festgehalten.'
		);
	});
});
