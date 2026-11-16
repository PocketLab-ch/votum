/**
 * Eine Absage steht neben ihrem Gegenstand — festgehalten am Markup.
 *
 * **Der Anlass** (Auftraggeber, Praxisdurchlauf 28.08.2026): «‹Voten ausformulieren
 * lassen› zeigt kein Vorher/Nachher, und ich bin nicht sicher, ob die Funktion
 * sauber arbeitet.» Das Nebeneinander gab es seit dem 05.08.2026 — aber nur im
 * Erfolgsfall. Wurde ein Absatz verworfen, stand allein der Grund da («Der
 * Absatz nennt eine Zahl, die in der Notiz nicht vorkommt»), ohne die Notiz, um
 * die es ging.
 *
 * Damit sah man ausgerechnet dort am wenigsten, wo die Anwendung eingegriffen
 * hat — und das ist die Stelle, an der jemand wissen will, ob das Werkzeug
 * taugt. Genau danach hat der Auftraggeber gefragt.
 *
 * **Diese Probe ist bewusst schwach, und sie sagt es selbst.** Sie liest den
 * Dateiinhalt und verhindert genau eines: dass die Notiz still wieder aus dem
 * Verwerfungszweig verschwindet. Was sie NICHT kann, ist zeigen, dass am
 * Bildschirm etwas Lesbares steht — dafür bräuchte es einen Durchstich mit
 * echtem Modellaufruf, und der Verwerfungsfall lässt sich nicht bestellen: Er
 * hängt daran, was das Modell antwortet.
 *
 * Der Verwerfungszweig ist deshalb **nicht am laufenden System gezeigt worden**.
 * Das steht hier, damit die nächste Sitzung es weiss und nicht für geprüft
 * hält.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SEITE = join(
	process.cwd(),
	'src/routes/versammlungen/[id=kennung]/protokoll/+page.svelte'
);

/**
 * Der Inhalt ohne Kommentare.
 *
 * **Sonst trifft die Probe ihre eigene Begründung** — dieselbe Falle, in die
 * der erste Anlauf des Fokusmarken-Tests am 02.09.2026 gelaufen ist: Der
 * Kommentar über dem Zweig nennt `v.notiz` wörtlich, und der Test wäre grün
 * geblieben, nachdem jemand das Markup entfernt hat.
 */
function markup(): string {
	return readFileSync(SEITE, 'utf8')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * Was zwischen `{:else}` und dem zugehörigen `{/if}` steht — der Zweig, der
 * greift, wenn kein Absatz übrig blieb.
 *
 * **Bis zum `{/if}`, nicht bis zum `{/each}`** (erster Anlauf, 02.09.2026): Im
 * Block steht eine innere Schleife über die Hinweise, und deren `{/each}` liegt
 * **vor** dem `{:else}`. Der Ausschnitt war damit leer, und der Test scheiterte
 * an der falschen Zusicherung — sichtbar nur, weil er überhaupt rot wurde.
 */
function verwerfungszweig(inhalt: string): string {
	const anker = inhalt.indexOf('{#each e.vorschlaege as v');
	expect(anker, 'Die Schleife über die Vorschläge gibt es nicht mehr').toBeGreaterThan(-1);
	const ab = inhalt.slice(anker);
	const trennung = ab.indexOf('{:else}');
	expect(trennung, 'Den Zweig ohne Absatz gibt es nicht mehr').toBeGreaterThan(-1);
	const zweig = ab.slice(trennung);
	const ende = zweig.indexOf('{/if}');
	expect(ende, 'Der Zweig hat kein Ende — der Ausschnitt passt nicht mehr').toBeGreaterThan(-1);
	return zweig.slice(0, ende);
}

describe('Der verworfene Vorschlag', () => {
	/*
	 * **Die Sichtproben zuerst.** Ohne sie wäre der Test auch dann grün, wenn die
	 * ganze Datei umgebaut oder der Abschnitt entfernt wurde — also gerade dann,
	 * wenn er etwas melden müsste.
	 */
	it('steht in einer Datei, die den Abschnitt überhaupt noch führt', () => {
		const inhalt = markup();
		expect(inhalt.length).toBeGreaterThan(5000);
		expect(inhalt).toContain('?/kientwurf');
		expect(inhalt).toContain('class="gegenueber"');
	});

	it('zeigt die Notiz neben dem Grund, nicht den Grund allein', () => {
		const zweig = verwerfungszweig(markup());
		expect(zweig, 'der Grund fehlt').toContain('v.grund');
		expect(
			zweig,
			'Der Grund steht ohne die Notiz da, um die es ging — dann kann niemand ' +
				'prüfen, ob die Verwerfung berechtigt war.'
		).toContain('v.notiz');
	});
});
