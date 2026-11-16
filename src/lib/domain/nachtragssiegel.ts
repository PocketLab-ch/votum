/**
 * Das Nachtragssiegel je Protokollfassung (Ä-39, Auftrag H8, Teil B) — rein.
 *
 * **Worum es geht.** Das Siegel des Abschlusspakets deckt das Protokoll
 * ausdrücklich nicht (PRD §4.11): Es entsteht nach der Sitzung, wird
 * redigiert und von der nächsten Versammlung genehmigt. Was die Eigentümer
 * dann bekommen, ist eine festgehaltene Fassung (FR-50). Damit sich später
 * zeigen lässt, dass genau diese Fassung nach dem Siegel entstand und seither
 * unverändert ist, bekommt jede Fassung, die **nach** dem Siegel festgehalten
 * wird, ein eigenes Siegel. Es verweist auf das vorige: auf das Siegel des
 * Abschlusspakets oder auf das Nachtragssiegel der vorigen Fassung. So
 * entsteht eine Kette, in der keine Fassung unbemerkt herausgenommen,
 * ausgetauscht oder umgestellt werden kann.
 *
 * **Dieselbe Bauart wie das erste Siegel** (`domain/siegel.ts`): Ein Manifest
 * führt den Bestandteil mit seiner Prüfsumme, die Prüfsumme über das Manifest
 * ist das Siegel. Deshalb prüft `pruefe()` aus `domain/siegel.ts` auch dieses
 * Paket, und das Prüfwerkzeug braucht für den Inhalt keinen zweiten Weg.
 *
 * **Was es nicht leistet.** Es trägt keinen Zeitstempel einer unabhängigen
 * Stelle. Die Reihenfolge belegt es, den Zeitpunkt nicht: Wer die Datenbank
 * beherrscht, könnte die Kette nach dem ersten Siegel neu rechnen. Den Zeitpunkt
 * bezeugt das erste Siegel mit seinem Stempel; dass eine Fassung so
 * hinausging, bezeugen die Kopien bei den Empfängern und der Beschluss, der
 * sie genehmigt (`holeFassungsabdruck`).
 *
 * Hier steht die Form und die Prüfung; das Rechnen der Prüfsummen liegt in der
 * Schale (AD-1).
 */
import type { Manifest, Manifesteintrag } from './siegel';

export interface Nachtragsmanifest {
	fassung: 1;
	/** Unterscheidet dieses Manifest von dem des Abschlusspakets. */
	art: 'nachtragssiegel';
	gemeinschaft: string;
	versammlung: Manifest['versammlung'];
	/** Das Siegel des Abschlusspakets, auf dem die ganze Kette steht. */
	grundsiegel: string;
	/** Das unmittelbar vorige Glied der Kette. */
	vorgaenger: {
		siegel: string;
		was: 'abschlusspaket' | 'protokollfassung';
		/** Die Nummer der vorigen Fassung; `null` beim Abschlusspaket. */
		nummer: number | null;
	};
	protokollfassung: {
		nummer: number;
		art: string;
		bemerkung: string | null;
		festgehaltenAm: string;
		festgehaltenDurch: string;
	};
	zeitquelle: string;
	/** Genau ein Eintrag: der Wortlaut der Fassung. */
	eintraege: Manifesteintrag[];
}

/** Der Name des Wortlauts im Paket. */
export function fassungsdatei(nummer: number): string {
	return `protokoll-fassung-${nummer}.txt`;
}

/**
 * Das Manifest als Zeichenkette, über die das Siegel gebildet wird.
 *
 * Gespeichert wird genau diese Zeichenkette; geprüft wird immer über die
 * gespeicherte, nie über eine neu erzeugte. Die Reihenfolge der Schlüssel
 * ist damit nur beim Erzeugen eine Frage.
 */
export function nachtragsmanifestAlsJson(m: Nachtragsmanifest): string {
	return JSON.stringify(m, null, 2);
}

/** Ob ein gelesenes Manifest eines Nachtragssiegels ist. */
export function istNachtragsmanifest(m: unknown): m is Nachtragsmanifest {
	return (
		typeof m === 'object' &&
		m !== null &&
		(m as { art?: unknown }).art === 'nachtragssiegel' &&
		Array.isArray((m as { eintraege?: unknown }).eintraege)
	);
}

