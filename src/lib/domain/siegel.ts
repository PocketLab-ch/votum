/**
 * Das Abschlusspaket und sein Manifest (Welle 2, FR-51 bis FR-54) — rein.
 *
 * **Worum es geht.** Der Nachweiswert entsteht nicht dadurch, dass Daten nicht
 * bearbeitet werden können, sondern dadurch, dass **jede Bearbeitung auffällt**.
 * Über jeden Bestandteil des Pakets wird eine Prüfsumme gebildet; die
 * Prüfsummen stehen in einem Manifest, und die Prüfsumme über das Manifest ist
 * das Siegel. Wer einen Bestandteil austauscht, ändert seine Prüfsumme; wer die
 * Prüfsumme nachzieht, ändert die des Manifests; und die steht — mit
 * Zeitstempel — ausserhalb.
 *
 * **Was hier steht und was nicht.** Hier steht die *Form*: was ein Manifest
 * ist, wie es zu lesen ist, und wie sich ein Paket dagegen prüfen lässt. Das
 * Rechnen der Prüfsummen und das Zusammentragen der Daten liegt in der Schale —
 * SHA-256 ist eine Funktion des Laufzeitsystems, und die Daten kommen aus der
 * Datenbank (AD-1).
 *
 * **Warum das Manifest zweimal im Paket liegt.** Als `manifest.json` für die
 * Maschine und als `MANIFEST.txt` für den Menschen. FR-52 verlangt, dass es
 * «ohne Fachkenntnis lesbar» ist — und wer im Streitfall danach greift, ist
 * Anwalt oder Richterin, nicht Entwickler.
 */

// Relativ, nicht über `$lib`: `check:schichten` löst den Alias nicht auf und
// hielte den Nachbarn im selben Kern für Aussenwelt (AD-1, gemessen 22.09.2026).
import { zeichenzahl } from './zeichenzahl';
import { anwendungInWorten } from './version';
import { L16_SIEGELZEILE } from './lesarten';

export interface Manifesteintrag {
	/** Pfad im Paket, mit Schrägstrichen. */
	pfad: string;
	groesse: number;
	/** SHA-256, hexadezimal in Kleinbuchstaben. */
	pruefsumme: string;
	/** Was der Bestandteil enthält — ein Satz, kein Dateityp. */
	beschreibung: string;
}

