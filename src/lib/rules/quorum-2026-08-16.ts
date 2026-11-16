/**
 * Regelwerksfassung 2026-08-16 — Block 3 des Befundberichts vom 15.08.2026
 * unter dem Strengstprinzip.
 *
 * **Der Auftrag** (Auftraggeber, 16.08.2026): Die als Lehrstreit L-1 bis L-6 für die
 * juristische Gegenlesung tabellierten Punkte sind vorentschieden — bei
 * echter Uneinigkeit der Quellen gilt die **strengere vertretbare
 * Auslegung**, und der Streit steht ausgewiesen auf der Karte. Ein Beschluss,
 * der die strengere Lesart erreicht, genügt immer auch der milderen; die
 * Gegenlesung kann später lockern, nie verschärfen müssen. Jede Fundstelle
 * wurde am 16.08.2026 im Quellen-Korpus nachgelesen, nicht aus dem
 * Befundbericht übernommen.
 *
 * Die sechs Entscheide:
 *
 *   - **L-1** Ausschlussklage-Zählbasis: bleibt **alle ausser dem Beklagten**
 *     (Wortlaut ZGB Art. 649b Abs. 2 «aller Miteigentümer»; Strittmatter).
 *     SVIT ad 712a Rz. 214 lässt mit Kohler die Anwesenden genügen, ad 712m
 *     Rz. 166b nimmt 649b Abs. 2 vom «Mehr aller» aus — deshalb fällt die
 *     alte Begründung («trägt ihre eigene Basisregel») und der Streit steht
 *     auf der Karte. Die knoteneigene Formel ersetzt die widersprechende
 *     E1-Typformel (Befund B-2).
 *   - **L-2** Selbstverschärfung des Reglements: Ergebnis bleibt
 *     Einstimmigkeit ansetzen — aber als ausgewiesene Vorsichtsregel, nicht
 *     mehr mit dem widerlegten Satz «das Reglement darf strenger sein» (SVIT
 *     ad 712g Rz. 40: «Eine Erschwerung … ist hingegen unzulässig»; Rz. 125,
 *     145; Gegenmeinung Steinauer; BGer 5C.50/2004 E. 4.2 offengelassen).
 *   - **L-3** Prozessführungs-Ermächtigung: einfaches → **qualifiziertes
 *     Mehr**. Das ist zugleich die SVIT-Hauptmeinung (ad 712t Rz. 74:
 *     wichtigere Verwaltungshandlung nach 647b; a.M. Meier-Hayoz/Rey; BGer
 *     offengelassen 5A_198/2014 E. 6.1.2) und die strengere Lesart. Der alte
 *     Beleg «712t Abs. 2» trug nur das Ermächtigungserfordernis, nicht das
 *     Mehr.
 *   - **L-4** Zählung der Einstimmigkeit bei 647e Abs. 1: bleibt **alle im
 *     Grundbuch eingetragenen** (h.L., Skript 12.8.3). SVIT ad 712m Rz. 197
 *     lässt die Anwesenden genügen (a.M. Manz Rz. 160) — Streit steht jetzt
 *     auf der Karte.
 *   - **L-5** Zuständigkeit für gewöhnliche Verwaltung anders regeln
 *     (647a Abs. 2): einfaches → **qualifiziertes Mehr**. Der SVIT nennt für
 *     denselben Artikel beide Mehre (einfach: ad 712g Rz. 34, ad 712m
 *     Rz. 166; qualifiziert: ad 712a Rz. 109). Die Einstimmigkeits-Lesart
 *     von Beobachter/Skript verwirft SVIT ad 712g Rz. 78 ausdrücklich
 *     (647a Abs. 2 als «ausdrücklich anderslautende Gesetzesbestimmung»).
 *   - **L-6** Verschärfbarkeit des 649b-Abs.-2-Mehrs: von «zwingend» auf
 *     **umstritten** (gesperrt_reglement). Der Wortlaut («wenn nichts
 *     anderes vereinbart ist») lässt eine Vereinbarung zu, SVIT ad 712a
 *     Rz. 206 hält die Verschärfung «u.E.» für unzulässig, die Lehre ist
 *     gespalten.
 */
import type { Ergebnisknoten, Reglementsverhalten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_08_15 } from './quorum-2026-08-15';

