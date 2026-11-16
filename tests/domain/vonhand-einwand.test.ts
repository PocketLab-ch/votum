/**
 * Der Grund «Eingewendete Bestimmung» am Beschluss von Hand (Entscheid 0046,
 * A7; Auftrag E2, Kriterien 1 bis 4).
 *
 * Was ohne Datenbank gilt: Pflichtangaben, festes Ergebnis, Festschreibung,
 * Verlaufseintrag, Quittung und der Satz im Protokoll. Das Zusammenspiel mit
 * Durchgang, Abend und Siegel prüft `tests/db/beschluss-von-hand-einwand.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
	auszaehlungVonHand,
	beschlussVonHandEreignis,
	eingabeAusFormular,
	einwandVonHand,
	quittungVonHand,
	verlangeEinwandOhneOffenenDurchgang,
	VON_HAND_EINWAND_HOECHSTENS,
	VON_HAND_FESTGEHALTEN,
	VON_HAND_FESTGEHALTEN_EINWAND,
	type VonHandEingabe
} from '../../src/lib/domain/vonhand';
import { ausFestschreibung, festschreibung } from '../../src/lib/domain/festschreibung';
import { einwandSatz } from '../../src/lib/domain/protokoll';
import { einwandLageAm } from '../../src/lib/domain/entscheidbaum';
import { FachlicherFehler } from '../../src/lib/domain/fehler';

const BESTIMMUNG = 'Reglement Art. 14: drei Viertel aller Eigentümer und Wertquoten';
const EINFUEHRUNG = 'Beilage zum Begründungsakt, seither nicht geändert';

const EINWAND: VonHandEingabe = {
	ergebnis: 'abgelehnt',
	zahlen: { erfassung: 'summen', koepfe: { ja: 6, nein: 4, enthaltung: 0 }, quoten: null },
	grund: 'eingewendete_bestimmung',
	einwand: `  ${BESTIMMUNG}  `,
	einfuehrung: EINFUEHRUNG
};

function kennung(f: () => unknown): string | null {
	try {
		f();
	} catch (e) {
		if (e instanceof FachlicherFehler) return e.kennung;
		throw e;
	}
	return null;
}

describe('Grund und Pflichtangaben (Kriterien 1, 2)', () => {
	it('ohne Grund ist es der Notweg wie bisher, ohne Bestimmung', () => {
		expect(einwandVonHand({ ergebnis: 'angenommen' })).toBeNull();
		expect(einwandVonHand({ ergebnis: 'abgelehnt', grund: 'notweg', einwand: 'egal' })).toBeNull();
		const a = auszaehlungVonHand({ ...EINWAND, grund: undefined, einwand: undefined }, null);
		expect(a.vonHand).toEqual({ erfassung: 'summen' });
	});

	it('verlangt Bestimmung und Einführung, bereinigt', () => {
		expect(einwandVonHand(EINWAND)).toEqual({ bestimmung: BESTIMMUNG, einfuehrung: EINFUEHRUNG });
		expect(kennung(() => einwandVonHand({ ...EINWAND, einfuehrung: ' ' }))).toBe('einfuehrung_fehlt');
		expect(kennung(() => einwandVonHand({ ...EINWAND, einwand: '   ' }))).toBe('einwand_fehlt');
		expect(kennung(() => einwandVonHand({ ...EINWAND, einwand: null }))).toBe('einwand_fehlt');
	});

	it('fasst Zeilenumbrüche zusammen, damit der Protokollsatz nicht zerfällt (Codeprüfung M3)', () => {
		expect(einwandVonHand({ ...EINWAND, einwand: 'Art. 14\n- drei Viertel\n#  aller', einfuehrung: 'Beilage\r\n| 1998' })).toEqual({
			bestimmung: 'Art. 14 - drei Viertel # aller',
			einfuehrung: 'Beilage | 1998'
		});
	});

	it('nimmt höchstens die Grenze an Zeichen', () => {
		expect(einwandVonHand({ ...EINWAND, einwand: 'x'.repeat(VON_HAND_EINWAND_HOECHSTENS) })?.bestimmung).toHaveLength(
			VON_HAND_EINWAND_HOECHSTENS
		);
		expect(kennung(() => einwandVonHand({ ...EINWAND, einwand: 'x'.repeat(VON_HAND_EINWAND_HOECHSTENS + 1) }))).toBe(
			'zu_lang'
		);
	});

	it('hält mit diesem Grund nur «abgelehnt» fest', () => {
		expect(kennung(() => auszaehlungVonHand({ ...EINWAND, ergebnis: 'angenommen' }, null))).toBe(
			'einwand_nur_ablehnung'
		);
	});

	it('weist einen unbekannten Grund ab, statt ihn zum Notweg zu machen', () => {
		expect(
			kennung(() => auszaehlungVonHand({ ...EINWAND, grund: 'irgendwas' as VonHandEingabe['grund'] }, null))
		).toBe('grund_ungueltig');
		expect(
			kennung(() => einwandVonHand({ ergebnis: 'abgelehnt', grund: 'constructor' as VonHandEingabe['grund'] }))
		).toBe('grund_ungueltig');
	});

	it('nicht bei offenem Durchgang, nur wo der Grund gilt und nach einer Annahme; der Notweg schon', () => {
		const lage = {
			grund: 'eingewendete_bestimmung' as const,
			durchgangOffen: false,
			amErfordernis: true,
			nachGesetzAngenommen: true
		};
		expect(kennung(() => verlangeEinwandOhneOffenenDurchgang({ ...lage, durchgangOffen: true }))).toBe('einwand_offen');
		expect(kennung(() => verlangeEinwandOhneOffenenDurchgang({ ...lage, amErfordernis: false }))).toBe(
			'einwand_hier_nicht'
		);
		expect(kennung(() => verlangeEinwandOhneOffenenDurchgang({ ...lage, nachGesetzAngenommen: false }))).toBe(
			'einwand_ohne_annahme'
		);
		expect(() => verlangeEinwandOhneOffenenDurchgang(lage)).not.toThrow();
		const notweg = { durchgangOffen: true, amErfordernis: false, nachGesetzAngenommen: false };
		expect(() => verlangeEinwandOhneOffenenDurchgang({ ...notweg, grund: 'notweg' })).not.toThrow();
		expect(() => verlangeEinwandOhneOffenenDurchgang({ ...notweg, grund: undefined })).not.toThrow();
	});

	it('gilt an den Karten mit vereinbarter Ordnung, in jeder Fassung, sonst nicht (R3-L-6)', () => {
		expect(einwandLageAm({ reglementsverhalten: 'vereinbart', typ: 'einfaches_mehr', knotenId: 'k-baulich-notwendig', fassung: '2026-10-15' })).toEqual({ einstimmigkeit: 'notwendig' });
		expect(einwandLageAm({ reglementsverhalten: 'gesperrt_zwingend', typ: 'qualifiziertes_mehr', knotenId: 'k-x', fassung: '2026-11-11' })).toBeNull();
		expect(einwandLageAm({ typ: 'einfaches_mehr', knotenId: 'k-x' })).toBeNull();
		// Unter einem von der Leitung gesetzten Mehr nicht (Featureprüfung Z1).
		expect(einwandLageAm({ reglementsverhalten: 'vereinbart', typ: 'einfaches_mehr', knotenId: 'k-baulich-nuetzlich', quelle: 'gewaehlt', rechtsgrundlage: '' })).toBeNull();
		// Direkt aus der Liste gewählt, mit der Rechtsgrundlage des Gesetzes: zugelassen.
		expect(einwandLageAm({ reglementsverhalten: 'vereinbart', typ: 'qualifiziertes_mehr', knotenId: 'k-baulich-nuetzlich', quelle: 'gewaehlt', rechtsgrundlage: 'ZGB Art. 647d' })).not.toBeNull();
		expect(einwandLageAm({ reglementsverhalten: 'vereinbart', typ: 'qualifiziertes_mehr', knotenId: 'k-baulich-nuetzlich', quelle: 'hergeleitet' })).not.toBeNull();
		// Unter einer angewandten Regel nicht (Codeprüfung M1).
		expect(einwandLageAm({ reglementsverhalten: 'vereinbart', typ: 'reglementsmehr' as never, knotenId: 'k-baulich-nuetzlich' })).toBeNull();
	});
});

describe('Festschreibung und Verlauf (Kriterium 3)', () => {
	const a = auszaehlungVonHand(EINWAND, null);

	it('trägt die Bestimmung in der Auszählung, abgelehnt', () => {
		expect(a.angenommen).toBe(false);
		expect(a.vonHand).toEqual({ erfassung: 'summen', einwand: { bestimmung: BESTIMMUNG, einfuehrung: EINFUEHRUNG } });
		const mitKarte = auszaehlungVonHand(EINWAND, null, { knotenId: 'k-baulich-notwendig' } as never);
		expect(mitKarte.vonHand?.einwand).toEqual({
			bestimmung: BESTIMMUNG,
			einfuehrung: EINFUEHRUNG,
			knotenId: 'k-baulich-notwendig'
		});
	});

	it('übersteht die Festschreibung', () => {
		const zurueck = ausFestschreibung(festschreibung(a));
		expect(zurueck?.vonHand?.einwand).toEqual({ bestimmung: BESTIMMUNG, einfuehrung: EINFUEHRUNG });
	});

	it('steht im Verlaufseintrag, und nur mit diesem Grund', () => {
		const lage = {
			durchgangId: 'd',
			meetingId: 'v',
			traktandumId: 't',
			traktandumtitel: 'Dachsanierung',
			nummer: 2,
			begruendung: null,
			uebergangen: [],
			ueberholt: []
		};
		expect(beschlussVonHandEreignis({ ...lage, auszaehlung: a }).angaben).toMatchObject({
			ergebnis: 'abgelehnt',
			einwand: BESTIMMUNG,
			einfuehrung: EINFUEHRUNG
		});
		const ohne = beschlussVonHandEreignis({
			...lage,
			auszaehlung: auszaehlungVonHand({ ...EINWAND, grund: 'notweg' }, null)
		});
		expect(ohne.angaben).not.toHaveProperty('einwand');
	});
});

describe('Formular der Maske', () => {
	function formular(felder: Record<string, string>): FormData {
		const d = new FormData();
		for (const [k, v] of Object.entries({
			erfassung: 'summen',
			koepfe_ja: '6',
			koepfe_nein: '4',
			koepfe_enthaltung: '0',
			ergebnis: 'abgelehnt',
			...felder
		}))
			d.set(k, v);
		return d;
	}

	it('liest Grund und Bestimmung', () => {
		const e = eingabeAusFormular(
			formular({ grund: 'eingewendete_bestimmung', einwand: BESTIMMUNG, einfuehrung: EINFUEHRUNG })
		);
		expect(e.grund).toBe('eingewendete_bestimmung');
		expect(e.einwand).toBe(BESTIMMUNG);
		expect(e.einfuehrung).toBe(EINFUEHRUNG);
	});

	it('ohne Feld kein Grund: der Notweg wie bisher', () => {
		const e = eingabeAusFormular(formular({}));
		expect(e.grund).toBeUndefined();
		expect(e.einwand).toBeUndefined();
	});
});

describe('Quittung', () => {
	it('sagt mit dem Grund, was das Protokoll zeigt', () => {
		expect(quittungVonHand([], true)).toBe(VON_HAND_FESTGEHALTEN_EINWAND);
		expect(quittungVonHand([])).toBe(VON_HAND_FESTGEHALTEN);
		expect(quittungVonHand([{ kennung: 'nicht_beschlussfaehig' }], true)).toContain(VON_HAND_FESTGEHALTEN_EINWAND);
	});
});

describe('Satz im Protokoll (Kriterium 4)', () => {
	it('nennt Bestimmung, Einführung, Gesetz und Ablehnung, nicht den Weg', () => {
		const t = einwandSatz({ bestimmung: BESTIMMUNG, einfuehrung: EINFUEHRUNG });
		expect(t).toContain(`«${BESTIMMUNG}»`);
		expect(t).toContain(`Eingeführt nach Angabe der Sitzungsleitung: ${EINFUEHRUNG}.`);
		expect(t).toMatch(/Nach dem Gesetz hätte der Antrag das nötige Mehr erreicht/);
		expect(t).toMatch(/Schlichtungsgesuch .* \(ZGB Art\. 712m Abs\. 2 und Art\. 75\)\. Ein Schreiben an die Verwaltung genügt nicht\./);
		expect(t).toMatch(/auch wer nicht an der Versammlung war/);
		expect(t).toMatch(/erneut gestellt werden/);
		expect(t).not.toMatch(/Art\. 647 Abs\. 2/);
		expect(t).not.toMatch(/von Hand|Notweg|übergangen/i);
		expect(t).not.toMatch(/»\.\./);
		expect(einwandSatz({ bestimmung: `${BESTIMMUNG}.` })).toContain(`«${BESTIMMUNG}»`);
		expect(einwandSatz({ bestimmung: BESTIMMUNG })).not.toMatch(/Eingeführt/);
	});

	it('an der notwendigen Massnahme mit dem Weg zum Gericht (F-9)', () => {
		expect(einwandSatz({ bestimmung: BESTIMMUNG, notwendig: true })).toMatch(
			/beim Gericht verlangen, dass es sie anordnet \(ZGB Art\. 647 Abs\. 2 Ziff\. 1\)\. Ob dafür die Monatsfrist der Anfechtung gilt, ist nicht geklärt/
		);
	});

	it('am Abend mit dem Namen der Gemeinschaft und dem Kreis der Eigentümer (R2-F-6)', () => {
		const t = einwandSatz({ bestimmung: BESTIMMUNG, gemeinschaft: 'STWEG Musterweg 1' });
		expect(t).toMatch(/^STWEG Musterweg 1: Eingewendet/);
		expect(t).toContain('Wer Eigentümer in dieser Gemeinschaft ist, der Ablehnung nicht zugestimmt hat');
	});
});
