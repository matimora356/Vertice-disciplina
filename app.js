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
 version:3,
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
 finance:{goal:100,transactions:[]},
 workouts:{sessions:[]},
 school:{subjects:[]},
 projects:[],
 focus:{sessions:[]},
 journal:{entries:{}},
 tomorrowPlans:{},
 discipline:{startDate:today(),impulseWins:[]},
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
 const weekly=Array.isArray(s.weeklyTasks)?s.weeklyTasks.map(t=>({...t})):n.weeklyTasks.map(t=>({...t}));
 // V2 migration fix: older saved states replaced the default weekly list,
 // which could remove the built-in savings tracker completely.
 let moneyTask=weekly.find(t=>t.type==="money");
 if(!moneyTask){
   moneyTask=weekly.find(t=>/ahorr/i.test(String(t.title||""))||String(t.unit||"").trim()==="$");
   if(moneyTask)moneyTask.type="money";
 }
 if(!moneyTask){
   const def=n.weeklyTasks.find(t=>t.type==="money");
   weekly.splice(Math.min(3,weekly.length),0,{...def,id:uid()});
 }
 return {...n,...s,meta:{...n.meta,...s.meta},dailyWins:{...n.dailyWins,...s.dailyWins},history:{...n.history,...s.history},settings:{...n.settings,...s.settings},
 finance:{...n.finance,...(s.finance||{}),transactions:Array.isArray(s.finance?.transactions)?s.finance.transactions:[]},
 workouts:{...n.workouts,...(s.workouts||{}),sessions:Array.isArray(s.workouts?.sessions)?s.workouts.sessions:[]},
 school:{...n.school,...(s.school||{}),subjects:Array.isArray(s.school?.subjects)?s.school.subjects:[]},
 focus:{...n.focus,...(s.focus||{}),sessions:Array.isArray(s.focus?.sessions)?s.focus.sessions:[]},
 journal:{...n.journal,...(s.journal||{}),entries:{...n.journal.entries,...(s.journal?.entries||{})}},
 tomorrowPlans:{...n.tomorrowPlans,...(s.tomorrowPlans||{})},
 discipline:{...n.discipline,...(s.discipline||{}),impulseWins:Array.isArray(s.discipline?.impulseWins)?s.discipline.impulseWins:[]},
 projects:Array.isArray(s.projects)?s.projects:[],
 weeklyTasks:weekly,goals:Array.isArray(s.goals)?s.goals:[],calendarTasks:Array.isArray(s.calendarTasks)?s.calendarTasks:[],streaks:Array.isArray(s.streaks)?s.streaks:n.streaks,ideas:Array.isArray(s.ideas)?s.ideas:[],achievements:Array.isArray(s.achievements)?s.achievements:[]};
}
let state=migrate();
let cloud={ready:false,user:null,db:null,auth:null,mods:null,unsub:null,applying:false,timer:null};
let calCursor=new Date();calCursor.setDate(1);calCursor.setHours(12,0,0,0);
let selectedDate=today();
let deferredInstall=null;
let focusMinutes=25,focusRemaining=25*60,focusInterval=null,focusStartedAt=null;
let urgeRemaining=10*60,urgeInterval=null;

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
 const titles={home:"Hoy",goals:"Metas",calendar:"Calendario",workout:"Entreno",finance:"Dinero",school:"Colegio",projects:"Proyectos",streaks:"Rachas",ideas:"Ideas",journal:"Diario",stats:"Progreso",settings:"Ajustes"};
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

