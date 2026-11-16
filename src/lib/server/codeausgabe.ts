/**
 * Der ausgegebene Zugangscode — mit QR-Code zum Abscannen.
 *
 * **Der Anlass** (Auftraggeber, 24.08.2026): «Wenn ich einen Eigentümer von Hand
 * erfasse, habe ich jetzt gerade die Herausforderung, dass der QR auf dem
 * Monitor nicht geht bzw. nicht gelesen werden kann. […] Wäre sogar möglich,
 * dass ich dann sein Mobiltelefon nehme und er seinen persönlichen QR-Code
 * angezeigt bekommt inkl. Link? […] Wäre das sicherer als den Code von Hand
 * aufzuschreiben?»
 *
 * **Ja, sicherer — und zwar aus drei Gründen.** Der Code steht ohnehin im
 * Klartext auf dem Bildschirm; der QR daneben trägt nichts Neues. Er ersetzt
 * aber drei Wege, auf denen er sonst verloren geht:
 *
 *   - **Kein Zettel.** Ein aufgeschriebener Code bleibt liegen — auf dem Tisch,
 *     im Papierkorb des Saals, in der Jackentasche. Der QR verschwindet mit dem
 *     Fenster.
 *   - **Kein Vorlesen.** Wer einen Code durch den Saal ruft, gibt ihn allen, die
 *     zuhören. Beim Scannen hört niemand mit.
 *   - **Kein Vertippen.** Ein falsch abgeschriebener Code erzeugt einen
 *     vergeblichen Versuch und kostet im Saal die Zeit, die man gerade nicht
 *     hat.
 *
 * Was er **nicht** ändert: Wer den Bildschirm fotografiert, hat den Zugang — das
 * gilt für den Klartext genauso. Der Code lebt wenige Minuten und bindet sich an
 * das erste Gerät, das ihn einlöst; ein zweites wird abgewiesen.
 */
import QRCode from 'qrcode';
import { gibCodeAus } from './zugangssitzung';
import { gruppiere } from '$lib/domain/zugang';
import type { Handelnder } from './audit';
import type { Id } from '$lib/domain/types';

export interface Codeausgabe {
	/** Der Code in Vierergruppen — zum Vorlesen und Abtippen. */
	code: string;
	name: string;
	gueltigBis: string;
	/** Die Adresse, die der QR trägt: der Einstieg mit diesem Code. */
	adresse: string;
	/** Der QR als SVG, fertig zum Einbetten. */
	svg: string;
}

export async function gibCodeMitBildAus(
	handelnder: Handelnder & { operatorId: Id },
	meetingId: Id,
	kennung: Id,
	herkunft: string
): Promise<Codeausgabe> {
	const a = await gibCodeAus(handelnder, meetingId, kennung);

	/*
	 * Der **rohe** Code in der Adresse, nicht die gruppierte Fassung: Die
	 * Trennstriche sind eine Lesehilfe fürs Auge. `normalisiere()` würde sie zwar
	 * wegräumen, aber eine Adresse soll nicht darauf angewiesen sein.
	 */
	const adresse = `${herkunft}/z/${a.code}`;

	return {
		code: gruppiere(a.code),
		name: a.name,
		gueltigBis: a.gueltigBis,
		adresse,
		svg: await QRCode.toString(adresse, {
			type: 'svg',
			// Höhere Fehlerkorrektur als beim Wandcode: Dieser hier wird aus der
			// Hand gescannt, oft schräg und bei schlechtem Saallicht.
			errorCorrectionLevel: 'Q',
			margin: 1
		})
	};
}
