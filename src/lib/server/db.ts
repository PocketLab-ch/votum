/**
 * Datenzugriff. Gehört zur Schale (AD-1) und ist die einzige Stelle, die
 * PostgreSQL kennt.
 *
 * Kein ORM, sondern handgeschriebenes SQL: Die Auszählung liest Momentaufnahmen
 * als flache Mengen, und der Schreibschutz versiegelter Datensätze liegt in
 * Triggern. Eine Abstraktionsschicht darüber verdeckt beides.
 */
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import { FachlicherFehler } from '$lib/domain/fehler';
import { EINGABE_MIT_NUL } from '$lib/domain/steuerzeichen';

const verbindung = env.DATABASE_URL ?? 'postgres://versammlung@localhost:5432/versammlung';

export const sql = postgres(verbindung, {
	// Ganzzahlen als Zahl, nicht als Zeichenkette. Wertquoten und Stimmen sind
	// immer ganzzahlig (AD-12), Überläufe sind hier nicht zu erwarten.
	types: {
		bigint: postgres.BigInt
	},
	// Der Mandantenkontext wird je Transaktion gesetzt; eine wiederverwendete
	// Verbindung darf ihn nicht aus einer früheren mitschleppen.
	onclose: () => {},
	transform: { undefined: null }
});

/**
 * Führt Arbeit im Mandantenkontext eines Betreibers aus.
 *
 * `SET LOCAL` endet mit dem Commit — deshalb muss jede Abfrage, die dem
 * Zeilenschutz unterliegt, innerhalb dieser Transaktion laufen. Eine Abfrage
 * danach scheitert still an der Regel und liefert eine leere Menge statt eines
 * Fehlers, was in einem Vorgängerprojekt lange gesucht wurde.
 */
export async function alsBetreiber<T>(
	operatorId: string,
	arbeit: (tx: postgres.TransactionSql) => Promise<T>,
	/**
	 * Die Isolationsstufe, falls die Vorgabe nicht genügt.
	 *
	 * **Warum als Angabe am `BEGIN` und nicht als Anweisung darin** (18.09.2026,
	 * aus dem Code-Review zum Vorbereitungspaket). Postgres nimmt
	 * `SET TRANSACTION ISOLATION LEVEL` nur an, **bevor** die erste Abfrage
	 * gelaufen ist — und die erste Abfrage hier ist immer das `set_config` für
	 * den Zeilenschutz. Innerhalb der Transaktion käme sie also stets zu spät.
	 *
	 * **Wer sie braucht:** Ein Ablauf, der über mehrere Abfragen hinweg **einen**
	 * Stand sehen muss. Unter der Vorgabe `READ COMMITTED` sieht jede Abfrage
	 * ihren eigenen Augenblick; wer daraus ein Paket schnürt, kann Eltern ohne
	 * Kinder einpacken. Für gewöhnliches Lesen und Schreiben ist die Vorgabe
	 * richtig und diese Angabe bleibt weg.
	 */
	stufe?: 'repeatable read' | 'serializable'
): Promise<T> {
	try {
		const lauf = async (tx: postgres.TransactionSql) => {
			await tx`SELECT set_config('versammlung.operator_id', ${operatorId}, true)`;
			return arbeit(tx);
		};
		return (await (stufe ? sql.begin(`isolation level ${stufe}`, lauf) : sql.begin(lauf))) as T;
	} catch (fehler) {
		throw (await fehlenderVerweis(fehler)) ?? uebersetzeSchranke(fehler);
	}
}

