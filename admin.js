const apiBase = "https://xzjjlykhumkrfmbvuvnt.supabase.co";
const apiKey = "sb_publishable_4k8WynAr9a21246UIrTv3A_DB8zjpvJ"; // Chave pública (NÃO é service_role).
const $ = id => document.getElementById(id);
const state = { token:null, file:null, data:null, summary:null, busy:false };
const labels={disponivel:"Disponíveis (verde)",bloqueado:"Indisponíveis (vermelho)",em_processo:"Em processo (azul)",desconhecido:"A confirmar (cinza)"};
function busy(value){state.busy=value;["login-btn","validate-btn","publish-btn"].forEach(id=>{const btn=$(id);if(btn)btn.disabled=value || (id==="validate-btn"&&!state.data) || (id==="publish-btn"&&(!state.summary||!$("confirm").checked));});}
function say(message,error=false){const el=$("notice");el.textContent=message;el.classList.remove("hidden");el.classList.toggle("error",error);}
function clearNotice(){$("notice").textContent="";$("notice").classList.add("hidden");}
function errorMessage(err){return err instanceof Error?err.message:"Ocorreu um erro. Tente novamente.";}
function resetFile(){state.file=null;state.data=null;state.summary=null;$("selected").textContent="";$("review-panel").classList.add("hidden");$("confirm").checked=false;$("validate-btn").disabled=true;$("publish-btn").disabled=true;}
async function authorizedFetch(method="GET",data){
  const response=await fetch(apiBase+"/functions/v1/map-import-admin",{
    method,headers:{ "Content-Type":"application/json",apikey:apiKey,"Authorization":"Bearer "+state.token },
    ...(method==="POST"?{body:JSON.stringify(data)}:{}),
  });
  let content={};
  try{content=await response.json();}catch{}
  if(!response.ok || !content.ok){if(response.status===401 || response.status===403){if(state.token){state.token=null;$("import-panel").classList.add("hidden");$("login-panel").classList.remove("hidden");}}
    throw new Error(content.error||"Operação rejeitada pelo Supabase.");}
  return content;
}
function formatDate(value){if(!value)return "Ainda não existe uma importação publicada.";const date=new Date(value);return isNaN(date.getTime())?"Data não informada":date.toLocaleString("pt-BR");}
$("login-form").addEventListener("submit",async event=>{
  event.preventDefault();clearNotice();busy(true);
  try{
    const response=await fetch(apiBase+"/auth/v1/token?grant_type=password",{
      method:"POST",headers:{"Content-Type":"application/json",apikey:apiKey},
      body:JSON.stringify({email:$("email").value.trim(),password:$("password").value}),
    });
    const auth=await response.json();
    if(!response.ok||!auth.access_token)throw new Error("E-mail ou senha não reconhecidos no Supabase.");
    state.token=auth.access_token;
    const data=await authorizedFetch();
    $("password").value="";
    $("login-panel").classList.add("hidden");$("import-panel").classList.remove("hidden");
    $("latest-count").textContent=data.total?data.total+" lotes cadastrados":"Nenhum mapa publicado";
    $("latest-date").textContent=formatDate(data.lastUpdated);
    say("Acesso autorizado. Selecione seu arquivo .json ou .txt do CV CRM.");
  }catch(error){state.token=null;$("password").value="";say(errorMessage(error),true);}
  finally{busy(false);}
});
$("logout-btn").addEventListener("click",()=>{
  state.token=null;resetFile();$("upload").value="";
  $("import-panel").classList.add("hidden");$("login-panel").classList.remove("hidden");
  clearNotice();
});
$("upload").addEventListener("change",async event=>{
  clearNotice();resetFile();const file=event.currentTarget.files?.[0];if(!file)return;
  if(!/\.(json|txt)$/i.test(file.name)){say("Selecione um arquivo .json ou .txt.",true);return;}
  if(file.size>1_500_000){say("O arquivo excede o limite de 1,5 MB.",true);return;}
  try{
    const data=JSON.parse(await file.text());
    if(!data || typeof data!=="object" || !data.etapas)throw new Error("O arquivo não contém o mapa de disponibilidade esperado.");
    state.file=file;state.data=data;$("selected").textContent=file.name;$("validate-btn").disabled=false;
    say("Arquivo selecionado. Clique em Validar arquivo para conferir a importação.");
  }catch(err){say(errorMessage(err),true);}
});
$("validate-btn").addEventListener("click",async()=>{
  if(!state.token||!state.data||state.busy)return;clearNotice();busy(true);
  try{
    const result=await authorizedFetch("POST",{action:"preview",data:state.data});
    state.summary=result.summary;$("summary-stats").replaceChildren();
    for(const [value,label] of [[state.summary.count,"Lotes no arquivo"],[state.summary.mapped,"Com posição"],[state.summary.unmapped,"Sem posição"]]){
      const div=document.createElement("div");div.className="stat";
      const strong=document.createElement("strong");strong.textContent=String(value);
      const desc=document.createElement("span");desc.textContent=label;
      div.append(strong,desc);$("summary-stats").append(div);
    }
    $("summary-types").replaceChildren();
    for(const [key,count] of Object.entries(state.summary.counts||{})){
      const row=document.createElement("div");
      const type=document.createElement("span");type.textContent=labels[key]||key;
      const num=document.createElement("b");num.textContent=String(count);
      row.append(type,num);$("summary-types").append(row);
    }
    $("review-panel").classList.remove("hidden");
    say("Validação concluída. Confira os valores e confirme antes de publicar.");
  }catch(err){state.summary=null;$("review-panel").classList.add("hidden");say(errorMessage(err),true);}
  finally{busy(false);}
});
$("confirm").addEventListener("change",()=>{busy(state.busy);});
$("publish-btn").addEventListener("click",async()=>{
  if(!state.token||!state.data||!state.summary||!$("confirm").checked||state.busy)return;
  clearNotice();busy(true);
  try{
    const result=await authorizedFetch("POST",{action:"publish",data:state.data,confirmAuthorized:true});
    if(!result.published)throw new Error("A publicação não foi confirmada pelo servidor.");
    $("latest-count").textContent=(result.summary?.count||state.summary.count)+" lotes cadastrados";
    $("latest-date").textContent=formatDate(new Date().toISOString());
    resetFile();$("upload").value="";
    say("Mapa publicado no Supabase! O site passa a consultar a nova versão dos lotes. Confirme as posições sobre a planta antes de divulgar o mapa como exato.");
  }catch(err){say(errorMessage(err),true);}finally{busy(false);}
});