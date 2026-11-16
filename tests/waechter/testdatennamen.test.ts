/**
 * Findet das Aufräumskript, was die Drehbücher anlegen?
 *
 * **Der Anlass** (22.09.2026). `e2e/durchspielen.mjs` legte Gemeinschaften
 * namens «Dateiweg …» und «Sammelweg …» an. `scripts/testdaten-entfernen.sql`
 * kennt acht Namensmuster, und keines passte auf die beiden: Nach jedem
 * Durchstich blieben sie im Bestand liegen. Gemessen am selben Tag standen
 * 672 Gemeinschaften in der Entwicklungsdatenbank, auf die kein Muster passt —
 * 665 davon diese zwei Namen.
 *
 * **Warum eine Probe und nicht ein neuntes Muster** (Einwand website-5e, und
 * er trifft): Ein Muster nachzutragen behebt diesen Fall und lässt den
 * nächsten offen. Aufzählen statt Suchen.
 *
 * **Beide Seiten werden aus der Datei gelesen**, keine davon hier
 * danebengeschrieben. Zwei Aufzählungen, die auseinanderlaufen können, wären
 * die Klasse «die Probe misst die eine Liste gegen die andere statt gegen die
 * Wirklichkeit».
 *
 * **Und eine Stelle, die die Probe nicht lesen kann, ist ein Befund** — nicht
 * eine Stelle, die sie übergeht. Die erste Fassung verlangte ein
 * Vorlagenliteral unmittelbar hinter dem Feld und sah damit 19 von 34
 * Anlegestellen; die häufigere Schreibweise `fill('input[name="name"]', NAME)`
 * war unsichtbar. Sie war grün, während in der Datenbank drei Gemeinschaften
 * aus genau so einer Stelle lagen (`mustergemeinschaft.mjs`). Gefunden hat das
 * der Code-Review, nicht die Probe.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const E2E = join(process.cwd(), 'e2e');
const AUFRAEUMEN = join(process.cwd(), 'scripts', 'testdaten-entfernen.sql');

/** Wie weit vor dem Feld der Weg zur Anlegemaske stehen darf. */
const SICHTWEITE = 20;

/**
 * Die Namensmuster, wie sie im Aufräumskript stehen.
 *
 * Gelesen wird der Block, der die **Gemeinschaften** bestimmt (`CREATE TEMP
 * TABLE weg`), nicht die späteren Blöcke für Geräte und Personen — die haben
 * eigene, engere Listen für anderen Bestand.
 *
 * **Zeilenkommentare zuerst weg** (beim Bauen gemessen, 22.09.2026). Der erste
 * Anlauf suchte das Semikolon im rohen Text und fand es in einem Kommentar
 * mitten im Block. Gelesen wurden dann vier von acht Mustern, und die Probe
 * hätte vier Namen als «bleibt liegen» gemeldet, die längst gefunden werden.
 * Bemerkt hat es die Sichtprobe unten.
 */
function muster(): string[] {
	const sql = readFileSync(AUFRAEUMEN, 'utf8').replace(/--[^\n]*/g, '');
	const block = sql.slice(sql.indexOf('CREATE TEMP TABLE weg'));
	return [...block.slice(0, block.indexOf(';')).matchAll(/name LIKE '([^']+)'/g)].map((m) => m[1]);
}

/** Ein SQL-`LIKE`-Muster auf einen Namen anwenden. */
function passt(name: string, form: string): boolean {
	const roh = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
	return new RegExp(`^${roh}$`).test(name);
}

/** Was zur Laufzeit entsteht, ist für die Musterfrage ein Platzhalter. */
function platzhalter(text: string): string {
	return text.replace(/\$\{[^}]*\}/g, 'X');
}

/**
 * Setzt eine Konstante aus derselben Datei ein.
 *
 * **Eine Ebene, nicht mehr.** Die meisten Drehbücher bilden den Namen einmal
 * oben (`const NAME = \`Prüflauf Stammdaten ${LAUF}\``) und füllen das Feld
 * später damit. Das ist statisch lesbar, also auch statisch zu beurteilen; die
 * Stellen zu überspringen hiesse, die Probe dort blind zu machen, wo jemand
 * das Muster am ehesten vergisst.
 *
 * Tiefer aufzulösen wäre der Anfang eines Übersetzers. Was sich so nicht
 * auflösen lässt, gehört mit Grund in `MIT_GRUND` — sichtbar, statt still
 * übergangen.
 */
