import { error } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeEinheiten, pruefeGemeinschaftSalden } from '$lib/server/einheiten';
import { stimmkraftAnsicht } from '$lib/server/eigentuemer';
import { einheitenluecke, ohneEigeneQuote, zuordnungsluecke } from '$lib/domain/einheiten';
import { holeVersammlung, holeVersammlungen } from '$lib/server/versammlungen';
import { holeAbendhaeuser, holeVorbereitung } from '$lib/server/uebersicht';
import { holeTagDerVersammlung } from '$lib/server/versammlungstag';
import { holeWeisungspflichtige } from '$lib/server/weisung';
import { alsKennung } from '$lib/server/kennungen';
import { datumLang } from '$lib/domain/datum';
import type { LayoutServerLoad } from './$types';

/**
 * Der Rahmen einer Gemeinschaft (Story 6.7).
 *
 * Bisher trug jede Unterseite ihren eigenen Pfadverweis und keine wusste von den
 * anderen. Die Bereiche standen allein auf der Startseite der Gemeinschaft — und
 * dort **unter** dem Speichern-Knopf, also unterhalb des sichtbaren Bereichs.
 */
export const load: LayoutServerLoad = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	return {
		rahmenGemeinschaft: {
			id: gemeinschaft.id,
			name: gemeinschaft.name,
			ort: gemeinschaft.ort ?? null
		},
		// Die Führung geht weiter, auch wenn der Schritt bei der Gemeinschaft liegt.
		ablauf: await ablaufDerVersammlung(locals.benutzer.operatorId, url.searchParams.get('zur')),
		// Und quer dazu: dasselbe Thema bei den anderen Häusern desselben Abends.
		abendhaeuser: await haeuserDesAbends(locals.benutzer.operatorId, url.searchParams.get('zur')),
		// Und in die Gegenrichtung: von der Gemeinschaft in die offenen Abende.
		offeneVersammlungen: await offeneVersammlungen(locals.benutzer.operatorId, params.id),
		// Was an den Stammdaten offen ist — als Zeichen an der Leiste.
		/** Klammer über mehreren Häusern — die Leiste bietet ihr den Abend an, nicht die Versammlung. */
		klammer: ohneEigeneQuote(gemeinschaft),
		stammdatenluecken: await stammdatenluecken(
			locals.benutzer.operatorId,
			params.id,
			ohneEigeneQuote(gemeinschaft)
		)
	};
};

/**
 * Die offenen Stellen der Stammdaten, für die Leiste.
 *
 * Gemeldet am 12.08.2026: «Bei Eigentümer und Zuordnung und auch Einheiten und
 * Wertquoten mit einem Icon kennzeichnen, wenn die Zuordnungen nicht vollständig
 * ist. Ziel, damit der Nutzer es sofort sieht.» Vorher stand die Lücke nur auf
 * der Seite selbst — man musste sie öffnen, um zu erfahren, dass dort etwas
 * fehlt.
 *
 * **Im Rahmen und nicht auf den Seiten**, weil die Leiste auf *jeder* Unterseite
 * steht: Wer am Reglement arbeitet, soll sehen, dass die Zuordnung noch klafft.
 * Die beiden Abfragen laufen gleichzeitig und sind indexgestützt; die Sätze
 * selbst bildet der Kern.
 */
async function stammdatenluecken(operatorId: string, stwegId: string, klammer: boolean) {
	const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
	const [einheiten, salden, stimmkraft] = await Promise.all([
		holeEinheiten(operatorId, stwegId),
		pruefeGemeinschaftSalden(operatorId, stwegId),
		stimmkraftAnsicht(operatorId, stwegId, heute)
	]);

	return {
		einheiten: einheitenluecke({
			einheiten: einheiten.length,
			stammquotenStimmig: salden.stammquotenStimmig,
			ohneEigeneQuote: klammer
		}),
		zuordnung: zuordnungsluecke({
			einheiten: einheiten.length,
			ohneEigentuemer: stimmkraft.einheitenOhneEigentuemer.length
		})
	};
}

/**
 * Die Häuser des Abends, aus dem man hierher kam — für die Reiterleiste.
 *
 * **Nur mit Herkunft.** Ohne `?zur=` weiss diese Seite nichts von einem Abend,
 * und dann gehört auch keine Leiste hierher: Die Gemeinschaft steht für sich.
 * Steht die Versammlung allein, ohne Abend, kommt eine leere Liste zurück und
 * die Leiste bleibt still — ein einzelnes Haus hat nichts zu wählen.
 *
 * Still auch bei fremder oder unbekannter Kennung, aus demselben Grund wie beim
 * Ablauf: Die Seite der Gemeinschaft muss ohne Versammlung funktionieren.
 * **Und bei einer falsch geformten** (Block B2, 16.10.2026): `?zur=x` erreichte
 * sonst `holeTagDerVersammlung`, `kennungsfehler` übersetzte in einen
 * FachlicherFehler, und der Load fing ihn nicht: gemessen am Dev-Stapel die
 * rohe 500, obwohl hier ausdrücklich Stillstand die Absicht ist. Geprüft wird
 * deshalb die Form, bevor die Abfrage sie zu sehen bekommt.
 */
