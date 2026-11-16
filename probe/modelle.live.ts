/**
 * Der ganze Weg gegen die echten Modelle — nicht Teil des Prüflaufs.
 *
 * Erfasste Namen → maskieren → Modell → zurücksetzen. Drei Fragen entscheiden:
 * **Rutscht ein echter Name hinaus?**, **hält das Modell die Platzhalter
 * durch?** und **liest sich das Ergebnis wie ein Protokoll?**
 */
import { describe, expect, it } from 'vitest';
import { enthuelle, maskiereFelder, schild, type Namenstraeger } from '$lib/domain/namensschutz';

const GEMEINSCHAFT: Namenstraeger[] = [
	{ id: 'p1', name: 'Anna Meier' },
	{ id: 'p2', name: 'Peter Meier' },
	{ id: 'p3', name: 'Familie Müller-Keller' },
	{ id: 'p4', name: 'Beat Winter' },
	{ id: 'p5', name: 'Marc Probère' },
	{ id: 'p6', name: 'Bauherren AG' },
	{ id: 'p7', name: 'Sandra Frei' }
];
const S = schild(GEMEINSCHAFT);

const ECHTE_NAMEN =
	/\b(Meier|M[üu]e?ller|Keller|Winter|Prob[èe]re|Bauherren|Frei|Anna|Peter|Beat|Marc|Sandra)\b/gi;
const PLATZ = /\[\s*(?:Person|Name)\s*\d+[a-z]?\s*\]/gi;

interface Stufe {
	nummer: number;
	name: string;
	url: string;
	modell: string;
	schluessel: string;
}

function stufen(): Stufe[] {
	const aus: Stufe[] = [];
	for (let n = 1; n <= 9; n++) {
		const url = process.env[`VERSAMMLUNG_KI_${n}_URL`];
		const modell = process.env[`VERSAMMLUNG_KI_${n}_MODELL`];
		if (!url || !modell) break;
		aus.push({
			nummer: n,
			name: process.env[`VERSAMMLUNG_KI_${n}_NAME`] ?? String(n),
			url,
			modell,
			schluessel: process.env[`VERSAMMLUNG_KI_${n}_SCHLUESSEL`] ?? ''
		});
	}
	return aus;
}

