<script lang="ts">
	/**
	 * Anlegen: erst die Frage, dann **für beide Fälle dasselbe Formular**.
	 *
	 * Die Wahl steht oben und nicht als Nebensatz, weil sie den ganzen weiteren
	 * Weg bestimmt: Eine einzelne Versammlung gehört einer Gemeinschaft, eine
	 * gemeinsame gehört mehreren und ist die Klammer darum.
	 *
	 * Darunter ändert sich nur eines: ob man **eine** Gemeinschaft wählt oder
	 * **mehrere** ankreuzt. Wann und wo ist dieselbe Frage, dieselben Felder,
	 * derselbe Knopf — vorher führte der einzelne Fall auf eine zweite Seite und
	 * zeigte drei Schritte, der gemeinsame blieb hier und zeigte zwei.
	 *
	 * Was eine Versammlung sonst noch ausmacht — ordentlich oder ausserordentlich,
	 * Erst- oder Zweitversammlung, Abstimmungsweise, Anlass, Vorgängerin — steht
	 * danach auf ihrer eigenen Seite. Dort ist es ohnehin änderbar, und zwei
	 * Formulare für dieselben Felder laufen auseinander.
	 */
	import { untrack } from 'svelte';
	import Anlegeschritte from '$lib/components/Anlegeschritte.svelte';
	import Ungespeichert from '$lib/components/Ungespeichert.svelte';
	import { filtereGemeinschaften } from '$lib/domain/versammlungsliste';
	import { anfangswert } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';

	let { data, form } = $props();

	/**
	 * Nach einem abgewiesenen Formular steht die Wahl wieder richtig.
	 *
	 * Die Wahl lebt im Browser, die Antwort auf ein abgelehntes Formular kommt
	 * vom Server — und die Seite lädt dabei neu. Ohne diese Ableitung stand man
	 * nach jedem fachlichen Fehler wieder bei «Eine einzelne Versammlung», die
	 * eingetippten Angaben waren unsichtbar, und die Fehlermeldung stand in
	 * einem Zweig, der gar nicht gezeichnet wurde. Gemessen am 11.08.2026.
	 */
	let art = $state<'einzeln' | 'gemeinsam'>(
		untrack(() => (form && 'werte' in form && form.werte?.bezeichnung !== undefined ? 'gemeinsam' : 'einzeln'))
	);
	let suche = $state('');
	/**
	 * Der gewählte Tag — nur für den Hinweis, wenn er zurückliegt (B-02).
	 *
	 * `bind:value` samt `$state` ist hier richtig und kein Widerspruch zur
	 * Feld-Doktrin: Das Feld wird nicht programmgeführt gefüllt, sondern nur
	 * mitgelesen; der Anfangswert kommt weiterhin aus `anfangswert`.
	 */
	let tag = $state(untrack(() => (form && 'werte' in form && form.werte && 'datum' in form.werte ? String(form.werte.datum ?? '') : '')));
	/**
	 * Ordentlich oder ausserordentlich — für alle, die hier entstehen.
	 *
	 * Heisst `versammlungsart`, weil `art` in dieser Seite schon die Wahl
	 * «einzeln oder gemeinsam» trägt. Wie die Wahl oben überlebt sie ein
	 * abgewiesenes Formular nur, wenn sie aus `form` abgeleitet wird.
	 */
	let versammlungsart = $state<'ordentlich' | 'ausserordentlich'>(
		untrack(() =>
			form && 'werte' in form && form.werte?.versammlungsart === 'ausserordentlich'
				? 'ausserordentlich'
				: 'ordentlich'
		)
	);

	const gefiltert = $derived(
		new Set(filtereGemeinschaften(data.gemeinschaften, suche).map((g) => g.id))
	);

	/**
	 * Die Auswahl überlebt die Suche.
	 *
	 * Gefiltert wird mit `hidden`, statt die übrigen aus dem Baum zu nehmen —
	 * sonst verlöre eine schon angekreuzte Gemeinschaft ihr Häkchen, sobald sie
	 * aus dem Suchergebnis fällt, und niemand sähe, dass sie fehlt.
	 */
	let gewaehlt = $state<string[]>(
		untrack(() => (form && 'gewaehlt' in form && form.gewaehlt) || (data.fuer ? [data.fuer] : []))
	);

	function umschalten(id: string, an: boolean) {
		gewaehlt = an ? [...new Set([...gewaehlt, id])] : gewaehlt.filter((x) => x !== id);
	}

	const werte = $derived(form && 'werte' in form && form.werte ? form.werte : null);

	/** Der Ort kommt aus der einzigen gewählten Gemeinschaft — meist stimmt er. */
	const ortsvorschlag = $derived(
		gewaehlt.length === 1
			? (data.gemeinschaften.find((g) => g.id === gewaehlt[0])?.ort ?? '')
			: ''
	);

	const knopf = $derived(
		art === 'einzeln'
			? 'Versammlung anlegen'
			: gewaehlt.length > 0
				? `Gemeinsame Versammlung mit ${gewaehlt.length} ${gewaehlt.length === 1 ? 'Gemeinschaft' : 'Gemeinschaften'} anlegen`
				: 'Gemeinsame Versammlung anlegen'
	);
