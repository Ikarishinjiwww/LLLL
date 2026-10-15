'use strict';
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
let __svgUid=0;
function uniquifySvgIds(root){ // データ内の inline SVG は全図 id="t"/"d"/"ar" を共有 → 注入毎に一意化しないと後続図の accessible name が先頭図に化ける
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
function trapFocus(container){ // Tab / Shift+Tab を container 内で循環 (背景は inert なので実質保険の二重壁)
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
/* ---------- view history stack (返回到正确层级, 修掉详情页一律回首页的潜伏 bug) ---------- */
let viewStack=[]; // [{key, render}]  栈顶 = 当前屏; currentView 是栈顶 render 的别名
let navGen=0; // 导航代次：压栈・返回・重置栈时 +1；同 key 就地重绘（语言切换・获书写权后的重绘）不算。等待中的动作据此作废（X12b-01）
let navDir='none'; // 一次性方向信号 (供 setView 给页面套入场动画): 'fwd' 压栈前进 / 'back' goBack·goHome 后退 / 'none' 就地重绘
let viewSwapFade=false; // 一次性: 语言切换走就地重绘 (navDir='none'), 由 setLang 置 true, setView 给新内容套一次柔和淡入后复位
let qStep='none';  // 一次性题间步进信号 (供 renderRunner 给 .rbody 套轻量转场): 'next' / 'prev' / 'none'
let navSkipLeave=false; // 一次性：次の setView で旧画面を離場層として残さない（新画面の入場だけ）。回ページ→練習：1500 節点の旧画面を fixed にして残すと、新画面の強制布局と二層の描画で INP が約 120ms 増える（V-06 系・進練習 272→152 の実測）
let keepScroll=false; // 一次性: 就地揭示(练习选项/记述答え合わせ)保位。由 answerChoice/记述揭示置 true; setView 见此则不 scrollTo(0,0), 停在原地展开揭示 → 修「滚动后点选项」顶栏闪(吸顶态被 scrollTo 强拉触发位置重算) + 不跳回顶部
let courseSwapping=false; // 一次性: コース切替中は横滑りナビを止め、専用ヴェール転場に委ねる(setView が見る)
function registerFrame(render,key){
  try{ if(!document.getElementById('buddyFloat')) buddyInit(); }catch(e){} // 浮動入口の自愈(消失バグ対策) // renderX 调用: 同 key 就地替换栈顶(语言重放/同屏重绘不增长栈), 异 key 压栈
  const top=viewStack[viewStack.length-1];
  const samekey=!!(top && top.key===key);
  if(!samekey && navDir!=='back') navDir='fwd'; // 异 key = 前进; goBack/goHome 已置 'back' 时不覆盖
  if(samekey){ top.render=render; }
  else { if(top){ top.y=window.scrollY; top.fi=viewFocusIndex(); } viewStack.push({key:key, render:render}); navGen++; } // 離れる画面の位置と焦点を覚える：戻ったときに元の所へ（S6 U-40）
  if(typeof swOnFrame==='function') swOnFrame(key); // 离线：新版提示只在首页（安全点）出
  currentView=render;
}
function baseHome(){ // 把栈重置成单一 home 帧(不绘制), 供会话/结果在其上压栈, 之后返回回首页
  viewStack=[{key:'home', render:renderHome}]; currentView=renderHome; navGen++;
}
function viewFocusIndex(){ const v=view(), a=document.activeElement; if(!v||!a||!v.contains(a)) return null; const i=viewFocusables(v).indexOf(a); return i>=0?i:null; }
function viewFocusables(v){ return Array.prototype.filter.call(v.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])'),function(x){ return !x.disabled && x.getClientRects().length>0; }); }
function restoreFrame(f){ // 戻った画面を、離れたときの位置と焦点へ（描き終わってから）
  if(!f || f.noRestore || (f.y==null && f.fi==null)) return;
  const y=f.y, fi=f.fi;
  requestAnimationFrame(function(){ if(y!=null) window.scrollTo(0,y);
    if(fi!=null){ const v=view(), e=v&&viewFocusables(v)[fi]; if(e){ try{ e.focus({preventScroll:true}); }catch(_){} } }
    if(y==null) return;
    let n=0, last=window.scrollY; // 画像などが後から高さを持つと、先に戻した位置は短いページに押し込まれている：伸びるあいだ少しだけ追い直す（利用者が動かしたらやめる）
    const tick=function(){ if(++n>12 || window.scrollY!==last || Math.abs(window.scrollY-y)<2) return; window.scrollTo(0,y); last=window.scrollY; setTimeout(tick,120); };
    setTimeout(tick,120); });
}
function goHome(){ // 显式回首页: どの経路(字標/読物戻る/其他)でも離脱手続きを必ず通す — 字標帰宅で data-mode が exam 滞留し浮動入口が永久消失した実機バグの根治
  try{ if(App.session){ examDropClean(); pauseSessionClock(App.session); clearCareTimer(); clearRunnerTimer(); App.session=null; App.readerReturn=null; } }catch(e){}
  try{ if(App.rxRun){ if(typeof rxClearTimer==='function') rxClearTimer(); App.rxRun=null; } }catch(e){} // 新課の練習も離れる：限時の再試行が首页・別の課で走り続けていた（CR-23） // 捨てる前に定稿済み模試の残り記録を消し直す（X17b-01）
  const h=(viewStack[0]&&viewStack[0].key==='home')?viewStack[0]:null; // 首页に戻るときも、首页で離れた位置へ（回タイル→練習→ホーム）
  navDir='back'; viewStack=[]; renderHome(); restoreFrame(h); }
/* ---------- 路由（第二批 A'・U-38）：ブラウザ／OS の「戻る」で一段戻る（サイトから出ない）。深い画面にいるあいだ（または対話框が開いているあいだ）だけ、
 * 履歴に見張りを一つ置き、popstate で画面の「戻る」を代行する。画面の場所は hash（再読み込みで戻れる画面だけ）、題名は画面名＋課名。
 * 画面の積み方（viewStack）・書き手・札・交接は変えない ---------- */
const NAV_BASE_TITLE=document.title;
let navPopPending=false, navScrollT=0, navReady=false;
try{ if('scrollRestoration' in history) history.scrollRestoration='manual'; }catch(e){}
function navRoute(key){ // 再読み込みで戻せる画面の hash。演習中・結果・模試などは課の首页
  if(!App.course) return '';
  const c='#/'+App.course.id, k=key||'';
  if(k.indexOf('rx-lec:')===0) return c+'/lec/'+encodeURIComponent(k.slice(7));
  if(k==='reader' && App.reader) return c+'/reader/'+App.reader.kai+'/'+App.reader.sec;
  if(k==='readerIndex') return c+'/reader';
  if(k.indexOf('rx-concept:')===0) return c+'/rx-concept/'+encodeURIComponent(k.slice(11));
  if(k.indexOf('concept:')===0) return c+'/concept/'+encodeURIComponent(k.slice(8));
  if(k==='flashcards') return c+'/cards';
  if(k==='rx-search') return c+'/search'+(App.rxSearchQ?'/'+encodeURIComponent(App.rxSearchQ):''); // 新課の検索（S1：rx-search.js、語は App.rxSearchQ）
  return c;
}
function navRestorable(key){ return key==='home' || navRoute(key)!==(App.course?'#/'+App.course.id:''); }
function navTitle(){ // 題名＝画面の見出し・課名・品牌（既存の画面名だけを使う）
  const v=view(), h=v&&v.querySelector('h1, .sechd h2, h2'), course=App.course?(L(App.course.title)||''):'';
  const name=h?h.textContent.replace(/\s+/g,' ').trim():'';
  return (name && name!==course ? name+' · ' : '')+(course?course+' – ':'')+NAV_BASE_TITLE;
}
function navDeep(){ const r=document.getElementById('modalRoot'), bc=document.getElementById('buddyChat'); return viewStack.length>1 || !!(r && r.querySelector(':scope > .modal:not(.closing)')) || !!(bc && bc.classList.contains('on')); } // 閉じかけの対話框は数えない。talk の浮窓が開いていれば首页でも見張りを置く（CR-06）
function navSync(){
  if(!App.course || !navReady) return;
  const top=viewStack[viewStack.length-1]; if(!top) return;
  try{ document.title=navTitle(); }catch(e){}
  if(navPopPending) return;
  const h=location.pathname+location.search+navRoute(top.key), st=history.state||{};
  try{
    if(navDeep() && !st.rxNav){ history.replaceState({rxBase:1}, '', location.pathname+location.search+navRoute('home')); history.pushState({rxNav:1}, '', h); }
    else if(!navDeep() && st.rxNav){ navPopPending=true; history.back(); } // 首页に戻った：見張りを外す（次の「戻る」はふつうにサイトを離れる）
    else if(location.pathname+location.search+location.hash!==h) history.replaceState(st, '', h);
  }catch(e){}
}
function navBack(){ // 「戻る」の代行：対話框・talk を閉じる → 演習・模試は各画面の戻り方（後始末つき）→ それ以外は一段戻る
  const root=document.getElementById('modalRoot'); if(root && root.querySelector(':scope > .modal:not(.closing)')){ closeModal(); return; }
  const bc=document.getElementById('buddyChat'); if(bc && bc.classList.contains('on') && typeof closeBuddyChat==='function'){ closeBuddyChat(); return; }
  const top=viewStack[viewStack.length-1], k=top&&top.key;
  if(App.session && (k==='runner'||k==='examGrading'||k==='result')){ if(k==='runner' && App.readerReturn && typeof backToReader==='function') backToReader(); else exitToHome(); return; } // 模試は保存されて首页から続けられる
  if(App.rxRun && k==='rx-run'){ if(typeof rxClearTimer==='function') rxClearTimer(); App.rxRun=null; goBack(); return; }
  if(viewStack.length>1) goBack();
}
window.addEventListener('popstate',function(e){
  if(navPopPending){ navPopPending=false; navSync(); return; }
  if(!navReady) return;
  const st=e.state||{};
  if(st.rxNav){ if(!navDeep()){ navDir='fwd'; navOpenHash(); } navSync(); return; } // 「進む」で見張りに戻った：深い画面ならそのまま、首页にいたら hash の画面を開き直す（以前は navSync が「浅い」と見て弾き返し、進むが効かなかった：S8 V-05）
  navBack(); navSync();
});
window.addEventListener('scroll',function(){ // 位置を履歴に覚える（再読み込みで戻る）。Safari の replaceState 回数制限に掛からないよう間引く
  if(!navReady || navScrollT) return;
  navScrollT=setTimeout(function(){ navScrollT=0; const top=viewStack[viewStack.length-1]; if(!top || !navRestorable(top.key) || navPopPending) return;
    try{ history.replaceState(Object.assign({},history.state||{},{y:Math.round(window.scrollY),yk:top.key}), ''); }catch(e){} },700);
},{passive:true});
function navOpenHash(){ // hash が今の課の深い画面なら、その画面を描く（起動時の復元と「進む」で共用）。描いたら true
  const m=/^#\/([^/]+)(?:\/(.*))?$/.exec(location.hash||'');
  if(!(m && App.course && m[1]===App.course.id && m[2])) return false;
  const before=viewStack.length;
    const r=m[2].split('/'), dec=function(x){ try{ return decodeURIComponent(x); }catch(e){ return x; } };
    try{
      if(r[0]==='lec' && r[1] && isRxCourse() && App.rx.ix.lecById[dec(r[1])]) renderRxLecture(dec(r[1]));
      else if(r[0]==='reader' && App.manual && r[1]) renderReader(+r[1], +(r[2]||0));
      else if(r[0]==='reader' && App.manual) renderReaderIndex();
      else if(r[0]==='rx-concept' && r[1] && isRxCourse()) renderRxConcept(dec(r[1]));
      else if(r[0]==='concept' && r[1] && App.idx && App.idx.conceptMeta && App.idx.conceptMeta[dec(r[1])]) renderConcept(dec(r[1]),{from:'home'});
      else if(r[0]==='cards' && !isRxCourse()) renderFlashcards();
      else if(r[0]==='search' && isRxCourse() && typeof rxSearchOpen==='function') rxSearchOpen(r[1]?dec(r[1]):''); // 新課の検索（S1）
    }catch(e){}
  return viewStack.length>before;
}
function navRestore(){ // 起動時：hash が今の課の画面なら、そこへ（位置も）
  navReady=true;
  const st=history.state||{};
  if(navOpenHash()){
    const top=viewStack[viewStack.length-1];
    if(top && st.y && st.yk===top.key) restoreFrame({y:st.y});
  }
  navSync();
}
function goBack(){ // 返回上一级: 先关浮层(与 Esc 统一); 栈底 no-op; 否则 pop 并重绘目标屏
  const root=document.getElementById('modalRoot');
  if(root && root.firstChild){ closeModal(); return; }
  if(viewStack.length<=1) return;
  navDir='back';
  viewStack.pop(); navGen++;
  const top=viewStack[viewStack.length-1];
  currentView=top.render;
  if(typeof top.render==='function') top.render();
  restoreFrame(top);
}
function setView(node,wide){ try{ setViewInner(node,wide); } finally { try{ navSync(); }catch(e){} } } // 描いたあとに履歴・題名を合わせる（U-38）
function setViewInner(node,wide){
  const wrap=document.querySelector('.wrap'); if(wrap) wrap.classList.toggle('wide',!!wide); document.body.classList.toggle('wide-view',!!wide); document.body.classList.remove('reader-view','rx-lec-view','rx-wide'); App.tocOpen=null; // rx-lec-view・rx-wide（宽屏样张）＝新課回次页（顶栏の目次ボタンを出す）は renderRxLecture が setView の後で付ける
  const dir=navDir; navDir='none';
  try{ document.body.dataset.mode=(App.session&&App.session.mode==='exam')?'exam':'practice'; }catch(e){} // 模考降噪开关
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const v=view();
  v.style.position=''; v.style.zIndex=''; v.style.overflow=''; v.style.minHeight=''; // 防御性复位: 清掉旧版叠层方案可能遗留的内联样式
  const skipLeave=navSkipLeave; navSkipLeave=false;
  const directional = node && node.classList && (dir==='fwd'||dir==='back') && !reduce && !courseSwapping;
  // 方向性+视差导航: 旧屏作离场层 fixed 钉住当前视觉位置(与滚动解耦)在上淡出, 新屏自方向滑入; 变暗走 ::after 遮罩(禁 filter:brightness)。reduced-motion / 就地重绘(语言切换/答题揭示)走 else 分支 = 同步原子替换(旧行为, 画面始终单层、无切换残留)。首帧/启动 old 为空 → 瞬时, 不做无来由滑入。
  if(directional){
    document.querySelectorAll('.nav-leave-fwd,.nav-leave-back').forEach(function(x){ try{ x.remove(); }catch(_){} }); // 快速连点: 先清残留离场层防堆叠
    const hadPrev=!!v.firstElementChild;
    const old=skipLeave?null:v.firstElementChild;
    if(old){
      const r=old.getBoundingClientRect();
      old.style.position='fixed'; old.style.top=r.top+'px'; old.style.left=r.left+'px';
      old.style.width=r.width+'px'; old.style.height=r.height+'px'; old.style.margin='0';
      old.classList.add(dir==='fwd'?'nav-leave-fwd':'nav-leave-back');
      old.setAttribute('aria-hidden','true'); old.inert=true; // 離場層は視覚演出専用 — 読み上げ木と Tab 順から即時除外(700ms の残置中に旧画面へ迷い込ませない)
      document.body.appendChild(old); // 移出 #view → 悬浮于内容之上(顶栏 z20 之下), 与 #view 清空解耦; fixed 故不随滚动跳位
      let od=false;
      const ocl=function(e){ if(e && e.target!==old) return; if(od) return; od=true; old.removeEventListener('animationend',ocl); try{ old.remove(); }catch(_){} };
      old.addEventListener('animationend',ocl);
      setTimeout(ocl, 700); // 兜底必清
    }
    v.innerHTML=''; v.appendChild(node); // old 已移走 → #view 清空后只挂新屏, 自然撑高 + 滚顶
    if(hadPrev){ // 有上一屏才给方向性入场 (首帧/启动为空 → 瞬时)；離場層を省いたときも入場は付ける
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
  if(viewSwapFade && node && node.classList){ viewSwapFade=false; try{ node.querySelectorAll('.exblock').forEach(function(x){ x.classList.add('langslide'); }); }catch(_){} } // 语言切换: 全体フェード(.viewswap)は廃止 — 開始 .4 が ~3フレーム(~48ms)薄暗く留まり「空白閃」に見えた。innerHTML 差替は同期=空白フレーム無し → 瞬時原子入替 + 解说块(.exblock)のみ langSlide(問題文/選択肢は不動)
  if(dir==='fwd'||dir==='back') focusViewHead(node); // 本当の画面遷移だけ：焦点を新しい画面の見出しへ（BODY に落とさない・読み上げが新画面から始まる）
  if(keepScroll){ keepScroll=false; } else { window.scrollTo(0,0); } // 就地揭示(keepScroll)保位: 不滚顶 → 顶栏吸顶态不被强拉重算 → 不闪; 真导航/翻题 keepScroll=false → 仍滚顶
}
function focusViewHead(node){
  if(!node || !node.querySelector) return;
  const a=document.activeElement; if(a && a!==document.body && node.contains(a)) return; // 新画面の中にもう焦点があれば動かさない
  const h=node.querySelector('h1,h2'); if(!h) return;
  if(!h.hasAttribute('tabindex')) h.setAttribute('tabindex','-1');
  try{ h.focus({preventScroll:true}); }catch(e){}
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
/* マーカー双色高亮: 术语上双色荧光底衬(粉=本课重点 q.concepts / 黄=你的弱项 weakness>0)。canonical 只读, 纯呈现; 无别名字段故按概念名子串匹配, prose 内逐字出现才命中 */
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
/* 旧課に新機能を課ごとに開くスイッチ（S1-d・course-manifest の features）。書いていない・true でないものは現行の動き。
 * 新課は契約で常に有効なので、この欄は読まない。 */
const FEATURE_KEYS=['answerFirst','spaced','optionMarks']; // printExport（旧課の印刷・書き出し）は 2026-10-15 に機能ごと下ろした
function feat(name){ const c=App.course; return !!(c && c.contract!==RX.CONTRACT && c.features && c.features[name]===true); }
function lsGet(key,def){ try{ const v=localStorage.getItem(key); return v==null?def:JSON.parse(v); }catch(e){ return def; } }
function lsSet(key,val){ if(!writeAllowed(key)){ if(writerOk) noteSave(key,false); return false; } try{ localStorage.setItem(key,JSON.stringify(val)); noteSave(key,true); return true; }catch(e){ noteSave(key,false); return false; } }
function lsDel(key){ if(!writeAllowed(key)){ if(writerOk) noteSave(key,false); return false; } try{ localStorage.removeItem(key); noteSave(key,true); return true; }catch(e){ noteSave(key,false); return false; } }
function lsSetRaw(key,raw){ if(!writeAllowed(key)){ if(writerOk) noteSave(key,false); return false; } try{ localStorage.setItem(key,raw); noteSave(key,true); return true; }catch(e){ noteSave(key,false); return false; } } // 退避しておいた生の文字列を書き戻す（取り込みの巻き戻し・取り消し）

/* ---------- 単一書き手：同じ課を複数のタブで開いたとき、記録を書けるのは「書き手」の文書一つだけ ----------
 * 排他は Web Locks（課ごとのロック）で取る。開いた順に待ち行列へ並び、先頭が書き手。ほかのタブは読むだけで、
 * 上部の帯の「こちらで続ける」で steal して引き継ぐ。書き手が閉じれば次のタブが自動で引き継ぐ。
 * 書き手になる経路はすべて becomeWriter() を通り、必ず手元の記憶を捨ててストレージから読み直してから書く。
 * さらに書き込みのたびに同期的にフェンス札（writer 鍵の owner）を確かめ、通知が届く前に古い書き手が書く窓を狭める。
 * Web Locks の無い環境（安全でない文脈・古い Safari）では、最後に名乗った文書が書き手（フェンス札だけで排他）。
 * 札が読めない・書けないときは「保存できない」状態として書き込みを許さない。
 * 書き手は pagehide でロックを返す（握ったまま離れると WebKit で次の文書の読み込みが止まる）。そのとき札に leaving とタブ印を残し、
 * 同じタブ（再読み込みで戻ってくる本人）以外は少しのあいだ譲る。
 * 「こちらで続ける」は協調的な引き継ぎ：BroadcastChannel で書き手に頼み、書き手は未保存を書き切って書くのをやめ、札に引き継ぎ先を
 * 書いてからロックを返す。頼んだ側は待ち行列から順にロックを受け取り、読み直してから書く。返事がなければ（凍結など）steal し、札が二の矢。
 * 知らせには送り手・代（札の n＝書き手になるたびに増える）・頼みの印を付ける。届く順は送り手ごとにしか揃わないので、新旧は受け取った時刻ではなく
 * 代で決める：その後に新しい書き手が決まった引き継ぎ・頼み・知らせは済んだものとして無視する（遅れて届いた古い知らせで、済んだ引き継ぎを巻き戻さない）。
 * 札そのものも遅れて届くことがある（WebKit ではタブをまたぐ localStorage の書き込みの届く順がロックの順とずれ、前の書き手が交出前に書いた札が
 * 次の書き手の札を上書きする）。ロックを持つ書き手は、自分より古い代の札を見たら遅れた書き込みとみなして札を書き直す（同じ代・新しい代なら本当に奪われた）。 */
const DOC_ID=Math.random().toString(36).slice(2)+Date.now().toString(36); // 文書ごとに一意（タブを複製しても別の ID）
const DOC_BORN=Date.now(), HANDOFF_GRACE=4000, HANDOFF_TIMEOUT=1500, LOCK_RETRY_MAX=3;
let TAB_TOKEN=(function(){ // 再読み込みをまたいで同じタブだと分かる印（複製・新規タブは別の印；複製が reload と報告されても起動時の名乗りで替える）
  let nav=''; try{ const e=performance.getEntriesByType('navigation')[0]; nav=e?e.type:''; }catch(e){}
  try{ let tk=sessionStorage.getItem('quiz:tab'); if(!tk || nav!=='reload'){ tk=DOC_ID; sessionStorage.setItem('quiz:tab',tk); } return tk; }catch(e){ return DOC_ID; }
})();
const WRITER_BC=(function(){ try{ return (typeof BroadcastChannel==='function')?new BroadcastChannel('reviewx-writer'):null; }catch(e){ return null; } })();
let unsavedKeys={}; // 書き手なのに書けなかった本課の鍵（札が読めない・保存先に書き込めない）。残っている間は書き手のまま「保存できません」の帯を出す。その鍵の次の書き込みが通れば消える（X15d-01：保存の失敗と書き手かどうかは別のこと）
function hasUnsaved(key){ return key ? !!unsavedKeys[key] : Object.keys(unsavedKeys).length>0; }
function noteSave(key,ok){ if(!isCourseKey(key)) return; const before=hasUnsaved(); if(ok) delete unsavedKeys[key]; else unsavedKeys[key]=1; if(before!==hasUnsaved()) renderWriterBanner(); } // 只読のタブが書かないのは数えない（呼ぶ側で書き手のときだけ）
let replacingData=false; // 取り込み・取り消し・全消去のあとの再読み込み：離页で記憶の古い値を書き戻さない
function dataReplaced(){ replacingData=true; clearUnsaved(); try{ if(App.session){ pauseSessionClock(App.session); App.session=null; } if(App.rxRun){ if(typeof rxClearTimer==='function') rxClearTimer(); App.rxRun=null; } }catch(e){} } // 記憶の会話も終える：visibilitychange・blur が pagehide より先に来ても古い模試を書かない（WLR1 合并裁定 三-7）。新課の限時の練習も止める：再読み込みまでに到点して置き換えたデータへ時間切れを書かない（WLR-B 四・WLR2 七、軽重置と同じ） // 取り込み・取り消し・全消去で存档を置き換えた（続けて再読み込みする）：この文書は離页で記憶の古い値を書き戻さない（合成稿 v3.3「替换数据后不写回」）
function onPageHide(){ if(!replacingData){ if(writerOk && hasUnsaved(nk('progress'))) saveProgress(); if(App.session && App.session.mode==='exam' && writerOk) persistExam(); } leaveWriter(); navGen++; } // 閉じる・移る直前（pagehide）：4.2.0 と同じく書けずにいた進度と模試を書く
function clearUnsaved(){ const had=hasUnsaved(); unsavedKeys={}; if(had) renderWriterBanner(); } // 記憶を捨てて読み直したとき
function forgetUnsaved(key){ if(!unsavedKeys[key]) return; delete unsavedKeys[key]; if(!hasUnsaved()) renderWriterBanner(); } // 書けなかった操作そのものが取りやめになった：待つものが無いので印を外す（「書けた」ではない：X15e-01）
let handoffReq=null; // 自分が出した「譲って」：{cid, id, superseded}（他の頼み手に先を越されたら、その書き手が決まってから頼み直す）
let writerGen=0, reqSeq=0; // writerGen＝自分が書き手になったときの代
const courseGen={}; // 課ごとに持つ：known＝これまでに知ったいちばん新しい代（札・知らせから）、hint＝BroadcastChannel で受けた知らせ（{kind:'handoff',to,gen,at}／{kind:'leaving',tab,gen,at}：札の伝わりが遅いエンジンでも譲れるように）
function cg(){ const k=App.course?App.course.id:''; return courseGen[k]||(courseGen[k]={known:0,hint:null}); } // 代は課ごとに数える（切課しても、ほかの課の代・知らせが混ざらない）
function noteGen(n){ const s=cg(); if(typeof n==='number' && n>s.known) s.known=n; }
let writerOk=false, storageBroken=false, lockRetrying=false, lockAbort=null, lockRelease=null, lockCourse=null, bannerTimer=null, yieldTimer=null, retryTimer=null, handoffTimer=null, lockFailures=0;
function writerKey(){ return nk('writer'); }
function readFence(){ try{ const f=JSON.parse(localStorage.getItem(writerKey())||'null'); if(f) noteGen(f.n); return f; }catch(e){ return undefined; } } // undefined＝読めない
function fenceLost(){ return fenceState()==='lost'; } // 札が読めて、ほかの文書の名になっている（読めない・書き直しを確かめられないのは保存の故障で、失権ではない：X15-02・X15b-02）
function ownsFence(){ const f=readFence(); return !!(f && f.owner===DOC_ID); }
function claimFence(){ // フェンス札を自分の名で書き、読み戻して確かめる。失敗＝保存できない
  try{ const f=readFence(); if(f===undefined) return false;
    const n=Math.max((f&&f.n)||0,cg().known)+1; // 札の伝わりが遅くても、知らせで知った代より小さい代を名乗らない
    localStorage.setItem(writerKey(),JSON.stringify({owner:DOC_ID,n:n}));
    if(!ownsFence()) return false;
    writerGen=n; noteGen(n); return true; }catch(e){ return false; }
}
function staleFence(f){ // 札が、自分より古い代の書き手の遅れて届いた書き込み（引き継ぎ・離脱の印など）で上書きされた。WebKit ではタブをまたぐ書き込みの届く順がロックの順とずれる
  return !!(writerOk && lockRelease && f && f.owner!==DOC_ID && typeof f.n==='number' && f.n<writerGen);
}
function fenceState(){ // 札を一度だけ読んで決める（X15b-02）：'mine'＝自分（古い代の遅れた札は書き直し、読み戻して確かめた）・'lost'＝別の文書（同じ代か新しい代＝本当に奪われた）・'broken'＝読めない／書き直しを確かめられない（保存の故障で、失権ではない）
  const f=readFence();
  if(f===undefined) return 'broken';
  if(f && f.owner===DOC_ID) return 'mine';
  if(!staleFence(f)) return 'lost';
  try{ localStorage.setItem(writerKey(),JSON.stringify({owner:DOC_ID,n:writerGen})); }catch(e){ return 'broken'; } // ロックを持つ書き手が札を書き直す
  const g=readFence();
  if(g===undefined) return 'broken';
  return (g && g.owner===DOC_ID)?'mine':'lost';
}
function fenceMine(){ return fenceState()==='mine'; } // 札が自分のものか（札の持ち主を確かめる所はすべて fenceState を通す）
function confirmWriter(){ // この書き込みを通してよいか。札が別の文書のもの（lost）なら只読へ。読めない・書き直しを確かめられない（broken）は一時的な保存の故障：この一回だけ通さず、書き手のまま次の書き込みで確かめ直す（只読・ロック保持・戻る道なし、の組み合わせを作らない：X15c-01）
  const st=fenceState(); if(st==='mine') return true;
  if(st==='lost' && writerOk) setWriter(false);
  return false;
}
function holdsWriter(){ // いまこの文書が書き手か（札まで確かめる）。違えば只読に切り替えて帯を光らせる
  if(writerOk && confirmWriter()) return true; // 古い代の遅れた書き込みなら書き手のまま札を戻す。同じ代・新しい代の別の文書なら本当に奪われた（通知より先に気づいた）：只読へ
  pulseWriterBanner(); return false;
}
function isCourseKey(key){ // この課の名前空間の鍵（札を除く）
  return !!App.course && typeof key==='string' && key.indexOf('quiz:'+App.course.id+':')===0 && key!==writerKey();
}
function writeAllowed(key){ // この課の名前空間（札を除く）へ書けるのは、札を持つ書き手だけ
  if(!isCourseKey(key)) return true;
  return holdsWriter();
}
function yieldDelay(){ // ロックを受け取ったが譲るべきときの残り時間：引き継ぎ先が別の文書／離れた書き手が別のタブ
  const f=readFence(); if(f && f.owner===DOC_ID) return 0;
  const now=Date.now(), s=cg(), h=(s.hint && s.hint.gen>=s.known)?s.hint:null; // h＝札より先に届く知らせ（エンジンによっては札の伝わりが遅い）。その後に書き手が決まった知らせは済んでいる
  let hand=null; // いちばん新しい「引き継ぎ先」：札と知らせのうち代の新しいほう（古い札の引き継ぎ先に惑わされない）
  if(f && f.handoffTo) hand={to:f.handoffTo,gen:f.n||0,at:f.at||0};
  if(h && h.kind==='handoff' && (!hand || h.gen>=hand.gen)) hand={to:h.to,gen:h.gen,at:h.at};
  if(hand) return hand.to===DOC_ID ? 0 : Math.max(0,hand.at+HANDOFF_TIMEOUT*2-now); // 自分あてなら待たない；ほかあてなら譲る
  let wait=0;
  if(f && f.leaving && !(f.tab ? f.tab===TAB_TOKEN : f.leaving<DOC_BORN)) wait=Math.max(wait,f.leaving+HANDOFF_GRACE-now); // 同じタブの再読み込みは待たない（タブ印のない旧形式の札は生まれた時刻で見る）
  if(h && h.kind==='leaving' && h.tab!==TAB_TOKEN) wait=Math.max(wait,h.at+HANDOFF_GRACE-now);
  return Math.max(0,wait);
}
function becomeWriter(){ // 書き手になる唯一の入口
  const hadExam=!!(App.session && App.session.mode==='exam');
  const claimed=claimFence(); // 先に札を取ってから読み直す（読んだ後・札を取る前に古い書き手が書いた分を取りこぼさない）
  if(!claimed){ storageBroken=true; setWriter(false); return false; } // 接管できなかった：会話・記憶は消さない（CR-21：消してから戻っていた）
  const lost=(typeof lostNow==='function')?lostNow():null; // 読み直すと消える「保存できなかったもの」（告知と复制だけ：合成稿 v3.3 四。同じ処理の最後に見せ、持ち越さない）
  if(hadExam) App.session=null; // 試験は古い記憶を捨て、ストレージ側の状態から開き直す
  loadProgress(); clearUnsaved(); // 記憶を捨てて読み直した：書けずにいた記録はもう無い
  storageBroken=false; lockRetrying=false;
  if(handoffTimer){ clearTimeout(handoffTimer); handoffTimer=null; }
  const req=handoffReq?handoffReq.id:null;
  handoffReq=null; cg().hint=null;
  bcPost({t:'claimed',course:App.course.id,from:DOC_ID,gen:writerGen,req:req}); // 書き手が決まった：先を越された頼み手はこの書き手に頼み直す
  setWriter(true);
  if(pendingMigration) backupOldProgress(pendingMigration); // 迁移待ち：保存が始まる前に旧データを退避
  reconcileExam(); // 旧形式の試験記録の整理（書き手になってから）
  if(hadExam){ if(readExam()) resumeExam(); else goHome(); }
  else rerenderCurrent();
  if(lost) showLostDrafts(lost);
  return true;
}
function requestWriter(steal){ // steal=「こちらで続ける」
  if(!App.course) return;
  const cid=App.course.id;
  if(!(navigator.locks && navigator.locks.request)){ becomeWriter(); return; } // フォールバック：最後に名乗った文書が書き手
  if(yieldTimer){ clearTimeout(yieldTimer); yieldTimer=null; }
  if(retryTimer){ clearTimeout(retryTimer); retryTimer=null; }
  if(lockAbort){ try{ lockAbort.abort(); }catch(e){} lockAbort=null; }
  const ac=new AbortController(); if(!steal) lockAbort=ac;
  if(!steal && !writerOk) setWriter(false); // 待っている間は読むだけ（すぐ取れれば帯は出ない）
  let granted=false, lost=false, req;
  try{ req=navigator.locks.request('reviewx-writer:'+cid, steal?{steal:true}:{signal:ac.signal}, function(){
    granted=true; lockFailures=0;
    if(!App.course || App.course.id!==cid) return; // 課を離れた後に届いた
    if(lockAbort===ac) lockAbort=null;
    return new Promise(function(res){ // ロックを持ったまま一度タスクを譲ってから決める：先に届いている知らせ（引き継ぎ先）を読み込んでから（WebKit では順が逆になりうる）
      setTimeout(function(){
        if(lost || !App.course || App.course.id!==cid){ res(); return; } // その間に奪われた／課を離れた
        const wait=steal?0:yieldDelay();
        if(wait){ res(); yieldTimer=setTimeout(function(){ yieldTimer=null; if(App.course && App.course.id===cid) requestWriter(false); },wait+50); return; } // ロックはすぐ返して待つ
        lockCourse=cid; lockRelease=res; // 課を離れるまで持ち続ける
        becomeWriter();
      },0);
    });
  }); }catch(e){ req=Promise.reject(e); }
  req.catch(function(err){ // 持っていたロックを steal された／自分で取りやめた／取れずに拒まれた
    lost=true;
    if(lockCourse===cid){ lockCourse=null; lockRelease=null; }
    if(!App.course || App.course.id!==cid || ac.signal.aborted) return;
    if(writerOk) setWriter(false);
    if(granted){ requestWriter(false); return; } // steal された：待ち行列へ並び直す（引き継いだタブが閉じれば自動で戻る）
    lockFailed(cid);
  });
}
function lockFailed(cid){ // ロック API に拒まれた（SecurityError など）：間を置いて数回だけやり直し、だめなら「保存できない」に落とす
  lockFailures++; lockRetrying=true; // やり直しの間も「保存できない」と出す（別のタブのせいではない）
  if(lockFailures>LOCK_RETRY_MAX){ storageBroken=true; setWriter(false); return; } // 無限には繰り返さない（再読み込みでやり直せる）
  setWriter(false);
  retryTimer=setTimeout(function(){ retryTimer=null; if(App.course && App.course.id===cid) requestWriter(false); },500*Math.pow(2,lockFailures-1));
}
function releaseWriter(){ // 課を離れる：ロックを返し、待ちも取りやめる
  if(yieldTimer){ clearTimeout(yieldTimer); yieldTimer=null; }
  if(retryTimer){ clearTimeout(retryTimer); retryTimer=null; }
  if(handoffTimer){ clearTimeout(handoffTimer); handoffTimer=null; }
  handoffReq=null; writerGen=0; unsavedKeys={};
  lockFailures=0; lockRetrying=false;
  if(lockAbort){ try{ lockAbort.abort(); }catch(e){} lockAbort=null; }
  if(lockRelease){ const r=lockRelease; lockRelease=null; lockCourse=null; r(); }
  writerOk=false;
}
function leaveWriter(){ // pagehide：札に leaving とタブ印を残してからロックを返す（bfcache から戻れば pageshow で並び直す）
  if(writerOk){
    try{ if(fenceMine()) localStorage.setItem(writerKey(),JSON.stringify({owner:DOC_ID,n:writerGen,leaving:Date.now(),tab:TAB_TOKEN})); }catch(e){} // 代は自分が確かめた代（読み直した札の n を写さない：X15b-01）
    try{ if(WRITER_BC && App.course) WRITER_BC.postMessage({t:'leaving',course:App.course.id,from:DOC_ID,gen:writerGen,tab:TAB_TOKEN}); }catch(e){}
  }
  releaseWriter();
}
function onWriterKeyChanged(){ // 別の文書が札を書いた（steal の通知より先に届くこともある）
  if(writerOk) confirmWriter(); // 古い代の遅れた書き込みなら札を戻して書き手のまま
  const f=readFence();
  if(f && !f.leaving && !f.handoffTo && f.owner!==DOC_ID){
    cg().hint=null; // 引き継ぎ・再読み込みは済んだ
    if(yieldTimer) requestWriter(false); // 戻ってきた本人／引き継ぎ先が取った：その後ろに並ぶ
  }
}
function bcPost(m){ try{ if(WRITER_BC) WRITER_BC.postMessage(m); return !!WRITER_BC; }catch(e){ return false; } }
function handOff(to,req){ // 協調的に譲る：未保存を書き切る→（書けたら）引き継ぎを告げる→札に引き継ぎ先→書くのをやめる→ロックを返す→後ろに並び直す
  if(!writerOk || !lockRelease || !App.course) return;
  if(fenceLost()){ setWriter(false); return; } // もう書き手でない（失権の知らせがまだ届いていない）：断らずに退く。頼みには今の書き手が応える
  const cid=App.course.id;
  const flush=function(){ let ok=true; // 譲る前に書けずにいたものを書き切る：練習の進度（書けなかったときだけ：X15d-02）と模試（記述の下書き・時計）
    if(hasUnsaved(nk('progress'))) ok=(saveProgress()!==false) && ok;
    if(App.session && App.session.mode==='exam') ok=(persistExam()!==false) && ok;
    return ok; };
  let saved=true;
  try{ saved=flush(); }catch(e){ saved=false; }
  if(!saved && !fenceLost()){ try{ saved=flush(); }catch(e){ saved=false; } } // 一時的な故障なら一度だけ書き直す（有界）：直ればそのまま引き継ぐ（X15c-01）
  if(!saved){
    if(fenceLost()){ if(writerOk) setWriter(false); return; } // 書く間に札が移っていた：保存の故障ではないので断りは出さない
    // 書き手のまま書きかけを残せない：譲らない（ロックも札もそのまま、書きかけはこのタブに残る）。頼んだ側には断り、こちらにも知らせる
    bcPost({t:'refused',course:cid,from:DOC_ID,gen:writerGen,to:to,req:req});
    toast(t('handoffSaveFailed'));
    return;
  }
  bcPost({t:'handing',course:cid,from:DOC_ID,gen:writerGen,to:to,req:req}); // 書き手は生きていて、この相手に譲る（ほかの頼み手は強奪せず待つ）
  try{ const f=readFence(); if(f && f.owner===DOC_ID) localStorage.setItem(writerKey(),JSON.stringify({owner:DOC_ID,n:writerGen,handoffTo:to,at:Date.now()})); }catch(e){}
  setWriter(false);
  const r=lockRelease; lockRelease=null; lockCourse=null; r();
  requestWriter(false); // 引き継いだタブが閉じれば自動で戻る
}
function armHandoffTimer(ms,steal){ // 頼んだあとの見張り：steal＝返事が一つもなければ強奪；そうでなければ頼み直す
  if(handoffTimer) clearTimeout(handoffTimer);
  const cid=handoffReq&&handoffReq.cid;
  handoffTimer=setTimeout(function(){ handoffTimer=null;
    if(writerOk || !handoffReq || !App.course || App.course.id!==cid) return;
    if(steal){ handoffReq=null; requestWriter(true); } // 頼みはここで終える：強奪に負けても（同時に強奪した別のタブが取った等）待ち続けず、帯の「こちらで続ける」からやり直せる
    else sendHandoff();
  },ms);
}
function sendHandoff(){ // 「譲って」を出す（書き手が 1.5 秒で何も言わなければ凍結とみなして steal、札が二の矢）
  if(!handoffReq) return;
  handoffReq.superseded=false;
  readFence(); // 今の代を確かめてから頼む（頼みの代が古すぎると、済んだ頼みとして無視される）
  if(!bcPost({t:'handoff',course:handoffReq.cid,from:DOC_ID,to:DOC_ID,gen:cg().known,req:handoffReq.id})){ handoffReq=null; requestWriter(true); return; }
  armHandoffTimer(HANDOFF_TIMEOUT,true);
}
function onWriterMessage(e){ const m=(e && e.data)||{}; // 別のタブからの知らせ
  if(m.t==='tab-hello'){ if(m.tab===TAB_TOKEN && m.doc!==DOC_ID) bcPost({t:'tab-dup',tab:m.tab,to:m.doc}); return; } // 同じタブ印の文書が生まれた＝複製
  if(m.t==='tab-dup'){ if(m.to===DOC_ID && m.tab===TAB_TOKEN){ TAB_TOKEN=DOC_ID; try{ sessionStorage.setItem('quiz:tab',TAB_TOKEN); }catch(_){} } return; }
  if(!App.course || m.course!==App.course.id) return;
  const gen=(typeof m.gen==='number')?m.gen:-1;
  if(m.t==='handoff'){ // 頼みに応えるのは書き手だけ（ほかのタブは頼みだけでは道を譲らない）
    if(writerOk && m.to!==DOC_ID && gen>=writerGen-1) handOff(m.to,m.req); // 頼んだ時点の代がいまの書き手かその一つ前。もっと古い頼みは、その後の書き手を経て済んでいる
  }
  else if(m.t==='handing'){ // 書き手が m.to に譲るところ
    if(writerOk){ if(m.to!==DOC_ID && m.from!==DOC_ID && gen===writerGen-1) handOff(m.to,m.req); return; } // 知らせより先にロックが回ってきて書き手になっていた（横取り）：本来の相手へ回す。回すのは自分の直前の代の引き継ぎだけ
    if(gen<cg().known) return; // その後に新しい書き手が決まっている：済んだ引き継ぎ
    noteGen(gen);
    cg().hint={kind:'handoff',to:m.to,gen:gen,at:Date.now()}; // 自分あても記録（古い札の別あての引き継ぎ先より新しい）
    if(handoffReq){
      if(m.to===DOC_ID) armHandoffTimer(HANDOFF_TIMEOUT*2,true); // 自分あて：ロックが回ってくるのを待つ（念のための上限つき）
      else { handoffReq.superseded=true; armHandoffTimer(HANDOFF_TIMEOUT*2,false); } // 先を越された：新しい書き手が決まったら頼み直す
    }
  }
  else if(m.t==='claimed'){ // 新しい書き手が決まった：まだ待っているなら頼み直す（引き継ぎの最中に出した頼みは、まだ書き手でなかった相手に無視されうる）
    if(gen<cg().known) return; // 古い書き手の名乗り
    noteGen(gen);
    if(handoffReq && m.from!==DOC_ID) sendHandoff();
  }
  else if(m.t==='refused'){ if(m.to===DOC_ID && handoffReq && m.req===handoffReq.id && gen>=cg().known){ handoffReq=null; if(handoffTimer){ clearTimeout(handoffTimer); handoffTimer=null; } toast(t('handoffRefused')); } } // いまの頼みへの、いまの書き手からの断りだけ（その後に書き手が替わっていれば、新しい書き手への頼みは続ける）
  else if(m.t==='leaving'){ if(gen<cg().known) return; cg().hint={kind:'leaving',tab:m.tab,gen:gen,at:Date.now()}; }
}
function takeOverWriter(){ // 「こちらで続ける」
  if(!navigator.locks || !navigator.locks.request){ becomeWriter(); return; } // フォールバック：名乗れば書き手
  if(!App.course || (handoffReq && handoffTimer)) return; // 頼んで返事を見張っている最中（見張りのない頼みは残っていてもやり直せる）
  if(!WRITER_BC){ requestWriter(true); return; } // 頼む手段がない：steal
  if(!lockAbort) requestWriter(false); // 待ち行列に並んでいること（書き手が返したロックを順に受け取る）
  handoffReq={cid:App.course.id,id:DOC_ID+':'+(++reqSeq),superseded:false};
  sendHandoff();
}
function fenceOk(){ // 書き手で、札が確かに別の文書のものになっていない（CR-07）。札が別の文書なら只読へ切り替える（confirmWriter と同じ道）。
  // 札が読めない・確かめられない（保存の故障）は止めない：従来どおり書きに行かせ、書くときの故障表示（帯「保存できません」・未保存の印）に任せる（V3-21・V3-22・V3-25）
  if(!writerOk) return false;
  if(fenceState()==='lost'){ setWriter(false); return false; }
  return true;
}
function canWrite(){ // 書く操作の前に：内存の印だけでなく札まで同期で確かめる（CR-07：失権の知らせより先に別の文書が札を取った窓で、判分だけ出て記録が捨てられていた）
  if(fenceOk()) return true;
  pulseWriterBanner(); if(typeof roNotice==='function') roNotice();
  return false;
} // 只読の側で書く操作を押した：帯を光らせ、説明と「こちらで続ける」を出す（U-25：画面の層だけ。書き手の判定は変えない）
let writerWaiters=[];
function whenWriter(ms){ // 書き手が決まるのを待つ（切課直後に書く操作を始める入口用：S4-014）。なれたら true、時間内になれなければ false
  if(writerOk) return Promise.resolve(true);
  return new Promise(function(res){
    const w={res:res, t:setTimeout(function(){ writerWaiters=writerWaiters.filter(function(x){ return x!==w; }); res(writerOk); },ms)};
    writerWaiters.push(w);
  });
}
let writerWas=false; // この文書で一度でも書き手だった（交接で失った側は、遅れて出る帯を待たずに只読の説明を出す：CR-01）。表示だけに使い、書き手の決め方には関わらない
function setWriter(on){
  writerOk=on; if(on) writerWas=true;
  if(on && writerWaiters.length){ const ws=writerWaiters; writerWaiters=[]; ws.forEach(function(w){ clearTimeout(w.t); w.res(true); }); } // 解決は becomeWriter の描き直しの後（マイクロタスク）
  if(bannerTimer){ clearTimeout(bannerTimer); bannerTimer=null; }
  if(on || storageBroken || lockRetrying) renderWriterBanner();
  else bannerTimer=setTimeout(function(){ bannerTimer=null; if(!writerOk) renderWriterBanner(); },400); // 再読み込み直後の一瞬の待ちでは帯を出さない
}
function renderWriterBanner(){
  let b=document.getElementById('writerBanner');
  const unsaved=writerOk && hasUnsaved(); // 書き手でも書けずにいるものがある：保存の故障として知らせる（接管ボタンは出さない）
  if(writerOk && !unsaved){ if(b) b.remove(); document.body.classList.remove('writer-ro','ro-notice-open'); if(document.querySelector('#modalRoot .ro-notice') && typeof closeModal==='function') closeModal(); return; } // 帯が消えたら、帯を遮罩の上に出すための ro-notice-open も外す（恢復框が開いたままでも、空けた余白と高さの縮めを戻す：CC-06） // 書き手になった：只読の説明は閉じる（U-25・画面の層）
  if(b) b.remove();
  const broken=storageBroken||lockRetrying||unsaved;
  const kids=[ el('span',{class:'writerbar-t jp',text:t(broken?((typeof isRxCourse==='function' && isRxCourse())?'storageBlockedRx':'storageBlocked'):'writerLocked')}) ]; // 新課は保存できるまで解答を記録しない（CR-10）ので、その事実に合う文（N-E）
  if(!broken) kids.push(el('button',{class:'btn sm',id:'writerTakeover',text:t('writerTakeOver'),onclick:takeOverWriter}));
  b=el('div',{class:'writerbar',id:'writerBanner',role:'status'},kids);
  document.body.appendChild(b);
  document.body.classList.add('writer-ro');
  syncWriterBarH();
}
function refreshWriterBanner(){ if(document.getElementById('writerBanner')) renderWriterBanner(); } // 言語切替で文言を差し替える
function syncWriterBarH(){ const b=document.getElementById('writerBanner'); if(b) document.documentElement.style.setProperty('--writerbar-h',b.offsetHeight+'px'); } // 折り返しで高さが変わっても本文が帯の下に隠れない
function pulseWriterBanner(){ const b=document.getElementById('writerBanner'); if(!b) return; b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }

function emptyProgress(){ return {schemaVersion:PROGRESS_SCHEMA, seen:{}, wrong:{}, weakness:{}, stats:{exams:0}, attempts:[], cardMarks:{}, hideLearned:false, weakOnly:false}; } // 単語帳 覚えた/苦手 マーク + 覚えたを隠す/苦手だけ(進捗として保存/移行)
function loadProgress(){ App.unsavedAns={}; // 読み直した：保存できずにいた作答の件数（告知用）も消える
  const raw=lsGet(nk('progress'),null);
  if(!raw){ App.progress=emptyProgress(); return; }
  if(raw.schemaVersion!==PROGRESS_SCHEMA){
    // 版本不匹配: 先让用户导出, 再迁移/重置, 绝不静默清空。
    // 弹窗可能被直接关掉, 之后的任何保存都会覆写原键 → 先把旧数据原样存进备份键（已有则不动）。
    pendingMigration=raw; App.progress=emptyProgress();
    if(writerOk) backupOldProgress(raw); // 書き手でなければ、書き手になった時点で（becomeWriter）
    queueMicrotask(showMigrationModal); return;
  }
  App.progress=C.normalizeProgress(Object.assign(emptyProgress(),raw),PROGRESS_SCHEMA); // 端末内のデータが壊れていても描画を止めない
}
function saveProgress(){ if(!App.course) return false; const ok=lsSet(nk('progress'),App.progress); if(ok) App.unsavedAns={}; return ok; } // 戻り値＝書けたか（譲る前の書き切りが確かめる）。進度は丸ごと書くので、書けたら前に書けずにいた作答も入っている
function backupOldProgress(raw){ // 迁移前备份：旧数据原样存进 progress.bak.v<旧版>（已有则不动）。只由書き手写
  const bak=nk('progress.bak.v'+(raw.schemaVersion==null?0:raw.schemaVersion));
  if(lsGet(bak,null)===null) lsSet(bak,raw);
}
function delProgressBackups(){ // 迁移前备份 progress.bak.v* 的清理点：两档重置・完整导入成功后
  const pre=nk('progress.bak.'), keys=[];
  try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.indexOf(pre)===0) keys.push(k); } }catch(e){}
  keys.forEach(function(k){ lsDel(k); });
}
let pendingMigration=null;

function applyLangButtons(){
  document.getElementById('langJa').classList.toggle('on',App.lang==='ja');
  document.getElementById('langZh').classList.toggle('on',App.lang==='zh');
  document.getElementById('langJa').setAttribute('aria-pressed',String(App.lang==='ja')); // 現在言語を class 装飾だけでなく状態としても晒す
  document.getElementById('langZh').setAttribute('aria-pressed',String(App.lang==='zh'));
  var lw=document.querySelector('.lang'); if(lw) lw.setAttribute('data-lang',App.lang); // thumb 滑动到当前语言
  document.documentElement.lang=App.lang==='zh'?'zh-Hans':App.lang; // 簡体字の字形を選ばせる（S6 U-93）
  document.body.setAttribute('data-print-note',t('printOff')); // ブラウザの印刷では内容を出さずこの一行だけ（styles.css の @media print）
}
function setLang(l){ const y=window.scrollY; App.lang=l; lsSet('quiz:lang',l); applyLangButtons(); viewSwapFade=true; rerenderCurrent(); refreshChrome(); refreshWriterBanner(); window.scrollTo(0,y); }
function refreshChrome(){
  try{ var _mf=document.getElementById('buddyFloat'); if(_mf) _mf.setAttribute('aria-label',t('chatOpen')); var _mx=document.querySelector('.mcX'); if(_mx) _mx.setAttribute('aria-label',t('back')); var _mchat=document.getElementById('buddyChat'); if(_mchat) _mchat.setAttribute('aria-label',t('chatOpen')); }catch(e){} // 入口/閉釦/ダイアログ名の読み上げ文案も言語に追随
  var hb=document.getElementById('helpBtn'); hb.title=t('helpTitle'); hb.setAttribute('aria-label',t('helpTitle'));
  var sb=document.getElementById('setBtn'); if(sb){ sb.title=t('setTitle'); sb.setAttribute('aria-label',t('setTitle')); }
  var mb=document.getElementById('moreBtn'); if(mb){ mb.title=t('tbMore'); mb.setAttribute('aria-label',t('tbMore')); }
  var tc=document.getElementById('tocBtn'); if(tc){ tc.textContent=t('rdrToc'); tc.removeAttribute('title'); tc.removeAttribute('aria-label'); } // 新課回次页の目次：文字で「目次／目录」（図標だけでは目次と分からなかった：收尾第二轮 R-04）。可訪問名＝この文字
  var vb=document.getElementById('verBadge'); if(vb) vb.textContent='v'+APP_VERSION;
  /* brand は固定 wordmark のため course/lang での書き換えなし */
  /* courseBtn にラベルが一度も入っていなかった。2門目を足すと
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
/* 課ごとの皮膚。--accent 3変数だけでは影・グロー・罫が臨床のピンクのまま残るため、
 * manifest の skin{} をまるごと :root に流し込む(未指定キーは既定=臨床の見た目)。 */
/* 深色（第二批 U-43 样张）：各課の皮膚の色相から深色の値を引擎側で作る（app/courses/** と manifest は触らない）。
 * --accent-ink は浅色では「白文字の下地」と「強調の文字色」を兼ねるが、深色では明暗が逆になるので、実心ボタンの地は --cta-bg に分ける。
 * 文字色・ボタン地・補助文字は実測の対比度（4.6:1 以上）になるまで明度を動かす。設定の「自動／ライト／ダーク」は文案送审後（今は自動＝系統に従う）。 */
var darkKeys=[];
function themeDark(){ var p=lsGet('quiz:theme','auto'); if(p==='dark') return true; if(p==='light') return false; return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
function hexRgb(h){ h=String(h||'').trim().replace('#',''); if(h.length===3) h=h.split('').map(function(c){ return c+c; }).join(''); var n=parseInt(h,16); return [n>>16&255,n>>8&255,n&255]; }
function rgbHsl(c){ var r=c[0]/255,g=c[1]/255,b=c[2]/255, mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2, h=0, s=0;
  if(mx!==mn){ var d=mx-mn; s=l>.5?d/(2-mx-mn):d/(mx+mn); h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4); h/=6; } return [h,s,l]; }
function hslHex(h,s,l){ var f=function(n){ var k=(n+h*12)%12, a=s*Math.min(l,1-l); var v=l-a*Math.max(-1,Math.min(k-3,9-k,1)); return ('0'+Math.round(v*255).toString(16)).slice(-2); }; return '#'+f(0)+f(8)+f(4); }
function relLum(hex){ return hexRgb(hex).map(function(v){ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }).reduce(function(a,v,i){ return a+v*[.2126,.7152,.0722][i]; },0); }
function contrastOf(a,b){ var x=relLum(a), y=relLum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
function darkPalette(skin){
  var hs=rgbHsl(hexRgb(skin['--accent-ink']||'#9A5F7D')), H=hs[0], S=Math.min(hs[1],.42);
  var c=function(l,s){ return hslHex(H,s==null?.13:s,l); };
  var P={'--paper':c(.105,.12),'--card':c(.15,.12),'--card2':c(.13,.12),'--ink':c(.91,.16),'--faint':c(.46,.08),
    '--line':c(.24,.11),'--line2':c(.19,.11),'--track':c(.30,.11),'--hair':c(.32,.14),'--sep':c(.44,.10),
    '--accent':hslHex(H,S,.62),'--accent-wash':hslHex(H,Math.min(S,.28),.22),'--accent-deep':hslHex(H,S,.70),'--accent-deeper':hslHex(H,S,.76),
    '--ref-wash':hslHex(H,Math.min(S,.24),.20),'--theme':c(.105,.12),
    '--ok':'#7DB590','--ok-wash':'#1D2C23','--ok-line':'#2E4838','--ok-deep':'#9BD4AE',
    '--no':'#DE8A75','--no-wash':'#311F1A','--no-line':'#553027','--no-deep':'#F3AA96',
    '--fig-ink':'#4A3B44','--glow-rgb':'0,0,0','--glass-line':'rgba(255,255,255,.07)'};
  var L=.72; while(contrastOf(hslHex(H,S,L),P['--card'])<4.6 && L<.94) L+=.02; P['--accent-ink']=hslHex(H,S,L); // 強調の文字色（カード地で 4.6:1）
  var L2=.44; while(contrastOf('#FFFFFF',hslHex(H,S,L2))<4.6 && L2>.18) L2-=.02; P['--cta-bg']=hslHex(H,S,L2); // 実心ボタンの地（白文字で 4.6:1）
  var L3=.66; while((contrastOf(c(L3,.10),P['--card'])<4.6 || contrastOf(c(L3,.10),P['--paper'])<4.6) && L3<.9) L3+=.02; P['--soft']=c(L3,.10);
  var pr=hexRgb(P['--paper']); P['--glass']='rgba('+pr[0]+','+pr[1]+','+pr[2]+',.82)';
  var L4=.2; while(contrastOf(hslHex(H,Math.min(S,.3),L4),P['--card'])<1.6 && L4<.5) L4+=.01; P['--modal-edge']=hslHex(H,Math.min(S,.3),L4); // 弹窗の縁：課の色相の低明度（パネルと約 1.6:1・境界だけ。光る輪郭にしない）
  return P;
}
function applyTheme(skin){
  var root=document.documentElement, dark=themeDark();
  root.setAttribute('data-theme',dark?'dark':'light');
  if(!dark) return;
  var P=darkPalette(skin||{}); Object.keys(P).forEach(function(k){ root.style.setProperty(k,P[k]); darkKeys.push(k); });
  var tc=document.querySelector('meta[name="theme-color"]'); if(tc) tc.setAttribute('content',P['--paper']);
}
if(window.matchMedia){ try{ window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){ if(App.course) applySkin(App.course); }); }catch(e){} }
function applySkin(meta){
  var root=document.documentElement;
  var skin=(meta&&meta.skin)||{};
  darkKeys.forEach(function(k){ root.style.removeProperty(k); }); darkKeys=[]; // 前回の深色値を外してから皮膚を流す
  Object.keys(skin).forEach(function(k){ root.style.setProperty(k,skin[k]); });
  var tc=document.querySelector('meta[name="theme-color"]');
  if(tc && skin['--theme']) tc.setAttribute('content',skin['--theme']);
  applyTheme(skin);
  root.setAttribute('data-course',(meta&&meta.id)||'');
  root.setAttribute('data-shape',(meta&&meta.shape)||'exam');
}

async function fetchJSON(url){
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok) throw new Error('HTTP '+res.status+' @ '+url);
  return res.json();
}
/* データ束縛核対用――テキストで取り、UTF-8 バイト指紋(md5)を添えて parse する。
 * boundTo の md5 は生成側(Python)がファイルバイトで実測した値なので、同じバイト列で照合する。 */
const SUPPORTED_MANUAL_SCHEMAS=['manual-0.2','manual-0.3'];
async function fetchJSONv(url){
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok) throw new Error('HTTP '+res.status+' @ '+url);
  const text=await res.text();
  return { data: JSON.parse(text), md5: C.md5Hex(text) };
}

