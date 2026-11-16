/**
 * Das Vollmachtsformular zum Ausdrucken (Bedienbarkeitsprüfung 05.09.2026,
 * Befund 25).
 *
 * **Der Anlass**: «Es fehlen ein Vollmachtsformular und eine Absenderangabe.»
 * Die Einladung nennt seit dem 23.08.2026, dass man sich vertreten lassen kann,
 * und seit wann welche Grenze gilt — aber sie legt nichts bei, womit sich das
 * tun liesse. Wer nicht kommen kann, muss den Text selbst aufsetzen, und was
 * er aufsetzt, prüft am Abend jemand, der ihn nie gesehen hat.
 *
 * **Warum ein eigenes Blatt und kein Absatz in der Einladung.** Es wird
 * unterschrieben und mitgebracht: Es muss sich abtrennen lassen, ohne die
 * Traktandenliste zu zerschneiden. Und es gehört **einer Partei** — Name und
 * Einheiten stehen schon darauf, damit am Einlass nichts zu raten bleibt.
 *
 * **Was es bewusst NICHT tut.** Es nimmt keine Weisung entgegen. Eine Weisung
 * ist etwas anderes als eine Vollmacht (`domain/weisungsregel.ts`): Sie bindet
 * den Vertreter an eine Haltung, gehört zur Mitgliedsgemeinschaft und wird in
 * der Anwendung erfasst, wo sie nachweisbar bleibt. Ein Kästchen «Ja / Nein»
 * auf einem Zettel, den niemand erfasst, sähe aus wie eine Weisung und wäre
 * keine.
 *
 * **Und es entscheidet nichts.** Ob eine Vollmacht gilt, prüft die
 * Sitzungsleitung am Einlass (`domain/vollmacht.ts`); das Blatt ist der
 * Nachweis, den sie dafür in die Hand bekommt.
 */
import { A4, mm } from '$lib/domain/textsatz';
import { datumLang } from '$lib/domain/datum';
import { vertretungssatz } from '$lib/domain/einladung';
import { GRAU, LINIE, neuesBlatt, zeichneText } from './basis';

export interface Vollmachtsrahmen {
	gemeinschaftName: string;
	/** Wo die Gemeinschaft liegt — für die Zuordnung des Gebäudes. */
	gemeinschaftAdresse?: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	stufe: 'erste' | 'zweite';
	/** Wie viele Vollmachten eine Person höchstens ausüben darf, wenn geregelt. */
	vollmachtsgrenze?: number | null;
	vollmachtsgrenzeQuelle?: string | null;
}

export interface Vollmachtgeber {
	name: string;
	/** Die Einheiten, für die diese Partei stimmt — als Beschriftungen. */
	einheiten: string[];
}

/**
 * Ein Blatt je Vollmachtgeber.
 *
 * Mehrere Parteien ergeben mehrere Seiten in **einem** Dokument: Der Versand
 * geht je Person hinaus, und ein Bündel Einzeldateien wäre am Drucker die
 * mühsamere Hälfte der Arbeit.
 */
