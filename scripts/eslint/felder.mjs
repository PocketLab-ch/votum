/**
 * Die drei Fallen an Formularen — als ESLint-Regeln über dem Svelte-Baum.
 *
 * waechtername-historisch: Der alte Name ist hier der Gegenstand, dieser
 * Absatz erklärt genau die Ablösung.
 *
 * **Warum sie hier stehen und nicht mehr als Skript** (24.08.2026, auf die
 * Frage des Auftraggebers «sind Wächter state of the art oder Flickwerk?»). Die erste Fassung
 * (`scripts/check-felder.mjs`) las die Dateien mit regulären Ausdrücken:
 * `<(input|textarea)\b[^>]*>` für das Feld, `class="meldung[^"]*"` für die
 * Meldung. Das hat drei blinde Stellen, die alle im Projekt vorkommen:
 *
 *   - **Kommentare** musste sie von Hand ausblenden — ein Ersetzungsschritt vor
 *     der eigentlichen Prüfung, der bei jeder neuen Kommentarform nachgezogen
 *     werden muss.
 *   - **Ein `>` im Ausdruck** beendet `[^>]*` zu früh: `value={a > b}` schneidet
 *     das Feld mitten durch.
 *   - **Verschachteltes Markup** in der Meldung (`<p class="meldung"><strong>…`)
 *     fällt aus dem Muster.
 *
 * Der Parser kennt Kommentar, Zeichenkette und Ausdruck auseinander und liefert
 * Datei, Zeile **und Spalte**. Dieselben Regeln, dieselben Sätze — ohne die
 * blinden Stellen.
 */

/** Felder, in die der Benutzer nicht tippt — dort ist `value` kein Anfangswert. */
const OHNE_ANFANGSWERT = new Set(['hidden', 'submit', 'file', 'button', 'image', 'reset']);

/**
 * Ein gewöhnliches Attribut mit diesem Namen.
 *
 * Die Knoten von `svelte-eslint-parser` sind in ESLints Typen nicht enthalten —
 * `any` ist hier die ehrliche Angabe und keine Bequemlichkeit.
 *
 * @param {any} el
 * @param {string} name
 */
function attribut(el, name) {
	return el.startTag.attributes.find(
		/** @param {any} a */ (a) => a.type === 'SvelteAttribute' && a.key.name === name
	);
}

/**
 * Trägt das Attribut einen Ausdruck (`{…}`) statt einer festen Zeichenkette?
 * @param {any} a
 */
function traegtAusdruck(a) {
	return (a?.value ?? []).some(/** @param {any} v */ (v) => v.type === 'SvelteMustacheTag');
}

/**
 * Der feste Wert eines Attributs, falls es einen hat.
 * @param {any} a
 */
function festerWert(a) {
	const teil = (a?.value ?? []).find(/** @param {any} v */ (v) => v.type === 'SvelteLiteral');
	return teil?.value ?? null;
}

/**
 * Ein Attribut in seiner Kurzform — `{value}` statt `value={value}`.
 *
 * Der Parser macht daraus einen eigenen Knoten; `attribut()` oben sieht ihn
 * nicht. Ohne diese Zeile wäre `<select {value}>` der eine Weg, auf dem sich
 * der Wächter unten umgehen liesse.
 *
 * @param {any} el
 * @param {string} name
 */
function kurzform(el, name) {
	return el.startTag.attributes.find(
		/** @param {any} a */ (a) => a.type === 'SvelteShorthandAttribute' && a.key?.name === name
	);
}

/**
 * Eine Handlung dieses Elements — `use:name={…}`.
 *
 * @param {any} el
 * @param {string} name
 */
function hatHandlung(el, name) {
	return el.startTag.attributes.some(
		/** @param {any} a */ (a) =>
			a.type === 'SvelteDirective' &&
			a.kind === 'Action' &&
			(a.key?.name?.name ?? a.key?.name) === name
	);
}

