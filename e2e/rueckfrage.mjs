/**
 * Rückfragen der Anwendung im Drehbuch beantworten.
 *
 * **Warum es diesen Baustein gibt.** Bis zum 20.08.2026 fragte die Anwendung
 * über `confirm()`, und jedes Drehbuch beantwortete das mit einer Zeile:
 *
 * ```js
 * seite.on('dialog', (d) => d.accept());
 * ```
 *
 * Seit die Rückfrage ein eigenes Fenster im Stil der Seite ist
 * (`Rueckfrage.svelte`), gibt es kein `dialog`-Ereignis mehr. Der Auslöser
 * öffnet nur noch das Fenster; abgeschickt wird erst darin. Ein Drehbuch, das
 * bloss den Auslöser drückt, wartet danach auf eine Antwort, die nie kommt —
 * und meldet «Knopf geklickt, nichts passiert». Genau daran brach
 * `durchspielen.mjs` bei «Leitung bestätigt die Anwesenheit» ab.
 *
 * **Deshalb ein Beobachter statt einer Änderung an jedem `abschicken`.** Er tut
 * dasselbe, was `d.accept()` vorher tat: Sobald ein **durch Klick geöffnetes**
 * Rückfragefenster aufgeht,
 * bestätigt er es. Ein Aufruf je Seite oder Kontext, und alle Klicks des
 * Drehbuchs sind gedeckt — auch die, die erst später dazukommen.
 *
 * **Was er nicht kann:** einen Abbruch prüfen. Wer prüfen will, dass
 * «Abbrechen» wirklich abbricht, darf ihn auf dieser Seite nicht einsetzen und
 * bedient das Fenster von Hand (`dialog[open] button.ab`).
 *
 * Verwendung — unmittelbar nach dem Anlegen der Seite, **vor** der ersten
 * Navigation:
 *
 * ```js
 * const seite = await browser.newPage();
 * await rueckfragenBestaetigen(seite);
 * ```
 *
 * Und was unterwegs gefragt wurde:
 *
 * ```js
 * console.log((await gestellteRueckfragen(seite)).join(' · '));
 * ```
 */

/** Der Beobachter im Seitenkontext — bestätigt jedes aufgehende Fenster. */
function beobachter() {
	// @ts-ignore — läuft im Browser, nicht in Node.
	window.__rueckfragen = window.__rueckfragen ?? [];
	const bestaetigen = () => {
		/*
		 * **`:not(.serverfrage)`** (26.08.2026, aus dem Code-Review). Seit es ein
		 * zweites Rückfragefenster gibt — eines, dessen Frage erst der Server
		 * beantworten konnte (`Rueckfragefenster.svelte`) —, steht ein
		 * `dialog.rueckfrage[open]` schon im ausgelieferten HTML. Der Beobachter
		 * hätte «Trotzdem entfernen» gedrückt, bevor das Drehbuch überhaupt
		 * gefragt hat: eine zerstörende Handlung, ausgelöst vom Prüfstand selbst,
		 * und ein Wächter, der die Rückfrage danach nie mehr sehen kann.
		 *
		 * Er bestätigt deshalb nur, was ein **Klick** geöffnet hat.
		 */
		for (const fenster of document.querySelectorAll(
			'dialog.rueckfrage[open]:not(.serverfrage)'
		)) {
			const ja = fenster.querySelector('button.ja');
			if (!ja) continue;
			/*
			 * **Ein leeres Pflichtfeld wird nicht bestätigt** (04.10.2026).
			 * Rückfragen, die einen Pflichtwert über `required` verlangen, kann
			 * der Beobachter nicht beantworten: Er drückt «Bestätigen», der
			 * Browser weist das leere Feld ab — und im kopflosen Chromium blieb
			 * der Renderer danach stehen (`page.evaluate` kam nicht mehr zurück,
			 * der Klick des Drehbuchs lief in die Frist, ein Lauf hing eine
			 * Stunde). Solche Fenster lässt er offen.
			 *
			 * **Das Verlassen-Fenster trägt kein `required`**, sondern prüft über
			 * `pruefe` beim Bestätigen — der Weg ohne JavaScript braucht das Feld
			 * ohne Browserschranke. Für es greift deshalb nicht diese Zeile,
			 * sondern die Prüfung der Komponente; ein Drehbuch füllt und
			 * bestätigt selbst.
			 */
			const pflicht = [...fenster.querySelectorAll('[required]')];
			if (pflicht.some((f) => !String(f.value ?? '').trim())) continue;
			const frage = (fenster.querySelector('h2')?.textContent ?? '(ohne Frage)')
				.replace(/\s+/g, ' ')
				.trim();
			// @ts-ignore
			window.__rueckfragen.push(frage);
			ja.click();
		}
	};
	const start = () => {
		bestaetigen();
		new MutationObserver(bestaetigen).observe(document.body, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['open']
		});
	};
	if (document.body) start();
	else document.addEventListener('DOMContentLoaded', start);
}

/**
 * Auf einer Seite oder in einem ganzen Kontext jede Rückfrage bestätigen.
 *
 * Deckt zugleich die Browserabfrage ab (`confirm`, `alert`): Ohne einen
 * Zuhörer dafür weist Playwright sie ab, und dann schickt das Formular nicht.
 */
export async function rueckfragenBestaetigen(seiteOderKontext) {
	await seiteOderKontext.addInitScript(beobachter);
	seiteOderKontext.on('dialog', (d) => d.accept().catch(() => {}));
	// Für eine bereits geladene Seite wirkt `addInitScript` erst bei der
	// nächsten Navigation — deshalb hier zusätzlich sofort einhängen.
	if (typeof seiteOderKontext.evaluate === 'function') {
		await seiteOderKontext.evaluate(beobachter).catch(() => {});
	}
}

/** Welche Rückfragen auf dieser Seite bestätigt wurden. */
export async function gestellteRueckfragen(seite) {
	// @ts-ignore
	return await seite.evaluate(() => window.__rueckfragen ?? []).catch(() => []);
}