function weekKeyOfDate(s){return localISO(startOfWeek(new Date(s+"T12:00:00")))}
function tomorrowISO(){const d=new Date();d.setDate(d.getDate()+1);return localISO(d)}
function money(n){return "$"+Number(n||0).toFixed(2)}
function disciplineDay(){
 const start=new Date((state.discipline.startDate||today())+"T12:00:00"),now=new Date(today()+"T12:00:00");
 return Math.max(1,Math.floor((now-start)/86400000)+1)
}
function renderFocus(){
 const wk=weekKey(),count=(state.focus.sessions||[]).filter(s=>weekKeyOfDate(s.date)===wk).length;
 $("#focusWeek").textContent=count+" "+(count===1?"sesión":"sesiones");
 $("#focusLabel").textContent=focusMinutes+" minutos";
 $("#focusTimer").textContent=`${pad(Math.floor(focusRemaining/60))}:${pad(focusRemaining%60)}`;
}
function renderTomorrow(){
 const arr=state.tomorrowPlans[tomorrowISO()]||["","",""];
 $("#tomorrowSummary").innerHTML=arr.filter(Boolean).length?arr.filter(Boolean).map((x,i)=>`<div class="tomorrow-item"><strong>${i+1}.</strong> ${esc(x)}</div>`).join(""):'<div class="empty">Aún no has planeado mañana.</div>';
 $(".tomorrow-input").forEach((el,i)=>{if(document.activeElement!==el)el.value=arr[i]||""});
}
function renderFinance(){
 const tx=state.finance.transactions||[],balance=tx.reduce((a,t)=>a+(t.type==="out"?-1:1)*Number(t.amount||0),0);
 const wk=weekKey(),weekNet=tx.filter(t=>weekKeyOfDate(t.date)===wk).reduce((a,t)=>a+(t.type==="out"?-1:1)*Number(t.amount||0),0);
 const goal=Math.max(1,Number(state.finance.goal)||100),pct=clamp(Math.round(Math.max(0,balance)/goal*100),0,100);
 $("#financeBalance").textContent=money(balance);$("#financeWeek").textContent=money(weekNet);$("#financeGoalText").textContent=`${money(balance)} / ${money(goal)}`;$("#financeGoalPct").textContent=pct+"%";$("#financeGoalBar").style.width=pct+"%";
 if(document.activeElement!==$("#financeGoal"))$("#financeGoal").value=goal;
 $("#financeList").innerHTML=[...tx].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,30).map(t=>`<div class="item"><div class="grow"><div class="item-title">${esc(t.reason||"Movimiento")}</div><div class="meta">${fmtDate(t.date)}</div></div><strong class="${t.type==="out"?"money-negative":"money-positive"}">${t.type==="out"?"−":"+"}${money(t.amount)}</strong><button class="mini-btn finance-delete" data-id="${t.id}">×</button></div>`).join("")||'<div class="empty">Todavía no hay movimientos.</div>';
}
function workoutWeekStreak(){
 const groups={};for(const s of state.workouts.sessions||[]){const k=weekKeyOfDate(s.date);groups[k]=(groups[k]||0)+1}
 let d=startOfWeek(),streak=0;
 if((groups[localISO(d)]||0)<3)d.setDate(d.getDate()-7);
 for(let i=0;i<52;i++){const k=localISO(d);if((groups[k]||0)>=3){streak++;d.setDate(d.getDate()-7)}else break}
 return streak
}
function renderWorkout(){
 const sessions=state.workouts.sessions||[],wk=weekKey(),weekly=sessions.filter(s=>weekKeyOfDate(s.date)===wk).length;
 $("#workoutWeekCount").textContent=`${weekly}/3`;$("#workoutMetric").textContent=`${weekly}/3`;$("#workoutTotal").textContent=sessions.length;$("#workoutStreak").textContent=workoutWeekStreak();
 $("#workoutHistory").innerHTML=[...sessions].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12).map(s=>`<div class="item"><div class="grow"><div class="item-title">🏋 ${esc(s.type)}</div><div class="meta">${fmtDate(s.date)}</div></div><button class="mini-btn workout-delete" data-id="${s.id}">×</button></div>`).join("")||'<div class="empty">Tu primer entrenamiento aparecerá aquí.</div>';
}
function renderSchool(){
 const subs=state.school.subjects||[];
 $("#subjectList").innerHTML=subs.map(s=>{const cur=Number(s.current)||0,tar=Number(s.target)||0,gap=tar-cur;return `<article class="card subject-card"><div><span class="kicker">${gap>0?"POR SUBIR":"META ALCANZADA"}</span><h3>${esc(s.name)}</h3><div class="subject-gap">Meta: ${tar} · ${gap>0?"faltan "+gap.toFixed(2):"vas "+Math.abs(gap).toFixed(2)+" por encima"}</div></div><div class="actions"><div class="subject-score">${cur}</div><button class="mini-btn subject-edit" data-id="${s.id}">✎</button><button class="mini-btn subject-delete" data-id="${s.id}">×</button></div></article>`}).join("")||'<div class="empty">Añade tus materias y la nota que quieres alcanzar.</div>';
}
function renderProjects(){
 const statuses=[["idea","Idea"],["doing","En proceso"],["done","Terminado"]];
 $("#projectBoard").innerHTML=statuses.map(([key,label])=>`<section class="project-col"><h3>${label}</h3>${(state.projects||[]).filter(p=>p.status===key).map(p=>`<div class="project-card"><span class="kicker">${esc(p.area)}</span><h4>${esc(p.title)}</h4><select class="project-status" data-id="${p.id}"><option value="idea" ${p.status==="idea"?"selected":""}>Idea</option><option value="doing" ${p.status==="doing"?"selected":""}>En proceso</option><option value="done" ${p.status==="done"?"selected":""}>Terminado</option></select><button class="mini-btn project-delete" data-id="${p.id}" style="margin-top:8px">Eliminar</button></div>`).join("")||'<div class="meta">Vacío</div>'}</section>`).join("");
}
function renderJournal(){
 const e=state.journal.entries[today()]||{};
 if(document.activeElement!==$("#journalGood"))$("#journalGood").value=e.good||"";
 if(document.activeElement!==$("#journalMiss"))$("#journalMiss").value=e.miss||"";
 if(document.activeElement!==$("#journalNext"))$("#journalNext").value=e.next||"";
 renderTomorrow();
 const entries=Object.entries(state.journal.entries||{}).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10);
 $("#journalHistory").innerHTML=entries.map(([date,x])=>`<div class="item journal-entry"><div class="grow"><div class="item-title">${fmtDate(date)}</div><div class="meta"><strong>Bien:</strong> ${esc(x.good||"—")}<br><strong>Ajuste:</strong> ${esc(x.miss||"—")}<br><strong>Mañana:</strong> ${esc(x.next||"—")}</div></div></div>`).join("")||'<div class="empty">Tu primer check-in aparecerá aquí.</div>';
}
function renderLevel(){
 const fullDays=Object.values(state.dailyWins.checks||{}).filter(a=>Array.isArray(a)&&a.filter(Boolean).length===3).length;
 const balance=(state.finance.transactions||[]).reduce((a,t)=>a+(t.type==="out"?-1:1)*Number(t.amount||0),0);
 const doneGoals=(state.goals||[]).filter(g=>g.done).length,doneProjects=(state.projects||[]).filter(p=>p.status==="done").length;
 const points=fullDays*10+doneGoals*20+(state.workouts.sessions||[]).length*10+(state.focus.sessions||[]).length*5+(state.discipline.impulseWins||[]).length*15+Object.keys(state.journal.entries||{}).length*5+doneProjects*20+Math.floor(Math.max(0,balance)/5)*2;
 const level=Math.floor(points/100)+1,within=points%100,titles=["Inicio","Constancia","Enfoque","Impulso","Construcción","Disciplina"];
 $("#levelTitle").textContent=`Nivel ${level} · ${titles[Math.min(level-1,titles.length-1)]}`;$("#levelBar").style.width=within+"%";$("#levelText").textContent=`${points} puntos · ${100-within} para el siguiente nivel`;
 const badges=[
  ["🎯","Primera meta",doneGoals>=1],["🔥","7 días completos",fullDays>=7],["💰","$25 ahorrados",balance>=25],["🏋","10 entrenos",(state.workouts.sessions||[]).length>=10],
  ["⏱","5 enfoques",(state.focus.sessions||[]).length>=5],["⚡","Dominé un impulso",(state.discipline.impulseWins||[]).length>=1],["🧵","Proyecto terminado",doneProjects>=1],["🌙","7 check-ins",Object.keys(state.journal.entries||{}).length>=7]
 ];
 $("#badgeList").innerHTML=badges.map(([icon,name,on])=>`<span class="achievement-badge ${on?"":"locked"}">${icon} ${name}</span>`).join("");
}
function renderDiscipline(){
 $("#disciplineDay").textContent=`DÍA ${disciplineDay()} CONSTRUYENDO DISCIPLINA`;
}

