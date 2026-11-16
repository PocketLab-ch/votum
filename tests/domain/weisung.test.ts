/**
 * Die Weisung (Stories 7.3 und 7.4).
 *
 * Der Prüfstein: Eine MEG-Abstimmung ohne die Weisungen ihrer Mitglieder wäre
 * eine Abstimmung der Vertreter nach eigenem Gutdünken. Art. 7 Ziff. 3 weist die
 * Stimme aber den beteiligten Stockwerkeigentümern zu und nicht dem Vertreter.
 */
import { describe, expect, it } from 'vitest';
import {
	haltungAusBeschluss,
	pruefeWeisungen,
	weisungInWorten,
	type Weisung,
	type Weisungspflichtige
} from '$lib/domain/weisung';

const HAEUSER: Weisungspflichtige[] = [
	{ parteiId: 'h4', name: 'Nirgendweg 3', vertreter: 'Anna Muster' },
	{ parteiId: 'h6', name: 'Nirgendweg 5/5a', vertreter: 'Markus Probère' },
	{ parteiId: 'h8', name: 'Nirgendweg 7/7a', vertreter: 'Peter Kunz' },
	{ parteiId: 'h10', name: 'Nirgendweg 11/11a', vertreter: 'Ursula Beispiel' },
	{ parteiId: 'h12', name: 'Nirgendweg 13/13a', vertreter: null }
];

function weisung(parteiId: string, u: Partial<Weisung> = {}): Weisung {
	return {
		id: `w-${parteiId}`,
		traktandumId: 't1',
		parteiId,
		haltung: 'ja',
		herkunft: 'beschluss',
		quelleVersammlungId: 'v-haus',
		quelleDurchgangId: 'd-haus',
		bemerkung: null,
		erfasstAm: '2026-05-19T17:00:00.000Z',
		erfasstVon: 'Prüflauf',
		...u
	};
}

describe('Vollständigkeit', () => {
	it('nennt die fehlenden Häuser beim Namen', () => {
		// «Es fehlen Weisungen» hilft im Saal nicht weiter, wenn fünf Häuser
		// beteiligt sind und man wissen muss, wen man anrufen soll.
		const b = pruefeWeisungen({
			pflichtige: HAEUSER,
			weisungen: [weisung('h4'), weisung('h6')]
		});
		expect(b.vollstaendig).toBe(false);
		expect(b.vorliegend).toBe(2);
		expect(b.erwartet).toBe(5);
		expect(b.fehlend).toEqual([
			'Nirgendweg 7/7a',
			'Nirgendweg 11/11a',
			'Nirgendweg 13/13a'
		]);
	});

	it('gilt als vollständig, wenn alle fünf vorliegen', () => {
		const b = pruefeWeisungen({
			pflichtige: HAEUSER,
			weisungen: HAEUSER.map((h) => weisung(h.parteiId))
		});
		expect(b.vollstaendig).toBe(true);
		expect(b.fehlend).toEqual([]);
	});

	it('lässt einen ausdrücklichen Vermerk gelten, dass keine vorliegt', () => {
		// Das ist etwas anderes als eine Enthaltung: Das Haus zählt dann als nicht
		// vertreten. Der Unterschied ist erheblich, weil die Bezugsgrösse davon
		// abhängt (AD-15).
		const b = pruefeWeisungen({
			pflichtige: HAEUSER,
			weisungen: HAEUSER.slice(0, 4).map((h) => weisung(h.parteiId)),
			ohneWeisung: ['h12']
		});
		expect(b.vollstaendig).toBe(true);
		expect(b.vorliegend).toBe(4);
		expect(b.erwartet).toBe(5);
	});

	it('führt jedes Haus im Stand auf, auch die ohne Weisung', () => {
		// Die Sitzungsleitung braucht die ganze Liste, nicht nur die Lücken.
		const b = pruefeWeisungen({ pflichtige: HAEUSER, weisungen: [weisung('h4')] });
		expect(b.stand).toHaveLength(5);
		expect(b.stand[0].weisung).not.toBeNull();
		expect(b.stand[1].weisung).toBeNull();
	});

	it('reicht den fehlenden Vertreter durch', () => {
		const b = pruefeWeisungen({ pflichtige: HAEUSER, weisungen: [] });
		expect(b.stand.at(-1)?.vertreter).toBeNull();
	});

	it('ist ohne Pflichtige leer und vollständig', () => {
		// Ein Traktandum ohne Mitgliedsgemeinschaften ist kein Verbundgeschäft;
		// die Sperre darf es nicht aufhalten.
		const b = pruefeWeisungen({ pflichtige: [], weisungen: [] });
		expect(b.vollstaendig).toBe(true);
		expect(b.erwartet).toBe(0);
	});
});

describe('Ableitung aus dem Hausbeschluss', () => {
	it('macht aus angenommen ein Ja und aus abgelehnt ein Nein', () => {
		expect(haltungAusBeschluss(true)).toBe('ja');
		expect(haltungAusBeschluss(false)).toBe('nein');
	});
});

describe('Die Weisung in Worten', () => {
	it('nennt bei einem Beschluss die Herkunft', () => {
		expect(weisungInWorten(weisung('h4'), 'Nirgendweg 3')).toContain('Beschluss des Hauses');
	});

	it('kennzeichnet die freie Weisung als solche', () => {
		// Sie ist zulässig, aber sichtbar: In der Auswertung soll stehen, dass
		// diese Stimme nicht weisungsgebunden war.
		const satz = weisungInWorten(
			weisung('h6', { haltung: 'frei', herkunft: 'frei' }),
			'Nirgendweg 5/5a'
		);
		expect(satz).toContain('freiem Ermessen');
	});

	it('nennt bei einer Erklärung die Bemerkung', () => {
		const satz = weisungInWorten(
			weisung('h8', { herkunft: 'erklaerung', bemerkung: 'Zirkularbeschluss vom 3. Mai' }),
			'Nirgendweg 7/7a'
		);
		expect(satz).toContain('Zirkularbeschluss vom 3. Mai');
	});

	it('sagt bei der Auffangregel nicht «erklärt», dort hat niemand erklärt', () => {
		// Die Anwendung setzt die Weisung selbst nach der Auffangregel
		// (`trageOhneBeschlussEin`, `server/weisung.ts`); die Bemerkung nennt
		// die Grundlage. Der Satz darf nicht behaupten, jemand habe erklärt.
		const satz = weisungInWorten(
			weisung('h8', {
				herkunft: 'erklaerung',
				bemerkung: 'Ohne Beschluss des Hauses; Art. 12 des Reglements'
			}),
			'Nirgendweg 7/7a'
		);
		expect(satz).toContain('schriftlich festgehalten');
		expect(satz).not.toContain('erklärt');
		expect(satz).toContain('Ohne Beschluss des Hauses');
	});

	it('sagt es, wenn keine vorliegt', () => {
		expect(weisungInWorten(null, 'Nirgendweg 13/13a')).toContain('keine Weisung');
	});
});
