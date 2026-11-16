/**
 * Die Einberufungsfrist und was aus ihr folgt (Praxisdurchlauf 28.08.2026).
 *
 * **Der Anlass** (Auftraggeber): «Es braucht dann noch einen Reminder-Mail, der einen
 * Werktag vor Ablauf der Versandfrist eine Erinnerungsmail schickt, sollte die
 * Einladung noch nicht versendet worden sein.» Dafür muss die Anwendung zuerst
 * wissen, wann diese Frist abläuft — und das weiss sie bis heute nicht.
 *
 * **Das ZGB nennt keine Frist.** Art. 712n Abs. 1 verlangt eine Einberufung
 * durch den Verwalter, nicht einen Vorlauf in Tagen. Der steht im Reglement,
 * und dort steht je Haus etwas anderes. Deshalb rechnet dieses Modul nur, wo
 * eine Zahl hinterlegt ist, und sagt sonst genau das.
 *
 * **Die Frist läuft rückwärts vom Versammlungstag.** «Dreissig Tage» heisst:
 * Am dreissigsten Tag vor der Versammlung soll die Einladung bei allen sein.
 * Dieser Tag heisst im Code Versandfrist (`versandfrist`); er ist der letzte
 * zulässige Tag, nicht der erste unzulässige.
 *
 * **Bis zum Empfang ist die Regel der Anwendung, nicht die Rechtslage**
 * (Produktentscheid 06.10.2026, «Als Regel der Anwendung», auf Fachprüfung
 * Runde 3; Rz. 23, 24, 30 ad Art. 712n). Sie rechnet vorsichtig damit, dass
 * die Einladung an diesem Tag bei allen ist. Rechnet ein Reglement ab
 * Versand, genügt nach ihm eine rechtzeitig verschickte Einladung; die Texte
 * sagen das, und die Folge «kann angefochten werden» nur für den Fall, dass
 * sie nach der Regel des Reglements zu spät ist.
 * Seit dem 06.10.2026 heisst «zu spät» ohne Reglementsfrist «zu knapp, um sich
 * vorzubereiten und teilzunehmen», und kommt die Einladung erst nach dem
 * Versammlungstag oder gar nicht, nennen Fristwarnung und Erinnerungsmail die
 * mögliche Nichtigkeit (`ZU_SPAET_UND_FEHLEND`; Fachprüfung Runde 1, B1, B2,
 * und Restpunkte Runde 1, B1, B4).
 *
 * Rein: hinein gehen Kalendertage und eine Zahl, heraus kommen Kalendertage und
 * Sätze. Keine Uhr, kein Zugriff auf die Datenbank (AD-1) — der heutige Tag
 * wird übergeben, damit sich jeder Fall prüfen lässt, ohne die Systemzeit zu
 * stellen.
 */
import { FachlicherFehler } from './fehler';
import { tageSpaeter, tageZwischen } from './versammlung';
import { datumLang, wochentagNummer } from './datum';
import { zeichenzahl } from './zeichenzahl';
import { istAllgemeinerFeiertag } from './feiertage';

/** Eine Frist über einem Jahr ist keine Frist mehr, sondern ein Tippfehler. */
export const FRIST_HOECHSTENS_TAGE = 365;

export interface Einberufungsfrist {
	/** Tage vor der Versammlung. `null` heisst: nicht hinterlegt. */
	tage: number | null;
	/** Wo das im Reglement steht. Pflicht, sobald eine Zahl dasteht. */
	fundstelle: string | null;
}

/**
 * Prüft die Eingabe und gibt die bereinigten Werte zurück.
 *
 * **Ohne Zahl keine Fundstelle**: Wer die Frist wieder herausnimmt, soll nicht
 * einen Verweis auf ein Reglement zurücklassen, der nichts mehr belegt.
 */
