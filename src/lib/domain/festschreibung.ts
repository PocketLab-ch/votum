/**
 * Die beim Verkünden festgeschriebene Auszählung (seit 25.09.2026).
 *
 * **Produktentscheid 25.09.2026:** «nach jeder Abstimmung [soll] das bereits
 * abgestimmte nicht mehr verändert werden können (Momentaufnahme).» Bis dahin
 * zählte `ergebnisIn` jeden geschlossenen Durchgang bei jedem Lesen neu aus,
 * mit dem Code von heute; eine Änderung an einer Zählregel wirkte rückwirkend
 * auf verkündete Ergebnisse und Protokolle.
 *
 * **Die Hülle trägt eine Formatnummer**, weil die Auszählung wächst. Ein
 * festgeschriebenes Ergebnis wird mit dem Code von morgen gelesen, und ein
 * Feld, das es heute noch nicht gibt, fehlt ihm dann. Was fehlt, ergänzt
 * `ausFestschreibung` mit einem Ersatzwert, nicht der Verbraucher. Die Probe
 * `tests/domain/festschreibung.test.ts` hält eine Hülle von heute fest und
 * wird rot, sobald die Auszählung ein **Pflichtfeld** bekommt, für das hier
 * keiner steht. Ein neues optionales Feld sieht sie nur, wenn ihre Lagen es
 * setzen; ein solches muss der Verbraucher nach seinem Typ ohnehin als
 * abwesend behandeln können.
 *
 * **Nicht festgeschrieben** ist, was aus der Auszählung erst zur Anzeige
 * gebildet wird, etwa der Satz aus `ergebnisInWorten`. Sein Wortlaut darf sich
 * ändern; Annahme, Zahlen und Befunde nicht.
 */
import type { Auszaehlung, Betroffenenbefund } from './auszaehlung';

/**
 * Die Formatnummer, unter der heute festgeschrieben wird.
 *
 * **Sie bleibt 1, solange die Auszählung nur wächst** (Code-Review
 * 25.09.2026 zur Festschreibung, Befund A). Ein neues Feld braucht kein neues
 * Format: Eine ältere Fassung übergeht, was sie nicht kennt, und eine neuere
 * ergänzt, was fehlt (`ausFestschreibung`). Ein Format 2 braucht es erst für
 * einen brechenden Umbau, etwa ein umbenanntes oder anders gebautes Feld.
 *
 * **Und ein Format 2 bricht die Rücknahme**, die `docs/installation.md` den
 * Regelfall nennt: Eine ältere Fassung liest es nicht (`null`), und ihre
 * Seiten behandeln ein fehlendes Ergebnis wie «nichts ausgezählt». Das
 * Protokoll druckte dann «Über diesen Antrag wurde nicht abgestimmt.». Wer es
 * einführt, entscheidet das deshalb eigens und baut vorher die Anzeige für
 * `unlesbar` (`server/abstimmung.ts`, `Durchgangsergebnis`).
 */
export const FESTSCHREIBUNGSFORMAT = 1;

export interface Festschreibung {
	format: typeof FESTSCHREIBUNGSFORMAT;
	auszaehlung: Auszaehlung;
}

/** Die Hülle für eine Auszählung, wie sie in `voting_round.result_json` steht. */
export function festschreibung(auszaehlung: Auszaehlung): Festschreibung {
	return { format: FESTSCHREIBUNGSFORMAT, auszaehlung };
}

/**
 * Liest eine festgeschriebene Auszählung, `null` bei unbekanntem Format.
 *
 * **Unbekannt heisst nicht neu rechnen.** Ein Format, das dieser Code nicht
 * kennt, stammt von einer neueren Fassung, etwa nach einer Rücknahme, die
 * `docs/installation.md` den Regelfall nennt. Still auf die Rechnung
 * auszuweichen, gäbe genau das nachgerechnete Ergebnis aus, das die
 * Festschreibung verhindern soll. Der Aufrufer sagt stattdessen, dass es sich
 * nicht lesen lässt.
 *
 * **Die Form wird so weit geprüft, wie die Verbraucher sich darauf stützen:**
 * die beiden Stimmenspiegel, der Betroffenenbefund und die Annahme. Eine Hülle
 * `{ format: 1, auszaehlung: {} }` liesse sonst jede Seite an `koepfe.ja`
 * scheitern.
 */
export function ausFestschreibung(roh: unknown): Auszaehlung | null {
	const h = roh as Partial<Festschreibung> | null;
	if (!h || typeof h !== 'object' || h.format !== FESTSCHREIBUNGSFORMAT) return null;
	const a = h.auszaehlung as Partial<Auszaehlung> | undefined;
	if (
		!a ||
		typeof a !== 'object' ||
		typeof a.angenommen !== 'boolean' ||
		!a.koepfe ||
		!a.quoten ||
		!a.betroffene
	) {
		return null;
	}
	/*
	 * **Ersatzwerte für Felder, die nach Format 1 dazukommen.** Hierher, mit
	 * Datum und dem Wert, der für ein Ergebnis von vorher zutrifft; das
	 * Literal in `tests/domain/festschreibung.test.ts` bleibt stehen.
	 *
	 * 25.09.2026, Form der Betroffenenzustimmung: Ergebnisse, die vor diesem
	 * Umbau festgeschrieben wurden, rechneten die Zustimmung Betroffener in die
	 * Annahme ein, auch bei Art. 712e Abs. 2, wo sie nach der Fachprüfung vom
	 * 25.09.2026 nicht dorthin gehört. Die alten Ergebnisse bleiben, wie sie
	 * sind; ihre Form ist die, die ihre Rechnung beschreibt:
	 * `im_saal_oder_vorab`. `vorab` und `ausstehend` sind für sie leer.
	 *
	 * 26.09.2026, Veto im Ausstand: Vor diesem Umbau gab es keinen
	 * Veto-Entscheid; `veto` ist für alte Ergebnisse leer.
	 *
	 * 04.10.2026, geheime Abstimmung (Migration 141): Vor diesem Umbau gab es
	 * das Merkmal nicht; ein festgeschriebenes Ergebnis von damals war offen.
	 * `geheim` ist für alte Hüllen `false`.
	 *
	 * 08.10.2026, Protokollhinweise: Vor diesem Umbau gab es sie nicht; alte
	 * Ergebnisse tragen keine der Zeilen, das Protokoll zeigt dann wie bisher
	 * nur Ausgang und Zahlen. `protokollhinweise` ist für alte Hüllen leer.
	 *
	 * Der Ersatzwert ergänzt nur diese Felder; alles andere trägt die
	 * Hülle selbst, und die Prüfung darüber stellt es sicher.
	 */
	const b = a.betroffene as Partial<Betroffenenbefund>;
	const betroffene: Betroffenenbefund = {
		...a.betroffene,
		form: b.form ?? 'im_saal_oder_vorab',
		vorab: b.vorab ?? [],
		ausstehend: b.ausstehend ?? [],
		veto: b.veto ?? []
	};
	// Altbestand ohne das Merkmal war offen; `false` ist die zutreffende Aussage.
	const geheim = typeof a.geheim === 'boolean' ? a.geheim : false;
	const protokollhinweise = Array.isArray(a.protokollhinweise) ? a.protokollhinweise : [];
	return { ...a, betroffene, geheim, protokollhinweise } as Auszaehlung;
}
