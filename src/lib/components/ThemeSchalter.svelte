<script lang="ts">
	/**
	 * Umschalter für helle und dunkle Darstellung.
	 *
	 * Die Voreinstellung folgt dem Gerät; eine bewusste Wahl überdauert den
	 * Neustart des Browsers. Das Setzen vor dem ersten Anstrich geschieht in
	 * app.html, hier geht es nur um die spätere Änderung.
	 */
	let gewaehlt = $state<'light' | 'dark'>('light');

	$effect(() => {
		gewaehlt = (document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light';
	});

	function umschalten() {
		gewaehlt = gewaehlt === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = gewaehlt;
		// Dieselbe Zeile wie im Vorab-Skript in `app.html`: Der eingebettete
		// Stilwert aus dem ersten Anstrich gewinnt gegen `app.css` und wuerde
		// sonst beim Umschalten stehen bleiben (02.09.2026).
		document.documentElement.style.colorScheme = gewaehlt;
		try {
			localStorage.setItem('versammlung.theme', gewaehlt);
		} catch {
			// Privater Modus: Die Wahl gilt für diese Sitzung, das genügt.
		}
	}
</script>

<button
	type="button"
	onclick={umschalten}
	aria-pressed={gewaehlt === 'dark'}
	title={gewaehlt === 'dark' ? 'Zur hellen Darstellung wechseln' : 'Zur dunklen Darstellung wechseln'}
>
	{gewaehlt === 'dark' ? '☀' : '☾'}
	<span class="beschriftung">{gewaehlt === 'dark' ? 'Hell' : 'Dunkel'}</span>
</button>

<style>
	button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Auf schmalen Geräten zählt der Platz mehr als das Wort. */
	@media (max-width: 30rem) {
		.beschriftung {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
	}
</style>