/**
 * Schickt dieser Zuhörer bloss das Formular ab?
 *
 * **Warum die Frage so herum gestellt wird.** Zuerst stand hier das Gegenteil:
 * «Steht in dem Ausdruck eine Zuweisung?» Das liess genau die Schreibweise
 * durch, die man beim Abschauen von `Suchauswahl.svelte` mitnimmt —
 * `onchange={(e) => uebernehmen(e.currentTarget.value)}` weist nichts zu und
 * hält den Wert trotzdem fest. Ein Wächter, der die auffällige Hälfte einer
 * Klasse schliesst, schliesst die Klasse nicht.
 *
 * Umgekehrt ist die Menge klein und benennbar: Ein `<select>`, dessen `change`
 * bloss `form.requestSubmit()` auslöst, hält nichts fest — der Wert geht mit
 * dem Formular an den Server. Im Bestand sind das vier Stellen. Alles andere
 * braucht `use:gefuehrteWahl`.
 *
 * `parent` bleibt aussen vor und Gesehenes wird gemerkt — der Baum trägt
 * Rückverweise, ein naiver Durchlauf endet in «Maximum call stack size
 * exceeded» (dieselbe Falle wie oben bei `meldung-als-baustein`).
 *
 * @param {any} wurzel
 */
function schicktNurAb(wurzel) {
	/** @type {Set<unknown>} */
	const gesehen = new Set();
	let abschicken = false;
	let haeltFest = false;
	/** @param {any} knoten */
	const geht = (knoten) => {
		if (!knoten || typeof knoten !== 'object' || gesehen.has(knoten)) return;
		gesehen.add(knoten);
		/*
		 * Eine Zuweisung **neben** dem Abschicken hebt die Ausnahme auf: Wer den
		 * Wert festhält und zusätzlich abschickt, hält ihn fest.
		 */
		if (knoten.type === 'AssignmentExpression' || knoten.type === 'UpdateExpression') {
			haeltFest = true;
		}
		if (knoten.type === 'CallExpression') {
			const gerufen = knoten.callee?.property?.name ?? knoten.callee?.name;
			if (gerufen === 'requestSubmit' || gerufen === 'submit') abschicken = true;
		}
		for (const [schluessel, wert] of Object.entries(knoten)) {
			if (schluessel === 'parent') continue;
			if (Array.isArray(wert)) wert.forEach(geht);
			else if (wert && typeof wert === 'object' && wert.type) geht(wert);
		}
	};
	geht(wurzel);
	return abschicken && !haeltFest;
}

/**
 * @param {any} el
 * @param {string[]} namen
 */
function hatBindung(el, namen) {
	return el.startTag.attributes.some(
		/** @param {any} a */ (a) =>
			a.type === 'SvelteDirective' &&
			a.kind === 'Binding' &&
			namen.includes(a.key?.name?.name ?? a.key?.name)
	);
}

