import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, firebaseEnabled } from './firebase'
import type { Club, GameState, LeagueId, MatchEvent, MatchState, Player, Position } from './types'

const clubNames = ['Royal Antwerp FC','KRC Genk','Club Brugge','RSC Anderlecht','KAA Gent','Standard Luik','KV Mechelen','OH Leuven','Westerlo','Cercle Brugge','Beerschot','Charleroi','STVV','Kortrijk','Zulte Waregem','RWDM','Eupen','Lommel SK','Deinze','Patro Eisden','Dender','Beveren','Lierse','Lokeren','RFC Seraing','Francs Borains','Jong Genk','Club NXT','RSCA Futures','SL16 FC']
const firstNames = ['Milan','Noah','Lucas','Arthur','Liam','Mathis','Louis','Adam','Victor','Jules','Oscar','Finn','Ruben','Elias','Mats','Nolan','Simon','Tibo','Amir','Jonas']
const lastNames = ['Peeters','Janssens','Maes','Jacobs','Willems','Claes','Goossens','Wouters','De Smet','Mertens','Dubois','Lambert','Martens','Michiels','De Wilde','Vermeulen','Pauwels','Dumont','Leclercq','De Backer']
const leagues: {id:LeagueId;name:string}[] = [{id:'first',name:'Eerste Klasse'},{id:'secondA',name:'Tweede Klasse A'},{id:'secondB',name:'Tweede Klasse B'}]
const money = (n:number) => new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n)
const player = (i:number, club:number):Player => {
  const positions:Position[] = ['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','ATT','ATT','ATT','DEF','MID','ATT','GK']
  const position=positions[i]
  const rating=Math.max(42,Math.min(88,57+((club*7+i*11)%25)-Math.floor(club/5)))
  return {id:`p${club}-${i}`,name:`${firstNames[(club+i*3)%firstNames.length]} ${lastNames[(club*2+i*5)%lastNames.length]}`,age:18+((club*3+i*7)%16),position,rating,stamina:75+((i*7+club)%26),morale:65+((i*11+club)%31),value:rating*rating*850,wage:rating*95,goals:0,starter:i<11}
}
function createInitial():GameState {
  const clubs:Club[]=clubNames.map((name,i)=>{
    const league:LeagueId=i<10?'first':i<20?'secondA':'secondB'
    const isBot=i!==10
    return {id:`club-${i}`,name,league,isBot,manager:isBot?'Computer': 'Jij',points:0,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,cash:i===10?1_250_000:800_000,stadium:12000+((i*1731)%18000),players:Array.from({length:16},(_,j)=>player(j,i))}
  })
  return {season:1,clubId:'club-10',clubs,matchday:1,transferLog:['Welkom bij je nieuwe club!'],trainingLog:['Je spelers staan klaar voor de eerste training.']}
}
const sortTable=(clubs:Club[])=>[...clubs].sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.name.localeCompare(b.name))
const leagueName=(id:LeagueId)=>leagues.find(l=>l.id===id)?.name??id
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x))
const pick=(arr:string[])=>arr[Math.floor(Math.random()*arr.length)]
function App(){
  const [game,setGame]=useState<GameState>(()=>{try{const raw=localStorage.getItem('fm-save');return raw?JSON.parse(raw):createInitial()}catch{return createInitial()}})
  const [page,setPage]=useState('dashboard')
  const [match,setMatch]=useState<MatchState|null>(null)
  const [tab,setTab]=useState<LeagueId>('first')
  const [formation,setFormation]=useState('4-3-3')
  const [tactic,setTactic]=useState('Gebalanceerd')
  const [notice,setNotice]=useState('')
  const [user,setUser]=useState<{email:string;uid:string}|null>(null)
  const [authMode,setAuthMode]=useState<'login'|'register'>('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [authError,setAuthError]=useState('')
  const [authBusy,setAuthBusy]=useState(false)
  const [cloudReady,setCloudReady]=useState(false)
  const [clock,setClock]=useState(0)
  const club=game.clubs.find(c=>c.id===game.clubId)!
  const [selectedPlayer,setSelectedPlayer]=useState<string|null>(null)
  useEffect(()=>{localStorage.setItem('fm-save',JSON.stringify(game))},[game])
  useEffect(()=>{
    if(!auth)return
    return onAuthStateChanged(auth,async u=>{
      if(!u){setUser(null);setCloudReady(true);return}
      setUser({uid:u.uid,email:u.email??''})
      if(db){const ref=doc(db,'users',u.uid,'saves','main');const snap=await getDoc(ref);if(snap.exists())setGame(snap.data() as GameState);else await setDoc(ref,game)}
      setCloudReady(true)
    })
  },[])
  useEffect(()=>{
    if(!user||!db)return
    const t=setTimeout(()=>setDoc(doc(db,'users',user.uid,'saves','main'),game).catch(()=>setNotice('Cloudopslag mislukt. Je lokale save blijft bewaard.')),700)
    return ()=>clearTimeout(t)
  },[game,user])
  useEffect(()=>{
    if(!match||match.finished)return
    const timer=window.setInterval(()=>{
      setMatch(prev=>{
        if(!prev||prev.finished)return prev
        const elapsed=Math.min(90,prev.elapsed+0.3)
        const events=[...prev.events]
        if(Math.random()<0.035){
          const home=Math.random()<0.5
          const attacking=home?prev.homeId:prev.awayId
          const scoringClub=game.clubs.find(c=>c.id===attacking)
          const goal=Math.random()<(0.14+(tactic==='Aanvallend'?0.05:0))
          if(goal){events.push({minute:Math.ceil(elapsed),text:`GOAL! ${scoringClub?.name??'Team'} scoort!`,type:'goal'})}
          else events.push({minute:Math.ceil(elapsed),text:`${scoringClub?.name??'Team'} creëert een kans.`,type:'chance'})
          const next={...prev,elapsed,events,homeGoals:prev.homeGoals+(goal&&home?1:0),awayGoals:prev.awayGoals+(goal&&!home?1:0)}
          return elapsed>=90?finishMatch(next):next
        }
        const next={...prev,elapsed,events}
        return elapsed>=90?finishMatch(next):next
      })
    },1000)
    return ()=>window.clearInterval(timer)
  },[match?.startedAt,match?.finished,game.clubs,tactic])
  function finishMatch(m:MatchState):MatchState{
    const home=game.clubs.find(c=>c.id===m.homeId),away=game.clubs.find(c=>c.id===m.awayId)
    if(home&&away){
      setGame(g=>({...g,matchday:g.matchday+1,lastPlayedAt:Date.now(),clubs:g.clubs.map(c=>{
        if(c.id!==home.id&&c.id!==away.id)return c
        const isHome=c.id===home.id, gf=isHome?m.homeGoals:m.awayGoals,ga=isHome?m.awayGoals:m.homeGoals
        const win=gf>ga,draw=gf===ga
        return {...c,played:c.played+1,wins:c.wins+(win?1:0),draws:c.draws+(draw?1:0),losses:c.losses+(!win&&!draw?1:0),points:c.points+(win?3:draw?1:0),gf:c.gf+gf,ga:c.ga+ga}
      })}))
    }
    return {...m,elapsed:90,finished:true,events:[...m.events,{minute:90,text:'Einde van de wedstrijd!',type:'info'}]}
  }
  function startMatch(){
    const opponent=sortTable(game.clubs.filter(c=>c.league===club.league&&c.id!==club.id))[Math.floor(Math.random()*9)]
    setMatch({homeId:club.id,awayId:opponent.id,startedAt:Date.now(),elapsed:0,homeGoals:0,awayGoals:0,events:[{minute:0,text:'De wedstrijd begint!',type:'info'}],finished:false})
    setPage('match')
  }
  function train(){
    const updated=clone(game)
    const my=updated.clubs.find(c=>c.id===club.id)!
    const eligible=my.players.filter(p=>p.stamina>30)
    const p=eligible[Math.floor(Math.random()*eligible.length)]
    if(!p)return
    p.rating=Math.min(99,p.rating+(Math.random()<0.35?1:0))
    p.stamina=Math.max(25,p.stamina-12)
    p.morale=Math.min(100,p.morale+3)
    updated.trainingLog=[`${p.name} trainde vandaag. Beoordeling: ${p.rating}`,...updated.trainingLog].slice(0,12)
    setGame(updated);setNotice(`Training afgerond: ${p.name} heeft getraind.`)
  }
  function buyPlayer(p:Player){
    if(club.cash<p.value){setNotice('Je hebt niet genoeg geld voor deze speler.');return}
    setGame(g=>({...g,clubs:g.clubs.map(c=>c.id===club.id?{...c,cash:c.cash-p.value,players:[...c.players,{...p,id:`new-${Date.now()}`,starter:false}]}:c),transferLog:[`Je kocht ${p.name} voor ${money(p.value)}.`,...g.transferLog]}))
    setNotice(`${p.name} is aangetrokken!`)
  }
  function sellPlayer(id:string){
    const p=club.players.find(x=>x.id===id);if(!p)return
    setGame(g=>({...g,clubs:g.clubs.map(c=>c.id===club.id?{...c,cash:c.cash+Math.round(p.value*.7),players:c.players.filter(x=>x.id!==id)}:c),transferLog:[`Je verkocht ${p.name}.`,...g.transferLog]}))
    setSelectedPlayer(null);setNotice('Speler verkocht voor 70% van zijn marktwaarde.')
  }
  function toggleStarter(id:string){
    setGame(g=>({...g,clubs:g.clubs.map(c=>c.id===club.id?{...c,players:c.players.map(p=>p.id===id?{...p,starter:!p.starter}:p)}:c)}))
  }
  function upgradeStadium(){
    const cost=250000
    if(club.cash<cost){setNotice('Onvoldoende geld voor een stadionuitbreiding.');return}
    setGame(g=>({...g,clubs:g.clubs.map(c=>c.id===club.id?{...c,cash:c.cash-cost,stadium:c.stadium+2000}:c)}));setNotice('Je stadion werd uitgebreid met 2.000 plaatsen.')
  }
  function endSeason(){
    const first=sortTable(game.clubs.filter(c=>c.league==='first'))
    const a=sortTable(game.clubs.filter(c=>c.league==='secondA'))
    const b=sortTable(game.clubs.filter(c=>c.league==='secondB'))
    const bots=first.filter(c=>c.isBot).sort((x,y)=>sortTable(first).findIndex(c=>c.id===y.id)-sortTable(first).findIndex(c=>c.id===x.id))
    const relegated=new Set<string>()
    if(bots.length>=4)bots.slice(0,3).forEach(c=>relegated.add(c.id))
    else {
      bots.forEach(c=>relegated.add(c.id))
      for(const c of [...first].reverse())if(relegated.size<3&&!c.isBot)relegated.add(c.id)
    }
    const promoted=[a[0],b[0]]
    const playoffWinner=Math.random()<0.5?a[1]:b[1]
    promoted.push(playoffWinner)
    const promotedIds=new Set(promoted.map(c=>c.id))
    const available=game.clubs.filter(c=>c.league!=='first'&&!promotedIds.has(c.id)).sort((x,y)=>y.points-x.points)
    const newFirst=game.clubs.map(c=>({...c,league:relegated.has(c.id)?(Math.random()<.5?'secondA':'secondB'):promotedIds.has(c.id)?'first':c.league,points:0,played:0,wins:0,draws:0,losses:0,gf:0,ga:0}))
    const currentFirstCount=newFirst.filter(c=>c.league==='first').length
    const candidates=available.filter(c=>!relegated.has(c.id))
    for(const c of candidates){if(newFirst.filter(x=>x.league==='first').length>=10)break;c.league='first'}
    // Normalize second divisions back to ten clubs each.
    const firstNow=newFirst.filter(c=>c.league==='first')
    const secondA=newFirst.filter(c=>c.league==='secondA'),secondB=newFirst.filter(c=>c.league==='secondB')
    while(secondA.length>10){const c=secondA.pop()!;c.league='secondB';}
    while(secondB.length>10){const c=secondB.pop()!;c.league='secondA';}
    while(secondA.length<10){const c=firstNow.find(x=>x.league==='first'&&!promotedIds.has(x.id));if(!c)break;c.league='secondA';}
    setGame(g=>({...g,season:g.season+1,matchday:1,clubs:newFirst,transferLog:[`Seizoen ${g.season} afgerond. Promotieplay-off gewonnen door ${playoffWinner.name}.`,...g.transferLog]}))
    setNotice(`Nieuw seizoen gestart. Promovendi: ${promoted.map(c=>c.name).join(', ')}. Play-off: ${playoffWinner.name}.`)
  }
  const market=useMemo(()=>Array.from({length:8},(_,i)=>{const p=player(i+5,30+i);return {...p,id:`market-${i}`,name:`${pick(firstNames)} ${pick(lastNames)}`,value:Math.round(p.value*.8)}}),[game.season])
  const nav=[['dashboard','Overzicht'],['league','Competities'],['squad','Selectie'],['tactics','Tactiek'],['training','Training'],['transfers','Transfers'],['club','Club & financiën']]
  const selected=club.players.find(p=>p.id===selectedPlayer)
  const avg=Math.round(club.players.reduce((n,p)=>n+p.rating,0)/club.players.length)
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">FM</div><div><b>FOOTBALL MANAGER</b><small>JOUW CLUB. JOUW VERHAAL.</small></div></div>
      <div className="club-mini"><div className="club-crest">⚽</div><div><b>{club.name}</b><small>{leagueName(club.league)} · Seizoen {game.season}</small></div></div>
      <div className="nav-label">MANAGER</div>{nav.map(([id,label])=><button key={id} className={page===id?'nav-item active':'nav-item'} onClick={()=>setPage(id)}><span>{({dashboard:'⌂',league:'▤',squad:'♙',tactics:'⚙',training:'↗',transfers:'⇄',club:'▦'} as Record<string,string>)[id]}</span>{label}</button>)}
      <div className="sidebar-bottom"><div className="online-dot"/> DEMO-OMGEVING <small>{firebaseEnabled?'Firebase beschikbaar':'Lokale opslag actief'}</small><button className="quiet-button" onClick={()=>{if(auth)signOut(auth);setUser(null)}}>{user?'Uitloggen':'Account niet gekoppeld'}</button></div>
    </aside>
    <main className="main"><header className="topbar"><div><span className="eyebrow">SEIZOEN {game.season} · SPEELDAG {game.matchday}</span><h1>{nav.find(n=>n[0]===page)?.[1]??'Wedstrijd'}</h1></div><div className="top-actions"><div className="top-stat"><small>CLUBKAS</small><b>{money(club.cash)}</b></div><div className="avatar">{club.name.slice(0,1)}</div></div></header>
      {notice&&<div className="notice" onClick={()=>setNotice('')}>{notice}<button>×</button></div>}
      {page==='dashboard'&&<><section className="hero"><div className="hero-copy"><span className="pill">MANAGER DASHBOARD</span><h2>Welkom terug,<br/><em>{club.name}</em></h2><p>Het volgende fluitsignaal wacht. Maak je ploeg klaar en schrijf geschiedenis.</p><button className="primary" onClick={startMatch}>Start volgende wedstrijd <span>→</span></button></div><div className="hero-ball">⚽</div><div className="hero-season">S{game.season}<small>JOUW SEIZOEN</small></div></section>
        <div className="stat-grid"><Stat label="COMPETITIEPUNTEN" value={club.points.toString()} hint={`${club.played} wedstrijden gespeeld`} icon="◈"/><Stat label="CLUBRATING" value={avg.toString()} hint="Gemiddelde spelersrating" icon="✦"/><Stat label="STADION" value={club.stadium.toLocaleString('nl-BE')} hint="Beschikbare plaatsen" icon="⌂"/><Stat label="CLUBKAS" value={money(club.cash)} hint="Beschikbaar budget" icon="€"/></div>
        <div className="content-grid"><section className="panel"><PanelTitle title="Competitiestand" action="Volledig klassement →" onClick={()=>setPage('league')}/><LeagueTable clubs={sortTable(game.clubs.filter(c=>c.league===club.league)).slice(0,5)} current={club.id}/></section><section className="panel next-panel"><PanelTitle title="Volgende wedstrijd"/><div className="versus"><div className="team"><div className="team-badge">🟢</div><b>{club.name}</b><small>THUIS</small></div><div className="vs">VS</div><div className="team"><div className="team-badge away">⚽</div><b>{sortTable(game.clubs.filter(c=>c.league===club.league&&c.id!==club.id))[0]?.name}</b><small>UIT</small></div></div><div className="match-meta"><span>◷ 5 MINUTEN</span><span>◉ SPEELDAG {game.matchday}</span></div><button className="primary full" onClick={startMatch}>Wedstrijd spelen →</button></section></div>
        <div className="content-grid lower"><section className="panel"><PanelTitle title="Laatste clubnieuws"/>{game.transferLog.slice(0,3).map((x,i)=><div className="feed" key={i}><span className="feed-icon">✦</span><p>{x}</p><small>RECENT</small></div>)}</section><section className="panel"><PanelTitle title="Snelle acties"/><div className="quick-actions"><button onClick={()=>setPage('squad')}>♙ <span>Opstelling beheren</span> →</button><button onClick={()=>setPage('training')}>↗ <span>Training starten</span> →</button><button onClick={()=>setPage('transfers')}>⇄ <span>Transfermarkt bekijken</span> →</button></div></section></div></>}
      {page==='league'&&<section className="panel"><PanelTitle title="De competities" subtitle="30 clubs · 3 reeksen · promotie en degradatie"/><div className="tabs">{leagues.map(l=><button className={tab===l.id?'tab active':'tab'} onClick={()=>setTab(l.id)}>{l.name}</button>)}</div><LeagueTable clubs={sortTable(game.clubs.filter(c=>c.league===tab))} current={club.id} full/><div className="rules"><b>SEIZOENSEINDE</b><p>Eerste Klasse: de drie degradatieplaatsen worden bepaald door de botregel. Tweede Klasse A en B: de kampioenen promoveren rechtstreeks. De nummers 2 spelen een beslissingswedstrijd om het derde ticket.</p><button className="secondary" onClick={endSeason}>Simuleer seizoenseinde (test)</button></div></section>}
      {page==='squad'&&<div className="content-grid"><section className="panel wide"><PanelTitle title="Spelerskern" subtitle={`${club.players.length} spelers · gemiddelde rating ${avg}`}/><div className="player-list">{club.players.map(p=><div className={selectedPlayer===p.id?'player-row chosen':'player-row'} key={p.id} onClick={()=>setSelectedPlayer(p.id)}><div className="player-position">{p.position}</div><div className="player-main"><b>{p.name}</b><small>{p.age} jaar · {p.stamina}% fitheid</small></div><div className="player-rating">{p.rating}</div><div className="player-value">{money(p.value)}</div><button className={p.starter?'starter on':'starter'} onClick={e=>{e.stopPropagation();toggleStarter(p.id)}}>{p.starter?'BASIS':'RESERVE'}</button></div>)}</div></section><section className="panel"><PanelTitle title="Spelerdetails"/>{selected?<><div className="detail-rating">{selected.rating}<small>RATING</small></div><h3>{selected.name}</h3><p className="muted">{selected.position} · {selected.age} jaar</p><div className="detail-line"><span>Fitheid</span><b>{selected.stamina}%</b></div><div className="detail-line"><span>Moraal</span><b>{selected.morale}%</b></div><div className="detail-line"><span>Marktwaarde</span><b>{money(selected.value)}</b></div><button className="secondary full" onClick={()=>sellPlayer(selected.id)}>Speler verkopen</button></>:<p className="muted">Selecteer een speler om details te bekijken.</p>}</section></div>}
      {page==='tactics'&&<section className="panel"><PanelTitle title="Tactiek en opstelling" subtitle="Stel je speelstijl en basiselftal in."/><div className="tactics-layout"><div><label>FORMATIE</label><div className="choice-grid">{['4-3-3','4-4-2','3-5-2','5-3-2'].map(x=><button className={formation===x?'choice selected':'choice'} onClick={()=>setFormation(x)}>{x}</button>)}</div><label>SPEELSTIJL</label><div className="choice-grid">{['Gebalanceerd','Aanvallend','Verdedigend','Counter'].map(x=><button className={tactic===x?'choice selected':'choice'} onClick={()=>setTactic(x)}>{x}</button>)}</div><div className="tactic-note">Je gekozen tactiek beïnvloedt de kansen tijdens de wedstrijdsimulatie.</div></div><div className="pitch"><div className="pitch-lines"/><div className="pitch-label">JOUW OPSTELLING</div><div className="formation">{club.players.filter(p=>p.starter).slice(0,11).map((p,i)=><div className="pitch-player" key={p.id}><b>{p.position}</b><small>{p.name.split(' ')[0]}</small></div>)}</div></div></div></section>}
      {page==='training'&&<div className="content-grid"><section className="panel"><PanelTitle title="Trainingscentrum" subtitle="Werk aan de ontwikkeling van je spelers."/><div className="training-card"><div className="training-symbol">↗</div><h2>Teamtraining</h2><p>Een speler wordt willekeurig geselecteerd. Training verbetert soms de rating en verhoogt het moraal, maar kost fitheid.</p><button className="primary" onClick={train}>Start training →</button></div></section><section className="panel"><PanelTitle title="Trainingslog"/>{game.trainingLog.map((x,i)=><div className="feed" key={i}><span className="feed-icon">↗</span><p>{x}</p></div>)}</section></div>}
      {page==='transfers'&&<section className="panel"><PanelTitle title="Transfermarkt" subtitle="Ontdek spelers die je ploeg kunnen versterken."/><div className="market-grid">{market.map(p=><div className="market-card" key={p.id}><div className="market-avatar">{p.position}</div><b>{p.name}</b><small>{p.age} jaar · Rating {p.rating}</small><strong>{money(p.value)}</strong><button className="secondary full" onClick={()=>buyPlayer(p)}>Aankopen</button></div>)}</div><div className="rules"><b>RECENTE TRANSFERS</b>{game.transferLog.map((x,i)=><p key={i}>{x}</p>)}</div></section>}
      {page==='club'&&<div className="content-grid"><section className="panel"><PanelTitle title="Clubfinanciën"/><div className="finance-total">{money(club.cash)}<small>HUIDIGE CLUBKAS</small></div><div className="detail-line"><span>Geschatte lonen per speeldag</span><b>{money(club.players.reduce((n,p)=>n+p.wage,0))}</b></div><div className="detail-line"><span>Stadioncapaciteit</span><b>{club.stadium.toLocaleString('nl-BE')}</b></div><div className="detail-line"><span>Gemiddelde ticketprijs</span><b>€ 18</b></div></section><section className="panel"><PanelTitle title="Stadionbeheer"/><div className="stadium-art">🏟️</div><h3>{club.name} Arena</h3><p className="muted">Breid je stadion uit om meer supporters te ontvangen bij thuiswedstrijden.</p><button className="primary full" onClick={upgradeStadium}>+2.000 plaatsen · € 250.000</button></section></div>}
      {page==='match'&&match&&<section className="panel match-screen"><PanelTitle title="Live wedstrijd" subtitle={match.finished?'Wedstrijd afgelopen':'De wedstrijd is bezig...'}/><div className="scoreboard"><div><small>THUIS</small><h2>{game.clubs.find(c=>c.id===match.homeId)?.name}</h2></div><div className="score">{match.homeGoals} - {match.awayGoals}<small>{Math.min(90,Math.floor(match.elapsed))}'</small></div><div><small>UIT</small><h2>{game.clubs.find(c=>c.id===match.awayId)?.name}</h2></div></div><div className="progress"><div style={{width:`${match.elapsed/90*100}%`}}/></div><div className="match-clock">{Math.floor(match.elapsed/90*5)}:{String(Math.floor((match.elapsed/90*5%1)*60)).padStart(2,'0')} <small>WEDSTRIJDTIJD · 5 MINUTEN</small></div><div className="events">{[...match.events].reverse().map((e,i)=><div className={`event ${e.type}`} key={i}><b>{e.minute}'</b><span>{e.text}</span></div>)}</div>{match.finished?<button className="primary full" onClick={()=>{setMatch(null);setPage('dashboard')}}>Terug naar overzicht</button>:<p className="muted center">De wedstrijd loopt automatisch. Laat dit scherm open tot het laatste fluitsignaal.</p>}</section>}
      <footer>FOOTBALL MANAGER <span>·</span> PROTOTYPE 0.1 <span>·</span> GEBOUWD VOOR DE TOEKOMST</footer>
    </main>
    {!user&&firebaseEnabled&&<div className="auth-float"><span>☁ Firebase</span><button onClick={()=>{const el=document.getElementById('auth-modal');el?.classList.add('show')}}>Inloggen / registreren</button></div>}
    <div className="modal" id="auth-modal"><div className="modal-card"><button className="modal-close" onClick={()=>document.getElementById('auth-modal')?.classList.remove('show')}>×</button><h2>{authMode==='login'?'Welkom terug':'Account aanmaken'}</h2><p>Bewaar je club op je eigen account.</p><input placeholder="E-mailadres" value={email} onChange={e=>setEmail(e.target.value)}/><input placeholder="Wachtwoord (min. 6 tekens)" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>{authError&&<p className="error">{authError}</p>}<button className="primary full" disabled={authBusy} onClick={async()=>{if(!auth)return;setAuthBusy(true);setAuthError('');try{const result=authMode==='login'?await signInWithEmailAndPassword(auth,email,password):await createUserWithEmailAndPassword(auth,email,password);setUser({uid:result.user.uid,email:result.user.email??''});document.getElementById('auth-modal')?.classList.remove('show')}catch(e){setAuthError(e instanceof Error?e.message:'Inloggen mislukt')}finally{setAuthBusy(false)}}}>{authBusy?'Even wachten...':authMode==='login'?'Inloggen':'Registreren'}</button><button className="text-button" onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>{authMode==='login'?'Nog geen account? Registreren':'Al een account? Inloggen'}</button></div></div>
  </div>
}
function Stat({label,value,hint,icon}:{label:string;value:string;hint:string;icon:string}){return <div className="stat-card"><div className="stat-icon">{icon}</div><small>{label}</small><b>{value}</b><span>{hint}</span></div>}
function PanelTitle({title,subtitle,action,onClick}:{title:string;subtitle?:string;action?:string;onClick?:()=>void}){return <div className="panel-title"><div><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div>{action&&<button onClick={onClick}>{action}</button>}</div>}
function LeagueTable({clubs,current,full=false}:{clubs:Club[];current:string;full?:boolean}){return <div className="table-wrap"><table><thead><tr><th>#</th><th>CLUB</th><th>GS</th><th>W</th><th>G</th><th>V</th><th>DS</th><th>PT</th></tr></thead><tbody>{clubs.map((c,i)=><tr className={c.id===current?'my-row':''} key={c.id}><td><span className={i<2?'rank-top':i>=clubs.length-3?'rank-low':'rank'}>{i+1}</span></td><td><b>{c.name}</b>{c.isBot&&<small className="bot-tag"> BOT</small>}{c.id===current&&<small className="you-tag"> JIJ</small>}</td><td>{c.played}</td><td>{c.wins}</td><td>{c.draws}</td><td>{c.losses}</td><td>{c.gf-c.ga}</td><td><b>{c.points}</b></td></tr>)}</tbody></table></div>}
export default App
