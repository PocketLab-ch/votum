/**
 * Der Abstimmungsdurchgang (Stories 5.6 bis 5.10, FR-36 bis FR-41).
 *
 * **Warum der Durchgang die Einheit ist und nicht das Traktandum.** Zu einem
 * Traktandum kann mehrmals abgestimmt werden — nach einem Verfahrensfehler,
 * nach einer Wortmeldung, nach einer Klärung. Jeder Durchgang bleibt stehen und
 * der frühere wird als überholt gekennzeichnet, nie gelöscht (AD-5). Hinge das
 * Ergebnis am Traktandum, müsste eine Neuabstimmung das alte überschreiben, und
 * die Frage «was stand vorher?» wäre nicht mehr zu beantworten — ausgerechnet
 * die Frage, mit der eine Anfechtung beginnt.
 *
 * Reine Zustandsübergänge (AD-10): Jeder gibt zurück, was gilt, und das
 * Ereignis dazu. Kein Schreiben, keine Uhr — der Zeitpunkt kommt herein.
 */
import { zuordnungImVerlauf, type Zuordnung } from './freigabezuordnung';
import { FachlicherFehler } from './gemeinschaft';
import { EREIGNISARTEN, ereignis, type Uebergang } from './verlauf';
import { AUSSCHLUSSKLAGE_KNOTEN, EINSPRACHE_KNOTEN, type Erfordernis } from './entscheidbaum';
import { nurNachWertquoten } from './mehrheit';
import type { Spontanart, Traktandumart } from './traktanden';
import type { Ersetzungsart } from './rueckkommen';
import type { Betriebsart } from './versammlung';
import type { Id, Zeitpunkt } from './types';
import { zeichenzahl } from './zeichenzahl';
import {
	NICHT_ANGEKUENDIGT_BEIM_EROEFFNEN,
	NICHT_ANGEKUENDIGT_GRUNDSATZ,
	UNIVERSAL_SONST,
	universalgruende,
	universalschluss,
	type Ausnahmegrund,
	type Universalbefund,
	type Universalvariante
} from './ausnahmen';

export type Durchgangszustand = 'offen' | 'geschlossen';

export interface Durchgang {
	id: Id;
	meetingId: Id;
	traktandumId: Id;
	/** Zählt je Traktandum ab 1. Steht im Protokoll: «zweiter Durchgang». */
	nummer: number;
	zustand: Durchgangszustand;
	eroeffnetAm: Zeitpunkt;
	geschlossenAm: Zeitpunkt | null;
	ueberholtAm: Zeitpunkt | null;
	/**
	 * Wann das Ergebnis verkündet wurde; null, solange es nicht verkündet ist
	 * (offener Stichentscheid). Daran hängt, ob die Leitung den Durchgang noch
	 * überholen darf (`ueberholeDurchgang`).
	 */
	verkuendetAm?: Zeitpunkt | null;
	/**
	 * Warum ersetzt (FR-44): `korrektur` — der Durchgang war fehlerhaft;
	 * `rueckkommen` — die Versammlung hat neu entschieden. Der Unterschied
	 * gehört ins Protokoll, denn im ersten Fall hat sie nie so entschieden.
	 */
	ueberholungsart?: Ersetzungsart | null;
	ueberholungsgrund: string | null;
	/**
	 * Der Durchgang, der diesen ersetzt hat (`superseded_by_round_id`). Nach
	 * einem Rückkommen, auf das ein Folgeantrag an die Stelle des alten Antrags
	 * trat, liegt er auf einem **anderen** Traktandum (Migration 133). Fehlt die
	 * Angabe, folgt `massgebenderDerSache` keinem Verweis.
	 */
	ersetztDurchId?: Id | null;
	/**
	 * Bei fehlender Beschlussfähigkeit konsultativ eröffnet (Migration 158,
	 * `konsultativ.ts`): Er ergibt beim Schliessen «kein Beschluss». Fehlt die
	 * Angabe, ist er verbindlich.
	 */
	konsultativ?: boolean;
	/** Konsultativ nach der Sperre von L5 (Migration 174): eigener Vermerk im Verlauf. */
	konsultativNachL5?: boolean;
}

// ── Freigeben ───────────────────────────────────────────────────────────────

export interface Freigabelage {
	versammlungszustand: string;
	traktandumart: Traktandumart;
	traktandumtitel: string;
	erfordernis: Erfordernis | null;
	/** Wie viele Durchgänge dieser Versammlung gerade offen sind. */
	offeneDurchgaenge: number;
	/** Der Antrag ist zurückgezogen (FR-45) — über ihn wird nicht abgestimmt. */
	zurueckgezogen?: boolean;
	/**
	 * Wie viele unmittelbar Betroffene am Traktandum eingetragen sind. Nur
	 * gebraucht, wo das Erfordernis ihre Zustimmung verlangt (seit 25.09.2026).
	 */
	betroffene?: number;
	/** Erst während der Versammlung aufgenommen (Story 5.11). */
	spontan?: boolean;
	/**
	 * Welcher der beiden Fälle (Migrationen 031 und 032).
	 *
	 * Ein `folgeantrag` darf zur Abstimmung, mit seinem Grundantrag. Ein
	 * neues Geschäft nur mit einer Ausnahme (`ausnahme`, Migration 127).
	 */
	spontanart?: Spontanart | null;
	/** Das übergeordnete, angekündigte Traktandum eines Folgeantrags. */
	grundantragId?: Id | null;
	/**
	 * Entscheid 0045, Punkt 9 (beim Bau geklärt 07.11.2026): Unter einem
	 * Traktandum mit Häkchen die Folgeanträge zur Wahl oder Abberufung der
	 * Verwaltung, über die entschieden ist. Ist einer da, wird über den
	 * Grundantrag nicht mehr abgestimmt (`teilentschiedenSatz`). Fehlt die
	 * Angabe, gilt keiner.
	 */
	teilentschieden?: Teilentscheid[];
	/** Worauf sich ein neues Geschäft stützt, das zur Abstimmung darf (Migration 127). */
	ausnahme?: Ausnahmegrund | null;
	/**
	 * Bei `ausnahme = 'universal'`: die eingefrorene Variante, der Stand im
	 * Saal, die Bestätigung der Leitung und ob zu diesem Geschäft schon einmal
	 * widersprochen wurde (Migration 128). Fehlt es, trägt die Ausnahme nicht.
	 */
	universal?: {
		variante: Universalvariante;
		befund: Universalbefund;
		bestaetigt: boolean;
		fruehererWiderspruch: boolean;
		/** Ob nach einem Rückkommen ein früherer Beschluss gilt (`beschlussGilt`). */
		fruehererBeschluss?: boolean;
	} | null;
}

