<script lang="ts">
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';

	/**
	 * Der Kasten unmittelbar nach dem Einlass, mit einem Fenster von fünf
	 * Sekunden — in beide Richtungen.
	 *
	 * **Warum überhaupt ein Fenster** (Auftraggeber, 09.09.2026): Am Eingang wird unter
	 * Zeitdruck gedrückt, und die beiden Knöpfe stehen nebeneinander. Wer den
	 * falschen erwischt, sieht es an dem Satz, der danach dasteht, und hat den
	 * Rückweg an derselben Stelle statt in einer Liste weiter unten.
	 *
	 * **Und er verschwindet von selbst.** Ein Kasten, der stehen bleibt, steht
	 * beim nächsten Menschen noch da — und dann nimmt jemand den Vermerk der
	 * vorigen Person zurück, oder setzt ihr einen.
	 *
	 * **Zwei Richtungen, ein Zählwerk** (10.09.2026, für den gemeinsamen Abend).
	 * Der Kasten hiess vorher `Papierruecknahme` und konnte nur wegnehmen. Am
	 * Abend erfasst der Kartenscanner sofort — die Kamera schickt selbst ab, und
	 * welches Haus die Karte betrifft, steht erst nach dem Auflösen des Codes
	 * fest. Dort kann die Frage nicht vorher an einem Knopf stehen, also steht
	 * sie hier: derselbe Kasten, dieselben fünf Sekunden, nur mit umgekehrtem
	 * Vorzeichen.
	 *
	 * Ein zweites Bauteil daneben hätte zwei Zählwerke gehabt, und die liefen
	 * auseinander: fünf Sekunden für das Wegnehmen, sieben für das Setzen, an
	 * derselben Handlung.
	 *
	 * **Es nimmt nur den Vermerk zurück, nicht den Einlass.** Die Anwesenheit ist
	 * nur anfügbar (AD-5); ein Eintritt lässt sich nicht wegnehmen, nur durch ein
	 * Weggehen ergänzen. Der Text sagt das, statt mehr zu versprechen, als der
	 * Knopf hält.
	 *
	 * **Warum als Komponente.** Vier Eingänge zeigen ihn: die schmale Seite fürs
	 * Telefon, die Anwesenheitssicht am Notebook, die Sitzungsleitung und der
	 * gemeinsame Abend.
	 */
	let {
		papier,
		nachtrag = null
	}: {
		/** Der eben gesetzte Vermerk — dann zeigt der Kasten den Rückweg. */
		papier: { parteiId: string; meetingId?: string } | null | undefined;
		/**
		 * Die eben erfasste Partei OHNE Vermerk — dann bietet der Kasten an, ihn
		 * nachzutragen.
		 *
		 * Nur der gemeinsame Abend füllt das. Im Haus steht die Frage an den
		 * beiden Einlassknöpfen; ein Nachtrag daneben wäre eine zweite Stelle für
		 * dieselbe Antwort.
		 */
		nachtrag?: { parteiId: string; meetingId?: string; name?: string } | null;
	} = $props();

	const FENSTER = 5;

	/**
	 * Was gerade im Kasten steht, und wie lange noch.
	 *
	 * **Eine Marke und nicht zwei Zustände.** Beide Richtungen teilen das
	 * Zählwerk; welcher Text und welches Formular dasteht, entscheidet `richtung`.
	 */
	let offen = $state<{
		richtung: 'gesetzt' | 'offen';
		parteiId: string;
		meetingId?: string;
		name?: string;
	} | null>(null);
	let restsekunden = $state(0);

	$effect(() => {
		/*
		 * **Ohne Vorgang kein Kasten — auch nicht der von vorhin** (09.09.2026,
		 * im Code-Review gefunden). Hier stand nur `return`, und der Kasten blieb
		 * mit eingefrorener Restzeit und der VORIGEN Partei stehen. Der nächste
		 * Druck auf «Zurück» hätte deren Vermerk aufgehoben — am Eingang, wo
		 * inzwischen jemand anderes vor dem Tisch steht.
		 */
		/*
		 * **Der gesetzte Vermerk geht vor.** Kommt aus einer Handlung beides
		 * zurück, ist das Setzen die jüngere Auskunft: Der Nachtrag entsteht beim
		 * Erfassen, der Vermerk beim Drücken danach.
		 */
		const vorgang = papier
			? ({ richtung: 'gesetzt', ...papier } as const)
			: nachtrag
				? ({ richtung: 'offen', ...nachtrag } as const)
				: null;
		if (!vorgang) {
			offen = null;
			return;
		}
		offen = vorgang;
		restsekunden = FENSTER;
		const uhr = setInterval(() => {
			restsekunden -= 1;
			// **Und das Zählwerk anhalten.** `offen` ist keine Abhängigkeit dieses
			// Effekts; ohne das hier liefe der Takt auf der stehenden Seite weiter
			// und zählte ins Negative.
			if (restsekunden <= 0) {
				clearInterval(uhr);
				offen = null;
			}
		}, 1000);
		return () => clearInterval(uhr);
	});

	const nachRuecknahme = absenden({
		danach: () => {
			offen = null;
		}
	});

	/**
	 * Nach dem Nachtragen bleibt der Kasten stehen.
	 *
	 * Er wechselt die Richtung: Die Handlung gibt `papier` zurück, der Effekt
	 * oben sieht es und stellt den Rückweg hin — mit frischen fünf Sekunden. Wer
	 * sich beim Nachtragen vertut, hat denselben Rückweg wie beim Einlassknopf.
	 */
	const nachNachtrag = absenden({});