function wertVon(ausdruck: string, quelle: string): string | null {
	const vorlage = ausdruck.match(/^`([^`]*)`$/);
	if (vorlage) {
		/*
		 * Beginnt der Name mit einer Konstanten, wird sie zuerst eingesetzt:
		 * `${NAME} Haus A` ist ohne sie nicht zu beurteilen, mit ihr trägt es
		 * «Prüflauf» und ist gedeckt.
		 */
		const anfang = vorlage[1].match(/^\$\{(\w+)\}/);
		if (!anfang) return platzhalter(vorlage[1]);
		const wert = quelle.match(new RegExp(`\\b${anfang[1]}\\s*=\\s*\`([^\`]+)\``));
		/*
		 * **Ein unauflösbarer Anfang macht den Rest nicht unlesbar** (beim
		 * Bauen gemessen). Drei Drehbücher setzen vorn einen Parameter ein und
		 * schreiben «Prüflauf» dahinter; das Muster `%Prüflauf%` greift, ganz
		 * gleich was vorn steht. Der erste Anlauf gab hier `null` zurück und
		 * verlangte für alle drei eine Ausnahme, die keine ist.
		 *
		 * Der Platzhalter ist dabei die ehrliche Auskunft: ein Präfixmuster
		 * wie «E2E %» greift auf einen unbekannten Anfang **nicht**, und das
		 * ist richtig so.
		 */
		return platzhalter(wert ? vorlage[1].replace(anfang[0], wert[1]) : vorlage[1]);
	}

	const zeichenkette = ausdruck.match(/^'([^']*)'$/);
	if (zeichenkette) return zeichenkette[1];

	const bezeichner = ausdruck.match(/^(\w+)$/);
	if (bezeichner) {
		const zuweisung = quelle.match(new RegExp(`\\b${bezeichner[1]}\\s*=\\s*\`([^\`]+)\``));
		return zuweisung ? platzhalter(zuweisung[1]) : null;
	}
	return null;
}

export interface Anlegestelle {
	datei: string;
	zeile: number;
	ausdruck: string;
	/** Der Name, soweit er sich statisch bestimmen lässt. */
	wert: string | null;
}

/**
 * Die Stellen, an denen ein Drehbuch eine **Gemeinschaft** anlegt.
 *
 * Erkannt am Feld `input[name="name"]` mit dem Weg zur Anlegemaske
 * (`gemeinschaften/neu`) in den Zeilen davor. Ohne diese Einschränkung läse
 * die Probe auch Saalgeräte, Verteiler und Zeitstempeldienste mit — die tragen
 * dasselbe Feld, und für sie gelten im Aufräumskript andere, engere Listen.
 *
 * **Kommentare fallen weg**, bevor gelesen wird. Der Schwesterwächter
 * `scripts/check-aufraeumen.mjs` begründet das am 25.08.2026 mit einem
 * auskommentierten `DELETE`, das seine Gegenprobe grün hielt.
 */
function anlegestellen(): Anlegestelle[] {
	const raus: Anlegestelle[] = [];
	for (const datei of readdirSync(E2E).filter((d) => d.endsWith('.mjs'))) {
		const roh = readFileSync(join(E2E, datei), 'utf8');
		const quelle = roh.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
		const zeilen = quelle.split('\n');
		zeilen.forEach((zeile, i) => {
			if (!zeile.includes('input[name="name"]')) return;
			if (!zeilen.slice(Math.max(0, i - SICHTWEITE), i).join('\n').includes('gemeinschaften/neu')) {
				return;
			}
			/*
			 * **Nicht `[^)]`** (beim Bauen gemessen, 22.09.2026): Eine Klammer
			 * im Namen selbst — «(Umgebung)», «(Nenner 900)», «(Prüflauf …)» —
			 * beendete den Ausdruck mitten im Literal, und die Stelle galt als
			 * unlesbar. Gelesen wird deshalb genau das, was dort stehen darf:
			 * ein Vorlagenliteral, eine Zeichenkette oder ein Bezeichner.
			 */
			const ausdruck = zeile.match(
				/input\[name="name"\]'\s*,\s*(`[^`]*`|'[^']*'|\w+)\s*\)/
			);
			raus.push({
				datei,
				zeile: i + 1,
				ausdruck: ausdruck ? ausdruck[1] : zeile.trim(),
				wert: ausdruck ? wertVon(ausdruck[1], quelle) : null
			});
		});
	}
	return raus;
}

/**
 * Namen, die bewusst **nicht** aufgeräumt werden, mit dem Grund.
 *
 * Geschlüsselt nach Datei **und** Ausdruck (Code-Review 22.09.2026). Ein
 * Schlüssel, der nur den aufgelösten Namen nennt, ist eine Blankovollmacht:
 * `XX` entsteht aus jedem `` `${a}${b}` `` in jedem Drehbuch, und das nächste
 * wäre mit einer Begründung entschuldigt, die von einer anderen Datei handelt.
 *
 * Eine Ausnahme ohne Grund ist eine Lücke, die niemand mehr beurteilen kann.
 * Wer hier einträgt, schreibt dazu, **warum** der Bestand stehen bleiben soll —
 * nicht, dass die Probe sonst rot ist.
 */
