/**
 * Den Betriebszustand erheben (Story 6.3, FR-68, AD-18).
 *
 * Die Schale zum Kern in `$lib/domain/betrieb`: Sie fragt die äusseren Dienste,
 * der Kern bewertet. Gefragt wird über die Erreichbarkeitsprüfung aus Story 4.1,
 * die ihr Ergebnis bereits zwischenspeichert — erreichbar länger als nicht
 * erreichbar, damit ein wiederkehrendes Netz rasch bemerkt wird.
 *
 * **Der Betriebszustand wird nirgends gesetzt.** `VERSAMMLUNG_OFFLINE` bleibt
 * bestehen, kennzeichnet aber nur noch die Zeitquelle im Verlauf: Eine Uhr ohne
 * Netzabgleich kann falsch gehen, und im Streitfall muss das erkennbar sein.
 * Für die Frage, was gerade zur Verfügung steht, ist sie ohne Bedeutung.
 */
import { bewerteBetrieb, type Betriebszustand, type Dienst } from '$lib/domain/betrieb';
import { ERREICHBARKEIT_ZEITLIMIT_MS } from '$lib/domain/anmeldewege';
import { istEingerichtet, pruefeErreichbarkeit } from './authentik';
import {
	istEingerichtet as immotoolEingerichtet,
	pruefeErreichbarkeit as immotoolErreichbar
} from './immotool';
import {
	istEingerichtet as mailEingerichtet,
	pruefeErreichbarkeit as mailErreichbar
} from './mail';
import { alsBetreiber, sql } from './db';
import { stufen } from './ki';
import { dienst, ersatzdienst } from './zeitstempel';

export interface Datenbanklage {
	erreichbar: boolean;
	version: string;
	migrationen: number;
}

