/**
 * Der Erfordernisvorschlag (Welle 3, FR-59).
 *
 * **Die eine Zusage, die alles trägt:** Das Modell beantwortet Rückfragen, es
 * wählt kein Erfordernis. Welcher Fall daraus folgt, rechnet `laufe()` an der
 * geltenden Fassung aus — also unser eigener Code. Ein Erfordernis, das
 * niemand herleiten kann, entsteht hier nicht.
 *
 * Geprüft wird gegen das **echte** Regelwerk und nicht gegen ein erfundenes:
 * Ein Prüfstand mit drei ausgedachten Knoten würde genau die Verwechslungen
 * nicht sehen, um die es geht.
 */
import { describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import {
	einstiegsauftrag,
	frageauftrag,
	gegenpruefung,
	lesbareAntwort,
	lesbarerEinstieg,
	vorschlagAus,
	type Modellschritt
} from '$lib/domain/erfordernisvorschlag';

const RW = holeRegelwerk();

/** Baut Schritte, wie sie der Baumlauf erzeugt. */
function schritte(...paare: [string, string, boolean?][]): Modellschritt[] {
	return paare.map(([frageId, antwortId, unsicher]) => {
		const f = RW.fragen.find((x) => x.id === frageId)!;
		const a = f.antworten.find((x) => x.id === antwortId)!;
		return {
			frageId,
			frageText: f.text,
			antwortId,
			antwortText: a.text,
			begruendung: 'Weil es so ist.',
			unsicher: unsicher === true
		};
	});
}

/** Der Weg zu einer nützlichen baulichen Massnahme. */
const WEG_NUETZLICH = schritte(['f1-0', 'f1-0-nein'], ['f1-1', 'f1-1-nein'], ['f1-2', 'f1-2-ja']);

describe('Was als Vorschlag durchkommt', () => {
	it('ein Weg durch den echten Baum', () => {
		const l = vorschlagAus(RW, 'a-bauen', WEG_NUETZLICH);
		expect(l.vorschlag?.knotenId).toBe('k-baulich-nuetzlich');
		expect(l.vorschlag?.typ).toBe('qualifiziertes_mehr');
		// Titel und Rechtsgrundlage kommen aus dem Regelwerk, nicht aus dem Modell.
		expect(l.vorschlag?.rechtsgrundlage).toMatch(/647d/);
	});

	it('nennt die Rückfragen, die zu ihm führen', () => {
		// Wörtlich verlangt in FR-59 — und der Grund, warum die Sitzungsleitung
		// den Vorschlag nachvollziehen statt glauben kann.
		const s = vorschlagAus(RW, 'a-bauen', WEG_NUETZLICH).vorschlag!.schritte;
		expect(s).toHaveLength(3);
		expect(s[1].frageText).toMatch(/Wert oder Gebrauchsfähigkeit/);
		expect(s[1].antwortText).toMatch(/darüber hinaus/);
	});

	it('kein erfundener Ast', () => {
		expect(vorschlagAus(RW, 'a-erfunden', WEG_NUETZLICH).grund).toMatch(/passt nicht/);
		expect(lesbarerEinstieg({ astId: 'a-erfunden' }, RW)).toBeNull();
		expect(lesbarerEinstieg({ astId: 'a-bauen' }, RW)).toBe('a-bauen');
	});

	it('keine Antwort, die es zur Frage nicht gibt', () => {
		/*
		 * **Der Kern der Sache.** Ein Modell, das «zwei Drittel der Anwesenden»
		 * antwortet, hätte ein Mehrheitserfordernis erfunden. Hier kann es nur
		 * eine der zwei bis vier Antworten wählen, die an der Frage stehen — und
		 * selbst dann rechnet die Anwendung den Fall aus.
		 */
		const f = RW.fragen.find((x) => x.id === 'f1-0')!;
		expect(lesbareAntwort({ antwortId: 'f1-0-vielleicht' }, f)).toBeNull();
		// Auch die Kennung der **Frage** ist keine Antwort — genau das lieferte
		// ein Modell im Durchgang vom 05.08.2026.
		expect(lesbareAntwort({ antwortId: 'f1-0' }, f)).toBeNull();
		expect(lesbareAntwort({ antwortId: 'f1-0-ja' }, f)?.antwortId).toBe('f1-0-ja');
	});

	it('kein halber Weg', () => {
		// Mitten im Baum stehengeblieben. Die offene Frage ist trotzdem eine
		// brauchbare Auskunft — sie sagt der Sitzungsleitung, wo es klemmt.
		const l = vorschlagAus(RW, 'a-bauen', schritte(['f1-0', 'f1-0-nein']));
		expect(l.vorschlag).toBeNull();
		expect(l.grund).toMatch(/offenen Frage/);
		expect(l.grund).toMatch(/Wert oder Gebrauchsfähigkeit/);
	});

	it('kein Vorschlag aus Unsinn', () => {
		const f = RW.fragen.find((x) => x.id === 'f1-0')!;
		expect(lesbareAntwort(null, f)).toBeNull();
		expect(lesbareAntwort('Guten Tag!', f)).toBeNull();
		expect(lesbarerEinstieg('Guten Tag!', RW)).toBeNull();
	});

	it('erkennt einen Grenzfall, sobald ein Schritt unsicher war', () => {
		// Auch wenn der Endknoten harmlos aussieht: Wer unterwegs geraten hat,
		// hat am Ende geraten.
		const l = vorschlagAus(
			RW,
			'a-bauen',
			schritte(['f1-0', 'f1-0-nein'], ['f1-1', 'f1-1-nein'], ['f1-2', 'f1-2-ja', true])
		);
		expect(l.vorschlag?.grenzfall).toBe(true);
	});

	it('erkennt einen Grenzfall auch am Knoten selbst', () => {
		const l = vorschlagAus(
			RW,
			'a-bauen',
			schritte(['f1-0', 'f1-0-nein'], ['f1-1', 'f1-1-nein'], ['f1-2', 'f1-2-unsicher'])
		);
		expect(l.vorschlag?.grenzfall).toBe(true);
	});
});

describe('Der Auftrag an das Modell', () => {
	const a = frageauftrag(RW.fragen.find((f) => f.id === 'f1-1')!);

	it('legt die Frage samt Anhaltspunkten vor', () => {
		/*
		 * **Der Fund vom 05.08.2026.** Ohne die Fragen ordnete das Modell einen
		 * Liftanbau als «notwendige bauliche Massnahme» ein — einfaches Mehr statt
		 * qualifiziertem. Die Hilfetexte tragen die Einordnung: «Ersatz von
		 * Defektem durch Gleichwertiges» sagt mehr über «notwendig» als das Wort.
		 */
		expect(a).toMatch(/Ist die Massnahme nötig, um Wert oder Gebrauchsfähigkeit zu erhalten/);
		expect(a).toMatch(/Ersatz von Defektem durch Gleichwertiges/);
		expect(a).toMatch(/f1-1-ja/);
	});

	it('sagt beim Einstieg ausdrücklich, dass kein Erfordernis zu wählen ist', () => {
		expect(einstiegsauftrag(RW)).toMatch(/wählst kein Mehrheitserfordernis/);
		for (const ast of RW.aeste) expect(einstiegsauftrag(RW)).toContain(ast.id);
	});

	it('verlangt bei Unsicherheit die strengere Antwort', () => {
		/*
		 * **Die Unsymmetrie ist der Kern.** Ein zu streng gefasster Beschluss ist
		 * gültig, ein zu schwach gefasster anfechtbar. Ein Modell, das im Zweifel
		 * abwärts rundet, wäre gefährlich.
		 */
		expect(a).toMatch(/strengeren/);
		expect(a).toMatch(/anfechtbar/);
	});
});

describe('Die Gegenprüfung eines gesetzten Erfordernisses', () => {
	const vorschlag = vorschlagAus(RW, 'a-bauen', WEG_NUETZLICH).vorschlag!;

	it('schweigt, solange nichts gesetzt ist', () => {
		expect(gegenpruefung(null, vorschlag)).toBeNull();
	});

	it('bestätigt den Gleichlauf', () => {
		const g = gegenpruefung(
			{ knotenId: 'k-baulich-nuetzlich', typ: 'qualifiziertes_mehr', titel: 'Nützlich' },
			vorschlag
		);
		expect(g?.art).toBe('gleich');
		expect(g?.auffaellig).toBe(false);
	});

	it('warnt deutlich, wenn das Gesetzte schwächer ist', () => {
		// Die Richtung, in der ein Fehler teuer wird.
		const g = gegenpruefung(
			{ knotenId: 'k-baulich-notwendig', typ: 'einfaches_mehr', titel: 'Notwendig' },
			vorschlag
		);
		expect(g?.art).toBe('schwaecher_gesetzt');
		expect(g?.auffaellig).toBe(true);
		expect(g?.satz).toMatch(/anfechtbar/);
		expect(g?.satz).toMatch(/712m/);
	});

	it('meldet auch das Strengere — aber ohne Drohung', () => {
		// Ein Beschluss mit zu hoher Mehrheit ist gültig. Er kann nur scheitern,
		// obwohl er es nicht müsste.
		const g = gegenpruefung(
			{ knotenId: 'k-baulich-luxurioes', typ: 'einstimmigkeit', titel: 'Luxuriös' },
			vorschlag
		);
		expect(g?.art).toBe('strenger_gesetzt');
		expect(g?.satz).toMatch(/gültig/);
		expect(g?.satz).not.toMatch(/anfechtbar/);
	});

	it('unterscheidet anderen Fall von anderer Mehrheit', () => {
		// Gleiche Mehrheit, anderer Weg: für die Zählung belanglos, für die
		// Begründung im Protokoll nicht.
		const g = gegenpruefung(
			{ knotenId: 'k-irgendein-anderer', typ: 'qualifiziertes_mehr', titel: 'Anderer Fall' },
			vorschlag
		);
		expect(g?.art).toBe('anderer_fall');
		expect(g?.auffaellig).toBe(false);
	});

	it('behauptet keine Richtung, wo es keine Leiter gibt', () => {
		/*
		 * Ein Reglementsmehr — zwei Drittel der Anwesenden — ist nicht ohne
		 * Weiteres mehr oder weniger als die Hälfte aller Wertquoten. Hier eine
		 * Richtung zu behaupten, wäre eine Rechtsauskunft, die niemand geben kann.
		 */
		const g = gegenpruefung(
			{ knotenId: 'k-baulich-notwendig', typ: 'einfaches_mehr', titel: 'Notwendig' },
			{ ...vorschlag, typ: 'reglementsmehr', titel: 'Nach Reglement' }
		);
		expect(g?.art).toBe('unvergleichbar');
		expect(g?.auffaellig).toBe(true);
		expect(g?.satz).toMatch(/nicht dieselbe Leiter/);
	});
});
