<script lang="ts">
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { tick, untrack } from 'svelte';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import { weisungsregelInWorten } from '$lib/domain/weisungsregel';
	import { KOPFBASIS_HINWEIS, OHNE_KOEPFE_HINWEIS, OHNE_KOEPFE_RECHT } from '$lib/domain/reglement';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Lesartenwahl from '$lib/components/Lesartenwahl.svelte';
	import { zeitpunktLang } from '$lib/domain/datum';
	import ErfordernisseNachziehen from '$lib/components/ErfordernisseNachziehen.svelte';
	let { data, form } = $props();

	let mitQuoten = $state(false);
	/** «Köpfe zählen nicht» (16.11.2026): dann braucht die Regel eine Wertquotenschwelle. */
	let ohneKoepfe = $state(false);
	/*
	 * Die Vorbelegung der Wertquotenfelder: ohne Köpfe das einfache Mehr der
	 * vertretenen Wertquoten (Laienprüfung 16.11.2026, L1), sonst wie bisher.
	 * Die Felder entstehen mit dem Haken neu, `anfangswert` greift also.
	 */
	const quotenvorgabe = $derived(
		ohneKoepfe
			? { art: 'mehr_als', zaehler: 1, nenner: 2, basis: 'anwesend_vertreten' }
			: { art: 'mindestens', zaehler: 2, nenner: 3, basis: 'alle_quoten' }
	);
	/** Ob die Weisungsregel zusätzlich Wertquoten verlangt («K und oder WQ»). */
	let weisungMitQuoten = $state(untrack(() => Boolean(data.weisungsregel?.quotenSchwelle)));
	/** Der Satz der geltenden Weisungsregel — derselbe, der später im Protokoll steht. */
	/*
	 * **Ob dieses Haus überhaupt in einem Verbund steht** (steht vor
	 * `imVerbund`, nicht vor `weisungssatz` — aus dem Code-Review).
	 * Die Weisungsregel
	 * beantwortet die Frage, wie das Haus zu seiner einen Stimme in der
	 * übergeordneten Gemeinschaft kommt — wird es nirgends als Mitglied geführt,
	 * gibt es die Frage nicht (Auftraggeber, 27.08.2026, Punkt 2 der sechs zur
	 * Reglementsseite).
	 *
	 * **Nicht am Elternbezug festmachen** (03.09.2026, im Drehbuch aufgefallen):
	 * Die fünf Häuser des Verbunddrehbuchs haben keinen und sind trotzdem
	 * Mitglieder. Massgebend ist die Eigentümerzeile, die auf dieses Haus
	 * lautet.
	 */
	const imVerbund = $derived(data.istMitglied === true);

	const weisungssatz = $derived(
		data.weisungsregel ? weisungsregelInWorten(data.weisungsregel) : ''
	);
	/** Welche Art gewählt ist — entscheidet, ob ein Satz zur Reichweite dazugehört. */
	let gewaehlteArt = $state('baulich_notwendig');

	/*
	 * **Der gewählte Fall, und warum er einen Zustand braucht** (Nachprüfung
	 * 23.08.2026).
	 *
	 * Zuerst stand hier `checked` als Attribut am ersten Knopf. Das wirkt nur
	 * beim ERSTEN Rendern: Wechselt man die Geschäftsart, erzeugt Svelte die
	 * Knöpfe neu — und danach ist **keiner** mehr gewählt. Gemessen: vier
	 * sichtbare Knöpfe, `knotenId` im Formular `undefined`.
	 *
	 * Beim Absenden wird daraus ein leerer Wert und damit «gilt für alle Fälle
	 * dieser Art» — genau die Wirkung, gegen die dieser Block gebaut wurde, und
	 * ohne dass es jemand sieht. Der Nachprüfer fand eine Regel, die trotz
	 * gesetztem Knopf vier Traktanden verschärfte.
	 *
	 * `bind:group` mit `$state` ist hier richtig und nicht die Hydrierungsfalle:
	 * Das Feld wird programmgeführt gesetzt (docs/gestaltung.md, Doktrin vom
	 * 11.08.2026).
	 */
	let gewaehlterFall = $state('');
	/*
	 * Wo eine Regel ohne Köpfe angewandt wird: je Art, beim gewählten Fall nur
	 * dieser (Codeprüfung Block A, zweiter Durchgang, B3).
	 */
	const ohneKoepfeFaelle = $derived(
		(data.ohneKoepfeGiltFuer[gewaehlteArt] ?? []).filter(
			(t) => !gewaehlterFall || t === data.fallTitel[gewaehlterFall]
		)
	);

	/*
	 * **Welche hinterlegte Abweichung gerade im Formular steht** (03.09.2026,
	 * Punkt 3 der sechs zur Reglementsseite).
	 *
	 * Gehalten wird die **Kennung**, nicht die Regel: Der Bestand entscheidet,
	 * was daraus wird. Hebt jemand die Regel auf, während sie im Formular steht —
	 * an der eigenen Zeile oder in einer zweiten Sitzung —, fällt sie aus
	 * `data.regeln`, `bearbeitet` wird von selbst leer und das Formular ist
	 * wieder eines zum Anlegen. Eine Kopie der Regel im Zustand behauptete
	 * stattdessen weiter, es gäbe sie.
	 */
	let bearbeiteteId = $state<string | null>(null);
	const bearbeitet = $derived(data.regeln.find((r) => r.id === bearbeiteteId) ?? null);

	/**
	 * Die Fälle zur Wahl: die frei wählbaren, und dazu der Fall, auf den die
	 * bearbeitete Regel heute beschränkt ist.
	 *
	 * **Warum der dazugehört** (03.09.2026, aus dem Code-Review). `data.faelle`
	 * ist für die **Wahl** gefiltert: Grenzfälle, Kenntnisnahmen und Knoten, an
	 * denen ein Reglement nichts ändern darf, stehen nicht darin. Eine bestehende
	 * Regel kann trotzdem auf einem solchen Knoten sitzen, seit das Regelwerk
	 * einen davon anders einordnet.
	 *
	 * Ohne diese Ergänzung geschah beim Ändern zweierlei, beides stumm: Der Griff
	 * oben fand den Fall nicht in der Liste und setzte ihn auf «alle», und wo nur
	 * ein Fall wählbar ist, wurde die Auswahl gar nicht erst gezeichnet — dann
	 * kommt `knotenId` leer beim Server an, und aus «nur für diesen Fall» wird
	 * «für alle Geschäfte dieser Art». Genau die stille Ausweitung, gegen die die
	 * Fallwahl am 22.08.2026 gebaut wurde.
	 */
	const faelleZurWahl = $derived.by(() => {
		const liste = data.faelle[gewaehlteArt] ?? [];
		const fall = bearbeitet?.geschaeftsart === gewaehlteArt ? bearbeitet?.knotenId : null;
		if (!fall || liste.some((f) => f.id === fall)) return liste;
		return [...liste, { id: fall, titel: data.fallTitel[fall] ?? fall, beispiele: [] }];
	});

	/*
	 * **Beim Artwechsel zurück auf «alle»** — aber nur, wenn der gewählte Fall in
	 * der neuen Art gar nicht zur Wahl steht. Ein Fall der alten Art wäre in der
	 * neuen fremd; der Kern wiese ihn ab («gehört nicht zur gewählten
	 * Geschäftsart»), und der Verwalter verstünde nicht, warum.
	 *
	 * **Warum nicht mehr unbedingt** (03.09.2026, beim Änderungsweg): Vorher
	 * setzte dieser Griff den Fall bei **jedem** Lauf zurück. Das genügte, solange
	 * nur Menschen die Art wechselten. Sobald das Formular eine bestehende Regel
	 * übernimmt, werden Art und Fall im selben Zug gesetzt — und der Griff lief
	 * danach und löschte den Fall wieder. Die Regel «nur für die Erhöhung des
	 * Erneuerungsfondsbeitrags» wäre beim Ändern still zu «für alle
	 * Jahresgeschäfte» geworden, also genau die Verwechslung, gegen die die
	 * Fallwahl gebaut wurde.
	 *
	 * **Gemessen wird gegen `faelleZurWahl`, nicht gegen `data.faelle`** (aus dem
	 * Code-Review): Sonst löscht dieser Griff genau die Beschränkung, die es zu
	 * erhalten gilt, sobald sie auf einem Knoten sitzt, den die Wahl nicht mehr
	 * anbietet.
	 *
	 * `untrack` beim Lesen des Falls: Sonst hinge der Griff an seinem eigenen
	 * Ergebnis.
	 */
	$effect(() => {
		const wahl = faelleZurWahl;
		const fall = untrack(() => gewaehlterFall);
		if (fall && !wahl.some((f) => f.id === fall)) gewaehlterFall = '';
	});

	/*
	 * **Greift in einer Art keine Regel für alle Geschäfte** (19.10.2026,
	 * Codeprüfung N3, Grundordnung mit der Einsprache): Dann ist «Für alle
	 * Geschäfte dieser Art» keine Wahl, die etwas bewirkt. Angeboten bleibt sie
	 * nur beim Ändern einer bestehenden allgemeinen Regel, damit sie nicht still
	 * auf einen Fall wechselt; sonst ist der Fall vorausgewählt.
	 */
	const nurEigensInDerArt = $derived(
		(data.faelle[gewaehlteArt] ?? []).length > 0 &&
			(data.faelle[gewaehlteArt] ?? []).every((f) => f.nurEigens)
	);
	const allgemeineBearbeitet = $derived(
		bearbeitet !== null && bearbeitet.geschaeftsart === gewaehlteArt && !bearbeitet.knotenId
	);
	$effect(() => {
		if (!nurEigensInDerArt || allgemeineBearbeitet) return;
		if (untrack(() => gewaehlterFall) === '') {
			gewaehlterFall = (data.faelle[gewaehlteArt] ?? [])[0]?.id ?? '';
		}
	});

	/**
	 * Die Werte einer bestehenden Regel ins Formular holen.
	 *
	 * Die drei Zustandsfelder werden hier von Hand nachgezogen: `anfangswert()`
	 * erreicht nur Felder, die der Browser neu erzeugt (dafür steht das `{#key}`
	 * am Formular), aber Geschäftsart, Fall und der Quotenhaken liegen als
	 * `$state` auf der Seite und überleben den Wechsel.
	 */
	async function bearbeiten(regel: (typeof data.regeln)[number]) {
		bearbeiteteId = regel.id;
		gewaehlteArt = regel.geschaeftsart;
		gewaehlterFall = regel.knotenId ?? '';
		mitQuoten = Boolean(regel.quotenSchwelle);
		ohneKoepfe = regel.kopfSchwelle === null;
		/*
		 * Ohne Sprung sieht der Klick aus wie nichts: Das Formular steht bei
		 * fünf hinterlegten Regeln rund zwei Bildschirme weiter unten. Kein
		 * `smooth` — die Anwendung nimmt Rücksicht auf `prefers-reduced-motion`,
		 * und ein gezielter Sprung braucht keine Bewegung.
		 */
		await tick();
		/*
		 * Angesprungen wird der **Titel**, nicht das Formular: Sonst steht die
		 * Ueberschrift samt dem Satz, welche Regel gerade bearbeitet wird, ueber
		 * dem Bildrand. Die klebende Kopfleiste ueberdeckt das Ziel nicht —
		 * `html { scroll-padding-top }` in `app.css` haelt sie frei.
		 */
		const titel = document.getElementById('abweichungstitel');
		titel?.scrollIntoView({ block: 'start' });
		titel?.focus();
	}

	/** Die Bearbeitung verlassen, ohne zu schreiben. */
	function bearbeitungAbbrechen() {
		bearbeiteteId = null;
		gewaehlteArt = 'baulich_notwendig';
		gewaehlterFall = '';
		mitQuoten = false;
		ohneKoepfe = false;
	}

	/** Geschäftsarten nach Gruppe, damit die Auswahl nicht zur Liste von vierzehn wird. */
	const gruppen = $derived(
		data.geschaeftsarten.reduce<Record<string, typeof data.geschaeftsarten>>((acc, g) => {
			(acc[g.gruppe] ??= []).push(g);
			return acc;
		}, {})
	);

	function bezeichnung(art: string): string {
		return data.geschaeftsarten.find((g) => g.art === art)?.bezeichnung ?? art;
	}

	/*
	 * **Die Reihenfolge der Standardtraktanden** (Block C2, 31.08.2026).
	 *
	 * Als Zustand und nicht als reine Ableitung, weil die Auf/Ab-Knöpfe die
	 * Liste sofort umsortieren — wer zweimal hintereinander verschiebt und
	 * dann speichert, erwartet die Reihenfolge, die er sieht. Der Anfangswert
	 * ist die gespeicherte Ordnung oder die Code-Reihenfolge.
	 */
	// svelte-ignore state_referenced_locally
	let ordnung = $state<string[]>(
		untrack(() => data.vorlagen.map((v) => v.schluessel))
	);

	/** Die Vorlage zu einem Schlüssel — für Titel und Kurzfassung in der Liste. */
	const vorlageJeSchluessel = $derived(
		new Map(data.vorlagen.map((v) => [v.schluessel, v] as const))
	);

	/** Ob die Liste noch der gespeicherten entspricht — sonst warnt der Knopf. */
	const ungespeichert = $derived(
		ordnung.join('\u0000') !== data.vorlagen.map((v) => v.schluessel).join('\u0000')
	);

	function hoeher(i: number) {
		if (i <= 0) return;
		const neu = [...ordnung];
		[neu[i - 1], neu[i]] = [neu[i], neu[i - 1]];
		ordnung = neu;
	}

	function tiefer(i: number) {
		if (i >= ordnung.length - 1) return;
		const neu = [...ordnung];
		[neu[i + 1], neu[i]] = [neu[i], neu[i + 1]];
		ordnung = neu;
	}
</script>

<h1>Abweichende Quoren im Reglement</h1>

<p class="einleitung">
	Das Gesetz kennt ein Erfordernis, das Reglement kann ein anderes vorsehen — und dann gilt das
	Reglement. Was hier hinterlegt ist, wendet das Werkzeug bei jeder Herleitung an, statt bloss
	darauf hinzuweisen.