function renderSettings(){
 $("#reminderTime").value=state.settings.reminderTime||"06:00";
 const cfg=localStorage.getItem(FIREBASE_KEY)||"";if(document.activeElement!==$("#firebaseConfig"))$("#firebaseConfig").value=cfg;
 updateCloudUI();
}
function renderAll(){closeWeekIfNeeded();renderDaily();renderWeekly();renderGoals();renderUpcoming();renderCalendar();renderStreaks();renderIdeas();renderStats();renderFocus();renderFinance();renderWorkout();renderSchool();renderProjects();renderJournal();renderLevel();renderDiscipline();renderSettings()}

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

function parseFirebaseConfig(raw){
 let text=String(raw||"").trim();
 const match=text.match(/(?:const|let|var)\s+firebaseConfig\s*=\s*({[\s\S]*?})\s*;?/);
 if(match) text=match[1];
 text=text.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,"");
 try{return JSON.parse(text)}catch{}
 text=text.replace(/([,{]\s*)([A-Za-z_$][\w$]*)(\s*:)/g,'$1"$2"$3').replace(/'/g,'"').replace(/,\s*}/g,'}');
 try{return JSON.parse(text)}catch{throw new Error("No pude leer la configuración. Pega el bloque firebaseConfig completo que te da Firebase.")}
}
async function initCloud(){
 const raw=localStorage.getItem(FIREBASE_KEY);if(!raw)throw new Error("Primero pega y guarda la configuración de Firebase.");
 const cfg=parseFirebaseConfig(raw)
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
 if(e.target.matches(".finance-delete")){state.finance.transactions=state.finance.transactions.filter(x=>x.id!==id);persist()}
 if(e.target.matches(".workout-complete")){const type=e.target.dataset.workout;if(!(state.workouts.sessions||[]).some(s=>s.date===today()&&s.type===type)){state.workouts.sessions.push({id:uid(),date:today(),type});const wt=state.weeklyTasks.find(t=>/entren/i.test(t.title));if(wt)wt.current=(Number(wt.current)||0)+1;persist();toast("Entrenamiento registrado ✓")}else toast("Ese entrenamiento ya está registrado hoy")}
 if(e.target.matches(".workout-delete")){state.workouts.sessions=state.workouts.sessions.filter(x=>x.id!==id);persist()}
 if(e.target.matches(".subject-delete")){state.school.subjects=state.school.subjects.filter(x=>x.id!==id);persist()}
 if(e.target.matches(".subject-edit")){const s=state.school.subjects.find(x=>x.id===id);if(s){$("#subjectName").value=s.name;$("#subjectCurrent").value=s.current;$("#subjectTarget").value=s.target;$("#subjectAdd").dataset.edit=id;setView("school")}}
 if(e.target.matches(".project-delete")){state.projects=state.projects.filter(x=>x.id!==id);persist()}
});
document.addEventListener("change",e=>{if(e.target.matches(".project-status")){const p=state.projects.find(x=>x.id===e.target.dataset.id);if(p){p.status=e.target.value;persist()}}});
$("#newGoalBtn").onclick=()=>openGoal();$("#quickAdd").onclick=()=>openTask(null,today());$("#addDayTaskBtn").onclick=()=>openTask(null,selectedDate);$("#addWeeklyBtn").onclick=()=>openWeekly();$("#newStreakBtn").onclick=()=>$("#streakDialog").showModal();
$("#prevMonth").onclick=()=>{calCursor.setMonth(calCursor.getMonth()-1);renderCalendar()};$("#nextMonth").onclick=()=>{calCursor.setMonth(calCursor.getMonth()+1);renderCalendar()};
$("#goalForm").addEventListener("submit",e=>{e.preventDefault();const id=$("#goalId").value,obj={id:id||uid(),title:$("#goalTitle").value.trim(),area:$("#goalArea").value,deadline:$("#goalDeadline").value,priority:$("#goalPriority").checked,done:false,createdAt:Date.now()};if(!obj.title)return;if(id){const old=state.goals.find(g=>g.id===id);Object.assign(old,obj,{done:old.done})}else state.goals.push(obj);$("#goalDialog").close();persist()});
$("#taskForm").addEventListener("submit",e=>{e.preventDefault();const id=$("#taskId").value,obj={id:id||uid(),title:$("#taskTitle").value.trim(),date:$("#taskDate").value,area:$("#taskArea").value,done:false};if(id){const old=state.calendarTasks.find(t=>t.id===id);Object.assign(old,obj,{done:old.done})}else state.calendarTasks.push(obj);selectedDate=obj.date;$("#taskDialog").close();persist()});
$("#weeklyForm").addEventListener("submit",e=>{e.preventDefault();const id=$("#weeklyId").value,title=$("#weeklyTitle").value.trim(),unit=$("#weeklyUnit").value.trim()||"veces",obj={id:id||uid(),title,target:Number($("#weeklyTarget").value)||1,unit,current:0,type:(/ahorr/i.test(title)||unit==="$")?"money":undefined};if(id){const old=state.weeklyTasks.find(t=>t.id===id);Object.assign(old,obj,{current:old.current})}else state.weeklyTasks.push(obj);$("#weeklyDialog").close();persist()});
$("#streakForm").addEventListener("submit",e=>{e.preventDefault();const title=$("#streakTitle").value.trim();if(title)state.streaks.push({id:uid(),title,dates:[]});$("#streakTitle").value="";$("#streakDialog").close();persist()});
$("#analyzeIdeaBtn").onclick=analyzeIdea;$("#saveIdeaBtn").onclick=()=>{const text=$("#ideaText").value.trim();if(!text)return;state.ideas.unshift({id:uid(),text,date:today()});$("#ideaText").value="";$("#ideaAnalysis").innerHTML="";persist()};

