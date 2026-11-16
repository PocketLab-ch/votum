/**
 * Die Form einer Kennung, an einer Stelle.
 *
 * **Die Klasse.** `versammlung` spricht Kennungen als UUID an. Eine
 * Zeichenkette, die nur so aussieht, lehnt PostgreSQL mit `22P02` ab; auf einem
 * Weg über `alsBetreiber` wird daraus über `kennungsfehler` eine Absage, auf
 * einem unmittelbaren `sql`-Aufruf die rohe 500. Und wo «unbekannte Kennung
 * still übergehen» die Absicht ist, ist auch die Absage zu viel.
 *
 * **Warum es dieses Modul gibt** (Block B2 des Abschlusses, 16.10.2026): für die
 * Wege, die eine unbrauchbare Kennung **still** übergehen (`verlaufsabfrage.ts`,
 * `saaleinstieg.ts`, die Herkunft im Layout der Gemeinschaft). In
 * `saaleinstieg.ts` stand eine zu laxe Fassung (`[0-9a-f-]{36}` liess jede
 * 36-stellige Zeichenkette durch, und `abendeinstieg_haus(text, uuid)` warf
 * daraus 22P02). **Nicht die einzige Fassung im Haus** (Codeprüfung B2): Die
 * Form steht ebenso in `src/params/kennung.ts` (Matcher), als `KENNUNGSFORM`
 * in `zugehoerigkeit.ts` und in `archivieren.ts`, `paketpruefung.ts`,
 * `domain/verlauf.ts`, `domain/uebernahme.ts`. Zusammengeführt sind sie
 * nicht; das wäre ein eigener Umbau. Wer eine Kennung übersetzen will, statt
 * sie zu übergehen, verlässt sich auf `kennungsfehler` in `db.ts`.
 */
const KENNUNG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sieht das aus wie eine Kennung? */
export function istKennung(wert: string): boolean {
	return KENNUNG.test(wert);
}

/**
 * Die Kennung oder `null`: für die Wege, auf denen ein unbrauchbarer Wert
 * still übergegangen wird (etwa eine Herkunft in der Adresszeile).
 */
export function alsKennung(wert: string | null | undefined): string | null {
	const w = wert?.trim();
	return w && KENNUNG.test(w) ? w : null;
}