</p>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.gespeichert}
	<Meldung ton="gut" marke={form}>Regel hinterlegt.</Meldung>
{:else if form?.geaendert}
	<Meldung ton="gut" marke={form}>Abweichung geändert.</Meldung>
{:else if form?.unveraendert}
	<!--
		**Auch das ist eine Antwort.** Wer das Änderungsformular öffnet und
		unverändert abschickt, hat nichts geändert — und es steht auch nichts im
		Verlauf. Ohne diesen Satz sähe das Ausbleiben jeder Meldung aus wie ein
		Fehlschlag, und der nächste Griff wäre ein zweiter Klick.
	-->
	<Meldung ton="gut" marke={form}>Nichts geändert, die Regel steht unverändert da.</Meldung>
{:else if form?.aufgehoben}
	<Meldung ton="gut" marke={form}>Regel aufgehoben.</Meldung>
{:else if form?.bestaetigt}
	<Meldung ton="gut" marke={form}>Durchsicht bestätigt.</Meldung>
{:else if form?.zurueckgesetzt}
	<Meldung ton="gut" marke={form}>Bestätigung zurückgesetzt.</Meldung>
{:else if form?.vermerkt}
	<Meldung ton="gut" marke={form}>Vermerk gespeichert.</Meldung>
{:else if form?.ordnungGespeichert}
	<Meldung ton="gut" marke={form}>Reihenfolge der Standardtraktanden gespeichert.</Meldung>
{:else if form?.fondsgrenzeGespeichert}
	<Meldung ton="gut" marke={form}>Bestimmung zum Erneuerungsfonds gespeichert.</Meldung>
{:else if form?.fristGespeichert}
	<Meldung ton="gut" marke={form}>Einberufungsfrist gespeichert.</Meldung>
{:else if form?.zweitfristGespeichert}
	<Meldung ton="gut" marke={form}>Frist zur zweiten Versammlung gespeichert.</Meldung>
{:else if form?.schrankeGespeichert}
	<Meldung ton="gut" marke={form}>Schranke für Reglementsänderungen gespeichert.</Meldung>
{:else if form?.lesartenGespeichert}
	<Meldung ton="gut" marke={form}>Lesarten gespeichert.</Meldung>
{:else if form?.lesartenrechtGespeichert}
	<Meldung ton="gut" marke={form}>Gespeichert, wer die Lesarten umstellen darf.</Meldung>
{:else if form?.ausnahmenGespeichert}
	<Meldung ton="gut" marke={form}>Angabe zu nicht angekündigten Geschäften gespeichert.</Meldung>
{:else if form?.neuabstimmungGespeichert}
	<Meldung ton="gut" marke={form}>
		Neuabstimmung nach Eintritt der Beschlussfähigkeit gespeichert.
	</Meldung>
{:else if form?.milderungNachFristGespeichert}
	<Meldung ton="gut" marke={form}>
		Einstellung zum milderen Mehr nach Ablauf der Einberufungsfrist gespeichert.
	</Meldung>
{:else if form?.ordnungZurueckgesetzt}
	<Meldung ton="gut" marke={form}>Zurückgesetzt — ab jetzt gilt wieder die Standardreihenfolge.</Meldung>
{/if}

<!--
	**Der Seitenaufbau** (03.09.2026, Punkte 5 und 6 des Plans): Lage, dann
	Bestand, dann Handeln, in fester Reihenfolge und ueber die volle Bahn
	(`docs/plan-seitenaufbau-2026-08-27.md`). Vorher standen zwei Formulare
	— die Schranke der eigenen Aenderung und die Einberufungsfrist — vor der
	Tabelle, die sie gar nicht betreffen: Wer nachsehen wollte, was hinterlegt
	ist, rollte an zwei Erfassungskaesten vorbei.

	Einen Abschnitt «Hintergrund» hat diese Seite nicht. Was an
	Rechtsgrundlagen dazugehoert, steht dort, wo entschieden wird: die
	gesetzliche Lage je Geschaeftsart als Ausklapper im Formular, die fuenf
	Faelle des Reglementsvorbehalts auf der Ergebniskarte.
