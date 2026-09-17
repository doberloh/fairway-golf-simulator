import {puttingConfig,awardedPutts} from './putting.js';
export class Round{
 constructor({players=[{name:'Alex',team:'A',hand:'RH'}],mode='stroke',holes=9,gimme=0,putting,tee='blue',endless=false,seed=''}={}){
  if(!Array.isArray(players)||players.length<1||players.length>4)throw Error('Choose 1–4 players.');
  if(!['stroke','match','scramble'].includes(mode)||![3,9,18].includes(holes)||!Number.isFinite(gimme)||gimme<0||gimme>3)throw Error('Invalid round settings.');
  if(!players.every(p=>p&&typeof p.name==='string'&&p.name.length<=24&&['A','B'].includes(p.team)))throw Error('Invalid player.');
  if(mode==='match'&&new Set(players.map(p=>p.team)).size!==2)throw Error('Match play needs players on both teams.');
  if(endless&&mode==='match')throw Error('Match play needs a last hole, so it cannot run endlessly.');
  if(typeof seed!=='string'||seed.length>40)throw Error('Invalid round seed.');
  if(!['blue','white','red'].includes(tee))throw Error('Invalid tee selection.');this.tee=tee;
  this.players=players.map((p,i)=>({...p,id:i}));this.mode=mode;this.holes=holes;this.gimme=gimme;this.hole=0;this.finished=false;this.endless=!!endless;this.seed=seed;this.pars=[];
  this.putting=puttingConfig(putting);this.history=[];this.puttCards=players.map(()=>[]);this.cards=players.map(()=>[]);this.teamCards={A:[],B:[]};this.match={A:0,B:0};this.beginHole();
 }
 beginHole(){this.teePlaced=false;this.puttStrokes=this.players.map(()=>0);this.teamPutts={A:0,B:0};this.positions=this.players.map(()=>({x:0,z:0}));this.strokes=this.players.map(()=>0);this.done=this.players.map(()=>false);this.holeComplete=false;this.candidates=[];this.scrambleSelection=false;this.scrambleShots={A:0,B:0};
  // HONOURS. Who plays first is a rule of golf, not the order the names were
  // typed in: lowest score on the previous hole tees off first, and the rest
  // follow in the order they scored. The group's own order decides the first
  // tee, because nobody has a score to be ranked by yet.
  this.order=this.honoursOrder();this.active=this.order[0];}
 // The playing order for THIS hole, from the previous hole's cards.
 //
 // Ties keep the order they already had -- `sort` is stable, so two golfers who
 // both made four stay in the order they stood in, which is what a group does
 // rather than reshuffling itself for no reason. A golfer with no score for that
 // hole (one who joined mid-round) goes to the back rather than to the front,
 // which is where an undefined score would sort them.
 honoursOrder(){
  const previous=this.hole-1;
  const ids=this.players.map(p=>p.id);
  const base=Array.isArray(this.order)&&this.order.length===ids.length&&ids.every(id=>this.order.includes(id))?this.order.slice():ids;
  if(previous<0)return ids;
  return base.slice().sort((a,b)=>{
   const sa=this.cards[a]?.[previous],sb=this.cards[b]?.[previous];
   const fa=Number.isFinite(sa),fb=Number.isFinite(sb);
   if(fa&&fb)return sa-sb;
   if(fa!==fb)return fa?-1:1;
   return 0;
  });
 }
 // The next golfer who has not holed out, IN PLAYING ORDER. -1 when everyone is
 // in, which is what tells the caller the hole is over.
 nextInOrder(){const id=(this.order||this.players.map(p=>p.id)).find(i=>!this.done[i]);return id===undefined?-1:id;}
 placeTee(tees){if(this.teePlaced)return;const name=tees[this.tee]?this.tee:Object.keys(tees)[0],t=tees[name];this.tee=name;this.positions=this.players.map(()=>({x:t.x,z:t.z}));this.teePlaced=true;}
 // Change the group WITHOUT restarting. Every per-player array is resized in
 // step, matched by position: a golfer who stays keeps their scorecard, their
 // strokes on this hole and where their ball is sitting.
 //
 // A golfer who JOINS mid-round starts from the tee with nothing behind them.
 // Their earlier holes stay empty rather than being invented -- `cards` is
 // indexed by hole and the scorecard already guards every cell with
 // `Number.isFinite`, so a missing hole reads as not played, which is the truth.
 //
 // A golfer who LEAVES takes their card with them. That is what removing
 // somebody means, and it is why the button asks on a round in progress.
 setPlayers(next,tees){
  if(!Array.isArray(next)||next.length<1||next.length>4)throw Error('Choose 1–4 players.');
  if(!next.every(p=>p&&typeof p.name==='string'&&p.name.length<=24&&['A','B'].includes(p.team)))throw Error('Invalid player.');
  if(this.mode==='match'&&new Set(next.map(p=>p.team)).size!==2)throw Error('Match play needs players on both teams.');
  const tee=tees&&tees[this.tee];
  // WHICH SEAT EACH GOLFER CAME FROM. `seat` is the id they held before the
  // edit; a golfer who has just been added has none.
  //
  // This used to resize by LENGTH -- slot `i` kept slot `i`, and the arrays were
  // simply truncated from the end. So removing the first of two golfers deleted
  // the SECOND one's card and handed the first one's strokes, ball and scorecard
  // to whoever was left, under the remaining name. The editor removes by
  // identity and this has to match it, or "remove Alex" removes Bo's round and
  // calls the result Bo.
  const before=this.players.length,wasActive=this.active;
  const from=next.map(p=>Number.isInteger(p.seat)&&p.seat>=0&&p.seat<before?p.seat:-1);
  const take=(arr,make)=>from.map(seat=>seat<0?make():arr[seat]);
  this.cards=take(this.cards,()=>[]);
  this.puttCards=take(this.puttCards,()=>[]);
  this.strokes=take(this.strokes,()=>0);
  this.puttStrokes=take(this.puttStrokes,()=>0);
  this.done=take(this.done,()=>false);
  this.positions=take(this.positions,()=>tee?{x:tee.x,z:tee.z}:{x:0,z:0});
  // `seat` is an instruction to this method, not part of a golfer. Spreading it
  // through would persist it into every save and then be read back as a seat in
  // a group that has since changed.
  this.players=next.map((p,i)=>({name:p.name,team:p.team,hand:p.hand||'RH',id:i}));
  // The playing order is a per-player array like the rest, but it holds ids
  // rather than values, so it is remapped rather than resized. A golfer who
  // left takes their place in it with them; one who joined goes to the back,
  // which is also where honours puts someone with no score on the last hole.
  const moved=new Map();from.forEach((seat,i)=>{if(seat>=0)moved.set(seat,i);});
  const kept=(this.order||[]).filter(id=>moved.has(id)).map(id=>moved.get(id));
  this.order=[...kept,...this.players.map(p=>p.id).filter(id=>!kept.includes(id))];
  // The golfer who was up keeps the turn if they are still here and still have
  // a ball in play; otherwise it passes to the next in order.
  const stillHere=moved.get(wasActive);
  this.active=stillHere!==undefined&&!this.done[stillHere]?stillHere:Math.max(0,this.nextInOrder());
  return this.players;
 }
 get player(){return this.players[this.active];}
 get position(){return this.positions[this.active];}
 get team(){return this.player.team;}
 get stroke(){return this.mode==='scramble'?this.scrambleShots[this.team]+1:this.strokes[this.active]+1;}
 teamMembers(team){return this.players.filter(p=>p.team===team).map(p=>p.id);}
 takeShot(result,pin){
  if(this.holeComplete||this.finished||this.scrambleSelection)throw Error('This round is not ready for a shot.');
  this.checkpoint();const i=this.active,penalty=result.hazard?1:0;
  const position=result.hazard?{...this.position}:{x:result.end.x,z:result.end.z};
  const distance=Math.hypot(position.x-pin.x,position.z-pin.z);
  const putts=result.hazard||result.holed?0:awardedPutts(distance,result.onGreen===true,this.putting);
  const holed=!result.hazard&&!!result.holed,complete=holed||putts>0,puttStroke=result.puttStroke===true?1:0;
  if(this.mode==='scramble'){
   this.candidates.push({player:i,position,penalty,holed,putts,puttStroke,distance,hazard:result.hazard});
   const remaining=this.teamMembers(this.team).filter(id=>!this.candidates.some(c=>c.player===id));
   if(holed){this.teamPutts[this.team]+=puttStroke;this.scrambleShots[this.team]+=1;this.finishTeam(this.team);}
   else if(remaining.length)this.active=remaining[0];else this.scrambleSelection=true;
  }else{
   this.puttStrokes[i]=Math.round((this.puttStrokes[i]+puttStroke+putts)*100)/100;this.strokes[i]=Math.round((this.strokes[i]+1+penalty+putts)*100)/100;this.positions[i]=position;
   if(complete){this.done[i]=true;this.cards[i][this.hole]=this.strokes[i];this.puttCards[i][this.hole]=this.puttStrokes[i];}
   // Simulator stroke play: keep the same golfer until their ball is holed.
   if(this.mode==='stroke'){if(complete)this.active=this.nextInOrder();}
   // Best-ball match play is farthest-from-the-pin, shot by shot. Ties are broken
   // by PLAYING ORDER rather than by player index, so on the tee -- where every
   // ball is the same distance away -- honours decides who hits first.
   else {const next=this.order.filter(id=>!this.done[id]).sort((a,b)=>Math.hypot(this.positions[b].x-pin.x,this.positions[b].z-pin.z)-Math.hypot(this.positions[a].x-pin.x,this.positions[a].z-pin.z));this.active=next[0]??-1;}
   if(this.done.every(Boolean))this.completeHole();
  }
  return {holed,penalty,putts,complete,player:i,score:this.mode==='scramble'?this.scrambleShots[this.players[i].team]:this.strokes[i],puttingTotal:this.mode==='scramble'?this.teamPutts[this.players[i].team]:this.puttStrokes[i]};
 }
 chooseScramble(index){
  if(!this.scrambleSelection||!this.candidates[index])throw Error('Select a valid team shot.');
  const c=this.candidates[index],team=this.players[c.player].team;
  this.teamPutts[team]=Math.round((this.teamPutts[team]+(c.puttStroke||0)+(c.putts||0))*100)/100;this.scrambleShots[team]=Math.round((this.scrambleShots[team]+1+c.penalty+(c.putts||0))*100)/100;
  if(c.putts>0){this.finishTeam(team);return;}
  for(const id of this.teamMembers(team))this.positions[id]={...c.position};
  this.candidates=[];this.scrambleSelection=false;this.active=this.teamMembers(team)[0];
 }
 finishTeam(team){for(const id of this.teamMembers(team)){this.done[id]=true;this.cards[id][this.hole]=this.scrambleShots[team];this.puttCards[id][this.hole]=this.teamPutts[team];}this.teamCards[team][this.hole]=this.scrambleShots[team];this.candidates=[];this.scrambleSelection=false;this.active=this.nextInOrder();if(this.active<0)this.completeHole();}
 completeHole(){
  this.holeComplete=true;this.active=this.order?.[0]??0;
  if(this.mode==='match'){
   const a=Math.min(...this.teamMembers('A').map(i=>this.cards[i][this.hole])),b=Math.min(...this.teamMembers('B').map(i=>this.cards[i][this.hole]));
   this.teamCards.A[this.hole]=a;this.teamCards.B[this.hole]=b;if(a<b)this.match.A++;if(b<a)this.match.B++;
  }
  const lead=Math.abs(this.match.A-this.match.B),remaining=this.holes-this.hole-1;
  if(!this.endless&&(this.hole+1>=this.holes||(this.mode==='match'&&lead>remaining)))this.finished=true;
 }
 nextHole(){if(!this.holeComplete||this.finished)return false;this.hole++;this.beginHole();return true;}
 checkpoint(){const {history,...state}=this.toJSON();this.history.push(JSON.parse(JSON.stringify(state)));if(this.history.length>30)this.history.shift();}
 // A MULLIGAN IS A SHOT ON THE HOLE YOU ARE PLAYING. The history runs across
 // hole boundaries -- thirty shots deep, kept so a reload can still take one
 // back -- so on a fresh tee with nothing hit yet the top of it was the last
 // shot of the PREVIOUS hole. Pressing Mulligan there rewound a whole hole and
 // unrecorded its score: nothing you did on this hole was undone, which is the
 // one thing the button claims to do.
 //
 // Holing out does not end the chance to take one: the card is up for a few
 // seconds before the next tee, `holeComplete` is true, and taking back the putt
 // that just dropped is a reasonable thing to want.
 canMulligan(){const top=this.history[this.history.length-1];return !!top&&top.hole===this.hole;}
 mulligan(){if(!this.canMulligan())return false;const history=this.history.slice(),previous=Round.restore(history.pop(),false);Object.assign(this,previous);this.history=history;return true;}
 simDrop(position){if(this.holeComplete||this.finished||this.scrambleSelection)throw Error('Finish the current team selection or start the next hole before dropping.');if(!Number.isFinite(position.x)||!Number.isFinite(position.z))throw Error('Choose a valid drop position.');const ids=this.mode==='scramble'?this.teamMembers(this.team):[this.active];if(this.mode==='scramble'&&this.candidates.length)throw Error('Choose the team lie before taking a drop.');for(const i of ids)this.positions[i]={x:position.x,z:position.z};}
 toJSON(){return {...this};}
 static restore(data,withHistory=true){
  const r=new Round(data);r.teePlaced=data.teePlaced!==false;if(!Number.isInteger(data.hole)||data.hole<0||(!r.endless&&data.hole>=r.holes)||data.hole>9999)throw Error('Invalid saved hole.');
  for(const key of ['cards','positions','strokes','done'])if(!Array.isArray(data[key])||data[key].length!==r.players.length)throw Error('Invalid saved round.');
  const integer=v=>Number.isInteger(v)&&v>=0&&v<=999,score=v=>Number.isFinite(v)&&v>=0&&v<=999&&Math.abs(v*100-Math.round(v*100))<1e-6;
  if(!Number.isInteger(data.active)||data.active<0||data.active>=r.players.length||!data.strokes.every(score)||!data.done.every(v=>typeof v==='boolean')||!data.cards.every(row=>Array.isArray(row)&&(r.endless||row.length<=r.holes)&&row.every(score))||!data.positions.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<20000&&Math.abs(p.z)<20000))throw Error('Invalid saved player state.');
  if(!['finished','holeComplete','scrambleSelection'].every(k=>typeof data[k]==='boolean')||!['A','B'].every(t=>score(data.scrambleShots?.[t])&&integer(data.match?.[t])&&Array.isArray(data.teamCards?.[t])&&data.teamCards[t].every(score)))throw Error('Invalid saved scores.');
  if(!Array.isArray(data.candidates)||data.candidates.length>4||!data.candidates.every(c=>c&&integer(c.player)&&c.player<r.players.length&&Number.isFinite(c.position?.x)&&Number.isFinite(c.position?.z)&&[0,1].includes(c.penalty)&&typeof c.holed==='boolean'&&Number.isFinite(c.distance)&&(c.putts===undefined||(score(c.putts)&&c.putts<=3))))throw Error('Invalid scramble candidates.');
  if(data.puttCards!==undefined){if(!Array.isArray(data.puttCards)||data.puttCards.length!==r.players.length||!data.puttCards.every(row=>Array.isArray(row)&&(r.endless||row.length<=r.holes)&&row.every(score))||!Array.isArray(data.puttStrokes)||data.puttStrokes.length!==r.players.length||!data.puttStrokes.every(score)||!['A','B'].every(t=>score(data.teamPutts?.[t])))throw Error('Invalid putting statistics.');r.puttCards=data.puttCards;r.puttStrokes=data.puttStrokes;r.teamPutts=data.teamPutts;}
  if(data.pars!==undefined){if(!Array.isArray(data.pars)||data.pars.length>9999||!data.pars.every(v=>v===null||(Number.isInteger(v)&&v>=3&&v<=6)))throw Error('Invalid saved pars.');r.pars=data.pars;}
  for(const k of ['hole','finished','cards','teamCards','match','positions','strokes','done','active','holeComplete','candidates','scrambleSelection','scrambleShots'])r[k]=data[k];
  // The playing order, if the save has one. A save written before honours
  // existed does not, and anything that is not a clean permutation of the
  // players is not trusted -- an order missing a golfer would drop them from the
  // hole entirely, which is worse than losing whose turn it was.
  const ids=r.players.map(p=>p.id);
  r.order=Array.isArray(data.order)&&data.order.length===ids.length&&ids.every(id=>data.order.includes(id))?data.order.slice():ids;if(withHistory&&data.history){if(!Array.isArray(data.history)||data.history.length>30)throw Error('Invalid mulligan history.');r.history=data.history.map(s=>{const {history,...state}=Round.restore(s,false).toJSON();return state;});}return r;
 }
}
