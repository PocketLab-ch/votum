/**
 * Lesart L10 im Kern (Migration 189, Fassung 2026-11-10; Entscheid 0044,
 * zweiter Nachtrag, R1 (b)): Katalog, Wirkung an der Ermächtigung zur
 * Ausschlussklage, Zählung mit und ohne die Angehörigen, das zweite Ergebnis
 * und der Satz vor der Abstimmung.
 *
 * **Der Anlass:** Art. 649b Abs. 2 nimmt aus der Zahl aller Miteigentümer nur
 * den Beklagten. Dass seine Angehörigen im Ausstand nicht mitstimmen, folgt aus
 * Art. 68 ZGB (BGer 5A_198/2014 E. 5.4); ob sie dann auch aus der Zahl fallen,
 * sagt für die Ausschlussklage keine Stelle. Votum rechnet nach der Vorgabe mit
 * ihnen und nennt daneben das Ergebnis ohne sie.
 *
 * Elf Eigentümer zu je 100: p11 ist der Beklagte, p10 seine Ehefrau mit eigener
 * Wohnung im Ausstand, p1 bis p9 sind da. Fünf Ja, vier Nein. Mit den
 * Angehörigen in der Zahl sind sechs Ja von zehn nötig, ohne sie fünf von neun.
 */
import { describe, expect, it } from 'vitest';
import {
	angehoerigenlesartVon,
	LESARTEN_VORGABE,
	lesartVon,
	pruefeLesartenwahl,
	wahlInWorten,
	wendeLesartAn
} from '$lib/domain/lesarten';
import {
	ANGEHOERIGENLESART_AB,
	angehoerigeNachzuziehen,
	angehoerigenlesartWirkt,
	ausstandBleibtInDerZahl,
	uebersteuere,
	waehleErfordernis,
	waehlbareErfordernisse,
	type Erfordernis
} from '$lib/domain/entscheidbaum';
import {
	andereLesartInWorten,
	andereLesartenVon,
	ANGEHOERIGE_FALLEN_HERAUS,
	ANGEHOERIGENLESART_HINWEIS,
	angehoerigenhinweis,
	angehoerigenlesartHinweis,
	ausstandMitAngehoerigenergebnis,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { mappenpostenAus } from '$lib/domain/auszaehlmappe';
import { istKalendertag } from '$lib/domain/datum';
import { vertreterkennung } from '$lib/domain/vollmacht';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';
import { holeRegelwerk } from '$lib/rules';

const NEU = holeRegelwerk('2026-11-10');
const KLAGE = waehleErfordernis(NEU, 'k-ausschlussklage').ergebnis!;

/** Elf Eigentümer zu je 100; p11 ist der Beklagte, p10 seine Ehefrau. */
function elf(): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-11-10T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1100,
		parties: Array.from({ length: 11 }, (_, i) => ({
			partyId: `p${i + 1}`,
			displayName: `Partei ${i + 1}`,
			representativeName: null,
			isCommunity: false,
			units: [
				{
					unitId: `p${i + 1}-u`,
					label: `Whg ${i + 1}`,
					kind: 'unit' as const,
					countsAsHead: true,
					quota: 100
				}
			]
		}))
	};
}

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-11-10T19:10:00.000Z',
		recordedByChair: false
	}));
}

/** p1 bis p5 Ja, p6 bis p9 Nein; p10 im Ausstand, p11 der Beklagte. */
function klage(e: Erfordernis, geheim = false): Auszaehlungslage {
	return {
		momentaufnahme: elf(),
		erfordernis: e,
		stimmen: stimmen(
			['p1', 'yes'],
			['p2', 'yes'],
			['p3', 'yes'],
			['p4', 'yes'],
			['p5', 'yes'],
			['p6', 'no'],
			['p7', 'no'],
			['p8', 'no'],
			['p9', 'no']
		),
		anwesende: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'],
		imAusstand: ['p10'],
		betroffeneParteiIds: ['p11'],
		geheim
	};
}

