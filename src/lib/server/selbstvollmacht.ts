/**
 * Vollmacht über den persönlichen Zugang (Welle 2, Zusatzblock).
 *
 * **Der Fall.** Die Einladung trägt einen QR-Code. Wer ihn scannt und
 * feststellt, dass er nicht kommen kann, soll von dort aus jemanden
 * bevollmächtigen können — statt anzurufen, ein Blatt zu unterschreiben und es
 * jemandem in die Hand zu drücken.
 *
 * **Vier Zusagen, die dabei nicht aufgeweicht werden:**
 *
 *   1. **Die Sitzungsleitung bestätigt weiterhin.** Was hier entsteht, ist
 *      «erfasst» und überträgt nichts. Der Zugangscode steht im Klartext auf
 *      der Karte; wer sie weitergibt, gibt auch die Möglichkeit weiter, in
 *      fremdem Namen zu bevollmächtigen.
 *   2. **Der Nachweis heisst, was er ist:** «elektronisch über den persönlichen
 *      Zugang erklärt», nicht «Original vorgelegt».
 *   3. **Je Gemeinschaft freigeschaltet.** Manche Reglemente verlangen
 *      Schriftform. Ob eine Erklärung über den persönlichen Code das erfüllt,
 *      entscheidet keine Software.
 *   4. **Widerrufen ist so einfach wie erteilen** — solange die Versammlung
 *      noch nicht läuft. Danach steht jemand im Saal und hat die Stimme
 *      vielleicht schon ausgeübt; dann gehört der Widerruf vor die
 *      Sitzungsleitung und nicht auf ein Telefon.
 *
 * Die Prüfungen, wer wen überhaupt vertreten darf, stehen **nicht** hier: Sie
 * liegen in `erfasseInTx` und gelten für beide Wege. Zwei Fassungen derselben
 * Regel liefen auseinander.
 */
import postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import {
	istEmpfehlungswahl,
	type Empfehlungswahl,
	type Weisungsposten
} from '$lib/domain/empfehlung';
import { verlangeGrund, type Vollmacht } from '$lib/domain/vollmacht';
import {
	erfasseInTx,
	holeParteien,
	// Dieselbe Abfrage wie am Eingang: «offen oder wirksam» ist genau das, was
	// eine zweite Vollmacht verhindert und was hier zur Anzeige kommt.
	leseOffeneOderWirksame as leseEigene,
	widerrufeVollmacht,
	type Wahlpartei
} from './vollmacht';
import { holeTraktanden } from './traktanden';
import type { Id } from '$lib/domain/types';

/**
 * Die Zeile der Momentaufnahme zu einer Partei.
 *
 * **Zwei Kennungen, die man nicht verwechseln darf.** Die Zugangssitzung kennt
 * die Partei der Stammdaten (`party_id`); die Vollmacht hängt an der Zeile des
 * eingefrorenen Stimmberechtigtenstands (`snapshot_party.id`), weil sie für
 * genau eine Versammlung gilt. Wer die eine für die andere einsetzt, findet
 * nichts — oder Schlimmeres.
 */
async function momentzeile(
	tx: postgres.TransactionSql,
	meetingId: Id,
	parteiId: Id
): Promise<{ id: string; display_name: string } | null> {
	const [z] = await tx<{ id: string; display_name: string }[]>`
		SELECT id, display_name FROM snapshot_party
		 WHERE meeting_id = ${meetingId} AND party_id = ${parteiId}
	`;
	return z ?? null;
}

/** Wie die handelnde Person im Verlauf heisst, wenn sie selbst erklärt hat. */
export function handelnderName(name: string): string {
	return `${name} (über den persönlichen Zugang)`;
}

