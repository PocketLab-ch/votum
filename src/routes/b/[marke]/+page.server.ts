/**
 * Der Vermerk aus der Erinnerungsmail.
 *
 * **Das Öffnen tut nichts, erst der Knopf** (Code-Review 02.09.2026). Die erste
 * Fassung löste die Marke schon im `load` ein — ein Klick, kein Formular. Das
 * war falsch, und zwar auf die Art, die den ganzen Zweck aufhebt: Mailserver
 * rufen Links vor der Zustellung ab (Outlook Safe Links, Viren- und
 * Vorschauprüfer). Der Vorabruf hätte den Versand vermerkt, die Fristwarnung
 * abgeschaltet und die Erinnerung verstummen lassen, bevor sie überhaupt jemand
 * gelesen hat — genau der Fall, gegen den dieses Werkzeug gebaut ist.
 *
 * Ein GET verändert deshalb nichts. Es zeigt, worum es geht, und die Aussage
 * geschieht per POST.
 */
import { error } from '@sveltejs/kit';
import {
	loeseMarkeEin,
	schauMarkeAn,
	schauNeuversandAn,
	type NeuversandDerMarke
} from '$lib/server/versandvermerk';
import { datumLang } from '$lib/domain/datum';
import type { Actions, PageServerLoad } from './$types';

/**
 * Eine echte Marke sind 32 Zufallsbytes in base64url, also 43 Zeichen.
 *
 * Der Test steht vor der Datenbank, damit ein offensichtlich falscher Wert dort
 * gar nicht erst ankommt.
 */
const MARKENFORM = /^[A-Za-z0-9_-]{20,120}$/;

/**
 * Welche Frage die Seite stellt: nach der berichtigten Einladung, nach ihr nach
 * Ablauf der erfassten Frist, oder nach der bisherigen. Bis 07.10.2026 hatte
 * `zu_spaet` keinen Knopf; seit dem Produktentscheid 07.10.2026 («Nur noch
 * aufmerksam machen») zählt auch dann jeder Vermerk nach der Milderung.
 */
type Fassung = 'berichtigt' | 'zu_spaet' | 'bisher';

function fassungAus(n: NeuversandDerMarke): Fassung {
	if (!n.ausstehend) return 'bisher';
	return n.fristVorbei ? 'zu_spaet' : 'berichtigt';
}

export const load: PageServerLoad = async ({ params }) => {
	if (!MARKENFORM.test(params.marke)) error(404, 'Unbekannter Link');

	const stand = await schauMarkeAn(params.marke);
	/*
	 * **Nach einer Milderung fragt die Seite nach der berichtigten Einladung**
	 * (Korrekturrunde 06.10.2026). Neu preisgegeben wird nur der letzte
	 * Fristtag, und den nennt die Mail mit diesem Link ohnehin.
	 */
	const neuversand = stand ? await schauNeuversandAn(params.marke) : null;
	return {
		gefunden: stand !== null,
		gemeinschaft: stand?.gemeinschaft ?? null,
		tag: stand?.tag ? datumLang(stand.tag) : null,
		schonVermerkt: stand?.schonVermerkt ?? false,
		fassung: neuversand ? fassungAus(neuversand) : ('bisher' as Fassung),
		frist: neuversand?.frist ? datumLang(neuversand.frist) : null
	};
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		if (!MARKENFORM.test(params.marke)) error(404, 'Unbekannter Link');

		/*
		 * Die Lage **vor** dem Einlösen: Danach ist die Marke verbraucht, und die
		 * Seite wüsste nicht mehr, wofür der Vermerk galt.
		 */
		const neuversand = await schauNeuversandAn(params.marke);
		const jetzt = fassungAus(neuversand);
		const frist = neuversand.frist ? datumLang(neuversand.frist) : null;

		/*
		 * **Bestätigt wird die Frage, die auf dem Bildschirm stand** (Fachprüfung
		 * B7, Korrekturrunde 06.10.2026). Die Seite schickt mit, welche das war.
		 * Hat sich die Lage seither geändert (eine Milderung, ein Rückweg, der
		 * letzte Fristtag vorbei), wird nicht eingelöst: Ein Ja auf «Ist die
		 * Einladung verschickt?» ist kein Ja zur berichtigten Einladung, und ein Ja
		 * vor Fristablauf hat die Sätze für die Lage nach dem letzten Tag nicht
		 * gesehen (noch nicht verschickt: nicht mehr rechtzeitig; nicht bei allen:
		 * anfechtbar). Fehlt die Angabe, gilt das als geändert; die
		 * Seite fragt dann neu. (Bis 07.10.2026 hiess die Frage «Ist die Einladung
		 * bei allen angekommen?».)
		 */
		const gezeigt = (await request.formData()).get('fassung');
		if (gezeigt !== jetzt) {
			return { ausgang: 'geaendert' as const, gemeinschaft: null, tag: null, fassung: jetzt, frist };
		}

		const ergebnis = await loeseMarkeEin(params.marke);
		return {
			ausgang: ergebnis.ausgang,
			gemeinschaft: ergebnis.gemeinschaft,
			tag: ergebnis.tag ? datumLang(ergebnis.tag) : null,
			fassung: jetzt,
			frist
		};
	}
};