/** @type {import('eslint').Rule.RuleModule} */
const anfangswert = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Anfangswerte von Eingabefeldern über $lib/felder setzen, nicht über value/checked'
		},
		schema: []
	},
	create(kontext) {
		return {
			/** @param {any} el */
			SvelteElement(el) {
				const tag = el.name?.name;
				if (tag !== 'input' && tag !== 'textarea') return;

				/*
				 * Ein Feld, dessen Art erst zur Laufzeit feststeht (`type={…}`), ist
				 * ein Auswahl- oder Ankreuzfeld — dort trägt `value` die Kennung, nicht
				 * den Anfangswert. `/versammlungen/neu` wechselt so zwischen einer und
				 * mehreren Gemeinschaften.
				 */
				const typattribut = attribut(el, 'type');
				const dynamisch = traegtAusdruck(typattribut);
				const art = dynamisch ? 'radio' : (festerWert(typattribut) ?? 'text');
				if (OHNE_ANFANGSWERT.has(art)) return;

				// Wer bindet, führt den Wert im Programm — ein anderer Weg, bewusst
				// gewählt (`docs/gestaltung.md`).
				if (hatBindung(el, ['value', 'group', 'checked'])) return;

				/*
				 * `data-gefuehrt` sagt: Diesen Wert führt der Browser, nicht der
				 * Server. Dann ist ein reaktives `checked`/`value` richtig — es **muss**
				 * dem Zustand folgen. Die Markierung steht im Code und nicht in einer
				 * Liste, damit sie beim Lesen der Stelle sichtbar ist.
				 */
				if (attribut(el, 'data-gefuehrt')) return;

				/*
				 * **Gemeldet wird am Element, nicht am Attribut.**
				 *
				 * Ein Attribut steht bei mehrzeiligen Feldern drei Zeilen unter dem
				 * `<input`, und `eslint-disable-next-line` gilt für **eine** Zeile —
				 * eine Ausnahme liesse sich dann nirgends anbringen, denn in einem Tag
				 * kann kein HTML-Kommentar stehen. Am 24.08.2026 genau daran gemerkt:
				 * Die begründete Ausnahme in `Wahlliste.svelte` wirkte nicht.
				 *
				 * Welches Attribut es ist, sagt der Satz.
				 */
				/** @param {any} _a @param {string} satz */
				const melde = (_a, satz) =>
					kontext.report({ node: el.startTag, message: satz });

				if (art === 'radio' || art === 'checkbox') {
					const c = attribut(el, 'checked');
					if (traegtAusdruck(c)) {
						melde(
							c,
							`checked={…} an <input type="${art}"> wird bei jedem Neuzeichnen zurückgesetzt. ` +
								'Richtig ist angekreuzt(…) aus $lib/felder.'
						);
					}
					const dc = attribut(el, 'defaultChecked');
					if (dc) {
						melde(
							dc,
							'defaultChecked erscheint nicht im ausgelieferten HTML — ohne JavaScript ist ' +
								'nichts gewählt. Richtig ist angekreuzt(…) aus $lib/felder.'
						);
					}
					return;
				}

				const v = attribut(el, 'value');
				if (traegtAusdruck(v)) {
					melde(
						v,
						`value={…} an <${tag}${art === 'text' ? '' : ` type="${art}"`}> wird bei jedem ` +
							'Neuzeichnen zurückgesetzt — was der Benutzer getippt hat, ist weg. ' +
							'Richtig ist anfangswert(…) aus $lib/felder.'
					);
				}
				const dv = attribut(el, 'defaultValue');
				if (dv) {
					melde(
						dv,
						'defaultValue erscheint nicht im ausgelieferten HTML. Richtig ist ' +
							'anfangswert(…) aus $lib/felder.'
					);
				}
			}
		};
	}
};

/** @type {import('eslint').Rule.RuleModule} */
const keineBrowserabfrage = {
	meta: {
		type: 'problem',
		docs: { description: 'confirm() als Rückfrage durch <Rueckfrage …/> ersetzen' },
		schema: []
	},
	create(kontext) {
		return {
			/** @param {any} knoten */
			CallExpression(knoten) {
				const name =
					knoten.callee.type === 'Identifier'
						? knoten.callee.name
						: knoten.callee.type === 'MemberExpression' &&
							  knoten.callee.object?.name === 'window'
							? knoten.callee.property?.name
							: null;
				if (name !== 'confirm') return;
				kontext.report({
					node: knoten,
					message:
						'confirm(…) als Rückfrage: SvelteKit prüft `defaultPrevented` bei use:enhance ' +
						'nicht — «Abbrechen» bricht dann nicht ab. Richtig ist <Rueckfrage …/> aus ' +
						'$lib/components.'
				});
			}
		};
	}
};

