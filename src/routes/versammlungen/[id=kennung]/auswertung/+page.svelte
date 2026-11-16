<script lang="ts">
	import {
		andereLesartenVon,
		andereLesartInWorten,
		zustimmungBetroffenerGefragt,
		zweitesErgebnisImProtokoll
	} from '$lib/domain/auszaehlung';
	import {
		ausstehendeNamen,
		ergebnislage,
		imAusstandInWorten,
		stimmtNichtInWorten,
		zustimmungImSaalOderVorabInWorten
	} from '$lib/domain/auszaehlung';
	import { ersetzungInKuerze } from '$lib/domain/folgeantragsersetzung';
	import {
		AUSWERTUNG_VON_HAND_ABGESTIMMT,
		einwandInDerAuswertung,
		ergebnissatzDerAuswertung,
		rueckzugInDerAuswertung
	} from '$lib/domain/protokoll';
	let { data } = $props();

	const v = $derived(data.versammlung);
</script>


<h1>Auswertung</h1>

<!--
	**Keine Einleitung, sondern die Bilanz** (02.09.2026). Der Absatz trug bis
	hierher `class="einleitung"` und gestaltete sie lokal um: grösser statt
	leiser, mit `tabular-nums`. Das ist der Gegensatz dessen, was die Klasse
	seit heute zentral bedeutet — ein Erklärsatz, der zur Überschrift
	zurücktritt. Hier stehen Zahlen, und sie sind die Hauptsache der Seite.
