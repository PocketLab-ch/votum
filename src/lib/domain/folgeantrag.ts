/**
 * Der Folgeantrag und sein Verhältnis zum Grundantrag (FR-43) — rein.
 *
 * Ein Folgeantrag hält sich im Kern eines angekündigten Antrags: Er ändert den
 * Betrag, teilt die Massnahme, verschiebt den Ausführungstermin (Fachprüfung
 * FP2-6 vom 06.10.2026: nicht das Traktandum, das wäre ein Ordnungsantrag).
 * Dass er zur Abstimmung darf, obwohl er erst im Saal entstand, steht in
 * `domain/abstimmung.ts`.
 *
 * Hier stehen die zwei Zusagen, die daran hängen: Eine **Abweichung** des
 * gewählten Mehrs vom Mehr des Grundantrags wird benannt, und über ihn wird
 * **vor** dem Grundantrag abgestimmt.
 *
 * **Erben tut er nichts mehr** (Produktentscheid 08.10.2026): Bis dahin
 * übernahm der Folgeantrag das Erfordernis des Grundantrags als Vorschlag
 * (FR-43), und damit stand «von Hand gewählt» im Verlauf, wo niemand gewählt
 * hatte. Er bekommt die Herleitung wie ein neu angelegtes Traktandum: über
 * die Wahl im Formular oder den Entscheidbaum; ohne Wahl steht er ohne
 * Erfordernis da.
 *
 * **Gegen die Unterlagen geprüft** (05.08.2026, auf Nachfrage des
 * Auftraggebers). Der SVIT-Kommentar zu Art. 712n (Wermelinger 2023, Rz. 99)
 * trägt unmittelbar:
 *
 *   * «Wurden **Gegenanträge** eingereicht, muss der Vorsitzende die
 *     **Reihenfolge** und den Wortlaut der Beschlüsse festlegen.» — Die
 *     Reihenfolge ist Sache der Sitzungsleitung. Das Werkzeug schlägt sie
 *     deshalb vor und sperrt nichts.
 *   * «Zudem sollte der Vorsitzende im Vorfeld zur Abstimmung das anwendbare
 *     **Quorum mitteilen** (dieses kann nicht verhandelt oder beschlossen
 *     werden, sondern wird durch den Vorsitzenden bestimmt).» — Das
 *     Erfordernis wird gesetzt, nicht ausgehandelt.
 *
 * Dazu Rz. 100: «eine Beschlussfassung mit ungültigem Mehr führt zu einem
 * anfechtbaren Beschluss» — der Grund, warum eine Abweichung vom Erfordernis
 * des Grundantrags benannt und nicht stillschweigend übergangen wird.
 */
import { strenge, type Ergebnistyp } from './regelwerk';
import type { Traktandumart } from './traktanden';
import { FachlicherFehler } from './fehler';
import { massgebenderDerSache, type Durchgang } from './abstimmung';

export type Abweichungsart = 'gleich' | 'strenger' | 'schwaecher' | 'unbestimmt' | 'ohne_vergleich';

export interface Erfordernisabweichung {
	art: Abweichungsart;
	/** Ein Satz für die Sitzungsleitung. Leer, wenn es nichts zu sagen gibt. */
	text: string;
}

/**
 * Wie sich das gewählte Erfordernis zu dem des Grundantrags verhält (FR-43).
 *
 * **Beide Richtungen werden benannt, nicht nur die eine.** Das PRD verlangt den
 * Hinweis, wenn der Folgeantrag ein **strengeres** Erfordernis nach sich zieht.
 * Der gefährlichere Fall ist aber der umgekehrte: Ein Folgeantrag mit
 * **schwächerem** Mehr wäre ein Weg, eine qualifiziert zu beschliessende Sache
 * mit einfacher Mehrheit zu entscheiden — man teilt sie in einen «kleinen»
 * Folgeantrag und beschliesst diesen. Deshalb steht dort eine Warnung.
 *
 * **Gewarnt, nicht gesperrt.** Ob der Folgeantrag den Gegenstand wirklich
 * verschiebt, entscheidet die Sitzungsleitung — sie kennt den Antrag, das
 * Werkzeug kennt nur seinen Typ.
 *
 * **Gesperrt wird dagegen unter der Untergrenze aus der Einladung**
 * (Produktentscheid 06.10.2026, «Ja, dieselbe Untergrenze»;
 * `domain/einladungsmehr.ts`, `verlangeMehrDerEinladungImFolgeantrag`). Nennt
 * die Einladung für das angekündigte Traktandum ein Mehr, lässt die Anwendung
 * für den Folgeantrag im Saal kein milderes zu. Verglichen werden dort Köpfe,
 * Wertquoten und Enthaltungen, nicht der Typ; diese Warnung bleibt für alles
 * darüber.
 */
