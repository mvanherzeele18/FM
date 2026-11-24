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
function playerValue(p){const r=Math.max(1,p.rating||1),age=p.age||24;return Math.round(r*r*18*(age>30?Math.max(.55,1-(age-30)*.035):age<22?1.12:1))}function playerWage(p){const r=p.rating||40;return Math.round(90+r*8+(r>75?(r-75)*18:0))}function normalizePlayer(p){const n={...p,value:playerValue(p),wage:playerWage(p),potential:p.potential??Math.min(99,(p.rating||40)+8)};delete n.contractYears;return n}function createNpcMarket(){const names=["Daan Verhoeven","Mats De Clercq","Jules Martens","Nino Jacobs","Lars Peeters","Milan Wouters","Otis Maes","Rune Claes","Bram Goossens","Sep Willems","Noah Lambert","Finn De Smet","Arthur Dubois","Tibo Vermeulen"];return Array.from({length:10},(_,i)=>{const rating=48+Math.floor(Math.random()*25),age=18+Math.floor(Math.random()*13),p=normalizePlayer({id:"npc-"+Date.now()+"-"+i,name:names[(i+Math.floor(Math.random()*names.length))%names.length],position:["GK","DEF","MID","ATT"][Math.floor(Math.random()*4)],age,rating,stamina:100,morale:70,starter:false,potential:Math.min(99,rating+5+Math.floor(Math.random()*20))});return{id:"npc-listing-"+Date.now()+"-"+i,player:p,sellerId:"npc-market",sellerName:"Vrije spelersmarkt",sellerType:"npc",price:Math.round(p.value*(1.05+Math.random()*.2))}})}
function blankWorld(){const clubs=[];for(let i=0;i<30;i++)clubs.push(newBot("bot-"+i,i<10?"first":i<20?"secondA":"secondB",i));return{season:1,matchday:1,phase:"regular",clubs,market:createNpcMarket(),marketSeeded:true,financeModelVersion:2,createdAt:Date.now()}}
async function ensureWorldClient(){await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref);if(!snap.exists()){tx.set(ref,blankWorld());return}const w=snap.data();if(w.financeModelVersion===2&&w.marketSeeded)return;for(const club of w.clubs||[]){club.players=(club.players||[]).map(normalizePlayer);club.sponsorIncome=12000;club.stadiumIncome=6000;club.weeklyWages=club.players.reduce((sum,p)=>sum+p.wage,0);club.trainingBudget=0}w.market=w.market||[];if(!w.marketSeeded){w.market.push(...createNpcMarket());w.marketSeeded=true}w.financeModelVersion=2;tx.set(ref,w)})}
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
function seededRandom(seed){
  let h=2166136261;
  for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  let state=h>>>0;
  return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
}
function simulateFixture(fixture,clubs,season,matchday,type="regular"){
  const home=clubs.find(c=>c.id===fixture.homeId),away=clubs.find(c=>c.id===fixture.awayId);
  if(!home||!away)throw Error("Een ploeg uit de wedstrijd bestaat niet.");
  const match={...fixture,season,matchday,type};
  const h={...home,tactics:{...(home.tactics||{})}},a={...away,tactics:{...(away.tactics||{})}};
  setBotMatchTactics(h,match);setBotMatchTactics(a,match);
  const random=seededRandom(season+"-"+matchday+"-"+fixture.homeId+"-"+fixture.awayId+"-"+type);
  // Meer stadionplaatsen betekent meer thuisfans en een groter thuisvoordeel.
  const homeCapacity=5000+Math.max(1,Number(home.stadiumLevel)||1)*2000;
  const homeCrowdBoost=Math.min(0.035,homeCapacity/50000*0.035);
  const homeMatchStrength=strength(h)*(1+homeCrowdBoost);
  const awayMatchStrength=strength(a);
  let homeGoals=0,awayGoals=0;
  const events=[{minute:0,text:type==="playoff"?"De promotie-play-off begint.":"De wedstrijd is begonnen.",kind:"start"}];
  for(let minute=1;minute<=90;minute++){
    if(random()<.10){
      const isHome=random()<.52,att=isHome?h:a,def=isHome?a:h,t=att.tactics||{};
      const opponentTactics=def.tactics||{};
      const attackBonus=(t.mentality==="attacking"?.055:t.mentality==="defensive"?-.045:0)+(t.passing==="direct"?.018:t.passing==="short"?.008:0);
      // Hoge pressing kan korte opbouw verstoren; lage pressing geeft ruimte aan directe passing.
      const matchupBonus=(t.pressing==="high"&&opponentTactics.passing==="short"?.025:0)+(t.pressing==="low"&&opponentTactics.passing==="direct"?.012:0)-(opponentTactics.pressing==="high"&&t.passing==="short"?.018:0);
      const attackingStrength=isHome?homeMatchStrength:awayMatchStrength;
      const defendingStrength=isHome?awayMatchStrength:homeMatchStrength;
      const goalChance=Math.max(.18,Math.min(.58,.32+(attackingStrength-defendingStrength)/150+attackBonus+matchupBonus));
      if(random()<goalChance){
        if(isHome)homeGoals++;else awayGoals++;
        events.push({minute,text:"DOELPUNT! "+att.name+" scoort.",kind:"goal",teamId:att.id});
      }else events.push({minute,text:att.name+" krijgt een kans.",kind:"chance"});
    }
    if(minute>=8&&random()<.012)events.push({minute,text:(random()<.5?h:a).name+" krijgt geel.",kind:"yellow"});
    if(minute>=20&&minute<=80&&random()<.0015)events.push({minute,text:(random()<.5?h:a).name+" krijgt rood.",kind:"red"});
    if([60,70,80].includes(minute)&&random()<.34)events.push({minute,text:(random()<.5?h:a).name+" voert een wissel door.",kind:"substitution"});
  }
  let penaltyScore=null,winnerId=null;
  if(type==="playoff"){
    if(homeGoals===awayGoals){
      let hp=0,ap=0;
      for(let kick=0;kick<5;kick++){if(random()<.72)hp++;if(random()<.72)ap++}
      let sudden=0;
      while(hp===ap&&sudden<20){if(random()<.72)hp++;if(random()<.72)ap++;sudden++}
      if(hp===ap){if(random()<.5)hp++;else ap++}
      penaltyScore={home:hp,away:ap};
      events.push({minute:90,text:"Strafschoppen: "+h.name+" "+hp+" – "+ap+" "+a.name+".",kind:"penalties"});
    }
    winnerId=homeGoals>awayGoals?h.id:awayGoals>homeGoals?a.id:penaltyScore.home>penaltyScore.away?h.id:a.id;
    events.push({minute:90,text:"Promotie voor "+clubs.find(c=>c.id===winnerId).name+"!",kind:"result"});
  }
  return {...fixture,id:null,season,matchday,type,status:"precomputed",elapsed:0,homeGoals:0,awayGoals:0,finalHomeGoals:homeGoals,finalAwayGoals:awayGoals,penaltyScore,winnerId,events,startedAt:Date.now(),durationMs:300000};
}
function matchProgress(m){
  const elapsed=Math.max(0,Math.min(90,Math.floor((Date.now()-(m.startedAt||Date.now()))/((m.durationMs||300000)/90))));
  const visibleEvents=(m.events||[]).filter(e=>e.minute<=elapsed);
  const homeGoals=visibleEvents.filter(e=>e.kind==="goal"&&e.teamId===m.homeId).length;
  const awayGoals=visibleEvents.filter(e=>e.kind==="goal"&&e.teamId===m.awayId).length;
  return {...m,elapsed,homeGoals,awayGoals,status:elapsed>=90?"finished":"live",events:visibleEvents};
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
        players: makePlayers(user.uid).map((p,index)=>normalizePlayer({...p,potential:Math.min(99,p.rating+8+(index%8))})),
        tactics: { formation: "4-3-3", mentality: "balanced", pressing: "normal", passing: "mixed" },
        trainingFocus: "balanced",
        trainingIntensity: "normal",
        balance: 250000,
        sponsorIncome: 12000,
        stadiumIncome: 6000,
        weeklyWages: 0,
        trainingBudget: 0,
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
      const startedAt = Date.now();
      const precomputed = fixtures.map((fixture,i)=>({...simulateFixture(fixture,w.clubs,w.season,w.matchday),id:refs[i].id,startedAt}));
      precomputed.forEach((match,i)=>tx.set(refs[i],match));
      w.phase = "live";
      w.matchdayStartedAt = startedAt;
      tx.set(worldRef, w);
      result = { started: true, matchday: w.matchday, matches: precomputed.length };
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
      const startedAt = Date.now();
      const match = {...simulateFixture({homeId:a[1].id,awayId:b[1].id},w.clubs,w.season,19,"playoff"),id,startedAt};
      w.phase = "playoff";
      w.playoff = { homeId: a[1].id, awayId: b[1].id };
      w.playoffStartedAt = startedAt;
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
async function tickClientMatches(){
  if(!user||tickBusy||!world)return;
  const now=Date.now();
  if(world.phase==="live"){
    const prefix="s"+world.season+"-d"+world.matchday+"-";
    const day=matches.filter(m=>String(m.id).startsWith(prefix));
    if(day.length!==15||day.some(m=>now<(m.startedAt||now)+(m.durationMs||300000)))return;
  }else if(world.phase==="playoff"){
    const playoff=matches.find(m=>m.id==="s"+world.season+"-playoff");
    if(!playoff||now<(playoff.startedAt||now)+(playoff.durationMs||300000))return;
  }else return;
  tickBusy=true;
  try{
    await runTransaction(db,async tx=>{
      const ws=await tx.get(worldRefClient);
      if(!ws.exists())return;
      const w=ws.data();
      if(w.phase==="live"){
        const prefix="s"+w.season+"-d"+w.matchday+"-";
        const refs=Array.from({length:15},(_,i)=>doc(db,"testMatches",prefix+i));
        const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
        if(snaps.some(x=>!x.exists()))return;
        const day=snaps.map(x=>x.data());
        if(day.some(m=>now<(m.startedAt||now)+(m.durationMs||300000)))return;
        for(const m of day){
          const h=w.clubs.find(c=>c.id===m.homeId),a=w.clubs.find(c=>c.id===m.awayId);
          if(!h||!a)continue;
          const hg=Number(m.finalHomeGoals||0),ag=Number(m.finalAwayGoals||0);
          for(const [club,gf,ga] of [[h,hg,ag],[a,ag,hg]]){
            club.played++;club.gf+=gf;club.ga+=ga;
            if(gf>ga){club.wins++;club.points+=3}else if(gf===ga){club.draws++;club.points++}else club.losses++;
          }
          for(const club of [h,a]){const wages=(club.players||[]).reduce((sum,p)=>sum+playerWage(p),0),sponsor=club.sponsorIncome??12000,gate=club===h?(club.stadiumIncome??6000):0;club.balance=(club.balance??250000)+sponsor+gate-wages;club.weeklyWages=wages;club.lastFinanceMatchday=m.matchday}
        }
        w.phase="regular";w.matchday++;delete w.matchdayStartedAt;
        if(w.matchday>18)w.phase="season-end";
        tx.set(worldRefClient,w);
      }else if(w.phase==="playoff"){
        const ref=doc(db,"testMatches","s"+w.season+"-playoff"),snap=await tx.get(ref);
        if(!snap.exists())return;
        const m=snap.data();
        if(now<(m.startedAt||now)+(m.durationMs||300000))return;
        if(!m.winnerId)return;
        w.playoffWinnerId=m.winnerId;w.phase="playoff-finished";delete w.playoffStartedAt;
        tx.set(worldRefClient,w);
      }
    });
  }catch(e){console.error("Wedstrijddag afronden:",e)}
  finally{tickBusy=false}
}
const worldRefClient=doc(db,"testWorld","main"),simLockRef=doc(db,"testWorld","matchSimulationLock"),simOwnerId="tab-"+Math.random().toString(36).slice(2);let tickBusy=false;
setInterval(()=>{if(world&&(world.phase==="live"||world.phase==="playoff"))render();tickClientMatches()},1000);

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
function liveMatches(){const day=world?.phase==="regular"&&world.matchday>1?world.matchday-1:world?.phase==="season-end"?18:world?.matchday;return matches.filter(m=>m.season===world?.season&&m.matchday===day).map(matchProgress)}
function matchCard(raw){const m=raw.status==="precomputed"?matchProgress(raw):raw,h=world.clubs.find(c=>c.id===m.homeId),a=world.clubs.find(c=>c.id===m.awayId);if(!h||!a)return"";return `<article class="match-card ${m.status}"><div class="match-team">${crest(h)}<b>${esc(h.name)}</b></div><div class="match-score"><strong>${m.homeGoals} – ${m.awayGoals}</strong><small>${m.status==="finished"?"FT":m.elapsed+"’ / 90’"}</small>${m.status==="finished"&&m.penaltyScore?'<small>Strafschoppen '+m.penaltyScore.home+' – '+m.penaltyScore.away+'</small>':""}</div><div class="match-team away">${crest(a)}<b>${esc(a.name)}</b></div><div class="match-events">${(m.events||[]).slice(-3).map(e=>`<p><b>${e.minute}’</b> ${esc(e.text)}</p>`).join("")}</div></article>`}
function render(){if(!user)return authScreen();if(!profile)return onboarding();if(!world){$("#app").innerHTML='<div class="loading">Competitie laden…</div>';return}const c=myClub();if(c){c.market=world.market||[];c.stadiumLevel=c.stadiumLevel||1;c.academyLevel=c.academyLevel||1;c.balance=c.balance??250000;c.players=(c.players||[]).map(normalizePlayer);}if(!c){$("#app").innerHTML='<div class="loading">Je club wordt gekoppeld…</div>';return}
const nav=[["home","Overzicht"],["leagues","Competities"],["matches","Wedstrijden"],["squad","Spelers"],["tactics","Tactieken"],["training","Training"],["market","Transfermarkt"],["stadium","Stadion"],["finance","Financiën"],["club","Clubbeheer"]];
let body="";
const myMatch=liveMatches().find(m=>m.homeId===c.id||m.awayId===c.id);const playoffMatch=matches.find(m=>m.id==="s"+world.season+"-playoff");const showPlayoff=["playoff","playoff-finished"].includes(world.phase)?playoffMatch:null;const otherFinished=liveMatches().filter(m=>m.status==="precomputed"?matchProgress(m).status==="finished":m.status==="finished").map(m=>m.status==="precomputed"?matchProgress(m):m).filter(m=>m.id!==myMatch?.id);
if(view==="home"){body=`<section class="welcome"><div><small>SEIZOEN ${world.season} · SPEELDAG ${world.matchday}/18</small><h1>${esc(c.name)}</h1><p>${divName(c.division)} · ${c.isBot?"Computerclub":"Jouw club"}</p></div>${crest(c,true)}</section><section class="stats"><div><small>PUNTEN</small><b>${c.points}</b></div><div><small>GESPEELD</small><b>${c.played}</b></div><div><small>DOELSALDO</small><b>${c.gf-c.ga}</b></div><div><small>SEIZOEN</small><b>${world.season}</b></div></section><section class="panel"><div class="panel-head"><div><h2>Speeldag ${world.matchday}</h2><p>Start hier de wedstrijden van deze speeldag.</p></div>${world.phase==="season-end"?'<button class="primary" id="finish-season">Start promotie-play-off</button>':world.phase==="playoff-finished"?'<button class="primary" id="finish-new-season">Nieuw Seizoen</button>':world.phase==="regular"&&world.matchday<=18?'<button class="primary" id="start-day">Speeldag starten</button>':world.phase==="live"?'<button class="secondary" disabled>Speeldag bezig…</button>':'<span class="sub">Geen speeldag beschikbaar · status: '+esc(world.phase)+'</span>'}</div>${showPlayoff?matchCard(showPlayoff):myMatch?matchCard(myMatch):'<p class="empty">Klik op “Speeldag starten” wanneer jij klaar bent. De wedstrijden duren ongeveer vijf echte minuten.</p>'}</section><section class="panel"><div class="panel-head"><div><h2>${divName(c.division)}</h2><p>Jouw huidige klasse</p></div></div>${table(c.division)}</section>`}
if(view==="leagues"){body=`<section class="panel"><h2>Afgewerkte uitslagen</h2>${otherFinished.length?otherFinished.map(matchCard).join(""):'<p class="empty">Andere uitslagen verschijnen na afloop.</p>'}</section><section class="panel"><h2>Eerste Klasse</h2><p class="sub">10 clubs · De laatste drie degraderen rechtstreeks.</p>${table("first")}</section><section class="panel"><h2>Tweede Klasse A</h2><p class="sub">De kampioen promoveert. De nummer twee speelt een promotiewedstrijd.</p>${table("secondA")}</section><section class="panel"><h2>Tweede Klasse B</h2><p class="sub">De kampioen promoveert. De nummer twee speelt een promotiewedstrijd.</p>${table("secondB")}</section><section class="panel"><h2>Promotie en degradatie</h2><p>De drie laatste clubs uit Eerste Klasse degraderen. De kampioenen van Tweede Klasse A en B promoveren rechtstreeks. De nummers twee spelen één beslissende wedstrijd om het derde promotieticket.</p><p>Computerclubs die op een degradatieplaats eindigen, degraderen ook. Daardoor kan het aantal menselijke clubs dat zakt lager zijn.</p></section>`}
if(view==="matches"){const showMatch=showPlayoff||myMatch;body=`<section class="panel"><div class="panel-head"><div><h2>${["playoff","playoff-finished"].includes(world.phase)?"Promotie-play-off":"Mijn wedstrijd · Speeldag "+world.matchday}</h2><p class="sub">${showPlayoff?"De promotie-play-off wordt voor iedereen getoond.":"Alleen jouw eigen wedstrijd wordt getoond."}</p></div>${world.phase==="regular"&&world.matchday<=18?'<button class="primary" id="start-day">Speeldag starten</button>':world.phase==="live"?'<span class="season-tag">Speeldag bezig</span>':""}</div>${showMatch?matchCard(showMatch):world.phase==="regular"?'<p class="empty">Er is nog geen wedstrijd gestart. Klik op “Speeldag starten” om alle wedstrijden te beginnen.</p>':'<p class="empty">Er is momenteel geen wedstrijd beschikbaar.</p>'}</section>`}
if(view==="tactics"){const t=c.tactics||{mentality:"balanced",pressing:"normal",passing:"mixed"},starters=c.players.filter(p=>p.starter),slots=[{id:"ATT-L",line:"ATT",label:"LA"},{id:"ATT-C",line:"ATT",label:"SP"},{id:"ATT-R",line:"ATT",label:"RA"},{id:"MID-L",line:"MID",label:"LM"},{id:"MID-LC",line:"MID",label:"LCM"},{id:"MID-C",line:"MID",label:"CM"},{id:"MID-RC",line:"MID",label:"RCM"},{id:"MID-R",line:"MID",label:"RM"},{id:"DEF-L",line:"DEF",label:"LB"},{id:"DEF-LC",line:"DEF",label:"LCV"},{id:"DEF-C",line:"DEF",label:"CV"},{id:"DEF-RC",line:"DEF",label:"RCV"},{id:"DEF-R",line:"DEF",label:"RB"},{id:"GK",line:"GK",label:"GK"}],legacy=starters.filter(p=>!p.lineupSlot),used=new Set(starters.filter(p=>p.lineupSlot).map(p=>p.lineupSlot));for(const line of ["GK","DEF","MID","ATT"]){const available=slots.filter(x=>x.line===line&&!used.has(x.id));legacy.filter(p=>p.position===line).forEach((p,i)=>{if(available[i])p.lineupSlot=available[i].id})}const placed=slots.map(slot=>({slot,player:starters.find(p=>p.lineupSlot===slot.id)||null})),counts=Object.fromEntries(["GK","DEF","MID","ATT"].map(pos=>[pos,starters.filter(p=>p.position===pos).length])),formation=starters.length===11&&counts.GK===1&&counts.DEF>=3&&counts.DEF<=5&&counts.MID>=3&&counts.MID<=5&&counts.ATT>=1&&counts.ATT<=3?String(counts.DEF)+"-"+counts.MID+"-"+counts.ATT:"Opstelling ongeldig";body=`<section class="panel"><div class="panel-head"><div><h2>Jouw opstelling</h2><p>Sleep een wisselspeler op een bezette plek om hem rechtstreeks te wisselen.</p></div><span class="season-tag">${formation}</span></div><form id="tactics-form" class="game-form"><label>Mentaliteit<select name="mentality"><option value="defensive" ${t.mentality==="defensive"?"selected":""}>Verdedigend</option><option value="balanced" ${t.mentality==="balanced"?"selected":""}>Gebalanceerd</option><option value="attacking" ${t.mentality==="attacking"?"selected":""}>Aanvallend</option></select></label><label>Pressing<select name="pressing"><option value="low" ${t.pressing==="low"?"selected":""}>Laag</option><option value="normal" ${t.pressing==="normal"?"selected":""}>Normaal</option><option value="high" ${t.pressing==="high"?"selected":""}>Hoog</option></select></label><label>Passing<select name="passing"><option value="short" ${t.passing==="short"?"selected":""}>Kort</option><option value="mixed" ${t.passing==="mixed"?"selected":""}>Gemengd</option><option value="direct" ${t.passing==="direct"?"selected":""}>Direct</option></select></label><button class="primary">Tactiek opslaan</button></form><div class="tactics-pitch tactics-pitch-board tactics-slot-board"><div class="slot-line attack-line"><strong>AANVAL</strong><div class="slot-row">${placed.filter(x=>x.slot.line==="ATT").map(({slot,player})=>slotMarkup(slot,player)).join("")}</div></div><div class="slot-line midfield-line"><strong>MIDDENVELD</strong><div class="slot-row">${placed.filter(x=>x.slot.line==="MID").map(({slot,player})=>slotMarkup(slot,player)).join("")}</div></div><div class="slot-line defence-line"><strong>VERDEDIGING</strong><div class="slot-row">${placed.filter(x=>x.slot.line==="DEF").map(({slot,player})=>slotMarkup(slot,player)).join("")}</div></div><div class="slot-line keeper-line"><strong>DOEL</strong><div class="slot-row">${placed.filter(x=>x.slot.line==="GK").map(({slot,player})=>slotMarkup(slot,player)).join("")}</div></div></div><section class="reserve-drag" data-drop-slot="RES"><h3>Wisselspelers · sleep op een speler om te wisselen</h3>${c.players.filter(p=>!p.starter).map(p=>`<div class="pitch-player reserve-player" draggable="true" data-drag-player="${p.id}"><b>${esc(p.name)}</b><small>${p.position} · ${p.rating} ALG</small></div>`).join("")||'<span class="sub">Geen wisselspelers</span>'}</section><p class="sub">Regels: 1 keeper · 3–5 verdedigers · 3–5 middenvelders · 1–3 aanvallers · exact 11 spelers.</p></section>`;function slotMarkup(slot,player){return `<div class="pitch-slot ${player?"occupied":""}" data-drop-slot="${slot.id}"><span class="slot-position">${slot.label}</span>${player?`<div class="pitch-player" draggable="true" data-drag-player="${player.id}"><b>${esc(player.name)}</b><span class="rating-bubble">${player.rating}</span><small>${slot.label} · ALG</small></div>`:'<span class="empty-slot">+</span>'}</div>`}}if(view==="training"){body=`<section class="panel"><h2>Trainingscentrum</h2><form id="training-form" class="game-form"><p class="sub">Alle spelers trainen gebalanceerd.</p><button class="primary">Training uitvoeren</button></form><h3>Spelerskern</h3>${(c.players||[]).map(p=>`<div class="detail"><span>${esc(p.name)} · ${p.position} · ${p.age} jaar</span><b>${p.rating} ALG</b></div>`).join("")}</section>`}
if(view==="finance"){body=`<section class="panel"><h2>Clubfinanciën</h2><div class="finance-balance"><small>HUIDIG SALDO</small><strong>${euro(c.balance??250000)}</strong></div><div class="detail"><span>Hoofdsponsor per speeldag</span><b>+${euro(c.sponsorIncome??12000)}</b></div><div class="detail"><span>Stadioninkomsten</span><b>+${euro(c.stadiumIncome??6000)}</b></div><div class="detail"><span>Spelerslonen per speeldag</span><b>−${euro((c.players||[]).reduce((sum,p)=>sum+playerWage(p),0))}</b></div><div class="detail"><span>Training</span><b>Gratis</b></div><p class="sub">Salarissen worden één keer per speeldag aangerekend. Sponsorinkomsten komen elke speeldag binnen; stadioninkomsten alleen bij een thuiswedstrijd.</p></section>`}

if(view==="squad"){body=`<section class="panel"><div class="panel-head"><div><h2>Spelerskern</h2><p>${c.players.length} spelers · Stel je basiself samen bij Tactieken.</p></div></div><div class="player-list"><div class="player-row player-head"><b>Speler</b><b>Pos.</b><b>ALG</b><b>Leeftijd</b><b>Waarde</b><b>Loon / speeldag</b></div>${c.players.map(p=>`<div class="player-row"><span><b>${esc(p.name)}</b><small>Potentieel \u00b7 ${p.potential||Math.min(99,p.rating+8)} ALG</small></span><span>${p.position}</span><b>${p.rating}</b><span>${p.age}</span><span>${euro(p.value)}</span><span>${euro(p.wage)}</span><button class="secondary" data-release="${p.id}">Ontbind · ${euro(Math.max(500,playerWage(p)*8))}</button></div>`).join("")}</div></section>`;}
if(view==="market"){const market=world.market||[];body=`<section class="panel"><h2>Transfermarkt</h2><p class="sub">Koop spelers van fictieve clubs en de vrije spelersmarkt. NPC-aanbiedingen worden automatisch aangevuld.</p>${market.length?market.map(x=>`<div class="market-row"><div><b>${esc(x.player.name)}</b><small>${esc(x.sellerName)} · ${x.player.position} · ${x.player.rating} ALG · ${x.player.age} jaar</small></div><strong>${euro(x.price)}</strong>${x.sellerId===c.id?'<span class="sub">Jouw speler</span>':`<button class="primary" data-buy="${x.id}">Kopen</button>`}</div>`).join(""):'<p class="empty">De transfermarkt wordt automatisch gevuld met spelers van fictieve clubs.</p>'}</section><section class="panel"><h2>Jouw reserves verkopen</h2><p class="sub">Je kan alleen spelers aanbieden die niet in je basiself staan.</p>${c.players.filter(p=>!p.starter).map(p=>`<div class="market-row"><div><b>${esc(p.name)}</b><small>${p.position} · ${p.rating} ALG</small></div><strong>${euro(p.value||p.rating*6000)}</strong><button class="secondary" data-list-player="${p.id}">Te koop zetten</button></div>`).join("")}</section>`;}
if(view==="youth"){const level=c.academyLevel||1;body=`<section class="panel"><h2>Jeugdopleiding</h2><div class="stats"><div><small>ACADEMY LEVEL</small><b>${level}</b></div><div><small>JEUGDREKRUTEN DIT SEIZOEN</small><b>${c.youthRecruitedSeason===world.season?1:0}/1</b></div></div><p>Jeugdspelers beginnen met een lager niveau, maar hebben groeipotentieel.</p><button class="primary" id="recruit-youth" ${c.youthRecruitedSeason===world.season?"disabled":""}>Rekruteer jeugdspeler · €25.000</button><p class="sub">Een jeugdspeler kost €25.000 en kan één keer per seizoen worden gerekruteerd.</p></section>`;}
if(view==="stadium"){const level=c.stadiumLevel||1,capacity=5000+level*2000,cost=100000*level,homeBoost=Math.min(3.5,capacity/50000*3.5);body=`<section class="panel"><h2>Stadionbeheer</h2><div class="stats"><div><small>STADIONNIVEAU</small><b>${level}</b></div><div><small>CAPACITEIT</small><b>${capacity.toLocaleString("nl-BE")}</b></div><div><small>INKOMSTEN PER SPEELDAG</small><b>${euro(c.stadiumIncome??6000)}</b></div></div><p>Een groter stadion brengt meer inkomsten op en geeft je ploeg meer thuisvoordeel dankzij extra thuisfans.</p><div class="detail"><span>Thuisvoordeel bij volle capaciteit</span><b>+${homeBoost.toFixed(1).replace(".",",")}%</b></div><button class="primary" id="upgrade-stadium" ${level>=10||c.balance<cost?"disabled":""}>Uitbreiden · ${euro(cost)}</button><p class="sub">Maximaal niveau 10. Je saldo: ${euro(c.balance??250000)}</p></section>`;}

if(view==="club"){body=`<section class="panel club-profile">${crest(c,true)}<div><h2>${esc(c.name)}</h2><p>${divName(c.division)} · Manager: ${esc(profile.email||"")}</p><p>Clubbeheer en kerngegevens</p></div></section><section class="panel"><h2>Sportieve status</h2><div class="detail"><span>Competitiepositie</span><b>${standings(c.division).findIndex(x=>x.id===c.id)+1} / 10</b></div><div class="detail"><span>Gespeeld</span><b>${c.played}</b></div><div class="detail"><span>Gewonnen / gelijk / verloren</span><b>${c.wins} / ${c.draws} / ${c.losses}</b></div><div class="detail"><span>Doelpunten</span><b>${c.gf} – ${c.ga}</b></div><div class="detail"><span>Stadionniveau</span><b>${c.stadiumLevel||1}</b></div><div class="detail"><span>Spelers in kern</span><b>${c.players.length}</b></div></section>`}
$("#app").innerHTML=`<div class="layout"><aside class="sidebar"><div class="brand"><b>FM</b><span>FOOTBALL MANAGER</span></div><div class="club-chip">${crest(c)}<div><b>${esc(c.name)}</b><small>${divName(c.division)}</small></div></div><nav>${nav.map(([id,label])=>`<button data-view="${id}" class="${view===id?"active":""}">${label}</button>`).join("")}</nav><div class="side-bottom"><small>INGELOGD ALS</small><b>${esc(profile.email||"")}</b><button id="logout" class="link">Uitloggen</button></div></aside><main class="main"><header class="topbar"><div><small>ONLINE COMPETITIE</small><h1>${nav.find(x=>x[0]===view)?.[1]||"Overzicht"}</h1></div><span class="season-tag">Seizoen ${world.season}</span></header>${message?'<div class="notice">'+esc(message)+'</div>':""}${body}<footer>FM · Online clubmanager</footer></main></div>`;
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{view=b.dataset.view;message="";render()});
$("#tactics-form")?.addEventListener("submit",async e=>{e.preventDefault();await saveClubPatch({tactics:Object.fromEntries(new FormData(e.currentTarget))},"Tactiek opgeslagen.")});document.querySelectorAll("[data-drag-player]").forEach(el=>el.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/plain",el.dataset.dragPlayer);el.classList.add("dragging")}));document.querySelectorAll("[data-drop-slot]").forEach(slotEl=>{slotEl.addEventListener("dragover",e=>{e.preventDefault();slotEl.classList.add("drop-hover")});slotEl.addEventListener("dragleave",()=>slotEl.classList.remove("drop-hover"));slotEl.addEventListener("drop",async e=>{e.preventDefault();slotEl.classList.remove("drop-hover");const id=e.dataTransfer.getData("text/plain"),target=slotEl.dataset.dropSlot,dragged=c.players.find(p=>p.id===id);if(!dragged)return;const slotInfo={"GK":{line:"GK"},"DEF-L":{line:"DEF"},"DEF-LC":{line:"DEF"},"DEF-C":{line:"DEF"},"DEF-RC":{line:"DEF"},"DEF-R":{line:"DEF"},"MID-L":{line:"MID"},"MID-LC":{line:"MID"},"MID-C":{line:"MID"},"MID-RC":{line:"MID"},"MID-R":{line:"MID"},"ATT-L":{line:"ATT"},"ATT-C":{line:"ATT"},"ATT-R":{line:"ATT"}},targetLine=slotInfo[target]?.line;if(target==="RES"){notice("Wissels maak je door een reserve op een speler op het veld te slepen.");return}if(!targetLine)return;const occupant=c.players.find(p=>p.starter&&p.lineupSlot===target&&p.id!==id),players=c.players.map(p=>({...p})),incoming=players.find(p=>p.id===id);if(occupant){if(!incoming.starter){const outgoing=players.find(p=>p.id===occupant.id);outgoing.starter=false;delete outgoing.lineupSlot;incoming.starter=true;incoming.lineupSlot=target;incoming.position=targetLine}else{const outgoing=players.find(p=>p.id===occupant.id),oldSlot=incoming.lineupSlot;outgoing.lineupSlot=oldSlot;outgoing.position=slotInfo[oldSlot]?.line||outgoing.position;incoming.lineupSlot=target;incoming.position=targetLine}}else{if(incoming.starter&&incoming.lineupSlot){const other=players.find(p=>p.starter&&p.lineupSlot===target);if(other)other.lineupSlot=incoming.lineupSlot}incoming.starter=true;incoming.lineupSlot=target;incoming.position=targetLine}const starters=players.filter(p=>p.starter),counts={GK:starters.filter(p=>p.position==="GK").length,DEF:starters.filter(p=>p.position==="DEF").length,MID:starters.filter(p=>p.position==="MID").length,ATT:starters.filter(p=>p.position==="ATT").length};if(starters.length!==11){notice("Je basiself moet uit exact 11 spelers bestaan. Wissel door op een bezette plek te droppen.");return}if(counts.GK!==1){notice("Er moet precies één keeper in doel staan.");return}if(counts.DEF<3||counts.DEF>5){notice("Je moet 3 tot 5 verdedigers opstellen.");return}if(counts.MID<3||counts.MID>5){notice("Je moet 3 tot 5 middenvelders opstellen.");return}if(counts.ATT<1||counts.ATT>3){notice("Je moet 1 tot 3 aanvallers opstellen.");return}await saveClubPatch({players},"Opstelling en wissel opgeslagen.")})});$("#training-form")?.addEventListener("submit",async e=>{e.preventDefault();const key=world.season+"-"+world.matchday;if(c.lastTrainingDate===key){notice("Je hebt deze speeldag al getraind.");return}const players=c.players.map(p=>{let rating=p.rating;if(rating<(p.potential||rating+8)&&Math.random()<.12)rating=Math.min(p.potential||99,rating+1);return normalizePlayer({...p,rating})});await saveClubPatch({players,trainingBudget:0,trainingFocus:"balanced",lastTrainingDate:key},"Gebalanceerde training uitgevoerd.")});


document.querySelectorAll("[data-release]").forEach(b=>b.onclick=async()=>{const id=b.dataset.release;try{await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref),w=snap.data(),club=w.clubs.find(x=>x.ownerUid===user.uid),pi=club.players.findIndex(x=>x.id===id);if(pi<0)throw Error("Speler niet gevonden.");const p=club.players[pi],fee=Math.max(500,playerWage(p)*8);if((club.balance??250000)<fee)throw Error("Onvoldoende saldo om het contract te ontbinden. Kosten: "+euro(fee));club.balance-=fee;club.players.splice(pi,1);if(club.players.filter(x=>x.starter).length<11){const reserve=club.players.find(x=>!x.starter);if(reserve)reserve.starter=true}tx.set(ref,w)});notice("Contract ontbonden. De speler verlaat de club.")}catch(e){notice(e.message)}});

