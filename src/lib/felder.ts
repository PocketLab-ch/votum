/**
 * Der Anfangswert eines Eingabefelds — richtig auf beiden Seiten.
 *
 * **Zwei Fehler, die einander ausschliessen.** Beide sind in diesem Projekt
 * aufgetreten, beide haben Daten still verfälscht:
 *
 *   * **`value={…}` ist in Svelte 5 reaktiv.** Bei jedem Neuzeichnen — und bei
 *     der Hydration — setzt Svelte den DOM-Wert erneut auf den Ausdruck und
 *     überschreibt, was der Benutzer getippt hat. Am 30.07.2026 konnte sich
 *     deshalb niemand mehr anmelden: Der Server bekam `username=` leer, weil
 *     genau dieses Feld ein `value={form?.username ?? ''}` trug.
 *
 *   * **`defaultValue={…}` erscheint nicht im ausgelieferten HTML.**
 *     Nachgemessen am 11.08.2026: Auf der Versammlungsseite kamen `ort`,
 *     `uhrzeit` und die Radios der Abstimmungsweise ohne Wert heraus, während
 *     `datum` daneben einen hatte. Ohne JavaScript ist das Formular leer, und
 *     im Fenster vor der Hydration (gemessen 47 ms) überschreibt Svelte einen
 *     Klick mit dem alten Wert — gespeichert wurde «geführt», obwohl «einfach»
 *     angekreuzt war. Ohne Meldung, ohne Spur.
 *
 * **Die Lösung nimmt von beidem das Richtige.** Beim Rendern auf dem Server
 * wird `value` gesetzt — dann steht der Wert im HTML. Im Browser wird
 * `defaultValue` gesetzt — dann rührt Svelte das Feld nie wieder an, weder bei
 * der Hydration (der Wert steht ja schon im DOM) noch beim Neuzeichnen.
 *
 * ```svelte
 * <input name="ort" {...anfangswert(werte.ort)} required />
 * <input type="radio" name="art" value="ordentlich" {...angekreuzt(art === 'ordentlich')} />
 * ```
 *
 * **Nicht für Felder, deren Wert das Programm führt.** Wo JavaScript den Wert
 * liest oder setzt, gehört `bind:value` mit `$state` hin — etwa ein Suchfeld,
 * das beim Tippen filtert. Dort ist der Anfangswert ohnehin leer.
 *
 * **Ein `<select>` ist die Ausnahme von dieser Ausnahme.** Auch wenn sein Wert
 * die Anzeige treibt, verträgt es kein `bind:value` — die Begründung steht
 * unten bei `gefuehrteWahl`.
 *
 * **Und ein `<details>` ist derselbe Fall ohne Eingabefeld.** Was der Benutzer
 * vor der Hydration aufklappt, schreibt Svelte beim Aufbau zurück — siehe
 * `aufgeklappt` weiter unten.
 */
import { browser } from '$app/environment';
import { createAttachmentKey, type Attachment } from 'svelte/attachments';

/**
 * Anfangswert eines Text-, Zahlen-, Datums- oder Zeitfelds.
 *
 * Nimmt auch `FormDataEntryValue`: Nach einem abgewiesenen Formular kommen die
 * Eingaben als `Object.fromEntries(daten)` zurück, und dessen Werte sind für
 * TypeScript `string | File`. Eine **Datei** als Anfangswert eines Textfelds
 * ergibt nichts — sie wird zu einer leeren Zeichenkette, statt «[object File]»
 * ins Feld zu schreiben.
 */
export function anfangswert(
	wert: string | number | FormDataEntryValue | null | undefined
): Record<string, unknown> {
	const w = wert == null || typeof wert === 'object' ? '' : wert;
	return browser ? { defaultValue: w } : { value: w };
}

/** Anfangszustand eines Auswahl- oder Ankreuzfelds. */
export function angekreuzt(an: boolean): Record<string, unknown> {
	return browser ? { defaultChecked: an } : { checked: an };
}

