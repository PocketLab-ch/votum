import { KONSULTATIV_OFFEN, KONSULTATIV_OFFEN_NEU } from '$lib/domain/konsultativ';
import { kopfstimmenAn } from '$lib/domain/auszaehlung';
import { l3Wirkt } from '$lib/domain/entscheidbaum';
import { einsprachelesartVon } from '$lib/domain/lesarten';
import { error, fail, redirect } from '@sveltejs/kit';
import { keksSicher } from '$lib/server/keks';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { standVon } from '$lib/domain/anwesenheit';
import { BELEGT_MELDUNG } from '$lib/domain/geraetesitzung';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { holeAnwesenheitsereignisse, meldeTeilnahmeAn } from '$lib/server/anwesenheit';
import { istEingerichtet } from '$lib/server/authentik';
import { holeMomentaufnahme } from '$lib/server/freigabe';
import { holePapierabgaben } from '$lib/server/papierabgabe';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { NACHLAUF_MS } from '$lib/domain/versammlung';
import { holeTraktanden } from '$lib/server/traktanden';
import { naechsterPunkt } from '$lib/domain/traktandenbaum';
import { massgebenderDerSache } from '$lib/domain/abstimmung';
import { beschlossen, ergebnislage } from '$lib/domain/auszaehlung';
import { holeMehrheitsvorschau, holeErgebnisse,
	gibStimmenAb,
	holeDurchgaenge,
	holeEigeneStimmen,
	holeStimmsperren,
	sperreInWorten
} from '$lib/server/abstimmung';
import { holeAusuebbare } from '$lib/server/vollmacht';
import { holeVeto, erfasseVeto } from '$lib/server/veto';
import {
	erhebeLage,
	erklaere,
	holeEmpfehlungen,
	setzeWeisungen,
	widerrufeEigene
} from '$lib/server/selbstvollmacht';
import { empfehlungsstand } from '$lib/domain/empfehlung';
import { ermittleStand, verkuendeStand } from '$lib/server/versammlungsstand';
import {
	beendeEigeneSitzung,
	lageDesKartencodes,
	leseKartenscan,
	leseKeks,
	loescheKartenscan,
	loescheKeks,
	loeseCodeEin,
	loeseSitzungAuf,
	meldeNachEinloesungAn,
	setzeKeks
} from '$lib/server/zugangssitzung';
import { pruefeIrgendeinenCode } from '$lib/domain/zugang';
import { haltCodeversuchFest } from '$lib/server/codeversuche';
import { text } from '$lib/server/formular';
import type { Actions, PageServerLoad } from './$types';

/**
 * Die Sicht des Eigentümers — ohne Code in der Adresszeile.
 *
 * `/z/<code>` merkt den Code nur vor und leitet hierher weiter; eingelöst wird
 * erst das Formular dieser Seite (`?/karte`), damit ein blosser Abruf des Links
 * keinen Zugang verbraucht (FP-1, 12.11.2026). Danach steht die Sitzung im Keks
 * und nicht mehr auf dem Bildschirm. Wer ohne Keks hierherkommt, bekommt das
 * Eingabefeld: Der QR auf der Karte ist klein, und eine alte Kamera bei
 * schlechtem Licht liest ihn nicht. Vorher blieb in diesem Fall nur, die volle
 * Adresse samt Host abzutippen.
 *
 * **Der vorgemerkte Code steht nie in den Daten dieser Seite.** `load` gibt
 * allein das Kennzeichen `kartewartet` zurück; gelesen wird der Keks erst in
 * der Aktion. So kann er weder in der Adresse noch im HTML auftauchen.
 *
 * Es erscheint **nur**, was der Eigentümer wissen muss: seine eigene Stimmkraft,
 * die offene Abstimmung und **wo die Versammlung steht**. Keine anderen Namen,
 * kein Zwischenstand einer laufenden Abstimmung, kein Stimmverhalten anderer.
 *
 * **Seit dem 04.09.2026 auch Traktanden** (Produktentscheid), und zwar in zwei
 * eng gefassten Formen. Vorher stand hier «keine Traktanden», und das war der
 * Grund für zwei Befunde aus dem Prüfdurchgang der Eigentümersicht:
 *
 *   * **Der Dreischritt** nennt Nummer und Titel des vorherigen, aufgerufenen
 *     und nächsten Geschäfts. Ohne ihn war der Bildschirm während der
 *     Diskussion leer, und bei Traktanden ohne Abstimmung erfuhr man über das
 *     Gerät nie, wo die Versammlung steht. **Der Antragswortlaut bleibt an der
 *     Leinwand**: Das Gerät ordnet ein, die Wand zeigt die Frage.
 *   * **Der Verlauf** sammelt, was schon **verkündet** wurde. Er zeigt nichts,
 *     was nicht ohnehin im Saal laut gesagt wurde, und **nicht die eigene
 *     Stimme**: Der Nachweis ist das Protokoll und nicht dieses Gerät.
 */
/**
 * Was auf dem Bildschirm steht, wenn ein Weg herein nicht geklappt hat.
 *
 * Die Gründe stehen hier und nicht in der Adresse: Sie sind ganze Sätze, und
 * die Adresse landet im Verlauf des Browsers und in Zugriffsprotokollen. Was
 * nicht zu unterscheiden ist, wird auch nicht unterschieden — «kein Zugang»
 * sagt nicht, ob das Konto unbekannt ist oder ob es nur zu keiner offenen
 * Versammlung gehört.
 */
/**
 * Der Satz nach einer Übernahme — an **einer** Stelle, für beide Zweige.
 *
 * Er erscheint angemeldet (nach der eigenen Übernahme) und abgemeldet (falls
 * die Sitzung inzwischen wieder weg ist). Zwei Fassungen liefen auseinander.
 */
const UEBERNOMMEN_MELDUNG =
	'Angemeldet. Ihr anderes Gerät wurde dabei abgemeldet — ein Zugang gilt für ein Gerät. ' +
	'Hat dort jemand anderes für Sie gestimmt, sagen Sie es der Sitzungsleitung.';

function grundZuStand(stand: string | null): string | undefined {
	switch (stand) {
		case 'belegt':
			return BELEGT_MELDUNG;
		case 'uebernommen':
			return UEBERNOMMEN_MELDUNG;
		case 'kein_zugang':
			return (
				'Zu Ihrem Konto ist gerade keine offene Versammlung eingetragen. Wenden Sie sich an ' +
				'die Bewirtschaftung, oder melden Sie sich mit dem Code Ihrer Zugangskarte an.'
			);
		case 'authentik_aus':
			return (
				'Die Anmeldung über Ihr Konto ist gerade nicht möglich. Der Code auf Ihrer ' +
				'Zugangskarte führt Sie unabhängig davon herein.'
			);
		case 'abgelehnt':
			return 'Die Anmeldung wurde abgebrochen oder abgelehnt.';
		case 'merkmal':
		case 'unvollstaendig':
			return 'Die Anmeldung liess sich nicht zu Ende führen. Versuchen Sie es noch einmal.';
		default:
			return undefined;
	}
}

/**
 * Was an diesem Abend schon beschlossen wurde.
 *
 * **Zweimal gebraucht** (04.09.2026): während der Versammlung unter der
 * Erkennungskarte, und in der Stunde nach dem Schluss als Nachschau. Zweimal
 * geschrieben liefen die beiden auseinander, und dann zeigte das Telefon nach
 * dem Schluss etwas anderes als kurz davor.
 *
 * **Nur verkündete Ergebnisse.** `verkuendetAm === null` heisst «nur die
 * Sitzungsleitung sieht es», und daran ändert eine Übersicht nichts. Was hier
 * steht, wurde im Saal ohnehin laut gesagt.
 *
 * **Ohne die eigene Stimme** (Produktentscheid 04.09.2026). Der Nachweis, wie
 * gezählt wurde, ist das Protokoll und nicht dieses Gerät.
 *
 * **In der Reihenfolge des Abends**, nicht in der der Datenbank:
 * `holeDurchgaenge` sortiert nach Traktandumkennung, ein vorgezogenes Geschäft
 * stünde sonst willkürlich in der Liste.
 */
