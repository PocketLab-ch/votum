import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { svelteBaum, svelteDateien } from '../../scripts/svelte-baum.mjs';

/**
 * Der Wächter über die Suchschwelle, und sein Gegentest.
 *
 * **Der Anlass** (Auftraggeber, 27.08.2026): «Fehlt bei Gemeinschaft die Schnellsuche?»
 * Sie fehlte nicht. Sie stand unter einer anderen Regel als die Liste daneben:
 * Gemeinschaften ab neun Einträgen, Personen und Eigentümer ab einem. Die
 * gemeinsame Zahl [SUCHSCHWELLE] stand die ganze Zeit da, mit dem Vermerk, sie
 * stehe an einer Stelle, damit sie nicht auseinanderläuft. Eine Konstante, die
 * niemand einbindet, verhindert nichts.
 *
 * **Gelesen wird der Syntaxbaum, nicht der Dateitext.** Die erste Fassung
 * dieses Wächters suchte am selben Tag nach `class="suchfeld"` und urteilte je
 * Datei. Nachgemessen sah sie 10 von 15 Feldern, hielt zwei Felder einer Datei
 * für geregelt, sobald eines es war, und wäre auf `class="suchfeld gross"`
 * hereingefallen. Genau diese blinden Stellen führt `docs/bauweise.md` als Grund auf,
 * warum die Wächter am 24.08.2026 auf `scripts/svelte-baum.mjs` umgestellt
 * wurden.
 *
 * **Die Ausnahmen stehen namentlich, mit Grund und mit Anzahl.** Ohne Ausweg
 * wird eine Regel beim ersten Sonderfall abgeschaltet statt gelesen; ohne
 * Anzahl bleibt ein zusätzliches Feld in einer schon entschuldigten Datei
 * unbemerkt.
 */

/** Wo ein Suchfeld ohne Schwelle steht: wie viele, und warum. */
const OHNE_SCHWELLE: Record<string, { anzahl: number; grund: string }> = {
	'src/routes/tage/[id=kennung]/einlass/+page.svelte': {
		anzahl: 1,
		grund:
			'Saalsicht. Am Eingang steht jemand mit einem Namen, nicht mit einer Zeilennummer ' +
			'(Auftraggeber, 25.08.2026: «Alle Parteien auch mit einer Schnellsuche ausstatten»).'
	},
	'src/routes/versammlungen/[id=kennung]/anwesenheit/+page.svelte': {
		anzahl: 1,
		grund: 'Saalsicht, dieselbe Begründung wie am Einlass.'
	},
	'src/routes/versammlungen/neu/+page.svelte': {
		anzahl: 1,
		grund:
			'Am 11.08.2026 ausdrücklich entfernt: Die Schwelle traf beim einzelnen Weg, beim ' +
			'gemeinsamen nicht. Bei sechs Häusern sah man das Feld auf einer der beiden Seiten ' +
			'und hielt es für einen Mangel.'
	},
	'src/routes/verlauf/+page.svelte': {
		anzahl: 1,
		grund:
			'Serversuche über den ganzen Verlauf, ein Formular mit `method="GET"`. Die Seite hält ' +
			'den Bestand gar nicht, es gibt hier nichts zu zählen.'
	},
	'src/routes/+page.svelte': {
		anzahl: 1,
		grund:
			'Schnellsuche der Startseite, ebenfalls `method="GET"`, und sie sucht nicht in der ' +
			'Übersicht, sondern schickt den Begriff an `/versammlungen`.'
	},
	'src/routes/versammlungen/+page.svelte': {
		anzahl: 1,
		grund:
			'Das Feld nimmt den Begriff aus `?suche=` entgegen, den die Schnellsuche der ' +
			'Startseite setzt. Hinge es an einer Schwelle, filterte die Liste unterhalb davon ' +
			'nach einem Begriff, den niemand sieht und niemand löschen kann (27.08.2026, aus ' +
			'dem Code-Review).'
	},
	'src/routes/betreiber/+page.svelte': {
		anzahl: 2,
		grund:
			'Beide Tabellen tragen die Suche auf ausdrückliche Ansage (Auftraggeber, 25.08.2026: «Die ' +
			'Suche fehlte hier»); `e2e/durchspielen.mjs` behauptet davon die der Betriebsdaten. ' +
			'Eine Schwelle nähme sie unterhalb von neun wieder weg.'
	},
	'src/lib/components/Wahlliste.svelte': {
		anzahl: 1,
		grund: 'Auswahlbaustein im Saal, keine Übersichtsliste: er wählt einen Eintrag aus.'
	},
	'src/lib/components/VollmachtFuer.svelte': {
		anzahl: 1,
		grund: 'Auswahlbaustein, dieselbe Begründung wie `Wahlliste`.'
	},
	'src/lib/components/Erfordernisauswahl.svelte': {
		anzahl: 1,
		grund: 'Auswahlbaustein im Formular, keine Liste.'
	}
};

