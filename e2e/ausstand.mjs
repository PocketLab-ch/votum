/**
 * Der Ausstand im Saal (PRD §13; ZGB Art. 68 i.V.m. Art. 712m Abs. 2).
 *
 * **Der Fall:** Der Hauswartauftrag geht an die Firma eines Eigentümers. Er
 * darf über sein eigenes Geschäft nicht mitentscheiden — und er **zählt dann
 * auch nicht mit**. Genau darin liegt der Unterschied zur Enthaltung, und genau
 * daran hängt das Ergebnis.
 *
 * Geprüft wird die Kette in der Oberfläche: erklären → sieht man → gezählt wird
 * ohne ihn → steht namentlich im Ergebnis. Der Zählkern selbst steht in
 * `tests/domain/auszaehlung.test.ts`, die Datenhaltung in
 * `tests/db/ausstand.test.ts`.
 *
 * Aufruf: `node e2e/ausstand.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { nachAbsendung, nachladeWarter } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-ausstand';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

/**
 * Wählt in einer Liste den Eintrag, der mit dem Text **beginnt**.
 *
 * **Seit dem 27.08.2026 nötig** (Auftraggeber: «Bei 2 Einheiten zuordnen braucht es
 * noch den Filter … und wenn Personen einer Einheit zugeordnet sind, sollte
 * diese das auch anzeigen»). Die Einträge tragen jetzt mehr als die
 * Bezeichnung: «Whg 1 · Anna Muster». Ein `selectOption({ label })` sucht
 * wörtlich und fände nichts mehr.
 */
async function waehleNachAnfang(auswahl, anfang) {
	const texte = await auswahl.locator('option').allTextContents();
	const i = texte.findIndex((t) => t.trim().startsWith(anfang));
	if (i < 0) throw new Error(`«${anfang}» fehlt in der Auswahl: ${texte.join(' | ')}`);
	await auswahl.selectOption({ index: i });
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
const seite = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

const rueckfragen = [];
seite.on('dialog', (d) => {
	rueckfragen.push(d.message().split('\n')[0]);
	d.accept();
});

/**
 * Ein Formular abschicken und warten, bis der neue Stand wirklich dasteht.
 *
 * **Warum das nicht mehr `domcontentloaded` allein sein kann** (28.08.2026):
 * Seit die Sitzungsleitungssicht über `$lib/absenden.ts` schickt, lädt sie
 * nicht mehr neu. `waitForLoadState('domcontentloaded')` kehrt dann sofort
 * zurück — der Zustand ist ja längst erreicht —, während `update()` sein
 * `invalidateAll()` noch gegen den Server fährt. Auf dieser Seite dauert das
 * länger als die 300 ms, die hier standen: Der Durchlauf las den Stand von
 * vorher und meldete «Es fehlen Stimmberechtigte», obwohl die Abstimmung eine
 * Sekunde später offen war.
 *
 * `nachladeWarter` wird **vor** dem Klick scharfgestellt, sonst ist der
 * Nachladelauf vorbei, bevor jemand auf ihn wartet.
 */
async function abschicken(knopf) {
	const nachladen = nachladeWarter(seite);
	const [antwort] = await Promise.all([
		seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 }).catch(() => null),
		knopf.click()
	]);
	await nachAbsendung(seite, antwort, nachladen, 300);
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

/**
 * Was auf der Seite steht — **samt der Quittung unten rechts**.
 *
 * **Warum das nötig ist** (24.08.2026). Seit dem 21.08. ziehen bestätigende
 * Meldungen in den `Einblender` um, und der steht neben `<main>`, nicht darin
 * («Einmal im Gerüst, damit sie über allen Seiten stehen»). Wer nur `main`
 * liest, sieht sie nicht — und meldet «Die Wirkung wird nicht genannt», während
 * sie gross im Bild steht. Der Ausstand selbst hat nie aufgehört zu wirken; nur
 * dieser Durchstich schaute an die falsche Stelle.
 */
const seitentext = async () => {
	const haupt = await seite.locator('main').innerText();
	const quittungen = await seite
		.locator('.einblender')
		.innerText()
		.catch(() => '');
	return `${haupt} ${quittungen}`.replace(/\s+/g, ' ');
};

/**
 * Die Erfassungstabelle aufklappen.
 *
 * **Warum das nötig ist** (24.08.2026). Seit «Dass der Sitzungsleiter für die
 * Eigentümer abstimmen darf, ist per Default auszublenden» liegt die Tabelle
 * hinter einem `<details>` — auch in der einfachen Betriebsart, wo sie der
 * Normalweg ist. Ein eingeklapptes Feld ist für Playwright unsichtbar, und
 * `check()` läuft in einen Zeitablauf statt in eine Aussage.
 *
 * Per `evaluate` statt mit einem Klick auf das `summary`: Die Seite lädt bei
 * jeder Änderung im Saal nach, und ein Klick trifft dann ins Leere. Nur die
 * Ausklapper der Sitzungsleitung — auf der Vollmachtsseite heisst ein Formular
 * genauso und steht frei.
 */
