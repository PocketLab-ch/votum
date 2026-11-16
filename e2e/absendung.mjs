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
			// Ein abgerissenes `__data.json` zeichnet die Fehlerseite im Layout; ohne Navigation
			// geht kein `bereit()` darüber (`bereit.mjs`, `fehlerseiteNachholen`).
			await fehlerseiteNachholen(seite, nachladen?.abrissStand);
		}
	} else {
		await seite.waitForLoadState('domcontentloaded');
	}
	await seite.waitForTimeout(frist);
}
