/**
 * Was ein Reglement darf und was nicht (offene Frage 1 des PRD).
 *
 * **Der Fall, um den es geht.** Eine Gemeinschaft hinterlegt für luxuriöse
 * Massnahmen ein Zweidrittelmehr. Bis zum 13.08.2026 hätte die Anwendung das
 * angewandt — und ein Beschluss wäre als angenommen ausgewiesen worden, obwohl
 * er die Zustimmung aller gebraucht hätte (ZGB Art. 647e Abs. 1). Still, mit
 * richtig aussehenden Zahlen.
 *
 * Geprüft wird beides, weil nur beides zusammen die Regel beschreibt:
 *
 *   1. **Wo das Gesetz dispositiv ist, gilt das Reglement** — für nützliche
 *      Massnahmen wird das Zweidrittelmehr angewandt, und das gesetzliche
 *      Erfordernis steht daneben.
 *   2. **Wo es Einstimmigkeit verlangt, gilt es weiter** — die Regel steht
 *      daneben, mit dem Satz, dass das eine Rechtsfrage ist und kein Zählfehler.
 *
 * Die Kette, die dabei mitgeprüft wird: Reglementsseite → Datenbank →
 * `holeReglementsregeln` → `wendeReglementAn` → Ergebniskarte.
 *
 * Aufruf: `node e2e/reglementsschranke.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-reglementsschranke';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

/** Die Wege durch den Bauast, als Antwortfolge in der Adresse. */
const NUETZLICH = 'f1-0-nein,f1-1-nein,f1-2-ja';
const LUXURIOES = 'f1-0-nein,f1-1-nein,f1-2-nein,f1-3-verschoenerung,f1-4-ja';

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

async function schritt(titel, fn) {
	nr += 1;
	try {
		const ergebnis = await fn();
		console.log(`  ${String(nr).padStart(2)} ✓ ${titel}${ergebnis ? ` — ${ergebnis}` : ''}`);
	} catch (e) {
		fehler.push(`${titel}: ${e.message}`);
		console.log(`  ${String(nr).padStart(2)} ✗ ${titel} — ${e.message}`);
		await seite
			.screenshot({ path: `${AUFNAHMEN}/fehler-${String(nr).padStart(2, '0')}.png` })
			.catch(() => {});
	}
}

await mkdir(AUFNAHMEN, { recursive: true });
const browser = await chromium.launch();
const seite = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);

async function abschicken(knopf) {
	await Promise.all([
		seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 }).catch(() => null),
		knopf.click()
	]);
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(250);
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

const seitentext = async () => (await seite.locator('main').innerText()).replace(/\s+/g, ' ');

