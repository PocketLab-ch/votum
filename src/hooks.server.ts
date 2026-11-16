import { randomUUID } from 'node:crypto';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { SITZUNGS_COOKIE, sitzungAufloesen } from '$lib/server/auth';
import { VERWALTUNG_VORBEHALTEN, darfStammdatenAendern, verlangtVerwaltung } from '$lib/domain/rollen';
import { istOffenerPfad } from '$lib/domain/oeffentlich';
import { adresseAusKopfzeile } from '$lib/domain/anmeldeschutz';
import { EINGABE_MIT_NUL, enthaeltNul } from '$lib/domain/steuerzeichen';
import { absageantwort, anmeldeantwort, antwortform } from '$lib/server/absageantwort';
import { sperreNulImRumpf } from '$lib/server/nulsperre';
import { beschriftet } from '$lib/server/sicherheitskopfzeilen';
import { starteZeitgeber } from '$lib/server/zeitgeber';

/*
 * **Der einzige Vorgang ohne Anfrage** (01.09.2026). `hooks.server.ts` wird beim
 * Hochfahren des Dienstes einmal ausgewertet — das ist die Stelle, an der ein
 * Zeitgeber anfängt. Was er tut und warum er kein Aufräumjob ist, steht in
 * `$lib/server/zeitgeber`.
 */
starteZeitgeber();

/**
 * Ein Wächter je Anfrage statt verteilter Prüfungen in Komponenten.
 *
 * Geschützt ist alles ausser den ausdrücklich offenen Pfaden. Das ist die
 * sichere Richtung: Wer eine neue Seite anlegt und nichts weiter tut, hat sie
 * geschützt und nicht versehentlich offen.
 */
/**
 * `/z` ist der Zugang des Eigentümers und muss offen sein: Wer seine Karte
 * scannt, ist nicht angemeldet und soll es auch nicht werden müssen. Der Schutz
 * liegt dort nicht am Wächter, sondern am Code selbst — 97 Bit Zufall, nur als
 * Prüfwert gespeichert, mit dem Schliessen der Versammlung wertlos. Die Seite
 * zeigt ausschliesslich die eigenen Angaben und keine Inhalte der Versammlung,
 * bis die Sitzungsleitung bestätigt hat.
 *
 * `/e` ist der Einstieg über den QR-Code auf der Leinwand. Er ist für alle
 * derselbe und deshalb kein Zugangsmerkmal: Er führt zu einem Formular, nicht in
 * die Versammlung, und erzeugt nie eine Stimmberechtigung ohne ausdrückliche
 * Freigabe.
 */
// `/p` ist die Präsentationssicht: Sie läuft auf dem Beamer-Gerät, das sich
// nicht anmeldet. Ihr Zugang hängt am versammlungsgebundenen Anzeigecode.
//
// **Die Liste steht in der Domäne** (`domain/oeffentlich.ts`), weil auch das
// Gerüst sie braucht: Was ohne Anmeldung erreichbar ist, trägt keinen Knopf
// zur Sitzungsleitung. Zwei getrennte Listen liefen auseinander.

/**
 * Die Herkunft einer Anfrage — oder `null`, wenn ihr nicht zu trauen ist.
 *
 * **Der Punkt, an dem eine Herkunftssperre steht und fällt.** Steht die
 * Anwendung hinter einem Reverse Proxy, ist die Adresse der Verbindung die des
 * Proxys; eine Sperre darauf träfe alle Nutzer zugleich. Nimmt man stattdessen
 * `x-forwarded-for` ungeprüft, ist die Sperre wertlos — die Zeile darf jeder
 * selbst setzen, und ein Angreifer wechselt seine Adresse mit jedem Versuch.
 *
 * Deshalb wird die Zeile **nur** ausgewertet, wenn der Betrieb sie ausdrücklich
 * benennt (`VERSAMMLUNG_ADRESSKOPFZEILE`, im Regelfall `x-forwarded-for`). Ohne
 * Angabe gilt die Adresse der Verbindung, richtig für den Direktbetrieb im
 * Saal. Ist die Anwendung hinter einem Proxy und die Zeile **nicht** gesetzt,
 * ist das die Adresse des Proxys, und die Sperre zählt alle Aufrufer als einen.
 * Hinter einem Proxy gehört die Zeile deshalb gesetzt.
 */
