import { describe, expect, it } from 'vitest';
import { FachlicherFehler } from '$lib/domain/fehler';
import {
	erinnerungsfall,
	postZuSpaet,
	postlage,
	erinnerungstag,
	fristlage,
	pruefeEinberufungsfrist,
	versandfrist,
	werktagDavor
} from '$lib/domain/einberufungsfrist';
import { istAllgemeinerFeiertag, ostersonntag } from '$lib/domain/feiertage';
import { wochentagNummer } from '$lib/domain/datum';
import { tageZwischen } from '$lib/domain/versammlung';

describe('pruefeEinberufungsfrist', () => {
	it('nimmt die Frist heraus und räumt die Fundstelle mit weg', () => {
		expect(pruefeEinberufungsfrist(null, 'Reglement Ziff. 12')).toEqual({
			tage: null,
			fundstelle: null
		});
	});

	it('verlangt zur Zahl eine Fundstelle', () => {
		expect(() => pruefeEinberufungsfrist(30, '  ')).toThrow(FachlicherFehler);
	});

	it('weist null Tage ab — das wäre keine Frist', () => {
		expect(() => pruefeEinberufungsfrist(0, 'Reglement Ziff. 12')).toThrow(FachlicherFehler);
	});

	it('weist mehr als ein Jahr ab', () => {
		expect(() => pruefeEinberufungsfrist(400, 'Reglement Ziff. 12')).toThrow(FachlicherFehler);
	});

	it('nimmt die gültige Angabe und schneidet Leerzeichen weg', () => {
		expect(pruefeEinberufungsfrist(30, '  Reglement Ziff. 12.3 ')).toEqual({
			tage: 30,
			fundstelle: 'Reglement Ziff. 12.3'
		});
	});
});

describe('versandfrist', () => {
	it('rechnet rückwärts vom Versammlungstag', () => {
		// 30 Tage vor dem 31. Oktober 2026 ist der 1. Oktober.
		expect(versandfrist('2026-10-31', 30)).toBe('2026-10-01');
	});

	it('rechnet über den Monatswechsel und über die Zeitumstellung hinweg', () => {
		// Der 25. Oktober 2026 ist die Rückstellung auf Winterzeit. Um Mitternacht
		// gerechnet wäre hier ein Tag verlorengegangen.
		expect(versandfrist('2026-11-05', 20)).toBe('2026-10-16');
	});

	it('rechnet nichts ohne hinterlegte Frist', () => {
		expect(versandfrist('2026-10-31', null)).toBeNull();
	});
});

describe('werktagDavor', () => {
	it('nimmt vom Montag den Freitag', () => {
		// 5. Oktober 2026 ist ein Montag.
		expect(werktagDavor('2026-10-05')).toBe('2026-10-02');
	});

	it('nimmt vom Dienstag den Montag', () => {
		expect(werktagDavor('2026-10-06')).toBe('2026-10-05');
	});

	it('nimmt vom Sonntag den Freitag', () => {
		expect(werktagDavor('2026-10-04')).toBe('2026-10-02');
	});

	it('nimmt vom Samstag den Freitag', () => {
		expect(werktagDavor('2026-10-03')).toBe('2026-10-02');
	});
});

describe('erinnerungstag', () => {
	it('ist der Werktag vor der Versandfrist', () => {
		// Versammlung 4.11.2026, 30 Tage Frist → Versandfrist Montag 5.10.,
		// erinnert wird am Freitag davor.
		expect(erinnerungstag('2026-11-04', 30)).toBe('2026-10-02');
	});

	it('bleibt ohne Frist leer', () => {
		expect(erinnerungstag('2026-11-04', null)).toBeNull();
	});
});

const OFFEN = { versammlungsdatum: '2026-11-04', tage: 30, versendet: false };