export function erfordernisabweichung(
	grundantrag: Ergebnistyp | null,
	gewaehlt: Ergebnistyp | null
): Erfordernisabweichung {
	if (!grundantrag || !gewaehlt) {
		return {
			art: 'ohne_vergleich',
			text: ''
		};
	}
	if (grundantrag === gewaehlt) return { art: 'gleich', text: '' };

	const a = strenge(grundantrag);
	const b = strenge(gewaehlt);
	if (a === null || b === null) {
		// Grenzfall oder Reglementsmehr: ohne Rang auf der gesetzlichen Leiter.
		return {
			art: 'unbestimmt',
			text:
				'Das gewählte Erfordernis lässt sich mit dem des Grundantrags nicht vergleichen. ' +
				'Prüfen Sie, ob der Folgeantrag den Beschlussgegenstand verschiebt.'
		};
	}

	if (b > a) {
		return {
			art: 'strenger',
			text:
				'Der Folgeantrag verlangt ein **strengeres** Mehr als der Grundantrag. Das ist ' +
				'zulässig — es heisst, dass er den Beschlussgegenstand erweitert. Halten Sie im ' +
				'Protokoll fest, woraus sich das ergibt.'
		};
	}

	return {
		art: 'schwaecher',
		text:
			'Der Folgeantrag verlangt ein **schwächeres** Mehr als der Grundantrag. Das ist ' +
			'begründungsbedürftig: Ein Antrag im Kern derselben Sache lässt sich nicht dadurch ' +
			'leichter beschliessen, dass er als Folgeantrag gestellt wird. ' +
			// Das Mehr folgt der Art der Massnahme, nicht ihrem Umfang (Fachprüfung
			// 30.09.2026, F-5; Art. 647c und 647d ZGB; Rz. 100 ad Art. 712n).
			'Prüfen Sie, ob er rechtlich in eine andere Art fällt, die ein schwächeres Mehr verlangt, ' +
			'etwa eine notwendige statt einer nützlichen Massnahme. Ein kleinerer Umfang allein ' +
			// «in der Regel»: Bleiben nur eher unbedeutende Kosten, ist es gewöhnliche
			// Verwaltung (Fachprüfung Runde 2, R2-3; Rz. 107 ad Art. 712a).
			'genügt in der Regel nicht, anders, wenn nur noch eher unbedeutende Kosten bleiben ' +
			'(gewöhnliche Verwaltung).'
	};
}

export interface Antragsknoten {
	id: string;
	nummer: string;
	titel: string;
	/**
	 * Ob über ihn abgestimmt wird.
	 *
	 * **Pflichtangabe seit dem 08.09.2026** (Code-Review). Eine Kenntnisnahme
	 * kann als Folgeantrag aufgenommen werden, lässt sich danach aber weder
	 * abstimmen noch zurückziehen. Als «offen» gezählt sperrte sie den Rückzug
	 * des Grundantrags dauerhaft, und die Absage nannte zwei Auswege, die es für
	 * sie beide nicht gibt.
	 */
	art: Traktandumart;
	/**
	 * Ob ein Mehrheitserfordernis gesetzt ist.
	 *
	 * **Pflichtangabe seit dem 06.10.2026** (Laienprüfung R2-1): Ein Folgeantrag,
	 * dessen Mehr an der Untergrenze aus der Einladung abgewiesen wurde, steht
	 * ohne Mehr in der Liste. «Über ihn wird zuerst abgestimmt» schickte die
	 * Leitung dann in eine Abstimmung, die sich nicht öffnen lässt.
	 */
	hatErfordernis: boolean;
	grundantragId: string | null;
	/** Ob darüber bereits abgestimmt wurde (nicht überholt). */
	entschieden: boolean;
	zurueckgezogen: boolean;
}

/** Woran sich beurteilt, ob ein Traktandum einen Folgeantrag tragen kann. */
export interface Grundantragslage {
	art: Traktandumart;
	/** Ob der Antrag selbst erst während der Versammlung aufgenommen wurde. */
	spontan: boolean;
	/**
	 * Ob über ihn bereits abgestimmt wurde: der **massgebende** Durchgang ist
	 * geschlossen. Nicht «es gab je einen» — ein überholter zählt nicht.
	 */
	entschieden: boolean;
	/** Ob über ihn gerade abgestimmt wird. */
	durchgangOffen: boolean;
	/** Ob er zurückgezogen wurde. */
	zurueckgezogen: boolean;
	/**
	 * Ob auf ihn ein angenommener Rückkommensantrag wartet, der seinen einen
	 * Durchgang noch nicht getragen hat. Dann darf ein Folgeantrag an die Stelle
	 * des alten Antrags treten (Produktentscheid 30.09.2026). Fehlt die Angabe,
	 * gilt nein: Ein Weg, der nicht nachgesehen hat, lässt nichts zu.
	 */
	rueckkommenOffen?: boolean;
}

/** Warum an diesen Antrag kein Folgeantrag gehängt werden kann. */
export interface Grundantragshindernis {
	/** Die Kennung des fachlichen Fehlers, den der Server daraus wirft. */
	code: string;
	/** Der Satz für die Sitzungsleitung — er nennt den Weg, den es gibt. */
	meldung: string;
}