async function beschlussverlauf(
	operatorId: string,
	meetingId: string,
	durchgaenge: Awaited<ReturnType<typeof holeDurchgaenge>>,
	traktandumVon: (id: string) => { nummer: string; knoten: { titel: string } } | undefined
) {
	const verkuendete = durchgaenge
		.filter((d) => d.zustand === 'geschlossen' && d.verkuendetAm !== null)
		.sort((a, b) => String(a.verkuendetAm).localeCompare(String(b.verkuendetAm)));

	/*
	 * **Eine Transaktion für alle** (aus dem Code-Review). Je Geschäft eine
	 * eigene wären bei zwanzig Traktanden und hundert Telefonen rund
	 * zweitausend Auszählungen im Augenblick des Durchgangswechsels.
	 * `holeErgebnisse` fängt ausserdem ein einzelnes Geschäft ab, das sich nicht
	 * auszählen lässt: Sonst würde das Laden von `/z` für **alle** Telefone im
	 * Saal zum Fehler, und zwar für den Rest des Abends.
	 */
	const ergebnisse = await holeErgebnisse(
		operatorId,
		meetingId,
		verkuendete.map((d) => d.id)
	);

	return verkuendete.flatMap((d) => {
		const t = traktandumVon(d.traktandumId);
		if (!t) return [];
		return [
			{
				id: d.id,
				nummer: t.nummer,
				titel: t.knoten.titel,
				// Über `beschlossen`: offen und «kein Beschluss» sind nicht «abgelehnt».
				angenommen: beschlossen(ergebnislage(ergebnisse.get(d.id)?.auszaehlung ?? null))
			}
		];
	});
}