function herkunft(event: Parameters<Handle>[0]['event']): string | null {
	const kopfzeile = env.VERSAMMLUNG_ADRESSKOPFZEILE?.trim();
	if (kopfzeile) {
		// Vorne steht, was der Aufrufer selbst mitschickte; zählen darf nur, was
		// der Proxy hinten angehängt hat (A4, siehe `adresseAusKopfzeile`).
		// Ob es überhaupt eine Adresse ist, prüft `anmelden()`.
		return adresseAusKopfzeile(event.request.headers.get(kopfzeile));
	}
	try {
		const adresse = event.getClientAddress();
		return adresse || null;
	} catch {
		// Manche Umgebungen kennen keine Adresse. Dann gibt es keine.
		return null;
	}
}

/**
 * Jeder unerwartete Serverfehler hinterlässt genau eine Zeile, und zwar ohne
 * Geheimnis darin.
 *
 * **Der Anlass** (09.09.2026). Ein Durchstich blieb auf der nackten
 * Ausweichseite stehen. Die Ursache liess sich nur deshalb klären, weil das
 * Drehbuch nebenbei die Browserkonsole mitschrieb: Es war gar kein
 * Serverfehler, sondern ein Netzunterbruch beim Nachladen des Layouts
 * (`net::ERR_NETWORK_CHANGED`).
 *
 * **Was hier zuerst stand, war falsch** (aus dem Code-Review, berichtigt am
 * selben Tag): «Im Serverprotokoll stand dazu nichts.» Kit hat sehr wohl einen
 * eingebauten `handleError`, der `[status] METHODE pathname` plus Stapel
 * ausgibt (`runtime/server/utils.js`, `format_server_error`). Im Vorfall stand
 * nichts da, weil es keinen Serverfehler gab — das ist die richtige Auskunft
 * und nicht das Fehlen eines Hakens.
 *
 * **Der eigentliche Grund ist ein Leck, kein Komfort.** Der eingebaute Logger
 * schreibt `event.url.pathname`. Ein unerwarteter Wurf in `/z/[code]` oder
 * `/p/[code]` schrieb damit den Zugangscode eines Eigentümers oder den
 * Anzeigecode der Leinwand ins Containerprotokoll. `event.route.id` ist das
 * Muster (`/z/[code]`) und trägt nie einen Wert — dieselbe Überlegung wie bei
 * `referrer-policy: same-origin` in `src/lib/server/sicherheitskopfzeilen.ts`.
 *
 * **Zwei Belege, die hier zuerst standen, tragen nicht** (aus dem Review der
 * berichtigten Fassung). Beim 404 war es NICHT dasselbe: `/z/[code]` matcht
 * jede Eingabe und endet immer in einer Umleitung, dort entsteht gar kein 404;
 * und `/b/[marke]` erzeugt seinen 404 über `error(404, …)`, also einen
 * `HttpError`, den auch der eingebaute Logger nie zu sehen bekam.
 *
 * **Die Kennung verbindet Seite und Protokoll.** Sie steht in der Meldung im
 * Browser und in der Zeile im Protokoll. Wer eine weisse Seite meldet, kann acht
 * Zeichen vorlesen; ohne sie ist «bei mir kam ein Fehler» nicht auffindbar.
 *
 * **Was NICHT hier ankommt** (nachgesehen, nicht vermutet): alles aus
 * `error(...)`. Ein `HttpError` kehrt in `handle_error_and_jsonify` zurück,
 * bevor dieser Haken gerufen wird. Die beiden Wächter unten werfen ohnehin
 * nicht, sie antworten. 401 und 403 sind hier also nie zu sehen, und ein
 * Kommentar, der sie als «bewusst stumm» führte, beschrieb einen Fall, den es
 * nicht gibt.
 *
 * Übrig bleiben `SvelteKitError` und echte Ausnahmen. Sie bekommen deshalb alle
 * eine Zeile: 405 ohne Formularaktion, 415 mit falscher Inhaltsart, 413 bei zu
 * grossem Anhang. Ohne sie hinterliesse ausgerechnet ein abgewiesener Upload
 * weder auf der Seite noch im Protokoll eine Spur.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const wann = new Date().toISOString();
	const wo = event.route.id ?? '(ohne Route)';

	/*
	 * **Stumm bleibt nur der 404 OHNE Route**, und das ist keine Bequemlichkeit:
	 * Wenn gar keine Route passte, wäre der Pfad das Einzige, was die Zeile
	 * brauchbar machen würde, und genau der darf hier nicht hin. Eine Zeile «404
	 * (ohne Route)» je Scanner-Anfrage ist Rauschen ohne Auskunft.
	 *
	 * **Hier stand zuerst `status === 404`, und das war zu grob** (aus dem
	 * Review der berichtigten Fassung, danach am laufenden Dev nachgemessen).
	 * Es gibt 404 MIT Route: `call_action` wirft «No action with name … found»
	 * als `SvelteKitError`, wenn ein POST auf `?/<aktion>` einen Namen nennt,
	 * den es nicht mehr gibt — ein umbenanntes Formular, ein alter offener
	 * Reiter. Genau dort ist die Zeile wertvoll und leckfrei, denn sie trägt
	 * Route und Methode und keinen Pfad. Gemessen: Ein POST auf
	 * `/anmelden?/gibtesnicht` hinterliess mit der groben Fassung nichts.
	 */
	if (status === 404 && event.route.id === null) return { message };

	if (status !== 500) {
		// Kurzzeile ohne Stapel: Diese Fälle sind Absagen an eine Anfrage und
		// keine Störung im Haus. Sichtbar müssen sie trotzdem sein.
		console.error(`[${status}] ${wann} ${event.request.method} ${wo}`);
		return { message };
	}

	const kennung = randomUUID().slice(0, 8);
	console.error(`[500 ${kennung}] ${wann} ${event.request.method} ${wo}`);
	// Der Stapel und nicht nur die Meldung: Ohne ihn steht da, DASS etwas
	// scheiterte, und nicht, wo. Er trägt kein Geheimnis: postgres.js hängt
	// Abfrage und Werte als nicht aufzählbare Felder an, nicht an `stack`.
	console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));

	// Nach aussen nur die Kennung. Was schiefging, steht im Protokoll und nicht
	// auf einer Seite, die im Saal an der Wand hängen kann.
	return { message: `Unerwarteter Fehler (${kennung})` };
};

