import crypto from "node:crypto";

const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || "dev-secret";

export function signQrPayload(data: Record<string, unknown>) {
  const payload = JSON.stringify(data);

  const signature = crypto
    .createHmac("sha256", QR_SECRET)
    .update(payload)
    .digest("hex");

  return Buffer.from(
    JSON.stringify({
      payload,
      signature,
    }),
  ).toString("base64");
}

export function verifyQrPayload(qr: string) {
  try {
    const decoded = Buffer.from(qr, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);

    const payload = parsed.payload;
    const signature = parsed.signature;

    if (!payload || !signature) {
      return { valid: false as const };
    }

    const expected = crypto
      .createHmac("sha256", QR_SECRET)
      .update(payload)
      .digest("hex");

    if (expected !== signature) {
      return { valid: false as const };
    }

    return {
      valid: true as const,
      data: JSON.parse(payload),
    };
  } catch {
    return { valid: false as const };
  }
}
