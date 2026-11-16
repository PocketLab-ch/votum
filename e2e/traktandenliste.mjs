/**
 * Die Traktandenliste einer gemeinsamen Versammlung.
 *
 * **Was hier festgenagelt wird** (Auftraggeber, 11.08.2026):
 *
 *   1. **Eine Liste für alle.** Die Pflichttraktanden, die jede Gemeinschaft
 *      mitbringt, gehen in die gemeinsame Liste ein — nicht acht Punkte je Haus
 *      mit eigener Zählung. «Dieser Kreis muss sich schliessen.»
 *   2. Traktanden werden aufgenommen wie bei einer einzelnen Sitzung — Titel,
 *      Art, Antragswortlaut, fertig. Ein neues hängt **hinten** an.
 *   3. **Nicht die Zahl der Häuser gliedert, sondern die Abweichung.** Lautet ein
 *      Punkt überall gleich, ist er ein Punkt. Sobald ein Haus einen eigenen
 *      Wortlaut trägt, entsteht «9 Budget» mit «9.1» und «9.2»; über den
 *      Sammelpunkt wird nicht abgestimmt.
 *   4. Die Nummer ist die **Protokollnummer**: Sie steht ebenso in der
 *      Traktandenliste der einzelnen Versammlung.
 *   5. Auf Ebene Gemeinschaft ist die Liste ein **Abbild**: kein Aufnehmen, kein
 *      Umordnen, kein Entfernen — der Wortlaut dagegen schon.
 *   6. Verschieben ordnet die Liste um und zieht die Nummern nach.
 *   7. Fehlende **Mustertraktanden** lassen sich am Abend nachtragen.
 *
 * Aufruf: `node e2e/traktandenliste.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-traktandenliste';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
const TAG = new Date(Date.UTC(2033, 0, 1) + (Date.now() % 700) * 86400000)
	.toISOString()
	.slice(0, 10);

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
// Hoch genug, dass beim Ziehen Quelle **und** Ziel gleichzeitig im Sichtfeld
// liegen: Gemessen lag das Ziel bei 1000 px Fensterhöhe auf y = −518, und die
// Zeigerbewegung ging ins Leere.
const seite = await browser.newPage({ viewport: { width: 1440, height: 1900 } });
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);
/*
 * **Rückfragen beantworten** (07.09.2026). Seit «Von der Liste nehmen» am Abend
 * nachfragt, öffnet der Klick nur noch ein Fenster; abgeschickt wird darin. Ein
 * Drehbuch ohne diesen Beobachter wartet auf eine Antwort, die nie kommt.
 */
await rueckfragenBestaetigen(seite);

async function abschicken(knopf) {
	const [antwort] = await Promise.all([
		seite
			.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 })
			.catch(() => null),
		knopf.click()
	]);
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(250);
	return antwort;
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	// Der Hydration Zeit lassen, siehe docs/gestaltung.md (Hydrationsfenster).
	await seite.waitForTimeout(250);
}

/** Die Liste als «Nummer Titel» je Zeile. */
const liste = async () =>
	seite.locator('ol.liste > li').evaluateAll((zeilen) =>
		zeilen.map((z) => {
			const nr = z.querySelector('.nr')?.textContent?.trim() ?? '';
			const titel = z.querySelector('.titel')?.textContent?.trim() ?? '';
			return `${nr} ${titel}`;
		})
	);

/** Das Anlegeformular steht hinter «Traktandum hinzufügen» — wie bei einer einzelnen. */
async function oeffneNeu() {
	if ((await seite.locator('form#neu').count()) === 0) {
		await seite.locator('button', { hasText: 'Traktandum hinzufügen' }).first().click();
		await seite.waitForTimeout(250);
	}
}

const meldung = async () =>
	(await seite.locator('.meldung').first().innerText().catch(() => ''))
		.replace(/\s+/g, ' ')
		.trim();

