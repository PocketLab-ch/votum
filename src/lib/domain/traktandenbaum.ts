/**
 * Der Traktandenbaum: Reihenfolge, Ebene, Nummerierung (Story 3.3, FR-13, AD-1).
 *
 * Alles hier ist reine Rechnung auf einer flachen Liste. Das ist Absicht: Ein
 * Baum, der als verschachtelte Struktur durch die Anwendung wandert, wird beim
 * Speichern wieder flach gemacht, und die Nummerierung entsteht dann zweimal —
 * einmal beim Anzeigen und einmal beim Schreiben. Die beiden laufen auseinander.
 *
 * Hier gibt es genau eine Funktion, die nummeriert, und sie bekommt die flache
 * Liste, wie sie in der Datenbank steht.
 */
import { FachlicherFehler } from './gemeinschaft';
import type { Id } from './types';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';
import { zeichenzahl } from './zeichenzahl';

/**
 * Grösste Verschachtelungstiefe.
 *
 * Vier Ebenen ergeben «3.2.1.4». Darunter liest im Saal niemand mehr mit, und
 * die Nummer ist auf dem Beamer nicht mehr zu erfassen.
 */
export const GROESSTE_TIEFE = 4;

/** Das Mindeste, was der Baum von einem Traktandum wissen muss. */
export interface Knoten {
	id: Id;
	parentId: Id | null;
	position: number;
	/** Von Hand gesetzte Nummer. Bleibt bei der Neunummerierung unberührt. */
	nummerManuell?: string | null;
	/**
	 * Die Nummer, unter der dieses Traktandum eingeladen wurde — bei der Freigabe
	 * festgeschrieben und danach unveränderlich (Migration 072).
	 */
	nummerFest?: string | null;
}

export interface NummerierterKnoten<T extends Knoten = Knoten> {
	knoten: T;
	/** Die zusammengesetzte Nummer, etwa «3.2.1». */
	nummer: string;
	tiefe: number;
	/** Wahr, wenn die Nummer von Hand gesetzt ist. */
	manuell: boolean;
	/** Wahr, wenn die Nummer aus der Einladung stammt und nicht gerechnet ist. */
	fest: boolean;
	/** Reihenfolge in der flachen Darstellung, oben nach unten. */
	rang: number;
}

