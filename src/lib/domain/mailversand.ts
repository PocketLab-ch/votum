/**
 * Was per Mail hinausgeht — rein (PRD §13, offene Frage «Mailversand»).
 *
 * **Der Versand ist eine Option, kein Weg.** Der Auftraggeber braucht ihn nicht; er
 * verschickt über sein Mailprogramm. Gebaut ist er trotzdem, weil jemand
 * anderes ihn wollen kann — und dann soll er nicht neben der Anwendung
 * entstehen. Ohne eingerichteten Mailausgang gibt es die Knöpfe gar nicht, und
 * alles bleibt, wie es war: Dateien erzeugen, selbst verschicken.
 *
 * **Die eine Regel, die hier zählt:** Ein Zugangscode geht nur an die
 * Berechtigten der Einheit, der er gehört. Nie an eine Liste, nie in Kopie, nie
 * an einen Verteiler. Der Code ist der Schlüssel zur Stimme; wer ihn in einem
 * Sammelmail verschickt, hat ihn verschenkt.
 *
 * Deshalb entsteht je Empfänger **eine eigene Nachricht mit einem eigenen
 * Anhang**, und die Zuordnung wird hier gerechnet statt in der Schale. Ein
 * vertauschter Anhang wäre der teuerste Fehler dieser Anwendung: Er sieht
 * richtig aus und gibt jemandem die Stimme eines anderen.
 *
 * **«Nur an eine Adresse» heisst nicht «nur an eine Person»** (27.08.2026).
 * Gehört eine Einheit mehreren gemeinsam, geht dieselbe Karte an jeden von
 * ihnen — jeder in einer eigenen Nachricht an seine eigene Adresse. Das
 * verschenkt nichts: Die Einheit hat eine Stimme, der Code lässt genau einmal
 * herein, und wer ihn zuerst benutzt, übt sie aus (ZGB Art. 712o Abs. 1). Die
 * Karte nur einer der Personen zu schicken hiesse dagegen zu entscheiden, wer
 * von ihnen abstimmen darf — und das entscheiden sie selbst.
 */
import type { Postlage } from './einberufungsfrist';
import { VERANTWORTUNG, ZU_SPAET_UND_FEHLEND } from './einberufungsfrist';

export interface Empfaenger {
	parteiId: string;
	name: string;
	/** Leer, wo keine Adresse erfasst ist. */
	adresse: string;
	/**
	 * Die Dateinamen der Beilagen im Versandpaket, in Reihenfolge.
	 *
	 * **Mehrzahl seit dem 07.09.2026** (Bedienbarkeitsprüfung 05.09.2026,
	 * Befund 25). Bis dahin genau eine: die Zugangskarte. Seit das
	 * Vollmachtsformular beiliegt, sind es zwei, und der Mailweg ist der
	 * häufigere von beiden — er hätte sonst weiterhin nichts zum Unterschreiben
	 * mitgeschickt, während der gedruckte Satz es tut.
	 */
	dateinamen: string[];
	/**
	 * Ob die Einheit mehreren Personen gemeinsam gehört (ZGB Art. 712o Abs. 1).
	 *
	 * **Wozu, wenn doch alle dasselbe bekommen** (27.08.2026): Der Begleittext
	 * unterscheidet sich, und zwar an der Stelle, an der es zählt. Beim
	 * Alleineigentümer heisst es «Die Karte gilt nur für Sie. Geben Sie sie nicht
	 * weiter» — dort ist das richtig. Bei gemeinschaftlichem Eigentum ist es
	 * falsch: Sie gilt für alle Beteiligten, und weitergeben ist genau der
	 * vorgesehene Weg, wenn die eine Person nicht kann.
	 *
	 * **Bis zum 27.08.2026 stand hier `mitKarte`.** Damals gab es zwei Arten von
	 * Sendung: die Partei mit ihrer Karte und die mitberechtigte Person mit der
	 * Traktandenliste. Seit die Karte an alle Mitberechtigten geht, gibt es nur
	 * noch eine Beilage; ein Feld, das das für jeden Empfänger einzeln behauptet,
	 * könnte nur noch falsch sein.
	 */
	gemeinschaftlich: boolean;
}

export interface Nachricht {
	parteiId: string;
	an: string;
	name: string;
	betreff: string;
	text: string;
	/** Die Beilagen dieser Nachricht: Zugangskarte und Vollmachtsformular. */
	anhaenge: string[];
	/** Ob die Einheit mehreren Personen gemeinsam gehört. Siehe `Empfaenger`. */
	gemeinschaftlich: boolean;
}

export interface Versandplan {
	nachrichten: Nachricht[];
	/** Wer keine Adresse hat — namentlich, nicht als Zahl. */
	ohneAdresse: string[];
	/**
	 * Adressen, die mehr als einer Partei gehören.
	 *
	 * Kommt vor und ist zulässig: Eheleute mit einem Postfach, eine Verwaltung
	 * für mehrere Einheiten, eine mitberechtigte Person unter der Adresse ihrer
	 * Hülle. Gemeldet wird es trotzdem — wer zwei Sendungen an dieselbe Adresse
	 * schickt, soll das vorher wissen und nicht nachher.
	 */
	mehrfach: { adresse: string; parteien: string[] }[];
}

/** Sieht aus wie eine Adresse. Streng genug, um Tippfehler zu fangen. */
export function adresseBrauchbar(adresse: string): boolean {
	const a = adresse.trim();
	// zeichenzahl-frei: Die Grenzen einer Adresse sind technisch (Oktette), kein Satz an den Benutzer.
	if (a.length < 5 || a.length > 254) return false;
	if (/\s/.test(a)) return false;
	return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(a);
}

export interface Einladungstexte {
	gemeinschaft: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	/** Wer unterschreibt — der Betreiber, nicht die Anwendung. */
	absenderName: string;
}

export function betreffFuerEinladung(t: Einladungstexte): string {
	return `${t.gemeinschaft} — Versammlung vom ${t.datum}`;
}

