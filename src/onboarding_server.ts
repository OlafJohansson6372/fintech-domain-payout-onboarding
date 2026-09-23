import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, makeInfraiCall, onboard, onboardingRequest } from "./fintech_onboarding.js";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY");
const call = makeInfraiCall(key);

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/onboarding") {
    res.writeHead(404).end();
    return;
  }
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16_384) { res.writeHead(413).end(); return; }
    }
    const input = onboardingRequest.parse(JSON.parse(body));
    const result = await onboard(input, call);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof ZodError || error instanceof SyntaxError ? 400
      : error instanceof InfraiError && error.status >= 400 && error.status < 500 ? error.status : 502;
    const message = error instanceof Error ? error.message : "Request failed";
    res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: message }));
  }
}).listen(Number(process.env.PORT ?? 3000));
