/**
 * Die Reiterleiste über die Häuser eines Abends.
 *
 * Der teuerste Fehler wäre der stille: ein Reiter, der zwar ins richtige Haus
 * führt, aber die Herkunft des vorigen mitschleppt. Die Seite sähe richtig aus,
 * die Leiste daneben zeigte den Ablauf der falschen Versammlung, und der
 * «Weiter»-Weg am Fuss sprünge zurück. Deshalb steht die Herkunft hier im Test
 * ganz vorn.
 */
import { describe, expect, it } from 'vitest';
import {
	abendregister,
	haeuserNachStammdaten,
	haeuserZumThema,
	themaAusPfad,
	type Abendhaus
} from '$lib/domain/register';

const HAUS = (nr: string, erledigt: boolean): Abendhaus => ({
	stwegId: `stweg-${nr}`,
	versammlungId: `v-${nr}`,
	name: `Nirgendweg ${nr}`,
	zustand: 'freigegeben',
	mappeNoetig: true,
	schritte: [
		{
			kennung: 'einheiten',
			titel: 'Einheiten und Wertquoten',
			zustand: erledigt ? 'erledigt' : 'offen'
		},
		{ kennung: 'eigentuemer', titel: 'Eigentümer und Zuordnung', zustand: 'offen' }
	]
});

const ABEND = [HAUS('4', true), HAUS('6', false), HAUS('8', true)];

describe('themaAusPfad', () => {
	it('nimmt alles nach der Kennung', () => {
		expect(themaAusPfad('/gemeinschaften/abc/einheiten')).toBe('einheiten');
		expect(themaAusPfad('/gemeinschaften/abc/versammlungen/neu')).toBe('versammlungen/neu');
	});

	it('lässt den Abfrageteil weg — er trägt die Herkunft, und die wechselt je Haus', () => {
		expect(themaAusPfad('/gemeinschaften/abc/reglement?zur=xyz')).toBe('reglement');
	});

	it('kennt kein Thema auf der Startseite der Gemeinschaft', () => {
		expect(themaAusPfad('/gemeinschaften/abc')).toBeNull();
		expect(themaAusPfad('/gemeinschaften/abc/')).toBeNull();
		expect(themaAusPfad('/versammlungen/abc/traktanden')).toBeNull();
	});
});

describe('abendregister', () => {
	it('führt jeden Reiter mit der Versammlung SEINES Hauses', () => {
		const leiste = abendregister({ pfad: '/gemeinschaften/stweg-4/einheiten', haeuser: ABEND })!;
		expect(leiste.reiter.map((r) => r.pfad)).toEqual([
			'/gemeinschaften/stweg-4/einheiten?zur=v-4',
			'/gemeinschaften/stweg-6/einheiten?zur=v-6',
			'/gemeinschaften/stweg-8/einheiten?zur=v-8'
		]);
	});

	it('bleibt beim Thema, wenn man das Haus wechselt', () => {
		const leiste = abendregister({
			pfad: '/gemeinschaften/stweg-6/eigentuemer?zur=v-6',
			haeuser: ABEND
		})!;
		expect(leiste.thema).toBe('eigentuemer');
		expect(leiste.reiter.every((r) => r.pfad.includes('/eigentuemer?'))).toBe(true);
	});

	it('markiert genau ein Haus als «hier»', () => {
		const leiste = abendregister({ pfad: '/gemeinschaften/stweg-6/einheiten', haeuser: ABEND })!;
		expect(leiste.reiter.filter((r) => r.hier).map((r) => r.name)).toEqual(['Nirgendweg 6']);
	});

	it('zählt, bei wie vielen Häusern das Thema erledigt ist', () => {
		const leiste = abendregister({ pfad: '/gemeinschaften/stweg-4/einheiten', haeuser: ABEND })!;
		expect(leiste.erledigt).toBe(2);
		expect(leiste.haeuser).toBe(3);
		expect(leiste.titel).toBe('Einheiten und Wertquoten');
	});

	it('zählt nicht, wo es keinen Schritt gibt — statt still null zu behaupten', () => {
		const leiste = abendregister({ pfad: '/gemeinschaften/stweg-4/historie', haeuser: ABEND })!;
		expect(leiste.erledigt).toBeNull();
		expect(leiste.titel).toBeNull();
		expect(leiste.reiter.every((r) => r.erledigt === null)).toBe(true);
		expect(leiste.reiter[1].pfad).toBe('/gemeinschaften/stweg-6/historie?zur=v-6');
	});

	it('schweigt, wo eine Leiste nichts zu wählen gäbe', () => {
		expect(abendregister({ pfad: '/gemeinschaften/stweg-4/einheiten', haeuser: [ABEND[0]] })).toBeNull();
		expect(abendregister({ pfad: '/gemeinschaften/stweg-4', haeuser: ABEND })).toBeNull();
	});
});

