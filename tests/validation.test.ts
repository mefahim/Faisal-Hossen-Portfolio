import test from "node:test";
import assert from "node:assert/strict";
import { contactSchema, loginSchema, passwordChangeSchema, contentDraftSchema, mediaMetadataSchema, leadStatusSchema } from "../lib/server/validation";

test("owner login schema normalizes email and rejects malformed input", () => {
  assert.deepEqual(loginSchema.parse({ email: " OWNER@example.com ", password: "a" }).email, "owner@example.com");
  assert.equal(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success, false);
});

test("password rotation requires 14 characters", () => {
  assert.equal(passwordChangeSchema.safeParse({ currentPassword: "current", newPassword: "short" }).success, false);
  assert.equal(passwordChangeSchema.safeParse({ currentPassword: "current", newPassword: "a-long-unique-passphrase" }).success, true);
});

test("contact submission bounds fields and only accepts valid email addresses", () => {
  const good = { name: "Ada Example", email: "ada@example.com", company: "", subject: "Project enquiry", message: "This is a sufficiently detailed message." };
  assert.equal(contactSchema.safeParse(good).success, true);
  assert.equal(contactSchema.safeParse({ ...good, email: "bad" }).success, false);
  assert.equal(contactSchema.safeParse({ ...good, message: "short" }).success, false);
  assert.equal(contactSchema.safeParse({ ...good, message: "x".repeat(5001) }).success, false);
});

test("content JSON is bounded and kind is constrained to Phase 1 records", () => {
  assert.equal(contentDraftSchema.safeParse({ kind: "projects", key: "nicola", draft: { title: "Nicola" } }).success, true);
  assert.equal(contentDraftSchema.safeParse({ kind: "analytics", key: "ga4", draft: {} }).success, false);
  assert.equal(contentDraftSchema.safeParse({ kind: "pages", key: "home", draft: { huge: "x".repeat(210_000) } }).success, false);
});

test("media metadata bounds alt text and focal point", () => {
  assert.equal(mediaMetadataSchema.safeParse({ altText: "A project image", focalX: 0.5, focalY: 0.25 }).success, true);
  assert.equal(mediaMetadataSchema.safeParse({ altText: "x", focalX: 2, focalY: 0.5 }).success, false);
});

test("lead status is constrained to the planned lifecycle", () => {
  assert.equal(leadStatusSchema.safeParse({ id: "3f335b59-41d0-817e-8807-c0ae52b0bdc1", status: "reviewing" }).success, true);
  assert.equal(leadStatusSchema.safeParse({ id: "3f335b59-41d0-817e-8807-c0ae52b0bdc1", status: "deleted" }).success, false);
});
