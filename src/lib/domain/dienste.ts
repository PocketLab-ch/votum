/**
 * Was beim Einrichten eines äusseren Dienstes geprüft wird (14.08.2026).
 *
 * Rein rechnend, ohne Netz und ohne Datenbank (AD-1): Dieselben Regeln
 * brauchen das Formular, die Aktion dahinter und der Prüflauf. Stünden sie in
 * der Seite, wären sie beim nächsten zweiten Weg — Einrichten über eine
 * Übernahme etwa — nicht mehr dabei.
 *
 * **Geprüft wird die Form, nicht die Richtigkeit.** Ob unter einer Adresse
 * wirklich ein Modell antwortet, weiss nur ein Anruf; dafür gibt es den
 * Prüfknopf. Hier wird abgewiesen, was sicher nicht gehen kann — und beim
 * Zweifelhaften steht ein Hinweis statt einer Sperre (Gestaltungsregel 8).
 */

import { zeichenzahl } from './zeichenzahl';

/** Ein Fehler, der an ein Feld gehört und nicht an den Seitenkopf. */
export interface Feldfehler {
	feld: string;
	nachricht: string;
}

export const GEDULD_KLEINSTWERT_MS = 1000;
export const GEDULD_HOECHSTWERT_MS = 120_000;

/**
 * Wie lange auf eine Stufe gewartet wird, wenn nichts anderes eingetragen ist.
 *
 * Stand bis zum 17.08.2026 an vier Stellen als getippte `12000`: in `ki.ts` für
 * die Umgebungskette, in der Aktion als Rückfall, im Formular als Vorbelegung
 * und als Vorgabewert der Spalte `ai_stage.patience_ms`. Drei davon lesen
 * jetzt hier; die vierte ist die Datenbank, die keine TypeScript-Konstante
 * einbinden kann — wer den Wert ändert, ändert dort mit (Migration 064).
 */
export const GEDULD_VORGABE_MS = 12_000;

export interface Stufeneingabe {
	name: string;
	url: string;
	modell: string;
	geduldMs: number;
}

/**
 * Prüft eine KI-Stufe.
 *
 * Die Rückgabe trennt **Fehler** (so geht es nicht) von **Hinweisen** (das
 * sieht ungewöhnlich aus, kann aber stimmen). Ein Modell im eigenen Haus läuft
 * auf einer anderen Adressform als ein gemietetes; wer es einträgt, weiss
 * besser als die Anwendung, ob es passt.
 */
export function pruefeStufe(e: Stufeneingabe): { fehler: Feldfehler[]; hinweise: string[] } {
	const fehler: Feldfehler[] = [];
	const hinweise: string[] = [];

	const name = e.name.trim();
	if (zeichenzahl(name) < 2) {
		fehler.push({
			feld: 'name',
			nachricht:
				'Die Bezeichnung braucht mindestens zwei Zeichen. Sie steht später im Nachweis und ' +
				'im Protokollvermerk — schreiben Sie hinein, was ein Leser wissen muss, ' +
				'insbesondere den Standort.'
		});
	}

	const url = e.url.trim();
	if (!/^https?:\/\/\S+$/.test(url)) {
		fehler.push({
			feld: 'url',
			nachricht: 'Die Adresse muss mit http:// oder https:// beginnen.'
		});
	} else {
		// Kein Fehler: Manche Häuser hängen den Pfad anders. Aber der häufigste
		// Einrichtungsfehler ist die Grundadresse ohne Endpunkt, und dann kommt
		// eine 404 zurück, die niemand deuten kann.
		if (!url.includes('/chat/completions')) {
			hinweise.push(
				'Die Adresse endet nicht auf /chat/completions. Gesprochen wird OpenAI-kompatibel; ' +
					'bei den meisten Häusern gehört dieser Pfad dazu. Prüfen Sie die Verbindung, ' +
					'bevor Sie sich darauf verlassen.'
			);
		}
		if (url.startsWith('http://') && !istImEigenenHaus(url)) {
			hinweise.push(
				'Diese Adresse ist unverschlüsselt und zeigt nicht auf diesen Rechner. Der ' +
					'Zugangsschlüssel und die Inhalte gingen im Klartext über das Netz.'
			);
		}
	}

	if (e.modell.trim() === '') {
		fehler.push({ feld: 'modell', nachricht: 'Ohne Modellnamen weiss das Haus nicht, wen es fragen soll.' });
	}

	if (!Number.isFinite(e.geduldMs) || e.geduldMs < GEDULD_KLEINSTWERT_MS || e.geduldMs > GEDULD_HOECHSTWERT_MS) {
		fehler.push({
			feld: 'geduldMs',
			nachricht: `Die Geduld liegt zwischen ${GEDULD_KLEINSTWERT_MS} und ${GEDULD_HOECHSTWERT_MS} Millisekunden.`
		});
	} else if (e.geduldMs > 20_000) {
		// Im Saal zählt die Sekunde. Wer lange wartet, wartet zweimal: erst auf
		// diese Stufe, dann auf die nächste.
		hinweise.push(
			'Mehr als 20 Sekunden Geduld: Fällt diese Stufe aus, wartet die Sitzungsleitung ' +
				'so lange, bevor die nächste überhaupt gefragt wird.'
		);
	}

	return { fehler, hinweise };
}

