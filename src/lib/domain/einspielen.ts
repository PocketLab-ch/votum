/**
 * Ein anderswo geführtes Abschlusspaket hier aufnehmen — rein (PRD §13).
 *
 * **Der Fall:** Die Versammlung lief auf dem Notebook im Saal, ohne Netz. Sie
 * ist dort geschlossen und versiegelt worden. Danach soll sie auf den Server —
 * in dieselbe Historie wie alle anderen, damit ein Jahr später niemand raten
 * muss, wo die vom letzten Mai liegt.
 *
 * **Aufgenommen wird das Paket, nicht sein Inhalt.** Die Zeilen nachzubauen
 * hiesse, neben dem Nachweis eine zweite Fassung zu führen, die ab dem ersten
 * Tag auseinanderlaufen kann. Das Siegel gilt für das Paket; also ist das Paket
 * das, was aufbewahrt wird. Was darin steht, wird beim Anzeigen daraus gelesen.
 *
 * Hier steht allein die Frage, **ob** aufgenommen werden darf. Sie hat mehrere
 * Nein-Gründe, und jeder braucht seinen eigenen Satz: «geht nicht» sagt der
 * einspielenden Person nicht, ob sie das falsche Paket, die falsche Anwendung
 * oder einen echten Fehler vor sich hat.
 */

/** Was über das Paket bekannt ist, nachdem es geprüft wurde. */
export interface Einspiellage {
	/** Hat das Archiv überhaupt ein lesbares Manifest? */
	manifestGelesen: boolean;
	/** Stimmen die Prüfsummen der Bestandteile gegen das Manifest? */
	inhaltUnveraendert: boolean;
	/**
	 * Ist die Gemeinschaft des Manifests hier bekannt?
	 *
	 * Verglichen wird über den **Namen**, weil das Manifest die Gemeinschaft mit
	 * ihrem Namen führt und keine Kennung mitgibt. Das ist die schwächste Stelle
	 * der Kette — deshalb wird der Name nicht geraten, sondern die Person wählt
	 * die Gemeinschaft und die Anwendung sagt, ob er dazu passt.
	 */
	gemeinschaftGewaehlt: boolean;
	nameStimmtUeberein: boolean;
	/** Läuft diese Versammlung hier bereits als eigene (gleiche Kennung)? */
	laeuftHier: boolean;
	/** Ist dieses Paket hier schon einmal aufgenommen worden? */
	schonEingespielt: boolean;
}

export type Einspielhindernis =
	| 'kein_manifest'
	| 'inhalt_veraendert'
	| 'keine_gemeinschaft'
	| 'name_weicht_ab'
	| 'laeuft_hier'
	| 'schon_eingespielt';

export interface Einspielbefund {
	moeglich: boolean;
	hindernis: Einspielhindernis | null;
	/** Was zu tun ist — nie bloss, was nicht geht. */
	satz: string;
}

export function pruefeEinspielbar(lage: Einspiellage): Einspielbefund {
	if (!lage.manifestGelesen) {
		return {
			moeglich: false,
			hindernis: 'kein_manifest',
			satz:
				'Das Archiv enthält kein lesbares Inhaltsverzeichnis. Es ist kein Abschlusspaket dieser ' +
				'Anwendung — prüfen Sie, ob Sie die richtige Datei gewählt haben.'
		};
	}

	if (!lage.inhaltUnveraendert) {
		return {
			moeglich: false,
			hindernis: 'inhalt_veraendert',
			satz:
				'Der Inhalt des Pakets stimmt nicht mit seinem Inhaltsverzeichnis überein. Ein verändertes ' +
				'Paket wird nicht aufgenommen; sonst stünde hier ein Nachweis, der keiner ist. ' +
				'Holen Sie das Paket noch einmal vom Gerät, auf dem die Versammlung lief.'
		};
	}

	if (!lage.gemeinschaftGewaehlt) {
		return {
			moeglich: false,
			hindernis: 'keine_gemeinschaft',
			satz: 'Wählen Sie, zu welcher Gemeinschaft diese Versammlung gehört.'
		};
	}

	/*
	 * **Der Name muss passen, und zwar bevor geschrieben wird.** Eine Versammlung
	 * unter der falschen Gemeinschaft abzulegen fiele erst auf, wenn jemand die
	 * Beschlüsse der einen im Verzeichnis der anderen sucht — und dann steht sie
	 * dort unveränderlich.
	 */
	if (!lage.nameStimmtUeberein) {
		return {
			moeglich: false,
			hindernis: 'name_weicht_ab',
			satz:
				'Das Paket nennt eine andere Gemeinschaft als die gewählte. Wählen Sie die, die im ' +
				'Paket steht — heisst dieselbe Gemeinschaft hier anders, ist zuerst der Name zu ' +
				'berichtigen, nicht die Zuordnung.'
		};
	}

	/*
	 * **Läuft sie hier schon, gehört sie nicht eingespielt.** Sonst stünde
	 * dieselbe Versammlung zweimal in der Historie: einmal als offene Fassung
	 * dieses Servers und einmal als versiegeltes Paket von aussen. Welche gilt,
	 * liesse sich danach nicht mehr sagen.
	 */
	if (lage.laeuftHier) {
		return {
			moeglich: false,
			hindernis: 'laeuft_hier',
			satz:
				'Diese Versammlung wird hier bereits geführt. Ein Paket derselben Versammlung ' +
				'daneben aufzunehmen ergäbe zwei Fassungen, von denen keine die andere aufhebt. ' +
				'Prüfen Sie das Paket über die Prüfseite, statt es einzuspielen.'
		};
	}

	if (lage.schonEingespielt) {
		return {
			moeglich: false,
			hindernis: 'schon_eingespielt',
			satz: 'Dieses Paket ist hier bereits aufgenommen. Es steht in der Historie der Gemeinschaft.'
		};
	}

	return {
		moeglich: true,
		hindernis: null,
		satz:
			'Das Paket ist unverändert und gehört zu dieser Gemeinschaft. Aufgenommen wird es als ' +
			'Ganzes — unveränderlich, wie es ist.'
	};
}

