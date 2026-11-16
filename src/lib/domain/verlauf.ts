/**
 * Ereignisse und Zustandsübergänge des Kerns (AD-1, AD-5).
 *
 * Ein Übergang berechnet nicht nur den neuen Zustand, sondern gibt auch zurück,
 * was dabei geschehen ist. Damit kann die Schale beides in derselben Transaktion
 * schreiben, und es gibt keinen Weg, eine Änderung ohne ihren Verlaufseintrag
 * durchzubringen — der Eintrag ist Teil des Rückgabewerts, nicht ein zweiter
 * Aufruf, den man vergessen kann.
 *
 * Der Kern setzt bewusst keinen Zeitstempel: Er liest nie die Uhr (sonst wären
 * seine Funktionen nicht mehr mit einer Wertetabelle prüfbar). Die Zeit kommt
 * beim Schreiben aus der Datenbank, zusammen mit dem Vermerk ihrer Quelle.
 */

import { strenge, type Ergebnistyp } from './regelwerk';

/**
 * Ereignisarten als geschlossene Liste.
 *
 * Freie Zeichenketten wären hier gefährlich: Ein Tippfehler in der Art führt zu
 * keinem Fehler, sondern zu einem Verlaufseintrag, den später niemand findet.
 * Die Lücke fiele erst auf, wenn sie gebraucht würde — im Streitfall.
 */
