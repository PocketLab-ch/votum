/**
 * Dasselbe Thema bei allen Häusern eines Abends — die Reiterleiste (rein).
 *
 * **Das Problem, das sie löst.** Einheiten, Eigentümer, Reglement und
 * Beschlussfähigkeit sind Angaben der **Gemeinschaft**, nicht der Versammlung.
 * Wer einen gemeinsamen Abend mit sechs Häusern vorbereitet, ruft dieselbe Seite
 * sechsmal auf — und findet sie jedes Mal über die Navigation wieder. Vier
 * Themen mal sechs Häuser sind vierundzwanzig Seitenaufrufe, von denen
 * dreiundzwanzig Suchen sind.
 *
 * Gemeldet am 11.08.2026: «Gibt es da dann eine gemeinsame Ansicht für
 * Einheiten, Wertquoten, Eigentümer und Zuordnung sowie Reglement und Quoren?
 * … So kann man Thema für Thema für alle STWEG und MEG durchgehen und müsste
 * nicht jeden einzeln anklicken.»
 *
 * **Warum Reiter und nicht eine Sammelseite.** Eine Seite, die alle sechs Häuser
 * untereinander zeigt, wäre sechsmal so lang und hätte sechs Speicherknöpfe —
 * das Gegenteil des Musters aus `docs/gestaltung.md`. Die Reiterleiste lässt
 * jede Seite, wie sie ist, und nimmt nur den Weg dorthin ab.
 *
 * Rein: hinein gehen Weg und Häuser, heraus kommt die Leiste. Kein Zugriff auf
 * Datenbank oder Uhr (AD-1).
 */
import type { Schrittzustand } from './vorbereitung';
import type { Versammlungszustand } from './versammlung';

/** Ein Haus des Abends, so viel wie die Leiste davon braucht. */
export interface Abendhaus {
	stwegId: string;
	/** Die Versammlung **dieses** Hauses am Abend — jedes hat seine eigene. */
	versammlungId: string;
	name: string;
	/**
	 * Die Vorbereitungsschritte dieses Hauses, so weit die Leiste und die
	 * Stammdatenkarten sie brauchen: `stand` ist die kurze Antwort auf der Karte
	 * («14 Einheiten, Saldo geht auf»), `beschreibung` der Satz darunter.
	 */
	schritte: {
		kennung: string;
		titel: string;
		zustand: Schrittzustand;
		stand?: string;
		beschreibung?: string;
	}[];
	/**
	 * Der Zustand dieser Versammlung, und ob sie eine Auszählmappe braucht.
	 *
	 * **Beides lag in `holeAbendhaeuser` schon vor und wurde verworfen**
	 * (02.09.2026, aus dem Code-Review). Die Ausfallseite des Abends erhob es
	 * daraufhin ein zweites Mal, je Haus eine eigene Abfrage. Zwei Erhebungen
	 * derselben Sache im selben Aufruf sind nicht nur langsam, sie sind eine
	 * zweite Wahrheit.
	 */
	zustand: Versammlungszustand;
	mappeNoetig: boolean;
}

export interface Registerreiter {
	name: string;
	pfad: string;
	/** Der Reiter, auf dem man gerade steht. */
	hier: boolean;
	/** Ob das Thema bei diesem Haus erledigt ist. Null, wenn es kein Schritt ist. */
	erledigt: boolean | null;
}

export interface Registerleiste {
	/** Das letzte Wegstück, an dem die Häuser hängen — `einheiten`, `reglement`, … */
	thema: string | null;
	/** Wie der Ablauf dieses Thema nennt. Null bei Seiten ohne Schritt. */
	titel: string | null;
	reiter: Registerreiter[];
	/** Bei wie vielen Häusern das Thema erledigt ist. Null ohne Schritt. */
	erledigt: number | null;
	haeuser: number;
}

/**
 * Das Thema aus dem Weg — alles nach `/gemeinschaften/<kennung>/`.
 *
 * Mehrteilige Wege bleiben ganz (`versammlungen/neu`), damit der Reiter auf
 * **dieselbe** Seite des anderen Hauses führt und nicht auf dessen Startseite.
 * Ein Abfrageteil gehört nicht dazu: Er trägt die Herkunft, und die ist bei
 * jedem Haus eine andere.
 */
export function themaAusPfad(pfad: string): string | null {
	const ohneAbfrage = pfad.split('?')[0].replace(/\/+$/, '');
	const treffer = /^\/gemeinschaften\/[^/]+\/(.+)$/.exec(ohneAbfrage);
	return treffer ? treffer[1] : null;
}

/**
 * Die Reiterleiste für ein Thema, oder null, wenn keine hingehört.
 *
 * **Null bei einem einzigen Haus.** Eine Reiterleiste mit einem Reiter ist keine
 * Wahl, sondern Lärm — und behauptet obendrein einen Verbund, den es nicht gibt.
 * Ebenso null auf der Startseite der Gemeinschaft: Dort ist die Gemeinschaft die
 * Sache, nicht das Thema.
 */
