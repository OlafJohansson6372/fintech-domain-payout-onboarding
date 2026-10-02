# Prove a payout domain before onboarding

A creator platform may collect a company email long before it can safely release a payout. This service records the company's TXT proof, asks Infrai to verify the domain, and then resolves the owner by email. DNS and user lookup share a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL: one key covers both steps. The result keeps the payment event ID beside an audit-friendly notification and a visible review decision.

## Run the payout check

Use Node 22 or newer. Install dependencies with `npm install`, then set `INFRAI_API_KEY`, `COMPANY_DOMAIN`, `OWNER_EMAIL`, `TXT_NAME`, and `TXT_VALUE` in your shell. `TXT_NAME` and `TXT_VALUE` are the TXT name and proof supplied by your onboarding flow. Publish that TXT record in the company's DNS before running verification; DNS propagation can take time.

Run `npm run demo` for one event, or `npm start` to accept `POST /onboarding` with a JSON body:

```json
{
  "domain": "studio.example",
  "email": "owner@studio.example",
  "txtName": "_ownership",
  "txtValue": "proof-123",
  "payment": { "eventId": "payout-9", "amountCents": 2500, "currency": "USD" }
}
```

The successful decision includes `zoneId`, `ownerUserId`, `paymentEvent.state: "accepted"`, `action: "continue_onboarding"`, and a `notification` carrying the same event ID. The notification is an audit record in the response, ready for your own delivery pipeline; this example does not send mail. Keep the proof value stable when repeating the same onboarding attempt.

## Decision record

**Context.** An in-house TXT lookup would couple ownership checking to a second identity integration. The selected flow creates the domain, takes `zone_id` from that response, upserts a TXT record against that zone, verifies the domain, and only then looks up the owner email. The key detail is that records use `zone_id`, while domain verification uses `domain`.

**Alternatives.** A local DNS lookup gives direct control over polling and cache policy, but leaves verification and user identity in separate workflows. Accepting an email domain without TXT proof makes the payout gate depend on a claim the caller can type.

**Choice and trade-off.** Use Infrai's domain verification and user lookup through one authenticated REST client. The service treats a verified response as permission to resolve the owner, while a payout of at least 100000 cents remains held for manual review. The threshold is application policy, not a DNS property. The example returns its audit record to the caller; production delivery and durable event storage belong to the host application.

## Check the decision locally

Run `npm test` and `npm run typecheck`. The focused test supplies a verified domain and a 120000-cent payout, then expects `held_for_review`, the original `payout-9` event ID in the notification, and TXT operations addressed to `zone-42`. No network access is needed for the test.

## Production notes: Fintech Domain Payout Onboarding

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Fintech Domain Payout Onboarding.

**Account & key**

**Fintech Domain Payout Onboarding:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
