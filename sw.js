/* sw.js ― 离线缓存（Service Worker）。VERSION 与 index.html 的 APP_VERSION 同步改（publish 检查两者一致）：
 *   浏览器按 sw.js 的字节差异发现新版，所以版本必须写在本文件里，不能只放在注册 URL 上。
 * 切换规则：新版装好后停在 waiting，不自动 skipWaiting、不 clients.claim；只有页面发来 SKIP_WAITING
 *   （用户在安全点点了「更新」）才切换，且只由点的那个标签重新载入。本 SW 在任期间，导航拿到网上别的版本的页面时
 *   仍给本版的壳（刷新・重开都不绕过「更新」按钮），同时促发一次更新检查。
 * 缓存按作用域与版本分开（rx-<作用域标记>-<版>-shell・-data）；只查・只清本作用域的缓存，查找时本版优先。
 *   旧版缓存不在激活时清：别的标签里的旧页面可能还要用；等到只剩一个窗口时的下一次导航，再清比本版旧的缓存。
 *   数据缓存（各课数据・看过的图・离线包）安装时从旧版继承。
 * 只处理本作用域内的同源 GET；跨源（Google Fonts 等）与 POST 不碰。同源的自托管字体（fonts/*.woff2、名带内容哈希）走 DATA：安装时按 fonts/noto-subset.css 的 url() 预取（不挡安装），
 *   以后 cache-first；继承旧版 DATA 时丢掉当前 CSS 不再引用的旧哈希字体。真题层只有密文（quiz.enc.json）会进缓存，明文只在页面内存。 */
'use strict';
const VERSION='4.3.3';
const SCOPE=self.registration.scope;
function scopeTag(path){ let h=5381; for(let i=0;i<path.length;i++) h=((h*33)^path.charCodeAt(i))>>>0; return h.toString(36); } // offline.js・tools/sw_unregister.js 同式
const PFX='rx-'+scopeTag(new URL(SCOPE).pathname)+'-';
const SHELL=PFX+VERSION+'-shell', DATA=PFX+VERSION+'-data';
const OWN=new RegExp('^'+PFX+'(.+)-(shell|data)$');
const LEGACY=/^rx-[0-9][0-9.]*-(shell|data)$/; // 作用域标记导入前的缓存名（rx-<版>-…）：同源其他部署也可能用，只动本作用域的项目
/* 壳的部件＝index.html 里带 ?v= 的本地引用（publish 检查两边一致；dev.js 除外） */
const PARTS=['styles.css','engine-core.js','i18n.js','core.js','session.js','manual-reader.js','panels.js','talk.js',
  'rx-core.js','rx-views.js','rx-practice.js','quiz-envelope.js','rx-vault.js','rx-export.js','rx-search.js','offline.js','fonts/noto-subset.css'];
const STATIC=['manifest.webmanifest','apple-touch-icon.png','favicon-16.png','favicon-32.png',
  'icon-192.png','icon-512.png','icon-192-maskable.png','icon-512-maskable.png'];
const NET_WAIT=5000;    // 网络迟迟不回（信号弱）时改用缓存的等待上限（毫秒）
const SHELL_WAIT=20000; // 安装时取壳的上限：超时＝本次安装失败，下次检查再装
const WARM_WAIT=8000;   // 安装时预取各课数据的单件上限：超时只是少缓存一件，不挡安装

