/**
 * Was die KI darf und was nicht (Welle 3, FR-58 bis FR-63).
 *
 * Der Prüfstand kreist um zwei Zusagen: **Ohne Zulassung geschieht nichts**,
 * und **was ein Modell antwortet, wird nicht ungeprüft übernommen**.
 */
import { describe, expect, it } from 'vitest';
import {
	HERKUNFTSHINWEIS,
	KI_FUNKTIONEN,
	lesbareBefunde,
	maschinenvermerk,
	modellherkunft,
	verfuegbarkeit,
	verlangeEntscheid,
	type Kilage
} from '$lib/domain/ki';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

const BEREIT: Kilage = {
	eingerichtet: true,
	zugelassen: true,
	offline: false,
	ausgenommen: []
};

describe('Ob die KI benutzt werden darf', () => {
	it('lässt sie zu, wenn alles steht', () => {
		expect(verfuegbarkeit(BEREIT, 'traktandenpruefung').verfuegbar).toBe(true);
	});

	it('schaltet sie ohne Netz sichtbar ab statt fehlerhaft', () => {
		// Wer im Versammlungsraum ohne Netz auf einen Knopf drückt und eine
		// Fehlermeldung bekommt, hält die Anwendung für kaputt.
		const b = verfuegbarkeit({ ...BEREIT, offline: true }, 'traktandenpruefung');
		expect(b.verfuegbar).toBe(false);
		expect(b.grund).toMatch(/ohne Netz/);
		expect(b.grund).toMatch(/alles andere geht weiter/);
	});

	it('sagt es, wenn gar kein Modell eingerichtet ist', () => {
		const b = verfuegbarkeit({ ...BEREIT, eingerichtet: false }, 'traktandenpruefung');
		expect(b.verfuegbar).toBe(false);
		expect(b.grund).toMatch(/kein Modell eingerichtet/);
		// Und dass die Anwendung ohne KI vollständig benutzbar bleibt (FR-62).
		expect(b.grund).toMatch(/ohne KI vollständig benutzbar/);
	});

	it('verlangt die Zulassung der Gemeinschaft', () => {
		// Es werden Inhalte an ein Modell übermittelt; wer das will, schaltet es
		// bewusst ein.
		const b = verfuegbarkeit({ ...BEREIT, zugelassen: false }, 'protokollentwurf');
		expect(b.verfuegbar).toBe(false);
		expect(b.grund).toMatch(/nicht zugelassen/);
	});

	it('lässt einzelne Funktionen ausnehmen', () => {
		// Eine Gemeinschaft kann die Traktandenprüfung wollen und den
		// Protokollentwurf nicht.
		const lage = { ...BEREIT, ausgenommen: ['protokollentwurf'] };
		expect(verfuegbarkeit(lage, 'protokollentwurf').verfuegbar).toBe(false);
		expect(verfuegbarkeit(lage, 'traktandenpruefung').verfuegbar).toBe(true);
	});
});

describe('Was ein Modell antwortet', () => {
	it('kommt nur durch, wenn es vollständig ist', () => {
		/*
		 * Die Antwort kommt aus einem fremden Haus und ist keine Zusage. Ein
		 * Befund ohne Vorschlag wäre für die Sitzungsleitung wertlos
		 * («irgendetwas stimmt nicht»), ein unbekannter Schweregrad brächte die
		 * Sortierung durcheinander.
		 */
		const befunde = lesbareBefunde({
			befunde: [
				{ schwere: 'hoch', was: 'Betrag fehlt', vorschlag: 'Betrag nennen' },
				{ schwere: 'hoch', was: 'Ohne Vorschlag' },
				{ schwere: 'dringend', was: 'Unbekannter Grad', vorschlag: 'irgendetwas' },
				{ was: 'Ohne Grad', vorschlag: 'irgendetwas' },
				'kein Objekt',
				{ schwere: 'tief', was: 'Titel knapp', vorschlag: 'Titel ergänzen' }
			]
		});
		expect(befunde.map((b) => b.was)).toEqual(['Betrag fehlt', 'Titel knapp']);
	});

	it('stellt das Schwerste nach oben', () => {
		// Wer im Saal drei Zeilen liest, soll die richtigen lesen.
		const befunde = lesbareBefunde({
			befunde: [
				{ schwere: 'tief', was: 'Titel knapp', vorschlag: 'Titel ergänzen' },
				{ schwere: 'hoch', was: 'Betrag fehlt', vorschlag: 'Betrag nennen' },
				{ schwere: 'mittel', was: 'Zuständigkeit offen', vorschlag: 'Zuständige nennen' }
			]
		});
		expect(befunde.map((b) => b.was)).toEqual([
			'Betrag fehlt',
			'Zuständigkeit offen',
			'Titel knapp'
		]);
	});

	it('nimmt auch eine blosse Liste entgegen', () => {
		// Modelle halten sich nicht immer an die verlangte Hülle.
		expect(
			lesbareBefunde([{ schwere: 'hoch', was: 'Betrag fehlt', vorschlag: 'Betrag nennen' }])
		).toHaveLength(1);
	});

	it('macht aus Unsinn eine leere Liste statt eines Absturzes', () => {
		expect(lesbareBefunde(null)).toEqual([]);
		expect(lesbareBefunde('Guten Tag!')).toEqual([]);
		expect(lesbareBefunde({ etwas: 'anderes' })).toEqual([]);
	});
});

