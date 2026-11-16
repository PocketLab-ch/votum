<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { anfangswert } from '$lib/felder';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { Zeitstempelprobe } from '$lib/domain/dienste';
	import Meldung from '$lib/components/Meldung.svelte';

	let { data, form } = $props();

	/*
	 * Die Aktionen dieser Seite geben Verschiedenes zurück — eine Meldung, eine
	 * Warnung, eine Probe. TypeScript sieht davon nur die Vereinigung, in der
	 * keine Eigenschaft überall vorkommt; die Zusicherung sagt, was in dem Zweig
	 * gilt, den die Prüfung davor bereits festgestellt hat.
	 */
	const fehler = $derived(
		form && 'fehler' in form ? (form.fehler as { nachricht: string; feld?: string }) : null
	);
	const hinweis = $derived(form && 'hinweis' in form ? (form.hinweis as string | undefined) : null);
	const hinweise = $derived(form && 'hinweise' in form ? ((form.hinweise ?? []) as string[]) : []);
	/** Der Prüfzeitstempel — mit ihm kommt der Fingerabdruck zum Anheften. */
	const probe = $derived(
		form && 'probe' in form ? (form.probe as Zeitstempelprobe | null) : null
	);
	/*
	 * **Der Befund gehört in den Kasten des Dienstes, der gefragt wurde**
	 * (13.11.2026). Seit es zwei gibt, stünde er sonst zweimal auf der Seite,
	 * einmal mit dem Stempel des einen Hauses über dem Knopf des anderen.
	 */
	const probeHaupt = $derived(probe && probe.art !== 'ersatz' ? probe : null);
	const probeErsatz = $derived(probe && probe.art === 'ersatz' ? probe : null);
	/**
	 * Das Ergebnis einer Verbindungsprüfung.
	 *
	 * Es steht **an der Stufe**, auf deren Knopf gedrückt wurde, nicht am
	 * Seitenkopf. Gemeldet am 17.08.2026: «Es geschieht nicht viel, wenn ich auf
	 * Testen klicke.» Es geschah etwas — ein Satz, 380 px über dem Knopf, in der
	 * Farbe des übrigen Textes.
	 */
	const geprueft = $derived(
		form && 'geprueft' in form
			? (form.geprueft as { stufe: string; nummer: number; ok: boolean; bemerkung: string })
			: null
	);
	/**
	 * Was aufgeklappt ist.
	 *
	 * **Reiner Client-Zustand, und das ist hier vollständig.** Ein Umweg über
	 * eine Marke in der Absage des Servers wäre unerreichbar: Aufgeklappt wird
	 * mit `type="button"` und `onclick`, also nur mit JavaScript — und wo
	 * JavaScript läuft, hält `use:enhance` den Zustand über die Absage hinweg.
	 * Der erste Anlauf trug beides und behauptete im Kommentar einen Fall, den
	 * es nicht gibt; das Review vom 17.08.2026 hat es aufgedeckt.
	 *
	 * Was daran hängt, hält `e2e/dienste.mjs` fest: Eine Absage lässt das
	 * Formular offen samt Getipptem, und «Abbrechen» schliesst es trotzdem.
	 */
	let offeneStufe = $state<string | null>(null);
	let anlegenOffen = $state(false);
	let zeitstempelOffen = $state(false);
	let ersatzOffen = $state(false);

	/**
	 * Welcher Anruf gerade läuft.
	 *
	 * Ein Anruf dauert vom Netz abhängig bis zur eingestellten Geduld, der
	 * Prüfzeitstempel mit seinen Wiederholungen noch länger. Ohne sichtbaren
	 * Laufzustand sieht ein Klick aus wie nichts — und wird ein zweites Mal
	 * gedrückt.
	 */
	let laeuft = $state<string | null>(null);

	const ts = $derived(data.lage.zeitstempel);
	/** Der Ersatzdienst (13.11.2026), eigener Kasten unter dem Zeitstempeldienst. */
	const ersatz = $derived(data.lage.ersatz);
	const sekunden = (ms: number) => `${Math.round(ms / 100) / 10} s`;

	/** Eine Stufe aus der Umgebung hat keine Kennung — dort trägt die Nummer sie. */
	const kennung = (s: { id: string | null; nummer: number }) => s.id ?? `nummer-${s.nummer}`;

	/** Der Befund gehört an genau eine Stufe — an die angerufene. */
	const befundAn = (s: { id: string | null; nummer: number }) =>
		geprueft && (geprueft.stufe !== '' ? geprueft.stufe === s.id : geprueft.nummer === s.nummer)
			? geprueft
			: null;

	/**
	 * Holt den Fokus an die Handlung zurück, von der er kam.
	 *
	 * Gemessen am 17.08.2026: Nach jedem Absenden stand er auf `BODY`. Wer die
	 * Kette mit der Tastatur um zwei Plätze schiebt, tabbt sich dazwischen
	 * einmal durch die ganze Seite zurück, und die Sprachausgabe sagt nach dem
	 * Verschieben nichts.
	 *
	 * **Verschwindet die Handlung dabei** — der Pfeil nach oben an der Stufe,
	 * die gerade nach oben gerückt ist —, übernimmt eine andere Handlung
	 * desselben Gegenstands. Sonst landete der Fokus wieder im Nichts, und zwar
	 * genau dann, wenn jemand zweimal hintereinander drückt.
	 */
	function holeDenFokusZurueck(marke: string) {
		const genau = document.querySelector<HTMLElement>(`[data-fokus="${marke}"]`);
		if (genau) {
			genau.focus();
			return;
		}
		const gegenstand = marke.split(':')[1];
		const nachbar = gegenstand
			? document.querySelector<HTMLElement>(`[data-fokus$=":${gegenstand}"]`)
			: null;
		if (nachbar) {
			nachbar.focus();
			return;
		}
		/*
		 * Die Handlung selbst ist verschwunden und hat keinen Nachbarn: «In die
		 * Anwendung übernehmen» gibt es nach dem Übernehmen nicht mehr, «Dienst
		 * entfernen» nach dem Entfernen auch nicht. Ohne diesen dritten Griff
		 * landete der Fokus auf `<body>`, und wer mit der Tastatur arbeitet,
		 * tabbt sich durch die ganze Seite zurück.
		 *
		 * **Zwei Ziele, und warum es beide braucht** (02.09.2026, aus dem
		 * Code-Review). Gemeint war die Meldung: Sie sagt, was geschehen ist, und
		 * steht vor dem, was sich geändert hat. Nur gilt das für eine **Absage**.
		 * Eine Erfolgsmeldung wandert in den Einblender unten rechts (`umgezogen`
		 * in `Meldung.svelte`, Vorgabe des Auftraggebers vom 21.08.2026), und der `<p>` ist
		 * dann gar nicht mehr im Baum — ausgerechnet im Erfolgsfall, dem
		 * einzigen, in dem eine Handlung verschwindet. Der Griff zielte also auf
		 * ein Ziel, das es in seinem eigenen Fall nie gibt.
		 *
		 * Die Quittung im Einblender taugt nicht als Ersatz: Sie verschwindet
		 * nach Sekunden von selbst, und der Fokus läge danach wieder im Nichts.
		 * Bleibt die Überschrift — der Seitenanfang ist der übliche Halt nach
		 * einer Handlung, die ihren Auslöser mitgenommen hat.
		 */
		/*
		 * **`.meldung` allein trifft die Falschen** (02.09.2026, zweite Runde des
		 * Code-Reviews). Diese Seite trägt selbst zwei handgebaute
		 * `<p class="meldung warnung">` — der Hinweiskasten und die Zeile über den
		 * fehlenden Tresorschlüssel. Die stehen dauerhaft, also fand der Griff
		 * immer eine «Meldung», der Rückfall auf die Überschrift lief nie, und der
		 * Fokus landete nach jedem Erfolg doch auf `<body>`.
		 *
		 * Gesucht wird deshalb das Merkmal, das den Fokus tatsächlich annimmt:
		 * `Meldung.svelte` gibt `tabindex="-1"` aus, die handgebauten nicht.
		 */
		const ziel =
			document.querySelector<HTMLElement>('.meldung[tabindex="-1"]') ??
			document.querySelector<HTMLElement>('h1');
		ziel?.focus();
	}

	/**
	 * Eine Handlung, die die Seite neu zeichnet — für **jedes** schreibende
	 * Formular dieser Seite dieselbe.
	 *
	 * Vorher trugen drei von zehn Formularen `use:enhance` und sieben nicht. Die
	 * sieben luden die Seite neu, und damit klappte ein abgewiesenes Formular zu
	 * und nahm das Getippte mit — nachgemessen an «Stufe hinzufügen» und
	 * «Ändern». Was für alle gilt, gehört an eine Stelle.
	 */
	function handlung(
		marke: string,
		art: { laufend?: boolean; beiErfolg?: () => void } = {}
	): SubmitFunction {
		return () => {
			if (art.laufend) laeuft = marke;
			return async ({ update, result }) => {
				/*
				 * **`update()` ohne `reset: false`.** SvelteKit leert das Formular nur
				 * bei `result.type === 'success'` (`runtime/app/forms.js`,
				 * nachgelesen) — bei einer Absage bleibt das Getippte also ohnehin
				 * stehen, und das ist der Fall, auf den es ankommt.
				 *
				 * Bei Erfolg **muss** geleert werden: Sonst stünde der eben getippte
				 * Zugangsschlüssel weiter im Feld. Diese Seite zeigt einen Schlüssel
				 * nie an — auch nicht als Punktereihe mit dem echten Wert dahinter —,
				 * und ein Formular, das ihn nach dem Speichern behält, unterläuft
				 * genau das.
				 */
				await update();
				if (art.laufend) laeuft = null;
				if (result.type === 'success') art.beiErfolg?.();
				await tick();
				/*
				 * **Nur zurückholen, wenn der Fokus herrenlos ist.** Ein Anruf darf
				 * bis zur eingestellten Geduld dauern — zwei Minuten sind erlaubt.
				 * Wer in der Zwischenzeit ein Änderungsformular öffnet und tippt,
				 * bekäme den Fokus sonst mitten im Satz auf den Prüfknopf zurück,
				 * samt Sprung dorthin.
				 *
				 * **Die Nachfass-Kette aus `absenden.ts` fehlt hier noch**
				 * (Stand 22.09.2026). Dort wurde gemessen, dass diese
				 * Body-Prüfung allein zu kurz greift: Unter Last steht der
				 * Fokus im Prüfzeitpunkt noch auf dem Knopf, der gleich aus
				 * dem Baum fällt, und niemand fasst danach nach.
				 *
				 * **Hier ist es nicht gemessen, nicht ausgeschlossen.** Der
				 * Mechanismus ist derselbe: `handlung()` ruft ebenfalls
				 * `update()` auf, und der Docblock oben beschreibt selbst den
				 * Fall, dass die Handlung beim Absenden verschwindet. Wer
				 * «Regel 3» an dieser Stelle nachliest, soll deshalb nicht
				 * annehmen, sie sei gleichbedeutend mit der in `absenden.ts`.
				 */
				if (document.activeElement === document.body) holeDenFokusZurueck(marke);
			};
		};
	}
