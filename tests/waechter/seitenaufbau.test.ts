import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Der Gegentest zum Seitenaufbau-Wächter (`scripts/check-seitenaufbau.mjs`).
 *
 * **Was er misst**, ist nicht ein Fehler, sondern ein Fortschritt: wie viele
 * Seiten dem Modell aus `docs/plan-seitenaufbau-2026-08-27.md` folgen. Er ist
 * deshalb vorerst grün, auch wenn erst eine von 61 folgt — ein Wächter, der am
 * ersten Tag rot übergeben wird, wird abgeschaltet statt gelesen.
 *
 * **Beide Richtungen gehören geprüft.** Dass er zählt, ist die eine Hälfte;
 * dass seine Sichtproben anschlagen, die andere. Genau daran ist in diesem Repo
 * schon ein Wächter gescheitert: Er las nach einem Umbau null Dateien und
 * meldete weiter «in Ordnung».
 */
const SKRIPT = join(process.cwd(), 'scripts', 'check-seitenaufbau.mjs');

/*
 * **Die eigene Umgebung wird zurückgesetzt** (01.09.2026, aus dem Review). Der
 * Sinn von `SEITENAUFBAU_MINDESTENS` ist, dass sie im Prüflauf gesetzt wird,
 * sobald die Umstellung läuft. Erbte `fahre()` sie aus `process.env`, fiele
 * genau dann der Test um, der «bleibt grün» prüft — der Wächter wäre in Ordnung
 * und sein Gegentest rot, und das kostet eine Stunde Suche an der falschen
 * Stelle. Jeder Lauf setzt sie deshalb ausdrücklich, per Vorgabe auf leer.
 */
function fahre(wurzel: string, umgebung: Record<string, string> = {}) {
	return fahreWaechter(SKRIPT, wurzel, { SEITENAUFBAU_MINDESTENS: '', ...umgebung });
}

const verzeichnisse: string[] = [];

/**
 * Ein Prüfbaum mit genug Seiten, damit die Sichtprobe («weniger als 40 Seiten»)
 * nicht anschlägt, und mit einer Seite, die dem Modell folgt.
 */
