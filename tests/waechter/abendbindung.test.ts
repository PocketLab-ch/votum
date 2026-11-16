import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Der Gegentest zum Abendbindungswächter (`scripts/check-abendbindung.mjs`).
 *
 * **Warum er sein muss.** Der Wächter liest Text. Ein regulärer Ausdruck, der
 * eine Klammer zu früh schliesst oder am falschen Ort sucht, findet nichts —
 * und ist damit **immer grün**. Im selben Repo ist das schon dreimal passiert
 * (Archivsicht, Ausklapper, Zeichenzahl), und jedes Mal fiel es erst auf, als
 * jemand den schlechten Fall von Hand einbaute.
 *
 * Geprüft wird deshalb beides: dass er den schlechten Fall **findet**, und dass
 * er den guten **in Ruhe lässt** — das ist der wichtigere Teil, denn ein
 * Wächter, der im gewohnten Zustand rot ist, wird abgeschaltet statt gelesen.
 *
 * Dazu die **Sichtprobe am echten Baum** ganz unten. Ein Wächter, der nur gegen
 * ausgedachte Schnipsel läuft, kann an den wirklichen Dateien vorbeigreifen —
 * etwa weil sie mit Tabulatoren eingerückt sind und die Probe mit Leerzeichen.
 */
const SKRIPT = join(process.cwd(), 'scripts', 'check-abendbindung.mjs');

function fahre(wurzel: string): { rot: boolean; ausgabe: string } {
	return fahreWaechter(SKRIPT, wurzel);
}

const verzeichnisse: string[] = [];

/**
 * Legt einen Wegwerfbaum unter `tage/[id=kennung]/` an.
 *
 * **Mit so vielen Seiten, wie die Reissleine verlangt** — der Gegentest fährt
 * sie zwar abgeschaltet, aber ein Baum, der die Untergrenze von sich aus
 * erfüllt, misst dieselbe Lage wie das Repo.
 */
function baumMit(inhalt: string, unterpfad = 'leitung'): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'abendwaechter-'));
	verzeichnisse.push(wurzel);
	const ziel = join(wurzel, 'src', 'routes', 'tage', '[id=kennung]', unterpfad);
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
	it('eine Versammlung aus dem Formular ohne jede Prüfung', () => {
		const baum = baumMit(
			seite(`\tloesen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait nimmAusTag(handelnder(locals), text(daten.get('versammlung')));
\t\treturn { ok: params.id };
\t}`)
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('versammlung');
		expect(ausgabe).toContain('loesen');
	});

	/*
	 * **Auch die Mehrfachfelder.** Die erste Fassung kannte nur `versammlung` und
	 * `meeting`, weil die Erhebung daneben nach `daten.get('…')` gesucht und
	 * jedes `getAll` übersehen hatte (Sicherheitsprüfung 08.09.2026). Zwei Seiten
	 * wurden dadurch mitgezählt und nicht gelesen.
	 */
	it('auch die Mehrfachfelder `meetings` und `zeile`', () => {
		for (const feld of ['meetings', 'zeile']) {
			const baum = baumMit(
				seite(`\tanlegen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait leg(handelnder(locals), params.id, daten.getAll('${feld}').map(String));
\t}`),
				'geschaefte'
			);
			expect(fahre(baum).ausgabe).toContain(`\`${feld}\``);
		}
	});

	it('auch unter dem zweiten Feldnamen', () => {
		const baum = baumMit(
			seite(`\tbestaetigen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait tuWas(locals, text(daten.get('meeting')), params.id);
\t}`),
			'einlass'
		);
		expect(fahre(baum).ausgabe).toContain('`meeting`');
	});

	/*
	 * **Der Fall, an dem eine naive Fassung durchginge.** Die Aktion ruft die
	 * Schranke auf — aber mit einer Kennung aus demselben Formular. Wer bloss
	 * zählt, ob irgendwo `hausDesAbends` steht, hielte das für erledigt; geprüft
	 * würde Formularwert gegen Formularwert.
	 */
	it('eine Schranke ohne `params.id` zählt nicht', () => {
		const baum = baumMit(
			seite(`\tvertagen: async ({ request, locals }) => {
\t\tconst daten = await request.formData();
\t\tconst abend = text(daten.get('abend'));
\t\tawait hausDesAbends(locals.benutzer.operatorId, abend, text(daten.get('versammlung')));
\t}`)
		);
		expect(fahre(baum).rot).toBe(true);
	});

	/*
	 * Die Ausnahme ist eine **Begründung**, keine Marke. Ein Wort dahinter darf
	 * nicht reichen, sonst wächst die Liste, bis sie den Wächter aufhebt.
	 */
	it('eine Ausnahme ohne Begründung zählt nicht', () => {
		const baum = baumMit(
			seite(`\t/* abend: versammlung — egal */
\tloesen: async ({ request, locals }) => {
\t\tconst daten = await request.formData();
\t\tawait nimmAusTag(handelnder(locals), text(daten.get('versammlung')));
\t}`)
		);
		expect(fahre(baum).rot).toBe(true);
	});

	/*
	 * **Die Ausnahme gilt dem Feld, das sie nennt.** Sonst deckte eine einmal
	 * begründete Ausnahme jedes weitere Feld derselben Aktion mit.
	 */
	it('eine Ausnahme für das andere Feld deckt nicht', () => {
		const baum = baumMit(
			seite(`\t/* abend: meeting — hier steht die Bindung eine Stufe tiefer im Kern */
\tloesen: async ({ request, locals }) => {
\t\tconst daten = await request.formData();
\t\tawait nimmAusTag(handelnder(locals), text(daten.get('versammlung')));
\t}`)
		);
		expect(fahre(baum).rot).toBe(true);
	});
});

