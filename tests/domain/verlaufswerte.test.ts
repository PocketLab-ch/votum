/**
 * Die Codewörter des Verlaufs in Worten (V1, 06.10.2026).
 *
 * **Was hier steht:** je Schlüssel, dass das gespeicherte Codewort in den
 * Wortlaut der bestehenden Tabelle übergeht, dass ein Wert ohne Wortlaut so
 * stehen bleibt, wie er gespeichert ist, und dass Schlüssel mit mehreren
 * Bedeutungen (`art`, `weg`, `vorher`, `nachher`) nur bei der Ereignisart
 * übersetzt werden, zu der der Wortlaut gehört.
 *
 * **Was hier nicht steht:** ob die Verlaufsseite die Übersetzung tatsächlich
 * hereinreicht. Das ist am 06.10.2026 im Browser nachgemessen
 * (`?bereich=stweg`: 94 Rohwerte vorher, 0 nachher), nicht als Probe
 * festgehalten. Das Verlaufsblatt im Siegelpaket reicht sie seit dem
 * 08.10.2026 ebenfalls herein; der Weg dahin ist in `tests/db/siegel.test.ts`
 * belegt.
 */
import { describe, expect, it } from 'vitest';
import {
	EREIGNISARTEN,
	GEGENSTANDSARTEN,
	angabenInWorten,
	gegenstandsart
} from '../../src/lib/domain/verlauf';
import { typnamenAus, wertwoerter, type Typnamen } from '../../src/lib/domain/verlaufswerte';
import { WEGNAMEN } from '../../src/lib/domain/anwesenheit';
import { UNIVERSALVARIANTE_TEXT } from '../../src/lib/domain/ausnahmen';
import { KI_FUNKTIONSNAMEN } from '../../src/lib/domain/ki';
import { VERTRETUNGSGRUND_TEXT } from '../../src/lib/domain/vollmacht';
import { FESTE_TRAKTANDEN } from '../../src/lib/domain/traktandenvorlage';
import { FASSUNGEN, holeRegelwerk } from '../../src/lib/rules';

/** Die Angaben eines Eintrags der Art `art`, wie die Verlaufsseite sie zeigt. */
function zeile(art: string, angaben: Record<string, unknown>, typnamen?: Typnamen): string {
	return angabenInWorten(angaben, undefined, wertwoerter(art, typnamen));
}

