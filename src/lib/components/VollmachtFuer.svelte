<script lang="ts">
	import { angekreuzt } from '$lib/felder';
	import { GRENZHINWEIS, nachweisgrenze } from '$lib/nachweisgrenze';
	import { sperrgrundAmEinlass } from '$lib/domain/vollmacht';
	/**
	 * «Vollmacht für …» — wen die bevollmächtigte Person vertritt.
	 *
	 * **Zwei Wörter, zwei Wortstämme.** Wer ausübt, heisst überall die
	 * **bevollmächtigte Person**; für wen, steht als **«Vollmacht für»**. Das
	 * frühere Paar «Vertreter / Vertretener» unterschied sich um zwei Buchstaben —
	 * in einer Liste im Saal ist das die Verwechslung eingebaut. Und
	 * «Vertretener» wäre ohnehin falsch, wo eine Gemeinschaft vertreten wird;
	 * eine Präposition braucht kein Geschlecht und kein Hauptwort.
	 *
	 * **Warum eine Suche und keine blosse Liste.** Bei vierzehn Parteien reicht
	 * eine Liste; bei hundertzwanzig ist sie eine Tapete, und am Eingang steht
	 * jemand mit drei Blättern und wartet. Getippt wird ein Namensteil, und die
	 * Liste schrumpft.
	 *
	 * **Warum zugeklappt.** Der Regelfall ist der Einlass ohne Vollmacht, und der
	 * bleibt ein Tipp. Was selten ist, darf einen Handgriff mehr kosten; was
	 * häufig ist, nicht.
	 *
	 * **Warum das Häkchen «Original liegt mir vor» vorbelegt ist.** Wer hier
	 * steht, hält es in der Hand — das ist die Lage, für die dieser Weg gebaut
	 * ist. Wer nur ein Foto bekommt, nimmt es heraus und lädt die Datei hoch.
	 * Ohne beides entsteht keine Vollmacht.
	 */
	let {
		vertretbare = [],
		offen = $bindable(false),
		/**
		 * Ob die Wahl der Vertretenen zur Sache gehört und nicht zur Auswahl steht.
		 *
		 * Beim Einlass einer dritten Person ist genau das der Fall: Sie kommt
		 * **wegen** der Vollmacht, sonst hätte sie im Saal nichts verloren. Ein
		 * Schalter «bringt Vollmachten mit», den man dort abwählen könnte, führte
		 * zu einem Formular ohne Sinn.
		 */
		zwingend = false,
		/**
		 * Ob der Nachweis mit abgefragt wird.
		 *
		 * Am Eingang ja — dort wird in einem Zug bestätigt. Beim Vorerfassen nein:
		 * Dort entsteht die Vollmacht erst, geprüft wird sie später, und ein
		 * Nachweisfeld an dieser Stelle behauptete das Gegenteil.
		 */
		mitNachweis = true,
		/**
		 * Ob der Nachweis der Mitberechtigung gemeint ist statt einer Vollmacht
		 * (Produktentscheid 03.11.2026): gewählt ist «mitberechtigt, aber nicht
		 * eingetragen». Dasselbe Häkchen und derselbe Upload, aber die
		 * Beschriftung sagt, welches Blatt vorliegen muss.
		 */
		mitberechtigung = false,
		/**
		 * Ob eine dritte Person bevollmächtigt ist. Dann fehlt der Satz, dass Votum
		 * Mitberechtigte im Register selbst erkennt: Eine dritte Person steht nie
		 * dort (`GRUNDHILFE_DRITTE`; Codeprüfung 03.11.2026, K1).
		 */
		dritte = false,
		/**
		 * Der Name der dritten Person, die gerade eingelassen wird (E3,
		 * 11.11.2026). Gegeben, gibt er Parteien frei, deren vorab erfasste
		 * Vollmacht auf denselben Namen lautet (`sperrgrundAmEinlass`); ohne ihn
		 * bleibt jede vorab erfasste Vollmacht ein Sperrgrund.
		 */
		name = undefined,
		umschalttext = 'Diese Person bringt Vollmachten mit'
	}: {
		vertretbare: {
			id: string;
			name: string;
			einheiten: string[];
			/** Warum nicht wählbar — leer heisst wählbar. Steht in der Liste. */
			gesperrt?: string | null;
			/** An wen eine vorab erfasste Vollmacht an eine dritte Person lautet. */
			vorabFuer?: string | null;
		}[];
		offen?: boolean;
		zwingend?: boolean;
		mitNachweis?: boolean;
		mitberechtigung?: boolean;
		dritte?: boolean;
		name?: string;
		umschalttext?: string;
	} = $props();

	let suche = $state('');
	let gewaehlt = $state<string[]>([]);

	/*
	 * **Gesperrte bleiben stehen, mit Grund.**
	 *
	 * Sie wegzulassen wäre bequemer und im Saal schlimmer: Wer «Christen» sucht
	 * und nichts findet, weiss nicht, ob er sich vertippt hat, ob die Person
	 * fehlt oder ob sie schon da ist — und fragt dann die Sitzungsleitung, die
	 * gerade keine Zeit hat. Ein ausgegrauter Eintrag mit «bereits anwesend»
	 * beantwortet die Frage, bevor sie gestellt wird.
	 */
	const eintraege = $derived(
		vertretbare.map((p) => ({
			...p,
			gesperrt: name === undefined ? (p.gesperrt ?? null) : sperrgrundAmEinlass(p, name)
		}))
	);

	const gefiltert = $derived(
		suche.trim().length === 0
			? eintraege
			: eintraege.filter((p) =>
					`${p.name} ${p.einheiten.join(' ')}`.toLowerCase().includes(suche.trim().toLowerCase())
				)
	);

	// Mit Namen zählt auch, wer erst mit dem richtigen Namen frei wird: Sonst
	// verschwände die Auswahl, solange das Namensfeld leer ist.
	const moeglich = $derived(
		vertretbare.filter((p) => !p.gesperrt || (name !== undefined && !!p.vorabFuer))
	);
	// Was nach einem Namenswechsel gesperrt ist, schickt das Formular nicht mehr;
	// die Zahl darunter zählt deshalb nur, was frei ist.
	const gewaehltFrei = $derived(
		gewaehlt.filter((id) => eintraege.some((p) => p.id === id && !p.gesperrt))
	);
