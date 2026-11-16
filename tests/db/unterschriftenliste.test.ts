/**
 * Die Anwesenheits- und Unterschriftenliste — und ob ihre Zeilen lesbar sind.
 *
 * **Der Anlass** (Auftraggeber, Praxisdurchlauf 28.08.2026): «Zeilen mit zwei
 * Eigentümern sehen anders aus als solche mit einem.» Am erzeugten Dokument
 * nachgemessen war es kein Aussehen, sondern Text auf Text — siehe
 * `hoeheDerZeile` in `pdf/unterschriftenliste.ts`.
 *
 * **Warum die Prüfung über Abstände geht und nicht über Wortlaute.** Alle
 * erwarteten Wörter standen auf dem Blatt; ein Test über `textVonSeite` wäre
 * grün geblieben. Sichtbar wird der Fehler erst am Ort: zwei Grundlinien 2.9
 * Punkte auseinander, bei 9.5 Punkten Schrift.
 *
 * Das ist eine Fehlerklasse, kein Einzelfall: Jeder Satz mit fester Zeilenhöhe
 * über umbrechendem Inhalt hat sie. Der Test unten schliesst sie für dieses
 * Dokument, unabhängig davon, welcher Inhalt sie auslöst.
 */
import { describe, expect, it } from 'vitest';
import { erzeugeUnterschriftenliste, type Listenangaben } from '$lib/server/pdf/unterschriftenliste';
import { platzierungenVonSeite, type Platzierung } from './pdftext';

function angaben(zeilen: Listenangaben['zeilen']): Listenangaben {
	return {
		gemeinschaftName: 'STWEG Musterweg 1',
		gemeinschaftAdresse: 'Musterweg 1, 3000 Bern',
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Restaurant Rössli',
		stufe: 'erste',
		gesamtquote: 1000,
		kopfstimmenGesamt: zeilen.length,
		zeilen
	};
}

/** Eine Partei, die ihre Stimme selbst ausübt. */
function allein(name: string, wertquote = 300): Listenangaben['zeilen'][number] {
	return {
		name,
		ausgeuebtDurch: name,
		einheiten: ['W1'],
		kopfstimmen: 1,
		wertquote,
		bereitsErfasst: false
	};
}

/**
 * Gemeinschaftliches Eigentum: langer Name, dazu ein Vertretervermerk.
 *
 * Genau diese Gestalt hat den Befund ausgelöst — beides zusammen gibt es nur
 * hier (ZGB Art. 712o Abs. 1: eine Stimme, ausgeübt durch den Bezeichneten).
 */
function gemeinschaftlich(): Listenangaben['zeilen'][number] {
	return {
		name: 'Erbengemeinschaft Kunz-Nowak-Łukasik',
		ausgeuebtDurch: 'Ruth Kunz für Erbengemeinschaft Kunz-Nowak-Łukasik',
		einheiten: ['W2', 'PP12', 'KE4'],
		kopfstimmen: 1,
		wertquote: 400,
		bereitsErfasst: false
	};
}

/**
 * Der engste Abstand zweier Grundlinien in derselben Spalte, und wo er steht.
 *
 * Gruppiert wird nach dem linken Rand: Zwei Texte in verschiedenen Spalten
 * können beliebig nah beieinander stehen, sie überlagern sich nicht.
 */
function engsteStelle(
	platzierungen: Platzierung[]
): { abstand: number; noetig: number; oben: Platzierung; unten: Platzierung } | null {
	const spalten = new Map<number, Platzierung[]>();
	for (const p of platzierungen) {
		const schluessel = Math.round(p.x);
		spalten.set(schluessel, [...(spalten.get(schluessel) ?? []), p]);
	}

	let engste: ReturnType<typeof engsteStelle> = null;
	for (const spalte of spalten.values()) {
		const sortiert = [...spalte].sort((a, b) => b.y - a.y);
		for (let i = 1; i < sortiert.length; i++) {
			const oben = sortiert[i - 1];
			const unten = sortiert[i];
			const abstand = oben.y - unten.y;
			/*
			 * Als Untergrenze der Schriftgrad selbst, nicht der übliche
			 * Zeilenabstand von 1.35 davon: Ein knapper Satz ist kein Befund, ein
			 * überlappender schon. Wo die Unterlängen der oberen Zeile die
			 * Oberlängen der unteren berühren, ist der Text nicht mehr lesbar.
			 */
			const noetig = Math.max(oben.groesse, unten.groesse);
			if (abstand < noetig && (!engste || abstand - noetig < engste.abstand - engste.noetig)) {
				engste = { abstand, noetig, oben, unten };
			}
		}
	}
	return engste;
}

