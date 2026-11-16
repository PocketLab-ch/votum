/**
 * Äussere Dienste in der Anwendung einrichten und prüfen (14.08.2026).
 *
 * **Der Anlass.** KI-Kette und Zeitstempeldienst standen nur in
 * Umgebungsvariablen. Ein Modellwechsel verlangte Zugriff auf den Server und
 * einen Neustart des Containers — und der trifft alle. Schwerer wog, dass der
 * Zustand nirgends zu sehen war: Ein abgelaufener Zugangsschlüssel fiel
 * niemandem auf, bis im Saal jemand auf «Vorschlag holen» drückte.
 *
 * **Die Umgebung bleibt der Rückfall.** Steht in der Anwendung nichts, gilt sie
 * unverändert; steht dort etwas, hat es Vorrang. Beides zu mischen ergäbe eine
 * Kette, deren Reihenfolge niemand angeordnet hat.
 *
 * **Der Schlüssel geht nie hinaus.** Weder in die Anzeige noch in ein
 * Formularfeld, auch nicht als Punktereihe mit echtem Wert dahinter — ein
 * `<input value="sk-…">` steht im ausgelieferten HTML. Was zurückkommt, ist
 * eine Andeutung.
 */
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	pruefeStufe,
	pruefeZeitstempeleingabe,
	type Feldfehler,
	type Stufeneingabe,
	type Zeitstempeleingabe,
	type Zeitstempelprobe
} from '$lib/domain/dienste';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import {
	anwendungsstufen,
	pruefeStufenanruf,
	stufen,
	umgebungsstufen,
	type Kistufe
} from './ki';
import {
	beurteileZeitstempel,
	dienst,
	ersatzdienst,
	probeDienst,
	umgebungsdienst
} from './zeitstempel';
import { schluesselAndeutung, tresorBereit, verschluessele, TresorFehler } from './tresor';
import { randomBytes } from 'node:crypto';
import type { Id } from '$lib/domain/types';

function ersterFehler(fehler: Feldfehler[]): void {
	if (fehler.length > 0) throw new FachlicherFehler('eingabe', fehler[0].nachricht, fehler[0].feld);
}

// ── Was die Seite anzeigt ───────────────────────────────────────────────────

/** Eine Stufe, wie sie angezeigt werden darf — ohne Schlüssel. */
export interface Stufenanzeige {
	id: Id | null;
	nummer: number;
	name: string;
	url: string;
	modell: string;
	geduldMs: number;
	/** Ob ein Schlüssel hinterlegt ist, und gerade so viel davon, dass man zwei unterscheidet. */
	schluessel: string | null;
	quelle: 'anwendung' | 'umgebung';
}

export interface Dienstelage {
	kette: Stufenanzeige[];
	/** Woher die geltende Kette stammt — die Anzeige sagt es, sonst sucht jemand am falschen Ort. */
	kiQuelle: 'anwendung' | 'umgebung' | 'keine';
	/** Ob daneben noch eine Umgebungskette wartet, die gerade nicht gilt. */
	umgebungswartet: number;
	zeitstempel: {
		url: string;
		name: string;
		fingerabdruecke: string[];
		quelle: 'anwendung' | 'umgebung';
	} | null;
	/**
	 * Der Ersatzdienst (13.11.2026). `null`, wenn keiner eingetragen ist.
	 *
	 * Er wird auch dann geliefert, wenn kein Hauptdienst eingetragen ist: Die
	 * Maske soll zeigen, dass er dasteht, und sagen, dass er so nicht
	 * einspringt.
	 */
	ersatz: {
		url: string;
		name: string;
		fingerabdruecke: string[];
	} | null;
	/** Ob überhaupt Schlüssel abgelegt werden können. Die Seite sagt es **vor** dem Ausfüllen. */
	tresorBereit: boolean;
}

