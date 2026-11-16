/**
 * Abgeben und zurücknehmen: der Weg zum Gerät im Saal und zurück.
 *
 * Die Regeln stehen im Kern (`$lib/domain/abgabe`), die Sperre in der Datenbank
 * (Migration 117), das Paket in `vorbereitungspaket.ts`. Hier steht, was
 * zusammengehört: Paket erzeugen, ablegen, Leihschein schreiben, Verlauf
 * führen.
 *
 * **Die Reihenfolge bleibt: erst die Datei, dann die Zeile.** Steht der
 * Leihschein ohne Paket da, verweist er auf nichts, und die Versammlung wäre
 * gesperrt für eine Ausleihe, die nie stattfand. Umgekehrt ist eine Datei ohne
 * Leihschein bloss ein Stück Speicher. Dasselbe Muster nutzt `einspielen.ts`.
 *
 * **Seit dem 21.09.2026 kommt ein zweiter Bau dazu**, nach dem Leihschein und
 * damit unter der Sperre; er erkennt, ob im Fenster dazwischen geschrieben
 * wurde. Ergibt er etwas anderes, wird ein zweites Paket abgelegt und der
 * Leihschein darauf gesetzt. Das erste bleibt dann als Waise liegen, und auch
 * das ist bloss ein Stück Speicher. Die Begründung steht an `gibAb`.
 */
import { alsBetreiber, istDoppelterSchluessel } from './db';
import { entferneDatei, legeInternAb } from './dateien';
import { schreibeVerlauf, type Handelnder } from './audit';
import { erzeugeVorbereitungspaket } from './vorbereitungspaket';
import { holeGeraet, vermerkeVerwendung } from './geraete';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/fehler';
import { vergleicheManifeste } from '$lib/domain/manifestvergleich';
import {
	erhebeAbgabelage,
	verlangeAbgebbar,
	verlangeRuecknahmegrund,
	type Abgabe,
	type Abgabelage
} from '$lib/domain/abgabe';
import type { Id } from '$lib/domain/types';

interface AbgabeZeile {
	id: string;
	meeting_id: string;
	device_id: string;
	device_note: string | null;
	package_checksum: string;
	package_size: string | number;
	handed_over_at: Date;
	handed_over_by_label: string | null;
	returned_at: Date | null;
	returned_by_label: string | null;
	returned_seal: string | null;
	revoked_at: Date | null;
	revoked_by_label: string | null;
	revoked_reason: string | null;
}

function ausDb(z: AbgabeZeile): Abgabe {
	return {
		id: z.id,
		versammlungId: z.meeting_id,
		geraetId: z.device_id,
		geraet: z.device_note,
		abgegebenAm: z.handed_over_at.toISOString(),
		abgegebenDurch: z.handed_over_by_label,
		paketPruefsumme: z.package_checksum,
		paketGroesse: Number(z.package_size),
		zurueckAm: z.returned_at?.toISOString() ?? null,
		zurueckDurch: z.returned_by_label,
		zurueckSiegel: z.returned_seal,
		zurueckgenommenAm: z.revoked_at?.toISOString() ?? null,
		zurueckgenommenDurch: z.revoked_by_label,
		zurueckgenommenGrund: z.revoked_reason
	};
}

/** Die offene Ausleihe dieser Versammlung, wenn es eine gibt. */
export async function holeOffeneAbgabe(operatorId: Id, meetingId: Id): Promise<Abgabe | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<AbgabeZeile[]>`
			SELECT * FROM meeting_handover
			 WHERE meeting_id = ${meetingId}
			   AND returned_at IS NULL
			   AND revoked_at IS NULL
		`;
		return z ? ausDb(z) : null;
	});
}

/** Alle Ausleihen dieser Versammlung, neueste zuerst — für den Verlauf auf der Seite. */
export async function holeAbgaben(operatorId: Id, meetingId: Id): Promise<Abgabe[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<AbgabeZeile[]>`
			SELECT * FROM meeting_handover
			 WHERE meeting_id = ${meetingId}
			 ORDER BY handed_over_at DESC
		`;
		return zeilen.map(ausDb);
	});
}

export async function erhebeLage(
	operatorId: Id,
	meetingId: Id,
	zustand: Parameters<typeof erhebeAbgabelage>[0]
): Promise<Abgabelage> {
	return erhebeAbgabelage(zustand, await holeOffeneAbgabe(operatorId, meetingId));
}