/** Warum ein gesetztes Erfordernis keine Abstimmung trägt, mit dem Weg. */
export interface Erfordernisluecke {
	kennung:
		| 'kenntnisnahme_als_erfordernis'
		| 'ohne_schwelle'
		| 'ohne_betroffene'
		| 'ohne_beklagten'
		| 'einsprache_ohne_betroffene';
	satz: string;
}

const NEU_SETZEN =
	'Setzen Sie die nötige Mehrheit neu («Nötige Mehrheit ändern» unter «Jetzt möglich»).';

/**
 * Ob ein gesetztes Erfordernis eine Abstimmung trägt, und wenn nicht, warum.
 *
 * **Ein unvollständiges Erfordernis sperrt wie ein fehlendes**
 * (Produktentscheid 25.09.2026, «Beim Eröffnen sperren»; Leitplanken Zeile 6
 * sinngemäss). Sonst liesse sich eröffnen, und `zaehleAus` würfe erst beim
 * Schliessen, im Saal, nachdem alle gestimmt haben.
 *
 * **Eine Quelle für Sperre und Anzeige.** `pruefeDurchgangsfreigabe` wirft den
 * Satz, `mehrheitsvorschau` zeigt ihn der Sitzungsleitung vor dem Knopf, der
 * dann fehlt. Die erste Fassung setzte die Warnung aus der Meldung von
 * `zaehleAus` und einem festen Zusatz zusammen und schickte die Leitung im
 * Betroffenenfall zum Ändern eines Erfordernisses, das stimmte: Das ergäbe
 * einen Beschluss nach der falschen Regel (Code-Review 25.09.2026 zur Sperre,
 * Befund 1). Deshalb nennt jeder Fall seinen eigenen Weg.
 *
 * **Die fünf Fälle:**
 *   - Eine Kenntnisnahme als Erfordernis eines Antrags. Wählbar ist sie unter
 *     «Nötige Mehrheit ändern»; eröffnet, entstand ein Durchgang ohne Ergebnis
 *     (Befund 2 derselben Prüfung).
 *   - Keine Kopfschwelle. Im Regelwerk tragen nur Kenntnisnahme, Grenzfall
 *     und die Reglementsregel `kopf: null`, und deren Schwelle ist Pflicht;
 *     der Fall ist ein Schutz, kein Alltag.
 *   - Zustimmung Betroffener verlangt, niemand eingetragen. Betroffene lassen
 *     sich nur im Entwurf zuordnen (`traktanden.ts`, `nurImEntwurf`). Stimmt
 *     das Erfordernis, gibt es an diesem Tag keinen Weg; der Satz sagt das,
 *     statt einen falschen anzubieten.
 *   - Ausschlussklage ohne beklagte Partei (seit 29.09.2026). Auch am
 *     Rückkommensantrag zu einer angenommenen Ermächtigung, der die Betroffenen
 *     nicht erbt; dort trägt die Leitung sie unter «Betroffene» ein.
 *   - Einsprache nach Art. 712c Abs. 2 ohne eingetragene Partei, die verkauft,
 *     vermietet oder belastet (ab Fassung 2026-10-20, Entscheid der
 *     auftraggebenden Sitzung 19.10.2026). Ohne Eintrag stimmte sie mit.
 */
export function erfordernisluecke(e: Erfordernis, betroffene: number): Erfordernisluecke | null {
	if (e.typ === 'keine_abstimmung') {
		return {
			kennung: 'kenntnisnahme_als_erfordernis',
			satz:
				'Als Erfordernis ist eine Kenntnisnahme gesetzt; so wird nicht abgestimmt. Soll ' +
				'abgestimmt werden, setzen Sie die nötige Mehrheit neu («Nötige Mehrheit ändern» ' +
				'unter «Jetzt möglich»).'
		};
	}
	if (e.typ === 'grenzfall') return null;
	// Ohne Köpfe auszählbar, wo eine Wertquotenschwelle besteht (Regel «Köpfe zählen nicht», 16.11.2026).
	if (!e.kopfSchwelle && !nurNachWertquoten(e)) {
		return {
			kennung: 'ohne_schwelle',
			satz:
				`Das Erfordernis «${e.titel}» nennt keine Kopfschwelle; so liesse sich das Ergebnis ` +
				`nicht auszählen. ${NEU_SETZEN}`
		};
	}
	/*
	 * **Seit Block A2 mit Weg** (25.09.2026). Vorher liessen sich Betroffene nur
	 * im Entwurf zuordnen, und der Satz sagte, dass es an diesem Tag nicht geht.
	 * Jetzt lassen sie sich im Saal eintragen (`server/betroffene.ts`), und der
	 * Satz führt dorthin. Die Sperre bleibt: Ohne sie stünde ein Beschluss nach
	 * Art. 712g Abs. 4 angenommen da, ohne dass jemand zugestimmt hat. Neu
	 * setzen soll die Mehrheit nur, wer das Erfordernis für falsch hält (Code-Review
	 * 25.09.2026 zur Sperre, Befund 1).
	 */
	if (e.zustimmungBetroffenerNoetig && betroffene === 0) {
		return {
			kennung: 'ohne_betroffene',
			satz:
				'Dieses Erfordernis verlangt die Zustimmung der unmittelbar Betroffenen, eingetragen ' +
				'ist aber niemand. Tragen Sie sie unter «Jetzt möglich» bei «Betroffene» ein, danach ' +
				'lässt sich abstimmen. Nur wenn das Erfordernis nicht stimmt, setzen Sie die nötige ' +
				'Mehrheit neu.'
		};
	}
	/*
	 * **Die Ausschlussklage ohne benannten Beklagten** (Produktentscheid
	 * 29.09.2026: «Ausschluss muss die ausgeschlossene Partei / Einheit
	 * benannt werden»). Ohne Eintrag zählte er mit, samt seinen Vollmachten,
	 * und unter einer Klausel der Anwesenden erinnerte nicht einmal die
	 * Bezugsgrösse daran. Die Freigabe der Einladung sperrt denselben Fall
	 * (`pruefeFreigabe`); hier fängt es ab, was danach entfernt wurde.
	 */
	if (e.knotenId === AUSSCHLUSSKLAGE_KNOTEN && betroffene === 0) {
		return {
			kennung: 'ohne_beklagten',
			satz:
				'Bei der Ermächtigung zur Ausschlussklage muss feststehen, gegen wen geklagt wird. ' +
				'Tragen Sie die beklagte Partei unter «Jetzt möglich» bei «Betroffene» ein, danach ' +
				'lässt sich abstimmen. Sie stimmt dann nicht mit.'
		};
	}
	/*
	 * **Die Einsprache ohne eingetragene Betroffene** (ab Fassung 2026-10-20,
	 * Entscheid der auftraggebenden Sitzung 19.10.2026): wie bei der
	 * Ausschlussklage. Ohne Eintrag stimmte die Partei, die verkauft,
	 * vermietet oder belastet, über die Einsprache mit, samt ihren Vollmachten.
	 */
	if (e.knotenId === EINSPRACHE_KNOTEN && betroffene === 0) {
		return {
			kennung: 'einsprache_ohne_betroffene',
			satz:
				'Bei der Einsprache muss feststehen, wer verkauft, vermietet oder belastet. Tragen Sie ' +
				'diese Partei unter «Jetzt möglich» bei «Betroffene» ein, danach lässt sich abstimmen. ' +
				'Sie stimmt dann nicht mit.'
		};
	}
	return null;
}