/**
 * Der Nachrichtentext für eine Einheit, die **einer** Person gehört.
 *
 * **Nüchtern und kurz.** Er begleitet eine Beilage, er ersetzt sie nicht: Die
 * Einladung mit Traktandenliste ist das Dokument, das gilt. Was hier steht,
 * darf ihr nicht widersprechen — deshalb nennt der Text nur, was auch im
 * Dokument steht, und keine Frist, kein Erfordernis, keine Rechtsfolge.
 *
 * **Die Warnung «nicht weitergeben» steht hier und nur hier** (27.08.2026).
 * Beim Alleineigentümer ist sie richtig: Wer seine Karte weitergibt, gibt seine
 * Stimme weg. Für gemeinschaftliches Eigentum gilt das Gegenteil, und dafür gibt
 * es `textFuerGemeinschaft` daneben. Zwei Fassungen, nicht ein Schalter im
 * gleichen Absatz: Ein Text, der beides zugleich sagen will, sagt am Ende keines
 * von beidem deutlich.
 */
export function textFuerEinladung(t: Einladungstexte, name: string): string {
	return [
		`Guten Tag ${name}`,
		'',
		`Sie sind zur Versammlung der ${t.gemeinschaft} eingeladen:`,
		'',
		`    ${t.datum}, ${t.uhrzeit}`,
		`    ${t.ort}`,
		'',
		'Im Anhang finden Sie Ihre persönliche Zugangskarte mit dem QR-Code für die',
		'Anwesenheit und die Abstimmung. Bringen Sie sie mit — ausgedruckt oder auf',
		'dem Telefon.',
		'',
		'**Die Karte gilt nur für Sie.** Geben Sie sie nicht weiter; wer sie hat,',
		'kann in Ihrem Namen abstimmen.',
		'',
		'Die Traktandenliste liegt der Einladung bei, die Sie separat erhalten.',
		'',
		'Freundliche Grüsse',
		t.absenderName
	].join('\n');
}

/**
 * Der Nachrichtentext für eine Einheit im **gemeinschaftlichen** Eigentum
 * (ZGB Art. 712o Abs. 1).
 *
 * **Warum ein eigener Text und nicht der andere mit einer geänderten Zeile.**
 * Der andere sagt «Die Karte gilt nur für Sie. Geben Sie sie nicht weiter; wer
 * sie hat, kann in Ihrem Namen abstimmen.» Hier ist beides falsch: Die Karte
 * gilt für alle Beteiligten, und sie weiterzugeben ist der vorgesehene Weg,
 * wenn die eine Person nicht kann. Ein Satz, der an einer Stelle warnt und an
 * der anderen einlädt, lässt sich nicht aus einem Wortlaut bauen.
 *
 * **Was er nicht tut: einen Namen nennen.** Wer die Stimme abgibt, entscheidet
 * sich am Abend. Ein Name hier behauptete eine Rangordnung, die Art. 712o nicht
 * kennt — und wäre falsch, sobald die andere Person kommt.
 *
 * **Was er auch nicht tut: die Folge der Uneinigkeit nennen.** Kommen zwei und
 * sind sie sich uneinig, ist die Stimme ungültig (Wermelinger, Rz. 26 bis 29a
 * ad Art. 712o). Das steht in der Einladung (`gemeinschaftssatz` in
 * `$lib/domain/einladung`), nicht in der Begleitmail zur Karte.
 */
export function textFuerGemeinschaft(t: Einladungstexte, name: string): string {
	return [
		`Guten Tag ${name}`,
		'',
		`Sie sind zur Versammlung der ${t.gemeinschaft} eingeladen:`,
		'',
		`    ${t.datum}, ${t.uhrzeit}`,
		`    ${t.ort}`,
		'',
		'Ihre Einheit gehört Ihnen zusammen mit anderen Personen. Dafür gibt es eine',
		'Stimme, und eine Person gibt sie ab. Alle Beteiligten erhalten dieselbe',
		'Karte; wer damit an die Versammlung kommt, übt die Stimme aus.',
		'',
		'Im Anhang finden Sie diese Zugangskarte mit dem QR-Code für die Anwesenheit',
		'und die Abstimmung. Bringen Sie sie mit — ausgedruckt oder auf dem Telefon.',
		'',
		'**Die Karte gilt nur für die Einheit.**',
		'',
		'Die Traktandenliste liegt der Einladung bei, die Sie separat erhalten.',
		'',
		'Freundliche Grüsse',
		t.absenderName
	].join('\n');
}

/**
 * Stellt den Versandplan zusammen.
 *
 * Rein: Was hinausgeht, entscheidet sich hier und ist damit prüfbar, ohne dass
 * eine Nachricht abgeschickt wird.
 */
export function planeVersand(
	empfaenger: readonly Empfaenger[],
	texte: Einladungstexte
): Versandplan {
	const nachrichten: Nachricht[] = [];
	const ohneAdresse: string[] = [];
	const jeAdresse = new Map<string, string[]>();

	for (const e of empfaenger) {
		const adresse = e.adresse.trim();
		if (!adresseBrauchbar(adresse)) {
			ohneAdresse.push(e.name);
			continue;
		}

		const schluessel = adresse.toLowerCase();
		jeAdresse.set(schluessel, [...(jeAdresse.get(schluessel) ?? []), e.name]);

		nachrichten.push({
			parteiId: e.parteiId,
			an: adresse,
			name: e.name,
			betreff: betreffFuerEinladung(texte),
			// **Der Text folgt dem Eigentum, nicht dem Empfänger.** Alle
			// Beteiligten einer Einheit bekommen denselben Wortlaut; ein Text, der
			// einen von ihnen heraushöbe, behauptete eine Rangordnung, die
			// ZGB Art. 712o nicht kennt.
			text: e.gemeinschaftlich
				? textFuerGemeinschaft(texte, e.name)
				: textFuerEinladung(texte, e.name),
			anhaenge: e.dateinamen,
			gemeinschaftlich: e.gemeinschaftlich
		});
	}

	const mehrfach = [...jeAdresse.entries()]
		.filter(([, parteien]) => parteien.length > 1)
		.map(([adresse, parteien]) => ({ adresse, parteien }));

	return { nachrichten, ohneAdresse, mehrfach };
}

