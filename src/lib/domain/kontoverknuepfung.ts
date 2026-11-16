/**
 * Wann ein Konto sich mit einer Authentik-Kennung verbinden darf.
 *
 * **Die Frage dahinter.** Beim Anmelden über Authentik kommt eine unveränderliche
 * Kennung (`sub`) und eine E-Mail-Adresse zurück. Die Kennung ist der Anker,
 * aber beim ersten Mal steht sie noch nirgends — sonst wäre es kein erstes Mal.
 * Es braucht also ein zweites Merkmal, über das sich Konto und Mensch einmalig
 * finden. Das ist die E-Mail-Adresse, und sie ist nur so lange gültig, wie ein
 * Fenster offensteht.
 *
 * **Warum nicht dauerhaft.** Ob ein Angemeldeter seine Adresse im IdP selbst
 * ändern darf, entscheidet der Betreiber (in Authentik die Tenant-Einstellung
 * `default_user_change_email`); Votum kann sich darauf nicht verlassen. Darf er
 * es, wäre ein dauerhaft offener Anker ein stehendes Ziel: Wer irgendein Konto im Verzeichnis hat,
 * setzt seine Adresse auf die einer Verwaltung, deren hiesiges Konto noch keine
 * Kennung trägt, meldet sich an und hat dieses Konto samt seiner Rolle.
 *
 * Ein Fenster nimmt dem Angriff nicht die Möglichkeit, aber den Zeitpunkt: Er
 * müsste treffen, während die Verwaltung gerade auf jemanden wartet.
 *
 * **Reine Rechnung.** Alles, was die Entscheidung braucht, kommt als Wert
 * herein, auch die Uhrzeit. Damit lässt sich jeder Zweig mit einer Wertetabelle
 * belegen, ohne Datenbank und ohne Warten.
 */

/**
 * Wie lange ein frisch geöffnetes Fenster offensteht.
 *
 * Vierzehn Tage. Kürzer hiesse, dass eine Ferienabwesenheit das Fenster
 * verfallen lässt und die Verwaltung es routinemässig nachöffnet — und was
 * routinemässig nachgeöffnet wird, ist kein Fenster mehr, sondern eine Tür mit
 * zusätzlichem Aufwand. Länger hiesse, dass der Anker praktisch immer offen
 * steht, und dann trägt er nichts.
 */
export const VERKNUEPFUNGSFENSTER_TAGE = 14;

/** Das Ende eines Fensters, das jetzt geöffnet wird. */
export function fensterEnde(von: Date): Date {
	return new Date(von.getTime() + VERKNUEPFUNGSFENSTER_TAGE * 24 * 60 * 60 * 1000);
}

/**
 * Was zu einem Konto über seine Verknüpfung zu sagen ist.
 *
 * Fünf Fälle, weil die Verwaltung fünf verschiedene Dinge zu tun hat: nichts,
 * eine Adresse eintragen, warten, das Fenster öffnen, das Fenster erneut öffnen.
 */
export type Verknuepfungsstand =
	/** Die Kennung steht. Ab hier ist die Adresse nur noch eine Angabe. */
	| 'verknuepft'
	/** Ohne Adresse gibt es keinen Anker, also auch kein Fenster. */
	| 'ohne_adresse'
	/** Das Fenster läuft. Die Person kann sich jetzt zum ersten Mal anmelden. */
	| 'offen'
	/** Das Fenster ist abgelaufen, ohne dass jemand hereingekommen ist. */
	| 'abgelaufen'
	/** Adresse da, Fenster nie geöffnet. */
	| 'zu';

export interface Verknuepfungslage {
	/** Steht `oidc_subject` bereits? */
	hatKennung: boolean;
	/** Die hinterlegte Adresse, oder nichts. */
	email: string | null;
	/** Bis wann das Fenster offensteht. `null` heisst zu. */
	offenBis: Date | null;
}

export function verknuepfungsstand(lage: Verknuepfungslage, jetzt: Date): Verknuepfungsstand {
	// **Die Kennung schlägt alles.** Auch ein versehentlich offen gelassenes
	// Fenster ändert an einem verknüpften Konto nichts mehr — der Weg über die
	// Adresse wird gar nicht mehr betreten.
	if (lage.hatKennung) return 'verknuepft';
	if (!lage.email) return 'ohne_adresse';
	if (!lage.offenBis) return 'zu';
	return lage.offenBis.getTime() > jetzt.getTime() ? 'offen' : 'abgelaufen';
}