function versionOf(html){ const m=/APP_VERSION\s*=\s*'([^']+)'/.exec(html); return m?m[1]:null; }
function verCmp(a,b){ // 'x.y.z' 逐段数值比较
  const x=String(a).split('.'), y=String(b).split('.');
  for(let i=0;i<Math.max(x.length,y.length);i++){ const d=(parseInt(x[i],10)||0)-(parseInt(y[i],10)||0); if(d) return d; }
  return 0;
}
function offline(){ return new Response('offline',{status:503,statusText:'offline',headers:{'Content-Type':'text/plain'}}); }
function within(p,ms){ return Promise.race([p,new Promise(function(_,rej){ setTimeout(function(){ rej(new Error('timeout')); },ms); })]); }
/* fn(signal) 的全过程（取响应・读响应体・写缓存）限时；超时即中止请求并 reject */
function timed(ms,fn){
  const ac=(typeof AbortController==='function')?new AbortController():null;
  let tm;
  return Promise.race([
    Promise.resolve().then(function(){ return fn(ac?ac.signal:undefined); }),
    new Promise(function(_,rej){ tm=setTimeout(function(){ if(ac) ac.abort(); rej(new Error('timeout')); },ms); })
  ]).finally(function(){ clearTimeout(tm); });
}
function put(name,req,res){ return caches.open(name).then(function(c){ return c.put(req,res); }).catch(function(){}); } // 配额不足等：不影响本次响应
/* 本作用域的缓存（本版优先，其余按版本从新到旧）；不在别的作用域的缓存里找 */
async function ownCaches(){
  const out=[];
  (await caches.keys()).forEach(function(k){ const m=OWN.exec(k); if(m) out.push({name:k,ver:m[1],kind:m[2]}); });
  return out.sort(function(a,b){ return ((b.ver===VERSION)-(a.ver===VERSION)) || verCmp(b.ver,a.ver) || (a.kind==='data'?-1:1); });
}
async function matchOwn(req){
  for(const x of await ownCaches()){ const r=await (await caches.open(x.name)).match(req); if(r) return r; }
  return null;
}
async function ownShell(){ return (await caches.has(SHELL)) ? (await caches.open(SHELL)).match(SCOPE) : null; }

/* 各课的核心数据（无图）：首次访问时页面还不受 SW 控制，所以安装时按清单先取一遍，断网后也能开各课首页。
 * 每件有超时；取不到的只是没缓存（页面打开该课时再按网络优先取），不挡安装。 */
async function warmCore(data){
  let m;
  try{
    m=await timed(WARM_WAIT,async function(signal){
      const r=await fetch('course-manifest.json',{cache:'no-store',signal:signal}); if(!r.ok) return null;
      const j=await r.clone().json(); await data.put('course-manifest.json',r); return j;
    });
  }catch(e){ return; }
  const files=[];
  ((m&&m.courses)||[]).forEach(function(c){
    if(!c || !c.dir) return;
    const names=c.contract==='rx-content/1'?['course.json','content.json','quiz.enc.json']:['questions.json','concepts.json','manual.json'];
    names.forEach(function(n){ files.push(c.dir.replace(/\/$/,'')+'/'+n); });
  });
  await Promise.all(files.map(function(u){
    return timed(WARM_WAIT,function(signal){ return fetch(u,{cache:'no-store',signal:signal}).then(function(r){ if(r.ok) return data.put(u,r); }); }).catch(function(){}); // 没有的（如未配布真题层）・超时的跳过
  }));
}