async function frage(s: Stufe, system: string, auftrag: string) {
	const t0 = Date.now();
	const r = await fetch(s.url, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${s.schluessel}` },
		body: JSON.stringify({
			model: s.modell,
			temperature: 0.2,
			max_tokens: 900,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: auftrag }
			]
		}),
		signal: AbortSignal.timeout(60_000)
	});
	const d = (await r.json()) as { choices?: { message?: { content?: string } }[] };
	return { text: d.choices?.[0]?.message?.content ?? '', ms: Date.now() - t0 };
}

const HINWEIS =
	'Personen erscheinen als Platzhalter in eckigen Klammern: [Person 1] ist eine bestimmte Person, ' +
	'[Person 1b] dieselbe Person in anderer Schreibweise, [Name 1] jemand, der sich nicht eindeutig ' +
	'zuordnen liess. Das ist Absicht und kein Mangel des Textes — bemängle die Platzhalter nicht. ' +
	'Gib sie IMMER unverändert wieder und erfinde keine neuen.';

/** Ein Traktandum, in dem jede Schreibweise einmal vorkommt. */
const TRAKTANDUM = {
	titel: 'Sanierung Balkon Familie Müller-Keller',
	inhalt:
		'Der Balkon von Mueller-Keller ist undicht. Anna Meier hat bei der Bauherren AG eine Offerte ' +
		'eingeholt. Meiers Vorschlag lautet, im Winter zu sanieren; Beat Winter widerspricht. ' +
		'Frau Frei und M. Probère verlangen eine zweite Offerte.',
	wortlaut: 'Die Versammlung beschliesst die Sanierung des Balkons.'
};

const NOTIZEN = {
	notiz:
		'A. Meier stellt die Offerte über CHF 24’800 vor. Keller fragt nach der Garantie. ' +
		'Beat Winter weist auf die Rückstellung hin. Sandra Frei enthält sich.',
	beschluss: 'Angenommen mit 412 von 1000 Wertquoten und 7 von 12 Köpfen.'
};

describe.each(stufen())('Stufe $nummer — $name ($modell)', (s: Stufe) => {
	it('bekommt keinen echten Namen zu sehen', () => {
		const m = maskiereFelder(S, TRAKTANDUM);
		const hinaus = Object.values(m.felder).join('\n');
		const uebrig = hinaus.match(ECHTE_NAMEN) ?? [];
		console.log(`\n── Was hinausgeht (${m.anzahl} Namen ersetzt):\n${hinaus}\n`);
		expect(uebrig, 'echter Name im ausgehenden Text').toEqual([]);
	});

	it('hält bei der Traktandenprüfung die Platzhalter durch', async () => {
		const m = maskiereFelder(S, TRAKTANDUM);
		const { text, ms } = await frage(
			s,
			`Du prüfst Traktanden einer Stockwerkeigentümerversammlung auf Verständlichkeit und formale Richtigkeit. ${HINWEIS}\n` +
				'Antworte ausschliesslich mit JSON: {"befunde":[{"schwere":"hoch|mittel|tief","was":"...","vorschlag":"..."}]}',
			`Titel: ${m.felder.titel}\nInhalt: ${m.felder.inhalt}\nAntragswortlaut: ${m.felder.wortlaut}`
		);
		const gefunden = [...new Set(text.match(PLATZ) ?? [])].map((g) => g.replace(/\s+/g, ' '));
		const erfunden = gefunden.filter((g) => m.rueckweg[g] === undefined);
		const zurueck = enthuelle(m.rueckweg, text);

		console.log(`  ${ms} ms | Platzhalter: ${gefunden.join(' ') || '—'}`);
		console.log(`  erfunden: ${erfunden.join(' ') || 'keine'}`);
		console.log(`  zurückgesetzt: ${zurueck.replace(/\s+/g, ' ').slice(0, 300)}`);

		expect(text.match(ECHTE_NAMEN), 'Modell hat einen echten Namen erfunden').toBeNull();
		// Ein erfundener Platzhalter bleibt sichtbar stehen — er darf nie zu einem Namen werden.
		for (const e of erfunden) expect(zurueck).toContain(e);
	});

	it('hält beim Protokollentwurf die Platzhalter durch', async () => {
		const m = maskiereFelder(S, NOTIZEN);
		const { text, ms } = await frage(
			s,
			`Du formulierst den Verbindungstext eines Versammlungsprotokolls. ${HINWEIS} ` +
				'Zahlen und Beschlusswortlaute übernimmst du unverändert. Zwei bis drei Sätze, nüchtern, ohne Anrede.',
			`Notizen: ${m.felder.notiz}\nBeschluss: ${m.felder.beschluss}`
		);
		const gefunden = [...new Set(text.match(PLATZ) ?? [])].map((g) => g.replace(/\s+/g, ' '));
		const erfunden = gefunden.filter((g) => m.rueckweg[g] === undefined);
		const zurueck = enthuelle(m.rueckweg, text);

		console.log(`  ${ms} ms | Platzhalter: ${gefunden.join(' ') || '—'} | erfunden: ${erfunden.join(' ') || 'keine'}`);
		console.log(`  ENTWURF: ${zurueck.replace(/\s+/g, ' ')}`);

		expect(text.match(ECHTE_NAMEN), 'Modell hat einen echten Namen erfunden').toBeNull();
		expect(zurueck).toMatch(/24.800/);
		// Die Namen müssen wieder dastehen, sonst ist der Entwurf unbrauchbar.
		expect(zurueck).toMatch(ECHTE_NAMEN);
	});
});