export interface Selbstvollmachtslage {
	/** Ob dieser Weg für diese Gemeinschaft überhaupt offensteht. */
	erlaubt: boolean;
	/** Warum nicht, wenn nicht — in einem Satz für den Bildschirm. */
	grund: string | null;
	/** Ob jetzt noch erklärt oder eine Weisung gesetzt werden darf. */
	aenderbar: boolean;
	/** Ob die eigene Vollmacht noch zurückgenommen werden darf. */
	widerrufbar: boolean;
	/** Warum nicht mehr widerrufbar — wenn es so ist. */
	widerrufGrund: string | null;
	/** Die eigene, noch offene oder wirksame Vollmacht. */
	eigene: Vollmacht | null;
	/** Wen man bevollmächtigen kann — ohne sich selbst. */
	waehlbare: Wahlpartei[];
	/** Die Anträge, zu denen sich eine Weisung erteilen lässt. */
	weisungen: Weisungsposten[];
}

interface Lagezeile {
	state: string;
	proxy_by_access: boolean;
}

export async function erhebeLage(
	operatorId: Id,
	meetingId: Id,
	parteiId: Id
): Promise<Selbstvollmachtslage> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<Lagezeile[]>`
			SELECT m.state, g.proxy_by_access
			  FROM meeting m
			  JOIN stweg g ON g.id = m.stweg_id
			 WHERE m.id = ${meetingId}
		`;
		const leer: Selbstvollmachtslage = {
			erlaubt: false,
			grund: null,
			aenderbar: false,
			widerrufbar: false,
			widerrufGrund: null,
			eigene: null,
			waehlbare: [],
			weisungen: []
		};
		if (!z) return { ...leer, grund: 'Diese Versammlung gibt es nicht.' };

		const ich = await momentzeile(tx, meetingId, parteiId);
		if (!ich) return { ...leer, grund: 'Sie sind hier nicht stimmberechtigt.' };

		if (!z.proxy_by_access) {
			return {
				...leer,
				grund:
					'Für diese Gemeinschaft ist die Vollmacht über den persönlichen Zugang nicht ' +
					'freigeschaltet. Melden Sie sich bei der Bewirtschaftung — eine Vollmacht auf Papier ' +
					'geht wie bisher.'
			};
		}

		const eigene = await leseEigene(tx, meetingId, ich.id);

		/*
		 * **Zwei verschiedene Fristen, und der Unterschied hat einen Grund.**
		 *
		 * *Erteilen* geht bis zuletzt: Wer um 19.05 im Stau steht, soll noch
		 * jemanden bevollmächtigen können. Die Sitzungsleitung bestätigt ohnehin,
		 * und wer selbst eintrifft, hebt seine Vollmacht damit auf.
		 *
		 * *Zurücknehmen* endet mit der Eröffnung: Danach steht die bevollmächtigte
		 * Person im Saal und hat die Stimme vielleicht schon ausgeübt. Ein
		 * Widerruf vom Telefon aus zöge eine abgegebene Stimme nachträglich in
		 * Zweifel. Wer es sich anders überlegt, kommt selbst — das beendet die
		 * Vertretung sauber und vor aller Augen.
		 */
		const aenderbar = z.state === 'freigegeben' || z.state === 'laufend';
		const widerrufbar = z.state === 'freigegeben';

		return {
			erlaubt: true,
			grund: aenderbar
				? null
				: 'Für diese Versammlung lässt sich das nicht mehr ändern.',
			aenderbar,
			widerrufbar,
			widerrufGrund: widerrufbar
				? null
				: 'Die Versammlung läuft. Kommen Sie selbst — damit endet die Vertretung — oder wenden Sie sich an die Sitzungsleitung.',
			eigene,
			waehlbare: aenderbar
				? (await holeParteien(operatorId, meetingId)).filter((p) => p.id !== ich.id)
				: [],
			weisungen: aenderbar || eigene ? await leseWeisungen(tx, operatorId, meetingId, eigene) : []
		};
	});
}

