/**
 * Mitberechtigte an gemeinschaftlichem Eigentum (ZGB Art. 712o Abs. 1).
 *
 * Reine Regeln ohne Datenbank, Uhr und Zufall (AD-1). Die Frage, die sie
 * beantworten: Ist das eine gültige gemeinschaftliche Zeile — und wie heisst
 * sie?
 */
import { FachlicherFehler } from './fehler';

/**
 * Der Name, unter dem die Hülle in Listen und auf der Urkunde erscheint.
 *
 * **Nicht «Anna Muster, Beat Muster».** Eine Aufzählung mit Komma liest sich
 * wie zwei Zeilen, die versehentlich zusammengerutscht sind. «und» sagt, dass
 * es eine ist.
 */
export function sammelname(namen: string[]): string {
	const sauber = namen.map((n) => n.trim()).filter((n) => n.length > 0);
	if (sauber.length <= 1) return sauber[0] ?? '';
	return `${sauber.slice(0, -1).join(', ')} und ${sauber[sauber.length - 1]}`;
}

/**
 * Die Form, in der zwei Namen als «derselbe» gelten.
 *
 * Nur Leerraum wird vereinheitlicht, sonst nichts. Gross- und Kleinschreibung
 * bleibt unterschieden: «de Boer» und «De Boer» sind zwei Schreibweisen, über
 * die nicht die Anwendung zu entscheiden hat.
 *
 * **Ausgeführt seit dem 27.08.2026** (Aufgabe 6): Die Übernahme vergleicht die
 * Namen aus der Datei mit den erfassten Mitberechtigten und braucht dafür
 * dieselbe Form. Stünde dort eine zweite Fassung, entschiede sie irgendwann
 * anders als diese — und «Anna  Muster» mit zwei Leerzeichen wäre einmal
 * dieselbe Person und einmal nicht.
 */
export function vergleichsform(name: string): string {
	return name.trim().replace(/\s+/g, ' ');
}

/**
 * Prüft eine gemeinschaftliche Zeile, bevor sie entsteht.
 *
 * Die Datenbank hält dieselben Zusagen (Migration 094) — hier stehen sie
 * nochmals, weil eine Absage im Formular einen Satz braucht und keine
 * Schrankenmeldung.
 */
export function pruefeMitberechtigte(namen: string[], vertreter: string | null): void {
	const sauber = namen.map((n) => n.trim()).filter((n) => n.length > 0);

	if (sauber.length < 2) {
		/*
		 * **Der Satz nennt beide Auswege** (26.08.2026 ergänzt). Ohne geladenes
		 * Skript erscheint die Personenliste beim Ankreuzen noch nicht — sie steht
		 * erst nach dieser Absage da, weil der Haken dann vom Server kommt. Wer
		 * hier nur «nehmen Sie den Haken weg» läse, nähme ihn weg und käme nie zu
		 * der Liste, die inzwischen unter der Meldung steht.
		 */
		throw new FachlicherFehler(
			'zu_wenige_mitberechtigte',
			'Gemeinschaftliches Eigentum braucht mindestens zwei Personen. Tragen Sie sie unten ein — oder nehmen Sie den Haken weg, wenn die Einheit einer einzigen Person gehört.',
			'mitberechtigte'
		);
	}

	/*
	 * **Zweimal derselbe Name — abgewiesen** (Produktentscheid 26.08.2026).
	 *
	 * Der Sammelname lautete sonst «Anna Muster und Anna Muster», und
	 * `representative_name` benennt nicht mehr eindeutig, wer stimmt. Dieser Name
	 * wird von der Momentaufnahme eingefroren und steht auf der
	 * Unterschriftenliste, dem Stimmzettel und der Versandliste des Pakets — im
	 * Anfechtungsfall liegen sie als Urkunde auf dem Tisch.
	 *
	 * **Nicht mehr auf der Zugangskarte** (27.08.2026): Sie druckt seit dem
	 * Umbau des Versands keinen Vertreternamen mehr, und alle Mitberechtigten
	 * bekommen dieselbe Karte. Am Einlass entscheidet die Karte, nicht der
	 * gedruckte Name.
	 *
	 * **Zwei Menschen dürfen gleich heissen**; die Anwendung braucht nur einen
	 * unterscheidbaren Eintrag. Die Absage nennt den Ausweg deshalb ausdrücklich,
	 * statt bloss «nicht erlaubt» zu sagen.
	 *
	 * Verglichen wird über `vergleichsform`: Zwei Leerzeichen zwischen Vor- und
	 * Nachnamen sind keine Unterscheidung, sondern ein Tippfehler — auf dem
	 * Bildschirm stünde zweimal dasselbe.
	 */
	const gesehen = new Set<string>();
	for (const name of sauber) {
		const form = vergleichsform(name);
		if (gesehen.has(form)) {
			throw new FachlicherFehler(
				'name_doppelt',
				`«${name}» steht zweimal in dieser Liste. Ergänzen Sie einen der beiden unterscheidbar — etwa «${name}-Berger» oder «${name} (1965)».`,
				'mitberechtigte'
			);
		}
		gesehen.add(form);
	}

	/*
	 * **Die Bezeichnung der Vertretung ist freiwillig** (Produktentscheid
	 * 27.08.2026). Bis hierher stand hier eine Absage `vertreter_fehlt`.
	 *
	 * **Rechtlich:** Ist nur einer der Mitberechtigten anwesend, darf die
	 * Sitzungsleitung annehmen, dass er die Gemeinschaft gültig vertritt, und
	 * zwar ohne Vollmacht (Wermelinger, Rz. 19 ad Art. 712o). Die Bezeichnung im
	 * Voraus ist eine Klarstellung, keine Voraussetzung.
	 *
	 * **Praktisch:** Am Einlass entscheidet der Zugangscode, nicht der gedruckte
	 * Name. Eine Pflicht zwänge die Bewirtschaftung, etwas zu erfinden, wenn sie
	 * es nicht weiss — und ein erfundener Eintrag sieht aus wie eine getroffene
	 * Ordnung.
	 *
	 * **Was bleibt:** Ist jemand bezeichnet, muss es eine der beteiligten
	 * Personen sein. Die Prüfung darunter ist deshalb geblieben. Sie folgt nicht
	 * aus dem Wortlaut von ZGB Art. 712o Abs. 1: «durch einen Vertreter» verbietet
	 * nur, die eine Stimme aufzuteilen (Wermelinger, Rz. 11 ad Art. 712o). Sie
	 * hält die Bezeichnung auf den Fall, der ohne Vollmacht trägt (Rz. 19). Eine
	 * Drittperson vertritt über eine Vollmacht mit Nachweis.
	 */
	const wer = (vertreter ?? '').trim();
	if (wer.length === 0) return;

	if (!sauber.includes(wer)) {
		throw new FachlicherFehler(
			'vertreter_kein_mitberechtigter',
			`«${wer}» gehört nicht zu den Mitberechtigten. Als Vertretung lässt sich hier nur eine von ihnen eintragen; eine Drittperson vertritt über eine Vollmacht.`,
			'vertreter'
		);
	}
}