/**
 * Was nach dem Versand gemeldet wird.
 *
 * **Je Nachricht ein Ergebnis, nicht eine Gesamtzahl.** «12 von 14 verschickt»
 * lässt offen, welche zwei fehlen — und das ist genau die Auskunft, die man
 * braucht.
 */
export interface Versandergebnis {
	parteiId: string;
	name: string;
	an: string;
	zugestellt: boolean;
	/** Bei Misserfolg: was der Mailserver gesagt hat. */
	grund: string | null;
}

export function versandInWorten(ergebnisse: readonly Versandergebnis[]): string {
	const gut = ergebnisse.filter((e) => e.zugestellt).length;
	const schlecht = ergebnisse.length - gut;
	if (ergebnisse.length === 0) return 'Es wurde nichts verschickt.';
	if (schlecht === 0) {
		return gut === 1 ? 'Eine Nachricht verschickt.' : `${gut} Nachrichten verschickt.`;
	}
	if (gut === 0) {
		return schlecht === 1
			? 'Die Nachricht konnte nicht verschickt werden.'
			: `Keine der ${schlecht} Nachrichten konnte verschickt werden.`;
	}
	return `${gut} verschickt, ${schlecht} nicht — die offenen stehen unten namentlich.`;
}

/**
 * Die Erinnerung an den Versand der Einladung (Auftraggeber, 28.08.2026).
 *
 * **Sie geht an die Bewirtschaftung, nicht an die Eigentümer.** Verschicken
 * muss sie, und niemand sonst kann etwas daran ändern. Deshalb steht hier kein
 * Anhang und kein Zugangscode — es ist eine Nachricht an das eigene Haus.
 *
 * **Was sie ehrlich sagen muss**: Die Anwendung sieht nur, was durch sie
 * hindurchgeht. Wer die Einladung ausserhalb erzeugt und über sein
 * Mailprogramm verschickt, ohne das Versandpaket zu holen, bekommt diese
 * Erinnerung zu Unrecht. Das steht in der Nachricht, statt sie zu einer
 * Behauptung über den Postausgang der Bewirtschaftung zu machen.
 */
export interface Erinnerungstexte {
	gemeinschaft: string;
	/** Der Versammlungstag, ausgeschrieben. */
	datum: string;
	uhrzeit: string;
	ort: string;
	/** Der letzte zulässige Versandtag, ausgeschrieben. */
	frist: string;
	/** Die Frist des Reglements in Tagen. */
	tage: number;
	/** Wo sie im Reglement steht. */
	fundstelle: string | null;
	/** Wer unterschreibt — der Betreiber, nicht die Anwendung. */
	absenderName: string;
	/**
	 * Der Link, mit dem sich der Versand aus der Mail heraus vermerken lässt.
	 *
	 * `null`, wenn die Anwendung ihre eigene Adresse nicht kennt (`ORIGIN` nicht
	 * gesetzt). Dann fehlt der Absatz, und die Nachricht bleibt vollständig —
	 * sie war es vor dem 02.09.2026 auch.
	 */
	bestaetigungslink: string | null;
	/**
	 * Die Traktanden, deren Mehr seit der Freigabe milder geworden ist und deren
	 * berichtigte Einladung aussteht, je als Bezeichnung wie «3 Sanierung der
	 * Fassade». Gesetzt und nicht leer heisst: Erinnerung nach einer Milderung.
	 */
	gemildert?: string[];
	/**
	 * Die Adresse der Seite Vorbereitung dieser Versammlung, wo der Haken «Die
	 * Einladung ist verschickt» steht. Nur in der Erinnerung nach einer
	 * Milderung; `null` oder fehlend, wenn die Anwendung ihre Adresse nicht kennt.
	 */
	vorbereitungslink?: string | null;
	/**
	 * Ob heute der letzte Fristtag ist (Korrekturrunde 06.10.2026).
	 */
	fristtag?: boolean;
	/**
	 * Ob die Post nicht mehr reicht: heute nach dem Werktag vor der Frist, also
	 * am letzten Tag selbst oder am Wochenende oder allgemeinen Feiertag davor
	 * (`postZuSpaet` in `einberufungsfrist.ts`, Fachprüfung Teil 2 Runde 3, F3).
	 * Ohne `postlage` gilt dann die strenge Fassung.
	 */
	postZuSpaet?: boolean;
	/**
	 * Wie knapp der Postweg ist (`postlage` in `einberufungsfrist.ts`,
	 * Fachprüfung Korrekturrunde 06.10.2026). Gesetzt geht es `postZuSpaet` vor:
	 * `knapp` nur am Samstag vor einer Frist am Montag, der ein Werktag ist.
	 */
	postlage?: Postlage | null;
}

/**
 * Der Weg, wenn die Post nicht mehr sicher reicht, für die Erinnerungsmail und
 * den Hinweis der Seite Vorbereitung (`neuversandHinweis`). Welche Fassung
 * gilt, rechnet der Kern (`postlage` in `einberufungsfrist.ts`).
 *
 * **Milder nur am Samstag vor einer Frist am Montag, der ein Werktag ist**
 * (Laienprüfung Nachtrag 2, Fachprüfung Korrekturrunde, 06.10.2026): Dann kann
 * A-Post noch ankommen, sicher ist es nicht. An jedem anderen Tag nach dem
 * letzten Werktag vor der Frist kommt sie nicht mehr an.
 *
 * **«schriftlich» im Reglement** (Laienprüfungen Nachtrag 2 und Korrekturrunde;
 * Wermelinger Rz. 23, 24 ad Art. 712n): Ob es E-Mail ausschliesst, entscheidet
 * die Anwendung nicht, und am letzten Moment lässt es sich nicht mehr klären.
 * Ist es offen, nennt der Satz den Weg, der eine schriftliche Einladung immer
 * erfüllt: überbracht (Rz. 23). Die Post nennt er nicht, weil sie hier nicht
 * mehr sicher reicht.
 *
 * **Ohne «Halten Sie fest, dass sie bei allen ankam»** (Produktentscheid
 * 07.10.2026, «Nur noch aufmerksam machen»): Die Anwendung verlangt keinen
 * Nachweis des Empfangs mehr. Mit dem Satz fiel «Sonst stellen Sie das Mehr
 * zurück», das an ihm hing; den Rückweg nennen Hinweis und Mail selbst.
 *
 * **«Bis zum letzten Tag der erfassten Frist» statt «rechtzeitig»**
 * (Fachprüfung B4, Runde 1 «aufmerksam statt sperren», 07.10.2026): Als
 * Rechtsfeststellung hängt «rechtzeitig» an der erfassten Frist, nicht am
 * Gesetz. Bis 07.10.2026 «kommt sie nicht mehr rechtzeitig an».
 */