</script>

<p class="pfad"><a href="/versammlungen">Versammlungen</a></p>
<h1>Neue Versammlung</h1>

<Anlegeschritte schritte={['Art', 'Wer und wann']} aktiv={1} />

<!--
	Die Meldung steht **vor** der Wahl und nicht im Zweig, zu dem sie gehört.
	Sonst hinge ihre Sichtbarkeit an einem Zustand, der beim Neuladen gerade
	zurückgesetzt wurde — und der Benutzer sähe eine Seite, die so tut, als sei
	nichts geschehen.
-->
{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{/if}

<h2 class="abschnitt">Was wird angelegt?</h2>

<div class="kacheln">
	<label class="wahlkarte" class:gewaehlt={art === 'einzeln'}>
		<span class="kopf">
			<input type="radio" name="art" value="einzeln" bind:group={art} />
			<strong>Eine einzelne Versammlung</strong>
		</span>
		<span class="antwort">Eine Gemeinschaft tagt für sich.</span>
		<span class="zusatz">Der Normalfall.</span>
	</label>

	<label class="wahlkarte" class:gewaehlt={art === 'gemeinsam'}>
		<span class="kopf">
			<input type="radio" name="art" value="gemeinsam" bind:group={art} />
			<strong>Mehrere Gemeinschaften zusammen</strong>
		</span>
		<span class="antwort">Gleicher Tag, gleicher Ort.</span>
		<span class="zusatz">Ein Einlass und eine Tafel im Saal.</span>
		<span class="erklaerung">
			Getrennt bleibt, was rechtlich getrennt sein muss — eigene Beschlussfähigkeit, eigenes
			Protokoll, eigene Anfechtungsfrist.
		</span>
	</label>
</div>

<form id="anlegen" method="POST" action={art === 'einzeln' ? '?/einzeln' : '?/gemeinsam'}>
	<h2 class="abschnitt">Wer tagt?</h2>
	{#if data.gemeinschaften.length === 0}
		<p class="leer">
			Noch keine Gemeinschaft erfasst. Legen Sie zuerst eine
			<a href="/gemeinschaften/neu">Gemeinschaft</a> an.
		</p>
	{:else}
		<!--
			Die Suchleiste steht bei beiden Wegen und ohne Schwelle. Vorher erschien
			sie beim einzelnen Weg erst ab neun Gemeinschaften und beim gemeinsamen
			immer — bei sechs Häusern sah man sie also nur auf einer der beiden
			Seiten und hielt das für einen Mangel. Gemeldet am 11.08.2026.
		-->
		<div class="suchleiste">
			<label class="suchfeld">
				<span class="nurLeser">Gemeinschaft suchen</span>
				<input
					type="search"
					placeholder="Name oder Adresse"
					{...anfangswert(suche)}
					oninput={(e) => (suche = e.currentTarget.value)}
					autocomplete="off"
				/>
			</label>
			<p class="zaehler">
				{#if art === 'einzeln'}
					{gefiltert.size} von {data.gemeinschaften.length}
					{data.gemeinschaften.length === 1 ? 'Gemeinschaft' : 'Gemeinschaften'}
				{:else}
					{gewaehlt.length}
					{gewaehlt.length === 1 ? 'Gemeinschaft' : 'Gemeinschaften'} gewählt
					{#if suche}· {gefiltert.size} von {data.gemeinschaften.length} gezeigt{/if}
				{/if}
			</p>
		</div>

		<ul class="auswahl">
			{#each data.gemeinschaften as g (g.id)}
				<li hidden={!gefiltert.has(g.id)}>
					<label>
						<!--
							Einer oder mehrere — derselbe Name, damit der Server nicht zwei
							Felder auseinanderhalten muss. Der Unterschied ist die Art des
							Feldes, nicht seine Bedeutung.
						-->
						<!--
							**Eine Klammer lässt sich nicht ankreuzen** (23.08.2026, Prüflauf
							II, B-03). Sie hat keine Einheiten und damit keine
							Stimmberechtigten; eine Versammlung dort wäre eine, an der
							niemand teilnehmen kann. Gesperrt statt versteckt — wer sie
							sucht, soll lesen, warum sie fehlt.
						-->
						<input
							type={art === 'einzeln' ? 'radio' : 'checkbox'}
							name="gemeinschaft"
							value={g.id}
							data-gefuehrt
							disabled={g.klammer}
							checked={gewaehlt.includes(g.id)}
							onchange={(e) =>
								art === 'einzeln'
									? (gewaehlt = [g.id])
									: umschalten(g.id, e.currentTarget.checked)}
						/>
						<span>
							<strong>{g.name}</strong>
							{#if g.adresse}<span class="hilfe">{g.adresse}</span>{/if}
							{#if g.klammer}
								<span class="hilfe klammer">
									Klammer über mehreren Häusern — sie tagt nicht selbst. Wählen Sie die
									Häuser darunter; ihr gemeinsamer Abend entsteht hier.
								</span>
							{/if}
						</span>
					</label>
				</li>
			{/each}
		</ul>

		{#if art === 'gemeinsam'}
			<p class="lesebreite hilfe">
				Für jede angekreuzte Gemeinschaft entsteht eine Versammlung mit Tag, Ort und Art von
				unten — als Erstversammlung, die Abstimmungsweise nach der Zahl der Parteien. Das lässt
				sich danach je Versammlung ändern, und Tag, Ort und Art auch für alle zugleich auf der
				Seite der gemeinsamen Versammlung. Wer noch nicht weiss, wer tagt, kreuzt nichts an und
				ordnet später zu.
			</p>
		{/if}
	{/if}

	<h2 class="abschnitt">Wann und wo?</h2>
	<!--
		**Keine `.zeile` mehr um Tag, Beginn und Ort.**
		Sie war eine Zwischenebene im Baum, und dadurch griff `.felder > label`
		nicht mehr: Die Beschriftungen standen inline neben ihren Feldern, während
		«Bezeichnung» und «Bemerkung» daneben gestapelt waren — zwei Feldarten auf
		einer Seite. Gemeldet am 11.08.2026: «Datum, Zeit und Ort sind anders
		dargestellt als das Suchfeld.» Jetzt sind alle Felder Kinder von `.felder`
		und stehen in denselben Spuren wie überall sonst.
	-->
	<div class="felder">
		{#if art === 'gemeinsam'}
			<label class="voll">
				Bezeichnung
				<input
					name="bezeichnung"
					required
					minlength="2"
					maxlength="200"
					{...anfangswert(werte?.bezeichnung ?? '')}
					placeholder="Mit- und Stockwerkeigentümerversammlung Musterhof"
				/>
				<span class="hilfe">So steht sie in der Liste und auf der Tafel im Saal.</span>
			</label>
		{/if}
		<!--
			**Ein Tag in der Vergangenheit ist erlaubt und selten gemeint**
			(23.08.2026, Prüflauf II, B-02). Nachtragen kommt vor — eine Versammlung,
			die stattgefunden hat und erst jetzt erfasst wird. Deshalb keine Sperre.

			Aber die Folge ist unsichtbar: Die Stimmberechtigten werden auf den
			Versammlungstag gerechnet, und Zuordnungen, die erst später gelten, gibt
			es an jenem Tag nicht. Im Prüflauf stand danach «16 Einheiten ohne
			Eigentümer am Versammlungstag» — zwei Klicks weiter, auf einer anderen
			Seite. Wer seine Anlage eben erfasst hat, liest dort, sie sei leer.
		-->
		<label>
			Tag
			<input
				type="date"
				name="datum"
				required
				bind:value={tag}
				{...anfangswert(werte?.datum ?? data.heute)}
			/>
			{#if tag && tag < data.heute}
				<span class="hilfe vergangen">
					Dieser Tag liegt in der Vergangenheit. Das geht — die Stimmberechtigten werden dann
					aber auf jenen Tag gerechnet: Wer erst später Eigentümer wurde, zählt nicht mit, und
					seine Einheit steht als «ohne Eigentümer» da.
				</span>
			{/if}
		</label>
		<label>
			Beginn
			<input type="time" name="uhrzeit" required {...anfangswert(werte?.uhrzeit ?? '19:00')} />
		</label>
		<label class="breit">
			Ort
			<input
				name="ort"
				required
				minlength="2"
				{...anfangswert(werte?.ort ?? ortsvorschlag)}
				placeholder="Saal, Musterweg 1, 3000 Bern"
			/>
			<!--
				Platzhalter erfunden und kürzer (06.10.2026, UI-Durchgang): Der
				bisherige war eine echte Adresse und bei 390 px abgeschnitten, 357 px
				Text in 335 px Feld. «Gemeinschaftsraum, Musterweg 1, 3000 Bern» mass
				331 px, zu knapp für ein schmaleres Telefon.
			-->
		</label>
		{#if art === 'gemeinsam'}
			<label class="voll">
				Bemerkung
				<input name="bemerkung" {...anfangswert(werte?.bemerkung ?? '')} />
			</label>
		{/if}
	</div>

	<!--
		**Die Art gehört hierher, nicht auf sechs Folgeseiten.**
		Ob ordentlich oder ausserordentlich, gilt für den ganzen Anlass — bei einer
		gemeinsamen Versammlung für alle Häuser zugleich. Sie danach je Versammlung
		einzeln umzustellen hiess bei sechs Gemeinschaften sechsmal dasselbe
		einzutippen (gemeldet am 11.08.2026).
	-->
	<h2 class="abschnitt">Was für eine Versammlung?</h2>
	<div class="wahlen">
		<label class="wahl">
			<input type="radio" name="versammlungsart" value="ordentlich" bind:group={versammlungsart} />
			<span>
				<strong>Die jährliche Versammlung (ordentlich)</strong>
				<span class="hilfe">Die immer gleichen Geschäfte entstehen von selbst.</span>
			</span>
		</label>
		<label class="wahl">
			<input
				type="radio"
				name="versammlungsart"
				value="ausserordentlich"
				bind:group={versammlungsart}
			/>
			<span>
				<strong>Aus einem besonderen Anlass (ausserordentlich)</strong>
				<span class="hilfe">Der Anlass gehört in die Einladung.</span>
			</span>
		</label>
		{#if versammlungsart === 'ausserordentlich'}
			<label class="eingerueckt">
				Anlass
				<input
					name="anlass"
					required
					maxlength="200"
					{...anfangswert(werte?.anlass ?? '')}
					placeholder="Sanierung Steigleitungen"
				/>
				<span class="hilfe">Er gehört in die Einladung und ins Protokoll.</span>
			</label>
		{/if}
	</div>

	<details class="erklaerung">
		<summary>Was heisst das?</summary>
		<p>
			{#if art === 'gemeinsam'}
				Tag, Beginn, Ort und die Art gelten für alle angekreuzten Gemeinschaften. Ändert sich
				später eines davon, ändern Sie es einmal bei der gemeinsamen Versammlung und übernehmen
				es von dort auf alle.
			{:else}
				Mehr braucht es zum Anlegen nicht.
			{/if}
			Ob es die erste oder die zweite Versammlung nach ZGB Art. 712p ist und wie abgestimmt wird,
			steht danach auf der Seite der Versammlung und lässt sich dort ändern, solange sie im
			Entwurf ist.
		</p>
	</details>
</form>

<div class="abschluss">
	<button type="submit" form="anlegen" class="haupt">{knopf}</button>
	<a href="/versammlungen">Abbrechen</a>
	<Ungespeichert formular="anlegen" />
</div>

<style>
	/* Der Grund steht in Warnfarbe, damit er nicht wie eine Adresse aussieht. */
	.klammer {
		display: block;
		color: var(--warnung);
	}

	.pfad {
		margin: 0 0 0.25rem;
		font-size: 0.9rem;
	}

	.abschnitt {
		font-size: 1rem;
		font-weight: 600;
		margin: 1.5rem 0 0.6rem;
	}

	.meldung {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		margin: 0 0 1rem;
		max-width: var(--lesebreite);
		padding: 0.75rem 1rem;
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}

	/* Die Wahl als Karte: gleiche Höhe, Frage oben, Antwort in einem Satz. */
	.wahlkarte {
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		height: 100%;
		padding: 1rem 1.1rem;
	}

	.wahlkarte.gewaehlt {
		border-color: var(--akzent);
		box-shadow: inset 0 0 0 1px var(--akzent);
	}

	.kopf {
		align-items: center;
		display: flex;
		gap: 0.6rem;
	}

	.antwort {
		font-size: 1.05rem;
	}

	.zusatz,
	.erklaerung,
	.hilfe,
	.leer {
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.wahlkarte .erklaerung {
		margin-top: auto;
		padding-top: 0.35rem;
	}

	.auswahl {
		display: grid;
		gap: 0.25rem;
		grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
		list-style: none;
		margin: 0 0 0.75rem;
		max-height: 24rem;
		overflow-y: auto;
		padding: 0;
	}

	.auswahl label {
		align-items: center;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		cursor: pointer;
		display: flex;
		/* Sonst bricht das Kästchen über den Namen — geerbtes flex-wrap. */
		flex-wrap: nowrap;
		gap: 0.6rem;
		min-height: var(--ziel-min);
		padding: 0.4rem 0.7rem;
	}

	.auswahl .hilfe {
		display: block;
	}

	details.erklaerung {
		margin-top: 0.75rem;
		max-width: var(--lesebreite);
	}

	details.erklaerung summary {
		cursor: pointer;
	}

	details.erklaerung p {
		margin: 0.4rem 0 0;
	}

	.abschluss {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 1.25rem;
	}
</style>
