const APP_KEY="vertice_disciplina_v2";
const OLD_KEY="vertice_disciplina_v1";
const FIREBASE_KEY="vertice_firebase_config";
const SITE_URL="https://matimora356.github.io/Vertice-disciplina/";
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);
const pad=n=>String(n).padStart(2,"0");
const localISO=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>localISO();
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmtDate=s=>new Intl.DateTimeFormat("es-PA",{weekday:"short",day:"numeric",month:"short"}).format(new Date(s+"T12:00:00"));
const startOfWeek=(d=new Date())=>{const x=new Date(d);const day=(x.getDay()+6)%7;x.setHours(12,0,0,0);x.setDate(x.getDate()-day);return x};
const weekKey=()=>localISO(startOfWeek());
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

const freshState=()=>({
 version:2,
 meta:{lastModified:Date.now(),weekKey:weekKey()},
 dailyWins:{
   labels:["Colegio: entregar y avanzar","Proyecto/futuro: crear o aprender","Yo: ejercicio, orden o autocontrol"],
   checks:{}
 },
 weeklyTasks:[
  {id:uid(),title:"Estudiar antes del ocio",target:4,unit:"días",current:0},
  {id:uid(),title:"Sesiones de Vértice",target:2,unit:"sesiones",current:0},
  {id:uid(),title:"Publicar contenido de Vértice",target:1,unit:"video",current:0},
  {id:uid(),title:"Ahorrar",target:5,unit:"$",current:0,type:"money"},
  {id:uid(),title:"Intento real de ganar dinero",target:1,unit:"intento",current:0},
  {id:uid(),title:"Entrenar",target:3,unit:"veces",current:0},
  {id:uid(),title:"Practicar pieza de Halloween",target:2,unit:"veces",current:0},
  {id:uid(),title:"Revisión semanal",target:1,unit:"domingo",current:0}
 ],
 goals:[],
 calendarTasks:[],
 streaks:[
  {id:uid(),title:"Ejercicio",dates:[]},
  {id:uid(),title:"Estudiar antes del ocio",dates:[]}
 ],
 ideas:[],
 achievements:[],
 history:{weeks:[]},
 settings:{reminderTime:"06:00"}
});

function migrate(){
 let s=null;
 try{s=JSON.parse(localStorage.getItem(APP_KEY)||"null")}catch{}
 if(s)return normalize(s);
 let old=null;try{old=JSON.parse(localStorage.getItem(OLD_KEY)||"null")}catch{}
 const n=freshState();
 if(old){
   if(old.dailyWins)n.dailyWins=old.dailyWins;
   if(Array.isArray(old.goals))n.goals=old.goals.map(g=>({...g,priority:!!g.star,createdAt:Date.now()}));
   if(Array.isArray(old.ideas))n.ideas=old.ideas;
   if(Array.isArray(old.achievements))n.achievements=old.achievements;
   if(Array.isArray(old.streaks))n.streaks=old.streaks.map(s=>({id:s.id||uid(),title:s.title,dates:s.last?[s.last]:[]}));
   if(Array.isArray(old.weekChecklist)){
     n.weeklyTasks=old.weekChecklist.map(x=>({id:x.id||uid(),title:x.t,target:1,unit:"vez",current:x.done?1:0}));
   }
 }
 return n;
}
function normalize(s){
 const n=freshState();
 return {...n,...s,meta:{...n.meta,...s.meta},dailyWins:{...n.dailyWins,...s.dailyWins},history:{...n.history,...s.history},settings:{...n.settings,...s.settings},
 weeklyTasks:Array.isArray(s.weeklyTasks)?s.weeklyTasks:n.weeklyTasks,goals:Array.isArray(s.goals)?s.goals:[],calendarTasks:Array.isArray(s.calendarTasks)?s.calendarTasks:[],streaks:Array.isArray(s.streaks)?s.streaks:n.streaks,ideas:Array.isArray(s.ideas)?s.ideas:[],achievements:Array.isArray(s.achievements)?s.achievements:[]};
}
let state=migrate();
let cloud={ready:false,user:null,db:null,auth:null,mods:null,unsub:null,applying:false,timer:null};
let calCursor=new Date();calCursor.setDate(1);calCursor.setHours(12,0,0,0);
let selectedDate=today();
let deferredInstall=null;

