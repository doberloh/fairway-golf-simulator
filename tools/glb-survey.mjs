import {readFileSync,readdirSync} from 'node:fs';
const dir=process.argv[2];
const names=new Map();
for(const f of readdirSync(dir).filter(n=>n.endsWith('.glb'))){
 const b=readFileSync(`${dir}/${f}`);
 const len=b.readUInt32LE(12);
 const j=JSON.parse(b.subarray(20,20+len).toString('utf8'));
 for(const m of j.materials||[]){
  const c=m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];
  const hex='#'+c.slice(0,3).map(v=>Math.round(Math.pow(v,1/2.2)*255).toString(16).padStart(2,'0')).join('');
  const e=names.get(m.name)||{n:0,hex};e.n++;names.set(m.name,e);
 }
}
console.log([...names.entries()].sort((a,b)=>b[1].n-a[1].n).map(([k,v])=>`${k} (${v.n}, ${v.hex})`).join('\n'));
