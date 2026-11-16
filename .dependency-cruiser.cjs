/**
 * Der Schichtenwächter — AD-1 als Abhängigkeitsregel.
 *
 * **Was er durchsetzt.** Der Kern (`src/lib/domain`) trägt die Rechtslogik als
 * reine Funktionen und darf nichts kennen ausser sich selbst. Das Regelwerk
 * (`src/lib/rules`) darf nur den Kern kennen. Wird das verletzt, wandert
 * Datenzugriff in die Zählung, und die Regel, nach der gezählt wird, ist nicht
 * mehr isoliert vorlegbar — genau das, was AD-1 verhindert.
 *
 * **Warum jetzt `dependency-cruiser` und nicht mehr das eigene Skript**
 * (24.08.2026, auf Frage des Auftraggebers «sind Wächter state of the art oder
 * Flickwerk?»). Die erste Fassung suchte Einbindungen mit einem regulären
 * Ausdruck über den Dateitext. Der sieht drei Dinge nicht:
 *
 *   - **Den Kettenweg.** `domain/a` bindet `domain/b` ein, und `domain/b` bindet
 *     `server/db` ein — das Skript prüfte je Datei und fand die Kette nie.
 *   - **Auflösung über `tsconfig`.** `$lib/...` wurde von Hand übersetzt; ein
 *     neuer Pfadalias wäre lautlos durchgerutscht.
 *   - **Kommentare und Zeichenketten.** Ein `import` in einem Beispielblock
 *     zählte mit.
 *
 * `dependency-cruiser` baut den Graphen aus dem echten Modulbaum und läuft die
 * Ketten ab.
 */
module.exports = {
	forbidden: [
		{
			name: 'kern-bleibt-rein',
			comment:
				'Der Kern (src/lib/domain) darf nur sich selbst kennen. Ein Kern, der die ' +
				'Datenbank kennt, lässt sich nicht mehr als Funktion vorlegen (AD-1).',
			severity: 'error',
			from: { path: '^src/lib/domain' },
			to: {
				pathNot: '^src/lib/domain',
				// Typen aus `$lib/domain/types` und dergleichen sind derselbe Kern;
				// alles andere ist Aussenwelt.
				dependencyTypesNot: ['type-only']
			}
		},
		{
			name: 'kern-ohne-laufzeit',
			comment:
				'Umgebungsvariablen, SvelteKit-Laufzeit, Node-Schnittstellen und Datenzugriff ' +
				'sind Schale, nicht Fachlogik.',
			severity: 'error',
			from: { path: '^src/lib/(domain|rules)' },
			to: { path: '^(node:|\\$env/|\\$app/)|^(postgres|argon2|pg)$' }
		},
		{
			name: 'regelwerk-kennt-nur-den-kern',
			comment:
				'Das Regelwerk (src/lib/rules) darf den Kern kennen und sich selbst — nicht ' +
				'den Server und nicht die Seiten.',
			severity: 'error',
			from: { path: '^src/lib/rules' },
			to: { pathNot: '^src/lib/(domain|rules)', dependencyTypesNot: ['type-only'] }
		},
		{
			name: 'server-kennt-keine-seiten',
			comment:
				'Der Serverteil trägt die Arbeit; die Seiten rufen ihn. Umgekehrt entstünde ein ' +
				'Ring, und dieselbe Arbeit stünde bald an zwei Stellen.',
			severity: 'error',
			from: { path: '^src/lib/server' },
			to: { path: '^src/routes' }
		},
		{
			name: 'keine-ringe-im-kern',
			comment:
				'Ein Ring zwischen Modulen macht die Ladereihenfolge zum Zufall — und irgendwann ' +
				'ist eine Grösse beim ersten Zugriff `undefined`. Im Kern ist das nicht bloss ' +
				'unschön: Er soll als Funktion vorlegbar sein, und was sich gegenseitig braucht, ' +
				'lässt sich nicht einzeln vorlegen.\n\n' +
				'**Vorerst nur der Kern.** Beim ersten Lauf am 24.08.2026 meldete die Regel über ' +
				'alles 17 Ringe: einen im Kern (aufgelöst, siehe `domain/fehler.ts`) und sechzehn ' +
				'im Serverteil. Die sechzehn sind eine eigene Aufgabe — sie hier scharf zu ' +
				'schalten hiesse, den Wächter am ersten Tag rot zu übergeben, und ein Wächter, ' +
				'der im gewohnten Zustand rot ist, wird abgeschaltet statt gelesen.',
			severity: 'error',
			from: { path: '^src/lib/(domain|rules)' },
			to: { circular: true }
		}
	],
	options: {
		doNotFollow: { path: 'node_modules' },
		exclude: { path: '(^|/)(node_modules|build|\\.svelte-kit|static|entpackt|daten)(/|$)' },
		tsConfig: { fileName: 'tsconfig.json' },
		enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require'] }
	}
};