export const EREIGNISARTEN = {
	benutzerAngelegt: 'user.provisioned',
	anmeldung: 'user.login',
	anmeldungFehlgeschlagen: 'user.login.failed',
	abmeldung: 'user.logout',

	/*
	 * **Konten und Kennwörter** (13.08.2026). Bis dahin gab es dafür nur das
	 * Anlegeskript — und damit auch keine Spur, wer wann wem den Zugang gab oder
	 * nahm. Gerade das gehört in den Verlauf: Wer eine Versammlung führen darf,
	 * ist eine Befugnis wie jede andere.
	 */
	kennwortGeaendert: 'user.password.changed',
	kennwortGesetzt: 'user.password.set',
	kontoAngelegt: 'user.created',
	kontoRolleGeaendert: 'user.role.changed',
	kontoAusserDienst: 'user.disabled',
	kontoInDienst: 'user.enabled',
	kontoAngabenGeaendert: 'user.details.changed',
	/*
	 * **Der Moment, in dem ein Konto von aussen erreichbar wird** (15.09.2026).
	 * Das Öffnen des Fensters ist eine Handlung der Verwaltung, die Verknüpfung
	 * selbst geschieht danach ohne sie — und ohne diese beiden Einträge liesse
	 * sich hinterher nicht sagen, wer wann welche Kennung an welches Konto
	 * gebunden hat.
	 */
	kontoVerknuepfungGeoeffnet: 'user.link.opened',
	kontoVerknuepfungGeschlossen: 'user.link.closed',
	kontoVerknuepft: 'user.link.established',
	kontoVerknuepfungAbgewiesen: 'user.link.rejected',
	kontoVerknuepfungGeloest: 'user.link.released',

	/*
	 * **Äussere Dienste** (14.08.2026). Wer welches Modell befragt und welcher
	 * Stelle die Anwendung einen Zeitstempel abnimmt, ist keine Einstellung wie
	 * die Schriftgrösse: Am Modell hängt, was die Vorschläge im Saal taugen, am
	 * Zeitstempeldienst der Beweiswert jedes Abschlusspakets. Ein Wechsel gehört
	 * deshalb in den Verlauf — **ohne Schlüssel**, nur mit Name, Adresse und
	 * Modell.
	 */
	kistufeAngelegt: 'ai.stage.created',
	kistufeGeaendert: 'ai.stage.changed',
	/**
	 * Eigene Art, nicht «geändert»: Umgestellt wird nicht der Eintrag, sondern
	 * **welches Modell im Saal antwortet**. Wer später fragt, warum ein anderes
	 * Haus im Protokollvermerk steht, sucht genau diesen Eintrag.
	 */
	kistufeUmgestellt: 'ai.stage.moved',
	kistufeEntfernt: 'ai.stage.removed',
	/*
	 * **Was die Sitzungsleitung mit einem Vorschlag gemacht hat** (Produktentscheid
	 * 30.09.2026: «Ja, soll er. Dann ist alles dokumentiert.»). Bis dahin stand
	 * der Entscheid nur in `ai_usage.outcome`, eine Zeile, die sich überschreiben
	 * lässt. Der Verlauf ist nur anfügbar und geht ins Siegelpaket.
	 */
	kiEntscheid: 'ai.decision.recorded',
	zeitstempeldienstGesetzt: 'tsa.configured',
	zeitstempeldienstEntfernt: 'tsa.removed',
	/**
	 * Der Ersatzdienst (13.11.2026).
	 *
	 * **Eigene Arten und nicht «geändert».** An ihm hängt, welche zweite Stelle
	 * ein Siegel bezeugen darf, wenn der Hauptdienst ausfällt. Wer später ein
	 * Paket mit einem Stempel der Ersatzstelle vor sich hat, sucht genau den
	 * Eintrag, der sie zugelassen hat; die beiden Arten sagen, wann.
	 */
	zeitstempeldienstErsatzGesetzt: 'tsa.fallback.configured',
	zeitstempeldienstErsatzEntfernt: 'tsa.fallback.removed',

	/**
	 * Archiviert und hervorgeholt (Migration 086).
	 *
	 * **Eine Art für alle vier Gegenstände**, unterschieden über `gegenstandArt`.
	 * Vier Ereignisarten wären vier Beschriftungen, die dasselbe sagen — und die
	 * Verlaufssuche filtert ohnehin nach Gegenstand.
	 */
	archiviert: 'record.archived',
	hervorgeholt: 'record.unarchived',
	gemeinschaftAngelegt: 'stweg.created',
	gemeinschaftEntfernt: 'stweg.removed',
	gemeinschaftGeaendert: 'stweg.updated',
	einheitAngelegt: 'unit.created',
	einheitGeaendert: 'unit.updated',
	/**
	 * Eine Einheit entfernt (22.08.2026).
	 *
	 * Nur möglich, solange sie an keiner freigegebenen Versammlung teilgenommen
	 * hat — sonst stünde im Protokoll eine Wertquote, deren Einheit es nicht mehr
	 * gibt. Der Eintrag hält fest, was mitging: Zuordnungen, Quoten,
	 * Nutzniessungen.
	 */
	einheitEntfernt: 'unit.removed',
	/** Die Person ueber den Gemeinschaften (Voraussetzung fuer Story 7.6). */
	personAngelegt: 'person.created',
	/**
	 * Die Stammangaben einer Person berichtigt (22.08.2026).
	 *
	 * Bis dahin gab es im ganzen Servercode kein `UPDATE person`: Ein Tippfehler
	 * im Namen blieb für immer, und eine neue E-Mail liess sich nicht nachtragen —
	 * obwohl sie den Zugangscode trägt.
	 */
	personGeaendert: 'person.updated',
	personVerknuepft: 'party.person.linked',
	personGeloest: 'party.person.unlinked',

	eigentuemerAngelegt: 'party.created',
	eigentuemerGeaendert: 'party.updated',
	/*
	 * **Mitberechtigte an gemeinschaftlichem Eigentum** (26.08.2026, Migration
	 * 094). Wer zu einer Hülle gehört, entscheidet nicht über die Stimme — die
	 * hängt an der Einheit —, sondern darüber, wer nach ZGB Art. 712n eine
	 * eigene Einladung bekommt. Eine unterbliebene Einladung macht den Beschluss
	 * anfechtbar; wer später fragt, warum jemand keine erhielt, findet hier,
	 * wann er auf- oder abgenommen wurde.
	 */
	mitberechtigterAufgenommen: 'party.member.added',
	mitberechtigterEntfernt: 'party.member.removed',
	/*
	 * **Die gemeldete Zustelladresse** (Rz. 49/51 ad Art. 712n) — nicht im Plan,
	 * beim Umsetzen ergänzt. Sie ist die Ausnahme von «alle einzeln»: Ist eine
	 * bestimmt, genügt die Zustellung dorthin, und die übrigen Mitberechtigten
	 * bekommen keine eigene Sendung mehr. Eine Einstellung, die einer Person die
	 * Einladung nimmt, gehört in den Verlauf.
	 */
	zustelladresseGemeldet: 'party.member.delivery.set',
	zustelladresseAufgehoben: 'party.member.delivery.cleared',
	/*
	 * **Der Wechsel der Vertretung** (26.08.2026, Aufgabe 3). Wer die eine Stimme
	 * einer Hülle abgibt, ist nach ZGB Art. 712o Abs. 1 die entscheidende Angabe
	 * des Abends — am Einlass wie beim Auszählen. Ein Wechsel am Vortag einer
	 * Versammlung muss nachher belegbar sein, und zwar mit beiden Namen: dem
	 * vorherigen und dem neuen.
	 */
	vertretungGewechselt: 'party.representative.changed',
	/**
	 * Eine Eigentümerzeile getilgt (23.08.2026).
	 *
	 * Nur für Zeilen, die nie etwas gehalten und an keiner Versammlung
	 * teilgenommen haben — sonst wäre es Geschichtsfälschung. Der Eintrag bleibt
	 * trotzdem im Verlauf: Wer sich fragt, warum die Gemeinschaft gestern
	 * sechzehn und heute fünfzehn Zeilen hat, findet hier die Antwort.
	 */
	eigentuemerGetilgt: 'party.deleted',
	/**
	 * Eine Person gelöscht (Auftraggeber, 25.08.2026: «Personen sollen eine Löschung
	 * bekommen, wenn sie keiner Einheit zugeordnet sind»).
	 *
	 * Dieselbe Schranke wie beim Tilgen einer Zeile, nur über alle ihre Zeilen
	 * hinweg — und die leeren Zeilen gehen mit. Der Eintrag hält fest, wie viele
	 * es waren: Sonst bliebe unerklärlich, warum eine Gemeinschaft eine Zeile
	 * weniger hat, obwohl niemand dort etwas getan hat.
	 */
	personGeloescht: 'person.deleted',
	eigentumZugeordnet: 'ownership.assigned',
	eigentumBeendet: 'ownership.ended',
	nutzniessungErfasst: 'usufruct.created',
	nutzniessungBeendet: 'usufruct.ended',
	/**
	 * Der Name des Nutzniessers berichtigt (23.08.2026).
	 *
	 * Eigene Art, weil es die Schreibweise ändert und nicht das Recht: Im
	 * Prüflauf stand «zugunsten von BNUT» — eine Referenz aus der CSV-Spalte
	 * statt eines Namens —, und es gab keinen Weg zurück.
	 */
	nutzniessungGeaendert: 'usufruct.holder.corrected',
	/** Wer die eine Stimme einer Mitgliedsgemeinschaft abgibt (Story 7.2). */
	vertreterBezeichnet: 'representation.designated',
	vertretungBeendet: 'representation.ended',
	uebernahmeBestaetigt: 'import.applied',

	/** Die Weisung eines Hauses an seinen Vertreter (Stories 7.3, 7.4). */
	weisungErfasst: 'instruction.recorded',
	weisungBerichtigt: 'instruction.corrected',
	weisungsbindungGesetzt: 'agenda.item.instruction.bound',

	erfordernisGesetzt: 'requirement.set',
	erfordernisUebersteuert: 'requirement.overridden',
	/**
	 * Das Mehr eines Traktandums nach der Freigabe und vor Beginn gemildert
	 * (Produktentscheid 06.10.2026, `domain/einladungsmehr.ts`). Die Untergrenze
	 * wandert mit, der Versandvermerk fällt zurück; der Eintrag hält fest, was
	 * die Einladung vorher nannte.
	 */
	einladungsmehrGemildert: 'requirement.relaxed.after.release',
	/**
	 * Vor dem neuen Versand wieder auf das Mehr der Einladung oder strenger
	 * gestellt (Laienprüfung 06.10.2026, T3-b): Die Untergrenze kehrt zurück,
	 * die berichtigte Einladung ist nicht mehr nötig.
	 */
	einladungsmehrZurueckgestellt: 'requirement.relaxation.reverted',
	/**
	 * Beim Eröffnen festgehalten, dass das Mehr eines Traktandums nach der
	 * Freigabe gemildert wurde (Produktentscheid 07.10.2026, «Nur noch
	 * aufmerksam machen»): das jetzt geltende Mehr, das der Einladung davor, der
	 * Tag der Milderung und ob danach der Haken «Die Einladung ist verschickt»
	 * gesetzt war. Daraus liest die Leitung ihre Warnung im Saal. Bis 07.10.2026
	 * fiel eine solche Milderung ohne rechtzeitigen Haken beim Eröffnen zurück;
	 * diese alten Einträge stehen als `einladungsmehrZurueckgestellt` mit
	 * `beimEroeffnen` und bleiben so beschriftet.
	 */
	einladungsmehrBeimEroeffnen: 'requirement.relaxation.noted.at.opening',
	reglementsregelHinterlegt: 'bylaw.rule.stored',
	/**
	 * Eine bestehende Abweichung geaendert (03.09.2026, Punkt 3 der sechs zur
	 * Reglementsseite).
	 *
	 * Eigene Art, obwohl der Schreibweg derselbe ist: Bis dahin verbuchte ein
	 * Ueberschreiben sich als `bylaw.rule.stored`, und im Verlauf war die
	 * Berichtigung eines Vertippers von der erstmaligen Erfassung nicht zu
	 * unterscheiden. Wer eine Regel anficht, will genau das wissen: seit wann
	 * gilt dieser Wortlaut, und was stand vorher da.
	 */
	reglementsregelGeaendert: 'bylaw.rule.changed',
	reglementsregelAufgehoben: 'bylaw.rule.removed',
	/**
	 * Die Erfordernisse offener Traktanden nach einer Reglementsänderung neu
	 * hergeleitet (23.08.2026, Prüflauf II, B-01).
	 *
	 * Eigene Art, weil es kein gewöhnliches Ändern ist: Der Anlass liegt beim
	 * Reglement, nicht beim Traktandum, und betroffen sind viele auf einmal.
	 * Wer später fragt, warum ein Traktandum plötzlich zwei Drittel verlangt,
	 * findet hier den Grund samt Zahl.
	 */
	erfordernisseNachgezogen: 'bylaw.requirements.rederived',
	/**
	 * Die Einberufungsfrist des Reglements wurde hinterlegt oder geändert
	 * (Migration 098).
	 *
	 * Eigene Art, weil an ihr eine Rechtsfolge hängt: Wer die Frist ändert,
	 * verschiebt den Tag, an dem die Einladung hinausgehen muss — und im
	 * Anfechtungsfall zählt, welche Frist zur Zeit der Einberufung galt.
	 */
	einberufungsfristGesetzt: 'bylaw.notice.period.set',
	zweitversammlungsfristGesetzt: 'bylaw.second.meeting.interval.set',
	/**
	 * Die Schranke des Reglements ueber seine eigene Aenderung (Migration 101).
	 *
	 * Eigene Art, weil an ihr eine Rechtsfolge haengt: Gilt sie, verlangt jede
	 * Reglementsaenderung Einstimmigkeit, und keine hinterlegte Abweichung darf
	 * das mildern. Wer sie setzt oder herausnimmt, verschiebt das Quorum aller
	 * kuenftigen Reglementstraktanden.
	 */
	aenderungsschrankeGesetzt: 'bylaw.amendment.barrier.set',
	/**
	 * Was das Reglement zur Höhe der Einlage in den Erneuerungsfonds sagt
	 * (Migration 193). Mit der vorherigen Art: Im Anfechtungsfall zählt, was
	 * zur Zeit der Herleitung hinterlegt war.
	 */
	fondsgrenzeGesetzt: 'bylaw.fund.limit.set',
	/**
	 * Ob das Reglement Beschlüsse über nicht Angekündigtes gestattet und wer an
	 * einer Universalversammlung als da gilt (Migration 126). Eigene Art, weil
	 * daran hängt, ob über ein nicht angekündigtes Geschäft beschlossen werden
	 * darf.
	 */
	nichtangekuendigtesGesetzt: 'bylaw.unannounced.set',
	/**
	 * Eine Lesart der Gemeinschaft umgestellt (Migration 169, Entscheid 0018).
	 * Eigene Art, weil an ihr hängt, nach welcher Auslegung künftige
	 * Versammlungen rechnen. Die Angaben nennen die Rolle: Die Sitzungsleitung
	 * darf umstellen, wenn die Gemeinschaft es erlaubt.
	 */
	lesartGesetzt: 'bylaw.reading.set',
	/** Wer die Lesarten umstellen darf (Migration 169). */
	lesartenrechtGesetzt: 'bylaw.reading.changer.set',
	/**
	 * Wie ein zweiter Durchgang möglich wird, wenn die Versammlung erst
	 * nachträglich beschlussfähig wird (Migration 139). Eigene Art, weil daran
	 * hängt, ob es für den zweiten Durchgang einen Rückkommensantrag braucht.
	 */
	neuabstimmungNachQuorumGesetzt: 'bylaw.revote.set',
	/**
	 * Ob ein milderes Mehr nach Ablauf der Einberufungsfrist zugelassen wird
	 * (Migration 148, Produktentscheid 07.10.2026). Eigene Art, weil an ihr
	 * hängt, ob die Anwendung eine solche Milderung absagt.
	 */
	milderungNachFristGesetzt: 'bylaw.relaxation.after.deadline.set',
	/**
	 * Widerspruch an einer Universalversammlung nach dem Eröffnen (Migration
	 * 128) und seit Migration 129 auch vor dem Eröffnen (Angabe
	 * `vorDemEroeffnen`, Gegenstand dann das Geschäft). Eigene Art, weil er aus
	 * der Abstimmung «kein Beschluss» macht oder das Eröffnen sperrt.
	 */
	universalWiderspruch: 'vote.universal.objection',
	/**
	 * Welche Vertreter als Sitzungsleitung oder Verwaltung handeln (Migration
	 * 128). Daran hängt, ob ihre Vollmachten an der Universalversammlung zählen.
	 */
	leitungsvertreterGesetzt: 'meeting.chair.holders.set',
	reglementGeprueft: 'bylaw.reviewed',
	reglementspruefungZurueckgesetzt: 'bylaw.review.reset',
	reglementspruefungUebergangen: 'bylaw.review.skipped',

	/** Der Versammlungstag als Klammer über mehrere Versammlungen (Story 7.5). */
	versammlungstagAngelegt: 'meeting.day.created',
	versammlungstagGeaendert: 'meeting.day.updated',
	versammlungInTag: 'meeting.day.joined',
	versammlungAusTag: 'meeting.day.left',
	/*
	 * **Der Notweg an der gemeinsamen Steuerung vorbei** (Erhebung
	 * 30.09.2026). Der Kommentar an `nurWennNichtAmAbend` versprach diesen
	 * Eintrag seit dem 25.08.2026, geschrieben wurde er nie: Ein Aufruf über den
	 * Notweg sah im Verlauf aus wie jeder andere. Festgehalten wird die Wahl der
	 * Leitung, vor der Handlung; was die Handlung bewirkt hat, steht im Eintrag
	 * danach.
	 */
	versammlungNotweg: 'meeting.day.bypassed',
	geschaeftAngelegt: 'business.created',
	/**
	 * Am Abend geändert. Hält fest, wie viele Häuser mitgezogen sind und wie
	 * viele bei ihrem eigenen Wortlaut blieben — sonst wäre später nicht
	 * nachvollziehbar, warum ein Haus anders lautet als die übrigen.
	 */
	geschaeftGeaendert: 'business.updated',
	geschaeftEntfernt: 'business.deleted',
	/** Die Reihenfolge der gemeinsamen Liste — sie bestimmt die Protokollnummern. */
	geschaeftVerschoben: 'business.moved',

	versammlungAngelegt: 'meeting.created',
	versammlungGeaendert: 'meeting.updated',
	/**
	 * Nur im Entwurf möglich (`domain/loeschung.ts`). Der Eintrag bleibt, wenn
	 * die Versammlung weg ist — sonst liesse sich eine Löschung spurlos machen.
	 */
	versammlungGeloescht: 'meeting.deleted',
	betriebsartGewechselt: 'meeting.mode.changed',

	traktandumAngelegt: 'agenda.item.created',
	traktandumGeaendert: 'agenda.item.updated',
	traktandumEntfernt: 'agenda.item.removed',
	traktandenbaumGeordnet: 'agenda.tree.reordered',

	anhangHinzugefuegt: 'attachment.added',
	anhangEntfernt: 'attachment.removed',

	versammlungFreigegeben: 'meeting.released',
	freigabeZurueckgenommen: 'meeting.release.revoked',

	briefkopfHinterlegt: 'operator.letterhead.stored',
	briefkopfEntfernt: 'operator.letterhead.removed',
	/**
	 * Der Name der Bewirtschaftung geändert (Auftraggeber, 25.08.2026: «Wie kann ich
	 * bspw. den Namen der Firma ändern? Jetzt steht da Probère Immobilien.»).
	 *
	 * Er stand seit dem Einrichten fest und hatte keine Maske. Er erscheint als
	 * Absender auf der Einladung — wer ihn ändert, ändert, unter welchem Namen
	 * die nächste Einladung hinausgeht. Deshalb im Verlauf, mit vorher und
	 * nachher.
	 */
	betreiberBezeichnungGeaendert: 'operator.name.updated',
	kiHinweiseGeaendert: 'operator.aihinweise.changed',
	/**
	 * Die Adresse für Erinnerungen wurde gesetzt oder geleert (Migration 099).
	 *
	 * Mit der Adresse: «Wir haben nie eine Erinnerung bekommen» lässt sich sonst
	 * nicht beantworten — die häufigste Ursache ist eine leere oder falsche
	 * Adresse, und wann sie geändert wurde, sagt niemand aus dem Gedächtnis.
	 */
	erinnerungsadresseGesetzt: 'operator.reminder.address.set',
	traktandenlisteErzeugt: 'agenda.pdf.created',
	/**
	 * Die Einladung wurde erzeugt (23.08.2026, Prüflauf I, B-14).
	 *
	 * Sie ist seit dem ein eigenes Dokument und nicht mehr die Traktandenliste
	 * unter anderem Namen — und deshalb braucht der Vorbereitungsschritt
	 * «Einladung erzeugen» ein eigenes Ereignis. Dass er bis dahin an
	 * `agenda.pdf.created` hing, war ohne Wirkung: Dieses Ereignis wurde von
	 * niemandem geschrieben, abgefragt aber schon — der Schritt konnte nie
	 * erledigt werden.
	 */
	einladungErzeugt: 'meeting.invitation.created',
	/**
	 * Eine Unterlage der Ausfallsicherung wurde geholt (20.08.2026).
	 *
	 * **Warum das im Verlauf steht.** Der Ausweichplan taugt nur, wenn er vor der
	 * Versammlung in der Hand liegt — danach gibt es den Server nicht mehr, von
	 * dem man ihn holen könnte. Der Vermerk ist deshalb kein Protokoll einer
	 * Datei, sondern der Beleg für einen Vorbereitungsschritt: Die Leiste zeigt
	 * ihn erst als erledigt, wenn jede Unterlage geholt wurde.
	 */
	ausfallunterlageGeholt: 'meeting.fallback.fetched',

	zugangErzeugt: 'access.created',
	zugangErneuert: 'access.reissued',
	zugaengeEntwertet: 'access.invalidated',
	/**
	 * Der Ausstand je Traktandum (ZGB Art. 68 i.V.m. Art. 712m Abs. 2).
	 *
	 * **Mit dem Grund.** Er verändert die Bezugsgrösse — ohne ihn liesse sich
	 * später nicht sagen, ob das gewollt war oder ein Erfassungsfehler.
	 */
	ausstandErklaert: 'agenda.item.recusal.declared',
	ausstandZurueckgenommen: 'agenda.item.recusal.withdrawn',
	/**
	 * Die Angabe der Sitzungsleitung an einem Folgeantrag mit Häkchen, dass er
	 * eine andere als die bisherige Verwaltung oder die Kündigung des Vertrags
	 * betrifft (Entscheid 0045, Punkt 11; Migration 185). Mit dem Grund: Er
	 * entscheidet, ob die Vollmachten der Verwaltung dort von selbst ruhen.
	 * Nicht als Vorgang im Protokoll; dort steht die Angabe am Beschluss.
	 */
	verwaltungsangabeGemacht: 'agenda.item.management.exemption.set',
	verwaltungsangabeZurueckgenommen: 'agenda.item.management.exemption.withdrawn',
	/**
	 * Unmittelbar Betroffene, im Saal eingetragen oder ausgetragen, und der
	 * Vermerk einer vorab schriftlich erteilten Zustimmung (ZGB Art. 712g
	 * Abs. 4; Block A2, 25.09.2026). Im Entwurf läuft die Zuordnung über das
	 * Traktandenformular und steht mit dessen Änderung im Verlauf.
	 *
	 * **Mit der Angabe.** Der Vermerk entscheidet über Annahme oder Ablehnung;
	 * ohne seine Angabe liesse er sich später nicht von einem Erfassungsfehler
	 * unterscheiden. «Zurückgenommen» ist die Berichtigung durch die
	 * Sitzungsleitung, nicht der Widerruf durch die Betroffene: Der geschieht
	 * mit einem Nein im Saal und steht im Ergebnis.
	 */
	betroffeneEingetragen: 'agenda.item.affected.added',
	betroffeneAusgetragen: 'agenda.item.affected.removed',
	vorabZustimmungVermerkt: 'agenda.item.affected.consent.noted',
	vorabZustimmungZurueckgenommen: 'agenda.item.affected.consent.removed',
	/**
	 * Bei der Ausschlussklage: ob nur eine Person oder alle Eigentümer der
	 * gemeinsamen Wohnung beklagt sind (Migration 132, Produktentscheid
	 * 30.09.2026). **Mit vorher und nachher**, weil die Angabe die Zahl
	 * verschiebt, an der die Mehrheit gemessen wird.
	 */
	beklagtenumfangGesetzt: 'agenda.item.affected.defendant.scope.set',
	/**
	 * Der Veto-Entscheid einer Betroffenen im Ausstand (ZGB Art. 712g Abs. 4;
	 * Migration 125, 26.09.2026).
	 *
	 * **Mit Weg und Wirkung.** Der Entscheid zählt nur als Zustimmung, nie bei
	 * der Mehrheit; wer ihn erfasst hat und auf welchem Weg er kam, ist die
	 * Frage, wenn ein Beschluss angefochten wird. Eine Berichtigung erzeugt
	 * eine neue Zeile (`veto` ist anfügend); gezählt wird der letzte Entscheid.
	 */
	vetoErfasst: 'agenda.item.veto.recorded',
	/**
	 * Eine Einladung samt persönlicher Zugangskarte ist per Mail hinausgegangen.
	 *
	 * **Mit der Adresse.** Sie ist im Streitfall genau das, worum es geht — «ich
	 * habe keine Einladung erhalten» lässt sich ohne sie nicht beantworten. Der
	 * Inhalt der Nachricht steht nicht dabei und der Anhang erst recht nicht: Der
	 * trägt einen Zugangscode.
	 */
	einladungVerschickt: 'access.invitation.sent',
	/**
	 * An den Versand der Einladung wurde erinnert (Migration 099).
	 *
	 * **Der Beleg dafür, dass die Erinnerung gelaufen ist** — und, im
	 * Umkehrschluss, dass sie nicht nochmals laufen muss. Ohne ihn liesse sich
	 * nach einem verpassten Termin nicht sagen, ob die Anwendung geschwiegen hat
	 * oder ob niemand hingesehen hat.
	 */
	einladungErinnert: 'meeting.invitation.reminded',
	/**
	 * Jemand hat vermerkt, dass die Einladung hinausgegangen ist (02.09.2026).
	 *
	 * **Eine Aussage, kein Nachweis.** Der Vermerk sagt, was ein Mensch behauptet
	 * — nicht, was die Anwendung gesehen hat. Deshalb steht im Ereignis, wer ihn
	 * gesetzt hat und auf welchem Weg: in der Anwendung oder über den Link in der
	 * Erinnerungsmail. Der zweite Weg hat keinen angemeldeten Benutzer, und genau
	 * das muss später erkennbar sein.
	 *
	 * Er ist umkehrbar; die Rücknahme schreibt dasselbe Ereignis mit `gesetzt:
	 * false`. Zwei Ereignisarten für eine Angabe liefen auseinander.
	 */
	einladungVersandVermerkt: 'meeting.invitation.sent.marked',

	pflichttraktandenAngelegt: 'agenda.template.applied',
	/**
	 * Die Reihenfolge der Standardtraktanden je Gemeinschaft gespeichert oder
	 * zurückgesetzt (Block C2, 31.08.2026).
	 *
	 * Zwei Einträge sagen Verschiedenes: «so gespeichert» beschreibt eine
	 * Ordnung, die künftig gilt; «zurückgesetzt» sagt, dass ab jetzt die
	 * Code-Reihenfolge gilt. Wer später fragt, warum eine Versammlung von 2027
	 * anders nummeriert ist als die von 2026, findet hier die Antwort.
	 */
	traktandenordnungGespeichert: 'agenda.template.order.saved',
	traktandenordnungZurueckgesetzt: 'agenda.template.order.reset',
	traktandenlisteBestaetigt: 'agenda.confirmed',
	traktandenlisteWiedergeoeffnet: 'agenda.reopened',
	traktandumUebernommen: 'agenda.item.copied',
	/**
	 * Ein Antrag wurde vor der Abstimmung zurückgezogen (FR-45). Eigene Art, weil
	 * er im Protokoll ausdrücklich **nicht** als abgelehnt erscheinen darf.
	 */
	versammlungUnterbrochen: 'meeting.paused',
	versammlungFortgesetzt: 'meeting.resumed',
	antragZurueckgezogen: 'agenda.item.withdrawn',
	rueckzugZurueckgenommen: 'agenda.item.withdrawal.revoked',
	/**
	 * Rückkommensantrag gestellt (FR-44). Der Beschluss darüber steht als
	 * gewöhnliche Abstimmung im Verlauf — hier steht nur, dass er beantragt
	 * wurde, und worauf.
	 */
	rueckkommenBeantragt: 'agenda.item.reconsideration',

	versammlungEroeffnet: 'meeting.opened',
	versammlungGeschlossen: 'meeting.closed',
	/**
	 * Vertagt: geschlossen, ohne dass beschlossen wurde (ZGB 712p Abs. 2).
	 *
	 * Eine eigene Art und nicht bloss ein Vermerk am Schluss: Im Protokoll
	 * steht spaeter, ob eine Versammlung ihre Geschaefte erledigt hat oder ob
	 * sie es nicht konnte — und beim zweiten Mal haengt das Quorum daran.
	 */
	versammlungVertagt: 'meeting.adjourned',
	/**
	 * Das Siegel (Welle 2, FR-51 bis FR-53). Der Eintrag trägt die Prüfsumme des
	 * Manifests — damit lässt sich das Siegel auch dann noch belegen, wenn die
	 * Zeile in `seal` einmal nicht mehr da wäre.
	 */
	versammlungVersiegelt: 'meeting.sealed',
	zeitstempelNachgeholt: 'meeting.seal.timestamped',
	/**
	 * Die Ausleihe an ein anderes Gerät (18.09.2026, Migration 117).
	 *
	 * Beide Einträge tragen die Prüfsumme des Vorbereitungspakets. Sie ist das
	 * einzige, woran sich später belegen lässt, welcher Stand das Haus verliess;
	 * das Paket selbst liegt verschlüsselt in der Ablage und die Zeile im
	 * Leihschein kann mit der Versammlung gelöscht werden.
	 */
	versammlungAbgegeben: 'meeting.handover.given',
	abgabeZurueckgenommen: 'meeting.handover.revoked',
	/**
	 * Das Fenster zwischen den zwei Paketbauten (Produktentscheid 21.09.2026).
	 *
	 * Der Eintrag steht nur da, wenn im Fenster tatsächlich geschrieben wurde.
	 * Sein `detail` trägt die Abweichungen als lesbare Zeilen, damit später
	 * belegbar ist, was der zweite Lauf anders vorfand.
	 *
	 * **Nicht nur Neuzugänge** (aus dem Code-Review): Der Vergleich kennt drei
	 * Arten, und zwei davon sind keine. «geaendert» heisst, eine bestehende
	 * Zeile wurde umgeschrieben, etwa eine Weisung; «entfernt» heisst, eine
	 * wurde gelöscht. Wortlaut und Beschriftung müssen für alle drei stimmen,
	 * sonst steht bei einer Löschung, es sei etwas hereingekommen.
	 */
	abgabeKorrigiert: 'meeting.handover.corrected',
	/**
	 * Die Geräte, an die abgegeben werden darf.
	 *
	 * Beide Einträge tragen den Fingerabdruck und nicht den Schlüssel: Wer
	 * später fragt, ob ein Paket an das richtige Gerät ging, vergleicht ihn.
	 */
	saalgeraetRegistriert: 'device.registered',
	saalgeraetWiderrufen: 'device.revoked',
	/**
	 * Ein anderswo versiegeltes Paket wurde hier aufgenommen (PRD §13).
	 *
	 * Steht an der **Gemeinschaft**, nicht an einer Versammlung: Die Versammlung
	 * gibt es hier nicht als eigene Zeile — genau das ist der Fall. Der Eintrag
	 * trägt das Siegel, damit sich später belegen lässt, welches Paket
	 * hereingekommen ist.
	 */
	paketEingespielt: 'meeting.package.imported',
	/**
	 * Ein einzelner Stimmnachweis wurde herausgegeben (S-4, Vorgabe des Auftraggebers
	 * 22.09.2026).
	 *
	 * **Warum das ein Ereignis ist und nicht bloss ein Download.** Das Blatt
	 * weist das Stimmverhalten namentlich aus. Wer es herausgibt, gibt
	 * Personendaten an jemanden weiter, und im Streit ist «wer hat das wann
	 * bekommen» eine Frage, die sonst niemand mehr beantworten kann. Der
	 * Eintrag trägt den Pfad im Paket, also welches Traktandum, nicht welche
	 * Namen.
	 */
	stimmnachweisHerausgegeben: 'meeting.voteproof.released',
	/**
	 * Aufbewahrung und Löschung (FR-57). Beide Einträge sind Pflicht: Eine
	 * Löschung ohne Spur wäre von einer Datenpanne nicht zu unterscheiden.
	 */
	betriebsdatenGeloescht: 'meeting.operational.purged',
	/**
	 * Eine Versammlung nach Ablauf der Anfechtungsfrist gelöscht (17.09.2026).
	 *
	 * Steht an der **Gemeinschaft**, weil die Versammlung mit ihren eigenen
	 * Einträgen verschwindet. Der Vermerk trägt Datum, Zustelldatum und die
	 * Bestätigungen, aber keine Namen von Eigentümern.
	 */
	versammlungNachFristGeloescht: 'meeting.purged',
	aufbewahrungGeaendert: 'operator.retention.changed',
	traktandumAufgerufen: 'meeting.agenda.current',
	/**
	 * Die Beschlussfähigkeit wurde festgestellt (ZGB Art. 712p, 24.08.2026).
	 *
	 * Eigene Art und nicht bloss eine Notiz: Sie ist die Voraussetzung jedes
	 * Beschlusses, und sie kippt im Lauf des Abends. Wer später fragt, ob die
	 * Versammlung um 20:40 noch beschliessen durfte, sucht genau diesen Eintrag —
	 * mit den Zahlen, die damals galten.
	 */
	beschlussfaehigkeitFestgestellt: 'meeting.quorum.recorded',
	wandbildGesetzt: 'meeting.wall.set',

	anwesenheitAngemeldet: 'attendance.requested',
	anwesenheitBestaetigt: 'attendance.confirmed',
	anwesenheitAbgelehnt: 'attendance.declined',
	anwesenheitVerlassen: 'attendance.left',

	/**
	 * Vertretung und Vollmacht (FR-23 bis FR-25). Vier Ereignisse statt eines
	 * «geändert»: Angefochten wird die Vertretungsmacht, und dann muss aus dem
	 * Verlauf hervorgehen, wer wann was mit welcher Begründung tat.
	 */
	vollmachtErfasst: 'proxy.recorded',
	/**
	 * Weisungen zu einer Vollmacht (Zusatzblock). **Eine** Art für alle
	 * Weisungen eines Vorgangs, nicht eine je Traktandum: Wer acht Anträge
	 * durchgeht, erzeugte sonst acht Einträge, und der Verlauf einer Versammlung
	 * bestünde am Ende überwiegend aus Häkchen.
	 */
	weisungenErteilt: 'proxy.instructions.set',
	vollmachtBestaetigt: 'proxy.confirmed',
	vollmachtZurueckgewiesen: 'proxy.rejected',
	vollmachtWiderrufen: 'proxy.revoked',
	vollmachtNachweisNachgereicht: 'proxy.proof.added',
	/**
	 * Das Häkchen an einer bestehenden Vollmacht gesetzt oder entfernt (L8,
	 * Migration 184; H-1, 07.11.2026). Eigene Art, weil die Erfassung es nur
	 * beim Anlegen trägt: Hier entscheidet die Sitzungsleitung allein über
	 * eine Angabe, die an jedem Traktandum mit Häkchen Stimmen ruhen lässt,
	 * und der Verlauf hält beide Richtungen fest (`verwaltung: true|false`).
	 */
	vollmachtVerwaltungGesetzt: 'proxy.management.set',

	saalmeldungZugeordnet: 'room.entry.assigned',
	saalmeldungAbgelehnt: 'room.entry.declined',

	beschlussunfaehigkeitUebergangen: 'quorum.overridden',

	anmeldungRueckfall: 'user.login.fallback',
	anmeldungAuthentik: 'user.login.oidc',

	zugangscodeAusgegeben: 'access.handout.issued',
	zugangssitzungWiderrufen: 'access.session.revoked',

	anzeigecodeErzeugt: 'meeting.display.code.issued',
	abstimmungEroeffnet: 'vote.round.opened',
	abstimmungGeschlossen: 'vote.round.closed',
	abstimmungWiederholt: 'vote.round.superseded',
	/**
	 * Die Neueröffnung nach einem Weggang (Migration 130). Eigene Art, nicht
	 * `abstimmungWiederholt`: Eine Neuabstimmung setzt die Leitung an, die
	 * Neueröffnung geschieht von selbst, sobald wieder alle da sind. Wer später
	 * liest, soll den Unterschied sehen, nicht eine Entscheidung suchen, die
	 * niemand getroffen hat.
	 */
	abstimmungNeuEroeffnet: 'vote.round.reopened',
	/**
	 * Die laufende Abstimmung ohne Ergebnis abgebrochen (H6, Laien- und
	 * Fachprüfung 14.10.2026). Eigene Art: Ein Abbruch verkündet nichts und
	 * überholt kein Ergebnis, anders als die Neuabstimmung.
	 */
	abstimmungAbgebrochen: 'vote.round.aborted',
	ergebnisFreigegeben: 'vote.result.published',
	stimmeErfasst: 'vote.recorded.by.chair',
	/**
	 * Die Handzählung: Summen statt einzelner Stimmen (Auftraggeber, 25.08.2026).
	 *
	 * Ein eigener Eintrag, kein `stimmeErfasst`: Was hier festgehalten wird, ist
	 * bewusst weniger — drei Zahlen ohne Namen. Wer den Verlauf liest, muss
	 * sehen, dass die Zuordnung nicht fehlt, sondern nie erhoben wurde.
	 */
	handzaehlungErfasst: 'vote.tally.recorded',
	handzaehlungZurueckgenommen: 'vote.tally.withdrawn',
	/**
	 * Der Entscheid einer Person bei Stimmengleichheit (Story 7.9). Er steht
	 * neben dem Beschluss und nicht in ihm: Angefochten wird die Befugnis der
	 * Person, und dafür muss aus dem Verlauf hervorgehen, wer wann was entschied.
	 */
	stichentscheidGefaellt: 'vote.tiebreak.decided',
	/**
	 * Der Text zum Beschluss eines Durchgangs (09.09.2026).
	 *
	 * Eigenes Ereignis, kein «geändert»: Der Satz geht ins Protokoll und später
	 * in eine Pendenz. Wer ihn wann formuliert oder berichtigt hat, gehört
	 * deshalb aus dem Verlauf hervor — wie beim Stichentscheid darüber.
	 */
	beschlusstextErfasst: 'vote.decision.recorded',
	/**
	 * Die Sitzungsleitung hat einen Beschluss von Hand festgehalten
	 * (Produktentscheid 30.09.2026, Migration 134): an den Sperren beim Eröffnen
	 * und an der Auszählung vorbei.
	 *
	 * Gegenstand ist der neue Durchgang. Der Eintrag trägt die Versammlung, das
	 * Traktandum, Ergebnis und Zahlen, die freiwillige Begründung und unter
	 * `abweichung.uebergangen` jede Absage, die das Eröffnen genannt hätte, mit
	 * Kennung und Satz. Er ist die einzige Stelle, an der das steht: Wand und
	 * Protokoll zeigen den Beschluss ohne Hinweis auf den Weg.
	 */
	beschlussVonHand: 'vote.decided.by.chair',
	auswertungErzeugt: 'meeting.summary.created',
	/*
	 * **Bereich «Abstimmung», nicht «Anwesenheit», und deshalb steht er hier**
	 * zwischen den übrigen Abstimmungsereignissen. Gesetzt wird der Vermerk am
	 * Einlass, aber er sagt nichts darüber, WER da ist, sondern WIE diese Partei
	 * abstimmt. Wer im Verlauf nach einer Stimme sucht, sucht ihn dort.
	 *
	 * **Anders als die Pendenz darüber ist er Teil des Siegels** (Migration
	 * 107). Nach dem Versiegeln lässt er sich weder setzen noch aufheben: Er
	 * sagt, WIE abgestimmt wurde, und gehört damit zum Nachweis.
	 *
	 * **Der Gegenstand ist die Momentaufnahme der Partei, nicht der Vermerk.**
	 * Das Aufheben löscht die Zeile; ein Eintrag mit deren Kennung wäre danach
	 * aus jedem gefilterten Verlauf verschwunden, und zwar ausgerechnet der, der
	 * das Aufheben festhält. `snapshot_party` löst `verlaufsabfrage.ts` in allen
	 * drei Filtern auf und überlebt. Dieselbe Lehre wie bei der Pendenz.
	 */
	papierabgabeGesetzt: 'vote.paper.set',
	papierabgabeAufgehoben: 'vote.paper.cleared',

	/**
	 * Der Schalter, ob der Einlass überhaupt fragt (Migration 108).
	 *
	 * **Er steht bewusst nach den beiden darüber und nicht zwischen ihnen.**
	 * Deren Beschreibung gilt für ihn nicht: Sein Gegenstand ist die Versammlung
	 * (`meeting`) und nicht die Momentaufnahme einer Partei, und er ist **kein**
	 * Teil des Siegels — er sagt nichts darüber, wie abgestimmt wurde, sondern
	 * nur, ob am Eingang gefragt wird. Im Verlauf gehört er trotzdem: Ob die
	 * Frage stand, erklärt später, warum bei einer Partei kein Vermerk steht.
	 */
	papierfrageGesetzt: 'meeting.paper.question.set',

	/**
	 * Das Protokoll (Welle 2, FR-46, FR-48 bis FR-50).
	 *
	 * Fünf Ereignisse statt eines «geändert»: Das Protokoll ist bewusst frei
	 * bearbeitbar und nicht Teil des Siegels — dafür muss aus dem Verlauf
	 * hervorgehen, wer wann was daran tat und welche Fassung hinausging.
	 */
	protokollnotizErfasst: 'minutes.note.recorded',
	/**
	 * Der Beschlussvermerk am Traktandum (Block 7, 02.10.2026).
	 *
	 * **Ein Ereignis für Setzen und Zurücknehmen.** Der Eintrag trägt
	 * `vermerk` (`true` oder `false`); zwei Arten für dieselbe Handlung
	 * hätten keinen Mehrwert. Er steht weder unter `ABWEICHUNGSARTEN` — der
	 * Vermerk weicht von keiner Empfehlung ab — noch unter
	 * `PROTOKOLLVORGANGSARTEN`: Was er bewirkt, ist, dass das Protokoll den
	 * Satz «Über diesen Antrag wurde nicht abgestimmt.» nicht schreibt. Die
	 * weiteren Leser (Tafel, Leiste, Auswertung) stehen an
	 * `Protokollzeile.beschlussvermerk`.
	 */
	beschlussvermerkErfasst: 'minutes.decision.marked',
	/**
	 * Die Pendenz (09.09.2026) — wer erledigt was bis wann.
	 *
	 * Drei Ereignisse, nicht eines: Die Pendenz entsteht in der Sitzung und wird
	 * Monate später abgehakt, oft von jemand anderem. Genau dieser Abstand ist
	 * die Auskunft, um die es geht. Ein gemeinsames «geändert» verlöre sie.
	 *
	 * **Und deshalb steht das Entfernen daneben.** Die Pendenz ist nicht Teil
	 * des Siegels und lässt sich löschen (Migration 106); der Verlauf ist dann
	 * die einzige Spur, dass es sie gab.
	 */
	pendenzErfasst: 'todo.recorded',
	pendenzGeaendert: 'todo.edited',
	pendenzZustandGesetzt: 'todo.state.set',
	pendenzEntfernt: 'todo.removed',

	/**
	 * Die Rüge im Saal (Ä-06, Migration 160). Anders als die Pendenz ist sie
	 * Teil des Siegels; das Entfernen steht trotzdem daneben, weil es möglich
	 * ist, solange die Versammlung läuft, und der Verlauf dann die einzige Spur
	 * des früheren Wortlauts ist.
	 */
	ruegeErfasst: 'objection.recorded',
	ruegeEntfernt: 'objection.removed',

	protokollentwurfErzeugt: 'minutes.draft.created',
	protokollBearbeitet: 'minutes.edited',
	protokollfassungFestgehalten: 'minutes.version.frozen',
	protokollAusgegeben: 'minutes.exported'
} as const;

