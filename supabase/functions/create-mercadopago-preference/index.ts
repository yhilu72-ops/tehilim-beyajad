import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PlanName =
  | "bronce"
  | "plata"
  | "oro"
  | "diamante";

type RequestBody = {
  plan?: string;
  requestId?: string;
  roomId?: string | null;
  donorName?: string;
  message?: string;
  anonymous?: boolean;
};

const PLANS: Record<
  PlanName,
  {
    amount: number;
    title: string;
    itemId: string;
  }
> = {
  bronce: {
    amount: 180,
    title: "Aportación Bronce - Tehilim BeYajad",
    itemId: "tehilim-bronce",
  },
  plata: {
    amount: 360,
    title: "Aportación Plata - Tehilim BeYajad",
    itemId: "tehilim-plata",
  },
  oro: {
    amount: 720,
    title: "Aportación Oro - Tehilim BeYajad",
    itemId: "tehilim-oro",
  },
  diamante: {
    amount: 1800,
    title: "Aportación Diamante - Tehilim BeYajad",
    itemId: "tehilim-diamante",
  },
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

function getRequiredEnvironmentVariable(
  name: string,
): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}`,
    );
  }

  return value;
}

function getSupabaseAdminKey(): string {
  const secretKeysJson = Deno.env.get(
    "SUPABASE_SECRET_KEYS",
  );

  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(
        secretKeysJson,
      ) as Record<string, unknown>;

      if (
        typeof secretKeys.default === "string" &&
        secretKeys.default.length > 0
      ) {
        return secretKeys.default;
      }
    } catch {
      console.error(
        "No se pudo leer SUPABASE_SECRET_KEYS",
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
    "No se encontró una llave administrativa de Supabase",
  );
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

  try {
    const mercadoPagoAccessToken =
      getRequiredEnvironmentVariable(
        "MERCADO_PAGO_ACCESS_TOKEN",
      );

    const supabaseUrl =
      getRequiredEnvironmentVariable(
        "SUPABASE_URL",
      );

    const supabaseAdminKey =
      getSupabaseAdminKey();

    let body: RequestBody;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          error:
            "El contenido enviado no es un JSON válido",
        },
        400,
      );
    }

    const requestedPlan = String(
      body?.plan ?? "",
    ).toLowerCase();

    if (
      !Object.prototype.hasOwnProperty.call(
        PLANS,
        requestedPlan,
      )
    ) {
      return jsonResponse(
        {
          error: "Plan no válido",
          allowedPlans: [
            "bronce",
            "plata",
            "oro",
            "diamante",
          ],
        },
        400,
      );
    }

    const plan = requestedPlan as PlanName;
    const selectedPlan = PLANS[plan];

    const roomId =
      body?.roomId !== undefined &&
        body?.roomId !== null
        ? String(body.roomId)
        : null;

    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return jsonResponse({error:"Inicia sesión para hacer una aportación."},401);
    const user = authData.user;
    // The same logical attempt survives double taps, reconnects and app restarts.
    const requestId = body.requestId || null;
    if(requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))
      return jsonResponse({error:"Identificador de aportación no válido."},400);
    const donorName = body.anonymous ? "" : String(body.donorName || "").trim().slice(0,100);
    const message = String(body.message || "").trim().slice(0,500);
    if (roomId) {
      const {data:room,error} = await supabaseAdmin.from("rooms").select("id,creator_id,deleted,active").eq("id",roomId).maybeSingle();
      const {data:member} = await supabaseAdmin.from("room_members").select("user_id").eq("room_id",roomId).eq("user_id",user.id).maybeSingle();
      if(error || !room || room.deleted || !room.active || (room.creator_id !== user.id && !member)) return jsonResponse({error:"Únete a la sala antes de hacer una aportación."},403);
    }
    const environment = Deno.env.get("MERCADO_PAGO_ENVIRONMENT") === "production" ? "production" : "sandbox";
    const expectedCollector = environment === "production" ? Deno.env.get("MERCADO_PAGO_COLLECTOR_ID") : (Deno.env.get("MERCADO_PAGO_TEST_COLLECTOR_ID") || "3546561536");
    if(!expectedCollector) return jsonResponse({error:"Los cobros reales aún no están configurados."},503);
    const ownerResponse = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${mercadoPagoAccessToken}` }, signal: AbortSignal.timeout(10000),
    });
    if (!ownerResponse.ok) return jsonResponse({error:"No se pudo verificar la cuenta de cobro."},502);
    const owner = await ownerResponse.json();
    const isTest = Array.isArray(owner.tags) && owner.tags.includes("test_user");
    if(String(owner.id)!==expectedCollector || owner.site_id!=="MLM" || (environment==="sandbox" ? !isTest : isTest)) {
      return jsonResponse({error:"La cuenta de Mercado Pago no coincide con el entorno configurado.",code:"SELLER_CONFIGURATION_MISMATCH",checks:{environment,collectorMatches:String(owner.id)===expectedCollector,mexicanAccount:owner.site_id==="MLM",testAccount:isTest}},409);
    }

    const fingerprint = JSON.stringify({plan,roomId,donorName,message,anonymous:!!body.anonymous,environment,collector:String(owner.id)});
    async function existingAttempt(): Promise<Response | null> {
      if(!requestId)return null; // Compatibility with installed earlier versions.
      const {data:previous,error} = await supabaseAdmin.from("mercadopago_payments")
        .select("external_reference,request_fingerprint,checkout_url,preference_id,provider_payment_id,status,status_detail,amount_expected,currency,metadata")
        .eq("user_id",user.id).eq("request_key",requestId).maybeSingle();
      if(error)throw error;
      if(!previous)return null;
      if(previous.request_fingerprint!==fingerprint)return jsonResponse({error:"Este intento ya corresponde a otra aportación.",code:"REQUEST_CONFLICT"},409);
      if(previous.status!=="pending" || previous.provider_payment_id)
        return jsonResponse({error:"Consulta el estado de esta aportación antes de iniciar otra.",code:"PAYMENT_ALREADY_PROCESSED",externalReference:previous.external_reference},409);
      if(previous.preference_id && previous.checkout_url) {
        const destination=new URL(previous.checkout_url);
        if(destination.protocol!=="https:" || destination.hostname!=="www.mercadopago.com.mx")throw Error("Destino de pago inválido.");
        return jsonResponse({preferenceId:previous.preference_id,externalReference:previous.external_reference,checkoutUrl:previous.checkout_url,environment,amount:Number(previous.amount_expected),currency:previous.currency,plan,reused:true});
      }
      return jsonResponse({error:"Este intento sigue en verificación. No se creará un segundo cobro. Consulta su estado antes de volver a intentarlo.",code:"CHECKOUT_IN_PROGRESS",externalReference:previous.external_reference},409);
    }
    const previous=await existingAttempt();if(previous)return previous;
    const {count,error:countError} = await supabaseAdmin.from("mercadopago_payments").select("id",{count:"exact",head:true}).eq("user_id",user.id).gte("created_at",new Date(Date.now()-60000).toISOString());
    if(countError) throw countError;
    if((count||0)>=3) return jsonResponse({error:"Espera un minuto antes de intentar de nuevo."},429);
    const contributionId =
      crypto.randomUUID();

    const externalReference =
      contributionId;

    const {
      error: insertError,
    } = await supabaseAdmin
      .from("mercadopago_payments")
      .insert({
        id: contributionId,
        request_key: requestId,
        request_fingerprint: requestId ? fingerprint : null,
        provider_payment_id: null,
        preference_id: null,
        external_reference:
          externalReference,
        plan,
        user_id: user.id,
        room_id: roomId,
        metadata: {environment, donor_name:donorName, message, anonymous:!!body.anonymous, collector_id:String(owner.id)},
        amount_expected:
          selectedPlan.amount,
        amount_received: null,
        currency: "MXN",
        status: "pending",
        status_detail:
          "creating_preference",
        payer_email: null,
        raw_payment: null,
        paid_at: null,
      });

    if (insertError) {
      if(insertError.code==="23505" && requestId){const winner=await existingAttempt();if(winner)return winner;}
      throw new Error(
        `No se pudo registrar la aportación: ${insertError.message}`,
      );
    }

    const appUrl =
      "https://tehilim-beyajad.vercel.app";

    const notificationUrl =
      `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    const metadata: Record<
      string,
      string
    > = {
      project: "tehilim-beyajad",
      provider: "mercadopago",
      plan,
      environment,
    };

    if (roomId) {
      metadata.room_id = roomId;
    }

    const preferencePayload = {
      items: [
        {
          id: selectedPlan.itemId,
          title: selectedPlan.title,
          description:
            "Aportación para Tehilim BeYajad y Kolel Siaj Israel",
          quantity: 1,
          currency_id: "MXN",
          unit_price:
            selectedPlan.amount,
        },
      ],

      external_reference:
        externalReference,

      back_urls: {
        success:
          `${appUrl}/?mp_status=success&reference=${encodeURIComponent(
            externalReference,
          )}`,
        pending:
          `${appUrl}/?mp_status=pending&reference=${encodeURIComponent(
            externalReference,
          )}`,
        failure:
          `${appUrl}/?mp_status=failure&reference=${encodeURIComponent(
            externalReference,
          )}`,
      },

      auto_return: "approved",
      // A real app email is not a Mercado Pago test-buyer identity. Let the
      // hosted test checkout use the separately authenticated test buyer.
      ...(environment === "production" ? { payer: { email: user.email } } : {}),

      notification_url:
        notificationUrl,

      statement_descriptor:
        "TEHILIM BEYAJAD",

      metadata,
    };

    const mercadoPagoResponse =
      await fetch(
        "https://api.mercadopago.com/checkout/preferences",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${mercadoPagoAccessToken}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            preferencePayload,
          ),
          signal: AbortSignal.timeout(15000),
        },
      );

    const mercadoPagoText =
      await mercadoPagoResponse.text();

    let mercadoPagoData:
      Record<string, unknown>;

    try {
      mercadoPagoData =
        mercadoPagoText
          ? JSON.parse(
            mercadoPagoText,
          )
          : {};
    } catch {
      mercadoPagoData = {
        rawResponse:
          mercadoPagoText,
      };
    }

    if (!mercadoPagoResponse.ok) {
      await supabaseAdmin
        .from(
          "mercadopago_payments",
        )
        .update({
          status_detail:
            "preference_creation_failed",
          raw_payment:
            mercadoPagoData,
        })
        .eq(
          "external_reference",
          externalReference,
        );

      return jsonResponse(
        {
          error:
            "Mercado Pago rechazó la creación de la preferencia",
          mercadoPagoStatus:
            mercadoPagoResponse.status,

        },
        502,
      );
    }

    const preferenceId =
      typeof mercadoPagoData.id ===
          "string"
        ? mercadoPagoData.id
        : null;

    // Checkout Pro uses init_point for both real and test-user flows.
    const checkoutUrl = typeof mercadoPagoData.init_point === "string"
      ? mercadoPagoData.init_point : null;
    if (!preferenceId || !checkoutUrl) {
      await supabaseAdmin.from("mercadopago_payments").update({
        status_detail: "invalid_preference_response", raw_payment: mercadoPagoData,
      }).eq("external_reference", externalReference);
      return jsonResponse({error:"Mercado Pago no devolvió una preferencia válida"},502);
    }
    const parsedCheckout = new URL(checkoutUrl);
    if (parsedCheckout.protocol !== "https:" || parsedCheckout.hostname !== "www.mercadopago.com.mx") {
      return jsonResponse({error:"Mercado Pago devolvió un destino de Checkout inesperado"},502);
    }

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("mercadopago_payments")
      .update({
        preference_id:
          preferenceId,
        checkout_url: checkoutUrl,
        status: "pending",
        status_detail:
          "preference_created",
        raw_payment:
          mercadoPagoData,
      })
      .eq(
        "external_reference",
        externalReference,
      );

    if (updateError) {
      throw new Error(
        `La preferencia se creó, pero no pudo guardarse: ${updateError.message}`,
      );
    }

    return jsonResponse({
      preferenceId,
      externalReference,
      checkoutUrl,
      environment,
      amount:
        selectedPlan.amount,
      currency: "MXN",
      plan,
    });
  } catch (error) {
    console.error(
      "create-mercadopago-preference:",
      error,
    );

    return jsonResponse(
      {
        error:
          "No se pudo completar la solicitud. Consulta el estado de tu aportación antes de reintentar.",
      },
      500,
    );
  }
});