function istImEigenenHaus(url: string): boolean {
	const host = URL.parse(url)?.hostname ?? '';
	return (
		host === 'localhost' ||
		host === '127.0.0.1' ||
		host === '::1' ||
		host.endsWith('.local') ||
		/^10\./.test(host) ||
		/^192\.168\./.test(host) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(host)
	);
}

/**
 * Bringt einen Fingerabdruck auf die Form, in der Node ihn ausgibt.
 *
 * **Warum das nötig ist.** Verglichen wird gegen `X509Certificate.fingerprint256`,
 * und das ist `AB:CD:…` in Grossbuchstaben. Wer denselben Abdruck ohne
 * Doppelpunkte einträgt — so geben ihn manche Werkzeuge aus —, hätte einen
 * Eintrag, der aussieht wie der richtige und nie passt. Der Zeitstempel gälte
 * dann als «nicht angeheftet», und niemand fände den Grund.
 */
export function normalisiereFingerabdruck(roh: string): string | null {
	const rein = roh.trim().toUpperCase().replace(/[\s:]/g, '');
	if (!/^[0-9A-F]{64}$/.test(rein)) return null;
	return (rein.match(/.{2}/g) ?? []).join(':');
}

export interface Zeitstempeleingabe {
	url: string;
	name: string;
	fingerabdruecke: string;
}

export interface Zeitstempelpruefung {
	fehler: Feldfehler[];
	hinweise: string[];
	/** Die normalisierten Abdrücke — das, was abgelegt werden soll. */
	fingerabdruecke: string[];
}

/**
 * Prüft die Eingabe eines Zeitstempeldienstes, für den Hauptdienst **und**
 * für seinen Ersatz (13.11.2026).
 *
 * **Dieselbe Prüfung für beide.** Was eine Adresse ist und was ein Abdruck ist,
 * hängt nicht daran, welche Rolle ein Dienst spielt. Zwei Fassungen liefen
 * auseinander, und die schwächere wäre die des Ersatzes, also genau die, die
 * im Ausfall einspringt und niemand mehr nachprüft.
 */
export function pruefeZeitstempeleingabe(e: Zeitstempeleingabe): Zeitstempelpruefung {
	const fehler: Feldfehler[] = [];
	const hinweise: string[] = [];

	const url = e.url.trim();
	if (!/^https?:\/\/\S+$/.test(url)) {
		fehler.push({ feld: 'url', nachricht: 'Die Adresse muss mit http:// oder https:// beginnen.' });
	}

	const abdruecke: string[] = [];
	for (const teil of e.fingerabdruecke.split(/[,\n]+/)) {
		if (teil.trim() === '') continue;
		const n = normalisiereFingerabdruck(teil);
		if (n === null) {
			fehler.push({
				feld: 'fingerabdruecke',
				nachricht: `«${teil.trim().slice(0, 40)}» ist kein SHA-256-Fingerabdruck (64 Hexzeichen, Doppelpunkte erlaubt).`
			});
		} else if (!abdruecke.includes(n)) {
			abdruecke.push(n);
		}
	}

	if (fehler.length === 0 && abdruecke.length === 0) {
		// Kein Fehler — ohne Anheftung lässt sich arbeiten, und beim ersten
		// Einrichten kennt man den Abdruck noch gar nicht. Aber es muss dastehen.
		hinweise.push(
			'Ohne angeheftetes Zertifikat wird die Signatur zwar geprüft, aber nicht, wer sie ' +
				'geleistet hat — die Anwendung nähme jede Antwort an, die unter dieser Adresse ' +
				'ausgeliefert wird. Holen Sie einen Prüfzeitstempel und heften Sie den Abdruck an.'
		);
	}

	return { fehler, hinweise, fingerabdruecke: abdruecke };
}

/**
 * Das Ergebnis einer Zeitstempelprobe — steht hier, weil beide Seiten es
 * brauchen: die Schale, die sie holt, und die Seite, die sie anzeigt.
 */
export interface Zeitstempelprobe {
	/** Welcher Dienst gefragt wurde (13.11.2026). Die Maske zeigt zwei Kästen. */
	art: 'haupt' | 'ersatz';
	ok: boolean;
	bemerkung: string;
	/** Der Abdruck des Unterzeichners — genau das, was angeheftet gehört. */
	fingerabdruck: string | null;
	/** Ob er bereits angeheftet ist. */
	angeheftet: boolean | null;
	zeitpunkt: string | null;
	/**
	 * Der Stempel ist geprüft, allein die Anheftung fehlt (13.11.2026).
	 *
	 * Dann ist `ok` wahr und `fingerabdruck` gesetzt, obwohl der Dienst als
	 * Ganzes nicht durchkommt. Die Maske bietet das Anheften an und sagt,
	 * dass es nur nach eigener Prüfung des Ausstellers geschehen soll.
	 */
	nurAnheftungFehlt: boolean;
	/** Wer unterzeichnet hat; bei fehlender Anheftung der neue Aussteller. */
	aussteller: string | null;
	/** Gültigkeit des Ausstellerzertifikats, als Datum. Nur bei fehlender Anheftung gefüllt. */
	ausstellerGueltigVon: string | null;
	ausstellerGueltigBis: string | null;
}