export type Ereignisart = (typeof EREIGNISARTEN)[keyof typeof EREIGNISARTEN];

/**
 * Die Arten, mit denen die Sitzungsleitung von einer Empfehlung des Werkzeugs
 * abweicht (`docs/einordnung-sperrstellen-2026-09-30.md`, Muster «Leitung
 * weicht ab»).
 *
 * **Sie stehen im Verlauf und nie im Protokoll** (Produktentscheid
 * 30.09.2026): Dort läse sich eine Abweichung wie ein Verstoss.
 * `tests/domain/abweichungsarten.test.ts` hält fest, dass keine davon unter
 * `PROTOKOLLVORGANGSARTEN` steht. Wer eine neue Art der Abweichung baut, trägt
 * sie hier ein; der Wächter sieht nur, was in dieser Menge steht.
 */
export const ABWEICHUNGSARTEN: ReadonlySet<Ereignisart> = new Set<Ereignisart>([
	EREIGNISARTEN.beschlussVonHand,
	EREIGNISARTEN.erfordernisUebersteuert,
	EREIGNISARTEN.versammlungNotweg,
	EREIGNISARTEN.kiEntscheid
]);

/**
 * Die Arten, die als Vorgang ins Protokoll gehen (`holeVorgaengeFuerProtokoll`
 * in `server/verlaufsabfrage.ts`): gewöhnliche Verfahrensschritte, keine
 * Abweichungen. Hier und nicht dort, damit der Wächter sie ohne Datenbank
 * gegen `ABWEICHUNGSARTEN` halten kann.
 */