export function postwegZuKnapp(lage: Postlage): string {
	return (
		(lage === 'zu_spaet'
			? 'Per Post kommt sie nicht mehr bis zum letzten Tag der erfassten Frist an. Es bleibt die ' +
				'Übergabe von Hand oder '
			: 'Per Post kommt sie kaum noch bis zum letzten Tag der erfassten Frist an. Sicherer ist ' +
				'die Übergabe von Hand oder ') +
		'ein anderer Weg, den Ihr Reglement erlaubt; schreibt es keine Form vor, geht auch E-Mail. ' +
		'Verlangt es «schriftlich» und ist nicht geklärt, ob E-Mail genügt, übergeben Sie sie von ' +
		'Hand.'
	);
}

/**
 * **Die berichtigte Einladung als Empfehlung** (Fachprüfung B5, Runde 1
 * «aufmerksam statt sperren», 07.10.2026): Das Recht verlangt sie nicht
 * zwingend; ohne sie kann ein Beschluss mit dem milderen Mehr angefochten
 * werden. Derselbe Satz in Mail, Hinweis, Kasten und Warnung im Saal; bis
 * 07.10.2026 «braucht es» bzw. «war … nötig».
 */
export const BERICHTIGTE_SOLLTE = 'Für das mildere Mehr sollte eine berichtigte Einladung an alle gehen.';

/**
 * **Mit der Folge, wo sie nicht schon dasteht** (Produktentscheid 07.10.2026
 * «1a», auf Laienprüfung Runde 2, N1): Vor Fristablauf und ohne Frist sagt
 * «sollte» allein nicht, was geschieht, wenn sie ausbleibt. Nach Fristablauf
 * steht ein eigener, bedingter Anfechtungssatz, dort nur `BERICHTIGTE_SOLLTE`.
 */
export const BERICHTIGTE_FOLGE =
	'Kommt sie nicht rechtzeitig bei allen an, kann ein Beschluss mit dem milderen Mehr angefochten werden.';
export const BERICHTIGTE_MIT_FOLGE = `${BERICHTIGTE_SOLLTE} ${BERICHTIGTE_FOLGE}`;

/**
 * **Die Warnung im Saal steht unabhängig vom Haken** (Laienprüfung Runde 1,
 * Punkt 3, 07.10.2026): Sie rechnet am Mehr (`warntImSaal`), nicht am Haken.
 * Bis dahin hiess es nur «im Saal steht der Hinweis noch einmal». In Mail und
 * Hinweis der Seite Vorbereitung; die Linkseite sagt dasselbe ohne Zahl.
 */
export function warnungImSaal(einzahl: boolean): string {
	return (
		`Im Saal steht trotzdem eine Warnung ${einzahl ? 'beim Traktandum' : 'bei jedem dieser Traktanden'}, ` +
		WARNUNG_SOLANGE
	);
}

/** Die Bedingung der Warnung im Saal; Hilfetext und Linkseite führen sie wörtlich. */
export const WARNUNG_SOLANGE = 'solange das Mehr dort milder ist als in der Einladung vor der Milderung.';

export function betreffFuerErinnerung(t: Erinnerungstexte, abgelaufen: boolean): string {
	if (t.gemildert?.length) {
		return abgelaufen
			? `Frist für die berichtigte Einladung abgelaufen: ${t.gemeinschaft}, Versammlung vom ${t.datum}`
			: `Berichtigte Einladung nötig: ${t.gemeinschaft}, Versammlung vom ${t.datum}`;
	}
	return abgelaufen
		? `Einberufungsfrist abgelaufen: Einladung ${t.gemeinschaft}, Versammlung vom ${t.datum}`
		: `Erinnerung: Einladung ${t.gemeinschaft}, Versammlung vom ${t.datum}`;
}

