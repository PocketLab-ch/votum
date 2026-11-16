import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
	EINGANGSHANDLUNGEN,
	eingaenge,
	eingaengeOhneVermerk,
	setztOhneRuecknahme,
	HELFER,
	RUECKNAHME
} from '../../scripts/lib/papiereingang.mjs';

/**
 * Der Gegentest zur Regel «wer die Anwesenheit schreibt, schreibt auch den
 * Papiervermerk» (`scripts/lib/papiereingang.mjs`).
 *
 * **Warum ein Gegentest und nicht nur ein Lauf über den Bestand.** Ein Wächter,
 * der nur am gesunden Baum läuft, ist grün, weil der Baum gesund ist, nicht
 * weil er misst. Unten steht deshalb je ein Fall, in dem der Vermerk **fehlt**,
 * und die Forderung, dass die Regel ihn findet. Dazu die Sichtprobe an den
 * wirklichen Dateien: Eine Regel, die nur ausgedachte Schnipsel trifft, kann an
 * der echten Bauform vorbeigreifen.
 */

const HANDLUNG = (rumpf: string) => `
export const actions = {
	einlassen: async ({ request, locals, params }) => {
${rumpf}
	}
};`;

describe('findet den fehlenden Vermerk', () => {
	it('meldet eine Einlasshandlung ohne Helfer', () => {
		const fehlt = eingaengeOhneVermerk(HANDLUNG('\t\tawait lasseEin(handelnder(locals), params.id);'));
		expect(fehlt).toHaveLength(1);
		expect(fehlt[0].name).toBe('einlassen');
	});

	it('lässt die Handlung in Ruhe, die ihn nennt', () => {
		expect(
			eingaengeOhneVermerk(
				HANDLUNG(`\t\tawait lasseEin(handelnder(locals), params.id);
		const p = await ${HELFER}(locals, params.id, e.parteiId, daten);`)
			)
		).toHaveLength(0);
	});

	it('lässt sich von einer Nennung im Kommentar nicht täuschen', () => {
		/*
		 * **Der wahrscheinlichste Rückschritt** (09.09.2026, im zweiten
		 * Code-Review gefunden): Wer den Aufruf entfernt, lässt den Kommentar
		 * stehen, der erklärt, warum er dort stand. Die erste Fassung dieser Probe
		 * hielt genau das als gewollt fest — eine Näherung, die den Fall nicht
		 * deckt, den sie decken müsste.
		 */
		const e = eingaengeOhneVermerk(HANDLUNG(`\t\t// hier fehlt noch ${HELFER}`));
		expect(e).toHaveLength(1);
	});

	it('und auch nicht von einer Nennung in einer Zeichenkette', () => {
		const e = eingaengeOhneVermerk(HANDLUNG(`\t\treturn { hinweis: '${HELFER} fehlt' };`));
		expect(e).toHaveLength(1);
	});

	it('verliert sich nicht an einer Klammer in einer Zeichenkette', () => {
		const fehlt = eingaengeOhneVermerk(
			HANDLUNG("\t\treturn { hinweis: 'geschweift: { und } im Text' };") +
				`
export const weitere = {
	bestaetigen: async ({ locals }) => {
		await irgendwas(locals);
	}
};`
		);
		expect(fehlt.map((f) => f.name).sort()).toEqual(['bestaetigen', 'einlassen']);
	});
});