export interface Abgabebericht {
	abgabe: Abgabe;
}

/**
 * Gibt die Versammlung ab.
 *
 * Die Reihenfolge ist: Lage prüfen, Gerät prüfen, **erster Paketbau**, ablegen,
 * Leihschein schreiben, **zweiter Paketbau**, vergleichen. Dazwischen vergeht
 * Zeit — der Paketbau liest sechsundzwanzig Tabellen —, und in dieser Zeit kann
 * sich die Lage ändern. Drei Rennen sind möglich, und alle drei sind hier
 * zugemacht:
 *
 *   * **Zwei Menschen geben gleichzeitig ab.** Beide bestehen die Prüfung am
 *     Anfang und bauen ihr Paket. Am Leihschein wartet der zweite auf die
 *     Sperre der Versammlungszeile, liest danach die offene Abgabe des ersten
 *     und bekommt deren Satz (Sicherheitsdurchgang 09.10.2026, S8; vorher
 *     scheiterte er am eindeutigen Schlüssel als rohe 500). Der Schlüssel auf
 *     `meeting_handover` bleibt das Netz darunter. Sein schon abgelegtes Paket
 *     wird wieder entfernt, siehe `entferneWaise`.
 *   * **Jemand eröffnet, während das Paket entsteht** (18.09.2026, aus dem
 *     Code-Review). Der Zustand wird deshalb im Augenblick des Schreibens noch
 *     einmal gelesen, und zwar mit `FOR UPDATE`: Ab da wartet ein Eröffnen auf
 *     diese Transaktion. Ohne das läge der Leihschein auf einer **laufenden**
 *     Versammlung, und die Sperre träfe einen Saal voller Leute.
 *   * **Jemand schreibt zwischen den zwei Bauten** (Produktentscheid
 *     21.09.2026, Entwurf Punkt 9). Bis dahin war das hingenommen: In diesem
 *     Fenster greift keine Sperre — der Leihschein steht noch nicht —, wer
 *     schreibt, kommt durch und landet nicht mehr im Paket. Jetzt wird das
 *     Fenster erkannt: Das erste Paket entsteht vor dem Leihschein, das zweite
 *     danach, und die zwei Manifeste werden verglichen
 *     (`$lib/domain/manifestvergleich`). Unterscheiden sie sich, wird das
 *     **zweite** Paket abgelegt, der Leihschein darauf gesetzt und der Vorgang
 *     im Verlauf vermerkt. Der zweite Lauf ist damit nicht nur die Probe,
 *     sondern zugleich die Reparatur.
 *
 * **Warum der zweite Bau erst nach dem Leihschein kommt.** Ab dem
 * festgeschriebenen Leihschein greift die Sperre aus Migration 117. Läge der
 * zweite Lauf davor oder in derselben Transaktion, hätte er keine Sperre zu
 * sehen: Eine noch nicht festgeschriebene Zeile ist für andere Transaktionen
 * unsichtbar, das Fenster bliebe offen.
 *
 * **Wie weit die Sperre dabei trägt, und wo nicht** (nachgemessen am
 * 21.09.2026, aus der Sicherheitsprüfung und dem Code-Review). Migration 117
 * legt Auslöser auf die **versammlungsgebundenen** Tabellen. Das Paket
 * exportiert sechsundzwanzig, gesperrt sind davon dreizehn. Die anderen
 * dreizehn hängen an der Gemeinschaft und bleiben beschreibbar: `stweg`,
 * `quota_kind`, `unit`, `unit_quota`, `unit_ownership`, `usufruct`, `party`,
 * `party_member`, `representation`, die drei `bylaw_*` und
 * `agenda_template_order`.
 *
 * Für diese dreizehn ist der zweite Lauf **kein** Lesen unter Sperre. Wer dort
 * im Fenster schreibt, kommt weiterhin durch, und der Vergleich meldet es nur,
 * wenn der Schreibvorgang vor dem zweiten Lauf lag. Schwer wiegt das nicht: Ab
 * «freigegeben» rechnet die Versammlung auf der Momentaufnahme (AD-3), und
 * `snapshot`, `snapshot_party` und `snapshot_unit` sind gesperrt. Der
 * Stammdatenteil reist als Zusammenhang mit, nicht als Grundlage der Zählung.
 *
 * Die Folge für den Vermerk: Auch eine gewöhnliche Stammdatenpflege im Fenster,
 * etwa ein berichtigter Parteiname, löst eine Berichtigung aus. Das ist
 * richtig — das Paket ändert sich wirklich —, nur betrifft der Eintrag dann die
 * Gemeinschaft und nicht die Versammlung.
 *
 * **Warum nicht die Paketdatei verglichen wird.** Sie ist nie zweimal gleich:
 * Jeder Lauf zieht einen neuen flüchtigen Punkt (X25519, in `saalgeraet.ts`).
 * Ein Dateivergleich meldete jede Abgabe als abweichend und machte sie
 * unbrauchbar. Verglichen werden Pfad und Prüfsumme je Manifesteintrag; die
 * Gegenprobe vom 21.09.2026 ergab zweimal dieselbe Marke bei achtundzwanzig
 * Einträgen.
 *
 * **Warum das erste Paket trotzdem vor dem Leihschein abgelegt wird**
 * (21.09.2026, aus dem Code-Review; der erste Bau tat es danach). Der zweite
 * Bau und das Ablegen können scheitern: Verbindungsabbruch, erschöpfter Pool,
 * eine Unterlage, die inzwischen weg ist, volle Platte. Läge die Datei erst
 * danach, bliebe in all diesen Fällen ein Leihschein auf ein Paket zurück, das
 * nie geschrieben wurde: Die Versammlung wäre gesperrt, der Abruf liefe ins
 * Leere, und aufzulösen wäre es nur von Hand über `nimmAbgabeZurueck`, mit
 * einem Pflichtgrund, der ein Anwendungsfehler ist. Genau diesen Zustand nennt
 * der Entwurf als Grund, eine andere Bauart zu verwerfen; er darf hier nicht
 * durch die Hintertür wieder entstehen.
 *
 * Der Preis dafür ist klein und benannt: Im Berichtigungsfall zeigt der
 * Leihschein für die Dauer des zweiten Baus auf das erste Paket. Wer in diesem
 * Fenster herunterlädt, bekommt einen um Millisekunden überholten Stand statt
 * einer Fehlermeldung. Das ist die bessere der beiden Antworten.
 */
