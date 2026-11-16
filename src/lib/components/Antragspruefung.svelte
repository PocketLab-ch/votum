<script lang="ts">
	/**
	 * Die Zulässigkeitsprüfung eines im Saal gestellten Folgeantrags (FR-60).
	 *
	 * **Eine Frage, eine Sekunde.** Was sich rechnen lässt — Erfordernis-
	 * verschiebung, Zugehörigkeit zur Versammlung, Ankündigung — steht schon
	 * fest; gefragt wird nur, ob der Antrag im Sachbereich des angekündigten
	 * Geschäfts bleibt (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 3).
	 *
	 * **Als Komponente seit dem 24.08.2026** (Auftraggeber: «Die Gruppenveranstaltung
	 * muss dasselbe können wie die Einzelveranstaltung»). Am gemeinsamen Abend
	 * gab es sie nicht — obwohl gerade dort Folgeanträge entstehen und die Frage
	 * «gehört das noch zum angekündigten Punkt?» sich für jedes Haus einzeln
	 * stellt.
	 *
	 * Der Knopf und das Ergebnis stehen zusammen, weil sie zusammengehören: Das
	 * Ergebnis erscheint unter dem Antrag, zu dem gefragt wurde, und nirgends
	 * sonst.
	 */
	import { enhance } from '$app/forms';
	import Meldung from './Meldung.svelte';
	import Modellantwort from './Modellantwort.svelte';
	import { EINSCHAETZUNGSNAMEN, abweichungNachKlick, empfehlung } from '$lib/domain/antragspruefung';

	import type { Beurteilung } from '$lib/domain/antragspruefung';

	interface Pruefung {
		traktandumId: string;
		grund?: string | null;
		beurteilung?: Beurteilung | null;
		fehlschlaege: string[];
		/** Welches Modell geantwortet hat — null, wenn keines antwortete. */
		stufe: string | null;
		dauerMs: number;
		nutzungId?: string | null;
		hinausgegangen: string;
	}

	interface Eigenschaften {
		traktandumId: string;
		/** Ob überhaupt gefragt werden kann — Einrichtung, Zulassung, Ausnahmen. */
		moeglich: boolean;
		/** Die Antwort aus der letzten Anfrage, falls sie zu diesem Antrag gehört. */
		pruefung?: Pruefung | null;
		/** Am Abend: das Haus, in dem der Antrag liegt. Null in der Leitung eines Hauses. */
		mitVersammlungId?: string | null;
		/**
		 * Die Fundstelle, wenn das Reglement Beschlüsse über nicht Angekündigtes
		 * gestattet (Migration 127). Dann nennt die Empfehlung diesen Weg.
		 */
		ausnahmeReglement?: string | null;
		/** Ob die Gemeinschaft die Universalversammlung zulässt (Migration 128). */
		universalZugelassen?: boolean;
	}

	let {
		traktandumId,
		moeglich,
		pruefung = null,
		mitVersammlungId = null,
		ausnahmeReglement = null,
		universalZugelassen = false
	}: Eigenschaften = $props();

	const dazu = $derived(pruefung?.traktandumId === traktandumId ? pruefung : null);

	/*
	 * **Der Satz nach «Ich entscheide anders»** (`docs/freigabe.md`, Punkt 13).
	 * Die Antwort auf den Klick ersetzt das Prüfergebnis, und der Kasten
	 * verschwindet. Die Einschätzung wird deshalb beim Absenden gemerkt und der
	 * Satz danach an seiner Stelle gezeigt, gebunden an diesen Antrag.
	 */
	let abweichung = $state<{ traktandumId: string; satz: string } | null>(null);

	// Ein anderer Antrag aufgerufen: Der Satz gehört nicht mehr hierher und käme
	// sonst beim Zurückkehren ohne Kasten wieder (Codeprüfung 30.09.2026, B4).
	$effect(() => {
		if (abweichung && abweichung.traktandumId !== traktandumId) abweichung = null;
	});

	function merkeAbweichung({ submitter }: { submitter: HTMLElement | null }) {
		const b = dazu?.beurteilung;
		// Beim Absenden festhalten, nicht nach dem Nachladen: Bis dahin kann ein
		// anderer Antrag aufgerufen sein (B3).
		const geklickt = traktandumId;
		const klick = submitter instanceof HTMLButtonElement ? submitter.value : '';
		const satz = b ? abweichungNachKlick(b, klick) : null;
		return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
			await update();
			abweichung =
				result.type === 'success' && satz && geklickt === traktandumId
					? { traktandumId: geklickt, satz }
					: null;
		};
	}
</script>

