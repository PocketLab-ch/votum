/**
 * Die Begründung jeder angesetzten Neuabstimmung im Protokoll (Produktentscheid
 * 30.09.2026: «Ja, immer nennen»), als Anordnung der Leitung wiedergegeben
 * (Fachprüfung 30.09.2026, F-3). Die Kombinationen, die der Durchstich über
 * die Datenbank nicht einzeln aufbaut: neben dem Weggang, neben einem nicht
 * erklärten Rückkommen und bei einer Neuabstimmung, die nicht mehr eröffnet
 * wurde. Der Weg durch die Auswertung steht in
 * `tests/db/neuabstimmung-protokoll.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { protokollentwurf, type Protokolleingabe, type Protokollzeile } from '$lib/domain/protokoll';

function zeile(u: Partial<Protokollzeile> = {}): Protokollzeile {
	return {
		nummer: '1',
		tiefe: 0,
		titel: 'Ersatz der Gegensprechanlage',
		art: 'abstimmung',
		antragswortlaut: 'Die Gegensprechanlage wird ersetzt.',
		kurzfassung: null,
		notiz: null,
		erfordernis: 'Einfaches Mehr',
		rechtsgrundlage: 'ZGB 712m Abs. 2',
		rueckzug: null,
		beschlusstext: null,
		pendenzen: [],
		satz: 'Angenommen.',
		zahlen: {
			koepfe: { ja: 2, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 2, schwelle: 2 },
			quoten: { ja: 1000, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 1000, schwelle: null }
		},
		quotenErhoben: false,
		handzaehlung: null,
		ohneZustimmung: [],
		durchgang: 2,
		frueherenDurchgaenge: 1,
		frueherenDurchRueckkommen: 0,
		rueckkommenErfolglos: false,
		antragsteller: null,
		folgeantraegeAngenommen: null,
		stichentscheid: null,
		stellvertretend: [],
		spontan: false,
		vorgezogen: false,
		...u
	};
}

function text(z: Partial<Protokollzeile>): string {
	const eingabe: Protokolleingabe = {
		gemeinschaft: 'STWEG Probeweg',
		datum: '2027-08-11',
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
		erzeugtAm: '11. August 2027, 21:30',
		erzeugtDurch: 'Prüfer'
	};
	return protokollentwurf(eingabe).replace(/\s+/g, ' ');
}

const AUF_ANFRAGE = 'gibt auf Anfrage bekannt, wer das Protokoll aufbewahrt.';

const SATZ_EINS =
	'- Die Sitzungsleitung hat den 1. Durchgang überholt und eine Neuabstimmung angesetzt ' +
	'(Begründung: Frage falsch gestellt). Er hatte «angenommen» ergeben; massgebend ist nach ' +
	'ihrer Anordnung der 2. Durchgang.';

describe('Die Begründung einer Neuabstimmung im Protokoll', () => {
	it('steht beim Geschäft, mit dem Ergebnis des überholten Durchgangs', () => {
		const t = text({
			neuabstimmungen: [{ nummer: 1, begruendung: 'Frage falsch gestellt.', ergebnis: 'angenommen' }]
		});
		expect(t).toContain(SATZ_EINS);
		expect(t).not.toMatch(/siehe Verlauf|auf Anfrage/);
	});

	it('lässt das Ergebnis weg, wenn keines lesbar war', () => {
		const t = text({
			neuabstimmungen: [{ nummer: 1, begruendung: 'Frage falsch gestellt', ergebnis: null }]
		});
		expect(t).toContain(
			'(Begründung: Frage falsch gestellt). Massgebend ist nach ihrer Anordnung der 2. Durchgang.'
		);
		expect(t).not.toContain('ergeben');
	});

	it('nennt die Durchgangsnummer nur einmal neben einem Weggang', () => {
		const t = text({
			durchgang: 3,
			frueherenDurchgaenge: 2,
			nachWeggang: [{ nummer: 2, namen: ['Probe Zweitpartei'], handzaehlung: false }],
			neuabstimmungen: [{ nummer: 1, begruendung: 'Frage falsch gestellt', ergebnis: 'angenommen' }]
		});
		expect(t.match(/- 3\. Durchgang\./g)).toHaveLength(1);
		expect(t).toContain(SATZ_EINS.replace('der 2. Durchgang', 'der 3. Durchgang'));
		expect(t).toContain('Der 2. Durchgang ergab keinen Beschluss: Probe Zweitpartei hatte');
		expect(t).not.toMatch(/siehe Verlauf|auf Anfrage/);
	});

	it('sagt für einen nicht erklärten Durchgang, wer seine Zahlen nennt', () => {
		const t = text({
			durchgang: 3,
			frueherenDurchgaenge: 2,
			frueherenDurchRueckkommen: 1,
			neuabstimmungen: [{ nummer: 2, begruendung: 'Stimmen doppelt erfasst', ergebnis: 'abgelehnt' }]
		});
		expect(t).toContain('- Die Sitzungsleitung hat den 2. Durchgang überholt');
		expect(t).toContain('Er hatte «abgelehnt» ergeben; massgebend ist nach ihrer Anordnung der 3.');
		expect(t).toContain(
			'- Weitere frühere Durchgänge sind hier nicht einzeln aufgeführt; ihre Zahlen ' + AUF_ANFRAGE
		);
	});

	it('nennt bei einer nicht mehr eröffneten Neuabstimmung auch die früheren', () => {
		const t = text({
			satz: null,
			zahlen: null,
			durchgang: null,
			frueherenDurchgaenge: 1,
			neuabstimmungOffen: { nummer: 2, begruendung: 'Antrag unklar' },
			neuabstimmungen: [{ nummer: 1, begruendung: 'Frage falsch gestellt', ergebnis: 'angenommen' }]
		});
		expect(t).toContain(
			'Abgestimmt wurde im 2. Durchgang; die Sitzungsleitung hat eine Neuabstimmung angesetzt ' +
				'(Begründung: Antrag unklar). Ein Beschluss ist nicht gefasst worden.'
		);
		// Ohne geltenden Durchgang nennt der Satz keinen massgebenden.
		expect(t).toContain(
			'- Die Sitzungsleitung hat den 1. Durchgang überholt und eine Neuabstimmung angesetzt ' +
				'(Begründung: Frage falsch gestellt). Er hatte «angenommen» ergeben.'
		);
		expect(t).not.toContain('massgebend');
		// Ohne lesbares Ergebnis nur der Ort (Laienprüfung Runde 2, L8).
		expect(t).toContain(
			'- Zur Neuabstimmung kam es nicht mehr. Wer das Protokoll aufbewahrt, gibt das Ergebnis ' +
				'des 2. Durchgangs auf Anfrage bekannt.'
		);
	});

	it('nennt das Ergebnis des nicht mehr neu abgestimmten Durchgangs in Worten', () => {
		// Wirkung hat, was im Protokoll steht (Fachprüfung Runde 3, F-6).
		const t = text({
			satz: null,
			zahlen: null,
			durchgang: null,
			frueherenDurchgaenge: 0,
			neuabstimmungOffen: { nummer: 1, begruendung: 'Frage falsch gestellt', ergebnis: 'angenommen' }
		});
		expect(t).toContain(
			'- Zur Neuabstimmung kam es nicht mehr. Der 1. Durchgang hatte «angenommen» ergeben; ' +
				'die Zahlen ' +
				AUF_ANFRAGE
		);
	});

	it('verdrängt den Satz zum erfolglosen Rückkommen nicht', () => {
		// Durchgang 1 gilt, Rückkommen, 2 überholt, 3 ohne Beschluss: Die Anordnung
		// führte zu Durchgang 3, und der 1. gilt wegen des erfolglosen Rückkommens,
		// nicht nach ihrer Anordnung (Prüflauf 30.09.2026, tests/db/rueckkommen.test.ts).
		const t = text({
			durchgang: 1,
			frueherenDurchgaenge: 2,
			rueckkommenErfolglos: true,
			neuabstimmungen: [{ nummer: 2, begruendung: 'Stimmen doppelt erfasst', ergebnis: 'angenommen' }]
		});
		expect(t).toContain(
			'- Die Sitzungsleitung hat den 2. Durchgang überholt und eine Neuabstimmung angesetzt ' +
				'(Begründung: Stimmen doppelt erfasst). Er hatte «angenommen» ergeben; neu abgestimmt ' +
				'wurde im 3. Durchgang.'
		);
		expect(t).not.toContain('massgebend');
		expect(t).toContain('zurückgekommen und erneut abgestimmt; ein Beschluss kam dabei nicht zustande');
	});

	it('nennt den massgebenden, wenn alle Neuabstimmungen nach ihm liegen', () => {
		// 2 gilt, die Neuabstimmung betraf 3, danach 4 ohne Beschluss: Kein Satz
		// oben nennt den 2. (Codeprüfung 30.09.2026, M2).
		const t = text({
			durchgang: 2,
			frueherenDurchgaenge: 3,
			frueherenDurchRueckkommen: 1,
			rueckkommenErfolglos: true,
			neuabstimmungen: [{ nummer: 3, begruendung: 'Stimmen doppelt erfasst', ergebnis: 'angenommen' }]
		});
		expect(t).toContain('- 2. Durchgang.');
		expect(t).toContain('neu abgestimmt wurde im 4. Durchgang.');
		expect(t).toContain('- Weitere frühere Durchgänge sind hier nicht einzeln aufgeführt');
	});

	it('sagt nicht «bleibt in Kraft», wenn ein späteres Rückkommen den Beschluss ersetzt hat', () => {
		// D1 angenommen, Rückkommen, D2 ohne Beschluss (D1 bleibt), zweites
		// Rückkommen, D3 lehnt ab und ersetzt D1 (Codeprüfung 30.09.2026, M1).
		const t = text({
			satz: 'Abgelehnt.',
			durchgang: 3,
			frueherenDurchgaenge: 2,
			frueherenDurchRueckkommen: 1,
			rueckkommenErfolglos: true,
			ersetztNachRueckkommen: [{ nummer: 1, ergebnis: 'angenommen' }]
		});
		expect(t).toContain('- 3. Durchgang.');
		expect(t).toContain('Der Beschluss aus dem 1. Durchgang («angenommen») ist damit ersetzt');
		expect(t).not.toContain('bleibt in Kraft');
		expect(t).toContain('- Weitere frühere Durchgänge sind hier nicht einzeln aufgeführt');
	});

	it('nennt ohne lesbares Ergebnis keinen «Beschluss»', () => {
		// Codeprüfung 30.09.2026, M3.
		const t = text({
			durchgang: 2,
			frueherenDurchgaenge: 1,
			frueherenDurchRueckkommen: 1,
			ersetztNachRueckkommen: [{ nummer: 1, ergebnis: null }]
		});
		expect(t).toContain('- Auf dieses Traktandum wurde zurückgekommen und erneut abgestimmt. Der 1. Durchgang gilt damit nicht mehr;');
	});

	it('nennt den Folgeantrag, der den Durchgang ersetzt hat (Produktentscheid 08.10.2026)', () => {
		/*
		 * Der Randfall G1, F1, G2: Der erste Durchgang am Grundantrag wurde durch
		 * den Folgeantrag ersetzt, nicht durch die erneute Abstimmung am
		 * Grundantrag. Der Folgeantrag ist der Ersetzer, ohne das «damit», das
		 * beide Lesarten offen hielte (Laien- und Fachprüfung 09.10.2026).
		 */
		const t = text({
			durchgang: 2,
			frueherenDurchgaenge: 1,
			frueherenDurchRueckkommen: 1,
			ersetztNachRueckkommen: [{ nummer: 1, ergebnis: 'angenommen', folgeantrag: '9.2' }]
		});
		expect(t).toContain(
			'Der Beschluss aus dem 1. Durchgang («angenommen») ist durch den Folgeantrag zu Traktandum 9.2 ersetzt'
		);
		expect(t).not.toContain('ist damit ersetzt');
	});

	it('nennt keinen Folgeantrag, wenn die erneute Abstimmung am selben Traktandum ersetzt hat', () => {
		const t = text({
			durchgang: 2,
			frueherenDurchgaenge: 1,
			frueherenDurchRueckkommen: 1,
			ersetztNachRueckkommen: [{ nummer: 1, ergebnis: 'abgelehnt', folgeantrag: null }]
		});
		expect(t).toContain('ist damit ersetzt;');
		expect(t).not.toContain('durch den Folgeantrag');
	});

	it('ändert nichts, wo es keine Neuabstimmung gab', () => {
		const t = text({ durchgang: 1, frueherenDurchgaenge: 0 });
		expect(t).not.toContain('Neuabstimmung');
		expect(t).not.toContain('1. Durchgang.');
	});
});