/** @type {import('eslint').Rule.RuleModule} */
const meldungAlsBaustein = {
	meta: {
		type: 'problem',
		docs: { description: 'Eine Meldung aus `form` gehört in <Meldung …/>' },
		schema: []
	},
	create(kontext) {
		return {
			/** @param {any} el */
			SvelteElement(el) {
				if (el.name?.name !== 'p') return;
				const klasse = festerWert(attribut(el, 'class'));
				if (!klasse || !/\bmeldung\b/.test(klasse)) return;

				/*
				 * **Nur was aus `form` stammt.** `{data.hinweis}` beschreibt einen
				 * Zustand der Sache, nicht die Antwort auf eine Handlung — es steht bei
				 * jedem Laden wieder da, und ein Schliessknopf verspräche mehr, als er
				 * hält.
				 *
				 * **Auch abgeleitete Namen zählen.** Am 21.08.2026 standen auf `/z`
				 * zwei Meldungen als roher Absatz, weil die Seite `form.fehler` vorher
				 * in eine eigene Grösse legt (`const fehler = $derived(…)`).
				 */
				/** @type {string[]} */
				const quellen = [];
				/** @type {Set<unknown>} */
				const gesehen = new Set();
				/*
				 * **`parent` auslassen und Gesehenes merken.** Der Baum von
				 * `svelte-eslint-parser` trägt Rückverweise auf den Elternknoten;
				 * ein naiver Durchlauf läuft darüber im Kreis und endet in
				 * «Maximum call stack size exceeded». Beim ersten Lauf genau so
				 * passiert — der Wächter fiel um, bevor er etwas fand.
				 */
				/** @param {any} knoten */
				const sammle = (knoten) => {
					if (!knoten || typeof knoten !== 'object' || gesehen.has(knoten)) return;
					gesehen.add(knoten);
					if (knoten.type === 'Identifier') quellen.push(knoten.name);
					for (const [schluessel, wert] of Object.entries(knoten)) {
						if (schluessel === 'parent') continue;
						if (Array.isArray(wert)) wert.forEach(sammle);
						else if (wert && typeof wert === 'object' && wert.type) sammle(wert);
					}
				};
				for (const kind of el.children) {
					if (kind.type === 'SvelteMustacheTag') sammle(kind.expression);
				}
				if (quellen.includes('data')) return;
				if (!quellen.some((q) => q === 'form' || q === 'fehler' || q === 'hinweis')) return;

				kontext.report({
					node: el,
					message:
						'Eine Meldung aus `form` als roher <p class="meldung …">: Sie bleibt stehen, ' +
						'bis die Seite neu geladen wird — und während einer Versammlung lädt niemand ' +
						'neu. Richtig ist <Meldung ton="…" marke={form}> aus $lib/components.'
				});
			}
		};
	}
};

/**
 * Ab wie vielen fest aufgezählten Einträgen ein rohes `<select>` zu lang ist.
 *
 * **Dieselbe Zahl steht in `src/lib/domain/listensuche.ts`** und wird dort
 * begründet (bis zum 27.08.2026 stand sie in `src/lib/auswahl.ts`). Sie
 * steht hier ein zweites Mal, weil dieser Wächter als `.mjs` neben ESLint läuft
 * und kein TypeScript einbinden kann;
 * `tests/waechter/durchsuchbare-auswahl.test.ts` vergleicht beide Zahlen, damit
 * sie nicht auseinanderlaufen.
 */
export const SUCHSCHWELLE = 8;

/**
 * Alle Kindknoten eines Knotens — ohne den Rückverweis auf den Elternknoten.
 *
 * Der Baum von `svelte-eslint-parser` trägt `parent`; ein naiver Durchlauf
 * läuft darüber im Kreis. Deshalb hier nur die Behälter, in denen Markup steht.
 *
 * @param {any} knoten
 * @returns {any[]}
 */
function kinder(knoten) {
	/** @type {any[]} */
	const aus = [];
	for (const schluessel of ['children', 'cases']) {
		const wert = knoten?.[schluessel];
		if (Array.isArray(wert)) aus.push(...wert);
	}
	// `{#if}` trägt seinen Sonst-Zweig neben den Kindern, `{#await}` je Zweig.
	for (const schluessel of ['else', 'pending', 'then', 'catch']) {
		const wert = knoten?.[schluessel];
		if (wert && typeof wert === 'object' && wert.type) aus.push(wert);
	}
	return aus;
}

