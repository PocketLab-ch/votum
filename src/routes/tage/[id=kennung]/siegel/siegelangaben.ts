/**
 * Die Felder der Hauszeile, die vom Siegel abhängen.
 *
 * **Warum als reine Funktion herausgezogen** (03.10.2026). Die Zeile las das
 * Siegel zweimal: `holeSiegel` vorweg, und für ein geschlossenes Haus ohne
 * Siegel nochmals `erhebeSiegellage`. Wurde das Haus zwischen beiden Aufrufen
 * versiegelt, lieferte `erhebeSiegellage` `{ moeglich: false, hindernisse: [],
 * siegel }`: `hindernisse.join(' ')` ist der leere String, die Zeile stand auf
 * «bereit», der Knopf zählte das Haus mit, und erst der Klick meldete «bereits
 * versiegelt». Als reine Funktion lässt sich genau dieser Fall ohne Datenbank
 * und ohne Wettlauf-Fenster prüfen (`tests/db/siegel.test.ts`).
 *
 * **Die Lage sticht das ältere Siegel.** `erhebeSiegellage` liest das Siegel
 * selbst; ihr Befund ist der jüngere Stand. Trägt sie eines, ist das Haus
 * versiegelt, und die Zeile sagt das mit Kopf, Zeitpunkt und Zeitstempel.
 * `hindernis` bleibt dann leer, denn das Siegel ist keines.
 *
 * Der Zeitstempel steht am Siegel selbst, kein zweiter Abruf: Die erste
 * Fassung holte ihn über `holeZeitstempel()`, das dafür jedes Manifest neu
 * liest; der Wert lag die ganze Zeit schon daneben.
 */
import type { Siegel, Siegelbefund } from '$lib/server/siegel';
import type { Zeitpunkt } from '$lib/domain/types';

export interface Siegelangaben {
	siegelkopf: string | null;
	versiegeltAm: Zeitpunkt | null;
	zeitstempel: 'ausstehend' | 'vorhanden' | 'gescheitert' | null;
	/** Ob der Ersatzdienst bezeugt hat (13.11.2026); die Zeile sagt es dazu. */
	zeitstempelVomErsatz: boolean;
	zeitstempelhinweis: string | null;
	/** Der Grund, warum dieses Haus nicht «bereit» ist; `null` heisst «das Siegel geht». */
	hindernis: string | null;
}

export function siegelangaben(siegel: Siegel | null, lage: Siegelbefund | null): Siegelangaben {
	const gefunden = lage?.siegel ?? siegel;
	return {
		siegelkopf: gefunden ? gefunden.siegel.slice(0, 16) : null,
		versiegeltAm: gefunden?.versiegeltAm ?? null,
		zeitstempel: gefunden?.zeitstempel ?? null,
		zeitstempelVomErsatz: gefunden?.zeitstempelVomErsatz ?? false,
		zeitstempelhinweis: gefunden?.zeitstempelBemerkung ?? null,
		/*
		 * `|| null` macht das Feld ehrlich: Ein leerer `hindernisse`-Befund
		 * (der Wettlauf) darf nicht als leerer String stehen bleiben. Den
		 * Wettlauf selbst schliesst `gefunden` oben: Trägt die Lage ein
		 * Siegel, ist `siegelkopf` gesetzt und die Zeile zeigt «versiegelt».
		 */
		hindernis: lage && !lage.moeglich ? lage.hindernisse.join(' ') || null : null
	};
}