export async function holeDienstelage(operatorId: Id): Promise<Dienstelage> {
	const [eigene, geltend, ts, ersatz] = await Promise.all([
		anwendungsstufen(operatorId),
		stufen(operatorId),
		dienst(operatorId),
		ersatzdienst(operatorId)
	]);
	const ausUmgebung = umgebungsstufen();

	return {
		kette: geltend.map(alsAnzeige),
		kiQuelle: geltend.length === 0 ? 'keine' : geltend[0].quelle,
		umgebungswartet: eigene.length > 0 ? ausUmgebung.length : 0,
		zeitstempel: ts
			? { url: ts.url, name: ts.name, fingerabdruecke: ts.fingerabdruecke, quelle: ts.quelle }
			: null,
		ersatz: ersatz
			? { url: ersatz.url, name: ersatz.name, fingerabdruecke: ersatz.fingerabdruecke }
			: null,
		tresorBereit: tresorBereit()
	};
}

function alsAnzeige(s: Kistufe): Stufenanzeige {
	return {
		id: s.id ?? null,
		nummer: s.nummer,
		name: s.name,
		url: s.url,
		modell: s.modell,
		geduldMs: s.geduldMs,
		schluessel: s.schluessel === null ? null : schluesselAndeutung(s.schluessel),
		quelle: s.quelle
	};
}

// ── Die KI-Kette führen ─────────────────────────────────────────────────────

export interface Stufenfelder extends Stufeneingabe {
	/** Leer heisst: unverändert lassen. Zum Entfernen dient `schluesselEntfernen`. */
	schluessel: string;
	schluesselEntfernen?: boolean;
}

export async function legeKistufeAn(
	handelnder: Handelnder & { operatorId: Id },
	felder: Stufenfelder
): Promise<{ nummer: number }> {
	const { fehler } = pruefeStufe(felder);
	ersterFehler(fehler);

	const abgelegt = felder.schluessel.trim() === '' ? null : verschluesselePruefend(felder.schluessel);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// Ans Ende der Kette. Wer sie umordnen will, ändert die Nummern — eine
		// neue Stufe soll nie stillschweigend die erste werden und damit das
		// Modell wechseln, das im Saal antwortet.
		const [letzte] = await tx<{ hoechste: number | null }[]>`
			SELECT max(position) AS hoechste FROM ai_stage WHERE operator_id = ${handelnder.operatorId}
		`;
		const position = (letzte?.hoechste ?? 0) + 1;
		if (position > 9) {
			throw new FachlicherFehler(
				'zu_viele_stufen',
				'Mehr als neun Stufen sind nicht vorgesehen. Entfernen Sie eine, bevor Sie eine neue anlegen.'
			);
		}

		await tx`
			INSERT INTO ai_stage (operator_id, position, name, url, model, api_key_enc, patience_ms)
			VALUES (${handelnder.operatorId}, ${position}, ${felder.name.trim()}, ${felder.url.trim()},
			        ${felder.modell.trim()}, ${abgelegt}, ${felder.geduldMs})
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.kistufeAngelegt, { art: 'operator', id: handelnder.operatorId }, {
				stufe: position,
				name: felder.name.trim(),
				url: felder.url.trim(),
				modell: felder.modell.trim(),
				mitSchluessel: abgelegt !== null
			})
		);

		return { nummer: position };
	});
}

export async function aendereKistufe(
	handelnder: Handelnder & { operatorId: Id },
	stufenId: Id,
	felder: Stufenfelder
): Promise<void> {
	const { fehler } = pruefeStufe(felder);
	ersterFehler(fehler);

	const neuerSchluessel = felder.schluessel.trim();
	const abgelegt = neuerSchluessel === '' ? null : verschluesselePruefend(neuerSchluessel);

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [vorher] = await tx<{ position: number; name: string }[]>`
			SELECT position, name FROM ai_stage WHERE id = ${stufenId}
		`;
		if (!vorher) throw new FachlicherFehler('stufe_weg', 'Diese Stufe gibt es nicht mehr.');

		// Drei Fälle, und sie sind verschieden: neuer Schlüssel, Schlüssel weg,
		// Schlüssel unangetastet. Ein leeres Feld darf nie das Dritte mit dem
		// Zweiten verwechseln — sonst verliert ein Namenswechsel den Zugang.
		const schluesselTeil = felder.schluesselEntfernen
			? tx`api_key_enc = NULL,`
			: abgelegt !== null
				? tx`api_key_enc = ${abgelegt},`
				: tx``;

		await tx`
			UPDATE ai_stage SET
				name = ${felder.name.trim()},
				url = ${felder.url.trim()},
				model = ${felder.modell.trim()},
				patience_ms = ${felder.geduldMs},
				${schluesselTeil}
				updated_at = now()
			WHERE id = ${stufenId}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.kistufeGeaendert, { art: 'operator', id: handelnder.operatorId }, {
				stufe: vorher.position,
				name: felder.name.trim(),
				url: felder.url.trim(),
				modell: felder.modell.trim(),
				schluessel: felder.schluesselEntfernen
					? 'entfernt'
					: abgelegt !== null
						? 'ersetzt'
						: 'unverändert'
			})
		);
	});
}

