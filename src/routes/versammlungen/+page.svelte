<script lang="ts">
	/**
	 * Die Übersicht: suchen, filtern, und Abende als eine Zeile.
	 *
	 * Gefiltert wird im Gerät, nicht am Server: Der Bestand liegt bereits hier,
	 * und ein Tastendruck, der eine Anfrage auslöst, fühlt sich im Saal wie ein
	 * Hänger an. Die Einteilung selbst kommt aus dem Kern (AD-1) — sie ist
	 * geprüft, nicht durchgeklickt.
	 */
	import { zustandsname, type Versammlungszustand } from '$lib/domain/versammlung';
	import { page } from '$app/state';
	import { datumLang } from '$lib/domain/datum';
	import { punktdatum } from '$lib/domain/listensuche';
	import { baueUebersicht, zaehleZustaende } from '$lib/domain/versammlungsliste';
	import { anfangswert } from '$lib/felder';
	import Archivschalter from '$lib/components/Archivschalter.svelte';
	import Sammelarchivierung from '$lib/components/Sammelarchivierung.svelte';
	import Sammelbericht from '$lib/components/Sammelbericht.svelte';
	import Meldung from '$lib/components/Meldung.svelte';

	let { data, form } = $props();

	/** Was zum Sammelarchivieren angekreuzt ist (Auftraggeber, 15.09.2026). */
	let angekreuzt = $state.raw<Set<string>>(new Set());

	function kreuzeAn(id: string, an: boolean) {
		const neu = new Set(angekreuzt);
		if (an) neu.add(id);
		else neu.delete(id);
		angekreuzt = neu;
	}

	/**
	 * Ein Kästchen steht nur, wo Archivieren auch geht.
	 *
	 * **Nur die versiegelte** (`domain/archivieren`: «Archivieren erst was
	 * versiegelt wurde»). Ein Entwurf ist kein Nachweis, sondern ein Plan — was
	 * daran stört, gehört gelöscht. Eine geschlossene, aber unversiegelte
	 * Versammlung ist unfertige Arbeit. Ein Kästchen an beiden führte in eine
	 * Absage, und die gehört nicht hingestellt.
	 */
	const archivierbar = (v: {
		zustand: string;
		archiviertAm: string | null;
		gemeinschaftArchiviertSeit: string | null;
	}) =>
		darfAnkreuzen &&
		v.zustand === 'versiegelt' &&
		!v.archiviertAm &&
		/*
		 * **Auch der Archivstand der Gruppe** (aus dem Code-Review, 15.09.2026).
		 * Eine Versammlung, die über ihre archivierte Gemeinschaft im Archiv
		 * liegt, trägt kein eigenes `archived_at`. Ohne diese Zeile liesse sie
		 * sich bei eingeschaltetem Archivschalter einzeln archivieren — sie bekäme
		 * ein eigenes Datum und bliebe nach dem Hervorholen der Gemeinschaft
		 * unsichtbar. Genau die Falle, die bei den Gemeinschaften die Sortierung
		 * nach Tiefe verhindert; die Einzelseite schliesst sie längst aus.
		 */
		!v.gemeinschaftArchiviertSeit;

	/**
	 * Darf der Betrachter überhaupt archivieren?
	 *
	 * **Sonst kein Kästchen** (aus dem Code-Review, 15.09.2026). Die Aktion
	 * verlangt `admin`; ohne diese Prüfung sähe eine Sitzungsleitung die Haken,
	 * kreuzte an, drückte — und landete auf einer 403-Seite, weil das Formular
	 * ohne JavaScript abschickt. Ein Knopf, der zu einer Absage führt, gehört
	 * nicht hingestellt (`domain/rollen`).
	 */
	const darfAnkreuzen = $derived(Boolean(data.darfStammdaten));

	/*
	 * **Der Anfangswert kommt aus der Adresse** (21.08.2026). Die Übersicht führt
	 * mit einem Suchfeld hierher — «Hier fehlt noch die Schnellsuche also nach
	 * Stweg, Ort etc einfach die Daten, die es [gibt]». Sie zeigt nur Auszüge
	 * (die letzten fünf abgeschlossenen), und eine Suche, die bloss darin sucht,
	 * verschwiege den Rest. Gesucht wird deshalb dort, wo alles steht.
	 */
	let suche = $state(page.url.searchParams.get('suche') ?? '');
	let zustand = $state<Versammlungszustand | null>(null);
	/** Was der Benutzer selbst auf- oder zugeklappt hat — überstimmt die Vorgabe. */
	let umgeklappt = $state<Record<string, boolean>>({});

	/** Ob die archivierten Versammlungen mitlaufen (Migration 086). */
	let archivZeigen = $state(false);
	/**
	 * Im Archiv liegt eine Versammlung auf zwei Weisen: einzeln archiviert, oder
	 * weil ihre Gemeinschaftsgruppe archiviert wurde. Für die Liste ist beides
	 * dasselbe — sie steht nicht da (25.08.2026, zweite Reviewrunde).
	 */
	const imArchiv = (v: { archiviertAm: string | null; gemeinschaftArchiviertSeit: string | null }) =>
		Boolean(v.archiviertAm || v.gemeinschaftArchiviertSeit);
	const bestand = $derived(
		archivZeigen ? data.versammlungen : data.versammlungen.filter((v) => !imArchiv(v))
	);
	const archiviert = $derived(data.versammlungen.filter(imArchiv));
	const sucheAktiv = $derived(suche.trim().length > 0);
	/** Welche Abende überhaupt je eine Versammlung tragen — aus dem vollen Bestand. */
	const belegteAbende = $derived(
		new Set(data.versammlungen.map((v) => v.tagId).filter((id): id is string => Boolean(id)))
	);
	const faecher = $derived(
		baueUebersicht(bestand, data.tage, { suche, zustand, belegteAbende })
	);

	/**
	 * Wie viele Archivierte zur laufenden Ansicht passen — für die Leerstelle.
	 *
	 * **Durch dieselbe Mühle wie die Liste** (25.08.2026, aus dem Code-Review).
	 * Vorher stand hier ein eigenes `includes` über Gemeinschaft, Ort und Datum,
	 * während `suchtextVersammlung` zusätzlich Anlass, Zustandsname, Art und
	 * Stufe führt — und der Zustandsfilter fehlte ganz. Ergebnis: «Im Archiv
	 * liegen 5 Versammlungen, die dazu passen», Schalter an, und es kam nichts.
	 * Der Hinweis führte in die Leere.
	 */
	const imArchivGefunden = $derived(
		baueUebersicht(archiviert, data.tage, { suche, zustand, belegteAbende }).reduce(
			(n, f) =>
				n +
				// **Versammlungen zählen, nicht Zeilen** (25.08.2026, zweite
				// Reviewrunde). Ein Abend ist eine Zeile mit mehreren Versammlungen:
				// Zwei archivierte Versammlungen desselben Abends ergaben «1
				// Versammlung».
				f.zeilen.reduce(
					(m, z) => m + (z.art === 'abend' ? z.versammlungen.length : 1),
					0
				),
			0
		)
	);
	const zaehlung = $derived(zaehleZustaende(bestand, suche));
	const treffer = $derived(faecher.reduce((n, f) => n + f.zeilen.length, 0));

	/**
	 * Zugeklappt bleibt nur, was niemand angefasst hat und wonach nicht gesucht wird.
	 * Eine Suche, die ihre Treffer hinter einem geschlossenen Fach versteckt, ist keine.
	 */
	function istOffen(stand: string, zugeklappt: boolean): boolean {
		return umgeklappt[stand] ?? (!zugeklappt || sucheAktiv);
	}

	function klappe(stand: string, zugeklappt: boolean) {
		umgeklappt[stand] = !istOffen(stand, zugeklappt);
	}

	/**
	 * Die Auswahl — **nur, was gerade zu sehen ist**.
	 *
	 * Zwei Gründe, und beide zählen: Wer die Suche einengt oder einen Filter
	 * setzt, archivierte sonst Zeilen, die er nicht vor Augen hat. Und ein
	 * **zugeklapptes Fach** zeigt seine Zeilen gar nicht — eine Auswahl darin
	 * wäre unsichtbar und liefe trotzdem mit.
	 *
	 * Die Haken selbst bleiben erhalten: Wer wieder aufklappt oder die Suche
	 * weitet, findet sie vor.
	 */
	const gewaehlt = $derived.by(() => {
		const raus: string[] = [];
		for (const fach of faecher) {
			if (!istOffen(fach.stand, fach.zugeklappt)) continue;
			for (const zeile of fach.zeilen) {
				const drin =
					zeile.art === 'einzeln' ? [zeile.versammlung] : zeile.versammlungen;
				for (const v of drin) if (angekreuzt.has(v.id)) raus.push(v.id);
			}
		}
		return raus;
	});

	function merkmale(v: {
		art: string;
		stufe: string;
		ort: string;
		anlass?: string | null;
		archiviertAm?: string | null;
		gemeinschaftArchiviertSeit?: string | null;
	}) {
		const teile = [v.art === 'ordentlich' ? 'Ordentlich' : 'Ausserordentlich'];
		if (v.stufe === 'zweite') teile.push('Zweitversammlung');
		if (v.anlass) teile.push(v.anlass);
		teile.push(v.ort);
		/*
		 * **Woran man die archivierte erkennt** (25.08.2026, aus dem
		 * Code-Review). Mit eingeschaltetem Schalter standen archivierte und
		 * aktive Zeilen ununterscheidbar untereinander. Hier statt als eigene
		 * Marke, weil die Zeile schon eine Marke trägt — den Zustand — und zwei
		 * nebeneinander die eine wichtige verdecken.
		 */
		if (v.archiviertAm || v.gemeinschaftArchiviertSeit) teile.push('im Archiv');
		return teile.join(' · ');
	}