/** Warum eine Erstverknüpfung nicht zustande kam. */
export type Verknuepfungshindernis =
	| 'kein_treffer'
	/** Dieselbe Adresse führt zu mehr als einem Konto. */
	| 'mehrdeutig'
	| 'ausser_dienst'
	| 'schon_verknuepft'
	| 'ohne_adresse'
	| 'kein_fenster'
	| 'fenster_abgelaufen';

export interface Kontolage extends Verknuepfungslage {
	/** Konten ausser Dienst kommen auf keinem Weg herein. */
	ausserDienst: boolean;
}

export type Verknuepfungsausgang =
	| { erlaubt: true }
	| { erlaubt: false; hindernis: Verknuepfungshindernis };

/**
 * Darf sich dieses Konto jetzt zum ersten Mal verbinden?
 *
 * **Der Grund wird mitgegeben und nicht verschluckt.** Nach aussen sieht jeder
 * Fehlschlag gleich aus, und das ist richtig: Wer eine fremde Adresse probiert,
 * soll nicht erfahren, ob es das Konto gibt und ob sein Fenster gerade zu ist.
 * Im Serverprotokoll steht der Zweig trotzdem, sonst steht die Fehlersuche
 * still — dieselbe Erfahrung wie beim Eigentümerzugang am 20.08.2026, wo von
 * aussen jeder Abbruch wie derselbe aussah.
 */
export function darfErstverknuepfen(lage: Kontolage, jetzt: Date): Verknuepfungsausgang {
	// **Zuerst der Dienststand, vor allem anderen.** Ein Konto ausser Dienst
	// darf auch dann nicht herein, wenn sein Fenster noch offensteht: Das
	// Ausserdienststellen ist der Griff, mit dem jemand ausgesperrt wird, und
	// er muss der stärkere sein.
	if (lage.ausserDienst) return { erlaubt: false, hindernis: 'ausser_dienst' };

	const stand = verknuepfungsstand(lage, jetzt);
	switch (stand) {
		case 'offen':
			return { erlaubt: true };
		case 'verknuepft':
			return { erlaubt: false, hindernis: 'schon_verknuepft' };
		case 'ohne_adresse':
			return { erlaubt: false, hindernis: 'ohne_adresse' };
		case 'zu':
			return { erlaubt: false, hindernis: 'kein_fenster' };
		case 'abgelaufen':
			return { erlaubt: false, hindernis: 'fenster_abgelaufen' };
	}
}

/**
 * Bringt eine Adresse auf die Form, in der sie verglichen und abgelegt wird.
 *
 * Kleingeschrieben und ohne Rand. Die Datenbank vergleicht über `lower(email)`,
 * und wer hier anders normalisiert als dort, baut einen Unterschied zwischen
 * dem, was eindeutig ist, und dem, was gefunden wird.
 */
export function normalisiereEmail(wert: string): string {
	return wert.trim().toLowerCase();
}

/**
 * Eine Prüfung, die Tippfehler abfängt, und mehr nicht.
 *
 * **Absichtlich grob.** Was eine gültige Adresse ist, entscheidet am Ende der
 * Mailserver; ein Muster, das dem nachjagt, wird lang, falsch und weist
 * irgendwann eine echte Adresse ab. Hier geht es nur darum, dass ein
 * hineingerutschter Benutzername oder eine Telefonnummer auffällt, bevor sie
 * als Anker abgelegt wird und still nie trifft.
 */
export function istAdresse(wert: string): boolean {
	const w = normalisiereEmail(wert);
	if (/\s/.test(w)) return false;
	const teile = w.split('@');
	if (teile.length !== 2) return false;
	const [vorn, hinten] = teile;
	if (vorn.length === 0) return false;
	// Ein Punkt im hinteren Teil, und weder am Anfang noch am Ende.
	return /^[^.]+(\.[^.]+)+$/.test(hinten);
}