/**
 * Verschiebt eine Stufe in der Kette um einen Platz (17.08.2026).
 *
 * **Warum das eine eigene Handlung ist.** Die Reihenfolge liess sich bis dahin
 * nur beim Anlegen bestimmen — eine neue Stufe kommt ans Ende, und das
 * Änderungsformular fasst die Nummer nicht an. Wer Stufe 2 nach vorn holen
 * wollte, musste beide entfernen und neu anlegen; dabei geht der
 * Zugangsschlüssel verloren, denn angezeigt wird er nie wieder. Und die
 * Reihenfolge ist keine Kleinigkeit: Stufe 1 ist das Modell, das im Saal
 * tatsächlich antwortet.
 *
 * **Getauscht wird mit dem Nachbarn**, nicht auf eine frei eingetippte Nummer
 * gesetzt. Bei höchstens neun Stufen ist der Nachbartausch der Weg, den man
 * ohne Nachdenken richtig geht, und er kann keine Lücke und keine Doppelung
 * erzeugen.
 *
 * Die Eindeutigkeit wird für die Transaktion **aufgeschoben** (Migration 065):
 * Der Zwischenstand, in dem beide Zeilen dieselbe Nummer tragen, ist
 * unvermeidlich. Der sonst übliche Kniff über einen Hilfswert scheitert hier
 * ohnehin — `position` reicht nur von 1 bis 9, bei neun Stufen ist keine Nummer
 * frei.
 */
export async function verschiebeKistufe(
	handelnder: Handelnder & { operatorId: Id },
	stufenId: Id,
	richtung: 'vor' | 'zurueck'
): Promise<{ name: string; nummer: number }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const zeilen = await tx<{ id: string; position: number; name: string }[]>`
			SELECT id, position, name FROM ai_stage
			WHERE operator_id = ${handelnder.operatorId}
			ORDER BY position
		`;

		const hier = zeilen.findIndex((z) => z.id === stufenId);
		if (hier < 0) throw new FachlicherFehler('stufe_weg', 'Diese Stufe gibt es nicht mehr.');

		const dorthin = richtung === 'vor' ? hier - 1 : hier + 1;
		if (dorthin < 0 || dorthin >= zeilen.length) {
			// Kein Absturz und keine stille Wirkungslosigkeit: Wer zweimal schnell
			// klickt, während die Seite noch lädt, landet hier.
			throw new FachlicherFehler(
				'am_rand',
				richtung === 'vor'
					? 'Diese Stufe steht bereits zuoberst — sie wird als erste gefragt.'
					: 'Diese Stufe steht bereits zuunterst.'
			);
		}

		const eine = zeilen[hier];
		const andere = zeilen[dorthin];

		await tx`SET CONSTRAINTS ai_stage_position_je_betreiber DEFERRED`;
		await tx`UPDATE ai_stage SET position = ${andere.position}, updated_at = now() WHERE id = ${eine.id}`;
		await tx`UPDATE ai_stage SET position = ${eine.position}, updated_at = now() WHERE id = ${andere.id}`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.kistufeUmgestellt, { art: 'operator', id: handelnder.operatorId }, {
				name: eine.name,
				von: hier + 1,
				nach: dorthin + 1,
				getauschtMit: andere.name
			})
		);

		return { name: eine.name, nummer: dorthin + 1 };
	});
}

