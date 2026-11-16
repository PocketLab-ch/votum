import { describe, expect, it } from 'vitest';
import {
	VERKNUEPFUNGSFENSTER_TAGE,
	darfErstverknuepfen,
	fensterEnde,
	istAdresse,
	darfVerknuepfungLoesen,
	nachgezogeneAngaben,
	normalisiereEmail,
	verknuepfungsstand,
	type Kontolage
} from '../../src/lib/domain/kontoverknuepfung';

/**
 * Die Regel, die entscheidet, wer sich beim ersten Mal an ein Konto binden darf.
 *
 * **Warum sie so genau geprüft wird.** Sie ist die einzige Stelle, an der ein
 * Konto über ein Merkmal erreichbar ist, das die anfragende Person in Authentik
 * selbst setzen kann. Jeder Zweig, der hier versehentlich `erlaubt` sagt, ist
 * eine Übernahme eines fremden Kontos samt seiner Rolle.
 */

const JETZT = new Date('2026-09-15T12:00:00Z');
const MORGEN = new Date('2026-09-16T12:00:00Z');
const GESTERN = new Date('2026-09-14T12:00:00Z');

/** Der Regelfall: Adresse da, Fenster läuft, Konto in Dienst. */
const OFFEN: Kontolage = {
	hatKennung: false,
	email: 'anna.meier@example.ch',
	offenBis: MORGEN,
	ausserDienst: false
};

describe('verknuepfungsstand', () => {
	it('nennt ein verknüpftes Konto verknüpft, auch bei offenem Fenster', () => {
		// Das Fenster steht hier offen und ist trotzdem bedeutungslos: Gefunden
		// wird über die Kennung, der Weg über die Adresse wird nie betreten.
		expect(verknuepfungsstand({ ...OFFEN, hatKennung: true }, JETZT)).toBe('verknuepft');
	});

	it('nennt ein Konto ohne Adresse «ohne_adresse»', () => {
		expect(verknuepfungsstand({ ...OFFEN, email: null }, JETZT)).toBe('ohne_adresse');
	});

	it('nennt ein nie geöffnetes Fenster «zu»', () => {
		expect(verknuepfungsstand({ ...OFFEN, offenBis: null }, JETZT)).toBe('zu');
	});

	it('nennt ein laufendes Fenster «offen»', () => {
		expect(verknuepfungsstand(OFFEN, JETZT)).toBe('offen');
	});

	it('nennt ein vergangenes Fenster «abgelaufen»', () => {
		expect(verknuepfungsstand({ ...OFFEN, offenBis: GESTERN }, JETZT)).toBe('abgelaufen');
	});

	it('zählt den Ablaufzeitpunkt selbst schon als abgelaufen', () => {
		// Die Grenze gehört der geschlossenen Seite. Andersherum wäre sie eine
		// Sekunde lang zweideutig, und diese Sekunde stünde in keinem Test.
		expect(verknuepfungsstand({ ...OFFEN, offenBis: JETZT }, JETZT)).toBe('abgelaufen');
	});
});

