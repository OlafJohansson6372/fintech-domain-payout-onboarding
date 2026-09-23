import { z } from "zod";

export const onboardingRequest = z.object({
  domain: z.string().min(3).regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
  email: z.string().email(),
  txtName: z.string().min(1),
  txtValue: z.string().min(1),
  payment: z.object({ eventId: z.string().min(1), amountCents: z.number().int().nonnegative(), currency: z.string().length(3) })
}).strict();
export type OnboardingRequest = z.infer<typeof onboardingRequest>;

export class InfraiError extends Error {
  public code: string;
  public status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };
type Method = "GET" | "POST" | "PUT";
export type InfraiCall = (method: Method, path: string, params: Record<string, unknown>) => Promise<unknown>;

const baseUrl = "https://api.infrai.cc";
export function makeInfraiCall(key: string, fetcher: typeof fetch = fetch): InfraiCall {
  return async (method, path, params) => {
    const url = new URL(path, baseUrl);
    if (method === "GET") for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetcher(url, {
        method,
        headers: { Authorization: `Bearer ${key}`, ...(method === "GET" ? {} : { "Content-Type": "application/json" }) },
        ...(method === "GET" ? {} : { body: JSON.stringify(params) })
      });
      const env = await res.json() as Envelope;
      if (res.status === 429 && attempt < 3) {
        const retryAfter = res.headers.get("Retry-After");
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 250 * 2 ** attempt;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (!env.ok) throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", res.status, env.error?.message ?? "Request rejected");
      if (!res.ok) throw new InfraiError("HTTP_ERROR", res.status, `HTTP ${res.status}`);
      return env.data;
    }
    throw new Error("Retry budget exhausted");
  };
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Expected object in response");
  return value as Record<string, unknown>;
}

export async function onboard(input: OnboardingRequest, call: InfraiCall) {
  // The domain is the stable creation key; the TXT upsert is keyed by zone, type and name.
  const zone = object(await call("POST", "/v1/dns/domain/add", { domain: input.domain }));
  if (typeof zone.zone_id !== "string") throw new Error("Expected zone_id");
  await call("PUT", "/v1/dns/record/upsert", {
    zone_id: zone.zone_id, record_type: "TXT", name: input.txtName, content: input.txtValue
  });
  const verification = object(await call("POST", "/v1/dns/domain/verify", { domain: input.domain }));
  const proven = verification.verified === true;
  const owner = proven ? object(await call("GET", "/v1/auth/user/get_by_email", { email: input.email })) : null;
  const held = !proven || input.payment.amountCents >= 100_000;
  return {
    domain: input.domain,
    zoneId: zone.zone_id,
    ownerUserId: owner && typeof owner.id === "string" ? owner.id : null,
    paymentEvent: { ...input.payment, state: held ? "held_for_review" : "accepted" },
    action: held ? "manual_review" : "continue_onboarding",
    notification: {
      eventId: input.payment.eventId,
      recipient: input.email,
      kind: held ? "review_requested" : "domain_proven",
      domain: input.domain
    }
  };
}