export async function entferneKistufe(
	handelnder: Handelnder & { operatorId: Id },
	stufenId: Id
): Promise<{ name: string }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [zeile] = await tx<{ position: number; name: string }[]>`
			DELETE FROM ai_stage WHERE id = ${stufenId} RETURNING position, name
		`;
		if (!zeile) throw new FachlicherFehler('stufe_weg', 'Diese Stufe gibt es nicht mehr.');

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.kistufeEntfernt, { art: 'operator', id: handelnder.operatorId }, {
				stufe: zeile.position,
				name: zeile.name
			})
		);
		return { name: zeile.name };
	});
}

/**
 * Ruft eine Stufe an — die, auf deren Knopf gedrückt wurde.
 *
 * **Ohne Verlaufseintrag.** Eine Prüfung ändert nichts; sie im Nachweis zu
 * führen, hiesse ihn mit dem zu füllen, was jemand ausprobiert hat.
 */
export async function pruefeKiVerbindung(
	operatorId: Id,
	stufenId: Id | null,
	nummer: number
): Promise<{ ok: boolean; bemerkung: string }> {
	const kette = await stufen(operatorId);
	const stufe = stufenId ? kette.find((s) => s.id === stufenId) : kette.find((s) => s.nummer === nummer);
	if (!stufe) throw new FachlicherFehler('stufe_weg', 'Diese Stufe gibt es nicht mehr.');

	if (stufe.schluessel === null && stufe.quelle === 'anwendung') {
		// Kein Fehler — ein Modell im eigenen Haus braucht keinen. Aber wenn der
		// Anruf gleich an einer 401 scheitert, soll der Grund schon dastehen.
		const anruf = await pruefeStufenanruf(stufe);
		return {
			ok: anruf.ok,
			bemerkung: anruf.ok
				? anruf.bemerkung
				: `${anruf.bemerkung} (An dieser Stufe ist kein Zugangsschlüssel hinterlegt.)`
		};
	}

	return pruefeStufenanruf(stufe);
}

function verschluesselePruefend(klartext: string): string {
	try {
		return verschluessele(klartext);
	} catch (fehler) {
		if (fehler instanceof TresorFehler) throw new FachlicherFehler('kein_geheimnis', fehler.message, 'schluessel');
		throw fehler;
	}
}

// ── Der Zeitstempeldienst ───────────────────────────────────────────────────

export async function setzeZeitstempeldienst(
	handelnder: Handelnder & { operatorId: Id },
	eingabe: Zeitstempeleingabe
): Promise<{ hinweise: string[] }> {
	const { fehler, hinweise, fingerabdruecke } = pruefeZeitstempeleingabe(eingabe);
	ersterFehler(fehler);

	const url = eingabe.url.trim();
	const name = eingabe.name.trim() || URL.parse(url)?.host || url;

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`
			UPDATE operator SET
				tsa_url = ${url},
				tsa_name = ${name},
				tsa_fingerprints = ${fingerabdruecke.join(',') || null}
			WHERE id = ${handelnder.operatorId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.zeitstempeldienstGesetzt, { art: 'operator', id: handelnder.operatorId }, {
				url,
				name,
				angeheftet: fingerabdruecke.length
			})
		);
	});

	return { hinweise };
}

export async function entferneZeitstempeldienst(
	handelnder: Handelnder & { operatorId: Id }
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Nur der Hauptdienst.** Der Ersatz bleibt stehen und wird wieder
		 * wirksam, sobald ein Hauptdienst eingetragen ist (13.11.2026). Ihn
		 * mitzulöschen hiesse, eine Einstellung zu verlieren, die niemand
		 * gelöscht hat. Beim nächsten Eintragen des Hauptdienstes fiele die
		 * Ausweichung sonst still weg.
		 */
		await tx`
			UPDATE operator SET tsa_url = NULL, tsa_name = NULL, tsa_fingerprints = NULL
			WHERE id = ${handelnder.operatorId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.zeitstempeldienstEntfernt, {
				art: 'operator',
				id: handelnder.operatorId
			})
		);
	});
}

/**
 * Trägt den Ersatzdienst ein (13.11.2026).
 *
 * **Dieselbe Eingabeprüfung wie der Hauptdienst**, und dieselbe Normalisierung
 * der Abdrücke. Der Unterschied liegt allein darin, wann er gefragt wird.
 */
