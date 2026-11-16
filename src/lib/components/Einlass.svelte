<script lang="ts">
	import { enhance } from '$app/forms';
	/*
	 * Nachladen statt neu laden, Fokus zurück — jedes schreibende Formular hier
	 * trägt `absenden()`.
	 *
	 * Ohne das springt die Seite bei jeder Freigabe an den Anfang, und die
	 * Sitzungsleitung sucht die nächste wartende Person wieder.
	 *
	 * **Die Marke steht nur noch am Knopf.** Bis zum 28.08.2026 stand hier eine
	 * eigene Fabrik, und die Marke wurde zweimal geschrieben: einmal als
	 * Argument, einmal als `data-marke` daneben. Laufen die beiden auseinander,
	 * greift der Fokusgriff still nicht, und es gibt keine Stelle, an der das
	 * auffiele. `absenden()` liest sie vom gedrückten Knopf.
	 */
	import { absenden } from '$lib/absenden';
	import { schlageVor } from '$lib/domain/namensvorschlag';
	import { uhrzeit } from '$lib/domain/datum';
	import Rueckfrage from './Rueckfrage.svelte';
	import Zeichen from './Zeichen.svelte';
	import Zeilenauswahl from './Zeilenauswahl.svelte';

	/**
	 * Wer am Eingang wartet — an **einer** Stelle gebaut, an zwei gezeigt.
	 *
	 * **Warum zwei Stellen dieselbe Handlung tragen dürfen.** Die Doktrin sagt:
	 * dieselbe Handlung an zwei Orten ist eine zweite Stelle zum Suchen. Hier ist
	 * es keine zweite Stelle, sondern derselbe Kasten in zwei Sichten: Auf der
	 * Anwesenheitsseite ist der Einlass die Arbeit, in der Sitzungsleitung eine
	 * Unterbrechung, die nicht warten kann — wer während der Abstimmung erst die
	 * Seite wechseln muss, lässt den Menschen stehen. Eine Komponente, ein
	 * Aussehen, ein Verhalten; auseinanderlaufen kann es nicht.
	 *
	 * **Er verschwindet, wenn nichts wartet.** Ein Kasten, der immer dasteht und
	 * meistens leer ist, wird nicht mehr gelesen.
	 */
	/**
	 * **Am gemeinsamen Abend trägt jeder Eintrag sein Haus** (24.08.2026).
	 *
	 * Im Haus ist die Versammlung die Seite; am Abend sind es fünf, und dieselbe
	 * Handlung muss sagen, für welche sie gilt. Deshalb je Eintrag ein
	 * `meetingId` — nicht je Kasten: Wer über den Beamer meldet, meldet sich bei
	 * SEINEM Haus, und zwei Wartende können aus zwei Häusern kommen.
	 *
	 * Fehlt es (einzelne Versammlung), bleibt alles wie bisher: kein verstecktes
	 * Feld, kein Hausname in der Zeile.
	 *
	 * Die Auswahl zum Zuordnen wird nach dem Haus des Eintrags gefiltert — sonst
	 * stünden dort alle Parteien des Abends, und die Zuordnung einer Meldung aus
	 * Haus A auf eine Partei aus Haus B endete in einer Absage aus der Tiefe.
	 */
	let {
		wartende = [],
		saalmeldungen = [],
		parteien = [],
		laufend = false,
		/** Wo der Kasten steht — in der Sitzungsleitung knapper als am Eingang. */
		knapp = false
	}: {
		wartende?: {
			parteiId: string;
			name: string;
			einheiten: string[];
			meetingId?: string;
			gemeinschaft?: string;
			/**
			 * Fragt dieser Eingang, ob von Hand oder digital abgestimmt wird?
			 * (Migration 108)
			 *
			 * **Je Eintrag und nicht je Kasten**, aus demselben Grund wie
			 * `meetingId`: Am gemeinsamen Abend stehen fünf Häuser in einer Liste,
			 * und die Frage hängt an der Versammlung. Ein Schalter am Kasten
			 * beantwortete sie für alle fünf.
			 *
			 * Fehlt sie, bleibt es beim einen Knopf «Freigeben» — dann gilt, was
			 * bisher galt: Es wird digital abgestimmt.
			 */
			papierfrage?: boolean;
		}[];
		saalmeldungen?: {
			id: string;
			name: string;
			bemerkung: string | null;
			meetingId?: string;
			gemeinschaft?: string;
			/** Siehe `wartende.papierfrage` — dieselbe Frage am selben Eingang. */
			papierfrage?: boolean;
		}[];
		parteien?: {
			parteiId: string;
			name: string;
			zustand: string;
			seit: string | null;
			meetingId?: string;
		}[];
		laufend?: boolean;
		knapp?: boolean;
	} = $props();

	const zahl = $derived(wartende.length + saalmeldungen.length);

	/**
	 * Wen die Sitzungsleitung einer Meldung zuordnen könnte.
	 *
	 * **Anwesende bleiben stehen, ausgegraut, mit Grund.** Sie wegzulassen wäre
	 * die kürzere Liste und die schlechtere: Wer jemanden sucht und nicht findet,
	 * weiss nicht, ob er sich vertippt hat, ob die Person fehlt oder ob sie schon
	 * da ist. Und genau der dritte Fall ist eine Auskunft — steht die Person
	 * bereits als anwesend da, obwohl sie hier vor dem Tisch steht, fehlt eine
	 * Abmeldung. Dieselbe Überlegung wie bei den Vollmachten.
	 */
	/**
	 * Welche Partei je Saalmeldung in der Liste steht.
	 *
	 * Die Rückfrage nennt den Namen, und der steht erst fest, wenn jemand
	 * gewählt hat. Deshalb hier gehalten statt beim Abschicken aus dem
	 * Formularelement gelesen: Ein Fenster, das den Namen erst beim Öffnen
	 * zusammensucht, zeigt bei jeder Änderung der Auswahl den alten.
	 */
	let gewaehlt = $state<Record<string, string>>({});

	/**
	 * Was in der Auswahlliste hinter dem Namen steht.
	 *
	 * **Als Zeichenkette und nicht als Markup**, seit die Liste durchsucht werden
	 * kann: `Suchauswahl` sucht in dem Text, der dasteht. Wäre der Zusatz Markup,
	 * fände eine Suche nach «anwesend» ihn nicht.
	 */
	function parteizeile(p: { name: string; belegt?: boolean; seit?: string | null; vorschlag?: { grund: string } | null }): string {
		if (p.belegt) return `${p.name} — schon anwesend${p.seit ? ` seit ${uhrzeit(p.seit)}` : ''}`;
		if (p.vorschlag) return `${p.name} — ${p.vorschlag.grund}`;
		return p.name;
	}

	function nameVon(parteiId: string | undefined): string {
		if (!parteiId) return '';
		return parteien.find((p) => p.parteiId === parteiId)?.name ?? '';
	}

	function auswahl(m: { name: string; meetingId?: string }) {
		// Am Abend nur die Parteien des meldenden Hauses (siehe Kopf).
		const dazu = m.meetingId ? parteien.filter((p) => p.meetingId === m.meetingId) : parteien;
		const treffer = new Map(schlageVor(m.name, dazu).map((v) => [v.parteiId, v]));
		return dazu.map((p) => ({
			...p,
			vorschlag: treffer.get(p.parteiId) ?? null,
			belegt: p.zustand === 'anwesend'
		}));
	}