export async function holeDatenbanklage(): Promise<Datenbanklage> {
	try {
		const [version] = await sql<{ v: string }[]>`SELECT current_setting('server_version') AS v`;
		const [anzahl] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM schema_migration`;
		return { erreichbar: true, version: version.v, migrationen: anzahl.n };
	} catch {
		// Ohne Datenbank bleibt die Startseite erreichbar und sagt, was fehlt.
		return { erreichbar: false, version: '', migrationen: 0 };
	}
}

/**
 * Fragt jeden äusseren Dienst und lässt den Kern bewerten.
 *
 * **Alle Prüfungen laufen gleichzeitig.** Jede hat ihr eigenes Zeitlimit;
 * nacheinander stünde die Seite im Saal ohne Netz mit jedem weiteren Dienst
 * länger still.
 *
 * **KI und Zeitstempel kamen am 14.08.2026 dazu.** Sie hängen an einem
 * Betreiber, deshalb der Parameter — ohne ihn (angemeldet ist niemand) bleiben
 * sie aussen vor, statt eine Meldung über einen Dienst zu machen, von dem noch
 * gar nicht feststeht, wessen er ist.
 *
 * **Geprüft wird, ob das Haus antwortet — nicht, ob der Schlüssel gilt.** Ein
 * echter Modellaufruf bei jedem Seitenaufbau kostete Geld und Sekunden; ein
 * echter Zeitstempel belastete eine fremde Stelle für nichts. Ob Schlüssel und
 * Modellname stimmen, sagt der Prüfknopf unter «Äussere Dienste», und das ist
 * die richtige Stelle dafür: Man drückt ihn, wenn man etwas geändert hat.
 */
export async function holeBetriebszustand(operatorId?: string): Promise<Betriebszustand> {
	const [authentik, immotool, mail, ki, tsa, warnungen] = await Promise.all([
		pruefeErreichbarkeit(),
		immotoolErreichbar(),
		mailErreichbar(),
		operatorId ? kiLage(operatorId) : null,
		operatorId ? zeitstempelLage(operatorId) : null,
		operatorId ? ersatzwarnungen(operatorId) : []
	]);

	const dienste: Dienst[] = [
		{
			kennung: 'authentik',
			name: 'Authentik',
			eingerichtet: istEingerichtet(),
			erreichbar: authentik === 'erreichbar',
			ohneIhn:
				'Die Anmeldung über Authentik steht nicht zur Verfügung; die lokale Anmeldung mit ' +
				'Benutzername und Kennwort funktioniert unverändert.'
		},
		{
			kennung: 'mail',
			name: 'Mailausgang',
			eingerichtet: mailEingerichtet(),
			erreichbar: mail === 'erreichbar',
			// Der Versand ist eine Option, kein Weg: Ohne ihn entstehen dieselben
			// Dateien wie bisher, und sie gehen über das eigene Mailprogramm hinaus.
			ohneIhn:
				'Einladungen lassen sich nicht aus der Anwendung verschicken. Das Versandpaket und ' +
				'die einzelnen Karten entstehen unverändert; verschicken Sie sie über Ihr ' +
				'Mailprogramm.'
		},
		{
			kennung: 'immotool',
			name: 'immotool',
			eingerichtet: immotoolEingerichtet(),
			erreichbar: immotool === 'erreichbar',
			// FR-7, dritte Konsequenz: «Ist immotool nicht erreichbar, ist
			// ausschliesslich der Import betroffen.» Genau das steht hier — und nur
			// das, damit niemand mitten in der Versammlung ein Netz reparieren geht.
			ohneIhn:
				'Stammdaten lassen sich nicht aus immotool holen. Die Übernahme aus einer ' +
				'CSV-Datei und die Erfassung von Hand funktionieren unverändert; eine laufende ' +
				'Versammlung ist nicht betroffen.'
		}
	];

	if (ki) {
		dienste.push({
			kennung: 'ki',
			name: ki.name,
			eingerichtet: ki.eingerichtet,
			erreichbar: ki.erreichbar,
			// FR-62: Kein Ablaufschritt setzt eine KI voraus. Der Satz muss das
			// sagen, sonst sucht jemand mitten in der Versammlung nach dem Netz.
			ohneIhn:
				'Vorschläge und Prüfungen der KI stehen nicht zur Verfügung. Jeder Schritt lässt ' +
				'sich von Hand gehen; eine laufende Versammlung ist nicht betroffen.'
		});
	}

	if (tsa) {
		dienste.push({
			kennung: 'zeitstempel',
			name: tsa.name,
			eingerichtet: tsa.eingerichtet,
			erreichbar: tsa.erreichbar,
			ohneIhn: tsa.mitErsatz
				? 'Abschlusspakete werden versiegelt, aber weder vom Haupt- noch vom Ersatzdienst ' +
					'bezeugt. Das Siegel gilt trotzdem; die Bezeugung lässt sich später auf der ' +
					'Siegelseite nachholen.'
				: 'Abschlusspakete werden versiegelt, aber nicht von aussen bezeugt. Das Siegel gilt ' +
					'trotzdem; die Bezeugung lässt sich später auf der Siegelseite nachholen.'
		});
	}

	return bewerteBetrieb(dienste, warnungen);
}

/**
 * Ob in den letzten Siegeln der Ersatzdienst bezeugt hat.
 *
 * **Warum das eine Warnung ist und keine Störung.** Das Siegel ist bezeugt,
 * der Abschluss also in Ordnung. Der Anlass ist ein anderer: Der Hauptdienst
 * hat nicht geliefert, und der häufigste Grund ist ein gewechseltes
 * Unterzeichnerzertifikat. Bis jemand den neuen Abdruck anheftet, bezeugt der
 * Ersatz jedes Siegel. Das gehört an eine Stelle, die man sieht, sonst bleibt
 * es beim einzelnen Siegel liegen.
 *
 * **Warum die letzten drei Siegel und nicht nur das jüngste.** An einem
 * gemeinsamen Abend versiegelt ein Betreiber mehrere Gemeinschaften kurz
 * nacheinander. Fällt der Hauptdienst beim ersten aus und antwortet beim
 * letzten wieder, wäre die Ausweichung mit einem Blick auf das jüngste Siegel
 * unsichtbar; drei decken einen solchen Abend und die nächste Gelegenheit ab.
 * **Warum nicht weiter zurück.** Der Hinweis sagt «wahrscheinlich gewechselt».
 * Nach drei Versiegelungen mit dem Hauptdienst ist entweder neu angeheftet
 * oder die Sache bekannt, und eine Warnung, die ein Jahr steht, liest niemand
 * mehr.
 */
async function ersatzwarnungen(operatorId: string): Promise<string[]> {
	const zeilen = await alsBetreiber(
		operatorId,
		async (tx) =>
			tx<{ stelle: string | null; vom_ersatz: boolean }[]>`
				SELECT timestamp_authority AS stelle, timestamp_by_fallback AS vom_ersatz
				  FROM seal
				 WHERE operator_id = ${operatorId}
				   AND timestamp_state = 'vorhanden'
				 ORDER BY sealed_at DESC
				 LIMIT 3
			`
	);

	const vomErsatz = zeilen.filter((z) => z.vom_ersatz);
	if (vomErsatz.length === 0) return [];

	const stellen = [...new Set(vomErsatz.map((z) => z.stelle).filter((s): s is string => !!s))];
	return [
		`Bei den letzten Siegeln hat der Ersatzdienst den Zeitstempel bezeugt` +
			(stellen.length > 0 ? ` (${stellen.join(', ')})` : '') +
			'. Wahrscheinlich ist der Abdruck des Hauptdienstes gewechselt. Prüfen und anheften ' +
			'unter «Betreiber → Äussere Dienste».'
	];
}

/**
 * Antwortet dieses Haus überhaupt?
 *
 * **Was hier NICHT geprüft wird:** ob der Schlüssel gilt, ob das Modell
 * existiert, ob die Stelle einen brauchbaren Stempel ausstellt. Dafür braucht
 * es einen echten Aufruf, und der gehört an den Prüfknopf — nicht in einen
 * Ladepfad, den jede Seitenladung durchläuft.
 *
 * Eine Absage des Hauses (401, 404, 405) zählt als **erreichbar**: Wer
 * antwortet, ist da. Alles andere hiesse, eine falsche Zugangsangabe als
 * Netzstörung zu melden.
 */
const gemerkteHaeuser = new Map<string, { wert: boolean; bis: number }>();

/**
 * **Zwei Sekunden, nicht die Geduld der Stufe.** Der erste Entwurf nahm
 * `geduldMs` — bei einer KI-Stufe sind das zwölf. Diese Prüfung läuft aber im
 * Ladepfad des Gerüsts, also bei **jedem** Seitenaufbau: Auf dem Notebook im
 * Versammlungsraum ohne Netz hätte damit jede Seite bis zu zwölf Sekunden
 * gehangen, und weil ein Fehlschlag nur kurz gemerkt wird, immer wieder.
 *
 * Die Geduld gehört an den echten Anruf — dort wartet jemand auf eine Antwort,
 * die er braucht. Hier wartet er auf eine Anzeige.
 */
async function antwortet(url: string): Promise<boolean> {
	const gemerkt = gemerkteHaeuser.get(url);
	if (gemerkt && Date.now() < gemerkt.bis) return gemerkt.wert;

	let wert = false;
	try {
		// HEAD, nicht POST: Ein POST an ein Modell wäre eine Anfrage mit Kosten.
		await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(ERREICHBARKEIT_ZEITLIMIT_MS) });
		wert = true;
	} catch {
		wert = false;
	}

	// Dieselbe Staffelung wie bei Authentik: Erreichbares wird länger gemerkt,
	// damit ein wiederkehrendes Netz rasch auffällt.
	gemerkteHaeuser.set(url, { wert, bis: Date.now() + (wert ? 60_000 : 15_000) });
	return wert;
}

async function kiLage(operatorId: string) {
	const kette = await stufen(operatorId);
	if (kette.length === 0) {
		return { name: 'KI-Kette', eingerichtet: false, erreichbar: false };
	}
	// **Eine antwortende Stufe genügt.** Fällt die erste aus, weicht die Kette
	// aus — genau dafür ist sie gebaut, und das als Störung zu melden hiesse,
	// die Ausweichung als Fehler zu lesen. Erst wenn keine mehr antwortet, ist
	// die KI weg.
	const erreichbar = (await Promise.all(kette.map((s) => antwortet(s.url)))).some(Boolean);
	const name = kette.length === 1 ? `KI: ${kette[0].name}` : `KI-Kette (${kette[0].name} + ${kette.length - 1})`;
	return { name, eingerichtet: true, erreichbar };
}

async function zeitstempelLage(operatorId: string) {
	const [d, e] = await Promise.all([dienst(operatorId), ersatzdienst(operatorId)]);
	if (!d) return { name: 'Zeitstempeldienst', eingerichtet: false, erreichbar: false, mitErsatz: false };

	/*
	 * **Ein antwortender Dienst genügt** (13.11.2026), wie bei der KI-Kette:
	 * Fällt der Hauptdienst aus und springt der Ersatz ein, ist das die
	 * vorgesehene Ausweichung und keine Störung. Erst wenn keiner antwortet,
	 * fehlt der Zeitstempel. Der Ersatz zählt nur, wenn für ihn ein Zertifikat
	 * angeheftet ist; ohne Abdruck fragt `bezeuge` ihn nicht (Sicherheitsprüfung).
	 */
	// Auch Name und `mitErsatz` nur mit Abdruck (Codeprüfung 13.11.2026, N4):
	// Ein Ersatz, den `bezeuge` nie fragt, gehört nicht in die Meldung.
	const wirksam = e && e.fingerabdruecke.length > 0 ? e : null;
	const [haupt, ersatz] = await Promise.all([
		antwortet(d.url),
		wirksam ? antwortet(wirksam.url) : Promise.resolve(false)
	]);
	return {
		name: wirksam ? `Zeitstempel: ${d.name} (Ersatz: ${wirksam.name})` : `Zeitstempel: ${d.name}`,
		eingerichtet: true,
		erreichbar: haupt || ersatz,
		mitErsatz: wirksam !== null
	};
}
