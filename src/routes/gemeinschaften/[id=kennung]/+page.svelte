<script lang="ts">
	import { datumLang } from '$lib/domain/datum';
	import { ohneEigeneQuote } from '$lib/domain/einheiten';
	import { stichentscheidInWorten, zaehlweiseInWorten } from '$lib/domain/gemeinschaft';
	import { zustandsname } from '$lib/domain/versammlung';

	let { data } = $props();

	const g = $derived(data.gemeinschaft);
	const k = $derived(data.kennzahlen);
	/**
	 * Die Klammer über mehreren Häusern — erkennbar am fehlenden eigenen Nenner.
	 * Für sie gilt fast alles auf dieser Seite anders: Sie hat keine Einheiten
	 * zu erfassen, keine Quoten, die aufgehen müssten, und keine Zählweise.
	 */
	const klammer = $derived(ohneEigeneQuote(g) && data.untergemeinschaften.length > 0);

	const zaehlweise = $derived(
		zaehlweiseInWorten(g.headCountMode, g.parkingCountsAsHead, g.headCountRuleSource ?? null)
	);
	const stichentscheid = $derived(
		stichentscheidInWorten(g.tieBreak ?? 'keiner', g.tieBreakRuleSource ?? null)
	);

	/** Was der Führung im Weg steht. Leer ist die beste Antwort. */
	const warnungen = $derived.by(() => {
		const aus: { satz: string; pfad: string }[] = [];
		// Bei einer Klammer ist «keine Einheit» kein Mangel, sondern die Bauform.
		// Der Kasten weiter unten erklärt sie; hier stünde sonst ein roter Punkt,
		// der nie grün wird (A-01, A-20).
		if (klammer) return aus;
		if (k.einheiten === 0) {
			aus.push({
				satz: 'Noch keine Einheit erfasst — ohne sie lässt sich nichts zählen.',
				pfad: `/gemeinschaften/${g.id}/einheiten`
			});
		} else if (!data.quotenGehenAuf) {
			aus.push({
				satz: `Der Wertquotensaldo geht nicht auf: ${k.wertquote} von ${k.nenner}.`,
				pfad: `/gemeinschaften/${g.id}/einheiten`
			});
		}
		const ohne = data.einheitenOhneEigentuemer.length;
		if (ohne > 0) {
			aus.push({
				satz:
					ohne === 1
						? '1 Einheit ohne Eigentümer — sie fehlt in jeder Zählung.'
						: `${ohne} Einheiten ohne Eigentümer — sie fehlen in jeder Zählung.`,
				pfad: `/gemeinschaften/${g.id}/eigentuemer`
			});
		}
		return aus;
	});
</script>

