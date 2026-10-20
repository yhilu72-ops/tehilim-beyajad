import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
Deno.serve(async req=>{
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
 if(req.method==="OPTIONS")return reply({});
 if(req.method!=="POST")return reply({error:"Método no permitido"},405);
 try{
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer /i,"");
  const {data,error}=await db.auth.getUser(jwt);
  if(error||!data.user)return reply({error:"Inicia sesión nuevamente."},401);
  const body=await req.json();
  if(body.confirm!=="ELIMINAR")return reply({error:"Confirma la eliminación."},400);
  // Revoke refresh sessions first; cleanup uses a transaction and only this verified user.
  const {error:signoutError}=await db.auth.admin.signOut(jwt,"global");
  if(signoutError)throw signoutError;
  const {error:cleanupError}=await db.rpc("tbj_cleanup_account",{p_user:data.user.id});
  if(cleanupError)throw cleanupError;
  const {error:deleteError}=await db.auth.admin.deleteUser(data.user.id);
  if(deleteError)throw deleteError;
  return reply({deleted:true});
 }catch(e){console.error("Account deletion failed",e);return reply({error:"No se pudo completar la eliminación. Vuelve a iniciar sesión y reintenta o contacta a soporte."},500);}
});