export const PROTOKOLLVORGANGSARTEN: readonly Ereignisart[] = [
	EREIGNISARTEN.versammlungUnterbrochen,
	EREIGNISARTEN.versammlungFortgesetzt,
	EREIGNISARTEN.antragZurueckgezogen,
	EREIGNISARTEN.rueckzugZurueckgenommen,
	EREIGNISARTEN.ausstandErklaert,
	EREIGNISARTEN.ausstandZurueckgenommen
];

export interface Ereignis {
	art: Ereignisart;
	/** Betroffener Gegenstand: Art und Kennung, damit er im Verlauf auffindbar bleibt. */
	gegenstandArt?: string;
	gegenstandId?: string;
	/**
	 * Sachangaben. Nie Kennwörter, nie Zugangsmerkmale — der Verlauf ist für
	 * Auswertung und Beleg gedacht, nicht als zweiter Speicher für Geheimnisse.
	 */
	angaben?: Record<string, unknown>;
}

/**
 * Ergebnis eines Zustandsübergangs: der neue Zustand und was dabei geschah.
 */
export interface Uebergang<T> {
	ergebnis: T;
	ereignisse: Ereignis[];
}

export function uebergang<T>(ergebnis: T, ...ereignisse: Ereignis[]): Uebergang<T> {
	return { ergebnis, ereignisse };
}

export function ereignis(
	art: Ereignisart,
	gegenstand?: { art: string; id?: string },
	angaben?: Record<string, unknown>
): Ereignis {
	return {
		art,
		gegenstandArt: gegenstand?.art,
		gegenstandId: gegenstand?.id,
		angaben
	};
}

/**
 * Verständliche Bezeichnung einer Ereignisart für die Anzeige.
 *
 * Ein Verlauf, der `ownership.assigned` zeigt, ist als Beleg wertlos: Wer ihn
 * im Streitfall liest, ist keine Fachperson für Datenbanken. Eine unbekannte
 * Art wird unverändert durchgereicht statt als «Unbekannt» dargestellt — die
 * Rohbezeichnung sagt mehr als nichts.
 */