export function textFuerErinnerung(t: Erinnerungstexte, abgelaufen: boolean): string {
	if (t.gemildert?.length) return textNachMilderung(t, t.gemildert, abgelaufen);
	const beleg = t.fundstelle ? ` (${t.fundstelle})` : '';
	/*
	 * **Der Link steht beim Eingeständnis, nicht am Schluss** (02.09.2026). Der
	 * Satz «die Anwendung sieht keine erzeugte Einladung» sagt, warum diese
	 * Nachricht falsch liegen kann; der Link ist die Antwort darauf und gehört
	 * daneben. Am Ende gelesen wäre er ein Angebot ohne Frage.
	 *
	 * **Ohne `ORIGIN` bleibt es beim Satz.** Ein Link, der auf `undefined/b/…`
	 * zeigt, wäre schlimmer als keiner: Er sähe aus, als hätte man etwas falsch
	 * gemacht. Die Anwendung kennt ihre eigene Adresse nur aus der Umgebung — der
	 * Zeitgeber läuft ohne Anfrage, aus der sie sich ablesen liesse.
	 */
	const nachtrag = t.bestaetigungslink
		? [
				'',
				// Korrekturrunde 06.10.2026: «an diese Einladung», denn nach einer
				// Milderung erinnert die Anwendung an dieselbe Versammlung erneut.
				// Mit dem Haken umbenannt (Produktentscheid 06.10.2026, «… ist bei
				// allen angekommen»): Der Link setzt denselben Vermerk. Seit den
				// Restpunkten Runde 1 schliesst er an den Satz zum Selbstversand an.
				'Dafür genügt dieser Link; dann erinnert die Anwendung an diese Einladung',
				'nicht mehr:',
				'',
				`    ${t.bestaetigungslink}`
			]
		: [
				'',
				// Ohne Link der Weg in der Anwendung (Restpunkte Runde 1, 06.10.2026):
				// Der Satz davor verlangt den Vermerk und muss sagen, wo er geht.
				// Hakenname seit dem Produktentscheid 07.10.2026 «… ist verschickt».
				'Dafür setzen Sie auf der Seite Vorbereitung der Versammlung den Haken «Die Einladung ' +
					'ist verschickt»; dann erinnert die Anwendung an diese Einladung nicht mehr.'
			];
	return [
		'Guten Tag',
		'',
		/*
		 * **Der Empfang zählt, nicht der Versand** (Produktentscheid 06.10.2026,
		 * «Jetzt richtigstellen»; Rz. 30 ad Art. 712n): Die erfasste Frist ist der
		 * letzte Tag, an dem die Einladung bei allen sein soll. Neutral, nicht «Das
		 * Reglement verlangt» (Codeprüfung M1): Erfasst sein kann auch der Rat von
		 * zehn Tagen. Und «kann angefochten werden», nicht «ist anfechtbar».
		 */
		/*
		 * **Was die Anwendung sieht, nicht ein Versand** (Laien- und Fachprüfung
		 * Restpunkte Runde 1, 06.10.2026; Rz. 24a, 30 ad Art. 712n): «ist noch
		 * nicht hinausgegangen» behauptete einen Versand, den die Anwendung nicht
		 * kennt. Sie sieht nur zweierlei: eine erzeugte Einladung und den Haken.
		 */
		(abgelaufen
			? `der letzte Tag für die Einladung zur Versammlung der ${t.gemeinschaft} ist vorbei. `
			: `für die Versammlung der ${t.gemeinschaft} sieht die Anwendung keine erzeugte ` +
				'Einladung. ') +
			(abgelaufen ? 'Die Anwendung sieht keine erzeugte Einladung, und es' : 'Es') +
			// Seit dem Produktentscheid 07.10.2026 nach dem Haken «Die Einladung ist
			// verschickt»; bis 07.10.2026 «… bei allen angekommen ist».
			' ist auch nicht vermerkt, dass die Einladung verschickt ist.',
		'',
		`    Versammlung   ${t.datum}, ${t.uhrzeit}, ${t.ort}`,
		`    Bei allen bis ${t.frist}`,
		'',
		/*
		 * **Bis zum Empfang als Regel der Anwendung** (Produktentscheid
		 * 06.10.2026, «Als Regel der Anwendung», Fachprüfung Runde 3; Rz. 23, 24
		 * ad Art. 712n): Ein Reglement kann ab Versand rechnen. Die Folge und der
		 * Rat zum neuen Termin gelten nur, wo die Einladung nach dessen Regel zu
		 * spät ist, ohne Reglementsfrist nach den erfassten Tagen.
		 */
		`Erfasst ist eine Einberufungsfrist von ${t.tage} Tagen${beleg}. Die Anwendung rechnet ` +
			`vorsichtig damit, dass die Einladung bis zum ${t.frist} bei allen ist; rechnet Ihr ` +
			'Reglement ab Versand, gilt dessen Regel.',
		// Ohne «Nennt es keine, gelten die erfassten Tage» (Fachprüfung Runde 4,
		// Rz. 25 bis 27 ad Art. 712n): Ohne Reglementsfrist gibt es keine
		// Tageszahl, die als Grenze gilt; angemessen entscheidet im Streit das Gericht.
		/*
		 * **«Zu spät» auch ohne Reglementsfrist, und «fehlt» statt «zu spät»,
		 * wenn sie erst nach dem Versammlungstag ankommt** (Fachprüfung Runde 1,
		 * B1 und B2, und Restpunkte Runde 1, B1, B4, 06.10.2026). Vor und nach
		 * Ablauf derselbe Wortlaut wie die Fristwarnung (`ZU_SPAET_UND_FEHLEND`):
		 * Vor Ablauf fehlte die Nichtigkeit, und die Mail las sich lockerer, als
		 * die Lage ist.
		 */
		ZU_SPAET_UND_FEHLEND +
			' ' +
			(abgelaufen
				? 'In beiden Fällen ist ein neuer Termin der sichere Weg.'
				: // Ein Hinweis statt einer Frist für die Post (Produktentscheid
					// 06.10.2026, «Hinweis auf das Postlaufrisiko»).
					// Die Mail kommt einen Werktag vor dem Tag, also auf die Lage beim
					// Lesen gefasst, nicht als Rat fürs nächste Mal (Laienprüfung
					// Postlauf, 06.10.2026).
					'Die Post braucht Zeit, ins Ausland länger. Kommt die Einladung nicht mehr ' +
						'rechtzeitig bei allen an, ist ein neuer Versammlungstermin der sichere Weg.'),
		'',
		/*
		 * **Vermerken, sobald sie angekommen ist, nicht schon beim Versand**
		 * (bis 07.10.2026; Laien- und Fachprüfung Restpunkte Runde 1, 06.10.2026): «ist diese
		 * Erinnerung gegenstandslos» knüpfte am Versand an und führte dazu, dass
		 * der Haken nie gesetzt wurde.
		 *
		 * **Ohne «sie muss bis zum … bei allen sein»** (Fachprüfung Restpunkte
		 * Runde 2, 06.10.2026): Der Halbsatz machte die erfasste Tageszahl zur
		 * Pflicht, entgegen dem gesetzten Entscheid, dass sie die Regel der
		 * Anwendung ist; der Tag steht schon im Absatz davor. Nach Ablauf, wie in
		 * der Fristwarnung, dass der Vermerk nicht sagt, ob die Einladung
		 * rechtzeitig kam (Laienprüfung Restpunkte Runde 2, 06.10.2026).
		 */
		/*
		 * **Bis 07.10.2026 hiess es hier**: «vermerken Sie das, sobald sie
		 * bei allen angekommen ist. Verschickt allein genügt nicht». Seit dem
		 * Produktentscheid 07.10.2026 («Nur noch aufmerksam machen») heisst der
		 * Haken «Die Einladung ist verschickt» und ist eine Angabe der
		 * Sitzungsleitung, kein Nachweis des Empfangs. Der Satz zur Verantwortung
		 * steht deshalb für sich, nach dem Weg zum Haken; nach Ablauf in der
		 * Vergangenheit, weil der Tag vorbei ist.
		 */
		'Haben Sie die Einladung ausserhalb der Anwendung verschickt, vermerken Sie das.',
		...nachtrag,
		'',
		// Seit Runde 1 (Laienprüfung Punkt 10) der Satz `VERANTWORTUNG`; bis
		// 07.10.2026 «… liegt bei der Sitzungsleitung».
		(abgelaufen ? 'Ob die Einladung rechtzeitig bei allen war, sagt der Vermerk nicht. ' : '') +
			VERANTWORTUNG,
		'',
		// Seit dem Produktentscheid 06.10.2026 («Ja, erneut erinnern») stimmt
		// «einmal» allein nicht mehr: Nach einer Milderung geht sie wieder, und
		// ebenso nach einer Rücknahme der Freigabe («Rücknahme setzt den Merker
		// zurück», Migration 147).
		'Diese Erinnerung geht einmal je Versammlung. Wird danach das Mehr eines Traktandums ' +
			'milder oder die Freigabe zurückgenommen, kommt eine weitere.',
		'',
		'Freundliche Grüsse',
		t.absenderName
	].join('\n');
}