</script>

<div class="kopf">
	<h1>Versammlungen</h1>
	<a class="knopf haupt" href="/versammlungen/neu">Neue Versammlung</a>
</div>

{#if data.geloescht}
	<p class="meldung gut" role="status">{data.geloescht} wurde gelöscht.</p>
{/if}

{#if data.versammlungen.length === 0 && data.tage.length === 0}
	<p class="leer">
		Noch keine Versammlung erfasst.
		{#if !data.hatGemeinschaften}
			Legen Sie zuerst eine <a href="/gemeinschaften/neu">Gemeinschaft</a> an.
		{/if}
	</p>
{:else}
	<div class="suchleiste">
		<label class="suchfeld">
			<span class="nurLeser">Versammlung suchen</span>
			<input
				type="search"
				placeholder="Gemeinschaft, Ort oder Datum"
				{...anfangswert(suche)}
				oninput={(e) => (suche = e.currentTarget.value)}
				autocomplete="off"
			/>
		</label>

		<Archivschalter
			art="versammlung"
			archiviert={archiviert.length}
			trefferImArchiv={imArchivGefunden}
			gesucht={sucheAktiv || zustand !== null}
			aktivLeer={treffer === 0}
			bind:zeigen={archivZeigen}
		/>

		<div class="filter" role="group" aria-label="Nach Zustand filtern">
			<button
				type="button"
				class="chip"
				class:gewaehlt={zustand === null}
				aria-pressed={zustand === null}
				onclick={() => (zustand = null)}
			>
				Alle <span class="zahl">{zaehlung.gesamt}</span>
			</button>
			{#each zaehlung.je as z (z.zustand)}
				<button
					type="button"
					class="chip"
					class:gewaehlt={zustand === z.zustand}
					aria-pressed={zustand === z.zustand}
					onclick={() => (zustand = zustand === z.zustand ? null : z.zustand)}
				>
					{zustandsname(z.zustand)}
					<span class="zahl">{z.anzahl}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if treffer === 0}
		<p class="leer">
			Nichts gefunden.
			{#if zustand !== null}
				Der Filter «{zustandsname(zustand)}» ist gesetzt.
			{/if}
		</p>
		<!--
			Der Archivhinweis an der Leerstelle: Wer sucht und nichts findet, weiss
			sonst nicht, dass im Archiv etwas liegt — und legt die Versammlung ein
			zweites Mal an.
		-->
		<Archivschalter
			art="versammlung"
			archiviert={archiviert.length}
			trefferImArchiv={imArchivGefunden}
			gesucht={sucheAktiv || zustand !== null}
			aktivLeer={true}
			mitSchalter={false}
			bind:zeigen={archivZeigen}
		/>
	{/if}

	{#if form?.quelle === 'sammel'}
		{#if form.fehler}
			<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
		{:else}
			<!--
				Kein `mitgegangenText`: Versammlungen hängen an keinem Baum. Eine
				archivierte Gemeinschaft nimmt ihre Versammlungen zwar mit, aber das
				geschieht auf der Gemeinschaftenliste, nicht hier.
			-->
			<Sammelbericht
				ergebnis={form.ergebnis}
				marke={form}
				einzahl="Versammlung"
				mehrzahl="Versammlungen"
			/>
		{/if}
	{/if}

	{#each faecher as fach (fach.stand)}
		{#if fach.zeilen.length > 0}
			{@const offen = istOffen(fach.stand, fach.zugeklappt)}
			<section class="fach">
				<h2>
					<button
						type="button"
						class="fachkopf"
						aria-expanded={offen}
						onclick={() => klappe(fach.stand, fach.zugeklappt)}
					>
						<span class="pfeil" class:zu={!offen} aria-hidden="true">▾</span>
						{fach.titel}
						<span class="zahl">{fach.anzahl}</span>
					</button>
				</h2>

				{#if offen}
					<ul class="liste">
						{#each fach.zeilen as zeile (zeile.schluessel)}
							<li>
								{#if zeile.art === 'einzeln'}
									{@const v = zeile.versammlung}
									{#if archivierbar(v)}
										<!--
											`data-gefuehrt`: Diesen Haken führt der Browser, nicht der
											Server (siehe `scripts/eslint/felder.mjs`); er muss dem
											Zustand folgen.
										-->
										<input
											type="checkbox"
											class="ankreuz"
											data-gefuehrt
											checked={angekreuzt.has(v.id)}
											onchange={(e) => kreuzeAn(v.id, e.currentTarget.checked)}
											aria-label="Versammlung vom {punktdatum(v.datum)} in {v.gemeinschaftName} auswählen"
										/>
									{/if}
									<a class="zeile" href="/versammlungen/{v.id}">
										<!--
											**Kein rohes ISO-Datum in der Spalte** (Bedienbarkeitsprüfung
											05.09.2026, Befund 21: «Drei Datumsformate auf einer Seite»).
											Hier und in der Abendzeile darunter stand `2026-09-05`, während
											die Unterzeile daneben «5. September 2026» führt.

											**`punktdatum`, nicht `datumKurz`** (Code-Review 06.09.2026):
											`v.datum` ist ein Kalendertag aus einer `date`-Spalte.
											`datumKurz` schickt ihn durch `new Date` und `Intl` mit
											Zeitzone — genau der Weg, vor dem `datum.ts` für Kalendertage
											warnt. In einer Zone mit negativem Versatz stünde dort der
											Vortag. `punktdatum` dreht die Zeichenkette, ohne zu rechnen,
											und speist bereits den Suchtext derselben Liste.
										-->
										<span class="datum">{punktdatum(v.datum)}</span>
										<span class="titel">
											<strong>{v.gemeinschaftName}</strong>
											<span class="leise">{merkmale(v)}</span>
										</span>
										<span class="zustand" data-zustand={v.zustand}>{zustandsname(v.zustand)}</span>
									</a>
								{:else}
									<div class="abend">
										<a class="zeile abendkopf" href="/tage/{zeile.abend.id}">
											<span class="datum">{punktdatum(zeile.abend.datum)}</span>
											<span class="titel">
												<strong>{zeile.abend.bezeichnung}</strong>
												<span class="leise">
													{datumLang(zeile.abend.datum)}, {zeile.abend.uhrzeit} Uhr · {zeile.abend
														.ort}
													{#if zeile.versammlungen.length < zeile.gesamt}
														· {zeile.versammlungen.length} von {zeile.gesamt} Versammlungen
													{:else}
														· {zeile.gesamt}
														{zeile.gesamt === 1 ? 'Versammlung' : 'Versammlungen'}
													{/if}
												</span>
											</span>
											<span class="zustand marke">Gemeinsam</span>
										</a>
										{#if zeile.versammlungen.length > 0}
											<ul class="unter">
												{#each zeile.versammlungen as v (v.id)}
													<li>
														{#if archivierbar(v)}
															<input
																type="checkbox"
																class="ankreuz"
																data-gefuehrt
																checked={angekreuzt.has(v.id)}
																onchange={(e) => kreuzeAn(v.id, e.currentTarget.checked)}
																aria-label="Versammlung in {v.gemeinschaftName} auswählen"
															/>
														{/if}
														<a class="zeile schmal" href="/versammlungen/{v.id}">
															<span class="titel">
																<strong>{v.gemeinschaftName}</strong>
																<span class="leise">{merkmale(v)}</span>
															</span>
															<span class="zustand" data-zustand={v.zustand}>
																{zustandsname(v.zustand)}
															</span>
														</a>
													</li>
												{/each}
											</ul>
										{:else}
											<p class="leise unterhinweis">
												Hier tagt noch keine Gemeinschaft mit.
											</p>
										{/if}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	{/each}

	<Sammelarchivierung
		einzahl="Versammlung"
		mehrzahl="Versammlungen"
		{gewaehlt}
		aufheben={() => (angekreuzt = new Set())}
	/>
{/if}

<style>
	/*
	 * Das Kästchen zum Sammelarchivieren. Es steht VOR der Zeile, weil die ganze
	 * Zeile ein Verweis ist — innerhalb des `<a>` liesse es sich nicht ankreuzen,
	 * ohne die Seite zu wechseln.
	 */
	/*
	 * **Das `li` ist ein Block, kein Flex** (aus dem Code-Review, 15.09.2026).
	 * `flex: 0 0 auto` an einem Kind eines Blocks wirkt nicht — das Kästchen
	 * stand über der Zeile statt davor. Die Zeile wird deshalb hier zum Flex
	 * gemacht, und zwar nur, wo ein Kästchen steht.
	 */
	li:has(> .ankreuz) {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	li:has(> .ankreuz) > :global(a.zeile) {
		flex: 1 1 auto;
		min-width: 0;
	}

	.ankreuz {
		flex: 0 0 auto;
		width: 1.15rem;
		height: 1.15rem;
		min-height: 0;
		margin: 0 0 0 0.75rem;
		cursor: pointer;
	}

	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		margin: 0 0 1rem;
		max-width: var(--lesebreite);
		padding: 0.75rem 1rem;
	}

	.kopf h1 {
		margin: 0;
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

	.filter {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.chip {
		min-height: 2rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0 0.7rem;
		border: 1px solid var(--linie);
		border-radius: 999px;
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.chip:hover {
		border-color: var(--akzent);
	}

	.chip.gewaehlt {
		border-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 18%, transparent);
		font-weight: 550;
	}

	.zahl {
		font-variant-numeric: tabular-nums;
		color: var(--text-leise);
		font-size: 0.85em;
	}

	.chip.gewaehlt .zahl {
		color: inherit;
	}

	.fach {
		margin-top: 1.25rem;
	}

	.fach h2 {
		margin: 0 0 0.4rem;
		font-size: 1rem;
	}

	.fachkopf {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.2rem 0.3rem;
		margin-left: -0.3rem;
		border: none;
		background: none;
		color: var(--text-leise);
		font: inherit;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.fachkopf:hover {
		color: var(--text);
	}

	.pfeil {
		display: inline-block;
		transition: transform 0.12s ease;
	}

	.pfeil.zu {
		transform: rotate(-90deg);
	}

	.liste,
	.unter {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.zeile {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		flex-wrap: wrap;
		padding: 0.5rem 0.8rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: inherit;
		text-decoration: none;
		min-height: var(--ziel-min);
	}

	.zeile:hover {
		border-color: var(--akzent);
	}

	.datum {
		font-variant-numeric: tabular-nums;
		flex: 0 0 6rem;
		color: var(--text-leise);
		/* Ohne das bricht «2026-08-05» am Bindestrich in zwei Zeilen und macht
		   jede Zeile der Liste doppelt so hoch. */
		white-space: nowrap;
	}

	.titel {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
		flex: 1 1 14rem;
		min-width: 0;
	}

	.leise {
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	/* Die Pille mit `data-zustand` steht seit dem 06.10.2026 in app.css (Auftrag
	   V2). «Gemeinsam» trägt kein Merkmal und braucht ihre Form deshalb hier. */
	.zustand.marke {
		font-size: 0.85rem;
		padding: 0.15rem 0.65rem;
		border-radius: 999px;
		white-space: nowrap;
		background: none;
		border: 1px solid var(--linie);
		color: var(--text-leise);
	}

	/* Der Abend als Block: die Klammer sichtbar, die Versammlungen eingerückt. */
	.abend {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche-2);
		padding: 0.35rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.abendkopf {
		border-color: transparent;
		background: none;
	}

	.unter {
		margin: 0 0 0.1rem 1.4rem;
	}

	.zeile.schmal {
		min-height: 2.4rem;
		padding: 0.35rem 0.7rem;
	}

	.unterhinweis {
		margin: 0 0 0.35rem 1.4rem;
		font-size: 0.85rem;
	}

	.leer {
		color: var(--text-leise);
	}
</style>