/**
 * **Ein Verweis auf eine Zeile, die es bei diesem Betreiber nicht gibt**
 * (23503; Kreuzteil des Fremdbetreiber-Durchstichs, 28.10.2026). Drei Felder
 * reichen eine Kennung ungeprüft an die Datenbank weiter und überlassen die
 * Bindung dem zusammengesetzten Fremdschlüssel mit Betreiber: `parentStwegId`
 * (`stweg_eltern_gleicher_betreiber`), `memberStwegId`
 * (`party_mitglied_gleicher_betreiber`) und `vorgaengerId`
 * (`meeting_previous_meeting_id_operator_id_fkey`). Der Schlüssel hielt, nur
 * kam die Absage als rohe 500 an. Eine Kennung von anderswo ist derselbe Fall
 * wie eine unbekannte, und die Antwort darauf ist eine Absage.
 *
 * **Als Klasse, nicht je Aktion.** Welche Schlüssel einen Betreiber tragen,
 * steht in `pg_constraint` und wird dort nachgeschlagen, einmal je Schlüssel
 * und Prozess: Eine abgeschriebene Liste liefe beim nächsten Schlüssel aus
 * einer Migration still davon.
 *
 * **Übersetzt wird nur, was eindeutig eine Eingabe ist:**
 *
 * - Nur die verwiesene Zeile fehlt, beim Schreiben («insert or update on
 *   table …»). Derselbe Code kommt auch beim Löschen einer Zeile, auf die noch
 *   verwiesen wird («update or delete on table …»); das ist kein Fehler der
 *   Eingabe, und die Stellen, die damit rechnen, fangen ihn
 *   (`aufbewahrung.ts`) oder kommen ihm zuvor (`eigentuemer.ts ·
 *   pruefeHakenUmlegbar`). Unterschieden
 *   wird am Wortlaut, weil Postgres beide Fälle sonst gleich meldet; das setzt
 *   englische Meldungen voraus (`lc_messages`, auf Dev `en_US.utf8`, gemessen
 *   28.10.2026). Unter einer anderen Sprache bleibt es bei der 500, nicht bei
 *   einer falschen Absage, und `tests/db/fremde-kennung-2d.test.ts` wird rot.
 * - Nur an einem Schlüssel aus mehreren Spalten, von denen eine `operator_id`
 *   ist. Dort heisst die Verletzung genau «diese Kennung gehört nicht zu
 *   diesem Betreiber oder es gibt sie nicht». Ein einfacher Schlüssel prüft die
 *   Existenz am Zeilenschutz vorbei, und seine Verletzung zeigt eher einen
 *   Programmfehler; er bleibt bei der 500.
 *
 * **Der Satz muss für beide Leserschaften stimmen**, wie bei `VO117` unten:
 * `alsBetreiber` läuft auch unter `/z`, und dort liest ihn ein Eigentümer. Er
 * nennt deshalb weder Schlüssel noch Tabelle, nur was zu tun ist; der Name
 * steht im Protokoll.
 */
async function fehlenderVerweis(fehler: unknown): Promise<FachlicherFehler | null> {
	if (!(fehler instanceof postgres.PostgresError) || fehler.code !== '23503') return null;
	if (!fehler.message.startsWith('insert or update on table')) return null;
	const { schema_name: schema, table_name: tabelle, constraint_name: schranke } = fehler;
	if (!schema || !tabelle || !schranke) return null;

	const merkmal = `${schema}.${tabelle}.${schranke}`;
	let mitBetreiber = schluesselMitBetreiber.get(merkmal);
	if (mitBetreiber === undefined) {
		try {
			const [z] = await sql<{ ja: boolean }[]>`
				SELECT EXISTS (
					SELECT 1
					  FROM pg_constraint c
					  JOIN pg_class t ON t.oid = c.conrelid
					  JOIN pg_namespace n ON n.oid = t.relnamespace
					  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
					 WHERE c.contype = 'f' AND c.conname = ${schranke}
					   AND t.relname = ${tabelle} AND n.nspname = ${schema}
					   AND cardinality(c.conkey) > 1 AND a.attname = 'operator_id'
				) AS ja
			`;
			mitBetreiber = z.ja;
		} catch {
			// Geht das Nachschlagen schief, bleibt der ursprüngliche Fehler stehen.
			return null;
		}
		schluesselMitBetreiber.set(merkmal, mitBetreiber);
	}
	if (!mitBetreiber) return null;

	console.error(`Verweis auf eine Zeile ausserhalb des Betreibers (23503, ${schranke}).`);
	return new FachlicherFehler('unbekannter_verweis', NICHT_HIER);
}