async function boot(){
  App.dev=/[?&]dev=1/.test(location.search);
  App.lang=lsGet('quiz:lang','ja'); applyLangButtons();
  App.rng=C.makeProdRng();
  if(typeof installErrorBoundary==='function') installErrorBoundary(); // dev 部件（?dev=1）だけが持つ
  document.addEventListener('keydown',onKey);
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('storage',function(e){ if(App.course && e.key===writerKey()) onWriterKeyChanged(); });
  if(WRITER_BC){ WRITER_BC.addEventListener('message',onWriterMessage); bcPost({t:'tab-hello',tab:TAB_TOKEN,doc:DOC_ID}); } // 起動時に名乗る（複製タブなら印を替えてもらう）
  window.addEventListener('resize',syncWriterBarH);
  window.addEventListener('blur',function(){ if(App.session && App.session.mode==='exam' && writerOk) persistExam(); }); // 別の窓へ移る：並べた窓で引き継がれても記述の入力が残る
  window.addEventListener('pagehide',onPageHide); // 閉じる・移る直前に記述の入力も残す。navGen＋1＝待っている書く操作を無効に（往返キャッシュから戻っても発火させない：X12c-01）
  window.addEventListener('pageshow',function(e){ if(e.persisted && App.course) requestWriter(false); });
  wireChrome();
  (function(){ // V-07（S8 persona 首批）：吸顶の半透明栏から本文が透けて叠字。B＝スクロール後は実色（body.tb-scrolled）。Q-051 で B に確定、A（不透明度 .92）は撤去
    var upd=function(){ document.body.classList.toggle('tb-scrolled', window.scrollY>4); };
    window.addEventListener('scroll',upd,{passive:true}); upd();
  })();
  try{
    App.manifest=await fetchJSON('course-manifest.json');
  }catch(e){ return renderLoadError('course-manifest.json',e); }
  const lastId=lsGet('quiz:lastCourse',null);
  const courses=App.manifest.courses||[];
  const hm=/^#\/([^/]+)\/[^/]/.exec(location.hash||''), hashId=hm?(function(x){ try{ return decodeURIComponent(x); }catch(e){ return null; } })(hm[1]):null; // 課の下に画面がある hash だけ（#/課 だけの首页は lastCourse に従う：首页は失う画面がなく、「lastCourse を替えて再読み込み」で新しく開くのと同じに扱う）
  const pick=courses.find(c=>c.id===hashId)||courses.find(c=>c.id===lastId)||courses[0]; // hash の課（manifest にあるものだけ）を先に：別のタブが課を替えると、再読み込みで元の課の画面を失っていた。書き手は課ごとなので、その課の札を取りに行くだけ（CR-03・S4 観察 2：別の課の深い画面の栞も開ける）
  if(!pick) return renderLoadError('course-manifest.json',new Error('no courses'));
  document.getElementById('courseBtn').classList.toggle('hide',courses.length<2);
  await loadCourse(pick);
  navRestore(); // 再読み込み：hash の画面と位置へ（U-38）
}

