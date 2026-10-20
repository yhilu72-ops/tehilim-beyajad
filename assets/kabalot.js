/* v64: kabalot unibles realmente guardadas y mejor dise\u{F1}o */
(function(){
  function roomV64(){
    if(typeof roomV59==="function"){try{const r=roomV59(); if(r&&r.id)return r;}catch(e){}}
    if(typeof getActiveRoomV54==="function"){try{const r=getActiveRoomV54(); if(r&&r.id)return r;}catch(e){}}
    if(window.selectedRealRoom&&selectedRealRoom.id)return window.selectedRealRoom;
    try{const raw=localStorage.getItem("activeRoomV54"); if(raw){const r=JSON.parse(raw); if(r&&r.id)return r;}}catch(e){}
    return null;
  }
  function safeV64(x){
    return (typeof safeText==="function")?safeText(x||""):(x||"").toString().replace(/[<>&]/g,function(c){return {"<":"&lt;",">":"&gt;","&":"&amp;"}[c];});
  }
  function statusV64(type,msg){
    const el=document.getElementById("kabalaStatusV58");
    if(el){el.className="v58Status "+(type||"");el.textContent=msg||"";}
  }
  function selectedTypeV64(){
    const checked=document.querySelector('input[name="kabalaTypeV59"]:checked, input[name="kabalaTypeV64"]:checked');
    return checked ? checked.value : "personal";
  }
  function selectedJoinableV64(){
    return selectedTypeV64()==="joinable";
  }
  function ensureKabalaTypeDesignV64(){
    const oldWrap=document.querySelector("#kabalot_v58 .v59JoinType");
    if(oldWrap){
      oldWrap.classList.add("v64KabalaTypeWrap");
      Array.from(oldWrap.querySelectorAll("label")).forEach(function(lab){
        lab.classList.add("v64KabalaChoice");
      });
    }
    const titleCandidates=Array.from(document.querySelectorAll("#kabalot_v58 h3"));
    titleCandidates.forEach(function(h){
      if((h.textContent||"").toLowerCase().includes("kabalot publicadas")){
        h.id="kabalotListTitleV64";
      }
    });
  }

  let publishing=false,loadRevision=0;
  window.publishKabalaV58 = async function(){
    if(publishing)return;
    const r=roomV64();
    if(!r||!r.id){statusV64("bad","Primero entra a una sala.");return;}
    const nameEl=document.getElementById("kabalaNameV58"),textEl=document.getElementById("kabalaTextV58"),anonEl=document.getElementById("kabalaAnonV58");
    const name=(nameEl?.value||"").trim(),body=(textEl?.value||"").trim(),anon=!!anonEl?.checked;
    if(!body){statusV64("bad","Escribe una kabalá.");return;}
    publishing=true;statusV64("info","Publicando kabalá...");
    try{
      if(!window.sb)throw Error("No hay conexión con el servicio.");
      const auth=await sb.auth.getUser();if(auth.error)throw auth.error;
      const user=auth.data?.user;if(!user)throw Error("Primero inicia sesión.");
      const item={room_id:r.id,user_id:user.id,display_name:anon?"Anónimo":(name||"Participante"),is_anonymous:anon,text:body,message:body,joinable:selectedJoinableV64()};
      const res=await sb.from("kabalot").insert(item).select("id").single();
      if(res.error)throw res.error;if(!res.data?.id)throw Error("El servidor no confirmó la publicación.");
      if(roomV64()?.id===r.id){if(textEl)textEl.value="";statusV64("good","Kabalá publicada.");await window.loadKabalotV58();}
    }catch(err){statusV64("bad","No se pudo publicar: "+(err.message||err));}
    finally{publishing=false;}
  };

  window.loadKabalotV58 = async function(){
    const revision=++loadRevision;
    ensureKabalaTypeDesignV64();
    const r=roomV64();
    const info=document.getElementById("kabalotRoomInfoV58");
    const list=document.getElementById("kabalotListV58");
    if(info){
      const title=r?(r.title||r.person_name||"Sala"):"Sala";
      info.innerHTML="<b>"+safeV64(title)+"</b>";
    }
    if(!list)return;
    if(!r||!r.id){list.innerHTML='<div class="v58Status bad" style="display:block">Primero entra a una sala.</div>';return;}
    list.innerHTML='<div class="v58Status info" style="display:block">Cargando kabalot...</div>';

    window.kabalotItemsV58=[];
    let items=[],user=null;
    try{
      if(!window.sb)throw Error("No hay conexión con el servicio.");
      const auth=await sb.auth.getUser();if(auth.error)throw auth.error;user=auth.data?.user;
      if(!user)throw Error("Primero inicia sesión.");
      const res=await sb.from("kabalot").select("*").eq("room_id",r.id).order("created_at",{ascending:false}).limit(100);
      if(res.error)throw res.error;items=res.data||[];
    }catch(err){if(revision===loadRevision&&roomV64()?.id===r.id)list.textContent="No se pudieron cargar las kabalot: "+(err.message||err);return;}
    if(revision!==loadRevision||roomV64()?.id!==r.id)return;

    if(!items.length){
      list.innerHTML='<div class="v58Panel"><p style="text-align:center">No hay kabalot publicadas todav\u{ED}a.</p></div>';
      return;
    }

    /* contador de uniones */
    if(window.sb){
      for(const it of items){
        if(it.joinable&&it.id){
          try{
            const cnt=await sb.from("kabala_joins").select("id",{count:"exact",head:true}).eq("kabala_id",it.id);
            if(cnt.error)throw cnt.error;
            it.join_count=cnt.count||0;
          }catch(e){if(revision===loadRevision)list.textContent="No se pudo consultar la participación. Intenta de nuevo.";return;}
        }
      }
    }

    if(revision!==loadRevision||roomV64()?.id!==r.id)return;
    window.kabalotItemsV58=items;
    list.innerHTML=items.map(function(it,i){
      const name=it.is_anonymous?"Anonimo":(it.display_name||it.name||"Anonimo");
      const body=it.text||it.message||it.kabala||"";
      const joinable=it.joinable===true || it.joinable==="true" || it.type==="joinable";
      const count=Number(it.join_count||it.joins_count||0);
      return '<div class="v58ListItem">'+
        (joinable?'<span class="v64JoinBadge">\u{1F91D} '+safeV64(count)+' unidos</span>':'<span class="v64PersonalBadge">Personal</span>')+
        '<br><b>'+safeV64(name)+'</b>'+
        '<p>'+safeV64(body)+'</p>'+
        '<div class="muted">'+new Date(it.created_at||Date.now()).toLocaleDateString()+'</div>'+
        '<div class="v58Actions">'+
          (joinable?'<button class="v64JoinBtn" onclick="joinKabalaV64('+i+')">Me uno</button>':'')+
          (it.user_id===user.id?'<button class="v58MiniDanger" onclick="deleteKabalaV58('+i+')">Eliminar</button>':'')+
        '</div>'+
      '</div>';
    }).join("");
  };

  window.joinKabalaV64 = async function(i){
    const it=window.kabalotItemsV58&&window.kabalotItemsV58[i];
    if(!it)return;
    try{
      if(window.sb&&it.id){
        const u=await sb.auth.getUser();
        const user=u&&u.data&&u.data.user;
        if(!user){alert("Primero inicia sesi\u{F3}n.");return;}
        const res=await sb.from("kabala_joins").upsert({kabala_id:it.id,user_id:user.id},{onConflict:"kabala_id,user_id"});
        if(res.error)throw res.error;
      }else{throw Error("La kabalá no está guardada en el servidor.");}
      await window.loadKabalotV58();
    }catch(err){
      alert("No se pudo unir: "+(err.message||err));
    }
  };

  window.deleteKabalaV58=async function(i){
    const item=window.kabalotItemsV58?.[i];if(!item?.id||!confirm("¿Eliminar esta kabalá?"))return;
    try{
      if(!window.sb)throw Error("No hay conexión.");
      const result=await sb.from("kabalot").delete().eq("id",item.id).select("id");
      if(result.error)throw result.error;if(!result.data?.length)throw Error("No puedes eliminar esta kabalá.");
      await window.loadKabalotV58();
    }catch(error){statusV64("bad",error.message||String(error));}
  };

  /* compatibilidad con bot\u{F3}n viejo */
  window.joinKabalaV59=window.joinKabalaV64;

  window.addEventListener("load",function(){setTimeout(ensureKabalaTypeDesignV64,120);setTimeout(ensureKabalaTypeDesignV64,700);});
  window.addEventListener("hashchange",function(){
    if(location.hash==="#kabalot_v58"){
      setTimeout(ensureKabalaTypeDesignV64,120);
      setTimeout(function(){ if(typeof loadKabalotV58==="function")loadKabalotV58(); },180);
    }
  });
})();