-->
<div class="seitenstapel">
	<section class="abschnitt">
		<section class="kasten" class:offen={data.offen}>
			<h2>Durchsicht des Reglements</h2>
			<p>{data.hinweis}</p>

			{#if data.offen}
				<!--
					**Zweimal derselbe Satz** (23.08.2026, Prüflauf I, A-24). Darüber steht
					schon «Solange das offen ist, gilt hier das Gesetz — möglicherweise zu
					Unrecht»; hier stand er ein zweites Mal, nur mit anderen Wörtern. Was
					bleibt, ist das, was oben nicht steht.
				-->
				<p class="klein">
					Bestätigen Sie die Durchsicht auch dann, wenn Sie nichts gefunden haben — sonst
					wiederholt sich dieser Punkt vor jeder Versammlung.
				</p>
				<form method="POST" action="?/bestaetigen" class="felder">
					<label class="schmal">
						Durchgesehen am
						<input type="date" name="tag" {...anfangswert(data.heute)} required />
					</label>
					<button type="submit">Durchsicht bestätigen</button>
				</form>
			{:else}
				<form method="POST" action="?/zuruecksetzen" class="felder">
					<label class="breit">
						Zurücksetzen, weil
						<input name="grund" required minlength="3" placeholder="Reglement per 01.01.2027 geändert" />
					</label>
					<button type="submit" class="leise">Bestätigung zurücksetzen</button>
				</form>
			{/if}
		</section>

		<!--
			**Der Hinweis auf die Beschlussfaehigkeit** (03.09.2026, Punkt 4 der sechs
			zur Reglementsseite). Der Auftraggeber fragte, ob hier die Auswahl dafuer fehle.
			Nachgesehen: Das Feld fehlt nicht, es steht auf einer eigenen Seite. Die
			beiden Tabellen beantworten verschiedene Fragen — `bylaw_quorum_rule`
			haengt an der Geschaeftsart, `bylaw_attendance_rule` an der
			Versammlungsart und traegt die Untergrenze aus ZGB 712p.

			Der Befund hinter der Frage war ein anderer: Diese Seite erwaehnte die
			Beschlussfaehigkeit mit keinem Wort, gemessen null Treffer in der Datei.
			Wer hier nach ihr sucht, sucht am falschen Ort und weiss nicht, dass es
			den richtigen gibt.
		-->
		<p class="hilfe verweis">
			<strong>Nicht hier, sondern nebenan:</strong> Wie viele Eigentümer und Wertquoten
			anwesend sein müssen, damit überhaupt gültig beschlossen werden kann, steht unter
			<a href="/gemeinschaften/{data.gemeinschaft.id}/beschlussfaehigkeit">Beschlussfähigkeit</a>.
			Hier geht es um die Zustimmung, die ein Beschluss dann braucht.
		</p>

	</section>

	<section class="abschnitt">
		<h2>Hinterlegte Abweichungen</h2>

		{#if data.regeln.length === 0}
			<p class="leer">Keine Abweichung hinterlegt. Es gilt durchgehend das Gesetz.</p>
		{:else}
			<div class="tabellenrahmen">
				<!--
					Die `id` ist ein Bezeichner fuer das Drehbuch, keine Gestaltung: Die Seite
					fuehrt zwei Tabellen (hier die Regeln, weiter oben die Traktanden mit
					aelterem Erfordernis), und ein `tbody tr` ohne Eingrenzung zaehlt beide.
				-->
				<table id="abweichungstabelle">
					<thead>
						<tr>
							<th>Geschäftsart</th>
							<th>Erfordernis</th>
							<th>Fundstelle</th>
							<th>Enthaltung</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each data.regeln as regel (regel.id)}
							<tr>
								<!--
									**Die Beschränkung gehört in die Zeile** (Nachprüfung 23.08.2026). Ohne
									sie stand dort bloss «Jahresgeschäfte», und wer die Regel später prüfte,
									sah ihre Reichweite nirgends — obwohl genau die der Unterschied ist
									zwischen «trifft vier Geschäfte» und «trifft eines».
								-->
								<td>
									{bezeichnung(regel.geschaeftsart)}
									{#if regel.knotenId}
										<!--
											`fallTitel` und nicht `faelle`: Letzteres ist fuer die Wahl
											gefiltert, und ein Fall, der heute nicht mehr waehlbar ist,
											stand hier als rohe Kennung («k-ausschlussklage») statt als
											Titel.
										-->
										<span class="klein nurfall"
											>nur «{data.fallTitel[regel.knotenId] ?? regel.knotenId}»</span
										>
									{:else if (data.faelle[regel.geschaeftsart] ?? []).filter((f) => !f.nurEigens).length > 1}
										<span class="klein nurfall"
											>alle {data.faelle[regel.geschaeftsart].filter((f) => !f.nurEigens)
												.length} Geschäfte dieser Art</span
										>
									{/if}
									<!--
										Sonst stand bei einer Regel für die ganze Nutzungsänderung gar
										kein Vermerk, und dass sie die Zweckbestimmung nicht erreicht,
										sah man nur im Formular (Laien- und Codeprüfung Runde 3).
									-->
									{#if !regel.knotenId}
										{#each (data.faelle[regel.geschaeftsart] ?? []).filter((f) => f.nurEigens) as f (f.id)}
											<span class="klein nurfall">nicht «{f.titel}»</span>
										{/each}
									{/if}
								</td>
								<td>{regel.satz}</td>
								<td>{regel.fundstelle}</td>
								<td>{regel.enthaltungZaehltMit ? 'zählt mit' : 'fällt aus der Basis'}</td>
								<td>
									<!--
										**Ändern steht vor Aufheben** (03.09.2026, Punkt 3 der sechs).
										Bis dahin trug die Zeile nur «Aufheben», und ein Vertipper in der
										Fundstelle zwang dazu, die Regel wegzuwerfen und alle acht Felder
										neu zu tippen — mit dem Reglement daneben, weil man sie nirgends
										mehr ablesen kann. Derselbe Mangel wie beim Verteiler am
										11.08.2026, eine Stufe später.

										Der Knopf schreibt nichts, er holt die Werte ins Formular unten:
										deshalb kein Formular, sondern ein Knopf.
									-->
									<div class="zeilenknoepfe">
										<button
											type="button"
											class="leise"
											aria-pressed={bearbeitet?.id === regel.id}
											onclick={() => bearbeiten(regel)}>Ändern</button
										>
										<!--
											`use:enhance`, damit ein Aufheben nicht die ganze Seite neu lädt
											und dabei eine offene Bearbeitung mitnimmt (Regel «Ein Formular,
											das schreibt, lädt die Seite nicht neu», docs/gestaltung.md).
										-->
										<form method="POST" action="?/aufheben" use:enhance={absenden()}>
											<input type="hidden" name="regelId" value={regel.id} />
											<button type="submit" class="leise">Aufheben</button>
										</form>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<!--
			**Was die Regeln an dem ändern, was schon dasteht** (23.08.2026, Prüflauf II,
			B-01).

			Ein Erfordernis wird beim Anlegen eines Traktandums hergeleitet und in die
			Zeile geschrieben — festgehalten, nicht errechnet. Wer die Regel
			danach erfasst, ändert daran nichts. Im Prüflauf standen deshalb zwei
			verschiedene Erfordernisse für denselben Fall in einer Traktandenliste, und
			die Liste dient als Einladung: Angekündigt war das falsche Mehr.

			Der Kasten steht **unter** den Regeln, nicht darüber: Er ist die Folge
			dessen, was dort steht. Und er verschwindet, sobald nichts mehr abweicht —
			ein Hinweis, der immer dasteht, wird nicht gelesen.
		-->
		<ErfordernisseNachziehen veraltet={data.veraltet} />
	</section>

	<section class="abschnitt">
		<!--
			**Ein Formular fuer beides** (03.09.2026, Punkt 3 der sechs zur
			Reglementsseite). Anlegen und Aendern fragen dasselbe ab, und ein zweites
			Formular daneben waere derselbe halbe Bildschirm ein zweites Mal, mit dem
			Risiko, dass eine Aenderung an den Feldern nur eines von beiden erreicht.
			Verschieden sind allein das Ziel (`?/aendern` prueft, ob der Schluessel schon
			belegt ist, `?/hinterlegen` ersetzt bewusst) und die Beschriftung.

			**Das `{#key}` ist nicht Beiwerk.** `anfangswert()` setzt im Browser
			`defaultValue` — das wirkt nur auf ein Feld, das gerade neu entstanden ist.
			Ohne den Schluesselwechsel stuenden beim Aufruf einer Regel weiterhin die
			Vorgabewerte in den Feldern, und wer «Aendern» drueckte, ueberschriebe seine
			Fundstelle mit «2/3 aller Eigentuemer».
		-->
		<h2 id="abweichungstitel" tabindex="-1">
			{bearbeitet ? 'Abweichung ändern' : 'Abweichung hinterlegen'}
		</h2>

		{#if bearbeitet}
			<p class="hilfe bearbeitungshinweis">
				Geändert wird die hinterlegte Regel zu <strong>{bezeichnung(bearbeitet.geschaeftsart)}</strong>
				({bearbeitet.fundstelle}). Sie behält ihre Kennung, und im Verlauf steht danach eine
				Änderung samt dem, was vorher dastand, nicht eine neue Regel neben einer gelöschten.
			</p>
		{/if}

		{#key bearbeitet?.id ?? 'neu'}
			<form
				id="abweichungsformular"
				method="POST"
				action={bearbeitet ? '?/aendern' : '?/hinterlegen'}
				class="formular"
				use:enhance={absenden({
					beiErfolg: () => {
						if (bearbeiteteId) bearbeitungAbbrechen();
					}
				})}
			>
				{#if bearbeitet}
					<input type="hidden" name="regelId" value={bearbeitet.id} />
				{/if}
			<label class="breit">
				Geschäftsart
				<Suchauswahl
					name="geschaeftsart"
					beschriftung="Geschäftsart"
					pflicht
					bind:wert={gewaehlteArt}
					eintraege={Object.entries(gruppen).flatMap(([gruppe, arten]) =>
						arten.map((g) => ({
							wert: g.art,
							text: g.bezeichnung,
							gruppe,
							/*
								**Die Fälle machen die Art auffindbar** (Bedienbarkeitsprüfung
								05.09.2026, dritter der schweren Befunde). Wer «Erneuerungsfonds»
								sucht, meint den Fall, nicht die Art «Jahresgeschäfte» — und fand
								bis hierher nichts. Die Titel stehen nicht in der Liste, sondern
								nur im Suchtext: Sichtbar bleibt die Art, gefunden wird sie über
								das, was in ihr steckt.

								**Mit den Beispielen** (Code-Review 06.09.2026): Die Fallauswahl
								eine Ebene tiefer sucht seit je auch darüber — «Wärmepumpe»
								findet dort die nützliche bauliche Massnahme. Ohne sie fände
								dasselbe Wort hier nichts.

								**Ohne die gesperrten Fälle**, und das mit Absicht: `data.faelle`
								ist für die Wahl gefiltert. Ein Fall, der keine Abweichung
								zulässt, wäre über die Suche zwar auffindbar, danach aber nicht
								wählbar — eine neue Sackgasse statt der behobenen. Dass die
								Anwendung für diesen Fall gar nichts sagt, ist ein eigener
								Befund und gehört nicht in diese Zeile.
							*/
							auchSuchen: (data.faelle[g.art] ?? [])
								.flatMap((f) => [f.titel, ...(f.beispiele ?? [])])
								.join(' ')
						}))
					)}
				/>
				<!--
					**Der Satz stimmte bis zur zweiten Achse** (Migrationen 076/077, seit
					22.08.2026). Seither gibt es je Art UND Fall eine Regel — eine allgemeine
					und eine schärfere stehen nebeneinander. Der alte Wortlaut blieb stehen
					und behauptete das Gegenteil; gefunden in der Nachprüfung 23.08.2026.
				-->
				<!--
					**Derselbe Satz waere beim Aendern falsch** (03.09.2026, in der Sichtprobe
					gefunden). Er sagt, eine zweite Regel ersetze die erste — das gilt fuer den
					Anlegeweg und ist dort die Absicht. Der Aenderungsweg weist genau das ab,
					weil es hier das Verdraengen einer **fremden** Zeile waere. Ein Satz, der
					das Gegenteil dessen behauptet, was der Knopf darunter tut, ist schlimmer
					als keiner.
				-->
				{#if bearbeitet}
					<span class="hilfe">
						Eine Regel je Geschäftsart und Fall. Steht für die neue Art oder den neuen Fall schon
						eine andere Abweichung, wird die Änderung abgewiesen: jene zu verdrängen wäre ein
						Verlust, den niemand sieht.
					</span>
				{:else}
					<span class="hilfe">
						Eine Regel je Geschäftsart und Fall. Eine zweite für dasselbe ersetzt die erste — zwei
						widersprüchliche wären schlimmer als keine.
					</span>
				{/if}
			</label>

			<!--
				Zwei Arten brauchen einen Satz mehr, weil ihre Regel nicht immer gilt. Er
				steht hier und nicht erst auf der Ergebniskarte: Wer die Regel erfasst, soll
				wissen, was sie bewirkt — nicht erst der, der im Saal davorsteht.
			-->
			{#if gewaehlteArt === 'rueckkommen'}
				<p class="anmerkung voll">
					Angewandt wird diese Regel nur, wenn sie <strong>nicht hinter dem Erfordernis des
					Beschlusses zurückbleibt</strong>, auf den zurückgekommen wird. Sonst liesse sich über den
					Umweg des Rückkommens aufheben, was ohne diesen Umweg nicht aufzuheben wäre. War der
					frühere Antrag <em>abgelehnt</em>, gilt sie immer — dann gibt es keinen Beschluss zu
					schützen.
				</p>
			{:else if data.reichweiten[gewaehlteArt]}
				<!-- Aus der geltenden Fassung gerechnet, nicht hier behauptet: Welche
				     Knoten dieser Geschäftsart eine Regel erreicht und welche nicht
				     (Prüfung vom 15.08.2026, Befunde B-6 bis B-11). -->
				<p class="anmerkung voll">{data.reichweiten[gewaehlteArt]}</p>
			{/if}

			<!--
				**Wovon Sie abweichen** (23.08.2026, Prüflauf I, A-14). Die Seite heisst
				«Abweichende Quoren» und verlangt damit einen Vergleich — zeigte aber
				nirgends, was das Gesetz für die gewählte Art vorsieht. Wer zwei Drittel
				hinterlegt, ohne zu wissen, dass das Gesetz hier schon zwei Drittel
				verlangt, hat eine Regel erfasst, die nichts ändert.
			-->
			<!--
				**`gesetzlicheLage` und nicht `faelle`** (23.09.2026). `faelle` ist
				auf das gefiltert, worauf sich eine Regel beschränken lässt; dieser
				Ausklapper sagt dagegen, wovon man abweicht, und das ist gerade dort
				interessant, wo eine Abweichung schwer ist. Hing er an `faelle`,
				verschwand er, sobald eine Geschäftsart durchgehend gesperrt war —
				und mit ihm die Auskunft, was das Gesetz verlangt.
			-->
			{#if (data.gesetzlicheLage[gewaehlteArt] ?? []).length > 0}
				<details class="voll gesetzlich">
					<summary>Was das Gesetz für diese Art vorsieht</summary>
					<dl>
						{#each data.gesetzlicheLage[gewaehlteArt] as f (f.id)}
							<div>
								<dt>{f.titel}</dt>
								<dd>
									{f.gesetzlich}
									<!--
										**Wofür die Art gilt** — zweiter Teil von A-14: «Dazu fehlt eine
										Zuordnungshilfe: welche Geschäfte fallen unter welche der 15
										Arten? Für § 15 (Erneuerungsfondsbeitrag) habe ich geraten.»

										Die Beispiele stammen aus dem Regelwerk, nicht aus dieser Datei
										(AD-4): Was fachlich zu einem Fall gehört, entscheidet die
										Fassung. Dieselbe Quelle speist die thematische Suche der
										Fallauswahl.
									-->
									{#if f.beispiele.length > 0}
										<span class="beispiele">z. B. {f.beispiele.join(' · ')}</span>
									{/if}
								</dd>
							</div>
						{/each}
					</dl>
				</details>
			{/if}

			<!--
				**Was diese Regel alles trifft** (22.08.2026, Befund B-02 des
				Usability-Prüflaufs). Die Zuordnung läuft über die Geschäftsart, und eine
				Art umfasst mehrere Fälle: Wer § 15 «zwei Drittel für den
				Erneuerungsfonds» erfasst, verschärft damit auch Jahresrechnung, Budget,
				Décharge und die Ermächtigung zur Prozessführung.

				Bis hierher stand davon nichts auf der Seite. Gefunden wurde es im
				Prüflauf nur, weil jemand die Formeln der Auszählmappe las — und bis
				dahin hätte ein Budget mit 3:2 als abgelehnt gegolten.

				**Ab zwei Fällen** steht die Liste da. Bei einem einzigen wäre sie
				Beiwerk: Dann ist die Geschäftsart der Fall.
			-->
			<!--
				**Die Wahl, auf die es ankommt** (22.08.2026, Befund B-02). Eine
				Geschäftsart umfasst mehrere Fälle; «Jahresgeschäfte» etwa vier. Bis zur
				Migration 076 traf eine Regel zwangsläufig alle — wer § 15 für den
				Erneuerungsfonds hinterlegte, verschärfte damit auch Jahresrechnung, Budget
				und Décharge, ohne dass es irgendwo stand.

				**Die Vorauswahl bleibt «alle»,** weil es die bisherige Wirkung ist und die
				häufigere: Die meisten Reglementsklauseln sprechen von «baulichen
				Massnahmen» und nicht von einem einzelnen Fall des Entscheidbaums.

				Erst ab zwei Fällen sichtbar — bei einem einzigen ist die Art der Fall.
			-->
			<!--
				**Auch bei einem einzigen Fall sichtbar, sobald einer gesetzt ist**
				(03.09.2026, aus dem Code-Review). Die Bedingung war «ab zwei Fällen», und
				das stimmt fuer das Anlegen: Bei einem einzigen ist die Art der Fall.
				Beim Aendern einer Regel, die auf genau diesen einen beschraenkt ist, wurde
				die Auswahl dann gar nicht gezeichnet — und ein Feld, das nicht da ist,
				schickt nichts: `knotenId` kam leer an, und aus «nur fuer diesen Fall»
				wurde «fuer alle Geschaefte dieser Art», ohne dass es jemand sah.
			-->
			<!--
				**Auch bei einem einzigen Fall, der nur eigens greift** (19.10.2026,
				Einsprache in der Grundordnung): Ohne Auswahl käme die Regel als «für
				alle Geschäfte dieser Art» an, und dort wendet die Anwendung sie nicht an.
			-->
			{#if faelleZurWahl.length > 1 || gewaehlterFall || faelleZurWahl.some((f) => 'nurEigens' in f && f.nurEigens)}
				<fieldset class="fallwahl">
					<legend>Wofür genau gilt die Regel?</legend>
					{#if !nurEigensInDerArt || allgemeineBearbeitet}
					<label>
						<input type="radio" name="knotenId" value="" bind:group={gewaehlterFall} />
						<span>
							<strong>Für alle Geschäfte dieser Art</strong>
							<!-- Trenner nur zwischen Einträgen (Codeprüfung N3, 19.10.2026). -->
							<span class="klein">
								{[
									...(data.faelle[gewaehlteArt] ?? []).filter((f) => !f.nurEigens).map((f) => f.titel),
									...(data.faelle[gewaehlteArt] ?? [])
										.filter((f) => f.nurEigens)
										.map((f) => `nicht «${f.titel}»: Dort gilt nur eine Regel, die Sie eigens dafür wählen.`)
								].join(' · ')}
							</span>
						</span>
					</label>
					{/if}
					{#each faelleZurWahl as fall (fall.id)}
						<label>
							<input type="radio" name="knotenId" value={fall.id} bind:group={gewaehlterFall} />
							<span>Nur für «{fall.titel}»</span>
						</label>
					{/each}
					<!--
						**Ab der Fassung 2026-11-18 hat die Art «Reglement» drei Fälle**
						(Featureprüfung Erneuerungsfonds, B3): Eine Regel nur für die
						gewöhnliche Bestimmung trifft die beiden Karten zur Einlage nicht,
						und dort rechnete die Anwendung sonst still nach dem Gesetz.
					-->
					{#if gewaehlteArt === 'reglement'}
						<p class="klein">
							Die beiden Karten zu einer Einlage in den Erneuerungsfonds über Grenze oder Höhe des
							Reglements rechnen mit dem Mehr einer Reglementsänderung. Eine Regel nur für «Reglement
							ändern, gewöhnliche Bestimmung» gilt dort nicht; dafür wählen Sie «Für alle Geschäfte
							dieser Art».
						</p>
					{/if}
					<!-- Nicht, wenn die allgemeine Wahl fehlt (Codeprüfung Durchgang 2, N3). -->
					{#if !nurEigensInDerArt || allgemeineBearbeitet}
					<p class="klein">
						Nennt Ihre Reglementsklausel einen bestimmten Fall — «Erhöhung des
						Erneuerungsfondsbeitrags» —, wählen Sie ihn. Sonst gilt die Regel für alle
						Geschäfte der Art, auch für die, an die Sie beim Erfassen nicht gedacht haben.
					</p>
					{/if}
				</fieldset>
			{/if}

			<fieldset>
				<legend>Kopfstimmen</legend>
				<label class="kasten-label">
					<input
						type="checkbox"
						name="kopfeZaehlenNicht"
						value="true"
						bind:checked={ohneKoepfe}
						onchange={() => {
							if (ohneKoepfe) mitQuoten = true;
						}}
					/>
					Köpfe zählen nicht, nur die Wertquoten
				</label>
				{#if ohneKoepfe}
					<p class="hilfe">{OHNE_KOEPFE_HINWEIS}</p>
					<p class="hilfe">{OHNE_KOEPFE_RECHT}</p>
					<p class="hilfe">
						{#if ohneKoepfeFaelle.length > 0}
							Angewandt wird sie bei: {ohneKoepfeFaelle.map((t) => `«${t}»`).join(', ')}.
						{:else}
							Bei dieser Geschäftsart greift sie nirgends: Das Gesetz verlangt hier mehr als das einfache Mehr, oder es lässt keine Erleichterung zu.
						{/if}
					</p>
				{:else}
				<div class="reihe">
					<label class="eng">
						Lesart
						<select name="kopfArt" required>
							<option
								value="mindestens"
								selected={(bearbeitet?.kopfSchwelle?.art ?? 'mindestens') === 'mindestens'}
								>mindestens</option
							>
							<option value="mehr_als" selected={bearbeitet?.kopfSchwelle?.art === 'mehr_als'}
								>mehr als</option
							>
						</select>
					</label>
					<label class="eng">
						Zähler
						<input
							type="number"
							name="kopfZaehler"
							min="1"
							max="100"
							required
							{...anfangswert(String(bearbeitet?.kopfSchwelle?.zaehler ?? 2))}
						/>
					</label>
					<label class="eng">
						Nenner
						<!--
							**`min="1"`, damit die Einstimmigkeit hinterlegbar ist** (22.08.2026).
							Mit `min="2"` blockte der Browser, bevor der Server je gefragt wurde —
							und seine Blase ist englisch, verschwindet nach Sekunden und
							hinterlässt kein Element im Baum. Für den Prüfer sah es aus, als
							weise die Anwendung stumm ab.
						-->
						<input
							type="number"
							name="kopfNenner"
							min="1"
							max="100"
							required
							{...anfangswert(String(bearbeitet?.kopfSchwelle?.nenner ?? 3))}
						/>
					</label>
					<label class="breit">
						Bezugsgrösse
						<select name="kopfbasis" required>
							<option
								value="anwesend_vertreten"
								selected={(bearbeitet?.kopfbasis ?? 'anwesend_vertreten') === 'anwesend_vertreten'}
								>anwesende und vertretene Stimmen</option
							>
							<option value="alle_eigentuemer" selected={bearbeitet?.kopfbasis === 'alle_eigentuemer'}
								>alle Eigentümer, auch die abwesenden</option
							>
							<option
								value="alle_ausser_betroffene"
								selected={bearbeitet?.kopfbasis === 'alle_ausser_betroffene'}
								>alle ausser den unmittelbar Betroffenen</option
							>
						</select>
					</label>
				</div>
				<p class="hilfe">
					«mindestens zwei Drittel» und «mehr als zwei Drittel» sind nicht dasselbe: Bei 6 Stimmen
					sind es 4 oder 5. Reglemente meinen in aller Regel «mindestens».
				</p>
				<!-- Entscheid 0054, Punkt 5 (Frage 93): welche Bezugsgrösse zur Klausel gehört. -->
				<p class="hilfe">{KOPFBASIS_HINWEIS}</p>
				{/if}
			</fieldset>

			<label class="kasten-label">
				<input type="checkbox" name="mitQuoten" value="true" bind:checked={mitQuoten} disabled={ohneKoepfe} />
				{ohneKoepfe ? 'Wertquotenschwelle (nötig, weil die Köpfe nicht zählen)' : 'Zusätzlich eine Wertquotenschwelle'}
			</label>

			{#if mitQuoten}
				<fieldset>
					<legend>Wertquoten</legend>
					<div class="reihe">
						<label class="eng">
							Lesart
							<select name="quotenArt">
								<option
									value="mindestens"
									selected={(bearbeitet?.quotenSchwelle?.art ?? quotenvorgabe.art) === 'mindestens'}
									>mindestens</option
								>
								<option value="mehr_als" selected={(bearbeitet?.quotenSchwelle?.art ?? quotenvorgabe.art) === 'mehr_als'}
									>mehr als</option
								>
							</select>
						</label>
						<label class="eng">
							Zähler
							<input
								type="number"
								name="quotenZaehler"
								min="1"
								max="100"
								{...anfangswert(String(bearbeitet?.quotenSchwelle?.zaehler ?? quotenvorgabe.zaehler))}
							/>
						</label>
						<label class="eng">
							Nenner
							<input
								type="number"
								name="quotenNenner"
								min="1"
								max="100"
								{...anfangswert(String(bearbeitet?.quotenSchwelle?.nenner ?? quotenvorgabe.nenner))}
							/>
						</label>
						<label class="breit">
							Bezugsgrösse
							<select name="quotenbasis">
								<option
									value="alle_quoten"
									selected={(bearbeitet?.quotenSchwelle ? bearbeitet.quotenbasis : quotenvorgabe.basis) === 'alle_quoten'}
									>alle Wertquoten der Gemeinschaft</option
								>
								<option
									value="anwesend_vertreten"
									selected={(bearbeitet?.quotenSchwelle ? bearbeitet.quotenbasis : quotenvorgabe.basis) === 'anwesend_vertreten'}
									>nur die anwesenden oder vertretenen</option
								>
							</select>
						</label>
					</div>
				</fieldset>
			{/if}

			<label class="breit">
				Fundstelle im Reglement
				<input
					name="fundstelle"
					required
					minlength="3"
					placeholder="Reglement Ziff. 12.3"
					{...anfangswert(bearbeitet?.fundstelle ?? '')}
				/>
				<span class="hilfe">
					Pflicht. Ohne sie steht im Streitfall eine Behauptung gegen das Reglement.
				</span>
			</label>

			<label class="kasten-label">
				<input
					type="checkbox"
					name="enthaltungZaehltMit"
					value="true"
					{...angekreuzt(bearbeitet?.enthaltungZaehltMit ?? true)}
				/>
				Enthaltungen bleiben in der Bezugsgrösse
				<span class="hilfe">
					Abwählen, wenn das Reglement sie herausnimmt. Der Unterschied entscheidet über Annahme oder
					Ablehnung.
				</span>
			</label>

			<label class="breit">
				Hinweis für die Sitzungsleitung (freiwillig)
				<input name="hinweis" {...anfangswert(bearbeitet?.hinweis ?? '')} />
				</label>

				<div class="formularknoepfe">
					<button type="submit">{bearbeitet ? 'Änderung speichern' : 'Hinterlegen'}</button>
					{#if bearbeitet}
						<!--
							**Ein Ausweg gehoert dazu.** Ohne ihn bliebe das Formular auf der
							aufgerufenen Regel stehen, und wer statt der Aenderung doch eine neue
							Regel erfassen wollte, muesste die Seite neu laden.
						-->
						<button type="button" class="leise" onclick={bearbeitungAbbrechen}>Abbrechen</button>
					{/if}
				</div>
			</form>
		{/key}

		<!-- ── Schranke über die eigene Änderung (Auftraggeber, 28.08.2026) ────────────────── -->
		<!--
			**«Option Merkmal einstimmig vereinbart einbauen.»** Den Fall kennt das
			Regelwerk seit je (`k-reglement-eigene-schranke`): Wo das Reglement seine
			eigene Änderung an Einstimmigkeit bindet, darf keine hinterlegte Abweichung
			sie mildern. Nur musste die Frage bei **jedem** Traktandum neu beantwortet
			werden — und wer sie nicht kannte, beantwortete sie falsch.

			Hier steht sie einmal, mit Fundstelle. Die Erfordernisseite zeigt sie dann
			an der Stelle, an der die Frage gestellt wird.

			**Was der Text NICHT verspricht** (01.09.2026, aus dem Code-Review): dass die
			Herleitung sie von selbst anwendet. Sie tut es nicht — gewirkt wird weiter
			über die Antwort im Baum (`k-reglement-eigene-schranke`, `gesperrt_reglement`).
			Wer «Reglement, gewöhnliche Bestimmung» wählt, bekommt das einfache Mehr,
			auch wenn hier ein Haken steht. Die erste Fassung dieses Absatzes sicherte
			das Gegenteil zu — eine Zusicherung ohne Deckung. Ob die Herleitung sie
			künftig selbst lesen soll, ist ein eigener Entscheid: Er nähme der
			Sitzungsleitung eine Wahl ab, die heute bewusst bei ihr liegt.

			**Unter L6 «gesetz»** (Produktentscheid 05.11.2026, `docs/entscheide/0042`)
			rechnet die Karte das qualifizierte Mehr; der Satz «bekommt Einstimmigkeit»
			wäre dann falsch. Eine strengere Regel an `k-reglement-normal` wirkt weiter
			(`umstrittenBeiStrengererKlausel`); das sagt der zweite Absatz offen.
		-->
		<section class="kasten">
			<h2>Änderung des Reglements</h2>

			{#if data.aenderungsschranke.einstimmig}
				<p>
					Dieses Reglement verlangt für seine eigene Änderung <strong>Einstimmigkeit</strong>
					{#if data.aenderungsschranke.fundstelle}
						<span class="quelle">({data.aenderungsschranke.fundstelle})</span>
					{/if}. Die Angabe steht bei jedem Reglementstraktandum an der Frage im Entscheidbaum.
					{#if data.lesarten.einstellung.wahl.L6 === 'gesetz'}
						Wer sie dort wählt, bekommt nach Ihrer Lesart «Nach dem Gesetz» das qualifizierte Mehr
						nach Art. 712g Abs. 3 ZGB. Votum nennt dazu, wie der Beschluss nach der Klausel ausginge.
					{:else}
						Wer sie dort wählt, bekommt Einstimmigkeit; eine hinterlegte Abweichung mildert sie dann
						nicht.
					{/if}
				</p>
			{:else}
				<p>
					Nichts hinterlegt: Für eine Reglementsänderung gilt damit das gesetzliche Mehr. Verlangt
					Ihr Reglement für seine eigene Änderung Einstimmigkeit, tragen Sie das hier ein — sonst
					steht die Frage bei jedem Traktandum neu.
				</p>
			{/if}
			{#if data.lesarten.einstellung.wahl.L6 === 'gesetz'}
				<p>
					Die Lesart «Nach dem Gesetz» wirkt nur an dieser Frage. Steht unter «Hinterlegte
					Abweichungen» für «Reglement ändern, gewöhnliche Bestimmung» eine Regel, die in jeder Hinsicht
					strenger ist als das Gesetz, rechnet Votum dort nach ihr. Es vermerkt, dass das
					umstritten ist. Verlangt diese Regel die Zustimmung aller, ist es dieselbe Klausel, nach der
					dieser Kasten fragt. Soll Ihre Lesart für sie gelten, wählen
					Sie im Entscheidbaum «Das Reglement verlangt für seine eigene Änderung Einstimmigkeit», auch
					wenn eine gewöhnliche Bestimmung geändert wird.
				</p>
			{/if}

			<form method="POST" action="?/aenderungsschranke" class="felder">
				<label class="kasten-label">
					<input
						type="checkbox"
						name="einstimmig"
						value="true"
						{...angekreuzt(data.aenderungsschranke.einstimmig)}
					/>
					<span>Das Reglement verlangt für seine eigene Änderung Einstimmigkeit</span>
				</label>
				<label class="breit">
					Fundstelle im Reglement
					<input
						name="aenderungsschrankeFundstelle"
						placeholder="Art. 34 Abs. 2 Reglement"
						{...anfangswert(data.aenderungsschranke.fundstelle ?? '')}
					/>
				</label>
				<button type="submit">Schranke speichern</button>
				<p class="hilfe">
					Ohne Häkchen wird auch die Fundstelle weggeräumt. Wer den Beschluss anficht, greift
					zuerst das Quorum an: Deshalb gehört der Artikel dazu, sobald die Schranke gilt.
				</p>
			</form>
		</section>

		<!--
			**Einlage in den Erneuerungsfonds** (Migration 193, `domain/fondsgrenze.ts`;
			Produktentscheid 15.11.2026, «Frage im Finder und Eintrag»). Gezeigt, nicht
			gerechnet: Der Entscheidbaum nennt die Bestimmung an der Frage zur Höhe der
			Einlage und hebt die passenden Antworten hervor; welche zutrifft, entscheidet
			die Leitung am Antrag. Direkt nach der Änderung des Reglements, weil über der
			Grenze deren Mehr gilt.
		-->
		<!-- Ohne `offen`: «Nichts» ist hier eine gültige Antwort, kein fehlender Eintrag (Codeprüfung N4). -->
		<section class="kasten">
			<h2>Einlage in den Erneuerungsfonds</h2>

			{#if data.fondsgrenze.hinterlegt}
				<p>
					Hinterlegt ist «{data.fondsgrenze.hinterlegt.wortlaut}»
					<span class="quelle">({data.fondsgrenze.hinterlegt.fundstelle})</span>.
					{data.fondsgrenze.arten.find((a) => a.art === data.fondsgrenze.hinterlegt?.art)?.folge}
					Der Entscheidbaum am Traktandum zeigt die Bestimmung bei der Frage zur Höhe der Einlage.
					Auch die Karte dort und vor der Abstimmung nennt sie.
					<!-- «am Traktandum»: Der Quorum-Finder ohne Traktandum zeigt sie nicht (Featureprüfung B2; Pendenz). -->
				</p>
			{:else}
				<p>
					Nicht hinterlegt. Nennt Ihr Reglement die Höhe der Einlage, eine Obergrenze, eine
					Mindesteinlage oder einen Stand, ab dem die Einzahlungen ruhen, tragen Sie die Bestimmung
					hier ein. Der Entscheidbaum am Traktandum zeigt sie dann bei der Frage zur Höhe der Einlage.
					Ohne Eintrag fragt er gleich, nur ohne diesen Hinweis.
				</p>
			{/if}

			<!-- `absenden()` wie bei der Frist: Bei einer Absage bleibt das Getippte stehen (Codeprüfung N3). -->
			<form method="POST" action="?/fondsgrenze" class="felder" use:enhance={absenden()}>
				<fieldset class="breit">
					<legend>Was sagt Ihr Reglement zur Höhe der Einlage?</legend>
					<div class="wahlen">
						<label class="wahl">
							<input type="radio" name="fondsgrenzeArt" value=""
								{...angekreuzt(!data.fondsgrenze.hinterlegt)} />
							<span><strong>Nichts, oder die Versammlung setzt die Höhe frei fest</strong></span>
						</label>
						{#each data.fondsgrenze.arten as a (a.art)}
							<label class="wahl">
								<input type="radio" name="fondsgrenzeArt" value={a.art}
									{...angekreuzt(data.fondsgrenze.hinterlegt?.art === a.art)} />
								<span>
									<strong>{a.text}</strong>
									<span class="hilfe">{a.folge}</span>
								</span>
							</label>
						{/each}
					</div>
				</fieldset>
				<label class="breit">
					Wortlaut der Bestimmung
					<input
						name="fondsgrenzeWortlaut"
						placeholder="Die Einlage darf 0.25 Prozent des Versicherungswerts nicht übersteigen."
						{...anfangswert(data.fondsgrenze.hinterlegt?.wortlaut ?? '')}
					/>
				</label>
				<label class="breit">
					Fundstelle im Reglement
					<input
						name="fondsgrenzeFundstelle"
						placeholder="Reglement Ziff. 9.2"
						{...anfangswert(data.fondsgrenze.hinterlegt?.fundstelle ?? '')}
					/>
				</label>
				<button type="submit">Bestimmung speichern</button>
				<p class="hilfe">
					Schreiben Sie die Bestimmung so ab, wie sie im Reglement steht. Steht dort «darf nicht
					übersteigen», ist die Grenze fest; steht «in der Regel höchstens», gilt sie nur in der
					Regel. Lässt sich der Wortlaut keiner der beiden zuordnen, etwa bei «soll», wählen Sie
					«in der Regel». Hinterlegen lässt sich eine Bestimmung. Hat Ihr Reglement mehrere, etwa
					eine Höhe und einen Stand, prüfen Sie die anderen bei der Frage selbst. Mit der ersten
					Wahl werden Wortlaut und Fundstelle weggeräumt.
				</p>
			</form>
		</section>

		<!-- ── Nicht angekündigte Geschäfte (Migrationen 126, 127) ─────────────────── -->
		<!--
			**Keine Wahl nach bester Praxis, sondern ein Abbild des Reglements**
			(Fachprüfung 29.09.2026, Runde 2, 6a). Steht die Klausel im Reglement,
			gehört das Häkchen gesetzt; sonst verweigerte Votum, was das Reglement
			erlaubt. Den Rat zur Zurückhaltung (Rz. 38 ad Art. 712n) gibt der
			Aufnahmedialog, dort, wo entschieden wird.

			**Gilt ab der nächsten Freigabe.** Die Angabe wird mit der Einladung in
			die Momentaufnahme eingefroren (Migration 127), wie die Zählweise. Eine
			schon freigegebene Versammlung behält, was bei ihrer Freigabe stand.
		-->
		<section class="kasten">
			<h2>Nicht angekündigte Geschäfte</h2>

			{#if data.ausnahmen.reglementGestattet}
				<p>
					Dieses Reglement gestattet Beschlüsse über Gegenstände, die nicht auf der
					Traktandenliste angekündigt sind
					{#if data.ausnahmen.reglementFundstelle}
						<span class="quelle">({data.ausnahmen.reglementFundstelle})</span>
					{/if}. Im Saal lässt sich ein neues Geschäft dann zur Abstimmung aufnehmen, an
					Versammlungen, deren Einladung nach dem Speichern freigegeben wird. Eine schon
					freigegebene Einladung behält den früheren Stand. Am gemeinsamen Abend mehrerer
					Häuser gilt das nicht: Dort wird über die Liste des Abends abgestimmt.
				</p>
			{:else}
				<!-- Nach der gewählten Variante (Laienprüfung Block 3, U13; Codeprüfung N-2). -->
				<p>
					Nichts hinterlegt: Votum lässt über ein Geschäft, das nicht auf der Traktandenliste
					stand,
					{data.ausnahmen.universalvariante === 'keine'
						? 'keinen Beschluss zu'
						: 'nur als Universalversammlung einen Beschluss zu'} (ZGB Art. 67 Abs. 3 i.V.m.
					Art. 712m Abs. 2). Gestattet Ihr Reglement es ausdrücklich, kreuzen Sie unten an.
				</p>
			{/if}

			<form method="POST" action="?/nichtangekuendigtes" class="felder">
				<label class="kasten-label">
					<input
						type="checkbox"
						name="reglementGestattet"
						value="true"
						{...angekreuzt(data.ausnahmen.reglementGestattet)}
					/>
					<span>
						Das Reglement gestattet Beschlüsse über Gegenstände, die nicht auf der
						Traktandenliste angekündigt sind
					</span>
				</label>
				<label class="breit">
					Fundstelle im Reglement
					<input
						name="reglementFundstelle"
						placeholder="Art. 21 Abs. 3"
						{...anfangswert(data.ausnahmen.reglementFundstelle ?? '')}
					/>
				</label>
				<!--
					**Die Hilfe über dem Knopf, nicht darunter** (Laienprüfung
					29.09.2026, L3): Wer ankreuzt, soll sie vor dem Speichern lesen.
				-->
				<p class="hilfe">
					Ankreuzen, wenn das Reglement Beschlüsse über nicht angekündigte Gegenstände
					ausdrücklich und ohne weitere Bedingung gestattet. Nicht ankreuzen, wenn die
					Bestimmung nur Anträge zu angekündigten Traktanden zulässt oder nur bestimmte
					Anträge, etwa den auf eine ausserordentliche Versammlung. Ebenso nicht, wenn sie es
					nur unter einer Bedingung gestattet, etwa mit einer besonderen Mehrheit. Eine
					Bedingung kann Votum im Saal nicht prüfen;
					ohne Häkchen wird die Sache zur Kenntnis genommen und traktandiert. Massgebend ist
					das Reglement, nicht die Hausordnung.
				</p>
				<p class="hilfe">
					Die Angabe gilt für Versammlungen, deren Einladung danach freigegeben wird. Knüpft das
					Reglement es an die Anwesenheit aller Eigentümer, regelt es die Universalversammlung:
					Dann gehört die Angabe nicht hierher, sondern darunter.
				</p>
				<button type="submit">Angabe speichern</button>
			</form>

			<!--
				**Die Universalversammlung** (Migrationen 126, 128; Runde 2, Stellen 6b
				und 6c, mit den Befunden). Ein eigenes Formular: `speichereAusnahmen`
				nimmt Teiländerungen und ergänzt den Rest aus dem Vorzustand, also setzt
				keines der beiden Formulare das andere zurück.

				«Universalversammlung» wird vor der Auswahl erklärt (L17), «Organ» und
				gemeinsames Eigentum mit Beispiel (L18). Die zweite Variante neutral,
				mit der Gegenstelle desselben Kommentars (Fachprüfung Runde 2 zu 6b;
				L19). Seit dem Nachtrag zu Frage 54 (Produktentscheid 29.09.2026) sagt
				sie, dass die Gemeinschaft die Vertretung regelt, statt sie als
				«vertretbar, entschieden nicht» einzustufen. Die gesetzliche
				Vertretung zählt wie eine Vollmacht
				(Entscheid 29.09.2026), deshalb steht sie bei «persönlich» nicht als
				«die Eigentümerin selbst».
			-->
			<h3 id="universalversammlung">Universalversammlung</h3>
			<p>
				Eine Universalversammlung liegt vor, wenn alle Eigentümer da sind und niemand
				widerspricht. Dann darf die Versammlung auch über ein Geschäft beschliessen, das nicht
				auf der Traktandenliste stand (SVIT-Kommentar Rz. 28 und 39 ad Art. 712n). Wählen Sie,
				wer dafür als da gilt.
			</p>
			<form method="POST" action="?/universalversammlung" class="felder">
				<fieldset class="breit">
					<legend>Wer als da gilt</legend>
					<div class="wahlen">
						<label class="wahl">
							<input type="radio" name="universalvariante" value="persoenlich"
								{...angekreuzt(data.ausnahmen.universalvariante === 'persoenlich')} />
							<span>
								<strong>Alle Eigentümer persönlich anwesend (Vorgabe)</strong>
								<span class="hilfe">
									Bei einer AG, GmbH oder anderen Eigentümergesellschaft zählt ihr Organ als die
									Eigentümerin selbst, also wer laut Handelsregister Einzelunterschrift für sie hat. Eine
									Angestellte mit Vollmacht zählt nicht. Gehört eine Wohnung mehreren, müssen alle ihre
									Eigentümer persönlich da sein (SVIT-Kommentar Rz. 3 und 5 ad Art. 712o; Rz. 28 und 39
									ad Art. 712n). Das gilt gleich in welcher Form, etwa bei einem Ehepaar, einer
									Erbengemeinschaft oder einer einfachen Gesellschaft. Ebenso, wer an einer Wohnung eine
									Nutzniessung oder ein Wohnrecht hat, und bei einer Pfändung, einer Pfandverwertung oder
									im Konkurs die zuständige Behörde. Auch sie sind einzuladen. Eine Vollmacht zählt
									nicht, auch keine gesetzliche Vertretung wie ein Beistand. Diese Lesart ist die
									sicherste.
								</span>
							</span>
						</label>
						<label class="wahl">
							<input type="radio" name="universalvariante" value="vertreten"
								{...angekreuzt(data.ausnahmen.universalvariante === 'vertreten')} />
							<span>
								<strong>Alle Eigentümer anwesend oder mit Vollmacht vertreten</strong>
								<span class="hilfe">
									Das Gesetz lässt die Vertretung an der Versammlung zu; mit einer entsprechenden
									Vollmacht hat der Vertreter die Rechte der Eigentümerin (ZGB Art. 712p;
									SVIT-Kommentar Rz. 26 ad Art. 712m). Für die Universalversammlung regelt das Gesetz es
									nicht ausdrücklich, und der Kommentar spricht dort nur von anwesenden Eigentümern
									(Rz. 28 ad Art. 712n).
									<!-- Produktentscheid 07.10.2026 zu Fassung 2
									     (`quellen/pruefung/zu-pruefen-2026-10-07-votum-vertretene-saal.md`):
									     das Aktienrecht als Vergleich, mit dem Gegengewicht aus Rz. 5a ad
									     Art. 712m (Fachprüfung F3); «nicht entschieden» statt «eine Folgerung»,
									     das sich als «gilt also auch bei uns» las (Laienprüfung). -->
									Im Aktienrecht, das der Kommentar dort zum Vergleich nennt, zählen Vertretene mit
									(Art. 701 Abs. 1 OR; Onlinekommentar zu Art. 701 OR, N 2 und 12). Für das
									Stockwerkeigentum ist das nicht entschieden; der Kommentar warnt davor, Grundsätze
									des Aktienrechts unbesehen zu übernehmen (Rz. 5a ad Art. 712m). Deshalb wird es
									hier für die Gemeinschaft eingestellt. Wählen
									Sie diese Variante nur, wenn Ihr Reglement Vertretene nicht ausschliesst. Eine
									Vertretene zählt nur mit, wenn ihre Vollmacht auch Geschäfte deckt, die nicht
									angekündigt waren. Gehört eine Wohnung mehreren, gilt das für jede ihrer
									Eigentümerinnen einzeln: Jede ist da oder mit einer solchen Vollmacht vertreten.
									Dasselbe gilt für Nutzniesser und Wohnberechtigte und bei einer Pfändung, einer
									Pfandverwertung oder im Konkurs für die zuständige Behörde.
								</span>
							</span>
						</label>
						<label class="wahl">
							<input type="radio" name="universalvariante" value="keine"
								{...angekreuzt(data.ausnahmen.universalvariante === 'keine')} />
							<span>
								<strong>Keine Universalversammlung</strong>
								<span class="hilfe">
									Wählen, wenn das Reglement sie ausschliesst oder die Gemeinschaft nicht so
									beschliessen will.
								</span>
							</span>
						</label>
					</div>
				</fieldset>
				<label class="breit">
					Fundstelle, falls das Reglement die Universalversammlung selbst regelt
					<input
						name="universalFundstelle"
						placeholder="Art. 22"
						{...anfangswert(data.ausnahmen.universalFundstelle ?? '')}
					/>
				</label>
				<p class="hilfe">
					Regelt das Reglement sie selbst, geht es vor: Wählen Sie die Variante, die ihm
					entspricht. Passt keine genau, wählen Sie die strengere, im Zweifel «Keine
					Universalversammlung». Verlangt das Reglement mehr als die gewählte Variante, sagen Sie
					es der Sitzungsleitung; sie wendet es im Saal an.
				</p>
				<!-- Die Bedingung zuerst, dann das Häkchen (Laienprüfung Runde 2, L20). -->
				<p class="hilfe">Nur bei «anwesend oder mit Vollmacht vertreten»:</p>
				<label class="kasten-label">
					<input
						type="checkbox"
						name="leitungsvollmachtenZaehlen"
						value="true"
						{...angekreuzt(data.ausnahmen.leitungsvollmachtenZaehlen)}
					/>
					<span>
						Vollmachten, die die Sitzungsleitung oder die Verwaltung hält, zählen bei einer
						Universalversammlung mit.
					</span>
				</label>
				<p class="hilfe">
					Ohne Häkchen gelten so Vertretene als nicht anwesend. Die Sitzungsleitung soll neutral
					bleiben und ein nicht angekündigtes Geschäft nicht durch das Schweigen ihrer
					Vertretenen beschliessen lassen (SVIT-Kommentar Rz. 91 ad Art. 712n; zur Verwaltung
					Rz. 31 ad Art. 712m). Die Sitzungsleitung kreuzt auf ihrer Seite an, wer im Saal so
					vertritt.
				</p>
				<p class="hilfe">
					Die Angaben gelten für Versammlungen, deren Einladung danach freigegeben wird.
				</p>
				<button type="submit">Angaben speichern</button>
			</form>
		</section>

		<!--
			**Lesarten der Gemeinschaft** (Migration 169, Entscheid 0018). Getrennt
			von dem, was das Reglement sagt: Eine Lesart ist keine Angabe aus dem
			Reglement, sondern die Wahl zwischen zwei vertretenen Auslegungen des
			Gesetzes. Das Formular ist dasselbe wie auf der Seite «Lesarten», auf der
			auch die Sitzungsleitung umstellt, wenn die Gemeinschaft es erlaubt.
		-->
		<section class="kasten">
			<h2>Lesarten, die das Gesetz offenlässt</h2>
			<p>
				An einigen Stellen ist umstritten, wie das Gesetz zu lesen ist, und das Ergebnis einer
				Abstimmung kann davon abhängen. Votum rechnet nach der Lesart, die auf der Seite «Lesarten» eingestellt ist, und zusätzlich
				nach der anderen und nennt das Ergebnis, wo die andere etwas ändern kann. Legt Ihr Reglement
				das Mehr eines Traktandums fest, rechnet Votum nach ihm; die Karte des Traktandums nennt
				dann, was das Gesetz verlangen würde.
			</p>
			<Lesartenwahl
				lesarten={data.lesarten.katalog}
				wahl={data.lesarten.einstellung.wahl}
				geaendert={data.lesarten.einstellung.geaendert}
				darfUmstellen={data.darfStammdaten}
			/>
			<p class="hilfe">
				Die Einstellung gilt für Versammlungen, deren Einladung danach freigegeben wird. Ändert sie
				das Mehr eines Traktandums, das schon eines hat, erscheint es oben als Traktandum mit älterem
				Erfordernis, und Sie ziehen es dort nach. Bei der Wertquote im Ausstand, der Zählung an der
				Einsprache und neuen Geschäften an der zweiten Versammlung müssen Sie nichts nachziehen.
				Für eine schon freigegebene Einladung gilt die bisherige Einstellung. Auch die
				<a href="#universalversammlung">Universalversammlung</a> ist eine Lesart; sie steht unter
				«Nicht angekündigte Geschäfte».
			</p>

			<h3>Wer die Lesarten umstellen darf</h3>
			{#if !data.darfStammdaten}
				<p>{data.lesarten.rechte[data.lesarten.einstellung.recht]}.</p>
			{:else}
			<form method="POST" action="?/lesartenrecht" class="felder" use:enhance={absenden()}>
				<fieldset class="breit">
					<legend>Wer darf die Lesarten umstellen?</legend>
					<div class="wahlen">
						{#each Object.entries(data.lesarten.rechte) as [wert, bezeichnung] (wert)}
							<label class="wahl">
								<input
									type="radio"
									name="recht"
									value={wert}
									{...angekreuzt(data.lesarten.einstellung.recht === wert)}
								/>
								<span>
									<strong>{bezeichnung}{wert === data.lesarten.vorgabe ? ' (Vorgabe)' : ''}</strong>
								</span>
							</label>
						{/each}
					</div>
				</fieldset>
				<p class="hilfe">
					Die Sitzungsleitung stellt dann nur die Lesarten um, auf der Seite
					<a href="/gemeinschaften/{data.gemeinschaft.id}/lesarten">Lesarten</a>. Nur die Verwaltung
					ändert diese Einstellung und die Angabe zur Universalversammlung.
				</p>
				<p class="hilfe">
					{#if data.lesarten.einstellung.rechtGeaendert}
						Zuletzt geändert von {data.lesarten.einstellung.rechtGeaendert.durch} am
						{zeitpunktLang(data.lesarten.einstellung.rechtGeaendert.am)}.
					{:else}
						Vorgabe, nie geändert.
					{/if}
				</p>
				<button type="submit">Speichern</button>
			</form>
			{/if}
		</section>

		<!-- ── Einberufungsfrist (Praxisdurchlauf 28.08.2026) ──────────────────────── -->
		<!--
			**Sie ist keine Abweichung vom Gesetz**, sondern eine Angabe aus dem
			Reglement, die sonst nirgends steht: Das ZGB nennt für die Einladung
			überhaupt keine Frist. Und sie ist die einzige auf dieser Seite, an der ein
			Termin hängt.

			**Der Kasten stand bis zum 03.09.2026 ueber der Tabelle** und begruendete
			das hier auch so. Mit dem Stapel steht er im Abschnitt «Handeln», also
			unter dem Bestand — wie jedes andere Formular dieser Seite. Der Grund
			bleibt richtig, die Ortsangabe war es nicht mehr.
		-->
		<section class="kasten" class:offen={data.einberufungsfrist.tage === null}>
			<h2>Einberufungsfrist</h2>

			{#if data.einberufungsfrist.tage === null}
				<p>
					Nicht hinterlegt. Solange die Zahl fehlt, rechnet die Anwendung den letzten Tag nicht
					aus, an dem die Einladung bei allen sein soll, und erinnert nicht daran. Sie kennt die
					Frist Ihres Reglements nicht, und das Gesetz nennt keine.
					<!-- Produktentscheid 06.10.2026, «Hinweis, zehn Tage zu erfassen»: ein Rat,
					     kein Vorgabewert. Zehn Tage sind die übliche Untergrenze; wo die Post
					     länger braucht oder Eigentümer nur in den Ferien da sind, reichen sie
					     nicht (Wermelinger Rz. 26, 27 ad Art. 712n). Hier, wo man einträgt,
					     stehen die Einzelheiten (Produktentscheid «Kürzen und umstellen»). Die
					     Fundstelle ist Pflicht (`pruefeEinberufungsfrist`), deshalb sagt der
					     Satz, was dann dort steht. -->
					Nennt Ihr Reglement keine Frist, erfassen Sie mindestens zehn Tage. Wohnen Eigentümer
					im Ausland, rechnen Sie die längere Postlaufzeit dazu. In einer Feriengemeinschaft
					rechnen Sie die Zeit dazu, bis die Einladung Eigentümer erreicht, die nicht vor Ort
					sind. Als Fundstelle tragen Sie dann «Reglement nennt keine Frist» ein. Dann rechnet
					die Anwendung den letzten Tag aus und erinnert daran.
				</p>
			{:else}
				<p>
					<!-- «bei allen», nicht «hinausgegangen» (Produktentscheid 06.10.2026, «Jetzt
					     richtigstellen»), und zwar als vorsichtige Regel der Anwendung, nicht als
					     Rechtslage (Produktentscheid «Als Regel der Anwendung», Fachprüfung
					     Runde 3; Rz. 23, 24, 30 ad Art. 712n). Hier, wo erfasst wird, einmal
					     ausführlich. Erfasst sein kann auch der Rat von zehn Tagen. -->
					Erfasst sind <strong>{data.einberufungsfrist.tage} Tage</strong>
					{#if data.einberufungsfrist.fundstelle}
						<span class="quelle">({data.einberufungsfrist.fundstelle})</span>
					{/if}: So lange vor der Versammlung soll die Einladung bei allen sein, bei einer
					Versammlung am {data.einberufungsfrist.beispielVersammlung} also bis zum
					<strong>{data.einberufungsfrist.beispielVersand}</strong>. Die Anwendung rechnet damit
					vorsichtig bis zum Empfang. Rechnet Ihr Reglement die Frist ab Versand, genügt nach ihm
					eine Einladung, die bis zu diesem Tag verschickt ist; die Anwendung erinnert trotzdem
					nach ihrer Regel. Angefochten werden kann ein Beschluss, wenn die Einladung nach der
					Regel des Reglements zu spät kommt. Die Post braucht Zeit, ins Ausland länger; planen
					Sie genug Vorlauf ein. Die Vorbereitung zeigt den Tag, bis zu dem die Einladung bei allen
					sein soll. Einen Werktag vorher geht eine Erinnerung an die Bewirtschaftung, wenn bis dahin keine
					Einladung erzeugt und nicht vermerkt wurde, dass sie verschickt ist. Sie ist eine letzte Kontrolle, kein Anstoss zum Versand: Für die Post ist es dann meist schon zu
					spät. Allgemeine Feiertage (Neujahr, Karfreitag, Ostermontag, Auffahrt, Pfingstmontag, 1. August,
					Weihnachten, Stephanstag) zählen dabei wie ein Wochenende, kantonale nicht. Nach jeder Milderung des Mehrs
					kommt sie einmal erneut, ausser die berichtigte Einladung ist schon als verschickt
					vermerkt oder das Mehr zurückgestellt. Nach einer Rücknahme der Freigabe kommt sie
					ebenfalls erneut.
				</p>
			{/if}

			<form method="POST" action="?/einberufungsfrist" class="felder" use:enhance={absenden()}>
				<label class="schmal">
					Tage vor der Versammlung
					<input
						type="number"
						name="einberufungsfristTage"
						min="1"
						max={data.einberufungsfrist.hoechstens}
						step="1"
						inputmode="numeric"
						placeholder="30"
						{...anfangswert(data.einberufungsfrist.tage ?? '')}
					/>
				</label>
				<label class="breit">
					Fundstelle im Reglement
					<input
						name="einberufungsfristFundstelle"
						placeholder="Reglement Ziff. 12.3"
						{...anfangswert(data.einberufungsfrist.fundstelle ?? '')}
					/>
				</label>
				<button type="submit">Frist speichern</button>
				<p class="hilfe">
					Leeres Zahlenfeld nimmt die Frist wieder heraus. Die Fundstelle gehört dazu, sobald
					eine Zahl dasteht: Wer den Beschluss anficht, greift zuerst die Einberufung an.
				</p>
			</form>
		</section>

		<!--
			**Milderes Mehr nach Ablauf der Einberufungsfrist** (Produktentscheid
			07.10.2026, Migration 148): mehrere zulässige Varianten, also eine
			Einstellung an der Gemeinschaft mit der besten Praxis als Vorgabe. Die
			Vorgabe sagt ab, weil nach dem letzten Tag eine berichtigte Einladung
			nicht mehr rechtzeitig ankommen kann und die Frist am Empfang hängt
			(SVIT-Kommentar Rz. 30 ad Art. 712n). Das Recht verlangt die Absage nicht
			(Rz. 66 und 68 ad Art. 712n); deshalb lässt sie sich umstellen. Direkt
			unter der Frist, weil sie ohne erfasste Frist nichts bewirkt.
		-->
		<section class="kasten">
			<h2>Milderes Mehr nach Ablauf der Einberufungsfrist</h2>
			<!--
				**Nach Laien- und Fachprüfung Runde 1, 07.10.2026** (Laien 5 bis 8, Fach
				B2, B4, B5): Die Einstellung betrifft nur das Setzen nach dem letzten Tag,
				ein vorher gesetztes milderes Mehr bleibt; «Zulassen» nennt, wo der
				Hinweis steht, und dass das Risiko bleibt; der Grund bei «Nicht
				zulassen» gilt auch für ein Reglement, das ab Versand rechnet; ohne
				erfasste Frist die Folge statt «wirkt nicht», mit Frist kein Satz dazu.
				Bis dahin «braucht es», «Massgebend ist, wann sie bei allen ist, nicht
				wann sie verschickt wurde» und «Ohne erfasste Frist wirkt die Einstellung
				nicht» in beiden Lagen.
			-->
			<p>
				Wird das Mehr eines Traktandums nach der Freigabe milder gestellt, sollte eine
				berichtigte Einladung an alle gehen. Kommt sie nicht rechtzeitig bei allen an, kann ein Beschluss mit dem milderen Mehr angefochten werden.
				<!-- Folge seit dem Produktentscheid 07.10.2026 «1a» (Laienprüfung Runde 2, N1). -->
				Hier steht, ob die Anwendung ein milderes Mehr
				nach dem letzten Tag der erfassten Einberufungsfrist noch setzt. Ein vorher gesetztes
				milderes Mehr bleibt in beiden Fällen stehen.
				{#if data.einberufungsfrist.tage === null}
					Für diese Gemeinschaft ist keine Frist erfasst. Die Anwendung kennt dann keinen letzten
					Tag, und ein milderes Mehr lässt sich bis zum Eröffnen der Versammlung jederzeit setzen.
				{/if}
			</p>
			<form method="POST" action="?/milderungNachFrist" class="felder" use:enhance={absenden()}>
				<fieldset class="breit">
					<legend>Mehr nach Ablauf der Einberufungsfrist milder stellen</legend>
					<div class="wahlen">
						<label class="wahl">
							<input type="radio" name="milderungNachFrist" value="nicht"
								{...angekreuzt(!data.milderungNachFrist)} />
							<span>
								<strong>Nicht zulassen (Vorgabe)</strong>
								<span class="hilfe">
									Die Anwendung rechnet bis zum Empfang: Nach dem letzten Tag kommt eine
									berichtigte Einladung nach der erfassten Einberufungsfrist nicht mehr
									rechtzeitig an. Rechnet Ihr Reglement ab Versand, ist es dann ebenso zu spät,
									weil derselbe Tag der letzte Versandtag ist. Die Anwendung sagt deshalb ab; es
									bleibt beim Mehr der Einladung oder einem strengeren.
								</span>
							</span>
						</label>
						<label class="wahl">
							<input type="radio" name="milderungNachFrist" value="zulassen"
								{...angekreuzt(data.milderungNachFrist)} />
							<span>
								<strong>Zulassen, mit Hinweis</strong>
								<span class="hilfe">
									Die Anwendung setzt das mildere Mehr und weist auf der Seite Vorbereitung und
									im Saal darauf hin, dass ein so gefasster Beschluss angefochten werden kann.
									Das Umstellen verringert dieses Risiko nicht; die Anwendung sagt nur nicht ab.
									<!-- «Die Verantwortung trägt dann, wer einlädt und die Versammlung leitet»
									     entfiel in Runde 2 (Fachprüfung R2-2): Der Satz daneben sagt es. -->
									Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.
								</span>
							</span>
						</label>
					</div>
				</fieldset>
				<button type="submit">Einstellung speichern</button>
			</form>
		</section>

		<!-- ── Frist zur zweiten Versammlung (Produktentscheid 24.09.2026) ─────────── -->
		<!--
			**Der Unterschied zur Einberufungsfrist darüber**, und er bestimmt die
			ganze Gestaltung: Dort nennt das Gesetz keine Zahl, hier nennt es eine.
			Ohne Eintrag ist also nichts unbekannt — es gilt schlicht ZGB Art. 712p
			Abs. 2. Der Kasten steht deshalb nicht offen, wenn das Feld leer ist,
			und die Leermeldung sagt, was gilt, statt eine Lücke zu behaupten.

			**Nach oben offen, nach unten gesperrt.** Ein Reglement darf die Frist
			verlängern, nicht verkürzen (Rz. 40 ad Art. 712p). Der Hilfetext sagt
			das vor dem Absenden, damit die Absage niemanden überrascht.
		-->
		<section class="kasten">
			<h2>Frist zur zweiten Versammlung</h2>

			{#if data.zweitversammlungsfrist.tage === null}
				<p>
					Es gilt die gesetzliche Frist von
					<strong>{data.zweitversammlungsfrist.gesetzlich} Tagen</strong>: Die zweite
					Versammlung darf frühestens am elften Tag nach der ersten stattfinden. Eintragen
					müssen Sie hier nur, wenn Ihr Reglement <em>mehr</em> verlangt.
				</p>
			{:else if data.zweitversammlungsfrist.tage === data.zweitversammlungsfrist.gesetzlich}
				<!--
					**Der Gleichstand ist zugelassen und braucht einen eigenen Satz.**
					Reglemente wiederholen die gesetzliche Frist oft, und die Fundstelle
					dazu belegt, dass jemand nachgesehen hat. Ohne diesen Zweig stünde
					hier «verlangt 10 Tage statt der gesetzlichen 10» und dazu die Zusage
					einer Wirkung, die es nicht gibt (Code-Review 24.09.2026, Befund 6).
				-->
				<p>
					Ihr Reglement wiederholt die gesetzliche Frist von
					<strong>{data.zweitversammlungsfrist.gesetzlich} Tagen</strong>
					{#if data.zweitversammlungsfrist.fundstelle}
						<span class="quelle">({data.zweitversammlungsfrist.fundstelle})</span>
					{/if}
					— gerechnet wird dasselbe wie ohne Eintrag. Die Fundstelle bleibt trotzdem etwas
					wert: Sie belegt, dass jemand nachgesehen hat.
				</p>
			{:else}
				<p>
					Ihr Reglement verlangt
					<strong>{data.zweitversammlungsfrist.tage} Tage</strong>
					{#if data.zweitversammlungsfrist.fundstelle}
						<span class="quelle">({data.zweitversammlungsfrist.fundstelle})</span>
					{/if}
					statt der gesetzlichen {data.zweitversammlungsfrist.gesetzlich}. Damit rechnen der
					Terminvorschlag beim Vertagen, die Fristprüfung im Formular und der Vermerk in
					Einladung und Protokoll.
				</p>
			{/if}

			<form
				method="POST"
				action="?/zweitversammlungsfrist"
				class="felder"
				use:enhance={absenden()}
			>
				<label class="schmal">
					Tage zwischen erster und zweiter
					<input
						type="number"
						name="zweitversammlungsfristTage"
						min={data.zweitversammlungsfrist.gesetzlich}
						max={data.zweitversammlungsfrist.hoechstens}
						step="1"
						inputmode="numeric"
						placeholder={String(data.zweitversammlungsfrist.gesetzlich)}
						{...anfangswert(data.zweitversammlungsfrist.tage ?? '')}
					/>
				</label>
				<label class="breit">
					Fundstelle im Reglement
					<input
						name="zweitversammlungsfristFundstelle"
						placeholder="Reglement Ziff. 14.2"
						{...anfangswert(data.zweitversammlungsfrist.fundstelle ?? '')}
					/>
				</label>
				<button type="submit">Frist speichern</button>
				<p class="hilfe">
					Leeres Zahlenfeld nimmt die Frist wieder heraus; dann gilt das Gesetz. Weniger als
					{data.zweitversammlungsfrist.gesetzlich} Tage wird abgewiesen: Ein Reglement darf
					diese Frist verlängern, nicht verkürzen.
				</p>
			</form>
		</section>

		<!--
			**Die Neuabstimmung nach Eintritt der Beschlussfähigkeit**
			(Produktentscheid 03.10.2026, Migration 139): Die Versammlung ist
			nicht beschlussfähig, die Sitzungsleitung hält trotzdem einen
			Beschluss fest; später am Abend wird die Versammlung beschlussfähig.
			Ob es für den zweiten Durchgang ein Rückkommen braucht, entscheidet
			die Gemeinschaft hier. Die Vorgabe «direkt» ersetzt die Hausbildung
			«Rückkommen mit eigener Mehrheit», die der Bestand nicht belegt.
		-->
		<section class="kasten">
			<h2>Neuabstimmung nach Eintritt der Beschlussfähigkeit</h2>
			<p>
				Wird die Versammlung erst nachträglich beschlussfähig, nachdem die Sitzungsleitung
				einen Beschluss festgehalten hat, lässt Votum über denselben Gegenstand neu abstimmen.
				Hier steht, ob es dafür einen Rückkommensantrag braucht. Beim direkten Weg nennt das
				Protokoll die beiden Durchgänge mit Uhrzeit und Präsenz.
			</p>
			<form method="POST" action="?/neuabstimmung" class="felder" use:enhance={absenden()}>
				<fieldset class="breit">
					<legend>Der zweite Durchgang</legend>
					<div class="wahlen">
						<label class="wahl">
							<input type="radio" name="neuabstimmung" value="direkt"
								{...angekreuzt(data.neuabstimmung === 'direkt')} />
							<span>
								<strong>Direkt neu abstimmen (Vorgabe)</strong>
								<span class="hilfe">
									Sobald die Versammlung beschlussfähig ist, lässt sich der zweite Durchgang
									direkt eröffnen. Wird der Antrag angenommen, tritt sein Ergebnis an die
									Stelle des früheren; wird er abgelehnt oder kommt kein Beschluss zustande,
									bleibt es beim früheren Ergebnis. Was der frühere Beschluss bereits bewirkt
									hat, lässt sich nicht rückgängig machen. Ob neu abgestimmt wird, entscheidet
									die Sitzungsleitung.
								</span>
							</span>
						</label>
						<label class="wahl">
							<input type="radio" name="neuabstimmung" value="rueckkommen"
								{...angekreuzt(data.neuabstimmung === 'rueckkommen')} />
							<span>
								<strong>Über das Rückkommen (wie bisher)</strong>
								<span class="hilfe">
									Der zweite Durchgang braucht einen angenommenen Rückkommensantrag: Die
									Versammlung stimmt zuerst darüber ab. Mit dem neuen Beschluss zur Sache
									wird der frühere Beschluss aufgehoben, auch mit einer Ablehnung der Sache;
									kommt gar kein Beschluss zustande, bleibt er in Kraft. Was der frühere
									Beschluss bereits bewirkt hat, lässt sich nicht rückgängig machen. Dieser
									Weg ist eine Regel von Votum, keine des Gesetzes; er ist eher strenger als
									nötig.
								</span>
							</span>
						</label>
					</div>
				</fieldset>
				<button type="submit">Einstellung speichern</button>
			</form>
		</section>

		<!--
			**Die Weisungsregel** (Auftraggeber, 25.08.2026): «In meinem Reglement steht: Ist ein
			dominierendes Grundstück in Stockwerkeigentum aufgeteilt, so haben die
			beteiligten Stockwerkeigentümer nur eine Stimme, die sie durch einen durch sie
			bezeichneten Vertreter auszuüben haben. […] Also einfaches Mehr. Es könnte
			auch Qual-Mehr geben. Das muss abgebildet werden können.»

			Eine Frage, eine Antwort: **Wie kommt dieses Haus zu der einen Stimme, die es
			in einer Miteigentümergemeinschaft hat?** Die Regel wird zum Erfordernis des
			Weisungstraktandums — das Haus stimmt danach ab, und sein Beschluss ist die
			Weisung. Nachgerechnet wird nichts.
		-->
		<h2>Die eine Stimme in der übergeordneten Gemeinschaft</h2>

		<!--
			**Überschrift und Einleitung neu** (Auftraggeber, 27.08.2026, Punkt 1 der sechs zur
			Reglementsseite): «Weisung an den Vertreter — ich bin mir da nicht mehr ganz
			sicher, was gemeint ist.» Wenn der Auftraggeber selbst nicht mehr weiss,
			wovon ein Feld handelt, ist die Beschriftung der Befund.

			Der alte Titel nannte das **Mittel** (eine Weisung an einen Vertreter), nicht
			die Frage. Die Frage ist: Wie kommt dieses Haus zu der einen Stimme, die es
			in der übergeordneten Gemeinschaft hat? Das Wort «Weisung» steht weiterhin im
			Text, weil es der Begriff der Anwendung ist — aber es erklärt sich jetzt,
			statt vorausgesetzt zu werden.
		-->
		{#if imVerbund || data.weisungsregel}
		<p class="hilfe">
			Gehört dieses Haus zu einer übergeordneten Gemeinschaft, hat es dort
			<strong>eine</strong> Stimme (ZGB Art. 712e Abs. 2). Wer sie abgibt, ist der
			Vertreter des Hauses; <strong>wie er sie abzugeben hat</strong>, beschliesst das Haus an
			seiner eigenen Versammlung — das ist die Weisung. Hier steht, welche Mehrheit
			das Haus dafür braucht.
		</p>

		{#if data.weisungsregel}
			<div class="kachel geltend">
				<p class="regel"><strong>{weisungssatz}</strong></p>
				<p class="hilfe">
					{data.weisungsregel.ohneBeschluss === 'nein'
						? 'Entscheidet das Haus nicht, gilt seine Stimme als Nein.'
						: 'Entscheidet das Haus nicht, enthält es sich.'}
					{data.weisungsregel.enthaltungZaehltMit
						? 'Enthaltungen bleiben in der Bezugsgrösse.'
						: 'Enthaltungen fallen aus der Bezugsgrösse.'}
				</p>
				<p class="hilfe">Reglement der Gemeinschaft, {data.weisungsregel.fundstelle}</p>
				{#if data.weisungsregel.hinweis}
					<p class="hilfe">{data.weisungsregel.hinweis}</p>
				{/if}
				<!-- Löschen steht leise unten und fragt nach. -->
				<form method="POST" action="?/weisungsregelAufheben" class="leiseform">
					<Rueckfrage
						frage="Die Weisungsregel dieses Hauses aufheben?"
						folge="Beim Weisungstraktandum wird dann kein Erfordernis mehr vorgeschlagen; die Sitzungsleitung wählt es wie bei jedem anderen Punkt. Bereits gesetzte Erfordernisse bleiben stehen."
						beschriftung="Regel aufheben"
						ton="warnung"
						gewicht="leise"
					/>
				</form>
			</div>
		{/if}

		<form method="POST" action="?/weisungsregel" class="formular" use:enhance={absenden()}>
			<fieldset class="breit">
				<legend>Kopfstimmen im Haus</legend>
				<div class="reihe">
					<label class="eng">
						Zähler
						<input
							type="number"
							name="kopfZaehler"
							min="1"
							max="100"
							required
							{...anfangswert(String(data.weisungsregel?.kopfSchwelle.zaehler ?? 1))}
						/>
					</label>
					<label class="eng">
						Nenner
						<input
							type="number"
							name="kopfNenner"
							min="1"
							max="100"
							required
							{...anfangswert(String(data.weisungsregel?.kopfSchwelle.nenner ?? 2))}
						/>
					</label>
					<label class="eng">
						Art
						<select name="kopfArt">
							<option value="mehr_als" selected={(data.weisungsregel?.kopfSchwelle.art ?? 'mehr_als') === 'mehr_als'}>
								mehr als
							</option>
							<option value="mindestens" selected={data.weisungsregel?.kopfSchwelle.art === 'mindestens'}>
								mindestens
							</option>
						</select>
					</label>
					<label class="eng">
						Wovon
						<select name="kopfbasis">
							<option value="anwesend_vertreten" selected={(data.weisungsregel?.kopfbasis ?? 'anwesend_vertreten') === 'anwesend_vertreten'}>
								der anwesenden oder vertretenen Stimmen
							</option>
							<option value="alle_eigentuemer" selected={data.weisungsregel?.kopfbasis === 'alle_eigentuemer'}>
								aller Eigentümer
							</option>
							<option value="alle_ausser_betroffene" selected={data.weisungsregel?.kopfbasis === 'alle_ausser_betroffene'}>
								aller ausser den Betroffenen
							</option>
						</select>
					</label>
				</div>
				<span class="hilfe">
					«Mehr als 1 von 2 der anwesenden oder vertretenen Stimmen» ist das einfache Mehr. Für zwei
					Drittel: 2 von 3, mindestens.
				</span>
			</fieldset>

			<label class="kasten kasten-label breit">
				<input type="checkbox" name="mitQuoten" value="true" bind:checked={weisungMitQuoten} />
				Zusätzlich eine Wertquotenschwelle
			</label>

			{#if weisungMitQuoten}
				<fieldset class="breit">
					<legend>Wertquoten im Haus</legend>
					<div class="reihe">
						<label class="eng">
							Zähler
							<input type="number" name="quotenZaehler" min="1" max="100" required
								{...anfangswert(String(data.weisungsregel?.quotenSchwelle?.zaehler ?? 1))} />
						</label>
						<label class="eng">
							Nenner
							<input type="number" name="quotenNenner" min="1" max="100" required
								{...anfangswert(String(data.weisungsregel?.quotenSchwelle?.nenner ?? 2))} />
						</label>
						<label class="eng">
							Art
							<select name="quotenArt">
								<option value="mehr_als" selected={(data.weisungsregel?.quotenSchwelle?.art ?? 'mehr_als') === 'mehr_als'}>mehr als</option>
								<option value="mindestens" selected={data.weisungsregel?.quotenSchwelle?.art === 'mindestens'}>mindestens</option>
							</select>
						</label>
						<label class="eng">
							Wovon
							<select name="quotenbasis">
								<option value="alle_quoten" selected={(data.weisungsregel?.quotenbasis ?? 'alle_quoten') === 'alle_quoten'}>der gesamten Wertquoten</option>
								<option value="anwesend_vertreten" selected={data.weisungsregel?.quotenbasis === 'anwesend_vertreten'}>der anwesenden oder vertretenen Wertquoten</option>
							</select>
						</label>
					</div>
				</fieldset>
			{/if}

			<fieldset class="breit">
				<legend>Wenn das Haus nicht entscheidet</legend>
				<div class="wahlen">
					<label class="wahl">
						<input type="radio" name="ohneBeschluss" value="enthaltung"
							{...angekreuzt((data.weisungsregel?.ohneBeschluss ?? 'enthaltung') === 'enthaltung')} />
						<span>
							<strong>Es enthält sich</strong>
							<span class="hilfe">Das Haus bleibt in der Bezugsgrösse der Miteigentümergemeinschaft.</span>
						</span>
					</label>
					<label class="wahl">
						<input type="radio" name="ohneBeschluss" value="nein"
							{...angekreuzt(data.weisungsregel?.ohneBeschluss === 'nein')} />
						<span>
							<strong>Seine Stimme gilt als Nein</strong>
							<span class="hilfe">Manche Reglemente sehen das vor — nachsehen, nicht annehmen.</span>
						</span>
					</label>
				</div>
			</fieldset>

			<label class="kasten kasten-label breit">
				<!--
					`value="true"`, nicht `"ja"`: `jaNein()` kennt genau `true` und `on`.
					Mit «ja» kam der Haken an, wurde aber als **nicht gesetzt** gelesen —
					gemessen am 25.08.2026: Das Kästchen stand angekreuzt da, und in der
					Datenbank landete `false`. Eine Wahl, die der Server verwirft, ohne es
					zu sagen.
				-->
				<input type="checkbox" name="enthaltungZaehltMit" value="true"
					{...angekreuzt(data.weisungsregel?.enthaltungZaehltMit ?? true)} />
				Enthaltungen bleiben in der Bezugsgrösse
			</label>

			<label class="breit">
				Fundstelle im Reglement
				<input name="fundstelle" required minlength="3" placeholder="z. B. Art. 7 Ziff. 3"
					{...anfangswert(data.weisungsregel?.fundstelle ?? '')} />
				<span class="hilfe">Sie steht später im Protokoll — ohne sie ist die Regel nicht überprüfbar.</span>
			</label>

			<label class="breit">
				Hinweis für die Sitzungsleitung (freiwillig)
				<input name="hinweis" {...anfangswert(data.weisungsregel?.hinweis ?? '')} />
			</label>

			<button type="submit">{data.weisungsregel ? 'Regel ändern' : 'Regel hinterlegen'}</button>
		</form>
		{:else}
			<!--
				**Ein Satz statt eines Formulars** (Auftraggeber, 27.08.2026, Punkt 2: «Felder,
				die nicht zur Wahl gehören, verschwinden»). Gemessen am 03.09.2026:
				1014 der 1190 Gemeinschaften haben keine übergeordnete — bei 85 Prozent
				stand hier ein Formular von rund 1400 px, das nie zu etwas führt.

				**Der Satz bleibt, das Formular geht.** Ganz wegzulassen hiesse, dass
				niemand die Einstellung findet, der sie sucht.

				**Und eine hinterlegte Regel wird weiterhin gezeigt** (Bedingung oben):
				Wird ein Haus später aus dem Verbund genommen, verschwände sie sonst
				still aus der Sicht, während sie in der Datenbank weiterlebt.
			-->
			<!--
				**Die Klasse ist die Zusicherung, nicht der Wortlaut** (03.09.2026): Die
				beiden Drehbuchschritte prüften zuerst den Satztext. Als er einen Tag
				später genauer gefasst wurde, war der eine Schritt rot und der andere
				**zahnlos grün** — er verlangte das Fehlen eines Textes, den es ohnehin
				nirgends mehr gab.
			-->
			<p class="hilfe ohne-mitgliedschaft">
				Diese Gemeinschaft wird in keiner anderen als Eigentümerin geführt. Die
				Einstellung erscheint, sobald das der Fall ist: In der übergeordneten
				Gemeinschaft unter <em>Eigentümer und Stimmkraft</em> → «Gehört diese
				Gemeinschaft anderen Gemeinschaften?».
			</p>
		{/if}

		<!-- ── Reihenfolge der Standardtraktanden (Block C2) ───────────────────────── -->
		<!--
			**Auf/Ab statt Drag-and-drop.** Die Knöpfe tragen ohne JavaScript nicht —
			aber ohne JavaScript ist die Liste eben die gespeicherte, und Speichern
			schickt sie so, wie sie dasteht. Drag-and-drop auf dem Telefon im Saal wäre
			das schlechtere Werkzeug: Es braucht lange Griffe und sagt dem
			Vorleseprogramm nichts.
		-->
		<h2>Reihenfolge der Standardtraktanden</h2>

		<p class="einleitung">
			In dieser Reihenfolge erhält jede <strong>neue</strong> Versammlung dieser
			Gemeinschaft ihre Standardtraktanden. Bestehende Versammlungen behalten ihre
			Positionen — sie stehen auf Einladungen und im Protokoll. Die
			ausserordentliche Versammlung kennt nur die zwei festen Punkte; was hier
			jährlich heisst, gilt für die ordentliche.
		</p>

		{#if data.ordnung !== null}
			<p class="klein">
				Gespeicherte Reihenfolge aktiv. <strong>Zurücksetzen</strong> stellt die
				Standardreihenfolge wieder her.
			</p>
		{:else}
			<p class="klein">
				Standardreihenfolge (nichts gespeichert). Verschieben und Speichern legt
				eine eigene Reihenfolge für dieses Haus an.
			</p>
		{/if}

		<form method="POST" action="?/ordnungSpeichern" class="ordnung" use:enhance={absenden()}>
			<ol class="ordnung-liste">
				{#each ordnung as schluessel, i (schluessel)}
					{@const vorlage = vorlageJeSchluessel.get(schluessel)}
					<li>
						<input type="hidden" name="ordnung" value={schluessel} />
						<span class="titel">
							<span class="name">{vorlage?.titel ?? schluessel}</span>
							{#if vorlage?.jaehrlich}<span class="marke">jährlich</span>{:else}<span
									class="marke"
								>fest</span
								>{/if}
							{#if vorlage?.kurzfassung}<span class="kurzfassung">{vorlage.kurzfassung}</span>{/if}
						</span>
						<span class="knopfe">
							<button
								type="button"
								class="leise"
								onclick={() => hoeher(i)}
								disabled={i === 0}
								aria-label="{vorlage?.titel ?? schluessel} höher"
							>▲</button>
							<button
								type="button"
								class="leise"
								onclick={() => tiefer(i)}
								disabled={i === ordnung.length - 1}
								aria-label="{vorlage?.titel ?? schluessel} tiefer"
							>▼</button>
						</span>
					</li>
				{/each}
			</ol>
			<!--
				**«(unverändert)» las sich wie ein Nichtstun** (Code-Review 01.09.2026).
				Der Knopf schickt immer alle Schlüssel mit: Wer ihn ohne Änderung drückt,
				friert die Standardreihenfolge als eigene ein — und bekommt eine spätere
				Verbesserung an der Vorlage nicht mehr mit. Genau das ist am 01.09.2026
				passiert, als die Jahresgeschäfte auf die Logik des Abends umgestellt
				wurden: Wer vorher gedrückt hatte, stimmte weiter über die Jahresrechnung
				ab, bevor der Revisionsbericht verlesen war.

				Der Knopf bleibt, weil das Festhalten ein legitimer Wunsch ist. Er sagt
				jetzt aber, was er tut.
			-->
			<button type="submit" class:warnung={ungespeichert}>
				{ungespeichert ? 'Reihenfolge speichern' : 'Diese Reihenfolge festhalten'}
			</button>
			{#if !ungespeichert && data.ordnung === null}
				<p class="klein lesebreite">
					Festhalten legt die heutige Standardreihenfolge als eigene an. Sie gilt dann auch weiter,
					wenn die Vorlage später eine bessere Reihenfolge bekommt.
				</p>
			{/if}
		</form>

		{#if data.ordnung !== null}
			<form method="POST" action="?/ordnungZuruecksetzen" class="ordnung-zurueck">
				<Rueckfrage
					beschriftung="Zurücksetzen"
					zeichen="kreuz"
					ton="warnung"
					gewicht="leise"
					frage="Gespeicherte Reihenfolge löschen?"
					folge="Ab sofort gilt für neue Versammlungen wieder die Standardreihenfolge. Bestehende Versammlungen bleiben, wie sie sind."
					bestaetigen="Zurücksetzen"
				/>
			</form>
		{/if}

		<h2>Vermerk zum Reglement</h2>

		<form method="POST" action="?/vermerken" class="formular" use:enhance={absenden({ reset: false })}>
			<label class="breit">
				Was sich nicht als Regel fassen lässt
				<textarea name="vermerk" rows="3">{data.stand.freitext ?? ''}</textarea>
				<span class="hilfe">
					Erscheint bei jeder Herleitung für diese Gemeinschaft als Hinweis. Etwa eine unklar
					formulierte Bestimmung oder eine Abweichung, die von Umständen abhängt.
				</span>
			</label>
			<button type="submit">Vermerk speichern</button>
		</form>
	</section>
</div>

<style>
	.gesetzlich dl {
		margin: 0.4rem 0 0;
	}

	.gesetzlich > dl > div {
		padding: 0.25rem 0;
		border-bottom: 1px solid var(--linie);
	}

	.gesetzlich dt {
		font-weight: 600;
	}

	.gesetzlich .beispiele {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.gesetzlich dd {
		margin: 0.1rem 0 0;
		color: var(--text-leise);
	}


	/*
		Der Kasten trägt eine Kante in Warnfarbe, aber keinen farbigen Grund: Es
		ist kein Fehler, sondern eine Folge — und sie steht ohnehin schon in der
		Tabelle darin.
	*/

	.leer {
		color: var(--text-leise);
		max-width: 46rem;
	}

	/* Die Traktandenordnung: eine Liste, links der Titel, rechts die Knöpfe. */
	.ordnung-liste {
		margin: 0.8rem 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
	}

	.ordnung-liste li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.55rem 0.9rem;
		border-bottom: 1px solid var(--linie);
	}

	.ordnung-liste li:last-child {
		border-bottom: none;
	}

	.ordnung-liste .titel {
		min-width: 0;
	}

	.ordnung-liste .titel .name {
		display: block;
	}

	.ordnung-liste .kurzfassung {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.85rem;
		color: var(--text-leise);
		max-width: 60ch;
	}

	.ordnung-liste .marke {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0.05rem 0.5rem;
		border-radius: 999px;
		font-size: 0.75rem;
		color: var(--text-leise);
		background: color-mix(in srgb, currentColor 8%, transparent);
	}

	.ordnung-liste .knopfe {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.ordnung-zurueck {
		/*
		 * `margin-top` zog den Nachsatz frueher an seine Liste heran. Im Stapel ist
		 * er ein direktes Abschnittskind: Die Marge addierte sich zum Abstand des
		 * Abschnitts, statt zu kollabieren, und schob ihn genau von der Liste weg,
		 * an die sie ihn heranziehen sollte (03.09.2026, aus dem Code-Review).
		 */
		margin-top: 0;
	}

	/*
	 * **Kein `margin-top` mehr** (03.09.2026, beim Umbau auf den Stapel). Die
	 * Abstaende zwischen den Bloecken liefert seither der Abschnitt selbst
	 * (`gap`), und eine Marge daneben addiert sich dazu statt zu kollabieren:
	 * gemessen 64 statt 24 px zwischen zwei Kaesten.
	 */
	h2 {
		font-size: 1.15rem;
	}

	.kasten {
		margin: 0;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
		max-width: 46rem;
	}

	.kasten.offen {
		border-color: var(--warnung);
		background: color-mix(in srgb, var(--warnung) 10%, transparent);
	}

	.kasten h2 {
		margin-top: 0;
		font-size: 1rem;
	}

	/* Die Fundstelle steht neben der Zahl, nicht anstelle von ihr. */
	.quelle {
		color: var(--text-leise);
	}




	.tabellenrahmen {
		overflow-x: auto;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		/*
		 * Keine senkrechte Marge (03.09.2026, aus dem Code-Review). Der Rahmen
		 * steht zweimal auf dieser Seite: einmal als direktes Kind eines
		 * Abschnitts, wo der Stapel den Abstand liefert und eine Marge sich dazu
		 * addiert statt zu kollabieren, und einmal im Warnkasten, wo `.nachziehen`
		 * seine eigenen Abstaende setzt. Beide Male ist sie ueberzaehlig.
		 */
		margin: 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--linie);
		vertical-align: top;
	}

	th {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--text-leise);
		white-space: nowrap;
	}

	.formular {
		margin-top: 0;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		align-items: flex-start;
		max-width: 46rem;
	}

	/* Der Satz zur Reichweite einer Regel — steht beim Feld, nicht am Seitenfuss. */
	.anmerkung {
		margin: 0;
		padding: 0.6rem 0.85rem;
		border-left: 3px solid var(--linie);
		background: var(--flaeche-2);
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	.voll {
		align-self: stretch;
	}

	/*
	 * Die Knoepfe des Formulars auf eigener Zeile, nebeneinander. `flex-basis`
	 * und nicht `width`: Das Formular ist ein `flex-wrap`, und nur die Basis
	 * erzwingt dort den Umbruch vor der Reihe.
	 */
	.formularknoepfe {
		display: flex;
		flex-basis: 100%;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	/*
	 * Dass das Formular gerade eine bestehende Regel aendert und keine neue
	 * anlegt, ist der Unterschied zwischen «berichtigt» und «eine zweite
	 * daneben». Der Streifen sagt es auch dem, der nur den Formularkopf sieht.
	 */
	.bearbeitungshinweis {
		border-left: 3px solid var(--akzent);
		padding-left: 0.7rem;
	}


	fieldset {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.75rem 1rem 1rem;
		width: 100%;
	}

	legend {
		font-size: 0.85rem;
		font-weight: 550;
		padding: 0 0.35rem;
	}

	.reihe {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: flex-end;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		font-weight: 550;
	}

	/*
	 * **`flex-basis` gehört in die Zeile, nicht in die Spalte** (03.09.2026,
	 * gemessen). `.breit` trug `flex: 1 1 16rem` für alle Vorkommen. In einer
	 * `<div class="reihe">` ist das richtig: Dort ist die Basis eine Breite.
	 * In `.formular` — `flex-direction: column` — ist die Basis eine **Höhe**,
	 * und jeder so ausgezeichnete Block wurde 16rem = 256 px hoch, ganz gleich,
	 * was darin stand.
	 *
	 * Gemessen an einer Gemeinschaft mit vier hinterlegten Abweichungen:
	 * zehn Blöcke, **866 px Luft**, 13 Prozent der Seitenhöhe. Zwei Kästchen
	 * mit einer Zeile Text darin waren 256 px hoch, davon 204 px leer. Das ist
	 * Die «viele Lücken» des Auftraggebers vom 28.08.2026, an dieser Seite.
	 *
	 * Vierzehn der sechzehn Vorkommen stehen in der Spalte, zwei in einer Zeile.
	 * Die Basis bekommen deshalb nur die zwei.
	 */
	.breit {
		width: 100%;
		/*
		 * **`min-width: 0`, sonst schrumpft der Kasten nie unter seinen Inhalt**
		 * (02.09.2026). Ein Flex-Kind hat von Haus aus `min-width: auto`: Es gibt
		 * seine Inhaltsbreite nicht auf, auch wenn `flex-shrink` es dürfte. Am
		 * Telefon lief die Seite dadurch 14 px quer — wenig, aber die
		 * Bildschirmtastatur macht daraus im Feld ein Verrutschen.
		 *
		 * Nachgemessen bringt weder `box-sizing` noch `width: auto` etwas: Der
		 * Kasten war nicht zu breit gerechnet, er wollte nur nicht schmaler
		 * werden.
		 */
		min-width: 0;
	}

	.reihe > .breit {
		flex: 1 1 16rem;
	}

	.eng {
		flex: 0 0 7rem;
	}

	.schmal {
		max-width: 12rem;
	}

	.kasten-label {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		font-weight: 400;
		min-height: var(--ziel-min);
	}

	/*
	 * **Im Feldraster steht das Kästchen links neben seinem Text, über die
	 * ganze Reihe** (UI-Durchgang 06.10.2026, gemessen bei 1440 px). In drei
	 * `.felder`-Rastern dieser Seite (app.css) steht ein Kästchen, und dort bekam das
	 * Kästchen eine Spur von 222 px: `flex-wrap` schob den Text darunter, das
	 * Häkchen stand über seinem Titel, auch bei 390 px. Ebenso standen die
	 * Hilfeabsätze in einer Spur (bis 22 Zeilen) und die Speicherknöpfe brachen
	 * zweizeilig um. Ohne Umbruch, mit `min-width: 0` am Text, wie
	 * `docs/gestaltung.md` («Ein Ankreuzfeld steht links neben seinem Titel»)
	 * es verlangt; die Absätze, die Feldgruppen mit ihren langen Erklärungen
	 * und der Knopf nehmen die ganze Reihe.
	 */
	.felder > .kasten-label {
		flex-wrap: nowrap;
		grid-column: 1 / -1;
	}

	.felder > .kasten-label > span {
		min-width: 0;
	}

	/* Nur in den Rastern mit Kästchen: Die übrigen fünf `.felder`-Formulare der
	   Seite («Frist speichern», «Durchsicht bestätigen» usw.) behalten den Knopf
	   auf der Grundlinie neben ihren Feldern, wie app.css es vorsieht
	   (Codeprüfung 06.10.2026: die erste Fassung traf alle acht). */
	.felder:has(> .kasten-label) > .hilfe,
	.felder:has(> .kasten-label) > fieldset,
	.felder:has(> .kasten-label) > button {
		grid-column: 1 / -1;
	}

	/* Das zweite Formular im Kasten «Nicht angekündigte Geschäfte» beginnt mit
	   eigener Überschrift; sie stand 0 px unter «Angabe speichern». */
	.kasten > h3 {
		margin: 1.5rem 0 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--linie);
		font-size: 1rem;
	}

	.hilfe {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
		flex-basis: 100%;
	}

	/*
	 * Der Wegweiser auf die Nachbarseite. Etwas groesser als die uebrige Hilfe und
	 * eingerueckt: Er beantwortet eine Frage, die man auf dieser Seite stellt und
	 * hier nicht beantwortet bekommt, und muss deshalb auch dem auffallen, der
	 * nur ueberfliegt.
	 */
	.verweis {
		font-size: 0.9375rem;
		border-left: 3px solid var(--linie);
		padding-left: 0.7rem;
		margin: 0;
	}

	/*
	 * **`:global(…)` für die Felder, die in `Suchauswahl.svelte` stehen.** Svelte
	 * gestaltet nur Elemente aus dieser Datei; ohne diese Zeilen fielen die
	 * umgestellten Auswahlfelder auf das Hausmass aus `app.css` zurück und sähen
	 * anders aus als die Textfelder daneben. Die rohe `select`-Zeile darüber
	 * bleibt: Auf beiden Seiten stehen noch kurze feste Aufzählungen.
	 */
	input,
	select,
	.formular :global(select),
	.formular :global(.auswahlsuche),
	textarea {
		min-height: var(--ziel-min);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	textarea {
		min-height: 4rem;
		resize: vertical;
	}

	input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
		min-height: 0;
		flex: none;
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
		flex: none;
	}

	button.leise {
		background: transparent;
		border: 1px solid var(--linie);
		color: var(--text-leise);
		padding: 0 0.9rem;
	}

	/*
	 * **Die beiden Handlungen einer Regelzeile bleiben nebeneinander**
	 * (03.09.2026, in der Sichtprobe gefunden). Der erste Anlauf trug
	 * `flex-wrap: wrap`, damit die schmale Spalte umbrechen darf — und genau das
	 * tat sie: Die Knoepfe standen untereinander, und jede Zeile der Tabelle
	 * stand doppelt so hoch wie ihr Inhalt, bei fuenf Regeln ein halber
	 * Bildschirm fuer nichts.
	 *
	 * Die Spalte darf stattdessen breiter werden. Auf dem Telefon rollt der
	 * `.tabellenrahmen` ohnehin waagrecht, dort kostet die Breite nichts.
	 */
	.zeilenknoepfe {
		display: flex;
		gap: 0.4rem;
	}

	.zeilenknoepfe button {
		white-space: nowrap;
	}

	/*
	 * Der Knopf zeigt, dass diese Regel gerade unten im Formular steht — sonst
	 * ist bei fünf Zeilen nicht zu sehen, welche man aufgerufen hat.
	 * `aria-pressed` traegt dieselbe Auskunft fuer die Sprachausgabe, damit sie
	 * nicht allein an der Farbe haengt.
	 */
	.zeilenknoepfe button[aria-pressed='true'] {
		background: var(--flaeche-2);
		border-color: var(--akzent);
		color: var(--text);
	}
	/*
	 * Die Liste dessen, was eine Regel mittrifft. Umrandet statt eingefärbt: Es
	 * ist keine Warnung — die Regel darf so gemeint sein — sondern eine Auskunft,
	 * die man vor dem Speichern gelesen haben muss.
	 */
	.fallwahl label {
		align-items: baseline;
		display: flex;
		gap: 0.5rem;
		margin: 0.35rem 0;
	}

	.fallwahl label span {
		display: block;
	}

	/* Die Reichweite unter der Geschäftsart — leise, aber lesbar. */
	.nurfall {
		color: var(--text-leise);
		display: block;
	}
</style>
