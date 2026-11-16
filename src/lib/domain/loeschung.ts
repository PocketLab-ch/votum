/**
 * Wann sich eine Versammlung löschen lässt (rein).
 *
 * **Warum es das überhaupt gibt.** Wer eine Gemeinschaft aus einer gemeinsamen
 * Versammlung löst, hat danach eine Versammlung, die für sich steht — und
 * manchmal ist genau die der Irrtum gewesen: falsches Datum, falsche
 * Gemeinschaft, doppelt angelegt. Bis zum 11.08.2026 gab es keinen Weg, sie
 * loszuwerden; sie blieb in jeder Liste stehen, und der einzige Ausweg war,
 * daneben eine neue anzulegen. Gemeldet mit den Worten: «Weil wenn man eine
 * Versammlung auslöst, muss man diese später so oder so bearbeiten und
 * vervollständigen.»
 *
 * **Warum nur im Entwurf.** Ab der Freigabe steht die Versammlung in versandten
 * Einladungen, es hängen Zugangscodes daran und die Momentaufnahme ist
 * festgeschrieben — sie zu löschen hiesse, einen Vorgang verschwinden zu
 * lassen, den Dritte bereits kennen. Ab dem Eröffnen ist sie ein Nachweis. Im
 * Entwurf ist sie nichts davon: ein Vorhaben, das niemand ausser dem Verwalter
 * gesehen hat. Die Freigabe lässt sich zurücknehmen (`freigabe.ts`) — der Weg
 * ist also auch dann nicht versperrt, er führt nur über einen sichtbaren
 * Schritt.
 *
 * **Das Datum lässt sich nicht entfernen**, danach war ebenfalls gefragt.
 * `meeting_date` ist NOT NULL, und das aus gutem Grund: Eine Versammlung ohne
 * Termin ist keine Versammlung, sondern eine Karteileiche, die in jeder Liste
 * ohne Sortierung auftaucht. Wer den Termin nicht kennt, verschiebt ihn; wer
 * die Versammlung nicht braucht, löscht sie.
 *
 * Rein: hinein geht die Lage, heraus kommt der Befund. Der Verlauf bleibt in
 * jedem Fall stehen (AD-5) — dass gelöscht wurde, ist selbst ein Ereignis.
 */
import type { Versammlungszustand } from './versammlung';
import { zustandsname } from './versammlung';
import type { Id } from './types';

export interface Loeschlage {
	zustand: Versammlungszustand;
	/** Wie die Versammlung heisst, wenn man von ihr spricht. */
	bezeichnung: string;
	/** Versammlungen, die diese als ihre Vorgängerin führen. */
	folgeversammlungen: { id: Id; bezeichnung: string }[];
	/** Zu welcher gemeinsamen Versammlung sie gehört, wenn zu einer. */
	gemeinsam: string | null;
	/** Was mit ihr verschwindet. */
	haengtDran: { traktanden: number; dateien: number };
}

export interface Loeschungsbefund {
	erlaubt: boolean;
	/** Warum nicht — nur bei `erlaubt: false`, und dann immer, samt Ausweg. */
	grund?: string;
	/** Was geschieht, in einem Satz. Steht in der Rückfrage vor dem Löschen. */
	folgen: string;
}

export function pruefeLoeschung(lage: Loeschlage): Loeschungsbefund {
	if (lage.zustand !== 'entwurf') {
		return { erlaubt: false, grund: grundZumZustand(lage.zustand), folgen: '' };
	}

	if (lage.folgeversammlungen.length > 0) {
		const eine = lage.folgeversammlungen.length === 1;
		const namen = lage.folgeversammlungen.map((f) => `«${f.bezeichnung}»`).join(', ');
		return {
			erlaubt: false,
			grund:
				`Auf diese Versammlung ${eine ? 'verweist' : 'verweisen'} ${namen} als Vorgängerin. ` +
				'An dieser Angabe hängt die Zehntagesfrist nach ZGB Art. 712p Abs. 2. Nehmen Sie sie ' +
				`dort zuerst heraus, dann lässt sich diese hier löschen.`,
			folgen: ''
		};
	}

	return { erlaubt: true, folgen: folgensatz(lage) };
}

function grundZumZustand(z: Versammlungszustand): string {
	if (z === 'freigegeben') {
		return (
			'Diese Versammlung ist freigegeben — sie steht in den versandten Einladungen, und es ' +
			'ist festgeschrieben, wer stimmberechtigt ist. Nehmen Sie die Freigabe ' +
			'zurück, wenn Sie die Versammlung noch loswerden wollen.'
		);
	}
	return (
		`Diese Versammlung ist ${zustandsname(z)}. Was einmal getagt hat, bleibt: Anwesenheit, ` +
		'Stimmen und Protokoll sind der Nachweis der gefassten Beschlüsse. Gelöscht werden kann ' +
		'nur eine Versammlung im Entwurf.'
	);
}

/**
 * Was verschwindet, in einem Satz.
 *
 * Eine Rückfrage, die nur «wirklich?» fragt, wird von niemandem anders als mit
 * ja beantwortet. Sie muss nennen, was weg ist — sonst ist sie eine Formalie.
 */
function folgensatz(lage: Loeschlage): string {
	const teile: string[] = [];
	const { traktanden, dateien } = lage.haengtDran;

	if (traktanden > 0) teile.push(`${traktanden} ${traktanden === 1 ? 'Traktandum' : 'Traktanden'}`);
	if (dateien > 0) teile.push(`${dateien} ${dateien === 1 ? 'Datei' : 'Dateien'}`);

	const satz =
		teile.length > 0
			? `${lage.bezeichnung} wird gelöscht, mit ${verbunden(teile)}.`
			: `${lage.bezeichnung} wird gelöscht.`;

	const nachsatz =
		lage.gemeinsam !== null
			? ` Sie tagt heute bei «${lage.gemeinsam}» mit und fällt dort weg.`
			: '';

	return (
		satz +
		nachsatz +
		' Das lässt sich nicht rückgängig machen. Im Verlauf bleibt stehen, dass gelöscht wurde.'
	);
}

function verbunden(teile: string[]): string {
	if (teile.length === 1) return teile[0];
	return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}
