import type { FastifyInstance } from "fastify";

type AsaasPaymentInput = {
  id: string;
  total: number;
  customer_name?: string;
};

export async function createPixPaymentAsaas(
  app: FastifyInstance,
  order: AsaasPaymentInput,
) {
  const baseUrl = app.config.ASAAS_BASE_URL || "https://sandbox.asaas.com/api/v3";
  const apiKey = app.config.ASAAS_API_KEY || process.env.ASAAS_API_KEY || "";

  if (!apiKey) {
    throw new Error("ASAAS_API_KEY nao configurada");
  }

  const res = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify({
      billingType: "PIX",
      value: Number(order.total) / 100,
      description: `Pedido ${order.id}`,
      externalReference: order.id,
      customer: undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro Asaas: ${res.status} ${text}`);
  }

  return res.json();
}