try {
	let tag;

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

	/*
	 * **Eigene Häuser statt geliehener.**
	 *
	 * `k.nth(i)` nahm, was gerade im Bestand stand. Das geht auf zwei Arten
	 * schief, und beide sind am 27.08.2026 eingetreten: Steht dort nichts, gibt
	 * es nichts anzukreuzen; steht dort viel, ist eines der vorderen Kästchen
	 * gesperrt und `check()` läuft dreissig Sekunden ins Leere. Gesperrt wird
	 * eine übergeordnete Gemeinschaft: Sie hat keine Einheiten, also niemanden,
	 * der dort tagen könnte (`versammlungen/neu/+page.svelte`, `disabled={g.klammer}`).
	 *
	 * Ein Drehbuch, dessen Voraussetzung jemand anderes herstellen muss, ist
	 * nicht prüfbar. Es legt seine Häuser jetzt selbst an.
	 */
	async function legeHaeuserAn(wieViele, praefix) {
		const ids = [];
		for (let n = 1; n <= wieViele; n += 1) {
			await gehe('/gemeinschaften/neu');
			await seite.fill('input[name="name"]', `${praefix} ${n} Prüflauf ${LAUF}`);
			await seite.fill('input[name="quotaDenominator"]', '1000');
			await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
			await abschicken(seite.locator('main button[type="submit"]').first());
			const id = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
			// **`id !== 'neu'` ist der eigentliche Prüfstein.** Bleibt das Formular
			// stehen, ist die Adresse weiter `/gemeinschaften/neu` und die Kennung
			// die Zeichenkette «neu» — wahr, und die Zusicherung schliefe durch.
			behaupte(
				id && id !== 'neu',
				`Haus ${n} nicht angelegt, Adresse steht auf ${seite.url()}`
			);
			ids.push(id);
		}
		return ids;
	}

	/** Kreuzt genau die eigenen Häuser an — und meldet eine Sperre als Befund. */
	async function kreuzeAn(ids) {
		for (const id of ids) {
			const kaestchen = seite.locator(`input[name="gemeinschaft"][value="${id}"]`);
			behaupte(await kaestchen.count(), `Eigenes Haus ${id} steht nicht zur Wahl`);
			behaupte(await kaestchen.isEnabled(), `Eigenes Haus ${id} ist gesperrt — gilt es als übergeordnete Gemeinschaft?`);
			await kaestchen.check();
		}
	}

	await schritt('Eine gemeinsame Versammlung mit drei Gemeinschaften anlegen', async () => {
		const eigene = await legeHaeuserAn(3, 'Traktandenhaus');
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.fill('input[name="bezeichnung"]', `Traktanden Prüflauf ${LAUF}`);
		await seite.fill('input[name="datum"]', TAG);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `Saal Prüflauf ${LAUF}`);
		await kreuzeAn(eigene);
		await abschicken(seite.locator('button[form="anlegen"]'));
		behaupte(seite.url().includes('/tage/'), `Nicht angelegt: ${seite.url()}`);
		tag = seite.url().split('/tage/')[1].split(/[/?#]/)[0];
		return '3 Gemeinschaften';
	});

	await schritt('Die mitgebrachten Pflichttraktanden stehen als EINE Liste da', async () => {
		// Der Befund vom 11.08.2026: Drei Gemeinschaften brachten je acht
		// Pflichttraktanden mit, und die gemeinsame Liste zeigte keines davon —
		// jedes Haus zählte für sich, das gemeinsame Geschäft hiess «1.1».
		await gehe(`/tage/${tag}/geschaefte`);
		// Dasselbe Wort wie bei einer einzelnen Versammlung (Auftraggeber, 11.08.2026:
		// «Auch das Wording ist nicht einheitlich»).
		behaupte(
			(await seite.locator('h1').innerText()).trim() === 'Traktandenliste',
			`Die Überschrift heisst «${await seite.locator('h1').innerText()}»`
		);
		const l = await liste();
		// Acht Punkte sichtbar: Die je drei Ziffern stehen zugeklappt darunter.
		behaupte(l.length === 8, `${l.length} Zeilen statt 8: ${l.join(' | ')}`);
		behaupte(l[0].startsWith('1 Begrüssung'), `Beginnt nicht mit der Begrüssung: «${l[0]}»`);
		/*
		 * **Die Reihenfolge der Jahresgeschäfte, nicht der letzte Titel**
		 * (01.09.2026). Hier stand «endet mit der Décharge» — richtig, solange
		 * die Décharge zufällig der letzte Punkt war, und rot in dem Augenblick,
		 * in dem der Auftraggeber die Reihenfolge auf die Logik des Abends stellte.
		 *
		 * Geprüft wird jetzt, worauf es ankommt: Die Revisionsstelle berichtet
		 * ÜBER die Rechnung, also muss ihr Bericht vor der Genehmigung stehen;
		 * und die Décharge entlastet für ein Jahr, dessen Rechnung eben
		 * genehmigt wurde, steht also dahinter.
		 */
		const stelle = (anfang) => l.findIndex((z) => z.replace(/^\d+\s+/, '').startsWith(anfang));
		const revision = stelle('Bericht der Revisionsstelle');
		const rechnung = stelle('Jahresrechnung');
		const decharge = stelle('Décharge');
		behaupte(
			revision >= 0 && rechnung >= 0 && decharge >= 0,
			`Nicht alle drei Jahresgeschäfte in der Liste: ${l.join(' | ')}`
		);
		behaupte(
			revision < rechnung,
			`Die Jahresrechnung steht vor dem Revisionsbericht: ${l.join(' | ')}`
		);
		behaupte(
			rechnung < decharge,
			`Die Décharge steht vor der Genehmigung der Jahresrechnung: ${l.join(' | ')}`
		);
		// Und die Nummern laufen durch, ohne Loch.
		behaupte(
			l.every((z, i) => z.startsWith(`${i + 1} `)),
			`Die Nummern laufen nicht von 1 bis ${l.length}: ${l.join(' | ')}`
		);
		const erste = (await seite.locator('ol.liste > li').first().innerText()).replace(/\s+/g, ' ');
		// Ab zwei Gemeinschaften je eine Ziffer — die Ordnung verlangt es, die
		// Anzeige hält sie zugeklappt.
		behaupte(
			/3 Gemeinschaften, je eine Ziffer/.test(erste),
			`Kein Hinweis auf die drei Ziffern: «${erste}»`
		);
		behaupte(/ohne Beschluss/.test(erste), `Keine Marke «ohne Beschluss»: «${erste}»`);
		const leiste = await seite.locator('nav li', { hasText: 'Traktanden' }).count();
		behaupte(leiste > 0, 'In der Ablaufleiste fehlt der Schritt «Traktanden»');
		return l.length + ' Punkte, keine Doppelzählung';
	});

	await schritt('Ein neues Traktandum für alle drei hängt hinten an — als EIN Punkt', async () => {
		await oeffneNeu();
		await seite.fill('input[name="titel"]', 'Budget 2027');
		await seite.fill('input[name="antragswortlaut"]', 'Das Budget 2027 sei zu genehmigen.');
		await abschicken(seite.locator('button[form="neu"]'));

		const l = await liste();
		behaupte(l.length === 9, `${l.length} Zeilen statt 9: ${l.join(' | ')}`);
		// Genau der Screenshot vom 11.08.2026: Dort stand «1.1» unter einer Liste,
		// die bei 8 endete.
		behaupte(l[8] === '9 Budget 2027', `Nicht als «9 Budget 2027» angehängt: «${l[8]}»`);
		return l[8];
	});

	await schritt('Ein Traktandum für nur eine Gemeinschaft steht mit einer Ziffer da', async () => {
		await oeffneNeu();
		await seite.fill('input[name="titel"]', 'Rampe beim Hintereingang');
		await seite.fill('input[name="antragswortlaut"]', 'Der Bau der Rampe sei zu genehmigen.');
		const k = seite.locator('fieldset.haeuser input[type="checkbox"]');
		for (let i = 1; i < (await k.count()); i += 1) await k.nth(i).uncheck();
		await abschicken(seite.locator('button[form="neu"]'));

		const l = await liste();
		const rampe = l.filter((z) => z.includes('Rampe'));
		behaupte(rampe.length === 1, `${rampe.length} Zeilen für die Rampe: ${rampe.join(' | ')}`);
		behaupte(rampe[0].startsWith('10 '), `Falsche Nummer: «${rampe[0]}»`);
		return rampe[0];
	});

	await schritt('Die Nummer steht auch in der Traktandenliste der Gemeinschaft', async () => {
		// Das ist der Punkt: «Die Traktandennummer widergibt die Nummer im
		// Protokoll.» Ohne diesen Schritt zählte jedes Haus für sich.
		// Der Weg in ein einzelnes Haus steht im Aufklapper «Ändern» — ein
		// einheitlicher Punkt gehört keiner Gemeinschaft allein.
		await seite
			.locator('ol.liste > li')
			.filter({ hasText: 'Budget 2027' })
			.first()
			.locator('button.aendern')
			.click();
		await seite.waitForTimeout(300);
		const weg = await seite.locator('.steht-in a').first().getAttribute('href');
		behaupte(weg, 'Kein Weg in die einzelne Gemeinschaft');
		await gehe(weg);
		const text = (await seite.locator('body').innerText()).replace(/\s+/g, ' ');
		behaupte(/9\.\d\s+Budget 2027/.test(text), 'Die Ziffer 9.n steht dort nicht');
		behaupte(/1\.\d\s+Begrüssung/.test(text), 'Die Begrüssung trägt nicht die 1.n');
		return 'Ziffern 1.n bis 9.n';
	});

	await schritt('Auf Ebene Gemeinschaft ist die Liste ein Abbild', async () => {
		// «Auf Ebene Gemeinschaft sollte es dann nur ein Abbild der
		// Sammelversammlung geben.» Kein Ziehgriff, kein Anlegeknopf, aber ein Weg
		// nach oben.
		const text = (await seite.locator('body').innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Die Traktandenliste wird dort geführt/.test(text),
			'Kein Hinweis auf die gemeinsame Versammlung'
		);
		behaupte(
			(await seite.locator('.griff').count()) === 0,
			'Der Ziehgriff steht noch da, obwohl hier nicht umgeordnet wird'
		);
		behaupte(
			(await seite.locator('button', { hasText: 'Traktandum hinzufügen' }).count()) === 0,
			'Der Knopf zum Anlegen steht noch da'
		);
		behaupte(
			(await seite.locator(`a[href="/tage/${tag}/geschaefte"]`).count()) > 0,
			'Kein Weg zur gemeinsamen Versammlung'
		);
		return 'Hinweis, kein Griff, kein Anlegeknopf';
	});

	await schritt('Der Inhalt lässt sich je Gemeinschaft anpassen', async () => {
		// Erst in der einzelnen Versammlung ändern, dann muss die gemeinsame
		// Liste es als «angepasst» zeigen. Der Aufklapper trägt den Titel des
		// Traktandums als Knopf; darunter erscheint das Formular mit `?/speichern`.
		const zeile = seite.locator('li[data-traktandum]').filter({ hasText: 'Budget 2027' }).first();
		// **Der Titel klappt auf, nicht der Griff.** `button` allein trifft den
		// Ziehgriff «⠿», der davorsteht.
		/*
		 * **Vor dem Klick muss man sehen, dass es ein Knopf ist**
		 * (Bedienbarkeitsprüfung 05.09.2026, Befund 11): «Der Traktandentitel ist
		 * ein Knopf, sieht aber aus wie fetter Text.» Verraten hat ihn nur
		 * `cursor: pointer`, und einen Mauszeiger gibt es auf dem Tablet der
		 * Sitzungsleitung nicht.
		 */
		/*
		 * Gemessen wird die **Drehung**, nicht das Zeichen: Die Anwendung nutzt
		 * für diese Geste überall dasselbe `▾` und dreht es im geschlossenen
		 * Zustand (`versammlungen/+page.svelte`, `.pfeil.zu`).
		 */
		const winkel = () =>
			zeile.locator('button.titel').evaluate((el) => ({
				zeichen: getComputedStyle(el, '::before').content.replace(/"/g, ''),
				drehung: getComputedStyle(el, '::before').transform
			}));
		const zu = await winkel();
		behaupte(
			zu.zeichen === '▾',
			`Der Titel trägt kein Aufklappzeichen: «${zu.zeichen}»`
		);
		behaupte(
			zu.drehung !== 'none' && zu.drehung !== 'matrix(1, 0, 0, 1, 0, 0)',
			`Das Zeichen ist im geschlossenen Zustand nicht gedreht: ${zu.drehung}`
		);
		behaupte(
			(await zeile.locator('button.titel').getAttribute('aria-expanded')) === 'false',
			'Der Titel sagt Bildschirmlesern nicht, dass er zugeklappt ist'
		);
		// Der Winkel darf **nicht** im Text stehen: Sonst trägt ihn alles mit,
		// was den Titel ausliest oder kopiert.
		behaupte(
			!(await zeile.locator('button.titel').innerText()).includes('▸'),
			'Das Aufklappzeichen steht im Titeltext statt in der Darstellung'
		);

		await zeile.locator('button.titel').click();
		await seite.waitForTimeout(400);

		const auf = await winkel();
		behaupte(
			auf.drehung === 'none' || auf.drehung === 'matrix(1, 0, 0, 1, 0, 0)',
			`Das Zeichen bleibt im offenen Zustand gedreht: ${auf.drehung}`
		);

		const formular = seite.locator('form[action="?/speichern"]').first();
		behaupte(await formular.count(), 'Kein Änderungsformular nach dem Aufklappen');
		await formular.locator('input[name="titel"]').fill('Budget 2027 mit Liftanteil');
		await abschicken(formular.locator('button[type="submit"]').first());

		await gehe(`/tage/${tag}/geschaefte`);
		const text = (await seite.locator('ol.liste').innerText()).replace(/\s+/g, ' ');
		behaupte(/angepasst/.test(text), `Keine Marke «angepasst»: «${text.slice(0, 200)}»`);

		// **Und jetzt gliedert es sich**: Ein Haus schert aus, also entsteht der
		// Sammelpunkt mit einer Ziffer je Gemeinschaft.
		// Der aufgespaltene Punkt steht von selbst offen — dort gibt es etwas zu
		// sehen, und genau darum wird nicht mehr zugeklappt.
		const l = await liste();
		behaupte(
			l.some((z) => z.startsWith('9.1 ')) && l.some((z) => z.startsWith('9.3 ')),
			`Die Ziffern 9.1 bis 9.3 stehen nicht offen: ${l.join(' | ')}`
		);
		return 'als «angepasst» erkannt, Ziffern von selbst offen';
	});

	await schritt('Verschieben ordnet die Liste um und zieht die Nummern nach', async () => {
		await gehe(`/tage/${tag}/geschaefte`);
		const vorher = await liste();
		behaupte(vorher.length >= 5, `Zu wenige Zeilen zum Verschieben: ${vorher.length}`);

		// Die Rampe (zuletzt) ganz nach vorn ziehen.
		const rampe = seite.locator('ol.liste > li').filter({ hasText: 'Rampe' }).first();
		const budget = seite.locator('ol.liste > li').first();
		// Ohne Scrollen liegt die Rampe unterhalb des Sichtfelds, und die
		// Zeigerbewegung geht ins Leere.
		await rampe.scrollIntoViewIfNeeded();
		await seite.waitForTimeout(150);
		const von = await rampe.locator('.griff').boundingBox();
		const nach = await budget.boundingBox();
		/*
		 * **Auf die Antwort warten, nicht auf eine Frist** (07.09.2026).
		 *
		 * Dieser Schritt war seit Tagen rot, und zwar ohne Fehler in der
		 * Anwendung: Der Schritt danach las in der Gemeinschaft «1 Rampe», also
		 * war die Verschiebung angekommen. Die beiden Formulare schicken über
		 * `use:enhance` (Kommentar in `geschaefte/+page.svelte`, 11.08.2026) —
		 * ohne Navigation. `waitForLoadState('domcontentloaded')` kehrt deshalb
		 * sofort zurück, das Dokument steht ja längst, und die feste Frist von
		 * 600 ms mass das Neuzeichnen statt das Ergebnis. Dieselbe Klasse wie in
		 * `durchspielen.mjs` am 03.09.2026.
		 */
		const [antwort] = await Promise.all([
			// **Die Antwort dieses Formulars, nicht irgendeine.** `method === 'POST'`
			// allein trifft auch `?/umordnen` der zweiten Ebene oder ein fremdes
			// Formular der Seite — dann gälte ein Ziehen auf die falsche Ebene als
			// abgeschickt (Code-Review 07.09.2026).
			seite
				.waitForResponse(
					(r) => r.request().method() === 'POST' && r.url().includes('?/verschieben'),
					{ timeout: 30000 }
				)
				.catch(() => null),
			(async () => {
				await seite.mouse.move(von.x + von.width / 2, von.y + von.height / 2);
				await seite.mouse.down();
				await seite.mouse.move(nach.x + 40, nach.y + nach.height / 2, { steps: 8 });
				await seite.mouse.up();
			})()
		]);
		behaupte(antwort, 'Das Ziehen hat gar nichts abgeschickt — die Verschiebung kam nie an');

		// Und dann warten, bis die Liste es zeigt, statt eine Frist zu raten.
		let nachher = [];
		for (let versuch = 0; versuch < 40; versuch += 1) {
			nachher = await liste();
			if (nachher[0]?.includes('Rampe')) break;
			await seite.waitForTimeout(250);
		}
		behaupte(
			nachher[0]?.includes('Rampe'),
			`Die Rampe steht nicht vorne: ${nachher.slice(0, 3).join(' | ') || '(leere Liste)'}`
		);

		/*
		 * **Und nach einem frischen Laden immer noch.** Sonst belegte der Schritt
		 * nur, dass die Seite es anzeigt — nicht, dass es gespeichert ist.
		 */
		await gehe(`/tage/${tag}/geschaefte`);
		nachher = await liste();
		behaupte(
			nachher[0]?.includes('Rampe'),
			`Nach dem Neuladen steht die Rampe nicht vorne: ${nachher.slice(0, 3).join(' | ') || '(leere Liste)'}`
		);
		behaupte(nachher[0]?.startsWith('1 '), `Nummer nicht nachgezogen: «${nachher[0]}»`);
		behaupte(
			nachher.some((z) => z.startsWith('10 Budget')),
			`Das Budget steht nicht auf 10: ${nachher.join(' | ')}`
		);
		return `${vorher[0]} → ${nachher[0]}`;
	});

	await schritt('Und die neue Nummer steht auch bei der Gemeinschaft', async () => {
		// Das erste Haus — dort läuft die Rampe.
		await seite
			.locator('ol.liste > li')
			.filter({ hasText: 'Rampe' })
			.first()
			.locator('button.aendern')
			.click();
		await seite.waitForTimeout(300);
		const mitRampe = await seite.locator('.steht-in a').first().getAttribute('href');
		behaupte(mitRampe, 'Kein Weg in die Gemeinschaft');
		await gehe(mitRampe);
		let text = (await seite.locator('body').innerText()).replace(/\s+/g, ' ');
		behaupte(/10\.\d\s+Budget/.test(text), 'Die nachgezogene Nummer fehlt in der Gemeinschaft');
		const erstes = (await seite.locator('[data-traktandum]').first().innerText()).replace(
			/\s+/g,
			' '
		);
		behaupte(/^1\s+Rampe/.test(erstes), `Die Reihenfolge ist nicht mitgezogen: «${erstes}»`);

		// **Die Lücke ist richtig.** Im letzten Haus läuft die Rampe nicht, also
		// beginnt die Liste dort bei 2 — wer bei einem Punkt nicht dabei ist, hat
		// ihn auch nicht im Protokoll.
		await gehe(`/tage/${tag}/geschaefte`);
		await seite
			.locator('ol.liste > li')
			.filter({ hasText: 'Budget 2027' })
			.first()
			.locator('button.aendern')
			.click();
		await seite.waitForTimeout(300);
		const ohneRampe = await seite.locator('.steht-in a').last().getAttribute('href');
		await gehe(ohneRampe);
		const dort = (await seite.locator('[data-traktandum]').first().innerText()).replace(
			/\s+/g,
			' '
		);
		behaupte(/^2\.\d\s+Begrüssung/.test(dort), `Ohne Rampe beginnt es nicht bei 2.n: «${dort}»`);
		text = (await seite.locator('body').innerText()).replace(/\s+/g, ' ');
		behaupte(!/Rampe/.test(text), 'Die Rampe steht in einem Haus, das sie nicht führt');
		return 'nachgezogen, Lücke im unbeteiligten Haus';
	});

	await schritt('Ein entferntes Mustertraktandum lässt sich am Abend nachtragen', async () => {
		await gehe(`/tage/${tag}/geschaefte`);
		// «Auch können dort die Mustertraktanden übernommen werden … bei der
		// Sammelversammlung.» Erst eine Lücke erzeugen, dann schliessen.
		const zeile = seite.locator('ol.liste > li').filter({ hasText: 'Erneuerungsfonds' }).first();
		await zeile.locator('button.aendern').click();
		await seite.waitForTimeout(300);
		/*
		 * **Vorher prüfen, dass gefragt wird** (07.09.2026, aus dem Code-Review zu
		 * `82c00cf`). Der Knopf nimmt den Punkt aus **allen** Gemeinschaften des
		 * Abends zugleich und stand bis dahin ohne Nachfrage neben drei
		 * harmlosen Speicherknöpfen.
		 *
		 * Gemessen wird das Fenster **vor** dem Absenden: Das Formular lädt die
		 * Seite neu, und `gestellteRueckfragen` läse danach die Merkliste der
		 * frischen Seite — also immer eine leere. Der Beobachter bestätigt, was
		 * da ist; ob überhaupt gefragt wurde, sieht nur diese Zeile.
		 */
		const frage = seite
			.locator('form[action="?/entfernen"] dialog.rueckfrage h2')
			.first();
		behaupte(await frage.count(), 'Das Entfernen fragt nicht nach');
		const wortlaut = (await frage.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Erneuerungsfonds/.test(wortlaut) && /Abend/.test(wortlaut),
			`Die Rückfrage nennt nicht, was sie wegnimmt: «${wortlaut}»`
		);

		await abschicken(seite.locator('form[action="?/entfernen"] button[type="submit"]').first());
		behaupte(
			!(await liste()).some((z) => z.includes('Erneuerungsfonds')),
			'Der Erneuerungsfonds steht noch auf der Liste'
		);

		await seite.locator('section.muster button', { hasText: 'Mustertraktanden ansehen' }).click();
		await seite.waitForTimeout(200);
		await abschicken(seite.locator('button[form="muster"]'));

		const l = await liste();
		const wieder = l.filter((z) => z.includes('Erneuerungsfonds'));
		behaupte(wieder.length === 1, `${wieder.length} Zeilen für den Erneuerungsfonds`);
		// Als ein Punkt für alle drei, nicht als Sammelpunkt.
		const text = (await seite
			.locator('ol.liste > li')
			.filter({ hasText: 'Erneuerungsfonds' })
			.first()
			.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/3 Gemeinschaften, je eine Ziffer/.test(text),
			`Nicht als Punkt über alle drei: «${text}»`
		);
		return wieder[0];
	});

	await seite.screenshot({ path: `${AUFNAHMEN}/liste.png` });
} finally {
	await browser.close();
}

if (fehler.length > 0) {
	console.log(`\n${fehler.length} Befunde:`);
	for (const f of fehler) console.log(`- ${f}`);
	process.exit(1);
}
console.log('\nAlles grün.');