const KNOTEN_NEU: Record<string, Partial<Ergebnisknoten>> = {
	// L-1 und B-2. Die Begründung nennt den Wortlaut und die strengere Wahl,
	// statt eine Herleitung zu behaupten, die der Kommentar widerlegt; die
	// eigene Formel beendet den Widerspruch zur E1-Typformel auf der Karte.
	'k-ausschlussklage': {
		formel:
			'Mehrheit aller Miteigentümer mit Ausnahme des beklagten Eigentümers — unabhängig ' +
			'davon, wie viele an der Versammlung erschienen sind.',
		begruendung:
			'Das Gesetz nennt die Bezugsgrösse im Wortlaut: ein Mehrheitsbeschluss aller ' +
			'Miteigentümer mit Ausnahme des Beklagten (ZGB Art. 649b Abs. 2). Der Kommentar ' +
			'rechnet stattdessen nach den anwesenden und vertretenen Eigentümern; dieses ' +
			'Werkzeug folgt der strengeren Wortlaut-Lesart — ein so gefasster Beschluss ' +
			'genügt beiden.'
	},

	// L-3 und B-3. Typwechsel auf das qualifizierte Mehr; der Beleg trägt
	// jetzt beides: das Mehr (647b Abs. 1) und das Ermächtigungserfordernis
	// (712t Abs. 2).
	'k-prozessfuehrung': {
		typ: 'qualifiziertes_mehr',
		quotenbasis: 'alle_quoten',
		wortlautAbweichung: true,
		rechtsgrundlage: 'ZGB Art. 647b Abs. 1 i.V.m. Art. 712t Abs. 2',
		begruendung:
			'Führt die Bewirtschaftung für die Gemeinschaft einen Zivilprozess, braucht sie ' +
			'vorher die Ermächtigung der Versammlung (ZGB Art. 712t Abs. 2). Diese Ermächtigung ' +
			'ist eine wichtigere Verwaltungshandlung und verlangt deshalb das qualifizierte ' +
			'Mehr. Ausgenommen sind das summarische Verfahren, ein vereinfachtes, rasches ' +
			'Gerichtsverfahren, und dringende Fälle, in denen die Ermächtigung nachgeholt ' +
			'werden kann.'
	},

	// L-5. Typwechsel auf das qualifizierte Mehr; die Begründung sagt, dass
	// der Kommentar sich nicht einig ist.
	'k-zustaendigkeit-gewoehnlich': {
		typ: 'qualifiziertes_mehr',
		quotenbasis: 'alle_quoten',
		begruendung:
			'Die Versammlung kann die Zuständigkeit für gewöhnliche Verwaltungshandlungen ' +
			'anders verteilen, unter Vorbehalt der notwendigen und dringlichen Massnahmen ' +
			'(ZGB Art. 647a Abs. 2). Ob dafür das einfache oder das qualifizierte Mehr gilt, ' +
			'beantwortet der Kommentar uneinheitlich — dieses Werkzeug setzt das strengere ' +
			'qualifizierte Mehr an.'
	},

	// L-2 und B-4. Der Satz «Das Reglement darf strenger sein als das Gesetz»
	// ist gestrichen (SVIT ad 712g Rz. 40 sagt das Gegenteil); angesetzt
	// bleibt die Einstimmigkeit als ausgewiesene Vorsichtsregel.
	'k-reglement-eigene-schranke': {
		rechtsgrundlage:
			'Reglement der Gemeinschaft; Zulässigkeit der Selbstverschärfung umstritten ' +
			'(ZGB Art. 712g Abs. 3)',
		begruendung:
			'Verlangt das Reglement für seine eigene Änderung die Einstimmigkeit, ist ' +
			'umstritten, ob diese Verschärfung überhaupt gilt: Der Kommentar hält sie für ' +
			'unzulässig, andere Autoren lassen sie zu, das Bundesgericht hat die Frage ' +
			'offengelassen. Sicher ist ein Beschluss nur, wenn er auch das strengere ' +
			'reglementarische Erfordernis erreicht — deshalb setzt dieses Werkzeug die ' +
			'Einstimmigkeit an.'
	}
};

/**
 * Zusätzliche Hinweise, die den jeweiligen Lehrstreit auf der Karte
 * ausweisen. Angefügt statt ersetzt: Die bestehenden Hinweise der Knoten
 * bleiben wörtlich stehen.
 */
