/**
 * Die Traktandenprüfung aus Sicht der Sitzungsleitung — mit echtem Modell.
 *
 * Der Prüflauf deckt den geraden Weg ab. Hier stehen die Fälle, die im Saal
 * wirklich vorkommen und bei denen sich zeigt, ob das Ding taugt: ein
 * Traktandum ohne Antragswortlaut, ein Name mit Anführungszeichen, ein
 * nichtssagendes «Diverses», zweimal hintereinander prüfen.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { pruefeTraktandum } from '$lib/server/traktandenpruefung';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from '../tests/db/helfer';

let betreiber: string;
let benutzer: string;
let stwegId: string;
let versammlungId: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Sitzungsleitung' });

beforeAll(async () => {
	betreiber = await pruefbetreiber('Sitzungsleitung');
	benutzer = await pruefbenutzer(betreiber, 'Leitung');

	const g = await erstelleGemeinschaft(handelnder(), {
		name: 'Nirgendwerk',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stwegId = g.id;

	const e = await erstelleEinheit(handelnder(), {
		stwegId,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	// Ein Name mit Anführungszeichen: Er wird beim Zurücksetzen wieder eingesetzt
	// und darf dabei nichts zerbrechen.
	for (const name of ['Anna Meier', 'Beat "Bäbu" Winter', 'Familie Müller-Keller']) {
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId,
			kind: 'natural',
			displayName: name,
			representativeName: null,
			isCommunity: false
		});
		if (name === 'Anna Meier') await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
	}

	const v = await erstelleVersammlung(handelnder(), {
		stwegId,
		datum: '2027-04-20',
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	versammlungId = v.id;
});

afterAll(async () => {
	await verbindungenSchliessen();
});

async function traktandum(eingabe: Record<string, unknown>) {
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: versammlungId,
		art: 'abstimmung',
		antragstellerart: 'bewirtschaftung',
		antragstellerId: null,
		antragstellerIds: [],
		betroffeneParteiIds: [],
		parentId: null,
		...eingabe
	} as never);
	return t.id;
}

function zeige(name: string, e: Awaited<ReturnType<typeof pruefeTraktandum>>) {
	console.log(`\n── ${name} — ${e.stufe ?? 'AUSFALL'} ${(e.dauerMs / 1000).toFixed(1)} s, ${e.namenGeschuetzt} Namen`);
	console.log(`   HINAUS: ${e.hinausgegangen.replace(/\n/g, ' | ')}`);
	for (const b of e.befunde) console.log(`   [${b.schwere}] ${b.was}\n           → ${b.vorschlag}`);
	if (e.fehlschlaege.length) console.log(`   FEHLSCHLAG: ${e.fehlschlaege.join(' · ')}`);
}

describe('Was die Sitzungsleitung wirklich tippt', () => {
	it('ein Antrag mit Namen im Text', async () => {
		const id = await traktandum({
			titel: 'Sanierung Balkon Familie Müller-Keller',
			inhalt: 'Der Balkon von Mueller-Keller ist undicht. Anna Meier hat eine Offerte eingeholt.',
			antragswortlaut: 'Die Versammlung beschliesst die Sanierung.'
		});
		const e = await pruefeTraktandum(handelnder(), id, versammlungId);
		zeige('Antrag mit Namen', e);
		expect(e.hinausgegangen).not.toMatch(/Meier|M[üu]e?ller|Keller/);
		expect(e.stufe).not.toBeNull();
	});

	it('ein Name mit Anführungszeichen zerbricht die Antwort nicht', async () => {
		/*
		 * **Der heikle Fall.** Die Namen werden in die Antwort zurückgesetzt.
		 * Geschieht das, solange die Antwort noch JSON ist, macht ein
		 * Anführungszeichen im Namen sie ungültig — und die Befunde
		 * verschwänden stillschweigend.
		 */
		const id = await traktandum({
			titel: 'Parkplatz Beat "Bäbu" Winter',
			inhalt: 'Beat "Bäbu" Winter verlangt einen zweiten Parkplatz.',
			antragswortlaut: 'Der Antrag wird gutgeheissen.'
		});
		/*
		 * **Ein zweiter Versuch, wie ihn die Anwendung auch vorschlägt.** Unter
		 * einer Salve von Aufrufen kommt gelegentlich eine unlesbare Antwort
		 * zurück; das ist der Zustand, für den es «bitte noch einmal prüfen
		 * lassen» gibt. Der Prüfstand soll den Fehler von damals fangen — das
		 * zerbrochene JSON durch das Anführungszeichen im Namen — und nicht die
		 * Tagesform eines fremden Hauses.
		 */
		let e = await pruefeTraktandum(handelnder(), id, versammlungId);
		if (e.unlesbar === true) e = await pruefeTraktandum(handelnder(), id, versammlungId);
		zeige('Name mit Anführungszeichen', e);
		expect(e.hinausgegangen).not.toMatch(/Winter|Bäbu/);
		/*
		 * **Geprüft wird die Lesbarkeit, nicht die Meinung.** Der Test entstand
		 * gegen einen Fehler, bei dem das Anführungszeichen im Namen die Antwort
		 * beim Zurücksetzen der Namen zu ungültigem JSON machte — die Befunde
		 * verschwanden still. Seit «unlesbar» von «nichts gefunden» getrennt ist,
		 * lässt sich genau das prüfen, ohne an einer Modellantwort zu hängen: Ein
		 * Modell darf nichts finden, aber es darf nicht unlesbar antworten.
		 */
		expect(e.unlesbar ?? false, 'die Antwort war nicht lesbar').toBe(false);
	});

	it('eine Kenntnisnahme ohne Antragswortlaut', async () => {
		// Hier ist der fehlende Wortlaut **kein** Mangel. Wer trotzdem einen
		// Befund dazu bekommt, lernt, die Prüfung zu ignorieren.
		const id = await traktandum({
			titel: 'Bericht der Verwaltung',
			art: 'kenntnisnahme',
			inhalt: 'Die Verwaltung berichtet über das vergangene Jahr.'
		});
		const e = await pruefeTraktandum(handelnder(), id, versammlungId);
		zeige('Kenntnisnahme', e);
		const ueberWortlaut = e.befunde.filter((b) => /wortlaut|antrag/i.test(b.was));
		expect(ueberWortlaut, `Befund über den fehlenden Wortlaut bei einer Kenntnisnahme`).toEqual([]);
	});

	it('ein nichtssagendes «Diverses»', async () => {
		const id = await traktandum({ titel: 'Diverses', antragswortlaut: 'Diverses.' });
		const e = await pruefeTraktandum(handelnder(), id, versammlungId);
		zeige('Diverses', e);
		/*
		 * **Gemessen, nicht behauptet.** Ein Modell ist nicht reproduzierbar; an
		 * einem Lauf, der heute zwei Befunde findet und morgen keinen, darf kein
		 * Prüfstand hängen. Festgehalten wird, dass die Kette geantwortet hat —
		 * was sie inhaltlich fand, steht im Protokoll des Laufs.
		 */
		expect(e.stufe === null || e.nutzungId !== null).toBe(true);
	});

	it('zweimal prüfen hinterlässt zwei Spuren', async () => {
		const id = await traktandum({ titel: 'Zaun', antragswortlaut: 'Der Zaun wird ersetzt.' });
		await pruefeTraktandum(handelnder(), id, versammlungId);
		await pruefeTraktandum(handelnder(), id, versammlungId);
		const zeilen = await imKontext(betreiber, async (tx) =>
			tx`SELECT outcome FROM ai_usage WHERE subject_id = ${id}`
		);
		expect(zeilen.length).toBe(2);
	});
});