</script>

<!--
	Ein Pfeil, zweimal gebraucht und einmal geschrieben. Vorher standen die
	beiden Formulare als zwölf Zeilen Abschrift nebeneinander, verschieden nur
	in Richtung, Zeichen und Beschriftung — die Art Stelle, an der beim nächsten
	Nachbessern eine der beiden vergessen wird.
-->
{#snippet pfeilknopf(
	s: (typeof data.lage.kette)[number],
	richtung: 'vor' | 'zurueck',
	zeichen: string,
	wohin: string
)}
	<form
		method="POST"
		action="?/stufeVerschieben"
		use:enhance={handlung(`${richtung}:${s.id}`)}
	>
		<input type="hidden" name="stufe" value={s.id ?? ''} />
		<input type="hidden" name="richtung" value={richtung} />
		<button
			type="submit"
			class="leise pfeil"
			title="Eine Stufe {wohin}"
			aria-label="{s.name} eine Stufe {wohin}"
			data-fokus="{richtung}:{s.id}">{zeichen}</button
		>
	</form>
{/snippet}

<!--
	Ein Prüfbefund, zweimal gebraucht und einmal geschrieben (13.11.2026): Der
	Ersatzdienst hat denselben Kasten wie der Hauptdienst. Angeheftet wird an
	**den** Dienst, der gefragt wurde; sonst läge der Abdruck des einen Hauses
	in der Liste des anderen und deckte dort Stempel, die er nicht bezeugt hat.