/**
 * Was einen Antrag als Grundantrag ausschliesst — oder `null`, wenn nichts.
 *
 * **Fünf Bedingungen, und die letzten drei fehlten bis zum 07.09.2026.** Die
 * ersten zwei prüfte der Server seit je: Zu einer Kenntnisnahme gibt es keinen
 * Antrag, in dessen Kern etwas liegen könnte, und ein selbst erst im Saal
 * aufgenommener Antrag trägt die Ankündigung nicht, auf die sich der
 * Folgeantrag stützt.
 *
 * **Die drei neuen decken den Widerspruch zu «Jetzt möglich».** Dort fällt
 * «Gegenantrag» weg, sobald über die Sache entschieden, sie zurückgezogen oder
 * ein Durchgang offen ist (`domain/eingriffe.ts`, `antrag && offen &&
 * !durchgangOffen`) — die Auswahl im Aufnahmeformular bot dieselben Anträge
 * weiter an, und der Server nahm sie entgegen. Die Anwendung sagte an zwei
 * Stellen Gegensätzliches über dieselbe Frage.
 *
 * Sachlich hängen alle drei am selben Satz: Über den Folgeantrag wird **vor**
 * dem Grundantrag abgestimmt. Ist der Grundantrag entschieden, gibt es dieses
 * «vorher» nicht mehr — der Weg dorthin heisst Rückkommensantrag und braucht
 * einen eigenen Beschluss der Versammlung. Läuft der Durchgang gerade, wäre der
 * Folgeantrag in der Sekunde des Schliessens genau dieser Fall. Ist der
 * Grundantrag zurückgezogen, gibt es keinen Kern, in dem sich etwas halten
 * könnte.
 *
 * **Die Meldungen stehen hier und nicht im Server.** Eine Regel, die an drei
 * Stellen gelesen wird, deren Absage aber an einer vierten formuliert ist,
 * läuft auseinander, sobald jemand nur eine davon anfasst.
 */
export function hindernisAlsGrundantrag(lage: Grundantragslage): Grundantragshindernis | null {
	if (lage.art !== 'abstimmung') {
		return {
			code: 'grundantrag_ohne_beschluss',
			meldung:
				'Der gewählte Grundantrag ist eine Kenntnisnahme. Dazu gibt es keinen Antrag, in ' +
				'dessen Kern ein Folgeantrag liegen könnte.'
		};
	}
	if (lage.spontan) {
		return {
			code: 'grundantrag_nicht_angekuendigt',
			meldung:
				'Der gewählte Grundantrag wurde selbst erst während der Versammlung aufgenommen. ' +
				'Ein Folgeantrag stützt sich auf einen **angekündigten** Antrag — hängen Sie ihn ' +
				'an diesen.'
		};
	}
	if (lage.zurueckgezogen) {
		return {
			code: 'grundantrag_zurueckgezogen',
			meldung:
				'Der gewählte Grundantrag ist zurückgezogen. Damit gibt es keinen Kern mehr, in ' +
				'dem sich ein Folgeantrag halten könnte — nehmen Sie das Geschäft als neues auf, ' +
				'oder nehmen Sie den Rückzug zurück.'
		};
	}
	if (lage.durchgangOffen) {
		return {
			code: 'grundantrag_in_abstimmung',
			meldung:
				'Über den gewählten Grundantrag wird gerade abgestimmt. Ein Folgeantrag wird **vor** ' +
				'dem Grundantrag behandelt — schliessen Sie den Durchgang und entscheiden Sie dann, ' +
				'ob die Sache über einen Rückkommensantrag nochmals aufgerollt wird.'
		};
	}
	/*
	 * **Nach einem angenommenen Rückkommen gibt es das «vorher» wieder**
	 * (Produktentscheid 30.09.2026): Statt des alten Antrags darf ein
	 * Folgeantrag zur Abstimmung kommen. Die Meldung nennt deshalb die
	 * Reihenfolge, in der das geht, statt nur auf das Rückkommen zu verweisen.
	 */
	if (lage.entschieden && !lage.rueckkommenOffen) {
		return {
			code: 'grundantrag_entschieden',
			meldung:
				'Über den gewählten Grundantrag ist bereits abgestimmt. Ein Folgeantrag kommt danach ' +
				'nur noch über ein Rückkommen zur Abstimmung: Es braucht einen angenommenen ' +
				'Rückkommensantrag auf den Grundantrag, der noch keinen Durchgang getragen hat. Liegt ' +
				'er vor, nehmen Sie den Folgeantrag auf; er tritt dann an die Stelle des alten Antrags.'
		};
	}
	return null;
}

/** Der Stand des Rückkommens auf den Grundantrag, wie der Server ihn liest. */
export interface RueckkommenAufGrundantrag {
	angenommen: boolean;
	/** Ob es seinen einen Durchgang schon getragen hat (`verbrauchtDenRueckkommensantrag`). */
	verbraucht: boolean;
}

/**
 * Ob über einen Folgeantrag abgestimmt werden darf, dessen Grundantrag schon
 * entschieden ist. Wirft sonst, mit dem Weg, den es gibt.
 *
 * **Die Lücke, die das schliesst** (Plan Folgeantrag nach Rückkommen, Ist 3).
 * Bis zum 30.09.2026 prüfte das Eröffnen beim Folgeantrag nur, ob er an einem
 * angekündigten Antrag hängt. Ein vor der ersten Abstimmung aufgenommener
 * Folgeantrag liess sich deshalb auch **nach** dem Grundantrag abstimmen, ohne
 * Rückkommen, und dann standen zwei Beschlüsse zur selben Sache nebeneinander.
 *
 * **Das Rückkommen auf den Grundantrag trägt genau einen Durchgang**
 * (Produktentscheid 30.09.2026): über den alten Antrag oder über einen
 * Folgeantrag, die Leitung wählt. Ist er verbraucht, sperrt das auch jeden
 * weiteren Folgeantrag.
 *
 * `eigenerDurchgang`: Über den Folgeantrag selbst wurde schon abgestimmt, vor
 * dem Grundantrag, und dieser Durchgang ist nicht der, der den Grundantrag
 * ersetzt hat. Ein zweiter Durchgang daneben liesse zwei geltende Durchgänge am
 * selben Antrag stehen; der Weg ist ein neuer Folgeantrag mit demselben
 * Wortlaut.
 */