describe('Die Codewörter in Worten, je Schlüssel', () => {
	it('zaehlweise und grundlage: die Gemeinschaft beim Anlegen', () => {
		expect(
			zeile(EREIGNISARTEN.gemeinschaftAngelegt, {
				zaehlweise: 'per_owner',
				grundlage: 'gesetzliche_auffangregel'
			})
		).toBe(
			'Zählweise: eine Kopfstimme je Eigentümer · Grundlage: Gesetz (keine abweichende Reglementsregel hinterlegt)'
		);
		expect(
			zeile(EREIGNISARTEN.gemeinschaftAngelegt, { zaehlweise: 'per_unit', grundlage: 'reglement' })
		).toBe('Zählweise: eine Kopfstimme je Einheit · Grundlage: Reglement');
	});

	it('grundlage: ein Freitext bleibt, wie er erfasst wurde', () => {
		// Bei der Vertretung ist `grundlage` Freitext (server/vertretung.ts).
		expect(zeile(EREIGNISARTEN.vertreterBezeichnet, { grundlage: 'Beistandschaft' })).toBe(
			'Grundlage: Beistandschaft'
		);
	});

	it('frist: nächste Versammlung und ohne Termin, «datum» bleibt neben dem Datum', () => {
		expect(zeile(EREIGNISARTEN.pendenzErfasst, { frist: 'naechste_versammlung' })).toBe(
			'Frist: bis zur nächsten Versammlung'
		);
		expect(zeile(EREIGNISARTEN.pendenzErfasst, { frist: 'keine' })).toBe('Frist: ohne Termin');
		expect(
			zeile(EREIGNISARTEN.pendenzErfasst, { frist: 'datum', fristDatum: '2026-12-01' })
		).toBe('Frist: datum · Zu erledigen bis: 2026-12-01');
	});

	it('nachweis und art: das vorgelegte Original, «datei» mit eigenem Wortlaut', () => {
		expect(zeile(EREIGNISARTEN.vollmachtBestaetigt, { nachweis: 'original_vorgelegt' })).toBe(
			'Nachweis: Original vorgelegt'
		);
		expect(zeile(EREIGNISARTEN.vollmachtBestaetigt, { nachweis: 'datei' })).toBe(
			'Nachweis: hinterlegte Datei oder elektronische Erklärung, kein vorgelegtes Original vermerkt'
		);
		expect(zeile(EREIGNISARTEN.vollmachtNachweisNachgereicht, { art: 'original_vorgelegt' })).toBe(
			'Art: Original vorgelegt'
		);
	});

	it('art: nur bei der Ereignisart übersetzt, zu der der Wortlaut gehört', () => {
		// Bei der Partei heisst `art` die Personenart; dafür gibt es seit der
		// Wortliste (08.10.2026) einen Wortlaut.
		expect(zeile(EREIGNISARTEN.eigentuemerAngelegt, { art: 'natural' })).toBe(
			'Art: natürliche Person'
		);
		// Ein Wert, der zur Personenart nicht gehört, bleibt roh.
		expect(zeile(EREIGNISARTEN.eigentuemerAngelegt, { art: 'original_vorgelegt' })).toBe(
			'Art: original_vorgelegt'
		);
	});

	it('typ, gewaehlt, vorschlag: die Bezeichnung aus dem Regelwerk, ohne sie roh', () => {
		const typnamen = typnamenAus(holeRegelwerk());
		expect(zeile(EREIGNISARTEN.erfordernisGesetzt, { typ: 'qualifiziertes_mehr' }, typnamen)).toBe(
			'Typ: Qualifiziertes Mehr'
		);
		expect(
			zeile(
				EREIGNISARTEN.erfordernisUebersteuert,
				{ gewaehlt: 'einfaches_mehr', vorschlag: 'einstimmigkeit' },
				typnamen
			)
		).toBe('Gewählt: Einfaches Mehr · Vorschlag: Einstimmigkeit');
		expect(zeile(EREIGNISARTEN.erfordernisGesetzt, { typ: 'qualifiziertes_mehr' })).toBe(
			'Typ: qualifiziertes_mehr'
		);
	});

	it('kopfart, kopfbasis, quotenbasis: die Reglementsregel', () => {
		expect(
			zeile(EREIGNISARTEN.reglementsregelHinterlegt, {
				kopfart: 'mehr_als',
				kopfbasis: 'alle_ausser_betroffene'
			})
		).toBe(
			'Art des Kopfmehrs: mehr als · Basis der Kopfstimmen: alle Eigentümer, auch die abwesenden, ' +
				'ausser den beim Traktandum als betroffen eingetragenen'
		);
		expect(zeile(EREIGNISARTEN.reglementsregelHinterlegt, { kopfart: 'mindestens' })).toBe(
			'Art des Kopfmehrs: mindestens'
		);
		expect(zeile(EREIGNISARTEN.erfordernisGesetzt, { quotenbasis: 'alle_quoten' })).toBe(
			'Basis der Wertquoten: alle Wertquoten, auch die der abwesenden Eigentümer'
		);
	});

	it('geschaeftsart und antragsteller, auch verschachtelt unter felder', () => {
		expect(
			zeile(EREIGNISARTEN.reglementsregelHinterlegt, { geschaeftsart: 'baulich_luxurioes' })
		).toBe('Geschäftsart: Luxuriöse bauliche Massnahmen');
		expect(zeile(EREIGNISARTEN.traktandumAngelegt, { antragsteller: 'mehrere_eigentuemer' })).toBe(
			'Antragsteller: Mehrere Eigentümer gemeinsam'
		);
		// `vorher` und `nachher` unter einem Feld nehmen den Schlüssel darüber.
		expect(
			zeile(EREIGNISARTEN.traktandumGeaendert, {
				felder: { antragstellerart: { vorher: 'bewirtschaftung', nachher: 'gemeinschaft' } }
			})
		).toBe(
			'Felder: (Art des Antragstellers: (Vorher: Die Bewirtschaftung, Nachher: Die Gemeinschaft))'
		);
	});

	it('betriebsart: Klartext mit dem Fachwort, oben und in vorher/nachher', () => {
		expect(zeile(EREIGNISARTEN.versammlungAngelegt, { betriebsart: 'gefuehrt' })).toBe(
			'Betriebsart: Am eigenen Handy (geführt)'
		);
		expect(
			zeile(EREIGNISARTEN.betriebsartGewechselt, { vorher: 'einfach', nachher: 'gefuehrt' })
		).toBe('Vorher: Auf Papier (einfach) · Nachher: Am eigenen Handy (geführt)');
		expect(
			zeile(EREIGNISARTEN.versammlungGeaendert, {
				felder: { betriebsart: { vorher: 'einfach', nachher: 'gefuehrt' } }
			})
		).toBe('Felder: (Betriebsart: (Vorher: Auf Papier (einfach), Nachher: Am eigenen Handy (geführt)))');
	});

	it('vorher/nachher: ohne Wortlaut für die Ereignisart bleibt der Wert', () => {
		// Ein Titel, der zufällig wie ein Codewort aussieht, bleibt ein Titel.
		expect(zeile(EREIGNISARTEN.traktandumGeaendert, { vorher: 'einfach', nachher: 'frei' })).toBe(
			'Vorher: einfach · Nachher: frei'
		);
	});

	it('universalvariante, funktion, vertretungsgrund: die Tabellen der Fachmodule', () => {
		expect(zeile(EREIGNISARTEN.reglementsregelHinterlegt, { universalvariante: 'persoenlich' })).toBe(
			`Variante der Universalversammlung: ${UNIVERSALVARIANTE_TEXT.persoenlich}`
		);
		expect(zeile(EREIGNISARTEN.kiEntscheid, { funktion: 'erfordernisvorschlag' })).toBe(
			`Funktion: ${KI_FUNKTIONSNAMEN.erfordernisvorschlag}`
		);
		expect(zeile(EREIGNISARTEN.vollmachtErfasst, { vertretungsgrund: 'organ' })).toBe(
			`Vertretungsgrund: ${VERTRETUNGSGRUND_TEXT.organ}`
		);
	});

	it('quelle und vorschlagQuelle: die Herkunft des Erfordernisses, die Zeitquelle ebenso', () => {
		// `erfordernisUebersteuert` trägt die Quelle des Vorschlags unter
		// `vorschlagQuelle`; ein `quelle` daneben bliebe roh, keine Schreibstelle
		// setzt es. « · » trennt die Angaben, damit ein Komma im Wort
		// («von Hand gewählt, nicht hergeleitet») keine Grenze vortäuscht.
		const uebersteuert = zeile(EREIGNISARTEN.erfordernisUebersteuert, {
			quelle: 'gewaehlt',
			vorschlagQuelle: 'gewaehlt'
		});
		expect(uebersteuert).toBe(
			'Quelle: gewaehlt · Quelle des Vorschlags: von Hand gewählt, nicht hergeleitet'
		);
		expect(uebersteuert).not.toContain('nicht hergeleitet, ');
		expect(
			zeile(EREIGNISARTEN.erfordernisUebersteuert, { vorschlagQuelle: 'hergeleitet' })
		).toBe('Quelle des Vorschlags: von der Anwendung aus den Angaben zum Geschäft hergeleitet');
		// `quelle: zeitquelle()` trägt «system»; die Zeitquelle der erzeugten
		// Unterlage ist «Systemuhr».
		expect(zeile(EREIGNISARTEN.ausfallunterlageGeholt, { quelle: 'system' })).toBe(
			'Quelle: Systemuhr'
		);
	});

	it('rolle und role: Verwaltung und Sitzungsleitung, auch beim Rollenwechsel', () => {
		expect(zeile(EREIGNISARTEN.kontoAngelegt, { rolle: 'chair' })).toBe('Rolle: Sitzungsleitung');
		expect(zeile(EREIGNISARTEN.kontoRolleGeaendert, { vorher: 'admin', nachher: 'chair' })).toBe(
			'Vorher: Verwaltung · Nachher: Sitzungsleitung'
		);
	});

	it('weg: der Erfassungsweg bei Anwesenheit und Papierabgabe, sonst roh', () => {
		expect(zeile(EREIGNISARTEN.anwesenheitBestaetigt, { weg: 'von_hand' })).toBe(
			`Weg: ${WEGNAMEN.von_hand}`
		);
		expect(zeile(EREIGNISARTEN.papierabgabeGesetzt, { weg: 'gescannt' })).toBe(
			`Weg: ${WEGNAMEN.gescannt}`
		);
		expect(zeile(EREIGNISARTEN.einladungVersandVermerkt, { weg: 'link' })).toBe(
			'Weg: Vermerk über den Link in der Erinnerung'
		);
	});

	it('herkunft der Weisung: ohne Beleg und die Auffangregel, je eigener Wortlaut', () => {
		// Produktentscheid 08.10.2026: Der Zugangsweg ohne Datei heisst im Paket
		// «ohne Beleg» (die Grundlage steht in der Bemerkung selbst), die von der
		// Anwendung gesetzte Weisung «nach der Auffangregel der Anwendung».
		expect(zeile(EREIGNISARTEN.weisungErfasst, { herkunft: 'erklaerung' })).toBe(
			'Herkunft: ohne Beleg'
		);
		expect(zeile(EREIGNISARTEN.weisungErfasst, { herkunft: 'auffangregel' })).toBe(
			'Herkunft: nach der Auffangregel der Anwendung'
		);
	});

	it('gegenstandArt, was, Wandbild, Pendenz, Vorlagen', () => {
		expect(zeile(EREIGNISARTEN.kiEntscheid, { gegenstandArt: 'agenda_item' })).toBe(
			'Gegenstandsart: Traktandum'
		);
		expect(zeile(EREIGNISARTEN.archiviert, { was: 'eigentuemer' })).toBe('Was: Eigentümerzeile');
		expect(
			zeile(EREIGNISARTEN.wandbildGesetzt, { vorher: 'traktanden', nachher: 'frei' })
		).toBe('Vorher: Traktandenliste · Nachher: Eigener Text');
		expect(
			zeile(EREIGNISARTEN.pendenzZustandGesetzt, { vorher: 'offen', nachher: 'hinfaellig' })
		).toBe('Vorher: offen · Nachher: hinfällig');
		const begruessung = FESTE_TRAKTANDEN.find((v) => v.schluessel === 'begruessung')!.titel;
		expect(
			zeile(EREIGNISARTEN.pflichttraktandenAngelegt, { schluessel: ['begruessung', 'gibtEsNicht'] })
		).toBe(`Schlüssel: ${begruessung}; gibtEsNicht`);
	});

	it('nimmt kein geerbtes Feld für ein Codewort', () => {
		// `constructor` steht in jedem Objekt; ohne `Object.hasOwn` käme eine
		// Funktion als Wort heraus.
		expect(zeile(EREIGNISARTEN.gemeinschaftAngelegt, { zaehlweise: 'constructor' })).toBe(
			'Zählweise: constructor'
		);
		expect(zeile('gibt.es.nicht', { weg: 'toString' })).toBe('Weg: toString');
	});

	it('lässt Kennungen weiter den Auflöser entscheiden', () => {
		const id = '01a0f6c1-2222-3333-4444-555566667777';
		expect(zeile(EREIGNISARTEN.traktandumAufgerufen, { vorher: null, nachher: id })).toBe(
			'Vorher: leer · Nachher: interne Kennung 01a0f6c1…'
		);
	});
});

describe('Die Bezeichnungen der Erfordernistypen', () => {
	it('sind in allen Fassungen gleich, also trägt die aktuelle auch alte Einträge', () => {
		const aktuell = typnamenAus(holeRegelwerk());
		for (const rw of Object.values(FASSUNGEN)) {
			for (const [typ, name] of Object.entries(typnamenAus(rw))) {
				expect(aktuell[typ], `${rw.fassung}: ${typ}`).toBe(name);
			}
		}
	});
});

describe('Die Gegenstandsarten', () => {
	it('stehen in Worten, eine unbekannte roh', () => {
		expect(gegenstandsart('app_user')).toBe('Konto');
		expect(gegenstandsart('meeting_day')).toBe('Gemeinsamer Abend');
		expect(gegenstandsart('gibt_es_nicht')).toBe('gibt_es_nicht');
		expect(gegenstandsart('constructor')).toBe('constructor');
		expect(Object.keys(GEGENSTANDSARTEN)).toHaveLength(13);
	});
});