/**
 * Der Satz für eine Kennung, die es bei diesem Betreiber nicht gibt, ob sie
 * am Schlüssel scheitert (`fehlenderVerweis`) oder am Wächter über den
 * Verlauf (`VO177`). Für den Benutzer ist es derselbe Fall.
 */
const NICHT_HIER =
	'Was Sie ausgewählt haben, gibt es hier nicht. Laden Sie die Seite neu und wählen Sie erneut.';

/**
 * **Ein Verlaufseintrag, der eine Kennung eines anderen Betreibers nennt**
 * (Migration 177, Klasse K2). Der Auslöser hat den Eintrag abgewiesen und mit
 * ihm die Änderung, die er belegen sollte. Dahinter steht ein Weg, der eine
 * Kennung aus Pfad oder Formular nicht unter dem eigenen Betreiber gesucht hat;
 * für den Benutzer ist das eine Auswahl, die es hier nicht gibt.
 *
 * Der Satz nennt weder Tabelle noch Kennung: `alsBetreiber` läuft auch unter
 * `/z` und auf offenen Pfaden, wie bei `VO117`. Die Meldung der Datenbank mit
 * Art, Kennung und Tabelle steht im Protokoll; dort sucht man den Weg, dem
 * die Prüfung fehlt.
 */
function fremdeKennungImVerlauf(fehler: unknown): FachlicherFehler | null {
	if (!(fehler instanceof postgres.PostgresError) || fehler.code !== 'VO177') return null;
	console.error(`Verlauf mit Kennung eines anderen Betreibers abgewiesen (VO177): ${fehler.message}`);
	abgewiesen++;
	return new FachlicherFehler('fremde_kennung', NICHT_HIER);
}

/*
 * **Damit der Wächter keinen Rückschritt verdeckt** (Codeprüfung, 28.10.2026),
 * wie bei `wiederholt` unten. Die Tests eines Wegs verlangen oft nur «eine
 * fachliche Absage und kein Eintrag»; fiele die Prüfung im Code weg, lieferte
 * der Wächter beides, und der Test bliebe grün. `tests/db/waechter-netz.ts`
 * verlangt deshalb, dass sich dieser Zähler in keinem Datenbanktest rührt,
 * ausser in denen, die den Wächter meinen.
 */
let abgewiesen = 0;

/** Wie oft der Wächter über den Verlauf (`VO177`) in diesem Prozess abgewiesen hat. */
export function abgewieseneFremdeKennungen(): number {
	return abgewiesen;
}

/** Je Schlüssel (`schema.tabelle.name`): trägt er den Betreiber? */
const schluesselMitBetreiber = new Map<string, boolean>();

/**
 * Fährt einen Lauf noch einmal, wenn PostgreSQL ihn wegen einer Verklemmung
 * (40P01) abgebrochen hat. **Nur für einen Lauf, der ganz in einer Transaktion
 * liegt** und ausserhalb nichts bewirkt: Der Abbruch hat dann nichts
 * geschrieben, und der zweite Versuch liest den Stand, den der andere Lauf
 * hinterlassen hat.
 *
 * **Der Anlass** (aus der Codeprüfung zu C2, 16.10.2026; nachgestellt am
 * 27.10.2026 in `tests/db/abschluss-rennen.test.ts`, «Rückkommensantrag und
 * Ziel zugleich»). Das Eröffnen am Ziel nimmt über den Fremdschlüssel
 * `FOR KEY SHARE` auf den Rückkommensantrag, nachdem es die Versammlung hält;
 * ein Eröffnen oder Beschluss von Hand am Antrag hält ihn mit `FOR UPDATE` und
 * wartet an der Versammlung. **Warum wiederholen und nicht umsperren:** Drei
 * Fassungen, die die Sperrfolge änderten, bauten je eine neue Verklemmung ein
 * oder liessen bestehende Renntests vom Takt abhängen (Codeprüfungen vom
 * 27.10.2026; `docs/agents/entwicklung.md`, «Sperrfolge»).
 */