const BESCHRIFTUNGEN: Record<string, string> = {
	'user.provisioned': 'Konto angelegt',
	'user.login': 'Angemeldet',
	'user.login.failed': 'Anmeldung fehlgeschlagen',
	'user.logout': 'Abgemeldet',
	'user.password.changed': 'Eigenes Kennwort geändert',
	'user.password.set': 'Kennwort für ein Konto gesetzt',
	'user.created': 'Konto angelegt',
	'user.role.changed': 'Rolle geändert',
	'user.disabled': 'Konto ausser Dienst gestellt',
	'user.enabled': 'Konto wieder in Dienst gestellt',
	'user.details.changed': 'Name oder Adresse eines Kontos geändert',
	'user.link.opened': 'Erstverknüpfung mit Authentik geöffnet',
	'user.link.closed': 'Erstverknüpfung mit Authentik geschlossen',
	'user.link.established': 'Konto mit Authentik verknüpft',
	'user.link.rejected': 'Erstverknüpfung abgewiesen',
	'user.link.released': 'Verknüpfung mit Authentik gelöst',
	'ai.stage.created': 'KI-Stufe eingerichtet',
	'ai.stage.changed': 'KI-Stufe geändert',
	'ai.stage.moved': 'KI-Kette umgestellt',
	'ai.stage.removed': 'KI-Stufe entfernt',
	'ai.decision.recorded': 'Entscheid zu einem KI-Vorschlag',
	'tsa.configured': 'Zeitstempeldienst eingerichtet',
	'tsa.removed': 'Zeitstempeldienst entfernt',
	'tsa.fallback.configured': 'Ersatzdienst für den Zeitstempel eingerichtet',
	'tsa.fallback.removed': 'Ersatzdienst für den Zeitstempel entfernt',
	'record.archived': 'Archiviert',
	'record.unarchived': 'Aus dem Archiv geholt',
	'stweg.created': 'Gemeinschaft angelegt',
	'stweg.updated': 'Gemeinschaft geändert',
	'unit.created': 'Einheit angelegt',
	'unit.updated': 'Einheit geändert',
	'unit.removed': 'Einheit entfernt',
	'person.created': 'Person angelegt',
	'person.updated': 'Person berichtigt',
	'party.person.linked': 'Eigentümer mit Person verknüpft',
	'party.person.unlinked': 'Verknüpfung zur Person gelöst',
	'party.created': 'Eigentümer angelegt',
	'party.member.added': 'Mitberechtigter aufgenommen',
	'party.member.removed': 'Mitberechtigter entfernt',
	'party.member.delivery.set': 'Zustelladresse der Mitberechtigten gemeldet',
	'party.member.delivery.cleared': 'Meldung der Zustelladresse aufgehoben',
	'party.representative.changed': 'Vertretung der Gemeinschaft gewechselt',
	'party.deleted': 'Eigentümerzeile getilgt',
	'person.deleted': 'Person gelöscht',
	'party.updated': 'Eigentümer geändert',
	'ownership.assigned': 'Eigentum zugeordnet',
	'ownership.ended': 'Eigentum beendet',
	'usufruct.created': 'Nutzniessung erfasst',
	'usufruct.holder.corrected': 'Nutzniesser berichtigt',
	'usufruct.ended': 'Nutzniessung beendet',
	'representation.designated': 'Vertreter bezeichnet',
	'representation.ended': 'Vertretung beendet',
	'import.applied': 'Übernahme bestätigt',
	'instruction.recorded': 'Weisung erfasst',
	'instruction.corrected': 'Weisung berichtigt',
	'agenda.item.instruction.bound': 'Weisungsbindung gesetzt',
	'requirement.set': 'Mehrheitserfordernis gesetzt',
	'requirement.overridden': 'Mehrheitserfordernis übersteuert',
	'requirement.relaxed.after.release': 'Mehr nach der Freigabe gemildert, Einladung neu zu verschicken',
	'requirement.relaxation.reverted': 'Milderung des Mehrs zurückgenommen, Einladung gilt wieder',
	'requirement.relaxation.noted.at.opening': 'Beim Eröffnen: Mehr nach der Freigabe gemildert',
	'bylaw.rule.stored': 'Reglementsabweichung hinterlegt',
	'bylaw.rule.changed': 'Reglementsabweichung geändert',
	'bylaw.requirements.rederived': 'Erfordernisse neu hergeleitet',
	'bylaw.rule.removed': 'Reglementsabweichung aufgehoben',
	'bylaw.notice.period.set': 'Einberufungsfrist hinterlegt',
	'bylaw.second.meeting.interval.set': 'Frist zur zweiten Versammlung hinterlegt',
	'bylaw.amendment.barrier.set': 'Schranke für Reglementsänderungen gesetzt',
	'bylaw.fund.limit.set': 'Bestimmung zur Einlage in den Erneuerungsfonds gesetzt',
	'bylaw.unannounced.set': 'Ausnahmen bei nicht angekündigten Geschäften hinterlegt',
	'bylaw.reading.set': 'Lesart der Gemeinschaft umgestellt',
	'bylaw.reading.changer.set': 'Festgelegt, wer die Lesarten umstellen darf',
	'bylaw.revote.set': 'Neuabstimmung nach Eintritt der Beschlussfähigkeit eingestellt',
	'bylaw.relaxation.after.deadline.set': 'Milderes Mehr nach Ablauf der Einberufungsfrist eingestellt',
	'vote.universal.objection': 'Widerspruch gegen die Beschlussfassung festgehalten',
	'meeting.chair.holders.set': 'Vertreter der Sitzungsleitung oder Verwaltung angekreuzt',
	'bylaw.reviewed': 'Reglement auf Quoren geprüft',
	'bylaw.review.reset': 'Reglementsprüfung zurückgesetzt',
	'bylaw.review.skipped': 'Reglementsprüfung übergangen',
	'meeting.day.created': 'Gemeinsame Versammlung angelegt',
	'meeting.day.updated': 'Gemeinsame Versammlung geändert',
	'meeting.day.joined': 'Gemeinschaft tagt mit',
	'meeting.day.left': 'Gemeinschaft aus der gemeinsamen Versammlung gelöst',
	'meeting.day.bypassed': 'Einzelleitung gewählt; der gemeinsame Abend gilt für dieses Haus nicht',
	'business.moved': 'Traktandum der gemeinsamen Versammlung verschoben',
	'business.created': 'Geschäft angelegt',
	'business.updated': 'Traktandum der gemeinsamen Versammlung geändert',
	'business.deleted': 'Traktandum von der gemeinsamen Liste genommen',
	'meeting.created': 'Versammlung angelegt',
	'meeting.updated': 'Versammlung geändert',
	'meeting.deleted': 'Versammlung gelöscht',
	'meeting.mode.changed': 'Betriebsart gewechselt',
	'stweg.removed': 'Gemeinschaft entfernt',
	'agenda.confirmed': 'Traktandenliste als vollständig bestätigt',
	'agenda.reopened': 'Traktandenliste wieder geöffnet',
	'agenda.item.created': 'Traktandum angelegt',
	'agenda.item.updated': 'Traktandum geändert',
	'agenda.item.removed': 'Traktandum entfernt',
	'agenda.tree.reordered': 'Traktandenliste umgestellt',
	'attachment.added': 'Unterlage angehängt',
	'attachment.removed': 'Unterlage abgelöst',
	'meeting.released': 'Versammlung freigegeben',
	'meeting.release.revoked': 'Freigabe zurückgenommen',
	'operator.name.updated': 'Name der Bewirtschaftung geändert',
	'operator.letterhead.stored': 'Briefkopfvorlage hinterlegt',
	'operator.aihinweise.changed': 'Anzeige der KI-Hinweise geändert',
	'operator.reminder.address.set': 'Adresse für Erinnerungen gesetzt',
	'operator.letterhead.removed': 'Briefkopfvorlage entfernt',
	'agenda.pdf.created': 'Traktandenliste erzeugt',
	'meeting.invitation.created': 'Einladung erzeugt',
	'meeting.fallback.fetched': 'Unterlage der Ausfallsicherung geholt',
	'access.created': 'Zugang erzeugt',
	'access.reissued': 'Zugang neu erzeugt, alter ungültig',
	'access.invalidated': 'Zugänge entwertet',
	'agenda.item.recusal.declared': 'Ausstand erklärt',
	'agenda.item.recusal.withdrawn': 'Ausstand zurückgenommen',
	'agenda.item.management.exemption.set': 'Angabe zu den Vollmachten der Verwaltung gemacht',
	'agenda.item.management.exemption.withdrawn': 'Angabe zu den Vollmachten der Verwaltung zurückgenommen',
	'agenda.item.affected.added': 'Betroffene eingetragen',
	'agenda.item.affected.removed': 'Betroffene ausgetragen',
	'agenda.item.affected.consent.noted': 'Vorab-Zustimmung vermerkt',
	'agenda.item.affected.consent.removed': 'Vermerk der Vorab-Zustimmung zurückgenommen',
	'agenda.item.affected.defendant.scope.set': 'Angabe zu den beklagten Eigentümern gesetzt',
	'agenda.item.veto.recorded': 'Veto im Ausstand erfasst',
	'access.invitation.sent': 'Einladung per Mail verschickt',
	'meeting.invitation.reminded': 'An den Versand der Einladung erinnert',
	'meeting.invitation.sent.marked': 'Versand der Einladung vermerkt',
	'agenda.template.applied': 'Pflichttraktanden angelegt',
	'agenda.template.order.saved': 'Reihenfolge der Standardtraktanden gespeichert',
	'agenda.template.order.reset': 'Reihenfolge der Standardtraktanden zurückgesetzt',
	'agenda.item.copied': 'Traktandum übernommen',
	'meeting.paused': 'Versammlung unterbrochen',
	'meeting.resumed': 'Versammlung fortgesetzt',
	'agenda.item.withdrawn': 'Antrag zurückgezogen',
	'agenda.item.withdrawal.revoked': 'Rückzug zurückgenommen',
	'agenda.item.reconsideration': 'Rückkommen beantragt',
	'meeting.opened': 'Versammlung eröffnet',
	'meeting.closed': 'Versammlung geschlossen',
	'meeting.adjourned': 'Versammlung vertagt',
	'meeting.sealed': 'Versammlung versiegelt',
	'meeting.seal.timestamped': 'Zeitstempel zum Siegel nachgeholt',
	'meeting.handover.given': 'Versammlung an ein anderes Gerät abgegeben',
	'meeting.handover.revoked': 'Abgabe zurückgenommen',
	'meeting.handover.corrected': 'Abgabe berichtigt: zwischen den beiden Paketbauten wurde noch geschrieben',
	'device.registered': 'Saalgerät eingetragen',
	'device.revoked': 'Saalgerät widerrufen',
	'meeting.package.imported': 'Abschlusspaket eingespielt',
	'meeting.voteproof.released': 'Stimmnachweis herausgegeben',
	'meeting.operational.purged': 'Betriebsdaten gelöscht',
	'meeting.purged': 'Versammlung nach Ablauf der Anfechtungsfrist gelöscht',
	'operator.retention.changed': 'Aufbewahrungsfrist geändert',
	'meeting.agenda.current': 'Traktandum aufgerufen',
	'meeting.quorum.recorded': 'Beschlussfähigkeit festgestellt',
	'meeting.wall.set': 'Wandbild gewechselt',
	'attendance.requested': 'Teilnahme angemeldet',
	'attendance.confirmed': 'Anwesenheit bestätigt',
	'attendance.declined': 'Anmeldung abgelehnt',
	'attendance.left': 'Versammlung verlassen',
	'proxy.recorded': 'Vollmacht erfasst',
	'proxy.instructions.set': 'Weisungen zur Vollmacht erteilt',
	'proxy.confirmed': 'Vollmacht bestätigt',
	'proxy.rejected': 'Vollmacht zurückgewiesen',
	'proxy.revoked': 'Vertretung beendet',
	'proxy.proof.added': 'Nachweis zur Vollmacht nachgereicht',
	'proxy.management.set': 'Verwaltungskennzeichnung der Vollmacht geändert',
	'room.entry.assigned': 'Saalmeldung zugeordnet',
	'room.entry.declined': 'Saalmeldung abgelehnt',
	'quorum.overridden': 'Trotz Beschlussunfähigkeit abgestimmt',
	'user.login.fallback': 'Lokale Anmeldung als Rückfallebene benutzt',
	'user.login.oidc': 'Über Authentik angemeldet',
	'access.handout.issued': 'Zugangscode im Saal ausgegeben',
	'access.session.revoked': 'Gerätesitzungen widerrufen',
	'meeting.display.code.issued': 'Anzeigecode für die Präsentationssicht erzeugt',
	'vote.round.opened': 'Abstimmung eröffnet',
	'vote.round.closed': 'Abstimmung geschlossen',
	'vote.round.superseded': 'Neuabstimmung angesetzt',
	'vote.round.reopened': 'Abstimmung neu eröffnet',
	// Nur noch für Einträge vor H6 (14.10.2026): Geschrieben wird die Art nicht
	// mehr, seit die Leitung kein verkündetes Ergebnis überholt.
	'vote.round.reinstated': 'Früherer Durchgang wieder massgebend (Anordnung bis 14.10.2026)',
	'vote.round.aborted': 'Abstimmung ohne Ergebnis abgebrochen',
	'vote.result.published': 'Ergebnis freigegeben',
	'vote.recorded.by.chair': 'Stimmen von der Sitzungsleitung erfasst',
	'vote.tally.recorded': 'Von Hand gezählt (Summen)',
	'vote.tally.withdrawn': 'Handzählung zurückgenommen',
	'vote.tiebreak.decided': 'Stichentscheid bei Stimmengleichheit gefällt',
	'vote.decision.recorded': 'Text zum Beschluss festgehalten',
	'vote.decided.by.chair': 'Beschluss von Hand festgehalten',
	'meeting.summary.created': 'Gesamtauswertung erzeugt',
	'minutes.note.recorded': 'Protokollnotiz erfasst',
	'minutes.decision.marked': 'Beschlussvermerk erfasst',
	'meeting.paper.question.set': 'Frage am Einlass «digital oder von Hand» umgestellt',
	'vote.paper.set': 'Stimmabgabe auf Papier vermerkt',
	'vote.paper.cleared': 'Stimmabgabe auf Papier aufgehoben',
	'todo.recorded': 'Pendenz erfasst',
	'todo.edited': 'Pendenz geändert',
	'todo.state.set': 'Zustand einer Pendenz gesetzt',
	'todo.removed': 'Pendenz entfernt',
	'objection.recorded': 'Rüge festgehalten',
	'objection.removed': 'Rüge entfernt',
	'minutes.draft.created': 'Protokollentwurf erzeugt',
	'minutes.edited': 'Protokoll bearbeitet',
	'minutes.version.frozen': 'Protokollfassung festgehalten',
	'minutes.exported': 'Protokoll ausgegeben'
};

