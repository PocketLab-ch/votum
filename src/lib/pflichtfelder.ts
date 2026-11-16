/**
 * Deutsche Meldungen für leere oder unbrauchbare Pflichtfelder.
 *
 * ## Der Anlass
 *
 * Bedienbarkeitsprüfung vom 05.09.2026, gemeldet aus **beiden** Sichten:
 * «Die Pflichtfeldmeldung des Browsers kommt auf Englisch, halb hinter dem
 * Knopf» (Telefon, Befund 14) und «Die Pflichtfeldmeldung kommt auf Englisch»
 * (Bewirtschaftung, Befund 20).
 *
 * **`lang="de"` am Dokument hilft dagegen nicht.** Die Sprechblase des Browsers
 * folgt der Sprache der **Browseroberfläche**, nicht der des Dokuments. Wer ein
 * englisches Telefon in der Hand hat, liest «Please fill out this field» in
 * einer sonst durchgehend deutschen Anwendung — im Saal, unter Zeitdruck, an
 * einem Feld, das er zum ersten Mal sieht.
 *
 * ## Warum eine eigene Meldung und nicht `setCustomValidity`
 *
 * `setCustomValidity` würde den Wortlaut übersetzen und die Sprechblase
 * behalten. Die ist aber der zweite Teil des Befundes: Sie schwebt über dem
 * Inhalt, verschwindet beim nächsten Tippen, wird von Bildschirmlesern
 * uneinheitlich angesagt, und auf dem Telefon steht sie «halb hinter dem
 * Knopf». Ein Absatz im Fluss unter dem Feld bleibt stehen, bis er erledigt
 * ist, und schiebt die Seite auseinander statt sie zu überdecken.
 *
 * ## Was hier absichtlich **nicht** passiert
 *
 * **Kein `novalidate` am Formular.** Die Prüfung des Browsers bleibt scharf und
 * hält das Absenden weiterhin auf; nur ihre Anzeige wird ersetzt. Ohne sie
 * ginge eine leere Pflichtangabe an den Server, und die Absage käme erst von
 * dort — ein Netzweg für etwas, das im Feld steht.
 *
 * **Keine eigene Gültigkeitsregel.** Was gültig ist, entscheiden weiterhin
 * `required`, `type`, `min`, `max`, `pattern` und der Kern. Dieses Modul liest
 * nur ab, woran es lag.
 */

import { rolleInsBild } from './sichtfeld';

/** Die Zuordnung eines Feldes zu seiner Meldung — je Feld genau eine. */
const MELDUNGEN = new WeakMap<HTMLElement, HTMLElement>();

/** Ein Feld, das eine Gültigkeit hat. */
type Pruefbar = HTMLElement & { validity?: ValidityState; form?: HTMLFormElement | null };

/**
 * Woran es lag, auf Deutsch.
 *
 * Die Reihenfolge ist die der Genauigkeit: Ein leeres Feld ist etwas anderes
 * als ein falsch ausgefülltes, und wer beides in einem Satz zusammenfasst,
 * hilft bei keinem von beidem.
 *
 * Der Rückfallwert nennt bewusst keine Ursache. «Diese Eingabe passt nicht»
 * ist wenig, aber es behauptet nichts Falsches — und die Fälle, die hier
 * landen, sind selten und uneinheitlich zwischen den Browsern.
 */
export function grundInWorten(v: ValidityState, feldtyp = ''): string {
	if (v.valueMissing) {
		if (feldtyp === 'checkbox' || feldtyp === 'radio') return 'Bitte treffen Sie hier eine Wahl.';
		if (feldtyp === 'file') return 'Bitte wählen Sie eine Datei.';
		return 'Dieses Feld muss ausgefüllt sein.';
	}
	if (v.typeMismatch) {
		if (feldtyp === 'email') return 'Das sieht nicht nach einer E-Mail-Adresse aus.';
		if (feldtyp === 'url') return 'Das sieht nicht nach einer Adresse aus.';
		return 'Diese Eingabe hat nicht das erwartete Format.';
	}
	if (v.patternMismatch) return 'Diese Eingabe hat nicht die erwartete Form.';
	if (v.tooShort) return 'Diese Eingabe ist zu kurz.';
	if (v.tooLong) return 'Diese Eingabe ist zu lang.';
	if (v.rangeUnderflow) return 'Diese Zahl ist zu klein.';
	if (v.rangeOverflow) return 'Diese Zahl ist zu gross.';
	if (v.stepMismatch) return 'Diese Zahl ist in dieser Schrittweite nicht vorgesehen.';
	if (v.badInput) return 'Diese Eingabe lässt sich nicht als Zahl lesen.';
	return 'Diese Eingabe passt nicht.';
}