/**
 * Die Marke am ausgelieferten Ausklapper — siehe `aufgeklappt`.
 *
 * Sie steht **nur** im HTML vom Server, trägt dessen Antwort (`offen` oder
 * `zu`) und wird beim ersten Lauf im Browser verbraucht. Ihr Zweck ist die
 * Antwort auf zwei Fragen, die man dem Knoten sonst nicht ansieht: Hat der
 * Server diesen Kasten überhaupt geliefert — und wenn ja, wusste er dasselbe
 * wie der Browser?
 */
const AUSGELIEFERT = 'data-ausgeliefert';

/** Der Schlüssel, unter dem die Handlung unten im Spread mitreist. */
const AUFKLAPPEN = createAttachmentKey();

/**
 * Die eine Entscheidung im Browser — als Tabelle gelesen:
 *
 * | Marke | Server sagte | Browser sagt | Was geschieht |
 * |---|---|---|---|
 * | da | zu | zu | nichts — im DOM steht die Wahrheit, samt Klick des Benutzers |
 * | da | offen | offen | nichts — dasselbe, in der anderen Richtung |
 * | da | zu | **offen** | aufklappen: Der Browser weiss mehr (ein Sprungziel) |
 * | da | offen | zu | nichts — zugeklappt wird nur vom Benutzer |
 * | keine | — | offen | aufklappen: Der Browser hat den Kasten selbst gebaut |
 * | keine | — | zu | nichts |
 *
 * **Die dritte Zeile ist die, die im Code-Review gefehlt hat** (26.08.2026).
 * Ein URL-Fragment erreicht den Server nie: `page.url.hash` ist beim Rendern
 * dort immer leer. Eine Fassung, die jeden ausgelieferten Kasten in Ruhe lässt,
 * hätte `/versammlungen/<id>#anzeigecode` beim Neuladen zugeklappt gelassen —
 * und genau dafür gibt es das Sprungziel.
 */
function klappe(knoten: HTMLDetailsElement, offen: boolean) {
	const geliefert = knoten.getAttribute(AUSGELIEFERT);
	if (geliefert !== null) {
		knoten.removeAttribute(AUSGELIEFERT);
		if ((geliefert === 'offen') === offen) return;
	}
	if (offen) knoten.open = true;
}

/** Die zwei festen Handlungen — feste Grössen, damit nichts umsonst neu läuft. */
function aufklappen(knoten: HTMLDetailsElement) {
	klappe(knoten, true);
}

function zulassen(knoten: HTMLDetailsElement) {
	klappe(knoten, false);
}

/**
 * Was `aufgeklappt()` auf ein `<details>` streut.
 *
 * **Die Symbol-Spalte muss stehen.** Svelte prüft den Wert unter einem
 * Symbol-Schlüssel gegen `Attachment`; mit `Record<string | symbol, unknown>`
 * meldete `svelte-check` genau dort «'symbol' index signatures are
 * incompatible» — und zwar nur an dem einen Tag, an dem der Spread allein
 * steht.
 */
type Ausklapperspread = {
	[name: string]: unknown;
	[marke: symbol]: Attachment<HTMLDetailsElement>;
};