describe('darfErstverknuepfen', () => {
	it('erlaubt den Regelfall', () => {
		expect(darfErstverknuepfen(OFFEN, JETZT)).toEqual({ erlaubt: true });
	});

	it('weist ein Konto ausser Dienst ab, auch bei offenem Fenster', () => {
		// **Der wichtigste Zweig.** Ausserdienststellen ist der Griff, mit dem
		// jemand ausgesperrt wird. Griffe ein offenes Fenster daran vorbei, wäre
		// das Aussperren eine Empfehlung statt einer Schranke.
		expect(darfErstverknuepfen({ ...OFFEN, ausserDienst: true }, JETZT)).toEqual({
			erlaubt: false,
			hindernis: 'ausser_dienst'
		});
	});

	it('weist ab, wenn das Fenster abgelaufen ist', () => {
		expect(darfErstverknuepfen({ ...OFFEN, offenBis: GESTERN }, JETZT)).toEqual({
			erlaubt: false,
			hindernis: 'fenster_abgelaufen'
		});
	});

	it('weist ab, wenn nie ein Fenster geöffnet wurde', () => {
		expect(darfErstverknuepfen({ ...OFFEN, offenBis: null }, JETZT)).toEqual({
			erlaubt: false,
			hindernis: 'kein_fenster'
		});
	});

	it('weist ab, wenn keine Adresse hinterlegt ist', () => {
		expect(darfErstverknuepfen({ ...OFFEN, email: null }, JETZT)).toEqual({
			erlaubt: false,
			hindernis: 'ohne_adresse'
		});
	});

	it('weist ein bereits verknüpftes Konto ab', () => {
		expect(darfErstverknuepfen({ ...OFFEN, hatKennung: true }, JETZT)).toEqual({
			erlaubt: false,
			hindernis: 'schon_verknuepft'
		});
	});

	/**
	 * **Die Gegenprobe zur Vollständigkeit.**
	 *
	 * Ein Zweig, der versehentlich `erlaubt` sagt, ist hier kein Schönheitsfehler,
	 * sondern eine Kontoübernahme. Deshalb wird nicht bloss geprüft, dass die
	 * bekannten Fälle richtig antworten, sondern dass über allen Kombinationen
	 * genau eine erlaubt ist: die, in der jede Bedingung stimmt.
	 */
	it('erlaubt über alle Kombinationen hinweg nur den einen richtigen Fall', () => {
		const werte = {
			hatKennung: [true, false],
			email: ['anna.meier@example.ch', null],
			offenBis: [MORGEN, GESTERN, null],
			ausserDienst: [true, false]
		};

		const erlaubte: Kontolage[] = [];
		for (const hatKennung of werte.hatKennung) {
			for (const email of werte.email) {
				for (const offenBis of werte.offenBis) {
					for (const ausserDienst of werte.ausserDienst) {
						const lage = { hatKennung, email, offenBis, ausserDienst };
						if (darfErstverknuepfen(lage, JETZT).erlaubt) erlaubte.push(lage);
					}
				}
			}
		}

		expect(erlaubte).toEqual([
			{ hatKennung: false, email: 'anna.meier@example.ch', offenBis: MORGEN, ausserDienst: false }
		]);
	});
});

describe('fensterEnde', () => {
	it('liegt die vereinbarte Zahl Tage später', () => {
		const ende = fensterEnde(JETZT);
		const tage = (ende.getTime() - JETZT.getTime()) / (24 * 60 * 60 * 1000);
		expect(tage).toBe(VERKNUEPFUNGSFENSTER_TAGE);
	});

	it('gilt zum eigenen Endzeitpunkt bereits als abgelaufen', () => {
		// Die beiden Funktionen müssen dieselbe Grenze meinen. Wäre `fensterEnde`
		// exklusiv gedacht und `verknuepfungsstand` inklusiv, fehlte oder käme ein
		// Tag dazu, und niemand sähe es an einer der beiden Stellen allein.
		const ende = fensterEnde(JETZT);
		expect(verknuepfungsstand({ ...OFFEN, offenBis: ende }, ende)).toBe('abgelaufen');
		expect(verknuepfungsstand({ ...OFFEN, offenBis: ende }, new Date(ende.getTime() - 1))).toBe(
			'offen'
		);
	});
});

describe('normalisiereEmail', () => {
	it('macht aus Rand und Grossschreibung dieselbe Adresse', () => {
		expect(normalisiereEmail('  Anna.Meier@Example.CH ')).toBe('anna.meier@example.ch');
	});
});

describe('istAdresse', () => {
	it('nimmt gewöhnliche Adressen an', () => {
		for (const gut of [
			'anna.meier@example.ch',
			'a@example.co',
			'vorname+ablage@teil.example.com',
			'  Anna@Example.ch  '
		]) {
			expect(istAdresse(gut), gut).toBe(true);
		}
	});

	it('weist ab, was als Anker nie treffen würde', () => {
		for (const schlecht of [
			'anna.meier', // der Benutzername, der hier früher stand
			'anna@meier', // kein Punkt hinten
			'@example.ch', // nichts davor
			'anna@@example.ch',
			'anna meier@example.ch',
			'anna@.example.ch', // Punkt am Rand
			'anna@example.',
			'',
			'+41 79 000 00 00'
		]) {
			expect(istAdresse(schlecht), schlecht).toBe(false);
		}
	});
});