function closeWeekIfNeeded(){
 const wk=weekKey();
 if(state.meta.weekKey===wk)return;
 const tasks=state.weeklyTasks||[];
 const score=tasks.length?Math.round(tasks.reduce((a,t)=>a+Math.min(1,(Number(t.current)||0)/(Number(t.target)||1)),0)/tasks.length*100):0;
 state.history.weeks.unshift({week:state.meta.weekKey||wk,score});
 state.history.weeks=state.history.weeks.slice(0,12);
 state.weeklyTasks=tasks.map(t=>({...t,current:0}));
 state.meta.weekKey=wk;
 state.meta.lastModified=Date.now();
 persist(false);
}

function persist(render=true){
 state.meta.lastModified=Date.now();
 localStorage.setItem(APP_KEY,JSON.stringify(state));
 if(render)renderAll();
 scheduleCloudSave();
}
function scheduleCloudSave(){
 if(!cloud.user||!cloud.db||cloud.applying)return;
 clearTimeout(cloud.timer);
 cloud.timer=setTimeout(()=>pushCloud().catch(showError),700);
}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800)}
function showError(e){console.error(e);toast(e?.message||"Ocurrió un error")}

function setView(id){
 $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));
 $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
 const titles={home:"Hoy",goals:"Metas",calendar:"Calendario",streaks:"Rachas",ideas:"Ideas",stats:"Progreso",settings:"Ajustes"};
 $("#viewTitle").textContent=titles[id]||"Vértice";
 window.scrollTo({top:0,behavior:"smooth"});
}