/**
 * Der Anfangszustand eines Ausklappers (`<details>`) — **nicht sein Dauerwert**.
 *
 * ## Die Falle, gemessen am 26.08.2026
 *
 * `open={…}` ist ein gewöhnliches Attribut, und Svelte setzt es bei der
 * Hydration erneut. Es merkt sich zwar den vorgefundenen Wert (`set_attribute`
 * in `svelte/internal/client`: `attributes[attribute] =
 * element.getAttribute(attribute)`), vergleicht ihn aber mit dem Ausdruck — und
 * `''` (der Browser hat den Kasten aufgeklappt) ist nicht `false` (der Server
 * sagte «zu»). Also schreibt Svelte `element.open = false`, und der Kasten
 * klappt zu.
 *
 * Wer das `<summary>` anklickt, bevor das Skript geladen ist, sieht den Kasten
 * **vor seinen Augen wieder zugehen**. Gemessen mit angehaltenem Skript
 * (`e2e/ausklapper-vor-hydration.mjs`): geklickt, aufgeklappt, nach der
 * Hydration zu. Im Betrieb ist das Fenster rund 200 ms lang; im Saal, auf einem
 * fremden Telefon über fremdes Netz, ist es der Normalfall.
 *
 * **`bind:open` ist dieselbe Falle, nur ohne Bremse**: `bind_property` schreibt
 * `element.open = get()` in einem `render_effect`, ohne jede Prüfung.
 *
 * Es ist dieselbe Fehlerklasse wie `value={…}` am Textfeld und `bind:value` am
 * `<select>` — eine Ebene weiter. Und die Antwort ist dieselbe: **Im Browser
 * führt der Browser das Feld.**
 *
 * ## Der Weg stattdessen
 *
 * ```svelte
 * <details class="berichtigen" {...aufgeklappt(form?.fehler?.feld === 'name')}>
 *   <summary>Angaben berichtigen</summary>
 *   …
 * </details>
 * ```
 *
 * Auf dem **Server** steht `open` im ausgelieferten HTML — der Kasten wirkt
 * damit auch ohne JavaScript, und das ist die Stelle, an der er üblicherweise
 * aufgeht (eine Absage des Servers, ein Zustand aus `data`).
 *
 * Im **Browser** hängt statt des Attributs eine Handlung am Knoten, und sie
 * greift nur ein, wo sie **mehr weiss als der Server** — die Tabelle dazu steht
 * oben bei `klappe`. In Worten:
 *
 *   * **Sagen Server und Browser dasselbe, fasst sie nichts an.** Im DOM steht
 *     dann schon, was gilt — einschliesslich eines Klicks aus dem Fenster vor
 *     der Hydration, in beide Richtungen. Erkennbar ist das an der Marke
 *     `data-ausgeliefert`, die nur der Server setzt und die der erste Lauf
 *     verbraucht.
 *   * **Weiss der Browser mehr, klappt sie auf.** Das ist der Sprung auf ein
 *     `#ziel`: Ein URL-Fragment erreicht den Server nie, seine Antwort ist dort
 *     zwangsläufig «zu».
 *   * **Was der Browser selbst gebaut hat, klappt sie nach dem Ausdruck auf.**
 *     Das ist der Normalfall bei einer Wanderung über Verweise: SvelteKit baut
 *     die Seite dann im Browser, und ohne diesen Teil ginge ein Kasten nie mehr
 *     auf, den der Zustand verlangt.
 *   * **Sie klappt nie zu.** Zumachen ist die Entscheidung des Benutzers. Fällt
 *     der Ausdruck später auf `false`, bleibt der Kasten offen — das ist
 *     Absicht und der Grund, warum die Sache «Anfangszustand» heisst.
 *
 * Weil beide Handlungen feste Grössen sind, läuft nichts erneut, solange sich
 * der Ausdruck nicht ändert: Svelte vergleicht die Handlung mit der vorigen
 * (`n !== prev[symbol]` in `set_attributes`). Ein Neuzeichnen klappt also
 * keinen Kasten wieder auf, den jemand gerade zugemacht hat.
 *
 * **Braucht auch das Programm den Zustand**, gilt dasselbe wie bei
 * `gefuehrteWahl`: Der Browser führt, das Programm erfährt — über `ontoggle`,
 * nicht über eine Bindung. Im Bestand gibt es heute keine solche Stelle.
 *
 * Der Wächter `versammlung/gefuehrter-ausklapper` hält den Weg zurück offen —
 * bis auf zwei Schreibweisen, die dort benannt sind und die es im Bestand nicht
 * gibt.
 */