/** Ein entschiedener Folgeantrag zur Wahl oder Abberufung unter dem Häkchen. */
export interface Teilentscheid {
	/** Der Folgeantrag, für das Protokoll (`entschiedeneTeile`). */
	traktandumId: Id;
	titel: string;
	art: 'wahl' | 'abberufung';
	/** Angenommen; sonst abgelehnt oder ohne Beschluss. */
	angenommen: boolean;
}

/**
 * Die Absage am Grundantrag, wenn unter dem Häkchen ein Folgeantrag zur Wahl
 * oder Abberufung der Verwaltung entschieden ist (Entscheid 0045, Punkt 9,
 * beim Bau geklärt 07.11.2026). Der Grundantrag enthält dieselbe Wahl oder
 * Abberufung; eine zweite Abstimmung darüber fragte sie nochmals ab. Dieselbe
 * Prüfung fährt der Beschluss von Hand trocken mit; dort steht sie unter dem
 * Übergangenen.
 *
 * **Je Ergebnis die Tatsache** (Laienprüfung Runde 5, R5-8; Fachprüfung
 * Runde 5, R5-2): angenommen oder nicht angenommen. Was danach noch ansteht,
 * hängt am Ergebnis, an einer anderen Kandidatur und an der Kündigung; das
 * steht im Handbuch (Produktentscheid 07.11.2026 nach Runde 7).
 */
export function teilentschiedenSatz(teile: Pick<Teilentscheid, 'titel' | 'art' | 'angenommen'>[]): string {
	// Codeprüfung P9, N-M1; Laien und Fach Runde 6, R6-4: Massgebend ist ein
	// angenommener Teil, sonst der zuletzt entschiedene, nicht der erste.
	const t = teile.find((x) => x.angenommen) ?? teile[teile.length - 1];
	const wahl = t.art === 'wahl';
	// Produktentscheid 07.11.2026 nach Runde 7: Der Satz sagt nur die
	// Tatsache; welche Teile nach welchem Ergebnis noch anstehen, steht im
	// Handbuch. Die Ratschläge hier erzeugten in jeder Runde neue Randfälle.
	return (
		`Die Versammlung hat ${wahl ? 'die Wahl' : 'die Abberufung'} der Verwaltung im Folgeantrag ` +
		`«${t.titel}» ${t.angenommen ? 'angenommen' : 'nicht angenommen'}. Über diesen Antrag stimmen Sie ` +
		`deshalb nicht mehr ab: Er enthält ${wahl ? 'dieselbe Wahl' : 'dieselbe Abberufung'}. ` +
		// Fach Runde 8, R8-1: Nach einer abgelehnten Gegenkandidatur ist die
		// Wahl aus diesem Antrag noch offen; eine Tatsache, kein Rat.
		(wahl && !t.angenommen
			? 'Ging es im Folgeantrag um eine andere Kandidatur, ist die Wahl aus diesem Antrag noch offen. '
			: '') +
		// Laien Runde 8, R8-1: kein «stimmen Sie ab», das sich als Freigabe las.
		'Ob danach noch ein Teil abzustimmen ist und welcher, hängt am Ergebnis; das steht im Handbuch im ' +
		'Absatz «Was nach dem Folgeantrag noch ansteht».'
	);
}

/**
 * Ob eine Abstimmung freigegeben werden darf.
 *
 * Wirft mit einem Satz, der im Saal genügt. Jede dieser Sperren steht für einen
 * Fehler, der sich hinterher nicht mehr heilen lässt:
 *
 *   - Ohne laufende Versammlung gäbe es keine Anwesenheit, auf der zu rechnen
 *     wäre.
 *   - Bei einer Kenntnisnahme entstünde ein Beschluss, den das Traktandum nie
 *     angekündigt hat.
 *   - Ohne Mehrheitserfordernis stünde am Ende eine Zahl ohne Schranke —
 *     angenommen oder abgelehnt liesse sich nicht sagen.
 *   - Mit einem Erfordernis, das keine Abstimmung trägt (Kenntnisnahme, keine
 *     Kopfschwelle, nötige Zustimmung ohne eingetragene Betroffene), würfe
 *     erst das Schliessen, im Saal (`erfordernisluecke`, seit 25.09.2026).
 *   - Zwei offene Fragen auf den Telefonen wären im Saal nicht mehr zu klären.
 *   - Über ein nicht angekündigtes Geschäft wird nur beschlossen, wenn das
 *     Reglement es ausdrücklich gestattet (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m
 *     Abs. 2; vermerkt am Traktandum, Migration 127) oder die Versammlung als
 *     Universalversammlung tagt (Migration 128). Sonst darf nur der
 *     Folgeantrag zu einem angekündigten Antrag.
 */
