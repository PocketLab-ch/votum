/**
 * Das Verfahren hinter der Geräteregistrierung.
 *
 * **Warum unter `tests/domain`, obwohl die Datei in `server` liegt.** Sie
 * braucht weder Datenbank noch SvelteKit, nur `node:crypto` — und sie gehört zu
 * der Sorte Code, bei der ein stiller Fehler nicht auffällt: Ein Paket, das
 * sich mit jedem Schlüssel öffnen liesse, sähe im Betrieb genauso aus wie
 * eines, das richtig verschlüsselt ist. Deshalb stehen hier vor allem die
 * Gegenproben.
 */
import { describe, expect, it } from 'vitest';
import {
	alsGeraetecode,
	ausGeraetecode,
	erzeugeGeraeteschluessel,
	fingerabdruck,
	GeraetecodeFehler,
	oeffneAlsGeraet,
	PaketFehler,
	unterschreibe,
	unterschriftStimmt,
	verschluessleFuerGeraet
} from '$lib/server/saalgeraet';
import { fingerabdruckInGruppen } from '$lib/domain/abgabe';

const inhalt = new TextEncoder().encode('Die Traktandenliste der Versammlung vom 18.09.2026.');

/*
 * Die Marke steht hier noch einmal und wird nicht aus dem Modul geholt: Sie ist
 * das vereinbarte Format, an dem später ein zweites Gerät liest. Käme sie aus
 * derselben Quelle wie der Code, ginge eine stille Änderung des Formats durch,
 * ohne dass ein Test etwas dazu sagt.
 */
const MARKE = 'VOTUMG1';

describe('Gerätecode', () => {
	it('geht hin und zurück', () => {
		const paar = erzeugeGeraeteschluessel();
		const gelesen = ausGeraetecode(alsGeraetecode(paar));

		expect(gelesen.encPublic).toBe(paar.encPublic);
		expect(gelesen.sigPublic).toBe(paar.sigPublic);
		expect(gelesen.fingerabdruck).toBe(paar.fingerabdruck);
	});

	it('überliest Leerzeichen und Zeilenumbrüche aus dem Abtippen', () => {
		const paar = erzeugeGeraeteschluessel();
		const zerpflueckt = alsGeraetecode(paar).replace(/(.{20})/g, '$1\n  ');

		expect(ausGeraetecode(zerpflueckt).fingerabdruck).toBe(paar.fingerabdruck);
	});

	it('weist einen halben Code ab, statt ihn zu ergänzen', () => {
		const paar = erzeugeGeraeteschluessel();
		expect(() => ausGeraetecode(paar.encPublic)).toThrow(GeraetecodeFehler);
	});

	/*
	 * **Der vertauschte Code** (18.09.2026, aus der dritten Runde des
	 * Code-Reviews). Beide Teile sind für sich lesbare Schlüssel, nur in der
	 * falschen Reihenfolge. Eine Prüfung, die bloss «lässt sich lesen» fragt,
	 * nimmt ihn an — und er fällt erst beim ersten Paket auf, mit einem rohen
	 * Fehler aus Node und nachdem der ganze Export gelaufen ist.
	 */
	it('weist einen vertauschten Code ab, obwohl beide Teile lesbar sind', () => {
		const paar = erzeugeGeraeteschluessel();

		expect(() => ausGeraetecode(`${paar.sigPublic}.${paar.encPublic}`)).toThrow(
			/falschen Reihenfolge/
		);
	});

	it('weist etwas ab, das wie ein Code aussieht, aber keiner ist', () => {
		const falsch = `${'a'.repeat(48)}.${'b'.repeat(48)}`;
		expect(() => ausGeraetecode(falsch)).toThrow(GeraetecodeFehler);
	});

	it('unterscheidet zwei Geräte am Fingerabdruck', () => {
		const eins = erzeugeGeraeteschluessel();
		const zwei = erzeugeGeraeteschluessel();
		expect(eins.fingerabdruck).not.toBe(zwei.fingerabdruck);
	});

	it('hängt am ganzen Code: ein vertauschter Teil ergibt einen anderen Abdruck', () => {
		const eins = erzeugeGeraeteschluessel();
		const zwei = erzeugeGeraeteschluessel();
		expect(fingerabdruck(eins.encPublic, zwei.sigPublic)).not.toBe(eins.fingerabdruck);
	});

	it('zeigt den Abdruck in lesbaren Gruppen', () => {
		const gruppen = fingerabdruckInGruppen('a'.repeat(64));
		expect(gruppen).toBe(Array(8).fill('aaaa').join(' '));
	});
});