describe('Sichtprobe am wirklichen Bestand', () => {
	/**
	 * **Die Prüfmenge wird abgeleitet, nicht aufgezählt** (Auftraggeber, 10.09.2026).
	 *
	 * Bis dahin stand hier eine Liste von Dateien, von Hand geschrieben. Sie ist
	 * zweimal aus demselben Grund gewachsen: Am 09.09.2026 fehlten `leitung` und
	 * der gemeinsame Abend, am 10.09.2026 die Leitung des Abends. Beide Male hat
	 * ein Code-Review es gefunden, nicht der Wächter — und das ist die Bauart:
	 * Ein Wächter mit handgeschriebener Prüfmenge sieht genau das nicht, was
	 * jemand vergessen hat.
	 *
	 * Jetzt geht er über **alle** Handlungsdateien. Wer eine neue Seite mit einem
	 * Eingang baut, wird geprüft, ohne dass er hier etwas eintragen muss.
	 *
	 * **Abgeleitet ist die Dateimenge, nicht die Namensmenge.** Eine Handlung, die
	 * keinen der Namen aus `EINGANGSHANDLUNGEN` trägt, sieht der Wächter weiterhin
	 * nicht — genau daran ist `einlass` am gemeinsamen Abend vorbeigelaufen, bis
	 * ein Code-Review ihn fand. Die Probe «jeder Name kommt vor» unten hält
	 * wenigstens fest, dass keiner der bekannten Namen ins Leere zeigt.
	 */
	function alleQuellen(verzeichnis: string, raus: string[] = []): string[] {
		for (const eintrag of readdirSync(verzeichnis)) {
			const pfad = join(verzeichnis, eintrag);
			if (statSync(pfad).isDirectory()) alleQuellen(pfad, raus);
			else if (pfad.endsWith('.ts')) raus.push(pfad);
		}
		return raus;
	}

	const quellen = [...alleQuellen('src/routes'), ...alleQuellen('src/lib/server')];

	/**
	 * Handlungen, die einen Eingangsnamen tragen und **kein Eingang** sind.
	 *
	 * **Diese Liste hat die richtige Fehlrichtung**, anders als die Dateiliste
	 * davor. Wer einen neuen Eingang baut und ihn hier nicht einträgt, wird
	 * geprüft — vergessen fällt auf. Wer eine fremde Handlung `bestaetigen` nennt,
	 * bekommt einen roten Wächter und trägt sie mit Grund ein; auch das fällt auf,
	 * nur andersherum.
	 *
	 * `bestaetigen` heisst im Bestand dreierlei: eine Regel bestätigen, ein
	 * Traktandum bestätigen, eine Vollmacht bestätigen. Keine davon lässt jemanden
	 * in den Saal.
	 */
	const KEIN_EINGANG = [
		{
			datei: 'src/routes/gemeinschaften/[id=kennung]/reglement/+page.server.ts',
			name: 'bestaetigen',
			grund: 'Bestätigt eine Reglementsregel, nicht einen Menschen am Eingang.'
		},
		{
			datei: 'src/routes/versammlungen/[id=kennung]/traktanden/+page.server.ts',
			name: 'bestaetigen',
			grund: 'Bestätigt die Vollständigkeit der Traktandenliste.'
		},
		{
			datei: 'src/routes/versammlungen/[id=kennung]/vollmachten/+page.server.ts',
			name: 'bestaetigen',
			/*
			 * **Diese Begründung war zuerst falsch** (Code-Review 10.09.2026). Sie
			 * lautete «die Anwesenheit entsteht erst am Eingang» — die Handlung ruft
			 * aber `bestaetigeAnwesenheit` und lässt die bevollmächtigte Person ein,
			 * falls sie noch nicht da ist. Sie IST also ein Eingang.
			 *
			 * Fragen kann sie trotzdem nicht: Hier steht niemand am Tisch, es wird
			 * eine Vollmacht bestätigt, und der Eintritt fällt nebenbei ab. Die
			 * Partei bekommt deshalb keine Antwortzeile und steht in der
			 * Nachtragsliste, bis jemand sie fragt — derselbe Weg wie bei der
			 * Häkchenliste.
			 */
			grund:
				'Lässt die bevollmächtigte Person nebenbei ein, ohne dass jemand am Tisch steht. ' +
				'Ohne Antwort landet sie in der Nachtragsliste.'
		}
	];

	const istAusnahme = (datei: string, name: string) =>
		KEIN_EINGANG.some((a) => a.datei === datei && a.name === name);

	const alleEingaenge = quellen.flatMap((d) => eingaenge(readFileSync(d, 'utf8'), d));

	/*
	 * **Je Name, nicht als Summe** (Code-Review 10.09.2026). Die Untergrenze
	 * `>= 10` hatte ihre Schärfe verloren, seit der Baumlauf mehr Treffer bringt:
	 * `saalZuordnen` aus `EINGANGSHANDLUNGEN` zu streichen war vorher rot (9) und
	 * wäre jetzt grün (12) gewesen. Eine Summe misst, dass überhaupt etwas
	 * gefunden wird; sie misst nicht, dass jeder Name noch trifft.
	 */
	it('jeder Name aus der Regel kommt im Bestand vor', () => {
		const ohneTreffer = EINGANGSHANDLUNGEN.filter(
			(name) => !alleEingaenge.some((e) => e.name === name)
		);
		expect(ohneTreffer).toEqual([]);
	});

	it('findet die Handlungen überhaupt — sonst misst die Probe nichts', () => {
		expect(alleEingaenge.length).toBeGreaterThanOrEqual(10);
	});

	it('jede Einlasshandlung setzt den Papiervermerk', () => {
		const fehlt = quellen
			.flatMap((d) => eingaengeOhneVermerk(readFileSync(d, 'utf8'), d))
			.filter((f) => !istAusnahme(f.datei, f.name));
		expect(fehlt.map((f) => `${f.datei}:${f.zeile} ${f.name}`)).toEqual([]);
	});

	it('und jede Datei, die den Vermerk setzt, kann ihn auch zurücknehmen', () => {
		const fehlt = quellen.flatMap((d) => setztOhneRuecknahme(readFileSync(d, 'utf8'), d));
		expect(fehlt.map((f) => `${f.datei} setzt ${f.setzt.join(', ')}`)).toEqual([]);
	});

	/*
	 * **Eine Ausnahme, die es nicht mehr gibt, ist eine Lüge über den Bestand.**
	 * Wird die Handlung umbenannt oder die Datei verschoben, deckt der Eintrag ab
	 * morgen nichts mehr — und ein späterer Eingang mit demselben Namen an
	 * derselben Stelle fiele stumm hindurch. Genau die Sorte Rest, gegen die
	 * dieser Umbau geht.
	 */
	it('und jede benannte Ausnahme gibt es noch', () => {
		const verwaist = KEIN_EINGANG.filter(
			(a) => !alleEingaenge.some((e) => e.datei === a.datei && e.name === a.name)
		);
		expect(verwaist.map((a) => `${a.datei} ${a.name}`)).toEqual([]);
	});

	/*
	 * **Und die Ausnahmen dürfen den Vermerk gerade nicht setzen.** Täte es eine,
	 * wäre sie doch ein Eingang und stünde hier falsch. Ohne diese Probe könnte
	 * die Liste stillschweigend einen echten Eingang decken.
	 */
	it('und keine Ausnahme setzt den Vermerk doch', () => {
		const doch = alleEingaenge.filter((e) => istAusnahme(e.datei, e.name) && e.nenntHelfer);
		expect(doch.map((e) => `${e.datei} ${e.name}`)).toEqual([]);
	});
});

