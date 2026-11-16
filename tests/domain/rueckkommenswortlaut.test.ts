/**
 * **Nein heisst Nein** (Produktentscheid 30.09.2026, `docs/freigabe.md`,
 * «Offen: Aus der Prüfung zu ‹Rückkommen, dann Neuabstimmung›», Punkt (a)).
 *
 * Nach einem Rückkommen auf einen angenommenen Beschluss ersetzt der neue
 * Durchgang den früheren, sobald er einen Beschluss ergibt, auch eine
 * Ablehnung. Nur ohne Beschluss bleibt der frühere. Bis dahin liess Votum ihn
 * auch nach einer Ablehnung stehen, und weil im Saal nur derselbe Antrag
 * nochmals zur Abstimmung kommt, führten Ja und Nein zum selben Beschluss
 * (Laien- und Fachprüfung 30.09.2026, L1, F-1). Diese Probe hält fest, dass
 * alle Texte «abgelehnt» und «kein Beschluss» trennen und dasselbe sagen.
 */
import { describe, expect, it } from 'vitest';
import {
	ersetzungInWorten,
	erfordernisFuerRueckkommen,
	rueckkommensvorbehalt,
	rueckkommenstitel,
	rueckkommenswortlaut
} from '$lib/domain/rueckkommen';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

const ZIEL = { nummer: '4', titel: 'Ersatz der Gegensprechanlage' };

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-gewoehnlich',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

describe('Der Rückkommensantrag auf einen angenommenen Beschluss', () => {
	it('hebt auf und trennt «abgelehnt» von «kein Beschluss»', () => {
		const w = rueckkommenswortlaut(ZIEL, true);
		expect(w).toBe(
			'Die Versammlung beschliesst die Sache zu Traktandum 4 «Ersatz der Gegensprechanlage» ' +
				'erneut, über denselben oder einen geänderten Antrag. Mit dem neuen Beschluss zur ' +
				'Sache wird der bisherige aufgehoben, auch mit einer Ablehnung und auch wenn über ' +
				'einen geänderten Antrag abgestimmt wird; kommt dabei gar kein Beschluss zustande, ' +
				'auch keine Ablehnung, ' +
				'bleibt er in Kraft. Eine Stimmengleichheit im neuen Durchgang gilt als Ablehnung, wenn das ' +
				'Reglement nichts anderes bestimmt.'
		);
		// Nicht «der Antrag»: Das läse sich als dieser Rückkommensantrag (L9).
		expect(w).not.toMatch(/der Antrag/);
	});

	it('sagt im Hinweis beim Stellen dasselbe, auf Rz. 202a statt auf den Beobachter', () => {
		const h = rueckkommensvorbehalt(true);
		expect(h).toContain(
			'Der neue Beschluss, auch eine Ablehnung, hebt den bisherigen auf, auch bei einem ' +
				'geänderten Antrag; nur wenn gar kein Beschluss zustande kommt, bleibt er in Kraft.'
		);
		expect(h).toContain('Rz. 202a ad Art. 712g');
		// Das Mehr als Regel der Anwendung, nicht als Gesetz (Fachprüfung F-4).
		expect(h).toContain('setzt die Anwendung dasselbe Mehr');
		expect(h).not.toMatch(/Beobachter|Kommt der neue Beschluss nicht zustande/);
	});

	it('kennzeichnet das gleiche Mehr als Regel der Anwendung', () => {
		const e = erfordernisFuerRueckkommen(EINFACHES_MEHR, true);
		expect(e.titel).toBe('Wie der Beschluss, der aufgehoben werden soll: Einfaches Mehr');
		expect(e.rechtsgrundlage).toBe(
			'ZGB Art. 712m Abs. 2 — dasselbe Mehr wie für den Beschluss selbst, weil das Rückkommen ' +
				'ihn aufhebt (Regel dieser Anwendung).'
		);
	});

	it('nennt den Durchgang ohne Beschluss so, nicht «nicht angenommen»', () => {
		expect(ersetzungInWorten('rueckkommen_erfolglos', null)).toBe(
			'Auf das Traktandum wurde zurückgekommen und erneut abgestimmt. Ein Beschluss kam dabei ' +
				'nicht zustande; der frühere Beschluss bleibt in Kraft.'
		);
	});

	it('nennt beim Antrag auf eine Ablehnung auch den geänderten Antrag', () => {
		expect(rueckkommenswortlaut(ZIEL, false)).toBe(
			'Auf Traktandum 4 «Ersatz der Gegensprechanlage» wird zurückgekommen. Der Antrag wurde ' +
				'abgelehnt; die Versammlung beschliesst erneut darüber, über denselben oder einen ' +
				'geänderten Antrag.'
		);
	});

	/*
	 * **Nach einer Ersetzung durch einen Folgeantrag** (Codeprüfung B1; Plan
	 * Folgeantrag nach Rückkommen, Soll 7). Der bisherige Beschluss ist dann der
	 * zum Folgeantrag; Titel und Wortlaut nannten nur das Grundtraktandum.
	 */
	it('nennt den Folgeantrag, dessen Beschluss gilt', () => {
		const f = { nummer: '4.2', titel: 'Nur die Sprechstelle' };
		const w = rueckkommenswortlaut(ZIEL, true, f);
		expect(w).toContain('Bisher gilt dazu der Beschluss zum Folgeantrag 4.2 «Nur die Sprechstelle».');
		expect(w).toContain('über denselben oder einen geänderten Antrag');
		expect(rueckkommenswortlaut(ZIEL, false, f)).toContain(
			'Zuletzt wurde dazu der Folgeantrag 4.2 «Nur die Sprechstelle» abgelehnt;'
		);
		expect(rueckkommenstitel({ nummer: '4', titel: 'Ersatz der Gegensprechanlage' }, f)).toBe(
			'Rückkommen auf 4 Ersatz der Gegensprechanlage (Beschluss zu 4.2)'
		);
		expect(rueckkommenstitel({ nummer: '4', titel: 'Ersatz der Gegensprechanlage' })).toBe(
			'Rückkommen auf 4 Ersatz der Gegensprechanlage'
		);
	});
});