export function verlangeFolgeantragNachRueckkommen(
	rueckkommen: RueckkommenAufGrundantrag | null,
	grundantragstitel: string,
	eigenerDurchgang: boolean
): void {
	/*
	 * **Zuerst der eigene Durchgang** (Codeprüfung B2a, N2). Stand er zuletzt,
	 * hiess es bei einem vor dem Grundantrag abgestimmten Folgeantrag erst
	 * «Rückkommen beschliessen, dann tritt er an die Stelle», und nach dem
	 * Rückkommen kam die zweite Absage, er brauche einen neuen Folgeantrag. Den
	 * Weg nennt so die erste.
	 */
	if (eigenerDurchgang) {
		throw new FachlicherFehler(
			'folgeantrag_schon_abgestimmt',
			'Über diesen Folgeantrag ist schon vor dem Grundantrag abgestimmt worden. Soll er nach ' +
				'dem Rückkommen an die Stelle des alten Antrags treten, nehmen Sie ihn als neuen ' +
				'Folgeantrag auf.',
			'zustand'
		);
	}
	if (!rueckkommen) {
		throw new FachlicherFehler(
			'folgeantrag_ohne_rueckkommen',
			`Über den Grundantrag «${grundantragstitel}» ist bereits abgestimmt. Ein Folgeantrag ` +
				'kommt danach nur zur Abstimmung, wenn die Versammlung das Rückkommen auf den ' +
				'Grundantrag beschlossen hat; er tritt dann an die Stelle des alten Antrags.',
			'zustand'
		);
	}
	if (!rueckkommen.angenommen) {
		throw new FachlicherFehler(
			'rueckkommen_nicht_angenommen',
			`Über den Folgeantrag wird erst abgestimmt, wenn die Versammlung den Rückkommensantrag ` +
				`zu «${grundantragstitel}» angenommen hat. Bis dahin gilt der frühere Beschluss; ist der ` +
				'Rückkommensantrag abgelehnt, braucht es einen neuen.',
			'zustand'
		);
	}
	if (rueckkommen.verbraucht) {
		throw new FachlicherFehler(
			'rueckkommen_verbraucht',
			`Das Rückkommen auf «${grundantragstitel}» hat seinen einen Durchgang schon getragen. ` +
				'Ein weiterer Durchgang, auch über einen Folgeantrag, braucht einen neuen ' +
				'Rückkommensantrag.',
			'zustand'
		);
	}
}

/**
 * Warum sich auf einen Folgeantrag nicht zurückkommen lässt, oder `null`.
 *
 * **Zurückgekommen wird auf die Sache, und die ist der Grundantrag.** Ist er
 * entschieden, trägt nur ein Rückkommen auf ihn den nächsten Durchgang, auch
 * den über einen Folgeantrag (`verlangeFolgeantragNachRueckkommen`). Ein
 * Rückkommensantrag auf den Folgeantrag führte dann ins Leere: Die Versammlung
 * nähme ihn an, und eröffnen liesse sich danach nichts. Das gilt auch, wenn der
 * Beschluss zum Folgeantrag den des Grundantrags ersetzt hat.
 *
 * Ist der Grundantrag noch nicht entschieden, bleibt der Weg wie bisher: Auf
 * einen vorher abgestimmten Folgeantrag lässt sich zurückkommen.
 */
export function hindernisRueckkommenAufFolgeantrag(
	folgeantrag: { nummer: string; titel: string },
	grundantrag: { nummer: string; titel: string; entschieden: boolean }
): Grundantragshindernis | null {
	if (!grundantrag.entschieden) return null;
	return {
		code: 'rueckkommen_auf_grundantrag',
		meldung:
			`${folgeantrag.nummer} «${folgeantrag.titel}» ist ein Folgeantrag zu ${grundantrag.nummer} ` +
			// «in dieser Anwendung»: eine Regel des Hauses, kein Rechtssatz
			// (Fachprüfung 30.09.2026, 6b).
			`«${grundantrag.titel}», und darüber ist abgestimmt. Zurückkommen lässt sich in dieser ` +
			'Anwendung dann nur auf den Grundantrag; ist das Rückkommen angenommen, kann auch ein ' +
			'Folgeantrag an die Stelle des alten Antrags treten.'
	};
}

/**
 * Wo ein Folgeantrag gegenüber seinem Grundantrag steht, gerechnet aus allen
 * Durchgängen der Versammlung: dieselben zwei Angaben, die der Server beim
 * Eröffnen liest (`rueckkommenZuEroeffnen`).
 *
 * `entschieden`: Der massgebende Durchgang der Sache ist geschlossen und kein
 * «kein Beschluss» nach einem Weggang (Migration 128); nach einer Ersetzung
 * über einen Folgeantrag ist es dessen Durchgang (`massgebenderDerSache`).
 * `eigenerDurchgang`: Über den Folgeantrag gibt es einen geltenden Durchgang,
 * der nicht der massgebende der Sache ist, abgestimmt also vor dem
 * Grundantrag.
 *
 * **Warum im Kern.** Die Leitung eines Hauses und die Steuerung des Abends
 * stellen dieselbe Frage; rechneten sie je für sich, böte die eine einen Knopf
 * an, den die andere und der Server abweisen.
 */
