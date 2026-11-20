import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const DIVS=["first","secondA","secondB"];
const LOGOS=["shield","round","diamond","stripe","star","chevron","monogram"];
const COLORS=["#245b3a","#173d72","#9c2525","#252525","#633d83","#e07822"];
let logoColor=0,clubNameDraft="";
const BOT_NAMES=["FC Noord","SV Rivierenland","Sporting Kempen","VV Heuvelrug","FC Havenstad","KSK Dennen","Union Dorp","SC Polder","VV Zilverbeek","FC Kanaal","Olympia Park","Racing Heide","KFC Meerzicht","SV Bosrand","FC Westhoek","VV Steenweg","Sportkring Zuid","FC Molen","KSK Horizon","Rode Ster","Blue Valley","Dynamo Oost","FC Grens","VV Centrum","Sporting Maas","FC Duin","KFC Veld","SV Linden","Union Waas","Dynamo Polder"];
function makePlayers(seed){
  const first=["Milan","Noah","Lucas","Arthur","Liam","Mathis","Louis","Adam","Victor","Jules","Oscar","Finn","Ruben","Elias","Mats","Nolan","Simon","Tibo","Amir","Jonas"];
  const last=["Peeters","Janssens","Maes","Jacobs","Willems","Claes","Goossens","Wouters","De Smet","Mertens","Dubois","Lambert","Martens","Michiels","De Wilde","Vermeulen","Pauwels","Dumont","Leclercq","De Backer"];
  const positions=["GK","DEF","DEF","DEF","DEF","MID","MID","MID","MID","ATT","ATT","ATT","DEF","MID","ATT","GK"];
  let hash=2166136261;
  for(const ch of String(seed)){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}
  let state=hash>>>0;
  const random=()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  const used=new Set();
  return Array.from({length:16},(_,i)=>{
    let name;
    do{name=first[Math.floor(random()*first.length)]+" "+last[Math.floor(random()*last.length)];}while(used.has(name));
    used.add(name);
    return{id:String(seed)+"-"+i,name,position:positions[i],age:18+Math.floor(random()*17),rating:48+Math.floor(random()*35),stamina:100,morale:70,starter:i<11};
  });
}
function newBot(id,division,index){return{id,name:BOT_NAMES[index%BOT_NAMES.length],logo:"shield",logoColor:index%COLORS.length,ownerUid:null,isBot:true,division,points:0,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,players:makePlayers(id),tactics:{formation:"4-3-3",mentality:"balanced",pressing:"normal",passing:"mixed"},balance:250000,stadiumLevel:1,academyLevel:1}}
function blankWorld(){const clubs=[];for(let i=0;i<30;i++)clubs.push(newBot("bot-"+i,i<10?"first":i<20?"secondA":"secondB",i));return{season:1,matchday:1,phase:"regular",clubs,market:[],createdAt:Date.now()}}
async function ensureWorldClient(){await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),s=await tx.get(ref);if(!s.exists())tx.set(ref,blankWorld())})}
function createFixtures(clubs,round){const out=[];for(const div of DIVS){const list=clubs.filter(c=>c.division===div).map(c=>c.id);if(list.length!==10)continue;for(let r=0;r<9;r++){const arr=list.slice();for(let n=0;n<r;n++){const last=arr.pop();arr.splice(1,0,last)}if(r===round%9)for(let i=0;i<5;i++){let home=arr[i],away=arr[9-i];if((r+i)%2)[home,away]=[away,home];if(round>=9)[home,away]=[away,home];out.push({homeId:home,awayId:away})}}}return out}
function strength(c){const starters=(c.players||[]).filter(p=>p.starter),squad=starters.length===11?starters:(c.players||[]),avg=squad.reduce((n,p)=>n+p.rating,0)/Math.max(1,squad.length),t=c.tactics||{},shape={"4-3-3":[1,4,3,3],"4-4-2":[1,4,4,2],"3-5-2":[1,3,5,2],"5-3-2":[1,5,3,2],"4-2-3-1":[1,4,5,1],"3-4-3":[1,3,4,3]}[t.formation]||[1,4,3,3],counts=["GK","DEF","MID","ATT"].map(pos=>squad.filter(p=>p.position===pos).length),fit=shape.reduce((n,need,i)=>n+Math.min(need,counts[i]),0)/11,mental=t.mentality==="attacking"?1.035:t.mentality==="defensive"?.985:1,press=t.pressing==="high"?.99:t.pressing==="low"?.995:1,pass=t.passing==="direct"?1.008:t.passing==="short"?1.004:1;return avg*(.94+.06*fit)*mental*press*pass}
function setBotMatchTactics(club,match){
  if(!club.isBot)return;
  const styles=[
    {formation:"4-3-3",mentality:"attacking",pressing:"high",passing:"direct"},
    {formation:"4-4-2",mentality:"balanced",pressing:"normal",passing:"mixed"},
    {formation:"3-5-2",mentality:"attacking",pressing:"normal",passing:"short"},
    {formation:"5-3-2",mentality:"defensive",pressing:"low",passing:"direct"},
    {formation:"4-2-3-1",mentality:"balanced",pressing:"high",passing:"short"},
    {formation:"3-4-3",mentality:"attacking",pressing:"high",passing:"mixed"},
    {formation:"4-4-2",mentality:"defensive",pressing:"normal",passing:"direct"},
    {formation:"4-2-3-1",mentality:"attacking",pressing:"normal",passing:"short"}
  ];
  const key=String(match.season)+"-"+String(match.matchday)+"-"+club.id;
  let hash=2166136261;
  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
  club.tactics={...styles[(hash>>>0)%styles.length]};
}
async function call(name, data = {}) {
  await ensureWorldClient();
  const worldRef = doc(db, "testWorld", "main");

  if (name === "createClub") {
    const nm = String(data.name || "").trim();
    const lg = data.logo || "⚽";
    if (nm.length < 3 || nm.length > 28) throw Error("De clubnaam moet 3 tot 28 tekens bevatten.");
    if (!["shield", "round", "diamond", "stripe", "star", "chevron", "monogram"].includes(lg)) throw Error("Ongeldig embleem.");

    await runTransaction(db, async tx => {
      const ur = doc(db, "testUsers", user.uid);
      const wr = await tx.get(worldRef);
      const urS = await tx.get(ur);
      if (urS.exists()) throw Error("Je hebt al een club.");
      const w = wr.data();
      const slot = w.clubs.find(c => c.isBot && c.division === "secondA")
        || w.clubs.find(c => c.isBot && c.division === "secondB")
        || w.clubs.find(c => c.isBot && c.division === "first");
      if (!slot) throw Error("Er is voorlopig geen vrije plaats.");

      const i = w.clubs.findIndex(c => c.id === slot.id);
      w.clubs[i] = {
        ...slot,
        id: "club-" + user.uid,
        name: nm,
        logo: lg,
        logoColor,
        ownerUid: user.uid,
        isBot: false,
        players: makePlayers(user.uid).map((p, index) => ({
          ...p,
          wage: 650 + (p.rating * 22),
          contractYears: 2,
          value: p.rating * 6000,
          potential: Math.min(99, p.rating + 8 + (index % 8))
        })),
        tactics: { formation: "4-3-3", mentality: "balanced", pressing: "normal", passing: "mixed" },
        trainingFocus: "balanced",
        trainingIntensity: "normal",
        balance: 250000,
        sponsorIncome: 18000,
        stadiumIncome: 8000,
        weeklyWages: 12000,
        trainingBudget: 2500,
        lastTrainingDate: "",
        stadiumLevel: 1,
        academyLevel: 1,
        youthRecruitedSeason: 0
      };
      tx.set(worldRef, w);
      tx.set(ur, {
        uid: user.uid,
        email: user.email || "",
        clubId: "club-" + user.uid,
        clubName: nm,
        createdAt: Date.now()
      });
    });
    return { data: { ok: true } };
  }

  if (name === "startMatchday") {
    let result;
    await runTransaction(db, async tx => {
      const snap = await tx.get(worldRef);
      const w = snap.data();
      if (w.phase !== "regular" || w.matchday > 18) throw Error("Het reguliere seizoen is afgelopen.");
      if (!w.clubs.some(c => c.ownerUid === user.uid)) throw Error("Je hebt geen club.");
      const fixtures = createFixtures(w.clubs, w.matchday - 1);
      if (fixtures.length !== 15) throw Error("De competitie-indeling is niet volledig.");
      const id = "s" + w.season + "-d" + w.matchday;
      const refs = fixtures.map((_, i) => doc(db, "testMatches", id + "-" + i));
      const old = await Promise.all(refs.map(ref => tx.get(ref)));
      if (old.some(item => item.exists())) throw Error("Deze speeldag is al gestart.");
      const now = Date.now();
      fixtures.forEach((fixture, i) => {
        tx.set(refs[i], {
          ...fixture,
          id: refs[i].id,
          season: w.season,
          matchday: w.matchday,
          status: "live",
          elapsed: 0,
          homeGoals: 0,
          awayGoals: 0,
          events: [{ minute: 0, text: "De wedstrijd is begonnen." }],
          startedAt: now
        });
      });
      w.phase = "live";
      tx.set(worldRef, w);
      result = { started: true, matchday: w.matchday };
    });
    return { data: result };
  }

  if (name === "finishSeason") {
    let result;
    await runTransaction(db, async tx => {
      const snap = await tx.get(worldRef);
      const w = snap.data();
      if (w.phase !== "season-end") throw Error("Speel eerst alle 18 speeldagen.");
      const rank = division => w.clubs
        .filter(c => c.division === division)
        .sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
      const a = rank("secondA");
      const b = rank("secondB");
      const id = "s" + w.season + "-playoff";
      const ref = doc(db, "testMatches", id);
      const old = await tx.get(ref);
      if (old.exists()) throw Error("De promotie-play-off is al aangemaakt.");
      const match = {
        id,
        type: "playoff",
        season: w.season,
        matchday: 19,
        homeId: a[1].id,
        awayId: b[1].id,
        status: "live",
        elapsed: 0,
        homeGoals: 0,
        awayGoals: 0,
        events: [{ minute: 0, text: "De promotie-play-off begint." }],
        startedAt: Date.now()
      };
      w.phase = "playoff";
      w.playoff = { homeId: a[1].id, awayId: b[1].id };
      tx.set(ref, match);
      tx.set(worldRef, w);
      result = { started: true, home: a[1].name, away: b[1].name };
    });
    return { data: result };
  }

  if (name === "applySeasonResults") {
    let result;
    await runTransaction(db, async tx => {
      const snap = await tx.get(worldRef);
      const w = snap.data();
      if (w.phase !== "playoff-finished" || !w.playoffWinnerId) throw Error("De promotie-play-off is nog niet afgelopen.");
      const rank = division => w.clubs
        .filter(c => c.division === division)
        .sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
      const first = rank("first");
      const a = rank("secondA");
      const b = rank("secondB");
      const winner = w.clubs.find(c => c.id === w.playoffWinnerId);
      const promoted = [a[0], b[0], winner];
      const relegated = first.slice(-3);
      const n = winner.division === "secondA" ? 2 : 1;
      relegated.forEach((club, index) => { club.division = index < n ? "secondA" : "secondB"; });
      promoted.forEach(club => { club.division = "first"; });
      w.clubs.forEach(club => {
        Object.assign(club, { points: 0, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 });
      });
      w.season++;
      w.matchday = 1;
      w.phase = "regular";
      delete w.playoff;
      delete w.playoffWinnerId;
      tx.set(worldRef, w);
      result = {
        season: w.season,
        promoted: promoted.map(club => club.name),
        relegated: relegated.map(club => club.name),
        playoffWinner: winner.name
      };
    });
    return { data: result };
  }

  throw Error("Onbekende actie.");
}
async function advanceIfMatchesFinished(){
  if(!world||world.phase!=="live")return;
  const prefix="s"+world.season+"-d"+world.matchday+"-";
  const dayMatches=matches.filter(m=>String(m.id).startsWith(prefix));
  if(dayMatches.length!==15||!dayMatches.every(m=>m.status==="finished"))return;
  await runTransaction(db,async tx=>{
    const ws=await tx.get(worldRefClient);
    if(!ws.exists())return;
    const w=ws.data();
    if(w.phase!=="live"||w.season!==world.season||w.matchday!==world.matchday)return;
    w.phase="regular";
    w.matchday++;
    if(w.matchday>18)w.phase="season-end";
    tx.set(worldRefClient,w);
  });
}
async function tickClientMatches(){if(!user||tickBusy)return;const live=matches.filter(m=>m.status==="live");if(!live.length){try{await advanceIfMatchesFinished()}catch(e){console.error("Speeldag afronden:",e)}return}tickBusy=true;let ownsLock=false;try{ownsLock=await runTransaction(db,async tx=>{const snap=await tx.get(simLockRef),lock=snap.exists()?snap.data():{},now=Date.now();if(lock.until>now&&lock.owner!==simOwnerId)return false;tx.set(simLockRef,{owner:simOwnerId,until:now+30000});return true});if(!ownsLock)return;for(const m0 of live){const ref=doc(db,"testMatches",m0.id);await runTransaction(db,async tx=>{const ms=await tx.get(ref);if(!ms.exists()||ms.data().status!=="live")return;const ws=await tx.get(worldRefClient);if(!ws.exists())return;const w=ws.data(),m=ms.data(),h=w.clubs.find(c=>c.id===m.homeId),a=w.clubs.find(c=>c.id===m.awayId);if(!h||!a)return;setBotMatchTactics(h,m);setBotMatchTactics(a,m);const minute=Math.min(90,Math.floor((Date.now()-m.startedAt)/(300000/90)));if(minute<=m.elapsed)return;const events=[...(m.events||[])];for(let gameMinute=m.elapsed+1;gameMinute<=minute;gameMinute++){if(Math.random()<.10){const home=Math.random()<.52,att=home?h:a,def=home?a:h,t=att.tactics||{},attackBonus=(t.mentality==="attacking"?.055:t.mentality==="defensive"?-.045:0)+(t.passing==="direct"?.018:t.passing==="short"?.008:0),goalChance=Math.max(.18,Math.min(.58,.32+(strength(att)-strength(def))/150+attackBonus));if(Math.random()<goalChance){if(home)m.homeGoals++;else m.awayGoals++;events.push({minute:gameMinute,text:"DOELPUNT! "+att.name+" scoort."})}else events.push({minute:gameMinute,text:att.name+" krijgt een kans."})}}m.elapsed=minute;m.events=events.slice(-12);if(minute>=90){m.status="finished";for(const [c,gf,ga] of [[h,m.homeGoals,m.awayGoals],[a,m.awayGoals,m.homeGoals]]){c.played++;c.gf+=gf;c.ga+=ga;if(gf>ga){c.wins++;c.points+=3}else if(gf===ga){c.draws++;c.points++}else c.losses++}for(const club of [h,a])club.balance=(club.balance||250000)+(club.sponsorIncome||18000)+(club.stadiumIncome||8000)-(club.players||[]).reduce((sum,p)=>sum+(p.wage||0),club.weeklyWages||12000);tx.set(worldRefClient,w)}tx.set(ref,m)})}await advanceIfMatchesFinished();}catch(e){console.error("Matchsimulatie:",e)}finally{if(ownsLock){try{await runTransaction(db,async tx=>{const snap=await tx.get(simLockRef);if(snap.exists()&&snap.data().owner===simOwnerId)tx.set(simLockRef,{owner:null,until:0})})}catch(e){console.error("Simulatie-lock vrijgeven:",e)}}tickBusy=false}}const worldRefClient=doc(db,"testWorld","main"),simLockRef=doc(db,"testWorld","matchSimulationLock"),simOwnerId="tab-"+Math.random().toString(36).slice(2);let tickBusy=false;setInterval(tickClientMatches,5000);
const ALLOWED_TEST_EMAIL="vanherzeelematteo@gmail.com";let authError="";let user=null,profile=null,world=null,matches=[],unsubWorld=null,unsubMatches=null,view="home",busy=false,message="",logo="shield";
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const euro=n=>new Intl.NumberFormat("nl-BE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);
const divName=d=>({first:"Eerste Klasse",secondA:"Tweede Klasse A",secondB:"Tweede Klasse B"}[d]||d);
function notice(t){message=t;render()}
function authScreen(){ $("#app").innerHTML=`<main class="auth"><section class="auth-card"><div class="brand"><b>FM</b><span>FOOTBALL MANAGER</span></div><h1>Jouw club. Jouw competitie.</h1><p>Privétestomgeving. Alleen het toegelaten account kan inloggen.</p><form id="login"><label>E-mailadres</label><input id="email" type="email" autocomplete="email" required><label>Wachtwoord</label><input id="password" type="password" minlength="6" autocomplete="current-password" required><button class="primary" type="submit">Inloggen</button></form><p class="error" id="error"></p></section></main>`;
$("#error").textContent=authError;$("#login").onsubmit=async e=>{e.preventDefault();authError="";try{const email=$("#email").value.trim().toLowerCase();if(email!==ALLOWED_TEST_EMAIL)throw Error("Deze testversie is alleen toegankelijk voor het toegelaten account.");await signInWithEmailAndPassword(auth,email,$("#password").value)}catch(err){$("#error").textContent=err.message}};
}
function onboarding(){ $("#app").innerHTML=`<main class="auth"><section class="auth-card"><div class="brand"><b>FM</b><span>NIEUWE CLUB</span></div><h1>Begin met je eigen club</h1><p>Kies een clubnaam en een embleem. Je start in Tweede Klasse A of B.</p><form id="create-club"><label>Naam van je club</label><input id="clubname" maxlength="28" placeholder="Bijv. FC Waregem" value="${esc(clubNameDraft)}" required><label>Clubkleuren / embleem</label><div class="logos">${["shield","round","diamond","stripe","star","chevron","monogram"].map(x=>`<button type="button" class="logo ${logo===x?"picked":""}" data-logo="${x}">${crest({logo:x,logoColor,name:"FM"})}</button>`).join("")}<div class="color-picks">${COLORS.map((x,i)=>`<button type="button" class="color-pick ${logoColor===i?"picked":""}" data-color="${i}" style="--club-color:${x}"></button>`).join("")}</div></div><button class="primary" type="submit" ${busy?"disabled":""}>Club oprichten</button></form><p class="error" id="error"></p></section></main>`;
document.querySelectorAll("[data-logo]").forEach(b=>b.onclick=()=>{logo=b.dataset.logo;onboarding()});document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>{logoColor=Number(b.dataset.color);onboarding()});
$("#clubname").oninput=e=>{clubNameDraft=e.target.value};$("#create-club").onsubmit=async e=>{e.preventDefault();clubNameDraft=$("#clubname").value;busy=true;try{await call("createClub",{name:$("#clubname").value.trim(),logo});}catch(err){$("#error").textContent=err.message;busy=false}};
}
function crest(c,large=false){const color=COLORS[c.logoColor||0]||COLORS[0],initials=(c.name||"FM").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();const shapes={shield:"M5 4h38v23c0 9-9 15-19 19C14 42 5 36 5 27Z",round:"M24 3a21 21 0 1 0 0 42a21 21 0 1 0 0-42",diamond:"M24 2 46 24 24 46 2 24Z",stripe:"M5 4h38v40H5Z",star:"m24 2 6 14 16 2-12 10 3 16-13-8-13 8 3-16L2 18l16-2Z",chevron:"M3 4h42L24 45Z",monogram:"M5 5h38v38H5Z"};return `<svg class="crest-svg ${large?"large":""}" viewBox="0 0 48 48"><path d="${shapes[c.logo]||shapes.shield}" fill="${color}" stroke="#fff" stroke-width="2"/><text x="24" y="29" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">${esc(initials)}</text></svg>`}
async function saveClubPatch(patch,success){try{await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref),w=snap.data(),i=w.clubs.findIndex(x=>x.ownerUid===user.uid);if(i<0)throw Error("Club niet gevonden.");w.clubs[i]={...w.clubs[i],...patch};tx.set(ref,w)});notice(success)}catch(e){notice(e.message)}}
function standings(division){return (world?.clubs||[]).filter(c=>c.division===division).sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.name.localeCompare(b.name))}
function standingStatus(division,index,total){
  const final=["season-end","playoff","playoff-finished"].includes(world.phase);
  let label="",kind="";
  if(division==="first"){
    if(index===0){label=final?"KAMPIOEN":"KAMPIOENSPLAATS";kind="champion"}
    else if(index>=Math.max(0,total-3)){label=final?"DEGRADEERT":"DEGRADATIEZONE";kind="danger"}
  }else if(division==="secondA"||division==="secondB"){
    if(index===0){label=final?"PROMOVEERT":"PROMOTIEPLAATS";kind="promote"}
    else if(index===1){label=final?"PLAY-OFF":"PLAY-OFFPLAATS";kind="playoff"}
  }
  if(!label)return "";
  const styles={champion:"background:#e7f1dc;color:#315d3b",promote:"background:#e2edf8;color:#28527a",playoff:"background:#f5edd9;color:#795b19",danger:"background:#f8e4e1;color:#963d35"};
  return '<span style="display:inline-block;padding:4px 7px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.3px;'+styles[kind]+'">'+label+'</span>';
}
function table(division){
  const cs=standings(division);
  return '<div class="table-scroll"><table><thead><tr><th>#</th><th>Club</th><th>GS</th><th>W</th><th>G</th><th>V</th><th>DS</th><th>PT</th><th>SEIZOENSITUATIE</th></tr></thead><tbody>'+cs.map((c,i)=>'<tr class="'+(c.ownerUid===user.uid?"mine":"")+'"><td>'+(i+1)+'</td><td>'+crest(c)+'<b>'+esc(c.name)+'</b>'+(c.isBot?'<small class="bot">BOT</small>':"")+'</td><td>'+c.played+'</td><td>'+c.wins+'</td><td>'+c.draws+'</td><td>'+c.losses+'</td><td>'+(c.gf-c.ga)+'</td><td><b>'+c.points+'</b></td><td>'+standingStatus(division,i,cs.length)+'</td></tr>').join("")+'</tbody></table></div>';
}
function myClub(){return world?.clubs?.find(c=>c.ownerUid===user?.uid)}
function liveMatches(){const current=matches.some(m=>m.season===world?.season&&m.matchday===world?.matchday&&m.status==="live");const day=world?.phase==="regular"&&world.matchday>1&&!current?world.matchday-1:world?.phase==="season-end"?18:world?.matchday;return matches.filter(m=>m.season===world?.season&&m.matchday===day)}
function matchCard(m){const h=world.clubs.find(c=>c.id===m.homeId),a=world.clubs.find(c=>c.id===m.awayId);if(!h||!a)return"";return `<article class="match-card ${m.status}"><div class="match-team">${crest(h)}<b>${esc(h.name)}</b></div><div class="match-score"><strong>${m.homeGoals} – ${m.awayGoals}</strong><small>${m.status==="finished"?"FT":m.elapsed+"’ / 90’"}</small></div><div class="match-team away">${crest(a)}<b>${esc(a.name)}</b></div><div class="match-events">${(m.events||[]).slice(-3).map(e=>`<p><b>${e.minute}’</b> ${esc(e.text)}</p>`).join("")}</div></article>`}
function render(){if(!user)return authScreen();if(!profile)return onboarding();if(!world){$("#app").innerHTML='<div class="loading">Competitie laden…</div>';return}const c=myClub();if(c){c.market=world.market||[];c.stadiumLevel=c.stadiumLevel||1;c.academyLevel=c.academyLevel||1;c.balance=c.balance??250000;c.players=(c.players||[]).map(p=>({...p,contractYears:p.contractYears??2,wage:p.wage??(p.rating*22),value:p.value??(p.rating*6000),potential:p.potential??Math.min(99,p.rating+8)}));}if(!c){$("#app").innerHTML='<div class="loading">Je club wordt gekoppeld…</div>';return}
const nav=[["home","Overzicht"],["leagues","Competities"],["matches","Wedstrijden"],["squad","Spelers"],["lineup","Opstelling"],["tactics","Tactieken"],["training","Training"],["market","Transfermarkt"],["youth","Jeugdopleiding"],["stadium","Stadion"],["finance","Financiën"],["club","Mijn club"]];
let body="";
const myMatch=liveMatches().find(m=>m.homeId===c.id||m.awayId===c.id);const otherFinished=liveMatches().filter(m=>m.status==="finished"&&m.id!==myMatch?.id);
if(view==="home"){body=`<section class="welcome"><div><small>SEIZOEN ${world.season} · SPEELDAG ${world.matchday}/18</small><h1>${esc(c.name)}</h1><p>${divName(c.division)} · ${c.isBot?"Computerclub":"Jouw club"}</p></div>${crest(c,true)}</section><section class="stats"><div><small>PUNTEN</small><b>${c.points}</b></div><div><small>GESPEELD</small><b>${c.played}</b></div><div><small>DOELSALDO</small><b>${c.gf-c.ga}</b></div><div><small>SEIZOEN</small><b>${world.season}</b></div></section><section class="panel"><div class="panel-head"><div><h2>Speeldag ${world.matchday}</h2><p>Start hier de wedstrijden van deze speeldag.</p></div>${world.phase==="season-end"?'<button class="primary" id="finish-season">Start promotie-play-off</button>':world.phase==="playoff-finished"?'<button class="primary" id="finish-new-season">Verwerk promotie & degradatie</button>':world.phase==="regular"&&world.matchday<=18?'<button class="primary" id="start-day">Speeldag starten</button>':world.phase==="live"?'<button class="secondary" disabled>Speeldag bezig…</button>':'<span class="sub">Geen speeldag beschikbaar · status: '+esc(world.phase)+'</span>'}</div>${myMatch?matchCard(myMatch):'<p class="empty">Klik op “Speeldag starten” wanneer jij klaar bent. De wedstrijden duren ongeveer vijf echte minuten.</p>'}</section><section class="panel"><div class="panel-head"><div><h2>${divName(c.division)}</h2><p>Jouw huidige klasse</p></div></div>${table(c.division)}</section>`}
if(view==="leagues"){body=`<section class="panel"><h2>Afgewerkte uitslagen</h2>${otherFinished.length?otherFinished.map(matchCard).join(""):'<p class="empty">Andere uitslagen verschijnen na afloop.</p>'}</section><section class="panel"><h2>Eerste Klasse</h2><p class="sub">10 clubs · De laatste drie degraderen rechtstreeks.</p>${table("first")}</section><section class="panel"><h2>Tweede Klasse A</h2><p class="sub">De kampioen promoveert. De nummer twee speelt een promotiewedstrijd.</p>${table("secondA")}</section><section class="panel"><h2>Tweede Klasse B</h2><p class="sub">De kampioen promoveert. De nummer twee speelt een promotiewedstrijd.</p>${table("secondB")}</section><section class="panel"><h2>Promotie en degradatie</h2><p>De drie laatste clubs uit Eerste Klasse degraderen. De kampioenen van Tweede Klasse A en B promoveren rechtstreeks. De nummers twee spelen één beslissende wedstrijd om het derde promotieticket.</p><p>Computerclubs die op een degradatieplaats eindigen, degraderen ook. Daardoor kan het aantal menselijke clubs dat zakt lager zijn.</p></section>`}
if(view==="matches"){const playoffMatch=matches.find(m=>m.id==="s"+world.season+"-playoff");const showMatch=myMatch||(world.phase==="playoff"?playoffMatch:null);body=`<section class="panel"><div class="panel-head"><div><h2>${world.phase==="playoff"?"Promotie-play-off":"Mijn wedstrijd · Speeldag "+world.matchday}</h2><p class="sub">${myMatch?"Alleen jouw eigen wedstrijd wordt getoond.":world.phase==="playoff"?"De promotie-play-off wordt hier voor iedereen getoond.":"Alleen jouw eigen wedstrijd wordt getoond."}</p></div>${world.phase==="regular"&&world.matchday<=18?'<button class="primary" id="start-day">Speeldag starten</button>':world.phase==="live"?'<span class="season-tag">Speeldag bezig</span>':""}</div>${showMatch?matchCard(showMatch):world.phase==="regular"?'<p class="empty">Er is nog geen wedstrijd gestart. Klik op “Speeldag starten” om alle wedstrijden te beginnen.</p>':'<p class="empty">Er is momenteel geen wedstrijd beschikbaar.</p>'}</section>`}
if(view==="tactics"){const t=c.tactics||{formation:"4-3-3",mentality:"balanced",pressing:"normal",passing:"mixed"};body=`<section class="panel"><h2>Wedstrijdtactiek</h2><form id="tactics-form" class="game-form"><label>Formatie<select name="formation">${["4-3-3","4-4-2","3-5-2","5-3-2","4-2-3-1","3-4-3"].map(x=>`<option ${t.formation===x?"selected":""}>${x}</option>`).join("")}</select></label><label>Mentaliteit<select name="mentality"><option value="defensive" ${t.mentality==="defensive"?"selected":""}>Verdedigend</option><option value="balanced" ${t.mentality==="balanced"?"selected":""}>Gebalanceerd</option><option value="attacking" ${t.mentality==="attacking"?"selected":""}>Aanvallend</option></select></label><label>Pressing<select name="pressing"><option value="low" ${t.pressing==="low"?"selected":""}>Laag</option><option value="normal" ${t.pressing==="normal"?"selected":""}>Normaal</option><option value="high" ${t.pressing==="high"?"selected":""}>Hoog</option></select></label><label>Passing<select name="passing"><option value="short" ${t.passing==="short"?"selected":""}>Kort</option><option value="mixed" ${t.passing==="mixed"?"selected":""}>Gemengd</option><option value="direct" ${t.passing==="direct"?"selected":""}>Direct</option></select></label><button class="primary">Tactiek opslaan</button></form><p class="sub">Tactieken beïnvloeden de ploegsterkte in de wedstrijdsimulatie.</p></section>`}
if(view==="training"){body=`<section class="panel"><h2>Trainingscentrum</h2><form id="training-form" class="game-form"><label>Focus<select name="focus"><option value="balanced">Gebalanceerd</option><option value="attack">Aanval</option><option value="midfield">Middenveld</option><option value="defence">Verdediging</option><option value="goalkeeping">Keepers</option></select></label><label>Intensiteit<select name="intensity"><option value="light">Licht · €1.000</option><option value="normal" selected>Normaal · €2.500</option><option value="intense">Intensief · €4.000</option></select></label><button class="primary">Training uitvoeren</button></form><h3>Spelerskern</h3>${(c.players||[]).map(p=>`<div class="detail"><span>${esc(p.name)} · ${p.position} · ${p.age} jaar</span><b>${p.rating} ALG</b></div>`).join("")}</section>`}
if(view==="finance"){body=`<section class="panel"><h2>Clubfinanciën</h2><div class="finance-balance"><small>HUIDIG SALDO</small><strong>${euro(c.balance||250000)}</strong></div><div class="detail"><span>Hoofdsponsor per speeldag</span><b>+${euro(c.sponsorIncome||18000)}</b></div><div class="detail"><span>Stadioninkomsten</span><b>+${euro(c.stadiumIncome||8000)}</b></div><div class="detail"><span>Spelerslonen</span><b>−${euro(c.weeklyWages||12000)}</b></div><div class="detail"><span>Training</span><b>−${euro(c.trainingBudget||2500)}</b></div></section>`}

if(view==="squad"){body=`<section class="panel"><div class="panel-head"><div><h2>Spelerskern</h2><p>${c.players.length} spelers · Stel je basiself samen bij Opstelling.</p></div></div><div class="player-list"><div class="player-row player-head"><b>Speler</b><b>Pos.</b><b>ALG</b><b>Leeftijd</b><b>Waarde</b><b>Contract</b></div>${c.players.map(p=>`<div class="player-row"><span><b>${esc(p.name)}</b><small>Potentieel \u00b7 ${p.potential||Math.min(99,p.rating+8)} ALG</small></span><span>${p.position}</span><b>${p.rating}</b><span>${p.age}</span><span>${euro(p.value||p.rating*6000)}</span><span>${p.contractYears??2} jaar</span></div>`).join("")}</div></section>`;}
if(view==="lineup"){const selected=c.players.filter(p=>p.starter);body=`<section class="panel"><div class="panel-head"><div><h2>Wed opstelling</h2><p>Selecteer precies 11 basisspelers. Je selectie telt mee voor je wedstrijdsterkte.</p></div><span class="season-tag">${selected.length}/11</span></div><div class="player-list">${c.players.map(p=>`<div class="lineup-row"><div><b>${esc(p.name)}</b><small>${p.position} · ${p.rating} ALG · ${p.stamina??100}% fit</small></div><button class="${p.starter?"primary":"secondary"}" data-starter="${p.id}">${p.starter?"Basiself":"Reserves"}</button></div>`).join("")}</div></section>`;}
if(view==="market"){const market=world.market||[];body=`<section class="panel"><h2>Transfermarkt</h2><p class="sub">Koop spelers die andere clubs op de markt zetten. De transferprijs wordt rechtstreeks tussen clubs verrekend.</p>${market.length?market.map(x=>`<div class="market-row"><div><b>${esc(x.player.name)}</b><small>${esc(x.sellerName)} · ${x.player.position} · ${x.player.rating} ALG · ${x.player.age} jaar</small></div><strong>${euro(x.price)}</strong>${x.sellerId===c.id?'<span class="sub">Jouw speler</span>':`<button class="primary" data-buy="${x.id}">Kopen</button>`}</div>`).join(""):'<p class="empty">Er staan momenteel geen spelers te koop. Zet een reserve te koop vanuit je spelerskern.</p>'}</section><section class="panel"><h2>Jouw reserves verkopen</h2><p class="sub">Je kan alleen spelers aanbieden die niet in je basiself staan.</p>${c.players.filter(p=>!p.starter).map(p=>`<div class="market-row"><div><b>${esc(p.name)}</b><small>${p.position} · ${p.rating} ALG</small></div><strong>${euro(p.value||p.rating*6000)}</strong><button class="secondary" data-list-player="${p.id}">Te koop zetten</button></div>`).join("")}</section>`;}
if(view==="youth"){const level=c.academyLevel||1;body=`<section class="panel"><h2>Jeugdopleiding</h2><div class="stats"><div><small>ACADEMY LEVEL</small><b>${level}</b></div><div><small>JEUGDREKRUTEN DIT SEIZOEN</small><b>${c.youthRecruitedSeason===world.season?1:0}/1</b></div></div><p>Jeugdspelers beginnen met een lager niveau, maar hebben groeipotentieel.</p><button class="primary" id="recruit-youth" ${c.youthRecruitedSeason===world.season?"disabled":""}>Rekruteer jeugdspeler · €25.000</button><p class="sub">Een jeugdspeler kost €25.000 en kan één keer per seizoen worden gerekruteerd.</p></section>`;}
if(view==="stadium"){const level=c.stadiumLevel||1,capacity=5000+level*2000,cost=100000*level;body=`<section class="panel"><h2>Stadionbeheer</h2><div class="stats"><div><small>STADIONNIVEAU</small><b>${level}</b></div><div><small>CAPACITEIT</small><b>${capacity.toLocaleString("nl-BE")}</b></div><div><small>INKOMSTEN PER SPEELDAG</small><b>${euro(c.stadiumIncome||8000)}</b></div></div><p>Een groter stadion verhoogt je inkomsten op wedstrijddagen.</p><button class="primary" id="upgrade-stadium" ${level>=10||c.balance<cost?"disabled":""}>Uitbreiden · ${euro(cost)}</button><p class="sub">Maximaal niveau 10. Je saldo: ${euro(c.balance||250000)}</p></section>`;}

if(view==="club"){body=`<section class="panel club-profile">${crest(c,true)}<div><h2>${esc(c.name)}</h2><p>${divName(c.division)} · Manager: ${esc(profile.email||"")}</p><p>${c.isBot?"Computerclub":"Persoonlijke club"}</p></div></section><section class="panel"><h2>Clubgegevens</h2><div class="detail"><span>Competitie</span><b>${divName(c.division)}</b></div><div class="detail"><span>Gespeeld</span><b>${c.played}</b></div><div class="detail"><span>Gewonnen / gelijk / verloren</span><b>${c.wins} / ${c.draws} / ${c.losses}</b></div><div class="detail"><span>Doelpunten</span><b>${c.gf} – ${c.ga}</b></div></section>`}
$("#app").innerHTML=`<div class="layout"><aside class="sidebar"><div class="brand"><b>FM</b><span>FOOTBALL MANAGER</span></div><div class="club-chip">${crest(c)}<div><b>${esc(c.name)}</b><small>${divName(c.division)}</small></div></div><nav>${nav.map(([id,label])=>`<button data-view="${id}" class="${view===id?"active":""}">${label}</button>`).join("")}</nav><div class="side-bottom"><small>INGELOGD ALS</small><b>${esc(profile.email||"")}</b><button id="logout" class="link">Uitloggen</button></div></aside><main class="main"><header class="topbar"><div><small>ONLINE COMPETITIE</small><h1>${nav.find(x=>x[0]===view)?.[1]||"Overzicht"}</h1></div><span class="season-tag">Seizoen ${world.season}</span></header>${message?'<div class="notice">'+esc(message)+'</div>':""}${body}<footer>FM · Online clubmanager</footer></main></div>`;
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{view=b.dataset.view;message="";render()});
$("#tactics-form")?.addEventListener("submit",async e=>{e.preventDefault();await saveClubPatch({tactics:Object.fromEntries(new FormData(e.currentTarget))},"Tactiek opgeslagen.")});
$("#training-form")?.addEventListener("submit",async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget)),key=world.season+"-"+world.matchday,cost={light:1000,normal:2500,intense:4000}[v.intensity];if(c.lastTrainingDate===key){notice("Je hebt deze speeldag al getraind.");return}if((c.balance||250000)<cost){notice("Onvoldoende saldo.");return}const focus={attack:["ATT"],midfield:["MID"],defence:["DEF"],goalkeeping:["GK"],balanced:["ATT","MID","DEF","GK"]}[v.focus],gain=v.intensity==="intense"?2:1,players=c.players.map(p=>({...p,rating:Math.min(99,p.rating+(focus.includes(p.position)&&p.rating<90?gain:0))}));await saveClubPatch({players,balance:(c.balance||250000)-cost,trainingBudget:cost,trainingFocus:v.focus,trainingIntensity:v.intensity,lastTrainingDate:key},"Training afgerond.")});