interface Feld {
	pfad: string;
	zeile: number;
	geschuetzt: boolean;
}

/**
 * Jedes `<input type="search">` einer Datei, mit der Angabe, ob es in einem
 * `{#if}` steht, dessen Bedingung `brauchtSuchfeld` ruft.
 *
 * Der Lauf trägt den Schutz durch den Baum: Was im `{:else}`-Zweig steht, ist
 * nicht geschützt, auch wenn der `{#if}` darüber die Regel nennt.
 */
export function suchfelder(pfad: string, quelle: string): Feld[] {
	const baum = svelteBaum(pfad, quelle);
	if (!baum) throw new Error(`${pfad} liess sich nicht übersetzen`);
	const gefunden: Feld[] = [];

	/**
	 * Trägt diese Bedingung die Regel?
	 *
	 * **Eine Verneinung trägt sie nicht** (27.08.2026, aus dem Nachlauf des
	 * Reviews): `{#if !brauchtSuchfeld(…)}` zeigt das Feld genau unterhalb der
	 * Schwelle und ginge sonst als geregelt durch.
	 *
	 * **Ein blosser Bezeichner wird aufgelöst.** `Suchauswahl.svelte` schaltet
	 * über `{#if suchbar}`, und `suchbar` ist aus `brauchtSuchfeld` abgeleitet.
	 * Ohne diesen Schritt bräuchte der Baustein eine Ausnahme, und die Ausnahme
	 * wäre eine Behauptung: Wer `{#if suchbar}` zu `{#if montiert}` änderte,
	 * gäbe jedem Auswahlfeld ab einem Eintrag ein Suchfeld, und niemand meldete
	 * es.
	 */
	const traegtDieRegel = (bedingung: string): boolean => {
		if (bedingung.includes('!brauchtSuchfeld(')) return false;
		if (bedingung.includes('brauchtSuchfeld(')) return true;
		const bezeichner = bedingung.trim();
		if (!/^[A-Za-z_$][\w$]*$/.test(bezeichner)) return false;
		const skript = baum.instance
			? quelle.slice(baum.instance.content.start, baum.instance.content.end)
			: '';
		const zuweisung = new RegExp(
			`(?:const|let)\\s+${bezeichner}\\s*=([\\s\\S]*?);\\s*(?:\\n|$)`
		).exec(skript);
		return Boolean(zuweisung && zuweisung[1].includes('brauchtSuchfeld('));
	};

	const gehe = (knoten: unknown, geschuetzt: boolean): void => {
		if (!knoten || typeof knoten !== 'object') return;
		if (Array.isArray(knoten)) {
			for (const k of knoten) gehe(k, geschuetzt);
			return;
		}
		const n = knoten as Record<string, any>;
		if (n.type === 'RegularElement' && n.name === 'input') {
			const typ = (n.attributes ?? []).find((a: any) => a.name === 'type');
			if ((typ?.value?.[0]?.data ?? typ?.value?.raw) === 'search') {
				gefunden.push({
					pfad,
					zeile: quelle.slice(0, n.start).split('\n').length,
					geschuetzt
				});
			}
		}
		if (n.type === 'IfBlock') {
			const bedingung = quelle.slice(n.test.start, n.test.end);
			gehe(n.consequent, geschuetzt || traegtDieRegel(bedingung));
			gehe(n.alternate, geschuetzt);
			return;
		}
		for (const [schluessel, wert] of Object.entries(n)) {
			if (schluessel === 'parent' || schluessel === 'type') continue;
			gehe(wert, geschuetzt);
		}
	};
	gehe(baum.fragment, false);
	return gefunden;
}