describe('lässt den guten Fall in Ruhe', () => {
	it('die Schranke mit `params.id`', () => {
		const baum = baumMit(
			seite(`\tloesen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tconst versammlung = text(daten.get('versammlung'));
\t\tawait hausDesAbends(locals.benutzer.operatorId, params.id, versammlung);
\t\tawait nimmAusTag(handelnder(locals), versammlung);
\t}`)
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(false);
		expect(ausgabe).toContain('1 Versammlungsfelder über die Schranke gebunden');
	});

	it('die Schranke mitten im Ausdruck', () => {
		const baum = baumMit(
			seite(`\tstichentscheid: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait haltFest(
\t\t\tawait hausDesAbends(locals.benutzer.operatorId, params.id, text(daten.get('versammlung'))),
\t\t\ttext(daten.get('durchgang'))
\t\t);
\t}`)
		);
		expect(fahre(baum).rot).toBe(false);
	});

	/*
	 * **Ein verschachtelter Aufruf in den Argumenten** schnitt die frühere
	 * Fassung nach der ersten schliessenden Klammer ab; `params.id` stand dann
	 * nicht mehr im gelesenen Text, und eine sauber gebundene Aktion wurde rot.
	 */
	it('die Schranke mit einem Aufruf in den Argumenten', () => {
		const baum = baumMit(
			seite(`\tloesen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait hausDesAbends(handelnder(locals).operatorId, params.id, text(daten.get('versammlung')));
\t}`)
		);
		expect(fahre(baum).rot).toBe(false);
	});

	it('eine begründete Ausnahme, und sie wird als solche gezählt', () => {
		const baum = baumMit(
			seite(`\t/*
\t * abend: versammlung — \`vertageAmAbend\` schneidet die Auswahl gegen die
\t * Häuser des Abends aus \`params.id\`.
\t */
\tvertagen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait vertageAmAbend(handelnder(locals), params.id, {
\t\t\tversammlungen: daten.getAll('versammlung').map(String)
\t\t});
\t}`)
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(false);
		expect(ausgabe).toContain('1 über eine begründete Ausnahme');
	});

	/*
	 * **Die Ausnahme gehört der Aktion, vor der sie steht — und nur ihr.**
	 * Solange der Rumpf einer Aktion bis zum nächsten Kopf reichte, zog er den
	 * Kommentar der nächsten mit hinein, und eine Ausnahmezeile entlastete zwei
	 * Aktionen (Code-Review 08.09.2026, gemessen an `leitung`).
	 */
	it('eine Ausnahme entlastet nicht die Aktion davor', () => {
		const baum = baumMit(
			seite(`\tloesen: async ({ request, locals }) => {
\t\tconst daten = await request.formData();
\t\tawait nimmAusTag(handelnder(locals), text(daten.get('versammlung')));
\t},

\t/* abend: versammlung — die Auswahl wird im Kern gegen den Abend geschnitten */
\tvertagen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait vertageAmAbend(handelnder(locals), params.id, daten.getAll('versammlung'));
\t}`)
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('loesen');
		expect(ausgabe).not.toContain('vertagen');
	});

	/*
	 * **Eine Seite, die ihre Handlungen über eine Fabrik baut**, hatte für den
	 * Zerleger null Aktionen — der Wächter zählte sie mit und las nichts darin.
	 * Das ist die schlimmste Art, ihn zu verlieren, weil sie wie Erfolg aussieht.
	 */
	it('sieht auch das Formular einer Fabrik ausserhalb der Aktionen', () => {
		const baum = baumMit(
			`function handlung(tun: unknown) {
\treturn async ({ request, locals }: never) => {
\t\tconst daten = await request.formData();
\t\tawait tun(text(daten.get('meeting')));
\t};
}

export const actions: Actions = {
\tvorlegen: handlung(vermerke)
};
`,
			'vollmachten'
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('ausserhalb der Aktionen');
	});

	/*
	 * **Zwei Fabriken auf einer Seite.** Solange der Resttext einer Datei als
	 * **ein** Abschnitt herauskam, deckte die gebundene Fabrik die ungebundene
	 * daneben mit ab — die Blindstelle, gegen die der Sammelabschnitt gebaut war,
	 * wäre damit wieder offen gewesen (Code-Review 08.09.2026).
	 */
	it('eine gebundene Fabrik deckt die ungebundene daneben nicht', () => {
		const baum = baumMit(
			`function gut(tun: unknown) {
\treturn async ({ request, locals, params }: never) => {
\t\tconst daten = await request.formData();
\t\tawait hausDesAbends(locals.benutzer.operatorId, params.id, text(daten.get('meeting')));
\t};
}

function schlecht(tun: unknown) {
\treturn async ({ request, locals }: never) => {
\t\tconst daten = await request.formData();
\t\tawait tun(text(daten.get('versammlung')));
\t};
}

export const actions: Actions = {
\ta: gut(x),
\tb: schlecht(y)
};
`,
			'vollmachten'
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('schlecht');
	});

	/*
	 * **Eine Schranke im Dateikopf bindet keine Aktion.** Für die erste Aktion
	 * begann der Vorlauf sonst bei 0, und eine nie aufgerufene Hilfsfunktion
	 * machte sie scheinbar geprüft.
	 */
	it('eine Schranke in einer Hilfsfunktion bindet die erste Aktion nicht', () => {
		const baum = baumMit(
			`function unbenutzt(locals: never, params: never) {
\treturn hausDesAbends(locals.benutzer.operatorId, params.id, 'x');
}

export const actions: Actions = {
\tloesen: async ({ request, locals }) => {
\t\tconst daten = await request.formData();
\t\tawait nimmAusTag(handelnder(locals), text(daten.get('versammlung')));
\t}
};
`
		);
		const { rot, ausgabe } = fahre(baum);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('loesen');
	});

	it('eine Aktion ohne Versammlungsfeld geht ihn nichts an', () => {
		const baum = baumMit(
			seite(`\tumbenennen: async ({ request, locals, params }) => {
\t\tconst daten = await request.formData();
\t\tawait benenneAbendUm(locals, params.id, text(daten.get('bezeichnung')));
\t}`)
		);
		expect(fahre(baum).rot).toBe(false);
	});

	/*
	 * **Ein Endpunkt, hinter dessen `};` noch etwas steht**, verschwand in der
	 * ersten Behebung lautlos aus der Prüfmenge: Der Rumpf wurde leer, und leer
	 * ist immer grün. Hier muss er gefunden werden.
	 */
	it('ein Endpunkt bleibt lesbar, auch mit Text hinter der Abschlusszeile', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'abendwaechter-'));
		verzeichnisse.push(wurzel);
		const ziel = join(wurzel, 'src', 'routes', 'tage', '[id=kennung]', 'strom');
		mkdirSync(ziel, { recursive: true });
		writeFileSync(
			join(ziel, '+server.ts'),
			`export const GET: RequestHandler = async ({ request, locals }) => {
\tconst daten = await request.formData();
\treturn neu(text(daten.get('versammlung')));
}; // Randbemerkung
`,
			'utf8'
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('GET');
	});

	/*
	 * **Nur der Abendbaum.** Unter `versammlungen/` steht die Versammlung in der
	 * Adresse; dort stellt `check-kernbindung` eine andere Frage. Läge der
	 * Wächter daneben, wäre er dort dauerhaft rot.
	 */
	it('ausserhalb von `tage/[id=kennung]` sieht er nicht hin', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'abendwaechter-'));
		verzeichnisse.push(wurzel);
		const ziel = join(wurzel, 'src', 'routes', 'tage', 'neu');
		mkdirSync(ziel, { recursive: true });
		writeFileSync(
			join(ziel, '+page.server.ts'),
			seite(`\tanlegen: async ({ request, locals }) => {
\t\tconst daten = await request.formData();
\t\tawait leg(locals, text(daten.get('versammlung')));
\t}`),
			'utf8'
		);
		expect(fahre(wurzel).rot).toBe(false);
	});
});