export const load: PageServerLoad = async ({ cookies, url }) => {
	const merkmal = leseKeks(cookies);
	const kartenwartet = leseKartenscan(cookies) !== null;
	/*
	 * **Ein vorgemerkter Scan geht vor, auch vor einer bestehenden Sitzung**
	 * (FP-1, Code-Review 12.11.2026). Die Seite zeigt dann nur das wartende
	 * Formular; die alte Sitzung muss dafür nicht aufgelöst werden. Liefe sie
	 * durch und würfe dabei, erschiene das Formular nie, und der neue Code
	 * bliebe bis zum Ablauf des Kekses liegen. Wer im einen Haus angemeldet ist
	 * und die Karte eines anderen scannt, wechselt so den Zugang, wie es der
	 * frühere Weg über `/z/<code>` tat.
	 */
	if (!merkmal || kartenwartet) {
		// Die Aktion `karte` (und im Zweig der Sitzungsleitung `/z/<code>`) leitet
		// hierher weiter und gibt den Grund mit, wenn der Code nicht griff. Ohne
		// ihn stünde nach dem Abscannen wortlos ein leeres Eingabefeld da.
		const stand = url.searchParams.get('stand');
		return {
			angemeldet: false as const,
			/*
			 * Nur das Kennzeichen, nie der Code: Die Seite schickt daraufhin das
			 * Formular ab, und die Aktion liest den Code aus dem Keks.
			 */
			kartewartet: kartenwartet,
			grund: grundZuStand(stand),
			belegt: stand === 'belegt',
			/*
			 * **Wann ein anderes Konto der Ausweg ist.** Bei «kein Zugang» und bei
			 * «mehrdeutig» kam eine Kennung zurück, die hier nicht weiterführt —
			 * und ein zweiter Versuch führte an dieselbe Wand, weil Authentik
			 * stillschweigend dieselbe Sitzung nähme. Bei einem Abbruch oder einem
			 * ausgefallenen Dienst hilft es dagegen nichts, und ein Angebot, das
			 * nicht hilft, verlängert nur die Suche.
			 */
			andereKennung: stand === 'kein_zugang' || stand === 'belegt',
			// Der Knopf erscheint nur, wenn der Dienst überhaupt eingerichtet ist —
			// sonst führte er in eine Sackgasse, und zwar genau die Person, die
			// gerade vor dem Saal steht.
			authentik: istEingerichtet()
		};
	}

	const befund = await loeseSitzungAuf(merkmal);
	if (!befund.gueltig) {
		/*
		 * **Der Keks bleibt, die Auskunft auch.**
		 *
		 * Bisher wurde er hier gelöscht, damit der Weg zurück zum Eingabefeld frei
		 * ist. Die Wirkung war eine andere: Die Meldung «Die Versammlung ist
		 * geschlossen» stand genau bis zum nächsten Nachladen, und danach las der
		 * Eigentümer wieder «Tippen Sie den Code von Ihrer Zugangskarte ein» — als
		 * wäre nichts gewesen, mit der Aufforderung zu einer Handlung, die nichts
		 * mehr bewirkt. Aufgefallen als sprunghafter Fehlschlag im Durchlauf; der
		 * Test hatte recht und die Seite unrecht.
		 *
		 * Der Weg zurück steht jetzt als Schaltfläche da, wo er hingehört: als
		 * Angebot, nicht als Nebenwirkung.
		 */
		/*
		 * **Die Nachschau: eine Stunde nach dem Schluss** (04.09.2026, Entscheid
		 * Auftraggeber: «dieselbe Stunde auf dem Mobiltelefon»).
		 *
		 * Der Verlauf der Beschlüsse war bis hierher nur **während** des Abends
		 * sichtbar, also gerade nicht in dem Augenblick, für den er gedacht ist:
		 * Mit dem Schluss wird der Zugang wertlos, und die Seite zeigte statt
		 * einer Übersicht eine rot hinterlegte Absage.
		 *
		 * **Dieselbe Frist wie beim Anzeigecode der Leinwand** (`versammlungen.ts`,
		 * seit 21.08.2026), und aus demselben Grund: Was im Saal vorgelesen wurde,
		 * soll nicht Wochen später noch Beschlüsse hergeben, aber der Weg aus dem
		 * Saal darf nicht mitten im Satz abbrechen.
		 *
		 * **Nur lesen.** `befund.gueltig` bleibt `false`, alle acht Aktionen dieser
		 * Seite prüfen darauf und bleiben zu. Was hier entsteht, ist eine eigene,
		 * schwächere Seite: der Verlauf und sonst nichts.
		 */
		const n = befund.nachschau;
		if (n) {
			const v = await holeVersammlung(n.operatorId, n.meetingId);
			const seit = v?.geschlossenAm ? Date.now() - new Date(v.geschlossenAm).getTime() : Infinity;
			// `v` ist hier nicht null: Ohne Versammlung wäre `seit` unendlich und
			// die Nachschau schon an der Frist gescheitert. Der Typprüfer weiss das
			// nicht, und eine Behauptung wäre schlechter als die Prüfung.
			if (v && seit <= NACHLAUF_MS) {
				const [durchgaenge, traktanden] = await Promise.all([
					holeDurchgaenge(n.operatorId, n.meetingId),
					holeTraktanden(n.operatorId, n.meetingId)
				]);
				const verlauf = await beschlussverlauf(
					n.operatorId,
					n.meetingId,
					durchgaenge.filter((d) => !d.ueberholtAm),
					(id) => traktanden.find((t) => t.knoten.id === id)
				);
				/*
				 * **Das Datum, nicht die Gemeinschaft** (Bedienbarkeitsprüfung
				 * 05.09.2026, Befund 11 der Telefonsicht; Produktentscheid
				 * 06.09.2026).
				 *
				 * Der Schlussbildschirm nannte weder das eine noch das andere: Wer
				 * das Telefon später wieder ansieht, fand eine Liste von
				 * Beschlüssen ohne Angabe, wozu sie gehören. Den Namen der
				 * Gemeinschaft trägt er trotzdem nicht — die Zusicherung weiter
				 * unten in `+page.svelte` («Wer das Telefon nach dem Abend findet,
				 * soll nicht lesen können, wem es gehört») wiegt hier schwerer, und
				 * Gemeinschaftsnamen enthalten im Bestand regelmässig die Strasse.
				 * Das Datum ordnet ein, ohne das Haus zu nennen.
				 */
				return {
					angemeldet: false as const,
					kartewartet: false,
					grund: befund.grund ?? '',
					beendet: true,
					nachschau: { verlauf, datum: v.datum }
				};
			}
		}

		return {
			angemeldet: false as const,
			kartewartet: false,
			grund: befund.grund ?? '',
			beendet: true
		};
	}

	const operatorId = befund.operatorId as string;
	const meetingId = befund.meetingId as string;

	const versammlung = await holeVersammlung(operatorId, meetingId);
	if (!versammlung) error(500, 'Versammlung nicht auffindbar');

	const [gemeinschaft, momentaufnahme, ereignisse, papierabgaben] = await Promise.all([
		holeGemeinschaft(operatorId, versammlung.stwegId),
		holeMomentaufnahme(operatorId, meetingId),
		holeAnwesenheitsereignisse(operatorId, meetingId),
		/*
		 * **Der Papiervermerk, und zwar unabhängig von einer offenen Abstimmung**
		 * (11.09.2026, vom Auftraggeber im Eingangstest gefunden).
		 *
		 * Bisher stand er nur in `holeStimmsperren`, und die wird erst geholt,
		 * wenn ein Durchgang offen ist. Zwischen Einlass und erster Frage las die
		 * Partei deshalb «Sobald eine Abstimmung eröffnet wird, erscheint die
		 * Frage hier auf dieser Seite» — einen Satz, der für sie nicht zutrifft
		 * und den sie nicht widerlegen kann, bis nichts erscheint. Genau die Lage,
		 * aus der ein Anruf mitten in der Versammlung wird.
		 */
		holePapierabgaben(operatorId, meetingId)
	]);
	if (!momentaufnahme) error(500, 'Es ist nicht auffindbar, wer stimmberechtigt ist');

	const liste = stimmkraftliste(momentaufnahme);
	const eigen = liste.eintraege.find((e) => e.partyId === befund.parteiId);
	if (!eigen) error(500, 'Diese Partei ist nicht stimmberechtigt');

	const stand = standVon(ereignisse.filter((e) => e.parteiId === befund.parteiId));

	// Die offene Abstimmung — nur die Frage, nie ein Zwischenstand. Was das
	// Telefon nicht bekommt, kann es nicht anzeigen.
	// Ungefiltert für die Kette der Sache nach einem Rückkommen über einen
	// Folgeantrag: Der Durchgang des Grundantrags ist dann überholt, und ohne ihn
	// bricht `massgebenderDerSache` ab (Codeprüfung B2b, M2).
	const alleDurchgaenge = await holeDurchgaenge(operatorId, meetingId);
	const durchgaenge = alleDurchgaenge.filter((d) => !d.ueberholtAm);
	const offen = durchgaenge.find((d) => d.zustand === 'offen') ?? null;
	const zuletzt = durchgaenge.length > 0 ? durchgaenge[durchgaenge.length - 1] : null;

	/*
	 * **Die Traktanden immer, nicht nur bei einer Abstimmung** (04.09.2026,
	 * Produktentscheid). Der Dreischritt unten braucht sie auch, solange noch gar
	 * nicht abgestimmt wurde: Wer im Saal sitzt, soll sehen, wo die Versammlung
	 * steht, und nicht auf die erste Freigabe warten müssen.
	 */
	const traktanden = await holeTraktanden(operatorId, meetingId);
	const traktandumVon = (id: string) => traktanden.find((t) => t.knoten.id === id);

	let abstimmung = null;
	if (offen) {
		const t = traktandumVon(offen.traktandumId);

		/*
		 * **Alle Stimmen, die dieses Gerät ausüben darf** (Fall des Auftraggebers vom
		 * 04.08.2026): die eigene und jede, für die eine bestätigte Vollmacht auf
		 * diese Partei lautet. Wer drei Vollmachten hält, tippt sie hier ab und
		 * muss nicht die Sitzungsleitung bitten.
		 */
		const ausuebbare = await holeAusuebbare(operatorId, meetingId, befund.parteiId as string);

		/*
		 * **Wer bei diesem Traktandum nicht mitstimmt** (ZGB Art. 68 und 649b Abs. 2;
		 * BGE 134 III 481 E. 3.8). Am Server ist es ohnehin verschlossen —
		 * hier steht es, damit das Telefon nicht drei Knöpfe anbietet, die alle in
		 * dieselbe Absage laufen.
		 */
		const sperrliste = await holeStimmsperren(operatorId, meetingId, offen.traktandumId);
		const sperren = new Map(sperrliste.map((s) => [s.parteiId, sperreInWorten(s)]));

		/*
		 * **Das Veto der Betroffenen im Ausstand** (26.09.2026). Wer bei
		 * diesem Traktandum betroffen **und** im Ausstand ist, entscheidet
		 * während der Abstimmung am eigenen Telefon über seine Zustimmung;
		 * die Stimme bleibt gesperrt, das Veto zählt nur dort. `holeVeto`
		 * liefert nur, wo das Erfordernis das hergibt (Form
		 * `im_saal_oder_vorab`) und der Durchgang offen ist.
		 */
		const vetos = new Map(
			(await holeVeto(operatorId, meetingId, offen.traktandumId)).map((x) => [x.parteiId, x])
		);

		const parteien = [];
		for (const a of ausuebbare) {
			/*
			 * **Die Weisung der vertretenen Person** (Zusatzblock): eine
			 * Empfehlung, keine Stimme. Sie steht am Block und hebt den Knopf
			 * hervor — drücken muss ihn die bevollmächtigte Person selbst.
			 *
			 * Und sie fällt weg, wenn der Antrag inzwischen anders lautet: Wer nach
			 * einer überholten Weisung abstimmt, stimmt gegen den Willen, den er zu
			 * vertreten meint.
			 */
			let weisung = null;
			if (a.vollmachtId && t?.knoten.antragswortlaut) {
				const empfohlen = (await holeEmpfehlungen(operatorId, a.vollmachtId)).find(
					(e) => e.traktandumId === offen.traktandumId
				);
				if (empfohlen) {
					weisung = empfehlungsstand(
						empfohlen.wahl,
						empfohlen.wortlaut,
						t.knoten.antragswortlaut,
						a.name
					);
				}
			}

			parteien.push({
				parteiId: a.parteiId,
				name: a.name,
				einheiten: a.einheiten,
				eigene: a.eigene,
				weisung,
				/** Gesetzt, wenn für diese Partei hier nicht gestimmt werden darf. */
				gesperrt: sperren.get(a.parteiId) ?? null,
				/*
				 * Der Veto-Stand dieser Partei, sonst `null`. Gesetzt heisst:
				 * Die Partei ist betroffen und im Ausstand, und der Durchgang
				 * lässt ein Veto zu — dann zeigt der Block die Veto-Knöpfe
				 * statt der gesperrten Stimme.
				 */
				veto: vetos.get(a.parteiId) ?? null,
				// Was für diese Partei bisher gestimmt wurde, je Einheit. Eine
				// Berichtigung bis zum Schliessen ist ausdrücklich vorgesehen (AD-5).
				bisher: await holeEigeneStimmen(operatorId, offen.id, a.parteiId)
			});
		}

		/*
		 * **Was nötig ist, steht VOR der Abstimmung da** (04.09.2026, aus dem
		 * Prüfdurchgang der Eigentümersicht).
		 *
		 * Bisher stand über den Knöpfen allein der Fallname, etwa «Gewöhnliche
		 * Verwaltungshandlung». Der erklärende Satz kam erst **im Ergebnis**, also
		 * nachdem entschieden war. Wer wissen will, ob seine Stimme etwas bewirken
		 * kann, braucht die Auskunft vorher; der Titel allein ist für eine Laiin
		 * eine leere Etikette.
		 *
		 * **Dieselbe Quelle wie die Leinwand** (`/p` seit dem 22.08.2026):
		 * `holeMehrheitsvorschau`. Zwei Sätze über dieselbe Mehrheit liefen
		 * auseinander, und dann stünde an der Wand etwas anderes als in der Hand.
		 */
		/*
		 * **Mit Fangblock, wie der Verlauf** (04.09.2026, aus dem Code-Review).
		 * Ohne ihn würde die Eigentümerseite zur Fehlerseite, und **dann kann
		 * niemand mehr abstimmen**, für eine Auskunft, die nur nett zu haben ist.
		 *
		 * **Was er seit dem 25.09.2026 noch fängt:** nur echte Fehler. Die zwei
		 * fachlichen Würfe aus `zaehleAus`, deretwegen er am 04.09.2026 entstand
		 * (fehlende Kopfschwelle, Zustimmung Betroffener ohne eingetragene
		 * Betroffene), fängt jetzt `mehrheitsvorschau` selbst und liefert einen
		 * saaltauglichen Satz, der hier auch ankommt.
		 */
		let vorschau = null;
		try {
			vorschau = await holeMehrheitsvorschau(
				operatorId,
				meetingId,
				offen.traktandumId,
				offen.erfordernis ?? null
			);
		} catch (fehler) {
			/*
			 * Seit dem 25.09.2026 fängt `mehrheitsvorschau` die fachlichen Fälle
			 * selbst und nennt den Grund. Was hier noch ankommt, ist ein echter
			 * Fehler; er bleibt für die Eigentümerseite still, aber nicht für den
			 * Betrieb.
			 */
			console.error(
				`[z] Mehrheitsvorschau für Traktandum ${offen.traktandumId} gescheitert:`,
				fehler instanceof Error ? fehler.message : fehler
			);
			vorschau = null;
		}

		/*
		 * **Der wievielte Durchgang das ist** (Bedienbarkeitsprüfung 05.09.2026,
		 * Befund 4 der Telefonsicht).
		 *
		 * «Im zweiten Durchgang ist die Karte wortwörtlich dieselbe wie beim
		 * ersten Mal, ohne Hinweis, dass es ein zweiter ist. Fünfzehn Zentimeter
		 * tiefer steht gleichzeitig das alte Ergebnis ‹abgelehnt›.» Der Satz, der
		 * das erklärt, stand auf dem Leitungsschirm — nicht dort, wo gestimmt
		 * wird. Gerettet hat den Prüfer allein, dass beide Stimmen orange auf
		 * «noch nicht gestimmt» standen.
		 *
		 * Ein früherer Durchgang zum selben Traktandum steht noch in der Liste:
		 * Beim Rückkommen bleibt er gültig (nur ein **überholter** trägt
		 * `ueberholtAm`, und die sind oben schon weggefiltert). Kommt heute kein
		 * Beschluss zustande, gilt er weiter — deshalb wird sein Ergebnis
		 * mitgenannt und nicht bloss die Tatsache der Wiederholung.
		 */
		/*
		 * **Der massgebende frühere Durchgang, nicht der erste** (Code-Review
		 * 06.09.2026). Ein zweiter Rückkommensantrag ist zulässig; ab dem dritten
		 * Durchgang nennt `find` sonst das Ergebnis von Durchgang 1, während der
		 * geltende Beschluss aus Durchgang 2 stammt. Die Liste kommt sortiert
		 * (`ORDER BY agenda_item_id, ordinal`), der letzte ist also der jüngste.
		 */
		/*
		 * Liegt der geltende Beschluss nach einem früheren Rückkommen an einem
		 * Folgeantrag, ist er der frühere zu derselben Sache, auch wenn jetzt
		 * wieder über den alten Antrag abgestimmt wird (Codeprüfung B2b, M2).
		 */
		const frueherer =
			durchgaenge.filter((d) => d.traktandumId === offen.traktandumId && d.id !== offen.id).at(-1) ??
			(offen.rueckkommensantragId
				? (massgebenderDerSache(
						alleDurchgaenge.filter((d) => d.id !== offen.id),
						offen.traktandumId
					) ?? undefined)
				: undefined);
		const fruehereErgebnisse = frueherer
			? await holeErgebnisse(operatorId, meetingId, [frueherer.id])
			: null;
		/*
		 * **Über `ergebnislage`, nicht über das Rohfeld** (Code-Review
		 * 06.09.2026). Bei offenem Stichentscheid ist `angenommen` gleich
		 * `false` und sagt nichts: Die Karte schriebe «Beim ersten Mal wurde sie
		 * abgelehnt» über eine Ablehnung, die niemand beschlossen hat. Dieselbe
		 * Klasse war am 05.09.2026 an acht Stellen zu berichtigen — sie kommt
		 * zurück, sobald jemand wieder direkt nach `angenommen` greift.
		 */
		const fruehereLage = frueherer
			? ergebnislage(fruehereErgebnisse?.get(frueherer.id)?.auszaehlung ?? null)
			: 'offen';

		/*
		 * **Nach dem Rückkommen über einen Folgeantrag** (Produktentscheid
		 * 30.09.2026; Plan Folgeantrag nach Rückkommen, Soll 6). Dann liegt der
		 * frühere Durchgang an einem anderen Traktandum, und `zuvor` fand ihn
		 * nicht: Die Karte schwieg, obwohl auch ein Nein den bisherigen Beschluss
		 * aufhebt. Wer drückt, muss das vorher wissen.
		 */
		const rueckkommenZiel = offen.rueckkommensantragId
			? traktandumVon(offen.rueckkommensantragId)?.knoten.rueckkommenZielId
			: null;
		const stattGrund =
			rueckkommenZiel && rueckkommenZiel !== offen.traktandumId
				? traktandumVon(rueckkommenZiel)
				: undefined;
		const geltendZurSache = stattGrund
			? massgebenderDerSache(
					alleDurchgaenge.filter((d) => d.id !== offen.id),
					stattGrund.knoten.id
				)
			: null;
		const stattAntrag =
			stattGrund && geltendZurSache
				? {
						// Das Traktandum, an dem der geltende Beschluss liegt: nach einem
						// zweiten Rückkommen ein früherer Folgeantrag (Codeprüfung B2b,
						// zweiter Durchgang; wie die Sätze nach Fachprüfung Frage A).
						titel: (() => {
							const bei = traktandumVon(geltendZurSache.traktandumId) ?? stattGrund;
							return `${bei.nummer} ${bei.knoten.titel}`;
						})(),
						lage: ergebnislage(
							(await holeErgebnisse(operatorId, meetingId, [geltendZurSache.id])).get(
								geltendZurSache.id
							)?.auszaehlung ?? null
						)
					}
				: null;

		abstimmung = {
			durchgangId: offen.id,
			/** Was ein früherer Durchgang zu derselben Sache ergeben hat. */
			zuvor: frueherer ? { lage: fruehereLage } : null,
			/** Statt welches Antrags nach einem Rückkommen abgestimmt wird, und was dort gilt. */
			stattAntrag,
			titel: t ? `${t.nummer} ${t.knoten.titel}` : '',
			frage: t?.knoten.antragswortlaut ?? '',
			// Konsultativ ohne Erfordernis, wie die Wand (`versammlungsstand.ts`):
			// Gegen die Schwelle wird nichts entschieden (Befund 8, H7 Teil D).
			erfordernis: offen.konsultativ ? '' : (offen.erfordernis?.titel ?? ''),
			// Geheime Abstimmung (Migration 141): Das Telefon sagt es vor dem
			// Abstimmen an; die Auszählung ändert sich nicht, nur die Anzeige.
			geheim: offen.geheim,
			// Konsultativ (Migration 158): Das Telefon sagt es vor dem Abstimmen an.
			konsultativ: offen.konsultativ,
			// Der Satz dazu nach dem Grund (Migration 174, L5).
			konsultativSatz: offen.konsultativNeu ? KONSULTATIV_OFFEN_NEU : KONSULTATIV_OFFEN,
			noetig: offen.konsultativ ? null : (vorschau?.satz ?? null),
			// Befund 15: Auch am Telefon sieht man die Kopfzahl fallen und die
			// Quotenzahl stehen bleiben. Ohne Namen (AD-11).
			ausstandsgrund: vorschau?.ausstandshinweis ?? null,
			/*
			 * Ob die Zahl noch wandert: Wer später kommt, verschiebt die
			 * Bezugsgrösse. Ohne diesen Hinweis läse sich «nötig 7» wie eine
			 * Zusicherung, die der Abend widerlegt.
			 */
			noetigWandert: vorschau?.anwesenheitsabhaengig ?? false,
			bisher: parteien.find((p) => p.eigene)?.bisher ?? {},
			parteien
		};
	}

	// Ein verkündetes Ergebnis erscheint auch auf dem Telefon (FR-40).
	let ergebnis = null;
	if (!offen && zuletzt?.zustand === 'geschlossen') {
		const stand = await ermittleStand(operatorId, meetingId);
		if (stand?.abstimmung?.ergebnis) {
			ergebnis = {
				titel: stand.abstimmung.titel,
				angenommen: stand.abstimmung.ergebnis.angenommen,
				keinBeschluss: stand.abstimmung.ergebnis.keinBeschluss ?? null,
				satz: stand.abstimmung.ergebnis.satz
			};
		}
	}

	/*
	 * **Wo die Versammlung steht** (04.09.2026, Produktentscheid): das vorherige,
	 * das aufgerufene und das nächste Geschäft.
	 *
	 * **Der Anlass** war ein Prüfdurchgang aus Sicht einer Eigentümerin: Ist ein
	 * Traktandum aufgerufen, aber noch keine Abstimmung offen, stand auf dem
	 * Telefon nur «Sie sind als anwesend erfasst». Während der Diskussion, also
	 * genau dann, wenn sie nachlesen möchte, worum es geht, war ihr Bildschirm
	 * leer. Bei Traktanden ohne Abstimmung erfuhr sie über das Gerät nie, wo die
	 * Versammlung steht.
	 *
	 * **Der Wortlaut bleibt an der Wand** (Produktentscheid): Hier stehen Nummer
	 * und Titel, nicht der Antragstext. Das Gerät ordnet ein, die Leinwand zeigt
	 * die Frage.
	 *
	 * Dieselbe Dreiteilung führt die Sitzungsleitung seit dem 21.08.2026 unter
	 * «Ablauf» — dort mit Knöpfen, hier ohne: Die Eigentümerin steuert nichts.
	 */
	/*
	 * **Zurückgezogene bleiben in der Liste, wenn gerade eines davon aufgerufen
	 * ist** (04.09.2026, aus dem Code-Review). Ein Rückzug ist zulässig, solange
	 * kein Durchgang besteht, und `current_agenda_item_id` bleibt dabei stehen.
	 * Filterte man sie immer weg, verschwände der Dreischritt in genau dem
	 * Augenblick, für den er gebaut ist: der leere Bildschirm während der
	 * Diskussion.
	 */
	const aufgerufenesZurueckgezogen = traktanden.some(
		(t) => t.knoten.id === versammlung.aktuellesTraktandumId && t.knoten.rueckzug
	);
	const sichtbare = aufgerufenesZurueckgezogen
		? traktanden
		: traktanden.filter((t) => !t.knoten.rueckzug);
	const stelle = versammlung.aktuellesTraktandumId
		? sichtbare.findIndex((t) => t.knoten.id === versammlung.aktuellesTraktandumId)
		: -1;
	/*
	 * **«Nachher» kommt aus dem Stand, nicht aus der Reihenfolge**
	 * (Bedienbarkeitsprüfung 05.09.2026, Befund 5 der Telefonsicht): Die
	 * Ablaufzeile kündigte «NACHHER: 3.1 Rückkommen» an, während dasselbe 3.1
	 * zehn Zentimeter tiefer als «angenommen» dastand. Ein Rückkommensantrag
	 * steht in der Liste hinter seinem Grundantrag und wird vor ihm
	 * entschieden — die reine Reihenfolge sagt darüber nichts.
	 *
	 * `durchgaenge` ist oben schon um die überholten bereinigt, ein Traktandum
	 * darin ist also wirklich behandelt.
	 */
	const behandelte = new Set(durchgaenge.map((d) => d.traktandumId));
	const alsSchritt = (t: (typeof sichtbare)[number] | undefined) =>
		t ? { nummer: t.nummer, titel: t.knoten.titel } : null;
	/*
	 * **Nur drei Schritte, keine Liste** (Produktentscheid 06.09.2026, nach der
	 * Bedienbarkeitsprüfung vom 05.09.2026, Befund 12 der Telefonsicht).
	 *
	 * Der Prüfer vermisste eine Traktandenliste: «Immer nur vorher / jetzt /
	 * nachher; was noch kommt, ist nicht einsehbar.» Die Daten lägen bereit —
	 * `sichtbare` ist die volle Liste, aus der hier drei Schritte geschnitten
	 * werden.
	 *
	 * Entschieden ist trotzdem dagegen: Im Saal zählt auf dem Telefon nur, was
	 * jetzt zur Abstimmung steht; wer die Traktanden kennen will, hat sie in
	 * der Einladung. Das deckt sich mit dem Entscheid vom 20.08.2026, die
	 * Sicht ruhig zu halten und die Frage nach oben zu stellen.
	 */
	const dreischritt =
		stelle >= 0
			? {
					vorheriges: alsSchritt(sichtbare[stelle - 1]),
					jetzt: alsSchritt(sichtbare[stelle]),
					naechstes: alsSchritt(
						naechsterPunkt(
							sichtbare.map((t) => ({
								...t,
								behandelt: behandelte.has(t.knoten.id),
								aufgerufen: t.knoten.id === versammlung.aktuellesTraktandumId
							}))
						) ?? undefined
					)
				}
			: null;

	/*
	 * **Der Verlauf des Abends** (04.09.2026, Produktentscheid): was schon
	 * beschlossen wurde.
	 *
	 * **Nur verkündete Ergebnisse.** `verkuendetAm === null` heisst «nur die
	 * Sitzungsleitung sieht es», und daran ändert eine Übersicht nichts. Der
	 * Verlauf zeigt damit genau das, was im Saal ohnehin schon laut gesagt
	 * wurde — er trägt es nur zusammen, statt es nach dem nächsten Geschäft
	 * verschwinden zu lassen.
	 *
	 * **Ohne die eigene Stimme** (Produktentscheid 04.09.2026). Der Nachweis,
	 * wie gezählt wurde, ist das Protokoll und nicht ihr Telefon. Ein Gerät, das
	 * nach dem Abend noch verrät, wie sein Besitzer gestimmt hat, wäre ein
	 * Risiko, das diese Anwendung sonst überall vermeidet — und bei einer
	 * geheimen Abstimmung wäre es schlicht falsch.
	 */
	const verlauf = await beschlussverlauf(operatorId, meetingId, durchgaenge, traktandumVon);

	// Der zweite Weg von der Einladung aus: «Ich komme nicht — ich bevollmächtige
	// jemanden.» Nur wo die Gemeinschaft ihn freigeschaltet hat.
	const selbstvollmacht = await erhebeLage(operatorId, meetingId, befund.parteiId as string);

	return {
		angemeldet: true as const,
		kartewartet: false,
		/*
		 * **Was beim Anmelden nebenbei geschah.** Die Übernahme eines anderen
		 * Geräts endet auf einer Seite, auf der man **angemeldet** ist — der Zweig
		 * für die Gründe darüber greift dort nicht mehr. Ohne diese Zeile wäre die
		 * Übernahme genau das, was sie nicht sein darf: lautlos.
		 */
		hinweis: url.searchParams.get('stand') === 'uebernommen' ? UEBERNOMMEN_MELDUNG : null,
		/**
		 * Ob für diese Partei «stimmt von Hand» vermerkt ist.
		 *
		 * **Für die eigene Partei, nicht für vertretene.** Wer eine Vollmacht
		 * hält, sieht die Sperre der vertretenen Partei an ihrem Block, sobald
		 * eine Abstimmung offen ist; hier geht es um den Satz über den eigenen
		 * Zustand, der schon vorher stimmen muss.
		 */
		aufPapier: papierabgaben.some((p) => p.parteiId === befund.parteiId),
		abstimmung,
		ergebnis,
		dreischritt,
		verlauf,
		selbstvollmacht,
		gemeinschaftName: gemeinschaft?.name ?? '',
		versammlung: {
			datum: versammlung.datum,
			uhrzeit: versammlung.uhrzeit,
			ort: versammlung.ort,
			zustand: versammlung.zustand,
			betriebsart: versammlung.betriebsart,
			// Die Unterbrechung samt Wortlaut (Migration 073): Auf dem Telefon soll
			// stehen, warum gerade nichts geht — und was an der Wand steht.
			pause: versammlung.pause ?? null
		},
		ich: {
			name: eigen.displayName,
			ausgeuebtDurch: eigen.ausgeuebtDurch,
			einheiten: eigen.einheiten.map((u) => ({ label: u.label, quote: u.quota })),
			kopfstimmen: eigen.kopfstimmen,
			/*
			 * **Die Stimmen in der laufenden Abstimmung** (Codeprüfung Block 5, N1).
			 * An der Einsprache nach L3 «je Eigentümer» zählt die Partei einmal, auch
			 * mit mehreren Einheiten; die Bestätigung nach der Stimmabgabe nannte
			 * sonst die Kopfstimmen je Einheit der Gemeinschaft.
			 */
			kopfstimmenHier: kopfstimmenAn({ units: eigen.einheiten }, offen?.erfordernis, momentaufnahme),
			/*
			 * A5, Punkt 3 (Review DeepSeek zu Block 5, Befund 2): An der
			 * Einsprache nach L3 «je Eigentümer» hat die Partei eine Stimme,
			 * auch mit mehreren Einheiten. Der Kasten «Sie sind erkannt als»
			 * nannte die Kopfstimmen nach der Zählweise der Gemeinschaft und
			 * widersprach damit dem, was die Bestätigung nach der Stimmabgabe
			 * sagt (`kopfstimmenHier`).
			 */
			einspracheJeEigentuemer:
				offen?.erfordernis !== null &&
				offen?.erfordernis !== undefined &&
				l3Wirkt(offen.erfordernis, momentaufnahme) &&
				einsprachelesartVon(offen.erfordernis) === 'je_eigentuemer',
			wertquote: eigen.wertquote,
			gesamtquote: momentaufnahme.totalQuota,
			/*
			 * **Die Zählweise gehört mit** (04.09.2026, aus dem Code-Review). Der
			 * Hintergrund «Was heisst das?» erklärt die Kopfstimme, und der Satz
			 * «eine je Eigentümer, unabhängig von der Wohnungsgrösse» ist bei einer
			 * Gemeinschaft, die je Einheit zählt, schlicht falsch. Dort steht er
			 * ausgerechnet unter einer Zeile, die «2 Kopfstimmen» sagt.
			 */
			zaehlweise: momentaufnahme.headCountMode
		},
		zustand: stand?.zustand ?? 'nicht_erschienen'
	};
};

