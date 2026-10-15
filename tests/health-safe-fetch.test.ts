import test from "node:test";
import assert from "node:assert/strict";
import { isPublicIp, validateTargetUrl, SafeFetchError } from "../lib/server/health/safe-fetch";

// --- isPublicIp: SSRF protection ---

test("isPublicIp accepts public IPv4 addresses", () => {
  assert.equal(isPublicIp("93.184.216.34"), true);
  assert.equal(isPublicIp("8.8.8.8"), true);
  assert.equal(isPublicIp("1.1.1.1"), true);
});

test("isPublicIp blocks loopback", () => {
  assert.equal(isPublicIp("127.0.0.1"), false);
  assert.equal(isPublicIp("127.0.0.2"), false);
  assert.equal(isPublicIp("::1"), false);
});

test("isPublicIp blocks private ranges", () => {
  assert.equal(isPublicIp("10.0.0.1"), false);
  assert.equal(isPublicIp("10.255.255.255"), false);
  assert.equal(isPublicIp("172.16.0.1"), false);
  assert.equal(isPublicIp("172.31.255.255"), false);
  assert.equal(isPublicIp("192.168.1.1"), false);
  // Boundaries: just outside the private ranges are public.
  assert.equal(isPublicIp("172.15.255.255"), true);
  assert.equal(isPublicIp("172.32.0.1"), true);
});

test("isPublicIp blocks link-local (cloud metadata)", () => {
  assert.equal(isPublicIp("169.254.169.254"), false);
  assert.equal(isPublicIp("169.254.0.1"), false);
});

test("isPublicIp blocks reserved/multicast/unspecified", () => {
  assert.equal(isPublicIp("0.0.0.0"), false);
  assert.equal(isPublicIp("224.0.0.1"), false);
  assert.equal(isPublicIp("240.0.0.1"), false);
  assert.equal(isPublicIp("192.0.2.1"), false); // documentation
  assert.equal(isPublicIp("::"), false);
});

test("isPublicIp blocks IPv4-mapped IPv6 to private addresses", () => {
  assert.equal(isPublicIp("::ffff:127.0.0.1"), false);
  assert.equal(isPublicIp("::ffff:10.0.0.1"), false);
  assert.equal(isPublicIp("::ffff:192.168.1.1"), false);
  assert.equal(isPublicIp("::ffff:8.8.8.8"), true);
});

test("isPublicIp blocks IPv6 private ranges", () => {
  assert.equal(isPublicIp("fe80::1"), false);
  assert.equal(isPublicIp("fc00::1"), false);
  assert.equal(isPublicIp("fd00::1"), false);
  assert.equal(isPublicIp("ff02::1"), false);
});

test("isPublicIp rejects trickery and garbage", () => {
  assert.equal(isPublicIp("0x7f.0.0.1"), false);
  assert.equal(isPublicIp("0177.0.0.1"), false);
  assert.equal(isPublicIp("not-an-ip"), false);
  assert.equal(isPublicIp(""), false);
});

// --- validateTargetUrl ---

test("validateTargetUrl accepts http/https URLs", () => {
  assert.equal(validateTargetUrl("https://example.com").hostname, "example.com");
  assert.equal(validateTargetUrl("http://example.com/path?q=1").protocol, "http:");
});

test("validateTargetUrl rejects dangerous schemes", () => {
  for (const u of ["ftp://example.com", "file:///etc/passwd", "javascript:alert(1)", "data:text/html,hi"]) {
    assert.throws(() => validateTargetUrl(u), SafeFetchError, u);
  }
});

test("validateTargetUrl rejects credentials in URL", () => {
  assert.throws(() => validateTargetUrl("https://user:pass@example.com"), SafeFetchError);
});

test("validateTargetUrl rejects non-standard ports", () => {
  assert.throws(() => validateTargetUrl("https://example.com:8443"), SafeFetchError);
  assert.throws(() => validateTargetUrl("http://example.com:8080"), SafeFetchError);
  // Default ports are fine.
  assert.doesNotThrow(() => validateTargetUrl("https://example.com:443"));
});

test("validateTargetUrl rejects garbage", () => {
  assert.throws(() => validateTargetUrl(""), SafeFetchError);
  assert.throws(() => validateTargetUrl("not a url"), SafeFetchError);
  assert.throws(() => validateTargetUrl("x".repeat(3000)), SafeFetchError);
});