export function beschriftung(art: string): string {
	return BESCHRIFTUNGEN[art] ?? art;
}

/**
 * Die Wörterliste der Angaben: Schlüssel → Bezeichnung.
 *
 * **Eine Stelle für Seite und PDF** (B2, 03.10.2026). Bis dahin schrieb
 * `angabenInWorten` die rohen Schlüssel: «gemeinschaft: 01a0f6c1-…,
 * fristvermerk: null». Wer das Blatt liest, versteht weder die Kennung noch,
 * warum ein Feld leer dasteht.
 *
 * **Ein Schlüssel ohne Eintrag erscheint weiter roh**, und
 * `tests/domain/verlauf-angaben.test.ts` wird rot, wenn eine Schreibstelle
 * einen Schlüssel einführt, der hier fehlt. Der Test liest die Objektliterale
 * an den Schreibstellen (`ereignis(…)` und `angaben:`); ein Schlüssel aus einer
 * zusammengesetzten Struktur entgeht ihm.
 *
 * **Die Bezeichnungen sind Sätze nach aussen** (das Blatt liest notfalls ein
 * Gericht). Sie nennen den Inhalt eines Felds, keine Rechtsfolge; die
 * rechtsnahen stehen im Bericht zur Abnahme markiert.
 */
export const ANGABEN_WOERTER: Record<string, string> = {
	ab: 'Gültig ab',
	abend: 'Abend',
	abendBezeichnung: 'Bezeichnung des Abends',
	abgabe: 'Abgabe',
	abgelehnt: 'Abgelehnt',
	// Die Einstellung zu den Enthaltungen (Migration 151), an `stweg` als
	// Feldname im Ereignis `gemeinschaftGeaendert` (Codeprüfung 07.10.2026).
	abstentionExcluded: 'Enthaltungen beim einfachen Mehr ausserhalb der Bezugsgrösse',
	abstentionExcludedSource: 'Fundstelle zu den Enthaltungen',
	abweichung: 'Abweichung',
	address: 'Adresse',
	adresse: 'Adresse',
	adresse_gewechselt: 'Adresse gewechselt',
	aktion: 'Aktion',
	alleSeiten: 'Alle Seiten',
	am: 'Am',
	angeheftet: 'Angeheftet',
	angelegt: 'Angelegt',
	angenommen: 'Angenommen',
	angeschlossen: 'Angeschlossen',
	// Beim Entfernen eines Traktandums, was mit ihm ging (Befund N4, 18.10.2026,
	// `server/traktandenreste.ts`).
	anhaenge: 'Ebenfalls abgelöste Unterlagen',
	anlass: 'Anlass',
	antragsteller: 'Antragsteller',
	antragstellerart: 'Art des Antragstellers',
	antragswortlaut: 'Antragswortlaut',
	antwort: 'Antwort',
	anzahl: 'Anzahl',
	art: 'Art',
	ausDatei: 'Aus Datei',
	ausDatum: 'Datum der Vorlage',
	ausTraktandum: 'Aus Traktandum',
	ausVersammlung: 'Aus Versammlung',
	ausVorlage: 'Aus Vorlage',
	aus_person: 'Bisherige Person',
	ausstaende: 'Ebenfalls entfallene Ausstände',
	begruendung: 'Begründung',
	einwand: 'Eingewendete Bestimmung',
	// Ob der Ersatzdienst den Zeitstempel bezeugt hat (13.11.2026, an
	// `meeting.sealed` und `meeting.seal.timestamped`).
	ersatz: 'Vom Ersatzdienst bezeugt',
	einfuehrung: 'Wie sie eingeführt wurde',
	beimEroeffnen: 'Beim Eröffnen',
	bemerkung: 'Bemerkung',
	// Der Beginn der beendeten Pause, beim Fortsetzen vermerkt
	// (Produktentscheid 08.10.2026, Migration 153): Damit steht das Paar
	// Beginn und Ende lesbar im Verlauf, auch wenn zwischen zwei Pausen
	// andere Einträge liegen.
	beginn: 'Beginn der Pause',
	beschlussfaehig: 'Beschlussfähig',
	bestandteile: 'Bestandteile',
	betriebsart: 'Betriebsart',
	betroffene: 'Betroffene',
	betroffeneZeilen: 'Betroffene Zeilen',
	bezeichnung: 'Bezeichnung',
	bis: 'Bis',
	bisher: 'Bisher',
	bisherigePartei: 'Bisherige Partei',
	dateien: 'Dateien',
	datum: 'Datum',
	dazu: 'Dazu',
	dritte_person: 'Dritte Person',
	durch: 'Durch',
	durchSitzungsleitung: 'Durch die Sitzungsleitung',
	durchgang: 'Durchgang',
	ebene: 'Ebene',
	eigentuemer: 'Eigentümer',
	eingesammelt: 'Eingesammelt',
	einheit: 'Einheit',
	einladungDavor: 'Mehr der Einladung davor',
	einladungDavorMass: 'Vergleichsmass der Einladung davor',
	einladungNennt: 'Die Einladung nennt',
	einstimmig: 'Einstimmig',
	eintraege: 'Einträge',
	entfernteNotiz: 'Gelöschte Notiz',
	entfernterBeginn: 'Gelöschter Beginn',
	entferntesEnde: 'Gelöschtes Ende',
	enthaltung: 'Enthaltung',
	// Die zweite Zählung an der Einsprache (Migration 172).
	andereJa: 'Ja, zweite Zählung',
	andereNein: 'Nein, zweite Zählung',
	andereEnthaltung: 'Enthaltung, zweite Zählung',
	entscheid: 'Entscheid',
	zweiteStimme: 'Person im Vorsitz selbst Stockwerkeigentümer',
	entwertete_sitzungen: 'Beendete Anmeldungen',
	erfasstDurch: 'Erfasst durch',
	erfassung: 'Erfassung',
	erfordernis: 'Erfordernis',
	erfordernisFassung: 'Fassung des Erfordernisses',
	ergebnis: 'Ergebnis',
	fall: 'Fall',
	fassung: 'Fassung',
	fassungsart: 'Fassungsart',
	fehlt: 'Fehlt',
	felder: 'Felder',
	fingerabdruck: 'Gerätekennzeichen',
	format: 'Format',
	// Lesart der Gemeinschaft (Migration 169): die Frage im Wortlaut des Katalogs.
	frage: 'Frage',
	fragen: 'Fragen',
	frist: 'Frist',
	fristDatum: 'Zu erledigen bis',
	fristbegruendung: 'Begründung für den zu kurzen Abstand',
	fristvermerk: 'Fristvermerk',
	frühererGrund: 'Früherer Grund',
	fuer: 'Für',
	fundstelle: 'Fundstelle',
	fondsgrenzenart: 'Art der Bestimmung zum Erneuerungsfonds',
	fondsgrenzenartVorher: 'Art vorher',
	funktion: 'Funktion',
	geaendert: 'Geändert',
	geblieben: 'Geblieben',
	gebunden: 'Gebunden',
	gegenstand: 'Gegenstand',
	gegenstandArt: 'Gegenstandsart',
	gegenstandId: 'Gegenstandskennung',
	geleert: 'Geleert',
	gemildertAm: 'Gemildert am',
	gemeinsameVersammlung: 'Gemeinsame Versammlung',
	gemeinsamerAbend: 'Gemeinsamer Abend',
	gemeinschaft: 'Gemeinschaft',
	gemeinschaften: 'Gemeinschaften',
	gemeinschaftlich: 'Gemeinschaftlich',
	gemeldetAls: 'Gemeldet als',
	geraet: 'Gerät',
	gesamtquote: 'Gesamtquote',
	geschaeft: 'Geschäft',
	geschaefte: 'Geschäfte',
	geschaeftsart: 'Geschäftsart',
	gesetzt: 'Gesetzt',
	// Entscheid 0045, Punkt 11: der entschiedene Folgeantrag, auf den sich die
	// Angabe der Leitung stützt (`server/verwaltungsangabe.ts`).
	gestuetztAuf: 'Gestützt auf den Folgeantrag',
	getauschtMit: 'Getauscht mit',
	getilgt: 'Zuordnung gelöscht',
	gewaehlt: 'Gewählt',
	groesse: 'Grösse',
	grund: 'Grund',
	grundlage: 'Grundlage',
	gueltigMinuten: 'Gültig für Minuten',
	haeuser: 'Häuser',
	haltung: 'Haltung',
	haus: 'Haus',
	herkunft: 'Herkunft',
	hinweis: 'Hinweis',
	hoeheMm: 'Höhe in Millimetern',
	huelle: 'Hülle',
	ja: 'Ja',
	keinBeschluss: 'Abgestimmt, aber kein Beschluss',
	keineAnfechtung: 'Bestätigt: keine Anfechtungsklage und kein Schlichtungsgesuch eingegangen',
	kennung: 'Kennung',
	kiHinweise: 'KI-Hinweise',
	knoten: 'Knoten',
	koepfe: 'Kopfstimmen',
	konsultativ: 'Konsultativ, ohne Beschlussfähigkeit',
	konsultativNachL5: 'Konsultativ, ohne die Beschlussfähigkeit einer ersten Versammlung (Lesart L5)',
	konto: 'Konto',
	kopf: 'Kopfmehr',
	kopfart: 'Art des Kopfmehrs',
	kopfbasis: 'Basis der Kopfstimmen',
	kopfstimmen: 'Kopfstimmen',
	kurzfassung: 'Kurzfassung',
	label: 'Bezeichnung',
	leitungsvollmachtenZaehlen: 'Leitungsvollmachten zählen',
	lesart: 'Lesart',
	lift: 'Lift',
	loeschbarAb: 'Löschbar ab',
	maschinenvermerk: 'Maschinenvermerk',
	method: 'Anmeldeweg',
	mehrJetzt: 'Mehr beim Eröffnen',
	mindestens: 'Mindestens',
	mitBeschlussvermerk: 'Mit Beschlussvermerk',
	mitDemSchliessen: 'Mit dem Schliessen',
	mitDemTextGeleert: 'Mit dem Text geleert',
	mitSchluessel: 'Mit Schlüssel',
	mit_adresse: 'Mit Adresse',
	mitberechtigung: 'Mitberechtigung',
	mitgezogen: 'Mitgezogen',
	mitglied: 'Mitglied',
	mitgliedsgemeinschaft: 'Mitgliedsgemeinschaft',
	modell: 'Modell',
	momentaufnahmeVerworfen: 'Festgehaltener Stand verworfen',
	nach: 'Nach',
	nachher: 'Nachher',
	nachtragssiegel: 'Nachtragssiegel',
	nachweis: 'Nachweis',
	name: 'Name',
	name_nachher: 'Name nachher',
	name_vorher: 'Name vorher',
	nein: 'Nein',
	nenner: 'Nenner',
	neuerElternteil: 'Neu eingeordnet unter',
	notiz: 'Notiz',
	nummer: 'Nummer',
	nummerManuell: 'Nummer von Hand',
	nutzniesser: 'Nutzniesser',
	nutzung: 'Nutzung',
	offen: 'Offen',
	offen_bis: 'Offen bis',
	offeneHinweise: 'Offene Hinweise',
	ohneAbstimmung: 'Ohne Abstimmung',
	ohneBeschluss: 'Ohne Hausbeschluss zählt die Stimme als',
	ohneErgebnis: 'Ohne Ergebnis',
	ort: 'Ort',
	paket: 'Paket',
	paketArchiviert: 'Paket archiviert',
	partei: 'Partei',
	parteiId: 'Partei',
	parteien: 'Parteien',
	pendenz: 'Pendenz',
	per: 'Per',
	person: 'Person',
	pfad: 'Pfad',
	phone: 'Telefon',
	plz: 'Postleitzahl',
	protokollArchiviert: 'Protokoll archiviert',
	protokollGenehmigt: 'Protokoll genehmigt',
	protokollfuehrung: 'Protokollführung',
	pruefsumme: 'Prüfsumme',
	quelle: 'Quelle',
	quotaDenominator: 'Nenner der Wertquoten',
	'quote.stamm': 'Stammquote',
	quoten: 'Wertquoten',
	quotenartAngelegt: 'Wertquotenart angelegt',
	quotenartEntfernt: 'Wertquotenart entfernt',
	quotenbasis: 'Basis der Wertquoten',
	regel: 'Regel',
	regelId: 'Regel',
	regeln: 'Regeln',
	reglementFundstelle: 'Fundstelle im Reglement',
	reglementGestattet: 'Reglement gestattet',
	risiko: 'Risiko',
	risikoGrund: 'Risikogrund',
	role: 'Rolle',
	rolle: 'Rolle',
	rueckwirkend: 'Rückwirkend',
	ruege: 'Rüge',
	ruegt: 'Wer rügt',
	saalmeldungen: 'Saalmeldungen',
	satz: 'Satz',
	schluessel: 'Schlüssel',
	siegel: 'Siegel',
	sitzungen: 'Anmeldungen',
	sitzungsleitung: 'Sitzungsleitung',
	snapshotPartei: 'Stimmberechtigte Partei',
	stamm: 'Stamm',
	stattDurchgang: 'Anstelle von Durchgang',
	stattTraktandum: 'Anstelle von Traktandum',
	stattTraktandumId: 'Anstelle von Traktandum',
	stelle: 'Stelle',
	stichtag: 'Stichtag',
	strasse: 'Strasse',
	stufe: 'Stufe',
	folgestufe: 'Stufe der Folgeversammlung',
	// L16 (Migration 194): ein Wahrheitswert, steht als «ja» (`wertInWorten`).
	nachLesart: 'Zweite nach der Einstellung L16 (die vertagte war schon beschlussfähig)',
	stweg: 'Gemeinschaft',
	tag: 'Abend',
	tage: 'Tage',
	text: 'Text',
	titel: 'Titel',
	traktanden: 'Traktanden',
	traktandum: 'Traktandum',
	traktandumId: 'Traktandum',
	traktandumart: 'Traktandenart',
	typ: 'Typ',
	uebergangen: 'Übergangene Absagen',
	ueberholt: 'Überholte Durchgänge',
	// Ä-43, Migration 163: beim Anlegen und als geändertes Feld.
	traegerschaft: 'Trägerschaft gemäss Grundbuch',
	uebersprungen: 'Übersprungen',
	uhrzeit: 'Uhrzeit',
	universalBestaetigungUnterstellt:
		'Nur vorausgesetzt und von der Leitung nicht bestätigt: alle nötigen Eigentümer und Berechtigten da und kein Widerspruch gegen den Beschluss über dieses Geschäft (Universalversammlung)',
	universalFundstelle: 'Fundstelle im Reglement zur Universalversammlung',
	universalvariante: 'Variante der Universalversammlung',
	unterlage: 'Unterlage',
	unveraendert: 'Unverändert',
	url: 'Webadresse',
	username: 'Benutzername',
	verantwortlich: 'Verantwortlich',
	verdraengtDurchKorrektur: 'Verdrängt durch Korrektur',
	vereinbarung: 'Vereinbarung',
	vermerk: 'Vermerk',
	vermerktAm: 'Als verschickt vermerkt am',
	versammlung: 'Versammlung',
	versammlungVom: 'Versammlung vom',
	versammlungenZusammen: 'Versammlungen zusammen',
	versammlungsart: 'Versammlungsart',
	verschoben: 'Verschoben',
	versandvermerkZurueckgenommen: 'Versandvermerk zurückgenommen',
	versandVermerkt: 'Nach der Milderung als verschickt vermerkt',
	versiegelt: 'Versiegelt',
	versiegeltAm: 'Versiegelt am',
	versiegeltDurch: 'Versiegelt durch',
	vertretene: 'Vertretene',
	vertreter: 'Vertreter',
	vertretung: 'Vertretung',
	vertretungsgrund: 'Vertretungsgrund',
	// Das Häkchen an der Vollmacht (L8, Migration 184), wie die Maske es
	// beschriftet; nur gesetzt, wenn es trägt.
	verwaltung: 'Bevollmächtigt ist die Verwaltung',
	// Das Häkchen am Traktandum (L8, Migration 184), wie die Traktandenübersicht
	// es als Merkmal nennt; es steht im Verlauf des Bearbeitens unter den
	// geänderten Feldern (G6, 06.11.2026).
	verwaltungsGeschaeft: 'Geschäft der Verwaltung',
	vollmacht: 'Vollmacht',
	von: 'Von',
	vonNummer: 'Von Nummer',
	vor: 'Vor',
	vorDemEroeffnen: 'Vor dem Eröffnen',
	vorgaenger: 'Vorgänger',
	vorgehen: 'Vorgehen des Vorsitzes',
	vorgaengerWiederOffen: 'Vorgänger wieder offen',
	vorher: 'Vorher',
	neu: 'Neu',
	vorschlag: 'Vorschlag',
	vorschlagFundstelle: 'Fundstelle des Vorschlags',
	vorschlagQuelle: 'Quelle des Vorschlags',
	vorschlagRechtsgrundlage: 'Rechtsgrundlage des Vorschlags',
	war_zustelladresse: 'War Zustelladresse',
	was: 'Was',
	weg: 'Weg',
	wer: 'Wer',
	werteEntfernt: 'Werte entfernt',
	wertquoten: 'Wertquoten',
	wortlaut: 'Wortlaut',
	zaehlweise: 'Zählweise',
	zeichen: 'Zeichen',
	zeilen: 'Zeilen',
	zeitpunkt: 'Zeitpunkt',
	zeitquelle: 'Zeitquelle',
	zeitstempel: 'Zeitstempel',
	ziel: 'Ziel',
	zielAngenommen: 'Ziel angenommen',
	zielNummer: 'Zielnummer',
	zuNummer: 'Zu Nummer',
	zugaenge: 'Zugänge',
	zugestellt: 'Zugestellt',
	zugestelltAm: 'Zugestellt am',
	zuordnungen: 'Zuordnungen',
	// Ä-05, Kern (M4): was die Leitung mit dem Freigeben bestätigt hat.
	zuordnungBestaetigt: 'Zuordnung von der Leitung bestätigt',
	imAusstand: 'Im Ausstand',
	anwesend: 'Anwesend',
};