/**
 * Die Erinnerung nach einer Milderung des Mehrs (Produktentscheid 06.10.2026,
 * «Ja, erneut erinnern»).
 *
 * **Warum ein eigener Text und nicht ein Absatz im bisherigen.** Der bisherige
 * sagt «Die Anwendung sieht keine erzeugte Einladung». Nach einer Milderung ist
 * die erste Einladung in aller Regel erzeugt und verschickt; was fehlt, ist die
 * berichtigte. Ein Absatz dazu hätte neben einem Satz gestanden, der nicht mehr
 * stimmt.
 *
 * **Dieselbe Regel wie der Hinweis auf der Vorbereitungsseite**
 * (`neuversandHinweis` in `einladungsmehr.ts`, beide über `neuversandVermerkt`, bis 07.10.2026 `neuversandGilt`),
 * aber nicht derselbe Wortlaut (Korrekturrunde 06.10.2026, B3). Die Mail nennt
 * die Traktanden ebenso, den Rückweg aber mit eigenen Sätzen: Sie wird
 * ausserhalb der Anwendung gelesen und nennt deshalb die Wege, die der Hinweis
 * als gegenwärtig voraussetzt. Der Haken heisst «Die Einladung ist verschickt»
 * und steht unten auf der Seite Vorbereitung
 * (`versammlungen/[id]/vorbereitung/+page.svelte`, unter der Schrittliste).
 *
 * **Neu gefasst nach dem Produktentscheid 07.10.2026, «Nur noch aufmerksam
 * machen».** Die Mail macht aufmerksam und stellt keine Bedingung: Die
 * Anwendung nimmt das mildere Mehr auch ohne Haken, und für Versandweg und
 * Zeitpunkt sorgt, wer einlädt (`VERANTWORTUNG`, Runde 1). Bis
 * 07.10.2026 sagte sie, ohne rechtzeitigen Haken nehme die Anwendung beim
 * Eröffnen wieder das Mehr der bisherigen Einladung (Produktentscheid
 * 06.10.2026, «Erste Einladung gilt»), verlangte den Haken erst nach dem
 * Empfang und trug nach Fristablauf keinen Link. Seither zählt jeder Haken
 * nach der Milderung (`neuversandVermerkt`), und der Dienst legt auch nach
 * Fristablauf eine Marke ab (`einladungserinnerung.ts`).
 *
 * **«Die Anwendung nimmt», nicht «gilt»** (Fachprüfung B6, Korrekturrunde
 * 06.10.2026, wie `neuversandHinweis`): Dass das mildere Mehr ohne Haken
 * zählt, ist eine Regel der Anwendung, keine Rechtslage.
 *
 * **Die Mail ist ein Zusatz** (`docs/dienste.md`): Ohne eingerichteten
 * Mailausgang stehen dieselben Aussagen im Hinweis auf der Seite Vorbereitung
 * und im Saal beim Traktandum (`saalhinweisNachMilderung`).
 */
