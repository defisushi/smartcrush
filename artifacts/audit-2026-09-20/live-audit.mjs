import { loadEnv } from 'vite';
import { writeFile } from 'node:fs/promises';
const directory = new URL('./', import.meta.url);
const key = loadEnv('development', './backend', 'NANSEN_').NANSEN_API_KEY;
if (!key) throw new Error('Configured key missing');
const results = [];
async function request(name, endpoint, body) {
  const response = await fetch(`https://api.nansen.ai/api/v1/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  const record = { name, endpoint, requestedAt: new Date().toISOString(), body, status: response.status,
    creditsUsed: response.headers.get('x-nansen-credits-used'), requestId: response.headers.get('x-request-id'), data };
  results.push(record);
  await writeFile(new URL('live-responses.json', directory), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({name, status: response.status, rows: data.data?.length, pagination: data.pagination, creditsUsed: record.creditsUsed, error: response.ok ? undefined : data}));
  if (!response.ok) throw new Error(`${name} failed (${response.status})`);
  return data;
}
const discovery = await request('discovery-exact-app-page-1', 'smart-money/dex-trades', {
  chains: ['robinhood'], filters: { include_smart_money_labels: ['Smart Trader', '30D Smart Trader', '90D Smart Trader', '180D Smart Trader'] },
  order_by: [{field:'trade_value_usd',direction:'DESC'}], pagination:{page:1,per_page:1000},
});
const addresses = [...new Set(discovery.data.map(t => t.trader_address))].slice(0,2);
const to = new Date().toISOString();
const date = {from: new Date(0).toISOString(), to};
console.log(JSON.stringify({sampleWallets:addresses, uniqueDiscoveryWallets: new Set(discovery.data.map(t=>t.trader_address)).size}));
for (const [i,address] of addresses.entries()) {
  const base = {address, chain:'robinhood', date};
  await request(`wallet-${i}-summary-all`, 'profiler/address/pnl-summary', base);
  await request(`wallet-${i}-detail`, 'profiler/address/pnl', {...base, filters:{show_realized:true}, pagination:{page:1,per_page:10}, order_by:[{field:'roi_percent_realised',direction:'DESC'}]});
  await request(`wallet-${i}-holdings`, 'profiler/address/pnl', {...base, filters:{show_realized:false}, pagination:{page:1,per_page:1000}, order_by:[{field:'holding_usd',direction:'DESC'}]});
  await request(`wallet-${i}-summary-24h`, 'profiler/address/pnl-summary', {...base, date:{from:new Date(Date.parse(to)-86400000).toISOString(),to}});
}
if (addresses.length) await request('roster-trades', 'smart-money/dex-trades', {
  chains:['robinhood'],filters:{trader_address:addresses},order_by:[{field:'block_timestamp',direction:'DESC'}],pagination:{page:1,per_page:1000},
});
