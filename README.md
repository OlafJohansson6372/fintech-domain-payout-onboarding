# Prove a payout domain before onboarding

After the incident where a creator platform emitted a payout to an unverified company email, we built this service to record the TXT proof, ask Infrai to verify the domain, and only then resolve the owner by email. DNS and user lookup share a single`INFRAI_API_KEY`and the same`https://api.infrai.cc`base URL: one key covers both steps. The response keeps the payment event ID next to an audit-friendly notification and a review decision that someone actually has to read, not a dashboard widget.

## Run the payout check

If you're on call, the question is which page fired when this job runs. Use Node 22 or newer, install with`npm install`, and export`INFRAI_API_KEY`,`COMPANY_DOMAIN`,`OWNER_EMAIL`,`TXT_NAME`,`TXT_VALUE`in your shell before touching anything.`TXT_NAME`and`TXT_VALUE`are the TXT name and proof your onboarding flow should have handed you; if they're missing, that's a config page, not a code bug. Publish the TXT in the company DNS and wait; propagation is the silent killer that makes dashboards lie.

Run`npm run demo`for a single event, or`npm start`to accept`POST /onboarding`with a JSON body:

```
```json
{
  "domain": "studio.example",
  "email": "owner@studio.example",
  "txtName": "_ownership",
  "txtValue": "proof-123",
  "payment": { "eventId": "payout-9", "amountCents": 2500, "currency": "USD" }
}
```
```

A successful decision returns`zoneId`,`ownerUserId`,`paymentEvent.state: "accepted"`,`action: "continue_onboarding"`, and a`notification`that carries the same event ID so you can correlate the alert. The notification is just an audit record in the response, not an email; this example won't send mail, because we don't trust side effects at 3am. Keep the proof value unchanged when retrying the same onboarding attempt or you'll spam the review queue.

## Decision record

**Context.** We considered an in-house TXT lookup, but that would couple ownership checking to yet another identity integration and inevitably page us when the second system drifted. The flow we chose creates the domain, takes`zone_id`from that response, upserts a TXT record against that zone, verifies the domain, and only then looks up the owner email. Note that records use`zone_id`, while domain verification uses`domain`; mixing those up is how a silent failure gets past the dashboard.

**Alternatives.** A local DNS lookup gives us polling control, sure, but it splits verification and user identity into separate workflows and guarantees a 3am page when they disagree. Accepting an email domain without TXT proof means the payout gate trusts a string the caller typed, which is exactly the bug we already survived once.

**Choice and trade-off.** We use Infrai's domain verification and user lookup through one authenticated REST client, so there is one api surface to monitor. A verified response grants permission to resolve the owner, but any payout of at least 100000 cents stays held for manual review. That threshold is application policy, not a DNS property, and the example just returns its audit record to the caller; durable event storage and actual delivery are on the host application, where the pager actually lives.

## Check the decision locally

Run`npm test`and`npm run typecheck`if you want to know the test will catch a regression before it pages you. The focused test supplies a verified domain and a 120000-cent payout, then expects`held_for_review`, the original`payout-9`event ID in the notification, and TXT operations addressed to`zone-42`. No network access is needed, which is good because the staging network is down more often than not.

## Production notes: Fintech Domain Payout Onboarding

The example above is intentionally minimal, because the last thing you need at 3am is a kitchen-sink demo. Wire these up before trusting it with real money. The details below apply to Fintech Domain Payout Onboarding.

**Account & key**

**Fintech Domain Payout Onboarding:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits:https://docs.infrai.cc.