export async function erzeugeVollmachtsformular(
	rahmen: Vollmachtsrahmen,
	geber: Vollmachtgeber[]
): Promise<Uint8Array> {
	const blatt = await neuesBlatt();
	const rand = mm(20);
	const breite = A4.breite - 2 * rand;

	const normal = { schrift: blatt.schriften.normal, groesse: 10.5 };
	const klein = { schrift: blatt.schriften.normal, groesse: 8.5, farbe: GRAU };
	const fett = { schrift: blatt.schriften.fett, groesse: 10.5 };

	for (const g of geber) {
		const seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
		let y = A4.hoehe - rand;

		/*
		 * **Nicht zweimal dasselbe** (Sichtprobe 07.09.2026). Der Name einer
		 * Gemeinschaft **ist** oft ihre Adresse; dann stand auf dem Blatt
		 * «Sonnenhalde 12, Sonnenhalde 12, 3000 Bern». Angehängt wird die
		 * Adresse deshalb nur, wo sie etwas hinzufügt — und was sie hinzufügt,
		 * ist der Ort.
		 */
		const wer = rahmen.gemeinschaftAdresse?.startsWith(rahmen.gemeinschaftName)
			? rahmen.gemeinschaftAdresse
			: [rahmen.gemeinschaftName, rahmen.gemeinschaftAdresse].filter(Boolean).join(', ');
		y = zeichneText(seite, wer, rand, y, breite, klein);
		y = zeichneText(seite, 'Vollmacht', rand, y - mm(4), breite, {
			schrift: blatt.schriften.fett,
			groesse: 17
		});

		/*
		 * **Die Adresse der Liegenschaft steht NICHT in der Ortszeile**
		 * (Code-Review 07.09.2026). «… · Restaurant Bären · Sonnenhalde 12, 3000
		 * Bern» liest sich wie zwei Veranstaltungsorte, und der Bevollmächtigte
		 * hat oft nur dieses Blatt in der Hand — er stünde an der Liegenschaft
		 * statt im Restaurant. Sie gehört zur Gemeinschaft, also nach oben.
		 */
		const wann = [
			`${datumLang(rahmen.datum)}, ${rahmen.uhrzeit} Uhr`,
			rahmen.ort,
			rahmen.stufe === 'zweite' ? 'Zweitversammlung' : null
		]
			.filter(Boolean)
			.join(' · ');
		y = zeichneText(seite, `Für die Versammlung vom ${wann}`, rand, y - mm(1), breite, klein);

		y -= mm(8);
		y = zeichneText(
			seite,
			'Die unterzeichnende Person bevollmächtigt die unten genannte Person, sie an dieser ' +
				'Versammlung zu vertreten und dort für sie zu stimmen.',
			rand,
			y,
			breite,
			normal
		);

		// ── Wer die Vollmacht gibt: schon ausgefüllt ─────────────────────────
		y -= mm(7);
		y = zeichneText(seite, 'Vollmacht gibt', rand, y, breite, klein);
		y = zeichneText(seite, g.name, rand, y - mm(1), breite, fett);
		if (g.einheiten.length > 0) {
			y = zeichneText(
				seite,
				`${g.einheiten.length === 1 ? 'Einheit' : 'Einheiten'}: ${g.einheiten.join(', ')}`,
				rand,
				y - mm(0.5),
				breite,
				klein
			);
		}

		// ── Wer sie bekommt: von Hand ────────────────────────────────────────
		y -= mm(9);
		y = zeichneText(seite, 'Vollmacht erhält', rand, y, breite, klein);
		y -= mm(9);
		const linie = (beschriftung: string, x: number, w: number) => {
			seite.drawLine({
				start: { x, y },
				end: { x: x + w, y },
				thickness: 0.8,
				color: LINIE
			});
			zeichneText(seite, beschriftung, x, y - mm(4), w, klein);
		};
		linie('Name und Vorname', rand, breite);

		y -= mm(16);
		linie('Adresse', rand, breite);

		// ── Was dabei gilt ───────────────────────────────────────────────────
		y -= mm(14);
		y = zeichneText(seite, vertretungssatz(rahmen.vollmachtsgrenze, rahmen.vollmachtsgrenzeQuelle), rand, y, breite, klein);

		/*
		 * **Nur ein Satz zur Vorlage am Einlass** (Code-Review 07.09.2026).
		 * `vertretungssatz` endet bereits mit «Die Vollmacht ist beim Einlass
		 * vorzuweisen»; ein zweiter Satz darunter, der dasselbe sagt, drängte
		 * die Vollmachtsgrenze — die einzige Angabe, die der Empfänger wirklich
		 * braucht — optisch in die Wiederholung.
		 */
		y -= mm(2);
		y = zeichneText(
			seite,
			'Bringen Sie dieses Blatt unterschrieben mit.',
			rand,
			y,
			breite,
			klein
		);

		// ── Ort, Datum, Unterschrift ─────────────────────────────────────────
		y -= mm(20);
		const halb = (breite - mm(10)) / 2;
		linie('Ort und Datum', rand, halb);
		// Derselbe Helfer, damit Strichstärke, Farbe und Abstand an einer Stelle
		// stehen — sonst sähen die beiden Linien nach der ersten Änderung
		// verschieden aus (Code-Review 07.09.2026).
		linie('Unterschrift der vollmachtgebenden Person', rand + halb + mm(10), halb);
	}

	return blatt.dokument.save();
}
