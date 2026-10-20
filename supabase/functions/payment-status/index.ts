import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
Deno.serve(async req => {
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
 if(req.method==="OPTIONS")return reply({});
 if(req.method!=="POST")return reply({error:"Método no permitido"},405);
 try{
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  const {data,error}=await db.auth.getUser((req.headers.get("Authorization")||"").replace(/^Bearer /i,""));
  if(error||!data.user)return reply({error:"Inicia sesión"},401);
  const {reference}=await req.json();
  if(!/^[0-9a-f-]{36}$/i.test(reference||""))return reply({error:"Referencia inválida"},400);
  const {data:p,error:e}=await db.from("mercadopago_payments").select("status,plan,currency,amount_expected,metadata").eq("external_reference",reference).eq("user_id",data.user.id).maybeSingle();
  if(e)throw e;
  if(!p)return reply({error:"Aportación no encontrada"},404);
  return reply({status:p.status,plan:p.plan,currency:p.currency,amount:p.amount_expected,environment:p.metadata?.environment||"sandbox"});
 }catch{return reply({error:"No se pudo consultar la aportación."},500);}
});
