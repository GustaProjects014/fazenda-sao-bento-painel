"use strict";
const api="https://xzjjlykhumkrfmbvuvnt.supabase.co",apikey="sb_publishable_4k8WynAr9a21246UIrTv3A_DB8zjpvJ";
const $=id=>document.getElementById(id);
const state={session:null,leads:[],lastId:null,refreshing:false,poll:null,noticeTimer:null};
const labels={novo:"Novo",em_atendimento:"Em atendimento",visita_agendada:"Visita agendada",negociacao:"Negociação",convertido:"Convertido",encerrado:"Encerrado"};
const interest={residencial:"Lote residencial",comercial:"Lote comercial",avaliando:"Conhecer opções"};
function notice(msg,error=false){$("notice").textContent=msg;$("notice").classList.toggle("error",error);$("notice").classList.remove("hidden");clearTimeout(state.noticeTimer);state.noticeTimer=setTimeout(()=>$("notice").classList.add("hidden"),5500);}
function saveSession(s){state.session=s;if(s)localStorage.setItem("sb_leads_auth",JSON.stringify(s));else localStorage.removeItem("sb_leads_auth");}
function decodeSession(){try{return JSON.parse(localStorage.getItem("sb_leads_auth")||"null");}catch{return null;}}
async function token(grant,payload){const r=await fetch(api+"/auth/v1/token?grant_type="+grant,{method:"POST",headers:{"Content-Type":"application/json",apikey},body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(!r.ok||!data.access_token)throw Error(grant==="password"?"E-mail ou senha inválidos.":"Sessão expirada. Entre novamente.");return {access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};}
async function auth(){if(!state.session)throw Error("Acesso não autorizado.");if(state.session.expires_at<Math.floor(Date.now()/1000)+90){try{saveSession(await token("refresh_token",{refresh_token:state.session.refresh_token}));}catch(e){logout();throw e;}}return state.session.access_token;}
async function request(path,options={}){const access=await auth();const response=await fetch(api+"/rest/v1/"+path,{...options,headers:{apikey,Authorization:"Bearer "+access,...options.headers}});if(response.status===401){logout();throw Error("Sua sessão terminou. Entre novamente.");}if(!response.ok)throw Error("Não foi possível consultar os dados. Verifique sua autorização.");const data=await response.text();return data?JSON.parse(data):null;}
async function verify(){const result=await request("lead_panel_admins?select=user_id&limit=1");if(!Array.isArray(result)||result.length===0)throw Error("Conta cadastrada, mas ainda não autorizada como administradora. Libere o acesso no Supabase.");}
function showPanel(show){$("login").classList.toggle("hidden",show);$("dashboard").classList.toggle("hidden",!show);$("logout").classList.toggle("hidden",!show);if(!show){clearInterval(state.poll);state.poll=null;}}
function logout(){saveSession(null);state.leads=[];state.lastId=null;showPanel(false);}
const date=x=>new Date(x).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
function render(){const q=$("search").value.trim().toLocaleLowerCase("pt-BR"),f=$("filter").value;const data=state.leads.filter(l=>(!f||l.status===f)&&(!q||(l.full_name+" "+l.whatsapp+" "+(l.email||"")).toLocaleLowerCase("pt-BR").includes(q)));
$("count-total").textContent=String(state.leads.length);$("count-new").textContent=String(state.leads.filter(l=>l.status==="novo").length);$("count-work").textContent=String(state.leads.filter(l=>l.status==="em_atendimento").length);
const list=$("lead-list");list.replaceChildren();
if(!data.length){const empty=document.createElement("div");empty.className="empty";empty.textContent="Nenhum interessado encontrado.";list.append(empty);return;}
for(const l of data){const card=document.createElement("article");card.className="lead";
const top=document.createElement("div");top.className="lead-top";const nameWrap=document.createElement("div");const title=document.createElement("h2");title.textContent=l.full_name;const sub=document.createElement("small");sub.textContent=date(l.created_at)+" · "+(interest[l.interest_type]||l.interest_type);nameWrap.append(title,sub);
const badge=document.createElement("span");badge.className="pill "+l.status;badge.textContent=labels[l.status]||l.status;top.append(nameWrap,badge);
const details=document.createElement("div");details.className="lead-details";
for(const [label,value] of [["WhatsApp",l.whatsapp],["E-mail",l.email||"Não informado"]]){const box=document.createElement("div");const caption=document.createElement("label");caption.textContent=label;const span=document.createElement("span");span.textContent=value;box.append(caption,span);details.append(box);}
const actions=document.createElement("div");actions.className="lead-actions";const contact=document.createElement("a");contact.className="contact";contact.target="_blank";contact.rel="noopener noreferrer";const digits=l.whatsapp.replace(/\D/g,"");contact.href="https://wa.me/"+(digits.startsWith("55")?digits:"55"+digits);contact.textContent="↗ Chamar no WhatsApp";
const select=document.createElement("select");select.setAttribute("aria-label","Status de "+l.full_name);for(const [key,value] of Object.entries(labels)){const o=document.createElement("option");o.value=key;o.textContent=value;select.append(o);}select.value=l.status;select.addEventListener("change",async()=>{select.disabled=true;const next=select.value;try{await request("leads?id=eq."+encodeURIComponent(l.id),{method:"PATCH",headers:{"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({status:next})});l.status=next;notice("Atendimento atualizado.");render();}catch(e){select.value=l.status;notice(e.message,true);}finally{select.disabled=false;}});actions.append(contact,select);card.append(top,details,actions);list.append(card);}}
async function load(announce=false){if(state.refreshing||!state.session)return;state.refreshing=true;try{const rows=await request("leads?select=id,full_name,whatsapp,email,interest_type,status,created_at&development_slug=eq.fazenda-sao-bento&order=created_at.desc&limit=500");if(Array.isArray(rows)){if(announce&&state.lastId&&rows.length&&rows[0].id!==state.lastId){notice("🔔 Novo interessado cadastrado!");}state.leads=rows;state.lastId=rows[0]?.id||state.lastId;render();$("last-sync").textContent="Atualizado em "+new Date().toLocaleTimeString("pt-BR");}}catch(e){notice(e.message,true);}finally{state.refreshing=false;}}
async function start(){await verify();showPanel(true);await load(false);clearInterval(state.poll);state.poll=setInterval(()=>{if(document.visibilityState==="visible")void load(true);},15000);$("password").value="";}
$("login-form").addEventListener("submit",async e=>{e.preventDefault();const btn=$("login-button");btn.disabled=true;btn.textContent="Validando...";try{const s=await token("password",{email:$("email").value.trim(),password:$("password").value});saveSession(s);await start();notice("Bem-vindo ao painel de interessados.");}catch(err){saveSession(null);showPanel(false);notice(err.message,true);}finally{btn.disabled=false;btn.textContent="Entrar no painel";}});
$("logout").addEventListener("click",logout);$("refresh").addEventListener("click",()=>load(false));$("search").addEventListener("input",render);$("filter").addEventListener("change",render);
function tab(name){$("tab-leads").classList.toggle("active",name==="leads");$("tab-alerts").classList.toggle("active",name==="alerts");$("leads-section").classList.toggle("hidden",name!=="leads");$("alerts-section").classList.toggle("hidden",name!=="alerts");}
$("tab-leads").addEventListener("click",()=>tab("leads"));$("tab-alerts").addEventListener("click",()=>tab("alerts"));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&state.session)void load(true);});
(async()=>{const old=decodeSession();if(old){saveSession(old);try{await start();}catch{logout();}}})();
const vapidPublicKey="BDhGcmquac1B1xc5DFZTgxKYBziS-5vj0Y9xWAZrTdVMrK6rPkH4yseVEVs8Ra7buX4B0MnY0nx1_-Cqgthwf8A";
function pushMessage(text,isError=false){const el=$("push-status");el.textContent=text;el.style.color=isError?"#a03933":"#1f5a42";}
function decodeVapid(value){const padded=(value+"=".repeat((4-value.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(padded),ch=>ch.charCodeAt(0));}
$("enable-push").addEventListener("click",async()=>{
  const btn=$("enable-push");
  if(!state.session){pushMessage("Faça login novamente para ativar as notificações.",true);return;}
  if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)){
    pushMessage("Este aparelho não oferece notificações push neste modo. No iPhone, abra o app pelo ícone da Tela de Início.",true);return;
  }
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  const isInstalled=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
  if(isIOS&&!isInstalled){pushMessage("Primeiro abra no Safari, toque em Compartilhar → Adicionar à Tela de Início e execute o aplicativo pelo ícone.",true);return;}
  btn.disabled=true;
  try {
    // No iPhone, a permissão deve ser solicitada diretamente após o toque.
    const permission=await Notification.requestPermission();
    if(permission!=="granted")throw Error("As notificações não foram permitidas. Autorize nos Ajustes do iPhone.");
    pushMessage("Registrando este iPhone...");
    const registration=await navigator.serviceWorker.register("./sw.js",{scope:"./"});
    await navigator.serviceWorker.ready;
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapid(vapidPublicKey)});
    const json=subscription.toJSON();
    if(!json.endpoint||!json.keys?.p256dh||!json.keys?.auth)throw Error("Não foi possível registrar o dispositivo.");
    const access=await auth();
    const userResponse=await fetch(api+"/auth/v1/user",{headers:{apikey,Authorization:"Bearer "+access}});
    if(!userResponse.ok)throw Error("Confirme o seu acesso no painel.");
    const user=await userResponse.json();
    if(!user.id)throw Error("Não foi possível identificar o administrador.");
    await request("lead_push_subscriptions?on_conflict=endpoint",{method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},body:JSON.stringify({user_id:user.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth_key:json.keys.auth})});
    pushMessage("Notificações ativadas! Este iPhone foi cadastrado para receber avisos dos novos interessados.");
    notice("🔔 iPhone cadastrado para notificações.");
    btn.textContent="Notificações ativadas ✓";
  }catch(e){pushMessage(e instanceof Error?e.message:"Não foi possível ativar as notificações.",true);}
  finally{btn.disabled=false;}
});
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(()=>{}));}
