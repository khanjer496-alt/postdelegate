// Pulls the public review feed of the app into src/data/testimonials.json.
// Run it by hand before a site deploy: node scripts/pull-testimonials.mjs
// The feed holds only reviews an admin approved and the author agreed to
// publish. Optional: pass another feed URL as the first argument.
import {writeFileSync} from 'node:fs';
const FEED=process.argv[2]||process.env.TESTIMONIALS_URL||'https://app.postdelegate.com/api/public/reviews';
const out=new URL('../src/data/testimonials.json',import.meta.url);
const res=await fetch(FEED,{headers:{accept:'application/json'}}).catch((e)=>{console.error(`Could not reach ${FEED}: ${e.cause?.message||e.message}. Nothing was written.`);process.exit(1);});
if(!res.ok){console.error(`Could not read ${FEED}: HTTP ${res.status}. Nothing was written.`);process.exit(1);}
const feed=await res.json().catch(()=>null);
if(!Array.isArray(feed)){console.error('Unexpected response, expected a list. Nothing was written.');process.exit(1);}
const text=(v,max)=>typeof v==='string'&&v.trim()?v.trim().slice(0,max):null;
// keep only the fields the site shows, whatever else the feed sends
const items=feed.flatMap((r)=>{
  const displayName=text(r?.displayName,60),body=text(r?.text,1000);
  if(!displayName||!body||!Number.isInteger(r?.rating)||r.rating<1||r.rating>5)return[];
  return[{displayName,roleCompany:text(r?.roleCompany,100),rating:r.rating,text:body,date:text(r?.date,10)}];
});
writeFileSync(out,JSON.stringify(items,null,2)+'\n');
console.log(`Wrote ${items.length} testimonial${items.length===1?'':'s'} to src/data/testimonials.json`);