export function pruefeEinberufungsfrist(
	tage: number | null | undefined,
	fundstelle: string | null | undefined
): Einberufungsfrist {
	if (tage === null || tage === undefined) return { tage: null, fundstelle: null };

	if (!Number.isInteger(tage) || tage < 1 || tage > FRIST_HOECHSTENS_TAGE) {
		throw new FachlicherFehler(
			'einberufungsfrist_ungueltig',
			`Die Einberufungsfrist ist eine ganze Zahl von 1 bis ${FRIST_HOECHSTENS_TAGE} Tagen. ` +
				'Lassen Sie das Feld leer, solange die Frist des Reglements nicht bekannt ist.',
			'einberufungsfristTage'
		);
	}

	const beleg = fundstelle?.trim() ?? '';
	if (zeichenzahl(beleg) < 3) {
		// Dieselbe Begründung wie bei der Zählweise und der Vollmachtschranke: Wer
		// den Beschluss anficht, greift die Einberufung an. Eine Frist ohne
		// Fundstelle liesse sich dann nicht verteidigen.
		throw new FachlicherFehler(
			'einberufungsfrist_ohne_fundstelle',
			'Zur Einberufungsfrist gehört die Fundstelle im Reglement.',
			'einberufungsfristFundstelle'
		);
	}

	return { tage, fundstelle: beleg };
}

/**
 * Der letzte Tag, an dem die Einladung nach der Regel der Anwendung bei allen
 * sein soll (vorsichtig bis zum Empfang, siehe Kopf). Der Name stammt aus der
 * Zeit, als die Anwendung ab Versand rechnete.
 *
 * `null`, solange keine Frist hinterlegt ist — die Anwendung errät sie nicht.
 */
export function versandfrist(versammlungsdatum: string, tage: number | null): string | null {
	if (tage === null) return null;
	return tageSpaeter(versammlungsdatum, -tage);
}

/**
 * Der letzte Werktag vor einem Kalendertag.
 *
 * **Werktag heisst hier Montag bis Freitag, ohne die allgemeinen Feiertage**
 * (Produktentscheid 06.10.2026, «Bundesweite Feiertage», seither «allgemeine»:
 * nur der 1. August ist ein Bundesfeiertag, Art. 110 Abs. 3 BV, die übrigen
 * sind kantonal, gelten aber fast überall): Neujahr, Karfreitag,
 * Ostermontag, Auffahrt, Pfingstmontag, der 1. August, Weihnachten und der
 * Stephanstag zählen wie ein Wochenende (`istAllgemeinerFeiertag` in
 * `feiertage.ts`). Die beweglichen davon rechnet die Anwendung aus dem
 * Ostersonntag, eine Liste mit Jahreszahlen gibt es nicht.
 *
 * **Kantonale Feiertage fehlen bewusst**, auch der 2. Januar: Sie sind je
 * Kanton verschieden, und die Anwendung weiss nicht, in welchem Kanton die
 * Bewirtschaftung arbeitet. Das kostet nur in einer Richtung: Fällt der
 * errechnete Werktag auf einen kantonalen Feiertag, kommt die Erinnerung an
 * diesem Feiertag statt am Werktag davor, und `postZuSpaet` hält ihn noch für
 * einen Tag, an dem die Post reicht. Zu früh rechnet die Anwendung dadurch nie.
 *
 * Fällt der Tag selbst auf ein Wochenende oder einen Feiertag, ist das Ergebnis
 * trotzdem der letzte Werktag **davor**: Am Samstag verschickt niemand die
 * Einladung.
 */
export function werktagDavor(datum: string): string {
	let tag = tageSpaeter(datum, -1);
	/*
	 * Höchstens sieben Schritte. Die längste Kette von Tagen ohne Werktag ist
	 * vier Tage lang: Karfreitag bis Ostermontag, oder Samstag, 23., bis
	 * Dienstag, 26. Dezember. Neujahr liegt sechs Tage nach dem Stephanstag, und
	 * Auffahrt, Pfingstmontag und der 1. August stossen an kein anderes
	 * Feiertagspaar. Die Probe in `einberufungsfrist.test.ts` misst das über
	 * zwei Jahrhunderte nach.
	 */
	for (let i = 0; i < 7; i++) {
		if (istWerktag(tag)) return tag;
		tag = tageSpaeter(tag, -1);
	}
	return tag;
}