export function aufgeklappt(offen: boolean): Ausklapperspread {
	if (!browser) return { open: offen, [AUSGELIEFERT]: offen ? 'offen' : 'zu' };
	return { [AUFKLAPPEN]: offen ? aufklappen : zulassen };
}

/**
 * Ein `<select>`, dessen Wert auch das Programm braucht — **ohne
 * `bind:value`**.
 *
 * ## Die Falle, gemessen am 26.08.2026
 *
 * `bind:value` am `<select>` ist dieselbe Falle wie `value={…}` am Textfeld,
 * eine Ebene weiter: Svelte schreibt beim Aufbau den gebundenen Wert in das
 * Feld zurück. Wer wählt, bevor das Skript geladen ist — im Saal auf einem
 * fremden Telefon der Normalfall, nicht der Ausreisser —, verliert seine Wahl
 * wortlos. Gemessen mit angehaltenem Skript (`e2e/wahl-vor-hydration.mjs`):
 * «eine andere Gemeinschaft» gewählt, nach der Hydration stand «natürliche
 * Person» da, und die Anzeige darunter zeigte den falschen Zustand.
 *
 * ## Der Weg stattdessen
 *
 * Im Browser führt der Browser das Feld. Die Wahl steht im `selected` der
 * Option — beim Erzeugen gesetzt, danach nicht mehr massgeblich, weil Svelte
 * dafür nur das **Attribut** anfasst (`set_selected` in
 * `svelte/internal/client`) und ein angefasstes Auswahlfeld seine Wahl selbst
 * behält. Nach oben meldet diese Aktion:
 *
 * ```svelte
 * <select name="kind" use:gefuehrteWahl={(w) => (art = w)}>
 *   <option value="natural" selected={art === 'natural'}>natürliche Person</option>
 *   <option value="legal" selected={art === 'legal'}>juristische Person</option>
 * </select>
 * ```
 *
 * Sie tut zwei Dinge, und beide sind nötig:
 *
 *   * **Beim Aufbau** meldet sie, was schon im Feld steht. Das ist die frühe
 *     Wahl; ohne diese Meldung stünde sie zwar im Feld, aber das Programm
 *     wüsste nichts davon — und alles, was am Wert hängt, zeigte den falschen
 *     Zustand.
 *   * **Bei jeder Änderung** meldet sie den neuen Wert, wie es ein `onchange`
 *     täte. Beides zusammen, damit an der Stelle nur **eine** Sache steht, die
 *     man vergessen kann.
 *   * **Beim Zurücksetzen des Formulars** ebenfalls — und das ist die dritte,
 *     die lange fehlte (03.09.2026, Befund des Auftraggebers über den Umweg der
 *     `enhance`-Umstellung).
 *
 * **Warum ein Zurücksetzen eine eigene Meldung braucht.** `form.reset()` löst
 * **kein** `change` aus; der Browser meldet es niemandem. Und am Feld selbst
 * geschieht auch nichts mehr: Svelte setzt `selected={…}` beim Neuzeichnen als
 * **Attribut**, damit wird die getroffene Wahl zur Vorgabe des Feldes, und das
 * Zurücksetzen führt genau dorthin zurück, wo es schon steht. Am 03.09.2026
 * gemessen: «reset unitId ziel=«01a0…» ist=«01a0…»».
 *
 * Deshalb merkt sich diese Aktion die **echte** Vorgabe beim Aufbau
 * (`defaultSelected`, siehe unten) und meldet sie beim Zurücksetzen.
 *
 * Sichtbar wurde das, als das Zuordnungsformular der Eigentümerseite auf
 * `absenden()` umgestellt wurde: Nach dem Zuordnen stand die Einheit noch in der
 * Auswahl, und der nächste Klick ordnete dieselbe ein zweites Mal zu — mit einer
 * Rückfrage, die aussieht, als hätte man sich vertan.
 *
 * Setzt die Seite den Wert von aussen (ein Vorschlag wird übernommen), genügt
 * das nicht: Ein angefasstes Feld folgt dem `selected` nicht mehr. Dann muss
 * die Stelle den Wert selbst ins Feld schreiben — `Suchauswahl.svelte` zeigt,
 * wie (`$effect` mit `tick()`).
 *
 * **Kein `update`.** Eine Aktion kann auf einen neuen Übergabewert reagieren;
 * hier braucht es das nicht: Gemeldet wird immer an dieselbe Stelle, und der
 * Rückgriff darauf bleibt gültig, solange das Feld steht.
 *
 * Der Wächter `versammlung/gefuehrte-auswahl` hält die Klasse geschlossen.
 */
