/**
 * Das Versandpaket: **eine** ZIP-Datei mit lauter Einzeldokumenten.
 *
 * Darin die Traktandenliste einmal und je ein persönliches QR-Blatt pro
 * Eigentümer. Gedacht für den Weg über eine Dokumentenablage: Jede Datei wird
 * dort einzeln abgelegt, und jeder Eigentümer bekommt den Verweis auf seine
 * eigene. Ein Sammel-PDF taugte dafür nicht — es landete bei allen im Dokument
 * aller, samt fremder Zugangscodes.
 *
 * **Die Traktandenliste liegt einmal darin und nicht vierzehnmal.** Sie ist für
 * alle dieselbe; ein Verweis genügt für alle. Sie mit jeder Karte zu bündeln
 * hiesse, sie vierzehnmal abzulegen — und eine berichtigte Liste zöge dann
 * vierzehn neue Zugangscodes nach sich, für nichts. Wer das gebündelte Blatt
 * doch braucht, nimmt den «Versandsatz» als PDF.
 *
 * **Die Versandliste** ordnet Datei, Partei und E-Mail-Adresse einander zu.
 * Ohne sie stünde am Ende ein Ordner mit vierzehn PDF, und die Zuordnung zum
 * Empfänger müsste jemand von Hand aus den Dateinamen ableiten.
 *
 * **Achtung, das hier erzeugt Zugänge** — alle in einem Zug. Jeder Code
 * existiert nur im Augenblick seiner Entstehung (NFR-5); vierzehn einzelne
 * Aufrufe erzeugten jedes Mal neue und machten die vorigen ungültig.
 *
 * **Die Mitberechtigten bekommen ihre eigene Sendung** (26.08.2026, ZGB
 * Art. 712n). Gehört eine Einheit mehreren Personen gemeinsam, ist jede von
 * ihnen Stockwerkeigentümerin und einzeln einzuladen; gebündelt ist nur die
 * Stimme, nicht die Einladung (Wermelinger, Rz. 50 ad Art. 712n). Eine
 * unterbliebene Einladung führt im Regelfall zur Anfechtbarkeit (Art. 75 ZGB).
 *
 * **Und zwar mit der Zugangskarte** (27.08.2026, Produktentscheid). Bis dahin
 * enthielt ihre Sendung nur die Traktandenliste, und die Karte ging allein an
 * die vertretende Person. Das folgte dem alten Aufdruck «Die Stimme übt aus:
 * …» — der ist weg, und damit auch der Grund, die Karte nur einer Person zu
 * schicken. Der Zugangscode ist ohnehin das «oder»: Die Einheit hat eine
 * Stimme, der Einlass lässt genau einmal herein, und wer den Code zuerst
 * benutzt, übt sie aus (ZGB Art. 712o Abs. 1). Ist nur einer der Mitberechtigten
 * anwesend, darf die Sitzungsleitung annehmen, dass er gültig vertritt, und zwar
 * ohne Vollmacht (Wermelinger, Rz. 19 ad Art. 712o).
 *
 * **Die gemeldete Zustelladresse bleibt die Ausnahme** (Art. 712n, Rz. 49/51):
 * Ist eine gesetzt, geht die Karte nur dorthin. Das entscheidet `zustellkreis`
 * im Kern, nicht diese Datei.
 *
 * **Woher sie kommen: aus den Stammdaten, nicht aus dem festgehaltenen Stand.**
 * `freigabe.ts` lässt Parteien ohne Einheit bewusst weg (Zeile 197,
 * `p.units.length > 0`) — die Mitberechtigten halten keine Einheit und stehen
 * deshalb dort **nicht**. Wer sie von der Momentaufnahme erwartete, verschickte
 * keine einzige zusätzliche Einladung und merkte es nicht.
 */
