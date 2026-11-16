/**
 * Story 6.3 — der Betriebszustand (FR-68, AD-18).
 *
 * Der Kern der Story steckt im Unterschied zwischen «eigenständig» und
 * «getrennt»: Beides sieht von aussen nach «kein Netz» aus, aber nur das zweite
 * ist eine Störung. Würden beide gleich dargestellt, fiele eine echte Störung
 * nicht mehr auf — und die Anzeige, die jeden Tag dasteht, liest niemand mehr.
 */
import { describe, expect, it } from 'vitest';
import { bewerteBetrieb, istAuffaellig, type Dienst } from '$lib/domain/betrieb';

function dienst(u: Partial<Dienst> = {}): Dienst {
	return {
		kennung: 'authentik',
		name: 'Authentik',
		eingerichtet: true,
		erreichbar: true,
		ohneIhn: 'Die Anmeldung über Authentik steht nicht zur Verfügung.',
		...u
	};
}

describe('Betriebszustand', () => {
	it('nennt eine Anlage ohne eingerichtete Dienste eigenständig', () => {
		const z = bewerteBetrieb([dienst({ eingerichtet: false, erreichbar: false })]);
		expect(z.art).toBe('eigenstaendig');
		expect(z.fehlend).toEqual([]);
		expect(istAuffaellig(z)).toBe(false);
	});

	it('behandelt die leere Liste wie die eigenständige Anlage', () => {
		expect(bewerteBetrieb([]).art).toBe('eigenstaendig');
	});

	it('nennt eine Anlage mit erreichbaren Diensten verbunden', () => {
		const z = bewerteBetrieb([dienst()]);
		expect(z.art).toBe('verbunden');
		expect(istAuffaellig(z)).toBe(false);
	});

	it('nennt einen eingerichteten, aber stummen Dienst eine Störung', () => {
		const z = bewerteBetrieb([dienst({ erreichbar: false })]);
		expect(z.art).toBe('getrennt');
		expect(z.fehlend.map((d) => d.kennung)).toEqual(['authentik']);
		expect(istAuffaellig(z)).toBe(true);
	});

	it('unterscheidet nicht eingerichtet von nicht erreichbar', () => {
		// Der ganze Grund für drei Zustände: Sonst meldete jede eigenständige
		// Anlage bei jedem Start eine Störung, die keine ist.
		const aus = bewerteBetrieb([dienst({ eingerichtet: false, erreichbar: false })]);
		const stumm = bewerteBetrieb([dienst({ eingerichtet: true, erreichbar: false })]);
		expect(aus.art).not.toBe(stumm.art);
	});

	it('meldet nur die stummen unter mehreren Diensten', () => {
		const z = bewerteBetrieb([
			dienst({ kennung: 'a', name: 'Authentik', erreichbar: false }),
			dienst({ kennung: 'z', name: 'Zeitstempel', erreichbar: true }),
			dienst({ kennung: 'k', name: 'KI-Prüfung', eingerichtet: false, erreichbar: false })
		]);
		expect(z.art).toBe('getrennt');
		expect(z.fehlend.map((d) => d.name)).toEqual(['Authentik']);
	});

	it('sagt bei einer Störung, was ohne den Dienst trotzdem geht', () => {
		// «Authentik nicht erreichbar» beantwortet die Frage nicht, die im Saal
		// gestellt wird: ob man weiterarbeiten kann.
		const z = bewerteBetrieb([
			dienst({ erreichbar: false, ohneIhn: 'Die lokale Anmeldung funktioniert unverändert.' })
		]);
		expect(z.satz).toContain('Die lokale Anmeldung funktioniert unverändert.');
		expect(z.satz).toContain('dennoch vollständig führen');
	});

	it('zählt bei mehreren stummen Diensten statt alle aufzuzählen', () => {
		const z = bewerteBetrieb([
			dienst({ kennung: 'a', name: 'Authentik', erreichbar: false }),
			dienst({ kennung: 'z', name: 'Zeitstempel', erreichbar: false })
		]);
		expect(z.kurz).toBe('2 Dienste fehlen');
		// Der lange Satz nennt sie trotzdem beide.
		expect(z.satz).toContain('Authentik');
		expect(z.satz).toContain('Zeitstempel');
	});

	it('führt eine Warnung neben dem Zustand, ohne ihn zur Störung zu machen', () => {
		/*
		 * **Der Ersatzdienst beim Zeitstempel** (13.11.2026): Das Siegel ist
		 * bezeugt, der Abschluss in Ordnung. Die Warnung ist trotzdem keine
		 * Nebensache; sie darf nur nicht als Ausfall gelesen werden.
		 */
		const z = bewerteBetrieb([dienst()], ['Der Ersatzdienst hat bezeugt.']);
		expect(z.art).toBe('verbunden');
		expect(istAuffaellig(z)).toBe(false);
		expect(z.warnungen).toEqual(['Der Ersatzdienst hat bezeugt.']);

		// Auch im Alleinbetrieb bleibt sie stehen: Sie hängt am Bestand, nicht
		// an der Erreichbarkeit.
		expect(bewerteBetrieb([], ['Hinweis']).warnungen).toEqual(['Hinweis']);
	});
});
