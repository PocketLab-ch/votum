/**
 * Übernahme von Stammdaten aus einer CSV (Story 1.9, FR-6).
 *
 * Der ganze Abgleich ist reine Rechnerei: Datei hinein, Vorschau heraus. Damit
 * lässt sich zeigen, was geschehen wird, bevor etwas geschieht — und genau das
 * verlangt die Story. Ein stilles Durchlaufen findet nie statt.
 *
 * Das Spaltenschema stammt aus dem Vorgängerprojekt (`importers.py`), damit
 * bestehende Dateien weiterverwendbar bleiben. Zwei Ergänzungen:
 *
 *   - `quota_<schluessel>` je Verteiler, damit neben der Stammquote auch der
 *     Aufzug oder die Heizung erfasst werden kann.
 *   - `usufruct_*` für die Nutzniessung.
 *
 * Eine Abweichung ist bewusst: `tenant_key` war im Vorgängerprojekt zweideutig
 * belegt — mal Gemeinschaft, mal Betreiber. `stweg_key` wird zusätzlich
 * angenommen und ist der Begriff, der in neuen Dateien stehen sollte.
 */
import { zerlege, zerlegePersonen, type CsvErgebnis, type CsvZeile } from './csv';
import { STAMMQUOTE, WEG_GROESSERER_NENNER, hatNachkommastellen, quoteAusEingabe } from './einheiten';
import { FachlicherFehler } from './fehler';
import { pruefeMitberechtigte, sammelname, vergleichsform } from './mitberechtigte';
import { zeichenzahl } from './zeichenzahl';
import type { PartyKind, UnitKind } from './types';
import { istKalendertag } from './datum';

export type Vorgang = 'neu' | 'geaendert' | 'unveraendert' | 'fehlerhaft';

export interface Befund {
	zeile: number;
	grund: string;
	spalte?: string;
}

// ── Eigentümer ──────────────────────────────────────────────────────────────

export interface EigentuemerSatz {
	ref: string;
	displayName: string;
	kind: PartyKind;
	isCommunity: boolean;
	representativeName: string | null;
	/**
	 * Die genannten Personen, einzeln (27.08.2026, Aufgabe 6).
	 *
	 * Bis hierher wurde `person_names` gelesen, zu einem Anzeigenamen
	 * eingedampft und danach weggeworfen — beim Einspielen entstand eine Zeile,
	 * in der die Miteigentümer nur noch ein Stück Text waren. Nach
	 * Wermelinger, Rz. 50 ad Art. 712n, ist aber jeder von ihnen einzeln anzuschreiben, und dafür muss
	 * er eine eigene Zeile haben. Ab zwei Namen legt die Übernahme deshalb eine
	 * Hülle mit Mitberechtigten an.
	 */
	personen: string[];
	/**
	 * Die Authentik-Kennung, an der später der Eigentümerzugang hängt.
	 *
	 * Sie kommt aus der Übernahme (immotool liefert sie seit dem 20.08.2026)
	 * oder steht von Hand in der Datei. Höchstens **eine** je Zeile: Eine Zeile
	 * ist eine Stimme, und zwei Kennungen an einer Stimme wären zwei Menschen,
	 * die sich beide dafür anmelden dürften.
	 */
	authentikSubject: string | null;
}

export interface EigentuemerVorschau {
	zeile: number;
	vorgang: Vorgang;
	satz: EigentuemerSatz | null;
	befund?: Befund;
	/** Bei `geaendert`: was sich ändert. */
	aenderungen?: Record<string, { vorher: unknown; nachher: unknown }>;
}

/**
 * Eigentumsform aus dem Vorgängerprojekt.
 *
 * `miteigentum` und `gesamteigentum` bedeuten beide: mehrere Personen an einer
 * Einheit, zusammen eine Stimme (ZGB Art. 712o Abs. 1). Der Unterschied liegt im
 * Sachenrecht, nicht in der Stimmzählung.
 */
export function istGemeinschaftlich(eigentumsform: string): boolean {
	const f = eigentumsform.trim().toLowerCase();
	return f === 'miteigentum' || f === 'gesamteigentum';
}

/**
 * Die Gestalt einer Authentik-Kennung.
 *
 * Geprüft wird die UUID-Form, nicht der Inhalt — ob es die Kennung drüben gibt,
 * weiss diese Anwendung nicht. Was sie verhindern kann, ist die stille
 * Verwechslung mit dem, was Menschen sonst für eine Kennung halten: die
 * E-Mail-Adresse oder der Benutzername. Beide ändern sich, beide werden neu
 * vergeben — eine daran geknüpfte Anmeldung öffnete irgendwann die falsche Tür.
 */
const UUID_FORM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function istAuthentikKennung(wert: string): boolean {
	return UUID_FORM.test(wert.trim());
}

export function lesePersonenart(wert: string): PartyKind {
	const w = wert.trim().toLowerCase();
	if (['juristisch', 'legal', 'juristische person', 'firma', 'ag', 'gmbh'].includes(w)) {
		return 'legal';
	}
	return 'natural';
}

/**
 * Die Eigentümerkennungen, die eine **fertige Vorschau** anlegen wird.
 *
 * Für den Fall, dass Eigentümer- und Einheitendatei zusammen ausgewählt werden:
 * Die Einheitenvorschau muss wissen, welche Kennungen gleich entstehen, sonst
 * hält sie jede für unbekannt und warnt im Normalfall vor sich selbst.
 *
 * **Gelesen wird das Ergebnis, nicht die Regel** (02.09.2026, dritte Runde des
 * Code-Reviews). Zweimal hintereinander hat hier eine nachgebaute Prüfung eine
 * Ablehnung übersehen, die anderswo entschieden wird:
 *
 * 1. Der erste Anlauf las die Spalte roh — auch Zeilen, die
 *    `pruefeEigentuemerZeile` verwirft, galten als «kommt gleich».
 * 2. Der zweite rief `pruefeEigentuemerZeile` auf und übersah die Stufe
 *    darüber: Eine Authentik-Kennung, die hier schon zu jemand anderem gehört,
 *    lehnt `erzeugeVorschauAus` erst beim Abgleich mit dem Bestand ab.
 *
 * Beide Male wäre aus einer zu lauten Warnung eine fehlende geworden — der
 * schlechtere der beiden Fehler. Wer die fertige Vorschau fragt, kann diese
 * Stufen nicht mehr verpassen: Was dort einen `befund` trägt, entsteht nicht.
 */