export function pruefeDurchgangsfreigabe(lage: Freigabelage): void {
	if (lage.versammlungszustand !== 'laufend') {
		throw new FachlicherFehler(
			'nicht_laufend',
			lage.versammlungszustand === 'freigegeben'
				? 'Die Versammlung ist noch nicht eröffnet. Abgestimmt wird erst ab der Eröffnung.'
				: 'Die Versammlung läuft nicht mehr. Es kann nicht mehr abgestimmt werden.',
			'zustand'
		);
	}

	/*
	 * **Über einen zurückgezogenen Antrag wird nicht abgestimmt** (FR-45).
	 *
	 * Die Regel gab es schon — als Trigger in der Datenbank (Migration 044).
	 * Dort ist sie richtig aufgehoben: Sie ist die letzte Verteidigungslinie
	 * gegen einen Beschluss, den es nicht geben darf. Aber sie war die
	 * **einzige**, und ein Datenbanktrigger wirft `PostgresError` statt eines
	 * fachlichen Fehlers. Ergebnis, gemeldet am 21.08.2026: «WEnn man darauf
	 * klickt kommt bei Rückzug ein 500er fehler.» Nachgestellt und gemessen —
	 * eine weisse Seite mit «500 Internal Error», mitten in der Versammlung.
	 *
	 * Die Meldung nennt jetzt auch den Weg heraus: Der Rückzug lässt sich
	 * zurücknehmen, solange nicht abgestimmt ist.
	 */
	if (lage.zurueckgezogen) {
		throw new FachlicherFehler(
			'zurueckgezogen',
			`Der Antrag «${lage.traktandumtitel}» ist zurückgezogen; darüber wird nicht abgestimmt. ` +
				'Soll doch darüber befunden werden, nehmen Sie zuerst den Rückzug zurück.',
			'zustand'
		);
	}

	if (lage.teilentschieden && lage.teilentschieden.length > 0) {
		throw new FachlicherFehler('teil_entschieden', teilentschiedenSatz(lage.teilentschieden), 'zustand');
	}

	if (lage.traktandumart !== 'abstimmung') {
		throw new FachlicherFehler(
			'keine_abstimmung',
			`«${lage.traktandumtitel}» ist als Kenntnisnahme angekündigt. Ein Beschluss daraus wäre ` +
				'nicht traktandiert und damit anfechtbar.',
			'art'
		);
	}

	if (!lage.erfordernis || lage.erfordernis.typ === 'grenzfall') {
		throw new FachlicherFehler(
			'ohne_erfordernis',
			!lage.erfordernis
				? 'Für dieses Traktandum steht das Mehrheitserfordernis noch nicht fest. ' +
					'Bestimmen Sie es über den Entscheidbaum, bevor abgestimmt wird. ' +
					'Hinterher lässt sich nicht mehr sagen, ob der Antrag angenommen ist.'
				: 'Der Entscheidbaum kommt hier zu keiner belastbaren Antwort. Die Sitzungsleitung setzt ' +
					'das Erfordernis selbst, bevor abgestimmt wird.',
			'erfordernis'
		);
	}

	const luecke = erfordernisluecke(lage.erfordernis, lage.betroffene ?? 0);
	if (luecke) throw new FachlicherFehler(luecke.kennung, luecke.satz, 'erfordernis');

	if (lage.offeneDurchgaenge > 0) {
		throw new FachlicherFehler(
			'schon_offen',
			'Es ist bereits eine Abstimmung offen. Schliessen Sie sie zuerst — zwei Fragen zugleich ' +
				'auf den Telefonen wären im Saal nicht mehr zu klären.',
			'zustand'
		);
	}

	if (lage.spontan && lage.spontanart === 'rueckkommen') {
		/*
		 * **Der Rückkommensantrag darf zur Abstimmung, obwohl er erst im Saal
		 * entstand** (FR-44).
		 *
		 * Er ist kein neues Geschäft: Der Gegenstand war angekündigt und ist
		 * bereits behandelt worden. Beschlossen wird nur, **ob nochmals** darüber
		 * beraten wird — ein Ordnungsantrag. Der Abwesende, den ZGB Art. 712m Abs. 2
		 * i.V.m. Art. 67 Abs. 3 schützt, konnte sich auf diesen Gegenstand
		 * einstellen; er stand auf der Liste, die er bekommen hat.
		 */
	} else if (lage.spontan && lage.spontanart === 'folgeantrag') {
		// Der Grundantrag trägt die Zulässigkeit. Fehlt er, ist der Antrag nicht
		// als Folgeantrag geführt, sondern als nicht angekündigtes Geschäft — und
		// dafür gilt, was für neue Geschäfte gilt.
		if (!lage.grundantragId) {
			throw new FachlicherFehler(
				'ohne_grundantrag',
				'Dieser Antrag ist als Folgeantrag geführt, hängt aber an keinem angekündigten ' +
					'Traktandum. Ordnen Sie ihn dem Antrag zu, in dessen Kern er liegt. Steht er für ' +
					'sich, nehmen Sie ihn als neues Geschäft auf.',
				'grundantrag'
			);
		}
	} else if (lage.spontan && lage.spontanart === 'neu' && lage.ausnahme === 'reglement') {
		/*
		 * **Das Reglement gestattet es** (Migration 127). Vermerkt wird die
		 * Ausnahme beim Aufnehmen, und nur, wenn die Momentaufnahme sie trägt;
		 * die Datenbank weist ein neues Geschäft als Abstimmung ohne Vermerk ab.
		 * Die Empfehlung zur Zurückhaltung steht im Aufnahmedialog.
		 */
	} else if (lage.spontan && lage.spontanart === 'neu' && lage.ausnahme === 'universal') {
		/*
		 * **Die Universalversammlung** (Migration 128). Beim Aufnehmen war sie
		 * vollzählig; ob sie es jetzt noch ist, zählt allein. Dazu die
		 * Bestätigung der Leitung, dass sie nach einem Widerspruch gefragt hat.
		 * Alle Gründe auf einmal (`universalgruende`).
		 */
		// Ohne Lage kein Durchgang: Ein Weg, der sie nicht mitgibt, hat nicht
		// geprüft, und dann gilt die Regel, nicht die Ausnahme.
		const gruende = lage.universal
			? universalgruende(lage.universal)
			: ['Der Stand im Saal wurde nicht geprüft.'];
		if (gruende.length > 0) {
			throw new FachlicherFehler(
				'universal_traegt_nicht',
				`«${lage.traktandumtitel}» war nicht angekündigt und ist als Universalversammlung ` +
					`aufgenommen. ${gruende.join(' ')}` +
					(lage.universal
						? ` ${universalschluss(lage.universal, gruende)}`.trimEnd()
						: ` ${UNIVERSAL_SONST}`),
				'universal'
			);
		}
	} else if (lage.spontan) {
		throw new FachlicherFehler(
			'nicht_angekuendigt',
			`«${lage.traktandumtitel}» wurde erst während der Versammlung aufgenommen und war nicht ` +
				`angekündigt. ${NICHT_ANGEKUENDIGT_GRUNDSATZ} ${NICHT_ANGEKUENDIGT_BEIM_EROEFFNEN}`,
			'ankuendigung'
		);
	}
}