/**
 * Das Manifest in Worten, für `MANIFEST.txt` im Paket einer Fassung.
 *
 * Wie beim Abschlusspaket: Wer im Streitfall danach greift, soll ohne
 * Rückfrage prüfen können, und zwar beides, die Fassung und ihren Platz in
 * der Kette.
 */
export function nachtragsmanifestInWorten(m: Nachtragsmanifest, siegel: string): string {
	const z: string[] = [];
	const datei = m.eintraege[0];
	z.push('PROTOKOLLFASSUNG MIT NACHTRAGSSIEGEL');
	z.push('='.repeat(56));
	z.push('');
	z.push(`Gemeinschaft:   ${m.gemeinschaft}`);
	z.push(`Versammlung:    ${m.versammlung.datum}, ${m.versammlung.uhrzeit} Uhr, ${m.versammlung.ort}`);
	z.push(`Fassung:        Nr. ${m.protokollfassung.nummer}, ${m.protokollfassung.art}`);
	z.push(`Festgehalten:   ${m.protokollfassung.festgehaltenAm} durch ${m.protokollfassung.festgehaltenDurch}`);
	if (m.protokollfassung.bemerkung) z.push(`Bemerkung:      ${m.protokollfassung.bemerkung}`);
	z.push(`Zeitquelle:     ${m.zeitquelle}`);
	z.push('');
	z.push('WAS DIESES PAKET IST');
	z.push('-'.repeat(56));
	z.push('Es enthält den Wortlaut einer Protokollfassung, die nach dem Versiegeln der');
	z.push('Versammlung festgehalten wurde. Das Siegel des Abschlusspakets deckt das');
	z.push('Protokoll nicht; diese Fassung trägt deshalb ein eigenes Siegel. Es verweist');
	z.push('auf das vorige Siegel, sodass alle Fassungen eine Kette bilden.');
	z.push('');
	z.push('WIE SIE ES PRÜFEN');
	z.push('-'.repeat(56));
	z.push(`1. Bilden Sie die SHA-256-Prüfsumme über «${datei?.pfad ?? ''}».`);
	z.push('   Sie muss lauten:');
	z.push(`   ${datei?.pruefsumme ?? ''}`);
	z.push('   Unter Linux/macOS:  sha256sum <datei>');
	z.push('   Unter Windows:      certutil -hashfile <datei> SHA256');
	z.push('2. Bilden Sie die Prüfsumme über «manifest.json». Das ist das Nachtragssiegel:');
	z.push(`   ${siegel}`);
	z.push('3. Das vorige Siegel, auf das diese Fassung verweist:');
	z.push(`   ${m.vorgaenger.siegel}`);
	z.push(
		m.vorgaenger.was === 'abschlusspaket'
			? '   Es ist das Siegel des Abschlusspakets dieser Versammlung.'
			: `   Es ist das Nachtragssiegel der Fassung Nr. ${m.vorgaenger.nummer}.`
	);
	z.push('   Das Siegel des Abschlusspakets lautet:');
	z.push(`   ${m.grundsiegel}`);
	z.push('');
	z.push('Weicht eine Angabe ab, wurde die Fassung nach dem Festhalten verändert, oder');
	z.push('sie gehört nicht an diese Stelle der Kette.');
	z.push('');
	z.push('WAS DIESES SIEGEL NICHT BELEGT');
	z.push('-'.repeat(56));
	z.push('Es trägt keinen Zeitstempel einer unabhängigen Stelle. Den Zeitpunkt des');
	z.push('Versiegelns bezeugt der Zeitstempel des Abschlusspakets, nicht dieses Siegel.');
	z.push('Wer die Datenbank der Anwendung beherrscht, könnte die Kette nach dem ersten');
	z.push('Siegel neu rechnen. Beweiskraft hat dieses Paket deshalb vor allem in der Hand');
	z.push('derer, die es erhalten und aufbewahrt haben. Eine neu gerechnete Kette ergäbe');
	z.push('ein anderes Nachtragssiegel als das hier genannte.');
	z.push('');
	return z.join('\n');
}

// ── Die Kette prüfen ────────────────────────────────────────────────────────