export function kennungenAusVorschau(vorschau: Uebernahmevorschau): string[] {
	if (vorschau.art !== 'eigentuemer') return [];
	return vorschau.eigentuemer
		.filter((e) => !e.befund && e.satz)
		.map((e) => e.satz!.ref)
		.filter(Boolean);
}

export function pruefeEigentuemerZeile(z: CsvZeile): EigentuemerVorschau {
	const w = z.werte;
	const ref = w.voter_ref || w.party_ref || '';
	const personen = zerlegePersonen(w.person_names || '');
	/*
	 * **Der abgeleitete Name ist der Sammelname** (27.08.2026, Aufgabe 6).
	 *
	 * Vorher stand hier `personen.join(', ')`. Damit hiess die Zeile «Anna
	 * Muster, Beat Muster» — was sich liest wie zwei Zeilen, die versehentlich
	 * zusammengerutscht sind. Angelegt wird sie seit Aufgabe 3 über
	 * `erstelleGemeinschaftlicheZeile`, und die benennt sie «Anna Muster und
	 * Beat Muster». Blieben die beiden Formen auseinander, meldete jeder zweite
	 * Lauf dieselbe Zeile als «geändert» und benennte sie hin und her.
	 *
	 * Bei null oder einer Person liefert `sammelname` dasselbe wie vorher; der
	 * Unterschied trifft nur die Zeilen, die ohnehin gemeinschaftlich sind.
	 */
	const anzeigename = (w.display_name || '').trim() || sammelname(personen);

	if (!ref) {
		return {
			zeile: z.nummer,
			vorgang: 'fehlerhaft',
			satz: null,
			befund: { zeile: z.nummer, grund: 'Kennung des Eigentümers fehlt.', spalte: 'voter_ref' }
		};
	}

	if (!anzeigename) {
		return {
			zeile: z.nummer,
			vorgang: 'fehlerhaft',
			satz: null,
			befund: { zeile: z.nummer, grund: 'Weder Name noch Personenliste angegeben.', spalte: 'display_name' }
		};
	}

	const eigentumsform = w.ownership_type || '';
	if (eigentumsform && !['alleineigentum', 'miteigentum', 'gesamteigentum'].includes(eigentumsform.toLowerCase())) {
		return {
			zeile: z.nummer,
			vorgang: 'fehlerhaft',
			satz: null,
			befund: {
				zeile: z.nummer,
				grund: `Unbekannte Eigentumsform «${eigentumsform}». Erlaubt sind alleineigentum, miteigentum, gesamteigentum.`,
				spalte: 'ownership_type'
			}
		};
	}

	// Widerspruch zwischen genannter Zahl und genannten Personen. Wird die Zahl
	// stillschweigend übernommen, stimmt später die Vertretung nicht.
	if (w.person_count) {
		const genannt = Number(w.person_count);
		if (!Number.isInteger(genannt) || genannt < 1) {
			return {
				zeile: z.nummer,
				vorgang: 'fehlerhaft',
				satz: null,
				befund: { zeile: z.nummer, grund: 'Personenzahl ist keine ganze Zahl.', spalte: 'person_count' }
			};
		}
		if (personen.length > 0 && genannt !== personen.length) {
			return {
				zeile: z.nummer,
				vorgang: 'fehlerhaft',
				satz: null,
				befund: {
					zeile: z.nummer,
					grund: `Personenzahl ${genannt} passt nicht zu ${personen.length} genannten Personen.`,
					spalte: 'person_count'
				}
			};
		}
	}

	const gemeinschaftlich = istGemeinschaftlich(eigentumsform) || personen.length > 1;
	const kind = lesePersonenart(w.party_type || '');
	const vertreter =
		zerlegePersonen(w.legal_representatives || w.legal_representative || '')[0] ??
		(gemeinschaftlich ? (personen[0] ?? null) : null);

	/*
	 * **Kein Abbruch mehr, wenn die Datei keine Vertretung führt** (Entscheid
	 * Auftraggeber, 27.08.2026). Hier stand bis heute «Bei gemeinschaftlichem Eigentum
	 * fehlt die Person, die die Stimme ausübt» und die Zeile fiel durch.
	 *
	 * Die Bezeichnung ist seit heute freiwillig: Ist am Abend nur einer der
	 * Mitberechtigten da, darf die Sitzungsleitung ihn zählen, auch ohne
	 * Vollmacht (Wermelinger, Rz. 19 ad Art. 712o). Eine Datei abzuweisen, weil
	 * sie eine freiwillige Angabe nicht führt, wäre dieselbe erfundene Schranke
	 * eine Ebene weiter.
	 *
	 * **Der Rückfall auf die erstgenannte Person bleibt** (oben bei `vertreter`).
	 * Er ist keine Pflicht, sondern eine Auslegung der Datei, und er trägt die
	 * Regel darunter: «lässt die gewählte Vertretung stehen, wo die Datei keine
	 * führt». Ohne ihn setzte jeder Lauf eine von Hand gewählte Vertretung
	 * zurück. Ob er bleiben soll, ist eine eigene Frage an den Auftraggeber; gebaut wird
	 * hier nichts daran.
	 */

	if (kind === 'legal' && !vertreter) {
		return {
			zeile: z.nummer,
			vorgang: 'fehlerhaft',
			satz: null,
			befund: {
				zeile: z.nummer,
				grund: 'Bei einer juristischen Person fehlt die vertretungsberechtigte Person.',
				spalte: 'legal_representatives'
			}
		};
	}

	/*
	 * **Die Regeln der Hülle gelten schon in der Vorschau** (27.08.2026,
	 * Aufgabe 6).
	 *
	 * Ab zwei genannten Personen legt die Übernahme eine Hülle mit
	 * Mitberechtigten an (`erstelleGemeinschaftlicheZeile`). Die weist ab, was
	 * hier ohne diese Prüfung durchginge: zweimal derselbe Name, oder ein
	 * Vertreter, der nicht zu den Genannten gehört. Dort käme die Absage aber
	 * **mitten in der Transaktion** und nähme allen übrigen Zeilen ihren Lauf —
	 * der Vertrag dieser Seite ist «fehlerhafte Zeile überspringen, nicht
	 * abbrechen». Deshalb fällt die Entscheidung hier, wo ein Mensch sie sieht,
	 * bevor etwas geschieht.
	 *
	 * **Erst ab zwei Personen.** Eine gemeinschaftliche Zeile mit einer oder
	 * keiner genannten Person geht weiter den alten Weg: eine Zeile mit dem
	 * Haken und einem Vertreternamen als Text. So sind die Zeilen aus der Zeit
	 * vor Migration 094 erfasst, und so kommt «Erbengemeinschaft Muster» ohne
	 * Personenliste weiterhin durch (Produktentscheid 26.08.2026).
	 *
	 * **Was sich dadurch ändert:** Eine Datei, die unter
	 * `legal_representatives` einen Dritten nennt — etwa einen Anwalt —, gilt
	 * ab zwei Personen als fehlerhaft. Vorher wurde sein Name stillschweigend
	 * übernommen. Die Stimme übt nach ZGB Art. 712o Abs. 1 eine der
	 * mitberechtigten Personen aus; wer eine dritte bevollmächtigt, erfasst das
	 * als Vollmacht und nicht als Vertretung der Gemeinschaft.
	 */
	if (gemeinschaftlich && personen.length >= 2) {
		/*
		 * **Auch die Namenslänge** (27.08.2026, aus dem Code-Review). Jede
		 * Mitgliedszeile läuft beim Schreiben durch `pruefeEigentuemer` und braucht
		 * dort 2 bis 200 Zeichen. Stünde die Prüfung nur dort, bräche eine Datei
		 * mit «A|Beat Muster» mitten in der Transaktion ab — und nähme allen
		 * übrigen Zeilen ihren Lauf. Der Sammelname «A und Beat Muster» ist lang
		 * genug und fiele nicht auf.
		 */
		for (const [i, name] of personen.entries()) {
			const zahl = zeichenzahl(name);
			if (zahl >= 2 && zahl <= 200) continue;
			return {
				zeile: z.nummer,
				vorgang: 'fehlerhaft',
				satz: null,
				befund: {
					zeile: z.nummer,
					grund:
						`${i + 1}. Person: «${name}» ist als Name ${zahl < 2 ? 'zu kurz' : 'zu lang'}. ` +
						'Erwartet werden 2 bis 200 Zeichen.',
					spalte: 'person_names'
				}
			};
		}

		try {
			pruefeMitberechtigte(personen, vertreter);
		} catch (f) {
			if (!(f instanceof FachlicherFehler)) throw f;
			return {
				zeile: z.nummer,
				vorgang: 'fehlerhaft',
				satz: null,
				befund: {
					zeile: z.nummer,
					grund: f.message,
					spalte:
						f.kennung === 'vertreter_kein_mitberechtigter'
							? 'legal_representatives'
							: 'person_names'
				}
			};
		}
	}

	// Die Authentik-Kennung. Fehlt sie, ist das der Normalfall — sie ist ein
	// Angebot für den späteren Eigentümerzugang, keine Voraussetzung für eine
	// Stimme.
	const kennungen = zerlegePersonen(w.person_authentik || '');
	if (kennungen.length > 1) {
		return {
			zeile: z.nummer,
			vorgang: 'fehlerhaft',
			satz: null,
			befund: {
				zeile: z.nummer,
				grund:
					`${kennungen.length} Authentik-Kennungen an einer Zeile. Eine Zeile ist eine ` +
					'Stimme; welche der Personen sie ausübt, muss dastehen und darf nicht aus der ' +
					'Reihenfolge geraten werden.',
				spalte: 'person_authentik'
			}
		};
	}
	if (kennungen.length === 1 && !istAuthentikKennung(kennungen[0])) {
		return {
			zeile: z.nummer,
			vorgang: 'fehlerhaft',
			satz: null,
			befund: {
				zeile: z.nummer,
				grund:
					`«${kennungen[0]}» ist keine Authentik-Kennung. Erwartet wird die UUID aus dem ` +
					'sub-Anspruch, nie die E-Mail-Adresse oder der Benutzername — die ändern sich und ' +
					'werden neu vergeben.',
				spalte: 'person_authentik'
			}
		};
	}

	return {
		zeile: z.nummer,
		vorgang: 'neu',
		satz: {
			ref,
			displayName: anzeigename,
			kind,
			isCommunity: gemeinschaftlich,
			representativeName: vertreter,
			personen,
			authentikSubject: kennungen.length === 1 ? kennungen[0].trim().toLowerCase() : null
		}
	};
}