export function lageZumGrundantrag<T extends Durchgang>(
	alle: T[],
	folgeantragId: string,
	grundantragId: string,
	ohneBeschlussNachWeggang: (d: T) => boolean
): { entschieden: boolean; eigenerDurchgang: boolean; geltend: T | null } {
	const sache = massgebenderDerSache(alle, grundantragId);
	return {
		entschieden: sache != null && sache.zustand === 'geschlossen' && !ohneBeschlussNachWeggang(sache),
		eigenerDurchgang: alle.some(
			(d) => d.traktandumId === folgeantragId && !d.ueberholtAm && d.id !== sache?.id
		),
		/** Der geltende Durchgang der Sache, für die Auskunft (`Rueckkommenslage`). */
		geltend: sache
	};
}

/** Ob an dieses Traktandum jetzt ein Folgeantrag gehängt werden kann. */
export function taugtAlsGrundantrag(lage: Grundantragslage): boolean {
	return hindernisAlsGrundantrag(lage) === null;
}

/**
 * Über Folgeanträge wird **vor** dem Grundantrag abgestimmt (FR-43).
 *
 * **Warum diese Reihenfolge.** Der Folgeantrag ändert, worüber am Ende
 * abzustimmen ist. Wird zuerst der Grundantrag beschlossen, ist die Sache
 * entschieden, und der Folgeantrag liefe ins Leere — oder man müsste
 * zurückkommen, was einen eigenen Beschluss braucht. Umgekehrt kostet es
 * nichts: Fällt der Folgeantrag durch, wird über den Grundantrag abgestimmt wie
 * geplant.
 *
 * **Ein Vorschlag, keine Sperre.** Die Sitzungsleitung führt die Versammlung;
 * sie kann abweichen, etwa wenn der Folgeantrag zurückgezogen wurde oder die
 * Versammlung zuerst die Grundsatzfrage klären will.
 */
export function offeneFolgeantraege(traktanden: Antragsknoten[], grundantragId: string): Antragsknoten[] {
	return traktanden.filter(
		(t) =>
			t.grundantragId === grundantragId &&
			// **Nur was überhaupt entschieden werden kann.** Eine Kenntnisnahme
			// unter einem Antrag wird nicht abgestimmt; sie steht weder der
			// Reihenfolge noch dem Rückzug im Weg (Code-Review 08.09.2026).
			t.art === 'abstimmung' &&
			!t.entschieden &&
			!t.zurueckgezogen
	);
}

/**
 * Warum sich dieser Grundantrag nicht zurückziehen lässt.
 *
 * **Der Anlass** (Bedienbarkeitsprüfung 05.09.2026, als offener Punkt notiert).
 * Ein Grundantrag liess sich zurückziehen, während ein Folgeantrag daran hing.
 * Danach stand im Saal ein Änderungsantrag zu einem Antrag, den es nicht mehr
 * gibt: Die Versammlung stimmt über eine Änderung an nichts ab, und was
 * herauskommt, lässt sich nicht ins Protokoll schreiben.
 *
 * **Warum eine Absage und keine Mitnahme.** Die Folgeanträge einfach mit
 * zurückzuziehen wäre bequem und falsch: Ein Rückzug trägt einen Grund und
 * einen Namen, und beides hat für den Folgeantrag niemand gesagt. Wer ihn
 * gestellt hat, darf ihn selbst zurückziehen oder darüber abstimmen lassen.
 * Die Absage nennt deshalb, was zuerst zu erledigen ist.
 *
 * Die Gegenrichtung steht in `hindernisAlsGrundantrag`: Dort geht es darum, ob
 * an einen Antrag überhaupt ein Folgeantrag gehängt werden kann.
 */
export function hindernisFuerRueckzug(offene: Antragsknoten[]): Grundantragshindernis | null {
	if (offene.length === 0) return null;
	const namen = offene.map((t) => `${t.nummer} ${t.titel}`).join(', ');
	return {
		code: 'folgeantrag_offen',
		meldung:
			offene.length === 1
				? `An diesem Antrag hängt noch ein Folgeantrag: ${namen}. Erledigen Sie ihn zuerst — ` +
					'durch Abstimmung oder durch Rückzug —, sonst bezöge er sich auf einen Antrag, den es ' +
					'nicht mehr gibt.'
				: `An diesem Antrag hängen noch ${offene.length} Folgeanträge: ${namen}. Erledigen Sie sie ` +
					'zuerst — durch Abstimmung oder durch Rückzug —, sonst bezögen sie sich auf einen ' +
					'Antrag, den es nicht mehr gibt.'
	};
}

