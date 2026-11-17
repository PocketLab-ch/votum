/**
 * Was aus einer Absendung wurde, und wann sie fertig ist.
 *
 * ## Warum das seit dem 27.08.2026 an einer Stelle steht
 *
 * Mit `use:enhance` ändern sich **zwei** Dinge, auf die jedes Drehbuch baut,
 * und beide lautlos:
 *
 * **1. Der Statuscode taugt nicht mehr.** SvelteKit verpackt auch ein
 * `fail(400)` in eine Antwort mit HTTP 200 — `action_json` in
 * `runtime/server/page/actions.js` setzt den Status der Absage in den Rumpf,
 * nicht in die Antwort (nachgelesen). Jede Prüfung `antwort.status() >= 400`
 * prüft damit nichts mehr, sobald die Seite umgestellt ist. Fünf Drehbücher
 * hatten genau diese Zeile.
 *
 * **2. `domcontentloaded` wartet auf nichts.** Ohne Navigation kehrt es sofort
 * zurück, und die feste Frist dahinter müsste den ganzen `invalidateAll()`
 * Nachladelauf allein abdecken. Gewartet wird stattdessen auf den Nachladelauf
 * selbst — und nur bei Erfolg, denn bei einer Absage gibt es keinen.
 *
 * Beides ist nicht seitenweise zu entscheiden: Ein Drehbuch bedient Seiten mit
 * und ohne `use:enhance`, oft im selben Schritt. Deshalb wird an der Antwort
 * abgelesen, was gilt, und nicht an einer Liste umgestellter Seiten.
 */

/** Hat `use:enhance` die Absendung abgefangen? */
export function abgefangen(antwort) {
	return Boolean(antwort?.request().headers()['x-sveltekit-action']);
}

/**
 * `success`, `failure` oder `error` — oder warum sich das nicht sagen lässt.
 *
 * «ohne use:enhance neu geladen» ist der häufigste Grund für eine unlesbare
 * Antwort und bekommt deshalb einen eigenen Namen: Ein `JSON.parse` über eine
 * HTML-Seite meldete sonst «unlesbar» und schickte die Suche in die falsche
 * Richtung.
 */
export async function ergebnisart(antwort) {
	if (!antwort) return 'keine Antwort';
	if (!abgefangen(antwort)) return 'ohne use:enhance neu geladen';
	return antwort
		.text()
		.then((t) => JSON.parse(t).type)
		.catch(() => 'unlesbar');
}

