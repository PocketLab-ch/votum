import { error } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { begrenzeNachweise, DateiFehler } from '$lib/server/dateien';
import { ZUSTANDSNAMEN } from '$lib/domain/vollmacht';
import { text } from '$lib/server/formular';
import { holeVersammlung } from '$lib/server/versammlungen';
import { haengeNachweisAn, holeNachweise, holeVollmachten } from '$lib/server/vollmacht';
import type { Actions, PageServerLoad } from './$types';

/**
 * Die Nachweise am Telefon (Auftraggeber, 24.08.2026).
 *
 * «Kann man, wenn man Dokumente hochladen möchte, einen QR-Code bereitstellen,
 * auf dem der Leiter dann — natürlich angemeldet — das Dokument fotografieren
 * und zur Person, die sich vertreten lässt, hochladen kann?»
 *
 * **Warum eine eigene, schmale Seite.** Am Eingang steht die Sitzungsleitung
 * mit dem Telefon in der Hand; der Nachweis ist ein Blatt Papier auf dem Tisch.
 * Die Vollmachtsseite trägt Prüfung, Bestätigung, Zurückweisung, Widerruf und
 * Erfassung — auf einem Telefon ist das ein halber Meter Scrollen, bevor das
 * Kamerafeld kommt. Hier steht nur: wer vertritt wen, und ein Knopf, der die
 * Kamera öffnet.
 *
 * **Der QR trägt keinen Zugang, nur die Adresse.** Wer ihn scannt, muss sich
 * anmelden wie überall sonst — deshalb darf er auf einem Bildschirm stehen, den
 * andere sehen. Dieselbe Doktrin wie beim Einlass auf dem Telefon (20.08.2026).
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const versammlung = await holeVersammlung(op, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [vollmachten, nachweise] = await Promise.all([
		holeVollmachten(op, params.id),
		holeNachweise(op, params.id)
	]);

	return {
		versammlung: { id: versammlung.id, datum: versammlung.datum, zustand: versammlung.zustand },
		/*
		 * **Erfasste und bestätigte** — beide können einen Nachweis brauchen: Der
		 * Regelfall ist die Prüfung vor der Bestätigung, der Nachtrag danach ist
		 * der Fall «Original lag vor, Kopie kommt später». Zurückgewiesene und
		 * widerrufene stehen nicht da: Dort ist nichts mehr zu belegen.
		 */
		vollmachten: vollmachten
			.filter((v) => v.zustand === 'erfasst' || v.zustand === 'bestaetigt')
			.map((v) => ({
				id: v.id,
				vertreteneName: v.vertreteneName,
				// Der Name kommt aus der Momentaufnahme, wenn die bevollmächtigte
				// Person selbst Partei ist — sonst aus der Vollmacht selbst.
				bevollmaechtigt: v.bevollmaechtigtName ?? 'Dritte Person',
				zustand: v.zustand,
				zustandName: ZUSTANDSNAMEN[v.zustand] ?? v.zustand,
				nachweisVorgelegt: v.nachweisVorgelegt,
				// Welches Blatt vorlag (Codeprüfung 03.11.2026, M2).
				mitberechtigung: v.mitberechtigung,
				dateien: (nachweise.get(v.id) ?? []).map((n) => n.name)
			}))
	};
};

export const actions: Actions = {
	/**
	 * Fotos oder PDF an eine Vollmacht hängen.
	 *
	 * **Mehrere Seiten in einem Zug** (Auftraggeber, 24.08.2026: «Bitte berücksichtigen,
	 * eine Vollmacht kann auch mehrere Seiten enthalten»). Ein Blatt ist der
	 * Regelfall, zwei sind es oft — Vollmacht und Weisung, oder Vorder- und
	 * Rückseite. Je Seite ein Gang durch das Formular hiesse: dreimal die Kamera
	 * öffnen, dreimal warten, und beim dritten Mal die Übersicht verlieren.
	 *
	 * Die Arbeit steht in `haengeNachweisAn`, nicht hier: Zwei Fassungen
	 * desselben Vorgangs liefen auseinander, und der Nachweis ist das, was im
	 * Streit gilt.
	 */
	default: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const dateien = daten
			.getAll('datei')
			.filter((d): d is File => d instanceof File && d.size > 0);
		if (dateien.length === 0) {
			return { fehler: { nachricht: 'Es wurde keine Datei gewählt.' } };
		}
		const handelnder = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};
		try {
			const namen: string[] = [];
			for (const datei of begrenzeNachweise(dateien)) {
				const n = await haengeNachweisAn(handelnder, params.id, text(daten.get('id')), datei);
				namen.push(n.name);
			}
			return {
				hinweis:
					namen.length === 1
						? `Hinterlegt: ${namen[0]}.`
						: `${namen.length} Seiten hinterlegt: ${namen.join(', ')}.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler || fehler instanceof DateiFehler) {
				return { fehler: { nachricht: fehler.message } };
			}
			throw fehler;
		}
	}
};
