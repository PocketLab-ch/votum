<script lang="ts">
	import { untrack } from 'svelte';
	import type { HeadCountMode, Stichentscheid } from '$lib/domain/types';
	import {
		gemeinschaftsfelder,
		STICHENTSCHEID_EINFUEHRUNG,
		TRAEGERSCHAFT_IN_WORTEN,
		TRAEGERSCHAFTEN
	} from '$lib/domain/gemeinschaft';
	import { KI_FUNKTIONEN, KI_FUNKTIONSNAMEN } from '$lib/domain/ki';
	import { KLAUSEL_MIT_WENIGER_OFFEN, KLAUSEL_SICHER } from '$lib/domain/reglement';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import Wahlliste from '$lib/components/Wahlliste.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';

	const kifunktionen = KI_FUNKTIONEN.map((k) => ({ kennung: k, name: KI_FUNKTIONSNAMEN[k] }));

	interface Moeglich {
		id: string;
		name: string;
		/** Steht selbst schon unter einer anderen — dann entstünde eine dritte Stufe. */
		schonKind?: boolean;
	}

	let {
		werte = {
			name: '',
			strasse: '',
			plz: '',
			ort: '',
			quotaDenominator: 1000,
			// Leer, nicht vorbelegt: siehe den Hinweis im Formular.
			headCountMode: '' as HeadCountMode | '',
			parkingCountsAsHead: false,
			parentStwegId: '',
			headCountRuleSource: '',
			tieBreak: 'keiner' as Stichentscheid,
			tieBreakRuleSource: '',
			abstentionExcluded: false,
			abstentionExcludedSource: '',
			proxyLimit: '',
			proxyLimitRuleSource: '',
			proxyByAccess: false,
			proxyByAccessSource: '',
			aiEnabled: false,
			aiDisabledFunctions: [] as string[],
			traegerschaft: '' as string | null
		},
		moeglicheEltern = [] as Moeglich[],
		fehler = null as { nachricht: string; feld?: string } | null,
		beschriftungKnopf = 'Anlegen',
		/**
		 * Wohin das Formular sendet. Leer heisst: die Standardaktion der Seite.
		 *
		 * Die Angabenseite trägt daneben das Entfernen, und SvelteKit lässt keine
		 * Standardaktion neben benannten zu — dort heisst sie deshalb
		 * `?/speichern`.
		 */
		aktion = '',
		/**
		 * Ob die dritte Bauart zur Wahl steht: die Miteigentümergemeinschaft,
		 * deren Mitglieder Gemeinschaften sind.
		 *
		 * **Nur beim Anlegen** (Auftraggeber, 25.08.2026: «Es wäre doch einfacher, wenn
		 * eine MEG, die aus Gemeinschaften besteht, direkt in Gemeinschaften
		 * anlegt und zuordnet»). Auf der Angabenseite einer bestehenden
		 * Gemeinschaft gibt es nichts anzulegen — dort kommt ein Mitglied über
		 * «Eigentümer und Stimmkraft» dazu.
		 */
		mitMitgliedern = false,
		/** Die Gemeinschaften, die Mitglied werden können. */
		moeglicheMitglieder = [] as Moeglich[],
		/**
		 * Ob schon Gemeinschaften Mitglied sind (Angabenseite). Dann steht die
		 * Trägerschaft gemäss Grundbuch da und ist Pflicht (Ä-43).
		 */
		mitHaeusern = false
	} = $props();

	// Bewusst nur der Anfangswert: Sobald jemand tippt, gehört das Feld ihm. Das
	// Formular lädt bei jedem Absenden neu, deshalb ist der Anfangswert stets der
	// richtige — auch nach einem fachlichen Fehler, wo die Eingaben zurückkommen.
	let zaehlweise = $state<HeadCountMode | ''>(untrack(() => werte.headCountMode));
	let gleichstand = $state<Stichentscheid>(untrack(() => werte.tieBreak ?? 'keiner'));
	/*
	 * **Ein Haken ist an, wenn er `true` oder «true» ist** (07.10.2026). Nach
	 * einer Absage kommen die Werte aus `formularwerte` zurück, die Haken also
	 * in Worten. Mit `=== true` fielen sie leer zurück, und das nächste
	 * Speichern schaltete die Einstellung still ab; gemessen an «Enthaltungen»,
	 * und dieselbe Lücke hatten «Vollmacht über den persönlichen Zugang» und
	 * «KI zulassen».
	 */
	const istAn = (wert: unknown) => wert === true || wert === 'true';
	let ohneEnthaltung = $state(untrack(() => istAn(werte.abstentionExcluded)));
	let nenner = $state(String(untrack(() => werte.quotaDenominator)));

	/*
	 * **Nur eine Klammer?** Gefragt am 12.08.2026: «Braucht es weniger Angaben,
	 * wenn es eine übergeordnete Sammelbehälter ist? … Da bräuchte es nur Adresse
	 * und Bezeichnung und keine Angaben über WQ etc.»
	 *
	 * Erkannt wird es am Nenner 0 — es gibt kein zweites Feld, das dasselbe sagt
	 * (`istKlammer` im Kern). Beim Anlegen ist die Vorgabe «tagt», beim Ändern
	 * steht der gespeicherte Zustand.
	 *
	 * Welche Blöcke daran hängen, entscheidet der Kern (`gemeinschaftsfelder`) und
	 * nicht dieses Formular: Dieselbe Liste braucht später der Prüfbericht.
	 */
	/**
	 * Was hier angelegt wird — drei Bauarten statt zweier (Auftraggeber, 25.08.2026).
	 *
	 * Die Miteigentümergemeinschaft, deren Mitglieder Gemeinschaften sind, war
	 * bisher keine eigene Wahl: Man legte «eine Gemeinschaft mit eigenen
	 * Einheiten» an und trug die Häuser eine Seite später ein. Das steht so im
	 * Hilfetext — und es setzt voraus, dass man den Satz gelesen und verstanden
	 * hat, bevor man die erste Wahl trifft.
	 *
	 * **Sie ist keine dritte Datenform.** In der Datenbank ist sie eine
	 * gewöhnliche Gemeinschaft mit Einheiten; verschieden ist nur, WER die
	 * Eigentümer sind. Deshalb hängt `klammer` weiter am Nenner und nicht an
	 * dieser Wahl — sonst gäbe es zwei Angaben über dieselbe Sache, die einander
	 * widersprechen könnten.
	 */
	/*
	 * **Nach einer Absage gilt die Wahl, die abgeschickt wurde** (Codeprüfung
	 * 07.10.2026). Die Eingaben kommen als `werte` zurück, aber Bauart und
	 * Mitglieder las bis hierher niemand: Aus «Miteigentümergemeinschaft» mit
	 * drei Häusern wurde «eigene Einheiten» ohne Häuser, und das nächste
	 * Absenden legte eine gewöhnliche Gemeinschaft an.
	 */
	const zurueck = untrack(() => werte as Record<string, unknown>);
	const BAUARTEN = ['eigene', 'meg', 'klammer'];
	let bauart = $state(
		untrack(() =>
			BAUARTEN.includes(String(zurueck.art))
				? String(zurueck.art)
				: Number(werte.quotaDenominator) === 0
					? 'klammer'
					: 'eigene'
		)
	);
	const klammer = $derived(bauart === 'klammer');
	const felder = $derived(gemeinschaftsfelder(klammer));

	/** Welche Gemeinschaften als Mitglieder gewählt sind. */
	let mitgliedswahl = $state<string[]>(
		untrack(() => (Array.isArray(zurueck.mitglied) ? zurueck.mitglied.map(String) : []))
	);

	/**
	 * Der vorbelegte Anteil je Mitglied: gleiche Teile am eingetippten Nenner.
	 *
	 * **Vorbelegt heisst nicht erraten** — die Zahl steht sichtbar im Formular,
	 * bevor gespeichert wird, und wer ungleich verteilt, ändert sie.
	 */
	const anteilVorschlag = $derived(
		mitgliedswahl.length > 0
			? Math.round((Number(nenner || '0') / mitgliedswahl.length) * 100) / 100
			: 0
	);

	/** Heute, als Vorbelegung für «ab wann» — die Schale liest die Uhr, nicht der Kern. */
	const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
