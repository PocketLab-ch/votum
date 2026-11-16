/**
 * Die Sicherheitskopfzeilen jeder Antwort, die durch den `handle`-Haken läuft.
 *
 * **Warum ein eigenes Modul** (GP-4, 12.11.2026). Die Werte standen bis dahin
 * als zwei nicht exportierte Funktionen in `hooks.server.ts`. Ein Wächtertest
 * konnte sie deshalb nur als Quelltext lesen, nicht eine echte `Response`
 * hindurchschicken. Und gerade die Cache-Anweisung ist eine Regel über
 * Antworten, nicht über Code: Sie muss eine Antwort mit eigener Angabe stehen
 * lassen und eine ohne bekommen. Das lässt sich prüfen, wenn die Funktion
 * erreichbar ist.
 *
 * **Was hier nicht steht.** Die Inhaltssicherheitsregel setzt SvelteKit selbst;
 * sie braucht Einmalkennungen für die eigenen Skripte und steht deshalb in
 * `vite.config.ts`. Die drei Köpfe auf statischen Dateien setzt der
 * HTTP-Server (`scripts/server-einstieg.mjs`), weil der Haken diese Dateien nie
 * sieht (GP-V-3). Diese Datei gilt nur für Antworten aus dem Haken.
 */

export function beschriftet(antwort: Response, url: URL): Response {
	setzeSicherheitskopfzeilen(antwort.headers, url);
	return antwort;
}

/**
 * Sicherheitskopfzeilen an jede Antwort (Audit B-12 und B-14, 08.08.2026).
 *
 * **Sie gehören in die Anwendung, auch wenn der Umkehrproxy welche setzt.** Der
 * Betrieb auf einem Notebook im Versammlungsraum ohne Proxy ist ausdrücklich
 * vorgesehen (AD-9, AD-18) — genau dort wäre sonst nichts davon da.
 */