/** Der Absatz unter dem Feld, angelegt oder wiederverwendet. */
function meldungFuer(feld: HTMLElement): HTMLElement {
	const vorhanden = MELDUNGEN.get(feld);
	if (vorhanden?.isConnected) return vorhanden;

	const p = document.createElement('p');
	p.className = 'feldfehler';
	/*
	 * `alert` und nicht `status`: Es hält das Absenden auf, und der
	 * Bildschirmleser soll es sofort ansagen statt beim nächsten Atemholen.
	 */
	p.setAttribute('role', 'alert');
	MELDUNGEN.set(feld, p);
	return p;
}

/**
 * Alle Felder, die zu derselben Meldung gehören.
 *
 * **Wegen der Radiogruppen** (Code-Review 06.09.2026). Bei `<input type="radio"
 * name="x" required>` feuert `invalid` nur am ersten Knopf der Gruppe; Meldung
 * und `aria-invalid` hängen dort. Wer dann einen **anderen** Knopf derselben
 * Gruppe wählt, löst `change` an diesem aus — und ein Aufräumen, das nur das
 * auslösende Feld kennt, findet nichts. Die Meldung «Bitte treffen Sie hier
 * eine Wahl» blieb samt rotem Rand stehen, obwohl die Wahl getroffen war.
 */
function gruppe(feld: Pruefbar): Pruefbar[] {
	const eingabe = feld as HTMLInputElement;
	if (eingabe.type !== 'radio' || !eingabe.name) return [feld];
	const formular = eingabe.form;
	const wurzel: ParentNode = formular ?? document;
	return [
		...wurzel.querySelectorAll<HTMLInputElement>(
			`input[type="radio"][name="${CSS.escape(eingabe.name)}"]`
		)
	];
}

/**
 * Führt die Meldung nach oder nimmt sie weg.
 *
 * **Nachführen statt stehenlassen** (Code-Review 06.09.2026). Ein erster Anlauf
 * stieg bei weiterhin ungültigem Feld sofort aus. An einem `required
 * minlength="3"` hiess das: leer absenden gibt «Dieses Feld muss ausgefüllt
 * sein», ein Zeichen tippen macht es nicht mehr leer, aber weiterhin ungültig —
 * und die Meldung behauptete weiter, es sei leer.
 *
 * Weg ist sie erst, wenn die Eingabe stimmt. Wer ein Pflichtfeld leert und
 * weiterschreibt, behält den Hinweis, bis er ihn erledigt hat; sonst blinkt er
 * beim Tippen.
 */
function fuehreNach(feld: Pruefbar): void {
	if (!feld.validity) return;

	if (!feld.validity.valid) {
		const p = MELDUNGEN.get(feld);
		if (p?.isConnected) p.textContent = grundInWorten(feld.validity, (feld as HTMLInputElement).type ?? '');
		return;
	}

	for (const g of gruppe(feld)) {
		const p = MELDUNGEN.get(g);
		if (p?.isConnected) p.remove();
		/*
		 * Nur an Feldern räumen, an denen dieses Modul die Marke gesetzt hat.
		 * `aria-invalid` ist ein Standardattribut; wer es später serverseitig
		 * setzt, verlöre es sonst beim ersten Tastendruck.
		 */
		if (p) {
			/*
			 * Der Eintrag in der WeakMap überlebt das `remove()` — deshalb hier die
			 * Marke nur nehmen, wenn sie zu **diesem** Absatz gehört
			 * (Sicherheitsdurchgang 06.09.2026). Sonst streicht ein späterer
			 * Tastendruck ein `aria-invalid`, das jemand anders gesetzt hat.
			 */
			if (g.getAttribute('aria-errormessage') === p.id) {
				g.removeAttribute('aria-invalid');
				g.removeAttribute('aria-errormessage');
			}
		}
	}
}