function renderDaily(){
 const date=today(), checks=state.dailyWins.checks[date]||[false,false,false];
 $("#dailyWins").innerHTML=state.dailyWins.labels.map((label,i)=>`<label class="item ${checks[i]?"done":""}"><input class="check daily-check" data-i="${i}" type="checkbox" ${checks[i]?"checked":""}><div class="grow"><div class="item-title">${esc(label)}</div></div></label>`).join("");
 const done=checks.filter(Boolean).length,pct=Math.round(done/checks.length*100);
 $("#dailyCount").textContent=`${done}/${checks.length}`;
 $("#todayPct").textContent=pct+"%";$("#todayRing").style.setProperty("--p",pct);
 $("#statToday").textContent=pct+"%";
}
function weekPct(){
 const ts=state.weeklyTasks||[];
 return ts.length?Math.round(ts.reduce((a,t)=>a+Math.min(1,(Number(t.current)||0)/(Number(t.target)||1)),0)/ts.length*100):0;
}
function renderWeekly(){
 $("#weekBar").style.width=weekPct()+"%";$("#statWeek").textContent=weekPct()+"%";
 $("#weeklyList").innerHTML=(state.weeklyTasks||[]).map(t=>{
   const cur=Number(t.current)||0,target=Number(t.target)||1,done=cur>=target;
   const value=t.type==="money"?`$${cur} / $${target}`:`${cur} / ${target} ${esc(t.unit||"")}`;
   return `<div class="item ${done?"done":""}"><button class="mini-btn week-minus" data-id="${t.id}">−</button><div class="grow"><div class="item-title">${esc(t.title)}</div><div class="meta">${value}</div></div><button class="mini-btn week-plus" data-id="${t.id}">＋</button><button class="mini-btn week-edit" data-id="${t.id}">✎</button></div>`;
 }).join("")||'<div class="empty">Añade un objetivo semanal.</div>';
 const saving=(state.weeklyTasks||[]).filter(t=>t.type==="money").reduce((a,t)=>a+(Number(t.current)||0),0);
 $("#savingMetric").textContent="$"+saving;
}
function renderGoals(){
 const areas=["Todas",...new Set((state.goals||[]).map(g=>g.area).filter(Boolean))];
 if(!$("#goalFilters").dataset.filter)$("#goalFilters").dataset.filter="Todas";
 const filter=$("#goalFilters").dataset.filter;
 $("#goalFilters").innerHTML=areas.map(a=>`<button class="chip goal-filter ${filter===a?"active":""}" data-area="${esc(a)}">${esc(a)}</button>`).join("");
 const goals=[...(state.goals||[])].filter(g=>filter==="Todas"||g.area===filter).sort((a,b)=>(Number(!!b.priority)-Number(!!a.priority))||String(a.deadline||"9999").localeCompare(String(b.deadline||"9999")));
 $("#goalsList").innerHTML=goals.map(g=>`<article class="card goal-card ${g.priority?"priority":""} ${g.done?"done":""}"><div><span class="kicker">${g.priority?"★ IMPORTANTE":esc(g.area||"META")}</span><h3>${esc(g.title)}</h3><div class="meta">${g.deadline?"Fecha límite · "+fmtDate(g.deadline):"Sin fecha límite"}</div></div><div class="actions"><button class="mini-btn goal-toggle" data-id="${g.id}" title="Completar">${g.done?"↩":"✓"}</button><button class="mini-btn goal-edit" data-id="${g.id}">✎</button><button class="mini-btn goal-delete" data-id="${g.id}">×</button></div></article>`).join("")||'<div class="empty">Todavía no tienes metas en esta categoría.</div>';
 const active=state.goals.filter(g=>!g.done).length;
 $("#activeGoals").textContent=active;
 const pct=state.goals.length?Math.round(state.goals.filter(g=>g.done).length/state.goals.length*100):0;$("#statGoals").textContent=pct+"%";
}
function renderUpcoming(){
 const items=[...state.calendarTasks.filter(t=>!t.done).map(t=>({title:t.title,date:t.date,area:t.area,type:"task"})),...state.goals.filter(g=>!g.done&&g.deadline).map(g=>({title:g.title,date:g.deadline,area:g.area,type:"goal"}))].filter(x=>x.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
 $("#upcomingTasks").innerHTML=items.map(x=>`<div class="item"><div class="grow"><div class="item-title">${esc(x.title)}</div><div class="meta">${fmtDate(x.date)} · ${esc(x.area||"")}</div></div><span class="badge">${x.type==="goal"?"Meta":"Tarea"}</span></div>`).join("")||'<div class="empty">Nada urgente. Buen momento para adelantarte.</div>';
}
function monthName(d){return new Intl.DateTimeFormat("es-PA",{month:"long",year:"numeric"}).format(d)}
function renderCalendar(){
 $("#monthTitle").textContent=monthName(calCursor);
 const y=calCursor.getFullYear(),m=calCursor.getMonth();
 const first=new Date(y,m,1,12), offset=(first.getDay()+6)%7;
 const start=new Date(y,m,1-offset,12);
 let html="";
 for(let i=0;i<42;i++){
   const d=new Date(start);d.setDate(start.getDate()+i);const ds=localISO(d);
   const count=state.calendarTasks.filter(t=>t.date===ds).length+state.goals.filter(g=>g.deadline===ds&&!g.done).length;
   html+=`<button class="day ${d.getMonth()!==m?"out":""} ${ds===today()?"today":""} ${ds===selectedDate?"selected":""}" data-date="${ds}"><span class="day-num">${d.getDate()}</span><span class="day-dots">${Array.from({length:Math.min(3,count)},()=>"<i></i>").join("")}</span></button>`;
 }
 $("#calendarGrid").innerHTML=html;
 $("#selectedDateTitle").textContent=fmtDate(selectedDate);
 const tasks=state.calendarTasks.filter(t=>t.date===selectedDate);
 const goals=state.goals.filter(g=>g.deadline===selectedDate&&!g.done);
 $("#dayTasks").innerHTML=[
  ...tasks.map(t=>`<div class="item ${t.done?"done":""}"><input class="check task-toggle" data-id="${t.id}" type="checkbox" ${t.done?"checked":""}><div class="grow"><div class="item-title">${esc(t.title)}</div><div class="meta">${esc(t.area||"")}</div></div><button class="mini-btn task-edit" data-id="${t.id}">✎</button><button class="mini-btn task-delete" data-id="${t.id}">×</button></div>`),
  ...goals.map(g=>`<div class="item"><div class="grow"><div class="item-title">◎ ${esc(g.title)}</div><div class="meta">Meta · ${esc(g.area||"")}</div></div></div>`)
 ].join("")||'<div class="empty">No hay nada programado para este día.</div>';
}
function dateDiff(a,b){return Math.round((new Date(a+"T12:00:00")-new Date(b+"T12:00:00"))/86400000)}
function streakStats(dates=[]){
 const uniq=[...new Set(dates)].sort();let best=0,run=0,prev=null;
 for(const d of uniq){if(prev&&dateDiff(d,prev)===1)run++;else run=1;best=Math.max(best,run);prev=d}
 let cur=0;let probe=today();const set=new Set(uniq);
 if(!set.has(probe)){const y=new Date();y.setDate(y.getDate()-1);probe=localISO(y)}
 while(set.has(probe)){cur++;const d=new Date(probe+"T12:00:00");d.setDate(d.getDate()-1);probe=localISO(d)}
 return {current:cur,best};
}
function renderStreaks(){
 const list=state.streaks||[];
 $("#streakList").innerHTML=list.map(s=>{const st=streakStats(s.dates);const marked=s.dates.includes(today());return `<article class="card streak-card"><div><span class="kicker">${marked?"HECHO HOY":"PENDIENTE HOY"}</span><h3>🔥 ${esc(s.title)}</h3><div class="meta">Racha actual: ${st.current} días · Mejor: ${st.best} días</div></div><div class="actions"><button class="primary streak-toggle" data-id="${s.id}">${marked?"Desmarcar":"Marcar hoy"}</button><button class="mini-btn streak-delete" data-id="${s.id}">×</button></div></article>`}).join("")||'<div class="empty">Crea una racha para un hábito que quieras repetir.</div>';
 $("#bestStreak").textContent=Math.max(0,...list.map(s=>streakStats(s.dates).best));
}
function renderIdeas(){
 $("#ideasList").innerHTML=(state.ideas||[]).map(n=>`<div class="item"><div class="grow"><div class="item-title">${esc(n.text)}</div><div class="meta">${fmtDate(n.date||today())}</div></div><button class="mini-btn idea-goal" data-id="${n.id}">→ Meta</button><button class="mini-btn idea-delete" data-id="${n.id}">×</button></div>`).join("")||'<div class="empty">Tu bloc está vacío.</div>';
}
function renderStats(){
 const chart=$("#dailyChart");let cols=[];
 for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=localISO(d),arr=state.dailyWins.checks[ds]||[false,false,false],pct=Math.round(arr.filter(Boolean).length/3*100);cols.push(`<div class="bar-col"><div class="bar-wrap"><span class="bar" style="height:${Math.max(3,pct)}%"></span></div><span>${new Intl.DateTimeFormat("es-PA",{weekday:"short"}).format(d)}</span></div>`)}
 chart.innerHTML=cols.join("");
 $("#weekHistory").innerHTML=(state.history.weeks||[]).map(w=>`<div class="history-row"><span>${fmtDate(w.week)}</span><div class="mini-progress"><span style="width:${w.score}%"></span></div><strong>${w.score}%</strong></div>`).join("")||'<div class="empty">Tu historial aparecerá cuando cierre la primera semana.</div>';
}
function renderSettings(){
 $("#reminderTime").value=state.settings.reminderTime||"06:00";
 const cfg=localStorage.getItem(FIREBASE_KEY)||"";if(document.activeElement!==$("#firebaseConfig"))$("#firebaseConfig").value=cfg;
 updateCloudUI();
}
function renderAll(){closeWeekIfNeeded();renderDaily();renderWeekly();renderGoals();renderUpcoming();renderCalendar();renderStreaks();renderIdeas();renderStats();renderSettings()}

