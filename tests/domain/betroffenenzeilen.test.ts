/**
 * Die Zeilen zu den unmittelbar Betroffenen im Protokoll (Block A3a,
 * 26.09.2026): je Form die eigene Norm, bei den Wertquoten die ausstehende
 * Zustimmung, bei den Nutzungsrechten die Vorab-Zustimmung mit Vermerk, und
 * am gemeinsamen Abend dieselben Zeilen ohne Namen.
 */
import { describe, expect, it } from 'vitest';
import { betroffenenzeilen } from '$lib/domain/protokoll';
import { NICHT_IM_STAND } from '$lib/domain/auszaehlung';
import { nutzniessungenDerBetroffenen } from '$lib/domain/nutzniessung';

const MIT = { namentlich: true };
const OHNE = { namentlich: false };

describe('Betroffenen-Zeilen im Hausprotokoll', () => {
	it('nennt bei den Nutzungsrechten Art. 712g Abs. 4, die Vorab-Zustimmung und das Veto', () => {
		expect(
			betroffenenzeilen(
				{
					zustimmungsform: 'im_saal_oder_vorab',
					ohneZustimmung: ['Anna Muster'],
					vorabZugestimmt: ['Partei Wohnung 2 (laut Sitzungsleitung: Schreiben vom 12.09.2026)'],
					veto: ['Partei Wohnung 3 (am eigenen Gerät) zugestimmt']
				},
				MIT
			)
		).toEqual([
			'Ohne die nach ZGB Art. 712g Abs. 4 nötige Zustimmung: Anna Muster',
			'Vorab schriftlich zugestimmt: Partei Wohnung 2 (laut Sitzungsleitung: Schreiben vom 12.09.2026)',
			'Entscheid der Betroffenen im Ausstand über die Zustimmung (ohne Stimme bei der Mehrheit): ' +
				'Partei Wohnung 3 (am eigenen Gerät) zugestimmt'
		]);
	});

	it('nennt bei den Wertquoten Art. 712e Abs. 2, die Unterschrift und die Grundpfandgläubiger', () => {
		/*
		 * Bis A3a fehlte die Zeile ganz: Das Protokoll las nur die fehlenden
		 * Zustimmungen, und bei `nachher` fehlt keine, sie steht aus.
		 */
		const z = betroffenenzeilen(
			{
				zustimmungsform: 'nachher',
				ohneZustimmung: [],
				ausstehend: ['Anna Muster', 'Bruno Beispiel', NICHT_IM_STAND]
			},
			MIT
		);
		expect(z[0]).toBe(
			'Noch aus steht die Zustimmung nach ZGB Art. 712e Abs. 2; sie wird mit der Unterschrift ' +
				'auf der Abänderungsurkunde erteilt: Anna Muster, Bruno Beispiel. Zustimmen müssen zudem ' +
				'die Grundpfandgläubiger der Einheiten, deren Quote sich ändert (in der Regel die Bank mit ' +
				'der Hypothek); welche weiteren dinglich Berechtigten zustimmen müssen, klärt der Notar.'
		);
		expect(z.join(' ')).not.toContain('712g');
		// Die Zeile «nicht im Stand» fehlte bei den Wertquoten bisher.
		expect(z[1]).toBe(
			'1 als unmittelbar betroffen bezeichnete Partei steht nicht im festgehaltenen Stand der ' +
				'Stimmberechtigten, etwa nach einem Verkauf. Die Unterschrift auf der Abänderungsurkunde ' +
				'muss von der Person kommen, der der Stockwerkanteil bei der Unterzeichnung gehört. Um welche ' +
				'Einheit es geht, klärt die Verwaltung.'
		);
	});

	it('bildet keine Zeile, wo nichts fehlt, aussteht oder vermerkt ist', () => {
		expect(betroffenenzeilen({ zustimmungsform: 'im_saal_oder_vorab', ohneZustimmung: [] }, MIT)).toEqual([]);
		expect(betroffenenzeilen({ zustimmungsform: null, ohneZustimmung: [] }, MIT)).toEqual([]);
	});
});

describe('Betroffenen-Zeilen am gemeinsamen Abend', () => {
	it('zählt statt zu nennen, erst was vorliegt, dann was fehlt', () => {
		const z = betroffenenzeilen(
			{
				zustimmungsform: 'im_saal_oder_vorab',
				ohneZustimmung: ['Anna Muster'],
				vorabZugestimmt: ['x', 'y'],
				vetoAnzahl: { ja: 1, nein: 1 }
			},
			OHNE
		);
		expect(z).toEqual([
			'2 betroffene Parteien haben vorab schriftlich zugestimmt.',
			'Betroffene im Ausstand (ohne Stimme bei der Mehrheit) haben gesondert erklärt, ob sie ' +
				'zustimmen: 1 ja, 1 nein.',
			'Insgesamt fehlt die nach ZGB Art. 712g Abs. 4 nötige Zustimmung bei 1 betroffenen Partei.',
			'Die Namen stehen in der Auswertung der jeweiligen Gemeinschaft; einsehen lässt sie sich ' +
				'bei der Verwaltung.'
		]);
		expect(z.join(' ')).not.toContain('Anna Muster');
	});

	it('nennt bei den Wertquoten die Zahl der ausstehenden Unterschriften', () => {
		const z = betroffenenzeilen(
			{ zustimmungsform: 'nachher', ohneZustimmung: [], ausstehend: ['A', 'B'] },
			OHNE
		);
		expect(z[0]).toMatch(
			/^Bei 2 betroffenen Parteien steht die Zustimmung nach ZGB Art\. 712e Abs\. 2 noch aus; sie wird mit der Unterschrift auf der Abänderungsurkunde erteilt\. Zustimmen müssen zudem die Grundpfandgläubiger/
		);
		expect(z.join(' ')).not.toMatch(/\bA\b|\bB\b/);
	});
});