$("#financeAdd").onclick=()=>{const amount=Number($("#financeAmount").value),type=$("#financeType").value,reason=$("#financeReason").value.trim();if(!(amount>0))return toast("Escribe una cantidad válida");state.finance.transactions.push({id:uid(),type,amount,date:today(),reason:reason||"Movimiento"});const mt=state.weeklyTasks.find(t=>t.type==="money");if(mt)mt.current=Math.max(0,(Number(mt.current)||0)+(type==="out"?-amount:amount));$("#financeAmount").value="";$("#financeReason").value="";persist();toast("Movimiento guardado")};
$("#financeGoalSave").onclick=()=>{const g=Number($("#financeGoal").value);if(g>0){state.finance.goal=g;persist();toast("Meta de ahorro actualizada")}};
$("#subjectAdd").onclick=()=>{const name=$("#subjectName").value.trim(),current=Number($("#subjectCurrent").value),target=Number($("#subjectTarget").value),edit=$("#subjectAdd").dataset.edit;if(!name||!Number.isFinite(current)||!Number.isFinite(target))return toast("Completa materia, nota y meta");if(edit){const s=state.school.subjects.find(x=>x.id===edit);Object.assign(s,{name,current,target});delete $("#subjectAdd").dataset.edit}else state.school.subjects.push({id:uid(),name,current,target});$("#subjectName").value="";$("#subjectCurrent").value="";$("#subjectTarget").value="";persist()};
$("#projectAdd").onclick=()=>{const title=$("#projectTitle").value.trim();if(!title)return;state.projects.push({id:uid(),title,area:$("#projectArea").value,status:"idea",createdAt:Date.now()});$("#projectTitle").value="";persist()};
$("#journalSave").onclick=()=>{state.journal.entries[today()]={good:$("#journalGood").value.trim(),miss:$("#journalMiss").value.trim(),next:$("#journalNext").value.trim()};persist();toast("Check-in guardado")};
$("#tomorrowSave").onclick=()=>{state.tomorrowPlans[tomorrowISO()]=$(".tomorrow-input").map(x=>x.value.trim());persist();toast("Mañana está planeado")};
$("#emergencyBtn").onclick=()=>$("#emergencyDialog").showModal();
$("#urgeStart").onclick=()=>{clearInterval(urgeInterval);urgeRemaining=10*60;$("#urgeTimer").textContent="10:00";urgeInterval=setInterval(()=>{urgeRemaining--;$("#urgeTimer").textContent=`${pad(Math.floor(urgeRemaining/60))}:${pad(urgeRemaining%60)}`;if(urgeRemaining<=0){clearInterval(urgeInterval);toast("Pasaron los 10 minutos. Decide con calma.")}},1000)};
$("#urgeWon").onclick=()=>{clearInterval(urgeInterval);state.discipline.impulseWins.push({id:uid(),date:today(),time:new Date().toISOString()});$("#emergencyDialog").close();persist();toast("Victoria registrada ⚡")};
$("[data-focus-min]").forEach(b=>b.onclick=()=>{clearInterval(focusInterval);focusMinutes=Number(b.dataset.focusMin);focusRemaining=focusMinutes*60;$("[data-focus-min]").forEach(x=>x.classList.toggle("active",x===b));renderFocus()});
$("#focusStart").onclick=()=>{if(focusInterval)return;focusStartedAt=Date.now();focusInterval=setInterval(()=>{focusRemaining--;$("#focusTimer").textContent=`${pad(Math.floor(focusRemaining/60))}:${pad(focusRemaining%60)}`;if(focusRemaining<=0){clearInterval(focusInterval);focusInterval=null;state.focus.sessions.push({id:uid(),date:today(),minutes:focusMinutes});focusRemaining=focusMinutes*60;persist();toast("Sesión de enfoque completada ✓")}},1000)};
$("#focusPause").onclick=()=>{clearInterval(focusInterval);focusInterval=null;renderFocus()};
$("#focusReset").onclick=()=>{clearInterval(focusInterval);focusInterval=null;focusRemaining=focusMinutes*60;renderFocus()};
$("#schoolImportInfo").onclick=()=>alert("School Access puede automatizarse si contamos con un método permitido de acceso a los datos (API, exportación o una integración segura). No guardaremos tu contraseña de School Access dentro del código público de GitHub.");

