<script lang="ts">
	/**
	 * Die Stammdaten aller Gemeinschaften — ein Register je Haus.
	 *
	 * **Das ist die Ansicht, um die es dem Auftraggeber am 11.08.2026 ging:** «Das Register
	 * wäre dann je STWE ein Register mit den Angaben aus Gemeinschaft,
	 * Eigentümer und Einheiten. So kann man Thema für Thema für alle STWEG und
	 * MEG durchgehen und müsste nicht jeden einzeln anklicken.»
	 *
	 * Die Reiterleiste über den Stammdatenseiten (`Abendregister` mit
	 * `abendregister`) trägt dieselbe Matrix auf der anderen Achse: dort bleibt
	 * das Thema und das Haus wechselt, hier bleibt die Seite und der Reiter
	 * wählt, wessen Angaben darauf stehen. Wer von hier auf «Ändern» klickt,
	 * landet auf der Themenseite — und findet dort die andere Achse.
	 *
	 * **`?thema=` schneidet auf ein Thema zu.** Seit dem 11.08.2026 steht jedes
	 * der vier Themen als eigener Schritt in der Ablaufleiste — gleich benannt wie
	 * bei einer einzelnen Versammlung, weil der Auftraggeber sie dort vermisst hat. Wer von
	 * dort kommt, will alle Häuser zu *einem* Thema sehen, nicht alle Themen zu
	 * einem Haus.
	 *
	 * **Offene stehen oben und sind markiert.** Gemeldet am 12.08.2026: «Hier sehe
	 * ich keine Veränderung. Fehlende Einträge können da leicht übersehen werden.»
	 * Sechs Kacheln sahen gleich aus, und der einzige Unterschied — «noch keine
	 * Einheit erfasst» gegen «2 Einheiten, Saldo geht auf» — stand in derselben
	 * Schrift wie ein Satz, der bei allen sechs gleich lautete.
	 */
	import { page } from '$app/state';
	import Abendregister from '$lib/components/Abendregister.svelte';
	import Karte from '$lib/components/Karte.svelte';
	import {
		haeuserNachStammdaten,
		haeuserZumThema,
		hausregister,
		STAMMDATENTHEMEN,
		type Abendhaus
	} from '$lib/domain/register';

	let { data } = $props();

	const aktiv = $derived(page.url.searchParams.get('haus'));
	const thema = $derived(page.url.searchParams.get('thema'));
	const themenschritt = $derived(
		data.haeuser.flatMap((h) => h.schritte).find((s) => s.kennung === thema) ?? null
	);
	const themenname = $derived(themenschritt?.titel ?? null);
	const leiste = $derived(
		hausregister({ pfad: page.url.pathname, haeuser: data.haeuser, aktiv })
	);
	const haus = $derived(data.haeuser.find((h) => h.stwegId === aktiv) ?? null);

	/** Nur die vier Schritte, die bei der Gemeinschaft liegen — in fester Reihenfolge. */
	const themen = $derived(
		haus
			? STAMMDATENTHEMEN.map((k) => haus.schritte.find((s) => s.kennung === k)).filter(
					(s) => s !== undefined
				)
			: []
	);

	/** Ein Thema, alle Häuser — offene zuerst (Kern: `haeuserZumThema`). */
	const zumThema = $derived(thema ? haeuserZumThema(data.haeuser, thema) : null);
	/** Alle vier Themen, alle Häuser — offene zuerst. */
	const nachStammdaten = $derived(haeuserNachStammdaten(data.haeuser));
</script>

<h1>{themenname ?? 'Stammdaten je Gemeinschaft'}</h1>

<!--
	Was hier zu tun ist, steht **einmal** — bis zum 12.08.2026 trug es jede Kachel
	mit: sechsmal derselbe Satz «Jede Einheit mit ihrer Stammquote erfassen, bis
	der Saldo aufgeht», der die eine Zeile erdrückte, auf die es ankam.
