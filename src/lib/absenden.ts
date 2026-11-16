import { applyAction } from '$app/forms';
import type { SubmitFunction } from '@sveltejs/kit';
import { tick } from 'svelte';

/**
 * Wie ein Formular abgeschickt wird, das die Seite nicht neu lädt.
 *
 * Die vier Regeln dahinter stehen bei `absenden()` weiter unten.
 */
export interface Absendeart {
	/**
	 * Ob das Formular bei Erfolg geleert wird. Vorgabe: ja, wie bei SvelteKit.
	 *
	 * `false` für Formulare, deren Felder den Bestand zeigen statt eine Eingabe
	 * zu sammeln — eine Tabelle fiele sonst auf die Werte zurück, die beim
	 * letzten Seitenaufbau darin standen, und verborgene Kennungen, die der
	 * Browser selbst gezeichnet hat, würden dabei leer.
	 */
	reset?: boolean;
	/**
	 * Ob das Formular bei einer **Absage** auf den geltenden Stand zurückfällt.
	 *
	 * Für Felder, die den Bestand zeigen und sich selbst abschicken — das
	 * Stellenfeld im Ablauf ist der Fall, für den es gebaut ist: Man tippt eine
	 * 3, der Server weist die Verschiebung ab, und danach steht im Feld eine 3,
	 * während der Punkt weiter an Stelle 5 steht. **Zwei Aussagen zum selben
	 * Ding auf einem Bildschirm**, und die falsche ist die, auf die man gerade
	 * geschaut hat (Bedienbarkeitsprüfung 05.09.2026, Befund 3 der
	 * Bewirtschaftersicht).
	 *
	 * Warum das nicht die Vorgabe ist: Bei einem Erfassungsformular wäre es
	 * genau verkehrt. Sagt die Absage «der Titel fehlt», muss der schon
	 * getippte Wortlaut stehen bleiben — sonst tippt man ihn ein zweites Mal.
	 * SvelteKit räumt bei einer Absage deshalb von sich aus nichts weg
	 * (Regel 1 unten), und das ist für die meisten Formulare richtig.
	 *
	 * Zurückgesetzt wird auf `defaultValue`, und der trägt bei einer Absage
	 * noch den Wert, den der Server zuletzt geliefert hat: Ein `fail()` lässt
	 * die geladenen Daten unberührt, nur `form` wechselt.
	 *
	 * **Eine Stelle tut dasselbe von Hand**: der Versandvermerk auf
	 * `versammlungen/[id]/vorbereitung` (seit dem Code-Review vom 02.09.2026).
	 * Sie ist hier nicht umgestellt, weil ihr `enhance` nach der Absage noch
	 * den Ereignisstrom nachzieht (`nach?.jetzt()`); das gehört in einen
	 * eigenen Arbeitsgang und nicht nebenbei in einen Befundblock. Wer dort
	 * etwas ändert, ändert es sinngemäss auch hier.
	 */
	zurueckBeiAbsage?: boolean;
	/**
	 * Meldet die laufende Marke und `null`, sobald die Antwort da ist.
	 *
	 * Für Handlungen, die spürbar dauern: Ohne sichtbaren Laufzustand sieht ein
	 * Klick aus wie nichts und wird ein zweites Mal gedrückt.
	 */
	laufend?: (marke: string | null) => void;
	/** Nur bei `result.type === 'success'`. */
	beiErfolg?: () => void;
	/**
	 * Nach jeder Antwort und **nach** dem Neuzeichnen.
	 *
	 * Erst hier steht die frisch geladene Seite im Baum. Was den neuen Stand
	 * messen oder anspringen will, gehört hierhin, nicht in `beiErfolg`.
	 *
	 * **Darf warten.** Wer hier selbst noch etwas an den Zustand schreibt und
	 * das Ergebnis danach im Baum sucht, braucht ein eigenes `await tick()`
	 * dazwischen — der Rückgabewert wird erwartet. Ohne das lief der Fall am
	 * 28.08.2026 auf: Die Einlasssichten setzen in `danach` `weggelegt = false`
	 * und rollen dann die gescannte Karte ins Bild. Die Karte hängt an genau
	 * diesem Zustand, stand im selben Zug also noch nicht im Baum, und
	 * `getElementById` lieferte `null` — lautlos, denn die Fachwirkung stimmte.
	 */
	danach?: () => void | Promise<void>;
	/**
	 * Wohin der Fokus danach gehört, wenn das nicht der gedrückte Knopf ist.
	 *
	 * Der Wert muss als `data-fokus` an einem Element der Seite stehen; sonst
	 * greift der Fokusgriff nicht.
	 */
	marke?: string;
}

