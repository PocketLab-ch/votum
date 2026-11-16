import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Der Gegentest zum Kennungswächter (`scripts/check-kennungen.mjs`).
 *
 * **Warum er sein muss.** Der Wächter liest Text. Ein regulärer Ausdruck, der
 * eine Klammer zu früh schliesst oder am falschen Ort sucht, findet nichts —
 * und ist damit **immer grün**. Das ist im selben Repo schon dreimal passiert
 * (Archivsicht, Ausklapper, Zeichenzahl), und jedes Mal fiel es erst auf, als
 * jemand den schlechten Fall von Hand einbaute.
 *
 * Geprüft wird deshalb beides:
 *
 *   - dass er den schlechten Fall **findet** — und zwar für jede Bauart, die im
 *     Bestand vorkommt: Kennung direkt im Aufruf, Kennung über eine Grösse,
 *     Kennung über eine Schleife;
 *   - dass er den guten **in Ruhe lässt**. Das ist der wichtigere Teil: Ein
 *     Wächter, der im gewohnten Zustand rot ist, wird abgeschaltet statt
 *     gelesen.
 *
 * Dazu die **Sichtprobe am echten Baum** ganz unten. Ein Wächter, der nur gegen
 * ausgedachte Schnipsel läuft, kann an den wirklichen Dateien vorbeigreifen —
 * etwa weil sie mit Tabulatoren eingerückt sind und die Probe mit Leerzeichen.
 */
const SKRIPT = join(process.cwd(), 'scripts', 'check-kennungen.mjs');

/** Fährt den Wächter über einen Baum und gibt Rückgabewert samt Ausgabe zurück. */
function fahre(wurzel: string): { rot: boolean; ausgabe: string } {
	return fahreWaechter(SKRIPT, wurzel);
}

const verzeichnisse: string[] = [];

/** Legt einen Wegwerfbaum mit einer Seite unter `[id=kennung]` an. */
function baumMit(inhalt: string, unterpfad = 'eigentuemer'): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'kennungswaechter-'));
	verzeichnisse.push(wurzel);
	const ziel = join(wurzel, 'src', 'routes', 'gemeinschaften', '[id=kennung]', unterpfad);
	mkdirSync(ziel, { recursive: true });
	writeFileSync(join(ziel, '+page.server.ts'), inhalt, 'utf8');
	return wurzel;
}

afterEach(() => {
	while (verzeichnisse.length > 0) rmSync(verzeichnisse.pop()!, { recursive: true, force: true });
});

/** Eine Aktion, wie sie im Bestand aussieht — Tabulatoren inbegriffen. */
function seite(rumpf: string): string {
	return `export const actions: Actions = {\n${rumpf}\n};\n`;
}