function openGoal(g=null){
 $("#goalDialogTitle").textContent=g?"Editar meta":"Nueva meta";$("#goalId").value=g?.id||"";$("#goalTitle").value=g?.title||"";$("#goalArea").value=g?.area||"Personal";$("#goalDeadline").value=g?.deadline||"";$("#goalPriority").checked=!!g?.priority;$("#goalDialog").showModal()
}
function openTask(t=null,date=selectedDate){$("#taskId").value=t?.id||"";$("#taskTitle").value=t?.title||"";$("#taskDate").value=t?.date||date;$("#taskArea").value=t?.area||"Personal";$("#taskDialog").showModal()}
function openWeekly(t=null){$("#weeklyId").value=t?.id||"";$("#weeklyTitle").value=t?.title||"";$("#weeklyTarget").value=t?.target||1;$("#weeklyUnit").value=t?.unit||"veces";$("#weeklyDialog").showModal()}

function analyzeIdea(){
 const text=$("#ideaText").value.trim(),host=$("#ideaAnalysis");host.innerHTML="";
 if(!text){host.innerHTML='<div class="empty">Escribe algo primero.</div>';return}
 const parts=text.split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(Boolean);
 const hits=parts.filter(s=>/\b(quiero|voy a|debo|tengo que|necesito|terminar|hacer|crear|aprender|ahorrar|publicar|entrenar|estudiar|practicar|empezar|lograr|me gustaría)\b/i.test(s));
 host.innerHTML=(hits.length?hits:[text]).slice(0,4).map((s,i)=>`<div class="note-hit"><div>${esc(s)}</div><div class="row" style="margin-top:9px"><button class="primary detected-goal" data-i="${i}">Convertir en meta</button><button class="secondary detected-save" data-i="${i}">Guardar idea</button></div></div>`).join("");
 host.dataset.hits=JSON.stringify((hits.length?hits:[text]).slice(0,4));
}
function createICS(){
 const time=$("#reminderTime").value||"06:00";state.settings.reminderTime=time;persist();
 const [hh,mm]=time.split(":").map(Number);let d=new Date();d.setHours(hh,mm,0,0);if(d<=new Date())d.setDate(d.getDate()+1);
 const stamp=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`;
 const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Vertice Disciplina//ES\r\nBEGIN:VEVENT\r\nUID:vertice-daily-${Date.now()}@matimora356.github.io\r\nDTSTART:${stamp}\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Vértice — tus 3 victorias\r\nDESCRIPTION:Abre Vértice y cumple: Colegio · Futuro/Vértice · Tú. ${SITE_URL}\r\nURL:${SITE_URL}\r\nBEGIN:VALARM\r\nTRIGGER:PT0M\r\nACTION:DISPLAY\r\nDESCRIPTION:Vértice — cumple tus 3 victorias de hoy.\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR`;
 const blob=new Blob([ics],{type:"text/calendar;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Vertice-recordatorio-diario.ics";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Recordatorio creado")
}
async function testNotification(){
 if(!("Notification"in window)){return $("#notificationStatus").textContent="Este navegador no soporta notificaciones web."}
 const p=await Notification.requestPermission();if(p!=="granted"){return $("#notificationStatus").textContent="Permiso de notificaciones no concedido."}
 const reg=await navigator.serviceWorker.ready;await reg.showNotification("Vértice — Disciplina",{body:"Tus 3 victorias de hoy: Colegio · Futuro · Tú.",icon:"./icon.svg",badge:"./icon.svg",data:{url:SITE_URL}});
 $("#notificationStatus").textContent="Notificación de prueba enviada."
}

async function initCloud(){
 const raw=localStorage.getItem(FIREBASE_KEY);if(!raw)throw new Error("Primero pega y guarda la configuración de Firebase.");
 let cfg;try{cfg=JSON.parse(raw)}catch{throw new Error("La configuración de Firebase no es JSON válido.")}
 $("#cloudStatus").textContent="Conectando...";
 const [appM,authM,fsM]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
   import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
   import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
 ]);
 const app=appM.getApps().length?appM.getApp():appM.initializeApp(cfg);
 cloud.auth=authM.getAuth(app);cloud.db=fsM.getFirestore(app);cloud.mods={authM,fsM};cloud.ready=true;
 authM.onAuthStateChanged(cloud.auth,async user=>{cloud.user=user||null;if(user)await startCloudSync();else{if(cloud.unsub)cloud.unsub();cloud.unsub=null;updateCloudUI()}});
 updateCloudUI();toast("Firebase conectado");
}
async function startCloudSync(){
 const {fsM}=cloud.mods,ref=fsM.doc(cloud.db,"users",cloud.user.uid,"data","state");
 const snap=await fsM.getDoc(ref);
 if(snap.exists()){
   const remote=snap.data()?.state;
   if(remote?.meta?.lastModified>state.meta.lastModified){cloud.applying=true;state=normalize(remote);localStorage.setItem(APP_KEY,JSON.stringify(state));renderAll();cloud.applying=false}
   else await fsM.setDoc(ref,{state},{merge:false});
 }else await fsM.setDoc(ref,{state},{merge:false});
 if(cloud.unsub)cloud.unsub();
 cloud.unsub=fsM.onSnapshot(ref,s=>{const remote=s.data()?.state;if(!remote||remote.meta?.lastModified<=state.meta.lastModified)return;cloud.applying=true;state=normalize(remote);localStorage.setItem(APP_KEY,JSON.stringify(state));renderAll();cloud.applying=false});
 updateCloudUI();
}
async function pushCloud(){if(!cloud.user||!cloud.db)return;const {fsM}=cloud.mods,ref=fsM.doc(cloud.db,"users",cloud.user.uid,"data","state");await fsM.setDoc(ref,{state},{merge:false})}
async function signIn(register=false){
 if(!cloud.ready)await initCloud();
 const email=$("#authEmail").value.trim(),pass=$("#authPassword").value;if(!email||pass.length<6)throw new Error("Escribe un correo y una contraseña de al menos 6 caracteres.");
 const {authM}=cloud.mods;
 if(register)await authM.createUserWithEmailAndPassword(cloud.auth,email,pass);else await authM.signInWithEmailAndPassword(cloud.auth,email,pass);
 toast(register?"Cuenta creada":"Sesión iniciada")
}
async function signOutCloud(){if(cloud.auth)await cloud.mods.authM.signOut(cloud.auth);toast("Sesión cerrada")}
function updateCloudUI(){
 const online=!!cloud.user;$("#cloudDot").classList.toggle("online",online);$("#cloudLabel").textContent=online?"Sincronizado":"Solo este dispositivo";
 $("#cloudStatus").textContent=online?`Conectado como ${cloud.user.email||"usuario"}`:cloud.ready?"Firebase conectado. Inicia sesión.":"Sin conectar.";
 $("#cloudStatus").className="status "+(online?"good":"");
}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`vertice-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function importData(file){const txt=await file.text();state=normalize(JSON.parse(txt));persist();toast("Copia importada")}

document.addEventListener("click",e=>{
 const nav=e.target.closest("[data-view]");if(nav){setView(nav.dataset.view);return}
 const id=e.target.dataset.id;
 if(e.target.matches(".daily-check")){const a=state.dailyWins.checks[today()]||[false,false,false];a[Number(e.target.dataset.i)]=e.target.checked;state.dailyWins.checks[today()]=a;persist()}
 if(e.target.matches(".week-plus")){const t=state.weeklyTasks.find(x=>x.id===id);t.current=(Number(t.current)||0)+(t.type==="money"?1:1);persist()}
 if(e.target.matches(".week-minus")){const t=state.weeklyTasks.find(x=>x.id===id);t.current=Math.max(0,(Number(t.current)||0)-1);persist()}
 if(e.target.matches(".week-edit"))openWeekly(state.weeklyTasks.find(x=>x.id===id));
 if(e.target.matches(".goal-filter")){$("#goalFilters").dataset.filter=e.target.dataset.area;renderGoals()}
 if(e.target.matches(".goal-toggle")){const g=state.goals.find(x=>x.id===id);g.done=!g.done;if(g.done&&!state.achievements.some(a=>a.goalId===g.id))state.achievements.push({id:uid(),goalId:g.id,title:g.title,date:today()});persist()}
 if(e.target.matches(".goal-edit"))openGoal(state.goals.find(x=>x.id===id));
 if(e.target.matches(".goal-delete")){state.goals=state.goals.filter(x=>x.id!==id);persist()}
 if(e.target.matches(".day")){selectedDate=e.target.dataset.date;renderCalendar()}
 if(e.target.matches(".task-toggle")){const t=state.calendarTasks.find(x=>x.id===id);t.done=e.target.checked;persist()}
 if(e.target.matches(".task-edit"))openTask(state.calendarTasks.find(x=>x.id===id));
 if(e.target.matches(".task-delete")){state.calendarTasks=state.calendarTasks.filter(x=>x.id!==id);persist()}
 if(e.target.matches(".streak-toggle")){const s=state.streaks.find(x=>x.id===id);s.dates=s.dates.includes(today())?s.dates.filter(d=>d!==today()):[...s.dates,today()];persist()}
 if(e.target.matches(".streak-delete")){state.streaks=state.streaks.filter(x=>x.id!==id);persist()}
 if(e.target.matches(".idea-delete")){state.ideas=state.ideas.filter(x=>x.id!==id);persist()}
 if(e.target.matches(".idea-goal")){const n=state.ideas.find(x=>x.id===id);openGoal({title:n.text,area:"Personal"})}
 if(e.target.matches(".detected-goal")){const hits=JSON.parse($("#ideaAnalysis").dataset.hits||"[]");openGoal({title:hits[Number(e.target.dataset.i)],area:"Personal"})}
 if(e.target.matches(".detected-save")){const hits=JSON.parse($("#ideaAnalysis").dataset.hits||"[]");state.ideas.unshift({id:uid(),text:hits[Number(e.target.dataset.i)],date:today()});persist();toast("Idea guardada")}
});
$("#newGoalBtn").onclick=()=>openGoal();$("#quickAdd").onclick=()=>openTask(null,today());$("#addDayTaskBtn").onclick=()=>openTask(null,selectedDate);$("#addWeeklyBtn").onclick=()=>openWeekly();$("#newStreakBtn").onclick=()=>$("#streakDialog").showModal();
$("#prevMonth").onclick=()=>{calCursor.setMonth(calCursor.getMonth()-1);renderCalendar()};$("#nextMonth").onclick=()=>{calCursor.setMonth(calCursor.getMonth()+1);renderCalendar()};
$("#goalForm").addEventListener("submit",e=>{e.preventDefault();const id=$("#goalId").value,obj={id:id||uid(),title:$("#goalTitle").value.trim(),area:$("#goalArea").value,deadline:$("#goalDeadline").value,priority:$("#goalPriority").checked,done:false,createdAt:Date.now()};if(!obj.title)return;if(id){const old=state.goals.find(g=>g.id===id);Object.assign(old,obj,{done:old.done})}else state.goals.push(obj);$("#goalDialog").close();persist()});
$("#taskForm").addEventListener("submit",e=>{e.preventDefault();const id=$("#taskId").value,obj={id:id||uid(),title:$("#taskTitle").value.trim(),date:$("#taskDate").value,area:$("#taskArea").value,done:false};if(id){const old=state.calendarTasks.find(t=>t.id===id);Object.assign(old,obj,{done:old.done})}else state.calendarTasks.push(obj);selectedDate=obj.date;$("#taskDialog").close();persist()});
$("#weeklyForm").addEventListener("submit",e=>{e.preventDefault();const id=$("#weeklyId").value,obj={id:id||uid(),title:$("#weeklyTitle").value.trim(),target:Number($("#weeklyTarget").value)||1,unit:$("#weeklyUnit").value.trim()||"veces",current:0};if(id){const old=state.weeklyTasks.find(t=>t.id===id);Object.assign(old,obj,{current:old.current,type:old.type})}else state.weeklyTasks.push(obj);$("#weeklyDialog").close();persist()});
$("#streakForm").addEventListener("submit",e=>{e.preventDefault();const title=$("#streakTitle").value.trim();if(title)state.streaks.push({id:uid(),title,dates:[]});$("#streakTitle").value="";$("#streakDialog").close();persist()});
$("#analyzeIdeaBtn").onclick=analyzeIdea;$("#saveIdeaBtn").onclick=()=>{const text=$("#ideaText").value.trim();if(!text)return;state.ideas.unshift({id:uid(),text,date:today()});$("#ideaText").value="";$("#ideaAnalysis").innerHTML="";persist()};
$("#calendarReminderBtn").onclick=createICS;$("#testNotificationBtn").onclick=()=>testNotification().catch(showError);
$("#reminderTime").onchange=()=>{state.settings.reminderTime=$("#reminderTime").value;persist()};
$("#saveFirebaseBtn").onclick=()=>{try{JSON.parse($("#firebaseConfig").value);localStorage.setItem(FIREBASE_KEY,$("#firebaseConfig").value.trim());toast("Configuración guardada")}catch{showError(new Error("JSON de Firebase inválido"))}};
$("#connectFirebaseBtn").onclick=()=>initCloud().catch(showError);$("#signInBtn").onclick=()=>signIn(false).catch(showError);$("#registerBtn").onclick=()=>signIn(true).catch(showError);$("#signOutBtn").onclick=()=>signOutCloud().catch(showError);
$("#exportBtn").onclick=exportData;$("#importInput").onchange=e=>{const f=e.target.files?.[0];if(f)importData(f).catch(showError)};
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("#installBtn").hidden=false});$("#installBtn").onclick=async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("#installBtn").hidden=true}};
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(console.error);
$("#todayLabel").textContent=new Intl.DateTimeFormat("es-PA",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
closeWeekIfNeeded();renderAll();
if(localStorage.getItem(FIREBASE_KEY))initCloud().catch(()=>{});
