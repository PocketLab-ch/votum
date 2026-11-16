/**
 * Quorums-Regelwerk, Fassung 2026-07-30.
 *
 * **Daten, kein Code.** Diese Datei enthält keine einzige Verzweigung im Sinne
 * der Programmiersprache — sie beschreibt den Entscheidbaum, und der Kern liest
 * ihn (AD-4). Eine Gesetzesrevision erzeugt eine **neue** Datei mit neuer
 * Fassungskennung; diese hier bleibt für immer unverändert, damit ein Beschluss,
 * der nach ihr gefasst wurde, später noch erklärbar ist.
 *
 * Grundlage ist der Entscheidbaum der Website (`quorum-finder-inhalt.md`,
 * 07.07.2026) mit den neun Befunden aus der kritischen Prüfung vom 30.07.2026:
 *
 *   1. Wortlaut «anwesende oder vertretene» einheitlich, auch beim qualifizierten
 *      Mehr — sonst sähe die Vollmacht dort entwertet aus.
 *   2. Wirkung von Enthaltung und Nichtabgabe bei **jedem** Typ maschinenlesbar.
 *   3. Ergebnistyp «keine Abstimmung» für Kenntnisnahmen ergänzt.
 *   4. Hinweis auf gemischte Geschäfte und die Trennung in Untertraktanden.
 *   5. Reglementsvorbehalt bleibt Hinweis, wo nichts hinterlegt ist (Story 2.4).
 *   6. Ausstand bleibt zurückgestellt.
 *   7./8. Standardtraktanden und Organwahlen haben eigene Ausgänge.
 *   9. Bezugsgrösse ist ein eigenes Merkmal je Knoten, getrennt für Köpfe und
 *      Wertquoten — der gewichtigste Befund.
 *
 * Warum eine TypeScript-Datei und keine JSON-Datei: `satisfies Regelwerk` lässt
 * die Typprüfung über den Inhalt laufen. Ein Knoten ohne Bezugsgrösse bricht
 * damit den Bau, statt im Saal aufzufallen.
 */
import type { Regelwerk } from '$lib/domain/regelwerk';