function istWerktag(tag: string): boolean {
	const nummer = wochentagNummer(tag);
	return nummer !== null && nummer >= 1 && nummer <= 5 && !istAllgemeinerFeiertag(tag);
}

/**
 * Der Tag, an dem erinnert wird: ein Werktag vor Ablauf der Versandfrist.
 *
 * `null` ohne hinterlegte Frist.
 */
export function erinnerungstag(versammlungsdatum: string, tage: number | null): string | null {
	const frist = versandfrist(versammlungsdatum, tage);
	return frist === null ? null : werktagDavor(frist);
}

export type Fristart =
	/** Keine Frist hinterlegt — es wird nichts gerechnet. */
	| 'ohne_frist'
	/** Die Einladung ist draussen. */
	| 'erledigt'
	/** Noch Zeit. */
	| 'offen'
	/** Heute oder morgen läuft sie ab. */
	| 'knapp'
	/** Die Frist ist vorbei, und nichts ist hinausgegangen. */
	| 'verpasst';

export interface Fristlage {
	art: Fristart;
	/** Der letzte zulässige Versandtag, oder `null` ohne hinterlegte Frist. */
	frist: string | null;
	/** Tage von heute bis zur Frist. Negativ, wenn sie vorbei ist. */
	restTage: number | null;
	/** Ein Satz für die Anzeige. Immer gesetzt. */
	satz: string;
	/**
	 * Die Kurzfassung für die Seitenleiste, nur wo der volle Satz dort zu lang
	 * wäre (derzeit nur bei `verpasst`). Fehlt sie, zeigt die Leiste `satz`.
	 */
	kurz?: string;
}

export interface Fristeingabe {
	versammlungsdatum: string;
	/** Die Frist der Gemeinschaft in Tagen, oder `null`. */
	tage: number | null;
	/**
	 * Ob eine Einladung erzeugt oder als verschickt vermerkt ist. Bis 07.10.2026
	 * stand hier «nachweislich hinausgegangen»; einen Nachweis kennt die
	 * Anwendung nicht (Produktentscheid 07.10.2026).
	 */
	versendet: boolean;
}

/**
 * **Wer für den Versand sorgt** (Laienprüfung Runde 1, Punkt 10, Auftrag
 * «aufmerksam statt sperren», 07.10.2026). Ein Satz für alle Stellen, die nach
 * dem Produktentscheid 07.10.2026 («Nur noch aufmerksam machen») sagen, dass
 * die Anwendung den Empfang nicht sicherstellt: Hinweis, Mail, Linkseite,
 * Hilfetext, Fristwarnung, Erfordernisseite, Freigabe, Einstellung. Bis dahin
 * hiess es «… liegt bei der Sitzungsleitung»; die Erinnerung geht aber an die
 * Bewirtschaftung, und die leitet nicht immer. Die Seiten führen denselben
 * Wortlaut in der Vorlage; `tests/domain/hakentext.test.ts` vergleicht.
 * Seit Runde 2 (Laienprüfung N4, 07.10.2026) «ob und wann die Einladung
 * ankommt» statt «das»: Neben «dann prüft die Anwendung den letzten Tag» klang
 * «prüft das nicht» widersprüchlich.
 */
export const VERANTWORTUNG =
	'Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.';

/**
 * **Was «zu spät» heisst und was daraus folgen kann** (Fachprüfung Restpunkte
 * Runde 1, B1 und B4, 06.10.2026; Rz. 26, 66, 67, 68 ad Art. 712n). Eine
 * Einladung, die erst nach dem Versammlungstag ankommt, ist nicht zu spät,
 * sondern fehlt: Dann kann ein Beschluss nichtig sein, nicht nur anfechtbar.
 * Ohne Reglementsfrist zählt, ob die Zeit für Vorbereitung und Teilnahme
 * reichte (Rz. 25 bis 27). Geteilt von der Fristwarnung (`fristlage`, Art
 * `verpasst`) und der gewöhnlichen Erinnerungsmail vor und nach Ablauf
 * (`textFuerErinnerung` in `mailversand.ts`), damit beide dasselbe sagen.
 */