-->
{#if themenschritt?.beschreibung}
	<p class="was">{themenschritt.beschreibung}</p>
{/if}

{#snippet hauskacheln(liste: Abendhaus[])}
	<div class="kacheln">
		{#each liste as h (h.stwegId)}
			{@const s = h.schritte.find((x) => x.kennung === thema)}
			{#if s}
				<Karte
					titel={h.name}
					offen={s.zustand !== 'erledigt'}
					antwort={s.stand ?? (s.zustand === 'erledigt' ? 'Steht.' : 'Fehlt noch.')}
				>
					{#snippet fuss()}
						<a href="/gemeinschaften/{h.stwegId}/{s.kennung}?zur={h.versammlungId}">
							{s.zustand === 'erledigt' ? 'Ansehen und ändern' : 'Jetzt erfassen'}
						</a>
					{/snippet}
				</Karte>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet stammdatenkacheln(liste: Abendhaus[])}
	<div class="kacheln">
		{#each liste as h (h.stwegId)}
			{@const fehlend = h.schritte.filter(
				(s) => STAMMDATENTHEMEN.includes(s.kennung) && s.zustand !== 'erledigt'
			)}
			<Karte
				titel={h.name}
				offen={fehlend.length > 0}
				antwort={fehlend.length === 0 ? 'Vollständig.' : `${fehlend.length} von 4 offen.`}
				zusatz={fehlend.length === 0
					? 'Einheiten, Eigentümer, Reglement und Beschlussfähigkeit stehen.'
					: fehlend.map((s) => s.titel).join(', ')}
			>
				{#snippet fuss()}
					<a href="{page.url.pathname}?haus={h.stwegId}">Angaben ansehen</a>
				{/snippet}
			</Karte>
		{/each}
	</div>
{/snippet}

{#if data.haeuser.length === 0}
	<p class="leer">
		Noch tagt keine Gemeinschaft mit. <a href="/tage/{data.rahmenTag.id}/haeuser">Wer tagt mit?</a>
	</p>
{:else if thema && themenname && zumThema}
	<!--
		Ein Thema, alle Häuser. Der Weg aus der Ablaufleiste: «Einheiten und
		Wertquoten» meint alle Gemeinschaften dieses Abends, nicht eine.

		**Zwei Überschriften statt eines Satzes**, sobald beide Gruppen belegt sind:
		Der Satz «Bei 2 von 6 Gemeinschaften noch offen» sagte zwar dasselbe, liess
		aber offen, *welche* zwei — man musste sechs Kacheln lesen. Ist nur eine
		Gruppe belegt, bleibt es beim Satz: Eine Überschrift über allem, was da ist,
		gliedert nichts.
	-->
	{#if zumThema.offen.length === 0}
		<p class="wessen">Bei allen {data.haeuser.length} Gemeinschaften erfasst.</p>
		{@render hauskacheln(zumThema.erledigt)}
	{:else if zumThema.erledigt.length === 0}
		<p class="wessen">
			Bei {zumThema.offen.length === 1 ? 'der einzigen' : `allen ${data.haeuser.length}`}
			{data.haeuser.length === 1 ? 'Gemeinschaft' : 'Gemeinschaften'} noch offen.
		</p>
		{@render hauskacheln(zumThema.offen)}
	{:else}
		<h2 class="abschnitt warnt">
			Noch offen <span class="zahl">{zumThema.offen.length} von {data.haeuser.length}</span>
		</h2>
		{@render hauskacheln(zumThema.offen)}
		<h2 class="abschnitt">
			Erfasst <span class="zahl">{zumThema.erledigt.length} von {data.haeuser.length}</span>
		</h2>
		{@render hauskacheln(zumThema.erledigt)}
	{/if}
	<p class="alle">
		<a href={page.url.pathname}>Alle vier Themen je Gemeinschaft ansehen</a>
	</p>
{:else}
	{#if leiste}
		<Abendregister {leiste} frage="Welche Gemeinschaft?" />
	{/if}

	{#if haus}
		<!--
			Die vier Themen behalten ihre Reihenfolge, auch wenn eines offen ist: Sie
			bauen aufeinander auf (ohne Einheiten keine Zuordnung, ohne Zuordnung
			keine Stimmkraft). Umsortiert werden nur die Häuser — deren Reihenfolge
			sagt nichts (`register.ts`, `haeuserNach`).
		-->
		<p class="wessen">{haus.name}</p>
		<div class="kacheln">
			{#each themen as s (s.kennung)}
				<Karte
					titel={s.titel}
					offen={s.zustand !== 'erledigt'}
					antwort={s.stand ?? (s.zustand === 'erledigt' ? 'Steht.' : 'Fehlt noch.')}
					zusatz={s.beschreibung}
				>
					{#snippet fuss()}
						<a href="/gemeinschaften/{haus.stwegId}/{s.kennung}?zur={haus.versammlungId}">
							{s.zustand === 'erledigt' ? 'Ansehen und ändern' : 'Jetzt erfassen'}
						</a>
					{/snippet}
				</Karte>
			{/each}
		</div>
	{:else}
		<!--
			Die Übersicht «Alle»: eine Karte je Haus, die sagt, ob dort noch etwas
			fehlt — und was. Wer sie liest, weiss, welchen Reiter er anklicken muss,
			statt alle der Reihe nach zu öffnen.
		-->
		{#if nachStammdaten.offen.length === 0}
			<p class="wessen">
				Bei allen {data.haeuser.length} Gemeinschaften sind die Stammdaten vollständig.
			</p>
			{@render stammdatenkacheln(nachStammdaten.erledigt)}
		{:else if nachStammdaten.erledigt.length === 0}
			<p class="wessen">
				Bei {data.haeuser.length === 1 ? 'der Gemeinschaft' : `allen ${data.haeuser.length} Gemeinschaften`}
				fehlt noch etwas.
			</p>
			{@render stammdatenkacheln(nachStammdaten.offen)}
		{:else}
			<h2 class="abschnitt warnt">
				Noch unvollständig
				<span class="zahl">{nachStammdaten.offen.length} von {data.haeuser.length}</span>
			</h2>
			{@render stammdatenkacheln(nachStammdaten.offen)}
			<h2 class="abschnitt">
				Vollständig
				<span class="zahl">{nachStammdaten.erledigt.length} von {data.haeuser.length}</span>
			</h2>
			{@render stammdatenkacheln(nachStammdaten.erledigt)}
		{/if}
	{/if}
{/if}

<style>
	.alle {
		margin-top: 1.5rem;
	}

	.was,
	.wessen {
		color: var(--text-leise);
		margin: 0 0 0.75rem;
	}

	.leer {
		color: var(--text-leise);
	}

	/*
	 * Die Zwischenüberschrift trennt zwei Stapel Kacheln — sie ist keine neue
	 * Seitenüberschrift und trägt deshalb die Grösse einer Beschriftung. Die Zahl
	 * steht rechts davon als eigene Marke: «2 von 6» ist die Auskunft, die man im
	 * Vorbeisehen mitnimmt, und im Fliesstext ginge sie unter.
	 */
	.abschnitt {
		align-items: baseline;
		display: flex;
		flex-wrap: wrap;
		font-size: 0.95rem;
		gap: 0.5rem;
		margin: 1.5rem 0 0.6rem;
	}

	.abschnitt:first-of-type {
		margin-top: 0;
	}

	.abschnitt.warnt {
		color: var(--warnung);
	}

	.zahl {
		background: var(--flaeche-2);
		border-radius: 999px;
		color: var(--text-leise);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		padding: 0.1rem 0.6rem;
	}

	.abschnitt.warnt .zahl {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
		color: var(--warnung);
	}
</style>