async function oeffneErfassung() {
	await seite.evaluate(() => {
		document
			.querySelectorAll('details:has(form[action="?/erfassen"])')
			.forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
}

try {
	let gemeinschaft;
	let versammlung;
	const NAME = `Prüflauf Ausstand ${LAUF}`;
	const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Duss'];

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

	await schritt('Vier Eigentümer zu je einem Viertel', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(gemeinschaft, `Nicht angelegt: ${seite.url()}`);

		for (const [i, wer] of LEUTE.entries()) {
			await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
			const ef = seite.locator('form[action$="anlegen"]').first();
			await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
			await ef.locator('input[name="quote.stamm"]').fill('250');
			await abschicken(ef.locator('button[type="submit"]'));

			await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
			const pf = seite.locator('form[action$="anlegen"]').first();
			await pf.locator('input[name="displayName"]').fill(wer);
			await abschicken(pf.locator('button[type="submit"]'));

			await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
			const zf = seite.locator('form[action$="zuordnen"]').last();
			await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
			await waehleNachAnfang(zf.locator('select[name="partyId"]'), wer);
			await abschicken(zf.locator('button[type="submit"]'));
		}
		return `${LEUTE.length} Eigentümer`;
	});

	await schritt('Das Reglement nimmt bei der Hausordnung die Betroffenen aus', async () => {
		/*
		 * **Der Aufbau für die Reglementsklausel** (Produktentscheid 27.09.2026).
		 * Dieselbe Kopfbasis wie bei der Ausschlussklage, aber aus dem Reglement:
		 * Wen sie ausnimmt, der stimmt nicht selbst, vertritt aber weiter. Die
		 * Hausordnung, weil eine Regel dort frei greift und die übrigen
		 * Traktanden dieses Drehbuchs nicht berührt.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const rahmen = seite.locator('form#abweichungsformular');
		await rahmen.locator('select[name="geschaeftsart"]').selectOption('hausordnung');
		await rahmen.locator('select[name="kopfArt"]').selectOption('mehr_als');
		await rahmen.locator('input[name="kopfZaehler"]').fill('1');
		await rahmen.locator('input[name="kopfNenner"]').fill('2');
		await rahmen.locator('select[name="kopfbasis"]').selectOption('alle_ausser_betroffene');
		await rahmen.locator('input[name="fundstelle"]').fill('Reglement Ziff. 9');
		await abschicken(rahmen.locator('button[type="submit"]'));
		await seite
			.locator('main', { hasText: 'Reglement Ziff. 9' })
			.first()
			.waitFor({ timeout: 10_000 })
			.catch(() => {});
		behaupte(
			/Ziff\. 9/.test(await seitentext()),
			`Regel nicht übernommen: ${(await seitentext()).slice(0, 300)}`
		);
		return 'Ziff. 9';
	});

	await schritt('Das Reglement lässt bei der Ausschlussklage die Anwesenden genügen', async () => {
		/*
		 * **Die Klausel, die der Umbau vom 29.09.2026 möglich macht**
		 * (Produktentscheid auf Rückfrage M-4, `quellen` `fragen.md` Frage 52).
		 * Seit der Fassung 2026-10-07 wendet Votum sie an, und sie ersetzt die
		 * Kopfbasis. Der Beklagte darf trotzdem weder in der Erfassung stehen
		 * noch zählen; bis zu diesem Tag hing sein Ausschluss allein an der
		 * Kopfbasis des Gesetzes. Der Weg nach Gesetz steht in den Kern- und
		 * Datenbanktests.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const rahmen = seite.locator('form#abweichungsformular');
		await rahmen.locator('select[name="geschaeftsart"]').selectOption('sonderfall');
		await rahmen.locator('select[name="kopfArt"]').selectOption('mehr_als');
		await rahmen.locator('input[name="kopfZaehler"]').fill('1');
		await rahmen.locator('input[name="kopfNenner"]').fill('2');
		await rahmen.locator('select[name="kopfbasis"]').selectOption('anwesend_vertreten');
		await rahmen.locator('input[name="fundstelle"]').fill('Reglement Ziff. 11');
		await abschicken(rahmen.locator('button[type="submit"]'));
		await seite
			.locator('main', { hasText: 'Reglement Ziff. 11' })
			.first()
			.waitFor({ timeout: 10_000 })
			.catch(() => {});
		behaupte(
			/Ziff\. 11/.test(await seitentext()),
			`Regel nicht übernommen: ${(await seitentext()).slice(0, 300)}`
		);
		return 'Ziff. 11';
	});

	await schritt('Versammlung anlegen, Traktandum, freigeben, eröffnen', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-06-10');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

		// Das Anlegeformular steht hinter «Traktandum hinzufügen» — die Seite
		// zeigt zuerst die Liste.
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const tf = seite.locator('form[action="?/anlegen"]').first();
		await tf.locator('input[name="titel"]').fill('Vergabe des Hauswartauftrags');
		await tf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Der Hauswartauftrag wird an die Firma Duss vergeben.');
		// Ohne Erfordernis lässt sich die Abstimmung später nicht öffnen — und das
		// ist richtig so: Ohne Schwelle liesse sich nicht sagen, wann angenommen ist.
		await tf.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(tf.locator('button[type="submit"]').first());
		behaupte(
			/Vergabe des Hauswartauftrags/.test(await seitentext()),
			`Traktandum nicht angelegt: ${(await seitentext()).slice(0, 250)}`
		);

		// Ein zweites Traktandum: An ihm wird gezeigt, dass der Ausstand je
		// Traktandum gilt — und was er mit einer Vollmacht macht. Traktanden
		// lassen sich nur im Entwurf anlegen, also gehört es hierhin.
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const bf = seite.locator('form[action="?/anlegen"]').first();
		await bf.locator('input[name="titel"]').fill('Budget 2028');
		await bf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await bf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Das Budget 2028 wird genehmigt.');
		await bf.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(bf.locator('button[type="submit"]').first());

		// Ein drittes: Hier greift die Reglementsklausel von oben.
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const wf = seite.locator('form[action="?/anlegen"]').first();
		await wf.locator('input[name="titel"]').fill('Werkstattordnung');
		await wf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await wf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Die Werkstatt im Keller ist werktags bis 20 Uhr offen.');
		await wf.locator('select[name="erfordernis"]').selectOption('k-hausordnung');
		await abschicken(wf.locator('button[type="submit"]').first());

		// Ein viertes: die Ausschlussklage, an der Ehegatte und Verwandte des
		// Beklagten nicht mitstimmen (Produktentscheid 27.09.2026).
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const kf = seite.locator('form[action="?/anlegen"]').first();
		await kf.locator('input[name="titel"]').fill('Ermächtigung zur Ausschlussklage');
		await kf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await kf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Die Verwaltung wird ermächtigt, gegen Duss auf Ausschluss zu klagen.');
		await kf.locator('select[name="erfordernis"]').selectOption('k-ausschlussklage');
		await abschicken(kf.locator('button[type="submit"]').first());

		/*
		 * **Ohne beklagte Partei keine Freigabe** (Produktentscheid 29.09.2026:
		 * «Ausschluss muss die ausgeschlossene Partei / Einheit benannt werden»).
		 * Erst die Sperre sehen, dann Duss im Entwurf eintragen. Bis dahin trug
		 * dieses Drehbuch ihn erst im Saal ein.
		 */
		await gehe(`/versammlungen/${versammlung}/freigabe`);
		behaupte(
			/als beklagt eingetragen/.test(await seitentext()),
			`Die Freigabe nennt die fehlende beklagte Partei nicht: ${(await seitentext()).slice(0, 400)}`
		);
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		const kz = seite
			.locator('li[data-traktandum]')
			.filter({ hasText: 'Ermächtigung zur Ausschlussklage' })
			.first();
		await kz.locator('button.titel').click();
		await seite.waitForTimeout(400);
		const kform = seite.locator('form[action="?/speichern"]').first();
		const feld = (await kform.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Beklagte Partei, sie stimmt nicht mit/.test(feld),
			`Das Feld heisst nicht «Beklagte Partei»: ${feld.slice(0, 300)}`
		);
		const duss = kform.locator('label', { hasText: 'Duss' }).locator('input[name="betroffene"]');
		behaupte(await duss.count(), 'Kein Kästchen für Duss unter «Beklagte Partei»');
		await duss.first().check();
		await abschicken(kform.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
		behaupte(await frei.count(), `Keine Freigabe: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(frei.first());

		await gehe(`/versammlungen/${versammlung}`);
		const auf = seite.locator('form[action="?/eroeffnen"] button[type="submit"]');
		behaupte(await auf.count(), `Kein Eröffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(auf.first());
		return versammlung.slice(0, 8);
	});

	await schritt('Bucher lässt sich durch Aebi vertreten', async () => {
		/*
		 * **Der Aufbau für die zweite Hälfte.** Bucher kommt nicht; Aebi übt ihre
		 * Stimme aus. Beim Hauswartauftrag spielt das keine Rolle — dort ist Duss
		 * im Ausstand. Beim Budget tritt Aebi in den Ausstand, und dann steht die
		 * Frage im Raum, die BGE 134 III 481 E. 3.8 beantwortet.
		 */
		await gehe(`/versammlungen/${versammlung}/vollmachten`);
		const form = seite.locator('form[action="?/erfassen"]');
		behaupte(await form.count(), `Kein Erfassungsformular: ${(await seitentext()).slice(0, 250)}`);
		await form.locator('input[name="art"][value="eigentuemer"]').check();
		await seite.waitForTimeout(150);
		await form.locator('select[name="bevollmaechtigt"]').selectOption({ label: 'Aebi' });

		// «Vollmacht für» ist eine Liste mit Kästchen; mehrere wären möglich.
		const bucher = form.locator('ul.liste li', { hasText: 'Bucher' }).first();
		behaupte(
			await bucher.count(),
			`Bucher steht nicht zur Auswahl: ${(await seitentext()).slice(0, 300)}`
		);
		await bucher.locator('input[type="checkbox"][name="vertritt"]').check();
		await abschicken(form.locator('button[type="submit"]').first());

		// Erfassen überträgt nichts — erst die Bestätigung macht sie wirksam.
		await gehe(`/versammlungen/${versammlung}/vollmachten`);
		const vorlegen = seite.locator('form[action="?/vorlegen"] button[type="submit"]');
		if (await vorlegen.count()) await abschicken(vorlegen.first());
		await gehe(`/versammlungen/${versammlung}/vollmachten`);
		const bestaetigen = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
		behaupte(
			await bestaetigen.count(),
			`Nichts zu bestätigen: ${(await seitentext()).slice(0, 300)}`
		);
		await abschicken(bestaetigen.first());
		behaupte(
			/bestätigt|wirksam/i.test(await seitentext()),
			`Die Vollmacht ist nicht wirksam: ${(await seitentext()).slice(0, 300)}`
		);
		return 'Aebi vertritt Bucher';
	});

	await schritt('Alle vier anwesend, Traktandum aufgerufen', async () => {
		// «Von Hand erfassen» in der Liste, mit Rückfrage — die Zahl ändert sich
		// mit jeder Bestätigung, deshalb jedes Mal neu laden.
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator(
				'form[action="?/bestaetigen"] button[type="submit"]:not([hidden])'
			);
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/anwesenheit`);
		behaupte(
			/4 von 4|4 Parteien/.test(await seitentext()),
			`Nicht alle anwesend: ${(await seitentext()).slice(0, 250)}`
		);

		// **Das richtige Traktandum**, nicht das erste: Die Pflichttraktanden
		// stehen davor, und die Begrüssung ist eine Kenntnisnahme — über sie wird
		// gar nicht abgestimmt.
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite
			.locator('.baum li', { hasText: 'Vergabe des Hauswartauftrags' })
			.first();
		const aufrufen = zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first();
		behaupte(await aufrufen.count(), 'Kein Knopf zum Aufrufen des Hauswartauftrags');
		await abschicken(aufrufen);

		const jetzt = await seite.locator('li.jetzt, .jetzt').first().innerText();
		behaupte(
			/Vergabe des Hauswartauftrags/.test(jetzt.replace(/\s+/g, ' ')),
			`Aufgerufen ist etwas anderes: ${jetzt.replace(/\s+/g, ' ').slice(0, 150)}`
		);
		return 'Hauswartauftrag aufgerufen';
	});

	await schritt('«Jetzt möglich» zeigt die Eingriffe ohne Fachwörter', async () => {
		/*
		 * **Sichtbar, ohne dass man sie kennt.** Vorher standen sie an vier Orten,
		 * alle zugeklappt, alle mit einem Fachwort beschriftet. Der Prüfstein ist
		 * darum nicht, dass es sie gibt, sondern dass sie **ohne Klick** dastehen.
		 */
		const zeile = seite.locator('.eingriffe');
		behaupte(await zeile.count(), 'Keine Zeile «Jetzt möglich» beim aufgerufenen Traktandum');
		const woerter = (await zeile.locator('.wort').allInnerTexts()).map((w) => w.trim());
		for (const w of ['Ausstand', 'Gegenantrag', 'Zurückziehen', 'Nötige Mehrheit']) {
			behaupte(woerter.includes(w), `«${w}» fehlt in der Zeile: ${woerter.join(' · ')}`);
		}
		// Und nicht das Fachwort: «Folgeantrag» sagt nur denen etwas, die es kennen.
		behaupte(!woerter.includes('Folgeantrag'), 'Die Zeile trägt ein Fachwort');
		// Nach der Abstimmung geht es, vorher nicht — es gäbe nichts, worauf man
		// zurückkäme.
		behaupte(!woerter.includes('Nochmals abstimmen'), 'Rückkommen steht zu früh da');
		return woerter.join(' · ');
	});

	await schritt('Der Ausstand erklärt sich beim Aufklappen', async () => {
		await seite.locator('.eingriffe .wort', { hasText: 'Ausstand' }).first().click();
		await seite.waitForTimeout(150);
		const text = await seitentext();
		behaupte(
			/zählt dann auch nicht mit/.test(text),
			`Der Unterschied zur Enthaltung wird nicht erklärt: ${text.slice(0, 300)}`
		);
		behaupte(/Jemand darf hier nicht mitentscheiden/.test(text), 'Die Überschrift fehlt');
		return 'erklärt den Unterschied';
	});

	await schritt('Ohne Grund wird nichts erklärt', async () => {
		// Pflichtfeld: Der Grund verändert die Zahl, gegen die gemessen wird.
		const grund = seite.locator('form[action="?/ausstand"] input[name="grund"]');
		behaupte(
			await grund.evaluate((e) => e.required),
			'Der Grund ist nicht Pflicht'
		);
		return 'Pflichtfeld';
	});

	await schritt('Duss tritt in den Ausstand — über die Schnellsuche', async () => {
		/*
		 * **Suchen statt scrollen** (21.08.2026): «bei Ausstand müsste noch eine
		 * Schnellsuche rein. Sonst wird es mühsam, wenn man bei 80 Köpfen den
		 * richtigen Namen suchen muss.» Geprüft wird beides — dass die Suche
		 * filtert und dass das Angekreuzte ankommt.
		 */
		const form = seite.locator('form[action="?/ausstand"]');
		const suche = form.locator('input[type="search"]');
		behaupte(await suche.count(), 'Keine Schnellsuche im Ausstand');
		const alle = await form.locator('.wahlliste li').count();
		await suche.fill('Duss');
		await seite.waitForTimeout(200);
		const gefiltert = await form.locator('.wahlliste li').count();
		behaupte(
			gefiltert < alle && gefiltert > 0,
			`Die Suche filtert nicht: ${alle} Zeilen vorher, ${gefiltert} nachher`
		);

		await form.locator('.wahlliste input[type="checkbox"]').first().check();
		await form.locator('input[name="grund"]').fill('Der Auftrag geht an seine eigene Firma.');
		await abschicken(form.locator('button[type="submit"]'));

		const text = await seitentext();
		behaupte(/Duss/.test(text), 'Der Ausstand steht nicht da');
		// **Der Nachweis hat den Wortlaut gewechselt, nicht den Zweck** (Ä-25,
		// 24.09.2026). Verlangt war und bleibt, dass die Seite die Rechtsfolge
		// nennt. Sie lautet nicht mehr «weder bei den Köpfen noch bei den
		// Wertquoten» — das war an fünf Stellen zu unbedingt —, sondern die
		// entzogene Stimme samt Fundstelle.
		behaupte(
			/gibt dazu keine Stimme ab/.test(text),
			`Die Rechtsfolge wird nicht genannt: ${text.slice(0, 300)}`
		);
		behaupte(
			/ZGB Art\. 68/.test(text),
			`Die Fundstelle fehlt: ${text.slice(0, 300)}`
		);
		return 'erklärt';
	});

	await schritt('Zwei Ja und ein Nein genügen — ohne den Ausgetretenen', async () => {
		/*
		 * **Der Prüfstein.** Vier Eigentümer, aber nur drei zählen. Die Schwelle
		 * liegt bei zwei; blieben es vier, läge sie bei drei und der Antrag wäre
		 * abgelehnt. Derselbe Sachverhalt, ein anderes Ergebnis.
		 */
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), `Kein Öffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(oeffnen.first());

		/*
		 * **Kein Weg zurück, solange der Durchgang läuft** (Code-Review
		 * 07.09.2026). Eine Rücknahme mitten in der Abstimmung liesse die
		 * Bezugsgrösse unter den bereits abgegebenen Stimmen wachsen; genau die
		 * Rechnung, die dieser Schritt gleich prüft, kippte damit.
		 *
		 * `nimmAusstandZurueck` weist sie seit dem 07.09.2026 ab. Hier steht die
		 * andere Hälfte: dass die Seite den Knopf gar nicht erst anbietet. Bis
		 * dahin stand er in der linken Ablaufspalte, die der Saal-Modus
		 * ausblendet — das sah wie eine Sperre aus und war eine Anzeige. Seit
		 * der Arbeitsblock rechts steht, muss die Bedingung ausdrücklich da
		 * sein.
		 */
		/*
		 * **Sichtbar, nicht bloss vorhanden** (Code-Review 07.09.2026). Zöge
		 * jemand den Kasten in die linke Spalte zurück, bliebe er im Baum und
		 * wäre nur durch `.raster.eingeengt .ablauf { display: none }` verdeckt.
		 * `count()` zählte ihn weiter mit und meldete ausgerechnet die Lage als
		 * in Ordnung, um die es hier geht.
		 */
		behaupte(
			await seite.locator('.ausstandsstand').first().isVisible(),
			'Bei offener Abstimmung ist der Ausstandsstand nicht zu sehen'
		);
		behaupte(
			(await seite.locator('form[action="?/ausstandZurueck"]').count()) === 0,
			'Bei offener Abstimmung steht ein Knopf «Zurücknehmen», der nur scheitern kann'
		);

		await oeffneErfassung();

		for (const [wer, wahl] of [
			['Aebi', 'yes'],
			['Bucher', 'yes'],
			['Christen', 'no']
		]) {
			const zeile = seite.locator('tr', { hasText: wer }).first();
			const knopf = zeile.locator(`input[type="radio"][value="${wahl}"]`).first();
			if (await knopf.count()) await knopf.check();
		}
		await oeffneErfassung();
		const erfassen = seite.locator('form[action="?/erfassen"] button[type="submit"]');
		behaupte(await erfassen.count(), 'Kein Knopf zum Erfassen der Stimmen');
		await abschicken(erfassen.first());

		const schliessen = seite.locator('form[action="?/schliessen"] button[type="submit"]');
		behaupte(await schliessen.count(), 'Kein Knopf zum Schliessen');
		await abschicken(schliessen.first());

		const text = await seitentext();
		behaupte(/angenommen/i.test(text), `Nicht angenommen: ${text.slice(0, 400)}`);
		return 'angenommen, und während des Durchgangs kein Weg zur Rücknahme';
	});

	await schritt('Der Ausstand steht namentlich im Ergebnis', async () => {
		// Ohne diese Zeile ginge die Rechnung für einen Leser nicht auf: vier
		// Eigentümer, drei Stimmen, keine Erklärung.
		await gehe(`/versammlungen/${versammlung}/auswertung`);
		const text = await seitentext();
		behaupte(
			/Duss/.test(text) && /Ausstand/.test(text),
			`Der Ausstand fehlt in der Auswertung: ${text.slice(0, 400)}`
		);
		behaupte(/Art\. 68/.test(text), 'Die Rechtsgrundlage fehlt');
		return 'genannt, mit Grundlage';
	});

	await schritt('Und im Verlauf, mit Grund', async () => {
		await gehe(`/verlauf?q=Ausstand`);
		const text = await seitentext();
		behaupte(/Ausstand erklärt/.test(text), `Kein Verlaufseintrag: ${text.slice(0, 300)}`);
		return 'im Verlauf';
	});

	// ── Wer im Ausstand ist, kann auch niemanden vertreten ──────────────────
	//
	// BGE 134 III 481 E. 3.8. Am zweiten Traktandum, weil der
	// Ausstand je Traktandum gilt: Beim Hauswartauftrag hat Aebi eben noch für
	// Bucher mitgestimmt.

	await schritt('Budget aufgerufen, Aebi tritt in den Ausstand', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Budget 2028' }).first();
		const aufrufen = zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first();
		behaupte(await aufrufen.count(), 'Kein Knopf zum Aufrufen des Budgets');
		await abschicken(aufrufen);

		await seite.locator('.eingriffe .wort', { hasText: 'Ausstand' }).first().click();
		await seite.waitForTimeout(150);
		const form = seite.locator('form[action="?/ausstand"]');
		await form.locator('input[type="search"]').fill('Aebi');
		await seite.waitForTimeout(200);
		await form.locator('.wahlliste input[type="checkbox"]').first().check();
		await form.locator('input[name="grund"]').fill('Das Budget trägt seine eigene Entschädigung.');
		await abschicken(form.locator('button[type="submit"]'));
		return 'Aebi im Ausstand';
	});

	await schritt('Die Vollmacht ruht — und die Seite sagt es vorher', async () => {
		/*
		 * **Der Prüfstein.** Stünde es erst in der Auswertung, hätte die
		 * Sitzungsleitung das Ergebnis verkündet, ohne zu wissen, dass eine Stimme
		 * nicht zählte.
		 */
		const text = await seitentext();
		behaupte(
			/Diese Vollmachten ruhen bei diesem Traktandum/.test(text),
			`Die ruhende Vollmacht steht nicht auf der Seite: ${text.slice(0, 600)}`
		);
		// **Ohne Klick.** Nach dem Erklären klappt das Feld zu; stünde die Folge
		// darin, sähe die Sitzungsleitung sie nie. Der Prüfstein ist deshalb, dass
		// sie im Stand steht, nicht im Angebot.
		behaupte(
			/entscheiden bei diesem Traktandum nicht mit/.test(text),
			`Der Ausstand steht nicht als Stand da: ${text.slice(0, 600)}`
		);
		behaupte(
			/Bucher/.test(text) && /niemanden vertreten/.test(text),
			`Der Grund fehlt: ${text.slice(0, 400)}`
		);
		return 'vor der Abstimmung genannt';
	});

	await schritt('Bucher steht nicht mehr zur Stimmerfassung', async () => {
		// Wer nicht mitstimmt, bekommt keine Knöpfe, die alle in dieselbe Absage
		// laufen — weder hier noch am Telefon.
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), `Kein Öffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(oeffnen.first());

		await oeffneErfassung();
		const erfassung = seite.locator('form[action="?/erfassen"]');
		const zeilen = await erfassung.locator('tr').allInnerTexts();
		const wen = zeilen.join(' ').replace(/\s+/g, ' ');
		behaupte(!/Aebi/.test(wen), `Der Ausgetretene steht noch in der Erfassung: ${wen.slice(0, 250)}`);
		behaupte(
			!/Bucher/.test(wen),
			`Die ruhend Vertretene steht noch in der Erfassung: ${wen.slice(0, 250)}`
		);
		behaupte(/Christen/.test(wen) && /Duss/.test(wen), `Es fehlen Stimmberechtigte: ${wen.slice(0, 250)}`);
		return 'nur Christen und Duss';
	});

	await schritt('Gezählt werden zwei, nicht vier', async () => {
		await oeffneErfassung();
		for (const [wer, wahl] of [
			['Christen', 'yes'],
			['Duss', 'no']
		]) {
			const zeile = seite.locator('tr', { hasText: wer }).first();
			const knopf = zeile.locator(`input[type="radio"][value="${wahl}"]`).first();
			if (await knopf.count()) await knopf.check();
		}
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());

		/*
		 * **Zwei Fehler in einer Behauptung, beide am 07.09.2026 gefunden.**
		 *
		 * Erstens war die Stelle falsch: `/1 von 2/` suchte im **ganzen**
		 * Seitentext, und der Ausschnitt für die Meldung nahm das erste
		 * Vorkommen von «Bezugsgrösse» — das gehört dem Hauswartauftrag weiter
		 * oben. Der Schritt las über dem gesuchten Geschäft.
		 *
		 * Zweitens stimmte der Wortlaut nicht mehr: Die Seite schreibt «1 Ja von
		 * 2 Kopfstimmen». «1 von 2» kommt darin nicht vor, und der Schritt war
		 * deshalb dauerhaft rot — nachgeprüft am Bestand: Die Rechnung selbst ist
		 * richtig (Bezugsgrösse 2, abgelehnt, Aebi im Ausstand, Bucher ruhend).
		 *
		 * Deshalb greift die Behauptung jetzt die Ergebniskarte des richtigen
		 * Geschäfts als Knoten und liest deren Text — kein Fenster fester Länge,
		 * das in die nächste Karte hineinreichen kann.
		 */
		const karte = seite.locator('article.ergebnis', { hasText: 'Budget' });
		behaupte(
			(await karte.count()) === 1,
			`Unter den Ergebnissen steht das Budget ${await karte.count()}× statt einmal`
		);
		const kasten = (await karte.first().innerText()).replace(/\s+/g, ' ');

		/*
		 * **Die Kopfstimmen, nicht irgendeine Bezugsgrösse.** In derselben Karte
		 * steht auch die der Wertquoten; ein Muster auf «Bezugsgrösse N» allein
		 * träfe beide (Code-Review 07.09.2026).
		 */
		// Ein Ja gegen ein Nein bei Basis 2: abgelehnt. Zählte Bucher mit, wäre
		// die Basis 3 — und mit Aebis Stimme dazu stünde es ganz anders.
		behaupte(
			/1 Ja von 2 Kopfstimmen/.test(kasten),
			`Die Kopfstimmen stimmen nicht: ${kasten.slice(0, 400)}`
		);
		behaupte(
			/Abgelehnt/.test(kasten),
			`Ein Ja gegen ein Nein bei Basis 2 ist abgelehnt: ${kasten.slice(0, 400)}`
		);
		return '1 Ja von 2 Kopfstimmen, abgelehnt';
	});

	await schritt('Die Auswertung nennt die ruhende Vollmacht mit Fundstelle', async () => {
		await gehe(`/versammlungen/${versammlung}/auswertung`);
		const text = await seitentext();
		behaupte(
			/«Bucher» war nur über Aebi vertreten/.test(text),
			`Die ruhende Vollmacht fehlt in der Auswertung: ${text.slice(0, 500)}`
		);
		behaupte(/BGE 134 III 481 E\. 3\.8/.test(text), 'Die Fundstelle fehlt');
		return 'genannt, mit Fundstelle';
	});

	// ── Wen nur das Reglement ausnimmt, der vertritt weiter ─────────────────
	//
	// Produktentscheid 27.09.2026 (`quellen`, fragen.md, «Offen»). Aebi ist bei
	// der Werkstattordnung betroffen, die Reglementsklausel nimmt ihn aus der
	// Kopfbasis. Seine eigene Stimme zählt nicht, die für Bucher schon.

	await schritt('Werkstattordnung aufgerufen, Aebi als betroffen eingetragen', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Werkstattordnung' }).first();
		const aufrufen = zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first();
		behaupte(await aufrufen.count(), 'Kein Knopf zum Aufrufen der Werkstattordnung');
		await abschicken(aufrufen);
		/*
		 * **Woran man sieht, dass die Klausel greift.** «Betroffene» steht seit
		 * dem 03.10.2026 immer in der Zeile; ob das Erfordernis Betroffene
		 * kennt, entscheidet, ob nach dem Klick das Eingabefeld erscheint oder
		 * der Weg über die nötige Mehrheit (Codeprüfung 04.10.2026, N1). Die
		 * erste Fassung prüfte das Wort «Reglement» im Seitentext und traf die
		 * Seitenleiste (Codeprüfung 27.09.2026, N3; die Fundstelle steht auf
		 * dieser Seite nicht).
		 */
		const woerter = (await seite.locator('.eingriffe .wort').allInnerTexts()).map((w) => w.trim());
		behaupte(
			woerter.includes('Betroffene'),
			`Der Eintrag «Betroffene» fehlt in der Zeile: ${woerter.join(' · ')}`
		);

		await seite.locator('.eingriffe .wort', { hasText: 'Betroffene' }).first().click();
		await seite.waitForTimeout(150);
		const form = seite.locator('form[action="?/betroffeneEin"]');
		behaupte(
			await form.count(),
			`Die Reglementsklausel greift nicht, das Eingabefeld fehlt: ${(await seitentext()).slice(0, 400)}`
		);
		await form.locator('input[type="search"]').fill('Aebi');
		await seite.waitForTimeout(200);
		await form.locator('.wahlliste input[type="checkbox"]').first().check();
		await abschicken(form.locator('button[type="submit"]'));
		return 'Aebi betroffen';
	});

	await schritt('Die Vollmacht von Aebi ruht hier nicht', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const text = await seitentext();
		behaupte(
			!/Diese Vollmachten ruhen bei diesem Traktandum/.test(text),
			`Die Seite meldet eine ruhende Vollmacht: ${text.slice(0, 600)}`
		);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), `Kein Öffnen: ${text.slice(0, 220)}`);
		await abschicken(oeffnen.first());

		await oeffneErfassung();
		const wen = (await seite.locator('form[action="?/erfassen"]').locator('tr').allInnerTexts())
			.join(' ')
			.replace(/\s+/g, ' ');
		behaupte(!/Aebi/.test(wen), `Der Betroffene steht in der Erfassung: ${wen.slice(0, 250)}`);
		behaupte(/Bucher/.test(wen), `Bucher fehlt in der Erfassung: ${wen.slice(0, 250)}`);
		return 'Bucher erfassbar, Aebi nicht';
	});

	await schritt('Gezählt werden Bucher, Christen und Duss', async () => {
		await oeffneErfassung();
		for (const [wer, wahl] of [
			['Bucher', 'yes'],
			['Christen', 'yes'],
			['Duss', 'no']
		]) {
			const zeile = seite.locator('tr', { hasText: wer }).first();
			const knopf = zeile.locator(`input[type="radio"][value="${wahl}"]`).first();
			if (await knopf.count()) await knopf.check();
		}
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());

		// Basis drei (alle ausser Aebi), nötig zwei. Ruhte Buchers Vollmacht,
		// stünde es 1 Ja von 3 und abgelehnt.
		const karte = seite.locator('article.ergebnis', { hasText: 'Werkstattordnung' });
		behaupte((await karte.count()) === 1, `Die Werkstattordnung steht ${await karte.count()}× da`);
		const kasten = (await karte.first().innerText()).replace(/\s+/g, ' ');
		behaupte(/2 Ja von 3 Kopfstimmen/.test(kasten), `Die Kopfstimmen stimmen nicht: ${kasten.slice(0, 400)}`);
		behaupte(/Angenommen/.test(kasten), `Nicht angenommen: ${kasten.slice(0, 400)}`);
		behaupte(!/war nur über/.test(kasten), `Die Karte nennt eine ruhende Vollmacht: ${kasten.slice(0, 400)}`);
		return '2 Ja von 3 Kopfstimmen, angenommen';
	});

	// ── Ehegatte und Verwandte des Beklagten ─────────────────────────────────
	//
	// Produktentscheid 27.09.2026 (`quellen`, fragen.md, «Offen»; ZGB Art. 68,
	// BGE 134 III 481 E. 3.8). Duss ist beklagt, Aebi seine Ehefrau. Votum
	// kennt keine Verwandtschaft: Die Seite erinnert, die Leitung erklärt den
	// Ausstand, und der nimmt Aebi samt der Vollmacht von Bucher heraus.

	await schritt('Ausschlussklage aufgerufen, Duss beklagt, die Seite nennt die Angehörigen', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Ermächtigung zur Ausschlussklage' }).first();
		const aufrufen = zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first();
		behaupte(await aufrufen.count(), 'Kein Knopf zum Aufrufen der Ausschlussklage');
		await abschicken(aufrufen);

		// Duss steht seit dem 29.09.2026 schon aus dem Entwurf als beklagt da
		// (Schritt 5); im Saal wird er nicht mehr eingetragen.

		const hinweis = (await seite.locator('.eingriffe').first().innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Ehegatte und Verwandte des Beklagten/.test(hinweis) &&
				/erklären Sie für diese Angehörigen hier den Ausstand/.test(hinweis),
			`Der Hinweis zu den Angehörigen fehlt: ${hinweis.slice(0, 500)}`
		);
		// Unter der Klausel Ziff. 11 misst Votum an den Anwesenden; sicher ist
		// die Ermächtigung erst mit der Mehrheit aller ohne den Beklagten, die
		// Angehörigen eingeschlossen (Codeprüfung N-1; Laien- und Fachprüfung
		// 29.09.2026, F9 und G6). Seit Lesarten Block 6 nennt Votum diese Zahl
		// nach der Auszählung selbst, statt von Hand zählen zu lassen.
		behaupte(
			/Hier misst sie an den Anwesenden und Vertretenen/.test(hinweis) &&
				/Nach der Auszählung nennt Ihnen die Anwendung auch das Ergebnis an dieser Zahl/.test(hinweis) &&
				/Dort bleiben die Angehörigen im Ausstand in der Zahl/.test(hinweis) &&
				!/zur Zahl der Eigentümer hinzu/.test(hinweis),
			`Der Hinweis nennt unter Ziff. 11 nicht die sichere Zahl: ${hinweis.slice(0, 900)}`
		);
		return 'Hinweis vor der Abstimmung';
	});

	await schritt('Aebi tritt als Ehefrau des Beklagten in den Ausstand, Buchers Vollmacht ruht', async () => {
		await seite.locator('.eingriffe .wort', { hasText: 'Ausstand' }).first().click();
		await seite.waitForTimeout(150);
		const form = seite.locator('form[action="?/ausstand"]');
		await form.locator('input[type="search"]').fill('Aebi');
		await seite.waitForTimeout(200);
		await form.locator('.wahlliste input[type="checkbox"]').first().check();
		await form.locator('input[name="grund"]').fill('Ehefrau des Beklagten (ZGB Art. 68).');
		await abschicken(form.locator('button[type="submit"]'));

		// Im Satz zur ruhenden Vollmacht, nicht irgendwo auf der Seite
		// (Codeprüfung 27.09.2026, N4).
		const ruhend = seite.locator('p.ruhend').first();
		behaupte(await ruhend.count(), `Keine ruhende Vollmacht: ${(await seitentext()).slice(0, 600)}`);
		const satz = (await ruhend.innerText()).replace(/\s+/g, ' ');
		behaupte(/Bucher/.test(satz) && /im Ausstand/.test(satz), `Der falsche Satz: ${satz}`);
		return 'Ausstand mit Grund, Vollmacht ruht';
	});

	await schritt('Gezählt wird ohne Duss, Aebi und Buchers Vollmacht', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), `Kein Öffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(oeffnen.first());

		await oeffneErfassung();
		const wen = (await seite.locator('form[action="?/erfassen"]').locator('tr').allInnerTexts())
			.join(' ')
			.replace(/\s+/g, ' ');
		for (const wer of ['Aebi', 'Bucher', 'Duss']) {
			behaupte(!new RegExp(wer).test(wen), `${wer} steht in der Erfassung: ${wen.slice(0, 250)}`);
		}
		const knopf = seite.locator('tr', { hasText: 'Christen' }).first().locator('input[type="radio"][value="yes"]').first();
		if (await knopf.count()) await knopf.check();
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());

		// Basis nach der Klausel Ziff. 11: die Anwesenden ohne den Beklagten
		// und ohne die Ehefrau im Ausstand. Bucher zählt nicht, weil ihre
		// Vertretung ruht; es bleibt Christen. Nach Gesetz wären es Bucher und
		// Christen, 1 Ja von 2 und abgelehnt (so bis 2026-10-06). Zählte Duss
		// mit, stünde er in der Erfassung oben, oder die Basis wäre 2.
		const karte = seite.locator('article.ergebnis', { hasText: 'Ausschlussklage' });
		behaupte((await karte.count()) === 1, `Die Ausschlussklage steht ${await karte.count()}× da`);
		const kasten = (await karte.first().innerText()).replace(/\s+/g, ' ');
		behaupte(/1 Ja von 1 Kopfstimme\b/.test(kasten), `Die Kopfstimmen stimmen nicht: ${kasten.slice(0, 400)}`);
		behaupte(/Angenommen/.test(kasten), `Nicht angenommen: ${kasten.slice(0, 400)}`);

		/*
		 * **Und die Karte erklärt die Klausel, nicht das Gesetz** (Produktentscheid
		 * 29.09.2026, Fassung 2026-10-08). Bis dahin stand unter Ziff. 11 die
		 * Begründung «folgt der strengeren Wortlaut-Lesart» und das Beispiel
		 * «fünf Ja, unabhängig davon, wie viele erschienen sind». Geprüft im
		 * Rechner mit dieser Gemeinschaft; er zeigt dieselbe Karte wie das
		 * Traktandum, aus derselben Komponente und derselben Rechnung.
		 */
		await gehe(`/quorum?g=${gemeinschaft}&ast=a-sonderfaelle&p=f8-1-ausschluss`);
		const erklaerung = seite.locator('article.karte').first();
		behaupte(await erklaerung.count(), `Keine Ergebniskarte: ${(await seitentext()).slice(0, 300)}`);
		const begruendung = (await erklaerung.locator('p.begruendung').innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Bestimmung Ihres Reglements.*\(Reglement Ziff\. 11\), nicht aus dem Gesetz/.test(begruendung) &&
				!/Wortlaut-Lesart/.test(begruendung),
			`Die Begründung erklärt nicht die Klausel: ${begruendung}`
		);
		const beachten = (
			await erklaerung.locator('.block', { has: seite.locator('h3', { hasText: 'Zu beachten' }) }).innerText()
		).replace(/\s+/g, ' ');
		behaupte(
			!/unabhängig davon, wie viele erschienen sind/.test(beachten) &&
				!/fünf Ja von neun/.test(beachten) &&
				/reichen Schlichtungsgesuch und Klage am sichersten erst einige Wochen nach Ablauf der Frist ein/.test(beachten),
			`Unter «Zu beachten» steht noch die Rechnung des Gesetzes: ${beachten.slice(0, 600)}`
		);
		const gesetz = erklaerung.locator('.block', {
			has: seite.locator('h3', { hasText: 'Zum gesetzlichen Erfordernis' })
		});
		behaupte(await gesetz.count(), 'Kein Abschnitt «Zum gesetzlichen Erfordernis»');
		const gesetzText = (await gesetz.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/gilt nicht für das Ergebnis oben/.test(gesetzText) &&
				/Wortlaut-Lesart/.test(gesetzText) &&
				/unabhängig davon, wie viele erschienen sind/.test(gesetzText),
			`Der Abschnitt zum Gesetz ist unvollständig: ${gesetzText.slice(0, 600)}`
		);
		return '1 Ja von 1 Kopfstimme nach Ziff. 11, angenommen; die Karte erklärt Ziff. 11';
	});

	/*
	 * **Die Urkunde nennt die Zahl, die der Ausstand verschoben hat**
	 * (Produktentscheid 24.09.2026; Befund D-02 vom 22.08.2026: «die
	 * Bezugsgrösse springt von 5 auf 4, ohne ein Wort der Erklärung»). Drei der
	 * vier Abstimmungen dieses Drehbuchs tragen einen Ausstand: beim Hauswart
	 * Duss allein (3 statt 4), beim Budget Aebi mit der ruhenden Vollmacht von
	 * Bucher (2 statt 4), bei der Ausschlussklage Aebi als Ehefrau des
	 * Beklagten. Dort galt bis zum 29.09.2026 das Gesetz (2 statt 3; der
	 * Beklagte steht schon ohne Ausstand nicht in der Zahl); seither rechnet sie
	 * nach der Klausel Ziff. 11 über die Anwesenden, und ohne Aebis Ausstand
	 * stünden auch sie und die dann nicht ruhende Vollmacht von Bucher in der
	 * Zahl: 1 statt 3. Die zweite ist der Fall, den eine Rechnung, die nur den
	 * Ausgetretenen abzöge, falsch druckte.
	 */
	await schritt('Das Protokoll nennt, was der Ausstand an der Basis geändert hat', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]'));
		const text = await seite.locator('textarea[name="body"]').inputValue();
		for (const zahl of ['3 statt 4', '2 statt 4', '1 statt 3']) {
			behaupte(
				text.includes(`Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse ${zahl} Kopfstimmen.`),
				`Im Protokoll fehlt «${zahl}»: ${text.slice(0, 900)}`
			);
		}
		return '3 statt 4, 2 statt 4 und 1 statt 3';
	});

	await schritt('Kein Querlauf am Telefon', async () => {
		const eng = await browser.newPage({ viewport: { width: 390, height: 844 } });
		warteNachNavigation(eng);
		await rueckfragenBestaetigen(eng);
		await eng.goto(`${ZIEL}/anmelden`, { waitUntil: 'load' });
		await eng.fill('input[name="username"]', BENUTZER);
		await eng.fill('input[name="kennwort"]', KENNWORT);
		await Promise.all([
			eng.waitForURL((u) => !u.pathname.includes('/anmelden'), { timeout: 30000 }),
			eng.locator('main button[type="submit"]').click()
		]);
		await eng.goto(`${ZIEL}/versammlungen/${versammlung}/leitung`, {
			waitUntil: 'domcontentloaded'
		});
		await eng.waitForTimeout(500);
		const ueber = await eng.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		await eng.close();
		behaupte(ueber === 0, `Die Seite läuft ${ueber} px quer`);
		return '0 px';
	});

	if (rueckfragen.length > 0) {
		console.log(`\n  Rückfragen unterwegs: ${rueckfragen.join(' · ')}`);
	}
	console.log(`\n  Prüfbestand: Gemeinschaft ${gemeinschaft}`);
} finally {
	await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png`, fullPage: true }).catch(() => {});
	await browser.close();
}

console.log('');
if (fehler.length > 0) {
	console.log(`${fehler.length} Befund${fehler.length === 1 ? '' : 'e'}:`);
	for (const f of fehler) console.log(`  · ${f}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün. Aufnahmen in ${AUFNAHMEN}`);
