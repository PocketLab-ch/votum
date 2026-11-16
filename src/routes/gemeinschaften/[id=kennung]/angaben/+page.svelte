<script lang="ts">
	import GemeinschaftFormular from '$lib/components/GemeinschaftFormular.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Meldung from '$lib/components/Meldung.svelte';
	import { datumLang, tagVon } from '$lib/domain/datum';
	import { anfangswert } from '$lib/felder';

	let { data, form } = $props();


	/*
	 * **Zwei Gruppen, zwei Sätze** (25.08.2026, dritte Reviewrunde). Was unter
	 * dieser Gemeinschaft steht, geht mit ins Archiv und kommt mit zurück — was
	 * aber schon vorher einzeln archiviert wurde, bleibt dort. Ein Satz über
	 * beide wäre für die zweite Gruppe zweimal falsch.
	 */
	const gehenMit = $derived(data.untergemeinschaften.filter((g) => !g.schonEinzeln));
	const schonEinzeln = $derived(data.untergemeinschaften.filter((g) => g.schonEinzeln));
	const namen = (liste: { name: string }[]) => liste.map((g) => g.name).join(', ');
</script>

<h1>Angaben der Gemeinschaft</h1>
<p class="lesebreite hinweis">
	Bezeichnung, Adresse, Wertquotennenner und Zählweise. Änderungen hier wirken auf künftige
	Versammlungen; bereits freigegebene tragen ihren eigenen, eingefrorenen Stand.
</p>