-->
{#snippet stempelprobe(p: Zeitstempelprobe, anheftbar: boolean)}
	<div class="probe" class:gut={p.ok && !p.nurAnheftungFehlt}>
		<p>
			<strong>
				{p.nurAnheftungFehlt
					? 'Der Dienst hat gestempelt, aber sein Zertifikat ist nicht angeheftet.'
					: p.ok
						? 'Der Dienst hat gestempelt.'
						: 'Kein brauchbarer Stempel.'}
			</strong>
			{p.bemerkung}
		</p>
		{#if p.zeitpunkt}<p class="klein">Bezeugter Zeitpunkt: {p.zeitpunkt}</p>{/if}
		{#if p.fingerabdruck}
			{#if p.aussteller}<p class="klein">Aussteller laut Zertifikat: {p.aussteller}</p>{/if}
			<p class="klein">Unterzeichnet von: <code>{p.fingerabdruck}</code></p>
			{#if p.ausstellerGueltigBis}
				<p class="klein">
					Zertifikat gültig von {p.ausstellerGueltigVon} bis {p.ausstellerGueltigBis}
				</p>
			{/if}
			{#if p.angeheftet}
				<p class="klein">Dieser Aussteller ist bereits angeheftet.</p>
			{:else if anheftbar}
				<!--
					**Erst prüfen, dann anheften** (13.11.2026). Der Knopf ist der
					einzige Weg, einen gewechselten Aussteller zu übernehmen; wer
					ihn drückt, nimmt ab dann jede Antwort dieses Zertifikats an.
				-->
				<p class="klein">
					Den Namen setzt der Dienst selbst in sein Zertifikat; er beweist nichts. Heften
					Sie den Abdruck nur an, wenn er mit dem übereinstimmt, den der Anbieter selbst
					veröffentlicht. Ab dann nimmt die Anwendung jede Antwort dieses Zertifikats an.
				</p>
				<form
					method="POST"
					action={p.art === 'ersatz' ? '?/ersatzAnheften' : '?/anheften'}
					use:enhance={handlung(p.art === 'ersatz' ? 'ersatzAnheften' : 'anheften')}
				>
					<input type="hidden" name="fingerabdruck" value={p.fingerabdruck} />
					<button
						type="submit"
						data-fokus={p.art === 'ersatz' ? 'ersatzAnheften' : 'anheften'}
					>
						Dieses Zertifikat anheften
					</button>
				</form>
			{/if}
		{/if}
	</div>
{/snippet}

<svelte:head><title>Äussere Dienste</title></svelte:head>

<!--
	`tabindex="-1"`: der letzte Halt für den Fokus, wenn die auslösende Handlung
	nach dem Erfolg verschwunden ist und die Meldung in den Einblender gewandert
	ist. Anklickbar wird die Überschrift dadurch nicht, und die Tab-Reihenfolge
	ändert sich nicht — `-1` heisst «nur programmatisch erreichbar».
-->
<h1 tabindex="-1">Äussere Dienste</h1>

<!--
	Die Meldung ist das **erste** Ziel des dritten Fokusgriffs — sie trägt seit
	dem 02.09.2026 wirklich ein `tabindex="-1"` (`Meldung.svelte`), vorher stand
	die Behauptung hier und das Attribut nirgends. Bei einer Absage steht sie und
	fängt den Fokus; ein Erfolg wandert in den Einblender, dann greift die
	Überschrift oben.
-->
{#if hinweis}
	<Meldung ton="gut" marke={form}>{hinweis}</Meldung>
{:else if fehler}
	<Meldung ton="fehler" marke={form}>{fehler.nachricht}</Meldung>
{/if}

{#each hinweise as h}
	<p class="meldung warnung">{h}</p>
{/each}

<!-- `einleitung` statt `hilfe` (UI-Durchgang 06.10.2026): `.hilfe` nimmt hier
     jede Marge weg, und die erste Kachel stand 0 px unter dem Absatz. -->
<p class="einleitung">
	Beide Dienste sind <strong>freiwillig</strong>. Ohne KI bleibt jeder Schritt von Hand gehbar;
	ohne Zeitstempeldienst wird versiegelt, aber nicht von aussen bezeugt. Eine laufende Versammlung
	hängt an keinem von beiden.
</p>

{#if !data.lage.tresorBereit}
	<p class="meldung warnung">
		Es ist kein <code>{data.geheimnis.variable}</code> hinterlegt. Adresse und Modell lassen sich
		trotzdem eintragen — <strong>Zugangsschlüssel nicht</strong>, denn sie würden sonst im
		Klartext in der Datenbank stehen. Erzeugen mit <code>{data.geheimnis.erzeugen}</code>, in die
		Umgebung eintragen, Anwendung neu starten.
	</p>
{/if}

<!--
	Der Seitenstapel (02.09.2026, Task 4 aus
	`docs/plan-seitenaufbau-2026-08-27.md`) — **aber das Nebeneinander bleibt.**

	Der Plan zaehlt diese Seite zu den vieren, «wo der Gewinn am groessten ist».
	Nachgemessen stimmt das hier nicht: Beide Spalten enden fast gleich hoch, die
	ganze Seite ist 1000 px hoch, und eine Luecke gibt es nicht. Der Stilkommentar
	unten haelt die Gegenmessung vom 17.08.2026 fest — untereinander waren es
	1299 px, davon 679 allein der Zeitstempelteil, waehrend die halbe Bahn leer
	blieb. Ein Stapel machte diese Messung rueckgaengig.

	**Falsch war der Baustein, nicht die Anordnung.** `.arbeitsflaeche` bedeutet
	«Bestand links, Eintragen rechts» — hier steht links kein Bestand und rechts
	kein Formular, sondern zwei gleichrangige Dienste, die einander nichts
	angehen. `docs/gestaltung.md` sieht dafuer den Weg vor: nebeneinander
	gestellt wird innerhalb EINES Abschnitts, unter Dingen derselben Art.

	`align-items: start` und nicht `stretch`: Beide Blöcke tragen Aufklapper, und
	auf gleiche Höhe gezogen spränge der Nachbar beim Anklicken mit.
-->
<div class="seitenstapel">
	<section class="abschnitt">
		<div class="dienste">
			<section class="kachel">
				<h2>Welches Modell wird gefragt?</h2>

				{#if data.lage.kiQuelle === 'keine'}
					<p class="antwort">Keines. Die KI-Unterstützung ist aus.</p>
				{:else if data.lage.kiQuelle === 'umgebung'}
					<p class="antwort">
						{data.lage.kette[0].name} — eingestellt in der Umgebung des Servers.
					</p>
					<p class="hilfe">
						Solange die Kette dort steht, lässt sie sich hier nicht ändern: Ändern, Entfernen und
						Hinzufügen stehen erst danach zur Verfügung. Übernehmen Sie sie in die Anwendung, dann
						geht beides von hier aus — die Einträge in der Umgebung können stehen bleiben.
					</p>
					<form method="POST" action="?/uebernehmen" use:enhance={handlung('uebernehmen')}>
						<button type="submit" data-fokus="uebernehmen">In die Anwendung übernehmen</button>
					</form>
				{:else if data.lage.kette.length === 1}
					<p class="antwort">{data.lage.kette[0].name} — ohne Ausweichung.</p>
				{:else}
					<p class="antwort">{data.lage.kette[0].name} — und {data.lage.kette.length - 1} zur Ausweichung.</p>
				{/if}

				{#if data.lage.umgebungswartet > 0}
					<p class="hilfe">
						In der Umgebung stehen zusätzlich {data.lage.umgebungswartet}
						{data.lage.umgebungswartet === 1 ? 'Stufe' : 'Stufen'}. Sie gelten nicht, solange hier
						etwas eingerichtet ist.
					</p>
				{/if}

				<details>
					<summary>Was heisst das?</summary>
					<p>
						Eingerichtet werden <strong>Stufen</strong>. Stufe 1 wird zuerst gefragt; antwortet sie
						nicht, kommt Stufe 2 dran. Ausgewichen wird nur bei <strong>Ausfall</strong> —
						Zeitüberschreitung, nicht erreichbar, 429, 5xx —, nie weil eine Antwort nicht gefällt. Eine
						Prüfung so lange zu wiederholen, bis sie passt, wäre das Gegenteil einer Prüfung.
					</p>
					<p>
						Gesprochen wird OpenAI-kompatibel (<code>/chat/completions</code>). Damit geht jedes Haus,
						das diese Schnittstelle anbietet — auch ein Modell auf Ihrem eigenen Rechner, dann verlässt
						kein Wort das Haus. <strong>Die Bezeichnung steht später im Nachweis</strong> und im
						Protokollvermerk: Schreiben Sie hinein, was ein Leser wissen muss, insbesondere den
						Standort.
					</p>
					<p>
						Hier steht nur, <strong>welches</strong> Modell gefragt wird. <strong>Ob</strong> eine
						Gemeinschaft die KI überhaupt nutzt, entscheidet sie selbst — bei den Angaben der
						Gemeinschaft, Vorgabe aus. Wer die KI für ein Haus abschalten will, tut es dort; wer sie
						für die ganze Anlage abschalten will, nimmt hier alle Stufen aus der Kette.
					</p>
				</details>

				{#if data.lage.kette.length > 1 && data.lage.kiQuelle === 'anwendung'}
					<p class="hilfe reihenfolge">
						Die Pfeile stellen die Reihenfolge um — <strong>Stufe 1 wird zuerst gefragt</strong>,
						die übrigen sind die Ausweichung.
					</p>
				{/if}

				{#if data.lage.kette.length > 0}
					<ul class="stufen">
						{#each data.lage.kette as s (s.id ?? `nummer-${s.nummer}`)}
							<!--
								`{@const}` gehört unmittelbar unter den Block, nicht in ein
								Element darin — Svelte lässt es nur dort zu.
							-->
							{@const befund = befundAn(s)}
							<li>
								<!--
									Angabe links, Handlung rechts — und zwar **immer untereinander**
									auf der rechten Seite. In einer Reihe umbrach die Zeile je nach
									Länge des Modellnamens einmal so und einmal anders; zwei Zeilen
									derselben Liste standen dann verschieden hoch und lasen sich wie
									ein Fehler (docs/gestaltung.md, Regel 5).
								-->
								<div class="zeile">
									{#if s.quelle === 'anwendung' && data.lage.kette.length > 1}
										<!--
											Nichts steht ausgegraut da: Die oberste Stufe hat keinen Pfeil
											nach oben. Der Platz bleibt trotzdem stehen, sonst sässen die
											Pfeile der Zeilen auf verschiedener Höhe.
										-->
										<span class="rang">
											{#if s.nummer > 1}
												{@render pfeilknopf(s, 'vor', '↑', 'nach vorn')}
											{:else}
												<span class="pfeil leer" aria-hidden="true"></span>
											{/if}
											{#if s.nummer < data.lage.kette.length}
												{@render pfeilknopf(s, 'zurueck', '↓', 'nach hinten')}
											{:else}
												<span class="pfeil leer" aria-hidden="true"></span>
											{/if}
										</span>
									{/if}
									<span class="wer">
										<strong>{s.nummer}. {s.name}</strong>
										<span class="klein">
											{s.modell} · {sekunden(s.geduldMs)} Geduld
											{#if s.schluessel}
												<span class="marke">Schlüssel {s.schluessel}</span>
											{:else}
												<span class="marke">ohne Schlüssel</span>
											{/if}
										</span>
									</span>

									<span class="knopfreihe">
										<form
											method="POST"
											action="?/stufePruefen"
											use:enhance={handlung(`pruefen:${kennung(s)}`, { laufend: true })}
										>
											<input type="hidden" name="stufe" value={s.id ?? ''} />
											<input type="hidden" name="nummer" value={s.nummer} />
											<button
												type="submit"
												class="leise"
												disabled={laeuft === `pruefen:${kennung(s)}`}
												data-fokus="pruefen:{kennung(s)}"
											>
												{laeuft === `pruefen:${kennung(s)}` ? 'fragt an …' : 'Verbindung prüfen'}
											</button>
										</form>

										{#if s.quelle === 'anwendung'}
											<button
												type="button"
												class="leise"
												aria-expanded={offeneStufe === s.id}
												data-fokus="aendern:{s.id}"
												onclick={() => (offeneStufe = offeneStufe === s.id ? null : s.id)}
											>
												{offeneStufe === s.id ? 'Schliessen' : 'Ändern'}
											</button>
										{/if}
									</span>
								</div>

								{#if befund}
									<p class="befund" class:gut={befund.ok} role="status">{befund.bemerkung}</p>
								{/if}

								{#if offeneStufe === s.id && s.id}
									<div class="feld">
										<form
											method="POST"
											action="?/stufeAendern"
											class="formular"
											use:enhance={handlung(`speichern:${s.id}`)}
										>
											<input type="hidden" name="stufe" value={s.id} />
											<label>
												Bezeichnung
												<input name="name" required {...anfangswert(s.name)} />
											</label>
											<label>
												Adresse
												<input name="url" required {...anfangswert(s.url)} />
											</label>
											<label>
												Modell
												<input name="modell" required {...anfangswert(s.modell)} />
											</label>
											<label>
												Geduld in Millisekunden
												<input
													type="number"
													name="geduldMs"
													min={data.geduld.kleinst}
													max={data.geduld.hoechst}
													{...anfangswert(String(s.geduldMs))}
												/>
											</label>
											<label>
												Zugangsschlüssel
												<input
													type="password"
													name="schluessel"
													autocomplete="off"
													disabled={!data.lage.tresorBereit}
													placeholder={s.schluessel ? 'unverändert lassen' : 'keiner hinterlegt'}
												/>
											</label>
											<p class="hilfe">
												Leer lassen heisst <strong>unverändert</strong>. Der hinterlegte Schlüssel wird
												nie angezeigt — auch nicht als Punktereihe mit dem echten Wert dahinter.
											</p>
											{#if s.schluessel}
												<label class="ankreuz">
													<input type="checkbox" name="schluesselEntfernen" value="ja" />
													Schlüssel entfernen (für ein Modell, das keinen braucht)
												</label>
											{/if}
											<button type="submit" data-fokus="speichern:{s.id}">Stufe speichern</button>
										</form>

										<form
											method="POST"
											action="?/stufeEntfernen"
											class="leise-form entfernen"
											use:enhance={handlung(`entfernen:${s.id}`)}
										>
											<input type="hidden" name="stufe" value={s.id} />
											<button type="submit" class="leise gefahr" data-fokus="entfernen:{s.id}">
												Aus der Kette nehmen
											</button>
											{#if data.lage.kette.length === 1}
												<p class="hilfe">
													{#if data.lage.umgebungswartet > 0}
														Das ist die letzte Stufe. Ohne sie gilt wieder die Kette aus der Umgebung
														({data.lage.umgebungswartet}
														{data.lage.umgebungswartet === 1 ? 'Stufe' : 'Stufen'}) — abgeschaltet ist
														die KI damit nicht. Dafür müssen auch die Einträge
														<code>VERSAMMLUNG_KI_…</code> aus der Umgebung weg.
													{:else}
														Das ist die letzte Stufe. Ohne sie ist kein Modell mehr hinterlegt und die
														KI-Unterstützung aus.
													{/if}
												</p>
											{/if}
										</form>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				{#if data.lage.kiQuelle !== 'umgebung'}
					{#if anlegenOffen}
						<form
							method="POST"
							action="?/stufeAnlegen"
							class="formular anlegen kachel"
							use:enhance={handlung('anlegen', { beiErfolg: () => (anlegenOffen = false) })}
						>
							<h3>Stufe hinzufügen</h3>
							<label>
								Bezeichnung
								<input name="name" required placeholder="Infomaniak (CH)" />
							</label>
							<label>
								Adresse
								<input name="url" required placeholder="https://…/v1/chat/completions" />
							</label>
							<label>
								Modell
								<input name="modell" required placeholder="mistral-small-latest" />
							</label>
							<label>
								Geduld in Millisekunden
								<!--
									`anfangswert()` und nicht `value={…}`: Ein reaktiver Wert setzt
									das Feld bei jedem Neuzeichnen auf die Vorgabe zurück — auch
									dann, wenn jemand gerade etwas anderes eingetippt hat.
								-->
								<input
									type="number"
									name="geduldMs"
									min={data.geduld.kleinst}
									max={data.geduld.hoechst}
									{...anfangswert(String(data.geduld.vorgabe))}
								/>
							</label>
							<label>
								Zugangsschlüssel
								<input
									type="password"
									name="schluessel"
									autocomplete="off"
									disabled={!data.lage.tresorBereit}
									placeholder={data.lage.tresorBereit ? 'leer lassen bei einem Modell im eigenen Haus' : 'kein Geheimnis hinterlegt'}
								/>
							</label>
							<div class="knoepfe">
								<button type="submit" data-fokus="anlegen">Stufe anlegen</button>
								<button type="button" class="leise" onclick={() => (anlegenOffen = false)}>
									Abbrechen
								</button>
							</div>
						</form>
					{:else}
						<button type="button" data-fokus="anlegen" onclick={() => (anlegenOffen = true)}>
							Stufe hinzufügen
						</button>
					{/if}
				{/if}
			</section>

			<!-- ── Der Zeitstempeldienst ──────────────────────────────────── -->

			<section class="kachel">
				<h2>Wer bezeugt den Abschluss?</h2>

				{#if !ts}
					<p class="antwort">Niemand. Pakete werden versiegelt, aber nicht bezeugt.</p>
				{:else}
					<p class="antwort">
						{ts.name}{ts.fingerabdruecke.length === 0 ? ' — ohne angeheftetes Zertifikat' : ''}
					</p>
					{#if ts.quelle === 'umgebung'}
						<p class="hilfe">Eingestellt in der Umgebung des Servers.</p>
					{/if}
				{/if}

				<details>
					<summary>Was heisst das?</summary>
					<p>
						Ein Zeitstempel nach RFC 3161 bezeugt, dass das <strong>Siegel</strong> eines
						Abschlusspakets zu einem bestimmten Zeitpunkt bereits vorlag. Er sagt nichts darüber, ob
						der Inhalt richtig ist — nur, dass er damals schon so aussah. Genau das lässt sich später
						nicht mehr nachstellen.
					</p>
					<p>
						<strong>Ohne angeheftetes Zertifikat</strong> prüft die Anwendung zwar die Signatur,
						aber nicht, <em>wer</em> sie geleistet hat. Sie nähme jede Antwort an, die unter dieser
						Adresse ankommt — auch die eines Angreifers, der sich dazwischenschaltet.
					</p>
					<p>
						Holen Sie einen Prüfzeitstempel: Der Fingerabdruck kommt daraus, und ein Klick heftet
						ihn an.
					</p>
					<p>
						freetsa.org ist frei und für Entwicklung und Abnahme gut genug. Wer vor Gericht damit
						argumentieren will, nimmt einen anerkannten Anbieter. Der Wechsel kostet nichts: Alte
						Pakete behalten ihren alten Stempel.
					</p>
				</details>

				{#if ts && ts.fingerabdruecke.length > 0}
					<ul class="abdruecke">
						{#each ts.fingerabdruecke as f}
							<li><code>{f}</code></li>
						{/each}
					</ul>
				{/if}

				<div class="knoepfe">
					{#if ts}
						<form
							method="POST"
							action="?/zeitstempelPruefen"
							use:enhance={handlung('stempelprobe', { laufend: true })}
						>
							<button
								type="submit"
								disabled={laeuft === 'stempelprobe'}
								data-fokus="stempelprobe"
							>
								{laeuft === 'stempelprobe' ? 'holt Stempel …' : 'Prüfzeitstempel holen'}
							</button>
						</form>
					{/if}
					{#if !zeitstempelOffen}
						<button
							type="button"
							class="leise"
							data-fokus="zeitstempel"
							onclick={() => (zeitstempelOffen = true)}
						>
							{ts ? 'Dienst ändern' : 'Dienst eintragen'}
						</button>
					{/if}
				</div>

				{#if probeHaupt}
					{@render stempelprobe(probeHaupt, ts?.quelle === 'anwendung')}
				{/if}

				{#if zeitstempelOffen}
					<form
						method="POST"
						action="?/zeitstempel"
						class="formular anlegen kachel"
						use:enhance={handlung('zeitstempel', { beiErfolg: () => (zeitstempelOffen = false) })}
					>
						<h3>{ts ? 'Dienst ändern' : 'Dienst eintragen'}</h3>
						<label>
							Adresse
							<input name="url" required placeholder="https://freetsa.org/tsr" {...anfangswert(ts?.url ?? '')} />
						</label>
						<label>
							Bezeichnung
							<input name="name" placeholder="freetsa.org" {...anfangswert(ts?.name ?? '')} />
						</label>
						<label>
							Angeheftete Fingerabdrücke
							<textarea
								name="fingerabdruecke"
								rows="2"
								placeholder="AB:CD:… — einer je Zeile"
								>{ts?.fingerabdruecke.join('\n') ?? ''}</textarea
							>
						</label>
						<p class="hilfe">
							SHA-256, mit oder ohne Doppelpunkte — beide Schreibweisen werden erkannt und gleich
							abgelegt. Einfacher ist der Weg über «Prüfzeitstempel holen».
						</p>
						<div class="knoepfe">
							<button type="submit" data-fokus="zeitstempel">Dienst speichern</button>
							<button type="button" class="leise" onclick={() => (zeitstempelOffen = false)}>
								Abbrechen
							</button>
						</div>
					</form>
				{/if}

				{#if ts && ts.quelle === 'anwendung'}
					<form
						method="POST"
						action="?/zeitstempelEntfernen"
						class="unten"
						use:enhance={handlung('zeitstempelEntfernen')}
					>
						<button type="submit" class="leise gefahr" data-fokus="zeitstempelEntfernen">
							Zeitstempeldienst entfernen
						</button>
					</form>
				{/if}

				<!-- ── Der Ersatzdienst (13.11.2026) ─────────────────────────── -->

				<div class="unterabschnitt">
					<h3>Ersatzdienst</h3>

					<p class="hilfe">
						Springt ein, wenn der Hauptdienst keinen geprüften Stempel liefert: etwa weil er
						nicht erreichbar ist, die Anfrage abweist oder sein Zertifikat gewechselt hat.
						Ohne Hauptdienst wird auch der Ersatz nicht gefragt. Und ohne eigenes angeheftetes
						Zertifikat wird er ebenfalls nicht gefragt; sonst nähme die Anwendung jede Antwort
						an, die unter seiner Adresse ausgeliefert wird.
					</p>

					{#if !ersatz}
						<p class="antwort">Keiner eingetragen.</p>
					{:else}
						<p class="antwort">
							{ersatz.name}{ersatz.fingerabdruecke.length === 0
								? ' (ohne angeheftetes Zertifikat, springt so nicht ein)'
								: ''}
						</p>
					{/if}

					<details>
						<summary>Was heisst das?</summary>
						<p>
							Der Ersatz hat seine <strong>eigene</strong> Liste angehefteter Zertifikate. Ein
							Abdruck, der beim Hauptdienst hinterlegt ist, gilt hier nicht, und umgekehrt.
							Geprüft wird bei beiden gleich streng, nur gegen die eigene Liste.
						</p>
						<p>
							<strong>Wann er einspringt.</strong> Sobald der Hauptdienst keinen geprüften
							Stempel liefert: unerreichbar, abgewiesen oder nicht angeheftet. Nach einer
							Absage, die sich durch Wiederholen nicht ändert, schon nach einem Anlauf; sonst
							nach bis zu drei. Beim Ersatz gibt es einen einzigen Anlauf; danach steht am
							Siegel, was beide geantwortet haben. <strong>Ohne angeheftetes Zertifikat wird er
							nicht gefragt.</strong>
						</p>
						<p>
							Der häufigste Grund ist ein Wechsel des Unterzeichnerzertifikats beim Hauptdienst:
							Sein Name trägt die Jahreszahl. Bis jemand den neuen Abdruck anheftet, weist die
							Anwendung jeden seiner Stempel ab. Genau dafür ist der Ersatz da.
						</p>
					</details>

					{#if ersatz && ersatz.fingerabdruecke.length > 0}
						<ul class="abdruecke">
							{#each ersatz.fingerabdruecke as f}
								<li><code>{f}</code></li>
							{/each}
						</ul>
					{/if}

					<div class="knoepfe">
						{#if ersatz}
							<form
								method="POST"
								action="?/ersatzPruefen"
								use:enhance={handlung('ersatzprobe', { laufend: true })}
							>
								<button
									type="submit"
									disabled={laeuft === 'ersatzprobe'}
									data-fokus="ersatzprobe"
								>
									{laeuft === 'ersatzprobe' ? 'holt Stempel …' : 'Prüfzeitstempel holen'}
								</button>
							</form>
						{/if}
						{#if !ersatzOffen}
							<button
								type="button"
								class="leise"
								data-fokus="ersatz"
								onclick={() => (ersatzOffen = true)}
							>
								{ersatz ? 'Ersatzdienst ändern' : 'Ersatzdienst eintragen'}
							</button>
						{/if}
					</div>

					{#if probeErsatz}
						{@render stempelprobe(probeErsatz, true)}
					{/if}

					{#if ersatzOffen}
						<form
							method="POST"
							action="?/ersatz"
							class="formular anlegen kachel"
							use:enhance={handlung('ersatz', { beiErfolg: () => (ersatzOffen = false) })}
						>
							<h4>{ersatz ? 'Ersatzdienst ändern' : 'Ersatzdienst eintragen'}</h4>
							<label>
								Adresse
								<input
									name="url"
									required
									placeholder="https://freetsa.org/tsr"
									{...anfangswert(ersatz?.url ?? '')}
								/>
							</label>
							<label>
								Bezeichnung
								<input name="name" placeholder="Free TSA" {...anfangswert(ersatz?.name ?? '')} />
							</label>
							<label>
								Angeheftete Fingerabdrücke
								<textarea
									name="fingerabdruecke"
									rows="2"
									placeholder="AB:CD:…, einer je Zeile"
									>{ersatz?.fingerabdruecke.join('\n') ?? ''}</textarea
								>
							</label>
							<p class="hilfe">
								SHA-256, mit oder ohne Doppelpunkte: Beide Schreibweisen werden erkannt und
								gleich abgelegt. Einfacher ist der Weg über «Prüfzeitstempel holen».
							</p>
							<div class="knoepfe">
								<button type="submit" data-fokus="ersatz">Ersatzdienst speichern</button>
								<button type="button" class="leise" onclick={() => (ersatzOffen = false)}>
									Abbrechen
								</button>
							</div>
						</form>
					{/if}

					{#if ersatz}
						<form
							method="POST"
							action="?/ersatzEntfernen"
							class="unten"
							use:enhance={handlung('ersatzEntfernen')}
						>
							<button type="submit" class="leise gefahr" data-fokus="ersatzEntfernen">
								Ersatzdienst entfernen
							</button>
						</form>
					{/if}
				</div>
			</section>
		</div>
	</section>
</div>

<style>
	/*
	 * Zwei unabhängige Dienste nebeneinander statt untereinander. Gemessen am
	 * 17.08.2026 bei 1440 × 900: 1299 px in einer Spalte, davon 679 px allein
	 * der Zeitstempelteil, während rechts die halbe Bahn leer blieb.
	 *
	 * **Seit dem 02.09.2026 als Raster im Abschnitt** statt als `.arbeitsflaeche`.
	 * Dieselbe Anordnung, der zutreffende Baustein: Die Arbeitsfläche verspricht
	 * «Bestand links, Eintragen rechts», und beides gibt es hier nicht.
	 */
	.dienste {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(29rem, 100%), 1fr));
		gap: 1rem;
		align-items: start;
	}

	/* Den Abstand setzt der Abschnitt, nicht der Block. */
	section {
		margin: 0;
	}

	.antwort {
		font-size: 1.05rem;
		margin: 0.2rem 0 0.6rem;
	}

	/*
	 * Die Rückmeldungen dieser Seite standen bis zum 17.08.2026 ohne jede
	 * Gestaltung da: `.meldung` war nirgends definiert, weder hier noch in
	 * `app.css`. Ein bestätigter Prüfanruf sah damit aus wie ein Absatz Fliesstext
	 * — gemeldet als «es geschieht nicht viel».
	 */
	.meldung {
		padding: 0.6rem 0.75rem;
		border-radius: var(--radius);
		max-width: 42rem;
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}


	.stufen {
		list-style: none;
		padding: 0;
		margin: 0.8rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.stufen li {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.5rem 0.7rem;
		background: var(--flaeche);
	}

	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.5rem 0.8rem;
	}

	/*
	 * Die Angabe **schrumpft**, die Knöpfe nicht. Sonst entscheidet die Länge des
	 * Modellnamens darüber, ob eine Zeile einmal oder zweimal umbricht — und zwei
	 * Zeilen derselben Liste stünden verschieden hoch (Regel 5). Der Name bricht
	 * lieber um, als die Knopfreihe unter sich zu schieben.
	 */
	.wer {
		display: flex;
		flex-direction: column;
		flex: 1 1 12rem;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	/* Die Reihenfolge steht am linken Rand, dort wo auch die Nummer steht. */
	.rang {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	/*
	 * **Die Fingerfläche des Hauses** (UI-Durchgang 06.10.2026). Die Pfeile
	 * massen 30 × 22 px, unter der Untergrenze von 24 px; dieselbe Aufgabe auf
	 * der Reglementsseite («Reihenfolge der Standardtraktanden») trägt 44 × 44.
	 * Jetzt beide `--ziel-min`. Die Zeile wird dadurch rund 16 px höher.
	 */
	.rang .pfeil {
		display: block;
		width: var(--ziel-min);
		min-height: var(--ziel-min);
		padding: 0;
		line-height: 1.3;
		font-size: 0.95rem;
	}

	.rang .pfeil.leer {
		border: 0;
		background: none;
	}

	.reihenfolge {
		margin: 0.8rem 0 -0.4rem;
	}

	.knopfreihe {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		flex: 0 0 auto;
		margin-left: auto;
	}

	.klein .marke {
		margin-left: 0.35rem;
	}

	/*
	 * `leise`, `marke` und `gefahr` standen im Markup, ohne dass sie hier je
	 * definiert waren — wie `.meldung`. Der leise Knopf sah aus wie der
	 * Hauptknopf, und «Aus der Kette nehmen» trug keinerlei Warnfarbe.
	 */
	button.leise {
		background: transparent;
		border: 1px solid var(--linie);
		color: var(--text-leise);
	}

	button.gefahr {
		border-color: var(--fehler);
		color: var(--fehler);
	}

	.marke {
		display: inline-block;
		font-size: 0.8rem;
		padding: 0.1rem 0.6rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		color: var(--text-leise);
	}

	.klein {
		color: var(--text-leise);
		font-size: 0.85rem;
		margin: 0.2rem 0 0;
	}

	/*
	 * Der Befund steht an der Stufe, die angerufen wurde — nicht am Seitenkopf.
	 * Die Kante trägt die Aussage mit: Wer die Liste überfliegt, sieht ohne zu
	 * lesen, welche Stufe geantwortet hat.
	 */
	.befund {
		margin: 0.5rem 0 0;
		padding: 0.4rem 0.6rem;
		border-left: 4px solid var(--warnung);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
		font-size: 0.92rem;
	}

	.befund.gut {
		border-left-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
	}

	.feld {
		margin-top: 0.6rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--linie);
		display: flex;
		flex-wrap: wrap;
		gap: 1.2rem;
	}

	.formular {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 16rem;
		flex: 1 1 16rem;
	}

	.formular.anlegen {
		max-width: 34rem;
		margin-top: 1rem;
	}

	.formular label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.92rem;
	}

	.formular label.ankreuz {
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
	}

	/* Das Unumkehrbare mit dem Satz darunter, der sagt, was danach gilt. */
	.leise-form.entfernen {
		flex: 0 0 auto;
		align-self: flex-start;
		display: flex;
		flex-direction: column;
		/* Der Knopf bleibt so breit wie seine Beschriftung — über die ganze Spalte
		   gezogen wöge das Unumkehrbare schwerer als das Speichern daneben. */
		align-items: flex-start;
		gap: 0.4rem;
		max-width: 22rem;
	}

	.knoepfe {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
		margin-top: 0.6rem;
	}

	.hilfe {
		color: var(--text-leise);
		font-size: 0.85rem;
		margin: 0;
	}

	/*
	 * Umbrechen statt seitwärts rollen: In der halben Bahn stand der Abdruck
	 * abgeschnitten am Spaltenrand, und die Rollleiste sah man erst, wenn man
	 * hineinfuhr. Ein Fingerabdruck wird abgelesen, nicht überflogen.
	 */
	.abdruecke {
		list-style: none;
		padding: 0;
		margin: 0.4rem 0;
		font-size: 0.8rem;
	}

	.abdruecke code {
		word-break: break-all;
	}

	.probe {
		border: 1px solid var(--linie);
		border-left: 4px solid var(--warnung);
		border-radius: var(--radius);
		padding: 0.6rem 0.8rem;
		margin: 0.8rem 0;
		background: var(--flaeche);
	}

	/* Gelungen: die Akzentfarbe. Ein eigenes «gut» gibt es nicht — und eines zu
	   erfinden, das nur hier vorkommt, liefe auf denselben stillen Ausfall
	   hinaus, gegen den der Stilwächter gebaut wurde. */
	.probe.gut {
		border-left-color: var(--akzent);
	}

	.probe code {
		word-break: break-all;
	}

	/* Das Unumkehrbare rückt weg: leise, unten, hinter einer Linie. */
	.unten {
		margin-top: 1.5rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--linie);
	}

	/*
	 * Der Ersatzdienst steht **unter** dem Zeitstempeldienst und nicht daneben
	 * (13.11.2026). Er ist dessen Ausweichung, keine zweite Wahl derselben
	 * Stufe: Über zwei gleichrangige Kacheln läse sich die Seite, als gäbe es
	 * zwei Hauptdienste. Die Linie trägt die Zugehörigkeit, der Abstand trennt.
	 */
	.unterabschnitt {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 2px solid var(--linie);
	}

	.unterabschnitt .antwort {
		margin-bottom: 0.4rem;
	}
</style>