export const ZU_SPAET_UND_FEHLEND =
	'Zu spät heisst: nach der Frist Ihres Reglements oder, nennt es keine, zu knapp, um sich ' +
	'vorzubereiten und teilzunehmen. Kommt die Einladung zu spät, aber vor der Versammlung an, ' +
	'kann ein Beschluss angefochten werden. Kommt sie erst nach dem Versammlungstag oder gar ' +
	'nicht, kann er nichtig sein.';

/**
 * Wie es um die Frist steht — für die Anzeige in der Vorbereitung.
 *
 * **Getrennt von der Erinnerung**, obwohl beide dieselbe Frist lesen: Die
 * Anzeige beschreibt jeden Zustand, die Erinnerung entscheidet über genau eine
 * Nachricht. Ein gemeinsamer Rückgabewert müsste beides zugleich sein und wäre
 * für keines von beidem klar.
 */
export function fristlage(heute: string, e: Fristeingabe): Fristlage {
	const frist = versandfrist(e.versammlungsdatum, e.tage);
	if (frist === null) {
		return {
			art: 'ohne_frist',
			frist: null,
			restTage: null,
			satz:
				'Die Einberufungsfrist dieser Gemeinschaft ist nicht hinterlegt. Tragen Sie sie unter ' +
				'«Reglement und Quoren» nach. Dann rechnet die Anwendung den letzten Tag aus, an dem ' +
				'die Einladung bei allen sein soll, und erinnert rechtzeitig daran. Nennt Ihr ' +
				'Reglement keine Frist, tragen Sie ' +
				// Mindestens, nicht genau zehn (Fachprüfung 1, Korrekturrunde 06.10.2026;
				// Wermelinger Rz. 26, 27 ad Art. 712n).
				'mindestens zehn Tage ein.'
		};
	}

	const rest = tageZwischen(heute, frist);

	if (e.versendet) {
		return {
			art: 'erledigt',
			frist,
			restTage: rest,
			/*
			 * **Neutral, was die Anwendung weiss** (06.10.2026, mit der Umbenennung des
			 * Hakens in «Die Einladung ist bei allen angekommen», Produktentscheid
			 * 06.10.2026, gültig bis 07.10.2026; seither heisst er «Die Einladung ist
			 * verschickt»): `versendet` ist auch wahr, wenn nur eine Einladung erzeugt
			 * ist. «Ist hinausgegangen» behauptete dann einen Versand, und «lief»
			 * stimmte vor dem letzten Tag nicht. Angezeigt wird der Satz derzeit
			 * nirgends (`vorbereitung.ts` zeigt nur die anderen Arten).
			 */
			satz:
				'Eine Einladung ist erzeugt oder als verschickt vermerkt. Der letzte Tag der ' +
				`Frist ist der ${datumLang(frist)}.`
		};
	}

	if (rest < 0) {
		const ersterSatz =
			// Bis zum Empfang, nicht bis zum Versand (Produktentscheid 06.10.2026,
			// «Jetzt richtigstellen», auf Fachprüfung Runde 2, D; Rz. 25 bis 30 ad
			// Art. 712n), als Regel der Anwendung (Produktentscheid «Als Regel der
			// Anwendung», Fachprüfung Runde 3).
			`Der letzte Tag, an dem die Einladung bei allen sein sollte, war der ${datumLang(frist)}`;
		return {
			art: 'verpasst',
			frist,
			restTage: rest,
			/*
			 * **Kurz in der Leiste, ganz auf der Seite** (Produktentscheid 06.10.2026,
			 * «Kurz in der Leiste, ganz auf der Seite», auf Laienprüfung Restpunkte
			 * Runde 2): Die volle Fassung hatte neun Sätze und stand in der Seitenleiste
			 * an jedem Punkt «Einladung erzeugen». Die Leiste nennt den Tag und den
			 * Ort, wo es weitergeht; die Seite Vorbereitung zeigt `satz`.
			 */
			kurz: `${ersterSatz}. Was jetzt zu tun ist, steht auf der Seite Vorbereitung.`,
			satz:
				`${ersterSatz}, und die Anwendung sieht keine erzeugte Einladung. ` +
				/*
				 * **Der Satz für alle, die selbst verschickt haben, gleich an zweiter
				 * Stelle** (Laienprüfung Restpunkte Runde 1, B4, und Runde 2,
				 * 06.10.2026): Sie sind die häufigsten Leser, und am Schluss, nach
				 * «nichtig», las ihn kaum jemand. Der Satz steht nur noch auf der Seite
				 * Vorbereitung, deshalb «unten auf dieser Seite»: Der Haken steht dort
				 * unter der Schrittliste. Ehrlich, was der Haken nicht sagt: ob sie
				 * rechtzeitig kam; die Sätze danach gelten weiter.
				 *
				 * **Hinweis statt Nachweis** (Produktentscheid 07.10.2026, «Nur noch
				 * aufmerksam machen»): Bis 07.10.2026 hiess es «sobald sie bei allen
				 * angekommen ist». Der Haken heisst seither «Die Einladung ist
				 * verschickt» und ist eine Angabe der Sitzungsleitung; der Empfang liegt
				 * bei ihr. Die Rechtssätze danach bleiben.
				 */
				'Haben Sie die Einladung ausserhalb der Anwendung verschickt, setzen Sie unten auf dieser ' +
				'Seite den Haken «Die Einladung ist verschickt». Dann entfällt diese Warnung. Ob die ' +
				'Einladung rechtzeitig kam, sagt der Haken nicht. ' +
				VERANTWORTUNG +
				' ' +
				'Die Anwendung rechnet vorsichtig bis zum Empfang; rechnet Ihr Reglement ab Versand, gilt ' +
				'dessen Regel. ' +
				/*
				 * **Zu spät und ganz fehlend getrennt** (Fachprüfung Runde 1, B1 und B2,
				 * Abschnitt «Offen» des Prüfberichts Hinweise lesbar, 06.10.2026).
				 * Wortlaut in `ZU_SPAET_UND_FEHLEND`, den die Erinnerungsmail teilt.
				 */
				ZU_SPAET_UND_FEHLEND +
				' ' +
				// Der nächste Schritt wie in der Mail im selben Fall (`mailversand.ts`;
				// Auftrag «Hinweise lesbar», 06.10.2026). Der Satz steht nur ohne
				// erzeugte Einladung und ohne Vermerk (`versendet`), also nie neben
				// einem gesetzten Haken.
				'In beiden Fällen ist ein neuer Versammlungstermin der sichere Weg.'
		};
	}

	if (rest <= 1) {
		return {
			art: 'knapp',
			frist,
			restTage: rest,
			satz:
				rest === 0
					? `Heute ist der letzte Tag, an dem die Einladung bei allen sein soll (${datumLang(frist)}).`
					: `Morgen ist der letzte Tag, an dem die Einladung bei allen sein soll (${datumLang(frist)}).`
		};
	}

	return {
		art: 'offen',
		frist,
		restTage: rest,
		satz: `Die Einladung soll bis zum ${datumLang(frist)} bei allen sein, noch ${rest} Tage.`
	};
}

