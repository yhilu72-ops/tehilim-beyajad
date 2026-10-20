
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getSupabaseAdminKey(): string {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey) return serviceRoleKey;

  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson);
      if (typeof secretKeys.default === "string" && secretKeys.default.length > 0) {
        return secretKeys.default;
      }
      const firstSecretKey = Object.values(secretKeys).find(
        (value) => typeof value === "string" && value.length > 0,
      );
      if (typeof firstSecretKey === "string") return firstSecretKey;
    } catch (error) {
      console.error("No se pudo leer SUPABASE_SECRET_KEYS:", error);
    }
  }

  throw new Error("No se encontró una credencial administrativa de Supabase");
}

async function safeReadJson(response: Response): Promise<Record<string, any>> {
  const responseText = await response.text();
  if (!responseText) return {};
  try {
    return JSON.parse(responseText);
  } catch {
    return { rawResponse: responseText };
  }
}

async function createHmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function secureCompareHex(calculated: string, received: string): boolean {
  const a = calculated.trim().toLowerCase();
  const b = received.trim().toLowerCase();
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

async function verifyWebhookSignature(
  req: Request,
  paymentId: string,
): Promise<boolean> {
  const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("No se encontró MERCADO_PAGO_WEBHOOK_SECRET");
    return false;
  }

  const xSignature = req.headers.get("x-signature") || "";
  const xRequestId = req.headers.get("x-request-id") || "";
  const parts: Record<string, string> = {};

  for (const part of xSignature.split(",")) {
    const pos = part.indexOf("=");
    if (pos === -1) continue;
    const key = part.slice(0, pos).trim();
    const value = part.slice(pos + 1).trim();
    if (key && value) parts[key] = value;
  }

  const timestamp = parts.ts;
  const receivedSignature = parts.v1;
  if (!timestamp || !receivedSignature) return false;

  const manifest =
    `id:${paymentId.toLowerCase()};` +
    `request-id:${xRequestId};` +
    `ts:${timestamp};`;

  const calculated = await createHmac(webhookSecret, manifest);
  return secureCompareHex(calculated, receivedSignature);
}