describe('findet den schlechten Fall', () => {
	it('eine Kennung, die nirgends geprüft wird', () => {
		const baum = baumMit(
			seite(`\ttilgen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait entferneEigentuemer(handelnder(locals.benutzer), text(daten.get('parteiId')));
\t\treturn { ok: params.id };
\t}`)
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('parteiId');
		expect(ausgabe).toContain('tilgen');
	});

	/*
	 * **Der Fall, an dem eine naive Fassung durchginge.** Die Aktion ruft eine
	 * Prüfung auf — aber für ein anderes Feld. Wer bloss zählt, ob irgendwo
	 * `pruefe…Gehoert` steht, hielte das für erledigt.
	 */
	it('eine geprüfte und eine ungeprüfte Kennung nebeneinander', () => {
		const baum = baumMit(
			seite(`\twechseln: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tconst parteiId = text(daten.get('parteiId'));
\t\tawait pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
\t\tawait setzeVertretung(handelnder(locals.benutzer), parteiId, text(daten.get('mitgliedId')));
\t}`)
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('mitgliedId');
		expect(ausgabe).not.toContain('`parteiId`');
	});

	it('eine Prüfung, die nicht gegen die Adresse prüft', () => {
		const baum = baumMit(
			seite(`\ttilgen: async ({ request, locals }) => {
\t\tconst daten = await request.formData();
\t\tconst parteiId = text(daten.get('parteiId'));
\t\tawait pruefeParteiGehoert(locals.benutzer.operatorId, parteiId, parteiId);
\t}`)
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('params.id');
	});

	it('eine Ausnahme ohne Begründung', () => {
		const baum = baumMit(
			seite(`\t/* kennung: parteiId — egal */
\ttilgen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait entferneEigentuemer(handelnder(locals.benutzer), text(daten.get('parteiId')));
\t\treturn { ok: params.id };
\t}`)
		);
		expect(fahre(baum).rot).toBe(true);
	});

	/*
	 * Die Probe trägt zusätzlich ein sauber geprüftes Kennungsfeld: Ohne eines
	 * schlüge der Wächter schon deshalb an, weil er im ganzen Baum nichts zu
	 * bewachen fände — und der Test wäre aus dem falschen Grund grün.
	 */
	/*
	 * **Doppelte Anführungszeichen.** Das Repo hat kein Prettier und keine
	 * `quotes`-Regel in ESLint — `daten.get("x")` ist erlaubt. Die erste Fassung
	 * des Wächters kannte nur `'…'` und blieb hier grün (26.08.2026, aus der
	 * Sicherheitsprüfung).
	 */
	it('eine Kennung in doppelten Anführungszeichen', () => {
		const baum = baumMit(
			seite(`\ttilgen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait entferneEigentuemer(handelnder(locals.benutzer), text(daten.get("parteiId")));
\t\treturn { ok: params.id };
\t}`)
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('parteiId');
	});

	/*
	 * **Ein Endpunkt unter demselben Baum** (`+server.ts`). Er nimmt dieselben
	 * Kennungen entgegen und wurde in der ersten Fassung gar nicht gelesen.
	 */
	it('einen Endpunkt, der eine Kennung ungeprüft entgegennimmt', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'kennungswaechter-endpunkt-'));
		verzeichnisse.push(wurzel);
		const ziel = join(wurzel, 'src', 'routes', 'gemeinschaften', '[id=kennung]', 'paket');
		mkdirSync(ziel, { recursive: true });
		writeFileSync(
			join(ziel, '+server.ts'),
			`export const POST: RequestHandler = async ({ request, locals, params }) => {
\tconst daten = await request.formData();
\tawait loesche(locals.benutzer.operatorId, text(daten.get('parteiId')), params.id);
};
`,
			'utf8'
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('parteiId');
		expect(ausgabe).toContain('POST');
	});

	/*
	 * **Der zweite Endpunkt erbt die Prüfung des ersten nicht.** Beim Nachziehen
	 * der `+server.ts` stand die Zerlegung falsch herum: Ein `POST` bekam den
	 * Rumpf des `GET` darüber mitgeliefert und galt als geprüft. Gemessen am
	 * 26.08.2026 — grün, obwohl er nichts prüfte.
	 */
	it('einen zweiten Endpunkt, der die Prüfung des ersten erbt', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'kennungswaechter-zwei-'));
		verzeichnisse.push(wurzel);
		const ziel = join(wurzel, 'src', 'routes', 'gemeinschaften', '[id=kennung]', 'paket');
		mkdirSync(ziel, { recursive: true });
		writeFileSync(
			join(ziel, '+server.ts'),
			`export const GET: RequestHandler = async ({ request, locals, params }) => {
\tconst daten = await request.formData();
\tconst unitId = text(daten.get('unitId'));
\tawait pruefeEinheitGehoert(locals.benutzer.operatorId, params.id, unitId);
};

export const POST: RequestHandler = async ({ request, locals, params }) => {
\tconst daten = await request.formData();
\tawait loesche(locals.benutzer.operatorId, text(daten.get('unitId')), params.id);
};
`,
			'utf8'
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('POST');
		expect(ausgabe).not.toContain('· GET');
	});

	/*
	 * **Eine Grösse namens `id` wird nicht von `params.id` gedeckt.** Der
	 * Vergleich suchte den Namen im Text der Prüfaufrufe — und `params.id` trägt
	 * ihn als Wortteil. Damit galt jedes an `id` gebundene Feld als geprüft,
	 * sobald irgendeine andere Prüfung in derselben Aktion stand. Genau die Form
	 * von `einheiten/speichern` (26.08.2026, aus dem Code-Review).
	 */
	it('eine Grösse namens id, die nur zufällig in params.id steckt', () => {
		const baum = baumMit(
			seite(`\tspeichern: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tconst parteiId = text(daten.get('parteiId'));
\t\tawait pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
\t\tconst id = text(daten.get('einheitId'));
\t\tawait bearbeiteEinheit(handelnder(locals.benutzer), id, {});
\t}`),
			'einheiten'
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('einheitId');
	});

	it('ein Formular, das als Ganzes weitergereicht wird', () => {
		const baum = baumMit(
			seite(`\tspeichern: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tconst parteiId = text(daten.get('parteiId'));
\t\tawait pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
\t\tawait bearbeiteGemeinschaft(handelnder(locals.benutzer), params.id, ausFormular(daten));
\t}`)
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('ausFormular');
	});

	/*
	 * **Ein Wächter, der am falschen Ort sucht, ist immer grün.** Deshalb sagt
	 * er ab, wenn er gar nichts findet — sonst wäre ein umbenanntes Verzeichnis
	 * ein stiller Freibrief.
	 */
	it('einen Baum, in dem er nichts zu prüfen findet', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'kennungswaechter-leer-'));
		verzeichnisse.push(wurzel);
		mkdirSync(join(wurzel, 'src', 'routes', 'gemeinschaften'), { recursive: true });
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('wirkungslos');
	});
});

