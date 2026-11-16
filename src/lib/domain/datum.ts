/**
 * Datumsangaben in lesbarer Form.
 *
 * Lag bisher im PDF-Bau und war damit für die Oberfläche unerreichbar — sie
 * schrieb deshalb «Versammlung vom 2026-05-19» in die Überschrift, während auf
 * der Einladung «19. Mai 2026» stand. Zwei Schreibweisen für dasselbe Datum in
 * derselben Anwendung.
 *
 * Im Kern, weil es reine Zeichenkettenarbeit ist: keine Uhr, kein Gebietsschema,
 * kein `Intl` (dessen Ergebnis von der Umgebung abhängt und damit auf Server und
 * Gerät verschieden ausfallen kann — was beim Hydrieren einen Unterschied gäbe).
 */

const MONATE = [
	'Januar',
	'Februar',
	'März',
	'April',
	'Mai',
	'Juni',
	'Juli',
	'August',
	'September',
	'Oktober',
	'November',
	'Dezember'
];

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/**
 * «19. Mai 2026».
 *
 * Unlesbare Eingaben kommen unverändert zurück. Eine Ausnahme wäre hier das
 * Falsche: Ein Datum, das die Anwendung nicht versteht, soll sichtbar bleiben,
 * damit jemand es berichtigt — nicht eine Seite zum Absturz bringen.
 */
export function datumLang(iso: string): string {
	const [jahr, monat, tag] = iso.split('-').map(Number);
	if (!jahr || !monat || !tag || monat < 1 || monat > 12) return iso;
	return `${tag}. ${MONATE[monat - 1]} ${jahr}`;
}

/**
 * Der Wochentag eines Kalendertags als Zahl: 0 = Sonntag bis 6 = Samstag.
 * `null`, wo die Eingabe kein Datum ist.
 *
 * **Zellers Kongruenz statt `new Date`**, damit der Kern keine Zeitzone anfasst.
 * Ein Datum ohne Uhrzeit ist ein Kalendertag, und der verschiebt sich in
 * `new Date('2026-05-19')` je nach Zeitzone um einen Tag.
 *
 * **Eine Rechnung, zwei Aufrufer** (01.09.2026): Die Beschriftung unten und die
 * Werktagsrechnung der Einberufungsfrist fragen dasselbe. Zwei Fassungen davon
 * liefen auseinander, und dann nennte die Erinnerung einen anderen Tag als die
 * Anzeige daneben.
 */