/** @type {import('eslint').Rule.RuleModule} */
const durchsuchbareAuswahl = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Ein Auswahlfeld über der Schwelle ist durchsuchbar — <Suchauswahl …/> statt rohem <select>'
		},
		schema: []
	},
	create(kontext) {
		/*
		 * Der Baustein selbst besteht aus genau dem, was die Regel sonst
		 * verbietet — ein `<select>`, dessen Einträge aus einer Liste kommen.
		 */
		if (/Suchauswahl\.svelte$/.test(kontext.filename ?? '')) return {};

		return {
			/** @param {any} el */
			SvelteElement(el) {
				if (el.name?.name !== 'select') return;

				let ausDemBestand = false;
				let ausEinemSchnipsel = false;
				let feste = 0;
				/** @param {any} knoten */
				const zaehle = (knoten) => {
					if (!knoten || typeof knoten !== 'object') return;
					if (knoten.type === 'SvelteEachBlock') ausDemBestand = true;
					/*
					 * **Ein `{@render …}` ist von hier aus nicht zu beurteilen.** Der
					 * Schnipsel steht anderswo; ob seine Einträge aus dem Bestand kommen,
					 * sieht diese Regel nicht. Ungezählt durchgehen zu lassen hiesse, die
					 * Schreibweise anzubieten, mit der man den Wächter still umgeht.
					 */
					if (knoten.type === 'SvelteRenderTag') ausEinemSchnipsel = true;
					if (knoten.type === 'SvelteElement' && knoten.name?.name === 'option') feste += 1;
					for (const kind of kinder(knoten)) zaehle(kind);
				};
				for (const kind of kinder(el)) zaehle(kind);

				if (ausEinemSchnipsel) {
					kontext.report({
						node: el.startTag,
						message:
							'Ein <select>, dessen Einträge aus einem Schnipsel kommen ({@render …}): Ob ' +
							'sie aus dem Bestand stammen, ist an dieser Stelle nicht zu sehen. Richtig ' +
							'ist <Suchauswahl …/> aus $lib/components.'
					});
					return;
				}

				if (ausDemBestand) {
					kontext.report({
						node: el.startTag,
						message:
							'Ein <select>, dessen Einträge aus dem Bestand kommen ({#each …}), zwingt zum ' +
							'Rollen, sobald der Bestand wächst — und man kann nicht tippen. Richtig ist ' +
							'<Suchauswahl …/> aus $lib/components; sie blendet das Suchfeld ab ' +
							`${SUCHSCHWELLE + 1} Einträgen von selbst ein.`
					});
					return;
				}

				if (feste > SUCHSCHWELLE) {
					kontext.report({
						node: el.startTag,
						message:
							`Ein <select> mit ${feste} fest aufgezählten Einträgen liegt über der Schwelle ` +
							`von ${SUCHSCHWELLE}. Richtig ist <Suchauswahl …/> aus $lib/components.`
					});
				}
			}
		};
	}
};

