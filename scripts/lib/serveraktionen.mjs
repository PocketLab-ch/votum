/**
 * Serverseiten in ihre Aktionen zerlegen — einmal, für mehrere Wächter.
 *
 * **Warum das hier steht und nicht zweimal abgeschrieben.** Der Zerleger hat
 * beim Bau von `check-kennungen.mjs` zweimal denselben Fehler gemacht: Eine
 * Aktion zog den Rumpf ihrer Vorgängerin mit hinein (vier Befunde an Aktionen,
 * die das Feld gar nicht lesen), und beim Nachziehen der Endpunkte stand er
 * andersherum wieder da — ein `POST` erbte die Prüfungen des `GET` darüber und
 * ging grün durch, obwohl er nichts prüfte. Beides fand ein Code-Review, nicht
 * der Wächter. Ein zweiter Wächter mit einer zweiten Abschrift bekäme dieselben
 * Fehler noch einmal, nur zeitversetzt.
 *
 * **Was er kann und was nicht.** Er liest Text, keinen Datenfluss. Tote Zweige,
 * die Reihenfolge (läuft die Prüfung vor dem Schreiben?) und Umwege über
 * mehrere Zwischengrössen sieht er nicht. Das ist keine Nachlässigkeit, sondern
 * die Grenze der Bauart, und deshalb steht im Ablauf dieses Repos ein
 * `/code-review` **und** ein `/security-review` vor jedem Commit.
 *
 * Benutzt von `scripts/check-kennungen.mjs` und
 * `scripts/check-abendbindung.mjs`. Gemessen wird der Zerleger über die
 * Gegentests der beiden.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Serverseiten **und** Endpunkte unter einem Baum einsammeln.
 *
 * `+server.ts` gehörte in der ersten Fassung nicht dazu, und das war eine
 * Lücke: Ein Endpunkt unter demselben Baum nimmt dieselben Kennungen entgegen.
 *
 * Ein fehlendes Verzeichnis bricht den Lauf **nicht** mit einem nackten
 * `ENOENT` ab (04.09.2026, gemessen über einem leeren Baum). Rot war er damit
 * aus Versehen. Das leere Feld reicht die Entscheidung an die Reissleine
 * weiter, die sagen kann, was fehlt.
 */
export function serverdateien(verzeichnis) {
	const raus = [];
	let eintraege;
	try {
		eintraege = readdirSync(verzeichnis);
	} catch {
		return raus;
	}
	for (const eintrag of eintraege) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) raus.push(...serverdateien(pfad));
		else if (eintrag === '+page.server.ts' || eintrag === '+server.ts') raus.push(pfad);
	}
	return raus;
}

/** Blockkommentare und Zeilenkommentare weg — sonst zählt ein Beispiel mit. */
export function ohneKommentare(text) {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Die begründeten Ausnahmen einer Aktion: `<marke>: <feld> — <Begründung>`.
 *
 * Die Marke gibt der Wächter vor (`kennung`, `abend`), damit die Ausnahme eines
 * Wächters nicht stillschweigend die eines anderen aufhebt. Ohne Begründung von
 * mindestens zehn Zeichen zählt sie nicht: Eine Liste unbegründeter Ausnahmen
 * wächst, bis sie den Wächter aufhebt.
 */
export function ausnahmen(roh, marke) {
	const raus = new Set();
	const muster = new RegExp(`${marke}:\\s*([A-Za-zäöü.]+)\\s*[—–-]\\s*(\\S[^\\n]*)`, 'g');
	for (const t of roh.matchAll(muster)) {
		if (t[2].trim().length >= 10) raus.add(t[1]);
	}
	return raus;
}

/** Wo der Körper der vorigen Aktion endet: die letzte Zeile, die nur `}` trägt. */
const ABSCHLUSS = /\n\t\}\s*,?[ \t]*\n/g;
/** Dasselbe für einen Endpunkt: `};` ohne Einrückung. */
const ABSCHLUSS_ENDPUNKT = /\n\};?[ \t]*\n/g;

/**
 * Schneidet einen Abschnitt so zu, dass der Kommentar davor mitkommt, der
 * **Rumpf des Vorgängers aber nicht**.
 *
 * **Zweimal derselbe Fehler, zweimal gemessen.** Beim ersten Lauf zog jede
 * Aktion den Rumpf ihrer Vorgängerin mit hinein, und deren Felder zählten noch
 * einmal (vier Befunde an Aktionen, die das Feld gar nicht lesen). Beim
 * Nachziehen der Endpunkte stand derselbe Fehler in der neuen Zeile — diesmal
 * andersherum: Ein `POST` erbte die Prüfungen des `GET` darüber und ging grün
 * durch, obwohl er nichts prüfte (26.08.2026, aus dem Code-Review). Deshalb
 * jetzt an **einer** Stelle.
 */