describe('L10 im Katalog', () => {
	it('führt L10 mit der Vorgabe «bleiben» und zwei Wahlen ohne eigenes Mehr', () => {
		const l10 = lesartVon('L10');
		expect(l10?.vorgabe).toBe('bleiben');
		expect(l10?.wahlen.map((w) => w.wert)).toEqual(['bleiben', 'fallen_heraus']);
		expect(LESARTEN_VORGABE.L10).toBe('bleiben');
		expect(wahlInWorten('L10', 'bleiben')).toBe('Bleiben in der Zahl (Vorgabe)');
		expect(wahlInWorten('L10', 'fallen_heraus')).toBe('Fallen aus der Zahl');
		// Die Wahl ändert die Zahl, nicht das Mehr: kein eigener Mehrtyp.
		expect(l10?.wahlen.every((w) => w.mehr === undefined)).toBe(true);
	});

	it('trägt die vier Folgetexte, die der Rat nach der Auszählung braucht', () => {
		const l10 = lesartVon('L10')!;
		for (const feld of [
			'folgeMilderWahl',
			'ratNachAnnahme',
			'stattNaechsterVersammlung',
			'protokollNachAnnahme'
		] as const) {
			expect(l10[feld], feld).toBeTruthy();
		}
	});

	it('nimmt die zwei Wahlen an und weist anderes ab', () => {
		expect(pruefeLesartenwahl({ L10: 'fallen_heraus' })).toEqual({ L10: 'fallen_heraus' });
		expect(() => pruefeLesartenwahl({ L10: 'bleiben' })).not.toThrow();
		expect(() => pruefeLesartenwahl({ L10: 'mitzaehlen' })).toThrow(
			/Unbekannte Wahl «mitzaehlen» für die Lesart L10/
		);
	});

	it('ohne Angabe gilt die Vorgabe', () => {
		expect(angehoerigenlesartVon({})).toBe('bleiben');
		expect(angehoerigenlesartVon({ angehoerigenlesart: null })).toBe('bleiben');
		expect(angehoerigenlesartVon({ angehoerigenlesart: 'fallen_heraus' })).toBe('fallen_heraus');
	});
});

describe('angehoerigenlesartWirkt: nur an der Ausschlussklage, nur über alle', () => {
	it('wirkt ab der Fassung 2026-11-10 an der Ermächtigung zur Ausschlussklage', () => {
		expect(ANGEHOERIGENLESART_AB).toBe('2026-11-10');
		expect(angehoerigenlesartWirkt(KLAGE)).toBe(true);
		expect(angehoerigenlesartWirkt({ ...KLAGE, fassung: '2026-11-09' })).toBe(false);
	});

	it('wirkt nicht unter «Anwesende und Vertretene» und nicht unter einer Regel', () => {
		expect(angehoerigenlesartWirkt({ ...KLAGE, kopfbasis: 'anwesend_vertreten' })).toBe(false);
		expect(angehoerigenlesartWirkt({ ...KLAGE, quelle: 'reglement' })).toBe(false);
	});

	it('wirkt an keinem anderen Knoten', () => {
		expect(angehoerigenlesartWirkt({ ...KLAGE, knotenId: 'k-hausordnung' })).toBe(false);
	});

	it('eine Kennung, die kein Datum ist, sortiert nicht hinter jedes Datum', () => {
		expect(angehoerigenlesartWirkt({ ...KLAGE, fassung: 'weisungsregel' })).toBe(false);
	});
});