async function leseWeisungen(
	tx: postgres.TransactionSql,
	operatorId: Id,
	meetingId: Id,
	eigene: Vollmacht | null
): Promise<Weisungsposten[]> {
	const traktanden = await holeTraktanden(operatorId, meetingId);
	const bisher = eigene ? await leseEmpfehlungenInTx(tx, eigene.id) : new Map();

	return traktanden
		.filter((t) => t.knoten.art === 'abstimmung' && (t.knoten.antragswortlaut ?? '').trim() !== '')
		.map((t) => ({
			traktandumId: t.knoten.id,
			nummer: t.nummer,
			titel: t.knoten.titel,
			wortlaut: t.knoten.antragswortlaut as string,
			wahl: (bisher.get(t.knoten.id)?.wahl as Empfehlungswahl) ?? null
		}));
}

export interface Empfehlung {
	traktandumId: Id;
	wahl: Empfehlungswahl;
	/** Der Antragswortlaut, wie er beim Erteilen lautete. */
	wortlaut: string;
}

async function leseEmpfehlungenInTx(
	tx: postgres.TransactionSql,
	proxyId: Id
): Promise<Map<string, Empfehlung>> {
	const zeilen = await tx<{ agenda_item_id: string; choice: string; wording: string }[]>`
		SELECT agenda_item_id, choice, wording FROM proxy_recommendation
		 WHERE proxy_id = ${proxyId}
	`;
	return new Map(
		zeilen.map((z) => [
			z.agenda_item_id,
			{ traktandumId: z.agenda_item_id, wahl: z.choice as Empfehlungswahl, wortlaut: z.wording }
		])
	);
}

/** Die Empfehlungen einer Vollmacht — für das Telefon der bevollmächtigten Person. */
export async function holeEmpfehlungen(operatorId: Id, proxyId: Id): Promise<Empfehlung[]> {
	return alsBetreiber(operatorId, async (tx) => [...(await leseEmpfehlungenInTx(tx, proxyId)).values()]);
}

/**
 * Erklärt die Vollmacht und schreibt die Weisungen dazu — in **einem** Vorgang.
 *
 * Getrennt hiesse, dass eine Vollmacht ohne die Weisungen dastehen könnte, die
 * ihr Sinn geben: Wer sie erteilt, weil er zu drei Anträgen etwas zu sagen hat,
 * hätte am Ende die Vertretung und nicht die Weisung.
 */
export async function erklaere(
	operatorId: Id,
	meetingId: Id,
	parteiId: Id,
	eingabe: {
		bevollmaechtigtId?: Id | null;
		bevollmaechtigtName?: string | null;
		bemerkung?: string | null;
		istVerwaltung?: boolean;
		weisungen?: { traktandumId: Id; wahl: string }[];
	}
): Promise<Vollmacht> {
	return alsBetreiber(operatorId, async (tx) => {
		await verlangeFreigeschaltet(tx, meetingId);
		await verlangeOffeneVersammlung(tx, meetingId);
		const ich = await verlangeMomentzeile(tx, meetingId, parteiId);

		// **Kein Benutzerkonto.** Hier handelt ein Eigentümer, kein Konto der
		// Bewirtschaftung. `actor_user_id` bleibt leer, der Name kommt aus der
		// Momentaufnahme und nicht vom Aufrufer — sonst stünde im Verlauf, was das
		// Telefon behauptet hat.
		const handelnder: Handelnder & { operatorId: string } = {
			operatorId,
			userId: null,
			label: handelnderName(ich.display_name)
		};

		/*
		 * **Kein Vertretungsgrund auf diesem Weg** (Ä-28, 24.09.2026). Hier
		 * **erteilt** eine Eigentümerin eine Vollmacht. Wer von Gesetzes wegen
		 * vertritt, bekommt sie gerade nicht erteilt: Ein Organvertreter handelt
		 * für die juristische Person, ein Beistand kraft Amtes. Die Auswahl hier
		 * anzubieten hiesse, jemanden erklären zu lassen, er werde gesetzlich
		 * vertreten — und das wäre eine Angabe über sich selbst, die niemand
		 * prüft. Solche Vertretungen erfasst die Sitzungsleitung am Einlass.
		 *
		 * **Hergeleitet wird trotzdem** (Produktentscheid 03.11.2026): Erteilt
		 * eine gemeinschaftliche Zeile die Vollmacht einer ihrer eingetragenen
		 * Mitberechtigten, setzt `erfasseInTx` selbst `mitberechtigt`. Das ist
		 * keine Angabe über sich selbst, sondern steht im Register.
		 */
		const v = await erfasseInTx(tx, handelnder, meetingId, {
			vertreteneId: ich.id,
			bevollmaechtigtId: eingabe.bevollmaechtigtId,
			bevollmaechtigtName: eingabe.bevollmaechtigtName,
			bemerkung: eingabe.bemerkung,
			herkunft: 'zugang',
			istVerwaltung: eingabe.istVerwaltung
		});

		const gesetzt = await schreibeEmpfehlungen(
			tx,
			operatorId,
			meetingId,
			v.id,
			eingabe.weisungen ?? []
		);
		if (gesetzt > 0) {
			await schreibeVerlauf(tx, handelnder, [
				ereignis(EREIGNISARTEN.weisungenErteilt, { art: 'proxy', id: v.id }, {
					anzahl: gesetzt,
					vertretene: v.vertreteneName,
					vertreter: v.bevollmaechtigtName
				})
			]);
		}
		return v;
	});
}

