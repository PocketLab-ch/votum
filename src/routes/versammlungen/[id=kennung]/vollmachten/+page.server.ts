import { error, fail } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { herkunft } from '$lib/server/herkunft';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { begrenzeNachweise, DateiFehler } from '$lib/server/dateien';
import {
	ZUSTANDSNAMEN,
	nachweisInWorten,
	uebersicht,
	ueberschreitungen,
	type Vertretungsgrund
} from '$lib/domain/vollmacht';
import { empfehlungInWorten } from '$lib/domain/empfehlung';
import { standVon } from '$lib/domain/anwesenheit';
import { text } from '$lib/server/formular';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeLesarten } from '$lib/server/lesarten';
import { holeVersammlung } from '$lib/server/versammlungen';
import { bestaetigeAnwesenheit, holeAnwesenheitsereignisse } from '$lib/server/anwesenheit';
import { verkuendeStand } from '$lib/server/versammlungsstand';
import {
	bestaetigeVollmacht,
	erfasseVollmachten,
	haengeNachweisAn,
	holeNachweise,
	holeParteien,
	holeVollmachten,
	kennzeichneVerwaltung,
	vermerkeVorlage,
	weiseVollmachtZurueck,
	widerrufeVollmacht
} from '$lib/server/vollmacht';
import { holeEmpfehlungen } from '$lib/server/selbstvollmacht';
import { holeTraktanden } from '$lib/server/traktanden';
import type { Actions, PageServerLoad } from './$types';