export function setzeSicherheitskopfzeilen(kopf: Headers, url: URL): void {
	/*
	 * **Nichts aus dem Zwischenspeicher** (GP-4/B2, Pentest vor E5 am
	 * 11.11.2026; Produktentscheid 12.11.2026). Eine Seite mit Personendaten
	 * darf nach dem Abmelden weder über «Zurück» noch über den Browser eines
	 * anderen im Saal wieder erscheinen. `private, no-store`: nicht in Proxys
	 * ablegen, nicht auf der Platte halten. Anmeldeseite, gerenderte Seiten und
	 * die Umleitung des Wächters tragen bisher gar keine Angabe.
	 *
	 * **Nur wenn die Antwort keine eigene trägt.** Mehrere Wege setzen ihren
	 * Wert selbst und meinen ihn genauer als diese Vorgabe: die meisten PDF,
	 * DOCX, ODT, XLSX und ZIP mit `no-store` oder `private, no-store`; der
	 * Zeitstempel mit `private, max-age=31536000, immutable`, weil er keine
	 * Personendaten enthält; die Ströme mit `no-store`. Anhang und
	 * Abschlusspaket tragen seit FP-2 (Produktentscheid 12.11.2026) ebenfalls
	 * `private, no-store`; beide können Personendaten enthalten. Ein `set`
	 * überschriebe sie; `has` lässt sie stehen. Wer keine eigene setzt (etwa
	 * `weisungsblatt.pdf` und die Protokollfassungen), bekommt diese. Die
	 * Datenantworten von SvelteKit (`__data.json`) bringen `private, no-store`
	 * bereits selbst mit.
	 */
	if (!kopf.has('cache-control')) {
		kopf.set('cache-control', 'private, no-store');
	}

	// Zweite Schranke neben der Inhaltssicherheitsregel: `frame-ancestors` deckt
	// den Fall ab, diese Zeile die älteren Browser.
	kopf.set('x-frame-options', 'DENY');

	/*
	 * **Der Punkt, an dem die Anhangsauslieferung hängt.** Die ausgelieferte
	 * Inhaltsart stammt aus einer Erkennung an den Magic Bytes gegen eine
	 * Zulassungsliste von vier Formaten — aber ohne diese Zeile dürfte der
	 * Browser trotzdem raten und einen Anhang als etwas anderes behandeln, als
	 * er angemeldet ist.
	 */
	kopf.set('x-content-type-options', 'nosniff');

	/*
	 * Der Zugangscode steht im Pfad von `/z/<code>`. Ohne diese Zeile stünde er
	 * bei jedem Sprung nach draussen in der Herkunftsangabe — und damit im
	 * Zugriffsprotokoll eines fremden Hauses. Das ist der Grund für diese Zeile,
	 * und er gilt unverändert.
	 *
	 * **`same-origin` statt `no-referrer`** (11.09.2026, am gebauten Stand
	 * gemessen). Am 08.08.2026 stand hier die Begründung, die strengere Fassung
	 * «koste nichts». Sie kostet etwas, und zwar alles, was ohne JavaScript
	 * abgeschickt wird:
	 *
	 * Chromium leitet den `Origin`-Kopf eines Formularversands aus der
	 * Herkunftsregel ab. Bei `no-referrer` schickt er `Origin: null` — auch bei
	 * einem Formular, das auf **dieselbe** Adresse zeigt. SvelteKits Schutz gegen
	 * fremde Formulare vergleicht `Origin` mit der eigenen Herkunft und weist mit
	 * 403 ab: «Cross-site POST form submissions are forbidden», als nackter Text,
	 * ohne Seite darum.
	 *
	 * **Und das fiel nie auf, weil der Schutz nur im Betrieb läuft.** In
	 * `@sveltejs/kit/src/runtime/server/respond.js` steht er hinter
	 * `if (!__SVELTEKIT_DEV__)`. Auf dem Entwicklungsserver ging also alles, auf
	 * dem gebauten Stand nichts — gemessen am 11.09.2026: derselbe Browser,
	 * dasselbe Formular, Dev 303 und angemeldet, Betrieb 403.
	 *
	 * Betroffen ist jedes Formular, das nicht von Svelte abgeschickt wird: vor
	 * der Hydration (im Saal auf einem fremden Telefon der Normalfall, und auf
	 * dem Notebook im Versammlungsraum der erste Klick nach dem Start) und
	 * überall dort, wo jemand ohne JavaScript arbeitet. Die Anwendung ist darauf
	 * ausgelegt — `Rueckfrage`, `Meldung` und die Ausklapper haben alle einen Weg
	 * ohne Skript. Der lief auf dem gebauten Stand ins Leere.
	 *
	 * `same-origin` hält, wofür diese Zeile da ist: Nach **draussen** geht keine
	 * Herkunftsangabe, der Zugangscode bleibt im Haus. Innerhalb der Anwendung
	 * wird sie weitergegeben, und genau daraus bildet der Browser den
	 * `Origin`-Kopf, den der Schutz sehen will. Gemessen: `Origin:
	 * http://…:3399`, POST 401 statt 403 — die Anfrage kam an und wurde fachlich
	 * beantwortet.
	 */
	kopf.set('referrer-policy', 'same-origin');

	/*
	 * **Die Kamera ist seit dem 20.08.2026 offen — für die eigene Herkunft.**
	 *
	 * Der Kartenscanner am Eingang liest den QR-Code der Zugangskarte mit der
	 * Kamera des Geräts. Ohne `camera=(self)` verweigert der Browser sie, und
	 * zwar stumm bis auf eine Zeile in der Entwicklerkonsole («Permissions
	 * policy violation») — beim ersten Anlauf genau so aufgelaufen.
	 *
	 * `(self)` und nicht `*`: Ein eingebetteter fremder Rahmen bekommt nichts.
	 * Mikrofon, Standort und Bezahlung bleiben zu; wer eines davon braucht,
	 * trägt es hier ein und hat damit einmal darüber nachgedacht.
	 */
	kopf.set('permissions-policy', 'camera=(self), microphone=(), geolocation=(), payment=()');

	/*
	 * Nur über TLS, und nur wenn die Anfrage bereits so hereinkam. Im
	 * Saalbetrieb über `http://` im eigenen Netz wäre diese Zeile ein
	 * Selbstschuss: Der Browser merkt sich die Anweisung für die Adresse und
	 * verweigert danach die einzige Verbindung, die es dort gibt.
	 */
	if (url.protocol === 'https:') {
		kopf.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
	}
}