</script>

{#if moeglich.length > 0}
	<div class="wahl">
		{#if !zwingend}
			<label class="umschalter">
				<input type="checkbox" bind:checked={offen} />
				{umschalttext}
			</label>
		{/if}

		{#if offen || zwingend}
			<div class="feld">
				<input
					type="search"
					bind:value={suche}
					placeholder="Name suchen"
					autocomplete="off"
					aria-label="Vertretene suchen"
				/>
			</div>

			<ul class="liste">
				{#each gefiltert as p (p.id)}
					<li class:gesperrt={!!p.gesperrt}>
						<label>
							<input
								type="checkbox"
								name="vertritt"
								value={p.id}
								disabled={!!p.gesperrt}
								bind:group={gewaehlt}
							/>
							<span class="name">{p.name}</span>
							{#if p.einheiten.length > 0}
								<span class="einheiten">{p.einheiten.join(', ')}</span>
							{/if}
							{#if p.gesperrt}
								<span class="grund">{p.gesperrt}</span>
							{:else if name !== undefined && p.vorabFuer}
								<span class="grund">Vollmacht auf diesen Namen erfasst</span>
							{/if}
						</label>
					</li>
				{:else}
					<li class="leer">Kein Treffer für «{suche}».</li>
				{/each}
			</ul>

			{#if gewaehltFrei.length > 0}
				<p class="gewaehlt">{gewaehltFrei.length} gewählt</p>
			{/if}

			{#if mitNachweis}
				<label class="nachweis">
					<input type="checkbox" name="nachweisVorgelegt" value="true" {...angekreuzt(true)} />
					{#if mitberechtigung}
						Der Nachweis der Mitberechtigung liegt mir vor (bei Erben die Erbbescheinigung)
					{:else}
						Das Original liegt mir vor
					{/if}
				</label>

				<label class="datei">
					{mitberechtigung
						? 'Nachweis der Mitberechtigung fotografieren oder Datei wählen (freiwillig)'
						: 'Vollmacht fotografieren oder Datei wählen (freiwillig)'}
					<input
						type="file"
						name="nachweis"
						accept="image/*,application/pdf"
						multiple
						{@attach nachweisgrenze}
					/>
					<small>{GRENZHINWEIS}</small>
				</label>

				<p class="hilfe">
					Die gewählten Vollmachten werden mit dem Einlass erfasst, belegt und <strong
						>sofort bestätigt</strong
					> — Sie prüfen sie ja gerade. Erscheint eine bevollmächtigende Partei später selbst,
					endet ihre Vertretung mit dem eigenen Einlass.
				</p>
				{#if !dritte}
					<p class="hilfe">
						Steht die Person im Register von Votum als Mitberechtigte einer gewählten
						gemeinsamen Partei, erkennt Votum das selbst: Dafür braucht es keinen Nachweis.
					</p>
				{/if}
			{/if}
		{/if}
	</div>
{/if}

<style>
	.wahl {
		border-top: 1px solid var(--linie);
		margin-top: 0.6rem;
		padding-top: 0.6rem;
		text-align: left;
	}

	.umschalter {
		/* Oben ausgerichtet: Die Beschriftung bricht auf dem Telefon um, und ein
		   mittig sitzendes Kästchen steht dann neben nichts. */
		align-items: start;
		display: flex;
		font-weight: 550;
		gap: 0.5rem;
	}

	.feld {
		margin: 0.5rem 0 0.35rem;
	}

	.feld input {
		width: 100%;
	}

	.liste {
		list-style: none;
		margin: 0;
		max-height: 15rem;
		overflow-y: auto;
		padding: 0;
	}

	.liste li {
		border-bottom: 1px solid var(--linie);
	}

	.liste label {
		align-items: baseline;
		cursor: pointer;
		display: flex;
		/* Der Sperrgrund gehört auf eine eigene Zeile; ohne Umbruch drängt er sich
		   neben die Einheiten und beides wird unlesbar. */
		flex-wrap: wrap;
		gap: 0.5rem;
		/* Fingerbreit: Am Eingang wird mit dem Daumen getippt. */
		padding: 0.55rem 0.25rem;
	}

	.name {
		font-weight: 500;
	}

	.einheiten {
		color: var(--text-leise);
		font-size: 0.85rem;
	}

	.liste li.gesperrt label {
		cursor: default;
	}

	.liste li.gesperrt .name {
		color: var(--text-leise);
		font-weight: 400;
	}

	.grund {
		color: var(--text-leise);
		flex-basis: 100%;
		font-size: 0.85rem;
		padding-left: 1.6rem;
	}

	.leer {
		color: var(--text-leise);
		padding: 0.5rem 0.25rem;
	}

	.gewaehlt {
		font-weight: 550;
		margin: 0.4rem 0 0;
	}

	.nachweis,
	.datei {
		display: block;
		margin-top: 0.6rem;
	}

	.nachweis {
		align-items: center;
		display: flex;
		gap: 0.5rem;
	}

	.hilfe {
		color: var(--text-leise);
		font-size: 0.85rem;
		margin: 0.5rem 0 0;
	}
</style>