describe('Die Unterschriftenliste', () => {
	it('setzt eine Zeile mit gemeinschaftlichem Eigentum ohne Überlagerung', async () => {
		const bytes = await erzeugeUnterschriftenliste(
			angaben([allein('Anna Muster'), gemeinschaftlich(), allein('Beat Zimmermann')])
		);
		const platzierungen = await platzierungenVonSeite(bytes);

		/*
		 * **Sichtproben zuerst.** Ohne sie wäre der Test auch dann grün, wenn der
		 * Leser nichts liest oder der Name gar nicht umbricht — also gerade dann,
		 * wenn er den Fall verfehlt, für den er gebaut ist.
		 */
		expect(platzierungen.length).toBeGreaterThan(15);
		const namensspalte = platzierungen.filter((p) => Math.round(p.x) === 45);
		expect(namensspalte.filter((p) => p.text.includes('Kunz')).length).toBeGreaterThanOrEqual(3);
		expect(namensspalte.some((p) => p.text.startsWith('Stimme:'))).toBe(true);

		const engste = engsteStelle(platzierungen);
		expect(
			engste &&
				`«${engste.oben.text}» und «${engste.unten.text}» liegen ${engste.abstand.toFixed(1)} ` +
					`Punkte auseinander, nötig wären ${engste.noetig}`
		).toBeNull();
	});

	it('lässt die Zeilen ohne Vermerk so hoch wie zuvor', async () => {
		const bytes = await erzeugeUnterschriftenliste(
			angaben([allein('Anna Muster'), allein('Beat Zimmermann')])
		);
		const namen = (await platzierungenVonSeite(bytes)).filter(
			(p) => Math.round(p.x) === 45 && (p.text === 'Anna Muster' || p.text === 'Beat Zimmermann')
		);
		expect(namen).toHaveLength(2);
		// 11 mm Mindesthöhe, in Punkten: 11 / 25.4 * 72.
		expect(namen[0].y - namen[1].y).toBeCloseTo(31.18, 1);
	});

	it('trägt die Gemeinschaft auf jedem Blatt, auch nach dem Umbruch', async () => {
		const viele = Array.from({ length: 40 }, (_, i) => allein(`Partei ${i + 1}`, 25));
		const bytes = await erzeugeUnterschriftenliste(angaben(viele));
		const { PDFDocument } = await import('pdf-lib');
		const seitenzahl = (await PDFDocument.load(bytes)).getPageCount();
		expect(seitenzahl).toBeGreaterThan(1);

		for (let i = 0; i < seitenzahl; i++) {
			const texte = (await platzierungenVonSeite(bytes, i)).map((p) => p.text);
			expect(texte.join(' ')).toContain('STWEG Musterweg 1');
		}
	});

	it('hält die Zeilen auch auf den Folgeblättern auseinander', async () => {
		const viele = Array.from({ length: 30 }, () => gemeinschaftlich());
		const bytes = await erzeugeUnterschriftenliste(angaben(viele));
		const { PDFDocument } = await import('pdf-lib');
		const seitenzahl = (await PDFDocument.load(bytes)).getPageCount();
		expect(seitenzahl).toBeGreaterThan(1);

		for (let i = 0; i < seitenzahl; i++) {
			const engste = engsteStelle(await platzierungenVonSeite(bytes, i));
			expect(engste && `Blatt ${i + 1}: «${engste.oben.text}» über «${engste.unten.text}»`).toBeNull();
		}
	});
});