function stringifyError(value: unknown): string {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.slice(0, 4000);
  } catch {
    return "Error no serializable";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return jsonResponse({ ok: true, service: "mercadopago-webhook", version: 8 });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  let webhookEventId: string | null = null;

  try {
    const url = new URL(req.url);

    let body: Record<string, any> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const topic =
      String(
        body.type ||
          body.topic ||
          url.searchParams.get("type") ||
          url.searchParams.get("topic") ||
          "",
      ).trim();

    if (topic && topic !== "payment") {
      return jsonResponse({ received: true, ignored: topic });
    }

    // Webhook moderno: ?data.id=...&type=payment o body.data.id
    const modernQueryId = url.searchParams.get("data.id");
    const modernBodyId = body?.data?.id ? String(body.data.id) : "";

    // IPN legacy: ?id=...&topic=payment
    const legacyQueryId = url.searchParams.get("id");

    const paymentId = String(
      modernQueryId || modernBodyId || legacyQueryId || "",
    ).trim();

    if (!paymentId) {
      return jsonResponse({
        received: true,
        message: "Notificación recibida sin Payment ID",
      });
    }

    const isModernWebhook = Boolean(modernQueryId || modernBodyId);

    let signatureValid: boolean | null = null;

    if (isModernWebhook) {
      signatureValid = await verifyWebhookSignature(req, paymentId);

      if (!signatureValid) {
        console.error("Se rechazó una notificación Webhook con firma inválida");
        return jsonResponse({ error: "Firma inválida" }, 401);
      }
    } else {
      // IPN legacy no puede validarse con la clave secreta.
      // Nunca confiamos en el payload: consultamos el pago directamente
      // a Mercado Pago y validamos seller, referencia, monto, moneda y metadata.
      signatureValid = null;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("No se encontró SUPABASE_URL");

    const supabaseAdmin = createClient(
      supabaseUrl,
      getSupabaseAdminKey(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const xRequestId = req.headers.get("x-request-id");

    const { data: insertedEvent, error: eventInsertError } =
      await supabaseAdmin
        .from("mercadopago_webhook_events")
        .insert({
          provider_payment_id: paymentId,
          event_type: topic || "payment",
          action: body?.action || null,
          request_id: xRequestId,
          signature_valid: signatureValid,
          processing_status: isModernWebhook
            ? "processing_webhook"
            : "processing_ipn",
          raw_payload: {
            mode: isModernWebhook ? "webhook" : "ipn",
            body,
            query: Object.fromEntries(url.searchParams.entries()),
          },
        })
        .select("id")
        .single();

    if (eventInsertError) {
      console.error("No se pudo registrar el Webhook/IPN:", eventInsertError);
    } else {
      webhookEventId = insertedEvent.id;
    }

    async function updateWebhookEvent(
      processingStatus: string,
      processingError: string | null = null,
    ): Promise<void> {
      if (!webhookEventId) return;
      const { error } = await supabaseAdmin
        .from("mercadopago_webhook_events")
        .update({
          processing_status: processingStatus,
          processing_error: processingError,
          processed_at: new Date().toISOString(),
        })
        .eq("id", webhookEventId);

      if (error) console.error("No se pudo actualizar historial:", error);
    }

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("No se encontró MERCADO_PAGO_ACCESS_TOKEN");
    }

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const payment = await safeReadJson(paymentResponse);

    if (!paymentResponse.ok) {
      const lookupError =
        `Mercado Pago HTTP ${paymentResponse.status}: ` +
        stringifyError(payment);

      await updateWebhookEvent("payment_lookup_error", lookupError);
      return jsonResponse(
        { error: "No se pudo consultar el pago", paymentId },
        500,
      );
    }

    // Seguridad: el pago debe pertenecer al seller esperado.
    const environment = Deno.env.get("MERCADO_PAGO_ENVIRONMENT") === "production" ? "production" : "sandbox";
    const expectedCollectorId = environment === "production" ? Number(Deno.env.get("MERCADO_PAGO_COLLECTOR_ID")) : Number(Deno.env.get("MERCADO_PAGO_TEST_COLLECTOR_ID") || "3546561536");
    if (Number(payment.collector_id) !== expectedCollectorId) {
      await updateWebhookEvent(
        "ignored_wrong_collector",
        `Collector recibido: ${payment.collector_id}`,
      );
      return jsonResponse({
        received: true,
        processed: false,
        reason: "El pago pertenece a otro vendedor",
      });
    }

    const paymentProject = payment?.metadata?.project || null;
    if (paymentProject && paymentProject !== "tehilim-beyajad") {
      await updateWebhookEvent(
        "ignored_wrong_project",
        `Proyecto recibido: ${paymentProject}`,
      );
      return jsonResponse({
        received: true,
        processed: false,
        reason: "El pago pertenece a otro proyecto",
      });
    }

    const externalReference = String(
      payment.external_reference || "",
    ).trim();

    if (!externalReference) {
      await updateWebhookEvent(
        "missing_external_reference",
        "El pago no contiene external_reference",
      );
      return jsonResponse({
        received: true,
        processed: false,
        reason: "El pago no contiene external_reference",
        paymentId,
      });
    }

    const { data: pendingPayment, error: pendingPaymentError } =
      await supabaseAdmin
        .from("mercadopago_payments")
        .select(
          "id,provider_payment_id,external_reference,plan,amount_expected,currency,status,metadata",
        )
        .eq("external_reference", externalReference)
        .maybeSingle();

    if (pendingPaymentError) {
      await updateWebhookEvent(
        "database_lookup_error",
        pendingPaymentError.message,
      );
      throw new Error(
        `No se pudo consultar la aportación: ${pendingPaymentError.message}`,
      );
    }

    if (!pendingPayment) {
      await updateWebhookEvent(
        "orphan_payment",
        `No existe external_reference ${externalReference}`,
      );
      return jsonResponse({
        received: true,
        processed: false,
        reason: "No existe la aportación correspondiente",
        paymentId,
        externalReference,
      });
    }

    const { data: paymentIdOwner, error: paymentIdOwnerError } =
      await supabaseAdmin
        .from("mercadopago_payments")
        .select("id,external_reference")
        .eq("provider_payment_id", paymentId)
        .maybeSingle();

    if (paymentIdOwnerError) {
      await updateWebhookEvent(
        "database_lookup_error",
        paymentIdOwnerError.message,
      );
      throw new Error(
        `No se pudo comprobar Payment ID: ${paymentIdOwnerError.message}`,
      );
    }

    const validationErrors: string[] = [];
    if (pendingPayment.metadata?.environment && pendingPayment.metadata.environment !== environment) validationErrors.push("environment_mismatch");
    if (environment === "production" && payment.live_mode !== true) validationErrors.push("not_a_live_payment");

    if (paymentIdOwner && paymentIdOwner.id !== pendingPayment.id) {
      validationErrors.push("payment_id_already_used_by_another_record");
    }

    if (
      pendingPayment.provider_payment_id &&
      String(pendingPayment.provider_payment_id) !== paymentId
    ) {
      validationErrors.push("record_already_has_another_payment_id");
    }

    const amountReceived = Number(payment.transaction_amount);
    const amountExpected = Number(pendingPayment.amount_expected);

    if (
      !Number.isFinite(amountReceived) || !Number.isFinite(amountExpected) || amountExpected <= 0 ||
      Math.abs(amountReceived - amountExpected) > 0.001
    ) {
      validationErrors.push(
        `amount_mismatch_expected_${amountExpected}_received_${amountReceived}`,
      );
    }

    const currencyReceived = String(payment.currency_id || "").toUpperCase();
    const currencyExpected = String(
      pendingPayment.currency || "MXN",
    ).toUpperCase();

    if (currencyReceived !== currencyExpected) {
      validationErrors.push(
        `currency_mismatch_expected_${currencyExpected}_received_${currencyReceived}`,
      );
    }

    const paymentPlan = payment?.metadata?.plan || null;
    if (paymentPlan && paymentPlan !== pendingPayment.plan) {
      validationErrors.push(
        `plan_mismatch_expected_${pendingPayment.plan}_received_${paymentPlan}`,
      );
    }

    const payerEmail =
      typeof payment?.payer?.email === "string"
        ? payment.payer.email
        : null;

    if (validationErrors.length > 0) {
      const validationDetail = validationErrors.join("|");

      // Invalid notifications are audit events, never payment state changes.
      // A mismatched second payment must not revoke a verified contribution.
      await updateWebhookEvent("validation_error", validationDetail);

      return jsonResponse({
        received: true,
        processed: false,
        paymentId,
        externalReference,
        validationErrors,
      });
    }

    const paymentStatus = String(payment.status || "unknown");
    const paymentStatusDetail =
      typeof payment.status_detail === "string"
        ? payment.status_detail
        : null;

    const paymentUpdate: Record<string, unknown> = {
      provider_payment_id: paymentId,
      amount_received: amountReceived,
      currency: currencyReceived,
      status: paymentStatus,
      status_detail: paymentStatusDetail,
      payer_email: payerEmail,
      raw_payment: payment,
    };

    if (paymentStatus === "approved") {
      paymentUpdate.paid_at =
        payment.date_approved || new Date().toISOString();
    }

    const { error: paymentUpdateError } = await supabaseAdmin
      .from("mercadopago_payments")
      .update(paymentUpdate)
      .eq("id", pendingPayment.id);

    if (paymentUpdateError) {
      await updateWebhookEvent(
        "payment_update_error",
        paymentUpdateError.message,
      );
      throw new Error(paymentUpdateError.message);
    }

    await updateWebhookEvent(
      isModernWebhook ? "processed_webhook" : "processed_ipn",
    );

    console.log("Pago procesado correctamente:", {
      paymentId,
      externalReference,
      status: paymentStatus,
      amount: amountReceived,
      currency: currencyReceived,
      mode: isModernWebhook ? "webhook" : "ipn",
    });

    return jsonResponse({
      received: true,
      processed: true,
      paymentId,
      externalReference,
      status: paymentStatus,
      statusDetail: paymentStatusDetail,
      mode: isModernWebhook ? "webhook" : "ipn",
    });
  } catch (error) {
    console.error("Error en mercadopago-webhook:", error);
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error inesperado",
      },
      500,
    );
  }
});