export type Erinnerungsart = 'vorwarnung' | 'abgelaufen';

export interface Erinnerungsfall {
	art: Erinnerungsart;
	frist: string;
	erinnertAm: string;
}

/**
 * Ob heute erinnert wird — und weshalb.
 *
 * **Nicht nur am Erinnerungstag selbst.** Wäre die Bedingung «heute ist genau
 * der Werktag vor der Frist», ginge jede Erinnerung verloren, deren Tag der
 * Dienst nicht erlebt hat: ein Neustart, ein Wochenende ohne Strom, eine
 * Versammlung, die erst danach erfasst wurde. Deshalb gilt sie **ab** dem
 * Erinnerungstag, und dass sie nur einmal geht, hält nicht diese Rechnung fest,
 * sondern ein Merker in der Datenbank.
 *
 * **Auch nach Ablauf.** Wer die Frist verpasst hat, braucht die Nachricht mehr
 * als der, dem noch ein Tag bleibt — nur mit einem anderen Satz. Erst nach dem
 * Versammlungstag selbst hat sie keinen Zweck mehr; dann ist die Sache
 * entschieden.
 */
export function erinnerungsfall(heute: string, e: Fristeingabe): Erinnerungsfall | null {
	if (e.versendet) return null;
	const frist = versandfrist(e.versammlungsdatum, e.tage);
	if (frist === null) return null;

	const erinnertAm = werktagDavor(frist);
	if (tageZwischen(erinnertAm, heute) < 0) return null;
	// Nach dem Versammlungstag ist nichts mehr zu retten.
	if (tageZwischen(heute, e.versammlungsdatum) < 0) return null;

	return {
		art: tageZwischen(heute, frist) < 0 ? 'abgelaufen' : 'vorwarnung',
		frist,
		erinnertAm
	};
}