describe('ausstandBleibtInDerZahl unter L10', () => {
	it('nach der Vorgabe bleiben die Angehörigen in der Zahl', () => {
		expect(ausstandBleibtInDerZahl(KLAGE)).toBe(true);
		expect(ausstandBleibtInDerZahl({ ...KLAGE, angehoerigenlesart: 'bleiben' })).toBe(true);
	});

	it('unter «fallen_heraus» fallen sie heraus', () => {
		expect(ausstandBleibtInDerZahl({ ...KLAGE, angehoerigenlesart: 'fallen_heraus' })).toBe(false);
	});

	it('unter «Anwesende und Vertretene» bleibt es beim alten Verhalten', () => {
		const anwesende: Erfordernis = { ...KLAGE, kopfbasis: 'anwesend_vertreten' };
		expect(ausstandBleibtInDerZahl(anwesende)).toBe(false);
		expect(ausstandBleibtInDerZahl({ ...anwesende, angehoerigenlesart: 'fallen_heraus' })).toBe(
			false
		);
	});

	it('unter einer hinterlegten Regel wirkt die Wahl nicht', () => {
		const regel: Erfordernis = { ...KLAGE, quelle: 'reglement' };
		expect(ausstandBleibtInDerZahl(regel)).toBe(true);
		expect(ausstandBleibtInDerZahl({ ...regel, angehoerigenlesart: 'fallen_heraus' })).toBe(true);
	});

	it('vor der Fassung 2026-11-10 rechnet ein Traktandum wie bisher', () => {
		const alt: Erfordernis = { ...KLAGE, fassung: '2026-11-05' };
		expect(ausstandBleibtInDerZahl(alt)).toBe(true);
		expect(ausstandBleibtInDerZahl({ ...alt, angehoerigenlesart: 'fallen_heraus' })).toBe(true);
	});

	/*
	 * Die Vorgabe darf den Bestand nicht verschieben: Ohne Wahl muss dieselbe
	 * Zahl herauskommen wie vor Migration 189. Geprüft über alle wählbaren
	 * Knoten der Fassung, für beide Kopfbasis-Werte.
	 */
	it('nach der Vorgabe über alle Knoten gleich der alten Regel', () => {
		const alt = (e: Erfordernis): boolean =>
			e.knotenId === 'k-ausschlussklage' &&
			e.kopfbasis !== 'anwesend_vertreten' &&
			istKalendertag(e.fassung) &&
			e.fassung >= '2026-10-25';
		for (const auswahl of waehlbareErfordernisse(NEU)) {
			const e = waehleErfordernis(NEU, auswahl.knotenId).ergebnis!;
			for (const kopfbasis of ['alle_ausser_betroffene', 'anwesend_vertreten'] as const) {
				const probe: Erfordernis = { ...e, kopfbasis };
				expect(ausstandBleibtInDerZahl(probe), `${auswahl.knotenId} ${kopfbasis}`).toBe(
					alt(probe)
				);
			}
		}
	});
});