/**
 * Ob dieser POST der automatische Anstoss der Seite ist.
 *
 * **Das Kennzeichen `auto` setzt allein das Skript** (FP-1b, 12.11.2026): Es
 * steht an einem eigenen Formular ohne Knopf, das `onMount` abschickt. Der
 * Knopf «Anmelden» gehört einem zweiten Formular und schickt es nicht, auch
 * ohne JavaScript nicht, denn dort wird das Anstossformular nie abgeschickt.
 *
 * **Ein Formular ohne `auto` ist der Tipp**, ob mit `use:enhance`
 * (`multipart/form-data`) oder ohne JavaScript (urlencoded, leerer Körper).
 * Ein POST ganz ohne Formularart erreicht die Aktion nicht: SvelteKit weist
 * ihn vorher mit 415 ab. Die Prüfung der Kopfzeile bleibt als Schutz, falls
 * sich das ändert; dann gälte der Aufruf als Tipp, also als bisheriger Weg.
 */
async function istAnstoss(request: Request): Promise<boolean> {
	const kopf = request.headers.get('content-type') ?? '';
	const formular =
		kopf.startsWith('application/x-www-form-urlencoded') || kopf.startsWith('multipart/form-data');
	if (!formular) return false;
	const daten = await request.formData();
	return text(daten.get('auto')) === '1';
}

