import { env } from "../../config/env";
import { logIntegrationCall, serviceMock, withRetry, withTimeout } from "./index";

// Twilio SMS for phone-number OTP verification (registration + phone change).
// MOCK mode prints the code to the server console, mirroring the dev-email
// behaviour in lib/mailer.ts; TWILIO_MOCK=false sends real SMS with the
// TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM credentials.

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  if (serviceMock("TWILIO")) {
    logIntegrationCall("twilio", "sendOtpSms", { phone });
    // eslint-disable-next-line no-console
    console.log(`\n[DEV SMS] Verification code for ${phone}: ${code}\n`);
    return;
  }

  const sid = env.twilioAccountSid;
  const authToken = env.twilioAuthToken;
  const from = env.twilioFrom;
  if (!sid || !authToken || !from) {
    throw new Error("Twilio is live (TWILIO_MOCK=false) but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM are not all set");
  }

  logIntegrationCall("twilio", "sendOtpSms", { phone });
  await withRetry(
    () =>
      withTimeout(
        (async () => {
          const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: phone,
              From: from,
              Body: `${code} is your LuxeLoom verification code. It expires in 10 minutes.`,
            }).toString(),
          });
          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            throw new Error(`Twilio responded ${res.status}: ${detail.slice(0, 300)}`);
          }
        })(),
        10_000,
        "twilio.sendOtpSms"
      ),
    { retries: 2, label: "twilio.sendOtpSms" }
  );
}
