/**
 * Gehört diese Kennung zu **dieser** Gemeinschaft?
 *
 * **Der Befund vom 26.08.2026 (Sicherheitsprüfung).** Die Seiten unter
 * `gemeinschaften/[id=kennung]/` nehmen Kennungen aus verborgenen Feldern und
 * Auswahllisten entgegen — also von aussen. Der Zeilenschutz der Datenbank
 * bindet `party`, `unit`, `representation`, `usufruct` und
 * `bylaw_quorum_rule` an den **Betreiber**, nicht an die Gemeinschaft. Wer zwei
 * Gemeinschaften verwaltet, traf mit einer Kennung aus der einen die Aktion der
 * anderen: Die Route sagte «diese Gemeinschaft», und die Aktion prüfte es nicht
 * nach.
 *
 * **Kein Rechtegewinn** — die Rolle `admin` ist betreiberweit, und der
 * Zeilenschutz hält die Mandantengrenze. Es fehlte eine **Zusicherung**: dass
 * eine Aktion nur trifft, was auf der Seite steht, von der sie ausgelöst wurde.
 * Ohne sie wirkt jeder Knopf auf einen Bestand, den der Benutzer gerade nicht
 * ansieht — und eine Berichtigung, die stillschweigend die Nachbargemeinschaft
 * trifft, fällt frühestens beim nächsten Abrechnen auf.
 *
 * **Je Art eine eigene Prüfung, mit Absicht.** Eine einzige Funktion, die
 * überall die Parteitabelle befragte, meldete für eine Einheit, eine
 * Vertretung oder eine Nutzniessung immer «gehört nicht dazu» und sperrte
 * damit einen gültigen Weg. Was hier steht, fragt jeweils die Tabelle, in der
 * die Kennung wirklich lebt.
 *
 * **Die Person ist ein eigener Fall.** `person` trägt keine `stweg_id` — eine
 * Person kann in mehreren Gemeinschaften eine Zeile haben und gehört keiner
 * davon. Eine Prüfung «Person gehört zur Gemeinschaft» wäre erfunden und
 * sperrte den Weg, für den es sie gibt.
 *
 * **Die engere Schranke gibt es trotzdem** (26.08.2026, aus der
 * Sicherheitsprüfung der Behebung): Wo eine Aktion an der Person **derselben
 * Zeile** schreibt, muss die Person die der Zeile sein — `pruefePersonAnZeile`.
 * Ohne sie überschrieb ein gefälschtes `personId` auf der Seite von A die
 * Bemerkung einer Person, die nur in B eine Zeile hat: derselbe Fehler, eine
 * Schicht tiefer.
 *
 * Wer eine Person **neu** an eine Zeile klammert, kann diese Schranke nicht
 * haben — dort ist jede noch nicht verknüpfte Person zulässig. Geprüft wird
 * dann die Zeile (`pruefeParteiGehoert`), und `schreibeKlammer` weist ab, wenn
 * dieselbe Person in derselben Gemeinschaft schon eine zweite Zeile hat.
 *
 * Der Wächter `scripts/check-kennungen.mjs` hält fest, dass jede Aktion unter
 * `[id=kennung]` ihre Kennungsfelder hierher gibt.
 */
import { FachlicherFehler } from '$lib/domain/fehler';
import type { Id } from '$lib/domain/types';
import { alsBetreiber } from './db';

/**
 * Die Tabellen, in denen eine Kennung leben kann, samt der Spalte, die sie an
 * eine Gemeinschaft bindet.
 *
 * Als Tabelle statt als fünf Abfragen: Der Ablauf ist derselbe, und fünf
 * Abschriften liefen auseinander, sobald eine davon etwas mehr tut.
 */
const ARTEN = {
	partei: {
		tabelle: 'party',
		satz: 'Diese Eigentümerzeile gehört nicht zu dieser Gemeinschaft.',
		kennung: 'fremde_partei'
	},
	einheit: {
		tabelle: 'unit',
		satz: 'Diese Einheit gehört nicht zu dieser Gemeinschaft.',
		kennung: 'fremde_einheit'
	},
	vertretung: {
		tabelle: 'representation',
		satz: 'Diese Vertretung gehört nicht zu dieser Gemeinschaft.',
		kennung: 'fremde_vertretung'
	},
	nutzniessung: {
		tabelle: 'usufruct',
		satz: 'Diese Nutzniessung gehört nicht zu dieser Gemeinschaft.',
		kennung: 'fremde_nutzniessung'
	},
	reglementsregel: {
		tabelle: 'bylaw_quorum_rule',
		satz: 'Diese Regel gehört nicht zu dieser Gemeinschaft.',
		kennung: 'fremde_regel'
	}
} as const;

type Art = keyof typeof ARTEN;

/**
 * Eine Kennung, wie `uuidv7()` sie vergibt.
 *
 * **Warum das vor der Abfrage steht.** `WHERE id = ''` — oder `id = 'x'` —
 * scheitert an der Umwandlung nach `uuid` mit `22P02`, und das käme als rohe
 * 500 zurück: eine leere Seite ohne Hinweis, mitten im Saal. Ein fehlendes Feld
 * ist aber genau derselbe Fall wie eine fremde Kennung, und die richtige
 * Antwort darauf ist dieselbe Absage.
 */
