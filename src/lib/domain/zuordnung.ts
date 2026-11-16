/**
 * Wann eine Versammlung zu einer gemeinsamen Versammlung dazugehören darf (rein).
 *
 * **Sprache.** Was im Datenmodell `meeting_day` heisst, heisst an der Oberfläche
 * **gemeinsame Versammlung** — mehrere Gemeinschaften, ein Tag, ein Ort, ein
 * Einlass. Nicht «Abend»: Sie kann am Vormittag stattfinden, und der Benutzer
 * denkt in Versammlungen, nicht in Tageszeiten (Produktentscheid 11.08.2026).
 *
 * **Eine Gemeinschaft tagt höchstens einmal mit.** Das ist keine Regel dieser
 * Datei, sondern eine Schranke der Datenbank (`meeting_tag_je_gemeinschaft`,
 * Migration 028): Zwei Versammlungen derselben Gemeinschaft wären zwei
 * Beschlussfähigkeiten und zwei Protokolle für dieselbe Sache. Die Prüfung hier
 * sagt es **vorher** und nennt den Ausweg, statt die Schranke als 500er auf den
 * Benutzer fallen zu lassen.
 *
 * Gefragt wurde am 11.08.2026, ob sich das mit einer Bestätigung übergehen
 * lässt. Zwei Gründe sprechen dagegen, und beide sind älter als die Frage:
 *
 *   * Die Schranke steht in der Datenbank und wird von Tafel, Einlass und
 *     Weisungen vorausgesetzt — sie zeigen je Gemeinschaft **eine** Zeile.
 *   * Der Fall, an den man dabei denkt, ist die Zweitversammlung. Die darf nach
 *     ZGB Art. 712p Abs. 2 erst elf Tage nach der ersten stattfinden (die Frist
 *     von zehn Tagen beginnt am Tag danach, Rz. 41 ad Art. 712p), also gerade
 *     **nicht** am selben Tag.
 *
 * Was dagegen sehr wohl geht und vorher **still** geschah: eine Versammlung aus
 * einer anderen gemeinsamen herausnehmen. Das braucht eine Bestätigung — sonst
 * fehlt sie im anderen Saal, und niemand hat es gesehen.
 *
 * Rein: hinein geht die Lage, heraus kommt der Befund.
 */
import { zustandsname, type Versammlungsart, type Versammlungszustand } from './versammlung';
import type { Versammlungsstufe } from './beschlussfaehigkeit';

/** Eine Versammlung, so weit die Prüfung sie kennen muss. */
export interface Zuordnungskandidat {
	id: string;
	art: Versammlungsart;
	stufe: Versammlungsstufe;
	datum: string;
}

export interface Aufnahmelage {
	/** Die Versammlung, die aufgenommen werden soll. */
	versammlung: Zuordnungskandidat & {
		stwegId: string;
		gemeinschaft: string;
		ort: string;
		/**
		 * Ihr Zustand — er entscheidet, ob die Vorgaben des Abends greifen.
		 *
		 * Ab der Freigabe steht Tag und Ort in versandten Einladungen. Sie dort
		 * zu überschreiben hiesse, die Einladung zur Lüge zu machen; solche
		 * Versammlungen bleiben stehen und werden **genannt**.
		 */
		zustand: Versammlungszustand;
		/** Zu welcher gemeinsamen Versammlung sie heute gehört, wenn zu einer. */
		gehoertZu: { id: string; bezeichnung: string } | null;
	};
	/** Die gemeinsame Versammlung, in die sie soll. */
	ziel: { id: string; datum: string; ort: string };
	/** Was dort schon steht — nur die Versammlungen derselben Gemeinschaft zählen. */
	schonDrin: Zuordnungskandidat[];
}