const MIT_GRUND: Record<string, string> = {
	'nirgendwerk.mjs|`MEG Nirgendweg 3-13a (Umgebung)${zusatz}`':
		'Der Zusatz ist « (Prüflauf …)», ausser im Beispielbestand — dort ist er leer, und ' +
		'der Name ist der Name des Hauses im Beispielbestand, das stehen bleiben soll. Im gewöhnlichen ' +
		'Lauf wird die Gemeinschaft also gelöscht; die Verzweigung lässt sich statisch nicht ' +
		'auflösen.',
	'nirgendwerk.mjs|`${haus}${zusatz}`':
		'Dieselbe Verzweigung, hier über die Häuser des Bestands. Ausserhalb des ' +
		'Beispielbestands trägt der Name «Prüflauf» und wird gelöscht; im Beispielbestand ist ' +
		'es der Hausname des Bestands.',
	'mustergemeinschaft.mjs|name':
		'Der Name kommt als Parameter von aussen herein. Gemessen am 22.09.2026 liegen aus ' +
		'dieser Stelle drei Gemeinschaften im Bestand («STWEG Musterstrasse 12», «STWEG ' +
		'Musterweg 3», «STWEG Musterweg 5»), auf die kein Muster passt. Das ist Vorführ' +
		'bestand und bleibt bewusst stehen; wer ihn löscht, verliert die Musteranlage.',
	'sammelarchiv.mjs|name':
		'Wie oben: Der Name ist ein Parameter der Hilfsfunktion und steht nicht im Drehbuch, ' +
		'lässt sich hier also nicht bestimmen.',
	'nirgendweg.mjs|NAME':
		'`NAME` hängt an derselben Verzweigung wie bei nirgendwerk: Im Beispielbestand ist es ' +
		'der Name des Hauses im Bestand, sonst trägt er «Prüflauf». Eine Zuweisung mit Bedingung ' +
		'lässt sich statisch nicht auflösen.'
};

describe('Die Namen der Drehbücher', () => {
	it('werden vom Aufräumskript gefunden', () => {
		const formen = muster();
		/*
		 * **Sichtprobe auf die eigene Leseweise.** Eine leere Musterliste
		 * liesse jeden Namen durchfallen und sähe aus wie ein Befund über die
		 * Drehbücher. Gemessen sind acht.
		 */
		expect(formen.length, 'keine Namensmuster im Aufräumskript gefunden').toBeGreaterThan(5);

		const liegengeblieben = anlegestellen()
			.filter((s) => !Object.hasOwn(MIT_GRUND, `${s.datei}|${s.ausdruck}`))
			.filter((s) => s.wert !== null && !formen.some((f) => passt(s.wert as string, f)));

		expect(
			liegengeblieben.map((s) => `${s.datei}:${s.zeile} «${s.wert}»`),
			'Diese Namen legt ein Drehbuch an, und kein Muster in ' +
				'scripts/testdaten-entfernen.sql findet sie wieder. Sie bleiben nach jedem Lauf ' +
				'im Bestand liegen. Entweder den Namen an ein vorhandenes Muster anpassen — ' +
				'«E2E …» oder «… Prüflauf …» — oder ihn mit Grund in MIT_GRUND eintragen.'
		).toEqual([]);
	});

	it('sind alle lesbar — eine Stelle, die die Probe nicht versteht, ist ein Befund', () => {
		/*
		 * **Das ist der eigentliche Wächter.** Die erste Fassung übersprang
		 * stillschweigend, was sie nicht lesen konnte, und sah damit 19 von 34
		 * Stellen. Eine neue Schreibweise hätte die Probe nicht rot gemacht,
		 * sondern blind — und blind sieht von aussen aus wie sauber.
		 */
		const unlesbar = anlegestellen()
			.filter((s) => s.wert === null)
			.filter((s) => !Object.hasOwn(MIT_GRUND, `${s.datei}|${s.ausdruck}`));

		expect(
			unlesbar.map((s) => `${s.datei}:${s.zeile} → ${s.ausdruck}`),
			'Diese Stellen legen eine Gemeinschaft an, und die Probe kann ihren Namen nicht ' +
				'bestimmen. Entweder den Namen als Literal oder als Konstante derselben Datei ' +
				'schreiben, oder die Stelle mit Grund in MIT_GRUND eintragen — sie darf nicht ' +
				'stumm übergangen werden.'
		).toEqual([]);
	});

	it('findet überhaupt Anlegestellen', () => {
		/*
		 * Ohne diese Zeile wäre die Probe immer grün: Greift die Erkennung
		 * daneben, findet sie null Stellen, hat nichts zu beanstanden und
		 * meldet Erfolg. Gemessen sind 34 am 22.09.2026; die Schranke liegt
		 * darunter, damit ein entfernter Schritt sie nicht reisst, und hoch
		 * genug, dass der Ausfall **einer Schreibweise** auffällt — die blinde
		 * Fassung sah 19.
		 */
		expect(anlegestellen().length).toBeGreaterThan(28);
	});

	it('nennt zu jeder Ausnahme einen Grund', () => {
		for (const [stelle, grund] of Object.entries(MIT_GRUND)) {
			expect(grund.length, `Ausnahme «${stelle}» ohne brauchbaren Grund`).toBeGreaterThan(80);
		}
	});
});
