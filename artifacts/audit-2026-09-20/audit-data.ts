// One-off diagnostic harness. These assertions document the audited behavior,
// including defects; they are not desired-behavior regression tests.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {buildSignals} from '../../src/services/signals';
import {normalizeProfile} from '../../src/services/nansen';
import {buildSignalsSummary} from '../../src/utils/signalSummary';
import {emptySession,useAppStore} from '../../src/store/useAppStore';
import {percent,multiple,signedMoney} from '../../src/utils/formatters';
import type {RawTrade,Holding,Signal} from '../../src/types';

const evidence=JSON.parse(readFileSync('artifacts/audit-2026-09-20/live-responses.json','utf8'));
const get=(name:string)=>evidence.find((r:any)=>r.name===name);
const samples=[];
const holdings:Record<string,Holding[]>={};
for(let i=0;i<2;i++) {
  const summary=get(`wallet-${i}-summary-all`),details=get(`wallet-${i}-detail`).data.data;
  const bags=get(`wallet-${i}-holdings`).data.data.filter((r:any)=>r.holding_amount>0).map((r:any)=>({address:r.token_address,symbol:r.token_symbol,holdingAmount:r.holding_amount,holdingUsd:r.holding_usd,unrealizedRoi:r.roi_percent_unrealised}));
  holdings[summary.body.address]=bags;
  const profile=normalizeProfile(summary.body.address,null,summary.data,details,bags);
  assert.equal(profile.realizedPnlUsd,summary.data.realized_pnl_usd);
  assert.equal(profile.winRate,summary.data.win_rate);
  assert.equal(profile.topTokens[0].realizedRoi,1+details[0].roi_percent_realised);
  samples.push({address:profile.address,summaryRequestedAt:summary.requestedAt,display:{winRate:percent(profile.winRate),realizedPnl:signedMoney(profile.realizedPnlUsd,true),topTokens:profile.topTokens.slice(0,3).map(t=>({symbol:t.symbol,multiple:multiple(t.realizedRoi)})),holdings:profile.currentHoldings.slice(0,4).map(t=>t.symbol)}});
}
const replay=buildSignals(get('roster-trades').data.data,holdings,samples.map(s=>s.address));
assert.equal(replay.length,4);
const replaySummary=buildSignalsSummary(replay);

const addr=(n:number)=>`0x${n.toString(16).padStart(40,'0')}`;
const wallet=addr(1), token=addr(2);
const trade:RawTrade={trader_address:wallet,token_bought_symbol:'TEST',token_sold_symbol:'USDG',token_bought_address:token,token_sold_address:addr(3),token_bought_amount:10,token_sold_amount:100,trade_value_usd:100,block_timestamp:new Date().toISOString(),transaction_hash:'0xtransaction'};
const bag:Holding={address:token,symbol:'TEST',holdingAmount:30,holdingUsd:300,unrealizedRoi:-0.5};
const collision=buildSignals([trade,{...trade,token_sold_address:addr(4),token_sold_symbol:'USDC',token_bought_amount:20,trade_value_usd:200}],{[wallet]:[bag]},[wallet]).filter(s=>s.action==='buy');
assert.equal(collision.length,1);
assert.equal(collision[0].quantity,20);
assert.equal(collision[0].amountUsd,200);
const missingUsd=buildSignals([{...trade,trade_value_usd:null as unknown as number}],{[wallet]:[bag]},[wallet])[0];
assert.equal(missingUsd.amountUsd,0);
const partialSell=buildSignals([{...trade,token_bought_address:addr(3),token_bought_symbol:'USDG',token_sold_address:token,token_sold_symbol:'TEST',token_sold_amount:10,token_bought_amount:50,trade_value_usd:50}],{[wallet]:[{...bag,holdingAmount:20,holdingUsd:100,unrealizedRoi:-0.5}]},[wallet])[0];
assert.equal(partialSell.contextBadge,'taking_profit');
const hiddenEth=buildSignals([{...trade,token_bought_symbol:'ETH'}],{[wallet]:[]},[wallet]);
assert.equal(hiddenEth.length,0);
const oldSignal:Signal={...missingUsd,id:'old',amountUsd:10000,timestamp:new Date(Date.now()-48*3600000).toISOString()};
const newSignal:Signal={...missingUsd,id:'new',action:'sell',amountUsd:100};
const combined=buildSignalsSummary([oldSignal,newSignal]);
assert.equal(combined.topNetBuys[0].volumeUsd,9900);

Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
const profile=normalizeProfile(wallet,null,get('wallet-0-summary-all').data,[],[]);
useAppStore.setState({mode:'live',live:{...emptySession(),roster:[{wallet:profile,addedAt:1,pnlSinceAdded:123,pnlUpdatedAt:2,winRateSinceAdded:0.5,salesSinceAdded:2,holdingsUpdatedAt:2,holdingsError:false}],lastPolledAt:2,signals:[oldSignal]}});
useAppStore.getState().applyPoll('live',[],{[wallet]:{addedAt:1,holdings:null}});
const after=useAppStore.getState().live;
assert.equal(after.roster[0].pnlUpdatedAt,2);
assert.ok(after.lastPolledAt>2);
assert.equal(after.signals.length,1);

const findings={sampleDisplays:samples,liveReplay:{rawTrades:get('roster-trades').data.data.length,signals:replay,summary:replaySummary},reproductions:{sameTokenDifferentQuoteLegs:{expectedQuantity:30,actualQuantity:collision[0].quantity,expectedUsd:300,actualUsd:collision[0].amountUsd},missingUsd:{input:null,displayedUsd:missingUsd.amountUsd},partialSaleAtAssumedLoss:{badge:partialSell.contextBadge,scenario:'10 tokens sold at $5; remaining tokens valued at $5 with -50% unrealized ROI. No sale cost basis is consulted.'},ethStableSwap:{emittedSignals:hiddenEth.length},oldSignalsInSummary:{oldBuyAgeHours:48,oldBuyUsd:10000,currentSellUsd:100,result:combined},failedRefresh:{lastPolledAt:after.lastPolledAt,pnlUpdatedAt:after.roster[0].pnlUpdatedAt,retainedOldSignals:after.signals.length}}};
writeFileSync('artifacts/audit-2026-09-20/analysis.json',JSON.stringify(findings,null,2));
console.log(JSON.stringify(findings,null,2));