function abschnitt(roh, vonKopf, bisKopf, abschluss) {
	// Ohne Treffer gehört der ganze Zwischenraum dazu — anders als beim Rumpf
	// unten, wo dann `bis` gilt. Beide Rückfälle sind «so viel wie möglich»,
	// und weil sie an entgegengesetzten Enden schneiden, sind sie verschieden.
	return roh.slice(hinterLetztemAbschluss(roh, vonKopf, bisKopf, abschluss) ?? vonKopf, bisKopf);
}

/**
 * Wo der Rumpf einer Aktion aufhört: hinter ihrer eigenen schliessenden Zeile.
 *
 * **Der Anlass** (Code-Review 08.09.2026, beim Herauslösen dieser Bibliothek).
 * Der Rumpf reichte bis zum **nächsten Kopf** und zog damit den Kommentar der
 * *nächsten* Aktion mit hinein. Eine Ausnahmezeile entlastete so zwei Aktionen:
 * die, für die sie geschrieben war, und die davor. Gemessen an
 * `tage/[id=kennung]/leitung`: Der Block `abend: versammlung` vor
 * `abschliessen` deckte auch `saalAblehnen`, und der vor `vertagen` auch
 * `schliessen`. Beide hatten zufällig eine echte Schranke — der Wächter hätte
 * es also nicht gemeldet, wenn sie eine verloren hätten.
 *
 * Das ist die dritte Fassung derselben Grenze; die beiden früheren Fehler
 * stehen bei `abschnitt`. Deshalb rechnen jetzt beide Seiten mit **derselben**
 * Stelle.
 */
function hinterLetztemAbschluss(roh, von, bis, abschluss) {
	let stelle = null;
	for (const ende of roh.slice(von, bis).matchAll(abschluss)) {
		stelle = von + ende.index + ende[0].length;
	}
	/*
	 * **Ohne Treffer gilt der ganze Bereich** (Code-Review 08.09.2026, zweiter
	 * Durchgang). Die erste Fassung gab hier `von` zurück, und der Rumpf wurde
	 * leer: Ein Endpunkt, hinter dessen `};` noch etwas steht, verschwand
	 * lautlos aus der Prüfmenge. Gemessen an elf gleichen `+server.ts`, von
	 * denen eines `}; // Randbemerkung` trug — der Wächter meldete zehn.
	 *
	 * Zu viel zu lesen kann eine fremde Ausnahmezeile mitnehmen; gar nichts zu
	 * lesen übersieht **alles**. Von den beiden Fehlern ist dieser der
	 * harmlosere, und er ist der einzige, der auffällt.
	 *
	 * **Gibt `null` zurück, wenn es keinen Treffer gibt**, statt selbst einen
	 * Rückfall zu wählen: Die beiden Aufrufer schneiden an entgegengesetzten
	 * Enden und brauchen entgegengesetzte Rückfälle. Ein gemeinsamer war der
	 * erste Anlauf und machte den Vorlauf jeder ersten Aktion leer — die
	 * Ausnahmezeilen verschwanden, der Wächter wurde rot.
	 */
	return stelle;
}

/**
 * Von einem Vorlauf nur den Kommentar behalten, der unmittelbar vor dem Kopf
 * steht.
 *
 * **Der Anlass** (Code-Review 08.09.2026, zweiter Durchgang). Für die **erste**
 * Aktion einer Datei begann der Vorlauf bei 0 — der ganze Dateikopf mitsamt
 * Hilfsfunktionen gehörte zu ihrem Text. Eine Schranke in einer nie aufgerufenen
 * Hilfsfunktion band sie damit scheinbar, und eine Ausnahmezeile irgendwo oben
 * entlastete sie. Der Zerleger sagt «je Aktion» zu; dann muss der Vorlauf auch
 * einer sein.
 */
function nurKommentarSchwanz(text) {
	const zeilen = text.split('\n');
	let ab = zeilen.length;
	for (let i = zeilen.length - 1; i >= 0; i -= 1) {
		const z = zeilen[i].trim();
		if (z === '' || z.startsWith('//') || z.startsWith('*') || z.startsWith('/*')) {
			ab = i;
			continue;
		}
		// Eine Zeile, die einen Blockkommentar abschliesst, gehört noch dazu;
		// alles davor gehört zum Rumpf davor.
		if (z.endsWith('*/')) ab = i;
		break;
	}
	return zeilen.slice(ab).join('\n');
}

