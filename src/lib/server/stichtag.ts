/**
 * Ein Stichtag ist ein Kalendertag, oder eine Absage.
 *
 * **Die Klasse.** Ein Stichtag aus der Adresszeile (`?stichtag=…`) ging
 * ungeprüft in die Abfragen der Stimmkraft und des Eigentums. `stichtag=x`
 * endete am 16.10.2026 als rohe Ausnahme (`RangeError: Invalid time value`
 * im Treiber bzw. `22007`/`22008` an PostgreSQL), im Betrieb die 500-Seite.
 *
 * **Warum es zentral steht.** Vier Funktionen nehmen einen Stichtag entgegen,
 * der aus einer Adresse stammen kann (`stimmkraftAnsicht`, `einheitenDerPerson`,
 * `frueheresEigentumDerPerson`, `einheitenMitEigentuemerAm`). Die Prüfung in
 * jeder von Hand hiesse, die nächste zu vergessen; der Datumswächter verlangt
 * ohnehin `istKalendertag` statt eines eigenen Musters. Der Satz und die
 * Kennung sind derselbe wie in der ältesten der vier Stellen, damit die
 * Absage überall gleich lautet.
 */
import { istKalendertag } from '$lib/domain/datum';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

export function verlangeStichtag(stichtag: string): string {
	if (!istKalendertag(stichtag)) {
		throw new FachlicherFehler(
			'stichtag_ungueltig',
			'Der Stichtag ist kein gültiges Datum.',
			'stichtag'
		);
	}
	return stichtag;
}