async function haeuserDesAbends(operatorId: string, id: string | null) {
	const kennung = alsKennung(id);
	if (!kennung) return [];
	const tag = await holeTagDerVersammlung(operatorId, kennung);
	if (!tag) return [];
	return holeAbendhaeuser(operatorId, tag.id);
}

/**
 * Die noch nicht abgeschlossenen Versammlungen dieser Gemeinschaft.
 *
 * Die Durchgängigkeit gilt in beide Richtungen: Aus der Versammlung führt der
 * Ablauf in die Gemeinschaft, und aus der Gemeinschaft muss er zurückführen.
 * Bisher standen dort nur «Historie und Suche» und «Neue Versammlung» — wer
 * einen Abend vorbereitet und zwischendurch am Reglement war, musste über die
 * Historie oder das Kopfmenü zurücksuchen.
 *
 * **Nur die offenen.** Abgeschlossene gehören in die Historie; sie hier zu
 * führen machte aus einer Führung ein Archiv.
 */
async function offeneVersammlungen(operatorId: string, stwegId: string) {
	// Die Seitenleiste zeigt, was ansteht — Archiviertes gehoert nicht dazu.
	const alle = await holeVersammlungen(operatorId, stwegId, 'aktiv');
	const offen = alle.filter((v) => v.zustand !== 'geschlossen' && v.zustand !== 'versiegelt');

	/*
	 * Mit dem gemeinsamen Abend, wenn es einen gibt (Auftraggeber, 12.08.2026: «Ich
	 * komme von dort nie wieder zurück auf die Sammelansicht»). Bisher stand der
	 * Rückweg nur in der Herkunftszeile — und die gibt es nur, wenn man **mit**
	 * `?zur=` gekommen ist. Wer die Gemeinschaft direkt öffnet, fand ihn nicht.
	 *
	 * Gleichzeitig statt in der Schleife: Bei drei offenen Versammlungen wären es
	 * sonst drei Abfragen nacheinander.
	 */
	const tage = await Promise.all(offen.map((v) => holeTagDerVersammlung(operatorId, v.id)));

	return offen.map((v, i) => ({
		id: v.id,
		datum: v.datum,
		zustand: v.zustand,
		gemeinsam: tage[i] ? { id: tage[i]!.id, bezeichnung: tage[i]!.bezeichnung } : null
	}));
}

/**
 * Der Ablauf der Versammlung, aus der man hierher kam.
 *
 * Zwei Schritte der Vorbereitung — Einheiten und Eigentümer — liegen bei der
 * Gemeinschaft. Ohne diesen Rückbezug wechselte dort die ganze Navigation: Die
 * Leiste zeigte «Bereiche der Gemeinschaft», und dass gerade eine Versammlung
 * vorbereitet wird, stand nirgends. Aus der Sicht des Benutzers ist es
 * dieselbe Arbeit — also dieselbe Leiste.
 *
 * **Still, wenn etwas nicht stimmt.** Eine unbekannte oder fremde Kennung im
 * Abfrageteil ist kein Fehler, der eine Seite anhalten dürfte — die Seite der
 * Gemeinschaft steht für sich und muss auch ohne Versammlung funktionieren.
 * **Auch eine falsch geformte** bleibt still (Block B2, 16.10.2026); ohne die
 * Formprüfung warf `holeVersammlung` einen FachlicherFehler, den dieser Load
 * nicht fängt; im Betrieb die 500-Seite.
 */
async function ablaufDerVersammlung(operatorId: string, id: string | null) {
	const kennung = alsKennung(id);
	if (!kennung) return null;
	const versammlung = await holeVersammlung(operatorId, kennung);
	if (!versammlung) return null;
	const [vorbereitung, mitglieder] = await Promise.all([
		holeVorbereitung(operatorId, kennung),
		holeWeisungspflichtige(operatorId, versammlung.stwegId, versammlung.datum)
	]);
	if (!vorbereitung) return null;
	/*
	 * **Woher man wirklich kam.** Gehört die Versammlung zu einer gemeinsamen,
	 * führte der Weg über deren Stammdatenseite hierher — und dorthin muss er
	 * zurück. Gemeldet am 11.08.2026: «Man kann alles anpassen bei der
	 * Liegenschaft, man kommt aber nicht zurück zur Übersicht.» Nachgemessen
	 * standen auf der Seite sechzehn Wege zurück, aber alle sechzehn zur
	 * **einzelnen** Versammlung; die gemeinsame kam nirgends vor.
	 */
	const tag = await holeTagDerVersammlung(operatorId, kennung);

	return {
		versammlungId: versammlung.id,
		titel: `Versammlung vom ${datumLang(versammlung.datum)}`,
		unterzeile: `${versammlung.uhrzeit} Uhr · ${versammlung.ort}`,
		zustand: versammlung.zustand,
		schritte: vorbereitung.schritte,
		fortschritt: vorbereitung.fortschritt,
		mitgliedsgemeinschaften: mitglieder.length,
		gemeinsam: tag ? { id: tag.id, bezeichnung: tag.bezeichnung } : null
	};
}