/** @type {import('eslint').Rule.RuleModule} */
const gefuehrteAuswahl = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Ein <select> führt der Browser — kein bind:value, sondern selected an der Option und use:gefuehrteWahl'
		},
		schema: []
	},
	create(kontext) {
		/*
		 * **Was diese Regel schliesst** (26.08.2026, gemessen in
		 * `e2e/wahl-vor-hydration.mjs`). `bind:value` an einem `<select>` lässt
		 * Svelte beim Aufbau den gebundenen Wert in das Feld zurückschreiben. Wer
		 * wählt, bevor das Skript geladen ist — im Saal auf einem fremden Telefon
		 * der Normalfall —, verliert seine Wahl wortlos: Das Feld steht wieder auf
		 * dem Anfangswert, das Formular ist unvollständig, und der Knopf tut beim
		 * Drücken nichts.
		 *
		 * Es ist dieselbe Fehlerklasse wie `value={…}` am Textfeld, die die Regel
		 * `anfangswert` oben schliesst. **Nicht gemeldet wird `bind:this`** — das
		 * bindet den Knoten, nicht den Wert, und der Weg heraus braucht es selbst.
		 */
		const satz =
			'überschreibt beim Aufbau, was vor der Hydration gewählt wurde — im Saal, auf einem ' +
			'fremden Telefon, ist genau das der Normalfall. Richtig ist selected={…} an der Option ' +
			'und use:gefuehrteWahl aus $lib/felder (oder <Suchauswahl …/>, wenn die Einträge aus ' +
			'dem Bestand kommen).';

		return {
			/** @param {any} el */
			SvelteElement(el) {
				if (el.name?.name !== 'select') return;

				/*
				 * Gemeldet wird am Tag und nicht am Attribut — die Begründung steht
				 * oben bei `anfangswert`: In einem mehrzeiligen Tag liesse sich eine
				 * Ausnahme sonst nirgends anbringen.
				 */
				if (hatBindung(el, ['value'])) {
					kontext.report({ node: el.startTag, message: `bind:value an einem <select> ${satz}` });
					return;
				}

				/*
				 * `value={…}` am `<select>` ist derselbe Weg mit einer Richtung
				 * weniger: Svelte setzt die Auswahl bei jedem Neuzeichnen erneut.
				 * Die Kurzform `{value}` meint dasselbe und muss mit.
				 */
				if (traegtAusdruck(attribut(el, 'value')) || kurzform(el, 'value')) {
					kontext.report({ node: el.startTag, message: `value={…} an einem <select> ${satz}` });
					return;
				}

				/*
				 * **Die halbe Behebung, die genauso viel verliert** (26.08.2026, aus
				 * dem Code-Review). `selected` an der Option und ein `onchange`, das
				 * den Wert festhält, sieht richtig aus — und ist es nicht: Der
				 * `change` vor der Hydration erreicht keinen Zuhörer, weil noch keiner
				 * da ist. Das Feld zeigt dann die Wahl, das Programm kennt sie nicht,
				 * und alles, was daran hängt, zeigt den falschen Zustand.
				 *
				 * Deshalb braucht **jeder** Zuhörer am `change` die Aktion daneben —
				 * ausser dem einen, der bloss abschickt (siehe `schicktNurAb`).
				 */
				if (hatHandlung(el, 'gefuehrteWahl')) return;
				const beiWechsel = attribut(el, 'onchange');
				if (
					beiWechsel &&
					!(beiWechsel.value ?? []).some(/** @param {any} v */ (v) => schicktNurAb(v))
				) {
					kontext.report({
						node: el.startTag,
						message:
							'Ein <select> mit onchange, aber ohne use:gefuehrteWahl: Der change vor der ' +
							'Hydration erreicht keinen Zuhörer — das Feld zeigt die Wahl, das Programm ' +
							'kennt sie nicht. use:gefuehrteWahl aus $lib/felder meldet beim Aufbau auch ' +
							'die frühe Wahl.'
					});
				}
			}
		};
	}
};