/**
 * Was von den Angaben aus Authentik übernommen wird.
 *
 * **Authentik führt die Person** (ADR-0004), also ist Übernehmen der Regelfall.
 * Zwei Ausnahmen, beide aus dem Code-Review vom 15.09.2026:
 *
 *   - **Ein leerer Name überschreibt keinen vorhandenen.** `preferred_username`
 *     und `name` können fehlen; die Anwendung verlangt an jeder anderen Stelle
 *     mindestens zwei Zeichen, und die Spalte kennt keine Schranke. Ein
 *     Authentik-Konto ohne Namen hätte sonst den von der Verwaltung erfassten
 *     Namen geleert — und danach stünde in Verlauf und Protokoll eine Handlung
 *     ohne Person.
 *   - **Was keine Adresse ist, wird keine.** Sonst landete ein Benutzername oder
 *     eine leere Zeichenkette im Feld, das die nächste Erstverknüpfung sucht.
 *
 * In beiden Fällen bleibt der bisherige Wert stehen. Das ist die stillere, aber
 * richtige Antwort: Die Verwaltung hat ihn erfasst, Authentik liefert dazu
 * nichts Besseres.
 */
export function nachgezogeneAngaben(
	aussen: { anzeigename: string; email: string | null },
	bisher: { displayName: string; email: string | null }
): { displayName: string; email: string | null } {
	const name = aussen.anzeigename.trim();
	const adresse = aussen.email ? normalisiereEmail(aussen.email) : null;
	return {
		displayName: [...name].length >= 2 ? name : bisher.displayName,
		email: adresse && istAdresse(adresse) ? adresse : bisher.email
	};
}

/** Warum eine bestehende Verknüpfung nicht gelöst werden kann. */
export type Loesungshindernis =
	/** Es gibt nichts zu lösen. */
	| 'nicht_verknuepft'
	/** Ohne Kennwort bliebe kein Weg herein. */
	| 'ohne_kennwort';

export type Loesungsausgang =
	| { erlaubt: true }
	| { erlaubt: false; hindernis: Loesungshindernis };

/**
 * Darf die Verknüpfung mit Authentik gelöst werden?
 *
 * **Der Auftrag** (Auftraggeber, 16.09.2026): «Die Authentikanbindung muss von Admin und
 * User auch wieder gelöst werden können.» Gründe dafür gibt es genug: Die Person
 * verlässt das Haus, das Authentik-Konto wurde neu aufgesetzt, oder es wurde
 * versehentlich mit dem falschen verbunden.
 *
 * **Die eine Schranke, und sie ist keine Formalie.** Ein Konto kennt genau zwei
 * Wege herein: das Kennwort und die Kennung. Wer die Kennung eines Kontos löst,
 * das kein Kennwort hat, macht es **unerreichbar** — nicht gesperrt, sondern
 * tot, und niemand sieht warum. In der Kontenliste tragen genau solche Konten
 * die Marke «nur zentrale Anmeldung»; der Weg dorthin ist ausdrücklich
 * vorgesehen (`docs/dienste.md`: «Ein reines Authentik-Konto braucht kein
 * Kennwort»), und deshalb ist der Fall keine Ausnahme, sondern zu erwarten.
 *
 * Ausserdienststellen bleibt der richtige Weg, wenn jemand nicht mehr herein
 * soll: Es ist umkehrbar und sagt, was es tut.
 */
export function darfVerknuepfungLoesen(lage: {
	hatKennung: boolean;
	hatKennwort: boolean;
	/** Steht das Konto ausser Dienst? */
	ausserDienst: boolean;
}): Loesungsausgang {
	if (!lage.hatKennung) return { erlaubt: false, hindernis: 'nicht_verknuepft' };

	/*
	 * **Ausser Dienst hebt die Schranke auf** (Code-Review 16.09.2026).
	 *
	 * Die Schranke schützt davor, ein **lebendes** Konto unerreichbar zu machen.
	 * Ein Konto ausser Dienst ist bereits unerreichbar; dort schützt sie nichts
	 * mehr und richtet Schaden an: Die Kennung bliebe für immer an einer toten
	 * Zeile hängen, und weil `app_user_oidc_subject_idx` über alle Betreiber
	 * eindeutig ist, bekäme dieser Mensch nie wieder ein verknüpftes Konto.
	 *
	 * Bitter ist der Weg dorthin: Die Absage «kein Kennwort hinterlegt» empfiehlt
	 * selbst das Ausserdienststellen — und wer ihr folgte, sass danach in der
	 * Sackgasse, die sie vermeiden sollte.
	 */
	if (!lage.hatKennwort && !lage.ausserDienst) {
		return { erlaubt: false, hindernis: 'ohne_kennwort' };
	}
	return { erlaubt: true };
}