</script>

{#snippet haus(meetingId: string | undefined)}
	{#if meetingId}
		<input type="hidden" name="meeting" value={meetingId} />
	{/if}
{/snippet}

{#if zahl > 0}
	<section class="einlass" class:knapp>
		<h2>
			<span class="zeichen" aria-hidden="true">!</span>
			Am Eingang ({zahl})
		</h2>

		{#if wartende.length > 0}
			<h3>Angemeldet, wartet auf Freigabe ({wartende.length})</h3>
			<ul>
				{#each wartende as w (w.parteiId)}
					<li>
						<span class="wer">
							<strong>{w.name}</strong>
							{#if w.gemeinschaft}<span class="klein haus">{w.gemeinschaft}</span>{/if}
							{#if w.einheiten.length > 0}
								<span class="klein">{w.einheiten.join(', ')}</span>
							{/if}
						</span>
						<span class="tun">
							<form
								method="POST"
								action="?/bestaetigen"
								use:enhance={absenden()}
							>
								<input type="hidden" name="partei" value={w.parteiId} />
								{@render haus(w.meetingId)}
								<!-- Ohne Rückfrage: Am Eingang steht die Person davor, und wer
								     versehentlich freigibt, korrigiert es in der Liste darunter. -->
								{#if w.papierfrage}
								<!--
									**Enter darf hier nichts erraten.** Die beiden Knöpfe sind die Frage;
									ein Vorgabeknopf machte aus einem Tastendruck die Antwort «digital»,
									und genau die soll niemand ungefragt geben. Der Platzhalter steht
									INNERHALB des Zweiges: Ist die Frage aus, bleibt es beim einen Knopf
									und bei dem Verhalten, das er bisher hatte.
								-->
								<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
									<!--
										**Zwei gleichwertige Knöpfe, keiner vorbelegt.** Eine
										Vorauswahl wäre eine Antwort, die niemand gegeben hat, und
										sie sperrte im einen Fall ein Telefon.

										Der Wert steht am Knopf und nicht in einem Feld daneben:
										Nur so kann die Antwort nicht von dem abweichen, was
										gedrückt wurde.
									-->
									<button
										type="submit"
										name="papier"
										value="nein"
										class="handlung"
										data-ton="gut"
										disabled={!laufend}
										data-fokus="frei:{w.parteiId}"
									>
										<Zeichen art="haken" />
										Freigeben, stimmt digital
									</button>
									<button
										type="submit"
										name="papier"
										value="ja"
										class="handlung"
										disabled={!laufend}
										data-fokus="freipapier:{w.parteiId}"
									>
										<Zeichen art="haken" />
										Freigeben, stimmt von Hand
									</button>
								{:else}
									<button
										type="submit"
										class="handlung"
										data-ton="gut"
										disabled={!laufend}
										data-fokus="frei:{w.parteiId}"
									>
										<Zeichen art="haken" />
										Freigeben
									</button>
								{/if}
							</form>
							<form method="POST" action="?/ablehnen" use:enhance={absenden()}>
								<input type="hidden" name="partei" value={w.parteiId} />
								{@render haus(w.meetingId)}
								<Rueckfrage
									beschriftung="Ablehnen"
									zeichen="kreuz"
									ton="fehler"
									marke="ab:{w.parteiId}"
									gesperrt={!laufend}
									frage="Anmeldung von {w.name} ablehnen?"
									folge="Die Person kommt nicht in die Versammlung. Sie kann sich erneut anmelden."
									bestaetigen="Ablehnen"
								/>
							</form>
						</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if saalmeldungen.length > 0}
			<h3>Über den Beamer gemeldet ({saalmeldungen.length})</h3>
			<p class="klein">
				Der Name ist selbst angegeben — eine Behauptung, keine Feststellung. Ordnen Sie die
				Person der Partei zu, die Sie vor sich haben; damit gilt sie als anwesend. Zum
				<strong>Abstimmen</strong> braucht sie zusätzlich einen Code aus der Liste unten.
			</p>
			<ul>
				{#each saalmeldungen as m (m.id)}
					{@const liste = auswahl(m)}
					{@const beste = liste.find((p) => p.vorschlag && !p.belegt)}
					<li>
						<span class="wer">
							<strong>{m.name}</strong>
							{#if m.gemeinschaft}<span class="klein haus">{m.gemeinschaft}</span>{/if}
							{#if m.bemerkung}<span class="klein">{m.bemerkung}</span>{/if}
							{#if beste}
								<span class="klein hinweis">
									Vorschlag: {beste.name} — {beste.vorschlag?.grund}
								</span>
							{/if}
						</span>
						<span class="tun">
							<form
								method="POST"
								action="?/saalZuordnen"
								use:enhance={absenden()}
							>
								<input type="hidden" name="meldung" value={m.id} />
								{@render haus(m.meetingId)}
								<!--
									**Kein `bind:` auf `gewaehlt[m.id]`** (29.08.2026). Solange
									niemand gewählt hat, gibt es den Schlüssel nicht, und Svelte 5
									wirft dann beim **Rendern** `props_invalid_value`. Der Fehler
									traf nicht die Auswahl, sondern den ganzen `{#each}`-Block:
									Die Überschrift zählte «Über den Beamer gemeldet (1)»,
									darunter stand eine leere Liste, und es gab keinen Weg mehr,
									eine gemeldete Person zuzuordnen oder abzulehnen.

									`Zeilenauswahl` hält den Wert je Zeile selbst und meldet ihn
									nach oben — auch den, den `Suchauswahl` beim Aufbau meldet.
								-->
								<Zeilenauswahl
									name="partei"
									beschriftung="Partei zuordnen"
									leerText="— Partei wählen —"
									pflicht
									beiWahl={(w) => (gewaehlt[m.id] = w)}
									eintraege={liste.map((p) => ({
										wert: p.parteiId,
										text: parteizeile(p),
										deaktiviert: p.belegt
									}))}
								/>
								{#if m.papierfrage}
									<!--
										**Ein Haken und nicht zwei Knöpfe**, wie unter «Ohne Karte
										einlassen»: Dieses Formular wird ausgefüllt (Partei suchen,
										dann zuordnen), und ein zweiter Zuordnungsknopf daneben
										wäre ein zweiter Weg durch dasselbe Formular.
									-->
									<!--
										**Das versteckte «nein» sagt: hier wurde gefragt.** Ein leeres Kästchen
										schickt gar nichts, und «gefragt und verneint» sähe damit aus wie «gar
										nicht gefragt». Der Server unterscheidet die beiden seit dem 10.09.2026 und
										meldet den zweiten Fall als Lücke in der Maske; ohne dieses Feld meldete er
										ihn hier zu Unrecht. Ein angekreuztes «ja» gewinnt, `getAll` liest beide.
									-->
									<input type="hidden" name="papier" value="nein" />
									<label class="papierhaken">
										<input type="checkbox" name="papier" value="ja" />
										Stimmt an dieser Versammlung von Hand ab
									</label>
								{/if}
								<Rueckfrage
									beschriftung="Zuordnen"
									zeichen="zuordnen"
									ton="gut"
									marke="zu:{m.id}"
									gesperrt={!laufend}
									frage="«{m.name}» als {nameVon(gewaehlt[m.id])} erfassen?"
									folge="Damit gilt die Partei als anwesend und zählt für die Beschlussfähigkeit. Zum Abstimmen braucht sie zusätzlich einen Code."
									bestaetigen="Als anwesend erfassen"
								/>
							</form>
							<form
								method="POST"
								action="?/saalAblehnen"
								use:enhance={absenden()}
							>
								<input type="hidden" name="meldung" value={m.id} />
								{@render haus(m.meetingId)}
								<Rueckfrage
									beschriftung="Ablehnen"
									zeichen="kreuz"
									ton="fehler"
									marke="saalab:{m.id}"
									gesperrt={!laufend}
									frage="Meldung von «{m.name}» ablehnen?"
									folge="Sie verschwindet aus der Liste. Wer trotzdem im Saal sitzt, wird von Hand erfasst."
									bestaetigen="Ablehnen"
								/>
							</form>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style>
	/*
	 * **Der Hausname ist eine Zuordnung, keine Beschreibung** — deshalb als
	 * Marke gesetzt und nicht als weitere graue Zeile. Am gemeinsamen Abend
	 * steht er in jeder Zeile; wer ihn übersieht, gibt jemanden im falschen Haus
	 * frei.
	 */
	.einlass .haus {
		display: inline-block;
		border: 1px solid var(--rand);
		border-radius: var(--radius);
		padding: 0 0.35rem;
		margin-right: 0.35rem;
		color: var(--text);
	}

	/*
	 * Drei Träger für dieselbe Aussage, wie bei den offenen Kacheln: farbige
	 * Kante, Zeichen im Titel, Zahl. Die Kante fällt im Überfliegen auf, das
	 * Zeichen hält beim Titel, die Zahl sagt, wie viel Arbeit wartet.
	 */
	.einlass {
		border: 1px solid var(--warnung);
		border-left-width: 4px;
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.25rem;
		/*
		 * **Luft auch nach oben** (Auftraggeber, 11.09.2026, im Eingangstest gefunden).
		 * Hier stand `0 0 1.5rem`. Auf der Anwesenheitsseite steht darüber der
		 * aufgeklappte Kasten «Vertagen …» (Überschrift nach `vertagenUeberschrift`), und der
		 * trägt selbst keinen unteren Abstand: Gemessen klebte der orange Rahmen
		 * mit **0 px** am Knopf «Vertagen». Der Abstand gehört an den Kasten, der
		 * ihn braucht, nicht an jede Seite, die ihn einbaut — er steht in fünf
		 * Sichten.
		 */
		margin: 1.5rem 0;
	}

	.einlass.knapp {
		padding: 0.75rem 1rem;
		/*
		 * **Beide Kanten, nicht nur die untere** (11.09.2026, aus dem Code-Review).
		 * Hier stand allein `margin-bottom`; seit der Kasten oben 1.5rem trägt,
		 * hätte ausgerechnet die als kompakt gedachte Fassung oben MEHR Luft als
		 * unten.
		 */
		margin: 1rem 0;
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}

	.zeichen {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: var(--warnung);
		color: var(--flaeche);
		font-weight: 700;
		font-size: 0.9rem;
	}

	h3 {
		margin: 0.75rem 0 0.35rem;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-leise);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/*
	 * **Die Zeile bleibt zusammen.** Auf einem breiten Schirm zog sie den Namen
	 * nach ganz links und die Auswahl nach ganz rechts — 1500 px zwischen zwei
	 * Dingen, die zusammengehören, und das Auge muss quer über den Tisch.
	 */
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		padding: 0.5rem 0;
		border-top: 1px solid var(--linie);
		max-width: 68rem;
	}

	li:first-child {
		border-top: none;
	}

	/* Der Name nimmt den Platz, die Handlungen rücken ans Ende der Zeile. */
	.wer {
		flex: 1 1 16rem;
		max-width: 28rem;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.tun {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.tun :global(form) {
		display: contents;
	}

	.klein {
		font-size: 0.8125rem;
		color: var(--text-leise);
	}

	.hinweis {
		color: var(--text);
	}

	p.klein {
		margin: 0.25rem 0 0.5rem;
		max-width: 62ch;
	}

	/*
	 * **Dieselben Werte wie in `app.css`, weil der Weg dorthin hier nicht offen
	 * steht.** Die Feldgestaltung hängt dort an den Containerklassen `.formular`,
	 * `.felder` und `.wahlen` — und `.felder` bringt ein Rasterlayout mit, das
	 * diese Zeile auseinandernähme. Also von Hand, mit denselben Werten; wer sie
	 * dort ändert, ändert sie hier mit.
	 *
	 * Das Schrumpfen (`min-width: 0`) steht bereits global in `app.css` und wird
	 * hier nicht wiederholt.
	 */
	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	.tun :global(select),
	.tun :global(.auswahlsuche) {
		min-height: var(--ziel-min);
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		flex: 1 1 12rem;
		max-width: 24rem;
	}

	.papierhaken {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.4rem 0;
		font-size: 0.9rem;
	}

	.papierhaken input {
		width: auto;
		min-height: 0;
	}

	button {
		min-height: var(--ziel-min);
	}

</style>
