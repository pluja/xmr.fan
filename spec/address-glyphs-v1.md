# Address Glyphs, version 1

**Six emoji that let people recognise a crypto address at a glance.**

```
888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkRxbANsAnjyPbb3iQ1YBRk1UXcdRsiKc9dhwMVgN5S9cQUiyoogDavup3H

🥥🐪🥤 🎮🥓🎸      coconut camel soda · gamepad bacon guitar
```

- Status: draft, open for review
- License: CC0 1.0. Use, copy and implement it without asking.
- Files: this document, the [glyph list](address-glyphs-v1-list.json) and the [test vectors](address-glyphs-v1-vectors.json)
- Reference implementation: `src/lib/glyphs.ts` in the xmr.fan source (TypeScript, about 50 lines)

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

---

## 1. The problem

People compare crypto addresses by glancing at the first and last few characters. Attackers know this:

- **Address poisoning.** The attacker generates an address that starts and ends like one you use, sends you a tiny payment from it, and waits for you to copy it from your history.
- **Clipboard hijacking.** Malware swaps the copied address for a look-alike.
- **Typos and mix-ups.** Two of your own addresses look the same to a tired eye.

Nobody can remember 95 random characters. People do remember a few pictures in order.

## 2. What existing schemes get wrong

| Scheme | Problem |
|---|---|
| Blockies and identicons | Colourful blobs that look alike, can't be described aloud, depend on colour vision, and are cheap to brute-force. |
| SSH randomart | Hard to compare and impossible to say aloud. |
| Matrix and Signal emoji verification | Built for live sessions with fresh randomness, where brute-forcing doesn't apply. A fixed address can be attacked offline for as long as the attacker likes. |
| Per-wallet avatars | Every wallet draws something different, so users learn nothing that carries over. |
| Truncated hashes shown as words | Too few bits, and they depend on the language. |

## 3. Design goals

