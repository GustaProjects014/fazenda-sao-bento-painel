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
$("enable-push").onclick=async()=>{
  let step="verificação inicial";
  try{
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)) throw Error("Instale o painel pela opção Adicionar à Tela de Início no Safari e abra pelo ícone.");
    await ensureToken();
    step="consulta ao servidor";notice("Verificando configuração do Supabase...");
    const r=await fetch(BASE+"/functions/v1/notify-fazenda-lead",{headers:{apikey:KEY},cache:"no-store"});
    if(!r.ok)throw Error("Servidor de notificações retornou HTTP "+r.status+".");
    const cfg=await r.json();
    if(!cfg.configured||!cfg.publicKey)throw Error("As chaves VAPID precisam ser configuradas no Supabase.");
    step="validação da chave VAPID";
    const pub=String(cfg.publicKey).trim();
    if(!/^[A-Za-z0-9_-]{86,88}$/.test(pub))throw Error("A chave FAZENDA_VAPID_PUBLIC_KEY parece inválida. Use a chave pública VAPID original, não o SHA256/Digest mostrado no painel Secrets.");
    let key;
    try{
      const raw=atob(pub.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-pub.length%4)%4));
      key=Uint8Array.from(raw,c=>c.charCodeAt(0));
    }catch{throw Error("A chave pública VAPID não está em formato Base64URL válido.")}
    if(key.length!==65||key[0]!==4)throw Error("A chave pública VAPID não corresponde a uma chave EC P-256 de 65 bytes. Gere um par VAPID válido e configure ambas as chaves no Supabase.");
    step="registro do serviço no iPhone";notice("Preparando notificações no iPhone...");
    await navigator.serviceWorker.register("./sw.js",{scope:"./"});
    const sw=await navigator.serviceWorker.ready;
    step="permissão do iPhone";
    const permission=await Notification.requestPermission();
    if(permission!=="granted")throw Error("Permissão não concedida. Verifique as notificações do aplicativo nos Ajustes do iPhone.");
    step="inscrição Web Push";notice("Registrando este iPhone...");
    const existing=await sw.pushManager.getSubscription();
    let subscription=existing;
    if(existing){
      const storedKey=existing.options.applicationServerKey;
      const actual=storedKey?new Uint8Array(storedKey):null;
      if(!actual||actual.length!==key.length||actual.some((b,i)=>b!==key[i])){await existing.unsubscribe();subscription=null;}
    }
    if(!subscription)subscription=await sw.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    step="validação do login";
    const usr=await fetch(BASE+"/auth/v1/user",{headers:authHeaders()});
    if(!usr.ok)throw Error("Sessão expirada. Saia e entre novamente.");
    const user=await usr.json();
    step="salvamento no Supabase";notice("Salvando autorização no Supabase...");
    const j=subscription.toJSON();
    await api("lead_push_subscriptions?on_conflict=endpoint",{method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:user.id,endpoint:j.endpoint,p256dh:j.keys?.p256dh,auth_key:j.keys?.auth})});
    notice("Notificações ativadas neste iPhone. Faça um cadastro de teste para confirmar o recebimento.");
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    notice("Falha em "+step+": "+(message==="Load failed"||message==="Failed to fetch"?"conexão indisponível. Verifique a internet e tente novamente.":message==="The string did not match the expected pattern."||message==="A string não correspondeu ao padrão esperado."?"o Safari rejeitou um parâmetro Web Push. Verifique a chave VAPID e a instalação na Tela de Início.":message));
  }
};
(async()=>{try{const s=JSON.parse(sessionStorage.getItem("fsb_clients_auth")||"null");if(s)await enter(s)}catch(e){exit();notice("Faça login para acessar os cadastros.")}})();