/**
 * Die Schlüssel, deren Wert eine Kennung ist.
 *
 * Nur hier wird aufgelöst; eine Kennung in einem anderen Feld bleibt, wie sie
 * ist (etwa das Gerätekennzeichen oder die Prüfsumme). Was sich auflösen lässt,
 * entscheidet der Aufrufer (`AngabenAufloeser`): Der Verlauf am Bildschirm
 * kennt Versammlungen und Gemeinschaften, das Siegelpaket auch Traktanden und
 * Parteien der eigenen Versammlung.
 */
const KENNUNGS_SCHLUESSEL: ReadonlySet<string> = new Set([
	'abend',
	'abgabe',
	'aus_person',
	// Das Quelltraktandum einer Übernahme (C2, F4c; DeepSeek-Review Block 2, N-5).
	// Es liegt in der Vorgängerin; das Siegelpaket löst nur Traktanden der eigenen
	// Versammlung auf und zeigt es deshalb neutral als Kennung.
	'ausTraktandum',
	'bisherigePartei',
	'gegenstandId',
	'gemeinschaft',
	'geschaeft',
	'mitglied',
	'mitgliedsgemeinschaft',
	'nachher',
	'neuerElternteil',
	'nutzung',
	'partei',
	'parteiId',
	'pendenz',
	'person',
	'regelId',
	'ruege',
	'snapshotPartei',
	'stattTraktandumId',
	'stweg',
	'tag',
	'traktandum',
	'traktandumId',
	'versammlung',
	'verschoben',
	'vor',
	'vorher',
	'wer',
	'ziel',
]);

/** Eine Kennung, wie diese Anwendung sie vergibt. */
const KENNUNG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * **Die Art des Gegenstands in Worten** (06.10.2026, UI-Durchgang). Die
 * Spalte zeigte den Tabellennamen aus der Datenbank: «meeting», «unit»,
 * «app_user». Die Wörter folgen der Oberfläche (Partei, Konto, gemeinsamer
 * Abend).
 *
 * **Im Kern statt in der Seite** (V1, 06.10.2026). Die Tabelle stand bis
 * dahin in `routes/verlauf/+page.svelte`. Das Siegelpaket schreibt in seiner
 * Rückfallform weiter den Tabellennamen («app_user (liess sich nicht
 * zuordnen …)») und nimmt diese Tabelle erst mit dem Block «Verlaufsblatt
 * lesbar», der eine Laienprüfung braucht (`server/siegel.ts`). Gezählt am
 * 06.10.2026: Auf Dev kamen dreizehn Arten vor, alle stehen hier. An den Schreibstellen stehen zwölf davon wörtlich
 * (`ereignis(…, { art: '…' })`); `pendenz` (vier Zeilen auf Dev) hat heute
 * keine wörtliche Schreibstelle mehr, und einige Stellen reichen die Art aus
 * einer Variablen durch (Anhänge, Archiv, Erfordernis).
 */
export const GEGENSTANDSARTEN: Readonly<Record<string, string>> = {
	meeting: 'Versammlung',
	agenda_item: 'Traktandum',
	unit: 'Einheit',
	party: 'Partei',
	snapshot_party: 'Partei der Anwesenheitsliste',
	stweg: 'Gemeinschaft',
	proxy: 'Vollmacht',
	person: 'Person',
	app_user: 'Konto',
	meeting_day: 'Gemeinsamer Abend',
	operator: 'Bewirtschaftung',
	voting_round: 'Abstimmungsdurchgang',
	pendenz: 'Pendenz'
};

/**
 * Eine Gegenstandsart in Worten. Eine Art, die in der Tabelle fehlt, erscheint
 * roh, statt hinter einem Sammelwort zu verschwinden: Die Rohbezeichnung sagt
 * mehr als «unbekannt».
 */
export function gegenstandsart(art: string): string {
	return Object.hasOwn(GEGENSTANDSARTEN, art) ? GEGENSTANDSARTEN[art] : art;
}

