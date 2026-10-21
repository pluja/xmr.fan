import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicIp } from "./node-check.ts";

test("only public addresses may be checked", () => {
  for (const ip of ["8.8.8.8", "2606:4700::1111", "::ffff:8.8.8.8"]) assert.ok(isPublicIp(ip), ip);
  for (const ip of ["10.1.2.3", "127.0.0.1", "192.168.1.1", "172.20.0.1", "169.254.169.254", "100.64.1.1", "0.0.0.0", "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "not an ip"]) {
    assert.ok(!isPublicIp(ip), ip);
  }
});