describe('Die Zählung mit und ohne die Angehörigen', () => {
	it('mit ihnen in der Zahl: fünf Ja von zehn, nötig sechs, abgelehnt', () => {
		const a = zaehleAus(klage(KLAGE));
		expect(a.koepfe).toMatchObject({ ja: 5, basis: 10, schwelle: 6, imAusstand: 1 });
		expect(a.angenommen).toBe(false);
	});

	it('ohne sie: fünf Ja von neun, nötig fünf, angenommen', () => {
		const a = zaehleAus(klage({ ...KLAGE, angehoerigenlesart: 'fallen_heraus' }));
		// Ohne Ausstand in der Zahl: Der Spiegel führt niemanden im Ausstand.
		expect(a.koepfe).toMatchObject({ ja: 5, basis: 9, schwelle: 5 });
		expect(a.koepfe.imAusstand ?? 0).toBe(0);
		expect(a.angenommen).toBe(true);
	});

	/*
	 * Featureprüfung E1, B7 (Auftrag Block D, «bleiben unberührt»): Die Wahl
	 * nimmt nur die Angehörigen im Ausstand heraus. Die gemeinsame Wohnung des
	 * Beklagten (`beklagtenwohnungZaehltMit`) und die vertretene Partei eines
	 * Vertreters im Ausstand zählen unter beiden Wahlen wie bisher; der
	 * Unterschied der Basis ist genau die Ehefrau p10 (Produktentscheid 0047, 1).
	 */
	it('die gemeinsame Wohnung des Beklagten bleibt unter beiden Wahlen in der Zahl', () => {
		const m = elf();
		m.parties[10] = { ...m.parties[10], isCommunity: true };
		const lage = (wahl: 'bleiben' | 'fallen_heraus') =>
			zaehleAus({ ...klage({ ...KLAGE, angehoerigenlesart: wahl }), momentaufnahme: m });
		const bleiben = lage('bleiben');
		const heraus = lage('fallen_heraus');
		expect(bleiben.koepfe).toMatchObject({ basis: 11, stimmtNicht: 1 });
		expect(heraus.koepfe).toMatchObject({ basis: 10, stimmtNicht: 1 });
		expect(heraus.koepfe.imAusstand ?? 0).toBe(0);
	});

	it('die vertretene Partei eines Vertreters im Ausstand zählt unter beiden Wahlen als ohne Zustimmung', () => {
		const ohneP9 = (wahl: 'bleiben' | 'fallen_heraus') => {
			const l = klage({ ...KLAGE, angehoerigenlesart: wahl });
			return zaehleAus({
				...l,
				stimmen: l.stimmen.filter((s) => s.partyId !== 'p9'),
				vertretungen: [{ vertreteneId: 'p9', bevollmaechtigtId: 'p10' }]
			});
		};
		for (const wahl of ['bleiben', 'fallen_heraus'] as const) {
			const a = ohneP9(wahl);
			expect(a.ohneZustimmung.find((f) => f.parteiId === 'p9')?.grund, wahl).toBe('vertretung_ruht');
			expect(a.koepfe.basis, wahl).toBe(wahl === 'bleiben' ? 10 : 9);
		}
	});

	it('der Beklagte bleibt in jeder Wahl ausser der Zahl', () => {
		for (const wahl of ['bleiben', 'fallen_heraus'] as const) {
			const a = zaehleAus(klage({ ...KLAGE, angehoerigenlesart: wahl }));
			expect(a.koepfe.basis, wahl).toBe(wahl === 'bleiben' ? 10 : 9);
		}
	});
});

describe('Das Ergebnis nach der anderen Wahl (W11, W13)', () => {
	it('nennt nach der Vorgabe das Ergebnis ohne die Angehörigen, mit Zahlen', () => {
		const a = zaehleAus(klage(KLAGE));
		expect(a.andereAngehoerigenlesart).toMatchObject({
			kennung: 'L10',
			eigeneWahl: 'Bleiben in der Zahl',
			wahl: 'Fallen aus der Zahl',
			feststellbar: true,
			angenommen: true,
			abweichend: true,
			koepfe: { ja: 5, basis: 9, schwelle: 5 }
		});
		const satz = andereLesartInWorten(a.andereAngehoerigenlesart!, false).leitung;
		expect(satz).toContain(
			'Nach der anderen Lesart («Fallen aus der Zahl»: die Rechnung ohne die Angehörigen) wäre er ' +
				'angenommen: 5 Ja von 9 Kopfstimmen, nötig 5.'
		);
	});

	it('nennt umgekehrt das strengere Ergebnis, wenn die Gemeinschaft umgestellt hat', () => {
		const a = zaehleAus(klage({ ...KLAGE, angehoerigenlesart: 'fallen_heraus' }));
		expect(a.andereAngehoerigenlesart).toMatchObject({
			eigeneWahl: 'Fallen aus der Zahl',
			wahl: 'Bleiben in der Zahl',
			angenommen: false,
			abweichend: true,
			koepfe: { ja: 5, basis: 10, schwelle: 6 }
		});
	});

	it('schreibt ins Protokoll den Satz am Ausgang, geheim ohne Zahlen', () => {
		const offen = zaehleAus(klage(KLAGE));
		expect(offen.protokollhinweise).toContainEqual({
			ort: 'ausgang',
			satz:
				'Nach der anderen Lesart («Fallen aus der Zahl»: die Rechnung ohne die Angehörigen), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag angenommen gewesen: ' +
				'5 Ja von 9 Kopfstimmen, nötig 5. ' +
				// Fachprüfung E1 L10, F-4: Die Ablehnung ermächtigt niemanden.
				'Verkündet ist die Ablehnung; ermächtigt ist damit niemand, und auch eine Anfechtung der ' +
				'Ablehnung allein ermächtigt nicht zur Klage.'
		});
		const geheim = zaehleAus(klage(KLAGE, true));
		expect(geheim.protokollhinweise).toContainEqual({
			ort: 'ausgang',
			satz:
				'Nach der anderen Lesart («Fallen aus der Zahl»: die Rechnung ohne die Angehörigen), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag angenommen gewesen. ' +
				'Verkündet ist die Ablehnung; ermächtigt ist damit niemand, und auch eine Anfechtung der ' +
				'Ablehnung allein ermächtigt nicht zur Klage.'
		});
	});

	it('steht unter den zweiten Ergebnissen des Traktandums', () => {
		const a = zaehleAus(klage(KLAGE));
		expect(andereLesartenVon(a).some((r) => r.kennung === 'L10')).toBe(true);
	});

	it('ohne Ausstand gibt es kein zweites Ergebnis: Die Wahl kann dann nichts ändern', () => {
		const a = zaehleAus({ ...klage(KLAGE), imAusstand: [] });
		expect(a.andereAngehoerigenlesart ?? null).toBeNull();
	});

	it('ein Ausstand nur des Beklagten ändert nichts: Ihn nimmt das Gesetz ohnehin aus', () => {
		const a = zaehleAus({ ...klage(KLAGE), imAusstand: ['p11'] });
		expect(a.andereAngehoerigenlesart ?? null).toBeNull();
	});

	it('an einem anderen Knoten und unter einer Regel gibt es keines', () => {
		expect(zaehleAus(klage({ ...KLAGE, knotenId: 'k-hausordnung' })).andereAngehoerigenlesart ?? null).toBeNull();
		expect(zaehleAus(klage({ ...KLAGE, quelle: 'reglement' })).andereAngehoerigenlesart ?? null).toBeNull();
	});

	it('ein Ausstand nur eines Vertreters ohne Partei ändert nichts: Er steht in keiner Zahl', () => {
		const a = zaehleAus({ ...klage(KLAGE), imAusstand: [vertreterkennung('Vertreterin Beispiel')] });
		expect(a.andereAngehoerigenlesart ?? null).toBeNull();
	});
});