export interface Manifest {
	fassung: 1;
	gemeinschaft: string;
	versammlung: {
		kennung: string;
		datum: string;
		uhrzeit: string;
		ort: string;
		art: string;
		stufe: string;
		/**
		 * Nur an einer zweiten nach L16 (Migration 194). Fehlt sonst, damit
		 * Manifeste ohne diese Lage Byte für Byte gleich bleiben.
		 */
		stufeNachLesart?: true;
		geschlossenAm: string | null;
	};
	versiegeltAm: string;
	versiegeltDurch: string;
	/**
	 * Die Zeitstempelstelle, der beim Versiegeln vertraut wurde.
	 *
	 * **Die Erwartung, nicht das Ergebnis.** Der Zeitstempel lautet auf das
	 * Siegel, das Siegel ist die Prüfsumme dieses Manifests: Was der Stempel
	 * später trägt, kann hier also nicht stehen. Was hier steht, ist der
	 * Fingerabdruck, den der Betreiber im Augenblick des Versiegelns angeheftet
	 * hatte.
	 *
	 * **Warum das nötig ist** (Sicherheitsprüfung 22.09.2026). Die Prüfung holte
	 * die angehefteten Fingerabdrücke beim **prüfenden** Betreiber. Wer ein
	 * Paket auf einem fremden System prüft, oder nachdem der Betreiber den
	 * Dienst gewechselt hat, bekam eine leere Liste; das Urteil blieb ehrlich
	 * («angeheftet: unbekannt»), aber es stand nirgends, welcher Stelle man
	 * damals vertraut hatte.
	 *
	 * **Was dieses Feld nicht leistet** (Sicherheitsprüfung, im selben
	 * Durchgang): Es schützt **nicht** gegen ein neu versiegeltes Paket. Wer
	 * das Siegel neu rechnet, schreibt dieses Feld mit und trägt seine eigene
	 * Stelle ein. Es ist eine Absichtserklärung, die mitreist, keine
	 * kryptografische Bindung, und es trägt erst zusammen mit einem Siegelwert
	 * von aussen. Sein eigener Nutzen: Ein Mensch sieht, welche Stelle
	 * beansprucht wird, und ein Widerspruch innerhalb des Pakets fällt auf.
	 *
	 * Fehlt das Feld, stammt das Paket aus der Zeit davor. Dann gilt der alte
	 * Weg, und die Prüfung sagt das.
	 */
	zeitstempelstelle?: {
		/**
		 * SHA-256 des Signaturzertifikats, wie `operator.tsa_fingerprints` es
		 * führt.
		 *
		 * **Kann leer sein** (13.11.2026): Dann war beim Versiegeln kein
		 * Zertifikat des Hauptdienstes angeheftet, wohl aber eines des
		 * Ersatzes. Die Erwartung trägt in diesem Fall allein `ersatz`.
		 */
		fingerabdruecke: string[];
		/** Der Name des Dienstes, wie der Betreiber ihn hinterlegt hat. */
		name: string | null;
		/** Die Adresse des Dienstes, zur Einordnung für einen Menschen. */
		url: string | null;
		/**
		 * Der Ersatzdienst, falls beim Versiegeln einer eingetragen war
		 * (13.11.2026).
		 *
		 * **Warum er ins Manifest gehört.** Liefert der Hauptdienst keinen
		 * geprüften Stempel, bezeugt das Siegel der Ersatz. Ohne diesen Eintrag
		 * nennte das Paket nur den Hauptdienst, und die Prüfseite müsste den
		 * Stempel des Ersatzes als Widerspruch melden, «dafür gibt es keine
		 * harmlose Erklärung». Es gibt eine, und sie steht hier.
		 *
		 * Die Liste bleibt die Erwartung von damals, keine Aussage darüber, wer
		 * tatsächlich gestempelt hat.
		 */
		ersatz?: {
			fingerabdruecke: string[];
			name: string | null;
			url: string | null;
		};
	};
	/** Woher die Uhr kam (AD-12) — im lokalen Betrieb kann sie falsch gehen. */
	zeitquelle: string;
	/**
	 * Mit welchem Stand der Anwendung versiegelt wurde (Entscheid 0053,
	 * 16.11.2026): die Version ist der Abbild-Tag, `null` im Entwicklungsstapel.
	 * Damit lässt sich belegen, mit welcher Fassung des Codes eine Versammlung
	 * gezählt wurde; die Fassung des Regelwerks steht je Traktandum daneben.
	 *
	 * **Fehlt das Feld, stammt das Paket aus der Zeit davor**, wie bei
	 * `zeitstempelstelle`. Das Siegel ist die Prüfsumme der Bytes; ein Paket
	 * ohne das Feld bleibt so gültig, wie es versiegelt wurde.
	 */
	anwendung?: { name: string; version: string | null };
	eintraege: Manifesteintrag[];
	/** Was ausdrücklich **nicht** im Paket liegt, und warum. */
	nichtEnthalten: { was: string; grund: string }[];
}

/**
 * Das Manifest als Zeichenkette, über die die Prüfsumme gebildet wird.
 *
 * **Stabil sortiert und ohne Zufall**: Zwei Läufe mit denselben Daten ergeben
 * dieselben Bytes. Ohne das liesse sich ein Siegel nicht nachrechnen, und genau
 * das Nachrechnen ist sein Zweck.
 *
 * Zwei Leerzeichen Einrückung, damit die Datei auch ohne Werkzeug lesbar
 * bleibt — sie ist ein Beweismittel, keine Übertragung.
 */
export function manifestAlsJson(m: Manifest): string {
	const geordnet: Manifest = {
		...m,
		eintraege: [...m.eintraege].sort((a, b) => a.pfad.localeCompare(b.pfad, 'en'))
	};
	return JSON.stringify(geordnet, null, 2);
}

/**
 * Bricht einen Satz auf eine Breite um, ohne ein Wort zu zerschneiden.
 *
 * `MANIFEST.txt` wird ausgedruckt und im Streitfall danebengelegt. Was der
 * Drucker umbricht, bricht er mitten im Wort und ohne Einzug; was hier
 * umbrochen wird, bleibt lesbar. Ein Wort, das allein schon länger ist als
 * die Breite — ein Zertifikatsabdruck etwa —, bekommt seine eigene Zeile und
 * bleibt ganz: Lieber eine zu breite Zeile als ein zerschnittener Wert, den
 * niemand mehr vergleichen kann.
 */