try {
	let gemeinschaft;
	const NAME = `Prüflauf Reglement ${LAUF}`;

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		// **Erst warten, dann behaupten.** Die Anmeldung springt im Browser weiter,
		// nicht über eine Antwort des Servers: `abschicken` sieht den POST und wartet
		// 250 ms, und unter Last reicht das nicht. Am 27.08.2026 meldeten zwei
		// Drehbücher «Anmeldung fehlgeschlagen», während alle folgenden Schritte
		// grün liefen — die Anmeldung war gelungen, die Zusicherung zu früh.
		//
		// Das Warten steht ausdrücklich VOR der Zusicherung und ersetzt sie nicht:
		// Läuft die Frist ab, bleibt die Adresse `/anmelden` und der Befund kommt.
		await seite
			.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 })
			.catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Eine Gemeinschaft für den Prüflauf anlegen', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(gemeinschaft, `Nicht angelegt: ${seite.url()}`);
		return gemeinschaft.slice(0, 8);
	});

	/*
	 * **Alle Felder aus demselben Rahmen.**
	 *
	 * Bis zum 27.08.2026 stand hier `input[name="kopfZaehler"]` ohne Rahmen.
	 * Seit die Reglementseite eine zweite Regel «Kopfstimmen im Haus» trägt,
	 * heissen zwei Felder gleich, und Playwright weist einen Selektor ab, der
	 * zwei Elemente trifft. Das gab neun Befunde aus einer Zeile.
	 *
	 * Die beiden Felder sind kein Mangel: Sie liegen in zwei getrennten
	 * Formularen (`?/hinterlegen` und `?/weisungsregel`) mit je eigenem Leser,
	 * beim Abschicken kollidieren sie nicht. Der Rahmen gehört ins Drehbuch,
	 * nicht in die Anwendung.
	 */
	/** Das Formular, in dem Abweichungen angelegt und geändert werden. */
	const abweichungsformular = () => seite.locator('form#abweichungsformular');

	async function hinterlege(geschaeftsart, fundstelle, fall) {
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const rahmen = abweichungsformular();
		await rahmen.locator('select[name="geschaeftsart"]').selectOption(geschaeftsart);
		if (fall) await rahmen.locator(`input[name="knotenId"][value="${fall}"]`).check();
		await rahmen.locator('input[name="kopfZaehler"]').fill('2');
		await rahmen.locator('input[name="kopfNenner"]').fill('3');
		await rahmen.locator('input[name="fundstelle"]').fill(fundstelle);
		await abschicken(rahmen.locator('button[type="submit"]'));
		/*
		 * **Auf die Fundstelle warten, nicht auf die Uhr** (03.09.2026). Die
		 * Schritte 4 und 12 waren sporadisch rot mit «Regel nicht übernommen»:
		 * `abschicken` kehrt mit der Antwort zurück, aber `use:enhance` trägt das
		 * Ergebnis erst danach in den Baum. Wer unmittelbar den Seitentext liest,
		 * liest den Stand davor. Sichtbar wurde es, als eine eingefügte
		 * Diagnosezeile die Schritte grün machte — ein Zeitgewinn, keine Behebung.
		 */
		await seite
			.locator('main', { hasText: fundstelle })
			.first()
			.waitFor({ timeout: 10_000 });
	}

	await schritt('Zweidrittelmehr für nützliche Massnahmen hinterlegen', async () => {
		await hinterlege('baulich_nuetzlich', 'Reglement Ziff. 12.3');
		const text = await seitentext();
		behaupte(/Ziff\. 12\.3/.test(text), `Regel nicht übernommen: ${text.slice(0, 250)}`);
		return 'Ziff. 12.3';
	});

	await schritt('Dasselbe für luxuriöse Massnahmen hinterlegen', async () => {
		// Zulässig zu erfassen — die Gemeinschaft darf in ihr Reglement schreiben,
		// was sie will. Die Frage ist erst, was davon beim Zählen gilt.
		await hinterlege('baulich_luxurioes', 'Reglement Ziff. 12.9');
		const text = await seitentext();
		behaupte(/Ziff\. 12\.9/.test(text), `Regel nicht übernommen: ${text.slice(0, 250)}`);
		return 'Ziff. 12.9';
	});

	await schritt('Die Übersicht sagt, was für diese Gemeinschaft gilt', async () => {
		/*
		 * **Prüflauf I, A-11**: «Heute muss ich vier Seiten einzeln aufsuchen, um
		 * zu wissen, was ich vor elf Minuten selbst eingestellt habe.» Die Karte
		 * sagt, DASS es die Regeln gibt und wo sie stehen.
		 *
		 * Geprüft wird nach dem Hinterlegen zweier Quorenregeln: Die Zahl muss
		 * mitgehen, sonst steht dort eine Zusicherung, die niemand nachzieht.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}`);
		const text = await seitentext();
		behaupte(/Vollmachten/.test(text), 'Die Vollmachtsgrenze fehlt auf der Übersicht');
		behaupte(/Beschlussfähigkeit/.test(text), 'Die Beschlussfähigkeitsregel fehlt');
		behaupte(
			/2 Abweichungen hinterlegt/.test(text),
			`Die Quorenabweichungen werden nicht gezählt: ${text.slice(0, 600)}`
		);
		return '2 Abweichungen, Vollmachten und Beschlussfähigkeit benannt';
	});

	await schritt('Die Reglementsseite zeigt daneben, was das Gesetz vorsieht', async () => {
		/*
		 * **Prüflauf I, A-14**: Wer eine Abweichung hinterlegt, muss sehen, wovon
		 * er abweicht — sonst schreibt er «zwei Drittel» hin, wo das Gesetz schon
		 * zwei Drittel verlangt, und hält es für eine Verschärfung.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const ausklapper = seite.locator('details').filter({
			hasText: 'Was das Gesetz für diese Art vorsieht'
		});
		behaupte(await ausklapper.count(), 'Der Ausklapper mit der gesetzlichen Lage fehlt');
		await ausklapper.first().locator('summary').click();
		const inhalt = await ausklapper.first().innerText();
		behaupte(
			/Mehrheit/.test(inhalt) && inhalt.length > 120,
			`Der Ausklapper nennt keine gesetzlichen Erfordernisse: ${inhalt.slice(0, 300)}`
		);
		/*
		 * Und die Zuordnungshilfe (A-14, zweiter Teil): «welche Geschäfte fallen
		 * unter welche der 15 Arten? Für § 15 habe ich geraten.» Geprüft an der
		 * Art, die beim Öffnen vorausgewählt ist.
		 */
		behaupte(
			/z\. B\./.test(inhalt),
			`Keine Beispiele — die Frage «faellt mein Geschäft darunter?» bleibt offen: ${inhalt.slice(0, 300)}`
		);
		return 'gesetzliche Lage und Beispiele je Geschäftsart';
	});

	await schritt('Bei nützlichen Massnahmen greift das Reglement, mit seiner Bedingung', async () => {
		/*
		 * **Dieser Schritt hat am 07.10.2026 ein zweites Mal die Seite
		 * gewechselt** (Fassung 2026-10-15, Produktentscheid nach Fachprüfung).
		 * Die Regel greift wieder; die Karte sagt jetzt, dass sie nur gilt, wenn
		 * sie einstimmig oder im Begründungsakt eingeführt wurde, und dass die
		 * Anwendung das nicht prüfen kann. Die Geschichte davor:
		 *
		 * **Am 23.09.2026 hatte er schon einmal die Seite gewechselt.** Bis dahin
		 * prüfte er, dass die hinterlegte Regel angewandt wird («Reglementsmehr,
		 * Gesetz daneben»). Seit der Fassung 2026-09-23 wird sie das nicht
		 * mehr: Das Quorum der nützlichen baulichen Massnahme stammt aus ZGB
		 * Art. 647d und fällt damit unter Art. 712g Abs. 2 — eine andere
		 * Ordnung nur im Begründungsakt oder mit einstimmigem Beschluss
		 * (Befund B-02 der Rechtsprüfung vom 22.09.2026).
		 *
		 * **Die Regel bleibt trotzdem erfassbar und die Fundstelle sichtbar**,
		 * und genau das ist die Aussage: Die Gemeinschaft darf in ihr Reglement
		 * schreiben, was sie will; die Anwendung sagt ihr, dass sie es nicht
		 * ungeprüft anwendet. Dass eine Regel sehr wohl greift, prüfen die
		 * Schritte zu `organe` und `jahresgeschaefte` weiter unten — dort ist
		 * das Gesetz dispositiv geblieben.
		 */
		await gehe(`/quorum?g=${gemeinschaft}&ast=a-bauen&p=${NUETZLICH}`);
		const text = await seitentext();
		behaupte(
			/Reglementsmehr/.test(text),
			`Die Regel wurde seit der Fassung 2026-10-15 nicht angewandt: ${text.slice(0, 300)}`
		);
		behaupte(/Ziff\. 12\.3/.test(text), 'Die Fundstelle fehlt auf der Karte');
		behaupte(
			/alle Eigentümer ihr zugestimmt haben/.test(text) &&
				/kann dieses Werkzeug nicht prüfen/.test(text),
			`Die Karte nennt die Bedingung der Regel nicht: ${text.slice(0, 400)}`
		);
		return 'Regel angewandt, Bedingung genannt';
	});

	await schritt('Bei luxuriösen Massnahmen bleibt es bei der Einstimmigkeit', async () => {
		await gehe(`/quorum?g=${gemeinschaft}&ast=a-bauen&p=${LUXURIOES}`);
		const text = await seitentext();
		behaupte(
			/Einstimmigkeit/.test(text),
			`Die Einstimmigkeit wurde ersetzt: ${text.slice(0, 300)}`
		);
		behaupte(
			!/Reglementsmehr/.test(text),
			`Die Karte trägt trotzdem «Reglementsmehr»: ${text.slice(0, 300)}`
		);
		return 'Einstimmigkeit steht';
	});

	await schritt('Und die Regel verschwindet nicht, sie steht daneben', async () => {
		// Seit der Fassung 2026-08-15 nennt der Vorbehalt den Rechtsgrund des
		// Knotens: 648er-Einstimmigkeit ist per einstimmiger Vereinbarung
		// abänderbar — der Satz behauptet keine zwingende Rechtslage mehr
		// (Befund B-10 der Inhaltsprüfung).
		const text = await seitentext();
		behaupte(/Ziff\. 12\.9/.test(text), 'Die hinterlegte Regel wird gar nicht erwähnt');
		// Seit der Fassung 2026-10-15 mit dem Rechtssatz der Karte statt des
		// Satzes, der einen Weg nach der Regel versprach (Fach- und Codeprüfung
		// 07.10.2026).
		behaupte(
			/Strenger als die Zustimmung aller geht nicht/.test(text),
			`Der Rechtssatz fehlt: ${text.slice(0, 400)}`
		);
		behaupte(
			/Ausgezählt wird nach dem Gesetz/.test(text),
			'Es steht nicht da, dass nach dem Gesetz gezählt wird'
		);
		behaupte(!/ziehen Sie dafür/.test(text), 'Die Karte verspricht einen Weg, den es nicht gibt');
		return 'genannt, Rechtssatz, nach dem Gesetz gezählt';
	});

	await schritt('Die Abberufung bleibt vor jeder Organe-Regel geschützt', async () => {
		// Befund B-7: SVIT ad 712r Rz. 23 — das einfache Mehr der Abberufung darf
		// weder erschwert noch erleichtert werden. Die naheliegende Regel
		// «Bestellung mit Zweidrittelmehr» darf die Abberufung nicht mitreissen.
		await hinterlege('organe', 'Reglement Ziff. 8.1');
		await gehe(`/quorum?g=${gemeinschaft}&ast=a-organe&p=f2-1-abberufen`);
		const text = await seitentext();
		behaupte(/Einfaches Mehr/.test(text), 'Das einfache Mehr der Abberufung wurde ersetzt');
		// Seit der Fassung 2026-10-15 mit dem Rechtssatz des Knotens statt
		// «zwingendes Recht» (Fachprüfung 07.10.2026).
		behaupte(/Rz\. 64 ad Art\. 712g/.test(text), `Der Rechtssatz fehlt: ${text.slice(0, 300)}`);

		await gehe(`/quorum?g=${gemeinschaft}&ast=a-organe&p=f2-1-waehlen,f2-1-kompetenzen-nein`); // seit Fassung 2026-10-24 mit Frage nach den Kompetenzen
		behaupte(
			/Reglementsmehr/.test(await seitentext()),
			'Bei der Wahl wurde die zulässige Regel nicht angewandt'
		);
		return 'Abberufung gesperrt, Wahl übersteuert';
	});

	await schritt('Die Auswahl sagt, wo eine Regel nicht durchgreift', async () => {
		// Wer die Regel erfasst, soll wissen, was sie bewirkt — nicht erst der,
		// der im Saal davorsteht.
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		await seite.locator('select[name="geschaeftsart"]').selectOption('baulich_luxurioes');
		await seite.waitForTimeout(150);
		// Seit der Fassung 2026-10-15: gesperrt, weil umstritten; der Ausweg nur
		// mit milderer Regel (Codeprüfung Runde 2, M2).
		behaupte(
			/nicht angewandt, weil umstritten/.test(await seitentext()),
			'Bei luxuriösen Massnahmen fehlt der Satz zur Reichweite'
		);

		/*
		 * **An der Nutzungsänderung die Wahl des Falls** (Fassung 2026-10-15,
		 * Codeprüfung 07.10.2026, H3). Benutzungsweise und Zweckbestimmung teilen
		 * die Art; ohne die Wahl liess sich eine Regel nur für die ganze Art
		 * hinterlegen, und an der Zweckbestimmung gilt nur eine fallgenaue.
		 */
		await seite.locator('select[name="geschaeftsart"]').selectOption('nutzungsaenderung');
		await seite.waitForTimeout(150);
		for (const fall of ['k-benutzungsweise', 'k-zweckbestimmung']) {
			behaupte(
				await seite.locator(`input[name="knotenId"][value="${fall}"]`).count(),
				`An der Nutzungsänderung fehlt der Fall «${fall}» zur Wahl`
			);
		}

		// Eine Regel für die ganze Art trägt in der Tabelle den Vermerk, dass sie
		// die Zweckbestimmung nicht erreicht (Laien- und Codeprüfung Runde 3).
		await hinterlege('nutzungsaenderung', 'Reglement Ziff. 19.1');
		const zeile = seite.locator('#abweichungstabelle tbody tr', { hasText: 'Ziff. 19.1' });
		behaupte(
			/nicht «Zweckbestimmung der Liegenschaft ändern»/.test(await zeile.innerText()),
			`Der Zeile zur Nutzungsänderung fehlt der Vermerk: ${await zeile.innerText()}`
		);

		await seite.locator('select[name="geschaeftsart"]').selectOption('grundordnung');
		await seite.waitForTimeout(150);
		behaupte(
			/nirgends angewandt/.test(await seitentext()),
			'Bei der Grundordnung fehlt der Satz, dass eine Regel zurzeit nirgends greift'
		);

		await seite.locator('select[name="geschaeftsart"]').selectOption('rueckkommen');
		await seite.waitForTimeout(150);
		const text = await seitentext();
		behaupte(
			/nicht hinter dem Erfordernis des Beschlusses zurückbleibt/.test(text),
			`Beim Rückkommen fehlt der Satz zur Reichweite: ${text.slice(0, 300)}`
		);
		behaupte(/abgelehnt/.test(text), 'Der Fall «abgelehnt» wird nicht genannt');
		return 'beide Sätze stehen';
	});

	await schritt('Ohne übergeordnete Gemeinschaft steht dort ein Satz', async () => {
		/*
		 * **Die Gegenprobe zum Verbundschritt im internen Verbund-Drehbuch** (03.09.2026).
		 * Diese Gemeinschaft steht frei; das Formular für die eine Stimme gehört
		 * hier nicht hin (Auftraggeber, Punkt 2 der sechs zur Reglementsseite: «Felder,
		 * die nicht zur Wahl gehören, verschwinden»). Gemessen an jenem Tag:
		 * 1014 der 1190 Gemeinschaften sind frei stehend.
		 *
		 * **Der Satz muss bleiben**, sonst findet die Einstellung niemand mehr,
		 * der sie sucht — und der Abschnitt trägt weiterhin seine Überschrift.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const text = await seitentext();
		behaupte(
			/Die eine Stimme in der übergeordneten Gemeinschaft/.test(text),
			'Der Abschnitt ist ganz verschwunden — dann findet ihn niemand mehr'
		);
		behaupte(
			await seite.locator('p.ohne-mitgliedschaft').count(),
			'Der Satz fehlt, der sagt, warum hier nichts einzustellen ist'
		);
		behaupte(
			(await seite.locator('form[action="?/weisungsregel"]').count()) === 0,
			'Das Formular steht da, obwohl diese Gemeinschaft zu keiner übergeordneten gehört'
		);
		return 'Satz statt Formular';
	});

	await schritt('Eine eigene Rückkommensregel lässt sich hinterlegen', async () => {
		// Der Nachsatz der PRD-Annahme 5 war bis zum 13.08.2026 nicht erfüllbar:
		// Die Geschäftsart gab es nicht.
		await hinterlege('rueckkommen', 'Reglement Ziff. 14.2');
		const text = await seitentext();
		behaupte(
			/Rückkommen auf einen Beschluss/.test(text) && /Ziff\. 14\.2/.test(text),
			`Regel nicht in der Liste: ${text.slice(0, 300)}`
		);
		return 'Ziff. 14.2';
	});

	await schritt('Eine neue Regel holt bestehende Traktanden nach', async () => {
		/*
		 * Befund B-01 aus Prüflauf II: Ein Erfordernis wird beim Anlegen eines
		 * Traktandums hergeleitet und in die Zeile geschrieben. Wer die Regel
		 * danach erfasst, ändert daran nichts — in derselben Traktandenliste
		 * standen zwei verschiedene Erfordernisse für denselben Fall, und die
		 * Liste ist die Einladung.
		 *
		 * Geprüft wird die ganze Kette: Traktandum vor der Regel, Regel danach,
		 * Kasten mit Gegenüberstellung, nachziehen, Kasten weg.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/versammlungen/neu`);
		const morgen = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
		await seite.fill('input[name="datum"]', morgen);
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('main button[type="submit"]').first());
		const versammlung = seite.url().split('/versammlungen/')[1].split(/[/?#]/)[0];
		behaupte(versammlung, `Versammlung nicht angelegt: ${seite.url()}`);

		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('summary, button').filter({ hasText: /Traktandum (aufnehmen|hinzufügen)/ })
			.first().click().catch(() => {});
		await seite.waitForTimeout(300);
		// Die Einzelversammlung fragt anders als der Abend: «Art» ist hier ein
		// Auswahlknopf, der Wortlaut ein mehrzeiliges Feld, der Knopf heisst
		// «Hinzufügen».
		await seite.locator('input[name="titel"]').first().fill('Gartenanteil neu zuteilen');
		await seite.locator('input[name="art"][value="abstimmung"]').first().check();
		await seite.locator('textarea[name="antragswortlaut"]').first()
			.fill('Der Gartenanteil wird neu zugeteilt.');
		/*
		 * **Ein Fall, für den noch KEINE Regel besteht, und an dem eine Regel
		 * überhaupt greifen kann.** Zwei Anläufe haben hier danebengegriffen:
		 *
		 * Der erste nahm die nützliche Massnahme — für die steht die Regel
		 * seit Schritt 3, das Traktandum bekam sie also gleich mit, und es gab
		 * nichts nachzuziehen.
		 *
		 * Der zweite nahm die **notwendige** Massnahme. Das ging bis zum
		 * 23.09.2026 gut; seit der Fassung 2026-09-23 ist sie nach Art. 712g
		 * Abs. 2 gesperrt (Befund B-02), eine Regel ändert das Erfordernis
		 * dort also nicht mehr — und ohne Änderung gibt es nichts
		 * nachzuziehen, der Kasten bliebe leer. Der Schritt wäre rot geworden,
		 * und zwar ohne dass etwas kaputt wäre.
		 *
		 * Gebraucht wird deshalb eine Geschäftsart, in der das Gesetz
		 * dispositiv geblieben ist. `nutzungsrechte` ist eine davon und wird
		 * sonst in diesem Durchstich nicht verwendet.
		 */
		await seite.locator('select[name="erfordernis"]').first()
			.selectOption({ label: 'Zuteilung ausschliesslicher Nutzungsrechte ändern · Qualifiziertes Mehr' });
		await abschicken(seite.locator('main button').filter({ hasText: /^Hinzufügen$/ }).first());

		// Erst jetzt die Regel für diesen Fall — das Traktandum steht schon.
		await hinterlege('nutzungsrechte', 'Reglement Ziff. 18.3');

		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const kasten = seite.locator('section.nachziehen');
		behaupte(await kasten.count() === 1, 'Der Kasten «älteres Erfordernis» fehlt');
		const zeilen = await kasten.locator('tbody tr').count();
		behaupte(zeilen === 1, `Erwartet 1 Zeile im Kasten, gefunden ${zeilen}`);
		const gegenueber = (await kasten.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Gartenanteil/.test(gegenueber) && /Ziff\. 18\.3/.test(gegenueber),
			`Die Gegenüberstellung nennt die Regel nicht: ${gegenueber}`
		);

		await kasten.locator('button').first().click();
		await seite.waitForTimeout(300);
		const ja = seite.locator('dialog[open] button.ja');
		if (await ja.count()) await ja.first().click();
		await seite.waitForTimeout(1800);

		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		behaupte(
			(await seite.locator('section.nachziehen').count()) === 0,
			'Nach dem Nachziehen steht der Kasten immer noch da'
		);
		return '1 Traktandum nachgezogen';
	});

	await schritt('Im Grenzfall steht, was das Setzen von Hand kostet', async () => {
		/*
		 * **Prüflauf I, B-19.** Im Grenzfall wird die hinterlegte Reglementsregel
		 * nicht angewandt — das sagte der Kasten schon. Die FOLGE stand nirgends:
		 * «Setze ich anschliessend ‹Qualifiziertes Mehr›, gilt § 12 Abs. 1 mit
		 * seiner Quotenschranke nicht mehr, und ich merke es nirgends»
		 * (ausprobiert und mit der Auszählmappe gegengelesen).
		 *
		 * Geprüft am Traktandum, nicht im Quorumfinder: Dort wird gesetzt, was
		 * für die Abstimmung gilt.
		 */
		const GRENZFALL = 'f1-0-nein,f1-1-nein,f1-2-unsicher';
		await gehe(`/quorum?g=${gemeinschaft}&ast=a-bauen&p=${GRENZFALL}`);
		const text = await seitentext();
		behaupte(/Grenzfall/i.test(text), `Kein Grenzfall auf diesem Pfad: ${text.slice(0, 300)}`);
		behaupte(
			/nicht angewandt/.test(text),
			'Der Kasten sagt nicht, dass die Regel hier nicht greift'
		);

		// Und jetzt die Folge, die bis zum 23.08.2026 nirgends stand.
		const abweichen = seite.getByText('Anderes Erfordernis setzen').first();
		if (await abweichen.count()) await abweichen.click();
		const nachher = await seitentext();
		behaupte(
			/Setzen Sie hier von Hand, gilt die Reglementsregel/.test(nachher),
			`Kein Hinweis über der Auswahl: ${nachher.slice(0, 400)}`
		);
		behaupte(
			/Ziff\. 12\.3/.test(nachher),
			'Der Hinweis nennt die Fundstelle nicht — «eine Regel» sagt niemandem, welche'
		);
		return 'Grenzfall erreicht, Folge benannt samt Fundstelle';
	});

	await schritt('Durch den Baum GEKLICKT bleibt der Vorschlag stehen', async () => {
		/*
		 * **Nachprüfung 23.08.2026**, Befund aus dem Code-Review: Der Baum
		 * besteht aus Verweisen auf dieselbe Route. SvelteKit tauscht dabei nur
		 * `data` aus und erzeugt die Seite NICHT neu — ein `$state(untrack(…))`
		 * bleibt deshalb auf dem Wert vom ersten Aufbau stehen, und beim
		 * Einstieg ohne `?ast=` gibt es da noch gar keinen Vorschlag.
		 *
		 * Alle bisherigen Schritte sprangen mit `goto()` direkt auf die
		 * Ergebnis-URL und trafen die Lücke nie. Dieser klickt.
		 */
		/*
		 * Einstieg am Ast, dann geklickt: Beim Aufbau der Seite steht dort eine
		 * FRAGE, also noch kein Erfordernis — genau die Ausgangslage, in der der
		 * Anfangswert eines `$state` ins Leere greift.
		 *
		 * Geklickt wird die jeweils letzte Antwort, nicht ein fester Wortlaut:
		 * Geprüft wird der Weg, nicht der Text des Regelwerks.
		 */
		await gehe(`/quorum?g=${gemeinschaft}&ast=a-bauen&p=f1-0-nein,f1-1-nein`);
		const antworten = seite.locator('ul.antworten a');
		behaupte(await antworten.count(), `Keine Frage auf ${seite.url()}`);
		/*
		 * Ein Klick, kein `goto`: Genau hier tauscht SvelteKit nur `data` aus.
		 *
		 * Gewartet wird auf das ZIEL, nicht auf ein Ladeereignis — bei einer
		 * Client-Navigation gibt es keines mehr, und `waitForLoadState` kehrt
		 * sofort zurück. Genau daran hat dieser Schritt zweimal vorbeigeprüft.
		 */
		await antworten.first().click();
		const abweichen = seite.getByText('Anderes Erfordernis setzen').first();
		await abweichen.waitFor({ state: 'visible', timeout: 10000 });
		await abweichen.click();

		const typ = seite.locator('select[name="typ"]').first();
		await typ.waitFor({ state: 'visible', timeout: 5000 });
		const gewaehlt = await typ.inputValue();
		/*
		 * Leer wäre der schlimmere Fall: Das Feld ist `required`, und ein Wert,
		 * den keine Option trägt, macht das Formular unabschickbar. Genau das
		 * passierte beim ersten Anlauf — der Vorschlag war ein Reglementsmehr,
		 * und das steht nicht zur Wahl.
		 */
		behaupte(gewaehlt !== '', 'Die Typauswahl ist leer — das Pflichtfeld lässt sich nicht abschicken');
		const optionen = await typ.locator('option').evaluateAll((o) => o.map((x) => x.value));
		behaupte(
			optionen.includes(gewaehlt),
			`Die Auswahl steht auf «${gewaehlt}», das keine Option ist: ${optionen.join(', ')}`
		);

		// Und die Bezugsgrösse beginnt leer — sonst schickt das Formular sie mit
		// und überschreibt die des Vorschlags.
		const kopf = seite.locator('select[name="kopfbasis"]').first();
		if (await kopf.count()) {
			behaupte(
				(await kopf.inputValue()) === '',
				`Die Bezugsgrösse ist vorbelegt («${await kopf.inputValue()}») und wird ungefragt mitgeschickt`
			);
		}
		return `Vorschlag steht auf «${gewaehlt}», Bezugsgrösse leer`;
	});

	/*
	 * **Der Änderungsweg** (03.09.2026, Punkt 3 der sechs zur Reglementsseite).
	 *
	 * Eine eigene Geschäftsart für diese Schritte, damit sie den Bestand nicht
	 * anrühren, den die Schritte davor prüfen: `verwaltung_gewoehnlich` und
	 * `jahresgeschaefte` kommen oben nicht vor.
	 */
	/*
	 * **Nur die Tabelle der Abweichungen** (03.09.2026, aus dem Code-Review).
	 * Die Seite fuehrt eine zweite Tabelle mit den Traktanden, deren Erfordernis
	 * aelter ist als die Regeln — und deren Zeilenzahl aendert sich, sobald eine
	 * Regel geaendert wird. Ein `tbody tr` ueber die ganze Seite zaehlt beide und
	 * kann grün bleiben, waehrend hier eine Zeile dazukommt und dort eine
	 * wegfaellt.
	 */
	const abweichungszeilen = () => seite.locator('#abweichungstabelle tbody tr');

	async function zeileMit(fundstelle) {
		return abweichungszeilen().filter({ hasText: fundstelle });
	}

	await schritt('Eine Abweichung anlegen, die danach geändert wird', async () => {
		await hinterlege('verwaltung_gewoehnlich', 'Reglement Ziff. 90.1');
		behaupte(/Ziff\. 90\.1/.test(await seitentext()), 'Regel nicht übernommen');
		return 'Ziff. 90.1';
	});

	await schritt('«Ändern» holt die bestehende Regel ins Formular', async () => {
		/*
		 * **Zuerst ins Formular tippen** (03.09.2026, aus der Defektprobe). Der
		 * erste Anlauf dieses Schritts klickte «Ändern» auf einer frisch geladenen
		 * Seite — und blieb grün, als das `{#key}` am Formular eingefroren wurde.
		 * Der Grund: `anfangswert()` setzt im Browser `defaultValue`, und dem
		 * folgt der sichtbare Wert von selbst, solange niemand das Feld angefasst
		 * hat. Bewacht war damit gar nichts.
		 *
		 * Sobald etwas darin steht, ist das Feld «dirty» und folgt seinem
		 * Vorgabewert nicht mehr. Genau das ist der Fall, für den es den
		 * Schlüsselwechsel gibt: Wer eine Fundstelle zu tippen anfängt und sich
		 * dann entscheidet, doch die bestehende Regel zu berichtigen, sähe sonst
		 * seine halbe Eingabe neben den Werten der Regel stehen — und schickte sie
		 * ab.
		 */
		await abweichungsformular().locator('input[name="fundstelle"]').fill('halb getippt');
		await abweichungsformular().locator('input[name="kopfNenner"]').fill('7');

		await (await zeileMit('Reglement Ziff. 90.1')).locator('button:has-text("Ändern")').click();
		await seite.locator('p.bearbeitungshinweis').waitFor({ timeout: 5000 });

		const titel = (await seite.locator('#abweichungstitel').innerText()).trim();
		behaupte(titel === 'Abweichung ändern', `Der Titel sagt «${titel}»`);

		const ziel = await abweichungsformular().getAttribute('action');
		behaupte(ziel === '?/aendern', `Das Formular schickt an «${ziel}»`);

		/*
		 * **Die Felder müssen die Werte der Regel tragen.** Genau das ist der
		 * Punkt: Ohne das `{#key}` am Formular stünden hier weiterhin die
		 * Vorgabewerte, und wer «Ändern» drückte, überschriebe seine Fundstelle
		 * mit «2/3, Reglement Ziff. ...» — schlimmer als der Umweg vorher.
		 */
		const fundstelle = await abweichungsformular()
			.locator('input[name="fundstelle"]')
			.inputValue();
		behaupte(
			fundstelle === 'Reglement Ziff. 90.1',
			`Die Fundstelle steht nicht im Feld, dort steht «${fundstelle}»`
		);
		const nenner = await abweichungsformular().locator('input[name="kopfNenner"]').inputValue();
		behaupte(nenner === '3', `Der Nenner der Regel steht nicht im Feld, dort steht «${nenner}»`);
		const art = await abweichungsformular().locator('select[name="geschaeftsart"]').inputValue();
		behaupte(art === 'verwaltung_gewoehnlich', `Die Geschäftsart steht auf «${art}»`);
		behaupte(
			(await abweichungsformular().locator('input[name="regelId"]').count()) === 1,
			'Die Kennung der Regel reist nicht mit'
		);
		/*
		 * **Der Satz ueber der Geschaeftsart muss die Wahrheit sagen.** Im
		 * Anlegemodus ersetzt eine zweite Regel fuer dasselbe die erste, und so
		 * steht es dort. Beim Aendern weist der Weg genau das ab — stuende der
		 * Satz weiter da, nannte die Seite einen Ausweg, den es nicht gibt.
		 * Geprueft werden beide Richtungen (die andere im Abbrechen-Schritt),
		 * damit kein Umformulieren die Probe zahnlos gruen macht.
		 */
		const satz = await abweichungsformular().innerText();
		behaupte(
			/wird die Änderung abgewiesen/.test(satz),
			'Der Satz sagt nicht, dass ein belegter Fall abgewiesen wird'
		);
		behaupte(
			!/ersetzt die erste/.test(satz),
			'Der Satz behauptet beim Ändern weiterhin, eine zweite Regel ersetze die erste'
		);
		return `Fundstelle und Art vorbelegt, Ziel ${ziel}`;
	});

	await schritt('Die Änderung ersetzt die Regel, statt eine zweite anzulegen', async () => {
		const vorher = await abweichungszeilen().count();
		await abweichungsformular()
			.locator('input[name="fundstelle"]')
			.fill('Reglement Ziff. 90.2');
		await abweichungsformular().locator('input[name="kopfNenner"]').fill('4');
		await abschicken(abweichungsformular().locator('button[type="submit"]'));
		await seite.locator('main', { hasText: 'Reglement Ziff. 90.2' }).first().waitFor({
			timeout: 10_000
		});

		const text = await seitentext();
		behaupte(/Ziff\. 90\.2/.test(text), 'Die Änderung steht nicht in der Tabelle');
		behaupte(!/Ziff\. 90\.1/.test(text), 'Die alte Fundstelle steht noch da');
		const nachher = await abweichungszeilen().count();
		behaupte(
			nachher === vorher,
			`Aus ${vorher} Zeilen wurden ${nachher} — geändert wurde nicht, es kam eine dazu`
		);
		// Und das Formular ist wieder eines zum Anlegen.
		const titel = (await seite.locator('#abweichungstitel').innerText()).trim();
		behaupte(titel === 'Abweichung hinterlegen', `Der Titel sagt danach «${titel}»`);
		return `${nachher} Zeilen, 2/4 statt 2/3`;
	});

	await schritt('«Abbrechen» verlässt die Bearbeitung', async () => {
		await (await zeileMit('Reglement Ziff. 90.2')).locator('button:has-text("Ändern")').click();
		await seite.locator('p.bearbeitungshinweis').waitFor({ timeout: 5000 });
		await abweichungsformular().locator('button:has-text("Abbrechen")').click();
		await seite.locator('p.bearbeitungshinweis').waitFor({ state: 'detached', timeout: 5000 });

		const ziel = await abweichungsformular().getAttribute('action');
		behaupte(ziel === '?/hinterlegen', `Das Formular schickt weiterhin an «${ziel}»`);
		behaupte(
			(await abweichungsformular().locator('input[name="regelId"]').count()) === 0,
			'Die Kennung der Regel reist noch mit'
		);
		// Die andere Richtung des Satzes: Beim Anlegen ersetzt eine zweite Regel
		// die erste, und das steht dort auch.
		const satz = await abweichungsformular().innerText();
		behaupte(
			/ersetzt die erste/.test(satz),
			'Beim Anlegen fehlt der Satz, dass eine zweite Regel die erste ersetzt'
		);
		return 'zurück auf Anlegen, Satz wieder der des Anlegens';
	});

	await schritt('Die Fallbeschränkung überlebt das Ändern', async () => {
		/*
		 * **Der Befund dahinter** (03.09.2026, aus dem Code-Review): Beim Ändern
		 * fiel die Beschränkung auf einen einzelnen Fall stillschweigend weg, und
		 * aus «nur für die Décharge» wurde «für alle vier Jahresgeschäfte» — mit
		 * einem Verlaufseintrag, der das als gewollte Änderung festhielt. Geprüft
		 * wird deshalb nicht nur, dass gespeichert wurde, sondern dass in der
		 * Zeile weiterhin der eine Fall steht.
		 */
		/*
		 * **`k-jahresrechnung` statt `k-prozessfuehrung`** (23.09.2026). Die
		 * Fallbeschränkung lässt sich nur auf Knoten setzen, an denen eine
		 * Regel überhaupt etwas ändert; die Auswahl auf der Reglementsseite
		 * filtert gesperrte heraus. `k-prozessfuehrung` gehört zwar zur
		 * Geschäftsart «Jahresgeschäfte» und war am 23.09.2026 kurzzeitig
		 * gesperrt (Befund B-02), weshalb es den Radioknopf dafür nicht gab.
		 * Gemessen, nicht vermutet: Dieser Schritt lief auf einen Zeitablauf
		 * beim Anklicken.
		 *
		 * **Die Sperre ist noch am selben Tag zurückgenommen worden**
		 * (Fachprüfung F-11: Die Karte steht auf Art. 712t Abs. 2, nicht auf
		 * Art. 647b Abs. 1). Den Radioknopf gibt es also wieder. Der Schritt
		 * bleibt trotzdem auf `k-jahresrechnung`, weil er die Fallbeschränkung
		 * prüft und nicht die Auswahl; wer ihn zurückdreht, misst dasselbe an
		 * einer Karte, deren Einordnung noch in Bewegung ist.
		 */
		await hinterlege('jahresgeschaefte', 'Reglement Ziff. 92.1', 'k-jahresrechnung');
		const zeile = await zeileMit('Reglement Ziff. 92.1');
		behaupte(
			/nur «/.test(await zeile.innerText()),
			'Die Beschränkung steht nicht in der Zeile, schon vor dem Ändern'
		);

		await zeile.locator('button:has-text("Ändern")').click();
		await seite.locator('p.bearbeitungshinweis').waitFor({ timeout: 5000 });
		const gewaehlt = await abweichungsformular()
			.locator('input[name="knotenId"]:checked')
			.getAttribute('value');
		behaupte(
			gewaehlt === 'k-jahresrechnung',
			`Im Formular steht der Fall «${gewaehlt}» statt «k-jahresrechnung»`
		);

		await abweichungsformular().locator('input[name="fundstelle"]').fill('Reglement Ziff. 92.2');
		await abschicken(abweichungsformular().locator('button[type="submit"]'));
		await seite.locator('main', { hasText: 'Reglement Ziff. 92.2' }).first().waitFor({
			timeout: 10_000
		});

		const danach = await (await zeileMit('Reglement Ziff. 92.2')).innerText();
		behaupte(
			/nur «/.test(danach),
			`Die Beschränkung ist weg, die Regel trifft jetzt die ganze Art: ${danach.replace(/\s+/g, ' ')}`
		);
		return 'Fall steht vorher und nachher';
	});

	await schritt('Ein belegter Fall wird nicht stillschweigend verdrängt', async () => {
		await hinterlege('jahresgeschaefte', 'Reglement Ziff. 91.1', 'k-jahresrechnung');
		await hinterlege('jahresgeschaefte', 'Reglement Ziff. 91.2', 'k-decharge');

		await (await zeileMit('Reglement Ziff. 91.1')).locator('button:has-text("Ändern")').click();
		await seite.locator('p.bearbeitungshinweis').waitFor({ timeout: 5000 });
		await abweichungsformular().locator('input[name="knotenId"][value="k-decharge"]').check();
		await abschicken(abweichungsformular().locator('button[type="submit"]'));
		await seite.locator('main', { hasText: 'schon eine andere Abweichung' }).first().waitFor({
			timeout: 10_000
		});

		/*
		 * **Die eigentliche Zusicherung steht in der Tabelle, nicht in der
		 * Meldung.** Ohne die Prüfung hätte das `ON CONFLICT` des Anlegewegs die
		 * Regel zur Décharge überschrieben, und die zur Jahresrechnung wäre
		 * daneben stehen geblieben — zwei Zeilen, eine davon still verfälscht.
		 */
		const text = await seitentext();
		behaupte(/Ziff\. 91\.1/.test(text), 'Die geänderte Regel ist verschwunden');
		behaupte(/Ziff\. 91\.2/.test(text), 'Die fremde Regel wurde überschrieben');
		return 'beide stehen unverändert';
	});

	await schritt('Kein Querlauf am Telefon', async () => {
		const eng = await browser.newPage({ viewport: { width: 390, height: 844 } });
		warteNachNavigation(eng);
		await eng.goto(`${ZIEL}/anmelden`, { waitUntil: 'load' });
		await eng.fill('input[name="username"]', BENUTZER);
		await eng.fill('input[name="kennwort"]', KENNWORT);
		await Promise.all([
			eng.waitForURL((u) => !u.pathname.includes('/anmelden'), { timeout: 30000 }),
			eng.locator('main button[type="submit"]').click()
		]);
		await eng.goto(`${ZIEL}/quorum?g=${gemeinschaft}&ast=a-bauen&p=${LUXURIOES}`, {
			waitUntil: 'domcontentloaded'
		});
		await eng.waitForTimeout(400);
		const ueber = await eng.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		await eng.close();
		behaupte(ueber === 0, `Die Seite läuft ${ueber} px quer`);
		return '0 px';
	});

	console.log(`\n  Prüfbestand: Gemeinschaft ${gemeinschaft}`);
} finally {
	await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png` }).catch(() => {});
	await browser.close();
}

console.log('');
if (fehler.length > 0) {
	console.log(`${fehler.length} Befund${fehler.length === 1 ? '' : 'e'}:`);
	for (const f of fehler) console.log(`  · ${f}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün. Aufnahmen in ${AUFNAHMEN}`);