let loadSeq=0; // 課の読み込み要求の通し番号。追い越された古い要求の結果は捨てる
async function loadCourse(meta){
  if(meta && meta.contract===RX.CONTRACT) return loadRxCourse(meta); // 新课契约：rx-views.js
  /* 先に三件を取って検証し、全部そろってから一度に切り替える。途中で失敗したら何も変えない
   * （以前は先に課の身分と lastCourse を書き換えていたため、失敗すると前の課の題と新しい課の進捗が混ざった）。 */
  const seq=++loadSeq;
  const hadCourse=!!(App.course&&App.idx);
  let qv,cv,manRes;
  try{
    qv=await fetchJSONv(meta.dir+'/questions.json');
    cv=await fetchJSONv(meta.dir+'/concepts.json');
    manRes=await loadManual(meta,qv.md5,cv.md5); // 手册は「無い」は許すが「合わない」は止める
  }catch(e){
    if(seq!==loadSeq) return false;
    if(hadCourse){ toast(navigator.onLine===false?t('swCourseOff'):t('courseLoadFailToast').replace('{course}',L(meta.title))); return false; } // 元の課・元の画面のまま（lastCourse も不変）：オフラインならその旨、そうでなければ開けなかった課の名前
    renderLoadError(meta.dir+'/questions.json',e); return false;
  }
  if(seq!==loadSeq) return false;
  if(manRes && manRes.fatal){ if(hadCourse){ toast(t('loadErr')); return false; } renderBindError(manRes); return false; }
  const validation=C.validateContent(qv.data,cv.data);
  if(validation.fatal){ if(hadCourse){ toast(t('loadErr')); return false; } App.validation=validation; renderRefuse(); return false; }
  examDropClean(); // 前の課の定稿済み模試の残り記録は、ロックを返す前に消し直す（X17b-01）
  releaseWriter(); // 前の課のロックを返す
  App.course=meta; lsSet('quiz:lastCourse',meta.id);
  try{ if(App.rxRun && App.rxRun.cid!==meta.id){ if(typeof rxClearTimer==='function') rxClearTimer(); App.rxRun=null; } }catch(e){} // 切課が成った：前の課の練習を打ち切る（CR-23）。失敗したら元の練習と計時はそのまま（CR-33）
  applySkin(meta);
  viewStack=[]; App.session=null; App.reader=null; App.readerReturn=null; // 前の課のフレーム/セッション/リーダー位置を断つ
  resetBuddy(); // talk 窓も課ごとの相棒。開いたまま切り替えると前の課の手が残る
  refreshChrome();
  App.questions=qv.data; App.concepts=cv.data;
  App.manual=manRes?manRes.manual:null;
  App.validation=validation;
  App.idx=C.buildIndices(App.questions,App.concepts); App.errView=null;
  loadProgress();
  reconcileExam();
  renderHome();
  requestWriter(false); // 書き手の待ち行列へ。空いていればすぐ書き手になる（becomeWriter が読み直す）
  showImportSkipped();
  return true;
}
async function loadManual(meta,qMd5,cMd5){ // 存在すれば厳格核対、缺失は null(course を止めない)
  let mv;
  try{ mv=await fetchJSONv(meta.dir+'/manual.json'); }
  catch(e){ return null; } // 404/網路失敗＝手册なし(増強層は任意)
  const man=mv.data;
  if(!(man && man.boundTo && Array.isArray(man.units) && man.units.length))
    return { fatal:true, why:'struct' };
  if(SUPPORTED_MANUAL_SCHEMAS.indexOf(man.schemaVersion)<0)
    return { fatal:true, why:'schema', v:man.schemaVersion };
  if(man.boundTo.questionsMd5!==qMd5 || man.boundTo.conceptsMd5!==cMd5)
    return { fatal:true, why:'md5', q:[man.boundTo.questionsMd5,qMd5], c:[man.boundTo.conceptsMd5,cMd5] };
  return { manual:man };
}
function bindDetail(res){ // 明細は表示時に組む（説明句は i18n、ファイル名・欄名・版・md5・OK は機械値のまま）
  if(res.why==='struct') return 'manual: '+t('bindDetStruct')+'（boundTo/units）';
  if(res.why==='schema') return 'manual: '+tf('bindDetSchema',{v:String(res.v),list:SUPPORTED_MANUAL_SCHEMAS.join(' / ')});
  const md=function(x){ return x[0]===x[1]?'OK':tf('bindDetMd5',{want:String(x[0]),got:String(x[1])}); }; // 欠落・null も機械値としてそのまま出す（占位符を漏らさない：X14-02）
  return 'questions: '+md(res.q)+'\n'+'concepts:  '+md(res.c);
}