</script>

<form method="POST" action={aktion} class="formular">
	{#if fehler}
		<p class="fehler" role="alert">{fehler.nachricht}</p>
	{/if}

	<!--
		**Die Einordnung steht zuerst.** Gemeldet am 12.08.2026: «Jetzt erfasse ich
		zwei neue Gemeinschaften und möchte eine übergeordnete Gemeinschaft
		erfassen. Wie mache ich das? Die Frage müsste weiter oben kommen, als
		erstes.» Sie stand ganz unten — nach Zählweise, Stichentscheid, Vollmachten
		und KI, hinter fünf Bildschirmhöhen Formular.

		Sie gehört auch sachlich nach vorn: Wovon eine Gemeinschaft ein Teil ist,
		entscheidet mit, was danach richtig ist. Eine blosse Klammer trägt den
		Nenner 0 und keine eigenen Wertquoten; eine Untergemeinschaft wird auf
		beiden Ebenen geprüft.
	-->
	<!--
		Die Kette oben steht in zwei Spalten: links die Einordnung und der Name,
		rechts Anschrift und Nenner. Vorher lag die rechte Hälfte über 800 px leer,
		während das Formular 3007 px hoch war.

		Zwei Spalten**stapel** und kein Raster über die Felder: Im Raster liefe die
		Tabulatorfolge Einordnung → Anschrift → Bezeichnung → Nenner. Gestapelt
		bleibt sie die Folge, in der man ausfüllt.
	-->
	<div class="kopffelder">
	<div class="spalte">
	<!--
		**Was wird hier angelegt?** Eine Klammer braucht weder Wertquoten noch eine
		Zählweise: Ohne eigene Einheiten hat sie keine Eigentümer, also keine
		Stimmberechtigten — `pruefeFreigabe` hält bei einer Versammlung für sie mit
		«Es ist kein Eigentümer erfasst» an. Welche Blöcke damit wegfallen, sagt der
		Kern (`gemeinschaftsfelder`).
	-->
	<fieldset class="einordnung">
		<legend>Was legen Sie an?</legend>

		<label class="wahl">
			<!--
				**Die Werte heissen `eigene`, `meg` und `klammer`**, seit es drei
				Fälle sind. Vorher waren es zwei und hiessen `false` und `true`; der
				Name stimmte damals mit dem Ja/Nein überein, das dahinterstand.

				Der Server liest das Feld `art` nicht. Was zählt, ist, was das
				Formular daraus macht: der Nenner und die Auswahl der Mitglieder.
				Die Werte sind trotzdem keine Beliebigkeit, denn die Drehbücher
				greifen darauf zu. Am 27.08.2026 hingen acht Befunde in
				`e2e/stammdatenwege.mjs` allein daran, dass hier `false` zu `eigene`
				geworden war und niemand die Drehbücher mitgezogen hatte.
			-->
			<input type="radio" name="art" value="eigene" bind:group={bauart} />
			<span>
				<strong>Eine Gemeinschaft mit eigenen Einheiten</strong>
				<span class="hilfe">Der Normalfall. Sie hat Wertquoten, Eigentümer und tagt.</span>
			</span>
		</label>

		{#if mitMitgliedern}
			<label class="wahl">
				<input type="radio" name="art" value="meg" bind:group={bauart} />
				<span>
					<strong>Eine Miteigentümergemeinschaft, deren Mitglieder Gemeinschaften sind</strong>
					<span class="hilfe">
						Etwa die Umgebung oder die Einstellhalle einer Siedlung, wenn sie den
						<strong>Häusern</strong> gehört und nicht einzelnen Personen. Jedem Haus kommt eine
						Stimme zu, ausgeübt durch einen bezeichneten Vertreter. Sie wählen die Häuser
						gleich hier aus.
					</span>
				</span>
			</label>
		{/if}

		<label class="wahl">
			<input type="radio" name="art" value="klammer" bind:group={bauart} />
			<span>
				<!--
					**«Klammer» war Fachjargon.** Gemeldet am 12.08.2026: «Nur eine Klammer
					über andere Gemeinschaften ← Bitte verständlicher formulieren. Also
					bspw. Übergeordnete Gemeinschaft.»

					Der Zusatz «die andere zusammenfasst» ist dabei nicht schmückend: Eine
					Zeile tiefer steht die Frage, ob diese Gemeinschaft **zu** einer
					übergeordneten gehört — die Gegenrichtung. Ohne den Zusatz stünde
					zweimal fast dasselbe Wort für zwei entgegengesetzte Aussagen.
				-->
				<strong>Eine übergeordnete Gemeinschaft, die andere zusammenfasst</strong>
				<span class="hilfe">
					Etwa eine Überbauung über ihre Häuser. Sie hat selbst keine Einheiten und tagt
					nicht — die Wertquoten liegen vollständig bei den Gemeinschaften darunter. Deshalb
					entfallen Nenner, Zählweise, Stichentscheid, Vollmachten und KI.
				</span>
			</span>
		</label>
	</fieldset>

	{#if klammer}
		<!--
			**Wer selbst übergeordnet ist, steht nicht unter einer anderen.** Gemeldet
			am 12.08.2026: «Wenn übergeordnet ist, sollte diese nicht ‹Gehört diese
			Gemeinschaft zu einer übergeordneten?› möglich sein, weil übergeordnet.»

			Nachgerechnet ist es nicht nur unanschaulich, sondern unrechenbar: Eine
			Zwischenebene ohne eigene Quote trägt nach oben nichts bei, und der Saldo
			der obersten Ebene ginge nie auf (`pruefeGemeinschaft`, Kennung
			`uebergeordnete_mit_eltern`).

			Das Feld verschwindet ersatzlos — es wird **nicht** als verstecktes Feld
			mitgesendet wie die Abstimmungsangaben. Der Unterschied: Jene bleiben
			gültig und warten, dieses widerspricht der getroffenen Wahl.
		-->
		{@render bauformen()}
		{#if werte.parentStwegId}
			<p class="hilfe hinweis">
				<strong>Die Zuordnung zu einer übergeordneten Gemeinschaft wird gelöst.</strong>
				Eine übergeordnete Gemeinschaft steht nicht selbst unter einer anderen: Sie hat keine
				eigene Wertquote und trüge dort nichts bei. Soll sie eine Zwischenebene bleiben, wählen
				Sie oben «Eine Gemeinschaft mit eigenen Einheiten» und geben ihr einen Nenner.
			</p>
		{/if}
	{:else}
	<label class="einordnung">
		Gehört diese Gemeinschaft zu einer übergeordneten?
		{#if moeglicheEltern.length > 0}
			<!--
				**Ein Suchfeld ab neun Einträgen** (23.08.2026, Prüflauf II, A-26). Im
				Prüflauf standen 56 Gemeinschaften in einer Zeile, alphabetisch
				gemischt mit achtzehn E2E- und sechsundzwanzig Prüflaufeinträgen —
				ohne Suchfeld.
				
				Seit dem 26.08.2026 macht das `Suchauswahl.svelte` für alle Auswahlfelder
				aus dem Bestand; die Schwelle steht in `$lib/domain/listensuche` und ist dieselbe
				wie hier von Hand. Die Vorgabe steht oben und ist der Normalfall —
				nicht die Ausnahme.
			-->
			<Suchauswahl
				name="parentStwegId"
				beschriftung="Übergeordnete Gemeinschaft"
				leerText="Nein, sie steht für sich"
				wert={werte.parentStwegId ?? ''}
				eintraege={moeglicheEltern.map((m) => ({
					wert: m.id,
					text: `Ja, zu ${m.name}${m.schonKind ? ' (steht selbst unter einer anderen)' : ''}`
				}))}
			/>
		{:else}
			<!--
				Bis zum 12.08.2026 verschwand das Feld hier lautlos. Wer die erste
				Gemeinschaft anlegte, sah keine Frage — und erfuhr nirgends, dass die
				Reihenfolge zwingend ist: Die übergeordnete lässt sich nur wählen,
				wenn sie schon besteht.
			-->
			<p class="hilfe hinweis">
				Noch keine andere Gemeinschaft erfasst. Bei einer Mehrhausanlage legen Sie zuerst die
				übergeordnete an — danach steht sie hier zur Wahl.
			</p>
		{/if}
		<span class="hilfe">
			Bei einer Mehrhausanlage, deren Häuser unter einer gemeinsamen Gemeinschaft stehen. Die
			Liste der Gemeinschaften zeigt die Häuser dann eingerückt darunter.
			<strong>Der Wertquoten-Nenner ist zugleich der Anteil an der übergeordneten:</strong>
			zwei Häuser zu 600 und 400 ergeben zusammen deren 1000.
		</span>
		{@render bauformen()}
	</label>
	{/if}

	</div>

	<div class="spalte">
	<!--
		Der Name steht am Anfang der zweiten Spalte, nicht unter den beiden
		Einordnungskästen: So liest sich links «wie ist es eingeordnet» und rechts
		«wie heisst es und wo ist es» — und die Tabulatorfolge bleibt die
		Ausfüllfolge (Art → übergeordnet → Name → Anschrift → Nenner).
	-->
	<label>
		Bezeichnung
		<input name="name" {...anfangswert(werte.name)} required maxlength="200" autocomplete="off" />
		<span class="hilfe">Wie die Gemeinschaft im Grundbuch und im Protokoll heisst.</span>
	</label>

	<div class="zeile">
		<label class="breit">
			Strasse und Nummer
			<input name="strasse" {...anfangswert(werte.strasse ?? '')} autocomplete="off" />
		</label>
		<label class="schmal">
			PLZ
			<input name="plz" {...anfangswert(werte.plz ?? '')} inputmode="numeric" autocomplete="off" />
		</label>
		<label class="breit">
			Ort
			<input name="ort" {...anfangswert(werte.ort ?? '')} autocomplete="off" />
		</label>
	</div>

	{#if !felder.wertquoten}
		<!--
			Der Nenner **muss** mitgehen, auch wenn er nicht sichtbar ist: `ganzzahl`
			macht aus einem fehlenden Feld NaN, und der Kern weist das zu Recht ab.
			Null ist hier die Aussage, nicht die Abwesenheit einer Angabe.
		-->
		<input type="hidden" name="quotaDenominator" value="0" />
		<p class="hilfe hinweis">
			<strong>Keine eigenen Wertquoten.</strong> Die Anteile liegen bei den Gemeinschaften
			darunter; die Saldoprüfung erwartet hier keine Summe.
		</p>
	{:else}
	<label>
		Wertquoten-Nenner
		<!--
			**Ungesteuert, mit Mitschrift** statt `bind:value`.

			Der Hinweis unten braucht den getippten Wert, das Feld aber gehört dem
			Menschen davor. Mit `bind:value` schrieb Svelte den Wert bei jedem
			Durchlauf zurück — und wenn etwas zwischen Auswählen und Einfügen kam
			(ein Neuaufbau während der Hydration), landete das Getippte **hinter**
			dem alten Wert statt an seiner Stelle: Aus «1000» und getippten «1200»
			wurde «10001200», und die Wertquoten gingen nicht mehr auf. Gefunden am
			04.08.2026, unregelmässig und deshalb lange für eine Laune des
			Entwicklungsservers gehalten.

			Dieselbe Regel wie überall im Projekt: der Anfangswert über
			`anfangswert()` aus `$lib/felder` — im Browser unkontrolliert, auf dem
			Server als Attribut im HTML.
		-->
		<input
			name="quotaDenominator"
			{...anfangswert(String(werte.quotaDenominator))}
			oninput={(e) => (nenner = e.currentTarget.value)}
			inputmode="numeric"
			required
		/>
		<span class="hilfe">
			Üblich sind Tausendstel. Der Wert muss eine ganze Zahl sein.
			{#if nenner === '0'}
				<strong>
					Mit null hat diese Gemeinschaft keine eigenen Wertquoten: Sie liegen vollständig bei
					den Gemeinschaften darunter, und die Saldoprüfung erwartet hier keine Summe.
				</strong>
			{/if}
		</span>
	</label>
	{/if}
	</div>
	</div>

	<!--
		**Die Häuser als Mitglieder — gleich hier** (Auftraggeber, 25.08.2026: «Es wäre
		doch einfacher, wenn eine MEG, die aus Gemeinschaften besteht, direkt in
		Gemeinschaften anlegt und zuordnet»).

		Steht nach dem Nenner, weil der Anteilsvorschlag daraus folgt: Fünf Häuser
		an einem Nenner von 5 ergeben je 1. Für jedes gewählte Haus entsteht ein
		Anteil, eine Eigentümerzeile der Art «Gemeinschaft» und die Zuordnung —
		dieselben Zeilen, die auch von Hand entstünden.
	-->
	{#if bauart === 'meg' && mitMitgliedern}
		<fieldset class="mitglieder">
			<legend>Wem gehört sie?</legend>
			{#if moeglicheMitglieder.length === 0}
				<p class="hilfe">
					Es gibt noch keine andere Gemeinschaft. Legen Sie zuerst die Häuser an — danach
					lassen sie sich hier auswählen.
				</p>
			{:else}
				<Wahlliste
					name="mitglied"
					mehrfach
					bind:gewaehlt={mitgliedswahl}
					suchbeschriftung="Gemeinschaft suchen"
					leerhinweis="Noch keine gewählt."
					eintraege={moeglicheMitglieder.map((m) => ({ id: m.id, name: m.name }))}
				/>

				{#if mitgliedswahl.length > 0}
					<table class="mitgliedszeilen">
						<thead>
							<tr>
								<th scope="col">Gemeinschaft</th>
								<th scope="col">Anteil</th>
								<th scope="col">Vertretung</th>
							</tr>
						</thead>
						<tbody>
							{#each mitgliedswahl as id (id)}
								{@const m = moeglicheMitglieder.find((x) => x.id === id)}
								<tr>
									<td>{m?.name ?? id}</td>
									<td>
										<input
											type="number"
											name="quote:{id}"
											min="0"
											step="any"
											required
											aria-label="Anteil {m?.name ?? ''}"
											{...anfangswert(String(zurueck[`quote:${id}`] ?? anteilVorschlag))}
										/>
									</td>
									<td>
										<!--
											Pflicht: Eine Gemeinschaft kann nicht selbst die Hand heben.
											Ohne bezeichneten Vertreter stünde die Sitzungsleitung im
											Moment der Abstimmung vor der Frage, wen sie zählen darf.
										-->
										<input
											name="vertretung:{id}"
											maxlength="200"
											required
											aria-label="Vertretung {m?.name ?? ''}"
											{...anfangswert(String(zurueck[`vertretung:${id}`] ?? ''))}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="hilfe">
						<!-- Der Anteil je Mitglied, wie auf der Eigentümerseite (Probe Wertquotenmehr). -->
						Vorbelegt sind gleiche Teile: je {anteilVorschlag} von {nenner}.
						Steht im Reglement etwas anderes, ändern Sie die Zahlen.
					</p>
				{/if}

				<label>
					Ab wann
					<input type="date" name="ab" required {...anfangswert(String(zurueck.ab ?? heute))} />
					<span class="hilfe">Seit wann die Anteile auf diese Gemeinschaften lauten.</span>
				</label>
			{/if}
		</fieldset>
	{/if}

	<!--
		**Trägerschaft gemäss Grundbuch** (Ä-43, Produktentscheid 17.09.2026,
		`docs/freigabe.md`). Pflicht, sobald Gemeinschaften Mitglied werden oder
		sind: beim Anlegen mit gewählten Häusern, auf der Angabenseite einer
		bestehenden Anlage beim nächsten Speichern. Der Kern verlangt es
		(`verlangeTraegerschaft`); `required` hier spart nur den Umweg.

		Eine Angabe, keine Rechenregel: Gezählt wird danach nicht anders. Der
		Hinweis nennt die offene Rechtsfrage (Zweitprüfung, Teil 4, Nr. 16), ohne
		ihre Nummer, die ausserhalb dieses Hauses niemand nachschlagen kann.
	-->
	{#if (bauart === 'meg' && mitMitgliedern) || mitHaeusern}
		{@const pflicht = mitHaeusern || mitgliedswahl.length > 0}
		<fieldset class="traegerschaft">
			<legend>Trägerschaft gemäss Grundbuch</legend>
			{#if mitHaeusern && !werte.traegerschaft}
				<p class="hilfe hinweis">
					Diese Angabe fehlt noch. Sie ist nötig, um die Angaben zu speichern.
				</p>
			{/if}
			<p class="hilfe">
				Wem gehört der Anteil an der gemeinsamen Parzelle? Das steht im Grundbuchauszug dieser
				Parzelle unter «Eigentum»: entweder ein Grundstück oder Stockwerkanteil, mit dem der Anteil
				verknüpft ist, oder Personen mit Namen. Den Auszug erhalten Sie beim Grundbuchamt.
			</p>
			{#each TRAEGERSCHAFTEN as wert (wert)}
				<label class="wahl">
					<input
						type="radio"
						name="traegerschaft"
						value={wert}
						required={pflicht}
						{...angekreuzt(werte.traegerschaft === wert)}
					/>
					<span>{TRAEGERSCHAFT_IN_WORTEN[wert]}</span>
				</label>
			{/each}
			<p class="hilfe hinweis">
				Rechtlich ist noch offen, welche Regeln für die Versammlung einer solchen Gemeinschaft
				gelten. Offen ist etwa, ob sie beschlussfähig sein muss, wie ihre Beschlüsse angefochten
				werden und ob jedes Haus eine eigene Stimme haben darf. Beantworten lässt sich das nur am
				Reglement und am Grundbuchauszug; ist ein Beschluss umstritten, lassen Sie das daran von einer
				Fachperson prüfen. Votum zählt unabhängig von dieser Angabe. Sie hält fest, worauf sich die
				Gemeinschaft stützt, und ist die Grundlage für diese Prüfung.
			</p>
		</fieldset>
	{/if}

	<!--
		**Die vier Regelblöcke stehen nebeneinander, sobald die Breite reicht.**
		Untereinander war das Formular 3007 px hoch und nutzte davon 640 px Breite
		von 1400 — dieselbe Verschwendung, die der Auftraggeber am 12.08.2026 für die
		Arbeitsflächen gemeldet hat («Bitte systematisch prüfen, wie man Flächen
		effizienter nutzen kann»).

		Die Kopffelder darüber bleiben einspaltig: Einordnung, Bezeichnung, Anschrift
		und Nenner sind eine Kette, die man von oben nach unten ausfüllt. Die vier
		Blöcke darunter sind unabhängige Entscheide — jeder mit Reglementsbezug, jeder
		für sich lesbar.
	-->
	{#if !felder.abstimmung && !felder.vollmachten && !felder.ki}
		<!--
			**Die Werte gehen als verstecktes Feld mit**, statt zu verschwinden. Wer
			eine bestehende Gemeinschaft auf «übergeordnete Gemeinschaft» stellt und es sich
			anders überlegt, fände sonst die Zählweise auf der Vorgabe und die
			Fundstelle im Reglement gelöscht — eine stille Datenänderung als
			Nebenwirkung einer Anzeigefrage.

			`headCountMode` braucht dabei einen Wert: Die Spalte ist NOT NULL, und der
			Kern lehnt eine leere Zählweise ab. Beim Anlegen einer Klammer steht noch
			keine da, dann gilt die gesetzliche Auffangregel — sie wird nie gebraucht.
		-->
		<input type="hidden" name="headCountMode" value={werte.headCountMode || 'per_owner'} />
		<input type="hidden" name="headCountRuleSource" value={werte.headCountRuleSource ?? ''} />
		{#if werte.parkingCountsAsHead}
			<input type="hidden" name="parkingCountsAsHead" value="true" />
		{/if}
		<input type="hidden" name="tieBreak" value={werte.tieBreak ?? 'keiner'} />
		<input type="hidden" name="tieBreakRuleSource" value={werte.tieBreakRuleSource ?? ''} />
		{#if werte.abstentionExcluded}
			<input type="hidden" name="abstentionExcluded" value="true" />
		{/if}
		<input
			type="hidden"
			name="abstentionExcludedSource"
			value={werte.abstentionExcludedSource ?? ''}
		/>
		<input type="hidden" name="proxyLimit" value={werte.proxyLimit ?? ''} />
		<input type="hidden" name="proxyLimitRuleSource" value={werte.proxyLimitRuleSource ?? ''} />
		{#if werte.proxyByAccess}
			<input type="hidden" name="proxyByAccess" value="true" />
		{/if}
		<input type="hidden" name="proxyByAccessSource" value={werte.proxyByAccessSource ?? ''} />
		{#if werte.aiEnabled}
			<input type="hidden" name="aiEnabled" value="true" />
		{/if}
		{#each werte.aiDisabledFunctions ?? [] as f (f)}
			<input type="hidden" name="aiDisabledFunctions" value={f} />
		{/each}
	{:else}
	<div class="regeln">
	<fieldset>
		<legend>Zählweise der Kopfstimme</legend>

		<p class="hilfe hinweis">
			Was gilt, steht im Reglement. Es gibt bewusst keine Voreinstellung: Wer die eine Wahl
			unbesehen übernimmt, zählt möglicherweise ohne Grundlage — und das fällt erst auf, wenn ein
			Beschluss angefochten wird.
		</p>

		<!--
			**Zugeklappt, weil es der Hintergrund ist** (Regel 4 in `docs/gestaltung.md`).
			Der Kasten darüber ist die Warnung und muss offen stehen; dieser hier
			beantwortet die Frage, die der Auftraggeber am 26.08.2026 stellte — «Eine Kopfstimme je
			Eigentümer wäre ja somit obsolet?». Sie ist es nicht: Das Wort «Eigentümer»
			trägt zwei Lesarten, und die Wahl betrifft die eine (eine Person, mehrere
			Einheiten), nicht die andere (eine Einheit, mehrere Personen).
		-->
		<details class="erklaerung">
			<summary>Was heisst das?</summary>
			<p>
				Die Wahl macht dort einen Unterschied, wo einer Person <strong>mehrere Einheiten</strong>
				gehören: Wem zwei Wohnungen gehören, der hat je Einheit zwei Stimmen, je Eigentümer eine.
			</p>
			<p>
				Gehört umgekehrt <strong>eine Wohnung mehreren Leuten</strong>, ist es in beiden Zählweisen
				zusammen eine Stimme, die ein Vertreter abgibt (ZGB Art. 712o Abs. 1). Diese erfassen Sie
				bei den Eigentümern über «Gemeinschaftliches Eigentum».
			</p>
		</details>

		<label class="wahl">
			<input
				type="radio"
				name="headCountMode"
				value="per_unit"
				bind:group={zaehlweise}
				required
			/>
			<span>
				<strong>Eine Kopfstimme je Einheit</strong>
				<span class="hilfe">
					In den meisten Reglementen so festgehalten. Wer drei Wohnungen besitzt, hat drei Stimmen.
					Gilt nur, soweit das Reglement es vorsieht.
				</span>
			</span>
		</label>

		<label class="wahl">
			<input type="radio" name="headCountMode" value="per_owner" bind:group={zaehlweise} />
			<span>
				<strong>Eine Kopfstimme je Eigentümer</strong>
				<span class="hilfe">
					Die gesetzliche Auffangregel — sie greift, wo das Reglement nichts anderes bestimmt. Wer
					drei Wohnungen besitzt, hat eine Stimme.
				</span>
			</span>
		</label>

		{#if zaehlweise === 'per_unit'}
			<label class="fundstelle">
				Fundstelle im Reglement
				<input
					name="headCountRuleSource"
					{...anfangswert(werte.headCountRuleSource ?? '')}
					placeholder="z. B. Reglement Ziff. 14.2"
					maxlength="200"
				/>
				<!--
					**Der Satz sagte etwas Falsches über dieses Feld**
					(Bedienbarkeitsprüfung 05.09.2026, Befund 28, nachgemessen am
					06.09.2026).

					Er lautete: «Der Nachweis, auf den es im Streitfall ankommt. Steht
					dort nichts, gilt eine Stimme je Eigentümer.» Gemeint war das
					Reglement. Gelesen wird es am Eingabefeld aber als «lasse ich das
					hier leer, wird daraus je Eigentümer» — und das stimmt nicht:
					`pruefeGemeinschaft` lässt die Zählweise dann auf «je Einheit» und
					speichert nur keine Fundstelle. In einer Anwendung, in der die
					Zählweise über jeden Beschluss entscheidet, ist das die
					gefährlichste Art von Hilfetext.

					**Und die Folge steht jetzt dabei.** Der Befund lautete «Die
					Anwendung mahnt eine Fundstelle an, die das Anlegeformular gar
					nicht entgegennimmt». Nachgemessen: Das Formular nimmt sie sehr
					wohl entgegen, sobald «je Einheit» gewählt ist. Was fehlte, war der
					Zusammenhang — das Feld ist freiwillig, die Liste mahnt es hinterher
					an, und dazwischen sagte niemand etwas.
				-->
				<span class="hilfe">
					Der Nachweis, auf den es im Streitfall ankommt: die Stelle im Reglement, die diese
					Zählweise vorsieht. Ohne Angabe bleibt es bei der Zählung je Einheit, und die
					Gemeinschaft erscheint in der Übersicht als «ohne Fundstelle».
				</span>
			</label>

			<label class="nebenobjekte">
				<input
					type="checkbox"
					name="parkingCountsAsHead"
					value="true"
					{...angekreuzt(istAn(werte.parkingCountsAsHead))}
				/>
				<span>
					Nebenobjekte tragen eine eigene Kopfstimme
					<span class="hilfe">
						Betrifft Einstellplätze, Kellerabteile und Ähnliches. Ohne Haken zählen sie zwar bei der
						Wertquote, nicht aber bei den Köpfen. Das Schulskript rät gerade in kleinen
						Gemeinschaften davon ab, jedem Sonderrecht eine Stimme zu geben.
					</span>
				</span>
			</label>
		{/if}
	</fieldset>

	<fieldset>
		<legend>Bei Stimmengleichheit</legend>

		<label class="wahl">
			<input type="radio" name="tieBreak" value="keiner" bind:group={gleichstand} />
			<span>
				<strong>Der Antrag ist abgelehnt</strong>
				<span class="hilfe">
					Die gesetzliche Lage: Wer die Mehrheit nicht hat, hat sie nicht. Sieben Ja gegen sieben
					Nein heisst abgelehnt.
				</span>
			</span>
		</label>

		<label class="wahl">
			<input type="radio" name="tieBreak" value="wertquote" bind:group={gleichstand} />
			<span>
				<strong>Die Wertquoten entscheiden</strong>
				<span class="hilfe">
					Steht in manchen Reglementen, etwa als «Bei Stimmengleichheit ist die
					Anteilsberechtigung massgebend». Gilt nur, soweit das Reglement es vorsieht — und nie
					bei der Einstimmigkeit, wo es nicht um eine Mehrheit geht.
				</span>
			</span>
		</label>

		<label class="wahl">
			<input type="radio" name="tieBreak" value="verwalter" bind:group={gleichstand} />
			<span>
				<strong>Der Verwalter entscheidet</strong>
				<span class="hilfe">
					Wählen Sie das, wenn Ihr Reglement es so sagt, etwa in einem Artikel «Bei
					Stimmengleichheit entscheidet der Verwalter». Votum hält beim Gleichstand an und lässt
					den Entscheid eintragen. Votum wendet die Klausel nur beim einfachen Mehr an, nach Köpfen
					ohne Wertquoten; zählt eine Regel Ihres Reglements die Köpfe nicht, auch nach Wertquoten
					allein. Bei jedem anderen Mehr ist der Antrag bei Stimmengleichheit abgelehnt. Nennt das Reglement
					ausdrücklich auch ein anderes Mehr, ist nicht geklärt, ob sie dort gilt. Empfohlen ist die
					Ablehnung, weil der Beschluss nach dem Gesetz bei Stimmengleichheit nicht gefasst ist
					und die Verwaltung so nicht Partei ergreift.
					Ob die Klausel trägt, ist umstritten
					(SVIT-Kommentar 2023, Art. 712m Rz. 187); eine Annahme lässt sich innert Monatsfrist
					beim Gericht anfechten (ZGB Art. 75).
				</span>
			</span>
		</label>

		<!--
			Die drei Wahlen ab hier seit dem 07.10.2026 (Migration 149): der Vorsitz
			als entscheidende Person und die Kaskade «erst die Wertquoten, dann die
			Person». Eine Einzelwahl unter den drei ersten bildete ein Reglement nicht
			ab, das beides nacheinander vorsieht.
		-->
		<label class="wahl">
			<input type="radio" name="tieBreak" value="vorsitz" bind:group={gleichstand} />
			<span>
				<strong>Die Person im Vorsitz entscheidet</strong>
				<span class="hilfe">
					Wählen Sie das, wenn Ihr Reglement den Vorsitzenden nennt und nicht den Verwalter. Den
					Vorsitz kann die Versammlung einer anderen Person geben; entscheidend ist, wer ihn im
					Saal führt. Votum hält beim Gleichstand an und lässt den Entscheid mit Namen eintragen.
					Votum wendet die Klausel nur beim einfachen Mehr an, nach Köpfen ohne Wertquoten; zählt eine
					Regel Ihres Reglements die Köpfe nicht, auch nach Wertquoten allein. Bei jedem anderen
					Mehr ist der Antrag bei Stimmengleichheit abgelehnt. Nennt das Reglement ausdrücklich auch
					ein anderes Mehr, ist nicht geklärt, ob sie dort gilt. Ist die Person im Vorsitz selbst
					Stockwerkeigentümer, gibt Votum ihr keine Richtung vor;
					sonst ist die Ablehnung empfohlen. Eine Annahme lässt sich innert Monatsfrist beim
					Gericht anfechten (ZGB Art. 75).
				</span>
			</span>
		</label>

		<label class="wahl">
			<input type="radio" name="tieBreak" value="wertquote_verwalter" bind:group={gleichstand} />
			<span>
				<strong>Erst die Wertquoten, dann der Verwalter</strong>
				<span class="hilfe">
					Für Reglemente mit zwei Stufen: Es gilt die Seite, Ja oder Nein, hinter der mehr
					Wertquoten stehen; die Wertquoten der Enthaltungen zählen auf keiner Seite. Stehen hinter
					Ja und Nein gleich viele Wertquoten, entscheidet der Verwalter. Für ihn gilt
					dasselbe wie oben: Empfohlen ist die Ablehnung, und ob die Klausel trägt, ist umstritten.
				</span>
			</span>
		</label>

		<label class="wahl">
			<input type="radio" name="tieBreak" value="wertquote_vorsitz" bind:group={gleichstand} />
			<span>
				<strong>Erst die Wertquoten, dann die Person im Vorsitz</strong>
				<span class="hilfe">
					Wie die Wahl davor, nur entscheidet in der zweiten Stufe die Person, die den Vorsitz
					führt, mit der Empfehlung wie beim Vorsitz oben.
				</span>
			</span>
		</label>

		{#if gleichstand !== 'keiner'}
			<label class="fundstelle">
				Fundstelle im Reglement
				<input
					name="tieBreakRuleSource"
					{...anfangswert(werte.tieBreakRuleSource ?? '')}
					placeholder="z. B. Art. 30 Reglement"
					maxlength="200"
				/>
				<span class="hilfe">
					Ein Beschluss, der erst über den Stichentscheid zustande kommt, wird genau hier
					angegriffen. Die Auswertung nennt die Fundstelle deshalb ausdrücklich.
					<!-- S11, F4a (Z17): der sichere Weg der Einführung, Wortlaut in `gemeinschaft.ts`. -->
					{STICHENTSCHEID_EINFUEHRUNG}
				</span>
			</label>
		{/if}
	</fieldset>

	<!--
		Seit dem 07.10.2026 (Migration 151). Eine Einstellung für die ganze
		Gemeinschaft, weil Reglemente die Klausel einmal für alle Abstimmungen mit
		einfachem Mehr fassen; je Geschäftsart gibt es dafür die Reglementsregeln.
		Wo sie greift und wo nicht, entscheidet `wendeReglementAn`.
	-->
	<fieldset>
		<legend>Enthaltungen</legend>
		<label class="schalter">
			<input
				type="checkbox"
				name="abstentionExcluded"
				value="true"
				bind:checked={ohneEnthaltung}
			/>
			<span>
				Beim einfachen Mehr zählen Enthaltungen nicht mit
				<span class="hilfe">
					Wählen Sie das nur, wenn Ihr Reglement es so sagt, etwa «Massgebend sind die gültig
					abgegebenen Stimmen». Dann zählt beim einfachen Mehr eine Enthaltung weder für noch
					gegen den Antrag, auch bei Wahlen. Wer anwesend ist und gar nicht abstimmt, zählt in
					Votum vorsichtshalber weiter mit und wirkt wie ein Nein. Fragen Sie deshalb vor dem
					Schliessen nach, wer noch nicht abgestimmt hat. Ohne Haken wirkt auch eine Enthaltung
					wie ein Nein; so rechnen die meisten Kommentare, aber nicht alle.
				</span>
				<span class="hilfe">
					Das qualifizierte Mehr und die Einstimmigkeit bleiben, wie sie sind. Gilt Ihre Klausel
					auch für die Köpfe beim qualifizierten Mehr, rechnet Votum dort trotzdem mit den
					Enthaltungen, also strenger als Ihr Reglement. Sagen Sie das vor der Abstimmung an. Für
					die
					Beschlussfähigkeit zählt weiter, wer sich enthält. Steht auf der Reglementsseite eine
					eigene Regel für eine Geschäftsart, gilt dort deren Angabe zur Enthaltung (Spalte
					«Enthaltung»), auch wenn sie beim Erfassen nur vorbelegt war. Bei der Abberufung der
					Bewirtschaftung und der Änderung der Wertquoten zählt Votum Enthaltungen trotzdem mit;
					die Karte des Erfordernisses sagt warum.
				</span>
			</span>
		</label>
		{#if ohneEnthaltung}
			<label class="fundstelle">
				Fundstelle im Reglement
				<input
					name="abstentionExcludedSource"
					{...anfangswert(werte.abstentionExcludedSource ?? '')}
					placeholder="z. B. Art. 33 Abs. 1 Reglement"
					maxlength="200"
				/>
				<span class="hilfe">
					Eingeführt werden muss eine solche Klausel einstimmig; ein Reglement aus der
					Begründung des Stockwerkeigentums erfüllt das. {KLAUSEL_MIT_WENIGER_OFFEN} Votum kann beides nicht prüfen.
					Die Fundstelle steht deshalb bei jedem Beschluss, der so gezählt wird. {KLAUSEL_SICHER}
				</span>
			</label>
		{/if}
	</fieldset>

	<fieldset>
		<legend>Vollmachten</legend>
		<label>
			Höchstzahl je Person
			<input
				name="proxyLimit"
				type="number"
				min="1"
				step="1"
				{...anfangswert(werte.proxyLimit ?? '')}
				placeholder="leer = keine Schranke"
			/>
			<span class="hilfe">
				Das Gesetz kennt keine Höchstzahl, viele Reglemente schon. Bleibt das Feld leer, wird
				nichts geprüft. Ist eine Zahl eingetragen, <strong>weist die Anwendung die
				überzählige Vollmacht ab</strong>, schon beim Erfassen. Tragen Sie die Zahl also nur
				ein, wenn Ihr Reglement sie wirklich vorschreibt: Sie wirkt dann im Saal.
			</span>
			<span class="hilfe">
				Nicht mitgezählt werden Organvertreter von Firmen, gesetzliche Vertretungen und
				Mitberechtigte derselben Einheit. Sie handeln nicht kraft Vollmacht. Beim Erfassen
				wird das je Vollmacht gewählt. Die Mitberechtigten zählen mit, wenn Sie bei den
				Lesarten (L15) «Zählt mit» einstellen.
			</span>
		</label>
		<label class="fundstelle">
			Fundstelle im Reglement
			<input
				name="proxyLimitRuleSource"
				{...anfangswert(werte.proxyLimitRuleSource ?? '')}
				placeholder="z. B. Art. 27 Abs. 2 Reglement"
				maxlength="200"
			/>
			<span class="hilfe">
				Nur nötig, wenn eine Höchstzahl eingetragen ist. Wer den Beschluss anficht, greift
				zuerst die Vertretungsmacht an.
			</span>
		</label>

		<label class="schalter">
			<input
				type="checkbox"
				name="proxyByAccess"
				value="true"
				{...angekreuzt(istAn(werte.proxyByAccess))}
			/>
			<span>
				Vollmacht über den persönlichen Zugang zulassen
				<span class="hilfe">
					Eigentümer können dann von der Einladung aus selbst bevollmächtigen — mit einer
					Weisung je Antrag, wenn sie wollen. <strong>Die Sitzungsleitung bestätigt weiterhin
					jede Vollmacht.</strong> Vorgabe ist aus: Manche Reglemente verlangen Schriftform, und
					ob eine Erklärung über den persönlichen Code das erfüllt, entscheidet keine Software.
				</span>
			</span>
		</label>
		<label class="fundstelle">
			Worauf sich die Freischaltung stützt
			<input
				name="proxyByAccessSource"
				{...anfangswert(werte.proxyByAccessSource ?? '')}
				placeholder="z. B. Art. 26 Reglement oder Beschluss der Versammlung vom …"
				maxlength="200"
			/>
				<span class="hilfe">Nur nötig, wenn der Weg zugelassen ist.</span>
		</label>
	</fieldset>

	<!--
		**Vorgabe: aus.** Nicht, weil die KI gefährlich wäre, sondern weil dabei
		Inhalte an ein fremdes Haus gehen. Und je Funktion abschaltbar, weil eine
		Gemeinschaft die Traktandenprüfung wollen kann und den Protokollentwurf
		nicht — ein einziger Schalter für alles hiesse, dass Zurückhaltung bei
		einem Punkt die Hilfe bei allen anderen kostet.
	-->
	<fieldset>
		<legend>KI-Unterstützung</legend>

		<label class="schalter">
			<input type="checkbox" name="aiEnabled" value="true" {...angekreuzt(istAn(werte.aiEnabled))} />
			<span>
				KI-Unterstützung für diese Gemeinschaft zulassen
				<span class="hilfe">
					Vorgabe ist aus. Zugelassen werden damit Prüfungen und Entwürfe, bei denen der
					<strong>Inhalt</strong> von Traktanden und Notizen an das eingerichtete Modell
					übermittelt wird — Namen werden vorher ersetzt, und vor dem Senden lässt sich
					ansehen, was hinausgeht. Wohin, steht in der Einrichtung; ohne eingerichtetes Modell
					bleibt der Schalter wirkungslos. <strong>Die KI entscheidet nie</strong>, sie schlägt
					vor.
				</span>
			</span>
		</label>

		<fieldset class="unterliste">
			<legend>Davon ausgenommen</legend>
			{#each kifunktionen as f (f.kennung)}
				<label class="schalter">
					<input
						type="checkbox"
						name="aiDisabledFunctions"
						value={f.kennung}
						{...angekreuzt((werte.aiDisabledFunctions ?? []).includes(f.kennung))}
					/>
					{f.name}
				</label>
			{/each}
			<span class="hilfe">Angehakt heisst: diese Funktion nicht, auch bei zugelassener KI.</span>
		</fieldset>
	</fieldset>
	</div>
	{/if}

	<div class="knoepfe">
		<button type="submit">{beschriftungKnopf}</button>
		<a href="/gemeinschaften">Abbrechen</a>
	</div>
</form>

<!--
	**Der Block hing am falschen Zweig** (23.08.2026, Prüflauf II, A-16). Er
	erklärt den Unterschied zwischen Untergemeinschaft und
	Miteigentümergemeinschaft — und stand nur dort, wo man «gehört zu einer
	übergeordneten» wählt. Wählte man «ist selbst übergeordnet», verschwand er:
	genau in dem Augenblick, in dem die Verwechslung passiert.

	Als Snippet, damit beide Zweige denselben Text zeigen. Zweimal
	hingeschrieben liefe er beim nächsten Ändern auseinander.
-->
{#snippet bauformen()}
	<details class="erklaerung">
		<summary>Untergemeinschaft oder Miteigentümergemeinschaft?</summary>
		<p>
			<strong>Die Untergemeinschaft:</strong> Mitglieder sind die Eigentümer selbst, und die
			Gemeinschaft ist ein Teil einer grösseren. Das ist die Wahl «gehört zu einer
			übergeordneten».
		</p>
		<p>
			<strong>Die Miteigentümergemeinschaft, deren Mitglieder die Häuser sind</strong> — die,
			in der jedem Haus eine Stimme zukommt, ausgeübt durch einen Vertreter. Das ist die
			zweite Wahl oben: Sie wählen die Häuser gleich beim Anlegen aus, und für jedes
			entsteht ein Anteil samt Eigentümerzeile. Kommt später eines dazu, geht das unter
			«Eigentümer und Stimmkraft».
		</p>
		<p>
			<strong>Die blosse Klammer:</strong> «ist selbst übergeordnet», ohne eigene Wertquote.
			Sie führt keine Einheiten und tagt nicht selbst; für gemeinsame Geschäfte legen Sie
			einen gemeinsamen Abend über die Häuser an.
		</p>
		<p>
			Welcher Fall vorliegt, steht im Reglement. Ausführlich im
			<a href="/handbuch/verbund.html#die-drei-falle-unterscheiden" target="handbuch"
				>Handbuch, «Die drei Fälle unterscheiden»</a
			>.
		</p>
	</details>
{/snippet}

<style>

	.formular {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		/*
		 * Die Kette oben bleibt bei ihrer Lesebreite; die Regelblöcke darunter
		 * dürfen die ganze Bahn nehmen. Eine Deckelung am `form` selbst nähme sie
		 * beiden — deshalb steht sie an den Kopffeldern.
		 */
		margin-top: 1.5rem;
	}

	.formular > .fehler {
		max-width: 40rem;
	}

	/* Dieselbe Bauart wie `.regeln` — ein Bruch, zwei Werte, eine Regel weniger. */
	.kopffelder {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(29rem, 100%), 1fr));
		gap: 1.25rem;
		align-items: start;
	}

	.kopffelder .spalte {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
	}

	/*
	 * Dieselbe Bauart wie `.arbeitsflaeche` in app.css: `auto-fit` entscheidet nach
	 * der vorhandenen Breite, nicht nach einer festen Spaltenzahl. Unter der
	 * Mindestbreite stapeln sich die Blöcke wie bisher.
	 *
	 * `start` und nicht `stretch`: Die Blöcke sind verschieden lang, und zwei
	 * davon wachsen beim Anklicken einer Auswahl (die Fundstelle kommt dazu). Auf
	 * gleiche Höhe gezogen sprängen die Nachbarn mit.
	 */
	.regeln {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(29rem, 100%), 1fr));
		gap: 1.25rem;
		align-items: start;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 550;
		/*
		 * **Lange Wörter dürfen brechen** (26.08.2026 bei 320 px nachgemessen).
		 * «Miteigentümergemeinschaft,» im Auswahlblock ist 278 px breit und schob
		 * die ganze Seite 29 px über den Rand — unsichtbar, weil `body` den
		 * Querlauf ausblendet, also abgeschnitten statt scrollbar. Dieselbe
		 * Behandlung wie bei den Überschriften in `app.css`: `hyphens` trennt an
		 * der richtigen Stelle (das Dokument trägt `lang="de"`), `overflow-wrap`
		 * fängt ab, wo das Wörterbuch nichts kennt.
		 */
		hyphens: auto;
		overflow-wrap: break-word;
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	input:not([type]),
	.formular :global(select),
	.formular :global(.auswahlsuche) {
		min-height: var(--ziel-min);
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	.hilfe {
		font-weight: 400;
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.zeile {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.zeile .breit {
		flex: 2 1 10rem;
	}

	.zeile .schmal {
		flex: 1 1 5rem;
	}

	fieldset {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		/*
		 * **`min-width: 0`, sonst kann der Block nicht schmaler werden als sein
		 * breitester Inhalt.** Ein `fieldset` trägt browserseitig
		 * `min-width: min-content` — als einziges Element. Auf dem Telefon schiebt
		 * es damit die ganze Seite über den Rand, und weil `body` den Querlauf
		 * ausblendet, ist der Streifen abgeschnitten statt scrollbar.
		 *
		 * Nachgemessen bei 320 px auf der Angabenseite: 8 px Überlauf, mit dieser
		 * Zeile 0 (26.08.2026, beim Umbau der Ankreuzfelder aufgefallen).
		 */
		min-width: 0;
	}

	legend {
		font-weight: 550;
		padding: 0 0.35rem;
	}

	.wahl,
	.nebenobjekte {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.6rem;
		font-weight: 400;
		min-height: var(--ziel-min);
	}

	.wahl > span,
	.nebenobjekte > span,
	.schalter > span:not(.hilfe) {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		/* Darf schmaler werden als sein längstes Wort — sonst drückt der Text den
		   Block über den Rand, statt in sich umzubrechen. */
		min-width: 0;
	}

	/*
	 * **Das Kästchen links neben den Titel** (Auftraggeber, 26.08.2026: «Das liest sich
	 * sonst komisch»). Die Regel `label { flex-direction: column }` weiter oben
	 * stapelt alles untereinander — bei einem Textfeld ist das richtig, bei einem
	 * Kästchen nicht: Ein Haken über seiner Beschriftung sieht aus, als gehörte er
	 * zum Absatz darüber, nicht zum Satz darunter.
	 *
	 * **Die Regel trifft sechs Beschriftungen, nicht zwei**: die beiden grossen
	 * Schalter und die vier Ausnahmen unter «Davon ausgenommen», die aus einer
	 * Schleife kommen. Genau daran hing der nächste Punkt.
	 *
	 * **Kein `flex-wrap`, sondern `min-width: 0` am Text.** Der Umbruch war der
	 * erste Versuch gegen den Querlauf auf dem Telefon — und er schob bei knapper
	 * Breite den Titel unter das Kästchen, also genau dorthin zurück, wo er nicht
	 * hingehört. Richtig ist, den Text schrumpfen zu lassen: Dann bricht er in
	 * sich um und bleibt neben dem Haken. Die Ursache des Querlaufs lag ohnehin
	 * woanders, siehe `min-width` am `fieldset`.
	 *
	 * Die leichtere Schrift von `.wahl` und `.nebenobjekte` bleibt hier weg: Diese
	 * Beschriftungen sind Überschrift ihres Blocks. Und `min-height` bleibt, auch
	 * wenn es unter den einzeiligen Ausnahmen Luft lässt — auf dem Telefon ist das
	 * die Fläche, die ein Finger trifft.
	 */
	.schalter {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.6rem;
		min-height: var(--ziel-min);
	}

	/*
	 * Was zum Schalter gehört, rückt unter seinen Titel — nicht unter das
	 * Kästchen. `1.6rem` wie bei den Auswahlblöcken wäre hier zu wenig: Das
	 * Kästchen ist breiter als ein Auswahlpunkt, und die Linie oben begänne
	 * sichtbar links vom Text, den sie abtrennt.
	 */
	.schalter + .fundstelle {
		margin-left: 2.15rem;
	}

	.nebenobjekte,
	.fundstelle {
		margin-left: 1.6rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--linie);
	}

	.hinweis {
		margin: 0;
		padding: 0.6rem 0.75rem;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}

	/*
	 * Die erste Frage steht abgesetzt: Sie ordnet ein, was danach kommt, und ist
	 * für den Normalfall mit einem Blick erledigt. Ohne den Rahmen sähe sie aus
	 * wie ein weiteres Feld unter vielen — und genau das war das Problem, nur am
	 * anderen Ende des Formulars.
	 */
	.einordnung {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.85rem 1rem;
		background: var(--flaeche-2);
	}

	/*
	 * `<details>` statt eines Textblocks: Der Unterschied zwischen den beiden
	 * Klammern braucht drei Absätze, und wer ihn kennt, will sie nicht jedes Mal
	 * lesen. Zugeklappt ist er eine Zeile — und er wirkt ohne Javascript.
	 */
	.erklaerung {
		font-weight: 400;
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.erklaerung summary {
		cursor: pointer;
		color: var(--akzent);
		/* Fingerbreit, aber ohne `display: flex` — das nähme dem `summary` den Marker. */
		padding: 0.35rem 0;
	}

	.erklaerung p {
		margin: 0.5rem 0 0;
	}

	input[type='radio'],
	input[type='checkbox'] {
		margin-top: 0.2rem;
		width: 1.1rem;
		height: 1.1rem;
		flex: none;
	}

	.knoepfe {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	.fehler {
		margin: 0;
		padding: 0.75rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}
</style>
