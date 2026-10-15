/* offline.js ― 离线（Service Worker）的页面侧：注册・新版提示（只在安全点）・离线状态提示・每课离线包・设置区块。
 * 新版就绪：只在首页出不打扰的提示，用户点了才切换，且只重新载入点的这个标签；模试・练习中途绝不刷新。
 * 别的标签被切到新 SW 后继续用已载入的旧版，到首页时提示「重新载入」，不自动刷新。 */
'use strict';

const SW={ ok:('serviceWorker' in navigator) && window.isSecureContext, reg:null, waiting:null, mine:false, reloadOnly:false, frame:'' };

function swInit(){
  window.addEventListener('online',swNetChip); window.addEventListener('offline',swNetChip); swNetChip();
  if(!SW.ok) return;
  const go=function(){
    navigator.serviceWorker.register('sw.js').then(function(reg){
      SW.reg=reg;
      if(reg.waiting && navigator.serviceWorker.controller) swSetWaiting(reg.waiting);
      reg.addEventListener('updatefound',function(){ swWatch(reg.installing); });
      if(reg.installing) swWatch(reg.installing);
    }).catch(function(){}); // 注册失败＝在线照常，只是没有离线
    if(navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({type:'rx-sweep'});
  };
  if(document.readyState==='complete') go(); else window.addEventListener('load',go);
  navigator.serviceWorker.addEventListener('controllerchange',function(){
    if(SW.mine){ location.reload(); return; }       // 点了「更新」的这个标签
    SW.waiting=null; SW.reloadOnly=true; swPrompt(); // 别的标签：继续用旧版，到首页时提示重新载入
  });
  document.addEventListener('visibilitychange',function(){ // 长开着的主屏幕形态也能发现新版（至多 30 分钟一次）
    if(document.visibilityState!=='visible' || !SW.reg || navigator.onLine===false) return;
    const now=Date.now(); if(now-(SW.checked||0)<30*60*1000) return;
    SW.checked=now; SW.reg.update().catch(function(){});
  });
}
function swWatch(w){
  if(!w) return;
  w.addEventListener('statechange',function(){
    if(w.state==='installed' && navigator.serviceWorker.controller) swSetWaiting(w);
    if(w.state==='redundant' && SW.waiting===w){ SW.waiting=(SW.reg&&SW.reg.waiting)||null; swPrompt(); }
  });
}
function swSetWaiting(w){ SW.waiting=w; SW.reloadOnly=false; swPrompt(); } // 新しい waiting が来たら「再読み込みだけ」より優先

/* registerFrame 每次渲染时告知当前画面；只有首页是安全点 */
function swOnFrame(key){ SW.frame=key; swPrompt(); swNetChip(); }
function swPrompt(){
  const old=document.getElementById('swUpd'); if(old) old.remove();
  if(!(SW.waiting||SW.reloadOnly) || SW.frame!=='home') return;
  document.body.appendChild(el('div',{id:'swUpd',class:'sw-upd',role:'status'},[
    el('span',{class:'jp',text:t('swReady')}),
    el('button',{class:'btn sm jp',text:SW.reloadOnly?t('swReload'):t('swUpdate'),onclick:swApply}) ]));
}
function swApply(){ // 押した時点の登録上の waiting を使う（他タブが途中版へ上げた後に最新版が来ていても一回で最新へ）
  const w=(SW.reg&&SW.reg.waiting)||null;
  if(!w){ location.reload(); return; }
  SW.mine=true; w.postMessage({type:'SKIP_WAITING'}); // controllerchange で本タブだけ再読み込み
}

/* 离线状态：顶栏一枚小标签（不弹窗） */
function swNetChip(){
  let c=document.getElementById('offChip');
  if(navigator.onLine!==false){ if(c) c.remove(); return; }
  if(!c){ c=el('div',{id:'offChip',class:'off-chip jp',role:'status'}); const r=document.querySelector('.topbar'); if(r) r.appendChild(c); } // 顶栏の行には入れず、その下の細い帯に（狭い画面で語切替を押し出さない：S6 U-04）
  c.textContent=t('swOffline');
}

/* ---------- 每课离线包：本课数据＋图 ----------
 * 资源清单一律从「要保存（或已保存）的那份数据快照」推导，完整性按同一清单在同一个缓存里核对（不拿页面内存里的旧数据推清单）。 */
function swScopeTag(path){ let h=5381; for(let i=0;i<path.length;i++) h=((h*33)^path.charCodeAt(i))>>>0; return h.toString(36); } // 与 sw.js 同式
function swDataCache(){ // 控制本页的 SW 的数据缓存名（更新过渡期可能与本页版本不同）；没有控制者时按同一规则推算
  return new Promise(function(res){
    const scope=(SW.reg&&SW.reg.scope)||new URL('.',location.href).href;
    const fallback='rx-'+swScopeTag(new URL(scope).pathname)+'-'+APP_VERSION+'-data';
    const c=navigator.serviceWorker&&navigator.serviceWorker.controller; if(!c){ res(fallback); return; }
    const ch=new MessageChannel(), tm=setTimeout(function(){ res(fallback); },1500);
    ch.port1.onmessage=function(e){ clearTimeout(tm); res((e.data&&e.data.data)||fallback); };
    c.postMessage({type:'rx-version'},[ch.port2]);
  });
}
function swCoreNames(meta){ return meta.contract===RX.CONTRACT?['course.json','content.json']:['questions.json','concepts.json','manual.json']; }
function swBase(meta){ return meta.dir.replace(/\/$/,'')+'/'; }
/* 数据快照（{文件名: 解析后的 JSON}）→ 该课离线所需的全部 URL（核心数据＋图） */
function swPackList(meta,snap){
  const base=swBase(meta), urls=swCoreNames(meta).map(function(n){ return base+n; }), seen={};
  if(meta.contract===RX.CONTRACT){
    const ct=snap['content.json']||{};
    (ct.lectures||[]).forEach(function(Lc){ (Lc.cards||[]).forEach(function(c){ if(c && c.kind==='figure' && c.svg) urls.push(base+'figures/'+c.svg); }); });
    (ct.images||[]).forEach(function(im){ if(im && im.file) urls.push(base+'images/'+im.file); });
  } else {
    const walk=function(x){ // 旧课：数据里出现的本课相对图路径（figs/・pages/ 等）
      if(typeof x==='string'){ if(/^[^\/\s?#]+\/[^\/\s?#]+\.(png|jpe?g|webp|gif|svg)$/i.test(x) && !seen[x]){ seen[x]=1; urls.push(base+x); } } // 文件名は ASCII に限らない（「前半」「後半」など：B-058）
      else if(Array.isArray(x)) x.forEach(walk);
      else if(x && typeof x==='object') Object.keys(x).forEach(function(k){ walk(x[k]); });
    };
    swCoreNames(meta).forEach(function(n){ walk(snap[n]); });
  }
  return urls.filter(function(u,i){ return urls.indexOf(u)===i; });
}
/* 已保存的状态：读缓存里那份快照推清单，再在同一个缓存里逐件核对 */
async function swPackStatus(meta){
  if(!window.caches) return null;
  const cache=await caches.open(await swDataCache()), base=swBase(meta), snap={};
  for(const n of swCoreNames(meta)){
    const r=await cache.match(base+n); if(!r) return { have:0, total:1, complete:false };
    try{ snap[n]=await r.json(); }catch(e){ return { have:0, total:1, complete:false }; }
  }
  const list=swPackList(meta,snap); let have=0;
  for(const u of list){ if(await cache.match(u)) have++; }
  return { have:have, total:list.length, complete:have===list.length };
}
/* 保存：先取核心数据（这就是要保存的快照）→ 由它推清单 → 存快照・取图 → 按同一清单核对 */
async function swSavePack(meta,onProgress){
  if(!window.caches) throw new Error('nocache');
  try{ if(navigator.storage && navigator.storage.persist) await navigator.storage.persist(); }catch(e){}
  const cache=await caches.open(await swDataCache()), base=swBase(meta), snap={}, resps={};
  for(const n of swCoreNames(meta)){
    const r=await fetch(base+n,{cache:'no-store'});
    if(!r.ok) throw new Error(n+' '+r.status);
    resps[n]=r; snap[n]=await r.clone().json();
  }
  const list=swPackList(meta,snap);
  for(const n of swCoreNames(meta)) await cache.put(base+n,resps[n]); // QuotaExceededError はそのまま上へ
  let done=0;
  const one=async function(u){
    try{ const r=await fetch(u,{cache:'no-store'}); if(r.ok) await cache.put(u,r); }
    catch(e){ if(e && e.name==='QuotaExceededError') throw e; }
    done++; if(onProgress) onProgress(done,list.length);
  };
  const queue=list.filter(function(u){ return swCoreNames(meta).every(function(n){ return u!==base+n; }); });
  done=list.length-queue.length;
  const worker=async function(){ while(queue.length) await one(queue.shift()); };
  await Promise.all([worker(),worker(),worker(),worker()]);
  if(meta.contract===RX.CONTRACT){ // 真题层（密文）：有就一起存，没有不算缺
    try{ const r=await fetch(base+'quiz.enc.json',{cache:'no-store'}); if(r.ok) await cache.put(base+'quiz.enc.json',r); }catch(e){ if(e && e.name==='QuotaExceededError') throw e; }
  }
  let have=0;
  for(const u of list){ if(await cache.match(u)) have++; }
  return { have:have, total:list.length, complete:have===list.length };
}

/* ---------- 设置区块 ---------- */
function swSettingsBlock(){
  const kids=[ el('div',{class:'setlbl jp',text:t('swTitle')}) ];
  if(!SW.ok || !window.caches){ kids.push(el('div',{class:'sethelp jp',text:t('swNoSupport')})); return el('div',{class:'setblk'},kids); }
  const meta=App.course, msg=el('div',{class:'sethelp jp',role:'status','aria-live':'polite'});
  kids.push(el('div',{class:'sethelp jp',text:t('swLead')}), msg);
  const save=el('button',{class:'btn ghost sm jp',text:t('swSavePack'),onclick:async function(){
    save.disabled=true;
    try{
      const r=await swSavePack(meta,function(n,m){ msg.textContent=t('swSaving').replace('{n}',n).replace('{m}',m); });
      msg.textContent=r.complete?t('swSaved'):t('swSaveFail'); if(r.complete) save.textContent=t('swSavedBtn');
    }catch(e){ msg.textContent=(e && e.name==='QuotaExceededError')?t('swQuota'):t('swSaveFail'); }
    save.disabled=false;
  }});
  const check=el('button',{class:'btn ghost sm jp',text:t('swCheck'),onclick:async function(){
    if(!SW.reg){ msg.textContent=t('swCheckFail'); return; }
    check.disabled=true;
    try{
      await SW.reg.update();
      const w=SW.reg.installing||SW.reg.waiting;
      msg.textContent=w?t('swFound'):t('swLatest');
      if(w && w===SW.reg.installing) w.addEventListener('statechange',function(){ if(w.state==='redundant') msg.textContent=t('swCheckFail'); });
    }catch(e){ msg.textContent=t('swCheckFail'); }
    check.disabled=false;
  }});
  kids.push(el('div',{class:'row'},[save,check]));
  if(meta) swPackStatus(meta).then(function(s){ if(s && !msg.textContent) msg.textContent=s.complete?t('swSaved'):t('swNotSaved'); if(s&&s.complete) save.textContent=t('swSavedBtn'); }).catch(function(){}); // 保存済みならボタンもそう言う（S6 U-71）
  return el('div',{class:'setblk'},kids);
}