{#if form?.gespeichert}
	<p class="gespeichert" role="status">
		Gespeichert.
		{#if form.veraltet === null}
			Ob Traktanden noch ein älteres Erfordernis tragen, liess sich nicht feststellen. Prüfen Sie
			die Erfordernisse vor der Versammlung in der Traktandenliste.
		{:else if form.veraltet}
			{#if form.veraltet === 1}
				Ein Traktandum wird weiter nach dem bisherigen Erfordernis gezählt, bis Sie es nachziehen.
			{:else}
				{form.veraltet} Traktanden werden weiter nach dem bisherigen Erfordernis gezählt, bis Sie sie
				nachziehen.
			{/if}
			<a href="/gemeinschaften/{data.gemeinschaft.id}/reglement"
				>Vor der Versammlung auf der Reglementsseite prüfen</a
			>
		{/if}
	</p>
{/if}

<GemeinschaftFormular
	moeglicheEltern={data.moeglicheEltern}
	fehler={form?.quelle === 'speichern' ? form.fehler : null}
	werte={form?.werte ?? {
		name: data.gemeinschaft.name,
		strasse: data.gemeinschaft.strasse ?? '',
		plz: data.gemeinschaft.plz ?? '',
		ort: data.gemeinschaft.ort ?? '',
		quotaDenominator: data.gemeinschaft.quotaDenominator,
		headCountMode: data.gemeinschaft.headCountMode,
		headCountRuleSource: data.gemeinschaft.headCountRuleSource ?? '',
		parkingCountsAsHead: data.gemeinschaft.parkingCountsAsHead,
		tieBreak: data.gemeinschaft.tieBreak ?? 'keiner',
		tieBreakRuleSource: data.gemeinschaft.tieBreakRuleSource ?? '',
		abstentionExcluded: data.gemeinschaft.abstentionExcluded ?? false,
		abstentionExcludedSource: data.gemeinschaft.abstentionExcludedSource ?? '',
		proxyLimit: data.gemeinschaft.proxyLimit ?? '',
		proxyLimitRuleSource: data.gemeinschaft.proxyLimitRuleSource ?? '',
		proxyByAccess: data.gemeinschaft.proxyByAccess ?? false,
		proxyByAccessSource: data.gemeinschaft.proxyByAccessSource ?? '',
		aiEnabled: data.gemeinschaft.aiEnabled ?? false,
		aiDisabledFunctions: data.gemeinschaft.aiDisabledFunctions ?? [],
		parentStwegId: data.gemeinschaft.parentStwegId ?? '',
		traegerschaft: data.gemeinschaft.traegerschaft ?? ''
	}}
	mitHaeusern={data.mitHaeusern}
	beschriftungKnopf="Speichern"
	aktion="?/speichern"
/>

<!-- ── Archiv ─────────────────────────────────────────────────────────────── -->
<!--
	**Über dem Entfernen**, weil es der mildere Weg ist: Entfernen geht nur,
	solange nichts daran hängt, und ist endgültig; Archivieren geht immer und
	nimmt nichts weg. Wer beides nebeneinander liest, wählt in aller Regel das
	Archiv.
-->
<section class="archiv">
	<h2>Archiv</h2>
	{#if form?.quelle === 'archiv' && form?.fehler}
		<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
	{:else if form?.quelle === 'archiv' && form?.hinweis}
		<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
	{/if}

	{#if data.imArchivWegen}
		<!--
			**Ein Haus in einer archivierten Gruppe hat hier keinen Knopf** (Auftraggeber,
			25.08.2026). Die Gruppe geht gemeinsam ins Archiv und kommt gemeinsam
			zurück; ein Knopf, der ein Haus einzeln herauszöge, widerspräche dem.
			Stattdessen steht hier, wer es mitgenommen hat — und der Weg dorthin.
		-->
		<p class="lesebreite">
			<strong>
				Im Archiv{#if data.imArchivWegen.seit}
					seit {datumLang(tagVon(data.imArchivWegen.seit))}{/if}, weil
				«{data.imArchivWegen.name}» archiviert ist.
			</strong>
			Die Gruppe hängt zusammen: Sie ist gemeinsam hineingegangen und kommt gemeinsam
			zurück.
		</p>
		<p class="lesebreite">
			<a href="/gemeinschaften/{data.imArchivWegen.id}/angaben">
				Zu «{data.imArchivWegen.name}» — dort steht der Weg zurück
			</a>
		</p>
	{:else if data.gemeinschaft.archiviertAm}
		<p class="lesebreite">
			<strong>Im Archiv seit {datumLang(tagVon(data.gemeinschaft.archiviertAm))}.</strong>
			{#if data.gemeinschaft.archivnotiz}{' '}{data.gemeinschaft.archivnotiz}{/if}
			Sie erscheint nicht in Auswahl und Suche; ihre Versammlungen ebenso wenig. Verlauf,
			Protokolle und Siegel bleiben unverändert abrufbar.
			{#if gehenMit.length > 0}
				Mit ihr {gehenMit.length === 1 ? 'liegt' : 'liegen'}
				{gehenMit.length === 1 ? 'eine Gemeinschaft' : `${gehenMit.length} Gemeinschaften`} im
				Archiv: {namen(gehenMit)}. Das Hervorholen bringt sie mit zurück.
			{/if}
			{#if schonEinzeln.length > 0}
				{namen(schonEinzeln)}
				{schonEinzeln.length === 1 ? 'lag' : 'lagen'} schon vorher einzeln im Archiv und
				{schonEinzeln.length === 1 ? 'bleibt' : 'bleiben'} dort.
			{/if}
		</p>
		<form method="POST" action="?/hervorholen">
			<button type="submit">Aus dem Archiv holen</button>
		</form>
	{:else}
		<p class="lesebreite">
			Archivieren nimmt <strong>nichts</strong> weg: Die Gemeinschaft bleibt mit allem, was
			an ihr hängt. Sie erscheint nur nicht mehr dort, wo man <em>auswählt</em> und
			<em>sucht</em> — Gemeinschaftsliste, Startseite, Elternwahl, Zuordnung zum Abend. Wo
			<em>nachgeschlagen</em> wird, bleibt sie sichtbar: Verlauf, Protokoll, Personenseite.
			Ihre Versammlungen gehen mit ins Archiv.
		</p>
		{#if gehenMit.length > 0 || schonEinzeln.length > 0}
			<!--
				**Was darunter steht, geht mit** (Auftraggeber, 25.08.2026: «Gruppen müssen als
				gesamte Gruppe archiviert und wiederhergestellt werden, weil diese
				zusammenhängen»). Die vorige Fassung liess die Häuser stehen und sagte
				das hier an — fünf Handgriffe für eine Entscheidung, und beim
				Hervorholen noch einmal fünf. Jetzt geht die Gruppe gemeinsam; genannt
				wird sie trotzdem, damit niemand mehr mitnimmt, als er wollte.
			-->
			<p class="warnung lesebreite">
				{#if gehenMit.length > 0}
					{gehenMit.length === 1
						? 'Eine Gemeinschaft steht unter dieser'
						: `${gehenMit.length} Gemeinschaften stehen unter dieser`}: {namen(gehenMit)}.
					{gehenMit.length === 1 ? 'Sie geht' : 'Sie gehen'} mit ins Archiv, samt ihren
					Versammlungen — und {gehenMit.length === 1 ? 'kommt' : 'kommen'} beim Hervorholen
					gemeinsam zurück.
				{/if}
				{#if schonEinzeln.length > 0}
					{namen(schonEinzeln)}
					{schonEinzeln.length === 1 ? 'liegt' : 'liegen'} bereits einzeln im Archiv und
					{schonEinzeln.length === 1 ? 'bleibt' : 'bleiben'} dort, auch wenn Sie diese
					Gemeinschaft wieder hervorholen.
				{/if}
			</p>
		{/if}
		<form method="POST" action="?/archivieren" class="felder">
			<label class="breit">
				Warum (freiwillig)
				<input
					name="notiz"
					maxlength="200"
					placeholder="z. B. Mandat beendet per 31.12.2026"
					{...anfangswert(form?.quelle === 'archiv' ? form.notiz : '')}
				/>
				<span class="hilfe">
					Steht später an der Zeile im Archiv — die erste Frage, die jemand hat, der sie
					dort wiederfindet.
				</span>
			</label>
			<Rueckfrage
				beschriftung="«{data.gemeinschaft.name}» archivieren"
				zeichen="hinaus"
				ton="warnung"
				frage="«{data.gemeinschaft.name}» archivieren?"
				folge="Sie verschwindet aus Auswahl und Suche, ihre Versammlungen ebenso. Nichts wird gelöscht, und Sie können sie jederzeit wieder hervorholen."
				bestaetigen="Archivieren"
			/>
		</form>
	{/if}
</section>

<!-- ── Entfernen ──────────────────────────────────────────────────────────── -->
<!--
	Ganz unten und optisch zurückgenommen: Es ist die eine Handlung dieser Seite,
	die sich nicht zurücknehmen lässt. Die Rückfrage nennt den Namen, damit nicht
	die falsche Gemeinschaft erwischt wird — auf einer Liste gleichnamiger Häuser
	ist das keine ferne Möglichkeit.
-->
<section class="entfernen">
	<h2>Gemeinschaft entfernen</h2>
	<!-- Nur der Fehler DIESER Handlung; das Formular oben zeigt seinen eigenen. -->
	{#if form?.quelle === 'entfernen' && form?.fehler}
		<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
	{/if}
	<!--
		**Der Grund steht vor dem Knopf, nicht dahinter** (Auftraggeber, 15.09.2026).

		Bis hierher stand hier immer die Regel («möglich, solange nichts daran
		hängt»), und ob sie im konkreten Fall erfüllt ist, erfuhr man erst nach der
		Rückfrage «Endgültig entfernen?». Jetzt sagt die Seite es vorher — und wenn
		etwas dranhängt, sagt sie **was**.
	-->
	{#if data.entfernungshindernis}
		<p class="lesebreite haengt">{data.entfernungshindernis.nachricht}</p>
	{:else}
		<p class="lesebreite">
			Möglich, solange nichts daran hängt: keine Versammlung, keine
			Untergemeinschaft, keine Zuordnung als Eigentümerin. Einheiten, Eigentümer
			und das hinterlegte Reglement gehen mit. <strong>Der Verlauf bleibt</strong>
			— er ist nur anfügbar, und ein Nachweis, den das Löschen mitnimmt, wäre keiner.
		</p>
	{/if}
	<form method="POST" action="?/entfernen">
		<Rueckfrage
			beschriftung="«{data.gemeinschaft.name}» entfernen"
			zeichen="kreuz"
			ton="fehler"
			frage="«{data.gemeinschaft.name}» entfernen?"
			folge="Einheiten, Eigentümer und das hinterlegte Reglement gehen mit. Das lässt sich nicht rückgängig machen."
			bestaetigen="Endgültig entfernen"
			gesperrt={Boolean(data.entfernungshindernis)}
		/>
		<!--
			**Hier stand einmal eine zweite, kurze Begründung** (aus dem Code-Review,
			15.09.2026). Sie sollte Vorlesehilfen erreichen, die einen gesperrten
			Knopf überspringen — das konnte sie nicht: Ein Absatz hinter dem Knopf
			ist genauso lose wie einer davor, tragend wäre `aria-describedby`
			gewesen. Und sie sprach immer im Plural, während der Satz oben beugt:
			«hat eine Versammlung» über «Es hängen Versammlungen daran».

			Zwei Begründungen, von denen eine ihr Versprechen nicht hält, sind
			schlechter als eine, die es hält. Der Satz oben steht unmittelbar vor
			dem Knopf und nennt Zahl, Namen und Ausweg.
		-->
	</form>
</section>

<style>
	/*
	 * **Eine Klasse ohne Stil ist eine Rückmeldung, die niemand sieht**
	 * (docs/gestaltung.md). `warnung` gibt es global nur als Farbvariable und als
	 * Ton an `.handlung` — hier steht sie an einem Absatz und braucht deshalb
	 * ihren eigenen Stil.
	 */
	.warnung {
		color: var(--warnung);
		border-left: 3px solid var(--warnung);
		padding-left: 0.75rem;
	}

	.hinweis {
		color: var(--text-leise);
		margin-top: -0.25rem;
	}

	.gespeichert {
		padding: 0.6rem 0.75rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
		max-width: var(--lesebreite);
	}

	.entfernen {
		margin-top: 2.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--linie);
	}

	.entfernen h2 {
		font-size: 1rem;
		color: var(--text-leise);
	}

	/*
	 * Der konkrete Grund, warum es gerade nicht geht — dieselbe Auszeichnung wie
	 * `.warnung` oben, aber mit eigenem Namen: Das hier ist keine Warnung vor
	 * einer Folge, sondern die Auskunft, dass die Handlung nicht offensteht.
	 */
	.haengt {
		color: var(--warnung);
		border-left: 3px solid var(--warnung);
		padding-left: 0.75rem;
	}
</style>