/**
 * Ob für einen Versand bis zur Frist die Post nicht mehr reicht: heute liegt
 * nach dem Werktag vor der Frist und nicht nach ihr, also am letzten Tag selbst
 * oder an einem Wochenende davor (Fachprüfung Teil 2 Runde 3, F3, 06.10.2026).
 * Seit dem Produktentscheid 06.10.2026 zählen auch die allgemeinen Feiertage
 * davor dazu, etwa der Ostermontag vor einer Frist am Dienstag.
 * Am Werktag vor der Frist reicht A-Post innerhalb der Schweiz in der Regel noch.
 */
export function postZuSpaet(heute: string, frist: string): boolean {
	return tageZwischen(werktagDavor(frist), heute) > 0 && tageZwischen(heute, frist) >= 0;
}

/** Wie knapp der Postweg bis zur Frist ist; siehe `postlage`. */
export type Postlage = 'knapp' | 'zu_spaet';

/**
 * Wie knapp der Postweg bis zur Frist ist, sobald `postZuSpaet` gilt.
 *
 * - `knapp`: heute ist Samstag, die Frist ist der Montag darauf, und dieser
 *   Montag ist ein Werktag. A-Post vom Samstag kann am Montag ankommen, sicher
 *   ist es nicht (Laienprüfung Nachtrag 2, Fachprüfung Korrekturrunde,
 *   06.10.2026).
 * - `zu_spaet`: jeder andere Tag nach dem letzten Werktag vor der Frist bis
 *   zur Frist selbst: der Fristtag, ein Sonntag, ein Feiertag direkt davor, ein
 *   Samstag vor einer Frist an einem Sonntag oder Feiertag, und ein Samstag vor
 *   einer Frist am Dienstag, wenn der Montag dazwischen ein Feiertag ist.
 * - `null`: Die Post reicht noch in der Regel (`postZuSpaet` gilt nicht). So
 *   auch am Samstag vor einer Frist an einem gewöhnlichen Dienstag: Der Montag
 *   ist dann der Werktag davor, und bis dahin reicht die Post.
 *
 * Kantonale Feiertage kennt die Anwendung nicht (`werktagDavor`).
 */
export function postlage(heute: string, frist: string): Postlage | null {
	if (!postZuSpaet(heute, frist)) return null;
	const samstag = wochentagNummer(heute) === 6;
	return samstag && tageZwischen(heute, frist) === 2 && istWerktag(frist) ? 'knapp' : 'zu_spaet';
}