{#snippet mitVersammlung()}
	{#if mitVersammlungId}
		<input type="hidden" name="versammlung" value={mitVersammlungId} />
	{/if}
{/snippet}

{#if moeglich}
	<form method="POST" action="?/kiantrag" use:enhance={() => {
		abweichung = null;
	}}>
		<input type="hidden" name="traktandumId" value={traktandumId} />
		{@render mitVersammlung()}
		<button type="submit" class="leise" title="Bleibt der Antrag im angekündigten Geschäft?">
			Zulässigkeit prüfen
		</button>
	</form>
{/if}

{#if dazu}
	<div class="antragspruefung">
		{#if dazu.grund}
			<p class="fehlschlag">{dazu.grund}</p>
		{:else if !dazu.beurteilung}
			<p class="fehlschlag">
				Keine Einschätzung möglich: {dazu.fehlschlaege.join(' · ')}. Die Sitzung geht ohne sie
				weiter.
			</p>
		{:else}
			<!--
				**Die Empfehlung zuerst, die Einordnung darunter.** «Verlässt das
				angekündigte Geschäft» klingt nach Feststellung. Es ist aber die
				Einschätzung eines Modells, das drei Zeilen Text gelesen hat —
				entschieden wird hier nichts.
			-->
			<p class="empfehlung {dazu.beurteilung.einschaetzung}">
				{empfehlung(dazu.beurteilung, ausnahmeReglement, universalZugelassen).satz}
			</p>
			<!--
				**Die Begründung trägt eine Umrandung** (Audit B-09). Der Satz der
				Empfehlung stammt aus der Anwendung; die Begründung und das neue Thema
				sind freier Text des Modells, gelesen aus dem Antragstext — und der
				stammt von demjenigen, über dessen Antrag hier entschieden wird.
			-->
			<!-- `stufe` darf null sein — `modellherkunft` kennt den Fall. -->
			<Modellantwort stufe={dazu.stufe} zusatz="{(dazu.dauerMs / 1000).toFixed(1)} s">
				<p class="warum">
					<span class="einordnung">
						{EINSCHAETZUNGSNAMEN[dazu.beurteilung.einschaetzung]}:
					</span>
					{dazu.beurteilung.begruendung}
				</p>
				{#if dazu.beurteilung.neuesThema}
					<p class="neu">Neu darin: {dazu.beurteilung.neuesThema}</p>
				{/if}
			</Modellantwort>
			<p class="wersagts">
				<strong>Sie entscheiden, nicht das Werkzeug.</strong> Die Leitung der Versammlung liegt
				bei Ihnen; das hier ist eine Empfehlung und kein Ergebnis.
			</p>
			{#if dazu.nutzungId}
				<form method="POST" action="?/kiantragentscheid" use:enhance={merkeAbweichung}>
					<input type="hidden" name="nutzungId" value={dazu.nutzungId} />
					<span class="frageentscheid">Ihr Entscheid:</span>
					<button type="submit" name="entscheid" value="angenommen" class="leise" data-vorgabe="angenommen">
						Ich folge der Empfehlung
					</button>
					<button type="submit" name="entscheid" value="abgelehnt" class="leise">
						Ich entscheide anders
					</button>
				</form>
			{/if}
			<details class="hinausgegangen">
				<summary>Was übermittelt wurde</summary>
				<pre>{dazu.hinausgegangen}</pre>
			</details>
		{/if}
	</div>
{:else if abweichung?.traktandumId === traktandumId}
	<!-- Eine Meldung auf eine Handlung, also die Komponente: mit `role="status"`
	     für die Sprachausgabe und wegzudrücken (B1). Sie rollt nicht, sondern
	     steht an der Stelle des Kastens, also dort, wo geklickt wurde. -->
	<div class="abweichung">
		<Meldung ton="warnung" marke={abweichung} beimSchliessen={() => (abweichung = null)}>
			{abweichung.satz}
		</Meldung>
	</div>
{/if}

<style>
	/* ── Die Antragsprüfung im Saal (FR-60) ───────────────────────────────── */
	.antragspruefung {
		margin: 0 0 0.6rem;
		padding: 0.5rem 0.75rem;
		border-left: 3px solid var(--linie);
		background: var(--flaeche-2);
		font-size: 0.9rem;
	}
	.antragspruefung .empfehlung {
		margin: 0;
		font-weight: 600;
	}
	.antragspruefung .empfehlung.sachfremd {
		color: var(--fehler);
	}
	.antragspruefung .empfehlung.grenzwertig {
		color: var(--warnung);
	}
	.antragspruefung .einordnung {
		color: var(--text-leise);
	}
	.antragspruefung .frageentscheid {
		margin-right: 0.3rem;
	}
	.antragspruefung .warum,
	.antragspruefung .neu,
	.antragspruefung .wersagts {
		margin: 0.25rem 0 0;
	}
	.abweichung {
		margin: 0 0 0.6rem;
	}
	.antragspruefung .fehlschlag {
		margin: 0;
		color: var(--warnung);
	}
	.antragspruefung .hinausgegangen pre {
		margin: 0.3rem 0 0;
		padding: 0.4rem;
		overflow-x: auto;
		white-space: pre-wrap;
		background: var(--flaeche);
		border: 1px dashed var(--linie);
		font-size: 0.8rem;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 0.7rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}
</style>