import { holeNeutraktandenfussnote } from './neutraktanden';
import { holeParteinamen } from './eigentuemer';
import { dateinamensform, dosZeitstempel, eindeutigeNamen, packe } from '$lib/domain/archiv';
import { schreibe } from '$lib/domain/csv';
import { holeBetreiber, holeBriefkopf } from './betreiber';
import { holeTraktanden } from './traktanden';
import { erzeugeKartensatz, holeVersandanschriften, type Handelnder } from './kartensatz';
import { erzeugeTraktandenliste } from './pdf/traktandenliste';
import { holeLesarten } from './lesarten';
import { erzeugeZugangskarte } from './pdf/zugangskarte';
import { erzeugeVollmachtsformular } from './pdf/vollmachtsformular';
import { seitenEinzeln } from './pdf/basis';
import { empfaengerkreis, zustellkreis } from '$lib/domain/mitberechtigte';
import { holeMitberechtigteJeHuelle } from './mitberechtigte';
import type { Empfaenger } from '$lib/domain/mailversand';
import type { Id } from '$lib/domain/types';

export interface Versandpaket {
	bytes: Uint8Array;
	dateiname: string;
	/** Was darin liegt, in Reihenfolge — für den Prüflauf und für die Rückmeldung. */
	inhalt: string[];
	/**
	 * Dieselben Dateien einzeln — für den Mailversand.
	 *
	 * **Dieselbe Quelle, nicht eine zweite.** Der Versand braucht die Karten als
	 * Einzeldateien, nicht als Archiv. Sie ein zweites Mal zu erzeugen hiesse,
	 * die Zugangscodes ein zweites Mal zu erzeugen — und damit die eben
	 * verpackten ungültig zu machen (NFR-5).
	 */
	dateien: { name: string; inhalt: Uint8Array }[];
	/**
	 * Wer welche Beilage bekommt, mit Adresse. Leere Adresse heisst: keine erfasst.
	 *
	 * Darin auch die Mitberechtigten gemeinschaftlicher Zeilen — seit dem
	 * 27.08.2026 mit derselben Zugangskarte wie die Zeile selbst.
	 */
	empfaenger: Empfaenger[];
}