// ── Einheiten ───────────────────────────────────────────────────────────────

export interface EinheitSatz {
	ref: string;
	label: string;
	kind: UnitKind;
	ownerRef: string;
	quotas: Record<string, number>;
	countsAsHead: boolean;
	nutzniessung: {
		holderName: string;
		validFrom: string;
		validTo?: string;
		hasAgreement: boolean;
		agreementSummary?: string;
	} | null;
}

export interface EinheitVorschau {
	zeile: number;
	vorgang: Vorgang;
	satz: EinheitSatz | null;
	befund?: Befund;
	aenderungen?: Record<string, { vorher: unknown; nachher: unknown }>;
}

export function leseEinheitsart(wert: string): UnitKind {
	const w = wert.trim().toLowerCase();
	if (['parking', 'nebenobjekt', 'einstellplatz', 'parkplatz', 'keller', 'accessory'].includes(w)) {
		return 'parking';
	}
	return 'unit';
}

/**
 * Prüft eine Einheitszeile gegen die bekannten Quotenarten.
 *
 * Anders als beim Formular wird eine unbekannte Spalte hier **gemeldet**: Steht
 * in einer Datei `quota_lifz`, ist das ein Tippfehler, und die Einheit fiele
 * still aus der Saldoprüfung dieses Verteilers.
 */
