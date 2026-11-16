/**
 * Der Betreiber und seine Briefkopfvorlage (Story 3.6).
 */
import { alsBetreiber } from './db';
import { legeAb, lies, liesHochgeladene } from './dateien';
import { schreibeVerlauf, type Handelnder } from './audit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { adresseBrauchbar } from '$lib/domain/mailversand';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';

export interface Betreiber {
	id: Id;
	name: string;
	briefkopfPruefsumme: string | null;
	briefkopfHoeheMm: number;
	briefkopfAlleSeiten: boolean;
	/** Ob Hinweise auf nicht verfügbare KI-Funktionen ausgeblendet werden. */
	kiHinweiseAusblenden: boolean;
	/** Ob der Maschinenvermerk am Schluss des Protokolls erscheint (FR-63). */
	maschinenvermerkImProtokoll: boolean;
	/**
	 * Wohin Erinnerungen der Anwendung gehen (Migration 099) — `null` heisst:
	 * es wird nicht erinnert.
	 *
	 * **Eine Adresse des Hauses, nicht die eines Kontos.** Konten gehören
	 * Personen, und Personen sind in den Ferien. Die Erinnerung an den
	 * Einladungsversand gehört an die Adresse, die ohnehin gelesen wird.
	 */
	erinnerungsadresse: string | null;
}

export async function holeBetreiber(operatorId: Id): Promise<Betreiber | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<
			{
				id: string;
				name: string;
				letterhead_checksum: string | null;
				letterhead_top_mm: number;
				letterhead_all_pages: boolean;
				ai_hints_hidden: boolean;
				ai_note_in_minutes: boolean;
				reminder_address: string | null;
			}[]
		>`SELECT id, name, letterhead_checksum, letterhead_top_mm, letterhead_all_pages,
		         ai_hints_hidden, ai_note_in_minutes, reminder_address
		  FROM operator WHERE id = ${operatorId}`;
		return z
			? {
					id: z.id,
					name: z.name,
					briefkopfPruefsumme: z.letterhead_checksum,
					briefkopfHoeheMm: z.letterhead_top_mm,
					briefkopfAlleSeiten: z.letterhead_all_pages,
					kiHinweiseAusblenden: z.ai_hints_hidden,
					maschinenvermerkImProtokoll: z.ai_note_in_minutes,
					erinnerungsadresse: z.reminder_address
				}
			: null;
	});
}

/**
 * Liest die Briefkopfvorlage als Bytes, oder `null` wenn keine hinterlegt ist.
 *
 * Fehlt die Datei zur hinterlegten Prüfsumme, wird `null` zurückgegeben statt
 * geworfen: Ein PDF ohne Briefkopf ist ein Schönheitsfehler, keine Einladung am
 * Tag des Versands ist ein Problem.
 */
export async function holeBriefkopf(operatorId: Id): Promise<Uint8Array | null> {
	const b = await holeBetreiber(operatorId);
	if (!b?.briefkopfPruefsumme) return null;
	try {
		return await lies(b.briefkopfPruefsumme);
	} catch {
		return null;
	}
}

export async function hinterlegeBriefkopf(
	handelnder: Handelnder & { operatorId: string },
	datei: File,
	hoeheMm: number,
	alleSeiten: boolean
): Promise<void> {
	if (!datei || datei.size === 0) {
		throw new FachlicherFehler('keine_datei', 'Es wurde keine Datei gewählt.', 'datei');
	}

	const abgelegt = await legeAb(await liesHochgeladene(datei), datei.name, datei.type);

	// Ein Bild als Briefkopf liesse sich zwar zeichnen, aber nicht als Seite
	// unterlegen — und ein Briefkopf, der die Seitenränder nicht kennt, sitzt
	// zwangsläufig falsch.
	if (abgelegt.art !== 'application/pdf') {
		throw new FachlicherFehler(
			'briefkopf_kein_pdf',
			'Die Briefkopfvorlage muss ein PDF sein. Ein Bild kennt die Seitenränder nicht und sässe falsch.',
			'datei'
		);
	}

	if (!Number.isInteger(hoeheMm) || hoeheMm < 10 || hoeheMm > 150) {
		throw new FachlicherFehler(
			'briefkopf_hoehe',
			'Der freizuhaltende Bereich muss zwischen 10 und 150 Millimetern liegen.',
			'hoeheMm'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`
			UPDATE operator SET
				letterhead_checksum = ${abgelegt.pruefsumme},
				letterhead_top_mm = ${hoeheMm},
				letterhead_all_pages = ${alleSeiten}
			WHERE id = ${handelnder.operatorId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.briefkopfHinterlegt,
				{ art: 'operator', id: handelnder.operatorId },
				{ pruefsumme: abgelegt.pruefsumme, name: abgelegt.name, hoeheMm, alleSeiten }
			)
		);
	});
}

export async function entferneBriefkopf(
	handelnder: Handelnder & { operatorId: string }
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`UPDATE operator SET letterhead_checksum = NULL WHERE id = ${handelnder.operatorId}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.briefkopfEntfernt, { art: 'operator', id: handelnder.operatorId })
		);
	});
}