export const KENNUNGSFORM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Die eine Abfrage hinter allen Prüfungen.
 *
 * **Der Tabellenname wird NICHT aus der Eingabe gebildet.** Er kommt aus
 * `ARTEN` und damit aus diesem Modul; von aussen kommt nur die Kennung, und die
 * reist als `$1`. `unsafe` heisst «ungeprüfter Bezeichner», nicht «ungeprüfte
 * Werte» — dasselbe Muster wie in `archivieren.ts`.
 */
async function gehoert(
	art: Art,
	operatorId: Id,
	stwegId: Id,
	kennung: string | null | undefined
): Promise<void> {
	const { tabelle, satz, kennung: fehlerkennung } = ARTEN[art];
	/*
	 * **Ohne Feldmarkierung, mit Absicht** (26.08.2026, aus dem Code-Review).
	 *
	 * Die erste Fassung setzte `feld` auf `` `${art}Id` `` — heraus kamen
	 * `einheitId`, `vertretungId`, `nutzniessungId`, `reglementsregelId`, und
	 * die Formulare heissen `unitId`, `id`, `id`, `regelId`. Vier von fünf
	 * Markierungen zeigten auf ein Feld, das es nicht gibt. Heute folgenlos,
	 * weil keine der vier Seiten `fehler.feld` liest — die Personenseite tut es
	 * aber (`aufgeklappt(form?.fehler?.feld === 'name')`), und die nächste, die
	 * es übernimmt, klappte ins Leere.
	 *
	 * Den Namen mitzugeben hiesse, ihn an jeder Aufrufstelle zu wiederholen —
	 * und dann bewachte der Kennungswächter eine Zeichenkette statt eines
	 * Werts. **Richtig ist gar keine Markierung**: Diese Absage ist kein
	 * Tippfehler in einem Feld. Der Benutzer kann sie nicht durch Ändern einer
	 * Eingabe beheben; das Formular kam aus einer veralteten oder fremden
	 * Seite. Ein markiertes Feld forderte ihn auf, etwas zu berichtigen, was
	 * nicht falsch ist. Der Satz sagt, worum es geht.
	 */
	const absage = () => new FachlicherFehler(fehlerkennung, satz);

	if (!kennung || !KENNUNGSFORM.test(kennung)) throw absage();

	const treffer = await alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx.unsafe<{ eins: number }[]>(
			`SELECT 1 AS eins FROM ${tabelle} WHERE id = $1 AND stweg_id = $2`,
			[kennung, stwegId]
		);
		return zeilen.length > 0;
	});

	if (!treffer) throw absage();
}

/**
 * Sagt ab, wenn die Eigentümerzeile nicht zu dieser Gemeinschaft gehört.
 *
 * **Auch die archivierten zählen als «gehört dazu».** Das Archiv nimmt eine
 * Zeile aus der Liste, nicht aus der Gemeinschaft — sonst wiese ausgerechnet
 * «Hervorholen» seine eigene Zeile ab.
 */
export function pruefeParteiGehoert(
	operatorId: Id,
	stwegId: Id,
	parteiId: string | null | undefined
): Promise<void> {
	return gehoert('partei', operatorId, stwegId, parteiId);
}

/** Sagt ab, wenn die Einheit nicht zu dieser Gemeinschaft gehört. */
export function pruefeEinheitGehoert(
	operatorId: Id,
	stwegId: Id,
	einheitId: string | null | undefined
): Promise<void> {
	return gehoert('einheit', operatorId, stwegId, einheitId);
}

/**
 * Dasselbe für eine ganze Liste — **vor** dem ersten Schreiben und in einer
 * Abfrage.
 *
 * **Warum es das gibt** (26.08.2026, aus dem Code-Review der Behebung). Die
 * Einheitentabelle wird als Ganzes gespeichert. Stand die Prüfung in der
 * Schleife, waren beim Abweisen der dritten Kennung die ersten beiden schon
 * geschrieben — der Benutzer sah nur die Absage und hielt die Tabelle für
 * unverändert. Und jede Runde öffnete eine eigene Transaktion: bei vierzig
 * Einheiten vierzig zusätzliche Umläufe, nur zum Prüfen.
 *
 * Gemeldet wird «eine davon», nicht welche: Die Kennung stünde für den
 * Benutzer ohnehin nur als Zeichenkette da, und ein Nachschlag des Namens
 * verriete etwas über die fremde Gemeinschaft.
 *
 * bindung: einheitIds — Die Prüfung IST der Vergleich: `erwartet` aus den
 *   Kennungen gegen die Zeilen, die `stweg_id` geliefert hat.
 */