/**
 * Zerlegt eine Datei in ihre Aktionen.
 *
 * Gesucht wird die Zeile `\t<name>: async (`. Zum Körper gehört alles bis zur
 * nächsten solchen Zeile — mitsamt dem Kommentar, der davor steht, denn dort
 * dürfen die Ausnahmen stehen.
 *
 * **Ein Endpunkt ist eine Aktion mit anderem Kopf.** `export const GET:
 * RequestHandler = …` hat keine Einrückung und keinen Doppelpunkt nach dem
 * Namen; ohne diese Zeile blieb `+server.ts` unsichtbar, obwohl die Datei
 * gelesen wurde.
 *
 * **Und was zwischen den Aktionen steht, geht nicht verloren.** Zwei Seiten im
 * Repo bauen ihre Handlungen über eine Fabrik: `vorlegen: handlung(…)`, und der
 * Rumpf mit dem Formular steht als gewöhnliche Funktion daneben. Für den
 * Zerleger hatten sie **null Aktionen** — der Wächter zählte die Seite mit und
 * las darin nichts (Code-Review 08.09.2026, gemessen an
 * `tage/[id=kennung]/vollmachten`). Das ist die schlimmste Art, einen Wächter
 * zu verlieren, weil sie wie Erfolg aussieht.
 *
 * Deshalb kommt alles, was keiner Aktion zugeschlagen wurde, als ein letzter
 * Abschnitt `(ausserhalb der Aktionen)` mit — aber nur, wenn dort überhaupt ein
 * Formular gelesen wird. Sonst stünde in jeder Meldung eine Aktion, die keine
 * ist.
 */
export function aktionen(roh) {
	const endpunkte = [...roh.matchAll(/^export const (GET|POST|PUT|PATCH|DELETE)\b/gm)];
	if (endpunkte.length > 0) {
		return endpunkte.map((kopf, i) => {
			const bis = i + 1 < endpunkte.length ? endpunkte[i + 1].index : roh.length;
			const vorlauf = nurKommentarSchwanz(
				abschnitt(roh, i === 0 ? 0 : endpunkte[i - 1].index, kopf.index, ABSCHLUSS_ENDPUNKT)
			);
			const ende = hinterLetztemAbschluss(roh, kopf.index, bis, ABSCHLUSS_ENDPUNKT) ?? bis;
			return { name: kopf[1], roh: vorlauf + roh.slice(kopf.index, ende) };
		});
	}

	const koepfe = [...roh.matchAll(/^\t([A-Za-zäöüÄÖÜ_$][\w$]*)\s*:\s*async\s*\(/gm)];
	const abgedeckt = [];
	const raus = koepfe.map((kopf, i) => {
		const bis = i + 1 < koepfe.length ? koepfe[i + 1].index : roh.length;
		const vorlauf = nurKommentarSchwanz(
			abschnitt(roh, i === 0 ? 0 : koepfe[i - 1].index, kopf.index, ABSCHLUSS)
		);
		const ende = hinterLetztemAbschluss(roh, kopf.index, bis, ABSCHLUSS) ?? bis;
		abgedeckt.push([kopf.index, ende]);
		return { name: kopf[1], roh: vorlauf + roh.slice(kopf.index, ende) };
	});

	for (const teil of ausserhalbJeFunktion(roh, abgedeckt)) raus.push(teil);
	return raus;
}

/**
 * Was neben den Aktionen steht, **je Funktion einzeln**.
 *
 * **Warum nicht in einem Stück** (Code-Review 08.09.2026, zweiter Durchgang).
 * Die erste Fassung gab den ganzen Resttext als eine Pseudo-Aktion heraus. Auf
 * einer Seite mit zwei Fabriken deckte damit die gebundene die ungebundene mit
 * ab: Irgendwo im Text stand eine Schranke mit `params.id`, und der Wächter war
 * zufrieden. Dasselbe galt für Ausnahmezeilen. Der Sammelabschnitt hätte damit
 * genau die Blindstelle wieder aufgemacht, gegen die er gebaut wurde.
 *
 * Geschnitten wird an den Köpfen der Funktionen auf oberster Ebene; der Text
 * davor bildet einen eigenen Abschnitt. Herausgegeben wird nur, worin ein
 * Formular gelesen wird — sonst stünde in jeder Meldung eine Aktion, die keine
 * ist.
 */
function ausserhalbJeFunktion(roh, abgedeckt) {
	const rest = ausserhalb(roh, abgedeckt);
	const koepfe = [...rest.matchAll(/^(?:export )?(?:async )?function ([\w$]+)\s*\(/gm)];
	const stuecke =
		koepfe.length === 0
			? [{ name: '(ausserhalb der Aktionen)', roh: rest }]
			: [
					{ name: '(ausserhalb der Aktionen)', roh: rest.slice(0, koepfe[0].index) },
					...koepfe.map((kopf, i) => ({
						name: `(ausserhalb der Aktionen: ${kopf[1]})`,
						roh: rest.slice(kopf.index, i + 1 < koepfe.length ? koepfe[i + 1].index : rest.length)
					}))
				];
	return stuecke.filter((t) => /daten\.get(?:All)?\(/.test(t.roh));
}

/** Was von der Datei übrig bleibt, wenn man die Rümpfe der Aktionen herausnimmt. */
function ausserhalb(roh, abgedeckt) {
	let stelle = 0;
	const teile = [];
	for (const [von, bis] of abgedeckt) {
		if (von > stelle) teile.push(roh.slice(stelle, von));
		stelle = Math.max(stelle, bis);
	}
	teile.push(roh.slice(stelle));
	return teile.join('\n');
}
