/**
 * Ein fester Abdruck je ausgelieferter Regelwerksfassung (AD-4: eine Fassung
 * bleibt, wie sie war, weil gefasste Beschlüsse an ihr hängen).
 *
 * **Der Anlass** (Featureprüfung Erneuerungsfonds, Prüfer B, 15.11.2026): Die
 * Fassungen bauen aufeinander auf und teilen Objekte. Änderte eine neue Fassung
 * ein geteiltes Objekt der Vorfassung direkt, etwa den Text einer Frage, galt
 * die Änderung rückwirkend in allen älteren Fassungen, und jede Probe blieb
 * grün: Die Vergleiche mit `toBe` sehen dasselbe Objekt, die älteren Fassungen
 * untereinander auch. Gemessen mit einer Änderung am Text von `f1-0`.
 *
 * **Wie es wirkt:** SHA-256 über `JSON.stringify` jeder Fassung gegen den
 * Wert hier. Die Werte bis 2026-11-17 sind am Stand `861d0066` erzeugt und am
 * Stand mit der Fassung 2026-11-18 gleich gemessen.
 *
 * **Jede Fassung hat einen Abdruck, auch die aktuelle** (Codeprüfung,
 * Befund 1): Wer eine neue Fassung aufnimmt, trägt nur deren Wert ein; der Wert
 * der Vorfassung steht schon da, und eine Änderung an ihr wird sofort rot.
 * Nachführen darf man nur den Wert der aktuellen Fassung, und nur solange sie
 * nicht auf dem Betrieb ist. Ändert sich ein anderer Wert, hat jemand eine
 * alte Fassung verändert: nicht den Wert nachführen, sondern die Änderung
 * zurücknehmen.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { FASSUNGEN } from '$lib/rules';

const ABDRUCK: Record<string, string> = {
	'2026-07-30': '09aa6dd07fcac116ab8b9bb7acfd7f094b6c29fa504ab602e80537142269a72a',
	'2026-08-05': 'a701acee5c89d9e92c18c107b4843a271998295974bc38a942006012bd34002d',
	'2026-08-15': 'a9fcc0da1f69a63066e7ea5d5c6cdb37b9b681e9265cdc1f3eda0ec365ede210',
	'2026-08-16': '9877b95bc2f36e5c690e641893f60fa6e0ba536fe438080e00c7bd0bea0e5b30',
	'2026-09-21': '8b2c118bd2b71ec06194136c385e14a79f7909dc817ab5536be3a0753654881b',
	'2026-09-22': '8ac06fff45305a6f34696464e47cc22f3e8f0bce98bdae62852947009d50a452',
	'2026-09-23': '12e4970a70b0a5e9a9853c7e18f37a4560904e52785b38ace47d525d038bfa1c',
	'2026-09-24': '4195d351bfc5b90d69ff026482388e81aa7d0c49bc725ad7a76c57c2d01f7294',
	'2026-09-25': 'd11e0bc080ea575942ca0e80f02852f60bd13bdd5ceac443cd3f92a3ebe4811a',
	'2026-09-26': 'beba0cec4a28bdd4c46dd34838d807f2d24fc1350219d765b44782cdbb21afc4',
	'2026-09-27': '4a27df4ee80267966dd4201e0e0baae7132d335355d24360ece66fede5c4d69b',
	'2026-09-28': 'e31e494c5a1479984c5fc0dd4ba1d53ee00ab4869bdb8acb47f089baefeda5ee',
	'2026-09-29': 'c255d0d2257c3a173b58a74e20597b2ab6cd4f582ed589d3d33ba2e22ce1a6df',
	'2026-09-30': 'bebe9918cd1eb25a322c02c74bf6217598f5c1a093a83a2a5e953bd73c3c0aff',
	'2026-10-01': '54774611ba41d882b1023d55b1d1f16f026ecdc4e6d19805dfb5408b05d59a58',
	'2026-10-02': 'd8ba3d5b479e2a4502469785d74183718041c253218f0e7c711fe99f7587cd40',
	'2026-10-03': 'b4e39ac4af471d30b6d469d720280095ed1e3d8a0f0308e843f3aa1497e4d22a',
	'2026-10-04': 'ae22eb83f8093ac796c31d0521ddb5919845eba33c823cbece6c2cd94f379d10',
	'2026-10-05': 'dd0173afbf27e53830809f2ab20403ca154a426bd0037809be861ba2d2fc1c59',
	'2026-10-06': '1db141c3edbde861d00ef32422b0bf6ef1dfd848f69d3507286daccbc2018646',
	'2026-10-07': 'deb4d4c3117e16fcd7b7457723e01223946a887289a62a77de6544463badc51a',
	'2026-10-08': 'ce4f28713f8e4f8dd65a2a3c2e98534be0393250e2702db987d3bdbc17ef8f58',
	'2026-10-09': 'cbe1ceacaab9c926a0b5664aac2c240ea7daf578661e1c35162a8706ac90ded6',
	'2026-10-10': 'd9ee5fb228a56f7dcab712afde53ca77a00270729281a2711273c398dad21c22',
	'2026-10-11': 'bd842177a1f2492680abfcf29c07010733f603145bed178687dcbadfc6d73a2c',
	'2026-10-12': 'cd9dba6420f4b4a15316390b480cb3f56c7f761e97e4c3388ef0962d6f35a615',
	'2026-10-13': '00bbad40bb3ed9b2cd2217efeb6da28192e557251b9973578ac4c317fb116308',
	'2026-10-14': '6da6f38901644168ad0ae37d0e2d561f6efcf13152d11fd80317407065f9f864',
	'2026-10-15': 'a4e8d4dcf43d4179e136b575a21e99597daba4fcb3ba45f834ae164fbc3c03d4',
	'2026-10-16': '25ac3b97184bae25966a0ff035a4d94a2e49fe6e4a97c7a0ccf959a02a0be398',
	'2026-10-17': 'e50195c8bc58ed06305878291760a6e835eda89db2527ff4037bf75cf7c4d159',
	'2026-10-18': 'e5e39db75f4983c4790a1fe1b383f46d66f3f851c451aa654df3751c46e2d4b9',
	'2026-10-19': '913ba15b25e1f111f3e4d205a7411fb271b1bc79e4ee094a0171d19988fdd97f',
	'2026-10-20': 'f3eb673fed6d76bc2ede28ee2c6a5192723a3df6fd09618a6f9e74389dadc183',
	'2026-10-21': '9bfa72576a0acc427e7338ecb9cf27b9e8a7d2848c677005d173ec684102a6c8',
	'2026-10-22': '2b85efa4335876f646fd0e0f68e36bfc01b06317b6b27a0e7c4e96b4e772bf84',
	'2026-10-23': '7f8a10dc1eedfa9db71875f4e15600ab9878ac5a3144ba04cb635e5a26b1e87f',
	'2026-10-24': '160ac53b2b13020e1eb68c7cf165221254e82ba89c10e056be7f4f7ca2bd7af9',
	'2026-10-25': '66922a7e83b9aa498f63965fadf3641b1d2d351762409460d520d464ff4d9a60',
	'2026-10-26': '0bcfb0fe8d3ff13ff5043f7dcd87e07e667c5795bf334e6a52b8515958e7b4c4',
	'2026-10-27': '5e13270701011d058822f56c11bc5052aec42e238b81ea5024e4ec507699ea9e',
	'2026-10-28': '98f9d1c8664d6645f471ae1877c1e601c66911841cb4ef4650c7b2fafeda59ec',
	'2026-10-29': 'fcf2051415ef63d2baed1bf34668719c8ff5d7d5eff386b23a651cc1e7442af8',
	'2026-10-30': 'bdbcb1c59c59103ad4a0eade6e2cbc78aedde77ae11881c929dc9c10f5fa1e80',
	'2026-11-03': 'a53956edbb66de3258e353c062f6b9c9c0d5b2af928188ec9def99eabf7d7fd0',
	'2026-11-04': '20cade9425ddb50f0de2562d03e724e7ebecf82597d0241cdd17e13746c4fde0',
	'2026-11-05': '3008a90052c61bca463edfb7db2065e204178759066cf0937d100c40b6dccf77',
	'2026-11-10': '839a326976b07e245fba6850af04ae15098f7c72133ac1d2853e2574fc445c40',
	'2026-11-11': 'dd90c0a70e5ae2f3e7a88242caa88f7909484f059a0d38e84dcf8ead8c8af58c',
	'2026-11-13': '46b1b16f047cc3d0f3d638986b7c8bc1cecbe817c6fb4a94d8d7a315c231e6ae',
	'2026-11-14': '183b5456fdaa0c42a530e0e82b50e39f77ba839f727a11a251b71e62c965ee26',
	'2026-11-15': '1d0aa049cdac80ed8e194f82cf70b19b42c22990694dc6c5d2da532aa38fca79',
	'2026-11-16': '4cb4eb0be63b1540ee594ef8b5374b28f38d22ee4fe8e7cb17acfa11c1aef14e',
	'2026-11-17': '61790f9132e8d3240c77ec4a7341689e49dd8a2eb399745c43d9955c05b58514',
	'2026-11-18': '26d8eb5c6b1b155e64a9d2ef9213acc3e9ed5a188638ec21de48b60704266df8',
	'2026-11-19': '4afb309374a219f5f6e9f661437d5042b82473cf0c27702ee9265b8d3e5c199d',
	'2026-11-20': '4ecde7e31995207a26294e5068edd9931a715d1d0fd1c8c599dd0b3d6b050ae3',
	'2026-11-21': '71fc1999746586ea4eb12eaa902cfb5264113833fc4fdc43a84806f70b2a0683',
	'2026-11-22': '089ad24d7380def98654d7736103da57b4be5853da361035696e524973787c3b',
	'2026-11-23': 'fba42cc945782511c5621288867d54f45bcb27b75550cd92134552d719491872',
	'2026-11-24': 'dcb25b926dbeab29881bde5cc3375a856fffb3f75f61b719a65e63070f97639d',
	'2026-11-25': 'be5e5244fb53f5ff89b6b51474ce765488248adcaa8e33279b81ad8a2a078611',
};

const abdruck = (fassung: string) => createHash('sha256').update(JSON.stringify(FASSUNGEN[fassung])).digest('hex');

describe('Die ausgelieferten Regelwerksfassungen', () => {
	it('sind byte-gleich mit ihrem Abdruck', () => {
		for (const [fassung, wert] of Object.entries(ABDRUCK)) {
			expect(FASSUNGEN[fassung], `${fassung} fehlt im Verzeichnis`).toBeDefined();
			expect(abdruck(fassung), fassung).toBe(wert);
		}
	});

	it('haben alle einen Abdruck, auch die aktuelle', () => {
		expect(Object.keys(FASSUNGEN).filter((f) => !(f in ABDRUCK))).toEqual([]);
	});
});