describe('Die Menge für W11 und die Zählung stimmen überein', () => {
	/*
	 * Review DeepSeek zu E1, Befund 1: Die Maske filterte nur die Betroffenen
	 * heraus und zeigte W11 auch bei einem Vertreter ohne Partei im Ausstand.
	 * Beide Seiten lesen jetzt `ausstandMitAngehoerigenergebnis`; der Test
	 * hält fest, dass die Menge und die Zählung in jedem Fall übereinstimmen.
	 * Dass die Maske die Menge benutzt, misst der Wächter
	 * `tests/waechter/angehoerigenhinweis.test.ts` (Codeprüfung, M1).
	 */
	const vertreter = vertreterkennung('Vertreterin Beispiel');
	const faelle: { name: string; imAusstand: string[]; zweites: boolean }[] = [
		{ name: 'niemand', imAusstand: [], zweites: false },
		{ name: 'nur der Beklagte', imAusstand: ['p11'], zweites: false },
		{ name: 'nur ein Vertreter ohne Partei', imAusstand: [vertreter], zweites: false },
		{ name: 'Beklagter und Vertreter', imAusstand: ['p11', vertreter], zweites: false },
		{ name: 'die Angehörige', imAusstand: ['p10'], zweites: true },
		{ name: 'die Angehörige und ein Vertreter', imAusstand: ['p10', vertreter], zweites: true }
	];
	for (const wahl of ['bleiben', 'fallen_heraus'] as const) {
		for (const f of faelle) {
			it(`${wahl}, im Ausstand ${f.name}`, () => {
				const lage = { ...klage({ ...KLAGE, angehoerigenlesart: wahl }), imAusstand: f.imAusstand };
				const menge = ausstandMitAngehoerigenergebnis(f.imAusstand, lage.betroffeneParteiIds ?? []);
				const a = zaehleAus(lage);
				expect(menge.length > 0).toBe(f.zweites);
				expect(a.andereAngehoerigenlesart !== undefined).toBe(f.zweites);
			});
		}
	}
});