/** Aus einer HTML-Fehlerseite den Satz herausziehen, der etwas sagt. */
function satzAus(roh) {
	const nurText = roh
		.replace(/<script[\s\S]*?<\/script>/g, ' ')
		.replace(/<style[\s\S]*?<\/style>/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ');
	const stelle = nurText.search(/Ohne |Wählen |Diese |Der |Es |Kein /);
	return nurText.slice(Math.max(0, stelle), Math.max(0, stelle) + 260).trim();
}

/**
 * Warum die Absendung abgewiesen wurde, oder `null`, wenn sie durchging.
 *
 * Deckt beide Welten ab: die Navigation mit ihrem Statuscode und die
 * abgefangene Absendung mit ihrem Rumpf.
 */
export async function absageGrund(antwort) {
	if (!antwort) return null;
	if (!abgefangen(antwort)) {
		if (antwort.status() < 400) return null;
		const roh = await antwort.text().catch(() => '');
		return `Der Server wies das Formular ab: ${antwort.status()} ${antwort.url()} — ${satzAus(roh)}`;
	}
	const art = await ergebnisart(antwort);
	if (art === 'success') return null;
	const rumpf = await antwort.text().catch(() => '');
	return `Der Server wies das Formular ab (${art}): ${antwort.url()} — ${rumpf.slice(0, 260)}`;
}

import { abrissStand, fehlerseiteNachholen } from './bereit.mjs';

/**
 * Den Nachladelauf scharfstellen — **vor** dem Klick, sonst ist er vorbei.
 *
 * `invalidateAll()` holt `__data.json`; das ist das Signal, dass der neue Stand
 * im Baum steht.
 */
export function nachladeWarter(seite, frist = 20000) {
	verfolgeDatenabrufe(seite);
	const warter = seite
		.waitForResponse((r) => r.request().method() === 'GET' && r.url().includes('__data.json'), {
			timeout: frist
		})
		.catch(() => null);
	// Der Stand der abgerissenen Abrufe vor dem Klick: das Fenster für `fehlerseiteNachholen`.
	warter.abrissStand = abrissStand(seite);
	return warter;
}

/**
 * Warten, bis die Antwort auf der Seite steht.
 *
 * `nachladen` ist der Rückgabewert von `nachladeWarter`, vor dem Klick geholt.
 */
export async function nachAbsendung(seite, antwort, nachladen, frist = 120) {
	if (abgefangen(antwort)) {
		if ((await ergebnisart(antwort)) === 'success') {
			await nachladen;
			await datenRuhe(seite);
			// Ein abgerissenes `__data.json` zeichnet die Fehlerseite im Layout; ohne Navigation
			// geht kein `bereit()` darüber (`bereit.mjs`, `fehlerseiteNachholen`).
			await fehlerseiteNachholen(seite, nachladen?.abrissStand);
		}
	} else {
		await seite.waitForLoadState('domcontentloaded');
	}
	await seite.waitForTimeout(frist);
}

/*
 * **Erst weiter, wenn kein Datenabruf mehr unterwegs ist** (17.11.2026).
 *
 * `nachladeWarter` löst bei der ersten Antwort eines `__data.json` aus, und das
 * schon mit den Kopfzeilen. Nach einer Absendung laufen auf Seiten mit
 * Ereignisstrom aber oft zwei Nachzüge: `update()` aus dem Formular und der
 * Nachzug aus dem Strom. Navigierte das Drehbuch gleich danach weiter (`goto`,
 * `reload`), brach es den zweiten ab, und die Konsole meldete «TypeError:
 * Failed to fetch» aus `HTMLFormElement`. So in `durchspielen.mjs` am gebauten
 * Stand `ed9aacf1`, zwei Läufe hintereinander: abgesendet in Schritt 80,
 * abgerissen beim `goto` am Anfang von Schritt 81, und in Schritt 123 beim
 * `reload` gleich nach der Antwort (gemessen: `net::ERR_ABORTED`);
 * die offene Pendenz zu `e2e/bereit.mjs` nennt dasselbe seit dem 14.11.2026.
 * Ein Mensch wartet, bis die Seite steht; das Drehbuch tut es jetzt auch.
 *
 * Gezählt wird ab dem ersten `nachladeWarter` der Seite; was davor schon lief,
 * sieht die Wache nicht. Gewartet wird bis `requestfinished` (Körper gelesen)
 * oder `requestfailed`, dann eine kurze Ruhe für einen Nachzug aus dem
 * Ereignisstrom, der kurz nach dem ersten beginnt. Die Ruhe verringert den
 * Abriss, schliesst ihn nicht aus: Kommt die Meldung des Stroms später, oder holt
 * `/z` einen übersprungenen Nachzug im Takt nach, sieht die Wache ihn nicht.
 * Läuft nach `frist` noch etwas, geht es weiter und die Zeile im Protokoll sagt
 * es; ein Befund ist das nicht, der nächste Schritt misst die Seite.
 */
const unterwegs = new WeakMap();

function istDatenabruf(r) {
	return r.method() === 'GET' && r.url().includes('/__data.json');
}

export function verfolgeDatenabrufe(seite) {
	if (unterwegs.has(seite)) return;
	// Abruf → Startzeit, damit die Meldung bei abgelaufener Frist sagt, was hängt.
	const offen = new Map();
	unterwegs.set(seite, offen);
	seite.on('request', (r) => {
		/*
		 * Ein neues Dokument nimmt die Abrufe der alten Seite mit. Am Start der
		 * Dokumentanfrage leeren, nicht an `framenavigated`: Das feuert auch bei
		 * `pushState` und `replaceState`, und ein laufender Abruf fiele aus der
		 * Zählung (Codeprüfung 17.11.2026). Auch ein Link, der als Download endet,
		 * ist eine Dokumentanfrage und leert, obwohl die Seite bleibt; nach den
		 * Downloads im Drehbuch folgt kein `datenRuhe`.
		 */
		if (r.isNavigationRequest() && r.frame() === seite.mainFrame()) offen.clear();
		else if (istDatenabruf(r)) offen.set(r, Date.now());
	});
	seite.on('requestfinished', (r) => offen.delete(r));
	seite.on('requestfailed', (r) => offen.delete(r));
	/*
	 * **Und noch einmal, wenn das neue Dokument steht** (17.11.2026). Im vierten
	 * Lauf blieb in Schritt 110 ein Abruf 10 s lang offen, ohne dass Playwright
	 * sein Ende meldete; laut Drehbuch nach einem `goto` (die Logzeile nannte
	 * damals weder Pfad noch Alter). Vermutet, nicht belegt: Das alte Dokument startete ihn
	 * zwischen Dokumentanfrage und Wechsel. Beim Start bringt das Dokument seine
	 * Daten selbst mit, ein `__data.json` vor `domcontentloaded` wäre ein Nachzug
	 * genau in diesem Augenblick: möglich, aber selten, und dann fiele nur dieser
	 * eine aus der Zählung.
	 */
	seite.on('domcontentloaded', () => offen.clear());
}

/*
 * **Die Frist bleibt unter der Lebensdauer einer Quittung.** Eine gute Meldung
 * wandert nach unten rechts und verschwindet nach `DAUER` (6 s,
 * `src/lib/einblender.svelte.ts`). Mit 10 s fand Schritt 110 im vierten Lauf
 * «ohne Ergebnis abgebrochen» nicht mehr, obwohl der Abbruch durchgegangen war.
 */
export async function datenRuhe(seite, { frist = 3000, ruhe = 150 } = {}) {
	const offen = unterwegs.get(seite);
	if (!offen) return;
	const ende = Date.now() + frist;
	let ruhigSeit = offen.size === 0 ? Date.now() : null;
	while (Date.now() < ende) {
		if (offen.size > 0) ruhigSeit = null;
		else if (ruhigSeit === null) ruhigSeit = Date.now();
		else if (Date.now() - ruhigSeit >= ruhe) return;
		await seite.waitForTimeout(25);
	}
	// Nur der Pfad, und der Code in `/z/…`, `/p/…`, `/b/…`, `/e/…` und `/e/tag/…`
	// maskiert: Dort steht in der Anwendung ein Zugangscode oder ein Merkmal.
	const pfadVon = (adresse) => {
		try {
			return new URL(adresse).pathname.replace(/^\/(z|p|b|e(?:\/tag)?)\/(?!strom$|__data\.json$)[^/]+/, '/$1/…');
		} catch {
			return '(unlesbare Adresse)';
		}
	};
	const pfad = pfadVon(seite.url());
	const jetzt = Date.now();
	const welche = [...offen].map(([r, seit]) => `${pfadVon(r.url())} seit ${jetzt - seit} ms`).join(', ');
	console.log(
		`   [Netz ${pfad}] nach ${frist} ms noch ${offen.size} Datenabruf(e) unterwegs (${welche}); weiter ohne Ruhe`
	);
}