// ── Der Erfordernisvorschlag (FR-59) ────────────────────────────────────────

describe('Welchen Fall das Modell vorschlägt', () => {
	/*
	 * **Hier wird gemessen, nicht behauptet.** Die fachlich richtige Antwort
	 * steht in der vierten Spalte — aber sie ist **keine Zusage**: Ein Modell
	 * ist nicht reproduzierbar, und der Prüfstand darf nicht rot werden, weil
	 * es heute anders rät als gestern. Was er festhält, ist die Trefferquote.
	 *
	 * Stand 05.08.2026 (Infomaniak, Mistral-Small-4): 5 von 6 richtig, aber der
	 * **Liftanbau in nur einem von vier Läufen**. Das Modell beantwortet die
	 * Frage «Ist die Massnahme nötig, um Wert oder Gebrauchsfähigkeit zu
	 * erhalten?» beim Anbau von etwas Neuem mit Ja — einfaches Mehr statt
	 * qualifiziertem, also die gefährliche Richtung.
	 */
	const bilanz: string[] = [];
	afterAll(() => {
		if (bilanz.length) console.log(`\n══ Trefferbilanz\n${bilanz.join('\n')}`);
	});
	// Die vierte Spalte ist die **fachlich richtige** Antwort, nicht die des
	// Modells. Sie entscheidet, ob die Funktion taugt.
	const faelle: [string, string, string, string][] = [
		['Lift anbauen', 'Ein Lift wird nachgerüstet, es gibt heute keinen.', 'Der Lift wird eingebaut.', 'k-baulich-nuetzlich'],
		['Fassade streichen', 'Die verwitterte Fassade wird neu gestrichen.', 'Die Fassade wird gestrichen.', 'k-baulich-notwendig'],
		['Dach undicht', 'Das Dach ist undicht, Wasser dringt ein.', 'Das Dach wird repariert.', 'k-baulich-notwendig'],
		// Beim Zierbrunnen sind **zwei** Ausgänge vertretbar: Einstimmigkeit oder
		// der Ausweg von ZGB Art. 647e Abs. 2, wenn die übrigen die Kosten
		// übernehmen. Beide fangen mit «luxuriös» an — das ist der Prüfpunkt.
		['Zierbrunnen', 'Im Garten soll ein Zierbrunnen zur Verschönerung aufgestellt werden.', 'Der Brunnen wird gebaut.', 'k-baulich-luxurioes'],
		['Verwaltung wählen', 'Die Bewirtschaftung wird für drei Jahre gewählt.', 'Die Bewirtschaftung wird gewählt.', 'k-bewirtschaftung-waehlen'],
		['Jahresrechnung', 'Die Jahresrechnung 2026 liegt vor.', 'Die Jahresrechnung wird genehmigt.', 'k-jahresrechnung']
	];

	it.each(faelle)('%s', async (titel, inhalt, wortlaut, erwartet) => {
		const { holeVorschlag } = await import('$lib/server/erfordernisvorschlag');
		const { holeRegelwerk } = await import('$lib/rules');

		const id = await traktandum({ titel, inhalt, antragswortlaut: wortlaut });
		const rw = holeRegelwerk();
		const e = await holeVorschlag(handelnder(), id, versammlungId, rw);

		console.log(
			`\n── ${titel} — ${e.stufe ?? 'AUSFALL'} ${(e.dauerMs / 1000).toFixed(1)} s` +
				(e.vorschlag
					? `\n   ${e.vorschlag.titel} [${e.vorschlag.typ}]` +
						`${e.vorschlag.grenzfall ? ' GRENZFALL' : ''}` +
						`${e.vorschlag.knotenId.startsWith(erwartet) ? '  ✓ erwartet' : `  ✗ ERWARTET WAR ${erwartet}`}` +
						`\n   Weg: ${e.vorschlag.schritte.map((s) => s.antwortText).join(' › ')}` +
						`\n   ${e.vorschlag.rechtsgrundlage}`
					: `\n   KEIN VORSCHLAG: ${e.grund ?? e.fehlschlaege.join(' · ')}`)
		);

		// **Die eine Zusage:** Was herauskommt, ist ein Knoten des echten Baums —
		// oder es kommt gar nichts. Erfinden ist nicht möglich.
		if (e.vorschlag) {
			expect(rw.knoten.some((k) => k.id === e.vorschlag!.knotenId)).toBe(true);
			expect(e.vorschlag.schritte.length).toBeGreaterThan(0);
			bilanz.push(
				`  ${e.vorschlag.knotenId.startsWith(erwartet) ? 'richtig ' : 'FALSCH  '} ${titel.padEnd(18)} ${e.vorschlag.titel}`
			);
		}
		expect(e.nutzungId).not.toBeNull();
	});
});