describe('Der Satz vor der Abstimmung (W11)', () => {
	it('nennt die Seite «Lesarten» und das zweite Ergebnis', () => {
		expect(angehoerigenlesartHinweis(KLAGE)).toBe(ANGEHOERIGENLESART_HINWEIS);
		expect(ANGEHOERIGENLESART_HINWEIS).toContain('Seite «Lesarten»');
	});

	it('unter «fallen_heraus» kommt die Folge der milden Wahl dazu', () => {
		const text = angehoerigenlesartHinweis({ ...KLAGE, angehoerigenlesart: 'fallen_heraus' })!;
		expect(text.startsWith(ANGEHOERIGENLESART_HINWEIS)).toBe(true);
		expect(text).toContain(lesartVon('L10')!.folgeMilderWahl!);
	});

	it('schweigt, wo L10 nicht wirkt', () => {
		expect(angehoerigenlesartHinweis(null)).toBeNull();
		expect(angehoerigenlesartHinweis({ ...KLAGE, fassung: '2026-11-09' })).toBeNull();
		expect(angehoerigenlesartHinweis({ ...KLAGE, kopfbasis: 'anwesend_vertreten' })).toBeNull();
		expect(angehoerigenlesartHinweis({ ...KLAGE, quelle: 'reglement' })).toBeNull();
		expect(angehoerigenlesartHinweis({ ...KLAGE, knotenId: 'k-hausordnung' })).toBeNull();
	});
});

describe('Der Hinweis an die Leitung zu den Angehörigen (W13)', () => {
	it('unter «fallen_heraus» rät er nicht mehr, von Hand zu zählen', () => {
		const text = angehoerigenhinweis({ ...KLAGE, angehoerigenlesart: 'fallen_heraus' })!;
		expect(text.endsWith(ANGEHOERIGE_FALLEN_HERAUS)).toBe(true);
	});

	it('nach der Vorgabe bleibt es beim Satz zu 1e', () => {
		const text = angehoerigenhinweis(KLAGE)!;
		expect(text).not.toContain(ANGEHOERIGE_FALLEN_HERAUS);
	});
});

/*
 * Kriterium 5: Kein Satz sagt unter «fallen_heraus» noch, die Angehörigen
 * blieben in der Zahl. Hinweis 9 der Karte ist W12, die `geltung` von L1 sagt
 * W14. Beide Sätze stehen im Regelwerk und nicht in der Auszählung, deshalb
 * prüft dieser Block den Knoten und den Katalog.
 */
describe('Die Sätze im Regelwerk (W12, W14)', () => {
	const karte = NEU.knoten.find((k) => k.id === 'k-ausschlussklage')!;
	const W12_ANFANG = 'stellt Ihre Gemeinschaft auf der Seite «Lesarten» ein';
	const W14_ANFANG = 'stellt eine eigene Frage auf dieser Seite ein';

	it('Hinweis 9 der Karte ist W12', () => {
		expect((karte.hinweise ?? []).some((h) => h.includes(W12_ANFANG))).toBe(true);
	});

	it('der alte Satz steht in keinem Hinweis der Karte mehr', () => {
		expect((karte.hinweise ?? []).some((h) => h.includes('lässt Votum sie trotzdem'))).toBe(false);
	});

	it('unter einer hinterlegten Regel trägt der Knoten W12 ebenfalls', () => {
		const unterRegel = (karte.hinweiseUnterRegel ?? []).map((u) => u.hinweis);
		expect(unterRegel.some((h) => h.includes(W12_ANFANG))).toBe(true);
	});

	it('L1 sagt W14 statt des alten Satzes', () => {
		const geltung = lesartVon('L1')!.geltung!;
		expect(geltung).toContain(W14_ANFANG);
		expect(geltung).not.toContain('Dort bleiben Angehörige');
	});
});

