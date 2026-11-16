<script lang="ts">
	/**
	 * Die Rügen zu einem Traktandum (Ä-06, Migration 160).
	 *
	 * **Ein Feld, kein Ablauf.** Die Rüge vor der Abstimmung ist das, was das
	 * Anfechtungsrecht erhält (Wermelinger Rz. 69a ad Art. 712n). Die Anwendung
	 * hält sie fest und sperrt nichts: Ob sie begründet war, entscheidet nicht
	 * das Werkzeug. Deshalb steht das Formular zugeklappt da, solange niemand
	 * gerügt hat; es ist die Ausnahme, nicht ein Schritt jedes Traktandums.
	 *
	 * **Auch während einer Abstimmung sichtbar**, anders als die Pendenzen: Die
	 * Rüge gehört gerade in den Augenblick vor und um die Abstimmung.
	 */
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import { anfangswert } from '$lib/felder';
	import { uhrzeit } from '$lib/domain/datum';
	import { RUEGE_HOECHSTENS, RUEGENDE_HOECHSTENS, type Ruege } from '$lib/domain/ruege';

	interface Eigenschaften {
		traktandumId: string;
		ruegen: Ruege[];
	}

	/*
	 * Kein Schalter für «nur lesen»: Die Leitungsseite zeigt ein Traktandum nur,
	 * solange die Versammlung läuft, und genau so lange lässt der Server die
	 * Rüge zu (`server/ruege.ts`, Codeprüfung H8, M1 und N4).
	 */
	let { traktandumId, ruegen }: Eigenschaften = $props();

	/*
	 * **Die Uhrzeit wird vorbelegt, sobald jemand ins Formular geht**, nicht beim
	 * Laden der Seite: Im Saal steht die Seite eine Stunde offen, und eine
	 * Uhrzeit vom Seitenaufbau wäre gerade dann falsch, wenn es darauf ankommt.
	 * Nach dem Absenden leert `absenden()` das Formular; beim nächsten Betreten
	 * kommt die dann gültige Uhrzeit. Das Feld bleibt änderbar, weil oft erst
	 * nach dem Wortwechsel erfasst wird.
	 */
	let zeitfeld: HTMLInputElement | null = $state(null);
	function belegeUhrzeit() {
		if (zeitfeld && !zeitfeld.value) zeitfeld.value = uhrzeit(new Date().toISOString());
	}
</script>