$("#calendarReminderBtn").onclick=createICS;$("#testNotificationBtn").onclick=()=>testNotification().catch(showError);
$("#reminderTime").onchange=()=>{state.settings.reminderTime=$("#reminderTime").value;persist()};
$("#saveFirebaseBtn").onclick=()=>{try{parseFirebaseConfig($("#firebaseConfig").value);localStorage.setItem(FIREBASE_KEY,$("#firebaseConfig").value.trim());toast("Configuración guardada")}catch(e){showError(e)}};
$("#connectFirebaseBtn").onclick=()=>initCloud().catch(showError);$("#signInBtn").onclick=()=>signIn(false).catch(showError);$("#registerBtn").onclick=()=>signIn(true).catch(showError);$("#signOutBtn").onclick=()=>signOutCloud().catch(showError);
$("#exportBtn").onclick=exportData;$("#importInput").onchange=e=>{const f=e.target.files?.[0];if(f)importData(f).catch(showError)};
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("#installBtn").hidden=false});$("#installBtn").onclick=async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("#installBtn").hidden=true}};
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(console.error);
$("#todayLabel").textContent=new Intl.DateTimeFormat("es-PA",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
closeWeekIfNeeded();renderAll();
if(localStorage.getItem(FIREBASE_KEY))initCloud().catch(()=>{});
