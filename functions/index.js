const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {onSchedule}=require("firebase-functions/v2/scheduler");
const admin=require("firebase-admin");
admin.initializeApp();
const db=admin.firestore(),FieldValue=admin.firestore.FieldValue;
const WORLD=db.doc("world/main"),MATCHES=db.collection("matches");
const DIVS=["first","secondA","secondB"];
const BOT_NAMES=["FC Noord","SV Rivierenland","Sporting Kempen","VV Heuvelrug","FC Havenstad","KSK Dennen","Union Dorp","SC Polder","VV Zilverbeek","FC Kanaal","Olympia Park","Racing Heide","KFC Meerzicht","SV Bosrand","FC Westhoek","VV Steenweg","Sportkring Zuid","FC Molen","KSK Horizon","Rode Ster","Blue Valley","Dynamo Oost","FC Grens","VV Centrum","Sporting Maas","FC Duin","KFC Veld","SV Linden","Union Waas","Dynamo Polder"];
const FIRST=["Milan","Noah","Lucas","Arthur","Liam","Mathis","Louis","Adam","Victor","Jules","Oscar","Finn","Ruben","Elias","Mats","Nolan","Simon","Tibo","Amir","Jonas"],LAST=["Peeters","Janssens","Maes","Jacobs","Willems","Claes","Goossens","Wouters","De Smet","Mertens","Dubois","Lambert","Martens","Michiels","De Wilde","Vermeulen","Pauwels","Dumont","Leclercq","De Backer"];
const rnd=(a)=>a[Math.floor(Math.random()*a.length)];
function players(seed){return Array.from({length:16},(_,i)=>({id:seed+"-"+i,name:FIRST[(seed.length+i*3)%FIRST.length]+" "+LAST[(seed.length*2+i*5)%LAST.length],position:["GK","DEF","DEF","DEF","DEF","MID","MID","MID","MID","ATT","ATT","ATT","DEF","MID","ATT","GK"][i],age:18+(i*7+seed.length)%17,rating:48+(i*13+seed.length*3)%35,stamina:100,morale:70,starter:i<11}))}
function bot(id,division,index){return{id,name:BOT_NAMES[index%BOT_NAMES.length],logo:"⚽",ownerUid:null,isBot:true,division,points:0,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,players:players(id)}}
function initialWorld(){let clubs=[];for(let i=0;i<30;i++){let division=i<10?"first":i<20?"secondA":"secondB";clubs.push(bot("bot-"+i,division,i))}return{season:1,matchday:1,phase:"regular",clubs,createdAt:Date.now()}}
async function ensureWorld(){await db.runTransaction(async tx=>{const s=await tx.get(WORLD);if(!s.exists)tx.create(WORLD,initialWorld())})}
function requireAuth(req){if(!req.auth)throw new HttpsError("unauthenticated","Log eerst in.");return req.auth.uid}
exports.createClub=onCall(async req=>{const uid=requireAuth(req),name=String(req.data?.name||"").trim(),logo=String(req.data?.logo||"⚽");if(name.length<3||name.length>28)throw new HttpsError("invalid-argument","De clubnaam moet 3 tot 28 tekens bevatten.");if(!["⚽","★","🛡️","◆","▲","✚","●","⚓"].includes(logo))throw new HttpsError("invalid-argument","Ongeldig embleem.");await ensureWorld();await db.runTransaction(async tx=>{const userRef=db.doc("users/"+uid),worldSnap=await tx.get(WORLD),userSnap=await tx.get(userRef);if(userSnap.exists)throw new HttpsError("already-exists","Je hebt al een club.");const w=worldSnap.data(),slot=w.clubs.find(c=>c.isBot&&c.division==="secondA")||w.clubs.find(c=>c.isBot&&c.division==="secondB");if(!slot)throw new HttpsError("resource-exhausted","Er is voorlopig geen vrije plaats.");const index=w.clubs.findIndex(c=>c.id===slot.id);const club={...slot,id:"club-"+uid,name,logo,ownerUid:uid,isBot:false,players:players(uid)};w.clubs[index]=club;tx.set(WORLD,w);tx.create(userRef,{uid,email:req.auth.token.email||"",clubId:club.id,clubName:name,createdAt:Date.now()})});return{ok:true})});
function scheduleRound(clubs,round){const result=[];for(const div of DIVS){let list=clubs.filter(c=>c.division===div).map(c=>c.id);if(list.length!==10)continue;for(let r=0;r<9;r++){let arr=list.slice();for(let n=0;n<r;n++){const last=arr.pop();arr.splice(1,0,last)}if(r===round){for(let i=0;i<5;i++){let home=arr[i],away=arr[9-i];if((round+i)%2)[home,away]=[away,home];result.push({homeId:home,awayId:away})}}}}return result}
exports.startMatchday=onCall(async req=>{const uid=requireAuth(req);await ensureWorld();return db.runTransaction(async tx=>{const ws=await tx.get(WORLD);const w=ws.data();if(w.phase!=="regular"||w.matchday>18)throw new HttpsError("failed-precondition","Het reguliere seizoen is afgelopen.");const me=w.clubs.find(c=>c.ownerUid===uid);if(!me)throw new HttpsError("permission-denied","Je hebt geen club.");const id="s"+w.season+"-d"+w.matchday;const refs=Array.from({length:15},(_,i)=>MATCHES.doc(id+"-"+i));const snaps=await Promise.all(refs.map(r=>tx.get(r)));if(snaps.some(s=>s.exists))throw new HttpsError("already-exists","Deze speeldag is al gestart.");const fixtures=scheduleRound(w.clubs,w.matchday-1);if(fixtures.length!==15)throw new HttpsError("failed-precondition","De competitie-indeling is niet volledig.");const now=Date.now();fixtures.forEach((f,i)=>tx.create(refs[i],{...f,id:refs[i].id,season:w.season,matchday:w.matchday,status:"live",elapsed:0,homeGoals:0,awayGoals:0,events:[{minute:0,text:"De wedstrijd is begonnen."}],startedAt:now}));w.phase="live";tx.set(WORLD,w);return{started:true,matchday:w.matchday}})});
function strength(c){return c.players.reduce((n,p)=>n+p.rating,0)/c.players.length}
exports.tickMatches=onSchedule({schedule:"every 1 minutes",timeZone:"Europe/Brussels",maxInstances:1},async()=>{const snap=await MATCHES.where("status","==","live").get();for(const docSnap of snap.docs){await db.runTransaction(async tx=>{const ms=await tx.get(docSnap.ref);if(!ms.exists||ms.data().status!=="live")return;const ws=await tx.get(WORLD);const w=ws.data(),m=ms.data(),h=w.clubs.find(c=>c.id===m.homeId),a=w.clubs.find(c=>c.id===m.awayId);if(!h||!a)return;const minute=m.elapsed+1,events=[...(m.events||[])];const chance=Math.random()<0.48;if(chance){const home=Math.random()<0.52,att=home?h:a,def=home?a:h;const goal=Math.random()<Math.max(.12,Math.min(.65,.25+(strength(att)-strength(def))/180));if(goal){if(home)m.homeGoals++;else m.awayGoals++;events.push({minute,text:"DOELPUNT! "+att.name+" scoort."})}else events.push({minute,text:att.name+" krijgt een kans."})}else if(minute===5)events.push({minute,text:"De scheidsrechter fluit af."});m.elapsed=minute;m.events=events.slice(-12);if(minute>=5){m.status="finished";for(const [c,gf,ga] of [[h,m.homeGoals,m.awayGoals],[a,m.awayGoals,m.homeGoals]]){c.played++;c.gf+=gf;c.ga+=ga;if(gf>ga){c.wins++;c.points+=3}else if(gf===ga){c.draws++;c.points++}else c.losses++}}tx.set(ms.ref,m);if(minute>=5)tx.set(WORLD,w)})}
const active=await MATCHES.where("status","==","live").get();if(active.empty){await db.runTransaction(async tx=>{const ws=await tx.get(WORLD);if(!ws.exists)return;const w=ws.data();if(w.phase==="live"){w.phase="regular";w.matchday++;if(w.matchday>18)w.phase="season-end";tx.set(WORLD,w)}})}});
function ranking(w,div){return w.clubs.filter(c=>c.division===div).sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.name.localeCompare(b.name))}
exports.finishSeason=onCall(async req=>{
 requireAuth(req);
 return db.runTransaction(async tx=>{
  const ws=await tx.get(WORLD),w=ws.data();
  if(w.phase!=="season-end")throw new HttpsError("failed-precondition","Speel eerst alle 18 speeldagen.");
  const first=ranking(w,"first"),a=ranking(w,"secondA"),b=ranking(w,"secondB");
  const playoffWinner=(strength(a[1])+(Math.random()*10))>(strength(b[1])+(Math.random()*10))?a[1]:b[1];
  const promoted=[a[0],b[0],playoffWinner],relegated=first.slice(-3);
  // Relegation fills the places vacated in each second division.
  const relegationForA=playoffWinner.division==="secondA"?2:1;
  relegated.forEach((club,i)=>club.division=i<relegationForA?"secondA":"secondB");
  for(const club of promoted)club.division="first";
  for(const c of w.clubs){
   c.points=0;c.played=0;c.wins=0;c.draws=0;c.losses=0;c.gf=0;c.ga=0;
  }
  w.season++;w.matchday=1;w.phase="regular";
  tx.set(WORLD,w);
  return{season:w.season,promoted:promoted.map(c=>c.name),relegated:relegated.map(c=>c.name),playoffWinner:playoffWinner.name};
 });
});