/** Ein Beschluss, so wie er aus dem Paket gelesen wird. */
export interface EingespielterBeschluss {
	nummer: string;
	titel: string;
	antragswortlaut: string | null;
	/** Der Ergebnissatz, wie er im Paket steht. Null, wo nicht abgestimmt wurde. */
	satz: string | null;
	erfordernis: string | null;
	rechtsgrundlage: string | null;
}

/**
 * Die Beschlüsse aus den beiden Datendateien des Pakets zusammenführen.
 *
 * **Gelesen, nicht kopiert.** Diese Funktion läuft bei jeder Anzeige neu über
 * den Paketinhalt. Das ist der Punkt: Was gezeigt wird, ist immer das, was im
 * gesiegelten Paket steht, und kann sich von ihm nicht entfernen.
 *
 * Beides sind Fremddaten — geschrieben von einer anderen Fassung dieser
 * Anwendung, vielleicht einer älteren. Deshalb wird jedes Feld einzeln geprüft
 * und Fehlendes als `null` geführt, statt auf eine Gestalt zu vertrauen.
 */
export function beschluesseAus(
	/** Inhalt von `daten/abstimmungen.json` — dort steht die fertige Auswertung. */
	abstimmungen: unknown,
	/** Inhalt von `daten/traktanden.json` — nur für den Antragswortlaut. */
	traktanden: unknown
): EingespielterBeschluss[] {
	const text = (w: unknown): string | null => (typeof w === 'string' && w.trim() ? w : null);

	/*
	 * **Die Auswertung führt, nicht die Traktandenliste.** Sie ist dieselbe
	 * Liste, die im Paket auch als PDF liegt — Nummer, Titel, Erfordernis und
	 * Ergebnissatz stehen dort bereits nebeneinander. Aus den Traktanden kommt
	 * nur der Antragswortlaut dazu, den die Auswertung nicht führt.
	 */
	const wurzel = abstimmungen && typeof abstimmungen === 'object'
		? (abstimmungen as Record<string, unknown>)
		: {};
	const auswertung = wurzel.auswertung && typeof wurzel.auswertung === 'object'
		? (wurzel.auswertung as Record<string, unknown>)
		: null;
	const zeilen = Array.isArray(auswertung?.zeilen) ? auswertung.zeilen : [];

	const wortlautJeNummer = new Map<string, string>();
	if (Array.isArray(traktanden)) {
		for (const t of traktanden) {
			if (!t || typeof t !== 'object') continue;
			const eintrag = t as Record<string, unknown>;
			const nummer = text(eintrag.nummer);
			const knoten = eintrag.knoten && typeof eintrag.knoten === 'object'
				? (eintrag.knoten as Record<string, unknown>)
				: null;
			const wortlaut = knoten ? text(knoten.antragswortlaut) : null;
			if (nummer && wortlaut) wortlautJeNummer.set(nummer, wortlaut);
		}
	}

	const beschluesse: EingespielterBeschluss[] = [];
	for (const z of zeilen) {
		if (!z || typeof z !== 'object') continue;
		const zeile = z as Record<string, unknown>;
		const titel = text(zeile.titel);
		if (!titel) continue;
		const nummer = text(zeile.nummer) ?? '';
		beschluesse.push({
			nummer,
			titel,
			antragswortlaut: wortlautJeNummer.get(nummer) ?? null,
			satz: text(zeile.satz),
			erfordernis: text(zeile.erfordernis),
			rechtsgrundlage: text(zeile.rechtsgrundlage)
		});
	}
	return beschluesse;
}