/** @type {import('eslint').Rule.RuleModule} */
const gefuehrterAusklapper = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Ein <details> führt der Browser — kein open={…} und kein bind:open, sondern aufgeklappt(…)'
		},
		schema: []
	},
	create(kontext) {
		/*
		 * **Was diese Regel schliesst** (26.08.2026, gemessen in
		 * `e2e/ausklapper-vor-hydration.mjs`). `open={…}` an einem `<details>` ist
		 * ein gewöhnliches Attribut, und Svelte setzt es bei der Hydration erneut.
		 * Es merkt sich zwar den vorgefundenen Wert, vergleicht ihn aber mit dem
		 * Ausdruck — und `''` (der Browser hat aufgeklappt) ist nicht `false` (der
		 * Server sagte «zu»). Also schreibt Svelte `element.open = false`: Der
		 * Kasten klappt **vor den Augen des Benutzers** wieder zu.
		 *
		 * `bind:open` ist dieselbe Falle ohne Bremse — `bind_property` schreibt
		 * `element.open = get()` ohne jede Prüfung.
		 *
		 * Es ist dieselbe Fehlerklasse wie `value={…}` am Textfeld (Regel
		 * `anfangswert`) und `bind:value` am `<select>` (Regel
		 * `gefuehrte-auswahl`), eine Ebene weiter.
		 *
		 * **Ein festes `open` bleibt in Ruhe.** `<details open>` ohne Ausdruck ist
		 * ein Kasten, der immer offen anfängt; da gibt es keinen Zustand, den
		 * Svelte zurückschreiben könnte.
		 */
		const satz =
			'wird bei der Hydration zurückgeschrieben — wer das <summary> anklickt, bevor das ' +
			'Skript geladen ist, sieht den Kasten wieder zugehen. Im Saal, auf einem fremden ' +
			'Telefon, ist genau das der Normalfall. Richtig ist {...aufgeklappt(…)} aus $lib/felder.';

		return {
			/** @param {any} el */
			SvelteElement(el) {
				if (el.name?.name !== 'details') return;

				/*
				 * Gemeldet wird am Tag und nicht am Attribut — die Begründung steht
				 * oben bei `anfangswert`: In einem mehrzeiligen Tag liesse sich eine
				 * Ausnahme sonst nirgends anbringen.
				 */
				if (hatBindung(el, ['open'])) {
					kontext.report({
						node: el.startTag,
						message: `bind:open an einem <details> ${satz}`
					});
					return;
				}

				/*
				 * `{open}` in der Kurzform meint dasselbe wie `open={offen}` und muss
				 * mit — es ist einer der Wege, auf denen man sonst vorbeikäme.
				 */
				if (traegtAusdruck(attribut(el, 'open')) || kurzform(el, 'open')) {
					kontext.report({
						node: el.startTag,
						message: `open={…} an einem <details> ${satz}`
					});
					return;
				}

				/*
				 * **Und der zweite Weg vorbei** (26.08.2026, aus dem Code-Review):
				 * `<details {...{ open: offen }}>`. Gemessen — die Fassung davor liess
				 * ihn durch. Erfasst wird nur der Spread, dessen Objekt **an Ort und
				 * Stelle** steht; ein Spread aus einem Aufruf (`{...aufgeklappt(…)}`)
				 * ist ja gerade der richtige Weg.
				 *
				 * **Zwei Schreibweisen bleiben aussen vor**, beide null Mal im Bestand:
				 * `<svelte:element this="details">` (ein anderer Knoten) und ein Spread
				 * aus einer Grösse statt aus einem Objekt an Ort und Stelle. Eine Regel
				 * für einen Fall, den es nicht gibt, ist nicht geprüft, sondern
				 * behauptet; `docs/gestaltung.md` nennt beide Lücken.
				 */
				const inlineSpread = el.startTag.attributes.some(
					/** @param {any} a */ (a) =>
						a.type === 'SvelteSpreadAttribute' &&
						a.argument?.type === 'ObjectExpression' &&
						(a.argument.properties ?? []).some(
							/** @param {any} p */ (p) =>
								p.type === 'Property' &&
								(p.key?.name === 'open' || p.key?.value === 'open')
						)
				);
				if (inlineSpread) {
					kontext.report({
						node: el.startTag,
						message: `Ein open in einem Spread an einem <details> ${satz}`
					});
				}
			}
		};
	}
};

/** @type {import('eslint').ESLint.Plugin} */
export default {
	rules: {
		anfangswert,
		'keine-browserabfrage': keineBrowserabfrage,
		'meldung-als-baustein': meldungAlsBaustein,
		'durchsuchbare-auswahl': durchsuchbareAuswahl,
		'gefuehrte-auswahl': gefuehrteAuswahl,
		'gefuehrter-ausklapper': gefuehrterAusklapper
	}
};