$("#lineup-form")?.addEventListener("submit",e=>e.preventDefault());
document.querySelectorAll("[data-renew]").forEach(b=>b.onclick=async()=>{const id=b.dataset.renew;try{await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref),w=snap.data(),i=w.clubs.findIndex(x=>x.ownerUid===user.uid),club=w.clubs[i],p=club.players.find(x=>x.id===id);if(!p)throw Error("Speler niet gevonden.");const fee=Math.max(1000,(p.wage||0)*4);if((club.balance||0)<fee)throw Error("Onvoldoende saldo voor contractverlenging.");if((p.contractYears||0)>=5)throw Error("Dit contract loopt al maximaal lang.");club.balance-=fee;p.contractYears=(p.contractYears||0)+1;p.wage=Math.round((p.wage||500)*1.05);tx.set(ref,w)});notice("Contract met één seizoen verlengd.")}catch(e){notice(e.message)}});
document.querySelectorAll("[data-starter]").forEach(b=>b.onclick=async()=>{const id=b.dataset.starter,players=c.players.map(p=>({...p,starter:p.id===id?!p.starter:p.starter})),count=players.filter(p=>p.starter).length;if(count>11){notice("Je mag maximaal 11 basisspelers kiezen.");return}await saveClubPatch({players},"Opstelling opgeslagen.")});
document.querySelectorAll("[data-list-player]").forEach(b=>b.onclick=async()=>{const id=b.dataset.listPlayer;try{await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref),w=snap.data(),idx=w.clubs.findIndex(x=>x.ownerUid===user.uid);if(idx<0)throw Error("Club niet gevonden.");const club=w.clubs[idx],pi=club.players.findIndex(p=>p.id===id);if(pi<0||club.players[pi].starter)throw Error("Deze speler kan niet verkocht worden.");const player=club.players.splice(pi,1)[0],market=w.market||[];if(market.some(x=>x.player.id===id))throw Error("Deze speler staat al te koop.");market.push({id:"listing-"+id,player,sellerId:club.id,sellerName:club.name,price:Math.max(10000,player.value||player.rating*6000)});w.market=market;tx.set(ref,w)});notice("Speler staat op de transfermarkt.")}catch(e){notice(e.message)}});
document.querySelectorAll("[data-buy]").forEach(b=>b.onclick=async()=>{const id=b.dataset.buy;try{await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref),w=snap.data(),buyerIndex=w.clubs.findIndex(x=>x.ownerUid===user.uid),buyer=w.clubs[buyerIndex],listingIndex=(w.market||[]).findIndex(x=>x.id===id);if(buyerIndex<0||listingIndex<0)throw Error("Deze aanbieding is niet meer beschikbaar.");const listing=w.market[listingIndex];if(listing.sellerId===buyer.id)throw Error("Je kan je eigen speler niet kopen.");if((buyer.balance||0)<listing.price)throw Error("Onvoldoende saldo.");const sellerIndex=w.clubs.findIndex(x=>x.id===listing.sellerId);if(sellerIndex<0)throw Error("Verkopende club bestaat niet meer.");buyer.balance-=listing.price;buyer.players.push({...listing.player,starter:false});w.clubs[sellerIndex].balance=(w.clubs[sellerIndex].balance||0)+listing.price;w.market.splice(listingIndex,1);tx.set(ref,w)});notice("Transfer afgerond!")}catch(e){notice(e.message)}});
$("#recruit-youth")?.addEventListener("click",async()=>{try{await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref),w=snap.data(),i=w.clubs.findIndex(x=>x.ownerUid===user.uid),club=w.clubs[i];if(club.youthRecruitedSeason===w.season)throw Error("Je hebt dit seizoen al een jeugdspeler gerekruteerd.");if((club.balance||0)<25000)throw Error("Onvoldoende saldo.");const n=(club.players||[]).length,positions=["GK","DEF","MID","ATT"],pos=positions[n%4],rating=42+(n*7%14),player={id:"youth-"+user.uid+"-"+w.season,name:["Sep","Milo","Rune","Otis","Lars","Jari","Nino","Bram"][n%8]+" "+["De Vos","Claes","Maes","Peeters","Willems","Jacobs"][n%6],position:pos,age:16,rating,stamina:100,morale:75,starter:false,wage:250,contractYears:3,value:rating*4000,potential:Math.min(99,rating+25)};club.balance-=25000;club.players.push(player);club.youthRecruitedSeason=w.season;tx.set(ref,w)});notice("Nieuwe jeugdspeler aangeworven.")}catch(e){notice(e.message)}});
$("#upgrade-stadium")?.addEventListener("click",async()=>{try{await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref),w=snap.data(),i=w.clubs.findIndex(x=>x.ownerUid===user.uid),club=w.clubs[i],level=club.stadiumLevel||1,cost=100000*level;if(level>=10)throw Error("Je stadion is al maximaal uitgebreid.");if((club.balance||0)<cost)throw Error("Onvoldoende saldo.");club.balance-=cost;club.stadiumLevel=level+1;club.stadiumIncome=(club.stadiumIncome||8000)+2500;tx.set(ref,w)});notice("Stadion succesvol uitgebreid.")}catch(e){notice(e.message)}});