export const handle: Handle = async ({ event, resolve }) => {
	// Ein NUL-Zeichen sagt am Eingang ab, vor jeder Abfrage
	// (`domain/steuerzeichen.ts`): in Suchteil und Pfad gleich hier, im Rumpf
	// beim Lesen. Die Pfadwerte, weil SvelteKit sie dekodiert und etwa
	// `/anhang/[pruefsumme]` sie ungeprüft abfragt (Codeprüfung, 27.10.2026).
	if (enthaeltNul([...event.url.searchParams]) || enthaeltNul(Object.values(event.params))) {
		// Eine Datenanfrage (`__data.json`, etwa die Suche auf `/verlauf`) liest
		// ihre Meldung nur als JSON-Zeichenkette; aus HTML machte der Client
		// «Error: 400» ohne Satz (`load_data` in `@sveltejs/kit`).
		const antwort = event.isDataRequest
			? new Response(JSON.stringify(EINGABE_MIT_NUL), {
					status: 400,
					headers: { 'content-type': 'application/json' }
				})
			: absageantwort(EINGABE_MIT_NUL, antwortform(event.request.headers), 400);
		return beschriftet(antwort, event.url);
	}
	sperreNulImRumpf(event.request);

	const merkmal = event.cookies.get(SITZUNGS_COOKIE);
	event.locals.benutzer = await sitzungAufloesen(merkmal);
	// Für die Herkunftssperre der Anmeldung. Steht hier und nicht in der Route,
	// weil die Bewertung «vertrauenswürdig oder nicht» eine Betriebsfrage ist.
	event.locals.herkunft = herkunft(event);

	const pfad = event.url.pathname;
	const istOffen = istOffenerPfad(pfad);

	/*
	 * **Der Wächter wirft nicht, er antwortet** (Abnahme 08.08.2026).
	 *
	 * Vorher standen hier `redirect()` und `error()`. Beide werfen, und SvelteKit
	 * baut die Antwort daraus **oberhalb** aller Haken zusammen — die Kopfzeilen
	 * unten sahen sie deshalb nie. Ausgerechnet die Absage war eine vollständige
	 * HTML-Seite ohne `frame-ancestors`, also genau die Gattung, die die Regel
	 * schützen soll. Wer selbst antwortet, kann selbst beschriften.
	 */
	if (!istOffen && !event.locals.benutzer) {
		// Ziel merken, damit die Anmeldung dorthin zurückführt.
		const ziel = pfad === '/' ? '' : `?weiter=${encodeURIComponent(pfad)}`;
		return beschriftet(
			anmeldeantwort(`/anmelden${ziel}`, antwortform(event.request.headers)),
			event.url
		);
	}

	/*
	 * Zweiter Wächter: angemeldet heisst nicht befugt. Die Rollen standen bis
	 * zum 04.08.2026 unbenutzt in der Datenbank — wer ein Konto hatte, konnte
	 * Wertquoten ändern. Siehe `$lib/domain/rollen`.
	 *
	 * **Geprüft werden die aufgelöste Route UND der rohe Pfad** (Sicherheits-
	 * durchgang 15.09.2026, am laufenden Stand nachgemessen).
	 *
	 * Bis dahin stand hier allein `event.url.pathname` — der **rohe** Pfad. Die
	 * Route löst SvelteKit aber über den **dekodierten** auf
	 * (`decode_pathname` in `runtime/server/respond.js`), und die beiden sahen
	 * verschiedene Dinge. Gemessen mit einem Konto der Rolle `chair`:
	 *
	 * | Pfad | vorher |
	 * |---|---|
	 * | `POST /gemeinschaften` | 403, gesperrt |
	 * | `POST /%67emeinschaften` | **Aktion lief** |
	 *
	 * `%67` ist ein `g`. Ein einziges kodiertes Zeichen hob die ganze
	 * Rollentrennung auf — für jeden Schreibweg unter `/gemeinschaften`,
	 * `/betreiber` und `/personen`. Die Mandantengrenze war nie betroffen, die
	 * hängt am Zeilenschutz der Datenbank und nicht am Pfad.
	 *
	 * **Warum beide und nicht nur `route.id`.** Die Route ist der richtige
	 * Anker, weil sie normalisiert ist und sich nicht kodieren lässt. Aber sie
	 * ist `null`, wo keine Route greift, und eine Prüfung, die dann nichts mehr
	 * findet, wäre in der falschen Richtung nachgiebig. Zwei Anker, und **einer**
	 * genügt zum Sperren: Das ist die Richtung, in der ein Irrtum nichts öffnet.
	 */
	const wege = [event.route?.id, pfad].filter((w): w is string => Boolean(w));
	if (
		event.locals.benutzer &&
		wege.some((w) => verlangtVerwaltung(w, event.request.method)) &&
		!darfStammdatenAendern(event.locals.benutzer.role)
	) {
		return beschriftet(
			absageantwort(VERWALTUNG_VORBEHALTEN, antwortform(event.request.headers)),
			event.url
		);
	}

	return beschriftet(await resolve(event), event.url);
};