export function pruefeEinheitZeile(z: CsvZeile, bekannteQuotenarten: string[]): EinheitVorschau {
	const w = z.werte;
	const ref = w.holding_ref || w.unit_ref || '';
	const label = (w.label || '').trim();

	if (!ref) {
		return fehler(z, 'Kennung der Einheit fehlt.', 'holding_ref');
	}
	if (!label) {
		return fehler(z, 'Bezeichnung der Einheit fehlt.', 'label');
	}

	const ownerRef = w.owner_voter_ref || w.owner_ref || '';
	if (!ownerRef) {
		// Eine Einheit ohne Eigentümer gibt es im Grundbuch nicht.
		return fehler(z, 'Kein Eigentümer zugeordnet.', 'owner_voter_ref');
	}

	const quotas: Record<string, number> = {};
	const bekannt = new Set(bekannteQuotenarten);

	// Die alte Spalte `quota_units` ist die Stammquote.
	for (const [spalte, wert] of Object.entries(w)) {
		let schluessel: string | null = null;
		if (spalte === 'quota_units' || spalte === 'quota' || spalte === `quota_${STAMMQUOTE}`) {
			schluessel = STAMMQUOTE;
		} else if (spalte.startsWith('quota_')) {
			schluessel = spalte.slice('quota_'.length);
		}
		if (!schluessel) continue;
		if (wert.trim() === '') continue;

		if (!bekannt.has(schluessel)) {
			return fehler(
				z,
				`Die Gemeinschaft kennt keine Quotenart «${schluessel}». Legen Sie den Verteiler zuerst an, oder berichtigen Sie die Spalte.`,
				spalte
			);
		}

		// `quoteAusEingabe` liest «123,5» als Nachkommastelle, damit die Absage den
		// Weg über den Nenner anhängt (Ä-10); «1,000» bleibt abgewiesen.
		const zahl = quoteAusEingabe(wert.replace(/'/g, ''));
		if (!Number.isInteger(zahl) || zahl < 0) {
			return fehler(
				z,
				`Die Quote «${schluessel}» ist keine nicht-negative ganze Zahl: «${wert}».` +
					(schluessel === STAMMQUOTE && hatNachkommastellen(zahl) ? ` ${WEG_GROESSERER_NENNER}` : ''),
				spalte
			);
		}
		quotas[schluessel] = zahl;
	}

	if (!(STAMMQUOTE in quotas)) {
		return fehler(z, 'Die Stammquote fehlt.', 'quota_units');
	}

	// `eligible` aus dem Vorgängerprojekt meinte die Stimmberechtigung der
	// Einheit; bei uns entscheidet das nur über die Kopfstimme.
	const kopf = w.counts_as_head || w.eligible || '';
	const countsAsHead = kopf.trim() === '' ? true : ['1', 'true', 'ja', 'yes', 'x'].includes(kopf.trim().toLowerCase());

	const nutzniesser = (w.usufruct_holder || '').trim();
	let nutzniessung: EinheitSatz['nutzniessung'] = null;
	if (nutzniesser) {
		const ab = (w.usufruct_from || '').trim();
		if (!istKalendertag(ab)) {
			return fehler(
				z,
				'Zur Nutzniessung fehlt der Beginn im Format JJJJ-MM-TT.',
				'usufruct_from'
			);
		}
		/*
		 * **Das Ende gehört mitgeprüft** (Code-Review 02.09.2026). Es ging bis
		 * hierher ungeprüft durch die Vorschau, die damit «in Ordnung» meldete,
		 * und schlug erst in `pruefeNutzniessung` mitten in der Schreibtransaktion
		 * fehl: Die ganze Übernahme rollte zurück, mit einer Meldung auf ein Feld,
		 * das es im Formular gar nicht gibt. Genau der Verlust der hochgeladenen
		 * Tabelle, gegen den diese Runde gebaut ist.
		 */
		const bis = (w.usufruct_to || '').trim();
		if (bis && !istKalendertag(bis)) {
			return fehler(z, 'Das Ende der Nutzniessung ist kein gültiges Datum.', 'usufruct_to');
		}
		if (bis && bis <= ab) {
			return fehler(
				z,
				'Das Ende der Nutzniessung liegt vor ihrem Beginn.',
				'usufruct_to'
			);
		}
		const vereinbarung = (w.usufruct_agreement || '').trim();
		nutzniessung = {
			holderName: nutzniesser,
			validFrom: ab,
			validTo: bis || undefined,
			hasAgreement: vereinbarung.length > 0,
			agreementSummary: vereinbarung || undefined
		};
	}

	return {
		zeile: z.nummer,
		vorgang: 'neu',
		satz: {
			ref,
			label,
			kind: leseEinheitsart(w.holding_type || w.unit_type || ''),
			ownerRef,
			quotas,
			countsAsHead,
			nutzniessung
		}
	};
}

function fehler(z: CsvZeile, grund: string, spalte?: string): EinheitVorschau {
	return {
		zeile: z.nummer,
		vorgang: 'fehlerhaft',
		satz: null,
		befund: { zeile: z.nummer, grund, spalte }
	};
}

// ── Gesamtvorschau ──────────────────────────────────────────────────────────

export interface Bestand {
	eigentuemer: {
		ref: string;
		displayName: string;
		kind: PartyKind;
		isCommunity: boolean;
		representativeName: string | null;
		/**
		 * Gehört in den Vergleich: Eine Datei kann eine Kennung zu einer sonst
		 * unveränderten Partei mitbringen — beim zweiten Lauf nach dem Onboarding
		 * ist das sogar der Regelfall. Ohne dieses Merkmal gälte die Zeile als
		 * unverändert und die Kennung käme nie an. Dieselbe Falle wie bei der
		 * Nutzniessung weiter unten.
		 */
		authentikSubject: string | null;
		/**
		 * Die Namen der erfassten Mitberechtigten, sofern welche daran hängen
		 * (27.08.2026, Aufgabe 6).
		 *
		 * Leer bei jeder gewöhnlichen Zeile — und auch bei den gemeinschaftlichen
		 * aus der Zeit vor Migration 094, die einen Sammelnamen als Text tragen
		 * und keine Mitberechtigten. Die bleiben stehen, wie sie sind (Entscheid
		 * Auftraggeber, 26.08.2026); an dieser Liste hängt deshalb nur, was **mit**
		 * Mitberechtigten erfasst ist.
		 */
		mitberechtigte: string[];
		/**
		 * Ob die Zeile auf eine Mitgliedszeile als Vertretung zeigt
		 * (`party.representative_party_id`).
		 *
		 * Steht der Verweis, führt er den Namen — genauso entscheidet
		 * `bearbeiteEigentuemer` seit dem 26.08.2026. Ohne dieses Merkmal meldete
		 * die Vorschau eine von Hand gewählte Vertretung bei jedem Lauf als
		 * «geändert», weil immotool gar nicht führt, wer die Stimme ausübt, und
		 * die Übernahme deshalb auf die erstgenannte Person zurückfällt.
		 */
		vertreterGesetzt: boolean;
	}[];
	einheiten: {
		ref: string;
		label: string;
		kind: UnitKind;
		quotas: Record<string, number>;
		countsAsHead: boolean;
		/**
		 * Ob zu dieser Einheit bereits eine Nutzniessung erfasst ist.
		 *
		 * Gehört in den Vergleich: Eine Datei kann eine Nutzniessung zu einer sonst
		 * unveränderten Einheit mitbringen. Ohne dieses Merkmal gälte die Zeile als
		 * unverändert und würde übersprungen — die Nutzniessung käme nie an.
		 */
		hatNutzniessung: boolean;
		/**
		 * Die Fremdkennung des Eigentümers, der die Einheit **am Stichtag** hält —
		 * `null`, wo niemand sie hält oder der Halter keine Kennung trägt
		 * (01.09.2026).
		 *
		 * **Die dritte Stelle derselben Falle.** Über der Nutzniessung und der
		 * Authentik-Kennung steht je ein Absatz, warum sie in den Vergleich
		 * gehören: Ohne sie gälte die Zeile als unverändert und die Angabe käme
		 * nie an. Beim Eigentümer hatte es niemand gemacht — gemessen am
		 * 01.09.2026: Eine Datei, die nur den Eigentümer wechselt, meldete
		 * «1 unverändert», und die Handänderung geschah **gar nicht**.
		 *
		 * `null` auch dann, wenn der laufende Eigentümer ohne `import_ref`
		 * erfasst wurde: Dann lässt sich nicht sagen, ob die Datei denselben
		 * meint, und der Wechsel wird als Änderung gemeldet statt stillschweigend
		 * übergangen.
		 */
		eigentuemerRef: string | null;
	}[];
	quotenarten: { key: string; denominator: number; isPrimary: boolean }[];
}

export interface Uebernahmevorschau {
	art: 'eigentuemer' | 'einheiten';
	spalten: string[];
	trennzeichen: string;
	eigentuemer: EigentuemerVorschau[];
	einheiten: EinheitVorschau[];
	zusammenfassung: { neu: number; geaendert: number; unveraendert: number; fehlerhaft: number };
	befunde: Befund[];
	/**
	 * Was zu sagen ist, ohne dass eine Zeile deswegen wegbliebe (27.08.2026,
	 * Aufgabe 6).
	 *
	 * Ein Befund heisst «diese Zeile wird übersprungen» — so steht es auf der
	 * Seite. Für eine Abweichung, die niemanden aufhält und trotzdem niemand
	 * übersehen soll, braucht es die zweite Ablage. Sonst bliebe nur die Wahl
	 * zwischen Schweigen und Blockieren, und beides wäre falsch.
	 */
	hinweise: string[];
	/** Wertquotensummen nach der Übernahme, je Quotenart. */
	quotensummen: { key: string; summe: number; soll: number; abweichung: number }[];
	/** Wahr, wenn eine Stammquote nach der Übernahme nicht mehr aufgeht. */
	bringtQuotenAusDemGleichgewicht: boolean;
}

/** Erkennt an den Spalten, ob die Datei Eigentümer oder Einheiten enthält. */
export function erkenneArt(spalten: string[]): 'eigentuemer' | 'einheiten' | null {
	const s = new Set(spalten);
	if (s.has('holding_ref') || s.has('unit_ref')) return 'einheiten';
	if (s.has('voter_ref') || s.has('party_ref')) return 'eigentuemer';
	return null;
}

export function erzeugeVorschau(text: string, bestand: Bestand): Uebernahmevorschau {
	return erzeugeVorschauAus(zerlege(text), bestand);
}

/**
 * Dieselbe Vorschau, aber aus einer **bereits gelesenen** Tabelle.
 *
 * Für Excel-Dateien (25.08.2026): Eine Arbeitsmappe liefert ihre Zellen schon
 * zerlegt. Sie erst wieder zu einer CSV-Zeichenkette zusammenzusetzen — mit
 * Anführungszeichen und Maskierung —, nur damit `zerlege` sie gleich darauf
 * auseinandernimmt, wäre eine Umwandlung zu viel. Und jede Umwandlung ist eine
 * Stelle, an der ein Semikolon im Namen etwas kaputtmacht.
 */
export function erzeugeVorschauAus(
	tabelle: CsvErgebnis,
	bestand: Bestand,
	/**
	 * Kennungen, die in **derselben Auswahl** noch angelegt werden.
	 *
	 * **Der Anlass** (01.09.2026, aus dem Code-Review): Wer eine Gemeinschaft
	 * erstmals übernimmt, wählt Eigentümer- und Einheitendatei zusammen aus. Die
	 * Seite rechnet beide Vorschauen gegen denselben Datenbankstand — und der
	 * kennt zu diesem Zeitpunkt noch keinen einzigen Eigentümer. Der Hinweis
	 * «zu N Kennungen gibt es hier keinen Eigentümer» erschien damit ausgerechnet
	 * im Normalfall, für **jede** Zeile, und riet dazu, zuerst die
	 * Eigentümerdatei zu übernehmen — die vorsortiert direkt davor läuft.
	 *
	 * Die Ausführung war nie betroffen: Sie spielt die Dateien nacheinander ein,
	 * und die Zuordnung kommt an. Falsch war nur die Warnung davor.
	 */
	kommendeKennungen: readonly string[] = []
): Uebernahmevorschau {
	const { spalten, zeilen, trennzeichen } = tabelle;
	const art = erkenneArt(spalten);

	const leer: Uebernahmevorschau = {
		art: 'eigentuemer',
		spalten,
		trennzeichen,
		eigentuemer: [],
		einheiten: [],
		zusammenfassung: { neu: 0, geaendert: 0, unveraendert: 0, fehlerhaft: 0 },
		befunde: [],
		hinweise: [],
		quotensummen: [],
		bringtQuotenAusDemGleichgewicht: false
	};

	if (!art) {
		return {
			...leer,
			befunde: [
				{
					zeile: 1,
					grund:
						'Die Datei ist weder als Eigentümer- noch als Einheitenliste erkennbar. ' +
						'Erwartet wird eine Spalte «voter_ref» beziehungsweise «holding_ref».'
				}
			]
		};
	}

	if (art === 'eigentuemer') {
		const bekannt = new Map(bestand.eigentuemer.map((e) => [e.ref, e]));

		/*
		 * **Eine Kennung gehört einer Partei — geprüft hier, nicht erst beim
		 * Schreiben.**
		 *
		 * In der Datenbank wacht `party_authentik_je_gemeinschaft` darüber. Nur
		 * schlägt der Index beim INSERT zu, und dann bricht die **ganze**
		 * Übernahme ab: Sie läuft in einer Transaktion, und eine einzige doppelte
		 * Kennung nähme allen anderen Zeilen ihren Lauf. Der Vertrag dieser Seite
		 * ist ein anderer — «fehlerhafte Zeilen überspringen, nicht abbrechen» —,
		 * und die Vorschau ist der Ort, an dem ein Mensch das sieht, bevor etwas
		 * geschieht.
		 *
		 * Zwei Fälle, derselbe Grund: Zwei Parteien mit einer Kennung wären ein
		 * Mensch mit zwei Stimmen.
		 */
		const kennungImBestand = new Map(
			bestand.eigentuemer
				.filter((e) => e.authentikSubject)
				.map((e) => [e.authentikSubject as string, e.ref])
		);
		const kennungInDatei = new Map<string, number>();
		const hinweise: string[] = [];

		const vorschau = zeilen.map((z) => {
			const geprueft = pruefeEigentuemerZeile(z);
			if (geprueft.vorgang !== 'neu' || !geprueft.satz) return geprueft;

			const kennung = geprueft.satz.authentikSubject;
			if (kennung) {
				const schonInDatei = kennungInDatei.get(kennung);
				if (schonInDatei !== undefined) {
					return {
						zeile: z.nummer,
						vorgang: 'fehlerhaft' as const,
						satz: null,
						befund: {
							zeile: z.nummer,
							grund:
								`Diese Authentik-Kennung steht schon in Zeile ${schonInDatei}. Zwei ` +
								'Parteien mit derselben Kennung wären ein Mensch mit zwei Stimmen.',
							spalte: 'person_authentik'
						}
					};
				}
				kennungInDatei.set(kennung, z.nummer);

				const gehoertZu = kennungImBestand.get(kennung);
				if (gehoertZu !== undefined && gehoertZu !== geprueft.satz.ref) {
					return {
						zeile: z.nummer,
						vorgang: 'fehlerhaft' as const,
						satz: null,
						befund: {
							zeile: z.nummer,
							grund:
								`Diese Authentik-Kennung gehört hier bereits zu «${gehoertZu}». Wandern ` +
								// Ohne den Namen des Hauswerkzeugs: Die Meldung sieht jede Gemeinschaft, auch
								// beim Dateiweg (Produktentscheid 17.11.2026).
								'darf sie nicht von selbst: Entweder ist die Person in der Quelle doppelt ' +
								'erfasst, oder die alte Zuordnung gehört zuerst aufgehoben.',
							spalte: 'person_authentik'
						}
					};
				}
			}

			const vorhanden = bekannt.get(geprueft.satz.ref);
			if (!vorhanden) return geprueft;

			/*
			 * **Mitberechtigte ändert die Übernahme nicht — sie meldet die
			 * Abweichung** (27.08.2026, Aufgabe 6).
			 *
			 * Hängen an einer Zeile Mitberechtigte, sind das eigene
			 * Eigentümerzeilen mit Personenklammer, Adresse und Einladung. Die
			 * Datei nennt nur Namen. Sie stillschweigend nachzuziehen hiesse,
			 * Zeilen anzulegen und wegzunehmen, von denen die Datei nichts weiss —
			 * und eine weggenommene Mitberechtigung nimmt die Einladung nach ZGB
			 * Art. 712n gleich mit, ohne dass es jemand sähe.
			 *
			 * Deshalb dieselbe Haltung wie bei der Authentik-Kennung, die «nicht
			 * von selbst wandert»: Die Zeile wird übersprungen, der Grund steht in
			 * der Vorschau, und die übrigen Zeilen laufen durch.
			 *
			 * **Nur wenn schon Mitberechtigte da sind.** Eine gemeinschaftliche
			 * Zeile ohne sie ist der Bestand von vor Migration 094; sie soll
			 * weiterlaufen wie bisher und nicht plötzlich als fehlerhaft gelten.
			 */
			/*
			 * **Der Haken lässt sich nicht wegnehmen, solange Mitberechtigte
			 * hängen** (27.08.2026, aus dem Code-Review zu Aufgabe 6).
			 *
			 * `pruefeHakenUmlegbar` hält das beim Schreiben auf — aber mit einer
			 * Ausnahme mitten in der Transaktion, und die nimmt allen übrigen
			 * Zeilen ihren Lauf. Solange nur von Hand aufgenommene Mitberechtigte
			 * an eingespielten Zeilen hingen, war das ein Randfall. Seit die
			 * Übernahme selbst Hüllen anlegt, ist es der Alltagsfall «die Datei
			 * nennt nur noch eine Person».
			 *
			 * Hier fällt die Entscheidung deshalb vorher: Die Zeile wird
			 * übersprungen, die übrigen laufen durch, und der Grund steht in der
			 * Vorschau. `pruefeHakenUmlegbar` bleibt als Netz darunter — für den
			 * Weg von Hand und für alles, was hier durchrutscht.
			 */
			if (vorhanden.mitberechtigte.length > 0 && !geprueft.satz.isCommunity) {
				return {
					zeile: z.nummer,
					vorgang: 'fehlerhaft' as const,
					satz: null,
					befund: {
						zeile: z.nummer,
						grund:
							`An «${vorhanden.displayName}» hängen ${vorhanden.mitberechtigte.length} ` +
							'Mitberechtigte. Nehmen Sie diese zuerst weg; danach lässt sich der Haken ' +
							'«Gemeinschaftliches Eigentum» entfernen.',
						spalte: 'ownership_type'
					}
				};
			}

			if (
				vorhanden.mitberechtigte.length > 0 &&
				!gleicheNamen(vorhanden.mitberechtigte, geprueft.satz.personen)
			) {
				hinweise.push(
					`Zeile ${z.nummer}: «${vorhanden.displayName}» führt hier die Mitberechtigten ` +
						`${vorhanden.mitberechtigte.join(', ')}, die Datei nennt ` +
						`${geprueft.satz.personen.join(', ') || 'keine'}. Die Mitberechtigten bleiben, ` +
						'wie sie sind; ändern lassen sie sich bei den Eigentümern.'
				);
			}

			const aenderungen: Record<string, { vorher: unknown; nachher: unknown }> = {};
			const felder: readonly ('displayName' | 'kind' | 'isCommunity' | 'representativeName')[] =
				vorhanden.vertreterGesetzt
					? ['displayName', 'kind', 'isCommunity']
					: ['displayName', 'kind', 'isCommunity', 'representativeName'];
			for (const feld of felder) {
				if (vorhanden[feld] !== geprueft.satz[feld]) {
					aenderungen[feld] = { vorher: vorhanden[feld], nachher: geprueft.satz[feld] };
				}
			}

			/*
			 * **Die Kennung wird nur gesetzt, nie entfernt — und deshalb auch nur in
			 * eine Richtung verglichen.**
			 *
			 * Eine Datei ohne die Spalte `person_authentik` ist kein Löschauftrag,
			 * sondern eine ältere oder von Hand geschriebene Datei. Zählte ihr
			 * fehlender Wert als Änderung, stünde in der Vorschau «geändert», und
			 * die Übernahme nähme der Partei eine Kennung weg, von der die Datei
			 * gar nichts weiss. Entfernen gehört an die Stelle, an der jemand es
			 * ausdrücklich tut.
			 */
			if (
				geprueft.satz.authentikSubject &&
				vorhanden.authentikSubject !== geprueft.satz.authentikSubject
			) {
				aenderungen.authentikSubject = {
					vorher: vorhanden.authentikSubject,
					nachher: geprueft.satz.authentikSubject
				};
			}

			return Object.keys(aenderungen).length === 0
				? { ...geprueft, vorgang: 'unveraendert' as const }
				: { ...geprueft, vorgang: 'geaendert' as const, aenderungen };
		});

		return {
			...leer,
			art,
			eigentuemer: vorschau,
			zusammenfassung: zaehle(vorschau.map((v) => v.vorgang)),
			befunde: vorschau.map((v) => v.befund).filter((b): b is Befund => Boolean(b)),
			hinweise
		};
	}

	const arten = bestand.quotenarten.map((q) => q.key);
	const bekannt = new Map(bestand.einheiten.map((e) => [e.ref, e]));

	const vorschau = zeilen.map((z) => {
		const geprueft = pruefeEinheitZeile(z, arten);
		if (geprueft.vorgang !== 'neu' || !geprueft.satz) return geprueft;

		const vorhanden = bekannt.get(geprueft.satz.ref);
		if (!vorhanden) return geprueft;

		const aenderungen: Record<string, { vorher: unknown; nachher: unknown }> = {};
		for (const feld of ['label', 'kind', 'countsAsHead'] as const) {
			if (vorhanden[feld] !== geprueft.satz[feld]) {
				aenderungen[feld] = { vorher: vorhanden[feld], nachher: geprueft.satz[feld] };
			}
		}
		for (const key of new Set([...Object.keys(vorhanden.quotas), ...Object.keys(geprueft.satz.quotas)])) {
			if (vorhanden.quotas[key] !== geprueft.satz.quotas[key]) {
				aenderungen[`quote.${key}`] = {
					vorher: vorhanden.quotas[key] ?? null,
					nachher: geprueft.satz.quotas[key] ?? null
				};
			}
		}

		/*
		 * **Ein Eigentümerwechsel ist eine Änderung** (01.09.2026), auch wenn
		 * Bezeichnung, Art und Quoten gleich bleiben — und das ist bei einer
		 * Handänderung der Regelfall.
		 *
		 * Gemessen vor der Behebung: Die Zeile galt als «unverändert», die
		 * Ausführung übersprang sie, und der Wechsel geschah nicht. Die Vorschau
		 * meldete «1 unverändert» — eine Auskunft, die den Benutzer in dem Glauben
		 * lässt, es sei nichts zu tun.
		 */
		if (vorhanden.eigentuemerRef !== geprueft.satz.ownerRef) {
			aenderungen.eigentuemer = {
				vorher: vorhanden.eigentuemerRef,
				nachher: geprueft.satz.ownerRef
			};
		}

		// Eine neue Nutzniessung ist eine Änderung, auch wenn die Einheit selbst
		// gleich bleibt. Sonst gälte die Zeile als unverändert und die Nutzniessung
		// käme nie an.
		if (geprueft.satz.nutzniessung && !vorhanden.hatNutzniessung) {
			aenderungen.nutzniessung = {
				vorher: null,
				nachher: geprueft.satz.nutzniessung.holderName
			};
		}

		return Object.keys(aenderungen).length === 0
			? { ...geprueft, vorgang: 'unveraendert' as const }
			: { ...geprueft, vorgang: 'geaendert' as const, aenderungen };
	});

	/*
	 * **Ein Eigentümer, den es hier nicht gibt** (01.09.2026, aus dem
	 * Code-Review).
	 *
	 * Nennt eine Zeile eine `owner_voter_ref`, zu der keine Partei erfasst ist —
	 * ein Tippfehler, oder die Eigentümerdatei wurde vergessen —, meldete die
	 * Vorschau den Wechsel und die Ausführung tat nichts. Ohne Befund, bei jedem
	 * Lauf erneut: Die Zeile bliebe für immer «geändert», und niemand erführe,
	 * warum sich nichts ändert.
	 *
	 * **Ein Hinweis und kein Befund**: Die Zeile selbst geht durch (Bezeichnung
	 * und Quoten kommen an), nur die Zuordnung nicht. Ein Befund hiesse «diese
	 * Zeile wird übersprungen» und wäre falsch.
	 */
	const einheitenhinweise: string[] = [];
	const bekannteParteien = new Set([
		...bestand.eigentuemer.map((e) => e.ref),
		...kommendeKennungen
	]);
	const ohnePartei = [
		...new Set(
			vorschau
				.filter((v) => v.satz && !bekannteParteien.has(v.satz.ownerRef))
				.map((v) => v.satz!.ownerRef)
		)
	];
	if (ohnePartei.length > 0) {
		einheitenhinweise.push(
			`Zu ${ohnePartei.length === 1 ? 'einer Kennung' : `${ohnePartei.length} Kennungen`} ` +
				`gibt es hier keinen Eigentümer: ${ohnePartei.join(', ')}. ` +
				'Die Einheiten kommen an, die Zuordnung nicht. Übernehmen Sie zuerst die ' +
				'Eigentümerdatei, oder berichtigen Sie die Kennung.'
		);
	}

	// Die Summen nach der Übernahme: bestehende Einheiten, die die Datei nicht
	// nennt, bleiben; genannte werden ersetzt.
	const nachher = new Map(bestand.einheiten.map((e) => [e.ref, e.quotas]));
	for (const v of vorschau) {
		if (v.satz) nachher.set(v.satz.ref, v.satz.quotas);
	}

	const quotensummen = bestand.quotenarten.map((q) => {
		const summe = [...nachher.values()].reduce((s, quoten) => s + (quoten[q.key] ?? 0), 0);
		return { key: q.key, summe, soll: q.denominator, abweichung: q.denominator - summe };
	});

	return {
		...leer,
		art,
		einheiten: vorschau,
		zusammenfassung: zaehle(vorschau.map((v) => v.vorgang)),
		befunde: vorschau.map((v) => v.befund).filter((b): b is Befund => Boolean(b)),
		hinweise: einheitenhinweise,
		quotensummen,
		bringtQuotenAusDemGleichgewicht: quotensummen.some(
			(q) => bestand.quotenarten.find((a) => a.key === q.key)?.isPrimary && q.abweichung !== 0
		)
	};
}

/**
 * Ob zwei Namenslisten dieselben Personen meinen.
 *
 * Die Reihenfolge zählt nicht: Die erfassten Mitberechtigten kommen nach Namen
 * sortiert aus der Datenbank, die Datei zählt sie in ihrer eigenen Ordnung auf.
 * Verglichen wird über `vergleichsform` — dieselbe Form, in der `pruefeMitberechtigte`
 * über «zweimal derselbe Name» entscheidet.
 */
function gleicheNamen(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	const links = a.map(vergleichsform).sort();
	const rechts = b.map(vergleichsform).sort();
	return links.every((n, i) => n === rechts[i]);
}

function zaehle(vorgaenge: Vorgang[]) {
	return {
		neu: vorgaenge.filter((v) => v === 'neu').length,
		geaendert: vorgaenge.filter((v) => v === 'geaendert').length,
		unveraendert: vorgaenge.filter((v) => v === 'unveraendert').length,
		fehlerhaft: vorgaenge.filter((v) => v === 'fehlerhaft').length
	};
}