</script>

{#if offen}
	<section class="entscheid" data-richtung={offen.richtung}>
		{#if offen.richtung === 'gesetzt'}
			<p>
				Vermerkt: <strong>stimmt von Hand ab.</strong> Die Sitzungsleitung überträgt die Stimmen
				dieser Partei, ihr Telefon stimmt nicht mit.
			</p>
			<form method="POST" action="?/papierZuruecknehmen" use:enhance={nachRuecknahme}>
				<input type="hidden" name="partei" value={offen.parteiId} />
				{#if offen.meetingId}
					<!-- Nur der gemeinsame Abend braucht es: Dort ist die Adresse der
					     Abend, nicht das Haus. Im Haus liest die Handlung den Pfad. -->
					<input type="hidden" name="meeting" value={offen.meetingId} />
				{/if}
				<button type="submit" class="handlung">Zurück ({restsekunden})</button>
			</form>
			<p class="klein">
				Das nimmt nur den Vermerk zurück, nicht den Einlass. Danach steht der Rückweg in der
				Anwesenheitsliste, an der Zeile dieser Partei.
			</p>
		{:else}
			<p>
				Erfasst — die Partei stimmt <strong>digital</strong> ab.
				{#if offen.name}<span class="klein">({offen.name})</span>{/if}
			</p>
			<form method="POST" action="?/papierNachtragen" use:enhance={nachNachtrag}>
				<input type="hidden" name="partei" value={offen.parteiId} />
				{#if offen.meetingId}
					<input type="hidden" name="meeting" value={offen.meetingId} />
				{/if}
				<button type="submit" class="handlung vonhand">
					Stimmt doch von Hand ({restsekunden})
				</button>
			</form>
			<!--
				**Der Satz sagt, was danach gilt, und das hat sich geändert**
				(11.09.2026). Hier stand «Danach gilt der Entscheid vom Eingang» —
				richtig zu der Zeit, als es keinen Weg mehr gab. Seit dem Rückweg an
				der Zeile ist es kein Endpunkt mehr, sondern eine Abkürzung.
			-->
			<p class="klein">
				Der schnelle Weg, solange dieselbe Person vor dem Tisch steht. Danach geht es über ihre
				Zeile in der Anwesenheitsliste.
			</p>
		{/if}
	</section>
{/if}

<style>
	.entscheid {
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche-2);
		max-width: 46rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.entscheid p {
		margin: 0;
	}

	.entscheid form {
		margin: 0;
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	/* Wie die beiden Einlassknöpfe im Haus: Der Von-Hand-Weg trägt die Linie,
	   nicht die Fläche. Er ist ein Nachtrag und keine Vorgabe. */
	button.vonhand {
		border: 2px solid var(--akzent);
	}
</style>