describe('fristlage', () => {
	it('sagt ohne hinterlegte Frist, was fehlt — und rechnet nichts', () => {
		const l = fristlage('2026-09-01', { ...OFFEN, tage: null });
		expect(l.art).toBe('ohne_frist');
		expect(l.frist).toBeNull();
		expect(l.satz).toContain('nicht hinterlegt');
		// Produktentscheid 06.10.2026, «Hinweis, zehn Tage zu erfassen».
		expect(l.satz).toMatch(/keine Frist, tragen Sie mindestens zehn Tage ein/);
	});

	it('nennt den letzten Versandtag, solange Zeit bleibt', () => {
		const l = fristlage('2026-09-01', OFFEN);
		expect(l.art).toBe('offen');
		expect(l.frist).toBe('2026-10-05');
		expect(l.restTage).toBe(34);
	});

	it('wird am Vortag knapp', () => {
		expect(fristlage('2026-10-04', OFFEN).art).toBe('knapp');
	});

	it('nennt den letzten Tag als solchen', () => {
		const l = fristlage('2026-10-05', OFFEN);
		expect(l.art).toBe('knapp');
		expect(l.satz).toContain('Heute');
	});

	it('meldet die verpasste Frist samt Folge', () => {
		const l = fristlage('2026-10-06', OFFEN);
		expect(l.art).toBe('verpasst');
		expect(l.satz).toContain('kann ein Beschluss angefochten werden');
		// Als Regel der Anwendung, mit dem Vorbehalt des Reglements (Fachprüfung Runde 3).
		expect(l.satz).toContain('rechnet Ihr Reglement ab Versand, gilt dessen Regel');
		// «Zu spät» auch ohne Reglementsfrist, und die ganz fehlende Einladung mit
		// ihrer eigenen Folge (Fachprüfung Runde 1, B1 und B2, Abschnitt «Offen»
		// des Prüfberichts Hinweise lesbar, 06.10.2026; Rz. 66, 68 ad Art. 712n).
		expect(l.satz).toContain(
			'Zu spät heisst: nach der Frist Ihres Reglements oder, nennt es keine, zu knapp, um sich ' +
				'vorzubereiten und teilzunehmen.'
		);
		expect(l.satz).not.toContain('nach der Regel Ihres Reglements');
		/*
		 * **Nach dem Versammlungstag angekommen heisst fehlend, nicht zu spät**
		 * (Fachprüfung Restpunkte Runde 1, B1 und B4, 06.10.2026; Rz. 26, 66 bis
		 * 68 ad Art. 712n). Gegen den Stand davor rot: Dort hiess es «fehlt sie
		 * ganz», und die Teilnahme fehlte.
		 */
		expect(l.satz).toContain(
			'Kommt die Einladung zu spät, aber vor der Versammlung an, kann ein Beschluss angefochten ' +
				'werden. Kommt sie erst nach dem Versammlungstag oder gar nicht, kann er nichtig sein. ' +
				'In beiden Fällen ist ein neuer Versammlungstermin der sichere Weg.'
		);
		expect(l.satz).not.toContain('angemessene Vorbereitung');
		/*
		 * **Der nächste Schritt für alle, die selbst verschickt haben, an zweiter
		 * Stelle** (Laienprüfung Restpunkte Runde 1, B4, und Runde 2, 06.10.2026):
		 * Sie sind die häufigsten Leser, und am Schluss, nach «nichtig», las ihn
		 * kaum jemand. «Unten auf dieser Seite», weil die volle Fassung nur noch
		 * auf der Seite Vorbereitung steht (Produktentscheid 06.10.2026, «Kurz in
		 * der Leiste, ganz auf der Seite»). Gegen den Stand davor rot: Dort stand
		 * der Satz am Schluss, mit «auf der Seite Vorbereitung».
		 *
		 * **Hinweis statt Nachweis** (Produktentscheid 07.10.2026, «Nur noch
		 * aufmerksam machen»): der Haken mit seinem Namen, ohne «sobald sie bei
		 * allen angekommen ist», dazu bei wem der Empfang liegt. Gegen den Stand
		 * davor rot.
		 */
		// Am Anfang verglichen, nicht über die Satzteilung: Sie trennt nach «5.».
		const anfang =
			'Der letzte Tag, an dem die Einladung bei allen sein sollte, war der 5. Oktober 2026, und ' +
			'die Anwendung sieht keine erzeugte Einladung. Haben Sie die Einladung ausserhalb der ' +
			'Anwendung verschickt, setzen Sie unten auf dieser Seite den Haken «Die Einladung ist ' +
			'verschickt». Dann entfällt diese Warnung. Ob die Einladung rechtzeitig kam, sagt der Haken ' +
			// Seit Runde 1 (Laienprüfung 10, 07.10.2026) `VERANTWORTUNG`; gegen den Stand davor rot.
			'nicht. Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht. ';
		expect(l.satz.slice(0, anfang.length)).toBe(anfang);
		expect(l.satz).not.toContain('angekommen');
		expect(l.satz).not.toContain('auf der Seite Vorbereitung');
		expect(l.satz.endsWith('In beiden Fällen ist ein neuer Versammlungstermin der sichere Weg.')).toBe(
			true
		);
		for (const satz of l.satz.split(/(?<=[^\d][.!?»]|»)\s+(?=[A-ZÄÖÜ«])/)) {
			expect(satz.length, satz).toBeLessThanOrEqual(180);
		}
		// Der Durchstich liest diesen Teil (`e2e/durchspielen.mjs`).
		expect(l.satz).toMatch(/bei allen sein sollte, war der/);
	});

	/*
	 * **Kurz in der Leiste** (Produktentscheid 06.10.2026, «Kurz in der Leiste,
	 * ganz auf der Seite»): zwei Sätze, der Tag und wo es weitergeht. Gegen den
	 * Stand davor rot: Es gab kein Feld `kurz`.
	 */
	it('liefert für «verpasst» eine Kurzfassung für die Seitenleiste', () => {
		const l = fristlage('2026-10-06', OFFEN);
		expect(l.kurz).toBe(
			'Der letzte Tag, an dem die Einladung bei allen sein sollte, war der 5. Oktober 2026. ' +
				'Was jetzt zu tun ist, steht auf der Seite Vorbereitung.'
		);
		// Der Durchstich liest denselben Teil an der Leiste.
		expect(l.kurz).toMatch(/bei allen sein sollte, war der/);
	});

	it('liefert die Kurzfassung nur für «verpasst»', () => {
		for (const [heute, e] of [
			['2026-09-01', OFFEN],
			['2026-10-04', OFFEN],
			['2026-10-06', { ...OFFEN, versendet: true }],
			['2026-10-06', { ...OFFEN, tage: null }]
		] as const) {
			const l = fristlage(heute, e);
			expect(l.art).not.toBe('verpasst');
			expect(l.kurz, l.art).toBeUndefined();
		}
	});

	it('schweigt, sobald die Einladung draussen ist', () => {
		expect(fristlage('2026-10-06', { ...OFFEN, versendet: true }).art).toBe('erledigt');
	});

	/*
	 * **Der Satz behauptet keinen Versand** (06.10.2026, mit der Umbenennung des
	 * Hakens): `versendet` ist auch bei bloss erzeugter Einladung wahr, und vor
	 * dem letzten Tag lief die Frist noch nicht ab. Hakenname seit dem
	 * Produktentscheid 07.10.2026; gegen den Stand davor rot.
	 */
	it('sagt bei erzeugter oder vermerkter Einladung nur, was die Anwendung weiss', () => {
		for (const heute of ['2026-09-01', '2026-10-06']) {
			const l = fristlage(heute, { ...OFFEN, versendet: true });
			expect(l.satz).toBe(
				'Eine Einladung ist erzeugt oder als verschickt vermerkt. Der letzte Tag der ' +
					'Frist ist der 5. Oktober 2026.'
			);
			expect(l.satz).not.toContain('hinausgegangen');
		}
	});
});

