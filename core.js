'use strict';
/* ---------- DOM helper ---------- */
function el(tag, attrs, kids){
  const n=document.createElement(tag);
  if(attrs) for(const k in attrs){
    if(k==='class') n.className=attrs[k];
    else if(k==='html') n.innerHTML=attrs[k];
    else if(k==='text') n.textContent=attrs[k];
    else if(k.slice(0,2)==='on'&&typeof attrs[k]==='function') n.addEventListener(k.slice(2),attrs[k]);
    else if(attrs[k]!=null) n.setAttribute(k,attrs[k]);
  }
  if(kids) (Array.isArray(kids)?kids:[kids]).forEach(function(c){ if(c==null)return; n.appendChild(typeof c==='string'?document.createTextNode(c):c); });
  return n;
}
/* ---------- a11y helpers (Codex F1/F4/F6) ---------- */
let __svgUid=0;
function uniquifySvgIds(root){ // F1: データ内の inline SVG は全図 id="t"/"d"/"ar" を共有 → 注入毎に一意化しないと後続図の accessible name が先頭図に化ける
  root.querySelectorAll('svg').forEach(function(svg){
    const map={};
    svg.querySelectorAll('[id]').forEach(function(nd){ const nu=nd.id+'-u'+(++__svgUid); map[nd.id]=nu; nd.id=nu; });
    if(!Object.keys(map).length) return;
    const els=[svg].concat(Array.prototype.slice.call(svg.querySelectorAll('*')));
    els.forEach(function(nd){
      Array.prototype.forEach.call(nd.attributes,function(at){
        let v=at.value;
        if(at.name==='aria-labelledby'||at.name==='aria-describedby')
          v=v.split(/\s+/).map(function(tk){ return map[tk]||tk; }).join(' ');
        if((at.name==='href'||at.name==='xlink:href') && v.charAt(0)==='#' && map[v.slice(1)]) v='#'+map[v.slice(1)];
        if(v.indexOf('url(#')>=0) v=v.replace(/url\(#([^)]+)\)/g,function(m0,id){ return map[id]?'url(#'+map[id]+')':m0; });
        if(v!==at.value) nd.setAttribute(at.name,v);
      });
    });
  });
  return root;
}
const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const __inertStack=[]; // LIFO: {dis:[今回 inert にした], en:[今回 inert を解いた keep]} — modal と reviewX の重なりでも正しく巻き戻す
function setBackdropInert(on, keepEls){
  if(on){
    const keep=keepEls||[], dis=[], en=[];
    Array.prototype.forEach.call(document.body.children,function(c){
      if(c.tagName==='SCRIPT') return;
      if(keep.indexOf(c)>=0){ // 下層 record に inert にされた keep は復活させる (modal over reviewX)
        if(c.inert && __inertStack.some(function(r){ return r.dis.indexOf(c)>=0; })){
          c.inert=false; c.removeAttribute('aria-hidden'); en.push(c); }
        return;
      }
      if(c.inert) return; // 既に inert (閉じた reviewX / nav-leave 層) は他所有 — 触らない
      c.inert=true; c.setAttribute('aria-hidden','true'); dis.push(c);
    });
    __inertStack.push({dis:dis,en:en});
  }else{
    const r=__inertStack.pop(); if(!r) return;
    r.dis.forEach(function(c){ c.inert=false; c.removeAttribute('aria-hidden'); });
    r.en.forEach(function(c){ c.inert=true; c.setAttribute('aria-hidden','true'); });
  }
}
function trapFocus(container){ // F4: Tab / Shift+Tab を container 内で循環 (背景は inert なので実質保険の二重壁)
  container.addEventListener('keydown',function(e){
    if(e.key!=='Tab') return;
    const f=Array.prototype.filter.call(container.querySelectorAll(FOCUSABLE),
      function(x){ return x.getClientRects().length>0; });
    if(!f.length){ e.preventDefault(); return; }
    const a=document.activeElement;
    if(e.shiftKey){ if(a===f[0]||!container.contains(a)||a.getAttribute('tabindex')==='-1'){ f[f.length-1].focus(); e.preventDefault(); } }
    else if(a===f[f.length-1]){ f[0].focus(); e.preventDefault(); }
  });
}
const view=()=>document.getElementById('view');
let currentView=null; // closure replayed on language change (keeps you on the same screen)
/* ---------- view history stack (Brief 2-A: 返回到正确层级, 修掉详情页一律回首页的潜伏 bug) ---------- */
let viewStack=[]; // [{key, render}]  栈顶 = 当前屏; currentView 是栈顶 render 的别名
let navDir='none'; // 一次性方向信号 (供 setView 给页面套入场动画): 'fwd' 压栈前进 / 'back' goBack·goHome 后退 / 'none' 就地重绘
let viewSwapFade=false; // 一次性: 语言切换走就地重绘 (navDir='none'), 由 setLang 置 true, setView 给新内容套一次柔和淡入后复位
let qStep='none';  // 一次性题间步进信号 (供 renderRunner 给 .rbody 套轻量转场): 'next' / 'prev' / 'none'
let keepScroll=false; // 一次性: 就地揭示(练习选项/记述答え合わせ)保位。由 answerChoice/记述揭示置 true; setView 见此则不 scrollTo(0,0), 停在原地展开揭示 → 修「滚动后点选项」顶栏闪(吸顶态被 scrollTo 强拉触发位置重算) + 不跳回顶部
let courseSwapping=false; // 一次性: コース切替中は横滑りナビを止め、専用ヴェール転場に委ねる(setView が見る)
function registerFrame(render,key){
  try{ if(!document.getElementById('meiFloat')) meiInit(); }catch(e){} // 浮動入口の自愈(消失バグ対策) // renderX 调用: 同 key 就地替换栈顶(语言重放/同屏重绘不增长栈), 异 key 压栈
  const top=viewStack[viewStack.length-1];
  const samekey=!!(top && top.key===key);
  if(!samekey && navDir!=='back') navDir='fwd'; // 异 key = 前进; goBack/goHome 已置 'back' 时不覆盖
  if(samekey){ top.render=render; }
  else viewStack.push({key:key, render:render});
  currentView=render;
}
function baseHome(){ // 把栈重置成单一 home 帧(不绘制), 供会话/结果在其上压栈, 之后返回回首页
  viewStack=[{key:'home', render:renderHome}]; currentView=renderHome;
}
function goHome(){ // 显式回首页: どの経路(字標/読物戻る/其他)でも離脱手続きを必ず通す — 字標帰宅で data-mode が exam 滞留し浮動入口が永久消失した実機バグの根治
  try{ if(App.session){ pauseSessionClock(App.session); clearCareTimer(); clearRunnerTimer(); App.session=null; App.readerReturn=null; } }catch(e){}
  navDir='back'; viewStack=[]; renderHome(); }
function goBack(){ // 返回上一级: 先关浮层(与 Esc 统一); 栈底 no-op; 否则 pop 并重绘目标屏
  const root=document.getElementById('modalRoot');
  if(root && root.firstChild){ closeModal(); return; }
  if(viewStack.length<=1) return;
  navDir='back';
  viewStack.pop();
  const top=viewStack[viewStack.length-1];
  currentView=top.render;
  if(typeof top.render==='function') top.render();
}
function setView(node,wide){
  const wrap=document.querySelector('.wrap'); if(wrap) wrap.classList.toggle('wide',!!wide); document.body.classList.toggle('wide-view',!!wide); document.body.classList.remove('reader-view');
  const dir=navDir; navDir='none';
  try{ document.body.dataset.mode=(App.session&&App.session.mode==='exam')?'exam':'practice'; }catch(e){} // §4 模考降噪开关 (前向兼容 Brief 3)
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const v=view();
  v.style.position=''; v.style.zIndex=''; v.style.overflow=''; v.style.minHeight=''; // 防御性复位: 清掉旧版叠层方案 (v1.2.3/v1.2.6) 可能遗留的内联样式
  const directional = node && node.classList && (dir==='fwd'||dir==='back') && !reduce && !courseSwapping;
  // v1.3.0 方向性+视差导航 (回滚 3b): 旧屏作离场层 fixed 钉住当前视觉位置(与滚动解耦)在上淡出, 新屏自方向滑入; 变暗走 ::after 遮罩(禁 filter:brightness)。reduced-motion / 就地重绘(语言切换/答题揭示)走 else 分支 = 同步原子替换(旧行为, 画面始终单层、无切换残留)。首帧/启动 old 为空 → 瞬时, 不做无来由滑入。
  if(directional){
    document.querySelectorAll('.nav-leave-fwd,.nav-leave-back').forEach(function(x){ try{ x.remove(); }catch(_){} }); // 快速连点: 先清残留离场层防堆叠
    const old=v.firstElementChild;
    if(old){
      const r=old.getBoundingClientRect();
      old.style.position='fixed'; old.style.top=r.top+'px'; old.style.left=r.left+'px';
      old.style.width=r.width+'px'; old.style.height=r.height+'px'; old.style.margin='0';
      old.classList.add(dir==='fwd'?'nav-leave-fwd':'nav-leave-back');
      old.setAttribute('aria-hidden','true'); old.inert=true; // F5: 離場層は視覚演出専用 — 読み上げ木と Tab 順から即時除外(700ms の残置中に旧画面へ迷い込ませない)
      document.body.appendChild(old); // 移出 #view → 悬浮于内容之上(顶栏 z20 之下), 与 #view 清空解耦; fixed 故不随滚动跳位
      let od=false;
      const ocl=function(e){ if(e && e.target!==old) return; if(od) return; od=true; old.removeEventListener('animationend',ocl); try{ old.remove(); }catch(_){} };
      old.addEventListener('animationend',ocl);
      setTimeout(ocl, 700); // 兜底必清
    }
    v.innerHTML=''; v.appendChild(node); // old 已移走 → #view 清空后只挂新屏, 自然撑高 + 滚顶
    if(old){ // 有上一屏才给方向性入场 (首帧/启动 old 为空 → 瞬时)
      node.classList.add(dir==='fwd'?'nav-enter-fwd':'nav-enter-back');
      let nd=false;
      const ncl=function(e){ if(e && e.target!==node) return; if(nd) return; nd=true; node.removeEventListener('animationend',ncl); try{ node.classList.remove('nav-enter-fwd'); node.classList.remove('nav-enter-back'); }catch(_){} };
      node.addEventListener('animationend',ncl);
      setTimeout(ncl, 700);
    }
  } else {
    v.innerHTML=''; v.appendChild(node); // 就地重绘 / reduced-motion: 同步原子替换 (旧行为, 单层无残留)
  }
  if(courseSwapping && !reduce){ // コース切替: ヴェールの下で差し替えた新画面を、ヴェールが引くのと同時に立ち上げる
    v.classList.remove('course-rise'); void v.offsetWidth; v.classList.add('course-rise');
    const cr=function(){ v.classList.remove('course-rise'); v.removeEventListener('animationend',cr); };
    v.addEventListener('animationend',cr); setTimeout(cr,600);
  }
  if(viewSwapFade && node && node.classList){ viewSwapFade=false; try{ node.querySelectorAll('.exblock').forEach(function(x){ x.classList.add('langslide'); }); }catch(_){} } // 语言切换(方式A): 全体フェード(.viewswap)は廃止 — 開始 .4 が ~3フレーム(~48ms)薄暗く留まり「空白閃」に見えた。innerHTML 差替は同期=空白フレーム無し → 瞬時原子入替 + 解说块(.exblock)のみ langSlide(問題文/選択肢は不動)
  if(keepScroll){ keepScroll=false; } else { window.scrollTo(0,0); } // 就地揭示(keepScroll)保位: 不滚顶 → 顶栏吸顶态不被强拉重算 → 不闪; 真导航/翻题 keepScroll=false → 仍滚顶
}
function qtextNode(text,cls){ // 把题干里的【…】渲染成与正文分离的标签, 不改数据
  const wrap=el('div',{class:cls||'qtext jp'});
  const re=/【[^】]*】/g; let last=0,m;
  while((m=re.exec(text))!==null){
    if(m.index>last) wrap.appendChild(document.createTextNode(text.slice(last,m.index)));
    wrap.appendChild(el('span',{class:'qlabel',text:m[0]}));
    last=m.index+m[0].length;
  }
  if(last<text.length) wrap.appendChild(document.createTextNode(text.slice(last)));
  return wrap;
}
/* 案B マーカー双色高亮: 术语上双色荧光底衬(粉=本课重点 q.concepts / 黄=你的弱项 weakness>0)。canonical 只读, 纯呈现; 无别名字段故按概念名子串匹配, prose 内逐字出现才命中 */
function qTerms(q){ if(!q||!q.concepts||!q.concepts.length) return null;
  const key=q.concepts.slice(); const w=(App.progress&&App.progress.weakness)||{};
  return { key:key, weak:key.filter(function(c){ return w[c]>0; }) }; }
function markTerms(text, terms){
  const frag=document.createDocumentFragment();
  const all=[].concat((terms&&terms.key)||[], (terms&&terms.weak)||[]), uniq=[];
  all.forEach(function(t){ if(t&&uniq.indexOf(t)<0) uniq.push(t); });
  if(!uniq.length){ frag.appendChild(document.createTextNode(text)); return frag; }
  uniq.sort(function(a,b){ return b.length-a.length; }); // 长术语优先, 防短匹配吃掉长
  const weakSet={}; ((terms&&terms.weak)||[]).forEach(function(t){ weakSet[t]=1; });
  const re=new RegExp('('+uniq.map(function(t){ return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }).join('|')+')','g');
  let last=0,m;
  while((m=re.exec(text))!==null){
    if(m.index>last) frag.appendChild(document.createTextNode(text.slice(last,m.index)));
    frag.appendChild(el('mark',{class:'hl '+(weakSet[m[0]]?'hl-weak':'hl-key'),text:m[0]}));
    last=m.index+m[0].length; if(re.lastIndex===m.index) re.lastIndex++;
  }
  if(last<text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}
function richExplain(text, terms){ // 把解说/模範解答里的 ［…］【…】小标题分段, 避免相邻两段粘在一起; terms 提供时给术语上双色マーカー
  const box=el('div',{class:'exsecs'});
  if(text==null) return box;
  const re=/【[^】]*】|［[^］]*］/g;
  const labels=[]; let m;
  while((m=re.exec(text))!==null) labels.push({i:m.index,s:m[0],e:m.index+m[0].length});
  if(!labels.length){ var _p=el('p',{class:'jp exsec'}); _p.appendChild(terms?markTerms(text,terms):document.createTextNode(text)); box.appendChild(_p); return box; }
  if(labels[0].i>0){ const lead=text.slice(0,labels[0].i).replace(/[\s\u3000]+$/,''); if(lead.trim()){ var _pl=el('p',{class:'jp exsec'}); _pl.appendChild(terms?markTerms(lead,terms):document.createTextNode(lead)); box.appendChild(_pl); } }
  labels.forEach(function(lab,k){
    const bodyEnd=(k+1<labels.length)?labels[k+1].i:text.length;
    const body=text.slice(lab.e,bodyEnd).replace(/^[\s\u3000]+/,'').replace(/[\s\u3000]+$/,'');
    const sec=el('p',{class:'jp exsec'},[ el('span',{class:'exseclabel',text:lab.s}) ]);
    if(body) sec.appendChild(terms?markTerms(body,terms):document.createTextNode(body));
    box.appendChild(sec);
  });
  return box;
}

/* ---------- storage (namespaced, schemaVersion, fail-safe) ---------- */
const PROGRESS_SCHEMA=1;
function nk(suffix){ return 'quiz:'+(App.course?App.course.id:'_')+':'+suffix; }
function lsGet(key,def){ try{ const v=localStorage.getItem(key); return v==null?def:JSON.parse(v); }catch(e){ return def; } }
function lsSet(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); }catch(e){} }
function lsDel(key){ try{ localStorage.removeItem(key); }catch(e){} }

function emptyProgress(){ return {schemaVersion:PROGRESS_SCHEMA, seen:{}, wrong:{}, weakness:{}, stats:{exams:0}, attempts:[], cardMarks:{}, hideLearned:false, weakOnly:false}; } // §5-11: 単語帳 覚えた/苦手 マーク + 覚えたを隠す/苦手だけ(進捗として保存/移行)
function loadProgress(){
  const raw=lsGet(nk('progress'),null);
  if(!raw){ App.progress=emptyProgress(); return; }
  if(raw.schemaVersion!==PROGRESS_SCHEMA){
    // 版本不匹配: 先让用户导出, 再迁移/重置, 绝不静默清空
    pendingMigration=raw; App.progress=emptyProgress();
    queueMicrotask(showMigrationModal); return;
  }
  App.progress=Object.assign(emptyProgress(),raw);
}
function saveProgress(){ if(App.course) lsSet(nk('progress'),App.progress); }
let pendingMigration=null;

/* ---------- boot ---------- */
function applyLangButtons(){
  document.getElementById('langJa').classList.toggle('on',App.lang==='ja');
  document.getElementById('langZh').classList.toggle('on',App.lang==='zh');
  document.getElementById('langJa').setAttribute('aria-pressed',String(App.lang==='ja')); // F10: 現在言語を class 装飾だけでなく状態としても晒す
  document.getElementById('langZh').setAttribute('aria-pressed',String(App.lang==='zh'));
  var lw=document.querySelector('.lang'); if(lw) lw.setAttribute('data-lang',App.lang); // thumb 滑动到当前语言
  document.documentElement.lang=App.lang;
}
function setLang(l){ const y=window.scrollY; App.lang=l; lsSet('quiz:lang',l); applyLangButtons(); viewSwapFade=true; rerenderCurrent(); refreshChrome(); window.scrollTo(0,y); }
function refreshChrome(){
  try{ var _mf=document.getElementById('meiFloat'); if(_mf) _mf.setAttribute('aria-label',t('chatOpen')); var _mx=document.querySelector('.mcX'); if(_mx) _mx.setAttribute('aria-label',t('back')); var _mchat=document.getElementById('meiChat'); if(_mchat) _mchat.setAttribute('aria-label',t('chatOpen')); }catch(e){} // Mei 入口/閉釦/ダイアログ名の読み上げ文案も言語に追随
  var hb=document.getElementById('helpBtn'); hb.title=t('helpTitle'); hb.setAttribute('aria-label',t('helpTitle'));
  var sb=document.getElementById('setBtn'); if(sb){ sb.title=t('setTitle'); sb.setAttribute('aria-label',t('setTitle')); }
  var vb=document.getElementById('verBadge'); if(vb) vb.textContent='v'+APP_VERSION;
  /* v1.6.0: brand は固定 wordmark のため course/lang での書き換えなし */
  /* v1.7.0: courseBtn にラベルが一度も入っていなかった。2門目を足すと
   * courses.length>=2 で hide が外れ、空の 44px ボタンが topbar に現れる。 */
  var cb=document.getElementById('courseBtn');
  if(cb && App.course){
    var multi=((App.manifest&&App.manifest.courses)||[]).length>1;
    cb.innerHTML='';
    cb.appendChild(el('span',{class:'cbtn-t jp',text:courseShort(App.course)}));
    if(multi) cb.appendChild(el('span',{class:'cbtn-c',text:'▾'}));
    cb.title=t('courseSwitch'); cb.setAttribute('aria-label',t('courseSwitch'));
  }
}
/* 課の短縮名(topbar の chip 用。「神経心理学概論」は topbar には長い) */
function courseShort(c){
  if(!c) return '';
  var full=L(c.title)||'';
  return full.replace(/概論$|概论$/,'');
}
/* v1.7.0: 課ごとの皮膚。--accent 3変数だけでは影・グロー・罫が臨床のピンクのまま残るため、
 * manifest の skin{} をまるごと :root に流し込む(未指定キーは既定=臨床の見た目)。 */
function applySkin(meta){
  var root=document.documentElement;
  var skin=(meta&&meta.skin)||{};
  Object.keys(skin).forEach(function(k){ root.style.setProperty(k,skin[k]); });
  var tc=document.querySelector('meta[name="theme-color"]');
  if(tc && skin['--theme']) tc.setAttribute('content',skin['--theme']);
  root.setAttribute('data-course',(meta&&meta.id)||'');
  root.setAttribute('data-shape',(meta&&meta.shape)||'exam');
}

async function fetchJSON(url){
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok) throw new Error('HTTP '+res.status+' @ '+url);
  return res.json();
}

