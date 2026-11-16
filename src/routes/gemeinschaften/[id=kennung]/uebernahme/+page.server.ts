import { error, fail } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import {
	fuehreUebernahmeAus,
	quotenschluessel,
	vorschauAusTabelle
} from '$lib/server/uebernahme';
import { ausFeldern, zerlege, type CsvErgebnis } from '$lib/domain/csv';
import {
	erkenneArt,
	kennungenAusVorschau,
	type Uebernahmevorschau
} from '$lib/domain/uebernahme';
import { zeilenAusMappe, MappenFehler } from '$lib/domain/xlsxlesen';
import { entpacke } from '$lib/server/paketpruefung';
import {
	holeLiegenschaften,
	holeStammdaten,
	ImmotoolFehler,
	istEingerichtet
} from '$lib/server/immotool';
import { alsUebernahmedateien } from '$lib/domain/immotool';
import { DateiFehler, HOECHSTGROESSE } from '$lib/server/dateien';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdeGemeinschaft } from '$lib/domain/fehler';
import { jaNein, text } from '$lib/server/formular';
import type { Actions, PageServerLoad } from './$types';
import { istKalendertag } from '$lib/domain/datum';

function heute(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/**
 * Der Stichtag aus dem Formular — oder heute, wenn keiner dasteht.
 *
 * **Mit Formatprüfung** (01.09.2026, aus dem Code-Review). Seit die Vorschau den
 * Eigentumsstand liest, geht der Wert schon dort in eine Abfrage. Ein
 * unlesbarer — aus einem Browser ohne Datumsfeld, aus einem alten Reiter, aus
 * einem von Hand gebauten Aufruf — gäbe eine rohe 500 aus der Datenbank, statt
 * die Absage, die `planeZuordnung` später gäbe. Die Prüfung steht deshalb vor
 * dem ersten Lesen, und ihr Satz nennt das Format.
 */
function stichtagAus(wert: string): string {
	const s = wert.trim();
	if (!s) return heute();
	if (!istKalendertag(s)) {
		throw new FachlicherFehler(
			'stichtag_ungueltig',
			'Der Stichtag ist kein gültiges Datum. Erwartet wird ein Tag im Format 2026-09-01.',
			'stichtag'
		);
	}
	return s;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	/*
	 * **Die Liegenschaften werden beim Öffnen geholt, nicht erst beim Klick.**
	 * Sonst stünde die Wahl als leere Liste da und füllte sich erst nach einem
	 * Abschicken. Antwortet immotool nicht, bleibt die Liste leer und der Weg
	 * verschwindet — die Datei und die Erfassung von Hand bleiben.
	 */
	let liegenschaften: Awaited<ReturnType<typeof holeLiegenschaften>> = [];
	let immotoolFehler: string | null = null;
	if (istEingerichtet()) {
		try {
			liegenschaften = await holeLiegenschaften();
		} catch (fehler) {
			immotoolFehler =
				fehler instanceof ImmotoolFehler ? fehler.message : 'immotool antwortet nicht.';
		}
	}

	return {
		gemeinschaft,
		heute: heute(),
		immotool: { eingerichtet: istEingerichtet(), liegenschaften, fehler: immotoolFehler }
	};
};

/**
 * Eine Datei als gelesene Tabelle — CSV oder Excel.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «und wie kann ich den CSV oder Excel
 * Import machen?» Es ging nur mit CSV. Wer eine Excel-Datei hat, musste sie
 * erst als CSV speichern — und wählte dabei Trennzeichen und Zeichensatz, also
 * genau die zwei Dinge, an denen ein Import scheitert.
 *
 * **Erkannt wird am Inhalt, nicht an der Endung.** Ein `.xlsx` beginnt mit
 * «PK» — es ist ein ZIP-Archiv. Wer eine CSV in «liste.xlsx» umbenennt, bekommt
 * damit trotzdem seine CSV gelesen, und umgekehrt.
 */
async function leseTabelle(datei: File): Promise<CsvErgebnis> {
	if (datei.size > HOECHSTGROESSE) {
		throw new DateiFehler('zu_gross', 'Die Datei ist zu gross.');
	}
	const bytes = new Uint8Array(await datei.arrayBuffer());

	/*
	 * **Die volle Signatur, nicht zwei Bytes** (25.08.2026, aus der Prüfung).
	 * «PK» allein trifft auch eine gewöhnliche CSV, deren erste Spalte «PKZ»
	 * oder «PKW» heisst — die endete dann in einem Serverfehler.
	 */
	if (bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
		try {
			// Das Trennzeichen ist für eine Mappe bedeutungslos; der Tabulator
			// steht hier nur, weil das Feld nicht leer bleiben darf.
			return ausFeldern(zeilenAusMappe(entpacke(bytes)), '\t');
		} catch (fehler) {
			/*
			 * **Alles wird zur Absage, nichts zum Serverfehler.** Eine abgebrochene
			 * Datei wirft `PaketFehler`, ein verdorbener Verdichtungsstrom einen
			 * nackten `Error` mit englischem Text, ein unmöglicher Zeichenpunkt
			 * einen `RangeError`. Für den Benutzer ist das alles dasselbe: Die
			 * Datei lässt sich nicht lesen.
			 */
			if (fehler instanceof MappenFehler) throw fehler;
			throw new MappenFehler(
				'Die Datei lässt sich nicht öffnen. Vielleicht ist sie beim Herunterladen ' +
					'abgebrochen — laden Sie sie noch einmal, oder speichern Sie sie in Excel neu.'
			);
		}
	}

	// Eine alte `.xls` beginnt mit einem eigenen Kennzeichen und käme sonst als
	// Kauderwelsch durch die Textprüfung.
	if (
		bytes.length > 7 &&
		bytes[0] === 0xd0 &&
		bytes[1] === 0xcf &&
		bytes[2] === 0x11 &&
		bytes[3] === 0xe0
	) {
		throw new MappenFehler(
			'Das ist eine alte Excel-Datei (.xls). Öffnen Sie sie in Excel und speichern Sie sie ' +
				'als «.xlsx».'
		);
	}

	/*
	 * Excel schreibt in der Schweiz gern in Windows-1252 statt UTF-8. Ein «ü»
	 * wird dann zu einem Ersatzzeichen — sichtbar, aber nicht als Fehler.
	 * Deshalb wird geprüft und, wenn nötig, in der anderen Kodierung nochmals
	 * gelesen.
	 */
	const alsUtf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
	return zerlege(alsUtf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : alsUtf8);
}

/**
 * Eine gelesene Tabelle für das versteckte Feld — knapp.
 *
 * **Warum nicht `JSON.stringify(tabelle)`** (25.08.2026, aus der Prüfung).
 * Eine Tabelle führt je Zeile ein Objekt mit allen Spaltennamen; als JSON
 * wiederholt sich damit jeder Spaltenname in jeder Zeile. Gemessen war das
 * **4,6-mal** so gross wie die CSV: Bei 1000 Zeilen 952 KB — und
 * `adapter-node` nimmt ohne eigene Einstellung nur 512 KB entgegen. Der Fehler
 * fiele an der unangenehmsten Stelle an: «Prüfen» zeigt die Vorschau,
 * «Übernehmen» endet in einer nackten Fehlerseite. Auf Dev fiele er gar nicht
 * auf, weil `vite dev` keine solche Schranke kennt.
 *
 * Hier stehen die Spalten **einmal** und die Zeilen als Werteliste in
 * Spaltenreihenfolge. Das ist etwa so gross wie die CSV selbst.
 */
function fuersFeld(t: CsvErgebnis): string {
	return JSON.stringify({
		s: t.spalten,
		t: t.trennzeichen,
		z: t.zeilen.map((z) => [z.nummer, ...t.spalten.map((sp) => (Object.hasOwn(z.werte, sp) ? z.werte[sp] : ''))])
	});
}

/**
 * Was im versteckten Feld steht, wieder als Tabelle.
 *
 * Beide ersten Schritte — Datei und immotool — legen dort seit dem 25.08.2026
 * eine **gelesene** Tabelle als JSON ab. Eine CSV-Zeichenkette kommt trotzdem
 * noch an: aus einem Formular, das vor dem Umbau geöffnet wurde. Sie wird
 * gelesen wie bisher, statt mit einer Fehlermeldung abzuweisen, die niemand
 * versteht.
 */
function alsTabelle(inhalt: string): CsvErgebnis {
	if (inhalt.trimStart().startsWith('{')) {
		try {
			return geprueft(JSON.parse(inhalt));
		} catch {
			// Kein JSON oder keine Tabelle — dann eben als CSV.
		}
	}
	return zerlege(inhalt);
}

/**
 * Prüft, dass das JSON wirklich eine gelesene Tabelle ist.
 *
 * **Ein `as CsvErgebnis` wäre eine Behauptung** (25.08.2026, aus der Prüfung).
 * Das Feld kommt aus dem Formular, also von aussen; gemessen erzeugten vier von
 * fünf verdrehten Formen einen Serverfehler tief im Kern («…trim is not a
 * function»), und eine sechste schleuste ein Objekt bis in einen
 * SQL-Parameter. Der Weg verlangt zwar ein Verwaltungskonto des eigenen
 * Betreibers — aber ein Fehler, den schon das Zurückspringen im Browser
 * auslösen kann, gehört gefangen.
 *
 * Werte werden dabei zu Zeichenketten gemacht statt abgewiesen: Eine Zahl in
 * einer Zelle ist keine Bosheit, sondern der Normalfall.
 */
function geprueft(roh: unknown): CsvErgebnis {
	if (typeof roh !== 'object' || roh === null) throw new Error('keine Tabelle');
	const o = roh as Record<string, unknown>;

	if (!Array.isArray(o.s) || !o.s.every((x) => typeof x === 'string')) {
		throw new Error('keine Spalten');
	}
	if (!Array.isArray(o.z)) throw new Error('keine Zeilen');

	const spalten = o.s as string[];
	const zeilen = o.z.map((z, i) => {
		if (!Array.isArray(z)) throw new Error('Zeile ist keine Liste');
		const [nummer, ...werte] = z;
		return {
			nummer: typeof nummer === 'number' ? nummer : i + 2,
			// Werte werden zu Zeichenketten gemacht statt abgewiesen: Eine Zahl in
			// einer Zelle ist keine Bosheit, sondern der Normalfall.
			werte: Object.fromEntries(
				spalten.map((sp, k) => [sp, werte[k] == null ? '' : String(werte[k])])
			)
		};
	});

	return { spalten, zeilen, trennzeichen: typeof o.t === 'string' ? o.t : ';' };
}

/**
 * Die Vorschauen einer Auswahl — samt der Kennungen, die darin mitkommen.
 *
 * **Warum das eine Funktion ist** (01.09.2026, zweite Runde des Code-Reviews):
 * Derselbe Ablauf stand dreimal da (Dateiauswahl, immotool-Weg und der
 * Wiederaufbau nach einer Rückfrage). Der erste Fix erreichte nur den ersten,
 * und auf den beiden anderen blieb die falsche Warnung stehen. Drei Kopien
 * eines Ablaufs sind drei Gelegenheiten, eine davon zu vergessen.
 *
 * Der Reihenfolge wegen wird zweimal gelesen: erst die Kennungen aus allen
 * Tabellen, dann die Vorschauen. Eine Einheitentabelle darf nicht davon
 * abhängen, ob die Eigentümerdatei vor oder nach ihr steht.
 */
async function plaeneFuerAuswahl(
	operatorId: string,
	stwegId: string,
	tabellen: CsvErgebnis[],
	stichtag: string
) {
	/*
	 * **Zwei Durchgaenge, und die Reihenfolge kommt aus der Art** (02.09.2026,
	 * dritte Runde des Code-Reviews). Erst die Eigentuemertabellen vorschauen,
	 * dann aus deren Ergebnis die Kennungen ziehen, dann die uebrigen. So liest
	 * die Einheitenvorschau, was wirklich entsteht, statt einer nachgebauten
	 * Regel zu folgen.
	 *
	 * Gefragt wird `erkenneArt` und nicht die Position: Die Sortierung nach
	 * Eigentuemern zuerst gibt es nur auf dem Weg ueber die Dateiauswahl, nicht
	 * auf dem immotool-Weg und nicht beim Wiederaufbau nach einer Rueckfrage.
	 */
	const istEigentuemer = (t: CsvErgebnis) => erkenneArt(t.spalten) === 'eigentuemer';
	const plaene = new Map<CsvErgebnis, Uebernahmevorschau>();

	for (const t of tabellen.filter(istEigentuemer)) {
		plaene.set(t, await vorschauAusTabelle(operatorId, stwegId, t, stichtag));
	}
	const kommendeKennungen = [...plaene.values()].flatMap(kennungenAusVorschau);
	for (const t of tabellen.filter((t) => !istEigentuemer(t))) {
		plaene.set(t, await vorschauAusTabelle(operatorId, stwegId, t, stichtag, kommendeKennungen));
	}

	// In der Reihenfolge zurueck, in der sie hereinkamen — die Seite zeigt sie so.
	return tabellen.map((t) => plaene.get(t)!);
}

/**
 * Die Absage, wenn die Gemeinschaft aus dem Pfad nicht diesem Betreiber gehört.
 *
 * **Jede Aktion fragt sie als Erstes** (Auftrag 2g, 29.10.2026). Nur `load`
 * suchte die Gemeinschaft; die Aktionen nahmen `params.id` ungeprüft, und
 * `pruefen` zeigte unter A mit der Kennung von B eine Vorschau mit «neu».
 * Zu sehen war von B nichts, weil der Zeilenschutz dort leer liest; es fehlte
 * die Absage.
 *
 * **Hier und nicht in `plaeneFuerAuswahl`:** `ausImmotool` holt die
 * Stammdaten bei immotool, bevor es dort ankäme, und alle drei lesen davor
 * das Formular. Die Prüfung in `fuehreUebernahmeAus` (Auftrag 2f)
 * bleibt; sie gilt in der Transaktion, die schreibt.
 */
async function fremdeAbsage(operatorId: string, stwegId: string) {
	if (await holeGemeinschaft(operatorId, stwegId)) return null;
	const f = fremdeGemeinschaft('stwegId');
	return fail(400, { fehler: { nachricht: f.message, feld: f.feld } });
}

export const actions: Actions = {
	/** Erster Schritt: zeigen, was geschehen würde. */
	pruefen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const fremd = await fremdeAbsage(locals.benutzer.operatorId, params.id);
		if (fremd) return fremd;
		const daten = await request.formData();
		/*
		 * **Beide Dateien auf einmal** (23.08.2026, Prüflauf II). Der Text nebenan
		 * sagt seit je «eine Datei für Eigentümer …, eine für Einheiten» — das Feld
		 * nahm aber nur eine, und dass man zweimal durch muss, stand nirgends. Wer
		 * die Einheiten zuerst einspielte, bekam vierzehn Zeilen «Kein Eigentümer
		 * zugeordnet» und keinen Hinweis, was fehlt.
		 */
		const dateien = daten
			.getAll('datei')
			.filter((d): d is File => d instanceof File && d.size > 0);

		if (dateien.length === 0) {
			return fail(400, { fehler: { nachricht: 'Keine Datei gewählt.' } });
		}

		try {
			const gelesen = await Promise.all(
				dateien.map(async (d) => ({ name: d.name, tabelle: await leseTabelle(d) }))
			);

			/*
			 * **Eigentümer zuerst, immer.** Die Einheiten verweisen über
			 * `owner_voter_ref` auf sie; umgekehrt fände die Zuordnung niemanden.
			 * Sortiert wird nach dem Inhalt, nicht nach dem Dateinamen — der sagt
			 * nichts, und wer «einheiten.csv» zuerst wählt, meint dasselbe.
			 */
			// Gefragt wird die **gelesene** Tabelle, nicht ihre erste Zeile: Seit es
			// auch Excel-Dateien gibt, hat nicht jede Quelle eine Textzeile
			// (25.08.2026). Und die Spaltenliste ist ohnehin die verlässlichere
			// Auskunft als ein Ausdruck über den Rohtext.
			// **Dieselbe Erkennung wie der Kern** (zweite Prüfrunde). Ein eigener
			// Ausdruck bildete `erkenneArt` nicht ab: Dort haben `holding_ref` und
			// `unit_ref` Vorrang, eine Einheitendatei mit einer `voter_ref`-Spalte
			// wanderte damit nach vorn.
			const eigentuemerzeile = (t: CsvErgebnis) => erkenneArt(t.spalten) === 'eigentuemer';
			gelesen.sort((a, b) => Number(eigentuemerzeile(b.tabelle)) - Number(eigentuemerzeile(a.tabelle)));

			/*
			 * **Der Stichtag der Vorschau ist heute** (01.09.2026). Gewählt wird er
			 * erst auf der Vorschauseite; bis dahin liest die Anwendung den
			 * Eigentumsstand von heute, und die Seite nennt diesen Tag. Beim
			 * Ausführen wird die Vorschau ohnehin neu gerechnet — dann mit dem
			 * gewählten Tag, und die Rückfrage bei ungleicher Wertquote bezieht
			 * sich auf ihn.
			 */
			const vorschautag = heute();
			/*
			 * **Was gleich mitkommt, gilt als vorhanden** (01.09.2026, aus dem
			 * Code-Review). Beide Vorschauen rechnen gegen denselben
			 * Datenbankstand — dazwischen wird nichts eingespielt. Bei einer
			 * Erstübernahme kennt der noch keinen Eigentümer, und die
			 * Einheitenvorschau hielte jede Kennung für unbekannt, obwohl die
			 * Eigentümerdatei oben in derselben Auswahl liegt und vorsortiert
			 * zuerst ausgeführt wird.
			 */
			const plaene = await plaeneFuerAuswahl(
				locals.benutzer.operatorId,
				params.id,
				gelesen.map((g) => g.tabelle),
				vorschautag
			);
			return {
				vorschautag,
				plaene,
				/*
				 * Der Inhalt geht zurück in ein verstecktes Feld, damit der zweite
				 * Schritt genau dieselben Dateien übernimmt und nicht andere, die
				 * inzwischen gewählt wurden.
				 *
				 * **Als JSON, seit es auch Excel-Dateien gibt** (25.08.2026). Eine
				 * gelesene Tabelle ist kein Text mehr; sie in eine CSV
				 * zurückzuverwandeln, nur um sie im zweiten Schritt wieder
				 * auseinanderzunehmen, wäre eine Umwandlung zu viel — und die
				 * Stelle, an der ein Semikolon im Namen etwas kaputtmacht.
				 */
				inhalte: gelesen.map((g) => fuersFeld(g.tabelle)),
				herkunft: gelesen.map((g) => g.name).join(' + '),
				ausDatei: true
			};
		} catch (fehler) {
			if (fehler instanceof DateiFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			// Eine unlesbare Arbeitsmappe ist eine Absage an den Benutzer, kein
			// Serverfehler — die Meldung sagt, was er tun kann.
			if (fehler instanceof MappenFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/**
	 * Derselbe erste Schritt, nur kommt der Inhalt aus immotool (FR-7).
	 *
	 * **Zwei Dateien statt einer**, und die Reihenfolge ist keine Geschmacksfrage:
	 * Eine Einheit verweist über `owner_voter_ref` auf ihren Eigentümer. Käme sie
	 * zuerst, fände die Zuordnung niemanden und die Einheit stünde ohne
	 * Eigentümer da — ohne Fehlermeldung, weil das ein zulässiger Zustand ist.
	 */
	/*
	 * kennung: liegenschaft — keine Kennung dieser Anwendung, sondern die einer
	 * Liegenschaft im immotool. Sie wird über dessen Schnittstelle gelesen
	 * (`holeStammdaten`) und nie geschrieben; was daraus entsteht, legt
	 * `vorschauAusTabelle` unter `params.id` an.
	 */
	ausImmotool: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const fremd = await fremdeAbsage(locals.benutzer.operatorId, params.id);
		if (fremd) return fremd;
		const daten = await request.formData();
		const liegenschaft = text(daten.get('liegenschaft'));

		if (!liegenschaft) {
			return fail(400, { fehler: { nachricht: 'Keine Liegenschaft gewählt.' } });
		}

		let stichtag: string;
		try {
			stichtag = stichtagAus(text(daten.get('stichtag')));
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}

		try {
			const arten = await quotenschluessel(locals.benutzer.operatorId, params.id);
			const stammdaten = await holeStammdaten(liegenschaft, stichtag);
			const dateien = alsUebernahmedateien(stammdaten, arten);

			// Beide Wege — Datei und immotool — reichen dasselbe weiter: eine
			// gelesene Tabelle. Der zweite Schritt muss dann nicht raten, was er
			// vor sich hat (25.08.2026).
			const tabellen = [zerlege(dateien.eigentuemer), zerlege(dateien.einheiten)];
			const inhalte = tabellen.map(fuersFeld);
			// Hier steht der Stichtag schon fest: Er hat die Stammdaten aus immotool
			// bestimmt und bestimmt denselben Eigentumsstand hier.
			const plaene = await plaeneFuerAuswahl(
				locals.benutzer.operatorId,
				params.id,
				tabellen,
				stichtag
			);

			return {
				plaene,
				inhalte,
				herkunft: `immotool · ${stammdaten.property.name}`,
				ausDatei: false,
				hinweise: dateien.hinweise,
				stichtag
			};
		} catch (fehler) {
			if (fehler instanceof ImmotoolFehler) {
				return fail(502, { fehler: { nachricht: fehler.message } });
			}
			if (fehler instanceof Error && fehler.name === 'TimeoutError') {
				return fail(504, {
					fehler: { nachricht: 'immotool hat nicht rechtzeitig geantwortet.' }
				});
			}
			throw fehler;
		}
	},

	/** Zweiter Schritt: übernehmen, was gezeigt wurde. */
	uebernehmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const fremd = await fremdeAbsage(locals.benutzer.operatorId, params.id);
		if (fremd) return fremd;
		const daten = await request.formData();
		const inhalte = daten.getAll('inhalt').map((w) => String(w));
		const trotzUngleichgewicht = jaNein(daten.get('trotzUngleichgewicht'));
		/*
		 * Herkunft und Hinweise reisen durch das Formular mit.
		 *
		 * Sie werden für die Rückfrage bei ungleicher Wertquote gebraucht — und
		 * genau dann darf nichts davon fehlen: Wer entscheiden soll, ob er trotzdem
		 * übernimmt, muss weiter sehen, was nicht mitkommt. Die Vorschau wird für
		 * die Rückfrage neu gerechnet, die Hinweise aber nicht; sie stammen aus der
		 * Umwandlung, und die läge sonst einen Abruf zurück.
		 */
		const ausDatei = jaNein(daten.get('ausDatei'));
		const hinweise = daten.getAll('hinweis').map((w) => String(w));

		if (inhalte.length === 0 || inhalte.every((i) => !i)) {
			return fail(400, { fehler: { nachricht: 'Kein Inhalt zum Übernehmen.' } });
		}

		/*
		 * **Der Stichtag wird geprüft, bevor er in eine Abfrage geht** (01.09.2026).
		 * Innerhalb des Versuchs, denn die Absage gehört als Meldung auf die Seite
		 * und nicht als 500 in den Browser — der `catch` unten macht daraus
		 * `fail(400)`.
		 */
		let stichtag: string;
		try {
			stichtag = stichtagAus(text(daten.get('stichtag')));
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}

		const tabellen = inhalte.map(alsTabelle);
		const plaene = await plaeneFuerAuswahl(
			locals.benutzer.operatorId,
			params.id,
			tabellen,
			stichtag
		);

		// Zweite Bestätigung, wenn die Stammquote danach nicht mehr aufginge. Ein
		// stilles Durchlaufen findet nie statt.
		if (plaene.some((p) => p.bringtQuotenAusDemGleichgewicht) && !trotzUngleichgewicht) {
			return fail(409, {
				plaene,
				inhalte,
				ausDatei,
				hinweise,
				stichtag,
				warnungQuoten: true
			});
		}

		try {
			const ergebnis = { angelegt: 0, geaendert: 0, uebersprungen: 0, imArchiv: 0 };
			for (const tabelle of tabellen) {
				const teil = await fuehreUebernahmeAus(
					{
						operatorId: locals.benutzer.operatorId,
						userId: locals.benutzer.id,
						label: locals.benutzer.displayName
					},
					params.id,
					tabelle,
					stichtag
				);
				ergebnis.angelegt += teil.angelegt;
				ergebnis.geaendert += teil.geaendert;
				ergebnis.uebersprungen += teil.uebersprungen;
				ergebnis.imArchiv += teil.imArchiv;
			}
			return { ergebnis };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