$("#logout").onclick=()=>signOut(auth);
$("#start-day")?.addEventListener("click",async()=>{const b=$("#start-day");b.disabled=true;b.textContent="Starten…";try{await call("startMatchday")}catch(e){notice(e.message)}});
$("#finish-season")?.addEventListener("click",async()=>{const b=$("#finish-season");b.disabled=true;b.textContent="Play-off starten…";try{const r=await call("finishSeason");notice("Promotie-play-off gestart: "+r.data.home+" tegen "+r.data.away+". De wedstrijd duurt vijf minuten.")}catch(e){notice(e.message)}});$("#finish-new-season")?.addEventListener("click",async()=>{const b=$("#finish-new-season");b.disabled=true;b.textContent="Seizoen verwerken…";try{const r=await call("applySeasonResults");notice("Seizoen "+r.data.season+" gestart. Promotie: "+r.data.promoted.join(", ")+". Degradatie: "+r.data.relegated.join(", ")+". Play-offwinnaar: "+r.data.playoffWinner);view="leagues"}catch(e){notice(e.message)}});
}
onAuthStateChanged(auth,async u=>{user=u;profile=null;world=null;matches=[];unsubWorld?.();unsubMatches?.();if(!u){render();return}if((u.email||"").toLowerCase()!==ALLOWED_TEST_EMAIL){authError="Toegang geweigerd. Alleen vanherzeelematteo@gmail.com mag deze testversie gebruiken.";await signOut(auth);return}authError="";
const profileRef=doc(db,"testUsers",u.uid);
ensureWorldClient().catch(e=>console.error(e));unsubWorld=onSnapshot(doc(db,"testWorld","main"),s=>{world=s.exists()?s.data():null;render()},e=>notice(e.message));
unsubMatches=onSnapshot(collection(db,"testMatches"),s=>{matches=s.docs.map(d=>({id:d.id,...d.data()}));render()},e=>notice(e.message));
onSnapshot(profileRef,s=>{profile=s.exists()?s.data():null;render()},e=>notice(e.message));
});