/**
 * Der Satz, der die Reihenfolge vorschlägt. Leer, wenn nichts ansteht.
 *
 * Er steht in der Zeile des Grundantrags, bevor über ihn abgestimmt wird.
 * Nach dem Eröffnen gilt `reihenfolgehinweisNachEroeffnen`.
 *
 * **Ohne Mehr nennt er das Mehr zuerst** (Laienprüfung R2-1, 06.10.2026). Ein
 * Folgeantrag ohne Mehrheitserfordernis lässt sich nicht abstimmen; steht er
 * so da, weil sein Mehr unter der Untergrenze aus der Einladung lag, geht er
 * an eine weitere Versammlung, wenn die Antragstellerin ihn zurückzieht oder
 * die Versammlung ihn verschiebt, festgehalten mit «Antrag zurückziehen» in
 * seiner Zeile (`milderImFolgeantrag`). Geändert nach Laien- und Fachprüfung
 * Runde 3 vom 06.10.2026
 * (`quellen/pruefung/zu-pruefen-2026-10-06-votum-einladungsmehr-folgeantrag-runde3.md`);
 * die vierte Prüfung folgt.
 */
export function reihenfolgehinweis(offene: Antragsknoten[]): string {
	if (offene.length === 0) return '';
	const liste = (l: Antragsknoten[]) => l.map((t) => `${t.nummer} ${t.titel}`).join(', ');
	const namen = liste(offene);
	const ohne = offene.filter((t) => !t.hatErfordernis);
	if (ohne.length === 0) {
		return offene.length === 1
			? `Zu diesem Antrag steht ein Folgeantrag offen: ${namen}. Über ihn wird zuerst abgestimmt.`
			: `Zu diesem Antrag stehen ${offene.length} Folgeanträge offen: ${namen}. Über sie wird zuerst abgestimmt.`;
	}
	// Runde 4 vom 06.10.2026: der Ort auch beim aufgerufenen Antrag. In eigene
	// Sätze geteilt, damit keiner über 180 Zeichen läuft (Codeprüfung N1).
	const weg = (einer: boolean) =>
		einer
			? ' Geht er stattdessen an eine weitere Versammlung, weil die Antragstellerin ihn ' +
				'zurückzieht oder die Versammlung ihn verschiebt, halten Sie das mit «Antrag ' +
				'zurückziehen» fest. Ist der Folgeantrag gerade aufgerufen, steht das unter «Jetzt ' +
				'möglich» bei «Zurückziehen».'
			: ' Gehen sie stattdessen an eine weitere Versammlung, weil die Antragsteller sie ' +
				'zurückziehen oder die Versammlung sie verschiebt, halten Sie das mit «Antrag ' +
				'zurückziehen» fest. Ist einer davon gerade aufgerufen, steht das unter «Jetzt möglich» ' +
				'bei «Zurückziehen».';
	if (offene.length === 1) {
		return (
			`Zu diesem Antrag steht ein Folgeantrag ohne Mehrheitserfordernis offen: ${namen}. ` +
			'Setzen Sie sein Mehr und lassen Sie zuerst über ihn abstimmen.' +
			weg(true)
		);
	}
	if (ohne.length === offene.length) {
		return (
			`Zu diesem Antrag stehen ${offene.length} Folgeanträge ohne Mehrheitserfordernis offen: ` +
			`${namen}. Setzen Sie ihr Mehr und lassen Sie zuerst über sie abstimmen.` +
			weg(false)
		);
	}
	const einer = ohne.length === 1;
	return (
		`Zu diesem Antrag stehen ${offene.length} Folgeanträge offen: ${namen}. Über sie wird ` +
		`zuerst abgestimmt. Noch ohne Mehrheitserfordernis ${einer ? 'ist' : 'sind'}: ` +
		`${liste(ohne)}. Setzen Sie ${einer ? 'sein' : 'ihr'} Mehr.` +
		weg(einer)
	);
}

/**
 * Der Satz nach dem Eröffnen des Grundantrags, wenn Folgeanträge offen sind.
 *
 * **Er verlangt nichts, was im offenen Durchgang nicht geht** (Laienprüfung
 * R3-6 a, Codeprüfung N5, Runde 3 vom 06.10.2026). Vorher stand hier derselbe
 * Satz wie in der Zeile, «Über ihn wird zuerst abgestimmt», während die
 * Abstimmung über den Grundantrag schon lief. Was nachher gilt, steht in
 * `rueckkommenFuerEroeffnung` (`server/abstimmung.ts`): Ist über den
 * Grundantrag abgestimmt, öffnet der Folgeantrag nur noch unter einem
 * angenommenen Rückkommen (Produktentscheid 30.09.2026). Seit Runde 4
 * (Codeprüfung M2, Fachprüfung FP4-7, Laienprüfung R4-5 a, 06.10.2026)
 * als Regel der Anwendung benannt, mit dem Mehr des Rückkommens und dem
 * Weg, wenn der Folgeantrag an eine weitere Versammlung geht.
 */