/*
 * **Die Nutzniesser unter «ausstehend»** (Produktentscheid 03.11.2026;
 * SVIT-Kommentar 2023, Art. 712e Rz. 80, 88): Ist an einer Einheit einer
 * betroffenen Partei eine Nutzniessung erfasst, braucht das Grundbuch auch ihre
 * schriftliche Zustimmung. Die Daten kommen aus dem festgehaltenen Stand.
 */
describe('Nutzniessung an Einheiten der Betroffenen', () => {
	const einheit = (unitId: string, label: string, holderName?: string) => ({
		unitId,
		label,
		kind: 'unit' as const,
		countsAsHead: true,
		quota: 100,
		nutzniessung: holderName
			? {
					holderName,
					hasAgreement: false,
					agreementSummary: null,
					contractOnFile: true,
					hasDocument: false
				}
			: null
	});
	const STAND = [
		{ partyId: 'p-1', units: [einheit('u-1', 'Whg 1', 'Erna Beispiel'), einheit('u-2', 'Whg 2')] },
		{ partyId: 'p-2', units: [einheit('u-3', 'Whg 3')] },
		// Nicht betroffen: Ihre Nutzniessung gehört nicht in die Zeile.
		{ partyId: 'p-3', units: [einheit('u-4', 'Whg 4', 'Otto Erfunden')] }
	];

	it('liest je Einheit der Betroffenen die Nutzniessung aus dem Stand', () => {
		expect(nutzniessungenDerBetroffenen(STAND, ['p-1', 'p-2'])).toEqual([
			{ nutzniesser: 'Erna Beispiel', einheit: 'Whg 1' }
		]);
		expect(nutzniessungenDerBetroffenen(STAND, ['p-2'])).toEqual([]);
	});

	it('nennt im Hausprotokoll Name und Einheit nach der Zeile «ausstehend»', () => {
		const z = betroffenenzeilen(
			{
				zustimmungsform: 'nachher',
				ohneZustimmung: [],
				ausstehend: ['Anna Muster', 'Bruno Beispiel'],
				ausstehendNutzniessung: ['Erna Beispiel (Whg 1)']
			},
			MIT
		);
		expect(z[0]).toMatch(/^Noch aus steht die Zustimmung nach ZGB Art\. 712e Abs\. 2/);
		expect(z[1]).toBe(
			'Für das Grundbuch steht zudem die schriftliche Zustimmung der nutzniessenden Person aus, ' +
				'wenn sich die Quote ihrer Einheit ändert: Erna Beispiel (Whg 1)'
		);
		expect(z).toHaveLength(2);
	});

	it('Gegenprobe: ohne Nutzniessung keine solche Zeile', () => {
		for (const ausstehendNutzniessung of [[], undefined]) {
			const z = betroffenenzeilen(
				{ zustimmungsform: 'nachher', ohneZustimmung: [], ausstehend: ['Anna Muster'], ausstehendNutzniessung },
				MIT
			);
			expect(z).toHaveLength(1);
			expect(z.join(' ')).not.toMatch(/nutzniessend|Nutzniessung/);
		}
	});

	it('nennt am gemeinsamen Abend nur die Zahl, keinen Namen', () => {
		const z = betroffenenzeilen(
			{
				zustimmungsform: 'nachher',
				ohneZustimmung: [],
				ausstehend: ['A', 'B'],
				ausstehendNutzniessung: ['', '']
			},
			OHNE
		);
		expect(z[1]).toBe(
			'An 2 Einheiten der Betroffenen ist eine Nutzniessung erfasst. Ändert sich deren Quote, ' +
				'steht für das Grundbuch auch die schriftliche Zustimmung der nutzniessenden Personen ' +
				'aus; wer das ist, weiss die Verwaltung.'
		);
		const ohne = betroffenenzeilen(
			{ zustimmungsform: 'nachher', ohneZustimmung: [], ausstehend: ['A', 'B'] },
			OHNE
		);
		expect(ohne.join(' ')).not.toMatch(/Nutzniessung/);
	});

	it('nur bei den Wertquoten: bei den Nutzungsrechten nicht', () => {
		const z = betroffenenzeilen(
			{
				zustimmungsform: 'im_saal_oder_vorab',
				ohneZustimmung: ['Anna Muster'],
				ausstehendNutzniessung: ['Erna Beispiel (Whg 1)']
			},
			MIT
		);
		expect(z.join(' ')).not.toMatch(/nutzniessend/);
	});
});
