import assert from "node:assert/strict";
import { test } from "node:test";
import { onboard, type InfraiCall } from "../src/fintech_onboarding.js";

test("a proven creator payout above the review threshold is held and audited", async () => {
  const calls: string[] = [];
  const call: InfraiCall = async (_method, path, params) => {
    calls.push(path);
    if (path === "/v1/dns/domain/add") return { zone_id: "zone-42" };
    if (path === "/v1/dns/record/upsert") {
      assert.equal(params.zone_id, "zone-42");
      assert.equal(params.record_type, "TXT");
      return {};
    }
    if (path === "/v1/dns/domain/verify") return { verified: true };
    return { id: "creator-7" };
  };
  const result = await onboard({
    domain: "studio.example", email: "owner@studio.example", txtName: "_ownership", txtValue: "proof-123",
    payment: { eventId: "payout-9", amountCents: 120_000, currency: "USD" }
  }, call);
  assert.equal(result.ownerUserId, "creator-7");
  assert.equal(result.paymentEvent.state, "held_for_review");
  assert.equal(result.notification.eventId, "payout-9");
  assert.equal(result.notification.kind, "review_requested");
  assert.deepEqual(calls, ["/v1/dns/domain/add", "/v1/dns/record/upsert", "/v1/dns/domain/verify", "/v1/auth/user/get_by_email"]);
});
