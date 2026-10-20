import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_EXTERNAL_REFERENCE =
  "f3231baf-83cf-464c-8b5d-9741d0873b7e";

const DEFAULT_PREFERENCE_ID =
  "3546561536-30ab58a0-77b8-46e8-97af-28665a08d31f";

type RequestBody = {
  mode?: unknown;
  externalReference?: unknown;
  preferenceId?: unknown;
};

type ApiResult = {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  data: unknown;
};

function jsonResponse(
  data: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getSupabaseAdminKey(): string {
  const secretKeysJson = Deno.env.get(
    "SUPABASE_SECRET_KEYS",
  );

  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson);

      if (
        typeof secretKeys.default === "string" &&
        secretKeys.default.length > 0
      ) {
        return secretKeys.default;
      }

      const firstKey = Object.values(secretKeys).find(
        (value) =>
          typeof value === "string" &&
          value.length > 0,
      );

      if (typeof firstKey === "string") {
        return firstKey;
      }
    } catch (error) {
      console.error(
        "No se pudo leer SUPABASE_SECRET_KEYS:",
        error,
      );
    }
  }

  const legacyServiceRoleKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (legacyServiceRoleKey) {
    return legacyServiceRoleKey;
  }

  throw new Error(
    "No se encontró una credencial administrativa de Supabase",
  );
}

function normalizeRequiredString(
  value: unknown,
  fallback: string,
  fieldName: string,
): string {
  const normalized =
    typeof value === "string"
      ? value.trim()
      : fallback;

  if (!normalized) {
    throw new Error(
      `No se recibió el campo ${fieldName}`,
    );
  }

  if (normalized.length > 250) {
    throw new Error(
      `El campo ${fieldName} es demasiado largo`,
    );
  }

  return normalized;
}

/*
 * Evita mostrar datos innecesariamente sensibles
 * dentro de la respuesta del diagnóstico.
 */
function redactSensitive(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const output: Record<string, unknown> = {};

    const blockedKeys = new Set([
      "authorization",
      "access_token",
      "password",
      "security_code",
      "card_number",
      "card_token",
      "card",
      "email",
      "payer_email",
      "identification",
      "phone",
      "address",
    ]);

    for (
      const [key, nestedValue] of Object.entries(
        value as Record<string, unknown>,
      )
    ) {
      if (blockedKeys.has(key.toLowerCase())) {
        output[key] = "[REDACTADO]";
      } else {
        output[key] = redactSensitive(nestedValue);
      }
    }

    return output;
  }

  return value;
}

