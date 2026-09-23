import { makeInfraiCall, onboard, onboardingRequest } from "./fintech_onboarding.js";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY");
const input = onboardingRequest.parse({
  domain: process.env.COMPANY_DOMAIN,
  email: process.env.OWNER_EMAIL,
  txtName: process.env.TXT_NAME,
  txtValue: process.env.TXT_VALUE,
  payment: { eventId: "creator-payout-001", amountCents: 2500, currency: "USD" }
});
console.log(JSON.stringify(await onboard(input, makeInfraiCall(key)), null, 2));