describe('erinnerungsfall', () => {
	it('schweigt, solange der Erinnerungstag nicht da ist', () => {
		expect(erinnerungsfall('2026-10-01', OFFEN)).toBeNull();
	});

	it('meldet am Erinnerungstag die Vorwarnung', () => {
		expect(erinnerungsfall('2026-10-02', OFFEN)).toEqual({
			art: 'vorwarnung',
			frist: '2026-10-05',
			erinnertAm: '2026-10-02'
		});
	});

	/*
	 * **Der Nachholfall.** Wäre die Bedingung «heute ist genau der
	 * Erinnerungstag», ginge jede Erinnerung verloren, deren Tag der Dienst nicht
	 * erlebt hat — ein Neustart am Wochenende genügte.
	 */
	it('holt eine verpasste Vorwarnung nach', () => {
		expect(erinnerungsfall('2026-10-05', OFFEN)?.art).toBe('vorwarnung');
	});

	it('meldet nach Ablauf, dass die Frist vorbei ist', () => {
		expect(erinnerungsfall('2026-10-20', OFFEN)?.art).toBe('abgelaufen');
	});

	it('schweigt nach dem Versammlungstag — dann ist nichts mehr zu retten', () => {
		expect(erinnerungsfall('2026-11-05', OFFEN)).toBeNull();
	});

	it('schweigt, wenn die Einladung hinausgegangen ist', () => {
		expect(erinnerungsfall('2026-10-02', { ...OFFEN, versendet: true })).toBeNull();
	});

	it('schweigt ohne hinterlegte Frist', () => {
		expect(erinnerungsfall('2026-10-02', { ...OFFEN, tage: null })).toBeNull();
	});
});