async function mercadoPagoGet(
  path: string,
  accessToken: string,
): Promise<ApiResult> {
  const url = `https://api.mercadopago.com${path}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();

    let data: unknown = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = {
          rawResponse: responseText,
        };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url,
      data: redactSensitive(data),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText:
        error instanceof Error
          ? error.message
          : "Error de conexión",
      url,
      data: null,
    };
  }
}

function getArray(
  value: unknown,
  propertyName: string,
): Record<string, any>[] {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return [];
  }

  const property = (
    value as Record<string, unknown>
  )[propertyName];

  return Array.isArray(property)
    ? property.filter(
        (item) =>
          item &&
          typeof item === "object",
      ) as Record<string, any>[]
    : [];
}

function uniqueObjectsById(
  objects: Record<string, any>[],
): Record<string, any>[] {
  const seen = new Set<string>();

  return objects.filter((item) => {
    const id = String(item?.id || "").trim();

    if (!id) {
      return false;
    }

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function uniqueStrings(
  values: unknown[],
): string[] {
  return Array.from(
    new Set(
      values
        .map((value) =>
          String(value || "").trim()
        )
        .filter(Boolean),
    ),
  );
}


/** Fixed test-account identity checks only. Never return tokens, login details or raw user profiles. */
async function identityChecks(accessToken: string) {
  async function inspect(path: string, kind: "user" | "application") {
    try {
      const origin = kind === "application" ? "https://api.mercadolibre.com" : "https://api.mercadopago.com";
      const response = await fetch(origin + path, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return { httpStatus: response.status, verified: false };
      const data = await response.json();
      if (kind === "application") return {
        httpStatus: response.status, verified: true,
        id: data.id ?? null, name: typeof data.name === "string" ? data.name : null,
        ownerId: data.owner_id ?? null,
      };
      return {
        httpStatus: response.status, verified: true,
        id: data.id ?? null, siteId: data.site_id ?? null,
        userType: typeof data.user_type === "string" ? data.user_type : null,
        testUser: Array.isArray(data.tags) ? data.tags.includes("test_user") : null,
        siteStatus: data.site_status ?? data.status?.site_status ?? null,
        buyAllowed: typeof data.status?.buy?.allow === "boolean" ? data.status.buy.allow : null,
        sellAllowed: typeof data.status?.sell?.allow === "boolean" ? data.status.sell.allow : null,
        emailIsTest: typeof data.email === "string" ? data.email.toLowerCase().endsWith("@testuser.com") : null,
      };
    } catch { return { httpStatus: 0, verified: false }; }
  }
  const [tokenOwner, expectedBuyer, declaredApplication, observedApplication] = await Promise.all([
    inspect("/users/me", "user"),
    inspect("/users/3593562754", "user"),
    inspect("/applications/9001196078600708", "application"),
    inspect("/applications/2199523174965454", "application"),
  ]);
  return { tokenOwner, expectedBuyer, declaredApplication, observedApplication,
    limitation: "Expected buyer identity is not proof of the buyer session used inside hosted Checkout." };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Método no permitido",
      },
      405,
    );
  }

  // Authenticate before reading provider credentials or payment records.
  // Modern Supabase secret keys are not JWTs: authorize them here on `apikey`.
  // Legacy service-role Bearer tokens remain supported; public/user keys do not.
  const legacyAdmin = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let secretKeys: string[] = [];
  try {
    const configured = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    if (configured && typeof configured === "object" && !Array.isArray(configured))
      secretKeys = Object.values(configured).filter((key): key is string => typeof key === "string" && key.length > 0);
  } catch { /* Missing/malformed keys must not grant access. */ }
  const supplied = (req.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i)?.[1] || "";
  const suppliedApiKey = req.headers.get("apikey") || "";
  const authorized = (!!legacyAdmin && supplied === legacyAdmin) ||
    (!!suppliedApiKey && secretKeys.some(key => suppliedApiKey === key));
  if (!authorized) {
    return jsonResponse({ error: "Acceso administrativo requerido" }, 403);
  }

  try {
    const accessToken = Deno.env.get(
      "MERCADO_PAGO_ACCESS_TOKEN",
    );

    if (!accessToken) {
      throw new Error(
        "No se encontró MERCADO_PAGO_ACCESS_TOKEN",
      );
    }

    const supabaseUrl = Deno.env.get(
      "SUPABASE_URL",
    );

    if (!supabaseUrl) {
      throw new Error(
        "No se encontró SUPABASE_URL",
      );
    }

    let body: RequestBody = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Configuration checks are read-only and do not query payment records.
    // Never return secret values or a complete Mercado Pago account profile.
    if (body.mode === "configuration") {
      const environment = Deno.env.get("MERCADO_PAGO_ENVIRONMENT") === "production" ? "production" : "sandbox";
      const expectedCollector = environment === "production"
        ? Deno.env.get("MERCADO_PAGO_COLLECTOR_ID")
        : (Deno.env.get("MERCADO_PAGO_TEST_COLLECTOR_ID") || "3546561536");
      const identities = await identityChecks(accessToken);
      const owner = identities.tokenOwner;
      const verified = owner.verified;
      const collectorMatches = verified && String(owner.id) === expectedCollector;
      const mexicanAccount = verified && owner.siteId === "MLM";
      const accountMatchesEnvironment = verified && (environment === "sandbox" ? owner.testUser === true : owner.testUser === false);
      const webhookSecretConfigured = !!Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
      return jsonResponse({
        diagnosticVersion: "1.2", mode: "configuration", checkedAt: new Date().toISOString(),
        configuration: { environment, expectedCollector: expectedCollector || null,
          explicitTestCollector: !!Deno.env.get("MERCADO_PAGO_TEST_COLLECTOR_ID"),
          accessTokenConfigured: true, webhookSecretConfigured },
        checks: { tokenVerified: verified, collectorMatches, mexicanAccount, accountMatchesEnvironment },
        readyForCheckoutTest: verified && collectorMatches && mexicanAccount && accountMatchesEnvironment && webhookSecretConfigured,
        identityChecks: identities,
        limitation: "Configuration checks do not prove an approved payment, an authentic webhook or production readiness.",
      });
    }

    const externalReference =
      normalizeRequiredString(
        body.externalReference,
        DEFAULT_EXTERNAL_REFERENCE,
        "externalReference",
      );

    const preferenceId =
      normalizeRequiredString(
        body.preferenceId,
        DEFAULT_PREFERENCE_ID,
        "preferenceId",
      );

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

    /*
     * 1. Consultar directamente la preferencia.
     */
    const preferencePath =
      `/checkout/preferences/${
        encodeURIComponent(preferenceId)
      }`;

    /*
     * 2. Buscar preferencias mediante external_reference.
     */
    const preferenceSearchParams =
      new URLSearchParams({
        external_reference: externalReference,
        limit: "50",
        offset: "0",
      });

    /*
     * 3. Buscar pagos mediante external_reference.
     */
    const paymentSearchParams =
      new URLSearchParams({
        external_reference: externalReference,
        sort: "date_created",
        criteria: "desc",
      });

    /*
     * 4. Buscar órdenes comerciales de las dos maneras.
     */
    const merchantOrderExternalParams =
      new URLSearchParams({
        external_reference: externalReference,
        limit: "50",
        offset: "0",
      });

    const merchantOrderPreferenceParams =
      new URLSearchParams({
        preference_id: preferenceId,
        limit: "50",
        offset: "0",
      });

    const [
      preferenceById,
      preferencesByExternalReference,
      paymentsByExternalReference,
      merchantOrdersByExternalReference,
      merchantOrdersByPreferenceId,
    ] = await Promise.all([
      mercadoPagoGet(
        preferencePath,
        accessToken,
      ),

      mercadoPagoGet(
        `/checkout/preferences/search?${preferenceSearchParams.toString()}`,
        accessToken,
      ),

      mercadoPagoGet(
        `/v1/payments/search?${paymentSearchParams.toString()}`,
        accessToken,
      ),

      mercadoPagoGet(
        `/merchant_orders/search?${merchantOrderExternalParams.toString()}`,
        accessToken,
      ),

      mercadoPagoGet(
        `/merchant_orders/search?${merchantOrderPreferenceParams.toString()}`,
        accessToken,
      ),
    ]);

    const paymentSearchResults = getArray(
      paymentsByExternalReference.data,
      "results",
    );

    const ordersByExternal = getArray(
      merchantOrdersByExternalReference.data,
      "elements",
    );

    const ordersByPreference = getArray(
      merchantOrdersByPreferenceId.data,
      "elements",
    );

    const uniqueMerchantOrders =
      uniqueObjectsById([
        ...ordersByExternal,
        ...ordersByPreference,
      ]);

    /*
     * 5. Obtener el detalle completo de cada orden encontrada.
     */
    const merchantOrderDetails =
      await Promise.all(
        uniqueMerchantOrders.map((order) =>
          mercadoPagoGet(
            `/merchant_orders/${
              encodeURIComponent(
                String(order.id),
              )
            }`,
            accessToken,
          )
        ),
      );

    /*
     * 6. Reunir todos los Payment ID encontrados:
     * desde la búsqueda de pagos y desde las órdenes.
     */
    const paymentIdsFromSearch =
      paymentSearchResults.map(
        (payment) => payment.id,
      );

    const paymentIdsFromOrders: unknown[] = [];

    for (const orderResult of merchantOrderDetails) {
      if (
        !orderResult.data ||
        typeof orderResult.data !== "object"
      ) {
        continue;
      }

      const payments = (
        orderResult.data as Record<string, unknown>
      ).payments;

      if (!Array.isArray(payments)) {
        continue;
      }

      for (const payment of payments) {
        if (
          payment &&
          typeof payment === "object"
        ) {
          paymentIdsFromOrders.push(
            (
              payment as Record<string, unknown>
            ).id,
          );
        }
      }
    }

    const paymentIds = uniqueStrings([
      ...paymentIdsFromSearch,
      ...paymentIdsFromOrders,
    ]);

    /*
     * 7. Obtener directamente el detalle de cada pago.
     */
    const paymentDetails = await Promise.all(
      paymentIds.map((paymentId) =>
        mercadoPagoGet(
          `/v1/payments/${
            encodeURIComponent(paymentId)
          }`,
          accessToken,
        )
      ),
    );

    /*
     * 8. Revisar las filas internas en Supabase.
     */
    const paymentColumns = `
      id,
      provider_payment_id,
      preference_id,
      external_reference,
      plan,
      amount_expected,
      amount_received,
      currency,
      status,
      status_detail,
      payer_email,
      created_at,
      updated_at,
      paid_at
    `;

    const [
      databaseByExternalReference,
      databaseByPreferenceId,
    ] = await Promise.all([
      supabaseAdmin
        .from("mercadopago_payments")
        .select(paymentColumns)
        .eq(
          "external_reference",
          externalReference,
        ),

      supabaseAdmin
        .from("mercadopago_payments")
        .select(paymentColumns)
        .eq(
          "preference_id",
          preferenceId,
        ),
    ]);

    const databaseRecords =
      uniqueObjectsById([
        ...(databaseByExternalReference.data || []),
        ...(databaseByPreferenceId.data || []),
      ]);

    /*
     * 9. Buscar eventos Webhook relacionados
     * con los pagos encontrados.
     */
    let relatedWebhookEvents:
      Record<string, any>[] = [];

    let relatedWebhookError:
      string | null = null;

    if (paymentIds.length > 0) {
      const webhookResult = await supabaseAdmin
        .from("mercadopago_webhook_events")
        .select(`
          id,
          provider_payment_id,
          event_type,
          action,
          request_id,
          signature_valid,
          processing_status,
          processing_error,
          received_at,
          processed_at
        `)
        .in(
          "provider_payment_id",
          paymentIds,
        )
        .order(
          "received_at",
          {
            ascending: false,
          },
        )
        .limit(50);

      relatedWebhookEvents =
        webhookResult.data || [];

      relatedWebhookError =
        webhookResult.error?.message || null;
    }

    const recentWebhookResult =
      await supabaseAdmin
        .from("mercadopago_webhook_events")
        .select(`
          id,
          provider_payment_id,
          event_type,
          action,
          signature_valid,
          processing_status,
          processing_error,
          received_at,
          processed_at
        `)
        .order(
          "received_at",
          {
            ascending: false,
          },
        )
        .limit(20);

    /*
     * 10. Crear una conclusión automática.
     */
    const merchantOrderCount =
      uniqueMerchantOrders.length;

    const paymentCount = paymentIds.length;

    const paymentStatuses =
      paymentDetails.map((result) => {
        const payment =
          result.data &&
          typeof result.data === "object"
            ? result.data as Record<
                string,
                unknown
              >
            : {};

        return {
          id: payment.id || null,
          status: payment.status || null,
          status_detail:
            payment.status_detail || null,
          transaction_amount:
            payment.transaction_amount || null,
          currency_id:
            payment.currency_id || null,
          external_reference:
            payment.external_reference || null,
        };
      });

    let conclusion: string;

    if (
      paymentCount === 0 &&
      merchantOrderCount === 0
    ) {
      conclusion =
        "No se encontró ningún pago ni orden comercial. Mercado Pago parece haber detenido el flujo antes de crear una operación.";
    } else if (
      paymentCount === 0 &&
      merchantOrderCount > 0
    ) {
      conclusion =
        "Existe al menos una orden comercial, pero no contiene un pago identificable. Debe revisarse el estado y los errores de la orden.";
    } else {
      conclusion =
        "Se encontró al menos un pago. Revisa paymentStatuses y paymentDetails para conocer el status_detail exacto.";
    }

    return jsonResponse({
      diagnosticVersion: "1.2",
      identityChecks: await identityChecks(accessToken),
      checkedAt: new Date().toISOString(),

      input: {
        externalReference,
        preferenceId,
      },

      summary: {
        preferenceFound:
          preferenceById.ok,
        merchantOrderCount,
        paymentCount,
        databaseRecordCount:
          databaseRecords.length,
        relatedWebhookCount:
          relatedWebhookEvents.length,
        paymentStatuses,
        conclusion,
      },

      database: {
        records: redactSensitive(
          databaseRecords,
        ),
        byExternalReferenceError:
          databaseByExternalReference.error
            ?.message || null,
        byPreferenceIdError:
          databaseByPreferenceId.error
            ?.message || null,
      },

      webhook: {
        relatedEvents: redactSensitive(
          relatedWebhookEvents,
        ),
        relatedEventsError:
          relatedWebhookError,
        recentEvents: redactSensitive(
          recentWebhookResult.data || [],
        ),
        recentEventsError:
          recentWebhookResult.error
            ?.message || null,
      },

      mercadoPago: {
        preferenceById,
        preferencesByExternalReference,
        paymentsByExternalReference,
        merchantOrdersByExternalReference,
        merchantOrdersByPreferenceId,
        merchantOrderDetails,
        paymentDetails,
      },
    });
  } catch (error) {
    console.error(
      "Error en diagnose-mercadopago:",
      error,
    );

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
