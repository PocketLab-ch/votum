/**
 * Die Enthaltungsregel auf dem Weg durch die Datenbank.
 *
 * **Warum es diese Datei gibt.** Am 04.09.2026 fand ein Prüfdurchgang, dass
 * eine hinterlegte Reglementsregel «Enthaltungen fallen aus der Bezugsgrösse»
 * zwar erfasst, gespeichert und auf der Reglementsseite angezeigt, aber nie
 * gerechnet wurde: Das Erfordernis führte das Merkmal nicht, und `zaehleAus`
 * sieht nur das Erfordernis.
 *
 * **Und warum sie eine Datenbankprobe ist und keine Kernprobe.** Beim Beheben
 * war zuerst nur der Kern geändert: Feld am `Erfordernis`, Übersetzung aus der
 * Regel, beide Rechenwege. Sechs Kernproben wurden grün, und der Fehler
 * bestand weiter. Das Erfordernis wird nämlich **in Einzelspalten** an
 * `agenda_item` festgeschrieben, und für dieses Merkmal gab es keine. Es
 * überlebte das Speichern nicht.
 *
 * Der Weg ist also erst dann dicht, wenn er über die Datenbank geprüft wird:
 * schreiben, lesen, rechnen. Genau das steht hier.
 */
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum, holeTraktanden } from '$lib/server/traktanden';
import { schreibeErfordernisIn } from '$lib/server/erfordernisse';
import { wendeReglementAn } from '$lib/domain/reglement';
import {
	erstelleReglementsregel,
	erfordernisseNachziehen,
	veralteteErfordernisse
} from '$lib/server/reglement';
import { waehleErfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Reglementsregel } from '$lib/domain/reglement';

let betreiber: string;
let stweg: string;
let versammlung: string;

/*
 * **Nicht mehr die notwendige bauliche Massnahme** (23.09.2026). Diese Proben
 * brauchen einen Knoten, an dem eine hinterlegte Reglementsregel tatsächlich
 * greift; sonst messen sie nur, dass die Sperre wirkt. Seit der Fassung
 * 2026-09-23 sind die baulichen Massnahmen gesperrt, weil ihr Quorum aus
 * Art. 647a bis 647e stammt und damit unter Art. 712g Abs. 2 fällt (Befund
 * B-02 der Rechtsprüfung vom 22.09.2026).
 *
 * `k-nutzungsrecht-zuteilung` ist einer der acht Knoten, die frei bleiben,
 * weil sie nicht auf Art. 647 ff. beruhen.
 */
const KNOTEN = 'k-nutzungsrecht-zuteilung';

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/** Eine Regel, die sich allein in der Enthaltungsfrage unterscheidet. */
function regel(enthaltungZaehltMit: boolean): Reglementsregel {
	return {
		id: 'r-enthaltung',
		stwegId: stweg,
		geschaeftsart: 'nutzungsrechte',
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		kopfbasis: 'anwesend_vertreten',
		quotenSchwelle: null,
		quotenbasis: 'keine',
		fundstelle: 'Reglement Ziff. 9',
		enthaltungZaehltMit
	};
}

/**
 * Holt das Erfordernis eines Traktandums über den Leseweg der Anwendung.
 *
 * **Wirft, wenn die Zeile fehlt.** Eine Probe, die mit `?.` über ein fehlendes
 * Traktandum hinwegliest, prüft die Rückgabe `undefined` gegen die Erwartung
 * `undefined` und ist damit immer grün. Genau das ist beim ersten Schreiben
 * dieser Datei passiert.
 */
async function erfordernisVon(id: string) {
	const alle = await holeTraktanden(betreiber, versammlung);
	const zeile = alle.find((x) => x.knoten.id === id);
	if (!zeile) throw new Error(`Traktandum ${id} steht nicht in der gelesenen Liste`);
	return zeile.knoten.erfordernis;
}

/**
 * Schreibt ein Erfordernis mit der gegebenen Regel und liest es zurück.
 *
 * Der Rückweg geht über `holeTraktanden`, also über denselben Leseweg wie die
 * Anwendung. Eine Abfrage von Hand würde die Spalte prüfen und nicht den Weg.
 */