describe('Behebungen der Codeprüfung Block D', () => {
	const MILD = { ...KLAGE, angehoerigenlesart: 'fallen_heraus' as const };

	it('H1: Die Auszählmappe trägt keine Spalte zu L10 und unter «fallen_heraus» keine 7', () => {
		for (const e of [KLAGE, MILD]) {
			const p = mappenpostenAus({ nummer: '1', titel: 'Klage' }, e, elf(), {
				neuAnZweiter: false,
				wahl: 'erste'
			})!;
			expect((p.vergleiche ?? []).some((v) => v.kennung === 'L10')).toBe(false);
			expect(p.ausstandBleibtInDerZahl).toBe(e === KLAGE);
		}
	});

	it('Featureprüfung E1, B3: Unter L9 trägt die Mappe zum Vergleich nur die Spalte 1a, nach beiden Wahlen', () => {
		for (const wahl of ['alle', 'anwesende'] as const) {
			const e = wendeLesartAn(KLAGE, { ...LESARTEN_VORGABE, L9: wahl });
			const p = mappenpostenAus({ nummer: '1', titel: 'Klage' }, e, elf(), { neuAnZweiter: false, wahl: 'erste' })!;
			expect((p.vergleiche ?? []).map((v) => v.kennung), wahl).toEqual(['1a']);
			expect(p.vergleiche![0].rechnung.kopfbasis, wahl).toBe(wahl === 'alle' ? 'anwesend_vertreten' : 'alle_ausser_betroffene');
		}
	});

	it('M-a: Mit einer Spalte an allen (1a, A) rechnet die Mappe die Angehörigen dort mit und nennt die 7', () => {
		const l9 = { ...wendeLesartAn(KLAGE, { ...LESARTEN_VORGABE, L9: 'anwesende' }), angehoerigenlesart: 'fallen_heraus' as const };
		const abgewichen = {
			...uebersteuere(NEU, MILD, 'einfaches_mehr', 'Die Versammlung misst an den Anwesenden.', {
				kopfbasis: 'anwesend_vertreten'
			}).ergebnis,
			angehoerigenlesart: 'fallen_heraus' as const
		};
		for (const [titel, e, kennung] of [
			['L9 anwesende', l9, '1a'],
			['Abweichung der Leitung', abgewichen, 'A']
		] as const) {
			const p = mappenpostenAus({ nummer: '1', titel: 'Klage' }, e, elf(), { neuAnZweiter: false, wahl: 'erste' })!;
			expect(p.ausstandBleibtInDerZahl, titel).toBe(false);
			const anAllen = (p.vergleiche ?? []).find((v) => v.kennung === kennung);
			expect(anAllen?.rechnung.ausstandBleibtInDerZahl, titel).toBe(true);
		}
	});

	it('H2, M3: Nachzuziehen ist nur ein Traktandum ab 1e und vor L10, und nur unter «fallen_heraus»', () => {
		const zeile = (fassung: string) => ({
			knotenId: 'k-ausschlussklage',
			fassung,
			kopfbasis: 'alle_ausser_betroffene',
			quelle: 'hergeleitet'
		});
		expect(angehoerigeNachzuziehen(zeile('2026-11-05'), 'fallen_heraus')).toBe(true);
		expect(angehoerigeNachzuziehen(zeile('2026-11-05'), 'bleiben')).toBe(false);
		// Davor rechnet es schon ohne die Angehörigen, ab L10 übernimmt die Freigabe.
		expect(angehoerigeNachzuziehen(zeile('2026-10-20'), 'fallen_heraus')).toBe(false);
		expect(angehoerigeNachzuziehen(zeile(ANGEHOERIGENLESART_AB), 'fallen_heraus')).toBe(false);
		expect(angehoerigeNachzuziehen({ ...zeile('2026-11-05'), knotenId: 'k-verwaltung-wichtig' }, 'fallen_heraus')).toBe(
			false
		);
		expect(angehoerigeNachzuziehen({ ...zeile('2026-11-05'), quelle: 'reglement' }, 'fallen_heraus')).toBe(false);
		expect(
			angehoerigeNachzuziehen({ ...zeile('2026-11-05'), kopfbasis: 'anwesend_vertreten' }, 'fallen_heraus')
		).toBe(false);
	});

	it('M1: Anhang A rechnet nach Gesetz mit den Angehörigen in der Zahl, wie der Hinweis sagt', () => {
		const u = uebersteuere(NEU, MILD, 'einfaches_mehr', 'Die Versammlung misst an den Anwesenden.', {
			kopfbasis: 'anwesend_vertreten'
		}).ergebnis;
		const a = zaehleAus(klage({ ...u, angehoerigenlesart: 'fallen_heraus' }));
		// An den Anwesenden ohne die Angehörige: 5 von 9, angenommen; nach Gesetz an
		// allen mit ihr: 5 von 10, abgelehnt.
		expect(a.angenommen).toBe(true);
		expect(a.nachGesetzUndReglement).toMatchObject({ kennung: 'A', angenommen: false, abweichend: true });
	});

	it('R2-F-3: Weicht die Leitung ab und misst weiter an allen, folgt Anhang A der Einstellung zu L10', () => {
		const u = uebersteuere(NEU, MILD, 'qualifiziertes_mehr', 'So stand es in der Einladung.').ergebnis;
		const a = zaehleAus(klage({ ...u, angehoerigenlesart: 'fallen_heraus' }));
		// Qualifiziert an allen ohne die Angehörige verfehlt; nach Gesetz, wie ohne
		// Abweichung gerechnet, 5 von 9 und angenommen.
		expect(a.angenommen).toBe(false);
		expect(a.nachGesetzUndReglement).toMatchObject({ kennung: 'A', angenommen: true, abweichend: true });
	});

	it('R3-F-1: Kam das Mass aus dem Reglement, wirkt L10 auch an Anhang A nicht', () => {
		const ausRegel: Erfordernis = { ...MILD, quelle: 'reglement', fundstelle: 'Art. 20' };
		const u = uebersteuere(NEU, ausRegel, 'qualifiziertes_mehr', 'So stand es in der Einladung.').ergebnis;
		expect(u.gesetzlich?.ausReglement).toBe(true);
		const a = zaehleAus(klage({ ...u, angehoerigenlesart: 'fallen_heraus' }));
		// Nach der Bestimmung mit der Angehörigen in der Zahl: 5 von 10, verfehlt,
		// wie ohne Abweichung; ohne sie wären 5 von 9 genug.
		expect(a.nachGesetzUndReglement?.angenommen ?? false).toBe(false);
	});

	it('M2: Die Handzählung nennt das Ergebnis nach der anderen Wahl', () => {
		const { stimmen: _s, ...ohneStimmen } = klage(KLAGE);
		void _s;
		const a = zaehleSummenAus(ohneStimmen, { ja: 5, nein: 4, enthaltung: 0 });
		expect(a.angenommen).toBe(false);
		expect(a.andereAngehoerigenlesart).toMatchObject({ kennung: 'L10', angenommen: true, abweichend: true });
		const mild = zaehleSummenAus({ ...ohneStimmen, erfordernis: MILD }, { ja: 5, nein: 4, enthaltung: 0 });
		expect(mild.angenommen).toBe(true);
		expect(mild.andereAngehoerigenlesart).toMatchObject({ kennung: 'L10', angenommen: false });
	});

	it('Unter L9 «anwesende» rechnet das Ergebnis an allen die Angehörigen mit, auch unter «fallen_heraus»', () => {
		const e = { ...wendeLesartAn(KLAGE, { ...LESARTEN_VORGABE, L9: 'anwesende' }), angehoerigenlesart: 'fallen_heraus' as const };
		const a = zaehleAus(klage(e));
		// An den Anwesenden fällt die Angehörige im Ausstand heraus: 5 von 9.
		expect(a.angenommen).toBe(true);
		// An allen bleibt sie in der Zahl: 5 von 10, abgelehnt.
		expect(a.andereZaehlbasis).toMatchObject({ kennung: '1a', angenommen: false, abweichend: true });
		expect(a.andereAngehoerigenlesart ?? null).toBeNull();
	});
});