export const actions: Actions = {
	/**
	 * Den vorgemerkten Kartencode einlösen: der Weg vom Scannen.
	 *
	 * **Warum erst hier und nicht beim Abruf des Links** (FP-1, 12.11.2026):
	 * Je Zugang ist nur ein Gerät zugelassen. Solange `GET /z/<code>` den Code
	 * sofort einlöste, belegte der Vorschau-Bot eines Messengers oder ein
	 * Mailprogramm den Zugang, und der Eigentümer kam mit seiner Karte nicht
	 * mehr hinein. Der Abruf merkt den Code nur vor; diese Aktion löst ihn ein,
	 * mit derselben Folge wie der bisherige Weg.
	 *
	 * **Vor Beginn der Versammlung erst auf einen Tipp** (FP-1b, 12.11.2026).
	 * Der Anstoss der Seite führt JavaScript aus und schickte das Formular
	 * damit weiterhin selbst ab; ein Linkprüfer verbrauchte den Zugang also
	 * trotzdem. Er kennzeichnet sich jetzt mit dem Feld `auto`. Damit wird ein
	 * Kartencode nur eingelöst, wenn die Versammlung läuft; sonst bleibt der
	 * Keks stehen und die Seite zeigt den Knopf «Anmelden». Ein Ausgabecode
	 * geht immer durch: Ihn hat die Sitzungsleitung persönlich herausgegeben,
	 * und er lebt Minuten. Ohne `auto` (Tipp oder Browser ohne JavaScript)
	 * bleibt alles wie bisher.
	 *
	 * **Die Antwort verrät nichts.** Mit `auto` gibt es nur zwei Auskünfte:
	 * «läuft, eingelöst» (die Umleitung) oder «bitte tippen». Ein unbekannter
	 * Code bekommt dieselbe Antwort wie eine gültige Karte vor Beginn; erst der
	 * Tipp sagt `?stand=…`.
	 *
	 * **Der Keks wird immer gelöscht**, ausser die Nachschau endet mit «bitte
	 * tippen»: Dann gehört er zu der Karte, die auf ihren Tipp wartet. Sonst
	 * schickte die Seite denselben toten Code beim nächsten Laden wieder ab.
	 */
	karte: async ({ cookies, request }) => {
		const auto = await istAnstoss(request);
		const code = leseKartenscan(cookies);

		if (auto && code !== null) {
			let istKarte: boolean;
			try {
				istKarte = pruefeIrgendeinenCode(code).art === 'karte';
			} catch (fehler) {
				if (!(fehler instanceof FachlicherFehler)) throw fehler;
				// Auch eine Eingabe, die schon an der Form scheitert, ist ein
				// Versuch (Audit B-05), und sie bekommt dieselbe Antwort wie
				// jeder Code, der vor Beginn nicht einlöst.
				await haltCodeversuchFest('zugangscode', false);
				return { tippen: true };
			}

			if (istKarte && (await lageDesKartencodes(code)) !== 'laufend') {
				return { tippen: true };
			}
		}

		loescheKartenscan(cookies, keksSicher());
		// `null` heisst «kein Keks». Ein leerer Wert (etwa `/z/----`) geht dagegen
		// durch `loeseCodeEin`: Er wird gezählt und endet mit Grund auf `?stand=`,
		// wie früher der Abruf (Featureprüfung 12.11.2026).
		if (code === null) redirect(303, '/z');

		const einloesung = await loeseCodeEin(code, request.headers.get('user-agent') ?? '');
		if (einloesung.gelungen && einloesung.merkmal) {
			setzeKeks(cookies, einloesung.merkmal, keksSicher());
			/*
			 * **Und gleich in die Warteschlange** (Auftraggeber, 24.08.2026: «Wenn
			 * der QR genutzt wird, lande ich auf der Anmeldeseite. Sollte der dann
			 * nicht in die Warteschlange kommen?»).
			 *
			 * Wer seinen Code einlöst, während die Versammlung läuft, sagt damit
			 * «ich bin da». Den Knopf danach noch zu verlangen, ist ein Tipp im
			 * Gedränge für eine Aussage, die schon gemacht wurde. Die Sicherung
			 * bleibt: Eine Anmeldung ist keine Anwesenheit — erst die Freigabe
			 * zählt.
			 */
			await meldeNachEinloesungAn(einloesung.merkmal);
			redirect(303, '/z');
		}

		// Wie bisher: Der Grund steht als Kennwort in der Adresse, der Code nicht.
		redirect(303, `/z?stand=${einloesung.ausgang}`);
	},

	/**
	 * Code von der Karte eintippen.
	 *
	 * Keine Sperre nach zu vielen Versuchen: Bei 97 Bit Zufall ist Raten
	 * aussichtslos, und eine Sperre liesse sich zum Aussperren einzelner
	 * Eigentümer missbrauchen — im Saal, wo es niemand mehr richten kann.
	 */
	einloesen: async ({ cookies, request }) => {
		const daten = await request.formData();
		const eingabe = text(daten.get('code'));

		// Beide Arten werden angenommen: der lange Code von der Karte und der
		// kurze, den die Sitzungsleitung im Saal ausgibt. Die Person weiss nicht,
		// welche Art sie in der Hand hält — sie tippt, was dasteht.
		//
		// Die Browserkennung dient allein einer groben Gerätebezeichnung für die
		// Sitzungsleitung; gespeichert wird nur diese, nie die Kennung selbst.
		const einloesung = await loeseCodeEin(eingabe, request.headers.get('user-agent') ?? '');
		if (!einloesung.gelungen || !einloesung.merkmal) {
			return fail(400, {
				fehler: { nachricht: einloesung.grund ?? '' },
				// Bei «belegt» braucht die Seite einen zweiten Text: Hier ist nicht der
				// Code falsch, sondern der Zugang vergeben — und dagegen hilft kein
				// erneutes Abtippen.
				belegt: einloesung.ausgang === 'belegt',
				eingabe
			});
		}

		setzeKeks(cookies, einloesung.merkmal, keksSicher());
		// Dieselbe Folge wie beim Scannen: Wer einlöst, während die Versammlung
		// läuft, steht damit in der Warteschlange. Zwei Wege zum selben Code
		// dürfen nicht verschieden enden.
		await meldeNachEinloesungAn(einloesung.merkmal);
		redirect(303, '/z');
	},

	/**
	 * Die Selbstanmeldung.
	 *
	 * Sie erzeugt **keine** Anwesenheit, sondern einen Eintrag in der Warteliste:
	 * Wer einen Zugangscode hat, könnte sich sonst selbst stimmberechtigt machen.
	 */
	anmelden: async ({ cookies }) => {
		const merkmal = leseKeks(cookies);
		if (!merkmal) redirect(303, '/z');

		const befund = await loeseSitzungAuf(merkmal);
		if (!befund.gueltig) {
			loescheKeks(cookies, keksSicher());
			return fail(400, { fehler: { nachricht: befund.grund ?? '' } });
		}

		try {
			const ergebnis = await meldeTeilnahmeAn(
				befund.operatorId as string,
				befund.meetingId as string,
				befund.parteiId as string,
				// Der Weg kommt aus der Sitzung, nicht aus dem Formular: Was das
				// Gerät mitschickt, könnte jeder setzen.
				befund.herkunft === 'authentik' ? 'authentik' : 'selbst'
			);
			/*
			 * **Der Strom erfährt davon — sonst sieht es niemand.**
			 *
			 * Am Eingang steht jemand und wartet auf die Freigabe. Ohne diese Zeile
			 * erscheint er in der Anwesenheitssicht erst, wenn die Sitzungsleitung
			 * die Seite von Hand neu lädt; sie müsste also raten, wann es sich
			 * lohnt. Gemeldet vom Auftraggeber beim ersten Durchgang mit dem eigenen Konto
			 * (20.08.2026).
			 *
			 * Der Strom trägt dabei nur Zahlen (AD-11): dass die Zahl der Wartenden
			 * gestiegen ist, nicht wer gekommen ist.
			 */
			await verkuendeStand(befund.operatorId as string, befund.meetingId as string);
			return { angemeldet: true, zustand: ergebnis.zustand };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Stimmabgabe (Story 5.7, FR-38).
	 *
	 * Ohne sichtbare Frage keine Stimmabgabe: Die Kennung des Durchgangs kommt
	 * aus dem Formular und muss mit der offenen übereinstimmen. Trifft eine
	 * Stimme nach dem Schliessen ein — weil die Verbindung hing —, wird sie
	 * abgewiesen, statt still in einer geschlossenen Abstimmung zu landen.
	 */
	stimmen: async ({ cookies, request }) => {
		const merkmal = leseKeks(cookies);
		if (!merkmal) redirect(303, '/z');

		const befund = await loeseSitzungAuf(merkmal);
		if (!befund.gueltig) {
			loescheKeks(cookies, keksSicher());
			return fail(400, { fehler: { nachricht: befund.grund ?? '' } });
		}

		const daten = await request.formData();

		/*
		 * **Für wen wird gestimmt.**
		 *
		 * `wahl` allein meint die eigene Partei — der Regelfall und der Weg, den
		 * die Seite ohne Vollmachten geht. `wahl:<parteiId>` benennt die Partei
		 * ausdrücklich; so stimmt eine bevollmächtigte Person für die, die sie
		 * vertritt (Fall des Auftraggebers vom 04.08.2026).
		 *
		 * Beides nebeneinander, damit der einfache Fall einfach bleibt: Ein
		 * Telefon ohne Vollmachten schickt weiterhin eine einzige Angabe.
		 */
		let fuerPartei = befund.parteiId as string;
		let wahl = text(daten.get('wahl'));
		if (!wahl) {
			for (const [schluessel, wert] of daten.entries()) {
				if (!schluessel.startsWith('wahl:')) continue;
				fuerPartei = schluessel.slice('wahl:'.length);
				wahl = String(wert);
				break;
			}
		}
		if (wahl !== 'yes' && wahl !== 'no' && wahl !== 'abstain') {
			return fail(400, { fehler: { nachricht: 'Bitte wählen Sie Ja, Nein oder Enthaltung.' } });
		}

		const operatorId = befund.operatorId as string;
		const meetingId = befund.meetingId as string;

		// In der einfachen Betriebsart erfasst die Sitzungsleitung. Zwei Wege für
		// dieselbe Stimme wären zwei Stimmen, und welche gilt, liesse sich nicht
		// sagen. Die Oberfläche bietet den Weg dort nicht an; hier wird er
		// zusätzlich verschlossen, weil eine abgeschickte Anfrage nicht davon
		// abhängen darf, was eine Seite angezeigt hat.
		const v = await holeVersammlung(operatorId, meetingId);
		if (v?.betriebsart !== 'gefuehrt') {
			return fail(400, {
				fehler: {
					nachricht:
						'In dieser Versammlung wird im Saal abgestimmt; die Sitzungsleitung erfasst die ' +
						'Stimmen.'
				}
			});
		}
		const durchgangId = text(daten.get('durchgang'));

		const offen = (await holeDurchgaenge(operatorId, meetingId)).find(
			(d) => d.zustand === 'offen'
		);
		if (!offen || offen.id !== durchgangId) {
			return fail(400, {
				fehler: {
					nachricht:
						'Diese Abstimmung ist inzwischen geschlossen. Ihre Stimme konnte nicht mehr ' +
						'entgegengenommen werden — melden Sie sich bei der Sitzungsleitung.'
				}
			});
		}

		// Nur, was dieses Gerät ausüben darf: die eigene Partei und die, für die
		// eine **bestätigte** Vollmacht auf sie lautet. Die Oberfläche bietet
		// nichts anderes an; hier wird es zusätzlich verschlossen, weil eine
		// abgeschickte Anfrage nicht davon abhängen darf, was eine Seite gezeigt
		// hat.
		const ausuebbare = await holeAusuebbare(operatorId, meetingId, befund.parteiId as string);
		const ziel = ausuebbare.find((a) => a.parteiId === fuerPartei);
		if (!ziel) {
			return fail(400, {
				fehler: {
					nachricht:
						'Für diese Partei dürfen Sie nicht abstimmen. Eine Vollmacht überträgt die ' +
						'Ausübung erst, wenn die Sitzungsleitung sie bestätigt hat.'
				}
			});
		}
		const eigene = ausuebbare.find((a) => a.eigene);

		try {
			// Ohne Angabe einzelner Einheiten: alle gleich. Das ist der Regelfall,
			// und bei der Zählung je Eigentümer der einzig sinnvolle — die Person hat
			// eine Kopfstimme, und aus widersprüchlichen Einheiten liesse sich keine
			// bilden.
			const einheiten = daten.getAll('einheit').map(String).filter(Boolean);
			await gibStimmenAb(
				{ operatorId, userId: null as unknown as string, label: 'Eigentümer' },
				meetingId,
				[
					{
						parteiId: ziel.parteiId,
						unitIds: einheiten.length > 0 ? einheiten : undefined,
						wahl,
						// Wer aufgrund einer Vollmacht ausübt, steht an der Stimme (FR-56).
						ausgeuebtVon: ziel.eigene ? null : (eigene?.id ?? null)
					}
				],
				false
			);
			await verkuendeStand(operatorId, meetingId);
			return { gestimmt: wahl, fuer: ziel.eigene ? null : ziel.name };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/**
	 * Der Veto-Entscheid einer Betroffenen im Ausstand (26.09.2026).
	 *
	 * Wie `stimmen`, aber für die **Zustimmung** statt die Stimme: Der
	 * Entscheid zählt nur für das Veto und nie bei der Mehrheit. Er kommt aus
	 * dem Formular (`entscheid` ja oder nein) und gilt der Partei, deren Block
	 * ihn abgeschickt hat (`partei`). Eine bevollmächtigte Person übt das Veto
	 * für die Vertretene aus; der Server prüft die Vollmacht nochmals
	 * (`erfasseVeto`).
	 */
	veto: async ({ cookies, request }) => {
		const merkmal = leseKeks(cookies);
		if (!merkmal) redirect(303, '/z');

		const befund = await loeseSitzungAuf(merkmal);
		if (!befund.gueltig) {
			loescheKeks(cookies, keksSicher());
			return fail(400, { fehler: { nachricht: befund.grund ?? '' } });
		}

		const daten = await request.formData();
		const fuerPartei = text(daten.get('partei'));
		const entscheid = text(daten.get('entscheid'));
		if (entscheid !== 'ja' && entscheid !== 'nein') {
			return fail(400, {
				fehler: { nachricht: 'Bitte wählen Sie «Zustimmen» oder «Nicht zustimmen».' }
			});
		}

		const operatorId = befund.operatorId as string;
		const meetingId = befund.meetingId as string;

		const durchgangId = text(daten.get('durchgang'));
		const offen = (await holeDurchgaenge(operatorId, meetingId)).find(
			(d) => d.zustand === 'offen'
		);
		if (!offen || offen.id !== durchgangId) {
			return fail(400, {
				fehler: {
					nachricht:
						'Diese Abstimmung ist inzwischen geschlossen. Der Veto-Entscheid konnte nicht ' +
						'mehr entgegengenommen werden — melden Sie sich bei der Sitzungsleitung.'
				}
			});
		}

		// Nur, was dieses Gerät ausüben darf: die eigene Partei und die, für die
		// eine bestätigte Vollmacht auf sie lautet. `erfasseVeto` prüft dieselbe
		// Bedingung nochmals.
		const ausuebbare = await holeAusuebbare(operatorId, meetingId, befund.parteiId as string);
		const ziel = ausuebbare.find((a) => a.parteiId === fuerPartei);
		if (!ziel) {
			return fail(400, {
				fehler: {
					nachricht:
						'Für diese Partei dürfen Sie das Veto nicht ausüben. Eine Vollmacht überträgt ' +
						'die Ausübung erst, wenn die Sitzungsleitung sie bestätigt hat.'
				}
			});
		}
		const eigene = ausuebbare.find((a) => a.eigene);

		try {
			await erfasseVeto(
				{ operatorId, userId: null as unknown as string, label: 'Eigentümer' },
				meetingId,
				offen.traktandumId,
				ziel.parteiId,
				{
					entscheid,
					weg: 'telefon',
					// Wer erfasst hat: die Partei selbst oder die Vertretung.
					erfasstDurch: ziel.eigene ? ziel.name : (eigene?.name ?? ziel.name),
					ausgeuebtVonId: ziel.eigene ? null : (eigene?.id ?? null)
				}
			);
			await verkuendeStand(operatorId, meetingId);
			return { veto: entscheid, fuer: ziel.eigene ? null : ziel.name };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/**
	 * Vollmacht erteilen — von der Einladung aus, ohne Papier.
	 *
	 * **Was hier entsteht, überträgt noch nichts.** Die Sitzungsleitung bestätigt
	 * wie bisher; der Zugangscode steht im Klartext auf der Karte, und wer sie
	 * weitergibt, gibt auch die Möglichkeit weiter, in fremdem Namen zu
	 * bevollmächtigen.
	 */
	bevollmaechtigen: async ({ cookies, request }) => {
		const befund = await sitzung(cookies);
		if ('fehler' in befund) return befund.fehler;

		const daten = await request.formData();
		const wen = text(daten.get('bevollmaechtigt'));
		const name = text(daten.get('bevollmaechtigtName'));

		try {
			await erklaere(
				befund.operatorId,
				befund.meetingId,
				befund.parteiId,
				{
					// Entweder eine Partei derselben Versammlung oder eine dritte
					// Person mit Namen — die Prüfung dahinter kennt beide Fälle.
					bevollmaechtigtId: wen || null,
					bevollmaechtigtName: wen ? null : name || null,
					// L8 (Migration 184): Das Häkchen «Bevollmächtigt ist die
					// Verwaltung», nur sinnvoll bei einer dritten Person; der Kern
					// verwirft es sonst wie die Datenbank.
					istVerwaltung: daten.get('istVerwaltung') === 'ja',
					weisungen: weisungenAus(daten)
				}
			);
			return {
				hinweis:
					'Die Vollmacht ist erklärt. Die Sitzungsleitung prüft sie noch — bis dahin überträgt ' +
					'sie keine Stimme.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/** Die Weisungen zu einer bereits erklärten Vollmacht ändern. */
	weisungen: async ({ cookies, request }) => {
		const befund = await sitzung(cookies);
		if ('fehler' in befund) return befund.fehler;

		const daten = await request.formData();
		try {
			const gesetzt = await setzeWeisungen(
				befund.operatorId,
				befund.meetingId,
				befund.parteiId,
				weisungenAus(daten)
			);
			return {
				hinweis:
					gesetzt === 0
						? 'Alle Weisungen zurückgenommen. Ihre bevollmächtigte Person entscheidet frei.'
						: `${gesetzt} ${gesetzt === 1 ? 'Weisung' : 'Weisungen'} gespeichert.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/** Die eigene Vollmacht zurücknehmen. */
	widerrufen: async ({ cookies }) => {
		const befund = await sitzung(cookies);
		if ('fehler' in befund) return befund.fehler;

		try {
			await widerrufeEigene(befund.operatorId, befund.meetingId, befund.parteiId);
			return { hinweis: 'Die Vollmacht ist zurückgenommen.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/**
	 * Abmelden — und damit den Zugang freigeben.
	 *
	 * Seit es je Zugang nur **eine** Sitzung gibt, räumt das nicht mehr bloss den
	 * Keks weg: Es ist der Weg, auf dem der Eigentümer selbst das Gerät wechselt,
	 * ohne die Sitzungsleitung zu bemühen. Deshalb wird die Sitzung hier auch
	 * serverseitig beendet; bliebe sie stehen, käme das nächste Gerät zwölf
	 * Stunden lang nicht herein.
	 */
	abmelden: async ({ cookies }) => {
		const merkmal = leseKeks(cookies);
		if (merkmal) await beendeEigeneSitzung(merkmal);
		loescheKeks(cookies, keksSicher());
		redirect(303, '/z');
	},

	/**
	 * Den eigenen Zugang vergessen und von vorn beginnen.
	 *
	 * Bewusst eine ausdrückliche Handlung: Solange der Keks liegt, bleibt die
	 * Auskunft stehen, warum der Zugang zu Ende ist.
	 */
	vergessen: async ({ cookies }) => {
		loescheKeks(cookies, keksSicher());
		redirect(303, '/z');
	}

};

/**
 * Die Sitzung hinter dem Keks — oder die fertige Absage.
 *
 * Drei Aktionen brauchen dasselbe: Keks lesen, Sitzung auflösen, bei
 * Ungültigkeit aufräumen. Dreimal geschrieben liefe es beim vierten Mal
 * auseinander.
 */
async function sitzung(
	cookies: import('@sveltejs/kit').Cookies
): Promise<
	| { operatorId: string; meetingId: string; parteiId: string }
	| { fehler: ReturnType<typeof fail> }
> {
	const merkmal = leseKeks(cookies);
	if (!merkmal) redirect(303, '/z');

	const befund = await loeseSitzungAuf(merkmal);
	if (!befund.gueltig) {
		loescheKeks(cookies, keksSicher());
		return { fehler: fail(400, { fehler: { nachricht: befund.grund ?? '' } }) };
	}
	return {
		operatorId: befund.operatorId as string,
		meetingId: befund.meetingId as string,
		parteiId: befund.parteiId as string
	};
}

/**
 * Die Weisungen aus dem Formular.
 *
 * Felder heissen `weisung:<traktandumId>`. Ein leeres Feld ist **keine**
 * Weisung — nicht eine vierte Art von Weisung: Wer nichts ankreuzt, überlässt
 * die Entscheidung seiner bevollmächtigten Person, und genau das steht dann
 * auch nirgends geschrieben.
 */
function weisungenAus(daten: FormData): { traktandumId: string; wahl: string }[] {
	const aus: { traktandumId: string; wahl: string }[] = [];
	for (const [feld, wert] of daten.entries()) {
		if (!feld.startsWith('weisung:')) continue;
		const wahl = String(wert).trim();
		if (!wahl) continue;
		aus.push({ traktandumId: feld.slice('weisung:'.length), wahl });
	}
	return aus;
}