/*
 * **Wann keine Post mehr reicht** (Fachprüfung Teil 2 Runde 3, F3,
 * 06.10.2026): nach dem Werktag vor der Frist, bis zur Frist. Der 05.10.2026
 * ist ein Montag; der Werktag davor ist Freitag, der 02.10.
 */
describe('postZuSpaet', () => {
	const fall = '2026-10-05';

	it('am Werktag vor der Frist reicht die Post noch', () => {
		expect(postZuSpaet('2026-10-02', fall)).toBe(false);
	});

	it('am Wochenende davor nicht mehr', () => {
		expect(postZuSpaet('2026-10-03', fall)).toBe(true);
		expect(postZuSpaet('2026-10-04', fall)).toBe(true);
	});

	it('am letzten Tag selbst nicht, und danach ist es keine Frage der Post mehr', () => {
		expect(postZuSpaet('2026-10-05', fall)).toBe(true);
		expect(postZuSpaet('2026-10-06', fall)).toBe(false);
	});
});

/*
 * **Wie knapp die Post ist** (Fachprüfung Korrekturrunde 06.10.2026): mild nur
 * am Samstag vor einer Frist am Montag, der ein Werktag ist; sonst streng.
 * Ostern 2027: Karfreitag 26.03., Ostermontag 29.03.; Pfingstmontag 17.05.2027.
 */
describe('postlage', () => {
	it('Samstag vor einer Frist am Montag: knapp', () => {
		expect(postlage('2026-10-03', '2026-10-05')).toBe('knapp');
	});

	it('Sonntag vor einer Frist am Montag: zu spät', () => {
		expect(postlage('2026-10-04', '2026-10-05')).toBe('zu_spaet');
	});

	it('Samstag vor einer Frist am Dienstag nach Ostern: zu spät', () => {
		expect(postlage('2027-03-27', '2027-03-30')).toBe('zu_spaet');
	});

	it('Ostermontag vor einer Frist am Dienstag: zu spät', () => {
		expect(postlage('2027-03-29', '2027-03-30')).toBe('zu_spaet');
	});

	it('Samstag vor einer Frist am Pfingstmontag: zu spät', () => {
		expect(postlage('2027-05-15', '2027-05-17')).toBe('zu_spaet');
	});

	it('Samstag vor einer Frist am Sonntag: zu spät', () => {
		expect(postlage('2026-10-03', '2026-10-04')).toBe('zu_spaet');
	});

	it('am Fristtag selbst: zu spät', () => {
		expect(postlage('2026-10-05', '2026-10-05')).toBe('zu_spaet');
	});

	it('Samstag vor einem gewöhnlichen Dienstag: kein Postsatz, der Montag ist der Werktag davor', () => {
		expect(postlage('2026-10-03', '2026-10-06')).toBeNull();
	});

	it('am Freitag, dem Werktag davor, und nach der Frist: kein Postsatz', () => {
		expect(postlage('2026-10-02', '2026-10-05')).toBeNull();
		expect(postlage('2026-10-06', '2026-10-05')).toBeNull();
	});
});

