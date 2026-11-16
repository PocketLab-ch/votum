-- Der Stichentscheid bei Stimmengleichheit (AD-4, AD-14).
--
-- Reglemente lösen den Gleichstand verschieden auf. Das Reglement der STWEG
-- Nirgendheim GB 9999 sagt in Art. 30: «Bei Stimmengleichheit ist die
-- Anteilsberechtigung (Wertquoten) massgebend.» Ohne eine solche Regel bleibt
-- ein Gleichstand ein Nichterreichen — sieben Ja gegen sieben Nein heisst dann
-- schlicht: abgelehnt.
--
-- **Warum an der Gemeinschaft und nicht am Erfordernis.** Die Regel hängt nicht
-- am einzelnen Geschäft, sondern an der Gemeinschaft: Sie steht einmal im
-- Reglement und gilt für alles, was diese Versammlung beschliesst. An jedem
-- Traktandum wiederholt, wäre sie vierzehnmal dieselbe Angabe und dreizehnmal
-- eine Gelegenheit, sie zu vergessen.
--
-- **Warum sie in die Momentaufnahme mitwandert.** Aus demselben Grund wie die
-- Zählweise: Ein später geändertes Reglement darf das Ergebnis einer gehaltenen
-- Versammlung nicht mehr verschieben (AD-3).
ALTER TABLE stweg
	ADD COLUMN tie_break             text NOT NULL DEFAULT 'keiner',
	ADD COLUMN tie_break_rule_source text;

-- Die gesetzliche Lage kennt keinen Stichentscheid: Wer die Mehrheit nicht hat,
-- hat sie nicht. Deshalb ist `keiner` die Voreinstellung — anders als bei der
-- Zählweise, wo Recht und Praxis auseinanderfallen und eine Voreinstellung in
-- beide Richtungen falsch wäre.
ALTER TABLE stweg
	ADD CONSTRAINT stweg_stichentscheid CHECK (tie_break IN ('keiner', 'wertquote'));

ALTER TABLE snapshot ADD COLUMN tie_break text NOT NULL DEFAULT 'keiner';
ALTER TABLE snapshot
	ADD CONSTRAINT snapshot_stichentscheid CHECK (tie_break IN ('keiner', 'wertquote'));

COMMENT ON COLUMN stweg.tie_break IS
	'Wie ein Gleichstand der Kopfstimmen aufgelöst wird. keiner = gesetzliche Lage; '
	'wertquote = die Anteilsberechtigung entscheidet, sofern das Reglement es vorsieht.';
COMMENT ON COLUMN stweg.tie_break_rule_source IS
	'Fundstelle im Reglement für den Stichentscheid. NULL bei der gesetzlichen Lage.';