export async function setzeErsatzdienst(
	handelnder: Handelnder & { operatorId: Id },
	eingabe: Zeitstempeleingabe
): Promise<{ hinweise: string[] }> {
	const { fehler, hinweise, fingerabdruecke } = pruefeZeitstempeleingabe(eingabe);
	ersterFehler(fehler);

	const url = eingabe.url.trim();
	const name = eingabe.name.trim() || URL.parse(url)?.host || url;

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`
			UPDATE operator SET
				tsa_fallback_url = ${url},
				tsa_fallback_name = ${name},
				tsa_fallback_fingerprints = ${fingerabdruecke.join(',') || null}
			WHERE id = ${handelnder.operatorId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.zeitstempeldienstErsatzGesetzt,
				{ art: 'operator', id: handelnder.operatorId },
				{ url, name, angeheftet: fingerabdruecke.length }
			)
		);
	});

	return { hinweise };
}

export async function entferneErsatzdienst(
	handelnder: Handelnder & { operatorId: Id }
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`
			UPDATE operator SET
				tsa_fallback_url = NULL,
				tsa_fallback_name = NULL,
				tsa_fallback_fingerprints = NULL
			WHERE id = ${handelnder.operatorId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.zeitstempeldienstErsatzEntfernt, {
				art: 'operator',
				id: handelnder.operatorId
			})
		);
	});
}

/**
 * Holt einen Prüfzeitstempel und sagt, wer ihn unterschrieben hat.
 *
 * **Das ist der eigentliche Zweck der Seite.** Den Fingerabdruck von Hand zu
 * beschaffen — Antwort besorgen, drei `openssl`-Aufrufe durch eine Pipe —
 * macht in der Praxis niemand, und ohne ihn nimmt die Anwendung jede Antwort
 * an, die unter der eingestellten Adresse ausgeliefert wird. Hier kommt er aus
 * einem echten Anlauf und lässt sich mit einem Klick anheften.
 *
 * Gestempelt wird auf einen **Zufallswert**, nicht auf ein Siegel: Die Probe
 * soll nichts bezeugen, was später als Beleg gelesen werden könnte.
 *
 * **Je Dienst eine eigene Probe** (13.11.2026). Gefragt wird genau der Dienst,
 * dessen Kasten den Knopf trägt, und geprüft wird gegen dessen eigene Liste.
 * Über `bezeuge` liefe die Probe des Ersatzes beim Hauptdienst und umgekehrt;
 * angeheftet würde dann der Abdruck des anderen Hauses.
 */
export async function holePruefzeitstempel(
	operatorId: Id,
	art: 'haupt' | 'ersatz' = 'haupt'
): Promise<Zeitstempelprobe> {
	const d = art === 'ersatz' ? await ersatzdienst(operatorId) : await dienst(operatorId);
	if (!d) {
		throw new FachlicherFehler(
			art === 'ersatz' ? 'kein_ersatzdienst' : 'kein_zeitstempeldienst',
			art === 'ersatz'
				? 'Es ist kein Ersatzdienst eingerichtet. Tragen Sie zuerst eine Adresse ein.'
				: 'Es ist kein Zeitstempeldienst eingerichtet. Tragen Sie zuerst eine Adresse ein.'
		);
	}

	const probe = randomBytes(32).toString('hex');
	const ergebnis = await probeDienst(d, probe);

	if (!ergebnis.roh) {
		/*
		 * **Der eine Fehlschlag, der einen Weg anbietet** (13.11.2026). Scheitert
		 * die Probe allein an der Anheftung, ist der Stempel selbst geprüft;
		 * dann zeigt die Maske den neuen Abdruck und lässt ihn anheften. Der
		 * Anlass ist die DigiCert-Falle: Das Zertifikat wechselt, die Anheftung
		 * bleibt auf dem alten, und ohne diesen Zweig stünde nur «nicht
		 * hinterlegt» da, ohne Knopf.
		 */
		const u = ergebnis.unangehefteterAussteller;
		return {
			art,
			// Der Dienst hat gestempelt; nur der Aussteller ist nicht angeheftet.
			ok: u ? true : false,
			bemerkung: ergebnis.bemerkung,
			fingerabdruck: u?.fingerabdruck ?? null,
			angeheftet: u ? false : null,
			zeitpunkt: u?.zeitpunkt ?? null,
			nurAnheftungFehlt: u ? true : false,
			aussteller: u?.name ?? null,
			ausstellerGueltigVon: u?.gueltigVon ?? null,
			ausstellerGueltigBis: u?.gueltigBis ?? null
		};
	}

	const b = beurteileZeitstempel(ergebnis.roh, probe, d.fingerabdruecke);
	return {
		art,
		ok: b.gueltig,
		bemerkung: b.satz || ergebnis.bemerkung,
		fingerabdruck: b.fingerabdruck,
		angeheftet: b.angeheftet,
		zeitpunkt: b.zeitpunkt,
		nurAnheftungFehlt: false,
		aussteller: b.stelle,
		ausstellerGueltigVon: null,
		ausstellerGueltigBis: null
	};
}

