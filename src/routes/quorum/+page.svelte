<script lang="ts">
	import Hilfetext from '$lib/components/Hilfetext.svelte';
	import { untrack } from 'svelte';
	import { aufgeklappt } from '$lib/felder';
	import Ergebniskarte from '$lib/components/Ergebniskarte.svelte';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';
	import { mehrheitMitBasis } from '$lib/domain/entscheidbaum';

	let { data, form } = $props();

	/**
	 * Die Kopfzeile mit dem Zahlenbeispiel — sie schickt sich nach der Wahl
	 * selbst ab. Ohne JavaScript steht dafür der Knopf im `<noscript>` daneben.
	 */
	let kopfzeile = $state<HTMLFormElement | undefined>(undefined);

	/** Alles steht in der Adresse — deshalb ist jede Antwort ein Verweis, kein Formular. */
	function pfadUrl(astId: string, antwortIds: string[]): string {
		const p = new URLSearchParams();
		if (data.gemeinschaftId) p.set('g', data.gemeinschaftId);
		if (astId) p.set('ast', astId);
		if (antwortIds.length > 0) p.set('p', antwortIds.join(','));
		const s = p.toString();
		return s ? `/quorum?${s}` : '/quorum';
	}

	const bisherige = $derived(data.stand ? data.stand.schritte.map((s) => s.antwortId) : []);

	/**
	 * Welcher Typ im Formular «ohne Herleitung» gerade gewählt ist — davon hängen
	 * die wählbaren Bezugsgrössen ab (Auftraggeber, 11.08.2026).
	 */
	let gesetzterTyp = $state(
		untrack(() => data.stand?.erfordernis?.typ ?? data.waehlbar[0]?.typ ?? 'einfaches_mehr')
	);

	/*
	 * **Der Typ folgt dem Vorschlag, bis jemand selbst wählt** (Nachprüfung
	 * 23.08.2026, dieselbe Ursache wie am Traktandum).
	 *
	 * `$state(untrack(...))` wertet einmal beim Erzeugen der Komponente aus. Der
	 * Baum besteht aber aus Verweisen auf dieselbe Route: SvelteKit tauscht nur
	 * `data` aus und erzeugt die Seite nicht neu. Beim Einstieg ohne `?ast=` ist
	 * `data.stand` noch `null`, die Auswahl stand also auf dem ersten Typ der
	 * Liste — wer nur die Bezugsgrösse ändern wollte, setzte nebenbei die
	 * Mehrheit herab.
	 *
	 * Eine Handwahl ändert `data` nicht und bleibt stehen; ein Schritt im Baum
	 * ändert es und setzt zurück — genau dann soll er das auch.
	 */
	$effect(() => {
		const vorschlag = data.stand?.erfordernis?.typ;
		if (!vorschlag) return;
		/*
		 * **Nur, was auch wählbar ist** (gefunden im Durchgang, 23.08.2026).
		 *
		 * Der Vorschlag kann ein Typ sein, den man gar nicht setzen kann — ein
		 * Reglementsmehr etwa steht nicht in `WAEHLBARE_TYPEN`. Ungeprüft
		 * geschrieben stand das Pflichtfeld auf einem Wert, den keine Option
		 * trägt: Der Browser zeigte es LEER, und das Formular liess sich nicht
		 * mehr abschicken. Dann lieber der erste Eintrag, wie bisher.
		 */
		/*
		 * Und wenn er nicht wählbar ist, NICHT der erste Eintrag: Der heisst
		 * «keine Abstimmung», und wer in einem Formular für das
		 * Mehrheitserfordernis nicht aufpasst, macht daraus lautlos eine
		 * Kenntnisnahme. Das einfache Mehr ist der harmlose Rückfall — es
		 * beschliesst, aber verschärft nichts.
		 */
		const waehlbar = data.waehlbar.some((w) => w.typ === vorschlag)
			? vorschlag
			: data.waehlbar.some((w) => w.typ === 'einfaches_mehr')
				? 'einfaches_mehr'
				: (data.waehlbar[0]?.typ ?? 'einfaches_mehr');
		untrack(() => (gesetzterTyp = waehlbar));
	});
	const basen = $derived(data.waehlbar.find((w) => w.typ === gesetzterTyp)?.basen ?? null);

	/** Der Ergebnistyp trägt die Kennung, die Bezeichnung steht im Regelwerk. */
	function bezeichnungVon(typ: string): string {
		return data.bezeichnungen[typ] ?? typ;
	}