/** Die Weisungen einer bestehenden eigenen Vollmacht ändern. */
export async function setzeWeisungen(
	operatorId: Id,
	meetingId: Id,
	parteiId: Id,
	weisungen: { traktandumId: Id; wahl: string }[]
): Promise<number> {
	return alsBetreiber(operatorId, async (tx) => {
		await verlangeFreigeschaltet(tx, meetingId);
		await verlangeOffeneVersammlung(tx, meetingId);
		const ich = await verlangeMomentzeile(tx, meetingId, parteiId);
		const handelnder: Handelnder & { operatorId: string } = {
			operatorId,
			userId: null,
			label: handelnderName(ich.display_name)
		};
		const eigene = await leseEigene(tx, meetingId, ich.id);
		if (!eigene) {
			throw new FachlicherFehler(
				'keine_vollmacht',
				'Sie haben für diese Versammlung keine Vollmacht erteilt.',
				'zustand'
			);
		}
		const gesetzt = await schreibeEmpfehlungen(tx, operatorId, meetingId, eigene.id, weisungen);
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.weisungenErteilt, { art: 'proxy', id: eigene.id }, {
				anzahl: gesetzt,
				vertretene: eigene.vertreteneName,
				vertreter: eigene.bevollmaechtigtName
			})
		]);
		return gesetzt;
	});
}

/**
 * Schreibt die Weisungen neu.
 *
 * **Erst löschen, dann setzen.** Eine Weisung, die beim Ändern nicht mehr
 * mitkommt, wurde zurückgenommen — sie stehen zu lassen hiesse, dass ein
 * Häkchen sich nicht mehr entfernen liesse. Der Wortlaut wird dabei jedes Mal
 * frisch abgeschrieben: Er ist der Bezugspunkt, an dem später hängt, ob die
 * Weisung noch gilt.
 */
async function schreibeEmpfehlungen(
	tx: postgres.TransactionSql,
	operatorId: Id,
	meetingId: Id,
	proxyId: Id,
	weisungen: { traktandumId: Id; wahl: string }[]
): Promise<number> {
	await tx`DELETE FROM proxy_recommendation WHERE proxy_id = ${proxyId}`;

	let gesetzt = 0;
	for (const w of weisungen) {
		if (!istEmpfehlungswahl(w.wahl)) continue;

		// Der Wortlaut kommt aus der Datenbank, nicht aus dem Formular: Sonst
		// bestimmte der Absender selbst, worauf sich seine Weisung angeblich bezog.
		const [t] = await tx<{ motion_text: string | null; item_kind: string }[]>`
			SELECT motion_text, item_kind FROM agenda_item
			 WHERE id = ${w.traktandumId} AND meeting_id = ${meetingId}
		`;
		if (!t || t.item_kind !== 'abstimmung' || !t.motion_text?.trim()) {
			throw new FachlicherFehler(
				'kein_antrag',
				'Zu diesem Traktandum lässt sich keine Weisung erteilen: Es steht kein Antrag zur Abstimmung.',
				'weisungen'
			);
		}

		await tx`
			INSERT INTO proxy_recommendation (operator_id, proxy_id, agenda_item_id, choice, wording)
			VALUES (${operatorId}, ${proxyId}, ${w.traktandumId}, ${w.wahl}, ${t.motion_text})
		`;
		gesetzt++;
	}
	return gesetzt;
}