export async function erzeugeVersandpaket(
	handelnder: Handelnder,
	meetingId: Id,
	basis: string,
	gewaehlt: Id[] | undefined,
	/** Der Zeitpunkt als `JJJJ-MM-TT hh:mm:ss`; der Kern liest keine Uhr (AD-1). */
	zeitpunkt: string
): Promise<Versandpaket> {
	const satz = await erzeugeKartensatz(handelnder, meetingId, basis, gewaehlt);
	const versammlung = satz.versammlung!;

	const [traktanden, betreiber, briefkopf, anschriften, mitberechtigte] = await Promise.all([
		holeTraktanden(handelnder.operatorId, meetingId),
		holeBetreiber(handelnder.operatorId),
		holeBriefkopf(handelnder.operatorId),
		holeVersandanschriften(handelnder.operatorId, versammlung.stwegId, satz.parteiIds),
		holeMitberechtigteJeHuelle(handelnder.operatorId, versammlung.stwegId)
	]);

	const liste = await erzeugeTraktandenliste('liste', {
		versammlung,
		gemeinschaftName: satz.gemeinschaft.name,
		traktanden,
		parteinamen: await holeParteinamen(handelnder.operatorId, versammlung.stwegId),
		// L5: Zeichen und Fussnote an neuen Traktanden (Migration 174).
		neutraktanden: await holeNeutraktandenfussnote(handelnder.operatorId, meetingId),
		// L8 (Migration 184): der Satz zu den Vollmachten der Verwaltung an
		// Traktanden mit Häkchen, je nach Wahl (G7).
		verwaltungL8: (await holeLesarten(handelnder.operatorId, { meetingId })).L8,
		briefkopf,
		briefkopfHoeheMm: betreiber?.briefkopfHoeheMm,
		briefkopfAlleSeiten: betreiber?.briefkopfAlleSeiten
	});

	// Erst alle Namen bilden, dann eindeutig machen: Zwei Parteien können gleich
	// heissen, und ein Archiv mit dreizehn statt vierzehn Karten fiele erst im
	// Saal auf.
	const kartennamen = eindeutigeNamen(
		satz.inhalte.map((i) => `Zugangskarte_${versammlung.datum}_${dateinamensform(i.name)}.pdf`)
	);

	const traktandenlisteName = `Traktandenliste_${versammlung.datum}.pdf`;

	const dateien = [{ name: traktandenlisteName, inhalt: liste.bytes }];

	/*
	 * **Das Vollmachtsformular gehört auch hierher** (Bedienbarkeitsprüfung
	 * 05.09.2026, Befund 25; nachgezogen am 07.09.2026 aus dem Code-Review).
	 *
	 * Es lag zuerst nur im gedruckten Versandsatz bei. Über dieses Paket geht
	 * aber der **elektronische** Versand hinaus, und wer die Einladung per Mail
	 * bekommt, hätte weiterhin nichts zum Unterschreiben gehabt — der Befund
	 * wäre für den häufigeren Weg offen geblieben.
	 *
	 * **Dafür trägt eine Nachricht jetzt mehrere Beilagen.** Sie trug genau
	 * eine (`Nachricht.anhang`), und die Datei im Paket allein erreicht niemanden
	 * — der Versand hängt nur an, was der Plan je Empfänger nennt. Der
	 * Code-Review hat den Kommentar widerlegt, der das Gegenteil behauptete.
	 *
	 * Ein Dokument für alle, dann seitenweise verteilt: Je Partei eines zu
	 * erzeugen läse beide Schriften je Partei neu von der Platte.
	 */
	const formulare = await erzeugeVollmachtsformular(
		{
			gemeinschaftName: satz.gemeinschaft.name,
			gemeinschaftAdresse: satz.rahmen.gemeinschaftAdresse,
			datum: versammlung.datum,
			uhrzeit: versammlung.uhrzeit,
			ort: versammlung.ort,
			stufe: versammlung.stufe,
			vollmachtsgrenze: satz.gemeinschaft.proxyLimit,
			vollmachtsgrenzeQuelle: satz.gemeinschaft.proxyLimitRuleSource ?? null
		},
		satz.inhalte.map((i) => ({ name: i.name, einheiten: i.einheiten.map((e) => e.label) }))
	);
	const formularnamen = eindeutigeNamen(
		satz.inhalte.map((i) => `Vollmacht_${versammlung.datum}_${dateinamensform(i.name)}.pdf`)
	);

	const formularseiten = await seitenEinzeln(formulare);
	for (const [nummer, inhalt] of satz.inhalte.entries()) {
		dateien.push({
			name: kartennamen[nummer],
			inhalt: await erzeugeZugangskarte(satz.rahmen, inhalt)
		});
		dateien.push({ name: formularnamen[nummer], inhalt: formularseiten[nummer] });
	}

	/*
	 * **Empfänger und Versandliste entstehen in einem Durchgang.**
	 *
	 * Sie beantworten dieselbe Frage — wer bekommt was —, und zwei getrennte
	 * Schleifen liefen eines Tages auseinander. Dann stünde in der Liste ein
	 * Name, den der Mailversand nicht kennt, oder umgekehrt.
	 *
	 * Die Mitberechtigten stehen **unter** ihrer Hülle statt am Ende: In einer
	 * flachen Tabelle ist die Zeile darüber die einzige Auskunft darüber,
	 * wozu sie gehören.
	 */
	const empfaenger: Empfaenger[] = [];
	const zeilen: string[][] = [];

	/*
	 * **Wer die Karte bekommt** (27.08.2026, ZGB Art. 712n und 712o Abs. 1).
	 *
	 * Regel: die Zeile selbst an ihrer eigenen Adresse, dazu jede Person des
	 * Zustellkreises an ihrer. Ausnahme: Ist eine Zustelladresse gemeldet, ist
	 * der Kreis auf sie eingeengt — das entscheidet `zustellkreis` im Kern.
	 *
	 * **Dieselbe Datei an mehrere Adressen ist Absicht.** Die Einheit hat eine
	 * Stimme; der Code lässt genau einmal herein. Wer ihn zuerst benutzt, übt sie
	 * aus. Die Karte nur einer der Personen zu schicken hiesse zu entscheiden, wer
	 * von ihnen abstimmen darf.
	 */
	const empfaengerFuer = (
		parteiId: Id,
		name: string,
		adresse: string,
		dateinamen: string[],
		gemeinschaftlich: boolean
	): Empfaenger => ({ parteiId, name, adresse, dateinamen, gemeinschaftlich });

	for (const [nummer, inhalt] of satz.inhalte.entries()) {
		const parteiId = satz.parteiIds[nummer];
		const kartenname = kartennamen[nummer];

		/*
		 * **Archivierte kommen mit — für die Liste, nicht für den Versand.**
		 * `zustellkreis` (Kern) lässt sie aus dem Empfängerkreis fallen; die
		 * Versandliste nennt sie trotzdem mit dem Grund. Fielen sie ganz weg,
		 * stünde eine Zeile im Archiv, die einmal mitberechtigt war, und niemand
		 * sähe, dass sie deshalb keine Einladung bekommt.
		 */
		const alleMitglieder = mitberechtigte.get(parteiId) ?? [];
		const mitglieder = alleMitglieder.filter((m) => !m.archiviertAm);

		// Getrimmt, bevor verglichen wird: Ein Leerzeichen am Rand der einen
		// Adresse liesse die Doppelprüfung unten ins Leere laufen, und dieselbe
		// Person bekäme zwei Sendungen an dieselbe Adresse.
		const eigeneAdresse = (anschriften.get(parteiId) ?? '').trim();

		/*
		 * **`empfaengerkreis` entscheidet, nicht diese Schleife** (ZGB Art. 712n).
		 * Regel: alle einzeln; Ausnahme: eine gemeldete Zustelladresse. Die Regel
		 * steht im Kern, weil sie ohne laufendes System prüfbar sein muss — an ihr
		 * hängt die Anfechtbarkeit des Beschlusses.
		 *
		 * `zustellkreis` daneben nennt dieselben Personen **vor** der Frage nach
		 * der Adresse. Wer darin steht und keine hat, kommt trotzdem in die
		 * Empfängerliste — mit leerer Adresse. Dann meldet ihn `planeVersand` als
		 * «ohne Adresse und deshalb nicht angeschrieben», und der Verwalter sieht
		 * ihn auf dem Bildschirm statt nur in der Versandliste.
		 *
		 * Der Rückfall auf die Hülle (Kennung `''`) bleibt hier aussen vor: Die
		 * Zeile bekommt ihre Sendung ohnehin an genau diese Adresse, gleich
		 * darunter.
		 */
		const kreis = empfaengerkreis(mitglieder, eigeneAdresse || null);
		const adressen = new Map(kreis.filter((k) => k.partyId !== '').map((k) => [k.partyId, k.adresse]));
		const imKreis = new Set(zustellkreis(mitglieder).map((m) => m.partyId));

		// Ist eine Zustelladresse gemeldet und dort keine E-Mail erfasst, geht an
		// niemanden etwas — auch nicht an die übrigen. Die Rolle unten muss das
		// sagen, statt eine Zustellung zu behaupten, die nicht stattfindet.
		const gemeldete = mitglieder.find((m) => m.istZustelladresse);
		const gemeldeteErreichbar = gemeldete ? adressen.has(gemeldete.partyId) : false;

		const gesehen = new Set<string>();
		const kartenempfaenger: { parteiId: Id; name: string; adresse: string }[] = [];
		const nimmAuf = (id: Id, name: string, adresse: string) => {
			if (adresse !== '') {
				const schluessel = adresse.toLowerCase();
				if (gesehen.has(schluessel)) return;
				gesehen.add(schluessel);
			}
			kartenempfaenger.push({ parteiId: id, name, adresse });
		};

		/*
		 * **Die Zeile selbst nur, wenn sie eine eigene Adresse trägt.** Eine über
		 * die Maske erfasste gemeinschaftliche Zeile trägt keine — die Adressen
		 * stehen bei den Personen. Sie trotzdem mit leerer Adresse aufzunehmen
		 * hiesse, sie unter «ohne Adresse, nicht angeschrieben» zu melden, obwohl
		 * alle Beteiligten ihre Karte bekommen haben. Bleibt am Ende niemand
		 * übrig, kommt sie ganz unten doch noch dazu — dann ist die leere Adresse
		 * die richtige Auskunft.
		 *
		 * **Und nur, solange keine Zustelladresse gemeldet ist** (aus dem
		 * Code-Review, 27.08.2026). Die Meldung sagt «nur dorthin», und wer sie
		 * abgibt, tut das gerade, um die übrigen Wege zu schliessen. Ginge die
		 * Karte daneben weiter an die Adresse der Zeile, bewirkte die Meldung
		 * nicht, was sie sagt. Trägt die gemeldete Person keine E-Mail, greift
		 * diese Schranke nicht: Dann ist die Adresse der Zeile der Rückfall, den
		 * `empfaengerkreis` ohnehin vorsieht — besser als nirgendwohin.
		 */
		if (eigeneAdresse !== '' && !gemeldeteErreichbar) nimmAuf(parteiId, inhalt.name, eigeneAdresse);
		for (const m of mitglieder) {
			if (!imKreis.has(m.partyId)) continue;
			nimmAuf(m.partyId, m.displayName, adressen.get(m.partyId) ?? '');
		}
		if (kartenempfaenger.length === 0) nimmAuf(parteiId, inhalt.name, '');

		/*
		 * **Der Begleittext folgt dem, was hinausgeht** (aus dem Code-Review,
		 * 27.08.2026). `istGemeinschaftlich` stammt aus dem festgehaltenen Stand,
		 * die Mitberechtigten aus den lebenden Stammdaten — die beiden können
		 * auseinanderlaufen. Wurde der Haken nach der Freigabe gesetzt und danach
		 * Personen aufgenommen, bekämen mehrere Empfänger dieselbe Karte mit dem
		 * Satz «Die Karte gilt nur für Sie. Geben Sie sie nicht weiter». Der
		 * Wortlaut widerspräche dann genau dem, was gerade geschieht.
		 *
		 * Deshalb entscheidet **beides zusammen**: Sobald mitberechtigte Personen
		 * erfasst sind, gilt der gemeinschaftliche Text — und umgekehrt ebenso,
		 * denn eine Hülle aus der Zeit vor Migration 094 trägt gar keine.
		 */
		const gemeinschaftlich = inhalt.istGemeinschaftlich || mitglieder.length > 0;
		// Karte und Vollmachtsformular gehen zusammen hinaus — beide gehören
		// dieser Partei, und wer nur eines bekommt, merkt das Fehlen nicht.
		const beilagen = [kartenname, formularnamen[nummer]];
		for (const k of kartenempfaenger) {
			empfaenger.push(empfaengerFuer(k.parteiId, k.name, k.adresse, beilagen, gemeinschaftlich));
		}

		/** Ob an diese Kennung tatsächlich etwas hinausgeht. */
		const angeschrieben = (id: Id) =>
			kartenempfaenger.some((k) => k.parteiId === id && k.adresse !== '');

		zeilen.push([
			inhalt.name,
			// Steht bei der Zeile keine Datei, muss daneben der Grund stehen —
			// sonst sieht es aus, als sei sie beim Versand vergessen worden.
			gemeldeteErreichbar && eigeneAdresse !== ''
				? 'stimmberechtigt — Zustellung an die gemeldete Adresse'
				: 'stimmberechtigt',
			inhalt.ausgeuebtDurch,
			inhalt.einheiten.map((e) => e.label).join(', '),
			String(inhalt.kopfstimmen),
			`${inhalt.wertquote} / ${satz.rahmen.gesamtquote}`,
			eigeneAdresse,
			angeschrieben(parteiId) ? kartenname : '',
			angeschrieben(parteiId) ? formularnamen[nummer] : ''
		]);

		for (const m of alleMitglieder) {
			const eigene = (m.email ?? '').trim();
			if (m.archiviertAm) {
				zeilen.push([
					m.displayName,
					`mitberechtigt an «${inhalt.name}» — im Archiv, nicht angeschrieben`,
					'',
					'',
					'',
					'',
					eigene,
					'',
					''
				]);
				continue;
			}

			/*
			 * **Die Rolle nennt den Ausgang, nicht die Absicht.** Sie ist in der
			 * Versandliste die einzige Auskunft darüber, warum bei jemandem keine
			 * Datei steht — und «Zustellung an die gemeldete Adresse» zu schreiben,
			 * wo gar nichts zugestellt wird, verdeckt genau den Fall, der den
			 * Beschluss anfechtbar macht (Art. 75 ZGB).
			 */
			let rolle = `mitberechtigt an «${inhalt.name}»`;
			if (!imKreis.has(m.partyId)) {
				rolle += gemeldeteErreichbar
					? ' — Zustellung an die gemeldete Adresse'
					: ' — nicht angeschrieben: die gemeldete Zustelladresse trägt keine E-Mail';
			} else if (angeschrieben(m.partyId)) {
				rolle += m.istZustelladresse
					? ' — gemeldete Zustelladresse, bekommt die Zugangskarte'
					: ' — bekommt die Zugangskarte';
			} else if (eigene === '') {
				rolle += m.istZustelladresse
					? ' — gemeldete Zustelladresse, keine E-Mail erfasst'
					: ' — keine E-Mail-Adresse erfasst';
			} else {
				/*
				 * Dieselbe Adresse wie die Zeile oder wie eine andere Person — bei
				 * Eheleuten mit einem gemeinsamen Postfach der Normalfall. Die Karte
				 * ist dort schon einmal hingegangen; eine zweite Sendung mit
				 * derselben Datei sagte nichts Neues.
				 *
				 * **Der Satz nennt nicht, wessen Adresse es ist.** Er stünde sonst
				 * einmal richtig («die der Zeile») und einmal falsch, sobald zwei
				 * Personen sich ein Postfach teilen und die Zeile gar keine trägt.
				 */
				rolle += ' — dieselbe Adresse wurde bereits angeschrieben';
			}

			zeilen.push([
				m.displayName,
				rolle,
				// Einheiten, Kopfstimmen und Wertquote bleiben leer statt null: Die
				// mitberechtigte Person hält keine Einheit und keine Stimme. Eine
				// Null sähe aus wie eine halbfertige Erfassung.
				'',
				'',
				'',
				'',
				eigene,
				angeschrieben(m.partyId) ? kartenname : '',
				angeschrieben(m.partyId) ? formularnamen[nummer] : ''
			]);
		}
	}

	const versandliste = schreibe([
		/*
		 * **Zwei Dateispalten seit dem 07.09.2026** (Code-Review). Das Archiv
		 * trägt je Partei ein Vollmachtsformular mehr; stünde es in keiner Zeile,
		 * müsste die Zuordnung doch wieder aus den Dateinamen abgeleitet werden —
		 * genau das, was diese Liste erspart.
		 */
		[
			'Partei',
			'Rolle',
			'Stimme übt aus',
			'Einheiten',
			'Kopfstimmen',
			'Wertquote',
			'E-Mail',
			'Zugangskarte',
			'Vollmachtsformular'
		],
		...zeilen
	]);

	dateien.push({ name: 'Versandliste.csv', inhalt: new TextEncoder().encode(versandliste) });

	return {
		bytes: packe(dateien, dosZeitstempel(zeitpunkt)),
		dateiname: `Versandpaket-${versammlung.datum}.zip`,
		inhalt: dateien.map((d) => d.name),
		dateien,
		empfaenger
	};
}