export function oeffneDurchgang(
	d: Omit<Durchgang, 'zustand' | 'geschlossenAm' | 'ueberholtAm' | 'ueberholungsgrund'>,
	traktandumtitel: string,
	/**
	 * Was die Leitung mit dem Freigeben bestätigt hat (Ä-05, M4); nur, wenn die
	 * Seite die Zuordnung gezeigt und der Server sie noch gültig gefunden hat.
	 */
	zuordnung: Omit<Zuordnung, 'marke'> | null = null
): Uebergang<Durchgang> {
	const neu: Durchgang = {
		...d,
		zustand: 'offen',
		geschlossenAm: null,
		ueberholtAm: null,
		ueberholungsgrund: null
	};
	return {
		ergebnis: neu,
		ereignisse: [
			ereignis(
				EREIGNISARTEN.abstimmungEroeffnet,
				{ art: 'meeting', id: d.meetingId },
				{
					traktandum: traktandumtitel,
					traktandumId: d.traktandumId,
					durchgang: d.nummer,
					// Im Verlauf als Vermerk, nur wenn er zutrifft (Migration 158).
					// Nach der Sperre von L5 mit eigenem Vermerk (Codeprüfung Block 7, R3-N1).
					...(d.konsultativ
						? d.konsultativNachL5
							? { konsultativNachL5: true }
							: { konsultativ: true }
						: {}),
					...(zuordnung ? { zuordnungBestaetigt: zuordnungImVerlauf(zuordnung) } : {})
				}
			)
		]
	};
}

/**
 * Schliesst den Durchgang.
 *
 * Ab hier werden keine Stimmen mehr angenommen, und der Anwesenheitsstand
 * dieses Augenblicks wird festgeschrieben (AD-16). Beides gehört zusammen: Ein
 * Stand, der weiterläuft, veränderte die Bezugsgrösse, sobald nach der
 * Abstimmung jemand den Saal verlässt — und damit rückwirkend das Ergebnis.
 */
export function schliesseDurchgang(
	d: Durchgang,
	zeitpunkt: Zeitpunkt,
	traktandumtitel: string
): Uebergang<Durchgang> {
	if (d.zustand !== 'offen') {
		throw new FachlicherFehler(
			'nicht_offen',
			'Diese Abstimmung ist bereits geschlossen.',
			'zustand'
		);
	}
	const neu: Durchgang = { ...d, zustand: 'geschlossen', geschlossenAm: zeitpunkt };
	return {
		ergebnis: neu,
		ereignisse: [
			ereignis(
				EREIGNISARTEN.abstimmungGeschlossen,
				{ art: 'meeting', id: d.meetingId },
				{ traktandum: traktandumtitel, traktandumId: d.traktandumId, durchgang: d.nummer }
			)
		]
	};
}

/**
 * Kürzeste Begründung für eine Neuabstimmung. Sie steht im Protokoll beim
 * Geschäft und im Verlauf (Produktentscheid 30.09.2026: «Ja, immer nennen»).
 * Das Protokoll geht an alle Eigentümer, und mit seiner Zustellung läuft die
 * Anfechtungsfrist auch für die Abwesenden (Rz. 126 ad Art. 712n); den Grund
 * finden sie sonst nur im Abschlusspaket.
 */
export const KUERZESTE_BEGRUENDUNG = 10;

/**
 * Der Weg nach der Verkündung, für jede Absage, die ein verkündetes Ergebnis
 * nicht mehr ändern lässt: Neuabstimmung, Stichentscheid, Empfehlungen zum
 * Rückkommen. Ein Satz an einer Stelle, damit die Absagen nicht verschiedene
 * Wege nennen.
 */
export const WEG_NACH_DER_VERKUENDUNG =
	'Ändern kann es nur noch die Versammlung mit einem neuen Beschluss: Beantragen Sie das ' +
	'Rückkommen, beim aufgerufenen Geschäft unter «Nochmals abstimmen».';

/**
 * Setzt eine Neuabstimmung an: Der bisherige Durchgang wird überholt.
 *
 * Die Begründung ist Pflicht, weil sie der einzige Grund ist, aus dem ein
 * zweiter Durchgang das Ergebnis des ersten ersetzen darf. «Verfahrensfehler
 * bei der Fragestellung» ist eine Begründung; ein leeres Feld ist keine.
 *
 * **`neueroeffnung`** (Migration 130, Produktentscheid 08.10.2026): Der
 * Durchgang ohne Beschluss nach einem Weggang wird beim nächsten Eröffnen
 * überholt, ohne dass die Leitung etwas ansetzt. Das Ereignis heisst dann
 * «Abstimmung neu eröffnet» statt «Neuabstimmung angesetzt»: Eine Neueröffnung
 * ist keine Anordnung, und im Verlauf soll der Unterschied lesbar bleiben
 * (`docs/freigabe.md`, «Offen: Reste zur Universalversammlung», Punkt 6).
 *
 * **Nur bis zur Verkündung** (Fachprüfung 08.10.2026, `quellen` Frage 65).
 * Ein verkündeter Beschluss wirkt, bis er im Verfahren nach Art. 75
 * aufgehoben ist (Rz. 207 ad Art. 712m), und verbessern darf ihn nur die
 * Versammlung mit einem neuen Beschluss (Rz. 235 ad Art. 712m; Rz. 202a ad
 * Art. 712g). Eine Stelle, die dem Vorsitz die Wiederholung einräumt, gibt es
 * nicht. Vor der Verkündung ist das Überholen unbedenklich. Weil das Schliessen
 * seit dem 21.08.2026 selbst verkündet, bleibt der Leitung damit der
 * Durchgang mit offenem Stichentscheid. Die Neueröffnung ist ausgenommen: Sie
 * überholt einen Durchgang, der keinen Beschluss ergab, und ändert damit
 * keinen.
 */
export function ueberholeDurchgang(
	d: Durchgang,
	zeitpunkt: Zeitpunkt,
	begruendung: string,
	traktandumtitel: string,
	neueroeffnung = false
): Uebergang<Durchgang> {
	if (d.zustand !== 'geschlossen') {
		throw new FachlicherFehler(
			'nicht_geschlossen',
			'Eine Neuabstimmung setzt voraus, dass die laufende Abstimmung geschlossen ist.',
			'zustand'
		);
	}
	if (d.ueberholtAm) {
		throw new FachlicherFehler(
			'schon_ueberholt',
			'Dieser Durchgang ist bereits durch einen späteren überholt.',
			'zustand'
		);
	}
	if (d.verkuendetAm && !neueroeffnung) {
		throw new FachlicherFehler(
			'schon_verkuendet',
			`Das Ergebnis dieses Durchgangs ist verkündet und gilt. ${WEG_NACH_DER_VERKUENDUNG}`,
			'zustand'
		);
	}
	const text = begruendung.trim();
	if (zeichenzahl(text) < KUERZESTE_BEGRUENDUNG) {
		throw new FachlicherFehler(
			'begruendung_fehlt',
			`Eine Neuabstimmung verlangt eine Begründung von mindestens ${KUERZESTE_BEGRUENDUNG} ` +
				'Zeichen. Sie steht im Protokoll und im Verlauf und erklärt, warum der frühere ' +
				'Durchgang überholt wird.',
			'begruendung'
		);
	}

	const neu: Durchgang = { ...d, ueberholtAm: zeitpunkt, ueberholungsgrund: text };
	return {
		ergebnis: neu,
		ereignisse: [
			ereignis(
				neueroeffnung ? EREIGNISARTEN.abstimmungNeuEroeffnet : EREIGNISARTEN.abstimmungWiederholt,
				{ art: 'meeting', id: d.meetingId },
				{
					traktandum: traktandumtitel,
					traktandumId: d.traktandumId,
					durchgang: d.nummer,
					begruendung: text
				}
			)
		]
	};
}