1. **Expensive to fake.** Finding a different address with the same glyphs must cost far more than finding one with the same start and end characters.
2. **Identical everywhere.** Same address, same glyphs, in every wallet, on every platform. Test vectors are normative.
3. **Easy to implement.** One standard KDF available in every language (libsodium's `crypto_pwhash` works as is), a lookup table and a few normalization rules.
4. **Easy to see, say and share.** Plain Unicode emoji that copy and paste anywhere, each with a canonical name for speech and screen readers.
5. **Chain-agnostic.** Any address format, with domain separation between chains.
6. **A supplement, never a replacement.** Glyphs sit next to the address. They do not hide it.

## 4. Algorithm

### 4.1 Inputs

- `namespace`: the chain family, from the registry in section 5, for example `monero` or `bitcoin`.
- `address`: the address as text. Wallets MUST pass the bare address, already pulled out of any URI (`monero:`, `bitcoin:`, query parameters).

Wallets MUST validate the address with the chain's own rules (checksum, network) before showing glyphs. Glyphs are not a checksum.

### 4.2 Normalization

1. Remove leading and trailing Unicode whitespace.
2. Apply the namespace's case rule (section 5): lowercase case-insensitive formats such as bech32 and EVM hex. Leave case-sensitive formats such as base58 exactly as written.

No other change is allowed. In particular, internal characters, separators and prefixes stay as they are unless the namespace says otherwise.

### 4.3 Hash

```
message  = UTF-8( "glyphs/1:" || namespace || ":" || normalized_address )
salt     = ASCII( "AddressGlyphs-v1" )          (exactly 16 bytes)
digest   = Argon2id(password = message, salt = salt,
                    t = 2, m = 16384 KiB, p = 1, length = 32 bytes, version = 0x13)
```

These parameters equal libsodium's `crypto_pwhash(out, 32, message, len, salt, opslimit = 2, memlimit = 16777216, crypto_pwhash_ALG_ARGON2ID13)`.

### 4.4 Glyphs

```
index[i] = digest[i]        for i = 0 … 5
glyph[i] = LIST[index[i]]   (the 256-entry list in address-glyphs-v1-list.json)
```

A glyph can appear more than once. That is expected, and the order matters.

## 5. Namespace registry

| Namespace | Covers | Case rule |
|---|---|---|
| `monero` | Monero primary, sub- and integrated addresses, every network | As written (base58) |
| `bitcoin` | Bitcoin mainnet, testnet and regtest | bech32/bech32m (`bc1`, `tb1`, `bcrt1`): lowercase. Base58: as written. |
| `litecoin` | Litecoin | bech32 (`ltc1`, `tltc1`, `rltc1`): lowercase. Base58: as written. |
| `evm` | Ethereum and every EVM chain | `0x` plus 40 hex digits, lowercase. The EIP-55 mixed-case checksum is dropped. |
| `solana` | Solana | As written (base58) |

EVM chains share one namespace on purpose: the same key controls the same address on each of them.

**Adding a namespace.** Use a lowercase name (`[a-z0-9-]+`) for the chain or format family, lowercase only the formats that are case-insensitive by definition, and publish at least three test vectors. A new namespace never changes the glyphs of an existing one.

## 6. The glyph list

The 256 glyphs live in [address-glyphs-v1-list.json](address-glyphs-v1-list.json), each with an index, an emoji and a canonical English name. The list is frozen for version 1.

How they were chosen:

- **Concrete things you can name:** animals, food, nature, transport, objects. No faces, people, hands, skin tones, flags, letters, numbers, arrows or clocks.
- **No look-alikes:** one cat, one dog, one tree, one car, one heart. Pairs that differ only by colour are out (coloured hearts, circles, books), so the set works for colour-blind users.
- **Well supported:** single code points from Emoji 5.0 (2017) or earlier, almost all with emoji presentation by default. The few that need it carry U+FE0F, and wallets MUST keep it.
- **Neutral:** no weapons, drugs, alcohol, religious or political symbols, and nothing rude.
- **One-word names** that translate cleanly, so "cat rocket key" works in any language.

Wallets MAY translate the names for display. They MUST NOT change the emoji or their order.

## 7. Display and sharing

### 7.1 Required

- Show all six glyphs, in order, next to the full address. Never truncate, and never show glyphs instead of the address.
- Group them as three and three, with a visible gap: `🥥🐪🥤 🎮🥓🎸`.
- Show them at text size or larger. Don't animate them, shuffle them or recolour them.
- Expose the names to assistive technology, for example as the accessible label `coconut camel soda, gamepad bacon guitar`.
- While computing, show a neutral placeholder of the same width, never partial glyphs.

### 7.2 Recommended

- Let people see the names on hover or long-press, so glyphs that render oddly on one platform can still be checked.
- Show glyphs everywhere an address appears: receive screen, send confirmation, address book, transaction history.
- On the send screen, if the recipient is in the address book, show the saved glyphs next to the pasted ones and flag any difference.
- Use an emoji font that is consistent across your platforms (for example, the openly licensed Noto Emoji or Twemoji) if the system font lacks some glyphs.

### 7.3 Text forms

- **Shareable:** `🥥🐪🥤 🎮🥓🎸`, six emoji with one ASCII space after the third.
- **Spoken:** `coconut camel soda · gamepad bacon guitar`
- **Machine:** `glyphs1:402df7af50b2`, the six indices as lowercase hex. Use this for logs and QR payloads, not for display.

## 8. Security

### 8.1 Threat model

The attacker wants a *different* valid address whose glyphs match a target address, so that a victim who checks glyphs is fooled. They can generate addresses offline, as fast as their hardware allows.

### 8.2 Cost of a match

Six glyphs carry 48 bits. Finding an address whose glyphs match one given target takes about 2^47 tries on average, and every try costs one Argon2id evaluation with 16 MiB of memory.

| Glyph hash | Rough GPU rate | One target, expected time |
|---|---|---|
| A fast hash (SHA-256, BLAKE2) | 10^9 to 10^10 per second | minutes to hours |
| Argon2id, 16 MiB, t = 2 (this spec) | about 10^4 per second | **about 450 GPU-years** |

The Argon2id rate is a generous upper bound, set by memory bandwidth. Generating each candidate address costs extra, which also counts against the attacker.

### 8.3 Many targets at once

An attacker spraying poisoned addresses at many victims succeeds when a candidate matches *any* of N targets, which divides the cost by N. With 100,000 targets, one match costs about 2 GPU-days. That is still expensive per victim, but no longer impossible. This is why glyphs **complement** the start and end characters people already check, rather than replace them. Matching both the glyphs and four leading plus four trailing base58 characters multiplies the costs: more than 2^90 tries for one target, and still more than 2^75 against 100,000 targets.

### 8.4 What glyphs do not protect against

- **A compromised device.** Malware that controls the screen can show the right glyphs beside a wrong address.
- **The wrong address from the start.** If you saved or were given a scammer's address, its glyphs are perfectly consistent.
- **Picture-only checks.** Glyphs are as good as the user's attention. They make the check fast; they cannot force it.

### 8.5 Other notes

- **Fixed salt.** Every wallet must get the same answer, so the salt is a public constant. It doesn't help attackers: each target needs its own search, and a table covering all 2^48 glyph sets would take more Argon2id work than the attack itself.
- **Collisions between your own addresses** are negligible: in a wallet with 1,000 addresses, the chance that any two share glyphs is about two in a billion.
- **Privacy.** Glyphs come from public data and reveal nothing the address doesn't.
- **Caching.** Wallets SHOULD cache glyphs by `message`, never by the raw input.

## 9. Implementing it

**libsodium (C, and bindings for most languages)**

```c
unsigned char digest[32];
const char *salt = "AddressGlyphs-v1";                 /* 16 bytes, no terminator used */
crypto_pwhash(digest, sizeof digest, message, strlen(message), (const unsigned char *)salt,
              2, 16 * 1024 * 1024, crypto_pwhash_ALG_ARGON2ID13);
/* glyph i = LIST[digest[i]] for i = 0..5 */
```

**JavaScript / TypeScript** (`@noble/hashes`, no native code)

```ts
import { argon2id } from "@noble/hashes/argon2.js";
const enc = (s: string) => new TextEncoder().encode(s);
const digest = argon2id(enc(`glyphs/1:${namespace}:${normalized}`), enc("AddressGlyphs-v1"), { t: 2, m: 16384, p: 1, dkLen: 32 });
const glyphs = [...digest.subarray(0, 6)].map((i) => LIST[i]);
```

**Python** (`argon2-cffi`)

```python
from argon2.low_level import hash_secret_raw, Type
digest = hash_secret_raw(message.encode(), b"AddressGlyphs-v1", time_cost=2, memory_cost=16384,
                         parallelism=1, hash_len=32, type=Type.ID)
```

**Performance.** About 20 to 40 ms natively, and 100 to 500 ms in pure JavaScript or WebAssembly on phones. Compute off the UI thread, show the placeholder, and cache the result.

**Conformance.** An implementation conforms when it reproduces every entry in [address-glyphs-v1-vectors.json](address-glyphs-v1-vectors.json): normalized address, message, digest, indices and emoji. The vectors were produced with libargon2 and checked against libsodium and `@noble/hashes`.

## 10. Rationale

**Why six glyphs?** Four or five are easier to remember but too cheap to fake (section 8). Six, shown as two groups of three, is about what people take in at a glance, the way phone numbers are chunked.

**Why emoji and not custom icons?** They copy and paste into any chat, document or terminal, every platform already has a font for them, and they read the same in every language. The names cover the cases where two platforms draw the same emoji differently.

**Why 256?** One byte per glyph keeps the mapping trivial and unbiased. A smaller list would mean more glyphs for the same security. A larger one would hold more look-alikes.

**Why Argon2id?** It is the modern standard for slow, memory-hard hashing (RFC 9106). It is in libsodium, so most wallets already ship it, and its memory cost blunts GPUs and ASICs. One lane (p = 1) matches libsodium, which has no other option.

**Why put the namespace in the hash?** So identical strings on different chains never share glyphs, and each chain's normalization is explicit.

**Why not words?** Words depend on a language. Emoji don't, and they are faster to recognise.

## 11. Versioning

The version is part of `message` and of the salt. A future version may change the list, the parameters or the glyph count. It will produce entirely different glyphs and MUST be labelled, so users never confuse the two. Version 1 will not change once it leaves draft.