function baum(
	optionen: {
		mitStapel?: boolean;
		seiten?: number;
		mitFlaeche?: boolean;
		lockerVerteilt?: boolean;
		beides?: boolean;
		ausSchleife?: boolean;
		ohneAusnahme?: boolean;
		markeOhneGrund?: boolean;
		markeVerwaist?: boolean;
		grundMehrzeilig?: boolean;
	} = {}
) {
	const { mitStapel = true, seiten = 45, mitFlaeche = false } = optionen;
	const { lockerVerteilt = false, beides = false, ausSchleife = false } = optionen;
	const { ohneAusnahme = false, markeOhneGrund = false, markeVerwaist = false } = optionen;
	const { grundMehrzeilig = false } = optionen;
	const wurzel = mkdtempSync(join(tmpdir(), 'seitenaufbau-'));
	verzeichnisse.push(wurzel);

	for (let i = 0; i < seiten; i++) {
		const ordner = join(wurzel, 'src', 'routes', `s${i}`);
		mkdirSync(ordner, { recursive: true });
		const stapelseite =
			'<div class="seitenstapel">\n\t<section class="abschnitt"><h2>Lage</h2></section>\n\t' +
			'<section class="abschnitt"><h2>Bestand</h2></section>\n</div>\n';
		/*
		 * Die Altform: ein Stapel irgendwo, und ein `.abschnitt` weit ausserhalb
		 * davon — genau das steht im Repo als `<h2 class="abschnitt">` auf Seiten,
		 * die mit dem Modell nichts zu tun haben.
		 */
		const lockereSeite =
			'<h2 class="abschnitt">Alte Ueberschrift</h2>\n<div class="karte">\n\t' +
			'<div class="seitenstapel"><p>nur ein Kasten</p></div>\n</div>\n';
		const beideSeite = stapelseite.replace(
			'</div>\n',
			'</div>\n<div class="arbeitsflaeche"><p>Rest</p></div>\n'
		);

		/* Abschnitte aus einer Schleife — im DOM Kinder des Stapels, im Baum unter `body`. */
		const schleifenseite =
			'<div class="seitenstapel">\n\t{#each teile as t}\n\t\t' +
			'<section class="abschnitt"><h2>{t}</h2></section>\n\t{/each}\n</div>\n';

		/*
		 * **Eine Seite mit Fläche und begründeter Marke.**
		 *
		 * Sie stand hier bis zum 02.09.2026 mit der Begründung, der Wächter habe
		 * eine Sichtprobe darauf, überhaupt noch eine Marke zu finden — «ohne sie
		 * wäre jeder Lauf rot». Genau diese Sichtprobe war der Fehler: Sie machte
		 * den Erfolgsfall rot. Der Baum trägt die Ausnahmeseite jetzt, weil die
		 * Proben sie brauchen, nicht weil der Wächter sie verlangt.
		 *
		 * `markeVerwaist` nimmt der Seite die Fläche und lässt den Grund stehen —
		 * die halb gemachte Umstellung.
		 */
		const grund = markeOhneGrund
			? 'seitenaufbau-ausnahme:'
			: grundMehrzeilig
				? 'seitenaufbau-ausnahme:\n\tDer Bestand wird beim\n\tEintragen gebraucht.'
				: 'seitenaufbau-ausnahme: Der Bestand wird beim Eintragen gebraucht.';
		const rumpf = markeVerwaist
			? '<div class="seitenstapel"><section class="abschnitt"><p>umgestellt</p></section></div>\n'
			: '<div class="arbeitsflaeche">\n\t<div class="spalte"><p>links</p></div>\n</div>\n';
		const ausnahmeseite = `<!-- ${grund} -->\n${rumpf}`;

		let inhalt = '<h1>Seite</h1>\n<p>Etwas.</p>\n';
		if (i === 2 && !ohneAusnahme) inhalt = ausnahmeseite;
		if (i === 0 && ausSchleife) inhalt = schleifenseite;
		else if (i === 0 && lockerVerteilt) inhalt = lockereSeite;
		else if (i === 0 && beides) inhalt = beideSeite;
		else if (i === 0 && mitStapel) inhalt = stapelseite;
		else if (i === 1 && mitFlaeche) inhalt = '<div class="arbeitsflaeche">\n\t<div class="spalte"><p>links</p></div>\n</div>\n';
		writeFileSync(join(ordner, '+page.svelte'), inhalt);
	}
	return wurzel;
}

afterEach(() => {
	for (const v of verzeichnisse.splice(0)) rmSync(v, { recursive: true, force: true });
});