/**
 * Was die Seite anzeigt, wenn die Antwort nicht lesbar war.
 *
 * **Nicht «Verbindung unterbrochen» allein.** Denselben Weg nimmt jede Antwort,
 * die sich nicht lesen lässt: ein Umkehrproxy, der eine eigene Fehlerseite
 * schickt, ein abgeschnittener Rumpf. Die abgelaufene Anmeldung gehörte bis
 * zum 27.08.2026 auch dazu; seither beantwortet der Haken eine abgefangene
 * Absendung mit einer Umleitung im Rumpf
 * (`$lib/server/absageantwort.ts`), und sie landet hier nicht mehr.
 *
 * Der Satz nennt deshalb, was bleibt, und einen Weg, der die Eingaben behält.
 */
export const AUSFALLTEXT =
	'Der Server hat nicht wie erwartet geantwortet, meist wegen einer unterbrochenen Verbindung. Die Eingaben stehen noch da; bitte nochmals abschicken.';

/**
 * Welche Handlungen gerade eine Antwort erwarten.
 *
 * Der Schlüssel muss **eine Zeile von der nächsten unterscheiden**, sonst
 * sperrt er nicht den zweiten Klick auf dieselbe Handlung, sondern die
 * Nachbarzeile. Über das Ziel allein gesperrt, wäre auf der Einheitenseite
 * jede zweite Zeile blockiert: Alle Entfernen-Knöpfe der Tabelle gehören
 * demselben Formular mit derselben Aktion. Wer «Entfernen» bei «Aufzug» und
 * gleich darauf bei «Heizung» drückt, bekäme beim zweiten Klick nichts — ohne
 * Meldung, ohne Ladezustand.
 *
 * Woran die Zeile hängt, ist von Seite zu Seite verschieden. Es gibt aber
 * **eine** Angabe, die sie überall benennt, und zwar dieselbe, die auch der
 * Server als Handlung liest: **Ziel, gedrückter Knopf und Nutzinhalt.**
 *
 *   * Auf der Einheitenseite unterscheidet der Knopf (`name`/`value`).
 *   * Auf den Einlasssichten unterscheidet ein verborgenes Feld: Jede Zeile
 *     hat ein eigenes `<form>` mit derselben Aktion, und der Knopf trägt gar
 *     keinen Namen.
 *   * Der Kartenscanner schickt sein Formular über `requestSubmit()` **ohne
 *     Absender** — kein Knopf, keine Marke. Nur der gescannte Code
 *     unterscheidet zwei Absendungen, und der steht im Nutzinhalt.
 *
 * **Warum nicht die Fokusmarke**, die für die ersten beiden Fälle gereicht
 * hätte: Sie ist zur Fokusrückgabe da, `Rueckfrage` führt sie als freiwillige
 * Eigenschaft (16 von 22 Verwendungen im Bestand geben sie nicht an), und die
 * Einheitenseite legt sie aus gutem Grund für mehrere Formulare auf denselben
 * Wert. Ein Sperrschlüssel, den eine Gestaltungsentscheidung vergröbert, sperrt
 * irgendwann die Nachbarzeile.
 */
const laufendeHandlungen = new Set<string>();

/**
 * Was ein Formular schickt, als vergleichbare Zeichenkette.
 *
 * Dateien bleiben draussen: Ihr Inhalt liesse sich nicht ohne Weiteres
 * vergleichen, und ein Formular, das ausser einer Datei nichts trägt, fällt
 * damit auf Ziel und Knopf zurück — also auf die gröbere, strengere Sperre.
 *
 * Sortiert, weil die Reihenfolge aus dem Baum kommt und sich beim Umbau einer
 * Maske ändern kann, ohne dass sich die Handlung ändert.
 *
 * **Was damit im Speicher liegt.** Der Schlüssel trägt alles, was das Formular
 * schickt — heute auch den gescannten Zugangscode einer Versammlung. Er lebt
 * genau so lange wie die Absendung und wird danach gelöscht, auch bei einem
 * Abbruch (siehe `freigeben` unten); geschrieben, übertragen oder protokolliert
 * wird er nicht. **Wer eine Seite mit einem Zugangsschlüssel umstellt** — auf
 * `betreiber/dienste` steht einer im Formular —, sollte das trotzdem wissen:
 * Ein Geheimnis in einer modulweiten Menge ist ein Ort, an dem es niemand
 * vermutet.
 */