/**
 * Nimmt die eigene Vollmacht zurück.
 *
 * Ohne Begründungspflicht für die erklärende Person: Wer selbst bevollmächtigt
 * hat, muss nicht darlegen, warum er es sich anders überlegt. Im Verlauf steht
 * trotzdem ein Grund — der Weg, auf dem es geschah.
 */
export async function widerrufeEigene(
	operatorId: Id,
	meetingId: Id,
	parteiId: Id
): Promise<void> {
	const { eigene, name } = await alsBetreiber(operatorId, async (tx) => {
		await verlangeVorDerSitzung(tx, meetingId);
		const ich = await verlangeMomentzeile(tx, meetingId, parteiId);
		return { eigene: await leseEigene(tx, meetingId, ich.id), name: ich.display_name };
	});
	if (!eigene) {
		throw new FachlicherFehler(
			'keine_vollmacht',
			'Sie haben für diese Versammlung keine Vollmacht erteilt.',
			'zustand'
		);
	}

	await widerrufeVollmacht(
		{ operatorId, userId: null, label: handelnderName(name) },
		meetingId,
		eigene.id,
		verlangeGrund('Von der vertretenen Person über den persönlichen Zugang zurückgenommen')
	);
}

async function verlangeMomentzeile(
	tx: postgres.TransactionSql,
	meetingId: Id,
	parteiId: Id
): Promise<{ id: string; display_name: string }> {
	const z = await momentzeile(tx, meetingId, parteiId);
	if (!z) {
		throw new FachlicherFehler(
			'nicht_stimmberechtigt',
			'Sie sind an dieser Versammlung nicht stimmberechtigt.',
			'zustand'
		);
	}
	return z;
}

async function verlangeFreigeschaltet(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<void> {
	const [z] = await tx<{ proxy_by_access: boolean }[]>`
		SELECT g.proxy_by_access FROM meeting m
		  JOIN stweg g ON g.id = m.stweg_id
		 WHERE m.id = ${meetingId}
	`;
	if (!z?.proxy_by_access) {
		throw new FachlicherFehler(
			'nicht_freigeschaltet',
			'Für diese Gemeinschaft ist die Vollmacht über den persönlichen Zugang nicht freigeschaltet.',
			'zustand'
		);
	}
}

/** Erklären und Weisen geht, solange die Versammlung nicht vorbei ist. */
async function verlangeOffeneVersammlung(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<void> {
	const [z] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
	if (z?.state !== 'freigegeben' && z?.state !== 'laufend') {
		throw new FachlicherFehler(
			'nicht_mehr_aenderbar',
			'Für diese Versammlung lässt sich das nicht mehr ändern.',
			'zustand'
		);
	}
}

/**
 * Zurücknehmen endet mit der Eröffnung.
 *
 * Danach hat die bevollmächtigte Person die Stimme vielleicht schon ausgeübt.
 * Wer es sich anders überlegt, kommt selbst: Das beendet die Vertretung und ist
 * für alle sichtbar.
 */
async function verlangeVorDerSitzung(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<void> {
	const [z] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
	if (z?.state !== 'freigegeben') {
		throw new FachlicherFehler(
			'nicht_mehr_widerrufbar',
			z?.state === 'laufend'
				? 'Die Versammlung läuft. Kommen Sie selbst — damit endet die Vertretung — oder wenden Sie sich an die Sitzungsleitung.'
				: 'Für diese Versammlung lässt sich das nicht mehr ändern.',
			'zustand'
		);
	}
}
