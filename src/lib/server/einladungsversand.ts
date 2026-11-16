/**
 * Einladungen samt persönlicher Zugangskarte verschicken (PRD §13, «Mailversand»).
 *
 * **Ein Zug, ein Satz Codes.** Das Versandpaket erzeugt die Zugänge — alle auf
 * einmal, weil jeder Code nur im Augenblick seiner Entstehung existiert (NFR-5).
 * Deshalb entsteht das Paket hier **einmal** und liefert beides: das Archiv zum
 * Herunterladen und dieselben Karten einzeln für die Nachrichten. Zweimal
 * erzeugen hiesse, die eben verschickten Karten ungültig zu machen.
 *
 * **Was der Verlauf festhält**, und was nicht: Empfänger, Adresse und Ergebnis
 * je Nachricht — nicht der Text und nicht der Anhang. Der trägt einen
 * Zugangscode.
 */
import { alsBetreiber } from './db';
import { schreibeVerlauf } from './audit';
import { holeBetreiber } from './betreiber';
import { holeGemeinschaft } from './gemeinschaften';
import { holeVersammlung } from './versammlungen';
import { erzeugeVersandpaket } from './versandpaket';
// Der strengere der beiden Handelnden-Typen: Für die Kartenerzeugung dürfen
// Betreiber und Benutzer nicht offen sein, sonst entstünde ein Zugang ohne
// zurechenbare Person.
import type { Handelnder } from './kartensatz';
import { verschicke } from './mail';
import { planeVersand, versandInWorten, type Versandergebnis, type Versandplan } from '$lib/domain/mailversand';
import { datumLang } from '$lib/domain/datum';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Id } from '$lib/domain/types';

export interface Versandbericht {
	plan: Versandplan;
	ergebnisse: Versandergebnis[];
	satz: string;
}

export async function verschickeEinladungen(
	handelnder: Handelnder,
	meetingId: Id,
	basis: string,
	gewaehlt: Id[] | undefined,
	zeitpunkt: string
): Promise<Versandbericht> {
	const versammlung = await holeVersammlung(handelnder.operatorId, meetingId);
	if (!versammlung) {
		throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
	}

	const [gemeinschaft, betreiber] = await Promise.all([
		holeGemeinschaft(handelnder.operatorId, versammlung.stwegId),
		holeBetreiber(handelnder.operatorId)
	]);

	const paket = await erzeugeVersandpaket(handelnder, meetingId, basis, gewaehlt, zeitpunkt);

	const plan = planeVersand(paket.empfaenger, {
		gemeinschaft: gemeinschaft?.name ?? 'Ihre Gemeinschaft',
		datum: datumLang(versammlung.datum),
		uhrzeit: versammlung.uhrzeit,
		ort: versammlung.ort,
		// Unterschrieben wird vom Betreiber, nicht von der Anwendung. Steht dort
		// nichts, bleibt die Zeile leer statt «Versammlung» zu behaupten.
		absenderName: betreiber?.name ?? ''
	});

	if (plan.nachrichten.length === 0) {
		throw new FachlicherFehler(
			'keine_adressen',
			'Zu keiner der gewählten Parteien ist eine brauchbare E-Mail-Adresse erfasst. ' +
				'Tragen Sie sie bei den Eigentümern nach, oder laden Sie das Versandpaket herunter ' +
				'und verschicken Sie es über Ihr Mailprogramm.',
			'empfaenger'
		);
	}

	const anhaenge = new Map(paket.dateien.map((d) => [d.name, d.inhalt]));
	const ergebnisse = await verschicke(plan.nachrichten, anhaenge);

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		await schreibeVerlauf(
			tx,
			handelnder,
			ergebnisse.map((e) =>
				ereignis(
					EREIGNISARTEN.einladungVerschickt,
					{ art: 'meeting', id: meetingId },
					{
						partei: e.name,
						parteiId: e.parteiId,
						adresse: e.an,
						zugestellt: e.zugestellt,
						grund: e.grund
					}
				)
			)
		);
	});

	return { plan, ergebnisse, satz: versandInWorten(ergebnisse) };
}