async function hinUndZurueck(enthaltungZaehltMit: boolean) {
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: versammlung,
		titel: `Dachrinne ${enthaltungZaehltMit ? 'mit' : 'ohne'}`,
		art: 'abstimmung',
		antragswortlaut: 'Die Dachrinne wird ersetzt.',
		antragstellerart: 'bewirtschaftung'
	});
	const gesetz = waehleErfordernis(holeRegelwerk(), KNOTEN).ergebnis!;
	const { erfordernis } = wendeReglementAn(gesetz, [regel(enthaltungZaehltMit)], null, LESARTEN_VORGABE);
	await imKontext(betreiber, (tx) => schreibeErfordernisIn(tx, handelnder(betreiber), t.id, erfordernis));
	return { geschrieben: erfordernis, gelesen: await erfordernisVon(t.id) };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Erfordernis Enthaltung');
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name: 'STWEG Enthaltungsweg',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: stweg,
		datum: '2027-04-08',
		uhrzeit: '19:00',
		ort: 'Prüfsaal Enthaltung',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	versammlung = v.id;
});

afterAll(verbindungenSchliessen);

describe('Die Enthaltungsregel überlebt das Festschreiben', () => {
	it('trägt «fällt aus der Basis» bis in das gelesene Erfordernis', async () => {
		const { geschrieben, gelesen } = await hinUndZurueck(false);
		expect(geschrieben.enthaltungZaehltMit).toBe(false);
		expect(gelesen?.enthaltungZaehltMit).toBe(false);
	});

	it('trägt «zählt mit» ebenso', async () => {
		const { gelesen } = await hinUndZurueck(true);
		expect(gelesen?.enthaltungZaehltMit).toBe(true);
	});

	it('lässt ein Erfordernis ohne das Merkmal unbestimmt, nicht falsch', async () => {
		/*
		 * **Fassungsgerecht.** Ein Traktandum, das vor dem 04.09.2026
		 * festgeschrieben wurde, trägt `null` in der Spalte. Das muss als
		 * «unbestimmt» zurückkommen und nicht als `false`: Sonst wechselte ein
		 * bereits gefasster Beschluss beim Nachrechnen die Seite.
		 */
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: versammlung,
			titel: 'Dachrinne ohne Regel',
			art: 'abstimmung',
			antragswortlaut: 'Die Dachrinne wird ersetzt.',
			antragstellerart: 'bewirtschaftung'
		});
		const gesetz = waehleErfordernis(holeRegelwerk(), KNOTEN).ergebnis!;
		expect(gesetz.enthaltungZaehltMit).toBeUndefined();
		await imKontext(betreiber, (tx) => schreibeErfordernisIn(tx, handelnder(betreiber), t.id, gesetz));

		const gelesen = await erfordernisVon(t.id);
		// Erst belegen, dass überhaupt ein Erfordernis zurückkam: Sonst prüfte die
		// Zeile darunter `undefined` gegen `undefined`.
		expect(gelesen?.typ).toBe(gesetz.typ);
		expect(gelesen?.enthaltungZaehltMit).toBeUndefined();
	});
});

describe('Der Weg, den die Oberfläche auslöst', () => {
	/*
	 * **Der Zusammenbau, nicht nur die Bausteine.** Kern, Übersetzung und
	 * Speicherweg sind je einzeln geprüft. Hier läuft der Weg, den die
	 * Reglementsseite auslöst, wenn eine Regel dazukommt: Sie zieht die
	 * betroffenen Erfordernisse nach, und dabei muss das Merkmal ankommen.
	 *
	 * Dieselbe Kette hängt an sieben weiteren Stellen im Serverkern, alle über
	 * `wendeReglementAn`; wer dort etwas ändert, bricht sie hier hörbar.
	 */
	it('trägt die Enthaltungsregel beim Nachziehen bis in die Datenbank', async () => {
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: versammlung,
			titel: 'Nachziehen mit Enthaltungsregel',
			art: 'abstimmung',
			antragswortlaut: 'Der Vertrag wird verlängert.',
			antragstellerart: 'bewirtschaftung'
		});
		const gesetz = waehleErfordernis(holeRegelwerk(), KNOTEN).ergebnis!;
		await imKontext(betreiber, (tx) => schreibeErfordernisIn(tx, handelnder(betreiber), t.id, gesetz));
		expect((await erfordernisVon(t.id))?.enthaltungZaehltMit).toBeUndefined();

		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: stweg,
			geschaeftsart: 'nutzungsrechte',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 9',
			enthaltungZaehltMit: false
		});

		// Erst belegen, dass es überhaupt etwas nachzuziehen gibt: Sonst liefe der
		// Nachzug über null Zeilen und die Probe wäre grün, ohne zu messen.
		const offen = await veralteteErfordernisse(betreiber, stweg);
		expect(offen.some((o) => o.traktandumId === t.id)).toBe(true);

		await erfordernisseNachziehen(handelnder(betreiber), stweg);
		expect((await erfordernisVon(t.id))?.enthaltungZaehltMit).toBe(false);
	});
});
