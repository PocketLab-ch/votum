/**
 * **Zu gross wird abgewiesen, bevor gepuffert wird** (K1, Sicherheitsdurchgang
 * 09.10.2026).
 *
 * Die beiden gemeldeten Wege bekommen eine Datei, deren `size` über der Grenze
 * liegt und deren `arrayBuffer` mitzählt. Bis zum 15.10.2026 wurde sie
 * vollständig gelesen und erst in `legeAb` abgewiesen. Dass kein anderer Weg
 * am Hausweg vorbei puffert, hält `tests/waechter/hochladen.test.ts`.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import { HOECHSTGROESSE } from '$lib/server/dateien';
import { haengeAn } from '$lib/server/anhaenge';
import { haengeNachweisAn } from '$lib/server/vollmacht';
import { verbindungenSchliessen } from './helfer';

const IRGENDEINE = '00000000-0000-7000-8000-000000000001';
const handelnder = { operatorId: IRGENDEINE, userId: null, label: 'Prüflauf' };

function grosseDatei() {
	const arrayBuffer = vi.fn(async () => new ArrayBuffer(8));
	const datei = {
		size: HOECHSTGROESSE + 1,
		name: 'gross.pdf',
		type: 'application/pdf',
		arrayBuffer
	} as unknown as File;
	return { datei, arrayBuffer };
}

afterAll(verbindungenSchliessen);

describe('Grösse vor dem Puffern', () => {
	it('haengeAn weist ab, ohne die Datei zu lesen', async () => {
		const { datei, arrayBuffer } = grosseDatei();
		await expect(
			haengeAn(handelnder, IRGENDEINE, 'agenda_item', IRGENDEINE, datei)
		).rejects.toMatchObject({ kennung: 'zu_gross' });
		expect(arrayBuffer).not.toHaveBeenCalled();
	});

	it('haengeNachweisAn weist ab, ohne die Datei zu lesen', async () => {
		const { datei, arrayBuffer } = grosseDatei();
		await expect(haengeNachweisAn(handelnder, IRGENDEINE, IRGENDEINE, datei)).rejects.toMatchObject({
			kennung: 'zu_gross'
		});
		expect(arrayBuffer).not.toHaveBeenCalled();
	});
});