/*
 * **Allgemeine Feiertage** (Produktentscheid 06.10.2026): Neujahr, Karfreitag,
 * Ostermontag, Auffahrt, Pfingstmontag, 1. August, Weihnachten und
 * Stephanstag zählen wie ein Wochenende, kantonale Feiertage nicht.
 */
describe('ostersonntag', () => {
	it('rechnet den Ostersonntag für mehrere Jahre', () => {
		expect(ostersonntag(2026)).toBe('2026-04-05');
		expect(ostersonntag(2027)).toBe('2027-03-28');
		expect(ostersonntag(2028)).toBe('2028-04-16');
		expect(ostersonntag(2038)).toBe('2038-04-25');
		expect(ostersonntag(2000)).toBe('2000-04-23');
		expect(ostersonntag(2019)).toBe('2019-04-21');
	});

	it('trifft die Grenzen des Osterfensters, 22. März und 25. April', () => {
		expect(ostersonntag(2285)).toBe('2285-03-22');
		expect(ostersonntag(1943)).toBe('1943-04-25');
	});

	it('fällt immer auf einen Sonntag', () => {
		for (let jahr = 1900; jahr <= 2200; jahr++) {
			expect(wochentagNummer(ostersonntag(jahr))).toBe(0);
		}
	});
});

describe('istAllgemeinerFeiertag', () => {
	it('kennt die festen und die beweglichen Feiertage', () => {
		for (const tag of [
			'2026-01-01',
			'2026-04-03', // Karfreitag
			'2026-04-06', // Ostermontag
			'2026-05-14', // Auffahrt
			'2026-05-25', // Pfingstmontag
			'2026-08-01',
			'2026-12-25',
			'2026-12-26'
		]) {
			expect(istAllgemeinerFeiertag(tag), tag).toBe(true);
		}
	});

	it('kennt keine kantonalen Feiertage und nicht den Ostersonntag selbst', () => {
		for (const tag of ['2026-01-02', '2026-03-19', '2026-05-01', '2026-04-05', '2026-04-02']) {
			expect(istAllgemeinerFeiertag(tag), tag).toBe(false);
		}
	});
});

