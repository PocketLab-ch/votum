import { holeNeutraktandenfussnote } from '$lib/server/neutraktanden';
import { holeLesarten } from '$lib/server/lesarten';
import { holeParteinamen } from '$lib/server/eigentuemer';
import { error, redirect } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { holeBetreiber, holeBriefkopf } from '$lib/server/betreiber';
import { holeTraktanden } from '$lib/server/traktanden';
import { erzeugeKartensatz } from '$lib/server/kartensatz';
import { fuegeZusammen, seitenEinzeln } from '$lib/server/pdf/basis';
import { erzeugeTraktandenliste } from '$lib/server/pdf/traktandenliste';
import { erzeugeZugangskarte, erzeugeZugangskarten } from '$lib/server/pdf/zugangskarte';
import { erzeugeVollmachtsformular } from '$lib/server/pdf/vollmachtsformular';
import { ausserAbsage } from '$lib/server/nulsperre';
import type { RequestHandler } from './$types';
import { herkunft } from '$lib/server/herkunft';

/**
 * Erzeugt Zugänge und liefert die Karten dazu — in einem Zug.
 *
 * Getrennt ginge es nicht: Der Code existiert nur im Augenblick seiner
 * Entstehung. Danach steht in der Datenbank nur sein Prüfwert (NFR-5), und die
 * Karte liesse sich nicht mehr erzeugen — nur ein neuer Zugang, der den alten
 * ungültig macht. Genau deshalb ist dies ein POST und kein Verweis: Es geschieht
 * etwas, und zwar Unumkehrbares.
 *
 * Der Kranz an Angaben kommt aus `erzeugeKartensatz` und wird mit dem
 * Versandpaket geteilt. Zwei Rechnungen für dieselben Zahlen liefen eines Tages
 * auseinander, und dann stünde auf der einen Karte eine andere Stimmkraft als
 * auf der anderen.
 */
