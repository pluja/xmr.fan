/* Spellings for the voice model, applied only to the audio text: names it would otherwise
   read as one word. Letters are spaced out so each language's voice says them its own way
   ("monero D" is "monero dee" in English, "monero de" in Spanish). */
const SAY: [RegExp, string][] = [
  [/\bmonerod\b/gi, "monero D"],
  [/\bmonero-wallet-cli\b/gi, "monero wallet C L I"],
  [/\bmonero-wallet-rpc\b/gi, "monero wallet R P C"],
  [/\bmonero-wallet-gui\b/gi, "monero wallet G U I"],
  [/\bFCMP\+\+/g, "F C M P plus plus"],
  [/\bFCMPs\b/g, "F C M Ps"],
  [/\bFCMP\b/g, "F C M P"],
  [/\bxmrig\b/gi, "X M Rig"],
  [/\bp2pool\b/gi, "P 2 Pool"],
];

export const forSpeech = (text: string) => SAY.reduce((s, [pattern, said]) => s.replace(pattern, said), text);