<h1>{g.name}</h1>
{#if g.strasse || g.plz || g.ort}
	<p class="anschrift">
		{[g.strasse, [g.plz, g.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
	</p>
{/if}

<!--
	Das Kennzahlenband beantwortet die Frage, die das alte Formular offenliess:
	Womit habe ich es hier zu tun? Vier Zahlen, keine Erklärung nötig.
-->
{#if klammer}
	<!--
		**Vier Nullen sagten das Falsche** (23.08.2026, A-01). «Einheiten 0 ·
		Kopfstimmen 0 · Wertquoten 0/0 · Eigentümer 0» las sich wie ein
		Rechenfehler — dreissig Einheiten hingen in zwei Häusern darunter. Die
		Zahlen stimmten, nur zählte niemand sie so.

		Was hier steht, ist wahr und nützlich: welche Häuser darunter hängen und
		wie weit sie sind. Summiert wird nichts; eine Gruppe rechnet nicht über
		ihre Häuser, und eine Zahl «30 Einheiten» wäre eine Stimmkraft, die es
		rechtlich nicht gibt.
	-->
	<ul class="haeuser">
		{#each data.untergemeinschaften as u (u.id)}
			<li>
				<a href="/gemeinschaften/{u.id}">{u.name}</a>
				<!--
					**Die Kennzeichnung, die der Kommentar im Serverteil versprach**
					(25.08.2026, aus dem Code-Review). Sie fehlte: Ein archiviertes Haus
					stand unter seiner Klammer wie jedes andere, obwohl es aus jeder
					Liste verschwunden war. Es steht hier mit Absicht — es trägt weiter
					seinen Anteil am Nenner —, aber es soll zu sehen sein.
				-->
				{#if u.archiviertAm}
					<span class="archivmarke">archiviert</span>
				{/if}
				<span class="stand">
					{u.einheiten}
					{u.einheiten === 1 ? 'Einheit' : 'Einheiten'} ·
					{#if u.einheiten === 0}
						noch keine erfasst
					{:else if u.quotenGehenAuf}
						Wertquoten gehen auf
					{:else}
						<strong>Wertquoten gehen nicht auf</strong>
					{/if}
				</span>
			</li>
		{/each}
	</ul>
{:else}
	<dl class="kennzahlen">
		<div>
			<dt>Einheiten</dt>
			<dd>{k.einheiten}</dd>
		</div>
		<div>
			<dt>Kopfstimmen</dt>
			<dd>{k.kopfstimmen}</dd>
		</div>
		<div>
			<!--
				**Zwei Bedeutungen, eine Beschriftung** (23.08.2026, Prüflauf II,
				A-37). Die Kachel zeigt die Summe der ZUGEORDNETEN Wertquoten, die
				Einheitenseite die der ERFASSTEN. Solange kein Eigentümer zugeordnet
				war, sagte die eine «0 von 1000, geht nicht auf» und die andere im
				selben Augenblick «990 von 1000» — beide richtig, keine verständlich.

				Die Kachel heisst jetzt nach dem, was sie zählt, und nennt die
				Erfassung nur, wenn beide auseinandergehen. Stimmen sie überein — der
				Normalfall —, bleibt es bei einer Zahl.
			-->
			<dt>{k.wertquote === k.wertquoteErfasst ? 'Wertquoten' : 'Wertquoten zugeordnet'}</dt>
			<dd class:fehlt={!data.quotenGehenAuf}>{k.wertquote}<span class="von">/{k.nenner}</span></dd>
			{#if k.wertquote !== k.wertquoteErfasst}
				<p class="nebenzahl">
					{k.wertquoteErfasst} von {k.nenner} erfasst — die Lücke sind Einheiten ohne
					Eigentümer.
				</p>
			{/if}
		</div>
		<div>
			<dt>Eigentümer</dt>
			<dd>{k.eigentuemer}</dd>
		</div>
	</dl>
{/if}

{#if warnungen.length > 0}
	<section class="offen" aria-label="Offene Punkte">
		{#each warnungen as w (w.pfad + w.satz)}
			<p><a href={w.pfad}>{w.satz}</a></p>
		{/each}
	</section>
{/if}

<div class="spalten">
	<section class="karte">
		<h2>Versammlungen</h2>
		{#if data.laufende}
			<p class="marke laufend">Läuft gerade</p>
			<p class="wann">Versammlung vom {datumLang(data.laufende.datum)}</p>
			<p class="wo">{data.laufende.uhrzeit} Uhr · {data.laufende.ort}</p>
			<p class="tun">
				<a class="knopf haupt" href="/versammlungen/{data.laufende.id}/leitung">
					Zur Sitzungsleitung
				</a>
			</p>
		{:else if data.anstehende}
			<p class="marke">{zustandsname(data.anstehende.zustand)}</p>
			<p class="wann">Versammlung vom {datumLang(data.anstehende.datum)}</p>
			<p class="wo">{data.anstehende.uhrzeit} Uhr · {data.anstehende.ort}</p>
			<p class="tun">
				<a class="knopf haupt" href="/versammlungen/{data.anstehende.id}">Zur Vorbereitung</a>
			</p>
		{:else}
			<p class="leer">Keine Versammlung steht an.</p>
			{#if klammer}
				<!--
					**Der Knopf führte in eine Sackgasse** (23.08.2026, A-21). Eine
					Klammer ohne eigene Anteile hat keine Stimmberechtigten; das
					Formular erschien trotzdem, und wer es ausfüllte, bekam eine
					Versammlung, an der niemand teilnehmen kann.

					Der Weg für sie ist der gemeinsame Abend: Er klammert je eine
					Versammlung pro Haus, und dort sitzen die Eigentümer.
				-->
				<p class="tun">
					<a class="knopf haupt" href="/versammlungen/neu">Gemeinsamen Abend anlegen</a>
				</p>
				<p class="klein">
					Beide Häuser am selben Abend, ein Protokoll — jede Gemeinschaft genehmigt den
					sie betreffenden Teil.
				</p>
			{:else}
				<p class="tun">
					<a class="knopf haupt" href="/gemeinschaften/{g.id}/versammlungen/neu">Neue Versammlung</a>
				</p>
			{/if}
		{/if}
		{#if data.anzahlVersammlungen > 0}
			<p class="klein">
				<a href="/gemeinschaften/{g.id}/historie">
					{data.anzahlVersammlungen}
					{data.anzahlVersammlungen === 1 ? 'Versammlung' : 'Versammlungen'} in der Historie
				</a>
			</p>
		{/if}
	</section>

	<section class="karte">
		<h2>{klammer ? 'Was hier gilt' : 'So wird gezählt'}</h2>
		<!--
			Die Zählweise steht hier und nicht im Formular versteckt: Dieselben
			Stimmen ergeben je nach Zählweise Annahme oder Ablehnung. Wer die
			Gemeinschaft öffnet, soll es sehen, ohne danach zu suchen.
		-->
		{#if klammer}
			<!--
				**Eine Voreinstellung, die niemand gewählt hat** (23.08.2026, A-18).
				Hier stand «Gezählt wird eine Kopfstimme je Eigentümer — die
				gesetzliche Auffangregel», obwohl das Anlegeformular ausdrücklich
				sagt, für eine übergeordnete Gemeinschaft entfalle die Zählweise und
				«es gibt bewusst keine Voreinstellung». Wer hier las, hielt eine
				Angabe für gesetzt, die er nie gemacht hatte.
			-->
			<p>Diese Gemeinschaft zählt selbst nicht. Gezählt wird in den Häusern darunter.</p>
		{:else}
			<p>{zaehlweise}</p>
			{#if stichentscheid}
				<p>{stichentscheid}</p>
			{/if}
			{#if g.abstentionExcluded}
				<p>
					Enthaltungen zählen beim einfachen Mehr nicht mit ({g.abstentionExcludedSource}).
				</p>
			{/if}
		{/if}
		{#if g.parentStwegId}
			<p class="klein">Untergemeinschaft — die Wertquoten werden auf beiden Ebenen geprüft.</p>
		{/if}
		<!--
			**Eine Gruppe ohne eigene Anteile sieht aus wie eine leere** (23.08.2026,
			Prüflauf II). Im Prüflauf hingen dreissig Einheiten in zwei Häusern
			darunter, und die Übersicht zeigte 0 Einheiten, 0 Kopfstimmen, 0
			Wertquoten. Der Verwalter hielt es für einen Rechenfehler.

			Es ist keiner: Eine Miteigentümergemeinschaft über zwei
			Stockwerkeigentumsgemeinschaften hat ihre EIGENEN Anteile — die Häuser
			sind ihre Miteigentümer, mit je einem Anteil an Umgebung, Zufahrt und
			Tiefgarage. Die Summe aller Wohnungen wäre etwas anderes und ergäbe eine
			Stimmkraft, die es rechtlich nicht gibt.

			Gesagt hat das bisher niemand. Der Satz steht nur, wo er zutrifft:
			Untergemeinschaften vorhanden, eigene Einheiten keine.
		-->
		{#if klammer}
			<p class="lesebreite">
				Die Einheiten der Häuser zählen hier <strong>nicht</strong> mit — ihre Summe
				wäre eine Stimmkraft, die es rechtlich nicht gibt. Für gemeinsame Geschäfte
				gibt es zwei Wege, und beide sind zulässig:
			</p>
			<ul class="wege lesebreite">
				<li>
					<strong>Ein gemeinsamer Abend.</strong> Beide Häuser tagen am selben Abend unter
					einer Klammer; jedes stimmt für sich ab, das Protokoll ist eines. So braucht
					diese Gemeinschaft keine eigenen Anteile.
				</li>
				<li>
					<strong>Eigene Anteile.</strong> Je ein Miteigentumsanteil pro Haus an dem, was
					allen gehört (Umgebung, Zufahrt, Tiefgarage). Dann tagt sie selbst, und ihre
					Stimmberechtigten sind die Häuser — nicht deren Eigentümer. Dafür braucht sie
					zuerst einen eigenen Nenner unter
					<a href="/gemeinschaften/{g.id}/angaben">Angaben der Gemeinschaft</a>.
				</li>
			</ul>
		{/if}
		<!--
			**Was für diese Gemeinschaft gilt, an einer Stelle** (23.08.2026,
			Prüflauf I, A-11). Zählweise und Stichentscheid standen hier, die
			Vollmachtsgrenze, die Beschlussfähigkeitsregel und die Quorenabweichungen
			auf drei weiteren Seiten: «Heute muss ich vier Seiten einzeln aufsuchen,
			um zu wissen, was ich vor elf Minuten selbst eingestellt habe.»

			Die Karte sagt, DASS es die Regeln gibt und wo sie stehen — nicht, was
			sie im Einzelnen bestimmen. Das gehört auf ihre eigene Seite; hier
			stünden fünf Absätze, die niemand am Stück liest.
		-->
		<dl class="gilt">
			<div>
				<dt>Vollmachten</dt>
				<dd>
					{#if g.proxyLimit}
						höchstens {g.proxyLimit} je Person{g.proxyLimitRuleSource
							? ` (${g.proxyLimitRuleSource})`
							: ''}
					{:else}
						ohne zahlenmässige Grenze
					{/if}
				</dd>
			</div>
			<div>
				<dt>Beschlussfähigkeit</dt>
				<dd>
					{#if data.regelwerk.anwesenheitsregeln > 0}
						eigene Regel für {data.regelwerk.anwesenheitsregeln === 1
							? 'eine Stufe'
							: 'beide Stufen'}
					{:else}
						nach Gesetz (ZGB Art. 712p)
					{/if}
				</dd>
			</div>
			<div>
				<dt>Quoren</dt>
				<dd>
					{#if data.regelwerk.quorenabweichungen > 0}
						{data.regelwerk.quorenabweichungen}
						{data.regelwerk.quorenabweichungen === 1 ? 'Abweichung' : 'Abweichungen'} hinterlegt
					{:else}
						durchgehend nach Gesetz
					{/if}
				</dd>
			</div>
		</dl>

		<p class="klein">
			<a href="/gemeinschaften/{g.id}/angaben">Angaben ändern</a> ·
			<a href="/gemeinschaften/{g.id}/reglement">Reglement und Quoren</a> ·
			<a href="/gemeinschaften/{g.id}/lesarten">Lesarten</a> ·
			<a href="/gemeinschaften/{g.id}/beschlussfaehigkeit">Beschlussfähigkeit</a>
		</p>
	</section>
</div>

<style>
	h1 {
		margin-bottom: 0.15rem;
	}

	.anschrift {
		margin: 0 0 1.25rem;
		color: var(--text-leise);
	}

	/*
		Die Häuser einer Klammer stehen als Liste, nicht als Kennzahlenband: Es
		sind Namen, keine Zahlen, und sie führen weiter. Dieselben Kanten und
		Flächen wie die Kacheln daneben, damit die Seite eine bleibt.
	*/
	.haeuser {
		list-style: none;
		margin: 0 0 1.25rem;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.haeuser li {
		flex: 1 1 16rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.7rem 0.9rem;
	}

	.haeuser a {
		font-weight: 650;
		font-size: 1.1rem;
	}

	.haeuser .stand {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	/* Drei Zeilen, jede eine Frage und ihre Antwort — keine Kacheln: Es sind
	   Angaben, keine Kennzahlen. */
	.gilt {
		margin: 0.6rem 0 0;
	}

	.gilt > div {
		display: flex;
		gap: 0.5rem;
		padding: 0.2rem 0;
	}

	.gilt dt {
		flex: 0 0 9rem;
	}

	.gilt dd {
		margin: 0;
		font-size: 1rem;
		font-weight: 400;
	}

	.wege {
		margin: 0.6rem 0 0;
		padding-left: 1.1rem;
	}

	.wege li + li {
		margin-top: 0.5rem;
	}

	.kennzahlen {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 0 0 1.25rem;
	}

	.kennzahlen > div {
		flex: 1 1 8rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.7rem 0.9rem;
	}

	dt {
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	dd {
		margin: 0.1rem 0 0;
		font-size: 1.75rem;
		font-weight: 650;
		line-height: 1.15;
		font-variant-numeric: tabular-nums;
	}

	.nebenzahl {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		line-height: 1.2;
		color: var(--text-leise);
	}

	.von {
		font-size: 1rem;
		font-weight: 400;
		color: var(--text-leise);
	}

	/* Kein Zustand nur über Farbe: Der Satz im Kasten darunter sagt dasselbe. */
	dd.fehlt {
		color: var(--fehler);
	}

	.offen {
		border: 1px solid var(--fehler);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--fehler) 8%, transparent);
		padding: 0.75rem 1rem;
		margin-bottom: 1.25rem;
		max-width: var(--lesebreite);
	}

	.offen p {
		margin: 0.25rem 0;
	}

	.spalten {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
		align-items: start;
	}

	.karte {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
	}

	.karte h2 {
		margin: 0 0 0.6rem;
		font-size: 1.05rem;
	}

	.karte p {
		margin: 0 0 0.5rem;
	}

	.marke {
		display: inline-block;
		font-size: 0.8rem;
		padding: 0.1rem 0.6rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		color: var(--text-leise);
	}

	.marke.laufend {
		background: color-mix(in srgb, var(--akzent) 25%, transparent);
		color: var(--text);
		font-weight: 550;
	}

	.wann {
		font-weight: 600;
	}

	.wo,
	.leer,
	.klein {
		color: var(--text-leise);
	}

	.klein {
		font-size: 0.875rem;
		margin-bottom: 0;
	}

	.tun {
		margin-top: 0.75rem;
	}

	.knopf {
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
		padding: 0 1.1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: inherit;
		text-decoration: none;
		font-weight: 550;
	}

	.knopf.haupt {
		border-color: var(--akzent);
		background: var(--akzent);
		color: var(--akzent-text);
	}
</style>