function nutzlast(daten: FormData): string {
	const teile: string[] = [];
	for (const [name, wert] of daten) if (typeof wert === 'string') teile.push(`${name}=${wert}`);
	return teile.sort().join('&');
}

/**
 * Läuft gerade eine Absendung, deren Antwort schon da ist?
 *
 * Gedacht für `Meldung.svelte`: Eine Absage soll sich ins Bild holen, **wenn
 * sie ohne Seitenwechsel erschienen ist**. Am Baustein selbst ist dieser
 * Unterschied nicht zu sehen — er wird mit der Meldung erzeugt, ob die Seite
 * nun frisch geladen wurde oder nicht. Hier ist er bekannt.
 *
 * Das Fenster deckt genau das Neuzeichnen ab: geöffnet vor `update()`,
 * geschlossen nach `tick()`. Die Effekte der Meldung laufen dazwischen.
 *
 * **Gezählt, nicht geschaltet.** Zwei Absendungen an verschiedene Aktionen
 * dürfen nebeneinander laufen; ein blosser Schalter hätte das Fenster der
 * einen geschlossen, während die andere noch zwischen `update()` und `tick()`
 * hing, und deren Absage wäre unterhalb des Bildrands stehen geblieben.
 */
let offeneAbsendungen = 0;

/**
 * **Wie viele Fokusketten bisher gestartet wurden.** Der Zähler steigt nur
 * dort, wo wirklich eine Kette beginnt, nicht bei jeder Antwort. Eine Kette prüft bei
 * jedem Takt, ob sie noch die jüngste ist, und hört sonst auf.
 *
 * Ohne diesen Zähler überlebt eine Kette ihre Absendung: Trifft ihr Griff den
 * eigenen Knopf (der Normalfall, wenn der Knopf das Neuzeichnen übersteht),
 * ist der Fokus weder fremd noch herrenlos, und sie tickt die vollen zehn
 * Sekunden scharf weiter. Setzt SvelteKit in dieser Zeit für eine **andere**
 * Absendung den Fokus auf `<body>`, greift die alte Kette und zieht ihn auf
 * ihren alten Knopf zurück, samt Rollen. Die neue Absendung sieht dann einen
 * fremden Fokus und tut ihrerseits gar nichts mehr.
 */
let ketteLauf = 0;
export function geradeAbgesendet(): boolean {
	return offeneAbsendungen > 0;
}