/**
 * Was der Empfängerkreis von einer mitberechtigten Person wissen muss.
 *
 * **Eine eigene Form, nicht die des Servers.** `Mitberechtigter` aus
 * `$lib/server/mitberechtigte` trägt mehr (Telefon, Archivdatum); der Kern darf
 * die Schale nicht einbinden (`check:schichten`). Was hier steht, ist die
 * Teilmenge, an der die Entscheidung hängt — und jede Zeile von dort passt
 * darauf.
 */
export interface Empfangsberechtigter {
	partyId: string;
	displayName: string;
	email: string | null;
	address: string | null;
	istZustelladresse: boolean;
	istVertreter: boolean;
	/** Seit wann die Zeile im Archiv liegt, sonst `null` (Migration 086). */
	archiviertAm: string | null;
}

/**
 * An wen zuzustellen ist — **vor** der Frage, ob eine Adresse vorliegt.
 *
 * **Regel: alle.** Jeder Mitberechtigte ist Stockwerkeigentümer und damit
 * teilnahmeberechtigt; gebündelt ist nur die Stimme, nicht die Einladung
 * (Wermelinger, Rz. 50 ad Art. 712n).
 *
 * **Ausnahme: eine gemeldete Zustelladresse.** Ist eine bestimmt und dem
 * Verwalter gemeldet, genügt die Zustellung dorthin (Rz. 49, 51).
 *
 * **Wozu getrennt von `empfaengerkreis`.** Der Kreis fällt hier heraus, bevor
 * nach der Adresse gefiltert wird. Die Versandliste im Paket nennt deshalb auch
 * die Person, bei der keine Adresse erfasst ist — sonst verschwände sie
 * zwischen zwei Filterschritten, und niemand käme auf die Idee, ihre Adresse
 * nachzutragen. Eine unterbliebene Einladung führt zur Anfechtbarkeit
 * (Art. 75 ZGB).
 *
 * **Wer im Archiv liegt, bekommt keine Post** (27.08.2026, aus dem zweiten
 * Code-Review). `holeMitberechtigteJeHuelle` liefert archivierte Zeilen
 * ausdrücklich mit und überlässt die Entscheidung dem Aufrufer — hier wird sie
 * getroffen, und zwar einmal für alle Aufrufer statt an jeder Verwendungsstelle
 * neu. Eine Mitgliedszeile hält keine Einheit und lässt sich deshalb jederzeit
 * archivieren (`pruefeEigentuemerArchivierbar`); wer seinen Anteil verkauft
 * hat, gehört nicht mehr eingeladen.
 *
 * **Die Reihenfolge ist Absicht: erst das Archiv, dann die Meldung.** Liegt die
 * gemeldete Zustelladresse selbst im Archiv, fällt der Kreis auf «alle
 * einzeln» zurück — die überzählige Einladung ist die ungefährliche Richtung,
 * die ausgelassene nicht.
 */