export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	/*
	 * **Ein unlesbarer Rumpf ist kein Serverfehler** (M5, 15.10.2026). Ein
	 * Aufruf mit `content-type: application/json` liess `request.formData()`
	 * werfen, und `handleError` antwortete mit der 500-Seite. Der Nachbar
	 * `versandpaket.zip` fängt denselben Fall seit jeher so ab; ohne Formular
	 * gilt hier dasselbe wie dort: für alle, die noch keinen Zugang haben.
	 */
	const daten = await request.formData().catch(ausserAbsage(new FormData()));
	const form = String(daten.get('form') ?? 'sammel');
	const gewaehlt = daten.getAll('partei').map(String).filter(Boolean);

	const handelnder = {
		operatorId: locals.benutzer.operatorId,
		userId: locals.benutzer.id,
		label: locals.benutzer.displayName
	};

	let satz;
	try {
		satz = await erzeugeKartensatz(handelnder, params.id, herkunft(url), gewaehlt);
	} catch (fehler) {
		/*
		 * **Eine Schranke ist keine Fehlerseite** (22.08.2026, Befund B-04 des
		 * Prüflaufs). Bis hierher warf jede fachliche Absage den Verwalter mit
		 * einem nackten «400» aus der Anwendung — mitten in der Vorbereitung, und
		 * der einzige Weg zurück war die Zurück-Taste.
		 *
		 * Die häufigste Absage ist dabei gar kein Fehler, sondern eine Auskunft:
		 * «Alle gewählten Parteien haben bereits einen gültigen Zugang.» Ein
		 * bestehender Code lässt sich nicht nochmals ausdrucken — er steht nur
		 * gehasht in der Datenbank —, sondern nur ersetzen. Das gehört auf die
		 * Seite, von der aus geklickt wurde.
		 */
		if (fehler instanceof FachlicherFehler) {
			redirect(303, `/versammlungen/${params.id}/zugaenge?absage=${encodeURIComponent(fehler.kennung)}`);
		}
		throw fehler;
	}

	const versammlung = satz.versammlung!;
	const { rahmen, inhalte } = satz;

	let bytes: Uint8Array;
	let name: string;

	if (form === 'versandsatz') {
		// Je Person: Traktandenliste, dann die eigene Karte. Die Liste wird einmal
		// erzeugt und mehrfach eingefügt — das Zusammenfügen kopiert die Seiten.
		const [traktanden, betreiber, briefkopf] = await Promise.all([
			holeTraktanden(locals.benutzer.operatorId, params.id),
			holeBetreiber(locals.benutzer.operatorId),
			holeBriefkopf(locals.benutzer.operatorId)
		]);
		const liste = await erzeugeTraktandenliste('liste', {
			versammlung,
			gemeinschaftName: satz.gemeinschaft.name,
			traktanden,
			parteinamen: await holeParteinamen(locals.benutzer.operatorId, versammlung.stwegId),
			// L5: Zeichen und Fussnote an neuen Traktanden (Migration 174).
			neutraktanden: await holeNeutraktandenfussnote(locals.benutzer.operatorId, params.id),
			// L8 (Migration 184): der Satz zu den Vollmachten der Verwaltung an
			// Traktanden mit Häkchen, je nach Wahl (G7).
			verwaltungL8: (await holeLesarten(locals.benutzer.operatorId, { meetingId: params.id })).L8,
			briefkopf,
			briefkopfHoeheMm: betreiber?.briefkopfHoeheMm,
			briefkopfAlleSeiten: betreiber?.briefkopfAlleSeiten
		});

		/*
		 * **Und ein Vollmachtsformular je Person** (Bedienbarkeitsprüfung
		 * 05.09.2026, Befund 25: «Es fehlen ein Vollmachtsformular und eine
		 * Absenderangabe»). Die Einladung sagt seit dem 23.08.2026, dass man
		 * sich vertreten lassen kann; womit, lag bisher nicht bei. Es kommt
		 * **hinter** die Karte: Wer den Satz auseinanderfaltet, hat zuerst, was
		 * er zum Kommen braucht, und dahinter, was er zum Fernbleiben braucht.
		 */
		/*
		 * **Einmal erzeugt, seitenweise verteilt** (Code-Review 07.09.2026). Je
		 * Partei ein eigenes Dokument hiesse, beide DejaVu-Schriften je Partei
		 * neu zu lesen und einzubetten — bei vierzig Parteien achtzig
		 * Dateilesevorgänge im Anfragepfad.
		 */
		const formulare = await erzeugeVollmachtsformular(
			{
				gemeinschaftName: satz.gemeinschaft.name,
				gemeinschaftAdresse: rahmen.gemeinschaftAdresse,
				datum: versammlung.datum,
				uhrzeit: versammlung.uhrzeit,
				ort: versammlung.ort,
				stufe: versammlung.stufe,
				vollmachtsgrenze: satz.gemeinschaft.proxyLimit,
				vollmachtsgrenzeQuelle: satz.gemeinschaft.proxyLimitRuleSource ?? null,
				stimmfuehrungZaehlt:
					(await holeLesarten(locals.benutzer.operatorId, { meetingId: params.id })).L15 === 'mitzaehlen'
			},
			inhalte.map((i) => ({ name: i.name, einheiten: i.einheiten.map((e) => e.label) }))
		);

		const formularseiten = await seitenEinzeln(formulare);
		const teile: Uint8Array[] = [];
		for (const [i, inhalt] of inhalte.entries()) {
			teile.push(liste.bytes);
			teile.push(await erzeugeZugangskarte(rahmen, inhalt));
			teile.push(formularseiten[i]);
		}
		bytes = await fuegeZusammen(teile);
		name = `Versandsatz-${versammlung.datum}.pdf`;
	} else if (form === 'einzeln' && inhalte.length === 1) {
		bytes = await erzeugeZugangskarte(rahmen, inhalte[0]);
		name = `Zugangskarte-${inhalte[0].name.replace(/[^\p{L}\p{N}]+/gu, '-')}.pdf`;
	} else {
		bytes = await erzeugeZugangskarten(rahmen, inhalte);
		name = `Zugangskarten-${versammlung.datum}.pdf`;
	}

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			// Zum Herunterladen, nicht zum Ansehen: Die Datei enthält Zugangscodes
			// und gehört nicht in den Verlauf des Browsers, den ein Kollege am
			// selben Rechner aufklappt.
			'content-disposition': `attachment; filename="${encodeURIComponent(name)}"`,
			'cache-control': 'private, no-store'
		}
	});
};