</script>

<h1>Mehrheitserfordernis herleiten</h1>

<p class="einleitung">
	Wählen Sie das Vorhaben und beantworten Sie ein bis vier Rückfragen. Das Ergebnis ist ein
	<strong>Vorschlag</strong>; entschieden hat am Ende die Sitzungsleitung.
</p>

<form method="GET" class="kopfzeile" bind:this={kopfzeile}>
	<label>
		Zahlenbeispiel für
		<!--
			Das Formular schickt sich nach der Wahl selbst ab. Der Weg über
			`bind:this` und nicht über `event.currentTarget.form`: Der Baustein
			reicht den Wert weiter, nicht das Ereignis.
		-->
		<Suchauswahl
			name="g"
			beschriftung="Zahlenbeispiel für"
			leerText="— ohne Gemeinschaft, ohne Zahlen —"
			wert={data.gemeinschaftId ?? ''}
			eintraege={data.gemeinschaften.map((g) => ({ wert: g.id, text: g.name }))}
			beiWechsel={() => kopfzeile?.requestSubmit()}
		/>
	</label>
	{#if data.stand}
		<input type="hidden" name="ast" value={data.stand.astId} />
		{#if bisherige.length > 0}<input type="hidden" name="p" value={bisherige.join(',')} />{/if}
	{/if}
	<noscript><button type="submit">Übernehmen</button></noscript>
</form>

{#if data.reglementHinweis}
	<p class="meldung" class:warnung={data.reglementOffen}>
		<strong>Reglement:</strong>
		{data.reglementHinweis}
		<a href="/gemeinschaften/{data.gemeinschaftId}/reglement">Abweichungen verwalten</a>
	</p>
{/if}

<!--
	**Der Vermerk, den es zu sehen gab** (23.08.2026, Prüflauf I, B-23). Unter
	dem Feld «Vermerk zum Reglement» steht «Erscheint bei jeder Herleitung für
	diese Gemeinschaft als Hinweis». Im Prüflauf trug ein Verwalter dort
	§ 12 Abs. 3 ein und sah ihn nie wieder.

	Er steht neben dem Reglementshinweis, nicht darin: Der eine sagt, ob
	durchgesehen wurde, der andere, was dabei herauskam und sich nicht als Regel
	fassen liess.
-->
{#if data.reglementsvermerk}
	<p class="meldung vermerk">
		<strong>Vermerk zum Reglement:</strong>
		{data.reglementsvermerk}
		<span class="klein">
			Von Hand festgehalten — die Anwendung wendet ihn nicht an, sie zeigt ihn.
		</span>
	</p>
{/if}

{#if data.gemeinschaftId && !data.kennzahlen}
	<p class="meldung warnung">
		Für diese Gemeinschaft lässt sich kein Zahlenbeispiel rechnen — es fehlt der Wertquoten-Nenner
		oder es sind noch keine Eigentümer erfasst.
	</p>
{/if}

{#if !data.stand}
	<h2>Was steht an?</h2>
	<ul class="kacheln">
		{#each data.aeste as ast (ast.id)}
			<li>
				<a href={pfadUrl(ast.id, [])}>
					<span class="titel">{ast.titel}</span>
					<span class="unter">{ast.beschreibung}</span>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<nav class="weg" aria-label="Bisherige Antworten">
		<a href={pfadUrl('', [])}>Vorhaben</a>
		{#each data.stand.schritte as schritt, i (schritt.antwortId)}
			<span aria-hidden="true">›</span>
			<a href={pfadUrl(data.stand.astId, bisherige.slice(0, i))}>{schritt.antwortText}</a>
		{/each}
	</nav>

	{#if data.stand.art === 'frage'}
		<h2>{data.stand.frage.text}</h2>
		{#if data.stand.frage.hilfeTeile}
			<Hilfetext teile={data.stand.frage.hilfeTeile} />
		{/if}
		<ul class="antworten">
			{#each data.stand.frage.antworten as antwort (antwort.id)}
				<li>
					<a href={pfadUrl(data.stand.astId, [...bisherige, antwort.id])}>
						<span class="titel">{antwort.text}</span>
						{#if antwort.hilfe}<span class="unter">{antwort.hilfe}</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<Ergebniskarte karte={data.stand.karte} urheberschaft={data.stand.urheberschaft} />

		{#if form?.gesetzt}
			<article class="karte gesetzt">
				<p class="marke gesetzt">Von der Sitzungsleitung gesetzt</p>
				<!--
					**Mit der Bezugsgrösse** (Prüflauf I, B-19): «Qualifiziertes Mehr»
					allein sagt die Höhe, nicht das Wovon. Wer ausdrücklich «aller
					Eigentümer, auch der abwesenden» gewählt hat, muss das hier
					wiederfinden — sonst sagen Anzeige und Rechnung Verschiedenes.
				-->
				<h2>{mehrheitMitBasis(bezeichnungVon(form.gesetzt.typ), form.gesetzt)}</h2>
				<!--
					**«für:» nennt den Fall, nicht die Mehrheit** (Nachprüfung
					23.08.2026). Seit der Titel eines gesetzten Erfordernisses die
					Mehrheit trägt, stand hier wortgleich dasselbe wie in der
					Überschrift darüber — und der Fall, für den es gilt, war aus der
					Karte verschwunden. Wovon abgewichen wurde, steht seit dem
					30.09.2026 nicht mehr in der Rechtsgrundlage (sie läuft nach
					aussen), sondern im Verlauf; diese Seite ist nur für die Leitung
					und nennt den Vorschlag deshalb selbst.
				-->
				<p class="grundlage">
					{#if form.gesetzt.quelle !== 'gewaehlt'}
						für: {form.gesetzt.titel}
					{:else if form.gesetzt.rechtsgrundlage}
						{form.gesetzt.rechtsgrundlage}
					{/if}
					{#if form.gesetzt.vorschlagTyp}
						Vorgeschlagen war {bezeichnungVon(form.gesetzt.vorschlagTyp)}.
					{/if}
				</p>
				{#if form.gesetzt.risiko}
					<div class="block hervor">
						<h3>
							{form.gesetzt.risikoGrund === 'gegen_reglement'
								? 'Abweichung vom eigenen Reglement'
								: 'Abschwächung — bitte nachlesen'}
						</h3>
						<p>
							{form.gesetzt.risikoGrund === 'gegen_reglement'
								? data.reglementsbruchhinweis
								: data.anfechtungshinweis}
						</p>
					</div>
				{/if}
				<p><strong>Begründung:</strong> {form.gesetzt.begruendung}</p>
				<p class="urheber">{form.urheberschaft}</p>
				{#if data.gemeinschaftId}
					<p class="klein">
						Im Verlauf festgehalten. <a href="/verlauf?gegenstand={data.gemeinschaftId}">Ansehen</a>
					</p>
				{:else}
					<p class="klein">
						Ohne gewählte Gemeinschaft wird nichts festgehalten — ein Verlaufseintrag ohne Bezug
						wäre später nicht zuzuordnen.
					</p>
				{/if}
			</article>
		{/if}

		<details class="uebersteuern" {...aufgeklappt(Boolean(form?.fehler))}>
			<summary>Anderes Erfordernis setzen</summary>
			<p class="hilfe">
				Der Vorschlag stammt vom Werkzeug. Entscheidet die Sitzungsleitung anders, gehören
				Vorschlag, Abweichung und Begründung in den Verlauf.
			</p>
			{#if form?.fehler}
				<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
			{/if}
			<form method="POST" action="?/setzen" class="felder">
				<input type="hidden" name="ast" value={data.stand.astId} />
				<input type="hidden" name="p" value={bisherige.join(',')} />
				<input type="hidden" name="g" value={data.gemeinschaftId} />
				<!--
					**Was das Setzen von Hand kostet** (23.08.2026, Prüflauf I, B-19).
					Derselbe Hinweis wie am Traktandum — der Grenzfall wird hier so oft
					erreicht wie dort, und ein Hinweis an nur einer der beiden Stellen
					ist keiner.
				-->
				{#if data.stand.regelVorbehalten}
					<p class="hilfe voll warnung">
						<strong>Achtung:</strong> Setzen Sie hier von Hand, gilt die Reglementsregel
						{data.stand.regelVorbehalten.fundstelle} <strong>nicht</strong>
						{#if data.stand.regelVorbehalten.mitQuotenschranke}
							— auch ihre Wertquotenschranke nicht
						{/if}. Wollen Sie beides, gehen Sie
						<a href={pfadUrl(data.stand.astId, bisherige.slice(0, -1))}>eine Frage zurück</a>
						und entscheiden Sie den Grenzfall.
					</p>
				{/if}
				<label>
					Erfordernis
					<Suchauswahl
						name="typ"
						beschriftung="Erfordernis"
						pflicht
						bind:wert={gesetzterTyp}
						eintraege={data.waehlbar.map((w) => ({ wert: w.typ, text: w.bezeichnung }))}
					/>
				</label>

				<!--
					Der Typ sagt, wie hoch die Schwelle liegt; wovon, sagt die Basis
					(Auftraggeber, 11.08.2026). Nur wo das Gesetz sie nicht festlegt.
				-->
				<!--
					**«Wie vorgeschlagen» steht zuoberst** (Nachprüfung 23.08.2026). Das
					Formular schickt `ast` mit, landet also im Übersteuerungszweig — und
					dort wird geerbt, was hier leer bleibt. Ohne diesen Eintrag ginge die
					Bezugsgrösse des Vorschlags immer verloren, auch die, die das Gesetz
					selbst nennt: «alle ausser den Betroffenen» (ZGB Art. 649b Abs. 2)
					steht in keiner Auswahlliste, weil es dort nichts zu wählen gibt.
				-->
				{#if basen && basen.kopf.length > 1}
					<label>
						Mehrheit wovon?
						<Suchauswahl
							name="kopfbasis"
							beschriftung="Mehrheit wovon?"
							leerText="— wie vorgeschlagen —"
							eintraege={basen.kopf.map((b) => ({ wert: b.wert, text: `Mehrheit ${b.text}` }))}
						/>
					</label>
				{/if}
				{#if basen && basen.quoten.length > 1}
					<label>
						Wertquoten wovon?
						<Suchauswahl
							name="quotenbasis"
							beschriftung="Wertquoten wovon?"
							leerText="— wie vorgeschlagen —"
							eintraege={basen.quoten.map((b) => ({ wert: b.wert, text: b.text }))}
						/>
					</label>
				{/if}

				<label class="breit">
					Begründung
					<textarea name="begruendung" rows="2" required minlength="3"></textarea>
				</label>
				<button type="submit">Setzen</button>
			</form>
		</details>

		<p class="wegzurueck">
			<a href={pfadUrl(data.stand.astId, bisherige.slice(0, -1))}>Eine Frage zurück</a>
			<a href={pfadUrl('', [])}>Von vorn</a>
		</p>
	{/if}
{/if}

<!--
	**Sechs Zeilen unter jeder Frage** (23.08.2026, Prüflauf I, B-26). Der
	Entscheidbaum führt über bis zu vier Fragen, und jede ist eine eigene Seite —
	der Freigabevermerk stand also viermal hintereinander, wortgleich. Beim
	zweiten Mal liest ihn niemand mehr, beim vierten überblättert man auch den
	Satz darüber.

	Der Satz, auf den es ankommt, bleibt stehen: Fassung und ob juristisch
	gegengelesen. Die Entstehungsgeschichte — welcher Block wann geprüft wurde,
	wie die Lehrstreite vorentschieden sind — steht im Ausklapper. Sie gehört
	nicht weg, nur nicht viermal auf denselben Weg.
-->
<footer class="fassung">
	<p>
		Regelwerk Fassung {data.fassung}.
		{#if !data.juristischGegengelesen}
			<strong>Noch nicht juristisch gegengelesen.</strong>
			Jedes Ergebnis ist ein Vorschlag an die Sitzungsleitung.
		{/if}
	</p>
	<details>
		<summary>Wie diese Fassung entstanden ist</summary>
		<p class="klein">{data.freigabevermerk}</p>
	</details>
</footer>

<style>
	/* Der Vermerk ist kein Zustand, sondern ein Zitat — deshalb ohne Warnfarbe,
	   aber mit einer Kante, damit er nicht als Fliesstext gelesen wird. */
	.vermerk {
		border-left: 3px solid var(--linie);
	}

	.vermerk .klein {
		display: block;
		margin-top: 0.3rem;
		color: var(--text-leise);
	}

	.kopfzeile {
		margin: 1.25rem 0;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		font-weight: 550;
		max-width: 22rem;
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	.kopfzeile :global(select),
	.kopfzeile :global(.auswahlsuche),
	.felder :global(select),
	.felder :global(.auswahlsuche) {
		min-height: var(--ziel-min);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	.kacheln,
	.antworten {
		list-style: none;
		padding: 0;
		margin: 1rem 0;
		display: grid;
		gap: 0.6rem;
	}

	.kacheln {
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}

	.antworten {
		max-width: 46rem;
	}

	.kacheln a,
	.antworten a {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-height: var(--ziel-min);
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: inherit;
		text-decoration: none;
		height: 100%;
	}

	.kacheln a:hover,
	.antworten a:hover {
		border-color: var(--akzent);
	}

	.titel {
		font-weight: 550;
	}

	.unter,
	.hilfe,
	.klein {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	.weg {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.875rem;
		color: var(--text-leise);
		margin: 1rem 0 0.5rem;
	}

	.karte {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1.25rem;
		max-width: 46rem;
		margin: 1rem 0;
	}

	.marke {
		display: inline-block;
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--akzent) 20%, transparent);
		font-size: 0.85rem;
		font-weight: 550;
		margin: 0 0 0.5rem;
	}

	.karte h2 {
		margin: 0 0 0.2rem;
	}

	.grundlage {
		font-family: ui-monospace, monospace;
		font-size: 0.9rem;
		color: var(--text-leise);
		margin: 0 0 1rem;
	}

	.block {
		border-top: 1px solid var(--linie);
		padding-top: 0.9rem;
		margin-top: 0.9rem;
	}

	.block.hervor {
		border: 1px solid var(--warnung);
		border-radius: var(--radius);
		padding: 0.75rem 0.9rem;
		background: color-mix(in srgb, var(--warnung) 10%, transparent);
	}

	.block h3 {
		font-size: 0.95rem;
		margin: 0 0 0.35rem;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		max-width: 46rem;
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.urheber {
		border-top: 1px solid var(--linie);
		padding-top: 0.75rem;
		margin-top: 0.9rem;
		margin-bottom: 0;
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.karte.gesetzt {
		border-color: var(--akzent);
	}

	.marke.gesetzt {
		background: color-mix(in srgb, var(--akzent) 30%, transparent);
	}

	.uebersteuern {
		max-width: 46rem;
		margin: 1.25rem 0;
	}

	summary {
		cursor: pointer;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
		font-weight: 550;
	}

	.breit {
		flex: 1 1 20rem;
		max-width: none;
	}

	textarea {
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-weight: 400;
		resize: vertical;
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

	.wegzurueck {
		display: flex;
		gap: 1.25rem;
		font-size: 0.9rem;
	}

	.fassung {
		margin-top: 2.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--linie);
		font-size: 0.875rem;
		color: var(--text-leise);
		max-width: 46rem;
	}

	.fassung p {
		margin: 0 0 0.25rem;
	}
	.hilfe.warnung {
		border-left: 3px solid var(--warnung);
		padding-left: 0.65rem;
		color: var(--text);
	}
</style>