export async function nochmalsBeiVerklemmung<T>(lauf: () => Promise<T>, versuche = 3): Promise<T> {
	for (let versuch = 1; ; versuch++) {
		try {
			return await lauf();
		} catch (fehler) {
			const verklemmt = fehler instanceof postgres.PostgresError && fehler.code === '40P01';
			if (!verklemmt || versuch >= versuche) throw fehler;
			wiederholt++;
		}
	}
}

/*
 * **Damit die Wiederholung keinen Rückschritt verdeckt** (Codeprüfung,
 * 27.10.2026). Die Renntests zu C2 belegen die Sperrfolge, indem sie ein 40P01
 * verbieten; liefe ein Opfer still ein zweites Mal, blieben sie auch nach einem
 * Rückschritt grün. Sie verlangen deshalb, dass dieser Zähler sich nicht rührt.
 */
let wiederholt = 0;

/** Wie oft `nochmalsBeiVerklemmung` in diesem Prozess wiederholt hat. */
export function wiederholteVerklemmungen(): number {
	return wiederholt;
}

/**
 * Das Netz unter den Prüfungen im Kern (26.08.2026, aus dem Code-Review).
 *
 * **Warum es das gibt.** `docs/gestaltung.md` verlangt, dass jede Schranke der
 * Datenbank **vorher** im Kern steht — mit Grund und Ausweg. Das bleibt die
 * Regel; dieses Netz ersetzt sie nicht. Es fängt nur, was durchrutscht: 31
 * `CHECK (length(btrim(…)))`-Schranken stehen in den Migrationen, und jede neue
 * kommt dazu. Vergisst jemand den Satz davor, kam bisher eine rohe 500 — für
 * den Benutzer eine leere Seite ohne jeden Hinweis, mitten im Saal.
 *
 * **Was es nicht anfasst.** Fremdschlüssel und doppelte Schlüssel bleiben, wie
 * sie sind: Sie werden an mehreren Stellen an ihrem Code erkannt und dort
 * bewusst behandelt. Ausnahme ist der fehlende Verweis an einem Schlüssel mit
 * Betreiber (`fehlenderVerweis`). Übersetzt wird nur, was auf eine **Eingabe** zurückgeht und
 * sonst niemandem etwas sagt.
 *
 * **Der Name der Schranke steht im Protokoll, nicht im Satz.** Er wäre für die
 * Rückfrage nützlich — aber `alsBetreiber` läuft auch auf offenen Pfaden
 * (`/e/<merkmal>`, der Saaleinstieg ohne Anmeldung, `domain/oeffentlich.ts`).
 * Dort gäbe der Satz einem Fremden Namen aus dem Schema preis, ohne dass es
 * ihm etwas nützt. Wer nachsehen muss, findet den Namen mit Zeitpunkt im
 * Protokoll des Dienstes.
 */
export class SchrankenFehler extends FachlicherFehler {
	constructor(
		kennung: string,
		nachricht: string,
		/**
		 * Der Name der Schranke — **nicht** im Satz an den Benutzer.
		 *
		 * Er gehört ins Protokoll und in einen Test, der beweist, dass die Schranke
		 * gehalten hat. Im Satz stünde er auf einem offenen Pfad einem Fremden zur
		 * Verfügung, ohne ihm zu nützen.
		 */
		readonly schranke: string
	) {
		super(kennung, nachricht);
		this.name = 'SchrankenFehler';
	}
}