/** Den Abdruck aus der Probe anheften — der Weg, der ihn überhaupt benutzbar macht. */
export async function hefteAn(
	handelnder: Handelnder & { operatorId: Id },
	fingerabdruck: string,
	art: 'haupt' | 'ersatz' = 'haupt'
): Promise<void> {
	const d =
		art === 'ersatz'
			? await ersatzdienst(handelnder.operatorId)
			: await dienst(handelnder.operatorId);
	if (!d) {
		throw new FachlicherFehler(
			art === 'ersatz' ? 'kein_ersatzdienst' : 'kein_zeitstempeldienst',
			art === 'ersatz'
				? 'Es ist kein Ersatzdienst eingerichtet.'
				: 'Es ist kein Zeitstempeldienst eingerichtet.'
		);
	}
	if (art === 'haupt' && d.quelle === 'umgebung') {
		throw new FachlicherFehler(
			'dienst_aus_umgebung',
			'Dieser Dienst steht in der Umgebung. Übernehmen Sie ihn zuerst in die Anwendung, ' +
				'dann lässt sich das Zertifikat hier anheften.'
		);
	}

	/*
	 * **An die Liste des angefragten Dienstes, nicht an die des anderen.**
	 * Sonst läge der Abdruck des Ersatzes in der Liste des Hauptdienstes: Der
	 * Hauptdienst nähme dann den Ersatzstempel an, und der Ersatz stünde ohne
	 * Anheftung da (13.11.2026).
	 */
	const eintrag = {
		url: d.url,
		name: d.name,
		fingerabdruecke: [...d.fingerabdruecke, fingerabdruck].join(',')
	};
	if (art === 'ersatz') await setzeErsatzdienst(handelnder, eintrag);
	else await setzeZeitstempeldienst(handelnder, eintrag);
}

/**
 * Übernimmt, was in der Umgebung steht, in die Anwendung.
 *
 * Ohne diesen Weg müsste jeder bestehende Betrieb seine Einstellungen abtippen,
 * um sie ändern zu können — mit Zugangsschlüsseln, die er dafür erst wieder
 * hervorsuchen müsste.
 */
export async function uebernimmAusUmgebung(
	handelnder: Handelnder & { operatorId: Id }
): Promise<{ stufen: number; zeitstempel: boolean }> {
	const vorhandene = await anwendungsstufen(handelnder.operatorId);
	if (vorhandene.length > 0) {
		throw new FachlicherFehler(
			'schon_eingerichtet',
			'In der Anwendung sind bereits Stufen eingerichtet. Die Übernahme würde sie verdoppeln.'
		);
	}

	let uebernommen = 0;
	for (const s of umgebungsstufen()) {
		await legeKistufeAn(handelnder, {
			name: s.name,
			url: s.url,
			modell: s.modell,
			geduldMs: s.geduldMs,
			// Ohne Tresor lässt sich der Schlüssel nicht ablegen. Dann kommt die
			// Stufe ohne ihn — sichtbar in der Liste, statt heimlich unvollständig.
			schluessel: s.schluessel && tresorBereit() ? s.schluessel : ''
		});
		uebernommen++;
	}

	const u = umgebungsdienst();
	if (u) {
		await setzeZeitstempeldienst(handelnder, {
			url: u.url,
			name: u.name,
			fingerabdruecke: u.fingerabdruecke.join(',')
		});
	}

	return { stufen: uebernommen, zeitstempel: u !== null };
}