export const REGELWERK_2026_07_30 = {
	fassung: '2026-07-30',

	// Vorläufig angenommen, nicht juristisch freigegeben. Solange das so steht,
	// weist die Oberfläche bei jedem hergeleiteten Erfordernis darauf hin.
	juristischGegengelesen: false,
	freigabevermerk:
		'Fachlich geprüft und vorläufig angenommen am 30.07.2026 (Prüfbericht zum Entscheidbaum). ' +
		'Die juristische Gegenlesung steht aus; bis dahin ist jedes Ergebnis ein Vorschlag an die ' +
		'Sitzungsleitung und keine Feststellung.',

	quellen: [
		'ZGB, konsolidierte Fassung Stand 01.01.2026 (Fedlex). Die laufende Revision des Stockwerkeigentumsrechts ist darin nicht enthalten.',
		'BGE 144 III 510 (am Volltext verifiziert): Kopfmehr nach den Anwesenden via ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2.',
		'BGer 5A_735/2019 E. 3.3.1 (am Volltext verifiziert): Ermächtigung zur Ausschlussklage durch Mehrheitsbeschluss aller Miteigentümer mit Ausnahme des Beklagten.',
		'WISS-Skript «Begründung & Bewirtschaftung von Stockwerkeigentum» (2021), Kap. 12.4/12.7/12.8.',
		'Beobachter-Ratgeber «Stockwerkeigentum», Kap. 6 und 7.'
	],

	reglementsvorbehalt:
		'Ihr Reglement oder der Begründungsakt kann ein anderes Erfordernis vorsehen — das ' +
		'gesetzliche gilt nur, wenn dort nichts anderes steht.',

	gemischteGeschaefte:
		'Verfolgt das Vorhaben mehrere Zwecke zugleich — etwa eine notwendige Dachsanierung mit ' +
		'gleichzeitigem Ausbau der Dachterrasse — ist das vor der Versammlung mit dem Antragsteller ' +
		'zu klären. Der bessere Weg ist die Trennung in zwei Traktanden, weil dann jeder Teil sein ' +
		'eigenes Erfordernis bekommt. Wird nicht getrennt, gilt für das ganze Geschäft das strengere ' +
		'Erfordernis — auch für den notwendigen Teil, der für sich allein mit einfachem Mehr auskäme.',

	// Die sechs Bestimmungen, deren Wortlaut die Mehrheit «aller Miteigentümer»
	// verlangt. Jeder Knoten, der sich auf eine von ihnen beruft, muss die
	// Abweichung festhalten; der Prüflauf über das Regelwerk erzwingt das.
	wortlautArtikel: [
		'ZGB Art. 647 Abs. 1bis',
		'ZGB Art. 647a Abs. 2',
		'ZGB Art. 647b Abs. 1',
		'ZGB Art. 647c',
		'ZGB Art. 647d Abs. 1',
		'ZGB Art. 647e Abs. 2'
	],
	wortlautErklaerung:
		'Der Gesetzeswortlaut verlangt hier die Mehrheit «aller Miteigentümer». Nach BGE 144 III 510 ' +
		'und herrschender Lehre zählt an der Versammlung gleichwohl die Mehrheit der anwesenden und ' +
		'vertretenen Stimmen — sonst könnte eine beschlussfähige Zweitversammlung nach ZGB Art. 712p ' +
		'Abs. 3 nie über notwendigen Unterhalt entscheiden. Dieses Werkzeug folgt der Rechtsprechung.',

	// ── Die fünf Ausgänge ───────────────────────────────────────────────────
	ergebnistypen: [
		{
			typ: 'keine_abstimmung',
			kurz: 'E0',
			bezeichnung: 'Keine Abstimmung',
			formel: 'Das Traktandum wird zur Kenntnis genommen; es wird nicht abgestimmt.',
			schwellen: { kopf: null, quoten: null },
			stimmwirkungen: {
				art: 'keine_abstimmung',
				satz:
					'Hier wird nicht abgestimmt. Wortmeldungen und Vorbehalte gehören ins Protokoll, ' +
					'ein Ergebnis entsteht nicht.'
			}
		},
		{
			typ: 'einfaches_mehr',
			kurz: 'E1',
			bezeichnung: 'Einfaches Mehr',
			formel:
				'Mehrheit der Stimmen der anwesenden oder vertretenen Eigentümer ' +
				'(ZGB Art. 67 Abs. 2 i.V.m. Art. 712m Abs. 2).',
			schwellen: { kopf: { zaehler: 1, nenner: 2, art: 'mehr_als' }, quoten: null },
			stimmwirkungen: {
				art: 'festgelegt',
				enthaltung: 'in_basis',
				nichtabgabe: 'in_basis',
				wirkung:
					'Eine Enthaltung bleibt in der Bezugsgrösse und wirkt deshalb faktisch wie ein Nein; ' +
					'ebenso eine Stimme, die abgegeben werden könnte, aber nicht abgegeben wird.'
			}
		},
		{
			typ: 'qualifiziertes_mehr',
			kurz: 'E2',
			bezeichnung: 'Qualifiziertes Mehr',
			formel:
				'Mehrheit der anwesenden oder vertretenen Köpfe und zugleich mehr als die Hälfte ' +
				'aller Wertquoten (bei einem Nenner von 1000 also mindestens 501). Köpfe relativ, ' +
				'Wertquoten absolut.',
			schwellen: {
				kopf: { zaehler: 1, nenner: 2, art: 'mehr_als' },
				quoten: { zaehler: 1, nenner: 2, art: 'mehr_als' }
			},
			stimmwirkungen: {
				art: 'festgelegt',
				enthaltung: 'in_basis',
				nichtabgabe: 'in_basis',
				wirkung:
					'Eine Enthaltung bleibt in der Bezugsgrösse und wirkt deshalb faktisch wie ein Nein; ' +
					'ebenso eine Stimme, die abgegeben werden könnte, aber nicht abgegeben wird.'
			}
		},
		{
			typ: 'einstimmigkeit',
			kurz: 'E3',
			bezeichnung: 'Einstimmigkeit',
			formel:
				'Zustimmung sämtlicher im Grundbuch eingetragener Eigentümer, nicht nur der Anwesenden.',
			schwellen: { kopf: { zaehler: 1, nenner: 1, art: 'mindestens' }, quoten: null },
			stimmwirkungen: {
				art: 'festgelegt',
				enthaltung: 'in_basis',
				nichtabgabe: 'in_basis',
				wirkung:
					'Nötig ist die ausdrückliche Zustimmung jedes Einzelnen; Enthaltung und Nichtabgabe ' +
					'verhindern sie gleichermassen. Zustimmungen sind nachträglich schriftlich einzuholen.'
			}
		},
		{
			typ: 'reglementsmehr',
			kurz: 'E5',
			bezeichnung: 'Reglementsmehr',
			formel:
				'Was das Reglement dieser Gemeinschaft für diese Geschäftsart vorsieht. Die Schwelle ' +
				'steht in der hinterlegten Regel, nicht im Gesetz.',
			schwellen: { kopf: null, quoten: null },
			stimmwirkungen: {
				art: 'festgelegt',
				enthaltung: 'in_basis',
				nichtabgabe: 'in_basis',
				wirkung:
					'Eine Enthaltung bleibt in der Bezugsgrösse und wirkt deshalb faktisch wie ein Nein; ' +
					'ebenso eine Stimme, die abgegeben werden könnte, aber nicht abgegeben wird. Sieht das ' +
					'Reglement etwas anderes vor, steht es bei der hinterlegten Regel.'
			}
		},
		{
			typ: 'grenzfall',
			kurz: 'E4',
			bezeichnung: 'Grenzfall',
			formel:
				'Keine belastbare Antwort möglich. Die Sitzungsleitung setzt das Erfordernis selbst ' +
				'und trägt die Verantwortung dafür.',
			schwellen: { kopf: null, quoten: null },
			stimmwirkungen: {
				art: 'aus_gewaehltem_erfordernis',
				satz:
					'Wie Enthaltung und Nichtabgabe wirken, steht erst fest, wenn die Sitzungsleitung ' +
					'ein Erfordernis gesetzt hat. Ein Wert an dieser Stelle wäre eine Regel, die es ' +
					'nicht gibt.'
			}
		}
	],

	// ── Einstiege ───────────────────────────────────────────────────────────
	aeste: [
		{
			id: 'a-kenntnisnahme',
			titel: 'Kenntnisnahme, ohne Beschluss',
			beschreibung: 'Begrüssung, Jahresbericht, Information, Verschiedenes.',
			einstieg: 'k-kenntnisnahme'
		},
		{
			id: 'a-bauen',
			titel: 'Bauen, sanieren, erneuern',
			beschreibung: 'Dach, Heizung, Fassade, Lift, Solaranlage.',
			einstieg: 'f1-0'
		},
		{
			id: 'a-organe',
			titel: 'Bewirtschaftung und Organe',
			beschreibung: 'Bewirtschaftung wählen oder abberufen, Ausschuss, Revisionsstelle.',
			einstieg: 'f2-1'
		},
		{
			id: 'a-reglement',
			titel: 'Reglement oder Hausordnung ändern',
			beschreibung: 'Auch Kostenschlüssel und ausschliessliche Nutzungsrechte.',
			einstieg: 'f3-1'
		},
		{
			id: 'a-geld',
			titel: 'Geld und Jahresgeschäfte',
			beschreibung: 'Jahresrechnung, Budget, Erneuerungsfonds, Décharge.',
			einstieg: 'f4-1'
		},
		{
			id: 'a-nutzung',
			titel: 'Nutzung ändern',
			beschreibung: 'Gewerbe, Vermietung, Umnutzung.',
			einstieg: 'f5-1'
		},
		{
			id: 'a-grundordnung',
			titel: 'Grundstück und Grundordnung',
			beschreibung: 'Verkauf, Wertquoten, Sonderrecht, Aufhebung.',
			einstieg: 'f6-1'
		},
		{
			id: 'a-verwaltung',
			titel: 'Sonstige Verwaltungshandlung',
			beschreibung: 'Verträge, Anstellungen, Anschaffungen.',
			einstieg: 'f7-1'
		},
		{
			id: 'a-sonderfaelle',
			titel: 'Sonderfälle',
			beschreibung: 'Ausschlussklage, Zirkularbeschluss, Zuständigkeit neu regeln.',
			einstieg: 'f8-1'
		}
	],

	// ── Zwischenfragen ──────────────────────────────────────────────────────
	fragen: [
		{
			id: 'f1-0',
			text: 'Geht es nur um eine kleine Reparatur ohne nennenswerte Kosten?',
			hilfe:
				'Tropfender Wasserhahn im Treppenhaus, Ersatz einer Leuchte, kleiner Malerauftrag. ' +
				'Das ist keine bauliche Massnahme, sondern gewöhnliche Verwaltung.',
			antworten: [
				{ id: 'f1-0-ja', text: 'Ja, eine kleine Reparatur', ziel: 'k-verwaltung-gewoehnlich' },
				{ id: 'f1-0-nein', text: 'Nein, es geht um mehr', ziel: 'f1-1' }
			]
		},
		{
			id: 'f1-1',
			text: 'Ist die Massnahme nötig, um Wert oder Gebrauchsfähigkeit zu erhalten?',
			hilfe:
				'Reparatur, Ersatz von Defektem durch Gleichwertiges, behördliche Auflage. ' +
				'Massgebend ist, ob ohne die Massnahme Wert oder Gebrauchsfähigkeit leiden.',
			antworten: [
				{ id: 'f1-1-ja', text: 'Ja, sie erhält Wert oder Gebrauchsfähigkeit', ziel: 'k-baulich-notwendig' },
				{ id: 'f1-1-nein', text: 'Nein, sie geht darüber hinaus', ziel: 'f1-2' }
			]
		},
		{
			id: 'f1-2',
			text: 'Bringt die Massnahme der Gemeinschaft eine Wertsteigerung oder eine bessere Wirtschaftlichkeit?',
			hilfe:
				'Massgebend ist der Nutzen der **Gemeinschaft**, nicht der einzelner Eigentümer. ' +
				'Fassadenisolation, Heizungsersatz mit Systemwechsel, Photovoltaik.',
			antworten: [
				{ id: 'f1-2-ja', text: 'Ja, für die Gemeinschaft', ziel: 'k-baulich-nuetzlich' },
				{ id: 'f1-2-nein', text: 'Nein', ziel: 'f1-3' },
				{ id: 'f1-2-unsicher', text: 'Das ist gerade die Streitfrage', ziel: 'k-grenzfall-nuetzlich' }
			]
		},
		{
			id: 'f1-3',
			text: 'Dient die Massnahme nur der Verschönerung, der Ansehnlichkeit oder der Bequemlichkeit — oder liegt der Nutzen praktisch nur bei einzelnen Eigentümern?',
			hilfe: 'Marmor-Eingangshalle, Gemeinschaftssauna, Springbrunnen, Terrassenplatten auf einer Sondernutzungsfläche.',
			antworten: [
				{ id: 'f1-3-ja', text: 'Ja', ziel: 'f1-4' },
				{
					id: 'f1-3-nein',
					text: 'Weder das eine noch das andere',
					ziel: 'k-grenzfall-nuetzlich',
					hilfe: 'Dann passt keine der drei gesetzlichen Kategorien sauber — das ist ein Grenzfall.'
				},
				{ id: 'f1-3-unsicher', text: 'Unsicher', ziel: 'k-grenzfall-nuetzlich' }
			]
		},
		{
			id: 'f1-4',
			text: 'Wird ein nicht zustimmender Eigentümer im Gebrauch dauernd beeinträchtigt?',
			hilfe:
				'ZGB Art. 647e Abs. 2 öffnet einen Weg ohne Einstimmigkeit — aber nur, wenn keine ' +
				'dauernde Beeinträchtigung vorliegt **und** die übrigen die vorübergehende ' +
				'Beeinträchtigung ersetzen **und** seinen Kostenanteil übernehmen.',
			antworten: [
				{ id: 'f1-4-ja', text: 'Ja, oder es ist unklar', ziel: 'k-baulich-luxurioes' },
				{
					id: 'f1-4-nein',
					text: 'Nein, und die übrigen übernehmen Ersatz und seinen Kostenanteil',
					ziel: 'k-baulich-luxurioes-ausweg'
				}
			]
		},
		{
			id: 'f2-1',
			text: 'Worum geht es genau?',
			antworten: [
				{ id: 'f2-1-waehlen', text: 'Neue Bewirtschaftung wählen', ziel: 'k-bewirtschaftung-waehlen' },
				{
					id: 'f2-1-erweitert',
					text: 'Bewirtschaftung mit Kompetenzen über die gewöhnliche Verwaltung hinaus ausstatten',
					ziel: 'k-bewirtschaftung-erweitert'
				},
				{ id: 'f2-1-abberufen', text: 'Bisherige Bewirtschaftung abberufen', ziel: 'k-bewirtschaftung-abberufen' },
				{
					id: 'f2-1-organ',
					text: 'Anderes Organ wählen — Ausschuss, Revisionsstelle, Versammlungsleitung',
					ziel: 'k-organ-waehlen'
				}
			]
		},
		{
			id: 'f3-1',
			text: 'Was soll geändert werden?',
			antworten: [
				{
					id: 'f3-1-hausordnung',
					text: 'Hausordnung — Ruhezeiten, Waschküche, Grillieren',
					ziel: 'k-hausordnung'
				},
				{
					id: 'f3-1-reglement',
					text: 'Reglement, gewöhnliche Bestimmung — etwa Kostenschlüssel oder Einladungsfrist',
					ziel: 'k-reglement-normal'
				},
				{
					id: 'f3-1-quoren',
					text: 'Reglement, Bestimmung über Zuständigkeit oder Quoren für Verwaltung und bauliche Massnahmen',
					ziel: 'k-reglement-quoren'
				},
				{
					id: 'f3-1-selbst',
					text: 'Das Reglement verlangt für seine eigene Änderung Einstimmigkeit',
					ziel: 'k-reglement-eigene-schranke'
				},
				{
					id: 'f3-1-nutzungsrecht',
					text: 'Zuteilung ausschliesslicher Nutzungsrechte ändern — Gartensitzplatz, Parkplatz',
					ziel: 'k-nutzungsrecht-zuteilung'
				}
			]
		},
		{
			id: 'f4-1',
			text: 'Um welches Jahresgeschäft geht es?',
			antworten: [
				{
					id: 'f4-1-rechnung',
					text: 'Jahresrechnung, Budget oder Kostenverteilung genehmigen',
					ziel: 'k-jahresrechnung'
				},
				{
					id: 'f4-1-fonds',
					text: 'Erneuerungsfonds schaffen oder Beiträge festsetzen',
					ziel: 'k-erneuerungsfonds'
				},
				{ id: 'f4-1-decharge', text: 'Décharge oder Protokollgenehmigung', ziel: 'k-decharge' },
				{
					id: 'f4-1-prozess',
					text: 'Bewirtschaftung zur Prozessführung ermächtigen',
					ziel: 'k-prozessfuehrung'
				},
				{
					id: 'f4-1-verwendung',
					text: 'Mittel des Erneuerungsfonds für ein konkretes Bauvorhaben verwenden',
					ziel: 'f1-1',
					hilfe:
						'Die Verwendung folgt dem Erfordernis des Vorhabens: Eine Heizungssanierung wird ' +
						'nicht dadurch einfacher, dass sie aus dem Fonds bezahlt wird.'
				}
			]
		},
		{
			id: 'f5-1',
			text: 'Ändert sich nur die Art der Benutzung — oder der Charakter der Liegenschaft?',
			antworten: [
				{
					id: 'f5-1-weise',
					text: 'Nur die Benutzungsweise, innerhalb des bisherigen Zwecks',
					ziel: 'k-benutzungsweise'
				},
				{
					id: 'f5-1-zweck',
					text: 'Der Zweck der Liegenschaft kippt — aus Wohnen wird Gewerbe',
					ziel: 'k-zweckbestimmung'
				},
				{ id: 'f5-1-unsicher', text: 'Das lässt sich nicht klar sagen', ziel: 'k-grenzfall-nutzung' }
			]
		},
		{
			id: 'f6-1',
			text: 'Was steht an?',
			antworten: [
				{
					id: 'f6-1-verkauf',
					text: 'Teil des gemeinschaftlichen Grundstücks verkaufen oder mit einer Dienstbarkeit belasten',
					ziel: 'k-grundstueck-verkauf'
				},
				{
					id: 'f6-1-sonderrecht',
					text: 'Gemeinschaftliche Teile und Sonderrecht neu abgrenzen',
					ziel: 'k-sonderrecht-abgrenzen'
				},
				{ id: 'f6-1-wertquoten', text: 'Wertquoten ändern', ziel: 'k-wertquoten-aendern' },
				{
					id: 'f6-1-vorkauf',
					text: 'Vorkaufsrecht oder Einspracherecht begründen oder aufheben',
					ziel: 'k-vorkaufsrecht'
				},
				{ id: 'f6-1-aufhebung', text: 'Stockwerkeigentum aufheben', ziel: 'k-aufhebung' }
			]
		},
		{
			id: 'f7-1',
			text: 'Wie gewichtig ist die Verwaltungshandlung?',
			hilfe: 'Die Grenze ist fliessend; im Zweifel als wichtigere behandeln.',
			antworten: [
				{
					id: 'f7-1-gewoehnlich',
					text: 'Gewöhnlich — laufende Verträge, Inkasso, kleine Ausbesserungen',
					ziel: 'k-verwaltung-gewoehnlich'
				},
				{
					id: 'f7-1-wichtig',
					text: 'Wichtiger — Miet- oder Pachtverträge, Anstellung, teure Anschaffung',
					ziel: 'k-verwaltung-wichtig'
				},
				{ id: 'f7-1-unsicher', text: 'Das ist gerade die Frage', ziel: 'k-grenzfall-verwaltung' }
			]
		},
		{
			id: 'f8-1',
			text: 'Welcher Sonderfall?',
			antworten: [
				{
					id: 'f8-1-ausschluss',
					text: 'Bewirtschaftung zur Ausschlussklage gegen einen Eigentümer ermächtigen',
					ziel: 'k-ausschlussklage'
				},
				{
					id: 'f8-1-zirkular',
					text: 'Beschluss auf dem Zirkularweg, ausserhalb der Versammlung',
					ziel: 'k-zirkularbeschluss'
				},
				{
					id: 'f8-1-zustaendigkeit',
					text: 'Zuständigkeit für gewöhnliche Verwaltungshandlungen anders regeln',
					ziel: 'k-zustaendigkeit-gewoehnlich'
				}
			]
		}
	],

	// ── Ergebnisknoten ──────────────────────────────────────────────────────
	knoten: [
		{
			id: 'k-kenntnisnahme',
			titel: 'Kenntnisnahme',
			typ: 'keine_abstimmung',
			geschaeftsart: 'kenntnisnahme',
			rechtsgrundlage: 'keine — es wird nicht abgestimmt',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Das Traktandum verlangt keinen Beschluss. Ein Mehrheitserfordernis zu setzen, wo nichts ' +
				'beschlossen wird, erzeugte einen Beschluss, den niemand gefasst hat.',
			beispiele: ['Begrüssung und Feststellung der Beschlussfähigkeit', 'Jahresbericht der Bewirtschaftung', 'Verschiedenes'],
			hinweise: [
				'Wird während der Behandlung doch ein Antrag gestellt, ist das ein neues Traktandum mit eigenem Erfordernis.'
			]
		},

		// Ast 1 — Bauen
		{
			id: 'k-baulich-notwendig',
			titel: 'Notwendige bauliche Massnahme',
			typ: 'einfaches_mehr',
			geschaeftsart: 'baulich_notwendig',
			rechtsgrundlage: 'ZGB Art. 647c',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			wortlautAbweichung: true,
			begruendung:
				'Die Massnahme erhält Wert und Gebrauchsfähigkeit der Sache. Solche Arbeiten dürfen nicht ' +
				'an einer Minderheit scheitern, weil sonst die Substanz leidet.',
			beispiele: [
				'Dachreparatur',
				'Ersatz der defekten Heizung durch Gleichwertiges',
				'Liftsanierung wegen Sicherheitsvorschriften',
				'Stützmauer gegen Hangrutsch'
			],
			hinweise: [
				'Auf notwendige Massnahmen hat jeder einzelne Eigentümer einen Anspruch, notfalls über das Gericht (ZGB Art. 647 Abs. 2 Ziff. 1).',
				'Bei unmittelbar drohendem Schaden darf jeder Eigentümer sofort handeln (ZGB Art. 647 Abs. 2 Ziff. 2).'
			]
		},
		{
			id: 'k-baulich-nuetzlich',
			titel: 'Nützliche bauliche Massnahme',
			typ: 'qualifiziertes_mehr',
			geschaeftsart: 'baulich_nuetzlich',
			rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten',
			zustimmungBetroffenerNoetig: false,
			wortlautAbweichung: true,
			begruendung:
				'Die Massnahme steigert Wert oder Wirtschaftlichkeit für die Gemeinschaft, ist aber nicht ' +
				'zum Erhalt nötig. Wer sie mitträgt, zahlt für einen Nutzen, den er nicht verlangt hat — ' +
				'deshalb die zweite Schranke über die Wertquoten.',
			beispiele: [
				'Fassadenisolation',
				'Heizungsersatz mit Systemwechsel auf eine Wärmepumpe',
				'Photovoltaik-Anlage',
				'Balkonverglasung für alle'
			],
			hinweise: [
				'Auch bei erreichtem Mehr: Wird einem Eigentümer der Gebrauch erheblich und dauernd erschwert, geht es nicht ohne seine Zustimmung (ZGB Art. 647d Abs. 2).',
				'Sind die Kosten für einen Eigentümer unzumutbar, müssen die übrigen den unzumutbaren Teil übernehmen (ZGB Art. 647d Abs. 3).'
			]
		},
		{
			id: 'k-baulich-luxurioes',
			titel: 'Luxuriöse bauliche Massnahme',
			typ: 'einstimmigkeit',
			geschaeftsart: 'baulich_luxurioes',
			rechtsgrundlage: 'ZGB Art. 647e Abs. 1',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Die Massnahme dient der Verschönerung, der Ansehnlichkeit oder der Bequemlichkeit. ' +
				'Niemand soll für Annehmlichkeiten zahlen müssen, die er nicht will.',
			beispiele: [
				'Marmor-Eingangshalle',
				'Gemeinschaftssauna',
				'Springbrunnen',
				'Terrassenplatten auf einer Sondernutzungsfläche (BGE 141 III 357)'
			],
			hinweise: [
				'Ein Weg ohne Einstimmigkeit besteht nach ZGB Art. 647e Abs. 2, wenn der nicht zustimmende Eigentümer nicht dauernd beeinträchtigt wird und die übrigen ihm die vorübergehende Beeinträchtigung ersetzen und seinen Kostenanteil übernehmen.'
			]
		},
		{
			id: 'k-baulich-luxurioes-ausweg',
			titel: 'Luxuriöse Massnahme mit Kostenübernahme durch die übrigen',
			typ: 'qualifiziertes_mehr',
			geschaeftsart: 'baulich_luxurioes',
			rechtsgrundlage: 'ZGB Art. 647e Abs. 2',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten',
			zustimmungBetroffenerNoetig: false,
			wortlautAbweichung: true,
			begruendung:
				'Das Gesetz lässt die luxuriöse Massnahme ohne Einstimmigkeit zu, wenn der Nichtzustimmende ' +
				'weder dauernd beeinträchtigt noch belastet wird. Beides sind Bedingungen, nicht Absichten.',
			hinweise: [
				'Die Zusage, den Kostenanteil des Nichtzustimmenden zu übernehmen, gehört in den Beschlusstext — sonst ist sie später nicht belegbar.',
				'Wird der Eigentümer doch dauernd beeinträchtigt, fällt die Massnahme zurück auf Einstimmigkeit nach ZGB Art. 647e Abs. 1.'
			]
		},
		{
			id: 'k-grenzfall-nuetzlich',
			titel: 'Grenzfall zwischen nützlich und luxuriös',
			typ: 'grenzfall',
			geschaeftsart: 'baulich_nuetzlich',
			rechtsgrundlage: 'ZGB Art. 647d und Art. 647e',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Die Abgrenzung zwischen nützlicher und luxuriöser Massnahme ist der Klassiker vor ' +
				'Bundesgericht. Eine pauschale Antwort gäbe eine Sicherheit vor, die es nicht gibt.',
			empfehlung:
				'Im Zweifel das strengere Erfordernis ansetzen. Wird zu schwach abgestimmt, ist der ' +
				'Beschluss anfechtbar, und die überstimmte Minderheit muss die Kosten nicht mittragen. ' +
				'Faustregel des Bundesgerichts: je kleiner die Wertsteigerung im Verhältnis zu den Kosten, ' +
				'desto eher luxuriös.'
		},

		// Ast 2 — Organe
		{
			id: 'k-bewirtschaftung-waehlen',
			titel: 'Bewirtschaftung wählen',
			typ: 'einfaches_mehr',
			geschaeftsart: 'organe',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 2',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung: 'Die Bestellung der Bewirtschaftung gehört zu den Befugnissen der Versammlung.',
			hinweise: [
				'Soll die Bewirtschaftung Kompetenzen über die gewöhnliche Verwaltung hinaus erhalten, ist das eine wichtigere Verwaltungshandlung und verlangt qualifiziertes Mehr (ZGB Art. 647b Abs. 1).'
			]
		},
		{
			id: 'k-bewirtschaftung-erweitert',
			titel: 'Bewirtschaftung mit erweiterten Kompetenzen',
			typ: 'qualifiziertes_mehr',
			geschaeftsart: 'organe',
			rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten',
			zustimmungBetroffenerNoetig: false,
			wortlautAbweichung: true,
			begruendung:
				'Wer die Bewirtschaftung ermächtigt, über die gewöhnliche Verwaltung hinaus zu handeln, ' +
				'überträgt Entscheidungen, die sonst der Versammlung zustünden.'
		},
		{
			id: 'k-bewirtschaftung-abberufen',
			titel: 'Bewirtschaftung abberufen',
			typ: 'einfaches_mehr',
			geschaeftsart: 'organe',
			rechtsgrundlage: 'ZGB Art. 712r Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Die Versammlung kann die Bewirtschaftung jederzeit abberufen, unter Vorbehalt von ' +
				'Entschädigungsansprüchen.',
			hinweise: [
				'Abberufung aus der Organstellung und Kündigung des Bewirtschaftungsvertrags sind zwei verschiedene Vorgänge mit eigenen Fristen.',
				'Lehnt die Versammlung die Abberufung trotz wichtiger Gründe ab, kann jeder Eigentümer binnen Monatsfrist die gerichtliche Abberufung verlangen (ZGB Art. 712r Abs. 2).',
				'Eine vom Gericht eingesetzte Bewirtschaftung kann nur mit Bewilligung des Gerichts abberufen werden (ZGB Art. 712r Abs. 3).'
			]
		},
		{
			id: 'k-organ-waehlen',
			titel: 'Ausschuss, Revisionsstelle oder Versammlungsleitung wählen',
			typ: 'einfaches_mehr',
			geschaeftsart: 'organe',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 3',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Die Bestellung eines Ausschusses oder einer Revisionsstelle gehört zu den Befugnissen ' +
				'der Versammlung und folgt derselben Regel wie die Wahl der Bewirtschaftung.'
		},

		// Ast 3 — Reglement
		{
			id: 'k-hausordnung',
			titel: 'Hausordnung erlassen oder ändern',
			typ: 'einfaches_mehr',
			geschaeftsart: 'hausordnung',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Die Hausordnung regelt Nutzungsdetails des Alltags. Die Änderung folgt derselben Regel ' +
				'wie der Erlass.',
			beispiele: ['Ruhezeiten', 'Benutzung der Waschküche', 'Grillieren auf dem Balkon']
		},
		{
			id: 'k-reglement-normal',
			titel: 'Reglement ändern, gewöhnliche Bestimmung',
			typ: 'qualifiziertes_mehr',
			geschaeftsart: 'reglement',
			rechtsgrundlage: 'ZGB Art. 712g Abs. 3',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Das Reglement bindet alle Eigentümer dauerhaft. Seine Änderung verlangt deshalb mehr ' +
				'als das einfache Mehr, aber keine Einstimmigkeit.',
			beispiele: ['Kostenverteilschlüssel', 'Einladungsfristen', 'Verfahren der Versammlung']
		},
		{
			id: 'k-reglement-quoren',
			titel: 'Reglementsbestimmung über Zuständigkeit oder Quoren ändern',
			typ: 'einstimmigkeit',
			geschaeftsart: 'reglement',
			rechtsgrundlage: 'ZGB Art. 712g Abs. 2',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Wer von der gesetzlichen Ordnung nach ZGB Art. 647 bis 647e abweicht, greift in den ' +
				'Minderheitenschutz ein. Das geht nur mit der Zustimmung aller.',
			hinweise: [
				'Das gilt in beide Richtungen: Ein Zweidrittelquorum für den Unterhalt einzuführen, verlangt Einstimmigkeit — es Jahre später wieder abzuschaffen, ebenfalls.'
			]
		},
		{
			id: 'k-reglement-eigene-schranke',
			titel: 'Reglement verlangt für seine Änderung selbst Einstimmigkeit',
			typ: 'einstimmigkeit',
			geschaeftsart: 'reglement',
			rechtsgrundlage: 'Reglement der Gemeinschaft i.V.m. ZGB Art. 712g Abs. 3',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Das Reglement darf strenger sein als das Gesetz. Sieht es für seine eigene Änderung ' +
				'Einstimmigkeit vor, gilt diese und nicht das gesetzliche Erfordernis.',
			hinweise: ['Die Fundstelle im Reglement gehört ins Protokoll, damit die Verschärfung belegt ist.']
		},
		{
			id: 'k-nutzungsrecht-zuteilung',
			titel: 'Zuteilung ausschliesslicher Nutzungsrechte ändern',
			typ: 'qualifiziertes_mehr',
			geschaeftsart: 'nutzungsrechte',
			rechtsgrundlage: 'ZGB Art. 712g Abs. 4',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten',
			zustimmungBetroffenerNoetig: true,
			betroffeneErlaeuterung:
				'Betroffen sind die Eigentümer, deren ausschliessliches Nutzungsrecht die Änderung ' +
				'entzieht, schmälert oder verschiebt — nicht die Gesamtheit der Nachbarn.',
			begruendung:
				'Ein zugeteiltes Nutzungsrecht ist eine erworbene Rechtsposition. Die Mehrheit kann sie ' +
				'nicht gegen den Willen des Berechtigten verschieben.',
			beispiele: ['Gartensitzplatz neu zuteilen', 'Parkplätze neu verteilen']
		},

		// Ast 4 — Geld
		{
			id: 'k-jahresrechnung',
			titel: 'Jahresrechnung, Budget oder Kostenverteilung genehmigen',
			typ: 'einfaches_mehr',
			geschaeftsart: 'jahresgeschaefte',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 4',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung: 'Die Genehmigung der Jahresgeschäfte gehört zu den Befugnissen der Versammlung.'
		},
		{
			id: 'k-erneuerungsfonds',
			titel: 'Erneuerungsfonds schaffen oder Beiträge festsetzen',
			typ: 'einfaches_mehr',
			geschaeftsart: 'jahresgeschaefte',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 5',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung: 'Die Äufnung des Erneuerungsfonds ist ein Jahresgeschäft der Versammlung.',
			hinweise: [
				'Die Verwendung der Mittel für ein konkretes Bauvorhaben folgt dem Erfordernis dieses Vorhabens, nicht diesem hier.'
			]
		},
		{
			id: 'k-decharge',
			titel: 'Décharge und Protokollgenehmigung',
			typ: 'einfaches_mehr',
			geschaeftsart: 'jahresgeschaefte',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 1 (Praxis)',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Entlastung und Protokollgenehmigung sind Geschäfte der laufenden Verwaltung; das Gesetz ' +
				'nennt sie nicht ausdrücklich, die Praxis behandelt sie als einfaches Mehr.'
		},
		{
			id: 'k-prozessfuehrung',
			titel: 'Bewirtschaftung zur Prozessführung ermächtigen',
			typ: 'einfaches_mehr',
			geschaeftsart: 'jahresgeschaefte',
			rechtsgrundlage: 'ZGB Art. 712t Abs. 2',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Ausserhalb des summarischen Verfahrens braucht die Bewirtschaftung die vorgängige ' +
				'Ermächtigung der Versammlung.'
		},

		// Ast 5 — Nutzung
		{
			id: 'k-benutzungsweise',
			titel: 'Benutzungsweise ändern',
			typ: 'qualifiziertes_mehr',
			geschaeftsart: 'nutzungsaenderung',
			rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten',
			zustimmungBetroffenerNoetig: false,
			wortlautAbweichung: true,
			begruendung:
				'Die Änderung der Benutzungsweise ist eine wichtigere Verwaltungshandlung, solange der ' +
				'Zweck der Liegenschaft derselbe bleibt.',
			beispiele: ['Verbot einer Kinderkrippe in einer Wohnung (BGer 5A_352/2012)']
		},
		{
			id: 'k-zweckbestimmung',
			titel: 'Zweckbestimmung der Liegenschaft ändern',
			typ: 'einstimmigkeit',
			geschaeftsart: 'nutzungsaenderung',
			rechtsgrundlage: 'ZGB Art. 648 Abs. 2',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Kippt der Charakter der Liegenschaft, ändert sich, wofür jeder Eigentümer gekauft hat. ' +
				'Das geht nur mit der Zustimmung aller.',
			beispiele: [
				'Aus Wohnungen werden Hotelzimmer (BGer 5A_632/2011)',
				'Reglementsänderung, die aus ruhigem Wohnen generell Gewerbe zulässt (BGer 5A_98/2017)'
			]
		},
		{
			id: 'k-grenzfall-nutzung',
			titel: 'Grenzfall zwischen Benutzungsweise und Zweckbestimmung',
			typ: 'grenzfall',
			geschaeftsart: 'nutzungsaenderung',
			rechtsgrundlage: 'ZGB Art. 647b Abs. 1 und Art. 648 Abs. 2',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Die Abgrenzung ist Einzelfallwürdigung; Massstab ist der Gesamtcharakter der Liegenschaft.',
			empfehlung:
				'Im Zweifel als Zweckänderung behandeln und Einstimmigkeit ansetzen. Ein zu schwach ' +
				'gefasster Beschluss über die Zweckbestimmung ist ungültig, nicht bloss anfechtbar.'
		},

		// Ast 6 — Grundordnung
		{
			id: 'k-grundstueck-verkauf',
			titel: 'Grundstücksteil verkaufen oder mit einer Dienstbarkeit belasten',
			typ: 'einstimmigkeit',
			geschaeftsart: 'grundordnung',
			rechtsgrundlage: 'ZGB Art. 648 Abs. 2',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Verfügungen über die Sache selbst gehen über die Verwaltung hinaus und verlangen die ' +
				'Zustimmung aller.'
		},
		{
			id: 'k-sonderrecht-abgrenzen',
			titel: 'Gemeinschaftliche Teile und Sonderrecht neu abgrenzen',
			typ: 'einstimmigkeit',
			geschaeftsart: 'grundordnung',
			rechtsgrundlage: 'ZGB Art. 712b Abs. 3',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Die Abgrenzung von Sonderrecht und gemeinschaftlichen Teilen ist Teil der Grundordnung; ' +
				'eine nachträgliche Änderung ist eine Vereinbarung aller.',
			beispiele: ['Aus dem Veloraum wird ein privater Weinkeller']
		},
		{
			id: 'k-wertquoten-aendern',
			titel: 'Wertquoten ändern',
			typ: 'einfaches_mehr',
			geschaeftsart: 'grundordnung',
			rechtsgrundlage: 'ZGB Art. 712e Abs. 2',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: true,
			betroffeneErlaeuterung:
				'Unmittelbar beteiligt sind alle Eigentümer, deren Wertquote sich ändert — sowohl die, ' +
				'deren Quote sinkt, als auch die, deren Quote steigt.',
			begruendung:
				'Hier stehen zwei Erfordernisse übereinander: die Zustimmung aller unmittelbar ' +
				'Beteiligten und zusätzlich die Genehmigung der Versammlung mit einfachem Mehr. Die ' +
				'Genehmigung allein genügt nicht, die Zustimmung allein auch nicht.',
			hinweise: [
				'Ändern sich die Quoten aller Einheiten, sind alle Eigentümer unmittelbar beteiligt — dann läuft die Bestimmung auf Einstimmigkeit hinaus.',
				'Vorbehalten bleibt der Anspruch auf Berichtigung, wenn eine Quote auf einem Irrtum beruht oder baulich unrichtig geworden ist.'
			]
		},
		{
			id: 'k-vorkaufsrecht',
			titel: 'Vorkaufsrecht oder Einspracherecht begründen oder aufheben',
			typ: 'einstimmigkeit',
			geschaeftsart: 'grundordnung',
			rechtsgrundlage: 'ZGB Art. 712c Abs. 1 und Abs. 2',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Vorkaufs- und Einspracherecht greifen in die Verfügungsfreiheit jedes Einzelnen ein und ' +
				'gehören in den Begründungsakt oder eine Vereinbarung aller.'
		},
		{
			id: 'k-aufhebung',
			titel: 'Stockwerkeigentum aufheben',
			typ: 'einstimmigkeit',
			geschaeftsart: 'grundordnung',
			rechtsgrundlage: 'ZGB Art. 712f Abs. 2',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung: 'Die Aufhebung ist eine Vereinbarung aller Eigentümer.',
			hinweise: [
				'Eigene Wege über das Gericht bestehen, wenn das Gebäude zu mehr als der Hälfte des Wertes zerstört ist oder seit über 50 Jahren besteht und in schlechtem Zustand ist (ZGB Art. 712f Abs. 3).'
			]
		},

		// Ast 7 — Verwaltungshandlungen
		{
			id: 'k-verwaltung-gewoehnlich',
			titel: 'Gewöhnliche Verwaltungshandlung',
			typ: 'einfaches_mehr',
			geschaeftsart: 'verwaltung_gewoehnlich',
			rechtsgrundlage: 'ZGB Art. 647a Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Gewöhnliche Verwaltungshandlungen erledigt in der Regel die Bewirtschaftung in eigener ' +
				'Kompetenz. Kommen sie vor die Versammlung, genügt das einfache Mehr.',
			beispiele: ['Kleine Ausbesserungen', 'Laufende Verträge', 'Inkasso']
		},
		{
			id: 'k-verwaltung-wichtig',
			titel: 'Wichtigere Verwaltungshandlung',
			typ: 'qualifiziertes_mehr',
			geschaeftsart: 'verwaltung_wichtig',
			rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten',
			zustimmungBetroffenerNoetig: false,
			wortlautAbweichung: true,
			begruendung:
				'Wichtigere Verwaltungshandlungen binden die Gemeinschaft über den Alltag hinaus und ' +
				'verlangen deshalb zusätzlich die Mehrheit der Wertquoten.',
			beispiele: ['Abschluss oder Auflösung von Miet- und Pachtverträgen', 'Anstellung von Hauswart oder Gärtnerin', 'Teure Anschaffungen']
		},
		{
			id: 'k-grenzfall-verwaltung',
			titel: 'Grenzfall zwischen gewöhnlicher und wichtigerer Verwaltungshandlung',
			typ: 'grenzfall',
			geschaeftsart: 'verwaltung_wichtig',
			rechtsgrundlage: 'ZGB Art. 647a und Art. 647b',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung: 'Die Grenze ist fliessend und lässt sich nicht allgemein ziehen.',
			empfehlung:
				'Im Zweifel als wichtigere Verwaltungshandlung behandeln und qualifiziertes Mehr ' +
				'ansetzen. Sonst droht Unverbindlichkeit gegenüber der Minderheit, samt Kostenfolge.'
		},

		// Ast 8 — Sonderfälle
		{
			id: 'k-ausschlussklage',
			titel: 'Ermächtigung zur Ausschlussklage',
			typ: 'einfaches_mehr',
			geschaeftsart: 'sonderfall',
			rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
			kopfbasis: 'alle_ausser_betroffene',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Das Gesetz nennt hier die Bezugsgrösse selbst: ein Mehrheitsbeschluss aller ' +
				'Miteigentümer mit Ausnahme des Beklagten. BGE 144 III 510 greift nicht, weil diese ' +
				'Bestimmung ihre eigene Basisregel im Wortlaut trägt.',
			hinweise: [
				'Bei zehn Eigentümern, von denen einer betroffen ist, sind fünf Ja-Stimmen nötig — unabhängig davon, wie viele erschienen sind.',
				'In kleinen Gemeinschaften läuft das faktisch auf die Zustimmung aller übrigen hinaus.',
				'Der Ausschluss selbst spricht das Gericht aus; die Versammlung ermächtigt nur zur Klage (BGer 5A_735/2019 E. 3.3.1).'
			]
		},
		{
			id: 'k-zirkularbeschluss',
			titel: 'Beschluss auf dem Zirkularweg',
			typ: 'einstimmigkeit',
			geschaeftsart: 'sonderfall',
			rechtsgrundlage: 'ZGB Art. 66 Abs. 2 i.V.m. Art. 712m Abs. 2',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			begruendung:
				'Ausserhalb der Versammlung entsteht ein Beschluss nur mit der schriftlichen Zustimmung ' +
				'aller. Eine Mehrheitsabstimmung auf dem Papierweg gibt es nicht.',
			hinweise: [
				'Sieht das Reglement eine Urabstimmung ausdrücklich vor, gilt diese Regelung.',
				'Der Zirkularbeschluss ist kein Traktandum dieser Versammlung; er wird hier nur zur Einordnung geführt.'
			]
		},
		{
			id: 'k-zustaendigkeit-gewoehnlich',
			titel: 'Zuständigkeit für gewöhnliche Verwaltungshandlungen anders regeln',
			typ: 'einfaches_mehr',
			geschaeftsart: 'verwaltung_gewoehnlich',
			rechtsgrundlage: 'ZGB Art. 647a Abs. 2',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			zustimmungBetroffenerNoetig: false,
			wortlautAbweichung: true,
			begruendung:
				'Die Versammlung kann die Zuständigkeit für gewöhnliche Verwaltungshandlungen anders ' +
				'verteilen, unter Vorbehalt der notwendigen und dringlichen Massnahmen.',
			hinweise: [
				'Wird dabei vom gesetzlichen Quorum abgewichen, ist das eine Reglementsbestimmung über die Quoren und verlangt Einstimmigkeit (ZGB Art. 712g Abs. 2).'
			]
		}
	]
} satisfies Regelwerk;