/**
 * **Eine ungültige Kennung ist eine Absage, keine 500-Seite** (F7, aus der
 * Pentest-Runde M7, 15.10.2026). `WHERE id = ''`, oder irgendein Text, der
 * keine UUID ist, scheitert an der Umwandlung nach `uuid` mit `22P02` und kam
 * als rohe 500 zurück: eine leere Seite ohne Hinweis, mitten im Saal. Ein
 * leeres oder verstelltes Kennungsfeld ist aber derselbe Fall wie eine
 * unbekannte Kennung, und die Antwort darauf ist dieselbe Sorte Absage.
 *
 * **Zentral und nicht in jeder Aktion.** Die Abfragen laufen durch
 * `alsBetreiber` oder `ohneBindung`, und der Fehler kommt dort vorbei; die
 * vielen Aufrufstellen einzeln zu prüfen hiesse, die nächste zu vergessen. Wer
 * `sql` oder `sql.begin` unmittelbar benutzt, geht an dieser Abwehr vorbei.
 * Erkannt wird der Fall an der Routine, in der Postgres die Umwandlung
 * ablehnt (`string_to_uuid`, gemessen an `postgres:18.4-alpine`), und
 * ersatzweise am Wortlaut; andere `22P02`-Fälle, etwa ein ungültiges Datum,
 * bleiben unberührt.
 *
 * **Eine Spur im Protokoll**, für den Fall, dass eine Aktion eine leere Grösse
 * aus dem Programm statt aus der Eingabe schickt: der Wortlaut gekürzt und die
 * Aufrufer aus dem eigenen Stapel. Der Satz an den Benutzer nennt beides nicht.
 */
export function kennungsfehler(fehler: unknown): unknown {
	if (!(fehler instanceof postgres.PostgresError) || fehler.code !== '22P02') return fehler;
	if (fehler.routine !== 'string_to_uuid' && !/invalid input syntax for type uuid/i.test(fehler.message)) {
		return fehler;
	}
	// Ohne die eigenen und die internen Zeilen: Gesucht ist die Aktion darüber.
	// Erkannt an den Funktionsnamen, nicht am Pfad: Im gebauten Stand liegen
	// diese Funktionen in einem Chunk mit anderem Namen (Codeprüfung F7).
	const eigene = ['kennungsfehler', 'uebersetzeSchranke', 'alsBetreiber', 'ohneBindung'];
	const aufrufer = (new Error().stack ?? '')
		.split('\n')
		.slice(1)
		.map((z) => z.trim())
		.filter((z) => z.startsWith('at ') && !z.includes('node:internal'))
		.filter((z) => !eigene.some((name) => z.startsWith(`at ${name} `) || z.startsWith(`at async ${name} `)))
		.slice(0, 3)
		.join(' < ');
	console.error(`Ungültige Kennung in einer Abfrage (22P02): ${fehler.message.slice(0, 200)}; ${aufrufer}`);
	return new FachlicherFehler('ungueltige_kennung', 'Diese Kennung ist ungültig. Laden Sie die Seite neu.');
}

/**
 * **Eine Transaktion ohne die Bindung an einen Betreiber**, für die Wege, die
 * sie selbst setzen oder bewusst nicht brauchen (die Kontoverwaltung in
 * `benutzer.ts`). Sie übersetzt nur die ungültige Kennung, nicht die übrigen
 * Schranken aus `uebersetzeSchranke`: Deren Fang würde dort sonst still ein
 * anderes Verhalten bekommen (F7, aus der Codeprüfung 16.10.2026). Dazu
 * kommt der Wächter über den Verlauf (`VO177`): Die Kontenwege schreiben hier
 * Verlauf unter einem Betreiber, und vor Migration 177 fing den Code niemand.
 */
export async function ohneBindung<T>(arbeit: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
	try {
		return (await sql.begin(arbeit)) as T;
	} catch (fehler) {
		throw fremdeKennungImVerlauf(fehler) ?? kennungsfehler(fehler);
	}
}

/**
 * Ist das der doppelte Schlüssel (23505) an einer dieser Schranken?
 *
 * **Für die Stelle, die ihn erwartet**, nicht für das Netz darunter: Was ein
 * doppelter Schlüssel bedeutet, weiss nur der Schreibweg, der ihn auslöst
 * (siehe `uebersetzeSchranke`). Der Name wird geprüft, damit ein anderer
 * eindeutiger Schlüssel in derselben Transaktion nicht unter einem falschen
 * Satz verschwindet.
 */
export function istDoppelterSchluessel(fehler: unknown, ...schranken: string[]): boolean {
	return (
		fehler instanceof postgres.PostgresError &&
		fehler.code === '23505' &&
		schranken.includes(fehler.constraint_name ?? '')
	);
}