/**
 * Ein schreibendes Formular abschicken, **ohne die Seite neu zu laden**.
 *
 * ## Warum es diesen Baustein gibt
 *
 * Auftraggeber, 25.08. und 27.08.2026: «Wenn ich bei ‹Alle Parteien› auf ‹Code
 * ausgeben› klicke, springt der Browser ganz nach oben. Er soll dort bleiben wo
 * er ist» und «Wichtig wäre, wenn man speichert die Seite nicht Top springt.»
 *
 * Nachgemessen am 27.08.2026 an der Einheitenseite: ohne `use:enhance`
 * Neuaufbau der Seite und Sprung von 615 px auf 0, mit `use:enhance` kein
 * Sprung und kein Neuaufbau.
 *
 * ## Stand der Ablösung
 *
 * Abgelöst sind (28.08.2026) die Einheitenseite, `Einlass.svelte`,
 * `tage/einlass`, `versammlungen/einlass`, `versammlungen/anwesenheit`, die
 * Traktandenseite mit `TraktandumFormular` und `Anhaenge.svelte`, dazu die
 * Bausteine `Wandbild`, `Pausenschalter`, `Ergebnisnachgang`, `Eingriffe`,
 * `Stimmerfassung` und `TraktandumAufnehmen`, dazu die Sitzungsleitungssicht
 * `versammlungen/[id]/leitung` (18 Formulare) und `tage/[id]/leitung` (16).
 * **Gezählt ist das nach Fabriken, nicht nach Seiten**: `Einlass.svelte` steht
 * auf fünf Seiten, also auch auf `tage/leitung` und `versammlungen/leitung`,
 * und auf jeder dieser Seiten tragen weiterhin Formulare **ohne** `enhance` —
 * auf `versammlungen/anwesenheit` acht von zwölf. Wer «abgelöst» als «die Seite
 * springt nicht mehr» liest, liest zu viel.
 *
 * Entschieden ist damit die Namensfrage: Die Fokusmarke heisst überall
 * `data-fokus`, `Rueckfrage.svelte` gibt sie so aus, und
 * `scripts/check-fokusmarke.mjs` weist ein `data-marke` ab.
 *
 * **Offen bleiben zwei Stellen**, beide mit eigenem Grund:
 *
 *   * `betreiber/dienste` führt `laufend` als `boolean`, hier ist es ein
 *     Rückruf. Von den **zehn** Aufrufstellen dort geben nur zwei `laufend` an;
 *     die anderen acht sind ein `absenden()`. Ihr dritter Fokusgriff
 *     (`querySelector('.meldung')?.focus()`) läuft ohnehin leer — ein `<p>`
 *     ohne `tabindex` nimmt keinen Fokus an, und das `tabindex="-1"`, das ein
 *     Kommentar dort behauptet, steht nirgends.
 *   * `tage/geschaefte` trägt zwei eingebaute Rückrufe, die wörtlich
 *     `absenden({ reset: false })` sind. Beide Formulare sind verborgen und
 *     werden über `requestSubmit()` ohne Absender abgeschickt: Sie hängen also
 *     ganz am Nutzinhalt im Sperrschlüssel, und das gehört vor dem Umzug im
 *     Browser gemessen.
 *
 * ## Die vier Regeln
 *
 * 1. **`update()` leert nur bei Erfolg.** SvelteKit ruft
 *    `HTMLFormElement.prototype.reset()` ausschliesslich bei
 *    `result.type === 'success'` (`runtime/app/forms.js`, Zeilen 99 bis 105,
 *    nachgelesen) — eine Absage behält das Getippte also von selbst. Ob bei
 *    Erfolg geleert werden **soll**, ist eine Entscheidung je Formular:
 *    Ein Erfassungsformular muss leer sein für den nächsten Eintrag, eine
 *    Tabelle mit hundert Feldern darf nicht auf ihre Anfangswerte
 *    zurückfallen. Deshalb `reset`.
 *
 * 2. **Der Fokus kommt zurück.** SvelteKit setzt ihn bei Erfolg auf `<body>`
 *    (`reset_focus(page.url)` in `client.js`, nur im Erfolgszweig). Wer die
 *    Liste mit der Tastatur bedient, tabbt sich danach von vorn durch die ganze
 *    Seite. Zwei Griffe: die Handlung selbst, sonst eine andere Handlung
 *    desselben Gegenstands. Der zweite ist eine Vermutung und darf deshalb die
 *    Ansicht nicht verschieben — ein Baustein, der das Springen abschaffen
 *    soll, darf nicht selbst rollen.
 *
 * 3. **Aber nur, wenn der Fokus herrenlos ist.** Ein Anruf an einen äusseren
 *    Dienst darf bis zur eingestellten Geduld dauern. Wer inzwischen ein
 *    anderes Feld öffnet und tippt, bekäme ihn sonst mitten im Satz weggerissen.
 *    Bei einer **Absage** rührt SvelteKit den Fokus gar nicht an; steht er
 *    noch auf dem Knopf, also am richtigen Ort, geschieht hier nichts. Ist er
 *    trotzdem herrenlos, weil der Knopf mit der Antwort aus dem Baum fiel,
 *    greift der einmalige Griff samt einem Nachschlag; die Nachfass-Kette
 *    bleibt dem Erfolgsfall vorbehalten.
 *
 * 4. **Zwei Klicks sind ein Klick.** Ohne Navigation verschluckt der Browser
 *    den zweiten nicht mehr. Zwei Antworten auf dieselbe Aktion kommen in
 *    unbestimmter Reihenfolge zurück, und die zweite malt den Stand vor der
 *    ersten — `applyAction` hat, anders als das Nachladen, keinen Schutz
 *    dagegen (`client.js`, `_invalidate` prüft ein Token, `applyAction` nicht).
 *    Solange eine Aktion läuft, wird dieselbe Aktion abgewiesen (`cancel()`).
 *
 * ## Und was geschieht, wenn gar keine brauchbare Antwort kommt
 *
 * `enhance` liefert dann `{ type: 'error' }`, und zwar auf **zwei** Wegen: Der
 * Server hat mit einem Fehlerstatus geantwortet (dann trägt `result.status`
 * ihn), oder der Rumpf war nicht lesbar (dann nicht). Beides ist verschieden zu
 * behandeln:
 *
 *   * **Mit Status** — etwa `error(401, 'Nicht angemeldet')`, das in jeder
 *     Aktion dieser Anwendung ganz oben steht — geht die Antwort den
 *     gewöhnlichen Weg von SvelteKit und landet auf der Fehlerseite. Sie sagt,
 *     was los ist; ein freundlicher Satz an ihrer Stelle verschwiege es.
 *   * **Ohne Status** bleibt die Seite stehen und zeigt `AUSFALLTEXT`. Das
 *     Getippte ist dann noch da, und ein `applyAction({type:'error'})` hätte
 *     es weggeworfen: SvelteKit ersetzt dabei die **ganze Seite** durch die
 *     nächste `+error.svelte`.
 *
 * ## Wo die Marke steht
 *
 * `data-fokus` sitzt an dem Element, das den Fokus danach tragen soll — meist
 * am Absendeknopf selbst, bei einem Erfassungsformular am ersten Feld (dann
 * nennt `art.marke` die Marke, weil der Knopf nicht das Ziel ist).
 *
 * ```svelte
 * <form method="POST" action="?/anlegen" use:enhance={absenden({ marke: 'anlegen' })}>
 *   <input name="label" data-fokus="anlegen" required />
 *   <button type="submit">Hinzufügen</button>
 * </form>
 * ```
 */