function umbrich(text: string, breite: number): string[] {
	const zeilen: string[] = [];
	let zeile = '';
	for (const wort of text.split(' ')) {
		if (zeile === '') zeile = wort;
		/*
		 * **`zeichenzahl` statt `.length`**, und hier ausnahmsweise nicht wegen
		 * einer Datenbankschranke (`check:zeichenzahl` hat die Stelle
		 * angestrichen, 22.09.2026). `.length` zählt UTF-16-Einheiten; ein
		 * Bildzeichen wäre zwei. Für eine **Druckbreite** ist das schlicht die
		 * falsche Zählung: Auf dem Papier nimmt es eine Stelle ein, nicht zwei.
		 * Der Wächter hat also nicht bloss formal recht.
		 */
		else if (zeichenzahl(`${zeile} ${wort}`) <= breite) zeile = `${zeile} ${wort}`;
		else {
			zeilen.push(zeile);
			zeile = wort;
		}
	}
	if (zeile !== '') zeilen.push(zeile);
	/*
	 * **Eine leere Beschreibung bleibt eine Zeile** (Code-Review, zweite
	 * Runde). `''` und `'   '` ergaben sonst gar keine Zeile, wo vorher eine
	 * mit blossem Einzug stand — ein stiller Strukturverlust im Beweismittel.
	 * Im Bestand tritt der Fall nicht auf; eine Zeile, die verschwindet, fällt
	 * aber niemandem auf, und genau deshalb steht der Fall hier.
	 */
	return zeilen.length > 0 ? zeilen : [''];
}

