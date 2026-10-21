import { test } from "node:test";
import assert from "node:assert/strict";
import { songFromAddress, STEPS, midiToHz } from "./beat.ts";
import { EXAMPLE_ADDRESS } from "./monero.ts";

const OTHER = "44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A";

test("each address has its own song, and always the same one", () => {
  const a = songFromAddress(EXAMPLE_ADDRESS)!, b = songFromAddress(OTHER)!;
  assert.deepEqual(a, songFromAddress(` ${EXAMPLE_ADDRESS} `));
  assert.notDeepEqual(a.lead, b.lead);
});

test("songs are well-formed and musical", () => {
  const s = songFromAddress(EXAMPLE_ADDRESS)!;
  for (const track of [s.lead, s.bass, s.kick, s.snare, s.hat]) assert.equal(track.length, STEPS);
  assert.ok(s.bpm >= 96 && s.bpm < 144);
  assert.ok(s.kick[0] && s.snare[4], "a downbeat and a backbeat");
  assert.ok(s.lead.some((n) => n !== null), "some melody");
  assert.equal(midiToHz(69), 440);
});

test("not an address, no song", () => {
  assert.equal(songFromAddress("hello"), null);
});