describe('werktagDavor über Feiertage', () => {
	it('springt über Ostern: Frist am Dienstag nach Ostern ergibt Gründonnerstag', () => {
		expect(werktagDavor('2026-04-07')).toBe('2026-04-02');
	});

	it('springt über Auffahrt: Frist am Freitag danach ergibt Mittwoch', () => {
		expect(werktagDavor('2026-05-15')).toBe('2026-05-13');
	});

	it('springt über Pfingstmontag: Frist am Dienstag danach ergibt Freitag', () => {
		expect(werktagDavor('2026-05-26')).toBe('2026-05-22');
	});

	it('springt über Weihnachten, Stephanstag und das Wochenende davor', () => {
		// 2028: Samstag 23. bis Dienstag 26. Dezember ohne Werktag.
		expect(werktagDavor('2028-12-27')).toBe('2028-12-22');
		// 2026: Weihnachten am Freitag, Stephanstag am Samstag.
		expect(werktagDavor('2026-12-28')).toBe('2026-12-24');
	});

	it('springt über Neujahr', () => {
		// 01.01.2027 ist ein Freitag.
		expect(werktagDavor('2027-01-04')).toBe('2026-12-31');
		// 01.01.2029 ist ein Montag.
		expect(werktagDavor('2029-01-02')).toBe('2028-12-29');
	});

	it('springt über den 1. August', () => {
		// 01.08.2028 ist ein Dienstag.
		expect(werktagDavor('2028-08-02')).toBe('2028-07-31');
	});

	it('nimmt den Werktag vor einem Feiertag, wenn die Frist selbst auf ihn fällt', () => {
		expect(werktagDavor('2026-04-06')).toBe('2026-04-02');
	});

	it('Gegenprobe: ein gewöhnlicher Werktag bleibt, wie er war', () => {
		expect(werktagDavor('2026-10-07')).toBe('2026-10-06');
		expect(werktagDavor('2026-04-01')).toBe('2026-03-31');
	});

	it('Gegenprobe: kantonale Feiertage zählen als Werktag', () => {
		// 02.01.2026 ist ein Freitag (Berchtoldstag), 19.03.2026 ein Donnerstag (Josefstag).
		expect(werktagDavor('2026-01-03')).toBe('2026-01-02');
		expect(werktagDavor('2026-01-05')).toBe('2026-01-02');
		expect(werktagDavor('2026-03-20')).toBe('2026-03-19');
	});

	/*
	 * **Die Schleifengrenze reicht.** `werktagDavor` geht höchstens sieben
	 * Schritte zurück. Über zwei Jahrhunderte gemessen ist die längste Kette
	 * ohne Werktag vier Tage lang, das Ergebnis also nie mehr als fünf Tage vor
	 * dem Ausgangstag und immer ein Werktag.
	 */
	it(
		'findet für jeden Tag von 2000 bis 2199 einen Werktag, höchstens fünf Tage zurück',
		{ timeout: 20000 },
		() => {
			let laengsterAbstand = 0;
			/*
			 * **Gesammelt statt je Tag geprüft** (19.10.2026, unter Last gemessen).
			 * Dieselbe Zusicherung für dieselben 73 049 Tage, aber ein
			 * `expect`-Aufruf statt 73 049. Der Tagesschritt ersetzt
			 * `tageSpaeter(tag, 1)`, das je Tag ein Datumsobjekt baute; geprüft
			 * wird weiter jeder Tag, und `tageSpaeter` läuft in `werktagDavor`
			 * selbst weiter mit. Unter zwei gleichzeitigen Läufen fiel die Probe
			 * von 8,7 und 6,8 s auf 3,1 und 3,4 s.
			 *
			 * **Die eigene Zeitgrenze** ist die der Sichtproben unter Last: Zwei
			 * gleichzeitige Läufe der Nicht-DB-Suite brachten die Maschine auf
			 * Lastdurchschnitt 19 bis 22, und auch nach der Beschleunigung lag die
			 * Probe über 2500 ms. Die 20 Sekunden lassen Luft, ohne einen wirklich
			 * hängenden Lauf zu verdecken.
			 */
			const verstoesse: string[] = [];
			const tag = new Date('2000-01-01T12:00:00Z');
			let datum = tag.toISOString().slice(0, 10);
			while (datum < '2200-01-01') {
				const ergebnis = werktagDavor(datum);
				const nummer = wochentagNummer(ergebnis) ?? 0;
				if (!(nummer >= 1 && nummer <= 5 && !istAllgemeinerFeiertag(ergebnis))) {
					verstoesse.push(`${datum} → ${ergebnis}`);
				}
				laengsterAbstand = Math.max(laengsterAbstand, tageZwischen(ergebnis, datum));
				tag.setUTCDate(tag.getUTCDate() + 1);
				datum = tag.toISOString().slice(0, 10);
			}
			// Die Meldung bleibt lesbar, auch wenn eine Änderung viele Tage trifft.
			const hinweis =
				verstoesse.length > 10
					? `${verstoesse.length} Verstösse, die ersten: ${verstoesse.slice(0, 10).join(', ')}`
					: `kein Werktag: ${verstoesse.join(', ')}`;
			expect(verstoesse, hinweis).toEqual([]);
			expect(laengsterAbstand).toBe(5);
		}
	);
});

describe('erinnerungstag und postZuSpaet über Feiertage', () => {
	it('erinnert vor Ostern, wenn die Frist am Dienstag nach Ostern liegt', () => {
		// 30 Tage vor dem 07.05.2026 ist Dienstag, der 07.04.2026.
		expect(erinnerungstag('2026-05-07', 30)).toBe('2026-04-02');
	});

	it('am Ostermontag vor einer Frist am Dienstag reicht die Post nicht mehr', () => {
		expect(postZuSpaet('2026-04-06', '2026-04-07')).toBe(true);
		expect(postZuSpaet('2026-04-03', '2026-04-07')).toBe(true);
	});

	it('am Gründonnerstag davor reicht sie noch', () => {
		expect(postZuSpaet('2026-04-02', '2026-04-07')).toBe(false);
	});

	it('Gegenprobe: am Berchtoldstag vor einer Frist am Montag reicht sie noch', () => {
		expect(postZuSpaet('2026-01-02', '2026-01-05')).toBe(false);
	});
});
