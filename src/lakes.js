// Open-space lake candidates. Bank samples use the same profile representation
// as ponds, so maps, water meshes, painted terrain and contact agree.
//
// A LAKE MUST CLEAR THE PONDS, NOT JUST THE OTHER LAKES. The separation test
// consulted `accepted`, which holds lakes placed by this pass and nothing
// else, so a lake could be dropped straight on top of a pond that had been
// there since the hole was generated. Measured at ten overlapping lake-pond
// pairs across twelve courses -- and they do not merely touch: the worst pair
// had water surfaces 14.19 m apart, one body's plane hanging in the air over
// the other's basin. Ponds are in hole-local coordinates and lakes work in
// world, which is most of why the check was missing.
export function addLargeLakes(s,holes,halfX,halfZ,nearest,height,random){
 const rng=random(s.seed+':large-lakes'),accepted=[];
 for(let n=0;n<(s.lakes||0);n++){let best=null;
  for(let attempt=0;attempt<500;attempt++){const rx=s.lakeSize*.5*(.8+rng()*.35),rz=rx*(.7+rng()*.5),x=(rng()-.5)*halfX*1.8,z=(rng()-.5)*halfZ*1.8,q=nearest(x,z),reach=Math.max(rx,rz)*1.12;
   if(q.d<reach+20||q.h.ponds.length>=4||Math.abs(x)+reach>halfX-8||Math.abs(z)+reach>halfZ-8||accepted.some(p=>Math.hypot(x-p.x,z-p.z)<reach+p.reach+35)||holes.some(hh=>hh.ponds.some(p=>{const c=hh.toWorld(p);return Math.hypot(x-c.x,z-c.z)<reach+Math.max(p.reachX||p.rx,p.rz)+35;})))continue;
   // A bigger lake spans more ground, so its rim naturally varies more. Basin
   // fitting still shrinks or drops a candidate that cannot sit level.
   const rim=Array.from({length:32},(_,i)=>height(x+Math.cos(i*Math.PI/16)*reach,z+Math.sin(i*Math.PI/16)*reach));if(Math.min(...rim)<.8)continue;const spread=Math.max(...rim)-Math.min(...rim);if(spread>22+reach*.08)continue;const score=spread+height(x,z)*.08;if(!best||score<best.score)best={x,z,rx,rz,reach,h:q.h,score};
  }
  if(!best)continue;accepted.push(best);const h=best.h,p=h.toLocal(best),phase=rng()*Math.PI*2,rx=best.rx,rz=best.rz;
  h.ponds.push({x:p.x,z:p.z,rx,rz,phase,wave2:0,wave3:0,large:true,depth:s.waterMin+rng()*(s.waterMax-s.waterMin),banks:Array.from({length:257},(_,i)=>{const t=i/256;return{x:p.x+rx*.08*Math.sin(t*Math.PI*2+phase),rx:rx*(.83+.13*Math.sin(t*Math.PI*2+phase)+.06*Math.sin(t*Math.PI*5+phase))};})});
 }
}