function uebersetzeSchranke(fehler: unknown): unknown {
	if (!(fehler instanceof postgres.PostgresError)) return fehler;

	const kennung = kennungsfehler(fehler);
	if (kennung !== fehler) return kennung;

	const fremd = fremdeKennungImVerlauf(fehler);
	if (fremd) return fremd;

	/*
	 * **Die abgegebene Versammlung** (18.09.2026, aus dem Code-Review). Migration
	 * 117 sperrt jede Änderung an einer Versammlung, die auf einem anderen Gerät
	 * geführt wird, und wirft dafür `VO117`. Die Oberfläche nimmt an den Stellen,
	 * die sie kennt, die Knöpfe weg; erhoben wurde aber, dass es in der Anwendung
	 * keinen Ort gibt, durch den alle Schreibwege einer Versammlung laufen.
	 * Irgendein Weg bleibt also übrig — ein alter offener Reiter, ein Telefon im
	 * Saal, ein Formular, das nächstes Jahr dazukommt. Der soll eine Auskunft
	 * bekommen und keine leere Seite.
	 *
	 * **Der Satz ist hier fest verdrahtet, und der Satz der Datenbank wird
	 * ausdrücklich NICHT durchgereicht.** Er nennt Tabelle und Operation
	 * («UPDATE an ‹meeting›»), und `alsBetreiber` läuft auch auf offenen Pfaden:
	 * am Saaleinstieg ohne Anmeldung und unter `/e/<merkmal>`. Dort wären das
	 * Schemanamen für einen Fremden, ohne ihm zu nützen — dieselbe Überlegung
	 * wie bei `SchrankenFehler` darunter. Wer diesen Satz je durch
	 * `fehler.message` ersetzt, macht daraus eine Preisgabe.
	 */
	if (fehler.code === 'VO117') {
		/*
		 * **Der Satz muss für beide Leserschaften stimmen** (18.09.2026, beim
		 * Nachfragen aufgefallen). Hier stand zuerst «… nehmen Sie die Abgabe auf
		 * der Seite ‹An ein anderes Gerät abgeben› zurück» — eine Weisung an die
		 * Bewirtschaftung. Nur läuft `alsBetreiber` auch auf `/z`, und `/z` reicht
		 * `fehler.message` unverändert an den Eigentümer weiter. Der bekam damit
		 * eine Aufforderung, die er nicht befolgen kann und nicht verstehen soll.
		 *
		 * Übrig bleibt die Tatsache, und die trägt für beide. Die Bewirtschaftung
		 * findet den Rückweg ohnehin am Band auf der Versammlungsseite; ein
		 * Eigentümer soll dort gar nicht hingeführt werden.
		 */
		return new FachlicherFehler(
			'versammlung_abgegeben',
			'Diese Versammlung wird gerade auf einem anderen Gerät geführt, etwa auf dem Notebook im Saal. Solange sie unterwegs ist, lässt sie sich hier nicht ändern.'
		);
	}

	if (!['23514', '22001', '22021'].includes(fehler.code)) return fehler;

	const schranke =
		fehler.constraint_name ?? fehler.column_name ?? fehler.table_name ?? 'ohne Namen';
	// Ohne Protokolleintrag verschwände die Ursache: Der Satz an den Benutzer
	// nennt sie bewusst nicht.
	console.error(`Schranke der Datenbank durchgeschlagen (${fehler.code}, ${schranke}):`, fehler.message);

	switch (fehler.code) {
		case '23514': // check_violation
			return new SchrankenFehler(
				'schranke_verletzt',
				'Diese Eingabe hat die Datenbank abgewiesen, und die Anwendung hätte es vorher sagen ' +
					'müssen. Bitte melden Sie, was Sie eingegeben haben — der Grund steht mit Zeitpunkt ' +
					'im Protokoll des Dienstes.',
				schranke
			);
		case '22001': // string_data_right_truncation
			return new SchrankenFehler(
				'zu_lang',
				'Eine Ihrer Eingaben ist zu lang für das Feld. Kürzen Sie sie.',
				schranke
			);
		default: // 22021, invalid byte sequence
			return new SchrankenFehler('zeichen_ungueltig', EINGABE_MIT_NUL, schranke);
	}
}