function kinderVon<T extends Knoten>(alle: T[], elternId: Id | null): T[] {
	return alle
		.filter((k) => (k.parentId ?? null) === elternId)
		.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/** Das letzte Segment einer Nummer als Zahl — «3.12» ergibt 12, «2a» nichts. */
function belegteZahl(nummer: string | null | undefined): number | null {
	const letztes = (nummer ?? '').trim().split('.').pop() ?? '';
	return /^\d+$/.test(letztes) ? Number(letztes) : null;
}

/**
 * Nummeriert den ganzen Baum durch und gibt ihn flach in Anzeigereihenfolge.
 *
 * ## Drei Quellen, in dieser Reihenfolge
 *
 * 1. **Von Hand gesetzt** (`nummerManuell`) — was die Bewirtschaftung eintippt,
 *    gilt.
 * 2. **Bei der Freigabe festgeschrieben** (`nummerFest`) — die Nummer, unter der
 *    eingeladen wurde.
 * 3. **Gerechnet** — für alles, was danach im Saal hinzukommt.
 *
 * ## Warum die Nummer nicht an der Reihenfolge hängt
 *
 * Gemeldet am 21.08.2026, nachdem ein Rückkommensantrag von Platz 9 auf 8
 * gezogen worden war: «ist das ein Problem, da die Traktandenliste ja
 * freigegeben wurde?» Es war eines — nicht das Verschieben, sondern die Folge:
 * Die Nummern wanderten mit, und die «Décharge an die Bewirtschaftung» hiess
 * plötzlich 9 statt 8. Damit stimmt die versandte Einladung nicht mehr mit dem
 * Protokoll überein, und über welchen Punkt beschlossen wurde, hängt an der
 * Frage, welche Fassung der Liste jemand gerade vor sich hat.
 *
 * Produktentscheid: **Die Reihenfolge darf sich ändern, die Nummer nicht.** Ein
 * Punkt vorzuziehen ist ein Ordnungsentscheid; ihn umzunummerieren ist ein
 * Eingriff in die Ankündigung. Deshalb schreibt die Freigabe die Nummern fest
 * (Migration 072), und hier zählt nur noch, was danach entsteht.
 *
 * ## Die gerechnete Zahl überspringt, was belegt ist
 *
 * Sonst bekäme eine im Saal aufgenommene Kenntnisnahme, die jemand nach vorne
 * zieht, die «3» — die es auf der Einladung schon gibt. Gezählt wird deshalb
 * mindestens bis zur eigenen Stelle und dann weiter, bis eine Zahl frei ist.
 * Dass eine von Hand gesetzte «2a» die 2 nicht belegt, ändert daran nichts: Die
 * Stelle in der Liste zählt ohnehin mit, das nächste bekommt die 3.
 */
export function nummeriere<T extends Knoten>(alle: T[]): NummerierterKnoten<T>[] {
	const ergebnis: NummerierterKnoten<T>[] = [];
	let rang = 0;

	function gehe(elternId: Id | null, praefix: string, tiefe: number): void {
		const kinder = kinderVon(alle, elternId);

		// Was auf dieser Ebene schon vergeben ist — vor dem ersten Durchgang, denn
		// eine feste Nummer weiter unten in der Liste sperrt ihre Zahl auch für
		// alles, was darüber steht.
		const belegt = new Set<number>();
		for (const k of kinder) {
			const z = belegteZahl(k.nummerManuell?.trim() || k.nummerFest?.trim() || null);
			if (z !== null) belegt.add(z);
		}

		let zuletzt = 0;
		kinder.forEach((k, i) => {
			const manuell = Boolean(k.nummerManuell?.trim());
			const fest = !manuell && Boolean(k.nummerFest?.trim());

			let nummer: string;
			if (manuell) {
				nummer = (k.nummerManuell as string).trim();
			} else if (fest) {
				nummer = (k.nummerFest as string).trim();
			} else {
				let zahl = Math.max(zuletzt, i) + 1;
				while (belegt.has(zahl)) zahl++;
				zuletzt = zahl;
				belegt.add(zahl);
				nummer = praefix ? `${praefix}.${zahl}` : String(zahl);
			}

			ergebnis.push({ knoten: k, nummer, tiefe, manuell, fest, rang: rang++ });

			// Als Präfix für die Kinder dient immer die tatsächlich angezeigte
			// Nummer — auch die von Hand gesetzte. Sonst hiesse das Untertraktandum
			// von «2a» plötzlich «2.1» und stünde damit unter einem Elternteil, den
			// es auf der Liste nicht gibt.
			gehe(k.id, nummer, tiefe + 1);
		});
	}

	gehe(null, '', 1);
	return ergebnis;
}

/**
 * Welche Traktanden vor einem behandelt wurden, das eine kleinere Nummer trägt.
 *
 * **Wozu.** Seit die Nummer bei der Freigabe festgeschrieben wird
 * (Migration 072), sagt die Reihenfolge der Liste nichts mehr über die Nummern —
 * und umgekehrt. Genau das war der Zweck. Das Protokoll muss die Abweichung
 * aber benennen, sonst steht dort eine Folge wie «7, 9, 8» ohne Erklärung:
 * «Im Protokoll ist der Zeitpunkt ja eigentlich egal. Man kann ja schreiben,
 * dass das Traktandum XY aus Gründen Bla vorgezogen wurde» (Auftraggeber, 21.08.2026).
 *
 * **Die Regel:** Vorgezogen ist, wer vor einem Geschwister mit kleinerer Nummer
 * steht. Nur nach vorne — sonst trüge dieselbe Umstellung zwei Vermerke, einen
 * beim Vorgezogenen und einen beim Zurückgestellten.
 *
 * Verglichen wird je Ebene und nur, wo beide Nummern auf eine Zahl enden. Bei
 * einer von Hand gesetzten «2bis» lässt sich nicht sagen, wohin sie gehört —
 * dann schweigt das Protokoll lieber, als etwas zu behaupten.
 */
export function vorgezogene<T extends Knoten>(nummeriert: NummerierterKnoten<T>[]): Set<Id> {
	const treffer = new Set<Id>();
	const jeEbene = new Map<string, NummerierterKnoten<T>[]>();
	for (const n of nummeriert) {
		const schluessel = n.knoten.parentId ?? '';
		const liste = jeEbene.get(schluessel) ?? [];
		liste.push(n);
		jeEbene.set(schluessel, liste);
	}

	for (const geschwister of jeEbene.values()) {
		geschwister.forEach((n, i) => {
			const eigene = belegteZahl(n.nummer);
			if (eigene === null) return;
			const spaeterKleiner = geschwister.slice(i + 1).some((m) => {
				const andere = belegteZahl(m.nummer);
				return andere !== null && andere < eigene;
			});
			if (spaeterKleiner) treffer.add(n.knoten.id);
		});
	}
	return treffer;
}

/**
 * Verlangt, dass die Verschiebung den bereits behandelten Teil nicht antastet.
 *
 * **Der Anlass, am 21.08.2026:** «Bitte prüfe dass keine Traktanden hinter vor
 * Traktanden die durch kommen können. Also wenn 7 aktuell ist dass keine
 * Traktandum (9 bsi X) vor 8 kommen kann.»
 *
 * Mit dem Stellenfeld lässt sich jede Zahl eintippen — auch eine, die mitten in
 * die schon erledigten Punkte führt. Die Liste zeigte danach ein unbehandeltes
 * Traktandum zwischen zwei abgestimmten, und «vorher / jetzt / nachher» in der
 * Sitzungsleitung zeigte auf Punkte, die längst durch sind. Im Protokoll stünde
 * eine Reihenfolge, die es an diesem Abend nie gab.
 *
 * **Die Regel:** Was behandelt ist, bleibt, wo es ist — und nichts wird davor
 * geschoben. Das aufgerufene Traktandum gehört dazu: Es läuft gerade, davor
 * etwas einzuschieben hiesse, die Versammlung an eine Stelle zurückzusetzen,
 * die sie schon passiert hat.
 *
 * **Was weiterhin geht:** alles im noch nicht behandelten Teil umstellen. Genau
 * das war der Wunsch vom selben Tag — die Reihenfolge ist ein Ordnungsentscheid
 * der Versammlung.
 */
export function verlangeVorwaertsgerichtet(lage: {
	/** Die Geschwister am Zielort, in Anzeigereihenfolge — ohne den bewegten. */
	geschwister: { id: Id; behandelt: boolean; aufgerufen: boolean; nummer: string }[];
	/** Nullbasierte Zielstelle unter diesen Geschwistern. */
	stelle: number;
	/** Der bewegte Knoten — ein behandelter darf gar nicht wandern. */
	bewegt: { behandelt: boolean; aufgerufen: boolean; nummer: string };
}): void {
	if (lage.bewegt.behandelt || lage.bewegt.aufgerufen) {
		throw new FachlicherFehler(
			'schon_behandelt',
			lage.bewegt.aufgerufen
				? `Traktandum ${lage.bewegt.nummer} ist gerade aufgerufen und lässt sich nicht verschieben. ` +
					'Nehmen Sie den Aufruf zurück, wenn Sie die Reihenfolge ändern wollen.'
				: `Über Traktandum ${lage.bewegt.nummer} ist bereits befunden. Was behandelt ist, bleibt ` +
					'an seiner Stelle — sonst zeigte das Protokoll einen Ablauf, den es nie gab.',
			'stelle'
		);
	}

	// Die letzte Stelle, die von einem behandelten oder aufgerufenen Punkt
	// belegt ist. Alles davor ist Vergangenheit.
	let sperre = -1;
	lage.geschwister.forEach((g, i) => {
		if (g.behandelt || g.aufgerufen) sperre = i;
	});

	if (lage.stelle <= sperre) {
		const davor = lage.geschwister[sperre];
		throw new FachlicherFehler(
			'hinter_behandeltes',
			`Dort ist die Versammlung schon vorbei: Traktandum ${davor.nummer} ist ` +
				`${davor.aufgerufen ? 'gerade aufgerufen' : 'behandelt'}. ` +
				`Frühestens an Stelle ${sperre + 2} — davor lässt sich nichts mehr einschieben.`,
			'stelle'
		);
	}
}

/**
 * Was als Nächstes drankommt — die Stelle, an der die Versammlung weitergeht.
 *
 * **Warum nicht einfach der nächste Listeneintrag** (Bedienbarkeitsprüfung
 * 05.09.2026, Befund 5 der Telefonsicht und Befund 13 der
 * Bewirtschaftersicht). Beide Sichten führten «nachher» aus der reinen
 * Reihenfolge und widersprachen damit dem, was zehn Zentimeter tiefer stand:
 *
 * - Die Ablaufzeile kündigte «NACHHER: 3.1 Rückkommen» an, während dasselbe
 *   3.1 unten als «angenommen» geführt wurde.
 * - Nach «Aufruf zurücknehmen» fiel sie auf den Listenanfang zurück und
 *   nannte «1 Begrüssung», obwohl 1 behandelt und 2 angenommen war.
 *
 * **Die Rechnung ist dieselbe wie bei `verlangeVorwaertsgerichtet`**: Die
 * letzte Stelle, die ein behandelter oder aufgerufener Punkt belegt, ist die
 * Gegenwart; alles davor ist Vergangenheit. Was danach kommt, ist die Zukunft
 * — und der erste Punkt darin ist «nachher».
 *
 * Dass dabei unbehandelte Punkte **vor** einem behandelten übersprungen
 * werden, ist Absicht und keine Lücke: Dort war die Versammlung schon, und
 * genau darauf beruht auch die Sperre gegen das Zurückschieben.
 *
 * Gibt `null` zurück, wenn nichts mehr folgt.
 */
export function naechsterPunkt<T extends { behandelt: boolean; aufgerufen: boolean }>(
	punkte: T[]
): T | null {
	let gegenwart = -1;
	punkte.forEach((p, i) => {
		if (p.behandelt || p.aufgerufen) gegenwart = i;
	});
	return punkte[gegenwart + 1] ?? null;
}

/** Alle Nachkommen eines Knotens, ihn selbst eingeschlossen. */
export function teilbaum<T extends Knoten>(alle: T[], wurzelId: Id): Id[] {
	const treffer = [wurzelId];
	for (let i = 0; i < treffer.length; i++) {
		for (const k of alle) {
			if ((k.parentId ?? null) === treffer[i]) treffer.push(k.id);
		}
	}
	return treffer;
}

/** Wie tief der Teilbaum unter einem Knoten reicht — ein Blatt hat Höhe 1. */
export function hoehe<T extends Knoten>(alle: T[], wurzelId: Id): number {
	const kinder = kinderVon(alle, wurzelId);
	if (kinder.length === 0) return 1;
	return 1 + Math.max(...kinder.map((k) => hoehe(alle, k.id)));
}

/** Die Ebene eines Knotens, beginnend bei 1. */
export function tiefeVon<T extends Knoten>(alle: T[], id: Id | null): number {
	let tiefe = 0;
	let aktuell = id;
	const gesehen = new Set<Id>();
	while (aktuell) {
		if (gesehen.has(aktuell)) break;
		gesehen.add(aktuell);
		tiefe++;
		aktuell = alle.find((k) => k.id === aktuell)?.parentId ?? null;
	}
	return tiefe;
}

export interface Verschiebung {
	id: Id;
	/** Neuer Elternteil; `null` heisst oberste Ebene. */
	neuerElternteil: Id | null;
	/** Nullbasierte Stelle unter den neuen Geschwistern. */
	stelle: number;
}

/**
 * Verschiebt einen Knoten samt Teilbaum und gibt die neue flache Liste zurück.
 *
 * Der ganze Teilbaum wandert mit, ohne dass er dafür aufgezählt werden müsste:
 * Die Kinder hängen am Elternteil, und der behält seine Kinder. Wer die
 * Verschiebung als «Elternteil ändern und Kinder nachziehen» baut, vergisst
 * irgendwann die Enkel.
 */
export function verschiebe<T extends Knoten>(alle: T[], v: Verschiebung): T[] {
	const knoten = alle.find((k) => k.id === v.id);
	if (!knoten) {
		throw new FachlicherFehler('unbekannt', 'Das Traktandum gibt es nicht.', 'id');
	}
	// Der neue Elternteil steht in derselben Liste. Eine Kennung von anderswo
	// scheiterte sonst erst am Fremdschlüssel und endete als 500 (Kreuzteil des
	// Fremdbetreiber-Durchstichs, 27.10.2026).
	if (v.neuerElternteil !== null && !alle.some((k) => k.id === v.neuerElternteil)) {
		throw new FachlicherFehler(
			'fremdes_traktandum',
			'Der übergeordnete Punkt muss ein Traktandum derselben Versammlung sein.',
			'parentId'
		);
	}

	// Ein Knoten kann nicht unter sich selbst hängen. Ohne diese Prüfung
	// verschwände der ganze Teilbaum aus der Anzeige, weil er von der Wurzel aus
	// nicht mehr erreichbar wäre — die Daten wären noch da, die Liste aber leer.
	if (v.neuerElternteil !== null) {
		const eigenerTeilbaum = new Set(teilbaum(alle, v.id));
		if (eigenerTeilbaum.has(v.neuerElternteil)) {
			throw new FachlicherFehler(
				'ring',
				'Ein Traktandum kann nicht unter eines seiner eigenen Untertraktanden geschoben werden.',
				'parentId'
			);
		}
	}

	const zielTiefe = v.neuerElternteil === null ? 1 : tiefeVon(alle, v.neuerElternteil) + 1;
	const eigeneHoehe = hoehe(alle, v.id);
	if (zielTiefe + eigeneHoehe - 1 > GROESSTE_TIEFE) {
		throw new FachlicherFehler(
			'zu_tief',
			eigeneHoehe > 1
				? `Das Traktandum trägt ${eigeneHoehe - 1} weitere ${eigeneHoehe === 2 ? 'Ebene' : 'Ebenen'} unter sich. ` +
					`Dort verschoben, reichte es bis zur ${zielTiefe + eigeneHoehe - 1}. Ebene — mehr als ${GROESSTE_TIEFE} ist nicht vorgesehen.`
				: `Mehr als ${GROESSTE_TIEFE} Ebenen sind nicht vorgesehen.`,
			'parentId'
		);
	}

	/*
	 * **Eine Stelle, die keine Zahl ist, ist ein Fehler — keine Null.**
	 *
	 * Bis zum 21.08.2026 kam die Stelle nur aus einem festen Wert im Formular
	 * («eine Stelle höher»), und Unsinn war dort nicht möglich. Seit sie
	 * eingetippt werden kann, schon: Aus einem leeren Feld wird `Number('')`,
	 * also 0 — aber aus «abc» wird `NaN`, und `Math.max(0, Math.min(NaN, n))`
	 * ist wieder `NaN`. `slice(0, NaN)` liefert nichts, `slice(NaN)` alles: Das
	 * Traktandum landete lautlos ganz vorne, statt dass jemand eine Absage
	 * bekäme. Gemessen, nicht vermutet.
	 */
	if (!Number.isFinite(v.stelle)) {
		throw new FachlicherFehler(
			'stelle_ungueltig',
			'Geben Sie die Stelle als Zahl an.',
			'stelle'
		);
	}

	const geschwister = kinderVon(alle, v.neuerElternteil).filter((k) => k.id !== v.id);
	const stelle = Math.max(0, Math.min(Math.trunc(v.stelle), geschwister.length));
	const neueReihe = [...geschwister.slice(0, stelle), knoten, ...geschwister.slice(stelle)];

	const neuePositionen = new Map<Id, number>();
	neueReihe.forEach((k, i) => neuePositionen.set(k.id, i + 1));

	// Auch die alten Geschwister neu durchzählen: Bliebe dort eine Lücke, wäre
	// die Reihenfolge zwar gleich, aber die Positionen driften mit jeder
	// Verschiebung weiter auseinander.
	const alterElternteil = knoten.parentId ?? null;
	if (alterElternteil !== v.neuerElternteil) {
		kinderVon(alle, alterElternteil)
			.filter((k) => k.id !== v.id)
			.forEach((k, i) => neuePositionen.set(k.id, i + 1));
	}

	return alle.map((k) => {
		if (k.id === v.id) {
			return { ...k, parentId: v.neuerElternteil, position: neuePositionen.get(k.id) as number };
		}
		const neu = neuePositionen.get(k.id);
		return neu === undefined ? k : { ...k, position: neu };
	});
}

/**
 * Was sich beim Verschieben tatsächlich geändert hat.
 *
 * Nur diese Zeilen werden geschrieben. Alle Positionen neu zu schreiben, wäre
 * einfacher — und erzeugte bei jedem Ziehen so viele Verlaufseinträge, dass die
 * echten Änderungen darin untergingen.
 */
export function geaenderteZeilen<T extends Knoten>(
	vorher: T[],
	nachher: T[]
): { id: Id; parentId: Id | null; position: number }[] {
	const alt = new Map(vorher.map((k) => [k.id, k]));
	const geaendert: { id: Id; parentId: Id | null; position: number }[] = [];
	for (const k of nachher) {
		const a = alt.get(k.id);
		if (!a) continue;
		if ((a.parentId ?? null) !== (k.parentId ?? null) || a.position !== k.position) {
			geaendert.push({ id: k.id, parentId: k.parentId ?? null, position: k.position });
		}
	}
	return geaendert;
}

export function ordneUm<T extends Knoten>(
	meetingId: Id,
	alle: T[],
	v: Verschiebung
): Uebergang<T[]> {
	const neu = verschiebe(alle, v);
	const geaendert = geaenderteZeilen(alle, neu);

	if (geaendert.length === 0) return uebergang(neu);

	const vorherNummer = nummeriere(alle).find((n) => n.knoten.id === v.id)?.nummer;
	const nachherNummer = nummeriere(neu).find((n) => n.knoten.id === v.id)?.nummer;

	return uebergang(
		neu,
		ereignis(
			EREIGNISARTEN.traktandenbaumGeordnet,
			{ art: 'meeting', id: meetingId },
			{
				verschoben: v.id,
				vonNummer: vorherNummer ?? null,
				zuNummer: nachherNummer ?? null,
				neuerElternteil: v.neuerElternteil,
				betroffeneZeilen: geaendert.length
			}
		)
	);
}

/**
 * Prüft eine von Hand gesetzte Nummer.
 *
 * Erlaubt sind Ziffern, Punkte und ein angehängter Buchstabe — «2a», «3.1bis».
 * Freitext wäre verlockend, machte aber jede Sortierung und jeden Verweis im
 * Protokoll unmöglich.
 */
export function pruefeNummer(nummer: string): string | null {
	const gekuerzt = nummer.trim();
	if (gekuerzt === '') return null;
	if (!/^\d+(\.\d+)*[a-zA-Z]{0,3}$/.test(gekuerzt)) {
		throw new FachlicherFehler(
			'nummer_ungueltig',
			'Zulässig sind Ziffern, Punkte und ein angehängter Zusatz — etwa «2a» oder «3.1bis».',
			'nummerManuell'
		);
	}
	if (zeichenzahl(gekuerzt) > 20) {
		throw new FachlicherFehler('nummer_zu_lang', 'Die Nummer ist zu lang.', 'nummerManuell');
	}
	return gekuerzt;
}