describe('Verschlüsseln für ein Gerät', () => {
	it('öffnet sich mit dem Schlüssel des Geräts', () => {
		const paar = erzeugeGeraeteschluessel();
		const paket = verschluessleFuerGeraet(inhalt, paar.encPublic);

		expect(new TextDecoder().decode(oeffneAlsGeraet(paket, paar.encSecret))).toBe(
			new TextDecoder().decode(inhalt)
		);
	});

	it('ist nicht im Klartext lesbar', () => {
		const paar = erzeugeGeraeteschluessel();
		const paket = verschluessleFuerGeraet(inhalt, paar.encPublic);

		expect(Buffer.from(paket).toString('latin1')).not.toContain('Traktandenliste');
	});

	/*
	 * **Die Gegenprobe, auf die es ankommt.** Ohne sie wäre jeder der Tests oben
	 * auch dann grün, wenn die Verschlüsselung für alle Geräte denselben
	 * Schlüssel benutzte.
	 */
	it('öffnet sich NICHT mit dem Schlüssel eines anderen Geräts', () => {
		const paar = erzeugeGeraeteschluessel();
		const fremd = erzeugeGeraeteschluessel();
		const paket = verschluessleFuerGeraet(inhalt, paar.encPublic);

		expect(() => oeffneAlsGeraet(paket, fremd.encSecret)).toThrow(PaketFehler);
	});

	it('merkt, wenn unterwegs ein Byte gekippt wurde', () => {
		const paar = erzeugeGeraeteschluessel();
		const paket = verschluessleFuerGeraet(inhalt, paar.encPublic);
		paket[paket.length - 1] ^= 0x01;

		expect(() => oeffneAlsGeraet(paket, paar.encSecret)).toThrow(PaketFehler);
	});

	/*
	 * **Was diese beiden Proben messen, und was nicht.** Sie decken den Kopf ab,
	 * den die Probe darüber nicht anfasst: den flüchtigen Teil und den Vorspann.
	 *
	 * **Sie sind ausdrücklich kein Nachweis für `setAAD`** (nachgerechnet am
	 * 18.09.2026, nachdem der Kommentar hier zuerst genau das behauptet hatte).
	 * Ein gekippter Vorspann lässt AES-GCM ohnehin scheitern, weil er in den
	 * Entschlüssler geht; ein gekippter flüchtiger Teil ergibt ohnehin ein
	 * anderes gemeinsames Geheimnis. Beide wären auch ohne die Bindung grün.
	 * Was sie sind: Wächter über das Format. Wer den Kopf umbaut und dabei ein
	 * Feld aus der Prüfung fallen lässt, wird hier rot.
	 */
	it('merkt, wenn der flüchtige Teil im Kopf getauscht wurde', () => {
		const paar = erzeugeGeraeteschluessel();
		const paket = verschluessleFuerGeraet(inhalt, paar.encPublic);
		paket[MARKE.length] ^= 0x01;

		expect(() => oeffneAlsGeraet(paket, paar.encSecret)).toThrow(PaketFehler);
	});

	it('merkt, wenn der Vorspann im Kopf getauscht wurde', () => {
		const paar = erzeugeGeraeteschluessel();
		const paket = verschluessleFuerGeraet(inhalt, paar.encPublic);
		paket[MARKE.length + 32] ^= 0x01;

		expect(() => oeffneAlsGeraet(paket, paar.encSecret)).toThrow(PaketFehler);
	});

	it('sagt bei einem abgeschnittenen Paket, was fehlt', () => {
		const paar = erzeugeGeraeteschluessel();
		const paket = verschluessleFuerGeraet(inhalt, paar.encPublic);

		expect(() => oeffneAlsGeraet(paket.slice(0, MARKE.length + 20), paar.encSecret)).toThrow(
			/unvollständig/
		);
	});

	it('nennt fremde Dateien beim Namen, statt an ihnen zu scheitern', () => {
		const paar = erzeugeGeraeteschluessel();
		const fremd = new TextEncoder().encode('PK irgendein ZIP');

		expect(() => oeffneAlsGeraet(fremd, paar.encSecret)).toThrow(
			/kein Vorbereitungspaket dieser Anwendung/
		);
	});

	it('ergibt bei zweimaligem Verschlüsseln nicht dieselben Bytes', () => {
		const paar = erzeugeGeraeteschluessel();
		const eins = verschluessleFuerGeraet(inhalt, paar.encPublic);
		const zwei = verschluessleFuerGeraet(inhalt, paar.encPublic);

		expect(Buffer.from(eins).equals(Buffer.from(zwei))).toBe(false);
	});
});

describe('Unterschrift für die Rückgabe', () => {
	it('stimmt gegen den öffentlichen Teil desselben Geräts', () => {
		const paar = erzeugeGeraeteschluessel();
		const unterschrift = unterschreibe(inhalt, paar.sigSecret);

		expect(unterschriftStimmt(inhalt, unterschrift, paar.sigPublic)).toBe(true);
	});

	it('stimmt nicht gegen ein anderes Gerät', () => {
		const paar = erzeugeGeraeteschluessel();
		const fremd = erzeugeGeraeteschluessel();
		const unterschrift = unterschreibe(inhalt, paar.sigSecret);

		expect(unterschriftStimmt(inhalt, unterschrift, fremd.sigPublic)).toBe(false);
	});

	it('stimmt nicht für einen anderen Inhalt', () => {
		const paar = erzeugeGeraeteschluessel();
		const unterschrift = unterschreibe(inhalt, paar.sigSecret);
		const anderer = new TextEncoder().encode('Ein anderes Paket.');

		expect(unterschriftStimmt(anderer, unterschrift, paar.sigPublic)).toBe(false);
	});

	it('fällt bei Unfug nicht um, sondern sagt nein', () => {
		const paar = erzeugeGeraeteschluessel();
		expect(unterschriftStimmt(inhalt, 'keine-unterschrift', paar.sigPublic)).toBe(false);
	});
});