describe('Der Entscheid der Sitzungsleitung', () => {
	it('kennt genau drei Möglichkeiten', () => {
		expect(verlangeEntscheid('angenommen')).toBe('angenommen');
		expect(verlangeEntscheid('abgelehnt')).toBe('abgelehnt');
		expect(verlangeEntscheid('veraendert')).toBe('veraendert');
		expect(() => verlangeEntscheid('vielleicht')).toThrow(FachlicherFehler);
	});
});

describe('Der Vermerk im Protokoll', () => {
	it('nennt das Haus und den Menschen, der es verantwortet', () => {
		// Rechtlich nicht zwingend, aber ehrlich — und im Streitfall entlastend.
		const satz = maschinenvermerk('Infomaniak (CH)', 'M. Probère');
		expect(satz).toMatch(/maschinell vorbereitet \(Infomaniak \(CH\)\)/);
		expect(satz).toMatch(/M. Probère/);
		expect(satz).toMatch(/verantwortet/);
	});
});

describe('Die Herkunftsangabe an einer Modellantwort (Audit B-09)', () => {
	it('nennt die Stufe, die geantwortet hat', () => {
		// Ohne Namen wäre es eine Verzierung. Mit Namen lässt sich hinterher
		// sagen, wer diesen Satz geschrieben hat.
		expect(modellherkunft('Infomaniak (CH)')).toBe('Antwort von Infomaniak (CH)');
	});

	it('bleibt stehen, wenn die Stufe keinen Namen hat', () => {
		// Ein Kasten ohne Beschriftung wäre schlimmer als eine unscharfe: Das
		// Entscheidende ist «das hat kein Mensch geschrieben».
		for (const ohne of [null, undefined, '', '   ']) {
			expect(modellherkunft(ohne)).toBe('Antwort von einem unbenannten Modell');
		}
	});

	it('sagt, dass der geprüfte Text mitbestimmt, was zurückkommt', () => {
		/*
		 * **Der Kern des Befunds.** Ein Traktandum darf von einem Eigentümer
		 * stammen; ein Satz darin kann sich an die Maschine richten und als Befund
		 * zurückkommen — im Ton der Anwendung. Der Hinweis muss beides benennen:
		 * die Herkunft aus dem geprüften Text **und** dass am Ende ein Mensch
		 * entscheidet.
		 */
		expect(HERKUNFTSHINWEIS).toMatch(/Sprachmodell/);
		expect(HERKUNFTSHINWEIS).toMatch(/aus dem geprüften Text/);
		expect(HERKUNFTSHINWEIS).toMatch(/Sie entscheiden, nicht das Werkzeug/);
	});

	it('beschwichtigt nicht', () => {
		// «In seltenen Fällen» oder «unter Umständen» macht aus einer Warnung eine
		// Fussnote. Wer das liest, liest den nächsten Befund wieder unbesehen.
		expect(HERKUNFTSHINWEIS).not.toMatch(/selten|unter Umständen|möglicherweise|in der Regel/i);
	});
});

describe('Der Anzeigeschalter nimmt die Kennzeichnung nicht mit (Abnahme zu B-09)', () => {
	it('bleibt sichtbar, solange die Funktion läuft', () => {
		/*
		 * **Die schlimmste Kombination wäre: Funktion läuft, Kennzeichnung weg.**
		 * Der Schalter beim Betreiber blendet die KI-Hinweise aus (Migration 053).
		 * Nähme er auch die Herkunftsangabe mit, stünde ein Befund ohne jeden
		 * Hinweis darauf da, dass ihn kein Mensch geschrieben hat — und zwar bei
		 * demjenigen, der die KI am wenigsten will.
		 *
		 * Die Zusage steht als eine Zeile in `verfuegbarkeit()` und war bis zur
		 * Abnahme am 08.08.2026 von keinem Prüfstand gedeckt.
		 */
		const laeuft: Kilage = { ...BEREIT, hinweiseAusblenden: true };
		for (const f of KI_FUNKTIONEN) {
			const v = verfuegbarkeit(laeuft, f);
			expect(v.verfuegbar).toBe(true);
			expect(v.anzeigen).toBe(true);
		}
	});

	it('blendet nur aus, was ohnehin nicht läuft', () => {
		const aus: Kilage = { ...BEREIT, zugelassen: false, hinweiseAusblenden: true };
		const v = verfuegbarkeit(aus, KI_FUNKTIONEN[0]);
		expect(v.verfuegbar).toBe(false);
		expect(v.anzeigen).toBe(false);
	});
});