/**
 * Vertretung und Vollmacht (FR-23 bis FR-25).
 *
 * **Erst prüfen, dann aktivieren.** Eine erfasste Vollmacht überträgt nichts;
 * erst die Bestätigung durch die Sitzungsleitung macht sie wirksam. Deshalb
 * steht auf dieser Seite die Prüfung im Mittelpunkt und nicht das Erfassen.
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const operatorId = locals.benutzer.operatorId;

	const versammlung = await holeVersammlung(operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	// Ohne Momentaufnahme gibt es niemanden zu vertreten. Die Seite sagt das und
	// zeigt kein Formular, das ins Leere liefe.
	const [gemeinschaft, parteien, vollmachten, nachweise, ereignisse, lesarten] = await Promise.all([
		holeGemeinschaft(operatorId, versammlung.stwegId),
		holeParteien(operatorId, params.id),
		holeVollmachten(operatorId, params.id),
		holeNachweise(operatorId, params.id),
		holeAnwesenheitsereignisse(operatorId, params.id),
		// L15 (Migration 194): ab der Freigabe aus der Momentaufnahme, wie die Sperre.
		holeLesarten(operatorId, { meetingId: params.id })
	]);

	/*
	 * **Die Weisungen zu jeder Vollmacht.** Sie stehen der Sitzungsleitung vor
	 * Augen, weil sie Teil dessen sind, was erklärt wurde — und weil eine
	 * Vollmacht mit Weisung anders zu prüfen ist als eine ohne.
	 */
	const weisungen = new Map(
		await Promise.all(
			vollmachten.map(
				async (v) => [v.id, await holeEmpfehlungen(operatorId, v.id)] as const
			)
		)
	);
	const traktandenNamen = new Map(
		weisungen.size > 0
			? (await holeTraktanden(operatorId, params.id)).map(
					(t) => [t.knoten.id, `${t.nummer} ${t.knoten.titel}`] as const
				)
			: []
	);

	const stand = new Map(
		parteien.map((p) => [
			p.parteiId,
			standVon(ereignisse.filter((e) => e.parteiId === p.parteiId))?.zustand ?? 'nicht_erschienen'
		])
	);

	const u = uebersicht(vollmachten);
	const namen = new Map(parteien.map((p) => [p.id, p.name]));

	/*
	 * **Wer nicht wählbar ist, steht trotzdem da — mit Grund** (Hinweis des Auftraggebers
	 * vom 04.08.2026). Zwei Lagen, in denen eine Vollmacht nichts bewirken kann:
	 *
	 *   · Die Partei ist **anwesend** — sie übt selbst aus, und eine Vollmacht
	 *     über sie endete im selben Augenblick wieder (FR-25).
	 *   · Für sie besteht **schon eine** offene oder wirksame Vollmacht.
	 *
	 * Und in der Gegenrichtung: Wer selbst vertreten wird, ist nicht da und kann
	 * für niemanden die Hand heben.
	 */
	const offeneJeVertretene = new Map(
		vollmachten
			.filter((v) => v.zustand === 'erfasst' || v.zustand === 'bestaetigt')
			.map((v) => [v.vertreteneId, v.bevollmaechtigtName ?? ''])
	);

	/*
	 * **Nachweise mit dem Telefon fotografieren** (Auftraggeber, 24.08.2026): «Kann man,
	 * wenn man Dokumente hochladen möchte, einen QR-Code bereitstellen, auf dem
	 * der Leiter dann — natürlich angemeldet — das Dokument fotografieren und
	 * zur Person, die sich vertreten lässt, hochladen kann?»
	 *
	 * Der Code führt auf die schmale Nachweisseite. **Er trägt keinen Zugang**,
	 * nur die Adresse: Wer ihn scannt, muss sich anmelden wie überall sonst —
	 * deshalb darf er auf einem Bildschirm stehen, den andere sehen. Dieselbe
	 * Doktrin wie beim Einlass auf dem Telefon.
	 */
	const nachweisweg = `${herkunft(url)}/versammlungen/${params.id}/vollmachten/nachweise`;
	const nachweisqr = await QRCode.toString(nachweisweg, {
		type: 'svg',
		errorCorrectionLevel: 'M',
		margin: 1
	});

	return {
		telefonweg: { url: nachweisweg, svg: nachweisqr },
		versammlung,
		gemeinschaft,
		parteien: parteien.map((p) => {
			const anwesend = stand.get(p.parteiId) === 'anwesend';
			const schon = offeneJeVertretene.get(p.id);
			return {
				...p,
				anwesend,
				vertretenDurch: u.wirksamJeVertretene.get(p.id)?.bevollmaechtigtName ?? null,
				vertritt: (u.wirksamJeBevollmaechtigt.get(p.id) ?? []).map((v) => v.vertreteneName),
				/** Warum diese Partei keine Vollmacht **erhalten** kann. */
				gesperrt: anwesend
					? 'bereits anwesend — übt selbst aus'
					: schon
						? `bereits bevollmächtigt an ${schon}`
						: null,
				/** Warum diese Partei keine Vollmacht **ausüben** kann. */
				kannNichtAusueben: schon !== undefined ? `wird selbst vertreten durch ${schon}` : null
			};
		}),
		vollmachten: vollmachten.map((v) => ({
			...v,
			zustandName: ZUSTANDSNAMEN[v.zustand],
			nachweise: nachweise.get(v.id) ?? [],
			nachweissatz: nachweisInWorten(v.herkunft, v.nachweisVorgelegt, v.anzahlDateien),
			// Die Weisungen gehören der Sitzungsleitung vor Augen: Sie prüft die
			// Vollmacht, und eine Weisung ist Teil dessen, was erklärt wurde.
			weisungen: (weisungen.get(v.id) ?? []).map((w) => ({
				...w,
				titel: traktandenNamen.get(w.traktandumId) ?? 'Traktandum',
				wahlName: empfehlungInWorten(w.wahl)
			})),
			// Ob die bevollmächtigte Person im Saal ist — daran hängt, ob die Parteien,
			// für die sie eine Vollmacht hält, als anwesend geführt werden.
			bevollmaechtigtAnwesend: v.bevollmaechtigtId
				? stand.get(parteien.find((p) => p.id === v.bevollmaechtigtId)?.parteiId ?? '') === 'anwesend'
				: null
		})),
		anzahlOffen: u.anzahlOffen,
		anzahlWirksam: u.anzahlWirksam,
		schranke: {
			hoechstzahl: gemeinschaft?.proxyLimit ?? null,
			fundstelle: gemeinschaft?.proxyLimitRuleSource ?? null,
			stimmfuehrung: lesarten.L15
		},
		warnungen: ueberschreitungen(
			vollmachten,
			{
				hoechstzahl: gemeinschaft?.proxyLimit ?? null,
				fundstelle: gemeinschaft?.proxyLimitRuleSource ?? null,
				stimmfuehrung: lesarten.L15
			},
			namen
		),
		stimmberechtigte: parteien.length
	};
};