export async function gibAb(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	zustand: Parameters<typeof verlangeAbgebbar>[0],
	angaben: { geraetId: Id; herkunft: string | null; jetzt: string }
): Promise<Abgabebericht> {
	verlangeAbgebbar(zustand, await holeOffeneAbgabe(handelnder.operatorId, meetingId));

	/*
	 * **Das Gerät zuerst, und zwar mit seinem Zustand.** Ein widerrufenes Gerät
	 * ist kein Empfänger mehr: Es wurde widerrufen, weil es verloren ging oder
	 * ersetzt wurde. Ein Paket dorthin wäre genau das, wogegen der Widerruf
	 * gedacht war.
	 */
	const geraet = await holeGeraet(handelnder.operatorId, angaben.geraetId);
	if (!geraet) {
		throw new FachlicherFehler(
			'geraet_unbekannt',
			'Dieses Gerät ist hier nicht eingetragen. Tragen Sie es unter «Saalgeräte» ein, bevor Sie abgeben.',
			'geraet'
		);
	}
	if (geraet.widerrufenAm) {
		throw new FachlicherFehler(
			'geraet_widerrufen',
			`Das Gerät «${geraet.name}» ist widerrufen: ${geraet.widerrufenGrund}. An ein widerrufenes Gerät wird nichts abgegeben.`,
			'geraet'
		);
	}

	/*
	 * Die Kennung kommt aus der Datenbank und nicht aus `crypto.randomUUID()`:
	 * Im Haus sind alle Kennungen `uuidv7` und damit nach Entstehungszeit
	 * sortierbar. Sie wird vor dem Paket gebraucht, weil das Manifest sie trägt.
	 */
	const abgabeId = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
		return z.id;
	});
	/*
	 * **Der erste Bau, und er wird gleich abgelegt.** Sein Manifest ist die
	 * Marke M1. Warum die Datei vor dem Leihschein entsteht und nicht erst nach
	 * dem zweiten Lauf, steht oben an `gibAb`: Sonst zeigte der Leihschein in
	 * jedem Fehlerfall auf ein Paket, das es nicht gibt.
	 *
	 * Die Prüfsumme kommt aus `legeInternAb` und wird nicht daneben noch einmal
	 * gerechnet. Eine zweite Rechnung wäre eine zweite Wahrheit: Liefe sie je
	 * auseinander, zeigte der Leihschein auf eine Datei, die unter einem anderen
	 * Namen liegt.
	 */
	const erstes = await erzeugeVorbereitungspaket(handelnder.operatorId, meetingId, {
		abgabeId,
		herkunft: angaben.herkunft,
		jetzt: angaben.jetzt,
		geraetSchluessel: geraet.encPublic
	});
	const abgelegt = await legeInternAb(erstes.inhalt);

	const abgabe = await alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Der Zustand noch einmal, jetzt unter Zeilensperre.** Zwischen der
		 * Prüfung oben und hier lag der Paketbau. `FOR UPDATE` hält die Zeile bis
		 * zum Ende dieser Transaktion; ein gleichzeitiges Eröffnen wartet und
		 * findet danach den Leihschein vor, der es abweist.
		 */
		const [stand] = await tx<{ state: string }[]>`
			SELECT state FROM meeting WHERE id = ${meetingId} FOR UPDATE
		`;
		if (!stand) {
			throw new FachlicherFehler(
				'versammlung_weg',
				'Diese Versammlung gibt es nicht mehr.',
				'abgabe'
			);
		}
		if (stand.state !== 'freigegeben') {
			throw new FachlicherFehler(
				'zustand_gewechselt',
				'Diese Versammlung hat inzwischen ihren Zustand gewechselt, vermutlich hat jemand sie eröffnet. Abgegeben wird vor dem Saal, nicht darin.',
				'abgabe'
			);
		}
		/*
		 * **Und die offene Abgabe noch einmal, unter derselben Sperre** (S8). Wer
		 * gleichzeitig abgab, hat hier schon seinen Leihschein geschrieben;
		 * dieser Lauf bekommt denselben Satz wie die Prüfung am Anfang.
		 */
		const [offen] = await tx<AbgabeZeile[]>`
			SELECT * FROM meeting_handover
			 WHERE meeting_id = ${meetingId} AND returned_at IS NULL AND revoked_at IS NULL
		`;
		verlangeAbgebbar({ zustand: 'freigegeben' }, offen ? ausDb(offen) : null);

		const [z] = await tx<AbgabeZeile[]>`
			INSERT INTO meeting_handover (
				id, operator_id, meeting_id, device_id, device_note,
				package_checksum, package_size, handed_over_by, handed_over_by_label
			) VALUES (
				${abgabeId}, ${handelnder.operatorId}, ${meetingId}, ${geraet.id},
				${geraet.name}, ${abgelegt.pruefsumme}, ${abgelegt.groesse},
				${handelnder.userId}, ${handelnder.label}
			)
			RETURNING *
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.versammlungAbgegeben,
				{ art: 'meeting', id: meetingId },
				{
					abgabe: abgabeId,
					geraet: geraet.name,
					fingerabdruck: geraet.fingerabdruck,
					paket: abgelegt.pruefsumme,
					groesse: abgelegt.groesse
				}
			)
		);

		return ausDb(z);
	}).catch(async (fehler: unknown) => {
		/*
		 * **Ohne Leihschein kein Paket** (S8). Das abgelegte erste Paket gehört
		 * zu keiner Abgabe und hinterlässt keine Spur, weder einen Leihschein
		 * noch einen Verlaufseintrag. Anders als das erste Paket im
		 * Berichtigungsfall unten: Das bleibt liegen, aber der Eintrag
		 * «Abgabe berichtigt» nennt es als Vorgänger. Weggeräumt statt gar
		 * nicht erst abgelegt: Es muss vor dem Leihschein liegen (siehe oben),
		 * und um den Paketbau herum lässt sich keine Sperre halten, er liest über
		 * eigene Verbindungen.
		 */
		await entferneWaise(handelnder.operatorId, abgelegt.pruefsumme);
		if (istDoppelterSchluessel(fehler, 'meeting_handover_offen_idx')) {
			verlangeAbgebbar(
				{ zustand: 'freigegeben' },
				await holeOffeneAbgabe(handelnder.operatorId, meetingId)
			);
		}
		throw fehler;
	});

	/*
	 * **Der zweite Bau, unter der Sperre.** Ab dem festgeschriebenen Leihschein
	 * weist Migration 117 die versammlungsgebundenen Schreibwege ab; dieser Lauf
	 * sieht also den Stand, mit dem die Versammlung unterwegs ist. Was er anders
	 * vorfindet, wurde im Fenster geschrieben — hinzugefügt, geändert oder
	 * gelöscht. Wie weit die Sperre trägt, steht oben an `gibAb`.
	 */
	const zweites = await erzeugeVorbereitungspaket(handelnder.operatorId, meetingId, {
		abgabeId,
		herkunft: angaben.herkunft,
		jetzt: angaben.jetzt,
		geraetSchluessel: geraet.encPublic
	});
	const unterschiede = vergleicheManifeste(erstes.manifest.eintraege, zweites.manifest.eintraege);

	let endgueltig = abgabe;
	if (unterschiede.length > 0) {
		/*
		 * **Die Reparatur.** Das zweite Paket trägt den berichtigten Stand; der
		 * Leihschein wird darauf gesetzt und der Vorgang vermerkt. Das erste
		 * bleibt als Waise in der Ablage liegen — ein Stück Speicher, und der
		 * Preis dafür, dass der Leihschein nie auf eine fehlende Datei zeigt.
		 *
		 * **`revoked_at IS NULL` in der Bedingung, nicht nur in der Prüfung
		 * davor** — dieselbe Lehre wie in `nimmAbgabeZurueck`: Wer die Abgabe
		 * in diesem Augenblick zurücknimmt, war schneller; dann wird nichts
		 * überschrieben, und der zweite Lauf meldet es, statt einen beendeten
		 * Vorgang wieder aufzumachen.
		 */
		const zweitesAbgelegt = await legeInternAb(zweites.inhalt);
		await alsBetreiber(handelnder.operatorId, async (tx) => {
			const betroffen = await tx`
				UPDATE meeting_handover
				   SET package_checksum = ${zweitesAbgelegt.pruefsumme},
				       package_size = ${zweitesAbgelegt.groesse}
				 WHERE id = ${abgabe.id} AND returned_at IS NULL AND revoked_at IS NULL
			`;
			if (betroffen.count === 0) {
				throw new FachlicherFehler(
					'schon_erledigt',
					'Diese Abgabe wurde inzwischen beendet, entweder zurückgenommen oder mit ihrem Paket zurückgekommen. Die Versammlung ist wieder frei.',
					'abgabe'
				);
			}
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.abgabeKorrigiert,
					{ art: 'meeting', id: meetingId },
					{
						abgabe: abgabe.id,
						geraet: geraet.name,
						vorgaenger: abgelegt.pruefsumme,
						paket: zweitesAbgelegt.pruefsumme,
						/*
						 * **Zeichenketten, keine Objekte** (21.09.2026, aus dem
						 * Code-Review). Die Verlaufsseite setzt die Angaben mit
						 * `String(wert)` zusammen; eine Liste von Objekten käme
						 * dort als «[object Object]» an, und ausgerechnet der
						 * Eintrag, der belegen soll, was hereinkam, zeigte es
						 * nicht. Dasselbe Muster wie in `personen.ts` und
						 * `reglement.ts`.
						 */
						anzahl: unterschiede.length,
						eintraege: unterschiede.map((u) => `${u.art}: ${u.pfad}`)
					}
				)
			);
		});
		endgueltig = {
			...abgabe,
			paketPruefsumme: zweitesAbgelegt.pruefsumme,
			paketGroesse: zweitesAbgelegt.groesse
		};
	}

	/*
	 * **Der Vermerk darf die Abgabe nicht umwerfen** (18.09.2026, aus dem
	 * Code-Review). Er läuft nach dem Commit, also ist die Abgabe an dieser
	 * Stelle gültig und der Leihschein geschrieben. Würde ein Fehler hier nach
	 * oben durchschlagen, sähe die Sitzungsleitung eine 500er-Seite für einen
	 * Vorgang, der geklappt hat — und gäbe vermutlich ein zweites Mal ab. Was
	 * verlorengeht, ist eine Annehmlichkeit: «zuletzt benutzt» in der Geräteliste.
	 */
	await vermerkeVerwendung(handelnder.operatorId, geraet.id).catch((fehler: unknown) => {
		console.error(
			`[abgabe] «zuletzt benutzt» nicht vermerkt für Gerät ${geraet.id}:`,
			fehler instanceof Error ? fehler.message : String(fehler)
		);
	});

	/*
	 * **Das Paket selbst kommt nicht hier heraus, sondern aus der Ablage.** Eine
	 * Formularantwort kann nicht zugleich eine Seite und eine Datei sein. Wer es
	 * ein zweites Mal braucht, etwa weil der Stick verloren ging, holt es über
	 * denselben Weg noch einmal: Es ist ohnehin nur für das eine Gerät lesbar.
	 */
	return { abgabe: endgueltig };
}

/**
 * Entfernt ein abgelegtes Paket, das kein Leihschein trägt.
 *
 * **Über die Verwendungsprüfung**, wie beim Löschen nach Frist
 * (`aufbewahrung.ts`): Derselbe Inhalt liegt nur einmal in der Ablage, und
 * erst `pruefsumme_verwendet` sieht über alle Betreiber, ob ihn noch jemand
 * braucht. Ein Fehler hier wird gemeldet und nicht geworfen: Er darf den Satz
 * an den Benutzer nicht durch eine 500 ersetzen, und zurück bleibt im
 * schlimmsten Fall die Waise, die es vorher immer gab.
 */
async function entferneWaise(operatorId: Id, pruefsumme: string): Promise<void> {
	try {
		const verwendet = await alsBetreiber(operatorId, async (tx) => {
			const [v] = await tx<{ verwendet: boolean }[]>`
				SELECT pruefsumme_verwendet(${pruefsumme}) AS verwendet
			`;
			return v.verwendet;
		});
		if (!verwendet) await entferneDatei(pruefsumme);
	} catch (fehler) {
		console.error(
			`[abgabe] Paket ohne Leihschein nicht entfernt (${pruefsumme}):`,
			fehler instanceof Error ? fehler.message : String(fehler)
		);
	}
}

/**
 * Nimmt eine Abgabe zurück, ohne dass ein Paket zurückkam.
 *
 * **Der Notausstieg, und er ist einer.** Danach gilt hier wieder der Stand von
 * vor dem Abend; was auf dem anderen Gerät geschah, ist für diese Instanz
 * verloren. Deshalb der Pflichtgrund, und deshalb steht er im Verlauf.
 *
 * Das abgelegte Vorbereitungspaket bleibt liegen: Es ist der Beleg, dass diese
 * Ausleihe stattfand, und die Löschung von Dateien hat im Haus ihren eigenen
 * Weg über die Verwendungsprüfung.
 */
export async function nimmAbgabeZurueck(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	grund: string
): Promise<void> {
	const sauber = verlangeRuecknahmegrund(grund);
	const offen = await holeOffeneAbgabe(handelnder.operatorId, meetingId);
	if (!offen) {
		throw new FachlicherFehler(
			'keine_abgabe',
			'Diese Versammlung ist nicht abgegeben. Es gibt nichts zurückzunehmen.',
			'abgabe'
		);
	}

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **`revoked_at IS NULL` in der Bedingung, nicht nur in der Prüfung davor**
		 * (18.09.2026, aus dem Code-Review). Ohne sie überschreibt der zweite Klick
		 * Zeitpunkt, Handelnden und Pflichtgrund der ersten Rücknahme und legt
		 * einen zweiten Verlaufseintrag an — beides für einen Vorgang, der schon
		 * abgeschlossen war. Greift die Bedingung nicht, war jemand schneller, und
		 * dann ist nichts zu tun.
		 */
		const betroffen = await tx`
			UPDATE meeting_handover
			   SET revoked_at = now(),
			       revoked_by = ${handelnder.userId},
			       revoked_by_label = ${handelnder.label},
			       revoked_reason = ${sauber}
			 WHERE id = ${offen.id} AND revoked_at IS NULL AND returned_at IS NULL
		`;
		if (betroffen.count === 0) {
			throw new FachlicherFehler(
				'schon_erledigt',
				'Diese Abgabe ist inzwischen beendet, entweder zurückgenommen oder mit ihrem Paket zurückgekommen.',
				'abgabe'
			);
		}

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.abgabeZurueckgenommen,
				{ art: 'meeting', id: meetingId },
				{ abgabe: offen.id, geraet: offen.geraet, paket: offen.paketPruefsumme, grund: sauber }
			)
		);
	});
}