// ── Die Antragsprüfung im Saal (FR-60) ──────────────────────────────────────

describe('Ob ein Antrag im angekündigten Geschäft bleibt', () => {
	const bilanz: string[] = [];
	afterAll(() => {
		if (bilanz.length) console.log(`\n══ Antragsbilanz\n${bilanz.join('\n')}`);
	});

	const grundantrag = {
		titel: 'Sanierung der Westfassade',
		inhalt: 'Die Westfassade ist verwittert und wird neu gestrichen.',
		antragswortlaut: 'Die Versammlung beschliesst die Sanierung der Westfassade für CHF 80’000.'
	};

	// Die vierte Spalte ist die fachlich richtige Einordnung.
	const antraege: [string, string, string, string][] = [
		['Betrag gesenkt', 'Sanierung Westfassade, günstigere Variante', 'Die Sanierung wird für höchstens CHF 60’000 beschlossen.', 'im_rahmen'],
		['Etappiert', 'Sanierung Westfassade in zwei Etappen', 'Die Sanierung wird in zwei Etappen über zwei Jahre ausgeführt.', 'im_rahmen'],
		['Verschoben', 'Sanierung Westfassade später', 'Die Sanierung wird auf das nächste Jahr verschoben.', 'im_rahmen'],
		['Dämmung dazu', 'Sanierung Westfassade mit Aussendämmung', 'Die Westfassade wird saniert und zugleich aussen gedämmt.', 'grenzwertig'],
		['Anderes Gebäudeteil', 'Sanierung des Dachs', 'Das Dach wird ebenfalls saniert.', 'sachfremd'],
		['Ganz andere Sache', 'Anschaffung eines Gartenhauses', 'Es wird ein Gartenhaus angeschafft.', 'sachfremd']
	];

	/** Eine eigene, **laufende** Versammlung: Spontantraktanden gibt es nur dort. */
	let saalId: string;
	let grundId: string;

	beforeAll(async () => {
		const { gibVersammlungFrei } = await import('$lib/server/freigabe');
		const { erzeugeZugaenge } = await import('$lib/server/zugaenge');
		const { eroeffneVersammlung, erstelleVersammlung: neu } = await import(
			'$lib/server/versammlungen'
		);
		const { erstelleTraktandum: neuesTraktandum } = await import('$lib/server/traktanden');

		const v = await neu(handelnder(), {
			stwegId,
			datum: '2027-06-15',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		saalId = v.id;
		const g = await neuesTraktandum(handelnder(), {
			meetingId: saalId,
			art: 'abstimmung',
			antragstellerart: 'bewirtschaftung',
			antragstellerId: null,
			antragstellerIds: [],
			betroffeneParteiIds: [],
			parentId: null,
			...grundantrag
		} as never);
		grundId = g.id;
		await gibVersammlungFrei(handelnder(), saalId);
		await erzeugeZugaenge(handelnder(), saalId);
		await eroeffneVersammlung(handelnder(), saalId);
	});

	it.each(antraege)('%s', async (name, titel, wortlaut, erwartet) => {
		const { pruefeAntrag } = await import('$lib/server/antragspruefung');
		const { nimmTraktandumAuf } = await import('$lib/server/traktanden');
		const folge = await nimmTraktandumAuf(
			handelnder(),
			{
				meetingId: saalId,
				parentId: grundId,
				titel,
				art: 'abstimmung',
				antragswortlaut: wortlaut,
				antragstellerart: 'gemeinschaft',
				antragstellerId: null,
				antragstellerIds: [],
				betroffeneParteiIds: []
			} as never,
			'folgeantrag'
		);

		// `saalId`, nicht `versammlungId`: Der Folgeantrag haengt an der laufenden
		// Versammlung dieses Blocks. Mit der falschen Kennung liefe die neue
		// Bindung in «gibt es nicht mehr», und der ganze Block pruefte am Modell
		// nichts mehr (02.09.2026, aus dem Code-Review — der Typlauf sieht es
		// nicht, beide sind `string`).
		const e = await pruefeAntrag(handelnder(), folge.id, saalId);
		const b = e.beurteilung;
		console.log(
			`\n── ${name} — ${e.stufe ?? 'AUSFALL'} ${(e.dauerMs / 1000).toFixed(1)} s` +
				(b
					? `\n   ${b.einschaetzung}${b.einschaetzung === erwartet ? '  ✓' : `  ✗ erwartet ${erwartet}`}` +
						`\n   ${b.begruendung}${b.neuesThema ? `\n   Neu: ${b.neuesThema}` : ''}`
					: `\n   KEINE BEURTEILUNG: ${e.grund ?? e.fehlschlaege.join(' · ')}`)
		);
		if (b) bilanz.push(`  ${b.einschaetzung === erwartet ? 'richtig ' : 'FALSCH  '} ${name.padEnd(20)} ${b.einschaetzung}`);

		// **Im Saal zählt die Sekunde** (FR-60). Alles über fünf Sekunden ist dort
		// unbenutzbar — dann wartet die Versammlung.
		if (e.stufe !== null) expect(e.dauerMs).toBeLessThan(5000);
		expect(e.nutzungId).not.toBeNull();
	});
});

// ── Empfehlung und Entscheid (Vorgabe des Auftraggebers vom 05.08.2026) ─────

describe('Die Sitzungsleitung entscheidet, nicht das Werkzeug', () => {
	it('gibt zu jeder Einschätzung eine Empfehlung ab', async () => {
		const { empfehlung, EINSCHAETZUNGEN } = await import('$lib/domain/antragspruefung');
		for (const e of EINSCHAETZUNGEN) {
			const emp = empfehlung({ einschaetzung: e, begruendung: 'x'.repeat(20), neuesThema: null });
			expect(emp.satz.startsWith('Empfehlung')).toBe(true);
			// Bei «grenzwertig» wird ausdrücklich **keine** geraten — das ist der
			// ehrliche Fall und nicht der faule.
			expect(emp.wort).toBe(
				e === 'im_rahmen' ? 'zulassen' : e === 'sachfremd' ? 'nicht_zulassen' : 'selbst_entscheiden'
			);
		}
	});

	it('hält den Entscheid fest — und lässt ihn ändern', async () => {
		const { vermerkeEntscheid, haltNutzungFest } = await import('$lib/server/ki');
		const id = await haltNutzungFest(handelnder(), {
			stwegId,
			// **Mit Versammlung**, wie im Betrieb: `erfordernisvorschlag` reicht
			// `t.meeting_id` durch, und der Entscheid ist seit dem 02.09.2026 daran
			// gebunden. Ohne sie prueft diese Probe einen Weg, den es nicht gibt.
			meetingId: versammlungId,
			funktion: 'erfordernisvorschlag'
		});

		// Vorher offen: Genau daran erkennt man später, ob jemand hingesehen hat.
		const [vorher] = await imKontext(betreiber, async (tx) =>
			tx`SELECT outcome FROM ai_usage WHERE id = ${id}`
		);
		expect(vorher.outcome).toBeNull();

		const bindung = { art: 'versammlung' as const, versammlungId };
		await vermerkeEntscheid(handelnder(), id, 'angenommen', bindung);
		// Umentschieden — im Saal kommt das vor, und der letzte Stand gilt.
		await vermerkeEntscheid(handelnder(), id, 'abgelehnt', bindung);
		const [nachher] = await imKontext(betreiber, async (tx) =>
			tx`SELECT outcome FROM ai_usage WHERE id = ${id}`
		);
		expect(nachher.outcome).toBe('abgelehnt');
		// Das Umentscheiden überschreibt `outcome`; der Verlauf behält beide
		// (Produktentscheid 30.09.2026).
		const verlauf = await imKontext(betreiber, async (tx) =>
			tx`SELECT detail->>'entscheid' AS entscheid FROM audit_entry
			   WHERE event_type = 'ai.decision.recorded' AND detail->>'nutzung' = ${id}
			   ORDER BY id`
		);
		expect(verlauf.map((e) => e.entscheid)).toEqual(['angenommen', 'abgelehnt']);
	});

	it('schreibt keinen Entscheid in einen fremden Mandanten', async () => {
		/*
		 * **Der Zeilenschutz muss auch hier greifen.** Ein Entscheid ist eine
		 * Schreiboperation auf eine fremde Zeile, wenn die Kennung geraten wird.
		 */
		const { vermerkeEntscheid, haltNutzungFest } = await import('$lib/server/ki');
		const fremder = await pruefbetreiber('Fremder Betreiber');
		const id = await haltNutzungFest(handelnder(), {
			stwegId,
			meetingId: versammlungId,
			funktion: 'antragspruefung'
		});

		/*
		 * **Seit dem 02.09.2026 sagt es das auch.** Vorher lief der fremde Zugriff
		 * ins Leere und schwieg; jetzt wirft die Bindung, weil ein Entscheid, der
		 * nicht ankommt, gemeldet gehoert.
		 */
		await expect(
			vermerkeEntscheid({ operatorId: fremder, userId: null, label: 'Fremder' }, id, 'angenommen', {
				art: 'versammlung',
				versammlungId
			})
		).rejects.toThrow();

		const [z] = await imKontext(betreiber, async (tx) =>
			tx`SELECT outcome FROM ai_usage WHERE id = ${id}`
		);
		expect(z.outcome, 'ein fremder Betreiber konnte den Entscheid setzen').toBeNull();
	});

	it('sagt es, wenn die Nutzung nicht existiert', async () => {
		/*
		 * **Bis zum 02.09.2026 lief das ins Leere.** Ein Entscheid, der nirgends
		 * ankommt, ist schlimmer als eine Absage: Die Sitzungsleitung haelt ihn
		 * fuer festgehalten und findet ihn im Nachweis nicht wieder.
		 */
		const { vermerkeEntscheid } = await import('$lib/server/ki');
		await expect(
			vermerkeEntscheid(handelnder(), '00000000-0000-7000-8000-000000000000', 'angenommen', {
				art: 'versammlung',
				versammlungId
			})
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
	});
});

describe('Was passiert, wenn die Angaben dünn sind', () => {
	it('prüft ein Traktandum, das nur aus einem Titel besteht', async () => {
		/*
		 * **Als Kenntnisnahme, weil es anders gar nicht entstehen kann.** Ein
		 * Abstimmungstraktandum ohne Antragswortlaut weist die Anwendung schon
		 * beim Anlegen ab — die Prüfung muss diesen Fall also nie abfangen.
		 */
		const { pruefeTraktandum } = await import('$lib/server/traktandenpruefung');
		const id = await traktandum({ titel: 'Verschiedenes', art: 'kenntnisnahme' });
		const e = await pruefeTraktandum(handelnder(), id, versammlungId);
		console.log(
			`\n── Nur ein Titel (Kenntnisnahme) — ${e.befunde.length} Befunde, ${e.stufe}` +
				e.befunde.map((b) => `\n   [${b.schwere}] ${b.was}`).join('')
		);
		/*
		 * **Null Befunde sind hier richtig.** «Verschiedenes» am Ende der
		 * Traktandenliste ist übliche Praxis. Geprüft wird deshalb nicht die
		 * Zahl, sondern dass kein Scheinbefund über einen fehlenden
		 * Antragswortlaut entsteht — den gibt es bei einer Kenntnisnahme nicht.
		 */
		expect(e.befunde.filter((b) => /wortlaut|antrag/i.test(b.was))).toEqual([]);
	});

	it('gibt bei einem Antrag ohne Grundantrag keine Einschätzung, sondern den Grund', async () => {
		/*
		 * Ein Antrag, der unter keinem angekündigten Traktandum hängt, ist schon
		 * der Form nach ein neues Geschäft. Darüber entscheiden das Reglement
		 * oder die Universalversammlung — und kein Modell.
		 */
		const { pruefeAntrag } = await import('$lib/server/antragspruefung');
		const allein = await traktandum({ titel: 'Freistehend', antragswortlaut: 'Etwas wird beschlossen.' });
		const e = await pruefeAntrag(handelnder(), allein, versammlungId);
		expect(e.beurteilung).toBeNull();
		expect(e.grund).toMatch(/Reglement oder die Universalversammlung/);
		// **Kein Aufruf, kein Nachweis**: Es wurde nichts gefragt.
		expect(e.nutzungId).toBeNull();
		expect(e.dauerMs).toBe(0);
	});
});

// ── Der Protokollentwurf (FR-61) ────────────────────────────────────────────

describe('Notizen ausformulieren', () => {
	it('macht aus Stichworten Absätze — ohne neue Zahlen', async () => {
		const { formuliereNotizen, maschinellVorbereitet } = await import(
			'$lib/server/protokollentwurf'
		);
		const { setzeProtokollnotiz } = await import('$lib/server/protokoll');
		const { erstelleVersammlung: neu } = await import('$lib/server/versammlungen');
		const { erstelleTraktandum: neuesT } = await import('$lib/server/traktanden');

		const v = await neu(handelnder(), {
			stwegId,
			datum: '2027-09-01',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});

		const notizen: [string, string, string][] = [
			['Fassade', 'Die Fassade wird saniert.', 'Offerte 24’800 vorgestellt, Anna Meier fragt nach Garantie, 5 Jahre, Rückstellung reicht'],
			['Zaun', 'Der Zaun wird ersetzt.', 'Zaun ersetzen, Offerten einholen, Bericht nächstes Jahr'],
			['Heizung', 'Die Heizung wird ersetzt.', 'kontrovers, Beat Winter dagegen wegen Kosten, Familie Müller-Keller dafür'],
			['Ohne Notiz', 'Etwas anderes wird beschlossen.', '']
		];
		for (const [titel, wortlaut, notiz] of notizen) {
			const t = await neuesT(handelnder(), {
				meetingId: v.id,
				titel,
				art: 'abstimmung',
				antragswortlaut: wortlaut,
				antragstellerart: 'bewirtschaftung',
				antragstellerId: null,
				antragstellerIds: [],
				betroffeneParteiIds: [],
				parentId: null
			} as never);
			if (notiz) await setzeProtokollnotiz(handelnder(), v.id, t.id, notiz);
		}

		const e = await formuliereNotizen(handelnder(), v.id);
		console.log(`\n══ Protokollentwurf — ${e.stufe}, ${(e.dauerMs / 1000).toFixed(1)} s, ${e.namenGeschuetzt} Namen`);
		for (const vs of e.vorschlaege) {
			console.log(`\n── ${vs.titel}\n   NOTIZ: ${vs.notiz}\n   ${vs.absatz ? 'ABSATZ: ' + vs.absatz : 'VERWORFEN: ' + vs.grund}`);
		}

		// **Traktanden ohne Notiz werden nicht gefragt** (FR-61).
		expect(e.ohneNotiz).toBeGreaterThan(0);
		expect(e.vorschlaege.some((x) => x.titel === 'Ohne Notiz')).toBe(false);

		// **Kein Name geht hinaus** — die Notizen enthalten drei.
		expect(e.hinausgegangen).not.toMatch(/Meier|Winter|M[üu]e?ller|Keller/);
		expect(e.namenGeschuetzt).toBeGreaterThan(0);

		// **Und keine erfundene Zahl kommt durch.** Was durchkommt, enthält nur
		// Zahlen, die schon in der Notiz standen.
		const { erfundeneZahlen } = await import('$lib/domain/protokollentwurf');
		for (const vs of e.vorschlaege) {
			if (vs.absatz) expect(erfundeneZahlen(vs.notiz, vs.absatz)).toEqual([]);
		}

		// **Der Vermerk erscheint erst nach dem Entscheid** (Korrektur vom
		// 05.08.2026): Wer nichts übernimmt, hat kein maschinell vorbereitetes
		// Protokoll.
		expect(await maschinellVorbereitet(betreiber, v.id)).toBeNull();
		const { haltEntwurfsentscheidFest } = await import('$lib/server/protokollentwurf');
		await haltEntwurfsentscheidFest(handelnder(), e.nutzungId!, {
			art: 'versammlung',
			versammlungId: v.id
		}, 'angenommen');
		expect((await maschinellVorbereitet(betreiber, v.id))?.anbieter).toBeTruthy();
	});
});

// ── Fehlersuche am Protokollentwurf ─────────────────────────────────────────

describe('Wo der Protokollentwurf brechen könnte', () => {
	async function versammlungMitNotizen(notizen: string[]) {
		const { erstelleVersammlung: neu } = await import('$lib/server/versammlungen');
		const { erstelleTraktandum: neuesT } = await import('$lib/server/traktanden');
		const { setzeProtokollnotiz } = await import('$lib/server/protokoll');
		const v = await neu(handelnder(), {
			stwegId,
			datum: '2027-10-01',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		let n = 0;
		for (const notiz of notizen) {
			const t = await neuesT(handelnder(), {
				meetingId: v.id,
				titel: `Punkt ${++n}`,
				art: 'kenntnisnahme',
				antragstellerart: 'bewirtschaftung',
				antragstellerId: null,
				antragstellerIds: [],
				betroffeneParteiIds: [],
				parentId: null
			} as never);
			if (notiz) await setzeProtokollnotiz(handelnder(), v.id, t.id, notiz);
		}
		return v.id;
	}

	it('behauptet den Maschinenvermerk nicht, wenn nichts übernommen wurde', async () => {
		/*
		 * **Der Vermerk ist eine Aussage über den Text.** «Dieser Entwurf wurde
		 * maschinell vorbereitet» stimmt nicht, wenn die Sitzungsleitung sich alles
		 * angesehen und nichts übernommen hat — dann steht im Protokoll kein
		 * einziger maschinell entstandener Satz.
		 */
		const { formuliereNotizen, maschinellVorbereitet, haltEntwurfsentscheidFest } = await import(
			'$lib/server/protokollentwurf'
		);
		const id = await versammlungMitNotizen(['Zaun ersetzen, Offerten einholen']);
		const e = await formuliereNotizen(handelnder(), id);
		expect(e.nutzungId).not.toBeNull();

		// Angesehen und verworfen.
		await haltEntwurfsentscheidFest(handelnder(), e.nutzungId!, {
			art: 'versammlung',
			versammlungId: id
		}, 'abgelehnt');
		expect(await maschinellVorbereitet(betreiber, id)).toBeNull();
	});

	it('lässt keinen erfundenen Platzhalter in die Notiz', async () => {
		// Ein «[Person 9]», das nie vergeben wurde, bliebe beim Zurücksetzen
		// stehen — und stünde dann wörtlich im Protokoll.
		const { lesbarerAbsatz } = await import('$lib/domain/protokollentwurf');
		const l = lesbarerAbsatz(
			'[Person 1] und [Person 9] sprachen sich dafür aus.',
			'[Person 1] dafür.'
		);
		expect(l.absatz, 'ein erfundener Platzhalter kam durch').toBeNull();
	});

	it('fragt nicht endlos, wenn eine Versammlung sehr viele Notizen hat', async () => {
		/*
		 * **Je Notiz ein Aufruf** — bei dreissig Traktanden sind das dreissig, und
		 * bei einem hängenden Anbieter je zwölf Sekunden Geduld. Wer dann auf den
		 * Knopf drückt, wartet Minuten vor einem stehenden Bildschirm.
		 */
		const { formuliereNotizen } = await import('$lib/server/protokollentwurf');
		const viele = Array.from({ length: 26 }, (_, i) => `Punkt ${i + 1} besprochen, nichts Besonderes`);
		const id = await versammlungMitNotizen(viele);
		const e = await formuliereNotizen(handelnder(), id);
		console.log(`\n══ 26 Notizen — ${e.vorschlaege.length} gefragt, ${(e.dauerMs / 1000).toFixed(1)} s`);
		expect(e.vorschlaege.length, 'es wurde ohne Schranke gefragt').toBeLessThanOrEqual(20);
	});

	it('schreibt keine Notiz in eine fremde Versammlung', async () => {
		const { setzeProtokollnotiz } = await import('$lib/server/protokoll');
		const fremder = await pruefbetreiber('Fremder fuers Protokoll');
		const id = await versammlungMitNotizen(['Etwas']);
		const [t] = await imKontext(betreiber, async (tx) =>
			tx`SELECT id FROM agenda_item WHERE meeting_id = ${id} LIMIT 1`
		);
		await expect(
			setzeProtokollnotiz(
				{ operatorId: fremder, userId: benutzer, label: 'Fremd' },
				id,
				t.id,
				'Eingeschmuggelt'
			)
		).rejects.toThrow();
	});
});