/**
 * Bricht die laufende Abstimmung ohne Ergebnis ab (H6; Laien- und Fachprüfung
 * 14.10.2026, F-1).
 *
 * **Der Anlass.** Merkt die Leitung während der Abstimmung, dass ihre
 * Grundlage falsch ist (Ausstand, Betroffene), blieb ihr nur das Schliessen.
 * Das verkündet ein Ergebnis, von dem sie weiss, dass es falsch gezählt ist,
 * und das danach nur noch die Versammlung über ein Rückkommen ändern kann,
 * mit dem Mehr des Beschlusses selbst. Der Bestand will den Fehler vor der
 * Beschlussfassung behoben sehen (BGE 136 III 174 E. 5.1.2; Rz. 99, 101 ad
 * Art. 712n). Solange nichts verkündet ist, ändert der Abbruch keinen
 * Beschluss, er verhindert einen.
 *
 * **Nur solange sie offen ist**, mit Begründung wie die Neuabstimmung. Die
 * abgegebenen Stimmen bleiben festgehalten und bewirken nichts.
 */
export function brecheDurchgangAb(
	d: Durchgang,
	zeitpunkt: Zeitpunkt,
	begruendung: string,
	traktandumtitel: string
): Uebergang<Durchgang> {
	if (d.zustand !== 'offen') {
		throw new FachlicherFehler(
			'nicht_offen',
			'Abbrechen lässt sich nur eine laufende Abstimmung. Mit dem Schliessen ist ihr Ergebnis ' +
				'verkündet, ausser bei einem offenen Gleichstand; dort ist der Weg die Neuabstimmung.',
			'zustand'
		);
	}
	const text = begruendung.trim();
	if (zeichenzahl(text) < KUERZESTE_BEGRUENDUNG) {
		throw new FachlicherFehler(
			'begruendung_fehlt',
			`Ein Abbruch verlangt eine Begründung von mindestens ${KUERZESTE_BEGRUENDUNG} ` +
				'Zeichen. Sie steht im Protokoll und im Verlauf und erklärt, warum die Abstimmung ' +
				'kein Ergebnis hat.',
			'begruendung'
		);
	}
	return {
		ergebnis: {
			...d,
			zustand: 'geschlossen',
			geschlossenAm: zeitpunkt,
			ueberholtAm: zeitpunkt,
			ueberholungsart: 'korrektur',
			ueberholungsgrund: text
		},
		ereignisse: [
			ereignis(
				EREIGNISARTEN.abstimmungAbgebrochen,
				{ art: 'meeting', id: d.meetingId },
				{
					traktandum: traktandumtitel,
					traktandumId: d.traktandumId,
					durchgang: d.nummer,
					begruendung: text
				}
			)
		]
	};
}

/**
 * Der Weg, wenn die Grundlage einer laufenden Abstimmung nicht stimmt (H6):
 * für die Absagen bei Ausstand und Betroffenen. Mit dem Grund, warum nicht
 * schliessen (Laien- und Fachprüfung 14.10.2026, F-1).
 */
export function abbrechenStattSchliessen(was: string): string {
	return (
		`Brechen Sie die Abstimmung ohne Ergebnis ab, ordnen Sie ${was} und geben Sie sie neu ` +
		'frei. Wer stattdessen schliesst, verkündet das Ergebnis, und ändern kann es danach nur ' +
		'noch die Versammlung.'
	);
}

/**
 * Ob ein Durchgang abgebrochen wurde: geschlossen und überholt im selben
 * Augenblick, ohne Verkündung (`brecheDurchgangAb`). Dieselbe Erkennung wie
 * beim Notweg, der einen offenen Durchgang ohne Auszählung beendet; dort heisst
 * die Art `notweg`, hier `korrektur`.
 */
export function abgebrochen(d: {
	ueberholungsart?: Ersetzungsart | null;
	geschlossenAm: Zeitpunkt | null;
	ueberholtAm: Zeitpunkt | null;
	verkuendetAm?: Zeitpunkt | null;
}): boolean {
	return (
		d.ueberholungsart === 'korrektur' &&
		!d.verkuendetAm &&
		d.geschlossenAm !== null &&
		d.geschlossenAm === d.ueberholtAm
	);
}

/** Welcher Durchgang eines Traktandums gilt: der jüngste, der nicht überholt ist. */
export function massgebender<T extends Durchgang>(durchgaenge: T[]): T | null {
	const gueltige = durchgaenge.filter((d) => !d.ueberholtAm);
	if (gueltige.length === 0) return null;
	return gueltige.reduce((a, b) => (b.nummer > a.nummer ? b : a));
}

/**
 * Der massgebende Durchgang der **Sache** `traktandumId`, aus allen
 * Durchgängen der Versammlung: dieselbe Antwort wie `massgebender_durchgang`
 * in der Datenbank (Migration 133).
 *
 * **Warum nicht `massgebender` über die Durchgänge des Traktandums.** Nach
 * einem Rückkommen darf statt des alten Antrags ein Folgeantrag zur
 * Abstimmung kommen (Produktentscheid 30.09.2026). Ergibt er einen Beschluss,
 * ist der Durchgang des Grundtraktandums als `rueckkommen` überholt, und der
 * Verweis zeigt auf den Durchgang des Folgeantrags. Das Grundtraktandum hat
 * dann keinen eigenen geltenden Durchgang mehr, und jeder Leser, der nur
 * seine Durchgänge ansieht, hielte es für unbehandelt: Die Tafel zählte es
 * als offen, die Leitung böte «Abstimmung freigeben» an.
 *
 * Gewählt wird wie in der Datenbank der jüngste nicht überholte Durchgang der
 * Kette, nach Eröffnungszeit; über zwei Traktanden vergleicht die Nummer
 * nichts. Ohne Ersetzung über ein anderes Traktandum ist das dieselbe Antwort
 * wie `massgebender`, auch während ein neuer Durchgang offen ist: Beide nennen
 * dann den offenen, weil er der jüngste ist.
 */
