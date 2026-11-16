/**
 * Wer in einer Gemeinschaft namentlich vorkommt (FR-58 bis FR-63).
 *
 * **Die Liste ist der Schutz.** Ohne sie müsste geraten werden, welche
 * Wortfolge ein Name ist; mit ihr wird gesucht, was bekannt ist. Deshalb wird
 * sie breit zusammengetragen: Eigentümer, ihre Vertretungen bei juristischen
 * Personen, und die Nutzniesser. Ein Name, der hier fehlt, geht später
 * ungeschützt hinaus.
 *
 * **Aus den Stammdaten, nicht aus der Momentaufnahme.** Geprüft wird in der
 * Vorbereitung, oft lange vor der Freigabe — dann gibt es noch keine
 * Momentaufnahme. Und für diesen Zweck ist der aktuelle Stand ohnehin der
 * richtige: Geschützt werden soll, wer heute im Text steht, nicht wer bei
 * einer Freigabe stimmberechtigt war.
 */
import { alsBetreiber } from './db';
import { schild, type Namenstraeger, type Schild } from '$lib/domain/namensschutz';
import type { Id } from '$lib/domain/types';

/**
 * Alle Namen einer Gemeinschaft **und ihrer Untergemeinschaften**.
 *
 * Die Kinder gehören dazu: Ein Traktandum der Muttergemeinschaft nennt
 * regelmässig jemanden aus einem der Häuser, und ein Verbund führt an einem
 * Abend sieben Gemeinschaften.
 */
export async function namenDerGemeinschaft(operatorId: Id, stwegId: Id): Promise<Schild> {
	const traeger = await alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ id: string; name: string }[]>`
			WITH RECURSIVE abwaerts AS (
				SELECT id FROM stweg WHERE id = ${stwegId}
				UNION ALL
				SELECT k.id FROM stweg k JOIN abwaerts a ON k.parent_stweg_id = a.id
			)
			SELECT p.id::text, p.display_name AS name
			FROM party p JOIN abwaerts a ON p.stweg_id = a.id

			UNION ALL

			-- Die Vertretung einer juristischen Person oder einer Erbengemeinschaft
			-- ist eine natürliche Person und steht so auch im Text.
			SELECT p.id::text || ':v', p.representative_name
			FROM party p JOIN abwaerts a ON p.stweg_id = a.id
			WHERE p.representative_name IS NOT NULL

			UNION ALL

			SELECT n.id::text, n.holder_name
			FROM usufruct n JOIN abwaerts a ON n.stweg_id = a.id
		`;
		return zeilen as Namenstraeger[];
	});

	// Die Reihenfolge bestimmt die Nummerierung. Nach Kennung sortiert, damit
	// dieselbe Gemeinschaft zwischen zwei Prüfungen dieselben Nummern bekommt —
	// sonst wäre «[Person 3]» in zwei Befunden zufällig dieselbe Person.
	traeger.sort((a, b) => a.id.localeCompare(b.id));
	return schild(traeger);
}