self.addEventListener('install',function(e){
  e.waitUntil((async function(){
    const shell=await caches.open(SHELL);
    await timed(SHELL_WAIT,async function(signal){
      const idx=await fetch(new Request(SCOPE,{cache:'reload'}),{signal:signal});
      if(!idx.ok) throw new Error('index '+idx.status);
      // 部署进行中（页面与 sw.js 不是同一版）就不装，下次检查再装：壳必须整版一致
      if(versionOf(await idx.clone().text())!==VERSION) throw new Error('version mismatch');
      await shell.put(SCOPE,idx);
    });
    await Promise.all(PARTS.map(function(p){
      const rq=new Request(p+'?v='+VERSION,{cache:'reload'});
      return timed(SHELL_WAIT,function(signal){ return fetch(rq,{signal:signal}).then(function(r){ if(!r.ok) throw new Error(p+' '+r.status); return shell.put(rq,r); }); });
    }));
    await Promise.all(STATIC.map(function(p){
      const rq=new Request(p,{cache:'reload'});
      return timed(WARM_WAIT,function(signal){ return fetch(rq,{signal:signal}).then(function(r){ if(r.ok) return shell.put(rq,r); }); }).catch(function(){});
    }));
    const data=await caches.open(DATA);
    const fonts=await fontUrls(); // 自托管字体＝壳里 fonts/noto-subset.css の url()（唯一の真源；別の清単は持たない）
    const inherit=async function(name,onlyScope){ // 旧版的数据缓存（离线包・看过的图）→ 本版
      const old=await caches.open(name);
      for(const req of await old.keys()){
        if(onlyScope && req.url.indexOf(SCOPE)!==0) continue;
        if(fonts.size && /\.woff2(\?|$)/i.test(req.url) && !fonts.has(req.url)) continue; // 壳の CSS が取れず一覧が空なら絞らない（CR432 建議：継承の字体を全部落とさない） // 当前 CSS 不再引用的旧哈希字体不继承（S1 审阅建议 2：否则每换一次子集就多带 1.3MB 到以后所有版本）
        if(await data.match(req)) continue;
        const res=await old.match(req); if(res) await data.put(req,res).catch(function(){});
      }
    };
    for(const x of await ownCaches()){ if(x.name!==DATA && x.kind==='data') await inherit(x.name,false); }
    for(const k of await caches.keys()){ if(LEGACY.test(k) && /-data$/.test(k)) await inherit(k,true); } // 早期の無標記名：本作用域の項目だけ
    await Promise.all(Array.from(fonts).map(function(u){ // 字体を安装時に先取り（S1 審閲建議 1：首访で未受控の頁が使った字体は DATA に入らない／子集の哈希が変わった直後に断網＝離線で 503 になる）。取れなくても安装は止めない
      return data.match(u).then(function(hit){ if(hit) return; const rq=new Request(u,{cache:'reload'});
        return timed(WARM_WAIT,function(signal){ return fetch(rq,{signal:signal}).then(function(r){ if(r.ok) return data.put(rq,r); }); }); }).catch(function(){}); }));
    await warmCore(data);
  })());
});

async function fontUrls(){ // 自托管字体の一覧：壳部件 fonts/noto-subset.css の url(...)（.woff2・本作用域）を絶対 URL の Set で。CSS が無ければ空
  try{ const shell=await caches.open(SHELL); const r=await shell.match(new Request('fonts/noto-subset.css?v='+VERSION)); if(!r) return new Set();
    const css=await r.text(), base=new URL('fonts/noto-subset.css',SCOPE).href, out=new Set(), re=/url\(\s*['"]?([^'")]+)['"]?\s*\)/g; let m;
    while((m=re.exec(css))){ const u=new URL(m[1],base).href; if(/\.woff2(\?|$)/i.test(u) && u.indexOf(SCOPE)===0) out.add(u); }
    return out; }catch(_){ return new Set(); }
}

/* 只剩一个窗口时，清掉本作用域里比本版旧的缓存（多标签时留给还开着的旧页面）。
 * 只由页面载入完成后发来的 rx-sweep 触发：导航途中，正在替换的旧文档与新文档都可能不在 matchAll 里，会少算窗口。 */
async function sweep(){
  const wins=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  if(wins.length>1) return;
  await Promise.all((await ownCaches()).map(function(x){ return verCmp(x.ver,VERSION)<0 ? caches.delete(x.name) : null; }));
  for(const k of await caches.keys()){ // 无标记的旧名：删本作用域的项目，删空了才删整个缓存
    if(!LEGACY.test(k)) continue;
    const c=await caches.open(k), reqs=await c.keys();
    await Promise.all(reqs.filter(function(r){ return r.url.indexOf(SCOPE)===0; }).map(function(r){ return c.delete(r); }));
    if(!(await c.keys()).length) await caches.delete(k);
  }
}

self.addEventListener('message',function(e){
  const d=e.data||{};
  if(d.type==='SKIP_WAITING') self.skipWaiting();
  else if(d.type==='rx-version' && e.ports && e.ports[0]) e.ports[0].postMessage({version:VERSION,data:DATA,shell:SHELL});
  else if(d.type==='rx-sweep') e.waitUntil(sweep().catch(function(){})); // 旧版缓存清理的唯一触发点（页面载入完成后）
});