export function massgebenderDerSache<T extends Durchgang>(alle: T[], traktandumId: Id): T | null {
	const nachId = new Map(alle.map((d) => [d.id, d]));
	const kette = new Map<Id, T>();
	const offen = alle.filter((d) => d.traktandumId === traktandumId);
	while (offen.length > 0) {
		const d = offen.pop()!;
		if (kette.has(d.id)) continue;
		kette.set(d.id, d);
		if (d.ueberholungsart === 'rueckkommen' && d.ersetztDurchId) {
			const n = nachId.get(d.ersetztDurchId);
			if (n) offen.push(n);
		}
	}
	let bester: T | null = null;
	for (const d of kette.values()) {
		if (d.ueberholtAm) continue;
		if (
			!bester ||
			d.eroeffnetAm > bester.eroeffnetAm ||
			(d.eroeffnetAm === bester.eroeffnetAm && d.nummer > bester.nummer) ||
			(d.eroeffnetAm === bester.eroeffnetAm && d.nummer === bester.nummer && d.id > bester.id)
		) {
			bester = d;
		}
	}
	return bester;
}

/**
 * Ob der Beschluss von `traktandumId` durch den Beschluss zu einem anderen
 * Traktandum ersetzt ist: dieselbe Frage wie `durch_anderes_traktandum_ersetzt`
 * (Migration 133). Das Traktandum gilt dann als entschieden, auch wenn es
 * selbst keinen geltenden Durchgang mehr hat.
 */
export function durchAnderesTraktandumErsetzt(alle: Durchgang[], traktandumId: Id): boolean {
	const nachId = new Map(alle.map((d) => [d.id, d]));
	return alle.some(
		(d) =>
			d.traktandumId === traktandumId &&
			d.ueberholungsart === 'rueckkommen' &&
			d.ersetztDurchId != null &&
			(nachId.get(d.ersetztDurchId)?.traktandumId ?? traktandumId) !== traktandumId
	);
}

// ── Fortschritt (Story 5.8, FR-37) ──────────────────────────────────────────

/**
 * Wie weit die Abstimmung ist — **ohne** die Verteilung.
 *
 * Der Typ trägt bewusst kein Feld für Ja, Nein oder Enthaltung. Das ist keine
 * Vorsicht, sondern die Umsetzung von FR-37: Wüsste die Sitzungsleitung während
 * der offenen Abstimmung den Stand, könnte sie den Zeitpunkt des Schliessens
 * danach wählen. Was der Typ nicht kennt, kann keine Sicht versehentlich
 * anzeigen.
 */
export interface Fortschritt {
	/** Parteien, die jetzt abstimmen könnten. */
	stimmberechtigt: number;
	/** Parteien, von denen mindestens eine Stimme vorliegt. */
	abgegeben: number;
	/** Alle haben gestimmt — dann darf das Ergebnis ohne Freigabe erscheinen (Story 5.9). */
	vollstaendig: boolean;
	/**
	 * Wer noch nicht gestimmt hat, beim Namen.
	 *
	 * **Weil im Saal Namen aufgerufen werden, keine Zahlen**
	 * (Bedienbarkeitsprüfung 05.09.2026, vierter der schweren Befunde der
	 * Bewirtschaftersicht): «‹0 von 5 haben abgestimmt›, aber nirgends die
	 * Namen. Im Saal ruft man Namen auf, nicht Zahlen.» Die Sitzungsleitung
	 * sieht dieselben Namen in der Anwesenheitsliste; neu ist nur, dass sie
	 * dort stehen, wo die Zahl steht.
	 *
	 * **Nicht über den Ereignisstrom** (Sicherheitsdurchgang 06.09.2026): Der
	 * trägt nie einen Namen (AD-11), denn er landet auch auf der Leinwand und
	 * auf jedem Teilnehmertelefon. Die Sicht nimmt diese Angabe aus dem Loader;
	 * `scripts/check-stromnamen.mjs` hält den Weg offen.
	 */
	offeneNamen: string[];
}

export function fortschritt(
	stimmberechtigteParteien: Id[],
	stimmen: { partyId: Id }[],
	/** Kennung → Name, für die noch offenen Parteien. Fehlt ein Name, entfällt er. */
	namen: ReadonlyMap<Id, string> = new Map()
): Fortschritt {
	const berechtigt = new Set(stimmberechtigteParteien);
	const habenGestimmt = new Set<Id>();
	for (const s of stimmen) {
		// Eine Stimme von jemandem, der nicht mehr im Stand ist, zählt nicht mit:
		// Sonst zeigte der Fortschritt mehr Abgaben als Stimmberechtigte.
		if (berechtigt.has(s.partyId)) habenGestimmt.add(s.partyId);
	}
	return {
		stimmberechtigt: berechtigt.size,
		abgegeben: habenGestimmt.size,
		vollstaendig: berechtigt.size > 0 && habenGestimmt.size === berechtigt.size,
		/*
		 * **Nach Namen sortiert, wie die Tabelle darunter** (Code-Review
		 * 06.09.2026). Die Reihenfolge der Stimmberechtigten ist die des
		 * Eintreffens im Saal; die Anwesenheits- und Erfassungsliste sortiert
		 * dagegen nach `display_name`. Ungeordnet stünde oben «Es fehlen:
		 * Zwahlen, Aebi, Muster» über einer Tabelle, die Aebi, Muster, Zwahlen
		 * zeigt.
		 *
		 * **Ohne Namen ein Platzhalter, kein stilles Weglassen**: Fiele die Zeile
		 * weg, stünde «3 von 5 haben abgestimmt» über «Es fehlen: Aebi» — die
		 * Sitzungsleitung schlösse die Abstimmung, weil sie eine Partei für
		 * erledigt hält.
		 */
		offeneNamen: stimmberechtigteParteien
			.filter((p) => !habenGestimmt.has(p))
			.map((p) => namen.get(p) ?? 'ohne Namen')
			.sort((a, b) => a.localeCompare(b, 'de-CH'))
	};
}

/** Der Fortschritt in einem Satz, wie er auf Beamer und Steuerungssicht steht. */
export function fortschrittInWorten(f: Fortschritt): string {
	if (f.stimmberechtigt === 0) return 'Niemand ist stimmberechtigt erfasst.';
	if (f.vollstaendig) return `Alle ${f.stimmberechtigt} haben abgestimmt.`;
	return `${f.abgegeben} von ${f.stimmberechtigt} haben abgestimmt.`;
}

// ── Stimmabgabe (Story 5.7) ─────────────────────────────────────────────────