/** Ein Glied, wie es in der Datenbank steht, mit den in der Schale gerechneten Prüfsummen. */
export interface Kettenglied {
	nummer: number;
	/** SHA-256 über den gespeicherten Wortlaut. */
	textPruefsumme: string;
	/** Das gespeicherte Manifest, gelesen; `null`, wenn es sich nicht lesen lässt. */
	manifest: Nachtragsmanifest | null;
	/** SHA-256 über das gespeicherte Manifest. */
	manifestPruefsumme: string;
	/** Das gespeicherte Nachtragssiegel. */
	siegel: string;
	/** Der gespeicherte Verweis auf das vorige Siegel. */
	vorgaenger: string;
}

export interface Kettenbefund {
	haelt: boolean;
	/** Stimmt das Siegel des Abschlusspakets mit seinem Manifest? */
	grundsiegelHaelt: boolean;
	glieder: { nummer: number; haelt: boolean; maengel: string[] }[];
	satz: string;
}

/**
 * Rechnet die Kette nach: das erste Siegel und jedes Glied danach.
 *
 * Je Glied getrennte Aussagen, wie beim Abschlusspaket (FR-54): Ein einziges
 * «stimmt nicht» hilft im Streitfall niemandem, die Frage ist, **was** nicht
 * stimmt und **ab welcher Fassung**.
 */
export function pruefeKette(
	grund: { siegel: string; manifestPruefsumme: string },
	glieder: readonly Kettenglied[]
): Kettenbefund {
	const grundsiegelHaelt = grund.manifestPruefsumme === grund.siegel;
	const ergebnis: Kettenbefund['glieder'] = [];
	let vorher = grund.siegel;
	let vorherNummer: number | null = null;

	for (const g of [...glieder].sort((a, b) => a.nummer - b.nummer)) {
		const maengel: string[] = [];
		if (g.manifestPruefsumme !== g.siegel) {
			maengel.push('das Manifest wurde nach dem Festhalten verändert');
		}
		const m = g.manifest;
		if (!m) {
			maengel.push('das Manifest lässt sich nicht lesen');
		} else {
			if (
				m.eintraege.length !== 1 ||
				m.eintraege[0].pfad !== fassungsdatei(g.nummer) ||
				m.eintraege[0].pruefsumme !== g.textPruefsumme
			) {
				maengel.push('der Wortlaut weicht von der Prüfsumme im Manifest ab');
			}
			if (m.protokollfassung.nummer !== g.nummer) {
				maengel.push(`das Manifest nennt die Fassung Nr. ${m.protokollfassung.nummer}`);
			}
			if (m.grundsiegel !== grund.siegel) {
				maengel.push('das Manifest nennt ein anderes Siegel des Abschlusspakets');
			}
			if (m.vorgaenger.siegel !== g.vorgaenger) {
				maengel.push('das Manifest nennt einen anderen Vorgänger als die Datenbank');
			}
		}
		if (g.vorgaenger !== vorher) {
			maengel.push(
				vorherNummer === null
					? 'die Fassung verweist nicht auf das Siegel des Abschlusspakets'
					: `die Fassung verweist nicht auf das Nachtragssiegel der Fassung Nr. ${vorherNummer}`
			);
		}
		ergebnis.push({ nummer: g.nummer, haelt: maengel.length === 0, maengel });
		vorher = g.siegel;
		vorherNummer = g.nummer;
	}

	const gebrochen = ergebnis.filter((g) => !g.haelt);
	const haelt = grundsiegelHaelt && gebrochen.length === 0;
	let satz: string;
	if (haelt) {
		satz =
			ergebnis.length === 0
				? 'Das Siegel des Abschlusspakets hält. Nach ihm wurde keine Protokollfassung festgehalten.'
				: `Die Kette hält: das Siegel des Abschlusspakets und ${ergebnis.length === 1 ? 'das Nachtragssiegel einer Fassung' : `die Nachtragssiegel von ${ergebnis.length} Fassungen`}.`;
	} else {
		const teile: string[] = [];
		if (!grundsiegelHaelt) teile.push('das Manifest des Abschlusspakets stimmt nicht mit seinem Siegel überein');
		for (const g of gebrochen) teile.push(`Fassung Nr. ${g.nummer}: ${g.maengel.join(', ')}`);
		satz = `Die Kette hält nicht. ${teile.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join('. ')}.`;
	}
	return { haelt, grundsiegelHaelt, glieder: ergebnis, satz };
}