/**
 * Den Namen der Bewirtschaftung ändern.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Wie kann ich bspw. den Namen der Firma
 * ändern? Jetzt steht da Probère Immobilien.» Er stand seit dem Einrichten fest
 * und hatte keine Maske — änderbar war er nur in der Datenbank.
 *
 * **Wohin der Name geht: auf die Einladung, sonst nirgends.** Nachgesehen, nicht
 * angenommen — es sind genau zwei Stellen, der Absender im Einladungs-PDF
 * (`einladung.pdf/+server.ts`) und der Absendername der Einladungsmail
 * (`einladungsversand.ts`). Traktandenliste, Protokoll und Zugangskarte
 * bekommen ihn **nicht**; sie führen nur den Briefkopf. Die erste Fassung
 * dieses Kommentars behauptete alle vier — drei davon waren falsch.
 *
 * Die Änderung steht trotzdem im Verlauf, mit vorher und nachher: Sonst bliebe
 * unerklärlich, warum zwei Einladungen desselben Jahres verschiedene Absender
 * tragen. **Rückwirkend ist sie nicht** — schon verschickte Einladungen behalten
 * den alten Namen, und das ist richtig: Ein Dokument sagt, wie es hiess, als es
 * entstand.
 */
export async function setzeBetreiberbezeichnung(
	handelnder: Handelnder & { operatorId: Id },
	name: string
): Promise<{ name: string }> {
	const neu = name.trim();
	if (zeichenzahl(neu) < 2) {
		throw new FachlicherFehler(
			'name_zu_kurz',
			'Der Name braucht mindestens zwei Zeichen.',
			'name'
		);
	}
	if (zeichenzahl(neu) > 120) {
		throw new FachlicherFehler(
			'name_zu_lang',
			'Der Name ist zu lang. Höchstens 120 Zeichen.',
			'name'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [vorher] = await tx<{ name: string }[]>`
			SELECT name FROM operator WHERE id = ${handelnder.operatorId}
		`;
		if (vorher?.name === neu) return { name: neu };

		await tx`UPDATE operator SET name = ${neu} WHERE id = ${handelnder.operatorId}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.betreiberBezeichnungGeaendert,
				{ art: 'operator', id: handelnder.operatorId },
				{ vorher: vorher?.name ?? null, nachher: neu }
			)
		);
		return { name: neu };
	});
}

/**
 * Die KI-Hinweise ein- oder ausblenden (Nachtrag zu FR-62).
 *
 * **Eine Anzeigeeinstellung, keine Schranke.** Was zugelassen ist, bleibt
 * zugelassen und sichtbar; ausgeblendet wird nur der Hinweis darauf, dass etwas
 * *nicht* geht. Deshalb steht sie beim Betreiber und nicht bei der
 * Gemeinschaft: Ob überhaupt ein Modell eingerichtet ist, entscheidet der
 * Betrieb der Anlage — und wer dreissig Gemeinschaften führt, will das einmal
 * setzen.
 */
export async function setzeKiHinweise(
	handelnder: Handelnder & { operatorId: Id },
	ausblenden: boolean,
	vermerkImProtokoll: boolean
): Promise<boolean> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`
			UPDATE operator
			SET ai_hints_hidden = ${ausblenden}, ai_note_in_minutes = ${vermerkImProtokoll}
			WHERE id = ${handelnder.operatorId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.kiHinweiseGeaendert,
				{ art: 'operator', id: handelnder.operatorId },
				{
					kiHinweise: ausblenden ? 'ausgeblendet' : 'sichtbar',
					maschinenvermerk: vermerkImProtokoll ? 'im Protokoll' : 'weggelassen'
				}
			)
		);
		return ausblenden;
	});
}

/**
 * Die Adresse, an die Erinnerungen gehen (Migration 099).
 *
 * **Leer heisst aus.** Ohne Adresse erinnert die Anwendung nicht — sie erfindet
 * keine. Der Lauf sagt das jedes Mal ins Protokoll des Dienstes, statt einen
 * Merker zu setzen; sonst käme die Erinnerung auch dann nicht mehr, wenn die
 * Adresse später nachgetragen wird.
 */
export async function setzeErinnerungsadresse(
	handelnder: Handelnder & { operatorId: Id },
	adresse: string
): Promise<string | null> {
	const wert = adresse.trim();
	if (wert !== '' && !adresseBrauchbar(wert)) {
		throw new FachlicherFehler(
			'adresse_unbrauchbar',
			'Das sieht nicht nach einer E-Mail-Adresse aus. Lassen Sie das Feld leer, wenn nicht ' +
				'erinnert werden soll.',
			'erinnerungsadresse'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`
			UPDATE operator SET reminder_address = ${wert || null} WHERE id = ${handelnder.operatorId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.erinnerungsadresseGesetzt,
				{ art: 'operator', id: handelnder.operatorId },
				// Die Adresse steht dabei: Sie ist der ganze Inhalt der Änderung, und
				// im Streitfall geht es genau um sie.
				{ adresse: wert || null }
			)
		);
		return wert || null;
	});
}