export async function pruefeEinheitenGehoeren(
	operatorId: Id,
	stwegId: Id,
	einheitIds: readonly string[]
): Promise<void> {
	const absage = () =>
		new FachlicherFehler(
			'fremde_einheit',
			'Eine der Einheiten gehört nicht zu dieser Gemeinschaft.'
		);

	if (einheitIds.length === 0) return;
	if (einheitIds.some((k) => !KENNUNGSFORM.test(k))) throw absage();

	/*
	 * **Kleingeschrieben, bevor gezählt wird** (26.08.2026, aus dem Code-Review).
	 * `KENNUNGSFORM` lässt Grossbuchstaben zu, und für Postgres bezeichnen
	 * `A1B2…` und `a1b2…` dieselbe Zeile — für ein `Set` in JavaScript nicht.
	 * Käme dieselbe Einheit einmal so und einmal so, stünde eine gefundene Zeile
	 * gegen zwei erwartete, und ein gültiges Speichern wäre abgewiesen.
	 */
	const erwartet = new Set(einheitIds.map((k) => k.toLowerCase()));

	const gefunden = await alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ id: string }[]>`
			SELECT DISTINCT id FROM unit
			 WHERE id = ANY(${[...erwartet]}::uuid[]) AND stweg_id = ${stwegId}
		`;
		return zeilen.length;
	});

	// Über die **Anzahl** verglichen, nicht Zeile für Zeile: Eine doppelt
	// geschickte Kennung dürfte den Zähler sonst auffüllen.
	if (gefunden !== erwartet.size) throw absage();
}

/** Sagt ab, wenn die Vertretung nicht zu dieser Gemeinschaft gehört. */
export function pruefeVertretungGehoert(
	operatorId: Id,
	stwegId: Id,
	vertretungId: string | null | undefined
): Promise<void> {
	return gehoert('vertretung', operatorId, stwegId, vertretungId);
}

/** Sagt ab, wenn die Nutzniessung nicht zu dieser Gemeinschaft gehört. */
export function pruefeNutzniessungGehoert(
	operatorId: Id,
	stwegId: Id,
	nutzniessungId: string | null | undefined
): Promise<void> {
	return gehoert('nutzniessung', operatorId, stwegId, nutzniessungId);
}

/** Sagt ab, wenn die Reglementsregel nicht zu dieser Gemeinschaft gehört. */
export function pruefeReglementsregelGehoert(
	operatorId: Id,
	stwegId: Id,
	regelId: string | null | undefined
): Promise<void> {
	return gehoert('reglementsregel', operatorId, stwegId, regelId);
}

/**
 * Sagt ab, wenn diese Person nicht die der Eigentümerzeile ist.
 *
 * **Die Frage ist eine andere als oben** — nicht «gehört zur Gemeinschaft»,
 * sondern «hängt an dieser Zeile». Deshalb nimmt sie die Parteikennung und
 * nicht die der Gemeinschaft; der Aufrufer prüft die Zeile davor mit
 * `pruefeParteiGehoert`, und über sie ist die Person dann mittelbar gebunden.
 *
 * **Nur für Wege, die an der Person der Zeile schreiben** — die Bemerkung im
 * Formular «Angaben berichtigen». Für das Klammern einer neuen Person taugt sie
 * nicht: Dort ist die Zeile ja gerade noch mit keiner verknüpft.
 *
 * **Was sie dadurch nicht verhindert, und warum das in Ordnung ist**
 * (26.08.2026, aus dem Code-Review): Wer von der Seite der Gemeinschaft A aus
 * eine Person, die bisher nur in B eine Zeile hatte, an eine Zeile von A
 * klammert, darf danach deren Bemerkung schreiben. Das ist kein Umweg um die
 * Schranke, sondern ihre Bedeutung — nach dem Klammern gehört die Person auch
 * zu A. Die Personenliste zur Auswahl steht ohnehin betreiberweit offen
 * (`holePersonen(operatorId, …)`), weil eine Person genau das ist: dieselbe
 * über alle Gemeinschaften hinweg.
 */
export async function pruefePersonAnZeile(
	operatorId: Id,
	parteiId: string,
	personId: string | null | undefined
): Promise<void> {
	const absage = () =>
		new FachlicherFehler(
			'fremde_person',
			'Diese Person gehört nicht zu dieser Eigentümerzeile.'
		);

	if (!personId || !KENNUNGSFORM.test(personId)) throw absage();

	/*
	 * **Verglichen wird in der Datenbank, nicht in JavaScript** (26.08.2026, aus
	 * dem Code-Review). `KENNUNGSFORM` lässt Grossbuchstaben durch — `A1B2…`
	 * bezeichnet dieselbe Zeile wie `a1b2…`, ein Zeichenkettenvergleich sagte
	 * aber Nein. `gehoert()` hat diese Schieflage nicht, weil dort ebenfalls als
	 * `uuid` verglichen wird; zwei Fassungen derselben Frage wären eine zu viel.
	 */
	const passt = await alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ eins: number }[]>`
			SELECT 1 AS eins FROM party WHERE id = ${parteiId} AND person_id = ${personId}
		`;
		return zeilen.length > 0;
	});

	if (!passt) throw absage();
}