/**
 * Der Gegentest zur zweiten Regel.
 *
 * **Gemessen am wirklichen Loch** (10.09.2026). Der gemeinsame Abend setzte den
 * Vermerk aus drei Handlungen und hatte keine Rücknahme. Die Regel oben war
 * grün, weil sie nur nach dem Setzen fragt. Hier steht der Fall, den sie finden
 * muss — und daneben die beiden Bauformen, die in Ordnung sind.
 */
describe('findet die fehlende Rücknahme', () => {
	const SETZT = `
export const actions = {
	bestaetigen: async ({ request, locals, params }) => {
		const e = await bestaetigeAnwesenheit(handelnder(locals), params.id, partei);
		const p = await ${HELFER}(locals, params.id, e.parteiId, daten);
		return { hinweis: 'ok', papier: p.papier };
	}`;

	it('meldet eine Datei, die setzt und nicht zurücknimmt', () => {
		const fehlt = setztOhneRuecknahme(`${SETZT}\n};`, 'abend.ts');
		expect(fehlt).toHaveLength(1);
		expect(fehlt[0].setzt).toEqual(['bestaetigen']);
	});

	it('lässt eine Datei mit eigener Rücknahme in Ruhe', () => {
		const quelle = `${SETZT},
	${RUECKNAHME}: async ({ request, locals, params }) => {
		await hebePapierabgabeAuf(handelnder(locals), params.id, partei);
	}
};`;
		expect(setztOhneRuecknahme(quelle, 'abend.ts')).toEqual([]);
	});

	it('lässt eine Datei in Ruhe, die das geteilte Bündel ausbreitet', () => {
		const quelle = `
export const actions = {
	...einlassaktionen,
	einlassen: async ({ request, locals, params }) => {
		const p = await ${HELFER}(locals, params.id, e.parteiId, daten);
	}
};`;
		expect(setztOhneRuecknahme(quelle, 'anwesenheit.ts')).toEqual([]);
	});

	it('lässt sich von einer Rücknahme im Kommentar nicht täuschen', () => {
		/*
		 * Derselbe wahrscheinliche Rückschritt wie bei der ersten Regel: Wer die
		 * Handlung entfernt, lässt den Kommentar stehen, der sie erklärt.
		 */
		const fehlt = setztOhneRuecknahme(`${SETZT}\n\t// ${RUECKNAHME} steht in einlassaktionen\n};`, 'abend.ts');
		expect(fehlt).toHaveLength(1);
	});

	it('schweigt zu einer Datei, die gar nichts setzt', () => {
		const quelle = `
export const actions = {
	ablehnen: async ({ request, locals, params }) => {
		await lehneAnmeldungAb(handelnder(locals), params.id, partei);
	}
};`;
		expect(setztOhneRuecknahme(quelle, 'sonst.ts')).toEqual([]);
	});
});