/** Was nicht stimmt: ein Feld ohne Regel, oder eine Ausnahme, die nicht passt. */
export function befunde(felder: Feld[], bekannteDateien: string[]): string[] {
	const meldungen: string[] = [];
	const offenJeDatei = new Map<string, number>();
	for (const f of felder) {
		if (f.geschuetzt) continue;
		offenJeDatei.set(f.pfad, (offenJeDatei.get(f.pfad) ?? 0) + 1);
	}

	for (const [pfad, offen] of offenJeDatei) {
		const ausnahme = OHNE_SCHWELLE[pfad];
		if (!ausnahme) {
			meldungen.push(
				`${pfad} zeigt ${offen} Suchfeld(er) ohne Schwelle. Entweder in ein ` +
					'{#if brauchtSuchfeld(…)} setzen oder mit Grund in OHNE_SCHWELLE eintragen.'
			);
		} else if (ausnahme.anzahl !== offen) {
			meldungen.push(
				`${pfad}: ${offen} Suchfeld(er) ohne Schwelle, begründet sind ${ausnahme.anzahl}.`
			);
		}
	}

	for (const [pfad, ausnahme] of Object.entries(OHNE_SCHWELLE)) {
		if (!bekannteDateien.includes(pfad)) {
			meldungen.push(`${pfad} steht in OHNE_SCHWELLE, gibt es aber nicht mehr.`);
		} else if (!offenJeDatei.has(pfad)) {
			meldungen.push(
				`${pfad} steht in OHNE_SCHWELLE, hat aber kein ungeschütztes Suchfeld mehr — ` +
					`der Eintrag ist überflüssig geworden (${ausnahme.grund.slice(0, 40)}…).`
			);
		}
	}
	return meldungen;
}