export function absenden(art: Absendeart = {}): SubmitFunction {
	return ({ cancel, action, controller, formData, submitter, formElement }) => {
		const knopf =
			submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
				? submitter
				: null;
		const marke = art.marke ?? knopf?.dataset.fokus ?? '';
		const handlung = `${action.href}\n${knopf?.name ?? ''}=${knopf?.value ?? ''}\n${nutzlast(formData)}`;
		if (laufendeHandlungen.has(handlung)) {
			cancel();
			return;
		}
		laufendeHandlungen.add(handlung);
		/*
		 * **Auch ein Abbruch gibt frei.** SvelteKit ruft den Antwortrückruf bei
		 * `AbortError` gar nicht auf (`runtime/app/forms.js`, Zeile 203:
		 * `if (error?.name === 'AbortError') return;`), das `finally` unten liefe
		 * dann nie. Der Schlüssel bliebe für die Lebensdauer der Seite stehen —
		 * und weil die Anwendung clientseitig navigiert, überlebt er jeden
		 * Seitenwechsel: Die Handlung wäre dauerhaft tot, jeder weitere Klick
		 * endete in `cancel()`, ohne Meldung und ohne Ladezustand.
		 *
		 * Heute ruft niemand `controller.abort()`, der Fall ist also vorsorglich.
		 * Seit der Schlüssel den Nutzinhalt trägt, hinge daran aber auch eine
		 * Kopie des gescannten Zugangscodes; ein Eintrag, der nie verfällt, ist
		 * der falsche Ort dafür.
		 *
		 * `freigeben` ist mit Absicht idempotent: Ein Abbruch nach der Antwort
		 * dürfte sonst die Sperre einer **anderen**, gleichartigen Absendung
		 * löschen, die inzwischen läuft.
		 */
		let freigegeben = false;
		const freigeben = () => {
			if (freigegeben) return;
			freigegeben = true;
			laufendeHandlungen.delete(handlung);
		};
		controller.signal.addEventListener('abort', freigeben, { once: true });

		art.laufend?.(marke);

		return async ({ update, result }) => {
			offeneAbsendungen += 1;
			try {
				if (result.type === 'error' && typeof result.status !== 'number') {
					await applyAction({
						type: 'failure',
						status: 500,
						data: { fehler: { nachricht: AUSFALLTEXT } }
					});
				} else if (result.type === 'error') {
					await applyAction(result);
				} else {
					await update({ reset: art.reset ?? true });
				}
				/*
				 * **Der abgelehnte Wert darf nicht stehen bleiben.** `update()`
				 * leert nur bei Erfolg; nach einer Absage zeigt ein Bestandsfeld
				 * sonst weiter, was gerade abgewiesen wurde. `reset()` stellt den
				 * `defaultValue` her, also den zuletzt vom Server gelieferten Stand.
				 */
				/*
				 * **Auch der statuslose Fehler ist eine Absage.** Der Zweig ganz
				 * oben baut aus einer unlesbaren Antwort selbst eine (`AUSFALLTEXT`);
				 * `result.type` bleibt dabei `'error'`. Ohne diesen Fall zeigte das
				 * Stellenfeld nach einem Verbindungsabbruch weiter die abgewiesene
				 * Zahl, während der Punkt an seiner alten Stelle steht — genau der
				 * Zustand, den die Einstellung verhindern soll.
				 */
				if (art.zurueckBeiAbsage && result.type !== 'success' && result.type !== 'redirect')
					formElement.reset();
				/*
				 * **Nach einer Umleitung ist die Seite eine andere.** `update()` hat
				 * dann schon navigiert; ein Rückruf, der Komponentenzustand setzt,
				 * und ein Fokusgriff über `[data-fokus]` fänden die Elemente der
				 * **Zielseite** und nähmen ihr den Ankerfokus weg.
				 */
				if (result.type === 'redirect') return;
				if (result.type === 'success') art.beiErfolg?.();
				await tick();
				await art.danach?.();
				/*
				 * **Regel 3: Nur zurückholen, wenn der Fokus herrenlos ist**, aber
				 * «herrenlos» und «noch bei uns» sind zu unterscheiden (21.09.2026).
				 *
				 * `update()` stösst ein `invalidateAll()` an; der neue Stand kommt
				 * unter Last erst Sekunden später, und der Fokus steht solange noch
				 * auf dem Knopf, den es danach nicht mehr gibt. Wer nur auf
				 * `<body>` prüft, tut in dieser Zeit nichts und lässt den Fokus
				 * danach auf `<body>` fallen.
				 *
				 * **Der erste Griff kann den eigenen Knopf treffen, und das ist
				 * kein Erfolg.** Im Durchstich unter Last gemessen (die
				 * Diagnose lief mit): Der exakte Treffer war die
				 * Marke des Absendeknopfs selbst; er fiel mit der Antwort aus dem
				 * Baum, der Fokus ging mit ihm, und danach kam niemand mehr. Die
				 * Zielmarke erschien 5,9 Sekunden später und blieb unfokussiert.
				 *
				 * Deshalb: erst synchron greifen, dann per Intervall nachfassen,
				 * solange der Fokus nirgends oder auf unserem Knopf steht. Die Kette
				 * endet, sobald jemand selbst einen Fokus gesetzt hat (Regel 3),
				 * und gibt nach rund zehn Sekunden auf.
				 *
				 * **Ein Intervall, kein `requestAnimationFrame`:** Für Seiten im
				 * Hintergrund gilt rAF als pausiert, und die Leitungssicht ist im
				 * Drehbuch nicht immer die vordere Seite.
				 */
				const fremderFokus = (): boolean => {
					const a = document.activeElement;
					return a !== null && a !== document.body && a !== knopf && document.contains(a);
				};
				const herrenlos = (): boolean => {
					const a = document.activeElement;
					return a === null || a === document.body || !document.contains(a);
				};
				/*
				 * **Vier Schranken, und jede hat einen gemessenen Grund.**
				 *
				 * 1. **Nur nach einem Erfolg.** Bei einer Absage rührt
				 *    SvelteKit den Fokus nicht an; er steht dann auf dem
				 *    Knopf, also am richtigen Ort (Regel 3 oben). Eine Kette
				 *    risse ihn von dort weg aufs Zielfeld, bei Formularen mit
				 *    eigener `art.marke` sogar mit Rollen. Für den Fall, dass
				 *    er trotzdem herrenlos ist, bleibt der einmalige Griff.
				 * 2. **Nur die jüngste Kette.** Siehe `ketteLauf` oben.
				 * 3. **Nur auf der Seite, auf der sie begann.** Sie läuft bis
				 *    zu zehn Sekunden; wer weiterblättert, bekäme den Fokus
				 *    sonst auf der Folgeseite zugeteilt, mitten im Lesen.
				 *    `beforeNavigate` braucht einen Komponentenkontext, den
				 *    diese Funktion nicht hat, deshalb der Pfadvergleich.
				 *    **Er sieht einen Wechsel von Abfrageteil oder Fragment
				 *    nicht**, und eine Komponente, die ohne Navigation
				 *    verschwindet (ein Dialog), auch nicht; dort läuft die
				 *    Kette bis zum Zähler aus, ohne Schaden, weil sie nur
				 *    greift, wenn der Fokus herrenlos ist.
				 * 4. **Nur mit Marke.** Ohne sie kehrt
				 *    `holeDenFokusZurueck` sofort zurück, und die Kette
				 *    tickte hundertmal ins Leere; die Mehrzahl der
				 *    Rückfragen gibt keine Marke an.
				 */
				const seiteBeimStart = location.pathname;
				if (result.type === 'success' && marke && !fremderFokus()) {
					/*
					 * **Der Zähler steigt hier, nicht weiter oben.** Stand er
					 * vor dem `if`, zählte er Antworten statt Ketten: Ein
					 * Formular ohne Marke (der Kartenscanner schickt über
					 * `requestSubmit()` ohne Absender) startete keine eigene
					 * Kette, setzte den Zähler aber hoch und brach damit eine
					 * laufende fremde Kette ab. Danach fasste niemand mehr
					 * nach, und der Fokus blieb auf `<body>`, also genau der
					 * Zustand, gegen den dieser Block gebaut ist.
					 */
					const meineKette = ++ketteLauf;
					holeDenFokusZurueck(marke);
					let rest = 100; // rund zehn Sekunden
					const frist = setInterval(() => {
						if (meineKette !== ketteLauf) return clearInterval(frist);
						if (location.pathname !== seiteBeimStart) return clearInterval(frist);
						if (fremderFokus()) return clearInterval(frist);
						if (herrenlos()) holeDenFokusZurueck(marke);
						if (--rest <= 0) clearInterval(frist);
					}, 100);
				} else if (herrenlos()) {
					/*
					 * **Absage oder ohne Marke: der einmalige Griff und ein
					 * Nachschlag, wie vorher.** Der Verzug aus `invalidateAll()`
					 * trifft die Absage genauso, `update()` läuft auch für
					 * `failure`. Fällt der gedrückte Knopf dabei aus dem Baum
					 * (die Zeile verschwindet, das Formular klappt zu), steht
					 * die Marke im ersten Anlauf noch nicht da. Die Kette wäre
					 * hier zu viel, ein zweiter Anlauf reicht; ihn ersatzlos zu
					 * streichen wäre ein Rückschritt gegenüber dem Stand vor
					 * diesem Block.
					 */
					holeDenFokusZurueck(marke);
					requestAnimationFrame(() => {
						if (herrenlos()) holeDenFokusZurueck(marke);
					});
				}
			} finally {
				offeneAbsendungen -= 1;
				freigeben();
				art.laufend?.(null);
			}
		};
	};
}