export function wochentagNummer(iso: string): number | null {
	const [jahr, monat, tag] = iso.split('-').map(Number);
	if (!jahr || !monat || !tag || monat < 1 || monat > 12) return null;
	const m = monat < 3 ? monat + 12 : monat;
	const j = monat < 3 ? jahr - 1 : jahr;
	const k = j % 100;
	const s = Math.floor(j / 100);
	const h = (tag + Math.floor((13 * (m + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(s / 4) + 5 * s) % 7;
	// Zeller liefert 0 = Samstag.
	return (h + 6) % 7;
}

/** «Di, 19. Mai 2026» — wo der Wochentag bei der Planung hilft. */
export function datumMitWochentag(iso: string): string {
	const [jahr, monat, tag] = iso.split('-').map(Number);
	const nummer = wochentagNummer(iso);
	if (nummer === null) return iso;
	return `${WOCHENTAGE[nummer].slice(0, 2)}, ${tag}. ${MONATE[monat - 1]} ${jahr}`;
}

/**
 * «19:03» — die Uhrzeit eines Zeitpunkts, in Schweizer Zeit.
 *
 * **Warum hier und nicht in der Seite.** Dieselbe Zeile stand bis zum
 * 20.08.2026 in der Anwesenheitsseite; als der Einlass eine eigene Komponente
 * bekam, hätte sie ein zweites Mal entstehen müssen. Zwei Fassungen derselben
 * Formatierung laufen auseinander, und dann steht dieselbe Ankunft an zwei
 * Stellen verschieden da.
 *
 * Anders als beim Kalendertag ist `new Date` hier richtig: Ein Zeitpunkt trägt
 * seine Zone mit, und genau die soll umgerechnet werden.
 */
export function uhrzeit(iso: string | null | undefined): string {
	if (!iso) return '—';
	return new Date(iso).toLocaleTimeString('de-CH', {
		timeZone: 'Europe/Zurich',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * «21:14:07» — die Uhrzeit eines Zeitpunkts mit Sekunden, in Schweizer Zeit.
 *
 * **Warum es die genaue Form braucht.** Der Verlauf ist die Belegkette eines
 * Abends, und darin liegen Ereignisse derselben Minute: Eröffnung und erster
 * Aufruf, Schliessen und Verkünden. Die Verlaufsseite zeigt Sekunden
 * (`timeStyle: 'medium'`); das Verlaufs-PDF ist ihre lesbare Fassung für ein
 * Gericht und darf die Reihenfolge nicht verlieren, auf die es dort ankommt.
 * Für den Fliesstext bleibt es bei `uhrzeit` ohne Sekunden.
 */
export function uhrzeitGenau(iso: string | null | undefined): string {
	if (!iso) return '—';
	return new Date(iso).toLocaleTimeString('de-CH', {
		timeZone: 'Europe/Zurich',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

/**
 * «22. August 2026 um 21:14 Uhr» — Datum und Uhrzeit in einem Satz.
 *
 * Für den Siegelabschnitt im Protokoll (22.08.2026): Dort steht der bezeugte
 * Zeitpunkt in einem Fliesstext, und «2026-08-22T21:14:07.000Z» liest im Saal
 * niemand. Die Zeitzone ist die hiesige — bezeugt wird eine Schweizer
 * Versammlung, und eine Uhrzeit in UTC führte beim Vergleich mit dem
 * Zeitstempel in die Irre.
 */
export function zeitpunktLang(iso: string): string {
	return `${datumLang(tagVon(iso))} um ${uhrzeit(iso)} Uhr`;
}

/**
 * Zeitpunkt kompakt, in Schweizer Zeit — «25.08.2026, 21:14».
 *
 * **Warum das nicht jede Seite selbst formatiert** (04.09.2026). Elf Stellen
 * riefen `toLocaleString('de-CH', …)` **ohne** `timeZone`. `Intl` nimmt dann
 * die Zone des Geräts, und beim Hydrieren wechselt die Zahl: Der Server liefert
 * die Seite in UTC aus, der Browser rechnet sie in die Gerätezeit um. Gemessen
 * am Siegelzeitpunkt, der in der Oberfläche «06:43» stand und im Protokoll-PDF
 * «08:43» — zwei Uhrzeiten für denselben Vorgang, und eine davon ist ein
 * Nachweiselement.
 *
 * Für einen Fliesstext gibt es `zeitpunktLang`; hier geht es um Tabellen und
 * Karten, wo die kurze Form hingehört.
 */
export function zeitpunktKurz(iso: string | null | undefined): string {
	if (!iso) return '—';
	/*
	 * `medium` und nicht `short` (04.09.2026, aus dem Code-Review): `short`
	 * liefert «25.08.26» und nimmt dem Jahr die Jahrhundertziffern. Das
	 * Protokoll-PDF druckt `medium`, und der Siegelzeitpunkt stünde sonst in
	 * Oberfläche und Nachweis wieder verschieden da — genau der Fehler, gegen den
	 * diese Funktion gebaut ist, nur an einer anderen Stelle.
	 */
	return new Date(iso).toLocaleString('de-CH', {
		timeZone: 'Europe/Zurich',
		dateStyle: 'medium',
		timeStyle: 'short'
	});
}

/**
 * Nur der Tag eines Zeitpunkts, in Schweizer Zeit — «25.08.2026».
 *
 * Dieselbe Falle wie bei `zeitpunktKurz`, und beim blossen Datum hat sie eine
 * eigene Schärfe: Ein Zeitstempel kurz vor Mitternacht steht ohne Zone einen
 * Tag früher da, und ein Datum ist genau die Angabe, bei der niemand nachrechnet.
 */
export function datumKurz(iso: string | null | undefined): string {
	if (!iso) return '—';
	/*
	 * Die Stellen ausgeschrieben (04.09.2026, aus dem Code-Review): Ohne sie
	 * liefert `de-CH` «25.8.2026», und daneben stehen in denselben Tabellen
	 * Spalten mit «05.01.2026». Der Kommentar zu `suchtextPaket` auf der
	 * Betreiberseite hält diese Uneinheitlichkeit ausdrücklich als Fehler fest.
	 */
	return new Date(iso).toLocaleDateString('de-CH', {
		timeZone: 'Europe/Zurich',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
}

/**
 * Der **Kalendertag** eines Zeitpunkts, in Schweizer Zeit — «2026-08-25».
 *
 * **Warum nicht `iso.slice(0, 10)`** (25.08.2026, aus dem Code-Review). Ein
 * Zeitstempel aus der Datenbank kommt als UTC zurück
 * («2026-08-25T22:14:07.000Z»). Die ersten zehn Zeichen sind dann der Tag in
 * London, nicht der hier: Wer zwischen 22:00 und 24:00 archiviert oder
 * versiegelt, liest anschliessend das Datum des Vortages. Zwei Monate im Jahr
 * verschiebt es sich um eine Stunde mehr.
 *
 * `sv-SE` liefert genau die Form «JJJJ-MM-TT», die `datumLang` erwartet.
 */
export function tagVon(iso: string): string {
	return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/**
 * Ein Wert aus einer `date`-Spalte als Kalendertag — «2026-06-01».
 *
 * **Der Unterschied zu `tagVon` daneben, und warum es beide gibt.** `tagVon`
 * rechnet einen **Zeitstempel** in hiesige Zeit um; das muss es, sonst liest
 * man nach 22 Uhr den Vortag. Eine `date`-Spalte trägt dagegen gar keine Zone:
 * Der Treiber gibt sie als Mitternacht in UTC zurück, und genau diese zehn
 * Zeichen sind der gemeinte Tag. Durch `tagVon` geschickt, verschöbe die
 * hiesige Zone sie um Stunden in einen Tag, den niemand eingetragen hat.
 *
 * Zeichenketten kommen unverändert zurück: Manche Abfragen liefern den Tag
 * bereits als Text.
 */
export function kalendertag(wert: Date | string): string {
	return typeof wert === 'string' ? wert : wert.toISOString().slice(0, 10);
}

/**
 * Gibt es diesen Kalendertag?
 *
 * **Warum das nicht dieselbe Frage ist wie «sieht er richtig aus»**
 * (Code-Review 02.09.2026). An fünfzehn Stellen stand
 * `/^\d{4}-\d{2}-\d{2}$/` und prüfte allein die Gestalt. `2026-02-31` und
 * `2026-13-01` kamen damit durch, gingen unverändert in eine Abfrage, und
 * PostgreSQL antwortete mit `22008 date/time field value out of range` — beim
 * Benutzer als rohe 500. Auf dem Übernahmeweg kostete das die soeben
 * hochgeladene Tabelle.
 *
 * Genau das wollten die Prüfungen verhindern; mehrere sagen es in ihrem
 * Kommentar sogar ausdrücklich.
 *
 * **Die Probe ist der Rückweg.** Ein Datum, das es nicht gibt, rollt beim
 * Anlegen weiter: Aus dem 31. Februar wird der 3. März. Wer die Bestandteile
 * danach zurückliest und sie nicht wiederfindet, hat seine Antwort — ohne eine
 * eigene Tabelle der Monatslängen, die Schaltjahre von Hand nachbilden müsste.
 */
export function istKalendertag(wert: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
	const [jahr, monat, tag] = wert.split('-').map(Number);
	const probe = new Date(Date.UTC(jahr, monat - 1, tag));
	return (
		probe.getUTCFullYear() === jahr &&
		probe.getUTCMonth() === monat - 1 &&
		probe.getUTCDate() === tag
	);
}

/**
 * Ein **zonenloser** Zeitpunkt aus einem Siegelmanifest, «04.10.2026, 21:30».
 *
 * **Abgeschnitten, nicht umgerechnet** (UI-Durchgang 06.10.2026; dieselbe Regel
 * wie in der Historie seit `02ccb9e`). Das Manifest trägt den Zeitpunkt schon
 * in Schweizer Zeit und ohne Zone («2026-10-04 21:30:00», geschrieben mit
 * `toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' })`). Durch `tagVon`
 * oder `Date` geschickt, läse die Zone des Servers ihn als ihre eigene und
 * verschöbe ihn. `unknown` und `String()`, weil ein eingespieltes Paket nur
 * gecastet und nicht nach Form geprüft ist; was nicht genau diese Form hat,
 * kommt unverändert zurück.
 */
export function manifestzeitpunkt(wert: unknown): string {
	const s = String(wert ?? '');
	/*
	 * Nur die zonenlose Form «JJJJ-MM-TT» oder «JJJJ-MM-TT hh:mm…» mit
	 * Leerzeichen. Ein ISO-Wert mit «T» (etwa `geschlossenAm`, das als UTC im
	 * selben Manifest steht) ist ein echter Zeitpunkt in UTC und gehört nach
	 * `zeitpunktKurz`; abgeschnitten stünde er ein bis zwei Stunden zu früh da
	 * (Code-Review 06.10.2026). Er kommt deshalb unverändert zurück.
	 */
	const form = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2})(?::\d{2})?)?$/.exec(s);
	if (!form) return s;
	const [, jahr, monat, tag, zeit] = form;
	return zeit ? `${tag}.${monat}.${jahr}, ${zeit}` : `${tag}.${monat}.${jahr}`;
}