export function abendregister(e: {
	/** Der Weg der aktuellen Seite, mit oder ohne Abfrageteil. */
	pfad: string;
	/** Alle Häuser des Abends, in der Reihenfolge, in der sie dort stehen. */
	haeuser: Abendhaus[];
}): Registerleiste | null {
	const thema = themaAusPfad(e.pfad);
	if (!thema) return null;
	if (e.haeuser.length < 2) return null;

	const hier = /^\/gemeinschaften\/([^/]+)\//.exec(e.pfad.split('?')[0])?.[1] ?? null;

	const reiter = e.haeuser.map((h) => {
		const schritt = h.schritte.find((s) => s.kennung === thema);
		return {
			name: h.name,
			// Die Herkunft ist je Haus eine andere: Am Abend hat jedes seine eigene
			// Versammlung. Ohne diesen Wechsel führte der Ablauf im nächsten Haus
			// weiter die Versammlung des vorigen — und der «Weiter»-Weg am Fuss
			// sprünge zurück ins falsche Haus.
			pfad: `/gemeinschaften/${h.stwegId}/${thema}?zur=${h.versammlungId}`,
			hier: h.stwegId === hier,
			erledigt: schritt ? schritt.zustand === 'erledigt' : null
		};
	});

	const mitSchritt = reiter.filter((r) => r.erledigt !== null);
	const titel =
		e.haeuser.flatMap((h) => h.schritte).find((s) => s.kennung === thema)?.titel ?? null;

	return {
		thema,
		titel,
		reiter,
		erledigt: mitSchritt.length > 0 ? mitSchritt.filter((r) => r.erledigt).length : null,
		haeuser: e.haeuser.length
	};
}

/** Die vier Schritte, die bei der Gemeinschaft liegen und nicht bei der Versammlung. */
export const STAMMDATENTHEMEN = ['einheiten', 'eigentuemer', 'reglement', 'beschlussfaehigkeit'];

/** Ob bei diesem Haus alle vier Stammdatenschritte erledigt sind. */
export function stammdatenVollstaendig(haus: Abendhaus): boolean {
	return haus.schritte
		.filter((s) => STAMMDATENTHEMEN.includes(s.kennung))
		.every((s) => s.zustand === 'erledigt');
}

/** Häuser eines Abends, getrennt nach dem, was noch zu tun ist. */
export interface Haeuserstand {
	offen: Abendhaus[];
	erledigt: Abendhaus[];
}

/**
 * Die Häuser nach offen und erledigt trennen — **offene zuerst**.
 *
 * Gemeldet am 12.08.2026 zur Sammelansicht: «Fehlende Einträge können da leicht
 * übersehen werden.» Sechs gleich aussehende Kacheln, zwei davon leer: Wer die
 * zwei sucht, muss sechs Antworten lesen. Getrennt stehen sie oben und sind
 * gezählt.
 *
 * **Warum die Häuser umsortiert werden dürfen und die vier Themen nicht.** Die
 * Reihenfolge der Häuser trägt keine Aussage — sie ist die, in der sie dem Abend
 * zugeordnet wurden. Die vier Stammdatenthemen dagegen bauen aufeinander auf
 * (ohne Einheiten keine Zuordnung, ohne Zuordnung keine Stimmkraft); dort bleibt
 * die Folge, wie sie ist, und nur die Markierung sagt, wo etwas fehlt.
 *
 * Innerhalb beider Gruppen bleibt die ursprüngliche Reihenfolge stehen: Wer den
 * Abend nach Häusern kennt, findet sie in derselben Folge wieder.
 */
export function haeuserNach(haeuser: Abendhaus[], istOffen: (h: Abendhaus) => boolean): Haeuserstand {
	return {
		offen: haeuser.filter(istOffen),
		erledigt: haeuser.filter((h) => !istOffen(h))
	};
}

/**
 * Zu **einem** Thema: welche Häuser es noch offen haben.
 *
 * Häuser ohne diesen Schritt zählen als erledigt — sie haben hier nichts zu tun,
 * und eine Kachel, die etwas verlangt, das es nicht gibt, ist eine Falschmeldung.
 */
export function haeuserZumThema(haeuser: Abendhaus[], thema: string): Haeuserstand {
	return haeuserNach(haeuser, (h) => {
		const schritt = h.schritte.find((s) => s.kennung === thema);
		return schritt !== undefined && schritt.zustand !== 'erledigt';
	});
}

/** Über alle vier Themen: bei welchen Häusern noch etwas fehlt. */
export function haeuserNachStammdaten(haeuser: Abendhaus[]): Haeuserstand {
	return haeuserNach(haeuser, (h) => !stammdatenVollstaendig(h));
}

/**
 * Dieselbe Leiste, andere Achse: ein Reiter je Haus auf **einer** Seite.
 *
 * `abendregister` wechselt das Haus und behält das Thema — dafür muss man schon
 * auf einer Themenseite stehen. Auf der Seite der gemeinsamen Versammlung ist es
 * umgekehrt: Man bleibt auf der Seite, und der Reiter wählt, **wessen** Angaben
 * darauf stehen. Beides ergibt dieselbe Matrix aus Haus und Thema; welche Achse
 * die Reiter tragen, hängt daran, wo man steht.
 *
 * Der erste Reiter ist «Alle» — die Übersicht über die Häuser. Ohne ihn gäbe es
 * keinen Weg zurück aus einem einzelnen Haus ausser über die Leiste links.
 */
export function hausregister(e: {
	/** Der Weg der Seite, ohne Abfrageteil — die Reiter hängen `?haus=` daran. */
	pfad: string;
	haeuser: Abendhaus[];
	/** Welches Haus gerade gewählt ist. Null heisst «Alle». */
	aktiv: string | null;
}): Registerleiste | null {
	if (e.haeuser.length < 2) return null;
	const weg = e.pfad.split('?')[0];

	const reiter: Registerreiter[] = [
		{ name: 'Alle', pfad: weg, hier: e.aktiv === null, erledigt: null },
		...e.haeuser.map((h) => ({
			name: h.name,
			pfad: `${weg}?haus=${h.stwegId}`,
			hier: h.stwegId === e.aktiv,
			erledigt: stammdatenVollstaendig(h)
		}))
	];

	return {
		thema: null,
		titel: null,
		reiter,
		erledigt: e.haeuser.filter(stammdatenVollstaendig).length,
		haeuser: e.haeuser.length
	};
}