function handelnder(locals: App.Locals) {
	return {
		operatorId: locals.benutzer!.operatorId,
		userId: locals.benutzer!.id,
		label: locals.benutzer!.displayName
	};
}

function fachlich(fehler: unknown) {
	if (fehler instanceof FachlicherFehler || fehler instanceof DateiFehler) {
		return fail(400, {
			fehler: {
				nachricht: fehler.message,
				feld: fehler instanceof FachlicherFehler ? fehler.feld : undefined
			}
		});
	}
	throw fehler;
}

export const actions: Actions = {
	erfassen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const erfasst = await erfasseVollmachten(handelnder(locals), params.id, {
				bevollmaechtigtId: text(daten.get('bevollmaechtigt')) || null,
				bevollmaechtigtName: text(daten.get('bevollmaechtigtName')) || null,
				vertritt: daten
					.getAll('vertritt')
					.map((w) => String(w))
					.filter(Boolean),
				// Ungeprüft weitergereicht: `pruefeEingabe` im Kern kennt die drei
				// zulässigen Werte und weist alles andere mit einem Satz ab. Hier zu
				// prüfen hiesse, dieselbe Liste zweimal zu führen.
				vertretungsgrund:
					(text(daten.get('vertretungsgrund')) as Vertretungsgrund) || null,
				bemerkung: text(daten.get('bemerkung')) || null,
				// L8 (Migration 184): Das Häkchen «Bevollmächtigt ist die
				// Verwaltung». Der Kern verwirft es bei einer Partei dieser
				// Versammlung, wie die Datenbank (`proxy_verwaltung_nur_dritte`).
				istVerwaltung: daten.get('istVerwaltung') === 'ja'
			});
			const wer = erfasst[0].bevollmaechtigtName;
			const fuer = erfasst.map((v) => v.vertreteneName).join(', ');
			return {
				hinweis:
					`${erfasst.length === 1 ? 'Vollmacht' : `${erfasst.length} Vollmachten`} erfasst: ` +
					`${wer} für ${fuer}. Sie überträgt noch nichts — erst die Bestätigung macht sie wirksam.`
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	vorlegen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const v = await vermerkeVorlage(handelnder(locals), params.id, text(daten.get('id')));
			// Beim Nachweis der Mitberechtigung lag keine Vollmacht vor, sondern etwa
			// eine Erbbescheinigung (Laienprüfung 03.11.2026, Randbefund C10-1).
			return {
				hinweis:
					v.mitberechtigung === 'nicht_eingetragen'
						? 'Vermerkt: Der Nachweis der Mitberechtigung hat vorgelegen.'
						: 'Vermerkt: Das Original hat vorgelegen.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	bestaetigen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const v = await bestaetigeVollmacht(handelnder(locals), params.id, text(daten.get('id')));

			/*
			 * Steht die bevollmächtigte Person schon im Saal, ziehen die Parteien, für
			 * die sie die Vollmacht hält, sofort nach.
			 *
			 * Das ist der häufige Fall: Jemand ist längst eingelassen und legt die
			 * Vollmacht erst am Tisch vor. Ohne diesen Schritt bliebe die vertretene
			 * Partei abwesend, bis jemand sie ein zweites Mal einliesse —
			 * und daran denkt im Saal niemand.
			 *
			 * Über denselben Weg wie jedes Eintreffen: `bestaetigeAnwesenheit` legt
			 * kein zweites Ereignis an, wenn die Person schon da ist, und zieht die
			 * Vertretenen nach. Ein eigener Weg hierher wäre ein zweiter Ort, an dem
			 * Anwesenheit entsteht.
			 */
			let nachgezogen: string[] = [];
			if (v.bevollmaechtigtId) {
				try {
					const e = await bestaetigeAnwesenheit(
						handelnder(locals),
						params.id,
						v.bevollmaechtigtId,
						'von_hand'
					);
					nachgezogen = e.mitgebracht ?? [];
					if (nachgezogen.length > 0) await verkuendeStand(locals.benutzer.operatorId, params.id);
				} catch {
					// Die Versammlung läuft noch nicht — dann gibt es nichts nachzuziehen,
					// und die Vollmacht gilt trotzdem.
				}
			}

			return {
				hinweis:
					`${v.bevollmaechtigtName} vertritt ${v.vertreteneName}.` +
					(nachgezogen.length > 0
						? ` ${nachgezogen.join(', ')} gilt damit als anwesend — die bevollmächtigte Person ist im Saal.`
						: ' Trifft die bevollmächtigte Person ein, wird die Partei als anwesend geführt.')
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Das Häkchen «Bevollmächtigt ist die Verwaltung» an einer bestehenden
	 * Vollmacht (L8, Migration 184; H-1, 07.11.2026): setzen und entfernen.
	 * Der Knopf trägt die Richtung (`istVerwaltung` ja oder nein), und die
	 * Meldung folgt dem Stand nach der Änderung, nicht dem Knopf.
	 */
	verwaltung: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const v = await kennzeichneVerwaltung(
				handelnder(locals),
				params.id,
				text(daten.get('id')),
				daten.get('istVerwaltung') === 'ja'
			);
			return {
				hinweis: v.istVerwaltung
					? 'Gekennzeichnet: Bevollmächtigt ist die Verwaltung.'
					: 'Kennzeichnung entfernt.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	zurueckweisen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await weiseVollmachtZurueck(
				handelnder(locals),
				params.id,
				text(daten.get('id')),
				text(daten.get('grund'))
			);
			return { hinweis: 'Zurückgewiesen. Die Begründung steht im Verlauf.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	widerrufen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await widerrufeVollmacht(
				handelnder(locals),
				params.id,
				text(daten.get('id')),
				text(daten.get('grund'))
			);
			return {
				hinweis:
					'Die Vertretung ist beendet. Bereits abgegebene Stimmen in geschlossenen ' +
					'Abstimmungen bleiben gültig.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Nachweise nachreichen — **mehrere Seiten in einem Zug** (Auftraggeber, 24.08.2026:
	 * «Bitte berücksichtigen, eine Vollmacht kann auch mehrere Seiten
	 * enthalten»). Vollmacht und Weisung, Vorder- und Rückseite: Je Seite ein
	 * Gang durch das Formular kostet im Saal die Zeit, die man nicht hat.
	 */
	nachreichen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const dateien = daten
			.getAll('datei')
			.filter((d): d is File => d instanceof File && d.size > 0);
		if (dateien.length === 0) {
			return fail(400, { fehler: { nachricht: 'Es wurde keine Datei gewählt.' } });
		}
		try {
			const namen: string[] = [];
			for (const datei of begrenzeNachweise(dateien)) {
				const n = await haengeNachweisAn(
					handelnder(locals),
					params.id,
					text(daten.get('id')),
					datei
				);
				namen.push(n.name);
			}
			return {
				hinweis:
					namen.length === 1
						? `Nachweis hinterlegt: ${namen[0]}.`
						: `${namen.length} Seiten hinterlegt: ${namen.join(', ')}.`
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	}
};
