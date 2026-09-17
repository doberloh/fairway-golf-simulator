import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGroundGrid} from '../src/terrain-grid.js';
import {landscapeGeometry} from '../src/landscape-edge.js';
test('distant landscape shares every ground perimeter vertex without overlap or inverted faces',()=>{
 const height=(x,z)=>2+Math.sin(x/80)*.5+Math.cos(z/90),groundGrid=makeGroundGrid(height,60,90,6,()=>false),g=landscapeGeometry({groundGrid,height,settings:{biome:'midwest'}}),p=g.attributes.position,n=g.userData.innerCount,edge=new Set();
 for(let i=0;i<=groundGrid.nx;i++)for(let j=0;j<=groundGrid.nz;j++)if(i===0||i===groundGrid.nx||j===0||j===groundGrid.nz){const k=(j*(groundGrid.nx+1)+i)*3;edge.add(Array.from(groundGrid.positions.slice(k,k+3)).join(','));}
 assert.equal(edge.size,n);for(let i=0;i<n;i++)assert(edge.has([p.getX(i),p.getY(i),p.getZ(i)].join(',')));
 for(let k=0;k<g.index.count;k+=3){const a=g.index.getX(k),b=g.index.getX(k+1),c=g.index.getX(k+2),normalY=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));assert(normalY>0);}
 g.dispose();
});