/* 导航：网络优先，但只接受与本版一致的页面（并更新缓存里的壳）。网上是别的版本 → 给本版的壳、促发更新检查；
 * 断网・超时・5xx → 本版的壳；4xx 照实返回。 */
async function onNavigate(e){
  const net=fetch(e.request);
  let res=null;
  try{ res=await within(net,NET_WAIT); }
  catch(err){
    const hit=await ownShell(); if(hit) return hit;
    try{ res=await net; }catch(_){ return offline(); }
  }
  if(res.ok){
    const v=versionOf(await res.clone().text());
    if(v===VERSION){ e.waitUntil(put(SHELL,SCOPE,res.clone()).catch(function(){})); return res; } // 旧版缓存的清理只在页面载入完成后的 rx-sweep 里做（导航途中窗口计数不可靠）
    const hit=await ownShell();
    if(hit){ e.waitUntil(self.registration.update().catch(function(){})); return hit; }
    return res; // 本版的壳不在了（被浏览器清掉）：只能用网上的
  }
  if(res.status>=500){ const hit=await ownShell(); if(hit) return hit; }
  return res;
}
/* 带 ?v= 的部件：缓存优先（本作用域各版，旧标签用得到）；只把本版的写进本版缓存 */
async function partFirst(req,ver){
  const hit=await matchOwn(req); if(hit) return hit;
  try{
    const res=await fetch(req);
    if(res.ok && ver===VERSION) await put(SHELL,req,res.clone());
    return res;
  }catch(_){ return offline(); }
}
/* 数据（JSON）：网络优先、成功即更新本版缓存；断网・超时・5xx 时用缓存（本版优先）；4xx 照实返回 */
async function dataFirst(e,req){
  const net=fetch(req);
  let res=null;
  try{ res=await within(net,NET_WAIT); }
  catch(err){
    const hit=await matchOwn(req); if(hit) return hit;
    try{ res=await net; }catch(_){ return offline(); }
  }
  if(res.ok){ e.waitUntil(put(DATA,req,res.clone())); return res; }
  if(res.status>=500){ const hit=await matchOwn(req); if(hit) return hit; }
  return res;
}
/* 图：SVG（内容随配布可能更新）先给缓存、背后更新；位图看过即缓存、之后直接用 */
async function imageCached(e,req,revalidate){
  const hit=await matchOwn(req);
  const net=(!hit||revalidate)?fetch(req).then(function(res){ if(res.ok) e.waitUntil(put(DATA,req,res.clone())); return res; }):null;
  if(hit){ if(net) e.waitUntil(net.catch(function(){})); return hit; }
  try{ return await net; }catch(_){ return offline(); }
}

self.addEventListener('fetch',function(e){
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin || req.url.indexOf(SCOPE)!==0) return;
  const rel=url.pathname.slice(new URL(SCOPE).pathname.length);
  if(rel==='sw.js') return;
  if(req.mode==='navigate'){ e.respondWith(onNavigate(e)); return; }
  if(url.searchParams.has('v')){ e.respondWith(partFirst(req,url.searchParams.get('v'))); return; }
  if(/\.json$/.test(rel)){ e.respondWith(dataFirst(e,req)); return; }
  if(/\.svg$/i.test(rel)){ e.respondWith(imageCached(e,req,true)); return; }
  if(/\.(png|jpe?g|webp|gif)$/i.test(rel)){ e.respondWith(imageCached(e,req,false)); return; }
  if(/\.woff2$/i.test(rel)){ e.respondWith(imageCached(e,req,false)); return; } // 自托管の字体子集（fonts/*.woff2、名に内容ハッシュ）：画像と同じく初回に DATA へ入れて以後はそこから（版をまたいで継承；名が変われば新しい方を取る）
  e.respondWith(matchOwn(req).then(function(hit){ return hit||fetch(req).catch(offline); }));
});