const HINWEIS_ANHAENGE: Record<string, string[]> = {
	'k-ausschlussklage': [
		'Die Zählbasis ist umstritten: Der SVIT-Kommentar lässt das einfache Mehr der ' +
			'anwesenden und vertretenen Eigentümer genügen (Art. 712a Rz. 214, mit Kohler; ' +
			'anders Strittmatter, der alle Eigentümer zählt); das Bundesgericht hat die Frage ' +
			'nicht entschieden. Dieses Werkzeug rechnet über alle — wer diese Mehrheit ' +
			'erreicht, genügt beiden Lesarten.',
		'Ob das Reglement dieses Mehr verschärfen darf, ist ebenfalls umstritten: Der ' +
			'Wortlaut («wenn nichts anderes vereinbart ist») lässt eine Vereinbarung zu, der ' +
			'SVIT-Kommentar hält eine Verschärfung für unzulässig (Art. 712a Rz. 206). Steht ' +
			'in Ihrem Reglement eine strengere Bestimmung, klären Sie ihre Geltung vor der ' +
			'Versammlung — wer auch das reglementarische Mehr erreicht, ist auf der sicheren ' +
			'Seite.'
	],
	'k-prozessfuehrung': [
		'Das Mehr ist umstritten: Der SVIT-Kommentar verlangt in der Regel das qualifizierte ' +
			'Mehr (Art. 712t Rz. 74), andere Autoren lassen das einfache genügen; das ' +
			'Bundesgericht hat die Frage offengelassen (BGer 5A_198/2014 E. 6.1.2). Dieses ' +
			'Werkzeug setzt das strengere Erfordernis an — wer es erreicht, genügt beiden ' +
			'Lesarten.'
	],
	'k-zustaendigkeit-gewoehnlich': [
		'Der SVIT-Kommentar nennt für denselben Artikel beide Mehre: das einfache ' +
			'(Art. 712g Rz. 34, Art. 712m Rz. 166) und das qualifizierte (Art. 712a Rz. 109). ' +
			'Wer das qualifizierte Mehr erreicht, genügt beiden Lesarten.'
	],
	'k-reglement-eigene-schranke': [
		'Zum Streit: SVIT-Kommentar Art. 712g Rz. 40 und 125 halten die Erschwerung für ' +
			'unzulässig, Steinauer und der Beobachter lassen sie zu; BGer 5C.50/2004 E. 4.2 ' +
			'(in BGE 130 III 450 nicht publiziert) lässt die Frage offen. Erreicht der ' +
			'Beschluss nur das qualifizierte Mehr, ist er anfechtbar, falls die Klausel gilt.'
	],
	'k-baulich-luxurioes': [
		// L-4: Der Streit über die Zählung der Einstimmigkeit.
		'Auch die Zählung ist umstritten: Nach dem SVIT-Kommentar genügt die Zustimmung ' +
			'sämtlicher anwesenden und vertretenen Eigentümer (Art. 712m Rz. 197; anders Manz), ' +
			'nach dem WISS-Skript braucht es alle im Grundbuch aufgeführten. Dieses Werkzeug ' +
			'rechnet über alle Eigentümer — wer das erreicht, genügt beiden Lesarten.'
	]
};

/** L-6: Die Sperre heisst jetzt «umstritten», nicht mehr «zwingend». */
const VERHALTEN_NEU: Record<string, Reglementsverhalten> = {
	'k-ausschlussklage': 'gesperrt_reglement'
};

/**
 * «Wenn etwas umstritten ist, ist dies auch zu deklarieren» (Auftraggeber,
 * 16.08.2026). Beim Nachlesen der Lehrstreite zeigte sich ein weiterer,
 * bisher als Tatsache dargestellter Streit: Dass Enthaltungen und nicht
 * abgegebene Stimmen in der Bezugsgrösse bleiben, ist herrschende Meinung,
 * aber nicht unumstritten — eine Mindermeinung zählt nur die abgegebenen
 * Stimmen (SVIT ad 712m Rz. 181: «Diese letzte Aussage ist aber nicht
 * unumstritten», mit beiden Literaturlisten). Die herrschende Zählung ist
 * zugleich die strengere und bleibt; der Streit steht jetzt dabei.
 */
const ENTHALTUNGS_DEKLARATION =
	' Auch das ist nicht unumstritten: Eine Mindermeinung zählt nur die abgegebenen ' +
	'Stimmen (SVIT-Kommentar, Art. 712m Rz. 181). Dieses Werkzeug folgt der herrschenden, ' +
	'strengeren Zählung — ein Beschluss, der so besteht, besteht auch nach der milderen.';

export const REGELWERK_2026_08_16 = {
	...REGELWERK_2026_08_15,
	fassung: '2026-08-16',

	ergebnistypen: REGELWERK_2026_08_15.ergebnistypen.map((t) =>
		(t.typ === 'einfaches_mehr' || t.typ === 'qualifiziertes_mehr') &&
		t.stimmwirkungen.art === 'festgelegt'
			? {
					...t,
					stimmwirkungen: {
						...t.stimmwirkungen,
						wirkung: t.stimmwirkungen.wirkung + ENTHALTUNGS_DEKLARATION
					}
				}
			: t
	),

	juristischGegengelesen: false,
	freigabevermerk:
		'Fachlich geprüft und vorläufig angenommen am 30.07.2026, Hilfetexte geschärft am ' +
		'05.08.2026, Befunde der Inhaltsprüfung umgesetzt am 15.08.2026 (Blöcke 1 und 2). ' +
		'Am 16.08.2026 sind die Lehrstreite L-1 bis L-6 nach dem Strengstprinzip ' +
		'vorentschieden: Bei Uneinigkeit der Quellen gilt die strengere vertretbare ' +
		'Auslegung, der Streit steht auf der Karte. Die juristische Gegenlesung steht aus; ' +
		'bis dahin ist jedes Ergebnis ein Vorschlag an die Sitzungsleitung und keine ' +
		'Feststellung.',

	knoten: REGELWERK_2026_08_15.knoten.map((k): Ergebnisknoten => {
		const neu = KNOTEN_NEU[k.id];
		const anhang = HINWEIS_ANHAENGE[k.id];
		const verhalten = VERHALTEN_NEU[k.id];
		const basis = { ...k, ...(neu ?? {}) };
		return {
			...basis,
			...(anhang ? { hinweise: [...(basis.hinweise ?? []), ...anhang] } : {}),
			...(verhalten !== undefined ? { reglementsverhalten: verhalten } : {})
		};
	})
} satisfies import('$lib/domain/regelwerk').Regelwerk;