/**
 * Der Fokus zurück an die Handlung, von der er kam.
 *
 * **Verschwindet die Handlung dabei** — der Pfeil nach oben an der Stufe, die
 * gerade nach oben gerückt ist —, übernimmt eine andere Handlung desselben
 * Gegenstands. Die Marke ist dafür zweiteilig aufgebaut: `handlung:gegenstand`,
 * und der Gegenstand ist alles nach dem ersten Doppelpunkt.
 *
 * **Zum genauen Treffer wird gerollt, zum Ersatz nicht.** Beim genauen Treffer
 * wäre `preventScroll` falsch herum: Ein Fokus, den niemand sieht, ist für die
 * Tastaturbedienung schlimmer als eine kleine Bewegung, und im Normalfall steht
 * er ohnehin im Bild — es ist der eben gedrückte Knopf. Der Ersatz dagegen ist
 * eine Vermutung; steht er ausserhalb, geschieht gar nichts (Begründung unten
 * bei der Stelle).
 *
 * **Einen dritten Griff auf die Meldung gibt es hier nicht.** In
 * `betreiber/dienste` steht er als `querySelector('.meldung')?.focus()` und
 * läuft still leer: Ein `<p>` ohne `tabindex` nimmt keinen Fokus an. Er gehört
 * mit der Ablösung jener Seite gestrichen. Statt ihn zum Laufen zu
 * bringen, holt `Meldung.svelte` eine Absage selbst ins Bild — dort ist ohne
 * Suche bekannt, **welche** Meldung neu ist, und `role="alert"` sagt sie
 * ohnehin an; ein Fokus obendrauf liest sie ein zweites Mal vor.
 */