// Mehrzahl: Ein Rückkommen trägt eine einzige Abstimmung (`rueckkommen_verbraucht`,
// Fachprüfung, Nachtrag zu Runde 5, 06.10.2026); der Satz darf nicht ein Rückkommen für
// alle versprechen.
export function reihenfolgehinweisNachEroeffnen(offene: Antragsknoten[]): string {
	if (offene.length === 0) return '';
	const namen = offene.map((t) => `${t.nummer} ${t.titel}`).join(', ');
	const rueckkommen =
		'nur nach einem angenommenen Rückkommen zur Abstimmung zu. Nach einer Annahme verlangt die ' +
		'Anwendung für das Rückkommen dasselbe Mehr wie für den Beschluss.';
	return offene.length === 1
		? `Über den Folgeantrag ${namen} wurde nicht zuerst abgestimmt. Wird der Grundantrag in ` +
				`dieser Abstimmung entschieden, lässt die Anwendung den Folgeantrag danach ${rueckkommen} ` +
				'Die Antragstellerin kann den Folgeantrag zurückziehen oder die Versammlung ihn verschieben, ' +
				'damit er ' +
				'an eine weitere Versammlung geht. Halten Sie das danach mit «Antrag zurückziehen» in ' +
				'seiner Zeile fest; sonst steht er im Protokoll als nicht abgestimmt.'
		: `Über die Folgeanträge ${namen} wurde nicht zuerst abgestimmt. Wird der Grundantrag in ` +
				'dieser Abstimmung entschieden, lässt die Anwendung die Folgeanträge danach nur je über ein ' +
				'angenommenes Rückkommen zur Abstimmung zu. Jedes trägt eine einzige Abstimmung, über einen ' +
				'der Folgeanträge oder den bisherigen Antrag. Nach einer ' +
				'Annahme verlangt die Anwendung für das Rückkommen dasselbe Mehr wie für den Beschluss. ' +
				'Die Antragsteller können sie zurückziehen oder die Versammlung sie verschieben, damit ' +
				'sie an eine weitere Versammlung gehen. Halten Sie das danach mit «Antrag zurückziehen» ' +
				'in ihrer Zeile fest; sonst stehen sie im Protokoll als nicht abgestimmt.';
}


/**
 * Mehrere Namen zu einem Satz — «Aebi, Bucher & Christen».
 *
 * **Wozu er da ist** (21.08.2026): Der Antragstext eines Gegenantrags soll frei
 * von Personendaten bleiben, damit er an ein Sprachmodell gehen kann. Wer den
 * Antrag stellt, steht deshalb in einem eigenen Feld — und dieses Feld trägt
 * einen Satz, keine Kennungsliste, weil er so ins Protokoll geht.
 *
 * Das kaufmännische Und vor dem letzten Namen ist kein Zierat: «Aebi, Bucher,
 * Christen» liest sich wie eine unfertige Aufzählung, «Aebi, Bucher &
 * Christen» wie eine abgeschlossene.
 */
export function namenSatz(namen: string[]): string {
	const echte = namen.map((n) => n.trim()).filter((n) => n.length > 0);
	if (echte.length === 0) return '';
	if (echte.length === 1) return echte[0];
	return `${echte.slice(0, -1).join(', ')} & ${echte[echte.length - 1]}`;
}

/** Eine betroffene Partei, wie die Leitungsseite sie kennt. */
export interface BetroffenePartei {
	parteiId: string;
	name: string;
}

/**
 * Ob ein Traktandum nach `betroffenenabweichung` gefragt wird (Block A3b).
 *
 * Nur ein Folgeantrag zur Abstimmung, der an einem Grundantrag hängt: Ein
 * Rückkommensantrag hängt ebenfalls unter seinem Traktandum, trifft aber
 * niemanden. Und nur, wo das Erfordernis eine Zustimmung verlangt (`form`
 * gesetzt): Unter «alle ausser den Betroffenen» (Ausschlussklage) hiesse eine
 * andere Auswahl, dass jemand wieder mitzählt, nicht dass es seine Zustimmung
 * braucht (Codeprüfung A3b).
 *
 * Im Kern, weil Haus und Abend dieselbe Frage stellen; bis zum 26.09.2026 stand
 * die Bedingung in beiden Leitungsseiten und war durch keine Probe gedeckt.
 */
export function fragtNachBetroffenenabweichung(t: {
	spontanart: string | null | undefined;
	grundantragId: string | null | undefined;
	art: string;
	form: 'im_saal_oder_vorab' | 'nachher' | null;
}): boolean {
	return (
		t.spontanart === 'folgeantrag' && Boolean(t.grundantragId) && t.art === 'abstimmung' && t.form !== null
	);
}

/**
 * Der Hinweis, wenn ein Folgeantrag andere Eigentümer trifft als sein
 * Grundantrag (Block A3b, 26.09.2026). `null`, wenn die Mengen gleich sind.
 *
 * **Wer betroffen ist, folgt aus dem Inhalt des Antrags**, nicht aus einer
 * Bezeichnung vor der Versammlung (`quellen`, Frage 46). Die Betroffenen des
 * Grundantrags stehen deshalb beim Aufnehmen nur als Vorschlag im Formular.
 * Weicht die Leitung davon ab, ist das kein Fehler, aber ein Anlass:
 *
 *   - **Neu betroffen:** Die Ankündigung soll niemanden überraschen
 *     (BGer 5A_760/2011 E. 3.2.3.2). Ein Folgeantrag, der einen nicht
 *     angekündigten Eigentümer trifft, dürfte für ihn den Gegenstand
 *     verlassen; der Beschluss ist dann anfechtbar, nicht nichtig, und die
 *     Rüge gehört vor die Beschlussfassung (BGE 136 III 174 E. 5.1).
 *   Das ganze Traktandum verschiebt nicht die Leitung, sondern die
 *   Versammlung auf Ordnungsantrag (Rz. 98a ad Art. 712n, Fachprüfung A3b,
 *   Runde 3); den Folgeantrag zurückzustellen liegt in der Verfahrensleitung
 *   (Rz. 99).
 *   - **Nicht mehr betroffen:** kein Mangel der Ankündigung, aber eine Frage
 *     an die Leitung. Trifft der Folgeantrag die Partei doch, braucht es auch
 *     ihre Zustimmung, und die Anwendung fragte nicht mehr danach.
 *
 * **Keine Sperre, keine Bestätigung** (Plan, Abschnitt 6): Ob der Folgeantrag
 * im Kern liegt, beurteilt die Sitzungsleitung, wie beim Mehrheitserfordernis
 * (`erfordernisabweichung`).
 *
 * Nur für die Leitungsseiten, mit Namen; das Protokoll trägt ihn nicht.
 */