/**
 * Die Trennung nach offen und erledigt.
 *
 * Gemeldet am 12.08.2026: «Fehlende Einträge können da leicht übersehen
 * werden.» Sechs Kacheln, zwei davon leer, alle gleich aussehend. Was hier
 * geprüft wird, ist nicht die Farbe — die sieht man —, sondern dass die zwei
 * überhaupt oben landen und dass die Zählung in Überschrift und Kachel dieselbe
 * ist.
 */
describe('haeuserZumThema', () => {
	it('stellt die offenen voran', () => {
		const stand = haeuserZumThema(ABEND, 'einheiten');
		expect(stand.offen.map((h) => h.name)).toEqual(['Nirgendweg 6']);
		expect(stand.erledigt.map((h) => h.name)).toEqual(['Nirgendweg 4', 'Nirgendweg 8']);
	});

	it('behält innerhalb beider Gruppen die Reihenfolge des Abends', () => {
		const viele = [HAUS('1', false), HAUS('2', true), HAUS('3', false), HAUS('4', true)];
		const stand = haeuserZumThema(viele, 'einheiten');
		expect(stand.offen.map((h) => h.name)).toEqual(['Nirgendweg 1', 'Nirgendweg 3']);
		expect(stand.erledigt.map((h) => h.name)).toEqual(['Nirgendweg 2', 'Nirgendweg 4']);
	});

	it('teilt vollständig auf — keines fällt heraus, keines steht doppelt', () => {
		const stand = haeuserZumThema(ABEND, 'einheiten');
		expect(stand.offen.length + stand.erledigt.length).toBe(ABEND.length);
	});

	/*
	 * Der stille Fehler wäre hier eine Kachel, die etwas verlangt, das es gar
	 * nicht gibt: Ein Haus ohne diesen Schritt hat daran nichts zu tun.
	 */
	it('zählt ein Haus ohne diesen Schritt nicht als offen', () => {
		const ohne: Abendhaus = { ...HAUS('9', false), schritte: [] };
		const stand = haeuserZumThema([...ABEND, ohne], 'einheiten');
		expect(stand.offen.map((h) => h.name)).toEqual(['Nirgendweg 6']);
		expect(stand.erledigt.map((h) => h.name)).toContain('Nirgendweg 9');
	});

	it('kennt ein Thema, das es nicht gibt — und meldet dann nichts als offen', () => {
		const stand = haeuserZumThema(ABEND, 'gibt-es-nicht');
		expect(stand.offen).toEqual([]);
		expect(stand.erledigt.length).toBe(3);
	});
});

describe('haeuserNachStammdaten', () => {
	/*
	 * «Eigentümer» ist im Prüfbestand bei allen Häusern offen — also ist auch bei
	 * denen etwas offen, deren Einheiten stehen. Genau das ist der Fall, den die
	 * Themenansicht anders beantwortet als die Übersicht, und beide müssen recht
	 * behalten.
	 */
	it('nimmt alle vier Themen zusammen, nicht nur eines', () => {
		const stand = haeuserNachStammdaten(ABEND);
		expect(stand.offen.map((h) => h.name)).toEqual([
			'Nirgendweg 4',
			'Nirgendweg 6',
			'Nirgendweg 8'
		]);
		expect(stand.erledigt).toEqual([]);
	});

	it('führt ein Haus als vollständig, wenn alle seine Schritte stehen', () => {
		const fertig: Abendhaus = {
			...HAUS('12', true),
			schritte: HAUS('12', true).schritte.map((s) => ({ ...s, zustand: 'erledigt' as const }))
		};
		const stand = haeuserNachStammdaten([...ABEND, fertig]);
		expect(stand.erledigt.map((h) => h.name)).toEqual(['Nirgendweg 12']);
	});
});