/**
 * Übersetzt einen gespeicherten Wert (ein Codewort wie `per_owner`) in Worte.
 *
 * `undefined` heisst «kenne ich nicht», dann steht der Wert, wie er
 * gespeichert ist. **Die Tabellen dazu stehen nicht hier**, sondern in
 * `domain/verlaufswerte.ts`: Sie kommen aus den Kernmodulen, die selbst
 * `ereignis` aus dieser Datei brauchen, und ein Import von hier aus ergäbe
 * einen Ring, den `.dependency-cruiser.cjs` (keine-ringe-im-kern) abweist.
 * Der Aufrufer reicht die Übersetzung deshalb herein, wie den Auflöser.
 *
 * `schluessel` ist bei `vorher` und `nachher` in einem verschachtelten Feld
 * der Schlüssel darüber: In `felder: { betriebsart: { vorher, nachher } }`
 * tragen beide eine Betriebsart.
 */
export type Wertwoerter = (wert: string, schluessel: string) => string | undefined;

/**
 * Löst eine Kennung zu einem Namen auf.
 *
 * **Drei Antworten, nicht zwei** (Codeprüfung Lauf B, 03.10.2026): ein Name;
 * `null` heisst «gesucht und nicht gefunden», dann greift die Rückfallform
 * (`nichtZugeordnet`); `undefined` heisst «diesen Schlüssel löst dieser Leser
 * nicht auf», dann steht die Kennung neutral da. Die erste Fassung kannte nur
 * `null`, und das Siegelpaket meldete die eigene Versammlung als «liess sich
 * nicht zuordnen», obwohl niemand nach ihr gesucht hatte.
 */
export type AngabenAufloeser = (wert: string, schluessel: string) => string | null | undefined;

/**
 * Was ein leerer Wert sagt, wo er etwas sagt.
 *
 * Sonst entfällt `null` (Auftrag B2: kein «fristvermerk: null» im Blatt). Hier
 * nicht: Ein Aufruf mit `nachher: null` ist ein zurückgenommener Aufruf, ein
 * Beschluss von Hand mit `quoten: null` hat die Wertquoten nicht erhoben.
 * Entfiele das Feld, läse sich der Eintrag als das Gegenteil (Codeprüfung
 * Lauf B, 03.10.2026).
 */
const LEERE_WERTE: Readonly<Record<string, string>> = {
	vorher: 'leer',
	nachher: 'leer',
	neuerElternteil: 'oberste Ebene',
	quoten: 'nicht erhoben'
};

/**
 * Schlüssel, die nur als Vermerk stehen: wahr zeigt die Bezeichnung allein,
 * falsch entfällt. «…: ja» hinter einer verneinten Bezeichnung las sich in der
 * Laienprüfung (Runde 2) als doppelte Verneinung.
 */
const VERMERK_SCHLUESSEL: ReadonlySet<string> = new Set([
	'universalBestaetigungUnterstellt',
	// Die konsultative Abstimmung (Migration 158), beim Eröffnen und beim Verkünden;
	// nach der Sperre von L5 mit eigenem Schlüssel (Migration 174; Codeprüfung Block 7, R3-N2).
	'konsultativ',
	'konsultativNachL5',
	// Vom Ersatzdienst bezeugt (13.11.2026): nur zeigen, wenn es zutrifft.
	// Sonst trüge jedes Siegel, auch eines ohne Zeitstempeldienst, «nein».
	'ersatz'
]);

/**
 * Schlüssel, die nur zum Rechnen im Eintrag stehen und nicht angezeigt werden,
 * weil derselbe Inhalt daneben in Worten steht. `einladungDavorMass` ist das
 * Mehr der Einladung davor als Erfordernis, gegen das die Warnung im Saal
 * rechnet (Produktentscheid 07.10.2026); in Worten steht es unter
 * `einladungDavor` (beim Eröffnen) oder `einladungNennt` (bei der Milderung). Roh angezeigt wäre es eine Klammer voller Feldnamen.
 */
const NUR_ZUM_RECHNEN: ReadonlySet<string> = new Set(['einladungDavorMass']);

/** Eine Kennung, die kein Leser auflöst: als solche benannt, gekürzt wie die Rückfallform. */
function kennungNeutral(id: string): string {
	return `interne Kennung ${id.slice(0, 8)}…`;
}

/**
 * Ein einzelner Wert in Worten.
 *
 * `null` und leere Zeichenketten entfallen (`null` zurück), ausser der
 * Schlüssel steht in `LEERE_WERTE`. Eine leere Liste heisst «keine»: Beim
 * Beschluss von Hand ist sie eine Aussage («Das Werkzeug hätte die Abstimmung
 * zugelassen», `domain/vonhand.ts`). Wahrheitswerte stehen als «ja»/«nein».
 * Ein verschachteltes Objekt steht in Klammern, Listenglieder trennt «; »:
 * Werte wie ein `satz` enthalten selbst Kommas, und ohne Klammern liess sich
 * im Blatt nicht sehen, wo eine Angabe endet.
 */
function wertInWorten(
	v: unknown,
	schluessel: string,
	aufloesen?: AngabenAufloeser,
	woerter?: Wertwoerter,
	wortSchluessel: string = schluessel
): string | null {
	if (v === null || v === undefined) return LEERE_WERTE[schluessel] ?? null;
	if (typeof v === 'boolean') return v ? 'ja' : 'nein';
	if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
	if (typeof v === 'string') {
		const text = v.trim();
		if (text === '') return LEERE_WERTE[schluessel] ?? null;
		if (KENNUNGS_SCHLUESSEL.has(schluessel) && KENNUNG.test(text)) {
			const name = aufloesen?.(text, schluessel);
			if (name === undefined) return kennungNeutral(text);
			return name ?? nichtZugeordnet(ANGABEN_WOERTER[schluessel] ?? schluessel, text);
		}
		// Ein Codewort in Worten (V1, 06.10.2026); was die Tabellen nicht
		// kennen, steht weiter, wie es gespeichert ist.
		return woerter?.(text, wortSchluessel) ?? v;
	}
	if (Array.isArray(v)) {
		const teile = v
			.map((x) => wertInWorten(x, schluessel, aufloesen, woerter, wortSchluessel))
			.filter((x): x is string => x !== null);
		return teile.length > 0 ? teile.join('; ') : 'keine';
	}
	if (typeof v === 'object') {
		const teile = paareInWorten(v as Record<string, unknown>, aufloesen, woerter, schluessel);
		return teile.length > 0 ? `(${teile.join(', ')})` : null;
	}
	return String(v);
}

/**
 * Was «Risiko: nein» neben einem gesetzten oder übersteuerten Erfordernis
 * heisst (Produktentscheid 08.10.2026, Nebenbefund (2) des Verlaufsblatts;
 * gebaut in Schritt F2). Allein las sich «nein» als Unbedenklichkeitsvermerk;
 * verglichen wird aber nur die Art des Mehrs (`strenge` in
 * `entscheidbaum.ts`), nicht die Bezugsgrösse. «Risiko: ja» bleibt, mit dem
 * Grund daneben.
 */
export const RISIKO_NEIN =
	// Laien- und Fachprüfung F2, S4, zwei Runden: «Risiko:» bleibt vorn, damit die
	// Zeile zu finden ist; gesagt wird, was geprüft ist und was nicht, ohne
	// «keines» vorweg (las sich als Entwarnung, und ein strengeres Mehr kann
	// eine Ablehnung anfechtbar machen, Rz. 235a ad Art. 712m); «Bezugsgrösse»
	// ist das Wort der übrigen Seiten statt «Basis».
	'Risiko: Das Mehr ist nicht milder als vorgeschlagen; nicht geprüft hat das Werkzeug, ob ein ' +
	'strengeres zu Recht galt und ob alle Eigentümer oder nur die Anwesenden zählen (Bezugsgrösse)';

/**
 * Ob neben `risiko: false` wirklich ein Mehr mit einem Vorschlag verglichen
 * wurde (Codeprüfung F2, Befund 1). `false` steht auch, wo nichts verglichen
 * wurde: beim Setzen ohne Baum (`erfordernisGesetzt` schreibt
 * `risiko ?? false`) und bei einem Grenzfall, den `strenge` nicht einordnet.
 * Dort entfällt die Angabe; ein «nein» ohne Rechnung wäre wieder der
 * Unbedenklichkeitsvermerk, den der Entscheid vom 08.10.2026 beseitigen wollte.
 * Das Ereignis der Übersteuerung trägt `vorschlag` und `gewaehlt`, ein
 * Erfordernis `vorschlagTyp` und `typ`.
 */
function mehrVerglichen(angaben: Record<string, unknown>): boolean {
	const vorschlag = angaben.vorschlag ?? angaben.vorschlagTyp;
	const gewaehlt = angaben.gewaehlt ?? angaben.typ;
	return (
		typeof vorschlag === 'string' &&
		typeof gewaehlt === 'string' &&
		strenge(vorschlag as Ergebnistyp) !== null &&
		strenge(gewaehlt as Ergebnistyp) !== null
	);
}

/**
 * Die Paare eines Objekts als «Bezeichnung: Wert», Vermerke als Bezeichnung allein.
 *
 * `eltern` ist der Schlüssel, unter dem das Objekt steht. `vorher` und
 * `nachher` darunter werden mit ihm übersetzt (`Wertwoerter`).
 */
function paareInWorten(
	angaben: Record<string, unknown>,
	aufloesen?: AngabenAufloeser,
	woerter?: Wertwoerter,
	eltern?: string
): string[] {
	const teile: string[] = [];
	for (const [k, v] of Object.entries(angaben)) {
		const bezeichnung = ANGABEN_WOERTER[k] ?? k;
		if (NUR_ZUM_RECHNEN.has(k)) continue;
		if (VERMERK_SCHLUESSEL.has(k)) {
			if (v === true) teile.push(bezeichnung);
			continue;
		}
		if (k === 'risiko' && v === false) {
			if (mehrVerglichen(angaben)) teile.push(RISIKO_NEIN);
			continue;
		}
		const wortSchluessel = eltern && (k === 'vorher' || k === 'nachher') ? eltern : k;
		const wert = wertInWorten(v, k, aufloesen, woerter, wortSchluessel);
		if (wert !== null) teile.push(`${bezeichnung}: ${wert}`);
	}
	return teile;
}

/**
 * Die Angaben eines Verlaufseintrags in einer Zeile.
 *
 * Eine Stelle für beide Leser: Die Verlaufsseite und die Fassung im
 * Siegelpaket bauen die Angabe hier; zwei Formatierungen liefen auseinander
 * und ergäben zwei Lesarten desselben Eintrags.
 *
 * **Die Angaben trennt « · », nicht «, ».** Mehrere Wörter der Wortliste
 * tragen selbst ein Komma («von Hand gewählt, nicht hergeleitet»,
 * «Kenntnisnahme, keine Abstimmung»); mit «, » läse sich die zweite Hälfte
 * eines Worts wie eine eigene Angabe.
 *
 * Was aufgelöst wird, entscheidet der Aufrufer; die Anzeige bleibt dieselbe.
 * Ohne Auflöser steht eine Kennung neutral als «interne Kennung …» da.
 *
 * Die Codewörter übersetzt `woerter`, geholt aus `wertwoerter()` in
 * `domain/verlaufswerte.ts`. Ohne steht der Wert, wie er gespeichert ist.
 * **Seit V1 (06.10.2026) reicht die Verlaufsseite sie herein**, seit dem
 * 08.10.2026 auch das Verlaufsblatt im Siegelpaket (`server/siegel.ts`,
 * `trageZusammen`).
 */
export function angabenInWorten(
	angaben: Record<string, unknown> | null | undefined,
	aufloesen?: AngabenAufloeser,
	woerter?: Wertwoerter
): string {
	return paareInWorten(angaben ?? {}, aufloesen, woerter).join(' · ');
}

/**
 * Die Rückfallform eines Gegenstands, der sich nicht mehr auflösen liess.
 *
 * **Was sie sagen muss** (Laienprüfung 01.10.2026, B-4): dass die Zuordnung
 * nicht gelungen ist und dass die Zeichenfolge eine interne Kennung ist. Die
 * erste Fassung schrieb «Traktandum (01a0f6c1…)»; das las sich wie eine
 * Traktandennummer, und «ohne Kennung» sagte gar nichts. Das Blatt geht vor
 * Gericht, dort darf eine Kennung nicht als Nummer durchgehen.
 *
 * Sie steht hier im Kern, weil sie seit B2 auch die Kennungen in den Angaben
 * übersetzt; das Siegelpaket importiert sie von hier, eine zweite Abschrift
 * gäbe es sonst.
 */
export function nichtZugeordnet(was: string, id: string | null): string {
	return id
		? `${was} (liess sich nicht zuordnen; interne Kennung ${id.slice(0, 8)}…)`
		: `${was} (liess sich nicht zuordnen; keine Kennung im Eintrag)`;
}