/*
 * **Die Sichtprobe am echten Baum.** Ohne sie belegt alles darüber nur, dass der
 * Wächter über erfundenen Dateien tut, was er soll — nicht, dass er die
 * wirklichen überhaupt findet.
 */
describe('am echten Baum', () => {
	it('ist grün und hat dabei wirklich etwas gelesen', () => {
		const { rot, ausgabe } = fahreWaechter(SKRIPT);
		expect(rot).toBe(false);
		const felder = Number(/(\d+) Versammlungsfelder über die Schranke gebunden/.exec(ausgabe)?.[1] ?? 0);
		expect(felder).toBeGreaterThanOrEqual(20);
	});

	/*
	 * **Die Zahl der Ausnahmen wird festgenagelt.** Wer `abend: X — <Satz>`
	 * schreibt, legt die Prüfung für dieses Feld still; sichtbar ist das sonst
	 * allein im Review. So macht eine neue Ausnahme den Prüflauf rot, bis jemand
	 * sie hier bewusst nachträgt.
	 *
	 * Die siebte seit dem 07.10.2026: `zurueck` in `tage/[id]/geschaefte` gibt
	 * die angekreuzten Häuser nach einer Absage ins Formular zurück und wirkt
	 * auf keine Versammlung.
	 */
	it('hat genau die sieben bekannten Ausnahmen', () => {
		const { ausgabe } = fahreWaechter(SKRIPT);
		expect(ausgabe).toContain('7 über eine begründete Ausnahme');
	});
});