<section class="ruegen">
	{#if ruegen.length > 0}
		<h4>Rügen</h4>
		<ul>
			{#each ruegen as r (r.id)}
				<li>
					<p class="satz">
						<strong>{r.uhrzeit} Uhr, {r.wer}</strong>:&#32;{r.wortlaut}
					</p>
					<p class="klein">
						{#if r.entscheid}Vorgehen des Vorsitzes: {r.entscheid}{:else}Kein Vorgehen des Vorsitzes festgehalten.{/if}
					</p>
					<!--
						Die Zeile verschwindet; der Fokus geht auf den Kopf des
						Erfassungskastens, der immer dasteht. Das Feld darin liegt
						zugeklappt und wäre kein Ziel (Codeprüfung H8, N4).
					-->
					<form
						method="POST"
						action="?/ruegeEntfernen"
						class="weg"
						use:enhance={absenden({ marke: 'ruegeNeu' })}
					>
						<input type="hidden" name="ruege" value={r.id} />
						<Rueckfrage
							beschriftung="Rüge entfernen"
							zeichen="kreuz"
							ton="warnung"
							frage="Die Rüge von {r.wer} um {r.uhrzeit} Uhr entfernen?"
							folge="Sie fehlt danach im Protokollentwurf und im Abschlusspaket. Im Verlauf bleibt sie mit Wortlaut stehen. Gehört sie zu einem anderen Traktandum, erfassen Sie sie dort neu, mit der ursprünglichen Uhrzeit."
							bestaetigen="Entfernen"
						/>
						<span class="klein"
							>Nur, wenn sie beim falschen Traktandum steht oder irrtümlich erfasst wurde. Zieht jemand
							seine Rüge zurück, lassen Sie sie stehen und halten den Rückzug im Feld «Voten, Begründungen,
							Ordnungsentscheide» fest.</span
						>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<details>
		<summary data-fokus="ruegeNeu">Rüge festhalten</summary>
		<form
			method="POST"
			action="?/ruegeErfassen"
			class="neu"
			use:enhance={absenden()}
			onfocusin={belegeUhrzeit}
		>
			<input type="hidden" name="traktandum" value={traktandumId} />
			<div class="felder">
				<label>
					Wer rügt
					<input
						name="wer"
						{...anfangswert('')}
						required
						maxlength={RUEGENDE_HOECHSTENS}
					/>
				</label>
				<label>
					Uhrzeit im Saal
					<input
						name="uhrzeit"
						bind:this={zeitfeld}
						{...anfangswert('')}
						required
						inputmode="numeric"
						placeholder="19:45"
						maxlength="5"
					/>
				</label>
				<label class="voll">
					Was wird gerügt
					<textarea name="wortlaut" required rows="2" maxlength={RUEGE_HOECHSTENS}></textarea>
				</label>
				<label class="voll">
					Vorgehen des Vorsitzes (freiwillig)
					<textarea
						name="entscheid"
						rows="2"
						maxlength={RUEGE_HOECHSTENS}
						placeholder="Wie es weitergeht, nicht ob die Rüge zutrifft"
					></textarea>
				</label>
				<button type="submit" class="haupt" data-fokus="ruegeErfassen:{traktandumId}">
					Rüge festhalten
				</button>
			</div>
			<!--
				Laien- und Fachprüfung H8 (R1, R1-c, R3-b) und 14.11.2026 (andere Mängel,
				drei Runden, quellen fragen.md Nr. 92): «Im Ablauf» und «erkennen kann»
				grenzen auf Verfahrensmängel ein, die vorher erkennbar sind; für den Inhalt
				und für vorher nicht erkennbare Mängel gilt die Rügeobliegenheit nicht. Ob
				sie für die angesagte Mehrheit gilt, ist offen, deshalb ein eigener Satz
				ohne «muss». «Strengeres Mehr», weil die Anwendung im Saal kein milderes
				zulässt. Für die Längenschranke sind zwei Sätze der freigegebenen Fassung am
				Semikolon geteilt; aus dem ersten sind die Beispiele in einen eigenen Satz
				gerückt (Laienblick 14.11.2026). «Im Protokoll» gilt für beide: das des
				Hauses und das gemeinsame eines Abends, dort ohne Namen.
			-->
			<p class="klein">
				Für einen Mangel im Ablauf, den man schon vor der Abstimmung erkennen kann: Wer deswegen
				anfechten will, muss ihn in der Regel vor der Abstimmung rügen. Solche Mängel betreffen etwa
				die Einladung, die Traktanden oder den Ausstand. Hält jemand die angesagte Mehrheit für falsch, halten
				Sie das ebenso fest und prüfen sie unter «Nötige Mehrheit ändern», bevor Sie die
				Abstimmung freigeben. Ob es dafür eine Rüge braucht, ist nicht geklärt. Für den Inhalt
				eines Beschlusses und für einen Mangel, den man vorher nicht erkennen konnte, braucht es
				keine Rüge. Ist die Rüge begründet, beheben Sie den Mangel im Saal, wo das geht, etwa mit
				dem Ausstand, oder, wenn die angesagte Mehrheit zu mild war, mit der richtigen, strengeren.
				Sonst ist Verschieben meist der sichere Weg, und darüber beschliesst die Versammlung.
			</p>
			<p class="klein">
				Betrifft sie die ganze Versammlung, halten Sie sie beim ersten Traktandum fest und
				schreiben das dazu. Die Rüge kommt in den Protokollentwurf, der nach dem Schluss entsteht,
				in den Verlauf und ins Abschlusspaket. Sie hält nichts auf und ficht selbst nichts an:
				Anfechten muss die Person selbst, beim Gericht.
			</p>
		</form>
	</details>
</section>

<style>
	.ruegen {
		margin-top: 0.75rem;
		border-top: 1px solid var(--linie);
		padding-top: 0.6rem;
	}

	.ruegen h4 {
		margin: 0 0 0.4rem;
		font-size: 1rem;
	}

	.ruegen ul {
		list-style: none;
		margin: 0 0 0.6rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ruegen li {
		border-left: 3px solid var(--akzent);
		padding-left: 0.6rem;
	}

	.satz {
		margin: 0;
	}

	.ruegen summary {
		min-height: var(--ziel-min);
		padding: 0.35rem 0;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.felder {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: 0.4rem 0.6rem;
		margin: 0.4rem 0;
	}

	.felder label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-weight: 550;
	}

	.felder label.voll {
		grid-column: 1 / -1;
	}

	.felder input,
	.felder textarea {
		min-height: var(--ziel-min);
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		max-width: 100%;
		box-sizing: border-box;
	}

	.felder button {
		min-height: var(--ziel-min);
		align-self: end;
		padding: 0 1.1rem;
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
		white-space: nowrap;
	}

	.ruegen p.klein {
		margin: 0.2rem 0 0;
	}

	.weg {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.4rem;
	}
</style>