describe('Die Suchschwelle steht an einer Stelle', () => {
	const dateien = svelteDateien('src') as string[];
	const felder = dateien.flatMap((p) => suchfelder(p, readFileSync(p, 'utf-8')));

	/*
	 * **Ohne diese Zeile wäre alles darunter still**, sobald der Lauf nichts
	 * mehr findet. Gezählt am 27.08.2026: 15 Felder, davon 4 an der Schwelle.
	 * Die Untergrenze liegt bewusst darunter, damit ein gemeinsamer Baustein,
	 * der Felder zusammenlegt, den Wächter nicht im guten Zustand rot macht.
	 */
	it('findet die Suchfelder überhaupt', () => {
		expect(felder.length, `Nur ${felder.length} Suchfelder gefunden — greift der Lauf noch?`)
			.toBeGreaterThanOrEqual(10);
		expect(felder.filter((f) => f.geschuetzt).length).toBeGreaterThanOrEqual(3);
	});

	it('ist über den ganzen Bestand still', () => {
		expect(befunde(felder, dateien)).toEqual([]);
	});

	// ── Gegenproben an echten Dateien: rot im schlechten Zustand ──────────

	const sichtprobe = 'src/routes/personen/+page.svelte';

	it(`sieht das Feld in ${sichtprobe} und erkennt es als geschützt`, () => {
		const gefunden = suchfelder(sichtprobe, readFileSync(sichtprobe, 'utf-8'));
		expect(gefunden).toHaveLength(1);
		expect(gefunden[0].geschuetzt).toBe(true);
	});

	it(`meldet ${sichtprobe}, sobald die Schwelle dort herausfällt`, () => {
		/*
		 * **Die Regel wird umbenannt, nicht die Zeile getroffen** (27.08.2026).
		 * Die erste Fassung ersetzte den Bedingungstext wörtlich und ging beim
		 * ersten Umbau des Aufrufs ins Leere: Sie fand nichts, die Quelle blieb
		 * unverändert, und die Gegenprobe meldete «erwartet false, war true»
		 * statt einer Aussage über die Sache.
		 */
		const quelle = readFileSync(sichtprobe, 'utf-8').replaceAll('brauchtSuchfeld(', 'istEgal(');
		const gefunden = suchfelder(sichtprobe, quelle);
		expect(gefunden).toHaveLength(1);
		expect(gefunden[0].geschuetzt).toBe(false);
		expect(befunde(gefunden, [sichtprobe])[0]).toMatch(/ohne Schwelle/);
	});

	it('lässt sich von einer Verneinung nicht täuschen', () => {
		const gefunden = suchfelder(
			'erfunden.svelte',
			'{#if !brauchtSuchfeld({ durchsuchbar: a, archiviert: b })}<input type="search" />{/if}'
		);
		expect(gefunden[0].geschuetzt).toBe(false);
	});

	it('löst einen abgeleiteten Bezeichner auf', () => {
		const gefunden = suchfelder(
			'erfunden.svelte',
			'<script>const suchbar = $derived(brauchtSuchfeld({ durchsuchbar: n, archiviert: 0 }));</script>' +
				'{#if suchbar}<input type="search" />{/if}'
		);
		expect(gefunden[0].geschuetzt).toBe(true);
	});

	it('lässt sich von einem Bezeichner ohne Regel nicht täuschen', () => {
		const gefunden = suchfelder(
			'erfunden.svelte',
			'<script>const montiert = $state(false);</script>' +
				'{#if montiert}<input type="search" />{/if}'
		);
		expect(gefunden[0].geschuetzt).toBe(false);
	});

	it('lässt sich von einem brauchtSuchfeld im {:else}-Zweig nicht täuschen', () => {
		const gefunden = suchfelder(
			'erfunden.svelte',
			'{#if brauchtSuchfeld(a, b)}<p>x</p>{:else}<input type="search" />{/if}'
		);
		expect(gefunden[0].geschuetzt).toBe(false);
	});

	it('sieht ein Feld auch mit zweiter Klasse und einfachen Anführungszeichen', () => {
		const gefunden = suchfelder(
			'erfunden.svelte',
			"<label class='suchfeld gross'><input type=\"search\" /></label>"
		);
		expect(gefunden).toHaveLength(1);
	});

	it('meldet ein zweites, ungeschütztes Feld in einer schon entschuldigten Datei', () => {
		const pfad = 'src/routes/verlauf/+page.svelte';
		const zweiFelder: Feld[] = [
			{ pfad, zeile: 59, geschuetzt: false },
			{ pfad, zeile: 99, geschuetzt: false }
		];
		expect(befunde(zweiFelder, [pfad])[0]).toMatch(/begründet sind 1/);
	});

	it('meldet eine Ausnahme, deren Datei verschwunden ist', () => {
		expect(befunde([], [])).toHaveLength(Object.keys(OHNE_SCHWELLE).length);
	});

	it('meldet eine Ausnahme, die überflüssig geworden ist', () => {
		const pfad = 'src/routes/verlauf/+page.svelte';
		// Alle Dateien mitgeben, sonst gehen die übrigen Ausnahmen als «gibt es
		// nicht mehr» durch und verdecken die eine Meldung, um die es hier geht.
		const gemeldet = befunde([{ pfad, zeile: 59, geschuetzt: true }], Object.keys(OHNE_SCHWELLE));
		expect(gemeldet.filter((m) => m.startsWith(pfad))[0]).toMatch(/überflüssig/);
	});
});