/**
 * Ob die Sitzungsleitung diese Stimme erfassen darf — und unter welcher Auflage.
 *
 * **Der Anlass, am 20.08.2026.** Gemeldet als Loch: «dass der Sitzungsleiter für
 * einen Eigentümer stimmen darf. Das müsste aber dokumentiert sein. Bspw.
 * Telefon ist gerade ausgefallen.»
 *
 * **Warum es die Möglichkeit überhaupt braucht.** Wer anwesend ist, ist
 * stimmberechtigt — daran ändert ein leerer Akku nichts. Ohne diesen Weg fiele
 * die Stimme unter «ohne Abgabe», und das ist keine Enthaltung, sondern eine
 * verlorene Stimme: Sie bleibt in der Bezugsgrösse und wirkt damit wie ein Nein.
 *
 * **Warum sie eine Begründung verlangt.** Eine fremde Stimme, für die niemand
 * einen Grund nennen kann, ist keine Stimme, sondern ein Eingriff. Im
 * Anfechtungsfall ist genau das die Frage — und sie wird Monate später gestellt,
 * wenn sich niemand mehr erinnert. «Telefon ausgefallen» ist eine Begründung;
 * ein leeres Feld ist keine.
 *
 * **In der einfachen Betriebsart entfällt sie**, und das ist kein Widerspruch:
 * Dort erfasst die Sitzungsleitung **alle** Stimmen, weil im Saal von Hand
 * abgestimmt wird. Der Grund ist die Betriebsart selbst; ihn je Partei
 * abzutippen erzeugte vierzehn Pflichtfelder und keine einzige Auskunft. Die
 * Betriebsart steht ihrerseits im Protokoll.
 */
export function pruefeStellvertretendeStimme(lage: {
	betriebsart: Betriebsart;
	/**
	 * Ob DIESE Partei an dieser Versammlung auf Papier abstimmt (Migration 107).
	 *
	 * **Der dritte Fall zwischen den beiden bisherigen** (Auftraggeber, 08.09.2026). Die
	 * Betriebsart gilt für die ganze Versammlung; hier stimmen von vierzehn
	 * Parteien elf digital und drei auf Papier. Für die drei ist die
	 * stellvertretende Erfassung das **vereinbarte Verfahren** und kein Eingriff,
	 * genau wie in «einfach» — ihre Stimmzettel sind der Beleg, nicht der Satz im
	 * Formular. Dreissigmal «hat kein Telefon» zu tippen erzeugt keine Auskunft.
	 *
	 * Für die elf anderen ändert sich nichts: Wer für sie einträgt, greift ein
	 * und nennt den Grund.
	 */
	aufPapier?: boolean;
	begruendung: string | null;
}): string | null {
	const grund = (lage.begruendung ?? '').trim();

	/*
	 * **Die Betriebsart entscheidet allein** (Auftraggeber, 25.08.2026: «ich vermute
	 * dass die Sitzung mit Handzählen ist und darum kein Kommentar beim Stimmen
	 * durch den Sitzungsleiter braucht. Wenn dem so ist, müsste das Mecano
	 * angepasst werden»).
	 *
	 * Bis hierher gab es einen Zusatz `einzeln`: Wer für EINE Partei erfasste,
	 * musste in jeder Betriebsart einen Grund nennen — die Überlegung war, dass
	 * eine nachträglich gesetzte fremde Stimme auch auf Papier ein Eingriff sei.
	 *
	 * Das trifft die einfache Betriebsart nicht. Dort trägt die Sitzungsleitung
	 * **alle** Stimmen ein; das ist ihr Verfahren, nicht ihr Eingriff («Auf
	 * Papier. Die Sitzungsleitung trägt die Stimmen für alle ein», so steht es
	 * in der Betriebsartwahl). Ob sie dabei die Tabelle ausfüllt oder eine Zeile
	 * einzeln nachträgt, ändert daran nichts — es ist derselbe Vorgang in einer
	 * anderen Maske. Ein Pflichtfeld verlangt dort vierzehnmal denselben Satz
	 * und erzeugt keine Auskunft, sondern Tippen.
	 *
	 * In der geführten bleibt es Pflicht, und zwar für beide Wege: Dort stimmen
	 * die Eigentümer selbst, und wer für sie einträgt, greift wirklich ein.
	 */
	/*
	 * **Zwei Gründe, eine Wirkung** (09.09.2026). Die Betriebsart «einfach» sagt
	 * es für die ganze Versammlung, der Papiervermerk für eine einzelne Partei.
	 * Beide Male ist die Erfassung durch die Sitzungsleitung der abgemachte Weg,
	 * und beide Male bleibt die Begründung erlaubt, nur nicht verlangt.
	 */
	if (lage.betriebsart === 'einfach' || lage.aufPapier === true) {
		// Auch hier gilt: Was dasteht, muss etwas taugen. Aber es muss nichts
		// dastehen.
		if (grund.length === 0) return null;
		if (zeichenzahl(grund) < KUERZESTE_BEGRUENDUNG) {
			throw new FachlicherFehler(
				'begruendung_zu_kurz',
				`Die Begründung braucht mindestens ${KUERZESTE_BEGRUENDUNG} Zeichen.`,
				'begruendung'
			);
		}
		return grund;
	}

	if (zeichenzahl(grund) < KUERZESTE_BEGRUENDUNG) {
		throw new FachlicherFehler(
			'begruendung_fehlt',
			'Wenn Sie für eine Partei stimmen, gehört der Grund dazu — er steht später im ' +
				`Protokoll. Mindestens ${KUERZESTE_BEGRUENDUNG} Zeichen, etwa «Telefon ausgefallen, ` +
				'Stimme im Saal mündlich abgegeben».',
			'begruendung'
		);
	}
	return grund;
}

/**
 * Ob eine Stimme angenommen wird.
 *
 * Der letzte Punkt ist der wichtige: Ohne sichtbare Frage keine Stimmabgabe.
 * Eine Stimme, die eintrifft, nachdem die Abstimmung geschlossen wurde, wird
 * abgewiesen — auch wenn das Telefon die Frage noch anzeigt, weil die
 * Verbindung hing.
 */
export function pruefeStimmabgabe(lage: {
	durchgangszustand: Durchgangszustand | null;
	versammlungszustand: string;
	istAnwesend: boolean;
}): void {
	if (lage.durchgangszustand === null) {
		throw new FachlicherFehler(
			'keine_abstimmung',
			'Zurzeit ist keine Abstimmung offen.',
			'durchgang'
		);
	}
	if (lage.durchgangszustand !== 'offen' || lage.versammlungszustand !== 'laufend') {
		throw new FachlicherFehler(
			'geschlossen',
			'Diese Abstimmung ist geschlossen. Ihre Stimme konnte nicht mehr entgegengenommen werden — ' +
				'melden Sie sich bei der Sitzungsleitung.',
			'durchgang'
		);
	}
	if (!lage.istAnwesend) {
		throw new FachlicherFehler(
			'nicht_anwesend',
			'Sie sind nicht als anwesend erfasst. Wenden Sie sich an die Sitzungsleitung.',
			'anwesenheit'
		);
	}
}