function renderBindError(res){ // 束縛不一致は静かに続行しない（可操作エラー）
  App.errView=function(){ renderBindError(res); }; // 課がまだ無い（App.idx なし）ときの描き直し先：言語切替で文言と明細も切り替える（X14-01）
  setView(el('div',{class:'card'},[
    el('div',{class:'sechd'},[el('h2',{class:'jp',text:t('bindErrTitle')})]),
    el('p',{class:'muted jp',text:t('bindErrBody')}),
    el('pre',{class:'mono',style:'white-space:pre-wrap;font-size:11.5px;color:var(--no-deep);background:var(--no-wash);border:1px solid var(--no-line);border-radius:var(--r-1);padding:11px',text:bindDetail(res)}),
    el('button',{class:'btn',text:t('bindErrReload'),onclick:function(){ location.reload(); }})
  ]));
}

function renderLoadError(file,err){
  App.errView=function(){ renderLoadError(file,err); };
  const isFile=location.protocol==='file:';
  setView(el('div',{class:'card'},[
    el('div',{class:'sechd'},[el('h2',{class:'jp',text:t('loadErr')})]),
    el('p',{class:'muted jp',text:t('fileErr')+': '+file}),
    el('pre',{class:'mono',style:'white-space:pre-wrap;font-size:11.5px;color:var(--no-deep);background:var(--no-wash);border:1px solid var(--no-line);border-radius:var(--r-1);padding:11px',text:String(err&&err.message||err)}),
    isFile? el('div',{class:'hint jp',style:'margin-top:14px',html:t('localFileHint').replace(/\n/g,'<br>')}) : null,
    el('div',{class:'row',style:'margin-top:14px;gap:10px'},[ // 行き止まりにしない: 再読み込みと課の切り替え（既存の文言を流用）
      el('button',{class:'btn',text:t('bindErrReload'),onclick:function(){ location.reload(); }}),
      ((App.manifest&&App.manifest.courses||[]).length>1)? el('button',{class:'btn ghost',text:t('loadPickCourse'),onclick:function(){ openCourseSwitch(); }}) : null
    ].filter(Boolean))
  ].filter(Boolean)));
}
function renderRefuse(){
  App.errView=renderRefuse;
  setView(el('div',{class:'card'},[
    el('div',{class:'sechd'},[el('h2',{class:'jp',text:t('loadErr')})]),
    el('p',{class:'muted jp',text:t('refuse')}),
    el('p',{class:'mono',style:'font-size:11.5px;color:var(--no-deep)',text:'errors: '+App.validation.errors.length}),
    (App.dev && typeof openDev==='function')? el('button',{class:'btn sm',onclick:openDev,text:'DEV'}):null
  ]));
}
