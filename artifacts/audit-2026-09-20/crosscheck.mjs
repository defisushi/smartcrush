import { loadEnv } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
const directory = new URL('./', import.meta.url);
const evidence = JSON.parse(await readFile(new URL('live-responses.json',directory),'utf8'));
const key = loadEnv('development','./backend','NANSEN_').NANSEN_API_KEY;
const results = [];
async function post(name,path,body,proxy=false) {
  const response = await fetch(`${proxy ? 'http://127.0.0.1:5173/api/nansen' : 'https://api.nansen.ai'}/api/v1/${path}`, {
    method:'POST',headers:{'Content-Type':'application/json',...(proxy?{}:{apikey:key})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)
  });
  const data = await response.json();
  results.push({name,path,body,requestedAt:new Date().toISOString(),status:response.status,creditsUsed:response.headers.get('x-nansen-credits-used'),data});
  await writeFile(new URL('crosscheck-responses.json',directory),JSON.stringify(results,null,2));
  console.log(JSON.stringify({name,status:response.status,rows:data.data?.length,pagination:data.pagination,error:response.ok?undefined:data}));
}
for(let i=0;i<2;i++) {
  const source=evidence.find(x=>x.name===`wallet-${i}-summary-all`);
  await post(`wallet-${i}-current-balance`,'profiler/address/current-balance',{
    address:source.body.address,chain:'robinhood',hide_spam_token:true,pagination:{page:1,per_page:1000},order_by:[{field:'value_usd',direction:'DESC'}]
  });
  await post(`wallet-${i}-detail-all`,'profiler/address/pnl',{
    ...source.body,filters:{show_realized:true},pagination:{page:1,per_page:1000},order_by:[{field:'roi_percent_realised',direction:'DESC'}]
  });
}
const source=evidence.find(x=>x.name==='wallet-0-summary-all');
await post('summary-short-range-through-local-proxy','profiler/address/pnl-summary',{
  ...source.body,date:{from:new Date(Date.now()-600000).toISOString(),to:new Date().toISOString()}
},true);