/**
 * Hängt die deutschen Meldungen an das Dokument.
 *
 * Einmal aufzurufen, in der Wurzel. Gibt die Abmeldung zurück.
 *
 * **`capture: true` ist Pflicht, keine Feinheit.** Das `invalid`-Ereignis
 * steigt nicht auf (es ist nicht `bubbles`), ein Zuhörer am Dokument bekäme es
 * in der Blasenphase also nie zu sehen. In der Erfassungsphase läuft es auf dem
 * Weg nach unten am Dokument vorbei.
 */
export function deutschePflichtfelder(): () => void {
	let zaehler = 0;

	const beiUngueltig = (ereignis: Event) => {
		const feld = ereignis.target as Pruefbar | null;
		if (!feld?.validity) return;

		// Die Sprechblase des Browsers unterdrücken — nur sie, nicht die Prüfung.
		ereignis.preventDefault();

		const typ = (feld as HTMLInputElement).type ?? '';
		const p = meldungFuer(feld);
		p.textContent = grundInWorten(feld.validity, typ);

		if (!p.id) p.id = `feldfehler-${++zaehler}`;
		feld.setAttribute('aria-invalid', 'true');
		feld.setAttribute('aria-errormessage', p.id);

		/*
		 * **Neben das Etikett, nicht hinein** (Code-Review 06.09.2026).
		 *
		 * Ein erster Anlauf hängte den Absatz ans Ende des `<label>`. Das ist
		 * gleich dreifach falsch: `<label>` nimmt nach HTML nur Phrasing Content,
		 * ein `<p>` gehört dort nicht hin; der zugängliche Name eines Feldes
		 * entsteht aus dem **ganzen** Etikett, die Meldung wanderte also in den
		 * Namen («Zugangscode Dieses Feld muss ausgefüllt sein») und wurde über
		 * `aria-errormessage` gleich noch einmal angesagt; und wo ein Etikett als
		 * Zeile gesetzt ist (`flex-direction: row`, im Bestand mehrfach), stand
		 * der Absatz **neben** dem Feld statt darunter — das Gegenteil der Zusage.
		 *
		 * Hinter das Etikett gesetzt bleibt er ein Absatz im Fluss, gehört keinem
		 * Namen an und steht unter dem, was er erklärt.
		 */
		const etikett = feld.closest('label');
		(etikett ?? feld).after(p);

		/*
		 * **Nur das erste ungültige Feld holt sich Fokus und Bild.** Der Browser
		 * feuert `invalid` für jedes ungültige Feld eines Formulars, in
		 * Dokumentordnung. Ohne diese Bedingung spränge die Seite bei drei leeren
		 * Feldern dreimal und bliebe beim letzten stehen — also gerade nicht bei
		 * dem, das zuerst zu füllen ist.
		 *
		 * **`elements` und nicht `querySelector`** (Code-Review 06.09.2026): Ein
		 * Feld kann über `form="<id>"` zu einem Formular gehören, ohne darin zu
		 * stehen; im Bestand gibt es genau das. `querySelector` über die
		 * Nachkommen fand es nicht, `erstes` war falsch, und der Knopf tat
		 * sichtbar nichts — die Sprechblase war ja schon unterdrückt.
		 */
		const formular = feld.form;
		const erstes = !formular || ersteMarke(formular) === feld;
		if (erstes) {
			(feld as HTMLInputElement).focus({ preventScroll: true });
			/*
			 * **Das Feld ins Bild, nicht die Meldung.** Bei einem Etikett mit
			 * mehrzeiligem Hilfetext liegt die Meldung weit unter dem
			 * Bedienelement; wer dorthin rollt, hat den Fokus auf etwas ausserhalb
			 * des Bildes. Das Etikett umfasst beide.
			 */
			requestAnimationFrame(() => rolleInsBild(etikett ?? feld));
		}
	};

	const beiEingabe = (ereignis: Event) => {
		const feld = ereignis.target as Pruefbar | null;
		if (feld?.validity) fuehreNach(feld);
	};

	document.addEventListener('invalid', beiUngueltig, { capture: true });
	document.addEventListener('input', beiEingabe);
	document.addEventListener('change', beiEingabe);

	return () => {
		document.removeEventListener('invalid', beiUngueltig, { capture: true });
		document.removeEventListener('input', beiEingabe);
		document.removeEventListener('change', beiEingabe);
	};
}

/** Das erste Feld des Formulars, das dieses Modul gerade bemängelt. */
function ersteMarke(formular: HTMLFormElement): Element | null {
	for (const el of formular.elements) {
		if (el.getAttribute('aria-invalid') === 'true') return el;
	}
	return null;
}