export function gefuehrteWahl(feld: HTMLSelectElement, melden: (wert: string) => void) {
	/*
	 * **Die Vorgabe des Feldes, nicht sein aktueller Wert** — und beides ist beim
	 * Aufbau nicht dasselbe.
	 *
	 * Warum es diese Zeile überhaupt braucht: Svelte setzt `selected={…}` beim
	 * Neuzeichnen als **Attribut**, und damit wird die getroffene Wahl selbst zur
	 * Vorgabe des Feldes. Ein `form.reset()` findet dann nichts mehr, worauf es
	 * zurücksetzen könnte — es feuert, und alles bleibt stehen. Am 03.09.2026 im
	 * Drehbuch gemessen: «reset unitId ziel=«01a0…» ist=«01a0…»», beide gleich
	 * der gerade getroffenen Wahl.
	 *
	 * **`defaultSelected` und nicht `feld.value`** (aus dem Code-Review). Der
	 * erste Anlauf merkte sich den aktuellen Wert — und traf damit ausgerechnet
	 * den Fall, für den dieses Modul existiert: Wer **vor der Hydration** wählt
	 * (im Saal der Normalfall, siehe `e2e/wahl-vor-hydration.mjs`), hätte seine
	 * frühe Wahl als «Ausgangswert» gemerkt bekommen. Nach dem Absenden meldete
	 * der Reset dieselbe Wahl zurück, und der nächste Klick täte dasselbe noch
	 * einmal — genau der Defekt, den diese Zeile beheben soll.
	 *
	 * `defaultSelected` spiegelt das `selected`-**Attribut** aus dem
	 * ausgelieferten HTML. Gelesen **vor** dem ersten `melden`, trägt es den
	 * Stand des Servers, unabhängig davon, was inzwischen im Feld steht.
	 */
	const ausgangswert = (() => {
		const optionen = [...feld.options];
		// Die Vorgabe aus dem ausgelieferten HTML …
		const vorgabe = optionen.find((o) => o.defaultSelected);
		if (vorgabe) return vorgabe.value;
		/*
		 * … und sonst die erste **wählbare**: Der Browser überspringt beim
		 * Zurücksetzen deaktivierte Optionen (aus der zweiten Reviewrunde). Heute
		 * hat kein Feld gleichzeitig deaktivierte Einträge und keinen Leereintrag —
		 * aber beides gibt es im Bestand, und diese Zeile steht in einem Baustein,
		 * den 25 Auswahlfelder benutzen.
		 */
		return (optionen.find((o) => !o.disabled) ?? optionen[0])?.value ?? '';
	})();

	melden(feld.value);
	const auf = () => melden(feld.value);
	feld.addEventListener('change', auf);

	/*
	 * Das Formular wird beim Aufbau gemerkt: Beim Abräumen ist der Knoten unter
	 * Umständen schon aus dem Baum, und `feld.form` wäre dann `null` — der
	 * Zuhörer bliebe hängen.
	 */
	const formular = feld.form;
	const beiZuruecksetzen = () => melden(ausgangswert);
	formular?.addEventListener('reset', beiZuruecksetzen);

	return {
		destroy() {
			feld.removeEventListener('change', auf);
			formular?.removeEventListener('reset', beiZuruecksetzen);
		}
	};
}