describe('Der Seitenaufbau-Wächter', () => {
	it('zählt die Seiten, die dem Modell folgen, und bleibt dabei grün', () => {
		const { rot, ausgabe } = fahre(baum());
		expect(rot).toBe(false);
		expect(ausgabe).toMatch(/1 von 45 Seiten folgen dem Modell/);
	});

	it('nennt die Seiten, die noch die zweispaltige Fläche tragen', () => {
		const { ausgabe } = fahre(baum({ mitFlaeche: true }));
		expect(ausgabe).toContain('noch zweispaltig');
		expect(ausgabe).toMatch(/s1/);
	});

	/*
	 * **Die erste Sichtprobe.** Sieht der Lauf kaum Seiten, greift sein Muster
	 * nicht mehr — und «0 von 3» sähe aus wie ein sauberer Bestand.
	 */
	it('wird rot, wenn er kaum Seiten sieht', () => {
		const { rot, ausgabe } = fahre(baum({ seiten: 3 }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/der Lauf greift nicht/);
	});

	/*
	 * **Die zweite Sichtprobe.** Folgt keine einzige Seite mehr, ist entweder die
	 * Musterseite umgebaut worden oder der Wächter sieht die Klassen nicht mehr.
	 * Beides gehört gemeldet, statt still «0» zu zählen.
	 */
	it('wird rot, wenn keine einzige Seite dem Modell folgt', () => {
		const { rot, ausgabe } = fahre(baum({ mitStapel: false }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/keine einzige Seite folgt dem Modell/);
	});

	/*
	 * **Die Schwelle macht ihn scharf.** Sie wächst mit der Umstellung mit; ohne
	 * sie zählt er nur. Damit faellt ein Rückschritt auf, sobald jemand eine
	 * umgestellte Seite wieder aus dem Modell nimmt.
	 */
	it('bricht ab, wenn die verlangte Schwelle unterschritten wird', () => {
		const { rot, ausgabe } = fahre(baum(), { SEITENAUFBAU_MINDESTENS: '5' });
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/verlangt sind 5/);
	});

	it('lässt eine erfüllte Schwelle durch', () => {
		const { rot } = fahre(baum(), { SEITENAUFBAU_MINDESTENS: '1' });
		expect(rot).toBe(false);
	});

	/*
	 * **Ein Abschnitt aus einer Schleife ist einer.** Svelte führt den Rumpf
	 * eines `{#each}` unter `body`; im DOM erzeugt der Block nichts, das Kind
	 * steht direkt im Stapel. Eine eigene Schlüsselliste ohne `body` hielt solche
	 * Seiten für nicht umgestellt — und hätte, sobald die Schwelle steht, einen
	 * Rückschritt gemeldet, den niemand gemacht hat.
	 */
	/*
	 * **Die begründete Ausnahme zählt getrennt.** Nicht jede Seite gewinnt durch
	 * den Stapel; die Eigentümerseite braucht ihren Bestand beim Eintragen. Eine
	 * solche Seite darf nicht als Rückstand mitgezählt werden, sonst zeigt die
	 * Fortschrittszahl dauerhaft eine Aufgabe an, die niemand erledigen soll.
	 */
	it('zählt eine Seite mit begründeter Marke getrennt', () => {
		const { rot, ausgabe } = fahre(baum({ mitFlaeche: true }));
		expect(rot).toBe(false);
		expect(ausgabe).toMatch(/1 tragen noch die zweispaltige Flaeche, 1 bleiben begruendet dabei/);
		expect(ausgabe).toContain('begruendete Ausnahmen');
		expect(ausgabe).toContain('Der Bestand wird beim Eintragen gebraucht.');
	});

	/*
	 * **Eine Marke ohne Grund ist ein Schalter.** Der Doppelpunkt allein reicht
	 * nicht — sonst hätte der Wächter genau die Abschaltung, gegen die er gebaut
	 * ist.
	 *
	 * **Und sie wird benannt** (02.09.2026, aus dem Code-Review zum Umbau). Der
	 * erste Anlauf liess die Seite bloss in den Rückstand fallen: Die Zahl
	 * «begruendet dabei» sank um eins, und niemand liest eine Zahl, die um eins
	 * fällt. Der Wächter verspricht in README und `docs/gestaltung.md`, einen
	 * Satz zu verlangen — dann muss er auch sagen, wenn keiner dasteht.
	 */
	it('nennt eine Marke ohne Grund, statt sie still zum Rückstand zu zählen', () => {
		const { rot, ausgabe } = fahre(baum({ markeOhneGrund: true, mitFlaeche: true }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/Ausnahmemarke ohne Grund/);
		expect(ausgabe).toMatch(/2 tragen noch die zweispaltige Flaeche, 0 bleiben begruendet dabei/);
		expect(ausgabe).not.toContain('begruendete Ausnahmen');
	});

	/*
	 * **Der Grund darf umbrechen** (02.09.2026, aus der zweiten Runde des
	 * Code-Reviews). Gelesen wurde bis zum Zeilenende — und die Eigentümerseite
	 * im Repo schreibt ihren Grund seit dem 12.08.2026 über zwei Zeilen. Solange
	 * die Marke bloss gezählt wurde, war das eine verstümmelte Anzeige; seit sie
	 * rot machen kann, wäre ein Umbruch nach dem Doppelpunkt ein Abbruch.
	 */
	it('liest einen Grund, der über mehrere Zeilen läuft', () => {
		const { rot, ausgabe } = fahre(baum({ grundMehrzeilig: true, mitFlaeche: true }));
		expect(rot).toBe(false);
		expect(ausgabe).toContain('Der Bestand wird beim Eintragen gebraucht.');
		expect(ausgabe).toMatch(/1 tragen noch die zweispaltige Flaeche, 1 bleiben begruendet dabei/);
	});

	/*
	 * **Die Zusammenfassung steht vor dem Befund** (02.09.2026, aus dem
	 * Code-Review). Ein Abbruch davor nähme dem Leser die Fortschrittszahl, und
	 * ein gleichzeitiger Rückschritt unter die Schwelle bliebe bis zum nächsten
	 * Lauf unsichtbar.
	 */
	it('nennt Fortschritt und Schwelle auch neben einem Markenbefund', () => {
		const { rot, ausgabe } = fahre(baum({ markeVerwaist: true }), {
			SEITENAUFBAU_MINDESTENS: '99'
		});
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/von 45 Seiten folgen dem Modell/);
		expect(ausgabe).toMatch(/Ausnahmemarke ohne zweispaltige Flaeche/);
		expect(ausgabe).toMatch(/verlangt sind 99/);
	});

	/*
	 * **Der Erfolgsfall ist grün** (02.09.2026, aus dem eigenen Nachmessen).
	 *
	 * Hier stand die Umkehrung: «wird rot, wenn er keine einzige Ausnahmemarke
	 * findet». Gezählt wird eine Ausnahme nur zusammen mit ihrer Fläche, und die
	 * verschwindet, sobald die letzte Seite umgestellt ist — der Wächter hätte
	 * am Ziel gesperrt, und zwar im Pre-Commit-Hook. Ein Bestand ohne offene
	 * Ausnahme ist kein Defekt, sondern das Ende der Umstellung.
	 */
	it('bleibt grün, wenn keine Ausnahme mehr offen ist', () => {
		const { rot, ausgabe } = fahre(baum({ ohneAusnahme: true }));
		expect(rot).toBe(false);
		expect(ausgabe).toMatch(/0 tragen noch die zweispaltige Flaeche, 0 bleiben begruendet dabei/);
	});

	/*
	 * **Der Widerspruch, der an die Stelle getreten ist.** Eine Seite, die einen
	 * Grund fürs Nebeneinander nennt und keines mehr hat: Der Satz behauptet
	 * einen Zustand von gestern, und der nächste Leser glaubt ihm.
	 */
	it('wird rot bei einer Ausnahmemarke ohne zweispaltige Fläche', () => {
		const { rot, ausgabe } = fahre(baum({ markeVerwaist: true }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/Ausnahmemarke ohne zweispaltige Flaeche/);
		expect(ausgabe).toMatch(/gehoert neben\n {2}eine stehende Flaeche oder geloescht/);
	});

	it('zählt Abschnitte, die aus einer Schleife kommen', () => {
		const { rot, ausgabe } = fahre(baum({ ausSchleife: true }));
		expect(rot).toBe(false);
		expect(ausgabe).toMatch(/1 von 45 Seiten folgen dem Modell/);
	});

	/*
	 * **Eine vertippte Schwelle darf nicht beruhigen.** `Number('zwoelf')` ist
	 * `NaN`; ein Riegel, der darauf nur nicht anschlägt, gibt einen grünen Lauf
	 * heraus, und wer die Variable gesetzt hat, hält den Wächter für scharf.
	 */
	it('bricht ab, wenn die Schwelle keine Zahl ist', () => {
		const { rot, ausgabe } = fahre(baum(), { SEITENAUFBAU_MINDESTENS: 'zwoelf' });
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/keine ganze Zahl/);
	});

	/*
	 * **Der Kern der Zählung: die Verschachtelung.** `.abschnitt` gibt es im Repo
	 * auch unabhängig vom Modell. Zählte der Wächter beide Klassen bloss
	 * irgendwo in der Datei, hielte er eine Altseite für umgestellt — und die
	 * Fortschrittszahl, um derentwillen es ihn gibt, wäre erfunden.
	 */
	it('zählt einen Abschnitt nicht mit, der ausserhalb des Stapels steht', () => {
		const { rot, ausgabe } = fahre(baum({ lockerVerteilt: true }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/keine einzige Seite folgt dem Modell/);
	});

	/*
	 * **Die Flächenzahl fällt nur, wenn eine Fläche verschwindet.** Während der
	 * Umstellung trägt eine Seite beides. Stünden die zwei Zahlen in einem
	 * `else`, sänke die Flächenzahl beim ersten umgestellten Abschnitt — und
	 * sähe aus wie Fortschritt, den niemand gemacht hat.
	 */
	it('nennt eine umgestellte Seite weiter, solange ihre Fläche steht', () => {
		const { ausgabe } = fahre(baum({ beides: true }));
		expect(ausgabe).toMatch(/1 von 45 Seiten folgen dem Modell/);
		expect(ausgabe).toContain('noch zweispaltig');
		expect(ausgabe).toMatch(/umgestellt, Flaeche steht noch/);
	});
});