function holeDenFokusZurueck(marke: string): boolean {
	if (marke === '') return true;
	const kandidaten = Array.from(document.querySelectorAll<HTMLElement>('[data-fokus]'));
	/*
	 * Verglichen statt in einen Selektor eingesetzt: Eine Marke trägt Kennungen
	 * und Doppelpunkte, und `querySelector` mit eingesetztem Wert bricht an
	 * jedem Anführungszeichen darin.
	 */
	const genau = kandidaten.find((k) => k.dataset.fokus === marke);
	if (genau) {
		fokussiere(genau);
		return true;
	}
	const trenner = marke.indexOf(':');
	if (trenner < 0) return false;
	const gegenstand = marke.slice(trenner + 1);
	const nachbar = kandidaten.find((k) => k.dataset.fokus?.endsWith(`:${gegenstand}`));
	/*
	 * **Der Ersatz darf die Ansicht nicht verschieben.** Steht er ausserhalb
	 * des Bildes, geschieht gar nichts.
	 *
	 * Am 28.08.2026 gemessen, nachdem `Einlass.svelte` auf diesen Baustein
	 * umzog: Der Kasten «Am Eingang» steht auf der Anwesenheitsseite bei 440 px,
	 * die Ständetabelle ab 871 px. Nach «Freigeben» verschwindet die wartende
	 * Zeile, `frei:<partei>` gibt es nicht mehr, und der Ersatz ist
	 * `code:<partei>` **in der Tabelle**. Das ist derselbe Gegenstand und
	 * trotzdem der falsche Ort: Die Seite rollte weg von dem Kasten, in dem die
	 * nächste wartende Person steht, ausgerechnet der Baustein, der das
	 * Springen abschaffen soll.
	 *
	 * Beim genauen Treffer ist es umgekehrt richtig: Das ist die Handlung
	 * selbst, und ein Fokus, den niemand sieht, ist für die Tastaturbedienung
	 * schlimmer als eine kleine Bewegung.
	 */
	if (nachbar && imBild(nachbar)) {
		nachbar.focus({ preventScroll: true });
		return true;
	}
	/*
	 * **`false` heisst «nichts gefunden», nicht «nichts getan».** Steht der
	 * Ersatz ausserhalb des Bildes, geschieht mit Absicht nichts, und ein
	 * weiterer Griff der Kette fände ihn genauso ausserhalb.
	 *
	 * **Den Rückgabewert liest seit dem 22.09.2026 niemand mehr.** Vorher
	 * hing an ihm der zweite Anlauf (`&& !holeDenFokusZurueck(marke)`); jetzt
	 * entscheidet die Kette allein am Fokuszustand, ob sie weitermacht. Der
	 * Wert bleibt, weil er beschreibt, was geschehen ist, und weil ein
	 * künftiger Aufrufer ihn brauchen kann. Wer ihn auswertet, sollte den
	 * Fall oben kennen: Ein `false` kann heissen «nichts da» oder «da, aber
	 * absichtlich nicht angesprungen».
	 */
	return false;
}

function fokussiere(ziel: HTMLElement): void {
	ziel.focus({ preventScroll: imBild(ziel) });
}

function imBild(ziel: HTMLElement): boolean {
	const r = ziel.getBoundingClientRect();
	return r.top >= 0 && r.bottom <= window.innerHeight;
}