export interface Aufnahmebefund {
	erlaubt: boolean;
	/**
	 * Warum es nicht geht. Nur bei `erlaubt: false`, und dann immer — eine
	 * Absage ohne Grund ist eine Sackgasse.
	 */
	grund?: string;
	/**
	 * Was der Benutzer bestätigen muss, bevor es geschieht. Leer, wenn nichts
	 * Überraschendes passiert.
	 */
	bestaetigung?: string;
	/** Was danach nicht zusammenpasst. Kein Sperrgrund, aber sichtbar zu machen. */
	hinweise: string[];
}

export function pruefeAufnahme(lage: Aufnahmelage): Aufnahmebefund {
	const hinweise: string[] = [];
	const v = lage.versammlung;
	const schon = lage.schonDrin.find((x) => x.id !== v.id);

	if (schon) {
		return {
			erlaubt: false,
			grund:
				`${v.gemeinschaft} tagt hier schon mit — als ${artname(schon.art)} ` +
				`${stufenname(schon.stufe)} vom ${schon.datum}. Eine Gemeinschaft kann in einer ` +
				'gemeinsamen Versammlung nur einmal vorkommen; zwei wären zwei ' +
				'Beschlussfähigkeiten und zwei Protokolle für dieselbe Sache. Lösen Sie die ' +
				'bestehende, wenn Sie sie ersetzen wollen.',
			hinweise
		};
	}

	const teile: string[] = [];

	if (v.gehoertZu && v.gehoertZu.id !== lage.ziel.id) {
		teile.push(
			`Die Versammlung gehört heute zu «${v.gehoertZu.bezeichnung}» und wird dort herausgenommen.`
		);
	}

	/*
	 * **Die gemeinsame Versammlung gibt Tag und Ort vor** (Auftraggeber, 25.08.2026:
	 * «Die Gruppe gibt die Einstellungen für die angehängten Einheiten vor»).
	 *
	 * Bis zum 25.08.2026 blieb beides stehen, und der Hinweis sagte das auch:
	 * «Beides bleibt stehen, bis Sie eines davon ändern.» Das war der Zustand,
	 * an dem Datum und Ort im Saal auseinanderliefen — sechs Versammlungen mit
	 * sechs Terminen, obwohl es einen gab.
	 *
	 * **Ausser sie ist freigegeben.** Dann steht ihr Tag in versandten
	 * Einladungen, und eine Anwendung, die das überschreibt, ändert etwas, das
	 * jemand schon gelesen hat. Dieselbe Schranke wie beim Umlegen
	 * (`umlegen.ts`), und derselbe Grund.
	 *
	 * Der Hinweis sagt in beiden Fällen, was tatsächlich geschieht — ein
	 * Hinweis, der das Gegenteil des Verhaltens behauptet, ist schlimmer als
	 * gar keiner.
	 */
	const imEntwurf = v.zustand === 'entwurf';
	const abweichend: string[] = [];
	if (v.datum !== lage.ziel.datum) abweichend.push(`Tag (${v.datum} → ${lage.ziel.datum})`);
	if (normiert(v.ort) !== normiert(lage.ziel.ort)) {
		abweichend.push(`Ort («${v.ort}» → «${lage.ziel.ort}»)`);
	}

	if (abweichend.length > 0) {
		hinweise.push(
			imEntwurf
				? `Von der gemeinsamen Versammlung übernommen wird: ${abweichend.join(', ')}.`
				: `Die Versammlung ist ${zustandsname(v.zustand)} — ${abweichend.join(', ')} ` +
					'bleibt stehen, weil es in versandten Einladungen steht.'
		);
	}

	return {
		erlaubt: true,
		bestaetigung: teile.length > 0 ? teile.join(' ') : undefined,
		hinweise
	};
}

function stufenname(s: Versammlungsstufe): string {
	return s === 'erste' ? 'Erstversammlung' : 'Zweitversammlung';
}

function artname(a: Versammlungsart): string {
	return a === 'ordentlich' ? 'ordentliche' : 'ausserordentliche';
}

/** Leerzeichen und Gross-/Kleinschreibung sollen keinen Unterschied machen. */
function normiert(ort: string): string {
	return ort.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-CH');
}