document.querySelectorAll("[data-list-player]").forEach(b=>b.onclick=async()=>{const id=b.dataset.listPlayer;try{await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref),w=snap.data(),idx=w.clubs.findIndex(x=>x.ownerUid===user.uid);if(idx<0)throw Error("Club niet gevonden.");const club=w.clubs[idx],pi=club.players.findIndex(p=>p.id===id);if(pi<0||club.players[pi].starter)throw Error("Deze speler kan niet verkocht worden.");const player=club.players.splice(pi,1)[0],market=w.market||[];if(market.some(x=>x.player.id===id))throw Error("Deze speler staat al te koop.");market.push({id:"listing-"+id,player,sellerId:club.id,sellerName:club.name,price:Math.max(5000,playerValue(player))});w.market=market;tx.set(ref,w)});notice("Speler staat op de transfermarkt.")}catch(e){notice(e.message)}});
document.querySelectorAll("[data-buy]").forEach(b=>b.onclick=async()=>{const id=b.dataset.buy;try{await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref),w=snap.data(),buyerIndex=w.clubs.findIndex(x=>x.ownerUid===user.uid),buyer=w.clubs[buyerIndex],listingIndex=(w.market||[]).findIndex(x=>x.id===id);if(buyerIndex<0||listingIndex<0)throw Error("Deze aanbieding is niet meer beschikbaar.");const listing=w.market[listingIndex];if(listing.sellerId===buyer.id)throw Error("Je kan je eigen speler niet kopen.");if((buyer.balance||0)<listing.price)throw Error("Onvoldoende saldo.");const sellerIndex=w.clubs.findIndex(x=>x.id===listing.sellerId);buyer.balance-=listing.price;buyer.players.push(normalizePlayer({...listing.player,starter:false}));if(listing.sellerType!=="npc"&&sellerIndex>=0)w.clubs[sellerIndex].balance=(w.clubs[sellerIndex].balance||0)+listing.price;w.market.splice(listingIndex,1);while(w.market.filter(x=>x.sellerType==="npc").length<10)w.market.push(...createNpcMarket());tx.set(ref,w)});notice("Transfer afgerond!")}catch(e){notice(e.message)}});
$("#recruit-youth")?.addEventListener("click",async()=>{try{await runTransaction(db,async tx=>{const ref=doc(db,"testWorld","main"),snap=await tx.get(ref),w=snap.data(),i=w.clubs.findIndex(x=>x.ownerUid===user.uid),club=w.clubs[i];if(club.youthRecruitedSeason===w.season)throw Error("Je hebt dit seizoen al een jeugdspeler gerekruteerd.");if((club.balance||0)<25000)throw Error("Onvoldoende saldo.");const n=(club.players||[]).length,positions=["GK","DEF","MID","ATT"],pos=positions[n%4],rating=42+(n*7%14),player={id:"youth-"+user.uid+"-"+w.season,name:["Sep","Milo","Rune","Otis","Lars","Jari","Nino","Bram"][n%8]+" "+["De Vos","Claes","Maes","Peeters","Willems","Jacobs"][n%6],...normalizePlayer({id:"youth-"+user.uid+"-"+w.season,name:["Sep","Milo","Rune","Otis","Lars","Jari","Nino","Bram"][n%8]+" "+["De Vos","Claes","Maes","Peeters","Willems","Jacobs"][n%6],position:pos,age:16,rating,stamina:100,morale:75,starter:false,potential:Math.min(99,rating+25)})};club.balance-=25000;club.players.push(player);club.youthRecruitedSeason=w.season;tx.set(ref,w)});notice("Nieuwe jeugdspeler aangeworven.")}catch(e){notice(e.message)}});
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