export function betroffenenabweichung(
	grundantrag: BetroffenePartei[],
	folgeantrag: BetroffenePartei[]
): string | null {
	const imGrund = new Set(grundantrag.map((b) => b.parteiId));
	const imFolge = new Set(folgeantrag.map((b) => b.parteiId));
	const neu = folgeantrag.filter((b) => !imGrund.has(b.parteiId)).map((b) => `«${b.name}»`);
	const weg = grundantrag.filter((b) => !imFolge.has(b.parteiId)).map((b) => `«${b.name}»`);
	if (neu.length === 0 && weg.length === 0) return null;

	const saetze = ['Dieser Folgeantrag trifft andere Eigentümer als der angekündigte Antrag.'];
	if (neu.length > 0) {
		/*
		 * **«an eine weitere Versammlung gehen» statt «verschieben»** (Laienprüfung
		 * R3-7 a, Runde 3 vom 06.10.2026,
		 * `quellen/pruefung/zu-pruefen-2026-10-06-votum-einladungsmehr-folgeantrag-runde3.md`;
		 * die vierte Prüfung folgt): Verschieben kann nur die Versammlung, und
		 * zurückziehen nur die Antragstellerin.
		 *
		 * **Der erste Schritt ist die Frage nach der Zustimmung** (Fachprüfung
		 * A3b): Wer dem Beschluss zustimmt, kann ihn nicht anfechten
		 * (BGE 136 III 174, Regeste und E. 5.1.2). Die Rüge ist eine Obliegenheit
		 * der Anwesenden, keine Gültigkeitsvoraussetzung (Rz. 40a, 69a ad
		 * Art. 712n); wer nicht im Saal war, konnte nicht rügen. «Eine Rüge muss
		 * vor der Abstimmung erhoben werden» ohne Handelnden las die Leitung als
		 * «niemand hat gerügt, also ist der Beschluss sicher».
		 */
		saetze.push(
			`Neu betroffen: ${neu.join(', ')}. Wer davon erst im Saal erfährt, konnte sich ` +
				'nicht vorbereiten; das kann den Beschluss anfechtbar machen. Fragen Sie anwesende ' +
				'neu Betroffene, ob sie zustimmen, und halten Sie die Antwort im Protokoll fest: ' +
				'Wer dem Beschluss zustimmt, kann ihn nicht anfechten. Ohne ihre Zustimmung kommt ' +
				'die Änderung ohnehin nicht zustande; die Auswertung weist das aus. Rügt jemand im ' +
				/*
				 * **Zuerst festhalten, dann entscheiden** (H8, Laienprüfung R4; bis
				 * dahin stand «halten Sie die Rüge im Protokoll fest» am Schluss und
				 * las sich wie ein Teil des letzten Wegs). Seit H8 auf das Feld, das
				 * die Rüge auch ins Protokoll bringt, das des Hauses und das gemeinsame
				 * eines Abends (Fachprüfung R4-a, R4-b): Das Protokoll geht an alle
				 * Eigentümer. Der Ort ist die Leitungsseite des Hauses, auch am
				 * gemeinsamen Abend; die Abendseite hat das Feld nicht (Codeprüfung H8,
				 * M2).
				 */
				'Saal die fehlende Ankündigung, halten Sie die Rüge zuerst fest: auf der ' +
				'Leitungsseite des Hauses beim Traktandum unter «Rüge festhalten». Sie kommt damit ' +
				'auch in den Protokollentwurf. Lassen Sie dann nur über den angekündigten Antrag ' +
				'abstimmen oder lassen den Folgeantrag an eine weitere Versammlung gehen. Das geht, ' +
				'wenn die Antragstellerin ihn zurückzieht oder die Versammlung ihn verschiebt. Halten ' +
				'Sie das unter «Jetzt möglich» bei «Zurückziehen» fest, mit dem Grund, was geschah. ' +
				'Oder Sie ' +
				'lassen die Versammlung darüber abstimmen, das ganze Traktandum zu verschieben. ' +
				'Wer nicht anwesend war, konnte nicht rügen und kann weiterhin anfechten.'
		);
	}
	if (weg.length > 0) {
		saetze.push(
			`Nicht mehr betroffen: ${weg.join(', ')}. Prüfen Sie, ob der Folgeantrag ` +
				`${weg.length === 1 ? 'diese Partei' : 'diese Parteien'} wirklich nicht trifft; ` +
				'sonst braucht es auch ihre Zustimmung.'
		);
	}
	return saetze.join(' ');
}