function textNachMilderung(t: Erinnerungstexte, gemildert: string[], abgelaufen: boolean): string {
	const namen = gemildert.map((g) => `«${g}»`).join(', ');
	const einzahl = gemildert.length === 1;
	const lage = [
		'Guten Tag',
		'',
		// Zwei Sätze statt einem: Mit langem Namen und mehreren Traktanden lief
		// der eine über 180 Zeichen.
		`seit der Freigabe ist an der Versammlung der ${t.gemeinschaft} das Mehr ` +
			`${einzahl ? 'eines Traktandums' : 'mehrerer Traktanden'} milder geworden. ` +
			`Betroffen ${einzahl ? 'ist' : 'sind'}: ${namen}. Eine Einladung, die schon verschickt ` +
			'ist, nennt noch das strengere. Wer es geändert hat, steht im Verlauf der Versammlung.',
		'',
		/*
		 * **«Bei allen bis» statt «Versandfrist»** (Laienprüfung, Korrekturrunde
		 * 06.10.2026): Die Anwendung rechnet bis zum Empfang, und der Absatz
		 * darunter nennt denselben Tag. Die Spalte steht wie die Zeile darüber:
		 * 14 Zeichen bis zum Wert.
		 */
		`    Versammlung   ${t.datum}, ${t.uhrzeit}, ${t.ort}`,
		`    Bei allen bis ${t.frist}`,
		''
	];
	// Die Adresse der Seite als eigener Block, mit Leerzeilen davor und danach
	// (Codeprüfung N7); nur, wo die Anwendung ihre Adresse kennt.
	const vorbereitung = t.vorbereitungslink ? [`    ${t.vorbereitungslink}`, ''] : [];
	/*
	 * **Der Rückweg nennt die Klicks** (Laienprüfung N2): Der Verweis «Erfordernis
	 * ändern» steht in der aufgeklappten Zeile des Traktandums.
	 */
	// In der Mehrzahl jedes Traktandum (Laienprüfung Teil 2 Runde 3, Punkt 4).
	const zurueck = einzahl
		? 'Klicken Sie in der Traktandenliste auf das Traktandum und dann auf «Erfordernis ändern».'
		: 'Klicken Sie in der Traktandenliste auf jedes betroffene Traktandum und dann auf ' +
			'«Erfordernis ändern».';
	/*
	 * **Erst zurückstellen, dann der Haken, auch wenn sie schon verschickt ist**
	 * (Laienprüfung Restpunkte Runde 1, B6, Codeprüfung G2, 06.10.2026): wie der
	 * Hinweis auf der Seite Vorbereitung (`hakenNachRueckweg` in
	 * `neuversandHinweis`), mit «er gilt dann für die bisherige Einladung»
	 * (Codeprüfung Restpunkte Runde 3). Seit dem Produktentscheid 07.10.2026
	 * «sobald sie verschickt ist» statt «sobald sie bei allen ist».
	 */
	const hakenFuerBisherige =
		`Haben Sie das Mehr ${einzahl ? '' : 'überall '}zurückgestellt, setzen Sie auf der Seite ` +
		'Vorbereitung den Haken; er gilt dann für die bisherige Einladung. Setzen Sie ihn, sobald ' +
		'sie verschickt ist; ist sie das schon, gleich.';
	/*
	 * **Der Haken nach dem Versand, nicht nach dem Empfang** (Produktentscheid
	 * 07.10.2026). Mit ihm entfällt der Hinweis auf der Seite Vorbereitung
	 * (`neuversandVermerkt`), die Warnung im Saal nicht: Sie rechnet am Mehr,
	 * nicht am Haken (`warntImSaal`).
	 */
	const haken =
		'Ist sie verschickt, setzen Sie auf der Seite Vorbereitung den Haken «Die Einladung ist ' +
		'verschickt» (unten auf der Seite). Dann entfällt der Hinweis dort.';
	// In der Mehrzahl jedes Traktandum (Codeprüfung Restpunkte Runde 1, G1, galt
	// für den Saalsatz bis 07.10.2026 und gilt für diesen weiter). Die Warnung im
	// Saal unabhängig vom Haken (Laienprüfung Runde 1, Punkt 3, 07.10.2026).
	const aufmerksam =
		'Die Anwendung nimmt das mildere Mehr auch ohne Haken; sie macht nur aufmerksam. ' +
		warnungImSaal(einzahl);
	/*
	 * **Der Link in beiden Fassungen** (Produktentscheid 07.10.2026): Jeder Haken
	 * nach der Milderung zählt, auch nach Fristablauf. Er bestätigt den Versand,
	 * nicht den Empfang, wie der Haken auf der Seite.
	 */
	const nachtrag = t.bestaetigungslink
		? [
				'Ist die berichtigte Einladung verschickt, können Sie das auch über diesen Link bestätigen:',
				'',
				`    ${t.bestaetigungslink}`,
				''
			]
		: [];
	const schluss = ['Diese Erinnerung geht nach jeder Milderung einmal.', '', 'Freundliche Grüsse', t.absenderName];

	if (abgelaufen) {
		/*
		 * **Bedingt, weil die Anwendung den Versand nicht kennt** (Fachprüfung B1,
		 * Runde 1, 07.10.2026). Diese Fassung kommt auch, wenn die berichtigte
		 * Einladung rechtzeitig hinausging und nur der Haken fehlt: etwa wenn der
		 * Zeitgeber am Erinnerungstag nicht lief (`erinnerungsfall` meldet dann
		 * `abgelaufen`). Bis zur Runde 1 hiess es unbedingt «Sie kann jetzt nicht
		 * mehr rechtzeitig ankommen». Was der späte Versand bringt und was nicht,
		 * wie im Hinweis (Laienprüfung Runde 1, Punkt 1).
		 *
		 * **Nach Fristablauf aufmerksam machen, nicht sperren** (Produktentscheid
		 * 07.10.2026). Ist sie noch nicht verschickt, kommt sie nicht mehr
		 * rechtzeitig an, und ein Beschluss mit dem milderen Mehr kann angefochten
		 * werden (Rz. 30, 66 und 68 ad Art. 712n); die Mail nennt beide Wege,
		 * trotzdem schicken oder beim Mehr der bisherigen Einladung bleiben, und
		 * den sicheren über eine Verschiebung. Bis 07.10.2026 hiess es hier, ohne
		 * gültigen Vermerk nehme die Anwendung beim Eröffnen wieder das Mehr der
		 * bisherigen Einladung, auch wenn die berichtigte rechtzeitig ankam.
		 */
		return [
			...lage,
			`${BERICHTIGTE_SOLLTE} Der letzte Tag der erfassten Einberufungsfrist war der ` +
				`${t.frist}. Ist die berichtigte Einladung noch nicht verschickt, kommt sie nach dieser ` +
				'Frist nicht mehr ' +
				`rechtzeitig an. War sie am ${t.frist} nicht bei allen, kann ein Beschluss mit dem ` +
				`milderen Mehr angefochten werden. ${VERANTWORTUNG}`,
			'',
			// Die drei Wege je als eigener Absatz (Laienprüfung Runde 2, N5,
			// 07.10.2026): trotzdem schicken, zurückstellen, verschieben. Bis dahin
			// «Schicken Sie sie trotzdem, wissen alle …» im Absatz davor.
			'Wenn Sie sie trotzdem schicken, wissen alle vom milderen Mehr; das Anfechtungsrisiko bleibt.',
			'',
			haken,
			'',
			...vorbereitung,
			aufmerksam,
			'',
			(einzahl
				? 'Wollen Sie beim Mehr der bisherigen Einladung bleiben, stellen Sie es zurück: '
				: // In der Mehrzahl zwei Sätze: Mit dem Doppelpunkt lief der eine über 180 Zeichen.
					// «überall» statt eines zweiten «jedes betroffene Traktandum» (Runde 1).
					'Wollen Sie beim Mehr der bisherigen Einladung bleiben, stellen Sie es überall ' +
					'zurück. ') +
				`${zurueck} ${hakenFuerBisherige}`,
			'',
			// In der Mehrzahl die betroffenen Traktanden (Codeprüfung N1, Nachtrag).
			// Seit dem Produktentscheid 07.10.2026 «der sichere Weg», weil das
			// mildere Mehr auch ohne Verschiebung gesetzt bleibt.
			(einzahl
				? 'Der sichere Weg zum milderen Mehr: Verschieben Sie das Traktandum und laden Sie mit ' +
					'voller Frist neu ein. Hat jemand das Traktandum verlangt, entscheidet über die ' +
					'Verschiebung die '
				: 'Der sichere Weg zum milderen Mehr: Verschieben Sie die betroffenen Traktanden und ' +
					'laden Sie mit voller Frist neu ein. Hat jemand eines davon verlangt, entscheidet über ' +
					'dessen Verschiebung die ') +
				// Laienprüfung Teil 2 Runde 3, Punkt 3, und Nachtrag L3: eindeutig, dass
				// die ganze Versammlung gemeint ist, und welche nie verschoben wird.
				'Versammlung (Ordnungsantrag, in der Regel einfaches Mehr). ' +
				// Was gilt, wenn sie ablehnt, wie in der Absage (`VERLANGT_EINZAHL` in
				// `einladungsmehr.ts`; die Mehrzahl `VERLANGT_MEHRZAHL` stand dort bis
				// 07.10.2026 im Hinweis; Laienprüfung Runde 1, Abschnitt «Offen» des
				// Prüfberichts Hinweise lesbar, 06.10.2026).
				(einzahl
					? 'Lehnt sie die Verschiebung ab, lassen Sie an der Versammlung mit dem Mehr der ' +
						'Einladung abstimmen. '
					: 'Lehnt sie die Verschiebung ab, lassen Sie über dieses Traktandum an der ' +
						'Versammlung mit dem Mehr der Einladung abstimmen. ') +
				'Die ganze Versammlung ' +
				'verschieben Sie nicht, wenn ein Fünftel der Eigentümer sie verlangt hat, und sonst nur ' +
				'aus wichtigem Grund.',
			'',
			...nachtrag,
			...schluss
		].join('\n');
	}

	/*
	 * **Der Postweg** (Codeprüfung N2, Laienprüfung): «rechtzeitig» heisst
	 * angekommen. Nach dem letzten Werktag vor der Frist reicht keine Post mehr;
	 * «kaum noch» sagt die Mail nur am Samstag vor einer Frist an einem Montag,
	 * der ein Werktag ist (`postlage`, Fachprüfung F3 und Korrekturrunde,
	 * Laienprüfung Nachtrag 2). Dann sagt die Mail das statt eines Rats, der
	 * nicht mehr trägt. Der andere Weg ist, was das Reglement erlaubt; schreibt
	 * es eine Form vor, etwa eingeschrieben, schliesst es die anderen aus
	 * (Fachprüfung F2 und Nachtrag, Rz. 23/24 ad Art. 712n). Der Satz steht in
	 * `postwegZuKnapp` und gilt ebenso im Hinweis (`neuversandHinweis`). Dass
	 * der Empfang festgehalten gehört, sagt er seit dem Produktentscheid
	 * 07.10.2026 nicht mehr.
	 */
	// Ohne `postlage` die strenge Fassung: Sie verspricht nie zu viel.
	const postweg: Postlage | null =
		t.postlage !== undefined ? t.postlage : t.postZuSpaet ? 'zu_spaet' : null;
	const post = postweg
		? (t.fristtag ? 'Heute ist der letzte Tag. ' : '') + postwegZuKnapp(postweg)
		: 'Per Post reicht dafür jetzt in der Regel nur noch A-Post innerhalb der Schweiz; für ' +
			'Adressen im Ausland reicht auch sie meist nicht.';
	return [
		...lage,
		`${BERICHTIGTE_MIT_FOLGE} Schicken Sie sie so, dass sie spätestens am ${t.frist} bei allen ` +
			`ist. ${post} ${VERANTWORTUNG}`,
		'',
		haken,
		'',
		...vorbereitung,
		aufmerksam,
		'',
		'Reicht die Zeit nicht, bleiben Sie beim Mehr der bisherigen Einladung' +
			/*
			 * **In der Mehrzahl erst die Handlung, dann die Folge** (Laienprüfung
			 * Nachtrag 2, Produktentscheid «Gesammelt nachbessern», 06.10.2026):
			 * «Sind alle betroffenen Traktanden zurückgestellt» las sich vor der
			 * Anleitung zuerst als «vertagt». Zurückgestellt wird das Mehr, nicht
			 * das Traktandum.
			 */
			(einzahl
				? `; dann braucht es keine berichtigte. Stellen Sie das Mehr dafür zurück: ${zurueck} `
				: '. Stellen Sie dafür das Mehr jedes betroffenen Traktandums zurück: ' +
					`${zurueck} Dann braucht es keine berichtigte. `) +
			hakenFuerBisherige,
		'',
		...nachtrag,
		...schluss
	].join('\n');
}
