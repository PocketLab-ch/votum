/**
 * Die Zeile «Eingestellte Lesart» im Entscheidungsweg des Siegelpakets nimmt
 * «(Vorgabe)» aus der eingefrorenen Herkunft, nicht aus dem heutigen Katalog
 * (Codeprüfung Block B, 13.11.2026). Seit Fassung 2026-11-13 ist bei L4
 * «qualifiziert» die Vorgabe; ein Traktandum mit eingefrorenem
 * `{wahl: 'einfach', vorgabe: true}` darf nicht «einfach (Vorgabe)» tragen.
 */
import { describe, expect, it } from 'vitest';
import { lesartenZeileMitHerkunft } from '$lib/domain/auszaehlung';
import { lesartVon, type AngewandteLesart } from '$lib/domain/lesarten';

const L4 = lesartVon('L4')!;
const bez = (w: string) => L4.wahlen.find((x) => x.wert === w)!.bezeichnung;

describe('Siegel: Zeile «Eingestellte Lesart»', () => {
	it('heutige Vorgabe qualifiziert, eingefroren als Vorgabe: «(Vorgabe)»', () => {
		const l: AngewandteLesart = {
			kennung: 'L4',
			wahl: 'qualifiziert',
			vorgabe: true,
			andere: { wahl: 'einfach' } as AngewandteLesart['andere']
		};
		const z = lesartenZeileMitHerkunft(l);
		expect(z).toBe(`${bez('qualifiziert')} (Vorgabe); die andere: ${bez('einfach')}`);
	});

	it('eingefroren «einfach» als Vorgabe: «damals Vorgabe», kein «(Vorgabe)»', () => {
		const l: AngewandteLesart = {
			kennung: 'L4',
			wahl: 'einfach',
			vorgabe: true,
			andere: { wahl: 'qualifiziert' } as AngewandteLesart['andere']
		};
		const z = lesartenZeileMitHerkunft(l);
		expect(z).toBe(`${bez('einfach')} (damals Vorgabe); die andere: ${bez('qualifiziert')}`);
		expect(z).not.toMatch(/\(Vorgabe\)/);
	});

	it('eingefroren «einfach», bewusst gewählt: die andere ist die heutige Vorgabe', () => {
		const l: AngewandteLesart = {
			kennung: 'L4',
			wahl: 'einfach',
			vorgabe: false,
			andere: { wahl: 'qualifiziert' } as AngewandteLesart['andere']
		};
		expect(lesartenZeileMitHerkunft(l)).toBe(
			`${bez('einfach')}; die andere: ${bez('qualifiziert')} (Vorgabe)`
		);
	});

	it('eingefroren «qualifiziert», bewusst gewählt: «einfach» war damals die Vorgabe, kein «(Vorgabe)»', () => {
		const l: AngewandteLesart = {
			kennung: 'L4',
			wahl: 'qualifiziert',
			vorgabe: false,
			andere: { wahl: 'einfach' } as AngewandteLesart['andere']
		};
		const z = lesartenZeileMitHerkunft(l);
		expect(z).toBe(`${bez('qualifiziert')}; die andere: ${bez('einfach')}`);
		expect(z).not.toMatch(/Vorgabe/);
	});

	it.each(['L2', 'L11'])('%s mit unveränderter Vorgabe: Zeile wie vor Block B', (kennung) => {
		const lesart = lesartVon(kennung)!;
		const vorgabe = lesart.vorgabe;
		const anders = lesart.wahlen.find((w) => w.wert !== vorgabe)!.wert;
		const ohne = (w: string) => lesart.wahlen.find((x) => x.wert === w)!.bezeichnung;
		const l = (wahl: string, andere: string, vg: boolean) =>
			({ kennung, wahl, vorgabe: vg, andere: { wahl: andere } }) as unknown as AngewandteLesart;
		expect(lesartenZeileMitHerkunft(l(vorgabe, anders, true))).toBe(
			`${ohne(vorgabe)} (Vorgabe); die andere: ${ohne(anders)}`
		);
		expect(lesartenZeileMitHerkunft(l(anders, vorgabe, false))).toBe(
			`${ohne(anders)}; die andere: ${ohne(vorgabe)} (Vorgabe)`
		);
	});
});