describe('lässt den guten Fall in Ruhe', () => {
	it('Kennung über eine Grösse geprüft', () => {
		const baum = baumMit(
			seite(`\ttilgen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tconst parteiId = text(daten.get('parteiId'));
\t\tawait pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
\t\tawait entferneEigentuemer(handelnder(locals.benutzer), parteiId);
\t}`)
		);
		expect(fahre(baum).rot).toBe(false);
	});

	it('Kennung unmittelbar im Aufruf geprüft', () => {
		const baum = baumMit(
			seite(`\ttilgen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait pruefeEinheitGehoert(
\t\t\tlocals.benutzer.operatorId,
\t\t\tparams.id,
\t\t\ttext(daten.get('unitId'))
\t\t);
\t}`)
		);
		expect(fahre(baum).rot).toBe(false);
	});

	/*
	 * **Der Fall aus `einheiten/speichern`.** Die Kennungen kommen als Liste,
	 * und geprüft wird die Schleifengrösse — nicht die Liste. Eine Fassung, die
	 * nur die gebundene Grösse kennt, wäre hier rot und damit im gewohnten
	 * Zustand rot.
	 */
	/*
	 * **Der Fall aus `einheiten/speichern`.** Die Kennungen kommen als Liste und
	 * werden als Liste geprüft, bevor die Schleife schreibt. Der Wächter muss
	 * auch den Mehrzahlnamen (`…Gehoeren`) als Prüfung erkennen — täte er es
	 * nicht, wäre er im gewohnten Zustand rot.
	 */
	it('Kennungen aus einer Liste, vor der Schleife geprüft', () => {
		const baum = baumMit(
			seite(`\tspeichern: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tconst ids = daten.getAll('einheitId').map(String);
\t\tawait pruefeEinheitenGehoeren(locals.benutzer.operatorId, params.id, ids);
\t\tfor (const id of ids) {
\t\t\tawait bearbeiteEinheit(handelnder(locals.benutzer), id, {});
\t\t}
\t}`),
			'einheiten'
		);
		expect(fahre(baum).rot).toBe(false);
	});

	/*
	 * **`pruefePersonAnZeile` zählt als Prüfung.** Sie fragt gegen die Zeile,
	 * nicht gegen die Adresse, und trägt deshalb kein `params.id`. Erkennt der
	 * Wächter sie nicht, geht `personId` nur über eine Ausnahme durch — und wer
	 * den Aufruf entfernt, bleibt grün, weil die Ausnahme das Feld weiter deckt
	 * (26.08.2026, aus dem Code-Review).
	 */
	it('die Prüfung gegen die Zeile statt gegen die Adresse', () => {
		const baum = baumMit(
			seite(`\tberichtigen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tconst parteiId = text(daten.get('parteiId'));
\t\tconst personId = text(daten.get('personId'));
\t\tawait pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
\t\tawait pruefePersonAnZeile(locals.benutzer.operatorId, parteiId, personId);
\t}`)
		);
		expect(fahre(baum).rot).toBe(false);
	});

	it('eine begründete Ausnahme', () => {
		const baum = baumMit(
			seite(`\t/*
\t * kennung: personId — \`person\` trägt keine \`stweg_id\`; eine Person gehört
\t * keiner Gemeinschaft, sondern hat in jeder eine Zeile.
\t */
\tverknuepfen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tconst parteiId = text(daten.get('parteiId'));
\t\tawait pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
\t\tawait verknuepfePartei(handelnder(locals.benutzer), parteiId, text(daten.get('personId')));
\t}`)
		);
		expect(fahre(baum).rot).toBe(false);
	});

	/*
	 * **Kommentare zählen nicht als Prüfung.** Wer den Aufruf in einem Beispiel
	 * erwähnt, hat nichts geprüft — die alte Fassung des Archivsichtwächters ist
	 * genau daran gescheitert.
	 */
	it('und hält einen Aufruf im Kommentar nicht für eine Prüfung', () => {
		const baum = baumMit(
			seite(`\ttilgen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\t// Hier stünde: await pruefeParteiGehoert(op, params.id, parteiId);
\t\tconst parteiId = text(daten.get('parteiId'));
\t\tawait entferneEigentuemer(handelnder(locals.benutzer), parteiId);
\t}`)
		);
		expect(fahre(baum).rot).toBe(true);
	});

	/*
	 * **Gezählt wird, was er bewacht.** Ohne die Zahl bliebe offen, ob die
	 * gewöhnlichen Felder wirklich übergangen wurden oder ob der Wächter die
	 * ganze Aktion nicht gefunden hat — beides wäre grün.
	 */
	it('und Felder, die keine Kennungen sind, gar nicht erst', () => {
		const baum = baumMit(
			seite(`\tspeichern: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tconst parteiId = text(daten.get('parteiId'));
\t\tawait pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
\t\tawait schreibe(parteiId, text(daten.get('name')), text(daten.get('fundstelle')));
\t}`)
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(false);
		expect(ausgabe).toContain('1 Kennungsfelder bewacht');
	});
});

/**
 * Die Sichtprobe: der Wächter über den wirklichen Seiten.
 *
 * Sie darf im guten Zustand nicht rot werden — und sie muss etwas gesehen
 * haben. Die gemeldeten Zahlen stehen bewusst als Untergrenze im Test: Fällt
 * die Zahl der bewachten Felder plötzlich auf null, weil ein Muster nicht mehr
 * greift, ist der Wächter still geworden, ohne rot zu werden.
 */
describe('Sichtprobe am echten Baum', () => {
	it('ist grün und hat wirklich etwas angesehen', () => {
		const { rot, ausgabe } = fahre(process.cwd());
		expect(rot).toBe(false);
		const felder = Number(/(\d+) Kennungsfelder/.exec(ausgabe)?.[1] ?? 0);
		const aktionen = Number(/(\d+) Aktionen/.exec(ausgabe)?.[1] ?? 0);
		expect(felder).toBeGreaterThanOrEqual(20);
		expect(aktionen).toBeGreaterThanOrEqual(30);
	});

	/**
	 * **Die Zahl der Ausnahmen ist festgenagelt** (26.08.2026, aus der
	 * Sicherheitsprüfung).
	 *
	 * Eine Ausnahme legt die Prüfung für ein Feld still, und zehn Zeichen
	 * Begründung genügen dem Wächter. Ohne diese Schranke wäre «Prüfung
	 * abschalten» eine Zeile, die niemandem auffällt — der Prüflauf bliebe grün.
	 * So wird er rot, und wer eine Ausnahme wirklich braucht, trägt die Zahl
	 * hier nach und begründet sie im Commit.
	 *
	 * Stand 26.08.2026: sieben Felder (2× `personId` — beim Anlegen und beim
	 * Verknüpfen, wo es keine Zeile zum Vergleichen gibt —, `memberStwegId`,
	 * `entfernen`, `artId`, `knotenId`, `liegenschaft`) und vier Formulare
	 * (`angaben/speichern`, `eigentuemer/mitgliederAnlegen`, `einheiten/anlegen`,
	 * `einheiten/speichern`).
	 *
	 * **27.08.2026: neun Felder.** Dazu kam `mitberechtigterPersonId` in zwei
	 * Aktionen der Eigentümerseite — `anlegen` und `miteigentumEintragen`.
	 * Dieselbe Lage wie bei `personId`: `person` trägt keine `stweg_id`, eine
	 * Person gehört keiner Gemeinschaft, sondern hat in jeder eine Zeile. Die
	 * Zeile entsteht über `parteiAusPerson` unter der Gemeinschaft aus der
	 * Adresse, und die ist geprüft. Eine Prüfung «Person gehört zur
	 * Gemeinschaft» wäre erfunden und sperrte genau den Weg, für den es sie gibt.
	 *
	 * **03.09.2026: elf Felder.** Dazu kam die neue Aktion `aendern` der
	 * Reglementsseite mit `regelId` und `knotenId`.
	 *
	 * `knotenId` ist dieselbe Lage wie beim Anlegen daneben: der Fall aus dem
	 * Entscheidbaum, versioniert im Code, für alle Gemeinschaften gleich.
	 *
	 * `regelId` ist die interessantere: Geprüft **wird** sie, aber in
	 * `aendereReglementsregelAn` und nicht in der Aktion, weil das der einzige
	 * Schreibweg auf eine bestehende Regel über ihre Kennung ist. Eine Prüfung an
	 * der Aufrufstelle vergisst irgendwann die zweite Aufrufstelle; eine im
	 * Schreibweg kann man nicht umgehen. Was der Wächter hier nicht sehen kann,
	 * sieht `tests/db/reglement-aendern.test.ts` mit der Nachbargemeinschaft
	 * desselben Betreibers: Ausgebaut wird der Test rot (gemessen, nicht
	 * behauptet). Der fremde **Betreiber** taugt dafür nicht, dort greift schon
	 * der Zeilenschutz.
	 */
	it('und die Ausnahmen sind gezählt, nicht bloss erlaubt', () => {
		const { ausgabe } = fahre(process.cwd());
		expect(ausgabe).toContain('davon 11 über eine begründete Ausnahme');
		expect(ausgabe).toContain('dazu 4 Formulare');
	});
});
