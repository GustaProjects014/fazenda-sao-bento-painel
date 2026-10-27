const BASE="https://xzjjlykhumkrfmbvuvnt.supabase.co",KEY="sb_publishable_4k8WynAr9a21246UIrTv3A_DB8zjpvJ";
const $=id=>document.getElementById(id);
let session=null,leads=[],refreshTimer=null;
function notice(v){$("message").textContent=v||""}
function authHeaders(extra={}){return{apikey:KEY,Authorization:"Bearer "+session.access_token,...extra}}
async function api(path,opt={}){const r=await fetch(BASE+"/rest/v1/"+path,{...opt,headers:authHeaders(opt.headers)});if(!r.ok)throw Error("Falha na consulta ao Supabase ("+r.status+").");return r.status===204?null:r.json()}
async function token(grant,data){const r=await fetch(BASE+"/auth/v1/token?grant_type="+grant,{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify(data)});if(!r.ok)throw Error("Não foi possível autenticar.");const s=await r.json();return{access_token:s.access_token,refresh_token:s.refresh_token,expires_at:Date.now()+Number(s.expires_in||3600)*1000}}
async function validAdmin(){const x=await api("lead_panel_admins?select=user_id&limit=1");if(!x.length)throw Error("Conta sem autorização para consultar os cadastros.")}
async function enter(s){session=s;await validAdmin();sessionStorage.setItem("fsb_clients_auth",JSON.stringify(session));$("login").hidden=true;$("dashboard").hidden=false;$("logout").hidden=false;await load();clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(!document.hidden)load().catch(()=>{});},30000)}
function exit(){session=null;leads=[];sessionStorage.removeItem("fsb_clients_auth");clearInterval(refreshTimer);$("login").hidden=false;$("dashboard").hidden=true;$("logout").hidden=true}
async function ensureToken(){if(!session)throw Error("Faça login.");if(session.expires_at<Date.now()+90000){session=await token("refresh_token",{refresh_token:session.refresh_token});sessionStorage.setItem("fsb_clients_auth",JSON.stringify(session));}}
async function load(){await ensureToken();leads=await api("leads?select=id,full_name,whatsapp,email,interest_type,status,created_at&development_slug=eq.fazenda-sao-bento&order=created_at.desc&limit=500");render();notice("")}
function render(){const search=$("search").value.toLowerCase().trim(),target=$("lead-list");target.replaceChildren();$("total").textContent=leads.length;$("new").textContent=leads.filter(x=>x.status==="novo").length;const filtered=leads.filter(x=>[x.full_name,x.whatsapp,x.email].some(v=>(v||"").toLowerCase().includes(search)));if(!filtered.length){const p=document.createElement("p");p.textContent="Nenhum cadastro encontrado.";target.append(p)}for(const l of filtered){const el=document.createElement("article");el.className="lead";const h=document.createElement("h3");h.textContent=l.full_name;el.append(h);for(const t of [l.whatsapp,l.email||"",new Date(l.created_at).toLocaleString("pt-BR"),({"residencial":"Lote residencial","comercial":"Lote comercial","avaliando":"Conhecer opções"})[l.interest_type]||l.interest_type]){if(t){const p=document.createElement("p");p.textContent=t;el.append(p)}}const a=document.createElement("a");a.href="https://wa.me/"+l.whatsapp.replace(/\D/g,"");a.target="_blank";a.rel="noopener noreferrer";a.textContent="Conversar no WhatsApp";el.append(a);const label=document.createElement("label");label.textContent="Etapa do atendimento";const sel=document.createElement("select");for(const [value,name] of Object.entries({novo:"Novo",em_atendimento:"Em atendimento",visita_agendada:"Visita agendada",negociacao:"Negociação",convertido:"Convertido",encerrado:"Encerrado"})){const option=document.createElement("option");option.value=value;option.textContent=name;sel.append(option)}sel.value=l.status;sel.addEventListener("change",async()=>{try{await ensureToken();await api("leads?id=eq."+encodeURIComponent(l.id),{method:"PATCH",headers:{"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({status:sel.value})});l.status=sel.value;notice("Atendimento atualizado.");}catch(e){notice(e.message);sel.value=l.status}});label.append(sel);el.append(label);target.append(el)}}
$("login-form").addEventListener("submit",async e=>{e.preventDefault();notice("Entrando...");try{await enter(await token("password",{email:$("email").value,password:$("password").value}));$("password").value=""}catch(err){exit();notice(err.message)}});
$("logout").onclick=exit;$("refresh").onclick=()=>load().catch(e=>notice(e.message));$("search").oninput=render;
$("tab-leads").onclick=()=>{ $("leads-panel").hidden=false;$("push-panel").hidden=true;$("tab-leads").classList.add("active");$("tab-push").classList.remove("active")};
$("tab-push").onclick=()=>{ $("leads-panel").hidden=true;$("push-panel").hidden=false;$("tab-push").classList.add("active");$("tab-leads").classList.remove("active")};
// O Web Push no iOS exige que subscribe() seja chamado diretamente pelo toque.
// Toda a comunicação e registro do service worker são preparados antes do clique.
let pushReady=null,pushPreparation=null;
const pushButton=$("enable-push");
function pushError(error,step){
  const raw=error instanceof Error?error.message:String(error);
  const message=raw==="Load failed"||raw==="Failed to fetch"
    ?"Não foi possível conectar ao servidor. Verifique a internet."
    :raw==="The string did not match the expected pattern."
      ?"O Safari rejeitou um parâmetro da inscrição. Confirme a instalação na Tela de Início e a configuração VAPID."
      :raw;
  notice("Falha na etapa: "+step+". "+message);
}
function vapidBytes(value){
  const pub=String(value||"").trim();
  if(!/^[A-Za-z0-9_-]{86,88}$/.test(pub))
    throw Error("A chave VAPID pública é inválida. Não copie o resumo SHA256 (Digest) exibido em Secrets.");
  let data;
  try{
    const binary=atob(pub.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-pub.length%4)%4));
    data=Uint8Array.from(binary,c=>c.charCodeAt(0));
  }catch{throw Error("A chave VAPID precisa estar no formato Base64URL.");}
  if(data.length!==65||data[0]!==4)
    throw Error("A chave VAPID não é uma chave pública P-256 válida (65 bytes).");
  return data;
}
async function preparePush(){
  if(pushReady)return pushReady;
  if(pushPreparation)return pushPreparation;
  pushPreparation=(async()=>{
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))
      throw Error("No iPhone, abra o painel pelo ícone adicionado à Tela de Início, não por uma aba do Safari.");
    const response=await fetch(BASE+"/functions/v1/notify-fazenda-lead",
      {headers:{apikey:KEY},cache:"no-store"});
    if(!response.ok)throw Error("A função de notificações retornou HTTP "+response.status+".");
    const data=await response.json();
    if(!data.configured||!data.publicKey)
      throw Error("As chaves de envio ainda não estão habilitadas no Supabase.");
    const key=vapidBytes(data.publicKey);
    const registration=await navigator.serviceWorker.register("./sw.js?v=20261027-3",
      {scope:"./",updateViaCache:"none"});
    const ready=await navigator.serviceWorker.ready;
    if(!ready.active)throw Error("O serviço de notificações não ficou ativo.");
    let existing=await registration.pushManager.getSubscription();
    if(existing){
      const prev=existing.options?.applicationServerKey;
      const bytes=prev?new Uint8Array(prev):null;
      if(!bytes||bytes.length!==key.length||bytes.some((b,i)=>b!==key[i])){
        await existing.unsubscribe();
        existing=null;
      }
    }
    pushReady={registration,key,existing};
    return pushReady;
  })();
  try{return await pushPreparation;}catch(error){pushPreparation=null;throw error;}
}
async function showPushPanel(){
  $("leads-panel").hidden=true;$("push-panel").hidden=false;
  $("tab-push").classList.add("active");$("tab-leads").classList.remove("active");
  pushButton.disabled=true;
  pushButton.textContent="Preparando notificações...";
  notice("Conferindo as configurações do iPhone e do Supabase...");
  try{
    await preparePush();
    pushButton.disabled=false;
    pushButton.textContent="Ativar notificações neste iPhone";
    notice(pushReady?.existing ? "Este aparelho já possui uma inscrição Web Push. Clique em Enviar notificação de teste." : "Configuração pronta. Toque no botão para autorizar as notificações.");
  }catch(error){
    pushButton.textContent="Tentar preparar novamente";
    pushButton.disabled=false;
    pushReady=null;
    pushError(error,"preparação");
    // O botão passa a repetir o preparo sem solicitar permissão fora do gesto.
    pushButton.onclick=()=>{pushButton.onclick=enablePush;
$("test-push").onclick=async()=>{
  const button=$("test-push");
  button.disabled=true;
  notice("Enviando aviso de teste para seus dispositivos autorizados...");
  try{
    await ensureToken();
    const response=await fetch(BASE+"/functions/v1/notify-fazenda-lead",{
      method:"POST",
      headers:{apikey:KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
      body:JSON.stringify({action:"test"}),
      cache:"no-store"
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw Error("Servidor respondeu "+response.status+": "+(data?.error||"falha não identificada")+".");
    const accepted=Number(data?.accepted||0),devices=Number(data?.recipients||0);
    if(devices===0)notice("Nenhum iPhone inscrito nesta conta. Ative as notificações primeiro.");
    else if(accepted===0)notice("O servidor tentou enviar "+devices+" aviso(s), mas a Apple não aceitou. Diagnóstico: "+JSON.stringify(data?.failures||[]));
    else notice("A Apple aceitou "+accepted+" aviso(s) de teste. Confira as notificações do iPhone, inclusive na Tela Bloqueada.");
  }catch(error){pushError(error,"teste de envio");}
  finally{button.disabled=false;}
};
void showPushPanel();};
  }
}
function enablePush(){
  const config=pushReady;
  if(!config){notice("Abra a aba Notificações e aguarde a preparação terminar.");return;}
  if(Notification.permission==="denied"){
    notice("As notificações estão bloqueadas. Habilite em Ajustes do iPhone → Notificações → São Bento Leads.");
    return;
  }
  // Nenhum await ou fetch antes de subscribe(): o gesto é preservado no Safari.
  let subscriptionPromise;
  try{
    subscriptionPromise=config.existing
      ?Promise.resolve(config.existing)
      :config.registration.pushManager.subscribe({
        userVisibleOnly:true,applicationServerKey:config.key
      });
  }catch(error){pushError(error,"inscrição do iPhone");return;}
  pushButton.disabled=true;
  notice("Aguardando a autorização do iPhone...");
  (async()=>{
    let step="autorização Web Push";
    try{
      const subscription=await subscriptionPromise;
      if(!subscription?.endpoint)throw Error("O iPhone não forneceu uma inscrição válida.");
      step="verificação da sessão";
      await ensureToken();
      const response=await fetch(BASE+"/auth/v1/user",{headers:authHeaders()});
      if(!response.ok)throw Error("Sua sessão expirou. Entre novamente no painel.");
      const user=await response.json();
      step="salvamento no Supabase";
      notice("Registrando este dispositivo no Supabase...");
      const obj=subscription.toJSON();
      await api("lead_push_subscriptions?on_conflict=endpoint",{
        method:"POST",
        headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
        body:JSON.stringify({
          user_id:user.id,endpoint:obj.endpoint,
          p256dh:obj.keys?.p256dh,auth_key:obj.keys?.auth
        })
      });
      config.existing=subscription;
      notice("Notificações ativadas neste iPhone! Faça um cadastro de teste para verificar o aviso.");
    }catch(error){pushError(error,step);}finally{pushButton.disabled=false;}
  })();
}
$("tab-push").onclick=()=>{void showPushPanel();};
pushButton.onclick=enablePush;
(async()=>{try{const s=JSON.parse(sessionStorage.getItem("fsb_clients_auth")||"null");if(s)await enter(s)}catch(e){exit();notice("Faça login para acessar os cadastros.")}})();