/** «12.3 kB» — für Menschen, nicht für Maschinen. */
function groesse(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Das Manifest in Worten (FR-52: «ohne Fachkenntnis lesbar»).
 *
 * Es erklärt sich selbst: was das Paket ist, wie man es prüft, und was jeder
 * Bestandteil enthält. Wer es im Streitfall in die Hand bekommt, soll ohne
 * Rückfrage weiterkommen.
 */
export function manifestInWorten(m: Manifest, siegel: string): string {
	const z: string[] = [];
	z.push('ABSCHLUSSPAKET EINER STOCKWERKEIGENTÜMER-VERSAMMLUNG');
	z.push('='.repeat(56));
	z.push('');
	z.push(`Gemeinschaft:   ${m.gemeinschaft}`);
	z.push(`Versammlung:    ${m.versammlung.datum}, ${m.versammlung.uhrzeit} Uhr, ${m.versammlung.ort}`);
	z.push(`Art:            ${m.versammlung.art}, ${m.versammlung.stufe} Versammlung`);
	if (m.versammlung.stufeNachLesart) z.push(`                ${L16_SIEGELZEILE}`);
	if (m.versammlung.geschlossenAm) z.push(`Geschlossen am: ${m.versammlung.geschlossenAm}`);
	z.push(`Versiegelt am:  ${m.versiegeltAm} durch ${m.versiegeltDurch}`);
	z.push(`Zeitquelle:     ${m.zeitquelle}`);
	// Seit Entscheid 0053; ältere Pakete tragen die Angabe nicht.
	const anwendung = anwendungInWorten(m.anwendung);
	if (anwendung) z.push(`Anwendung:      ${anwendung}`);
	z.push('');
	z.push('WAS DIESES PAKET IST');
	z.push('-'.repeat(56));
	z.push('Es enthält alles, was die an dieser Versammlung gefassten Beschlüsse trägt.');
	z.push('Das sind die Zahlen jeder Abstimmung, wer anwesend war, welche Vollmachten');
	z.push('galten, und der lückenlose Verlauf. Die Daten liegen in einem offenen');
	z.push('Format (JSON), die Unterlagen im Original — das Paket ist ohne die Anwendung');
	z.push('lesbar, mit der es entstanden ist.');
	z.push('');
	z.push('WIE SIE ES PRÜFEN');
	z.push('-'.repeat(56));
	z.push('1. Bilden Sie über jede unten aufgeführte Datei die SHA-256-Prüfsumme und');
	z.push('   vergleichen Sie sie mit der Angabe in dieser Liste.');
	z.push('   Unter Linux/macOS:  sha256sum <datei>');
	z.push('   Unter Windows:      certutil -hashfile <datei> SHA256');
	z.push('2. Bilden Sie die Prüfsumme über «manifest.json». Sie muss lauten:');
	z.push(`   ${siegel}`);
	z.push('3. Diese Prüfsumme ist das Siegel. Weicht eine einzige Angabe ab, ist der');
	z.push('   betroffene Bestandteil nach dem Versiegeln verändert worden.');
	z.push('');
	/*
	 * **Warum dieser Abschnitt hier steht** (22.09.2026). Die Angabe zur
	 * Zeitstempelstelle lag nur in `manifest.json` — also in der Fassung für
	 * die Maschine. Wer im Streitfall nach dem Paket greift, liest diese
	 * Datei, und genau ihm fehlte die Auskunft, welcher Stelle damals
	 * vertraut wurde und was ein abweichender Aussteller bedeutet.
	 *
	 * Der Abschnitt steht **vor** der Liste, nicht dahinter: Die Liste ist
	 * lang, und was man erst nach hundert Zeilen Prüfsummen findet, findet
	 * man nicht.
	 */
	z.push('DER ZEITSTEMPEL');
	z.push('-'.repeat(56));
	z.push('Das Siegel belegt, dass nichts verändert wurde. Wann es entstand, belegt es');
	z.push('nicht. Dafür wird es von einer unabhängigen Stelle bezeugt: Sie unterschreibt');
	z.push('die Prüfsumme aus Schritt 2 zusammen mit ihrer eigenen Uhrzeit.');
	z.push('');
	if (m.zeitstempelstelle) {
		const stelle = m.zeitstempelstelle;
		if (stelle.fingerabdruecke.length > 0) {
			z.push('Beim Versiegeln war diese Stelle hinterlegt:');
			z.push(`    Name:      ${stelle.name ?? 'nicht angegeben'}`);
			z.push(`    Adresse:   ${stelle.url ?? 'nicht angegeben'}`);
			/*
			 * **Der Abdruck bekommt seine eigene Zeile** (Code-Review 22.09.2026).
			 * Er wird in der Doppelpunktform in Grossbuchstaben abgelegt
			 * (`fingerabdruckliste` in `zeitstempel.ts`), und das sind 95 Zeichen.
			 * Hinter einem Etikett stünde die Zeile bei 111, während der ganze
			 * Rest dieser Datei unter 80 bleibt; ausgedruckt bräche sie mitten im
			 * Abdruck um, den jemand vergleichen soll.
			 */
			z.push('    Zertifikat des Unterzeichners (SHA-256):');
			for (const f of stelle.fingerabdruecke) {
				// Ohne Einzug, am linken Rand: 95 Zeichen passen in keine
				// 80-Zeichen-Zeile, aber so bricht nur dieser Wert um und nicht
				// erst recht, und wer die Zeile kopiert, hat genau den Abdruck.
				z.push(f);
			}
		} else {
			/*
			 * **Der Hauptdienst kann ohne Abdruck dastehen, wenn der Ersatz
			 * angeheftet war** (13.11.2026). Dann trägt die Erwartung allein der
			 * Ersatz, und diese Zeile sagt, warum oben kein Zertifikat steht.
			 */
			z.push('Beim Versiegeln war für den Hauptdienst kein Zertifikat angeheftet.');
			if (stelle.name || stelle.url) {
				z.push(`    Name:      ${stelle.name ?? 'nicht angegeben'}`);
				z.push(`    Adresse:   ${stelle.url ?? 'nicht angegeben'}`);
			}
		}
		z.push('');
		/*
		 * **Der Ersatzdienst gehört daneben** (13.11.2026). Wer diese Datei
		 * liest, sieht sonst nur den Hauptdienst und hält den beigelegten
		 * Stempel des Ersatzes für einen Widerspruch. Der Abschnitt sagt, wann
		 * der Ersatz einspringt, damit die Zuordnung ohne die Anwendung
		 * gelingt.
		 */
		if (stelle.ersatz) {
			const e = stelle.ersatz;
			z.push('Ausserdem war ein Ersatzdienst eingetragen. Liefert der Hauptdienst');
			z.push('keinen geprüften Stempel, bezeugt er das Siegel:');
			z.push(`    Name:      ${e.name ?? 'nicht angegeben'}`);
			z.push(`    Adresse:   ${e.url ?? 'nicht angegeben'}`);
			z.push('    Zertifikat des Unterzeichners (SHA-256):');
			for (const f of e.fingerabdruecke) {
				z.push(f);
			}
			z.push('');
		}
		z.push('Das ist die Erwartung von damals und nicht das Ergebnis: Der Stempel lautet');
		z.push('auf das Siegel, und das Siegel steht erst fest, wenn diese Datei geschrieben');
		z.push('ist. Wer ein Paket neu versiegelt, schreibt diese Angabe mit. Sie beweist für');
		z.push(
			stelle.ersatz
				? 'sich allein also nichts; sie sagt, welche Stellen dafür vorgesehen waren.'
				: 'sich allein also nichts; sie sagt, welche Stelle dafür vorgesehen war.'
		);
	} else {
		/*
		 * **«Keine Stelle» wäre zu viel gesagt** (Code-Review 22.09.2026). Das
		 * Feld wird nur geschrieben, wenn Fingerabdrücke angeheftet waren
		 * (`siegel.ts`, `zeitdienst?.fingerabdruecke.length`). Ein Dienst
		 * **ohne** angeheftetes Zertifikat ist aber ein vorgesehener Zustand:
		 * Die Anwendung prüft dann die Signatur, nur nicht, wer sie geleistet
		 * hat. In diesem Fall fehlt das Feld, obwohl eine Stelle eingerichtet
		 * war und geantwortet hat — ihre Antwort liegt womöglich als
		 * `zeitstempel.tsr` im selben Archiv.
		 *
		 * Diese Datei wird im Streit vorgelegt. Sie darf über ihren eigenen
		 * Entstehungsvorgang nichts behaupten, was nicht stimmt, und schon gar
		 * nichts zulasten dessen, der sie vorlegt.
		 */
		z.push('Beim Versiegeln war keine Stelle mit angeheftetem Zertifikat hinterlegt. Das');
		z.push('heisst nicht, dass keine angefragt wurde: Es kann eine eingerichtet gewesen');
		z.push('sein, deren Zertifikat nicht vorab festgelegt war. Liegt ein Stempel bei,');
		z.push('prüfen Sie ihn gegen das Zertifikat seines Ausstellers.');
	}
	z.push('');
	/*
	 * **Der Verweis nach oben nur, wo oben eine Stelle steht** (Codeprüfung
	 * 13.11.2026, N3). Ohne `zeitstempelstelle` nennt der Absatz darüber keine.
	 */
	if (m.zeitstempelstelle?.ersatz) {
		z.push('Liegt «zeitstempel.tsr» im Paket, ist das die Antwort einer der oben genannten');
		z.push('Stellen. Die Datei steht nicht in der Liste unten: Sie ist auf das Siegel');
		z.push('ausgestellt und entsteht erst, wenn die Liste feststeht. Prüfen ohne diese');
		z.push('Anwendung:');
	} else if (m.zeitstempelstelle) {
		z.push('Liegt «zeitstempel.tsr» im Paket, ist das die Antwort der oben genannten');
		z.push('Stelle. Die Datei steht nicht in der Liste unten: Sie ist auf das Siegel');
		z.push('ausgestellt und entsteht erst, wenn die Liste feststeht. Prüfen ohne diese');
		z.push('Anwendung:');
	} else {
		z.push('Liegt «zeitstempel.tsr» im Paket, ist das die Antwort der Stelle, die beim');
		z.push('Versiegeln gefragt wurde. Die Datei steht nicht in der Liste unten: Sie ist');
		z.push('auf das Siegel ausgestellt und entsteht erst, wenn die Liste feststeht.');
		z.push('Prüfen ohne diese Anwendung:');
	}
	z.push('   openssl ts -verify -in zeitstempel.tsr \\');
	z.push('     -digest <Siegel aus Schritt 2> -CAfile <Zertifikatskette der Stelle>');
	z.push('');
	/*
	 * **Vier Gründe, nicht einer** (Code-Review 22.09.2026). Hier stand, die
	 * Stelle sei «nicht erreichbar» gewesen — das ist nur einer der Fälle. Die
	 * Datei fehlt auch, wenn gar kein Dienst hinterlegt war, wenn der Dienst
	 * die Anfrage abgewiesen hat, oder wenn seine Antwort die Prüfung nicht
	 * bestand. Und ob nachgeholt wurde, weiss diese Datei erst recht nicht:
	 * Bei «gescheitert» geschieht von selbst nichts. Eine plausible, aber
	 * falsche Erklärung schickt den Leser an die falsche Stelle.
	 */
	z.push('Fehlt die Datei, kam beim Versiegeln kein Stempel zustande. Möglich ist alles');
	z.push('davon: kein Dienst hinterlegt, Dienst nicht erreichbar, Anfrage abgelehnt, oder');
	z.push('die Antwort bestand die Prüfung nicht. Wurde er nachgeholt, liegt er als eigene');
	z.push('Datei neben dem Paket, nicht darin.');
	z.push('');
	z.push(
		m.zeitstempelstelle
			? 'Ein nachgeholter Stempel darf eine andere Stelle nennen als oben genannt:'
			: 'Ein nachgeholter Stempel darf eine andere Stelle nennen als beim Versiegeln:'
	);
	z.push('Zwischen Versiegeln und Nachholen kann der Dienst gewechselt haben. Er bezeugt');
	z.push('dann den Zeitpunkt des Nachholens, nicht den des Versiegelns. Ein Stempel im');
	z.push('Paket, der eine andere Stelle nennt, ist dagegen ein Widerspruch und gehört');
	z.push('abgeklärt.');
	z.push('');
	z.push('INHALT');
	z.push('-'.repeat(56));
	for (const e of [...m.eintraege].sort((a, b) => a.pfad.localeCompare(b.pfad, 'en'))) {
		z.push(`${e.pfad}`);
		/*
		 * **Umbrochen, nicht in einer Zeile** (Code-Review 22.09.2026). Die
		 * Beschreibungen standen je auf einer Zeile: neun von zwölf über 80
		 * Zeichen, die längste mit Einzug 256. Der Abschnitt «DER ZEITSTEMPEL»
		 * oben begründet ausführlich, warum in dieser Datei jede Zeile unter 80
		 * bleibt — und ausgerechnet die Liste darunter hielt sich nicht daran.
		 *
		 * Aufgefallen ist es erst, als ein Satz die Satzgrenze riss und ich ihn
		 * teilte: Der Wächter war danach zufrieden, das Dokument **sechs**
		 * Zeichen länger (252 → 258; die erste Fassung dieses Kommentars sagte
		 * «zwei» und «262», beides nicht nachgemessen und beides die Zahl nach
		 * der Änderung statt der gefundenen). Die Satzlänge war das Symptom,
		 * die Zeilenbreite der Mangel.
		 */
		for (const zeile of umbrich(e.beschreibung, 72)) z.push(`    ${zeile}`);
		z.push(`    ${groesse(e.groesse)} · ${e.pruefsumme}`);
	}
	z.push('');
	z.push('WAS NICHT ENTHALTEN IST');
	z.push('-'.repeat(56));
	for (const n of m.nichtEnthalten) {
		z.push(`${n.was}`);
		z.push(`    ${n.grund}`);
	}
	z.push('');
	return z.join('\n');
}

// ── Prüfen (FR-54) ──────────────────────────────────────────────────────────

/** Dateien des Pakets, die nicht im Manifest stehen können. */
export const AUSSERHALB = new Set(['manifest.json', 'MANIFEST.txt', 'zeitstempel.tsr']);

export interface Pruefbefund {
	/** Stimmen alle Bestandteile? */
	bestandteileStimmen: boolean;
	/** Stimmt die Prüfsumme über das Manifest? */
	manifestStimmt: boolean;
	/** Bestandteile, die abweichen — **namentlich** (FR-54). */
	abweichungen: { pfad: string; erwartet: string; gefunden: string | null }[];
	/** Bestandteile, die im Manifest stehen und im Paket fehlen. */
	fehlend: string[];
	/** Dateien im Paket, die das Manifest nicht kennt. */
	zusaetzlich: string[];
	satz: string;
}

/**
 * Prüft ein Paket gegen sein Manifest.
 *
 * Getrennte Aussagen, wie FR-54 es verlangt: Bestandteile, Manifest,
 * Zeitstempel. Ein einziges «in Ordnung» wäre im Streitfall wertlos — die Frage
 * ist immer, **was** nicht stimmt.
 *
 * Der Zeitstempel wird hier nicht geprüft: Er hängt an Zertifikaten, und die
 * liegen in der Schale. Sein Befund kommt getrennt dazu.
 */
export function pruefe(
	/**
	 * Nur die Liste der Bestandteile wird gebraucht. Deshalb prüft dieselbe
	 * Funktion auch das Paket einer Protokollfassung mit Nachtragssiegel
	 * (`domain/nachtragssiegel.ts`), das gleich gebaut ist.
	 */
	manifest: Pick<Manifest, 'eintraege'>,
	/** Was tatsächlich im Paket liegt: Pfad → Prüfsumme. */
	gefunden: Map<string, string>,
	/** Die gerechnete Prüfsumme über `manifest.json`. */
	manifestPruefsumme: string,
	/** Das Siegel, wie es ausserhalb des Pakets festgehalten ist. */
	siegel: string
): Pruefbefund {
	const abweichungen: Pruefbefund['abweichungen'] = [];
	const fehlend: string[] = [];

	for (const e of manifest.eintraege) {
		const ist = gefunden.get(e.pfad) ?? null;
		if (ist === null) {
			fehlend.push(e.pfad);
			continue;
		}
		if (ist !== e.pruefsumme) {
			abweichungen.push({ pfad: e.pfad, erwartet: e.pruefsumme, gefunden: ist });
		}
	}

	const bekannt = new Set(manifest.eintraege.map((e) => e.pfad));
	// Drei Dateien stehen nicht in der Liste und dürfen es nicht:
	//
	//   - `manifest.json` kann seine eigene Prüfsumme nicht enthalten,
	//   - `MANIFEST.txt` ist dieselbe Aussage in Worten,
	//   - `zeitstempel.tsr` ist **auf das Manifest ausgestellt** und entsteht
	//     erst, wenn dieses feststeht.
	const zusaetzlich = [...gefunden.keys()].filter((p) => !bekannt.has(p) && !AUSSERHALB.has(p));

	const bestandteileStimmen = abweichungen.length === 0 && fehlend.length === 0;
	const manifestStimmt = manifestPruefsumme === siegel;

	let satz: string;
	if (bestandteileStimmen && manifestStimmt) {
		satz = 'Das Siegel hält: Jeder Bestandteil und das Manifest sind unverändert.';
	} else if (!manifestStimmt && bestandteileStimmen) {
		satz =
			'Die Bestandteile stimmen, das Manifest nicht. Das Manifest wurde nach dem ' +
			'Versiegeln verändert.';
	} else {
		const teile: string[] = [];
		if (abweichungen.length > 0) {
			teile.push(
				`${abweichungen.length} ${abweichungen.length === 1 ? 'Bestandteil weicht' : 'Bestandteile weichen'} ab (${abweichungen
					.map((a) => a.pfad)
					.join(', ')})`
			);
		}
		if (fehlend.length > 0) teile.push(`${fehlend.length} fehlt: ${fehlend.join(', ')}`);
		if (!manifestStimmt) teile.push('auch das Manifest stimmt nicht');
		satz = `Das Siegel hält nicht: ${teile.join('; ')}.`;
	}

	return { bestandteileStimmen, manifestStimmt, abweichungen, fehlend, zusaetzlich, satz };
}

/** Wie es um den Zeitstempel steht — in einem Satz für die Oberfläche. */
export function zeitstempelInWorten(
	zustand: 'ausstehend' | 'vorhanden' | 'gescheitert',
	stelle?: string | null,
	zeitpunkt?: string | null
): string {
	if (zustand === 'vorhanden') {
		return `Zeitstempel vorhanden${stelle ? ` von ${stelle}` : ''}${zeitpunkt ? `, ${zeitpunkt}` : ''}.`;
	}
	if (zustand === 'gescheitert') {
		return (
			'Der Zeitstempel konnte nicht eingeholt werden. Das Siegel gilt trotzdem — es fehlt ' +
			'ihm der unabhängige Beleg, wann es entstand. Die Anwendung versucht es erneut.'
		);
	}
	return (
		'Zeitstempel ausstehend. Der Abschluss ist vollzogen; der unabhängige Beleg des ' +
		'Zeitpunkts wird nachgeholt, sobald wieder Verbindung besteht.'
	);
}