export function zustellkreis(mitberechtigte: Empfangsberechtigter[]): Empfangsberechtigter[] {
	const heutige = mitberechtigte.filter((m) => !m.archiviertAm);
	const gemeldet = heutige.find((m) => m.istZustelladresse);
	return gemeldet ? [gemeldet] : heutige;
}

/**
 * Wer die Einladung bekommt, und an welcher Adresse (ZGB Art. 712n).
 *
 * **Regel: alle einzeln.** Jeder Mitberechtigte ist Stockwerkeigentümer und
 * damit teilnahmeberechtigt; gebündelt ist nur die Stimme, nicht die Einladung
 * (Wermelinger, Rz. 50 ad Art. 712n).
 *
 * **Ausnahme: eine gemeldete Zustelladresse.** Ist eine bestimmt und dem
 * Verwalter gemeldet, genügt die Zustellung dorthin (Rz. 49, 51). Der Kommentar
 * empfiehlt eine Kopie an die übrigen — die Anwendung erzwingt sie nicht, weil
 * die Meldung genau den Zweck hat, den Versand zu bündeln.
 *
 * **Rückfall auf die Hülle**, wo keine Person des Kreises eine Adresse trägt.
 * Das ist **kein Übergang, sondern Dauerzustand** (Produktentscheid 26.08.2026):
 * Die vor Migration 094 erfassten gemeinschaftlichen Zeilen werden nicht
 * aufgeteilt. Sie tragen einen Sammelnamen als Text, eine Adresse und keine
 * Mitberechtigten — und funktionieren weiter wie bisher: eine Stimme, eine
 * Adresse. Die Einladung geht dann dorthin, wo sie vor diesem Umbau auch
 * hingegangen wäre — schlechter als einzeln, besser als nirgendwohin.
 *
 * **Der Rückfall greift auch bei gemeldeter Zustelladresse ohne E-Mail.** Der
 * Kreis bleibt dann auf die eine Person eingeengt und die Einladung geht an die
 * Hülle — nicht an die übrigen. Andernfalls bewirkte die Meldung das Gegenteil
 * dessen, was sie sagt.
 *
 * **`huellenAdresse` ist die Adresse der Zeile selbst, nie eine geborgte.**
 * Bis zum 27.08.2026 borgte sich `erzeugeVersandpaket` die Adresse der
 * vertretenden Person, wenn die Zeile keine eigene trug; dieser Rückfall ist
 * mit dem Umbau des Versands gefallen. Er gehörte hier ohnehin nicht herein:
 * Sonst nennte der Rückfall unter dem Sammelnamen die Privatadresse einer der
 * Beteiligten, und bei gemeldeter Zustelladresse wäre das ausgerechnet die
 * Person, die die Meldung ausschliessen sollte.
 *
 * **Was der Rückfall beim heutigen Aufrufer bewirkt: nichts** (27.08.2026,
 * ausdrücklich festgehalten). `erzeugeVersandpaket` schickt der Zeile ohnehin
 * eine eigene Sendung an genau diese Adresse und überspringt deshalb, was hier
 * darauf zeigt. Seine Aussage ist damit eine **Zusicherung**, keine Handlung:
 * «An diese Adresse ist zuzustellen» — und weil sie bereits bedient wird, ist
 * niemand zusätzlich anzuschreiben. Wer den Kreis anderswo verwendet, bekommt
 * die Aussage, die er braucht, statt einer leeren Liste.
 */
export function empfaengerkreis(
	mitberechtigte: Empfangsberechtigter[],
	huellenAdresse: string | null
): { partyId: string; name: string; adresse: string }[] {
	const kreis = zustellkreis(mitberechtigte);

	const mitAdresse = kreis
		.filter((m) => (m.email ?? '').trim().length > 0)
		.map((m) => ({ partyId: m.partyId, name: m.displayName, adresse: (m.email ?? '').trim() }));

	if (mitAdresse.length > 0) return mitAdresse;

	const rueckfall = (huellenAdresse ?? '').trim();
	if (rueckfall.length === 0) return [];

	/*
	 * **Leere Kennung mit Absicht.** Der Rückfall zeigt auf die Hülle, nicht auf
	 * eine mitberechtigte Person — es gibt keine Partei, der diese Sendung
	 * gehört. Wer die Kennung braucht, nimmt die der Hülle; sie steht dort, wo
	 * der Rückfall gelesen wird.
	 */
	return [
		{
			partyId: '',
			name: sammelname(mitberechtigte.map((m) => m.displayName)),
			adresse: rueckfall
		}
	];
}