describe('nachgezogeneAngaben', () => {
	const BISHER = { displayName: 'Anna Meier', email: 'anna.meier@example.ch' };

	it('übernimmt, was Authentik führt', () => {
		expect(
			nachgezogeneAngaben({ anzeigename: 'Anna Berger', email: 'Anna.Berger@Example.CH' }, BISHER)
		).toEqual({ displayName: 'Anna Berger', email: 'anna.berger@example.ch' });
	});

	it('lässt einen leeren Namen den vorhandenen NICHT überschreiben', () => {
		// Sonst stünde danach in Verlauf und Protokoll eine Handlung ohne Person.
		for (const leer of ['', '   ', 'A']) {
			expect(nachgezogeneAngaben({ anzeigename: leer, email: null }, BISHER).displayName).toBe(
				'Anna Meier'
			);
		}
	});

	it('zählt Zeichen, nicht Einheiten', () => {
		// Ein Bildzeichen ist ein Zeichen, aber zwei UTF-16-Einheiten. Mit
		// `.length` käme es an der Schranke «mindestens zwei» vorbei.
		expect(nachgezogeneAngaben({ anzeigename: '😀', email: null }, BISHER).displayName).toBe(
			'Anna Meier'
		);
	});

	it('übernimmt nur, was eine Adresse ist', () => {
		for (const nicht of ['', 'anna.meier', 'irgendwas']) {
			expect(nachgezogeneAngaben({ anzeigename: 'Anna Meier', email: nicht }, BISHER).email).toBe(
				'anna.meier@example.ch'
			);
		}
	});

	it('lässt die Adresse stehen, wenn Authentik keine liefert', () => {
		expect(nachgezogeneAngaben({ anzeigename: 'Anna Meier', email: null }, BISHER).email).toBe(
			'anna.meier@example.ch'
		);
	});
});

describe('darfVerknuepfungLoesen', () => {
	const IM_DIENST = { hatKennung: true, hatKennwort: true, ausserDienst: false };

	it('erlaubt das Lösen, wenn ein Kennwort als Rückweg bleibt', () => {
		expect(darfVerknuepfungLoesen(IM_DIENST)).toEqual({ erlaubt: true });
	});

	/**
	 * **Der Zweig, um den es geht.** Ein Konto kennt zwei Wege herein. Wer die
	 * Kennung eines Kontos löst, das kein Kennwort hat, macht es unerreichbar —
	 * nicht gesperrt, sondern tot. Solche Konten gibt es absichtlich; sie tragen
	 * in der Liste die Marke «nur zentrale Anmeldung».
	 */
	it('verweigert das Lösen, wenn kein Kennwort hinterlegt ist', () => {
		expect(darfVerknuepfungLoesen({ ...IM_DIENST, hatKennwort: false })).toEqual({
			erlaubt: false,
			hindernis: 'ohne_kennwort'
		});
	});

	/**
	 * **Und genau dann nicht, wenn das Konto ohnehin still steht** (Code-Review
	 * 16.09.2026). Sonst bliebe die Kennung für immer an einer toten Zeile — und
	 * weil sie über alle Betreiber eindeutig ist, bekäme dieser Mensch nie wieder
	 * ein verknüpftes Konto. Die Absage empfahl selbst das Ausserdienststellen;
	 * wer ihr folgte, sass danach in der Sackgasse, die sie vermeiden wollte.
	 */
	it('erlaubt es bei einem Konto ausser Dienst auch ohne Kennwort', () => {
		expect(
			darfVerknuepfungLoesen({ hatKennung: true, hatKennwort: false, ausserDienst: true })
		).toEqual({ erlaubt: true });
	});

	it('weist ab, wo es nichts zu lösen gibt', () => {
		expect(darfVerknuepfungLoesen({ ...IM_DIENST, hatKennung: false })).toEqual({
			erlaubt: false,
			hindernis: 'nicht_verknuepft'
		});
	});

	it('erlaubt über alle Kombinationen hinweg genau die richtigen Fälle', () => {
		const erlaubte = [];
		for (const hatKennung of [true, false]) {
			for (const hatKennwort of [true, false]) {
				for (const ausserDienst of [true, false]) {
					const lage = { hatKennung, hatKennwort, ausserDienst };
					if (darfVerknuepfungLoesen(lage).erlaubt) erlaubte.push(lage);
				}
			}
		}
		// Gelöst werden darf, was eine Kennung trägt — sofern ein Kennwort bleibt
		// oder das Konto ohnehin still steht.
		expect(erlaubte).toEqual([
			{ hatKennung: true, hatKennwort: true, ausserDienst: true },
			{ hatKennung: true, hatKennwort: true, ausserDienst: false },
			{ hatKennung: true, hatKennwort: false, ausserDienst: true }
		]);
	});
});
