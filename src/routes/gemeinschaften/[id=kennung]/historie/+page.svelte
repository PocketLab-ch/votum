<script lang="ts">
	import {
		beschluesseInWorten,
		versammlungInWorten,
		versammlungsartInWorten
	} from '$lib/domain/historiesuche';
	import { datumLang } from '$lib/domain/datum';
	import { punktdatum } from '$lib/domain/listensuche';
	import { zustandsname } from '$lib/domain/versammlung';
	import { anfangswert } from '$lib/felder';

	let { data } = $props();

</script>


<h1>Versammlungen und frühere Geschäfte</h1>

<form method="GET" class="suche">
	<label>
		In früheren Geschäften suchen
		<input
			name="q"
			{...anfangswert(data.suchbegriff)}
			placeholder="z. B. Fassade, Heizung, Erneuerungsfonds"
			autocomplete="off"
		/>
	</label>
	<button type="submit">Suchen</button>
	{#if data.suchbegriff}
		<a class="zuruecksetzen" href="/gemeinschaften/{data.gemeinschaft.id}/historie">
			Suche zurücksetzen
		</a>
	{/if}
</form>

{#if data.hinweis}
	<p class="meldung warnung">{data.hinweis}</p>
{/if}

{#if data.suchbegriff && !data.hinweis}
	<h2>
		{data.treffer.length}
		{data.treffer.length === 1 ? 'Treffer' : 'Treffer'} für «{data.suchbegriff}»
	</h2>

	{#if data.treffer.length === 0}
		<p class="leer">
			Nichts gefunden. Gesucht wird in Titel, Kurzfassung, Inhalt und Antragswortlaut — auch ohne
			Rücksicht auf Gross- und Kleinschreibung und auf Akzente.
		</p>
	{:else}
		<ul class="treffer">
			{#each data.treffer as t (t.traktandumId)}
				<li>
					<p class="kopf">
						<a href="/versammlungen/{t.versammlungId}/traktanden">
							<strong>{t.titel}</strong>
						</a>
						<span class="klein">
							Versammlung vom {datumLang(t.versammlungDatum)} ·
							{t.versammlungArt === 'ordentlich' ? 'ordentlich' : 'ausserordentlich'} ·
							{zustandsname(t.versammlungZustand as never)}
						</span>
					</p>

					{#each t.fundstellen as f (f.feld)}
						<p class="auszug">
							<span class="feld">{f.beschriftung}</span>
							{f.auszug}
						</p>
					{/each}

					{#if t.erfordernisTitel}
						<p class="klein erfordernis">
							Angewandtes Mehrheitserfordernis: <strong>{t.erfordernisTitel}</strong>
							{#if t.erfordernisGrundlage}({t.erfordernisGrundlage}){/if}
							{#if t.erfordernisFassung}
								· Regelfassung {t.erfordernisFassung}
							{/if}
						</p>
					{:else if t.art === 'abstimmung'}
						<p class="klein">Für dieses Traktandum war kein Mehrheitserfordernis gesetzt.</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<h2>Alle Versammlungen</h2>

{#if data.versammlungen.length === 0 && data.eingespielte.length === 0}
	<p class="leer">Für diese Gemeinschaft ist noch keine Versammlung erfasst.</p>
{:else}
	<ul class="liste">
		{#each data.versammlungen as v (v.id)}
			<li>
				<a href="/versammlungen/{v.id}">
					<!--
						Schweizer Schreibweise wie in der Versammlungsliste (06.10.2026,
						UI-Durchgang): Hier stand der Kalendertag roh, «2026-09-11».
						`punktdatum` dreht die Zeichenkette, ohne über eine Zeitzone zu
						rechnen (Begründung in `versammlungen/+page.svelte`).
					-->
					<span class="datum">{punktdatum(v.datum)}</span>
					<span class="haupt">
						<strong>{versammlungInWorten(v)}</strong>
						<span class="klein">{v.ort} · {beschluesseInWorten(v.anzahlBeschluesse)}</span>
					</span>
					<span class="zustand" data-zustand={v.zustand}>{zustandsname(v.zustand as never)}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<!--
	Anderswo geführt und hier als Paket aufgenommen (PRD §13). Sie stehen in
	einem **eigenen** Block und nicht zwischen den anderen: Was hier steht, lässt
	sich nicht öffnen, nicht fortsetzen und nicht ändern — der Unterschied gehört
	sichtbar, nicht in ein Merkmal an der Zeile.
-->
{#if data.eingespielte.length > 0}
	<h2>Von aussen aufgenommen</h2>
	<p class="leer">
		Auf einem anderen Gerät geführt und dort versiegelt. Aufbewahrt wird das Abschlusspaket, so
		wie es ist.
	</p>
	<ul class="liste">
		{#each data.eingespielte as e (e.id)}
			<li>
				<a href="/gemeinschaften/{data.gemeinschaft.id}/eingespielt/{e.id}">
					<span class="datum">{punktdatum(e.datum)}</span>
					<span class="haupt">
						<!--
							Art und Stufe aus dem Manifest, in denselben Worten wie die eigenen
							Versammlungen darüber (UI-Durchgang 06.10.2026: stand roh als
							«ordentlich, erste»). Beim Siegelzeitpunkt nur der Tag, und zwar
							**abgeschnitten, nicht über `tagVon`**: Das Manifest trägt ihn als
							zonenlose Schweizer Zeit («JJJJ-MM-TT HH:MM:SS», `toLocaleString('sv-SE',
							{ timeZone: 'Europe/Zurich' })`); `tagVon` läse ihn in der Zone des
							Servers und schöbe ein Siegel nach 22 Uhr auf den Folgetag. `String()`,
							weil ein eingespieltes Paket nur gecastet und nicht nach Form geprüft
							ist; ein fehlender Wert soll die Historie nicht auf 500 setzen.
						-->
						<strong>{versammlungsartInWorten(e.art, e.stufe)}</strong>
						<span class="klein"
							>{e.ort} · versiegelt {punktdatum(String(e.versiegeltAm ?? '').slice(0, 10))}</span
						>
					</span>
					<span class="zustand" data-zustand="versiegelt">eingespielt</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<p class="dazu">
	<a href="/gemeinschaften/{data.gemeinschaft.id}/einspielen">
		Eine Versammlung von aussen aufnehmen
	</a>
	<span class="klein">
		Für Versammlungen, die auf einem anderen Gerät geführt wurden — etwa auf dem Notebook im Saal
		ohne Netz.
	</span>
</p>

<style>
	.dazu {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin-top: 2rem;
		max-width: 46rem;
	}


	.suche {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
		flex-wrap: wrap;
		margin: 1.25rem 0;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.9rem;
		font-weight: 550;
		flex: 1 1 22rem;
		max-width: 30rem;
	}

	input {
		min-height: var(--ziel-min);
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-weight: 400;
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

	.zuruecksetzen {
		font-size: 0.9rem;
		align-self: center;
	}

	h2 {
		margin-top: 2rem;
		font-size: 1.1rem;
	}

	.leer {
		color: var(--text-leise);
		max-width: 46rem;
	}

	.treffer,
	.liste {
		list-style: none;
		padding: 0;
		margin: 1rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.treffer li {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 0.8rem 1rem;
		max-width: 52rem;
	}

	.kopf {
		margin: 0 0 0.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.kopf a {
		color: inherit;
	}

	.auszug {
		margin: 0.25rem 0;
		font-size: 0.92rem;
	}

	.feld {
		display: inline-block;
		font-size: 0.75rem;
		padding: 0.05rem 0.45rem;
		margin-right: 0.4rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		color: var(--text-leise);
	}

	.erfordernis {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--linie);
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.liste a {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.8rem 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: inherit;
		text-decoration: none;
		min-height: var(--ziel-min);
		max-width: 52rem;
	}

	.liste a:hover {
		border-color: var(--akzent);
	}

	.datum {
		font-variant-numeric: tabular-nums;
		flex: 0 0 6.5rem;
	}

	.haupt {
		display: flex;
		flex-direction: column;
		flex: 1 1 14rem;
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
</style>