-->
<p class="bilanz">
	{data.angenommen}
	{data.angenommen === 1 ? 'Antrag angenommen' : 'Anträge angenommen'} ·
	{data.abgelehnt}
	{data.abgelehnt === 1 ? 'abgelehnt' : 'abgelehnt'} ·
	{data.ohneAbstimmung} ohne Abstimmung{#if data.mitBeschlussvermerk > 0}{' '}· {data.mitBeschlussvermerk} von Hand abgestimmt{/if}{#if data.keinBeschluss > 0}
		· {data.keinBeschluss} kein Beschluss{/if}{#if data.ohneErgebnis > 0}
		·
		<strong class="offen"
			>{data.ohneErgebnis}
			{data.ohneErgebnis === 1 ? 'ohne Ergebnis' : 'ohne Ergebnis'}</strong
		>{/if}
</p>

<!--
	**Die vierte Zahl steht nur da, wenn sie nicht null ist** (05.09.2026). Ein
	Antrag mit offenem Stichentscheid zählt weder als angenommen noch als
	abgelehnt und auch nicht als «ohne Abstimmung» — abgestimmt wurde, es fehlt
	der Entscheid. Ohne diese Zahl ginge die Rechnung für einen Leser nicht auf:
	Er zählte drei Zahlen zusammen und käme auf weniger Traktanden, als die
	Liste darunter zeigt.
-->
{#if data.ohneErgebnis > 0}
	<p class="hinweis-offen">
		{data.ohneErgebnis === 1 ? 'Ein Antrag wartet' : `${data.ohneErgebnis} Anträge warten`} auf
		einen Stichentscheid. Bis er eingetragen ist, gibt es dort kein Ergebnis — und eine
		ausstehende Entscheidung ist keine Ablehnung.
	</p>
{/if}

{#if data.zaehlweise}
	<p class="zaehlweise">{data.zaehlweise}</p>
{/if}

{#if data.stichentscheid}
	<p class="zaehlweise">{data.stichentscheid}</p>
{/if}

<p class="klein">
	<a href="/versammlungen/{v.id}/auswertung.pdf" target="_blank" rel="noopener">Als PDF öffnen</a>
	— darin steht kein Name im Zusammenhang mit dem Stimmverhalten. Ausgenommen sind unmittelbar
	Betroffene, deren Zustimmung das Gesetz verlangt: Dort ist der Name der Nachweis.
</p>

{#each data.zeilen as z (z.nummer + z.titel)}
	<article
		class="zeile"
		class:angenommen={ergebnislage(z.auszaehlung) === 'angenommen'}
		class:abgelehnt={ergebnislage(z.auszaehlung) === 'abgelehnt'}
		style:--tiefe={z.tiefe}
	>
		<h2>
			<span class="nr">{z.nummer}</span>
			{z.titel}
			<!-- Dieselben Wörter wie in der Sitzungsleitung (06.10.2026, UI-Durchgang):
			     Der Rückkommensantrag hiess hier noch «neu aufgenommen», dort seit
			     längerem «Rückkommen». -->
			{#if z.spontan}<span class="marke leise"
					>{z.spontanart === 'folgeantrag'
						? 'Folgeantrag'
						: z.spontanart === 'rueckkommen'
							? 'Rückkommen'
							: 'neu aufgenommen'}</span
				>{/if}
		</h2>
		<!-- Worauf sich ein nicht angekündigtes Geschäft stützt (Migration 127). -->
		{#if z.ausnahmeVermerk}<p class="klein">{z.ausnahmeVermerk}</p>{/if}

		{#if z.art === 'kenntnisnahme'}
			<p class="klein">Kenntnisnahme — kein Beschluss.</p>
		{:else if !z.auszaehlung}
			<!-- Nach einem Rückkommen über einen Folgeantrag wurde abgestimmt, nur
			     ohne Ergebnis an diesem Traktandum (Soll 6); derselbe Satz wie im PDF. -->
			<p class="klein">
				{z.ersetzung
					? ersetzungInKuerze(z.ersetzung)
					: z.beschlussvermerk
						? AUSWERTUNG_VON_HAND_ABGESTIMMT
						: z.rueckzug
							? rueckzugInDerAuswertung(z.rueckzug, false)
							: 'Es wurde nicht abgestimmt.'}
			</p>
		{:else}
			<!--
				Von Hand festgehalten (`Auszaehlung.vonHand`): kein Erfordernis und kein
				Stimmenspiegel mit Bezugsgrösse, weil gegen keine Schwelle gerechnet
				wurde. Die eingetragenen Zahlen trägt der Satz. Wie im PDF.
			-->
			<!-- Ebenso nach einer konsultativen Abstimmung (Migration 158): Die
			     Auswertung nennt dann kein Erfordernis (`erfordernis` ist null). -->
			{#if !z.auszaehlung.vonHand && z.erfordernis}
				<p class="klein">
					Erfordernis: <strong>{z.erfordernis}</strong>
					{#if z.rechtsgrundlage}({z.rechtsgrundlage}){/if}
				</p>
			{/if}
			<!-- Nach einer konsultativen Abstimmung zurückgezogen: der Rückzug statt des
			     Ergebnissatzes, der das Geschäft offen nennt (Schritt F2), wie im PDF. -->
			<p class="satz">{ergebnissatzDerAuswertung(z)}</p>
			<!-- Die eingewendete Bestimmung, wie im PDF (Entscheid 0047, 3). -->
			{#if z.auszaehlung.vonHand?.einwand?.bestimmung}
				<p class="klein">{einwandInDerAuswertung(z.auszaehlung.vonHand.einwand.bestimmung)}</p>
			{/if}
			<!--
				Derselbe Text wie im PDF derselben Daten (Code-Review 09.09.2026,
				zweiter Durchgang). Ihn nur im PDF zu zeigen wäre dieselbe Halbheit
				wie zuvor beim Hausprotokoll.
			-->
			{#if z.beschlusstext}<p class="klein">{z.beschlusstext}</p>{/if}
			{#if z.ersetzung}<p class="klein">{ersetzungInKuerze(z.ersetzung)}</p>{/if}

			<!--
				Bei geheimer Abstimmung kein Zahlenspiegel (Produktentscheid
				28.09.2026): Der Satz darüber nennt nur erreicht/nicht erreicht.
			-->
			{#if !z.auszaehlung.vonHand && !z.auszaehlung.geheim}
				<dl>
					<div>
						<dt>Kopfstimmen</dt>
						<dd>
							{z.auszaehlung.koepfe.ja} ja · {z.auszaehlung.koepfe.nein} nein ·
							{z.auszaehlung.koepfe.enthaltung} Enthaltung ·
							{z.auszaehlung.koepfe.ohneAbgabe} ohne Abgabe
							{#if z.auszaehlung.koepfe.nichtAnwesend > 0}
								· {z.auszaehlung.koepfe.nichtAnwesend} nicht anwesend
							{/if}
							{#if (z.auszaehlung.koepfe.stimmtNicht ?? 0) > 0}
								· {stimmtNichtInWorten(z.auszaehlung.koepfe.stimmtNicht ?? 0)}
							{/if}
							{#if (z.auszaehlung.koepfe.imAusstand ?? 0) > 0}
								· {imAusstandInWorten(z.auszaehlung.koepfe.imAusstand ?? 0)}
							{/if}
							<span class="klein">
								Bezugsgrösse {z.auszaehlung.koepfe.basis}{#if z.auszaehlung.koepfe.schwelle !== null}, nötig {z.auszaehlung.koepfe.schwelle}{/if}
							</span>
						</dd>
					</div>
					<div>
						<dt>Wertquoten</dt>
						<dd>
							<!-- «Nicht erhoben» ist nicht «null» — siehe `quotenErhoben`. -->
							{#if z.auszaehlung.quotenErhoben === false}
								nicht erhoben
								<span class="klein">
									<!-- Konsultativ ohne Erfordernis, also ohne den Teil dazu (Befund 7). -->
									{#if z.auszaehlung.keinBeschluss?.grund === 'konsultativ'}
										Von Hand gezählt: Die Stimmen nach Wertquoten sind nicht erhoben.
									{:else}
										Von Hand gezählt: Die Stimmen nach Wertquoten sind nicht erhoben; das Erfordernis verlangt hier keine Mehrheit der Wertquoten.
									{/if}
								</span>
							{:else}
								{z.auszaehlung.quoten.ja} ja · {z.auszaehlung.quoten.nein} nein ·
								{z.auszaehlung.quoten.enthaltung} Enthaltung ·
								{z.auszaehlung.quoten.ohneAbgabe} ohne Abgabe
								<span class="klein">
									Bezugsgrösse {z.auszaehlung.quoten.basis}{#if z.auszaehlung.quoten.schwelle !== null}, nötig {z.auszaehlung.quoten.schwelle}{:else if z.auszaehlung.keinBeschluss?.grund !== 'konsultativ'}{' '}(kein Quotenerfordernis){/if}
								</span>
							{/if}
						</dd>
					</div>
				</dl>
			{/if}

			{#if zustimmungBetroffenerGefragt(z.auszaehlung)}
				{@const b = z.auszaehlung.betroffene}
				{#if b.form === 'nachher'}
					{@const namen = ausstehendeNamen(b)}
					{#if z.auszaehlung.angenommen}
						<p class="klein">
							Die Wertquoten können sich erst ändern, wenn die Betroffenen die Abänderungsurkunde
							unterzeichnet haben{#if namen} ({namen}){/if}; ein Ja im Saal ersetzt diese Unterschrift
							nicht.
						</p>
					{/if}
				{:else}
					<p class="klein">{zustimmungImSaalOderVorabInWorten(b, z.vorab ?? [])}</p>
				{/if}
			{/if}

			{#if z.frueherenDurchgaenge > 0}
				<!-- «Weitere», nicht «frühere»: Der überholte kann nach dem massgebenden
				     liegen (erfolgloses Rückkommen, Migration 131). Derselbe Satz im PDF.
				     «Massgebend» bleibt seit H6, aus dem Grund in `pdf/auswertung.ts`. -->
				<p class="klein">
					Massgebend ist der {z.durchgang}. Durchgang; {z.frueherenDurchgaenge === 1
						? '1 weiterer wurde als überholt vermerkt und bleibt einsehbar.'
						: `${z.frueherenDurchgaenge} weitere wurden als überholt vermerkt und bleiben einsehbar.`}
				</p>
			{/if}

			{#each z.auszaehlung.hinweise as h (h)}
				<p class="meldung warnung">{h}</p>
			{/each}
			<!-- Wie im PDF: die Lesart und das Ergebnis nach der anderen als
			     Feststellung, ohne den Rat an die Leitung (Migration 169); nur, wo das
			     Protokoll es nennt (`zweitesErgebnisImProtokoll`, «Texte nach 0047», Punkt 2). -->
			{#if z.lesart}
				<p class="klein">{z.lesart}</p>
			{/if}
			{#each andereLesartenVon(z.auszaehlung).filter(zweitesErgebnisImProtokoll) as r (r.kennung)}
				{@const fest = andereLesartInWorten(r, z.auszaehlung.geheim).protokoll}
				<!-- Als Warnung nur, wenn es abweicht; sonst eine Feststellung wie die
				     Lesartzeile (Codeprüfung Teil 4, M3). -->
				{#if fest}
					<p class={r.abweichend ? 'meldung warnung' : 'klein'}>{fest}</p>
				{/if}
			{/each}
		{/if}
	</article>
{/each}

<style>

	.bilanz {
		font-size: 1.1rem;
		font-variant-numeric: tabular-nums;
	}

	.zaehlweise {
		max-width: 52rem;
		padding: 0.6rem 0.85rem;
		border-left: 3px solid var(--linie);
		background: var(--flaeche-2);
		border-radius: var(--radius);
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	.zeile {
		border: 1px solid var(--linie);
		border-left: 4px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.85rem 1rem;
		margin: 0.75rem 0;
		margin-left: calc((var(--tiefe) - 1) * 1.5rem);
		max-width: 52rem;
	}

	.zeile.angenommen {
		border-left-color: var(--akzent);
	}

	/*
	 * **Der offene Stichentscheid hat seine eigene Farbe** (05.09.2026): Er ist
	 * weder gut noch schlecht, sondern unfertig — und muss sich von beidem
	 * unterscheiden, sonst liest ihn jemand als das eine oder andere.
	 */
	.bilanz .offen {
		color: var(--warnung);
	}

	.hinweis-offen {
		margin: 0 0 1rem;
		padding: 0.6rem 0.8rem;
		border-left: 3px solid var(--warnung);
		background: color-mix(in srgb, var(--warnung) 8%, transparent);
	}

	.zeile.abgelehnt {
		border-left-color: var(--fehler);
	}

	h2 {
		font-size: 1.05rem;
		margin: 0 0 0.4rem;
	}

	.nr {
		color: var(--text-leise);
		font-variant-numeric: tabular-nums;
		margin-right: 0.5rem;
	}

	.satz {
		font-weight: 550;
		margin: 0.35rem 0;
	}

	dl {
		margin: 0.5rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	dt {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-leise);
	}

	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.marke {
		display: inline-block;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		font-size: 0.8rem;
	}

	.marke.leise {
		color: var(--text-leise);
	}

	.meldung {
		padding: 0.6rem 0.85rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		margin: 0.5rem 0 0;
		font-size: 0.9rem;
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}
</style>