async function boot(){
  App.dev=/[?&]dev=1/.test(location.search);
  document.getElementById('devBtn').classList.toggle('hide',!App.dev);
  App.lang=lsGet('quiz:lang','ja'); applyLangButtons();
  App.rng=C.makeProdRng();
  installErrorBoundary();
  document.addEventListener('keydown',onKey);
  document.addEventListener('visibilitychange',onVisibility);
  wireChrome();
  try{
    App.manifest=await fetchJSON('course-manifest.json');
  }catch(e){ return renderLoadError('course-manifest.json',e); }
  const lastId=lsGet('quiz:lastCourse',null);
  const courses=App.manifest.courses||[];
  const pick=courses.find(c=>c.id===lastId)||courses[0];
  if(!pick) return renderLoadError('course-manifest.json',new Error('no courses'));
  document.getElementById('courseBtn').classList.toggle('hide',courses.length<2);
  await loadCourse(pick);
}

async function loadCourse(meta){
  App.course=meta; lsSet('quiz:lastCourse',meta.id);
  applySkin(meta);
  /* v1.7.0: 課の切替時に前の課のフレーム/セッション/リーダー位置が残っていた。
   * そのまま「戻る」を押すと前の課の画面へ落ちる。ここで断つ。 */
  viewStack=[]; App.session=null; App.reader=null; App.readerReturn=null;
  /* Mei も課ごとの相棒。開いたまま切り替えると、臨床にいるのに
   * 「強調ポイント 22件」など神経の手が残り、押すと空の画面が出る(実機で確認)。まるごと畳む。 */
  resetMei();
  refreshChrome();
  let questions,concepts;
  try{
    questions=await fetchJSON(meta.dir+'/questions.json');
    concepts=await fetchJSON(meta.dir+'/concepts.json');
  }catch(e){ renderLoadError(meta.dir+'/questions.json',e); return false; } // 失敗は false を返す(呼び手が after を走らせないため)
  App.questions=questions; App.concepts=concepts;
  App.manual=await loadManual(meta); // 復習トラック手册(増強層・任意): 缺失/不正なら null, course 載入は止めない
  App.validation=C.validateContent(questions,concepts);
  if(App.validation.fatal){ renderRefuse(); return false; }
  App.idx=C.buildIndices(questions,concepts);
  loadProgress();
  reconcileExam();
  renderHome();
  return true;
}
async function loadManual(meta){ // 資料集リーダーのデータ源。任意: 失敗しても course を止めない
  try{
    const man=await fetchJSON(meta.dir+'/manual.json');
    if(man && man.boundTo && Array.isArray(man.units) && man.units.length) return man;
  }catch(e){}
  return null;
}

function renderLoadError(file,err){
  const isFile=location.protocol==='file:';
  setView(el('div',{class:'card'},[
    el('div',{class:'sechd'},[el('h2',{class:'jp',text:t('loadErr')})]),
    el('p',{class:'muted jp',text:t('fileErr')+': '+file}),
    el('pre',{class:'mono',style:'white-space:pre-wrap;font-size:11.5px;color:var(--no-deep);background:var(--no-wash);border:1px solid var(--no-line);border-radius:var(--r-1);padding:11px',text:String(err&&err.message||err)}),
    isFile? el('div',{class:'hint jp',style:'margin-top:14px',html:t('localFileHint').replace(/\n/g,'<br>')}) : null
  ]));
}
function renderRefuse(){
  setView(el('div',{class:'card'},[
    el('div',{class:'sechd'},[el('h2',{class:'jp',text:t('loadErr')})]),
    el('p',{class:'muted jp',text:t('refuse')}),
    el('p',{class:'mono',style:'font-size:11.5px;color:var(--no-deep)',text:'errors: '+App.validation.errors.length}),
    App.dev? el('button',{class:'btn sm',onclick:openDev,text:'DEV'}):null
  ]));
}
